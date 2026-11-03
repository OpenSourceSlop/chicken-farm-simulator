// Low-poly models of the things the farmer handles: wheelbarrow, husk sack, chick box and the hand
// truck that takes a stack of ten, dead bird bucket, catching frame and hand scale, a chick.
// Each function adds flat-coloured parts to a Batch (house-kit.js) in its own local frame; props
// places the parked copies and player-carry.js the carried ones. Owner: package "props".
import * as THREE from 'three';
import { Batch, mat } from './house-kit.js';

export const C = {
  husk: 0xd3b273, huskDark: 0xb8955a,
  steel: 0xa9b1b7, steelDark: 0x5f676d, galv: 0xbcc3c8,
  red: 0xc23a2a, green: 0x3f7a4a, blue: 0x2d5f9a, black: 0x2b2e31, rubber: 0x26292c,
  kraft: 0xc59a62, kraftDark: 0x9c7442, print: 0x2f6b9a, hole: 0x3a2a1a,
  sack: 0xece7d8, sackSeam: 0xc9c1ad, sackPrint: 0x4f7fb0,
  chick: 0xf3cf5a, beak: 0xf0a640, eye: 0x1a120d,
  wood: 0x9a7246, woodDark: 0x6e4f2e,
};

// chick box: 0.60 x 0.13 x 0.45 m kraft carton, four vent holes on each long side
export const BOX = { w: 0.6, h: 0.13, d: 0.45 };

/** One chick box, origin at the centre of its bottom face. */
export function chickBoxGeometry() {
  const b = new Batch();
  const { w, h, d } = BOX;
  b.box(w, h, d, 0, h / 2, 0, C.kraft);
  b.box(w + 0.006, 0.018, d + 0.006, 0, h - 0.009, 0, C.kraftDark);            // lid rim
  b.box(w * 0.5, 0.004, d * 0.36, 0, h + 0.002, 0, 0xe9dcc0);                     // label
  b.box(w * 0.42, 0.005, 0.03, 0, h + 0.004, -d * 0.08, C.print);                // printed hatchery band
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) b.box(0.05, 0.03, 0.006, -0.21 + i * 0.14, h * 0.55, s * (d / 2 + 0.002), C.hole);
    b.box(0.006, 0.03, 0.05, s * (w / 2 + 0.002), h * 0.55, 0, C.hole);
  }
  return b.geometry();
}

/** A few chicks in an open box (the sample table): returns nothing, adds to b. */
export function chick(b, x, y, z, ry = 0, s = 1) {
  const M = (dx, dy, dz) => {
    const c = Math.cos(ry), sn = Math.sin(ry);
    return [x + (dx * c + dz * sn) * s, y + dy * s, z + (-dx * sn + dz * c) * s];
  };
  const body = new THREE.IcosahedronGeometry(0.03, 0);
  const head = new THREE.IcosahedronGeometry(0.019, 0);
  let p = M(0, 0.028, 0.004); b.add(body, C.chick, mat(p[0], p[1], p[2], 0, ry, 0, s, s * 0.9, s * 1.12));
  p = M(0, 0.06, -0.026); b.add(head, C.chick, mat(p[0], p[1], p[2], 0, ry, 0, s));
  p = M(0, 0.058, -0.046); b.box(0.01 * s, 0.008 * s, 0.014 * s, p[0], p[1], p[2], C.beak, ry);
  for (const e of [-1, 1]) { p = M(e * 0.013, 0.066, -0.038); b.box(0.005 * s, 0.006 * s, 0.004 * s, p[0], p[1], p[2], C.eye, ry); }
}

/** Two-wheel hand truck, nose plate on the ground at the origin, handles toward +z. */
export function handTruck(b, { tilt = 0 } = {}) {
  const T = (y, z) => [y * Math.cos(tilt) + z * Math.sin(tilt), -y * Math.sin(tilt) + z * Math.cos(tilt)];
  const P = (x, y, z) => { const [yy, zz] = T(y, z); return [x, yy, zz]; };
  for (const s of [-1, 1]) {
    b.rod(P(s * 0.26, 0.03, 0.06), P(s * 0.26, 1.32, 0.12), 0.016, C.red, 6);   // uprights
    b.rod(P(s * 0.26, 1.32, 0.12), P(s * 0.2, 1.45, 0.24), 0.016, C.red, 6);     // handle bend
    const [wy, wz] = T(0.11, 0.17);
    b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), C.rubber, mat(s * 0.34, wy, wz, 0, 0, Math.PI / 2));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.065, 8), C.galv, mat(s * 0.34, wy, wz, 0, 0, Math.PI / 2));
  }
  b.rod(P(-0.2, 1.45, 0.24), P(0.2, 1.45, 0.24), 0.018, C.black, 6);             // grip
  for (const y of [0.4, 0.8, 1.15]) b.rod(P(-0.26, y, 0.075 + y * 0.04), P(0.26, y, 0.075 + y * 0.04), 0.01, C.red, 4);
  b.rod(P(-0.34, 0.11, 0.17), P(0.34, 0.11, 0.17), 0.014, C.steelDark, 6);       // axle
  const [ny, nz] = T(0.012, -0.12);
  b.box(0.5, 0.012, 0.3, 0, ny, nz, C.steelDark, 0, -tilt);                     // nose plate
}

/** A stack of n chick boxes standing on a hand truck (for the carried mesh). */
export function boxesOnTruck(b, n = 10, tilt = 0) {
  const g = chickBoxGeometry();
  const c = Math.cos(tilt), s = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const y = 0.02 + i * BOX.h, z = -0.12;
    b.add(g, null, mat(0, y * c + z * s, -y * s + z * c, -tilt, (i % 2) * 0.02, 0));
  }
}

/** Wheelbarrow resting on its legs; wheel axle at (0, 0.2, 0), handles toward +z. full: husk heap. */
export function wheelbarrow(b, { full = false } = {}) {
  const tray = new THREE.CylinderGeometry(0.42, 0.3, 0.3, 4, 1, true);
  b.add(tray, C.green, mat(0, 0.5, 0.5, 0, Math.PI / 4, 0, 1, 1, 1.35));
  b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.01, 4), C.green, mat(0, 0.355, 0.5, 0, Math.PI / 4, 0, 1, 1, 1.35));
  b.add(new THREE.TorusGeometry(0.42 * 1.41, 0.012, 3, 4), 0x2f5f3a, mat(0, 0.65, 0.5, Math.PI / 2, 0, Math.PI / 4, 1, 1.35, 1));
  for (const s of [-1, 1]) {
    b.rod([s * 0.06, 0.2, 0], [s * 0.26, 0.36, 0.5], 0.014, C.red, 5);
    b.rod([s * 0.26, 0.36, 0.5], [s * 0.3, 0.46, 1.3], 0.016, C.red, 5);          // handle arms
    b.rod([s * 0.3, 0.46, 1.18], [s * 0.3, 0.465, 1.36], 0.022, C.black, 6);     // grips
    b.rod([s * 0.24, 0.36, 0.82], [s * 0.26, 0.0, 0.9], 0.012, C.red, 4);        // legs
    b.box(0.05, 0.015, 0.07, s * 0.26, 0.008, 0.9, C.black);
  }
  b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), C.rubber, mat(0, 0.2, 0, 0, 0, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.085, 8), C.red, mat(0, 0.2, 0, 0, 0, Math.PI / 2));
  if (full) {
    const heap = new THREE.IcosahedronGeometry(0.42, 1);
    b.add(heap, C.husk, mat(0, 0.6, 0.5, 0, 0.3, 0, 0.62, 0.32, 0.8));
    b.add(new THREE.IcosahedronGeometry(0.2, 0), C.huskDark, mat(0.05, 0.72, 0.42, 0.3, 0.8, 0, 0.9, 0.5, 1.1));
  }
}

/** White woven sack of rice husk lying on its side, centre at the origin, long axis along x. */
export function sack(b) {
  b.box(0.78, 0.26, 0.44, 0, 0, 0, C.sack);
  b.box(0.7, 0.3, 0.38, 0, 0, 0, C.sack);
  b.box(0.04, 0.24, 0.42, 0.4, 0, 0, C.sackSeam);                                // stitched end
  b.box(0.3, 0.005, 0.22, -0.05, 0.152, 0, C.sackPrint);
  for (const z of [-0.12, 0.12]) b.box(0.6, 0.004, 0.012, 0, 0.152, z, C.sackSeam);
}

/** Black plastic bucket with a wire handle, base at the origin. n > 0 shows dead chicks in it. */
export function bucket(b, { dead = false } = {}) {
  b.add(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 10, 1, true), C.black, mat(0, 0.15, 0));
  b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 10), C.black, mat(0, 0.005, 0));
  b.add(new THREE.TorusGeometry(0.15, 0.012, 3, 12), 0x3a3e42, mat(0, 0.3, 0, Math.PI / 2, 0, 0));
  b.add(new THREE.TorusGeometry(0.15, 0.005, 3, 10, Math.PI), C.galv, mat(0, 0.3, 0, 0, 0, 0));
  if (dead) {
    const body = new THREE.IcosahedronGeometry(0.04, 0);
    for (const [x, z, ry] of [[-0.04, 0.02, 0.4], [0.05, -0.03, 2], [0.0, 0.06, 4]]) b.add(body, 0xe9dfc0, mat(x, 0.24, z, 1.4, ry, 0, 1.2, 0.8, 1));
  }
}

/** Catching frame, 1 x 1 m wire pen (four 0.45 m high panels), open, centred on the origin. */
export function catchingFrame(b, { folded = false } = {}) {
  const H = 0.45, L = 1.0;
  const panel = (x0, z0, x1, z1) => {
    b.rod([x0, 0.02, z0], [x1, 0.02, z1], 0.012, C.galv, 4);
    b.rod([x0, H, z0], [x1, H, z1], 0.014, C.galv, 4);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      b.rod([x0 + (x1 - x0) * t, 0.02, z0 + (z1 - z0) * t], [x0 + (x1 - x0) * t, H, z0 + (z1 - z0) * t], 0.005, C.steel, 3);
    }
    b.rod([x0, H * 0.5, z0], [x1, H * 0.5, z1], 0.005, C.steel, 3);
  };
  if (folded) {
    for (let i = 0; i < 4; i++) panel(-0.5, i * 0.03, 0.5, i * 0.03);
    return;
  }
  const h = L / 2;
  panel(-h, -h, h, -h); panel(h, -h, h, h); panel(h, h, -h, h); panel(-h, h, -h, -h);
  for (const [x, z] of [[-h, -h], [h, -h], [h, h], [-h, h]]) b.rod([x, 0, z], [x, H + 0.03, z], 0.016, C.blue, 5);
}

/** Hanging digital hand scale with a hook and a weighing cone, hook top at the origin. */
export function handScale(b) {
  b.add(new THREE.TorusGeometry(0.025, 0.006, 3, 8), C.steelDark, mat(0, -0.02, 0));
  b.box(0.08, 0.12, 0.04, 0, -0.1, 0, 0xe2e5e7);
  b.box(0.06, 0.03, 0.005, 0, -0.08, -0.021, 0x1e3a2a);
  b.rod([0, -0.16, 0], [0, -0.22, 0], 0.004, C.steelDark, 4);
  b.add(new THREE.CylinderGeometry(0.09, 0.03, 0.14, 8, 1, true), C.blue, mat(0, -0.3, 0));
}
