// Farm model, what the chicks feel (PHASE2.md §6.5 "temperature"): the felt temperature over the
// brooding floor (the same terms as env.localTemp, precomputed per cell), the comfort figure e
// the model uses, and the shares of cold and panting birds. Pure logic, package "sim".
//
// e = felt temperature at the "70th-percentile-warmest point" minus the target: the point that
// 70 % of the brooding floor is at least as warm as (the 0.3 quantile from the cold end). Chicks
// that can reach a warm spot are fine; when even that point is cold, most of the flock is cold.
// (Reading it from the warm end would make a brooder that is out, or a cold night, look more
// comfortable, because the brooder radiant makes the warm tail hot; see the package report.)
import { HEATERS, BIRD_BOUNDS, FAN_COUNT } from './config.js';
import { BROOD_CELLS, cellCentre } from './farm-litter.js';

const P = BROOD_CELLS.length;
const G = new Float64Array(P * HEATERS.length);   // brooder radiant weights per point and heater
const WALL = new Float64Array(P), ALONG = new Float64Array(P);
for (let p = 0; p < P; p++) {
  const c = cellCentre(BROOD_CELLS[p]);
  for (let i = 0; i < HEATERS.length; i++) {
    const dx = c.x - HEATERS[i].x, dz = c.z - HEATERS[i].z;
    G[p * HEATERS.length + i] = Math.exp(-(dx * dx + dz * dz) / (2 * 1.6 * 1.6));
  }
  const wd = Math.min(c.z - BIRD_BOUNDS.zMin, BIRD_BOUNDS.zMax - c.z);
  WALL[p] = wd < 1.5 ? 1.0 * (1 - wd / 1.5) : 0;
  ALONG[p] = (c.x - BIRD_BOUNDS.xMin) / (BIRD_BOUNDS.xMax - BIRD_BOUNDS.xMin);
}
// Each cell belongs to the chick group of its nearest brooder (in week 1 the chicks live in eight
// groups, one under each brooder).
const ZONE = new Uint8Array(P), PX = new Float64Array(P), PZ = new Float64Array(P);
for (let p = 0; p < P; p++) {
  const c = cellCentre(BROOD_CELLS[p]);
  PX[p] = c.x; PZ[p] = c.z;
  let best = 0, bd = Infinity;
  for (let i = 0; i < HEATERS.length; i++) { const d = (c.x - HEATERS[i].x) ** 2 + (c.z - HEATERS[i].z) ** 2; if (d < bd) { bd = d; best = i; } }
  ZONE[p] = best;
}
const felt = new Float64Array(P), sorted = new Float64Array(P), zoneMin = new Float64Array(HEATERS.length);

/** Felt temperature at every brooding cell now (fills `felt`): the terms of env.localTemp. */
function fill(env) {
  const out = env.brooderOut, lvl = env.heaterLevel > 0.01 ? env.heaterLevel : 0;
  const fans = env.levelClimate ? env.fanMean : env.fansOn;
  const base = env.houseTemp - env.windChill, outAir = env.levelClimate && out.length > 0;
  for (let p = 0; p < P; p++) {
    let r = 0;
    if (lvl > 0) {
      for (let i = 0; i < HEATERS.length; i++) if (!out.length || !out.includes(i)) r += G[p * HEATERS.length + i];
    }
    let t = base + 7 * lvl * Math.min(1, r) - WALL[p];
    if (fans > 0) t += (ALONG[p] - 0.5) * 1.5 * (fans / FAN_COUNT);
    if (outAir) t += env.outAirDev(PX[p], PZ[p]);
    felt[p] = t;
  }
}

/**
 * The comfort figures of the brooding floor now.
 * @returns {{ e: number, meanOver: number, coldShare: number, pantShare: number, groupShare: number }}
 *   e          felt at the 0.3 quantile (70 % of the floor at least this warm) - target
 *   meanOver   mean felt - target
 *   coldShare  share of the floor felt below target - 2 (chicks huddle)
 *   pantShare  share of the floor felt above target + 2.5 (chicks pant if they cannot move away)
 *   groupShare share of the eight chick groups that can find a spot in the comfort band
 *              (-1.5..+2 °C): warm enough under their own brooder, not too warm at its edge
 */
export function comfortNow(env, out = {}) {
  fill(env);
  const tgt = env.targetTemp;
  let sum = 0, cold = 0, hot = 0;
  zoneMin.fill(Infinity);
  for (let p = 0; p < P; p++) {
    const e = felt[p] - tgt;
    sum += e; sorted[p] = felt[p];
    if (e < -2) cold++;
    if (e > 2.5) hot++;
    if (e < zoneMin[ZONE[p]]) zoneMin[ZONE[p]] = e;
  }
  sorted.sort();
  out.e = sorted[Math.floor(0.3 * (P - 1))] - tgt;
  out.meanOver = sum / P;
  out.coldShare = cold / P;
  // the birds move away from a hot brooder: they pant only where the whole floor is hot
  out.pantShare = out.e > 2 ? hot / P : out.meanOver > 2 ? (hot / P) * 0.5 : 0;
  let ok = 0;
  for (let i = 0; i < HEATERS.length; i++) {
    const warmest = env.localTemp(HEATERS[i].x, HEATERS[i].z) - tgt;
    if (warmest >= -1.5 && zoneMin[i] <= 2) ok++;
  }
  out.groupShare = ok / HEATERS.length;
  return out;
}

/** Share of the brooding cells whose litter surface is at or above `t` °C. */
export function floorShareAbove(env, t) {
  let n = 0;
  for (let p = 0; p < P; p++) { const c = cellCentre(BROOD_CELLS[p]); if (env.floorTemp(c.x, c.z) >= t) n++; }
  return n / P;
}
