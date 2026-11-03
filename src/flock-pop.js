// Flock population in a level: which of the FLOCK_COUNT bird slots are on the floor. Owner: flock.
//
// The state arrays (flock-state.js) hold FLOCK_COUNT birds. In the sandbox all of them are active
// (S.n = cap) exactly as in Phase 1. In a level the active birds are packed into slots 0..S.n-1, so
// every loop of think / steer / pose / render / metrics simply runs over S.n birds:
//   - hidden birds (not placed yet, removed when the farm's alive count drops, culled) and birds
//     held in the farmer's hand sit in slots S.n..cap-1;
//   - a bird keeps a stable id (S.id[slot], S.slotOf[id]); the API (catch, release, events) uses
//     the id as `index`, so packing never changes what a caller holds.
// Counts (PHASE2.md §12.2): drawn live birds = round(farm.flock.alive / BIRDS_PER_INSTANCE), less
// the drawn birds already taken out ahead of the count (a culled drawn bird stands for one real
// bird, not 3.33). Chicks from a tipped stack appear within 1 m of the tip over 2 s (placeBatch).
// Size: each bird keeps a weight quantile u; size = cbrt(farm.flock.weightQuantile(u) / mean).
import { BIRDS_PER_INSTANCE } from './config.js';
import { ACT, RIGHT, makeRand, releaseRes } from './flock-state.js';

export const ST = { HIDDEN: 0, ACTIVE: 1, HELD: 2, CULLED: 3 };
const NOT_PER_BIRD = new Set(['slotOf', 'resUse', 'pans', 'nips', 'status']);
const QN = 48; // quantile table resolution

export function createPopulation(S) {
  const cap = S.cap;
  S.id = new Int32Array(cap);
  S.slotOf = new Int32Array(cap);
  S.u = new Float32Array(cap);       // weight quantile of the bird (0..1), fixed per id
  S.sick = new Uint8Array(cap);      // 0 well, 1 sick, 2 sick and lame (flock-sick.js)
  S.pen = new Uint8Array(cap);       // 1 = held in the catching frame (flock-catch.js)
  S.spawnT = new Float32Array(cap);  // > 0 while tumbling out of the box
  S.lagT = new Float32Array(cap);    // seconds left sitting dazed after the tip
  for (let i = 0; i < cap; i++) { S.id[i] = i; S.slotOf[i] = i; }
  // stratified quantiles in a shuffled order: any 1,800 birds cover the weight curve evenly, and
  // the first birds placed are not all small or all big
  // (own random stream: the sandbox flock's sequence stays exactly Phase 1's)
  const rnd = makeRand(7151), order = Array.from({ length: cap }, (_, k) => k);
  for (let k = cap - 1; k > 0; k--) { const j = (rnd() * (k + 1)) | 0; const t = order[k]; order[k] = order[j]; order[j] = t; }
  for (let i = 0; i < cap; i++) S.u[i] = (order[i] + 0.5) / cap;
  const status = new Uint8Array(cap).fill(ST.ACTIVE);
  const perBird = Object.entries(S).filter(([k, v]) => ArrayBuffer.isView(v) && v.length === cap && !NOT_PER_BIRD.has(k)).map(([, v]) => v);

  const pop = {
    status,
    pending: [],          // [{ t, x, z }] chicks still to spill out of a tipped stack
    batchBirds: 0,        // drawn birds announced by placeBatch (stub farms without counts)
    aheadOfCount: 0,      // drawn birds removed ahead of the farm's alive count (culls)
    lastTip: null,        // { x, z } where the last stack was tipped (box deaths lie there)
    qTable: new Float32Array(QN + 1), qMean: 0, sizeT: 0,

    swap(a, b) {
      if (a === b) return;
      for (let k = 0; k < perBird.length; k++) { const arr = perBird[k]; const t = arr[a]; arr[a] = arr[b]; arr[b] = t; }
      S.slotOf[S.id[a]] = a; S.slotOf[S.id[b]] = b;
    },
    /** Take active slot i out of the floor (status for its id). */
    deactivate(i, st = ST.HIDDEN) {
      releaseRes(S, i);
      S.sick[i] = 0; S.pen[i] = 0;
      status[S.id[i]] = st;
      pop.swap(i, S.n - 1);
      S.n--;
    },
    /** Put bird `id` (hidden or held) on the floor at (x, z); returns its slot. */
    activate(id, x, z) {
      const s = S.slotOf[id];
      pop.swap(s, S.n);
      const i = S.n++;
      status[id] = ST.ACTIVE;
      initBird(S, i, x, z);
      return i;
    },
    /** A hidden bird id (never a held or culled one), or -1. */
    freeId() {
      for (let s = S.n; s < cap; s++) if (status[S.id[s]] === ST.HIDDEN) return S.id[s];
      return -1;
    },
    /** Level start: an empty house. */
    clear() {
      for (let i = 0; i < cap; i++) { S.res[i] = -1; S.sick[i] = 0; S.pen[i] = 0; }
      status.fill(ST.HIDDEN);
      S.resUse.fill(0);
      S.n = 0;
      pop.pending.length = 0; pop.batchBirds = 0; pop.aheadOfCount = 0; pop.lastTip = null;
    },
    /** Back to the sandbox: every bird active again (flock.js re-places them). */
    all() {
      status.fill(ST.ACTIVE);
      for (let i = 0; i < cap; i++) { S.sick[i] = 0; S.pen[i] = 0; S.spawnT[i] = 0; S.lagT[i] = 0; }
      S.n = cap; pop.pending.length = 0;
    },
    held() { let k = 0; for (let s = S.n; s < cap; s++) if (status[S.id[s]] === ST.HELD) k++; return k; },

    /** Chicks of one tipped stack spill out around (x, z) over 2 s. */
    placeBatch(x, z, chicks) {
      const k = Math.max(0, Math.round((chicks || 0) / BIRDS_PER_INSTANCE));
      pop.batchBirds += k;
      pop.lastTip = { x, z };
      for (let j = 0; j < k; j++) pop.pending.push({ t: (2 * (j + 0.5)) / k, x, z });
    },

    /** Drawn live birds the farm's numbers call for. */
    target(farm) {
      const f = farm.flock;
      const counted = (f.placed || 0) > 0 || (f.alive || 0) > 0;
      const want = counted ? (f.alive || 0) / BIRDS_PER_INSTANCE : pop.batchBirds;
      return Math.max(0, Math.min(cap, Math.round(want - pop.aheadOfCount)));
    },

    /** Spill pending chicks, then add or hide birds so the drawn count matches the farm. */
    reconcile(farm, dt, farmerPos) {
      const b = S.bounds;
      const target = pop.target(farm);
      const held = pop.held();
      // too many: drop chicks still to spill, then take birds off the floor out of the farmer's way
      let extra = S.n + held + pop.pending.length - target;
      while (extra > 0 && pop.pending.length) { pop.pending.pop(); extra--; }
      for (let tries = 0; extra > 0 && S.n > 0 && tries < 4 * extra + 8; tries++) {
        let best = -1, bd = -1;
        for (let k = 0; k < 6; k++) {
          const i = (S.rand() * S.n) | 0;
          if (S.pen[i] || S.sick[i]) continue;
          const d = farmerPos ? Math.hypot(S.px[i] - farmerPos.x, S.pz[i] - farmerPos.z) : 0;
          if (d > bd) { bd = d; best = i; }
        }
        if (best < 0) best = S.n - 1;
        pop.deactivate(best);
        extra--;
      }
      // spill: chicks tumble out within 1 m of the tip spot
      for (let k = pop.pending.length - 1; k >= 0; k--) {
        const p = pop.pending[k];
        if ((p.t -= dt) > 0) continue;
        pop.pending.splice(k, 1);
        const id = pop.freeId();
        if (id < 0) continue;
        const a = S.rand() * 6.283, r = Math.sqrt(S.rand());
        const i = pop.activate(id, clamp(p.x + Math.cos(a) * r, b.xMin, b.xMax), clamp(p.z + Math.sin(a) * r, b.zMin, b.zMax));
        S.spawnT[i] = 0.3; S.lagT[i] = 0.6 + S.rand() * 2.5;
        S.vx[i] = Math.cos(a) * 0.5; S.vz[i] = Math.sin(a) * 0.5;
      }
      // too few with nothing on the way (a restore, a skip): birds already spread over the floor
      let missing = target - S.n - held - pop.pending.length;
      while (missing > 0) {
        const id = pop.freeId();
        if (id < 0) break;
        pop.activate(id, b.xMin + 0.3 + S.rand() * (b.xMax - b.xMin - 0.6), b.zMin + 0.2 + S.rand() * (b.zMax - b.zMin - 0.4));
        missing--;
      }
      return target;
    },

    /** Sizes from the farm's weight distribution (every 0.5 s, or at once with force). */
    sizes(farm, dt, force) {
      if (!force && (pop.sizeT -= dt) > 0) return;
      pop.sizeT = 0.5;
      const f = farm.flock, q = pop.qTable;
      const mean = f.meanWeightG > 0 ? f.meanWeightG : 42;
      for (let k = 0; k <= QN; k++) {
        const u = 0.002 + (0.996 * k) / QN;
        let w = typeof f.weightQuantile === 'function' ? f.weightQuantile(u) : mean;
        if (!(w > 0)) w = mean;
        q[k] = Math.cbrt(w / mean);
      }
      pop.qMean = mean;
      for (let i = 0; i < cap; i++) {
        const t = S.u[i] * QN, k = Math.min(QN - 1, t | 0), a = t - k;
        S.size[i] = q[k] + (q[k + 1] - q[k]) * a;
      }
    },
  };
  return pop;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// A bird put on the floor: standing, comfortable, about to decide what to do.
export function initBird(S, i, x, z) {
  const r = S.rand;
  S.px[i] = x; S.pz[i] = z; S.tx[i] = x; S.tz[i] = z; S.vx[i] = 0; S.vz[i] = 0;
  const a = r() * 6.283;
  S.fx[i] = Math.cos(a); S.fz[i] = Math.sin(a);
  S.act[i] = ACT.IDLE; S.actT[i] = 0.5 + r() * 1.5; S.thinkT[i] = r() * 0.5;
  S.therm[i] = RIGHT; S.tIdx[i] = 0; S.tAmb[i] = 0; S.site[i] = -1; S.arrived[i] = 1; S.res[i] = -1;
  S.sitA[i] = 0; S.wingA[i] = 0; S.hp[i] = 0; S.hl[i] = 0; S.ht[i] = 0; S.beak[i] = 0;
  S.spd[i] = 0; S.scare[i] = 0; S.stuck[i] = 0; S.spawnT[i] = 0; S.lagT[i] = 0; S.sick[i] = 0; S.pen[i] = 0;
}

