// Low-poly models of the Phase 3 things (PHASE3.md §12): the hand tools (tape measure, fork, scraper,
// washer lance, sprayer, swab kit, light and air meters), broiler crates, catching panels, the LPG tank,
// the wash bay kit, the litter trailer, bait boxes, swab flags. Each adds flat-coloured parts to a Batch
// (house-kit.js) in its own local frame, origin on the ground (or at the hand for tools); props places the
// parked copies and player-carry.js the carried ones. Owner: package "scene".
import * as THREE from 'three';
import { mat } from './house-kit.js';
import { C } from './props-models.js';

export const C3 = {
  yellow: 0xe8b62a, yellowDark: 0xb88a17, orange: 0xe2702a, crate: 0x2f6fb5, crateDark: 0x24578f,
  panel: 0x7cbf4a, panelFrame: 0xa9b1b7, lpg: 0xf1f2ee, lpgBand: 0x2f6fb5, drum: 0x2f6fb5, drumGreen: 0x3f8a4a,
  washer: 0xd8b02a, hose: 0x2b2e31, flag: 0xd8322f, flagStick: 0xe9e6dc, bait: 0x2b2e31, concrete: 0xbdb8ab,
};

/** Tape measure: yellow case with the hook end, held in the right hand. */
export function tapeMeasure(b) {
  b.box(0.1, 0.1, 0.045, 0, 0, 0, C3.yellow);
  b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10), C3.yellowDark, mat(0, 0, 0, Math.PI / 2, 0, 0));
  b.box(0.03, 0.012, 0.012, 0.06, -0.04, 0, 0x8f989f);
}

/** Litter fork: tines down in front of the farmer, handle up to his hands. */
export function fork(b) {
  b.rod([0, 0.02, -0.75], [0, 1.0, -0.15], 0.016, C.wood, 5);
  b.box(0.3, 0.03, 0.03, 0, 0.06, -0.78, C.steelDark);
  for (let k = 0; k < 5; k++) b.rod([-0.12 + k * 0.06, 0.06, -0.78], [-0.12 + k * 0.06, 0.0, -0.98], 0.006, C.steel, 3);
  b.box(0.12, 0.03, 0.03, 0, 1.0, -0.15, 0x2b2e31);
}

/** Scraper: a wide blade pushed ahead along the floor (a 4 m strip is three blade widths; drawn 1.2 m). */
export function scraper(b) {
  b.box(1.2, 0.16, 0.03, 0, 0.09, -1.15, 0x9aa3a8);
  b.box(1.2, 0.025, 0.08, 0, 0.012, -1.13, 0x5f676d);
  b.rod([0, 0.12, -1.1], [0, 1.0, -0.2], 0.02, C.wood, 5);
  b.rod([-0.25, 0.14, -1.12], [0, 0.4, -0.85], 0.01, 0x6d757c, 4);
  b.rod([0.25, 0.14, -1.12], [0, 0.4, -0.85], 0.01, 0x6d757c, 4);
  b.box(0.3, 0.035, 0.035, 0, 1.0, -0.2, 0x2b2e31);
}

/** Pressure washer lance with its trigger gun (the hose is drawn by props to the wash bay). */
export function washerLance(b) {
  b.box(0.05, 0.14, 0.08, 0, 0, 0, C3.washer);
  b.box(0.04, 0.05, 0.12, 0, 0.06, -0.06, 0x2b2e31);
  b.rod([0, 0.06, -0.1], [0, -0.25, -0.95], 0.012, 0x8f989f, 5);
  b.box(0.04, 0.04, 0.08, 0, -0.27, -0.98, 0x2b2e31);
}

/** Knapsack sprayer: a tank on the back and a wand in the right hand. */
export function sprayer(b) {
  b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.48, 10), 0xe9edf0, mat(0, 1.2, 0.24, 0, 0, 0, 1, 1, 0.7));
  b.box(0.3, 0.05, 0.16, 0, 1.46, 0.24, C3.drumGreen);
  b.rod([0.2, 1.0, 0.1], [0.32, 0.9, -0.35], 0.012, C3.hose, 4);
  b.rod([0.32, 0.9, -0.35], [0.32, 0.55, -0.95], 0.01, 0x8f989f, 4);
  b.box(0.04, 0.04, 0.06, 0.32, 0.54, -0.98, 0x2b2e31);
}

/** Swab kit: a white box with a red cross lid and a rack of tubes, held in the left hand. */
export function swabKit(b) {
  b.box(0.28, 0.12, 0.18, 0, 0, 0, 0xf4f1ea);
  b.box(0.26, 0.012, 0.16, 0, 0.066, 0, 0x2f7a6a);
  for (let k = 0; k < 5; k++) b.rod([-0.1 + k * 0.05, 0.07, 0.03], [-0.1 + k * 0.05, 0.16, 0.03], 0.008, 0xf4f1ea, 4);
  b.box(0.06, 0.04, 0.04, 0, 0.1, -0.07, 0x9aa3a8);
}

/** Hand-held meter (light meter: a white sensor dome; air meter: a vane wheel on a stalk). */
export function handMeter(b, kind) {
  b.box(0.07, 0.13, 0.03, 0, 0, 0, kind === 'air' ? 0x2f5d8a : 0xe9edf0);
  b.box(0.05, 0.04, 0.005, 0, 0.03, -0.018, 0x1e3a2a);
  if (kind === 'air') {
    b.rod([0, 0.06, 0], [0, 0.2, -0.02], 0.006, 0x6d757c, 4);
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), 0x9aa3a8, mat(0, 0.23, -0.02, Math.PI / 2, 0, 0));
  } else {
    b.add(new THREE.SphereGeometry(0.025, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, mat(0, 0.07, 0));
  }
}

/** Broiler crate 0.95 x 0.27 x 0.57 m, base at the origin, long side along x. */
export function crate(b, color = C3.crate) {
  b.box(0.95, 0.04, 0.57, 0, 0.02, 0, color);
  b.box(0.95, 0.05, 0.57, 0, 0.245, 0, color);
  for (const s of [-1, 1]) {
    b.box(0.95, 0.2, 0.025, 0, 0.13, s * 0.272, C3.crateDark);
    b.box(0.025, 0.2, 0.57, s * 0.462, 0.13, 0, C3.crateDark);
  }
}

/** Catching panel: a 1.2 m wide, 0.65 m high mesh panel on two feet (centre at the origin, along z). */
export function catchPanel(b) {
  const H = 0.65, W = 1.2;
  b.box(0.03, 0.03, W, 0, H, 0, C3.panelFrame);
  b.box(0.03, 0.03, W, 0, 0.05, 0, C3.panelFrame);
  for (const s of [-1, 1]) { b.box(0.03, H, 0.03, 0, H / 2, s * W / 2, C3.panelFrame); b.box(0.25, 0.02, 0.04, 0, 0.01, s * (W / 2 - 0.05), C3.panelFrame); }
  b.box(0.012, H - 0.08, W - 0.06, 0, H / 2 + 0.02, 0, C3.panel);
}

/** White LPG tank on two saddle legs, axis along x, about 2.4 m long, centre height 0.95 m. */
export function lpgTank(b) {
  const L = 1.8, R = 0.55, y = 0.95;
  b.add(new THREE.CylinderGeometry(R, R, L, 14), C3.lpg, mat(0, y, 0, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(R, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), C3.lpg, mat(s * L / 2, y, 0, 0, 0, -s * Math.PI / 2, 1, 0.55, 1));
  for (const s of [-0.55, 0.55]) {
    b.box(0.12, y - 0.25, 0.9, s, (y - 0.25) / 2, 0, 0x9aa3a8);
    b.box(0.3, 0.04, 1.0, s, 0.02, 0, 0x6d757c);
  }
  b.box(L * 0.9, 0.06, 0.02, 0, y + 0.12, R + 0.002, C3.lpgBand);
  // valve dome and gauge on top
  b.add(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 10), 0x9aa3a8, mat(0.25, y + R + 0.04, 0));
  b.box(0.05, 0.12, 0.05, 0.1, y + R + 0.1, 0.0, 0xb08d3c);
  b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 14), 0x2b2f33, mat(0.1, y + R + 0.2, 0.03, Math.PI / 2, 0, 0));
  b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.006, 14), 0xf4f4ef, mat(0.1, y + R + 0.2, 0.047, Math.PI / 2, 0, 0));
}

/** Pressure washer cart: engine box on two wheels with a handle; hose reel beside it. */
export function washerCart(b) {
  b.box(0.6, 0.4, 0.45, 0, 0.45, 0, C3.washer);
  b.box(0.5, 0.18, 0.35, 0, 0.74, 0, 0x2b2e31);
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), C.rubber, mat(-0.15, 0.16, s * 0.27, Math.PI / 2, 0, 0));
  b.rod([0.25, 0.5, -0.2], [0.5, 1.0, -0.2], 0.015, 0x6d757c, 4);
  b.rod([0.25, 0.5, 0.2], [0.5, 1.0, 0.2], 0.015, 0x6d757c, 4);
  b.rod([0.5, 1.0, -0.2], [0.5, 1.0, 0.2], 0.018, 0x2b2e31, 4);
  // hose reel
  b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14), C3.hose, mat(0.95, 0.42, 0, Math.PI / 2, 0, 0));
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 14), 0x9aa3a8, mat(0.95, 0.42, s * 0.11, Math.PI / 2, 0, 0));
  b.box(0.06, 0.1, 0.5, 0.95, 0.05, 0, 0x6d757c);
}

/** 200 L drum, base at the origin. */
export function drum(b, color = C3.drum) {
  b.add(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 12), color, mat(0, 0.44, 0));
  for (const y of [0.3, 0.6]) b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 12), 0x1f4f85, mat(0, y, 0));
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), 0xe9e6dc, mat(0.12, 0.89, 0.05));
}

/** Litter trailer: an open steel box on two wheels with a drawbar, long side along x, 3.2 m. */
export function trailer(b) {
  const L = 3.2, W = 1.7, H = 0.7, y0 = 0.55;
  b.box(L, 0.06, W, 0, y0, 0, 0x6d757c);
  for (const s of [-1, 1]) { b.box(L, H, 0.05, 0, y0 + H / 2, s * W / 2, 0x7f8c63); b.box(0.05, H, W, s * L / 2, y0 + H / 2, 0, 0x7f8c63); }
  for (const s of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 12), C.rubber, mat(0, 0.33, s * (W / 2 + 0.12), Math.PI / 2, 0, 0));
    b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.21, 8), 0xb8bec4, mat(0, 0.33, s * (W / 2 + 0.12), Math.PI / 2, 0, 0));
  }
  b.rod([L / 2, y0, 0], [L / 2 + 1.1, 0.45, 0], 0.04, 0x5f676d, 5);
  b.box(0.06, 0.45, 0.06, L / 2 + 1.0, 0.22, 0, 0x5f676d);
}

/** Rodent bait station: a black lockable box with an entry hole each end. */
export function baitBox(b) {
  b.box(0.36, 0.14, 0.24, 0, 0.07, 0, C3.bait);
  b.box(0.38, 0.03, 0.26, 0, 0.155, 0, 0x3a3e42);
  for (const s of [-1, 1]) b.box(0.01, 0.06, 0.07, s * 0.181, 0.05, 0, 0x111111);
  b.box(0.12, 0.004, 0.06, 0, 0.172, 0, 0xe8b62a);
}

/** Guard hut bench and clothes rack: blue farm clothes on hooks, white boots below, base at the origin,
 *  the rack's front facing +x (toward the gate road). */
export function hutRack(b) {
  // bench
  b.box(0.42, 0.04, 1.3, 0, 0.45, 0, C.wood);
  for (const s of [-1, 1]) b.box(0.36, 0.45, 0.05, 0, 0.225, s * 0.55, C.woodDark);
  // rack: two posts and a rail with hooks, three coveralls hanging
  for (const s of [-1, 1]) b.box(0.05, 1.75, 0.05, -0.1, 0.875, s * 0.7, 0x8f989f);
  b.rod([-0.1, 1.7, -0.7], [-0.1, 1.7, 0.7], 0.015, 0x8f989f, 4);
  for (let k = 0; k < 3; k++) {
    const z = -0.42 + k * 0.42;
    b.box(0.08, 0.7, 0.36, -0.06, 1.28, z, k === 1 ? 0x2b5486 : 0x3b6ea5);
    b.box(0.07, 0.18, 0.42, -0.06, 1.55, z, k === 1 ? 0x2b5486 : 0x3b6ea5);
    b.box(0.09, 0.05, 0.12, -0.06, 1.66, z, 0x2a4a73);
  }
  // white boots under the bench
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) b.box(0.13, 0.3, 0.09, 0.05, 0.15, -0.4 + k * 0.4 + s * 0.06, 0xf0f0ea);
}

/** Swab flag: a white stick with a small red flag (base at the origin, the flag toward +x). */
export function swabFlag(b) {
  b.rod([0, 0, 0], [0, 0.55, 0], 0.006, C3.flagStick, 4);
  b.box(0.16, 0.1, 0.004, 0.08, 0.49, 0, C3.flag);
}
