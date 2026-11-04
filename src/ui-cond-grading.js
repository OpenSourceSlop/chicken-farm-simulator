// Grading the stacks of a bad batch (PHASE4.md §4.3, §10.3, §12.3). Package "panels". The chicks still in their
// boxes come in six stacks (farm.flock.stacks); Grade this stack waits about 6 farm minutes at the panel clock (the box
// time runs on), then calls chicks.grade { stack }, which answers at once { stack, looked, weak, culled, minutes }: the
// weak ones go into the cull box. The graded-out chicks of day 0 are the hatchery's claim once it is told the same
// day (phone.hatchery, the office phone; farm.flock.claimed): the view says whether that has happened, as a fact.
//   gradingFor(L)            one grading table per game (the job in progress, the results by stack, the call)
//   gradingView(L, host)     the stacks, their keys and the cull box, for a host panel: the chick-grading panel and the
//                            chick table's Grade the stacks tab (ui-inspect.js). host = { needTime(text), timeNote, isOpen() }
//   buildChickGrading(api)   the chick-grading panel itself (its plate, the job strip by withJobStrip)
import { EV } from './events.js';
import { LEVEL1 } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell } from './ui-equipment.js';
import { int } from './ui-format.js';
import { machineJob, progressBar, whenText } from './ui-cycle-kit.js';

export const GRADE_MIN = 6; // farm minutes a stack (PHASE4.md §10.3: the panel's bar, then the action)
const CTRL = new WeakMap();

/** The grading table of this game: one stack at a time, the answers by stack, the hatchery call (from the bus). */
export function gradingFor(L) {
  let g = CTRL.get(L);
  if (g) return g;
  const { env, farm } = L;
  g = { truckAt: undefined, results: {}, told: null, job: null, stack: null, host: null, progress: 0 };
  L.events?.on?.(EV.ACTION, (p) => {
    if (p.id === 'phone.hatchery') { sync(); g.told = { day: env.dayNumber, t: env.day }; }
    if (p.id === 'chicks.grade' && p.result && typeof p.result === 'object') { sync(); g.results[p.stack ?? p.result.stack ?? 0] = { ...p.result, at: env.day }; }
  });
  // a new delivery (a new run, a replay of the brooding week): the table starts empty
  function sync() {
    const ta = farm.stats?.truckAt ?? null;
    if (ta !== g.truckAt) { g.truckAt = ta; g.results = {}; g.told = null; if (g.job) { g.job.cancel(); g.job = null; g.stack = null; g.host = null; } }
    // the farm keeps each graded stack's answer (flock.stacks[i].gradedR): a reloaded game shows the table as it was
    (farm.flock?.stacks || []).forEach((st, i) => { if (st?.graded && st.gradedR && !g.results[i]) g.results[i] = { stack: i, minutes: GRADE_MIN, ...st.gradedR }; });
  }
  g.sync = sync;
  g.busy = () => !!g.job?.running;
  g.start = (stack, host) => {
    sync();
    if (g.busy()) return false;
    g.stack = stack; g.host = host; g.progress = 0.001;
    g.job = machineJob(env, GRADE_MIN, () => {
      const r = L.act('chicks.grade', { stack }) || {};
      const by = g.host; g.job = null; g.stack = null; g.host = null; g.progress = 0;
      const text = `Stack ${stack + 1} graded ${env.timeLabel}: ${int(r.weak)} weak of ${int(r.looked)} looked at, ${int(r.culled)} into the cull box.`;
      by?.timeNote?.done(text);
      if (by && !by.isOpen?.()) L.notice?.(text, 6);
    });
    host.needTime?.(`grading a stack takes about ${GRADE_MIN} farm minutes; the chicks in the other boxes wait (the box time runs on)`);
    g.job.start();
    return true;
  };
  g.tick = () => { if (g.job?.running) g.progress = g.job.tick() || 0.001; };
  /** The hatchery told on day 0 (the call seen on the bus, or the farm's claim). */
  g.claim = () => {
    const culled = Object.values(g.results).reduce((a, r) => a + (r.culled || 0), 0);
    const claimed = farm.flock?.claimed || 0;
    const toldDay0 = (g.told && g.told.day <= 0) || claimed > 0;
    return { culled, claimed, toldDay0, told: g.told };
  };
  CTRL.set(L, g);
  return g;
}

/** Ten boxes of a stack, drawn from the side (how many are still full); a busy stack has its lid open. */
function stackSvg(boxes, busy) {
  let s = '';
  for (let k = 0; k < 10; k++) {
    const y = 104 - (k + 1) * 10, full = k < boxes;
    s += `<rect x="6" y="${y}" width="48" height="9" rx="1" fill="${full ? '#c79a64' : 'rgba(255,255,255,0.06)'}" stroke="${full ? '#8c6740' : 'rgba(255,255,255,0.12)'}"/>${full ? `<path d="M12 ${y + 4.5}h4M24 ${y + 4.5}h4M36 ${y + 4.5}h4" stroke="#8c6740" stroke-width="1.6" stroke-linecap="round"/>` : ''}`;
  }
  const lid = busy && boxes > 0 ? `<path d="M6 ${104 - boxes * 10}l-4 -7h48l4 7" fill="#d9b07a" stroke="#8c6740"/>` : '';
  return `<svg viewBox="0 0 60 106" aria-hidden="true">${s}${lid}</svg>`;
}
/** The cull box with one drawn chick per 20 graded out (as the scene's box at the table). */
function cullBoxSvg(n) {
  const k = Math.min(18, Math.ceil(n / 20));
  let c = '';
  for (let i = 0; i < k; i++) c += `<circle cx="${14 + (i % 6) * 9}" cy="${30 - Math.floor(i / 6) * 6}" r="4.2" fill="var(--chick)" opacity="0.85"/>`;
  return `<svg viewBox="0 0 76 44" width="76" height="44" aria-hidden="true"><path d="M4 12h68l-5 30H9z" fill="#b68b5c" stroke="#8c6740" stroke-width="1.5"/>${c}<path d="M4 12h68" stroke="#8c6740" stroke-width="2"/></svg>`;
}

export function gradingView(L, host) {
  const { env, farm } = L;
  const g = gradingFor(L);
  const intro = h('p', { class: 'cyc-line cyc-dim' });
  const stacks = Array.from({ length: LEVEL1.stacks }, (_, i) => {
    const pic = h('div', { class: 'cond-boxes' });
    const n = h('p', { class: 'cond-stack-n' });
    const key = button({ class: 'key key--wide', 'aria-label': `Grade stack ${i + 1}` }, 'Grade this stack');
    key.addEventListener('click', () => { if (g.start(i, host)) draw(true); });
    const bar = progressBar();
    const el = h('div', { class: 'cond-stack' }, h('span', { class: 'cond-stack-k' }, `Stack ${i + 1}`), pic, n, key, bar.el);
    return { el, pic, n, key, bar };
  });
  const box = h('div', { class: 'cond-cullbox' });
  const sum1 = h('p'), sum2 = h('p');
  const el = h('div', { class: 'cond-grading' }, intro, h('div', { class: 'cond-stacks' }, stacks.map((s) => s.el)), h('div', { class: 'cond-sum' }, box, h('div', null, sum1, sum2)));
  let key = '';
  function draw(force) {
    g.sync();
    const fl = farm.flock || {}, list = fl.stacks || [];
    const arrived = (fl.delivered || 0) > 0 && list.length > 0;
    setText(intro, arrived ? `The stacks still in their boxes. One stack at a time: about ${GRADE_MIN} farm minutes each, the weak chicks into the cull box (grading plate).`
      : 'The chick truck has not come yet: the stacks are graded from their boxes when it is here.');
    stacks.forEach((s, i) => {
      const st = list[i] || { chicks: 0 }, r = g.results[i], busy = g.stack === i && g.busy();
      const boxes = Math.ceil(Math.max(0, st.chicks || 0) / LEVEL1.chicksPerBox);
      const k = `${boxes}|${busy}`;
      if (force || s.pic.__k !== k) { s.pic.__k = k; s.pic.innerHTML = stackSvg(boxes, busy); }
      s.el.classList.toggle('is-busy', busy);
      s.n.innerHTML = r ? `<b>${int(r.weak)} weak</b> of ${int(r.looked)} · ${int(r.culled)} culled` : busy ? 'grading…' : !arrived ? '—' : st.chicks > 0 ? `${int(st.chicks)} chicks in the boxes` : 'on the floor';
      s.key.disabled = !arrived || g.busy() || !!r || !(st.chicks > 0);
      s.key.hidden = !!r;
      s.bar.set(busy ? g.progress : 0);
    });
    const c = g.claim(), day = env.dayNumber;
    const kk = `${c.culled}`;
    if (force || box.__k !== kk) { box.__k = kk; box.innerHTML = cullBoxSvg(c.culled); }
    const graded = Object.keys(g.results).length;
    sum1.innerHTML = graded ? `Graded out: <b>${int(c.culled)} chicks</b> in the cull box from ${graded} stack${graded === 1 ? '' : 's'}.` : 'Nothing graded out yet.';
    setText(sum2, c.toldDay0 ? `Claimed: the hatchery was told${c.told ? ` ${whenText(c.told.t)}` : ' today'}; the chicks graded out on day 0 are counted apart from the week’s culls.`
      : day <= 0 ? 'Not claimed yet: the hatchery has not been told today. The office phone (records book) calls it; the graded-out chicks of day 0 are claimed once it is told the same day, before 24:00.'
        : 'Not claimed: the hatchery was not told on day 0, so the chicks graded out count as culls of the week.');
  }
  return {
    el,
    update(force) { g.tick(); draw(force); },
  };
}

/** The chick-grading panel (a bad batch; the chick table's Grade the stacks tab shows the same table). */
export function buildChickGrading(api) {
  const { L } = api;
  const g = gradingFor(L);
  const shell = equipShell({ cls: 'equip--cond equip--chick-grading', icon: ICONS.chick, title: 'Grading the chicks', sub: 'Chick sample table, outside the house door · the stacks still in their boxes',
    plates: ['chick-grading'], signLinks: ['sign-chicks'], onClose: L.close });
  let isOpen = false;
  const host = { needTime: (t) => shell.needTime(t), timeNote: shell.timeNote, isOpen: () => isOpen };
  const view = gradingView(L, host);
  shell.main.append(view.el, shell.timeNote.el);
  let acc = 0;
  return {
    el: shell.el,
    onOpen() { isOpen = true; shell.refreshPlates(); },
    onClose() { isOpen = false; },
    /** A stack still on its bar finishes with the panel closed. */
    busy: () => g.busy() && g.host === host,
    update(dt, force) { g.tick(); acc -= dt; if (force || acc <= 0) { acc = 0.2; view.update(force); } },
  };
}
