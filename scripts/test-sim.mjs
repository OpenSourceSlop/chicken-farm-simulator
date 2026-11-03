// Node tests for the pure Phase 2 logic (sim.js, farm.js, records.js, skills.js, save.js).
// Owner: package "sim" (phase2/sim). Run: node scripts/test-sim.mjs [--only name]
// No browser, no three.js. Each test drives a whole Level 1 week through env.skipHours with a
// scripted management profile and checks the results against PHASE2.md "Acceptance (sim)".
// The contract tests below pass on the stubs; the acceptance tests are added by phase2/sim.
import { createSim } from '../src/sim.js';
import { createFarm } from '../src/farm.js';
import { createRecords } from '../src/records.js';
import { createSkills, MILESTONES } from '../src/skills.js';
import { createSaveStore } from '../src/save.js';
import { createEvents, EV } from '../src/events.js';
import { LEVEL1, SKILL_BRANCHES } from '../src/config.js';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
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

test('contract: save store survives missing localStorage', () => {
  const s = createSaveStore();
  assert(s.available === false && s.save({ a: 1 }) === false && s.load() === null, 'no storage in node');
});

let failed = 0;
for (const t of tests) {
  if (only && !t.name.includes(only)) continue;
  try { t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
