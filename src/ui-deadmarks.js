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
import { AUTO, SPOTS, SPOTS2, DRINKER_LINES_Z } from './config.js';
import { openFaults, faultWords } from './farm-faults.js';
/** An open fault's place in the house (x, y, z) for its pill: a line's winch motor at the west end, the controller, the fan
 *  panel, the silos, the bird scale. */
const WINCH_X = -22.66;
export function faultSpotXYZ(spot) {
  const m = /^drinkers\.(\d)$/.exec(spot || '');
  if (m) return { x: WINCH_X, y: 2.25, z: DRINKER_LINES_Z[+m[1]] ?? 0 };
  const S = SPOTS[spot] || SPOTS2[spot];
  return S ? { x: S.x, y: 1.9, z: S.z } : null;
}
export const FAULT_PILL_M = 15;
// Skills update (SKILLS.md §3.10, §10; package "scene"): Biosecurity 3's symptom tags over the birds he walks past
// (flock.tags(): the nearest AUTO.tagMax within AUTO.tagM, inside) as small chips, kept off the HUD cards like the dead-bird
// chip; the CSS of the tag chip is added here once (the HUD's style sheet is frozen for this package)
const TAG_CSS = '.edge-pointer--tag { padding: 3px 9px 3px 7px; gap: 6px; font: 600 12px/1 var(--font-display); background: #f3ecd8; color: #23302a; border-color: #b9ab86; }'
  // the review round: an open equipment fault's pill over its place (a red dot and the short label)
  + ' .edge-pointer--fault { gap: 6px; font: 600 12.5px/1 var(--font-display); background: #2b1714; color: #ffe1db; border-color: #d0533f; }'
  + ' .edge-pointer--fault .tag-dot { width: 9px; height: 9px; border-radius: 50%; background: #ff4a33; box-shadow: 0 0 6px #ff4a33; flex: none; }'
  + ' .edge-pointer--tag .tag-dot { width: 8px; height: 8px; border-radius: 50%; background: #c8604a; flex: none; }'
  + ' .edge-pointer--tag.tag--gasp .tag-dot { background: #e08a2e; } .edge-pointer--tag.tag--sick .tag-dot { background: #8a7a52; }';
function addTagCss() {
  try {
    if (typeof document === 'undefined' || !document.head || document.getElementById('css-bird-tags')) return;
    const st = document.createElement('style'); st.id = 'css-bird-tags'; st.textContent = TAG_CSS; document.head.append(st);
  } catch { /* no style: the chips keep the edge-pointer look */ }
}

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
  // (no depth test: the bucket's marker shows over a wall or a pen rail between it and the camera)
  const bucketMark = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: BUCKET_COLOR, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
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
  addTagCss();
  const tagChips = Array.from({ length: AUTO.tagMax }, () => {
    const dot = h('span', { class: 'tag-dot' }), text = h('span');
    const el = h('div', { class: 'edge-pointer edge-pointer--tag', hidden: true, 'aria-hidden': 'true' }, dot, text);
    root.prepend(el);
    return { el, text, last: '', look: '', w: 0, h: 0 };
  });
  // the review round: one pill per open equipment fault within FAULT_PILL_M (the edge pointer's look; at the edge when off screen)
  const faultChips = [0, 1].map(() => {
    const dot = h('span', { class: 'tag-dot' }), icon = h('span', { class: 'edge-arrow', html: ICONS.arrow }), text = h('span');
    const el = h('div', { class: 'edge-pointer edge-pointer--fault', hidden: true, 'aria-hidden': 'true' }, icon, dot, text);
    root.prepend(el);
    return { el, icon, text, last: '', w: 0, h: 0 };
  });
  const ndc = new THREE.Vector3();
  let t = 0, acc = 0, near = [], rects = [], rectAge = 0, faultAcc = 0, faultList = [];
  const shown = { dead: null, bucket: null, marks: 0, tags: [], faults: [] };

  // review round: the tag sits over the bird's marker (not on it), keeps off the farmer's own figure and moves one way
  // past the HUD cards; once moved its arrow turns toward the bird
  const top = new THREE.Vector3();
  function placeChip(c, x, y, z, text, extraAvoid = []) {
    camera.updateMatrixWorld();
    ndc.set(x, y, z).project(camera);
    let nx = ndc.x, ny = ndc.y;
    const behind = ndc.z > 1;
    if (behind) { nx = -nx; ny = -ny; }
    const W = root.clientWidth, H = root.clientHeight;
    let px, py, onScreen = !behind && Math.abs(nx) < 0.94 && Math.abs(ny) < 0.94;
    const bx = (nx * 0.5 + 0.5) * W, by = (-ny * 0.5 + 0.5) * H;
    if (text !== c.last || !c.w) { c.last = text; setText(c.text, text); c.el.hidden = false; c.w = c.el.offsetWidth || 120; c.h = c.el.offsetHeight || 28; }
    if (onScreen) {
      // a tag over the bird: the chip's bottom just over the marker (1.15 m), its arrow pointing down at the bird
      top.set(x, 1.15, z).project(camera);
      px = bx; py = (-top.y * 0.5 + 0.5) * H - c.h / 2 - 2;
      c.icon.style.transform = 'rotate(1.5708rad)';
    } else {
      const k = Math.max(Math.abs(nx) / 0.86, Math.abs(ny) / (ny > 0 ? 0.66 : 0.7), 1e-6);
      px = (nx / k * 0.5 + 0.5) * W; py = (-ny / k * 0.5 + 0.5) * H;
      c.icon.style.transform = `rotate(${Math.atan2(-ny, nx).toFixed(3)}rad)`;
    }
    if ((rectAge -= 1) <= 0) { rectAge = 20; rects = avoid ? avoid().map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0) : []; }
    const all = [...rects, ...extraAvoid];
    // (the chip's size is measured when its text changes, above: no layout read every frame)
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
        if (onScreen) { if (!dir) dir = px < (r.left + r.right) / 2 ? -1 : 1; px = dir < 0 ? r.left - hw : r.right + hw; continue; }
        if (!dir) dir = (r.top + r.bottom) / 2 < H / 2 ? 1 : -1;
        py = dir > 0 ? r.bottom + hh : r.top - hh;
      }
      if (!moved) break;
    }
    px = Math.max(hw, Math.min(W - hw, px)); py = Math.max(hh, Math.min(H - hh, py));
    // a tag moved off its bird: the arrow turns toward the bird's own point on the screen
    if (onScreen && Math.abs(px - bx) > 8) c.icon.style.transform = `rotate(${Math.atan2(by - py, bx - px).toFixed(3)}rad)`;
    c.el.hidden = false;
    c.el.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) translate(-50%, -50%)`;
    return { px, py, onScreen };
  }
  const rectOf = (el) => (el && !el.hidden ? [el.getBoundingClientRect()] : []);
  /** The symptom tags: a chip just over each tagged bird, moved sideways off a HUD card (hidden off screen). */
  const tagP = new THREE.Vector3();
  function placeTags(list) {
    const W = root.clientWidth, H = root.clientHeight;
    const placed = [];
    tagChips.forEach((c, k) => {
      const g = list[k];
      if (!g) { c.el.hidden = true; return; }
      camera.updateMatrixWorld();
      tagP.set(g.x, 0.85, g.z).project(camera);
      if (tagP.z > 1 || Math.abs(tagP.x) > 0.97 || Math.abs(tagP.y) > 0.97) { c.el.hidden = true; return; }
      if (g.text !== c.last || !c.w) { c.last = g.text; setText(c.text, g.text); c.el.hidden = false; c.w = c.el.offsetWidth || 70; c.h = c.el.offsetHeight || 20; }
      if (g.look !== c.look) { c.el.classList.remove(`tag--${c.look}`); c.look = g.look; c.el.classList.add(`tag--${g.look}`); }
      let px = (tagP.x * 0.5 + 0.5) * W, py = (-tagP.y * 0.5 + 0.5) * H - c.h / 2;
      const hw = c.w / 2 + 3, hh = c.h / 2 + 3;
      if ((rectAge -= 1) <= 0) { rectAge = 20; rects = avoid ? avoid().map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0) : []; }
      let dir = 0;
      for (const r of [...rects, ...placed]) {
        if (!(px + hw > r.left && px - hw < r.right && py + hh > r.top && py - hh < r.bottom)) continue;
        if (r.tag) { py = r.top - hh; continue; }   // another tag: this one sits just above it
        if (!dir) dir = px < (r.left + r.right) / 2 ? -1 : 1;
        px = dir < 0 ? r.left - hw : r.right + hw;
      }
      px = Math.max(hw, Math.min(W - hw, px)); py = Math.max(hh, Math.min(H - hh, py));
      placed.push({ left: px - hw, right: px + hw, top: py - hh, bottom: py + hh, tag: true });
      c.el.hidden = false;
      c.el.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) translate(-50%, -50%)`;
    });
    shown.tags = list.slice(0, tagChips.length).map((g) => ({ index: g.index, look: g.look, text: g.text }));
  }
  const hideTags = () => { for (const c of tagChips) c.el.hidden = true; shown.tags = []; };
  const hideFaults = () => { for (const c of faultChips) c.el.hidden = true; shown.faults = []; };
  /** The farmer's own figure on the screen (his feet to his head, about ±40 px): no tag sits on him. */
  const fp = new THREE.Vector3();
  function farmerRect(p) {
    const W = root.clientWidth, H = root.clientHeight;
    fp.set(p.x, 0, p.z).project(camera); const fx = (fp.x * 0.5 + 0.5) * W, fy = (-fp.y * 0.5 + 0.5) * H;
    fp.set(p.x, 1.8, p.z).project(camera); const hy = (-fp.y * 0.5 + 0.5) * H;
    return fp.z > 1 ? [] : [{ left: fx - 40, right: fx + 40, top: Math.min(hy, fy) - 6, bottom: Math.max(hy, fy) + 4, width: 80 }];
  }

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
      if (panelOpen) { deadChip.el.hidden = true; bucketChip.el.hidden = true; shown.dead = shown.bucket = null; hideTags(); hideFaults(); return; }
      // the open equipment faults within 15 m: a pill over each place ("Line 3 winch stalled 08:56")
      if ((faultAcc -= dt) <= 0) {
        faultAcc = 0.5;
        let list = [];
        try { list = farm?.mode === 'level' && farm.auto ? openFaults(farm).map((f) => { const w = faultWords(f, ctx.env, farm), at = faultSpotXYZ(w.spot); return at ? { id: f.id, text: w.short || w.what, ...at } : null; }).filter(Boolean) : []; } catch { list = []; }
        faultList = list.filter((f) => Math.hypot(f.x - p.x, f.z - p.z) <= FAULT_PILL_M).slice(0, faultChips.length);
      }
      faultChips.forEach((c, k) => {
        const f = faultList[k];
        if (!f) { c.el.hidden = true; return; }
        // (over its place: past a HUD card sideways, never pushed off by the farmer's own figure)
        placeChip(c, f.x, f.y, f.z, f.text, [...rectOf(jobPointer?.()), ...faultChips.slice(0, k).filter((x) => !x.el.hidden).map((x) => x.el.getBoundingClientRect())]);
      });
      shown.faults = faultList.map((f) => ({ id: f.id, text: f.text }));
      // Biosecurity 3: the symptom tags of the birds he passes (none unless the perks hold passCheck: flock-tags.js)
      const tl = ctx.flock?.tags?.() || [];
      if (tl.length) placeTags(tl); else if (shown.tags?.length || tagChips.some((c) => !c.el.hidden)) hideTags();
      // the chip to the nearest dead bird: count and distance
      const first = near[0];
      if (count > 0 && first) {
        const m = Math.round(Math.hypot(first.x - p.x, first.z - p.z));
        const text = `${count} dead bird${count === 1 ? '' : 's'} · ${m < 1 ? 'at your feet' : `${m} m`}`;
        const at = placeChip(deadChip, first.x, 0.6, first.z, text, [...rectOf(jobPointer?.()), ...farmerRect(p)]);
        shown.dead = { text, metres: m, count, x: first.x, z: first.z, onScreen: at.onScreen };
      } else { deadChip.el.hidden = true; shown.dead = null; }
      // the bucket's chip while he is more than 3 m from it
      const bm = b ? Math.hypot(b.x - p.x, b.z - p.z) : 0;
      if (b && bm > 3) {
        const text = `Bucket · ${b.n} bird${b.n === 1 ? '' : 's'} · ${Math.round(bm)} m`;
        placeChip(bucketChip, b.x, 0.6, b.z, text, [...rectOf(jobPointer?.()), ...rectOf(deadChip.el), ...farmerRect(p)]);
        shown.bucket = { text, metres: Math.round(bm) };
      } else { bucketChip.el.hidden = true; shown.bucket = null; }
    },
    /** What is shown now (harness checks): { dead: { text, metres, count, x, z, onScreen } | null, bucket, marks }. */
    state() { return { dead: shown.dead ? { ...shown.dead } : null, bucket: shown.bucket ? { ...shown.bucket } : null, marks: shown.marks, tags: (shown.tags || []).map((g) => ({ ...g })), faults: (shown.faults || []).map((g) => ({ ...g })) }; },
    hide() {
      marks.count = 0; marks.visible = false; bucketMark.visible = false;
      deadChip.el.hidden = true; bucketChip.el.hidden = true;
      shown.dead = shown.bucket = null; shown.marks = 0;
      hideTags(); hideFaults();
    },
  };
}
