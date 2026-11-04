// Sound layer, Phase 5 rules (PHASE5.md §2): when the situations Phases 3-4 added are heard, where and how much. Pure:
// no DOM, no Web Audio, so scripts/test-audio.mjs and scripts/test-audio-hour.mjs check them in node.
//
//   PLACES                       where each new sound comes from (config spots)
//   CAPS                         events per real minute (the limiter, audio-limit.js)
//   layerGain(v)                 a layer slider's gain: v² (PHASE5.md §2.6)
//   genTarget(S)                 the generator's bed 0..1: exp(-d / 20), -8 dB inside, 0 unless running
//   machineOwner(S, out)         which machine has the one shared machine bed now (the nearest, the loudest at him)
//   dayCicadas(hour, cond)       the hot season's day chorus 0..1 (10:00-16:00, highest at 13:00)
//   dripRate(S)                  drips per real second off the eaves after the rain (0.2-0.6, 0 when not heard)
//   thunderOf(rng, kmFixed)      a flash's rumble: { km 0.5-2.7, delay = km / 0.343 s, len 3-7 s, near }
//   alarmGap(darkSec)            the controller alarm's gap: 6 s for the first 120 s of a dark house, then 15 s
//   deskFanOn(S), crewTarget(S), washerOf(...)
import { HOUSE_BOUNDS, FARM, SPOTS2, SPOTS3, SPOTS4 } from './config.js';
import { clamp, smooth, dbToGain } from './audio-mix.js';

export const PLACES = {
  generator: { x: FARM.generator.x, z: FARM.generator.z },
  washBay: { x: SPOTS3.washBay.x, z: SPOTS3.washBay.z },
  desk: { x: SPOTS2.officeDesk.x, z: SPOTS2.officeDesk.z },
  pump: { x: SPOTS4.waterTank.x, z: SPOTS4.waterTank.z },
  loadingBay: { x: SPOTS3.loadingBay.x, z: SPOTS3.loadingBay.z },
  catchPanels: { x: SPOTS3.catchPanels.x, z: SPOTS3.catchPanels.z },
  controller: { x: -12, z: -5.8 },
};

/** Events per real minute (PHASE5.md §2.2); `alarmLate` after the alarm's first two minutes, `gen` = start + stop + clunk. */
export const CAPS = { tick: 6, click: 30, paper: 12, alarm: 10, alarmLate: 4, thunder: 3, crate: 30, drip: 40, ring: 2, gen: 6, truck: 3 };

/** A layer slider (0..1) to its gain: the square, as the master volume (0.5 -> 0.25). */
export const layerGain = (v) => { const x = Number.isFinite(+v) ? clamp(+v, 0, 1) : 1; return x * x; };

const dist = (S, P) => Math.hypot(S.x - P.x, S.z - P.z);
const INSIDE_GEN = dbToGain(-8);
/** The generator's bed at the farmer: 1 at the generator, exp(-d / 20) (0.37 at 20 m), -8 dB inside the house; 0 unless it runs. */
export function genTarget(S) {
  if (!S.genRun) return 0;
  return Math.exp(-dist(S, PLACES.generator) / 20) * (S.inside ? INSIDE_GEN : 1);
}
/** The pressure washer: at the wash bay while its machine job runs (1 at the bay, falling off over a few metres), or at
 *  the farmer while he carries it inside the house (his own sound, centred). */
export function washerTarget(S) {
  if (S.washer === 2) return 1;
  if (S.washer === 1) { const d = dist(S, PLACES.washBay); return d > 40 ? 0 : 1 / (1 + Math.max(0, d - 2) / 4); }
  return 0;
}
/** The hand sprayer: only in his hands inside the house. */
export const sprayerTarget = (S) => (S.sprayer ? 1 : 0);
/** The old well pump (the water condition): its hum at the tank while it runs, exp(-d / 8). */
export const pumpTarget = (S) => (S.pump ? Math.exp(-Math.max(0, dist(S, PLACES.pump) - 3) / 8) * (S.inside ? 0.25 : 1) : 0);
/** The catch truck idling at the loading bay from the catch's start to its end: exp(-d / 18), 1 at 5 m. */
export const truckIdleTarget = (S) => (S.catching ? Math.exp(-Math.max(0, dist(S, PLACES.loadingBay) - 5) / 18) * (S.inside ? 0.35 : 1) : 0);

/** The machines that can take the one machine bed, in the order of MACHINE_PROFILES. */
export const MACHINES = ['generator', 'washer', 'sprayer', 'pump', 'truck'];
const TARGETS = [genTarget, washerTarget, sprayerTarget, pumpTarget, truckIdleTarget];
/**
 * The shared machine bed (PHASE5.md §2.1): the generator, the washer (and the sprayer), the well pump and the idling truck
 * never sound together; if two would, the one loudest at the farmer (the nearer) takes it. out: { owner (index or -1),
 * gain (0..1 of its own level), gains: [per machine] }.
 */
export function machineOwner(S, out = { owner: -1, gain: 0, gains: new Float64Array(MACHINES.length) }) {
  let best = -1, g = 0;
  for (let i = 0; i < TARGETS.length; i++) {
    const v = TARGETS[i](S);
    out.gains[i] = v;
    if (v > g + 1e-6) { g = v; best = i; }
  }
  out.owner = g > 0.003 ? best : -1;
  out.gain = out.owner >= 0 ? g : 0;
  return out;
}

/** The hot season's day cicadas (not the dusk swell): 0 outside 10:00-16:00 and in every condition but 'hot', highest at 13:00. */
export function dayCicadas(hour, cond) {
  if (cond !== 'hot' || !(hour > 10 && hour < 16)) return 0;
  return Math.pow(Math.sin((Math.PI * (hour - 10)) / 6), 1.6);
}

/** Outside, how far from the house's walls (0 on the wall; inside: Infinity: drips are an outdoor sound). */
export function wallDistance(x, z, inside) {
  if (inside) return Infinity;
  const B = HOUSE_BOUNDS;
  const dx = Math.max(B.xMin - x, 0, x - B.xMax), dz = Math.max(B.zMin - z, 0, z - B.zMax);
  return Math.hypot(dx, dz);
}
/** Farm minutes the eaves drip after the rain stops (while the roof is still wet). */
export const DRIP_MINUTES = 20;
/**
 * Drips off the eaves: S.rain (farm.weatherNow.rain) 0, S.wet (world.weather.wet) over 0.3, within DRIP_MINUTES farm minutes
 * of the rain stopping (S.dryMin), heard outside within 6 m of a wall. 0.2-0.6 a second, falling with the wetness.
 */
export function dripRate(S) {
  if ((S.rain || 0) > 0 || !(S.wet > 0.3) || !((S.dryMin ?? Infinity) < DRIP_MINUTES)) return 0;
  if (!(wallDistance(S.x, S.z, S.inside) < 6)) return 0;
  return 0.2 + 0.4 * clamp((S.wet - 0.3) / 0.6, 0, 1);
}

/** Speed of sound (km/s): a flash's thunder comes km / 0.343 s after it. */
export const SOUND_KMS = 0.343;
/** One flash's thunder: a distance 0.5-2.7 km (or kmFixed), its delay (1.5-7.9 s), a 3-7 s rumble; near under 1.2 km. */
export function thunderOf(rng, kmFixed = NaN, out = {}) {
  const km = Number.isFinite(kmFixed) ? clamp(kmFixed, 0.515, 2.7) : 0.515 + 2.185 * rng(); // 1.50-7.87 s
  out.km = km; out.delay = km / SOUND_KMS; out.len = 3 + 4 * rng(); out.near = km < 1.2;
  return out;
}
/** The reduced-motion thunder (no flashes to follow): an exponential timer, mean 40 s, never under 20 s. */
export const THUNDER_TIMER = { mean: 40, min: 20 };

/** The controller's alarm: two-tone beeps every 6 s for the first 120 real seconds of a dark house, then every 15 s. */
export const ALARM = { early: 6, late: 15, lateAfter: 120 };
export const alarmGap = (darkSec) => (darkSec < ALARM.lateAfter ? ALARM.early : ALARM.late);

/** The office desk fan: within 6 m of the desk, 06:00-19:00. */
export function deskFanOn(S) { return S.hour >= 6 && S.hour < 19 && dist(S, PLACES.desk) < 6; }
export const deskFanTarget = (S) => (deskFanOn(S) ? 1 / (1 + dist(S, PLACES.desk) / 3) : 0);

/** The catching crew's murmur: from EV.CATCH start to its end, within 15 m of the crew (S.crewX / crewZ, else the panels). */
export function crewTarget(S) {
  if (!S.catching) return 0;
  const cx = Number.isFinite(S.crewX) ? S.crewX : PLACES.catchPanels.x, cz = Number.isFinite(S.crewZ) ? S.crewZ : PLACES.catchPanels.z;
  const d = Math.hypot(S.x - cx, S.z - cz);
  if (d >= 15) return 0;
  return (1 / (1 + d / 4)) * smooth(15, 11, d) * (S.inside ? 1 : 0.7);
}
/** Crate clacks per real second while the crew catches (0.2 at the edge of earshot .. 0.5 beside them), heard within 15 m. */
export const crateRate = (S) => { const c = crewTarget(S); return c > 0 ? 0.2 + 0.3 * clamp(c * 1.25, 0, 1) : 0; };

/**
 * The wash bay's machines from the game: washer 1 = the wash-bay machine job runs (ui.busyPanels() has 'wash-bay'),
 * 2 = he carries the washer inside the house; the sprayer and the scraper only in his hands inside.
 */
export function washerOf(busyIds, carrying, inside) {
  const wash = inside && carrying === 'washer' ? 2 : Array.isArray(busyIds) && busyIds.includes('wash-bay') ? 1 : 0;
  return { washer: wash, sprayer: !!inside && carrying === 'sprayer', scraper: !!inside && carrying === 'scraper' };
}
/** The phone rings when a letter comes and he is within 30 m of the desk. */
export const ringHeard = (S) => dist(S, PLACES.desk) < 30;
