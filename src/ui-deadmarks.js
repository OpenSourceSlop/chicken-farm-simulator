// Dead birds you can find (the farmer's request during Phase 4, PHASE4.md §15.4) and the bucket he set down (§15.3 b).
// Owner: integrator.
//   - a chip that points to the NEAREST dead bird on the floor with the count and its distance ("3 dead birds · 12 m"):
//     at the screen edge while that bird is off screen, as a tag over it while it is on screen; it keeps clear of the
//     job marker's pointer (both stay visible) and of the HUD cards
//   - a small floating marker (a muted red inverted pyramid, gently bobbing) over every dead bird within DEAD_MARK_M of
//     the farmer: one instanced mesh, at most MAX_MARKS
//   - the bucket on the floor: a blue-grey marker over it and its own chip ("Bucket · 3 birds · 8 m") while the farmer
//     is more than 3 m from it
// createDeadMarks(ctx, root, { avoid, jobPointer }) -> { update(dt, on, panelOpen), state(), hide() }
//   ctx: THREE, scene, camera, farm, flock (flock.dead.near / count), props (bucketDown), player
import { h, setText, reducedMotion } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

export const DEAD_MARK_M = 15;
export const MAX_MARKS = 64;
const DEAD_COLOR = 0xc8604a, BUCKET_COLOR = 0x86a9c6;

export function createDeadMarks(ctx, root, { avoid, jobPointer } = {}) {
  const { THREE, scene, camera } = ctx;
  // ---- the 3D markers ----
  const geo = new THREE.ConeGeometry(0.15, 0.3, 4, 1);
  geo.rotateX(Math.PI); // point down at the bird
  const mat = new THREE.MeshBasicMaterial({ color: DEAD_COLOR, transparent: true, opacity: 0.92, depthWrite: false });
  const marks = new THREE.InstancedMesh(geo, mat, MAX_MARKS);
  marks.name = 'dead-marks';
  marks.count = 0; marks.frustumCulled = false; marks.renderOrder = 18;
  scene.add(marks);
  const bucketMark = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: BUCKET_COLOR, transparent: true, opacity: 0.95, depthWrite: false }));
  bucketMark.name = 'bucket-mark'; bucketMark.visible = false; bucketMark.renderOrder = 18; bucketMark.scale.setScalar(1.25);
  scene.add(bucketMark);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();

  // ---- the chips ----
  const chip = (cls) => {
    const icon = h('span', { class: 'edge-arrow', html: ICONS.arrow });
    const text = h('span');
    const el = h('div', { class: `edge-pointer ${cls}`, hidden: true, 'aria-hidden': 'true' }, icon, text);
    root.prepend(el);
    return { el, icon, text, last: '', w: 0, h: 0 };
  };
  const deadChip = chip('edge-pointer--dead'), bucketChip = chip('edge-pointer--bucket');
  const ndc = new THREE.Vector3();
  let t = 0, acc = 0, near = [], rects = [], rectAge = 0;
  const shown = { dead: null, bucket: null, marks: 0 };

  function placeChip(c, x, y, z, text, extraAvoid = []) {
    camera.updateMatrixWorld();
    ndc.set(x, y, z).project(camera);
    let nx = ndc.x, ny = ndc.y;
    const behind = ndc.z > 1;
    if (behind) { nx = -nx; ny = -ny; }
    const W = root.clientWidth, H = root.clientHeight;
    let px, py, onScreen = !behind && Math.abs(nx) < 0.94 && Math.abs(ny) < 0.94;
    if (onScreen) {
      // a tag over the bird: the chip sits 30 px above it, its arrow pointing down
      px = (nx * 0.5 + 0.5) * W; py = (-ny * 0.5 + 0.5) * H - 30;
      c.icon.style.transform = 'rotate(1.5708rad)';
    } else {
      const k = Math.max(Math.abs(nx) / 0.86, Math.abs(ny) / (ny > 0 ? 0.66 : 0.7), 1e-6);
      px = (nx / k * 0.5 + 0.5) * W; py = (-ny / k * 0.5 + 0.5) * H;
      c.icon.style.transform = `rotate(${Math.atan2(-ny, nx).toFixed(3)}rad)`;
    }
    if ((rectAge -= 1) <= 0) { rectAge = 20; rects = avoid ? avoid().map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0) : []; }
    const all = [...rects, ...extraAvoid];
    // the chip's size is measured when its text changes (no layout read every frame)
    if (text !== c.last || !c.w) { c.last = text; setText(c.text, text); c.el.hidden = false; c.w = c.el.offsetWidth || 120; c.h = c.el.offsetHeight || 28; }
    const hw = c.w / 2 + 4, hh = c.h / 2 + 4;
    // a tag over the bird moves sideways off a HUD card (it stays by its bird); an edge chip moves along the edge, always
    // the same way once it has moved (down past a card in the top half, up past one in the bottom half), so two cards
    // never bounce it back and forth
    let dir = 0;
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const r of all) {
        if (!(px + hw > r.left && px - hw < r.right && py + hh > r.top && py - hh < r.bottom)) continue;
        moved = true;
        if (onScreen) { px = (r.left + r.right) / 2 > W / 2 ? r.left - hw : r.right + hw; continue; }
        if (!dir) dir = (r.top + r.bottom) / 2 < H / 2 ? 1 : -1;
        py = dir > 0 ? r.bottom + hh : r.top - hh;
      }
      if (!moved) break;
    }
    px = Math.max(hw, Math.min(W - hw, px)); py = Math.max(hh, Math.min(H - hh, py));
    c.el.hidden = false;
    c.el.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) translate(-50%, -50%)`;
    return { px, py, onScreen };
  }
  const rectOf = (el) => (el && !el.hidden ? [el.getBoundingClientRect()] : []);

  return {
    deadChip: deadChip.el, bucketChip: bucketChip.el,
    /** on: a level is running (mode level, farm in level mode); panelOpen hides the chips (the markers stay). */
    update(dt, on, panelOpen) {
      t += dt;
      const p = ctx.player?.position, dead = ctx.flock?.dead, farm = ctx.farm;
      if (!on || !p || !dead) { this.hide(); return; }
      if ((acc -= dt) <= 0) { acc = 0.2; near = dead.near(p.x, p.z, 120); }
      const count = Math.max(0, Math.round(farm?.flock?.deadOnFloor ?? dead.count ?? 0));
      // markers over every dead bird within DEAD_MARK_M (positions refreshed 5 times a second)
      const still = reducedMotion();
      let n = 0;
      for (const d of near) {
        if (n >= MAX_MARKS) break;
        if (Math.hypot(d.x - p.x, d.z - p.z) > DEAD_MARK_M) continue;
        const bob = still ? 0 : Math.sin(t * 2.2 + d.id * 1.3) * 0.06;
        pos.set(d.x, 0.78 + bob, d.z);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, still ? 0.4 : t * 1.1 + d.id);
        m4.compose(pos, q, sc);
        marks.setMatrixAt(n++, m4);
      }
      marks.count = n; marks.visible = n > 0;
      if (n) marks.instanceMatrix.needsUpdate = true;
      shown.marks = n;
      // the bucket on the floor
      const b = ctx.props?.bucketDown;
      bucketMark.visible = !!b;
      if (b) { bucketMark.position.set(b.x, 0.95 + (still ? 0 : Math.sin(t * 2) * 0.05), b.z); bucketMark.rotation.y = still ? 0 : t * 0.9; }
      if (panelOpen) { deadChip.el.hidden = true; bucketChip.el.hidden = true; shown.dead = shown.bucket = null; return; }
      // the chip to the nearest dead bird: count and distance
      const first = near[0];
      if (count > 0 && first) {
        const m = Math.round(Math.hypot(first.x - p.x, first.z - p.z));
        const text = `${count} dead bird${count === 1 ? '' : 's'} · ${m < 1 ? 'at your feet' : `${m} m`}`;
        const at = placeChip(deadChip, first.x, 0.6, first.z, text, rectOf(jobPointer?.()));
        shown.dead = { text, metres: m, count, x: first.x, z: first.z, onScreen: at.onScreen };
      } else { deadChip.el.hidden = true; shown.dead = null; }
      // the bucket's chip while he is more than 3 m from it
      const bm = b ? Math.hypot(b.x - p.x, b.z - p.z) : 0;
      if (b && bm > 3) {
        const text = `Bucket · ${b.n} bird${b.n === 1 ? '' : 's'} · ${Math.round(bm)} m`;
        placeChip(bucketChip, b.x, 0.6, b.z, text, [...rectOf(jobPointer?.()), ...rectOf(deadChip.el)]);
        shown.bucket = { text, metres: Math.round(bm) };
      } else { bucketChip.el.hidden = true; shown.bucket = null; }
    },
    /** What is shown now (harness checks): { dead: { text, metres, count, x, z, onScreen } | null, bucket, marks }. */
    state() { return { dead: shown.dead ? { ...shown.dead } : null, bucket: shown.bucket ? { ...shown.bucket } : null, marks: shown.marks }; },
    hide() {
      marks.count = 0; marks.visible = false; bucketMark.visible = false;
      deadChip.el.hidden = true; bucketChip.el.hidden = true;
      shown.dead = shown.bucket = null; shown.marks = 0;
    },
  };
}
