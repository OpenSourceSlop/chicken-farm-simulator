// The measured conditions behind each milestone of skills-cond.js MILESTONES_COND (PHASE4.md §7). Each rule reads the
// farm (the condition stats of farm-cond-stats.js in farm.condX, the problems, the generator, the tank), the records
// (notebook) and the checkpoint's ctx, and returns { tier, detail } or null (nothing to measure yet). Package "sim",
// pure logic. The detail is the measured value in plain words, never a verdict.
import { CONDITIONS } from './config.js';

const prob = (farm, id) => farm.problems.find((p) => p.id === id) || null;
const st = (farm) => (farm.condX && farm.condX.st) || {};
const notes = (records, kind, d) => records.notebook.filter((n) => n.kind === kind && (d == null || n.day === d));
const tierAt = (v, steps) => { let t = null; steps.forEach((ok, i) => { if (ok(v)) t = i; }); return t; };
const r1 = (v) => Math.round(v * 10) / 10;
const pct = (v) => `${r1(v).toLocaleString('en-US')} %`;
const GEN_TEST_DAYS = [8, 15, 22, 29];
const IRON_DAYS = (CONDITIONS.water.levels.week2.problems || []).concat(CONDITIONS.water.levels.weeks45.problems || []).filter((p) => p.id === 'iron-filter').map((p) => p.day);

export const RULES_COND = {
  // ---------------- the hot season ----------------
  'hot-brood-air': (farm) => {
    const S = st(farm);
    if (!(S.pmH > 0)) return null;
    const share = S.pmNear / S.pmH;
    return { tier: share >= 0.75 ? 0 : null, detail: `chicks within 1.5 °C of their row ${Math.round(100 * share)} % of the hot afternoon hours` };
  },
  'hot-nights': (farm) => {
    const v = st(farm).nightPant ?? null;
    if (v == null) return null;
    return { tier: tierAt(v, [(x) => x <= 15, (x) => x <= 8]), detail: `${r1(v)} hours of panting per bird in the evenings and nights` };
  },
  'hot-wave': (farm) => {
    const S = st(farm);
    if (S.heatAt30 == null || !(S.aliveAt30 > 0)) return null;
    const p = (100 * ((farm.flock.deadByCause.heat || 0) - S.heatAt30)) / S.aliveAt30;
    return { tier: tierAt(p, [(x) => x <= 0.1, (x) => x <= 0.03]), detail: `heat deaths in the heat wave ${pct(p)} of the birds` };
  },
  'cool-water': (farm, records) => {
    const days = [22, 24, 26, 28, 30, 32, 34, 36, 38, 40], S = st(farm);
    const done = days.filter((d) => (S.flushed && S.flushed[d] && S.flushed[d].length >= 4) || (records.jobLog || []).some((j) => j.key === `h-flush@${d}`)).length;
    return { tier: done >= 8 ? 0 : null, detail: `warm water flushed out on ${done} of the ${days.length} flush days` };
  },
  // ---------------- the rainy season ----------------
  'gen-tested': (farm) => {
    const tests = (farm.condX && farm.condX.genTests) || [], n = GEN_TEST_DAYS.filter((d) => tests.includes(d)).length;
    return { tier: n === GEN_TEST_DAYS.length ? 0 : null, detail: `generator test-run on ${n} of the ${GEN_TEST_DAYS.length} test days to day 29` };
  },
  'gen-fast': (farm) => {
    const p = prob(farm, 'power-cut');
    if (!p || p.phase !== 'fixed' || p.startedAt == null || p.fixedAt == null) return null;
    const m = (p.fixedAt - p.startedAt) * 1440;
    return { tier: tierAt(m, [(x) => x <= 15 + 1e-6, (x) => x <= 8 + 1e-6]), detail: `fans turning again ${Math.round(m)} farm minutes after the power went off` };
  },
  'storm-flaps': (farm) => {
    const S = st(farm);
    if (!(S.stormH > 0)) return null;
    const share = S.stormClosedH / S.stormH;
    return { tier: share >= 0.9 ? 0 : null, detail: `storm flaps closed for ${Math.round(100 * share)} % of the storm hours` };
  },
  'rain-litter': (farm, records) => {
    const means = [];
    for (let d = 22; d <= 41; d++) { const m = notes(records, 'litter', d).map((n) => n.value && n.value.moisturePct).filter(Number.isFinite); if (m.length) means.push(m.reduce((a, b) => a + b, 0) / m.length); }
    if (means.length < 10) return null;
    const worst = Math.max(...means);
    return { tier: tierAt(worst, [(x) => x <= 34, (x) => x <= 32]), detail: `wettest day's litter squeezes ${pct(worst)} (${means.length} days read)` };
  },
  // ---------------- a bad batch of chicks ----------------
  'weak-graded': (farm) => {
    const n = new Set((farm.condX && farm.condX.gradedStacks) || []).size;
    return { tier: tierAt(n, [(x) => x >= 4, (x) => x >= 6]), detail: `${n} of the 6 stacks graded before they went in` };
  },
  crop48: (farm, records) => {
    const c = notes(records, 'crop', 2).filter((n) => n.hour >= 8 && n.hour < 12.5).map((n) => n.value && n.value.crop);
    if (c.length < 10) return null;
    const full = c.filter((x) => x === 'full-soft').length / c.length;
    return { tier: full >= 0.9 ? 0 : null, detail: `${Math.round(100 * full)} % of the crops full at 48 hours` };
  },
  'hatchery-told': (farm) => {
    const at = farm.condX && farm.condX.hatcheryAt;
    return { tier: at != null ? 0 : null, detail: at != null ? `hatchery told on day 0; ${farm.flock.claimed || 0} chicks claimed` : 'the hatchery was not told on day 0' };
  },
  'bad-ratio': (farm) => {
    const w = farm.stats.weighed.filter((x) => Math.floor(x.t) === 7).map((x) => x.weightG), chick = farm.stats.chickWeightMeasuredG;
    if (w.length < 10 || !chick) return null;
    const ratio = w.reduce((a, b) => a + b, 0) / w.length / chick;
    return { tier: tierAt(ratio, [(x) => x >= 4.4, (x) => x >= 4.7]), detail: `day 7 weight ${r1(ratio)} × the chick weight` };
  },
  // ---------------- a water problem ----------------
  'iron-found': (farm) => {
    const fixed = (farm.condX && farm.condX.ironFixed) || [];
    const sameDay = IRON_DAYS.filter((d) => fixed.some(([s, f]) => Math.floor(s) === d && Math.floor(f) === d)).length;
    return { tier: sameDay === IRON_DAYS.length ? 0 : null, detail: `${sameDay} of ${IRON_DAYS.length} blocked filters cleared the day they blocked` };
  },
  'pump-found': (farm) => {
    const start = farm.condX && farm.condX.pumpFixStart, low = st(farm).tankUnder30At;
    if (start == null) return null;
    return { tier: low == null || start < low ? 0 : null, detail: low == null ? 'pump repaired before the tank ran low' : `pump repair started on day ${Math.floor(start)}; the tank first under 30 % on day ${Math.floor(low)}` };
  },
  'tank-read': (farm) => {
    const days = new Set(st(farm).tankReadDays || []), n = [...Array(14).keys()].map((k) => 22 + k).filter((d) => days.has(d)).length;
    return { tier: n === 14 ? 0 : null, detail: `tank and pump gauges read on ${n} of the 14 mornings` };
  },
};
