// Derived farm layout used by several world files: road centreline with rounded corners,
// keep-out rectangles, terrain height. Everything comes from FARM / HOUSE_BOUNDS in config.js.
import { FARM, HOUSE_BOUNDS, SPOTS } from './config.js';
import { rectDist, smoothstep, fbm } from './world-util.js';

export const ROAD_W = 5;
export const PATH_W = 2.5;
export const PUBLIC_ROAD_Z = 60;            // public road south of the farm, outside the fence
export const YARD_PAD = 1.5;                // flat ground beyond the fence before the embankment
export const PADDY_Y = -0.62;               // water level in the rice fields
export const LOW_Y = -0.8;                  // field floor
// Area the house engineer owns (we draw nothing there except the silos and auger)
export const HOUSE_ZONE = { x0: -26, x1: 26, z0: -8, z1: 8 };
export const F = FARM.fence;
export const GATE = { x0: FARM.gate.x - FARM.gate.width / 2, x1: FARM.gate.x + FARM.gate.width / 2, z: FARM.gate.z };
// Raised road from the gate down to the public road
export const CORRIDOR = { x0: FARM.gate.x - 3.6, x1: FARM.gate.x + 3.6, z0: F.zMax, z1: PUBLIC_ROAD_Z };
export const SPRAY_Z = 30.6;                // vehicle spray arch across the road

// Road centreline: the farm road plus its run out to the public road, corners rounded.
export function roadPolyline() {
  const pts = FARM.road.map((p) => ({ x: p.x, z: p.z }));
  pts.unshift({ x: pts[0].x, z: PUBLIC_ROAD_Z });
  return pts;
}

// Sample a polyline with circular fillets of radius R at interior corners.
// Returns [{x, z, tx, tz, s}] (position, unit tangent, distance along).
export function samplePath(pts, R, step = 2) {
  const out = [];
  let s = 0, last = null;
  const push = (x, z, tx, tz) => {
    if (last) s += Math.hypot(x - last.x, z - last.z);
    last = { x, z, tx, tz, s };
    out.push(last);
  };
  let cur = { x: pts[0].x, z: pts[0].z };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), tx = dx / L, tz = dz / L;
    let end = { x: b.x, z: b.z };
    let arc = null;
    if (i < pts.length - 1) {
      const c = pts[i + 1];
      const ex = c.x - b.x, ez = c.z - b.z, L2 = Math.hypot(ex, ez), ux = ex / L2, uz = ez / L2;
      const cos = tx * ux + tz * uz, turn = Math.acos(Math.max(-1, Math.min(1, cos)));
      if (turn > 0.01) {
        const cut = R * Math.tan(turn / 2);
        end = { x: b.x - tx * cut, z: b.z - tz * cut };
        arc = { b, cut, tx, tz, ux, uz, turn, cross: tx * uz - tz * ux };
      }
    }
    const segL = Math.hypot(end.x - cur.x, end.z - cur.z);
    const n = Math.max(1, Math.ceil(segL / step));
    for (let j = (out.length ? 1 : 0); j <= n; j++) {
      const t = j / n;
      push(cur.x + (end.x - cur.x) * t, cur.z + (end.z - cur.z) * t, tx, tz);
    }
    if (arc) {
      // centre of the fillet circle sits R to the inside of the turn
      const side = Math.sign(arc.cross) || 1;
      const nx = -arc.tz * side, nz = arc.tx * side;
      const cx = end.x + nx * R, cz = end.z + nz * R;
      const a0 = Math.atan2(end.z - cz, end.x - cx);
      const m = Math.max(4, Math.ceil((arc.turn * R) / (step * 0.6)));
      for (let j = 1; j <= m; j++) {
        const ang = a0 + side * arc.turn * (j / m);
        const x = cx + Math.cos(ang) * R, z = cz + Math.sin(ang) * R;
        // tangent of a circle: perpendicular to the radius, in the travel direction
        const ttx = -Math.sin(ang) * side, ttz = Math.cos(ang) * side;
        push(x, z, ttx, ttz);
      }
      cur = { x: last.x, z: last.z };
    } else cur = end;
  }
  return out;
}

export const ROAD_SAMPLES = samplePath(roadPolyline(), 7, 2);

// Distance from (x, z) to the road centreline (by samples; accurate to ~0.1 m)
export function roadDist(x, z) {
  let best = Infinity;
  for (let i = 1; i < ROAD_SAMPLES.length; i++) {
    const a = ROAD_SAMPLES[i - 1], b = ROAD_SAMPLES[i];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (d < best) best = d;
  }
  return best;
}

// Buildings and other solid things on the yard: keep-out rectangles for trees and grass tufts.
const O = FARM.office, G = FARM.generator, H = FARM.guardHut;
export const KEEP_OUT = [
  { x0: HOUSE_BOUNDS.xMin - 4, x1: HOUSE_BOUNDS.xMax + 4, z0: HOUSE_BOUNDS.zMin - 4, z1: HOUSE_BOUNDS.zMax + 4 },
  { x0: O.x - O.w / 2 - 1.5, x1: O.x + O.w / 2 + 1.5, z0: O.z - O.d / 2 - 1.5, z1: O.z + O.d / 2 + 3 },
  { x0: G.x - G.w / 2 - 1.5, x1: G.x + G.w / 2 + 1.5, z0: G.z - G.d / 2 - 1.5, z1: G.z + G.d / 2 + 1.5 },
  { x0: H.x - H.w / 2 - 1.5, x1: H.x + H.w / 2 + 1.5, z0: H.z - H.d / 2 - 1.5, z1: H.z + H.d / 2 + 1.5 },
  { x0: FARM.waterTank.x - 3, x1: FARM.waterTank.x + 7, z0: FARM.waterTank.z - 3.5, z1: FARM.waterTank.z + 3.5 },
  { x0: FARM.silos[0].x - 2.5, x1: FARM.silos[1].x + 2.5, z0: FARM.silos[0].z - 2.8, z1: -6 },
  { x0: GATE.x0 - 8, x1: SPOTS.signGate.x + 3, z0: SPRAY_Z - 2.5, z1: F.zMax + 1 },
  { x0: FARM.doorPath[0].x - 2.5, x1: FARM.doorPath[0].x + 2.5, z0: 6, z1: 16 },
];
export function inKeepOut(x, z, pad = 0) {
  for (const r of KEEP_OUT) if (x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return true;
  return false;
}

// Distance to raised (walkable, y = 0) ground: the yard, the gate road and the public road.
export function raisedDist(x, z) {
  const dYard = rectDist(x, z, F.xMin - YARD_PAD, F.xMax + YARD_PAD, F.zMin - YARD_PAD, F.zMax + YARD_PAD);
  const dCorr = rectDist(x, z, CORRIDOR.x0, CORRIDOR.x1, CORRIDOR.z0, CORRIDOR.z1);
  const dPub = Math.max(0, Math.abs(z - PUBLIC_ROAD_Z) - 4.5);
  return Math.min(dYard, dCorr, dPub);
}

// Groves of village trees out in the fields stand on low mounds
export const GROVES = [
  { x: -120, z: 95, r: 22 }, { x: 40, z: 130, r: 30 }, { x: 150, z: 70, r: 26 }, { x: 160, z: -60, r: 30 },
  { x: 60, z: -120, r: 28 }, { x: -60, z: -135, r: 32 }, { x: -160, z: -40, r: 28 }, { x: -150, z: 170, r: 30 },
  { x: 175, z: 160, r: 34 }, { x: -200, z: 60, r: 24 }, { x: 110, z: -190, r: 30 }, { x: -130, z: -200, r: 34 },
];

export function terrainHeight(x, z) {
  const d = raisedDist(x, z);
  if (d <= 0) return 0;
  let h = LOW_Y * smoothstep(0, 3.2, d);
  for (const g of GROVES) {
    const gd = Math.hypot(x - g.x, z - g.z);
    if (gd < g.r + 6) h = Math.max(h, -0.15 + 0.6 * (1 - smoothstep(g.r - 6, g.r + 6, gd)) - 0.6);
  }
  const r = Math.hypot(x, z - 10);
  h += smoothstep(240, 330, r) * (3 + 10 * fbm(x * 0.01, z * 0.01, 2, 9));
  return h;
}
