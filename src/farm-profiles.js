// Management profiles: the ideal farmer (and the deliberate mistakes of PHASE2.md §6.10) as code.
// One place for "what good management does each round", used by scripts/test-sim.mjs and by
// level.debug.goto(day, hour, { auto: true }) so the end-to-end harness run plays the same farm the
// node tests check. Owner: package "sim" (phase2/sim). Pure logic (no three.js, no DOM).
//
//   applyRound(farm, env, day, round, profile = 'ideal')
//     Performs that round's management for the profile through farm.act(...) and the env setters
//     (env.setHeaterSetpoint, env.setFans; the timer goes through farm.act('vent.timer')). round:
//     'prep' | 'am' | 'pm' | 'eve' (the level's rounds) and the finer ones runProfile uses:
//     'truck' (box weighed, six stacks tipped 7 min apart, grading), 'vent', 'crop', 'noon',
//     'late', 'leak24', 'weigh'. 'am' on day 0 after the truck also does 'truck'; 'am' on day 1
//     inside the crop window also does 'crop'; 'am' on day 7 from 08:00 also does 'weigh'.
//     A few rounds advance the clock by minutes (env.skipHours) for timed work: the flush (10 min a
//     line), the tips (7 min a stack). It never emits events itself: farm.act emits the actions.
//     Returns the actions performed [{ id, args, result }].
//   runProfile(name, { seed }) -> { farm, env, events, records, skills, snaps, result }
//     A whole level for a profile: start, prep day, skips, rounds, problems found when the profile
//     says, weigh-in at 09:00 day 7, the end. Plays the level's part too (records signed at 20:00,
//     dead birds picked up and counted, EV.LEVEL checkpoints for skills).
//   checkProfile(name, run, targets, { assert, inBand })
//     Asserts targets[name] (scripts/test-sim.mjs PROFILE_TARGETS) against the run.
import { LEVEL1, EQUIP, targetTempAt, nippleHeightCmAt, feederRimCmAt, minVentM3hPer1000, flowTargetAt } from './config.js';
export { runProfile, checkProfile } from './farm-profiles-run.js';

/** Profile names (keys of PROFILE_TARGETS in scripts/test-sim.mjs). */
export const PROFILES = ['ideal', 'smallMistakes', 'latePreheat', 'noFlush', 'neglect', 'coldNightWideTimer',
  'noMinVent', 'leakUnfixed24h', 'filterNeverFound', 'noFeedOrder', 'brooderNeverRelit'];

// What each profile does differently from the ideal (PHASE2.md §6.10).
const IDEAL = {
  preheat: { day: -1, hour: 7 }, setpointOffset: 0, litterCm: 8, flush: true,
  pressure: 'sign', heights: 'sign', flood: true, timer: 'sign', wideTimerFrom: null,
  light: { darkStart: 2, darkHours: 1, dimmer: 0.6 }, relight: true,
  filter: 'am4', leak: 'pm4', feedOrder: true, warmFan: true,
};
const MODS = {
  ideal: {},
  smallMistakes: { pressure: 6, heights: 'day3', setpointOffset: -1, filter: 'pm4' },
  latePreheat: { preheat: { day: 0, hour: 2 } },
  noFlush: { flush: false },
  neglect: { preheat: { day: 0, hour: 4 }, flood: false, pressure: 4, heights: 'never', timer: 'none', filter: 'never', feedOrder: false },
  coldNightWideTimer: { wideTimerFrom: 2 },
  noMinVent: { timer: 'none' },
  leakUnfixed24h: { leak: '24h' },
  filterNeverFound: { filter: 'never' },
  noFeedOrder: { feedOrder: false },
  brooderNeverRelit: { relight: false },
};
export const profileOf = (name) => ({ ...IDEAL, ...(MODS[name] || {}) });

// Places on the brooding floor (one per sector) for tips, probes and samples.
const SECTOR_SPOTS = [[-19, -2.6], [-19, 2.6], [-11, -2.6], [-11, 2.6], [-3, -2.6], [-3, 2.6]];
// tips: where the farmer stands in each sector, between the brooders (x midway, z between the lines)
const TIP_SPOTS = [[-16, -1], [-16, 1], [-10, -1], [-10, 1], [-4, -1], [-4, 1]];
const near = (i, dx = 0.8, dz = 0.6) => { const [x, z] = SECTOR_SPOTS[i % 6]; return { x: x + dx * ((i * 7) % 3 - 1), z: z + dz * ((i * 5) % 3 - 1) }; };

/** The sign's minimum ventilation timer for the birds now (1 fan, 300 s cycle). */
export function signTimer(farm) {
  const fl = farm.flock;
  const w = fl.placed > 0 ? fl.meanWeightG : LEVEL1.chickWeightG, birds = fl.placed > 0 ? fl.alive : LEVEL1.chicksPlaced;
  const need = (minVentM3hPer1000(w) * birds) / 1000;
  return { fans: 1, onSec: Math.max(1, Math.round((need / EQUIP.fanM3h) * 300)), cycleSec: 300 };
}

export function applyRound(farm, env, day, round, profile = 'ideal') {
  const P = typeof profile === 'string' ? profileOf(profile) : profile;
  const done = [];
  const act = (id, args = {}) => { const result = farm.act(id, args); done.push({ id, args, result }); return result; };
  const t = (d, h) => d + h / 24;
  const preheatOn = env.day >= t(P.preheat.day, P.preheat.hour) - 1e-9;
  // the brooder sign table: target by HUD day, to 0.5 °C (BROODER_ROWS_L1)
  const setpoint = () => { if (preheatOn) env.setHeaterSetpoint(Math.round(targetTempAt(day) * 2) / 2 + P.setpointOffset); };
  const lines = [0, 1, 2, 3];

  if (round === 'prep') {
    setpoint();
    act('litter.depth', { cm: P.litterCm });
    for (let z = -4.8; z <= 4.81; z += 2.4) for (let x = -23.5; x <= 23.5; x += 0.5) act('litter.spread', { x, z, r: 1.2, quiet: true });
    for (const line of lines) { act('water.height', { line, cm: 11 }); act('water.pressure', { line, cm: pressureFor(P, 0) }); }
    for (const line of lines) act('water.flowtest', { line });
    for (const line of [0, 1, 2]) act('feed.line', { line, running: true, flood: P.flood, heightCm: Math.round(feederRimCmAt(0)) });
    act('feed.silo');
    act('light.program', P.light);
    if (P.timer === 'sign') act('vent.timer', signTimer(farm));
    return done;
  }
  if (round === 'eve') {
    if (day === -1 && P.flush) {
      for (const line of lines) act('water.flush', { line, on: true });
      env.skipHours(11 / 60);
      for (const line of lines) act('water.flush', { line, on: false });
    }
    // the late pre-heat profiles turn the brooders up in the night
    return done;
  }
  if (round === 'preheat') { setpoint(); return done; }

  if (round === 'am') {
    act('water.meter');
    setpoint();
    if (day === 0) for (let i = 0; i < 3; i++) act('floor.probe', near(i * 2));
    if (day === 1 && P.relight && env.brooderOut.length) act('heat.relight', { index: env.brooderOut[0] });
    for (const line of lines) {
      act('water.pressure', { line, cm: pressureFor(P, day) });
      const h = heightFor(P, day, farm.water.lines[line].heightCm);
      if (h != null) act('water.height', { line, cm: h });
    }
    for (const line of lines) act('water.flowtest', { line });
    if (day === 4 && P.filter === 'am4') { act('water.filter'); act('water.clearFilter'); for (const line of lines) act('water.flowtest', { line }); }
    act('feed.meter');
    act('feed.silo');
    if (P.feedOrder && farm.problems.find((p) => p.id === 'low-silo' && p.phase === 'found')) act('feed.order', { kg: 2000 });
    feeders(act, P, day, farm.age);
    timer(act, P, day, farm);
    if (day === 0 && farm.flock.inBoxes > 0 && env.day >= t(0, LEVEL1.arrivalHour)) done.push(...applyRound(farm, env, day, 'truck', P));
    if (day === 1 && farm.stats.firstTipAt != null && env.day >= farm.stats.firstTipAt + 22 / 24 && env.day <= farm.stats.firstTipAt + 28 / 24) done.push(...applyRound(farm, env, day, 'crop', P));
    if (day === 7 && env.hour >= 8 && farm.stats.weighed.length < 50) done.push(...applyRound(farm, env, day, 'weigh', P));
    return done;
  }
  if (round === 'truck') {
    act('sample.box');
    for (let i = 0; i < 10; i++) {
      const c = act('sample.grade', { i });
      if (c && (c.navel === 'open' || c.navel === 'black button' || c.reflexSec > 3)) act('chicks.cull', { n: 1, reason: 'grading', index: i });
    }
    for (let s = 0; s < LEVEL1.stacks; s++) {
      if (s > 0) env.skipHours(7 / 60);
      const [x, z] = TIP_SPOTS[s];
      act('chicks.tip', { stack: s, chicks: LEVEL1.chicksPlaced / LEVEL1.stacks, x, z });
    }
    return done;
  }
  if (round === 'vent') { for (let i = 0; i < 5; i++) act('sample.vent', { ...near(i, 1.2, 0.8), index: i }); return done; }
  if (round === 'crop') { for (let i = 0; i < 10; i++) act('sample.crop', { ...near(i, 1.2, 0.8), index: i }); return done; }
  if (round === 'weigh') { for (let i = 0; i < 50; i++) act('sample.weigh', { ...near(Math.floor(i / 10), 0.5, 0.5), index: i }); return done; }
  if (round === 'noon') { if (day === 6 && P.warmFan) env.setFans(1); return done; }
  if (round === 'late') { if (day === 6 && P.warmFan) env.setFans(0); return done; }
  if (round === 'leak24') { if (P.leak === '24h') fixLeak(act, farm); return done; }
  if (round === 'pm') {
    act('litter.squeeze', { x: -16, z: 0.6 }); act('litter.squeeze', { x: -8, z: -1.95 }); act('litter.squeeze', { x: -4, z: 3.2 });
    if (day === 4 && P.leak === 'pm4' && farm.water.leak) { act('litter.squeeze', { x: farm.water.leak.x, z: farm.water.leak.z }); fixLeak(act, farm); }
    if (day === 4 && P.filter === 'pm4' && farm.water.filterFactor < 1) { for (const line of lines) act('water.flowtest', { line }); act('water.clearFilter'); }
    if (day === 6 && P.warmFan && env.hour < 17) env.setFans(1);
    return done;
  }
  return done;
}

function fixLeak(act, farm) {
  const leak = farm.water.leak;
  if (!leak) return;
  act('water.fixLeak', { line: leak.line, x: leak.x });
  act('litter.patch', { x: leak.x, z: leak.z });
}
function pressureFor(P, day) {
  if (typeof P.pressure === 'number') return P.pressure;
  return Math.round(((flowTargetAt(Math.max(0, day)) - 4) / 2) * 2) / 2; // f = 2 x cm + 4 = day + 20
}
function heightFor(P, day, current) {
  if (P.heights === 'sign') return Math.round(nippleHeightCmAt(Math.max(0, day)));
  if (P.heights === 'day3') return day === 3 ? Math.round(nippleHeightCmAt(3)) : day <= 0 ? 11 : null;
  if (P.heights === 'never') return day <= 0 ? 11 : null;
  return current;
}
function feeders(act, P, day, age) {
  for (const line of [0, 1, 2]) {
    if (day <= 3) act('feed.line', { line, running: true, flood: P.flood, heightCm: Math.round(feederRimCmAt(0)) });
    else act('feed.line', { line, running: true, flood: false, heightCm: Math.floor(feederRimCmAt(Math.max(0, age))) });
  }
}
function timer(act, P, day, farm) {
  if (P.wideTimerFrom != null && day >= P.wideTimerFrom) { act('vent.timer', { fans: 2, onSec: 60, cycleSec: 300 }); return; }
  if (P.timer === 'sign') act('vent.timer', signTimer(farm));
}

