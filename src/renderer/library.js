/* ==========================================================================
   Lasq – library window logic
   Sections: history, pinned, snippets, notes, settings.
   ========================================================================== */
(function () {
  'use strict';

  var lasq = window.lasq;
  var I18n = window.LasqI18n;
  var t = I18n.t;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- State ----------
  var state = {
    section: 'history',
    query: '',
    filter: 'all',          // history filter or snippet folder ('*' = all folders)
    items: [],              // current list (Item[] | Snippet[] | Note[])
    selectedId: null,
    settings: null,
    draft: null,            // snippet being edited (may have id null)
    draftDirty: false,
    bodyTab: 'en',
    loadSeq: 0
  };

  var el = {
    nav: $('nav'),
    langToggle: $('lang-toggle'),
    listSearch: $('list-search'),
    listFilters: $('list-filters'),
    list: $('list'),
    listPane: $('list-pane'),
    detailEmpty: $('detail-empty'),
    detailEmptyText: $('detail-empty-text'),
    detailHistory: $('detail-history'),
    detailSnippet: $('detail-snippet'),
    detailNote: $('detail-note'),
    detailSettings: $('detail-settings'),
    toast: $('toast'),
    // history detail
    hTitle: $('h-title'), hMeta: $('h-meta'), hContent: $('h-content'), hCopy: $('h-copy'), hPin: $('h-pin'), hPinLabel: $('h-pin-label'), hDelete: $('h-delete'),
    // snippet editor
    sTitle: $('s-title'), sName: $('s-name'), sNameError: $('s-name-error'), sTrigger: $('s-trigger'), sTriggerWarning: $('s-trigger-warning'), sTriggerError: $('s-trigger-error'),
    sFolder: $('s-folder'), folderList: $('folder-list'), sBodyEn: $('s-body-en'), sBodyAr: $('s-body-ar'), sBodyEnPanel: $('s-body-en-panel'), sBodyArPanel: $('s-body-ar-panel'),
    sPreview: $('s-preview'), sAllow: $('s-allow'), sDeny: $('s-deny'), sError: $('s-error'), sMeta: $('s-meta'), sTest: $('s-test'), sDelete: $('s-delete'), sSave: $('s-save'),
    placeholderBar: $('placeholder-bar'),
    // note detail
    nTitle: $('n-title'), nMeta: $('n-meta'), nContent: $('n-content'), nCopy: $('n-copy'), nMake: $('n-make'), nDelete: $('n-delete'),
    // settings
    stExport: $('st-export'), stImport: $('st-import'), stClear: $('st-clear'), stClearDays: $('st-clear-days')
  };

  // ---------- Helpers ----------

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function relativeTime(ts) {
    var diff = Math.max(0, Date.now() - ts);
    var m = Math.floor(diff / 60000);
    if (m < 1) return t('time.now');
    if (m < 60) return m + ' ' + t('time.min');
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' ' + t('time.h');
    return Math.floor(h / 24) + ' ' + t('time.d');
  }

  function fullDate(ts) {
    try { return new Date(ts).toLocaleString(I18n.lang === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return new Date(ts).toLocaleString(); }
  }

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svgIcon(id, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + id);
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function firstLine(text) {
    var line = String(text || '').split(/\r?\n/)[0].trim();
    return line.length > 80 ? line.slice(0, 80) + '…' : line;
  }

  function splitList(value) {
    return String(value || '').split(/[,\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  var toastTimer = null;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast(t('action.copied')); })
        .catch(function (err) { console.warn('[lasq] clipboard write failed', err); });
    }
    return Promise.resolve();
  }

  function applyTheme(theme) {
    if (!theme || theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }

  function applySettings(settings) {
    state.settings = settings;
    I18n.setLang(settings.lang);
    I18n.applyTo(document);
    applyTheme(settings.theme);
    document.title = t('library.title');
    var langButtons = el.langToggle.querySelectorAll('.lang-btn');
    for (var i = 0; i < langButtons.length; i++) langButtons[i].setAttribute('aria-pressed', langButtons[i].dataset.lang === settings.lang ? 'true' : 'false');
    fillSettingsForm(settings);
    updateSearchPlaceholder();
    renderFilters();
    renderList();
    renderDetail();
  }

  function selectedItem() {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === state.selectedId) return state.items[i];
    return null;
  }

  // ---------- Sections & loading ----------

  function setSection(section, opts) {
    opts = opts || {};
    if (state.section !== section) {
      state.section = section;
      state.query = '';
      el.listSearch.value = '';
      state.filter = section === 'snippets' ? '*' : 'all';
      state.selectedId = null;
      state.draft = null;
      state.draftDirty = false;
    }
    var buttons = el.nav.querySelectorAll('.nav-item');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].dataset.section === section) buttons[i].setAttribute('aria-current', 'page');
      else buttons[i].removeAttribute('aria-current');
    }
    el.listPane.classList.toggle('hidden', section === 'settings');
    updateSearchPlaceholder();
    renderFilters();
    if (section === 'settings') { renderDetail(); return Promise.resolve(); }
    return load().then(function () {
      if (opts.selectId) select(opts.selectId);
      if (opts.snippetDraft) openDraft(opts.snippetDraft);
    });
  }

  function updateSearchPlaceholder() {
    var keys = { history: 'search.history', pinned: 'search.pinned', snippets: 'search.snippets', notes: 'search.notes' };
    el.listSearch.placeholder = t(keys[state.section] || 'search.history');
  }

  /** Fetch the list for the current section (keeps the selection when possible). */
  function load() {
    var seq = ++state.loadSeq;
    var p;
    if (state.section === 'snippets') p = lasq.getSnippets().then(filterSnippets);
    else if (state.section === 'notes') p = lasq.getNotes().then(filterNotes);
    else p = lasq.getHistory({ query: state.query, filter: state.section === 'pinned' ? 'pinned' : state.filter, limit: 300, offset: 0 });

    return p.then(function (items) {
      if (seq !== state.loadSeq) return;
      state.items = items || [];
      var stillThere = state.items.some(function (it) { return it.id === state.selectedId; });
      if (!stillThere && !(state.section === 'snippets' && state.draft && !state.draft.id)) {
        state.selectedId = null;
      }
      renderFilters();
      renderList();
      renderDetail();
    }).catch(function (err) { console.error('[lasq] load failed', err); });
  }

  var loadDebounced = debounce(load, 120);

  function filterSnippets(all) {
    state.allSnippets = all || [];
    var q = state.query.toLowerCase();
    return state.allSnippets.filter(function (s) {
      if (state.filter !== '*' && (s.folder || '') !== state.filter) return false;
      if (!q) return true;
      return [s.name, s.trigger, s.folder, s.bodyEn, s.bodyAr].some(function (f) { return f && f.toLowerCase().indexOf(q) !== -1; });
    });
  }

  function filterNotes(all) {
    var q = state.query.toLowerCase();
    return (all || []).filter(function (n) { return !q || n.text.toLowerCase().indexOf(q) !== -1; });
  }

  function folders() {
    var seen = {};
    (state.allSnippets || []).forEach(function (s) { if (s.folder) seen[s.folder] = true; });
    return Object.keys(seen).sort();
  }

  // ---------- Filters ----------

  function chip(label, value, active) {
    var b = make('button', 'chip', label);
    b.type = 'button';
    b.dataset.value = value;
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    return b;
  }

  function renderFilters() {
    el.listFilters.textContent = '';
    if (state.section === 'history') {
      [['all', 'filter.all'], ['pinned', 'filter.pinned'], ['text', 'filter.text'], ['image', 'filter.images'], ['files', 'filter.files']].forEach(function (f) {
        el.listFilters.appendChild(chip(t(f[1]), f[0], state.filter === f[0]));
      });
    } else if (state.section === 'snippets') {
      el.listFilters.appendChild(chip(t('filter.allFolders'), '*', state.filter === '*'));
      folders().forEach(function (f) { el.listFilters.appendChild(chip(f, f, state.filter === f)); });
      var btn = make('button', 'btn btn-sm btn-primary btn-new');
      btn.type = 'button';
      btn.appendChild(svgIcon('i-plus'));
      btn.appendChild(make('span', null, t('action.newSnippet')));
      btn.addEventListener('click', function () { openDraft({}); });
      el.listFilters.appendChild(btn);
    }
  }

  el.listFilters.addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    state.filter = c.dataset.value;
    renderFilters();
    load();
  });

  // ---------- List ----------

  function emptyText() {
    if (state.query) return t('empty.search', { q: state.query });
    return t('empty.' + state.section);
  }

  function renderEmpty(container, text) {
    var box = make('div', 'empty');
    box.appendChild(svgIcon('i-empty'));
    box.appendChild(make('span', null, text));
    container.appendChild(box);
  }

  function renderList() {
    el.list.textContent = '';
    if (!state.items.length) { renderEmpty(el.list, emptyText()); return; }
    var frag = document.createDocumentFragment();
    state.items.forEach(function (item, i) {
      var row = state.section === 'snippets' ? snippetRow(item) : state.section === 'notes' ? noteRow(item) : historyRow(item);
      row.setAttribute('role', 'option');
      row.id = 'li-' + i;
      row.dataset.id = item.id;
      row.setAttribute('aria-selected', item.id === state.selectedId ? 'true' : 'false');
      row.addEventListener('click', function () { select(item.id); });
      frag.appendChild(row);
    });
    el.list.appendChild(frag);
    syncActiveDescendant();
  }

  function syncActiveDescendant() {
    var rows = el.list.querySelectorAll('.list-item');
    el.list.removeAttribute('aria-activedescendant');
    for (var i = 0; i < rows.length; i++) if (rows[i].dataset.id === state.selectedId) el.list.setAttribute('aria-activedescendant', rows[i].id);
  }

  function historyRow(item) {
    var li = make('li', 'list-item');
    if (item.kind === 'image' && item.imageDataUrl) {
      var img = make('img', 'thumb'); img.alt = ''; img.src = item.imageDataUrl; li.appendChild(img);
    } else {
      li.appendChild(svgIcon('i-' + item.kind, 'glyph'));
    }
    var main = make('div', 'list-item-main');
    var title = make('div', 'list-item-title');
    title.appendChild(make('span', 'text', item.preview || (item.kind === 'image' ? t('kind.image') : '')));
    main.appendChild(title);
    var sub = make('div', 'list-item-sub');
    if (item.pinned) sub.appendChild(svgIcon('i-pin', 'pinned'));
    sub.appendChild(document.createTextNode([item.sourceApp || t('meta.unknownApp'), relativeTime(item.createdAt), t('kind.' + item.kind)].join(' · ')));
    main.appendChild(sub);
    li.appendChild(main);
    return li;
  }

  function snippetRow(s) {
    var li = make('li', 'list-item');
    li.appendChild(svgIcon('i-snippet', 'glyph'));
    var main = make('div', 'list-item-main');
    var title = make('div', 'list-item-title');
    title.appendChild(make('span', 'text name', s.name || t('snippet.new')));
    if (s.trigger) title.appendChild(make('span', 'tag tag-mono', s.trigger));
    main.appendChild(title);
    var sub = make('div', 'list-item-sub');
    var parts = [firstLine(s.bodyEn)];
    if (s.folder) parts.unshift(s.folder);
    sub.appendChild(document.createTextNode(parts.filter(Boolean).join(' · ')));
    main.appendChild(sub);
    li.appendChild(main);
    return li;
  }

  function noteRow(n) {
    var li = make('li', 'list-item');
    li.appendChild(svgIcon('i-note', 'glyph'));
    var main = make('div', 'list-item-main');
    var title = make('div', 'list-item-title');
    title.appendChild(make('span', 'text', firstLine(n.text)));
    main.appendChild(title);
    main.appendChild(make('div', 'list-item-sub', relativeTime(n.createdAt)));
    li.appendChild(main);
    return li;
  }

  function select(id) {
    state.selectedId = id;
    var rows = el.list.querySelectorAll('.list-item');
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i].dataset.id === id;
      rows[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) rows[i].scrollIntoView({ block: 'nearest' });
    }
    syncActiveDescendant();
    if (state.section === 'snippets') {
      var s = selectedItem();
      if (s) openDraft(s, true);
    } else {
      renderDetail();
    }
  }

  function moveSelection(delta) {
    if (!state.items.length) return;
    var idx = -1;
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === state.selectedId) idx = i;
    var next = idx < 0 ? 0 : Math.min(state.items.length - 1, Math.max(0, idx + delta));
    select(state.items[next].id);
  }

  el.list.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
    else if (e.key === 'Delete') { e.preventDefault(); deleteSelected(); }
    else if (e.key === 'Enter' && state.section !== 'settings') { e.preventDefault(); focusDetail(); }
  });

  function focusDetail() {
    var target = state.section === 'snippets' ? el.sName : (state.section === 'notes' ? el.nCopy : el.hCopy);
    if (target && !target.closest('.hidden')) target.focus();
  }

  el.listSearch.addEventListener('input', function () {
    state.query = el.listSearch.value;
    loadDebounced();
  });
  el.listSearch.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); el.list.focus(); moveSelection(1); }
    if (e.key === 'Escape') { el.listSearch.value = ''; state.query = ''; load(); }
  });

  // ---------- Detail routing ----------

  function showDetail(which) {
    el.detailEmpty.classList.toggle('hidden', which !== 'empty');
    el.detailHistory.classList.toggle('hidden', which !== 'history');
    el.detailSnippet.classList.toggle('hidden', which !== 'snippet');
    el.detailNote.classList.toggle('hidden', which !== 'note');
    el.detailSettings.classList.toggle('hidden', which !== 'settings');
  }

  function renderDetail() {
    if (state.section === 'settings') { showDetail('settings'); return; }
    if (state.section === 'snippets') {
      if (state.draft) { showDetail('snippet'); renderSnippetEditor(); }
      else { el.detailEmptyText.textContent = t('empty.selectSnippet'); showDetail('empty'); }
      return;
    }
    var item = selectedItem();
    if (!item) {
      el.detailEmptyText.textContent = t(state.section === 'notes' ? 'empty.selectNote' : 'empty.select');
      showDetail('empty');
      return;
    }
    if (state.section === 'notes') { showDetail('note'); renderNote(item); }
    else { showDetail('history'); renderHistoryItem(item); }
  }

  // ---------- History detail ----------

  function renderHistoryItem(item) {
    el.hTitle.textContent = item.kind === 'image' ? t('kind.image') : (item.preview || t('kind.' + item.kind));
    var meta = [t('meta.source') + ': ' + (item.sourceApp || t('meta.unknownApp')), fullDate(item.createdAt), t('kind.' + item.kind)];
    if (item.kind === 'files' && item.files) meta.push(t('meta.files', { n: item.files.length }));
    else if (item.kind !== 'image') meta.push(t('meta.chars', { n: (item.text || '').length }));
    if (item.pinned) meta.push(t('meta.pinned'));
    el.hMeta.textContent = meta.join(' · ');

    el.hContent.textContent = '';
    if (item.kind === 'image' && item.imageDataUrl) {
      var img = document.createElement('img'); img.alt = t('kind.image'); img.src = item.imageDataUrl; el.hContent.appendChild(img);
    } else if (item.kind === 'files' && item.files) {
      var ul = make('ul', 'file-list');
      item.files.forEach(function (f) { ul.appendChild(make('li', null, f)); });
      el.hContent.appendChild(ul);
    } else {
      el.hContent.appendChild(make('pre', null, item.text || ''));
    }
    el.hPin.setAttribute('aria-pressed', item.pinned ? 'true' : 'false');
    el.hPinLabel.textContent = t(item.pinned ? 'action.unpin' : 'action.pin');
    el.hCopy.classList.toggle('hidden', item.kind === 'image');
  }

  el.hCopy.addEventListener('click', function () {
    var item = selectedItem();
    if (item) copyText(item.kind === 'files' && item.files ? item.files.join('\n') : item.text || '');
  });
  el.hPin.addEventListener('click', function () {
    var item = selectedItem();
    if (!item) return;
    lasq.pin({ id: item.id, pinned: !item.pinned }).then(load).catch(logError('pin'));
  });
  el.hDelete.addEventListener('click', deleteSelected);

  function deleteSelected() {
    var item = selectedItem();
    if (!item) return;
    if (state.section === 'snippets') { deleteDraft(); return; }
    if (state.section === 'notes' && !window.confirm(t('note.deleteConfirm'))) return;
    selectNeighbourFirst();
    lasq.remove({ id: item.id }).then(load).catch(logError('remove'));
  }

  function selectNeighbourFirst() {
    var idx = -1;
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === state.selectedId) idx = i;
    var neighbour = state.items[idx + 1] || state.items[idx - 1];
    state.selectedId = neighbour ? neighbour.id : null;
  }

  function logError(what) { return function (err) { console.error('[lasq] ' + what + ' failed', err); }; }

  // ---------- Notes detail ----------

  function renderNote(note) {
    el.nTitle.textContent = firstLine(note.text) || t('nav.notes');
    el.nMeta.textContent = t('meta.created') + ': ' + fullDate(note.createdAt) + ' · ' + t('meta.chars', { n: note.text.length });
    el.nContent.textContent = '';
    el.nContent.appendChild(make('pre', null, note.text));
  }

  el.nCopy.addEventListener('click', function () { var n = selectedItem(); if (n) copyText(n.text); });
  el.nDelete.addEventListener('click', deleteSelected);
  el.nMake.addEventListener('click', function () {
    var n = selectedItem();
    if (!n) return;
    setSection('snippets', { snippetDraft: { name: firstLine(n.text).slice(0, 40), bodyEn: n.text } });
  });

  // ---------- Snippet editor ----------

  function blankSnippet() {
    return { id: null, name: '', trigger: '', folder: '', bodyEn: '', bodyAr: '', appsAllow: [], appsDeny: [], useCount: 0, updatedAt: 0 };
  }

  /** Open a snippet (existing or partial draft) in the editor. */
  function openDraft(partial, fromList) {
    if (state.draftDirty && !fromList && !window.confirm(t('snippet.unsaved') + ' — ' + t('action.cancel') + '?')) return;
    var draft = blankSnippet();
    Object.keys(partial || {}).forEach(function (k) { if (partial[k] !== undefined) draft[k] = partial[k]; });
    draft.appsAllow = (draft.appsAllow || []).slice();
    draft.appsDeny = (draft.appsDeny || []).slice();
    state.draft = draft;
    state.draftDirty = false;
    if (!fromList) {
      state.selectedId = draft.id;
      renderList();
    }
    state.bodyTab = 'en';
    showDetail('snippet');
    renderSnippetEditor();
    if (!draft.id) el.sName.focus();
  }

  function renderSnippetEditor() {
    var d = state.draft;
    if (!d) return;
    el.sTitle.textContent = d.id ? (d.name || t('snippet.new')) : t('snippet.new');
    el.sName.value = d.name;
    el.sTrigger.value = d.trigger;
    el.sFolder.value = d.folder;
    el.sBodyEn.value = d.bodyEn;
    el.sBodyAr.value = d.bodyAr;
    el.sAllow.value = d.appsAllow.join(', ');
    el.sDeny.value = d.appsDeny.join(', ');
    el.sDelete.classList.toggle('hidden', !d.id);
    el.sMeta.textContent = d.id ? [t('meta.updated') + ': ' + fullDate(d.updatedAt), t('meta.uses', { n: d.useCount || 0 })].join(' · ') : '';
    el.folderList.textContent = '';
    folders().forEach(function (f) { var o = document.createElement('option'); o.value = f; el.folderList.appendChild(o); });
    setBodyTab(state.bodyTab);
    hideError(el.sError);
    hideError(el.sNameError);
    hideError(el.sTriggerError);
    validateTrigger();
    renderSnippetPreview();
  }

  function hideError(node) { node.classList.add('hidden'); }
  function showError(node, text) { if (text != null) node.textContent = text; node.classList.remove('hidden'); }

  function validateTrigger() {
    var empty = !el.sTrigger.value.trim();
    el.sTriggerWarning.classList.toggle('hidden', !empty);
    return !empty;
  }

  function setBodyTab(which) {
    state.bodyTab = which;
    var tabs = el.detailSnippet.querySelectorAll('.body-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-selected', tabs[i].dataset.body === which ? 'true' : 'false');
    el.sBodyEnPanel.classList.toggle('hidden', which !== 'en');
    el.sBodyArPanel.classList.toggle('hidden', which !== 'ar');
    renderSnippetPreview();
  }

  el.detailSnippet.querySelector('.body-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.body-tab');
    if (tab) { setBodyTab(tab.dataset.body); activeBodyTextarea().focus(); }
  });

  function activeBodyTextarea() { return state.bodyTab === 'ar' ? el.sBodyAr : el.sBodyEn; }

  /** Render the body with {{placeholders}} highlighted as chips. */
  function renderSnippetPreview() {
    var text = state.bodyTab === 'ar' ? (el.sBodyAr.value || el.sBodyEn.value) : el.sBodyEn.value;
    el.sPreview.dir = state.bodyTab === 'ar' ? 'rtl' : 'ltr';
    el.sPreview.textContent = '';
    var re = /\{\{([^{}]+)\}\}/g;
    var last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) el.sPreview.appendChild(document.createTextNode(text.slice(last, m.index)));
      el.sPreview.appendChild(make('span', 'ph', m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) el.sPreview.appendChild(document.createTextNode(text.slice(last)));
  }

  /** Insert text at the caret of the last focused body textarea. */
  var lastBodyFocus = el.sBodyEn;
  [el.sBodyEn, el.sBodyAr].forEach(function (ta) { ta.addEventListener('focus', function () { lastBodyFocus = ta; }); });

  function insertAtCaret(text) {
    var ta = lastBodyFocus && !lastBodyFocus.closest('.hidden') ? lastBodyFocus : activeBodyTextarea();
    var start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.focus();
    markDirty();
    renderSnippetPreview();
  }

  el.placeholderBar.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-insert]');
    if (btn) insertAtCaret(btn.dataset.insert);
  });

  function markDirty() {
    state.draftDirty = true;
    hideError(el.sError);
  }

  [el.sName, el.sTrigger, el.sFolder, el.sBodyEn, el.sBodyAr, el.sAllow, el.sDeny].forEach(function (input) {
    input.addEventListener('input', function () {
      markDirty();
      if (input === el.sTrigger) { validateTrigger(); hideError(el.sTriggerError); }
      if (input === el.sName) hideError(el.sNameError);
      if (input === el.sBodyEn || input === el.sBodyAr) renderSnippetPreview();
    });
  });

  function readDraft() {
    var d = state.draft || blankSnippet();
    return {
      id: d.id,
      name: el.sName.value.trim(),
      trigger: el.sTrigger.value.trim(),
      folder: el.sFolder.value.trim(),
      bodyEn: el.sBodyEn.value,
      bodyAr: el.sBodyAr.value,
      appsAllow: splitList(el.sAllow.value),
      appsDeny: splitList(el.sDeny.value),
      useCount: d.useCount || 0,
      updatedAt: d.updatedAt || 0
    };
  }

  function saveDraft() {
    var snippet = readDraft();
    if (!snippet.name) { showError(el.sNameError); el.sName.focus(); return; }
    el.sSave.disabled = true;
    lasq.saveSnippet(snippet).then(function (saved) {
      state.draft = saved;
      state.draftDirty = false;
      state.selectedId = saved.id;
      toast(t('action.saved'));
      return load();
    }).catch(function (err) {
      if (err && err.code === 'trigger-taken') { showError(el.sTriggerError); el.sTrigger.focus(); }
      else { console.error('[lasq] saveSnippet failed', err); showError(el.sError, t('snippet.saveFailed')); }
    }).then(function () { el.sSave.disabled = false; });
  }

  el.detailSnippet.addEventListener('submit', function (e) { e.preventDefault(); saveDraft(); });
  el.detailSnippet.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveDraft(); }
  });

  function deleteDraft() {
    var d = state.draft;
    if (!d || !d.id) { state.draft = null; state.draftDirty = false; renderDetail(); return; }
    if (!window.confirm(t('snippet.deleteConfirm'))) return;
    lasq.deleteSnippet({ id: d.id }).then(function () {
      state.draft = null;
      state.draftDirty = false;
      state.selectedId = null;
      return load();
    }).catch(logError('deleteSnippet'));
  }
  el.sDelete.addEventListener('click', deleteDraft);

  el.sTest.addEventListener('click', function () {
    copyText(el.sBodyEn.value).then(function () { toast(t('snippet.testCopied')); });
  });

  // ---------- Settings ----------

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  /** Build a nested partial object from a dotted path. */
  function partialFromPath(path, value) {
    var out = {}, cur = out, keys = path.split('.');
    for (var i = 0; i < keys.length - 1; i++) { cur[keys[i]] = {}; cur = cur[keys[i]]; }
    cur[keys[keys.length - 1]] = value;
    return out;
  }

  function settingsControls() { return el.detailSettings.querySelectorAll('[data-path]'); }

  function fillSettingsForm(settings) {
    var controls = settingsControls();
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i];
      var value = getPath(settings, c.dataset.path);
      if (value === undefined) continue;
      if (c.type === 'checkbox') c.checked = !!value;
      else if (c.dataset.type === 'lines') c.value = (value || []).join('\n');
      else c.value = value;
    }
  }

  function readControl(c) {
    if (c.type === 'checkbox') return c.checked;
    if (c.dataset.type === 'number') { var n = Number(c.value); return isNaN(n) ? 0 : n; }
    if (c.dataset.type === 'lines') return c.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    return c.value;
  }

  var pending = {};
  var flushSettings = debounce(function () {
    var partial = pending;
    pending = {};
    lasq.saveSettings(partial).then(function (full) {
      if (full) applySettings(full);
      toast(t('settings.saved'));
    }).catch(logError('saveSettings'));
  }, 300);

  function deepAssign(target, src) {
    Object.keys(src).forEach(function (k) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) { target[k] = target[k] || {}; deepAssign(target[k], src[k]); }
      else target[k] = src[k];
    });
  }

  function onSettingChange(e) {
    var c = e.target.closest('[data-path]');
    if (!c) return;
    deepAssign(pending, partialFromPath(c.dataset.path, readControl(c)));
    flushSettings();
  }
  el.detailSettings.addEventListener('change', onSettingChange);
  el.detailSettings.addEventListener('input', function (e) {
    var c = e.target.closest('[data-path]');
    if (c && (c.tagName === 'TEXTAREA' || c.type === 'text' || c.type === 'number')) onSettingChange(e);
  });
  el.detailSettings.addEventListener('submit', function (e) { e.preventDefault(); });

  el.stExport.addEventListener('click', function () {
    lasq.exportData().then(function (r) {
      toast(r && r.ok ? t('settings.exported', { path: r.path || '' }) : t('settings.exportCancelled'));
    }).catch(logError('exportData'));
  });
  el.stImport.addEventListener('click', function () {
    lasq.importData().then(function (r) {
      if (r && r.ok) { toast(t('settings.imported', r.counts || { history: 0, snippets: 0, notes: 0 })); }
      else toast(t('settings.importCancelled'));
    }).catch(logError('importData'));
  });
  el.stClear.addEventListener('click', function () {
    var days = Math.max(0, Number(el.stClearDays.value) || 0);
    var msg = days > 0 ? t('settings.clearConfirm', { n: days }) : t('settings.clearAllConfirm');
    if (!window.confirm(msg)) return;
    lasq.clearHistory({ olderThanDays: days }).then(function () { toast(t('settings.cleared')); }).catch(logError('clearHistory'));
  });

  // ---------- Navigation & language ----------

  el.nav.addEventListener('click', function (e) {
    var btn = e.target.closest('.nav-item');
    if (btn) setSection(btn.dataset.section);
  });

  el.langToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-btn');
    if (!btn || !state.settings || btn.dataset.lang === state.settings.lang) return;
    lasq.saveSettings({ lang: btn.dataset.lang }).then(applySettings).catch(logError('saveSettings'));
  });

  // ---------- Events from main ----------

  lasq.on('library:section', function (payload) {
    payload = payload || {};
    setSection(payload.section || 'history', { snippetDraft: payload.snippetDraft });
  });

  lasq.on('data:changed', function (payload) {
    var what = payload && payload.what;
    if (what === 'settings') return;
    if (state.section === 'settings') return;
    var relevant = (what === 'snippets' && state.section === 'snippets') || (what === 'notes' && state.section === 'notes')
      || (what === 'history' && (state.section === 'history' || state.section === 'pinned')) || !what;
    if (relevant) load();
  });

  lasq.on('settings:changed', function (settings) { if (settings) applySettings(settings); });

  // ---------- Boot ----------
  lasq.ready().then(function (info) {
    applySettings(info.settings || { lang: info.lang || 'en', theme: 'system' });
    return setSection('history');
  }).catch(function (err) { console.error('[lasq] ready failed', err); });
})();
