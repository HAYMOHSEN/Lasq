'use strict';
// Puts text into other programs: either through the clipboard + Ctrl+V (paste panel, long
// or formatted bodies) or as Unicode key events (text expansion). Electron's `clipboard`
// and `nativeImage` are injected so this module stays testable.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Object} deps { win32, clipboard, nativeImage, log, suppressCapture(ms) }
 */
function createInjector(deps) {
  const { win32, clipboard, nativeImage } = deps;
  const log = deps.log || (() => {});
  const suppressCapture = deps.suppressCapture || (() => {});
  let busy = false;

  /** Wait (up to timeoutMs) until the user has released Shift/Ctrl/Alt/Win. */
  async function waitForModifiersReleased(timeoutMs = 700) {
    const started = Date.now();
    while (win32.available && win32.modifiersDown()) {
      if (Date.now() - started > timeoutMs) break;
      await sleep(15);
    }
  }

  function snapshotClipboard() {
    try {
      const formats = clipboard.availableFormats();
      const img = clipboard.readImage();
      return {
        text: clipboard.readText(),
        html: formats.includes('text/html') ? clipboard.readHTML() : '',
        image: img && !img.isEmpty() ? img : null,
      };
    } catch (err) {
      log('inject: snapshot failed: ' + err.message);
      return null;
    }
  }

  function restoreClipboard(snap) {
    if (!snap) return;
    try {
      if (snap.image) clipboard.writeImage(snap.image);
      else if (snap.html) clipboard.write({ text: snap.text, html: snap.html });
      else clipboard.writeText(snap.text || '');
    } catch (err) {
      log('inject: restore failed: ' + err.message);
    }
  }

  function writeItemToClipboard(payload) {
    if (payload.imagePath) {
      const img = nativeImage.createFromPath(payload.imagePath);
      if (!img.isEmpty()) { clipboard.writeImage(img); return true; }
      return false;
    }
    if (payload.html && !payload.plain) clipboard.write({ text: payload.text || '', html: payload.html });
    else clipboard.writeText(payload.text || '');
    return true;
  }

  /**
   * Paste a payload into `targetHwnd` via the clipboard.
   * payload: { text, html?, imagePath?, plain? }  options: { restore, restoreAfterMs }
   */
  async function pasteViaClipboard(payload, targetHwnd, options = {}) {
    if (busy) return false;
    busy = true;
    try {
      const snap = options.restore ? snapshotClipboard() : null;
      suppressCapture(Math.max(1500, (options.restoreAfterMs || 300) + 800));
      if (!writeItemToClipboard(payload)) return false;
      if (targetHwnd && win32.available) win32.setForegroundWindow(targetHwnd);
      await waitForModifiersReleased();
      await sleep(60);
      if (win32.available) win32.sendCtrlV();
      else log('inject: no Win32 layer, item left on the clipboard');
      if (snap) {
        await sleep(options.restoreAfterMs || 300);
        restoreClipboard(snap);
      }
      return true;
    } finally {
      busy = false;
    }
  }

  /**
   * Replace `backspaces` characters before the caret with `text` by typing it.
   * Falls back to the clipboard route for long texts. Moves the caret back by cursorFromEnd.
   */
  async function typeText(text, { backspaces = 0, cursorFromEnd = 0, viaClipboard = false, targetHwnd = null } = {}) {
    if (busy || !win32.available) return false;
    busy = true;
    try {
      await waitForModifiersReleased();
      if (backspaces > 0) {
        win32.sendBackspaces(backspaces);
        await sleep(25);
      }
      if (viaClipboard || text.length > 500) {
        busy = false; // pasteViaClipboard manages the flag itself
        await pasteViaClipboard({ text, plain: true }, targetHwnd, { restore: true, restoreAfterMs: 300 });
        busy = true;
      } else {
        // Type in chunks so very fast bursts do not overwhelm slow apps.
        for (let i = 0; i < text.length; i += 50) {
          win32.sendUnicodeText(text.slice(i, i + 50));
          if (i + 50 < text.length) await sleep(5);
        }
      }
      if (cursorFromEnd > 0) {
        await sleep(20);
        for (let i = 0; i < cursorFromEnd; i++) win32.sendVk(win32.VK.LEFT);
      }
      return true;
    } finally {
      busy = false;
    }
  }

  return { pasteViaClipboard, typeText, waitForModifiersReleased, isBusy: () => busy, sleep };
}

module.exports = { createInjector, sleep };
