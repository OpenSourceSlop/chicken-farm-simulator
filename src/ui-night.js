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
.night { --p5-w: 620px; width: min(var(--p5-w), calc(100% - 2 * var(--gutter))); }
.night-case { padding: 20px 22px 18px; background-color: var(--panel-solid); }
.night-head { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; align-items: center; padding-right: 92px; }
.night-head .icon { grid-row: span 2; align-self: start; font-size: 26px; color: var(--accent); }
.night-head h2 { margin: 0; font: 600 20px/1.2 var(--font-display); color: var(--ink); }
.night-head p { margin: 0; color: var(--ink-dim); font: 600 13px/1.35 var(--font-display); letter-spacing: 0.03em; }
.nc-rows { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
.nc-row { display: grid; grid-template-columns: 14px 92px minmax(0, 1fr); gap: 8px; align-items: start; padding: 8px 10px; border-radius: 6px; background: var(--panel-raised); }
.nc-row .fw-dot { margin-top: 4px; }
.nc-k { font: 600 12px/1.4 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
.nc-v { font-size: 13px; line-height: 1.45; color: var(--ink); }
.nc-off-k { margin: 14px 0 6px; font: 600 14px/1.2 var(--font-display); color: var(--ink); }
.nc-off { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 13px; line-height: 1.45; color: var(--ink); }
.nc-where { display: block; color: var(--ink-dim); }
.nc-where b { color: var(--accent); font-weight: 600; }
.nc-src { margin: 12px 0 0; color: var(--ink-faint); font-size: 11px; line-height: 1.4; }
.nc-keys { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 14px; }
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
    el.append(h('div', { class: 'night-case card' },
      h('header', { class: 'night-head' }, h('span', { class: 'icon', html: ICONS.moon || ICONS.thermometer || '', 'aria-hidden': 'true' }), h('h2', { id: titleId }, 'Before the night'), sub),
      list, h('p', { class: 'nc-off-k' }, 'What is off, and where to set it'), off,
      h('p', { class: 'nc-src' }, `The rows: the brooder sign’s table (${sourceLabel(['week1', 'vent'])} for day 1; the other rows general practice) and the minimum ventilation sign’s table (general practice). Where the house heads tonight: the farm’s own heat balance with these settings.`),
      h('div', { class: 'nc-keys' }, skip, fix)), closeBtn);
    built = {
      el, kind: 'paused',
      draw(nc) {
        info = nc;
        const to = nc.to != null ? ` · the night to ${hhmm(nc.to)}` : '';
        setText(sub, `The farm clock stands still. The skip runs through the night${to}; with these settings:`);
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
