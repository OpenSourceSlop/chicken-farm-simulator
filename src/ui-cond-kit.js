// Shared parts of the Phase 4 condition panels (PHASE4.md §10.3, §12.3). Package "panels".
//   injectCondStyle()            the CSS of the condition panels, once into <head> (no-op in node)
//   timedKey(L, shell, opts)     a key whose action waits a short farm-time bar at the panel clock (§10.3: the panel
//                                waits, then calls the action, which answers at once): the plates fold, a paused
//                                clock runs again (farmTimeNote), the bar finishes with the panel closed (busy())
//   dial(opts)                   a round gauge (pressure, current, fuel) with the plate's figure marked
//   ICONS4                       small icons for the panel headers (the generator's bolt, the tank)
// Neutral words only: what runs, how long it takes, what the gauges read. No verdict colours (lamps and LCDs only).
import { h, button, setText } from './ui-dom.js';
import { machineJob, progressBar } from './ui-cycle-kit.js';

const wrap = (body) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICONS4 = {
  bolt: wrap('<path d="M13 2.5L5.5 13.5h5.5l-1.5 8 8-11h-5.6z"/>'),
  tank: wrap('<path d="M6 3h12v12H6z"/><path d="M6 10h12"/><path d="M8.5 15l-2 6.5M15.5 15l2 6.5M7.5 19h9"/>'),
};

/**
 * A key that runs a short machine job over farm time, then calls `act()` (the farm answers at once).
 * opts: { label, busyLabel, minutes, takes (the note's words), act() -> result, done(result) -> note text,
 *         notice(result) -> caption text when the panel is closed, cls, aria, disabled() }
 * -> { el, bar, job, get running, update() (call every frame), cancel() }
 */
export function timedKey(L, shell, { label, busyLabel, minutes, takes, act, done, notice, cls = 'btn btn--machine', aria = null, disabled = () => false, isOpen = () => true }) {
  const el = button({ class: cls, ...(aria ? { 'aria-label': aria } : {}) }, label);
  const bar = progressBar();
  const job = machineJob(L.env, minutes, () => {
    const r = act();
    bar.set(0);
    const text = done?.(r);
    shell.timeNote.done(text || '');
    if (!isOpen()) { const t = notice?.(r) ?? text; if (t) L.notice?.(t, 6); }
    sync();
  });
  function sync() {
    setText(el, job.running ? busyLabel || `${label}…` : label);
    el.disabled = job.running || !!disabled();
  }
  el.addEventListener('click', () => {
    if (job.running || disabled()) return;
    shell.needTime(takes);
    job.start();
    bar.set(0.001);
    sync();
  });
  sync();
  return {
    el, bar, job,
    get running() { return job.running; },
    update() { if (job.running) bar.set(job.tick() || 0.001); sync(); },
    cancel() { job.cancel(); bar.set(0); sync(); },
  };
}

/**
 * A round gauge: lo..hi over 240°, ticks every `step`, the plate's figure marked (`mark`), the needle at `v`
 * (null: at rest on lo). Returns an SVG string. Colours: the case's ink, the needle red as on every dial.
 */
export function dial({ v = null, lo = 0, hi = 4, step = 1, mark = null, label = '', unit = '', size = 92, fmt = (x) => String(x) }) {
  const ang = (x) => -120 + ((Math.max(lo, Math.min(hi, x)) - lo) / (hi - lo)) * 240;
  const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [50 + Math.cos(t) * r, 50 + Math.sin(t) * r]; };
  let ticks = '';
  for (let x = lo; x <= hi + 1e-9; x += step) {
    const [x1, y1] = pt(ang(x), 40), [x2, y2] = pt(ang(x), 34), [tx, ty] = pt(ang(x), 26);
    ticks += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="var(--case-ink)" stroke-width="1.6"/><text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" font-size="8.5" text-anchor="middle" fill="var(--case-ink)">${fmt(x)}</text>`;
  }
  let markSvg = '';
  if (mark != null) {
    const [m1x, m1y] = pt(ang(mark), 44), [m2x, m2y] = pt(ang(mark), 36);
    markSvg = `<path d="M${m1x.toFixed(1)} ${m1y.toFixed(1)}L${m2x.toFixed(1)} ${m2y.toFixed(1)}" stroke="var(--sign-yellow-ink)" stroke-width="4" stroke-linecap="round"/><path d="M${m1x.toFixed(1)} ${m1y.toFixed(1)}L${m2x.toFixed(1)} ${m2y.toFixed(1)}" stroke="var(--sign-yellow)" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  const a = v == null || !Number.isFinite(v) ? -120 : ang(v);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="var(--case-hi)" stroke="var(--plate-edge)" stroke-width="3.5"/>
    ${ticks}${markSvg}<path d="M50 50L50 12" stroke="var(--hen-comb)" stroke-width="2.6" stroke-linecap="round" transform="rotate(${a.toFixed(1)} 50 50)"/><circle cx="50" cy="50" r="4" fill="var(--case-ink)"/>
    <text x="50" y="78" font-size="7.5" font-weight="700" letter-spacing="0.5" text-anchor="middle" fill="var(--case-ink)" font-family="var(--font-display)">${label}</text>
    <text x="50" y="88" font-size="8" text-anchor="middle" fill="var(--case-ink)" font-family="var(--font-display)">${unit}</text></svg>`;
}

/** A lamp with its word beside it (the mains' state, the pump running): lit = the lamp's colour, never a verdict. */
export function lamp(kind = 'run') {
  const led = h('span', { class: `led led--${kind}`, 'aria-hidden': 'true' });
  const word = h('span', { class: 'cond-lamp-w' });
  const el = h('span', { class: 'cond-lamp' }, led, word);
  return { el, set(on, text) { led.classList.toggle('is-on', !!on); setText(word, text); } };
}

const CSS = `
.cond-lcd .lcd-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px 16px; }
.cond-lcd.cond-lcd--2 .lcd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 20px; }
.cond-lcd .lcd-num { font-size: 21px; }
.cond-lcd .lcd-k { font-size: 10.5px; letter-spacing: 0.08em; }
.cond-top { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; margin-top: 10px; }
.cond-top--3 { grid-template-columns: auto auto minmax(0, 1fr); }
.cond-gauge { display: grid; justify-items: center; gap: 2px; padding: 6px 8px 4px; border-radius: 8px; background: rgba(0, 0, 0, 0.18); }
.cond-gauge svg { display: block; }
.cond-gauge small { font: 600 11px/1.2 var(--font-display); letter-spacing: 0.04em; color: var(--key-sub); text-align: center; }
.cond-lamps { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; }
.cond-lamp { display: inline-flex; align-items: center; gap: 7px; font: 600 12.5px/1.25 var(--font-display); letter-spacing: 0.03em; color: var(--key-ink); }
.cond-lamp .led { flex: none; }
.cond-switch { display: inline-flex; align-items: stretch; gap: 0; border-radius: 8px; box-shadow: 0 0 0 2px var(--plate-edge); }
.cond-switch .key { min-width: 96px; border-radius: 0; }
.cond-switch .key:first-child { border-radius: 7px 0 0 7px; }
.cond-switch .key:last-child { border-radius: 0 7px 7px 0; }
.cond-switch-k { font: 600 10.5px/1.2 var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; color: var(--key-sub); margin-right: 6px; align-self: center; }
.cond-row-bar { grid-column: 2 / -1; }
.cond-row-bar .cyc-progress { margin-top: 0; height: 5px; }
.cond-row-bar .cyc-progress > span { background: var(--sign-yellow); }
.cond-state { margin: 10px 0 0; padding: 7px 10px; border-radius: 5px; background: rgba(0, 0, 0, 0.22); font: 600 13.5px/1.35 var(--font-display); letter-spacing: 0.02em; color: var(--key-ink); }
.cond-state b { color: var(--sign-yellow); font-weight: 700; }
.cond-dim { color: var(--key-sub); font-weight: 500; }
/* the tank's sight gauge and the pump's dials */
.cond-tank { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: start; margin-top: 10px; }
.cond-sight { padding: 6px 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.18); }
.cond-sight svg { display: block; }
.cond-dials { display: flex; flex-wrap: wrap; gap: 8px; }
.cond-dial-btns { display: grid; align-content: center; flex: 1 1 120px; }
.cond-dial-btns .btn { white-space: normal; }
.cond-tank .readout { min-width: 0; padding: 6px 10px; }
.cond-tank .readout-v { font-size: 17px; }
.cond-tank .readout-sub { font-size: 11px; }
.cond-tank .equip-reads { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
/* grading the stacks: six stacks of boxes, a key under each */
.cond-stacks { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
.cond-stack { display: grid; gap: 5px; align-content: start; padding: 7px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); text-align: center; min-width: 0; }
.cond-stack.is-busy { box-shadow: inset 0 0 0 2px var(--sign-yellow); }
.cond-stack-k { font: 700 11.5px/1.2 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; }
.cond-stack-n { min-height: 2.6em; font: 500 11.5px/1.3 var(--font-body); color: var(--key-sub); }
.cond-stack-n b { color: var(--key-ink); font-weight: 600; }
.cond-stack svg { display: block; width: auto; height: 74px; margin: 0 auto; }
.cond-stack .key--wide { width: 100%; min-width: 0; height: auto; min-height: 34px; padding: 4px 6px; font-size: 10.5px; letter-spacing: 0.04em; white-space: normal; line-height: 1.15; }
.cond-stack .cyc-progress { margin-top: 0; }
.cond-stack .cyc-progress > span { background: var(--sign-yellow); }
.cond-sum { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; margin-top: 10px; padding: 8px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.2); }
.cond-cullbox svg { display: block; }
.cond-sum p { margin: 0; font-size: 13px; line-height: 1.4; }
.cond-sum p + p { margin-top: 3px; }
.cond-sum b { font-family: var(--font-display); font-weight: 700; color: var(--sign-yellow); }
@media (max-width: 760px) { .cond-stacks { grid-template-columns: repeat(3, minmax(0, 1fr)); } .cond-lcd .lcd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-height: 700px) and (min-width: 700px) {
  .cond-lcd { padding: 7px 10px 6px; }
  .cond-lcd .lcd-num { font-size: 19px; }
  .cond-lcd .lcd-foot { margin-top: 5px; }
  .equip--cond .ctrl-rows { gap: 6px; margin-top: 8px; }
  .equip--cond .ctrl-row { padding: 6px 9px; }
}
`;
let injected = false;
/** Put the condition panels' CSS into the page once (no-op without a document). */
export function injectCondStyle() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.id = 'cond-panels-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}
