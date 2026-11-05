// The helper on arrival day (SKILLS.md §3.5 Brooding 3 `boxHelper`, §10; package "scene"). A farm worker (the catching
// crew's figure baked from the farmer rig, in farm clothes and a straw cap) appears by the chick truck once it has stopped,
// WAITS until the sample box is weighed (farm.stats.boxWeighedAt: the chick-weight rule's order holds), then each time the
// farmer picks up a stack (EV.BOX_PICK) takes the next stack not taken — in a bad batch only a stack the farmer has graded
// (farm.flock.stacks[i].graded: weak-graded and the cull box stay his) — wheels it on a hand truck through the door to the
// next part of the brooding floor not tipped yet (west to east), tips it (farm.act('chicks.tip', { stack, chicks, x, z,
// by: 'helper' }) and EV.BOX_TIP) and walks back: two stacks move at a time. He never grades, weighs or culls, has no
// collider and steps aside from the farmer; he walks off after the last stack. Nothing acts while the farm is quiet
// (farm.auto.quietN > 0: a standard start's ideal) or the perks do not hold boxHelper.
// createHelper(ctx, { mats, group, boxes, trucks, chicksPerStack }) -> { update(dt, farm, env), onPick(), serialize(),
//   restore(d), reset(), carried, get state(), get stack() }   (props.helper is { state, stack } of it)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPOTS2, BROOD_BOUNDS, HOUSE, SKILLS_UPDATE } from './config.js';
import { EV } from './events.js';
import { Batch } from './props-kit.js';
import { handTruck, boxesOnTruck } from './props-models.js';
import { buildFarmerModel } from './player-model.js';
import { reducedMotion } from './world-cond.js';

const SPEED = 2.6, PARTS = 6, TIP_SEC = 2.2, LOAD_SEC = 0.8;
const WAIT_AT = { x: SPOTS2.boxStacks.x + 2.6, z: SPOTS2.boxStacks.z + 1.3 };   // between the stacks and the truck's tail
const DOOR_OUT = { x: HOUSE.door.x + 0.35, z: HOUSE.door.z + 1.2 }, DOOR_IN = { x: HOUSE.door.x + 0.35, z: HOUSE.door.z - 1.0 };
const OFF_TO = { x: SPOTS2.truckStop.x + 2.5, z: SPOTS2.truckStop.z - 1.6 };
const PART_W = (BROOD_BOUNDS.xMax - BROOD_BOUNDS.xMin) / PARTS;
/** The brooding floor's part (0 west .. 5 east) of an x. */
export const partOf = (x) => Math.max(0, Math.min(PARTS - 1, Math.floor((x - BROOD_BOUNDS.xMin) / PART_W)));
const partSpot = (k) => ({ x: BROOD_BOUNDS.xMin + (k + 0.5) * PART_W, z: k % 2 ? 1.3 : -1.3 });

// the helper's figure in a pose: the farmer rig recoloured (a faded green shirt, dark trousers, dark rubber boots, a straw cap)
function helperGeometry(pose) {
  const model = buildFarmerModel();
  const j = model.joints;
  if (pose === 'bend') {
    j.spine.rotation.x = -0.8; j.neck.rotation.x = 0.4;
    j.shoulderL.rotation.set(1.25, 0, -0.15); j.shoulderR.rotation.set(1.25, 0, 0.15);
    j.hipL.rotation.x = 0.7; j.hipR.rotation.x = 0.7; j.kneeL.rotation.x = -1.0; j.kneeR.rotation.x = -1.0;
    j.pelvis.position.y -= 0.2;
  } else if (pose !== 'stand') {
    const s = pose === 'walkA' ? 1 : -1;
    j.hipL.rotation.x = 0.4 * s; j.hipR.rotation.x = -0.4 * s; j.kneeL.rotation.x = s > 0 ? -0.15 : -0.55; j.kneeR.rotation.x = s > 0 ? -0.55 : -0.15;
    // both hands on the hand truck's grip in front of him (the farmer's own hold of the boxes)
    j.shoulderL.rotation.set(0.95, 0, -0.12); j.shoulderR.rotation.set(0.95, 0, 0.12); j.elbowL.rotation.x = 0.55; j.elbowR.rotation.x = 0.55;
    j.spine.rotation.x = -0.1;
  } else { j.shoulderL.rotation.z = -0.08; j.shoulderR.rotation.z = 0.08; }
  model.root.updateMatrixWorld(true);
  const suit = new THREE.Color(0x3b6ea5), suitDark = new THREE.Color(0x2b5486), bootW = new THREE.Color(0xf0f0ea), bootRim = new THREE.Color(0xd6d8d0);
  const cap = new THREE.Color(0xf1ede2), capBrim = new THREE.Color(0xd8d0bb), capBand = new THREE.Color(0x2a4a73);
  const shirt = new THREE.Color(0x6f8f5a), shirtDark = new THREE.Color(0x56734a), trousers = new THREE.Color(0x3f4652), trousersDark = new THREE.Color(0x30353e);
  const boots = new THREE.Color(0x2f4a35), straw = new THREE.Color(0xd8b56a), strawDark = new THREE.Color(0xb8954e), band = new THREE.Color(0x6b3d2a);
  const LEGS = /^(pelvis|thigh|shin|foot)/;
  const geos = model.meshes.map((m) => {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const c = g.attributes.color, t = new THREE.Color(), legs = LEGS.test(m.name);
    const near = (a) => Math.abs(t.r - a.r) + Math.abs(t.g - a.g) + Math.abs(t.b - a.b) < 0.02;
    for (let i = 0; i < c.count; i++) {
      t.setRGB(c.getX(i), c.getY(i), c.getZ(i));
      let o = null;
      if (near(suit)) o = legs ? trousers : shirt;
      else if (near(suitDark)) o = legs ? trousersDark : shirtDark;
      else if (near(bootW) || near(bootRim)) o = boots;
      else if (near(cap)) o = straw;
      else if (near(capBrim)) o = strawDark;
      else if (near(capBand)) o = band;
      if (o) c.setXYZ(i, o.r, o.g, o.b);
    }
    g.deleteAttribute('normal');
    return g.index ? g.toNonIndexed() : g;
  });
  const g = mergeGeometries(geos);
  // the final check: the lowest point of every pose on the ground (the walk poses' swinging legs lifted both boots about
  // 2.5 cm, the bend pose's lowered pelvis sank them 14 cm), so his feet stay on the floor, the kerb and the threshold
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  g.computeVertexNormals();
  return g;
}

export function createHelper(ctx, { mats, group, boxes, trucks, chicksPerStack }) {
  const mat = mats.out || mats.vc;
  const root = new THREE.Group();
  root.name = 'props-helper'; root.visible = false;
  group.add(root);
  const poses = {};
  for (const p of ['stand', 'walkA', 'walkB', 'bend']) {
    const m = new THREE.Mesh(helperGeometry(p), mat);
    m.name = `props-helper-${p}`; m.castShadow = true; m.receiveShadow = true; m.visible = p === 'stand';
    root.add(m); poses[p] = m;
  }
  const cart = (loaded) => {
    const b = new Batch(); handTruck(b, { tilt: -0.45 }); if (loaded) boxesOnTruck(b, 10, -0.45);
    const m = b.mesh(mats.vc, { cast: false, receive: true });
    m.name = loaded ? 'props-helper-cart-full' : 'props-helper-cart'; m.position.set(0, 0.08, -1.15); m.visible = false;
    root.add(m);
    return m;
  };
  const cartFull = cart(true), cartEmpty = cart(false);

  const st = { state: 'off', stack: -1, want: 0, x: WAIT_AT.x, z: WAIT_AT.z, yaw: 0, path: [], t: 0, walkT: 0, tipAt: null, side: 0, tips: 0 };
  const tipped = new Set();       // parts of the brooding floor with chicks tipped on them (any tip)
  const reserved = new Set();     // the part the helper is on his way to
  const isLevel = () => ctx.farm?.mode === 'level';
  const perk = () => !!(SKILLS_UPDATE.live && ctx.perks?.has?.('boxHelper'));
  const quiet = () => (ctx.farm?.auto?.quietN || 0) > 0;
  const badBatch = () => ctx.farm?.condition === 'badChicks';
  const graded = (i) => !!ctx.farm?.flock?.stacks?.[i]?.graded;
  const stackFree = (s) => s.state === 'ground' && (!badBatch() || graded(s.i));
  const stacksLeft = () => boxes.stacks.some((s) => s.state === 'truck' || s.state === 'ground' || s.state === 'reserved');

  function go(to, ...pts) { st.path = pts.map((p) => ({ x: p.x, z: p.z })); st.state = to; }
  function nextPart() {
    for (let k = 0; k < PARTS; k++) if (!tipped.has(k) && !reserved.has(k)) return k;
    for (let k = 0; k < PARTS; k++) if (!reserved.has(k)) return k;   // every part has chicks: the westmost again
    return 0;
  }
  function take() {
    const s = boxes.stacks.find(stackFree);
    if (!s) return false;
    st.want--; st.stack = s.i; s.state = 'reserved';
    go('to-stack', { x: s.x, z: s.z + 0.75 });
    return true;
  }
  function tip(farm) {
    const s = boxes.stacks[st.stack];
    const x = st.x - Math.sin(st.yaw) * 0.6, z = st.z - Math.cos(st.yaw) * 0.6;
    if (s) s.state = 'tipped';        // before the action: props' listener only handles other tips
    const r = farm.act('chicks.tip', { stack: st.stack, chicks: chicksPerStack, x: +x.toFixed(2), z: +z.toFixed(2), by: 'helper' });
    ctx.events?.emit(EV.BOX_TIP, { stack: st.stack, chicks: chicksPerStack, x, z, by: 'helper' });
    if (!boxes.tipping) boxes.startTip(st.stack, st.x, st.z, st.yaw); else boxes.pile += 10;
    st.tips++;
    reserved.clear();
    return r;
  }

  // the farmer's own picks and every tip (his, the helper's, a goto's) mark the parts of the floor
  if (ctx.events) {
    ctx.events.on(EV.BOX_PICK, () => { if (isLevel() && st.state !== 'off' && st.state !== 'gone' && st.state !== 'leaving') st.want++; });
    ctx.events.on(EV.BOX_TIP, (p) => { if (p && Number.isFinite(p.x)) tipped.add(partOf(p.x)); });
    ctx.events.on(EV.ACTION, (p) => { if (p && p.id === 'chicks.tip' && Number.isFinite(p.x) && p.result?.placed > 0) tipped.add(partOf(p.x)); });
  }

  function walk(dt, farm) {
    const tgt = st.path[0];
    if (!tgt) return true;
    const dx = tgt.x - st.x, dz = tgt.z - st.z, d = Math.hypot(dx, dz);
    if (d < 0.12) { st.path.shift(); return st.path.length === 0; }
    const stepLen = Math.min(d, SPEED * dt);
    st.x += (dx / d) * stepLen; st.z += (dz / d) * stepLen;
    st.yaw = Math.atan2(-dx, -dz);
    st.walkT += dt;
    // no collider: he steps aside from the farmer (never in his way)
    const p = ctx.player?.position;
    if (p) {
      const fx = st.x - p.x, fz = st.z - p.z, fd = Math.hypot(fx, fz);
      if (fd < 0.9 && fd > 1e-3) { const k = Math.min(0.9 - fd, 2.5 * dt); st.x += (fx / fd) * k; st.z += (fz / fd) * k; }
    }
    void farm;
    return false;
  }

  function step(dt, farm, env) {
    const chickTruck = trucks.st.chicks;
    if (st.state === 'off') {
      if (perk() && !quiet() && chickTruck.state === 'parked' && (env.dayNumber ?? 0) <= 1 && stacksLeft()) {
        st.x = OFF_TO.x; st.z = OFF_TO.z; st.want = 0;
        go('arriving', WAIT_AT);
      }
      return;
    }
    if (st.state === 'gone') return;
    if (!perk() && st.state !== 'leaving' && st.stack < 0) { go('leaving', OFF_TO); return; }
    st.t += dt;
    switch (st.state) {
      case 'arriving': if (walk(dt, farm)) st.state = farm.stats?.boxWeighedAt != null ? 'ready' : 'waiting'; break;
      case 'waiting': if (farm.stats?.boxWeighedAt != null) st.state = 'ready'; break;
      case 'ready':
        if (!stacksLeft()) { go('leaving', OFF_TO); break; }
        if (st.want > 0 && !quiet()) take();
        break;
      case 'to-stack':
        if (walk(dt, farm)) {
          const s = boxes.stacks[st.stack];
          if (!s || s.state !== 'reserved') { st.stack = -1; go('back', WAIT_AT); break; }
          s.state = 'carried'; st.t = 0; st.state = 'loading';
        }
        break;
      case 'loading':
        if (st.t > LOAD_SEC) { const k = nextPart(); reserved.add(k); st.tipAt = partSpot(k); go('carrying', DOOR_OUT, DOOR_IN, st.tipAt); }
        break;
      case 'carrying': if (walk(dt, farm)) { st.t = 0; st.state = 'tipping'; tip(farm); } break;
      case 'tipping': if (st.t > TIP_SEC) { st.stack = -1; go('back', DOOR_IN, DOOR_OUT, WAIT_AT); } break;
      case 'back': if (walk(dt, farm)) st.state = 'ready'; break;
      case 'leaving': if (walk(dt, farm)) { st.state = 'gone'; st.want = 0; } break;
      default:
    }
  }

  function draw() {
    const shown = st.state !== 'off' && st.state !== 'gone';
    root.visible = shown;
    if (!shown) return;
    const moving = st.path.length > 0 && st.state !== 'waiting' && st.state !== 'ready';
    const still = reducedMotion();
    const withCart = ['to-stack', 'loading', 'carrying', 'tipping', 'back'].includes(st.state);
    const pose = st.state === 'tipping' || st.state === 'loading' ? 'bend' : moving && withCart ? (Math.floor(st.walkT * 3.2) % 2 ? 'walkB' : 'walkA') : 'stand';
    for (const [k, m] of Object.entries(poses)) m.visible = k === pose;
    // (the final check: no bob of the whole figure: it lifted the boots and the hand truck's wheels off the ground)
    root.position.set(st.x, 0, st.z);
    void still;
    root.rotation.y = st.yaw;
    cartFull.visible = withCart && (st.state === 'carrying' || (st.state === 'loading' && st.t > LOAD_SEC / 2));
    cartEmpty.visible = withCart && !cartFull.visible;
  }

  const api = {
    root, poses, cartFull, cartEmpty,
    get state() { return st.state; },
    get stack() { return st.stack; },
    get want() { return st.want; },
    get tips() { return st.tips; },
    get position() { return { x: +st.x.toFixed(2), z: +st.z.toFixed(2) }; },
    /** The stack he holds now (props.serialize writes it back to the ground). */
    get carried() { return ['to-stack', 'loading', 'carrying'].includes(st.state) ? st.stack : -1; },
    update(dt, farm, env) { if (!isLevel()) { root.visible = false; return; } step(dt, farm, env); draw(); },
    reset() { st.state = 'off'; st.stack = -1; st.want = 0; st.path = []; st.tips = 0; tipped.clear(); reserved.clear(); root.visible = false; },
    serialize() { return st.state === 'off' ? null : { state: st.state, want: st.want, tips: st.tips, parts: [...tipped], x: +st.x.toFixed(2), z: +st.z.toFixed(2) }; },
    /** A save made mid-carry: the stack is back on the ground (props.serialize) and he waits at the stacks again. */
    restore(d) {
      api.reset();
      if (!d || !d.state) return;
      for (const k of d.parts || []) tipped.add(k);
      st.want = Math.max(0, d.want | 0); st.tips = d.tips | 0;
      if (d.state === 'gone' || d.state === 'leaving') { st.state = 'gone'; return; }
      st.x = WAIT_AT.x; st.z = WAIT_AT.z; st.state = d.state === 'waiting' || d.state === 'arriving' ? 'waiting' : 'ready';
      for (const s of boxes.stacks) if (s.state === 'reserved') s.state = 'ground';
    },
  };
  return api;
}
