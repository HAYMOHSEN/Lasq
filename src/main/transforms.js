'use strict';
// "Paste as…" transforms. Each entry: { id, labelEn, labelAr, fn(text) → text }.
// Pure functions, covered by test/transforms.test.js.

const arabic = require('./arabic');

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|vero_id|ref|ref_src)$/i;

function titleCase(text) {
  return String(text).replace(/\p{L}[\p{L}\p{M}']*/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function stripTrackingParams(text) {
  return String(text).replace(/https?:\/\/[^\s<>"')\]]+/g, (raw) => {
    const tail = (raw.match(/[.,;:!?]+$/) || [''])[0];
    const url = tail ? raw.slice(0, -tail.length) : raw;
    try {
      const u = new URL(url);
      const keep = [];
      for (const [k, v] of u.searchParams) if (!TRACKING_PARAMS.test(k)) keep.push([k, v]);
      u.search = '';
      for (const [k, v] of keep) u.searchParams.append(k, v);
      return u.toString().replace(/\/$/, url.endsWith('/') ? '/' : '') + tail;
    } catch {
      return raw;
    }
  });
}

function markdownToPlain(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/g, ''))
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1');
}

function jsonPretty(text) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return String(text); }
}

function jsonMinify(text) {
  try { return JSON.stringify(JSON.parse(text)); } catch { return String(text); }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

const TRANSFORMS = [
  { id: 'plain', labelEn: 'Plain text (no formatting)', labelAr: 'نص عادي بلا تنسيق', fn: (t) => String(t) },
  { id: 'upper', labelEn: 'UPPERCASE', labelAr: 'حروف كبيرة', fn: (t) => String(t).toUpperCase() },
  { id: 'lower', labelEn: 'lowercase', labelAr: 'حروف صغيرة', fn: (t) => String(t).toLowerCase() },
  { id: 'title', labelEn: 'Title Case', labelAr: 'أول حرف كبير لكل كلمة', fn: titleCase },
  { id: 'trim', labelEn: 'Trim spaces', labelAr: 'إزالة المسافات الزائدة', fn: (t) => String(t).replace(/[ \t]+/g, ' ').replace(/^ +| +$/gm, '').trim() },
  { id: 'joinLines', labelEn: 'Join lines into one', labelAr: 'دمج الأسطر في سطر واحد', fn: (t) => String(t).replace(/\s*\r?\n\s*/g, ' ').trim() },
  { id: 'removeBlankLines', labelEn: 'Remove blank lines', labelAr: 'حذف الأسطر الفارغة', fn: (t) => String(t).split(/\r?\n/).filter((l) => l.trim()).join('\n') },
  { id: 'fixLayout', labelEn: 'Fix wrong keyboard layout (auto)', labelAr: 'تصحيح لغة لوحة المفاتيح (تلقائي)', fn: (t) => arabic.fixLayout(t, 'auto') },
  { id: 'fixLayoutEnToAr', labelEn: 'Typed English → meant Arabic', labelAr: 'كُتب بالإنجليزية والمقصود عربي', fn: (t) => arabic.fixLayout(t, 'en2ar') },
  { id: 'fixLayoutArToEn', labelEn: 'Typed Arabic → meant English', labelAr: 'كُتب بالعربية والمقصود إنجليزي', fn: (t) => arabic.fixLayout(t, 'ar2en') },
  { id: 'digitsWestern', labelEn: 'Arabic-Indic digits → 0-9', labelAr: 'أرقام هندية ← إنجليزية 0-9', fn: arabic.toWesternDigits },
  { id: 'digitsArabic', labelEn: '0-9 → Arabic-Indic digits', labelAr: 'أرقام إنجليزية ← هندية ٠-٩', fn: arabic.toArabicIndicDigits },
  { id: 'removeDiacritics', labelEn: 'Remove Arabic diacritics', labelAr: 'إزالة التشكيل', fn: arabic.removeDiacritics },
  { id: 'jsonPretty', labelEn: 'JSON: pretty-print', labelAr: 'JSON: تنسيق مقروء', fn: jsonPretty },
  { id: 'jsonMinify', labelEn: 'JSON: minify', labelAr: 'JSON: سطر واحد', fn: jsonMinify },
  { id: 'markdownToPlain', labelEn: 'Markdown → plain text', labelAr: 'Markdown ← نص عادي', fn: markdownToPlain },
  { id: 'extractEmails', labelEn: 'Extract email addresses', labelAr: 'استخراج عناوين البريد', fn: (t) => Array.from(new Set(String(t).match(EMAIL_RE) || [])).join('\n') },
  { id: 'extractUrls', labelEn: 'Extract links', labelAr: 'استخراج الروابط', fn: (t) => Array.from(new Set((String(t).match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, '')))).join('\n') },
  { id: 'stripTracking', labelEn: 'Strip tracking parameters from links', labelAr: 'إزالة معاملات التتبع من الروابط', fn: stripTrackingParams },
];

const BY_ID = new Map(TRANSFORMS.map((t) => [t.id, t]));

function listTransforms() {
  return TRANSFORMS.map(({ id, labelEn, labelAr }) => ({ id, labelEn, labelAr }));
}

function applyTransform(id, text) {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`Unknown transform: ${id}`);
  return t.fn(text);
}

module.exports = { TRANSFORMS, listTransforms, applyTransform, titleCase, stripTrackingParams, markdownToPlain };
