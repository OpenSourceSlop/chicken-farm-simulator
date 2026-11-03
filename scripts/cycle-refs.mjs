// The heat and growth references of PHASE3.md §6.1 / §6.3 / §6.4, run on the env alone (sim.js with the
// cycle climate, src/farm-heat.js, config feedStdGAt / feedPerGainAt) — no farm, no flock model. Contract
// data committed by the integrator; owner: package "sim". scripts/test-cycle.mjs runs every reference now
// (the climate check), and the sim package's farm must land in the same bands at the same hours
// (CYCLE_TARGETS snaps). Change a band only with the integrator, and record why in PHASE3.md §6.16.
//
// The flock in the check: 5,900 birds at weightAt(age) x 1.04 (the ideal's curve), Phase 2's heat
// (farm-heat flockLoads), litter drying 45 g/h per m² at 0 % RH, brooders off from age 21 (setpoint by
// the target before), minimum ventilation by the sign table all day (one timer fan, 300 s cycle).
import { createSim } from '../src/sim.js';
import { weightAt, minVentM3hPer1000, EQUIP, PLACEMENT_DAY, feedStdGAt, feedPerGainAt } from '../src/config.js';
import { heatState, flockLoads, dustIndex } from '../src/farm-heat.js';

export const CHECK_FLOCK = { birds: 5900, weightShare: 1.04, dryGhPerM2: 45 };

// Weather events of the levels as the farm installs them (config LEVELS problems → env events).
export const EVENTS = {
  warm3: { id: 'warm-afternoon3', fromDay: 16 + 11 / 24, toDay: 16 + 17 / 24, outsideDrop: -2, heatPerH: 1 },
  dusty: { id: 'dusty-air', fromDay: 23 + 4 / 24, toDay: 24 + 18 / 24, outsideDrop: 0, rhDrop: 30 },
  hot25: { id: 'hot-afternoon', fromDay: 25 + 11 / 24, toDay: 25 + 17 / 24, outsideDrop: -3, heatPerH: 1.5 },
  wave: { id: 'heat-wave', fromDay: 30 + 10 / 24, toDay: 32 + 19 / 24, outsideDrop: -6, heatPerH: 2 },
  humid: { id: 'humid-heat', fromDay: 33 + 10 / 24, toDay: 33 + 18 / 24, outsideDrop: 0, rh: 85 },
  hot38: { id: 'hot-finish', fromDay: 38 + 11 / 24, toDay: 38 + 17 / 24, outsideDrop: -4, heatPerH: 1.5 },
};

function minVent(env, w, birds) {
  const a = env.day - PLACEMENT_DAY;
  env.setHeaterSetpoint(a >= 21 ? 15 : env.targetTemp);
  const m3h = (minVentM3hPer1000(w) * birds) / 1000;
  env.setVentTimer({ fans: 1, onSec: Math.round(Math.min(1, m3h / EQUIP.fanM3h) * 300), cycleSec: 300 });
}
/** The ideal's fan plan with the base controls (no stages), at its stops (PHASE3.md §6.3, §6.14). */
export const IDEAL_STOPS = [6.25, 9, 11, 13.25, 15.5, 18.5, 21];
export function idealFans(env, age) {
  const over = env.outsideTemp - env.targetTemp;
  if (age >= 21) return Math.max(0, Math.min(6, Math.ceil((over - 1) / 1.2)));
  if (age >= 14) return Math.max(0, Math.min(4, Math.round(over / 1.5)));
  return 0;
}
/** Pads: on with six fans when the outside is 10 °C or more over the target and its RH under 75 %;
 *  off again when the house RH goes over 90 % (the pad plate's limit) or the heat is gone. */
export function idealPad(env, fans) {
  const want = fans >= 6 && env.outsideTemp - env.targetTemp >= 10;
  if (env.padOn && (env.houseRH > 90 || !want)) return false;
  if (!env.padOn && want && env.outsideRH < 75) return true;
  return env.padOn;
}
export const PLANS = {
  ideal(env, h, a, w, birds) {
    minVent(env, w, birds);
    if (!IDEAL_STOPS.some((s) => Math.abs(h - s) < 0.13)) return;
    const fans = idealFans(env, a);
    env.setFans(fans); env.setPad(idealPad(env, fans));
  },
  minVent(env, h, a, w, birds) { minVent(env, w, birds); env.setFans(0); env.setPad(false); },
  fansNoPad(env, h, a, w, birds) { PLANS.ideal(env, h, a, w, birds); env.setPad(false); },
  padInHumid(env, h, a, w, birds) { PLANS.ideal(env, h, a, w, birds); if (env.fansManual >= 6 && h >= 10 && h < 18) env.setPad(true); },
  fans2(env, h, a, w, birds) { minVent(env, w, birds); env.setFans(2); env.setPad(false); },
  fans6(env, h, a, w, birds) { minVent(env, w, birds); env.setFans(6); env.setPad(false); },
};

/** An env at `fromDay` (float) in level mode with the cycle climate, the check flock and events. */
export function makeEnv({ weather = 'normal', events = [], fromDay, broken = [], padWorking = 1, light } = {}) {
  const env = createSim();
  env.setLevelClimate(true); env.setCycleClimate(true); env.setWeather(weather);
  env.setDay(Math.floor(fromDay)); env.setHour((fromDay - Math.floor(fromDay)) * 24);
  env.houseTemp = 28; env.slabTemp = 27; env.setFansBroken(broken); env.padWorking = padWorking;
  env.setLightProgram(light || { darkStart: 22, darkHours: 6, dimmer: 0.35 });
  for (const e of events) env.addWeatherEvent(EVENTS[e]);
  const F = CHECK_FLOCK, w = () => weightAt(env.day - PLACEMENT_DAY) * F.weightShare;
  env.addStepper((e) => {
    const L = flockLoads({ birds: F.birds, weightG: w(), age: e.day - PLACEMENT_DAY, houseC: e.houseTemp });
    e.flockHeatPerH = L.heatPerH; e.vapourGh = L.vapourGh; e.dryPotentialGh = F.dryGhPerM2 * 576;
  });
  return { env, w, birds: F.birds };
}

/**
 * Run a plan from `fromDay` to `toDay` in quarter hours. Returns the state at toDay and, over the run,
 * heat deaths (% of the birds, compounding), panting bird-hours per bird and the mean heat intake factor.
 */
export function runPlan(plan, o) {
  const W = makeEnv(o), { env } = W;
  let alive = 1, pantH = 0, fh = 0, n = 0, last = null;
  while (env.day < o.toDay - 1e-9) {
    const h = env.hour, a = env.day - PLACEMENT_DAY, key = Math.round(h * 4);
    if (key !== last) { last = key; PLANS[plan](env, h, a, W.w(), W.birds); }
    env.skipHours(Math.min(0.25, (o.toDay - env.day) * 24));
    const s = heatState(env, { age: env.day - PLACEMENT_DAY, weightG: W.w() });
    alive *= 1 - s.deathPerH * 0.25; pantH += s.pantShare * 0.25; fh += s.fHeat; n++;
  }
  const age = env.day - PLACEMENT_DAY, s = heatState(env, { age, weightG: W.w() });
  return { env, s, age, deathsPct: (1 - alive) * 100, pantH, fHeat: n ? fh / n : 1, dust: dustIndex(env, age),
    houseC: env.houseTemp, rh: env.houseRH, outC: env.outsideTemp, outRh: env.outsideRH };
}

/**
 * The §6.3 references: state at an hour (house °C, house RH, felt mean, panting share, heat deaths per
 * hour in % of the birds) after the plan ran from 06:00 the day before. Bands [lo, hi].
 */
export const CLIMATE_REFS = [
  // week 3 (normal weather, 33 °C afternoons): tunnel fans by the heat, never deaths with minimum ventilation only
  { id: 'd18-15-ideal', day: 18, hour: 15, plan: 'ideal', expect: { houseC: [32, 33.6], feltC: [28, 30.4], pant: [0, 0.35], deathPerH: [0, 0.001] } },
  { id: 'd18-15-minvent', day: 18, hour: 15, plan: 'minVent', expect: { pant: [0.8, 1], deathPerH: [0, 0.001], fHeat: [0.9, 0.98] } },
  { id: 'd18-05-ideal', day: 18, hour: 5, plan: 'ideal', expect: { feltC: [25.5, 28.5], pant: [0, 0] } },
  { id: 'd21-15-minvent', day: 21, hour: 15, plan: 'minVent', expect: { pant: [0.8, 1], deathPerH: [0, 0.005] } },
  // the warm afternoon of week 3 (day 16): the ideal's usual four fans leave birds panting (the symptom);
  // all six fans bring them back (its fix)
  { id: 'd16-15-warm3-ideal', day: 16, hour: 15, plan: 'ideal', events: ['warm3'], expect: { pant: [0.3, 0.8], deathPerH: [0, 0.001] } },
  { id: 'd16-15-warm3-fans6', day: 16, hour: 15, plan: 'fans6', events: ['warm3'], expect: { pant: [0, 0.1], deathPerH: [0, 0.001] } },
  // the first hot afternoon (day 25, about 36 °C outside, RH about 47 %)
  { id: 'd25-15-ideal', day: 25, hour: 15, plan: 'ideal', events: ['hot25'], expect: { outRh: [43, 51], houseC: [27.5, 29.5], rh: [80, 88], pant: [0, 0.1], deathPerH: [0, 0.001] } },
  { id: 'd25-15-fansNoPad', day: 25, hour: 15, plan: 'fansNoPad', events: ['hot25'], expect: { houseC: [35, 37], pant: [0.9, 1], deathPerH: [0, 0.02] } },
  { id: 'd25-15-minvent', day: 25, hour: 15, plan: 'minVent', events: ['hot25'], expect: { pant: [1, 1], deathPerH: [0.3, 1] } },
  // the heat wave (day 31, about 39 °C outside, RH about 40 %)
  { id: 'd31-15-ideal', day: 31, hour: 15, plan: 'ideal', events: ['wave'], expect: { outRh: [36, 44], houseC: [28.8, 31], rh: [76, 87], feltC: [25, 27.5], pant: [0, 0.3], deathPerH: [0, 0.001] } },
  { id: 'd31-15-fansNoPad', day: 31, hour: 15, plan: 'fansNoPad', events: ['wave'], expect: { houseC: [38, 40.5], pant: [1, 1], deathPerH: [0.5, 1.5] } },
  { id: 'd31-15-minvent', day: 31, hour: 15, plan: 'minVent', events: ['wave'], expect: { houseC: [39, 42], deathPerH: [2, 3] } },
  // the hot humid day (day 33, 33 °C and 85 % outside): the pads add more damp than cool
  { id: 'd33-15-ideal', day: 33, hour: 15, plan: 'ideal', events: ['humid'], expect: { houseC: [32, 33.6], rh: [84, 89], pant: [0.9, 1], deathPerH: [0, 0.001] } },
  { id: 'd33-15-padInHumid', day: 33, hour: 15, plan: 'padInHumid', events: ['humid'], expect: { rh: [94, 99], feltOverIdeal: [1.5, 3.5], deathPerH: [0.05, 0.4] } },
  // normal afternoons of big birds: six fans and the pads keep them comfortable
  { id: 'd35-15-ideal', day: 35, hour: 15, plan: 'ideal', expect: { outRh: [50, 58], houseC: [26, 28], rh: [84, 90], feltC: [23, 25.5], pant: [0, 0.05], deathPerH: [0, 0.001] } },
  { id: 'd35-15-fansNoPad', day: 35, hour: 15, plan: 'fansNoPad', expect: { pant: [0.9, 1], deathPerH: [0, 0.01] } },
  { id: 'd41-15-ideal', day: 41, hour: 15, plan: 'ideal', expect: { feltC: [23, 25.5], pant: [0, 0.05], deathPerH: [0, 0.001] } },
  // nights of big birds: some tunnel air all night; minimum ventilation alone leaves them panting
  { id: 'd41-05-ideal', day: 41, hour: 5, plan: 'ideal', expect: { feltC: [20.5, 24], pant: [0, 0.05], deathPerH: [0, 0.001] } },
  { id: 'd41-05-fans2', day: 41, hour: 5, plan: 'fans2', expect: { pant: [0, 0.6], deathPerH: [0, 0.001] } },
  { id: 'd41-05-minvent', day: 41, hour: 5, plan: 'minVent', expect: { pant: [0.8, 1], deathPerH: [0, 0.001] } },
  // the hot finishing afternoon (day 38, about 37 °C)
  { id: 'd38-15-ideal', day: 38, hour: 15, plan: 'ideal', events: ['hot38'], expect: { pant: [0.1, 0.6], deathPerH: [0, 0.001] } },
  { id: 'd38-15-fansNoPad', day: 38, hour: 15, plan: 'fansNoPad', events: ['hot38'], expect: { deathPerH: [0.25, 0.8] } },
  // dust (§6.4): the dry spell from day 23 04:00; feeding hours after the lights come on at 04:00
  { id: 'd23-07-dust-minvent', day: 23, hour: 7, plan: 'minVent', events: ['dusty'], expect: { dust: [1.5, 1.9] } },
  { id: 'd23-14-dust-minvent', day: 23, hour: 14, plan: 'minVent', events: ['dusty'], expect: { dust: [1.3, 1.9] } },
  { id: 'd23-14-dust-fans2', day: 23, hour: 14, plan: 'fans2', events: ['dusty'], expect: { dust: [0, 1] } },
  { id: 'd22-14-nodust-minvent', day: 22, hour: 14, plan: 'minVent', expect: { dust: [0, 0.95] } },
];

/** Totals over a window: heat deaths %, panting bird-hours per bird, mean heat intake factor. */
export const WINDOW_REFS = [
  { id: 'week3-ideal', from: 15.25, to: 22.25, plan: 'ideal', expect: { deathsPct: [0, 0.01], pantH: [0, 12] } },
  { id: 'week3-minvent', from: 15.25, to: 22.25, plan: 'minVent', expect: { deathsPct: [0, 0.05], pantH: [40, 90], fHeat: [0.97, 0.99] } },
  { id: 'hot25-ideal', from: 25.25, to: 26.25, plan: 'ideal', events: ['hot25'], expect: { deathsPct: [0, 0.01] } },
  { id: 'hot25-minvent', from: 25.25, to: 26.25, plan: 'minVent', events: ['hot25'], expect: { deathsPct: [1, 3] } },
  { id: 'weeks45-normal-ideal', from: 22.25, to: 36.25, plan: 'ideal', expect: { deathsPct: [0, 0.02], pantH: [5, 40] } },
  { id: 'weeks45-normal-fansNoPad', from: 22.25, to: 36.25, plan: 'fansNoPad', expect: { deathsPct: [0, 0.05], pantH: [50, 100] } },
  { id: 'weeks45-normal-minvent', from: 22.25, to: 36.25, plan: 'minVent', expect: { deathsPct: [4, 20] } },
  { id: 'wave-ideal', from: 30.25, to: 33.25, plan: 'ideal', events: ['wave'], expect: { deathsPct: [0, 0.05], pantH: [1, 10] } },
  { id: 'wave-fan4-broken', from: 30.25, to: 33.25, plan: 'ideal', events: ['wave'], broken: [3], expect: { deathsPct: [0, 0.1], pantHOverIdeal: [2, 6] } },
  { id: 'wave-pad-clogged', from: 30.25, to: 33.25, plan: 'ideal', events: ['wave'], padWorking: 0.67, expect: { deathsPct: [0, 0.1], pantHOverIdeal: [3, 10] } },
  { id: 'wave-fansNoPad', from: 30.25, to: 33.25, plan: 'fansNoPad', events: ['wave'], expect: { deathsPct: [6, 20] } },
  { id: 'wave-minvent', from: 30.25, to: 33.25, plan: 'minVent', events: ['wave'], expect: { deathsPct: [40, 100] } },
  { id: 'humid-ideal', from: 33.25, to: 34.25, plan: 'ideal', events: ['humid'], expect: { deathsPct: [0, 0.02] } },
  { id: 'humid-padInHumid', from: 33.25, to: 34.25, plan: 'padInHumid', events: ['humid'], expect: { deathsPct: [0.15, 1], fHeatUnderIdeal: [0.005, 0.05] } },
  { id: 'hot38-ideal', from: 38.25, to: 39.25, plan: 'ideal', events: ['hot38'], expect: { deathsPct: [0, 0.01] } },
  { id: 'hot38-fansNoPad', from: 38.25, to: 39.25, plan: 'fansNoPad', events: ['hot38'], expect: { deathsPct: [0.5, 2] } },
];

/** Growth with every intake factor at `f` (gain = feed ÷ feed per gain, PHASE3.md §6.1). */
export function growthAt(age, f = 1) {
  let w = 41.5, feed = 0;
  const dt = 1 / 96;
  for (let a = 0; a < age - 1e-9; a += dt) { const fi = feedStdGAt(a) * f * dt; feed += fi; w += fi / feedPerGainAt(a); }
  return { weightG: w, feedG: feed };
}
/** Weigh days, the ideal's band (factors 0.97) as a share of weightAt, and the 90 % fail line. */
export const GROWTH_REFS = {
  weighDays: [7, 14, 21, 28, 35, 41.75],
  idealShare: [1.035, 1.075],     // the ideal (factors 0.97) on every weigh day: 3.5-7.5 % over the target
  fullShare: [1.06, 1.1],         // every factor 1
  harvestShrink: 0.98,            // expected shrink at a 10 h withdrawal (§6.6); the harvest target is judged after it
};
