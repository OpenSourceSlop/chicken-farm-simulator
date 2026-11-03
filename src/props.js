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
import { SPOTS2, HEATERS, DRINKER_LINES_Z, BROOD_BOUNDS, LEVEL1, FLOOR_GRID } from './config.js';
import { Batch, makePropMaterials, createBoxPool } from './props-kit.js';
import { withOcclusionFade } from './world-util.js';
import { buildFloorStates } from './props-floor.js';
import { buildBoards } from './props-boards.js';
import { buildEquipment } from './props-equip.js';
import { buildYard } from './props-yard.js';
import { buildTrucks } from './props-truck.js';
import { buildBoxes } from './props-boxes.js';
import { createTriggers } from './props-triggers.js';
import { createFx } from './props-fx.js';

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
  const pool = createBoxPool(new THREE.MeshLambertMaterial({ color: 0xffffff }), 112);
  group.add(pool.mesh);

  const stat = new Batch();
  const boards = buildBoards(stat);
  group.add(boards.group);
  const equip = buildEquipment(stat, pool, group);
  const yard = buildYard(stat, mats, group);
  const statMesh = stat.mesh(mats.out, { cast: true, receive: true });
  statMesh.name = 'props-static';
  group.add(statMesh);
  const floor = buildFloorStates(ctx, house, group);
  const trucks = buildTrucks(mats, group);
  const boxes = buildBoxes(mats.vc, group);
  const fx = createFx(pool);
  const triggers = createTriggers(ctx, fx);
  const tabSpots = new Map([...boards.tabSpots, ...equip.tabSpots, ...yard.tabSpots]);
  boards.tabSpots.clear();
  for (const [k, v] of tabSpots) boards.tabSpots.set(k, v);

  // ---------------- state ----------------
  const st = { level: false, delivered: false, frameAt: null, feedWait: 0, chickLeaveWait: -1, lastPaint: null, colliders: [] };

  const isLevel = () => !!(ctx.farm && ctx.farm.mode === 'level');
  const pl = () => ctx.player;

  // ---------------- carrying ----------------
  function showCarry(kind) {
    yard.barrow.visible = kind !== 'barrow';
    yard.spareBucket.visible = kind !== 'bucket';
    yard.scaleKit.visible = kind !== 'frame';
  }

  // ---------------- interactables ----------------
  const reg = (it) => ctx.interact && ctx.interact.add(it);
  const lv = () => st.level;
  for (const it of boards.interactables) reg({ ...it, enabled: lv });
  const panel = (id, spot, radius, extra = {}) => reg({ id, label: spot.label, x: spot.x, z: spot.z, radius, inside: spot.inside, enabled: lv, ...extra });
  panel('feeder-box', SPOTS2.feederBox, 2.0, { verb: 'Use the' });
  panel('water-supply', SPOTS2.waterSupply, 1.8, { verb: 'Use the' });
  SPOTS2.drinkers.forEach((d, i) => panel(`drinker-${i}`, d, 1.3, { verb: 'Set' }));
  panel('silo', SPOTS2.silo, 2.2, { verb: 'Read the' });
  panel('office-desk', SPOTS2.officeDesk, 2.2, { verb: 'Use the' });
  panel('chick-table', SPOTS2.chickTable, 1.8, { verb: 'Use the', enabled: () => st.level && st.delivered });
  panel('bird-scale', SPOTS2.birdScale, 1.8, { verb: 'Use the' });
  panel('litter-heap', SPOTS2.litterHeap, 2.4, { verb: 'Use the' });
  boxes.stacks.forEach((s) => reg({
    id: `box-stack-${s.i}`, label: `chick boxes (stack ${s.i + 1})`, verb: 'Pick up', x: s.x, z: s.z, radius: 0.95, inside: false,
    enabled: () => st.level && s.state === 'ground' && !props.carrying,
    use() {
      s.state = 'carried';
      props.startCarry('boxes', { stack: s.i });
      emit(EV.BOX_PICK, { stack: s.i, chicks: CHICKS_PER_STACK });
      pl()?.pose?.('crouch', 0.6);
    },
  }));
  reg({
    id: 'dead-bin', label: SPOTS2.deadBin.label, verb: 'Count into the', x: SPOTS2.deadBin.x, z: SPOTS2.deadBin.z, radius: 1.5, inside: false,
    enabled: () => st.level && props.carrying === 'bucket',
    use() {
      const o = props.carryOpts || { n: 0, causes: {} };
      const n = o.n || 0, causes = { ...(o.causes || {}) };
      ctx.farm?.act('dead.count', { n, causes });
      emit(EV.DEAD_DROP, { n, causes });
      props.drop();
    },
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
      else if (d.kind === 'feed' && d.phase === 'arrive') { trucks.arrive('feed'); st.feedWait = 14; }
      else if (d.kind === 'feed' && d.phase === 'leave') trucks.leave('feed');
    });
  }

  // ---------------- colliders (level mode only) ----------------
  const staticColliders = [...equip.colliders, ...yard.colliders];
  function syncColliders() {
    const list = ctx.colliders;
    if (!list) return;
    const want = st.level ? [...staticColliders, trucks.collider('chicks'), trucks.collider('feed')].filter(Boolean) : [];
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
    floor.update(dt, ctx.farm || {}, level, props.overlay.floorTemp);
    colliderTimer -= dt;
    if (colliderTimer <= 0) { colliderTimer = 0.25; syncColliders(); }
    if (!level) return;
    const f = ctx.farm;
    triggers.update(dt, true);
    if (house && house.lineHeights) for (let i = 0; i < 4; i++) lineY[i] = house.lineHeights[i];
    equip.update(dt, f, env, lineY);
    boards.update(dt);

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
    props.stacks.left = boxes.stacks.filter((s) => s.state === 'truck' || s.state === 'ground').length;
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
    overlay: { floorTemp: false },
    carrying: null,
    carryOpts: null,
    startCarry(kind, opts = {}) {
      if (kind === 'bucket' && props.carrying === 'bucket') {
        const c = props.carryOpts; c.n += opts.n || 0;
        for (const [k, v] of Object.entries(opts.causes || {})) c.causes[k] = (c.causes[k] || 0) + v;
      } else {
        props.carrying = kind;
        props.carryOpts = kind === 'bucket' ? { n: opts.n || 0, causes: { ...(opts.causes || {}) } } : { ...opts };
      }
      ctx.player?.carry?.(kind);
      showCarry(kind);
      ctx.events?.emit(EV.CARRY, { kind, opts: props.carryOpts });
    },
    drop() {
      if (props.carrying === 'frame') pickFrame();
      props.carrying = null; props.carryOpts = null;
      ctx.player?.carry?.(null);
      showCarry(null);
      ctx.events?.emit(EV.CARRY, { kind: null, opts: null });
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
    update,
    setOverlay(name, on) { if (name in props.overlay) props.overlay[name] = !!on; },
    highlighted: [],
    highlight(ids = []) { props.highlighted = [...ids]; boards.setTabs(props.highlighted); },
    reset() {
      if (props.carrying) props.drop();
      trucks.leave('chicks', true); trucks.leave('feed', true);
      boxes.reset();
      st.delivered = false; st.frameAt = null; yard.frameSet.visible = false;
      props.stacks.left = 0;
      triggers.reset();
      floor.refresh(ctx.farm);
    },
    serialize() {
      return {
        // a chick in the hand is not in the flock's save (the chick-in-hand panel opens only on
        // EV.BIRD_PICK): a save made while one is held restores with empty hands
        v: 2, carrying: props.carrying === 'chick' ? null : props.carrying, carryOpts: props.carrying === 'chick' ? null : props.carryOpts,
        truck: trucks.st.chicks.state, feedTruck: trucks.st.feed.state, stacks: props.stacks.left,
        stackStates: boxes.stacks.map((s) => s.state), pile: boxes.pile, delivered: st.delivered,
      };
    },
    restore(d) {
      if (!d) return;
      props.carrying = d.carrying ?? null; props.carryOpts = d.carryOpts ?? null;
      ctx.player?.carry?.(props.carrying);
      showCarry(props.carrying);
      const settle = (s) => (s === 'parked' || s === 'driving-in' ? 'parked' : 'away');
      if (settle(d.truck) === 'parked') trucks.arrive('chicks', true); else trucks.leave('chicks', true);
      if (settle(d.feedTruck) === 'parked') trucks.arrive('feed', true); else trucks.leave('feed', true);
      if (Array.isArray(d.stackStates)) d.stackStates.forEach((s, i) => { if (boxes.stacks[i]) { boxes.stacks[i].state = s; boxes.stacks[i].drop = 1; } });
      boxes.pile = d.pile ?? 0;
      st.delivered = !!d.delivered;
      props.stacks.left = d.stacks ?? 0;
      floor.refresh(ctx.farm);
    },
    // test and tooling hooks (not part of the contract)
    debug: { trucks, boxes, floor, pool, triggers, yard, equip, boards },
  };
  return props;
}
