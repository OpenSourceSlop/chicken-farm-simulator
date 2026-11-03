// The farm model for the whole cycle in node (PHASE3.md §6.14). Owner: package "sim". CYCLE_TARGETS, SNAPS
// and checkCycle below are contract data and code committed by the integrator: the sim package's
// runCycle returns a trace (hourly rows, level results, level-end snapshots) and checkCycle measures every
// snap from that trace itself, so the model never grades itself. The climate and growth checks
// (scripts/cycle-refs.mjs, env alone) run now; the profile tests skip while farm.cycleStub is true.
//   node scripts/test-cycle.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { CYCLE_PROFILES, runCycle } from '../src/farm-profiles-cycle.js';
import { planSums, planOutcome } from '../src/farm-plan.js';
import { LEVELS, SKILL_BRANCHES, weightAt, feedStdGAt, feedPerGainAt } from '../src/config.js';
import { CLIMATE_REFS, WINDOW_REFS, GROWTH_REFS, runPlan, growthAt } from './cycle-refs.mjs';

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
    finish: { pass: true, liveG: [2820, 3020], fcr: [1.55, 1.72], mortalityPct: [1.4, 3.2], uniformityPct: [62, 80], epef: [360, 440], doaPct: [0.1, 0.25], withdrawalH: [8, 12] },
    cleanout: { pass: true, positive: [0, 1], restDays: [21, 21] },
    snaps: { vaccineCoverage: [0.92, 0.98], vaccineHours: [1.5, 2.2], houseWave31At15: [28.8, 31.5], pantWave31At15: [0, 0.3],
      heatwaveHeatDeathsPct: [0, 0.05], heatwavePantHours: [1, 12], heatDeathsW45Pct: [0, 0.05], nh3NightMaxW46: [0, 25],
      pantShareW3At15: [0, 0.35], dustMaxDay23: [0, 1.9], minBranchPoints: [9, Infinity] },
  },
  noDark: { snaps: { sdsVsIdeal: [3, Infinity], lameVsIdeal: [2, Infinity] } },
  lateLift: { snaps: { day14WeightUnderIdealPct: [3, Infinity], day14UniformityUnderIdeal: [3, Infinity], broodLitterDay14: [32, Infinity] } },
  noStep: { snaps: { nightsRh85Week2: [3, 7], litterDay14: [33, Infinity], nh3Night14: [25, Infinity], day21WeightUnderIdealPct: [3, Infinity] } },
  poorVaccine: { week3: { pass: true, deathsPct: [0.5, 0.95] },
    snaps: { vaccineCoverage: [0.35, 0.7], vaccineHours: [3.5, 5], gumboroStarted: true, week3DiseaseDeathsPct: [0.3, 0.6], day21WeightUnderIdealPct: [4, 8] } },
  poorVaccineCocci: { week3: { pass: false }, snaps: { gumboroStarted: true, week3DiseaseDeathsPct: [0.9, 2.5] } },
  cocciUntreated: { week3: { pass: false }, snaps: { week3DiseaseDeathsPct: [0.5, 1.5], day21WeightUnderIdealPct: [2, Infinity] } },
  minVentW3: { week3: { pass: true }, snaps: { pantShareW3At15: [0.8, 1], heatDeathsW3Pct: [0, 0.05], day21WeightUnderIdealPct: [1, 4] } },
  crumbleOn: { snaps: { day28WeightUnderIdealPct: [3, 8] } },
  abruptChange: { snaps: { undigestedHours: [12, 30], intakeDipPct: [2, 4] } },
  overfullSilo: { snaps: { finisherPansDay: [31, 40], day35WeightUnderIdealPct: [0, 3] } },
  dustOn: { snaps: { dustMaxDay23: [1.5, 2], dustyHoursDay23: [3, Infinity] } },
  noTunnel: { weeks45: { pass: false, endDay: [23, 27] }, snaps: { heatDeathsW45Pct: [2, Infinity] } },
  fansNoPad: { weeks45: { pass: false, endDay: [30, 31] }, snaps: { houseWave30At15: [38, 40.5], heatwaveHeatDeathsPct: [2, Infinity] } },
  padInHumid: { snaps: { felt33At15OverIdeal: [1.5, 3.5], heatDeaths33Pct: [0.15, 1] } },
  fanUnfixed: { snaps: { airSpeed6Fans: [2.0, 2.2], heatwavePantHoursVsIdeal: [2, Infinity] } },
  noWithdrawal: { snaps: { gutFull: true, liveOverIdealPct: [1, Infinity] } },
  longWithdrawal: { snaps: { liveUnderIdealPct: [3.5, 6], doaVsIdeal: [2, Infinity] } },
  brightCatch: { snaps: { doaVsIdeal: [1.4, Infinity] } },
  wetDisinfect: { cleanout: { pass: false, positive: [3, 7] } },
  litterLeft: { cleanout: { positive: [3, 10] } },
  shortRest: { cleanout: { pass: false, restDays: [14, 14] } },
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
  liveOverIdealPct: (r, i) => -under(r.levels.finish?.liveG, i.levels.finish?.liveG),
  liveUnderIdealPct: (r, i) => under(r.levels.finish?.liveG, i.levels.finish?.liveG),
  doaVsIdeal: (r, i) => ratio(r.levels.finish?.doaPct, i.levels.finish?.doaPct),
  minBranchPoints: (r) => Math.min(...SKILL_BRANCHES.map((b) => r.points?.[b.id] ?? 0)),           // the ideal from the plan level: level 2 everywhere
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
function test(name, fn) {
  try { const r = fn(); if (r === 'skip') { skipped++; console.log(`skip ${name}`); } else console.log(`ok   ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
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
  test(`climate ${ref.id}: day ${ref.day} ${String(ref.hour).padStart(2, '0')}:00, ${ref.plan}${ref.events ? ` (${ref.events.join(', ')})` : ''}`, () => {
    const o = runPlan(ref.plan, { fromDay: ref.day - 1 + 6 / 24, toDay: ref.day + ref.hour / 24, events: ref.events || [] });
    const m = { outRh: o.outRh, houseC: o.houseC, rh: o.rh, feltC: o.s.feltMean, pant: o.s.pantShare, deathPerH: o.s.deathPerH * 100, fHeat: o.s.fHeat, dust: o.dust };
    climate[ref.id] = m;
    if (ref.expect.feltOverIdeal) m.feltOverIdeal = m.feltC - climate[ref.id.replace(ref.plan, 'ideal')].feltC;
    const bad = Object.entries(ref.expect).filter(([k, b]) => !inBand(m[k], b)).map(([k, b]) => `${k} ${fmt(m[k])} not in ${JSON.stringify(b)}`);
    assert(!bad.length, `${bad.join('; ')} | measured ${JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, fmt(v)])))}`);
  });
}
const windows = {};
for (const ref of WINDOW_REFS) {
  test(`climate window ${ref.id}: days ${ref.from}–${ref.to}, ${ref.plan}`, () => {
    const o = runPlan(ref.plan, { fromDay: ref.from, toDay: ref.to, events: ref.events || [], broken: ref.broken, padWorking: ref.padWorking });
    const m = { deathsPct: o.deathsPct, pantH: o.pantH, fHeat: o.fHeat };
    windows[ref.id] = m;
    const base = windows[ref.id.replace(/-(fan4-broken|pad-clogged|padInHumid)$/, '-ideal')];
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

console.log(failed ? `${failed} failed` : `all passed${skipped ? ` (${skipped} skipped: farm.cycleStub)` : ''}`);
process.exit(failed ? 1 : 0);
