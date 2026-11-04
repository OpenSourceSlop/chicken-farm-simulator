// The level job card (HUD, top right) and the marker over the current job (PHASE2.md §3.4–§3.5).
// Header "Day 3 · Morning round 06:00–12:00"; pinned anchor jobs, then problem jobs ("new"), then on
// day 0 the "Before the truck" group, then the rest in list order; jobs later today dimmed with
// their time; done jobs fold into a count, missed ones struck through. The current job shows where
// to go, its fact links and its bar. Footer: Next job, Notebook (N), Skill tree (K).
// Phase 3 (PHASE3.md §3.2): headers for the planning day, the clean-out and the rest; the facts links read
// the merged boards of the day; the cycle's spots (SPOTS3, the lame bird, the stopped fan, the next bait
// station or swab place). Owner: package "run" (Phase 2: "level").
import { CLEAN, DRINKER_LINES_Z, FARM, FLOOR_GRID, HEATERS, HEATER_HEIGHT, LEVEL1, ROUNDS, SPOTS, SPOTS2, SPOTS3 } from './config.js';
import { BOARDS } from './content-signs.js';
import { boardsForDay } from './content-signs-cycle.js';
import { jobWhere } from './content-jobs.js';
import { FAN_Z } from './house-fans.js';
import { EV } from './events.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { createMarker } from './ui-marker.js';
import { hhmm, splitDay } from './ui-format.js';
import { heldText, waitsOnTime } from './job-strips.js';
// the steps hotfix: the next unfinished place of a job that spans several places (the card's Next line and the marker)
import { jobPlaces, nextPlace } from './job-next.js';
import { flowToday, nippleCmToday, rimCmNow, nippleInBand, rimInBand, ventNeed, luxOfDimmer, brooderRowC, LINES_UP_CM, PANS_UP_CM, NIPPLE_DAY0_CM } from './job-figures.js';

const BOARD_SPOT = {
  'sign-gate': SPOTS.signGate, 'sign-brooder': SPOTS.signBrooder, 'sign-water': SPOTS2.signWater, 'sign-vent': SPOTS2.signVent,
  'sign-litter': SPOTS2.signLitter, 'sign-chicks': SPOTS2.signChicks, 'sign-health': SPOTS2.signHealth, 'feeder-box': SPOTS2.feederBox,
  silo: SPOTS2.silo, 'controller-lights': SPOTS.controller, 'bird-scale': SPOTS2.birdScale, 'water-supply': SPOTS2.waterSupply, drinker: SPOTS2.drinkers[0],
  // Phase 3 boards and plates
  'sign-plan': SPOTS3.signPlan, 'sign-light': SPOTS3.signLight, 'sign-curtain': SPOTS3.signCurtain, 'sign-legs': SPOTS3.signLegs, 'sign-air': SPOTS3.signAir,
  'sign-droppings': SPOTS3.signDroppings, 'sign-heat': SPOTS3.signHeat, 'sign-feed': SPOTS3.signFeed, 'sign-catch': SPOTS3.signCatch, 'sign-clean': SPOTS3.signClean,
  'guard-hut': SPOTS3.guardHut, 'plan-sheet': SPOTS2.officeDesk, vaccine: SPOTS2.waterSupply, medicator: SPOTS2.waterSupply, 'pad-pump': SPOTS3.padPump,
  'fan-panel': SPOTS3.fanPanel, 'gas-tank': SPOTS3.gasTank, 'bird-check': SPOTS2.birdScale, 'loading-bay': SPOTS3.loadingBay, 'wash-bay': SPOTS3.washBay,
};
/** The panel that shows a board or plate (a plate lives inside its machine). */
export const BOARD_PANEL = { 'controller-lights': 'controller', drinker: 'drinker-0', vaccine: 'water-supply', medicator: 'water-supply', 'plan-sheet': 'office-desk' };
const boardTitle = (id, day) => boardsForDay(day)[id]?.title ?? BOARDS[id]?.title ?? id;

/** Round label for the card header. */
export function roundLabel(env, anchors, farm = null) {
  const d = env.dayNumber, hr = env.hour;
  if (d <= -2) return 'Planning day · no birds yet';
  if (d < 0) return 'Prep day — chicks arrive tomorrow 08:00';
  if (d >= 43 && d <= 46) return `Clean-out day ${d - 42}`;
  if (d > 46) { const b = farm?.clean?.bookedDay; return `Rest day ${d - 46}${b != null ? ` · chicks booked for day ${b}` : ''}`; }
  if (d === 42) return 'Day 42 · the catch';
  if (d === 0 && hr < LEVEL1.arrivalHour && hr >= 6) return 'Day 0 · Before the truck (08:00)';
  if (d === 0 && anchors.truck != null && anchors.placed == null) return 'Day 0 · The chicks are here';
  const R = LEVEL1.rounds;
  const span = (r) => `${r.label} ${hhmm(r.from)}–${hhmm(r.to)}`;
  if (hr >= R.am.from && hr < R.am.to) return `Day ${d} · ${span(R.am)}`;
  if (hr >= R.pm.from && hr < R.pm.to) return `Day ${d} · ${span(R.pm)}`;
  if (hr >= R.pm.to && d >= 15 && hr < ROUNDS.night.to) return `Day ${d} · ${span(ROUNDS.night)}`;
  if (hr >= R.pm.to) return `Day ${d} · ${span(R.eve)}`;
  if (hr >= R.am.to && hr < R.pm.from) return `Day ${d} · Midday`;
  return `Day ${d} · Night`;
}

// Text under the bar: what has been done of the job so far, in plain counts.
const READ_UNIT = { 'floor.probe': ['tempC', '°C'], 'light.lux': ['lux', 'lux'], 'air.probe': ['speedMs', 'm/s'], 'sample.vent': ['tempC', '°C'] };
const EACH_WORD = { line: 'lines', spot: 'places', part: 'parts', item: 'items', truck: 'tickets', axis: 'measures' };
function progressText(inst, ctx) {
  const r = inst.def.done, st = inst.st;
  switch (r.type) {
    case 'each': return `${r.values.filter((v) => String(v) in st.seen).length} / ${r.values.length} ${EACH_WORD[r.key] || 'done'}`;
    case 'count': {
      const parts = [`${st.list.length} / ${r.n}`];
      if (r.sectors) parts.push(`${new Set(st.list.map((x) => x.s)).size} / ${r.sectors} parts of the floor`);
      if (r.nearDrinker) parts.push(`${Math.min(r.nearDrinker, st.list.filter((x) => x.near).length)} / ${r.nearDrinker} under a line`);
      // the readings themselves, for the measuring jobs (T, L, V, vent temperatures)
      const unit = READ_UNIT[r.id];
      if (unit) { const v = st.list.map((x) => x.r?.[unit[0]]).filter(Number.isFinite).slice(-6); if (v.length) parts.push(`${v.map((x) => (unit[1] === 'lux' ? Math.round(x) : x.toFixed(1))).join(' · ')} ${unit[1]}`); }
      return parts.join(' · ');
    }
    case 'coverage': {
      const c = ctx.level?.engine?.coverage?.(inst) || { seen: st.cells.length, need: r.frac * 300, size: 300 };
      const capped = c.need < r.frac * c.size - 1e-6;   // a walk capped at week 1's cells (PHASE3.md §3.1 maxCells)
      const seen = capped ? `floor walked ${Math.min(100, Math.round((100 * c.seen) / c.need))} % of the walk` : `floor seen ${Math.round((c.seen / c.size) * 100)} %`;
      return `${seen}${r.listen ? (st.listened ? ' · listened' : ' · stand still to listen') : ''}`;
    }
    case 'state': {
      const f = ctx.farm;
      if (r.test === 'litter-covered') return `floor covered ${Math.round((f.litter.cover ?? 0) * 100)} %`;
      if (r.test === 'lines-flushed') return `${f.water.lines.filter((l) => l.flushClear >= 0.99).length} / 4 lines ran clear`;
      if (r.test === 'pans-flooded') return `${f.feed.lines.filter((l) => l.flood && l.panFill >= 0.95).length} / 3 lines flooded and full`;
      if (r.test === 'all-placed') return `${Math.round((f.flock.placed || 0) / (LEVEL1.chicksPlaced / LEVEL1.stacks))} / ${LEVEL1.stacks} stacks tipped`;
      const g = f.litter?.coverGrid, cover = g ? Array.from(g).reduce((a, v) => a + Math.min(1, v), 0) / g.length : 0, C = f.clean || {};
      if (r.test === 'house-ready') return `house floor covered ${Math.round(cover * 100)} %`;
      if (r.test === 'litter-removed') return `litter left on the floor ${Math.round(cover * 100)} %`;
      if (r.test === 'house-washed') return `floor washed ${Math.round((C.washShare ?? 0) * 100)} %`;
      if (r.test === 'house-disinfected') return `floor disinfected ${Math.round((C.sprayShare ?? 0) * 100)} %`;
      if (r.test === 'house-dry') return `floor wet ${Math.round((C.wetShare ?? 0) * 100)} %`;
      if (r.test === 'lines-disinfected') return `${(C.lines || []).filter((v) => v >= 1).length} / 4 lines disinfected`;
      if (r.test === 'pans-grower' || r.test === 'pans-finisher') { const t = r.test.slice(5); return `${t} in the pans ${Math.round((f.feed?.panType?.[t] ?? 0) * 100)} %`; }
      return stateText(r.test, inst, ctx);
    }
    case 'all': case 'any': {
      // every part by its name (content-jobs labels), done or not yet; a part that must hold says for how long
      const parts = ctx.level?.engine?.parts?.(inst) || [];
      if (!parts.some((p) => p.label)) return `${st.met.filter(Boolean).length} / ${r.of.length}`;
      return parts.map((p) => (p.held && !p.met ? `○ ${heldText(p)}` : `${p.met ? '✓' : '○'} ${p.label || ''}`)).join('\n');
    }
    default: return '';
  }
}
/** The card's line for the clarity round's state tests (and the ones that had no bar). */
function stateText(test, inst, ctx) {
  const f = ctx.farm, env = ctx.env, W = f.water.lines, F = f.feed.lines, held = ctx.level?.engine?.parts?.(inst)?.[0];
  if (held?.held) return heldText({ ...held, label: held.label || 'Near the target' });
  const n = (list, ok) => list.filter(ok).length;
  switch (test) {
    case 'preheat-on': return `thermostat ${env.heaterSetpoint.toFixed(1)} °C (brooder sign, day 0: ${brooderRowC(0)} °C) · brooders ${env.heatersOn ? 'burning' : 'off'}`;
    case 'nipples-at': return `${n(W, (l) => l.heightCm >= NIPPLE_DAY0_CM[0] && l.heightCm <= NIPPLE_DAY0_CM[1])} / 4 lines at 10–12 cm`;
    case 'lines-raised': return `drinker lines ${n(W, (l) => nippleInBand(l.heightCm, env))} / 4 near ${Math.round(nippleCmToday(env))} cm · pans ${n(F, (l) => rimInBand(l.heightCm, env))} / 3 near ${Math.round(rimCmNow(env))} cm`;
    case 'lines-up': return `${n(W, (l) => l.heightCm >= LINES_UP_CM)} / 4 lines lifted to ${LINES_UP_CM} cm or more`;
    case 'all-up': return `drinker lines up ${n(W, (l) => l.heightCm >= LINES_UP_CM)} / 4 · pans up ${n(F, (l) => l.heightCm >= PANS_UP_CM)} / 3 · brooders ${env.broodersUp ? 'up' : 'down'}`;
    case 'dead-cleared': { const d = f.flock.deadOnFloor ?? 0; return d > 0 ? `dead birds on the floor: ${d}${ctx.props?.carrying === 'bucket' ? ' · bucket in your hand' : ''}` : ctx.props?.carrying === 'bucket' ? 'bucket in your hand: count them at the bin' : 'no dead birds on the floor this round'; }
    case 'lame-cleared': return `birds that cannot walk well, sitting apart: ${f.flock.lameOnFloor ?? 0}`;
    case 'house-empty': return f.harvest?.started ? `birds still in the house: ${Math.round(f.flock.alive)} · tunnel fans running ${env.fansEffective ?? 0} (catch sign: at least three)` : 'the crew starts at the booked time';
    case 'vaccine-drunk': return ({ none: 'main valve open, no vaccine yet', thirst: 'main valve shut: the birds get thirsty', mixed: 'vaccine in the header tank: open the main valve', drinking: 'the birds are drinking the vaccine: walk them up', drunk: 'header tank empty' })[f.health?.vaccine?.state] || '';
    case 'feeders-checked': return `${n(F, (l) => l.running && l.panFill >= 0.3 && (env.dayNumber < 4 || rimInBand(l.heightCm, env)))} / 3 lines on, fed${env.dayNumber >= 4 ? `, rims near ${Math.round(rimCmNow(env))} cm` : ''}`;
    case 'flows-in-band': return `flow target ${flowToday(env)} ml/min (age + 20)`;
    case 'vent-in-band': { const v = ventNeed(env, f); return `timer air ${Math.round(v.air)} of about ${Math.round(v.need)} m³/h the table gives (${Math.round(v.share * 100)} %)`; }
    case 'chick-lights': case 'catch-ready': case 'dark-period': { const p = env.lightProgram || f.light || {}; return `dark ${p.darkHours ?? 1} h · dimmer ${Math.round((p.dimmer ?? 1) * 100)} % ≈ ${Math.round(luxOfDimmer(p.dimmer))} lux`; }
    default: return '';
  }
}
const BAR_TESTS = ['litter-covered', 'lines-flushed', 'pans-flooded', 'all-placed', 'house-ready', 'litter-removed', 'house-washed', 'house-disinfected', 'house-dry', 'lines-disinfected', 'pans-grower', 'pans-finisher',
  // the clarity round: every state with a measure of how far it is, and the ones that must hold for farm minutes
  'preheat-on', 'nipples-at', 'lines-raised', 'lines-up', 'all-up', 'feeders-checked', 'dead-cleared', 'lame-cleared', 'house-empty', 'vaccine-drunk',
  'house-near-target', 'rh-under', 'air-clear', 'heat-handled', 'pad-humid-ok', 'night-comfort', 'chick-lights', 'catch-ready', 'vent-in-band', 'flows-in-band'];
const hasBar = (inst) => { const t = inst.def.done.type; return t === 'each' || t === 'count' || t === 'coverage' || t === 'all' || t === 'any' || (t === 'state' && BAR_TESTS.includes(inst.def.done.test)); };

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
    return SPOTS[k] || SPOTS2[k] || SPOTS3[k] || FARM[k] || null;
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
  function coveredCell(p) {
    const g = ctx.farm.litter.coverGrid; if (!g) return null;
    let best = null, bd = Infinity;
    for (let i = 0; i < g.length; i++) {
      if (g[i] < 0.5) continue;
      const x = FLOOR_GRID.x0 + ((i % FLOOR_GRID.nx) + 0.5) * FLOOR_GRID.cell, z = FLOOR_GRID.z0 + (Math.floor(i / FLOOR_GRID.nx) + 0.5) * FLOOR_GRID.cell;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best;
  }
  const cardCtx = () => ({ env: ctx.env, farm: ctx.farm, props: ctx.props, flock: ctx.flock, engine: L.engine() });
  const here = (p) => ({ x: p.x, z: p.z, inside: !!ctx.player?.isInside });
  function nearestOf(list, p) { let b = null, bd = Infinity; for (const s of list) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; b = s; } } return b; }
  function spotFor(inst, p) {
    if (factsTarget) return place(BOARD_SPOT[factsTarget]);
    const d = inst.def, st = inst.st, carrying = ctx.props?.carrying;
    const heater = () => ({ x: nearestHeater(p).x, z: nearestHeater(p).z, y: HEATER_HEIGHT + 1.0, gz: 0 });
    switch (d.id) {
      case 'prep-litter': if (carrying === 'barrow') { const c = uncoveredCell(p); return c ? ground(c, 1.6) : null; } break;
      case 'w2-ready': if (carrying === 'barrow') { const c = uncoveredCell(p); return c ? ground(c, 1.6) : null; } break;
      case 'w45-brooders': return place(SPOTS.controller); // the brooders go off and up at the controller (Temperature)
      default: break;
    }
    // the steps hotfix: a job that spans several places points to its nearest unfinished place (the next regulator,
    // the silo after the feeder box, a part of the floor not sampled yet, the bin with the bucket in hand)
    const np = nextPlace(inst, cardCtx(), { from: here(p) });
    if (np) return np.id.startsWith('floor:') ? ground(np.at, 1.6) : place(np.at);
    switch (d.id) {
      case 'd7-weigh': if (carrying === 'frame') return heater(); break;
      case 'c-litter': if (carrying === 'scraper') { const c = coveredCell(p); return c ? ground(c, 1.6) : null; } break;
      case 'w3-topup': case 'p-pad-patch': if (carrying === 'sack' || carrying === 'fork') return null; break;
      default: break;
    }
    if ((d.spot === 'dead') && carrying === 'bucket') return place(SPOTS2.deadBin);
    switch (d.spot) {
      case 'heater': return heater();
      case 'heater-out': { const i = ctx.env.brooderOut?.[0] ?? LEVEL1.problems.find((x) => x.id === 'brooder-out')?.heater ?? 0; const ht = HEATERS[i]; return { x: ht.x, z: ht.z, y: HEATER_HEIGHT + 1, gz: 0 }; }
      case 'dead': { const near = ctx.flock?.dead?.near?.(p.x, p.z, 80) || []; return near.length ? ground(near[0], 1.2) : place(SPOTS2.deadBin); }
      case 'leak': { const lk = ctx.farm.water.leak || LEVEL1.problems.find((x) => x.id === 'leaking-nipple'); return lk ? ground({ x: lk.x, z: DRINKER_LINES_Z[lk.line ?? 2] }, 1.6) : null; }
      case 'lame': { const b = nearestOf((ctx.flock?.debug?.sickBirds?.() || []).filter((x) => x.lame), p); return b ? ground(b, 1.2) : place(SPOTS2.birdScale); }
      case 'fan-broken': { const i = (ctx.env.fansBroken || [])[0] ?? 3; return { x: 23.2, z: FAN_Z[i] ?? 0, y: 2.6, gz: 0 }; }
      case 'bait': { const left = SPOTS3.bait.filter((b, i) => !ctx.farm.clean?.baits?.[i]); return place(nearestOf(left.length ? left : SPOTS3.bait, p)); }
      case 'swab': {
        if (carrying !== 'swabs') return place(SPOTS3.washBay);
        const left = CLEAN.swabSpots.filter((s, i) => !(String(i) in (st.seen || {})));
        const s = nearestOf(left.length ? left : CLEAN.swabSpots, p);
        return s ? ground(s, 1.4) : null;
      }
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
    setText(head, roundLabel(env, eng.anchors, ctx.farm));
    setText(count, `${done.length} done`);
    if (key === sig) return;
    sig = key;
    items = new Map();
    const sections = [];
    const add = (inst, cls = '') => {
      const isCur = cur && inst.key === cur.key;
      let extra = null;
      if (isCur) {
        const where = h('p', { class: 'job-where' }, h('span', { html: ICONS.pin, 'aria-hidden': 'true' }), h('span', null, jobWhere(inst.id)));
        const next = h('p', { class: 'job-next', hidden: true });
        const links = inst.def.signs.length ? h('p', { class: 'job-facts' }, h('span', { class: 'job-facts-k' }, 'Facts:'),
          inst.def.signs.map((id) => { const b = button({ class: `fact-link${factsTarget === id ? ' is-on' : ''}` }, boardTitle(id, day)); b.addEventListener('click', (e) => { e.stopPropagation(); factsTarget = factsTarget === id ? null : id; sig = ''; }); return b; })) : null;
        const bar = h('span', { class: 'job-bar' });
        const prog = hasBar(inst) ? h('div', { class: 'job-progress' }, bar) : null;
        const ptext = hasBar(inst) ? h('p', { class: 'job-ptext' }) : null;
        extra = [where, next, links, prog, ptext];
        items.set(inst.key, { bar, ptext, inst, next });
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
        const name = hr >= R.am.from && hr < R.am.to ? R.am.label : hr >= R.pm.from && hr < R.pm.to ? R.pm.label : day >= 15 && hr >= ROUNDS.night.from && hr < ROUNDS.night.to ? ROUNDS.night.label : hr >= R.eve.from ? R.eve.label : 'Later';
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

  /** The card's Next line: the nearest unfinished place of a multi-place job, and the pause while the job waits on farm time. */
  function nextLine(inst) {
    const c = cardCtx(), p = ctx.player?.position, out = [];
    if (inst.status === 'open' && jobPlaces(inst, c)) { const np = p && nextPlace(inst, c, { from: here(p) }); if (np) out.push(`Next: ${np.text}`); }
    if (ctx.level?.hudHooks?.userPaused && waitsOnTime(inst, c)) out.push('The clock is paused: this job waits on farm time. Press ▶ (top left).');
    return out.join(' ');
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
      const slow = acc === 0.25;
      for (const { bar, ptext, inst, next } of items.values()) {
        bar.style.transform = `scaleX(${Math.max(0, Math.min(1, inst.progress)).toFixed(3)})`;
        if (ptext) setText(ptext, progressText(inst, ctx));
        if (slow && next) { setText(next, nextLine(inst)); next.hidden = !next.textContent; }
      }
      const p = ctx.player.position;
      marker.update(dt, current ? spotFor(current, p) : null, p, panelOpen);
    },
    hide() { marker.hide(); },
  };
}
