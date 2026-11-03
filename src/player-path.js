// Click-to-walk route finding. A straight line is used when it is clear; otherwise A* runs on a
// coarse occupancy grid (0.5 m cells over the farm, obstacles grown by the farmer's radius) and
// the cell path is pulled tight with line-of-sight checks. The grid is cached until the colliders
// change, so a click costs a few milliseconds whatever the number of trees, posts or walls.
// This is what walks the farmer round to the house door when you click inside the house.
import { resolve } from './player-collide.js';

const CELL = 0.5;
const TEST_SHRINK = 0.03; // a straight segment may graze an obstacle by this much (collision slides)
const GROW_SHRINK = 0.04; // grid cells are blocked within (radius - this) of an obstacle
const BUDGET_MS = 25; // give up (walk straight, stop when blocked) rather than stall a click
const SQRT2 = Math.SQRT2;

function segHitsBox(ax, az, bx, bz, c, e) {
  const minX = c.minX - e, maxX = c.maxX + e, minZ = c.minZ - e, maxZ = c.maxZ + e;
  if ((ax > bx ? ax : bx) <= minX || (ax < bx ? ax : bx) >= maxX) return false;
  if ((az > bz ? az : bz) <= minZ || (az < bz ? az : bz) >= maxZ) return false;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  if (Math.abs(dx) < 1e-9) { if (ax <= minX || ax >= maxX) return false; } else {
    let ta = (minX - ax) / dx, tb = (maxX - ax) / dx;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 >= t1) return false;
  }
  if (Math.abs(dz) < 1e-9) { if (az <= minZ || az >= maxZ) return false; } else {
    let ta = (minZ - az) / dz, tb = (maxZ - az) / dz;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
  }
  return t1 - t0 > 1e-6;
}

function segHitsCircle(ax, az, bx, bz, c, e) {
  const R = c.r + e;
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz;
  let t = L2 > 1e-12 ? ((c.x - ax) * dx + (c.z - az) * dz) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t - c.x, pz = az + dz * t - c.z;
  return px * px + pz * pz < R * R;
}

// Exact test: can a circle of radius r slide straight from a to b without touching a collider?
export function segmentClear(ax, az, bx, bz, r, colliders) {
  const e = r - TEST_SHRINK;
  for (const c of colliders) {
    if (c.type === 'box' ? segHitsBox(ax, az, bx, bz, c, e) : c.type === 'circle' && segHitsCircle(ax, az, bx, bz, c, e)) return false;
  }
  return true;
}

// Move a clicked point out of obstacles so it is somewhere the farmer can stand.
export function freeSpot(x, z, r, colliders, bounds) {
  const p = { x, z };
  resolve(p, r + 0.05, colliders, bounds);
  return p;
}

// ---------- occupancy grid ----------
let grid = null;

function signature(colliders, r, b) {
  let s = colliders.length * 7.31 + r * 13.7 + b.xMin + b.xMax * 3 + b.zMin * 5 + b.zMax * 11;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    s += (i % 17 + 1) * (c.type === 'box' ? c.minX + c.maxX * 1.3 + c.minZ * 1.7 + c.maxZ * 2.3 : c.x * 3.1 + c.z * 3.7 + c.r * 5.3);
  }
  return s;
}

function buildGrid(colliders, r, b) {
  const nx = Math.max(1, Math.ceil((b.xMax - b.xMin) / CELL));
  const nz = Math.max(1, Math.ceil((b.zMax - b.zMin) / CELL));
  const n = nx * nz;
  const blocked = new Uint8Array(n);
  const e = r - GROW_SHRINK;
  const cx = (i) => b.xMin + (i + 0.5) * CELL;
  const cz = (j) => b.zMin + (j + 0.5) * CELL;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = cx(i), z = cz(j);
      if (x < b.xMin + e || x > b.xMax - e || z < b.zMin + e || z > b.zMax - e) blocked[j * nx + i] = 1;
    }
  }
  for (const c of colliders) {
    const box = c.type === 'box';
    if (!box && c.type !== 'circle') continue;
    const minX = box ? c.minX : c.x - c.r, maxX = box ? c.maxX : c.x + c.r;
    const minZ = box ? c.minZ : c.z - c.r, maxZ = box ? c.maxZ : c.z + c.r;
    const i0 = Math.max(0, Math.floor((minX - e - b.xMin) / CELL));
    const i1 = Math.min(nx - 1, Math.floor((maxX + e - b.xMin) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - e - b.zMin) / CELL));
    const j1 = Math.min(nz - 1, Math.floor((maxZ + e - b.zMin) / CELL));
    for (let j = j0; j <= j1; j++) {
      const z = cz(j);
      for (let i = i0; i <= i1; i++) {
        const x = cx(i);
        let d2;
        if (box) {
          const dx = x < c.minX ? c.minX - x : x > c.maxX ? x - c.maxX : 0;
          const dz = z < c.minZ ? c.minZ - z : z > c.maxZ ? z - c.maxZ : 0;
          d2 = dx * dx + dz * dz;
          if (d2 <= e * e) blocked[j * nx + i] = 1;
        } else {
          d2 = (x - c.x) ** 2 + (z - c.z) ** 2;
          if (d2 <= (c.r + e) ** 2) blocked[j * nx + i] = 1;
        }
      }
    }
  }
  return {
    nx, nz, b, blocked,
    g: new Float32Array(n), came: new Int32Array(n), mark: new Uint32Array(n), stamp: 0,
  };
}

function cellOf(G, x, z) {
  const i = Math.min(G.nx - 1, Math.max(0, Math.floor((x - G.b.xMin) / CELL)));
  const j = Math.min(G.nz - 1, Math.max(0, Math.floor((z - G.b.zMin) / CELL)));
  return j * G.nx + i;
}

// Nearest free cell to `k` within a few rings (the farmer may stand in a blocked cell next to a wall).
function nearestFree(G, k, x, z) {
  if (!G.blocked[k]) return k;
  const i0 = k % G.nx, j0 = (k - i0) / G.nx;
  let best = -1, bestD = Infinity;
  for (let j = j0 - 3; j <= j0 + 3; j++) {
    for (let i = i0 - 3; i <= i0 + 3; i++) {
      if (i < 0 || j < 0 || i >= G.nx || j >= G.nz || G.blocked[j * G.nx + i]) continue;
      const d = (G.b.xMin + (i + 0.5) * CELL - x) ** 2 + (G.b.zMin + (j + 0.5) * CELL - z) ** 2;
      if (d < bestD) { bestD = d; best = j * G.nx + i; }
    }
  }
  return best;
}

// Line of sight on the grid (samples every quarter cell).
function gridLOS(G, ax, az, bx, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.25));
  for (let s = 1; s < n; s++) {
    const t = s / n;
    if (G.blocked[cellOf(G, ax + (bx - ax) * t, az + (bz - az) * t)]) return false;
  }
  return true;
}

const DI = [1, -1, 0, 0, 1, 1, -1, -1];
const DJ = [0, 0, 1, -1, 1, -1, 1, -1];
const DC = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2];
const H_WEIGHT = 1.25; // slightly greedy search: far fewer cells, and the path is pulled tight after

function astar(G, start, goal) {
  const { nx, nz, blocked, g, came, mark } = G;
  if (!G.closed) {
    G.closed = new Uint32Array(blocked.length);
    G.hf = new Float64Array(blocked.length * 4);
    G.hk = new Int32Array(blocked.length * 4);
  }
  const { closed, hf, hk } = G;
  const cap = hf.length;
  const stamp = ++G.stamp;
  const gi = goal % nx, gj = (goal - gi) / nx;
  let size = 0;
  const push = (f, k) => {
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hf[i] = hf[p]; hk[i] = hk[p]; i = p;
    }
    hf[i] = f; hk[i] = k;
  };
  const pop = () => {
    const k = hk[0];
    size--;
    if (size > 0) {
      const lf = hf[size], lk = hk[size];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= size) break;
        if (c + 1 < size && hf[c + 1] < hf[c]) c++;
        if (hf[c] >= lf) break;
        hf[i] = hf[c]; hk[i] = hk[c]; i = c;
      }
      hf[i] = lf; hk[i] = lk;
    }
    return k;
  };
  mark[start] = stamp; g[start] = 0; came[start] = -1;
  push(0, start);
  const t0 = performance.now();
  let pops = 0;
  while (size > 0) {
    const k = pop();
    if (closed[k] === stamp) continue;
    closed[k] = stamp;
    if (k === goal) return true;
    if ((++pops & 2047) === 0 && performance.now() - t0 > BUDGET_MS) return false;
    const i = k % nx, j = (k - i) / nx;
    const gk = g[k];
    for (let d = 0; d < 8; d++) {
      const ii = i + DI[d], jj = j + DJ[d];
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const nk = jj * nx + ii;
      if (blocked[nk] || closed[nk] === stamp) continue;
      if (d >= 4 && (blocked[j * nx + ii] || blocked[jj * nx + i])) continue; // no corner cutting
      const ng = gk + DC[d];
      if (mark[nk] === stamp && ng >= g[nk]) continue;
      mark[nk] = stamp; g[nk] = ng; came[nk] = k;
      const dx = ii > gi ? ii - gi : gi - ii, dz = jj > gj ? jj - gj : gj - jj;
      const h = dx + dz + (SQRT2 - 2) * (dx < dz ? dx : dz);
      if (size >= cap) return false;
      push(ng + H_WEIGHT * h, nk);
    }
  }
  return false;
}

// Returns waypoints [{x, z}, ...] ending at the goal (start excluded), or null when no route.
export function findPath(sx, sz, gx, gz, r, colliders, bounds) {
  if (segmentClear(sx, sz, gx, gz, r, colliders)) return [{ x: gx, z: gz }];
  const b = bounds || { xMin: Math.min(sx, gx) - 40, xMax: Math.max(sx, gx) + 40, zMin: Math.min(sz, gz) - 40, zMax: Math.max(sz, gz) + 40 };
  const sig = signature(colliders, r, b);
  if (!grid || grid.sig !== sig) { grid = buildGrid(colliders, r, b); grid.sig = sig; }
  const G = grid;
  const start = nearestFree(G, cellOf(G, sx, sz), sx, sz);
  const goal = nearestFree(G, cellOf(G, gx, gz), gx, gz);
  if (start < 0 || goal < 0 || !astar(G, start, goal)) return null;

  const cells = [];
  for (let k = goal; k !== -1 && k !== start; k = G.came[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => {
    const i = k % G.nx;
    return { x: G.b.xMin + (i + 0.5) * CELL, z: G.b.zMin + ((k - i) / G.nx + 0.5) * CELL };
  });
  pts.push({ x: gx, z: gz });
  // Pull the path tight: from each anchor jump to the farthest point still in sight.
  // The next point is always reachable (neighbouring cells), so each step advances at least one.
  const out = [];
  let ax = sx, az = sz, idx = -1;
  while (idx < pts.length - 1) {
    let k = idx + 1;
    while (k + 1 < pts.length && gridLOS(G, ax, az, pts[k + 1].x, pts[k + 1].z)) k++;
    out.push(pts[k]);
    ax = pts[k].x; az = pts[k].z;
    idx = k;
  }
  return out;
}
