// Farm model, one step of the cycle (PHASE3.md §6): the hooks farm.js stepFarm calls. Package "sim".
//   cyclePre(farm, env, hrs)          before the equipment: feed deliveries, the pad overflow's water, crowding
//   cycleComfort(farm, env, C, age)   the whole house's comfort (farm-house.js) instead of Phase 2's
//   cycleFactors(farm, env, age)      the cycle's intake factors for the flock step (farm.cyc.fx)
//   cyclePost(farm, env, hrs, r)      after the flock: health, feed (withdrawal, shock, the heat feeders), air,
//                                     the catch, the clean-out, gas and the day's stats; in the brooding week
//                                     only the gas, the silos' layers and the stats run (Phase 2 unchanged)
import { HEAT, feedStdGAt, minVentM3hPer1000, EQUIP, targetTempAt, feederRimCmAt, PLACEMENT_DAY } from './config.js';
import { EV } from './events.js';
import { houseComfort, crowding, ammonia, dustNow, gasKg, zoneOfCell } from './farm-house.js';
import { stepHealth } from './farm-health.js';
import { deliverFeed, feedForm, checkShock, stepWithdrawal, feedersUpInHeat, reconcileSilos, SILO_MODEL } from './farm-silos.js';
import { stepHarvest } from './farm-harvest.js';
import { stepClean } from './farm-clean.js';
import { usedCells, addWater } from './farm-litter.js';
import { meanPanFill } from './farm-feed.js';
import { waterPerKgP4, dehydrationAllowed } from './farm-tuning.js';

const H = 1 / 24;
const PAD_CELLS = []; // the two westmost cell columns (the pad overflow)
for (let iz = 0; iz < 12; iz++) for (const ix of [0, 1]) PAD_CELLS.push(iz * 48 + ix);

export function cyclePre(farm, env, hrs) {
  const X = farm.cyc;
  if (!X.on) return;
  for (const o of deliverFeed(farm.feed, env)) {
    farm.emit(EV.FARM_DELIVERY, { kind: 'feed', phase: 'arrive', kg: o.kg, type: o.type, silo: o.silo });
    farm.emit(EV.FARM_DELIVERY, { kind: 'feed', phase: 'leave', kg: o.kg, type: o.type, silo: o.silo });
  }
  if (farm.house.padFloatStuck) { const def = (farm.cycleLevel.problems || []).find((p) => p.id === 'pad-overflow'); const l = (def ? def.litresPerCellH : 0.8) * hrs; for (const i of PAD_CELLS) addWater(farm.litter, i, l); }
  // drying: moving air over the litter dries it faster (model): x (1 + 0.4 x air speed m/s)
  // ... fresh air over the floor dries it (sqrt of the airflow over the minimum ventilation sign's, 0.5..1.2) and a
  // crowded floor (birds sitting on it) dries slower: / the density over the allowed density
  const fl = farm.flock, table = fl.alive > 0 ? (minVentM3hPer1000(fl.meanWeightG) * fl.alive) / 1000 : 0;
  const ventK = table > 0 ? Math.max(0.5, Math.min(1.2, Math.sqrt(env.airflowM3h / table))) : 1;
  farm.litter.dryBoost = ((1 + 0.3 * env.airSpeed) * ventK) / Math.max(1, (X.crowd && X.crowd.ratio) || 1);
}

export function cycleComfort(farm, env, C, age) { return houseComfort(env, farm, C, age, farm.flock.meanWeightG); }

/** The cycle's factors for this flock step: f_space x f_form x f_heat x f_health x the change shock x lame birds. */
export function cycleFactors(farm, env, age, hrs = 0) {
  const X = farm.cyc, fx = X.fx, fl = farm.flock, C = farm.comfort;
  const cr = (X.crowd = crowding(farm, age));
  const form = feedForm(farm.feed, age);
  fx.fSpace = cr.fSpace; fx.fForm = form.fForm; fx.fpgK = form.fpgK; fx.fHeat = C.fHeat ?? 1;
  fx.shock = X.shockUntil != null && env.day < X.shockUntil ? SILO_MODEL.shockIntake : 1;
  const lame = fl.alive > 0 ? 1 - (0.5 * (fl.lameOnFloor || 0)) / fl.alive : 1;
  fx.f = fx.fSpace * fx.fForm * fx.fHeat * (fx.fHealth ?? 1) * fx.shock * lame;
  fx.dcv = cr.dcv;
  // a short dry spell (the vaccine's thirst) is no dehydration: deaths only after 4 h with the main shut
  const h = farm.health;
  h.dryH = h.mainClosed ? (h.dryH || 0) : 0;
  // Phase 4: birds of 3 weeks and older die of thirst only after 6 h with no water in reach (the catch's lines up)
  X.dryH = farm.water.access < 0.5 ? (X.dryH || 0) + hrs : 0;
  fx.dehydK = h.mainClosed ? Math.max(0, Math.min(1, ((h.dryH || 0) - 4) / 2)) : dehydrationAllowed(age, X.dryH) ? 1 : 0;
  fx.otherK = 0.4;           // background deaths from Week 2 (model: Phase 2's 'other' x 0.4)
  X.waterPerKg = waterPerKgP4(C.meanOver ?? 0);
}

export function cyclePost(farm, env, hrs, r) {
  const X = farm.cyc, fl = farm.flock, feed = farm.feed, st = farm.stats, age = farm.age;
  st.gasKg = (st.gasKg || 0) + gasKg(env, hrs);
  // the company's letters on the office desk (EV.LETTER): the contract on the planning day, the reply an hour after the plan went
  const plan = farm.plan;
  if (farm.cycleLevel && farm.cycleLevel.id === 'plan' && !st.contractLetter) { st.contractLetter = env.dayNumber; farm.emit(EV.LETTER, { kind: 'contract', day: env.dayNumber }); }
  if (plan && plan.replyAt != null && !plan.replyLetter && env.day >= plan.replyAt - 1e-9) { plan.replyLetter = env.day; farm.emit(EV.LETTER, { kind: 'reply', day: env.dayNumber }); }
  if (!X.on) { if (feed.silos && Math.abs(feed.siloKg - feed.silos[0].kg - feed.silos[1].kg) > 1e-6) reconcileSilos(feed); slowStats(farm, env, hrs, age); return; }
  if (farm.health.mainClosed) farm.health.dryH = (farm.health.dryH || 0) + hrs;
  const L = farm.litter, C = farm.comfort;
  // feed: the withdrawal, the heat-wave feeder lift, the change shock, the birds' missed feed eaten back
  stepWithdrawal(feed, env);
  const up = fl.alive > 0 && feedersUpInHeat(feed, env);
  if (up) X.feedersUpSince = X.feedersUpSince ?? env.day; else { X.feedersUpSince = null; X.fFPrev = feed.access; }
  X.liftOn = up;
  X.heatK = up && env.day - X.feedersUpSince >= H ? SILO_MODEL.heatK : 1;
  X.shockUntil = checkShock(feed, env, X.shockUntil);
  // the 7-day feed and the air (ammonia, dust)
  const d = env.dayNumber, fh = X.feedHist;
  if (!fh.length || fh[fh.length - 1][0] !== d) { fh.push([d, +feed.meterKg.toFixed(1)]); while (fh.length > 9) fh.shift(); }
  const f7 = feed.meterKg - meterAt(fh, env.day - 7);
  if (fl.alive > 0) { L.ammoniaPpm = ammonia(farm, env, f7); farm.air.ammoniaPpm = +L.ammoniaPpm.toFixed(2); farm.air.dustIndex = +dustNow(env, age).toFixed(3); }
  else { L.ammoniaPpm = 0; farm.air.ammoniaPpm = 0; farm.air.dustIndex = 0; }
  // the litter per 6 m strip (feet at the bird check) and the wettest strip (where the blood shows)
  if (X.zoneMoistH == null || env.day - X.zoneMoistH >= H) { X.zoneMoistH = env.day; zoneMoisture(farm); }
  if (fl.alive > 0) stepHealth(farm, env, hrs, age, r ? r.drunkL : 0);
  // crowding over the last week (feathers): a slow mean of the density ratio
  if (X.crowd) X.crowdWeek = (X.crowdWeek || 0) + ((X.crowd.ratio || 0) - (X.crowdWeek || 0)) * Math.min(1, hrs / (7 * 24));
  stepHarvest(farm, env);
  stepClean(farm, env, hrs);
  if (farm.clean.lab && !farm.clean.labSeen) { farm.clean.labSeen = true; farm.onLabLetter && farm.onLabLetter(); }
  slowStats(farm, env, hrs, age);
}

/** The day's stats every 5 game minutes (their integrals do not need the minute). */
function slowStats(farm, env, hrs, age) {
  const X = farm.cyc;
  X.statH = (X.statH || 0) + hrs;
  if (X.statH < 5 / 60 - 1e-9 && Math.floor(env.day * 288 + 1e-6) === X.statSlot) return;
  X.statSlot = Math.floor(env.day * 288 + 1e-6);
  dailyStats(farm, env, X.statH, age);
  X.statH = 0;
}

function meterAt(fh, t) {
  // fh: [calendar day, meter kg at the first step of that day] (about midnight)
  if (!fh.length) return 0;
  if (t <= fh[0][0]) return fh[0][1] * Math.max(0, Math.min(1, 1 - (fh[0][0] - t)));
  for (let k = 1; k < fh.length; k++) if (t <= fh[k][0]) { const [d0, m0] = fh[k - 1], [d1, m1] = fh[k]; return m0 + ((m1 - m0) * (t - d0)) / (d1 - d0 || 1); }
  return fh[fh.length - 1][1];
}

function zoneMoisture(farm) {
  const L = farm.litter, s = new Array(8).fill(0), n = new Array(8).fill(0);
  for (const i of usedCells(L)) if (L.coverGrid[i] >= 0.5) { const z = zoneOfCell(i); s[z] += L.moistureGrid[i]; n[z]++; }
  const zm = s.map((v, i) => (n[i] ? +(v / n[i]).toFixed(1) : null));
  farm.cyc.zoneMoisture = zm;
  let best = 0; for (let z = 1; z < 8; z++) if ((zm[z] ?? -1) > (zm[best] ?? -1)) best = z;
  farm.cyc.wettestZone = best;
}

/**
 * What the skill rules measure, per calendar day (farm.stats.daily[day]); hidden truth like Phase 2's
 * comfortMinutes, never shown as a verdict. Minutes / hours weighted by the step.
 */
function dailyStats(farm, env, hrs, age) {
  const st = farm.stats, daily = st.daily || (st.daily = {}), d = env.dayNumber, D = daily[d] || (daily[d] = { h: 0 });
  const fl = farm.flock, C = farm.comfort, h = env.hour, X = farm.cyc;
  D.h += hrs;
  if (fl.alive > 0 && fl.placed > 0) {
    D.cIn = (D.cIn || 0) + hrs * (X.on ? C.groupShare ?? 0 : C.groupShare ?? 0);
    D.pant = (D.pant || 0) + hrs * (C.pantShare || 0);
    if (env.fansEffective > 0 && (C.e ?? 0) < -2) D.chill = (D.chill || 0) + hrs;
    if (env.heaterLevel > 0.2 && env.houseTemp > env.targetTemp + 3) D.overH = (D.overH || 0) + hrs;
    if (env.padOn && env.houseRH > HEAT.padOffAboveRH) D.padHum = (D.padHum || 0) + hrs;
    if (X.on) { D.nh3All = (D.nh3All || 0) + hrs; if (farm.air.ammoniaPpm < 20) D.nh3Lo = (D.nh3Lo || 0) + hrs; }
    if (meanPanFill(farm.feed) < 0.05 && !farm.feed.withdrawn) D.panLow = (D.panLow || 0) + hrs;
    if (h < 6) D.nightMin = Math.min(D.nightMin ?? 99, +(env.houseTemp - env.targetTemp).toFixed(2));
    if (h >= 12 && h < 17 && env.heaterLevel < 0.05) D.heatOff1217 = (D.heatOff1217 || 0) + hrs;
    if (X.on && feedersUpInHeat(farm.feed, env) && h >= 11 && h < 16) D.feedersUp = (D.feedersUp || 0) + hrs;
    if ((C.e ?? 0) < -2) D.cold = (D.cold || 0) + hrs; // most birds cold (70 % of them at or under e)
    if (env.day >= 30.25 && env.day < 32 + 19 / 24) st.pantWave = (st.pantWave || 0) + hrs * (C.pantShare || 0);
    const g = farm.feed.panType;
    if (g) {
      const dg = farm.feed.drawMix ? farm.feed.drawMix.grower : null; // the augers' draw: the valves' blend
      if (dg != null && dg >= 0.2 && dg <= 0.8 && d <= 20) st.blendH = (st.blendH || 0) + hrs;
      // Phase 4 (PHASE4.md §6 item 9): the finisher's half-and-half (the augers draw 20-80 % finisher), days 28-36
      const df = farm.feed.drawMix ? farm.feed.drawMix.finisher : null;
      if (df != null && df >= 0.2 && df <= 0.8 && d >= 28 && d <= 36) st.blendFinH = (st.blendFinH || 0) + hrs;
      if (st.growerAt90 == null && (g.grower || 0) >= 0.9) st.growerAt90 = +env.day.toFixed(4);
      if (st.finisherAt90 == null && (g.finisher || 0) >= 0.9 && d >= 29) st.finisherAt90 = +env.day.toFixed(4);
    }
  }
  // morning settings (10:00): the timer against the table, the setpoint, pans, light (the noon program)
  if (D.am == null && h >= 10) {
    const t = env.ventTimer, birds = fl.placed > 0 ? fl.alive : 0;
    D.am = { vent: t ? Math.round((t.fans * EQUIP.fanM3h * t.onSec) / t.cycleSec) : 0, table: birds > 0 ? Math.round((minVentM3hPer1000(fl.meanWeightG) * birds) / 1000) : null,
      setpoint: env.heaterSetpoint, sign: Math.round(targetTempAt(d) * 2) / 2, rim: Math.round(feederRimCmAt(Math.max(0, age)) * 10) / 10,
      pans: farm.feed.lines.map((l) => l.heightCm), flooded: farm.feed.lines.every((l) => l.flood), dark: env.lightProgram ? env.lightProgram.darkHours : null, lux: Math.round(farm.luxLit()) };
  }
  // the automatic bird scale (reads about 2 % high) at 08:00 each day: the level result's weight when nobody weighed
  if (fl.placed > 0 && fl.alive > 0 && h >= 8) { const sc = st.scaleAt || (st.scaleAt = {}); if (sc[d] == null) sc[d] = +(fl.meanWeightG * 1.02).toFixed(1); }
  if (st.firstTipAt != null && st.lightAtTip == null) st.lightAtTip = { on: env.lightsOn, dimmer: env.lightProgram ? env.lightProgram.dimmer : 1, dark: env.lightProgram ? env.lightProgram.darkHours : 1 };
  if (st.preheatAt == null && env.heaterSetpoint >= 30 && env.heaterLevel > 0.05) st.preheatAt = +env.day.toFixed(4);
  // the feed eaten from the first step of the day (the next day's feed0 minus this one is the day's intake)
  if (D.feed0 == null) { D.feed0 = +fl.cumFeedKg.toFixed(2); D.std = fl.alive > 0 ? +((fl.alive * feedStdGAt(age + 0.5)) / 1000).toFixed(1) : 0; }
  void PLACEMENT_DAY;
}
