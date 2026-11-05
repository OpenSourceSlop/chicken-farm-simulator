// Phase 2 props and triggers in the house and on the farm: litter (bare concrete -> husk), the
// litter heap and wheelbarrow, chick truck and box stacks, sample table, hand and bird scales,
// water supply and flush valves, the leaking nipple and wet patch, feeder box, silo gauge, office
// desk, dead bird bin, the new sign boards, the floor thermometer overlay, and the foot dip /
// house door / floor cell triggers. Owner: package "props" (phase2/props).
//
// buildProps(ctx, { house, world }) -> props
//   ctx.farm, ctx.events, ctx.interact are set (main.js); ctx.player and ctx.flock are set right
//   after (the farmer is created after the props, so they are read in update, not at build time);
//   ctx.colliders is the farmer's collider array: props adds its entries in level mode only and
//   takes them out again in the sandbox.
//   Everything props draws is hidden in the sandbox (farm.mode 'off'): the Phase 1 farm looks
//   exactly as before. Pieces: props-floor (floor states, overlay), props-boards (signs, facts
//   tabs), props-equip (water supply, regulators, feeder box, silo gauge), props-yard (heap,
//   barrow, sacks, sample table, dead bin, office desk, bird scale), props-truck (chick and feed
//   trucks, driver), props-boxes (chick boxes), props-triggers, props-fx; player-carry.js draws
//   what the farmer holds.
//   update(dt, env, view)   every frame after the house (view as house.update gets it)
//   setOverlay(name, on)    'floorTemp': the floor thermometer view (unlock floorOverlay)
//   highlight(ids)          orange 'facts' tab on these boards / plates; [] clears
//   overlay                 { floorTemp: boolean }
//   carrying                null | 'barrow' | 'sack' | 'boxes' | 'bucket' | 'frame' | 'chick'
//   carryOpts               { stack } boxes, { n, causes } bucket, { depthCm } barrow, { index } chick
//   startCarry(kind, opts)  THE only way anything is carried (ui, flock and props call it): sets
//                           carrying, calls player.carry(kind) for the mesh, emits EV.CARRY
//                           { kind, opts }. 'bucket' adds opts.n / opts.causes to what is carried.
//   drop()                  hands empty: player.carry(null), EV.CARRY { kind: null }
//   The farmer's request during Phase 4 (PHASE4.md §15.3): the dead-bird bucket never locks him out.
//   bucketDown              null | { x, z, n, causes, inside } the bucket standing where he set it down
//   setBucketDown({ auto }) G (or a two-handed task: auto) sets the carried bucket down at his feet: EV.BUCKET
//   pickUpBucket()          E at the bucket on the floor: carried again (its birds with it)
//   handsBusy(kind)         carrying something other than the bucket (and other than `kind`): what one hand
//                           cannot do; every Take key and provider that needs hands asks it
//   startCarry(kind) of another kind while carrying the bucket sets the bucket down first (auto); a dead bird
//   picked up while the bucket stands on the floor goes into that bucket (EV.BUCKET { into: true })
//   Providers (PHASE2.md §13.3): 'tip' (carrying boxes, inside BROOD_BOUNDS, priority 20),
//   'patch' (carrying a sack, on litter, 20), 'frame' (carrying the frame, inside BROOD_BOUNDS,
//   20: flock.catchGroup then EV.FRAME_SET); fixed 'brooder-0..7' (enabled while that brooder is
//   out), 'leak' (enabled while the leak exists), 'box-stack-0..5', 'dead-bin' (with the bucket).
//   truck                   { state: 'away'|'driving-in'|'parked'|'leaving', arrive(), leave() }
//                           the chick truck; it also comes by itself on EV.FARM_DELIVERY
//                           { kind: 'chicks', phase: 'arrive' } and the feed truck on kind 'feed'
//   stacks                  { left: number } box stacks not yet carried in
//   reset()                 back to the level's prep-day look (bare floor, heap, no truck)
//   serialize() / restore(d)  what the save needs that the farm model does not hold
import * as THREE from 'three';
import { EV } from './events.js';
import { SPOTS2, SPOTS4, HEATERS, DRINKER_LINES_Z, BROOD_BOUNDS, LEVEL1, FLOOR_GRID } from './config.js';
import { Batch, makePropMaterials, createBoxPool } from './props-kit.js';
import { withOcclusionFade } from './world-util.js';
import { buildFloorStates } from './props-floor.js';
import { buildBoards, boardFrame } from './props-boards.js';
import { buildEquipment } from './props-equip.js';
import { buildYard } from './props-yard.js';
import { buildTrucks } from './props-truck.js';
import { buildBoxes } from './props-boxes.js';
import { createTriggers } from './props-triggers.js';
import { createFx } from './props-fx.js';
// Phase 3 (package "scene", PHASE3.md §12): the cycle's equipment, yard, catching night, tools, dust
import { FEED_TYPES, HOUSE } from './config.js';
import { buildCycleEquipment } from './props-cycle-equip.js';
import { buildCycleYard } from './props-cycle-yard.js';
import { buildCatch, CATCH_STOPS } from './props-catch.js';
import { createCycleTools } from './props-tools.js';
import { buildDust } from './props-air.js';
import { OVERLAYS } from './props-overlay.js';
import { bucket as bucketModel } from './props-models.js'; // PHASE4.md §15.3: the bucket set down on the floor
// Skills update (SKILLS.md §3.10, §10; package "scene"): the tally bucket, the equipment of level 3, the arrival-day helper
import { AUTO, SKILLS_UPDATE } from './config.js';
import { binShare, birdKgOf, bucketRoom, bucketCopy, putInBucket } from './props-tally.js';
import { tallyFace } from './player-carry.js';
import { buildAutoEquipment } from './props-auto.js';
import { createHelper } from './props-helper.js';

const CHICKS_PER_STACK = (LEVEL1.boxes / LEVEL1.stacks) * LEVEL1.chicksPerBox;
const inBrood = (p) => p.x > BROOD_BOUNDS.xMin && p.x < BROOD_BOUNDS.xMax && p.z > BROOD_BOUNDS.zMin && p.z < BROOD_BOUNDS.zMax;

export function buildProps(ctx, { house } = {}) {
  const group = new THREE.Group();
  group.name = 'props';
  group.visible = false;
  ctx.scene.add(group);
  const ev = ctx.events;
  const emit = (t, p) => ev && ev.emit(t, p);
  const farm = () => ctx.farm;

  const mats = makePropMaterials();
  // outdoor and indoor static props: the world's occlusion-faded flat material (same program)
  mats.out = withOcclusionFade(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'occ-flat');
  const pool = createBoxPool(new THREE.MeshLambertMaterial({ color: 0xffffff }), 400);
  group.add(pool.mesh);

  const stat = new Batch();
  const boards = buildBoards(stat);
  group.add(boards.group);
  const equip = buildEquipment(stat, pool, group);
  const autoEq = buildAutoEquipment(ctx, { pool, mats, group });   // Skills update: the sight tubes, winches, sensor, scale
  const yard = buildYard(stat, mats, group);
  const equip3 = buildCycleEquipment(stat, pool, group);
  const yard3 = buildCycleYard(stat, pool, group, mats);
  const statMesh = stat.mesh(mats.out, { cast: true, receive: true });
  statMesh.name = 'props-static';
  group.add(statMesh);
  const floor = buildFloorStates(ctx, house, group);
  const trucks = buildTrucks(mats, group);
  const catchNight = buildCatch(mats, group);
  const dust = buildDust(group);
  const boxes = buildBoxes(mats.vc, group);
  // Skills update (SKILLS.md §3.5, Brooding 3): the helper who tips stacks with the farmer on arrival day
  const helper = createHelper(ctx, { mats, group, boxes, trucks, chicksPerStack: CHICKS_PER_STACK });
  // PHASE4.md §15.3: the dead-bird bucket where the farmer set it down (with its birds showing)
  const floorBucketB = new Batch(); bucketModel(floorBucketB, { dead: true });
  const floorBucket = floorBucketB.mesh(mats.vc, { cast: true });
  floorBucket.name = 'props-bucket-down';
  floorBucket.visible = false;
  group.add(floorBucket);
  { const face = tallyFace.make(); if (face) floorBucket.add(face); }   // Skills update: the tally's counter on its rim
  const fx = createFx(pool);
  const triggers = createTriggers(ctx, fx);
  const tabSpots = new Map([...boards.tabSpots, ...equip.tabSpots, ...yard.tabSpots, ...equip3.tabSpots, ...yard3.tabSpots]);
  boards.tabSpots.clear();
  for (const [k, v] of tabSpots) boards.tabSpots.set(k, v);

  // ---------------- state ----------------
  const st = { level: false, delivered: false, frameAt: null, feedWait: 0, chickLeaveWait: -1, lastPaint: null, colliders: [] };

  const isLevel = () => !!(ctx.farm && ctx.farm.mode === 'level');
  const pl = () => ctx.player;

  // ---------------- carrying ----------------
  function showCarry(kind) {
    yard.barrow.visible = kind !== 'barrow';
    yard.spareBucket.visible = kind !== 'bucket' && !props.bucketDown;
    yard.scaleKit.visible = kind !== 'frame';
  }

  function dropHands() {
    props.carrying = null; props.carryOpts = null;
    ctx.player?.carry?.(null);
    showCarry(null);
    ctx.events?.emit(EV.CARRY, { kind: null, opts: null });
  }

  // ---------------- interactables ----------------
  const reg = (it) => ctx.interact && ctx.interact.add(it);
  const lv = () => st.level;
  for (const it of boards.interactables) reg({ ...it, enabled: lv });
  // Phase 4: the power cut board by the generator, read in the rainy season only (the ui opens the sign panel
  // registered under 'sign-power', content-signs-cond.js BOARDS_COND)
  reg({ id: 'sign-power', label: SPOTS4.signPower.label, x: SPOTS4.signPower.x, z: SPOTS4.signPower.z, radius: 2.0, inside: false, verb: 'Read the',
    enabled: () => st.level && ctx.farm?.condition === 'rainy' });
  const panel = (id, spot, radius, extra = {}) => reg({ id, label: spot.label, x: spot.x, z: spot.z, radius, inside: spot.inside, enabled: lv, ...extra });
  panel('feeder-box', SPOTS2.feederBox, 2.0, { verb: 'Use the' });
  panel('water-supply', SPOTS2.waterSupply, 1.8, { verb: 'Use the' });
  SPOTS2.drinkers.forEach((d, i) => panel(`drinker-${i}`, d, 1.3, { verb: 'Set' }));
  panel('silo', SPOTS2.silo, 2.2, { verb: 'Read the' });
  panel('office-desk', SPOTS2.officeDesk, 2.2, { verb: 'Use the' });
  // the chick table's panel while its sample box stands (day 0: placement, the grading, a bad batch's claim): no prompt at
  // the door on later days (Phase 5 integration: the catching night showed "Use the chick sample table" there)
  panel('chick-table', SPOTS2.chickTable, 1.8, { verb: 'Use the', enabled: () => st.level && st.delivered && (ctx.env?.dayNumber ?? 0) <= 0 });
  panel('bird-scale', SPOTS2.birdScale, 1.8, { verb: 'Use the' });
  panel('litter-heap', SPOTS2.litterHeap, 2.4, { verb: 'Use the' });
  boxes.stacks.forEach((s) => reg({
    id: `box-stack-${s.i}`, label: `chick boxes (stack ${s.i + 1})`, verb: 'Pick up', x: s.x, z: s.z, radius: 0.95, inside: false,
    enabled: () => st.level && s.state === 'ground' && !props.handsBusy('boxes'),
    use() {
      s.state = 'carried';
      props.startCarry('boxes', { stack: s.i });
      emit(EV.BOX_PICK, { stack: s.i, chicks: CHICKS_PER_STACK });
      pl()?.pose?.('crouch', 0.6);
    },
  }));
  const countIntoBin = () => {
    const o = props.carryOpts || { n: 0, causes: {} };
    if (!SKILLS_UPDATE.live) {
      const n = o.n || 0, causes = { ...(o.causes || {}) };
      ctx.farm?.act('dead.count', { n, causes });
      emit(EV.DEAD_DROP, { n, causes });
      props.drop();
      return;
    }
    // Skills update (SKILLS.md §3.10): the bin counts only what the tally did not count at pickup (no bird twice); the
    // bucket is emptied whole (r-dead-am / r-dead-pm's dead-cleared as before)
    const share = binShare(o), counted = Math.max(0, Math.round(o.counted || 0));
    if (share.n > 0) ctx.farm?.act('dead.count', { n: share.n, causes: share.causes, at: 'bin' });
    emit(EV.DEAD_DROP, { n: share.dropped, causes: { ...(o.causes || {}) }, counted });
    props.drop();
  };
  reg({
    id: 'dead-bin', label: SPOTS2.deadBin.label, verb: 'Count into the', x: SPOTS2.deadBin.x, z: SPOTS2.deadBin.z, radius: 1.5, inside: false,
    enabled: () => st.level && props.carrying === 'bucket',
    // Phase 3: with "dead birds by look" unlocked (skills deadByLook) E opens the panels package's
    // dead-bin panel (no use(): the ui opens the panel registered under the id), which counts them
    get use() { return ctx.skills?.unlocked?.('deadByLook') ? undefined : countIntoBin; },
  });
  // PHASE4.md §15.3 (b): E at the bucket on the floor picks it up again (16 within 0.9 m: it beats the board behind it)
  ctx.interact?.addProvider?.('bucket', (p, inside) => {
    const b = props.bucketDown;
    if (!st.level || !b || props.handsBusy('bucket') || b.inside !== !!inside) return null;
    return { id: 'bucket', label: `bucket (${b.n} dead bird${b.n === 1 ? '' : 's'})`, verb: 'Pick up the', x: b.x, z: b.z, radius: 1.4, inside: b.inside,
      priority: 7, nearRadius: 0.9, nearPriority: 16, use: () => props.pickUpBucket() };
  });
  const leakSpot = () => {
    const lk = ctx.farm?.water?.leak;
    if (!lk) return null;
    const line = lk.line ?? 0;
    return { line, x: lk.x, z: DRINKER_LINES_Z[line] ?? 0 };
  };
  const leakIt = reg({
    id: 'leak', label: 'leaking nipple', verb: 'Replace the', x: 0, z: 0, radius: 1.4, inside: true,
    enabled: () => st.level && !!leakSpot(),
    use() {
      const s = leakSpot();
      if (!s) return;
      ctx.farm.act('water.fixLeak', { line: s.line, x: s.x });
      pl()?.pose?.('reach', 1.2);
    },
  });
  HEATERS.forEach((h, i) => reg({
    id: `brooder-${i}`, label: `brooder ${i + 1} (not burning)`, verb: 'Relight', x: h.x, z: h.z, radius: 1.7, inside: true,
    enabled: () => st.level && (ctx.env?.brooderOut || []).includes(i),
    use() { ctx.farm?.act('heat.relight', { index: i }); pl()?.pose?.('reach', 1.4); },
  }));
  // providers
  if (ctx.interact) {
    ctx.interact.addProvider('tip', (p, inside) => {
      if (!st.level || props.carrying !== 'boxes' || !inside || !inBrood(p) || boxes.tipping) return null;
      return { id: 'tip', label: 'the chicks out of the boxes here', verb: 'Tip', x: p.x, z: p.z, radius: 1, priority: 20, use: tipHere };
    });
    ctx.interact.addProvider('patch', (p, inside) => {
      if (!st.level || props.carrying !== 'sack' || !inside) return null;
      const L = ctx.farm?.litter;
      const cx = Math.floor((p.x - FLOOR_GRID.x0) / FLOOR_GRID.cell), cz = Math.floor((p.z - FLOOR_GRID.z0) / FLOOR_GRID.cell);
      const cov = L && L.coverGrid ? L.coverGrid[cz * FLOOR_GRID.nx + cx] ?? 0 : 1;
      if (cov < 0.3) return null;
      // standing at the wet patch the leak made: the husk goes on it (its cell centre)
      const def = LEVEL1.problems.find((q) => q.id === 'leaking-nipple');
      const lp = def && ctx.farm?.problems?.find((q) => q.id === 'leaking-nipple');
      const lx = def ? def.x : 0, lz = def ? DRINKER_LINES_Z[def.line] : 0;
      const onLeak = !!(lp && lp.startedAt != null && Math.hypot(p.x - lx, p.z - lz) <= 1.5);
      const at = onLeak ? { x: lx, z: lz } : { x: p.x, z: p.z };
      return {
        id: 'patch', label: onLeak ? 'fresh litter on the wet patch' : 'fresh litter here', verb: 'Spread', x: at.x, z: at.z, radius: onLeak ? 1.6 : 1, priority: 20,
        use() { ctx.farm?.act('litter.patch', at); pl()?.pose?.('crouch', 1.0); props.drop(); },
      };
    });
    ctx.interact.addProvider('frame', (p, inside) => {
      if (!st.level || props.carrying !== 'frame' || !inside || !inBrood(p) || st.frameAt) return null;
      // at the bird scale E opens it (put the scale and frame back), not another frame
      if (Math.hypot(p.x - SPOTS2.birdScale.x, p.z - SPOTS2.birdScale.z) < 1.8) return null;
      return { id: 'frame', label: 'the catching frame here', verb: 'Set down', x: p.x, z: p.z, radius: 1, priority: 20, use: setFrame };
    });
  }

  function tipHere() {
    const p = pl().position, yaw = pl().yaw ?? 0;
    const stack = props.carryOpts?.stack ?? 0;
    // the boxes go down in front of him
    const x = p.x - Math.sin(yaw) * 0.2, z = p.z - Math.cos(yaw) * 0.2;
    const s = boxes.stacks[stack];
    if (s) s.state = 'tipped';       // before the action: the listener below only handles other tips
    ctx.farm?.act('chicks.tip', { stack, chicks: CHICKS_PER_STACK, x, z });
    emit(EV.BOX_TIP, { stack, chicks: CHICKS_PER_STACK, x, z });
    boxes.startTip(stack, p.x, p.z, yaw);
    pl()?.pose?.('crouch', 1.8);
    props.drop();
  }

  function setFrame() {
    const p = pl().position, yaw = pl().yaw ?? 0;
    const x = p.x - Math.sin(yaw) * 0.95, z = p.z - Math.cos(yaw) * 0.95;
    let birds = [];
    try { birds = ctx.flock?.catchGroup?.(x, z, 10) || []; } catch (err) { console.error(err); }
    st.frameAt = { x, z };
    yard.frameSet.position.set(x, 0.03, z);
    yard.frameSet.rotation.y = yaw;
    yard.frameSet.visible = true;
    pl()?.carry?.('scale');           // the frame is on the floor; the scale stays in his hand
    pl()?.pose?.('crouch', 1.0);
    emit(EV.FRAME_SET, { x, z, birds: birds.map((b) => (typeof b === 'number' ? b : b.index)) });
  }
  function pickFrame() {
    if (!st.frameAt) return;
    st.frameAt = null;
    yard.frameSet.visible = false;
    if (props.carrying === 'frame') pl()?.carry?.('frame');
  }
  if (ev) {
    ev.on(EV.PANEL_CLOSE, () => pickFrame());
    // a stack tipped without the hand truck (level.debug.goto auto, farm-profiles): its boxes go
    // straight to the pile of empties, so the yard matches the farm
    ev.on(EV.ACTION, (p) => {
      if (!isLevel() || p.id !== 'chicks.tip' || !(p.result?.placed > 0)) return;
      const s = boxes.stacks[p.stack];
      if (!s || s.state === 'tipped') return;
      if (props.carrying === 'boxes' && props.carryOpts?.stack === p.stack) props.drop();
      s.state = 'tipped';
      boxes.pile += LEVEL1.boxes / LEVEL1.stacks;
    });
    ev.on(EV.FARM_DELIVERY, (d) => {
      if (!isLevel() || !d) return;
      if (d.kind === 'chicks' && d.phase === 'arrive') props.truck.arrive();
      else if (d.kind === 'chicks' && d.phase === 'leave') props.truck.leave();
      else if (d.kind === 'feed' && d.phase === 'arrive') {
        // Phase 3: a feed type goes to its own silo (FEED_TYPES); Phase 2's delivery has no type
        const ft = d.type ? FEED_TYPES.find((t) => t.id === d.type) : null;
        trucks.arrive('feed', false, { silo: ft ? ft.silo : null }); st.feedWait = 14;
      }
      else if (d.kind === 'feed' && d.phase === 'leave') trucks.leave('feed');
    });
  }

  // ---------------- Phase 3 tools and interactables (created once `props` exists, below) ----------------
  let tools = null;
  if (ev) {
    ev.on(EV.FARM_DELIVERY, (d) => {
      if (!isLevel() || !d || d.kind !== 'catch') return;
      if (d.phase === 'arrive') { catchNight.arrive(0); catchNight.arrive(1); }
      else if (d.phase === 'leave') { if (d.truck == null) { catchNight.leave(0); catchNight.leave(1); } else catchNight.leave(d.truck); }
    });
  }
  // the door shut while the clean house rests
  const d = HOUSE.door;
  const doorShut = { type: 'box', minX: d.x - d.width / 2 - 0.1, maxX: d.x + d.width / 2 + 0.1, minZ: HOUSE.door.z - 0.2, maxZ: HOUSE.door.z + 0.25 };
  const catchCollider = (i) => {
    const t = catchNight.trucks[i];
    if (t.state !== 'parked') return null;
    const s = CATCH_STOPS[i];
    return { type: 'box', minX: s.x - 7.7, maxX: s.x + 3.65, minZ: s.z - 1.25, maxZ: s.z + 1.25 };
  };

  // ---------------- colliders (level mode only) ----------------
  const staticColliders = [...equip.colliders, ...yard.colliders, ...equip3.colliders, ...yard3.colliders];
  function syncColliders() {
    const list = ctx.colliders;
    if (!list) return;
    const shut = !!ctx.farm?.house?.closed;
    const want = st.level ? [...staticColliders, trucks.collider('chicks'), trucks.collider('feed'), catchCollider(0), catchCollider(1), shut ? doorShut : null].filter(Boolean) : [];
    const same = want.length === st.colliders.length && want.every((c, i) => c === st.colliders[i] || JSON.stringify(c) === JSON.stringify(st.colliders[i]));
    if (same) return;
    for (const c of st.colliders) { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); }
    st.colliders = want;
    list.push(...want);
  }
  let colliderTimer = 0;

  // ---------------- per frame ----------------
  const lineY = [0.3, 0.3, 0.3, 0.3];
  const leakPos = { x: 0, y: 0, z: 0 };

  function update(dt, env, view) {
    const level = isLevel();
    if (level !== st.level) { st.level = level; group.visible = level; colliderTimer = 0; if (!level) triggers.reset(); }
    floor.update(dt, ctx.farm || {}, level, OVERLAYS.find((k) => props.overlay[k]) || null, env);
    colliderTimer -= dt;
    if (colliderTimer <= 0) { colliderTimer = 0.25; syncColliders(); }
    if (!level) { floorBucket.visible = false; return; }
    const f = ctx.farm;
    const bd = props.bucketDown;
    floorBucket.visible = !!bd;
    if (bd) floorBucket.position.set(bd.x, bd.inside ? 0.02 : 0, bd.z);
    // Skills update (SKILLS.md §10): the tally's digits on the bucket's rim while Biosecurity 2's tally bucket holds
    if (SKILLS_UPDATE.live) { const t = props.bucketTally; tallyFace.set(t.n, t.full, t.on); } else tallyFace.set(0, false, false);
    triggers.update(dt, true);
    if (house && house.lineHeights) for (let i = 0; i < 4; i++) lineY[i] = house.lineHeights[i];
    equip.update(dt, f, env, lineY);
    autoEq.update(dt, f, env, lineY);
    boards.update(dt, f, env);
    // Phase 3
    const roll = house?.debug?.brooders?.curtainRoll ?? 0;
    equip3.update(dt, f, env, { moving: Math.abs(roll - (st.roll ?? roll)) > 1e-4 });
    st.roll = roll;
    yard3.update(dt, f, env, (env.dayNumber ?? 0) >= 43, tools.panelsSeen);
    catchNight.update(dt, f);
    tools.update(dt, true);
    dust.update(dt, f.air?.dustIndex ?? 0, pl(), ctx.camera, true);

    // heap shrinks as the floor is covered (it never quite disappears: the sacks come from it)
    const cover = f.litter ? f.litter.cover ?? 0 : 0;
    const k = 1 - 0.72 * Math.max(0, Math.min(1, cover));
    yard.heap.scale.set(0.45 + 0.55 * k, k, 0.45 + 0.55 * k);

    // the barrow paints the floor where it rolls
    const p = pl() && pl().position;
    if (p && props.carrying === 'barrow' && pl().isInside) {
      const yaw = pl().yaw ?? 0;
      const bx = p.x - Math.sin(yaw) * 0.9, bz = p.z - Math.cos(yaw) * 0.9;
      const lp = st.lastPaint;
      if (!lp || Math.hypot(bx - lp.x, bz - lp.z) > 0.3) {
        st.lastPaint = { x: bx, z: bz };
        const r = f.act('litter.spread', { x: bx, z: bz, r: 1.2, quiet: true });
        emit(EV.LITTER_SPREAD, { cover: (r && r.cover) ?? f.litter?.cover ?? 0 });
      }
    } else st.lastPaint = null;

    // the frame goes back into his hands if he walks off without closing the weigh panel
    if (st.frameAt && p && Math.hypot(p.x - st.frameAt.x, p.z - st.frameAt.z) > 3) pickFrame();

    // trucks
    trucks.update(dt);
    const left = boxes.update(dt, trucks);
    helper.update(dt, f, env);
    props.stacks.left = boxes.stacks.filter((s) => s.state === 'truck' || s.state === 'ground' || s.state === 'reserved').length;
    if (trucks.st.chicks.state === 'parked' || trucks.st.chicks.state === 'driving-in') st.delivered = true;
    void left;
    if (trucks.st.chicks.state === 'parked' && props.stacks.left === 0) {
      if (st.chickLeaveWait < 0) st.chickLeaveWait = 3;
      st.chickLeaveWait -= dt;
      if (st.chickLeaveWait <= 0) { st.chickLeaveWait = -1; trucks.leave('chicks'); }
    } else st.chickLeaveWait = -1;
    if (trucks.st.feed.state === 'parked') {
      st.feedWait -= dt;
      if (st.feedWait <= 0) trucks.leave('feed');
    }
    yard.sampleBox.visible = st.delivered && (env.dayNumber ?? 0) <= 0;

    // leak drip
    const ls = leakSpot();
    if (ls) {
      leakIt.x = ls.x; leakIt.z = ls.z;
      leakPos.x = ls.x; leakPos.z = ls.z + 0.04; leakPos.y = Math.max(0.05, (lineY[ls.line] ?? 0.2) - 0.02);
    }
    fx.update(dt, ls ? leakPos : null);
    pool.flush();
    void view;
  }

  const props = {
    group,
    colliders: [],          // level colliders are added to ctx.colliders in level mode only
    // floor views, one at a time (PHASE3.md §12 item 9): floorTemp (Phase 2, F), moisture (M), lux (luxMap),
    // brooderZones (unlock); the run package draws the legend of the one that is on
    overlay: { floorTemp: false, moisture: false, lux: false, brooderZones: false },
    carrying: null,
    carryOpts: null,
    /** The tape's hook while it is hooked at a wall ({ axis, end, name, x, z }), else null (the steps hotfix: the
     *  measuring job points to the far wall). */
    get tapeHook() { return tools.st.tape ? { ...tools.st.tape } : null; },
    bucketDown: null,
    /** Carrying something other than the bucket (and other than `kind`): the hands are full (PHASE4.md §15.3 a). */
    handsBusy(kind) { const c = props.carrying; return !!c && c !== 'bucket' && c !== kind; },
    /** G, or a two-handed task (auto): the carried bucket on the litter at his feet, a little in front (PHASE4.md §15.3 b, c). */
    setBucketDown({ auto = false } = {}) {
      if (props.carrying !== 'bucket') return false;
      const P = pl(), p = P?.position || { x: 0, z: 0 }, yaw = P?.yaw ?? 0;
      let x = p.x - Math.sin(yaw) * 0.4, z = p.z - Math.cos(yaw) * 0.4;
      const inside = !!P?.isInside;
      if (inside) { x = Math.max(-23.6, Math.min(23.6, x)); z = Math.max(-5.6, Math.min(5.6, z)); }
      const o = props.carryOpts || { n: 0, causes: {} };
      props.bucketDown = { x: +x.toFixed(2), z: +z.toFixed(2), ...bucketCopy(o), inside };
      dropHands();
      ctx.events?.emit(EV.BUCKET, { down: true, x: props.bucketDown.x, z: props.bucketDown.z, n: props.bucketDown.n, auto: !!auto });
      return true;
    },
    /** E at the bucket on the floor: carried again with its birds (and the tally's count of them). */
    pickUpBucket() {
      const b = props.bucketDown;
      if (!b || props.handsBusy('bucket')) return false;
      props.bucketDown = null;
      props.startCarry('bucket', bucketCopy(b));
      ctx.events?.emit(EV.BUCKET, { down: false, x: b.x, z: b.z, n: props.carryOpts?.n ?? b.n });
      return true;
    },
    // ---- Skills update (SKILLS.md §3.10): Biosecurity 2's tally bucket (read through the perks: live, allowed) ----
    /** The tally bucket holds now: E at a dead bird takes every bird within AUTO.deadReachM up to AUTO.bucketMaxKg. */
    tallyOn() { return !!(SKILLS_UPDATE.live && ctx.perks?.has?.('tallyBucket')); },
    /** How many more dead birds go into the bucket (carried, or the one set down): { n, kg, maxKg }. */
    bucketRoom() { return bucketRoom(props.carrying === 'bucket' ? props.carryOpts : props.bucketDown, birdKgOf(ctx.farm)); },
    /** The tally's digits (SKILLS.md §12.9): { n: counted as they went in, birds: every bird in the bucket, kg, maxKg, full, on }. */
    get bucketTally() {
      const o = props.carrying === 'bucket' ? props.carryOpts : props.bucketDown;
      const room = props.bucketRoom();
      return { n: Math.round(o?.counted || 0), birds: o?.n || 0, kg: +room.kg.toFixed(2), maxKg: room.maxKg, full: !!o && room.n <= 0, on: props.tallyOn(), where: props.carrying === 'bucket' ? 'hand' : o ? 'floor' : null };
    },
    startCarry(kind, opts = {}) {
      // a two-handed task while carrying the bucket: the bucket goes down at his feet first, never a lock-out
      if (props.carrying === 'bucket' && kind !== 'bucket') props.setBucketDown({ auto: true });
      // Biosecurity 2: birds the tally counts as they go in (flock-dead pickUp with opts.tally): dead.count at pickup
      // (props-tally.js putInBucket; without the tally exactly Phase 4)
      const how = { farm: ctx.farm, tally: kind === 'bucket' && !!opts.tally && props.tallyOn() };
      // a dead bird picked up while the bucket stands on the floor goes into that bucket
      if (kind === 'bucket' && props.carrying !== 'bucket' && props.bucketDown) {
        const b = putInBucket(props.bucketDown, opts, how);
        ctx.events?.emit(EV.BUCKET, { into: true, down: true, x: b.x, z: b.z, n: b.n, added: opts.n || 0 });
        return;
      }
      if (kind === 'bucket' && props.carrying === 'bucket') putInBucket(props.carryOpts, opts, how);
      else {
        props.carrying = kind;
        props.carryOpts = kind !== 'bucket' ? { ...opts } : putInBucket(null, opts, how);
      }
      ctx.player?.carry?.(kind);
      showCarry(kind);
      ctx.events?.emit(EV.CARRY, { kind, opts: props.carryOpts });
    },
    drop() {
      if (props.carrying === 'frame') pickFrame();
      dropHands();
    },
    truck: {
      get state() { return trucks.st.chicks.state; },
      arrive() { trucks.arrive('chicks'); st.delivered = true; },
      leave() { trucks.leave('chicks'); },
    },
    feedTruck: {
      get state() { return trucks.st.feed.state; },
      arrive() { trucks.arrive('feed'); st.feedWait = 14; },
      leave() { trucks.leave('feed'); },
    },
    stacks: { left: 0 },
    /** Skills update (SKILLS.md §12.9): the arrival-day helper (Brooding 3): { state, stack, want, tips, x, z }; state 'off'
     *  until the chick truck stops with the perks holding boxHelper, 'waiting' for the sample box, 'ready', 'to-stack',
     *  'loading', 'carrying', 'tipping', 'back', 'leaving', 'gone'. */
    get helper() { return { state: helper.state, stack: helper.stack, want: helper.want, tips: helper.tips, ...helper.position }; },
    update,
    setOverlay(name, on) {
      if (!(name in props.overlay)) return;
      if (on) for (const k of OVERLAYS) props.overlay[k] = false;
      props.overlay[name] = !!on;
    },
    highlighted: [],
    highlight(ids = []) { props.highlighted = [...ids]; boards.setTabs(props.highlighted); },
    /** Fix round: a board's face in the world ({ x, y, z, w, h, tilt }; the first-play signs card keeps off it). */
    boardFrame,
    reset() {
      if (props.carrying) props.drop();
      props.bucketDown = null; showCarry(null);
      trucks.leave('chicks', true); trucks.leave('feed', true);
      boxes.reset();
      helper.reset();
      st.delivered = false; st.frameAt = null; yard.frameSet.visible = false;
      props.stacks.left = 0;
      triggers.reset();
      catchNight.leave(0, true); catchNight.leave(1, true);
      tools.reset();
      floor.refresh(ctx.farm);
      ctx.condScene?.reset?.();     // Phase 4: the cull box empties with a new level
    },
    serialize() {
      return {
        // a chick in the hand is not in the flock's save (the chick-in-hand panel opens only on
        // EV.BIRD_PICK): a save made while one is held restores with empty hands
        v: 2, carrying: props.carrying === 'chick' ? null : props.carrying, carryOpts: props.carrying === 'chick' ? null : props.carryOpts,
        truck: trucks.st.chicks.state, feedTruck: trucks.st.feed.state, stacks: props.stacks.left,
        // a stack the helper is walking to or wheeling in goes back on the ground in the save (he takes it again)
        stackStates: boxes.stacks.map((s) => (s.state === 'reserved' || (s.state === 'carried' && helper.carried === s.i) ? 'ground' : s.state)), pile: boxes.pile, delivered: st.delivered,
        // Phase 3: the catching trucks, the panels put up, the tape's hook, the feed truck's silo
        catchTrucks: catchNight.trucks.map((t) => (t.state === 'parked' || t.state === 'in' ? 1 : 0)), panels: tools.panelsSeen ? 1 : 0,
        tape: tools.st.tape ? { ...tools.st.tape } : null, feedSilo: trucks.feedSilo,
        // Phase 4: the cull box's count (a bad batch's grading); absent in older saves
        ...(ctx.condScene?.serialize ? { cond: ctx.condScene.serialize() } : {}),
        // PHASE4.md §15.3: the bucket standing on the floor
        ...(props.bucketDown ? { bucketDown: { x: props.bucketDown.x, z: props.bucketDown.z, ...bucketCopy(props.bucketDown), inside: props.bucketDown.inside } } : {}),
        // Skills update: the arrival-day helper (absent while he is not on the farm)
        ...(helper.serialize() ? { helper: helper.serialize() } : {}),
      };
    },
    restore(d) {
      if (!d) return;
      props.carrying = d.carrying ?? null; props.carryOpts = d.carryOpts ?? null;
      props.bucketDown = d.bucketDown && Number.isFinite(d.bucketDown.x) ? { x: d.bucketDown.x, z: d.bucketDown.z, ...bucketCopy(d.bucketDown), inside: d.bucketDown.inside !== false } : null;
      ctx.player?.carry?.(props.carrying);
      showCarry(props.carrying);
      const settle = (s) => (s === 'parked' || s === 'driving-in' ? 'parked' : 'away');
      if (settle(d.truck) === 'parked') trucks.arrive('chicks', true); else trucks.leave('chicks', true);
      if (settle(d.feedTruck) === 'parked') trucks.arrive('feed', true, { silo: d.feedSilo }); else trucks.leave('feed', true);
      if (Array.isArray(d.stackStates)) d.stackStates.forEach((s, i) => { if (boxes.stacks[i]) { boxes.stacks[i].state = s; boxes.stacks[i].drop = 1; } });
      boxes.pile = d.pile ?? 0;
      helper.restore(d.helper || null);
      st.delivered = !!d.delivered;
      props.stacks.left = d.stacks ?? 0;
      (d.catchTrucks || []).forEach((on, i) => { if (on) catchNight.arrive(i, true); else catchNight.leave(i, true); });
      tools.st.panelsSeen = !!d.panels;
      tools.st.tape = d.tape && props.carrying === 'tape' ? { ...d.tape } : null;
      ctx.condScene?.restore?.(d.cond || null);
      floor.refresh(ctx.farm);
    },
    // test and tooling hooks (not part of the contract)
    debug: { trucks, boxes, floor, pool, triggers, yard, equip, boards, equip3, yard3, catchNight, get tools() { return tools; }, dust, auto: autoEq, helper,
      get cond() { return ctx.condScene || null; } },   // Phase 4: the conditions' scene (props-cond.js), for the harness
  };
  tools = createCycleTools(ctx, { props, pool, yard: yard3, lv });
  return props;
}
