'use strict';
// Local JSON store for history, snippets, notes and settings.
// Files live in the app's userData folder; writes are debounced and atomic.
// Pure Node (no Electron) so it can be unit-tested: see test/store.test.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeForSearch, tokenize, matchesAllTokens } = require('./arabic');

const DEFAULT_SETTINGS = Object.freeze({
  lang: 'en',
  theme: 'system',
  hotkeys: {
    panel: 'Control+Shift+V',
    pastePlain: 'Control+Alt+V',
    capture: 'Control+Shift+N',
    pause: 'Control+Alt+P',
    library: 'Control+Shift+L',
  },
  capture: {
    text: true,
    images: true,
    files: true,
    maxTextKB: 1024,
    maxImageMB: 20,
    retentionDays: 90,
    maxItems: 10000,
    skipCardNumbers: true,
    excludedApps: ['keepass.exe', 'keepassxc.exe', '1password.exe', 'bitwarden.exe', 'lastpass.exe', 'dashlane.exe', 'enpass.exe', 'nordpass.exe'],
  },
  expansion: {
    enabled: true,
    wordBoundary: true,
    matchCase: false,
    sound: false,
    excludedApps: ['mstsc.exe', 'windowsterminal.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'vmware.exe', 'vmconnect.exe'],
  },
  paste: { restoreClipboard: true, restoreClipboardAfterMs: 300 },
  privacy: { encrypt: false, paused: false },
  startup: true,
});

const FILES = { history: 'history.json', snippets: 'snippets.json', notes: 'notes.json', settings: 'settings.json' };

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

/** Deep merge: objects merge, arrays and scalars in `patch` replace. */
function deepMerge(base, patch) {
  const out = isPlainObject(base) ? { ...base } : {};
  if (!isPlainObject(patch)) return out;
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : (Array.isArray(v) ? v.slice() : v);
  }
  return out;
}

function hashOf(parts) {
  return crypto.createHash('sha1').update(parts.join('\u0001')).digest('hex');
}

function firstLine(text, max = 120) {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

/**
 * @param {Object} opts { dir, codec?: {encode(buf)→buf, decode(buf)→buf}, log?, onDeleteImage?(path) }
 */
function createStore(opts) {
  const dir = opts.dir;
  const log = opts.log || (() => {});
  let codec = opts.codec || null;
  const onDeleteImage = opts.onDeleteImage || ((p) => { try { fs.unlinkSync(p); } catch { /* ignore */ } });
  const data = { history: [], snippets: [], notes: [], settings: deepMerge(DEFAULT_SETTINGS, {}) };
  const timers = {};

  fs.mkdirSync(dir, { recursive: true });

  function filePath(key) { return path.join(dir, FILES[key]); }

  function readJson(key) {
    try {
      let raw = fs.readFileSync(filePath(key));
      if (codec) raw = codec.decode(raw);
      return JSON.parse(raw.toString('utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') log('store: cannot read ' + key + ': ' + err.message);
      return null;
    }
  }

  function writeJson(key) {
    let raw = Buffer.from(JSON.stringify(data[key]), 'utf8');
    if (codec) raw = codec.encode(raw);
    const target = filePath(key);
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, raw);
    fs.renameSync(tmp, target);
  }

  function scheduleSave(key) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => { try { writeJson(key); } catch (err) { log('store: save failed: ' + err.message); } }, 400);
  }

  function flush() {
    for (const key of Object.keys(FILES)) {
      if (timers[key]) { clearTimeout(timers[key]); timers[key] = null; }
      try { writeJson(key); } catch (err) { log('store: flush failed: ' + err.message); }
    }
  }

  function load() {
    const h = readJson('history'); if (Array.isArray(h)) data.history = h;
    const s = readJson('snippets'); if (Array.isArray(s)) data.snippets = s;
    const n = readJson('notes'); if (Array.isArray(n)) data.notes = n;
    const st = readJson('settings'); if (isPlainObject(st)) data.settings = deepMerge(DEFAULT_SETTINGS, st);
    for (const item of data.history) if (!item.norm) item.norm = normalizeForSearch(item.text || item.files?.join(' ') || '');
    for (const sn of data.snippets) sn.norm = snippetNorm(sn);
    if (!data.snippets.length) seedSnippets();
    purge();
  }

  // ----------------------------------------------------------------- history

  function toPublic(item) {
    return {
      id: item.id,
      kind: item.kind,
      text: item.kind === 'image' ? '' : (item.text || (item.files || []).join('\n')),
      preview: item.kind === 'image' ? '' : firstLine(item.text || (item.files || []).join(', ')),
      sourceApp: item.sourceApp || '',
      createdAt: item.createdAt,
      pinned: !!item.pinned,
      imageDataUrl: item.kind === 'image' ? item.thumb || '' : undefined,
      files: item.kind === 'files' ? item.files : undefined,
    };
  }

  function snippetToPublic(sn, lang) {
    const body = lang === 'ar' && sn.bodyAr ? sn.bodyAr : sn.bodyEn;
    return {
      id: sn.id, kind: 'snippet', text: body || '', preview: sn.name || firstLine(body),
      sourceApp: '', createdAt: sn.updatedAt || 0, pinned: false,
      name: sn.name, trigger: sn.trigger, folder: sn.folder || '',
    };
  }

  /** Add a captured item. Returns the stored item, or null when it was deduplicated into an existing one. */
  function addHistoryItem(input) {
    const kind = input.kind || 'text';
    const hash = input.hash || hashOf([kind, input.text || '', input.imagePath || '', (input.files || []).join('|')]);
    const existing = data.history.find((i) => i.hash === hash);
    const now = Date.now();
    if (existing) {
      existing.createdAt = now;
      existing.lastUsedAt = now;
      if (input.sourceApp) existing.sourceApp = input.sourceApp;
      data.history.splice(data.history.indexOf(existing), 1);
      data.history.unshift(existing);
      scheduleSave('history');
      return existing;
    }
    const item = {
      id: crypto.randomUUID(),
      kind,
      text: kind === 'image' ? '' : (input.text || ''),
      html: input.html || undefined,
      imagePath: input.imagePath || undefined,
      thumb: input.thumb || undefined,
      files: kind === 'files' ? input.files || [] : undefined,
      hash,
      sourceApp: input.sourceApp || '',
      sourceProcess: input.sourceProcess || '',
      size: input.size || 0,
      createdAt: now,
      lastUsedAt: now,
      pinned: false,
      norm: normalizeForSearch(kind === 'files' ? (input.files || []).join(' ') : input.text || ''),
    };
    data.history.unshift(item);
    enforceLimits();
    scheduleSave('history');
    return item;
  }

  function enforceLimits() {
    const max = Math.max(50, Number(data.settings.capture.maxItems) || 10000);
    if (data.history.length <= max) return;
    for (let i = data.history.length - 1; i >= 0 && data.history.length > max; i--) {
      if (!data.history[i].pinned) dropItem(i);
    }
  }

  function dropItem(index) {
    const [item] = data.history.splice(index, 1);
    if (item && item.imagePath) onDeleteImage(item.imagePath);
  }

  /** Remove unpinned items older than the retention window. Returns the number removed. */
  function purge(olderThanDays) {
    const days = olderThanDays === undefined ? Number(data.settings.capture.retentionDays) : Number(olderThanDays);
    if (!(days >= 0)) return 0;
    const cutoff = Date.now() - days * 86400000;
    let removed = 0;
    for (let i = data.history.length - 1; i >= 0; i--) {
      const it = data.history[i];
      if (!it.pinned && it.createdAt < cutoff) { dropItem(i); removed++; }
    }
    if (removed) scheduleSave('history');
    return removed;
  }

  function getItem(id) { return data.history.find((i) => i.id === id) || null; }

  function pin(id, pinned) {
    const it = getItem(id);
    if (!it) return false;
    it.pinned = !!pinned;
    scheduleSave('history');
    return true;
  }

  function remove(id) {
    const idx = data.history.findIndex((i) => i.id === id);
    if (idx >= 0) { dropItem(idx); scheduleSave('history'); return true; }
    const n = data.notes.findIndex((i) => i.id === id);
    if (n >= 0) { data.notes.splice(n, 1); scheduleSave('notes'); return true; }
    return false;
  }

  function touch(id) {
    const it = getItem(id);
    if (it) { it.lastUsedAt = Date.now(); scheduleSave('history'); }
  }

  function filterHistory(items, query, filter) {
    const tokens = tokenize(query || '');
    return items.filter((it) => {
      if (filter === 'pinned' && !it.pinned) return false;
      if ((filter === 'text' || filter === 'image' || filter === 'files') && it.kind !== filter) return false;
      return tokens.length ? matchesAllTokens(it.norm || '', tokens) : true;
    });
  }

  /** Panel search: tab = 'history' | 'pinned' | 'snippets'. */
  function search({ query = '', tab = 'history', limit = 50 } = {}) {
    if (tab === 'snippets') {
      const tokens = tokenize(query);
      const lang = data.settings.lang;
      return data.snippets
        .filter((sn) => (tokens.length ? matchesAllTokens(sn.norm || '', tokens) : true))
        .sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || String(a.name).localeCompare(String(b.name)))
        .slice(0, limit)
        .map((sn) => snippetToPublic(sn, lang));
    }
    const items = filterHistory(data.history, query, tab === 'pinned' ? 'pinned' : 'all');
    const sorted = tab === 'history'
      ? items.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
      : items;
    return sorted.slice(0, limit).map(toPublic);
  }

  function getHistory({ query = '', filter = 'all', limit = 200, offset = 0 } = {}) {
    return filterHistory(data.history, query, filter).slice(offset, offset + limit).map(toPublic);
  }

  function clearHistory({ olderThanDays = 0 } = {}) {
    return purge(olderThanDays);
  }

  // ---------------------------------------------------------------- snippets

  function snippetNorm(sn) {
    return normalizeForSearch([sn.name, sn.trigger, sn.folder, sn.bodyEn, sn.bodyAr].filter(Boolean).join(' '));
  }

  function getSnippets() {
    return data.snippets.map((sn) => ({ ...sn, norm: undefined }));
  }

  function getSnippet(id) { return data.snippets.find((s) => s.id === id) || null; }

  function saveSnippet(input) {
    const trigger = String(input.trigger || '').trim();
    const clash = trigger && data.snippets.find((s) => s.id !== input.id && s.trigger && s.trigger.toLowerCase() === trigger.toLowerCase());
    if (clash) { const err = new Error('trigger-taken'); err.code = 'trigger-taken'; throw err; }
    let sn = input.id ? getSnippet(input.id) : null;
    if (!sn) {
      sn = { id: crypto.randomUUID(), useCount: 0 };
      data.snippets.push(sn);
    }
    Object.assign(sn, {
      name: String(input.name || '').trim() || trigger || 'Snippet',
      trigger,
      folder: String(input.folder || '').trim(),
      bodyEn: String(input.bodyEn || ''),
      bodyAr: String(input.bodyAr || ''),
      appsAllow: Array.isArray(input.appsAllow) ? input.appsAllow.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : [],
      appsDeny: Array.isArray(input.appsDeny) ? input.appsDeny.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : [],
      useCount: Number(input.useCount ?? sn.useCount ?? 0) || 0,
      updatedAt: Date.now(),
    });
    sn.norm = snippetNorm(sn);
    scheduleSave('snippets');
    return { ...sn, norm: undefined };
  }

  function deleteSnippet(id) {
    const idx = data.snippets.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    data.snippets.splice(idx, 1);
    scheduleSave('snippets');
    return true;
  }

  function bumpSnippet(id) {
    const sn = getSnippet(id);
    if (sn) { sn.useCount = (sn.useCount || 0) + 1; scheduleSave('snippets'); }
  }

  function seedSnippets() {
    const seeds = [
      { name: 'Signature', trigger: ';sig', folder: 'Email', bodyEn: 'Best regards,\n{{field:Your name}}', bodyAr: 'مع أطيب التحيات،\n{{field:اسمك}}' },
      { name: 'Thanks, will reply', trigger: ';thx', folder: 'Email', bodyEn: 'Thank you for your message. I will get back to you within one business day.', bodyAr: 'شكراً لتواصلكم، سنرد عليكم خلال يوم عمل واحد.' },
      { name: 'Today', trigger: ';today', folder: 'Dates', bodyEn: '{{date:dd/mm/yyyy}}', bodyAr: '{{date:dd/mm/yyyy}}' },
      { name: 'Now', trigger: ';now', folder: 'Dates', bodyEn: '{{date:dd/mm/yyyy}} {{time}}', bodyAr: '{{date:dd/mm/yyyy}} {{time}}' },
      { name: 'Meeting invite', trigger: ';meet', folder: 'Email', bodyEn: 'Dear {{field:Name}},\n\nCould we meet on {{field:Day}} at {{field:Time}}? {{cursor}}\n\nBest regards', bodyAr: 'عزيزي {{field:الاسم}}،\n\nهل يمكننا الاجتماع يوم {{field:اليوم}} الساعة {{field:الوقت}}؟ {{cursor}}\n\nمع التحية' },
    ];
    for (const s of seeds) saveSnippet({ ...s, appsAllow: [], appsDeny: [] });
  }

  // ------------------------------------------------------------------- notes

  function addNote(text) {
    const note = { id: crypto.randomUUID(), text: String(text || '').trim(), createdAt: Date.now() };
    if (!note.text) return null;
    data.notes.unshift(note);
    scheduleSave('notes');
    return note;
  }

  function getNotes() { return data.notes.slice(); }

  // ---------------------------------------------------------------- settings

  function getSettings() { return deepMerge(DEFAULT_SETTINGS, data.settings); }

  function saveSettings(partial) {
    data.settings = deepMerge(data.settings, partial || {});
    scheduleSave('settings');
    return getSettings();
  }

  function setCodec(next) {
    codec = next;
    flush();
  }

  // ----------------------------------------------------------- export/import

  function exportData() {
    return {
      app: 'lasq', version: 1, exportedAt: new Date().toISOString(),
      history: data.history.filter((i) => i.kind !== 'image').map(({ norm, ...rest }) => rest),
      snippets: data.snippets.map(({ norm, ...rest }) => rest),
      notes: data.notes,
      settings: data.settings,
    };
  }

  function importData(obj, { replaceSettings = false } = {}) {
    if (!obj || obj.app !== 'lasq') throw new Error('not-a-lasq-backup');
    const counts = { history: 0, snippets: 0, notes: 0 };
    for (const it of obj.history || []) {
      if (!it || it.kind === 'image' || !it.hash) continue;
      if (data.history.some((h) => h.hash === it.hash)) continue;
      data.history.push({ ...it, id: it.id || crypto.randomUUID(), norm: normalizeForSearch(it.text || (it.files || []).join(' ')) });
      counts.history++;
    }
    data.history.sort((a, b) => b.createdAt - a.createdAt);
    for (const sn of obj.snippets || []) {
      if (!sn || !sn.trigger) continue;
      const existing = data.snippets.find((s) => s.trigger.toLowerCase() === String(sn.trigger).toLowerCase());
      try { saveSnippet({ ...sn, id: existing ? existing.id : null }); counts.snippets++; } catch { /* skip clashes */ }
    }
    for (const n of obj.notes || []) {
      if (n && n.text && !data.notes.some((x) => x.id === n.id)) { data.notes.push(n); counts.notes++; }
    }
    if (replaceSettings && isPlainObject(obj.settings)) data.settings = deepMerge(DEFAULT_SETTINGS, obj.settings);
    scheduleSave('history'); scheduleSave('snippets'); scheduleSave('notes'); scheduleSave('settings');
    return counts;
  }

  return {
    load, flush, setCodec,
    addHistoryItem, getItem, pin, remove, touch, search, getHistory, clearHistory, purge, toPublic,
    getSnippets, getSnippet, saveSnippet, deleteSnippet, bumpSnippet, snippetToPublic,
    addNote, getNotes,
    getSettings, saveSettings,
    exportData, importData,
    get data() { return data; },
    dir,
  };
}

module.exports = { createStore, DEFAULT_SETTINGS, deepMerge, hashOf, firstLine };
