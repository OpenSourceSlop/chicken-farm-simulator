// Management profiles of the Phase 4 conditions (PHASE4.md §4, §9.6). Owner: package "sim". Pure logic: data and the
// condition rounds, through farm.act and the env setters only (the run's goto(auto) and standard starts call the same
// functions as scripts/test-cond.mjs). farm-profiles-cycle.js reads them (cycleProfileOf(name, { condition }),
// cycleStops(fromDay, toDay, condition), applyCycleRound) and farm-profiles-cycle-run.js plays them (runCycle with a
// condition): this file imports neither.
//
//   COND_PROFILES[condition]        the ideal ('<condition>:ideal') and the named mistakes of §4's tables
//   condProfile(name, condition)    the profile fields a condition profile adds to Phase 3's ideal (null: none)
//   condStops(fromDay, toDay, condition)    the condition's stops from day 8 (merged by cycleStops)
//   broodStopsCond(condition, delivery)     the brooding week's extra stops and the truck's hour (runCycle and the run's goto)
//   applyCondRound(farm, env, day, round, P, act)   a condition round ('hotBrood', 'stormStart', 'cut', 'pumpFix', ...)
//   condFanPlan(farm, env, P, day, age, n, pad) -> { n, pad }   the condition's fans and pad at a fan stop
//   condAm(farm, env, act, P, day) / condAnswer(farm, env, act, P, day)   the morning round's and the answers' extras
//   p2ProfileFor(P)                 the brooding week's Phase 2 profile under the condition
import { CONDITIONS, HEAT_P4, HEAT, targetTempAt, WATER_TANK, PLACEMENT_DAY, AIR, EQUIP, PAD_EFF } from './config.js';
import { absHumSat, wetBulbOf, SLAB } from './sim.js';
import { windChillP4 } from './farm-tuning.js';
import { humidityTerm } from './farm-heat.js';
import { feelWith, fansForFeel, padFansForFeel } from './farm-fans.js';
export { feelWith, fansForFeel, padFansForFeel };

/** Profile names per condition (keys of scripts/test-cond.mjs COND_TARGETS). */
export const COND_PROFILES = {
  hot: ['hot:ideal', 'hotNoBroodAir', 'hotYoungAsNormal', 'hotNoPad', 'hotNight3', 'hotPadsTo21', 'hotNoFlush'],
  rainy: ['rainy:ideal', 'rainyNoGenerator', 'rainyGenLate', 'rainyGenLeftOn', 'rainyNoStep', 'rainyNoFlaps'],
  badChicks: ['bad:ideal', 'badNoGrade', 'badNoCall', 'badNoTrays'],
  water: ['water:ideal', 'waterPumpUnfixed', 'waterPumpLate', 'waterFilterLate'],
};
export const COND_OF = Object.fromEntries(Object.entries(COND_PROFILES).flatMap(([c, names]) => names.map((n) => [n, c])));
const IDEALS = {
  hot: { broodAir: true, youngPad: true, padsAllNight: true, flush: true, catch: { day: 42, hour: 1 } },
  rainy: { rainyTimer: true, flaps: true, genTest: true, genOnCutMin: 10, mainsBackAt: 18 + 15 / 60 },
  badChicks: { trays: true, grade: true, hatchery: true, warmer: true, crop48: true },
  water: { waterTest: true, tankRead: true, pumpFixWorn: true },
};
const MODS = {
  hotNoBroodAir: { broodAir: false }, hotYoungAsNormal: { youngPad: false }, hotNoPad: { pads: 'never' },
  hotNight3: { night3: true }, hotPadsTo21: { padsAllNight: false, padsOffAt21: true }, hotNoFlush: { flush: false },
  rainyNoGenerator: { genOnCutMin: null, mainsBackAt: null }, rainyGenLate: { genOnCutMin: 60 }, rainyGenLeftOn: { mainsBackAt: null, genRestartMin: 20 },
  rainyNoStep: { rainyTimer: false, timer: 'day8' }, rainyNoFlaps: { flaps: false },
  badNoGrade: { trays: false, grade: false, hatchery: false, warmer: false, crop48: false }, badNoCall: { hatchery: false }, badNoTrays: { trays: false },
  waterPumpUnfixed: { pumpFixWorn: false }, waterPumpLate: { tankRead: false, pumpFixWorn: false, pumpFixAt: 31 + 8 / 24 }, waterFilterLate: { flowSkipDays: [12, 24] },
};
/** The levels each named mistake runs (a standard start of the condition's ideal before it). */
export const COND_RANGE = {
  hotNoBroodAir: ['level1', 'level1'], hotYoungAsNormal: ['week2', 'week2'], hotNoPad: ['weeks45', 'weeks45'], hotNight3: ['weeks45', 'weeks45'],
  hotPadsTo21: ['weeks45', 'weeks45'], hotNoFlush: ['weeks45', 'finish'],
  rainyNoGenerator: ['weeks45', 'weeks45'], rainyGenLate: ['weeks45', 'weeks45'], rainyGenLeftOn: ['weeks45', 'weeks45'], rainyNoStep: ['week2', 'week3'], rainyNoFlaps: ['week3', 'finish'],
  badNoGrade: ['level1', 'level1'], badNoCall: ['level1', 'level1'], badNoTrays: ['level1', 'level1'],
  waterPumpUnfixed: ['weeks45', 'weeks45'], waterPumpLate: ['weeks45', 'weeks45'], waterFilterLate: ['week2', 'weeks45'],
};
/** The fields a condition profile sets over Phase 3's ideal (null for a plain cycle profile). */
export function condProfile(name, condition) {
  const c = COND_OF[name] || (condition && CONDITIONS[condition] ? condition : null);
  if (!c) return null;
  return { condition: c, ...IDEALS[c], ...(MODS[name] || {}) };
}

const at = (d, h) => d + h / 24;
// the hot season's young birds (tuning-refs.mjs youngPadFans): the pad with one tunnel fan to day 11, two to 17, three to 20
export const youngPadFans = (age) => (age < 11.7 ? 1 : age < 17.7 ? 2 : 3);
const storms = (condition) => (condition === 'rainy' ? Object.values(CONDITIONS.rainy.levels).flatMap((l) => l.problems || []).filter((p) => p.storm === true) : []);
const CUT = CONDITIONS.rainy.levels.weeks45.problems.find((p) => p.id === 'power-cut');

/** The condition's stops from day 8 (cycleStops merges them; their rounds are applyCondRound's). */
export function condStops(fromDay, toDay, condition, P = condProfile(`${condition}:ideal`, condition)) {
  const out = [], add = (d, h, r) => { if (d >= fromDay && d <= toDay) out.push({ d, h, r }); };
  for (let d = Math.max(8, fromDay); d <= toDay; d++) {
    if (condition === 'hot') {
      if (d <= 20) { add(d, 11, 'hotYoung'); add(d, 20, 'hotYoungOff'); add(d, 23, 'hotNight'); add(d, 2, 'hotNight'); }
      if (d >= 22 && d <= 40 && d % 2 === 0) add(d, 13.5, 'hotFlush');
      if (d >= 21 && d <= 41) add(d, 21.5, 'hotNight');
    }
    if (condition === 'water' && d >= 22 && d <= 41) add(d, 8, 'pumpFix');
  }
  for (const s of storms(condition)) { add(s.day, s.hour, 'stormStart'); add(s.until.day, s.until.hour, 'stormEnd'); }
  if (condition === 'rainy') {
    add(CUT.day, CUT.hour + 1 / 60, 'cut');
    for (const m of [10, 60]) add(CUT.day, CUT.hour + m / 60, 'cutGen');
    add(CUT.back.day, CUT.back.hour + 5 / 60, 'mainsBack');
    add(34, 1 + 40 / 60, 'genRestart');   // the generator left on runs dry about 01:20 (150 L, 10 h): started again
    add(34, 6 + 20 / 60, 'mainsBackLate'); // ... and the pinned 'mains is back' job done on the morning round
  }
  void P;
  return out;
}

/** The brooding week's extra stops of a condition (days -1..7) and the truck's hour. */
export function broodStopsCond(condition, delivery = null) {
  const out = [], add = (d, h, r) => out.push({ d, h, r });
  if (condition === 'hot') for (let d = 1; d <= 7; d++) { add(d, 11, 'hotBrood'); add(d, 18, 'hotBroodOff'); }
  for (const s of storms(condition)) if (s.day <= 7) { add(s.day, s.hour, 'stormStart'); add(s.until.day, s.until.hour, 'stormEnd'); }
  if (condition === 'water') add(1, 9, 'wTest');
  // (review round: the warmer brooding ends with day 3's evening: at 22:00 the thermostat goes to day 4's plain row, so the
  // chicks do not spend the night 2 °C over their target once it drops at midnight)
  if (condition === 'badChicks') { add(-1, 7.4, 'trays'); add(2, 9, 'crop48'); for (const d of [0, 1, 2, 3]) add(d, 13, 'warmer'); add(3, 22, 'warmerEnd'); }
  return { stops: out, truckHour: delivery && Number.isFinite(delivery.arrivalHour) ? delivery.arrivalHour : 8 };
}

/** The brooding week's Phase 2 profile under a condition: the hot season drops the warm afternoon's timer. */
export const p2ProfileFor = (P) => (!P || !P.condition ? {} : {
  ...(P.condition === 'hot' ? { warm: 'none' } : {}),
  followShift: P.warmer !== false, grade: P.grade !== false, hatchery: P.hatchery !== false, trays: P.trays !== false, crop48: P.crop48 !== false, cond: P,
});

/** A condition round. `act(id, args)` is the profile's act (farm.act, logged); returns nothing. */
export function applyCondRound(farm, env, day, round, P, act) {
  const fl = farm.flock, alive = fl.alive > 0, G = farm.generator, age = env.day - PLACEMENT_DAY;
  const fans = (n, pad) => { if (n !== env.fansManual) { env.setFans(n); act('vent.fans', { n }); } if (pad != null && !!pad !== env.padOn) { env.setPad(pad); act('vent.pad', { on: !!pad }); } };
  switch (round) {
    case 'hotBrood': if (P.broodAir && alive) fans(1, true); return;
    case 'hotBroodOff': if (P.broodAir) fans(0, false); return;
    case 'stormStart': if (P.flaps && !farm.house.flapsClosed) act('inlets.storm', { closed: true }); return;
    case 'stormEnd': if (P.flaps && farm.house.flapsClosed) act('inlets.storm', { closed: false }); return;
    case 'wTest': if (P.waterTest) act('water.test'); return;
    case 'trays': if (P.trays) act('brood.trays', { on: true }); return;
    case 'crop48': if (P.crop48) for (let i = 0; i < 10; i++) { const [x, z] = [[-19, -2.6], [-11, 2.6], [-3, -2.6]][i % 3]; act('sample.crop', { x, z, index: i }); } return;
    case 'warmer': if (P.warmer && !farm.house.broodersUp) env.setHeaterSetpoint(Math.round(targetTempAt(day) * 2) / 2 + 1); return;
    case 'warmerEnd': if (P.warmer && !farm.house.broodersUp) env.setHeaterSetpoint(Math.round(targetTempAt(day + 1) * 2) / 2); return;
    case 'cut': return;
    case 'cutGen': {
      const m = Math.round((env.day - at(CUT.day, CUT.hour)) * 1440);
      if (P.genOnCutMin != null && Math.abs(m - P.genOnCutMin) <= 1 && !farm.power.on) { act('gen.start'); act('gen.switch', { to: 'generator' }); }
      return;
    }
    case 'mainsBack': if (P.mainsBackAt != null && farm.power.switch === 'generator') { act('gen.switch', { to: 'mains' }); act('gen.stop'); act('gen.fuel'); } return;
    case 'mainsBackLate': if (P.genRestartMin != null && farm.power.switch === 'generator' && farm.power.mains) { act('gen.switch', { to: 'mains' }); act('gen.stop'); act('gen.fuel'); } return;
    case 'genRestart': {
      const st = farm.problems.find((p) => p.id === 'gen-dry');
      if (P.genRestartMin != null && st && st.phase === 'found') { act('gen.fuel'); act('gen.start'); }
      return;
    }
    case 'hotYoung': case 'hotYoungOff': case 'hotNight': return;   // the fan plan acts there (condFanPlan)
    case 'hotFlush': {
      if (!P.flush || !alive) return;
      for (const line of [0, 1, 2, 3]) act('water.flush', { line, on: true });
      env.skipHours(2.5 / 60);
      for (const line of [0, 1, 2, 3]) act('water.flush', { line, on: false });
      return;
    }
    case 'pumpFix': {
      const T = farm.waterTank, worn = (farm.condX.gauges || []).some((g) => g[0] === day && g[2] > 0 && g[2] <= WATER_TANK.wornBar);
      if (!T.fixing && T.pumpShare < 0.99 && ((P.pumpFixWorn && worn) || (P.pumpFixAt != null && Math.abs(env.day - P.pumpFixAt) < 0.01))) act('pump.fix');
      return;
    }
    default: void G; void age;
  }
}
/** The condition's late extras of the morning round (after Phase 3's): the generator test, the tank, the rainy timer. */
export function condAm(farm, env, act, P, day, signTimer, dampFound = false) {
  if (P.genTest && [8, 15, 22, 29, 36].includes(day)) { act('gen.test'); act('gen.fuel'); }
  if (P.tankRead && day >= 22 && day <= 41) act('water.tank');
  // the vent sign's rainy line: by the table every morning, a quarter over it while the house reads over 80 % at dawn
  if (P.rainyTimer && day >= 8 && day <= 21 && !dampFound) { const t = signTimer(farm); if (env.houseRH > 80) t.onSec = Math.round(t.onSec * 1.25); act('vent.timer', t); }
}
/** The condition problems the ideal answers on the round after their symptom. */
export function condAnswer(farm, env, act, P) {
  const found = (id) => farm.problems.some((p) => p.id === id && p.phase === 'found');
  if (found('iron-filter')) act('water.clearFilter');
  if (found('iron-nipples')) { act('water.flush', { line: 3, on: true }); env.skipHours(2.5 / 60); act('water.flush', { line: 3, on: false }); act('water.flowtest', { line: 3 }); }
  if (found('rain-in')) { act('inlets.storm', { closed: true }); for (const x of [-8, 0, 8]) act('litter.patch', { x, z: 5 }); }
  if (found('damp-spell')) { if (env.fansManual < 2) { env.setFans(2); act('vent.fans', { n: 2 }); } }
}
// feelWith / fansForFeel / padFansForFeel: moved to farm-fans.js (Skills update: one module for the ideal and the controllers)
/** The condition's fans and pad at a fan stop of Phase 3's plan. */
export function condFanPlan(farm, env, P, day, age, n, pad) {
  if (!P || !P.condition) return { n, pad };
  if (P.condition === 'hot') {
    const young = age >= 7.7 && age < 20.7;
    if (P.youngPad && young) {
      // humid air (week 2's rainy spell): the pad adds damp, not cool (the pad plate's limit); tunnel fans by what the
      // young birds feel (the fan panel's Birds feel against the brooder sign's row)
      const humid = env.outsideRH >= 75 || env.houseRH > HEAT.padOffAboveRH;
      if (env.hour >= 11 && env.hour < 20 && !humid) { const k = padFansForFeel(env, age); return k == null ? { n: fansForFeel(env, age, 1), pad: false } : { n: Math.min(youngPadFans(age), k), pad: true }; }
      // the mornings, the humid hours and the hot nights: tunnel fans by what they feel (at most three at night), no pad
      return { n: fansForFeel(env, age, 1, env.hour >= 9 && env.hour < 20 ? 6 : 3), pad: false };
    }
    if (P.pads === 'never' && age >= 20.7) return { n, pad: false };   // hotNoPad: no pads from day 21
    if (P.night3 && age >= 27.7 && (env.hour >= 18.5 || env.hour < 6)) return { n: 3, pad: false };
    if (P.padsOffAt21 && age >= 20.7 && (env.hour >= 21 || env.hour < 7)) return { n, pad: false };
    // the pads stay on while the outside air is over about 30 °C (the hot sign's line: often all night)
    if (P.padsAllNight && age >= 20.7 && n >= 6 && env.outsideTemp >= HEAT_P4.padEveningAboveC && env.houseRH <= 90) pad = true;
    // the pad with as many fans as the birds' feel needs (the dry spell's air cools far more through the pad)
    if (pad && age >= 20.7 && P.feelFans !== false) { const k = padFansForFeel(env, age); return k == null ? { n: fansForFeel(env, age, 1), pad: false } : { n: Math.min(n, k), pad: true }; }
  }
  if (P.condition === 'rainy') {
    // damp air (review round): birds in air this wet keep their heat; tunnel fans by what they feel (the fan panel's Birds
    // feel), young birds by day (at most two in week 2, four in week 3), big birds at any hour up to every fan; the pad
    // stays off over the pad plate's humidity
    const young = age < 20.7, day_ = env.hour >= 9 && env.hour < 20;
    if (env.houseRH > 85 && age >= 7.7 && (!young || day_)) {
      const k = fansForFeel(env, age, 1, age < 13.7 ? 2 : young ? 4 : 6);
      if (k > n) n = k;
      if (pad && env.houseRH > HEAT.padOffAboveRH) pad = false;
    }
  }
  return { n, pad };
}
