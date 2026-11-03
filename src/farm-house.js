// Farm model, the whole house from Week 2 (PHASE3.md §6.2-§6.4): the floor in use (the brooding half
// while the curtain is down, all 576 cells after the lift), what the birds feel there per cell and per
// 6 m strip (farm-heat.js: humidity term, panting, heat deaths, intake), crowding, gas, dust and
// ammonia. Pure logic, package "sim". Runs only while farm.cyc.on (farm-cycle.js), so the brooding
// week keeps Phase 2's comfort (farm-comfort.js) to its end.
//
// felt per cell = the terms of env.localTemp (house air, wind chill, brooder radiant, brooders out,
// side walls, tunnel gradient: the same arithmetic, precomputed per cell, x clamped to BIRD_BOUNDS as
// farm-heat.heatState does) + humidityTerm(house RH, house °C) + the litter term (Phase 2's wet chill
// and thin litter). e = felt - target. The birds spread evenly over the floor in use.
import { HEATERS, BIRD_BOUNDS, FAN_COUNT, BROOD_BOUNDS } from './config.js';
import { pantingAt, heatDeathRate, heatIntake, humidityTerm, hotFrom, deathFrom, ZONES, dustIndex } from './farm-heat.js';
import { BROOD_CELLS, ALL_CELLS, cellCentre, usedCells } from './farm-litter.js';
import { LITTER_FEEL, comfortNow } from './farm-comfort.js';

// model constants (PHASE3.md §6.2, §6.4; tuning log §6.16)
export const HOUSE_MODEL = {
  crowdA0: 30, crowdPerDay: 1.2, crowdMin: 11, crowdSlope: 0.15, crowdMinF: 0.7, crowdCv: 0.01,   // A(a) = max(11, 30 - 1.2a)
  gasKgPerH: 0.2,                  // per brooder at full output (8 brooders: 1.6 kg/h; tuned from 0.15 so the ideal burns 200-300 kg to day 21)
  nh3K: 0.2, nh3WetFrom: 28, nh3WetPerPct: 0.25,  // Week 2 on: x (1 + 0.25 x (m - 28)) above 28 % (wet litter releases far more)
};

const N = ALL_CELLS.length, NH = HEATERS.length;
const CX = new Float64Array(N), CZ = new Float64Array(N), WALL = new Float64Array(N), ALONG = new Float64Array(N);
const ZONE = new Uint8Array(N), G = new Float64Array(N * NH), R_ALL = new Float64Array(N);
const IN_BROOD = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const c = cellCentre(i);
  const x = Math.max(BIRD_BOUNDS.xMin, Math.min(BIRD_BOUNDS.xMax, c.x)), z = c.z;
  CX[i] = x; CZ[i] = z;
  const wd = Math.min(z - BIRD_BOUNDS.zMin, BIRD_BOUNDS.zMax - z);
  WALL[i] = wd < 1.5 ? 1.0 * (1 - wd / 1.5) : 0;
  ALONG[i] = (x - BIRD_BOUNDS.xMin) / (BIRD_BOUNDS.xMax - BIRD_BOUNDS.xMin);
  ZONE[i] = Math.min(ZONES - 1, Math.floor(((i % 48) * ZONES) / 48));
  let r = 0;
  for (let h = 0; h < NH; h++) { const g = Math.exp(-((x - HEATERS[h].x) ** 2 + (z - HEATERS[h].z) ** 2) / (2 * 1.6 * 1.6)); G[i * NH + h] = g; r += g; }
  R_ALL[i] = Math.min(1, r);
}
for (const i of BROOD_CELLS) IN_BROOD[i] = 1;
/** The 6 m strip (0 = pad end, west .. 7 = fan end) of a cell. */
export const zoneOfCell = (i) => ZONE[i];
const E = new Float64Array(N), SORT = new Float64Array(N);

/** Felt temperature at every cell in `cells` into E (minus the target: e). */
function fillFelt(env, farm, cells, age) {
  const lvl = env.heaterLevel > 0.01 ? env.heaterLevel : 0, out = env.brooderOut, anyOut = out.length > 0;
  const fans = env.levelClimate ? env.fansEffective : env.fansOn;
  const base = env.houseTemp - env.windChill + humidityTerm(env.houseRH, env.houseTemp) - env.targetTemp;
  const grad = fans > 0 ? 1.5 * (fans / FAN_COUNT) : 0;
  const L = farm.litter, K = LITTER_FEEL;
  for (let k = 0; k < cells.length; k++) {
    const i = cells[k];
    let t = base - WALL[i];
    if (lvl > 0) {
      let r;
      if (!anyOut) r = R_ALL[i];
      else { r = 0; for (let h = 0; h < NH; h++) if (!out.includes(h)) r += G[i * NH + h]; r = Math.min(1, r); }
      t += 7 * lvl * r;
    }
    if (env.levelClimate && anyOut) t += env.outAirDev(CX[i], CZ[i]);
    if (grad) t += (ALONG[i] - 0.5) * grad;
    // the litter: wet litter chills, thin litter lets the slab draw heat from young birds (Phase 2)
    const m = L.moistureGrid[i];
    if (m > K.wetFromPct) t -= K.wetPerPct * (m - K.wetRefPct);
    if (age < K.thinUntilAge) {
      const d = L.coverGrid[i] >= 0.5 ? L.depthGrid[i] : 0;
      if (d < K.thinBelowCm) t -= K.thinPerCm * (K.thinBelowCm - d) * (1 - Math.max(0, age) / K.thinUntilAge);
    }
    E[i] = t;
  }
}

/**
 * The comfort of the birds on the floor in use now (farm.comfort, PHASE3.md §13.5).
 * eZ[8] mean e of each 6 m strip (NaN where no birds), wZ[8] the strip's share of the birds, e the 0.3
 * quantile (Phase 2's figure), meanOver, coldShare (e < -2), pantShare, heatDeathPerH (share of the birds
 * per hour), fHeat (intake factor), hotFrom / deathFrom (°C over the target at this age), feltMean °C,
 * groupShare (birds in strips inside -1.5..hotFrom), eG (Phase 2's brooder groups while the brooders burn).
 */
export function houseComfort(env, farm, out, age, weightG) {
  const cells = usedCells(farm.litter);
  fillFelt(env, farm, cells, age);
  const eZ = out.eZ && out.eZ.length === ZONES ? out.eZ : (out.eZ = new Float64Array(ZONES));
  const wZ = out.wZ && out.wZ.length === ZONES ? out.wZ : (out.wZ = new Float64Array(ZONES));
  const nZ = [0, 0, 0, 0, 0, 0, 0, 0];
  eZ.fill(0);
  let sum = 0, cold = 0, pant = 0, death = 0, fh = 0;
  const hf = hotFrom(age), df = deathFrom(age, weightG);
  for (let k = 0; k < cells.length; k++) {
    const i = cells[k], e = E[i];
    sum += e; SORT[k] = e; eZ[ZONE[i]] += e; nZ[ZONE[i]]++;
    if (e < -2) cold++;
    pant += pantingAt(e, age); death += heatDeathRate(e, age, weightG); fh += heatIntake(e, age);
  }
  const n = cells.length;
  let ok = 0;
  for (let z = 0; z < ZONES; z++) {
    if (nZ[z]) { eZ[z] /= nZ[z]; wZ[z] = nZ[z] / n; if (eZ[z] >= -1.5 && eZ[z] <= hf) ok += wZ[z]; } else { eZ[z] = NaN; wZ[z] = 0; }
  }
  const sorted = SORT.subarray(0, n);
  sorted.sort();
  out.e = sorted[Math.floor(0.3 * (n - 1))];
  out.meanOver = sum / n; out.feltMean = sum / n + env.targetTemp;
  out.coldShare = cold / n; out.pantShare = pant / n; out.heatDeathPerH = death / n; out.fHeat = fh / n;
  out.hotFrom = hf; out.deathFrom = df; out.groupShare = ok;
  // the brooder groups (Phase 2's eG) while the brooders burn: the scene's huddles for young birds
  if (env.heaterLevel > 0.01 && !farm.litter.usedAll) { const tmp = out._p2 || (out._p2 = {}); comfortNow(env, tmp, { litter: farm.litter, age }); out.eG = tmp.eG; }
  return out;
}

/** Mean e per strip of the birds' cells only for a point (x): the strip's e, or the nearest used strip. */
export function eAt(comfort, x) {
  const z = Math.max(0, Math.min(ZONES - 1, Math.floor(((x + 24) / 48) * ZONES)));
  const v = comfort.eZ ? comfort.eZ[z] : NaN;
  return Number.isFinite(v) ? v : comfort.e ?? 0;
}

/** Crowding (PHASE3.md §6.2): allowed birds per m², density, f_space and the CV term per day. */
export function crowding(farm, age) {
  const M = HOUSE_MODEL, used = usedCells(farm.litter).length;
  const A = Math.max(M.crowdMin, M.crowdA0 - M.crowdPerDay * age), D = farm.flock.alive / used;
  const over = Math.max(0, D / A - 1);
  return { A, D, ratio: D / A, fSpace: Math.max(M.crowdMinF, 1 - M.crowdSlope * over), dcv: M.crowdCv * over };
}

/** Ammonia from Week 2 (PHASE3.md §6.4): 0.2 x F7 x (0.4 + m/20) / sqrt(airflow) x 300/|U|, wet litter x more. */
export function ammonia(farm, env, f7Kg) {
  const M = HOUSE_MODEL, L = farm.litter, m = L.meanMoisturePct, used = usedCells(L).length;
  const wet = 1 + M.nh3WetPerPct * Math.max(0, m - M.nh3WetFrom);
  return ((M.nh3K * f7Kg * (0.4 + m / 20) * wet) / Math.sqrt(Math.max(1, env.airflowM3h))) * (300 / used);
}

/** Dust in the air now (farm-heat.dustIndex). */
export const dustNow = (env, age) => dustIndex(env, age);

/** Gas the brooders burn this step (kg): heater output x lit brooders x 0.15 kg/h. */
export const gasKg = (env, hrs) => env.heaterLevel * (NH - env.brooderOut.length) * HOUSE_MODEL.gasKgPerH * hrs;

/** Cells of the brooding half (x < BROOD_BOUNDS.xMax): the litter mean there (lateLift). */
export const BROOD_HALF = BROOD_CELLS;
export const inBrood = (i) => !!IN_BROOD[i];
export { BROOD_BOUNDS };
