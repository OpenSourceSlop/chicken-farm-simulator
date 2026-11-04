// Phase 4 tuning (PHASE4.md §2, §9): what the birds feel and how they answer, re-derived against general broiler
// practice — pure functions, contract code committed by the Phase 4 design (like farm-heat.js in Phase 3).
// Owner: package "sim", which wires them into the farm from Week 2 (and into the brooding week of the hot and
// rainy seasons, PHASE4.md §4): env.windChill (sim.js derive, cycle climate only), farm-house.js panting / heat
// deaths / cold deaths, the flock's sensible heat (env.flockHeatPerH), the water drunk per kg of feed, the
// dry hours before dehydration deaths and the CV growth after day 14. scripts/tuning-refs.mjs runs them on the
// env alone (scripts/test-tuning.mjs holds the references now); until the sim package wires them, the live game
// keeps Phase 3's model (farm-heat.js) and every Phase 1-3 number is unchanged.
//
// Every number here is a model value (never on a sign) unless it is listed in config SIGN_FIGURES (general),
// where the sign's figure and the model's must agree (scripts/test-tuning.mjs checks the model side).
import { FLOOR_GRID, BIRD_BOUNDS, weightAt, feedStdGAt } from './config.js';
import { humidityTerm, ZONES } from './farm-heat.js';

/** Model constants of Phase 4 (PHASE4.md §2.2). */
export const TUNING = {
  // Wind chill (general practice: moving air cools the birds; young birds feel it more; it fades as the air
  // nears the birds' body temperature). °C per m/s at the 2.5 m/s anchor, by flock age; the speed curve is
  // v^exp x refMs^(1 - exp) (2.5 m/s gives perMs x 2.5); x the air factor tau(house °C): 1 up to fullBelowC,
  // falling straight to 0 at zeroAtC, never under minShare.
  windChill: { perMs: [[7, 3.0], [14, 2.8], [21, 2.6], [28, 2.4], [35, 2.2], [42, 2.2]], exp: 0.8, refMs: 2.5, fullBelowC: 35, zeroAtC: 41, minShare: 0.15 },
  // Panting: the share of birds panting rises over `width` °C from (hotFrom - startBelow): from day 35 the first
  // birds pant at about 24 °C felt (target 20 + 5.5 - 1.5), half at 26 °C, all at 28 °C.
  pant: { hotFrom: [[7, 1.5], [14, 2.0], [21, 3.0], [28, 4.5], [35, 5.5], [42, 5.5]], startBelow: 1.5, width: 4 },
  // Heat deaths per bird-hour: k x (e - deathFrom)^2 above deathFrom (minus weightK per unit over the target curve).
  death: { from: [[7, 4.0], [14, 5.0], [21, 6.5], [28, 8.0], [35, 9.5], [42, 9.5]], weightK: 4, k: 0.0003, max: 0.03 },
  // Cold deaths of older birds: from fromAge only below e < -(e0 + perDay x (age - fromAge)) (at most eMax), at
  // rateShare of Phase 2's chick rate (0.04 %/h per °C²): chilled birds of 2-6 weeks huddle and eat less first.
  cold: { fromAge: 14, e0: 4, perDay: 0.2, eMax: 8, rateShare: 0.25 },
  // Sensible heat of the flock (Phase 2's 1.3 x weight / 2850 °C/h term) x sensibleK from Week 2, fading in hot air
  // (more of the birds' heat leaves as breath): x clamp((fadeToC - house °C) / fadeSpanC, minShare, 1).
  birdHeat: { sensibleK: 2.5, fadeToC: 38, fadeSpanC: 8, minShare: 0.4 },
  // Water drunk per kg of feed (general: about 1.8 when the birds are comfortable, more in the heat): base x (1 +
  // perC x the mean comfort e over 0), at most max.
  water: { base: 1.8, perC: 0.05, max: 3.2 },
  // Dehydration: birds of fromAge days and older die of thirst only after safeH hours with no water in reach
  // (the catch: the lines go up as the crew starts; the vaccine's thirst keeps its own 4 h rule).
  dry: { fromAge: 21, safeH: 6 },
  // Uniformity: the within-cohort CV growth per day after day 14 x this (the ideal's day-40 weighing 68-74 %).
  cvGrowthAfter14: 0.8,
};

const lerpTable = (t, a) => {
  if (a <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (a <= t[i][0]) { const [a0, v0] = t[i - 1], [a1, v1] = t[i]; return v0 + ((v1 - v0) * (a - a0)) / (a1 - a0); }
  return t[t.length - 1][1];
};
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Share of the full wind chill the air still gives at house air `airC` (1 up to 35 °C, about 0.15 near 40 °C). */
export function chillAirShare(airC) {
  const W = TUNING.windChill;
  return clamp((W.zeroAtC - airC) / (W.zeroAtC - W.fullBelowC), W.minShare, 1);
}
/** °C the birds of `age` feel cooler in air moving at `speedMs` in house air of `airC` °C. */
export function windChillP4(speedMs, age, airC = 30) {
  const W = TUNING.windChill;
  if (!(speedMs > 0)) return 0;
  return lerpTable(W.perMs, age) * Math.pow(speedMs, W.exp) * Math.pow(W.refMs, 1 - W.exp) * chillAirShare(airC);
}
/** The panting reference of the age, °C over the target (the first birds pant 1.5 °C under it, all 2.5 °C over it). */
export const hotFromP4 = (age) => lerpTable(TUNING.pant.hotFrom, age);
/** °C over the target at which the first birds of `age` pant (the comfort legend's "birds start to pant"). */
export const pantFromP4 = (age) => hotFromP4(age) - TUNING.pant.startBelow;
/** °C over the target at which every bird of `age` pants. */
export const pantAllP4 = (age) => pantFromP4(age) + TUNING.pant.width;
/** Share of birds panting at comfort e. */
export const pantShareP4 = (e, age) => clamp((e - pantFromP4(age)) / TUNING.pant.width, 0, 1);
/** °C over the target at which heat deaths start, for birds of `age` weighing `weightG`. */
export function deathFromP4(age, weightG = weightAt(age)) {
  const over = Math.max(0, weightG / Math.max(1, weightAt(age)) - 1);
  return lerpTable(TUNING.death.from, age) - TUNING.death.weightK * over;
}
/** Heat deaths per bird-hour at comfort e. */
export function heatDeathRateP4(e, age, weightG) {
  const d = e - deathFromP4(age, weightG);
  return d > 0 ? Math.min(TUNING.death.max, TUNING.death.k * d * d) : 0;
}
/** Intake factor from the heat (Phase 3's slope over the new panting reference). */
export const heatIntakeP4 = (e, age) => Math.max(0.5, 1 - 0.04 * Math.max(0, e - hotFromP4(age)));
/** e under which chilled birds of `age` start to die (null before TUNING.cold.fromAge: Phase 2's rule). */
export function coldDeathFromP4(age) {
  const C = TUNING.cold;
  return age < C.fromAge ? null : -Math.min(C.eMax, C.e0 + C.perDay * (age - C.fromAge));
}
/** Cold deaths per bird-hour at comfort e for birds of `age` (Phase 2's 0.04 %/h per °C² x rateShare). */
export function coldDeathRateP4(e, age) {
  const from = coldDeathFromP4(age);
  if (from == null || e >= from) return 0;
  return 0.0004 * TUNING.cold.rateShare * (from - e) ** 2;
}
/** Multiplier on the flock's sensible heat term from Week 2 at house air `houseC`. */
export function sensibleHeatK(houseC) {
  const B = TUNING.birdHeat;
  return B.sensibleK * clamp((B.fadeToC - houseC) / B.fadeSpanC, B.minShare, 1);
}
/** Litres of water the birds drink per kg of feed at mean comfort e (°C over the target). */
export const waterPerKgP4 = (eMean = 0) => Math.min(TUNING.water.max, TUNING.water.base * (1 + TUNING.water.perC * Math.max(0, eMean)));
/** Dehydration deaths may start (birds with no water in reach for `dryH` hours). */
export const dehydrationAllowed = (age, dryH) => age < TUNING.dry.fromAge || dryH >= TUNING.dry.safeH;

/**
 * The flock's heat and breath for the climate (Phase 2's figures, PHASE2.md §6.2, with the Phase 4 sensible heat
 * and water ratio): heat °C/h into the house air; breath vapour g/h = 0.4 x the water drunk.
 */
export function flockLoadsP4({ birds, weightG, age, houseC = 30, eMean = 0 }) {
  if (!(birds > 0)) return { heatPerH: 0, vapourGh: 0 };
  const heatPerH = (0.2 * birds) / 6000 + ((1.3 * birds * weightG) / (6000 * 2850)) * sensibleHeatK(houseC);
  const drinkLh = (birds * feedStdGAt(age) * waterPerKgP4(eMean)) / 1000 / 24;
  return { heatPerH, vapourGh: 0.4 * drinkLh * 1000 };
}

const NX = FLOOR_GRID.nx, NZ = FLOOR_GRID.nz;
const CELLS = [];
for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) {
  const x = FLOOR_GRID.x0 + (ix + 0.5) * FLOOR_GRID.cell, z = FLOOR_GRID.z0 + (iz + 0.5) * FLOOR_GRID.cell;
  CELLS.push({ x: Math.max(BIRD_BOUNDS.xMin, Math.min(BIRD_BOUNDS.xMax, x)), z, zone: Math.min(ZONES - 1, Math.floor((ix * ZONES) / NX)) });
}

/**
 * farm-heat.heatState with the Phase 4 responses (whole house in use, birds spread evenly). The env's own wind
 * chill is replaced by windChillP4 (felt = env.localTemp + env.windChill - windChillP4): once the sim package
 * moves windChillP4 into sim.js the correction is 0.
 * @returns {{ felt: number[], e: number[], eMean: number, feltMean: number, pantShare: number, deathPerH: number,
 *   coldDeathPerH: number, fHeat: number, coldShare: number, windChill: number, pantFrom: number, hotFrom: number, deathFrom: number }}
 */
export function heatStateP4(env, { age, weightG, cellFeel } = {}) {
  const wc = windChillP4(env.airSpeed, age, env.houseTemp), fix = (env.windChill || 0) - wc;
  const h = humidityTerm(env.houseRH, env.houseTemp), tgt = env.targetTemp;
  const felt = new Array(ZONES).fill(0), n = new Array(ZONES).fill(0);
  let pant = 0, death = 0, cold = 0, coldN = 0, fh = 0, fs = 0;
  for (const c of CELLS) {
    const f = env.localTemp(c.x, c.z) + fix + h + (cellFeel ? cellFeel(c.x, c.z) : 0), e = f - tgt;
    felt[c.zone] += f; n[c.zone]++; fs += f;
    pant += pantShareP4(e, age); death += heatDeathRateP4(e, age, weightG); cold += coldDeathRateP4(e, age); fh += heatIntakeP4(e, age);
    if (e < -2) coldN++;
  }
  for (let i = 0; i < ZONES; i++) felt[i] /= n[i] || 1;
  const N = CELLS.length;
  return { felt, e: felt.map((x) => x - tgt), feltMean: fs / N, eMean: fs / N - tgt, pantShare: pant / N, deathPerH: death / N, coldDeathPerH: cold / N,
    fHeat: fh / N, coldShare: coldN / N, windChill: wc, pantFrom: pantFromP4(age), hotFrom: hotFromP4(age), deathFrom: deathFromP4(age, weightG) };
}
