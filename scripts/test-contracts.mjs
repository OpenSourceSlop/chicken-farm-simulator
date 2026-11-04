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
import { MILESTONES_CYCLE, needsProblemOf, NEEDS_PROBLEM } from '../src/skills-cycle.js';
import { ALL_MILESTONES } from '../src/skills.js';
import { planSums, planOutcome } from '../src/farm-plan.js';
import { SPOTS3, LEVELS, LEVEL1, CYCLE, UNLOCKS, SKILL_BRANCHES, SKILL_LEVEL_POINTS, levelOfDay, feedStdGAt, MIN_VENT_PER_1000 } from '../src/config.js';
// Phase 4 contracts (PHASE4.md §10)
import { JOBS_COND, JOB_WHERE_COND, STATE_TEST_IDS_P4, DONE_P4 } from '../src/content-jobs-cond.js';
import { BOARD_P4_ITEMS, BOARD_COND_ITEMS, BOARDS_COND, BOARD_IDS_COND } from '../src/content-signs-cond.js';
import { MILESTONES_COND } from '../src/skills-cond.js';
import { CONDITIONS, CONDITION_IDS, SPOTS4, SIGN_FIGURES, conditionLevel, PHASE4 } from '../src/config.js';
import { UI_ACTION_IDS_COND } from '../src/events.js';

// the farmer's requests during Phase 4 (PHASE4.md §15)
import { causeOf, WATCH_STATES } from '../src/flock-watch.js';
import { LEVEL_HELP_KEYS } from '../src/content.js';
import { readFileSync, readdirSync } from 'node:fs';

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
const DYNAMIC_SPOTS = ['heater', 'heater-out', 'dead', 'leak', 'lame', 'fan-broken', 'bait', 'swab'];
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
  assert(planOutcome({ houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576).pass, 'reference plan meets the contract');
  assert(!planOutcome({ houses: 5, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576).pass, '5 houses short');
  assert(!planOutcome({ houses: 6, birdsPerHouse: 7000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576).pass, '7,000 a house over density');
  assert(!planOutcome({ houses: 5, birdsPerHouse: 6000, cycleDays: 49, lossesPct: 0, saleKg: 2.8 }, 576).pass, '49 days at 0 % losses');
  assert(!planOutcome({ houses: 4, birdsPerHouse: 6500, cycleDays: 49, lossesPct: 0, saleKg: 2.8 }, 576).pass, '4 x 6,500 x 49 days at 0 %');
  // the plant takes at most saleMaxPct of the contract: the most houses the sheet allows is no plan
  assert(!planOutcome({ houses: 12, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576).pass, '12 houses x 6,000 every 67 days: twice the contract');
  assert(!planOutcome({ houses: 12, birdsPerHouse: 6000, cycleDays: 100, lossesPct: 0, saleKg: 2.8 }, 576).pass, '12 houses every 100 days: 34 % over');
  assert(planOutcome({ houses: 7, birdsPerHouse: 5200, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576).pass, '7 x 5,200 every 67 days: 1.4 % over');
});

test('skills: Phase 2 milestones belong to the brooding week (PHASE3.md §9: no day7-weight at the day 14 weigh-in)', async () => {
  const { makeWorld } = await import('../src/farm-profiles-run.js');
  const { env, events, farm, skills } = makeWorld();
  farm.start(LEVEL1, { seed: 1 });
  const chick = farm.stats.chickWeightMeasuredG ?? farm.flock.chickWeightG;
  const tierOf = () => skills.milestones('brooding').find((m) => m.id === 'day7-weight').tier;
  env.setDay(7); env.setHour(10);
  farm.stats.weighed = Array.from({ length: 50 }, (_, i) => ({ t: env.day, sector: i % 6, weightG: chick * 3.8 }));
  events.emit(EV.LEVEL, { phase: 'checkpoint', name: 'weighin' });
  assert(tierOf() == null, 'a 3.8 x week earns no day7-weight');
  events.emit(EV.RUN, { phase: 'level-start', level: 'week2' });
  env.setDay(14);
  farm.stats.weighed.push(...Array.from({ length: 50 }, (_, i) => ({ t: env.day, sector: i % 8, weightG: 500 })));
  events.emit(EV.LEVEL, { phase: 'checkpoint', name: 'weighin', level: 'week2' });
  events.emit(EV.LEVEL, { phase: 'checkpoint', name: 'level-end', level: 'week2' });
  events.emit(EV.RECORD_CLOSED, { day: 14, signed: true });
  assert(tierOf() == null, 'the week 2 weigh-in (12 x chick weight) earns no day7-weight');
  assert(ALL_MILESTONES.filter((m) => MILESTONES.some((p) => p.id === m.id)).every((m) => m.level === 'level1'), 'Phase 2 milestones tagged level1');
});

// ---------------- Phase 4 (PHASE4.md §10) ----------------
test('conditions: four, each with its levels; the merge drops, replaces and adds problems without touching the level defs', () => {
  assert(CONDITION_IDS.join() === 'hot,rainy,badChicks,water', `condition ids ${CONDITION_IDS}`);
  const before = JSON.stringify(LEVELS.map((l) => l.problems));
  for (const id of CONDITION_IDS) {
    const c = CONDITIONS[id];
    assert(c.label && c.summary && typeof c.available === 'boolean' && !VERDICT.test(c.summary), `${id}: label, summary, available`);
    for (const [lv, part] of Object.entries(c.levels)) {
      const def = LEVELS.find((l) => l.id === lv);
      assert(def, `${id}: unknown level ${lv}`);
      for (const d of part.drop || []) assert(def.problems.some((p) => p.id === d), `${id}/${lv}: drops ${d}, not a problem of the level`);
      for (const r of Object.keys(part.replace || {})) assert(def.problems.some((p) => p.id === r), `${id}/${lv}: replaces ${r}, not a problem of the level`);
      for (const p of part.problems || []) assert(p.id && (p.conditional || Number.isFinite(p.day)) && (p.day == null || (p.day >= def.startDay && p.day <= def.endDay)), `${id}/${lv}: problem ${p.id} inside the level`);
      const m = conditionLevel(def, id);
      for (const d of part.drop || []) assert(!m.problems.some((p) => p.id === d), `${id}/${lv}: ${d} still there`);
    }
  }
  assert(JSON.stringify(LEVELS.map((l) => l.problems)) === before, 'the level defs are unchanged by the merge');
  assert(conditionLevel(LEVELS[3], 'hot').problems.find((p) => p.id === 'warm-afternoon3').outsideRise === 2.5, 'replace merges fields');
  for (const k of Object.keys(SPOTS4)) assert(Number.isFinite(SPOTS4[k].x) && Number.isFinite(SPOTS4[k].z), `SPOTS4.${k}`);
});

test('condition jobs: ids, conditions, spots, signs, rules, problems and actions resolve', () => {
  const ids = new Set(ALL_JOBS.map((j) => j.id));
  const allBoards = new Set([...ALL_BOARD_IDS, ...BOARD_IDS_COND]);
  const spotOk = (s) => s in SPOTS || s in SPOTS2 || s in SPOTS3 || s in SPOTS4 || s in FARM || /^drinkers\.[0-3]$/.test(s) || DYNAMIC_SPOTS.includes(s);
  const states = [...STATE_TEST_IDS, ...STATE_TEST_IDS_CYCLE, ...STATE_TEST_IDS_P4];
  for (const j of JOBS_COND) {
    assert(!ids.has(j.id), `duplicate job ${j.id}`); ids.add(j.id);
    assert(CONDITIONS[j.condition], `${j.id}: condition ${j.condition}`);
    assert(spotOk(j.spot), `${j.id}: spot ${j.spot}`);
    assert(JOB_WHERE_COND[j.id], `${j.id}: no where line`);
    assert(!VERDICT.test(j.title), `${j.id}: verdict word in the title`);
    for (const s of j.signs) assert(allBoards.has(s), `${j.id}: sign ${s}`);
    if (j.kind === 'problem') {
      const inCond = LEVELS.some((l) => conditionLevel(l, j.condition).problems.some((p) => p.id === j.problem));
      assert(inCond, `${j.id}: problem ${j.problem} in no level of ${j.condition}`);
    }
    if (j.onDays) for (const d of j.onDays) assert(d >= j.days[0] && d <= j.days[1], `${j.id}: onDay ${d}`);
  }
  const walk = (id, r) => {
    if (r.type === 'state') assert(states.includes(r.test), `${id}: state ${r.test}`);
    if (['action', 'each', 'count'].includes(r.type)) assert(ACTION_IDS.includes(r.id), `${id}: action ${r.id} not in ACTION_IDS`);
    (r.of || []).forEach((x) => walk(id, x));
  };
  for (const j of JOBS_COND) walk(j.id, j.done);
  for (const [id, done] of Object.entries(DONE_P4)) { assert(ALL_JOBS.some((j) => j.id === id), `DONE_P4 for unknown job ${id}`); walk(id, done); }
  for (const a of UI_ACTION_IDS_COND) assert(ACTION_IDS.includes(a), `ui action ${a}`);
  assert(new Set(ACTION_IDS).size === ACTION_IDS.length, 'ACTION_IDS has duplicates');
});

test('condition signs: known sources (all general), no page numbers, no verdicts; on real boards; sign figures printed', () => {
  const known = { ...BOARDS, ...BOARDS_CYCLE, ...BOARDS_COND };
  const chk = (where, it) => {
    for (const k of [].concat(it.source)) assert(k === 'general', `${where}: Phase 4 lines are general practice, got ${k}`);
    assert(!/\bp\.\s*\d|\bpage\b/i.test(it.text), `${where}: page reference`);
    assert(!VERDICT.test(it.text), `${where}: verdict word in "${it.text}"`);
  };
  for (const [id, b] of Object.entries(BOARDS_COND)) { assert(!(id in BOARDS) && !(id in BOARDS_CYCLE) && b.title && b.where && b.items.length, `${id}`); b.items.forEach((it) => chk(id, it)); }
  for (const [id, p] of Object.entries(BOARD_P4_ITEMS)) {
    assert(id in known, `Phase 4 lines for unknown board ${id}`);
    (p.add || []).forEach((it) => chk(id, it));
    for (const r of p.replace || []) { chk(id, r); assert(known[id].items.some((x) => x.text === r.was), `${id}: the line to replace is not on the board: "${r.was}"`); }
  }
  for (const [c, boards] of Object.entries(BOARD_COND_ITEMS)) {
    assert(CONDITIONS[c], `lines for unknown condition ${c}`);
    for (const [id, list] of Object.entries(boards)) { assert(id in known, `${c}: unknown board ${id}`); list.forEach((it) => chk(`${c}/${id}`, it)); }
  }
  // every sign figure is printed on its board (the Phase 4 lines, a condition's lines or a new board): the figure's
  // whole text (less a closing bracket) inside one line
  const p4Text = (id) => [...(known[id]?.items || []), ...(BOARD_P4_ITEMS[id]?.add || []), ...(BOARD_P4_ITEMS[id]?.replace || []),
    ...Object.values(BOARD_COND_ITEMS).flatMap((b) => b[id] || [])].map((x) => x.text.toLowerCase());
  for (const f of SIGN_FIGURES) {
    const key = f.text.toLowerCase().replace(/ \([^()]*\)$/, '');
    assert(p4Text(f.board).some((t) => t.includes(key)), `${f.id}: "${key}" not on ${f.board}`);
  }
});

test('condition signs merged (content-signs-cond mergeBoardsP4 through boardsForDay): no line twice, no Phase 4 line in a normal run while the switch is off', () => {
  const was = PHASE4.tunedSigns;
  try {
    for (const tuned of [false, true]) {
      PHASE4.tunedSigns = tuned;
      for (const c of [null, ...CONDITION_IDS]) for (const day of [-1, 0, 3, 8, 15, 22, 30, 36, 43]) {
        const B = boardsForDay(day, c);
        for (const [id, b] of Object.entries(B)) {
          const texts = b.items.map((x) => x.text);
          assert(new Set(texts).size === texts.length, `${c || 'normal'} day ${day} ${tuned ? 'tuned' : ''}: a line twice on ${id}: "${texts.find((t, i) => texts.indexOf(t) !== i)}"`);
          for (const it of b.items) assert(it.text && it.source, `${id}: an item without text or source`);
        }
        for (const [id, b] of Object.entries(BOARDS_COND)) assert(!!B[id] === (b.condition === c), `${c || 'normal'}: board ${id} ${B[id] ? 'shown' : 'missing'}`);
        if (!c && !tuned) for (const [id, b] of Object.entries(B)) assert(b === boardsForDay(day)[id] || JSON.stringify(b) === JSON.stringify(boardsForDay(day)[id]), `normal run: ${id} changed`);
      }
      // the replaced lines are gone where they were replaced
      const heat = boardsForDay(30, null)['sign-heat'].items.map((x) => x.text);
      for (const r of BOARD_P4_ITEMS['sign-heat'].replace) assert(heat.includes(r.was) === !tuned && heat.includes(r.text) === tuned, `sign-heat replace (${tuned})`);
    }
  } finally { PHASE4.tunedSigns = was; }
});

test('condition skills: needsProblem names real problems; every branch can reach level 2 in every condition with the dropped problems left out', () => {
  const allProblems = new Set(['abnormal-deaths', ...LEVELS.flatMap((l) => l.problems.map((p) => p.id))]);
  for (const [id, pr] of Object.entries(NEEDS_PROBLEM)) { assert(ALL_MILESTONES.some((m) => m.id === id), `NEEDS_PROBLEM for unknown milestone ${id}`); assert(allProblems.has(pr), `${id}: problem ${pr}`); }
  for (const c of [null, ...CONDITION_IDS]) {
    const probs = new Set(LEVELS.flatMap((l) => conditionLevel(l, c).problems.map((p) => p.id)));
    const ms = [...ALL_MILESTONES, ...MILESTONES_COND.filter((m) => m.condition === c)].filter((m) => { const need = needsProblemOf(m); return !need || probs.has(need); });
    for (const b of SKILL_BRANCHES) {
      const max = ms.filter((m) => m.branch === b.id).reduce((a, m) => a + Math.max(...m.tiers.map((t) => t.points)), 0);
      assert(max >= SKILL_LEVEL_POINTS[1], `${c || 'normal'}: ${b.id} can reach only ${max} points (< level 2)`);
    }
  }
});

test('condition skills: milestones well formed, in the eleven branches, for a condition and a level', () => {
  const ids = new Set(ALL_MILESTONES.map((m) => m.id));
  for (const m of MILESTONES_COND) {
    assert(!ids.has(m.id), `duplicate milestone ${m.id}`); ids.add(m.id);
    assert(CONDITIONS[m.condition], `${m.id}: condition ${m.condition}`);
    assert(SKILL_BRANCHES.some((b) => b.id === m.branch), `${m.id}: branch ${m.branch}`);
    assert(LEVELS.some((l) => l.id === m.level) && CHECKPOINTS.includes(m.checkpoint), `${m.id}: level / checkpoint`);
    assert(m.tiers.length && m.tiers.every((t, i) => t.points > 0 && (i === 0 || t.points > m.tiers[i - 1].points)), `${m.id}: tiers`);
    assert(!VERDICT.test(m.text), `${m.id}: verdict word in "${m.text}"`);
  }
});

// ---------------- the farmer's requests during Phase 4 (PHASE4.md §15) ----------------
test('§15.1 flock watch: every cause names a real sign or plate and a place, in neutral words; the state words', () => {
  const boards = { ...BOARDS, ...BOARDS_CYCLE, ...BOARDS_COND };
  for (const kind of ['cold', 'heat', 'water', 'feed', 'light', 'air', 'weak', 'legs', 'disease', 'sds', 'claim', null]) for (const age of [2, 12, 30]) {
    const c = causeOf(kind, age);
    assert(boards[c.sign], `${kind} at ${age} d: sign ${c.sign} is a board or plate`);
    for (const t of [c.why, c.check, c.signName]) assert(typeof t === 'string' && t && !VERDICT.test(t), `${kind}: verdict word or empty in "${t}"`);
  }
  assert(Object.values(WATCH_STATES).join(' ') === 'steady watch alert', 'the dots read steady / watch / alert');
});
test('§15.3 keys: G and Shift+E in the help legend, verdict-free; G bound only by the level ui', () => {
  const g = LEVEL_HELP_KEYS.find((k) => k.keys.length === 1 && k.keys[0] === 'G'), se = LEVEL_HELP_KEYS.find((k) => k.keys.join('+') === 'Shift+E');
  assert(g && /bucket/i.test(g.what) && se && /dead bird/i.test(se.what), 'G and Shift+E in the legend');
  for (const k of LEVEL_HELP_KEYS) assert(!VERDICT.test(k.what), `verdict word in the legend: ${k.what}`);
  const files = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js'));
  // Phase 5: the key table (keys.js) names every default; only the level ui acts on G
  const binders = files.filter((f) => /KeyG/.test(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')) && f !== 'keys.js');
  assert(binders.length === 1 && binders[0] === 'ui.js', `KeyG bound in ${binders.join(', ')}`);
});

test('review round: every lit toggle key shows a state with its lamp, never an action verb (the verb stays in its aria-label)', () => {
  const files = readdirSync(new URL('../src/', import.meta.url)).filter((f) => /^ui-.*\.js$/.test(f));
  let calls = 0; const labels = [];
  for (const f of files) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    calls += (src.match(/[^n] toggleKey\(/g) || []).length;
    for (const m of src.matchAll(/stateText\('([^']+)'\)|toggleKey\('[^']+', '[^']+', [^\n]*?, '([^']+)'\);/g)) labels.push(m[1] || m[2]);
  }
  assert(calls >= 10 && labels.length === calls, `toggle keys ${calls}, state labels ${labels.length}: ${labels.join(' | ')}`);
  // a lit key set by hand (setText beside aria-pressed) shows a state too, never 'Stop …'
  for (const f of files) for (const m of readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').matchAll(/setAttribute\('aria-pressed'[^\n]*setText\([^,]+, [^?]+\? '([^']+)'/g)) labels.push(m[1]);
  const VERB = /^(stop|start|open|close|shut|take|give|run|put|switch|turn)\b/i;
  for (const t of labels) assert(!VERB.test(t) && / · /.test(t) && !VERDICT.test(t), `a lit key's state label: "${t}"`);
});

test('review round: the strips\' limits are the plates\' figures: the pans on the litter (days 0–3) at most PANS_ON_LITTER_CM on the feeder plate', async () => {
  const { PANS_ON_LITTER_CM } = await import('../src/job-figures.js');
  const { BOARD_P4_ITEMS } = await import('../src/content-signs-cond.js');
  const plate = BOARD_P4_ITEMS['feeder-box'].add.map((x) => x.text).join(' ');
  assert(plate.includes(`${PANS_ON_LITTER_CM} cm at most`) && /give or take 3 cm/.test(plate), `feeder plate: ${plate}`);
});

// ---------------- Phase 5 contracts (PHASE5.md §8) ----------------
const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get map() { return m; } }; };
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };

test('phase 5 settings: defaults from the schema, clamped values, storage round trip, blocked storage, the Phase 4 sound key', async () => {
  const { createSettings, soundView, SETTINGS_SCHEMA, defaults } = await import('../src/settings.js');
  const st = memStorage();
  const a = createSettings({ storage: st });
  const d = defaults();
  for (const [g, G] of Object.entries(SETTINGS_SCHEMA)) for (const k of Object.keys(G.items)) assert(JSON.stringify(a.get(`${g}.${k}`)) === JSON.stringify(d[g][k]), `default ${g}.${k}`);
  assert(a.get('sound.volume') === 0.7 && a.get('time.defaultSpeed') === '1x' && a.get('graphics.quality') === 'auto' && a.get('interface.hudScale') === '1', 'the defaults keep Phase 4 as it is');
  assert(a.set('camera.rotateSpeed', 9) === 2 && a.set('interface.hudScale', '7') === '1' && a.set('sound.muted', 'true') === true, 'values are clamped and validated');
  const seen = []; const off = a.subscribe((c) => seen.push(c.path), 'sound');
  a.setMany({ 'sound.volume': 0.4, 'camera.zoomSpeed': 1.5 }); off(); a.set('sound.volume', 0.5);
  assert(seen.join() === 'sound.volume', `the sound filter: ${seen}`);
  const b = createSettings({ storage: st });
  assert(b.get('sound.volume') === 0.5 && b.get('camera.zoomSpeed') === 1.5 && b.get('camera.rotateSpeed') === 2, 'the values come back from storage');
  assert(JSON.parse(st.getItem('chicken-farm.sound')).volume === 0.5, 'the Phase 4 sound key kept in step');
  const c = createSettings({ storage: throwing });
  c.set('sound.volume', 0.2);
  assert(c.get('sound.volume') === 0.2 && c.available === false, 'blocked storage: the session keeps its values, nothing throws');
  const legacy = createSettings({ storage: memStorage({ 'chicken-farm.sound': JSON.stringify({ volume: 0.3, muted: true }) }) });
  assert(legacy.get('sound.volume') === 0.3 && legacy.get('sound.muted') === true, 'the Phase 4 sound store carries over once');
  b.set('sound.muted', false);
  const sv = soundView(b);
  assert(Math.abs(sv.gain() - 0.25) < 1e-9 && sv.toggleMute().muted === true && sv.gain() === 0, 'the sound view: gain and mute as audio-settings.js');
  const bad = createSettings({ storage: memStorage({ 'chickenFarm.settings.v1': '{not json' }) });
  assert(bad.get('sound.volume') === 0.7, 'unreadable settings: the defaults');
});

test('phase 5 keys: the defaults are the Phase 1-4 keys; rebinding swaps; Esc and Shift+E are fixed', async () => {
  const { createKeys, KEY_ACTIONS } = await import('../src/keys.js');
  const { createSettings } = await import('../src/settings.js');
  const s = createSettings({ storage: memStorage() }), k = createKeys(s);
  const want = { use: 'E', bucket: 'G', squeeze: 'Q', probe: 'T', lux: 'L', air: 'V', notebook: 'N', skills: 'K', floorView: 'F', comfortView: 'C', moistureView: 'M', help: 'H', sound: 'U', map: 'Tab', menu: 'Esc', forward: 'W' };
  for (const [id, l] of Object.entries(want)) assert(k.label(id) === l, `${id} on ${k.label(id)}`);
  for (const r of LEVEL_HELP_KEYS) for (const key of r.keys) if (/^[A-Z]$/.test(key)) assert(KEY_ACTIONS.some((a) => a.codes.includes(`Key${key}`)), `legend key ${key} in the table`);
  const ev = (code, o = {}) => ({ code, key: code.replace('Key', '').toLowerCase(), shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...o });
  assert(k.matches(ev('KeyQ'), 'squeeze') && !k.matches(ev('KeyQ', { ctrlKey: true }), 'squeeze'), 'Q squeezes, Ctrl+Q does not');
  assert(k.matches(ev('KeyE', { shiftKey: true }), 'useDead') && !k.matches(ev('KeyE'), 'useDead'), 'Shift+E is its own action');
  const r = k.rebind('squeeze', 'KeyG');
  assert(r.ok && r.swapped === 'bucket' && k.label('squeeze') === 'G' && k.label('bucket') === 'Q', `a taken key swaps: ${JSON.stringify(r)}`);
  assert(createKeys(s).label('squeeze') === 'G', 'the binding is stored');
  assert(!k.rebind('menu', 'KeyP').ok && !k.rebind('squeeze', 'Escape').ok, 'Esc is fixed and reserved');
  k.reset();
  assert(k.label('squeeze') === 'Q' && k.label('bucket') === 'G', 'reset');
  const codes = KEY_ACTIONS.filter((a) => !a.follows).flatMap((a) => a.codes);
  assert(new Set(codes).size === codes.length, 'no default key twice');
  for (const a of KEY_ACTIONS) assert(!VERDICT.test(a.what), `verdict word: ${a.what}`);
});

test('phase 5 save codec and slot names: round trip, crc, the error codes; names from condition, level, day and time', async () => {
  const { encodePayload, decodePayload, composeText, parseText, crc32, hex8, SAVE_MESSAGES } = await import('../src/save-codec.js');
  const { metaOf, slotName, migrate, checkEnvelope, makeEnvelope } = await import('../src/save-slots.js');
  assert(hex8(crc32('123456789')) === 'cbf43926', 'crc32 (IEEE)');
  const obj = { run: { levelId: 'weeks45' }, blob: { level: { levelId: 'weeks45' }, env: { day: 30 + 14.33 / 24, hour: 14.33 }, farm: { cond: { condition: 'hot' } } } };
  const text = composeText({ meta: { name: 'x', savedAt: 0 }, ...(await encodePayload(obj)) });
  assert(JSON.stringify(await decodePayload(parseText(text))) === JSON.stringify(obj), 'a backup reads back as it was');
  const code = async (t) => { try { await decodePayload(parseText(t)); return 'ok'; } catch (e) { return e.code; } };
  assert(await code('hello') === 'not-a-save' && await code(text.slice(0, -30)) === 'incomplete' && await code(text.replace('CF5', 'CF6')) === 'newer', 'not a save, cut short, newer');
  for (const m of Object.values(SAVE_MESSAGES)) assert(!VERDICT.test(m), `verdict word: ${m}`);
  const m = metaOf(obj);
  assert(m.name === 'Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20', `name: ${m.name}`);
  assert(slotName(metaOf({ blob: { level: { levelId: 'plan' }, env: { day: -2 + 7 / 24, hour: 7 }, farm: {} } })) === 'Normal season · Level 1 – Plan the farm · Planning day, 07:00', 'the planning day');
  const env = migrate({ version: 3, savedAt: 5, run: obj.run, blob: obj.blob });
  assert(env.format === 'chicken-farm-save' && env.v === 5 && env.meta.name === m.name && checkEnvelope(env) === null, 'a v3 run save in the envelope, named, resumable');
  assert(checkEnvelope(makeEnvelope({ run: obj.run, blob: { level: obj.blob.level, env: obj.blob.env } })) === 'invalid', 'a blob without its farm is not resumed');
  assert(checkEnvelope(makeEnvelope({ run: obj.run, blob: { ...obj.blob, level: { levelId: 'week9' } } })) === 'invalid', 'an unknown level is not resumed');
});

test('phase 5 guide, menu, map plan and motion: neutral words, no farming figures, every place resolvable', async () => {
  const { GUIDE } = await import('../src/content-guide.js');
  for (const sec of GUIDE.sections) for (const t of [sec.head, ...sec.text]) {
    assert(!VERDICT.test(t), `guide verdict word: ${t}`);
    assert(!/°C|L\/kg|m\/s|lux|ppm|\bp\.\s*\d/.test(t), `the guide holds no farming figure (signs do): ${t}`);
  }
  const { MAP_PLACES, standOf, projector } = await import('../src/map-plan.js');
  const { MAP } = await import('../src/config.js');
  const ids = MAP_PLACES.map((p) => p.id);
  assert(new Set(ids).size === ids.length && ids.length >= 40, `places: ${ids.length}, unique`);
  for (const p of MAP_PLACES) { const s = standOf(p); assert(Number.isFinite(s.x) && Number.isFinite(s.z) && p.name, `place ${p.id}`); }
  assert(standOf(MAP_PLACES.find((p) => p.id === 'controller')).z === MAP.standZ, 'a north-wall board: stand in front of it');
  const P = projector(MAP.farm, { x: 0, y: 0, w: 960, h: 600 }), q = P.toPx(-40, 38), w = P.toWorld(q.x, q.y);
  assert(Math.abs(w.x + 40) < 1e-9 && Math.abs(w.z - 38) < 1e-9, 'projection round trip');
  const { reducedMotion, setMotionOverride } = await import('../src/motion.js');
  setMotionOverride('on'); assert(reducedMotion() === true, 'reduce motion: always'); setMotionOverride('system');
});

test('phase 5 graphics quality: the governor steps down in Phase 1\'s order; manual settings pin', async () => {
  const { createQuality } = await import('../src/gfx-quality.js');
  const { createSettings } = await import('../src/settings.js');
  const mk = () => ({ shadowMap: { enabled: true, type: 2 }, ratio: 1, getPixelRatio() { return this.ratio; } });
  const sun = { shadow: { mapSize: { x: 2048, y: 2048, set(a, b) { this.x = a; this.y = b; } }, map: null } };
  const THREE = { PCFSoftShadowMap: 2, PCFShadowMap: 1 };
  const scene = { traverse() {} };
  const r = mk(), s = createSettings({ storage: memStorage() });
  const q = createQuality({ THREE, renderer: r, scene, world: { sun }, settings: s, onResize: () => { r.ratio = q.pixelRatio(); } });
  let st = q.debug.feed(0.06, 80);
  assert(st.shadows === 'low' && sun.shadow.mapSize.x === 1024, `first step: the simple shadow (${JSON.stringify(st)})`);
  st = q.debug.feed(0.06, 80);
  assert(st.ratioCap === 0.85, `then the 0.85 render scale (${JSON.stringify(st)})`);
  s.set('graphics.shadows', 'off');
  assert(r.shadowMap.enabled === false && q.state().shadows === 'off', 'shadows off by hand');
  s.set('graphics.pixelRatio', '1.25');
  assert(q.state().ratioCap === 1.25, 'a pixel ratio by hand');
  s.set('graphics.shadows', 'auto');
  assert(r.shadowMap.enabled === true && q.state().shadows === 'high', 'back to automatic: the soft shadow again');
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
