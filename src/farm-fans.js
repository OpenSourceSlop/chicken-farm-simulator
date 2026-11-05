// The tunnel fans and the pad by the heat sign's rules (SKILLS.md §3.3, §4.1): ONE module for the ideal farmer's fan plan
// (farm-profiles-cycle.js, farm-profiles-cond.js), the controller's suggestion (Ventilation 2, adviseFans) and its stage
// table for the age (Ventilation 3, stageTableFor). Pure logic, package "model". idealFans / idealPad / eveningPad /
// feelWith / fansForFeel / padFansForFeel are moved here unchanged (the ideal's play is byte for byte the same).
import { HEAT, HEAT_P4, AIR, EQUIP, PAD_EFF, FAN_COUNT, flockAgeAt } from './config.js';
import { absHumSat, wetBulbOf, SLAB } from './sim.js';
import { windChillP4 } from './farm-tuning.js';
import { humidityTerm } from './farm-heat.js';

// ---- the ideal's fan plan (scripts/cycle-refs.mjs idealFans / idealPad, the contract's ideal) ----
export function idealFans(env, age) {
  const over = env.outsideTemp - env.targetTemp;
  if (age >= 21) return Math.max(0, Math.min(6, Math.ceil((over - 1) / 1.2)));
  if (age >= 14) return Math.max(0, Math.min(4, Math.round(over / 1.5)));
  return 0;
}
export function idealPad(env, fans) {
  const want = fans >= 6 && env.outsideTemp - env.targetTemp >= 10;
  if (env.padOn && (env.houseRH > 90 || !want)) return false;
  if (!env.padOn && want && env.outsideRH < 75) return true;
  return env.padOn;
}
/** The pads on the evening line: while the outside air is at or over about 30 °C and the house RH at or under the pad plate's limit. */
export const eveningPad = (env, P = {}) => P.pads !== 'never' && env.outsideTemp >= HEAT_P4.padEveningAboveC - 1e-9 && env.houseRH <= HEAT.padOffAboveRH;

/**
 * What the birds would feel (°C over the target) with n tunnel fans (and the pad) in the air outside now: the house's heat
 * balance (the inlet through the wet pad on the tunnel air's share, the sun, the flock's and the brooders' heat, the
 * slab) and its water (the pad's, the breath), less the wind chill. The ideal reads the fan panel's Birds feel.
 */
export function feelWith(env, n, age, pad = false) {
  const timer = Math.max(0, (env.fanMean || 0) - (env.fansEffective || 0)), share = n > 0 ? n / (n + timer) : 0;
  const drop = pad ? PAD_EFF * Math.max(0, env.outsideTemp - wetBulbOf(env.outsideTemp, env.outsideRH)) * Math.min(1, env.padWorking ?? 1) * share : 0;
  const air = AIR.infiltrationM3h + (n + timer) * EQUIP.fanM3h, ex = AIR.wallLossPerH + air / AIR.thermalM3;
  const heat = (env.sunHeatPerH || 0) + (env.flockHeatPerH || 0) + (env.heatTerms ? env.heatTerms.brooderCh || 0 : 0);
  const house = (heat + ex * (env.outsideTemp - drop) + SLAB.sinkPerH * env.slabTemp) / (ex + SLAB.sinkPerH);
  const x = (absHumSat(env.outsideTemp) * env.outsideRH) / 100 + 0.49 * drop + (env.vapourGh || 0) / air;
  const rh = Math.min(100, (100 * x) / absHumSat(house));
  return house + humidityTerm(rh, house) - windChillP4(((n + 0.1 * timer) * 2.5) / 6, age, house) - env.targetTemp;
}
/** The fewest tunnel fans (no pad) that keep the birds at or under `aim` °C felt over the target (at most `max`). */
export function fansForFeel(env, age, aim = 1, max = 6) {
  for (let n = 0; n <= max; n++) if (feelWith(env, n, age, false) <= aim) return n;
  return max;
}
/** The pad with the fewest tunnel fans that keeps the birds at or under +1 °C felt over the target; null when even one
 *  fan with the pad would chill them (under -1.5 °C: then no pad). */
export function padFansForFeel(env, age) {
  if (feelWith(env, 1, age, true) < -1.5) return null;
  for (let n = 1; n <= 6; n++) if (feelWith(env, n, age, true) <= 1) return n;
  return 6;
}

// ---- the controller's suggestion and stage table (SKILLS.md §3.3) ----
/** Model values of the advice and the stage table (none is a sign fact; the heat sign's lines are general practice). */
export const FAN_ADVICE = {
  youngFrom: 14, bigFrom: 21, youngMax: 3,                  // the young birds' line: at most three tunnel fans in week 3
  // the stage table over the house's range (°C over the target): big birds one fan per 1.2 °C from +1 °C (the heat sign's
  // stages); young birds few and high (the young birds' line); the pad over +9 °C with every fan (big birds only)
  bigStages: [1, 2.2, 3.4, 4.6, 5.8, 7], youngStages: [1, 2, 3], padOverC: 9,
  // the controller's hysteresis (a real stage controller's differential): a stage that is on stays on until the house is
  // hystC under its step; the pad, once on, until padHystC under its step
  hystC: 0.8, padHystC: 3,
};
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
const ageOf = (env, farm) => (farm && Number.isFinite(farm.age) ? farm.age : flockAgeAt(env.day));
const fansAvailable = (env) => FAN_COUNT - ((env.fansBroken && env.fansBroken.length) || 0);
/** The evening line now (big birds, 18:00 to 21:00, from day 28). */
export const eveningLineOn = (env, age) => age >= HEAT_P4.padEveningFromAge && env.hour >= 18 && env.hour < HEAT_P4.eveningUntil;

/**
 * The heat sign's tunnel fans and pad for now (Ventilation 2's suggestion; the working in words for the strip and the key):
 * { fans, pad, why, row: { day, houseC, feltC, line } }. Never more than the sign says: none for chicks under two weeks, the
 * young birds' line to day 20 (the fewest fans that hold what they feel at the target + 1 °C, at most three), the heat
 * sign's stages for big birds with the pad plate's rule, the evening line from day 28.
 */
export function adviseFans(env, farm) {
  const age = ageOf(env, farm), day = Math.max(0, env.dayNumber), A = FAN_ADVICE;
  const felt = env.houseTemp - (env.windChill || 0) + humidityTerm(env.houseRH, env.houseTemp);
  let fans = 0, pad = false, line = 'chicks';
  if (age >= A.bigFrom) {
    line = 'big birds';
    fans = idealFans(env, age);
    pad = idealPad({ outsideTemp: env.outsideTemp, targetTemp: env.targetTemp, outsideRH: env.outsideRH, houseRH: env.houseRH, padOn: !!env.padOn }, fans);
    if (eveningLineOn(env, age)) { line = 'the evening line'; fans = 6; pad = eveningPad(env); }
  } else if (age >= A.youngFrom) {
    line = 'young birds';
    fans = Math.min(A.youngMax, Math.max(Math.min(A.youngMax, idealFans(env, age)), fansForFeel(env, age, 1, A.youngMax)));
  }
  fans = Math.max(0, Math.min(fansAvailable(env), fans));
  if (env.houseRH > HEAT.padOffAboveRH) pad = false;
  const why = `Heat sign, day ${day}, house ${one(env.houseTemp)} °C, birds feel ${one(felt)} °C → ${fans} fan${fans === 1 ? '' : 's'}, pad ${pad ? 'on' : 'off'}`;
  return { fans, pad, why, row: { day, houseC: +env.houseTemp.toFixed(1), feltC: +felt.toFixed(1), line } };
}

/**
 * The stage table for the birds' age (Ventilation 3's controller): { stages: [{ overC, fans }], padOverC } over the house's
 * range (°C over the target), or null before day 15. Rewritten whenever its key changes (the age's line, the evening line,
 * the pad plate's humidity).
 */
export function stageTableFor(env, farm) {
  const age = ageOf(env, farm), A = FAN_ADVICE, n = fansAvailable(env);
  if (age < A.youngFrom + 1) return null;
  if (age < A.bigFrom) return { stages: A.youngStages.map((overC, i) => ({ overC, fans: Math.min(n, i + 1) })), padOverC: null, key: 'young' };
  const humid = env.houseRH > HEAT.padOffAboveRH || env.outsideRH >= 75;
  if (eveningLineOn(env, age)) {
    const p = eveningPad(env);
    return { stages: [{ overC: -50, fans: n }], padOverC: p ? -50 : null, key: `evening${p ? '+pad' : ''}` };
  }
  return { stages: A.bigStages.map((overC, i) => ({ overC, fans: Math.min(n, i + 1) })), padOverC: humid ? null : A.padOverC, key: `big${humid ? '' : '+pad'}${n}` };
}
/** The table as the controller writes it now: the stages that are on (and the pad, once on) held by the differential. */
export function withDifferential(t, env) {
  if (!t) return t;
  const A = FAN_ADVICE, n = env.fansManual ?? 0;
  return { ...t, stages: t.stages.map((s) => (s.overC > -10 && s.fans <= n ? { ...s, overC: +(s.overC - A.hystC).toFixed(2) } : s)),
    padOverC: t.padOverC != null && t.padOverC > -10 && env.padOn ? +(t.padOverC - A.padHystC).toFixed(2) : t.padOverC };
}
