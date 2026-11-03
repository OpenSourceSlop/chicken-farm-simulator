// Level 1 props around the house: rice husk heap (shrinks as the floor is covered) with the parked
// wheelbarrow and husk sacks, chick sample table (open box of ten chicks, box scale, grading
// sheet, cull bucket), dead bird bin with its bucket, office desk (record book, phone, radio), and
// inside the house the bird scale corner (hand scale, folded catching frame, automatic bird scale
// platform). Owner: package "props".
import * as THREE from 'three';
import { SPOTS2 } from './config.js';
import { Batch, mat, placer } from './props-kit.js';
import { C, wheelbarrow, sack, bucket, chick, catchingFrame, handScale, chickBoxGeometry, BOX } from './props-models.js';

const TABLE = 0xd9d6cf, LEG = 0x6d757c;

function foldingTable(b, x, z, w, d, top = 0.74, face = 0, color = TABLE) {
  const P = placer(b, x, z, face);
  P.box(w, 0.035, d, 0, top, 0, color);
  P.box(w - 0.04, 0.05, 0.03, 0, top - 0.04, d / 2 - 0.03, LEG);
  for (const su of [-1, 1]) for (const sv of [-1, 1]) P.box(0.035, top, 0.035, su * (w / 2 - 0.06), top / 2, sv * (d / 2 - 0.06), LEG);
  return P;
}

// Rice husk heap as a lumpy mound (unit size; scaled by props as the husk is used).
function heapGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.08 * Math.sin(x * 5.1 + z * 3.3) + 0.06 * Math.sin(z * 7.7 - x * 2.1);
    y = y < 0 ? 0 : y;
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g;
}

export function buildYard(stat, mats, group) {
  const tabSpots = new Map();
  const colliders = [];

  // ---------------- husk heap, barrow, sacks ----------------
  const H = SPOTS2.litterHeap;
  stat.box(3.0, 0.012, 2.4, H.x, 0.05, H.z + 0.1, 0x2f5f8a);                    // blue tarp under the heap
  const hb = new Batch();
  hb.add(heapGeometry(), C.husk, mat(0, 0, 0, 0, 0, 0, 1.25, 0.95, 1.0));
  hb.add(new THREE.IcosahedronGeometry(0.35, 0), C.huskDark, mat(0.5, 0.35, 0.45, 0.2, 0.5, 0, 1, 0.5, 1));
  hb.add(new THREE.IcosahedronGeometry(0.3, 0), C.huskDark, mat(-0.6, 0.25, -0.3, 0.6, 0.2, 0, 1, 0.45, 1));
  // a shovel stuck in the heap
  hb.rod([0.55, 0.3, -0.2], [0.95, 1.3, -0.35], 0.018, C.wood, 5);
  hb.box(0.2, 0.26, 0.02, 0.5, 0.2, -0.18, C.steelDark, -0.35, 0, -0.38);
  const heap = hb.mesh(mats.vc, { cast: true, receive: true });
  heap.position.set(H.x, 0.04, H.z);
  heap.name = 'props-heap';
  group.add(heap);
  colliders.push({ type: 'circle', x: H.x, z: H.z, r: 1.15 });

  const barrowB = new Batch();
  wheelbarrow(barrowB, { full: false });
  const barrow = barrowB.mesh(mats.vc, { cast: true });
  barrow.position.set(H.x - 1.1, 0.04, H.z + 1.55);
  barrow.rotation.y = 2.3;
  barrow.name = 'props-barrow';
  group.add(barrow);

  const sackB = new Batch();
  for (const [x, y, z, ry] of [[0, 0.17, 0, 0.1], [0.05, 0.17, 0.5, -0.15], [0.02, 0.45, 0.25, 0.05]]) {
    const s = new Batch(); sack(s);
    sackB.add(s.geometry(), null, mat(x, y, z, 0, ry, 0));
  }
  const sacks = sackB.mesh(mats.vc, { cast: true });
  sacks.position.set(H.x - 1.95, 0.04, H.z - 0.3);
  sacks.name = 'props-sacks';
  group.add(sacks);
  colliders.push({ type: 'box', minX: H.x - 2.4, maxX: H.x - 1.5, minZ: H.z - 0.6, maxZ: H.z + 0.6 });

  // ---------------- chick sample table ----------------
  const T = SPOTS2.chickTable;
  const tp = foldingTable(stat, T.x, T.z, 1.3, 0.65, 0.74, 0);
  // box scale (platform with a display), grading sheet with a pen, cull bucket under the table
  tp.box(0.42, 0.04, 0.34, 0.38, 0.78, 0, 0x9aa3a8);
  tp.box(0.4, 0.012, 0.32, 0.38, 0.806, 0, 0xc9d0d4);
  tp.box(0.14, 0.07, 0.06, 0.38, 0.79, 0.2, 0x2b3236);
  tp.box(0.09, 0.03, 0.008, 0.38, 0.8, 0.234, 0x7fd18a);
  tp.box(0.24, 0.004, 0.32, -0.12, 0.761, 0.05, 0xf8f6ef, 0.12);
  for (let i = 0; i < 6; i++) tp.box(0.18, 0.002, 0.006, -0.12, 0.764, -0.06 + i * 0.04, 0x9aa7b5, 0.12);
  tp.box(0.012, 0.012, 0.15, -0.02, 0.768, 0.08, 0x2d5f9a, 0.12 + 0.6);
  {
    const cb = new Batch(); bucket(cb);
    stat.add(cb.geometry(), null, mat(T.x + 0.45, 0, T.z + 0.05, 0, 0.3, 0, 0.9));
  }
  colliders.push({ type: 'box', minX: T.x - 0.7, maxX: T.x + 0.7, minZ: T.z - 0.36, maxZ: T.z + 0.36 });
  // the open sample box with ten chicks (shown once the chicks came)
  const sb = new Batch();
  const boxGeo = chickBoxGeometry();
  sb.add(boxGeo, null, mat(-0.32, 0.755, -0.08, 0, 0.05, 0, 1, 0.9, 1));
  sb.box(0.56, 0.005, 0.41, -0.32, 0.755 + BOX.h * 0.9 - 0.004, -0.08, 0x8a6a40, 0.05);   // dark inside under the lid
  sb.box(0.6, 0.008, 0.45, -0.32, 0.92, -0.33, C.kraft, 0.05, -1.1);                      // lid propped open
  for (let i = 0; i < 10; i++) chick(sb, -0.52 + (i % 5) * 0.1, 0.755 + BOX.h * 0.9 - 0.01, -0.16 + Math.floor(i / 5) * 0.15, i * 1.3, 1.05);
  const sampleBox = sb.mesh(mats.vc);
  sampleBox.position.set(T.x, 0, T.z);
  sampleBox.name = 'props-sample-box';
  group.add(sampleBox);

  // ---------------- dead bird bin ----------------
  const D = SPOTS2.deadBin;
  const DB = placer(stat, D.x, D.z, 0);
  DB.box(0.62, 0.95, 0.66, 0, 0.5, 0, 0x2f6b4f);
  DB.box(0.66, 0.06, 0.7, 0, 1.0, 0, 0x285a43);
  DB.box(0.62, 0.04, 0.08, 0, 1.03, -0.31, 0x24503c);
  DB.box(0.5, 0.18, 0.012, 0, 0.72, 0.335, 0xe9e3d2);                     // label plate
  DB.box(0.36, 0.035, 0.014, 0, 0.75, 0.342, 0xc4471d);
  for (const su of [-1, 1]) DB.add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), C.rubber, su * 0.26, 0.08, -0.3, 0, 0, Math.PI / 2);
  colliders.push({ type: 'box', minX: D.x - 0.36, maxX: D.x + 0.36, minZ: D.z - 0.38, maxZ: D.z + 0.38 });
  const bkB = new Batch(); bucket(bkB);
  const spareBucket = bkB.mesh(mats.vc, { cast: true });
  spareBucket.position.set(D.x + 0.55, 0.02, D.z + 0.25);
  spareBucket.name = 'props-bucket';
  group.add(spareBucket);
  tabSpots.set('dead-bin', { x: D.x + 0.2, y: 1.25, z: D.z + 0.3, ry: 0, rx: 0 });

  // ---------------- office desk on the office porch ----------------
  const O = SPOTS2.officeDesk;
  const ox = O.x + 0.2, oz = O.z + 0.95;
  const op = foldingTable(stat, ox, oz, 1.2, 0.62, 0.74, 0, 0x9a7246);
  op.box(0.36, 0.03, 0.26, -0.2, 0.77, 0.02, 0x2f5d3a);                     // record book: green cover
  op.box(0.34, 0.012, 0.24, -0.2, 0.79, 0.02, 0xf4f1e6);                    // open pages
  op.box(0.004, 0.014, 0.24, -0.2, 0.795, 0.02, 0x9a8c70);
  op.box(0.16, 0.06, 0.2, 0.3, 0.775, -0.08, 0x2b2f33);                    // desk phone
  op.box(0.15, 0.03, 0.05, 0.3, 0.82, -0.14, 0x1b1e21);
  op.box(0.22, 0.12, 0.08, 0.36, 0.8, 0.16, 0x7a2a22);                     // radio
  op.add(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), 0xd8d0bb, 0.31, 0.8, 0.205, Math.PI / 2, 0, 0);
  op.rod([0.44, 0.86, 0.14], [0.52, 1.12, 0.1], 0.004, 0xb4bcc2, 3);       // aerial
  // plastic chair behind the desk
  op.box(0.44, 0.04, 0.42, 0, 0.45, -0.62, 0x2f6fb5);
  op.box(0.44, 0.42, 0.04, 0, 0.68, -0.84, 0x2f6fb5);
  for (const su of [-1, 1]) for (const sv of [-0.8, -0.44]) op.box(0.035, 0.45, 0.035, su * 0.19, 0.225, sv, 0x2a5f93);
  colliders.push({ type: 'box', minX: ox - 0.62, maxX: ox + 0.62, minZ: oz - 0.95, maxZ: oz + 0.33 });
  tabSpots.set('office-desk', { x: ox + 0.4, y: 1.15, z: oz + 0.2, ry: 0, rx: 0 });

  // ---------------- bird scale corner (inside, brooding area) ----------------
  const S = SPOTS2.birdScale;
  const SP = placer(stat, S.x, S.z, 0);
  SP.box(0.05, 1.5, 0.05, -0.3, 0.75, -0.25, 0x8f989f);                   // stand
  SP.box(0.4, 0.04, 0.4, -0.3, 0.02, -0.25, 0x6d757c);
  SP.rod([-0.3, 1.45, -0.25], [-0.05, 1.45, -0.25], 0.012, 0x8f989f, 4);
  const kit = new Batch();
  {
    const hs = new Batch(); handScale(hs);
    kit.add(hs.geometry(), null, mat(S.x - 0.07, 1.42, S.z - 0.25));
    const cf = new Batch(); catchingFrame(cf, { folded: true });
    kit.add(cf.geometry(), null, mat(S.x - 0.3, 0.02, S.z - 0.08, -0.25, 0, 0, 0.9));
  }
  const scaleKit = kit.mesh(mats.vc, { cast: false });
  scaleKit.name = 'props-scale-kit';
  group.add(scaleKit);
  // automatic bird scale: platform on a cable from the truss, display box on the stand
  SP.box(0.42, 0.03, 0.42, 0.45, 0.06, 0.1, 0x9aa3a8);
  SP.box(0.44, 0.012, 0.44, 0.45, 0.08, 0.1, 0xb8c0c5);
  for (const [du, dv] of [[-0.2, -0.1], [0.2, -0.1], [-0.2, 0.3], [0.2, 0.3]]) SP.rod([0.45 + du, 0.08, dv], [0.45, 0.5, 0.1], 0.004, 0x6d757c, 3);
  SP.rod([0.45, 0.5, 0.1], [0.45, 2.66, 0.1], 0.005, 0x5b6268, 3);
  SP.box(0.08, 0.1, 0.06, 0.45, 0.55, 0.1, 0x3d4a55);                     // load cell
  SP.box(0.24, 0.18, 0.08, -0.3, 1.15, -0.2, 0xe9edf0);                    // display box
  SP.box(0.18, 0.07, 0.01, -0.3, 1.18, -0.159, 0x1e3a2a);
  colliders.push({ type: 'circle', x: S.x - 0.3, z: S.z - 0.25, r: 0.25 });
  tabSpots.set('bird-scale', { x: S.x - 0.1, y: 1.75, z: S.z - 0.2, ry: 0, rx: 0 });

  // the frame set down on the litter (weighing) and the parked frame + scale when carried away
  const fsB = new Batch(); catchingFrame(fsB);
  const frameSet = fsB.mesh(mats.vc);
  frameSet.name = 'props-frame-set';
  frameSet.visible = false;
  group.add(frameSet);

  return { tabSpots, colliders, heap, barrow, sacks, sampleBox, spareBucket, frameSet, scaleKit };
}
