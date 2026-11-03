// Click-to-walk route finding: a small visibility graph over the corners of the colliders
// (inflated by the farmer's radius), searched with A*. Runs only when the player clicks.
// It lets a click inside the house walk the farmer round to the door and in.
import { overlapsAny, resolve } from './player-collide.js';

const NODE_PAD = 0.22; // corner nodes sit this far outside the inflated obstacle
const TEST_SHRINK = 0.03; // segments may graze an obstacle by this much (collision slides)
const MAX_EXPAND = 700;

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

export function segmentClear(ax, az, bx, bz, r, colliders) {
  const e = r - TEST_SHRINK;
  for (const c of colliders) {
    if (c.type === 'box' ? segHitsBox(ax, az, bx, bz, c, e) : c.type === 'circle' && segHitsCircle(ax, az, bx, bz, c, e)) return false;
  }
  return true;
}

function buildNodes(r, colliders, bounds) {
  const nodes = [];
  const d = r + NODE_PAD;
  const ok = (x, z) => (!bounds || (x > bounds.xMin + r && x < bounds.xMax - r && z > bounds.zMin + r && z < bounds.zMax - r))
    && !overlapsAny(x, z, r + 0.02, colliders);
  for (const c of colliders) {
    if (c.type === 'box') {
      for (const [x, z] of [[c.minX - d, c.minZ - d], [c.maxX + d, c.minZ - d], [c.maxX + d, c.maxZ + d], [c.minX - d, c.maxZ + d]]) {
        if (ok(x, z)) nodes.push({ x, z });
      }
    } else if (c.type === 'circle') {
      const R = (c.r + d) / Math.cos(Math.PI / 8);
      for (let i = 0; i < 8; i++) {
        const a = (i + 0.5) * (Math.PI / 4);
        const x = c.x + Math.cos(a) * R, z = c.z + Math.sin(a) * R;
        if (ok(x, z)) nodes.push({ x, z });
      }
    }
  }
  return nodes;
}

// Move a clicked point out of obstacles so it is somewhere the farmer can stand.
export function freeSpot(x, z, r, colliders, bounds) {
  const p = { x, z };
  resolve(p, r + 0.05, colliders, bounds);
  return p;
}

// Returns waypoints [{x, z}, ...] ending at the goal (start excluded), or null when no route.
export function findPath(sx, sz, gx, gz, r, colliders, bounds) {
  if (segmentClear(sx, sz, gx, gz, r, colliders)) return [{ x: gx, z: gz }];
  const nodes = [{ x: sx, z: sz }, { x: gx, z: gz }, ...buildNodes(r, colliders, bounds)];
  const n = nodes.length;
  const g = new Float64Array(n).fill(Infinity);
  const f = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new Uint8Array(n);
  const h = (i) => Math.hypot(nodes[i].x - gx, nodes[i].z - gz);
  g[0] = 0; f[0] = h(0); open[0] = 1;
  for (let it = 0; it < MAX_EXPAND; it++) {
    let cur = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (open[i] && f[i] < best) { best = f[i]; cur = i; }
    if (cur < 0) return null;
    if (cur === 1) {
      const path = [];
      for (let i = 1; i > 0; i = came[i]) path.push({ x: nodes[i].x, z: nodes[i].z });
      return path.reverse();
    }
    open[cur] = 0; closed[cur] = 1;
    const a = nodes[cur];
    for (let i = 1; i < n; i++) {
      if (closed[i] || i === cur) continue;
      const b = nodes[i];
      const cost = g[cur] + Math.hypot(b.x - a.x, b.z - a.z);
      if (cost >= g[i]) continue;
      if (!segmentClear(a.x, a.z, b.x, b.z, r, colliders)) continue;
      g[i] = cost; f[i] = cost + h(i); came[i] = cur; open[i] = 1;
    }
  }
  return null;
}
