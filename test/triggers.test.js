'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMatcher } = require('../src/main/triggers');

const snippets = [
  { id: 'sig', trigger: ';sig', appsAllow: [], appsDeny: ['cmd.exe'] },
  { id: 'sigfull', trigger: ';sigfull', appsAllow: [], appsDeny: [] },
  { id: 'ar', trigger: '؛توق', appsAllow: [], appsDeny: [] },
  { id: 'addr', trigger: 'addr', appsAllow: ['outlook.exe'], appsDeny: [] },
];

test('matches the longest trigger at the end of the buffer', () => {
  const m = createMatcher(snippets);
  assert.equal(m.match('hello ;sig').snippet.id, 'sig');
  assert.equal(m.match('hello ;sigfull').snippet.id, 'sigfull');
  assert.equal(m.match('hello ;si'), null);
  assert.equal(m.match('؛توق').snippet.id, 'ar');
});

test('case-insensitive by default, case-sensitive on request', () => {
  assert.equal(createMatcher(snippets).match(';SIG').snippet.id, 'sig');
  assert.equal(createMatcher(snippets, { matchCase: true }).match(';SIG'), null);
});

test('word boundary applies only to triggers that start with a word character', () => {
  const m = createMatcher(snippets);
  assert.equal(m.match('myaddr', { app: 'outlook.exe' }), null);
  assert.equal(m.match('my addr', { app: 'outlook.exe' }).snippet.id, 'addr');
  assert.equal(m.match('text;sig').snippet.id, 'sig'); // punctuation-prefixed triggers work anywhere
  assert.equal(createMatcher(snippets, { wordBoundary: false }).match('myaddr', { app: 'outlook.exe' }).snippet.id, 'addr');
});

test('allow and deny lists by process name', () => {
  const m = createMatcher(snippets);
  assert.equal(m.match('addr', { app: 'winword.exe' }), null);
  assert.equal(m.match('addr', { app: 'OUTLOOK.EXE' }).snippet.id, 'addr');
  assert.equal(m.match(';sig', { app: 'cmd.exe' }), null);
  assert.equal(m.match(';sig', { app: 'notepad.exe' }).snippet.id, 'sig');
});

test('ignores snippets without a trigger', () => {
  const m = createMatcher([{ id: 'x', trigger: '' }, { id: 'y' }]);
  assert.equal(m.size, 0);
  assert.equal(m.match('anything'), null);
});
