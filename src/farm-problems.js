// Farm model, problem events (PHASE2.md §7): start silently, decide when the farmer met a
// symptom (from an action he took, an EV.NEAR from props, a radio forecast or the farm's own
// state), and when it was fixed. Also the weather events the problems own, the zones props
// watches (farm.problemZones()), the office radio (forecast) and what he sees (observe).
import { DRINKER_LINES_Z, HEATERS, LEVEL1, WEATHER, feedStdGAt } from './config.js';
import { EV } from './events.js';
import { cellIndex } from './farm-litter.js';

const at = (d, h) => d + h / 24;

export function createProblems(level = LEVEL1) {
  const list = level.problems.map((p) => ({ id: p.id, phase: 'pending', startedAt: null, foundAt: null, fixedAt: null, foundBy: null }));
  list.push({ id: 'abnormal-deaths', phase: 'pending', startedAt: null, foundAt: null, fixedAt: null, foundBy: null });
  return list;
}

const defOf = (farm, id) => (farm.level || LEVEL1).problems.find((p) => p.id === id) || null;
const stateOf = (farm, id) => farm.problems.find((p) => p.id === id) || null;
export const isActive = (farm, id) => { const p = stateOf(farm, id); return !!p && p.phase === 'active'; };
const isOn = (farm, id) => { const p = stateOf(farm, id); return !!p && (p.phase === 'active' || p.phase === 'found'); };

/** The env weather events of the level's problems (added at start and again after a restore). */
export function installWeather(farm, env) {
  for (const p of (farm.level || LEVEL1).problems) {
    if (!p.until) continue;
    const drop = p.outsideDrop != null ? p.outsideDrop : -(p.outsideRise || 0);
    env.addWeatherEvent({ id: p.id, fromDay: at(p.day, p.hour), toDay: at(p.until.day, p.until.hour), outsideDrop: drop });
  }
}

/** Apply what an active problem changes in the house (also after a restore). */
export function applyEffects(farm, env) {
  const out = [];
  for (const st of farm.problems) {
    const def = defOf(farm, st.id);
    const on = st.phase === 'active' || st.phase === 'found';
    if (st.id === 'brooder-out' && on && !st.relit) out.push(def.heater);
    if (st.id === 'blocked-filter') farm.water.filterFactor = on ? def.flowFactor : 1;
    if (st.id === 'leaking-nipple' && on && !farm.water.leak && !st.leakFixed) {
      const z = DRINKER_LINES_Z[def.line];
      farm.water.leak = { line: def.line, x: def.x, z, cell: cellIndex(def.x, z) };
    }
  }
  env.setBrooderOut(out);
}

/** Start problems whose time came; the warm afternoon's state rule. Called every step. */
export function tickProblems(farm, env) {
  for (const st of farm.problems) {
    if (st.phase !== 'pending') continue;
    const def = defOf(farm, st.id);
    if (!def || env.day < at(def.day, def.hour) - 1e-9) continue;
    st.phase = 'active'; st.startedAt = env.day;
    applyEffects(farm, env);
    farm.emit(EV.FARM_PROBLEM, { id: st.id, phase: 'start' });
  }
  const warm = stateOf(farm, 'warm-afternoon');
  if (warm && warm.phase === 'found') {
    const ok = env.houseTemp <= env.targetTemp + 1.5;
    warm.okSince = ok ? (warm.okSince ?? env.day) : null;
    if (ok && env.day - warm.okSince >= 0.5 / 24 - 1e-9) fixProblem(farm, env, 'warm-afternoon', 'house');
  }
}

/** The farmer met a symptom: phase 'found' and EV.FARM_PROBLEM symptom (once). */
export function findProblem(farm, env, id, by, allowPending = false) {
  const st = stateOf(farm, id);
  if (!st || !(st.phase === 'active' || (allowPending && st.phase === 'pending'))) return false;
  st.phase = 'found'; st.foundAt = env.day; st.foundBy = by;
  farm.emit(EV.FARM_PROBLEM, { id, phase: 'symptom', by });
  return true;
}

export function fixProblem(farm, env, id, by) {
  const st = stateOf(farm, id);
  if (!st || st.phase === 'fixed' || st.phase === 'pending') return false;
  if (st.phase === 'active') findProblem(farm, env, id, by);
  st.phase = 'fixed'; st.fixedAt = env.day;
  applyEffects(farm, env);
  farm.emit(EV.FARM_PROBLEM, { id, phase: 'fixed', by });
  return true;
}

/** Feed the flock needs today (kg): birds x the plate's g/bird for this HUD day. */
export const feedNeedKg = (farm, env) => (Math.max(farm.flock.alive, farm.flock.inBoxes, 0) * feedStdGAt(env.dayNumber + 0.5 - 1 / 3)) / 1000;

/** Symptoms carried by actions (farm.act results and the ui-only actions). */
export function actionSymptoms(farm, env, id, args, result) {
  switch (id) {
    case 'water.flowtest':
      if (isActive(farm, 'blocked-filter') && result && result.mlMin < 0.8 * (env.dayNumber + 20)) findProblem(farm, env, 'blocked-filter', 'flowtest');
      break;
    case 'water.filter':
      if (isActive(farm, 'blocked-filter') && result && result.outBar < 0.8 * result.inBar) findProblem(farm, env, 'blocked-filter', 'filter');
      break;
    case 'litter.squeeze': {
      const leak = farm.water.leak;
      if (leak && isActive(farm, 'leaking-nipple') && result && result.moisturePct >= 35 && Math.hypot(args.x - leak.x, args.z - leak.z) <= 2) findProblem(farm, env, 'leaking-nipple', 'squeeze');
      break;
    }
    case 'feed.silo':
      if (isActive(farm, 'low-silo') && result && result.kg < 2 * feedNeedKg(farm, env)) findProblem(farm, env, 'low-silo', 'silo');
      break;
    case 'radio.listen': {
      const def = defOf(farm, 'cold-night');
      if (def && (args.day ?? env.dayNumber) === def.day && env.dayNumber === def.day) findProblem(farm, env, 'cold-night', 'radio', true);
      break;
    }
    case 'controller.read': {
      const cold = defOf(farm, 'cold-night'), house = args.houseC ?? env.houseTemp;
      if (cold && env.dayNumber === cold.day && env.hour >= 20 && house < env.targetTemp - 1) findProblem(farm, env, 'cold-night', 'controller', true);
      if (isActive(farm, 'warm-afternoon') && house >= env.targetTemp + 2) findProblem(farm, env, 'warm-afternoon', 'controller');
      break;
    }
    case 'phone.report':
      if (isOn(farm, 'abnormal-deaths')) fixProblem(farm, env, 'abnormal-deaths', 'phone');
      break;
    default:
  }
}

/** Dead birds counted at the bin: more than 0.3 % of the placed chicks in one day is abnormal. */
export function deathsCounted(farm, env, countedToday) {
  const st = stateOf(farm, 'abnormal-deaths');
  if (!st || st.phase !== 'pending' || farm.flock.placed <= 0) return;
  if (countedToday > 0.003 * farm.flock.placed) {
    st.phase = 'active'; st.startedAt = env.day;
    farm.emit(EV.FARM_PROBLEM, { id: st.id, phase: 'start' });
    findProblem(farm, env, st.id, 'bin');
  }
}

export function onNear(farm, env, p) { if (p && p.problemId && isActive(farm, p.problemId)) findProblem(farm, env, p.problemId, 'near'); }
export function onListen(farm, env) {
  if (isActive(farm, 'warm-afternoon') && farm.comfort.pantShare > 0.2) findProblem(farm, env, 'warm-afternoon', 'listen');
}

/** Zones where standing still is a symptom (only active, not yet found problems). */
export function problemZones(farm) {
  const z = [];
  if (isActive(farm, 'brooder-out')) {
    const h = HEATERS[defOf(farm, 'brooder-out').heater];
    z.push({ problemId: 'brooder-out', x: h.x, z: h.z, r: 2.5, dwellSec: 2 });
  }
  const leak = farm.water.leak;
  if (leak && isActive(farm, 'leaking-nipple') && farm.litter.moistureGrid[leak.cell] >= 35) {
    z.push({ problemId: 'leaking-nipple', x: leak.x, z: leak.z, r: 1.5, dwellSec: 2, minMoisture: 35 });
  }
  return z;
}

/** The office radio: tonight's low and tomorrow's high for HUD day `day`. */
export function forecast(farm, env, day) {
  const w = WEATHER[env.weather] || WEATHER.cool;
  const evs = env.weatherEvents || [];
  const effect = (t) => evs.reduce((a, e) => a + (t > e.fromDay && t < e.toDay ? e.outsideDrop : 0), 0);
  const night = at(day + 1, 4), noon = at(day + 1, 15), today = at(day, 15);
  const lowC = Math.round(w.min - effect(night)), highC = Math.round(w.max - effect(noon)), todayHigh = Math.round(w.max - effect(today));
  let text = `Tonight: clear, low ${lowC} °C. Tomorrow: up to ${highC} °C.`;
  if (lowC <= w.min - 3) text = `Tonight: cold, low ${lowC} °C. Tomorrow: up to ${highC} °C.`;
  else if (highC >= w.max + 3) text = `Tonight: low ${lowC} °C. Tomorrow afternoon hot, up to ${highC} °C.`;
  else if (todayHigh >= w.max + 3) text = `This afternoon hot, up to ${todayHigh} °C. Tonight: low ${lowC} °C.`;
  return { day, lowC, highC, text };
}

/** What the farmer sees and hears at (x, z): neutral words from the model there. */
export function observe(farm, env, x, z) {
  const fl = farm.flock;
  if (!fl.present || fl.alive <= 0) return { spread: 'no chicks here yet', droppings: 'none', sounds: 'quiet' };
  const e = env.comfort(x, z);
  const spread = e < -2 ? 'huddled under the brooder' : e > 2 ? 'along the walls, beaks open' : 'evenly spread';
  const droppings = fl.droppings === 'watery' ? 'wet and runny' : fl.droppings === 'few' ? 'few droppings' : 'firm, brown with a white cap';
  const C = farm.comfort, f = fl.factors;
  const distress = C.coldShare > 0.1 || f.fF < 0.6 || farm.water.access < 0.6;
  const sounds = distress ? 'loud peeping' : farm.litter.ammoniaPpm > 15 ? 'snicking' : 'quiet chirping';
  return { spread, droppings, sounds };
}
