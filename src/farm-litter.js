// Farm model, litter (PHASE2.md §6.7): cover and depth per FLOOR_GRID cell, moisture (water in
// from droppings, spill and the leak; drying into the air), caking and ammonia. Package "sim".
import { FLOOR_GRID, BROOD_BOUNDS, DRINKER_LINES_Z } from './config.js';

// model constants
export const LITTER = {
  dryKgPerCm: 0.8,         // husk ~80 kg/m3 (tuned from 100): 0.8 kg per cm per m2 cell
  freshPct: 12,
  bareReadsPct: 60,        // water stands on bare concrete
  dryRate: 0.045,         // kg/h per kg dry husk per unit of (m - 12)/100 at 50 % RH (tuned from 0.034)
  underLine: 1.5,          // droppings x 1.5 under the drinker lines
  cakeAbovePct: 40, cakeAfterH: 6,
  patchPct: 15,
  nh3K: 0.2,               // ppm = 0.2 x feed kg x (0.4 + m / 20) / sqrt(airflow)
};

const N = FLOOR_GRID.nx * FLOOR_GRID.nz;
const cx = (i) => i % FLOOR_GRID.nx, cz = (i) => Math.floor(i / FLOOR_GRID.nx);
export const cellCentre = (i) => ({ x: FLOOR_GRID.x0 + (cx(i) + 0.5) * FLOOR_GRID.cell, z: FLOOR_GRID.z0 + (cz(i) + 0.5) * FLOOR_GRID.cell });
const insideBrood = (p) => p.x >= BROOD_BOUNDS.xMin && p.x <= BROOD_BOUNDS.xMax && p.z >= BROOD_BOUNDS.zMin && p.z <= BROOD_BOUNDS.zMax;

/** The 300 brooding cells (centre inside BROOD_BOUNDS). */
export const BROOD_CELLS = [];
for (let i = 0; i < N; i++) if (insideBrood(cellCentre(i))) BROOD_CELLS.push(i);
/** Row of cells (cz) under each drinker line. */
export const LINE_ROWS = DRINKER_LINES_Z.map((z) => Math.floor((z - FLOOR_GRID.z0) / FLOOR_GRID.cell));
const UNDER_LINE = new Uint8Array(N);
for (const i of BROOD_CELLS) if (LINE_ROWS.includes(cz(i))) UNDER_LINE[i] = 1;
const LINE_CELLS = LINE_ROWS.map((row) => BROOD_CELLS.filter((i) => cz(i) === row));
const W_SUM = BROOD_CELLS.length + (1.5 - 1) * BROOD_CELLS.filter((i) => UNDER_LINE[i]).length; // LITTER.underLine

export function cellIndex(x, z) {
  const ix = Math.max(0, Math.min(FLOOR_GRID.nx - 1, Math.floor((x - FLOOR_GRID.x0) / FLOOR_GRID.cell)));
  const iz = Math.max(0, Math.min(FLOOR_GRID.nz - 1, Math.floor((z - FLOOR_GRID.z0) / FLOOR_GRID.cell)));
  return iz * FLOOR_GRID.nx + ix;
}

export function createLitter() {
  return {
    depthCm: 5,                          // depth the heap panel is set to (litter.depth)
    cover: 0,                            // share of the brooding cells covered (0..1)
    coverGrid: new Float32Array(N),      // 0 bare concrete .. 1 husk
    depthGrid: new Float32Array(N),      // cm of husk per cell
    waterGrid: new Float32Array(N),      // kg of water per cell
    moistureGrid: new Float32Array(N).fill(LITTER.bareReadsPct), // % per cell (what a squeeze reads)
    cakedHours: new Float32Array(N),     // hours above 40 %
    cakedGrid: new Uint8Array(N),
    meanMoisturePct: LITTER.freshPct,
    ammoniaPpm: 0,
    vapourGh: 0,
    version: 0,                          // bumps when the grids change (props repaint)
  };
}

const dryOf = (L, i) => L.depthGrid[i] * L.coverGrid[i] * LITTER.dryKgPerCm;
function refreshCell(L, i) {
  const dry = dryOf(L, i);
  L.moistureGrid[i] = L.coverGrid[i] < 0.5 || dry <= 0 ? LITTER.bareReadsPct : (100 * L.waterGrid[i]) / (dry + L.waterGrid[i]);
}
const setPct = (L, i, pct) => { const dry = dryOf(L, i); L.waterGrid[i] = (dry * pct) / (100 - pct); refreshCell(L, i); };

/** Barrow swath: cells whose centre is within r of (x, z) get husk at the heap's depth. */
export function spread(L, x, z, r) {
  let changed = false;
  for (let i = 0; i < N; i++) {
    if (L.coverGrid[i] >= 1) continue;
    const c = cellCentre(i);
    if ((c.x - x) ** 2 + (c.z - z) ** 2 > r * r) continue;
    L.coverGrid[i] = 1; L.depthGrid[i] = L.depthCm; setPct(L, i, LITTER.freshPct);
    changed = true;
  }
  if (changed) { updateCover(L); L.version++; }
  return L.cover;
}

export function updateCover(L) {
  let c = 0;
  for (const i of BROOD_CELLS) c += L.coverGrid[i];
  L.cover = c / BROOD_CELLS.length;
}

/** Fresh husk on a wet patch: the cell (and the ones touching it within 0.8 m) back to 15 %. */
export function patch(L, x, z) {
  for (let i = 0; i < N; i++) {
    const c = cellCentre(i);
    if (Math.abs(c.x - x) > 1.3 || Math.abs(c.z - z) > 1.3) continue;
    if (i !== cellIndex(x, z) && L.moistureGrid[i] < 30) continue;
    if (L.coverGrid[i] < 1) { L.coverGrid[i] = 1; L.depthGrid[i] = Math.max(L.depthCm, 5); }
    setPct(L, i, LITTER.patchPct); L.cakedHours[i] = 0; L.cakedGrid[i] = 0;
  }
  updateCover(L); L.version++;
}

/** Mean house litter depth (cm over the covered brooding floor), for env.litterDepthCm. */
export function meanDepth(L) {
  let s = 0, n = 0;
  for (const i of BROOD_CELLS) { if (L.coverGrid[i] > 0) { s += L.depthGrid[i] * L.coverGrid[i]; n++; } }
  return n ? s / n : 0;
}

/**
 * One step: droppings water (litres, spread over the brooding cells, x 1.5 under the lines),
 * spill per line, the leak into its cell, drying at the house humidity, caking, ammonia.
 */
export function stepLitter(L, { hrs, droppingsL, spill, leakL, leakCell, rh, feedKg, airflow }) {
  const wSum = W_SUM;
  const per = droppingsL / wSum;
  const dry0 = LITTER.dryRate / 0.5, dryK = dry0 * Math.max(0, 1 - rh / 100);
  let vap = 0, pot = 0, sumM = 0, nM = 0;
  for (let k = 0; k < BROOD_CELLS.length; k++) {
    const i = BROOD_CELLS[k];
    L.waterGrid[i] += per * (UNDER_LINE[i] ? LITTER.underLine : 1);
  }
  for (let li = 0; li < LINE_CELLS.length; li++) {
    const cells = LINE_CELLS[li], s = (spill[li] || 0) / cells.length;
    if (s > 0) for (const i of cells) L.waterGrid[i] += s;
  }
  if (leakL > 0 && leakCell != null) L.waterGrid[leakCell] += leakL;
  let changed = false;
  for (let k = 0; k < BROOD_CELLS.length; k++) {
    const i = BROOD_CELLS[k];
    const dry = dryOf(L, i);
    if (dry > 0 && L.coverGrid[i] >= 0.5) {
      const m = (100 * L.waterGrid[i]) / (dry + L.waterGrid[i]);
      const p = dry * (Math.max(0, m - LITTER.freshPct) / 100);
      const d = Math.min(L.waterGrid[i], dryK * p * hrs);
      L.waterGrid[i] -= d; vap += d; pot += dry0 * p;
    } else {
      L.waterGrid[i] = Math.max(0, L.waterGrid[i] * (1 - 0.05 * hrs)); // standing water seeps away
    }
    const before = L.moistureGrid[i];
    refreshCell(L, i);
    const m = L.moistureGrid[i];
    if (Math.abs(m - before) > 0.5) changed = true;
    if (L.coverGrid[i] >= 0.5) {
      if (m > LITTER.cakeAbovePct) {
        L.cakedHours[i] += hrs;
        if (!L.cakedGrid[i] && L.cakedHours[i] >= LITTER.cakeAfterH) { L.cakedGrid[i] = 1; changed = true; }
      }
      sumM += m; nM++;
    }
  }
  L.meanMoisturePct = nM ? sumM / nM : LITTER.freshPct;
  L.vapourGh = (vap * 1000) / hrs;
  L.dryPotentialGh = pot * 1000; // drying at 0 % RH (the climate solves RH with it)
  L.ammoniaPpm = (LITTER.nh3K * feedKg * (0.4 + L.meanMoisturePct / 20)) / Math.sqrt(Math.max(1, airflow));
  if (changed) L.version++;
  return vap;
}

export function serializeLitter(L) {
  const ints = (a, k) => Array.from(a, (v) => Math.round(v * k));
  const caked = [];
  for (let i = 0; i < N; i++) if (L.cakedHours[i] > 0) caked.push(i, Math.round(L.cakedHours[i] * 100), L.cakedGrid[i]);
  return { depthCm: L.depthCm, cover: rle(ints(L.coverGrid, 100)), depth: rle(ints(L.depthGrid, 10)), moisture: ints(L.moistureGrid, 10), caked };
}

export function restoreLitter(L, d) {
  if (!d) return;
  L.depthCm = d.depthCm ?? L.depthCm;
  const cover = unrle(d.cover), depth = unrle(d.depth);
  for (let i = 0; i < N; i++) {
    L.coverGrid[i] = (cover[i] ?? 0) / 100; L.depthGrid[i] = (depth[i] ?? 0) / 10;
    const pct = (d.moisture?.[i] ?? LITTER.bareReadsPct * 10) / 10;
    const dry = dryOf(L, i);
    L.waterGrid[i] = dry > 0 && L.coverGrid[i] >= 0.5 ? (dry * pct) / (100 - pct) : 0;
    L.moistureGrid[i] = pct;
    L.cakedHours[i] = 0; L.cakedGrid[i] = 0;
  }
  const c = d.caked || [];
  for (let k = 0; k + 2 < c.length; k += 3) { L.cakedHours[c[k]] = c[k + 1] / 100; L.cakedGrid[c[k]] = c[k + 2]; }
  updateCover(L); L.version++;
}

/** Run-length pairs [value, count, ...] for grids that are mostly one value (cover, depth). */
function rle(a) {
  const out = [];
  for (let i = 0; i < a.length;) { let j = i; while (j < a.length && a[j] === a[i]) j++; out.push(a[i], j - i); i = j; }
  return out;
}
function unrle(r) {
  const out = [];
  for (let k = 0; r && k + 1 < r.length; k += 2) for (let n = 0; n < r[k + 1]; n++) out.push(r[k]);
  return out;
}
