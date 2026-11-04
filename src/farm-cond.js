// Phase 4: the harder replay conditions in the farm model (PHASE4.md §4, §10.5). Owner: package "sim".
// STUB (the Phase 4 design): the state other packages read and the minimal answers they build against; the sim
// package replaces it with the model of PHASE4.md §4 (the condition's problems and weather through
// config conditionLevel, the delivery of a bad batch, the power cut through env.powerOn in sim.js, the well pump
// and the tank, the iron, the storms' rain, the line water in the heat), keeping every name and shape here.
//
// farm.condition is the only place the condition is held (PHASE4.md §10.5): the run sets it through
// farm.start(def, { condition }); farm.setCondition(id) changes it on a running farm (the other packages' harness runs,
// __game.setCondition): either way the farm installs conditionLevel(def, condition).problems (the dropped ones end, the
// added ones wait for their hour), their weather events, the condition's weather and daily sun, and the cycle climate.
//
// State (PHASE4.md §10.4), JSON-safe, saved with the farm (farm.serialize().cond):
//   farm.condition    null | 'hot' | 'rainy' | 'badChicks' | 'water'
//   farm.power        { mains: bool (the grid supplies power), on: bool (the house has power), source: 'mains'|'generator'|null }
//   farm.generator    { running, fuelL, hours, testedDay, startedAt, hoursLeft }   (config GENERATOR)
//   farm.weatherNow   { rain: 0..1, storm: bool, id: problem id | null }  (the scene's rain, the radio, look notes)
//   farm.house.flapsClosed   the storm flaps on the south side-wall inlets (inlets.storm)
//   farm.waterTank    { levelPct, lowPct, lowAt, pumpShare (0..1 of WATER_TANK.pumpM3h), fixing: bool, fixUntil, fixedAt }
//   farm.brood        { trays: bool }   (feed trays and chick paper by the brooders, a bad batch)
//   farm.flock.claimed   chicks graded out on day 0 (the hatchery's claim once told; not in the level's deaths + culls)
//   farm.water.lineTempC  the water in each drinker line, °C (the hot season)
// Actions (PHASE4.md §10.3; farm.act routes them here first, undefined = not a Phase 4 action). Every one answers at
// once with its final result: the short waits (gen.start 2 min, gen.test 10 min, chicks.grade 6 min) are the panel's
// bar at the panel clock before it calls the action; pump.fix starts a farm process (fixing for WATER_TANK.repairH).
import { CONDITIONS, GENERATOR, WATER_TANK, LEVEL1, PLAN_LEVEL, conditionLevel } from './config.js';
import { EV } from './events.js';

const at = (d, h) => d + h / 24;
const fresh = () => ({
  power: { mains: true, on: true, source: 'mains' },
  generator: { running: false, fuelL: GENERATOR.fuelL, hours: 0, testedDay: null, startedAt: null, hoursLeft: GENERATOR.fuelL / GENERATOR.litresPerH },
  weatherNow: { rain: 0, storm: false, id: null },
  waterTank: { levelPct: WATER_TANK.startPct, lowPct: WATER_TANK.startPct, lowAt: null, pumpShare: 1, fixing: false, fixUntil: null, fixedAt: null },
  brood: { trays: false },
});
const pState = (id) => ({ id, phase: 'pending', startedAt: null, foundAt: null, fixedAt: null, foundBy: null });

/** Add the Phase 4 state to the farm (createFarm calls this once, after installCycle). */
export function installConditions(farm, env) {
  farm.condStub = true;
  farm.condition = null;
  Object.assign(farm, fresh());
  farm.flock.claimed = 0;
  farm.house.flapsClosed = false;
  const start = farm.start, serialize = farm.serialize, restore = farm.restore, enterLevel = farm.enterLevel;
  farm.start = (level, opts = {}) => {
    start(level, opts);
    farm.condition = opts.condition && CONDITIONS[opts.condition] ? opts.condition : opts.keepClock ? farm.condition : null;
    Object.assign(farm, fresh()); farm.flock.claimed = 0; farm.house.flapsClosed = false;
    stubPower(farm, env, true);
    installCondition(farm, env);
  };
  farm.enterLevel = (def) => { const r = enterLevel(def); if (r) installCondition(farm, env); return r; };
  /** Put a condition on the running farm (null = the normal season): its problems, weather and sun for this level. */
  farm.setCondition = (id) => {
    farm.condition = id && CONDITIONS[id] ? id : null;
    installCondition(farm, env, { reset: true });
    farm.emit(EV.LEVEL, { phase: 'condition', condition: farm.condition, day: env.dayNumber });
    return farm.condition;
  };
  farm.serialize = () => {
    const d = serialize();
    d.cond = { condition: farm.condition, power: { ...farm.power }, generator: { ...farm.generator }, waterTank: { ...farm.waterTank }, brood: { ...farm.brood },
      flapsClosed: !!farm.house.flapsClosed, claimed: farm.flock.claimed || 0 };
    return d;
  };
  farm.restore = (data) => {
    restore(data);
    const c = data && data.cond;
    Object.assign(farm, fresh());
    farm.condition = c && CONDITIONS[c.condition] ? c.condition : null;
    if (c) { Object.assign(farm.power, c.power); Object.assign(farm.generator, c.generator); Object.assign(farm.waterTank, c.waterTank); Object.assign(farm.brood, c.brood);
      farm.house.flapsClosed = !!c.flapsClosed; farm.flock.claimed = c.claimed || 0; }
    if (farm.condition && farm.mode === 'level') { climateOf(farm, env); installWeatherOf(farm, env); } // the problem states came with the save
  };
  /** The condition's version of a level (config conditionLevel with the farm's condition). */
  farm.levelFor = (def) => conditionLevel(def, farm.condition);
  /** Tests and harness: cut the mains (false) or bring it back (true). In a rainy run a cut is also the power-cut alarm. */
  farm.debug.power = (mainsOn) => {
    farm.power.mains = !!mainsOn; stubPower(farm, env, false);
    if (!mainsOn && farm.condition === 'rainy') symptom(farm, env, 'power-cut', 'alarm', true);
    return { ...farm.power };
  };
  /** Tests and harness: the farmer met a condition problem's symptom (EV.FARM_PROBLEM symptom; alarm ones with alarm). */
  farm.debug.symptom = (id) => symptom(farm, env, id, 'debug', true);
  env.addStepper((e, s) => { if (farm.mode === 'level') stepCond(farm, env, s / 3600); });
}

const levelDef = (farm) => farm.cycleLevel || farm.level || LEVEL1;
const condDef = (farm, id) => conditionLevel(levelDef(farm), farm.condition).problems.find((p) => p.id === id) || null;

/** The merged problems of the level on the farm: dropped ones end, added ones wait (pending), and their weather.
 *  No condition: nothing at all (every Phase 1-3 number stays as it is), unless a harness switched one off again. */
function installCondition(farm, env, { reset = false } = {}) {
  if (farm.mode !== 'level' || (!farm.condition && !reset)) return;
  const def = levelDef(farm), m = conditionLevel(def, farm.condition), ids = new Set(m.problems.map((p) => p.id));
  const own = (id) => (def.problems || []).some((p) => p.id === id);
  for (const st of farm.problems) if (st.phase === 'pending' && own(st.id) && !ids.has(st.id)) st.phase = 'ended';
  // switched back on a running farm: a problem the last condition dropped waits again if its hour is still to come
  const later = (id) => { const p = (def.problems || []).find((q) => q.id === id); return !!p && Number.isFinite(p.day) && at(p.day, p.hour) > env.day; };
  if (reset) for (const st of farm.problems) if (st.phase === 'ended' && ids.has(st.id) && own(st.id) && st.startedAt == null && later(st.id)) st.phase = 'pending';
  for (const p of m.problems) if (!farm.problems.some((st) => st.id === p.id)) farm.problems.push(pState(p.id));
  climateOf(farm, env);
  installWeatherOf(farm, env);
}
function climateOf(farm, env) {
  const def = levelDef(farm), m = conditionLevel(def, farm.condition);
  if (def.id !== PLAN_LEVEL.id && m.weather) env.setWeather(m.weather);
  if (m.cycleClimate && !env.cycleClimate) env.setCycleClimate(true);
}

/** Weather events of the problems the condition drops (removed), replaces or adds (installed), and its daily sun. */
function installWeatherOf(farm, env) {
  const def = levelDef(farm), m = conditionLevel(def, farm.condition), ids = new Set(m.problems.map((p) => p.id));
  const own = new Map((def.problems || []).map((p) => [p.id, p]));
  env.weatherEvents = env.weatherEvents.filter((ev) => !/^sun-/.test(ev.id) && (ids.has(ev.id) || !own.has(ev.id)));
  for (const p of m.problems) {
    // the level's own, untouched and still there: as Phase 2 / 3 put it (re-added if a condition had dropped it)
    if (!p.until || (own.get(p.id) === p && env.weatherEvents.some((e) => e.id === p.id))) continue;
    const ev = { id: p.id, fromDay: at(p.day, p.hour), toDay: at(p.until.day, p.until.hour), outsideDrop: p.outsideDrop != null ? p.outsideDrop : -(p.outsideRise || 0), heatPerH: p.sunPerH || 0 };
    if (Number.isFinite(p.rh)) ev.rh = p.rh;
    if (Number.isFinite(p.rhDrop)) ev.rhDrop = p.rhDrop;
    env.addWeatherEvent(ev);
  }
  const sun = farm.condition && CONDITIONS[farm.condition].sun;
  if (sun) for (let d = (def.startDay ?? 0) - 1; d <= (def.endDay ?? 42) + 1; d++) env.addWeatherEvent({ id: `sun-${d}`, fromDay: at(d, sun.fromHour), toDay: at(d, sun.toHour), outsideDrop: 0, heatPerH: sun.perH });
}

/** A condition problem's symptom: phase found, EV.FARM_PROBLEM symptom (alarm problems carry alarm: true). */
function symptom(farm, env, id, by, allowPending = false) {
  const st = farm.problems.find((p) => p.id === id), def = condDef(farm, id);
  if (!st || !(st.phase === 'active' || (allowPending && st.phase === 'pending'))) return false;
  if (st.phase === 'pending') { st.phase = 'active'; st.startedAt = env.day; farm.emit(EV.FARM_PROBLEM, { id, phase: 'start' }); }
  st.phase = 'found'; st.foundAt = env.day; st.foundBy = by;
  farm.emit(EV.FARM_PROBLEM, { id, phase: 'symptom', by, ...(def && def.alarm ? { alarm: true } : {}) });
  return true;
}
function fixCond(farm, env, id, by) {
  const st = farm.problems.find((p) => p.id === id);
  if (!st || st.phase === 'fixed' || st.phase === 'pending' || st.phase === 'ended') return;
  st.phase = 'fixed'; st.fixedAt = env.day; st.fixedBy = by;
  farm.emit(EV.FARM_PROBLEM, { id, phase: 'fixed', by });
}

// STUB: the condition problems the level def does not have start at their hour (alarm ones emit their symptom at
// once); the power cut and the mains' return; the generator's fuel; the worn pump and its repair; the storms' rain.
function stepCond(farm, env, hrs) {
  if (!farm.condition) return;
  const def = levelDef(farm), t = env.day;
  for (const p of conditionLevel(def, farm.condition).problems) {
    if ((def.problems || []).some((q) => q.id === p.id) || p.conditional) continue;
    const st = farm.problems.find((x) => x.id === p.id);
    if (!st || st.phase !== 'pending' || t < at(p.day, p.hour) - 1e-9) continue;
    st.phase = 'active'; st.startedAt = t;
    farm.emit(EV.FARM_PROBLEM, { id: p.id, phase: 'start' });
    if (p.id === 'power-cut') { farm.power.mains = false; stubPower(farm, env, false); }
    if (p.alarm) symptom(farm, env, p.id, 'alarm');
  }
  const cut = condDef(farm, 'power-cut');
  if (cut && cut.back && !farm.power.mains && t >= at(cut.back.day, cut.back.hour) - 1e-9 && farm.problems.some((x) => x.id === 'power-cut' && x.phase !== 'pending')) {
    farm.power.mains = true;
    if (farm.power.source === 'generator') symptom(farm, env, 'mains-back', 'switch', true);
    stubPower(farm, env, false);
  }
  const G = farm.generator;
  if (G.running) {
    G.hours += hrs; G.fuelL = Math.max(0, G.fuelL - GENERATOR.litresPerH * hrs); G.hoursLeft = G.fuelL / GENERATOR.litresPerH;
    if (G.fuelL <= 0) { G.running = false; stubPower(farm, env, false); }
  }
  const T = farm.waterTank, wear = condDef(farm, 'pump-wear'), ws = farm.problems.find((x) => x.id === 'pump-wear');
  if (T.fixing && t >= T.fixUntil - 1e-9) { T.fixing = false; T.fixUntil = null; T.fixedAt = t; T.pumpShare = 1; fixCond(farm, env, 'pump-wear', 'repair'); }
  else if (!T.fixing && wear && ws && (ws.phase === 'active' || ws.phase === 'found')) T.pumpShare = Math.max(wear.minShare ?? 0.25, 1 - (wear.lossPerDay ?? 0.1) * (t - ws.startedAt));
  const s = conditionLevel(def, farm.condition).problems.find((p) => p.storm === true && p.until && t >= at(p.day, p.hour) && t < at(p.until.day, p.until.hour));
  farm.weatherNow.storm = !!s; farm.weatherNow.rain = s ? 1 : 0; farm.weatherNow.id = s ? s.id : null;
}

// STUB: the power cut acts on the env setters (the sim package moves it into sim.js: env.powerOn stops the fans,
// the timer, the pad, the lights and the brooders' ignition while it is false, and keeps the farmer's settings).
// The house dark again with the mains off and the cut already met (the generator ran dry or was stopped): gen-dry.
function stubPower(farm, env, reset) {
  const P = farm.power, G = farm.generator;
  const on = P.mains || (G.running && P.source === 'generator');
  const was = P.on;
  P.on = on; if (!P.mains && P.source === 'mains') P.source = null; if (P.mains && P.source == null) P.source = 'mains';
  if (reset) { farm._held = null; return; }
  if (was && !on) { farm._held = { fans: env.fansManual, timer: env.ventTimer, pad: env.padOn }; env.setFans(0); env.setVentTimer(null); env.setPad(false); }
  if (!was && on && farm._held) { env.setFans(farm._held.fans); env.setVentTimer(farm._held.timer); env.setPad(farm._held.pad); farm._held = null; }
  if (was !== on) farm.emit(EV.POWER, { on, source: P.source, mains: P.mains });
  if (was && !on && !P.mains && farm.condition === 'rainy' && farm.problems.some((x) => x.id === 'power-cut' && (x.phase === 'found' || x.phase === 'fixed'))) {
    const st = farm.problems.find((x) => x.id === 'gen-dry');
    if (st) { if (st.phase !== 'pending') Object.assign(st, pState('gen-dry')); symptom(farm, env, 'gen-dry', 'alarm', true); }
  }
  if (!was && on && farm.condition === 'rainy') { fixCond(farm, env, 'power-cut', 'power'); fixCond(farm, env, 'gen-dry', 'power'); }
}

/** Phase 4 actions (undefined: not one of them, farm.act goes on to the Phase 3 / Phase 2 actions). */
export function condAct(farm, env, id, a = {}) {
  const G = farm.generator, P = farm.power, T = farm.waterTank;
  switch (id) {
    case 'gen.start': if (G.fuelL > 0) { G.running = true; G.startedAt = +env.day.toFixed(5); } stubPower(farm, env, false); return { running: G.running, fuelL: Math.round(G.fuelL), hoursLeft: +G.hoursLeft.toFixed(1) };
    case 'gen.stop': G.running = false; if (P.source === 'generator') P.source = P.mains ? 'mains' : null; stubPower(farm, env, false); if (P.mains) fixCond(farm, env, 'mains-back', 'switch'); return { running: false, fuelL: Math.round(G.fuelL) };
    case 'gen.switch': P.source = a.to === 'generator' ? 'generator' : 'mains'; stubPower(farm, env, false); return { on: P.on, source: P.source };
    case 'gen.test': G.testedDay = env.dayNumber; G.fuelL = Math.max(0, G.fuelL - (GENERATOR.litresPerH * GENERATOR.testMin) / 60); G.hoursLeft = G.fuelL / GENERATOR.litresPerH; return { ok: G.fuelL > 0, fuelL: Math.round(G.fuelL), minutes: GENERATOR.testMin };
    case 'gen.fuel': G.fuelL = GENERATOR.fuelL; G.hoursLeft = G.fuelL / GENERATOR.litresPerH; return { fuelL: G.fuelL };
    case 'inlets.storm': farm.house.flapsClosed = !!a.closed; return true;
    case 'water.tank': {
      const r = { levelPct: Math.round(T.levelPct), lowPct: Math.round(T.lowPct), lowAt: T.lowAt, pumpBar: +(WATER_TANK.pumpBar * (T.fixing ? 0 : T.pumpShare)).toFixed(2),
        pumpA: +(T.fixing ? 0 : WATER_TANK.pumpA + 3 * (1 - T.pumpShare)).toFixed(1), pumpOn: !T.fixing };
      T.lowPct = T.levelPct; T.lowAt = null;                    // the marker goes back to the level at each reading
      if (r.pumpOn && r.pumpBar <= WATER_TANK.wornBar) symptom(farm, env, 'pump-wear', 'gauges');
      return r;
    }
    case 'pump.fix': {
      if (T.fixing) return { started: false, worn: T.pumpShare < 0.99, hours: WATER_TANK.repairH };
      const worn = T.pumpShare < 0.99;
      T.fixing = true; T.fixUntil = env.day + WATER_TANK.repairH / 24;
      return { started: true, worn, hours: WATER_TANK.repairH };
    }
    case 'chicks.grade': return { stack: a.stack ?? 0, looked: 1000, weak: 45, culled: 41, minutes: 6 };
    case 'brood.trays': farm.brood.trays = !!a.on; return true;
    default: return undefined;
  }
}
export { WATER_TANK };
