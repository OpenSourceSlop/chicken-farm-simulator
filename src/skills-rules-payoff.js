// The measured conditions behind the seven milestones the skills update adds (src/skills-payoff.js MILESTONES_PAYOFF,
// SKILLS.md §2.3). Each rule reads the farm (stats, the per-day stats), the records (rows, notebook, job log, missed
// jobs) and the checkpoint's ctx, and returns { tier, detail } or null (nothing to measure yet). Package "model", pure
// logic. The detail is the measured value in plain words, never a verdict. Every threshold is on the sign the job links
// (general practice) or a measured outcome the milestone's text states.
import { weightAt, AUTO, SAMPLE_STANDARD } from './config.js';

const day = (farm, d) => (farm.stats.daily && farm.stats.daily[d]) || {};
const range = (a, b) => { const o = []; for (let d = a; d <= b; d++) o.push(d); return o; };
const ls = (farm) => farm.stats.levelStart || {};
const pct1 = (v) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} %`;
const missed = (records, days) => { const ex = records.extrasOf ? records.extrasOf() : {}; return days.flatMap((d) => (ex[d] && ex[d].missedIds) || []); };
/** A job instance of `id` done on day d (the job engine's log: 'r-fans-pm@16'). */
const jobDone = (records, id, d) => (records.jobLog || []).some((j) => j.key === `${id}@${d}` || (j.day === d && String(j.key).split('@')[0] === id));
/** The notebook's lines of `kind` on day d between two hours. */
const notesAt = (records, kind, d, h0 = 0, h1 = 24) => records.notebook.filter((n) => n.kind === kind && n.day === d && n.hour >= h0 && n.hour < h1);

/** The day's weighed mean (10 birds or more by hand), else a clean scale read of 300 weighings or more (Growth 3). */
export function dayWeight(farm, d) {
  const w = farm.stats.weighed.filter((x) => Math.floor(x.t) === d).map((x) => x.weightG);
  if (w.length >= 10) return { meanG: w.reduce((a, b) => a + b, 0) / w.length, n: w.length, by: 'hand' };
  const s = farm.stats.scaleReads && farm.stats.scaleReads[d];
  if (s && !s.fouled && s.n >= AUTO.scaleMinReads && s.meanG != null) return { meanG: s.meanG, n: s.n, by: 'scale' };
  return null;
}
/** The sample the day's job asked for (the farmer's choice after the skills review: Growth 2's 25 birds, Brooding 2's 3 vent
 *  chicks and 6 crops; level.js keeps them in farm.stats.samples when such a job opens), else the boards' standard. */
export function sampleNeed(farm, id, d) {
  const s = farm?.stats?.samples?.[id]?.[d];
  return s && s.n > 0 ? s : SAMPLE_STANDARD[id];
}
/** A weigh day counts for weighed-weekly: the day's sample by hand (50 birds, 25 with Growth 2), or a clean scale read of
 *  300 weighings or more (SKILLS.md §2.3). */
export function weighDayDone(farm, d) {
  if (farm.stats.weighed.filter((x) => Math.floor(x.t) === d).length >= sampleNeed(farm, 'sample.weigh', d).n) return true;
  const s = farm.stats.scaleReads && farm.stats.scaleReads[d];
  return !!(s && !s.fouled && s.n >= AUTO.scaleMinReads);
}

export const RULES_PAYOFF = {
  // ---------------- Heat & Ventilation ----------------
  'night-air-w3': (farm) => {
    const days = range(15, 21), n = days.filter((d) => day(farm, d).nightOk).length;
    if (!days.some((d) => day(farm, d).nightH != null)) return null;
    return { tier: n >= 7 ? 1 : n >= 5 ? 0 : null, detail: `the night air held the birds calm for 30 minutes after 18:00 on ${n} of the 7 evenings` };
  },
  'fans-w3': (farm, records) => {
    const days = range(15, 21);
    const n = days.filter((d) => jobDone(records, 'r-fans-pm', d) || notesAt(records, 'fans', d, 12, 18).length > 0 || (day(farm, d).glance || {}).stages).length;
    return { tier: n >= 7 ? 1 : n >= 5 ? 0 : null, detail: `the fans and the house read on ${n} of the 7 afternoons` };
  },
  'heat-deaths-fin': (farm) => {
    const s = ls(farm);
    if (!(s.alive > 0)) return null;
    const n = Math.max(0, (farm.flock.deadByCause.heat || 0) - (s.heat || 0)), p = (100 * n) / s.alive;
    return { tier: p <= 0.1 + 1e-9 ? 0 : null, detail: `${n} heat deaths in the last week (${pct1(p)} of the birds)` };
  },
  // ---------------- Lighting ----------------
  'dark-fin': (farm) => {
    const n = range(36, 40).filter((d) => { const a = day(farm, d).am; return a && a.dark != null && a.dark >= 4; }).length;
    return { tier: n >= 4 ? 0 : null, detail: `a dark period of 4 hours or more on ${n} of days 36–40` };
  },
  // ---------------- Biosecurity & Health ----------------
  'dead-fin': (farm, records) => {
    const m = missed(records, range(36, 41)).filter((id) => id === 'r-dead-am' || id === 'r-dead-pm').length;
    return { tier: m === 0 ? 0 : null, detail: m ? `${m} dead-bird rounds missed in the last week` : 'dead birds picked up on every round of the last week' };
  },
  // ---------------- Growth & Performance ----------------
  'w28-weight': (farm) => {
    const w = dayWeight(farm, 28);
    if (!w) return null;
    const share = w.meanG / weightAt(28);
    return { tier: share >= 1.03 ? 1 : share >= 0.98 ? 0 : null, detail: `day 28: ${Math.round(w.meanG).toLocaleString('en-US')} g, ${Math.round(share * 100)} % of the target${w.by === 'scale' ? ' (the bird scale’s day average)' : ''}` };
  },
  // ---------------- Farm Planning ----------------
  'records-w23': (farm, records) => {
    const days = range(8, 21), n = days.filter((d) => { const r = records.row(d); return (r && r.signed) || jobDone(records, 'r-record', d); }).length;
    return { tier: n === days.length ? 0 : null, detail: `the daily record signed on ${n} of the 14 evenings of days 8–21` };
  },
};
