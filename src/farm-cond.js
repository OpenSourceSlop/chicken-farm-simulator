// Phase 4: the harder replay conditions in the farm model (PHASE4.md §4, §10.5). Owner: package "sim".
// STUB (the Phase 4 design): the state other packages read and the minimal answers they build against; the sim
// package replaces it with the model of PHASE4.md §4 (the condition's problems and weather through
// config conditionLevel, the delivery of a bad batch, the power cut through env.powerOn in sim.js, the well pump
// and the tank, the iron, the storms' rain, the line water in the heat).
//
// State (PHASE4.md §10.4), JSON-safe, saved with the farm (farm.serialize().cond):
//   farm.condition    null | 'hot' | 'rainy' | 'badChicks' | 'water'   (farm.start(def, { condition }))
//   farm.power        { mains: bool (the grid supplies power), on: bool (the house has power), source: 'mains'|'generator'|null }
//   farm.generator    { running, fuelL, hours, testedDay, startedAt }   (config GENERATOR)
//   farm.weatherNow   { rain: 0..1, storm: bool, id: problem id | null }  (the scene's rain, the radio, look notes)
//   farm.house.flapsClosed   the storm flaps on the south side-wall inlets (inlets.storm)
//   farm.waterTank    { levelPct, pumpShare (0..1 of WATER_TANK.pumpM3h), fixing: bool, fixedAt }   (water condition: the tank
//                     feeds the lines and the pads)
//   farm.brood        { trays: bool }   (feed trays and chick paper by the brooders, a bad batch)
//   farm.flock.claimed   chicks graded out at the table (the hatchery's claim; not in the level's deaths + culls)
//   farm.water.lineTempC  the water in the drinker lines, °C (the hot season's midday flush)
// Actions (PHASE4.md §10.3; farm.act routes them here first, undefined = not a Phase 4 action):
//   gen.start / gen.stop / gen.test / gen.fuel / gen.switch { to }, inlets.storm { closed }, water.tank, pump.fix,
//   chicks.grade { stack }, brood.trays { on }; water.test gains ironMgL (the water condition's iron)
import { CONDITIONS, GENERATOR, WATER_TANK, levelOfDay, conditionLevel } from './config.js';
import { EV } from './events.js';

const fresh = () => ({
  power: { mains: true, on: true, source: 'mains' },
  generator: { running: false, fuelL: GENERATOR.fuelL, hours: 0, testedDay: null, startedAt: null },
  weatherNow: { rain: 0, storm: false, id: null },
  waterTank: { levelPct: 85, pumpShare: 1, fixing: false, fixedAt: null },
  brood: { trays: false },
});

/** Add the Phase 4 state to the farm (createFarm calls this once, after installCycle). */
export function installConditions(farm, env) {
  farm.condStub = true;
  farm.condition = null;
  Object.assign(farm, fresh());
  farm.flock.claimed = 0;
  farm.house.flapsClosed = false;
  const start = farm.start, serialize = farm.serialize, restore = farm.restore;
  farm.start = (level, opts = {}) => {
    start(level, opts);
    farm.condition = opts.condition && CONDITIONS[opts.condition] ? opts.condition : opts.keepClock ? farm.condition : null;
    Object.assign(farm, fresh()); farm.flock.claimed = 0; farm.house.flapsClosed = false;
    stubPower(farm, env, true);
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
  };
  /** The condition's version of a level (config conditionLevel with the farm's condition). */
  farm.levelFor = (def) => conditionLevel(def, farm.condition);
  /** Tests and harness: cut the mains (false) or bring it back (true). */
  farm.debug.power = (mainsOn) => { farm.power.mains = !!mainsOn; stubPower(farm, env, false); return { ...farm.power }; };
  env.addStepper(() => stubWeather(farm, env));
}

// STUB: the power cut acts on the env setters (the sim package moves it into sim.js: env.powerOn stops the fans,
// the timer, the pad, the lights and the brooders' ignition while it is false, and keeps the farmer's settings).
function stubPower(farm, env, reset) {
  const P = farm.power, G = farm.generator;
  const on = P.mains || (G.running && P.source === 'generator');
  const was = P.on;
  P.on = on; if (!P.mains && P.source === 'mains') P.source = null; if (P.mains && P.source == null) P.source = 'mains';
  if (reset) { farm._held = null; return; }
  if (was && !on) { farm._held = { fans: env.fansManual, timer: env.ventTimer, pad: env.padOn }; env.setFans(0); env.setVentTimer(null); env.setPad(false); }
  if (!was && on && farm._held) { env.setFans(farm._held.fans); env.setVentTimer(farm._held.timer); env.setPad(farm._held.pad); farm._held = null; }
  if (was !== on) farm.emit(EV.POWER, { on, source: P.source, mains: P.mains });
}

// STUB: rain while a storm problem of the condition's level is in its window (no effect on the model)
function stubWeather(farm, env) {
  if (farm.mode !== 'level' || !farm.condition) return;
  const lv = conditionLevel(levelOfDay(env.dayNumber), farm.condition), t = env.day;
  const s = lv.problems.find((p) => p.storm === true && p.until && t >= p.day + p.hour / 24 && t < p.until.day + p.until.hour / 24);
  farm.weatherNow.storm = !!s; farm.weatherNow.rain = s ? 1 : 0; farm.weatherNow.id = s ? s.id : null;
}

/** Phase 4 actions (undefined: not one of them, farm.act goes on to the Phase 3 / Phase 2 actions). */
export function condAct(farm, env, id, a = {}) {
  const G = farm.generator, P = farm.power;
  switch (id) {
    case 'gen.start': if (G.fuelL > 0) { G.running = true; G.startedAt = +env.day.toFixed(5); } stubPower(farm, env, false); return { running: G.running, fuelL: Math.round(G.fuelL) };
    case 'gen.stop': G.running = false; if (P.source === 'generator') P.source = P.mains ? 'mains' : null; stubPower(farm, env, false); return { running: false, fuelL: Math.round(G.fuelL) };
    case 'gen.switch': P.source = a.to === 'generator' ? 'generator' : 'mains'; stubPower(farm, env, false); return { on: P.on, source: P.source };
    case 'gen.test': G.testedDay = env.dayNumber; G.fuelL = Math.max(0, G.fuelL - (GENERATOR.litresPerH * GENERATOR.testMin) / 60); return { ok: G.fuelL > 0, fuelL: Math.round(G.fuelL), minutes: GENERATOR.testMin };
    case 'gen.fuel': G.fuelL = GENERATOR.fuelL; return { fuelL: G.fuelL };
    case 'inlets.storm': farm.house.flapsClosed = !!a.closed; return true;
    case 'water.tank': return { levelPct: Math.round(farm.waterTank.levelPct), pumpBar: +(2.4 * farm.waterTank.pumpShare).toFixed(1), pumpA: +(6 + 3 * (1 - farm.waterTank.pumpShare)).toFixed(1) };
    case 'pump.fix': return { fixed: false, hours: 0 };
    case 'chicks.grade': return { stack: a.stack ?? 0, looked: 1000, weak: 8, culled: 8, minutes: 6 };
    case 'brood.trays': farm.brood.trays = !!a.on; return true;
    default: return undefined;
  }
}
export { WATER_TANK };
