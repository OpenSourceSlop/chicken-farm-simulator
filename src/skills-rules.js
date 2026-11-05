// The measured conditions behind each milestone of skills.js MILESTONES (PHASE2.md §9). Each rule
// reads farm.stats, farm.problems, the flock counts and the records, and returns
// { tier: index into the milestone's tiers | null, detail: the measured value in plain words }.
// Package "sim", pure logic. Nothing here is shown as a verdict: the detail is a measurement.
import { flowTargetAt, nippleHeightCmAt } from './config.js';
import { sampleNeed } from './skills-rules-payoff.js';

const H = 1 / 24;
const prob = (farm, id) => farm.problems.find((p) => p.id === id) || null;
const fmtH = (days) => `${(days * 24).toFixed(1)} h`;
const notes = (records, kind, day) => records.notebook.filter((n) => n.kind === kind && (day == null || n.day === day));
const chickWeight = (farm) => farm.stats.chickWeightMeasuredG ?? farm.flock.chickWeightG;

export const RULES = {
  'floor-ready': (farm) => {
    const s = farm.stats.floorShareAtFirstTip;
    return s == null ? null : { tier: s >= 0.9 ? 0 : null, detail: `floor at 28 °C or more on ${Math.round(s * 100)} % of the brooding area at the first tip` };
  },
  'chick-weight': (farm) => {
    const s = farm.stats;
    return s.firstTipAt == null ? null : { tier: s.boxWeighedAt != null && s.boxWeighedAt <= s.firstTipAt ? 0 : null, detail: s.chickWeightMeasuredG != null ? `chick weight ${s.chickWeightMeasuredG} g from the box` : '' };
  },
  'placed-fast': (farm) => {
    const s = farm.stats;
    if (s.lastTipAt == null || s.truckAt == null) return null;
    const min = (s.lastTipAt - s.truckAt) * 24 * 60;
    return { tier: min <= 90 + 1e-6 ? 0 : null, detail: `last box emptied ${Math.round(min)} min after the truck` };
  },
  'vent-checked': (farm) => {
    const s = farm.stats;
    if (s.firstTipAt == null) return null;
    const r = s.ventReadings.filter((v) => v.t >= s.firstTipAt + 2 * H - 1e-9 && v.t <= s.firstTipAt + 3.5 * H + 1e-9);
    const sectors = new Set(r.map((v) => v.sector)).size;
    // the day's sample: 5 chicks from 3 parts, 3 from 3 with Brooding 2's smaller sample (farm.stats.samples)
    const need = sampleNeed(farm, 'sample.vent', 0);
    return { tier: r.length >= need.n && sectors >= need.sectors ? 0 : null, detail: `${r.length} vent temperatures from ${sectors} parts of the floor` };
  },
  'crop-fill': (farm) => {
    const c = farm.stats.cropFillTrue;
    return c == null ? null : { tier: c >= 0.95 ? 1 : c >= 0.85 ? 0 : null, detail: `crops full on ${Math.round(c * 100)} % of the chicks at 24 hours` };
  },
  'brooder-relit': (farm) => {
    const p = prob(farm, 'brooder-out');
    return p && p.fixedAt != null ? { tier: p.fixedAt <= 1 + 12 * H + 1e-9 ? 0 : null, detail: `brooder relit at day ${Math.floor(p.fixedAt)} ${clock(p.fixedAt)}` } : null;
  },
  'steady-heat': (farm) => {
    const s = farm.stats;
    if (!s.levelMinutes) return null;
    const share = s.comfortMinutes / s.levelMinutes;
    return { tier: share >= 0.95 ? 0 : null, detail: `chicks in their comfort band ${Math.round(share * 100)} % of the week` };
  },
  'day7-weight': (farm) => {
    const w = farm.stats.weighed;
    if (!w.length) return null;
    const ratio = w.reduce((a, b) => a + b.weightG, 0) / w.length / chickWeight(farm);
    return { tier: ratio >= 4.5 ? 1 : ratio >= 4.0 ? 0 : null, detail: `${ratio.toFixed(1)} × chick weight` };
  },
  'low-mortality': (farm) => {
    const f = farm.flock;
    // only a week that was lived: chicks placed and the flock brought to the weigh-in age (7.0)
    if (!f.delivered || !(f.placed > 0) || farm.age < 7 - 1e-9) return null;
    const pct = (100 * (f.deadTotal + f.culls)) / f.delivered;
    return { tier: pct <= 1.0 + 1e-9 ? 0 : null, detail: `deaths and culls ${pct.toFixed(1)} % of the chicks` };
  },
  'flushed-on-time': (farm) => {
    const s = farm.stats;
    if (s.truckAt == null || s.flushDoneAt == null) return null;
    const before = s.truckAt - s.flushDoneAt;
    return { tier: before >= 6 * H - 1e-9 && before <= 18 * H + 1e-9 ? 0 : null, detail: `lines ran clear ${fmtH(before)} before the chicks` };
  },
  'nipples-day0': (farm) => {
    const h = farm.stats.heightsAtFirstTip;
    if (!h) return null;
    const want = nippleHeightCmAt(0);
    return { tier: h.every((x) => Math.abs(x - want) <= 2 + 1e-9) ? 0 : null, detail: `nipples at ${h.join(', ')} cm when the chicks arrived` };
  },
  'flow-matched': (farm, records) => {
    let days = 0;
    for (let d = 0; d <= 7; d++) {
      const f = [0, 1, 2, 3].map((line) => { const n = notes(records, 'water.flow', d).filter((x) => x.value.line === line && x.hour < 12); return n.length ? n[n.length - 1].value.mlMin : null; });
      if (f.every((v) => v != null && Math.abs(v - flowTargetAt(d)) <= 3 + 1e-9)) days++;
    }
    return { tier: days >= 6 ? 0 : null, detail: `morning flows at age + 20 ml/min on ${days} days` };
  },
  'drop-spotted': (farm) => {
    const p = prob(farm, 'blocked-filter');
    if (!p || p.foundAt == null) return null;
    const ok = p.foundAt <= 4 + 12 * H + 1e-9 && (p.foundBy === 'flowtest' || p.foundBy === 'filter');
    return { tier: ok ? 0 : null, detail: `low flow found at day ${Math.floor(p.foundAt)} ${clock(p.foundAt)}` };
  },
  'leak-fixed': (farm) => {
    const p = prob(farm, 'leaking-nipple');
    return p && p.fixedAt != null ? { tier: p.cakedAtFix ? null : 0, detail: `nipple replaced ${fmtH(p.fixedAt - p.startedAt)} after it began to drip` } : null;
  },
  'meter-daily': (farm, records) => {
    let days = 0;
    for (let d = 0; d <= 7; d++) if (notes(records, 'water.meter', d).some((n) => n.hour >= 6 && n.hour < 12)) days++;
    return { tier: days >= 8 ? 0 : null, detail: `water meter read on ${days} mornings` };
  },
  'raised-with-flock': (farm) => {
    const h = farm.water.lines.map((l) => l.heightCm), want = nippleHeightCmAt(7);
    return farm.stats.weighed.length ? { tier: h.every((x) => Math.abs(x - want) <= 3 + 1e-9) ? 0 : null, detail: `nipples at ${h.join(', ')} cm at the weigh-in` } : null;
  },
  'ratio-steady': (farm, records) => {
    let days = 0;
    for (let d = 1; d <= 7; d++) { const r = records.row(d) || records.draft(d); if (r.waterFeedRatio != null && r.waterFeedRatio >= 1.6 && r.waterFeedRatio <= 2.2) days++; }
    return { tier: days >= 5 ? 0 : null, detail: `water to feed 1.6–2.2 on ${days} days` };
  },
};

function clock(t) {
  const m = Math.round((t - Math.floor(t)) * 24 * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
