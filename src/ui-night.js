// The night check card (the farmer's night report after Phase 5): before a Next job skip that runs through the night in the
// young-bird weeks, when something is off (night-check.js nightCheck: the house heading far under or over the brooder
// sign's row, too much or too little air). Three rows — the house against the row and the thermostat, the air going out
// against the vent sign's need, the brooders' output now and at the coldest hour — then what is off and where to set it,
// with "Fix it at the controller" (the controller on its tab) and "Skip anyway". The farm clock stands still while it shows
// (panel kind 'paused'). Owner: integrator.
//   registerNightPanel({ register, openPanel, closePanel }) -> { show(nc, { onFix, onSkip }) }
import { h, button, uniqueId, injectStyle, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { sourceLabel } from './content-signs.js';

export const NIGHT_PANEL = 'night-check';
const CSS = `
.night { --p5-w: 700px; width: min(var(--p5-w), calc(100% - 2 * var(--gutter))); display: flex; flex-direction: column; overflow: hidden; }
.night > .panel-close { top: 12px; right: 14px; }
.night .night-case { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background-color: var(--panel-solid); }
.nc-body { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 14px 18px 8px; }
.night-head { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: center; padding-right: 96px; }
.night-head .icon { grid-row: span 2; align-self: start; font-size: 22px; color: var(--accent); }
.night-head h2 { margin: 0; font: 600 18px/1.2 var(--font-display); color: var(--ink); }
.night-head p { margin: 0; color: var(--ink-dim); font: 600 12.5px/1.35 var(--font-display); letter-spacing: 0.02em; }
.nc-rows { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; }
.nc-row { display: grid; grid-template-columns: 12px 100px minmax(0, 1fr); gap: 8px; align-items: start; padding: 5px 10px; border-radius: 6px; background: var(--panel-raised); }
.nc-row .fw-dot { margin-top: 4px; }
.nc-k { font: 600 11px/1.65 var(--font-display); letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-dim); }
.nc-v { font-size: 13px; line-height: 1.4; color: var(--ink); }
.nc-off-k { margin: 10px 0 4px; font: 600 13.5px/1.2 var(--font-display); color: var(--ink); }
.nc-off { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 13px; line-height: 1.4; color: var(--ink); }
.nc-where { display: block; color: var(--ink-dim); }
.nc-where b { color: var(--accent); font-weight: 600; }
.nc-src { margin: 8px 0 0; color: var(--ink-faint); font-size: 12px; line-height: 1.35; }
.nc-keys { flex: none; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 10px 18px 12px; border-top: 1px solid var(--panel-edge); }
`;
const ROWS = [['temp', 'Temperature'], ['air', 'Ventilation'], ['brooders', 'Brooders']];
const WORD = { green: 'steady', amber: 'watch', red: 'alert' };
const TAB = { vent: 'Ventilation tab', temp: 'Temperature tab' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const hhmm = (t) => { const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export function registerNightPanel({ register, closePanel }) {
  injectStyle('night-style', CSS);
  let built = null, handlers = {}, info = null;
  register(NIGHT_PANEL, () => {
    const titleId = uniqueId('night-title');
    const { el, closeBtn } = dialogShell('night', titleId, () => closePanel());
    const sub = h('p');
    const rows = {};
    const list = h('ul', { class: 'nc-rows' }, ROWS.map(([id, label]) => {
      const dot = h('span', { class: 'fw-dot', role: 'img' }), v = h('span', { class: 'nc-v' });
      rows[id] = { dot, v };
      return h('li', { class: 'nc-row', 'data-row': id }, dot, h('span', { class: 'nc-k' }, label), v);
    }));
    const off = h('ol', { class: 'nc-off' });
    const fix = button({ class: 'btn btn--accent', 'data-night': 'fix' }, 'Fix it at the controller');
    const skip = button({ class: 'btn', 'data-night': 'skip' }, 'Skip anyway');
    fix.addEventListener('click', () => { const f = handlers.onFix; closePanel(); f?.(info?.fix); });
    skip.addEventListener('click', () => { const f = handlers.onSkip; closePanel(); f?.(); });
    // the check round: the body scrolls if it must, the two keys stay pinned under it (960 x 600: both always in view)
    el.append(h('div', { class: 'night-case card' },
      h('div', { class: 'nc-body' },
        h('header', { class: 'night-head' }, h('span', { class: 'icon', html: ICONS.moon || ICONS.thermometer || '', 'aria-hidden': 'true' }), h('h2', { id: titleId }, 'Before the night'), sub),
        list, h('p', { class: 'nc-off-k' }, 'What is off, and where to set it'), off,
        h('p', { class: 'nc-src' }, `The rows: the brooder sign (${sourceLabel(['week1', 'vent'])} for day 1; other days general practice) and the minimum ventilation sign (general practice); where the house heads: the farm’s heat balance with these settings.`)),
      h('div', { class: 'nc-keys' }, skip, fix)), closeBtn);
    built = {
      el, kind: 'paused',
      draw(nc) {
        info = nc;
        setText(sub, `The farm clock stands still. The skip runs through the night; tonight${nc.to != null ? ` to ${hhmm(nc.to)}` : ''} with these settings:`);
        for (const [id] of ROWS) {
          const r = nc.lines?.[id], R = rows[id];
          R.dot.className = `fw-dot is-${r?.state || 'green'}`; R.dot.setAttribute('aria-label', WORD[r?.state] || ''); R.dot.title = WORD[r?.state] || '';
          setText(R.v, r?.text || '');
        }
        off.replaceChildren(...(nc.problems || []).map((p) => h('li', null, `${cap(p.why)}.`, h('span', { class: 'nc-where' }, h('b', null, 'Where: '), `${p.check}.`))));
        fix.hidden = !nc.fix;
        setText(fix, nc.fix ? `Fix it at the controller (${TAB[nc.fix.tab] || 'Temperature tab'})` : 'Fix it at the controller');
      },
      onOpen() { queueMicrotask?.(() => (fix.hidden ? skip : fix).focus({ preventScroll: true })); },
    };
    return built;
  }, { kind: 'paused' });
  return {
    /** Draw the check into the card (the panel host opens it first). */
    show(nc, h2 = {}) { handlers = h2; built?.draw(nc); },
    get info() { return info; },
  };
}
