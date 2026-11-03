// Farm model, the Phase 3 actions (PHASE3.md §13.3): cycleAct answers every farm action of the cycle with
// its result shape; undefined = Phase 2's doAct answers (its default for a ui-only id is `true`). onBus
// handles what the farm hears on the bus (listen stops, walking, a bird in the hand, the dips of the
// planning day, dead birds picked up, the vet on the phone). Pure logic, package "sim".
import { HOUSE_BOUNDS, PLAN_CONTRACT, FAN_COUNT, BIRD_BOUNDS, GAS_TANK_KG } from './config.js';
import { EV } from './events.js';
import { planSums, cleanPlan, planOutcome } from './farm-plan.js';
import { doAct } from './farm-act.js';
import { fixProblem, findProblem } from './farm-problems.js';
import { vaccineAct, sampleBird, cullLame, vaccineWalk } from './farm-health.js';
import { orderFeed, withdraw, mainType } from './farm-silos.js';
import { bookCatch, ticket } from './farm-harvest.js';
import { cleanAct, flushDisinfect } from './farm-clean.js';
import { cellIndex, setMoisture } from './farm-litter.js';
import { cycleListen } from './farm-cycle-problems.js';

const r1 = (v) => Math.round(v * 10) / 10;
const planOf = (farm) => farm.plan || (farm.plan = { measured: {}, decisions: null, sums: null, sheet: null, sentAt: null, replyAt: null, outcome: null });
/** air.probe reads +-15 % along the house: slower at the pad end, faster near the fans. */
export const probeFactor = (x) => 0.85 + 0.3 * Math.max(0, Math.min(1, (x - BIRD_BOUNDS.xMin) / (BIRD_BOUNDS.xMax - BIRD_BOUNDS.xMin)));
const day = (farm, env) => { const d = farm.stats.daily || (farm.stats.daily = {}); return d[env.dayNumber] || (d[env.dayNumber] = {}); };

/** The vet's answer on the phone (EV.LETTER { kind: 'vet' }): what the farmer reported, the advice. */
function vetAnswer(farm, env, a) {
  const h = farm.health, coc = farm.problems.find((p) => p.id === 'coccidiosis');
  const advice = coc && (coc.phase === 'found' || coc.phase === 'active') && h.cocciTreatedAt == null ? 'medicine in the water for 3 days' : 'keep the records and call again if the deaths rise';
  h.vet.push({ day: env.dayNumber, hour: r1(env.hour), reason: a.reason ?? null, advice });
  farm.emit(EV.LETTER, { kind: 'vet', day: env.dayNumber });
}

export function cycleAct(farm, env, id, a = {}) {
  const cyc = !!(farm.cyc && farm.cyc.on), feed = farm.feed, st = farm.stats, rng = farm.rng;
  switch (id) {
    case 'house.curtain': {
      const open = !!a.open;
      farm.house.curtainOpen = open; env.setBroodCurtain(!open);
      farm.litter.usedAll = open;
      if (open && st.curtainAt == null) { st.curtainAt = +env.day.toFixed(5); st.coverAtLift = +farm.litter.coverAll.toFixed(4); }
      return true;
    }
    case 'heat.brooders': {
      const up = !!a.up;
      farm.house.broodersUp = up; env.setBroodersUp(up);
      if (up && st.broodersUpAt == null) st.broodersUpAt = +env.day.toFixed(5);
      return true;
    }
    case 'bio.change': st.changedAt = env.day; (st.gate || (st.gate = {})).change = true; return true;
    case 'plan.measure': {
      const axis = a.axis === 'width' ? 'width' : 'length';
      const m = Number.isFinite(a.m) ? r1(a.m) : axis === 'length' ? HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin : HOUSE_BOUNDS.zMax - HOUSE_BOUNDS.zMin;
      const p = planOf(farm); p.measured[axis] = m; if (!p.measuredAt) p.measuredAt = {}; p.measuredAt[axis] = env.day;
      return { m };
    }
    case 'plan.send': {
      const p = planOf(farm), ms = p.measured || {};
      const houseM2 = ms.length && ms.width ? r1(ms.length * ms.width) : PLAN_CONTRACT.houseM2Drawings;
      const decisions = cleanPlan(a), sums = planSums(decisions, houseM2);
      Object.assign(p, { decisions, sums, sheet: a.sums ?? null, sentAt: env.day, replyAt: env.day + PLAN_CONTRACT.replyAfterH / 24, outcome: planOutcome({ decisions, sums }) });
      return sums;
    }
    case 'air.probe': {
      const x = a.x ?? 0, n = () => rng.next() * 2 - 1;
      return { speedMs: r1(Math.max(0, env.airSpeed * probeFactor(x) + n() * 0.1)), tempC: r1(env.houseTemp + (x > 0 && env.fansEffective > 0 ? 0.6 : 0) + n() * 0.2), rh: Math.round(env.houseRH + n() * 2) };
    }
    case 'gas.meter': { const used = st.gasKg || 0; const r = { kgLeft: Math.max(0, Math.round(GAS_TANK_KG - used)), kgUsed: Math.round(used) }; day(farm, env).gasRead = r.kgUsed; return r; }
    case 'sample.bird': return sampleBird(farm, env, a, farm.age);
    case 'chicks.cull': if (a.reason === 'lame') cullLame(farm, Math.max(0, Math.round(a.n ?? 1))); return undefined;
    case 'water.main': case 'vaccine.mix': return vaccineAct(farm, env, id, a, farm.age);
    case 'water.medicate': {
      const m = farm.health.medication;
      if (a.on && !m.on) { m.on = true; m.from = env.day; } else if (!a.on && m.on) { m.on = false; m.days = +(m.onH / 24).toFixed(2); }
      return true;
    }
    case 'water.test': {
      const med = farm.health.medication.on || farm.health.vaccine.state === 'drinking';
      return { ph: r1(6.8 + (rng.next() - 0.5) * 0.2), chlorinePpm: med ? 0 : r1(2.5 + (rng.next() - 0.5) * 0.4) };
    }
    case 'feed.valve': {
      const i = Math.max(0, Math.min(1, Math.round(a.silo ?? 0)));
      feed.valves[i] = [0, 0.5, 1].reduce((b, v) => (Math.abs(v - (a.open ?? 0)) < Math.abs(b - (a.open ?? 0)) ? v : b), 0);
      return true;
    }
    case 'feed.order': {
      if (!cyc) return undefined; // the brooding week: Phase 2's single figure
      const r = orderFeed(feed, env, a);
      if (r.kg > 0) fixProblem(farm, env, 'low-silo', 'order');
      return r;
    }
    case 'feed.meter': return cyc ? { kg: Math.floor(feed.meterKg), type: mainType(feed) } : undefined;
    case 'feed.silo': {
      if (!cyc) return undefined;
      const noise = () => 1 + (rng.next() * 2 - 1) * 0.02, round = (kg) => Math.max(0, Math.round((kg * noise()) / 10) * 10);
      const silos = feed.silos.map((s) => ({ type: s.type, kg: round(s.kg) }));
      return { kg: silos[0].kg + silos[1].kg, silos };
    }
    case 'feed.withdraw': withdraw(feed, env, a.on); return true;
    case 'litter.fork': {
      const L = farm.litter, i = cellIndex(a.x ?? 0, a.z ?? 0), caked = !!L.cakedGrid[i];
      if (caked) { L.cakedGrid[i] = 0; L.cakedHours[i] = 0; setMoisture(L, i, Math.max(12, L.moistureGrid[i] - 5)); L.version++; }
      return { caked };
    }
    case 'litter.patch': {
      if (!cyc) return undefined;
      const onPad = !!farm.problems.find((p) => p.id === 'pad-overflow' && p.startedAt != null) && (a.x ?? 0) < -21.5;
      const r = doAct(farm, env, 'litter.patch', a);
      if (onPad) st.padPatchedAt = st.padPatchedAt ?? env.day;
      return { ...r, onPad };
    }
    case 'pad.check': {
      const dryN = Math.round((1 - farm.house.padWorking) * 6);
      return { dry: Array.from({ length: 6 }, (_, k) => k < dryN), flowing: env.padOn, overflow: !!farm.house.padFloatStuck };
    }
    case 'pad.flush': { const fixed = farm.house.padWorking < 1; farm.house.padWorking = 1; env.padWorking = 1; return { fixed }; }
    case 'pad.fixFloat': { const fixed = !!farm.house.padFloatStuck; farm.house.padFloatStuck = false; return { fixed }; }
    case 'fan.fix': {
      const i = Math.round(a.index ?? -1), fixed = env.fansBroken.includes(i);
      if (fixed) { env.setFansBroken(env.fansBroken.filter((k) => k !== i)); farm.house.fansBroken = env.fansBroken.slice(); }
      return { fixed };
    }
    case 'vent.stages': env.setFanStages(a.stages ? { stages: a.stages, padOverC: a.padOverC } : null); return true;
    case 'water.flush': {
      if (cyc && (!farm.clean.disinfectant || !a.on)) return { ...doAct(farm, env, 'water.flush', a), disinfected: false };
      if (!farm.clean.disinfectant || !a.on) return undefined;
      const r = doAct(farm, env, 'water.flush', a);
      return { ...r, disinfected: flushDisinfect(farm, Math.round(a.line ?? 0)) };
    }
    case 'phone.bookCatch': return bookCatch(farm, env, a);
    case 'catch.panels': farm.harvest.panels = true; return true;
    case 'load.ticket': return ticket(farm, a);
    case 'house.close': {
      const C = farm.clean;
      st.linesCleanAtClose = C.lines.every((v) => v >= 1);
      return cleanAct(farm, env, id, a);
    }
    case 'phone.vet': vetAnswer(farm, env, a); return undefined;
    case 'sign.read': if (a.board === 'sign-gate' && env.dayNumber === -2) (st.gate || (st.gate = {})).sign = true; return undefined;
    case 'controller.read': farm.lastCtlRead = farm.controllerMemory(); farm.ctlMem = null; return undefined;
    case 'fans.read': { const D = day(farm, env); D.fansMax = Math.max(D.fansMax ?? 0, a.fans ?? env.fansOn); if (env.padOn || a.pad) D.padSeen = true; return undefined; }
    default: return cleanAct(farm, env, id, a);
  }
}

/** What the farm hears on the bus (installed by farm.js). */
export function onBus(farm, env, type, p = {}) {
  if (farm.mode !== 'level') return;
  const st = farm.stats;
  switch (type) {
    case EV.LISTEN: cycleListen(farm, env, p.x ?? 0, p.z ?? 0); break;
    case 'walk': vaccineWalk(farm, p.share || 0); break;
    case EV.CELL: {
      const v = farm.health.vaccine;
      if (v.state !== 'drinking') break;
      // the birds he walks up to drink: the cells within his 2 m sight (as the walk jobs count them, sight 2)
      const seen = v.cells || (v.cells = []), x0 = p.x ?? 0, z0 = p.z ?? 0;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const x = x0 + dx, z = z0 + dz;
        if (dx * dx + dz * dz > 4 || x < -24 || x >= 24 || z < -6 || z >= 6) continue;
        const i = cellIndex(x, z);
        if (!seen.includes(i)) { seen.push(i); vaccineWalk(farm, 1 / 576); }
      }
      break;
    }
    case EV.BIRD_PICK: {
      farm.inHand = { index: p.index ?? null, lame: p.purpose === 'lame' };
      const st = farm.problems.find((x) => x.id === 'lame-birds');
      if (p.purpose === 'lame' && st && st.phase === 'active') findProblem(farm, env, 'lame-birds', 'pick');
      break;
    }
    case EV.BIRD_RELEASE: farm.inHand = null; break;
    case EV.FOOTDIP: if (env.dayNumber === -2 && p.where === 'gate') (st.gate || (st.gate = {})).gateDip = true; break;
    case EV.HOUSE_ENTER: if (env.dayNumber === -2 && p.dipped) (st.gate || (st.gate = {})).houseDip = true; break;
    case EV.DEAD_PICK: {
      const by = farm.flock.floorByCause, causes = p.causes || {};
      if (by) for (const [c, n] of Object.entries(causes)) by[c] = Math.max(0, (by[c] || 0) - n);
      if ((causes.sds || 0) > 0) { const s = farm.problems.find((x) => x.id === 'sudden-deaths'); if (s && s.phase === 'active') findProblem(farm, env, 'sudden-deaths', 'dead'); }
      break;
    }
    case EV.ACTION:
      if (p.result !== undefined) break;
      if (p.id === 'phone.vet') vetAnswer(farm, env, p);
      if (p.id === 'fans.read') { const D = day(farm, env); D.fansMax = Math.max(D.fansMax ?? 0, p.fans ?? env.fansOn); if (env.padOn) D.padSeen = true; }
      if (p.id === 'controller.read') farm.lastCtlRead = farm.controllerMemory();
      if (p.id === 'sign.read' && p.board === 'sign-gate' && env.dayNumber === -2) (st.gate || (st.gate = {})).sign = true;
      break;
    case EV.RECORD_CLOSED: { const D = (st.daily || (st.daily = {}))[p.day] || (st.daily[p.day] = {}); D.lameAtSign = farm.flock.lameOnFloor || 0; D.cakedAtSign = +(farm.litter.cakedShare || 0).toFixed(4); D.gasAtSign = +(st.gasKg || 0).toFixed(1); break; }
    default:
  }
}

export { FAN_COUNT };
