// What growing birds feel in the heat (PHASE3.md §6.3) — pure functions, complete now (contract code
// committed by the integrator, like farm-plan.js). Owner: package "sim", which wires them into the
// flock (heat deaths, panting, intake) from Week 2 on; scripts/test-cycle.mjs runs them on the env
// alone (the climate check) to hold the §6.3 references.
//
// felt (per floor cell) = env.localTemp(x, z)  (house air, tunnel gradient, wind chill, brooder radiant,
//                         side-wall term, as Phase 1 / 2)  + humidityTerm(house RH, house °C)
// e = felt - targetTempAt(day)  (the brooder sign's target; 20 °C from day 35)
// panting   share of birds: ramps 0 -> 1 across hotFrom(age) +- PANT_RAMP / 2
// heat deaths per bird-hour: DEATH_K x (e - deathFrom(age, weight))^2 above deathFrom, at most DEATH_MAX
// intake    f_heat = max(INTAKE_MIN, 1 - INTAKE_K x (e - hotFrom)) above hotFrom
// Every number here is a model value (never on a sign). Big birds stand a higher e than young ones
// (the target falls to 20 °C, a Thai night is 24 °C): from day 35 they pant above about 26 °C felt and
// die above about 31.5 °C felt.
import { FLOOR_GRID, BIRD_BOUNDS, weightAt, feedStdGAt } from './config.js';

/** Model constants (tuned with the climate check in scripts/test-cycle.mjs). */
export const HEAT_MODEL = {
  // °C over the target at which birds start to pant, by flock age (straight lines, flat outside)
  hotFrom: [[7, 1.5], [14, 2.5], [21, 3.5], [28, 4.5], [35, 6.0], [42, 6.0]],
  // °C over the target at which heat deaths start, by flock age; minus deathWeightK per unit of weight
  // over the target curve (a heavier bird of the same age suffers sooner)
  deathFrom: [[7, 4.0], [14, 5.0], [21, 6.5], [28, 8.5], [35, 10.5], [42, 10.5]],
  deathWeightK: 4,
  deathK: 0.0005,       // share of the birds per hour per °C² over deathFrom (0.05 %/h at 1 °C over)
  deathMax: 0.03,       // at most 3 % of the birds an hour
  pantRamp: 1.0,        // °C
  intakeK: 0.04, intakeMin: 0.5,
  // humidity term: + rhK x (RH - rhFrom) + rhK2 x (RH - rhFrom2) °C, faded in over rhTFrom .. + rhTRamp °C
  rhFrom: 75, rhK: 0.08, rhFrom2: 88, rhK2: 0.35, rhTFrom: 24, rhTRamp: 4,
};

const lerpTable = (t, a) => {
  if (a <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (a <= t[i][0]) { const [a0, v0] = t[i - 1], [a1, v1] = t[i]; return v0 + ((v1 - v0) * (a - a0)) / (a1 - a0); }
  return t[t.length - 1][1];
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** °C over the target at which birds of `age` start to pant. */
export const hotFrom = (age) => lerpTable(HEAT_MODEL.hotFrom, age);
/** °C over the target at which heat deaths start, for birds of `age` weighing `weightG`. */
export function deathFrom(age, weightG = weightAt(age)) {
  const over = Math.max(0, weightG / Math.max(1, weightAt(age)) - 1);
  return lerpTable(HEAT_MODEL.deathFrom, age) - HEAT_MODEL.deathWeightK * over;
}
/** °C the house humidity adds to what the birds feel (0 in cool air). */
export function humidityTerm(rh, houseC) {
  const M = HEAT_MODEL;
  const h = M.rhK * Math.max(0, rh - M.rhFrom) + M.rhK2 * Math.max(0, rh - M.rhFrom2);
  return h * clamp01((houseC - M.rhTFrom) / M.rhTRamp);
}
/** Heat deaths per bird-hour at comfort e. */
export function heatDeathRate(e, age, weightG) {
  const d = e - deathFrom(age, weightG);
  return d > 0 ? Math.min(HEAT_MODEL.deathMax, HEAT_MODEL.deathK * d * d) : 0;
}
/** Share of birds panting at comfort e. */
export const pantingAt = (e, age) => clamp01(0.5 + (e - hotFrom(age)) / HEAT_MODEL.pantRamp);
/** Intake factor from the heat at comfort e. */
export const heatIntake = (e, age) => Math.max(HEAT_MODEL.intakeMin, 1 - HEAT_MODEL.intakeK * Math.max(0, e - hotFrom(age)));

// The house floor in 8 zones of 6 m along x (zone 0 at the pad end, west). Every floor cell centre.
export const ZONES = 8;
const NX = FLOOR_GRID.nx, NZ = FLOOR_GRID.nz;
const CELLS = [];
for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) {
  const x = FLOOR_GRID.x0 + (ix + 0.5) * FLOOR_GRID.cell, z = FLOOR_GRID.z0 + (iz + 0.5) * FLOOR_GRID.cell;
  CELLS.push({ x: Math.max(BIRD_BOUNDS.xMin, Math.min(BIRD_BOUNDS.xMax, x)), z, zone: Math.min(ZONES - 1, Math.floor((ix * ZONES) / NX)) });
}
export const zoneOfX = (x) => Math.max(0, Math.min(ZONES - 1, Math.floor(((x - FLOOR_GRID.x0) / (NX * FLOOR_GRID.cell)) * ZONES)));

/**
 * The heat state of a flock spread over the whole house (after the curtain lift), from the env alone.
 * @param {object} env  the sim env (houseTemp, houseRH, targetTemp, localTemp)
 * @param {{ age: number, weightG: number, cellFeel?: (x, z) => number }} o  cellFeel: extra °C per cell
 *        (the farm's litter term: wet litter chills), 0 by default
 * @returns {{ felt: number[], e: number[], eMean: number, feltMean: number, pantShare: number,
 *   deathPerH: number, fHeat: number, hotFrom: number, deathFrom: number }}  zone arrays of 8; shares
 *   of all birds (birds spread evenly over the floor)
 */
export function heatState(env, { age, weightG, cellFeel } = {}) {
  const h = humidityTerm(env.houseRH, env.houseTemp), tgt = env.targetTemp;
  const felt = new Array(ZONES).fill(0), n = new Array(ZONES).fill(0);
  let pant = 0, death = 0, fh = 0, fs = 0;
  for (const c of CELLS) {
    const f = env.localTemp(c.x, c.z) + h + (cellFeel ? cellFeel(c.x, c.z) : 0), e = f - tgt;
    felt[c.zone] += f; n[c.zone]++; fs += f;
    pant += pantingAt(e, age); death += heatDeathRate(e, age, weightG); fh += heatIntake(e, age);
  }
  for (let i = 0; i < ZONES; i++) felt[i] /= n[i] || 1;
  const N = CELLS.length;
  return { felt, e: felt.map((f) => f - tgt), feltMean: fs / N, eMean: fs / N - tgt, pantShare: pant / N, deathPerH: death / N, fHeat: fh / N,
    hotFrom: hotFrom(age), deathFrom: deathFrom(age, weightG) };
}

/**
 * The flock's heat and breath for the climate (Phase 2's figures, PHASE2.md §6.2): heat °C/h into the
 * house air; breath vapour g/h = 0.4 x the water drunk (daily mean here; the farm smooths over 6 h).
 */
export function flockLoads({ birds, weightG, age, houseC = 30 }) {
  if (!(birds > 0)) return { heatPerH: 0, vapourGh: 0 };
  const heatPerH = (0.2 * birds) / 6000 + (1.3 * birds * weightG) / (6000 * 2850);
  const drinkLh = (birds * feedStdGAt(age) * (1.75 + 0.03 * Math.max(0, houseC - 30))) / 1000 / 24;
  return { heatPerH, vapourGh: 0.4 * drinkLh * 1000 };
}

// Dust in the air (PHASE3.md §6.4; model): Dx = K x (age / 28) x (1 - house RH) x activity /
// (1 + airflow / REF). activity: 0.3 in the dark, 1.5 for the 4 hours after the lights come on (the
// birds feed and scratch), 1.0 the rest of the lit hours. Dx > 1: dusty air (look note, motes in the
// lamp light, a listen hears snicking); Dx > 1.5: a rattle in the breathing.
export const DUST = { K: 4.2, refM3h: 40000, darkActivity: 0.3, busyActivity: 1.5, busyHours: 4, dustyAbove: 1, rattleAbove: 1.5 };
export function birdActivity(env) {
  if (!env.lightsOn) return DUST.darkActivity;
  const lp = env.lightProgram || { darkStart: 2, darkHours: 1 };
  if (!(lp.darkHours > 0)) return 1;
  const since = ((((env.hour - (lp.darkStart + lp.darkHours)) % 24) + 24) % 24);
  return since < DUST.busyHours ? DUST.busyActivity : 1;
}
export function dustIndex(env, age) {
  return (DUST.K * Math.max(0, age / 28) * Math.max(0, 1 - env.houseRH / 100) * birdActivity(env)) / (1 + env.airflowM3h / DUST.refM3h);
}
