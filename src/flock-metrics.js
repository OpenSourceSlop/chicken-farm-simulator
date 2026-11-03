// Flock metrics for tests and the Phase 1 tools. Owner: flock agent.
import { HEATERS, HOUSE_BOUNDS } from './config.js';
import { COLD, HOT, RIGHT } from './flock-state.js';

const SPREAD_CELL = 1.5; // metres
const counts = new Float64Array(64 * 16);
const out = {
  count: 0, meanDistToHeater: 0, meanDistToWall: 0, meanNearestNeighbor: 0,
  fracHuddling: 0, fracPanting: 0, fracComfortable: 0, spreadIndex: 0,
};

function nearestNeighbor(S, grid, i) {
  const x = S.px[i], z = S.pz[i];
  const gx = grid.cellX(x), gz = grid.cellZ(z);
  const { items, cellStart, nx, nz } = grid;
  let best = Infinity;
  for (let ring = 1; ring <= 3; ring++) {
    const z0 = Math.max(0, gz - ring), z1 = Math.min(nz - 1, gz + ring);
    const x0 = Math.max(0, gx - ring), x1 = Math.min(nx - 1, gx + ring);
    for (let qz = z0; qz <= z1; qz++) {
      for (let qx = x0; qx <= x1; qx++) {
        // only the new outer ring after the first pass
        if (ring > 1 && qz > gz - ring && qz < gz + ring && qx > gx - ring && qx < gx + ring) continue;
        const c = qz * nx + qx;
        for (let k = cellStart[c], ke = cellStart[c + 1]; k < ke; k++) {
          const j = items[k];
          if (j === i) continue;
          const dx = x - S.px[j], dz = z - S.pz[j], d2 = dx * dx + dz * dz;
          if (d2 < best) best = d2;
        }
      }
    }
    // a neighbour found within this ring is the true nearest once the ring covers its distance
    if (best <= (ring * grid.cell) ** 2) break;
  }
  return best === Infinity ? 3 * grid.cell : Math.sqrt(best);
}

// Returns a shared object (no allocation); copy it if you keep it.
export function computeMetrics(S, grid) {
  const n = S.n, hb = HOUSE_BOUNDS, b = S.bounds;
  let dh = 0, dw = 0, nn = 0, hud = 0, pant = 0, comf = 0;
  // spreadIndex: split the usable floor (brooding area while the curtain is down, else the whole
  // bird floor) into ~1.5 m cells and count birds per cell c_k. The participation ratio
  // PR = (sum c_k)^2 / sum c_k^2 is the effective number of occupied cells (1 if every bird is in
  // one cell, K if all K cells hold the same count). spreadIndex = (PR - 1) / (K - 1), so 0 = one
  // clump, 1 = perfectly even. A random (Poisson) scatter of this flock scores about 0.9-0.95.
  const W = b.xMax - b.xMin, D = b.zMax - b.zMin;
  const cnx = Math.min(64, Math.max(1, Math.round(W / SPREAD_CELL)));
  const cnz = Math.min(16, Math.max(1, Math.round(D / SPREAD_CELL)));
  const K = cnx * cnz;
  counts.fill(0, 0, K);
  for (let i = 0; i < n; i++) {
    const x = S.px[i], z = S.pz[i];
    let best = 1e9;
    for (let k = 0; k < HEATERS.length; k++) {
      const dx = x - HEATERS[k].x, dz = z - HEATERS[k].z, d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    dh += Math.sqrt(best);
    dw += Math.min(x - hb.xMin, hb.xMax - x, z - hb.zMin, hb.zMax - z);
    const th = S.therm[i];
    if (th === COLD) hud++; else if (th === HOT) pant++; else if (th === RIGHT) comf++;
    nn += nearestNeighbor(S, grid, i);
    let cx = Math.floor(((x - b.xMin) / W) * cnx), cz = Math.floor(((z - b.zMin) / D) * cnz);
    cx = cx < 0 ? 0 : cx >= cnx ? cnx - 1 : cx;
    cz = cz < 0 ? 0 : cz >= cnz ? cnz - 1 : cz;
    counts[cz * cnx + cx]++;
  }
  let s1 = 0, s2 = 0;
  for (let k = 0; k < K; k++) { s1 += counts[k]; s2 += counts[k] * counts[k]; }
  const pr = s2 > 0 ? (s1 * s1) / s2 : 1;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  out.count = n;
  out.meanDistToHeater = r3(dh / n);
  out.meanDistToWall = r3(dw / n);
  out.meanNearestNeighbor = r3(nn / n);
  out.fracHuddling = r3(hud / n);
  out.fracPanting = r3(pant / n);
  out.fracComfortable = r3(comf / n);
  out.spreadIndex = r3(K > 1 ? Math.max(0, Math.min(1, (pr - 1) / (K - 1))) : 1);
  return out;
}
