// Ground: the flat farm yard (grass and laterite patches), the embankment down to the rice
// fields, the farm road, the concrete door path, the public road and grass tufts. Owner: world agent.
import * as THREE from 'three';
import { COLORS, FARM, HOUSE_BOUNDS } from './config.js';
import { GeoBuilder, fbm, vnoise, smoothstep, rectDist, rng } from './world-util.js';
import {
  F, HOUSE_ZONE, PUBLIC_ROAD_Z, SPRAY_Z, pondR, ROAD_W, PATH_W, ROAD_SAMPLES, roadDist, raisedDist, terrainHeight, inKeepOut,
} from './world-layout.js';

const C = (hex) => new THREE.Color(hex);
const GRASS = C(COLORS.grass), GRASS_DK = C(COLORS.grassDark), SOIL = C(COLORS.soil), ROAD = C(COLORS.road);
const GRASS_DRY = C(0x9db35c), FIELD_EDGE = C(0x5a8a3a), GROVE = C(0x4e7a35), SLOPE = C(0x6f9a45), FAR = C(0x5e8a44);
const SOIL_DK = C(0x8e5b3a);
const LATERITE = C(COLORS.soil).lerp(C(0x9c8462), 0.35);

// Rain drips off roof edges and feet wear the grass: bare laterite around these footprints
const DRIP = [FARM.office, FARM.generator, FARM.guardHut].map((b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }));

function soilAmount(x, z) {
  if (x > HOUSE_ZONE.x0 && x < HOUSE_ZONE.x1 && z > HOUSE_ZONE.z0 && z < HOUSE_ZONE.z1) return 0;
  const n = fbm(x * 0.21, z * 0.21, 2, 31);
  let s = 0;
  const rd = roadDist(x, z);
  s = Math.max(s, smoothstep(4.0, 3.0, rd) * (0.1 + 0.45 * n));
  const gd = Math.hypot(x - FARM.gate.x, (z - 35) * 1.3);
  s = Math.max(s, smoothstep(11, 4, gd) * (0.3 + 0.7 * n));
  for (const r of DRIP) {
    const d = rectDist(x, z, r.x0, r.x1, r.z0, r.z1);
    if (d < 1.6) s = Math.max(s, smoothstep(1.6, 0.4, d) * (0.55 + 0.45 * n));
  }
  s = Math.max(s, smoothstep(0.68, 0.8, fbm(x * 0.06, z * 0.06, 2, 21)) * 0.75);
  return Math.min(1, s);
}

const tmpC = new THREE.Color();
function groundColor(x, z, y, out) {
  const d = raisedDist(x, z);
  const small = vnoise(x * 0.45, z * 0.45, 5) - 0.5;
  if (d <= 0.01) {
    const big = fbm(x * 0.045, z * 0.045, 3, 1);
    out.copy(GRASS).lerp(GRASS_DK, smoothstep(0.4, 0.7, big) * 0.85);
    out.lerp(GRASS_DRY, smoothstep(0.58, 0.78, fbm(x * 0.03 + 50, z * 0.03, 2, 3)) * 0.55);
    const s = soilAmount(x, z);
    if (s > 0) out.lerp(tmpC.copy(LATERITE).lerp(SOIL_DK, 0.25 - small * 0.5), s * 0.9);
    const e = pondR(x, z);
    if (e < 1.4) out.lerp(e < 1.12 ? SOIL_DK : GRASS_DK, e < 1.12 ? 0.85 : 0.6 * smoothstep(1.4, 1.12, e));
    out.multiplyScalar(1 + small * 0.05);
    return out;
  }
  if (d < 3.6) { // embankment of laterite fill with patchy grass
    out.copy(SLOPE).lerp(SOIL, 0.35 * smoothstep(0.45, 0.7, fbm(x * 0.15, z * 0.15, 2, 8)));
    return out.multiplyScalar(0.95 + small * 0.12);
  }
  if (y > -0.5) out.copy(GROVE); // tree mounds
  else out.copy(FIELD_EDGE);
  const r = Math.hypot(x, z);
  out.lerp(FAR, smoothstep(200, 300, r));
  return out.multiplyScalar(1 + small * 0.1);
}

// Variable-spacing axis: 2 m cells across the farm, growing outward to the horizon.
function axis(lo, hi, step, outer) {
  const a = [];
  for (let v = lo; v <= hi + 1e-6; v += step) a.push(v);
  let s = step, v = lo;
  while (v > -outer) { s = Math.min(s * 1.2, 45); v -= s; a.unshift(Math.max(v, -outer)); }
  s = step; v = hi;
  while (v < outer) { s = Math.min(s * 1.2, 45); v += s; a.push(Math.min(v, outer)); }
  return a;
}

function triUp(b, ax, ay, az, bx, by, bz, cx, cy, cz, color) {
  const cyy = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (cyy >= 0) b.tri(ax, ay, az, bx, by, bz, cx, cy, cz, color);
  else b.tri(ax, ay, az, cx, cy, cz, bx, by, bz, color);
}

function buildTerrain() {
  const xs = axis(-70, 70, 2, 470), zs = axis(-50, 74, 2, 470);
  const nx = xs.length, nz = zs.length;
  const r = rng(5);
  const P = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      let x = xs[i], z = zs[j];
      const inner = i > 0 && j > 0 && i < nx - 1 && j < nz - 1;
      if (inner) {
        const sx = Math.min(xs[i + 1] - x, x - xs[i - 1]), sz = Math.min(zs[j + 1] - z, z - zs[j - 1]);
        // irregular facets on the flat yard; keep vertices on the fence line straight
        const nearFence = Math.abs(raisedDist(x, z)) < 0.01 && rectDist(x, z, F.xMin + 1, F.xMax - 1, F.zMin + 1, F.zMax - 1) > 0;
        if (!nearFence) { x += (r() - 0.5) * sx * 0.4; z += (r() - 0.5) * sz * 0.4; }
      }
      const k = (j * nx + i) * 3;
      P[k] = x; P[k + 1] = terrainHeight(x, z); P[k + 2] = z;
    }
  }
  const b = new GeoBuilder();
  const col = new THREE.Color();
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = (j * nx + i) * 3, c = (j * nx + i + 1) * 3, d = ((j + 1) * nx + i) * 3, e = ((j + 1) * nx + i + 1) * 3;
      const flip = (i + j) % 2 === 0;
      const tris = flip ? [[a, d, c], [c, d, e]] : [[a, d, e], [a, e, c]];
      for (const [p, q, s] of tris) {
        const cx = (P[p] + P[q] + P[s]) / 3, cy = (P[p + 1] + P[q + 1] + P[s + 1]) / 3, cz = (P[p + 2] + P[q + 2] + P[s + 2]) / 3;
        groundColor(cx, cz, cy, col);
        triUp(b, P[p], P[p + 1], P[p + 2], P[q], P[q + 1], P[q + 2], P[s], P[s + 1], P[s + 2], col);
      }
    }
  }
  return b;
}

// Laterite farm road: faint wheel tracks, gravel centre, soft worn shoulders, slight crown.
function buildRoad(b) {
  const strips = [-3.4, -2.5, -1.9, -1.2, -0.6, 0.6, 1.2, 1.9, 2.5, 3.4];
  const crown = (o) => (Math.abs(o) > 2.5 ? 0.02 : 0.05 - 0.025 * Math.abs(o) / 2.5);
  const road = C(COLORS.road).lerp(SOIL, 0.22);
  const edge = road.clone().lerp(SOIL, 0.12).multiplyScalar(0.98), track = road.clone().multiplyScalar(0.95);
  const centre = road.clone().multiplyScalar(1.02), shoulder = C(COLORS.soil).lerp(GRASS, 0.45).multiplyScalar(0.95);
  const stripCol = [shoulder, edge, track, road, centre, road, track, edge, shoulder];
  const col = new THREE.Color();
  for (let i = 1; i < ROAD_SAMPLES.length; i++) {
    const A = ROAD_SAMPLES[i - 1], B = ROAD_SAMPLES[i];
    const ax = -A.tz, az = A.tx, bx = -B.tz, bz = B.tx; // left normals
    for (let k = 0; k < strips.length - 1; k++) {
      let o0 = strips[k], o1 = strips[k + 1];
      const mx = (A.x + B.x) / 2 + ax * (o0 + o1) / 2, mz = (A.z + B.z) / 2 + az * (o0 + o1) / 2;
      const n = vnoise(mx * 0.6, mz * 0.6, 3);
      col.copy(stripCol[k]).multiplyScalar(0.92 + n * 0.14);
      if (k === 0 || k === strips.length - 2) {
        // ragged grass edge: the outer shoulder varies in width and greenness
        const w = 0.25 + 0.75 * fbm(mx * 0.35, mz * 0.35, 2, 6);
        if (k === 0) o0 = o1 - 0.9 * w; else o1 = o0 + 0.9 * w;
        col.lerp(GRASS, 0.5 * (1 - w));
      }
      const wet = Math.max(0, 1 - Math.abs(mz - SPRAY_Z) / (2.6 + n)) * (Math.abs(mx - FARM.gate.x) < 2.6 ? 1 : 0);
      if (wet > 0) col.multiplyScalar(1 - 0.28 * Math.min(1, wet * 1.6));
      const p00 = [A.x + ax * o0, crown(o0), A.z + az * o0], p01 = [A.x + ax * o1, crown(o1), A.z + az * o1];
      const p10 = [B.x + bx * o0, crown(o0), B.z + bz * o0], p11 = [B.x + bx * o1, crown(o1), B.z + bz * o1];
      triUp(b, ...p00, ...p10, ...p11, col);
      triUp(b, ...p00, ...p11, ...p01, col);
    }
  }
  // turning and loading area where the road ends by the tunnel-fan end of the house
  const end = ROAD_SAMPLES[ROAD_SAMPLES.length - 1];
  const x0 = end.x - 5, x1 = end.x + 4.5, z0 = 9.2, z1 = end.z + 4.6;
  const cell = 1.6;
  for (let x = x0; x < x1 - 1e-3; x += cell) {
    for (let z = z0; z < z1 - 1e-3; z += cell) {
      const xa = Math.min(x + cell, x1), za = Math.min(z + cell, z1);
      const n = vnoise(x * 0.6, z * 0.6, 8);
      col.copy(road).lerp(SOIL, 0.15 + 0.15 * n).multiplyScalar(0.94 + n * 0.1);
      triUp(b, x, 0.03, z, x, 0.03, za, xa, 0.03, za, col);
      triUp(b, x, 0.03, z, xa, 0.03, za, xa, 0.03, z, col);
    }
  }
}

// Concrete path to the house door (stops at z = 8; the house engineer builds the apron).
function buildDoorPath(b) {
  const [p0] = FARM.doorPath;
  const x0 = p0.x - PATH_W / 2, x1 = p0.x + PATH_W / 2;
  const zStart = p0.z - ROAD_W / 2 + 0.3, zEnd = 8.0;
  const conc = C(COLORS.concrete), joint = C(COLORS.concrete).multiplyScalar(0.62);
  const n = 2, L = (zStart - zEnd) / n;
  for (let i = 0; i < n; i++) {
    const za = zStart - i * L, zb = za - L + 0.04;
    b.boxMM(x0, x1, -0.05, 0.06, zb, za, conc.clone().multiplyScalar(0.97 + 0.05 * (i % 2)));
    b.boxMM(x0 + 0.02, x1 - 0.02, -0.05, 0.062, zb - 0.04, zb, joint);
  }
}

function buildPublicRoad(b) {
  const z0 = PUBLIC_ROAD_Z - 3.2, z1 = PUBLIC_ROAD_Z + 3.2, x0 = -460, x1 = 460;
  const asphalt = C(0x5b5d60), line = C(0xe8e6dc), shoulder = C(COLORS.road).lerp(SOIL, 0.4);
  b.boxMM(x0, x1, -0.3, 0.035, z0 - 0.9, z0, shoulder);
  b.boxMM(x0, x1, -0.3, 0.035, z1, z1 + 0.9, shoulder);
  for (let x = x0; x < x1; x += 20) b.boxMM(x, x + 20, -0.3, 0.06, z0, z1, asphalt.clone().multiplyScalar(0.96 + 0.08 * vnoise(x, 0, 2)));
  b.boxMM(x0, x1, 0, 0.066, z0 + 0.15, z0 + 0.3, line);
  b.boxMM(x0, x1, 0, 0.066, z1 - 0.3, z1 - 0.15, line);
  for (let x = x0; x < x1; x += 9) b.boxMM(x, x + 3.5, 0, 0.066, PUBLIC_ROAD_Z - 0.08, PUBLIC_ROAD_Z + 0.08, line);
}

// Grass tufts and taller weeds along the fence (instanced: one draw call)
function buildTufts() {
  const blade = new GeoBuilder();
  const r = rng(11);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.5, lean = 0.4 + r() * 0.35;
    blade.add(new THREE.ConeGeometry(0.075, 1, 3, 1, true), 0xffffff, { x: Math.cos(a) * 0.1, y: 0.32, z: Math.sin(a) * 0.1, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean, sy: 0.55 + r() * 0.35 });
  }
  const geo = blade.geometry();
  geo.deleteAttribute('color');
  const mat = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
  const N = 1500;
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0, tries = 0;
  while (n < N && tries < N * 20) {
    tries++;
    let x, z, tall = false;
    if (n < 520) { // along the inside of the fence, where the mower does not reach
      const side = Math.floor(r() * 4), t = r();
      const inset = 0.25 + r() * 1.1;
      if (side === 0) { x = F.xMin + inset; z = F.zMin + t * (F.zMax - F.zMin); }
      else if (side === 1) { x = F.xMax - inset; z = F.zMin + t * (F.zMax - F.zMin); }
      else if (side === 2) { z = F.zMin + inset; x = F.xMin + t * (F.xMax - F.xMin); }
      else { z = F.zMax - inset; x = F.xMin + t * (F.xMax - F.xMin); }
      tall = true;
    } else {
      x = F.xMin + 1 + r() * (F.xMax - F.xMin - 2);
      z = F.zMin + 1 + r() * (F.zMax - F.zMin - 2);
      if (fbm(x * 0.08, z * 0.08, 2, 44) < 0.45 && r() < 0.7) continue; // clumped, not uniform
    }
    if (x > FARM.gate.x - 4 && x < FARM.gate.x + 4 && z > 30) continue;
    if (roadDist(x, z) < 3.3 || pondR(x, z) < 1.25) continue;
    if (inKeepOut(x, z, 0.3)) continue;
    if (x > HOUSE_BOUNDS.xMin - 5 && x < HOUSE_BOUNDS.xMax + 5 && z > HOUSE_BOUNDS.zMin - 5 && z < HOUSE_BOUNDS.zMax + 5) continue;
    const sc = tall ? 0.7 + r() * 0.9 : 0.45 + r() * 0.5;
    e.set(0, r() * Math.PI * 2, 0);
    q.setFromEuler(e);
    p.set(x, 0, z);
    s.set(sc * (0.8 + r() * 0.5), sc, sc * (0.8 + r() * 0.5));
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.copy(GRASS).lerp(GRASS_DRY, tall ? 0.45 + r() * 0.3 : r() * 0.35).multiplyScalar(1.12 + r() * 0.12);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function buildGround(ctx, mats) {
  const group = new THREE.Group();
  group.name = 'ground';
  const terrain = buildTerrain().mesh(mats.flat, { cast: false, receive: true, name: 'terrain' });
  group.add(terrain);
  const roads = new GeoBuilder();
  buildRoad(roads);
  buildDoorPath(roads);
  buildPublicRoad(roads);
  group.add(roads.mesh(mats.flat, { cast: false, receive: true, name: 'roads' }));
  group.add(buildTufts());
  return group;
}
