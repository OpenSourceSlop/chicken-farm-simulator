// Phase 4: a bad batch of chicks (PHASE4.md §4.3) — the delivery's numbers for the flock (farm.delivery: farm-flock.js
// deliver / stepBoxes / lateEstimate / stepFlock read them), grading the stacks at the chick table (chicks.grade), the
// day-0 claim once the hatchery is told the same day (phone.hatchery, ui), yolk-sac infection while weak chicks are in
// the flock, feed trays and chick paper (brood.trays), the brooder sign's row + 1 °C on days 0-3 (env.setTargetShift).
// Package "sim", pure logic. No delivery (every other condition, the normal season): nothing here acts.
import { SPOTS4, LEVEL1 } from './config.js';
import { stateOf, isActive, isOn, condFind, condFix } from './farm-cond-core.js';
import { killBirds } from './farm-flock.js';

// model values (PHASE4.md §4.3)
export const CHICKS_P4 = {
  gradeShare: 0.9,       // a stack graded at the table: 90 % of its weak chicks go to the cull box
  gradeMin: 6,           // farm minutes a stack takes (the panel's bar, PHASE4.md §10.3)
  sampleWeakK: 7.5,      // the grading sample of ten shows about 3-4 weak ones (weak share x 7.5)
  boxFreeH: 1,           // the box hazard rises from 1 h after the truck stops (7 h on the road; Phase 2: 3 h)
  traysLate: 0.03, traysReach: 0.1, traysToAge: 4, reachToH: 72,   // feed trays and chick paper
  stacksForFix: 4, smallBelowG: 38, weakSeenMin: 2,
  weakDeathRef: 0.444,   // Phase 2's weak chicks' hazard over the week (35 % die): the delivery's share sets the factor
  infectionToAge: 7,
};

export const chicksFresh = () => ({ brood: { trays: false } });

/** At the level's install: the target shift of the brooding week and the delivery's flock factors. */
export function chicksInstall(farm, env, def) {
  const D = def.id === LEVEL1.id ? farm.delivery : null;
  env.setTargetShift(D && D.targetShiftC ? D.targetShiftC : 0, D ? D.shiftDays ?? 3 : 3);
  farm.weakRateK = D && D.weakDeathShare ? -Math.log(1 - D.weakDeathShare) / CHICKS_P4.weakDeathRef : undefined;
  farm.boxTimeK = farm.condition === 'hot' ? 1.5 : undefined;   // the truck stood in the hot season's 35 °C (model)
}

/** Before the flock step: the small chicks' slower start (their first 72 h on the floor) and the trays' reach. */
export function chicksPre(farm, env) {
  const D = farm.delivery, st = farm.stats;
  farm.gainK72 = D && st.firstTipAt != null && (env.day - st.firstTipAt) * 24 < 72 ? D.gainK72h : undefined;
  farm.lateK = D ? { base: D.lateBase, trays: farm.brood.trays && farm.age < CHICKS_P4.traysToAge ? CHICKS_P4.traysLate : 0 } : undefined;
  farm.traysReach = farm.brood.trays && farm.age < CHICKS_P4.reachToH / 24 ? CHICKS_P4.traysReach : 0;
}

/** After the flock step: yolk-sac infection while weak chicks are in the flock (days 0-7); the day-0 claim closes. */
export function stepChicks(farm, env, hrs) {
  const D = farm.delivery, fl = farm.flock, X = farm.condX;
  if (!D) return;
  if (D.infectionPerPctH && fl.placed > 0 && fl.alive > 0 && farm.age < CHICKS_P4.infectionToAge) {
    const weak = fl.cohorts.weak.n;
    if (weak > 0) {
      fl.acc.infection = (fl.acc.infection || 0) + D.infectionPerPctH * 100 * weak * hrs;
      if (fl.acc.infection >= 1) { const n = Math.floor(fl.acc.infection); fl.acc.infection -= n; killBirds(farm, n, 'infection'); }
    }
  }
  if (!X.claimClosed && env.dayNumber >= 1) X.claimClosed = true;   // 24:00 of day 0: no call, no claim
}

/** Grading a stack still in its boxes; the trays (PHASE4.md §10.3: answers at once, the panel waited its bar). */
export function chicksAct(farm, env, id, a = {}) {
  const fl = farm.flock, X = farm.condX;
  switch (id) {
    case 'chicks.grade': {
      const i = Math.max(0, Math.min(fl.stacks.length - 1, Math.round(a.stack ?? 0))), st = fl.stacks[i];
      if (!st || st.chicks <= 0) return { stack: i, looked: 0, weak: 0, culled: 0, minutes: CHICKS_P4.gradeMin };
      const looked = Math.round(st.chicks), weak = Math.round(st.weak);
      // 90 % of the weak ones found (seeded: one draw rounds the share)
      const culled = st.graded ? 0 : Math.min(weak, Math.floor(weak * CHICKS_P4.gradeShare + farm.rng.next()));
      if (culled > 0) {
        st.chicks -= culled; st.weak -= culled; fl.inBoxes -= culled; fl.culls += culled; fl.cullsInBoxes += culled;
        const by = fl.cullsBy || (fl.cullsBy = {}); by.grading = (by.grading || 0) + culled;
        fl.gradedOut = (fl.gradedOut || 0) + culled;
        dayZeroCull(farm, env, culled);
      }
      if (!st.graded) st.gradedR = { looked, weak, culled, at: +env.day.toFixed(5) };   // the table's answer, kept for a reload
      st.graded = true;
      X.graded = (X.graded || 0) + (culled >= 0 ? 1 : 0); (X.gradedStacks || (X.gradedStacks = [])).push(i);
      return { stack: i, looked, weak, culled, minutes: CHICKS_P4.gradeMin };
    }
    case 'brood.trays': farm.brood.trays = !!a.on; if (a.on && X.traysAt == null) X.traysAt = +env.day.toFixed(5); return true;
    default: return undefined;
  }
}
/** Chicks culled on day 0 (graded out, or culled on the floor before 24:00): the hatchery's claim once told that day. */
function dayZeroCull(farm, env, n) {
  if (env.dayNumber !== 0 || !(n > 0)) return;
  const X = farm.condX;
  X.day0Culls = (X.day0Culls || 0) + n;
  if (X.hatcheryAt != null) farm.flock.claimed = (farm.flock.claimed || 0) + n;
}
const fixCheck = (farm, env) => {
  const X = farm.condX;
  if (isOn(farm, 'weak-batch') && new Set(X.gradedStacks || []).size >= CHICKS_P4.stacksForFix && X.hatcheryAt != null) condFix(farm, env, 'weak-batch', 'graded');
};

/** Symptoms and fixes of a bad batch carried by actions (and the ui's phone.hatchery on the bus). */
export function chicksSymptoms(farm, env, id, a, result) {
  if (!farm.delivery) return;
  const X = farm.condX;
  switch (id) {
    case 'sample.box': if (isActive(farm, 'weak-batch') && farm.stats.chickWeightMeasuredG != null && farm.stats.chickWeightMeasuredG < CHICKS_P4.smallBelowG) condFind(farm, env, 'weak-batch', 'box'); break;
    case 'sample.grade': {
      const c = farm.flock.gradeBox[Math.max(0, Math.min(9, Math.round(a.i ?? 0)))];
      if (c && c.weak) { const seen = X.weakSeen || (X.weakSeen = []); if (!seen.includes(a.i ?? 0)) seen.push(a.i ?? 0); }
      if (isActive(farm, 'weak-batch') && (X.weakSeen || []).length >= CHICKS_P4.weakSeenMin) condFind(farm, env, 'weak-batch', 'grade');
      break;
    }
    case 'chicks.grade': fixCheck(farm, env); break;
    case 'chicks.cull': if (result !== false && a.reason !== 'lame') dayZeroCull(farm, env, Math.max(0, Math.round(a.n ?? 1))); break;
    case 'phone.hatchery':
      if (env.dayNumber === 0 && X.hatcheryAt == null && !X.claimClosed) { X.hatcheryAt = +env.day.toFixed(5); farm.flock.claimed = (farm.flock.claimed || 0) + (X.day0Culls || 0); }
      (X.calls || (X.calls = [])).push([+env.day.toFixed(5), a.chickWeightG ?? null, a.weakPct ?? null]);
      fixCheck(farm, env);
      break;
    default:
  }
}
export function chicksBus() {}
/** A look at the chick table while the batch waits in its boxes. */
export function chicksZones(farm) {
  if (!farm.delivery || !isActive(farm, 'weak-batch') || !(farm.flock.inBoxes > 0)) return [];
  return [{ problemId: 'weak-batch', x: SPOTS4.chickTable.x, z: SPOTS4.chickTable.z, r: 2, dwellSec: 2 }];
}
export { stateOf };
