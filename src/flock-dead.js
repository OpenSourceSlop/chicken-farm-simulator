// Dead birds on the floor, one drawn dead bird per real dead bird. Owner: flock.
//
// The farm owns the number (farm.flock.deadOnFloor: += on each death, -= on EV.DEAD_PICK); this
// module draws them where they died and mirrors that number. On EV.FARM_DEATH { n, cause } each
// bird is laid by its cause (PHASE2.md §12.2): cold -> at the edge of a pile of huddling chicks;
// weak / starve-out -> alone, away from the feeders; dehydration -> beside the worst drinker line;
// heat -> along the side walls; box -> where the last stack was tipped; other -> anywhere.
// At most MAX_DRAWN lie on the floor at once (one InstancedMesh, one draw call); more wait in a
// queue and are laid as the farmer picks the others up.
// A dead bird lies on its side, legs stretched out, head back, eyes shut, its down grey and flat
// (the 'dead' bird material, flock-shader.js). Live birds step round it.
import * as THREE from 'three';
import { DRINKER_LINES_Z, FEEDER_LINES_Z, HEATERS } from './config.js';
import { EV } from './events.js';
import { PIVOTS, buildBirdGeometry } from './flock-geometry.js';
import { createBirdMaterials } from './flock-shader.js';
import { writeBirdMatrix } from './flock-pose.js';
import { ACT, COLD } from './flock-state.js';

export const MAX_DRAWN = 160;
// top of the litter (house-shell.js lays the floor 2 cm up; live birds stand with their toes in it)
const FLOOR_Y = 0.02;
// Phase 3 adds (at the end, so Phase 2 saves keep their indices): sds -> on its back, legs up, by a
// feeder line; legs -> thin, beside a drinker line; disease -> hunched by the side walls;
// respiratory -> anywhere, on its side. ('doa' is counted at the plant, never on the floor.)
export const CAUSES = ['cold', 'heat', 'dehydration', 'weak', 'starveout', 'other', 'box', 'sds', 'legs', 'disease', 'respiratory'];

// The stiff legs sticking out are what tells a dead bird from a resting one: draw them twice as
// thick (and the feet wider) as on the live model, in both the chick and the broiler shape.
function thickenLegs(geo) {
  const part = geo.getAttribute('aPart').array;
  for (const [name, hip] of [['position', PIVOTS.chick.hip], ['aPos2', PIVOTS.broiler.hip]]) {
    const p = geo.getAttribute(name).array;
    for (let v = 0; v < part.length; v++) {
      if (part[v] < 5.5 || part[v] > 7.5) continue;
      const side = part[v] > 6.5 ? 1 : -1, cz = hip[2] * side;
      p[v * 3] = hip[0] + (p[v * 3] - hip[0]) * 2.2;
      p[v * 3 + 2] = cz + (p[v * 3 + 2] - cz) * 2.2;
      p[v * 3 + 1] *= 1.15;
    }
  }
  geo.computeVertexNormals();
}

export function createDeadBirds(ctx, S, uniforms, pop) {
  const geo = buildBirdGeometry(0);
  thickenLegs(geo);
  const attr = (name) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DRAWN * 4), 4);
    geo.setAttribute(name, a);
    return a;
  };
  const aA = attr('aAnimA'), aB = attr('aAnimB'), aC = attr('aAnimC');
  const { material } = createBirdMaterials(uniforms, { dead: true });
  const mesh = new THREE.InstancedMesh(geo, material, MAX_DRAWN);
  mesh.name = 'flock-dead';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 27);
  mesh.count = 0;
  mesh.visible = false;
  ctx.scene.add(mesh);
  // the damp, pressed-down patch of litter under a bird that has lain there a while: frames the
  // dead bird so it reads among the walking chicks from the default camera
  const patchGeo = new THREE.CircleGeometry(0.5, 9).rotateX(-Math.PI / 2);
  const patchMat = new THREE.MeshLambertMaterial({ color: 0x7d6743, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const patch = new THREE.InstancedMesh(patchGeo, patchMat, MAX_DRAWN);
  patch.name = 'flock-dead-patch';
  patch.castShadow = false;
  patch.receiveShadow = true;
  patch.boundingSphere = mesh.boundingSphere;
  patch.count = 0;
  patch.visible = false;
  ctx.scene.add(patch);

  /** @type {{ id: number, x: number, z: number, yaw: number, side: number, s: number, cause: string, tint: number }[]} */
  const list = [];
  const queue = []; // causes of dead birds not drawn yet
  let nextId = 1, dirty = true, mismatchT = 0;
  const rnd = () => S.rand();
  const clampB = (d) => {
    const b = S.bounds;
    d.x = d.x < b.xMin + 0.1 ? b.xMin + 0.1 : d.x > b.xMax - 0.1 ? b.xMax - 0.1 : d.x;
    d.z = d.z < b.zMin + 0.08 ? b.zMin + 0.08 : d.z > b.zMax - 0.08 ? b.zMax - 0.08 : d.z;
    return d;
  };
  const randX = () => S.bounds.xMin + 0.4 + rnd() * (S.bounds.xMax - S.bounds.xMin - 0.8);

  // Where a bird of this cause is found
  function spotFor(cause) {
    const b = S.bounds;
    if (cause === 'cold') {
      // at the edge of a pile: next to a huddling bird, on the far side from the pile's centre
      for (let k = 0; k < 40 && S.n > 0; k++) {
        const i = (rnd() * S.n) | 0;
        if (S.therm[i] !== COLD && S.act[i] !== ACT.HUDDLE) continue;
        let cx = S.tx[i], cz = S.tz[i], bd = 1e9;
        for (const h of HEATERS) { const d = (h.x - S.px[i]) ** 2 + (h.z - S.pz[i]) ** 2; if (d < bd) { bd = d; cx = h.x; cz = h.z; } }
        let dx = S.px[i] - cx, dz = S.pz[i] - cz;
        const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        const r = 0.12 + 0.25 * rnd();
        return { x: S.px[i] + dx * r, z: S.pz[i] + dz * r };
      }
      const h = HEATERS[(rnd() * HEATERS.length) | 0], a = rnd() * 6.283, r = 1.6 + rnd();
      return { x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r };
    }
    if (cause === 'heat' || cause === 'disease') {
      const side = rnd() < 0.5 ? -1 : 1;
      return { x: randX(), z: side < 0 ? b.zMin + 0.1 + rnd() * 0.45 : b.zMax - 0.1 - rnd() * 0.45 };
    }
    if (cause === 'sds') {
      // big birds that die suddenly are often found near the feeders
      const fz = FEEDER_LINES_Z[(rnd() * FEEDER_LINES_Z.length) | 0];
      return { x: randX(), z: fz + (rnd() < 0.5 ? -1 : 1) * (0.3 + 0.35 * rnd()) };
    }
    if (cause === 'legs') {
      const dz = DRINKER_LINES_Z[(rnd() * DRINKER_LINES_Z.length) | 0];
      return { x: randX(), z: dz + (rnd() < 0.5 ? -1 : 1) * (0.2 + 0.3 * rnd()) };
    }
    if (cause === 'dehydration') {
      const line = S.lv ? S.lv.minLine : (rnd() * DRINKER_LINES_Z.length) | 0;
      return { x: randX(), z: DRINKER_LINES_Z[line] + (rnd() < 0.5 ? -1 : 1) * (0.2 + 0.5 * rnd()) };
    }
    if (cause === 'box' && pop.lastTip) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd());
      return { x: pop.lastTip.x + Math.cos(a) * r, z: pop.lastTip.z + Math.sin(a) * r };
    }
    if (cause === 'weak' || cause === 'starveout') {
      // alone, away from the feeders: the best of a few spots far from a feeder line and the crowd
      let best = null, bs = 1e9;
      for (let k = 0; k < 8; k++) {
        const x = randX();
        let z = 0, feed = 0;
        for (let t = 0; t < 12 && feed < 0.9; t++) { // never right beside a feeder line
          z = b.zMin + 0.2 + rnd() * (b.zMax - b.zMin - 0.4);
          feed = 9;
          for (const fz of FEEDER_LINES_Z) feed = Math.min(feed, Math.abs(z - fz));
        }
        let crowd = 0;
        for (let q = 0; q < 12 && S.n > 0; q++) { const j = (rnd() * S.n) | 0; if ((S.px[j] - x) ** 2 + (S.pz[j] - z) ** 2 < 1) crowd++; }
        let s = -Math.min(feed, 1.3) + 0.5 * crowd + 0.4 * rnd();
        for (const d of list) if ((d.x - x) ** 2 + (d.z - z) ** 2 < 4) s += 1; // alone, not by another dead bird
        if (s < bs) { bs = s; best = { x, z }; }
      }
      return best;
    }
    return { x: randX(), z: b.zMin + 0.2 + rnd() * (b.zMax - b.zMin - 0.4) };
  }

  function lay(cause) {
    const p = clampB(spotFor(cause));
    // dead birds are mostly the small ones (weak, late starters); a sudden death is a big, well-grown
    // bird; a bird that died of its legs is thin
    const small = cause === 'weak' || cause === 'starveout' || cause === 'box' ? 0.82 : cause === 'sds' ? 1.05 : cause === 'legs' ? 0.8 : 0.92;
    list.push({ id: nextId++, x: p.x, z: p.z, yaw: rnd() * 6.283, side: rnd() < 0.5 ? -1 : 1,
      s: S.L * (small + 0.12 * rnd()), cause, tint: rnd() * 2 - 1 });
    dirty = true;
  }

  function add(n, cause) {
    const c = CAUSES.includes(cause) ? cause : 'other';
    for (let k = 0; k < n; k++) { if (list.length < MAX_DRAWN) lay(c); else queue.push(c); }
  }

  function refill() { while (list.length < MAX_DRAWN && queue.length) lay(queue.shift()); }

  // Remove the oldest (queue first): the farm's count fell without a pick-up (a restore, a reset).
  function removeOldest(n) {
    while (n > 0 && queue.length) { queue.pop(); n--; }
    if (n > 0) { list.splice(0, Math.min(n, list.length)); dirty = true; }
  }

  const api = {
    /** Harness hook (PHASE4.md §15.5): one drawn dead bird at (x, z); the caller adds it to farm.flock.deadOnFloor too
     *  (the farm owns the count; without it the mirror takes the oldest away after 1 s). */
    layAt(x, z, cause = 'other') {
      const p = clampB({ x, z });
      list.push({ id: nextId++, x: p.x, z: p.z, yaw: rnd() * 6.283, side: rnd() < 0.5 ? -1 : 1, s: S.L * 0.9, cause: CAUSES.includes(cause) ? cause : 'other', tint: rnd() * 2 - 1 });
      dirty = true;
      return { x: p.x, z: p.z };
    },
    /** dead birds on the floor: drawn + waiting to be drawn (mirrors farm.flock.deadOnFloor) */
    get count() { return list.length + queue.length; },
    get drawn() { return list.length; },
    /** drawn dead birds within r of (x, z), nearest first */
    near(x, z, r = 1.5) {
      const out = [];
      for (const d of list) {
        const dd = Math.hypot(d.x - x, d.z - z);
        if (dd <= r) out.push({ id: d.id, x: d.x, z: d.z, cause: d.cause, dist: dd });
      }
      return out.sort((a, b) => a.dist - b.dist).map(({ dist, ...d }) => d); // eslint-disable-line no-unused-vars
    },
    /** Pick up every drawn dead bird within r of (x, z) into the bucket: { n, causes }. Emits
     *  EV.DEAD_PICK (the farm subtracts n from deadOnFloor) and props.startCarry('bucket').
     *  Skills update (SKILLS.md §3.10, Biosecurity 2's tally bucket): opts.maxN takes the nearest birds only, up to the
     *  bucket's room (props.bucketRoom, 15 kg); opts.tally counts them as they go in (props.startCarry sends dead.count
     *  { at: 'pickup' }); left: the birds within r still on the floor (the bucket was full). Without opts: as Phase 4. */
    pickUp(x, z, r = 1.5, opts = null) {
      const causes = {};
      let n = 0, left = 0;
      if (opts && Number.isFinite(opts.maxN)) {
        const inReach = list.map((d, k) => ({ k, dd: Math.hypot(d.x - x, d.z - z) })).filter((e) => e.dd <= r).sort((a, b) => a.dd - b.dd);
        const take = inReach.slice(0, Math.max(0, Math.floor(opts.maxN)));
        left = inReach.length - take.length;
        for (const e of take.sort((a, b) => b.k - a.k)) {
          const d = list[e.k];
          causes[d.cause] = (causes[d.cause] || 0) + 1; n++;
          list.splice(e.k, 1);
        }
      } else {
        for (let k = list.length - 1; k >= 0; k--) {
          const d = list[k];
          if (Math.hypot(d.x - x, d.z - z) > r) continue;
          causes[d.cause] = (causes[d.cause] || 0) + 1; n++;
          list.splice(k, 1);
        }
      }
      if (!n) return { n: 0, causes, left };
      dirty = true;
      refill();
      ctx.props?.startCarry?.('bucket', opts && opts.tally ? { n, causes, tally: true } : { n, causes });
      const carried = ctx.props?.carrying === 'bucket' ? ctx.props.carryOpts?.n ?? n : n;
      ctx.events?.emit(EV.DEAD_PICK, { n, causes: { ...causes }, carried });
      return opts ? { n, causes, left } : { n, causes };
    },
  };

  // Live birds step round the dead ones (none stands on a dead bird).
  function pushLive(grid, dt) {
    if (!list.length || !S.n) return;
    const { items, cellStart: cs, nx, nz } = grid;
    const k = Math.min(1, dt * 6);
    for (const d of list) {
      const gx = grid.cellX(d.x), gz = grid.cellZ(d.z);
      for (let qz = Math.max(0, gz - 1); qz <= Math.min(nz - 1, gz + 1); qz++) {
        for (let qx = Math.max(0, gx - 1); qx <= Math.min(nx - 1, gx + 1); qx++) {
          const c = qz * nx + qx;
          for (let q = cs[c], qe = cs[c + 1]; q < qe; q++) {
            const j = items[q];
            if (j >= S.n || S.pen[j]) continue;
            const dx = S.px[j] - d.x, dz = S.pz[j] - d.z, r = 0.5 * (0.9 * d.s + 0.6 * S.L * S.size[j]);
            const d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            const dd = Math.sqrt(d2) || 1e-3, push = ((r - dd) / dd) * k;
            S.px[j] += (d2 > 1e-8 ? dx : 0.01) * push; S.pz[j] += dz * push;
          }
        }
      }
    }
  }

  function writeInstances() {
    if (!dirty) return;
    dirty = false;
    const m = mesh.instanceMatrix.array, pm = patch.instanceMatrix.array, A = aA.array, B = aB.array, C = aC.array;
    for (let k = 0; k < list.length; k++) {
      const d = list[k];
      const ph = (d.id * 0.618) % 1;
      const cy = Math.cos(d.yaw), sy = Math.sin(d.yaw);
      const q = k * 4;
      let pitch = -0.45 - 0.35 * ph, wing = 0.45 + 0.4 * ph, sit = 0, legs = -0.5 + 0.2 * ph, wYaw = 0.05;
      if (d.cause === 'sds') {
        // on its back, legs up (rolled over about its length; the back on the litter)
        writeBirdMatrix(m, k * 16, d.x, FLOOR_Y + 0.6 * d.s, d.z, cy, sy, d.side * 3.0, 1.04 * d.s, 0.95 * d.s, 0.92 * d.s);
        pitch = -0.2; wing = 0.35 + 0.2 * ph; legs = 0.15 * (ph - 0.5);
      } else if (d.cause === 'disease') {
        // hunched: on its breast, legs folded under, head sunk to the litter, feathers fluffed
        writeBirdMatrix(m, k * 16, d.x, FLOOR_Y, d.z, cy, sy, 0.12 * d.side, 0.95 * d.s, 0.9 * d.s, 1.12 * d.s);
        pitch = 0.75 + 0.2 * ph; wing = 0.2; sit = 1; legs = 0;
      } else {
        // on its side (roll 90°), stretched out and flat on the litter: across the body (now
        // vertical) squashed to 80 %, so it sits half that width above the floor
        // the body's middle (0.42 up the standing bird) now lies to one side: shift it back over (x, z)
        const off = 0.42 * d.s * d.side, thin = d.cause === 'legs' ? 0.78 : 1;
        // heat: wings spread wide, beak open
        if (d.cause === 'heat') { wing = 0.9 + 0.1 * ph; wYaw = 0.22; }
        writeBirdMatrix(m, k * 16, d.x + sy * off, FLOOR_Y + 0.19 * d.s, d.z - cy * off, cy, sy, d.side * 1.5708, 1.06 * d.s, d.s, 0.72 * d.s * thin);
      }
      writeBirdMatrix(pm, k * 16, d.x + 0.05 * d.s * cy, FLOOR_Y + 0.004, d.z + 0.05 * d.s * sy, cy, sy, 0, 1.4 * d.s, 1, 1.05 * d.s);
      // head thrown back, a wing flopped open, legs stiff and out behind, beak a little open
      A[q] = Math.cos(pitch); A[q + 1] = Math.sin(pitch); A[q + 2] = -0.03; A[q + 3] = sit;
      B[q] = Math.cos(0.3 * (ph - 0.5)); B[q + 1] = Math.sin(0.3 * (ph - 0.5)); B[q + 2] = Math.cos(wing); B[q + 3] = Math.sin(wing);
      C[q] = d.cause === 'heat' ? 0.45 : 0.2; C[q + 1] = legs; C[q + 2] = d.tint + 3; C[q + 3] = wYaw;
    }
    mesh.count = patch.count = list.length;
    mesh.visible = patch.visible = list.length > 0;
    patch.instanceMatrix.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true; aA.needsUpdate = true; aB.needsUpdate = true; aC.needsUpdate = true;
  }

  return {
    mesh, api, list, queue, add, pushLive,
    /** every frame in a level: mirror the farm's count (after 1 s, so event order never matters) */
    update(dt, farm) {
      const want = farm?.flock?.deadOnFloor;
      if (typeof want === 'number' && Number.isFinite(want)) {
        const have = list.length + queue.length, w = Math.max(0, Math.round(want));
        if (w !== have) {
          if ((mismatchT += dt) > 1) { if (w > have) add(w - have, 'other'); else removeOldest(have - w); mismatchT = 0; }
        } else mismatchT = 0;
      }
      writeInstances();
    },
    clear() { list.length = 0; queue.length = 0; dirty = true; mismatchT = 0; writeInstances(); },
    /** Fix round: no more drawn than the farm's count, at once (a restore or a standard start: the 1 s mirror showed an
     *  emptied house full of dead birds for a moment). */
    trimTo(want) {
      const w = Math.max(0, Math.round(+want || 0)), have = list.length + queue.length;
      if (Number.isFinite(w) && have > w) { removeOldest(have - w); mismatchT = 0; writeInstances(); }
    },
    serialize() {
      const flat = [];
      for (const d of list) {
        flat.push(Math.round(d.x * 100), Math.round(d.z * 100), Math.round(d.yaw * 100), d.side, Math.round(d.s * 1000), CAUSES.indexOf(d.cause));
      }
      return { dead: flat, queue: queue.map((c) => CAUSES.indexOf(c)) };
    },
    restore(data) {
      list.length = 0; queue.length = 0;
      const f = Array.isArray(data?.dead) ? data.dead : [];
      for (let k = 0; k + 5 < f.length && list.length < MAX_DRAWN; k += 6) {
        list.push({ id: nextId++, x: f[k] / 100, z: f[k + 1] / 100, yaw: f[k + 2] / 100, side: f[k + 3] < 0 ? -1 : 1,
          s: f[k + 4] / 1000, cause: CAUSES[f[k + 5]] || 'other', tint: rnd() * 2 - 1 });
      }
      for (const c of Array.isArray(data?.queue) ? data.queue : []) queue.push(CAUSES[c] || 'other');
      dirty = true; mismatchT = 0;
      writeInstances();
    },
  };
}
