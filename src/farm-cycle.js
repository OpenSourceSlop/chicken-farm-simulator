// Phase 3 farm state for the whole cycle (PHASE3.md §6, §13.5, §13.8). Owner: package "sim".
// installCycle(farm, env) is called once by createFarm: it adds the Phase 3 state, farm.enterLevel(def),
// farm.debug.set(path, value), farm.listen(x, z), farm.noteWalk(share), and wraps farm.start / stop /
// serialize / restore so the cycle state rides along. The model runs in farm-cycle-step.js (hooks inside
// farm.js stepFarm), the actions in farm-cycle-act.js. The brooding week stays Phase 2's: everything of
// the cycle model waits for farm.cyc.on, which only farm.enterLevel(def) of Week 2 or later turns on
// (with env.setCycleClimate(true)); before it the cycle state is only kept (gas, the silos' layers).
//
// State (PHASE3.md §13.5), JSON-safe except the clean grids (Float32Array, saved run-length coded):
//   farm.cycleLevel  the current level def of the run from Week 2 (PLAN_LEVEL on the planning day; null in
//                    the brooding week)
//   farm.house   { curtainOpen, broodersUp, fansBroken: [index], padWorking (0..1), padFloatStuck, closed }
//   farm.health  farm-health.js (vaccine, medication, disease, lame birds, breathing)
//   farm.air     { dustIndex, ammoniaPpm }
//   farm.harvest farm-harvest.js (catchAt, sections, trucks, result)
//   farm.clean   farm-clean.js (grids, shares, parts, lines, swabs, lab, closedDay, bookedDay)
//   farm.plan    null | { measured: { length, width }, decisions, sums, sheet, sentAt, replyAt, outcome }
//   farm.feed.silos / valves / panType / pending / withdrawn (farm-silos.js)
//   farm.flock.lameOnFloor, farm.comfort.{ eZ[8], wZ[8], hotFrom, pantShare, ... } (farm-house.js)
//   farm.stats.levelStart { level, day, t, alive, deaths, culls, doa, ... }   set by enterLevel (the one owner)
//   farm.stats.daily[day]   what the skill rules measure per calendar day (farm-cycle-step.js)
//   farm.cyc     the model's working state (on, factors, rates, droppings, shock, histories)
import { LEVEL1, PLAN_LEVEL, CYCLE, levelById } from './config.js';
import { EV } from './events.js';
import { createHealth } from './farm-health.js';
import { createHarvest } from './farm-harvest.js';
import { createClean, serializeClean, restoreClean } from './farm-clean.js';
import { ensureSilos } from './farm-silos.js';
import { updateAccess } from './farm-water.js';
import { houseComfort } from './farm-house.js';
import { addLevelProblems, installCycleWeather, applyCycleEffects } from './farm-cycle-problems.js';
import { cycleAct as act, onBus } from './farm-cycle-act.js';

export const CYCLE_CAUSES = ['sds', 'legs', 'disease', 'respiratory'];

function freshCyc() {
  return { on: false, fx: { f: 1, fpgK: 1, dcv: 0, dehydK: 1, otherK: 1, fSpace: 1, fForm: 1, fHeat: 1, fHealth: 1, shock: 1, debt: 1 },
    rates: { sds: 0, disease: 0, respiratory: 0 }, droppings: 'normal', shockUntil: null, feedHist: [], crowd: null, crowdWeek: 0,
    heatK: 1, feedersUpSince: null, debtKg: 0, waterPerKg: 1.75, zoneMoisture: [], wettestZone: 0, comfortH: 0 };
}
function freshCycleState() {
  return {
    house: { curtainOpen: false, broodersUp: false, fansBroken: [], padWorking: 1, padFloatStuck: false, closed: false },
    health: createHealth(), air: { dustIndex: 0, ammoniaPpm: 0 }, harvest: createHarvest(), clean: createClean(), cyc: freshCyc(),
  };
}

function resetCycle(farm, { keepPlan = null } = {}) {
  Object.assign(farm, freshCycleState());
  farm.plan = keepPlan;
  farm.flock.lameOnFloor = 0;
  const c = farm.comfort || (farm.comfort = {});
  c.eZ = new Float64Array(8).fill(NaN); c.wZ = new Float64Array(8); c.hotFrom = 1.5;
  ensureSilos(farm.feed);
}

/** The env settings the farm owns (the curtain, cycle climate, last day, brooders, fans, pad), from the farm. */
function syncEnv(farm, env, { fresh = false } = {}) {
  const on = !!farm.cyc.on;
  // Phase 4: a condition may run the cycle climate from the prep day (the hot and rainy seasons, config conditionLevel);
  // the tuned wind chill comes with the cycle model only (the brooding week keeps Phase 2's in every condition)
  const def = farm.cycleLevel || farm.level;
  env.setCycleClimate(on || !!(farm.condition && def && farm.levelFor && farm.levelFor(def).cycleClimate));
  env.setWindChillP4(on);
  // the clean-out runs the clock to day 70; a fresh start goes back to 42 (entering a level never lowers it)
  if (farm.cycleLevel && farm.cycleLevel.id === 'cleanout') env.setMaxDay(CYCLE.lastDay); else if (fresh) env.setMaxDay(42);
  env.setBroodCurtain(!farm.house.curtainOpen);
  env.setBroodersUp(!!farm.house.broodersUp);
  applyCycleEffects(farm, env);
}

function levelStartOf(farm, env, id) {
  const fl = farm.flock;
  return { level: id, day: env.dayNumber, t: +env.day.toFixed(5), alive: fl.alive, placed: fl.placed, deaths: fl.deadTotal, culls: fl.culls, doa: fl.doa || 0,
    sds: fl.deadByCause.sds || 0, legs: fl.deadByCause.legs || 0, heat: fl.deadByCause.heat || 0, disease: fl.deadByCause.disease || 0,
    lameCulls: (fl.cullsBy && fl.cullsBy.lame) || 0, lapses: fl.lapses || 0, feedKg: +fl.cumFeedKg.toFixed(1), gasKg: +(farm.stats.gasKg || 0).toFixed(2) };
}

/** Add the Phase 3 state to a Phase 2 farm (createFarm calls this once). */
export function installCycle(farm, env) {
  farm.cycleStub = false;
  farm.cycleLevel = null;
  farm.plan = null;
  resetCycle(farm);
  const start = farm.start, stop = farm.stop, restore = farm.restore, serialize = farm.serialize;
  farm.start = (level = LEVEL1, opts = {}) => {
    // the plan the farmer sent on the planning day goes on with the flock (PHASE3.md §2.2: the run keeps it too)
    const keepPlan = opts.plan !== undefined ? opts.plan : farm.mode === 'level' && farm.cycleLevel === PLAN_LEVEL && level === LEVEL1 && farm.plan && farm.plan.sentAt != null ? farm.plan : null;
    start(level, opts);
    resetCycle(farm, { keepPlan });
    farm.cycleLevel = level === PLAN_LEVEL ? PLAN_LEVEL : null;
    farm.stats.gasKg = 0; farm.stats.daily = {}; farm.stats.feedAtStartKg = farm.feed.siloKg;
    farm.stats.levelStart = levelStartOf(farm, env, level.id);
    env.setFanStages(null);
    syncEnv(farm, env, { fresh: !opts.keepClock });
    updateAccess(farm.water, farm.age); // the lines' flow at the start (a save taken before the first step restores the same)
  };
  farm.stop = () => {
    stop();
    farm.cycleLevel = null; farm.cyc.on = false;
    env.setBroodCurtain(null); env.setCycleClimate(false); env.setWindChillP4(false); env.setMaxDay(42); env.setBroodersUp(false); env.setFanStages(null); env.setFansBroken([]); env.padWorking = 1;
  };
  farm.serialize = () => {
    const d = serialize();
    d.levelId = farm.cycleLevel ? farm.cycleLevel.id : farm.level ? farm.level.id : null;
    d.cycle = { levelId: farm.cycleLevel ? farm.cycleLevel.id : null, house: clone(farm.house), health: clone(farm.health), air: { ...farm.air },
      harvest: clone(farm.harvest), clean: serializeClean(farm.clean), plan: clone(farm.plan), cyc: clone(farm.cyc), fanStages: clone(env.fanStages) };
    return d;
  };
  farm.restore = (data) => {
    restore(data);
    const c = data && data.cycle;
    resetCycle(farm, { keepPlan: c ? clone(c.plan) : null });
    if (farm.mode !== 'level') return;
    if (data.levelId === PLAN_LEVEL.id) farm.level = PLAN_LEVEL;
    farm.cycleLevel = c && c.levelId ? levelById(c.levelId) : farm.level === PLAN_LEVEL ? PLAN_LEVEL : null;
    if (c) {
      Object.assign(farm.house, clone(c.house)); Object.assign(farm.health, clone(c.health)); Object.assign(farm.air, c.air);
      Object.assign(farm.harvest, clone(c.harvest)); farm.clean = restoreClean(c.clean); Object.assign(farm.cyc, clone(c.cyc));
    }
    ensureSilos(farm.feed);
    farm.flock.lameOnFloor = (farm.health.lame || []).length;
    if (farm.health.mainClosed || farm.water.mainClosed != null) farm.water.mainClosed = !!farm.health.mainClosed;
    if (farm.cycleLevel && farm.cyc.on) { installCycleWeather(farm, env); }
    syncEnv(farm, env);
    env.setFanStages(c ? c.fanStages : null);
    // the comfort the cycle model uses (Phase 2's restore computed the brooding floor's)
    if (farm.cyc.on && farm.flock.placed > 0 && farm.flock.alive > 0) houseComfort(env, farm, farm.comfort, farm.age, farm.flock.meanWeightG);
  };
  /**
   * Enter a level of the run (PHASE3.md §2.2): its problems (pending) and weather, the recurring problems
   * re-armed, stats.levelStart, the cycle climate from Week 2, the last day 70 in the clean-out. The same
   * level again is a no-op (a restored level start already holds it).
   */
  farm.enterLevel = (def) => {
    if (!def || farm.mode !== 'level') return false;
    if (farm.cycleLevel && farm.cycleLevel.id === def.id) return false;
    if (def === LEVEL1 || def === PLAN_LEVEL) { farm.cycleLevel = def === PLAN_LEVEL ? PLAN_LEVEL : null; farm.cyc.on = false; syncEnv(farm, env); return true; }
    farm.cycleLevel = def; farm.cyc.on = true;
    const fl = farm.flock;
    const first = !CYCLE_CAUSES.every((k) => fl.deadByCause[k] != null);
    for (const k of [...CYCLE_CAUSES, 'doa']) { if (fl.deadByCause[k] == null) fl.deadByCause[k] = 0; if (fl.acc[k] == null) fl.acc[k] = farm.rng.next(); }
    // the cycle's heat and cold rates replace Phase 2's from here: their counters restart with them
    if (first) { fl.acc.heat = 0; fl.acc.cold = 0; }
    addLevelProblems(farm, def);
    if (def.weather) env.setWeather(def.weather);
    env.clearWeatherEvents(); installCycleWeather(farm, env);
    farm.stats.levelStart = levelStartOf(farm, env, def.id);
    syncEnv(farm, env);
    farm.emit(EV.LEVEL, { phase: 'farm-enter', level: def.id, day: env.dayNumber });
    return true;
  };
  farm.cycleAct = (id, a) => act(farm, env, id, a);
  /** The farmer stood still at (x, z) (EV.LISTEN does the same): symptoms he can hear and see there. */
  farm.listen = (x, z) => onBus(farm, env, EV.LISTEN, { x, z });
  /** The farmer walked through this share of the house (EV.CELL does the same, one cell at a time). */
  farm.noteWalk = (share) => onBus(farm, env, 'walk', { share });
  /** Set any farm field by a dotted path (tests and the other packages' harness runs only). */
  farm.debug.set = (path, value) => {
    const keys = String(path).split('.'), last = keys.pop();
    let o = farm;
    for (const k of keys) { if (o[k] == null || typeof o[k] !== 'object') return false; o = o[k]; }
    o[last] = value;
    return true;
  };
}

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
export { act as cycleAct };
