// The job strip (the clarity round): the top of an equipment panel shows the open job done there, its steps
// with live progress, the target from the sign beside the live value, and a note when the job needs farm time.
// Content: job-strips.js (pure rows); this draws them. No buttons inside (the panel's keys stay the only
// controls), neutral words only. A job finished while the panel is open stays in the strip, marked done,
// until the panel closes.
//   createJobStrip(L, panelId, { section, ctx, label }) -> { el, update(), onOpen(), onClose() }
//     section  the controller's 'top' | 'temp' | 'vent' | 'lights' (null: the whole panel)
//     ctx()    extra figures the panel knows (the drinker line it is, the timer setting not sent yet)
//     label    section names for the pointer lines ({ temp: 'Temperature', ... })
import { h } from './ui-dom.js';
import { stripsAt, partRows } from './job-strips.js';
import { STRIPS_CYCLE } from './job-strips-cycle.js';

const CSS = `
.jstrip { margin: 0 0 10px; padding: 9px 11px 8px; border-radius: 6px; background: rgba(231, 182, 70, 0.10); box-shadow: inset 0 0 0 1px rgba(231, 182, 70, 0.45); color: var(--key-ink); font-size: 13px; line-height: 1.35; }
.jstrip[hidden] { display: none; }
.jstrip + .jstrip { margin-top: -4px; }
.js-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 0 0 5px; }
.js-k { padding: 1px 6px; border-radius: 2px; background: var(--sign-yellow); color: var(--sign-yellow-ink); font: 700 10.5px/1.4 var(--font-display); letter-spacing: 0.12em; text-transform: uppercase; }
.js-k.is-done { background: var(--led-run, #6fd36f); color: #10240f; }
.js-title { font: 700 13.5px/1.25 var(--font-display); letter-spacing: 0.03em; }
.js-rows { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; }
.js-rows > li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 0 6px; align-items: start; }
.js-mark { display: inline-grid; place-items: center; width: 16px; height: 16px; margin-top: 1px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--key-sub); font: 700 9.5px/1 var(--font-display); color: var(--key-sub); }
.js-step.is-done .js-mark { background: var(--sign-yellow); box-shadow: none; color: var(--sign-yellow-ink); }
.js-step.is-done .js-text { color: var(--key-sub); }
.js-dot { width: 5px; height: 5px; margin: 6px 0 0 6px; border-radius: 50%; background: var(--key-sub); }
.js-cmp .js-text { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1px 10px; }
.js-what { grid-column: 1 / -1; font-weight: 600; }
.js-sign, .js-yours { padding: 2px 6px; border-radius: 3px; background: rgba(0, 0, 0, 0.22); }
.js-sign b, .js-yours b { display: block; font: 700 9.5px/1.3 var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; color: var(--key-sub); }
.js-note .js-text, .js-time .js-text { color: var(--sign-yellow); }
.js-bar { grid-column: 2; height: 4px; margin-top: 3px; border-radius: 2px; background: rgba(0, 0, 0, 0.35); overflow: hidden; }
.js-bar > span { display: block; height: 100%; background: var(--sign-yellow); transform-origin: left center; }
.js-more { margin: 5px 0 0; font-size: 12px; color: var(--key-sub); }
/* machine rows: the state word beside the title, keys that name their action, the pans' fill as a number */
.ctrl-label > .ctrl-state { display: block; margin-top: 3px; font: 600 12px/1.25 var(--font-display); letter-spacing: 0.02em; text-transform: none; color: var(--sign-yellow); }
.ctrl-label > .ctrl-state[hidden] { display: none; }
.key--act { height: auto; min-height: 40px; max-width: 172px; padding: 6px 12px; white-space: normal; line-height: 1.15; font-size: 11.5px; }
.pan-read { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pan-num { display: grid; gap: 3px; min-width: 104px; font: 600 12.5px/1.2 var(--font-display); color: var(--key-ink); }
.pan-bar { display: block; height: 5px; border-radius: 3px; background: rgba(0, 0, 0, 0.35); overflow: hidden; }
.pan-bar > span { display: block; height: 100%; background: var(--sign-yellow); transform-origin: left center; transform: scaleX(0); }
.ctrl-keys-k { max-width: 74px; font: 600 10.5px/1.2 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--key-sub); text-align: right; }
.equip-legend { margin: 10px 0 0; padding: 0 0 0 16px; font-size: 12.5px; line-height: 1.4; color: var(--key-sub); }
.equip-legend li + li { margin-top: 2px; }
.equip-legend b { color: var(--key-ink); font-weight: 600; }
.equip-note--time { color: var(--sign-yellow); }
.equip-note--time[hidden] { display: none; }
.ctrl-timer-now { margin: 2px 0 6px; font: 600 13px/1.3 var(--font-display); color: var(--sign-yellow); }
.ctrl-sub { display: block; margin-top: 2px; font-size: 12px; color: var(--key-sub); }
@media (max-width: 700px) { .js-cmp .js-text { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: no-preference) { .js-bar > span { transition: transform 0.3s ease; } }
`;
let injected = false;
function injectStyle() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  document.head.append(h('style', { id: 'jobstrip-style' }, CSS));
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bar = (v) => (v == null ? '' : `<span class="js-bar" aria-hidden="true"><span style="transform: scaleX(${Math.max(0, Math.min(1, v)).toFixed(3)})"></span></span>`);

function rowHtml(r, n) {
  if (r.k === 'step') return `<li class="js-step${r.done ? ' is-done' : ''}"><span class="js-mark" aria-hidden="true">${r.done ? '✓' : n}</span><span class="js-text">${r.done ? '<span class="sr-only">done: </span>' : ''}${esc(r.text)}</span>${bar(r.bar)}</li>`;
  if (r.k === 'cmp') return `<li class="js-cmp"><span class="js-dot" aria-hidden="true"></span><span class="js-text"><span class="js-what">${esc(r.what)}</span><span class="js-sign"><b>Sign</b>${esc(r.sign)}</span><span class="js-yours"><b>Yours</b>${esc(r.yours)}</span></span>${bar(r.bar)}</li>`;
  if (r.k === 'time') return `<li class="js-time"><span class="js-mark" aria-hidden="true">⏱</span><span class="js-text">${esc(r.text)}</span>${bar(r.bar)}</li>`;
  if (r.k === 'note') return `<li class="js-note"><span class="js-mark" aria-hidden="true">i</span><span class="js-text">${esc(r.text)}</span></li>`;
  return `<li class="js-line"><span class="js-dot" aria-hidden="true"></span><span class="js-text">${esc(r.text)}</span></li>`;
}

export function createJobStrip(L, panelId, { section = null, ctx = () => ({}), label = {} } = {}) {
  injectStyle();
  const el = h('section', { class: 'jstrip', hidden: true, 'aria-label': 'The job done here' });
  let sticky = new Map(), last = '';
  const base = () => ({ env: L.env, farm: L.farm, records: L.records, skills: L.skills, props: L.props, engine: L.engine(), minmax: L.minmax, weighings: L.weighings, ...ctx() });
  function update() {
    const engine = L.engine();
    if (!engine || L.farm?.mode !== 'level') { if (!el.hidden) { el.hidden = true; last = ''; } return; }
    const list = stripsAt(engine, panelId, section, STRIPS_CYCLE);
    for (const s of list) if (s.here) sticky.set(s.inst.key, s);
    const here = [...sticky.values()].filter((s) => s.inst.status === 'open' || s.inst.status === 'done');
    const others = section === 'top' || section == null ? list.filter((s) => !s.here && !sticky.has(s.inst.key)) : [];
    const c = base();
    let html = '';
    here.slice(0, 3).forEach((s, k) => {
      const done = s.inst.status === 'done';
      let rows;
      try { rows = s.strip ? s.strip.rows({ ...c, inst: s.inst }, s.inst) : partRows(c, s.inst); } catch (err) { console.error('job strip', s.inst.key, err); rows = []; }
      if (!rows.length) rows = [{ k: 'step', text: s.inst.def.title, done }];
      let n = 0;
      html += `<div class="js-job"${k ? ' style="margin-top: 8px"' : ''}><p class="js-head"><span class="js-k${done ? ' is-done' : ''}">${done ? 'Done' : 'Job here'}</span><span class="js-title">${esc(s.strip?.title || s.inst.def.title)}</span></p>
        <ol class="js-rows">${rows.map((r) => rowHtml(r, r.k === 'step' ? ++n : 0)).join('')}</ol></div>`;
    });
    if (others.length) html += `<p class="js-more">Also open here: ${others.map((s) => `${esc(s.inst.def.title)}${s.section && label[s.section] ? ` (${esc(label[s.section])})` : ''}`).join(' · ')}</p>`;
    if (html === last) return;
    last = html;
    el.hidden = !html;
    el.innerHTML = html;
  }
  return {
    el,
    update,
    onOpen() { sticky = new Map(); last = ''; update(); },
    onClose() { sticky = new Map(); },
  };
}

/** Wrap a machine panel's factory so the built panel shows the job strip at the top of its working plate
 *  (`.equip-main`), unless it mounts its own (the feeder box, the controller) or has none. The panel may give
 *  `stripCtx()` (the drinker line it is). Its onOpen / onClose / update keep running as before. */
export function withJobStrip(L, id, build) {
  return (...args) => {
    const panel = build(...args);
    const main = panel?.el?.querySelector?.('.equip-main');
    if (!main || panel.el.querySelector('.jstrip')) return panel;
    const strip = createJobStrip(L, id, { ctx: () => panel.stripCtx?.() || {} });
    main.prepend(strip.el);
    const { onOpen, onClose, update } = panel;
    let acc = 0;
    panel.onOpen = function (...a) { const r = onOpen?.apply(this, a); strip.onOpen(); return r; };
    panel.onClose = function (...a) { strip.onClose(); return onClose?.apply(this, a); };
    panel.update = function (dt, force, ...a) { const r = update?.call(this, dt, force, ...a); acc -= dt; if (force || acc <= 0) { acc = 0.25; strip.update(); } return r; };
    return panel;
  };
}
