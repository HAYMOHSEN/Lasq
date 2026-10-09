# Lasq (لصق)

سجل حافظة لا محدود قابل للبحث + قصاصات + توسيع نصي لويندوز — يعمل بلا إنترنت، بالعربية والإنجليزية.

الدليل الكامل خطوة بخطوة (التثبيت، الاختبار، التغليف، النشر) في مستند «Lasq — دليل البناء خطوة بخطوة».

## الأوامر الأساسية

| الأمر | ماذا يفعل |
| --- | --- |
| `npm install` | تنزيل الحزم (مرة واحدة، وبعد كل تعديل على package.json) |
| `npm test` | اختبارات الوحدات النقية (تعمل على أي نظام) |
| `npm start` | تشغيل البرنامج من المصدر (تظهر أيقونة في شريط المهام) |
| `npm run dist:exe` | مثبّت تجريبي `.exe` في مجلد `dist` |
| `npm run dist` | حزمة المتجر `.appx` لمعماريتي x64 وARM64 في مجلد `dist` |

## أين الأشياء

| المسار | المحتوى |
| --- | --- |
| `src/main/main.js` | نقطة البداية: الأيقونة، النوافذ، الاختصارات، IPC |
| `src/main/capture.js` | مراقبة الحافظة وتحويل ما يُنسخ إلى عناصر |
| `src/main/expansion.js` | خطّاف لوحة المفاتيح ومطابقة المحفّزات |
| `src/main/inject.js` | اللصق في البرامج الأخرى (Ctrl+V أو كتابة Unicode) |
| `src/main/win32.js` | دوال Win32 عبر koffi (ToUnicodeEx، SendInput، الحافظة…) |
| `src/main/store.js` | التخزين في ملفات JSON والبحث |
| `src/main/arabic.js` | تطبيع العربية، الأرقام، مصحّح لغة لوحة المفاتيح |
| `src/main/transforms.js` | قائمة «لصق كـ…» |
| `src/main/placeholders.js` | `{{date}}` `{{field:…}}` `{{cursor}}` … |
| `src/preload.js` | الجسر بين الواجهة والعملية الرئيسية (`window.lasq`) |
| `src/renderer/` | الواجهة: `panel.html` لوحة اللصق، `library.html` المكتبة |
| `docs/RENDERER-API.md` | عقد الواجهة: كل دالة وحدث |
| `electron-builder.yml` | إعدادات حزمة المتجر (ضع هوية Partner Center هنا) |

## أين تُحفظ البيانات أثناء التشغيل

`%APPDATA%\Lasq\data\` — ملفات `history.json` و`snippets.json` و`notes.json` و`settings.json` ومجلد `media` للصور، و`%APPDATA%\Lasq\lasq.log` للسجل.
