// Phase 4: the water condition's model (PHASE4.md §4.4) — iron in the well water (the filter and line 4's nipples clog),
// the 6 m³ tank that feeds the lines and the pads, the old well pump (its wear, its gauges, the tank's low marker, the
// 2-hour repair) — and the hot season's line water (PHASE4.md §4.1: the lines warm under the roof; a flush puts tank water
// in them). Package "sim", pure logic. Only the farm decides a symptom (an action it sees, a listen stop).
import { WATER_TANK, PAD_EFF, EQUIP, flowTargetAt, CONDITIONS } from './config.js';
import { EV } from './events.js';
import { H, stateOf, isOn, isActive, condFind, condFix } from './farm-cond-core.js';
import { updateAccess } from './farm-water.js';
import { wetBulbOf } from './sim.js';
import { cycleAct } from './farm-cycle-act.js';
import { doAct } from './farm-act.js';

// model values (PHASE4.md §4.1, §4.4)
export const WATER_P4 = {
  ironMgL: 1.2,          // iron in the well water (the water supply plate: over about 0.3 mg/L clogs the filter and the nipples)
  lineOverC: 2, lineTauH: 2, tankC: 27, flushMin: 2,   // the lines warm toward the house + 2 °C (2 h); a 2 min flush: tank water
  drinkFromC: 30, drinkPerC: 0.015,                    // the birds drink x (1 - 0.015 x (line °C - 30)) over 30 °C
};

const WEAR = CONDITIONS.water.levels.weeks45.problems.find((p) => p.id === 'pump-wear');   // the old pump (weeks 4-5 on)
export const waterFresh = () => ({ waterTank: { levelPct: WATER_TANK.startPct, lowPct: WATER_TANK.startPct, lowAt: null, pumpShare: 1, fixing: false, fixUntil: null, fixedAt: null, fixFrom: null } });

/** At the level's install: the hot season's line water exists (the water supply panel shows it), else none. */
export function waterInstall(farm, env) {
  const W = farm.water, X = farm.condX;
  if (farm.condition === 'hot') { if (!Array.isArray(W.lineTempC) || W.lineTempC.length !== W.lines.length) W.lineTempC = W.lines.map(() => +(env.houseTemp + WATER_P4.lineOverC).toFixed(2)); }
  else delete W.lineTempC;
  if (farm.condition !== 'water') { delete W.supplyK; if (X.filterK) X.filterK = null; }
  if (X.filterK) W.filterFactor = Math.min(W.filterFactor, X.filterK);   // the iron filter (Phase 2's applyEffects may reset it)
  updateAccess(W, farm.age);
}
/** A condition problem's start: iron clogs the main filter or line 4's nipples; the pump starts to wear. */
export function waterStart(farm, env, st, def) {
  const W = farm.water;
  if (st.id === 'iron-filter') { farm.condX.filterK = def.flowFactor; W.filterFactor = Math.min(W.filterFactor, def.flowFactor); updateAccess(W, farm.age); }
  if (st.id === 'iron-nipples') { W.lines[def.line].flowK = def.flowFactor; updateAccess(W, farm.age); }
}

/** One step: before the flock (the line water, iron flushed out, the tank's pressure) or after it (`post`: the tank). */
export function stepWater(farm, env, hrs, post) {
  const W = farm.water, X = farm.condX;
  if (!post) {
    // a flush of a line (2 farm minutes or more): tank water in it, line 4's iron flushed out
    for (let i = 0; i < W.lines.length; i++) {
      const l = W.lines[i];
      X.flushMin[i] = l.flushing ? (X.flushMin[i] || 0) + hrs * 60 : 0;
      if (l.flowK != null && l.flowK < 1 && X.flushMin[i] >= WATER_P4.flushMin) { l.flowK = 1; condFix(farm, env, 'iron-nipples', 'flush'); }
    }
    if (W.lineTempC) {
      const k = 1 - Math.exp(-hrs / WATER_P4.lineTauH), to = env.houseTemp + WATER_P4.lineOverC;
      for (let i = 0; i < W.lineTempC.length; i++) W.lineTempC[i] = X.flushMin[i] >= WATER_P4.flushMin ? WATER_P4.tankC : W.lineTempC[i] + (to - W.lineTempC[i]) * k;
    }
    if (farm.condition === 'water') {
      const T = farm.waterTank;
      W.supplyK = Math.max(0.3, Math.min(1, T.levelPct / WATER_TANK.linesFromPct));
      env.padWorking = Math.max(0, Math.min(1, farm.house.padWorking ?? 1)) * Math.max(0, Math.min(1, T.levelPct / WATER_TANK.padFromPct));
    }
    if (W.lineTempC || W.supplyK != null || X.filterK) { if (X.filterK) W.filterFactor = Math.min(W.filterFactor, X.filterK); updateAccess(W, farm.age); if (W.mainClosed) { W.access = 0; for (const l of W.lines) l.access = 0; } }
    return;
  }
  stepTank(farm, env, hrs);
}

/** The tank (the water condition): the pump fills it under fullPct, the lines and the pads draw on it. */
function stepTank(farm, env, hrs) {
  const T = farm.waterTank, X = farm.condX, W = farm.water, cap = WATER_TANK.m3 * 1000;
  const wear = stateOf(farm, 'pump-wear'), def = WEAR;
  if (T.fixing && env.day >= T.fixUntil - 1e-9) {
    T.fixing = false; T.fixedAt = +env.day.toFixed(5); T.pumpShare = 1; T.fixUntil = null;
    condFix(farm, env, 'pump-wear', 'repair');
  } else if (!T.fixing && wear && (wear.phase === 'active' || wear.phase === 'found') && wear.startedAt != null) {
    T.pumpShare = Math.max(def.minShare, 1 - def.lossPerDay * (env.day - wear.startedAt));
  }
  const birdsL = Math.max(0, W.meterL - (X.meterL ?? W.meterL)); X.meterL = W.meterL;
  // the pads draw what they evaporate on their wet share, plus the bleed: padBleed of the full pad's flow, which the pad
  // pump sends down the pad whatever its wetness (model; PHASE4.md §2.7)
  const full = env.padOn && env.powerOn !== false ? PAD_EFF * Math.max(0, env.outsideTemp - wetBulbOf(env.outsideTemp, env.outsideRH)) : 0;
  const padLh = ((0.49 * full * env.fansEffective * EQUIP.fanM3h) / 1000) * (Math.min(1, env.padWorking) + WATER_TANK.padBleed);
  const pumpLh = !T.fixing && env.powerOn !== false && T.levelPct < WATER_TANK.fullPct ? WATER_TANK.pumpM3h * 1000 * T.pumpShare : 0;
  const L = Math.max(0, Math.min(cap, (T.levelPct / 100) * cap + (pumpLh - padLh) * hrs - birdsL));
  if (pumpLh > 0 && hrs > 0) T.pumpHours = +((T.pumpHours || 0) + hrs).toFixed(4);   // the pump's run hours (the panel's counter)
  T.levelPct = (100 * L) / cap;
  if (T.levelPct < T.lowPct) { T.lowPct = T.levelPct; T.lowAt = +env.day.toFixed(5); }
  const d = env.dayNumber, D = X.tankDays[d] || (X.tankDays[d] = { low: 100, lowAt: null, padMaxLh: 0, birdsMaxLh: 0, under20H: 0 });
  if (T.levelPct < D.low) { D.low = +T.levelPct.toFixed(2); D.lowAt = +env.hour.toFixed(2); }
  D.padMaxLh = Math.max(D.padMaxLh, Math.round(padLh)); if (hrs > 0) D.birdsMaxLh = Math.max(D.birdsMaxLh, Math.round(birdsL / hrs));
  if (T.levelPct < WATER_TANK.linesFromPct) D.under20H = +(D.under20H + hrs).toFixed(4);
}

/** The pump's gauges now: WATER_TANK.pumpBar x pumpShare bar, pumpA + 3 x (1 - pumpShare) A (0 while it is stopped). */
export const pumpGauges = (T) => ({ pumpBar: +(T.fixing ? 0 : WATER_TANK.pumpBar * T.pumpShare).toFixed(2), pumpA: +(T.fixing ? 0 : WATER_TANK.pumpA + 3 * (1 - T.pumpShare)).toFixed(1), pumpOn: !T.fixing });

/** The tank and the pump (PHASE4.md §10.3: every one answers at once; pump.fix starts a farm process). */
export function waterAct(farm, env, id, a = {}) {
  const T = farm.waterTank, X = farm.condX;
  switch (id) {
    case 'water.tank': {
      const r = { levelPct: Math.round(T.levelPct), lowPct: Math.round(T.lowPct), lowAt: T.lowAt, ...pumpGauges(T) };
      X.gauges.push([env.dayNumber, +env.hour.toFixed(2), r.pumpBar, r.pumpA, r.levelPct, r.lowPct, T.lowAt]); if (X.gauges.length > 30) X.gauges.shift();
      T.lowPct = T.levelPct; T.lowAt = null;                    // the marker goes back to the level at each reading
      return r;
    }
    case 'pump.fix': {
      const worn = T.pumpShare < 0.99;
      if (T.fixing) return { started: false, worn, hours: WATER_TANK.repairH };
      T.fixing = true; T.fixFrom = +env.day.toFixed(5); T.fixUntil = env.day + WATER_TANK.repairH * H;
      return { started: true, worn, hours: WATER_TANK.repairH };
    }
    case 'water.test': {
      if (farm.condition !== 'water') return undefined;
      const base = cycleAct(farm, env, id, a);
      return { ...base, ironMgL: +(WATER_P4.ironMgL + (farm.rng.next() - 0.5) * 0.1).toFixed(2) };
    }
    case 'water.flowtest': {
      if (!farm.water.lineTempC) return undefined;
      const base = doAct(farm, env, id, a), i = Math.max(0, Math.min(3, Math.round(a.line ?? 0)));
      return { ...base, waterC: +farm.water.lineTempC[i].toFixed(1) };
    }
    default: return undefined;
  }
}

/** Symptoms and fixes of the water condition carried by actions. */
export function waterSymptoms(farm, env, id, a, result) {
  if (farm.condition !== 'water') return;
  const target = flowTargetAt(Math.max(0, env.dayNumber)), T = farm.waterTank;
  switch (id) {
    case 'water.test': if (result && result.ironMgL != null) condFind(farm, env, 'iron-water', 'test', true); break;
    case 'water.flowtest': {
      const ml = result && result.mlMin;
      if (!(ml < 0.8 * target)) break;
      if (isActive(farm, 'iron-filter')) condFind(farm, env, 'iron-filter', 'flowtest');
      if (isActive(farm, 'iron-nipples') && Math.round(a.line ?? 0) === 3) condFind(farm, env, 'iron-nipples', 'flowtest');
      if (isActive(farm, 'pump-wear') && env.hour >= 15 && T.levelPct < WATER_TANK.linesFromPct) condFind(farm, env, 'pump-wear', 'flowtest');
      break;
    }
    case 'water.filter': if (isActive(farm, 'iron-filter') && result && result.outBar < 0.8 * result.inBar) condFind(farm, env, 'iron-filter', 'filter'); break;
    case 'water.clearFilter':
      if (isOn(farm, 'iron-filter')) {
        (farm.condX.ironFixed || (farm.condX.ironFixed = [])).push([+(stateOf(farm, 'iron-filter').startedAt ?? env.day).toFixed(4), +env.day.toFixed(4)]);
        farm.condX.filterK = null; condFix(farm, env, 'iron-filter', 'clean');
      }
      break;
    case 'water.tank': {
      const S = farm.condX.st; if (S && !S.tankReadDays.includes(env.dayNumber)) S.tankReadDays.push(env.dayNumber);
      if (isActive(farm, 'pump-wear') && result && ((result.pumpOn && result.pumpBar <= WATER_TANK.wornBar) || result.lowPct < WATER_TANK.lowPct)) condFind(farm, env, 'pump-wear', result.lowPct < WATER_TANK.lowPct ? 'marker' : 'gauges');
      break;
    }
    case 'water.meter': if (isActive(farm, 'pump-wear') && result && result.changePct != null && result.changePct <= -5) condFind(farm, env, 'pump-wear', 'meter'); break;
    case 'pump.fix': if (result && result.started) { const X = farm.condX; X.pumpFixStart = X.pumpFixStart ?? +env.day.toFixed(5); } break;
    default:
  }
}
/** A listen stop after 15:00 with the tank under 20 %: the birds crowd along the drinker lines. */
export function waterBus(farm, env, type) {
  if (farm.condition !== 'water' || type !== EV.LISTEN) return;
  if (isActive(farm, 'pump-wear') && env.hour >= 15 && farm.waterTank.levelPct < WATER_TANK.linesFromPct && farm.flock.alive > 0) condFind(farm, env, 'pump-wear', 'listen');
}
