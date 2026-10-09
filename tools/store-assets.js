'use strict';
// Builds the Microsoft Store asset folder: UI screenshots (EN + AR) composed onto 1920×1080
// frames, Store logos (300×300 tile, 720×1080 poster, 1920×1080 hero) and listing texts.
// Runs the real renderer pages in headless Chromium with neutral demo data (window.LASQ_DEMO).
//   node tools/store-assets.js [outDir]

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RENDERER = path.join(ROOT, 'src', 'renderer');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'Lasq-Store-Assets'));
const RAW = path.join(OUT, '_raw');

const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

// Neutral demo content shown in the screenshots (no personal data).
const DEMO = {
  history: [
    { text: 'Dear Dr. Ahmad,\n\nThank you for your email about the lab schedule. I confirm the room booking for Monday at 10:00.\n\nBest regards', sourceApp: 'Outlook', ago: 1 * MIN },
    { text: 'شكراً لتواصلكم، سنرد عليكم خلال يوم عمل واحد.', sourceApp: 'Teams', ago: 4 * MIN, pinned: true },
    { text: 'https://example.org/reports/annual-report-2026.pdf', sourceApp: 'Chrome', ago: 9 * MIN },
    { kind: 'image', text: '', preview: 'Screenshot 1280×720', sourceApp: 'Snipping Tool', ago: 14 * MIN, imageDataUrl: 'IMG' },
    { text: 'Order number: 2026-10-00418', sourceApp: 'Chrome', ago: 25 * MIN },
    { text: 'اجتماع القسم يوم الثلاثاء الساعة العاشرة صباحاً في قاعة الاجتماعات.', sourceApp: 'WhatsApp', ago: 40 * MIN },
    { text: 'Meeting moved to Thursday, same time.', sourceApp: 'Teams', ago: 1 * HOUR },
    { kind: 'files', text: 'C:\\Users\\Lina\\Documents\\budget-2026.xlsx\nC:\\Users\\Lina\\Documents\\invoice-0418.pdf', preview: 'budget-2026.xlsx, invoice-0418.pdf', sourceApp: 'Explorer', ago: 2 * HOUR, files: ['C:\\Users\\Lina\\Documents\\budget-2026.xlsx', 'C:\\Users\\Lina\\Documents\\invoice-0418.pdf'] },
    { text: 'const panel = createPanel({ width: 640, height: 420 });', sourceApp: 'VS Code', ago: 3 * HOUR },
    { text: 'The quick brown fox jumps over the lazy dog.', sourceApp: 'Notepad', ago: 5 * HOUR, pinned: true },
    { text: 'تم تحديث الجدول، يرجى مراجعة التوزيع الجديد قبل نهاية الأسبوع.', sourceApp: 'Outlook', ago: 1 * DAY },
    { text: '0795 123 456', sourceApp: 'Phone Link', ago: 2 * DAY },
  ],
  snippets: [
    { name: 'Signature', trigger: ';sig', folder: 'Email', bodyEn: 'Best regards,\nLina Haddad\nCustomer Success Manager\nNorthwind Trading', bodyAr: 'مع أطيب التحيات،\nلينا حداد\nمديرة نجاح العملاء\nشركة نورثويند التجارية', useCount: 128 },
    { name: 'Thanks, will reply', trigger: ';thx', folder: 'Email', bodyEn: 'Thank you for your message. I will get back to you within one business day.', bodyAr: 'شكراً لتواصلكم، سنرد عليكم خلال يوم عمل واحد.', useCount: 86 },
    { name: 'Meeting invite', trigger: ';meet', folder: 'Email', bodyEn: 'Dear {{field:Name}},\n\nCould we meet on {{field:Day}} at {{field:Time}}? {{cursor}}\n\nBest regards', bodyAr: 'عزيزي {{field:الاسم}}،\n\nهل يمكننا الاجتماع يوم {{field:اليوم}} الساعة {{field:الوقت}}؟ {{cursor}}\n\nمع التحية', useCount: 41 },
    { name: 'Today', trigger: ';today', folder: 'Dates', bodyEn: '{{date:dd/mm/yyyy}}', bodyAr: '{{date:dd/mm/yyyy}}', useCount: 210 },
    { name: 'Office hours', trigger: ';oh', folder: 'Work', bodyEn: 'Office hours: {{choice:Sunday|Tuesday|Thursday}} 11:00–13:00, building C, room 214.', bodyAr: 'الساعات المكتبية: {{choice:الأحد|الثلاثاء|الخميس}} من 11:00 إلى 13:00، مبنى C، غرفة 214.', useCount: 17 },
    { name: 'Address', trigger: ';addr', folder: 'Work', bodyEn: 'Northwind Trading, 12 King Hussein St., Amman 11118, Jordan', bodyAr: 'شركة نورثويند التجارية، شارع الملك حسين 12، عمّان 11118، الأردن', useCount: 33 },
  ],
  notes: [
    { text: 'Call the supplier about the October delivery.', ago: 30 * MIN },
    { text: 'فكرة: قصاصة جاهزة لرد تأكيد الحجز.', ago: 5 * HOUR },
    { text: 'Renew the domain before 1 November.', ago: 2 * DAY },
  ],
  transforms: [
    { id: 'plain', labelEn: 'Plain text (no formatting)', labelAr: 'نص عادي بلا تنسيق' },
    { id: 'upper', labelEn: 'UPPERCASE', labelAr: 'حروف كبيرة' },
    { id: 'lower', labelEn: 'lowercase', labelAr: 'حروف صغيرة' },
    { id: 'title', labelEn: 'Title Case', labelAr: 'أول حرف كبير لكل كلمة' },
    { id: 'trim', labelEn: 'Trim spaces', labelAr: 'إزالة المسافات الزائدة' },
    { id: 'joinLines', labelEn: 'Join lines into one', labelAr: 'دمج الأسطر في سطر واحد' },
    { id: 'fixLayout', labelEn: 'Fix wrong keyboard layout (auto)', labelAr: 'تصحيح لغة لوحة المفاتيح (تلقائي)' },
    { id: 'digitsWestern', labelEn: 'Arabic-Indic digits → 0-9', labelAr: 'أرقام هندية ← إنجليزية 0-9' },
    { id: 'digitsArabic', labelEn: '0-9 → Arabic-Indic digits', labelAr: 'أرقام إنجليزية ← هندية ٠-٩' },
    { id: 'removeDiacritics', labelEn: 'Remove Arabic diacritics', labelAr: 'إزالة التشكيل' },
    { id: 'jsonPretty', labelEn: 'JSON: pretty-print', labelAr: 'JSON: تنسيق مقروء' },
    { id: 'extractUrls', labelEn: 'Extract links', labelAr: 'استخراج الروابط' },
    { id: 'stripTracking', labelEn: 'Strip tracking parameters from links', labelAr: 'إزالة معاملات التتبع من الروابط' },
  ],
};

// A small "screenshot" image for the image history item (SVG → data URL).
const IMG_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='320' height='180' fill='#dfe9f5'/><rect x='24' y='24' width='272' height='26' rx='6' fill='#0067C0'/><rect x='24' y='66' width='180' height='12' rx='6' fill='#9db6d3'/><rect x='24' y='90' width='230' height='12' rx='6' fill='#9db6d3'/><rect x='24' y='114' width='140' height='12' rx='6' fill='#9db6d3'/><circle cx='262' cy='124' r='28' fill='#ffc400'/></svg>`;
DEMO.history.forEach((h) => { if (h.imageDataUrl === 'IMG') h.imageDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(IMG_SVG); });

const CAPTIONS = {
  en: {
    panel: ['Everything you copy, one keystroke away', 'Ctrl+Shift+V opens the panel where you type. Search, press Enter, done.'],
    transforms: ['Clean up text while you paste', 'Alt+Enter: plain text, fix a wrong keyboard layout, convert digits, tidy JSON and links.'],
    form: ['Snippets that ask for the details', 'Fill-in fields and choices appear right at the caret; Enter inserts the finished text.'],
    snippets: ['Type ;sig anywhere — your full text appears', 'One snippet, English and Arabic versions, chosen by the keyboard you are typing with.'],
    history: ['Unlimited history, searchable in both languages', 'Text, images and files, with the app they came from. Pin what you reuse.'],
    settings: ['Private by design', 'Works offline. Honors password managers. Optional encryption. Pause with one shortcut.'],
  },
  ar: {
    panel: ['كل ما نسخته على بُعد ضغطة واحدة', 'Ctrl+Shift+V يفتح اللوحة في مكان الكتابة. ابحث، اضغط Enter، انتهى.'],
    transforms: ['نظّف النص أثناء اللصق', 'Alt+Enter: نص عادي، تصحيح لغة لوحة المفاتيح، تحويل الأرقام، تنسيق JSON والروابط.'],
    form: ['قصاصات تسألك عن التفاصيل', 'حقول وخيارات تظهر عند المؤشر مباشرة؛ Enter يُدرج النص الجاهز.'],
    snippets: ['اكتب ؛توق في أي مكان فيظهر نصك كاملاً', 'قصاصة واحدة بنسختين عربية وإنجليزية تُختار حسب لوحة المفاتيح التي تكتب بها.'],
    history: ['سجل لا محدود يبحث بالعربية والإنجليزية', 'نصوص وصور وملفات مع البرنامج الذي جاءت منه. ثبّت ما تعيد استخدامه.'],
    settings: ['خصوصية بالتصميم', 'يعمل بلا إنترنت. يحترم مديرات كلمات المرور. تشفير اختياري. إيقاف بضغطة.'],
  },
};

const FORM_FIELDS = {
  en: { snippetName: 'Meeting invite', fields: [{ name: 'Name', type: 'text' }, { name: 'Day', type: 'choice', options: ['Sunday', 'Tuesday', 'Thursday'] }, { name: 'Time', type: 'text' }] },
  ar: { snippetName: 'دعوة اجتماع', fields: [{ name: 'الاسم', type: 'text' }, { name: 'اليوم', type: 'choice', options: ['الأحد', 'الثلاثاء', 'الخميس'] }, { name: 'الوقت', type: 'text' }] },
};

function fileUrl(p) { return 'file://' + p; }
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }

async function newPage(browser, { width, height, scale = 2, lang }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'light' });
  await ctx.addInitScript((demo) => { window.LASQ_DEMO = demo; }, { ...DEMO, settings: { lang, hotkeys: { panel: 'Control+Shift+V', pastePlain: 'Control+Alt+V', capture: 'Control+Shift+N', pause: 'Control+Alt+P', library: 'Control+Shift+L' }, capture: { text: true, images: true, files: true, maxTextKB: 1024, maxImageMB: 20, retentionDays: 90, maxItems: 10000, excludedApps: ['keepass.exe', 'keepassxc.exe', '1password.exe', 'bitwarden.exe'] } } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  return { ctx, page };
}

async function settle(page, ms = 250) { await page.waitForTimeout(ms); }

async function shootPanel(browser, lang) {
  const shots = {};
  const { ctx, page } = await newPage(browser, { width: 640, height: 420, lang });
  await page.goto(fileUrl(path.join(RENDERER, 'panel.html')));
  await page.waitForSelector('#results li');
  await settle(page);
  shots.panel = path.join(RAW, `panel-${lang}.png`);
  await page.screenshot({ path: shots.panel });

  // Transform picker
  await page.keyboard.press('Alt+Enter');
  await settle(page);
  shots.transforms = path.join(RAW, `transforms-${lang}.png`);
  await page.screenshot({ path: shots.transforms });
  await page.keyboard.press('Escape');
  await settle(page, 100);

  // Fill-in form
  await page.evaluate((f) => window.lasqMock.emit('panel:mode', { mode: 'form', ...f }), FORM_FIELDS[lang]);
  await settle(page);
  await page.evaluate((lang) => {
    const inputs = document.querySelectorAll('#form-fields input, #form-fields select');
    const values = lang === 'ar' ? ['د. أحمد', null, '10:00'] : ['Dr. Ahmad', null, '10:00'];
    inputs.forEach((el, i) => { if (values[i] != null && el.tagName === 'INPUT') el.value = values[i]; });
  }, lang);
  await settle(page, 100);
  shots.form = path.join(RAW, `form-${lang}.png`);
  await page.screenshot({ path: shots.form });
  await ctx.close();
  return shots;
}

async function shootLibrary(browser, lang) {
  const shots = {};
  const { ctx, page } = await newPage(browser, { width: 1100, height: 720, lang });
  await page.goto(fileUrl(path.join(RENDERER, 'library.html')));
  await page.waitForSelector('#list .list-item');
  await settle(page);

  // History with the first item selected
  await page.click('#list .list-item >> nth=0');
  await settle(page);
  shots.history = path.join(RAW, `library-history-${lang}.png`);
  await page.screenshot({ path: shots.history });

  // Snippets: open the "Meeting invite" snippet in the editor, Arabic tab when lang = ar
  await page.click('.nav-item[data-section="snippets"]');
  await page.waitForSelector('#list .list-item');
  await settle(page);
  const rows = await page.$$('#list .list-item');
  let target = rows[0];
  for (const r of rows) { const t = await r.innerText(); if (/Meeting invite|;meet/.test(t)) { target = r; break; } }
  await target.click();
  await settle(page);
  if (lang === 'ar') {
    const arTab = await page.$('[data-body="ar"], [data-lang-tab="ar"], button:has-text("النص العربي")');
    if (arTab) { await arTab.click(); await settle(page, 150); }
  }
  shots.snippets = path.join(RAW, `library-snippets-${lang}.png`);
  await page.screenshot({ path: shots.snippets });

  // Settings
  await page.click('.nav-item[data-section="settings"]');
  await settle(page);
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('.settings-card h2')).find((x) => /privacy|الخصوصية/i.test(x.textContent));
    if (h) h.closest('.settings-card').scrollIntoView({ block: 'start' });
  });
  await settle(page, 150);
  shots.settings = path.join(RAW, `library-settings-${lang}.png`);
  await page.screenshot({ path: shots.settings });
  await ctx.close();
  return shots;
}

// ------------------------------------------------------------------ composites

const FONT_CSS = `
  @font-face { font-family: 'Noto Sans'; src: local('Noto Sans'); }
  body { margin: 0; font-family: 'Noto Sans', 'Noto Sans Arabic', 'Segoe UI', sans-serif; }
  [dir=rtl] { font-family: 'Noto Sans Arabic', 'Noto Sans', sans-serif; }
`;

function frameHtml({ lang, title, subtitle, imgPath, imgWidth, kind }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const img = 'data:image/png;base64,' + fs.readFileSync(imgPath).toString('base64');
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'icon.png')).toString('base64');
  const panelLike = kind === 'panel';
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><style>
    ${FONT_CSS}
    html, body { width: 1920px; height: 1080px; overflow: hidden; }
    body { background: linear-gradient(135deg, #e8f1fb 0%, #f7f9fc 55%, #dbe8f7 100%); color: #1b1b1b; position: relative; }
    .head { position: absolute; top: 72px; left: 120px; right: 120px; display: flex; align-items: center; gap: 28px; }
    .logo { width: 72px; height: 72px; border-radius: 16px; flex: none; box-shadow: 0 8px 24px rgba(0,60,120,.18); }
    h1 { margin: 0; font-size: 54px; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; }
    p { margin: 10px 0 0; font-size: 28px; line-height: 1.4; color: #3d4a5c; }
    .stage { position: absolute; left: 0; right: 0; top: 270px; bottom: 0; display: flex; justify-content: center; align-items: flex-start; }
    .doc { position: absolute; top: 276px; left: 50%; transform: translateX(-50%); width: 1180px; height: 820px; background: #fff; border-radius: 14px 14px 0 0; box-shadow: 0 10px 40px rgba(0,40,90,.12); padding: 56px 72px; box-sizing: border-box; }
    .doc .bar { height: 14px; border-radius: 7px; background: #e6ebf1; margin: 0 0 22px; }
    .doc .bar.w1 { width: 62%; background: #d9e3ee; height: 20px; }
    .doc .bar.w2 { width: 92%; } .doc .bar.w3 { width: 84%; } .doc .bar.w4 { width: 70%; } .doc .bar.w5 { width: 88%; } .doc .bar.w6 { width: 40%; }
    .shot { position: absolute; width: ${imgWidth}px; border-radius: ${panelLike ? 14 : 10}px; box-shadow: 0 30px 80px rgba(0,30,70,.28), 0 2px 6px rgba(0,0,0,.08); background: #fff; }
    .shot.panel { top: 396px; left: 50%; transform: translateX(-50%); }
    .shot.window { top: 268px; left: 50%; transform: translateX(-50%); }
    .caret { position: absolute; top: 364px; left: 50%; margin-left: ${dir === 'rtl' ? 228 : -232}px; width: 3px; height: 30px; background: #0067C0; }
  </style></head><body>
    <div class="head"><img class="logo" src="${logo}" alt=""><div><h1>${title}</h1><p>${subtitle}</p></div></div>
    ${panelLike ? '<div class="doc"><div class="bar w1"></div><div class="bar w2"></div><div class="bar w3"></div><div class="bar w4"></div><div class="bar w5"></div><div class="bar w6"></div></div><div class="caret"></div>' : ''}
    <img class="shot ${panelLike ? 'panel' : 'window'}" src="${img}" alt="">
  </body></html>`;
}

async function compose(browser, html, outPath, { width = 1920, height = 1080 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: outPath, type: 'png' });
  await ctx.close();
}

function logoHtml(kind) {
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'icon.png')).toString('base64');
  if (kind === 'tile') {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS} html,body{width:300px;height:300px;overflow:hidden} body{background:#0067C0;display:grid;place-items:center} img{width:300px;height:300px}</style></head><body><img src="${logo}"></body></html>`;
  }
  if (kind === 'poster') {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS} html,body{width:720px;height:1080px;overflow:hidden} body{background:linear-gradient(160deg,#0a4f93 0%,#0067C0 55%,#2b8fe0 100%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center}
      img{width:300px;height:300px;border-radius:64px;box-shadow:0 30px 70px rgba(0,0,0,.35)} h1{margin:24px 0 0;font-size:96px;font-weight:700;letter-spacing:-.02em} .ar{font-family:'Noto Sans Arabic';font-size:64px;font-weight:600;opacity:.95} p{margin:0 60px;font-size:30px;line-height:1.4;opacity:.92}</style></head>
      <body><img src="${logo}"><h1>Lasq</h1><div class="ar">لصق</div><p>Clipboard history, snippets &amp; text expansion<br>for Windows — offline, English &amp; Arabic</p></body></html>`;
  }
  // hero 1920×1080
  const shot = fs.existsSync(path.join(RAW, 'panel-en.png')) ? 'data:image/png;base64,' + fs.readFileSync(path.join(RAW, 'panel-en.png')).toString('base64') : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS} html,body{width:1920px;height:1080px;overflow:hidden} body{background:linear-gradient(135deg,#0a4f93 0%,#0067C0 50%,#2b8fe0 100%);color:#fff;position:relative}
    .left{position:absolute;left:140px;top:0;bottom:0;width:760px;display:flex;flex-direction:column;justify-content:center;gap:22px} img.logo{width:140px;height:140px;border-radius:32px;box-shadow:0 20px 60px rgba(0,0,0,.3)} h1{margin:0;font-size:108px;font-weight:700;letter-spacing:-.02em;line-height:1} .ar{font-family:'Noto Sans Arabic';font-size:60px;font-weight:600} p{margin:0;font-size:34px;line-height:1.4;opacity:.95}
    .shot{position:absolute;right:120px;top:50%;transform:translateY(-50%);width:880px;border-radius:18px;box-shadow:0 40px 100px rgba(0,0,0,.4)}</style></head>
    <body><div class="left"><img class="logo" src="${logo}"><h1>Lasq</h1><div class="ar">لصق</div><p>Unlimited clipboard history, snippets and text expansion for Windows.<br>Fully offline. English and Arabic.</p></div>${shot ? `<img class="shot" src="${shot}">` : ''}</body></html>`;
}

async function main() {
  ensure(OUT); ensure(RAW);
  const browser = await chromium.launch();
  const raw = {};
  for (const lang of ['en', 'ar']) {
    raw[lang] = { ...(await shootPanel(browser, lang)), ...(await shootLibrary(browser, lang)) };
    console.log(`raw UI screenshots (${lang}) done`);
  }

  const order = [
    ['panel', 'panel', 960], ['snippets', 'window', 1180], ['history', 'window', 1180],
    ['transforms', 'panel', 960], ['form', 'panel', 960], ['settings', 'window', 1180],
  ];
  for (const lang of ['en', 'ar']) {
    const dir = ensure(path.join(OUT, 'screenshots', lang === 'en' ? 'en-US' : 'ar-SA'));
    let n = 0;
    for (const [key, kind, w] of order) {
      n++;
      const [title, subtitle] = CAPTIONS[lang][key];
      const out = path.join(dir, `${String(n).padStart(2, '0')}-${key}.png`);
      await compose(browser, frameHtml({ lang, title, subtitle, imgPath: raw[lang][key], imgWidth: w, kind }), out);
      console.log('wrote', path.relative(OUT, out));
    }
  }

  const logos = ensure(path.join(OUT, 'logos'));
  await compose(browser, logoHtml('tile'), path.join(logos, 'app-tile-icon-300x300.png'), { width: 300, height: 300 });
  await compose(browser, logoHtml('poster'), path.join(logos, 'poster-art-720x1080.png'), { width: 720, height: 1080 });
  await compose(browser, logoHtml('hero'), path.join(logos, 'super-hero-art-1920x1080.png'), { width: 1920, height: 1080 });
  console.log('logos done');
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
