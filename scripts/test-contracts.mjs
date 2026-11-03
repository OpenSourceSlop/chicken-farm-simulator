// Node tests for the shared, integrator-owned Phase 2 contracts: the event bus and matchPayload
// (events.js), the interact registry's priority rule (interact.js), and the content tables every
// package reads (content-jobs.js, content-signs.js, skills.js milestone texts). Owner: integrator.
// Run: node scripts/test-contracts.mjs   (also part of `npm test`)
import { createEvents, matchPayload, EV } from '../src/events.js';
import { createInteract } from '../src/interact.js';
import { JOBS, STATE_TEST_IDS } from '../src/content-jobs.js';
import { BOARDS, BOARD_IDS, sourceLabel } from '../src/content-signs.js';
import { MILESTONES } from '../src/skills.js';
import { SPOTS, SPOTS2, FARM, GUIDES } from '../src/config.js';
// Phase 3 contracts (PHASE3.md §13)
import { ACTION_IDS } from '../src/events.js';
import { JOBS_CYCLE, STATE_TEST_IDS_CYCLE, JOB_WHERE_CYCLE } from '../src/content-jobs-cycle.js';
import { BOARDS_CYCLE, BOARD_EXTRA_ITEMS, BOARD_IDS_CYCLE, boardsForDay } from '../src/content-signs-cycle.js';
import { MILESTONES_CYCLE } from '../src/skills-cycle.js';
import { ALL_MILESTONES } from '../src/skills.js';
import { planSums, planOutcome } from '../src/farm-plan.js';
import { SPOTS3, LEVELS, LEVEL1, CYCLE, UNLOCKS, SKILL_BRANCHES, SKILL_LEVEL_POINTS, levelOfDay, feedStdGAt, MIN_VENT_PER_1000 } from '../src/config.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

test('events: handlers run in order, a throwing one does not stop the rest', () => {
  const bus = createEvents(), got = [];
  const err = console.error; console.error = () => {};
  bus.on('x', () => got.push(1)); bus.on('x', () => { throw new Error('boom'); }); bus.on('x', () => got.push(3));
  bus.on('*', (p, t) => got.push(t));
  bus.emit('x', {});
  console.error = err;
  assert(got.join(',') === '1,3,x', got.join(','));
});

test('matchPayload: flat keys, nested result, missing keys', () => {
  const action = { id: 'water.clearFilter', line: 1, result: { fixed: true, minutes: 5 } };
  assert(matchPayload(action, { id: 'water.clearFilter' }), 'flat');
  assert(matchPayload(action, { result: { fixed: true } }), 'nested subset');
  assert(!matchPayload(action, { result: { fixed: false } }), 'nested mismatch');
  assert(!matchPayload(action, { fixed: true }), 'a flat key does not look inside result');
  assert(!matchPayload({ id: 'x' }, { result: { fixed: true } }), 'missing nested');
  assert(matchPayload({ where: 'gate' }, null), 'no pattern matches');
});

test('interact: priority beats distance, fixed beat default providers, null providers ignored', () => {
  const reg = createInteract([{ id: 'controller', label: 'Climate controller', x: 0, z: 0, radius: 1.5 }]);
  const at = (x, z) => ({ position: { x, z }, isInside: true });
  // three overlapping providers, all within reach of the farmer at (5, 0)
  reg.addProvider('litter', (p) => ({ id: 'litter', label: 'litter', x: p.x, z: p.z, radius: 1 }));            // d = 0, priority 0
  reg.addProvider('dead-bird', () => ({ id: 'dead-bird', label: 'dead bird', x: 5.8, z: 0, radius: 1.2, priority: 6 }));
  reg.addProvider('tip', () => null);                                                                       // hands empty: no tip
  assert(reg.nearest(at(5, 0)).id === 'dead-bird', 'dead bird (priority 6) beats litter at the feet (0)');
  reg.addProvider('tip', (p) => ({ id: 'tip', label: 'tip', x: p.x, z: p.z + 0.3, radius: 2, priority: 20 }));
  assert(reg.nearest(at(5, 0)).id === 'tip', 'tip while carrying boxes (20) beats the dead bird');
  assert(reg.nearest(at(0.5, 0)).id === 'tip', 'priority 20 beats a fixed board (10)');
  reg.removeProvider('tip');
  assert(reg.nearest(at(0.5, 0)).id === 'controller', 'fixed (10) beats dead bird (6) and litter (0)');
  // a dead bird at the feet (within its nearRadius 0.8 m: nearPriority 15) beats the board behind it;
  // 1.2 m away the board answers again, and a tip while carrying (20) still wins
  const reg2 = createInteract([{ id: 'sign-vent', label: 'Minimum ventilation', x: 0, z: -1, radius: 2 }]);
  let bird = { x: 0.5, z: 0 };
  reg2.addProvider('dead-bird', () => bird && ({ id: 'dead-bird', label: 'dead bird', x: bird.x, z: bird.z, radius: 1.5, priority: 6, nearRadius: 0.8, nearPriority: 15 }));
  assert(reg2.nearest(at(0, 0)).id === 'dead-bird', 'dead bird 0.5 m away beats the board (2 m reach)');
  bird = { x: 1.2, z: 0 };
  assert(reg2.nearest(at(0, 0)).id === 'sign-vent', 'dead bird 1.2 m away: the board answers');
  bird = null;
  assert(reg2.nearest(at(0, 0)).id === 'sign-vent', 'no dead bird: the board answers');
  bird = { x: 0.3, z: 0 };
  reg2.addProvider('tip', (p) => ({ id: 'tip', label: 'tip', x: p.x, z: p.z, radius: 2, priority: 20 }));
  assert(reg2.nearest(at(0, 0)).id === 'tip', 'carrying boxes: the tip (20) beats a bird at the feet (15)');
  const err = console.error; console.error = () => {};
  reg.addProvider('broken', () => { throw new Error('x'); });
  assert(reg.nearest(at(5, 0)).id === 'dead-bird', 'a throwing provider is skipped');
  console.error = err;
});

test('signs: every item has a known source, no page numbers', () => {
  for (const [id, b] of Object.entries(BOARDS)) {
    assert(b.title && b.items.length, `${id} empty`);
    for (const it of b.items) {
      for (const k of [].concat(it.source)) assert(k === 'week1-4' || k in GUIDES, `${id}: unknown source ${k}`);
      assert(!/\bp\.\s*\d|\bpage\b/i.test(it.text + sourceLabel(it.source)), `${id}: page reference in "${it.text}"`);
    }
  }
});

test('jobs: signs, spots and state tests resolve', () => {
  const spotOk = (s) => s in SPOTS || s in SPOTS2 || s in FARM || /^drinkers\.[0-3]$/.test(s) || ['heater', 'heater-out', 'dead', 'leak'].includes(s);
  const ids = new Set();
  for (const j of JOBS) {
    assert(!ids.has(j.id), `duplicate job ${j.id}`); ids.add(j.id);
    assert(spotOk(j.spot), `${j.id}: spot ${j.spot}`);
    for (const s of j.signs) assert(BOARD_IDS.includes(s), `${j.id}: sign ${s} not in content-signs`);
    const walk = (r) => { if (r.type === 'state') assert(STATE_TEST_IDS.includes(r.test), `${j.id}: state ${r.test}`); (r.of || []).forEach(walk);
      if (r.type === 'event') assert(Object.values(EV).includes(r.event), `${j.id}: event ${r.event}`); };
    walk(j.done);
  }
});

test('player-facing words: no verdicts in job titles, signs or milestone texts', () => {
  const bad = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;
  const texts = [...JOBS.map((j) => j.title), ...Object.values(BOARDS).flatMap((b) => b.items.map((i) => i.text)), ...MILESTONES.map((m) => m.text)];
  for (const t of texts) assert(!bad.test(t), `verdict word in "${t}"`);
});

// ---------------- Phase 3 (PHASE3.md §13) ----------------
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;
const ALL_JOBS = [...JOBS, ...JOBS_CYCLE];
const ALL_BOARD_IDS = new Set([...BOARD_IDS, ...BOARD_IDS_CYCLE]);
const DYNAMIC_SPOTS = ['heater', 'heater-out', 'dead', 'leak', 'lame', 'fan-broken', 'bait'];
const CHECKPOINTS = ['plan', 'placed', 'vent', 'crop', 'weighin', 'curtain', 'vaccine', 'heatwave', 'catch', 'harvest', 'clean', 'swabs', 'rest', 'level-end', 'problem', 'day'];

test('cycle: levels are one contiguous calendar from the planning day to the rest', () => {
  assert(LEVELS[0].id === 'plan' && LEVELS[1] === LEVEL1, 'plan first, then Phase 2\'s level');
  for (let i = 1; i < LEVELS.length; i++) assert(LEVELS[i].startDay === LEVELS[i - 1].endDay + 1, `${LEVELS[i].id} starts the day after ${LEVELS[i - 1].id}`);
  assert(LEVELS[LEVELS.length - 1].endDay === CYCLE.lastDay, 'clean-out runs to CYCLE.lastDay');
  for (const l of LEVELS) {
    assert(l.rounds && l.clock && l.target && Array.isArray(l.problems), `${l.id}: rounds, clock, target, problems`);
    for (const d of l.weighDays || []) assert(d >= l.startDay && d <= l.endDay, `${l.id}: weigh day ${d}`);
    for (const p of l.problems) assert(p.id && (p.conditional || Number.isFinite(p.day)), `${l.id}: problem ${p.id}`);
  }
  for (let a = 0; a <= 7; a += 0.25) assert(Math.abs(feedStdGAt(a) - (12 + 4 * a)) < 1e-9, `feedStdGAt(${a}) is Phase 2's`);
  assert(JSON.stringify(MIN_VENT_PER_1000.slice(0, 3)) === '[[40,150],[100,290],[200,480]]', 'min vent table to 200 g is Phase 2\'s');
});

test('cycle jobs: ids, days, spots, signs, rules, anchors and actions resolve', () => {
  const ids = new Set();
  const problemIds = new Set(['abnormal-deaths', ...LEVELS.flatMap((l) => l.problems.map((p) => p.id))]);
  const spotOk = (s) => s in SPOTS || s in SPOTS2 || s in SPOTS3 || s in FARM || /^drinkers\.[0-3]$/.test(s) || DYNAMIC_SPOTS.includes(s);
  for (const j of ALL_JOBS) {
    assert(!ids.has(j.id), `duplicate job ${j.id}`); ids.add(j.id);
    assert(spotOk(j.spot), `${j.id}: spot ${j.spot}`);
    for (const s of j.signs) assert(ALL_BOARD_IDS.has(s), `${j.id}: sign ${s}`);
    if (j.kind === 'problem') assert(problemIds.has(j.problem), `${j.id}: problem ${j.problem} in no level`);
    const walk = (r) => {
      if (r.type === 'state') assert([...STATE_TEST_IDS, ...STATE_TEST_IDS_CYCLE].includes(r.test), `${j.id}: state ${r.test}`);
      if (r.type === 'event') assert(Object.values(EV).includes(r.event), `${j.id}: event ${r.event}`);
      if (['action', 'each', 'count'].includes(r.type)) assert(ACTION_IDS.includes(r.id), `${j.id}: action ${r.id} not in ACTION_IDS`);
      (r.of || []).forEach(walk);
    };
    walk(j.done);
  }
  for (const j of JOBS_CYCLE) {
    assert(JOB_WHERE_CYCLE[j.id], `${j.id}: no where line`);
    const day = j.kind === 'dated' ? j.day : j.kind === 'routine' ? j.days[0] : null;
    if (day == null) continue;
    const lv = levelOfDay(day);
    if (j.onDays) for (const d of j.onDays) assert(d >= j.days[0] && d <= j.days[1], `${j.id}: onDay ${d}`);
    if (j.round === 'rel') assert(['truck', 'placed'].includes(j.rel.anchor) || (lv.anchors && j.rel.anchor in lv.anchors), `${j.id}: anchor ${j.rel.anchor} not in ${lv.id}`);
    else assert(j.window || lv.rounds[j.round], `${j.id}: round ${j.round}`);
  }
  assert(new Set(ACTION_IDS).size === ACTION_IDS.length, 'ACTION_IDS has duplicates');
});

test('cycle signs: known sources, no page numbers, no verdicts; extra lines on real boards', () => {
  for (const [id, b] of Object.entries(BOARDS_CYCLE)) {
    assert(b.title && b.items.length && b.where, `${id} empty`);
    assert(!(id in BOARDS), `${id} already a Phase 2 board`);
    for (const it of b.items) {
      for (const k of [].concat(it.source)) assert(k === 'week1-4' || k in GUIDES, `${id}: unknown source ${k}`);
      assert(!/\bp\.\s*\d|\bpage\b/i.test(it.text), `${id}: page reference`);
      assert(!VERDICT.test(it.text), `${id}: verdict word in "${it.text}"`);
    }
  }
  for (const [id, list] of Object.entries(BOARD_EXTRA_ITEMS)) {
    assert(id in BOARDS, `extra lines for unknown board ${id}`);
    for (const it of list) { assert(Number.isFinite(it.fromDay) && it.fromDay >= 8, `${id}: fromDay`); for (const k of [].concat(it.source)) assert(k === 'week1-4' || k in GUIDES, `${id}: source ${k}`); }
  }
  const day3 = boardsForDay(3), day20 = boardsForDay(20);
  assert(day3['sign-vent'].items.length === BOARDS['sign-vent'].items.length, 'the brooding week reads Phase 2\'s boards');
  assert(day20['sign-vent'].items.length > BOARDS['sign-vent'].items.length, 'extra lines from their day');
  const signSpots = { signPlan: 'sign-plan', signLight: 'sign-light', signCurtain: 'sign-curtain', signLegs: 'sign-legs', signAir: 'sign-air',
    signDroppings: 'sign-droppings', signHeat: 'sign-heat', signFeed: 'sign-feed', signClean: 'sign-clean', signCatch: 'sign-catch' };
  for (const [spot, id] of Object.entries(signSpots)) assert(SPOTS3[spot] && BOARDS_CYCLE[id], `${spot} / ${id}`);
});

test('cycle skills: every branch can reach level 3, three unlocks each, milestones well formed', () => {
  const ids = new Set(MILESTONES.map((m) => m.id));
  assert(ALL_MILESTONES.length === MILESTONES.length + MILESTONES_CYCLE.length, 'ALL_MILESTONES = Phase 2 + cycle');
  const levelIds = LEVELS.map((l) => l.id);
  for (const m of MILESTONES_CYCLE) {
    assert(!ids.has(m.id), `duplicate milestone ${m.id}`); ids.add(m.id);
    assert(SKILL_BRANCHES.some((b) => b.id === m.branch), `${m.id}: branch ${m.branch}`);
    assert(levelIds.includes(m.level), `${m.id}: level ${m.level}`);
    assert(CHECKPOINTS.includes(m.checkpoint), `${m.id}: checkpoint ${m.checkpoint}`);
    assert(m.tiers.length && m.tiers.every((t, i) => t.points > 0 && (i === 0 || t.points > m.tiers[i - 1].points)), `${m.id}: tiers`);
    assert(!VERDICT.test(m.text), `${m.id}: verdict word in "${m.text}"`);
  }
  for (const b of SKILL_BRANCHES) {
    const max = ALL_MILESTONES.filter((m) => m.branch === b.id).reduce((a, m) => a + Math.max(...m.tiers.map((t) => t.points)), 0);
    assert(max >= SKILL_LEVEL_POINTS[2], `${b.id}: ${max} points < level 3`);
    const lv = Object.values(UNLOCKS).filter((u) => u.branch === b.id).map((u) => u.level).sort().join(',');
    assert(lv === '1,2,3', `${b.id}: unlock levels ${lv}`);
  }
  for (const [k, u] of Object.entries(UNLOCKS)) assert(['run', 'panels', 'scene'].includes(u.by) && !VERDICT.test(u.name), `unlock ${k}`);
});

test('plan sums: the planning sign\'s reference plan', () => {
  const s = planSums({ houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576);
  assert(Math.abs(s.chicksPerWeek - 3761.2) < 0.1 && Math.abs(s.salePerWeek - 3610.7) < 0.1 && s.densityKgM2 === 28 && s.restDays === 21, JSON.stringify(s));
  assert(planOutcome(s).pass, 'reference plan meets the contract');
  assert(!planOutcome(planSums({ houses: 5, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576)).pass, '5 houses short');
  assert(!planOutcome(planSums({ houses: 6, birdsPerHouse: 7000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576)).pass, '7,000 a house over density');
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
