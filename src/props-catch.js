// The catching night (PHASE3.md §12 item 11, §6.9): two catching trucks (long flatbeds whose crate stacks
// grow as farm.harvest.trucks[i].crates fill) that drive in along the farm road and park at the truck stop,
// and the crew of four (the farmer's rig baked in orange overalls): two catch in the section being caught,
// two carry crates from it out of the door to the truck being loaded and come back. All driven by
// farm.harvest (sections, trucks) and EV.FARM_DELIVERY { kind: 'catch', phase, truck }. Owner: "scene".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPOTS2, FARM, HARVEST, HOUSE } from './config.js';
import { Batch, mat, instancedParts } from './props-kit.js';
import { samplePath } from './world-layout.js';
import { buildFarmerModel } from './player-model.js';
import { chassis } from './props-truck.js';
import { crate, C3 } from './props-cycle-models.js';

const STOP = SPOTS2.truckStop;
// truck 0 parks with its tail by the door path, truck 1 waits ahead of it
export const CATCH_STOPS = [{ x: STOP.x, z: STOP.z }, { x: STOP.x + 12.5, z: STOP.z }];
const BED_X0 = -7.6, BED_X1 = 1.35;                  // flatbed along the truck (front toward +x)
const PER_LAYER_X = 9, PER_LAYER_Z = 4, LAYERS = 8;  // 288 crates a truck drawn (HARVEST.cratesPerTruck 300)
const SLOTS = PER_LAYER_X * PER_LAYER_Z * LAYERS;
const CREW = HARVEST.crew;
const DOOR = { x: HOUSE.door.x, zIn: HOUSE.door.z - 0.9, zOut: HOUSE.door.z + 1.6 };

function flatbed(b) {
  chassis(b);
  // a longer frame and a second rear axle under the bed
  b.box(BED_X1 - BED_X0, 0.22, 0.9, (BED_X0 + BED_X1) / 2, 0.72, 0, 0x3a3e42);
  for (const x of [-5.6, -6.5]) for (const s of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.47, 0.47, 0.5, 12), 0x26292c, mat(x, 0.47, s * 0.8, Math.PI / 2, 0, 0));
    b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.51, 8), 0xb8bec4, mat(x, 0.47, s * 0.8, Math.PI / 2, 0, 0));
  }
  b.box(BED_X1 - BED_X0, 0.12, 2.42, (BED_X0 + BED_X1) / 2, 0.92, 0, 0x6d757c);   // bed
  b.box(0.12, 1.6, 2.42, BED_X1 + 0.04, 1.75, 0, 0x5f676d);                         // headboard
  for (const s of [-1, 1]) for (let x = BED_X0 + 0.5; x < BED_X1; x += 1.5) b.box(0.08, 2.3, 0.08, x, 2.1, s * 1.18, 0x8f989f); // stake posts
  b.box(0.3, 0.12, 2.3, BED_X0 - 0.05, 0.62, 0, 0x2b2f33);                         // rear bumper
  b.box(0.04, 0.3, 2.0, BED_X0 - 0.12, 0.72, 0, 0xf2b33c);                         // reflector board
}

// A crew member baked from the farmer rig in one pose: 'walkA' / 'walkB' (carrying a crate in front) or
// 'catch' (bent down to the birds).
function crewGeometry(pose) {
  const model = buildFarmerModel();
  const j = model.joints;
  if (pose === 'catch') {
    j.spine.rotation.x = -0.75; j.neck.rotation.x = 0.4;
    j.shoulderL.rotation.set(1.3, 0, -0.15); j.shoulderR.rotation.set(1.1, 0, 0.15);
    j.hipL.rotation.x = 0.6; j.hipR.rotation.x = 0.9; j.kneeL.rotation.x = -0.9; j.kneeR.rotation.x = -1.2;
    j.pelvis.position.y -= 0.18;
  } else {
    const s = pose === 'walkA' ? 1 : -1;
    j.hipL.rotation.x = 0.45 * s; j.hipR.rotation.x = -0.45 * s; j.kneeL.rotation.x = s > 0 ? -0.15 : -0.6; j.kneeR.rotation.x = s > 0 ? -0.6 : -0.15;
    j.shoulderL.rotation.set(0.95, 0, -0.1); j.shoulderR.rotation.set(0.95, 0, 0.1); j.elbowL.rotation.x = 0.5; j.elbowR.rotation.x = 0.5;
  }
  model.root.updateMatrixWorld(true);
  const suit = new THREE.Color(0x3b6ea5), suitDark = new THREE.Color(0x2b5486), cap = new THREE.Color(0xf1ede2);
  const orange = new THREE.Color(C3.orange), orangeDark = new THREE.Color(0xb8561c), boots = new THREE.Color(0x2b2e31);
  const bootW = new THREE.Color(0xf0f0ea);
  const geos = model.meshes.map((m) => {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const c = g.attributes.color, t = new THREE.Color();
    for (let i = 0; i < c.count; i++) {
      t.setRGB(c.getX(i), c.getY(i), c.getZ(i));
      const near = (a) => Math.abs(t.r - a.r) + Math.abs(t.g - a.g) + Math.abs(t.b - a.b) < 0.02;
      if (near(suit)) c.setXYZ(i, orange.r, orange.g, orange.b);
      else if (near(suitDark)) c.setXYZ(i, orangeDark.r, orangeDark.g, orangeDark.b);
      else if (near(bootW)) c.setXYZ(i, boots.r, boots.g, boots.b);
      else if (near(cap)) c.setXYZ(i, 0.95, 0.85, 0.3);
    }
    g.deleteAttribute('normal');
    return g.index ? g.toNonIndexed() : g;
  });
  const g = mergeGeometries(geos);
  g.computeVertexNormals();
  return g;
}

export function buildCatch(mats, group) {
  // ---- trucks ----
  const trucks = CATCH_STOPS.map((stop, i) => {
    const b = new Batch(); flatbed(b);
    const root = new THREE.Group();
    root.name = `truck-catch-${i}`;
    root.add(b.mesh(mats.out, { cast: true, receive: true }));
    root.visible = false;
    group.add(root);
    const OUT = { x: FARM.road[0].x, z: 60 };
    const path = samplePath([OUT, FARM.road[0], FARM.road[1], { x: stop.x, z: stop.z }], 6, 1);
    const away = samplePath([{ x: stop.x, z: stop.z }, { x: 22, z: 14 }, { x: 28.5, z: 18.5 }, { x: 24, z: 24 }, { x: 18.5, z: 19.5 }, { x: 15, z: 14 }, FARM.road[1], FARM.road[0], OUT], 4.5, 1);
    return { i, stop, root, path, away, state: 'away', s: 0, t: 0 };
  });
  // ---- crates: both trucks' stacks and the ones being carried, one instanced mesh ----
  const cb = new Batch(); crate(cb);
  // (no shadows: the catch is at night, and the instanced shadow pass would be one more program)
  // the occlusion material (mats.out, instanced): a stack between the camera and the farmer dithers away
  const crates = instancedParts(cb.geometry(), mats.out || mats.vc, SLOTS * 2 + CREW, { color: false, cast: false });
  crates.name = 'props-catch-crates';
  crates.visible = false;
  group.add(crates);
  // ---- crew: three baked poses, an instance per worker in the pose he is in ----
  const poses = ['walkA', 'walkB', 'catch'].map((p) => {
    const m = instancedParts(crewGeometry(p), mats.out || mats.vc, CREW, { color: false, cast: false });
    m.name = `props-crew-${p}`;
    m.visible = false;
    group.add(m);
    return m;
  });
  const crew = Array.from({ length: CREW }, (_, k) => ({ k, x: DOOR.x, z: DOOR.zOut, yaw: 0, leg: 0, carry: false, t: k * 3.1 }));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const shown = new Int32Array(trucks.length).fill(-1);

  function place(t, path, s) {
    const L = path[path.length - 1].s;
    s = Math.max(0, Math.min(L, s));
    let i = 1;
    while (i < path.length - 1 && path[i].s < s) i++;
    const a = path[i - 1], b = path[i], k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    t.root.position.set(a.x + (b.x - a.x) * k, 0, a.z + (b.z - a.z) * k);
    t.root.rotation.y = Math.atan2(-(a.tz + (b.tz - a.tz) * k), a.tx + (b.tx - a.tx) * k);
  }
  function arrive(i, instant) { const t = trucks[i]; if (t.state === 'parked' || t.state === 'in') return; t.state = instant ? 'parked' : 'in'; t.t = 0; t.s = 0; }
  function leave(i, instant) { const t = trucks[i]; if (t.state === 'away') return; t.state = instant ? 'away' : 'out'; t.t = 0; t.s = 0; }

  function writeCrates(farm) {
    const hv = farm.harvest || {};
    let any = false;
    trucks.forEach((t, ti) => {
      const n = t.state === 'away' ? 0 : Math.min(SLOTS, Math.round(((hv.trucks?.[ti]?.crates ?? 0) * SLOTS) / HARVEST.cratesPerTruck));
      if (n > 0) any = true;
      if (n === shown[ti] && t.state === 'parked') return;
      shown[ti] = t.state === 'parked' ? n : -1;
      t.root.updateMatrixWorld(true);
      for (let k = 0; k < SLOTS; k++) {
        if (k >= n) { crates.setMatrixAt(ti * SLOTS + k, zero); continue; }
        // stacks of eight from the headboard back, four across
        const layer = k % LAYERS, across = Math.floor(k / LAYERS) % PER_LAYER_Z, col = Math.floor(k / (LAYERS * PER_LAYER_Z));
        _p.set(BED_X1 - 0.55 - col * 0.98, 0.98 + layer * 0.275, -0.87 + across * 0.58);
        _m.compose(_p, _q.identity(), _s);
        crates.setMatrixAt(ti * SLOTS + k, _m.premultiply(t.root.matrixWorld));
      }
    });
    return any;
  }

  // a crew walker's loop: the section being caught -> the door -> the truck being loaded -> back
  function crewPoint(c, farm, sx, truck, dt) {
    const tail = { x: truck.root.position.x + BED_X0 + 0.6, z: truck.stop.z - 1.5 };
    const pts = [{ x: sx, z: 3.2 + (c.k % 2) * 1.2 }, { x: DOOR.x, z: DOOR.zIn }, { x: DOOR.x, z: DOOR.zOut }, tail, { x: DOOR.x, z: DOOR.zOut }, { x: DOOR.x, z: DOOR.zIn }];
    const seg = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
    let L = 0; for (let k = 0; k < pts.length; k++) L += seg(pts[k], pts[(k + 1) % pts.length]);
    c.t = (c.t + dt * 1.5) % L;
    let s = c.t;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length], d = seg(a, b);
      if (s <= d) {
        const u = d > 0 ? s / d : 0;
        c.x = a.x + (b.x - a.x) * u; c.z = a.z + (b.z - a.z) * u;
        c.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
        c.carry = k < 3;   // a full crate on the way out, empty-handed on the way back
        return;
      }
      s -= d;
    }
  }

  let walkT = 0;
  return {
    trucks, crates, poses, crew,
    arrive, leave,
    update(dt, farm) {
      walkT += dt;
      for (const t of trucks) {
        t.root.visible = t.state !== 'away';
        if (t.state === 'away') continue;
        t.t += dt;
        if (t.state === 'in') {
          const L = t.path[t.path.length - 1].s, u = Math.min(1, t.t / (9 + 2 * t.i));
          place(t, t.path, L * (0.4 * u + 0.6 * (1 - (1 - u) * (1 - u))));
          if (u >= 1) { t.state = 'parked'; shown[t.i] = -1; }
        } else if (t.state === 'parked') place(t, t.path, 1e9);
        else {
          t.s += Math.min(11, 1.5 + t.t * 3) * dt;
          place(t, t.away, t.s);
          if (t.s >= t.away[t.away.length - 1].s) { t.state = 'away'; shown[t.i] = -1; }
        }
      }
      const any = writeCrates(farm);
      // the crew: on the farm from the trucks' arrival until the catch is over
      const hv = farm.harvest || {};
      const working = hv.started && !hv.result && trucks.some((t) => t.state === 'parked');
      const secs = hv.sections || [];
      const cur = secs.find((s) => s.state === 'catching') || secs.find((s) => s.state === 'penned');
      const sx = cur ? Math.max(cur.x0 + 0.8, Math.min(cur.x1 - 0.8, DOOR.x)) : DOOR.x;
      const loading = trucks.find((t, i) => t.state === 'parked' && !(hv.trucks?.[i]?.left) && (hv.trucks?.[i]?.birds ?? 0) < HARVEST.cratesPerTruck * HARVEST.birdsPerCrate) || trucks[0];
      let carried = 0;
      for (const m of poses) m.visible = working;
      crates.visible = any || working;
      for (const c of crew) {
        let pose = 2;
        if (!working) { for (const m of poses) m.setMatrixAt(c.k, zero); continue; }
        if (c.k < 2) {
          // catchers: bent to the birds at the door end of the section, shifting along it
          c.x = sx + (c.k ? 1 : -1) * (0.9 + 0.4 * Math.sin(walkT * 0.7 + c.k));
          c.z = (c.k ? 1.6 : -1.6) + 0.5 * Math.sin(walkT * 0.5 + 2 * c.k);
          c.yaw = c.k ? 0.4 : -2.7;
          c.carry = false;
        } else {
          crewPoint(c, farm, sx, loading, dt);
          pose = Math.floor(walkT * 3.2 + c.k) % 2;
        }
        _p.set(c.x, 0, c.z); _q.setFromEuler(_e.set(0, c.yaw, 0));
        _m.compose(_p, _q, _s);
        poses.forEach((m, k) => m.setMatrixAt(c.k, k === pose ? _m : zero));
        const slot = SLOTS * 2 + c.k;
        if (c.carry) {
          _p.set(c.x - Math.sin(c.yaw) * 0.45, 1.0, c.z - Math.cos(c.yaw) * 0.45);
          crates.setMatrixAt(slot, _m.compose(_p, _q, _s));
          carried++;
        } else crates.setMatrixAt(slot, zero);
      }
      for (let k = 0; k < CREW; k++) if (!working) crates.setMatrixAt(SLOTS * 2 + k, zero);
      for (const m of poses) m.instanceMatrix.needsUpdate = true;
      crates.instanceMatrix.needsUpdate = true;
      return { working, carried };
    },
    get working() { return poses[0].visible; },
  };
}
