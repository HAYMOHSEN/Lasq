'use strict';
// Text expansion: a global keyboard hook (uiohook-napi) feeds a rolling buffer of recent
// keys; when the buffer ends with a snippet trigger, the trigger is deleted and the body
// is typed in. Each key is remembered twice: as the character the active layout produced
// (so Arabic triggers work) and as the character the same key gives on a US layout (so
// ";sig" still works while an Arabic layout is active). The body language follows the
// active layout: Arabic layout → Arabic body when the snippet has one.

const arabic = require('./arabic');
const placeholders = require('./placeholders');
const { createMatcher } = require('./triggers');
const { usCharForKey } = require('./keymap');
const { sleep } = require('./inject');

const MAX_KEYS = 64;

/**
 * Rolling key buffer. Pure (no Win32) so it can be unit-tested: see test/expansion.test.js.
 * Each entry: { actual: string (chars typed, may be '' or 2 chars), us: string ('' or 1 char) }
 */
function createKeyBuffer() {
  let keys = [];

  function push(actual, us) {
    keys.push({ actual: actual || '', us: us || '' });
    if (keys.length > MAX_KEYS) keys = keys.slice(-MAX_KEYS);
  }

  /** The user pressed Backspace: one character disappeared from the screen. */
  function backspace() {
    const last = keys[keys.length - 1];
    if (!last) return;
    if (last.actual.length > 1) last.actual = last.actual.slice(0, -1);
    else keys.pop();
  }

  function clear() { keys = []; }
  function actualText() { return keys.map((k) => k.actual).join(''); }
  function usText() { return keys.map((k) => k.us).join(''); }

  /**
   * How many on-screen characters the last `charCount` characters of `stream` ('actual' | 'us')
   * occupy, and the on-screen text itself (what Backspace must remove).
   */
  function tail(stream, charCount) {
    let need = charCount;
    let onScreen = '';
    for (let i = keys.length - 1; i >= 0 && need > 0; i--) {
      need -= keys[i][stream].length;
      onScreen = keys[i].actual + onScreen;
    }
    return { backspaces: onScreen.length, onScreen };
  }

  return { push, backspace, clear, actualText, usText, tail, get length() { return keys.length; } };
}

/**
 * @param {Object} deps { win32, store, injector, clipboard, getSettings, requestForm(req) → Promise<values|null>, onExpanded?, log? }
 */
function createExpansion(deps) {
  const { win32, store, injector, clipboard, getSettings, requestForm } = deps;
  const log = deps.log || (() => {});
  let uio = null;
  try { uio = require('uiohook-napi'); } catch (err) { log('expansion: uiohook-napi unavailable: ' + err.message); }

  const K = uio ? uio.UiohookKey : {};
  const MODIFIERS = new Set([K.Ctrl, K.CtrlRight, K.Alt, K.AltRight, K.Shift, K.ShiftRight, K.Meta, K.MetaRight, K.CapsLock, K.NumLock, K.ScrollLock].filter((v) => v !== undefined));
  const NAVIGATION = new Set([K.Tab, K.Enter, K.NumpadEnter, K.Escape, K.ArrowLeft, K.ArrowRight, K.ArrowUp, K.ArrowDown, K.Home, K.End, K.PageUp, K.PageDown, K.Delete, K.Insert,
    K.F1, K.F2, K.F3, K.F4, K.F5, K.F6, K.F7, K.F8, K.F9, K.F10, K.F11, K.F12].filter((v) => v !== undefined));

  const buffer = createKeyBuffer();
  let matcher = createMatcher([]);
  let lastHwnd = null;
  let running = false;
  let busy = false;
  let ignoreUntil = 0;
  let lastExpansion = null; // { at, onScreen, textLength, cursorFromEnd }

  function rebuild() {
    const s = getSettings();
    matcher = createMatcher(store.getSnippets(), { wordBoundary: s.expansion.wordBoundary, matchCase: s.expansion.matchCase });
  }

  function onKeydown(e) {
    try {
      if (busy || injector.isBusy() || Date.now() < ignoreUntil) return;
      const settings = getSettings();
      if (!settings.expansion.enabled || !win32.available) return;
      const key = e.keycode;
      if (MODIFIERS.has(key)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) { buffer.clear(); lastExpansion = null; return; }

      const hwnd = win32.getForegroundWindow();
      if (hwnd !== lastHwnd) { buffer.clear(); lastHwnd = hwnd; lastExpansion = null; }

      if (key === K.Backspace) {
        if (lastExpansion && Date.now() - lastExpansion.at < 4000) { undoLast().catch((err) => log('expansion: undo failed: ' + err.message)); return; }
        buffer.backspace();
        return;
      }
      lastExpansion = null;
      if (NAVIGATION.has(key)) { buffer.clear(); return; }

      const hkl = win32.getKeyboardLayoutForWindow(hwnd);
      const vk = win32.scanToVk(key, hkl);
      if (!vk || vk === win32.VK.PACKET) return;
      const caps = win32.capsLockOn();
      const actual = win32.toUnicode(vk, key & 0xff, { shift: e.shiftKey, ctrl: false, alt: false, caps }, hkl);
      const us = usCharForKey(key, { shift: e.shiftKey, caps });
      if (!actual && !us) return;
      buffer.push(actual, us);

      const app = win32.getProcessName(win32.getWindowPid(hwnd));
      if ((settings.expansion.excludedApps || []).map((s) => s.toLowerCase()).includes(app)) return;
      const found = findTrigger({ app });
      if (found) expand(found, { hwnd, hkl, app }).catch((err) => log('expansion: failed: ' + err.message));
    } catch (err) {
      log('expansion: hook error: ' + err.message);
    }
  }

  /** Try the typed characters first, then the same keys read as a US layout. */
  function findTrigger(ctx) {
    const byChars = matcher.match(buffer.actualText(), ctx);
    if (byChars) return { ...byChars, ...buffer.tail('actual', byChars.trigger.length) };
    const usText = buffer.usText();
    if (usText !== buffer.actualText()) {
      const byKeys = matcher.match(usText, ctx);
      if (byKeys) return { ...byKeys, ...buffer.tail('us', byKeys.trigger.length) };
    }
    return null;
  }

  async function expand(m, ctx) {
    busy = true;
    try {
      const settings = getSettings();
      const sn = m.snippet;
      const body = arabic.isArabicLayout(ctx.hkl) && sn.bodyAr ? sn.bodyAr : sn.bodyEn;
      const fields = placeholders.collectFields(body);
      let values = {};
      if (fields.length) {
        values = await requestForm({ fields, snippetName: sn.name });
        if (!values) { buffer.clear(); return; } // cancelled: leave the trigger as typed
        win32.setForegroundWindow(ctx.hwnd);
        await sleep(120);
      }
      const { text, cursorFromEnd } = placeholders.render(body, { clipboard: safeReadText(), lang: settings.lang }, values);
      busy = false; // the injector keeps its own busy flag while typing
      ignoreUntil = Date.now() + 60000; // ignore our own injected keys until typing is done
      await injector.typeText(text, { backspaces: m.backspaces, cursorFromEnd, targetHwnd: ctx.hwnd, viaClipboard: text.length > 500 });
      ignoreUntil = Date.now() + 200;
      buffer.clear();
      lastExpansion = { at: Date.now(), onScreen: m.onScreen, textLength: text.length, cursorFromEnd };
      store.bumpSnippet(sn.id);
      log(`expansion: ${m.trigger} → ${sn.name} in ${ctx.app || 'unknown app'}`);
      if (deps.onExpanded) deps.onExpanded(sn);
    } finally {
      busy = false;
    }
  }

  /** The user pressed Backspace right after an expansion: remove the body and put the trigger back. */
  async function undoLast() {
    const u = lastExpansion;
    lastExpansion = null;
    if (!u || u.cursorFromEnd > 0) return; // caret moved inside the text: leave it alone
    busy = true;
    ignoreUntil = Date.now() + 60000;
    try {
      await sleep(15);
      win32.sendBackspaces(Math.max(0, u.textLength - 1)); // the user's own Backspace removed one character already
      await sleep(15);
      win32.sendUnicodeText(u.onScreen);
      buffer.clear();
      log('expansion: undone');
    } finally {
      ignoreUntil = Date.now() + 200;
      busy = false;
    }
  }

  function safeReadText() {
    try { return clipboard.readText(); } catch { return ''; }
  }

  function start() {
    if (!uio || running || !win32.available) return running;
    rebuild();
    uio.uIOhook.on('keydown', onKeydown);
    uio.uIOhook.on('mousedown', () => { buffer.clear(); lastExpansion = null; });
    uio.uIOhook.start();
    running = true;
    log('expansion: keyboard hook started');
    return true;
  }

  function stop() {
    if (!uio || !running) return;
    try { uio.uIOhook.stop(); } catch (err) { log('expansion: stop failed: ' + err.message); }
    running = false;
  }

  return { start, stop, rebuild, isRunning: () => running, available: !!uio && win32.available };
}

module.exports = { createExpansion, createKeyBuffer };
