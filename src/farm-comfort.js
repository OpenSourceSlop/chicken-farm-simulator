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

// What the litter does to the felt temperature (model): wet litter chills the chicks
// (above wetFromPct: -wetPerPct °C per % over wetRefPct), and thin litter lets the slab draw heat
// from them in the first days (-thinPerCm °C per cm under thinBelowCm, fading out by thinUntilAge).
export const LITTER_FEEL = { wetFromPct: 35, wetRefPct: 30, wetPerPct: 0.1, thinBelowCm: 5, thinPerCm: 0.4, thinUntilAge: 10 };

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
// the cells of each chick group, their share of the floor (the chicks spread with the floor) and a
// scratch array per group for its own 0.3 quantile
const ZCELLS = HEATERS.map((_, i) => { const a = []; for (let p = 0; p < P; p++) if (ZONE[p] === i) a.push(p); return Int32Array.from(a); });
export const GROUP_W = ZCELLS.map((a) => a.length / P);
const ZBUF = ZCELLS.map((a) => new Float64Array(a.length));
const ZK30 = ZCELLS.map((a) => Math.floor(0.3 * (a.length - 1)));
const felt = new Float64Array(P), sorted = new Float64Array(P), zoneMin = new Float64Array(HEATERS.length);
const R_ALL = new Float64Array(P); // radiant weight with every brooder burning
for (let p = 0; p < P; p++) { let r = 0; for (let i = 0; i < HEATERS.length; i++) r += G[p * HEATERS.length + i]; R_ALL[p] = Math.min(1, r); }
const K30 = Math.floor(0.3 * (P - 1));
/** k-th smallest of a[0..n) (quickselect, reorders a). */
function select(a, k) {
  let lo = 0, hi = a.length - 1;
  while (hi > lo) {
    const pv = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) { while (a[i] < pv) i++; while (a[j] > pv) j--; if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; } }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
  }
  return a[k];
}

/** Felt temperature at every brooding cell now (fills `felt`): the terms of env.localTemp, plus
 *  the litter (wet, thin) when `litter` is given. */
function fill(env, litter, age) {
  const out = env.brooderOut, lvl = env.heaterLevel > 0.01 ? env.heaterLevel : 0;
  const fans = env.levelClimate ? env.fanMean : env.fansOn;
  const base = env.houseTemp - env.windChill, outAir = env.levelClimate && out.length > 0;
  const anyOut = out.length > 0;
  for (let p = 0; p < P; p++) {
    let r = 0;
    if (lvl > 0) {
      if (!anyOut) r = R_ALL[p];
      else { for (let i = 0; i < HEATERS.length; i++) if (!out.includes(i)) r += G[p * HEATERS.length + i]; r = Math.min(1, r); }
    }
    let t = base + 7 * lvl * r - WALL[p];
    if (fans > 0) t += (ALONG[p] - 0.5) * 1.5 * (fans / FAN_COUNT);
    if (outAir) t += env.outAirDev(PX[p], PZ[p]);
    if (litter) {
      const i = BROOD_CELLS[p], K = LITTER_FEEL;
      const m = litter.moistureGrid[i];
      if (m > K.wetFromPct) t -= K.wetPerPct * (m - K.wetRefPct);
      const d = litter.coverGrid[i] >= 0.5 ? litter.depthGrid[i] : 0;
      if (d < K.thinBelowCm && age < K.thinUntilAge) t -= K.thinPerCm * (K.thinBelowCm - d) * (1 - Math.max(0, age) / K.thinUntilAge);
    }
    felt[p] = t;
  }
}

/**
 * The comfort figures of the brooding floor now.
 * @returns {{ e: number, meanOver: number, coldShare: number, pantShare: number, groupShare: number }}
 *   e          felt at the 0.3 quantile (70 % of the floor at least this warm) - target
 *   meanOver   mean felt - target
 *   coldShare  share of the floor felt below target - 2 (chicks huddle)
 *   pantShare  share of the floor felt above target + 2 (chicks pant if they cannot move away)
 *   groupShare share of the chicks (eight groups, one per brooder, weighted by floor) whose group
 *              is in the comfort band (-1.5..+2 °C) and has a spot that is not too warm
 *   eG         e of each chick group (its own 0.3 quantile - target), Float64Array(8)
 */
export function comfortNow(env, out = {}, { litter = null, age = 0 } = {}) {
  fill(env, litter, age);
  const tgt = env.targetTemp;
  let sum = 0, cold = 0, hot = 0;
  zoneMin.fill(Infinity);
  for (let p = 0; p < P; p++) {
    const e = felt[p] - tgt;
    sum += e; sorted[p] = felt[p];
    if (e < -2) cold++;
    if (e > 2) hot++;
    if (e < zoneMin[ZONE[p]]) zoneMin[ZONE[p]] = e;
  }
  out.e = select(sorted, K30) - tgt;
  out.meanOver = sum / P;
  out.coldShare = cold / P;
  // the birds move away from a hot brooder: they pant only where the whole floor is hot
  out.pantShare = out.e > 1.5 ? hot / P : out.meanOver > 1.5 ? (hot / P) * 0.5 : 0;
  // each chick group on its own: e of the group (its own 0.3 quantile; in week 1 the chicks stay
  // under their own brooder), and whether the group is in the comfort band (-1.5..+2 °C) with a
  // spot that is not too warm
  const eG = out.eG || (out.eG = new Float64Array(HEATERS.length));
  let ok = 0;
  for (let i = 0; i < HEATERS.length; i++) {
    const cells = ZCELLS[i], buf = ZBUF[i];
    for (let k = 0; k < cells.length; k++) buf[k] = felt[cells[k]];
    eG[i] = select(buf, ZK30[i]) - tgt;
    if (eG[i] >= -1.5 && eG[i] <= 2 && zoneMin[i] <= 2) ok += GROUP_W[i];
  }
  out.groupShare = ok;
  return out;
}

/** Share of the brooding cells whose litter surface is at or above `t` °C. */
export function floorShareAbove(env, t) {
  let n = 0;
  for (let p = 0; p < P; p++) { const c = cellCentre(BROOD_CELLS[p]); if (env.floorTemp(c.x, c.z) >= t) n++; }
  return n / P;
}
