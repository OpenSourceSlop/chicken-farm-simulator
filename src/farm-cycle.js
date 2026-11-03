// Phase 3 farm state for the whole cycle — STUB (PHASE3.md §13.8). Owner: package "sim", which replaces this
// file with the model of PHASE3.md §6. The stub makes the contract fields exist and moves the few of them
// that other packages' flows wait on (PHASE3.md §13.8 "minimal state changes"), so run, panels and scene can
// build and test against it: no heat, health, feed or clean-out model is here.
//
// installCycle(farm, env)   called once by createFarm: adds the Phase 3 state below (again after every
//                           farm.start / farm.restore), farm.cycleStub = true, farm.enterLevel(def),
//                           farm.debug.set(path, value)
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
//                  bool }, lines: [0..1 x4], disinfectant (header tank), pans: [bool x3], washbay: { item:
//                  bool }, baits: [bool x4], closedDay, swabs: [{ x, z, cell }], labDay, lab: { positive, of,
//                  places: [{ x, z, positive }] } | null, pass, bookedDay }
//   farm.plan    null | { measured: { length, width }, decisions, sums, sheet, sentAt, replyAt, outcome }
//   farm.feed.silos   [{ type, kg, layers: [{ type, kg }] (bottom first: the auger draws the oldest) }] x 2
//   farm.flock.lameOnFloor   lame birds on the floor (drawn 1:1 by the flock, up to 24)
//   farm.comfort.eZ (Float64Array, 8 zones of 6 m along the house), farm.comfort.hotFrom (°C over target)
//
// STUB state changes (enough for the run package's flows; the model replaces every one):
//   vaccine   water.main off → 'thirst'; vaccine.mix → 'mixed'; water.main on → 'drinking'; 'drunk' 2 h later
//             (coverage 0.95)
//   catch     at harvest.catchAt (the company's default day 42 02:00 when nothing was booked) the crew
//             catches the eight sections in HARVEST.sectionOrder, sectionMin each: EV.CATCH start / section /
//             end, the flock's birds leave section by section, trucks fill, harvest.result filled at the end
//   clean     clean.scrape / wash / spray paint their grids (litter cover off; washed + wet; sprayed x
//             dryness); the wet grid dries with the fans; swabs: the lab letter 2 days later at 06:00
//             (0 positive), EV.LETTER { kind: 'lab' }
import { FLOOR_GRID, HARVEST, CLEAN, HOUSE_BOUNDS, PLAN_CONTRACT } from './config.js';
import { EV } from './events.js';
import { planSums, cleanPlan, planOutcome } from './farm-plan.js';

const N = FLOOR_GRID.nx * FLOOR_GRID.nz;
const W = (HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin) / HARVEST.sections;
const cellOf = (x, z) => Math.max(0, Math.min(FLOOR_GRID.nx - 1, Math.floor((x - FLOOR_GRID.x0) / FLOOR_GRID.cell))) * FLOOR_GRID.nz
  + Math.max(0, Math.min(FLOOR_GRID.nz - 1, Math.floor((z - FLOOR_GRID.z0) / FLOOR_GRID.cell)));
const cellXZ = (i) => ({ x: FLOOR_GRID.x0 + (Math.floor(i / FLOOR_GRID.nz) + 0.5) * FLOOR_GRID.cell, z: FLOOR_GRID.z0 + ((i % FLOOR_GRID.nz) + 0.5) * FLOOR_GRID.cell });
const mean = (g) => { let s = 0; for (let i = 0; i < g.length; i++) s += g[i]; return s / g.length; };

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
      catchAt: null, bookedAt: null, started: false, startedAt: null,
      sections: Array.from({ length: HARVEST.sections }, (_, i) => ({ i, x0: HOUSE_BOUNDS.xMin + i * W, x1: HOUSE_BOUNDS.xMin + (i + 1) * W, state: 'waiting', birds: 0 })),
      trucks: Array.from({ length: HARVEST.trucks }, () => ({ crates: 0, birds: 0, netKg: 0, left: false })),
      result: null,
    },
    clean: {
      wash: new Float32Array(N), spray: new Float32Array(N), wet: new Float32Array(N), washShare: 0, sprayShare: 0, wetShare: 0,
      brushed: Object.fromEntries(CLEAN.brushParts.map((p) => [p, false])), lines: [0, 0, 0, 0], disinfectant: false, pans: [false, false, false],
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
  if (farm.feed && !farm.feed.silos) { // a restored feed keeps its silos (they are in the save)
    const kg = farm.feed.siloKg ?? 0;
    farm.feed.silos = [{ type: 'starter', kg, layers: kg > 0 ? [{ type: 'starter', kg }] : [] }, { type: 'grower', kg: 0, layers: [] }];
  }
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
    if (farm.mode !== 'level') return;
    if (farm.comfort.eZ) farm.comfort.eZ.fill(farm.comfort.e ?? 0); // stub: every zone reads the brooding floor's figure
    stubStep(farm, e, s / 3600);
  };
  /** STUB: remembers the level def; the model adds its problems and weather (PHASE3.md §7). */
  farm.enterLevel = (def) => { farm.cycleLevel = def || null; };
  /** Set any farm field by a dotted path (tests and the other packages' harness runs only). */
  farm.debug.set = (path, value) => {
    const keys = String(path).split('.'), last = keys.pop();
    let o = farm;
    for (const k of keys) { if (o[k] == null || typeof o[k] !== 'object') return false; o = o[k]; }
    o[last] = value;
    return true;
  };
}

function stubStep(farm, env, hrs) {
  const v = farm.health.vaccine;
  if (v.state === 'drinking' && env.day >= v.startAt + 2 / 24) Object.assign(v, { state: 'drunk', drunkAt: env.day, hours: 2, coverage: 0.95 });
  const hv = farm.harvest, fl = farm.flock;
  if (hv.catchAt == null && fl.alive > 0 && env.day >= HARVEST.bookFrom.day + HARVEST.bookFrom.hour / 24) hv.catchAt = HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24;
  if (hv.catchAt != null && !hv.started && fl.alive > 0 && env.day >= hv.catchAt - 1e-9) {
    hv.started = true; hv.startedAt = env.day;
    const per = Math.round(fl.alive / HARVEST.sections);
    for (const sct of hv.sections) { sct.birds = per; sct.state = 'penned'; }
    farm.emit(EV.CATCH, { phase: 'start', i: null, birds: fl.alive });
    farm.emit(EV.FARM_DELIVERY, { kind: 'catch', phase: 'arrive' });
  }
  if (hv.started && !hv.result) {
    const doneN = Math.min(HARVEST.sections, Math.floor(((env.day - hv.startedAt) * 1440) / HARVEST.sectionMin));
    for (let k = 0; k < HARVEST.sections; k++) {
      const sct = hv.sections[HARVEST.sectionOrder[k]];
      if (k < doneN && sct.state !== 'done') {
        const birds = k === HARVEST.sections - 1 ? fl.alive : Math.min(fl.alive, sct.birds);
        removeBirds(fl, birds);
        const t = hv.trucks[hv.trucks[0].birds < HARVEST.cratesPerTruck * HARVEST.birdsPerCrate ? 0 : 1];
        t.birds += birds; t.crates = Math.ceil(t.birds / HARVEST.birdsPerCrate); t.netKg = Math.round((t.birds * fl.meanWeightG * 0.98) / 1000);
        sct.state = 'done'; sct.birds = 0;
        farm.emit(EV.CATCH, { phase: 'section', i: sct.i, birds });
      } else if (k === doneN && sct.state === 'penned') sct.state = 'catching';
    }
    if (doneN >= HARVEST.sections) {
      fl.alive = 0; fl.present = false;
      const sold = hv.trucks.reduce((a, t) => a + t.birds, 0), liveKg = hv.trucks.reduce((a, t) => a + t.netKg, 0);
      hv.trucks.forEach((t, i) => { t.left = true; farm.emit(EV.FARM_DELIVERY, { kind: 'catch', phase: 'leave', truck: i }); });
      hv.result = { sold, liveKg, meanLiveG: sold ? Math.round((1000 * liveKg) / sold) : 0, fcr: liveKg ? +(fl.cumFeedKg / liveKg).toFixed(2) : null,
        mortalityPct: +((100 * (fl.placed - sold)) / Math.max(1, fl.placed)).toFixed(2), uniformityPct: null, epef: null, feedLeftKg: farm.feed.siloKg ?? 0,
        withdrawalH: null, gutFull: false, doa: 0, stub: true };
      farm.emit(EV.CATCH, { phase: 'end', i: null, birds: sold });
    }
  }
  const C = farm.clean;
  if (C.wetShare > 0) {
    const k = (0.04 + 0.03 * (env.fansEffective ?? env.fansManual ?? 0)) * (1 - env.outsideRH / 150) * hrs;
    for (let i = 0; i < N; i++) C.wet[i] = Math.max(0, C.wet[i] - k);
    C.wetShare = mean(C.wet);
  }
  if (C.labDay != null && !C.lab && env.dayNumber >= C.labDay && env.hour >= 6) {
    C.lab = { positive: 0, of: C.swabs.length, places: C.swabs.map((s) => ({ x: s.x, z: s.z, positive: false })) };
    farm.emit(EV.LETTER, { kind: 'lab', day: env.dayNumber });
  }
}

function removeBirds(fl, n) {
  if (!(n > 0) || !(fl.alive > 0)) return;
  const k = Math.max(0, (fl.alive - n) / fl.alive), c = fl.cohorts;
  if (c) for (const key of ['good', 'late', 'weak']) if (c[key]) c[key].n = Math.round(c[key].n * k);
  fl.alive = c ? (c.good?.n || 0) + (c.late?.n || 0) + (c.weak?.n || 0) : Math.round(fl.alive * k);
}

function paint(farm, x, z, r, fn) {
  const C = farm.clean;
  for (let i = 0; i < N; i++) { const p = cellXZ(i); if ((p.x - x) ** 2 + (p.z - z) ** 2 <= r * r) fn(i); }
  C.washShare = mean(C.wash); C.sprayShare = mean(C.spray); C.wetShare = mean(C.wet);
}

const r1 = (v) => Math.round(v * 10) / 10;
const planOf = (farm) => farm.plan || (farm.plan = { measured: {}, decisions: null, sums: null, sheet: null, sentAt: null, replyAt: null, outcome: null });

/** The Phase 3 actions the stub answers (PHASE3.md §13.3); undefined = Phase 2's doAct handles it. */
export function cycleAct(farm, env, id, a = {}) {
  const C = farm.clean, hv = farm.harvest, v = farm.health.vaccine;
  switch (id) {
    case 'house.curtain': farm.house.curtainOpen = !!a.open; env.setBroodCurtain(!a.open); return true;
    case 'plan.measure': {
      const axis = a.axis === 'width' ? 'width' : 'length';
      const m = Number.isFinite(a.m) ? r1(a.m) : axis === 'length' ? HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin : HOUSE_BOUNDS.zMax - HOUSE_BOUNDS.zMin;
      planOf(farm).measured[axis] = m;
      return { m };
    }
    case 'plan.send': {
      const p = planOf(farm), ms = p.measured || {};
      const houseM2 = ms.length && ms.width ? r1(ms.length * ms.width) : PLAN_CONTRACT.houseM2Drawings;
      const decisions = cleanPlan(a), sums = planSums(decisions, houseM2);
      Object.assign(p, { decisions, sums, sheet: a.sums ?? null, sentAt: env.day, replyAt: env.day + PLAN_CONTRACT.replyAfterH / 24, outcome: planOutcome({ decisions, sums }) });
      return sums;
    }
    case 'bio.change': if (farm.stats) farm.stats.changedAt = env.day; return true;
    case 'phone.bookCatch': {
      const t = (a.day ?? 0) + (a.hour ?? 0) / 24, from = HARVEST.bookFrom.day + HARVEST.bookFrom.hour / 24, to = HARVEST.bookTo.day + HARVEST.bookTo.hour / 24;
      const now = hv.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24;
      if (hv.started) return { booked: false, catchAt: now, reason: 'the crew is already catching' };
      if (t < from - 1e-9 || t > to + 1e-9) return { booked: false, catchAt: now, reason: `the crew catches between day ${HARVEST.bookFrom.day} ${HARVEST.bookFrom.hour}:00 and day ${HARVEST.bookTo.day} 0${HARVEST.bookTo.hour}:00` };
      hv.catchAt = t; hv.bookedAt = env.day; if (farm.stats) farm.stats.catchBookedAt = env.day;
      return { booked: true, catchAt: t };
    }
    case 'phone.bookChicks': {
      const d = Math.round(a.day ?? 0);
      if (C.closedDay == null) return { booked: false, bookedDay: C.bookedDay, reason: 'the house is not closed for its rest yet' };
      if (d < C.closedDay + CLEAN.bookMinDays || d > 69) return { booked: false, bookedDay: C.bookedDay, reason: `the hatchery has chicks from day ${C.closedDay + CLEAN.bookMinDays} to day 69` };
      C.bookedDay = d;
      return { booked: true, bookedDay: d };
    }
    case 'water.main':
      if (!a.open && v.state === 'none') Object.assign(v, { state: 'thirst', thirstFrom: env.day });
      else if (a.open && v.state === 'mixed') Object.assign(v, { state: 'drinking', startAt: env.day });
      return true;
    case 'vaccine.mix':
      if (v.state === 'none' || v.state === 'thirst') Object.assign(v, { state: 'mixed', mixedAt: env.day, stabiliser: !!a.stabiliser });
      return { litres: Math.round((farm.flock.alive || 0) * 0.05) };
    case 'water.disinfect': C.disinfectant = !!a.on; return true;
    case 'water.flush':
      if (C.disinfectant && a.on && a.line >= 0 && a.line < 4) { C.lines[a.line] = 1; return { flushClear: 1, disinfected: true }; }
      return undefined;
    case 'clean.scrape': {
      const L = farm.litter;
      paint(farm, a.x, a.z, a.r ?? 1.2, (i) => { if (L && L.coverGrid) L.coverGrid[i] = 0; });
      return { share: L && L.coverGrid ? 1 - mean(L.coverGrid) : 1 };
    }
    case 'clean.wash': {
      const L = farm.litter;
      paint(farm, a.x, a.z, a.r ?? 2.5, (i) => { C.wash[i] = Math.max(C.wash[i], L && L.coverGrid && L.coverGrid[i] >= 0.5 ? 0.3 : 1); C.wet[i] = 1; });
      return { share: C.washShare };
    }
    case 'clean.spray': paint(farm, a.x, a.z, a.r ?? 2.5, (i) => { C.spray[i] = Math.max(C.spray[i], C.wash[i] * (1 - 0.7 * C.wet[i])); }); return { share: C.sprayShare };
    case 'clean.swab':
      C.swabs.push({ x: a.x, z: a.z, cell: cellOf(a.x, a.z) });
      if (C.swabs.length >= CLEAN.swabs && C.labDay == null) C.labDay = env.dayNumber + CLEAN.labDays;
      return { n: C.swabs.length };
    case 'house.close': C.closedDay = env.dayNumber; farm.house.closed = true; return true;
    default: return undefined;
  }
}
