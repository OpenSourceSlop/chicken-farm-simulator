// What the farmer holds (Phase 2): the full wheelbarrow, a husk sack on his shoulder, a hand truck
// with a stack of ten chick boxes, the dead bird bucket, the folded catching frame with the hand
// scale (or only the scale while the frame stands on the litter), a chick in both hands. Also two
// short action poses: 'crouch' (probe, squeeze, pick up, tip) and 'reach' (nipple, valve, relight).
// The meshes hang on the farmer's root and are all built at load, hidden, so the shader warm-up
// sees them. apply() runs after the walk animation and bends the arms to hold the thing.
// Owner: player agent (package "props").
import * as THREE from 'three';
import { Batch, mat } from './house-kit.js';
import { wheelbarrow, sack, handTruck, boxesOnTruck, bucket, catchingFrame, handScale, chick } from './props-models.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

// Arm holds per kind: [shoulder x, shoulder z, elbow x] for L and R (null = free swing)
const HOLD = {
  barrow: { L: [0.32, -0.18, 0.2], R: [0.32, 0.18, 0.2], lean: -0.08 },
  boxes: { L: [0.95, -0.12, 0.55], R: [0.95, 0.12, 0.55], lean: -0.12 },
  sack: { L: null, R: [2.55, 0.42, 2.0], lean: 0.05 },
  bucket: { L: null, R: [0.05, 0.2, 0.12], lean: 0 },
  frame: { L: [0.12, -0.42, 0.5], R: [0.55, 0.12, 0.7], lean: 0 },
  scale: { L: null, R: [0.55, 0.12, 0.7], lean: 0 },
  chick: { L: [0.75, -0.05, 1.35], R: [0.75, 0.05, 1.35], lean: -0.05 },
};

function build(kind) {
  const b = new Batch();
  if (kind === 'barrow') {
    // pivot at the wheel axle; the group tilts the handles up into his hands
    const w = new Batch(); wheelbarrow(w, { full: true });
    b.add(w.geometry(), 0xffffff, mat(0, -0.2, 0));
  } else if (kind === 'sack') {
    const s = new Batch(); sack(s);
    b.add(s.geometry(), 0xffffff, mat(0, 0, 0, 0.15, Math.PI / 2, 0.25));
  } else if (kind === 'boxes') {
    handTruck(b, { tilt: -0.45 });
    boxesOnTruck(b, 10, -0.45);
  } else if (kind === 'bucket') {
    bucket(b, { dead: true });
  } else if (kind === 'frame') {
    catchingFrame(b, { folded: true });
  } else if (kind === 'scale') {
    handScale(b);
  } else if (kind === 'chick') {
    chick(b, 0, 0, 0, Math.PI, 1.6);
  }
  return b.geometry();
}

// where each mesh sits on the farmer's root (he faces -z)
const PLACE = {
  barrow: { p: [0, 0.2, -1.62], r: [-0.2, 0, 0] },
  sack: { p: [0.2, 1.55, 0.02], r: [0, 0, 0] },
  boxes: { p: [0, 0.085, -1.15], r: [0, 0, 0] },
  bucket: { p: [0.34, 0.24, -0.04], r: [0, 0.3, 0] },
  frame: { p: [-0.36, 0.42, 0.02], r: [0, Math.PI / 2, 0.06] },
  scale: { p: [0.3, 0.78, -0.3], r: [0, 0.2, 0] },
  chick: { p: [0, 1.04, -0.36], r: [0, 0, 0] },
};

export function createCarry(root, material, joints) {
  const meshes = {};
  for (const kind of Object.keys(PLACE)) {
    const m = new THREE.Mesh(build(kind), material);
    m.castShadow = true;
    m.name = `carry-${kind}`;
    const pl = PLACE[kind];
    m.position.set(...pl.p);
    m.rotation.set(...pl.r);
    m.visible = false;
    root.add(m);
    meshes[kind] = m;
  }
  // the frame kind shows the scale too
  const st = { kind: null, w: 0, pose: null, poseT: 0, poseDur: 0, t: 0 };

  function set(kind) {
    st.kind = kind && HOLD[kind] ? kind : null;
    for (const [k, m] of Object.entries(meshes)) m.visible = k === st.kind || (st.kind === 'frame' && k === 'scale');
  }

  function pose(name, seconds = 1) {
    if (!name) { st.pose = null; return; }
    st.pose = name; st.poseT = 0; st.poseDur = Math.max(0.3, seconds);
  }

  const blendArm = (sh, el, hold, w) => {
    if (!hold) return;
    sh.rotation.x += (hold[0] - sh.rotation.x) * w;
    sh.rotation.z += (hold[1] - sh.rotation.z) * w;
    el.rotation.x += (hold[2] - el.rotation.x) * w;
  };

  function apply(dt) {
    st.t += dt;
    st.w = clamp(st.w + (st.kind ? 1 : -1) * dt * 6, 0, 1);
    const j = joints;
    if (st.kind) {
      const h = HOLD[st.kind], w = smooth(st.w);
      blendArm(j.shoulderL, j.elbowL, h.L, w);
      blendArm(j.shoulderR, j.elbowR, h.R, w);
      j.spine.rotation.x += h.lean * w;
      // the barrow and the hand truck bob a little on the walk
      if (st.kind === 'barrow' || st.kind === 'boxes') {
        const m = meshes[st.kind];
        m.rotation.x = PLACE[st.kind].r[0] + Math.sin(st.t * 9) * 0.006;
      }
    }
    if (st.pose) {
      st.poseT += dt;
      const t = st.poseT / st.poseDur;
      if (t >= 1) { st.pose = null; return; }
      const w = smooth(clamp(Math.min(t / 0.25, (1 - t) / 0.25), 0, 1));
      if (st.pose === 'crouch') {
        j.pelvis.position.y -= 0.36 * w;
        for (const s of ['L', 'R']) {
          j[`hip${s}`].rotation.x += 1.25 * w;
          j[`knee${s}`].rotation.x -= 1.95 * w;
          j[`ankle${s}`].rotation.x += 0.7 * w;
        }
        j.spine.rotation.x -= 0.45 * w;
        j.shoulderR.rotation.x += 0.9 * w;
        j.elbowR.rotation.x += 0.2 * w;
      } else if (st.pose === 'reach') {
        j.shoulderR.rotation.x += (2.5 - j.shoulderR.rotation.x) * w;
        j.elbowR.rotation.x += (0.25 - j.elbowR.rotation.x) * w;
        j.neck.rotation.x -= 0.35 * w;
      }
    }
  }

  return { set, pose, apply, meshes, get kind() { return st.kind; } };
}
