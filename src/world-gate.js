// Perimeter fence, sliding gate, guard hut, vehicle spray arch, foot dip and the gate sign.
// Owner: world agent.
import * as THREE from 'three';
import { COLORS, FARM, SPOTS } from './config.js';
import { GeoBuilder, unitCone, unitCyl, rng } from './world-util.js';
import { F, GATE, CORRIDOR, PUBLIC_ROAD_Z, SPRAY_Z } from './world-layout.js';

const CONCRETE = 0xbdb7aa, POST = 0xc9c3b6, STEEL = COLORS.steel, STEEL_DK = COLORS.steelDark;
const DISINFECT = 0x3fae9f;

function meshTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(214,220,224,1)';
  g.lineWidth = 3;
  // diamond chain-link: two diagonals per tile
  g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(-32, 32); g.lineTo(0, 0); g.moveTo(64, 0); g.lineTo(96, 32); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Fence runs: [x0, z0, x1, z1]; the south side leaves the gate open.
function fenceRuns() {
  return [
    [F.xMin, F.zMin, F.xMax, F.zMin],
    [F.xMin, F.zMin, F.xMin, F.zMax],
    [F.xMax, F.zMin, F.xMax, F.zMax],
    [F.xMin, F.zMax, GATE.x0, F.zMax],
    [GATE.x1, F.zMax, F.xMax, F.zMax],
  ];
}

export function buildFence(group, mats, colliders) {
  const flat = new GeoBuilder(), metal = new GeoBuilder(), mesh = new GeoBuilder({ uv: true });
  const wires = [];
  const cx = (F.xMin + F.xMax) / 2, cz = (F.zMin + F.zMax) / 2;
  for (const [x0, z0, x1, z1] of fenceRuns()) {
    const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    // outward normal (away from the farm centre)
    let nx = -dz, nz = dx;
    if ((x0 - cx) * nx + (z0 - cz) * nz < 0) { nx = -nx; nz = -nz; }
    const n = Math.max(1, Math.round(L / 3));
    for (let i = 0; i <= n; i++) {
      const x = x0 + dx * L * (i / n), z = z0 + dz * L * (i / n);
      flat.box(0.15, 2.0, 0.15, x, 0, z, POST, { jitter: 0.06 });
      // angled barbed-wire arm leaning outward
      flat.pipe(x, 1.95, z, x + nx * 0.42, 2.38, z + nz * 0.42, 0.045, POST, 4);
    }
    // concrete kick strip and galvanised top rail
    flat.add(new THREE.BoxGeometry(1, 1, 1), CONCRETE, { x: (x0 + x1) / 2, y: 0.1, z: (z0 + z1) / 2, sx: Math.abs(dx) * L + 0.12, sy: 0.22, sz: Math.abs(dz) * L + 0.12 });
    metal.pipe(x0, 1.86, z0, x1, 1.86, z1, 0.03, STEEL, 5);
    // chain-link panel
    const v0 = 0.2, v1 = 1.84, u = L / 0.55, v = (v1 - v0) / 0.55;
    mesh.quad([x0, v0, z0], [x1, v0, z1], [x1, v1, z1], [x0, v1, z0], 0xffffff, [0, 0, u, 0, u, v, 0, v]);
    for (const k of [0.33, 0.66, 1]) {
      const ox = nx * 0.42 * k, oy = 1.95 + 0.43 * k;
      wires.push(x0 + ox, oy, z0 + nz * 0.42 * k, x1 + ox, oy, z1 + nz * 0.42 * k);
    }
    const t = 0.15;
    colliders.push({ type: 'box', minX: Math.min(x0, x1) - t, maxX: Math.max(x0, x1) + t, minZ: Math.min(z0, z1) - t, maxZ: Math.max(z0, z1) + t });
  }
  // Gate pillars
  for (const x of [GATE.x0 - 0.25, GATE.x1 + 0.25]) {
    flat.box(0.55, 2.5, 0.55, x, 0, F.zMax, 0xece6d8, { jitter: 0.04 });
    flat.box(0.7, 0.14, 0.7, x, 2.5, F.zMax, 0xb8b2a4);
    flat.add(unitCone(4), 0xb8b2a4, { x, y: 2.84, z: F.zMax, sx: 0.48, sy: 0.4, sz: 0.48, ry: Math.PI / 4 });
    colliders.push({ type: 'box', minX: x - 0.3, maxX: x + 0.3, minZ: F.zMax - 0.3, maxZ: F.zMax + 0.3 });
  }
  // Sliding gate, pushed open to the west along the inside of the fence
  const gz = F.zMax - 0.42, gx0 = GATE.x0 - FARM.gate.width - 0.3, gx1 = GATE.x0 - 0.15;
  metal.boxMM(gx0 - 0.2, GATE.x1 + 0.2, 0, 0.04, gz - 0.05, gz + 0.05, STEEL_DK); // ground rail
  for (const y of [0.18, 1.0, 1.82]) metal.pipe(gx0, y, gz, gx1, y, gz, 0.045, 0x3d6f8f, 6);
  metal.pipe(gx0, 0.18, gz, gx0, 1.82, gz, 0.05, 0x3d6f8f, 6);
  metal.pipe(gx1, 0.18, gz, gx1, 1.82, gz, 0.05, 0x3d6f8f, 6);
  for (let x = gx0 + 0.15; x < gx1; x += 0.15) metal.boxMM(x - 0.012, x + 0.012, 0.18, 1.82, gz - 0.012, gz + 0.012, 0x3d6f8f);
  for (const x of [gx0 + 0.4, gx1 - 0.4]) metal.add(unitCyl(8), STEEL_DK, { x, y: 0.1, z: gz, sx: 0.09, sy: 0.05, sz: 0.09, rx: Math.PI / 2 });
  colliders.push({ type: 'box', minX: gx0, maxX: gx1, minZ: gz - 0.12, maxZ: gz + 0.12 });

  // Raised road out to the public road: white guard posts, kept walkable by colliders
  for (let z = F.zMax + 3; z < PUBLIC_ROAD_Z - 4; z += 3) {
    for (const x of [CORRIDOR.x0 + 0.35, CORRIDOR.x1 - 0.35]) {
      flat.box(0.16, 0.8, 0.16, x, -0.1, z, 0xf2efe6);
      flat.box(0.17, 0.12, 0.17, x, 0.5, z, 0x2a2a2a);
    }
  }
  colliders.push({ type: 'box', minX: CORRIDOR.x0, maxX: CORRIDOR.x0 + 0.5, minZ: F.zMax, maxZ: PUBLIC_ROAD_Z + 4 });
  colliders.push({ type: 'box', minX: CORRIDOR.x1 - 0.5, maxX: CORRIDOR.x1, minZ: F.zMax, maxZ: PUBLIC_ROAD_Z + 4 });
  colliders.push({ type: 'box', minX: CORRIDOR.x0, maxX: CORRIDOR.x1, minZ: PUBLIC_ROAD_Z - 3.5, maxZ: PUBLIC_ROAD_Z - 3 });

  group.add(flat.mesh(mats.flat, { name: 'fence-posts' }));
  group.add(metal.mesh(mats.metal, { name: 'fence-metal' }));
  const meshMat = new THREE.MeshLambertMaterial({ map: meshTexture(), color: 0xc4ccd2, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02 });
  const panel = mesh.mesh(meshMat, { cast: false, receive: false, name: 'fence-mesh' });
  panel.renderOrder = 2;
  group.add(panel);
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x55595c })));
}

// Guard hut, spray arch, foot dip and the gate sign
export function buildGateArea(group, mats, colliders, signTex) {
  const flat = new GeoBuilder(), metal = new GeoBuilder(), hut = new GeoBuilder(), hutM = new GeoBuilder();
  const r = rng(9);

  // Guard hut: low brick wall, window band facing the gate and road, red hip roof
  const H = FARM.guardHut, x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z - H.d / 2, z1 = H.z + H.d / 2;
  hut.boxMM(x0 - 0.15, x1 + 0.15, 0, 0.18, z0 - 0.15, z1 + 0.15, COLORS.concrete);
  hut.boxMM(x0, x1, 0.18, 1.0, z0, z1, 0xd8cbb0, { jitter: 0.03 });
  hut.boxMM(x0, x1, 2.15, 2.6, z0, z1, 0xeee6d2);
  hut.boxMM(x0, x0 + 0.2, 1.0, 2.15, z0, z1, 0xeee6d2);       // west wall full height
  hut.boxMM(x0, x1, 1.0, 2.15, z0, z0 + 0.2, 0xeee6d2);       // north wall (door)
  hut.boxMM(x0 + 1.0, x0 + 1.9, 0.18, 2.1, z0 - 0.03, z0 + 0.02, 0x7b5a3c); // door
  hutM.boxMM(x0 + 0.2, x1 - 0.05, 1.0, 2.15, z1 - 0.12, z1 - 0.06, 0x3e5a70); // south glass
  hutM.boxMM(x1 - 0.12, x1 - 0.06, 1.0, 2.15, z0 + 0.2, z1 - 0.05, 0x3e5a70); // east glass
  for (const t of [0, 0.5, 1]) {
    hut.boxMM(x0 + 0.2 + t * (H.w - 0.3) - 0.04, x0 + 0.2 + t * (H.w - 0.3) + 0.04, 1.0, 2.15, z1 - 0.15, z1, 0xf4f1ea);
    hut.boxMM(x1 - 0.15, x1, 1.0, 2.15, z0 + 0.2 + t * (H.d - 0.3) - 0.04, z0 + 0.2 + t * (H.d - 0.3) + 0.04, 0xf4f1ea);
  }
  hut.boxMM(x0 - 0.05, x1 + 0.05, 0.95, 1.05, z0 - 0.05, z1 + 0.05, 0xf4f1ea); // sill
  hut.add(unitCone(4), COLORS.roofRed, { x: H.x, y: 3.2, z: H.z, sx: (H.w / 2 + 0.75) * Math.SQRT2, sy: 1.2, sz: (H.d / 2 + 0.75) * Math.SQRT2, ry: Math.PI / 4 });
  hut.boxMM(x0 - 0.5, x1 + 0.5, 2.55, 2.62, z0 - 0.5, z1 + 0.5, 0xeee6d2); // eave soffit
  // boom barrier, raised, beside the hut
  hut.box(0.35, 1.0, 0.35, x1 + 0.6, 0, z1 - 0.3, 0xd8d2c4);
  for (let i = 0; i < 6; i++) hut.add(new THREE.BoxGeometry(1, 1, 1), i % 2 ? 0xd8322f : 0xf4f1ea, { x: x1 + 0.6, y: 1.25 + i * 0.6, z: z1 - 0.3, sx: 0.09, sy: 0.6, sz: 0.09 });
  colliders.push({ type: 'box', minX: x0 - 0.1, maxX: x1 + 0.95, minZ: z0 - 0.1, maxZ: z1 + 0.1 });

  // Vehicle spray arch: two pipe portals over the road, nozzle manifolds, pump and drum
  const ax0 = FARM.gate.x - 3.3, ax1 = FARM.gate.x + 3.3, h = 4.4;
  for (const z of [SPRAY_Z - 0.6, SPRAY_Z + 0.6]) {
    for (const x of [ax0, ax1]) {
      metal.pipe(x, 0, z, x, h, z, 0.08, STEEL, 8);
      metal.cyl(0.16, 0.06, x, 0, z, STEEL_DK, 8);
      colliders.push({ type: 'circle', x, z, r: 0.18 });
    }
    metal.pipe(ax0, h, z, ax1, h, z, 0.08, STEEL, 8);
  }
  for (const x of [ax0, ax1]) {
    metal.pipe(x, h, SPRAY_Z - 0.6, x, h, SPRAY_Z + 0.6, 0.06, STEEL, 6);
    metal.pipe(x, 1.4, SPRAY_Z - 0.6, x, 1.4, SPRAY_Z + 0.6, 0.05, STEEL, 6);
  }
  const pvc = 0xeeeeea, nozzle = 0x2b2f33;
  for (const side of [-1, 1]) {
    const x = side < 0 ? ax0 + 0.18 : ax1 - 0.18;
    metal.pipe(x, 0.25, SPRAY_Z, x, h - 0.2, SPRAY_Z, 0.035, pvc, 6);
    for (let y = 0.5; y < h - 0.3; y += 0.6) metal.pipe(x, y, SPRAY_Z, x - side * 0.14, y, SPRAY_Z, 0.025, nozzle, 5);
  }
  metal.pipe(ax0 + 0.18, h - 0.2, SPRAY_Z, ax1 - 0.18, h - 0.2, SPRAY_Z, 0.035, pvc, 6);
  for (let x = ax0 + 0.6; x < ax1 - 0.4; x += 0.55) metal.pipe(x, h - 0.2, SPRAY_Z, x, h - 0.36, SPRAY_Z, 0.025, nozzle, 5);
  // pump plinth with chemical drum and motor, east of the arch
  const px = ax1 + 1.25, pz = SPRAY_Z;
  flat.boxMM(px - 0.7, px + 0.8, 0, 0.15, pz - 0.75, pz + 0.75, COLORS.concrete);
  flat.cyl(0.3, 0.9, px - 0.25, 0.15, pz - 0.2, 0x2a64b8, 10);
  flat.cyl(0.31, 0.04, px - 0.25, 0.75, pz - 0.2, 0x2456a0, 10);
  flat.cyl(0.31, 0.04, px - 0.25, 0.45, pz - 0.2, 0x2456a0, 10);
  metal.box(0.45, 0.32, 0.32, px + 0.35, 0.15, pz + 0.25, 0x3d6f8f);
  metal.add(unitCyl(8), 0x6d757c, { x: px + 0.1, y: 0.31, z: pz + 0.25, sx: 0.14, sy: 0.3, sz: 0.14, rz: Math.PI / 2 });
  metal.pipe(px + 0.35, 0.47, pz + 0.25, ax1 - 0.18, 0.3, SPRAY_Z, 0.03, pvc, 5);
  colliders.push({ type: 'box', minX: px - 0.7, maxX: px + 0.8, minZ: pz - 0.75, maxZ: pz + 0.75 });
  // Foot dip tray at the pedestrian entry: rubber tray with blue-green disinfectant
  const D = FARM.footDipGate, tw = 0.72, td = 0.48;
  flat.boxMM(D.x - 1.05, D.x + 1.05, -0.02, 0.03, D.z - 0.75, D.z + 0.72, COLORS.concrete);
  flat.boxMM(D.x - tw, D.x + tw, 0.03, 0.05, D.z - td, D.z + td, 0x2f3a40);
  flat.boxMM(D.x - tw, D.x + tw, 0.03, 0.15, D.z - td, D.z - td + 0.07, 0x3b4a52);
  flat.boxMM(D.x - tw, D.x + tw, 0.03, 0.15, D.z + td - 0.07, D.z + td, 0x3b4a52);
  flat.boxMM(D.x - tw, D.x - tw + 0.07, 0.03, 0.15, D.z - td, D.z + td, 0x3b4a52);
  flat.boxMM(D.x + tw - 0.07, D.x + tw, 0.03, 0.15, D.z - td, D.z + td, 0x3b4a52);
  flat.boxMM(D.x - tw + 0.07, D.x + tw - 0.07, 0.05, 0.11, D.z - td + 0.07, D.z + td - 0.07, DISINFECT);

  // Gate sign on two steel posts, face to the south (toward people coming in), tilted back a
  // little so it reads well from the angled camera
  const S = SPOTS.signGate, bw = 2.6, bh = 1.45, by = 0.85, tilt = 0.33;
  const cy = by + bh / 2, back = (bh / 2) * Math.sin(tilt);
  const postZ = S.z - back - 0.06;
  for (const ox of [-bw / 2 + 0.22, bw / 2 - 0.22]) {
    metal.box(0.08, by + bh * Math.cos(tilt) + 0.05, 0.08, S.x + ox, 0, postZ, STEEL_DK);
    metal.boxMM(S.x + ox - 0.03, S.x + ox + 0.03, by + 0.12, by + 0.18, postZ, S.z + back - 0.05, STEEL_DK);
  }
  metal.add(new THREE.BoxGeometry(1, 1, 1), 0x2b3a33, { x: S.x, y: cy, z: S.z, sx: bw + 0.1, sy: bh + 0.1, sz: 0.06, rx: -tilt, order: 'XYZ' });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshLambertMaterial({ map: signTex.gate }));
  face.rotation.x = -tilt;
  face.position.set(S.x, cy + 0.035 * Math.sin(tilt), S.z + 0.035 * Math.cos(tilt));
  face.receiveShadow = true;
  face.name = 'gate-sign';
  group.add(face);
  colliders.push({ type: 'box', minX: S.x - bw / 2, maxX: S.x + bw / 2, minZ: postZ - 0.1, maxZ: S.z + back });

  group.add(flat.mesh(mats.flat, { name: 'gate-area' }));
  group.add(metal.mesh(mats.metal, { name: 'gate-metal' }));
  group.add(hut.mesh(mats.flatFade, { name: 'guard-hut' }));
  group.add(hutM.mesh(mats.glass, { cast: false, name: 'guard-hut-glass' }));
  return { r };
}
