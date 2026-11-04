// Phase 4: the harder replay conditions in the farm model (PHASE4.md §4, §9.2, §10.4, §10.5). Owner: package "sim".
// The model of the four conditions: this file holds the condition (farm.condition, the only holder), installs the
// level as the condition plays it (config conditionLevel: the dropped problems end, the replaced and added ones wait
// for their hour; their weather, the daily sun, the cycle climate), starts the condition's problems, keeps their state
// across saves and routes the Phase 4 actions; the parts live in farm-cond-power.js (the power, the generator, storms,
// rain at the inlets, the damp spell), farm-cond-water.js (the tank, the well pump, iron, the line water in the heat)
// and farm-cond-chicks.js (a bad batch: delivery, grading, the claim, the infection, trays, the warmer target).
// No condition: nothing here changes a Phase 1-3 number (the normal season runs exactly as Phase 3 tuned by Phase 4).
//
// State (PHASE4.md §10.4), JSON-safe, saved with the farm (farm.serialize().cond):
//   farm.condition    null | 'hot' | 'rainy' | 'badChicks' | 'water'
//   farm.power        { mains, on, source, switch }   mains: the grid supplies power; switch: the transfer switch
//                     ('mains' | 'generator'); on: the house has power (the switch's source is live); source: what
//                     feeds the house now (the switch's source, null while dark)
//   farm.generator    { running, fuelL, hours, testedDay, startedAt, hoursLeft }   (config GENERATOR)
//   farm.weatherNow   { rain: 0..1, storm: bool, id: problem id | null }  (the scene's rain, the radio, look notes)
//   farm.house.flapsClosed   the storm flaps on the south side-wall inlets (inlets.storm: the timer air x 0.7)
//   farm.waterTank    { levelPct, lowPct, lowAt, pumpShare, fixing, fixUntil, fixedAt, fixFrom }
//   farm.brood        { trays }   (feed trays and chick paper by the brooders, a bad batch)
//   farm.flock.claimed / gradedOut   chicks graded out on day 0 claimed from the hatchery / all graded out
//   farm.water.lineTempC  the water in each drinker line, °C (the hot season only)
//   farm.condX        the model's working state (the delivery's day-0 culls, the hatchery call, flush minutes, the
//                     tank's day lows, the gauges read, generator tests)
// Actions (§10.3; farm.act routes them here first, undefined = not a Phase 4 action): every one answers at once with
// its final result (the short waits are the panel's bar); pump.fix starts a farm process (fixing for WATER_TANK.repairH).
import { CONDITIONS, LEVEL1, PLAN_LEVEL, levelById } from './config.js';
import { EV } from './events.js';
import { RECURRING } from './farm-cycle-problems.js';
import { at, pState, stateOf, levelDef, levelFor, condDef, isOwn, isOn, condFind, condFix } from './farm-cond-core.js';
import { powerFresh, stepGen, stepRainy, powerAct, powerSymptoms, powerBus, powerZones, setPowerEnv, powerStart } from './farm-cond-power.js';
import { waterFresh, stepWater, waterAct, waterSymptoms, waterBus, waterStart, waterInstall } from './farm-cond-water.js';
import { chicksFresh, chicksPre, stepChicks, chicksAct, chicksSymptoms, chicksBus, chicksZones, chicksInstall } from './farm-cond-chicks.js';
import { freshCondStats, stepCondStats, noteOutside } from './farm-cond-stats.js';

const fresh = () => ({ ...powerFresh(), ...waterFresh(), ...chicksFresh() });
const freshX = () => ({ day0Culls: 0, hatcheryAt: null, flushMin: [0, 0, 0, 0], tankDays: {}, gauges: [], genTests: [], st: freshCondStats() });
export { pState, stateOf, levelDef, levelFor, condDef, isOwn, isOn, condFind, condFix };

/** A condition problem starts (silently, EV.FARM_PROBLEM start); alarm problems emit their symptom at once. */
export function startCond(farm, env, st, def) {
  st.phase = 'active'; st.startedAt = env.day;
  farm.emit(EV.FARM_PROBLEM, { id: st.id, phase: 'start' });
  powerStart(farm, env, st, def); waterStart(farm, env, st, def);
  if (def && def.alarm && st.phase === 'active') condFind(farm, env, st.id, 'alarm');
}

/** Add the Phase 4 state to the farm (createFarm calls this once, after installCycle). */
export function installConditions(farm, env) {
  farm.condStub = false;
  farm.condition = null;
  Object.assign(farm, fresh());
  farm.condX = freshX();
  farm.flock.claimed = 0;
  farm.house.flapsClosed = false;
  farm.delivery = null;
  const start = farm.start, stop = farm.stop, serialize = farm.serialize, restore = farm.restore, enterLevel = farm.enterLevel, trigger = farm.debug.trigger;
  // back to the sandbox: no condition, the env's power, target and inlets as Phase 1's
  farm.stop = () => {
    stop();
    farm.condition = null; farm._lvCache = null; farm.delivery = null;
    Object.assign(farm, fresh()); farm.condX = freshX();
    env.setPower(true); env.setTargetShift(0); env.setInletShare(1);
    delete farm.water.lineTempC; delete farm.water.supplyK;
  };
  const forecast = farm.forecast, observe = farm.observe, zones = farm.problemZones;
  farm.start = (level = LEVEL1, opts = {}) => {
    // the condition first: the cycle's syncEnv inside start reads it (the cycle climate of the hot and rainy seasons)
    farm.condition = opts.condition !== undefined ? (CONDITIONS[opts.condition] ? opts.condition : null) : opts.keepClock ? farm.condition : null;
    farm._lvCache = null;
    farm.delivery = null;   // (a normal-season start after a bad batch: installCondition leaves the farm alone without a condition)
    start(level, opts);
    Object.assign(farm, fresh()); farm.condX = freshX(); farm.flock.claimed = 0; farm.house.flapsClosed = false;   // flock.gradedOut: once graded
    // a bad batch's slow start and late starters stay with that flock (review round: a new run after an abandoned bad
    // batch grew 12 % slower in its brooding week and failed week 2's weigh-in)
    farm.gainK72 = undefined; farm.lateK = undefined; farm.traysReach = 0;
    setPowerEnv(farm, env, true);
    installCondition(farm, env, { enter: true });
  };
  farm.enterLevel = (def) => { const r = enterLevel(def); if (r) installCondition(farm, env, { enter: true }); return r; };
  /** Put a condition on the running farm (null = the normal season): its problems, weather and sun for this level. */
  farm.setCondition = (id) => {
    farm.condition = id && CONDITIONS[id] ? id : null;
    farm._lvCache = null;
    installCondition(farm, env, { reset: true });
    farm.emit(EV.LEVEL, { phase: 'condition', condition: farm.condition, day: env.dayNumber });
    return farm.condition;
  };
  farm.serialize = () => {
    const d = serialize();
    d.cond = { condition: farm.condition, power: { ...farm.power }, generator: { ...farm.generator }, waterTank: { ...farm.waterTank }, brood: { ...farm.brood },
      flapsClosed: !!farm.house.flapsClosed, claimed: farm.flock.claimed || 0, gradedOut: farm.flock.gradedOut || 0, x: JSON.parse(JSON.stringify(farm.condX)) };
    return d;
  };
  farm.restore = (data) => {
    const c = data && data.cond;
    farm.condition = c && CONDITIONS[c.condition] ? c.condition : null;   // before the cycle's restore (syncEnv reads it)
    farm._lvCache = null;
    restore(data);
    Object.assign(farm, fresh()); farm.condX = freshX();
    if (c) {
      Object.assign(farm.power, c.power); Object.assign(farm.generator, c.generator); Object.assign(farm.waterTank, c.waterTank); Object.assign(farm.brood, c.brood);
      farm.house.flapsClosed = !!c.flapsClosed; farm.flock.claimed = c.claimed || 0; if (c.gradedOut) farm.flock.gradedOut = c.gradedOut;
      if (c.x) farm.condX = { ...freshX(), ...JSON.parse(JSON.stringify(c.x)) };
    }
    setPowerEnv(farm, env, false);
    if (farm.mode === 'level' && farm.condition) installCondition(farm, env, { restored: true }); // the problem states came with the save
  };
  /** The condition's version of a level (config conditionLevel with the farm's condition). */
  farm.levelFor = (def) => levelFor(farm, def || levelDef(farm));
  /** The office radio: the condition's storms, spells and their forecast days on top of the level's. */
  farm.forecast = (day = env.dayNumber) => condForecast(farm, env, day, forecast(day));
  farm.observe = (x, z) => condObserve(farm, env, x, z, observe(x, z));
  farm.problemZones = () => (farm.mode === 'level' && farm.condition ? [...zones(), ...powerZones(farm), ...chicksZones(farm)] : zones());
  /** Tests and harness: cut the mains (false) or bring it back (true). In a rainy run a cut is also the power-cut alarm. */
  farm.debug.power = (mainsOn) => {
    farm.power.mains = !!mainsOn;
    if (!mainsOn && farm.condition === 'rainy') { const st = stateOf(farm, 'power-cut'); if (st && (st.phase === 'pending' || st.phase === 'ended' || st.phase === 'fixed')) { Object.assign(st, pState('power-cut')); } }
    setPowerEnv(farm, env, false, 'debug');
    if (!mainsOn && farm.condition === 'rainy') { const st = stateOf(farm, 'power-cut'); if (st && st.phase === 'pending') { st.phase = 'active'; st.startedAt = env.day; farm.emit(EV.FARM_PROBLEM, { id: 'power-cut', phase: 'start' }); } condFind(farm, env, 'power-cut', 'alarm'); }
    return { ...farm.power };
  };
  /** Tests and harness: the farmer met a condition problem's symptom (EV.FARM_PROBLEM symptom; alarm ones with alarm). */
  farm.debug.symptom = (id) => condFind(farm, env, id, 'debug', true);
  /** Tests and harness: start any problem of the level as the condition plays it now. */
  farm.debug.trigger = (id) => {
    const st = stateOf(farm, id), def = condDef(farm, id);
    if (def && !isOwn(farm, id) && st && st.phase === 'pending') { startCond(farm, env, st, def); return; }
    trigger(id);
  };
}

/**
 * The merged problems of the level on the farm: dropped ones end, the condition's own wait (pending; re-armed when the
 * level is entered), their weather and the daily sun, the cycle climate and the condition's equipment state.
 * No condition and no reset: nothing at all (every Phase 1-3 number stays as it is).
 */
function installCondition(farm, env, { reset = false, enter = false, restored = false } = {}) {
  if (farm.mode !== 'level' || (!farm.condition && !reset)) return;
  const def = levelDef(farm), m = levelFor(farm, def), ids = new Set(m.problems.map((p) => p.id));
  const own = new Map((def.problems || []).map((p) => [p.id, p]));
  if (!restored) {
    for (const st of farm.problems) if (st.phase === 'pending' && own.has(st.id) && !ids.has(st.id)) st.phase = 'ended';
    // switched on a running farm: a problem the last condition dropped waits again if its hour is still to come; the
    // last condition's own problems end
    if (reset) {
      const later = (p) => !!p && Number.isFinite(p.day) && at(p.day, p.hour) > env.day;
      for (const st of farm.problems) {
        if (st.phase === 'ended' && ids.has(st.id) && own.has(st.id) && st.startedAt == null && later(own.get(st.id))) st.phase = 'pending';
        if ((st.phase === 'pending' || st.phase === 'active' || st.phase === 'found') && !ids.has(st.id) && !own.has(st.id) && !RECURRING.includes(st.id) && st.id !== 'abnormal-deaths') st.phase = 'ended';
      }
    }
    for (const p of m.problems) {
      if (own.has(p.id)) continue;
      const st = stateOf(farm, p.id);
      if (!st) farm.problems.push(pState(p.id));
      else if (enter || (reset && st.phase === 'ended')) Object.assign(st, pState(p.id));
    }
  }
  if (def.id !== PLAN_LEVEL.id && m.weather && env.weather !== m.weather) env.setWeather(m.weather);
  env.setCycleClimate(!!(farm.cyc && farm.cyc.on) || !!(farm.condition && m.cycleClimate));
  rebuildWeather(farm, env, def, m);
  if (def.id === LEVEL1.id && !restored) farm.delivery = m.delivery || null;
  else if (def.id === LEVEL1.id && restored) farm.delivery = levelFor(farm, LEVEL1).delivery || null;
  chicksInstall(farm, env, def); waterInstall(farm, env, def);
  env.setInletShare(farm.house.flapsClosed ? 0.7 : 1);
}

/** Every weather event of the level as the condition plays it (replaced fields merged) and the condition's daily sun. */
function rebuildWeather(farm, env, def, m) {
  env.clearWeatherEvents();
  for (const p of m.problems) {
    if (!p.until) continue;
    const ev = { id: p.id, fromDay: at(p.day, p.hour), toDay: at(p.until.day, p.until.hour), outsideDrop: p.outsideDrop != null ? p.outsideDrop : -(p.outsideRise || 0), heatPerH: p.sunPerH || 0 };
    if (Number.isFinite(p.rh)) ev.rh = p.rh;
    if (Number.isFinite(p.rhDrop)) ev.rhDrop = p.rhDrop;
    env.addWeatherEvent(ev);
  }
  const sun = farm.condition && CONDITIONS[farm.condition].sun;
  if (sun) for (let d = (def.startDay ?? 0) - 1; d <= (def.endDay ?? 42) + 1; d++) env.addWeatherEvent({ id: `sun-${d}`, fromDay: at(d, sun.fromHour), toDay: at(d, sun.toHour), outsideDrop: 0, heatPerH: sun.perH });
}

/** One farm step (farm.js stepFarm, first): the generator, the condition problems at their hour, storms, a bad batch. */
export function stepCond(farm, env, hrs) {
  stepGen(farm, env, hrs);
  if (!farm.condition || farm.mode !== 'level') return;
  const t = env.day;
  for (const p of levelFor(farm).problems) {
    if (!Number.isFinite(p.day) || p.conditional || isOwn(farm, p.id)) continue;
    const st = stateOf(farm, p.id);
    if (!st || st.phase !== 'pending' || t < at(p.day, p.hour) - 1e-9) continue;
    startCond(farm, env, st, p);
  }
  if (farm.condition === 'rainy') stepRainy(farm, env, hrs);
  // (always: a new run after an abandoned bad batch must not keep its slow start, review round)
  chicksPre(farm, env);
}
/** After the water lines' access (farm.js stepFarm): the line water, iron flushed out, the tank's pressure. */
export function stepCondWater(farm, env, hrs) { if (farm.condition && farm.mode === 'level') stepWater(farm, env, hrs, false); }
/** After the flock (farm.js stepFarm, last): the tank's balance, a bad batch's infection. */
export function stepCondPost(farm, env, hrs) {
  if (!farm.condition || farm.mode !== 'level') return;
  if (farm.condition === 'water') stepWater(farm, env, hrs, true);
  if (farm.delivery) stepChicks(farm, env, hrs);
  stepCondStats(farm, env, hrs);
}

/** Phase 4 actions (undefined: not one of them, farm.act goes on to the Phase 3 / Phase 2 actions). */
export function condAct(farm, env, id, a = {}) {
  const r = powerAct(farm, env, id, a);
  if (r !== undefined) return r;
  const w = waterAct(farm, env, id, a);
  if (w !== undefined) return w;
  return chicksAct(farm, env, id, a);
}
/** Symptoms and fixes carried by actions (after farm.act; also the ui-only actions on the bus: result undefined). */
export function condSymptoms(farm, env, id, a, result) {
  if (!farm.condition || farm.mode !== 'level') return;
  powerSymptoms(farm, env, id, a, result); waterSymptoms(farm, env, id, a, result); chicksSymptoms(farm, env, id, a, result);
  // the outside air he read off the controller or the fan panel (the records' "Outside 40.6 °C at 15:10")
  if (id === 'controller.read' || id === 'fans.read') noteOutside(farm, env, Number.isFinite(a.outsideC) ? a.outsideC : env.outsideTemp);
}
/** What the farm hears on the bus in a condition run (listen stops, EV.NEAR in a condition zone). */
export function condBus(farm, env, type, p = {}) {
  if (!farm.condition || farm.mode !== 'level') return;
  if (type === EV.NEAR && p.problemId && isOn(farm, p.problemId) && stateOf(farm, p.problemId).phase === 'active' && !isOwn(farm, p.problemId)) { condFind(farm, env, p.problemId, 'near'); return; }
  powerBus(farm, env, type, p); waterBus(farm, env, type, p); chicksBus(farm, env, type, p);
}

/** The radio: storms the day before, the hot spell and the damp spell on their forecast days. */
function condForecast(farm, env, day, base) {
  if (!farm.condition || farm.mode !== 'level') return base;
  const probs = levelFor(farm).problems;
  if (probs.some((p) => p.storm === true && p.day === day + 1)) return { ...base, text: `Storms tomorrow afternoon. ${base.text}` };
  if (probs.some((p) => p.storm === true && p.day === day && env.hour < p.hour)) return { ...base, text: `Storms this afternoon. ${base.text}` };
  const spell = probs.find((p) => p.id === 'hot-spell' && p.day === day + 1);
  if (spell) return { ...base, text: `Hot nights from tomorrow evening, hardly under 30 °C. ${base.text}` };
  const damp = probs.find((p) => p.id === 'damp-spell' && p.forecastDay === day);
  if (damp) return { ...base, text: `Rain and damp air for three days from tomorrow. ${base.text}` };
  return base;
}
/** What he sees and hears (neutral words): rain, the dark house, crowding at the lines, a bad batch's boxes. */
function condObserve(farm, env, x, z, o) {
  if (!farm.condition || farm.mode !== 'level') return o;
  const out = { ...o };
  if (!farm.power.on) { out.sounds = 'the house is dark and still: no fans'; return out; }
  if (farm.weatherNow.rain > 0) out.sounds = farm.weatherNow.storm && z > 3 && Math.abs(x) <= 12 && isOn(farm, 'rain-in') && !farm.house.flapsClosed ? 'rain blowing in at the inlets' : 'rain drumming on the roof';
  if (farm.condition === 'water' && env.hour >= 15 && farm.waterTank.levelPct < 20 && farm.flock.alive > 0) out.spread = 'birds crowding along the drinker lines';
  if (farm.condition === 'water' && farm.water.access < 0.6 && farm.flock.alive > 0) out.droppings = 'dry, firm droppings';
  if (farm.condition === 'badChicks' && farm.flock.inBoxes > 0) out.spread = 'small chicks, many lying still';
  return out;
}
export { levelById };
