'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const arabic = require('../src/main/arabic');

test('normalizeArabic unifies alef, taa marbuta, alef maqsura and drops tashkeel', () => {
  assert.equal(arabic.normalizeArabic('أحمدُ إبراهيم آمنة مكتبة مصطفى'), 'احمد ابراهيم امنه مكتبه مصطفي');
  assert.equal(arabic.normalizeArabic('مُحَمَّد'), 'محمد');
  assert.equal(arabic.normalizeArabic('كـــتاب'), 'كتاب');
});

test('digits convert both ways', () => {
  assert.equal(arabic.toWesternDigits('٠١٢٣٤٥٦٧٨٩ ۰۹'), '0123456789 09');
  assert.equal(arabic.toArabicIndicDigits('2026-10-09'), '٢٠٢٦-١٠-٠٩');
});

test('normalizeForSearch lowercases, normalizes and collapses whitespace', () => {
  assert.equal(arabic.normalizeForSearch('  Hello   WORLD  ٢٠٢٦ '), 'hello world 2026');
  assert.equal(arabic.normalizeForSearch('الإيميل'), 'الايميل');
});

test('tokens match leniently across alef forms and diacritics', () => {
  const target = arabic.normalizeForSearch('شكراً لتواصلكم، سنرد خلال يوم عمل');
  assert.equal(arabic.matchesAllTokens(target, arabic.tokenize('شكرا سنرد')), true);
  assert.equal(arabic.matchesAllTokens(target, arabic.tokenize('شكرا غداً')), false);
});

test('fixLayout converts English keystrokes typed for Arabic and back', () => {
  assert.equal(arabic.fixLayout('hgsghl', 'en2ar'), 'السلام');
  assert.equal(arabic.fixLayout('hgsghl ugd;l'), 'السلام عليكم');
  assert.equal(arabic.fixLayout('اثممخ', 'ar2en'), 'hello');
  assert.equal(arabic.fixLayout('اثممخ'), 'hello');
  assert.equal(arabic.fixLayout('123 ok', 'en2ar'), '123 خن');
});

test('fixLayout round-trips punctuation keys', () => {
  assert.equal(arabic.enToAr('k;'), 'نك');
  assert.equal(arabic.arToEn('نك'), 'k;');
  assert.equal(arabic.enToAr('lh`h?'), 'ماذا؟');
});

test('detectLayoutDirection and isArabicLayout', () => {
  assert.equal(arabic.detectLayoutDirection('abc'), 'en2ar');
  assert.equal(arabic.detectLayoutDirection('ابج'), 'ar2en');
  assert.equal(arabic.detectLayoutDirection('123'), null);
  assert.equal(arabic.isArabicLayout(0x04010401), true);   // Arabic (Saudi Arabia)
  assert.equal(arabic.isArabicLayout(0x30010401n), true);  // Arabic (101) with a layout id in the high word
  assert.equal(arabic.isArabicLayout(0x04090409), false);  // US English
});
