'use strict';
// Snippet placeholders:
//   {{date}} {{date:dd/mm/yyyy}} {{time}} {{clipboard}} {{cursor}}
//   {{field:Name}}            → asks the user for a value (fill-in form)
//   {{choice:Name=A|B|C}}     → asks the user to pick one (name optional: {{choice:A|B}})
// Pure functions, covered by test/placeholders.test.js.

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z]+)\s*(?::\s*([^}]*?))?\s*\}\}/g;

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(d, fmt) {
  const map = {
    yyyy: String(d.getFullYear()),
    yy: String(d.getFullYear()).slice(-2),
    mm: pad(d.getMonth() + 1),
    dd: pad(d.getDate()),
    HH: pad(d.getHours()),
    ii: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  };
  return fmt.replace(/yyyy|yy|mm|dd|HH|ii|ss/g, (k) => map[k]);
}

/** Collect the fields a body needs from the user, in order of first appearance. */
function collectFields(body) {
  const fields = [];
  const seen = new Set();
  let choiceIndex = 0;
  for (const m of String(body || '').matchAll(PLACEHOLDER_RE)) {
    const kind = m[1].toLowerCase();
    const arg = (m[2] || '').trim();
    if (kind === 'field') {
      const name = arg || 'Value';
      if (!seen.has(name)) { seen.add(name); fields.push({ name, type: 'text' }); }
    } else if (kind === 'choice') {
      choiceIndex++;
      const { name, options } = parseChoice(arg, choiceIndex);
      if (!seen.has(name)) { seen.add(name); fields.push({ name, type: 'choice', options }); }
    }
  }
  return fields;
}

function parseChoice(arg, index) {
  const eq = arg.indexOf('=');
  const name = eq > 0 ? arg.slice(0, eq).trim() : `Choice ${index}`;
  const list = (eq > 0 ? arg.slice(eq + 1) : arg).split('|').map((s) => s.trim()).filter(Boolean);
  return { name, options: list.length ? list : [''] };
}

/**
 * Render a body with the given context and user values.
 * Returns { text, cursorFromEnd } where cursorFromEnd is the number of UTF-16 units
 * after the {{cursor}} marker (0 = caret stays at the end).
 */
function render(body, ctx = {}, values = {}) {
  const now = ctx.now instanceof Date ? ctx.now : new Date();
  let choiceIndex = 0;
  let cursorAt = -1;
  let text = String(body || '').replace(PLACEHOLDER_RE, (whole, kindRaw, argRaw, offset, full) => {
    const kind = kindRaw.toLowerCase();
    const arg = (argRaw || '').trim();
    switch (kind) {
      case 'date': return formatDate(now, arg || 'yyyy-mm-dd');
      case 'time': return formatDate(now, arg || 'HH:ii');
      case 'clipboard': return ctx.clipboard || '';
      case 'cursor': return '\u0000CURSOR\u0000';
      case 'field': return values[arg || 'Value'] ?? '';
      case 'choice': {
        choiceIndex++;
        const { name, options } = parseChoice(arg, choiceIndex);
        return values[name] ?? options[0] ?? '';
      }
      default: return whole; // unknown placeholder: leave as typed
    }
  });
  const marker = '\u0000CURSOR\u0000';
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    text = text.replace(marker, '');
    cursorAt = idx;
  }
  text = text.split(marker).join('');
  const cursorFromEnd = cursorAt >= 0 ? text.length - cursorAt : 0;
  return { text, cursorFromEnd };
}

function hasPlaceholders(body) {
  return PLACEHOLDER_RE.test(String(body || '')) && (PLACEHOLDER_RE.lastIndex = 0, true);
}

module.exports = { collectFields, render, formatDate, hasPlaceholders, PLACEHOLDER_RE };
