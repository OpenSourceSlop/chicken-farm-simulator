// Flock records for the whole cycle (PHASE3.md §8): the harvest page, the clean-out page, the cycle summary and
// the notebook compaction, on top of records.js / records-rows.js. Owner: package "sim". Pure logic; the run
// package draws them (ui-records, ui-summary). Plain numbers only: nothing here is a verdict.
//
//   harvestPage(records, farm) -> null | { tickets: [{ truck, crates, birds, grossKg, tareKg, gutKg, netKg, doa }], read: [truck],
//     sold, loaded, liveKg, meanLiveG, fcr, mortalityPct, deathsByLevel: [{ level, deaths, culls, doa, pct }], uniformityPct,
//     uniformityDay, epef, epefFormula, feedLeftKg, withdrawalH, ageDays, notes: string[] }       (day 42; after the catch)
//   cleanPage(records, farm) -> null | { litterOutAt, washedPct, dryPct, disinfectedPct, lines, pans, washbay, baits,
//     brushed, swabsTaken, lab: { positive, of, day, places? } | null, labs, closedDay, bookedDay, restDays, pass }
//   cycleSummary(records, farm, { plan, levels }) -> CycleSummary (PHASE3.md §8.5); records.cycleSummary({ plan, levels })
//   compact(records, beforeDay) -> lines removed: notebook lines of days before beforeDay folded away (the rows
//     stay whole); kept: what later rows and rules still read (tips, culls, dead birds counted, the box weighing,
//     feed meter readings) and one look note a day (PHASE3.md §8.6)
//
// @typedef {{ placed: number, sold: number|null, liveKg: number|null, meanLiveG: number|null,
//   fcr: number|null, epef: number|null, mortalityPct: number|null, deathsByLevel: object[],
//   weights: { day: number, weighedG: number|null, targetG: number }[], feedKg: number|null,
//   waterL: number|null, gasKg: number|null, restDays: number|null, swabsPositive: number|null,
//   plan: { lossesPct: number, saleKg: number, salePerWeek: number, cycleDays: number }|null,
//   actual: { lossesPct: number|null, saleKg: number|null, cycleDays: number|null },
//   points: { [branch: string]: number } }} CycleSummary
import { LEVELS, weightAt, HARVEST } from './config.js';

const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const FLOCK_LEVELS = LEVELS.filter((l) => ['level1', 'week2', 'week3', 'weeks45', 'finish'].includes(l.id));

/** Deaths and culls per level from the daily rows (what was counted at the bin), DOA on the finish level. */
export function deathsByLevel(records, farm) {
  const placed = Math.max(1, (farm && farm.flock && (farm.flock.delivered || farm.flock.placed)) || 0);
  const rows = records.rows();
  return FLOCK_LEVELS.map((l) => {
    const rs = rows.filter((r) => r.day >= Math.max(0, l.startDay) && r.day <= l.endDay);
    const deaths = rs.reduce((a, r) => a + (r.deaths || 0), 0), culls = rs.reduce((a, r) => a + (r.culls || 0), 0);
    const doa = l.id === 'finish' && farm && farm.harvest && farm.harvest.result ? farm.harvest.result.doa : 0;
    return { level: l.id, deaths, culls, doa, pct: r2((100 * (deaths + culls + doa)) / placed) };
  });
}

export function harvestPage(records, farm) {
  const hv = farm && farm.harvest, res = hv && hv.result;
  if (!res) return null;
  const read = records.notebook.filter((n) => n.kind === 'ticket').map((n) => n.value.truck);
  const tickets = hv.trucks.map((t, truck) => ({ truck, crates: t.crates, birds: t.birds, grossKg: Math.round(t.grossKg), tareKg: HARVEST.tareKg, gutKg: Math.round(t.gutKg || 0), netKg: Math.round(t.netKg), doa: t.doa }));
  const notes = [];
  if (res.gutFull) notes.push(`Feed in the crops and guts of the birds: the plant deducted ${Math.round(res.gutKg || 0).toLocaleString('en-US')} kg, not paid`);
  return { tickets, read: [...new Set(read)], sold: res.sold, loaded: res.loaded, liveKg: res.liveKg, meanLiveG: res.meanLiveG, fcr: res.fcr,
    mortalityPct: res.mortalityPct, deathsByLevel: deathsByLevel(records, farm), uniformityPct: res.uniformityPct, uniformityDay: res.uniformityDay,
    epef: res.epef, epefFormula: 'livability % × mean live weight kg ÷ (age days × FCR) × 100', feedLeftKg: res.feedLeftKg, withdrawalH: res.withdrawalH,
    ageDays: r1(res.ageAtCatch), notes };
}

export function cleanPage(records, farm) {
  const C = farm && farm.clean;
  if (!C || !(farm.cycleLevel && farm.cycleLevel.id === 'cleanout')) return null;
  const pct = (v) => Math.round(v * 100);
  return { litterOutAt: C.scrapedAt, litterLeftPct: pct(farm.litter.coverAll || 0), washedPct: pct(C.washShare), dryPct: pct(1 - C.wetShare), disinfectedPct: pct(C.sprayShare),
    lines: C.lines.map((v) => v >= 1), pans: C.pans.slice(), washbay: { ...C.washbay }, baits: C.baits.slice(), brushed: { ...C.brushed },
    swabsTaken: C.swabs.length, lab: C.lab ? { positive: C.lab.positive, of: C.lab.of, day: C.lab.day, places: C.lab.places.map((p) => ({ ...p })) } : null,
    labs: C.labs.map((l) => ({ positive: l.positive, of: l.of, day: l.day })), closedDay: C.closedDay, bookedDay: C.bookedDay,
    restDays: C.bookedDay != null && C.closedDay != null ? C.bookedDay - C.closedDay : null, pass: C.pass };
}

/** The cycle summary (PHASE3.md §8.5). run = { plan: run.plan, levels: run.state().levels }. */
export function cycleSummary(records, farm, run = {}) {
  const fl = (farm && farm.flock) || {}, res = farm && farm.harvest && farm.harvest.result, C = farm && farm.clean;
  const placed = fl.delivered || fl.placed || 0;
  const dead = (fl.deadTotal || 0) + (fl.culls || 0) + (res ? res.doa : 0);
  const p = (run && run.plan) || (farm && farm.plan) || null, dec = p && p.decisions;
  const weighed = (farm && farm.stats && farm.stats.weighed) || [];
  const weights = [7, 14, 21, 28, 35, 40].map((day) => {
    const w = weighed.filter((x) => Math.floor(x.t) === day).map((x) => x.weightG);
    return { day, weighedG: w.length >= 10 ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : null, targetG: Math.round(weightAt(day)) };
  });
  const feedUsed = farm && farm.feed ? (farm.stats.feedAtStartKg ?? 0) + (farm.feed.deliveredKg || 0) - (res ? res.feedLeftKg : 0) : null;
  const cycleDays = C && C.bookedDay != null ? C.bookedDay : null; // placement on day 0 to the next chicks
  return {
    placed, sold: res ? res.sold : null, liveKg: res ? res.liveKg : null, meanLiveG: res ? res.meanLiveG : null, fcr: res ? res.fcr : null, epef: res ? res.epef : null,
    mortalityPct: placed ? r2((100 * dead) / placed) : null, deathsByLevel: deathsByLevel(records, farm), weights,
    feedKg: feedUsed != null ? Math.round(feedUsed) : null, waterL: farm && farm.water ? Math.round(farm.water.meterL) : null,
    gasKg: farm && farm.stats && farm.stats.gasKg != null ? Math.round(farm.stats.gasKg) : null,
    restDays: C && C.bookedDay != null && C.closedDay != null ? C.bookedDay - C.closedDay : null, swabsPositive: C && C.lab ? C.lab.positive : null,
    plan: dec ? { lossesPct: dec.lossesPct, saleKg: dec.saleKg, salePerWeek: p.sums ? p.sums.salePerWeek : null, cycleDays: dec.cycleDays, houses: dec.houses, birdsPerHouse: dec.birdsPerHouse } : null,
    actual: { lossesPct: placed ? r2((100 * dead) / placed) : null, saleKg: res ? r2(res.meanLiveG / 1000) : null, cycleDays },
    points: { ...(records.cyclePoints ? records.cyclePoints() : {}) },
    levels: run && run.levels ? JSON.parse(JSON.stringify(run.levels)) : null,
  };
}

const KEEP = new Set(['tip', 'cull', 'dead', 'box', 'feed.meter', 'plan', 'measure', 'booking', 'ticket', 'swab', 'gas']);
/** Fold the notebook lines of days before `beforeDay` away (save size); returns how many lines went. */
export function compact(records, beforeDay) {
  const nb = records.notebook;
  if (!Number.isFinite(beforeDay) || !nb.length) return 0;
  const lookDays = new Set();
  const out = [];
  for (const n of nb) {
    if (n.day >= beforeDay || KEEP.has(n.kind)) { out.push(n); continue; }
    if (n.kind === 'look' && !lookDays.has(n.day)) { lookDays.add(n.day); out.push(n); }
  }
  const removed = nb.length - out.length;
  nb.length = 0; nb.push(...out);
  return removed;
}
