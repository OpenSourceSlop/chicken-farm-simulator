// The level job card (HUD, top right) and the marker over the current job (PHASE2.md §3.4–§3.5).
// Header "Day 3 · Morning round 06:00–12:00"; pinned anchor jobs, then problem jobs ("new"), then on
// day 0 the "Before the truck" group, then the rest in list order; jobs later today dimmed with
// their time; done jobs fold into a count, missed ones struck through. The current job shows where
// to go, its fact links and its bar. Footer: Next job, Notebook (N), Skill tree (K).
// Owner: package "level".
import { DRINKER_LINES_Z, FARM, FLOOR_GRID, HEATERS, HEATER_HEIGHT, LEVEL1, SPOTS, SPOTS2 } from './config.js';
import { BOARDS } from './content-signs.js';
import { JOB_WHERE } from './content-jobs.js';
import { EV } from './events.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { createMarker } from './ui-marker.js';
import { hhmm, splitDay } from './ui-format.js';

const BOARD_SPOT = {
  'sign-gate': SPOTS.signGate, 'sign-brooder': SPOTS.signBrooder, 'sign-water': SPOTS2.signWater, 'sign-vent': SPOTS2.signVent,
  'sign-litter': SPOTS2.signLitter, 'sign-chicks': SPOTS2.signChicks, 'sign-health': SPOTS2.signHealth, 'feeder-box': SPOTS2.feederBox,
  silo: SPOTS2.silo, 'controller-lights': SPOTS.controller, 'bird-scale': SPOTS2.birdScale, 'water-supply': SPOTS2.waterSupply, drinker: SPOTS2.drinkers[0],
};
/** The panel that shows a board or plate (a plate lives inside its machine). */
export const BOARD_PANEL = { 'controller-lights': 'controller', drinker: 'drinker-0' };

/** Round label for the card header. */
export function roundLabel(env, anchors) {
  const d = env.dayNumber, hr = env.hour;
  if (d < 0) return 'Prep day — chicks arrive tomorrow 08:00';
  if (d === 0 && hr < LEVEL1.arrivalHour && hr >= 6) return 'Day 0 · Before the truck (08:00)';
  if (d === 0 && anchors.truck != null && anchors.placed == null) return 'Day 0 · The chicks are here';
  const R = LEVEL1.rounds;
  const span = (r) => `${r.label} ${hhmm(r.from)}–${hhmm(r.to)}`;
  if (hr >= R.am.from && hr < R.am.to) return `Day ${d} · ${span(R.am)}`;
  if (hr >= R.pm.from && hr < R.pm.to) return `Day ${d} · ${span(R.pm)}`;
  if (hr >= R.pm.to) return `Day ${d} · ${span(R.eve)}`;
  if (hr >= R.am.to && hr < R.pm.from) return `Day ${d} · Midday`;
  return `Day ${d} · Night`;
}

// Text under the bar: what has been done of the job so far, in plain counts.
function progressText(inst, ctx) {
  const r = inst.def.done, st = inst.st;
  switch (r.type) {
    case 'each': return `${r.values.filter((v) => String(v) in st.seen).length} / ${r.values.length} lines`;
    case 'count': {
      const parts = [`${st.list.length} / ${r.n}`];
      if (r.sectors) parts.push(`${new Set(st.list.map((x) => x.s)).size} / ${r.sectors} parts of the floor`);
      if (r.nearDrinker) parts.push(`${Math.min(r.nearDrinker, st.list.filter((x) => x.near).length)} / ${r.nearDrinker} under a line`);
      return parts.join(' · ');
    }
    case 'coverage': return `floor seen ${Math.round((st.cells.length / 300) * 100)} %${r.listen ? (st.listened ? ' · listened' : ' · stand still to listen') : ''}`;
    case 'state': {
      const f = ctx.farm;
      if (r.test === 'litter-covered') return `floor covered ${Math.round((f.litter.cover ?? 0) * 100)} %`;
      if (r.test === 'lines-flushed') return `${f.water.lines.filter((l) => l.flushClear >= 0.99).length} / 4 lines ran clear`;
      if (r.test === 'pans-flooded') return `${f.feed.lines.filter((l) => l.flood && l.panFill >= 0.95).length} / 3 lines flooded and full`;
      if (r.test === 'all-placed') return `${Math.round((f.flock.placed || 0) / (LEVEL1.chicksPlaced / LEVEL1.stacks))} / ${LEVEL1.stacks} stacks tipped`;
      return '';
    }
    case 'all': return `${st.met.filter(Boolean).length} / ${r.of.length}`;
    default: return '';
  }
}
const hasBar = (inst) => { const t = inst.def.done.type; return t === 'each' || t === 'count' || t === 'coverage' || t === 'all' || (t === 'state' && ['litter-covered', 'lines-flushed', 'pans-flooded', 'all-placed'].includes(inst.def.done.test)); };

export function createJobCard(parent, ctx, L, { root, avoid, onNext, onNotebook, onSkills, nextLabel }) {
  const titleId = uniqueId('ljobs-title');
  const head = h('h2', { class: 'label', id: titleId });
  const count = h('span', { class: 'jobs-count' });
  const list = h('div', { class: 'ljobs-list' });
  // the list scrolls when it is longer than the card: a fade and "more" at the bottom say so
  const more = button({ class: 'ljobs-more', hidden: true, 'aria-label': 'Show more of the job list' }, 'more ▾');
  more.addEventListener('click', () => { list.scrollBy({ top: Math.max(60, list.clientHeight * 0.7), behavior: 'smooth' }); });
  const listWrap = h('div', { class: 'ljobs-wrap' }, list, more);
  let missedOpen = false;
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const nextBtn = button({ class: 'btn btn--accent ljobs-next' }, h('span', { html: ICONS.next, 'aria-hidden': 'true' }), h('span'));
  const nbBtn = button({ class: 'btn btn--icon', title: 'Notebook (N)', 'aria-label': 'Notebook (N)', html: ICONS.notebook });
  const skBtn = button({ class: 'btn btn--icon ljobs-sk', title: 'Skill tree (K)', 'aria-label': 'Skill tree (K)', html: ICONS.tree });
  const dot = h('span', { class: 'dot', hidden: true, 'aria-hidden': 'true' });
  skBtn.append(dot);
  nextBtn.addEventListener('click', onNext);
  nbBtn.addEventListener('click', onNotebook);
  skBtn.addEventListener('click', () => { dot.hidden = true; onSkills(); });
  const card = h('section', { class: 'card jobs ljobs', 'aria-labelledby': titleId },
    h('header', { class: 'jobs-head' }, h('span', { class: 'jobs-icon', html: ICONS.clipboard, 'aria-hidden': 'true' }), head, count),
    listWrap, h('footer', { class: 'ljobs-foot' }, nextBtn, nbBtn, skBtn), live);
  parent.appendChild(card);

  const marker = createMarker(ctx, root, { name: 'job-marker', avoid });
  let factsTarget = null; // board id the farmer asked to be pointed to
  ctx.events.on(EV.PANEL_OPEN, (p) => { if (factsTarget && (p.id === factsTarget || p.id === BOARD_PANEL[factsTarget])) factsTarget = null; });
  ctx.events.on(EV.ACTION, (p) => { if (p.id === 'sign.read' && p.board === factsTarget) factsTarget = null; });
  ctx.events.on(EV.SKILL_POINTS, () => { dot.hidden = false; });
  ctx.events.on(EV.JOB_DONE, (p) => { const i = L.engine()?.byKey(p.key); if (i) live.textContent = `Done: ${i.def.title}.`; });

  const front = (s) => (s.z < 0 ? 1 : -1);
  const wallSpot = (s, y = 2.7) => ({ x: s.x, z: s.z + front(s) * 1.1, y, gz: -front(s) * 0.9 });
  const ground = (s, y = 2.2) => ({ x: s.x, z: s.z, y, gz: 0 });
  function nearestHeater(p) { let b = HEATERS[0], bd = Infinity; for (const ht of HEATERS) { const d = Math.hypot(ht.x - p.x, ht.z - p.z); if (d < bd) { bd = d; b = ht; } } return b; }
  function keySpot(k) {
    if (k.startsWith('drinkers.')) return SPOTS2.drinkers[+k.split('.')[1]];
    return SPOTS[k] || SPOTS2[k] || FARM[k] || null;
  }
  function place(s) {
    if (!s) return null;
    // boards and boxes on the house walls: ring in front, gem over the object
    if (s.inside && Math.abs(s.z) > 5.4) return wallSpot(s);
    if (s.inside === false && Math.abs(s.z - 6.4) < 0.3) return wallSpot(s, 2.6);
    return ground(s);
  }
  function uncoveredCell(p) {
    const g = ctx.farm.litter.coverGrid; if (!g) return null;
    let best = null, bd = Infinity;
    for (let i = 0; i < g.length; i++) {
      if (g[i] >= 0.5) continue;
      const x = FLOOR_GRID.x0 + ((i % FLOOR_GRID.nx) + 0.5) * FLOOR_GRID.cell, z = FLOOR_GRID.z0 + (Math.floor(i / FLOOR_GRID.nx) + 0.5) * FLOOR_GRID.cell;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best;
  }
  function spotFor(inst, p) {
    if (factsTarget) return place(BOARD_SPOT[factsTarget]);
    const d = inst.def, st = inst.st, carrying = ctx.props?.carrying;
    const heater = () => ({ x: nearestHeater(p).x, z: nearestHeater(p).z, y: HEATER_HEIGHT + 1.0, gz: 0 });
    switch (d.id) {
      case 'prep-litter': if (carrying === 'barrow') { const c = uncoveredCell(p); return c ? ground(c, 1.6) : null; } break;
      case 'prep-drinkers': case 'r-drinkers': { const left = d.done.values.find((v) => !(String(v) in st.seen)); return place(SPOTS2.drinkers[left ?? 0]); }
      case 'd0-place': return carrying === 'boxes' ? heater() : place(SPOTS2.boxStacks);
      case 'd7-weigh': if (carrying === 'frame') return heater(); break;
      case 'r-dips': return place(st.met[0] ? SPOTS.houseDoor : FARM.footDipGate);
      case 'r-feeders': return place(st.met[0] ? SPOTS2.silo : SPOTS2.feederBox);
      case 'p-wet-patch': if (carrying !== 'sack') return place(SPOTS2.litterHeap); break;
      default: break;
    }
    if ((d.spot === 'dead') && carrying === 'bucket') return place(SPOTS2.deadBin);
    switch (d.spot) {
      case 'heater': return heater();
      case 'heater-out': { const i = ctx.env.brooderOut?.[0] ?? LEVEL1.problems.find((x) => x.id === 'brooder-out')?.heater ?? 0; const ht = HEATERS[i]; return { x: ht.x, z: ht.z, y: HEATER_HEIGHT + 1, gz: 0 }; }
      case 'dead': { const near = ctx.flock?.dead?.near?.(p.x, p.z, 80) || []; return near.length ? ground(near[0], 1.2) : place(SPOTS2.deadBin); }
      case 'leak': { const lk = ctx.farm.water.leak || LEVEL1.problems.find((x) => x.id === 'leaking-nipple'); return lk ? ground({ x: lk.x, z: DRINKER_LINES_Z[lk.line ?? 2] }, 1.6) : null; }
      default: return place(keySpot(d.spot));
    }
  }

  let sig = '', current = null, items = new Map();
  function itemEl(inst, cls, extra) {
    const mark = h('span', { class: 'job-mark', 'aria-hidden': 'true' });
    const title = h('p', { class: 'job-title' }, inst.def.title);
    const body = h('div', { class: 'job-body' }, title, extra || null);
    const li = h('li', { class: `job ${cls}` }, mark, body);
    if (inst.status === 'open') {
      li.tabIndex = 0;
      li.addEventListener('click', () => { L.engine().setCurrent(inst.key); factsTarget = null; sig = ''; });
    }
    return { li, mark, body };
  }
  function render() {
    const eng = L.engine();
    if (!eng) return;
    const env = ctx.env, day = env.dayNumber;
    const cur = eng.current();
    current = cur;
    const all = eng.list();
    const today = all.filter((i) => i.day === day || i.status === 'open');
    const g = eng.groups();
    const waiting = all.filter((i) => i.status === 'waiting' && i.day === day && i.opensAt != null && (!i.def.after)).sort((a, b) => a.opensAt - b.opensAt);
    const missed = today.filter((i) => i.status === 'missed' && i.day === day);
    const done = today.filter((i) => i.status === 'done' && i.day === day);
    const key = [day, cur?.key, factsTarget, ...[...g.pinned, ...g.problems, ...g.preTruck, ...g.rest, ...waiting, ...missed].map((i) => `${i.key}:${i.status}`), done.length].join('|');
    setText(head, roundLabel(env, eng.anchors));
    setText(count, `${done.length} done`);
    if (key === sig) return;
    sig = key;
    items = new Map();
    const sections = [];
    const add = (inst, cls = '') => {
      const isCur = cur && inst.key === cur.key;
      let extra = null;
      if (isCur) {
        const where = h('p', { class: 'job-where' }, h('span', { html: ICONS.pin, 'aria-hidden': 'true' }), h('span', null, JOB_WHERE[inst.id] || ''));
        const links = inst.def.signs.length ? h('p', { class: 'job-facts' }, h('span', { class: 'job-facts-k' }, 'Facts:'),
          inst.def.signs.map((id) => { const b = button({ class: `fact-link${factsTarget === id ? ' is-on' : ''}` }, BOARDS[id].title); b.addEventListener('click', (e) => { e.stopPropagation(); factsTarget = factsTarget === id ? null : id; sig = ''; }); return b; })) : null;
        const bar = h('span', { class: 'job-bar' });
        const prog = hasBar(inst) ? h('div', { class: 'job-progress' }, bar) : null;
        const ptext = hasBar(inst) ? h('p', { class: 'job-ptext' }) : null;
        extra = [where, links, prog, ptext];
        items.set(inst.key, { bar, ptext, inst });
      }
      const it = itemEl(inst, `${cls}${isCur ? ' is-current' : ''}${inst.def.pin ? ' is-pin' : ''}`, extra);
      it.mark.innerHTML = inst.def.kind === 'problem' ? ICONS.eye : inst.def.pin ? ICONS.pin : '';
      if (inst.def.kind === 'problem') it.body.firstChild.prepend(h('span', { class: 'chip-new' }, 'new'));
      if (isCur) it.li.setAttribute('aria-current', 'step');
      return it.li;
    };
    const pin = [...g.pinned, ...g.problems];
    if (pin.length) sections.push(h('ol', { class: 'jobs-list ljobs-pin' }, pin.map((i) => add(i))));
    if (g.preTruck.length) sections.push(h('p', { class: 'ljobs-group' }, h('span', { html: ICONS.truck, 'aria-hidden': 'true' }), 'Before the truck'), h('ol', { class: 'jobs-list' }, g.preTruck.map((i) => add(i))));
    if (g.rest.length) sections.push(h('ol', { class: 'jobs-list' }, g.rest.map((i) => add(i))));
    if (!pin.length && !g.preTruck.length && !g.rest.length) sections.push(h('p', { class: 'ljobs-none' }, waiting.length ? 'No job open now.' : 'No more jobs today. Next job skips the clock.'));
    if (waiting.length) {
      // jobs that open later today: one line per opening time ("Afternoon round · 5 jobs from 13:00")
      const byTime = new Map();
      for (const i of waiting) { const t = hhmm(splitDay(i.opensAt).hour); if (!byTime.has(t)) byTime.set(t, []); byTime.get(t).push(i); }
      sections.push(h('ol', { class: 'jobs-list ljobs-later' }, [...byTime.entries()].slice(0, 3).map(([t, group]) => {
        if (group.length === 1) {
          const li = itemEl(group[0], 'is-waiting').li;
          li.querySelector('.job-mark').textContent = '';
          li.querySelector('.job-title').append(h('span', { class: 'job-when' }, ` from ${t}`));
          return li;
        }
        const hr = splitDay(group[0].opensAt).hour + 1e-6, R = LEVEL1.rounds;
        const name = hr >= R.am.from && hr < R.am.to ? R.am.label : hr >= R.pm.from && hr < R.pm.to ? R.pm.label : hr >= R.eve.from ? R.eve.label : 'Later';
        return h('li', { class: 'job is-waiting', title: group.map((i) => i.def.title).join(' · ') }, h('span', { class: 'job-mark', 'aria-hidden': 'true' }),
          h('div', { class: 'job-body' }, h('p', { class: 'job-title' }, `${name} · ${group.length} jobs`, h('span', { class: 'job-when' }, ` from ${t}`))));
      })));
    }
    if (missed.length) {
      // jobs whose window passed: one count line, the titles when he opens it
      const det = h('details', { class: 'ljobs-missed' }, h('summary', null, `${missed.length} not done today`),
        h('ol', { class: 'jobs-list' }, missed.map((i) => itemEl(i, 'is-missed').li)));
      det.open = missedOpen;
      det.addEventListener('toggle', () => { missedOpen = det.open; });
      sections.push(det);
    }
    list.replaceChildren(...sections);
    ctx.props?.highlight?.(cur ? cur.def.signs : []);
  }

  let acc = 0;
  return {
    el: card,
    get factsTarget() { return factsTarget; },
    reset() { factsTarget = null; sig = ''; dot.hidden = true; },
    refresh() { sig = ''; render(); },
    update(dt, panelOpen) {
      acc -= dt;
      if (acc <= 0) {
        acc = 0.25; render(); setText(nextBtn.lastChild, nextLabel());
        const overflow = list.scrollHeight > list.clientHeight + 4 && list.scrollTop + list.clientHeight < list.scrollHeight - 4;
        if (more.hidden === overflow) { more.hidden = !overflow; listWrap.classList.toggle('has-more', overflow); }
      }
      for (const { bar, ptext, inst } of items.values()) {
        bar.style.transform = `scaleX(${Math.max(0, Math.min(1, inst.progress)).toFixed(3)})`;
        if (ptext) setText(ptext, progressText(inst, ctx));
      }
      const p = ctx.player.position;
      marker.update(dt, current ? spotFor(current, p) : null, p, panelOpen);
    },
    hide() { marker.hide(); },
  };
}
