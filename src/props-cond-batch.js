// Phase 4 (PHASE4.md §8.7): a bad batch of chicks. Owner: package "scene" (props).
//   boxes        the top box of each stack set down by the truck stands open: small chicks, several lying still
//   sample box   the chick table's open sample box with the batch's small chicks, four of ten lying still
//   cull box     an open box beside the chick table, filling as the stacks are graded (one drawn chick per 20
//                graded out: the chicks.grade results, or the farm's count when it keeps one)
//   trays        feed trays and chick paper under the brooders while farm.brood.trays (shallow round trays, white
//                paper sheets with feed on them), to the end of the brooding week
// The boxes, sample box and cull box show in a bad batch only; the trays whenever the farm has them out.
import * as THREE from 'three';
import { SPOTS2, HEATERS, LEVEL1 } from './config.js';
import { Batch, mat } from './props-kit.js';
import { BOX, C, chick, chickBoxGeometry } from './props-models.js';

const PER = LEVEL1.boxes / LEVEL1.stacks;
const WEAK = 0xe4d08f, MAX_CULL = 16, PER_DRAWN = 20;

/** A chick lying still on its side, eyes shut, its down paler (adds to b). */
export function lyingChick(b, x, y, z, ry = 0, s = 1) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  const P = (dx, dy, dz) => [x + (dx * c + dz * sn) * s, y + dy * s, z + (-dx * sn + dz * c) * s];
  let p = P(0, 0.022, 0);
  b.add(new THREE.IcosahedronGeometry(0.03, 0), WEAK, mat(p[0], p[1], p[2], 0, ry, Math.PI / 2.4, s * 0.85, s * 1.05, s * 1.1));
  p = P(0.018, 0.016, -0.04);
  b.add(new THREE.IcosahedronGeometry(0.018, 0), WEAK, mat(p[0], p[1], p[2], 0, ry, 0.6, s));
  p = P(0.02, 0.012, -0.059);
  b.box(0.009 * s, 0.007 * s, 0.012 * s, p[0], p[1], p[2], 0xd89a48, ry);
  p = P(-0.012, 0.012, 0.025);
  b.box(0.006 * s, 0.006 * s, 0.03 * s, p[0], p[1], p[2], 0xd89a48, ry + 0.3);        // a leg out to the side
}

// An open chick box (origin: the centre of its bottom face): body, the dark inside, the lid propped at the back.
function openBox(b, fill) {
  const { w, h, d } = BOX;
  b.box(w, h, d, 0, h / 2, 0, C.kraft);
  b.box(w - 0.04, 0.005, d - 0.04, 0, h - 0.004, 0, 0x8a6a40);
  b.box(w, 0.008, d, 0, h + 0.12, -d / 2 - 0.06, C.kraft, 0, -1.15);
  fill(b, h - 0.008);
}

const boxChicks = (b, y) => {
  for (let i = 0; i < 6; i++) chick(b, -0.2 + (i % 3) * 0.2, y, -0.1 + Math.floor(i / 3) * 0.19, i * 1.9, 0.92);
  for (const [x, z, r] of [[-0.1, 0.0, 0.4], [0.12, 0.08, 2.2], [0.22, -0.12, 4.1]]) lyingChick(b, x, y, z, r, 0.95);
};

export function buildBadBatch(group, props) {
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  // ---- the open top box on each stack by the truck (instanced: one draw call) ----
  const ob = new Batch();
  openBox(ob, boxChicks);
  const tops = new THREE.InstancedMesh(ob.geometry(), vc, LEVEL1.stacks);
  tops.name = 'props-bad-boxes';
  tops.castShadow = true;
  tops.frustumCulled = false;
  // ---- the sample box on the chick table: ten small chicks, four lying still ----
  const T = SPOTS2.chickTable;
  const sb = new Batch();
  sb.add(chickBoxGeometry(), null, mat(-0.32, 0.755, -0.08, 0, 0.05, 0, 1, 0.9, 1));
  sb.box(0.56, 0.005, 0.41, -0.32, 0.755 + BOX.h * 0.9 - 0.004, -0.08, 0x8a6a40, 0.05);
  sb.box(0.6, 0.008, 0.45, -0.32, 0.92, -0.33, C.kraft, 0.05, -1.1);
  const y = 0.755 + BOX.h * 0.9 - 0.01;
  for (let i = 0; i < 6; i++) chick(sb, -0.5 + (i % 3) * 0.12, y, -0.16 + Math.floor(i / 3) * 0.15, i * 1.3, 0.88);
  for (let i = 0; i < 4; i++) lyingChick(sb, -0.18 + (i % 2) * 0.1, y, -0.15 + Math.floor(i / 2) * 0.15, i * 1.7, 0.9);
  const sample = sb.mesh(vc, { cast: true });
  sample.position.set(T.x, 0, T.z);
  sample.name = 'props-bad-sample';
  // ---- the cull box beside the table, its chicks instanced ----
  const cb = new Batch();
  openBox(cb, () => {});
  const cullBox = cb.mesh(vc, { cast: true });
  const CX = T.x + 1.1, CZ = T.z + 0.15;   // east of the table (the stacks stand west of it, the dead bin north-east)
  cullBox.position.set(CX, 0.02, CZ);
  cullBox.name = 'props-cull-box';
  const lc = new Batch();
  lyingChick(lc, 0, 0, 0, 0, 1);
  const culls = new THREE.InstancedMesh(lc.geometry(), vc, MAX_CULL);
  culls.name = 'props-cull-chicks';
  culls.frustumCulled = false;
  const M = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_CULL; i++) {
    const x = CX - 0.21 + (i % 4) * 0.14, z = CZ - 0.13 + Math.floor(i / 4) * 0.09;
    culls.setMatrixAt(i, M.copy(mat(x, 0.02 + BOX.h - 0.01 + (i >= 8 ? 0.012 : 0), z, 0, i * 2.3, 0)));
  }
  // ---- feed trays and chick paper under the brooders ----
  const tb = new Batch();
  for (const hh of HEATERS) {
    for (const s of [-1, 1]) {
      tb.box(0.9, 0.004, 0.6, hh.x + s * 0.95, 0.026, hh.z, 0xf6f4ee, s * 0.06);           // paper sheet
      for (let k = 0; k < 9; k++) tb.box(0.035, 0.004, 0.03, hh.x + s * 0.95 + ((k * 37) % 7 - 3) * 0.1, 0.03, hh.z + ((k * 53) % 5 - 2) * 0.1, 0xd9b45a);
      const tx = hh.x + s * 0.4, tz = hh.z - s * 0.25;
      tb.add(new THREE.CylinderGeometry(0.26, 0.22, 0.04, 14), 0xe35d2a, mat(tx, 0.04, tz));   // the tray's rim and floor
      tb.add(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 14), 0xd9b45a, mat(tx, 0.058, tz)); // crumbs in it
    }
  }
  const trays = tb.mesh(vc, { cast: false, receive: true });
  trays.name = 'props-feed-trays';
  const root = new THREE.Group();
  root.name = 'props-bad-batch';
  root.add(tops, sample, cullBox, culls);
  root.visible = false;
  trays.visible = false;
  group.add(root, trays);

  const st = { graded: 0, culled: 0, drawn: 0, tops: 0 };
  const top = BOX.h * PER + 0.03;
  return {
    root, trays, st,
    reset() { st.graded = 0; st.culled = 0; },
    /** EV.ACTION chicks.grade: what the panel's grading answered. */
    graded(r) { if (r && Number.isFinite(r.culled)) { st.graded++; st.culled += r.culled; } },
    serialize() { return { graded: st.graded, culled: st.culled }; },
    restore(d) { st.graded = d?.graded || 0; st.culled = d?.culled || 0; },
    update(f, env, bad) {
      const day = env.dayNumber ?? 0;
      trays.visible = !!f.brood?.trays && day <= 7;
      root.visible = bad;
      if (!bad) return;
      const boxes = props.debug.boxes, yard = props.debug.yard;
      // the stacks set down by the truck: an open box on top of each
      let n = 0;
      boxes.stacks.forEach((s, i) => {
        if (s.state !== 'ground') { tops.setMatrixAt(i, zero); return; }
        tops.setMatrixAt(i, M.copy(mat(s.x, top + (1 - (s.drop ?? 1)) * 0.4, s.z, 0, Math.PI / 2 + 0.04, 0)));
        n++;
      });
      tops.instanceMatrix.needsUpdate = true;
      st.tops = n;
      // the sample box: the batch's own (the Phase 2 box hidden), on the table while the chicks came today
      const showSample = !!yard.sampleBox.visible;
      yard.sampleBox.visible = false;
      sample.visible = showSample;
      cullBox.visible = showSample;
      const culled = Math.max(st.culled, Number.isFinite(f.flock?.gradedOut) ? f.flock.gradedOut : 0);
      const k = showSample ? Math.min(MAX_CULL, Math.floor(culled / PER_DRAWN)) : 0;
      culls.count = k;
      culls.visible = k > 0;
      st.drawn = k;
    },
  };
}
