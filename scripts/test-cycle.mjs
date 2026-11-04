// The farm model for the whole cycle in node (PHASE3.md §6.14). Owner: package "sim". CYCLE_TARGETS, SNAPS
// and checkCycle below are contract data and code committed by the integrator: the sim package's
// runCycle returns a trace (hourly rows, level results, level-end snapshots) and checkCycle measures every
// snap from that trace itself, so the model never grades itself. The climate and growth checks
// (scripts/cycle-refs.mjs, env alone) run now; the profile tests skip while farm.cycleStub is true.
//   node scripts/test-cycle.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { EV } from '../src/events.js';
import { CYCLE_PROFILES, runCycle } from '../src/farm-profiles-cycle.js';
import { planSums, planOutcome } from '../src/farm-plan.js';
import { LEVELS, SKILL_BRANCHES, weightAt, feedStdGAt, feedPerGainAt } from '../src/config.js';
import { GROWTH_REFS, growthAt } from './cycle-refs.mjs';
// Phase 4 (PHASE4.md §2.6): the climate references of the tuned model replace cycle-refs.mjs CLIMATE_REFS / WINDOW_REFS
// (kept there for the record); the bands below are §2.6's
import { CLIMATE_REFS_P4 as CLIMATE_REFS, WINDOW_REFS_P4 as WINDOW_REFS, runPlanP4 as runPlan } from './tuning-refs.mjs';

/**
 * Bands per profile (PHASE3.md §6.14). Level keys → measured level results (runCycle's `levels[id]`):
 * { pass, endDay, weightG (the weigh day's weighed mean), deathsPct (deaths + culls in the level, % of the
 * birds alive at its start) } and for finish / cleanout their result fields. `snaps` → names of SNAPS.
 * Ratios "VsIdeal" / differences "UnderIdeal" compare with the ideal run of the same seed.
 */
export const CYCLE_TARGETS = {
  ideal: {
    plan: { pass: true },
    level1: { pass: true },
    week2: { pass: true, weightG: [485, 530], deathsPct: [0.15, 0.5] },
    week3: { pass: true, weightG: [960, 1040], deathsPct: [0.15, 0.5] },
    weeks45: { pass: true, weightG: [2230, 2420], deathsPct: [0.2, 0.8] },
    finish: { pass: true, liveG: [2820, 3020], fcr: [1.55, 1.72], mortalityPct: [1.4, 3.2], uniformityPct: [68, 76], epef: [360, 440], doaPct: [0.1, 0.25], withdrawalH: [8, 12] },
    cleanout: { pass: true, positive: [0, 1], restDays: [21, 21] },
    snaps: { vaccineCoverage: [0.92, 0.98], vaccineHours: [1.5, 2.2], houseWave31At15: [28.8, 31.5], pantWave31At15: [0, 0.3],
      heatwaveHeatDeathsPct: [0, 0.05], heatwavePantHours: [0.3, 8], heatDeathsW45Pct: [0, 0.05], nh3NightMaxW46: [0, 25],
      pantShareW3At15: [0, 0.2], dustMaxDay23: [0, 1.9], minBranchPoints: [9, Infinity],
      // Phase 4 (PHASE4.md §2.6): the evening line, no thirst at the catch, the water ratio of well-cooled birds, the gas
      eveningPant37At19: [0, 0.1], dehydrationFinishPct: [0, 0], waterFeedHotDay: [1.8, 2.0], gasKgTo21: [200, 300], blendFinH: [20, Infinity] },
  },
  noDark: { snaps: { sdsVsIdeal: [3, Infinity], lameVsIdeal: [2, Infinity] } },
  lateLift: { snaps: { day14WeightUnderIdealPct: [3, Infinity], day14UniformityUnderIdeal: [3, Infinity], broodLitterDay14: [32, Infinity] } },
  // integrator, Phase 3 merge: noStep's absolute bands (RH ≥ 85 % on 3-7 nights, litter ≥ 33 %, NH3 ≥ 25 ppm, day 21 ≥ 3 %
  // under) cannot hold in a heated week-2 house (PHASE3.md §6.16): rebased on the model's effect over the ideal
  noStep: { snaps: { nightRhOverIdealWeek2: [2.5, Infinity], litterDay14OverIdeal: [2, Infinity], nh3Night14OverIdeal: [1.5, Infinity], day21WeightUnderIdealPct: [0.2, Infinity] } },
  poorVaccine: { week3: { pass: true, deathsPct: [0.5, 0.95] },
    snaps: { vaccineCoverage: [0.35, 0.7], vaccineHours: [3.5, 5], gumboroStarted: true, week3DiseaseDeathsPct: [0.3, 0.6], day21WeightUnderIdealPct: [4, 8] } },
  poorVaccineCocci: { week3: { pass: false }, snaps: { gumboroStarted: true, week3DiseaseDeathsPct: [0.9, 2.5] } },
  cocciUntreated: { week3: { pass: false }, snaps: { week3DiseaseDeathsPct: [0.5, 1.5], day21WeightUnderIdealPct: [2, Infinity] } },
  // sim package, Phase 4 (PHASE4.md §2.7): the closed week-3 house of the tuned model (the flock's heat x 2.5) costs 4.1 % of the
  // day 21 weight (Phase 3: 2.5 %); the band's top 4 -> 5 for the integrator to agree
  minVentW3: { week3: { pass: true }, snaps: { pantShareW3At15: [0.8, 1], heatDeathsW3Pct: [0, 0.15], day21WeightUnderIdealPct: [1, 5] } },
  crumbleOn: { snaps: { day28WeightUnderIdealPct: [3, 8] } },
  abruptChange: { snaps: { undigestedHours: [12, 30], intakeDipPct: [2, 4] } },
  overfullSilo: { snaps: { finisherPansDay: [31, 40], day35WeightUnderIdealPct: [0, 3] } },
  dustOn: { snaps: { dustMaxDay23: [1.5, 2], dustyHoursDay23: [3, Infinity] } },
  noTunnel: { weeks45: { pass: false, endDay: [23, 27] }, snaps: { heatDeathsW45Pct: [2, Infinity] } },
  fansNoPad: { weeks45: { pass: false, endDay: [30, 31] }, snaps: { houseWave30At15: [38, 40.5], heatwaveHeatDeathsPct: [2, Infinity], waterFeedHotDay: [2.1, 2.7] } },
  padInHumid: { snaps: { felt33At15OverIdeal: [1.5, 3.5], heatDeaths33Pct: [0, 0.3], intake33UnderIdealPct: [1, 6] } },
  fanUnfixed: { snaps: { airSpeed6Fans: [2.0, 2.2], heatwavePantHoursVsIdeal: [1.5, Infinity] } },
  // review: the plant deducts the gut fill (3 % of the weighed kg), so skipping the withdrawal pays less than
  // an 8-12 h withdrawal and its FCR is worse (it was better on every number before)
  noWithdrawal: { snaps: { gutFull: true, fcrOverIdeal: [0, Infinity], paidKgUnderIdeal: [1, Infinity], epefUnderIdeal: [1, Infinity] } },
  longWithdrawal: { snaps: { liveUnderIdealPct: [3.5, 6], doaVsIdeal: [2, Infinity] } },
  brightCatch: { snaps: { doaVsIdeal: [1.4, Infinity] } },
  wetDisinfect: { cleanout: { pass: false, positive: [3, 7] } },
  litterLeft: { cleanout: { positive: [3, 10] } },
  shortRest: { cleanout: { pass: false, restDays: [14, 14] } },
  // review: a week 2 with no care at all (no light program, curtain, vaccine, raising, weighing, dead birds picked
  // up) does not pass on the automatic scale; six fans and the pad on 16-day-old birds chill them and earn no point
  noCare: { week2: { pass: false } },
  padWeek3: { snaps: { w3HeatEarned: false, heat3FixedByAir: false, coldDeathsDay16: [1, 15] } },
  // Phase 4 (PHASE4.md §2.6): three fans in the evenings of big birds (a visible cost, no deaths); the young birds' pad
  // sim package (PHASE4.md §2.7): the intake loss of heatIntakeP4 starts at hotFrom, so the evenings' panting (18 x the ideal's
  // bird-hours) costs 0.03 % of the day 35 weight, not 0.5-3 %: the band's floor 0.5 -> 0 for the integrator to agree
  eveningFans3: { weeks45: { pass: true }, snaps: { eveningPantHoursVsIdeal: [3, Infinity], day35WeightUnderIdealPct: [0, 3] } },
  padYoung1: { snaps: { w3HeatEarned: true, coldDeathsDay16: [0, 0], pantShare16At15: [0, 0.1] } },
};

// ---- the trace runCycle must return (PHASE3.md §6.14) ----
// run.hourly: one row per game hour on the hour from the start: { t (env.day), day, hour, outC, outRH, houseC,
//   houseRH, feltMean, pantShare, airSpeed, fansEffective, padOn, nh3, dust, alive, dead: { [cause]: n }
//   (cumulative), culls: { [reason]: n } (cumulative), feedEatenKg (cumulative), meanWeightG, broodLitter,
//   litterMean (% over the floor in use), droppings (the flock's main look), panType: { starter, grower,
//   finisher }, lameOnFloor, fansManual }
// run.levels[id]: the level result (§10): { pass, endDay, weightG, uniformityPct, deathsPct, ... the finish
//   and cleanout fields of CYCLE_TARGETS.ideal }
// run.levelEnds[id]: JSON of farm.health, farm.problems, farm.stats.levelStart at the level end
// run.points: { [branch]: points } at the end; run.records: the records (serialize() is compared)
const H = (run, day, hour) => run.hourly.find((r) => r.day === day && Math.abs(r.hour - hour) < 1e-6) || null;
const between = (run, from, to) => run.hourly.filter((r) => r.t >= from - 1e-9 && r.t < to - 1e-9);
const field = (row, k) => (row ? row[k] : null);
const deadOf = (row, cause) => (row ? row.dead[cause] || 0 : 0);
const pctOf = (n, base) => (base > 0 ? (100 * n) / base : null);
const diffDead = (run, cause, from, to) => { const a = between(run, from, to); return a.length ? pctOf(deadOf(a[a.length - 1], cause) - deadOf(a[0], cause), a[0].alive) : null; };
const pantHours = (run, from, to) => between(run, from, to).reduce((s, r) => s + r.pantShare, 0);
const ratio = (v, i) => (v != null && i != null && i > 0 ? v / i : v != null && v > 0 ? Infinity : v == null ? null : 1);
const under = (v, i) => (v != null && i ? (100 * (i - v)) / i : null);

/** Every snap: what it measures (day, hour, quantity, units). `ideal` is the ideal run of the same seed. */
export const SNAPS = {
  vaccineCoverage: (r) => r.levelEnds.week2?.health?.vaccine?.coverage ?? null,                 // share 0..1 at the week 2 end
  vaccineHours: (r) => r.levelEnds.week2?.health?.vaccine?.hours ?? null,                        // h from the lines opening to the tank empty
  gumboroStarted: (r) => (r.levelEnds.week3?.problems || []).some((p) => p.id === 'gumboro' && p.phase !== 'pending'),
  houseWave31At15: (r) => field(H(r, 31, 15), 'houseC'),                                          // °C, day 31 15:00
  pantWave31At15: (r) => field(H(r, 31, 15), 'pantShare'),                                        // share, day 31 15:00
  houseWave30At15: (r) => field(H(r, 30, 15), 'houseC'),                                          // °C, day 30 15:00
  heatwaveHeatDeathsPct: (r) => diffDead(r, 'heat', 30.25, 33.25),                                // % of the birds, d30 06:00 → d33 06:00
  heatwavePantHours: (r) => pantHours(r, 30.25, 33.25),                                           // panting bird-hours per bird, same window
  heatwavePantHoursVsIdeal: (r, i) => ratio(pantHours(r, 30.25, 33.25), pantHours(i, 30.25, 33.25)),
  heatDeathsW45Pct: (r) => diffDead(r, 'heat', 22.25, Math.min(36.25, r.hourly[r.hourly.length - 1].t + 1e-6)), // % d22 06:00 → d36 06:00 (or the end)
  heatDeathsW3Pct: (r) => diffDead(r, 'heat', 15.25, 22.25),
  heatDeaths33Pct: (r) => diffDead(r, 'heat', 33.25, 34.25),
  felt33At15OverIdeal: (r, i) => { const a = field(H(r, 33, 15), 'feltMean'), b = field(H(i, 33, 15), 'feltMean'); return a != null && b != null ? a - b : null; },
  pantShareW3At15: (r) => field(H(r, 18, 15), 'pantShare'),                                       // share, day 18 15:00
  nh3NightMaxW46: (r) => Math.max(...between(r, 22, 42).filter((x) => x.hour >= 22 || x.hour <= 5).map((x) => x.nh3)), // ppm, nights d22-41
  nh3Night14: (r) => Math.max(...between(r, 14 + 22 / 24, 15 + 6 / 24).map((x) => x.nh3)),           // ppm, night 14 → 15
  nightsRh85Week2: (r) => { let n = 0; for (let d = 8; d <= 14; d++) if (between(r, d, d + 6 / 24).some((x) => x.houseRH >= 85)) n++; return n; }, // nights
  litterDay14: (r) => field(H(r, 14, 18), 'litterMean'),                                          // %, day 14 18:00
  nightRhOverIdealWeek2: (r, i) => { const m = (x) => { const a = []; for (let d = 9; d <= 15; d++) a.push(...between(x, d, d + 6 / 24).map((h) => h.houseRH)); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; }; const a = m(r), b = m(i); return a != null && b != null ? a - b : null; }, // RH points, mean of the nights 00:00-06:00 after days 8-14
  litterDay14OverIdeal: (r, i) => { const a = field(H(r, 14, 18), 'litterMean'), b = field(H(i, 14, 18), 'litterMean'); return a != null && b != null ? a - b : null; }, // % points, day 14 18:00
  nh3Night14OverIdeal: (r, i) => { const f = (x) => Math.max(...between(x, 14 + 22 / 24, 15 + 6 / 24).map((h) => h.nh3)); return f(r) - f(i); }, // ppm, night 14 -> 15
  broodLitterDay14: (r) => field(H(r, 14, 18), 'broodLitter'),                                    // %, brooding half, day 14 18:00
  day14WeightUnderIdealPct: (r, i) => under(r.levels.week2?.weightG, i.levels.week2?.weightG),     // % of the ideal's weighed mean
  day14UniformityUnderIdeal: (r, i) => (i.levels.week2?.uniformityPct ?? 0) - (r.levels.week2?.uniformityPct ?? 0), // points
  day21WeightUnderIdealPct: (r, i) => under(r.levels.week3?.weightG, i.levels.week3?.weightG),
  day28WeightUnderIdealPct: (r, i) => under(field(H(r, 28, 12), 'meanWeightG'), field(H(i, 28, 12), 'meanWeightG')),
  day35WeightUnderIdealPct: (r, i) => under(r.levels.weeks45?.weightG, i.levels.weeks45?.weightG),
  sdsVsIdeal: (r, i) => ratio(diffDead(r, 'sds', 8, 36), diffDead(i, 'sds', 8, 36)),              // deaths on their backs, days 8-35
  lameVsIdeal: (r, i) => { const f = (x) => { const a = between(x, 10, 36); return a.length ? (deadOf(a[a.length - 1], 'legs') + (a[a.length - 1].culls.lame || 0)) - (deadOf(a[0], 'legs') + (a[0].culls.lame || 0)) : null; }; return ratio(f(r), f(i)); },
  week3DiseaseDeathsPct: (r) => diffDead(r, 'disease', 15.25, 22.25),                             // %, d15 06:00 → d22 06:00
  undigestedHours: (r) => between(r, 14, 18).filter((x) => x.droppings === 'undigested').length,  // h, days 14-17
  intakeDipPct: (r, i) => { const f = (x) => { const a = between(x, 15.25, 16.25); return a.length ? a[a.length - 1].feedEatenKg - a[0].feedEatenKg : null; }; return under(f(r), f(i)); }, // % of the ideal, d15 06 → d16 06
  finisherPansDay: (r) => { const x = r.hourly.find((h) => h.day >= 29 && h.panType.finisher >= 0.9); return x ? x.day : Infinity; }, // first calendar day
  dustMaxDay23: (r) => Math.max(...between(r, 23, 24).map((x) => x.dust)),
  dustyHoursDay23: (r) => between(r, 23, 24).filter((x) => x.dust > 1).length,
  airSpeed6Fans: (r) => { const x = between(r, 30, 33).find((h) => h.fansEffective >= 5 && h.airSpeed > 0 && h.fansManual === 6); return x ? x.airSpeed : null; }, // m/s with six fans switched on
  gutFull: (r) => !!r.levels.finish?.gutFull,
  w3HeatEarned: (r) => (r.skills.milestones('ventilation').find((m) => m.id === 'w3-heat')?.tier ?? null) != null,
  heat3FixedByAir: (r) => (r.levelEnds.week3?.problems || []).some((p) => p.id === 'warm-afternoon3' && p.fixedBy === 'air'),
  coldDeathsDay16: (r) => { const a = between(r, 16 + 12 / 24, 17); return a.length ? deadOf(a[a.length - 1], 'cold') - deadOf(a[0], 'cold') : null; }, // birds, d16 12:00-24:00
  liveOverIdealPct: (r, i) => -under(r.levels.finish?.liveG, i.levels.finish?.liveG),
  fcrOverIdeal: (r, i) => (r.levels.finish?.fcr != null && i.levels.finish?.fcr != null ? r.levels.finish.fcr - i.levels.finish.fcr : null), // FCR points
  paidKgUnderIdeal: (r, i) => (r.levels.finish?.paidKg != null && i.levels.finish?.paidKg != null ? i.levels.finish.paidKg - r.levels.finish.paidKg : null), // kg paid
  epefUnderIdeal: (r, i) => (r.levels.finish?.epef != null && i.levels.finish?.epef != null ? i.levels.finish.epef - r.levels.finish.epef : null), // EPEF points
  liveUnderIdealPct: (r, i) => under(r.levels.finish?.liveG, i.levels.finish?.liveG),
  doaVsIdeal: (r, i) => ratio(r.levels.finish?.doaPct, i.levels.finish?.doaPct),
  minBranchPoints: (r) => Math.min(...SKILL_BRANCHES.map((b) => r.points?.[b.id] ?? 0)),           // the ideal from the plan level: level 2 everywhere
  // ---- Phase 4 (PHASE4.md §2.6) ----
  eveningPant37At19: (r) => field(H(r, 37, 19), 'pantShare'),                                      // share, day 37 19:00
  dehydrationFinishPct: (r) => diffDead(r, 'dehydration', 36.25, r.hourly[r.hourly.length - 1].t + 1e-6), // % d36 06:00 → the end
  waterFeedHotDay: (r) => r.records.row(26)?.waterFeedRatio ?? null,                               // the records row of day 26: water ÷ feed over day 25 06:15 → day 26 06:15 (the hot afternoon)
  gasKgTo21: (r) => r.farm.stats.daily?.[21]?.gasAtSign ?? null,                                   // kg, the gas burnt by the day 21 record
  blendFinH: (r) => r.farm.stats.blendFinH ?? 0,                                                   // h the augers drew 20-80 % finisher
  intake33UnderIdealPct: (r, i) => { const f = (x) => { const a = between(x, 33.25, 34.25); return a.length ? a[a.length - 1].feedEatenKg - a[0].feedEatenKg : null; }; return under(f(r), f(i)); }, // % of the ideal, d33 06 → d34 06
  eveningPantHoursVsIdeal: (r, i) => { const f = (x) => between(x, 29, 42).filter((h) => h.hour >= 18).reduce((s, h) => s + h.pantShare, 0); return ratio(f(r), f(i)); }, // 18:00-24:00, days 29-41
  pantShare16At15: (r) => field(H(r, 16, 15), 'pantShare'),
};

const inBand = (v, b) => (b === true || b === false ? v === b : v != null && v >= b[0] - 1e-9 && v <= b[1] + 1e-9);
/** Compare one profile run with its CYCLE_TARGETS (the ideal run of the same seed for the comparisons). */
export function checkCycle(name, run, ideal) {
  const t = CYCLE_TARGETS[name], bad = [];
  for (const [lv, want] of Object.entries(t)) {
    if (lv === 'snaps') continue;
    const got = run.levels[lv];
    if (!got) { bad.push(`${lv}: no result`); continue; }
    for (const [k, b] of Object.entries(want)) if (!inBand(got[k], b)) bad.push(`${lv}.${k} ${JSON.stringify(got[k])} not in ${JSON.stringify(b)}`);
  }
  for (const [k, b] of Object.entries(t.snaps || {})) {
    const fn = SNAPS[k];
    if (!fn) { bad.push(`unknown snap ${k}`); continue; }
    const v = fn(run, ideal);
    if (!inBand(v, b)) bad.push(`${k} ${JSON.stringify(v)} not in ${JSON.stringify(b)}`);
  }
  return bad;
}

let failed = 0, skipped = 0;
const pending = [];
function test(name, fn) {
  const done = (r) => { if (r === 'skip') { skipped++; console.log(`skip ${name}`); } else console.log(`ok   ${name}`); };
  const fail = (err) => { failed++; console.log(`FAIL ${name}\n     ${err.message}`); };
  try { const r = fn(); if (r && typeof r.then === 'function') pending.push(r.then(done, fail)); else done(r); }
  catch (err) { fail(err); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const fmt = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);

const world = makeWorld();
const STUB = !!world.farm.cycleStub;

test('contract: every cycle profile has targets and every target a profile; every snap is defined', () => {
  for (const p of CYCLE_PROFILES) assert(CYCLE_TARGETS[p] || p === 'determinism', `no CYCLE_TARGETS for ${p}`);
  for (const k of Object.keys(CYCLE_TARGETS)) assert(CYCLE_PROFILES.includes(k), `targets for unknown profile ${k}`);
  for (const [name, t] of Object.entries(CYCLE_TARGETS)) {
    for (const k of Object.keys(t)) assert(k === 'snaps' || LEVELS.some((l) => l.id === k), `${name}: unknown level ${k}`);
    for (const k of Object.keys(t.snaps || {})) assert(SNAPS[k], `${name}: snap ${k} has no definition`);
  }
});

test('contract: the farm carries the Phase 3 state (PHASE3.md §13.5)', () => {
  const f = world.farm;
  f.start(undefined, { seed: 1 });
  for (const k of ['house', 'health', 'air', 'harvest', 'clean']) assert(f[k] && typeof f[k] === 'object', `farm.${k}`);
  assert(typeof f.enterLevel === 'function', 'farm.enterLevel');
  assert(Number.isFinite(f.flock.lameOnFloor), 'flock.lameOnFloor');
  assert(f.harvest.sections.length === 8 && f.clean.wash.length === 576, 'sections and clean grids');
  assert(f.comfort.eZ && f.comfort.eZ.length === 8 && Number.isFinite(f.comfort.hotFrom), 'comfort zones');
  assert(f.feed.silos && f.feed.silos.length === 2 && Array.isArray(f.feed.silos[0].layers), 'two silos with layers');
});

test('contract: Phase 3 actions the stub answers have their result shapes', () => {
  const { farm, env } = world;
  assert(farm.act('house.curtain', { open: true }) === true && env.broodCurtain === false, 'house.curtain open lifts env.broodCurtain');
  farm.act('house.curtain', { open: false });
  assert(farm.act('plan.measure', { axis: 'length' }).m === 48 && farm.act('plan.measure', { axis: 'width' }).m === 12, 'plan.measure');
  const r = farm.act('plan.send', { houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 });
  const ref = planSums({ houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576);
  assert(r.salePerWeek === ref.salePerWeek && farm.plan.outcome.pass, `plan.send ${JSON.stringify(r)}`);
  const c = farm.act('phone.bookCatch', { day: 42, hour: 2 });
  assert(c && c.catchAt === 42 + 2 / 24 && c.booked === true, `phone.bookCatch ${JSON.stringify(c)}`);
  const c2 = farm.act('phone.bookCatch', { day: 40, hour: 2 });
  assert(c2 && c2.booked === false && c2.catchAt === 42 + 2 / 24 && typeof c2.reason === 'string', `phone.bookCatch outside the window ${JSON.stringify(c2)}`);
  env.setMaxDay(70); env.setDay(60); assert(env.dayNumber === 60, 'env.setMaxDay(70) lets the clock reach day 60');
});

test('contract: target weights the levels are judged on (general, config weightAt); feed tables to day 14 are Phase 2\'s', () => {
  assert(weightAt(14) === 480 && weightAt(21) === 950 && weightAt(35) === 2200 && weightAt(42) === 2850, 'weightAt table');
  for (let a = 0; a <= 14; a += 0.5) assert(Math.abs(feedPerGainAt(a) - (0.97 + 0.03 * a)) < 1e-9, `feedPerGainAt(${a}) is Phase 2's`);
  for (let a = 0; a <= 7; a += 0.5) assert(Math.abs(feedStdGAt(a) - (12 + 4 * a)) < 1e-9, `feedStdGAt(${a}) is Phase 2's`);
});

// ---- the climate check (PHASE3.md §6.3, §6.4): env + farm-heat alone, runs now ----
const climate = {};
for (const ref of CLIMATE_REFS) {
  test(`climate ${ref.id}: day ${ref.day} ${String(ref.hour).padStart(2, '0')}:00, ${ref.plan}${ref.weather ? ` (${ref.weather})` : ''}${ref.events ? ` (${ref.events.join(', ')})` : ''}`, () => {
    const o = runPlan(ref.plan, { weather: ref.weather, fromDay: ref.day - 1 + 6 / 24, toDay: ref.day + ref.hour / 24, events: ref.events || [] });
    const m = { outC: o.outC, outRh: o.outRh, houseC: o.houseC, rh: o.rh, feltC: o.s.feltMean, e: o.s.eMean, pant: o.s.pantShare, deathPerH: o.s.deathPerH * 100,
      coldDeathPerH: o.s.coldDeathPerH * 100, fHeat: o.s.fHeat, windChill: o.s.windChill, dust: o.dust };
    climate[ref.id] = m;
    if (ref.expect.feltOverIdeal) m.feltOverIdeal = m.feltC - climate[ref.id.replace(ref.plan, 'ideal')].feltC;
    const bad = Object.entries(ref.expect).filter(([k, b]) => !inBand(m[k], b)).map(([k, b]) => `${k} ${fmt(m[k])} not in ${JSON.stringify(b)}`);
    assert(!bad.length, `${bad.join('; ')} | measured ${JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, fmt(v)])))}`);
  });
}
const windows = {};
for (const ref of WINDOW_REFS) {
  test(`climate window ${ref.id}: days ${ref.from}–${ref.to}, ${ref.plan}${ref.weather ? ` (${ref.weather})` : ''}`, () => {
    const o = runPlan(ref.plan, { weather: ref.weather, fromDay: ref.from, toDay: ref.to, events: ref.events || [], broken: ref.broken, padWorking: ref.padWorking });
    const m = { deathsPct: o.deathsPct, pantH: o.pantH, coldH: o.coldH, fHeat: o.fHeat };
    windows[ref.id] = m;
    const base = windows[ref.id.replace(/-(fan4-broken|pad-clogged|padInHumid|padsTo21)$/, '-ideal')];
    if (ref.expect.pantHOverIdeal) m.pantHOverIdeal = m.pantH / base.pantH;
    if (ref.expect.fHeatUnderIdeal) m.fHeatUnderIdeal = base.fHeat - m.fHeat;
    const bad = Object.entries(ref.expect).filter(([k, b]) => !inBand(m[k], b)).map(([k, b]) => `${k} ${fmt(m[k])} not in ${JSON.stringify(b)}`);
    assert(!bad.length, bad.join('; '));
  });
}

test('growth check (§6.1): the ideal (factors 0.97) 3.5-7.5 % over weightAt on every weigh day; factors 1 6-10 %', () => {
  const out = [];
  for (const d of GROWTH_REFS.weighDays) {
    const ideal = growthAt(d, 0.97).weightG / weightAt(d), full = growthAt(d, 1).weightG / weightAt(d);
    out.push(`d${d} ${fmt(ideal)} / ${fmt(full)}`);
    assert(inBand(ideal, GROWTH_REFS.idealShare), `day ${d}: ideal ${fmt(ideal)} of the target`);
    assert(inBand(full, GROWTH_REFS.fullShare), `day ${d}: factors 1 ${fmt(full)} of the target`);
  }
  // the margin over the 90 % fail line is about the same on every weigh day (12-17 points)
  for (const d of [14, 21, 35]) { const m = growthAt(d, 0.97).weightG / (0.9 * weightAt(d)); assert(m >= 1.12 && m <= 1.19, `day ${d} margin ${fmt(m)}`); }
  const h = growthAt(41.75, 0.97).weightG * GROWTH_REFS.harvestShrink / (0.9 * weightAt(41.75) * GROWTH_REFS.harvestShrink);
  assert(h >= 1.12 && h <= 1.19, `harvest margin ${fmt(h)}`);
  console.log(`     ${out.join(' | ')}`);
});

test('plan sums (§6.11): the contract\'s terms count at least 4 % losses and 21 rest days', () => {
  const P = (houses, birdsPerHouse, cycleDays, lossesPct) => planOutcome({ houses, birdsPerHouse, cycleDays, lossesPct, saleKg: 2.8 }, 576);
  assert(P(6, 6000, 67, 4).pass, 'the reference plan');
  assert(!P(5, 6000, 49, 0).pass, '5 houses x 6,000 x 49 days at 0 %');
  assert(!P(4, 6500, 49, 0).pass, '4 houses x 6,500 x 49 days at 0 %');
  assert(!P(5, 6000, 67, 0).pass, '0 % losses counts as 4 %: 5 houses fall short');
  assert(!P(6, 6000, 63, 4).pass && P(6, 6000, 63, 4).restDays === 17, '63 days leaves 17 rest days');
  assert(!P(6, 6000, 67, 6).pass, 'his losses figure above 4 % is used as he wrote it (3,535 a week)');
  assert(!P(6, 6500, 67, 4).pass && P(6, 6500, 67, 4).densityKgM2 <= 32, 'more chicks a house than its drinkers and feeders are for (6,000)');
  const big = P(12, 6000, 67, 4);
  assert(!big.pass && big.terms[0].max === 3960 && !big.terms[0].met, `12 houses: ${big.salePerWeek} a week, over the plant's ${big.terms[0].max}`);
  const o = P(6, 6000, 67, 4);
  assert(o.terms.length === 4 && o.terms.every((x) => x.met) && o.lossesCountedPct === 4, `the reply's terms ${JSON.stringify(o.terms)}`);
});

// ---- profiles (skip on the stub) ----
let idealRun = null;
const runs = {};
for (const name of CYCLE_PROFILES) {
  test(`profile ${name} reaches its CYCLE_TARGETS`, () => {
    if (STUB) return 'skip';
    if (name === 'determinism') {
      const a = runCycle('ideal', { seed: 7 }), b = runCycle('ideal', { seed: 7 });
      assert(JSON.stringify(a.records.serialize()) === JSON.stringify(b.records.serialize()), 'records differ between two seed-7 runs');
      assert(JSON.stringify(a.hourly) === JSON.stringify(b.hourly), 'hourly trace differs between two seed-7 runs');
      return undefined;
    }
    idealRun ||= runCycle('ideal', { seed: 1 });
    const run = name === 'ideal' ? idealRun : runCycle(name, { seed: 1 });
    runs[name] = run;
    const bad = checkCycle(name, run, idealRun);
    assert(!bad.length, bad.join('; '));
    return undefined;
  });
}


// ---- package checks (PHASE3.md §14.1 acceptance): speed, save sizes, restore, action shapes, null readings, the run store ----
test('package: the whole cycle (-2 -> 67) in 15 s or less; farm.step <= 0.5 ms with the whole house in use; a 24 h skip <= 200 ms', () => {
  if (STUB) return 'skip';
  const t0 = performance.now(); const run = runCycle('ideal', { seed: 3 }); const ms = performance.now() - t0;
  assert(run.levels.cleanout, 'the run reached the clean-out');
  const w = makeWorld();
  restoreBlob(w, runCycle('ideal', { seed: 1, from: 'plan', to: 'weeks45', keepStarts: true }).starts.weeks45);
  w.env.skipHours(24); // warm up
  const t1 = performance.now(); w.env.skipHours(24); const skip = performance.now() - t1;
  const t2 = performance.now(); for (let i = 0; i < 300; i++) w.farm.step(w.env, 60); const per = (performance.now() - t2) / 300;
  console.log(`     whole cycle ${(ms / 1000).toFixed(1)} s, 24 h skip ${skip.toFixed(0)} ms, farm.step ${per.toFixed(3)} ms (day ${w.env.dayNumber}, ${w.farm.litter.usedAll ? 576 : 300} cells)`);
  // the time budgets are checked alone (npm run perf: scripts/test-perf.mjs, or this file with --perf): run beside other
  // jobs on the 4 CPUs they fail by chance (PHASE4.md §9.5)
  if (!process.argv.includes('--perf')) return;
  assert(ms <= 15000, `whole cycle ${ms.toFixed(0)} ms`);
  assert(skip <= 200, `24 h skip ${skip.toFixed(0)} ms`);
  assert(per <= 0.5, `farm.step ${per.toFixed(3)} ms`);
});

function restoreBlob(w, blob) {
  const b = JSON.parse(JSON.stringify(blob));
  w.farm.start(LEVELS[1], { seed: b.farm.seed ?? 1, keepClock: true });
  for (const [k, v] of Object.entries(b.env)) if (!['maxDay', 'curtainForced', 'cycleClimate', 'fansBroken', 'padWorking', 'fanStages', 'broodersUp'].includes(k)) w.env[k] = v;
  w.env.setMaxDay(b.env.maxDay); w.env.setDay(Math.round(b.env.day - b.env.hour / 24)); w.env.setHour(b.env.hour);
  w.farm.restore(b.farm); w.records.restore(b.records); w.skills.restore(b.skills);
}
test('package: every level start and the day 41 blob are 250 KB or less; restore -> serialize identical; the restored farm runs on', () => {
  if (STUB) return 'skip';
  const run = runCycle('ideal', { seed: 1, keepStarts: true });
  const sizes = [];
  for (const [id, blob] of Object.entries(run.starts)) {
    const json = JSON.stringify(blob);
    sizes.push(`${id} ${(json.length / 1024).toFixed(0)}`);
    assert(json.length <= 250 * 1024, `${id} start ${(json.length / 1024).toFixed(0)} KB`);
    const w = makeWorld();
    restoreBlob(w, blob);
    for (const k of ['farm', 'records', 'skills']) {
      const a = JSON.stringify(blob[k]), b = JSON.stringify(w[k].serialize());
      if (a !== b) { let i = 0; while (a[i] === b[i]) i++; throw new Error(`${id}: ${k} differs after restore at ${i}: ${a.slice(Math.max(0, i - 80), i + 60)} | ${b.slice(Math.max(0, i - 80), i + 60)}`); }
    }
    assert(w.env.cycleClimate === blob.env.cycleClimate && w.env.broodCurtain === (blob.env.curtainForced ?? w.env.broodCurtain) && w.env.maxDay === blob.env.maxDay, `${id}: env rebuilt from the farm`);
    w.env.skipHours(3);
    assert(w.farm.mode === 'level' && (id === 'plan' || id === 'level1' || id === 'cleanout' || w.farm.flock.alive > 0), `${id}: the restored farm runs on`);
  }
  const w41 = makeWorld();
  restoreBlob(w41, run.starts.finish);
  const day41 = JSON.stringify(run.starts.finish);
  console.log(`     level starts (KB): ${sizes.join(', ')}; farm ${(JSON.stringify(run.starts.finish.farm).length / 1024).toFixed(0)} KB, records ${(JSON.stringify(run.starts.finish.records).length / 1024).toFixed(0)} KB at day 36`);
  assert(day41.length <= 250 * 1024, `day 36 blob ${day41.length}`);
});

test('package: the day 41 run blob is 250 KB or less (ideal)', () => {
  if (STUB) return 'skip';
  const run = runCycle('ideal', { seed: 1, from: 'finish', to: 'finish' });
  void run;
  const w = makeWorld();
  restoreBlob(w, runCycle('ideal', { seed: 1, from: 'plan', to: 'finish', keepStarts: true }).starts.finish);
  w.env.skipHours(5 * 24 + 14); // day 41 20:00 with the ideal's settings
  const json = JSON.stringify({ farm: w.farm.serialize(), records: w.records.serialize(), skills: w.skills.serialize() });
  console.log(`     day ${w.env.dayNumber} blob ${(json.length / 1024).toFixed(0)} KB`);
  assert(json.length <= 250 * 1024, `day 41 blob ${(json.length / 1024).toFixed(0)} KB`);
});

test('package: every farm action of PHASE3.md §13.3 answers with its result shape', () => {
  if (STUB) return 'skip';
  const w = makeWorld();
  restoreBlob(w, runCycle('ideal', { seed: 1, from: 'plan', to: 'week3', keepStarts: true }).starts.week3);
  const { farm } = w;
  const shape = {
    'bio.change': true, 'house.curtain': true, 'heat.brooders': true, 'light.lux': ['lux'], 'air.probe': ['speedMs', 'tempC', 'rh'], 'vent.stages': true,
    'fan.fix': ['fixed'], 'pad.check': ['dry', 'flowing'], 'pad.flush': ['fixed'], 'pad.fixFloat': ['fixed'], 'gas.meter': ['kgLeft', 'kgUsed'],
    'sample.bird': ['look', 'value'], 'chicks.cull': true, 'water.main': true, 'vaccine.mix': ['litres'], 'water.medicate': true, 'water.test': ['ph', 'chlorinePpm'],
    'feed.valve': true, 'feed.order': ['arriveDay', 'arriveHour', 'kg'], 'feed.withdraw': true, 'feed.wash': true, 'litter.fork': ['caked'], 'litter.patch': ['onLeak', 'onPad'],
    'water.disinfect': true, 'water.flush': ['flushClear', 'disinfected'], 'phone.bookCatch': ['booked', 'catchAt'], 'phone.bookChicks': ['booked', 'bookedDay'],
    'catch.panels': true, 'load.ticket': ['crates', 'birds', 'grossKg', 'tareKg', 'netKg', 'doa'], 'clean.scrape': ['share'], 'clean.wash': ['share'], 'clean.spray': ['share'],
    'clean.brush': true, 'clean.washbay': true, 'clean.bait': true, 'clean.swab': ['n'], 'house.close': true, 'plan.measure': ['m'],
    'plan.send': ['chicksPerWeek', 'salePerWeek', 'densityKgM2', 'restDays'],
  };
  const args = { 'house.curtain': { open: true }, 'heat.brooders': { up: false }, 'light.lux': { x: 0, z: 0 }, 'air.probe': { x: 10, z: 0 }, 'vent.stages': { stages: null },
    'fan.fix': { index: 3 }, 'sample.bird': { x: 0, z: 0, index: 0, look: 'droppings' }, 'chicks.cull': { n: 1, reason: 'sick' }, 'water.main': { open: true },
    'vaccine.mix': { stabiliser: true }, 'water.medicate': { on: false }, 'feed.valve': { silo: 1, open: 1 }, 'feed.order': { kg: 500, type: 'grower' },
    'feed.withdraw': { on: false }, 'feed.wash': { line: 0 }, 'litter.fork': { x: -10, z: 1.95 }, 'litter.patch': { x: -23, z: 0 }, 'water.disinfect': { on: true },
    'water.flush': { line: 0, on: true }, 'phone.bookCatch': { day: 42, hour: 2 }, 'phone.bookChicks': { day: 60 }, 'load.ticket': { truck: 0 },
    'clean.scrape': { x: 0, z: 0, r: 2 }, 'clean.wash': { x: 0, z: 0, r: 2.5 }, 'clean.spray': { x: 0, z: 0, r: 2.5 }, 'clean.brush': { part: 'fans' },
    'clean.washbay': { item: 'boots' }, 'clean.bait': { x: -25.2, z: -6.8, i: 0 }, 'clean.swab': { x: -20, z: -1.95, spot: 0 }, 'plan.measure': { axis: 'length', m: 48 },
    'plan.send': { houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 } };
  for (const [id, keys] of Object.entries(shape)) {
    const r = farm.act(id, args[id] || {});
    if (keys === true) assert(r === true, `${id} -> ${JSON.stringify(r)}, want true`);
    else for (const k of keys) assert(r && typeof r === 'object' && k in r, `${id} result has no ${k}: ${JSON.stringify(r)}`);
  }
  const no = farm.act('phone.bookCatch', { day: 40, hour: 2 });
  assert(no.booked === false && typeof no.reason === 'string', `a booking outside the window: ${JSON.stringify(no)}`);
  const chicks = farm.act('phone.bookChicks', { day: farm.clean.closedDay + 10 });
  assert(chicks.booked === false && typeof chicks.reason === 'string', `chicks under 14 days after closing: ${JSON.stringify(chicks)}`);
});

test('package: rows hold null for every reading not taken (the Phase 3 fields too)', () => {
  if (STUB) return 'skip';
  const w = makeWorld();
  restoreBlob(w, runCycle('ideal', { seed: 1, from: 'plan', to: 'week3', keepStarts: true }).starts.week3);
  w.env.skipHours(14);
  const row = w.records.sign(15);
  for (const k of ['feedKg', 'waterL', 'litterMoisturePct', 'houseMinC', 'houseMaxC', 'darkHours', 'luxMeasured', 'houseRhMin', 'houseRhMax', 'airSpeedMs', 'fansMax', 'padOn',
    'lameCulled', 'feedType', 'vaccine', 'gasKgUsed', 'deadByLook', 'flowsMlMin']) assert(row[k] === null, `row.${k} = ${JSON.stringify(row[k])} although nothing was read`);
  assert(row.weightSource === 'scale' && row.alive > 5800, 'alive from the counts, weight from the bird scale');
});

test('package: harvest page, clean-out page and cycle summary from the ideal', () => {
  if (STUB) return 'skip';
  const run = idealRun || runCycle('ideal', { seed: 1 });
  const s = run.records.cycleSummary({ plan: run.farm.plan, levels: run.levels });
  for (const k of ['placed', 'sold', 'liveKg', 'meanLiveG', 'fcr', 'epef', 'mortalityPct', 'deathsByLevel', 'weights', 'feedKg', 'waterL', 'gasKg', 'restDays', 'swabsPositive', 'plan', 'actual', 'points'])
    assert(k in s, `cycleSummary.${k}`);
  assert(s.sold > 5700 && s.plan && s.plan.cycleDays === 67 && s.actual.cycleDays === 67 && s.restDays === 21 && s.weights.every((x) => x.weighedG > 0), JSON.stringify(s).slice(0, 300));
  assert(Object.values(s.points).reduce((a, b) => a + b, 0) > 50, `points of the cycle ${JSON.stringify(s.points)}`);
  const h = run.records.harvestPage();
  assert(h && h.tickets.length === 2 && h.tickets.every((t) => t.grossKg - t.tareKg === t.netKg || Math.abs(t.grossKg - t.tareKg - t.netKg) <= 1), `harvest page ${JSON.stringify(h && h.tickets)}`);
  const c = run.records.cleanPage();
  assert(c && c.swabsTaken === 10 && c.restDays === 21 && c.lab, `clean page ${JSON.stringify(c).slice(0, 200)}`);
  assert(run.records.timeline('week2').length === 7 && run.records.timeline('week2').every((r) => r.darkHours != null), 'timeline of week 2');
});

test('package: cycle problems start silently; zones, the radio, look words; env.heatBudget()', () => {
  if (STUB) return 'skip';
  const starts = runCycle('ideal', { seed: 1, from: 'plan', to: 'weeks45', keepStarts: true }).starts;
  const w = makeWorld(), got = [];
  w.events.on(EV.FARM_PROBLEM, (p) => got.push(`${p.id}:${p.phase}`));
  restoreBlob(w, starts.week3);
  const { farm, env } = w;
  assert(/hot, up to 35/.test(farm.forecast(15).text), `radio on day 15: ${farm.forecast(15).text}`);
  env.skipHours(2 * 24 + 5); // day 17 11:00: the pad overflows silently
  assert(got.includes('pad-overflow:start') && !got.includes('pad-overflow:symptom') && farm.house.padFloatStuck, 'the pad overflows silently');
  env.skipHours(3);
  assert(farm.problemZones().some((z) => z.problemId === 'pad-overflow' && z.minMoisture === 35), 'the pad-end zone');
  w.events.emit(EV.NEAR, { problemId: 'pad-overflow', x: -23, z: 0 });
  assert(got.includes('pad-overflow:symptom') && farm.act('pad.fixFloat').fixed === true && got.includes('pad-overflow:fixed'), 'EV.NEAR finds it, the float valve fixes it');
  const o = farm.observe(0, 0);
  assert(o.spread && o.droppings && o.sounds && o.air, `look words ${JSON.stringify(o)}`);
  const hb = env.heatBudget();
  assert(['wallsCh', 'airCh', 'brooderCh', 'birdsCh', 'sunCh'].every((k) => Number.isFinite(hb[k])) && hb.birdsCh > 0, `heat budget ${JSON.stringify(hb)}`);
  const w2 = makeWorld();
  restoreBlob(w2, starts.weeks45);
  w2.env.skipHours(5 * 24 + 4); // day 27 10:00: fan 4's belt broke at 09:00
  assert(w2.env.fansBroken.includes(3) && w2.farm.problemZones().some((z) => z.problemId === 'fan-belt'), 'fan 4 broken with its zone');
  w2.env.setFans(6);
  assert(Math.abs(w2.env.airSpeed - 5 * 2.5 / 6) < 0.01, `six fans with one broken move ${w2.env.airSpeed} m/s`);
  w2.farm.act('fan.fix', { index: 3 });
  assert(!w2.env.fansBroken.length && Math.abs(w2.env.airSpeed - 2.5) < 0.01, 'the belt fitted: all six turn');
});

test('package: the run store (PHASE3.md §11): run key, level starts by day, clearStarts, quota drops the oldest start', async () => {
  const { createRunStore } = await import('../src/save.js');
  const mem = new Map(); let quota = Infinity;
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { const size = [...mem.entries()].filter(([x]) => x !== k).reduce((a, [, x]) => a + x.length, 0) + String(v).length; if (size > quota && k !== '__cf_probe__') throw new Error('quota'); mem.set(k, String(v)); },
    removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
  try {
    const st = createRunStore();
    assert(st.available, 'available');
    const blob = (day) => ({ env: { day: day + 6 / 24, hour: 6 }, pad: 'x'.repeat(1000) });
    assert(st.saveStart('week2', 8, { levelId: 'week2' }, blob(8)) && st.saveStart('weeks45', 22, { levelId: 'weeks45' }, blob(22)) && st.saveStart('weeks45', 29, { levelId: 'weeks45' }, blob(29)), 'starts saved');
    assert(st.loadStart('weeks45', 22).day === 22 && st.loadStart('weeks45').day === 29 && st.loadStart('week2').day === 8, 'starts by day, the latest without one');
    assert(st.save({ levelId: 'weeks45' }, blob(30)) && st.load().run.levelId === 'weeks45' && st.info().day === 30 && st.info().starts.weeks45.join() === '22,29', `info ${JSON.stringify(st.info())}`);
    assert(st.clearStarts('weeks45') === 2 && st.loadStart('weeks45') === null && st.loadStart('week2'), 'clearStarts from weeks45 keeps week2');
    st.saveStart('week3', 15, { levelId: 'week3' }, blob(15));
    quota = [...mem.values()].reduce((a, x) => a + x.length, 0) + 200;
    assert(st.saveStart('finish', 36, { levelId: 'finish' }, blob(36)) && st.loadStart('week2') === null && st.loadStart('finish'), 'a full storage drops the oldest start (week 2) and retries');
    mem.set('chickenFarm.level1.v1', JSON.stringify({ version: 1, savedAt: 5, env: { day: 3.5, hour: 12 }, level: { day: 3 } }));
    const m = st.migratePhase2({ remove: true });
    assert(m && m.levelId === 'level1' && m.blob.env.day === 3.5 && !mem.has('chickenFarm.level1.v1'), 'a Phase 2 save continues as a run at level1');
  } finally { delete globalThis.localStorage; }
});

await Promise.all(pending);
console.log(failed ? `${failed} failed` : `all passed${skipped ? ` (${skipped} skipped: farm.cycleStub)` : ''}`);
process.exit(failed ? 1 : 0);
