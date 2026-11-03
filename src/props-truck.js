// Delivery trucks: the chick truck (6-wheeler with a white ventilated box body, hatchery stripe,
// rear doors that swing open, six stacks of ten chick boxes inside) and the bulk feed truck (same
// cab and chassis, a red tank body and a blower pipe that swings up to the silo tops). They drive
// in from the public road through the gate along FARM.road (rounded corners) in about 8 s,
// park, and leave by a loop over the east yard. Also the driver with his delivery note.
// Owner: package "props".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPOTS2, FARM } from './config.js';
import { Batch, mat } from './props-kit.js';
import { samplePath } from './world-layout.js';
import { buildFarmerModel } from './player-model.js';

const CAB = 0xf2f2ee, TRIM = 0x2b2f33, GLASS = 0x2c3e4e, TYRE = 0x26292c, HUB = 0xb8bec4, CHASSIS = 0x3a3e42;

// Cab and chassis, front toward +x, ground at y 0, rear of the chassis at x = -3.6.
function chassis(b) {
  const L0 = -3.6, L1 = 3.55;
  b.box(L1 - L0 - 0.4, 0.22, 0.9, (L0 + L1) / 2 - 0.2, 0.72, 0, CHASSIS);              // frame rails
  b.box(1.9, 1.25, 2.25, 2.55, 1.55, 0, CAB);                                          // cab box
  b.box(1.85, 0.42, 2.2, 2.6, 0.72, 0, CAB);                                           // lower cab
  b.box(0.06, 0.78, 2.0, 3.51, 1.72, 0, GLASS);                                        // windscreen
  b.box(1.0, 0.55, 2.27, 2.65, 1.85, 0, GLASS);                                        // side windows
  b.box(0.12, 0.3, 2.3, 3.58, 0.62, 0, TRIM);                                          // bumper
  b.box(0.05, 0.36, 1.2, 3.52, 0.98, 0, 0x9aa3a8);                                     // grille
  for (const s of [-1, 1]) {
    b.box(0.05, 0.12, 0.34, 3.53, 0.86, s * 0.86, 0xfff6d8);                           // headlights
    b.box(0.3, 0.2, 0.06, 3.0, 2.0, s * 1.2, TRIM);                                    // mirrors
    b.box(0.6, 0.06, 0.22, 2.1, 0.5, s * 1.08, 0x6d757c);                              // step
  }
  b.box(1.9, 0.12, 2.3, 2.55, 2.22, 0, 0x2f6fb5);                                      // roof visor
  // wheels: single front axle, dual rear axle
  for (const [x, dual] of [[2.55, false], [-1.85, true]]) {
    for (const s of [-1, 1]) {
      for (const k of dual ? [0, 1] : [0]) {
        const z = s * (0.93 - k * 0.3);
        b.add(new THREE.CylinderGeometry(0.47, 0.47, 0.26, 12), TYRE, mat(x, 0.47, z, Math.PI / 2, 0, 0));
        b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 8), HUB, mat(x, 0.47, z, Math.PI / 2, 0, 0));
      }
      b.box(0.9, 0.08, 0.32, x, 1.0, s * 0.88, TRIM);                                   // mudguards
    }
  }
  b.box(0.5, 0.35, 0.4, 0.6, 0.72, -0.85, 0x9aa3a8);                                   // fuel tank
}

// Insulated, ventilated chick body: 5 m long, door end at x = -3.6.
function chickBody(b) {
  const x0 = -3.6, x1 = 1.5, cx = (x0 + x1) / 2, L = x1 - x0;
  b.box(L, 2.35, 2.4, cx, 2.12, 0, 0xf4f4ef);
  b.box(L + 0.04, 0.08, 2.44, cx, 3.3, 0, 0xd8dcdf);                                   // roof edge
  b.box(L + 0.04, 0.1, 2.44, cx, 0.98, 0, 0xc9cdd0);
  for (const s of [-1, 1]) {
    b.box(L * 0.9, 0.34, 0.02, cx, 1.62, s * 1.21, 0xe5a11c);                           // hatchery stripe
    b.box(L * 0.9, 0.08, 0.02, cx, 1.86, s * 1.21, 0x2f7a3e);
    for (let i = 0; i < 6; i++) b.box(0.42, 0.14, 0.02, x0 + 0.55 + i * 0.8, 2.85, s * 1.215, 0x6d757c);  // vent louvres
  }
  b.box(0.8, 0.42, 0.5, 0.6, 3.5, 0, 0xd8dcdf);                                        // climate unit on the roof
  b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10), 0x3a3e42, mat(0.6, 3.73, 0));
  b.box(0.04, 2.3, 2.42, x0 - 0.01, 2.12, 0, 0xb5bcc2);                                // door frame
  b.box(0.05, 2.2, 2.2, x0 + 0.03, 2.12, 0, 0x2a2622);                                 // dark inside when open
}

function feedBody(b) {
  const x0 = -3.6, x1 = 1.45;
  for (let i = 0; i < 3; i++) {
    const xc = x0 + 0.85 + i * 1.65;
    b.add(new THREE.CylinderGeometry(1.15, 0.6, 1.0, 4, 1), 0xc23a2a, mat(xc, 1.55, 0, 0, Math.PI / 4, 0, 1.0, 1, 1.28));
    b.box(1.62, 1.25, 2.3, xc, 2.66, 0, 0xc23a2a);
    b.box(0.5, 0.08, 0.5, xc, 3.33, 0, 0xe2e4df);                                     // lids
  }
  b.box(x1 - x0, 0.12, 2.34, (x0 + x1) / 2, 3.32, 0, 0xe2e4df);
  b.box(x1 - x0, 0.1, 0.04, (x0 + x1) / 2, 2.2, 1.17, 0xf4f1ea);
  b.rod([x0, 1.2, 0.6], [x1, 1.2, 0.6], 0.09, 0x9aa3a8, 8);                          // bottom auger
  b.rod([x0 - 0.1, 1.2, 0.6], [x0 - 0.1, 3.5, 0.6], 0.11, 0x9aa3a8, 8);              // pipe riser at the rear
}

// A standing figure (the driver) baked from the farmer rig into one mesh, with his own colours.
function driverGeometry() {
  const model = buildFarmerModel();
  const j = model.joints;
  j.shoulderR.rotation.set(-0.9, 0, 0.25); j.elbowR.rotation.x = -1.2;                 // holding the note
  j.shoulderL.rotation.set(0.1, 0, -0.12);
  j.neck.rotation.x = 0.25;
  model.root.updateMatrixWorld(true);
  const suit = new THREE.Color(0x3b6ea5), suitDark = new THREE.Color(0x2b5486), boot = new THREE.Color(0xf0f0ea);
  const shirt = new THREE.Color(0x2f7a3e), shirtDark = new THREE.Color(0x24603a), shoe = new THREE.Color(0x3a2e25);
  const geos = model.meshes.map((m) => {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const c = g.attributes.color;
    const t = new THREE.Color();
    for (let i = 0; i < c.count; i++) {
      t.setRGB(c.getX(i), c.getY(i), c.getZ(i));
      const near = (a) => Math.abs(t.r - a.r) + Math.abs(t.g - a.g) + Math.abs(t.b - a.b) < 0.02;
      if (near(suit)) c.setXYZ(i, shirt.r, shirt.g, shirt.b);
      else if (near(suitDark)) c.setXYZ(i, shirtDark.r, shirtDark.g, shirtDark.b);
      else if (near(boot)) c.setXYZ(i, shoe.r, shoe.g, shoe.b);
    }
    return g;
  });
  const g = mergeGeometries(geos);
  // the delivery note on a clipboard in his right hand
  const clip = new Batch();
  clip.box(0.22, 0.3, 0.015, 0.2, 1.08, -0.32, 0x8a6a48, 0, -0.9);
  clip.box(0.19, 0.25, 0.006, 0.2, 1.085, -0.328, 0xf8f6ef, 0, -0.9);
  const cg = clip.geometry().toNonIndexed();
  cg.deleteAttribute('normal');
  g.deleteAttribute('normal');
  const out = mergeGeometries([g, cg]);
  out.computeVertexNormals();
  return out;
}

function pathFrom(points, R = 6) { return samplePath(points, R, 1); }

const ROAD = FARM.road;
const STOP = SPOTS2.truckStop;
const OUTSIDE = { x: ROAD[0].x, z: 60 };
const CHICK_IN = [OUTSIDE, ROAD[0], ROAD[1], { x: STOP.x, z: STOP.z }];
const CHICK_OUT = [{ x: STOP.x, z: STOP.z }, { x: 22, z: 14 }, { x: 28.5, z: 18.5 }, { x: 24, z: 24 }, { x: 18.5, z: 19.5 }, { x: 15, z: 14 }, ROAD[1], ROAD[0], OUTSIDE];
const FEED_STOP = { x: (FARM.silos[0].x + FARM.silos[1].x) / 2 + 0.6, z: FARM.silos[0].z - 3.9 };
const FEED_IN = [OUTSIDE, ROAD[0], ROAD[1], { x: -27, z: 14 }, { x: -27, z: FEED_STOP.z }, FEED_STOP];
const FEED_OUT = [FEED_STOP, { x: 29, z: FEED_STOP.z }, { x: 29, z: 11 }, { x: 24, z: 14 }, ROAD[1], ROAD[0], OUTSIDE];

/** One truck that follows sampled paths. kind 'chicks' | 'feed'. */
function makeTruck(kind, mats, group) {
  const root = new THREE.Group();
  root.name = `truck-${kind}`;
  const b = new Batch();
  chassis(b);
  if (kind === 'chicks') chickBody(b); else feedBody(b);
  const body = b.mesh(mats.out, { cast: true, receive: true });
  root.add(body);
  const doors = [];
  if (kind === 'chicks') {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(-3.62, 0, s * 1.2);
      const db = new Batch();
      db.box(0.05, 2.25, 1.2, 0, 2.12, -s * 0.6, 0xf1f1ec);
      db.box(0.07, 0.06, 1.1, -0.02, 2.0, -s * 0.6, 0x9aa3a8);
      db.box(0.06, 2.0, 0.05, -0.03, 2.12, -s * 1.1, 0x9aa3a8);
      pivot.add(db.mesh(mats.out, { cast: true }));
      root.add(pivot);
      doors.push({ pivot, s });
    }
  } else {
    // blower pipe: pivots at the rear riser top, swings up toward the silo lids
    const pivot = new THREE.Group();
    pivot.position.set(-3.7, 3.5, 0.6);
    const pb = new Batch();
    pb.rod([0, 0, 0], [0, 0, 4.2], 0.1, 0x9aa3a8, 8);
    pb.rod([0, 0, 4.2], [0, -0.7, 4.7], 0.1, 0x9aa3a8, 8);
    pb.add(new THREE.TorusGeometry(0.12, 0.03, 4, 8), 0x6d757c, mat(0, 0, 2.1));
    pivot.add(pb.mesh(mats.out, { cast: true }));
    root.add(pivot);
    doors.push({ pivot, s: 0 });
  }
  root.visible = false;
  group.add(root);
  return { root, doors, kind };
}

export function buildTrucks(mats, group) {
  const chick = makeTruck('chicks', mats, group);
  const feed = makeTruck('feed', mats, group);
  const driver = new THREE.Mesh(driverGeometry(), mats.out);
  driver.castShadow = true;
  driver.name = 'props-driver';
  driver.visible = false;
  group.add(driver);

  const paths = {
    chickIn: pathFrom(CHICK_IN), chickOut: pathFrom(CHICK_OUT, 4.5),
    feedIn: pathFrom(FEED_IN, 4.5), feedOut: pathFrom(FEED_OUT, 4.5),
  };

  function place(t, path, s) {
    const L = path[path.length - 1].s;
    s = Math.max(0, Math.min(L, s));
    let i = 1;
    while (i < path.length - 1 && path[i].s < s) i++;
    const a = path[i - 1], b = path[i];
    const k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
    const tx = a.tx + (b.tx - a.tx) * k, tz = a.tz + (b.tz - a.tz) * k;
    t.root.position.set(x, 0, z);
    t.root.rotation.y = Math.atan2(-tz, tx);
  }

  // state per truck: { state: 'away'|'driving-in'|'parked'|'leaving', s, time, open }
  const st = {
    chicks: { state: 'away', s: 0, open: 0, wait: 0 },
    feed: { state: 'away', s: 0, open: 0, wait: 0 },
  };
  const truckOf = { chicks: chick, feed };
  const inPath = { chicks: paths.chickIn, feed: paths.feedIn };
  const outPath = { chicks: paths.chickOut, feed: paths.feedOut };
  const DRIVE_IN = 8, SPEED_OUT = 11;

  function setState(kind, state) {
    const s = st[kind];
    s.state = state;
    s.s = 0; s.time = 0;
    if (state === 'parked') { s.open = 1; s.time = 0; }
    if (state === 'away') s.open = 0;
  }

  function update(dt) {
    for (const kind of ['chicks', 'feed']) {
      const s = st[kind], t = truckOf[kind];
      t.root.visible = s.state !== 'away';
      if (s.state === 'away') continue;
      s.time += dt;
      if (s.state === 'driving-in') {
        const path = inPath[kind], L = path[path.length - 1].s;
        const u = Math.min(1, s.time / DRIVE_IN);
        const e = 0.4 * u + 0.6 * (1 - (1 - u) * (1 - u));   // rolls in, brakes to the stop
        place(t, path, L * e);
        if (u >= 1) { s.state = 'parked'; s.time = 0; }
      } else if (s.state === 'parked') {
        place(t, inPath[kind], 1e9);
      } else if (s.state === 'leaving') {
        const path = outPath[kind], L = path[path.length - 1].s;
        const v = Math.min(SPEED_OUT, 1.5 + s.time * 3);
        s.s += v * dt;
        place(t, path, s.s);
        if (s.s >= L) setState(kind, 'away');
      }
      // doors / pipe: open while parked, closed otherwise
      const want = s.state === 'parked' && s.time > 0.6 ? 1 : 0;
      s.open += (want - s.open) * (1 - Math.exp(-3 * dt));
      for (const d of t.doors) {
        if (kind === 'chicks') d.pivot.rotation.y = d.s * s.open * 1.75;
        else { d.pivot.rotation.y = -0.3 * s.open; d.pivot.rotation.x = -0.55 * s.open; d.pivot.scale.setScalar(1); }
      }
    }
    // the driver stands at the chick truck's tail while it is parked
    const c = st.chicks;
    driver.visible = c.state === 'parked' && c.time > 1.2;
    if (driver.visible) {
      driver.position.set(STOP.x - 4.1, 0, STOP.z + 1.75);
      driver.rotation.y = -0.9;
    }
  }

  return {
    chick, feed, driver, st,
    stop: STOP,
    tail: { x: STOP.x - 3.7, z: STOP.z },
    feedStop: FEED_STOP,
    arrive(kind = 'chicks', instant = false) { setState(kind, instant ? 'parked' : 'driving-in'); if (instant) st[kind].time = 5; },
    leave(kind = 'chicks', instant = false) { if (st[kind].state === 'away') return; setState(kind, instant ? 'away' : 'leaving'); },
    update,
    collider(kind) {
      const s = st[kind];
      if (s.state !== 'parked') return null;
      if (kind === 'chicks') return { type: 'box', minX: STOP.x - 3.75, maxX: STOP.x + 3.65, minZ: STOP.z - 1.25, maxZ: STOP.z + 1.25 };
      return { type: 'box', minX: FEED_STOP.x - 3.75, maxX: FEED_STOP.x + 3.65, minZ: FEED_STOP.z - 1.25, maxZ: FEED_STOP.z + 1.25 };
    },
  };
}
