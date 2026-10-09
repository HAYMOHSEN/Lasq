'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ph = require('../src/main/placeholders');

const now = new Date(2026, 9, 9, 14, 5, 7); // 9 Oct 2026 14:05:07 local

test('date and time placeholders with default and custom formats', () => {
  assert.equal(ph.render('{{date}}', { now }).text, '2026-10-09');
  assert.equal(ph.render('{{date:dd/mm/yyyy}}', { now }).text, '09/10/2026');
  assert.equal(ph.render('{{time}}', { now }).text, '14:05');
  assert.equal(ph.render('{{date:yy-mm-dd HH:ii:ss}}', { now }).text, '26-10-09 14:05:07');
});

test('clipboard and unknown placeholders', () => {
  assert.equal(ph.render('Re: {{clipboard}}', { clipboard: 'subject' }).text, 'Re: subject');
  assert.equal(ph.render('keep {{unknown}}').text, 'keep {{unknown}}');
});

test('fields and choices are collected in order and filled from values', () => {
  const body = 'Dear {{field:Name}}, see you on {{field:Day}} ({{choice:Mood=happy|busy}}) {{field:Name}}';
  assert.deepEqual(ph.collectFields(body), [
    { name: 'Name', type: 'text' },
    { name: 'Day', type: 'text' },
    { name: 'Mood', type: 'choice', options: ['happy', 'busy'] },
  ]);
  const out = ph.render(body, {}, { Name: 'Hani', Day: 'Monday', Mood: 'busy' });
  assert.equal(out.text, 'Dear Hani, see you on Monday (busy) Hani');
  assert.equal(ph.render('{{choice:A|B}}', {}, {}).text, 'A');
});

test('cursor marker is removed and its distance from the end reported', () => {
  const out = ph.render('Hello {{cursor}} world');
  assert.equal(out.text, 'Hello  world');
  assert.equal(out.cursorFromEnd, ' world'.length);
  assert.equal(ph.render('no cursor').cursorFromEnd, 0);
});

test('hasPlaceholders', () => {
  assert.equal(ph.hasPlaceholders('plain'), false);
  assert.equal(ph.hasPlaceholders('{{date}}'), true);
  assert.equal(ph.hasPlaceholders('{{date}}'), true); // regex state reset between calls
});
