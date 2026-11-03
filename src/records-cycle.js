// Flock records for the whole cycle — STUB (PHASE3.md §8, §13.8). Owner: package "sim", which builds
// the harvest page, the clean-out page, the cycle summary and the notebook compaction on top of
// records.js / records-rows.js. Pure logic. The run package draws them (ui-records, ui-summary).
//
//   harvestPage(records, farm) -> null | { tickets: [{ truck, crates, birds, grossKg, tareKg, netKg, doa }],
//     sold, liveKg, meanLiveG, fcr, mortalityPct, deathsByLevel: { [levelId]: pct }, uniformityPct, epef,
//     feedLeftKg, withdrawalH, notes: string[] }                      (day 42; plain numbers only)
//   cleanPage(records, farm) -> null | { litterOutAt, washedPct, dryPct, disinfectedPct, lines, pans,
//     washbay, baits, swabsTaken, lab: { positive, of, places? }, closedDay, bookedDay, restDays }
//   cycleSummary(records, farm, { plan, levels }) -> CycleSummary (PHASE3.md §8.5); the records object
//     exposes it as records.cycleSummary({ plan, levels }) (the one signature others call, §13.9)
//   compact(records, beforeDay)   folds old notebook lines into the rows (save size, PHASE3.md §8.6)
//
// @typedef {{ placed: number, sold: number|null, liveKg: number|null, meanLiveG: number|null,
//   fcr: number|null, epef: number|null, mortalityPct: number|null, deathsByLevel: object,
//   weights: { day: number, weighedG: number|null, targetG: number }[], feedKg: number|null,
//   waterL: number|null, gasKg: number|null, restDays: number|null, swabsPositive: number|null,
//   plan: { lossesPct: number, saleKg: number, salePerWeek: number, cycleDays: number }|null,
//   actual: { lossesPct: number|null, saleKg: number|null, cycleDays: number|null },
//   points: { [branch: string]: number } }} CycleSummary
import { weightAt } from './config.js';

export const STUB = true;

export function harvestPage() { return null; }
export function cleanPage() { return null; }

/** STUB: what the counts already give (no harvest yet). */
export function cycleSummary(records, farm, run = {}) { // run = { plan, levels }
  const fl = farm?.flock || {};
  const placed = fl.placed || 0;
  const dead = (fl.deadTotal || 0) + (fl.culls || 0);
  const plan = run?.plan?.decisions || null;
  return {
    placed, sold: null, liveKg: null, meanLiveG: null, fcr: Number.isFinite(fl.fcr) && fl.fcr > 0 ? fl.fcr : null, epef: null,
    mortalityPct: placed ? (100 * dead) / placed : null, deathsByLevel: {},
    weights: [7, 14, 21, 28, 35, 42].map((day) => ({ day, weighedG: null, targetG: weightAt(day) })),
    feedKg: fl.cumFeedKg ?? null, waterL: null, gasKg: null, restDays: null, swabsPositive: null,
    plan: plan ? { lossesPct: plan.lossesPct, saleKg: plan.saleKg, salePerWeek: run.plan.sums?.salePerWeek ?? null, cycleDays: plan.cycleDays } : null,
    actual: { lossesPct: placed ? (100 * dead) / placed : null, saleKg: null, cycleDays: null },
    points: {},
  };
}

export function compact() { return 0; }
