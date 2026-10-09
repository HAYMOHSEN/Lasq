'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKeyBuffer } = require('../src/main/expansion');
const { usCharForKey } = require('../src/main/keymap');
const { createMatcher } = require('../src/main/triggers');

// Keys of ";sig" on a US keyboard: scan codes of ; s i g
const KEYS = { semicolon: 0x27, s: 0x1f, i: 0x17, g: 0x22, b: 0x30, a: 0x1e, shiftA: 0x1e };

test('usCharForKey maps positions, shift and caps lock', () => {
  assert.equal(usCharForKey(KEYS.s), 's');
  assert.equal(usCharForKey(KEYS.s, { shift: true }), 'S');
  assert.equal(usCharForKey(KEYS.s, { caps: true }), 'S');
  assert.equal(usCharForKey(KEYS.s, { caps: true, shift: true }), 's');
  assert.equal(usCharForKey(KEYS.semicolon, { shift: true }), ':');
  assert.equal(usCharForKey(0xe04b), '', 'extended keys (arrows) have no character');
});

test('a US trigger typed on an Arabic layout matches by key position and counts on-screen characters', () => {
  const buf = createKeyBuffer();
  // What the Arabic 101 layout shows for the keys ; s i g → ك س ه ل
  buf.push('ك', ';'); buf.push('س', 's'); buf.push('ه', 'i'); buf.push('ل', 'g');
  const matcher = createMatcher([{ id: 'sig', trigger: ';sig' }]);
  assert.equal(matcher.match(buf.actualText()), null, 'typed characters do not match');
  const m = matcher.match(buf.usText());
  assert.equal(m.snippet.id, 'sig', 'the same keys match as a US layout');
  assert.deepEqual(buf.tail('us', m.trigger.length), { backspaces: 4, onScreen: 'كسهل' });
});

test('keys that produce two characters (lam-alef) are backspaced fully', () => {
  const buf = createKeyBuffer();
  buf.push('ك', ';'); buf.push('لا', 'b'); buf.push('ش', 'a');
  assert.deepEqual(buf.tail('us', 3), { backspaces: 4, onScreen: 'كلاش' });
  buf.backspace();
  assert.equal(buf.actualText(), 'كلا', 'backspace removed the last key');
  assert.equal(buf.usText(), ';b');
  buf.backspace();
  assert.equal(buf.actualText(), 'كل', 'a second backspace removes one of the two lam-alef characters');
  assert.equal(buf.usText(), ';b', 'the key stays until both characters are gone');
});

test('an Arabic trigger matches by typed characters', () => {
  const buf = createKeyBuffer();
  for (const [a, u] of [['؛', ';'], ['ت', 'j'], ['و', ','], ['ق', 'r']]) buf.push(a, u);
  const matcher = createMatcher([{ id: 'ar', trigger: '؛توق' }]);
  const m = matcher.match(buf.actualText());
  assert.equal(m.snippet.id, 'ar');
  assert.deepEqual(buf.tail('actual', m.trigger.length), { backspaces: 4, onScreen: '؛توق' });
});

test('buffer clears, caps at 64 keys and handles backspace on empty', () => {
  const buf = createKeyBuffer();
  buf.backspace();
  for (let i = 0; i < 100; i++) buf.push('x', 'x');
  assert.equal(buf.length, 64);
  buf.clear();
  assert.equal(buf.actualText(), '');
});
