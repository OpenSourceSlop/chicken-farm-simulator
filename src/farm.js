// Farm model: the flock as numbers (placement, growth, intake, uniformity, deaths), the water,
// feed, litter, light and ventilation equipment, the problem events and the samples the farmer
// takes. Pure logic (no three.js, no DOM): runs in node for scripts/test-sim.mjs.
// Owner: package "sim" (phase2/sim). PHASE2.md §6 (model), §7 (problems), §13 (contracts).
// The parts live in farm-*.js: farm-flock (cohorts, deaths), farm-water, farm-feed, farm-litter,
// farm-comfort (what the chicks feel), farm-problems, farm-act (every action id), farm-rng.
//
// createFarm(env, { events }) -> farm. main.js creates it before the house and the flock, puts it
// on ctx.farm, and registers farm.step as an env stepper (it runs every <= 60 game s, also inside
// env.skipHours). mode 'off' = Phase 1 sandbox: the farm does nothing and the house and flock use
// their Phase 1 tables. mode 'level' = Level 1 is running: house, flock and props read the state.
//
// farm.start(level, { seed, keepClock }) puts env on the level's start (prep day 07:00, cool
// season, cold brooders, no timer) and turns the level climate on; keepClock leaves day and hour.
// The chick truck arrives by itself at LEVEL1.arrivalDay / arrivalHour (EV.FARM_DELIVERY chicks
// arrive; 'leave' after the last tip); a feed order arrives at its day 09:00.
//
// Everything the player does to, or reads from, the farm goes through farm.act(id, args): it
// changes the state, returns the result and emits EV.ACTION { id, ...args, result } so the job
// engine and the records see it. Action ids: PHASE2.md §13.2.
//
// The farm is the only owner of: dead birds on the floor (deadOnFloor: += on each death, -= on
// EV.DEAD_PICK), the problems and their weather (it adds and rebuilds env weather events, also on
// restore), the symptom decision (EV.FARM_PROBLEM phase 'symptom' from an action it sees, an
// EV.NEAR from props, or 'radio.listen'), and farm.stats (what skills.js needs, computed in node).
import { LEVEL1, EQUIP, flockAgeAt, PLAN_LEVEL } from './config.js';
import { EV, UI_ACTION_IDS_CYCLE } from './events.js';
import { createRng } from './farm-rng.js';
import { roundDeep } from './round.js';
import { createWater, updateAccess, drink, stepLines, recordMeter, waterPerKg } from './farm-water.js';
import { createFeed, stepAugers, feedAccess, eat, meanPanFill } from './farm-feed.js';
import { createLitter, stepLitter, serializeLitter, restoreLitter, cellIndex as litterCell, meanDepth } from './farm-litter.js';
import { comfortNow, floorShareAbove } from './farm-comfort.js';
import { createFlock, deliver, stepFlock, stepBoxes, updateWeights, makeQuantile } from './farm-flock.js';
import { createProblems, tickProblems, actionSymptoms, onNear, onListen, problemZones, forecast, observe,
  installWeather, applyEffects } from './farm-problems.js';
import { doAct } from './farm-act.js';
import { absHumSat } from './sim.js';
import { humidityTerm } from './farm-heat.js';
import { waterPerKgP4, sensibleHeatK } from './farm-tuning.js'; // Phase 4: from Week 2 (PHASE4.md §9.1)
// Phase 3 (PHASE3.md §6, §13): the cycle state, its actions and the per-step model of Week 2 on
import { installCycle, cycleAct } from './farm-cycle.js';
import { installConditions, condAct } from './farm-cond.js'; // Phase 4 (PHASE4.md §10.5)
import { cyclePre, cycleComfort, cycleFactors, cyclePost } from './farm-cycle-step.js';
import { stepAugersCycle } from './farm-silos.js';
import { onBus } from './farm-cycle-act.js';
import { tickCycleProblems, cycleSymptoms, cycleZones, cycleNear, cycleForecast, cycleObserve, onLabLetter } from './farm-cycle-problems.js';

/**
 * @typedef {{ heightCm: number, pressureCm: number, flowMlMin: number, access: number,
 *   flushing: boolean, flushClear: number, blocked: number, leakX: number|null }} DrinkerLine
 * @typedef {{ heightCm: number, running: boolean, flood: boolean, panFill: number, kg: number }} FeederLine
 * @typedef {{ id: string, phase: 'pending'|'active'|'found'|'fixed', startedAt: number|null,
 *   foundAt: number|null, fixedAt: number|null, foundBy: string|null }} ProblemState   (times as env.day floats)
 * @typedef {{ problemId: string, x: number, z: number, r: number, dwellSec: number,
 *   minMoisture?: number }} ProblemZone   props emits EV.NEAR after dwellSec real seconds inside r
 * @typedef {{
 *   truckAt: number|null, firstTipAt: number|null, lastTipAt: number|null, boxWeighedAt: number|null,
 *   floorShareAtFirstTip: number|null,   // share of brooding cells with litter surface >= 28 °C
 *   heightsAtFirstTip: number[]|null, flushDoneAt: number|null,
 *   ventReadings: { t: number, sector: number, tempC: number }[],
 *   cropFillTrue: number|null,           // true crop fill at 24 h (0..1)
 *   comfortMinutes: number, levelMinutes: number,  // minutes with e in [-1.5, +2] / all minutes, age 0..7
 *   comfortShareByDay: number[],         // same per HUD day 0..7
 *   chickWeightMeasuredG: number|null,   // from sample.box: (gross - box) / 100, never typed
 *   weighed: { t: number, sector: number, weightG: number }[],  // sample.weigh readings
 *   pansEmptyAt: number|null,            // first time the pans ran empty (mean fill < 5 %)
 *   scaleAtWeighInG: number|null,        // the automatic bird scale at the weigh-in age (7.0, 08:00 day 7):
 *                                        // the level result uses it when nobody weighed by hand
 * }} FarmStats   read by skills.js and the result screen; never shown as a verdict
 */

// ui-only actions the farm listens to (symptoms): the ui emits them with result undefined
const UI_ACTIONS = new Set(['radio.listen', 'controller.read', 'phone.report', 'heat.setpoint', 'vent.fans', 'vent.pad', 'grade.submit', 'sign.read', ...UI_ACTION_IDS_CYCLE]);
const freshStats = () => ({ truckAt: null, firstTipAt: null, lastTipAt: null, boxWeighedAt: null, floorShareAtFirstTip: null,
  heightsAtFirstTip: null, flushDoneAt: null, ventReadings: [], cropFillTrue: null,
  comfortMinutes: 0, levelMinutes: 0, comfortShareByDay: [], comfortByDay: [], chickWeightMeasuredG: null,
  weighed: [], pansEmptyAt: null, scaleAtWeighInG: null });

export function createFarm(env, { events } = {}) {
  const emit = (t, p) => events && events.emit(t, p);
  const spill = [0, 0, 0, 0];

  const farm = {
    /** false: the model runs (scripts/test-sim.mjs runs the acceptance tests) */
    stub: false,
    /** 'off' (Phase 1 sandbox) or 'level' */
    mode: 'off',
    level: null,
    seed: 1,
    rng: createRng(1),
    flock: createFlock(),
    water: createWater(),
    feed: createFeed(),
    litter: createLitter(),
    light: { darkStart: 2, darkHours: 1, dimmer: 1, luxAtBirds: EQUIP.luxMax },
    vent: { fans: 0, onSec: 0, cycleSec: 300 },
    /** @type {ProblemState[]} */
    problems: createProblems(LEVEL1),
    /** @type {FarmStats} */
    stats: freshStats(),
    comfort: { e: 0, meanOver: 0, coldShare: 0, pantShare: 0 },
    truckLeft: false,
    drinkLh: 0,               // drinking smoothed over ~6 h, L/h (breath vapour)
    ctlMem: null,             // controller min / max memory since the last controller.read
    comfortH: 0, litAcc: { h: 0, drop: 0, leak: 0, spill: [0, 0, 0, 0] }, // slow parts: time and inputs since they last ran
    emit,
    /** Flock age in days (env.day - PLACEMENT_DAY), negative before 08:00 on day 0. */
    get age() { return flockAgeAt(env.day); },
    problemZones() { return farm.mode === 'level' ? [...problemZones(farm), ...cycleZones(farm)] : []; },
    /** The office radio: tonight's forecast for HUD day `day` (the cold night shows here; Phase 3: the level's weather). */
    forecast(day = env.dayNumber) { return cycleForecast(farm, env, day, forecast(farm, env, day)); },
    /** What the farmer sees and hears standing at (x, z): neutral words for the notebook (from Week 2 also the air). */
    observe(x, z) { const o = observe(farm, env, x, z); return farm.cyc && farm.cyc.on ? cycleObserve(farm, env, x, z, o) : o; },
    /** The climate controller's memory: house min / max (°C) and humidity (%) since its last reading (controller.read). */
    controllerMemory() {
      const m = farm.ctlMem;
      return m ? { minC: +m.minC.toFixed(1), maxC: +m.maxC.toFixed(1), rhMin: Math.round(m.rhMin ?? env.houseRH), rhMax: Math.round(m.rhMax ?? env.houseRH), since: m.since }
        : { minC: +env.houseTemp.toFixed(1), maxC: +env.houseTemp.toFixed(1), rhMin: Math.round(env.houseRH), rhMax: Math.round(env.houseRH), since: env.day };
    },

    /** Start Level 1 from the prep day (bare floor, empty house, lines high, no chicks). */
    start(level = LEVEL1, { seed = 1, keepClock = false } = {}) {
      Object.assign(farm, { mode: 'level', level, seed, rng: createRng(seed), flock: createFlock(), water: createWater(),
        feed: createFeed(), litter: createLitter(), problems: createProblems(level), stats: freshStats(), truckLeft: false, drinkLh: 0, ctlMem: null, comfortH: 0, litAcc: { h: 0, drop: 0, leak: 0, spill: [0, 0, 0, 0] },
        light: { darkStart: 2, darkHours: 1, dimmer: 1, luxAtBirds: EQUIP.luxMax }, vent: { fans: 0, onSec: 0, cycleSec: 300 } });
      farm.flock.weightQuantile = makeQuantile(farm.flock);
      if (!keepClock) { env.setDay(level.startDay); env.setHour(level.startHour); }
      env.setWeather(level.weather);
      env.forceHouseTemp(null);
      env.houseTemp = 23; env.slabTemp = 23; env.heaterLevel = env.heaterDemand = 0;
      env.setHeaterSetpoint(20); env.setFans(0); env.setPad(false); env.setVentTimer(null);
      env.setLightProgram({ darkStart: 2, darkHours: 1, dimmer: 1 });
      env.clearWeatherEvents(); installWeather(farm, env); env.setBrooderOut([]);
      env.litterDepthAt = (x, z) => { const i = litterCell(x, z); return farm.litter.depthGrid[i] * farm.litter.coverGrid[i]; };
      env.litterDepthCm = 0; env.flockHeatPerH = 0; env.vapourGh = 0; env.dryPotentialGh = 0;
      env.setLevelClimate(true);
      emit(EV.LEVEL, { phase: 'farm-start', day: level.startDay });
    },
    /** Back to the Phase 1 sandbox. */
    stop() {
      farm.mode = 'off'; farm.level = null; farm.flock.present = true;
      env.setLevelClimate(false); env.clearWeatherEvents(); env.setBrooderOut([]); env.setVentTimer(null);
      env.litterDepthAt = null; env.flockHeatPerH = 0; env.vapourGh = 0; env.dryPotentialGh = 0;
    },

    /** env stepper: integrate gameSeconds (<= 60). fast = inside skipHours. */
    step(e, gameSeconds) {
      if (farm.mode !== 'level' || gameSeconds <= 0) return;
      stepFarm(farm, e, gameSeconds / 3600, spill);
    },

    /**
     * Do or read something on the farm. Returns the result (a reading, a sample, true/false).
     * Emits EV.ACTION { id, ...args, result } unless args.quiet.
     */
    act(id, args = {}) {
      const cond = condAct(farm, env, id, args);
      const cyc = cond !== undefined ? cond : cycleAct(farm, env, id, args);
      const result = cyc !== undefined ? cyc : doAct(farm, env, id, args);
      if (farm.mode === 'level') { actionSymptoms(farm, env, id, args, result); cycleSymptoms(farm, env, id, args, result); }
      if (!args.quiet) emit(EV.ACTION, { id, ...args, result });
      return result;
    },

    /** Litter surface temperature at (x, z), °C (what the floor thermometer reads, no noise). */
    floorTempAt(x, z) { return env.floorTemp(x, z); },
    floorShare28() { return floorShareAbove(env, 28); },
    /** Litter moisture % at (x, z). */
    litterMoistureAt(x, z) { return farm.litter.moistureGrid[litterCell(x, z)]; },
    /** Lux at bird level while the lights are on (program dimmer). */
    luxLit() { return EQUIP.luxMax * farm.light.dimmer; },
    /** Lux at bird level at (x, z) now. */
    luxAt() { return env.lightsOn ? farm.luxLit() : 0; },

    /** Hidden truth for tests and the debug tools only (never shown to the player). */
    debug: {
      trigger(problemId) {
        const st = farm.problems.find((p) => p.id === problemId);
        if (st && st.phase === 'pending') { st.phase = 'active'; st.startedAt = env.day; applyEffects(farm, env); emit(EV.FARM_PROBLEM, { id: problemId, phase: 'start' }); }
      },
      truth() { return { flock: { ...farm.flock }, problems: farm.problems.map((p) => ({ ...p })), comfort: { ...farm.comfort }, stats: farm.stats }; },
    },

    serialize() { return serializeFarm(farm, env); }, // grids as integer arrays (moisture x 10)
    restore(data) { restoreFarm(farm, env, data); },
  };
  farm.flock.weightQuantile = makeQuantile(farm.flock);
  installCycle(farm, env);
  installConditions(farm, env);
  farm.onLabLetter = () => onLabLetter(farm, env);

  if (events) {
    // The farm is the only owner of deadOnFloor (flock.dead mirrors it).
    events.on(EV.DEAD_PICK, (p) => { farm.flock.deadOnFloor = Math.max(0, farm.flock.deadOnFloor - (p.n || 0)); });
    events.on(EV.ACTION, (p) => {
      if (farm.mode !== 'level' || p.result !== undefined || !UI_ACTIONS.has(p.id)) return;
      onBus(farm, env, EV.ACTION, p);
      actionSymptoms(farm, env, p.id, p, undefined);
      cycleSymptoms(farm, env, p.id, p, undefined);
      if (p.id === 'controller.read') farm.ctlMem = null; // the controller's min / max memory restarts at each read
    });
    events.on(EV.NEAR, (p) => { if (farm.mode === 'level') { onNear(farm, env, p); cycleNear(farm, env, p); } });
    events.on(EV.LISTEN, (p) => { if (farm.mode === 'level') { onListen(farm, env); onBus(farm, env, EV.LISTEN, p); } });
    events.on(EV.HOUSE_ENTER, (p) => { if (farm.mode === 'level' && p && p.dipped === false) farm.flock.lapses++; onBus(farm, env, EV.HOUSE_ENTER, p || {}); });
    for (const t of [EV.CELL, EV.BIRD_PICK, EV.BIRD_RELEASE, EV.FOOTDIP, EV.DEAD_PICK, EV.RECORD_CLOSED]) events.on(t, (p) => onBus(farm, env, t, p || {}));
  }
  return farm;
}

export const cellIndex = litterCell;

/** One farm step of `hrs` game hours (PHASE2.md §6). */
function stepFarm(farm, env, hrs, spill) {
  const fl = farm.flock, water = farm.water, feed = farm.feed, st = farm.stats, lv = farm.level || LEVEL1;
  const X = farm.cyc && farm.cyc.on ? farm.cyc : null; // Phase 3: the cycle model from Week 2 (farm-cycle-step.js)
  tickProblems(farm, env);
  if (farm.cycleLevel) tickCycleProblems(farm, env);
  const cm = farm.ctlMem || (farm.ctlMem = { minC: env.houseTemp, maxC: env.houseTemp, since: env.day });
  if (env.houseTemp < cm.minC) cm.minC = env.houseTemp;
  if (env.houseTemp > cm.maxC) cm.maxC = env.houseTemp;
  if (farm.cycleLevel) { if (!(env.houseRH >= cm.rhMin)) cm.rhMin = env.houseRH; if (!(env.houseRH <= cm.rhMax)) cm.rhMax = env.houseRH; }
  if (X) cyclePre(farm, env, hrs);
  if (st.truckAt == null && env.day >= lv.arrivalDay + lv.arrivalHour / 24 - 1e-9) {
    deliver(farm, env);
    femit(farm, EV.FARM_DELIVERY, { kind: 'chicks', phase: 'arrive' });
  }
  const o = feed.order;
  if (o && env.day >= o.arriveDay + o.arriveHour / 24 - 1e-9) {
    feed.siloKg = Math.min(EQUIP.siloCapacityKg, feed.siloKg + o.kg);
    const rec = feed.orders.find((x) => x.orderedAt === o.orderedAt); if (rec) rec.arrivedAt = env.day;
    feed.order = null;
    femit(farm, EV.FARM_DELIVERY, { kind: 'feed', phase: 'arrive', kg: o.kg });
    femit(farm, EV.FARM_DELIVERY, { kind: 'feed', phase: 'leave', kg: o.kg });
  }
  // equipment
  if (X) stepAugersCycle(feed, hrs); else stepAugers(feed, hrs);
  const leakL = stepLines(water, env, hrs);
  if (water.flushedAt != null && st.flushDoneAt == null) st.flushDoneAt = water.flushedAt;
  const age = farm.age;
  updateAccess(water, age);
  if (water.mainClosed) { water.access = 0; for (const l of water.lines) l.access = 0; } // Phase 3: the main valve shut (the vaccine's thirst)
  recordMeter(water, env);
  // flock (chicks still in the boxes first: the box hazard runs while they wait)
  stepBoxes(farm, env, hrs);
  let drunkL = 0, breathL = 0;
  const C = farm.comfort;
  if (fl.placed > 0 && fl.alive > 0) {
    // what the chicks feel changes with the house air: recomputed every 5 game minutes (and at once
    // when the brooders that are out change)
    farm.comfortH += hrs;
    if (farm.comfortH >= SLOW_H - 1e-9 || C.out !== env.brooderOut.length || C.e == null || (X && !C.eZ)) {
      if (X) cycleComfort(farm, env, C, age);
      else {
        comfortNow(env, C, { litter: farm.litter, age });
        // the 6 m strips for the scene (farm.comfort.eZ, PHASE3.md §13.5) on a scratch object, every third update (15 game
        // minutes): Phase 2's figures stay as they are
        if (!((farm.zoneTick = (farm.zoneTick || 0) + 1) % 3) || !C.eZ || !Number.isFinite(C.eZ[0])) {
          const Z = cycleComfort(farm, env, farm.zoneScratch || (farm.zoneScratch = {}), age);
          C.eZ = Z.eZ; C.wZ = Z.wZ; C.hotFrom = Z.hotFrom; C.pantFrom = Z.pantFrom; C.pantAll = Z.pantAll;
        }
        // Phase 4: the fan panel's Birds feel (the house less the wind chill, plus the damp) in the brooding week too
        C.feltMean = C.meanOver + env.targetTemp + humidityTerm(env.houseRH, env.houseTemp);
      }
      C.out = env.brooderOut.length; farm.comfortH = 0;
    }
    // Phase 4 (from Week 2): the birds drink by their comfort (waterPerKgP4 of the mean e), not by the weather
    const io = { feedAccess: feedAccess(feed, age, env.dayNumber), eat: (kg) => eat(feed, kg), waterPerKg: X ? waterPerKgP4(C.meanOver ?? 0) : waterPerKg(env.houseTemp) };
    if (X) cycleFactors(farm, env, age, hrs);
    const r = stepFlock(farm, env, hrs, C, io);
    drunkL = r.drunkL; breathL = r.breathL;
    drink(water, drunkL, age, spill);
  } else spill.fill(0);
  farm.lastDrunkL = drunkL;
  if (st.pansEmptyAt == null && fl.placed > 0 && meanPanFill(feed) < 0.05) st.pansEmptyAt = env.day;
  // the automatic bird scale (reads about 2 % high) when the weigh-in opens: flock age 7.0
  if (st.scaleAtWeighInG == null && fl.placed > 0 && age >= lv.endDay - 1e-9 && fl.alive > 0) st.scaleAtWeighInG = +(fl.meanWeightG * 1.02).toFixed(1);
  // litter, air
  // the litter integrates what fell on it every 5 game minutes (moisture changes over hours)
  const L = farm.litter, la = farm.litAcc;
  la.h += hrs; la.drop += 0.5 * drunkL; la.leak += leakL;
  for (let i = 0; i < 4; i++) la.spill[i] += spill[i] || 0;
  if (la.h >= SLOW_H - 1e-9) {
    stepLitter(L, { hrs: la.h, droppingsL: la.drop, spill: la.spill, leakL: la.leak, leakCell: water.leak ? water.leak.cell : null,
      rh: X ? litterRh(env, fl) : env.houseRH, feedKg: feed.meterKg, airflow: env.airflowM3h });
    la.h = 0; la.drop = 0; la.leak = 0; la.spill.fill(0);
  }
  // breath follows the day's drinking (smoothed over ~6 h: the birds breathe in the dark hour too)
  farm.drinkLh += (breathL / hrs - farm.drinkLh) * (1 - Math.exp(-hrs / 6));
  env.vapourGh = 0.4 * farm.drinkLh * 1000;
  // Phase 3: the climate sees the litter's actual drying at the house RH (the warm litter under big birds dries more)
  env.dryPotentialGh = X ? L.vapourGh / Math.max(0.05, 1 - env.houseRH / 100) : L.dryPotentialGh;
  const birds = fl.alive, w = fl.meanWeightG;
  // Phase 4 (from Week 2): the sensible term x sensibleHeatK (farm-tuning flockLoadsP4: x 2.5, less in hot air)
  env.flockHeatPerH = birds > 0 ? ((0.2 * birds) / 6000 + ((1.3 * birds * w) / (6000 * 2850)) * (X ? sensibleHeatK(env.houseTemp) : 1)) * (X ? X.heatK : 1) : 0;
  if (farm.depthVersion !== L.version) { farm.depthVersion = L.version; env.litterDepthCm = meanDepth(L); }
  if (farm.mode === 'level') cyclePost(farm, env, hrs, { drunkL });
}

const femit = (farm, t, p) => farm.emit(t, p);
// Phase 3 (model): the litter under big birds is warmer than the house air (their heat, the litter's own), so
// it dries against the air's water as if the air were less humid: RH x sat(air) / sat(litter), litter = house
// + LITTER_WARM_C x (weight / 2 kg, at most 1).
const LITTER_WARM_C = 4;
function litterRh(env, fl) {
  const tl = env.houseTemp + LITTER_WARM_C * Math.min(1, (fl.meanWeightG || 0) / 2000);
  return (env.houseRH * absHumSat(env.houseTemp)) / absHumSat(tl);
}
const SLOW_H = 5 / 60; // comfort and litter update every 5 game minutes

const clone = (o) => JSON.parse(JSON.stringify(o));
function serializeFarm(farm, env) {
  const fl = { ...farm.flock }; delete fl.weightQuantile; delete fl.qVersion;
  return {
    v: 1, mode: farm.mode, seed: farm.seed, rng: farm.rng.state, truckLeft: farm.truckLeft, drinkLh: farm.drinkLh, ctlMem: farm.ctlMem, comfortH: farm.comfortH, litAcc: clone(farm.litAcc),
    flock: clone(fl),
    water: clone({ ...farm.water, hist: farm.water.hist.map((v) => Math.round(v * 10) / 10), access: +farm.water.access.toFixed(9),
      lines: farm.water.lines.map((l) => ({ ...l, access: +l.access.toFixed(9), flowMlMin: +l.flowMlMin.toFixed(6) })) }),
    feed: clone(farm.feed), litter: serializeLitter(farm.litter),
    light: { ...farm.light }, vent: { ...farm.vent }, fansManual: env.fansManual,
    // the day stats rounded to 3 decimals (save size: 23.99999999999993 h is 24 h)
    problems: clone(farm.problems), stats: { ...clone(farm.stats), ...(farm.stats.daily ? { daily: roundDeep(farm.stats.daily, 3) } : {}) },
  };
}

function restoreFarm(farm, env, d) {
  if (!d) return;
  farm.mode = d.mode || 'off';
  if (farm.mode !== 'level') { farm.stop(); return; }
  farm.level = d.levelId === PLAN_LEVEL.id ? PLAN_LEVEL : LEVEL1; farm.seed = d.seed ?? 1;
  farm.rng = createRng(1); farm.rng.state = d.rng ?? 1;
  farm.truckLeft = !!d.truckLeft; farm.drinkLh = d.drinkLh || 0; farm.ctlMem = d.ctlMem ? { ...d.ctlMem } : null;
  farm.comfortH = d.comfortH || 0; farm.litAcc = d.litAcc ? clone(d.litAcc) : { h: 0, drop: 0, leak: 0, spill: [0, 0, 0, 0] };
  farm.flock = Object.assign(createFlock(), clone(d.flock));
  farm.flock.weightQuantile = makeQuantile(farm.flock);
  farm.water = Object.assign(createWater(), clone(d.water));
  farm.feed = Object.assign(createFeed(), clone(d.feed));
  farm.litter = createLitter(); restoreLitter(farm.litter, d.litter);
  farm.light = { ...farm.light, ...d.light }; farm.vent = { ...farm.vent, ...d.vent };
  farm.problems = clone(d.problems); farm.stats = Object.assign(freshStats(), clone(d.stats));
  // env: the level climate, the timer, light, weather events and brooders rebuilt from the farm
  env.setLevelClimate(true);
  env.setVentTimer(farm.vent.fans > 0 && farm.vent.onSec > 0 ? farm.vent : null);
  env.setLightProgram({ darkStart: farm.light.darkStart, darkHours: farm.light.darkHours, dimmer: farm.light.dimmer });
  if (d.fansManual != null) { env.fansManual = d.fansManual; env.setFans(d.fansManual); }
  env.clearWeatherEvents(); installWeather(farm, env); applyEffects(farm, env);
  env.litterDepthAt = (x, z) => { const i = litterCell(x, z); return farm.litter.depthGrid[i] * farm.litter.coverGrid[i]; };
  env.litterDepthCm = meanDepth(farm.litter);
  updateAccess(farm.water, farm.age);
  if (farm.flock.placed > 0) { updateWeights(farm.flock); comfortNow(env, farm.comfort, { litter: farm.litter, age: farm.age }); }
}


