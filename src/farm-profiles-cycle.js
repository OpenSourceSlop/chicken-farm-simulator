// Management profiles for the whole cycle (days 8-69; PHASE3.md §6.14). Owner: package "sim". Pure logic.
// The ideal farmer and every named mistake of CYCLE_TARGETS, through farm.act and the env setters only
// (never other events: the run package's goto(auto) and standard starts call applyCycleRound in the browser).
//
//   cycleStops(fromDay, toDay, condition) -> [{ d, h, r }]   the rounds to play, in time order: the routine rounds
//     ('am' 06:15, 'pm' 13:15, 'night' 18:30, 'sign' 20:00), the fan plan's stops ('fans' at 09:00, 11:00,
//     15:30, 21:00; the 'am' / 'pm' / 'night' rounds run it too), Phase 4's 'evening' (18:00 and 20:00 from day 28:
//     the heat sign's evening line), a condition's own stops (farm-profiles-cond.js condStops), 'padcheck' (the pad plate's limit, at
//     :30 from 11:30 to 17:30, days 22-41), and the dated ones ('curtain', 'check', 'vaccine', 'vaccine2',
//     'change', 'change2', 'brooders', 'probe', 'feedersUp' / 'feedersDown', 'withdraw', 'catch', 'lines',
//     'tickets', 'clean1'..'clean4', 'dry', 'swabs', 'close', 'lab', 'book'). 'sign' is the level's part
//     (the run signs the record); every other round is applyCycleRound's.
//   applyCycleRound(farm, env, day, round, profile = 'ideal') -> [{ id, args, result }]
//   runCycle (farm-profiles-cycle-run.js): the trace scripts/test-cycle.mjs checkCycle measures.
// The ideal's fans and pads follow scripts/cycle-refs.mjs idealFans / idealPad (re-stated below: the
// browser cannot import a script) at its stops, base controls only (no vent.stages).
import { EQUIP, LIGHT_PRESETS, HARVEST, CLEAN, WEATHER, LEVEL1, PLAN_LEVEL, levelOfDay, feedStdGAt, flowTargetAt, nippleHeightCmAt, feederRimCmAt, targetTempAt, PLACEMENT_DAY, feedTypeForDay, HEAT, HEAT_P4 } from './config.js';
import { signTimer } from './farm-profiles.js';
import { condProfile, condStops, applyCondRound, condAm, condAnswer, condFanPlan } from './farm-profiles-cond.js';
import { idealFans, idealPad, eveningPad, fansForFeel } from './farm-fans.js';
export { idealFans, idealPad, eveningPad };
import { feedLeftKg } from './farm-silos.js';

/** Profile names (keys of CYCLE_TARGETS in scripts/test-cycle.mjs). */
export const CYCLE_PROFILES = ['ideal', 'noDark', 'lateLift', 'noStep', 'poorVaccine', 'poorVaccineCocci', 'cocciUntreated', 'minVentW3',
  'crumbleOn', 'abruptChange', 'overfullSilo', 'dustOn', 'noTunnel', 'fansNoPad', 'padInHumid', 'fanUnfixed', 'noWithdrawal',
  'longWithdrawal', 'brightCatch', 'wetDisinfect', 'litterLeft', 'shortRest', 'noCare', 'padWeek3', 'eveningFans3', 'padYoung1', 'determinism'];

const IDEAL = {
  light: 'growing', curtain: { day: 10, hour: 8 }, vaccine: { thirstH: 1.5, stabiliser: true, walk: true }, timer: 'table',
  starterOrder12: 0, change: 'blend', grower: true, finisherDay: 29, fixes: true, cocciMedicine: true, dustAnswer: true,
  fans: 'plan', pads: 'plan', padInHumid: false, minVentW3: false, noTunnel: false, fanFix: true, heatFeeders: true,
  lastOrder: true, bookDay: 38, catch: { day: 42, hour: 2 }, withdrawH: 11, catchDimmer: 0.1, panels: true,
  scrapeShare: 1, sprayAfterWashH: null, closeDay: 46, restDays: 21,
};
const MODS = {
  ideal: {}, determinism: {},
  noDark: { light: 'none' },
  lateLift: { curtain: { day: 15, hour: 8 } },
  noStep: { timer: 'day8' },
  poorVaccine: { vaccine: { thirstH: 0, stabiliser: false, walk: true } },
  poorVaccineCocci: { vaccine: { thirstH: 0, stabiliser: false, walk: true }, cocciMedicine: false },
  cocciUntreated: { cocciMedicine: false },
  minVentW3: { minVentW3: true },
  crumbleOn: { grower: false },
  abruptChange: { change: 'abrupt' },
  overfullSilo: { starterOrder12: 5000 },
  dustOn: { dustAnswer: false },
  noTunnel: { noTunnel: true },
  fansNoPad: { pads: 'never' },
  padInHumid: { padInHumid: true },
  fanUnfixed: { fanFix: false },
  noWithdrawal: { withdrawH: null },
  longWithdrawal: { withdrawH: 24 },
  brightCatch: { catchDimmer: 1.0 },
  wetDisinfect: { sprayAfterWashH: 1 },
  litterLeft: { scrapeShare: 0.75 },
  shortRest: { restDays: 14 },
  noCare: { noCare: true },          // nothing at all is done (week 2 from its standard start): the level does not pass
  padWeek3: { padWeek3: true },      // the week 3 warm afternoon met with all six fans and the pad on 16-day-old birds
  // Phase 4 (PHASE4.md §2.6): three fans and no pads in the evenings of days 29-41 (from 18:00 to the next morning's
  // round; the night round turns the pads off), and the warm afternoon of day 16 met with the pad and one fan
  eveningFans3: { eveningFans3: true },
  padYoung1: { padYoung1: true },
};
/** A profile by name (Phase 4: with a condition — a condition profile name such as 'hot:ideal', or the farm's condition
 *  for a plain name — the condition's ideal additions and its mistake's fields, farm-profiles-cond.js). */
export function cycleProfileOf(name, { condition = null } = {}) {
  if (typeof name === 'object' && name) return name;
  const base = { ...IDEAL, ...(MODS[name] || {}), name: name || 'ideal' }, c = condProfile(name, condition);
  if (!c) return base;
  return { ...base, ...c, ...(c.catch ? { catch: c.catch } : {}), ...(name === 'hotNoPad' ? { pads: 'never' } : {}) };
}

// ---- the fan plan: idealFans / idealPad / eveningPad live in farm-fans.js (Skills update: one module for the ideal and the
// controllers' advice) ----
export const IDEAL_STOPS = [6.25, 9, 11, 13.25, 15.5, 18.5, 21];

/** The rounds of each calendar day from fromDay to toDay (inclusive), in time order. */
export function cycleStops(fromDay, toDay, condition = null) {
  const out = [];
  const add = (d, h, r) => out.push({ d, h, r });
  for (let d = Math.max(8, fromDay); d <= toDay; d++) {
    if (d <= 41) {
      add(d, 6.25, 'am');
      // Phase 4: the heat sign's evening line for big birds (every fan and the pads while the outside is warm)
      if (d >= HEAT_P4.padEveningFromAge && d <= 41) { add(d, 18, 'evening'); add(d, 20, 'evening'); }
      if ([10, 13, 16, 19, 23].includes(d)) add(d, 9.25, d === 23 ? 'probe' : 'check');
      if ([14, 21, 28, 35, 40].includes(d)) add(d, 9.5, 'weigh');
      for (const h of [9, 11, 15.5, 21]) add(d, h, 'fans');
      if (d >= 22) for (const h of [11.5, 12.5, 14, 14.5, 16, 16.5, 17.5]) add(d, h, 'padcheck');
      add(d, 13.25, 'pm');
      add(d, 18.5, 'night');
      if (d === 10) add(d, 8, 'curtain');
      if (d === 16) add(d, 17, 'fans');   // the warm afternoon of week 3: the fans stepped down by what the birds feel
      if (d === 12) { add(d, 8.5, 'vaccine'); add(d, 10, 'vaccine2'); }
      if (d === 14) add(d, 15, 'change');
      if (d === 15) { add(d, 6.1, 'change0'); add(d, 15, 'change2'); }
      if (d === 22) add(d, 7, 'brooders');
      if (d === 29) add(d, 15, 'change');
      if (d === 30) add(d, 15, 'change2');
      if (d >= 30 && d <= 32) { add(d, 11.1, 'feedersUp'); add(d, 16, 'feedersDown'); }
      if (d === 41) add(d, 2, 'withdraw24');
      if (d === 41) add(d, 15, 'withdraw');
    }
    if (d === 42) { add(d, 1.5, 'catch'); add(d, 2, 'lines'); add(d, 5.5, 'tickets'); add(d, 8, 'harvest'); }
    if (d === 43) add(d, 7, 'clean1');
    if (d === 44) { add(d, 7, 'clean2'); add(d, 8, 'dry'); add(d, 10, 'spray1'); }
    if (d === 45) add(d, 7, 'clean3');
    if (d === 46) { add(d, 8, 'swabs'); add(d, 17, 'close'); }
    if (d === 48) { add(d, 7, 'lab'); add(d, 7.5, 'book'); }
    if (d >= 49 && d <= 60) add(d, 7, 'lab');
    if (d <= 46) add(d, 20, 'sign');
  }
  if (condition) out.push(...condStops(Math.max(8, fromDay), toDay, condition));
  return out.sort((a, b) => a.d + a.h / 24 - (b.d + b.h / 24));
}

/** The keep-fed rule: stock of today's feed type for 3 days ahead, orders up to 5 days, to the type's end. */
function keepFed(farm, env, act, day) {
  const feed = farm.feed, fl = farm.flock, age = env.day - PLACEMENT_DAY;
  if (!(fl.alive > 0) || day > 40) return;
  const type = typeOn(farm, day);
  // the starter to the blend's start (an empty silo 1 leaves the blend to silo 2: no old starter under the finisher)
  const endDay = type === 'starter' ? (farm.profileGrower === false ? 29.6 : 15.1) : type === 'grower' ? 29.6 : 41.6, margin = type === 'starter' ? 1 : 1.04;
  const stock = feed.silos.reduce((a, s) => a + s.layers.filter((l) => l.type === type).reduce((x, l) => x + l.kg, 0), 0)
    + feed.pending.filter((o) => o.type === type).reduce((a, o) => a + o.kg, 0);
  const need = (days) => { let kg = 0; for (let t = 0; t < days; t += 0.25) kg += (fl.alive * feedStdGAt(age + t)) / 1000 * 0.25; return kg * margin; };
  const left = Math.max(0, endDay - env.day);
  if (stock >= need(Math.min(3, left))) return;
  const kg = Math.round(Math.max(0, need(Math.min(5.5, left)) - stock) / 100) * 100;
  if (kg >= 300) act('feed.order', { kg, type });
}
function typeOn(farm, day) {
  if (day < 15) return 'starter';
  if (day < 29) return farm.profileGrower === false ? 'starter' : 'grower';
  return 'finisher';
}

const SPOTS = [[-18, -2.6], [-6, 2.6], [6, -2.6], [18, 2.6], [-12, 0], [12, 0]];
function fansTo(act, env, n, pad) {
  if (n !== env.fansManual) { env.setFans(n); act('vent.fans', { n }); }
  if (pad != null && !!pad !== env.padOn) { env.setPad(pad); act('vent.pad', { on: !!pad }); }
}
const heatFound = (farm, env) => farm.problems.some((p) => ['warm-afternoon3', 'hot-afternoon', 'hot-finish'].includes(p.id) && (p.phase === 'found' || p.phase === 'fixed') && p.foundAt != null && Math.floor(p.foundAt) === env.dayNumber && env.hour < 17.05);
const isState = (farm, id, ...phases) => farm.problems.some((p) => p.id === id && phases.includes(p.phase));

/** The fan plan at a stop (and the heat problems' answer: all fans while a found heat problem's afternoon lasts). */
function fanPlan(farm, env, act, P, day) {
  const age = env.day - PLACEMENT_DAY;
  if (!(farm.flock.alive > 0)) return;
  let n = idealFans(env, age);
  // the last stop of the evening (sign-heat): young birds want the tunnel fans off at night, so under four weeks
  // the fans go by the night's low
  if (env.hour >= 20.5 && age < 28) n = Math.min(n, Math.max(1, idealFans({ outsideTemp: nightLow(env), targetTemp: env.targetTemp }, age)));
  // a found heat problem: every fan for big birds; young birds (under 21 days) the fewest tunnel fans that bring what they
  // feel to the target + 1 °C, read again at each stop as the afternoon cools (review round: six fans on 16-day-olds
  // chilled them 3-5.6 °C under their target for about five hours); padWeek3 is the mistake of six fans and the pad
  if (P.fixes && heatFound(farm, env)) n = P.padYoung1 && day === 16 ? 1 : age < 21 && !P.padWeek3 ? fansForFeel(env, age, 1) : 6;
  if (P.fixes && isState(farm, 'dusty-air', 'found') && P.dustAnswer) n = Math.max(n, 2);
  if (P.fixes && isState(farm, 'heat-wave', 'found', 'fixed') && day >= 30 && day <= 32) n = Math.max(n, idealFans(env, age));
  const atCatch = farm.harvest.started || (farm.harvest.catchAt != null && env.day >= farm.harvest.catchAt - 1 / 24);
  if (atCatch) n = Math.max(n, HARVEST.catchFansMin);
  if (noTunnelOn(P, day)) n = 0;
  let pad = P.pads === 'never' || P.noTunnel ? false : idealPad({ ...envView(env), padOn: env.padOn }, n);
  if (P.padInHumid && n >= 6 && day === 33 && env.hour >= 10 && env.hour < 18) pad = true;
  // padWeek3: the pad stays on with six fans through the warm afternoon of day 16 (the mistake under test)
  if (P.padWeek3 && day === 16 && n >= 6 && env.hour >= 11 && env.hour < 18) pad = true;
  // padYoung1: the warm afternoon of day 16 met with the pad and one fan (the heat sign's young-birds line)
  if (P.padYoung1 && day === 16 && P.fixes && heatFound(farm, env)) pad = true;
  // Phase 4: the heat sign's evening line (from day 28, 18:00-21:00): every fan, the pads while the outside is warm
  if (eveningOn(env, age, P)) { n = Math.max(n, eveningFans(farm, env)); pad = eveningPad(env, P); }
  // eveningFans3: three fans and no pads from 18:00 to the next morning, days 29-41 (the heat wave's answer on days 30-32
  // holds: the found heat wave has every fan by the plan)
  const wave = P.fixes && isState(farm, 'heat-wave', 'found', 'fixed') && day >= 30 && day <= 32;
  if (P.eveningFans3 && day >= 29 && day <= 41 && (env.hour >= 18 || env.hour < 6) && !wave) { n = 3; pad = false; }
  if (P.condition) ({ n, pad } = condFanPlan(farm, env, P, day, age, n, pad));   // Phase 4: the condition's plan
  fansTo(act, env, n, pad);
}
/** The evening line (config HEAT_P4): big birds, 18:00 to 21:00. */
const eveningOn = (env, age, P) => !P.noTunnel && age >= HEAT_P4.padEveningFromAge && env.hour >= 18 && env.hour < HEAT_P4.eveningUntil;
const eveningFans = (farm, env) => 6;
/** Tomorrow's 05:00 outside temperature (the weather's low and the level's weather events). */
function nightLow(env) {
  const w = WEATHER[env.weather] || WEATHER.normal, t = env.dayNumber + 1 + 5 / 24;
  return w.min - (env.weatherEvents || []).reduce((a, e) => a + (t > e.fromDay && t < e.toDay ? e.outsideDrop : 0), 0);
}
/** The mistakes that run no tunnel fans: minimum ventilation only in week 3 (minVentW3) or from day 22 (noTunnel). */
const noTunnelOn = (P, day) => (P.minVentW3 && day >= 15 && day <= 21) || (P.noTunnel && day >= 22);
const envView = (env) => ({ outsideTemp: env.outsideTemp, targetTemp: env.targetTemp, outsideRH: env.outsideRH, houseRH: env.houseRH, padOn: env.padOn });

export function applyCycleRound(farm, env, day, round, profile = 'ideal') {
  const P = cycleProfileOf(profile, { condition: farm.condition }), done = [];
  const act = (id, args = {}) => { const result = farm.act(id, args); done.push({ id, args, result }); return result; };
  if (farm.mode !== 'level') return done;
  if (P.noCare) return done;
  // the level of the day (a no-op inside a run, which enters each level at its 06:00 start; level.debug.freeRun
  // and other callers that never entered it get the level's problems, weather and the cycle climate here)
  const lv = levelOfDay(day);
  if (lv && lv.id !== LEVEL1.id && lv.id !== PLAN_LEVEL.id && (!farm.cycleLevel || farm.cycleLevel.id !== lv.id) && env.day >= lv.startDay + lv.startHour / 24 - 1e-9) farm.enterLevel(lv);
  farm.profileGrower = P.grower;
  const fl = farm.flock, age = env.day - PLACEMENT_DAY, alive = fl.alive > 0;
  const lines = [0, 1, 2, 3];
  const listen = () => { for (const [x, z] of SPOTS) farm.listen(x, z); };
  // the round names of PHASE3.md §14.1 that cycleStops spells differently
  const ALIAS = { eve: 'night', noon: 'fans', heatwave: env.hour < 14 ? 'feedersUp' : 'feedersDown', clean4: 'swabs' };
  if (ALIAS[round]) { done.push(...applyCycleRound(farm, env, day, ALIAS[round], P)); if (round === 'clean4') done.push(...applyCycleRound(farm, env, day, 'close', P)); return done; }
  switch (round) {
    case 'am': {
      if (!alive) return done;
      act('controller.read', { houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH) });
      act('water.meter');
      if (!farm.house.broodersUp) env.setHeaterSetpoint(Math.round(targetTempAt(day) * 2) / 2);
      for (const line of lines) {
        act('water.pressure', { line, cm: Math.min(40, Math.round(((flowTargetAt(day) - 4) / 2) * 2) / 2) });
        act('water.height', { line, cm: Math.round(nippleHeightCmAt(day)) });
      }
      if (!(P.flowSkipDays || []).includes(day)) for (const line of lines) act('water.flowtest', { line });
      act('feed.meter'); act('feed.silo');
      if (!farm.feed.withdrawn) for (const line of [0, 1, 2]) act('feed.line', { line, running: true, flood: false, heightCm: Math.floor(feederRimCmAt(Math.max(0, age))) });
      if (day === 8 && P.light === 'growing') { act('light.program', LIGHT_PRESETS.growing); for (const [x, z] of SPOTS.slice(0, 3)) act('light.lux', { x, z }); }
      if (day === 8 && P.light === 'none') for (const [x, z] of SPOTS.slice(0, 3)) act('light.lux', { x, z });
      if (day === 36 && P.light === 'growing') act('light.program', LIGHT_PRESETS.finishing);
      const timerDay = P.timer === 'day8' && day <= 21 ? 8 : day;
      if (day % 2 === 0 || isState(farm, 'rainy-spell', 'found')) {
        if (!(P.timer === 'day8' && day > 8 && day <= 21)) { const t = signTimer(farm); if (isState(farm, 'rainy-spell', 'found') && P.fixes && P.timer !== 'day8') t.onSec = Math.round(t.onSec * 1.5); act('vent.timer', t); }
      }
      void timerDay;
      if (day === 12 && P.starterOrder12) act('feed.order', { kg: P.starterOrder12, type: 'starter' });
      if (day === 13 && P.grower) act('feed.order', { kg: 6000, type: 'grower' });
      if (day === 27) act('feed.order', { kg: 6000, type: 'finisher' });
      if (day === 36 && P.lastOrder) lastOrder(farm, env, act, P);
      else if (day < 36) keepFed(farm, env, act, day);
      if (day >= P.bookDay && day <= 39 && farm.harvest.bookedAt == null) act('phone.bookCatch', { day: P.catch.day, hour: P.catch.hour });
      if (age >= 21) act('sample.bird', { x: 0, z: 0, index: 0, look: 'breathing' });
      if (fl.lameOnFloor > 0 && day >= 10) act('sample.bird', { x: -4, z: 4, index: 99, look: 'gait', lame: true }); // a bird sitting apart, picked up
      listen();
      answerProblems(farm, env, act, P, day);
      fanPlan(farm, env, act, P, day);
      if (P.condition) condAm(farm, env, act, P, day, signTimer, isState(farm, 'rainy-spell', 'found') || isState(farm, 'damp-spell', 'found'));
      return done;
    }
    case 'check': {
      if (!alive) return done;
      const look = day === 16 || day === 19 ? 'droppings' : 'gait';
      for (let i = 0; i < 10; i++) { const [x, z] = SPOTS[i % 6]; act('sample.bird', { x, z, index: i, look }); }
      if (look === 'gait') for (let i = 0; i < 4; i++) { const [x, z] = SPOTS[i]; act('sample.bird', { x, z, index: i, look: 'feathers' }); act('sample.bird', { x, z, index: i, look: 'feet' }); }
      if (fl.lameOnFloor > 0) act('sample.bird', { x: -4, z: 4, index: 99, look: 'gait', lame: true });
      answerProblems(farm, env, act, P, day);
      return done;
    }
    case 'weigh': {
      if (!alive) return done;
      // 50 birds from the five parts of the house (four along it, both sides): 10 a frame
      for (let i = 0; i < 50; i++) { const k = Math.floor(i / 10), x = -18 + k * 9, z = k % 2 ? 2.6 : -2.6; act('sample.weigh', { x, z, index: i }); }
      return done;
    }
    case 'probe': { for (const [x, z] of [[-18, 0], [0, 0], [18, 0]]) act('air.probe', { x, z }); act('pad.check'); return done; }
    case 'fans': {
      if (!alive) return done;
      if (env.hour < 10) listen(); // the morning walk goes on
      if (env.hour > 15 && env.hour < 16 && day >= 15) act('fans.read', { fans: env.fansOn, houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH), speedMs: +env.airSpeed.toFixed(2) });
      answerProblems(farm, env, act, P, day); fanPlan(farm, env, act, P, day);
      return done;
    }
    case 'padcheck': {
      if (alive && env.padOn && env.houseRH > HEAT.padOffAboveRH - 1 && !(P.padInHumid && day === 33)) fansTo(act, env, env.fansManual, false);
      return done;
    }
    case 'pm': {
      if (!alive) return done;
      if (day >= 15) act('fans.read', { fans: env.fansOn, houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH), speedMs: +env.airSpeed.toFixed(2) });
      if (day <= 14) act('controller.read', { houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH) });
      act('litter.squeeze', { x: -16, z: 0.6 }); act('litter.squeeze', { x: -8, z: -1.95 }); act('litter.squeeze', { x: day >= 10 ? 10 : -4, z: 3.2 });
      if (day >= 15) act('litter.squeeze', { x: -22.5, z: 0.5 }); // the pad end
      if (day === 18) for (const [x, z] of [[-20, -1.95], [-8, 1.95], [6, -4.9], [16, 4.9]]) { act('litter.fork', { x, z }); act('litter.patch', { x, z }); }
      if (day === 24) act('pad.check');
      listen();
      answerProblems(farm, env, act, P, day);
      fanPlan(farm, env, act, P, day);
      return done;
    }
    case 'night': {
      if (!alive) return done;
      act('radio.listen', { day });
      if (day >= 15) act('fans.read', { fans: env.fansOn, houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH), speedMs: +env.airSpeed.toFixed(2) });
      answerProblems(farm, env, act, P, day);
      fanPlan(farm, env, act, P, day);
      // the night: the pads off as the air cools, unless it is still 12 °C or more over the target (the fans carry on),
      // or the evening line holds them (Phase 4: from day 28 while the outside is warm, until 21:00)
      if (env.padOn && env.outsideTemp - env.targetTemp < 12 && !(P.padInHumid && day === 33) && !(eveningOn(env, age, P) && eveningPad(env, P)) && !P.eveningFans3
        && !(P.youngPad && age < 20.7 && env.hour < 20) && !(P.padsAllNight && env.outsideTemp >= HEAT_P4.padEveningAboveC)) fansTo(act, env, env.fansManual, false);
      return done;
    }
    case 'evening': case 'hotYoung': case 'hotYoungOff': case 'hotNight': {
      if (!alive) return done;
      fanPlan(farm, env, act, P, day);
      return done;
    }
    case 'curtain': {
      // the rest of the house is littered on the prep day (Phase 2's ideal): the lift, then a walk through the birds
      if (P.curtain.day === day && !farm.house.curtainOpen) { act('house.curtain', { open: true }); for (const [x, z] of SPOTS) farm.listen(x, z); }
      return done;
    }
    case 'vaccine': if (P.vaccine.thirstH > 0) act('water.main', { open: false }); return done;
    case 'vaccine2': {
      act('vaccine.mix', { stabiliser: P.vaccine.stabiliser });
      act('water.main', { open: true });
      if (P.vaccine.walk) farm.noteWalk(0.5);
      return done;
    }
    case 'change0': if (P.change === 'abrupt') { act('feed.valve', { silo: 0, open: 0 }); act('feed.valve', { silo: 1, open: 1 }); } return done;
    case 'change': {
      if (day === 14 && P.change === 'blend' && P.grower) { act('feed.valve', { silo: 0, open: 0.5 }); act('feed.valve', { silo: 1, open: 0.5 }); }
      if (day === 29) { act('feed.valve', { silo: 0, open: 0.5 }); act('feed.valve', { silo: 1, open: 0.5 }); }
      return done;
    }
    case 'change2': {
      if (day === 15 && P.grower) { act('feed.valve', { silo: 0, open: 0 }); act('feed.valve', { silo: 1, open: 1 }); }
      if (day === 30) { act('feed.valve', { silo: 0, open: 1 }); act('feed.valve', { silo: 1, open: 0 }); }
      return done;
    }
    case 'brooders': if (!farm.house.broodersUp) act('heat.brooders', { up: true }); return done;
    case 'feedersUp': if (P.heatFeeders && alive && isState(farm, 'heat-wave', 'found', 'fixed', 'active')) for (const line of [0, 1, 2]) act('feed.line', { line, running: false, heightCm: 45 }); return done;
    case 'feedersDown': if (P.heatFeeders && alive && !farm.feed.withdrawn) for (const line of [0, 1, 2]) act('feed.line', { line, running: true, heightCm: Math.floor(feederRimCmAt(Math.max(0, age))) }); return done;
    case 'withdraw24': if (P.withdrawH === 24) act('feed.withdraw', { on: true }); return done;
    case 'withdraw': if (P.withdrawH != null && P.withdrawH < 24 && !farm.feed.withdrawn) act('feed.withdraw', { on: true }); return done;
    case 'catch': {
      act('light.program', { darkStart: 0, darkHours: 0, dimmer: P.catchDimmer });
      if (P.panels) act('catch.panels');
      fanPlan(farm, env, act, P, day);
      return done;
    }
    case 'lines': for (const line of lines) act('water.height', { line, cm: 60 }); return done;
    case 'tickets': for (const truck of [0, 1]) act('load.ticket', { truck }); return done;
    case 'harvest': fansTo(act, env, 0, false); return done;
    case 'clean1': return cleanDay1(farm, env, act, P);
    case 'clean2': return cleanDay2(farm, env, act, P);
    case 'dry': fansTo(act, env, 6, false); return done;
    case 'spray1': if (P.sprayAfterWashH != null) spray(act); return done;
    case 'clean3': {
      if (P.sprayAfterWashH == null && farm.clean.sprayShare < 0.95) spray(act);
      for (const item of CLEAN.washItems) act('clean.washbay', { item });
      SPOT_BAIT.forEach(([x, z], i) => act('clean.bait', { x, z, i }));
      return done;
    }
    case 'swabs': CLEAN.swabSpots.forEach((s, spot) => act('clean.swab', { x: s.x, z: s.z, spot })); return done;
    case 'close': fansTo(act, env, 0, false); act('house.close'); return done;
    case 'lab': {
      if (farm.clean.lab && !farm.clean.labRead) { farm.clean.labRead = true; act('swab.read'); }
      if (P.name === 'ideal' || P.sprayAfterWashH == null) rewash(farm, env, act, P, day);
      return done;
    }
    case 'book': {
      if (farm.clean.closedDay != null && farm.clean.bookedDay == null) act('phone.bookChicks', { day: farm.clean.closedDay + P.restDays });
      return done;
    }
    default: if (P.condition) applyCondRound(farm, env, day, round, P, act); return done;
  }
}
const SPOT_BAIT = [[-25.2, -6.8], [25.2, -6.8], [25.2, 6.8], [-25.2, 6.8]];

/** Problems the ideal answers on the round after their symptom (PHASE3.md §6.14). */
function answerProblems(farm, env, act, P, day) {
  if (!P.fixes) return;
  const found = (id) => isState(farm, id, 'found');
  if (found('lame-birds') || (farm.flock.lameOnFloor > 0 && day >= 11)) act('chicks.cull', { n: farm.flock.lameOnFloor, reason: 'lame' });
  if (found('sudden-deaths')) act('controller.read', { houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH) });
  if (found('pad-overflow')) { act('pad.fixFloat'); act('litter.patch', { x: -23, z: -3 }); act('litter.patch', { x: -23, z: 0 }); act('litter.patch', { x: -23, z: 3 }); }
  if (found('coccidiosis')) { act('phone.vet', { reason: 'blood in the droppings' }); if (P.cocciMedicine) act('water.medicate', { on: true }); }
  if (found('gumboro')) act('phone.vet', { reason: 'hunched birds, white droppings' });
  if (found('fan-belt') && P.fanFix) act('fan.fix', { index: 3 });
  if (found('pad-clog')) act('pad.flush');
  if (found('heat-wave')) { act('fans.read', { fans: env.fansOn }); act('pad.check'); act('water.flowtest', { line: 0 }); }
  if (found('humid-heat') && !noTunnelOn(P, day)) { if (env.padOn) fansTo(act, env, Math.max(6, env.fansManual), false); else { env.setFans(6); act('vent.fans', { n: 6 }); } }
  // a heat problem found: every fan on, the pad by its plate (the switches pressed even when they were on)
  for (const id of ['warm-afternoon3', 'hot-afternoon', 'hot-finish']) if (found(id) && !noTunnelOn(P, day)) {
    if (P.padYoung1 && id === 'warm-afternoon3') { env.setFans(1); act('vent.fans', { n: 1 }); env.setPad(true); act('vent.pad', { on: true }); continue; }
    // young birds: tunnel fans by what they feel, no pad (the fan plan steps them down at the next stops)
    // (a condition's plan on top: the hot season's pad with few fans, the rainy season's damp air)
    if (farm.age < 21 && !P.padWeek3) {
      let k = fansForFeel(env, farm.age, 1), pad = false;
      if (P.condition) ({ n: k, pad } = condFanPlan(farm, env, P, day, farm.age, k, false));
      env.setFans(k); act('vent.fans', { n: k });
      if (pad !== env.padOn || pad) { env.setPad(pad); act('vent.pad', { on: pad }); }
      continue;
    }
    env.setFans(6); act('vent.fans', { n: 6 });
    const pad = (P.padWeek3 && id === 'warm-afternoon3') || (P.pads !== 'never' && idealPad(envView(env), 6));
    if (pad !== env.padOn || pad) { env.setPad(pad); act('vent.pad', { on: pad }); }
  }
  if (found('rainy-spell') && !(P.timer === 'day8' && day <= 21)) { const t = signTimer(farm); t.onSec = Math.round(t.onSec * 1.5); act('vent.timer', t); }
  if (found('dusty-air') && P.dustAnswer && !noTunnelOn(P, day)) fansTo(act, env, Math.max(2, env.fansManual), env.padOn);
  if (found('low-silo')) keepFed(farm, env, act, day);
  if (found('abnormal-deaths')) {
    act('phone.report');
    // week 3's deaths up with no cause seen yet: the droppings of ten birds again (blood in them: the vet and the medicine
    // on the next round). The day-19 check can come before the blood shows on a dry floor (integrator, Phase 4 merge).
    if (day >= 19 && day <= 21 && !isState(farm, 'coccidiosis', 'found') && !isState(farm, 'coccidiosis', 'fixed')) for (let i = 0; i < 10; i++) { const [x, z] = SPOTS[i % 6]; act('sample.bird', { x, z, index: 20 + i, look: 'droppings' }); }
  }
  const m = farm.health.medication;
  if (m.on && m.onH >= 72) act('water.medicate', { on: false });
  if (P.condition) condAnswer(farm, env, act, P);
}

/** The last feed order (day 36): enough to the withdrawal and no more (sign-feed: under one day's feed left). */
function lastOrder(farm, env, act, P) {
  const fl = farm.flock, feed = farm.feed, end = 41 + 15 / 24 - (P.withdrawH && P.withdrawH > 11 ? (P.withdrawH - 11) / 24 : 0);
  let need = 0;
  for (let t = env.day; t < end; t += 0.25) need += (fl.alive * feedStdGAt(t - PLACEMENT_DAY)) / 1000 * 0.25;
  const stock = feedLeftKg(feed) + feed.pending.reduce((a, o) => a + o.kg, 0);
  const kg = Math.max(0, Math.round((need * 0.99 - stock + 300) / 100) * 100);
  act('feed.order', { kg, type: 'finisher' });
}

function cleanDay1(farm, env, act, P) {
  const done = [];
  const a = (id, args) => { const r = farm.act(id, args); done.push({ id, args, result: r }); return r; };
  for (const line of [0, 1, 2, 3]) a('water.height', { line, cm: 60 });
  for (const line of [0, 1, 2]) a('feed.line', { line, running: false, heightCm: 45 });
  if (P.scrapeShare < 1) {
    // a quarter of the litter left in: the rows along both side walls and one down the middle (in every part of the house)
    for (let x = -23.5; x <= 23.51; x += 1) for (let z = -5.5; z <= 5.51; z += 1) if (![-5.5, 0.5, 5.5].includes(z)) a('clean.scrape', { x, z, r: 0.5, quiet: true });
  } else for (const z of [-4, 0, 4]) for (let x = -23.5; x <= 23.51; x += 0.5) a('clean.scrape', { x, z, r: 2.0, quiet: true });
  a('clean.scrape', { x: 0, z: 0, r: 0.1 });
  for (const part of CLEAN.brushParts) a('clean.brush', { part });
  return done;
}
function cleanDay2(farm, env, act) {
  for (const z of [-4, 0, 4]) for (let x = -23.5; x <= 23.51; x += 0.5) act('clean.wash', { x, z, r: 2.5, quiet: true });
  act('clean.wash', { x: 0, z: 0, r: 0.1 });
  act('water.disinfect', { on: true });
  for (const line of [0, 1, 2, 3]) { act('water.flush', { line, on: true }); env.skipHours(11 / 60); act('water.flush', { line, on: false }); }
  act('water.disinfect', { on: false });
  for (const line of [0, 1, 2]) act('feed.wash', { line });
  return [];
}
function spray(act) {
  for (const z of [-4, 0, 4]) for (let x = -23.5; x <= 23.51; x += 0.5) act('clean.spray', { x, z, r: 2.5, quiet: true });
  act('clean.spray', { x: 0, z: 0, r: 0.1 });
}
/** Swabs grew bacteria (p-rewash, p-reswab): wash and dry with the fans one morning, spray and swab the next. */
function rewash(farm, env, act, P, day) {
  const st = farm.problems.find((p) => p.id === 'swab-positive'), C = farm.clean;
  if (!st || st.phase !== 'found') return;
  if (C.washShare < 0.95) {
    for (const z of [-4, 0, 4]) for (let x = -23.5; x <= 23.51; x += 0.5) act('clean.wash', { x, z, r: 2.5, quiet: true });
    act('clean.wash', { x: 0, z: 0, r: 0.1 });
    fansTo(act, env, 6, false);
  } else if (C.sprayShare < 0.95 && C.wetShare <= 0.05) {
    spray(act); fansTo(act, env, 0, false);
    CLEAN.swabSpots.forEach((s, spot) => act('clean.swab', { x: s.x, z: s.z, spot }));
  }
  void day; void P;
}

export { runCycle, cycleWorld, saveBlob, ENV_SAVE } from './farm-profiles-cycle-run.js';
void EQUIP; void feedTypeForDay;
