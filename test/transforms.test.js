'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTransform, listTransforms } = require('../src/main/transforms');

test('every transform has bilingual labels and runs on plain text', () => {
  for (const t of listTransforms()) {
    assert.ok(t.id && t.labelEn && t.labelAr, t.id);
    assert.equal(typeof applyTransform(t.id, 'sample text'), 'string');
  }
});

test('case and whitespace transforms', () => {
  assert.equal(applyTransform('upper', 'Lasq app'), 'LASQ APP');
  assert.equal(applyTransform('lower', 'Lasq APP'), 'lasq app');
  assert.equal(applyTransform('title', 'the quick brown fox'), 'The Quick Brown Fox');
  assert.equal(applyTransform('trim', '  a   b  \n  c '), 'a b\nc');
  assert.equal(applyTransform('joinLines', 'one\ntwo\r\nthree'), 'one two three');
  assert.equal(applyTransform('removeBlankLines', 'a\n\n\nb\n  \nc'), 'a\nb\nc');
});

test('bilingual helpers', () => {
  assert.equal(applyTransform('fixLayout', 'hgsghl'), 'السلام');
  assert.equal(applyTransform('digitsWestern', 'الرقم ٠٧٩٥'), 'الرقم 0795');
  assert.equal(applyTransform('digitsArabic', 'room 12'), 'room ١٢');
  assert.equal(applyTransform('removeDiacritics', 'مُحَمَّد'), 'محمد');
});

test('structured transforms', () => {
  assert.equal(applyTransform('jsonPretty', '{"a":1,"b":[1,2]}'), '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  assert.equal(applyTransform('jsonMinify', '{ "a" : 1 }'), '{"a":1}');
  assert.equal(applyTransform('jsonPretty', 'not json'), 'not json');
  assert.equal(applyTransform('markdownToPlain', '# Title\n\nSome **bold** and a [link](https://x.y) and `code`'), 'Title\n\nSome bold and a link and code');
  assert.equal(applyTransform('extractEmails', 'write to a@b.co or c@d.org, a@b.co again'), 'a@b.co\nc@d.org');
  assert.equal(applyTransform('extractUrls', 'see https://a.b/c and http://d.e/f.'), 'https://a.b/c\nhttp://d.e/f');
  assert.equal(applyTransform('stripTracking', 'https://shop.example/item?id=5&utm_source=x&fbclid=abc'), 'https://shop.example/item?id=5');
});
