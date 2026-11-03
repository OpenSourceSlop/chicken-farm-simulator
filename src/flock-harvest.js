// The catch (PHASE3.md §12 item 18, §6.9): the drawn flock follows farm.harvest.sections. Owner: flock
// (package "scene").
//
// While any section has left 'waiting' (the crew came), the birds are penned in their 6 m section
// (S.secOn: flock-steer.js keeps each bird's x inside it, behind the catching panels) and the drawn count is
// set per section instead of from the flock total:
//   'waiting' / 'penned'  the section's birds stay (farm sections[i].birds / BIRDS_PER_INSTANCE, or an even
//                         share of the birds still in the house)
//   'catching'            the crew takes them two or three at a time, the ones nearest the door end first,
//                         over the section's catching time (HARVEST.sectionMin from when it started)
//   'done'                empty within a few seconds
// After the last section the house is empty (alive 0). Nothing happens outside a catch.
import { BIRDS_PER_INSTANCE, HARVEST, HOUSE } from './config.js';
import { ST } from './flock-pop.js';

const SECTIONS = HARVEST.sections;

export function createCatchFlock(S, pop) {
  const seen = Array.from({ length: SECTIONS }, () => ({ state: 'waiting', t0: null }));
  const count = new Int32Array(SECTIONS), want = new Float64Array(SECTIONS);
  let burst = 0, on = false, tick = 0;

  // index of the 6 m section a bird stands in
  const secOf = (x) => { const k = Math.floor((x - S.secX0) / S.secW); return k < 0 ? 0 : k >= SECTIONS ? SECTIONS - 1 : k; };

  function active(hv) {
    if (!hv || !Array.isArray(hv.sections) || hv.sections.length !== SECTIONS) return false;
    for (const s of hv.sections) if (s && s.state && s.state !== 'waiting') return true;
    return false;
  }

  // Remove k birds of section s, the ones nearest the crew (the door end of the section) first.
  function take(s, k) {
    const x0 = S.secX0 + s * S.secW, x1 = x0 + S.secW;
    const crewX = HOUSE.door.x < x0 ? x0 : HOUSE.door.x > x1 ? x1 : HOUSE.door.x;
    for (let n = 0; n < k; n++) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < S.n; i++) {
        if (S.pen[i] || secOf(S.px[i]) !== s) continue;
        const d = Math.abs(S.px[i] - crewX) + 0.3 * Math.abs(S.pz[i] - HOUSE.door.z);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return;
      pop.deactivate(best, ST.HIDDEN);
    }
  }

  function add(s, k) {
    const x0 = S.secX0 + s * S.secW + 0.3, w = S.secW - 0.6, b = S.bounds;
    for (let n = 0; n < k; n++) {
      const id = pop.freeId();
      if (id < 0) return;
      pop.activate(id, x0 + S.rand() * w, b.zMin + 0.2 + S.rand() * (b.zMax - b.zMin - 0.4));
    }
  }

  return {
    get on() { return on; },
    want, count,
    /**
     * Every frame in a level. Returns true while the catch runs: then this sets the drawn birds and
     * pop.reconcile must not run.
     */
    update(dt, farm, env) {
      const hv = farm?.harvest;
      const now = active(hv) && (farm.flock?.alive ?? 0) >= 0;
      if (!now) {
        if (on) { on = false; S.secOn = false; for (const q of seen) { q.state = 'waiting'; q.t0 = null; } }
        return false;
      }
      on = true; S.secOn = true;
      const secs = hv.sections, alive = Math.max(0, farm.flock?.alive ?? 0);
      let notDone = 0, birdsKnown = 0;
      for (let s = 0; s < SECTIONS; s++) {
        const st = secs[s].state;
        if (st !== seen[s].state) { if (st === 'catching') seen[s].t0 = env.day; seen[s].state = st; }
        if (st !== 'done') { notDone++; birdsKnown += secs[s].birds > 0 ? secs[s].birds : 0; }
      }
      for (let s = 0; s < SECTIONS; s++) {
        const sc = secs[s], st = sc.state;
        if (st === 'done' || alive <= 0) { want[s] = 0; continue; }
        // the farm's birds of the section, else an even share of the birds still inside
        let birds = sc.birds > 0 ? sc.birds : notDone ? alive / notDone : 0;
        if (birdsKnown > alive && sc.birds > 0) birds *= alive / birdsKnown;
        let w = birds / BIRDS_PER_INSTANCE;
        if (st === 'catching') {
          const t0 = seen[s].t0 ?? env.day;
          const p = Math.max(0, Math.min(0.97, ((env.day - t0) * 1440) / HARVEST.sectionMin));
          w *= 1 - p;
        }
        want[s] = w;
      }
      count.fill(0);
      for (let i = 0; i < S.n; i++) count[secOf(S.px[i])]++;
      // the crew works in bursts: two or three birds at a time from a section being caught (more when the
      // clock runs fast); a section already done (or far over its count after a jump) empties in a few s
      if ((burst -= dt) <= 0) {
        burst = 0.25;
        tick++;
        for (let s = 0; s < SECTIONS; s++) {
          const extra = count[s] - Math.round(want[s]);
          if (extra <= 0) continue;
          if (secs[s].state === 'done' || extra > 24) take(s, Math.max(4, Math.ceil(extra * 0.25)));
          else if (extra > 3) { if (tick % 2 === 0) take(s, Math.ceil(extra / 3)); }
          else if (tick % 2 === 0) take(s, Math.min(extra, 2 + (S.rand() < 0.5 ? 1 : 0)));
        }
      }
      // a section short of its birds (a restore in the middle of the catch): they are there already
      for (let s = 0; s < SECTIONS; s++) {
        const st = secs[s].state;
        if (st === 'done' || st === 'catching') continue;
        const short = Math.round(want[s]) - count[s];
        if (short > 1) add(s, short);
      }
      return true;
    },
    clear() { on = false; S.secOn = false; burst = 0; for (const q of seen) { q.state = 'waiting'; q.t0 = null; } },
  };
}
