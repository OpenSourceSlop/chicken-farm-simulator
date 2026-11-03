// Farm model: the flock as numbers (placement, growth, intake, uniformity, deaths), the water,
// feed, litter, light and ventilation equipment, the problem events and the samples the farmer
// takes. Pure logic (no three.js, no DOM): runs in node for scripts/test-sim.mjs.
// Owner: package "sim" (phase2/sim). STUB: the shape below is the contract; the numbers are
// placeholders until the package implements PHASE2.md "Flock simulation".
//
// createFarm(env, { events }) -> farm. main.js creates it before the house and the flock, puts it
// on ctx.farm, and registers farm.step as an env stepper (it runs every <= 60 game s, also inside
// env.skipHours). mode 'off' = Phase 1 sandbox: the farm does nothing and the house and flock use
// their Phase 1 tables. mode 'level' = Level 1 is running: house, flock and props read the state.
//
// Everything the player does to, or reads from, the farm goes through farm.act(id, args): it
// changes the state, returns the result and emits EV.ACTION { id, ...args, result } so the job
// engine and the records see it. Action ids: PHASE2.md §13.2. ONE payload shape for every action,
// from the farm or from the ui: { id, ...args, result } (result undefined for ui-only actions).
//
// The farm is the only owner of: dead birds on the floor (deadOnFloor: += on each death, -= on
// EV.DEAD_PICK), the problems and their weather (it adds and rebuilds env weather events, also on
// restore), the symptom decision (EV.FARM_PROBLEM phase 'symptom' from an action it sees, an
// EV.NEAR from props, or 'radio.listen'), and farm.stats (what skills.js needs, computed in node).
import { DRINKER_LINES_Z, FEEDER_LINES_Z, FLOOR_GRID, LEVEL1, weightAt, flockAgeAt } from './config.js';
import { EV } from './events.js';

/**
 * @typedef {{ heightCm: number, pressureCm: number, flowMlMin: number, access: number,
 *   flushing: boolean, flushClear: number, blocked: number, leakX: number|null }} DrinkerLine
 * @typedef {{ heightCm: number, running: boolean, flood: boolean, panFill: number }} FeederLine
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
 * }} FarmStats   read by skills.js and the result screen; never shown as a verdict
 */

export function createFarm(env, { events } = {}) {
  const n = FLOOR_GRID.nx * FLOOR_GRID.nz;
  const emit = (t, p) => events && events.emit(t, p);

  const farm = {
    /** true while this file is the contract stub (scripts/test-sim.mjs skips the acceptance tests) */
    stub: true,
    /** 'off' (Phase 1 sandbox) or 'level' */
    mode: 'off',
    level: null,
    flock: {
      present: true,          // false before the chicks are placed (flock draws nothing)
      delivered: 0,           // chicks that came on the truck
      inBoxes: 0,             // still in the boxes
      placed: 0,              // tipped onto the litter
      alive: 0,
      deadTotal: 0,
      culls: 0,
      deadByCause: {},        // { cold, heat, dehydration, weak, starveout, other, box }
      deadOnFloor: 0,         // died and not yet picked up (flock draws them)
      sick: 0,                // real birds that look sick now (flock shows ~sick / BIRDS_PER_INSTANCE)
      chickWeightG: LEVEL1.chickWeightG,
      meanWeightG: weightAt(env.day),
      cv: 0.08,               // coefficient of variation of body weight
      uniformityPct: 80,      // % within +-10 % of the mean
      lateStarters: 0,        // real birds that did not find feed and water in the first 24 h
      droppings: 'normal',    // 'normal' | 'watery' | 'few' (what the litter shows)
      feedTodayKg: 0, waterTodayL: 0, cumFeedKg: 0,
      fcr: 0,
      /** Body weight (g) at quantile u (0..1) of the live flock; flock.js sizes birds with it. */
      weightQuantile(u) { return farm.flock.meanWeightG * (1 + farm.flock.cv * 1.6 * (u - 0.5) * 2); },
    },
    water: {
      /** @type {DrinkerLine[]} */
      lines: DRINKER_LINES_Z.map(() => ({ heightCm: 12, pressureCm: 10, flowMlMin: 21, access: 1, flushing: false, flushClear: 1, blocked: 0, leakX: null })),
      meterL: 0,
      waterTempC: 27,
      flushedAt: null,        // env.day when the last line finished flushing
      filterFactor: 1,        // main filter at the water supply: 1 clean, 0.5 blocked (every line's flow x this)
      leak: null,             // { line, x, cell } while a nipple leaks
    },
    feed: {
      siloKg: LEVEL1.siloStartKg,
      meterKg: 0,
      /** @type {FeederLine[]} */
      lines: FEEDER_LINES_Z.map(() => ({ heightCm: 5, running: true, flood: false, panFill: 1 })),
      order: null,            // { kg, arriveDay } after the farmer ordered feed
    },
    litter: {
      depthCm: 5,
      cover: 1,                         // share of the floor covered with litter (0..1)
      coverGrid: new Float32Array(n).fill(1),
      moistureGrid: new Float32Array(n).fill(22),  // % moisture per FLOOR_GRID cell
      meanMoisturePct: 22,
      ammoniaPpm: 3,
    },
    light: { darkStart: 2, darkHours: 1, dimmer: 1, luxAtBirds: 40 },
    vent: { fans: 0, onSec: 0, cycleSec: 300 },
    /** @type {ProblemState[]} */
    problems: [],
    /** @type {FarmStats} */
    stats: { truckAt: null, firstTipAt: null, lastTipAt: null, boxWeighedAt: null, floorShareAtFirstTip: null,
      heightsAtFirstTip: null, flushDoneAt: null, ventReadings: [], cropFillTrue: null,
      comfortMinutes: 0, levelMinutes: 0, comfortShareByDay: [], chickWeightMeasuredG: null },
    /** Flock age in days (env.day - PLACEMENT_DAY), negative before 08:00 on day 0. */
    get age() { return flockAgeAt(env.day); },
    /** Zones where standing still is a symptom (the leak's wet patch, the cold brooder). @returns {ProblemZone[]} */
    problemZones() { return []; },
    /** The office radio: tonight's forecast for HUD day `day` (the cold night shows here). */
    forecast(day) { return { day, lowC: 19, highC: 29, text: 'Tonight: clear, low 19 °C' }; },
    /** What the farmer sees and hears standing at (x, z): neutral words for the notebook. */
    observe(x, z) { void x; void z; return { spread: 'evenly spread', droppings: 'firm, brown with a white cap', sounds: 'quiet chirping' }; },

    /** Start Level 1 from the prep day (bare floor, empty house, lines high, no chicks). */
    start(level = LEVEL1, { seed = 1 } = {}) {
      farm.mode = 'level'; farm.level = level; farm.seed = seed;
      farm.flock.present = true; // STUB: stays true so the Phase 1 flock keeps showing
      emit(EV.LEVEL, { phase: 'farm-start', day: level.startDay });
    },
    /** Back to the Phase 1 sandbox. */
    stop() { farm.mode = 'off'; farm.level = null; farm.flock.present = true; },

    /** env stepper: integrate gameSeconds (<= 60). fast = inside skipHours. */
    step(envIn, gameSeconds, fast) { // eslint-disable-line no-unused-vars
      if (farm.mode !== 'level') return;
      // STUB: package "sim" integrates growth, intake, litter, ammonia, deaths and problems here.
      farm.flock.meanWeightG = weightAt(envIn.day);
    },

    /**
     * Do or read something on the farm. Returns the result (a reading, a sample, true/false).
     * Emits EV.ACTION { id, ...args, result } unless args.quiet.
     * @param {string} id  e.g. 'water.flowtest', 'sample.vent', 'litter.spread' (PHASE2.md "Actions")
     * @param {object} [args]
     */
    act(id, args = {}) {
      const result = stubAct(farm, env, id, args);
      if (!args.quiet) emit(EV.ACTION, { id, ...args, result });
      return result;
    },

    /** Litter surface temperature at (x, z), °C (what the floor thermometer reads, no noise). */
    floorTempAt(x, z) { return env.floorTemp(x, z); },
    /** Litter moisture % at (x, z). */
    litterMoistureAt(x, z) { return farm.litter.moistureGrid[cellIndex(x, z)] ?? 22; },
    /** Lux at bird level at (x, z). */
    luxAt() { return env.lightsOn ? farm.light.luxAtBirds * (env.lightLevel ?? 1) : 0; },

    /** Hidden truth for tests and the debug tools only (never shown to the player). */
    debug: {
      trigger(problemId) { emit(EV.FARM_PROBLEM, { id: problemId, phase: 'start' }); },
      truth() { return { flock: { ...farm.flock }, problems: farm.problems.map((p) => ({ ...p })) }; },
    },

    serialize() { return { v: 1, mode: farm.mode }; }, // grids as integer arrays (moisture x 10)
    restore(data) { if (data && data.mode) farm.mode = data.mode; },
  };
  // The farm is the only owner of deadOnFloor (flock.dead mirrors it).
  events && events.on(EV.DEAD_PICK, (p) => { farm.flock.deadOnFloor = Math.max(0, farm.flock.deadOnFloor - (p.n || 0)); });
  return farm;
}

export function cellIndex(x, z) {
  const cx = Math.max(0, Math.min(FLOOR_GRID.nx - 1, Math.floor((x - FLOOR_GRID.x0) / FLOOR_GRID.cell)));
  const cz = Math.max(0, Math.min(FLOOR_GRID.nz - 1, Math.floor((z - FLOOR_GRID.z0) / FLOOR_GRID.cell)));
  return cz * FLOOR_GRID.nx + cx;
}

// STUB results so panels and props can be built against the contract before the model exists.
function stubAct(farm, env, id, a) {
  switch (id) {
    case 'water.meter': return { litres: Math.round(farm.water.meterL), yesterdayLitres: null };
    case 'water.flowtest': return { mlMin: farm.water.lines[a.line]?.flowMlMin ?? 0 };
    case 'feed.meter': return { kg: Math.round(farm.feed.meterKg) };
    case 'feed.silo': return { kg: Math.round(farm.feed.siloKg) };
    case 'floor.probe': return { tempC: +env.floorTemp(a.x, a.z).toFixed(1) };
    case 'litter.squeeze': { const m = farm.litterMoistureAt(a.x, a.z); return { moisturePct: Math.round(m), feel: m < 25 ? 'dry' : m <= 30 ? 'ok' : m <= 38 ? 'damp' : 'wet' }; }
    case 'light.lux': return { lux: Math.round(farm.luxAt(a.x, a.z)) };
    case 'sample.box': return { chicks: LEVEL1.chicksPerBox, weightKg: +(LEVEL1.chicksPerBox * farm.flock.chickWeightG / 1000 + 0.35).toFixed(2), boxKg: 0.35 };
    case 'sample.grade': return { reflexSec: 1.5, navel: 'healed', hocks: 'clean', weightG: farm.flock.chickWeightG };
    case 'sample.vent': return { tempC: 40.0 };
    case 'sample.crop': return { crop: 'full' };
    case 'sample.weigh': return { weightG: Math.round(farm.flock.meanWeightG) };
    case 'litter.spread': return { cover: farm.litter.cover };
    case 'water.filter': return { inBar: 2.5, outBar: +(2.5 * farm.water.filterFactor).toFixed(1) };
    case 'water.clearFilter': return { fixed: farm.water.filterFactor < 1 };
    case 'water.fixLeak': return { fixed: !!farm.water.leak };
    case 'heat.relight': return { fixed: false };
    default: return true;
  }
}
