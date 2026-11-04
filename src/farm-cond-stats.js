// Phase 4: what the condition milestones measure (skills-rules-cond.js), accumulated in a condition run only
// (farm.condX.st, saved with the farm). Hidden truth like Phase 3's farm.stats.daily, never shown as a verdict.
// Package "sim", pure logic.
import { HEAT_P4 } from './config.js';
import { at } from './farm-cond-core.js';

export const freshCondStats = () => ({ pmH: 0, pmNear: 0, nightPant: 0, stormH: 0, stormClosedH: 0, heatAt30: null, aliveAt30: null, flushed: {}, tankReadDays: [], tankUnder30At: null, outsideMax: {}, powerOff: {} });

/** One step of a condition run (after the flock): the hours the milestones count. */
export function stepCondStats(farm, env, hrs) {
  const X = farm.condX, S = X.st || (X.st = freshCondStats()), fl = farm.flock, C = farm.comfort, d = env.dayNumber, h = env.hour, age = farm.age;
  if (!(hrs > 0)) return;
  if (farm.condition === 'hot' && fl.placed > 0 && fl.alive > 0) {
    // the brooding week's hot afternoons: the chicks within ±1.5 °C of the row (farm.comfort.e), days 1-7 14:00-18:00
    if (d >= 1 && d <= 7 && h >= 14 && h < 18) { S.pmH += hrs; if (C.e >= -1.5 && C.e <= 1.5) S.pmNear += hrs; }
    // the evenings and nights of weeks 4-5 (18:00-06:00, days 22-35): panting bird-hours
    if (((d >= 22 && d <= 35 && h >= 18) || (d >= 23 && d <= 36 && h < 6))) S.nightPant += hrs * (C.pantShare || 0);
    if (S.heatAt30 == null && env.day >= at(30, 6)) { S.heatAt30 = fl.deadByCause.heat || 0; S.aliveAt30 = fl.alive; }
    // the flush (h-flush): every line flushed 2 farm minutes or more between 13:00 and 15:00 on its day
    if (h >= 13 && h < 15) for (let i = 0; i < 4; i++) if ((X.flushMin[i] || 0) >= 2) { const f = S.flushed[d] || (S.flushed[d] = []); if (!f.includes(i)) f.push(i); }
  }
  if (farm.condition === 'rainy' && d >= 22 && d <= 35 && farm.weatherNow.storm) { S.stormH += hrs; if (farm.house.flapsClosed) S.stormClosedH += hrs; }
  if (farm.condition === 'water' && S.tankUnder30At == null && farm.waterTank.levelPct < 30) S.tankUnder30At = +env.day.toFixed(5);
  if (!farm.power.on) S.powerOff[d] = +((S.powerOff[d] || 0) + hrs * 60).toFixed(2);
  void age; void HEAT_P4;
}
/** A reading of the outside air the farmer took (the controller, the fan panel): the day's hottest, with its time. */
export function noteOutside(farm, env, c) {
  if (!Number.isFinite(c)) return;
  const S = farm.condX.st || (farm.condX.st = freshCondStats()), d = env.dayNumber, o = S.outsideMax[d];
  if (!o || c > o[0]) S.outsideMax[d] = [+c.toFixed(1), +env.hour.toFixed(2)];
}
