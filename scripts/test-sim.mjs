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
  latePreheat: { floorShare28AtTip: [0, 0.5], cropFill: [0.85, 0.93], ratio: [4.45, 4.8], // 4.75 -> 4.8: the ideal day 6 no longer chills (final check)
    uniformityBelowIdeal: 5, deathsPct: [1.0, 1.7], passes: true },
  noFlush: { waterQuality: 0.85, deathsOverIdeal: [0.05, 0.3] },
  neglect: { passes: false },                      // ratio < 4.0 and/or deaths + culls > 2 %
  coldNightWideTimer: { houseAt04Day3: [20, 28], coldDeaths: [3, 30], uniformityBelowIdeal: 2 },
  noMinVent: { rhMinFromDay4: 85, litterMeanDay6: [30, 60], nh3Day6: [20, 60], ratioBelowIdeal: 0.15, uniformityBelowIdeal: 3 },
  leakUnfixed24h: { leakCellPct: [45, 70], caked: true },
  filterNeverFound: { ratio: [3.95, 4.35], meterChangePctDay4: [-20, -4], dehydrationDeaths: 0 },
  noFeedOrder: { ratio: [4.2, 4.6], pansEmptyBetween: [{ day: 6, hour: 16 }, { day: 7, hour: 4 }] },
  brooderNeverRelit: { comfortShareBelowIdeal: 0.04, uniformityBelowIdeal: 3, ratioBelowIdeal: 0.02, notEarned: ['steady-heat'] },
  // review round 2: mistakes that must show in the records (PHASE2.md §6.10)
  pressure20: { ratioBelowIdeal: 0.12, litterUnderLinesDay6: [35, 70], passes: true },
  pansUp: { cropFill: [0, 0.85], deathsPct: [2, 100], passes: false },
  neverPlaced: { deathsPct: [2, 100], passes: false, notEarned: ['low-mortality', 'steady-heat', 'crop-fill', 'day7-weight'] },
  litter2cm: { comfortShareBelowIdeal: 0.05, uniformityBelowIdeal: 5, notEarned: ['steady-heat'] },
  warmNoAction: { houseOverTargetAt15Day6: [2, 6], pantShareAt15Day6: [0.2, 1] },
  warmTunnel: { feltOverTargetAt15Day6: [-6, -1.5], coldShareAt15Day6: [0.2, 1], coldMinutesDay6: [180, 400], comfortShareBelowIdeal: 0.015 },
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
// --seed N runs the profiles with another delivery and noise (the acceptance numbers are for seed 1)
const SEED = process.argv.includes('--seed') ? +process.argv[process.argv.indexOf('--seed') + 1] : 1;
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
    const run = runProfile(name, { seed: SEED });
    checkProfile(name, run, PROFILE_TARGETS, { assert, inBand });
  });
}
// The warm afternoon found on the controller at 14:00 (house >= target + 2), then three answers:
// more timer air (the sign's warm-afternoon timer) brings the chicks back within the hour; two
// tunnel fans chill them (comfort e < -2: they pile under the brooders, the problem stays open
// while the fans run); nothing ends 'weather'.
accept('warm afternoon: the timer cools the house, tunnel fans chill the chicks', async () => {
  const { runProfile, WARM_TIMER } = await import('../src/farm-profiles.js');
  const play = (answer) => {
    const info = { eMin: 9, eMax: -9 };
    const run = runProfile('warmNoAction', { seed: SEED, onStep: ({ farm, events }, env) => {
      if (env.dayNumber !== 6) return;
      const warm = farm.problems.find((p) => p.id === 'warm-afternoon');
      if (!info.read && env.hour >= 14) {
        info.read = true;
        events.emit(EV.ACTION, { id: 'controller.read', houseC: +env.houseTemp.toFixed(1) });
        info.found = warm.phase;
        if (answer === 'timer') farm.act('vent.timer', WARM_TIMER);
        if (answer === 'tunnel') { env.setFans(2); events.emit(EV.ACTION, { id: 'vent.fans', n: 2 }); }
      }
      if (answer === 'tunnel' && env.hour >= 17 && env.fansManual) env.setFans(0);
      if (info.read && env.hour >= 14.75 && env.hour < 17) { info.eMin = Math.min(info.eMin, farm.comfort.e); info.eMax = Math.max(info.eMax, farm.comfort.e); }
      if (warm.phase === 'fixed' && info.fixedH == null) { info.fixedH = env.hour; info.by = warm.fixedBy; }
    } });
    return info;
  };
  const timer = play('timer'), tunnel = play('tunnel'), none = play('none');
  assert(timer.found === 'found' && tunnel.found === 'found', `found on the controller at 14:00: ${timer.found}`);
  assert(timer.fixedH != null && timer.fixedH <= 15.25, `more timer air: near target by 15:15 (fixed ${timer.fixedH?.toFixed(2)})`);
  assert(timer.eMax <= 1.5 && timer.eMin >= -1.5, `more timer air: e ${timer.eMin.toFixed(2)}..${timer.eMax.toFixed(2)} from 14:45`);
  assert(tunnel.eMax < -1.5, `tunnel fans: e up to ${tunnel.eMax.toFixed(2)} from 14:45 (chicks chilled)`);
  assert(tunnel.fixedH == null || tunnel.fixedH >= 17, `tunnel fans: not near target while they run (fixed ${tunnel.fixedH?.toFixed(2)})`);
  assert(none.fixedH != null && none.fixedH >= 16.5, `no answer: the weather ends it late (${none.fixedH?.toFixed(2)})`);
});

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

// ---- package checks (PHASE2.md §6.10 / §14.1) ----
// Phase 1 sandbox climate, recorded from the Phase 1 sim.js before the level climate was added:
// [day, hour, outsideTemp, outsideRH, houseTemp, houseRH, heaterLevel, heaterDemand, fansOn,
//  airSpeed, targetTemp, windChill, feelsLike, bodyWeight, lightsOn, broodCurtain] after each step.
const SANDBOX_BASELINE = [[1.541667, 13, 28.330127, 60, 34.017558, 60, 0.188729, 0.188729, 0, 0, 34, 0, 34.017558, 74.595238, true, true], [1.833333, 20, 34.294095, 55, 34.769458, 55, 0, 0, 3, 1.25, 34, 3.75, 31.019458, 80.761905, true, true], [3.083333, 2, 28.170371, 55, 21.777999, 93.25, 1, 1, 6, 2.5, 33.176471, 7.5, 14.277999, 107.190476, false, true], [20.166667, 4, 28.170371, 55, 28.157176, 55, 0, 0, 1, 0.416667, 26.176471, 0.936508, 27.220668, 894.047619, true, false], [20.720833, 17.3, 29.472379, 85, 30.257334, 85, 0, 0, 1, 0.416667, 26.176471, 0.923313, 29.33402, 931.255952, true, false], [29.263977, 28.427626, 3.055179]];
test('package: sandbox climate unchanged (farm.mode off, Phase 1 digest)', () => {
  const { env, farm } = makeFarm();
  assert(farm.mode === 'off', 'farm starts in the sandbox');
  const F = ['day', 'hour', 'outsideTemp', 'outsideRH', 'houseTemp', 'houseRH', 'heaterLevel', 'heaterDemand', 'fansOn', 'airSpeed', 'targetTemp', 'windChill', 'feelsLike', 'bodyWeight', 'lightsOn', 'broodCurtain'];
  const snap = () => F.map((k) => (typeof env[k] === 'number' ? +env[k].toFixed(6) : env[k]));
  const out = [];
  env.setHeaterSetpoint(34); env.skipHours(5); out.push(snap());
  env.setWeather('hot'); env.setFans(3); env.skipHours(7); out.push(snap());
  env.setPad(true); env.setFans(6); env.skipHours(30); out.push(snap());
  env.setPad(false); env.setFans(1); env.setDay(20); env.setHeaterSetpoint(25); for (let i = 0; i < 600; i++) env.update(1 / 30); out.push(snap());
  env.setWeather('rainy'); env.skipHours(13.3); out.push(snap());
  out.push([+env.localTemp(-13, 2).toFixed(6), +env.localTemp(5, -5.5).toFixed(6), +env.comfort(-19, -2.6).toFixed(6)]);
  out.forEach((row, i) => row.forEach((v, j) => {
    const b = SANDBOX_BASELINE[i][j];
    assert(typeof v === 'number' ? Math.abs(v - b) <= 1e-6 : v === b, `sandbox step ${i} field ${F[j] || j}: ${v} vs Phase 1 ${b}`);
  }));
  // a level started and stopped leaves the sandbox climate as it was
  farm.start(LEVEL1, { seed: 1 }); farm.stop();
  assert(!env.levelClimate && env.weatherEvents.length === 0 && env.brooderOut.length === 0 && env.ventTimer === null, 'stop() restores the sandbox climate');
});

test('package: farm.step <= 0.3 ms, a 24 h skip <= 150 ms (placed flock)', async () => {
  const { applyRound } = await import('../src/farm-profiles.js');
  const { env, farm } = makeFarm();
  farm.start(LEVEL1, { seed: 1 });
  applyRound(farm, env, -1, 'prep');
  env.skipHours(25); applyRound(farm, env, 0, 'am'); applyRound(farm, env, 0, 'truck');
  env.skipHours(24); // warm up
  const t0 = performance.now(); env.skipHours(24); const ms = performance.now() - t0;
  const t1 = performance.now(); for (let i = 0; i < 200; i++) farm.step(env, 60); const per = (performance.now() - t1) / 200;
  console.log(`     24 h skip ${ms.toFixed(1)} ms, farm.step ${per.toFixed(3)} ms`);
  assert(ms <= 150, `24 h skip took ${ms.toFixed(1)} ms`);
  assert(per <= 0.3, `farm.step took ${per.toFixed(3)} ms`);
});

test('package: save blob < 60 KB, restore -> serialize identical, play continues', async () => {
  const { runProfile } = await import('../src/farm-profiles.js');
  const run = runProfile('ideal', { seed: 1 });
  const e = run.env;
  const blob = { env: { day: e.day, hour: e.hour, weather: e.weather, houseTemp: e.houseTemp, slabTemp: e.slabTemp, heaterSetpoint: e.heaterSetpoint,
    heaterLevel: e.heaterLevel, fansOn: e.fansOn, padOn: e.padOn, ventTimer: e.ventTimer, lightProgram: e.lightProgram },
  farm: run.farm.serialize(), records: run.records.serialize(), skills: run.skills.serialize() };
  const json = JSON.stringify(blob);
  console.log(`     save blob ${(json.length / 1024).toFixed(1)} KB (farm ${(JSON.stringify(blob.farm).length / 1024).toFixed(1)}, records ${(JSON.stringify(blob.records).length / 1024).toFixed(1)})`);
  assert(json.length < 60 * 1024, `save blob ${json.length} bytes`);
  const w = makeFarm(), back = JSON.parse(json);
  Object.assign(w.env, back.env);
  w.farm.restore(back.farm); w.records.restore(back.records); w.skills.restore(back.skills);
  assert(JSON.stringify(w.farm.serialize()) === JSON.stringify(blob.farm), 'farm serialize differs after restore');
  assert(JSON.stringify(w.records.serialize()) === JSON.stringify(blob.records), 'records serialize differs after restore');
  assert(JSON.stringify(w.skills.serialize()) === JSON.stringify(blob.skills), 'skills serialize differs after restore');
  assert(w.env.levelClimate && w.env.weatherEvents.length === 2 && w.env.ventDuty === run.env.ventDuty, 'env rebuilt from the farm (climate, weather events, timer)');
  w.env.skipHours(2);
  assert(w.farm.flock.alive > 0 && Number.isFinite(w.farm.flock.meanWeightG), 'the restored farm runs on');
});

test('package: rows hold null for every reading not taken', async () => {
  const { applyRound } = await import('../src/farm-profiles.js');
  const { env, farm, records } = makeFarm();
  farm.start(LEVEL1, { seed: 1 });
  applyRound(farm, env, -1, 'prep');
  env.skipHours(25); applyRound(farm, env, 0, 'truck'); // chicks placed, nothing read
  env.skipHours(24);
  const row = records.sign(1);
  for (const k of ['feedKg', 'feedPerBirdG', 'waterL', 'waterPerBirdMl', 'waterFeedRatio', 'waterChangePct', 'uniformityPct', 'fcr',
    'litterMoisturePct', 'houseMinC', 'houseMaxC', 'lightHours', 'cropFullPct', 'ventTempMeanC', 'chickWeightG', 'chickQualityNote', 'flowsMlMin', 'floorTempMeanC', 'cropTally']) {
    assert(row[k] === null, `row.${k} = ${JSON.stringify(row[k])} although nothing was read`);
  }
  assert(row.weightSource === 'scale' && row.alive === 5999 - 0 || row.alive > 5900, 'alive from the tips, weight from the bird scale');
  const prep = records.row(-1);
  assert(prep && prep.signed === false, 'the prep day closed by itself at 06:00 (signed false)');
});

test('package: every action id answers with its result shape', () => {
  const { env, farm, events } = makeFarm();
  farm.start(LEVEL1, { seed: 1 });
  const seen = [];
  events.on(EV.ACTION, (p) => seen.push(p.id));
  const shape = {
    'heat.relight': ['fixed'], 'vent.timer': null, 'light.program': null, 'light.lux': ['lux'], 'litter.depth': null, 'litter.spread': ['cover'],
    'litter.patch': ['onLeak'], 'litter.squeeze': ['moisturePct', 'feel'], 'floor.probe': ['tempC'], 'water.flush': ['flushClear'], 'water.pressure': null,
    'water.height': null, 'water.flowtest': ['mlMin'], 'water.meter': ['litres', 'litres24h', 'per1000', 'changePct'], 'water.filter': ['inBar', 'outBar'],
    'water.clearFilter': ['fixed'], 'water.fixLeak': ['fixed'], 'feed.line': null, 'feed.meter': ['kg'], 'feed.silo': ['kg'], 'feed.order': ['arriveDay', 'arriveHour'],
    'sample.box': ['chicks', 'weightKg', 'boxKg'], 'sample.grade': ['reflexSec', 'navel', 'hocks', 'weightG'],
  };
  const args = { 'light.lux': { x: -10, z: 0 }, 'litter.spread': { x: -10, z: 0, r: 1.2 }, 'litter.squeeze': { x: -10, z: 0 }, 'floor.probe': { x: -10, z: 0 },
    'water.flush': { line: 0, on: true }, 'water.flowtest': { line: 1 }, 'feed.order': { kg: 1000 }, 'sample.grade': { i: 0 }, 'heat.relight': { index: 5 } };
  env.skipHours(25.5); // truck arrived (sample.grade needs the delivery)
  for (const [id, keys] of Object.entries(shape)) {
    const r = farm.act(id, args[id] || {});
    if (keys) for (const k of keys) assert(r && k in r, `${id} result has no ${k}: ${JSON.stringify(r)}`);
    else assert(r === true, `${id} result ${JSON.stringify(r)}, want true`);
  }
  const tip = farm.act('chicks.tip', { stack: 0, chicks: 1000, x: -16, z: -1 });
  assert(tip.placed > 990 && 'deadInBoxes' in tip && farm.flock.present, 'chicks.tip');
  for (const id of ['sample.vent', 'sample.crop', 'sample.weigh']) { const r = farm.act(id, { x: -16, z: -1, index: 0 }); assert(r && Object.keys(r).length === 1, `${id} ${JSON.stringify(r)}`); }
  assert(farm.act('chicks.cull', { n: 1, reason: 'sick' }) === true && farm.act('dead.count', { n: 0, causes: {} }) === true, 'cull / count');
  assert(seen.length === Object.keys(shape).length + 6 && !farm.act('water.meter', { quiet: true }) === false && seen.length === Object.keys(shape).length + 6, 'quiet actions are not emitted');
});

test('package: problems start silently, symptoms from actions and EV.NEAR, forecast and zones', () => {
  const { env, farm, events } = makeFarm();
  const got = [];
  events.on(EV.FARM_PROBLEM, (p) => got.push(`${p.id}:${p.phase}`));
  farm.start(LEVEL1, { seed: 1 });
  env.skipHours(22 + 24); // day 1 05:00
  assert(env.brooderOut.includes(5) && farm.problemZones().some((z) => z.problemId === 'brooder-out'), 'brooder 5 out with a zone');
  events.emit(EV.NEAR, { problemId: 'brooder-out', x: -7, z: 2.6 });
  assert(got.includes('brooder-out:symptom') && farm.problemZones().length === 0, 'EV.NEAR finds it, the zone goes');
  assert(farm.act('heat.relight', { index: 5 }).fixed === true && env.brooderOut.length === 0 && got.includes('brooder-out:fixed'), 'relight fixes it');
  assert(/13 °C/.test(farm.forecast(2).text) && /19 °C/.test(farm.forecast(1).text) && /afternoon hot, up to 32 °C/.test(farm.forecast(5).text), `forecasts: ${farm.forecast(2).text} | ${farm.forecast(5).text}`);
  env.skipHours(24 + 24 + 6); // day 3 11:00: filter clogged
  assert(farm.water.filterFactor < 1 && !got.includes('blocked-filter:symptom'), 'the filter clogs silently');
  farm.act('water.meter');
  assert(!got.includes('blocked-filter:symptom'), 'a meter reading alone opens nothing');
  farm.act('water.flowtest', { line: 0 });
  assert(got.includes('blocked-filter:symptom'), 'a low flow test is the symptom');
  const o = farm.observe(-12, 0);
  assert(o.spread && o.droppings && o.sounds, 'observe');
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
