/* ==========================================================================
   Lasq – i18n (English / Arabic)
   window.LasqI18n = { lang, strings, setLang(lang), t(key, vars), applyTo(document) }
   Classic script (no modules) so the pages also work from file://.
   ========================================================================== */
(function () {
  'use strict';

  var EN = {
    // App
    'app.name': 'Lasq',
    'app.nameAr': 'لصق',
    'app.tagline': 'Clipboard history, snippets and text expansion',
    'panel.title': 'Lasq – paste panel',
    'library.title': 'Lasq – library',

    // Panel tabs
    'tab.history': 'History',
    'tab.pinned': 'Pinned',
    'tab.snippets': 'Snippets',

    // Search
    'search.placeholder': 'Search history, pinned and snippets…',
    'search.history': 'Search history…',
    'search.pinned': 'Search pinned items…',
    'search.snippets': 'Search snippets…',
    'search.notes': 'Search notes…',
    'search.transforms': 'Filter transforms…',

    // Key legends
    'legend.paste': 'Enter paste · Ctrl+Enter plain · Shift+Enter multi · Alt+Enter transform · Ctrl+P pin · Del delete · Esc close',
    'legend.capture': 'Enter save note · Ctrl+Enter save as snippet · Shift+Enter new line · Esc cancel',
    'legend.form': 'Enter insert · Tab next field · Esc cancel',
    'legend.transform': 'Enter apply · ↑ ↓ choose · Esc back',

    // Panel modes
    'capture.title': 'Quick note',
    'capture.placeholder': 'Type a note… Enter saves it, Ctrl+Enter saves it as a snippet',
    'form.title': 'Fill in',
    'form.choose': 'Choose…',
    'transform.title': 'Paste with transform',
    'transform.empty': 'No matching transform',

    // Actions
    'action.paste': 'Paste',
    'action.pastePlain': 'Paste as plain text',
    'action.pin': 'Pin',
    'action.unpin': 'Unpin',
    'action.delete': 'Delete',
    'action.copy': 'Copy',
    'action.copied': 'Copied to the clipboard',
    'action.save': 'Save',
    'action.saved': 'Saved',
    'action.cancel': 'Cancel',
    'action.test': 'Test it',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.clearHistory': 'Clear history',
    'action.newSnippet': 'New snippet',
    'action.makeSnippet': 'Make snippet',
    'action.close': 'Close',
    'action.insert': 'Insert',
    'action.clear': 'Clear',

    // Library navigation
    'nav.history': 'History',
    'nav.pinned': 'Pinned',
    'nav.snippets': 'Snippets',
    'nav.notes': 'Notes',
    'nav.settings': 'Settings',
    'nav.language': 'Language',
    'nav.sections': 'Sections',

    // Filters
    'filter.all': 'All',
    'filter.pinned': 'Pinned',
    'filter.text': 'Text',
    'filter.images': 'Images',
    'filter.files': 'Files',
    'filter.allFolders': 'All folders',
    'filter.noFolder': 'No folder',

    // Kinds
    'kind.text': 'Text',
    'kind.image': 'Image',
    'kind.files': 'Files',
    'kind.snippet': 'Snippet',

    // Metadata
    'meta.chars': '{n} chars',
    'meta.lines': '{n} lines',
    'meta.files': '{n} files',
    'meta.unknownApp': 'Unknown app',
    'meta.source': 'Source',
    'meta.copied': 'Copied',
    'meta.created': 'Created',
    'meta.updated': 'Updated',
    'meta.uses': 'Used {n} times',
    'meta.pinned': 'Pinned',
    'meta.image': 'Image',

    // Relative time
    'time.now': 'now',
    'time.min': 'min',
    'time.h': 'h',
    'time.d': 'd',

    // Snippet editor
    'snippet.new': 'New snippet',
    'snippet.name': 'Name',
    'snippet.namePlaceholder': 'e.g. Email signature',
    'snippet.trigger': 'Trigger',
    'snippet.triggerPlaceholder': 'e.g. ;sig',
    'snippet.folder': 'Folder',
    'snippet.folderPlaceholder': 'e.g. Work',
    'snippet.bodyEn': 'English body',
    'snippet.bodyAr': 'Arabic body',
    'snippet.bodyPlaceholder': 'Snippet text…',
    'snippet.bodyArHint': 'Leave empty to use the English body everywhere.',
    'snippet.appsAllow': 'Allowed apps',
    'snippet.appsDeny': 'Denied apps',
    'snippet.appsHint': 'Process names separated by commas, e.g. outlook.exe, winword.exe. Empty = all apps.',
    'snippet.placeholders': 'Placeholders',
    'snippet.preview': 'Preview',
    'snippet.triggerEmpty': 'Add a trigger so the snippet can expand while you type.',
    'snippet.triggerTaken': 'This trigger is already used by another snippet.',
    'snippet.nameRequired': 'A name is required.',
    'snippet.deleteConfirm': 'Delete this snippet?',
    'snippet.testCopied': 'English body copied to the clipboard – paste it anywhere to test.',
    'snippet.saveFailed': 'Could not save the snippet.',
    'snippet.unsaved': 'Unsaved changes',

    // Placeholder toolbar
    'ph.date': 'Date',
    'ph.time': 'Time',
    'ph.clipboard': 'Clipboard',
    'ph.cursor': 'Cursor',
    'ph.field': 'Field',
    'ph.choice': 'Choice',

    // Notes
    'note.deleteConfirm': 'Delete this note?',

    // Settings
    'settings.title': 'Settings',
    'settings.hotkeys': 'Hotkeys',
    'settings.hotkeys.hint': 'Electron accelerator syntax, e.g. CommandOrControl+Shift+V. Changes apply after the next restart if a hotkey is in use elsewhere.',
    'settings.hotkeys.panel': 'Open the paste panel',
    'settings.hotkeys.pastePlain': 'Paste the last item as plain text',
    'settings.hotkeys.capture': 'Quick capture',
    'settings.hotkeys.pause': 'Pause / resume capture',
    'settings.hotkeys.library': 'Open the library',
    'settings.capture': 'Capture',
    'settings.capture.text': 'Capture text',
    'settings.capture.images': 'Capture images',
    'settings.capture.files': 'Capture files',
    'settings.capture.maxTextKB': 'Max text size (KB)',
    'settings.capture.maxImageMB': 'Max image size (MB)',
    'settings.capture.retentionDays': 'Keep history for (days)',
    'settings.capture.maxItems': 'Max items',
    'settings.capture.excludedApps': 'Excluded apps',
    'settings.excludedApps.hint': 'One process name per line, e.g. keepass.exe',
    'settings.paste': 'Paste',
    'settings.paste.restoreClipboard': 'Restore the previous clipboard content after pasting',
    'settings.paste.restoreClipboardAfterMs': 'Restore after (ms)',
    'settings.expansion': 'Expansion',
    'settings.expansion.enabled': 'Enable text expansion',
    'settings.expansion.wordBoundary': 'Expand only at word boundaries',
    'settings.expansion.matchCase': 'Match case',
    'settings.expansion.sound': 'Play a sound on expansion',
    'settings.expansion.excludedApps': 'Excluded apps',
    'settings.privacy': 'Privacy',
    'settings.privacy.encrypt': 'Encrypt the history database',
    'settings.privacy.paused': 'Pause capture',
    'settings.appearance': 'Appearance & language',
    'settings.theme': 'Theme',
    'settings.theme.system': 'System',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.lang': 'Language',
    'settings.lang.en': 'English',
    'settings.lang.ar': 'Arabic',
    'settings.backup': 'Backup',
    'settings.backup.hint': 'Export everything to a JSON file, or import a previous export.',
    'settings.clearOlder': 'Clear history older than',
    'settings.days': 'days',
    'settings.clearConfirm': 'Delete unpinned history items older than {n} days?',
    'settings.clearAllConfirm': 'Delete all unpinned history items?',
    'settings.startup': 'Start with Windows',
    'settings.saved': 'Saved',
    'settings.exported': 'Exported to {path}',
    'settings.exportCancelled': 'Export cancelled',
    'settings.imported': 'Imported {history} items, {snippets} snippets and {notes} notes',
    'settings.importCancelled': 'Import cancelled',
    'settings.cleared': 'History cleared',

    // Empty states
    'empty.history': 'Nothing copied yet. Copy something and it will show up here.',
    'empty.pinned': 'No pinned items. Press Ctrl+P on an item to keep it here.',
    'empty.snippets': 'No snippets yet. Create one to expand text as you type.',
    'empty.notes': 'No notes yet. Use the quick-capture hotkey to jot one down.',
    'empty.search': 'No results for “{q}”.',
    'empty.select': 'Select an item to see it here.',
    'empty.selectSnippet': 'Select a snippet, or create a new one.',
    'empty.selectNote': 'Select a note to read it here.',

    // Accessibility labels
    'aria.search': 'Search',
    'aria.results': 'Results',
    'aria.preview': 'Preview',
    'aria.tabs': 'Lists',
    'aria.list': 'Items',
    'aria.detail': 'Details',
    'aria.langToggle': 'Interface language'
  };

  var AR = {
    'app.name': 'لصق',
    'app.nameAr': 'لصق',
    'app.tagline': 'سجل الحافظة والقصاصات وتوسيع النص',
    'panel.title': 'لصق – لوحة اللصق',
    'library.title': 'لصق – المكتبة',

    'tab.history': 'السجل',
    'tab.pinned': 'المثبّتة',
    'tab.snippets': 'القصاصات',

    'search.placeholder': 'ابحث في السجل والمثبّتة والقصاصات…',
    'search.history': 'ابحث في السجل…',
    'search.pinned': 'ابحث في العناصر المثبّتة…',
    'search.snippets': 'ابحث في القصاصات…',
    'search.notes': 'ابحث في الملاحظات…',
    'search.transforms': 'تصفية التحويلات…',

    'legend.paste': 'Enter لصق · Ctrl+Enter نص عادي · Shift+Enter لصق متعدد · Alt+Enter تحويل · Ctrl+P تثبيت · Del حذف · Esc إغلاق',
    'legend.capture': 'Enter حفظ الملاحظة · Ctrl+Enter حفظ كقصاصة · Shift+Enter سطر جديد · Esc إلغاء',
    'legend.form': 'Enter إدراج · Tab الحقل التالي · Esc إلغاء',
    'legend.transform': 'Enter تطبيق · ↑ ↓ اختيار · Esc رجوع',

    'capture.title': 'ملاحظة سريعة',
    'capture.placeholder': 'اكتب ملاحظة… Enter للحفظ، وCtrl+Enter للحفظ كقصاصة',
    'form.title': 'تعبئة الحقول',
    'form.choose': 'اختر…',
    'transform.title': 'لصق مع تحويل',
    'transform.empty': 'لا يوجد تحويل مطابق',

    'action.paste': 'لصق',
    'action.pastePlain': 'لصق كنص عادي',
    'action.pin': 'تثبيت',
    'action.unpin': 'إلغاء التثبيت',
    'action.delete': 'حذف',
    'action.copy': 'نسخ',
    'action.copied': 'تم النسخ إلى الحافظة',
    'action.save': 'حفظ',
    'action.saved': 'تم الحفظ',
    'action.cancel': 'إلغاء',
    'action.test': 'جرّبها',
    'action.export': 'تصدير',
    'action.import': 'استيراد',
    'action.clearHistory': 'مسح السجل',
    'action.newSnippet': 'قصاصة جديدة',
    'action.makeSnippet': 'تحويل إلى قصاصة',
    'action.close': 'إغلاق',
    'action.insert': 'إدراج',
    'action.clear': 'مسح',

    'nav.history': 'السجل',
    'nav.pinned': 'المثبّتة',
    'nav.snippets': 'القصاصات',
    'nav.notes': 'الملاحظات',
    'nav.settings': 'الإعدادات',
    'nav.language': 'اللغة',
    'nav.sections': 'الأقسام',

    'filter.all': 'الكل',
    'filter.pinned': 'المثبّتة',
    'filter.text': 'نصوص',
    'filter.images': 'صور',
    'filter.files': 'ملفات',
    'filter.allFolders': 'كل المجلدات',
    'filter.noFolder': 'بدون مجلد',

    'kind.text': 'نص',
    'kind.image': 'صورة',
    'kind.files': 'ملفات',
    'kind.snippet': 'قصاصة',

    'meta.chars': '{n} حرفًا',
    'meta.lines': '{n} أسطر',
    'meta.files': '{n} ملفات',
    'meta.unknownApp': 'تطبيق غير معروف',
    'meta.source': 'المصدر',
    'meta.copied': 'وقت النسخ',
    'meta.created': 'أُنشئت',
    'meta.updated': 'آخر تعديل',
    'meta.uses': 'استُخدمت {n} مرة',
    'meta.pinned': 'مثبّت',
    'meta.image': 'صورة',

    'time.now': 'الآن',
    'time.min': 'د',
    'time.h': 'س',
    'time.d': 'ي',

    'snippet.new': 'قصاصة جديدة',
    'snippet.name': 'الاسم',
    'snippet.namePlaceholder': 'مثل: توقيع البريد',
    'snippet.trigger': 'المحفّز',
    'snippet.triggerPlaceholder': 'مثل: ؛توق',
    'snippet.folder': 'المجلد',
    'snippet.folderPlaceholder': 'مثل: العمل',
    'snippet.bodyEn': 'النص الإنجليزي',
    'snippet.bodyAr': 'النص العربي',
    'snippet.bodyPlaceholder': 'نص القصاصة…',
    'snippet.bodyArHint': 'اتركه فارغًا لاستخدام النص الإنجليزي في كل مكان.',
    'snippet.appsAllow': 'التطبيقات المسموحة',
    'snippet.appsDeny': 'التطبيقات الممنوعة',
    'snippet.appsHint': 'أسماء العمليات مفصولة بفواصل، مثل outlook.exe, winword.exe. فارغ = كل التطبيقات.',
    'snippet.placeholders': 'العناصر النائبة',
    'snippet.preview': 'المعاينة',
    'snippet.triggerEmpty': 'أضف محفّزًا لتتوسّع القصاصة أثناء الكتابة.',
    'snippet.triggerTaken': 'هذا المحفّز مستخدم في قصاصة أخرى.',
    'snippet.nameRequired': 'الاسم مطلوب.',
    'snippet.deleteConfirm': 'هل تريد حذف هذه القصاصة؟',
    'snippet.testCopied': 'تم نسخ النص الإنجليزي إلى الحافظة – الصقه في أي مكان للتجربة.',
    'snippet.saveFailed': 'تعذّر حفظ القصاصة.',
    'snippet.unsaved': 'تغييرات غير محفوظة',

    'ph.date': 'التاريخ',
    'ph.time': 'الوقت',
    'ph.clipboard': 'الحافظة',
    'ph.cursor': 'المؤشر',
    'ph.field': 'حقل',
    'ph.choice': 'اختيار',

    'note.deleteConfirm': 'هل تريد حذف هذه الملاحظة؟',

    'settings.title': 'الإعدادات',
    'settings.hotkeys': 'الاختصارات',
    'settings.hotkeys.hint': 'بصيغة اختصارات Electron، مثل CommandOrControl+Shift+V. إذا كان الاختصار مستخدمًا في تطبيق آخر فسيُطبّق بعد إعادة التشغيل.',
    'settings.hotkeys.panel': 'فتح لوحة اللصق',
    'settings.hotkeys.pastePlain': 'لصق آخر عنصر كنص عادي',
    'settings.hotkeys.capture': 'التقاط سريع',
    'settings.hotkeys.pause': 'إيقاف الالتقاط مؤقتًا / استئنافه',
    'settings.hotkeys.library': 'فتح المكتبة',
    'settings.capture': 'الالتقاط',
    'settings.capture.text': 'التقاط النصوص',
    'settings.capture.images': 'التقاط الصور',
    'settings.capture.files': 'التقاط الملفات',
    'settings.capture.maxTextKB': 'الحد الأقصى لحجم النص (كيلوبايت)',
    'settings.capture.maxImageMB': 'الحد الأقصى لحجم الصورة (ميغابايت)',
    'settings.capture.retentionDays': 'الاحتفاظ بالسجل لمدة (أيام)',
    'settings.capture.maxItems': 'الحد الأقصى لعدد العناصر',
    'settings.capture.excludedApps': 'التطبيقات المستثناة',
    'settings.excludedApps.hint': 'اسم عملية واحد في كل سطر، مثل keepass.exe',
    'settings.paste': 'اللصق',
    'settings.paste.restoreClipboard': 'استعادة محتوى الحافظة السابق بعد اللصق',
    'settings.paste.restoreClipboardAfterMs': 'الاستعادة بعد (مللي ثانية)',
    'settings.expansion': 'التوسيع',
    'settings.expansion.enabled': 'تفعيل توسيع النص',
    'settings.expansion.wordBoundary': 'التوسيع عند حدود الكلمات فقط',
    'settings.expansion.matchCase': 'مطابقة حالة الأحرف',
    'settings.expansion.sound': 'تشغيل صوت عند التوسيع',
    'settings.expansion.excludedApps': 'التطبيقات المستثناة',
    'settings.privacy': 'الخصوصية',
    'settings.privacy.encrypt': 'تشفير قاعدة بيانات السجل',
    'settings.privacy.paused': 'إيقاف الالتقاط مؤقتًا',
    'settings.appearance': 'المظهر واللغة',
    'settings.theme': 'المظهر',
    'settings.theme.system': 'حسب النظام',
    'settings.theme.light': 'فاتح',
    'settings.theme.dark': 'داكن',
    'settings.lang': 'اللغة',
    'settings.lang.en': 'الإنجليزية',
    'settings.lang.ar': 'العربية',
    'settings.backup': 'النسخ الاحتياطي',
    'settings.backup.hint': 'صدّر كل شيء إلى ملف JSON، أو استورد نسخة سابقة.',
    'settings.clearOlder': 'مسح السجل الأقدم من',
    'settings.days': 'يومًا',
    'settings.clearConfirm': 'هل تريد حذف عناصر السجل غير المثبّتة الأقدم من {n} يومًا؟',
    'settings.clearAllConfirm': 'هل تريد حذف كل عناصر السجل غير المثبّتة؟',
    'settings.startup': 'التشغيل مع ويندوز',
    'settings.saved': 'تم الحفظ',
    'settings.exported': 'تم التصدير إلى {path}',
    'settings.exportCancelled': 'تم إلغاء التصدير',
    'settings.imported': 'تم استيراد {history} عنصرًا و{snippets} قصاصة و{notes} ملاحظة',
    'settings.importCancelled': 'تم إلغاء الاستيراد',
    'settings.cleared': 'تم مسح السجل',

    'empty.history': 'لم يُنسخ شيء بعد. انسخ أي شيء وسيظهر هنا.',
    'empty.pinned': 'لا توجد عناصر مثبّتة. اضغط Ctrl+P على أي عنصر لإبقائه هنا.',
    'empty.snippets': 'لا توجد قصاصات بعد. أنشئ واحدة لتوسيع النص أثناء الكتابة.',
    'empty.notes': 'لا توجد ملاحظات بعد. استخدم اختصار الالتقاط السريع لتدوين واحدة.',
    'empty.search': 'لا توجد نتائج لـ «{q}».',
    'empty.select': 'اختر عنصرًا لعرضه هنا.',
    'empty.selectSnippet': 'اختر قصاصة، أو أنشئ واحدة جديدة.',
    'empty.selectNote': 'اختر ملاحظة لقراءتها هنا.',

    'aria.search': 'بحث',
    'aria.results': 'النتائج',
    'aria.preview': 'المعاينة',
    'aria.tabs': 'القوائم',
    'aria.list': 'العناصر',
    'aria.detail': 'التفاصيل',
    'aria.langToggle': 'لغة الواجهة'
  };

  var strings = { en: EN, ar: AR };

  var api = {
    lang: 'en',
    strings: strings,

    /** Switch the active language ('en' | 'ar'); unknown values fall back to English. */
    setLang: function (lang) {
      api.lang = strings[lang] ? lang : 'en';
      return api.lang;
    },

    /** Look up a string and interpolate {name} variables. Unknown keys return the key itself. */
    t: function (key, vars) {
      var table = strings[api.lang] || EN;
      var value = table[key];
      if (value === undefined) value = EN[key];
      if (value === undefined) return key;
      if (!vars) return value;
      return value.replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
      });
    },

    /**
     * Apply the active language to a document: sets <html lang/dir> and fills
     * every element carrying data-i18n (textContent), data-i18n-placeholder,
     * data-i18n-title and data-i18n-aria-label.
     */
    applyTo: function (doc) {
      doc = doc || document;
      var root = doc.documentElement;
      root.lang = api.lang;
      root.dir = api.lang === 'ar' ? 'rtl' : 'ltr';

      var i, nodes;
      nodes = doc.querySelectorAll('[data-i18n]');
      for (i = 0; i < nodes.length; i++) nodes[i].textContent = api.t(nodes[i].getAttribute('data-i18n'));

      nodes = doc.querySelectorAll('[data-i18n-placeholder]');
      for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('placeholder', api.t(nodes[i].getAttribute('data-i18n-placeholder')));

      nodes = doc.querySelectorAll('[data-i18n-title]');
      for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('title', api.t(nodes[i].getAttribute('data-i18n-title')));

      nodes = doc.querySelectorAll('[data-i18n-aria-label]');
      for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('aria-label', api.t(nodes[i].getAttribute('data-i18n-aria-label')));
    }
  };

  window.LasqI18n = api;
})();
