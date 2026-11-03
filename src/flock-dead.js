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
import { buildBirdGeometry } from './flock-geometry.js';
import { createBirdMaterials } from './flock-shader.js';
import { writeBirdMatrix } from './flock-pose.js';
import { ACT, COLD } from './flock-state.js';

export const MAX_DRAWN = 160;
export const CAUSES = ['cold', 'heat', 'dehydration', 'weak', 'starveout', 'other', 'box'];

export function createDeadBirds(ctx, S, uniforms, pop) {
  const geo = buildBirdGeometry(0);
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
    if (cause === 'heat') {
      const side = rnd() < 0.5 ? -1 : 1;
      return { x: randX(), z: side < 0 ? b.zMin + 0.1 + rnd() * 0.45 : b.zMax - 0.1 - rnd() * 0.45 };
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
        const x = randX(), z = b.zMin + 0.2 + rnd() * (b.zMax - b.zMin - 0.4);
        let feed = 9;
        for (const fz of FEEDER_LINES_Z) feed = Math.min(feed, Math.abs(z - fz));
        let crowd = 0;
        for (let q = 0; q < 12 && S.n > 0; q++) { const j = (rnd() * S.n) | 0; if ((S.px[j] - x) ** 2 + (S.pz[j] - z) ** 2 < 1) crowd++; }
        const s = -Math.min(feed, 1.6) + 0.5 * crowd + 0.3 * rnd();
        if (s < bs) { bs = s; best = { x, z }; }
      }
      return best;
    }
    return { x: randX(), z: b.zMin + 0.2 + rnd() * (b.zMax - b.zMin - 0.4) };
  }

  function lay(cause) {
    const p = clampB(spotFor(cause));
    // dead birds are mostly the small ones (weak, late starters)
    const small = cause === 'weak' || cause === 'starveout' || cause === 'box' ? 0.82 : 0.92;
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
     *  EV.DEAD_PICK (the farm subtracts n from deadOnFloor) and props.startCarry('bucket'). */
    pickUp(x, z, r = 1.5) {
      const causes = {};
      let n = 0;
      for (let k = list.length - 1; k >= 0; k--) {
        const d = list[k];
        if (Math.hypot(d.x - x, d.z - z) > r) continue;
        causes[d.cause] = (causes[d.cause] || 0) + 1; n++;
        list.splice(k, 1);
      }
      if (!n) return { n: 0, causes };
      dirty = true;
      refill();
      ctx.props?.startCarry?.('bucket', { n, causes });
      const carried = ctx.props?.carrying === 'bucket' ? ctx.props.carryOpts?.n ?? n : n;
      ctx.events?.emit(EV.DEAD_PICK, { n, causes: { ...causes }, carried });
      return { n, causes };
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
    const m = mesh.instanceMatrix.array, A = aA.array, B = aB.array, C = aC.array;
    for (let k = 0; k < list.length; k++) {
      const d = list[k];
      const ph = (d.id * 0.618) % 1;
      // on its side (roll 90°), resting on the wing: half the body width above the floor
      writeBirdMatrix(m, k * 16, d.x, 0.27 * d.s, d.z, Math.cos(d.yaw), Math.sin(d.yaw), d.side * 1.5708, d.s, d.s, d.s);
      const q = k * 4, pitch = -0.35 - 0.35 * ph, wing = 0.35 + 0.4 * ph;
      A[q] = Math.cos(pitch); A[q + 1] = Math.sin(pitch); A[q + 2] = -0.03; A[q + 3] = 0;
      B[q] = Math.cos(0.3 * (ph - 0.5)); B[q + 1] = Math.sin(0.3 * (ph - 0.5)); B[q + 2] = Math.cos(wing); B[q + 3] = Math.sin(wing);
      C[q] = 0.18; C[q + 1] = Math.sin(0.35 * (ph - 0.5)); C[q + 2] = d.tint + 3; C[q + 3] = 0.05;
    }
    mesh.count = list.length;
    mesh.visible = list.length > 0;
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
