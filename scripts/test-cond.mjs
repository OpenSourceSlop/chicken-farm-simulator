// The Phase 4 conditions in the farm model (PHASE4.md §4, §12.1). Owner: package "sim". For each condition its ideal
// passes every level and reaches level 2 in every branch (needsProblem applied), each named mistake of §4 fails its
// level with its margin or passes with its band, the farm's numbers at the reference hours land in the bands of
// scripts/tuning-refs-cond.mjs, and the conditions' actions, power, generator, storms, pump and claim behave as §10 says.
//   node scripts/test-cond.mjs            everything (the sim package's acceptance, the integrator's merge run)
//   node scripts/test-cond.mjs --quick    each ideal and one failing mistake per condition, the package checks (npm test)
import { runCycle, cycleProfileOf } from '../src/farm-profiles-cycle.js';
import { COND_PROFILES, COND_RANGE } from '../src/farm-profiles-cond.js';
import { makeWorld } from '../src/farm-profiles-run.js';
import { SKILL_BRANCHES, SKILL_LEVEL_POINTS, LEVELS } from '../src/config.js';
import { BROOD_REFS_P4, COND_CLIMATE_P4, CUT_REFS_P4, TANK_REFS_P4 } from './tuning-refs-cond.mjs';
import { heatHandled } from '../src/farm-cycle-problems.js';
import { EV } from '../src/events.js';

const QUICK = process.argv.includes('--quick');
const QUICK_RUNS = new Set(['hot:ideal', 'hotNoBroodAir', 'rainy:ideal', 'rainyNoGenerator', 'bad:ideal', 'badNoGrade', 'water:ideal', 'waterPumpUnfixed']);
const band = (name) => [...BROOD_REFS_P4, ...COND_CLIMATE_P4, ...CUT_REFS_P4, ...TANK_REFS_P4].find((r) => r.id === name);

/**
 * Bands per profile (PHASE4.md §4's tables; the env-only references of tuning-refs-cond.mjs where they apply). Level
 * keys → runCycle's levels[id] fields; `snaps` → SNAPS below. A band marked "sim" was moved by the sim package against
 * §4's figure (PHASE4.md §2.7, for the integrator to agree).
 */
export const COND_TARGETS = {
  'hot:ideal': {
    plan: { pass: true }, level1: { pass: true, ratio: [4.5, 4.95], deathsPct: [0, 1.0] }, week2: { pass: true, weightG: [480, Infinity] }, week3: { pass: true },
    weeks45: { pass: true, weightG: [2100, 2350] }, finish: { pass: true, liveG: [2650, 2950], fcr: [1.55, 1.8] /* sim: 1.6 -> 1.55 */, epef: [330, 440] /* sim: 420 -> 440 */ }, cleanout: { pass: true },
    snaps: { heatL1Pct: [0, 0.05], gasL1VsNormal: [0, 0.6], heatW2Pct: [0, 0.05], heatW3Pct: [0, 0.1], heatW45Pct: [0, 0.1], minBranchPoints: [SKILL_LEVEL_POINTS[1], Infinity],
      earned: ['hot-brood-air'], eBrood15: band('hot-brood-pad1').at, eYoung: ['hot-d12-15-young', 'hot-d14-15-young', 'hot-d18-15-young'] },
  },
  hotNoBroodAir: { level1: { pass: false }, snaps: { deathsL1: [2.0, Infinity], ratioUnderIdeal: [0.2, 0.5], notEarned: ['hot-brood-air'], eBrood15: band('hot-brood-sign').at } },
  hotYoungAsNormal: { week2: { pass: false }, snaps: { heatW2Pct: [1, Infinity] } },   // integrator: the level ends on its deaths (1 %) the day they pass it; the dropped rainy spell no longer adds its 92 % air
  hotNoPad: { weeks45: { pass: false, endDay: [22, 25] }, snaps: { heatW45Pct: [2, Infinity] } },
  hotNight3: { weeks45: { pass: false, endDay: [28, 31] }, snaps: { heatW45Pct: [2, Infinity] } },
  hotPadsTo21: { weeks45: { pass: true }, snaps: { pantW45VsIdeal: [1.5, 4], heatW45Pct: [0, 0.1], pointsOf: { 'hot-nights': [0, 2] } } },
  hotNoFlush: { weeks45: { pass: true }, finish: { pass: true }, snaps: { day35UnderIdealPct: [0, 2], notEarned: ['cool-water'] } },

  'rainy:ideal': {
    plan: { pass: true }, level1: { pass: true }, week2: { pass: true }, week3: { pass: true, weightG: [950, Infinity] }, weeks45: { pass: true, deathsPct: [0.5, 1.3] },
    finish: { pass: true, liveG: [2750, 3000], epef: [370, 440] }, cleanout: { pass: true },
    snaps: { litter21At15: [0, 33.5], nh3NightsW3: [0, 18], nh3NightsW46: [0, 20], cutDeathsPct: band('cut10').expect.deathsPct, minBranchPoints: [SKILL_LEVEL_POINTS[1], Infinity], earned: ['gen-tested', 'gen-fast', 'storm-flaps'],
      rainOnStorms: true },
  },
  rainyNoGenerator: { weeks45: { pass: false, endDay: [33, 33] }, snaps: { cutDeathsPct: [2.3, Infinity], note33: 'Power cut 15:10–18:10, no generator' } },
  rainyGenLate: { weeks45: { pass: true }, snaps: { cutDeathsPct: [0.5, 1.0], notEarned: ['gen-fast'] } },
  rainyGenLeftOn: { weeks45: { pass: true }, snaps: { nightCutDeathsPct: [0, 0.05], genDryFound: true } },
  rainyNoStep: { week3: { pass: true }, snaps: { litter21At15: [34, Infinity], nh3NightsW3: [25, Infinity], day21UnderIdealPct: [3, 9] /* sim: 6 -> 9 */, notEarned: ['minvent-w2', 'minvent-w3', 'litter-w3'] } },
  rainyNoFlaps: { weeks45: { pass: true }, finish: { pass: true }, snaps: { stripAfterStorms: [40, Infinity], notEarned: ['storm-flaps', 'rain-litter'] } },

  'bad:ideal': {
    plan: { pass: true }, level1: { pass: true, deathsPct: [0.4, 1.4], ratio: [4.6, 5.4], uniformityPct: [42, 54] }, week2: { pass: true, weightG: [456, Infinity] }, week3: { pass: true },
    weeks45: { pass: true }, finish: { pass: true, liveG: [2750, 2950], mortalityPct: [2.0, 3.5] /* sim: 2.3 -> 2.0 */, epef: [350, 440] /* sim: 420 -> 440 */ }, cleanout: { pass: true },
    snaps: { claimedPct: [3.5, 4.5], minBranchPoints: [SKILL_LEVEL_POINTS[1], Infinity], earned: ['weak-graded', 'hatchery-told', 'bad-ratio'] },
  },
  badNoGrade: { level1: { pass: false }, snaps: { deathsL1: [3.0, Infinity] } },
  badNoCall: { level1: { pass: false }, snaps: { deathsL1: [4, 5.5], noteDay0: 'not claimed: the hatchery was not told on day 0' } },
  badNoTrays: { level1: { pass: true }, snaps: { starveOverIdealPts: [0.15, 0.4], ratioNearIdeal: [0, 0.1] } },

  'water:ideal': {
    plan: { pass: true }, level1: { pass: true }, week2: { pass: true }, week3: { pass: true }, weeks45: { pass: true, deathsPct: [0, 0.9] }, finish: { pass: true }, cleanout: { pass: true },
    snaps: { tankLowW45: band('tank-ideal').expect.lowPct, heatW45Pct: [0, 0.05], day35VsNormalPct: [-2, 2], bar26: band('tank-ideal').expect.bar26, bar27: band('tank-ideal').expect.bar27,
      minBranchPoints: [SKILL_LEVEL_POINTS[1], Infinity], earned: ['iron-found', 'pump-found', 'tank-read'] },
  },
  // sim (§2.7): the farm's birds drink less once the lines lose pressure, so the pads keep a little more water than the env
  // reference's: heat deaths 1.7 % by day 32 (env 3.4 % over the level), the level failed on its deaths (2.2 % by day 32)
  waterPumpUnfixed: { weeks45: { pass: false, endDay: [30, 33], deathsPct: [2.0, Infinity] }, snaps: { heatW45Pct: [1.5, Infinity] /* sim: 2 -> 1.5 */, tankLow30to32: band('tank-unfixed').expect.lowW } },
  waterPumpLate: { weeks45: { pass: true }, snaps: { tankLow30: band('tank-late').expect.low30, tankLow32: band('tank-late').expect.low32, heatW45Pct: [0, 0.3], day35UnderIdealPct: [0.2, 4] /* sim: 0.5 -> 0.2 */, notEarned: ['pump-found'] } },
  waterFilterLate: { weeks45: { pass: true }, snaps: { day14UnderIdealPct: [0.5, 3], notEarned: ['iron-found'] } },
};
const IDEAL_OF = { hot: 'hot:ideal', rainy: 'rainy:ideal', badChicks: 'bad:ideal', water: 'water:ideal' };

// ---- what the snaps measure (from the trace: hourly rows, level results, the farm and the records) ----
const Hr = (r, d, h) => r.hourly.find((x) => x.day === d && Math.abs(x.hour - h) < 1e-6) || null;
const between = (r, a, b) => r.hourly.filter((x) => x.t >= a - 1e-9 && x.t < b - 1e-9);
const deadPct = (r, cause, a, b) => { const x = between(r, a, Math.min(b, r.hourly[r.hourly.length - 1].t + 1e-6)); return x.length ? (100 * ((x[x.length - 1].dead[cause] || 0) - (x[0].dead[cause] || 0))) / Math.max(1, x[0].alive) : null; };
const under = (v, i) => (v != null && i ? (100 * (i - v)) / i : null);
const nightsMaxNh3 = (r, d0, d1) => Math.max(...between(r, d0, d1 + 1).filter((x) => x.hour >= 22 || x.hour <= 5).map((x) => x.nh3));
const milestone = (r, id) => SKILL_BRANCHES.map((b) => r.skills.milestones(b.id).find((m) => m.id === id)).find(Boolean);
export const SNAPS = {
  heatL1Pct: (r) => deadPct(r, 'heat', 0, 7.9),
  heatW2Pct: (r) => deadPct(r, 'heat', 8.25, 15.25), heatW3Pct: (r) => deadPct(r, 'heat', 15.25, 22.25), heatW45Pct: (r) => deadPct(r, 'heat', 22.25, 36.25),
  gasL1VsNormal: (r, i, n) => (n ? (r.farm.stats.daily?.[7]?.gasAtSign ?? null) / Math.max(1, n.farm.stats.daily?.[7]?.gasAtSign ?? 1) : null),
  deathsL1: (r) => r.levels.level1?.deathsPct ?? null,
  ratioUnderIdeal: (r, i) => (i.levels.level1 && r.levels.level1 ? i.levels.level1.ratio - r.levels.level1.ratio : null),
  ratioNearIdeal: (r, i) => (i.levels.level1 && r.levels.level1 ? Math.abs(i.levels.level1.ratio - r.levels.level1.ratio) : null),
  pantW45VsIdeal: (r, i) => { const f = (x) => between(x, 22.25, 36.25).reduce((s, h) => s + h.pantShare, 0); return f(r) / Math.max(1e-9, f(i)); },
  day35UnderIdealPct: (r, i) => under(r.levels.weeks45?.weightG, i.levels.weeks45?.weightG),
  day21UnderIdealPct: (r, i) => under(r.levels.week3?.weightG, i.levels.week3?.weightG),
  day14UnderIdealPct: (r, i) => under(r.levels.week2?.weightG, i.levels.week2?.weightG),
  day35VsNormalPct: (r, i, n) => (n ? (100 * (r.levels.weeks45.weightG - n.levels.weeks45.weightG)) / n.levels.weeks45.weightG : null),
  litter21At15: (r) => Hr(r, 21, 15)?.litterMean ?? null,
  nh3NightsW3: (r) => nightsMaxNh3(r, 15, 21), nh3NightsW46: (r) => nightsMaxNh3(r, 22, 41),
  cutDeathsPct: (r) => deadPct(r, 'heat', 33.25, 34.25),
  nightCutDeathsPct: (r) => deadPct(r, 'heat', 33 + 19 / 24, 34.25),
  genDryFound: (r) => (r.levelEnds.weeks45?.problems || []).some((p) => p.id === 'gen-dry' && p.foundAt != null),
  rainOnStorms: (r) => [5, 12, 19, 26, 33, 39].every((d) => Hr(r, d, 15)?.rain === 1) && Hr(r, 33, 20)?.rain === 0,
  stripAfterStorms: (r) => Math.min(...[19, 26, 33, 39].map((d) => Hr(r, d, 18)?.strip).filter((v) => v != null)),
  claimedPct: (r) => (100 * (r.levels.level1?.claimed ?? 0)) / Math.max(1, r.farm.flock.delivered),
  starveOverIdealPts: (r, i) => (100 * ((r.farm.flock.deadByCause.starveout || 0) - (i.farm.flock.deadByCause.starveout || 0))) / Math.max(1, r.farm.flock.delivered),
  tankLowW45: (r) => Math.min(...between(r, 22, 36).map((x) => x.tankPct)),
  tankLow30to32: (r) => Math.min(...between(r, 30, 33).map((x) => x.tankPct)),
  tankLow30: (r) => Math.min(...between(r, 30, 31).map((x) => x.tankPct)), tankLow32: (r) => Math.min(...between(r, 32, 33).map((x) => x.tankPct)),
  bar26: (r) => (r.farm.condX.gauges.find((g) => g[0] === 26) || [])[2] ?? null, bar27: (r) => (r.farm.condX.gauges.find((g) => g[0] === 27) || [])[2] ?? null,
  minBranchPoints: (r) => Math.min(...SKILL_BRANCHES.map((b) => r.points[b.id] ?? 0)),
};
const inBand = (v, b) => v != null && Number.isFinite(v) && v >= b[0] - 1e-9 && v <= b[1] + 1e-9;

let failed = 0, skipped = 0;
function test(name, fn) {
  try { const r = fn(); if (r === 'skip') { skipped++; console.log(`skip ${name}`); } else console.log(`ok   ${name}${r ? `\n     ${r}` : ''}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const fmt = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);

// ---- the profiles ----
const runs = {};
const runOf = (name) => runs[name] || (runs[name] = runCycle(name, { seed: 1 }));
let normal = null;
const normalRun = () => normal || (normal = runCycle('ideal', { seed: 1, to: 'weeks45' }));
/** Compare one profile run with its COND_TARGETS (its condition's ideal and the normal ideal for the comparisons). */
export function checkCond(name, r, ideal, norm) {
  const t = COND_TARGETS[name], bad = [], got = {};
  for (const [lv, want] of Object.entries(t)) {
    if (lv === 'snaps') continue;
    const L = r.levels[lv];
    if (!L) { bad.push(`${lv}: no result`); continue; }
    for (const [k, b] of Object.entries(want)) { got[`${lv}.${k}`] = L[k]; if (b === true || b === false ? L[k] !== b : !inBand(L[k], b)) bad.push(`${lv}.${k} ${JSON.stringify(fmt(L[k]))} not in ${JSON.stringify(b)}`); }
  }
  for (const [k, b] of Object.entries(t.snaps || {})) {
    if (k === 'earned' || k === 'notEarned') { for (const id of b) { const m = milestone(r, id), on = !!m && m.tier != null; got[`${k}.${id}`] = on; if (on !== (k === 'earned')) bad.push(`${id} ${on ? 'earned' : 'not earned'} (${m ? m.points : '?'} points)`); } continue; }
    if (k === 'pointsOf') { for (const [id, pb] of Object.entries(b)) { const p = milestone(r, id)?.points ?? 0; if (!inBand(p, pb)) bad.push(`${id} ${p} points not in ${JSON.stringify(pb)}`); } continue; }
    if (k === 'eBrood15') { for (const [key, ex] of Object.entries(b)) { const [d, h] = key.slice(1).split('-').map(Number), row = Hr(r, d, h); const v = row ? row.e : null; got[key] = v; if (!inBand(v, ex.e)) bad.push(`chicks' e ${key} ${fmt(v)} not in ${JSON.stringify(ex.e)}`); } continue; }
    if (k === 'eYoung') { for (const id of b) { const ref = band(id), row = Hr(r, ref.day, ref.hour), v = row ? row.eMean : null; got[id] = v; if (!inBand(v, ref.expect.e)) bad.push(`${id}: e ${fmt(v)} not in ${JSON.stringify(ref.expect.e)}`); } continue; }
    if (k === 'note33' || k === 'noteDay0') { const d = k === 'note33' ? 33 : 0, notes = r.records.row(d)?.notes || []; if (!notes.some((n) => n.includes(b))) bad.push(`day ${d} notes ${JSON.stringify(notes)} lack "${b}"`); continue; }
    const fn = SNAPS[k];
    if (!fn) { bad.push(`unknown snap ${k}`); continue; }
    const v = fn(r, ideal, norm);
    got[k] = v;
    if (b === true || b === false ? v !== b : !inBand(v, b)) bad.push(`${k} ${JSON.stringify(fmt(v))} not in ${JSON.stringify(b)}`);
  }
  return { bad, got };
}
for (const [cond, names] of Object.entries(COND_PROFILES)) {
  for (const name of names) {
    test(`${cond} profile ${name}${COND_RANGE[name] ? ` (${COND_RANGE[name].join('–')})` : ''} reaches its COND_TARGETS`, () => {
      if (QUICK && !QUICK_RUNS.has(name)) return 'skip';
      const t0 = performance.now(), r = runOf(name), ideal = runOf(IDEAL_OF[cond]);
      const { bad, got } = checkCond(name, r, ideal, normalRun());
      assert(!bad.length, bad.join('; '));
      return `${((performance.now() - t0) / 1000).toFixed(1)} s · ${Object.entries(got).filter(([k]) => !k.startsWith('earned') && !k.startsWith('notEarned')).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}`;
    });
  }
}
test('every condition ideal: level 2 (9 points) in every branch with needsProblem applied', () => {
  const out = [];
  for (const [c, name] of Object.entries(IDEAL_OF)) {
    const r = runOf(name), low = SKILL_BRANCHES.filter((b) => (r.points[b.id] ?? 0) < SKILL_LEVEL_POINTS[1]);
    assert(!low.length, `${c}: ${low.map((b) => `${b.id} ${r.points[b.id]}`).join(', ')}`);
    out.push(`${c} min ${Math.min(...SKILL_BRANCHES.map((b) => r.points[b.id]))}`);
  }
  return out.join(', ');
});
test('determinism: two seed-7 runs of hot:ideal are identical', () => {
  if (QUICK) return 'skip';
  const a = runCycle('hot:ideal', { seed: 7, to: 'weeks45' }), b = runCycle('hot:ideal', { seed: 7, to: 'weeks45' });
  assert(JSON.stringify(a.records.serialize()) === JSON.stringify(b.records.serialize()) && JSON.stringify(a.hourly) === JSON.stringify(b.hourly), 'two seed-7 runs differ');
});
// ---------------- package checks (PHASE4.md §12.1) ----------------
const starts = {};
const startOf = (cond, lv) => { const k = `${cond}:${lv}`; if (!starts[k]) starts[k] = runCycle(cond ? IDEAL_OF[cond] : 'ideal', { seed: 1, from: 'plan', to: lv, keepStarts: true, stopAtStart: true, condition: cond }).starts[lv]; return starts[k]; };
function restoreBlob(w, blob) {
  const b = JSON.parse(JSON.stringify(blob));
  w.farm.start(LEVELS[1], { seed: b.farm.seed ?? 1, keepClock: true, condition: b.farm.cond ? b.farm.cond.condition : null });
  for (const [k, v] of Object.entries(b.env)) if (!['maxDay', 'curtainForced', 'cycleClimate', 'fansBroken', 'padWorking', 'fanStages', 'broodersUp'].includes(k)) w.env[k] = v;
  w.env.setMaxDay(b.env.maxDay); w.env.setDay(Math.round(b.env.day - b.env.hour / 24)); w.env.setHour(b.env.hour);
  w.farm.restore(b.farm); w.records.restore(b.records); w.skills.restore(b.skills);
  return w;
}
const worldAt = (cond, lv) => restoreBlob(makeWorld(), startOf(cond, lv));

test('restore -> serialize identical for a level start under each condition; the restored farm runs on with its condition', () => {
  const out = [];
  for (const [cond, lv] of [['hot', 'level1'], ['hot', 'weeks45'], ['rainy', 'weeks45'], ['badChicks', 'level1'], ['water', 'weeks45']]) {
    const blob = startOf(cond, lv), w = restoreBlob(makeWorld(), blob);
    for (const k of ['farm', 'records', 'skills']) {
      const a = JSON.stringify(blob[k]), b = JSON.stringify(w[k].serialize());
      if (a !== b) { let i = 0; while (a[i] === b[i]) i++; throw new Error(`${cond}/${lv}: ${k} differs at ${i}: ${a.slice(Math.max(0, i - 60), i + 60)} | ${b.slice(Math.max(0, i - 60), i + 60)}`); }
    }
    assert(w.farm.condition === cond && w.env.weather === (cond === 'hot' ? 'hot' : cond === 'rainy' ? 'rainy' : w.env.weather), `${cond}/${lv}: condition and weather`);
    if (cond === 'hot') assert(w.env.weatherEvents.some((e) => /^sun-/.test(e.id)), 'the sun events rebuilt');
    w.env.skipHours(3);
    out.push(`${cond}/${lv} ${(JSON.stringify(blob).length / 1024).toFixed(0)} KB`);
    assert(JSON.stringify(blob).length <= 250 * 1024, `${cond}/${lv} start over 250 KB`);
  }
  return out.join(', ');
});

test('every Phase 4 action answers at once with its result shape (PHASE4.md §10.3)', () => {
  const w = worldAt('rainy', 'weeks45'), { farm } = w;
  const shape = { 'gen.start': ['running', 'fuelL', 'hoursLeft'], 'gen.switch': ['on', 'source'], 'gen.test': ['ok', 'fuelL', 'minutes'], 'gen.fuel': ['fuelL'], 'gen.stop': ['running', 'fuelL'],
    'inlets.storm': true, 'water.tank': ['levelPct', 'lowPct', 'lowAt', 'pumpBar', 'pumpA', 'pumpOn'], 'pump.fix': ['started', 'worn', 'hours'], 'brood.trays': true };
  const args = { 'gen.switch': { to: 'generator' }, 'inlets.storm': { closed: true }, 'brood.trays': { on: true } };
  for (const [id, keys] of Object.entries(shape)) {
    const r = farm.act(id, args[id] || {});
    if (keys === true) assert(r === true, `${id} -> ${JSON.stringify(r)}`);
    else for (const k of keys) assert(r && typeof r === 'object' && k in r, `${id} has no ${k}: ${JSON.stringify(r)}`);
  }
  assert(farm.act('litter.patch', { x: 0, z: 5 }).onRain === true && farm.act('litter.patch', { x: 0, z: -5 }).onRain === false, 'litter.patch onRain in the rainy season');
  const b = worldAt('badChicks', 'level1'); b.env.skipHours((10.1 - b.env.hour) + 24);
  const g = b.farm.act('chicks.grade', { stack: 2 });
  assert(['stack', 'looked', 'weak', 'culled', 'minutes'].every((k) => k in g) && g.looked === 1000 && g.culled > 0 && g.minutes === 6, `chicks.grade ${JSON.stringify(g)}`);
  const h = worldAt('hot', 'weeks45'); assert(Number.isFinite(h.farm.act('water.flowtest', { line: 1 }).waterC), 'water.flowtest waterC in the hot season');
  const wa = worldAt('water', 'weeks45'); assert(Number.isFinite(wa.farm.act('water.test').ironMgL), 'water.test ironMgL in the water condition');
});

test('a power cut by farm.debug.power(false) stops the fans; gen.start + gen.switch bring them back; EV.POWER on each change', () => {
  const w = worldAt('rainy', 'weeks45'), { farm, env, events } = w, got = [];
  events.on(EV.POWER, (p) => got.push(p.on));
  env.setFans(4); env.setPad(true);
  farm.debug.power(false);
  assert(!farm.power.on && !env.powerOn && env.fansEffective === 0 && env.airSpeed === 0 && env.fansManual === 4 && env.padOn, `dark: ${JSON.stringify(farm.power)} fans ${env.fansEffective}`);
  env.skipHours(0.1);
  assert(farm.act('gen.start').running === true && !farm.power.on, 'the generator runs; the switch still on the mains');
  const s = farm.act('gen.switch', { to: 'generator' });
  assert(s.on === true && s.source === 'generator' && env.powerOn && env.fansEffective === 4, `on the generator: ${JSON.stringify(s)} fans ${env.fansEffective}`);
  assert(got.join() === 'false,true', `EV.POWER ${got}`);
});

test('the generator left on runs dry about 10 h after its start; gen-dry comes with its alarm', () => {
  const w = worldAt('rainy', 'weeks45'), { farm, env, events } = w, sym = [];
  events.on(EV.FARM_PROBLEM, (p) => { if (p.phase === 'symptom') sym.push(p); });
  env.skipHours((33 + 15.2 / 24 - env.day) * 24);
  assert(!farm.power.on && sym.some((p) => p.id === 'power-cut' && p.alarm === true), `the cut at 15:10 with its alarm (${JSON.stringify(sym)})`);
  env.skipHours(10 / 60); farm.act('gen.start'); farm.act('gen.switch', { to: 'generator' });
  const t0 = env.day;
  env.skipHours(3.5);
  assert(sym.some((p) => p.id === 'mains-back'), 'the mains back while the generator carries the house');
  while (farm.generator.running && env.day < t0 + 0.6) env.skipHours(0.25);
  const h = (env.day - t0) * 24;
  assert(h >= 9.5 && h <= 10.5 && !farm.power.on && sym.some((p) => p.id === 'gen-dry' && p.alarm === true), `dry after ${h.toFixed(2)} h; gen-dry ${JSON.stringify(sym.map((p) => p.id))}`);
  return `dry ${h.toFixed(2)} h after its start`;
});

test('pump.fix: fixing for 2 farm hours, then pumpShare 1 and pump-wear fixed', () => {
  const w = worldAt('water', 'weeks45'), { farm, env } = w;
  env.skipHours((27 + 8 / 24 - env.day) * 24);
  const T = farm.waterTank, before = T.pumpShare, r = farm.act('pump.fix');
  assert(r.started && r.worn && r.hours === 2 && T.fixing && before < 0.9, `${JSON.stringify(r)} share ${before}`);
  env.skipHours(1.5); assert(T.fixing && farm.act('water.tank').pumpOn === false, 'still fixing at 1.5 h: the pump stopped');
  env.skipHours(0.6); assert(!T.fixing && T.pumpShare === 1 && farm.problems.find((p) => p.id === 'pump-wear').phase === 'fixed', `after 2 h: ${JSON.stringify(T)}`);
});

test('a bad batch: the graded-out chicks are claimed only with a call to the hatchery on day 0', () => {
  const one = (call) => {
    const w = worldAt('badChicks', 'level1'), { farm, env } = w;
    env.skipHours((10.1 - env.hour) + 24);
    for (const s of [0, 1, 2, 3]) farm.act('chicks.grade', { stack: s });
    if (call === 0) farm.act('phone.hatchery', { chickWeightG: 36, weakPct: 4 });
    env.skipHours(16);
    if (call === 1) farm.act('phone.hatchery', { chickWeightG: 36, weakPct: 4 });
    return farm.flock;
  };
  const told = one(0), late = one(1), none = one(null);
  assert(told.gradedOut > 150 && told.claimed === told.gradedOut, `told on day 0: ${told.claimed} of ${told.gradedOut}`);
  assert(late.claimed === 0 && none.claimed === 0, `told on day 1: ${late.claimed}; never: ${none.claimed}`);
  return `${told.gradedOut} graded out of 4 stacks, claimed ${told.claimed}`;
});

test('heatHandled: 16-day-olds on the warm afternoon (day 16) with the pad and one fan are handled, with the pad and six fans not', () => {
  const w = worldAt(null, 'week3'), { farm, env } = w;
  env.skipHours((16 + 11 / 24 - env.day) * 24);
  env.setFans(1); env.setPad(true); env.skipHours(4);
  const one = heatHandled(farm, env), e1 = farm.comfort.meanOver;
  env.setFans(6); env.setPad(true); env.skipHours(1);
  const six = heatHandled(farm, env), e6 = farm.comfort.meanOver;
  assert(one && !six, `pad + 1 fan ${one} (e ${fmt(e1)}), pad + 6 fans ${six} (e ${fmt(e6)})`);
  return `pad + 1 fan e ${fmt(e1)}, pad + 6 fans e ${fmt(e6)}`;
});

console.log(failed ? `${failed} failed` : `all passed${skipped ? ` (${skipped} skipped${QUICK ? ': --quick' : ''})` : ''}`);
process.exit(failed ? 1 : 0);
