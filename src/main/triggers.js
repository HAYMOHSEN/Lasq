'use strict';
// Trigger matcher for text expansion: does the rolling keystroke buffer end with a trigger?
// Pure, covered by test/triggers.test.js.

const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

function normalizeApp(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * @param {Array} snippets  [{ id, trigger, appsAllow, appsDeny, ... }]
 * @param {Object} options  { wordBoundary = true, matchCase = false }
 */
function createMatcher(snippets, options = {}) {
  const wordBoundary = options.wordBoundary !== false;
  const matchCase = options.matchCase === true;
  const entries = (snippets || [])
    .filter((s) => s && typeof s.trigger === 'string' && s.trigger.trim().length > 0)
    .map((s) => ({ snippet: s, trigger: s.trigger, key: matchCase ? s.trigger : s.trigger.toLowerCase() }))
    .sort((a, b) => b.trigger.length - a.trigger.length); // longest first

  const minLen = entries.length ? Math.min(...entries.map((e) => e.trigger.length)) : 0;

  function allowedIn(snippet, app) {
    const a = normalizeApp(app);
    const deny = (snippet.appsDeny || []).map(normalizeApp);
    if (a && deny.includes(a)) return false;
    const allow = (snippet.appsAllow || []).map(normalizeApp).filter(Boolean);
    if (allow.length && !(a && allow.includes(a))) return false;
    return true;
  }

  /**
   * @param {string} buffer  the recent keystrokes
   * @param {Object} ctx     { app } process name of the foreground window (e.g. 'outlook.exe')
   * @returns {{ snippet, trigger } | null}
   */
  function match(buffer, ctx = {}) {
    const text = String(buffer || '');
    if (!entries.length || text.length < minLen) return null;
    const hay = matchCase ? text : text.toLowerCase();
    for (const e of entries) {
      if (!hay.endsWith(e.key)) continue;
      const start = text.length - e.trigger.length;
      if (wordBoundary && start > 0) {
        const before = text[start - 1];
        if (WORD_CHAR_RE.test(before) && WORD_CHAR_RE.test(e.trigger[0])) continue;
      }
      if (!allowedIn(e.snippet, ctx.app)) continue;
      return { snippet: e.snippet, trigger: e.trigger };
    }
    return null;
  }

  return { match, size: entries.length };
}

module.exports = { createMatcher, normalizeApp };
