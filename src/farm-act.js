// Farm model, everything the farmer does to or reads from the farm: the switch behind
// farm.act(id, args) (PHASE2.md §13.2) with the readings of §6.8. Pure logic, package "sim".
// The caller (farm.act) then lets the problems see the action and emits EV.ACTION.
import { EQUIP, FAN_COUNT, LEVEL1, DRINKER_LINES_Z, broodSector } from './config.js';
import { EV } from './events.js';
import { updateAccess, meterAt, filterGauges, clampPressure, clampHeight } from './farm-water.js';
import { clampPanHeight, FEED } from './farm-feed.js';
import { spread, patch, cellIndex, meanDepth } from './farm-litter.js';
import { tip, cull, drawBird, weighInBird, lateEstimate } from './farm-flock.js';
import { fixProblem, deathsCounted } from './farm-problems.js';

const r1 = (v) => Math.round(v * 10) / 10;
const lineOf = (farm, a, list) => list[Math.max(0, Math.min(list.length - 1, Math.round(a.line ?? 0)))];

/** Birds the farmer knows are alive: placed - dead birds he counted - culls after placing. */
export const knownAlive = (fl) => Math.max(0, fl.placed - fl.countedDead - (fl.culls - fl.cullsInBoxes));

export function doAct(farm, env, id, a) {
  const fl = farm.flock, water = farm.water, feed = farm.feed, L = farm.litter, rng = farm.rng, st = farm.stats;
  switch (id) {
    // ---- heat, air, light ----
    case 'heat.relight': {
      const i = Math.round(a.index ?? -1);
      if (!env.brooderOut.includes(i)) return { fixed: false };
      fixProblem(farm, env, 'brooder-out', 'relight');
      if (env.brooderOut.includes(i)) env.setBrooderOut(env.brooderOut.filter((k) => k !== i));
      return { fixed: true };
    }
    case 'vent.timer': {
      const t = { fans: Math.max(0, Math.min(FAN_COUNT, Math.round(a.fans ?? 0))), onSec: Math.max(0, a.onSec ?? 0), cycleSec: Math.max(1, a.cycleSec ?? 300) };
      // the air the timer gives (fan-seconds per second) beside the setting before: r-minvent counts a step up
      const air = (v) => (v && v.fans > 0 && v.onSec > 0 ? (v.fans * v.onSec) / Math.max(1, v.cycleSec || 300) : 0);
      const prevAir = air(farm.vent), nowAir = air(t);
      farm.vent = t;
      env.setVentTimer(t.fans > 0 && t.onSec > 0 ? t : null);
      // a step up gives more air than the setting before (sending the same setting again is no step)
      return { air: Math.round(nowAir * 1000) / 1000, prevAir: Math.round(prevAir * 1000) / 1000, stepUp: nowAir > prevAir + 1e-9 };
    }
    case 'light.program': {
      const p = { darkStart: a.darkStart ?? farm.light.darkStart, darkHours: Math.max(0, Math.min(12, a.darkHours ?? farm.light.darkHours)), dimmer: Math.max(0, Math.min(1, a.dimmer ?? farm.light.dimmer)) };
      // Skills update (SKILLS.md §3.7): dawn and dusk dimming minutes ride along when given (the Lighting 3 controller, the
      // dimming view's key); a program without them is Phase 2's exactly
      if (Number.isFinite(a.rampMin)) p.rampMin = Math.max(0, Math.min(60, Math.round(a.rampMin)));
      Object.assign(farm.light, p, { luxAtBirds: EQUIP.luxMax * p.dimmer });
      env.setLightProgram(p);
      return true;
    }
    case 'light.lux': return { lux: Math.max(0, Math.round(farm.luxAt(a.x, a.z) + (rng.next() * 2 - 1) * 2)) };
    // ---- litter ----
    case 'litter.depth': L.depthCm = Math.max(1, Math.min(15, a.cm ?? L.depthCm)); return true;
    case 'litter.spread': {
      const c = spread(L, a.x ?? 0, a.z ?? 0, a.r ?? 1.2);
      env.litterDepthCm = meanDepth(L);
      return { cover: +c.toFixed(3) };
    }
    case 'litter.patch': {
      // onLeak: the sack went on the patch the leaking nipple wet (within 1.5 m of its cell)
      const x = a.x ?? 0, z = a.z ?? 0;
      const def = (farm.level || LEVEL1).problems.find((p) => p.id === 'leaking-nipple');
      const leak = farm.problems.find((p) => p.id === 'leaking-nipple');
      const onLeak = !!(def && leak && leak.startedAt != null && Math.hypot(x - def.x, z - DRINKER_LINES_Z[def.line]) <= 1.5);
      patch(L, x, z);
      if (onLeak && leak.phase === 'fixed' && !leak.patchedAt) leak.patchedAt = env.day;
      return { onLeak };
    }
    case 'litter.squeeze': {
      const i = cellIndex(a.x ?? 0, a.z ?? 0);
      const m = Math.max(0, Math.min(99, L.moistureGrid[i] + (rng.next() * 2 - 1)));
      const caked = !!L.cakedGrid[i];
      const feel = L.coverGrid[i] < 0.5 ? 'bare concrete, wet' : caked ? 'wet and caked' : m < 25 ? 'dry' : m <= 30 ? 'holds, then breaks' : m <= 38 ? 'sticks' : 'wet';
      return { moisturePct: Math.round(m), feel };
    }
    case 'floor.probe': return { tempC: r1(env.floorTemp(a.x ?? 0, a.z ?? 0) + (rng.next() * 2 - 1) * 0.2) };
    // ---- water ----
    case 'water.flush': {
      const l = lineOf(farm, a, water.lines);
      l.flushing = !!a.on;
      return { flushClear: +l.flushClear.toFixed(2) };
    }
    case 'water.pressure': lineOf(farm, a, water.lines).pressureCm = clampPressure(a.cm ?? 10); updateAccess(water, farm.age); return true;
    case 'water.height': lineOf(farm, a, water.lines).heightCm = clampHeight(a.cm ?? 11); updateAccess(water, farm.age); return true;
    case 'water.flowtest': {
      updateAccess(water, farm.age);
      // the line keeps its last reading (r-drinkers: every line tested this round, near age + 20)
      const l = lineOf(farm, a, water.lines), mlMin = r1(Math.max(0, l.flowMlMin + (rng.next() - 0.5)));
      l.lastFlow = { mlMin, at: +env.day.toFixed(5) };
      return { mlMin };
    }
    case 'water.meter': {
      const now = env.day, m24 = meterAt(water, now - 1, now), m48 = meterAt(water, now - 2, now);
      const l24 = m24 == null ? null : water.meterL - m24, prev = m24 == null || m48 == null ? null : m24 - m48;
      const birds = knownAlive(fl);
      return { litres: Math.floor(water.meterL), litres24h: l24 == null ? null : Math.round(l24),
        per1000: l24 == null || birds <= 0 ? null : r1((l24 * 1000) / birds),
        changePct: l24 == null || prev == null || prev < 1 ? null : r1((l24 / prev - 1) * 100) };
    }
    case 'water.filter': return filterGauges(water, rng);
    case 'water.clearFilter': {
      const fixed = water.filterFactor < 1;
      if (fixed) fixProblem(farm, env, 'blocked-filter', 'clean');
      water.filterFactor = 1; updateAccess(water, farm.age);
      return { fixed };
    }
    case 'water.fixLeak': {
      const leak = water.leak;
      if (!leak) return { fixed: false };
      const p = farm.problems.find((q) => q.id === 'leaking-nipple');
      if (p) p.cakedAtFix = !!L.cakedGrid[leak.cell];
      water.leak = null;
      fixProblem(farm, env, 'leaking-nipple', 'replace');
      return { fixed: true };
    }
    // ---- feed ----
    case 'feed.line': {
      const l = lineOf(farm, a, feed.lines);
      if (a.running != null) l.running = !!a.running;
      if (a.flood != null) {
        // flood off: the heaped feed around flooded pans is trampled into the litter (model), the
        // pans keep their normal fill
        if (l.flood && !a.flood && l.kg > FEED.panKgNormal) { feed.wastedKg = (feed.wastedKg || 0) + l.kg - FEED.panKgNormal; l.kg = FEED.panKgNormal; }
        l.flood = !!a.flood;
      }
      if (a.heightCm != null) l.heightCm = clampPanHeight(a.heightCm);
      return true;
    }
    case 'feed.meter': return { kg: Math.floor(feed.meterKg) };
    case 'feed.silo': return { kg: Math.max(0, Math.round((feed.siloKg * (1 + (rng.next() * 2 - 1) * 0.02)) / 10) * 10) };
    case 'feed.order': {
      const kg = Math.max(0, Math.round(a.kg ?? 0));
      if (!kg) return { arriveDay: null, arriveHour: null };
      const arriveDay = env.dayNumber + (env.hour < 16 ? 1 : 2), arriveHour = 9;
      feed.order = { kg, arriveDay, arriveHour, orderedAt: env.day };
      feed.orders.push({ ...feed.order, arrivedAt: null });
      if (a.by !== 'auto') fixProblem(farm, env, 'low-silo', 'order');   // Skills update: no problem fixed by equipment
      return { arriveDay, arriveHour };
    }
    // ---- chicks and birds ----
    case 'chicks.tip': {
      const r = tip(farm, env, a);
      if (fl.inBoxes <= 0 && !farm.truckLeft) { farm.truckLeft = true; farm.emit(EV.FARM_DELIVERY, { kind: 'chicks', phase: 'leave' }); }
      return r;
    }
    case 'chicks.cull': return cull(farm, a);
    case 'dead.count': {
      const n = Math.max(0, Math.round(a.n ?? 0));
      fl.countedDead += n;
      const d = env.dayNumber;
      fl.countedByDay[d] = (fl.countedByDay[d] || 0) + n;
      deathsCounted(farm, env, fl.countedByDay[d]);
      return true;
    }
    case 'sample.box': {
      // a box of 100 from the delivery on the box scale: gross kg (the box weight is printed on it)
      const n = (farm.level || LEVEL1).chicksPerBox, boxKg = 0.35;
      const mean = fl.chickWeightG * (1 + (0.08 / Math.sqrt(n)) * rng.normal());
      const weightKg = +((n * mean) / 1000 + boxKg).toFixed(2);
      st.chickWeightMeasuredG = +(((weightKg - boxKg) * 1000) / n).toFixed(1);
      if (st.boxWeighedAt == null) st.boxWeighedAt = env.day;
      return { chicks: n, weightKg, boxKg };
    }
    case 'sample.grade': {
      const c = fl.gradeBox[Math.max(0, Math.min(9, Math.round(a.i ?? 0)))];
      if (!c) return { reflexSec: null, navel: null, hocks: null, weightG: null };
      return { reflexSec: c.reflexSec, navel: c.navel, hocks: c.hocks, weightG: c.weightG };
    }
    case 'sample.vent': {
      const t = Math.max(37.5, Math.min(42, 40 + 0.3 * (env.localTemp(a.x ?? 0, a.z ?? 0) - env.targetTemp) + (rng.next() * 2 - 1) * 0.25));
      const tempC = r1(t);
      st.ventReadings.push({ t: +env.day.toFixed(5), sector: broodSector(a.x ?? 0, a.z ?? 0), tempC });
      return { tempC };
    }
    case 'sample.crop': {
      const p = st.cropFillTrue ?? Math.max(0, 1 - lateEstimate(farm, env) - 0.5 * (fl.cohorts.weak.n / Math.max(1, fl.alive)));
      let crop = 'full-soft';
      if (rng.next() >= p) {
        const fw = fl.factors.fW, ff = fl.factors.fF;
        crop = rng.next() < 0.35 ? 'empty' : fw < ff ? 'hard' : 'soft-watery';
      }
      return { crop };
    }
    case 'sample.weigh': {
      // stratified over the flock (farm-flock weighInBird): the weigh-in reads the flock's uniformity
      if (st.weighOffset == null) st.weighOffset = rng.next();
      const weightG = Math.round(weighInBird(fl, rng, st.weighed.length, st.weighOffset) + (rng.next() * 2 - 1));
      st.weighed.push({ t: +env.day.toFixed(5), sector: broodSector(a.x ?? 0, a.z ?? 0), weightG });
      return { weightG };
    }
    default: return true; // ui-only ids and anything not modelled: done is done
  }
}
