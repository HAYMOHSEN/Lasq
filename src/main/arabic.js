'use strict';
// Arabic text helpers used by search, transforms and trigger matching.
// Pure functions, no Electron dependency, covered by test/arabic.test.js.

// Harakat, tanwin, shadda, sukun, superscript alef, Quranic marks and tatweel (kashida).
const TASHKEEL_RE = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const ARABIC_LETTER_RE = /[ء-يٮ-ۓ]/;
const LATIN_LETTER_RE = /[A-Za-z]/;

/** Remove diacritics (tashkeel) and tatweel. */
function removeDiacritics(s) {
  return String(s || '').replace(TASHKEEL_RE, '');
}

/** Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits → 0-9. */
function toWesternDigits(s) {
  return String(s || '').replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

/** 0-9 → Arabic-Indic digits (٠-٩). */
function toArabicIndicDigits(s) {
  return String(s || '').replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}

/**
 * Normalize Arabic for lenient matching: unify alef forms, taa marbuta → haa,
 * alef maqsura → yaa, drop tashkeel and tatweel.
 */
function normalizeArabic(s) {
  return removeDiacritics(s)
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/ى/g, 'ي'); // ى → ي
}

/** Full search normalization: lowercase, Arabic normalization, western digits, collapsed whitespace. */
function normalizeForSearch(s) {
  return toWesternDigits(normalizeArabic(String(s || '').toLowerCase()))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a query into normalized tokens; every token must appear in the target. */
function tokenize(query) {
  return normalizeForSearch(query).split(' ').filter(Boolean);
}

/** True when the normalized target contains every normalized query token. */
function matchesAllTokens(normalizedTarget, tokens) {
  for (const t of tokens) if (!normalizedTarget.includes(t)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Keyboard-layout fixer: text typed on the wrong layout (US QWERTY ⇄ Arabic 101).

const EN_TO_AR = {
  '`': 'ذ', q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح', '[': 'ج', ']': 'د',
  a: 'ش', s: 'س', d: 'ي', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م', ';': 'ك', "'": 'ط',
  z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ى', m: 'ة', ',': 'و', '.': 'ز', '/': 'ظ',
  '~': 'ّ', Q: 'َ', W: 'ً', E: 'ُ', R: 'ٌ', T: 'لإ', Y: 'إ', U: '‘', I: '÷', O: '×', P: '؛', '{': '<', '}': '>',
  A: 'ِ', S: 'ٍ', D: ']', F: '[', G: 'لأ', H: 'أ', J: 'ـ', K: '،', L: '/', ':': ':', '"': '"',
  Z: '~', X: 'ْ', C: '}', V: '{', B: 'لآ', N: 'آ', M: '’', '<': ',', '>': '.', '?': '؟',
};

const AR_TO_EN = {};
for (const [en, ar] of Object.entries(EN_TO_AR)) {
  if (ar.length === 1 && !(ar in AR_TO_EN)) AR_TO_EN[ar] = en;
}
// Multi-character values: lam-alef ligature keys.
const AR_LIGATURES = [['لإ', 'T'], ['لأ', 'G'], ['لآ', 'B']];

function enToAr(text) {
  let out = '';
  for (const ch of String(text || '')) out += EN_TO_AR[ch] !== undefined ? EN_TO_AR[ch] : ch;
  return out;
}

function arToEn(text) {
  let s = String(text || '');
  for (const [lig, key] of AR_LIGATURES) s = s.split(lig).join(key);
  let out = '';
  for (const ch of s) out += AR_TO_EN[ch] !== undefined ? AR_TO_EN[ch] : ch;
  return out;
}

/** Count letters of each script to guess which way a wrong-layout text should be converted. */
function detectLayoutDirection(text) {
  let latin = 0;
  let arabic = 0;
  for (const ch of String(text || '')) {
    if (LATIN_LETTER_RE.test(ch)) latin++;
    else if (ARABIC_LETTER_RE.test(ch)) arabic++;
  }
  if (latin === 0 && arabic === 0) return null;
  return latin >= arabic ? 'en2ar' : 'ar2en';
}

/**
 * Fix text typed on the wrong keyboard layout.
 * direction: 'auto' | 'en2ar' | 'ar2en'
 */
function fixLayout(text, direction = 'auto') {
  const dir = direction === 'auto' ? detectLayoutDirection(text) : direction;
  if (dir === 'en2ar') return enToAr(text);
  if (dir === 'ar2en') return arToEn(text);
  return String(text || '');
}

/** True when a Windows keyboard layout handle (HKL) is an Arabic layout: primary language id 0x01. */
function isArabicLayout(hkl) {
  if (hkl === null || hkl === undefined) return false;
  const langId = typeof hkl === 'bigint' ? Number(hkl & 0xffffn) : (Number(hkl) & 0xffff);
  return (langId & 0x3ff) === 0x01;
}

module.exports = {
  removeDiacritics,
  toWesternDigits,
  toArabicIndicDigits,
  normalizeArabic,
  normalizeForSearch,
  tokenize,
  matchesAllTokens,
  enToAr,
  arToEn,
  detectLayoutDirection,
  fixLayout,
  isArabicLayout,
  EN_TO_AR,
};
