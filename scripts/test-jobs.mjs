// Node tests for the Level 1 job engine (src/job-engine.js) with a fake clock: the real createSim,
// the event bus, the farm (stub or model) and the JOBS table. Owner: package "level".
// Run: node scripts/test-jobs.mjs   PHASE2.md §14.2 "Acceptance".
import { createSim } from '../src/sim.js';
import { createFarm } from '../src/farm.js';
import { createEvents, EV } from '../src/events.js';
import { createJobEngine, BROOD_CELLS, LEVEL_END_DAY } from '../src/job-engine.js';
import { JOBS } from '../src/content-jobs.js';
import { BROOD_BOUNDS, HEATERS, LEVEL1 } from '../src/config.js';

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
  L.act('litter.patch', { x: -9, z: 2, result: true });
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
  L2.at(6, 13 + 31 / 60); assert(w.status === 'done', `30 min near target: ${w.status}`);
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

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
