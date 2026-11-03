// Small props that make the yard feel lived in: a farm pickup at the loading area, a motorbike by
// the office and a Thai flag on a pole. Owner: world agent.
import * as THREE from 'three';
import { FARM } from './config.js';
import { GeoBuilder, unitCyl, unitBox, patchOcclusion } from './world-util.js';

// White pickup truck. (x, z) centre, heading angle `ry` (0 = facing +X).
function pickup(flat, metal, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  // local (u along the truck, v across) -> world
  const P = (u, v) => [x + u * c - v * s, z + u * s + v * c];
  const box = (b, u0, u1, y0, y1, v0, v1, col) => {
    const [px, pz] = P((u0 + u1) / 2, (v0 + v1) / 2);
    b.add(unitBox(), col, { x: px, y: (y0 + y1) / 2, z: pz, sx: u1 - u0, sy: y1 - y0, sz: v1 - v0, ry: -ry });
  };
  const body = 0xf2f2ee, trim = 0x2b2f33, glass = 0x2c3e4e;
  box(flat, -2.55, 2.45, 0.42, 0.95, -0.88, 0.88, body);           // lower body
  box(flat, 0.3, 2.45, 0.95, 1.05, -0.86, 0.86, body);              // bonnet
  box(flat, -0.95, 0.75, 0.95, 1.72, -0.84, 0.84, body);            // cab
  box(metal, 0.72, 0.8, 1.02, 1.62, -0.78, 0.78, glass);            // windscreen
  box(metal, -0.9, 0.55, 1.12, 1.6, -0.86, 0.86, glass);            // side windows
  box(flat, -2.55, -1.0, 0.95, 1.28, -0.88, -0.8, body);            // bed sides
  box(flat, -2.55, -1.0, 0.95, 1.28, 0.8, 0.88, body);
  box(flat, -2.6, -2.5, 0.75, 1.28, -0.88, 0.88, body);             // tailgate
  box(flat, -2.5, -1.0, 0.94, 0.96, -0.8, 0.8, 0x3a3e42);           // bed floor
  box(flat, 2.42, 2.56, 0.45, 0.72, -0.9, 0.9, trim);               // bumper and grille
  box(flat, -2.68, -2.58, 0.42, 0.62, -0.9, 0.9, trim);
  box(metal, 2.44, 2.5, 0.8, 0.92, -0.78, -0.5, 0xfff6d8);          // headlights
  box(metal, 2.44, 2.5, 0.8, 0.92, 0.5, 0.78, 0xfff6d8);
  box(flat, -2.62, -2.58, 0.85, 1.05, -0.86, -0.7, 0xc8322a);       // tail lights
  box(flat, -2.62, -2.58, 0.85, 1.05, 0.7, 0.86, 0xc8322a);
  for (const u of [-1.6, 1.55]) {
    for (const v of [-0.82, 0.82]) {
      const [px, pz] = P(u, v);
      flat.add(unitCyl(10), 0x26292c, { x: px, y: 0.36, z: pz, sx: 0.36, sy: 0.26, sz: 0.36, rx: Math.PI / 2, ry: -ry, order: 'YXZ' });
      const [hx, hz] = P(u, v * 1.17);
      flat.add(unitCyl(8), 0xb8bec4, { x: hx, y: 0.36, z: hz, sx: 0.18, sy: 0.02, sz: 0.18, rx: Math.PI / 2, ry: -ry, order: 'YXZ' });
    }
  }
  // a few feed sacks in the bed
  for (const [u, v] of [[-1.9, -0.35], [-1.9, 0.35], [-1.35, 0]]) {
    const [px, pz] = P(u, v);
    flat.add(unitBox(), 0xe8dcc0, { x: px, y: 1.08, z: pz, sx: 0.5, sy: 0.24, sz: 0.62, ry: -ry + 0.1 });
  }
}

// Step-through motorbike on its side stand
function motorbike(flat, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (u) => [x + u * c, z + u * s];
  for (const u of [-0.62, 0.62]) {
    const [px, pz] = at(u);
    flat.add(unitCyl(10), 0x26292c, { x: px, y: 0.3, z: pz, sx: 0.3, sy: 0.1, sz: 0.3, rx: Math.PI / 2, ry: -ry, order: 'YXZ' });
  }
  const part = (u, y, l, h, w, col, tilt = 0) => {
    const [px, pz] = at(u);
    flat.add(unitBox(), col, { x: px, y, z: pz, sx: l, sy: h, sz: w, ry: -ry, rz: tilt, order: 'YXZ' });
  };
  part(-0.25, 0.55, 0.8, 0.3, 0.3, 0xb82a2a);       // rear body panel
  part(-0.3, 0.78, 0.62, 0.1, 0.28, 0x2b2f33);      // seat
  part(0.15, 0.42, 0.5, 0.12, 0.2, 0x3a3e42);       // step-through floor
  part(0.45, 0.62, 0.14, 0.6, 0.26, 0xb82a2a, -0.35); // leg shield
  part(0.58, 1.0, 0.16, 0.1, 0.62, 0x2b2f33);       // handlebar
  part(0.66, 0.92, 0.12, 0.16, 0.18, 0xeeeeea);     // headlight
}

// Thai flag (red-white-blue-white-red) on a pole, waving
function flagMesh(x, z) {
  const b = new GeoBuilder({ uv: true });
  const W = 1.5, H = 1.0, cols = 8, top = 6.4;
  const bands = [[0, 1, 0xa5191d], [1, 2, 0xf4f1ea], [2, 4, 0x2d2a6a], [4, 5, 0xf4f1ea], [5, 6, 0xa5191d]];
  for (const [b0, b1, col] of bands) {
    const y0 = top - (b1 / 6) * H, y1 = top - (b0 / 6) * H;
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols, u1 = (i + 1) / cols;
      b.quad([x + u0 * W, y0, z], [x + u1 * W, y0, z], [x + u1 * W, y1, z], [x + u0 * W, y1, z], col, [u0, 0, u1, 0, u1, 1, u0, 1]);
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fu = uv.x;
        transformed.z += fu * (sin(fu * 5.0 - uTime * 4.2) * 0.16 + sin(fu * 9.0 - uTime * 6.3) * 0.04);
        transformed.y -= fu * fu * 0.08;`);
    patchOcclusion(shader);
  };
  mat.customProgramCacheKey = () => 'flag-wave';
  const mesh = b.mesh(mat, { cast: true, receive: true, name: 'flag' });
  return { mesh, uniforms };
}

export function buildProps(group, mats, colliders) {
  const flat = new GeoBuilder(), metal = new GeoBuilder();
  // pickup parked at the loading area at the end of the road, facing west
  const end = FARM.road[FARM.road.length - 1];
  pickup(flat, metal, end.x + 0.5, end.z + 1.8, Math.PI);
  colliders.push({ type: 'box', minX: end.x - 2.3, maxX: end.x + 3.3, minZ: end.z + 0.8, maxZ: end.z + 2.8 });
  // motorbike on the office apron
  const O = FARM.office;
  motorbike(flat, O.x - O.w / 2 - 1.2, O.z + O.d / 2 + 1.05, 0.15);
  colliders.push({ type: 'circle', x: O.x - O.w / 2 - 1.2, z: O.z + O.d / 2 + 1.05, r: 0.6 });
  // flag pole on the lawn east of the office
  const fx = -23.4, fz = 29.2;
  flat.cyl(0.32, 0.25, fx, 0, fz, 0xd8d0c0, 8);
  metal.cyl(0.05, 6.5, fx, 0.25, fz, 0xdfe3e6, 8, { top: 0.6 });
  metal.add(new THREE.SphereGeometry(0.08, 8, 6), 0xd8b040, { x: fx, y: 6.8, z: fz });
  colliders.push({ type: 'circle', x: fx, z: fz, r: 0.35 });
  const flag = flagMesh(fx + 0.04, fz);
  group.add(flag.mesh);
  group.add(flat.mesh(mats.flatFade, { name: 'props' }));
  group.add(metal.mesh(mats.metalFade, { name: 'props-metal' }));
  return { update(t) { flag.uniforms.uTime.value = t; } };
}
