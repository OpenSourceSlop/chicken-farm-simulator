// Node tests for the job engine of every level (src/job-engine.js) with a fake clock: the real createSim,
// the event bus, the farm (stub or model) and the JOBS table. Owner: package "level".
// Run: node scripts/test-jobs.mjs   PHASE2.md §14.2 "Acceptance".
import { createSim } from '../src/sim.js';
import { createFarm } from '../src/farm.js';
import { createEvents, EV } from '../src/events.js';
import { createJobEngine, BROOD_CELLS, LEVEL_END_DAY, windowHours } from '../src/job-engine.js';
import { JOBS } from '../src/content-jobs.js';
import { BROOD_BOUNDS, HEATERS, LEVEL1, CYCLE, CLEAN, PLAN_LEVEL, WEEK2, WEEK3, FINISH, CLEANOUT, levelOfDay } from '../src/config.js';
import { JOBS_CYCLE, STATE_TEST_IDS_CYCLE } from '../src/content-jobs-cycle.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const near = (a, b, msg) => assert(a != null && Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);
const H = 1 / 24;

/** A level at 07:00 on the prep day, engine started. Grids set so no state job is done by itself. */
function makeLevel({ startDay = -1, startHour = 7 } = {}) {
  const env = createSim();
  const events = createEvents();
  const farm = createFarm(env, { events });
  env.addStepper(farm.step);
  farm.start(LEVEL1, { seed: 1 });
  env.setDay(startDay); env.setHour(startHour);
  farm.litter.cover = 0; for (const l of farm.water.lines) l.flushClear = 0; for (const l of farm.feed.lines) { l.flood = false; l.panFill = 0; }
  farm.flock.inBoxes = 6000; farm.flock.placed = 0; farm.flock.deadOnFloor = 3;
  env.setHeaterSetpoint(18);
  const logged = [];
  const records = { logJob: (key, day, result) => logged.push({ key, day, result }) };
  const props = { carrying: null };
  const jobs = createJobEngine({ events, env, farm, props, records });
  jobs.start(startDay);
  /** Move the clock to day + hour (forward only) and tick. */
  const at = (day, hour) => { const t = day + hour * H; if (t > env.day + 1e-9) env.skipHours((t - env.day) * 24); jobs.tick(); };
  const act = (id, args = {}) => events.emit(EV.ACTION, { id, ...args, result: args.result });
  const st = (key) => jobs.byKey(key)?.status;
  return { env, events, farm, jobs, at, act, st, logged, props };
}

test('prep day: ten jobs, flush window 16:00-02:00', () => {
  const L = makeLevel();
  const prep = L.jobs.list().filter((i) => i.day === -1);
  assert(prep.length === 10, `prep jobs ${prep.length}`);
  const f = L.jobs.byKey('prep-flush@-1');
  near(f.opensAt, -1 + 16 * H, 'flush opens'); near(f.closesAt, -1 + 26 * H, 'flush closes');
  L.at(-1, 15.9); assert(L.st('prep-flush@-1') === 'waiting', 'flush waits before 16:00');
  L.at(-1, 16); assert(L.st('prep-flush@-1') === 'open', 'flush opens 16:00');
  L.at(0, 1.9); assert(L.st('prep-flush@-1') === 'open', 'flush open at 01:54');
  L.at(0, 2); assert(L.st('prep-flush@-1') === 'missed', `flush missed at 02:00: ${L.st('prep-flush@-1')}`);
});

test('day 0 instances at midnight; truck anchor at 08:00; d0-floor closes at the first tip', () => {
  const L = makeLevel();
  L.at(0, 0.1);
  assert(L.jobs.byKey('d0-floor@0') && L.jobs.byKey('r-meter@0'), 'day 0 created at midnight');
  assert(L.jobs.byKey('d0-place@0').opensAt == null, 'no truck yet');
  L.at(0, 6); assert(L.st('d0-floor@0') === 'open', 'floor open 06:00');
  L.at(0, 8);
  near(L.jobs.anchors.truck, 8 * H, 'truck anchor');
  const place = L.jobs.byKey('d0-place@0');
  assert(place.status === 'open', 'place opens with the truck'); near(place.closesAt, 20 * H, 'place closes truck + 12 h');
  near(L.jobs.byKey('d0-grade@0').closesAt, 14 * H, 'grade closes truck + 6 h');
  L.act('floor.probe', { x: -19, z: -2.6, result: { tempC: 30.6 } });
  L.at(0, 8.5);
  L.farm.act('chicks.tip', { stack: 0, chicks: 1000, x: -19, z: 2 });
  near(L.jobs.anchors.placed, 8.5 * H, 'placed anchor = first tip');
  assert(L.st('d0-floor@0') === 'missed', `floor closes at the first tip: ${L.st('d0-floor@0')}`);
  const vent = L.jobs.byKey('d0-vent@0');
  near(vent.opensAt, 10.5 * H, 'vent opens tip + 2 h'); near(vent.closesAt, 12 * H, 'vent closes tip + 3.5 h');
  L.at(0, 10.4); assert(vent.status === 'waiting', 'vent waits');
  L.at(0, 10.5); assert(vent.status === 'open', 'vent open at +2 h');
  L.at(0, 12); assert(vent.status === 'missed', 'vent missed at +3.5 h');
  L.at(1, 0.1);
  const crop = L.jobs.byKey('d1-crop@1');
  near(crop.opensAt, 8.5 * H + 22 * H, 'crop opens tip + 22 h'); near(crop.closesAt, 8.5 * H + 28 * H, 'crop closes tip + 28 h');
});

test('all-placed state and the pinned order', () => {
  const L = makeLevel();
  L.at(0, 8);
  const g = L.jobs.groups();
  assert(g.pinned.map((i) => i.id).join() === 'd0-place,d0-grade', `pinned ${g.pinned.map((i) => i.id)}`);
  assert(g.preTruck.map((i) => i.id).join() === 'd0-floor,r-dips,r-controller,r-meter', `before the truck ${g.preTruck.map((i) => i.id)}`);
  L.farm.act('chicks.tip', { stack: 0, chicks: 1000, x: -19, z: 2 });
  assert(L.jobs.groups().preTruck.length === 0, 'the before-the-truck group ends at the first tip');
  L.farm.flock.placed = 6000; L.farm.flock.inBoxes = 0; L.jobs.tick();
  assert(L.st('d0-place@0') === 'done', 'placed');
});

test('d7-weigh 08:00-18:00 on day 7, count with 5 sectors', () => {
  const L = makeLevel({ startDay: 7, startHour: 6 });
  const w = L.jobs.byKey('d7-weigh@7');
  near(w.opensAt, 7 + 8 * H, 'weigh opens'); near(w.closesAt, 7 + 18 * H, 'weigh closes');
  L.at(7, 8);
  const xs = [-20, -12, -4, -20, -12];
  for (let i = 0; i < 50; i++) L.act('sample.weigh', { x: xs[i % 5], z: i % 5 < 3 ? -2 : 2, index: i, result: { weightG: 200 } });
  assert(w.status === 'done', `50 from 5 sectors: ${w.status} ${w.progress}`);
  assert(L.logged.some((l) => l.key === 'd7-weigh@7' && l.result.n === 50 && l.result.values.length === 50), 'result logged with 50 readings');
});

test('each: four flow tests; skip past the window marks missed', () => {
  const L = makeLevel({ startDay: 2, startHour: 6 });
  for (const line of [0, 1, 2]) L.act('water.flowtest', { line, result: { mlMin: 22 } });
  const d = L.jobs.byKey('r-drinkers@2');
  assert(d.status === 'open' && Math.abs(d.progress - 0.75) < 1e-9, `3 of 4: ${d.progress}`);
  L.act('water.flowtest', { line: 1 }); assert(d.status === 'open', 'same line twice is not a fourth');
  L.act('water.flowtest', { line: 3, result: { mlMin: 21 } }); assert(d.status === 'done', 'all four');
  assert(d.result['0'].mlMin === 22, 'flows in the result');
  L.at(2, 13);
  assert(L.st('r-meter@2') === 'missed' && L.st('r-feeders@2') === 'missed', 'morning jobs missed after the skip');
  assert(L.st('r-walk-pm@2') === 'open', 'afternoon open');
});

test('count: vent temps need 3 sectors; litter needs one near a drinker line', () => {
  const L = makeLevel({ startDay: 0, startHour: 7 });
  L.at(0, 8); L.farm.act('chicks.tip', { stack: 0, chicks: 1000, x: -19, z: 2 }); L.at(0, 10.1);
  const v = L.jobs.byKey('d0-vent@0');
  for (let i = 0; i < 5; i++) L.act('sample.vent', { x: -20, z: i % 2 ? -2 : 2, index: i, result: { tempC: 40 } });
  assert(v.status === 'open', '5 readings from 2 sectors do not do');
  L.act('sample.vent', { x: -2, z: 2, index: 9, result: { tempC: 40.2 } });
  assert(v.status === 'done', `third sector: ${v.status}`);
  L.at(0, 13);
  const lit = L.jobs.byKey('r-litter@0');
  L.act('litter.squeeze', { x: -20, z: -3.4 }); L.act('litter.squeeze', { x: -5, z: 3.4 }); L.act('litter.squeeze', { x: -10, z: 0 });
  assert(lit.status === 'open', 'none near a drinker line');
  L.act('litter.squeeze', { x: -10, z: 2.4 });
  assert(lit.status === 'done', `one within 1 m of line z 1.95: ${lit.status}`);
});

test('coverage: two lengthwise passes (z -2.5 and +2.5) and a listen stop', () => {
  assert(BROOD_CELLS.length === 300, `brooding cells ${BROOD_CELLS.length}`);
  const L = makeLevel({ startDay: 1, startHour: 6 });
  const w = L.jobs.byKey('r-walk@1');
  for (const z of [-2.5, 2.5]) for (let x = BROOD_BOUNDS.xMin + 0.5; x <= BROOD_BOUNDS.xMax; x += 1) L.events.emit(EV.CELL, { x, z, cx: 0, cz: 0 });
  assert(w.status === 'open' && w.progress > 0.8, `seen but no listen: ${w.status} ${w.progress}`);
  assert(w.st.cells.length / 300 >= 0.5, `share ${w.st.cells.length / 300}`);
  L.events.emit(EV.LISTEN, { x: -10, z: 0, seconds: 2 });
  assert(w.status === 'done', 'listen completes it');
  assert(w.result.seenPct >= 50, `result ${JSON.stringify(w.result)}`);
});

test('all latches: gate dip then house dip (in either order of time)', () => {
  const L = makeLevel({ startDay: 3, startHour: 6 });
  const d = L.jobs.byKey('r-dips@3');
  L.events.emit(EV.FOOTDIP, { where: 'gate' });
  L.events.emit(EV.HOUSE_ENTER, { dipped: false });
  assert(d.status === 'open' && d.progress === 0.5, `one part: ${d.progress}`);
  L.events.emit(EV.HOUSE_ENTER, { dipped: true });
  assert(d.status === 'done', 'both parts');
});

test('any: one of the rules', () => {
  const env = createSim(); const events = createEvents(); const farm = createFarm(env, { events });
  env.setDay(1); env.setHour(6);
  const def = { id: 't-any', kind: 'dated', day: 1, round: 'am', title: 't', spot: 'controller', signs: [],
    done: { type: 'any', of: [{ type: 'action', id: 'a' }, { type: 'event', event: EV.FOOTDIP, match: { where: 'house' } }] } };
  const jobs = createJobEngine({ events, env, farm, jobs: [def] });
  jobs.start(1);
  events.emit(EV.FOOTDIP, { where: 'gate' });
  assert(jobs.byKey('t-any@1').status === 'open', 'gate dip does not match');
  events.emit(EV.FOOTDIP, { where: 'house' });
  assert(jobs.byKey('t-any@1').status === 'done', 'house dip matches');
});

test('matchPayload on { result: { fixed: true } }; problems open only on a symptom; wet patch after the leak', () => {
  const L = makeLevel({ startDay: 3, startHour: 9 });
  L.act('water.clearFilter', { result: { fixed: true } });
  assert(!L.jobs.list().some((i) => i.id === 'p-water-drop'), 'no problem job without a symptom');
  L.events.emit(EV.FARM_PROBLEM, { id: 'blocked-filter', phase: 'start' });
  assert(!L.jobs.list().some((i) => i.id === 'p-water-drop'), 'start is silent');
  L.events.emit(EV.FARM_PROBLEM, { id: 'blocked-filter', phase: 'symptom' });
  const p = L.jobs.list().find((i) => i.id === 'p-water-drop');
  assert(p && p.status === 'open', 'symptom opens it');
  near(p.closesAt, LEVEL_END_DAY, 'problems stay open to the end of the level');
  assert(L.jobs.groups().problems[0] === p, 'listed with the problems');
  L.act('water.clearFilter', { result: { fixed: false } });
  assert(p.status === 'open', 'fixed false does not do');
  L.act('water.clearFilter', { result: { fixed: true, minutes: 5 } });
  assert(p.status === 'done', 'fixed true does');
  L.events.emit(EV.FARM_PROBLEM, { id: 'leaking-nipple', phase: 'symptom' });
  const leak = L.jobs.list().find((i) => i.id === 'p-leak'), patch = L.jobs.list().find((i) => i.id === 'p-wet-patch');
  assert(leak.status === 'open' && patch.status === 'waiting', `leak ${leak.status}, patch ${patch.status}`);
  L.act('litter.patch', { x: -9, z: 2 });
  assert(patch.status === 'waiting', 'a patch before the fix does not count');
  L.act('water.fixLeak', { line: 2, x: -9.15, result: { fixed: true } });
  assert(patch.status === 'open', 'patch opens after the leak');
  L.act('litter.patch', { x: 1, z: -5, result: { onLeak: false } });
  assert(patch.status === 'open', 'a sack 10 m away does not patch the wet cell');
  L.act('litter.patch', { x: -9, z: 2, result: { onLeak: true } });
  assert(patch.status === 'done', 'patched');
  L.events.emit(EV.FARM_PROBLEM, { id: 'cold-night', phase: 'symptom' });
  const cold = L.jobs.list().find((i) => i.id === 'p-cold-night');
  near(cold.opensAt, 3 + 20 * H, 'night check opens 20:00'); near(cold.closesAt, 4, 'closes 24:00');
});

test('record jobs on RECORD_CLOSED of the same day only', () => {
  const L = makeLevel({ startDay: 2, startHour: 17 });
  const r = L.jobs.byKey('r-record@2');
  L.events.emit(EV.RECORD_CLOSED, { day: 1, signed: true, row: {} });
  assert(r.status === 'open', 'yesterday does not count');
  L.events.emit(EV.RECORD_CLOSED, { day: 2, signed: false, row: {} });
  assert(r.status === 'open', 'unsigned does not count');
  L.events.emit(EV.RECORD_CLOSED, { day: 2, signed: true, row: { big: 1 } });
  assert(r.status === 'done' && !('row' in r.result), 'signed today; the row is not stored');
});

test('events before a window opens do not count', () => {
  const L = makeLevel();
  L.act('water.height', { line: 0, cm: 11 });
  assert(L.jobs.byKey('prep-drinkers@-1').progress === 0.25, 'prep drinkers counts in its window');
  L.act('water.flowtest', { line: 0, result: { mlMin: 20 } });
  assert(!L.jobs.byKey('r-drinkers@0'), 'tomorrow not created yet');
  L.at(0, 5.5);
  L.act('water.flowtest', { line: 1, result: { mlMin: 20 } });
  L.at(0, 6);
  assert(L.jobs.byKey('r-drinkers@0').progress === 0, 'flow tests before 06:00 do not count for the morning job');
});

test('state rules: preheat and the 30-minute house-near-target', () => {
  const L = makeLevel();
  assert(L.st('prep-preheat@-1') === 'open', 'open');
  L.env.setHeaterSetpoint(34); L.jobs.tick();
  assert(L.st('prep-preheat@-1') === 'done', `burning at 34: ${L.env.heatersOn}`);
  L.farm.litter.cover = 0.97; L.jobs.tick();
  assert(L.st('prep-litter@-1') === 'done', 'covered');
  const L2 = makeLevel({ startDay: 6, startHour: 13 });
  L2.events.emit(EV.FARM_PROBLEM, { id: 'warm-afternoon', phase: 'symptom' });
  L2.env.forceHouseTemp(L2.env.targetTemp + 1); L2.jobs.tick();
  const w = L2.jobs.list().find((i) => i.id === 'p-warm');
  L2.at(6, 13 + 20 / 60); assert(w.status === 'open', 'not yet 30 min');
  L2.at(6, 13 + 31 / 60); assert(w.status === 'open', `near target but nothing done to the air: ${w.status}`);
  L2.act('vent.fans', { n: 1 });
  assert(w.status === 'done', `a tunnel fan on and 30 min near target: ${w.status}`);
  // tunnel air that chills the chicks (felt more than 1.5 °C under the target) is not near target
  const L3 = makeLevel({ startDay: 6, startHour: 13 });
  L3.events.emit(EV.FARM_PROBLEM, { id: 'warm-afternoon', phase: 'symptom' });
  L3.env.forceHouseTemp(L3.env.targetTemp + 0.5); L3.env.setFans(2); L3.act('vent.fans', { n: 2 }); L3.jobs.tick();
  const w3 = L3.jobs.list().find((i) => i.id === 'p-warm');
  L3.at(6, 13 + 40 / 60);
  assert(w3.status === 'open' && L3.env.windChill > 2, `two tunnel fans chill the chicks ${(L3.env.houseTemp - L3.env.windChill - L3.env.targetTemp).toFixed(2)} °C: ${w3.status}`);
  L3.env.setFans(0); L3.act('vent.timer', { fans: 2, onSec: 120, cycleSec: 300 }); L3.jobs.tick();
  L3.at(6, 14 + 15 / 60);
  assert(w3.status === 'done', `timer air, the chicks near target 30 min: ${w3.status}`);
});

test('nextOpening: before the truck, after the morning, never past the level end', () => {
  const L = makeLevel({ startDay: 0, startHour: 6.5 });
  near(L.jobs.nextOpening(), 8 * H, 'next = the truck at 08:00');
  const L2 = makeLevel({ startDay: 3, startHour: 12.5 });
  near(L2.jobs.nextOpening(), 3 + 13 * H, 'afternoon round');
  const L3 = makeLevel({ startDay: 7, startHour: 22 });
  near(L3.jobs.nextOpening(), LEVEL_END_DAY, 'level end');
  const L4 = makeLevel({ startDay: -1, startHour: 20 });
  near(L4.jobs.nextOpening(), 0 + 6 * H, 'prep evening -> day 0 06:00');
});

test('serialize -> restore keeps instances, progress, anchors and rule state', () => {
  const L = makeLevel({ startDay: 0, startHour: 7.5 });
  L.at(0, 8); L.farm.act('chicks.tip', { stack: 0, chicks: 1000, x: -19, z: 2 });
  L.act('water.flowtest', { line: 0, result: { mlMin: 20 } });
  const blob = JSON.parse(JSON.stringify(L.jobs.serialize()));
  const j2 = createJobEngine({ events: createEvents(), env: L.env, farm: L.farm, props: L.props });
  j2.restore(blob);
  assert(JSON.stringify(j2.serialize()) === JSON.stringify(L.jobs.serialize()), 'identical after restore');
  near(j2.anchors.placed, L.jobs.anchors.placed, 'anchor');
  assert(j2.byKey('r-drinkers@0').st.seen['0'], 'rule state kept');
});

test('every job def resolves its window or anchor; heaters exist for heater spots', () => {
  for (const j of JOBS) {
    if (j.kind === 'problem') { assert(j.problem, `${j.id} problem id`); continue; }
    assert(j.round === 'rel' ? j.rel && j.rel.anchor : (j.window || LEVEL1.rounds[j.round]), `${j.id} window`);
  }
  assert(HEATERS.length === 8, 'heaters');
});

// ---------------- Phase 3 (PHASE3.md §3.1, §14.2) ----------------
/** A later level of the run: the farm in level mode, the clock at (day, hour), the engine on `def`. */
function makeCycle(def, { day = def.startDay, hour = def.startHour ?? 6, jobs: jobList, before } = {}) {
  const env = createSim();
  const events = createEvents();
  const farm = createFarm(env, { events });
  env.addStepper(farm.step);
  farm.start(LEVEL1, { seed: 1 });
  env.setMaxDay(CYCLE.lastDay);
  env.setDay(day); env.setHour(hour);
  const logged = [];
  const records = { logJob: (key, d, result) => logged.push({ key, day: d, result }) };
  const props = { carrying: null };
  const jobs = createJobEngine({ events, env, farm, props, records, level: def, ...(jobList ? { jobs: jobList } : {}) });
  before?.({ env, farm, props });
  jobs.start(day, def);
  const at = (d, h) => { const t = d + h * H; if (t > env.day + 1e-9) env.skipHours((t - env.day) * 24); jobs.tick(); };
  const act = (id, args = {}) => events.emit(EV.ACTION, { id, ...args, result: args.result });
  const st = (key) => jobs.byKey(key)?.status;
  return { env, events, farm, jobs, at, act, st, logged, props };
}
const T = (id, done, extra = {}) => ({ id, kind: 'dated', day: 20, round: 'am', title: id, spot: 'controller', signs: [], done, ...extra });

test('per-level days and windows: week 2 makes days 8-14 only, onDays, rounds of the level, the level end', () => {
  const L = makeCycle(WEEK2);
  assert(L.jobs.level === WEEK2, 'engine runs week 2');
  assert(L.st('w2-lights@8') === 'open' && L.st('r-minvent@8') === 'open' && L.st('r-walk@8') === 'open', 'day 8 morning jobs open');
  assert(!L.jobs.list().some((i) => i.day < 8 || i.def.kind === 'dated' && i.def.day < 8), 'nothing of the brooding week');
  L.at(9, 6.1);
  assert(!L.jobs.byKey('r-minvent@9') && L.jobs.byKey('r-minvent@10') == null, 'onDays: no step-up on day 9 (day 10 not made yet)');
  L.at(11, 6.1);
  assert(L.jobs.byKey('r-raise@11') && !L.jobs.byKey('r-raise@9'), 'r-raise on days 8, 11, 14 only');
  assert(L.jobs.byKey('r-controller-pm@11') && L.jobs.byKey('r-dips@11'), 'Phase 2 routines run on into week 2');
  const cur = L.jobs.byKey('w2-curtain@9');
  near(cur.opensAt, 9 + 13 * H, 'curtain opens day 9 13:00'); near(cur.closesAt, 11 + 18 * H, 'window 66 h = day 11 18:00');
  near(L.jobs.endAt(), 15 + 6 * H, 'week 2 ends day 15 06:00');
  L.at(14, 22);
  near(L.jobs.nextOpening(), 15 + 6 * H, 'Next job never skips past the level end');
  L.at(15, 7);
  assert(!L.jobs.byKey('r-dips@15'), 'no day 15 jobs in week 2');
  const P = makeCycle(PLAN_LEVEL);
  assert(P.st('pl-gate-read@-2') === 'open' && P.st('pl-sheet@-2') === 'open' && !P.jobs.byKey('prep-gate@-1'), 'planning day jobs only');
  near(P.jobs.endAt(), -1 + 6 * H, 'the plan level ends day -1 06:00');
  const L1 = makeLevel();
  assert(!L1.jobs.list().some((i) => i.id.startsWith('pl-') || i.id.startsWith('w2-')), 'the brooding week makes no cycle job');
});

test('action anchor (curtain) and the plan\'s sent anchor; a job after another', () => {
  const L = makeCycle(WEEK2);
  L.at(10, 7.5);
  const spread = L.jobs.byKey('w2-spread@9');
  assert(spread && spread.opensAt == null, 'spread waits for the curtain');
  L.at(10, 8);
  L.act('house.curtain', { open: false, result: true });
  assert(L.jobs.anchors.curtain == null, 'a closed curtain is not the anchor');
  L.act('house.curtain', { open: true, result: true });
  near(L.jobs.anchors.curtain, 10 + 8 * H, 'curtain anchor');
  near(spread.opensAt, 10 + 8.5 * H, 'spread opens +0.5 h'); near(spread.closesAt, 10 + 14 * H, 'closes +6 h');
  assert(L.st('w2-curtain@9') === 'done', 'the lift itself');
  const P = makeCycle(PLAN_LEVEL, { hour: 9 });
  P.act('plan.send', { houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8, result: {} });
  near(P.jobs.anchors.sent, -2 + 9 * H, 'sent anchor');
  const reply = P.jobs.byKey('pl-reply@-2');
  near(reply.opensAt, -2 + 10 * H, 'reply 1 h later');
  P.at(-2, 10);
  assert(reply.status === 'open', 'the reply job opens after the sheet is done');
});

test('stat anchor: the catch (default day 42 02:00), negative fromH, a booking moves the waiting jobs', () => {
  const L = makeCycle(FINISH, { day: 41, hour: 6 });
  const w = L.jobs.byKey('f-withdraw@41'), lines = L.jobs.byKey('f-lines@42');
  assert(w && lines, 'catch jobs made, day 42 ones too');
  near(L.jobs.anchors.catch, 42 + 2 * H, 'the company\'s default');
  near(w.opensAt, 42 + 2 * H - 14 * H, 'withdraw opens catch - 14 h'); near(w.closesAt, 42 + 2 * H - 6 * H, 'closes catch - 6 h');
  L.farm.harvest.catchAt = 42 + 4 * H; L.jobs.tick();
  near(w.opensAt, 41 + 14 * H, 'the booking moved the window'); near(lines.opensAt, 42 + 3 * H, 'lines -1 h');
  near(L.jobs.nextOpening(41 + 6.1 * H), 41 + 13 * H, 'next opening: the afternoon round 13:00');
  L.at(41, 14);
  assert(w.status === 'open', 'withdraw open');
  L.farm.harvest.catchAt = 42 + 5 * H; L.jobs.tick();
  near(w.opensAt, 41 + 14 * H, 'an open job keeps its window');
  L.act('feed.withdraw', { on: true, result: true });
  assert(w.status === 'done', 'withdrawn');
  const b = makeCycle(FINISH, { day: 37, hour: 7 });
  b.act('phone.bookCatch', { day: 43, hour: 2, result: { booked: false, catchAt: 42 + 2 * H, reason: 'the crew catches between day 41 18:00 and day 42 06:00' } });
  assert(b.st('f-book@37') === 'open', 'a refused booking does not book');
  b.act('phone.bookCatch', { day: 42, hour: 2, result: { booked: true, catchAt: 42 + 2 * H } });
  assert(b.st('f-book@37') === 'done', 'booked');
});

test('coverage: area used / house, maxCells, tool', () => {
  const L = makeCycle(WEEK2, { day: 12, hour: 6 });
  L.env.setBroodCurtain(false);
  const walk = L.jobs.byKey('r-walk@12');
  // one pass along the middle of the whole house sees 48 x 5 = 240 cells: over the 150-cell cap
  for (let x = -23.5; x <= 23.5; x += 1) L.events.emit(EV.CELL, { x, z: 0 });
  const c = L.jobs.coverage(walk);
  assert(c.area === 'house' && c.need === 150 && c.seen >= 150, `after the lift the walk needs at most 150 cells: ${JSON.stringify(c)}`);
  L.events.emit(EV.LISTEN, { x: 0, z: 0, seconds: 2 });
  assert(walk.status === 'done', `walk done: ${walk.status}`);
  const L1 = makeLevel({ startDay: 3, startHour: 6 });
  const w1 = L1.jobs.byKey('r-walk@3'), c1 = L1.jobs.coverage(w1);
  assert(c1.area === 'brood' && c1.need === 150 && c1.size === 300, `week 1: 50 % of 300 = maxCells: ${JSON.stringify(c1)}`);
  for (let x = 4.5; x <= 23.5; x += 1) L1.events.emit(EV.CELL, { x, z: 0 });
  assert(L1.jobs.coverage(w1).seen === 0, 'east of the curtain is not the brooding floor');
  const S = makeCycle(WEEK2);
  S.at(10, 9);
  S.env.setBroodCurtain(false);
  S.act('house.curtain', { open: true, result: true });
  S.at(10, 9.6);
  const sp = S.jobs.byKey('w2-spread@9');
  for (let x = -23.5; x <= 0; x += 1) S.events.emit(EV.CELL, { x, z: 0 });
  assert(S.jobs.coverage(sp).need === 144 && sp.status === 'open', `25 % of the house: ${JSON.stringify(S.jobs.coverage(sp))}`);
  const tool = makeCycle(CLEANOUT, { day: 20, hour: 6, jobs: [T('t-wash', { type: 'coverage', frac: 0.1, sight: 2.5, area: 'house', tool: 'washer' })] });
  const tw = tool.jobs.byKey('t-wash@20');
  for (let x = -23.5; x <= 0; x += 1) tool.events.emit(EV.CELL, { x, z: 0 });
  assert(tool.jobs.coverage(tw).seen === 0, 'cells walked without the washer do not count');
  tool.props.carrying = 'washer';
  for (let x = -23.5; x <= 0; x += 1) tool.events.emit(EV.CELL, { x, z: 0 });
  assert(tw.status === 'done', `with the washer: ${JSON.stringify(tool.jobs.coverage(tw))}`);
});

test('count: sectorsOf house and used, match on the payload; each: has, clean.swab by spot', () => {
  const L = makeCycle(WEEK2, { day: 10, hour: 8, before: (w) => w.env.setBroodCurtain(true) });
  const chk = L.jobs.byKey('w2-check@10');
  assert(chk && chk.status === 'open', 'bird check day 10 08:00');
  for (let i = 0; i < 10; i++) L.act('sample.bird', { x: -20, z: 2, index: i, look: 'feathers', result: { look: 'feathers', value: 'good' } });
  assert(chk.st.list.length === 0, 'a feathers look does not count for the gait check');
  for (let i = 0; i < 10; i++) L.act('sample.bird', { x: [-20, -10, -2][i % 3], z: -2, index: i, look: 'gait', result: { look: 'gait', value: 1 } });
  assert(chk.status === 'done', `ten gaits from 3 brooding sectors: ${chk.status}`);
  const D = makeCycle(WEEK3, { day: 16, hour: 8 });
  const dr = D.jobs.byKey('w3-droppings@16');
  for (let i = 0; i < 10; i++) D.act('sample.bird', { x: -20 + (i % 2) * 2, z: -2, index: i, look: 'droppings', result: { value: 'normal' } });
  assert(dr.status === 'open' && new Set(dr.st.list.map((s) => s.s)).size === 1, 'one house sector');
  D.act('sample.bird', { x: 5, z: 2, index: 20, look: 'droppings' }); D.act('sample.bird', { x: 20, z: -2, index: 21, look: 'droppings' });
  assert(dr.status === 'done' && dr.st.list.every((s) => s.s >= 10), `three house sectors (10..17): ${dr.status}`);
  const R = makeCycle(WEEK2, { day: 11, hour: 13 });
  const r = R.jobs.byKey('r-raise@11');
  for (const line of [0, 1, 2, 3]) R.act('water.height', { line, cm: 22 });
  for (const line of [0, 1, 2]) R.act('feed.line', { line, running: true });
  assert(r.status === 'open', 'a feeder run toggle is not a height change (has heightCm)');
  for (const line of [0, 1, 2]) R.act('feed.line', { line, heightCm: 12 });
  assert(r.status === 'done', `raised: ${r.status}`);
  const C = makeCycle(CLEANOUT, { day: 46, hour: 7 });
  const sw = C.jobs.byKey('c-swabs@46');
  for (let spot = 0; spot < 9; spot++) C.act('clean.swab', { x: CLEAN.swabSpots[spot].x, z: CLEAN.swabSpots[spot].z, spot, result: { n: spot + 1 } });
  C.act('clean.swab', { x: 0, z: 0, spot: 3, result: { n: 10 } });
  assert(sw.status === 'open' && Math.abs(sw.progress - 0.9) < 1e-9, `nine places: ${sw.progress}`);
  C.act('clean.swab', { x: CLEAN.swabSpots[9].x, z: CLEAN.swabSpots[9].z, spot: 9, result: { n: 11 } });
  assert(sw.status === 'done', 'ten places');
});

test('every Phase 3 state test, on the farm stub with its fields set (held ones after their minutes)', () => {
  // [test, set(L) that meets it, minutes it must hold, set(L) that does not]
  const g = (L, v) => { L.farm.litter.coverGrid.fill(v); };
  const C = (L) => L.farm.clean;
  const CASES = [
    ['house-ready', (L) => g(L, 1), 0, (L) => { g(L, 0); for (let i = 0; i < 300; i++) L.farm.litter.coverGrid[i] = 1; }],
    ['rh-under', (L) => { L.env.houseRH = 70; L.env.forceHouseRH = 70; }, 60, (L) => { L.env.houseRH = 80; }],
    ['lame-cleared', (L) => { L.farm.flock.lameOnFloor = 0; }, 0, (L) => { L.farm.flock.lameOnFloor = 3; }],
    ['vaccine-drunk', (L) => { L.farm.health.vaccine.state = 'drunk'; }, 0, (L) => { L.farm.health.vaccine.state = 'mixed'; }],
    ['pans-grower', (L) => { L.farm.feed.panType = { starter: 0.05, grower: 0.95, finisher: 0 }; }, 0, (L) => { L.farm.feed.panType = { starter: 0.5, grower: 0.5, finisher: 0 }; }],
    ['pans-finisher', (L) => { L.farm.feed.panType = { starter: 0, grower: 0.05, finisher: 0.95 }; }, 0, (L) => { L.farm.feed.panType = { starter: 0, grower: 0.2, finisher: 0.8 }; }],
    ['caked-cleared', (L) => { L.farm.litter.cakedGrid.fill(0); }, 0, (L) => { L.farm.litter.cakedGrid.fill(0); for (let i = 0; i < 40; i++) L.farm.litter.cakedGrid[i * 7] = 1; }],
    ['air-clear', (L) => { L.farm.air.dustIndex = 0.6; L.farm.air.ammoniaPpm = 9; }, 120, (L) => { L.farm.air.dustIndex = 1.4; }],
    // (day 20: birds under 21 days, every fan without the pad; the pad branch is for big birds, below)
    ['heat-handled', (L) => { L.farm.comfort.pantShare = 0.5; L.farm.comfort.meanOver = 3; L.env.setFans(6); L.env.setPad(false); }, 30, (L) => { L.farm.comfort.pantShare = 0.5; L.env.setFans(4); L.env.setPad(false); }],
    ['pad-humid-ok', (L) => { L.env.setFans(6); L.env.setPad(false); }, 30, (L) => { L.env.setFans(3); L.env.setPad(false); }],
    ['house-empty', (L) => { L.farm.harvest.started = true; L.farm.flock.alive = 0; }, 0, (L) => { L.farm.harvest.started = false; L.farm.flock.alive = 0; }],
    ['litter-removed', (L) => g(L, 0.02), 0, (L) => g(L, 0.3)],
    ['house-washed', (L) => { C(L).washShare = 0.97; }, 0, (L) => { C(L).washShare = 0.9; }],
    ['house-disinfected', (L) => { C(L).sprayShare = 0.96; }, 0, (L) => { C(L).sprayShare = 0.5; }],
    ['house-dry', (L) => { C(L).washShare = 0.97; C(L).wetShare = 0.05; }, 0, (L) => { C(L).washShare = 0; C(L).wetShare = 0; }],
    ['lines-disinfected', (L) => { C(L).lines = [1, 1, 1, 1]; }, 0, (L) => { C(L).lines = [1, 1, 0, 1]; }],
    ['rest-done', (L) => { C(L).bookedDay = 20; }, 0, (L) => { C(L).bookedDay = 21; }],
    ['dark-period', (L) => { L.env.setLightProgram({ darkStart: 22, darkHours: 6 }); }, 0, (L) => { L.env.setLightProgram({ darkStart: 22, darkHours: 0 }); }],
  ];
  assert(CASES.length === STATE_TEST_IDS_CYCLE.length && CASES.every(([t]) => STATE_TEST_IDS_CYCLE.includes(t)), 'one case per STATE_TEST_IDS_CYCLE entry');
  for (const [test, yes, mins, no] of CASES) {
    const job = T(`t-${test}`, { type: 'state', test });
    const N = makeCycle(CLEANOUT, { day: 20, hour: 6, jobs: [job], before: no });
    N.at(20, 6 + (mins + 5) / 60); no(N); N.jobs.tick();
    assert(N.st(`t-${test}@20`) === 'open', `${test}: not met while its condition does not hold`);
    const Y = makeCycle(CLEANOUT, { day: 20, hour: 6, jobs: [job], before: yes });
    if (mins > 0) {
      assert(Y.st(`t-${test}@20`) === 'open', `${test}: needs ${mins} min first`);
      Y.at(20, 6 + (mins / 2) / 60); yes(Y); Y.jobs.tick();
      assert(Y.st(`t-${test}@20`) === 'open', `${test}: not yet after ${mins / 2} min`);
      Y.at(20, 6 + (mins + 1) / 60); yes(Y); Y.jobs.tick();
    }
    assert(Y.st(`t-${test}@20`) === 'done', `${test}: met (${Y.st(`t-${test}@20`)})`);
  }
  // heat-handled with a broken fan (big birds, day 30): the five that turn and the pad are every fan that turns
  const B = makeCycle(CLEANOUT, { day: 30, hour: 6, jobs: [T('t-hb', { type: 'state', test: 'heat-handled' }, { day: 30 })] });
  B.env.forceHouseTemp(31); // a hot house for big birds (target 20 °C), so the farm's own comfort stays warm while it holds
  B.env.setFansBroken([3]); B.env.setFans(6); B.env.setPad(true); B.farm.comfort.pantShare = 0.6; B.farm.comfort.meanOver = 4;
  B.at(30, 6.6); B.farm.comfort.pantShare = 0.6; B.farm.comfort.meanOver = 4; B.jobs.tick();
  assert(B.st('t-hb@30') === 'done', `five fans that turn and the pad (fansEffective ${B.env.fansEffective}, ${B.st('t-hb@30')})`);
  // review: 16-day-old birds under six fans and the pad are not handled (the heat sign: as few fans as the heat
  // allows; the pad is for big birds), and chilled birds (mean felt comfort under -1.5 °C) never are
  const Y = makeCycle(CLEANOUT, { day: 16, hour: 13, jobs: [T('t-hy', { type: 'state', test: 'heat-handled' }, { day: 16, round: 'pm' })] });
  const young = () => { Y.env.setFans(6); Y.env.setPad(true); Y.farm.comfort.pantShare = 0.4; Y.farm.comfort.meanOver = 2; };
  young(); Y.at(16, 13.6); young(); Y.jobs.tick();
  assert(Y.st('t-hy@16') === 'open', `young birds: six fans and the pad do not handle the heat (${Y.st('t-hy@16')})`);
  const K = makeCycle(CLEANOUT, { day: 16, hour: 13, jobs: [T('t-hk', { type: 'state', test: 'heat-handled' }, { day: 16, round: 'pm' })] });
  const chill = () => { K.env.setFans(6); K.env.setPad(false); K.farm.comfort.pantShare = 0; K.farm.comfort.meanOver = -4; };
  chill(); K.at(16, 13.6); chill(); K.jobs.tick();
  assert(K.st('t-hk@16') === 'open', `chilled birds (no panting, mean e -4 °C) are not handled (${K.st('t-hk@16')})`);
});

test('problem jobs only of the current level (and the recurring ones); missed at the level end', () => {
  const L = makeCycle(WEEK2, { day: 9, hour: 9 });
  L.events.emit(EV.FARM_PROBLEM, { id: 'coccidiosis', phase: 'symptom' });
  assert(!L.jobs.list().some((i) => i.id === 'p-blood'), 'week 3\'s problem does not open in week 2');
  L.events.emit(EV.FARM_PROBLEM, { id: 'blocked-filter', phase: 'symptom' });
  assert(!L.jobs.list().some((i) => i.id === 'p-water-drop'), 'nor the brooding week\'s');
  L.events.emit(EV.FARM_PROBLEM, { id: 'rainy-spell', phase: 'symptom' });
  const damp = L.jobs.list().find((i) => i.id === 'p-damp');
  assert(damp && damp.status === 'open', 'p-damp opens');
  near(damp.closesAt, 15 + 6 * H, 'a problem stays open to the level end');
  L.events.emit(EV.FARM_PROBLEM, { id: 'rainy-spell', phase: 'symptom' });
  assert(L.jobs.list().filter((i) => i.id === 'p-damp').length === 1, 'one instance per problem and level');
  L.events.emit(EV.FARM_PROBLEM, { id: 'abnormal-deaths', phase: 'symptom' });
  assert(L.jobs.list().some((i) => i.id === 'p-report'), 'the recurring abnormal-deaths report opens in any level');
  L.jobs.finish();
  assert(damp.status === 'missed', 'missed at the level end');
});

test('the rest: after the house is closed the only openings are the lab letter and the booked chick day', () => {
  const L = makeCycle(CLEANOUT, { day: 46, hour: 21 });
  near(L.jobs.endAt(), CYCLE.lastDay + 6 * H, 'nothing booked: the level ends day 70 06:00');
  near(L.jobs.nextOpening(), 48 + 6 * H, 'Next job from day 46 21:00: day 48 06:00 (lab letter, booking)');
  L.at(48, 6.1);
  assert(L.st('c-lab@48') === 'open' && L.st('c-book@48') === 'open' && L.st('c-rest@48') === 'waiting', 'lab and booking open, the rest waits for the booking');
  L.farm.clean.closedDay = 46;
  L.act('phone.bookChicks', { day: 67, result: { booked: true, bookedDay: 67 } });
  L.farm.clean.bookedDay = 67; L.jobs.tick();
  assert(L.st('c-book@48') === 'done' && L.st('c-rest@48') === 'open', 'booked: the rest job opens');
  near(L.jobs.endAt(), 67 + 6 * H, 'the level ends 06:00 on the booked day');
  near(L.jobs.nextOpening(), 67 + 6 * H, 'one Next job jump to the booked day');
  L.at(67, 6);
  assert(L.st('c-rest@48') === 'done', 'rest done at 06:00 on the booked day');
});

test('serialize -> restore keeps the level, its anchors and rule state; a Phase 2 save (v 1) maps the walk\'s cells', () => {
  const L = makeCycle(FINISH, { day: 41, hour: 13 });
  L.farm.harvest.catchAt = 42 + 3 * H; L.jobs.tick();
  for (let x = -23.5; x <= -10; x += 1) L.events.emit(EV.CELL, { x, z: 0 });
  const blob = JSON.parse(JSON.stringify(L.jobs.serialize()));
  assert(blob.levelId === 'finish' && blob.v === 2, `level in the save: ${blob.levelId} v${blob.v}`);
  const j2 = createJobEngine({ events: createEvents(), env: L.env, farm: L.farm, props: L.props });
  j2.restore(blob);
  assert(j2.level === FINISH && JSON.stringify(j2.serialize()) === JSON.stringify(L.jobs.serialize()), 'identical after restore');
  near(j2.anchors.catch, 42 + 3 * H, 'catch anchor kept');
  const P2 = makeLevel({ startDay: 2, startHour: 6 });
  for (const z of [-2.5]) for (let x = BROOD_BOUNDS.xMin + 0.5; x <= BROOD_BOUNDS.xMax; x += 1) P2.events.emit(EV.CELL, { x, z });
  const s = JSON.parse(JSON.stringify(P2.jobs.serialize()));
  const walk = s.list.find((i) => i.key === 'r-walk@2');
  const brood = walk.st.cells.map((gi) => BROOD_CELLS.findIndex(([x, z]) => Math.abs(x - (-24 + (gi % 48) + 0.5)) < 1e-9 && Math.abs(z - (-6 + Math.floor(gi / 48) + 0.5)) < 1e-9));
  walk.st.cells = brood; s.v = 1; delete s.levelId;   // as Phase 2 saved it
  const j3 = createJobEngine({ events: createEvents(), env: P2.env, farm: P2.farm, props: P2.props });
  j3.restore(s);
  assert(j3.level === LEVEL1 && j3.coverage(j3.byKey('r-walk@2')).seen === P2.jobs.coverage(P2.jobs.byKey('r-walk@2')).seen, 'Phase 2 cells mapped to the grid');
});

test('every cycle job def resolves its window or its level anchor', () => {
  for (const j of JOBS_CYCLE) {
    if (j.kind === 'problem') continue;
    const day = j.kind === 'dated' ? j.day : j.days[0];
    const lv = levelOfDay(day);
    assert(j.round === 'rel' ? lv.anchors && j.rel.anchor in lv.anchors : windowHours(j, lv.rounds), `${j.id} window in ${lv.id}`);
  }
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
