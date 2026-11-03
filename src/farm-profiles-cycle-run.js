// runCycle: a whole cycle (or part of it) for a management profile, in node (PHASE3.md §6.14). Owner: package
// "sim". It plays the farmer (applyRound for the brooding week, applyCycleRound after it) and the level's part
// (records signed at 20:00, dead birds picked up and counted, EV.RUN / EV.LEVEL checkpoints with the level and
// run: true, the level ends of §10), and returns the trace scripts/test-cycle.mjs checkCycle measures:
//   { hourly, levels, levelEnds, points, records, farm, env, skills, events }
// The model never grades itself here: `levels` holds the measured numbers and the pass rule of config LEVELS.
// A profile starts from the ideal's state at its first level (`from`, a standard start: the ideal of the same seed
// up to there, kept in memory exactly as it was, with the ideal's trace before it) and runs to `to`. A failed
// level ends the run (the player would replay it).
import { LEVELS, LEVEL1, PLAN_LEVEL, levelById, weightAt, PLACEMENT_DAY, CYCLE, HARVEST, SKILL_BRANCHES } from './config.js';
import { EV } from './events.js';
import { makeWorld, schedule } from './farm-profiles-run.js';
import { applyRound } from './farm-profiles.js';
import { applyCycleRound, cycleStops, cycleProfileOf } from './farm-profiles-cycle.js';
import { makeQuantile } from './farm-flock.js';
import { BROOD_CELLS, meanMoistureOf } from './farm-litter.js';
import { lastWeighing } from './farm-harvest.js';

const ORDER = LEVELS.map((l) => l.id);
const RANGE = {
  noDark: ['week2', 'weeks45'], lateLift: ['week2', 'week2'], noStep: ['week2', 'week3'], poorVaccine: ['week2', 'week3'],
  poorVaccineCocci: ['week2', 'week3'], cocciUntreated: ['week3', 'week3'], minVentW3: ['week3', 'week3'], crumbleOn: ['week2', 'weeks45'],
  abruptChange: ['week2', 'week3'], overfullSilo: ['week2', 'weeks45'], dustOn: ['weeks45', 'weeks45'], noTunnel: ['weeks45', 'weeks45'],
  fansNoPad: ['weeks45', 'weeks45'], padInHumid: ['weeks45', 'weeks45'], fanUnfixed: ['weeks45', 'weeks45'], noWithdrawal: ['finish', 'finish'],
  longWithdrawal: ['finish', 'finish'], brightCatch: ['finish', 'finish'], wetDisinfect: ['cleanout', 'cleanout'], litterLeft: ['cleanout', 'cleanout'],
  shortRest: ['cleanout', 'cleanout'],
};
const CACHE = new Map();   // `${seed}:${levelId}` -> the ideal's state at that level's start (exact) and its trace so far
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);
const H = 1 / 24;

export const cycleWorld = () => makeWorld();

// ---------------- exact snapshots (in memory: structuredClone of every data field) ----------------
const SKIP_FARM = new Set(['rng', 'debug', 'level', 'cycleLevel', 'emit']);
function farmData(farm) {
  const o = {};
  for (const k of Object.keys(farm)) {
    const d = Object.getOwnPropertyDescriptor(farm, k);
    if (!d || !('value' in d)) continue; // getters (age) are not state
    const v = d.value;
    if (typeof v === 'function' || SKIP_FARM.has(k)) continue;
    if (k === 'flock') { const fl = { ...v }; delete fl.weightQuantile; o.flock = fl; continue; }
    o[k] = v;
  }
  return o;
}
function envData(env) {
  const o = {};
  for (const k of Object.keys(env)) {
    if (k === '_steppers' || k === 'litterDepthAt') continue;
    const d = Object.getOwnPropertyDescriptor(env, k);
    if (!d || !('value' in d) || typeof d.value === 'function') continue;
    o[k] = d.value;
  }
  return o;
}
function snapshot(world, trace) {
  const { env, farm, records, skills } = world;
  return structuredClone({ env: envData(env), farm: farmData(farm), rng: farm.rng.state, level: farm.level ? farm.level.id : null,
    cycleLevel: farm.cycleLevel ? farm.cycleLevel.id : null, records: records.serialize(), skills: skills.serialize(),
    hourly: trace.hourly, levels: trace.levels, levelEnds: trace.levelEnds });
}
function restoreSnap(world, snap, trace) {
  const { env, farm, records, skills } = world;
  const s = structuredClone(snap);
  farm.start(LEVEL1, { seed: farm.seed });
  Object.assign(env, s.env);
  for (const [k, v] of Object.entries(s.farm)) farm[k] = v;
  farm.flock.weightQuantile = makeQuantile(farm.flock);
  farm.rng.state = s.rng;
  farm.level = levelById(s.level) || LEVEL1; farm.cycleLevel = s.cycleLevel ? levelById(s.cycleLevel) : null;
  records.restore(s.records); skills.restore(s.skills);
  trace.hourly.push(...s.hourly); Object.assign(trace.levels, s.levels); Object.assign(trace.levelEnds, s.levelEnds);
}

// ---------------- the trace ----------------
function hourRow(world) {
  const { env, farm } = world, fl = farm.flock, C = farm.comfort, L = farm.litter;
  const cyc = farm.cyc && farm.cyc.on;
  return {
    t: Math.round(env.day * 24) / 24, day: env.dayNumber, hour: Math.round(env.hour) % 24,
    outC: r3(env.outsideTemp), outRH: r3(env.outsideRH), houseC: r3(env.houseTemp), houseRH: r3(env.houseRH),
    feltMean: r3(cyc ? C.feltMean : (C.meanOver ?? 0) + env.targetTemp), pantShare: r3(fl.alive > 0 ? C.pantShare ?? 0 : 0),
    airSpeed: r3(env.airSpeed), fansEffective: env.fansEffective, fansManual: env.fansManual, padOn: !!env.padOn,
    nh3: r3(cyc ? farm.air.ammoniaPpm : L.ammoniaPpm), dust: r3(farm.air.dustIndex || 0), alive: Math.round(fl.alive),
    dead: { ...fl.deadByCause }, culls: { ...(fl.cullsBy || {}) }, feedEatenKg: r3(fl.cumFeedKg), meanWeightG: r3(fl.meanWeightG),
    broodLitter: r3(meanMoistureOf(L, BROOD_CELLS) ?? 0), litterMean: r3(L.meanMoisturePct), droppings: cyc ? farm.cyc.droppings : fl.droppings,
    panType: { ...(farm.feed.panType || { starter: 1, grower: 0, finisher: 0 }) }, lameOnFloor: fl.lameOnFloor || 0,
  };
}

/** Run a profile from a standard start of `from` through `to`. */
export function runCycle(name = 'ideal', { seed = 1, from, to, stopAtStart = false } = {}) {
  const P = cycleProfileOf(name === 'determinism' ? 'ideal' : name);
  const [f0, t0] = RANGE[name] || ['plan', 'cleanout'];
  from = from ?? f0; to = to ?? t0;
  const world = makeWorld(), { env, events, farm, records, skills } = world;
  const trace = { hourly: [], levels: {}, levelEnds: {}, points: {}, records, farm, env, skills, events };
  const keep = P.name === 'ideal';
  const i0 = ORDER.indexOf(from), i1 = ORDER.indexOf(to);
  if (i0 > 1) {
    let snap = CACHE.get(`${seed}:${from}`);
    if (!snap) { runCycle('ideal', { seed, from: 'plan', to: from, stopAtStart: true }); snap = CACHE.get(`${seed}:${from}`); }
    if (!snap) throw new Error(`no standard start for ${from}`);
    restoreSnap(world, snap, trace);
  } else farm.seed = seed;
  let lastHr = null;
  env.addStepper((e) => {
    const hr = e.day * 24, k = Math.round(hr);
    if (Math.abs(hr - k) > 1e-4 || k === lastHr || farm.mode !== 'level') return;
    lastHr = k; trace.hourly.push(hourRow(world));
  });
  for (let i = Math.max(0, i0); i <= i1; i++) {
    const def = LEVELS[i];
    prepare(world, def, seed, i === i0 && i0 > 1, trace, keep);
    if (stopAtStart && i === i1) break;
    const res = def === PLAN_LEVEL ? playPlan(world, P) : def === LEVEL1 ? playBrooding(world, P) : playCycleLevel(world, def, P, trace);
    trace.levels[def.id] = res;
    trace.levelEnds[def.id] = JSON.parse(JSON.stringify({ health: farm.health, problems: farm.problems, levelStart: farm.stats.levelStart }));
    events.emit(EV.RUN, { phase: 'level-end', level: def.id, pass: res.pass });
    if (!res.pass) break;
  }
  for (const b of SKILL_BRANCHES) trace.points[b.id] = skills.points(b.id);
  return trace;
}

/** The level's start: a fresh farm (plan, brooding week), or the night skipped to 06:00 and the level entered. */
function prepare(world, def, seed, restored, trace, keep) {
  const { env, farm, events, records } = world;
  if (def === PLAN_LEVEL) { farm.start(PLAN_LEVEL, { seed }); }
  else if (def === LEVEL1) { farm.start(LEVEL1, { seed }); }
  else if (!restored) {
    const t = def.startDay + def.startHour * H;
    if (t > env.day + 1e-9) env.skipHours((t - env.day) * 24);
    farm.enterLevel(def);
    const prev = LEVELS[LEVELS.indexOf(def) - 1];
    if (records.compact && prev) records.compact(prev.startDay);
    if (keep) CACHE.set(`${seed}:${def.id}`, snapshot(world, trace));
  }
  events.emit(EV.RUN, { phase: 'level-start', level: def.id });
}
const cp = (world, def, name) => world.events.emit(EV.LEVEL, { phase: 'checkpoint', name, level: def.id, run: true, day: world.env.dayNumber });
function pickDead(world) {
  const { farm, events } = world, n = farm.flock.deadOnFloor;
  if (!(n > 0)) return;
  const causes = { ...(farm.flock.floorByCause || {}) };
  events.emit(EV.DEAD_PICK, { n, causes, carried: n });
  farm.act('dead.count', { n, causes });
}
const skipTo = (env, t) => { if (t > env.day + 1e-9) env.skipHours((t - env.day) * 24); };

// ---------------- Level 1: the planning day ----------------
function playPlan(world, P) {
  const { env, farm, events, records } = world, def = PLAN_LEVEL;
  void P;
  skipTo(env, -2 + 7.25 * H);
  farm.act('sign.read', { board: 'sign-gate' });
  events.emit(EV.FOOTDIP, { where: 'gate' });
  farm.act('bio.change');
  skipTo(env, -2 + 8 * H);
  farm.act('plan.letter');
  skipTo(env, -2 + 8.75 * H);
  events.emit(EV.HOUSE_ENTER, { dipped: true });
  farm.act('plan.measure', { axis: 'length', m: 48.0 });
  farm.act('plan.measure', { axis: 'width', m: 12.0 });
  skipTo(env, -2 + 10 * H);
  farm.act('plan.send', { houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 });
  skipTo(env, -2 + 11.5 * H);
  farm.act('plan.reply');
  cp(world, def, 'plan');
  skipTo(env, -2 + 18 * H);
  records.sign(-2);
  cp(world, def, 'level-end');
  return { pass: !!(farm.plan && farm.plan.outcome && farm.plan.outcome.pass), endDay: -2 };
}

// ---------------- Level 2: the brooding week (Phase 2's ideal, farm-profiles-run.js) ----------------
function playBrooding(world, P) {
  const { env, farm, records } = world, def = LEVEL1;
  void P;
  let failedAt = null;
  for (const ev of schedule({ preheat: { day: -1, hour: 7 } })) {
    skipTo(env, ev.t);
    const [kind, arg] = ev.what.split(':');
    if (kind === 'cp') { cp(world, def, arg); continue; }
    if (kind === 'snap') continue;
    if (kind === 'sign') { records.sign(ev.d); if (ev.d >= 0 && pctL1(farm) > LEVEL1.fail.mortalityMaxPct && failedAt == null) failedAt = ev.d; continue; }
    applyRound(farm, env, ev.d, kind, 'ideal');
    if (kind === 'am' || kind === 'pm') pickDead(world);
  }
  const w = farm.stats.weighed.map((x) => x.weightG), mean = w.reduce((a, b) => a + b, 0) / Math.max(1, w.length);
  const chick = farm.stats.chickWeightMeasuredG ?? farm.flock.chickWeightG, ratio = (w.length ? mean : farm.flock.meanWeightG) / chick;
  return { pass: ratio >= LEVEL1.fail.weightRatioMin && pctL1(farm) <= LEVEL1.fail.mortalityMaxPct && failedAt == null, endDay: failedAt ?? 7,
    ratio: +ratio.toFixed(3), weightG: +mean.toFixed(1), deathsPct: +pctL1(farm).toFixed(3) };
}
const pctL1 = (farm) => (100 * (farm.flock.deadTotal + farm.flock.culls)) / Math.max(1, farm.flock.delivered);

// ---------------- Levels 3-7 ----------------
function levelDeathsPct(farm) {
  const s = farm.stats.levelStart, fl = farm.flock;
  return s && s.alive > 0 ? (100 * (fl.deadTotal + fl.culls + (fl.doa || 0) - s.deaths - s.culls - s.doa)) / s.alive : 0;
}
function playCycleLevel(world, def, P, trace) {
  const { env, farm, records } = world;
  const fired = new Set(), once = (n) => { if (!fired.has(n)) { fired.add(n); cp(world, def, n); } };
  const limit = def.fail && def.fail.mortalityMaxPct;
  let endDay = def.endDay, failed = false;
  const lastStopDay = def.id === 'cleanout' ? 60 : def.endDay;
  for (const s of cycleStops(def.startDay, lastStopDay)) {
    const t = s.d + s.h * H;
    if (t < env.day - 1e-9) continue;
    if (def.id === 'cleanout' && farm.clean.bookedDay != null && t >= farm.clean.bookedDay + 6 * H) break;
    skipTo(env, t);
    if (s.r === 'sign') {
      records.sign(s.d);
      if (def.id === 'finish' && s.d === 42) once('harvest');
      if (limit && levelDeathsPct(farm) > limit + 1e-9) { failed = true; endDay = s.d; break; }
      if (s.d === def.endDay && def.id !== 'cleanout') break;
      continue;
    }
    applyCycleRound(farm, env, s.d, s.r, P);
    pickDead(world);
    if (farm.house.curtainOpen) once('curtain');
    if (farm.health.vaccine.state === 'drunk') once('vaccine');
    if (s.r === 'weigh') { cp(world, def, 'weighin'); }
    if (s.d === 32 && s.h >= 18.5) once('heatwave');
    if (farm.harvest.result) once('catch');
    if (farm.clean.sprayShare >= 0.95) once('clean');
    if (farm.clean.labRead) once('swabs');
  }
  if (def.id === 'weeks45' && !fired.has('heatwave') && env.day >= 32 + 19 * H) once('heatwave');
  if (def.id === 'cleanout' && !failed) {
    const booked = farm.clean.bookedDay ?? CYCLE.lastDay;
    skipTo(env, booked + 6 * H);
    once('rest');
  }
  cp(world, def, 'level-end');
  return levelResult(world, def, failed, endDay);
}

function levelResult(world, def, failed, endDay) {
  const { farm } = world, st = farm.stats, fl = farm.flock;
  const deathsPct = +levelDeathsPct(farm).toFixed(3);
  if (def.target.kind === 'weight') {
    const day = def.target.day, w = st.weighed.filter((x) => Math.floor(x.t) === day).map((x) => x.weightG);
    const mean = w.length >= 10 ? w.reduce((a, b) => a + b, 0) / w.length : (st.scaleAt && st.scaleAt[day]) ?? null;
    const uni = w.length >= 10 ? (100 * w.filter((x) => Math.abs(x - mean) <= 0.1 * mean).length) / w.length : null;
    const pass = !failed && mean != null && mean >= def.target.minShare * weightAt(day) && deathsPct <= def.fail.mortalityMaxPct + 1e-9;
    return { pass, endDay, weightG: mean != null ? +mean.toFixed(1) : null, uniformityPct: uni != null ? +uni.toFixed(1) : null, deathsPct, targetG: weightAt(day) };
  }
  if (def.target.kind === 'harvest') {
    const r = farm.harvest.result;
    if (!r) return { pass: false, endDay, deathsPct };
    const pass = !failed && r.meanLiveG >= def.target.minShare * weightAt(r.ageAtCatch) * HARVEST.shrink && deathsPct <= def.fail.mortalityMaxPct + 1e-9;
    const w = lastWeighing(st.weighed);
    return { pass, endDay, liveG: r.meanLiveG, fcr: r.fcr, mortalityPct: r.mortalityPct, uniformityPct: w ? w.uniformityPct : null, epef: r.epef,
      doaPct: r.doaPct, withdrawalH: r.withdrawalH, gutFull: r.gutFull, feedLeftKg: r.feedLeftKg, sold: r.sold, deathsPct };
  }
  if (def.target.kind === 'clean') {
    const C = farm.clean, lab = C.lab || C.labs[C.labs.length - 1] || null;
    const positive = lab ? lab.positive : null, restDays = C.bookedDay != null && C.closedDay != null ? C.bookedDay - C.closedDay : null;
    return { pass: positive != null && positive <= def.target.maxPositive && restDays != null && restDays >= def.target.restMinDays, endDay, positive, restDays, labs: C.labs.length };
  }
  void fl; void PLACEMENT_DAY;
  return { pass: !failed, endDay };
}
