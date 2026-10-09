'use strict';
// Clipboard watcher: turns clipboard changes into history items.
// Event-driven through WM_CLIPBOARDUPDATE when a BrowserWindow is available for
// `hookWindowMessage`; otherwise polls. Electron modules are injected.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_NAMES = {
  'chrome.exe': 'Chrome', 'msedge.exe': 'Edge', 'firefox.exe': 'Firefox', 'brave.exe': 'Brave', 'opera.exe': 'Opera',
  'winword.exe': 'Word', 'excel.exe': 'Excel', 'powerpnt.exe': 'PowerPoint', 'outlook.exe': 'Outlook', 'olk.exe': 'Outlook',
  'onenote.exe': 'OneNote', 'ms-teams.exe': 'Teams', 'teams.exe': 'Teams', 'notepad.exe': 'Notepad', 'code.exe': 'VS Code',
  'explorer.exe': 'Explorer', 'whatsapp.exe': 'WhatsApp', 'telegram.exe': 'Telegram', 'snippingtool.exe': 'Snipping Tool',
  'acrord32.exe': 'Acrobat', 'acrobat.exe': 'Acrobat', 'windowsterminal.exe': 'Terminal', 'powershell.exe': 'PowerShell',
  'applicationframehost.exe': 'App', 'lasq.exe': 'Lasq', 'electron.exe': 'Lasq',
};

function displayName(processName) {
  if (!processName) return '';
  if (APP_NAMES[processName]) return APP_NAMES[processName];
  const base = processName.replace(/\.exe$/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Luhn check on 13–19 digit sequences (spaces/dashes allowed) → looks like a payment card. */
function looksLikeCardNumber(text) {
  const m = String(text).match(/(?:\d[ -]?){13,19}/g);
  if (!m) return false;
  return m.some((seq) => {
    const digits = seq.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  });
}

/**
 * @param {Object} deps { clipboard, nativeImage, win32, store, getSettings, mediaDir, log, onCaptured, listenerWindow }
 */
function createCapture(deps) {
  const { clipboard, win32, store, getSettings, mediaDir } = deps;
  const log = deps.log || (() => {});
  const onCaptured = deps.onCaptured || (() => {});
  let listenerWindow = deps.listenerWindow || null;
  let suppressUntil = 0;
  let readTimer = null;
  let pollTimer = null;
  let lastSignature = '';
  let hooked = false;

  fs.mkdirSync(mediaDir, { recursive: true });

  function suppress(ms) { suppressUntil = Date.now() + ms; }

  function signature() {
    try {
      const formats = clipboard.availableFormats();
      const text = clipboard.readText();
      return formats.join(',') + '|' + text.length + '|' + text.slice(0, 64) + '|' + text.slice(-64);
    } catch { return ''; }
  }

  function start() {
    if (listenerWindow && win32.available && typeof listenerWindow.hookWindowMessage === 'function') {
      try {
        const handle = listenerWindow.getNativeWindowHandle();
        const hwnd = process.arch === 'ia32' ? BigInt(handle.readUInt32LE(0)) : handle.readBigUInt64LE(0);
        if (win32.addClipboardFormatListener(hwnd)) {
          listenerWindow.hookWindowMessage(win32.WM_CLIPBOARDUPDATE, () => scheduleRead());
          hooked = true;
          log('capture: listening through WM_CLIPBOARDUPDATE');
        }
      } catch (err) {
        log('capture: listener setup failed, polling instead: ' + err.message);
      }
    }
    if (!hooked) {
      lastSignature = signature();
      pollTimer = setInterval(() => {
        const sig = signature();
        if (sig !== lastSignature) { lastSignature = sig; scheduleRead(); }
      }, 350);
      log('capture: polling every 350 ms');
    }
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    if (readTimer) clearTimeout(readTimer);
  }

  function scheduleRead() {
    if (readTimer) clearTimeout(readTimer);
    readTimer = setTimeout(() => { readTimer = null; readClipboard(); }, 40);
  }

  function readClipboard() {
    try {
      const settings = getSettings();
      if (settings.privacy.paused) return;
      if (Date.now() < suppressUntil) return;
      if (win32.available) {
        if (win32.isClipboardFormatAvailable('ExcludeClipboardContentFromMonitorProcessing') ||
            win32.isClipboardFormatAvailable('CanIncludeInClipboardHistory')) {
          log('capture: skipped (privacy flag)');
          return;
        }
      }
      const processName = win32.available ? (win32.getClipboardOwnerProcessName() || win32.getForegroundProcessName()) : '';
      if (processName && (settings.capture.excludedApps || []).map((s) => s.toLowerCase()).includes(processName)) {
        log('capture: skipped (excluded app ' + processName + ')');
        return;
      }
      const sourceApp = displayName(processName);
      const formats = clipboard.availableFormats();

      if (settings.capture.files && win32.available) {
        const files = win32.readClipboardFileList();
        if (files.length) {
          const item = store.addHistoryItem({ kind: 'files', files, sourceApp, sourceProcess: processName, size: files.length });
          onCaptured(item);
          return;
        }
      }

      if (settings.capture.images && formats.some((f) => f.startsWith('image/'))) {
        const img = clipboard.readImage();
        if (img && !img.isEmpty()) {
          const png = img.toPNG();
          if (png.length > settings.capture.maxImageMB * 1024 * 1024) { log('capture: image too large'); return; }
          const hash = crypto.createHash('sha1').update(png).digest('hex');
          const imagePath = path.join(mediaDir, hash + '.png');
          if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, png);
          const size = img.getSize();
          const scale = Math.min(1, 320 / Math.max(size.width, 1), 200 / Math.max(size.height, 1));
          const thumb = (scale < 1 ? img.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) }) : img).toDataURL();
          const item = store.addHistoryItem({ kind: 'image', imagePath, thumb, hash: 'img:' + hash, sourceApp, sourceProcess: processName, size: png.length, text: '' });
          onCaptured(item);
          return;
        }
      }

      if (!settings.capture.text) return;
      const text = clipboard.readText();
      if (!text || !text.trim()) return;
      if (Buffer.byteLength(text, 'utf8') > settings.capture.maxTextKB * 1024) { log('capture: text too large'); return; }
      if (settings.capture.skipCardNumbers !== false && looksLikeCardNumber(text)) { log('capture: skipped (card number)'); return; }
      let html = formats.includes('text/html') ? clipboard.readHTML() : '';
      if (html && html.length > text.length * 20 + 4000) html = ''; // bloated markup is not worth keeping
      const item = store.addHistoryItem({ kind: 'text', text, html: html || undefined, sourceApp, sourceProcess: processName, size: text.length });
      onCaptured(item);
    } catch (err) {
      log('capture: read failed: ' + err.message);
    }
  }

  return { start, stop, suppress, readClipboard, isHooked: () => hooked };
}

module.exports = { createCapture, looksLikeCardNumber, displayName, APP_NAMES };
