// Low-poly tree generators (coconut palm, banana clump, mango, rain tree, sugar palm, village tree)
// and a foliage material with a gentle wind sway. Owner: world agent.
import * as THREE from 'three';
import { GeoBuilder, unitIco, unitCyl, unitCone, rng, patchOcclusion } from './world-util.js';

const TRUNK_PALM = 0x8c7b62, TRUNK_DK = 0x5e4a3a, FROND = 0x5f9a36, FROND_DK = 0x4b7f2c, FROND_DRY = 0xa88f4e;
const BANANA = 0x7fbf45, BANANA_DK = 0x5f9a32, BANANA_STEM = 0x8aa04a;
const MANGO = 0x4a8538, MANGO_LT = 0x5c9a42, RAIN = 0x74a842, RAIN_DK = 0x5f9536;

// One arching frond or leaf: a V-section strip from `base` along heading `a`.
function leafStrip(b, base, a, len, width, rise, droop, color, segs, swayBase, opts = {}) {
  const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
  const pts = [];
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const y = base.y + rise * Math.sin(t * Math.PI * 0.55) - droop * t * t;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(0.98, 0.08 + t * 0.92)), 0.7) * (opts.tip ? 1 - 0.6 * t : 1);
    pts.push({ x: base.x + dx * len * t, y, z: base.z + dz * len * t, w, s: swayBase + ((opts.swayTip ?? 0.6) - swayBase) * t });
  }
  for (let k = 0; k < segs; k++) {
    const p = pts[k], q = pts[k + 1];
    const fold = opts.fold ?? 0.35;
    const pl = [p.x + sx * p.w, p.y - fold * p.w, p.z + sz * p.w], pr = [p.x - sx * p.w, p.y - fold * p.w, p.z - sz * p.w];
    const ql = [q.x + sx * q.w, q.y - fold * q.w, q.z + sz * q.w], qr = [q.x - sx * q.w, q.y - fold * q.w, q.z - sz * q.w];
    const pc = [p.x, p.y, p.z], qc = [q.x, q.y, q.z];
    const n0 = b.count;
    b.tri(...pc, ...pl, ...qc, color);
    b.tri(...pl, ...ql, ...qc, color);
    b.tri(...pc, ...qc, ...pr, color);
    b.tri(...pr, ...qc, ...qr, color);
    if (b.sway) {
      const sp = p.s, sq = q.s;
      const w = [sp, sp, sq, sp, sq, sq, sp, sq, sp, sp, sq, sq];
      for (let i = 0; i < 12; i++) b.sway[n0 + i] = w[i];
    }
  }
}

export function coconutPalm(b, x, z, h = 8, seed = 1) {
  const r = rng(seed);
  const leanA = r() * Math.PI * 2, lean = 0.06 + r() * 0.1;
  const segs = 6;
  let px = x, py = 0, pz = z;
  const swayH = (y) => Math.max(0, (y / h) - 0.35) * 0.35;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs;
    const bend = lean * (1 + t * 0.6);
    const nx = x + Math.cos(leanA) * h * bend * t * t * 1.4, nz = z + Math.sin(leanA) * h * bend * t * t * 1.4, ny = h * t;
    const rad = 0.2 - 0.06 * t;
    b.pipe(px, py, pz, nx, ny, nz, rad, i % 2 ? TRUNK_PALM : 0x7d6d56, 6, { sway: swayH });
    px = nx; py = ny; pz = nz;
  }
  const top = { x: px, y: py, z: pz };
  const sTop = swayH(py);
  b.add(unitIco(0), 0x6e7d3a, { x: px, y: py + 0.1, z: pz, s: 0.38, sway: () => sTop });
  // coconuts
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    b.add(unitIco(0), i % 2 ? 0x7a8f2e : 0x9a7b3a, { x: px + Math.cos(a) * 0.32, y: py - 0.35 - r() * 0.2, z: pz + Math.sin(a) * 0.32, s: 0.17, sway: () => sTop });
  }
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const dry = i === 3 || (i === 8 && r() < 0.5);
    const len = dry ? 3.0 : 3.2 + r() * 0.9;
    const col = dry ? FROND_DRY : (i % 2 ? FROND : FROND_DK);
    leafStrip(b, top, a, len, 0.48, dry ? 0.1 : 0.55 + r() * 0.35, dry ? 2.6 : 1.4 + r() * 0.7, col, 4, sTop, { fold: 0.45, swayTip: 0.65 });
  }
}

export function bananaClump(b, x, z, seed = 1, size = 1) {
  const r = rng(seed);
  const stems = 3 + Math.floor(r() * 3);
  for (let s = 0; s < stems; s++) {
    const a = r() * Math.PI * 2, d = s === 0 ? 0 : 0.35 + r() * 0.45;
    const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
    const h = (s === 0 ? 2.6 : 1.4 + r() * 1.2) * size;
    const stemSway = (y) => Math.max(0, y - 0.3) * 0.05;
    b.cyl(0.13 * size, h, sx, 0, sz, s % 2 ? BANANA_STEM : 0x7c8f40, 6, { top: 0.75, sway: stemSway });
    const leaves = 4 + Math.floor(r() * 3);
    for (let i = 0; i < leaves; i++) {
      const la = (i / leaves) * Math.PI * 2 + r() * 0.6;
      const dead = i === 0 && r() < 0.7;
      const top = { x: sx, y: h * (dead ? 0.8 : 1), z: sz };
      leafStrip(b, top, la, (dead ? 1.2 : 1.6 + r() * 0.6) * size, 0.34 * size, dead ? 0 : 0.5 * size, (dead ? 1.6 : 0.9 + r() * 0.5) * size,
        dead ? 0x9c8448 : (i % 2 ? BANANA : BANANA_DK), 4, stemSway(top.y), { fold: 0.12, swayTip: 0.45 });
    }
    if (s === 0 && r() < 0.8) { // hanging bunch with purple flower bud
      b.add(unitCyl(6, 0.6), 0x8fae3a, { x: sx + 0.25, y: h * 0.72, z: sz, sx: 0.2, sy: 0.55, sz: 0.2, sway: () => stemSway(h) });
      b.add(unitCone(5), 0x6e2e48, { x: sx + 0.27, y: h * 0.5, z: sz, sx: 0.09, sy: -0.25, sz: 0.09, sway: () => stemSway(h) });
    }
  }
}

// Dense round canopy (mango) — also used for village trees in the distance.
export function mangoTree(b, x, z, s = 1, seed = 1, colors = [MANGO, MANGO_LT], lod = false) {
  const r = rng(seed);
  const trunkH = 1.8 * s;
  b.cyl(0.28 * s, trunkH + 0.6 * s, x, 0, z, TRUNK_DK, 6, { top: 0.7 });
  for (let i = 0; i < (lod ? 0 : 3); i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    b.pipe(x, trunkH * 0.9, z, x + Math.cos(a) * 1.2 * s, trunkH + 1.3 * s, z + Math.sin(a) * 1.2 * s, 0.13 * s, TRUNK_DK, 5);
  }
  const blobs = lod ? 4 : 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / (blobs - 1)) * Math.PI * 2 + r() * 0.5;
    const d = i === blobs - 1 ? 0 : (1.3 + r() * 0.5) * s;
    const rad = (i === blobs - 1 ? 2.4 : 1.7 + r() * 0.5) * s;
    const y = trunkH + (i === blobs - 1 ? 2.6 : 1.6 + r() * 0.8) * s;
    b.add(unitIco(lod ? 0 : 1), colors[i % 2], { x: x + Math.cos(a) * d, y, z: z + Math.sin(a) * d, sx: rad, sy: rad * 0.82, sz: rad, rx: r(), ry: r() * 3, jitter: 0.12, sway: () => 0.06 });
  }
}

// Rain tree (chamchuri): short trunk, wide umbrella canopy
export function rainTree(b, x, z, s = 1, seed = 1, lod = false) {
  const r = rng(seed);
  b.cyl(0.42 * s, 2.4 * s, x, 0, z, TRUNK_DK, 7, { top: 0.75 });
  const arms = 4;
  const ends = [];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + r() * 0.6;
    const ex = x + Math.cos(a) * 3.2 * s, ez = z + Math.sin(a) * 3.2 * s, ey = (5.2 + r()) * s;
    b.pipe(x, 2.2 * s, z, ex, ey, ez, 0.2 * s, TRUNK_DK, 5);
    ends.push([ex, ey, ez]);
  }
  for (let i = 0; i < (lod ? 5 : 9); i++) {
    const a = r() * Math.PI * 2, d = (i === 0 ? 0 : 2.4 + r() * 2.6) * s;
    const rad = (2.4 + r() * 1.1) * s;
    b.add(unitIco(lod ? 0 : 1), i % 3 === 0 ? RAIN_DK : RAIN, { x: x + Math.cos(a) * d, y: (6.6 + r() * 1.0 - d * 0.12) * s, z: z + Math.sin(a) * d, sx: rad, sy: rad * 0.42, sz: rad, ry: r() * 3, jitter: 0.1, sway: () => 0.05 });
  }
}

// Sugar (toddy) palm: tall straight trunk, ball of fan leaves. Iconic in Thai paddy fields.
export function sugarPalm(b, x, z, h = 13, seed = 1) {
  const r = rng(seed);
  b.cyl(0.24, h, x, 0, z, 0x7a6a58, 6, { top: 0.8 });
  b.add(unitIco(0), 0x4a7a36, { x, y: h + 1.1, z, s: 1.7, ry: r() * 3, jitter: 0.15 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.5, el = 0.2 + r() * 0.9;
    b.add(unitCone(4), i % 2 ? 0x5a8a3e : 0x4d7f36, { x: x + Math.cos(a) * 1.5, y: h + 1.2 + Math.sin(el) * 1.2, z: z + Math.sin(a) * 1.5, sx: 0.9, sy: 0.25, sz: 0.9, rx: Math.PI / 2 - el, ry: -a + Math.PI / 2 });
  }
  b.add(unitCone(6), 0x7a6648, { x, y: h - 0.5, z, sx: 1.1, sy: -1.6, sz: 1.1 });
}

// Foliage material: Lambert with vertex colours and a wind sway weighted by the `sway` attribute.
export function makeFoliageMaterial() {
  const uniforms = { uTime: { value: 0 } };
  const patch = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = position.x * 0.21 + position.z * 0.17;
        float w = sway * (0.75 + 0.25 * sin(uTime * 0.37 + ph * 0.3));
        transformed.x += w * (sin(uTime * 1.25 + ph) * 0.55 + sin(uTime * 2.7 + ph * 1.7) * 0.18);
        transformed.z += w * cos(uTime * 1.05 + ph * 1.3) * 0.35;
        transformed.y += w * sin(uTime * 2.1 + ph) * 0.12;`);
  };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => { patch(shader); patchOcclusion(shader); };
  mat.customProgramCacheKey = () => 'foliage-sway';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = patch;
  depth.customProgramCacheKey = () => 'foliage-sway-depth';
  return { mat, depth, uniforms };
}

// Geometry of one tree for instancing (no sway attribute)
export function treeGeometry(kind, seed = 1) {
  const b = new GeoBuilder();
  if (kind === 'village') mangoTree(b, 0, 0, 1.25, seed, [0x4a7e38, 0x5a8c40], true);
  else if (kind === 'village2') rainTree(b, 0, 0, 0.9, seed, true);
  else if (kind === 'coconut') coconutPalm(b, 0, 0, 9, seed);
  else if (kind === 'sugar') sugarPalm(b, 0, 0, 13, seed);
  return b.geometry();
}

