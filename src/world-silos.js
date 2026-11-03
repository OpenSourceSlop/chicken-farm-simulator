// Galvanised feed silos with the auger into the house north wall, and the spirit house by the
// office. Owner: world agent.
import * as THREE from 'three';
import { COLORS, FARM, FEED_INLET, HOUSE, HOUSE_BOUNDS } from './config.js';
import { GeoBuilder, unitCone, unitCyl, unitBox } from './world-util.js';

const GALV = 0xc8d0d6, GALV_DK = 0xa3acb3, GALV_RIB = 0xb4bdc4, LEG = 0x8f979e;
export const AUGER_WALL_Z = HOUSE_BOUNDS.zMin - HOUSE.wallThickness; // exterior face of the north wall (-6.15)

function silo(metal, x, z, ladderAngle) {
  const R = 1.3, legTop = 2.25, tip = 0.95, body = 5.0, roof = 6.05;
  // legs with cross braces
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    legs.push([x + Math.cos(a) * (R - 0.05), z + Math.sin(a) * (R - 0.05)]);
  }
  for (const [lx, lz] of legs) {
    metal.box(0.12, legTop + 0.2, 0.12, lx, 0, lz, LEG);
    metal.box(0.3, 0.05, 0.3, lx, 0, lz, LEG);
  }
  for (let i = 0; i < 4; i++) {
    const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
    metal.pipe(ax, 0.3, az, bx, legTop - 0.2, bz, 0.025, LEG, 4);
    metal.pipe(bx, 0.3, bz, ax, legTop - 0.2, az, 0.025, LEG, 4);
  }
  // hopper cone, body with rib rings, roof cone, lid
  metal.add(unitCone(16), GALV_DK, { x, y: (tip + legTop) / 2, z, sx: R, sy: -(legTop - tip), sz: R });
  metal.cyl(R, body - legTop, x, legTop, z, GALV, 16);
  for (let y = legTop + 0.45; y < body; y += 0.55) metal.cyl(R + 0.025, 0.05, x, y, z, GALV_RIB, 16);
  metal.cyl(R + 0.06, 0.12, x, body - 0.06, z, GALV_DK, 16);
  metal.add(unitCone(16), GALV, { x, y: (body + roof) / 2, z, sx: R + 0.08, sy: roof - body, sz: R + 0.08 });
  metal.cyl(0.32, 0.18, x, roof - 0.12, z, GALV_DK, 10);
  metal.add(unitCone(10), GALV_DK, { x, y: roof + 0.16, z, sx: 0.36, sy: 0.2, sz: 0.36 });
  // boot under the hopper
  metal.box(0.32, 0.3, 0.32, x, 0.62, z, GALV_DK);
  // ladder up the side and over the roof to the lid, with a cage hoop or two
  const ca = Math.cos(ladderAngle), sa = Math.sin(ladderAngle), tx = -sa, tz = ca;
  const rr = R + 0.18;
  for (const s of [-0.2, 0.2]) {
    metal.pipe(x + ca * rr + tx * s, 0.5, z + sa * rr + tz * s, x + ca * rr + tx * s, body + 0.15, z + sa * rr + tz * s, 0.02, GALV_DK, 4);
    metal.pipe(x + ca * rr + tx * s, body + 0.15, z + sa * rr + tz * s, x + ca * 0.45 + tx * s, roof + 0.05, z + sa * 0.45 + tz * s, 0.02, GALV_DK, 4);
  }
  for (let y = 0.8; y < body + 0.1; y += 0.32) {
    metal.pipe(x + ca * rr - tx * 0.2, y, z + sa * rr - tz * 0.2, x + ca * rr + tx * 0.2, y, z + sa * rr + tz * 0.2, 0.014, GALV_DK, 3);
  }
  for (const y of [3.2, 4.1, 5.0]) {
    metal.add(new THREE.TorusGeometry(0.36, 0.015, 3, 10, Math.PI), GALV_DK, { x: x + ca * (rr + 0.02), y, z: z + sa * (rr + 0.02), rx: Math.PI / 2, rz: ladderAngle - Math.PI / 2, order: 'XYZ' });
  }
}

export function buildSilos(group, mats, colliders) {
  const metal = new GeoBuilder(), flat = new GeoBuilder();
  const [a, b] = FARM.silos;
  // The feed auger meets the house's cross auger where it enters the north wall (FEED_INLET),
  // so the collection hopper sits under that point, at the west end of the boot-level auger.
  const ix = FEED_INLET.x, z = a.z;
  const x0 = Math.min(a.x, b.x, ix), x1 = Math.max(a.x, b.x);
  // concrete pad stops short of the house apron zone (z > -8)
  flat.boxMM(Math.min(a.x - 1.9, ix - 0.7), x1 + 1.9, -0.02, 0.14, z - 1.9, -8.05, COLORS.concrete);
  silo(metal, a.x, a.z, Math.PI * 0.82);
  silo(metal, b.x, b.z, Math.PI * 0.18);
  for (const s of FARM.silos) colliders.push({ type: 'circle', x: s.x, z: s.z, r: 1.5 });

  // cross auger joining both boots and running on to the collection hopper under FEED_INLET,
  // then the feed auger rising north to the house wall, where the house's cross auger continues
  const yb = 0.55;
  metal.pipe(x0 - 0.1, yb, z, x1, yb, z, 0.11, GALV_DK, 8);
  metal.box(0.5, 0.45, 0.5, ix, 0.3, z, 0x6d757c); // collection hopper
  const wallY = FEED_INLET.y, elbowZ = AUGER_WALL_Z - 0.45;
  metal.pipe(ix, yb + 0.1, z, ix, wallY, elbowZ + 0.05, 0.12, GALV, 8);
  metal.pipe(ix, wallY, elbowZ, ix, wallY, AUGER_WALL_Z - 0.06, 0.09, GALV, 8);
  metal.cyl(0.14, 0.12, ix, wallY - 0.06, AUGER_WALL_Z - 0.06, GALV_DK, 10, { rx: Math.PI / 2 }); // wall flange
  // drive motor on the top elbow, A-frame support mid-span
  const my = wallY + 0.12;
  metal.box(0.36, 0.34, 0.5, ix, my, elbowZ - 0.2, 0x3d6f8f);
  metal.add(unitCyl(10), 0x2f5670, { x: ix, y: my + 0.17, z: elbowZ - 0.55, sx: 0.15, sy: 0.35, sz: 0.15, rx: Math.PI / 2 });
  const sz = (z + elbowZ) / 2, sy = (yb + wallY) / 2;
  metal.pipe(ix - 0.45, 0.14, sz, ix, sy - 0.12, sz, 0.035, LEG, 4);
  metal.pipe(ix + 0.45, 0.14, sz, ix, sy - 0.12, sz, 0.035, LEG, 4);
  colliders.push({ type: 'box', minX: ix - 0.5, maxX: ix + 0.5, minZ: z, maxZ: sz + 0.3 });

  group.add(metal.mesh(mats.metalFade, { name: 'silos' }));
  group.add(flat.mesh(mats.flat, { name: 'silo-pad' }));
}

// Spirit house (san phra phum) on its pillar, with offerings
export function spiritHouse(flat, metal, x, z, colliders) {
  flat.boxMM(x - 0.8, x + 0.8, 0, 0.12, z - 0.8, z + 0.8, 0xd8d0c0);
  flat.box(0.28, 1.25, 0.28, x, 0.12, z, 0xf2ece0);
  flat.box(1.0, 0.08, 1.0, x, 1.37, z, 0xf2ece0);
  flat.box(0.95, 0.06, 0.95, x, 1.31, z, 0xc9a640);
  flat.box(0.52, 0.5, 0.42, x, 1.45, z - 0.1, 0xf0d58a);
  flat.box(0.16, 0.32, 0.02, x, 1.47, z + 0.115, 0x8a2a20);
  // two-tier gable roof, front gable to the south, red tiles with green eaves and gold finials
  for (const [base, w, len, zc, c] of [[1.93, 0.86, 0.72, z - 0.1, 0xc4402c], [2.2, 0.56, 0.5, z - 0.1, 0xd4562e]]) {
    const pitch = 0.78, h = (w / 2) * Math.tan(pitch);
    for (const s of [-1, 1]) {
      flat.add(unitBox(), c, { x: x + s * w / 4, y: base + h / 2, z: zc, sx: (w / 2) / Math.cos(pitch) + 0.06, sy: 0.035, sz: len, rz: -s * pitch, order: 'XYZ' });
      flat.add(unitBox(), 0x2c6e4a, { x: x + s * (w / 2 + 0.01), y: base - 0.01, z: zc, sx: 0.04, sy: 0.04, sz: len, order: 'XYZ' });
    }
    const fz = zc + len / 2 - 0.02;
    flat.tri(x - w / 2 + 0.04, base + 0.02, fz, x + w / 2 - 0.04, base + 0.02, fz, x, base + h - 0.02, fz, 0xd8b040);
    flat.add(unitCone(4), 0xe0b848, { x, y: base + h + 0.08, z: zc + len / 2, sx: 0.025, sy: 0.18, sz: 0.025, rx: 0.5 });
    flat.add(unitCone(4), 0xe0b848, { x, y: base + h + 0.08, z: zc - len / 2, sx: 0.025, sy: 0.18, sz: 0.025, rx: -0.5 });
  }
  flat.add(unitCone(6), 0xd8b040, { x, y: 2.75, z: z - 0.1, sx: 0.04, sy: 0.32, sz: 0.04 });
  // offerings: red drinks, marigold garland, incense pot
  for (const ox of [-0.3, -0.2]) flat.cyl(0.035, 0.16, x + ox, 1.45, z + 0.32, 0xd8322f, 6);
  flat.add(new THREE.TorusGeometry(0.09, 0.03, 4, 8), 0xf2a33a, { x: x + 0.25, y: 1.48, z: z + 0.32, rx: Math.PI / 2 });
  flat.cyl(0.06, 0.08, x + 0.05, 1.45, z + 0.35, 0x8a6a40, 6);
  colliders.push({ type: 'circle', x, z, r: 0.6 });
}
