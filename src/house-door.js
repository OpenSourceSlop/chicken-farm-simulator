// Door portal with two steel leaves standing open, canopy, foot-dip tray, concrete apron around the
// house, the last stretch of path to the door and the "HOUSE 1" sign. Owner: house agent.
import * as THREE from 'three';
import { COLORS, HOUSE, HOUSE_BOUNDS, FARM } from './config.js';
import { mat, unitBox, canvasTexture, roundRect, FONT } from './house-kit.js';
import { T, H, FRAME_X } from './house-shell.js';

const { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;
const STEEL = 0xc5cbcf, STEEL_EDGE = 0x8b949b;

function part(b, M, w, h, d, x, y, z, color) {
  b.add(unitBox(), color, M.clone().multiply(mat(x, y, z, 0, 0, 0, w, h, d)));
}

// The portal, door leaves and canopy go into `porch` (its own mesh, faded while the farmer is at
// the door or inside with the camera on the south side); threshold and foot dip into `stat`.
// Phase 3: the leaves are their own batches (`leaves.open`, `leaves.shut`): the house shows the shut
// pair while the clean house rests (farm.house.closed, level only); open as in Phase 1 otherwise.
export function buildDoor(stat, porch = stat, leaves = null) {
  const d = HOUSE.door;
  const x0 = d.x - d.width / 2, x1 = d.x + d.width / 2;
  const zc = zMax + T / 2;
  const doorH = 2.05;
  // portal: posts, header panel and lintel stay standing when the side wall slides down
  for (const px of [x0 - 0.05, x1 + 0.05]) porch.box(0.1, H, T + 0.04, px, H / 2, zc, STEEL_EDGE);
  porch.box(x1 - x0, H - doorH, T, d.x, (H + doorH) / 2, zc, COLORS.wallWhite);
  porch.box(x1 - x0 + 0.2, 0.08, T + 0.04, d.x, doorH + 0.04, zc, STEEL_EDGE);
  porch.box(x1 - x0 + 0.2, 0.06, T + 0.04, d.x, H - 0.03, zc, 0xb5bcc2);
  stat.box(x1 - x0, 0.05, T + 0.1, d.x, 0.025, zc, COLORS.concrete); // threshold

  // two leaves swung outward about 100 degrees (or shut in the door frame)
  const leafPair = (b, open) => {
    for (const side of [-1, 1]) {
      const hx = side < 0 ? x0 : x1;
      const dirX = side < 0 ? Math.cos(open) : -Math.cos(open);
      const dirZ = Math.sin(open);
      const ry = Math.atan2(-dirZ, dirX);
      const M = mat(hx, 0, zMax + T + 0.03, 0, ry, 0);
      const w = d.width / 2 - 0.02;
      part(b, M, w, doorH - 0.04, 0.045, w / 2, doorH / 2, 0, STEEL);
      part(b, M, w, 0.06, 0.06, w / 2, doorH - 0.05, 0, STEEL_EDGE);
      part(b, M, w, 0.06, 0.06, w / 2, 0.06, 0, STEEL_EDGE);
      part(b, M, 0.06, doorH - 0.04, 0.06, 0.03, doorH / 2, 0, STEEL_EDGE);
      part(b, M, 0.06, doorH - 0.04, 0.06, w - 0.03, doorH / 2, 0, STEEL_EDGE);
      part(b, M, w - 0.12, 0.3, 0.05, w / 2, 0.3, 0, 0xa9b0b5);          // kick plate
      part(b, M, w * 0.5, 0.42, 0.055, w / 2, 1.55, 0, 0x5c7480);       // wired glass window
      part(b, M, 0.03, 0.12, 0.08, w - 0.1, 1.0, 0, 0x3c4246);          // handle
    }
  };
  leafPair(leaves ? leaves.open : porch, (100 * Math.PI) / 180);
  if (leaves) {
    leafPair(leaves.shut, 0);
    // the seal across the shut pair: a padlocked bar and a "resting" tag
    leaves.shut.box(d.width - 0.1, 0.06, 0.05, d.x, 1.05, zMax + T + 0.09, 0x6d757c);
    leaves.shut.box(0.08, 0.1, 0.05, d.x, 1.0, zMax + T + 0.12, 0xb08d3c);
    leaves.shut.box(0.3, 0.2, 0.01, d.x + 0.35, 1.45, zMax + T + 0.08, 0xf2e6c4);
  }

  // canopy over the door on two posts
  const cz0 = zMax + T, cz1 = zMax + T + 1.55, cw = 2.7;
  const yBack = 2.48, yFront = 2.3;
  const slope = Math.atan2(yBack - yFront, cz1 - cz0);
  const CM = mat(d.x, (yBack + yFront) / 2, (cz0 + cz1) / 2, slope, 0, 0);
  const len = Math.hypot(cz1 - cz0, yBack - yFront);
  part(porch, CM, cw, 0.035, len, 0, 0, 0, COLORS.roofBlue);
  for (let x = -cw / 2 + 0.09; x < cw / 2; x += 0.18) part(porch, CM, 0.05, 0.03, len, x, 0.03, 0, 0x4c7cab);
  part(porch, CM, cw + 0.04, 0.12, 0.05, 0, -0.03, len / 2, 0x2f5578);   // fascia
  for (const px of [d.x - cw / 2 + 0.1, d.x + cw / 2 - 0.1]) {
    porch.box(0.08, yFront, 0.08, px, yFront / 2, cz1 - 0.08, STEEL_EDGE);
    stat.box(0.2, 0.03, 0.2, px, 0.05, cz1 - 0.08, 0x7c858c);
    porch.bar([px, yFront - 0.08, cz1 - 0.1], [px, yBack - 0.08, cz0 + 0.05], 0.05, STEEL_EDGE);
  }
  for (const s of [-1, 1]) porch.bar([d.x + s * (cw / 2 - 0.1), yBack - 0.4, zc + 0.08], [d.x + s * (cw / 2 - 0.1), yBack - 0.06, cz0 + 0.5], 0.04, STEEL_EDGE);

  // foot-dip tray with disinfectant
  const fd = FARM.footDipHouse;
  const tw = 1.25, td = 0.72, th = 0.11;
  stat.box(tw, 0.04, td, fd.x, 0.06, fd.z, 0x9a958b);
  for (const s of [-1, 1]) {
    stat.box(tw, th, 0.06, fd.x, th / 2 + 0.04, fd.z + s * (td / 2 - 0.03), 0xd7d3ca);
    stat.box(0.06, th, td, fd.x + s * (tw / 2 - 0.03), th / 2 + 0.04, fd.z, 0xd7d3ca);
  }
  stat.box(tw - 0.12, 0.02, td - 0.12, fd.x, 0.12, fd.z, 0x2f7f86);
  stat.box(0.35, 0.012, 0.25, fd.x + 0.25, 0.132, fd.z - 0.08, 0x4d9aa1);  // a lighter ripple
}

// 1.2 m concrete apron around the house plus the last 2 m of the path to the door.
export function buildApron(stat) {
  const w = 1.2, ox0 = xMin - T, ox1 = xMax + T, oz0 = zMin - T, oz1 = zMax + T;
  const y0 = -0.02, y1 = 0.045, hh = y1 - y0, yc = (y0 + y1) / 2;
  const c = COLORS.concrete, joint = 0xa8a397;
  stat.box(ox1 - ox0 + 2 * w, hh, w, 0, yc, oz0 - w / 2, c);
  stat.box(ox1 - ox0 + 2 * w, hh, w, 0, yc, oz1 + w / 2, c);
  stat.box(w, hh, oz1 - oz0, ox0 - w / 2, yc, 0, c);
  stat.box(w, hh, oz1 - oz0, ox1 + w / 2, yc, 0, c);
  for (const x of FRAME_X) {
    if (x === xMin || x === xMax) continue;
    stat.box(0.03, 0.006, w, x, y1, oz0 - w / 2, joint);
    if (Math.abs(x - HOUSE.door.x) > 1.6) stat.box(0.03, 0.006, w, x, y1, oz1 + w / 2, joint);
  }
  // path to the door, z 6..8
  const d = HOUSE.door;
  stat.box(2.5, hh, 8 - oz1 - w + 0.02, d.x, yc - 0.002, (oz1 + w + 8) / 2, c);
  stat.box(2.5, 0.006, 0.03, d.x, y1, oz1 + w, joint);
}

// "HOUSE 1" board on the outside of the south wall (rides on the sliding wall panel).
export function houseSign() {
  const tex = canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#2f5d8a';
    roundRect(g, 0, 0, w, h, 14); g.fill();
    g.strokeStyle = '#f3ecd8'; g.lineWidth = 7;
    roundRect(g, 10, 10, w - 20, h - 20, 10); g.stroke();
    g.fillStyle = '#f3ecd8';
    g.font = `700 98px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HOUSE 1', w / 2, h / 2 + 4);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.69), new THREE.MeshLambertMaterial({ map: tex }));
  // in front of the curtain band (z 6.1425) but still inside the kick wall face (6.15) when lowered
  m.position.set(-10.2, 1.62, zMax + T / 2 + 0.0715);
  return m;
}
