// Catching birds: one in the hand (vent, crop, a sick bird), ten in the catching frame (weighing),
// putting them back, culling. Owner: flock. Hand-offs: PHASE2.md §13.6.
//
// catchNearest(x, z, maxDist, purpose) -> { index, x, z } | null
//   the nearest live bird (purpose 'sick': the nearest sick bird) leaves the floor (the farmer's
//   hand mesh shows it), then ctx.props.startCarry('chick', { index }) and EV.BIRD_PICK
//   { index, x, z, purpose }. `index` is the bird's stable id (flock-pop.js).
// releaseBird(index, culled) -> true if it was held
//   culled: the bird is gone for good (the ui has called farm.act('chicks.cull')); else it is put
//   down at the farmer's feet and scuttles off. Then props.drop() and EV.BIRD_RELEASE.
// catchGroup(x, z, n) -> [{ index, x, z }]
//   the catching frame (1 x 1 m) set down at (x, z) holds the n nearest birds: they hurry into the
//   pen and mill about inside it, the others keep out; the farmer can stand right beside it.
// releaseGroup()  the frame is lifted: the birds walk off.
// providers(): registers 'chick' (ctx.level.sampling set, hands empty, priority 5) and 'sick-bird'
//   (level mode, hands empty, nearest sick bird within 1.2 m, priority 5) on ctx.interact.
import { BIRDS_PER_INSTANCE } from './config.js';
import { EV } from './events.js';
import { ACT, releaseRes } from './flock-state.js';
import { ST } from './flock-pop.js';

export const PEN_HALF = 0.45; // the frame is 1 x 1 m; birds keep inside 0.9 m
const SEARCH_GROUP = 3.0;     // the frame gathers birds from this far (they hurry in)

export function createCatcher(ctx, S, pop, isLevel) {
  const held = new Map(); // id -> { purpose, sick }
  const frame = { on: false, x: 0, z: 0, ids: [] };
  const farmer = () => ctx.player?.position || null;

  // nearest active slot within maxDist of (x, z); sickOnly: only sick (or lame) birds; lameOnly: only
  // the Phase 3 lame birds (S.sick 3, flock-cycle.js)
  function nearest(x, z, maxDist, sickOnly, lameOnly = false) {
    let best = -1, bd = maxDist * maxDist;
    for (let i = 0; i < S.n; i++) {
      if (S.pen[i] || S.spawnT[i] > 0 || (sickOnly && !S.sick[i]) || (lameOnly && S.sick[i] !== 3)) continue;
      const dx = S.px[i] - x, dz = S.pz[i] - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // PHASE4.md §15.3: the bucket blocks nothing (startCarry('chick') sets it down at his feet first)
  const handsEmpty = () => !ctx.props?.carrying || ctx.props.carrying === 'bucket';

  const catcher = {
    held, frame,
    nearest,
    catchNearest(x, z, maxDist = 1.2, purpose) {
      if (!isLevel()) return null;
      // Phase 3: the bird check (level.sampling 'bird') picks with purpose 'check'; a lame bird 'lame'
      const p0 = purpose || ctx.level?.sampling || 'vent', p = p0 === 'bird' ? 'check' : p0;
      const i = nearest(x, z, maxDist, p === 'sick' || p === 'lame', p === 'lame');
      if (i < 0) return null;
      const id = S.id[i], bx = S.px[i], bz = S.pz[i];
      held.set(id, { purpose: p, sick: S.sick[i] });
      pop.deactivate(i, ST.HELD);
      const out = { index: id, x: +bx.toFixed(2), z: +bz.toFixed(2) };
      ctx.props?.startCarry?.('chick', { index: id });
      ctx.events?.emit(EV.BIRD_PICK, { ...out, purpose: p });
      return out;
    },
    releaseBird(index, culled = false) {
      const h = held.get(index);
      if (!h) return false;
      held.delete(index);
      if (culled) {
        pop.status[index] = ST.CULLED;
        // one real bird culled, one drawn bird (3.33 real) gone: keep the drawn count honest
        pop.aheadOfCount += 1 - 1 / BIRDS_PER_INSTANCE;
      } else {
        const f = farmer() || { x: S.px[S.slotOf[index]], z: S.pz[S.slotOf[index]] };
        const a = S.rand() * 6.283, b = S.bounds;
        const x = Math.min(b.xMax, Math.max(b.xMin, f.x + Math.cos(a) * 0.35));
        const z = Math.min(b.zMax, Math.max(b.zMin, f.z + Math.sin(a) * 0.35));
        const i = pop.activate(index, x, z);
        S.sick[i] = h.sick;
        // set down, it scuttles a couple of metres away from him
        S.act[i] = ACT.WANDER; S.actT[i] = 3; S.scare[i] = 0.8;
        S.tx[i] = Math.min(b.xMax, Math.max(b.xMin, x + Math.cos(a) * 1.8));
        S.tz[i] = Math.min(b.zMax, Math.max(b.zMin, z + Math.sin(a) * 1.8));
        S.arrived[i] = 0; S.spawnT[i] = 0.15;
      }
      if (ctx.props?.carrying === 'chick') ctx.props.drop();
      ctx.events?.emit(EV.BIRD_RELEASE, { index, culled: !!culled });
      return true;
    },
    catchGroup(x, z, n = 10) {
      if (!isLevel()) return [];
      catcher.releaseGroup();
      const cand = [];
      for (let i = 0; i < S.n; i++) {
        if (S.sick[i] || S.spawnT[i] > 0) continue;
        const d = (S.px[i] - x) ** 2 + (S.pz[i] - z) ** 2;
        if (d < SEARCH_GROUP * SEARCH_GROUP) cand.push([d, i]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      frame.on = true; frame.x = x; frame.z = z; frame.ids = [];
      const out = [];
      for (let k = 0; k < Math.min(n, cand.length); k++) {
        const i = cand[k][1];
        releaseRes(S, i);
        S.pen[i] = 1;
        S.act[i] = ACT.IDLE; S.actT[i] = 1 + S.rand() * 2;
        penTarget(i);
        frame.ids.push(S.id[i]);
        out.push({ index: S.id[i], x: +S.px[i].toFixed(2), z: +S.pz[i].toFixed(2) });
      }
      return out;
    },
    releaseGroup() {
      if (!frame.on) return;
      frame.on = false;
      for (const id of frame.ids) {
        if (pop.status[id] !== ST.ACTIVE) continue;
        const i = S.slotOf[id];
        S.pen[i] = 0;
        const a = Math.atan2(S.pz[i] - frame.z, S.px[i] - frame.x) + (S.rand() - 0.5);
        S.act[i] = ACT.WANDER; S.actT[i] = 4;
        S.tx[i] = Math.min(S.bounds.xMax, Math.max(S.bounds.xMin, S.px[i] + Math.cos(a) * 1.5));
        S.tz[i] = Math.min(S.bounds.zMax, Math.max(S.bounds.zMin, S.pz[i] + Math.sin(a) * 1.5));
        S.arrived[i] = 0;
      }
      frame.ids = [];
    },
    /** a penned bird's next idea: another spot inside the frame. Returns true if handled. */
    thinkPen(i) {
      if (S.act[i] === ACT.IDLE && S.actT[i] > 0) return true;
      S.act[i] = S.rand() < 0.4 ? ACT.WANDER : ACT.IDLE; S.actT[i] = 1 + S.rand() * 3;
      penTarget(i);
      return true;
    },
    /** after steering: penned birds hurry in and stay in; the rest keep out of the frame */
    afterSteer(dt) {
      if (!frame.on) return;
      const fx = frame.x, fz = frame.z, h = PEN_HALF, speed = 1.2 * dt;
      for (let i = 0; i < S.n; i++) {
        const dx = S.px[i] - fx, dz = S.pz[i] - fz;
        if (S.pen[i]) {
          if (Math.abs(dx) > h || Math.abs(dz) > h) {
            // outside the frame still: herded in
            const d = Math.hypot(dx, dz) || 1, step = Math.min(speed, d);
            S.px[i] -= (dx / d) * step; S.pz[i] -= (dz / d) * step;
            S.fx[i] = -dx / d; S.fz[i] = -dz / d; S.spd[i] = 1.2;
            S.arrived[i] = 0;
          }
          continue;
        }
        const m = h + 0.08;
        if (Math.abs(dx) < m && Math.abs(dz) < m) {
          // out over the nearest side of the frame
          if (m - Math.abs(dx) < m - Math.abs(dz)) S.px[i] = fx + (dx < 0 ? -m : m);
          else S.pz[i] = fz + (dz < 0 ? -m : m);
        }
      }
    },
    /** interact providers (PHASE2.md §13.3) */
    providers() {
      const reg = ctx.interact;
      if (!reg?.addProvider) return;
      reg.addProvider('chick', (p, inside) => {
        const sampling = ctx.level?.sampling;
        if (!isLevel() || !sampling || !inside || !handsEmpty()) return null;
        const i = nearest(p.x, p.z, 1.2, false);
        if (i < 0) return null;
        return { id: 'chick', label: 'chick', verb: 'Pick up a', x: S.px[i], z: S.pz[i], radius: 1.2, inside: true, priority: 5,
          use: () => { const f = farmer() || p; catcher.catchNearest(f.x, f.z, 1.3, sampling); } };
      });
      reg.addProvider('sick-bird', (p, inside) => {
        if (!isLevel() || !inside || !handsEmpty()) return null;
        const i = nearest(p.x, p.z, 1.2, true);
        if (i < 0) return null;
        // Phase 3: a lame bird (it cannot walk well) is caught with purpose 'lame'
        const lame = S.sick[i] === 3;
        return { id: 'sick-bird', label: lame ? 'bird that cannot walk well' : 'bird sitting apart', verb: 'Pick up the', x: S.px[i], z: S.pz[i], radius: 1.2, inside: true, priority: 5,
          use: () => { const f = farmer() || p; catcher.catchNearest(f.x, f.z, 1.3, lame ? 'lame' : 'sick'); } };
      });
    },
    /** level reset / sandbox: whatever is held goes */
    clear() { held.clear(); frame.on = false; frame.ids = []; },
  };

  function penTarget(i) {
    const h = PEN_HALF - 0.08;
    S.tx[i] = frame.x + (S.rand() * 2 - 1) * h; S.tz[i] = frame.z + (S.rand() * 2 - 1) * h;
    S.arrived[i] = 0; S.stuck[i] = 0;
  }
  return catcher;
}
