'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../src/main/store');
const { looksLikeCardNumber, displayName } = require('../src/main/capture');

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lasq-test-'));
  const store = createStore({ dir, log: () => {} });
  store.load();
  return { store, dir };
}

test('history: add, dedupe, pin, search, remove', () => {
  const { store } = tmpStore();
  const a = store.addHistoryItem({ kind: 'text', text: 'Meeting moved to Thursday', sourceApp: 'Outlook' });
  store.addHistoryItem({ kind: 'text', text: 'شكراً لتواصلكم، سنرد خلال يوم عمل', sourceApp: 'Teams' });
  const again = store.addHistoryItem({ kind: 'text', text: 'Meeting moved to Thursday', sourceApp: 'Word' });
  assert.equal(again.id, a.id, 'same text is deduplicated');
  assert.equal(store.data.history.length, 2);
  assert.equal(store.data.history[0].id, a.id, 'refreshed item moves to the front');
  assert.equal(store.data.history[0].sourceApp, 'Word');

  assert.equal(store.search({ query: 'thursday' })[0].preview, 'Meeting moved to Thursday');
  assert.equal(store.search({ query: 'شكرا سنرد' }).length, 1);
  assert.equal(store.search({ query: 'nothing here' }).length, 0);

  store.pin(a.id, true);
  assert.equal(store.search({ tab: 'pinned' }).length, 1);
  assert.equal(store.search({ tab: 'history' })[0].pinned, true);
  assert.equal(store.remove(a.id), true);
  assert.equal(store.data.history.length, 1);
});

test('history: retention purge and max items keep pinned items', () => {
  const { store } = tmpStore();
  store.saveSettings({ capture: { maxItems: 50, retentionDays: 1 } });
  for (let i = 0; i < 60; i++) store.addHistoryItem({ kind: 'text', text: 'item ' + i });
  assert.equal(store.data.history.length, 50);
  const keep = store.data.history[10];
  store.pin(keep.id, true);
  store.data.history.forEach((it) => { it.createdAt = Date.now() - 3 * 86400000; });
  const removed = store.purge();
  assert.equal(removed, 49);
  assert.equal(store.data.history[0].id, keep.id);
});

test('snippets: seed, save, trigger uniqueness, search, bump', () => {
  const { store } = tmpStore();
  assert.ok(store.getSnippets().length >= 5, 'starter snippets are seeded');
  const sn = store.saveSnippet({ id: null, name: 'Address', trigger: ';addr', folder: 'Personal', bodyEn: 'Amman, Jordan', bodyAr: 'عمّان، الأردن', appsAllow: ['Outlook.exe'], appsDeny: [] });
  assert.ok(sn.id);
  assert.deepEqual(sn.appsAllow, ['outlook.exe']);
  assert.throws(() => store.saveSnippet({ id: null, name: 'Dup', trigger: ';ADDR', bodyEn: 'x' }), (e) => e.code === 'trigger-taken');
  store.saveSnippet({ ...sn, name: 'Home address' });
  assert.equal(store.getSnippets().filter((s) => s.trigger === ';addr').length, 1);
  assert.equal(store.search({ query: 'عمان', tab: 'snippets' })[0].name, 'Home address');
  store.bumpSnippet(sn.id);
  assert.equal(store.getSnippet(sn.id).useCount, 1);
  store.saveSettings({ lang: 'ar' });
  assert.equal(store.search({ query: 'addr', tab: 'snippets' })[0].text, 'عمّان، الأردن');
  assert.equal(store.deleteSnippet(sn.id), true);
});

test('settings deep-merge and persistence across reload', () => {
  const { store, dir } = tmpStore();
  const s = store.saveSettings({ hotkeys: { panel: 'Control+Shift+Space' }, capture: { images: false } });
  assert.equal(s.hotkeys.panel, 'Control+Shift+Space');
  assert.equal(s.hotkeys.library, 'Control+Shift+L', 'untouched keys keep their defaults');
  assert.equal(s.capture.images, false);
  store.addNote('remember this');
  store.flush();
  const store2 = createStore({ dir, log: () => {} });
  store2.load();
  assert.equal(store2.getSettings().hotkeys.panel, 'Control+Shift+Space');
  assert.equal(store2.getNotes()[0].text, 'remember this');
});

test('export and import round trip', () => {
  const { store } = tmpStore();
  store.addHistoryItem({ kind: 'text', text: 'exported item' });
  const dump = JSON.parse(JSON.stringify(store.exportData()));
  const { store: other } = tmpStore();
  const counts = other.importData(dump);
  assert.equal(counts.history, 1);
  assert.ok(counts.snippets >= 5);
  assert.throws(() => other.importData({ app: 'other' }));
});

test('encryption codec is applied on write and read', () => {
  const codec = { encode: (b) => Buffer.from(b.toString('utf8').split('').reverse().join(''), 'utf8'), decode: (b) => Buffer.from(b.toString('utf8').split('').reverse().join(''), 'utf8') };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lasq-test-'));
  const store = createStore({ dir, codec, log: () => {} });
  store.load();
  store.addNote('secret');
  store.flush();
  assert.ok(!fs.readFileSync(path.join(dir, 'notes.json'), 'utf8').includes('"secret"'));
  const store2 = createStore({ dir, codec, log: () => {} });
  store2.load();
  assert.equal(store2.getNotes()[0].text, 'secret');
});

test('capture helpers: card numbers and app display names', () => {
  assert.equal(looksLikeCardNumber('4111 1111 1111 1111'), true);
  assert.equal(looksLikeCardNumber('order 1234567890123'), false);
  assert.equal(looksLikeCardNumber('call 0795123456'), false);
  assert.equal(displayName('winword.exe'), 'Word');
  assert.equal(displayName('someapp.exe'), 'Someapp');
  assert.equal(displayName(''), '');
});
