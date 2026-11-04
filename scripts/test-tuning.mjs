// Phase 4 tuning check (PHASE4.md §2.3, §10.1): the Phase 4 responses of src/farm-tuning.js on the env alone hold
// the references of scripts/tuning-refs.mjs, and the model side of every sign figure (config SIGN_FIGURES) agrees
// with the sign. Owner: package "sim" (the code), the integrator (the bands). Runs now and on every branch.
//   node scripts/test-tuning.mjs            the checks
//   node scripts/test-tuning.mjs --print    also print every measured value
import { CLIMATE_REFS_P4, WINDOW_REFS_P4, runPlanP4 } from './tuning-refs.mjs';
import { windChillP4, pantShareP4, pantFromP4, waterPerKgP4, coldDeathFromP4, sensibleHeatK, chillAirShare, dehydrationAllowed } from '../src/farm-tuning.js';
import { SIGN_FIGURES, CONDITIONS, conditionLevel, LEVELS, levelById, OUTSIDE_WATER_GM3, PAD_EFF } from '../src/config.js';
import { absHumSat, wetBulbOf } from '../src/sim.js';

const print = process.argv.includes('--print');
let failed = 0;
const fmt = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);
const inBand = (v, b) => v != null && Number.isFinite(v) && v >= b[0] - 1e-9 && v <= b[1] + 1e-9;
function test(name, fn) {
  try { const r = fn(); console.log(`ok   ${name}${print && r ? `\n     ${r}` : ''}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = (m, expect) => {
  const bad = Object.entries(expect).filter(([k, b]) => !inBand(m[k], b)).map(([k, b]) => `${k} ${fmt(m[k])} not in ${JSON.stringify(b)}`);
  const all = JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, fmt(v)])));
  assert(!bad.length, `${bad.join('; ')} | measured ${all}`);
  return all;
};

// ---- the climate references (env alone, Phase 4 responses) ----
const climate = {};
for (const ref of CLIMATE_REFS_P4) {
  test(`P4 climate ${ref.id}`, () => {
    const o = runPlanP4(ref.plan, { weather: ref.weather, fromDay: ref.day - 1 + 6 / 24, toDay: ref.day + ref.hour / 24, events: ref.events || [] });
    const m = { outC: o.outC, outRh: o.outRh, houseC: o.houseC, rh: o.rh, feltC: o.s.feltMean, e: o.s.eMean, pant: o.s.pantShare, deathPerH: o.s.deathPerH * 100,
      coldDeathPerH: o.s.coldDeathPerH * 100, fHeat: o.s.fHeat, windChill: o.s.windChill };
    climate[ref.id] = m;
    if (ref.expect.feltOverIdeal) m.feltOverIdeal = m.feltC - climate[ref.id.replace(ref.plan, 'ideal')].feltC;
    return check(m, ref.expect);
  });
}
const windows = {};
for (const ref of WINDOW_REFS_P4) {
  test(`P4 window ${ref.id}: days ${ref.from}–${ref.to}, ${ref.plan}`, () => {
    const o = runPlanP4(ref.plan, { weather: ref.weather, fromDay: ref.from, toDay: ref.to, events: ref.events || [], broken: ref.broken, padWorking: ref.padWorking });
    const m = { deathsPct: o.deathsPct, pantH: o.pantH, coldH: o.coldH, fHeat: o.fHeat };
    windows[ref.id] = m;
    const base = windows[ref.id.replace(/-(fan4-broken|pad-clogged|padInHumid)$/, '-ideal')];
    if (ref.expect.pantHOverIdeal) m.pantHOverIdeal = m.pantH / base.pantH;
    if (ref.expect.fHeatUnderIdeal) m.fHeatUnderIdeal = base.fHeat - m.fHeat;
    return check(m, ref.expect);
  });
}

// ---- the responses themselves ----
test('P4 wind chill: stronger for young birds, 5-6 °C for big birds at 2.5 m/s, fading over 35 °C air', () => {
  const r = [7, 14, 21, 28, 35, 42].map((a) => windChillP4(2.5, a, 30));
  for (let i = 1; i < r.length; i++) assert(r[i] <= r[i - 1] + 1e-9, `wind chill rises with age: ${r.map(fmt)}`);
  assert(chillAirShare(35) === 1 && chillAirShare(38) < 0.6 && chillAirShare(40) <= 0.2, 'the air factor');
  assert(windChillP4(1.25, 35, 30) > 0.5 * windChillP4(2.5, 35, 30), 'the first m/s count most (concave)');
  return `at 2.5 m/s: ${r.map(fmt).join(' / ')} °C on days 7-42`;
});
test('P4 panting: a 4 °C ramp from the first birds to all of them; water ratio; cold deaths of older birds; sensible heat', () => {
  assert(pantShareP4(pantFromP4(35), 35) === 0 && pantShareP4(pantFromP4(35) + 4, 35) === 1 && Math.abs(pantShareP4(pantFromP4(35) + 2, 35) - 0.5) < 1e-9, 'ramp');
  assert(Math.abs(waterPerKgP4(0) - 1.8) < 1e-9 && waterPerKgP4(5) > 2.2 && waterPerKgP4(40) === 3.2, 'water ratio');
  assert(coldDeathFromP4(10) === null && coldDeathFromP4(14) === -4 && coldDeathFromP4(40) === -8, 'cold deaths');
  assert(sensibleHeatK(28) === 2.5 && sensibleHeatK(37) < 1.1, 'sensible heat fades in hot air');
  assert(!dehydrationAllowed(30, 4) && dehydrationAllowed(30, 6) && dehydrationAllowed(10, 0), 'dry hours');
});

// ---- every sign figure, the model side (config SIGN_FIGURES: the run package prints the text, PHASE4.md §2.5) ----
const MODEL = {
  windChill14: () => windChillP4(2.5, 14, 30), windChill35: () => windChillP4(2.5, 35, 30), windChillHot: () => chillAirShare(39),
  airPerFan: () => 2.5 / 6, waterRatioComfort: () => waterPerKgP4(0), waterRatioHot: () => waterPerKgP4(6), waterRatioWave: () => waterPerKgP4(14),
  padShareOfRule: () => { const out = [[33, 54], [36, 47], [39, 40]].map(([t, rh]) => (PAD_EFF * (t - wetBulbOf(t, rh))) / ((100 - rh) / 5)); return Math.min(...out); },
  padShareOfRuleMax: () => Math.max(...[[33, 54], [36, 47], [39, 40]].map(([t, rh]) => (PAD_EFF * (t - wetBulbOf(t, rh))) / ((100 - rh) / 5))),
  rainyPadC: () => PAD_EFF * (30 - wetBulbOf(30, (100 * OUTSIDE_WATER_GM3.rainy) / absHumSat(30))),
  firstPant35: () => 20 + pantFromP4(35), allPant35: () => 20 + pantFromP4(35) + 4,
  powerCut30: () => windows.cut30?.deathsPct, powerCut120: () => windows.cut120?.deathsPct,
};
test('P4 sign figures: the model gives what the signs say (config SIGN_FIGURES)', () => {
  const out = [];
  for (const f of SIGN_FIGURES) {
    const fn = MODEL[f.model];
    assert(fn, `no model check for ${f.id} (${f.model})`);
    const v = fn();
    assert(inBand(v, f.band), `${f.id} on ${f.board}: model ${fmt(v)} not in ${JSON.stringify(f.band)} ("${f.text}")`);
    out.push(`${f.id} ${fmt(v)}`);
  }
  return out.join(', ');
});

// ---- the conditions' climate data (config CONDITIONS, PHASE4.md §4) ----
test('P4 conditions: each has its levels, weather and a summary; conditionLevel merges the problems', () => {
  for (const [id, c] of Object.entries(CONDITIONS)) {
    assert(c.label && c.summary && c.levels, `${id}: label, summary, levels`);
    for (const lv of Object.keys(c.levels)) assert(levelById(lv), `${id}: unknown level ${lv}`);
    for (const def of LEVELS) {
      const m = conditionLevel(def, id);
      assert(Array.isArray(m.problems) && m.weather, `${id}/${def.id}: merged problems and weather`);
      const ids = m.problems.map((p) => p.id);
      assert(new Set(ids).size === ids.length, `${id}/${def.id}: a problem id twice: ${ids}`);
    }
  }
  assert(conditionLevel(levelById('weeks45'), null).problems === levelById('weeks45').problems, 'no condition: the level def as it is');
});

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
