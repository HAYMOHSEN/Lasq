/* ==========================================================================
   Lasq – in-browser mock of window.lasq (see docs/RENDERER-API.md)
   Installed only when the page runs outside Electron (no preload bridge).
   Also exposes window.lasqMock = { emit(channel, payload) } for testing
   panel modes from the console, e.g.
     lasqMock.emit('panel:mode', { mode: 'capture', prefill: 'Hello' })
   ========================================================================== */
(function () {
  'use strict';
  if (window.lasq) return;

  var now = Date.now();
  var MIN = 60 * 1000;
  var HOUR = 60 * MIN;
  var DAY = 24 * HOUR;

  // 16×16 PNG, blue top half / light-blue bottom half (85 bytes).
  var PNG_SQUARE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR4nGNgSD9AGhrVQBMNCWf/k4RGNdBEAwAV2amQ/cERtAAAAABJRU5ErkJggg==';

  /** Build a tiny PNG of a solid colour at runtime (falls back to the static square). */
  function makeSquarePng(color) {
    try {
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var ctx = c.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(6, 6, 20, 20);
      return c.toDataURL('image/png');
    } catch (e) {
      return PNG_SQUARE;
    }
  }

  var nextId = 100;
  function uid(prefix) { return (prefix || 'id') + '-' + (nextId++); }

  function firstLine(text) {
    var line = String(text || '').split(/\r?\n/)[0];
    return line.length > 120 ? line.slice(0, 120) + '…' : line;
  }

  function textItem(text, app, ago, pinned) {
    return { id: uid('h'), kind: 'text', text: text, preview: firstLine(text), sourceApp: app, createdAt: now - ago, pinned: !!pinned };
  }

  // ---------- Demo data ----------
  var history = [
    textItem('Dear Prof. Al-Khatib,\n\nThank you for your message. The lab results are attached; please let me know if you need the raw data as well.\n\nBest regards,\nHani', 'Outlook', 2 * MIN, false),
    textItem('السلام عليكم، أرجو تأكيد موعد اجتماع القسم يوم الثلاثاء الساعة العاشرة صباحًا في قاعة الاجتماعات.', 'WhatsApp', 7 * MIN, true),
    textItem('https://github.com/haymohsen/lasq/issues/42', 'Chrome', 15 * MIN, false),
    { id: uid('h'), kind: 'image', text: '', preview: 'Screenshot 640×400', sourceApp: 'Snipping Tool', createdAt: now - 25 * MIN, pinned: false, imageDataUrl: makeSquarePng('#0067C0') },
    textItem('SELECT id, name, trigger FROM snippets WHERE folder = \'Work\' ORDER BY updated_at DESC;', 'VS Code', 48 * MIN, false),
    textItem('ME0354 Actuators – Chapter 4: Magnetic circuits\nTopics: reluctance, MMF, B-H curves, hysteresis and eddy-current losses.', 'Word', 2 * HOUR, true),
    { id: uid('h'), kind: 'files', text: 'C:\\Users\\Hani\\Documents\\Papers\\microgrid-digital-twin.pdf\nC:\\Users\\Hani\\Documents\\Papers\\sic-inverter-losses.docx', preview: 'microgrid-digital-twin.pdf, sic-inverter-losses.docx', sourceApp: 'Explorer', createdAt: now - 3 * HOUR, pinned: false, files: ['C:\\Users\\Hani\\Documents\\Papers\\microgrid-digital-twin.pdf', 'C:\\Users\\Hani\\Documents\\Papers\\sic-inverter-losses.docx'] },
    textItem('Meeting notes: agree on the hydrogen electrolyser model parameters by Thursday; Rami prepares the stack efficiency curve.', 'Teams', 5 * HOUR, false),
    textItem('تم تحديث جدول المحاضرات للفصل الدراسي القادم، يرجى مراجعة التوزيع الجديد وإبلاغ القسم بأي تعارض قبل نهاية الأسبوع.', 'Outlook', 9 * HOUR, false),
    textItem('0795 123 456', 'Phone Link', 1 * DAY + 2 * HOUR, false),
    textItem('npm run build && npm run package -- --win --x64', 'Windows Terminal', 2 * DAY, false),
    textItem('The quick brown fox jumps over the lazy dog. 0123456789', 'Notepad', 4 * DAY, false)
  ];

  var snippets = [
    { id: 's-1', name: 'Email signature', trigger: ';sig', folder: 'Work', bodyEn: 'Best regards,\nProf. Dr.-Eng. Hani Muhsen\nMechatronics Engineering Department\nGerman Jordanian University', bodyAr: 'مع أطيب التحيات،\nأ.د. هاني محسن\nقسم هندسة الميكاترونكس\nالجامعة الألمانية الأردنية', appsAllow: [], appsDeny: [], useCount: 128, updatedAt: now - 3 * DAY },
    { id: 's-2', name: 'Greeting', trigger: '؛توق', folder: 'Work', bodyEn: 'Dear {{field:Name}},\n\nI hope this message finds you well.\n\n{{cursor}}', bodyAr: 'عزيزي {{field:الاسم}}،\n\nأرجو أن تصلك رسالتي وأنت بخير.\n\n{{cursor}}', appsAllow: ['outlook.exe'], appsDeny: [], useCount: 54, updatedAt: now - 5 * DAY },
    { id: 's-3', name: 'Today', trigger: ';date', folder: '', bodyEn: '{{date}} {{time}}', bodyAr: '', appsAllow: [], appsDeny: [], useCount: 310, updatedAt: now - 10 * DAY },
    { id: 's-4', name: 'Office hours', trigger: ';oh', folder: 'Teaching', bodyEn: 'Office hours: {{choice:Sunday|Tuesday|Thursday}} 11:00–13:00, building C, room 214.', bodyAr: 'الساعات المكتبية: {{choice:الأحد|الثلاثاء|الخميس}} من 11:00 إلى 13:00، مبنى C، غرفة 214.', appsAllow: [], appsDeny: ['code.exe'], useCount: 21, updatedAt: now - 20 * DAY },
    { id: 's-5', name: 'Quote clipboard', trigger: ';q', folder: 'Teaching', bodyEn: '> {{clipboard}}\n\n', bodyAr: '', appsAllow: [], appsDeny: [], useCount: 9, updatedAt: now - 30 * DAY }
  ];

  var notes = [
    { id: 'n-1', text: 'Ask the registrar about the ME0354 lab section cap (currently 24).', createdAt: now - 40 * MIN },
    { id: 'n-2', text: 'فكرة: إضافة اختصار لتصحيح النص المكتوب بلغة لوحة المفاتيح الخطأ مباشرة من لوحة اللصق.', createdAt: now - 6 * HOUR },
    { id: 'n-3', text: 'Paper idea: digital-twin validation of a PV + electrolyser microgrid with hardware-in-the-loop.', createdAt: now - 3 * DAY }
  ];

  var settings = {
    lang: 'en',
    theme: 'system',
    hotkeys: { panel: 'CommandOrControl+Shift+V', pastePlain: 'CommandOrControl+Shift+Alt+V', capture: 'CommandOrControl+Shift+N', pause: 'CommandOrControl+Shift+P', library: 'CommandOrControl+Shift+L' },
    capture: { text: true, images: true, files: true, maxTextKB: 512, maxImageMB: 8, retentionDays: 30, maxItems: 2000, excludedApps: ['keepass.exe', '1password.exe'] },
    expansion: { enabled: true, wordBoundary: true, matchCase: false, sound: false, excludedApps: ['mstsc.exe'] },
    paste: { restoreClipboard: true, restoreClipboardAfterMs: 400 },
    privacy: { encrypt: false, paused: false },
    startup: true
  };

  // Optional demo-data override (used for Store screenshots and demos):
  // define window.LASQ_DEMO = { history, snippets, notes, settings, transforms } before this script loads.
  var seed = window.LASQ_DEMO;
  if (seed) {
    if (seed.history) {
      var h2 = seed.history.map(function (h) {
        return Object.assign({ id: uid('h'), kind: 'text', text: '', preview: firstLine(h.text || ''), sourceApp: '', pinned: false, createdAt: now - (h.ago || 0) }, h);
      });
      history.splice.apply(history, [0, history.length].concat(h2));
    }
    if (seed.snippets) {
      var s2 = seed.snippets.map(function (s) {
        return Object.assign({ id: uid('s'), folder: '', bodyAr: '', appsAllow: [], appsDeny: [], useCount: 0, updatedAt: now - DAY }, s);
      });
      snippets.splice.apply(snippets, [0, snippets.length].concat(s2));
    }
    if (seed.notes) {
      var n2 = seed.notes.map(function (n) { return Object.assign({ id: uid('n'), createdAt: now - (n.ago || HOUR) }, n); });
      notes.splice.apply(notes, [0, notes.length].concat(n2));
    }
    if (seed.settings) Object.assign(settings, seed.settings);
  }

  var transforms = (seed && seed.transforms) || [
    { id: 'plain', labelEn: 'Plain text', labelAr: 'نص عادي' },
    { id: 'upper', labelEn: 'UPPERCASE', labelAr: 'أحرف كبيرة' },
    { id: 'lower', labelEn: 'lowercase', labelAr: 'أحرف صغيرة' },
    { id: 'title', labelEn: 'Title Case', labelAr: 'أحرف كبيرة في بداية الكلمات' },
    { id: 'trim', labelEn: 'Trim whitespace', labelAr: 'إزالة المسافات الزائدة' },
    { id: 'joinLines', labelEn: 'Join lines', labelAr: 'دمج الأسطر' },
    { id: 'fixLayout', labelEn: 'Fix keyboard layout (EN ⇄ AR)', labelAr: 'تصحيح لغة لوحة المفاتيح (EN ⇄ AR)' },
    { id: 'digitsWestern', labelEn: 'Arabic-Indic digits → 0-9', labelAr: 'الأرقام الهندية ← 0-9' }
  ];

  // ---------- Helpers ----------
  var listeners = {};

  function emit(channel, payload) {
    var cbs = listeners[channel] || [];
    cbs.slice().forEach(function (cb) {
      try { cb(payload); } catch (e) { console.error('[lasq mock] listener error on ' + channel, e); }
    });
  }

  function changed(what) { emit('data:changed', { what: what }); }

  function delay(value, ms) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms == null ? 20 : ms); });
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function deepMerge(target, patch) {
    Object.keys(patch || {}).forEach(function (k) {
      var pv = patch[k];
      if (pv && typeof pv === 'object' && !Array.isArray(pv) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
        deepMerge(target[k], pv);
      } else {
        target[k] = Array.isArray(pv) ? pv.slice() : pv;
      }
    });
    return target;
  }

  function matches(query, fields) {
    if (!query) return true;
    var q = String(query).toLowerCase();
    return fields.some(function (f) { return f && String(f).toLowerCase().indexOf(q) !== -1; });
  }

  function snippetAsItem(s) {
    return {
      id: s.id, kind: 'snippet', text: s.bodyEn, preview: firstLine(s.bodyEn), sourceApp: 'Lasq',
      createdAt: s.updatedAt, pinned: false, name: s.name, trigger: s.trigger, folder: s.folder
    };
  }

  function byNewest(a, b) { return b.createdAt - a.createdAt; }

  function findIndex(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  // ---------- The mock bridge ----------
  var lasq = {
    ready: function () {
      return delay({
        lang: settings.lang,
        dir: settings.lang === 'ar' ? 'rtl' : 'ltr',
        settings: clone(settings),
        platform: 'browser-mock',
        version: '0.1.0-mock',
        transforms: clone(transforms)
      });
    },

    search: function (opts) {
      opts = opts || {};
      var query = opts.query || '';
      var limit = opts.limit || 50;
      var out;
      if (opts.tab === 'snippets') {
        out = snippets.filter(function (s) { return matches(query, [s.name, s.trigger, s.bodyEn, s.bodyAr, s.folder]); })
          .map(snippetAsItem);
      } else {
        out = history.filter(function (h) {
          if (opts.tab === 'pinned' && !h.pinned) return false;
          return matches(query, [h.text, h.preview, h.sourceApp, (h.files || []).join('\n')]);
        }).sort(byNewest);
      }
      return delay(clone(out.slice(0, limit)));
    },

    paste: function (opts) {
      console.log('[lasq mock] paste', opts);
      var s = snippets[findIndex(snippets, opts.id)];
      if (s) { s.useCount++; }
      return delay(undefined);
    },

    pin: function (opts) {
      var i = findIndex(history, opts.id);
      if (i !== -1) { history[i].pinned = !!opts.pinned; changed('history'); }
      return delay(undefined);
    },

    remove: function (opts) {
      var i = findIndex(history, opts.id);
      if (i !== -1) { history.splice(i, 1); changed('history'); }
      i = findIndex(notes, opts.id);
      if (i !== -1) { notes.splice(i, 1); changed('notes'); }
      return delay(undefined);
    },

    hidePanel: function () { console.log('[lasq mock] hidePanel'); },

    quickCapture: function (opts) {
      var text = String(opts.text || '').trim();
      if (text) {
        notes.unshift({ id: uid('n'), text: text, createdAt: Date.now() });
        changed('notes');
      }
      if (opts.asSnippet) {
        console.log('[lasq mock] quickCapture → open library with snippet draft');
        emit('library:section', { section: 'snippets', snippetDraft: { name: firstLine(text).slice(0, 40), bodyEn: text } });
      }
      return delay(undefined);
    },

    submitForm: function (opts) { console.log('[lasq mock] submitForm', opts); },
    cancelForm: function () { console.log('[lasq mock] cancelForm'); },

    listTransforms: function () { return delay(clone(transforms)); },

    getSnippets: function () {
      return delay(clone(snippets.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })));
    },

    saveSnippet: function (snippet) {
      var trigger = String(snippet.trigger || '');
      var taken = trigger && snippets.some(function (s) { return s.trigger === trigger && s.id !== snippet.id; });
      if (taken) return Promise.reject({ code: 'trigger-taken' });
      var saved = {
        id: snippet.id || uid('s'),
        name: String(snippet.name || ''),
        trigger: trigger,
        folder: String(snippet.folder || ''),
        bodyEn: String(snippet.bodyEn || ''),
        bodyAr: String(snippet.bodyAr || ''),
        appsAllow: (snippet.appsAllow || []).slice(),
        appsDeny: (snippet.appsDeny || []).slice(),
        useCount: snippet.useCount || 0,
        updatedAt: Date.now()
      };
      var i = findIndex(snippets, saved.id);
      if (i === -1) snippets.unshift(saved); else snippets[i] = saved;
      changed('snippets');
      return delay(clone(saved));
    },

    deleteSnippet: function (opts) {
      var i = findIndex(snippets, opts.id);
      if (i !== -1) { snippets.splice(i, 1); changed('snippets'); }
      return delay(undefined);
    },

    getHistory: function (opts) {
      opts = opts || {};
      var filter = opts.filter || 'all';
      var out = history.filter(function (h) {
        if (filter === 'pinned' && !h.pinned) return false;
        if ((filter === 'text' || filter === 'image' || filter === 'files') && h.kind !== filter) return false;
        return matches(opts.query, [h.text, h.preview, h.sourceApp, (h.files || []).join('\n')]);
      }).sort(byNewest);
      var offset = opts.offset || 0;
      var limit = opts.limit || 200;
      return delay(clone(out.slice(offset, offset + limit)));
    },

    clearHistory: function (opts) {
      var days = (opts && opts.olderThanDays) || 0;
      var cutoff = Date.now() - days * DAY;
      history = history.filter(function (h) { return h.pinned || h.createdAt > cutoff; });
      changed('history');
      return delay(undefined);
    },

    getNotes: function () { return delay(clone(notes.slice().sort(byNewest))); },

    getSettings: function () { return delay(clone(settings)); },

    saveSettings: function (partial) {
      deepMerge(settings, partial || {});
      var copy = clone(settings);
      changed('settings');
      emit('settings:changed', clone(settings));
      return delay(copy);
    },

    exportData: function () {
      console.log('[lasq mock] exportData');
      return delay({ ok: true, path: 'C:\\Users\\Hani\\Documents\\lasq-backup.json' }, 300);
    },

    importData: function () {
      console.log('[lasq mock] importData');
      return delay({ ok: true, counts: { history: 0, snippets: 0, notes: 0 } }, 300);
    },

    openLibrary: function (section) {
      console.log('[lasq mock] openLibrary', section);
      emit('library:section', { section: section || 'history' });
    },

    on: function (channel, cb) {
      (listeners[channel] = listeners[channel] || []).push(cb);
      return function () {
        var arr = listeners[channel] || [];
        var i = arr.indexOf(cb);
        if (i !== -1) arr.splice(i, 1);
      };
    }
  };

  window.lasq = lasq;
  window.lasqMock = { emit: emit };
  console.info('[lasq] window.lasq mock installed – try lasqMock.emit("panel:mode", { mode: "capture", prefill: "Hello" })');
})();
