// Node tests for the pure Phase 2 logic (sim.js, farm.js, records.js, skills.js, save.js).
// Owner: package "sim" (phase2/sim). Run: node scripts/test-sim.mjs [--only name]
// No browser, no three.js. Each test drives a whole Level 1 week through env.skipHours with a
// scripted management profile and checks the results against PHASE2.md "Acceptance (sim)".
// The contract tests below pass on the stubs. The acceptance tests (PROFILE_TARGETS, PHASE2.md
// §6.10) are written now and SKIPPED while farm.stub is true; phase2/sim removes the stub flag,
// adds src/farm-profiles.js (applyRound) and tunes the model constants until they pass. The
// targets were checked by hand against the §6 formulas; change a band only together with
// PHASE2.md and say why in the package report.
import { createSim } from '../src/sim.js';
import { createFarm } from '../src/farm.js';
import { createRecords } from '../src/records.js';
import { createSkills, MILESTONES } from '../src/skills.js';
import { createSaveStore } from '../src/save.js';
import { createEvents, EV } from '../src/events.js';
import { LEVEL1, SKILL_BRANCHES } from '../src/config.js';

// Expected results per management profile (PHASE2.md §6.10). [min, max] bands; ratio = weighed
// mean / measured chick weight at the weigh-in (day 7 09:00 = flock age 7.04).
export const PROFILE_TARGETS = {
  ideal: { ratio: [4.6, 4.95], uniformityPct: [70, 80], deathsPct: [0.4, 0.9], fcr: [0.83, 0.92],
    litterMeanPct: [0, 28], nh3Day7: [3, 9], cropFill: [0.95, 1], floorShare28AtTip: [0.9, 1],
    meterChangePct: { 1: [5, 60], 2: [5, 40], 3: [5, 40], 4: [-20, -4], 5: [5, 60], 6: [5, 40], 7: [5, 40] },
    skillLevels: { brooding: 2, water: 2 }, passes: true },
  smallMistakes: { ratio: [4.2, 4.5], passes: true },
  latePreheat: { floorShare28AtTip: [0, 0.5], cropFill: [0.85, 0.93], ratio: [4.45, 4.75],
    uniformityBelowIdeal: 5, deathsPct: [1.0, 1.7], passes: true },
  noFlush: { waterQuality: 0.85, deathsOverIdeal: [0.05, 0.3] },
  neglect: { passes: false },                      // ratio < 4.0 and/or deaths + culls > 2 %
  coldNightWideTimer: { houseAt04Day3: [20, 28], coldDeaths: [3, 30], uniformityBelowIdeal: 2 },
  noMinVent: { rhMinFromDay4: 85, litterMeanDay6: [30, 60], nh3Day6: [20, 60] },
  leakUnfixed24h: { leakCellPct: [45, 70], caked: true },
  filterNeverFound: { ratio: [3.95, 4.35], meterChangePctDay4: [-20, -4], dehydrationDeaths: 0 },
  noFeedOrder: { ratio: [4.2, 4.6], pansEmptyBetween: [{ day: 6, hour: 16 }, { day: 7, hour: 4 }] },
  brooderNeverRelit: { comfortShareBelowIdeal: 0.02 },
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
// Acceptance: skipped (reported as todo) while src/farm.js is the stub.
const accept = (name, fn) => tests.push({ name: `accept: ${name}`, fn, accept: true });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// A farm with its bus, records and skills, as main.js wires them.
export function makeFarm() {
  const env = createSim();
  const events = createEvents();
  const farm = createFarm(env, { events });
  env.addStepper(farm.step);
  const records = createRecords({ farm, env, events });
  const skills = createSkills({ events, records, farm });
  return { env, events, farm, records, skills };
}

test('contract: farm shape', () => {
  const { farm } = makeFarm();
  for (const k of ['flock', 'water', 'feed', 'litter', 'light', 'vent', 'problems', 'act', 'step', 'start', 'stop', 'serialize', 'restore', 'debug']) assert(k in farm, `farm.${k} missing`);
  assert(farm.water.lines.length === 4 && farm.feed.lines.length === 3, 'line counts');
});

test('contract: act emits EV.ACTION with the result', () => {
  const { farm, events } = makeFarm();
  let got = null;
  events.on(EV.ACTION, (p) => { got = p; });
  const r = farm.act('water.flowtest', { line: 2 });
  assert(got && got.id === 'water.flowtest' && got.line === 2 && got.result === r, 'action event');
});

test('contract: steppers run during skipHours, prep day reachable', () => {
  const { env } = makeFarm();
  let secs = 0;
  env.addStepper((e, s) => { secs += s; });
  env.setDay(LEVEL1.startDay); env.setHour(LEVEL1.startHour);
  assert(env.dayNumber === -1, `prep day is ${env.dayNumber}`);
  env.skipHours(25);
  assert(env.dayNumber === 0 && Math.abs(secs - 25 * 3600) < 1, `skip integrated ${secs} s, day ${env.dayNumber}`);
});

test('contract: skills table covers both earnable branches', () => {
  const { skills } = makeFarm();
  for (const b of SKILL_BRANCHES.filter((x) => x.earnable)) assert(MILESTONES.some((m) => m.branch === b.id), `no milestones for ${b.id}`);
  assert(skills.branches().length === 11, '11 branches');
  skills.award('day7-weight', 1);
  assert(skills.points('brooding') === 3 && skills.level('brooding') === 0, 'points and level');
});

test('contract: award emits the points delta', () => {
  const { skills, events } = makeFarm();
  const got = [];
  events.on(EV.SKILL_POINTS, (p) => got.push(p.points));
  skills.award('day7-weight', 0); skills.award('day7-weight', 1); skills.award('day7-weight', 0);
  assert(got.join(',') === '1,2', `deltas ${got.join(',')}`);
});

test('contract: farm owns dead birds on the floor', () => {
  const { farm, events } = makeFarm();
  farm.flock.deadOnFloor = 5;
  events.emit(EV.DEAD_PICK, { n: 3, causes: { weak: 3 } });
  assert(farm.flock.deadOnFloor === 2, `deadOnFloor ${farm.flock.deadOnFloor}`);
});

test('contract: flock age and the weigh-in clock', async () => {
  const { flockAgeAt, PLACEMENT_DAY } = await import('../src/config.js');
  assert(Math.abs(flockAgeAt(7 + 8 / 24) - 7) < 1e-9 && PLACEMENT_DAY === LEVEL1.arrivalDay + LEVEL1.arrivalHour / 24, 'age 7.0 at 08:00 day 7');
});

test('contract: save info reads the calendar day from env.day', () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  try {
    const s = createSaveStore();
    s.save({ env: { day: 3 + 10.5 / 24, hour: 10.5 } });
    const i = s.info();
    assert(i && i.day === 3 && i.hour === 10.5, `info ${JSON.stringify(i)}`);
    s.save({ env: { day: -1 + 20 / 24, hour: 20 } });
    assert(s.info().day === -1, 'prep day');
  } finally { delete globalThis.localStorage; }
});

// ---- acceptance (PHASE2.md §6.10); phase2/sim implements runProfile in src/farm-profiles.js ----
// runProfile(name, { seed }) -> { farm, env, records, skills, at(day, hour) snapshots, result }
// (the exact return shape is the sim package's choice; keep these tests reading PROFILE_TARGETS)
const inBand = (v, [a, b], what) => assert(v >= a && v <= b, `${what} ${v} not in ${a}..${b}`);
for (const name of Object.keys(PROFILE_TARGETS)) {
  accept(`profile ${name}`, async () => {
    const { runProfile, checkProfile } = await import('../src/farm-profiles.js');
    const run = runProfile(name, { seed: 1 });
    checkProfile(name, run, PROFILE_TARGETS, { assert, inBand });
  });
}
accept('determinism: same seed and inputs give identical records', async () => {
  const { runProfile } = await import('../src/farm-profiles.js');
  const a = JSON.stringify(runProfile('ideal', { seed: 7 }).records.serialize());
  const b = JSON.stringify(runProfile('ideal', { seed: 7 }).records.serialize());
  assert(a === b, 'records differ between two identical runs');
});

test('contract: save store survives missing localStorage', () => {
  const s = createSaveStore();
  assert(s.available === false && s.save({ a: 1 }) === false && s.load() === null, 'no storage in node');
});

let failed = 0, todo = 0;
const stub = makeFarm().farm.stub === true;
for (const t of tests) {
  if (only && !t.name.includes(only)) continue;
  if (t.accept && stub) { todo++; console.log(`todo ${t.name} (farm.js is the stub)`); continue; }
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : `all passed${todo ? ` (${todo} acceptance tests todo)` : ''}`);
process.exit(failed ? 1 : 0);
