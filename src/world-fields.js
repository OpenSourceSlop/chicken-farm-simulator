// Thai rice paddies around the farm (water, seedlings, green and ripening rice, raised bunds),
// village groves on mounds, sugar palms, field huts and low hills on the horizon. Owner: world agent.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { GeoBuilder, rng, fbm, rectDist, unitBox, unitCone } from './world-util.js';
import { F, CORRIDOR, PUBLIC_ROAD_Z, PADDY_Y, LOW_Y, GROVES, terrainHeight } from './world-layout.js';
import { treeGeometry } from './world-trees.js';

const EXCLUDE = [
  { x0: F.xMin - 5.4, x1: F.xMax + 5.4, z0: F.zMin - 5.4, z1: F.zMax + 5.4 },
  { x0: CORRIDOR.x0 - 3.8, x1: CORRIDOR.x1 + 3.8, z0: F.zMax, z1: PUBLIC_ROAD_Z },
  { x0: -1e4, x1: 1e4, z0: PUBLIC_ROAD_Z - 8.3, z1: PUBLIC_ROAD_Z + 8.3 },
];
const RADIUS = 330;

function clipRect(p, e) {
  if (p.x1 <= e.x0 || p.x0 >= e.x1 || p.z1 <= e.z0 || p.z0 >= e.z1) return p;
  let best = null, area = 0;
  for (const c of [
    { x0: p.x0, x1: Math.min(p.x1, e.x0), z0: p.z0, z1: p.z1 },
    { x0: Math.max(p.x0, e.x1), x1: p.x1, z0: p.z0, z1: p.z1 },
    { x0: p.x0, x1: p.x1, z0: p.z0, z1: Math.min(p.z1, e.z0) },
    { x0: p.x0, x1: p.x1, z0: Math.max(p.z0, e.z1), z1: p.z1 },
  ]) {
    const a = (c.x1 - c.x0) * (c.z1 - c.z0);
    if (c.x1 - c.x0 > 4 && c.z1 - c.z0 > 4 && a > area) { area = a; best = c; }
  }
  return best;
}

function layoutPlots() {
  const r = rng(21);
  const plots = [];
  for (let z = -RADIUS; z < RADIUS;) {
    const bh = r.range(15, 27);
    for (let x = -RADIUS - r() * 25; x < RADIUS;) {
      const bw = r.range(17, 36);
      let p = { x0: x + 0.0, x1: x + bw, z0: z, z1: z + bh };
      x += bw;
      const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      if (Math.hypot(cx, cz - 10) > RADIUS - 20) continue;
      for (const e of EXCLUDE) { p = p && clipRect(p, e); }
      if (!p) continue;
      if (GROVES.some((g) => rectDist(g.x, g.z, p.x0, p.x1, p.z0, p.z1) < g.r + 3)) continue;
      const n = fbm(cx * 0.007, cz * 0.007, 2, 5) + (r() - 0.5) * 0.35;
      p.type = n < 0.36 ? 'water' : n < 0.5 ? 'seed' : n < 0.78 ? 'green' : 'gold';
      p.shade = 0.92 + r() * 0.16;
      plots.push(p);
    }
    z += bh;
  }
  return plots;
}

function seedlingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c4dde4';
  g.fillRect(0, 0, 128, 128);
  for (let y = 4; y < 128; y += 16) {
    for (let x = 3; x < 128; x += 10) {
      g.fillStyle = (x + y) % 3 ? '#5f9a3a' : '#6faa40';
      g.fillRect(x, y + ((x / 10) % 2) * 2, 4, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function bund(b, ax, az, bx, bz, col) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
  const top = -0.42, low = LOW_Y + 0.02, wt = 0.28, wb = 0.55;
  const P = (o, y, t) => [ax + dx * t + nx * o, y, az + dz * t + nz * o];
  const quadUp = (p, q, s, u) => {
    // orient so the face normal points up/out
    const cy = (q[2] - p[2]) * (s[0] - p[0]) - (q[0] - p[0]) * (s[2] - p[2]);
    if (cy >= 0) b.quad(p, q, s, u, col); else b.quad(p, u, s, q, col);
  };
  quadUp(P(-wt, top, 0), P(-wt, top, 1), P(wt, top, 1), P(wt, top, 0));
  quadUp(P(wt, top, 0), P(wt, top, 1), P(wb, low, 1), P(wb, low, 0));
  quadUp(P(-wb, low, 0), P(-wb, low, 1), P(-wt, top, 1), P(-wt, top, 0));
}

function buildPaddies(group, mats) {
  const plots = layoutPlots();
  const rice = new GeoBuilder();
  const water = new GeoBuilder({ uv: true });
  const seed = new GeoBuilder({ uv: true });
  const bunds = new GeoBuilder();
  const green = new THREE.Color(COLORS.paddy), greenDk = new THREE.Color(0x7fb04a), gold = new THREE.Color(0xc8bf5a);
  const bundCol = new THREE.Color(0x6c9445), c = new THREE.Color();
  const uvq = (p) => [p.x0 / 6, p.z0 / 6, p.x0 / 6, p.z1 / 6, p.x1 / 6, p.z1 / 6, p.x1 / 6, p.z0 / 6];
  for (const p of plots) {
    const A = [p.x0, 0, p.z0], B = [p.x0, 0, p.z1], Cc = [p.x1, 0, p.z1], D = [p.x1, 0, p.z0];
    if (p.type === 'water' || p.type === 'seed') {
      A[1] = B[1] = Cc[1] = D[1] = PADDY_Y;
      (p.type === 'water' ? water : seed).quad(A, B, Cc, D, 0xffffff, uvq(p));
    } else {
      const y = p.type === 'gold' ? -0.47 : -0.5;
      A[1] = B[1] = Cc[1] = D[1] = y;
      c.copy(p.type === 'gold' ? gold : green).lerp(greenDk, p.type === 'green' ? (p.shade - 0.92) * 3 : 0).multiplyScalar(p.shade);
      rice.quad(A, B, Cc, D, c);
    }
    c.copy(bundCol).multiplyScalar(p.shade);
    bund(bunds, p.x0, p.z0, p.x1, p.z0, c);
    bund(bunds, p.x0, p.z0, p.x0, p.z1, c);
    bund(bunds, p.x1, p.z0, p.x1, p.z1, c);
    bund(bunds, p.x0, p.z1, p.x1, p.z1, c);
  }
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x9cc4d4, specular: 0xb8c8d0, shininess: 90 });
  const seedMat = new THREE.MeshPhongMaterial({ map: seedlingTexture(), specular: 0x8899a0, shininess: 60 });
  group.add(rice.mesh(mats.flat, { cast: false, receive: false, name: 'paddy-rice' }));
  group.add(water.mesh(waterMat, { cast: false, receive: false, name: 'paddy-water' }));
  group.add(seed.mesh(seedMat, { cast: false, receive: false, name: 'paddy-seedlings' }));
  group.add(bunds.mesh(mats.flat, { cast: false, receive: false, name: 'paddy-bunds' }));
  return { plots, waterMat, seedMat };
}

function instanced(geo, mat, list, castShadow = false) {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach((t, i) => {
    e.set(0, t.ry || 0, 0); q.setFromEuler(e);
    p.set(t.x, t.y || 0, t.z); s.setScalar(t.s || 1);
    mesh.setMatrixAt(i, m.compose(p, q, s));
  });
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  mesh.computeBoundingSphere();
  return mesh;
}

// Village groves, sugar palms out on the bunds, a few field huts
function buildTreeline(group, mats, plots) {
  const r = rng(33);
  const village = [], village2 = [], coconut = [], sugar = [];
  const extra = new GeoBuilder();
  for (const g of GROVES) {
    const n = Math.round(g.r * 0.65);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (g.r - 2);
      const x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, y = terrainHeight(x, z);
      const k = r();
      (k < 0.5 ? village : k < 0.7 ? village2 : coconut).push({ x, y, z, s: 0.8 + r() * 0.6, ry: r() * 6.28 });
    }
    // village house roofs peeking through the trees
    for (let i = 0; i < 2; i++) {
      const a = r() * Math.PI * 2, d = r() * g.r * 0.5;
      const x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, y = terrainHeight(x, z), ry = r() * 3;
      extra.add(unitBox(), 0xd9cdb4, { x, y: y + 1.7, z, sx: 6, sy: 2.6, sz: 4.5, ry });
      extra.add(unitCone(4), i % 2 ? 0xb5523b : 0x8a5a3a, { x, y: y + 4.0, z, sx: 4.9, sy: 2.0, sz: 3.6, ry: ry + Math.PI / 4 });
    }
  }
  // sugar palms on bunds, a few close to the farm
  let tries = 0;
  while (sugar.length < 95 && tries++ < 4000) {
    const p = plots[Math.floor(r() * plots.length)];
    const x = r() < 0.5 ? p.x0 : p.x1, z = p.z0 + r() * (p.z1 - p.z0);
    const dist = Math.hypot(x, z - 10);
    if (dist < 60 && r() < 0.6) continue;
    sugar.push({ x, y: -0.45, z, s: 0.8 + r() * 0.45, ry: r() * 6.28 });
  }
  // a few field huts on stilts
  for (const [x, z, ry] of [[-92, 64, 0.2], [96, -70, 1.4], [-38, -78, 0.5], [118, 30, 2.6]]) {
    const top = 1.4;
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) extra.add(unitBox(), 0x6a5038, { x: x + ox * 1.1, y: top / 2 - 0.6, z: z + oz * 0.9, sx: 0.12, sy: top + 1.2, sz: 0.12 });
    extra.add(unitBox(), 0x8a6a48, { x, y: top - 0.55, z, sx: 2.6, sy: 0.12, sz: 2.2, ry });
    extra.add(unitCone(4), 0xb39a62, { x, y: top + 1.0, z, sx: 2.4, sy: 1.3, sz: 2.0, ry: ry + Math.PI / 4 });
  }
  group.add(extra.mesh(mats.flat, { cast: false, receive: false, name: 'village' }));
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  group.add(instanced(treeGeometry('village', 3), treeMat, village));
  group.add(instanced(treeGeometry('village2', 4), treeMat, village2));
  group.add(instanced(treeGeometry('coconut', 5), treeMat, coconut));
  group.add(instanced(treeGeometry('sugar', 6), treeMat, sugar));
}

// Low hills on the horizon: unlit, tinted every frame toward the sky colour.
function buildHills(group) {
  const r = rng(51);
  const pos = [], col = [];
  const L = new THREE.Vector3(0.5, 0.7, 0.4).normalize();
  const ring = (R, depth, hMin, hMax, segs, seed, shade) => {
    const crest = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 3 + seed, Math.sin(a) * 3, 3, seed);
      const h = hMin + (hMax - hMin) * Math.pow(n, 1.6) * (1 + 0.15 * (r() - 0.5));
      crest.push({ a, h, rr: R + depth * (0.35 + 0.3 * r()) });
    }
    const pt = (a, rr, y) => [Math.cos(a) * rr, y, Math.sin(a) * rr + 10];
    const tri = (p, q, s) => {
      const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [s[0] - p[0], s[1] - p[1], s[2] - p[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...n) || 1;
      const k = shade * (0.78 + 0.32 * Math.max(0, (n[0] * L.x + n[1] * L.y + n[2] * L.z) / l));
      pos.push(...p, ...q, ...s);
      for (let i = 0; i < 3; i++) col.push(k, k, k);
    };
    for (let i = 0; i < segs; i++) {
      const c0 = crest[i], c1 = crest[i + 1];
      const f0 = pt(c0.a, R, -3), f1 = pt(c1.a, R, -3);
      const t0 = pt(c0.a, c0.rr, c0.h), t1 = pt(c1.a, c1.rr, c1.h);
      const b0 = pt(c0.a, R + depth, c0.h * 0.6), b1 = pt(c1.a, R + depth, c1.h * 0.6);
      tri(f0, t0, f1); tri(f1, t0, t1);
      tri(t0, b0, t1); tri(t1, b0, b1);
    }
  };
  ring(410, 50, 10, 70, 90, 3, 0.86);
  ring(345, 30, 2, 26, 110, 7, 1.0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'hills';
  mesh.renderOrder = -5;
  mesh.frustumCulled = false;
  group.add(mesh);
  return mat;
}

export function buildFields(ctx, mats) {
  const group = new THREE.Group();
  group.name = 'fields';
  const { plots, waterMat, seedMat } = buildPaddies(group, mats);
  buildTreeline(group, mats, plots);
  const hillMat = buildHills(group);
  const base = { water: new THREE.Color(0x7fb0c4), seed: new THREE.Color(0xffffff), hill: new THREE.Color(0x5f7f6a) };
  const tmp = new THREE.Color();
  return {
    group,
    // Water mirrors the sky colour; hills fade into the haze.
    update(sky) {
      const light = 0.35 + 0.65 * sky.state.dayLight;
      tmp.copy(sky.horizon).lerp(sky.zenith, 0.35);
      waterMat.color.copy(base.water).lerp(tmp, 0.55).multiplyScalar(0.55 + 0.45 * light);
      seedMat.color.copy(base.seed).lerp(tmp, 0.3).multiplyScalar(0.45 + 0.55 * light);
      hillMat.color.copy(sky.horizon).lerp(base.hill, 0.42 * light + 0.15).multiplyScalar(0.85 + 0.1 * light);
    },
  };
}
