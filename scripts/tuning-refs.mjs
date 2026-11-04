// The Phase 4 climate references (PHASE4.md §2.3), run on the env alone with the Phase 4 responses of
// src/farm-tuning.js — no farm, no flock model. Contract data committed by the Phase 4 design; owner: package
// "sim" (the code may be improved; a band changes only with the integrator, recorded in PHASE4.md §2.6).
// scripts/test-tuning.mjs runs every reference now. When the sim package has wired farm-tuning.js into the farm,
// these replace scripts/cycle-refs.mjs CLIMATE_REFS / WINDOW_REFS (PHASE4.md §10.1) and the farm's own numbers at
// the same hours must land in the same bands (CYCLE_TARGETS snaps).
//
// The check flock is Phase 3's (5,900 birds at weightAt x 1.04, litter drying 45 g/h per m² at 0 % RH, brooders
// off from age 21, minimum ventilation by the sign table); its heat and breath come from flockLoadsP4 (the
// sensible heat x 2.5 fading in hot air, the water ratio from the birds' comfort).
import { createSim } from '../src/sim.js';
import { weightAt, minVentM3hPer1000, EQUIP, PLACEMENT_DAY } from '../src/config.js';
import { dustIndex } from '../src/farm-heat.js';
import { heatStateP4, flockLoadsP4 } from '../src/farm-tuning.js';
import { PLANS, EVENTS as EVENTS_P3, CHECK_FLOCK } from './cycle-refs.mjs';

// Phase 3's weather events of the levels, and the hot season's heat wave as the farm installs it (CONDITIONS.hot:
// +3 °C on the hot base, about 41 °C, PHASE4.md §4.1)
export const EVENTS = { ...EVENTS_P3, waveHot: { id: 'heat-wave', fromDay: 30 + 10 / 24, toDay: 32 + 19 / 24, outsideDrop: -3, heatPerH: 2 } };

const minVent = (env, w, birds) => {
  const a = env.day - PLACEMENT_DAY;
  env.setHeaterSetpoint(a >= 21 ? 15 : env.targetTemp);
  env.setVentTimer({ fans: 1, onSec: Math.round(Math.min(1, ((minVentM3hPer1000(w) * birds) / 1000) / EQUIP.fanM3h) * 300), cycleSec: 300 });
};
// Phase 4 plans (the Phase 3 ones of cycle-refs.mjs PLANS stay as they are)
/** The Phase 4 ideal: Phase 3's fan plan, and on warm evenings of big birds (from day 28, 18:00-21:00) every fan,
 *  with the pads while the outside air is at or over PAD_EVENING_ABOVE_C and the house RH at or under 90 % (the heat
 *  sign's evening line, PHASE4.md §2.4); from the 21:00 stop Phase 3's plan again (tunnel air all night). */
export const PAD_EVENING_ABOVE_C = 29.5;
const evening = (env, a) => a >= 21 && env.hour >= 18;
const P4 = {
  ideal(env, h, a, w, birds) {
    PLANS.ideal(env, h, a, w, birds);
    if (a >= 28 && h >= 18 && h < 21) { env.setFans(6); env.setPad(env.outsideTemp >= PAD_EVENING_ABOVE_C && env.houseRH <= 90); }
  },
  // the evening of day 37 from 18:00 with n tunnel fans (and the pad)
  eve3: (env, h, a, w, b) => { P4.ideal(env, h, a, w, b); if (evening(env, a)) { env.setFans(3); env.setPad(false); } },
  eve6: (env, h, a, w, b) => { P4.ideal(env, h, a, w, b); if (evening(env, a)) { env.setFans(6); env.setPad(false); } },
  eve6pad: (env, h, a, w, b) => { P4.ideal(env, h, a, w, b); if (evening(env, a)) { env.setFans(6); env.setPad(true); } },
  // young birds in the warm afternoon: the pad with n fans from 11:00 to 18:00
  pad1: (env, h, a, w, b) => { PLANS.ideal(env, h, a, w, b); if (h >= 11 && h < 18) { env.setFans(1); env.setPad(true); } },
  pad6: (env, h, a, w, b) => { PLANS.ideal(env, h, a, w, b); if (h >= 11 && h < 18) { env.setFans(6); env.setPad(true); } },
};
for (const k of ['minVent', 'fansNoPad', 'padInHumid', 'fans2', 'fans6']) P4[k] = PLANS[k];
// a power cut on day 33 at 15:00 for m minutes (no fans, no timer, no pad), the Phase 4 ideal before and after
for (const m of [15, 30, 120]) P4[`cut${m}`] = (env, h, a, w, b) => {
  const c0 = 33 + 15 / 24, c1 = c0 + m / 1440;
  if (env.day >= c0 - 1e-6 && env.day < c1 - 1e-6) { env.setFans(0); env.setVentTimer(null); env.setPad(false); return; }
  P4.ideal(env, h, a, w, b);
};
export const PLANS_P4 = P4;

/** An env at `fromDay` in level mode with the cycle climate, the check flock (Phase 4 loads) and events. */
export function makeEnvP4({ weather = 'normal', events = [], fromDay, broken = [], padWorking = 1, light } = {}) {
  const env = createSim();
  env.setLevelClimate(true); env.setCycleClimate(true); env.setWeather(weather);
  env.setDay(Math.floor(fromDay)); env.setHour((fromDay - Math.floor(fromDay)) * 24);
  env.houseTemp = 28; env.slabTemp = 27; env.setFansBroken(broken); env.padWorking = padWorking;
  env.setLightProgram(light || { darkStart: 22, darkHours: 6, dimmer: 0.35 });
  for (const e of events) env.addWeatherEvent(EVENTS[e]);
  const F = CHECK_FLOCK, w = () => weightAt(env.day - PLACEMENT_DAY) * F.weightShare, last = { eMean: 0 };
  env.addStepper((e) => {
    const L = flockLoadsP4({ birds: F.birds, weightG: w(), age: e.day - PLACEMENT_DAY, houseC: e.houseTemp, eMean: last.eMean });
    e.flockHeatPerH = L.heatPerH; e.vapourGh = L.vapourGh; e.dryPotentialGh = F.dryGhPerM2 * 576;
  });
  return { env, w, birds: F.birds, last };
}

/** Run a plan from `fromDay` to `toDay` in quarter hours: the state at toDay and the window's totals. */
export function runPlanP4(plan, o) {
  const W = makeEnvP4(o), { env } = W;
  let alive = 1, pantH = 0, coldH = 0, fh = 0, n = 0, last = null;
  while (env.day < o.toDay - 1e-9) {
    const h = env.hour, a = env.day - PLACEMENT_DAY, key = Math.round(h * 4);
    if (key !== last) { last = key; PLANS_P4[plan](env, h, a, W.w(), W.birds); }
    env.skipHours(Math.min(0.25, (o.toDay - env.day) * 24));
    const s = heatStateP4(env, { age: env.day - PLACEMENT_DAY, weightG: W.w() });
    W.last.eMean = s.eMean;
    alive *= 1 - (s.deathPerH + s.coldDeathPerH) * 0.25; pantH += s.pantShare * 0.25; coldH += s.coldShare * 0.25; fh += s.fHeat; n++;
  }
  const age = env.day - PLACEMENT_DAY, s = heatStateP4(env, { age, weightG: W.w() });
  return { env, s, age, deathsPct: (1 - alive) * 100, pantH, coldH, fHeat: n ? fh / n : 1, dust: dustIndex(env, age),
    houseC: env.houseTemp, rh: env.houseRH, outC: env.outsideTemp, outRh: env.outsideRH };
}

/**
 * State at an hour after the plan ran from 06:00 the day before (house °C, RH, felt mean, e (felt - target),
 * panting share, heat deaths %/h, wind chill °C). Bands [lo, hi]. `ofIdeal` keys compare with the id's ideal.
 */
export const CLIMATE_REFS_P4 = [
  // week 3: tunnel fans by the heat; minimum ventilation alone leaves them panting, without deaths
  { id: 'd18-15-ideal', day: 18, hour: 15, plan: 'ideal', expect: { houseC: [32, 33.6], feltC: [26.5, 29], pant: [0, 0.2], deathPerH: [0, 0.001] } },
  { id: 'd18-15-minVent', day: 18, hour: 15, plan: 'minVent', expect: { pant: [0.8, 1], deathPerH: [0, 0.005], fHeat: [0.85, 0.98] } },
  { id: 'd18-05-ideal', day: 18, hour: 5, plan: 'ideal', expect: { feltC: [24.5, 27.5], pant: [0, 0.05] } },
  // the warm afternoon of day 16: four fans leave birds panting (the symptom); six fans, or the pad with one fan,
  // bring them back; the pad with six fans chills them (the heat-handled rule refuses it)
  { id: 'd16-15-warm3-ideal', day: 16, hour: 15, plan: 'ideal', events: ['warm3'], expect: { pant: [0.2, 0.6], deathPerH: [0, 0.001] } },
  { id: 'd16-15-warm3-fans6', day: 16, hour: 15, plan: 'fans6', events: ['warm3'], expect: { pant: [0, 0.1], e: [-1.5, 2] } },
  { id: 'd16-15-warm3-pad1', day: 16, hour: 15, plan: 'pad1', events: ['warm3'], expect: { pant: [0, 0.05], e: [-1.5, 1.5] } },
  { id: 'd16-15-warm3-pad6', day: 16, hour: 15, plan: 'pad6', events: ['warm3'], expect: { e: [-8, -4], coldDeathPerH: [0.005, 0.05] } },
  // the first hot afternoon (day 25, about 36 °C outside, RH about 47 %)
  { id: 'd25-15-ideal', day: 25, hour: 15, plan: 'ideal', events: ['hot25'], expect: { outRh: [43, 51], houseC: [27.5, 29.5], rh: [80, 88], pant: [0, 0.1], deathPerH: [0, 0.001] } },
  { id: 'd25-15-fansNoPad', day: 25, hour: 15, plan: 'fansNoPad', events: ['hot25'], expect: { houseC: [35, 37], pant: [0.8, 1], deathPerH: [0, 0.05] } },
  { id: 'd25-15-minVent', day: 25, hour: 15, plan: 'minVent', events: ['hot25'], expect: { pant: [1, 1], deathPerH: [0.3, 1] } },
  // the heat wave (day 31, about 39 °C, RH about 40 %): moving air cools little in 39 °C air, the pads decide
  { id: 'd31-15-ideal', day: 31, hour: 15, plan: 'ideal', events: ['wave'], expect: { outRh: [36, 44], houseC: [28.8, 31], rh: [76, 87], feltC: [23, 26.5], pant: [0, 0.2], deathPerH: [0, 0.001] } },
  { id: 'd31-15-fansNoPad', day: 31, hour: 15, plan: 'fansNoPad', events: ['wave'], expect: { houseC: [38, 40.5], windChill: [1, 2.5], pant: [1, 1], deathPerH: [0.8, 2.5] } },
  { id: 'd31-15-minVent', day: 31, hour: 15, plan: 'minVent', events: ['wave'], expect: { houseC: [39, 42], deathPerH: [2, 3] } },
  // the hot humid day (33 °C and 85 % outside): the pads add more damp than cool
  { id: 'd33-15-ideal', day: 33, hour: 15, plan: 'ideal', events: ['humid'], expect: { houseC: [32, 33.6], rh: [84, 89], pant: [0.6, 1], deathPerH: [0, 0.001] } },
  { id: 'd33-15-padInHumid', day: 33, hour: 15, plan: 'padInHumid', events: ['humid'], expect: { rh: [94, 99], feltOverIdeal: [1.5, 3.5], deathPerH: [0, 0.1] } },
  // normal afternoons of big birds: six fans and the pads keep them comfortable; fans alone leave most panting
  { id: 'd35-15-ideal', day: 35, hour: 15, plan: 'ideal', expect: { outRh: [50, 58], houseC: [26, 28.5], rh: [84, 90], feltC: [21, 24], pant: [0, 0.05], deathPerH: [0, 0.001] } },
  { id: 'd35-15-fansNoPad', day: 35, hour: 15, plan: 'fansNoPad', expect: { windChill: [4.8, 6], pant: [0.6, 1], deathPerH: [0, 0.01] } },
  { id: 'd41-15-ideal', day: 41, hour: 15, plan: 'ideal', expect: { feltC: [21, 24], pant: [0, 0.05], deathPerH: [0, 0.001] } },
  // nights of big birds: tunnel air all night; minimum ventilation alone leaves them panting (their own heat)
  { id: 'd41-05-ideal', day: 41, hour: 5, plan: 'ideal', expect: { feltC: [18.5, 22], pant: [0, 0.05] } },
  { id: 'd41-05-fans2', day: 41, hour: 5, plan: 'fans2', expect: { pant: [0, 0.3], deathPerH: [0, 0.001] } },
  { id: 'd41-05-minVent', day: 41, hour: 5, plan: 'minVent', expect: { houseC: [27.5, 30.5], pant: [0.7, 1], deathPerH: [0, 0.005] } },
  // the evening of day 37 (the Phase 3 check's item): the outside air is still 31 °C at 19:00
  { id: 'd37-19-eve3', day: 37, hour: 19, plan: 'eve3', expect: { pant: [0.7, 1], deathPerH: [0, 0.001] } },
  { id: 'd37-22-eve3', day: 37, hour: 22, plan: 'eve3', expect: { pant: [0.1, 0.45] } },
  { id: 'd37-19-eve6', day: 37, hour: 19, plan: 'eve6', expect: { pant: [0.15, 0.5] } },
  { id: 'd37-21-eve6', day: 37, hour: 21, plan: 'eve6', expect: { pant: [0, 0.1] } },
  { id: 'd37-19-eve6pad', day: 37, hour: 19, plan: 'eve6pad', expect: { pant: [0, 0.05], e: [-1.5, 3] } },
  { id: 'd37-19-ideal', day: 37, hour: 19, plan: 'ideal', expect: { pant: [0, 0.05] } },
  // the hot finishing afternoon (day 38, about 37 °C)
  { id: 'd38-15-ideal', day: 38, hour: 15, plan: 'ideal', events: ['hot38'], expect: { pant: [0, 0.3], deathPerH: [0, 0.001] } },
  { id: 'd38-15-fansNoPad', day: 38, hour: 15, plan: 'fansNoPad', events: ['hot38'], expect: { deathPerH: [0.25, 0.8] } },
  // the hot season (PHASE4.md §4.1: 28-38 °C, about 80 % at dawn and 47 % at 15:00): the pads decide every afternoon
  { id: 'hot-d25-15-ideal', weather: 'hot', day: 25, hour: 15, plan: 'ideal', expect: { outC: [37, 39], outRh: [43, 52], pant: [0, 0.15], deathPerH: [0, 0.001] } },
  { id: 'hot-d25-15-fansNoPad', weather: 'hot', day: 25, hour: 15, plan: 'fansNoPad', expect: { pant: [1, 1], deathPerH: [0.1, 0.6] } },
  { id: 'hot-d37-19-eve6pad', weather: 'hot', day: 37, hour: 19, plan: 'eve6pad', expect: { pant: [0.1, 0.6], deathPerH: [0, 0.001] } },
  { id: 'hot-d37-19-eve6', weather: 'hot', day: 37, hour: 19, plan: 'eve6', expect: { pant: [0.9, 1], deathPerH: [0.01, 0.2] } },
  // the rainy season (24-30 °C, about 96 % at dawn and 69 % at 15:00): little heat, little pad cooling
  { id: 'rainy-d33-15-ideal', weather: 'rainy', day: 33, hour: 15, plan: 'ideal', expect: { outC: [29, 31], outRh: [64, 74], pant: [0, 0.2] } },
  { id: 'rainy-d37-05-ideal', weather: 'rainy', day: 37, hour: 5, plan: 'ideal', expect: { outRh: [92, 100], rh: [85, 98], feltC: [18.5, 22.5] } },
];

/** Totals over a window: deaths % (heat and cold), panting bird-hours per bird, mean heat intake factor. */
export const WINDOW_REFS_P4 = [
  { id: 'week3-ideal', from: 15.25, to: 22.25, plan: 'ideal', expect: { deathsPct: [0, 0.01], pantH: [0, 15] } },
  { id: 'week3-minVent', from: 15.25, to: 22.25, plan: 'minVent', expect: { deathsPct: [0, 0.15], pantH: [50, 110] } },
  { id: 'warm3-pad6', from: 16.25, to: 17.25, plan: 'pad6', events: ['warm3'], expect: { deathsPct: [0.02, 0.3], coldH: [3, 8] } },
  { id: 'hot25-ideal', from: 25.25, to: 26.25, plan: 'ideal', events: ['hot25'], expect: { deathsPct: [0, 0.01] } },
  { id: 'hot25-minVent', from: 25.25, to: 26.25, plan: 'minVent', events: ['hot25'], expect: { deathsPct: [0.8, 3] } },
  { id: 'weeks45-normal-ideal', from: 22.25, to: 36.25, plan: 'ideal', expect: { deathsPct: [0, 0.02], pantH: [1, 20] } },
  { id: 'weeks45-normal-fansNoPad', from: 22.25, to: 36.25, plan: 'fansNoPad', expect: { deathsPct: [0, 0.05], pantH: [15, 60] } },
  { id: 'weeks45-normal-minVent', from: 22.25, to: 36.25, plan: 'minVent', expect: { deathsPct: [8, 40] } },
  { id: 'wave-ideal', from: 30.25, to: 33.25, plan: 'ideal', events: ['wave'], expect: { deathsPct: [0, 0.05], pantH: [0.3, 8] } },
  { id: 'wave-fan4-broken', from: 30.25, to: 33.25, plan: 'ideal', events: ['wave'], broken: [3], expect: { deathsPct: [0, 0.1], pantHOverIdeal: [1.5, 6] } },
  { id: 'wave-pad-clogged', from: 30.25, to: 33.25, plan: 'ideal', events: ['wave'], padWorking: 0.67, expect: { deathsPct: [0, 0.1], pantHOverIdeal: [2.5, 12] } },
  { id: 'wave-fansNoPad', from: 30.25, to: 33.25, plan: 'fansNoPad', events: ['wave'], expect: { deathsPct: [8, 30] } },
  { id: 'wave-minVent', from: 30.25, to: 33.25, plan: 'minVent', events: ['wave'], expect: { deathsPct: [40, 100] } },
  { id: 'humid-ideal', from: 33.25, to: 34.25, plan: 'ideal', events: ['humid'], expect: { deathsPct: [0, 0.02] } },
  { id: 'humid-padInHumid', from: 33.25, to: 34.25, plan: 'padInHumid', events: ['humid'], expect: { deathsPct: [0, 0.3], fHeatUnderIdeal: [0.003, 0.08] } },
  { id: 'hot38-ideal', from: 38.25, to: 39.25, plan: 'ideal', events: ['hot38'], expect: { deathsPct: [0, 0.01] } },
  { id: 'hot38-fansNoPad', from: 38.25, to: 39.25, plan: 'fansNoPad', events: ['hot38'], expect: { deathsPct: [0.4, 2] } },
  // a power cut on day 33 at 15:00 (rainy season's storm, PHASE4.md §4.2): deaths to the next 06:00 by how long it lasts
  { id: 'cut15', from: 33.25, to: 34.25, plan: 'cut15', expect: { deathsPct: [0, 0.2] } },
  { id: 'cut30', from: 33.25, to: 34.25, plan: 'cut30', expect: { deathsPct: [0.1, 0.6] } },
  { id: 'cut120', from: 33.25, to: 34.25, plan: 'cut120', expect: { deathsPct: [1.5, 4] } },
  // the hot season's heat wave (+3 °C on the hot base, about 41 °C): the pads decide
  { id: 'hot-wave-ideal', weather: 'hot', from: 30.25, to: 33.25, plan: 'ideal', events: ['waveHot'], expect: { deathsPct: [0, 0.1], pantH: [2, 20] } },
  { id: 'hot-wave-fansNoPad', weather: 'hot', from: 30.25, to: 33.25, plan: 'fansNoPad', events: ['waveHot'], expect: { deathsPct: [15, 60] } },
];
void minVent;
