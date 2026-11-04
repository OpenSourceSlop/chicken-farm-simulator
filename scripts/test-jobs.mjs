// Node tests for the job engine of every level (src/job-engine.js) with a fake clock: the real createSim,
// the event bus, the farm (stub or model) and the JOBS table. Owner: package "level".
// Run: node scripts/test-jobs.mjs   PHASE2.md §14.2 "Acceptance".
import { createSim } from '../src/sim.js';
import { createFarm } from '../src/farm.js';
import { createEvents, EV } from '../src/events.js';
import { createJobEngine, BROOD_CELLS, LEVEL_END_DAY, windowHours } from '../src/job-engine.js';
import { JOBS } from '../src/content-jobs.js';
import { BROOD_BOUNDS, HEATERS, LEVEL1, CYCLE, CLEAN, PLAN_LEVEL, WEEK2, WEEK3, WEEKS45, FINISH, CLEANOUT, HEAT_P4, levelOfDay } from '../src/config.js';
import { STATE_TEST_IDS_P4, JOBS_COND } from '../src/content-jobs-cond.js';
import { nightComfortNow } from '../src/job-engine.js';
import { flowToday, brooderRowC, VENT_BAND } from '../src/job-figures.js';
import { JOBS_CYCLE, STATE_TEST_IDS_P3 } from '../src/content-jobs-cycle.js';
import { STRIPS, partRows, stripRows } from '../src/job-strips.js';
import { jobPlaces, nextPlace } from '../src/job-next.js';
import { STRIPS_CYCLE } from '../src/job-strips-cycle.js';
import { STRIPS_COND } from '../src/job-strips-cond.js';
import { ventNeed } from '../src/job-figures.js';
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const near = (a, b, msg) => assert(a != null && Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);
const H = 1 / 24;

/** A level at 07:00 on the prep day, engine started. Grids set so no state job is done by itself. */
function makeLevel({ startDay = -1, startHour = 7, condition = null } = {}) {
  const env = createSim();
  const events = createEvents();
  const farm = createFarm(env, { events });
  env.addStepper(farm.step);
  farm.start(LEVEL1, { seed: 1, condition });
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

test('each: four flow tests near age + 20 (live part); skip past the window marks missed', () => {
  const L = makeLevel({ startDay: 2, startHour: 6 });
  // the farm keeps each line's last reading (farm-act water.flowtest); the drinker plate: 22 ml/min, nipples about 13 cm on day 2
  const flow = (line, mlMin) => { const l = L.farm.water.lines[line]; l.lastFlow = { mlMin, at: L.env.day }; L.act('water.flowtest', { line, result: { mlMin } }); };
  for (const l of L.farm.water.lines) l.heightCm = 13;
  for (const line of [0, 1, 2]) flow(line, 22);
  const d = L.jobs.byKey('r-drinkers@2');
  const parts = L.jobs.parts(d);
  assert(d.status === 'open' && Math.abs(parts[0].progress - 0.75) < 1e-9 && !parts[1].met, `3 of 4: ${parts[0].progress}`);
  flow(1, 22); assert(d.status === 'open', 'same line twice is not a fourth');
  flow(3, 12); assert(d.status === 'open', 'a low flow on line 4 keeps the job open (the farmer adjusts and tests again)');
  flow(3, 21); assert(d.status === 'done', 'all four, all near 22 ml/min');
  assert(d.result[0]['0'].mlMin === 22 && d.result[1].flowsMlMin[3] === 21, 'flows in the result');
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
  for (const l of L.farm.water.lines) l.heightCm = 50;
  L.farm.water.lines[0].heightCm = 11; L.jobs.tick();
  assert(L.jobs.byKey('prep-drinkers@-1').progress === 0.25, 'prep drinkers: one line of four at 10–12 cm');
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
  assert(j2.byKey('r-drinkers@0').st.parts[0].seen['0'], 'rule state kept');
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
function makeCycle(def, { day = def.startDay, hour = def.startHour ?? 6, jobs: jobList, before, condition = null } = {}) {
  const env = createSim();
  const events = createEvents();
  const farm = createFarm(env, { events });
  env.addStepper(farm.step);
  farm.start(LEVEL1, { seed: 1, condition });
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
  assert(L.st('w2-lights@8') === 'open' && !L.jobs.byKey('r-minvent@8') && L.st('r-walk@8') === 'open', 'day 8 morning jobs open (the step-up on the odd mornings)');
  assert(!L.jobs.list().some((i) => i.day < 8 || i.def.kind === 'dated' && i.def.day < 8), 'nothing of the brooding week');
  L.at(9, 6.1);
  assert(L.jobs.byKey('r-minvent@9') && L.jobs.byKey('r-minvent@10') == null && !L.jobs.byKey('r-drinkers@9'), 'onDays: the step-up on day 9, no flow tests that morning (day 10 not made yet)');
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
  near(w.opensAt, 42 + 2 * H - 13 * H, 'withdraw opens catch - 13 h'); near(w.closesAt, 42 + 2 * H - 9 * H, 'closes catch - 9 h');
  L.farm.harvest.catchAt = 42 + 4 * H; L.jobs.tick();
  near(w.opensAt, 41 + 15 * H, 'the booking moved the window'); near(lines.opensAt, 42 + 3 * H, 'lines -1 h');
  near(L.jobs.nextOpening(41 + 6.1 * H), 41 + 13 * H, 'next opening: the afternoon round 13:00');
  L.at(41, 15.5);
  assert(w.status === 'open', 'withdraw open');
  L.farm.harvest.catchAt = 42 + 5 * H; L.jobs.tick();
  near(w.opensAt, 41 + 15 * H, 'an open job keeps its window');
  // Phase 4 (§6.7, DONE_P4): done on the outcome, the feed off at the feeder box (the farm's farm.feed.withdrawn)
  L.farm.act('feed.withdraw', { on: true }); L.jobs.tick();
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
  // the plates' heights for day 11 (nipples about 21 cm, rims about 13 cm), ±3 cm
  for (const l of R.farm.water.lines) l.heightCm = 22;
  for (const l of R.farm.feed.lines) l.heightCm = 40;
  R.jobs.tick();
  assert(r.status === 'open', 'the drinker lines raised, the pans still high');
  for (const l of R.farm.feed.lines) l.heightCm = 12;
  R.jobs.tick();
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
  assert(CASES.length === STATE_TEST_IDS_P3.length && CASES.every(([t]) => STATE_TEST_IDS_P3.includes(t)), 'one case per Phase 3 state test (STATE_TEST_IDS_P3)');
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

// ---------------- the clarity round: job strips and the outcome rules ----------------
test('job strips: every open job of every level builds its rows, neutral words only', () => {
  const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;
  const days = [[null, -1, 8], [null, -1, 17], [null, 0, 9], [null, 2, 6.5], [null, 6, 14], [WEEK2, 8, 9], [WEEK2, 9, 13.5], [WEEK2, 12, 7], [WEEK3, 16, 13.5], [WEEK3, 18, 9],
    [FINISH, 36, 7], [FINISH, 41, 15], [CLEANOUT, 44, 14]];
  let n = 0;
  for (const [def, day, hour] of days) {
    const L = def ? makeCycle(def, { day, hour }) : makeLevel({ startDay: day, startHour: hour });
    const c = { env: L.env, farm: L.farm, records: { notebook: [] }, props: L.props, engine: L.jobs, minmax: () => ({ min: 20, max: 30 }), weighings: () => ({ n: 0, sectors: 0, mean: null }),
      from: { x: -14, z: 0, inside: true }, paused: n % 2 === 0 };
    for (const inst of L.jobs.open()) {
      const S = STRIPS[inst.id] || STRIPS_CYCLE[inst.id];
      const rows = stripRows(S, c, inst, 'drinker-0');
      assert(Array.isArray(rows), `${inst.key}: rows`);
      for (const r of rows) for (const t of [r.text, r.what, r.sign, r.yours]) if (t != null) { assert(typeof t === 'string' && !/undefined|NaN|\[object/.test(t), `${inst.key}: "${t}"`); assert(!VERDICT.test(t), `${inst.key}: verdict word in "${t}"`); }
      n++;
    }
  }
  assert(n > 40, `strips built for ${n} open jobs`);
});

// ---------------- the steps hotfix: the next place of a multi-place job, the pause ----------------
test('steps hotfix: the flow job at line 1 names the line 2 regulator; a reading out of the band says which key; the pause line', () => {
  const L = makeLevel({ startDay: 0, startHour: 8.27 });
  const inst = L.jobs.byKey('r-drinkers@0');
  assert(inst?.status === 'open', `r-drinkers open at 08:16: ${inst?.status}`);
  const c = { env: L.env, farm: L.farm, props: L.props, engine: L.jobs, from: { x: -21.3, z: -4.9, inside: true }, line: 0, paused: true };
  const text = (rows) => rows.map((r) => r.text || `${r.what} ${r.sign} ${r.yours}`).join(' | ');
  let rows = stripRows(STRIPS['r-drinkers'], c, inst, 'drinker-0');
  assert(/Then walk to the line 2 regulator, about 3 m south along the west wall/.test(text(rows)), `then row: ${text(rows)}`);
  assert(rows.some((r) => r.paused) && /clock is paused/.test(text(rows)), 'the pause line while the clock is paused');
  assert(/1 farm minute/.test(text(rows)), 'how long a test takes');
  L.farm.water.lines[0].pressureCm = 12; L.farm.act('water.flowtest', { line: 0 }); L.jobs.tick();   // 28 ml/min, over 23
  rows = stripRows(STRIPS['r-drinkers'], c, inst, 'drinker-0');
  assert(/above 23: lower the pressure one step/.test(text(rows)), `out of the band: ${text(rows)}`);
  L.farm.water.lines[0].pressureCm = 8; L.farm.act('water.flowtest', { line: 0 }); L.jobs.tick();    // 20 ml/min
  for (const l of L.farm.water.lines) l.heightCm = 11;
  rows = stripRows(STRIPS['r-drinkers'], { ...c, paused: false }, inst, 'drinker-0');
  assert(/Next: walk to the line 2 regulator/.test(text(rows)) && !rows.some((r) => r.paused), `line 1 done, next line 2: ${text(rows)}`);
  for (const i of [1, 2, 3]) { L.farm.water.lines[i].pressureCm = 8; L.farm.act('water.flowtest', { line: i }); }
  L.jobs.tick();
  assert(inst.status === 'done', `four lines in the band: ${inst.status}`);
  assert(nextPlace(inst, c, { from: c.from }) === null, 'no next place once done');
});

test('steps hotfix: every multi-place job names its places with a way there; the marker places stay on the farm', () => {
  const days = [[null, -1, 8], [null, 0, 9], [null, 2, 6.5], [null, 6, 14], [WEEK2, 8, 9], [WEEK2, 12, 7], [WEEK3, 16, 13.5], [WEEK3, 18, 9], [FINISH, 41, 15], [CLEANOUT, 43, 9], [CLEANOUT, 46, 9]];
  let multi = 0;
  for (const [def, day, hour] of days) {
    const L = def ? makeCycle(def, { day, hour }) : makeLevel({ startDay: day, startHour: hour });
    const c = { env: L.env, farm: L.farm, props: L.props, engine: L.jobs };
    for (const inst of L.jobs.open()) {
      for (const from of [{ x: -14, z: 0, inside: true }, { x: -40, z: 36, inside: false }]) {
        const all = jobPlaces(inst, { ...c, from });
        if (!all) continue;
        multi++;
        for (const p of all) assert(p.name && p.todo && Number.isFinite(p.at.x) && Math.abs(p.at.x) < 60 && Math.abs(p.at.z) < 40, `${inst.key}: place ${JSON.stringify(p)}`);
        const np = nextPlace(inst, c, { from });
        if (all.length) assert(np && /^[A-Z]/.test(np.text) && !/undefined|NaN/.test(np.text), `${inst.key}: next ${np?.text}`);
      }
    }
  }
  assert(multi >= 10, `multi-place jobs seen: ${multi}`);
});

test('outcome rules: prep-vent in the band only, r-minvent a real step up, the feeders on the litter, the night held', () => {
  const L = makeLevel({ startDay: -1, startHour: 8 });
  const v = L.jobs.byKey('prep-vent@-1');
  const send = (t) => L.farm.act('vent.timer', t);
  send({ fans: 1, onSec: 0, cycleSec: 300 }); L.jobs.tick();
  assert(v.status === 'open', 'the timer switched off is no setting');
  send({ fans: 1, onSec: 20, cycleSec: 300 }); L.jobs.tick();
  assert(v.status === 'open', `20 s (260 %) is not in the band: ${v.status}`);
  send({ fans: 1, onSec: 8, cycleSec: 300 }); L.jobs.tick();
  assert(v.status === 'done', `8 s for 6,000 chicks of 42 g (103 %): ${v.status}`);
  // the pans: flooded and full but hanging at 40 cm is not on the litter
  const f = L.jobs.byKey('prep-feeders@-1');
  for (const l of L.farm.feed.lines) { l.flood = true; l.running = true; l.kg = 66; l.panFill = 1; l.heightCm = 40; }
  L.jobs.tick(); assert(f.status === 'open', 'flooded pans at 40 cm');
  for (const l of L.farm.feed.lines) l.heightCm = 5;
  L.jobs.tick(); assert(f.status === 'done', 'flooded, full and on the litter');
  const M = makeCycle(WEEK2, { day: 9, hour: 6.2 });
  const m = M.jobs.byKey('r-minvent@9');
  M.farm.flock.placed = 6000; M.farm.flock.alive = 5960; M.farm.flock.meanWeightG = 260;
  const need = ventNeed(M.env, M.farm).need, on = (share) => Math.round((share * need * 300) / 36000);
  M.farm.vent = { fans: 1, onSec: on(1.0), cycleSec: 300 }; M.env.setVentTimer(M.farm.vent); // yesterday's setting
  M.farm.act('vent.timer', { fans: 1, onSec: on(1.0), cycleSec: 300 }); M.jobs.tick();
  assert(m.status === 'open', 'the same setting again is no step up');
  M.farm.act('vent.timer', { fans: 1, onSec: on(1.6), cycleSec: 300 }); M.jobs.tick();
  assert(m.status === 'open', 'a step up past 130 % of the need');
  M.farm.act('vent.timer', { fans: 1, onSec: on(0.8), cycleSec: 300 }); M.farm.act('vent.timer', { fans: 1, onSec: on(1.1), cycleSec: 300 }); M.jobs.tick();
  assert(m.status === 'done', `a step up into the band: ${m.status}`);
  // an order in the brooding week (Phase 2's single silo figure): 2,000 kg on top of 300 kg is 3 days and more
  const O = makeLevel({ startDay: 4, startHour: 7 });
  O.farm.flock.placed = 6000; O.farm.flock.alive = 5980; O.farm.feed.siloKg = 300;
  O.events.emit(EV.FARM_PROBLEM, { id: 'low-silo', phase: 'symptom' });
  const o = O.jobs.list().find((i) => i.id === 'p-order-feed');
  O.farm.act('feed.order', { kg: 200 }); O.jobs.tick();
  assert(o && o.status === 'open', `200 kg on 300 kg is under 3 days of feed: ${o?.status}`);
  O.farm.act('feed.order', { kg: 2000 }); O.jobs.tick();
  assert(o.status === 'done', `2,000 kg: ${o.status}`);
  const N = makeCycle(WEEK3, { day: 16, hour: 18.2 });
  const night = N.jobs.byKey('r-vent-night@16');
  N.farm.comfort.meanOver = 0.5; N.farm.comfort.hotFrom = 2.8;
  N.act('fans.read', { fans: 1 }); N.jobs.tick();
  N.at(16, 18.2 + 20 / 60); N.farm.comfort.meanOver = 0.5; N.jobs.tick();
  const p = N.jobs.parts(night)[1];
  assert(night.status === 'open' && p.held && p.held.min >= 0, `held part reports its minutes: ${JSON.stringify(p.held)}`);
});

// ---------------- Phase 4 (PHASE4.md §12.2): conditions in the engine, the new state tests, the clarity rules ----------------
test('Phase 4: a condition job is made only in its condition; routineDays move a routine; a dropped problem makes no job', () => {
  const N = makeLevel({ startDay: 1, startHour: 6 }), Hh = makeLevel({ startDay: 1, startHour: 6, condition: 'hot' });
  assert(!N.jobs.byKey('h-brood-air@1') && Hh.jobs.byKey('h-brood-air@1'), 'h-brood-air only in the hot season');
  assert(!N.jobs.list().some((i) => i.def.condition), 'the normal season makes no condition job');
  assert(Hh.jobs.list().filter((i) => i.def.condition).every((i) => i.def.condition === 'hot'), 'only the hot season\'s condition jobs');
  near(Hh.jobs.byKey('h-brood-air@1').opensAt, 1 + 14 * H, 'h-brood-air opens 14:00'); near(Hh.jobs.byKey('h-brood-air@1').closesAt, 1 + 18 * H, 'closes 18:00');
  const W = makeLevel({ startDay: 1, startHour: 6, condition: 'water' });
  assert(W.jobs.byKey('w-test@1') && !Hh.jobs.byKey('w-test@1'), 'w-test only for a water problem');
  // the hot season drops Phase 2's warm afternoon: no p-warm on its symptom; the normal season opens it
  N.events.emit(EV.FARM_PROBLEM, { id: 'warm-afternoon', phase: 'symptom' });
  Hh.events.emit(EV.FARM_PROBLEM, { id: 'warm-afternoon', phase: 'symptom' });
  assert(N.jobs.list().some((i) => i.id === 'p-warm') && !Hh.jobs.list().some((i) => i.id === 'p-warm'), 'p-warm only where warm-afternoon is a problem');
  // routineDays: the hot season's afternoon fan check and night ventilation from day 8 (Phase 3: day 15)
  const n8 = makeCycle(WEEK2, { day: 8, hour: 6 }), h8 = makeCycle(WEEK2, { day: 8, hour: 6, condition: 'hot' });
  assert(!n8.jobs.byKey('r-fans-pm@8') && h8.jobs.byKey('r-fans-pm@8') && h8.jobs.byKey('r-vent-night@8'), 'r-fans-pm and r-vent-night on day 8 in the hot season only');
  assert(h8.jobs.byKey('h-young-heat@8') && !n8.jobs.byKey('h-young-heat@8'), 'h-young-heat in week 2 of the hot season');
  // the rainy season's own problem opens its job; another condition's does not
  const r = makeCycle(WEEKS45, { day: 33, hour: 15, condition: 'rainy' }), w = makeCycle(WEEKS45, { day: 33, hour: 15, condition: 'water' });
  r.events.emit(EV.FARM_PROBLEM, { id: 'power-cut', phase: 'symptom', alarm: true }); w.events.emit(EV.FARM_PROBLEM, { id: 'power-cut', phase: 'symptom', alarm: true });
  assert(r.jobs.list().some((i) => i.id === 'p-power' && i.status === 'open') && !w.jobs.list().some((i) => i.id === 'p-power'), 'p-power only in the rainy season');
  assert(r.jobs.groups().pinned.some((i) => i.id === 'p-power'), 'p-power is pinned');
  // a bad batch's truck comes at 10:00: the engine's truck hour follows the delivery (the farm announces the truck itself)
  const B = makeLevel({ startDay: 0, startHour: 6, condition: 'badChicks' });
  assert(B.jobs.merged().delivery?.arrivalHour === 10 && N.jobs.merged().delivery === null, 'the delivery of a bad batch: 10:00');
});

test('Phase 4: rebuild() after a condition change: the new condition\'s jobs come, the old one\'s go, done jobs stay', () => {
  const L = makeLevel({ startDay: 1, startHour: 14.5 });
  const done = L.jobs.byKey('r-dips-pm@1'); assert(L.jobs.complete('r-dips-pm@1'), 'r-dips-pm completed');
  L.farm.setCondition('hot'); L.jobs.rebuild();
  assert(L.jobs.byKey('h-brood-air@1')?.status === 'open', `h-brood-air made and open at 14:30: ${L.jobs.byKey('h-brood-air@1')?.status}`);
  assert(done.status === 'done' && L.jobs.byKey('r-dips-pm@1') === done, 'done jobs stay');
  L.farm.setCondition('water'); L.jobs.rebuild();
  assert(!L.jobs.byKey('h-brood-air@1') && L.jobs.condition === 'water', 'the hot season\'s job goes');
  assert(L.jobs.byKey('w-test@1')?.status === 'open', 'w-test (08:00-18:00) made and open');
  const late = makeLevel({ startDay: 1, startHour: 19 });
  late.farm.setCondition('water'); late.jobs.rebuild();
  assert(!late.jobs.byKey('w-test@1'), 'a job whose window has passed is not made');
  L.farm.setCondition(null); L.jobs.rebuild();
  assert(!L.jobs.list().some((i) => i.def.condition && i.status !== 'done'), 'back to the normal season: no condition job left open');
});

test('Phase 4: every new state test (STATE_TEST_IDS_P4) on a farm with its fields set', () => {
  // [test, rule extras, set(L) that meets it, minutes it must hold, set(L) that does not]
  const CASES = [
    ['power-on', {}, (L) => { L.farm.power.on = true; }, 0, (L) => { L.farm.power.on = false; }],
    ['brood-warmer', {}, (L) => { L.env.setHeaterSetpoint(brooderRowC(20) + 1); }, 0, (L) => { L.env.setHeaterSetpoint(brooderRowC(20) + 2.5); }],
    ['line-flow-ok', { line: 3 }, (L) => { L.farm.water.lines[3].lastFlow = { mlMin: flowToday(L.env) + 1, at: L.env.day }; }, 0,
      (L) => { L.farm.water.lines[3].lastFlow = { mlMin: flowToday(L.env) - 9, at: L.env.day }; L.farm.water.lines[0].lastFlow = { mlMin: flowToday(L.env), at: L.env.day }; }],
    ['rh-under', { max: 85 }, (L) => { L.env.houseRH = 82; L.env.forceHouseRH = 82; }, 60, (L) => { L.env.houseRH = 88; L.env.forceHouseRH = 88; }],
    ['blend-24h', { feed: 'finisher' }, (L) => { L.farm.stats.blendFinH = 21; L.farm.stats.blendH = 0; }, 0, (L) => { L.farm.stats.blendFinH = 12; L.farm.stats.blendH = 24; }],
    ['medicine-course', {}, (L) => { L.farm.health.medication.daysOn = 3; }, 0, (L) => { L.farm.health.medication.daysOn = 2; }],
    ['feed-withdrawn', {}, (L) => { L.farm.feed.withdrawn = true; }, 0, (L) => { L.farm.feed.withdrawn = false; }],
    ['pump-ok', {}, (L) => { Object.assign(L.farm.waterTank, { pumpShare: 1, fixing: false }); }, 0, (L) => { Object.assign(L.farm.waterTank, { pumpShare: 1, fixing: true, fixUntil: L.env.day + 2 * H }); }],
    ['lines-cool', {}, (L) => { L.farm.water.lineTempC = [28.5, 29.9, 30, 27]; }, 0, (L) => { L.farm.water.lineTempC = [28.5, 31.2, 30, 27]; }],
  ];
  assert(CASES.length + 1 === STATE_TEST_IDS_P4.length && CASES.every(([t]) => STATE_TEST_IDS_P4.includes(t)), 'a case for every Phase 4 state test (night-comfort below)');
  for (const [test, extra, yes, mins, no] of CASES) {
    const job = T(`t-${test}`, { type: 'state', test, ...extra });
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
  const P = makeCycle(CLEANOUT, { day: 20, hour: 6, jobs: [T('t-pw', { type: 'state', test: 'pump-ok' })], before: (L) => Object.assign(L.farm.waterTank, { pumpShare: 0.88, fixing: false }) });
  P.jobs.tick(); assert(P.st('t-pw@20') === 'open', 'a worn pump is not ok');
  // the re-defined night-comfort (PHASE4.md §2.4): a quarter at most panting and none chilled, or big birds on a warm
  // evening with every working fan and the pad
  const e = (o) => ({ hour: 19, day: 33.8, outsideTemp: 31, fansEffective: 6, fansBroken: [], padOn: true, houseRH: 80, ...o });
  const f = (pant, over) => ({ comfort: { pantShare: pant, meanOver: over } });
  assert(nightComfortNow(e({}), f(0.2, 1)), 'a fifth panting, comfortable');
  assert(!nightComfortNow(e({ hour: 17.9 }), f(0, 0)), 'not before 18:00');
  assert(!nightComfortNow(e({ padOn: false, fansEffective: 3 }), f(0.36, 2)), 'about a third panting with three fans');
  assert(!nightComfortNow(e({ outsideTemp: 25 }), f(0.1, -2)), 'chilled birds are not comfortable');
  assert(nightComfortNow(e({}), f(0.9, 6)), 'day 33, 31 °C outside: every fan and the pad (the heat sign\'s evening line)');
  assert(!nightComfortNow(e({ outsideTemp: 29 }), f(0.9, 6)), 'under 29.5 °C outside the fans and the pad alone do not do it');
  assert(!nightComfortNow(e({ day: 20.8 }), f(0.9, 6)), 'birds under 28 days');
  assert(!nightComfortNow(e({ fansBroken: [3], fansEffective: 4 }), f(0.9, 6)), 'every WORKING fan (five turn, four on)');
  assert(nightComfortNow(e({ fansBroken: [3], fansEffective: 5, padOn: false, houseRH: 92 }), f(0.9, 6)), 'five working fans, the pad off over 90 % humidity');
  assert(HEAT_P4.nightPantMax === 0.25, 'the job reads HEAT_P4');
  const Nt = makeCycle(WEEK3, { day: 16, hour: 18.2 });
  const night = Nt.jobs.byKey('r-vent-night@16'), calm = () => { Nt.farm.comfort.pantShare = 0.2; Nt.farm.comfort.meanOver = 0.4; };
  Nt.act('fans.read', { fans: 1 }); calm(); Nt.jobs.tick();
  Nt.at(16, 18.2 + 15 / 60); calm(); Nt.jobs.tick();
  assert(night.status === 'open', 'held 15 of 30 minutes');
  Nt.at(16, 18.2 + 31 / 60); calm(); Nt.jobs.tick();
  assert(night.status === 'done', `held 30 minutes: ${night.status}`);
});

test('Phase 4: p-pump done only once the repair has ended; p-power done on the immediate gen.start result; p-nipples on line 4', () => {
  const W = makeCycle(WEEKS45, { day: 27, hour: 7, condition: 'water' });
  W.events.emit(EV.FARM_PROBLEM, { id: 'pump-wear', phase: 'symptom' });
  const pump = W.jobs.list().find((i) => i.id === 'p-pump');
  assert(pump && pump.status === 'open', 'p-pump opens on the worn pump\'s symptom');
  W.farm.waterTank.pumpShare = 0.88;
  const r = W.farm.act('pump.fix', {});
  assert(r && r.started === true && r.hours === 2, `pump.fix answers at once: ${JSON.stringify(r)}`);
  W.jobs.tick();
  assert(pump.status === 'open' && W.jobs.parts(pump)[0].met && !W.jobs.parts(pump)[1].met, 'the repair started, the pump not ok yet (fixing)');
  W.at(27, 8); assert(pump.status === 'open', 'one farm hour into the repair: still open');
  W.at(27, 9.05); assert(pump.status === 'done', `the repair ended (2 farm hours): ${pump.status}, fixing ${W.farm.waterTank.fixing}`);
  const R = makeCycle(WEEKS45, { day: 33, hour: 15.2, condition: 'rainy' });
  R.farm.debug.power(false);
  R.events.emit(EV.FARM_PROBLEM, { id: 'power-cut', phase: 'symptom', alarm: true }); // (the farm's alarm once weeks 4-5 run on it)
  const pw = R.jobs.list().find((i) => i.id === 'p-power');
  assert(pw && pw.status === 'open' && R.farm.power.on === false, 'the cut opens p-power');
  const t0 = R.env.day;
  R.farm.act('gen.start', {}); R.farm.act('gen.switch', { to: 'generator' });
  assert(pw.status === 'done' && R.env.day === t0, `done at once on gen.start + the switch, no farm time: ${pw.status}`);
  const N = makeCycle(WEEK3, { day: 18, hour: 7, condition: 'water' });
  N.events.emit(EV.FARM_PROBLEM, { id: 'iron-nipples', phase: 'symptom' });
  const nip = N.jobs.list().find((i) => i.id === 'p-nipples');
  N.farm.water.lines[3].lastFlow = { mlMin: 20, at: N.env.day };
  N.act('water.flush', { line: 3, on: true, result: { flushClear: 1 } }); N.jobs.tick();
  assert(nip.status === 'open', 'flushed, the last flow test still the low one');
  N.farm.water.lines[3].lastFlow = { mlMin: flowToday(N.env), at: N.env.day + 1e-4 }; N.jobs.tick();
  assert(nip.status === 'done', `flushed and tested within 3 ml/min: ${nip.status}`);
});

test('Phase 4: h-brood-air is not done by a timer or fan change while the chicks are still hot', () => {
  const L = makeLevel({ startDay: 3, startHour: 14.1, condition: 'hot' });
  const j = L.jobs.byKey('h-brood-air@3');
  assert(j && j.status === 'open', 'open at 14:06');
  L.env.forceHouseTemp(39);
  L.farm.act('vent.timer', { fans: 2, onSec: 120, cycleSec: 300 }); L.farm.act('vent.fans', { fans: 1 }); L.jobs.tick();
  L.at(3, 15.2); L.env.forceHouseTemp(39); L.jobs.tick();
  assert(j.status === 'open' && L.jobs.parts(j)[0].met && !L.jobs.parts(j)[1].met, `the chicks still hot after an hour: ${j.status}`);
});

test('Phase 4 clarity rules (DONE_P4): f-withdraw early, the half-and-half of both feeds, the medicine course', () => {
  const F = makeCycle(FINISH, { day: 41, hour: 9 });
  const w = F.jobs.byKey('f-withdraw@41');
  F.at(41, 10); F.farm.act('feed.withdraw', { on: true }); F.jobs.tick();          // catch - 16 h (the default catch day 42 02:00)
  assert(w.status === 'waiting', `taken early: the job waits for its window (${w.status})`);
  F.at(41, 13.01);
  assert(w.status === 'done', `done when the window opens at catch - 13 h: ${w.status}`);
  assert(Math.abs(w.doneAt - (41 + 13 * H)) <= 2 / 1440, `done at 13:00 (${w.doneAt})`);
  for (const [def, key, feed, stat] of [[WEEK3, 'w3-change@15', 'grower', 'blendH'], [WEEKS45, 'w45-change@29', 'finisher', 'blendFinH']]) {
    const C = makeCycle(def, { day: def === WEEK3 ? 15 : 29, hour: 7 });
    const ch = C.jobs.byKey(key);
    C.farm.feed.panType = { starter: 0, grower: feed === 'grower' ? 0.95 : 0.05, finisher: feed === 'finisher' ? 0.95 : 0 };
    C.farm.stats[stat] = 6; C.jobs.tick();
    assert(ch.status === 'open', `${key}: the pans 95 % ${feed} after 6 h of half-and-half is not the change`);
    C.farm.stats[stat] = 21; C.jobs.tick();
    assert(ch.status === 'done', `${key}: 21 h half-and-half and the pans 95 % ${feed}: ${ch.status}`);
  }
  const B = makeCycle(WEEK3, { day: 17, hour: 9 });
  B.events.emit(EV.FARM_PROBLEM, { id: 'coccidiosis', phase: 'symptom' });
  const blood = B.jobs.list().find((i) => i.id === 'p-blood');
  B.act('phone.vet', { reason: 'blood in the droppings' }); B.farm.act('water.medicate', { on: true }); B.jobs.tick();
  assert(blood.status === 'open' && B.jobs.parts(blood)[1].met, 'the vet and the medicine on: day 1 of 3');
  B.farm.health.medication.daysOn = 2; B.at(18, 9); B.farm.health.medication.daysOn = 2; B.jobs.tick();
  assert(blood.status === 'open', 'medicine day 2 of 3');
  B.farm.health.medication.daysOn = 3; B.jobs.tick();
  assert(blood.status === 'done', `the vet's course of 3 days: ${blood.status}`);
  // until the farm counts daysOn, the days from its start while it is on
  const B2 = makeCycle(WEEK3, { day: 17, hour: 9 });
  B2.events.emit(EV.FARM_PROBLEM, { id: 'coccidiosis', phase: 'symptom' });
  const b2 = B2.jobs.list().find((i) => i.id === 'p-blood');
  B2.act('phone.vet', { reason: 'blood in the droppings' }); B2.farm.act('water.medicate', { on: true });
  delete B2.farm.health.medication.daysOn; B2.at(19, 0.1); delete B2.farm.health.medication.daysOn; B2.jobs.tick();
  assert(b2.status === 'done', `started day 17: days 17, 18, 19 (${b2.status})`);
});

/** level.js on the real sim and the farm (stub or model), the 3D modules and the ui stubbed (as test-level.mjs). */
function makeLevelJs(condition) {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, setMode() {}, closePanel() {}, showResult() {}, jobCard: { refresh() {}, reset() {} }, newRun() {} };
  const store = { save: () => true, load: () => null, clear() {}, loadProfile: () => null, saveProfile() {}, info: () => null };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock: { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} },
    props: { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} }, ui });
  level.start({ seed: 1, condition });
  return { ...w, level, ui };
}

test('Phase 4: a Next job skip stops at an EV.POWER { on: false } with no alarm problem (the generator runs dry); no skip and the carry clock while dark', () => {
  const L = makeLevelJs('hot');
  assert(L.farm.condition === 'hot', 'level.start({ condition }) puts it on the farm');
  L.level.debug.goto(-1, 8);
  L.farm.debug.power(false);                                 // the mains off (no alarm problem in the hot season)
  L.farm.act('gen.start', {}); L.farm.act('gen.switch', { to: 'generator' });
  assert(L.farm.power.on && L.farm.generator.running, 'the house on the generator');
  L.farm.generator.fuelL = 15;                               // about an hour of fuel
  let offs = 0; L.events.on(EV.POWER, (p) => { if (p.on === false) offs++; });
  const t0 = L.env.day;
  L.level.nextJob(); const r = L.level.nextJob();
  const went = (L.env.day - t0) * 24;
  assert(offs === 1 && L.farm.power.on === false, `the generator ran dry during the skip (${offs} cuts, power ${L.farm.power.on})`);
  assert(went > 0.8 && went < 1.25 && r.stopped === 'alarm', `the skip stopped at the cut: ${went.toFixed(2)} h, ${JSON.stringify(r)}`);
  assert(!L.farm.problems.some((p) => p.id === 'gen-dry' && p.phase !== 'pending'), 'no alarm problem in the hot season');
  const t1 = L.env.day, again = L.level.nextJob();
  assert(again.refused === 'dark' && L.env.day === t1 && /power is off/.test(L.level.nextLabel()), `no skip while dark: ${JSON.stringify(again)} "${L.level.nextLabel()}"`);
  L.level.update(0.6);
  assert(L.env.timeScale === LEVEL1.clock.carry && !L.env.paused, `the dark-house clock: ${L.env.timeScale}`);
  L.farm.act('gen.fuel', {}); L.farm.act('gen.start', {});
  L.level.update(0.6);
  assert(L.farm.power.on && L.env.timeScale === LEVEL1.clock.work, `power back, the work clock again (${L.env.timeScale})`);
  // the normal season with the generator off: a skip is one jump (nothing can cut it)
  const N = makeLevelJs(null), n0 = N.env.day;
  N.level.debug.goto(-1, 8); N.level.nextJob(); N.level.nextJob();
  assert(N.env.day > n0 + 3 * H, 'a normal skip');
});


// ---------------- Phase 4: the strips of §6 and of the condition jobs ----------------
const stripCtx = (L) => ({ env: L.env, farm: L.farm, records: { notebook: [] }, props: L.props, engine: L.jobs, minmax: () => ({ min: 20, max: 30 }),
  weighings: () => ({ n: 0, sectors: 0, mean: null }), from: { x: -14, z: 0, inside: true }, paused: false });
const rowText = (rows) => rows.map((r) => [r.text, r.what, r.sign, r.yours].filter(Boolean).join(' | ')).join('\n');

test('Phase 4 strips: the vent bar objects at 70 / 110 / 170 %; the prep vent row reads "about 900" and "835–1,210"', () => {
  const L = makeLevel({ startDay: -1, startHour: 8 });
  const inst = L.jobs.byKey('prep-vent@-1'), c = stripCtx(L);
  const need = ventNeed(L.env, L.farm).need;
  for (const [share, words] of [[0.7, 'under the sign’s 90–130 %'], [1.1, null], [1.7, 'over the sign’s 90–130 %']]) {
    L.env.setVentTimer({ fans: 1, onSec: Math.round((share * need * 300) / 36000), cycleSec: 300 });
    const rows = stripRows(STRIPS['prep-vent'], c, inst, 'controller'), v = rows.find((r) => r.k === 'cmp' && /Air your flock needs/.test(r.what));
    const real = ventNeed(L.env, L.farm).share;
    assert(v && v.bar && typeof v.bar === 'object' && Math.abs(v.bar.v - real) < 1e-9 && v.bar.max === 1.6 && v.bar.band[0] === VENT_BAND[0] && v.bar.band[1] === VENT_BAND[1],
      `${share}: the bar object ${JSON.stringify(v?.bar)}`);
    assert(words ? v.yours.includes(words) : !/sign’s 90–130/.test(v.yours), `${share}: "${v.yours}"`);
    if (share === 1.7) assert(v.bar.v > v.bar.max, 'over the scale: the bar draws its arrow');
  }
  const t = rowText(stripRows(STRIPS['prep-vent'], c, inst, 'controller'));
  assert(/about 900 m³\/h \(the sign’s example: 6,000 chicks of 42 g\)/.test(t), `the sign column: ${t}`);
  assert(/928 m³\/h worked out: 155 per 1,000 at 42 g/.test(t) && /90–130 % is 835–1,210 m³\/h/.test(t), `the worked figure and the band: ${t}`);
  // a later vent job keeps the table row, with the same bar object
  const M = makeCycle(WEEK2, { day: 9, hour: 6.2 });
  M.farm.flock.placed = 6000; M.farm.flock.alive = 5960; M.farm.flock.meanWeightG = 260;
  const mr = stripRows(STRIPS['r-minvent'], stripCtx(M), M.jobs.byKey('r-minvent@9'), 'controller').find((r) => r.k === 'cmp');
  assert(mr && typeof mr.bar === 'object' && /vent sign table/.test(mr.what), `r-minvent row ${JSON.stringify(mr)}`);
});

test('Phase 4 strips: the feeder rows say when each line is finished; the done r-fans-pm strip has no unticked step', () => {
  const L = makeLevel({ startDay: -1, startHour: 8 });
  const t = rowText(stripRows(STRIPS['prep-feeders'], stripCtx(L), L.jobs.byKey('prep-feeders@-1'), 'feeder-box'));
  assert(/finished when: rim about 5 cm \(7 at most\), flood windows open, pans 95 % full/i.test(t), `prep-feeders: ${t}`);
  const D = makeLevel({ startDay: 5, startHour: 7 });
  const r5 = rowText(stripRows(STRIPS['r-feeders'], stripCtx(D), D.jobs.byKey('r-feeders@5'), 'feeder-box'));
  assert(/finished when: rim at the plate’s figure ± 3 cm \(about \d+ cm today\), auger on, feed in the pans/i.test(r5), `r-feeders day 5: ${r5}`);
  const F = makeCycle(WEEK3, { day: 16, hour: 13.5 });
  const inst = F.jobs.byKey('r-fans-pm@16');
  F.env.setFans(0); F.act('fans.read', { fans: 0 }); F.jobs.tick();
  assert(inst.status === 'done', `fans.read does r-fans-pm: ${inst.status}`);
  const rows = stripRows(STRIPS_CYCLE['r-fans-pm'], stripCtx(F), inst, 'fan-panel');
  const steps = rows.filter((r) => r.k === 'step');
  assert(steps.length >= 1 && steps.every((r) => r.done), `the done strip shows only ticked steps: ${JSON.stringify(steps)}`);
  assert(/No tunnel fans switched on/.test(rowText(rows)), 'no fans on: a plain line');
});

test('Phase 4 strips: the half-and-half, the medicine day, f-withdraw; every condition job of every condition builds its rows, neutral words', () => {
  const C = makeCycle(WEEK3, { day: 15, hour: 9 });
  C.farm.stats.blendH = 7; C.jobs.tick();
  const ch = rowText(stripRows(STRIPS_CYCLE['w3-change'], stripCtx(C), C.jobs.byKey('w3-change@15'), 'silo'));
  assert(/Half from each silo: 7\.0 of 20 farm hours/.test(ch), `w3-change: ${ch}`);
  const B = makeCycle(WEEK3, { day: 17, hour: 9 });
  B.events.emit(EV.FARM_PROBLEM, { id: 'coccidiosis', phase: 'symptom' });
  B.act('phone.vet', { reason: 'blood in the droppings' }); B.farm.act('water.medicate', { on: true }); B.farm.health.medication.daysOn = 2; B.jobs.tick();
  const bl = B.jobs.list().find((i) => i.id === 'p-blood');
  assert(/medicine day 2 of 3/.test(rowText(stripRows(STRIPS_CYCLE['p-blood'], stripCtx(B), bl, 'water-supply'))), 'the strip reads "medicine day 2 of 3"');
  const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;
  const days = [['hot', null, 1, 14.5], ['hot', WEEK2, 9, 14], ['hot', WEEKS45, 22, 13.5], ['rainy', WEEKS45, 29, 7], ['rainy', WEEKS45, 33, 15.3], ['rainy', WEEK3, 19, 14], ['badChicks', null, -1, 8], ['badChicks', null, 0, 10.5],
    ['badChicks', null, 2, 9], ['water', null, 1, 9], ['water', WEEKS45, 27, 7], ['water', WEEK3, 18, 7]];
  const problems = { rainy: ['power-cut', 'mains-back', 'gen-dry', 'rain-in', 'damp-spell'], badChicks: ['weak-batch'], water: ['iron-filter', 'iron-nipples', 'pump-wear'] };
  const seen = new Set();
  for (const [cond, def, day, hour] of days) {
    const L = def ? makeCycle(def, { day, hour, condition: cond }) : makeLevel({ startDay: day, startHour: hour, condition: cond });
    for (const p of problems[cond] || []) L.events.emit(EV.FARM_PROBLEM, { id: p, phase: 'symptom' });
    L.farm.water.lineTempC = [31, 32.5, 30, 29]; L.farm.stats.chickWeightMeasuredG = 36.2;
    for (const inst of L.jobs.open().filter((i) => i.def.condition)) {
      for (const panel of ['generator', 'water-tank', 'water-supply', 'controller', 'drinker-3', 'chick-table']) {
        const rows = stripRows(STRIPS_COND[inst.id], { ...stripCtx(L), paused: true }, inst, panel);
        assert(rows.length, `${inst.key}: rows`);
        for (const r of rows) for (const t of [r.text, r.what, r.sign, r.yours]) if (t != null) { assert(typeof t === 'string' && !/undefined|NaN|\[object/.test(t), `${inst.key}: "${t}"`); assert(!VERDICT.test(t), `${inst.key}: verdict word in "${t}"`); }
      }
      seen.add(inst.id);
    }
  }
  const missing = JOBS_COND.map((j) => j.id).filter((id) => !seen.has(id) && id !== 'p-rain-patch');
  assert(!missing.length && Object.keys(STRIPS_COND).length === JOBS_COND.length, `every condition job has its strip and was built: missing ${missing.join(' ')}`);
  // a weak batch's brooder row + 1 °C on days 0-3 (the strips' house row and b-warm)
  const W = makeLevel({ startDay: 0, startHour: 9, condition: 'badChicks' });
  const bw = rowText(stripRows(STRIPS_COND['b-warm'], stripCtx(W), W.jobs.byKey('b-warm@0'), 'controller'));
  assert(/\+ 1\.0 °C = .*the sign’s row \+ 1 °C \(weak batch\)/.test(bw), `b-warm: ${bw}`);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
