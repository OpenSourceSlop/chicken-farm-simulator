// Farm buildings outside the chicken house: office, generator shed, water tower with pump house,
// feed silos with the auger to the house, and a spirit house by the office. Owner: world agent.
import * as THREE from 'three';
import { COLORS, FARM } from './config.js';
import { GeoBuilder, unitCone, unitCyl, unitSphere, patchOcclusion } from './world-util.js';

// Phase 4: the generator shed's roof dissolves (screen-door dither, as the house roof) while the farmer works at
// the generator in the rainy season, so its control panel and transfer switch on the back wall are in view. The
// material is the metal's (Phong, the occlusion fade) plus the fade uniform; at 1 it draws exactly as before.
function fadingMetal(base) {
  const m = base.clone();
  const uFade = { value: 1 };
  m.onBeforeCompile = (sh) => {
    patchOcclusion(sh);
    sh.uniforms.uFade = uFade;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uFade;
float genBayer(vec2 p) { vec2 a = mod(p, 2.0), b = mod(floor(p * 0.5), 2.0);
  float d1 = 2.0 * a.x + 3.0 * a.y - 4.0 * a.x * a.y, d2 = 2.0 * b.x + 3.0 * b.y - 4.0 * b.x * b.y; return (4.0 * d1 + d2 + 0.5) / 16.0; }`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (genBayer(floor(gl_FragCoord.xy)) >= uFade) discard;');
  };
  m.customProgramCacheKey = () => 'occ-metal-fade';
  return { m, uFade };
}

const WALL = 0xeee6d2, WALL_TRIM = 0xd9cfb8, GLASS = 0x3e5a70, FRAME = 0xf4f1ea, DOOR = 0x7b5a3c;
const STEEL = COLORS.steel, STEEL_DK = COLORS.steelDark, GALV = 0xc3cbd1;

// Window on a wall facing +Z/-Z (axis 'z') or +X/-X (axis 'x'); `out` is the wall's outward sign.
function windowOn(flat, metal, axis, out, wallPos, c, y0, w, h) {
  const t = 0.06;
  if (axis === 'z') {
    const z = wallPos + out * 0.02;
    metal.boxMM(c - w / 2, c + w / 2, y0, y0 + h, z - t / 2, z + t / 2, GLASS);
    flat.boxMM(c - w / 2 - 0.08, c + w / 2 + 0.08, y0 - 0.1, y0, z - 0.06, z + 0.1 * out + 0.03, FRAME);
    for (const x of [c - w / 2 - 0.04, c + w / 2 + 0.04, c]) flat.boxMM(x - 0.04, x + 0.04, y0, y0 + h, z - 0.04, z + 0.05 * out, FRAME);
    flat.boxMM(c - w / 2, c + w / 2, y0 + h, y0 + h + 0.08, z - 0.04, z + 0.05 * out, FRAME);
  } else {
    const x = wallPos + out * 0.02;
    metal.boxMM(x - t / 2, x + t / 2, y0, y0 + h, c - w / 2, c + w / 2, GLASS);
    flat.boxMM(x - 0.06, x + 0.1 * out + 0.03, y0 - 0.1, y0, c - w / 2 - 0.08, c + w / 2 + 0.08, FRAME);
    for (const z of [c - w / 2 - 0.04, c + w / 2 + 0.04, c]) flat.boxMM(x - 0.04, x + 0.05 * out, y0, y0 + h, z - 0.04, z + 0.04, FRAME);
    flat.boxMM(x - 0.04, x + 0.05 * out, y0 + h, y0 + h + 0.08, c - w / 2, c + w / 2, FRAME);
  }
}

// Gable roof with the ridge along X
function gableRoof(b, x0, x1, z0, z1, yEave, rise, over, color) {
  const zc = (z0 + z1) / 2, half = (z1 - z0) / 2 + over, slope = Math.atan2(rise, half - over);
  const len = half / Math.cos(slope);
  for (const side of [-1, 1]) {
    b.add(new THREE.BoxGeometry(1, 1, 1), color, {
      x: (x0 + x1) / 2, y: yEave + rise / 2 - (over * rise) / (half - over) / 2 + 0.05, z: zc + side * half / 2,
      sx: x1 - x0 + over * 2, sy: 0.1, sz: len, rx: side * slope, order: 'XYZ',
    });
  }
  b.boxMM(x0 - over, x1 + over, yEave + rise + 0.02, yEave + rise + 0.12, zc - 0.12, zc + 0.12, color);
}
// Raised ribs of a corrugated metal roof, running down the slope
function roofRibs(b, x0, x1, z0, z1, yEave, rise, over, color) {
  const zc = (z0 + z1) / 2, half = (z1 - z0) / 2 + over, run = half - over, slope = Math.atan2(rise, run);
  const len = half / Math.cos(slope);
  for (let x = x0 - over + 0.25; x < x1 + over - 0.1; x += 0.5) {
    for (const side of [-1, 1]) {
      b.add(new THREE.BoxGeometry(1, 1, 1), color, {
        x, y: yEave + rise / 2 - (over * rise) / run / 2 + 0.12, z: zc + side * half / 2,
        sx: 0.05, sy: 0.04, sz: len, rx: side * slope, order: 'XYZ',
      });
    }
  }
}

function gableEnds(b, x0, x1, z0, z1, yEave, rise, color) {
  const zc = (z0 + z1) / 2;
  for (const x of [x0, x1]) {
    b.tri(x, yEave, z0, x, yEave, z1, x, yEave + rise, zc, color);
    b.tri(x, yEave, z1, x, yEave, z0, x, yEave + rise, zc, color);
  }
}

function office(flat, metal, glass, colliders, signTex, group) {
  const O = FARM.office, x0 = O.x - O.w / 2, x1 = O.x + O.w / 2, z0 = O.z - O.d / 2, z1 = O.z + O.d / 2;
  const base = 0.3, eave = 3.1;
  flat.boxMM(x0 - 0.2, x1 + 0.2, 0, base, z0 - 0.2, z1 + 0.2, COLORS.concrete);
  flat.boxMM(x0, x1, base, eave, z0, z1, WALL, { jitter: 0.02 });
  flat.boxMM(x0 - 0.02, x1 + 0.02, base, base + 0.35, z0 - 0.02, z1 + 0.02, WALL_TRIM);
  gableEnds(flat, x0, x1, z0, z1, eave, 1.3, WALL);
  gableRoof(flat, x0, x1, z0, z1, eave, 1.3, 0.55, COLORS.roofBlue);
  roofRibs(flat, x0, x1, z0, z1, eave, 1.3, 0.55, 0x355f88);
  // front (south): door, two windows, sign
  const doorX = x0 + 1.4;
  flat.boxMM(doorX - 0.55, doorX + 0.55, base, base + 2.15, z1 - 0.02, z1 + 0.05, DOOR);
  flat.boxMM(doorX - 0.65, doorX + 0.65, base + 2.15, base + 2.27, z1 - 0.02, z1 + 0.08, FRAME);
  for (const s of [-1, 1]) flat.boxMM(doorX + s * 0.6 - 0.05, doorX + s * 0.6 + 0.05, base, base + 2.2, z1 - 0.02, z1 + 0.08, FRAME);
  metal.boxMM(doorX + 0.25, doorX + 0.32, base + 1.0, base + 1.1, z1 + 0.05, z1 + 0.1, 0xc9b26a);
  windowOn(flat, glass, 'z', 1, z1, x0 + 3.6, 1.2, 1.6, 1.25);
  windowOn(flat, glass, 'z', 1, z1, x0 + 5.7, 1.2, 1.2, 1.25);
  windowOn(flat, glass, 'x', -1, x0, O.z - 0.9, 1.2, 1.4, 1.25);
  windowOn(flat, glass, 'x', -1, x0, O.z + 1.1, 1.2, 1.0, 1.25);
  windowOn(flat, glass, 'z', -1, z0, O.x, 1.4, 1.4, 1.0);
  // step and front apron, path to the road
  flat.boxMM(doorX - 0.9, doorX + 0.9, 0, 0.16, z1 + 0.2, z1 + 0.85, COLORS.concrete);
  flat.boxMM(-37.3, x1, -0.05, 0.05, z1 + 0.2, z1 + 2.0, 0xc4beb1);
  // potted plants either side of the step, a bench under the front windows
  for (const [px, col] of [[doorX - 1.15, 0xd0508a], [doorX + 1.15, 0xe86a3a]]) {
    flat.cyl(0.24, 0.42, px, 0.05, z1 + 0.55, 0xb0603a, 8, { top: 1.25 });
    flat.add(unitSphere(7, 5), 0x4f8a3a, { x: px, y: 0.78, z: z1 + 0.55, sx: 0.38, sy: 0.34, sz: 0.38, jitter: 0.15 });
    for (let i = 0; i < 4; i++) flat.add(unitSphere(5, 4), col, { x: px + Math.cos(i * 1.7) * 0.22, y: 0.92 + (i % 2) * 0.08, z: z1 + 0.55 + Math.sin(i * 1.7) * 0.22, s: 0.09 });
    colliders.push({ type: 'circle', x: px, z: z1 + 0.55, r: 0.35 });
  }
  const bx = x0 + 4.6;
  flat.boxMM(bx - 0.8, bx + 0.8, 0.42, 0.48, z1 + 0.35, z1 + 0.75, 0x8a6a48);
  for (const lx of [bx - 0.65, bx + 0.65]) flat.boxMM(lx - 0.04, lx + 0.04, 0.05, 0.42, z1 + 0.4, z1 + 0.7, 0x5c4630);
  colliders.push({ type: 'box', minX: bx - 0.85, maxX: bx + 0.85, minZ: z1 + 0.3, maxZ: z1 + 0.8 });
  // sign hung from the eave edge above the door, where the angled camera can read it
  const sw = 1.9, sh = 0.5, sz = z1 + 0.5, sy0 = 2.27, scx = doorX + 0.35;
  flat.boxMM(scx - sw / 2 - 0.05, scx + sw / 2 + 0.05, sy0 - 0.05, sy0 + sh + 0.05, sz - 0.05, sz, 0x1d3a58);
  for (const ox of [-sw / 2 + 0.15, sw / 2 - 0.15]) flat.boxMM(scx + ox - 0.02, scx + ox + 0.02, sy0 + sh, 2.86, sz - 0.04, sz - 0.01, 0x55595c);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshLambertMaterial({ map: signTex.office }));
  sign.position.set(scx, sy0 + sh / 2, sz + 0.005);
  sign.name = 'office-sign';
  group.add(sign);
  // air conditioner condenser on the east wall, on brackets, with its pipe run
  const ax = x1 + 0.22, az = O.z + 0.6;
  metal.boxMM(ax - 0.17, ax + 0.17, 0.7, 1.28, az - 0.45, az + 0.45, 0xeeeeea);
  metal.add(unitCyl(12), 0x3a3e42, { x: ax + 0.17, y: 0.99, z: az - 0.1, sx: 0.22, sy: 0.02, sz: 0.22, rz: Math.PI / 2 });
  for (let i = -2; i <= 2; i++) metal.boxMM(ax + 0.17, ax + 0.19, 0.99 + i * 0.08 - 0.01, 0.99 + i * 0.08 + 0.01, az - 0.32, az + 0.12, 0x8a9096);
  for (const z of [az - 0.35, az + 0.35]) metal.boxMM(x1, ax + 0.15, 0.62, 0.68, z - 0.03, z + 0.03, STEEL_DK);
  metal.pipe(ax - 0.05, 1.2, az + 0.35, ax - 0.05, 2.2, az + 0.35, 0.04, 0xf2f0ea, 6);
  metal.pipe(ax - 0.05, 2.2, az + 0.35, x1, 2.2, az + 0.35, 0.04, 0xf2f0ea, 6);
  // Thai water jar by the north-west corner
  flat.add(unitSphere(8, 6), 0x6b3a22, { x: x0 - 0.65, y: 0.42, z: z0 + 0.6, sx: 0.42, sy: 0.45, sz: 0.42 });
  flat.cyl(0.25, 0.12, x0 - 0.65, 0.8, z0 + 0.6, 0x5a301c, 8);
  colliders.push({ type: 'box', minX: x0 - 0.25, maxX: x1 + 0.45, minZ: z0 - 0.25, maxZ: z1 + 0.25 });
  colliders.push({ type: 'circle', x: x0 - 0.65, z: z0 + 0.6, r: 0.45 });
}

// set: the generator set's own builder (Phase 4: it shakes a little while it runs; same material, same look)
function generatorShed(flat, metal, colliders, set = flat, roof = metal) {
  const G = FARM.generator, x0 = G.x - G.w / 2, x1 = G.x + G.w / 2, z0 = G.z - G.d / 2, z1 = G.z + G.d / 2;
  flat.boxMM(x0 - 0.2, x1 + 0.2, 0, 0.15, z0 - 0.2, z1 + 0.2, COLORS.concrete);
  // block walls on three sides, open to the south
  flat.boxMM(x0, x1, 0.15, 1.3, z0, z0 + 0.15, 0xcfc8b8, { jitter: 0.03 });
  flat.boxMM(x0, x0 + 0.15, 0.15, 1.3, z0, z1, 0xcfc8b8, { jitter: 0.03 });
  flat.boxMM(x1 - 0.15, x1, 0.15, 1.3, z0, z1, 0xcfc8b8, { jitter: 0.03 });
  for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.08, z0 + 0.08], [x0 + 0.08, z1 - 0.08], [x1 - 0.08, z1 - 0.08]]) {
    metal.box(0.1, (z < G.z ? 3.0 : 2.6) - 0.15, 0.1, x, 0.15, z, STEEL_DK);
  }
  // lean-to roof, high at the back
  const over = 0.4, rise = 0.4, len = z1 - z0 + over * 2;
  roof.add(new THREE.BoxGeometry(1, 1, 1), 0xb7bfc5, { x: G.x, y: 2.8, z: G.z, sx: x1 - x0 + over * 2, sy: 0.06, sz: Math.hypot(len, rise), rx: Math.atan2(rise, len) * 1, order: 'XYZ' });
  // generator set: base frame, engine housing, radiator, control box, exhaust through the roof
  flat.boxMM(G.x - 1.3, G.x + 1.3, 0.15, 0.3, G.z - 0.5, G.z + 0.5, 0x3a3e42);
  set.boxMM(G.x - 1.2, G.x + 1.2, 0.3, 1.45, G.z - 0.48, G.z + 0.48, 0xd9a520, { jitter: 0.03 });
  set.boxMM(G.x + 1.2, G.x + 1.24, 0.45, 1.3, G.z - 0.4, G.z + 0.4, 0x2b2f33);
  for (let i = 0; i < 6; i++) set.boxMM(G.x - 0.8 + i * 0.25, G.x - 0.7 + i * 0.25, 0.6, 1.2, G.z + 0.48, G.z + 0.5, 0xa9821a);
  set.boxMM(G.x - 1.05, G.x - 0.55, 1.45, 1.75, G.z - 0.3, G.z + 0.1, 0x3a3e42);
  metal.pipe(G.x - 0.2, 1.45, G.z - 0.2, G.x - 0.2, 3.4, G.z - 0.2, 0.06, 0x55595c, 6);
  metal.add(unitCone(6), 0x55595c, { x: G.x - 0.2, y: 3.5, z: G.z - 0.2, sx: 0.14, sy: 0.15, sz: 0.14 });
  // fuel drum and a hazard sign
  flat.cyl(0.29, 0.88, x0 + 0.45, 0.15, z1 + 0.55, 0xb83a2a, 10);
  flat.cyl(0.3, 0.03, x0 + 0.45, 0.6, z1 + 0.55, 0x8f2c20, 10);
  colliders.push({ type: 'box', minX: x0 - 0.2, maxX: x1 + 0.2, minZ: z0 - 0.2, maxZ: z1 + 0.2 });
  colliders.push({ type: 'circle', x: x0 + 0.45, z: z1 + 0.55, r: 0.35 });
}

function waterTower(flat, metal, colliders) {
  const T = FARM.waterTank, h = 7.2, s = 1.35;
  flat.boxMM(T.x - 2.1, T.x + 2.1, 0, 0.12, T.z - 2.1, T.z + 2.1, COLORS.concrete);
  const legs = [[-s, -s], [s, -s], [s, s], [-s, s]];
  for (const [lx, lz] of legs) {
    metal.pipe(T.x + lx * 1.12, 0.12, T.z + lz * 1.12, T.x + lx, h, T.z + lz, 0.09, GALV, 6);
    flat.box(0.4, 0.3, 0.4, T.x + lx * 1.12, 0, T.z + lz * 1.12, COLORS.concrete);
  }
  // braces: rings and X braces at three levels
  const lev = [0.4, 2.7, 5.0, h];
  for (let k = 0; k < lev.length - 1; k++) {
    for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
      const fa = 1.12 - 0.12 * (lev[k] / h), fb = 1.12 - 0.12 * (lev[k + 1] / h);
      metal.pipe(T.x + ax * fa, lev[k], T.z + az * fa, T.x + bx * fb, lev[k + 1], T.z + bz * fb, 0.035, GALV, 4);
      metal.pipe(T.x + bx * fa, lev[k], T.z + bz * fa, T.x + ax * fb, lev[k + 1], T.z + az * fb, 0.035, GALV, 4);
      metal.pipe(T.x + ax * fb, lev[k + 1], T.z + az * fb, T.x + bx * fb, lev[k + 1], T.z + bz * fb, 0.04, GALV, 4);
    }
  }
  // platform, railing, stainless tank with bands and a domed lid
  metal.boxMM(T.x - 1.8, T.x + 1.8, h, h + 0.1, T.z - 1.8, T.z + 1.8, STEEL_DK);
  for (const [ax, az, bx, bz] of [[-1.8, -1.8, 1.8, -1.8], [1.8, -1.8, 1.8, 1.8], [1.8, 1.8, -1.8, 1.8], [-1.8, 1.8, -1.8, -1.8]]) {
    metal.pipe(T.x + ax, h + 0.95, T.z + az, T.x + bx, h + 0.95, T.z + bz, 0.025, GALV, 4);
    metal.pipe(T.x + ax, h + 0.1, T.z + az, T.x + ax, h + 0.95, T.z + az, 0.025, GALV, 4);
  }
  metal.cyl(1.45, 2.5, T.x, h + 0.1, T.z, 0xd5dbe0, 16);
  for (const y of [0.6, 1.25, 1.9]) metal.cyl(1.47, 0.06, T.x, h + 0.1 + y, T.z, 0xa9b1b8, 16);
  metal.add(unitCone(16), 0xd5dbe0, { x: T.x, y: h + 2.6 + 0.3, z: T.z, sx: 1.45, sy: 0.6, sz: 1.45 });
  metal.cyl(0.25, 0.15, T.x, h + 3.15, T.z, 0xa9b1b8, 8);
  // ladder on the east legs, outlet pipe down to the pump house
  const lx = T.x + s + 0.12;
  for (const dz of [-0.22, 0.22]) metal.pipe(lx + 0.3, 0.1, T.z + dz, lx, h + 0.95, T.z + dz, 0.025, GALV, 4);
  for (let y = 0.4; y < h + 0.9; y += 0.35) {
    const x = lx + 0.3 * (1 - y / (h + 0.85));
    metal.pipe(x, y, T.z - 0.22, x, y, T.z + 0.22, 0.018, GALV, 4);
  }
  metal.pipe(T.x - 0.5, h + 0.1, T.z + 0.4, T.x - 0.5, 0.3, T.z + 0.4, 0.07, 0x2f68b0, 6);
  colliders.push({ type: 'circle', x: T.x, z: T.z, r: 1.95 });
  // pump house beside the tower
  const px = T.x + 4.3, pz = T.z, pw = 2.4, pd = 2.0;
  flat.boxMM(px - pw / 2 - 0.15, px + pw / 2 + 0.15, 0, 0.15, pz - pd / 2 - 0.15, pz + pd / 2 + 0.15, COLORS.concrete);
  flat.boxMM(px - pw / 2, px + pw / 2, 0.15, 2.2, pz - pd / 2, pz + pd / 2, 0xd8cbb0, { jitter: 0.03 });
  gableEnds(flat, px - pw / 2, px + pw / 2, pz - pd / 2, pz + pd / 2, 2.2, 0.6, 0xd8cbb0);
  gableRoof(metal, px - pw / 2, px + pw / 2, pz - pd / 2, pz + pd / 2, 2.2, 0.6, 0.3, 0x9aa6ae);
  flat.boxMM(px - 0.4, px + 0.4, 0.15, 1.95, pz + pd / 2, pz + pd / 2 + 0.04, 0x4c6e86);
  metal.pipe(T.x - 0.5, 0.3, T.z + 0.4, px - pw / 2, 0.3, T.z + 0.4, 0.07, 0x2f68b0, 6);
  flat.cyl(0.28, 1.0, px + pw / 2 + 0.45, 0.15, pz - 0.3, 0x2a64b8, 10); // pressure tank
  colliders.push({ type: 'box', minX: px - pw / 2 - 0.15, maxX: px + pw / 2 + 0.8, minZ: pz - pd / 2 - 0.15, maxZ: pz + pd / 2 + 0.15 });
}

export function buildBuildings(group, mats, colliders, signTex) {
  const flat = new GeoBuilder(), metal = new GeoBuilder(), glass = new GeoBuilder(), set = new GeoBuilder(), roof = new GeoBuilder();
  office(flat, metal, glass, colliders, signTex, group);
  generatorShed(flat, metal, colliders, set, roof);
  const roofMat = fadingMetal(mats.metalFade);
  const roofMesh = roof.mesh(roofMat.m, { name: 'generator-roof' });
  roofMesh.userData.fade = roofMat.uFade;   // props-cond-gen.js sets it
  group.add(roofMesh);
  // the generator set in its own mesh about its own base, so the Phase 4 scene can shake it while it runs
  const G = FARM.generator, setMesh = set.mesh(mats.flatFade, { name: 'generator-set' });
  setMesh.geometry.translate(-G.x, -0.3, -G.z);
  setMesh.position.set(G.x, 0.3, G.z);
  setMesh.matrixAutoUpdate = true;
  group.add(setMesh);
  waterTower(flat, metal, colliders);
  group.add(flat.mesh(mats.flatFade, { name: 'buildings' }));
  group.add(metal.mesh(mats.metalFade, { name: 'buildings-metal' }));
  group.add(glass.mesh(mats.glass, { cast: false, name: 'office-windows' }));
}
