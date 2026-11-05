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
// Phase 3 (package "scene"): the tape measure, the litter fork, the scraper, the pressure washer lance,
// the knapsack sprayer, the swab kit; and the light and air meters shown in the hand for a moment (flash)
import { tapeMeasure, fork, scraper, washerLance, sprayer, swabKit, handMeter } from './props-cycle-models.js';

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
  // Phase 3
  tape: { L: null, R: [0.6, 0.12, 0.7], lean: 0 },
  fork: { L: [0.55, -0.12, 0.45], R: [0.8, 0.1, 0.35], lean: -0.08 },
  scraper: { L: [0.45, -0.16, 0.3], R: [0.45, 0.16, 0.3], lean: -0.12 },
  washer: { L: [0.62, -0.1, 0.7], R: [0.85, 0.1, 0.45], lean: -0.04 },
  sprayer: { L: null, R: [0.7, 0.1, 0.55], lean: 0.03 },
  swabs: { L: [0.55, -0.1, 1.0], R: null, lean: 0 },
};
// tools that sit in a hand (parented to the forearm, at the wrist) instead of on the body
const IN_HAND = { tape: 'R', swabs: 'L', lightMeter: 'R', airMeter: 'R' };

function build(kind) {
  const b = new Batch();
  if (kind === 'barrow') {
    // pivot at the wheel axle; the group tilts the handles up into his hands
    const w = new Batch(); wheelbarrow(w, { full: true });
    b.add(w.geometry(), null, mat(0, -0.2, 0));
  } else if (kind === 'sack') {
    const s = new Batch(); sack(s);
    b.add(s.geometry(), null, mat(0, 0, 0, 0.15, Math.PI / 2, 0.25));
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
  } else if (kind === 'tape') tapeMeasure(b);
  else if (kind === 'fork') fork(b);
  else if (kind === 'scraper') scraper(b);
  else if (kind === 'washer') washerLance(b);
  else if (kind === 'sprayer') sprayer(b);
  else if (kind === 'swabs') swabKit(b);
  else if (kind === 'lightMeter') handMeter(b, 'light');
  else if (kind === 'airMeter') handMeter(b, 'air');
  return b.geometry();
}

// where each mesh sits on the farmer's root (he faces -z)
const PLACE = {
  barrow: { p: [0, 0.2, -1.62], r: [-0.2, 0, 0] },
  sack: { p: [0.3, 1.5, 0.2], r: [0.2, 0.15, -0.55] },
  boxes: { p: [0, 0.085, -1.15], r: [0, 0, 0] },
  bucket: { p: [0.34, 0.24, -0.04], r: [0, 0.3, 0] },
  frame: { p: [-0.36, 0.42, 0.02], r: [0, Math.PI / 2, 0.06] },
  scale: { p: [0.3, 0.78, -0.3], r: [0, 0.2, 0] },
  chick: { p: [0, 1.04, -0.36], r: [0, 0, 0] },
  // Phase 3 (in-hand ones are relative to the wrist of that forearm)
  tape: { p: [0, -0.34, -0.03], r: [0, 0, 0] },
  fork: { p: [0, 0, 0], r: [0, 0, 0] },
  scraper: { p: [0, 0, 0], r: [0, 0, 0] },
  washer: { p: [0.26, 1.02, -0.32], r: [0, 0, 0] },
  sprayer: { p: [0, 0, 0], r: [0, 0, 0] },
  swabs: { p: [0, -0.36, -0.06], r: [-1.0, 0, 0] },
  lightMeter: { p: [0, -0.35, -0.04], r: [0, 0, 0] },
  airMeter: { p: [0, -0.35, -0.04], r: [0, 0, 0] },
};

// Skills update (SKILLS.md §10, Biosecurity 2; package "scene"): the tally bucket's counter on the rim — a small dark
// counter with the count in green digits (amber when the bucket is full), on the carried bucket and on the bucket set down
// (props.js hangs a second face on it). One canvas texture for both (there is one bucket); props.update calls set().
export const tallyFace = (() => {
  let canvas = null, tex = null, mat = null, key = '';
  const faces = [];
  function ensure() {
    if (tex) return true;
    if (typeof document === 'undefined') return false;
    canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32;
    tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    draw(0, false);
    return true;
  }
  function draw(n, full) {
    const g = canvas.getContext('2d');
    g.fillStyle = '#2b2f33'; g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#0e2412'; g.fillRect(4, 4, 56, 24);
    g.fillStyle = full ? '#f0b43c' : '#b9e27a';
    g.font = '700 25px "Chakra Petch", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(Math.max(0, Math.min(999, n | 0))).padStart(2, '0'), 32, 17);
    tex.needsUpdate = true;
  }
  return {
    /** A counter face for a bucket (local to the bucket: on its rim, tilted up toward the camera); null in node. */
    make() {
      if (!ensure()) return null;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), mat);
      m.name = 'bucket-tally'; m.position.set(0, 0.33, 0.168); m.rotation.set(-0.7, 0, 0); m.visible = false;
      faces.push(m);
      return m;
    },
    /** The count shown and whether the counters show (the tally bucket holds). */
    set(n, full, on) {
      if (on && tex) { const k = `${n | 0}|${!!full}`; if (k !== key) { key = k; draw(n, full); } }
      for (const f of faces) f.visible = !!on;
    },
    get faces() { return faces; },
  };
})();

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
    const hand = IN_HAND[kind];
    (hand && joints[`elbow${hand}`] ? joints[`elbow${hand}`] : root).add(m);
    meshes[kind] = m;
  }
  // the tally's counter on the carried bucket's rim (hidden unless Biosecurity 2's tally bucket holds)
  const face = tallyFace.make();
  if (face) meshes.bucket.add(face);
  // the frame kind shows the scale too
  const st = { kind: null, w: 0, pose: null, poseT: 0, poseDur: 0, t: 0, flash: null, flashT: 0 };

  function show() {
    for (const [k, m] of Object.entries(meshes)) m.visible = k === st.kind || (st.kind === 'frame' && k === 'scale') || k === st.flash;
  }
  function set(kind) {
    st.kind = kind && HOLD[kind] ? kind : null;
    show();
  }
  /** Phase 3: a hand tool shown for `seconds` (the light meter, the air meter), whatever is carried. */
  function flash(kind, seconds = 2) {
    st.flash = meshes[kind] ? kind : null; st.flashT = seconds;
    show();
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
    if (st.flash && (st.flashT -= dt) <= 0) { st.flash = null; show(); }
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

  return { set, pose, flash, apply, meshes, get kind() { return st.kind; }, get flashing() { return st.flash; } };
}
