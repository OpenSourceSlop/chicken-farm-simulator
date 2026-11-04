// The climate references of the Phase 4 conditions (PHASE4.md §4), run on the env alone with the Phase 4 responses
// (src/farm-tuning.js) — no farm, no flock model. Contract data of the Phase 4 design; owner: package "sim" (the code
// may be improved; a band changes only with the integrator, recorded in PHASE4.md §2.7). scripts/test-tuning.mjs runs
// every reference now; the sim package's farm must land in the same bands at the same hours (scripts/test-cond.mjs).
//   BROOD_REFS_P4   the hot season's brooding week (Phase 2's chick comfort and heat deaths, the daily sun)
//   COND_CLIMATE_P4 / COND_WINDOWS_P4   the hot season's weeks 2-6 (the young birds' afternoons, the nights)
//   CUT_REFS_P4     the rainy season's power cut in storm-33 (cut at 15:10), deaths to the next 06:00 by minutes
//   TANK_REFS_P4    the water condition's tank and well pump (weeks 4-5, the normal season's heat)
import { createSim, wetBulbOf } from '../src/sim.js';
import { weightAt, minVentM3hPer1000, EQUIP, PLACEMENT_DAY, PAD_EFF, feedStdGAt, WATER_TANK, CONDITIONS, targetTempAt } from '../src/config.js';
import { flockLoads } from '../src/farm-heat.js';
import { comfortNow } from '../src/farm-comfort.js';
import { heatStateP4, waterPerKgP4 } from '../src/farm-tuning.js';
import { makeEnvP4, PLANS_P4, addSun, EVENTS } from './tuning-refs.mjs';

const H = 1 / 24;
// ---------------- the hot season's brooding week (PHASE4.md §4.1) ----------------
// 5,950 chicks placed at 08:00 day 0 at weightAt(age); before that the empty house (the prep day's pre-heat).
// Brooders by the sign (setpoint the row, to 0.5 °C) and the sign's timer (1 fan, 300 s, the table for the birds)
// in every plan. Phase 2's chick comfort (farm-comfort comfortNow: Phase 2's wind chill, the brooding week keeps it
// in every condition) and heat deaths (0.0003 x (meanOver - 4)² an hour). Plans for 11:00-18:00 every day:
//   sign  nothing more (hotNoBroodAir)         warm  Phase 2's warm timer (2 fans, 120 s in 300 s)
//   pad1  the pad with one tunnel fan (hot:ideal)   pad2  the pad with two tunnel fans
const BROOD = { birds: 5950, dryGhPerM2: 45, broodM2: 288 };
const signTimer = (w, birds) => ({ fans: 1, onSec: Math.max(1, Math.round((((minVentM3hPer1000(w) * birds) / 1000) / EQUIP.fanM3h) * 300)), cycleSec: 300 });
const BROOD_PLANS = {
  sign: () => {},
  warm: (env, h) => { if (h >= 11 && h < 17) env.setVentTimer({ fans: 2, onSec: 120, cycleSec: 300 }); },
  pad1: (env, h) => { const on = h >= 11 && h < 18; env.setFans(on ? 1 : 0); env.setPad(on); },
  pad2: (env, h) => { const on = h >= 11 && h < 18; env.setFans(on ? 2 : 0); env.setPad(on); },
};
export function runBroodP4(plan, { weather = 'hot', toDay = 7 + 8 * H, report = [] } = {}) {
  const env = createSim();
  env.setLevelClimate(true); env.setCycleClimate(true); env.setWeather(weather);
  env.setDay(-1); env.setHour(7); env.houseTemp = 23; env.slabTemp = 23;           // farm.start's prep day
  env.setLightProgram({ darkStart: 2, darkHours: 1, dimmer: 1 });
  addSun(env, CONDITIONS[weather]?.sun, -1, toDay);
  const age = () => env.day - PLACEMENT_DAY, placed = () => age() >= 0, w = () => weightAt(Math.max(0, age()));
  env.addStepper((e) => {
    const L = placed() ? flockLoads({ birds: BROOD.birds, weightG: w(), age: age(), houseC: e.houseTemp }) : { heatPerH: 0, vapourGh: 0 };
    e.flockHeatPerH = L.heatPerH; e.vapourGh = L.vapourGh; e.dryPotentialGh = BROOD.dryGhPerM2 * BROOD.broodM2;
  });
  const C = {};
  let deaths = 0, inBand = 0, n = 0, pmOk = 0, pmN = 0, gasH = 0, last = null;
  const at = {};
  while (env.day < toDay - 1e-9) {
    const key = Math.round(env.hour * 4);
    if (key !== last) {
      last = key;
      env.setHeaterSetpoint(Math.round(targetTempAt(env.dayNumber) * 2) / 2);
      env.setFans(0); env.setPad(false); env.setVentTimer(signTimer(placed() ? w() : 41.5, 6000));
      BROOD_PLANS[plan](env, env.hour);
    }
    env.skipHours(0.25);
    gasH += env.heaterLevel * 0.25;
    if (!placed()) continue;
    comfortNow(env, C, { age: age() });
    if (C.meanOver > 4) deaths += 0.0003 * (C.meanOver - 4) ** 2 * 0.25;
    n++; if (C.e >= -1.5 && C.e <= 2) inBand++;
    if (env.hour >= 14 && env.hour < 18) { pmN++; if (C.e >= -1.5 && C.e <= 1.5) pmOk++; }
    for (const [d, hr] of report) if (env.dayNumber === d && Math.abs(env.hour - hr) < 0.01) at[`d${d}-${hr}`] = { houseC: env.houseTemp, rh: env.houseRH, e: C.e, meanOver: C.meanOver, heater: env.heaterLevel };
  }
  return { env, at, deathsPct: deaths * 100, comfortShare: inBand / Math.max(1, n), pmNearShare: pmOk / Math.max(1, pmN), brooderH: gasH };
}
/** The chicks' comfort e at an hour (deaths and shares over days 0-7). Bands [lo, hi]; `of` compares with a plan. */
export const BROOD_REFS_P4 = [
  // the closed house on the sign's timer runs 4-6 °C over the row by 15:00 from day 3: heat deaths, out of the band
  { id: 'hot-brood-sign', plan: 'sign', at: { 'd3-15': { e: [3.5, 6] }, 'd6-15': { e: [5, 7.5] }, 'd1-15': { e: [2, 4.5] } }, expect: { deathsPct: [0.8, 3], pmNearShare: [0, 0.1] } },
  // Phase 2's warm timer brings in 37-38 °C air: no better than the closed house
  { id: 'hot-brood-warm', plan: 'warm', at: { 'd6-15': { e: [4.5, 7.5] } }, expect: { deathsPct: [0.5, 3], pmNearShare: [0, 0.15] } },
  // the pad with one tunnel fan keeps the chicks near their row (hot:ideal), the brooders burn only in the cool hours
  { id: 'hot-brood-pad1', plan: 'pad1', at: { 'd1-15': { e: [-1.5, 1.5] }, 'd3-15': { e: [-1.5, 1.5] }, 'd6-15': { e: [-1.5, 1.5] }, 'd6-17': { e: [-1.5, 1.5] } },
    expect: { deathsPct: [0, 0.01], pmNearShare: [0.75, 1], comfortShare: [0.85, 1] } },
  // two fans and the pad chill them
  { id: 'hot-brood-pad2', plan: 'pad2', at: { 'd3-15': { e: [-5, -1.5] } }, expect: { deathsPct: [0, 0.01], pmNearShare: [0, 0.5] } },
];

// ---------------- the hot season, weeks 2-6 (the Phase 4 responses, the daily sun) ----------------
/** As tuning-refs CLIMATE_REFS_P4 (the plan from 06:00 the day before): weather 'hot'. */
export const COND_CLIMATE_P4 = [
  // week 2: Phase 3's plan has no tunnel fans before day 14: the young birds overheat every afternoon
  { id: 'hot-d9-15-ideal', weather: 'hot', day: 9, hour: 15, plan: 'ideal', expect: { e: [4.5, 7], pant: [0.9, 1] } },
  { id: 'hot-d12-15-ideal', weather: 'hot', day: 12, hour: 15, plan: 'ideal', expect: { e: [6, 9.5], deathPerH: [0.1, 0.6] } },
  // the pad with one tunnel fan (two from day 12): near the target, none chilled
  { id: 'hot-d9-15-young', weather: 'hot', day: 9, hour: 15, plan: 'hotYoung', expect: { e: [-1.5, 1], pant: [0, 0.05] } },
  { id: 'hot-d12-15-young', weather: 'hot', day: 12, hour: 15, plan: 'hotYoung', expect: { e: [-1.5, 1], pant: [0, 0.05] } },
  { id: 'hot-d14-15-young', weather: 'hot', day: 14, hour: 15, plan: 'hotYoung', expect: { e: [-1.5, 1.5], pant: [0, 0.1] } },
  { id: 'hot-d14-15-fans6', weather: 'hot', day: 14, hour: 15, plan: 'hotFans6', expect: { e: [4.5, 7.5], pant: [0.9, 1] } },
  // week 3's 40 °C afternoon (day 16) and a hot day 18
  { id: 'hot-d16-15-young', weather: 'hot', day: 16, hour: 15, plan: 'hotYoung', events: ['warm3Hot'], expect: { e: [-1.5, 2.5], pant: [0, 0.3], deathPerH: [0, 0.001] } },
  { id: 'hot-d18-15-young', weather: 'hot', day: 18, hour: 15, plan: 'hotYoung', expect: { e: [-1.5, 1.5], pant: [0, 0.1] } },
  { id: 'hot-d18-19-young', weather: 'hot', day: 18, hour: 19, plan: 'hotYoung', expect: { e: [-1.5, 1.5], pant: [0, 0.1] } },
];
/** As tuning-refs WINDOW_REFS_P4: deaths % (heat and cold) and panting bird-hours per bird; weather 'hot'. */
export const COND_WINDOWS_P4 = [
  { id: 'hot-week2-ideal', weather: 'hot', from: 8.25, to: 15.25, plan: 'ideal', expect: { deathsPct: [3, 15] } },
  { id: 'hot-week2-fans6', weather: 'hot', from: 8.25, to: 15.25, plan: 'hotFans6', expect: { deathsPct: [0.5, 2.5] } },
  { id: 'hot-week2-young', weather: 'hot', from: 8.25, to: 15.25, plan: 'hotYoung', expect: { deathsPct: [0, 0.05], coldH: [0, 15] } },
  { id: 'hot-week3-ideal', weather: 'hot', from: 15.25, to: 22.25, plan: 'ideal', events: ['warm3Hot'], expect: { deathsPct: [2, 10] } },
  { id: 'hot-week3-young', weather: 'hot', from: 15.25, to: 22.25, plan: 'hotYoung', events: ['warm3Hot'], expect: { deathsPct: [0, 0.1] } },
  // weeks 4-5 with the hot season's events: the pads decide; the nights want them too
  { id: 'hot-weeks45-ideal', weather: 'hot', from: 22.25, to: 36.25, plan: 'hotYoung', events: ['hot25Hot', 'waveHot', 'spellHot'], expect: { deathsPct: [0, 0.05], pantH: [3, 30] } },
  { id: 'hot-weeks45-noPad', weather: 'hot', from: 22.25, to: 36.25, plan: 'hotNoPad', events: ['hot25Hot', 'waveHot', 'spellHot'], expect: { deathsPct: [20, 100] } },
  { id: 'hot-weeks45-night3', weather: 'hot', from: 22.25, to: 36.25, plan: 'hotNight3', events: ['hot25Hot', 'waveHot', 'spellHot'], expect: { deathsPct: [2, 15] } },
  { id: 'hot-weeks45-padsTo21', weather: 'hot', from: 22.25, to: 36.25, plan: 'hotPadsTo21', events: ['hot25Hot', 'waveHot', 'spellHot'], expect: { deathsPct: [0, 0.2], pantHOverIdeal: [1.5, 4] } },
];

// ---------------- the rainy season's power cut (PHASE4.md §4.2) ----------------
/** The Phase 4 ideal in the rainy season with storm-33; no fans, timer or pad for `minutes` from 15:10 of day 33.
 *  Deaths (heat) % from 06:00 day 33 to 06:00 day 34. */
export function runCutP4(minutes, { startH = 15 + 10 / 60 } = {}) {
  const W = makeEnvP4({ weather: 'rainy', fromDay: 33.25, toDay: 34.25, events: ['storm33'] }), { env } = W;
  const c0 = 33 + startH * H, c1 = c0 + minutes / 1440;
  let alive = 1, last = null;
  while (env.day < 34.25 - 1e-9) {
    const off = env.day >= c0 - 1e-6 && env.day < c1 - 1e-6, key = Math.round(env.hour * 12);
    if (off) { env.setFans(0); env.setVentTimer(null); env.setPad(false); }
    else if (key !== last) { last = key; PLANS_P4.ideal(env, env.hour, env.day - PLACEMENT_DAY, W.w(), W.birds); }
    env.skipHours(1 / 12);
    const s = heatStateP4(env, { age: env.day - PLACEMENT_DAY, weightG: W.w() });
    W.last.eMean = s.eMean; alive *= 1 - (s.deathPerH + s.coldDeathPerH) / 12;
  }
  return { deathsPct: (1 - alive) * 100 };
}
export const CUT_REFS_P4 = [
  { id: 'cut0', minutes: 0, expect: { deathsPct: [0, 0.01] } },
  { id: 'cut10', minutes: 10, expect: { deathsPct: [0.03, 0.3] } },     // the generator on in 10 farm minutes (rainy:ideal)
  { id: 'cut30', minutes: 30, expect: { deathsPct: [0.3, 0.6] } },
  { id: 'cut60', minutes: 60, expect: { deathsPct: [0.5, 1] } },        // rainyGenLate
  { id: 'cut120', minutes: 120, expect: { deathsPct: [1, 2.2] } },
  { id: 'cut180', minutes: 180, expect: { deathsPct: [2.3, 4] } },      // never started: the mains back at 18:10 (rainyNoGenerator)
  // the generator left on after the mains came back runs dry about 10 h after its start (about 01:20 of day 34): the
  // house dark in the night air (25 °C, 95 %); the alarm and a stopped skip let him start it again (p-gen-dry)
  { id: 'cutNight30', minutes: 30, startH: 25 + 20 / 60, expect: { deathsPct: [0, 0.05] } },
  { id: 'cutNight240', minutes: 240, startH: 25 + 20 / 60, expect: { deathsPct: [1.2, 3] } },   // to 05:20: nobody came
];

// ---------------- the water condition's tank and well pump (PHASE4.md §4.4) ----------------
// The Phase 4 ideal of the normal season in weeks 4-5 (the hot afternoon of day 25, the heat wave of days 30-32, the
// humid day 33) with the tank of config WATER_TANK: the pump fills it at pumpM3h x pumpShare under fullPct; the pads
// draw 0.49 g per m³ of tunnel air per °C they cool (+ padBleed), the birds feedStdGAt x waterPerKgP4 over the lit
// hours (a tenth of it in the dark); under padFromPct the pad dries from the far end (env.padWorking). The worn pump
// (CONDITIONS.water pump-wear): pumpShare falls lossPerDay from its start, never under minShare; a repair stops the pump
// for WATER_TANK.repairH and then gives 1. The gauge's marker keeps the lowest level since the last reading.
const WEAR = CONDITIONS.water.levels.weeks45.problems.find((p) => p.id === 'pump-wear');
export function runTankP4({ repairAt = null, from = 22.25, to = 36.25 } = {}) {
  const W = makeEnvP4({ weather: 'normal', fromDay: from, toDay: to, events: ['hot25', 'wave', 'humid'] }), { env } = W, T = WATER_TANK;
  const wearFrom = WEAR.day + WEAR.hour * H, cap = T.m3 * 1000;
  let L = (T.startPct / 100) * cap, alive = 1, last = null, lowH = 0;
  const day = {}, D = (d) => (day[d] ||= { lowPct: 100, lowAt: null, padMaxLh: 0, birdsMaxLh: 0, barAt0615: null });
  const shareAt = (t) => {
    if (repairAt != null && t >= repairAt) return t < repairAt + T.repairH * H ? 0 : 1;
    return t < wearFrom ? 1 : Math.max(WEAR.minShare, 1 - WEAR.lossPerDay * (t - wearFrom));
  };
  while (env.day < to - 1e-9) {
    const a = env.day - PLACEMENT_DAY, key = Math.round(env.hour * 4), dt = 0.25;
    if (key !== last) { last = key; PLANS_P4.ideal(env, env.hour, a, W.w(), W.birds); }
    const share = shareAt(env.day), lvl = (100 * L) / cap;
    env.padWorking = Math.max(0, Math.min(1, lvl / T.padFromPct));
    env.skipHours(dt);
    const s = heatStateP4(env, { age: env.day - PLACEMENT_DAY, weightG: W.w() });
    W.last.eMean = s.eMean; alive *= 1 - (s.deathPerH + s.coldDeathPerH) * dt;
    const cool = env.padOn ? PAD_EFF * Math.max(0, env.outsideTemp - wetBulbOf(env.outsideTemp, env.outsideRH)) * Math.min(1, env.padWorking) : 0;
    const padLh = ((0.49 * cool * env.fansEffective * EQUIP.fanM3h) / 1000) * (1 + T.padBleed);
    const litH = 24 - (env.lightProgram?.darkHours ?? 6);
    const birdsLh = ((W.birds * feedStdGAt(a)) / 1000) * waterPerKgP4(Math.max(0, s.eMean)) / (litH + 0.1 * (24 - litH)) * (env.lightsOn ? 1 : 0.1);
    const pumpLh = lvl < T.fullPct ? T.pumpM3h * 1000 * share : 0;
    L = Math.max(0, Math.min(cap, L + (pumpLh - padLh - birdsLh) * dt));
    const l2 = (100 * L) / cap, r = D(env.dayNumber);
    if (l2 < r.lowPct) { r.lowPct = l2; r.lowAt = env.hour; }
    if (l2 < T.linesFromPct) lowH += dt;
    r.padMaxLh = Math.max(r.padMaxLh, padLh); r.birdsMaxLh = Math.max(r.birdsMaxLh, birdsLh);
    if (Math.abs(env.hour - 6.25) < 0.04) r.barAt0615 = T.pumpBar * share;
  }
  return { day, deathsPct: (1 - alive) * 100, hoursUnderLines: lowH };
}
const lowOf = (r, d0, d1) => Math.min(...Object.entries(r.day).filter(([d]) => +d >= d0 && +d <= d1).map(([, v]) => v.lowPct));
/** Each reference: a run of runTankP4 and the measured values with their bands. */
export const TANK_REFS_P4 = [
  // the pump repaired the first morning its gauge reads 2.2 bar or less (water:ideal: day 27, 08:00-10:00)
  { id: 'tank-ideal', repairAt: 27 + 8 * H, measure: (r) => ({ lowPct: lowOf(r, 22, 35), deathsPct: r.deathsPct, bar26: r.day[26].barAt0615, bar27: r.day[27].barAt0615 }),
    expect: { lowPct: [85, 100], deathsPct: [0, 0.02], bar26: [2.3, 2.5], bar27: [1.9, 2.2] } },
  // never repaired (waterPumpUnfixed): the heat wave empties the tank every afternoon, the pad dries, the lines run low
  { id: 'tank-unfixed', repairAt: null, measure: (r) => ({ lowW: lowOf(r, 30, 32), low29: lowOf(r, 29, 29), deathsPct: r.deathsPct, hoursUnderLines: r.hoursUnderLines }),
    expect: { lowW: [0, 15], low29: [60, 100], deathsPct: [2, 10], hoursUnderLines: [30, 120] } },
  // repaired the morning after the gauge's marker first read under 30 % (waterPumpLate: day 31)
  { id: 'tank-late', repairAt: 31 + 8 * H, measure: (r) => ({ low30: lowOf(r, 30, 30), low32: lowOf(r, 32, 32), lowAfter: lowOf(r, 33, 35), deathsPct: r.deathsPct, hoursUnderLines: r.hoursUnderLines }),
    expect: { low30: [0, 30], low32: [20, 80], lowAfter: [80, 100], deathsPct: [0, 0.3], hoursUnderLines: [5, 40] } },
  // the plate's figures: the pads' and the birds' draw on a hot afternoon (6 fans and the pads, days 25 and 31)
  { id: 'tank-draw', repairAt: 27 + 8 * H, measure: (r) => ({ pad25: r.day[25].padMaxLh, pad31: r.day[31].padMaxLh, birds25: r.day[25].birdsMaxLh, birds31: r.day[31].birdsMaxLh }),
    expect: { pad25: [700, 1000], pad31: [950, 1200], birds25: [90, 140], birds31: [100, 170] } },
];
void BROOD; void EVENTS;
