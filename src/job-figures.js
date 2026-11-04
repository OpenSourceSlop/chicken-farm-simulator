// The figures a job works toward, worked out once so the job strip in the panel (job-strips.js) and the
// job's done rule (job-engine.js state tests) read the same numbers: the farmer's own flock beside the
// sign's table, the timer's air, the line heights the plates give, the brooder row of the day. Pure logic
// (node and browser). Every band here is general practice and is written on its sign or plate as such
// (content-signs.js / content-signs-cycle.js).
import { EQUIP, LEVEL1, FAN_COUNT, minVentM3hPer1000, nippleHeightCmAt, feederRimCmAt, flowTargetAt, targetTempAt, flockAgeAt, weightAt } from './config.js';

/** Minimum ventilation: the timer gives 90–130 % of the air the sign's table asks for (general practice,
 *  on the vent sign): less leaves the damp and the ammonia in, much more takes out heat the brooders must
 *  put back. 1 fan 7–10 s in every 300 s for 6,000 chicks of 42 g; the sign's own 8 s is 103 %. */
export const VENT_BAND = [0.9, 1.3];
/** The chicks the farmer places tomorrow (prep day): the vent sign's worked example. */
export const PREP_FLOCK = { birds: LEVEL1.chicksPlaced, weightG: 42 };
/** Line heights: within ±3 cm of the plate's figure for the day (the skill rules' band, skills-rules-cycle). */
export const HEIGHT_BAND_CM = 3;
/** Day 0: nipple tips at chick eye level, 10–12 cm (drinker plate). */
export const NIPPLE_DAY0_CM = [10, 12];
/** Flow tests: within ±3 ml/min of age + 20 (the flow-matched skill band). */
export const FLOW_BAND = 3;
/** Lights for the chicks: 23 h of light, 30–40 lux at chick level (light plate); dimmer 50–67 % at luxMax 60. */
export const CHICK_LUX = [30, 40];
/** Week 2 on: a dark block of 4–6 h (light sign). */
export const DARK_H = [4, 6];
/** Catching: lights dimmed to about 10 lux (catch and light signs): dimmer at most 20 % (12 lux at luxMax). */
export const CATCH_DIMMER_MAX = 0.2;
/** Catching: at least three tunnel fans running (catch sign). */
export const CATCH_FANS_MIN = 3;
/** Lifted out of the way: drinker lines at or above 55 cm (the winch tops out at 60), pans at or above 40 cm (45). */
export const LINES_UP_CM = 55, PANS_UP_CM = 40;
/** Days 0–3: the pans on the litter, rim about 5 cm (feeder plate): at most 7 cm counts as on the litter. */
export const PANS_ON_LITTER_CM = 7;

/** Air the minimum ventilation timer gives, m³/h (fans × 36,000 × on / cycle). */
export function timerAirM3h(t) {
  if (!t || !(t.fans > 0) || !(t.onSec > 0)) return 0;
  return (t.fans * EQUIP.fanM3h * t.onSec) / Math.max(1, t.cycleSec || 300);
}

/** Review round: the air the timer brings in through the side inlets (the storm flaps closed let in env.inletShare, 0.7). */
export const inletAirM3h = (env, t) => timerAirM3h(t) * (env?.inletShare ?? 1);
/** "storm flaps closed: the inlets give 70 %" while they are shut, else ''. */
export const flapsWords = (env) => ((env?.inletShare ?? 1) < 0.999 ? `storm flaps closed: the inlets give ${Math.round((env.inletShare ?? 1) * 100)} %` : '');

/** Birds the farmer knows are alive: placed less the dead he counted at the bin and his culls (farm-act knownAlive). */
export function knownAliveOf(fl) {
  return Math.max(0, (fl.placed || 0) - (fl.countedDead || 0) - ((fl.culls || 0) - (fl.cullsInBoxes || 0)));
}

/**
 * The flock the farmer knows: before the chicks come, tomorrow's 6,000 chicks of about 42 g (the vent sign's
 * example); then his own count and the automatic bird scale's reading (this morning's 08:00 reading, else
 * what it reads now: the model's mean + 2 %, farm-cycle-step / records-rows).
 * -> { birds, weightG, prep, weightFrom }
 */
export function knownFlock(env, farm) {
  const fl = farm?.flock || {};
  if (!(fl.placed > 0)) return { ...PREP_FLOCK, prep: true, weightFrom: 'the chicks booked for tomorrow (vent sign example)' };
  const day = env.dayNumber, sc = farm.stats?.scaleAt?.[day];
  const w = Number.isFinite(sc) && env.hour >= 8 ? sc : (fl.meanWeightG || weightAt(Math.max(0, flockAgeAt(env.day)))) * 1.02;
  return { birds: knownAliveOf(fl), weightG: w, prep: false, weightFrom: Number.isFinite(sc) && env.hour >= 8 ? 'automatic bird scale, 08:00' : 'automatic bird scale' };
}

/** The sign table's air per 1,000 birds at this weight and for the whole flock, the timer's air, and the share. */
export function ventNeed(env, farm, timer = env.ventTimer) {
  const f = knownFlock(env, farm);
  const per1000 = minVentM3hPer1000(f.weightG);
  const need = (per1000 * f.birds) / 1000;
  const air = inletAirM3h(env, timer);   // (review round: what the inlets let in, the storm flaps closed 70 %)
  return { ...f, per1000, need, air, share: need > 0 ? air / need : 0 };
}
export const ventInBand = (env, farm, timer = env.ventTimer) => { const v = ventNeed(env, farm, timer); return v.need > 0 && v.share >= VENT_BAND[0] - 1e-9 && v.share <= VENT_BAND[1] + 1e-9; };

/** The two table rows the farmer reads the weight between (the vent sign's table). */
export function ventTableRows(weightG, table) {
  for (let i = 1; i < table.length; i++) if (weightG <= table[i][0]) return [table[i - 1], table[i]];
  return [table[table.length - 2], table[table.length - 1]];
}

/** On-seconds that give the need with this many fans in this cycle (the vent sign's timer formula). */
export const onSecFor = (need, fans = 1, cycleSec = 300) => Math.max(0, Math.round((need / (Math.max(1, fans) * EQUIP.fanM3h)) * cycleSec));

/** Plate figures for the line heights of today (HUD day for the nipples, flock age for the pan rims). */
export const nippleCmToday = (env) => nippleHeightCmAt(Math.max(0, env.dayNumber));
export const rimCmNow = (env) => feederRimCmAt(Math.max(0, flockAgeAt(env.day)));
export const nippleInBand = (cm, env) => Math.abs(cm - nippleCmToday(env)) <= HEIGHT_BAND_CM + 1e-9;
export const rimInBand = (cm, env) => Math.abs(cm - rimCmNow(env)) <= HEIGHT_BAND_CM + 1e-9;
export const flowToday = (env) => flowTargetAt(Math.max(0, env.dayNumber));

/** The brooder sign's row for a HUD day (half degrees, as the sign prints it). */
export const brooderRowC = (day) => Math.round(targetTempAt(Math.max(0, day)) * 2) / 2;
/** Dimmer share for a lux figure (lux at birds = luxMax × dimmer). */
export const luxOfDimmer = (d) => EQUIP.luxMax * (d ?? 1);
/** Tunnel fans turning (manual + timer during its on-part, less the broken ones). */
export const fansTurning = (env) => Math.max(0, env.fansEffective ?? env.fansOn ?? 0);
export const fansWorking = (env) => FAN_COUNT - (env.fansBroken || []).length;
