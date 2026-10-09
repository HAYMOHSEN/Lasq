'use strict';
// Lasq main process: tray app that owns the clipboard watcher, the keyboard hook,
// the paste panel and the library window, and answers the renderer over IPC.

const path = require('path');
const fs = require('fs');
const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, screen, dialog, shell, safeStorage,
} = require('electron');

const { createStore } = require('./store');
const { createCapture } = require('./capture');
const { createInjector, sleep } = require('./inject');
const { createExpansion } = require('./expansion');
const transforms = require('./transforms');
const placeholders = require('./placeholders');
const win32 = require('./win32');

const PANEL_SIZE = { width: 640, height: 420 };
const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const ASSETS = path.join(__dirname, '..', '..', 'assets');

// ------------------------------------------------------------------ logging

let logFile = null;
function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  if (logFile) {
    try {
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, logFile + '.1');
      fs.appendFileSync(logFile, msg + '\n');
    } catch { /* ignore */ }
  }
}

// ------------------------------------------------------------------- state

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showLibrary());
  app.whenReady().then(boot).catch((err) => { log('boot failed: ' + (err.stack || err.message)); app.quit(); });
}

let store;
let capture;
let injector;
let expansion;
let tray;
let panelWin = null;
let libraryWin = null;
let quitting = false;
let targetHwnd = null;          // window to paste into, remembered before the panel is shown
let keepPanelOpen = false;      // true during a multi-paste round trip
let pendingForm = null;         // { resolve } while the fill-in form is open
let panelMode = 'paste';

function dataDir() { return path.join(app.getPath('userData'), 'data'); }
function mediaDir() { return path.join(dataDir(), 'media'); }
function encryptionFlag() { return path.join(dataDir(), 'encrypted.flag'); }

function makeCodec() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  return {
    encode: (buf) => safeStorage.encryptString(buf.toString('utf8')),
    decode: (buf) => Buffer.from(safeStorage.decryptString(buf), 'utf8'),
  };
}

async function boot() {
  fs.mkdirSync(dataDir(), { recursive: true });
  logFile = path.join(app.getPath('userData'), 'lasq.log');
  log(`Lasq ${app.getVersion()} starting on ${process.platform} ${process.arch}, Electron ${process.versions.electron}`);

  const encrypted = fs.existsSync(encryptionFlag());
  store = createStore({ dir: dataDir(), codec: encrypted ? makeCodec() : null, log });
  store.load();
  const firstRun = !fs.existsSync(path.join(dataDir(), 'settings.json'));

  injector = createInjector({ win32, clipboard, nativeImage, log, suppressCapture: (ms) => capture && capture.suppress(ms) });

  createPanelWindow();
  createLibraryWindow();

  capture = createCapture({
    clipboard, win32, store, mediaDir: mediaDir(), log,
    getSettings: () => store.getSettings(),
    listenerWindow: panelWin,
    onCaptured: () => broadcast('data:changed', { what: 'history' }),
  });
  capture.start();

  expansion = createExpansion({
    win32, store, injector, clipboard, log,
    getSettings: () => store.getSettings(),
    requestForm: (req) => showForm(req),
    onExpanded: () => { if (store.getSettings().expansion.sound) shell.beep(); },
  });
  if (!expansion.start()) log('expansion: not started (hook unavailable on this platform)');

  createTray();
  registerHotkeys();
  applyStartupSetting();
  setInterval(() => { const n = store.purge(); if (n) { log(`purged ${n} old items`); broadcast('data:changed', { what: 'history' }); } }, 6 * 3600 * 1000);

  if (firstRun) showLibrary('settings');
  log('ready');
}

// ----------------------------------------------------------------- windows

function createPanelWindow() {
  panelWin = new BrowserWindow({
    width: PANEL_SIZE.width, height: PANEL_SIZE.height,
    show: false, frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: true, title: 'Lasq',
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  panelWin.setMenuBarVisibility(false);
  panelWin.loadFile(path.join(RENDERER, 'panel.html'));
  panelWin.on('blur', () => { if (!keepPanelOpen) hidePanel(); });
  panelWin.on('close', (e) => { if (!quitting) { e.preventDefault(); hidePanel(); } });
}

function createLibraryWindow() {
  libraryWin = new BrowserWindow({
    width: 1040, height: 700, minWidth: 900, minHeight: 600, show: false, title: 'Lasq — لصق',
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, spellcheck: true },
  });
  libraryWin.setMenuBarVisibility(false);
  libraryWin.loadFile(path.join(RENDERER, 'library.html'));
  libraryWin.on('close', (e) => { if (!quitting) { e.preventDefault(); libraryWin.hide(); } });
  libraryWin.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') libraryWin.webContents.toggleDevTools();
  });
}

function showLibrary(section, snippetDraft) {
  if (!libraryWin || libraryWin.isDestroyed()) createLibraryWindow();
  libraryWin.show();
  libraryWin.focus();
  if (section) libraryWin.webContents.send('library:section', { section, snippetDraft });
}

function broadcast(channel, payload) {
  for (const w of [panelWin, libraryWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

/** Where to show the panel: just under the text caret, else at the mouse, clamped to the work area. */
function panelPosition() {
  let point = null;
  const caret = win32.getCaretScreenPos();
  if (caret && typeof screen.screenToDipPoint === 'function') {
    const dip = screen.screenToDipPoint({ x: caret.x, y: caret.y });
    point = { x: dip.x, y: dip.y + 6 };
  }
  if (!point) {
    const c = screen.getCursorScreenPoint();
    point = { x: c.x, y: c.y + 12 };
  }
  const wa = screen.getDisplayNearestPoint(point).workArea;
  let x = Math.min(Math.max(point.x, wa.x), wa.x + wa.width - PANEL_SIZE.width);
  let y = point.y;
  if (y + PANEL_SIZE.height > wa.y + wa.height) y = Math.max(wa.y, point.y - PANEL_SIZE.height - 30);
  return { x: Math.round(x), y: Math.round(y) };
}

function showPanel(mode = 'paste', extra = {}) {
  if (!panelWin || panelWin.isDestroyed()) createPanelWindow();
  if (!panelWin.isVisible()) targetHwnd = win32.getForegroundWindow();
  panelMode = mode;
  const pos = panelPosition();
  panelWin.setPosition(pos.x, pos.y, false);
  panelWin.show();
  panelWin.focus();
  panelWin.webContents.send('panel:mode', { mode, ...extra });
}

function hidePanel() {
  if (pendingForm) { const p = pendingForm; pendingForm = null; p.resolve(null); }
  panelMode = 'paste';
  if (panelWin && !panelWin.isDestroyed() && panelWin.isVisible()) panelWin.hide();
}

function togglePanel() {
  if (panelWin && panelWin.isVisible() && panelMode === 'paste') hidePanel();
  else showPanel('paste');
}

/** Show the fill-in form for a snippet; resolves with the values or null when cancelled. */
function showForm({ fields, snippetName }) {
  if (pendingForm) pendingForm.resolve(null);
  return new Promise((resolve) => {
    pendingForm = { resolve };
    showPanel('form', { fields, snippetName });
  });
}

// ------------------------------------------------------------------ pasting

function pickSnippetBody(sn) {
  const lang = store.getSettings().lang;
  return lang === 'ar' && sn.bodyAr ? sn.bodyAr : sn.bodyEn;
}

async function pasteItem({ id, mode = 'normal', transform }) {
  const settings = store.getSettings();
  const item = store.getItem(id);
  const snippet = item ? null : store.getSnippet(id);
  if (!item && !snippet) return;

  let payload;
  let cursorFromEnd = 0;
  if (snippet) {
    const body = pickSnippetBody(snippet);
    const fields = placeholders.collectFields(body);
    let values = {};
    if (fields.length) {
      values = await showForm({ fields, snippetName: snippet.name });
      if (!values) return;
    }
    const rendered = placeholders.render(body, { clipboard: clipboard.readText(), lang: settings.lang }, values);
    cursorFromEnd = rendered.cursorFromEnd;
    payload = { text: rendered.text, plain: true };
    store.bumpSnippet(snippet.id);
  } else if (item.kind === 'image') {
    payload = { imagePath: item.imagePath };
  } else {
    const text = item.kind === 'files' ? (item.files || []).join('\n') : item.text;
    payload = { text, html: item.html, plain: mode !== 'normal' };
    store.touch(item.id);
  }
  if (mode === 'transform' && transform && payload.text !== undefined) {
    payload.text = transforms.applyTransform(transform, payload.text);
    payload.plain = true;
  }

  const target = targetHwnd;
  if (mode === 'multi') keepPanelOpen = true; else hidePanel();
  try {
    await injector.pasteViaClipboard(payload, target, { restore: settings.paste.restoreClipboard, restoreAfterMs: settings.paste.restoreClipboardAfterMs });
    if (cursorFromEnd > 0 && win32.available) {
      await sleep(80);
      for (let i = 0; i < cursorFromEnd; i++) win32.sendVk(win32.VK.LEFT);
    }
  } finally {
    if (mode === 'multi') {
      await sleep(120);
      keepPanelOpen = false;
      if (panelWin && !panelWin.isDestroyed()) { panelWin.show(); panelWin.focus(); }
    }
  }
  broadcast('data:changed', { what: snippet ? 'snippets' : 'history' });
}

async function pasteLatestPlain() {
  const [latest] = store.search({ tab: 'history', limit: 1 });
  if (!latest || latest.kind === 'image') return;
  const settings = store.getSettings();
  const text = latest.kind === 'files' ? (latest.files || []).join('\n') : latest.text;
  await injector.pasteViaClipboard({ text, plain: true }, win32.getForegroundWindow(), { restore: settings.paste.restoreClipboard, restoreAfterMs: settings.paste.restoreClipboardAfterMs });
}

// ------------------------------------------------------------- hotkeys, tray

const HOTKEY_ACTIONS = {
  panel: () => togglePanel(),
  pastePlain: () => pasteLatestPlain().catch((err) => log('paste plain failed: ' + err.message)),
  capture: () => showPanel('capture', { prefill: clipboard.readText().slice(0, 2000) }),
  pause: () => setPaused(!store.getSettings().privacy.paused),
  library: () => showLibrary(),
};

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const hk = store.getSettings().hotkeys;
  for (const [name, action] of Object.entries(HOTKEY_ACTIONS)) {
    const acc = hk[name];
    if (!acc) continue;
    try {
      if (!globalShortcut.register(acc, action)) log(`hotkey ${name} (${acc}) could not be registered — already in use?`);
    } catch (err) {
      log(`hotkey ${name} (${acc}) invalid: ${err.message}`);
    }
  }
}

function setPaused(paused) {
  store.saveSettings({ privacy: { paused } });
  afterSettingsChange();
}

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(ASSETS, 'icon.png'));
  return img.isEmpty() ? img : img.resize({ width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.on('double-click', () => showLibrary());
  tray.on('click', () => togglePanel());
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const s = store.getSettings();
  const ar = s.lang === 'ar';
  tray.setToolTip(s.privacy.paused ? (ar ? 'لصق — الالتقاط متوقف' : 'Lasq — capture paused') : (ar ? 'لصق — Lasq' : 'Lasq — لصق'));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: ar ? 'لوحة اللصق' : 'Paste panel', accelerator: s.hotkeys.panel, click: () => showPanel('paste') },
    { label: ar ? 'المكتبة' : 'Library', accelerator: s.hotkeys.library, click: () => showLibrary() },
    { type: 'separator' },
    { label: ar ? 'إيقاف الالتقاط مؤقتاً' : 'Pause capture', type: 'checkbox', checked: !!s.privacy.paused, click: (mi) => setPaused(mi.checked) },
    { label: ar ? 'التوسيع النصي' : 'Text expansion', type: 'checkbox', checked: !!s.expansion.enabled, click: (mi) => { store.saveSettings({ expansion: { enabled: mi.checked } }); afterSettingsChange(); } },
    { type: 'separator' },
    { label: ar ? 'خروج' : 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}

function applyStartupSetting() {
  const s = store.getSettings();
  if (process.windowsStore) return; // the Store package declares a startup task; Windows Settings controls it
  try { app.setLoginItemSettings({ openAtLogin: !!s.startup, args: ['--hidden'] }); } catch (err) { log('startup setting failed: ' + err.message); }
}

function applyEncryptionSetting() {
  const want = !!store.getSettings().privacy.encrypt;
  const has = fs.existsSync(encryptionFlag());
  if (want === has) return;
  if (want) {
    const codec = makeCodec();
    if (!codec) { log('encryption not available on this system'); store.saveSettings({ privacy: { encrypt: false } }); return; }
    store.setCodec(codec);
    fs.writeFileSync(encryptionFlag(), 'dpapi');
    log('data files are now encrypted with Windows DPAPI');
  } else {
    store.setCodec(null);
    try { fs.unlinkSync(encryptionFlag()); } catch { /* ignore */ }
    log('data files are now stored in plain JSON');
  }
}

function afterSettingsChange() {
  registerHotkeys();
  refreshTray();
  applyStartupSetting();
  applyEncryptionSetting();
  if (expansion) expansion.rebuild();
  broadcast('settings:changed', store.getSettings());
}

// --------------------------------------------------------------------- IPC

function handle(method, fn) {
  ipcMain.handle('lasq:' + method, async (_event, args) => fn(args || {}));
}

handle('ready', () => {
  const s = store.getSettings();
  return { lang: s.lang, dir: s.lang === 'ar' ? 'rtl' : 'ltr', settings: s, platform: process.platform, version: app.getVersion(), transforms: transforms.listTransforms() };
});
handle('search', (a) => store.search({ query: a.query || '', tab: a.tab || 'history', limit: a.limit || 50 }));
handle('paste', (a) => pasteItem(a).catch((err) => { log('paste failed: ' + err.message); }));
handle('pin', (a) => { store.pin(a.id, !!a.pinned); broadcast('data:changed', { what: 'history' }); });
handle('remove', (a) => { store.remove(a.id); broadcast('data:changed', { what: 'history' }); broadcast('data:changed', { what: 'notes' }); });
handle('quickCapture', (a) => {
  const text = String(a.text || '').trim();
  hidePanel();
  if (!text) return;
  if (a.asSnippet) { showLibrary('snippets', { bodyEn: text, bodyAr: '' }); return; }
  store.addNote(text);
  broadcast('data:changed', { what: 'notes' });
});
handle('listTransforms', () => transforms.listTransforms());
handle('getSnippets', () => store.getSnippets());
handle('saveSnippet', (a) => {
  try {
    const saved = store.saveSnippet(a);
    if (expansion) expansion.rebuild();
    broadcast('data:changed', { what: 'snippets' });
    return saved;
  } catch (err) {
    if (err.code === 'trigger-taken') throw Object.assign(new Error('trigger-taken'), { code: 'trigger-taken' });
    throw err;
  }
});
handle('deleteSnippet', (a) => { store.deleteSnippet(a.id); if (expansion) expansion.rebuild(); broadcast('data:changed', { what: 'snippets' }); });
handle('getHistory', (a) => store.getHistory(a));
handle('clearHistory', (a) => { store.clearHistory(a); broadcast('data:changed', { what: 'history' }); });
handle('getNotes', () => store.getNotes());
handle('getSettings', () => store.getSettings());
handle('saveSettings', (a) => { const s = store.saveSettings(a); afterSettingsChange(); return s; });
handle('exportData', async () => {
  const r = await dialog.showSaveDialog(libraryWin, { defaultPath: `lasq-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Lasq backup', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, JSON.stringify(store.exportData(), null, 2), 'utf8');
  return { ok: true, path: r.filePath };
});
handle('importData', async () => {
  const r = await dialog.showOpenDialog(libraryWin, { properties: ['openFile'], filters: [{ name: 'Lasq backup', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  const obj = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
  const counts = store.importData(obj);
  if (expansion) expansion.rebuild();
  broadcast('data:changed', { what: 'history' }); broadcast('data:changed', { what: 'snippets' }); broadcast('data:changed', { what: 'notes' });
  return { ok: true, counts };
});

ipcMain.on('lasq:hidePanel', () => hidePanel());
ipcMain.on('lasq:openLibrary', (_e, section) => showLibrary(typeof section === 'string' ? section : undefined));
ipcMain.on('lasq:openStartupSettings', () => shell.openExternal('ms-settings:startupapps'));
ipcMain.on('lasq:submitForm', (_e, a) => {
  const p = pendingForm;
  pendingForm = null;
  panelMode = 'paste';
  if (panelWin && !panelWin.isDestroyed()) panelWin.hide();
  if (p) p.resolve((a && a.values) || {});
});
ipcMain.on('lasq:cancelForm', () => hidePanel());

// ---------------------------------------------------------------- lifecycle

app.on('window-all-closed', (e) => { /* tray app: keep running */ });
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (expansion) expansion.stop();
  if (capture) capture.stop();
  if (store) store.flush();
  log('bye');
});
