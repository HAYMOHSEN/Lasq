'use strict';
// Bridge between the HTML windows and the main process. The renderer only ever sees
// `window.lasq`, whose shape is documented in docs/RENDERER-API.md.

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (method) => (args) => ipcRenderer.invoke('lasq:' + method, args);
const send = (method) => (args) => ipcRenderer.send('lasq:' + method, args);

const EVENT_CHANNELS = new Set(['panel:mode', 'data:changed', 'settings:changed', 'library:section']);

const api = {
  ready: invoke('ready'),
  search: invoke('search'),
  paste: invoke('paste'),
  pin: invoke('pin'),
  remove: invoke('remove'),
  hidePanel: send('hidePanel'),
  quickCapture: invoke('quickCapture'),
  submitForm: send('submitForm'),
  cancelForm: send('cancelForm'),
  listTransforms: invoke('listTransforms'),
  getSnippets: invoke('getSnippets'),
  saveSnippet: invoke('saveSnippet'),
  deleteSnippet: invoke('deleteSnippet'),
  getHistory: invoke('getHistory'),
  clearHistory: invoke('clearHistory'),
  getNotes: invoke('getNotes'),
  getSettings: invoke('getSettings'),
  saveSettings: invoke('saveSettings'),
  exportData: invoke('exportData'),
  importData: invoke('importData'),
  openLibrary: send('openLibrary'),
  openStartupSettings: send('openStartupSettings'),
  on(channel, cb) {
    if (!EVENT_CHANNELS.has(channel) || typeof cb !== 'function') return () => {};
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('lasq', api);
