// Spatial helpers for the flock. Owner: flock agent.
//  - ComfortField: env.comfort(x, z) cached on a 0.5 m lattice over the bird floor and sampled
//    bilinearly, refreshed when the climate changes (cheap to sample thousands of times a frame).
//  - BirdGrid: uniform spatial hash (counting sort, no allocation per frame) for neighbour
//    queries, plus a coarse 1 m density grid used to steer birds toward emptier floor.
import { BIRD_BOUNDS } from './config.js';

const FX0 = BIRD_BOUNDS.xMin, FX1 = BIRD_BOUNDS.xMax, FZ0 = BIRD_BOUNDS.zMin, FZ1 = BIRD_BOUNDS.zMax;

// What birds respond to ("felt comfort"): env.comfort(x, z), except that brooder radiant heat
// pushing the floor ABOVE target counts only 45 %: in a cold house a bird soaks up all the
// radiant it can get (huddles right under the brooder), but when the air is already at or above
// target it just shifts a little out of the hot spot. So a brooder left on in a house at target
// clears a small patch under itself instead of driving the flock to the walls. The radiant part
// is found by sampling env.comfort with env.heaterLevel held at 0 during the (synchronous) refresh.
const RADIANT_FELT_ABOVE_TARGET = 0.45;

export function createComfortField() {
  const nx = Math.ceil((FX1 - FX0) / 0.5) + 1;
  const nz = Math.ceil((FZ1 - FZ0) / 0.5) + 1;
  const sx = (FX1 - FX0) / (nx - 1), sz = (FZ1 - FZ0) / (nz - 1);
  const v = new Float32Array(nx * nz);
  const air = new Float32Array(nx * nz);
  const sig = new Float64Array(6).fill(NaN);
  let age = 1e9;
  return {
    // Recompute when any climate input moved (at most every 0.25 s for slow drifts).
    // Returns 2 after a big change (birds should reconsider at once), 1 after a small one, else 0.
    refresh(env, dt) {
      age += dt;
      const s0 = env.houseTemp, s1 = env.heaterLevel, s2 = env.targetTemp, s3 = env.windChill, s4 = env.fansOn;
      const big = Math.abs(s0 - sig[0]) > 0.5 || Math.abs(s1 - sig[1]) > 0.15 || Math.abs(s2 - sig[2]) > 0.5 ||
        Math.abs(s3 - sig[3]) > 0.5 || s4 !== sig[4] || Number.isNaN(sig[0]);
      const small = s0 !== sig[0] || s1 !== sig[1] || s2 !== sig[2] || s3 !== sig[3];
      if (!big && !(small && age > 0.25)) return 0;
      sig[0] = s0; sig[1] = s1; sig[2] = s2; sig[3] = s3; sig[4] = s4;
      age = 0;
      for (let j = 0; j < nz; j++) {
        const z = FZ0 + j * sz;
        for (let i = 0; i < nx; i++) v[j * nx + i] = env.comfort(FX0 + i * sx, z);
      }
      if (s1 > 0.01) {
        try {
          env.heaterLevel = 0;
          for (let j = 0; j < nz; j++) {
            const z = FZ0 + j * sz;
            for (let i = 0; i < nx; i++) air[j * nx + i] = env.comfort(FX0 + i * sx, z);
          }
        } finally {
          env.heaterLevel = s1;
        }
        for (let k = 0; k < v.length; k++) {
          const full = v[k], radiant = full - air[k], aboveTarget = full - Math.max(0, air[k]);
          if (radiant > 0 && aboveTarget > 0) v[k] = full - (1 - RADIANT_FELT_ABOVE_TARGET) * Math.min(radiant, aboveTarget);
        }
      }
      return big ? 2 : 1;
    },
    sample(x, z) {
      let fx = (x - FX0) / sx, fz = (z - FZ0) / sz;
      if (fx < 0) fx = 0; else if (fx > nx - 1.001) fx = nx - 1.001;
      if (fz < 0) fz = 0; else if (fz > nz - 1.001) fz = nz - 1.001;
      const i = fx | 0, j = fz | 0, ax = fx - i, az = fz - j;
      const k = j * nx + i;
      const a = v[k] + (v[k + 1] - v[k]) * ax;
      const b = v[k + nx] + (v[k + nx + 1] - v[k + nx]) * ax;
      return a + (b - a) * az;
    },
  };
}

// Grid covers the bird floor with a 1 m margin.
const GX0 = FX0 - 1, GZ0 = FZ0 - 1, GW = FX1 - FX0 + 2, GD = FZ1 - FZ0 + 2;
const MIN_CELL = 0.25;

export function createBirdGrid(n) {
  const maxCells = (Math.ceil(GW / MIN_CELL) + 1) * (Math.ceil(GD / MIN_CELL) + 1);
  const cellStart = new Int32Array(maxCells + 1);
  const cellFill = new Int32Array(maxCells);
  const items = new Int32Array(n);
  const cellOf = new Int32Array(n);
  // density grid, 1 m cells
  const dnx = Math.ceil(GW), dnz = Math.ceil(GD);
  const dens = new Float32Array(dnx * dnz);
  const g = {
    cell: 0.5, inv: 2, nx: 1, nz: 1, cellStart, items, dens, densNorm: 1,
    // Rebuild from positions; cell = interaction radius (>= MIN_CELL). perM2 = mean birds per m².
    build(px, pz, count, cell, perM2) {
      cell = Math.max(MIN_CELL, cell);
      g.cell = cell; g.inv = 1 / cell;
      const nx = (g.nx = Math.ceil(GW / cell) + 1), nz = (g.nz = Math.ceil(GD / cell) + 1);
      const nc = nx * nz;
      cellStart.fill(0, 0, nc + 1);
      dens.fill(0);
      for (let i = 0; i < count; i++) {
        let cx = ((px[i] - GX0) * g.inv) | 0, cz = ((pz[i] - GZ0) * g.inv) | 0;
        if (cx < 0) cx = 0; else if (cx >= nx) cx = nx - 1;
        if (cz < 0) cz = 0; else if (cz >= nz) cz = nz - 1;
        const c = cz * nx + cx;
        cellOf[i] = c;
        cellStart[c + 1]++;
        let dx = (px[i] - GX0) | 0, dz = (pz[i] - GZ0) | 0;
        if (dx < 0) dx = 0; else if (dx >= dnx) dx = dnx - 1;
        if (dz < 0) dz = 0; else if (dz >= dnz) dz = dnz - 1;
        dens[dz * dnx + dx] += 1;
      }
      for (let c = 0; c < nc; c++) { cellStart[c + 1] += cellStart[c]; cellFill[c] = cellStart[c]; }
      for (let i = 0; i < count; i++) items[cellFill[cellOf[i]]++] = i;
      g.densNorm = 1 / Math.max(0.05, perM2);
    },
    cellX(x) { const c = ((x - GX0) * g.inv) | 0; return c < 0 ? 0 : c >= g.nx ? g.nx - 1 : c; },
    cellZ(z) { const c = ((z - GZ0) * g.inv) | 0; return c < 0 ? 0 : c >= g.nz ? g.nz - 1 : c; },
    // Crowding at (x, z): birds per m² in that 1 m cell relative to the flock mean (1 = average)
    crowd(x, z) {
      let dx = (x - GX0) | 0, dz = (z - GZ0) | 0;
      if (dx < 0) dx = 0; else if (dx >= dnx) dx = dnx - 1;
      if (dz < 0) dz = 0; else if (dz >= dnz) dz = dnz - 1;
      return dens[dz * dnx + dx] * g.densNorm;
    },
  };
  return g;
}
