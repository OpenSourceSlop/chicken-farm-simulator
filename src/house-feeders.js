// Pan feeder lines: auger tube with orange-red pans (dish, feed, spreader cone, grill) every
// FEEDER_PAN_SPACING, a hopper at the west end of each line, a drive unit at the east end, hung on
// cables from the trusses and raised with flock age. A cross auger brings feed from the two silos
// outside the north wall to the hoppers. Owner: house agent.
import * as THREE from 'three';
import { COLORS, FEEDER_LINES_Z, LINE_X, FEEDER_PAN_SPACING, FARM, HOUSE_BOUNDS } from './config.js';
import { Batch, mat, lathe, cone, disc, table } from './house-kit.js';
import { FRAME_X, TRUSS_Y, T } from './house-shell.js';

const { zMin } = HOUSE_BOUNDS;
const PAN_RIM = 0.057;                 // rim height above the pan bottom
const AUG_Y = 0.46;                    // auger tube centre above the pan bottom
const HOP_X = LINE_X.start - 0.25;     // hopper / cross auger x
const HOP_TOP = AUG_Y + 0.64;
export const CROSS_Y = 2.42;
const GALV = 0xb4bcc2, MOTOR = 0x4e6a80, FEED = 0xb8945a;

// Pan rim height above the litter by flock age: on the floor on day 1, at the birds' back later.
const RIM = [[1, 0.05], [7, 0.09], [14, 0.15], [21, 0.22], [28, 0.28], [35, 0.33], [42, 0.35]];
export const feederRim = (day) => table(RIM, day);

export const PAN_X = [];
for (let x = LINE_X.start + 0.6; x <= LINE_X.end - 0.45; x += FEEDER_PAN_SPACING) PAN_X.push(+x.toFixed(3));

function addPan(b, x, z, ctrl = false) {
  const pan = COLORS.feederPan, grill = 0xc84a24;
  const dish = lathe('pan', [[0, 0], [0.15, 0.01], [0.174, PAN_RIM], [0.156, 0.046], [0.06, 0.014], [0, 0.016]], 9);
  b.add(dish, pan, mat(x, 0, z));
  b.add(disc(0.148, 9), FEED, mat(x, 0.04, z));
  b.add(cone(0.035, 0.075, 0.1, 6, true), pan, mat(x, 0.08, z));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.2;
    const c = Math.cos(a), s = Math.sin(a);
    b.rod([x + c * 0.045, 0.235, z + s * 0.045], [x + c * 0.165, PAN_RIM + 0.004, z + s * 0.165], 0.008, grill, 3, true);
  }
  b.add(cone(0.052, 0.052, 0.05, 6, true), pan, mat(x, 0.245, z));
  b.rod([x, 0.25, z], [x, AUG_Y, z], 0.03, 0xd2683f, 5, true);
  b.box(0.09, 0.07, 0.09, x, AUG_Y, z, 0xc0c6ca);
  if (ctrl) b.box(0.12, 0.14, 0.1, x, AUG_Y + 0.12, z, 0x3d4a55);   // feed level sensor
}

function addHopper(b, z) {
  const x = HOP_X;
  const frustum = new THREE.CylinderGeometry(0.37, 0.12, 0.42, 4, 1);
  b.add(frustum, GALV, mat(x, AUG_Y + 0.17, z, 0, Math.PI / 4, 0));
  b.box(0.54, 0.22, 0.54, x, AUG_Y + 0.49, z, 0xbfc6cb);
  b.box(0.58, 0.04, 0.58, x, HOP_TOP - 0.03, z, 0x99a2a8);
  b.box(0.06, 0.1, 0.08, x - 0.3, AUG_Y + 0.48, z, 0x3d4a55);        // level switch
  b.rod([x, AUG_Y, z], [LINE_X.start + 0.1, AUG_Y, z], 0.04, GALV, 8);
}

function addDrive(b, z) {
  const x = LINE_X.end;
  b.box(0.2, 0.22, 0.2, x + 0.05, AUG_Y, z, 0x9aa3a9);
  b.add(new THREE.CylinderGeometry(0.095, 0.095, 0.3, 10), MOTOR, mat(x + 0.3, AUG_Y + 0.02, z, 0, 0, Math.PI / 2));
  b.box(0.08, 0.12, 0.12, x + 0.3, AUG_Y + 0.14, z, 0x3d4a55);
}

export function buildFeeders(kit) {
  const { stat, group, mats } = kit;

  // moving assembly: all lines share one height
  const lines = new Batch();
  for (const z of FEEDER_LINES_Z) {
    lines.rod([LINE_X.start + 0.05, AUG_Y, z], [LINE_X.end, AUG_Y, z], 0.032, GALV, 8);
    PAN_X.forEach((x, i) => addPan(lines, x, z, i === PAN_X.length - 1));
    addHopper(lines, z);
    addDrive(lines, z);
  }
  const lineMesh = lines.mesh(mats.vc);
  const lineGroup = new THREE.Group();
  lineGroup.add(lineMesh);
  group.add(lineGroup);

  // downspouts from the cross auger into each hopper (stretched as the lines rise)
  const spouts = new Batch();
  for (const z of FEEDER_LINES_Z) spouts.cyl(0.05, 1, HOP_X, -0.5, z, 0xc9d3d8, 8);
  const spoutGroup = new THREE.Group();
  spoutGroup.add(spouts.mesh(mats.vc, { cast: false }));
  spoutGroup.position.y = CROSS_Y;
  group.add(spoutGroup);

  // cables from the trusses (one line segment each)
  const hang = [];
  for (const z of FEEDER_LINES_Z) {
    for (const x of FRAME_X) if (x > LINE_X.start && x < LINE_X.end) hang.push(x, z);
    hang.push(HOP_X + 0.2, z, LINE_X.end - 0.1, z);
  }
  const n = hang.length / 2;
  const cablePos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    cablePos.set([hang[i * 2], TRUSS_Y - 0.03, hang[i * 2 + 1], hang[i * 2], 1, hang[i * 2 + 1]], i * 6);
  }
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePos, 3));
  const cables = new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0x5b6268 }));
  cables.frustumCulled = false;
  group.add(cables);

  // cross auger: silo boots outside, collector along the north wall, through the wall, over the hoppers
  const zLast = Math.max(...FEEDER_LINES_Z);
  const zOut = zMin - T - 1.45;
  stat.bar([HOP_X, TRUSS_Y, zMin], [HOP_X, TRUSS_Y, -zMin], 0.06, 0x8f989f);          // support beam
  stat.rod([HOP_X, CROSS_Y, zOut], [HOP_X, CROSS_Y, zLast + 0.35], 0.045, GALV, 10);
  for (let z = zMin + 1.2; z < zLast; z += 2.6) stat.rod([HOP_X, CROSS_Y, z], [HOP_X, TRUSS_Y, z], 0.008, 0x6d757c, 4);
  stat.add(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 10), MOTOR, mat(HOP_X, CROSS_Y, zLast + 0.55, Math.PI / 2, 0, 0));
  stat.box(0.2, 0.2, 0.14, HOP_X, CROSS_Y, zLast + 0.36, 0x9aa3a9);
  for (const z of FEEDER_LINES_Z) stat.cyl(0.07, 0.08, HOP_X, CROSS_Y - 0.08, z, 0x9aa3a9, 8);
  stat.add(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), 0x8f989f, mat(HOP_X, CROSS_Y, zMin - T - 0.05, Math.PI / 2, 0, 0)); // pipe collar
  const silos = FARM.silos;
  const xs = silos.map((s) => s.x);
  const xFar = Math.max(...xs) + 0.25;
  stat.add(new THREE.SphereGeometry(0.06, 8, 6), GALV, mat(HOP_X, CROSS_Y, zOut));
  stat.rod([HOP_X, CROSS_Y, zOut], [xFar, CROSS_Y, zOut], 0.045, GALV, 10);
  stat.add(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 10), MOTOR, mat(xFar + 0.2, CROSS_Y, zOut, 0, 0, Math.PI / 2));
  for (const px of [HOP_X + 0.6, (HOP_X + xFar) / 2]) {
    stat.bar([px, 0, zOut], [px, CROSS_Y - 0.05, zOut], 0.07, 0x8f989f);
    stat.box(0.22, 0.03, 0.22, px, 0.03, zOut, 0x7c858c);
  }
  for (const s of silos) {
    stat.box(0.34, 0.3, 0.34, s.x, 0.62, s.z, GALV);                                   // boot
    stat.box(0.3, 0.06, 0.3, s.x, 0.8, s.z, 0x99a2a8);
    stat.add(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), MOTOR, mat(s.x - 0.25, 0.6, s.z, 0, 0, Math.PI / 2));
    stat.rod([s.x, 0.62, s.z + 0.12], [s.x, CROSS_Y, zOut - 0.02], 0.045, GALV, 10);   // flex auger up
    stat.add(new THREE.SphereGeometry(0.065, 8, 6), GALV, mat(s.x, CROSS_Y, zOut));
  }

  let lastY = NaN;
  return {
    rimHeight: feederRim,
    update(dt, env) {
      const y = feederRim(env.day) - PAN_RIM;
      if (Math.abs(y - lastY) < 1e-4) return;
      lastY = y;
      lineGroup.position.y = y;
      spoutGroup.scale.y = Math.max(0.05, CROSS_Y - (y + HOP_TOP));
      const bot = y + AUG_Y + 0.035;
      for (let i = 0; i < n; i++) cablePos[i * 6 + 4] = bot;
      cableGeo.attributes.position.needsUpdate = true;
    },
  };
}
