// Phase 3 farm state for the whole cycle — STUB (PHASE3.md §13.8). Owner: package "sim", which
// replaces this file with the model of PHASE3.md §6 (the stub only makes the contract fields exist so
// the run, panels and scene packages can build against them).
//
// installCycle(farm, env)   called once by createFarm: adds the Phase 3 state below (and again after
//                           every farm.start / farm.restore), farm.cycleStub = true, farm.enterLevel(def)
// cycleAct(farm, env, id, args)   the Phase 3 actions the stub answers; undefined = not handled here
//                           (farm.act then runs Phase 2's doAct, whose default answers `true`)
//
// State (PHASE3.md §13.5), all JSON-safe except the clean grids (Float32Array per FLOOR_GRID cell):
//   farm.house   { curtainOpen, broodersUp, fansBroken: [index], padWorking (0..1), padFloatStuck, closed }
//   farm.health  { vaccine: { state: 'none'|'thirst'|'mixed'|'drinking'|'drunk', thirstFrom, mixedAt,
//                  startAt, drunkAt, hours, stabiliser, coverage }, medication: { on, from, days },
//                  disease: { gumboro, cocci } (severity 0..1) }
//   farm.air     { dustIndex, ammoniaPpm }
//   farm.harvest { catchAt (env.day float) | null, bookedAt, started, sections: [{ i, x0, x1, state:
//                  'waiting'|'penned'|'catching'|'done', birds }], trucks: [{ crates, birds, netKg, left }],
//                  result: null | { sold, liveKg, meanLiveG, fcr, mortalityPct, uniformityPct, epef,
//                  feedLeftKg, withdrawalH, gutFull, doa } }
//   farm.clean   { wash, spray, wet: Float32Array(576), washShare, sprayShare, wetShare, brushed: { part:
//                  bool }, lines: [0..1 x4], pans: [bool x3], washbay: { item: bool }, baits: [bool x4],
//                  closedDay, swabs: [{ x, z, cell, positive }], labDay, lab: { positive, of } | null,
//                  pass, bookedDay }
//   farm.plan    null | { measured: { length, width }, decisions, sums, sheet, sentAt, replyAt, outcome }
//   farm.flock.lameOnFloor   lame birds on the floor (drawn 1:1 by the flock, up to 24)
//   farm.comfort.eZ (Float64Array 8 zones along the house), farm.comfort.hotFrom (°C over target)
import { FLOOR_GRID, HARVEST, CLEAN, HOUSE_BOUNDS } from './config.js';
import { planSums, cleanPlan, planOutcome } from './farm-plan.js';

const N = FLOOR_GRID.nx * FLOOR_GRID.nz;
const W = (HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin) / HARVEST.sections;

function freshCycleState() {
  return {
    house: { curtainOpen: false, broodersUp: false, fansBroken: [], padWorking: 1, padFloatStuck: false, closed: false },
    health: {
      vaccine: { state: 'none', thirstFrom: null, mixedAt: null, startAt: null, drunkAt: null, hours: null, stabiliser: false, coverage: null },
      medication: { on: false, from: null, days: 0 },
      disease: { gumboro: 0, cocci: 0 },
    },
    air: { dustIndex: 0, ammoniaPpm: 0 },
    harvest: {
      catchAt: null, bookedAt: null, started: false,
      sections: Array.from({ length: HARVEST.sections }, (_, i) => ({ i, x0: HOUSE_BOUNDS.xMin + i * W, x1: HOUSE_BOUNDS.xMin + (i + 1) * W, state: 'waiting', birds: 0 })),
      trucks: Array.from({ length: HARVEST.trucks }, () => ({ crates: 0, birds: 0, netKg: 0, left: false })),
      result: null,
    },
    clean: {
      wash: new Float32Array(N), spray: new Float32Array(N), wet: new Float32Array(N), washShare: 0, sprayShare: 0, wetShare: 0,
      brushed: Object.fromEntries(CLEAN.brushParts.map((p) => [p, false])), lines: [0, 0, 0, 0], pans: [false, false, false],
      washbay: Object.fromEntries(CLEAN.washItems.map((p) => [p, false])), baits: [false, false, false, false],
      closedDay: null, swabs: [], labDay: null, lab: null, pass: 1, bookedDay: null,
    },
    plan: null,
  };
}

function resetCycle(farm) {
  Object.assign(farm, freshCycleState());
  if (farm.flock) farm.flock.lameOnFloor = farm.flock.lameOnFloor ?? 0;
  const c = farm.comfort || (farm.comfort = {});
  c.eZ = new Float64Array(8);
  c.hotFrom = 1.5;
}

/** Add the Phase 3 state to a Phase 2 farm (createFarm calls this once). */
export function installCycle(farm, env) {
  farm.cycleStub = true;
  farm.cycleLevel = null;
  resetCycle(farm);
  const start = farm.start, restore = farm.restore, step = farm.step;
  farm.start = (level, opts) => { start(level, opts); resetCycle(farm); env.setBroodCurtain?.(null); };
  farm.restore = (data) => { restore(data); resetCycle(farm); };
  farm.step = (e, s, fast) => {
    step(e, s, fast);
    // stub: every zone reads the brooding floor's comfort figure
    if (farm.mode === 'level' && farm.comfort.eZ) farm.comfort.eZ.fill(farm.comfort.e ?? 0);
  };
  /** STUB: remembers the level def; the model adds its problems and weather (PHASE3.md §7). */
  farm.enterLevel = (def) => { farm.cycleLevel = def || null; };
}

const r1 = (v) => Math.round(v * 10) / 10;

/** The Phase 3 actions the stub answers (PHASE3.md §13.3); undefined = Phase 2's doAct handles it. */
export function cycleAct(farm, env, id, a = {}) {
  switch (id) {
    case 'house.curtain': {
      const open = !!a.open;
      farm.house.curtainOpen = open;
      env.setBroodCurtain(!open);
      return true;
    }
    case 'plan.measure': {
      const axis = a.axis === 'width' ? 'width' : 'length';
      const m = Number.isFinite(a.m) ? r1(a.m) : axis === 'length' ? HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin : HOUSE_BOUNDS.zMax - HOUSE_BOUNDS.zMin;
      farm.plan = farm.plan || { measured: {}, decisions: null, sums: null, sheet: null, sentAt: null, replyAt: null, outcome: null };
      farm.plan.measured[axis] = m;
      return { m };
    }
    case 'plan.send': {
      const p = farm.plan || (farm.plan = { measured: {}, decisions: null, sums: null, sheet: null, sentAt: null, replyAt: null, outcome: null });
      const ms = p.measured || {};
      const houseM2 = ms.length && ms.width ? r1(ms.length * ms.width) : undefined;
      const decisions = cleanPlan(a);
      const sums = planSums(decisions, houseM2);
      Object.assign(p, { decisions, sums, sheet: a.sums ?? null, sentAt: env.day, replyAt: env.day + 1 / 24, outcome: planOutcome(sums) });
      return sums;
    }
    case 'bio.change':
      if (farm.stats) farm.stats.changedAt = env.day;
      return true;
    default:
      return undefined;
  }
}
