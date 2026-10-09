/* ==========================================================================
   Lasq – paste panel logic
   Talks to window.lasq (preload bridge, or ui/mock.js in a plain browser).
   ========================================================================== */
(function () {
  'use strict';

  var lasq = window.lasq;
  var I18n = window.LasqI18n;
  var t = I18n.t;

  // ---------- State ----------
  var state = {
    tab: 'history',            // 'history' | 'pinned' | 'snippets'
    query: '',
    items: [],
    selectedId: null,
    mode: 'paste',             // 'paste' | 'capture' | 'form'
    modeSetAt: 0,
    formFields: [],
    transforms: [],
    transformOpen: false,
    transformIndex: 0,
    settings: null,
    searchSeq: 0
  };

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    panel: $('panel'),
    search: $('search'),
    tabs: $('tabs'),
    mainPaste: $('main-paste'),
    results: $('results'),
    preview: $('preview'),
    previewEmpty: $('preview-empty'),
    previewBody: $('preview-body'),
    previewContent: $('preview-content'),
    previewMeta: $('preview-meta'),
    btnPin: $('btn-pin'),
    btnDelete: $('btn-delete'),
    mainCapture: $('main-capture'),
    captureText: $('capture-text'),
    mainForm: $('main-form'),
    formTitle: $('form-title'),
    formFields: $('form-fields'),
    legend: $('legend'),
    overlay: $('transform-overlay'),
    transformFilter: $('transform-filter'),
    transformList: $('transform-list')
  };

  // ---------- Small helpers ----------

  /** Escape text for safe insertion into HTML strings. */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Relative time: "now", "5 min", "3 h", "2 d". */
  function relativeTime(ts) {
    var diff = Math.max(0, Date.now() - ts);
    var m = Math.floor(diff / 60000);
    if (m < 1) return t('time.now');
    if (m < 60) return m + ' ' + t('time.min');
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' ' + t('time.h');
    return Math.floor(h / 24) + ' ' + t('time.d');
  }

  function kindLabel(kind) { return t('kind.' + kind); }

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

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
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
    document.title = t('panel.title');
    updateLegend();
    renderResults();
    renderPreview();
  }

  function selectedItem() {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === state.selectedId) return state.items[i];
    return null;
  }

  function selectedIndex() {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === state.selectedId) return i;
    return -1;
  }

  // ---------- Search & results ----------

  function runSearch() {
    var seq = ++state.searchSeq;
    return lasq.search({ query: state.query, tab: state.tab, limit: 50 }).then(function (items) {
      if (seq !== state.searchSeq) return; // a newer search is already running
      state.items = items || [];
      var stillThere = state.items.some(function (it) { return it.id === state.selectedId; });
      if (!stillThere) state.selectedId = state.items.length ? state.items[0].id : null;
      renderResults();
      renderPreview();
    }).catch(function (err) { console.error('[lasq] search failed', err); });
  }

  var runSearchDebounced = debounce(runSearch, 60);

  function emptyMessage() {
    if (state.query) return t('empty.search', { q: state.query });
    return t('empty.' + state.tab);
  }

  function renderEmpty(container, message) {
    var box = make('div', 'empty');
    box.appendChild(svgIcon('i-empty'));
    box.appendChild(make('span', null, message));
    container.appendChild(box);
  }

  /** Build one result row. */
  function buildRow(item, index) {
    var li = make('li', 'result');
    li.setAttribute('role', 'option');
    li.id = 'result-' + index;
    li.dataset.id = item.id;
    li.setAttribute('aria-selected', item.id === state.selectedId ? 'true' : 'false');

    var num = make('span', 'result-num', index < 9 ? String(index + 1) : '');
    if (index >= 9) num.style.visibility = 'hidden';
    li.appendChild(num);

    if (item.kind === 'image' && item.imageDataUrl) {
      var img = make('img', 'result-thumb');
      img.alt = '';
      img.src = item.imageDataUrl;
      li.appendChild(img);
    } else {
      li.appendChild(svgIcon('i-' + item.kind, 'result-glyph'));
    }

    var main = make('div', 'result-main');
    if (item.kind === 'snippet') {
      main.appendChild(make('span', 'result-text result-name', item.name || item.preview));
      if (item.trigger) main.appendChild(make('span', 'tag tag-mono', item.trigger));
      var body = make('span', 'result-text text-3', item.preview || '');
      main.appendChild(body);
    } else {
      main.appendChild(make('span', 'result-text', item.preview || (item.kind === 'image' ? t('kind.image') : '')));
    }
    li.appendChild(main);

    var end = make('span', 'result-end');
    if (item.pinned && state.tab !== 'pinned') {
      var pin = make('span', 'pin-mark', '');
      pin.appendChild(svgIcon('i-pin'));
      end.appendChild(pin);
    }
    var endText = item.kind === 'snippet'
      ? (item.folder || '')
      : [item.sourceApp, relativeTime(item.createdAt)].filter(Boolean).join(' · ');
    end.appendChild(document.createTextNode(endText));
    li.appendChild(end);

    li.addEventListener('click', function () { select(item.id, true); });
    li.addEventListener('dblclick', function () { select(item.id, false); paste('normal'); });
    return li;
  }

  function renderResults() {
    el.results.textContent = '';
    if (!state.items.length) {
      renderEmpty(el.results, emptyMessage());
      el.search.removeAttribute('aria-activedescendant');
      return;
    }
    var frag = document.createDocumentFragment();
    state.items.forEach(function (item, i) { frag.appendChild(buildRow(item, i)); });
    el.results.appendChild(frag);
    syncActiveDescendant();
  }

  function syncActiveDescendant() {
    var idx = selectedIndex();
    if (idx >= 0) el.search.setAttribute('aria-activedescendant', 'result-' + idx);
    else el.search.removeAttribute('aria-activedescendant');
  }

  /** Select an item by id; updates rows without a full rebuild. */
  function select(id, scroll) {
    state.selectedId = id;
    var rows = el.results.querySelectorAll('.result');
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i].dataset.id === id;
      rows[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && scroll) rows[i].scrollIntoView({ block: 'nearest' });
    }
    syncActiveDescendant();
    renderPreview();
  }

  function moveSelection(delta) {
    if (!state.items.length) return;
    var idx = selectedIndex();
    var next = idx < 0 ? 0 : Math.min(state.items.length - 1, Math.max(0, idx + delta));
    select(state.items[next].id, true);
  }

  // ---------- Preview ----------

  function renderPreview() {
    var item = selectedItem();
    if (!item) {
      el.previewEmpty.classList.remove('hidden');
      el.previewBody.classList.add('hidden');
      return;
    }
    el.previewEmpty.classList.add('hidden');
    el.previewBody.classList.remove('hidden');
    el.previewContent.textContent = '';

    if (item.kind === 'image' && item.imageDataUrl) {
      var img = document.createElement('img');
      img.alt = t('kind.image');
      img.src = item.imageDataUrl;
      el.previewContent.appendChild(img);
    } else if (item.kind === 'files' && item.files && item.files.length) {
      var ul = make('ul', 'file-list');
      item.files.forEach(function (f) { ul.appendChild(make('li', null, f)); });
      el.previewContent.appendChild(ul);
    } else if (item.kind === 'snippet') {
      var head = make('div', 'preview-snippet-head');
      head.appendChild(make('strong', null, item.name || ''));
      if (item.trigger) head.appendChild(make('span', 'tag tag-mono', item.trigger));
      if (item.folder) head.appendChild(make('span', 'tag', item.folder));
      el.previewContent.appendChild(head);
      el.previewContent.appendChild(make('pre', null, item.text || ''));
    } else {
      el.previewContent.appendChild(make('pre', null, item.text || ''));
    }

    var meta = [item.sourceApp || t('meta.unknownApp'), relativeTime(item.createdAt), kindLabel(item.kind)];
    if (item.kind === 'files' && item.files) meta.push(t('meta.files', { n: item.files.length }));
    else if (item.kind !== 'image') meta.push(t('meta.chars', { n: (item.text || '').length }));
    el.previewMeta.textContent = meta.join(' · ');

    var pinnable = item.kind !== 'snippet';
    el.btnPin.classList.toggle('hidden', !pinnable);
    el.btnDelete.classList.toggle('hidden', !pinnable);
    el.btnPin.setAttribute('aria-pressed', item.pinned ? 'true' : 'false');
    el.btnPin.title = t(item.pinned ? 'action.unpin' : 'action.pin');
    el.btnPin.setAttribute('aria-label', el.btnPin.title);
  }

  // ---------- Actions ----------

  function paste(mode, transform) {
    var item = selectedItem();
    if (!item) return Promise.resolve();
    var req = { id: item.id, mode: mode };
    if (transform) req.transform = transform;
    return lasq.paste(req).then(function () {
      if (mode === 'multi') el.search.focus();
    }).catch(function (err) { console.error('[lasq] paste failed', err); });
  }

  function pasteNumber(n) {
    var item = state.items[n - 1];
    if (!item) return;
    state.selectedId = item.id;
    paste('normal');
  }

  function togglePin() {
    var item = selectedItem();
    if (!item || item.kind === 'snippet') return;
    lasq.pin({ id: item.id, pinned: !item.pinned }).then(runSearch).catch(function (err) { console.error('[lasq] pin failed', err); });
  }

  function removeSelected() {
    var item = selectedItem();
    if (!item || item.kind === 'snippet') return;
    var idx = selectedIndex();
    // Pre-select the neighbour so the list does not jump back to the top.
    var neighbour = state.items[idx + 1] || state.items[idx - 1];
    state.selectedId = neighbour ? neighbour.id : null;
    lasq.remove({ id: item.id }).then(runSearch).catch(function (err) { console.error('[lasq] remove failed', err); });
  }

  function setTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    var buttons = el.tabs.querySelectorAll('.tab');
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-selected', buttons[i].dataset.tab === tab ? 'true' : 'false');
    state.selectedId = null;
    runSearch();
  }

  function cycleTab(delta) {
    var order = ['history', 'pinned', 'snippets'];
    var i = order.indexOf(state.tab);
    setTab(order[(i + delta + order.length) % order.length]);
  }

  function closePanel() { lasq.hidePanel(); }

  // ---------- Modes ----------

  function updateLegend() {
    var key = state.transformOpen ? 'legend.transform' : 'legend.' + state.mode;
    el.legend.textContent = t(key);
  }

  function setMode(mode, payload) {
    payload = payload || {};
    state.mode = mode;
    state.modeSetAt = Date.now();
    el.panel.dataset.mode = mode;
    el.mainPaste.classList.toggle('hidden', mode !== 'paste');
    el.mainCapture.classList.toggle('hidden', mode !== 'capture');
    el.mainForm.classList.toggle('hidden', mode !== 'form');
    closeTransformPicker();

    if (mode === 'capture') {
      el.captureText.value = payload.prefill || '';
      el.captureText.focus();
      el.captureText.setSelectionRange(el.captureText.value.length, el.captureText.value.length);
    } else if (mode === 'form') {
      buildForm(payload);
    } else {
      el.search.focus();
    }
    updateLegend();
  }

  /**
   * Reset to paste mode and re-run the search (window focus / data:changed).
   * Two guards: a focus event that arrives a few ms after `panel:mode` must not
   * undo the mode main just asked for, and a background data:changed must not
   * discard a form main is waiting on or a note the user is typing.
   */
  function refresh(fromFocus) {
    var justSwitched = Date.now() - state.modeSetAt < 500;
    if (state.mode !== 'paste' && !justSwitched) {
      var keep = !fromFocus && (state.mode === 'form' || el.captureText.value.trim() !== '');
      if (!keep) {
        if (state.mode === 'form') lasq.cancelForm();
        el.captureText.value = '';
        setMode('paste');
      }
    }
    if (fromFocus && state.mode === 'paste') {
      // Typing replaces the previous query, but its results stay visible until then.
      el.search.focus();
      el.search.select();
    }
    runSearch();
  }

  function buildForm(payload) {
    state.formFields = payload.fields || [];
    el.formTitle.textContent = payload.snippetName || t('form.title');
    el.formFields.textContent = '';
    state.formFields.forEach(function (field, i) {
      var wrap = make('div', 'form-field');
      var id = 'ff-' + i;
      var label = make('label', null, field.name);
      label.htmlFor = id;
      wrap.appendChild(label);
      var input;
      if (field.type === 'choice') {
        input = make('select', 'select');
        (field.options || []).forEach(function (opt) {
          var o = make('option', null, opt);
          o.value = opt;
          input.appendChild(o);
        });
      } else {
        input = make('input', 'input');
        input.type = 'text';
        input.autocomplete = 'off';
      }
      input.id = id;
      input.dataset.field = field.name;
      wrap.appendChild(input);
      el.formFields.appendChild(wrap);
    });
    var first = el.formFields.querySelector('input, select');
    if (first) first.focus();
  }

  function submitForm() {
    var values = {};
    var inputs = el.formFields.querySelectorAll('[data-field]');
    for (var i = 0; i < inputs.length; i++) values[inputs[i].dataset.field] = inputs[i].value;
    lasq.submitForm({ values: values });
    setMode('paste');
  }

  function cancelForm() {
    lasq.cancelForm();
    setMode('paste');
  }

  function saveCapture(asSnippet) {
    var text = el.captureText.value;
    if (!text.trim()) return;
    lasq.quickCapture({ text: text, asSnippet: asSnippet }).then(function () {
      el.captureText.value = '';
      setMode('paste');
      runSearch();
    }).catch(function (err) { console.error('[lasq] quickCapture failed', err); });
  }

  function cancelCapture() {
    el.captureText.value = '';
    setMode('paste');
    closePanel();
  }

  // ---------- Transform picker ----------

  function transformLabel(tr) { return I18n.lang === 'ar' && tr.labelAr ? tr.labelAr : tr.labelEn; }

  function visibleTransforms() {
    var q = el.transformFilter.value.trim().toLowerCase();
    return state.transforms.filter(function (tr) {
      return !q || tr.labelEn.toLowerCase().indexOf(q) !== -1 || (tr.labelAr || '').toLowerCase().indexOf(q) !== -1 || tr.id.toLowerCase().indexOf(q) !== -1;
    });
  }

  function openTransformPicker() {
    if (!selectedItem()) return;
    state.transformOpen = true;
    state.transformIndex = 0;
    el.transformFilter.value = '';
    el.overlay.classList.remove('hidden');
    renderTransforms();
    el.transformFilter.focus();
    updateLegend();
  }

  function closeTransformPicker() {
    if (!state.transformOpen) return;
    state.transformOpen = false;
    el.overlay.classList.add('hidden');
    updateLegend();
    if (state.mode === 'paste') el.search.focus();
  }

  function renderTransforms() {
    var list = visibleTransforms();
    if (state.transformIndex >= list.length) state.transformIndex = Math.max(0, list.length - 1);
    el.transformList.textContent = '';
    if (!list.length) {
      el.transformList.appendChild(make('li', 'empty', t('transform.empty')));
      return;
    }
    list.forEach(function (tr, i) {
      var li = make('li', 'transform-item');
      li.setAttribute('role', 'option');
      li.id = 'transform-' + i;
      li.setAttribute('aria-selected', i === state.transformIndex ? 'true' : 'false');
      li.appendChild(svgIcon('i-wand'));
      li.appendChild(make('span', 'truncate', transformLabel(tr)));
      li.appendChild(make('span', 'tag tag-mono', tr.id));
      li.addEventListener('click', function () { applyTransform(tr); });
      li.addEventListener('mousemove', function () {
        if (state.transformIndex !== i) { state.transformIndex = i; renderTransforms(); }
      });
      el.transformList.appendChild(li);
    });
    el.transformFilter.setAttribute('aria-activedescendant', 'transform-' + state.transformIndex);
    var active = el.transformList.children[state.transformIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function applyTransform(tr) {
    if (!tr) return;
    closeTransformPicker();
    paste('transform', tr.id);
  }

  function onTransformKey(e) {
    var list = visibleTransforms();
    switch (e.key) {
      case 'Escape': e.preventDefault(); e.stopPropagation(); closeTransformPicker(); break;
      case 'ArrowDown': e.preventDefault(); state.transformIndex = Math.min(list.length - 1, state.transformIndex + 1); renderTransforms(); break;
      case 'ArrowUp': e.preventDefault(); state.transformIndex = Math.max(0, state.transformIndex - 1); renderTransforms(); break;
      case 'Enter': e.preventDefault(); applyTransform(list[state.transformIndex]); break;
      case 'Tab': e.preventDefault(); break;
      default: return;
    }
  }

  // ---------- Keyboard ----------

  function isPrintableKey(e) {
    return e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;
  }

  /** True when the caret sits at the end of the search box with nothing selected. */
  function caretAtEnd(input) {
    return input.selectionStart === input.selectionEnd && input.selectionEnd === input.value.length;
  }

  function onPasteModeKey(e) {
    var key = e.key;

    if (key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (key === 'Enter') {
      e.preventDefault();
      if (e.altKey) openTransformPicker();
      else if (e.ctrlKey || e.metaKey) paste('plain');
      else if (e.shiftKey) paste('multi');
      else paste('normal');
      return;
    }
    if (key === 'ArrowDown') { e.preventDefault(); moveSelection(1); return; }
    if (key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); return; }
    if (key === 'Tab') { e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); return; }
    if ((e.ctrlKey || e.metaKey) && (key === 'p' || key === 'P')) { e.preventDefault(); togglePin(); return; }
    if (key === 'Delete' && (e.shiftKey || e.target !== el.search || caretAtEnd(el.search))) {
      e.preventDefault(); removeSelected(); return;
    }
    // 1–9 paste result n: bare digit when the search box is empty, Alt/Ctrl+digit always
    // (so numbers can still be typed into a non-empty query).
    if (/^[1-9]$/.test(key) && !e.shiftKey && (e.altKey || e.ctrlKey || el.search.value === '')) {
      e.preventDefault(); pasteNumber(Number(key)); return;
    }
    // Typing anywhere focuses the search box.
    if (e.target !== el.search && isPrintableKey(e)) el.search.focus();
  }

  function onCaptureKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelCapture(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveCapture(!!(e.ctrlKey || e.metaKey));
    }
  }

  function onFormKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelForm(); return; }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submitForm(); }
  }

  document.addEventListener('keydown', function (e) {
    if (state.transformOpen) { onTransformKey(e); return; }
    if (state.mode === 'capture') onCaptureKey(e);
    else if (state.mode === 'form') onFormKey(e);
    else onPasteModeKey(e);
  });

  // ---------- Wiring ----------

  el.search.addEventListener('input', function () {
    state.query = el.search.value;
    runSearchDebounced();
  });

  el.tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (btn) { setTab(btn.dataset.tab); el.search.focus(); }
  });

  el.btnPin.addEventListener('click', togglePin);
  el.btnDelete.addEventListener('click', removeSelected);
  el.transformFilter.addEventListener('input', function () { state.transformIndex = 0; renderTransforms(); });
  el.overlay.addEventListener('mousedown', function (e) { if (e.target === el.overlay) closeTransformPicker(); });

  // Keep focus inside the search box when clicking blank areas of the list.
  el.results.addEventListener('mousedown', function (e) { if (e.target === el.results) e.preventDefault(); });

  window.addEventListener('focus', function () { refresh(true); });

  lasq.on('panel:mode', function (payload) {
    payload = payload || {};
    setMode(payload.mode || 'paste', payload);
    if (payload.mode === 'paste' || !payload.mode) runSearch();
  });

  lasq.on('data:changed', function () { refresh(false); });

  lasq.on('settings:changed', function (settings) { if (settings) applySettings(settings); });

  // ---------- Boot ----------
  lasq.ready().then(function (info) {
    state.transforms = info.transforms || [];
    applySettings(info.settings || { lang: info.lang || 'en', theme: 'system' });
    el.search.focus();
    return runSearch();
  }).catch(function (err) { console.error('[lasq] ready failed', err); });
})();
