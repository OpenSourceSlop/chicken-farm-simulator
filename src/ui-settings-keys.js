// The settings menu's Keys tab (PHASE5.md §4.3): every game key in groups, each with its key(s) and a Change key. Change
// arms ctx.ui.captureNextKey(fn) (ui.js: the capture comes before every other key listener, so W, E, the arrows and Esc
// reach it): Esc cancels, any other key goes to keys.rebind(id, code). A key another action holds swaps with it (both rows
// show it at once); a fixed, reserved or button key is refused with keys.js REBIND_WORDS. Owner: package "settings".
//
//   const tab = createKeysTab({ ctx, onChange })   -> { el, refresh(), cancel(), capturing }
//   frozen DOM hooks (PHASE5.md §8.10): [data-key-action="<id>"] on each row, [data-key-change] on its Change button
import { h, button } from './ui-dom.js';
import { KEY_ACTIONS, REBIND_WORDS, codeLabel } from './keys.js';

const GROUPS = [
  ['move', 'Walking and the view'],
  ['farm', 'Work on the farm'],
  ['views', 'Books and views'],
  ['time', 'The farm clock'],
  ['game', 'The game'],
];
/** The ui hub (its captureNextKey): ctx.ui when main.js sets it, else the game's hooks object (main.js keeps ui there). */
export const uiOf = (ctx) => ctx.ui || (typeof window !== 'undefined' ? window.__game?.ui : null) || null;
// what a fixed key says instead of a Change key
const FIXED_NOTE = { run: 'Hold Shift', useDead: 'Shift + the Use key', menu: 'Always Esc' };

export function createKeysTab({ ctx, onChange = () => {} }) {
  const keys = ctx.keys;
  const status = h('p', { class: 'set-keys-status', role: 'status', 'aria-live': 'polite' }, '');
  const rows = new Map();   // id -> { row, keysEl, btn }
  let cancelCapture = null, waiting = null;

  function keyChips(id) {
    return keys.labels(id).map((k) => h('kbd', { class: 'kbd' }, k));
  }
  function drawRow(id) {
    const r = rows.get(id);
    if (!r) return;
    r.keysEl.replaceChildren(...keyChips(id));
    r.row.classList.toggle('is-waiting', waiting === id);
    if (r.btn) r.btn.textContent = waiting === id ? 'Press a key…' : 'Change';
  }
  function refresh() { for (const id of rows.keys()) drawRow(id); }

  function cancel(words = null) {
    const was = waiting;
    if (cancelCapture) { try { cancelCapture(); } catch { /* gone */ } }
    cancelCapture = null; waiting = null;
    if (was) drawRow(was);
    if (words != null) status.textContent = words;
  }
  const whatOf = (id) => KEY_ACTIONS.find((a) => a.id === id)?.what || id;

  function change(id) {
    if (waiting === id) { cancel('Not changed.'); rows.get(id)?.btn?.focus(); return; }
    cancel();
    const ui = uiOf(ctx);
    if (!ui?.captureNextKey) { status.textContent = 'Changing keys is not available here.'; return; }
    waiting = id;
    drawRow(id);
    status.textContent = `Press a key for “${whatOf(id)}”… Esc cancels.`;
    cancelCapture = ui.captureNextKey((e) => {
      cancelCapture = null;
      const btn = rows.get(id)?.btn;
      if (e.code === 'Escape' || (!e.code && e.key === 'Escape')) { waiting = null; drawRow(id); status.textContent = 'Not changed.'; btn?.focus(); return; }
      const code = e.code || (/^[a-z]$/i.test(e.key || '') ? `Key${e.key.toUpperCase()}` : /^\d$/.test(e.key || '') ? `Digit${e.key}` : '');
      const r = keys.rebind(id, code);
      waiting = null;
      if (!r.ok) {
        drawRow(id);
        status.textContent = REBIND_WORDS[r.reason] || REBIND_WORDS.unknown;
      } else {
        refresh();
        const now = codeLabel(code);
        status.textContent = r.swapped
          ? `“${whatOf(id)}” is on ${now} now; “${whatOf(r.swapped)}” moved to ${keys.label(r.swapped)}.`
          : `“${whatOf(id)}” is on ${now} now.`;
        onChange({ id, code, swapped: r.swapped || null });
      }
      btn?.focus();
    });
  }

  const groups = GROUPS.map(([g, title]) => {
    const list = h('div', { class: 'set-keys-group', role: 'group', 'aria-label': title }, h('h4', { class: 'label set-keys-head' }, title));
    for (const a of KEY_ACTIONS.filter((x) => x.group === g)) {
      const keysEl = h('span', { class: 'set-keys-keys' });
      const fixed = a.fixed || a.follows;
      const btn = fixed ? null : button({ class: 'btn btn--quiet set-keys-change', 'data-key-change': '', 'aria-label': `Change the key for: ${a.what}` }, 'Change');
      btn?.addEventListener('click', () => change(a.id));
      const row = h('div', { class: 'set-keys-row', 'data-key-action': a.id },
        h('span', { class: 'set-keys-what' }, a.what), keysEl,
        btn || h('span', { class: 'set-keys-fixed', title: REBIND_WORDS.fixed }, FIXED_NOTE[a.id] || 'Fixed'));
      rows.set(a.id, { row, keysEl, btn });
      list.append(row);
    }
    return list;
  });
  const resetAll = button({ class: 'btn btn--quiet set-reset' }, 'Reset all keys');
  resetAll.addEventListener('click', () => { cancel(); keys.reset(); refresh(); status.textContent = 'Every key is back on its first key.'; onChange({ reset: true }); });
  const el = h('div', { class: 'set-keys' }, status, h('div', { class: 'set-keys-list' }, groups), h('div', { class: 'set-foot' }, resetAll));
  refresh();
  const offKeys = keys.subscribe?.(() => { if (!waiting) refresh(); }) || (() => {});
  return {
    el,
    refresh,
    cancel: () => cancel(waiting ? 'Not changed.' : null),
    dispose() { cancel(); offKeys(); },
    get capturing() { return !!waiting; },
    resetButton: resetAll,
  };
}
