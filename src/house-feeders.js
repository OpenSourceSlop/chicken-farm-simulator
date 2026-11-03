// Pan feeder lines: auger tube with orange-red pans (dish, feed, spreader cone, grill) every
// FEEDER_PAN_SPACING, a hopper at the west end of each line, a drive unit at the east end, hung on
// cables from the trusses and raised with flock age. A cross auger runs from the north wall at
// FEED_INLET over the hoppers; outside the wall the world's silo auger (world-silos.js) feeds it.
// Owner: house agent.
import * as THREE from 'three';
import { COLORS, FEEDER_LINES_Z, LINE_X, FEEDER_PAN_X, FEED_INLET, HOUSE_BOUNDS } from './config.js';
import { Batch, mat, lathe, cone, disc, table } from './house-kit.js';
import { FRAME_X, TRUSS_Y, T } from './house-shell.js';
import { Tags, lineMaterial } from './house-level.js';

const { zMin } = HOUSE_BOUNDS;
const PAN_RIM = 0.057;                 // rim height above the pan bottom
const AUG_Y = 0.46;                    // auger tube centre above the pan bottom
const HOP_X = FEED_INLET.x;            // hopper / cross auger x (LINE_X.start - 0.25)
const HOP_TOP = AUG_Y + 0.64;
export const CROSS_Y = FEED_INLET.y;
const GALV = 0xb4bcc2, MOTOR = 0x4e6a80, FEED = 0xb8945a;

// Pan rim height above the litter by flock age: on the floor on day 1, at the birds' back later.
const RIM = [[1, 0.05], [7, 0.09], [14, 0.15], [21, 0.22], [28, 0.28], [35, 0.33], [42, 0.35]];
export const feederRim = (day) => table(RIM, day);

export const PAN_X = FEEDER_PAN_X;      // shared with the flock (config.js)

function addPan(b, x, z, ctrl = false, feed = null) {
  const pan = COLORS.feederPan, grill = 0xc84a24;
  const dish = lathe('pan', [[0, 0], [0.15, 0.01], [0.174, PAN_RIM], [0.156, 0.046], [0.06, 0.014], [0, 0.016]], 9);
  b.add(dish, pan, mat(x, 0, z));
  if (feed) feed.fill([0, 0, 0, 0]);
  b.add(disc(0.148, 9), FEED, mat(x, 0.04, z));
  if (feed) {
    feed.fill([x, 0.04, z, 1]);
    // Level 1: flooded pans heap up to the grill (collapsed to a point unless flooded)
    b.add(cone(0.0, 0.142, 0.07, 9), 0xc39d62, mat(x, 0.075, z));
    feed.fill([x, 0.04, z, 2]);
  }
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
  const { stat, group } = kit;

  // moving assembly: one mesh; each line's own height and pan feed are vertex offsets (house-level.js)
  const lines = new Batch();
  const tags = new Tags(lines), feed = new Tags(lines, 4);
  for (const [li, z] of FEEDER_LINES_Z.entries()) {
    feed.fill([0, 0, 0, 0]);
    lines.rod([LINE_X.start + 0.05, AUG_Y, z], [LINE_X.end, AUG_Y, z], 0.032, GALV, 8);
    feed.fill([0, 0, 0, 0]);
    PAN_X.forEach((x, i) => addPan(lines, x, z, i === PAN_X.length - 1, feed));
    addHopper(lines, z);
    addDrive(lines, z);
    feed.fill([0, 0, 0, 0]);
    tags.fill(li);
  }
  const lineMat = lineMaterial('house-feeder-lines', { feed: true });
  const lineGeo = lines.geometry();
  lineGeo.setAttribute('aLine', tags.attribute());
  lineGeo.setAttribute('aFeed', feed.attribute());
  const lineMesh = new THREE.Mesh(lineGeo, lineMat.material);
  lineMesh.castShadow = true;
  lineMesh.receiveShadow = true;
  const lineGroup = new THREE.Group();
  lineGroup.add(lineMesh);
  group.add(lineGroup);

  // downspouts from the cross auger into each hopper (stretched as the lines rise)
  const spouts = new Batch();
  const spoutTags = new Tags(spouts);
  for (const [li, z] of FEEDER_LINES_Z.entries()) { spouts.cyl(0.05, 1, HOP_X, -0.5, z, 0xc9d3d8, 8); spoutTags.fill(li); }
  const spoutMat = lineMaterial('house-feeder-spouts', { hose: true });
  const spoutGeo = spouts.geometry();
  spoutGeo.setAttribute('aLine', spoutTags.attribute());
  const spoutMesh = new THREE.Mesh(spoutGeo, spoutMat.material);
  spoutMesh.receiveShadow = true;
  const spoutGroup = new THREE.Group();
  spoutGroup.add(spoutMesh);
  spoutGroup.position.y = CROSS_Y;
  group.add(spoutGroup);

  // cables from the trusses (one line segment each)
  const hang = [], hangLine = [];
  for (const [li, z] of FEEDER_LINES_Z.entries()) {
    for (const x of FRAME_X) if (x > LINE_X.start && x < LINE_X.end) { hang.push(x, z); hangLine.push(li); }
    hang.push(HOP_X + 0.2, z, LINE_X.end - 0.1, z);
    hangLine.push(li, li);
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

  // cross auger: in through the north wall at FEED_INLET (the world's silo auger ends at the
  // outside face of the wall), then over the hoppers
  const zLast = Math.max(...FEEDER_LINES_Z);
  stat.bar([HOP_X, TRUSS_Y, zMin], [HOP_X, TRUSS_Y, -zMin], 0.06, 0x8f989f);          // support beam
  stat.rod([HOP_X, CROSS_Y, zMin - T], [HOP_X, CROSS_Y, zLast + 0.35], 0.045, GALV, 10);
  for (let z = zMin + 1.2; z < zLast; z += 2.6) stat.rod([HOP_X, CROSS_Y, z], [HOP_X, TRUSS_Y, z], 0.008, 0x6d757c, 4);
  stat.add(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 10), MOTOR, mat(HOP_X, CROSS_Y, zLast + 0.55, Math.PI / 2, 0, 0));
  stat.box(0.2, 0.2, 0.14, HOP_X, CROSS_Y, zLast + 0.36, 0x9aa3a9);
  for (const z of FEEDER_LINES_Z) stat.cyl(0.07, 0.08, HOP_X, CROSS_Y - 0.08, z, 0x9aa3a9, 8);
  stat.add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), 0x8f989f, mat(HOP_X, CROSS_Y, zMin + 0.03, Math.PI / 2, 0, 0)); // wall collar

  // Level 1: each line's pan rim at the farm's height, feed by panFill, heaped while flooded;
  // sandbox: Phase 1's table, pans full.
  const ys = [0, 0, 0];
  let key = '';
  return {
    rimHeight: feederRim,
    update(dt, env) {
      const farm = kit.farm, fl = farm && farm.mode === 'level' && farm.feed && farm.feed.lines;
      const y0 = feederRim(env.day) - PAN_RIM;
      const u = lineMat.u;
      for (let i = 0; i < 3; i++) {
        const L = fl && fl[i];
        ys[i] = L ? (L.heightCm ?? 5) / 100 - PAN_RIM : y0;
        u.uFill.value[i] = L ? Math.max(0, Math.min(1, L.panFill ?? 1)) : 1;
        u.uHeap.value[i] = L && L.flood ? Math.max(0, Math.min(1, L.panFill ?? 1)) : 0;
      }
      const k = `${ys.map((y) => y.toFixed(4)).join()}|${u.uFill.value.slice(0, 3).map((v) => v.toFixed(3)).join()}|${u.uHeap.value.slice(0, 3).map((v) => v.toFixed(3)).join()}`;
      if (k === key) return;
      key = k;
      // the group carries the mean height (shadows follow it); the uniforms the differences
      const base = fl ? (ys[0] + ys[1] + ys[2]) / 3 : y0;
      lineGroup.position.y = base;
      for (let i = 0; i < 3; i++) {
        u.uLineDY.value[i] = ys[i] - base;
        spoutMat.u.uLen.value[i] = Math.max(0.05, CROSS_Y - (ys[i] + HOP_TOP));
      }
      for (let i = 0; i < n; i++) cablePos[i * 6 + 4] = ys[hangLine[i]] + AUG_Y + 0.035;
      cableGeo.attributes.position.needsUpdate = true;
    },
  };
}
