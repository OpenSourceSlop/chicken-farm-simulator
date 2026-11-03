// The production planning sums of the planning day (PHASE3.md §6.11). Pure functions, complete now:
// the farm answers `plan.send` with them (the company's reply letter), the planning calculator (unlock
// planningCalc, package "panels") shows them live, and the cycle summary compares the plan with the
// flock. Owner: package "sim" (committed by the integrator as contract code).
//
// Nothing here judges the plan: planSums turns the farmer's decisions into the numbers the contract talks
// about (birds for sale per week, density at catching, rest days) with his own losses figure; planOutcome
// runs them through the contract's terms (at least 4 % losses counted, 21 rest days, 6,000 chicks a house)
// as the company's reply. Whether that meets the contract is the level's key target (PHASE3.md §10),
// shown as those numbers.
import { PLAN_CONTRACT } from './config.js';

/** The farmer's decisions on the sheet (the inputs the sums use), with their ranges. */
export const PLAN_FIELDS = [
  { key: 'houses', label: 'Houses', min: PLAN_CONTRACT.houses[0], max: PLAN_CONTRACT.houses[1], step: 1 },
  { key: 'birdsPerHouse', label: 'Chicks per house', min: PLAN_CONTRACT.birdsPerHouse[0], max: PLAN_CONTRACT.birdsPerHouse[1], step: 100 },
  { key: 'cycleDays', label: 'Days per flock (growing + clean-out + rest)', min: PLAN_CONTRACT.cycleDays[0], max: PLAN_CONTRACT.cycleDays[1], step: 1 },
  { key: 'lossesPct', label: 'Losses you plan for, %', min: 0, max: 20, step: 0.5 },
  { key: 'saleKg', label: 'Sale weight, kg', min: 1.5, max: 3.5, step: 0.1 },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/** Clamp and fill a plan's decisions (missing values: the planning sign's figures, 1 house). */
export function cleanPlan(p = {}) {
  const out = {};
  for (const f of PLAN_FIELDS) {
    const d = { houses: 1, birdsPerHouse: PLAN_CONTRACT.houseBirds, cycleDays: PLAN_CONTRACT.growDays + PLAN_CONTRACT.cleanDays + 21,
      lossesPct: PLAN_CONTRACT.lossesHintPct, saleKg: PLAN_CONTRACT.saleKg }[f.key];
    out[f.key] = clamp(num(p[f.key], d), f.min, f.max);
  }
  out.houses = Math.round(out.houses);
  out.birdsPerHouse = Math.round(out.birdsPerHouse);
  out.cycleDays = Math.round(out.cycleDays);
  return out;
}

/**
 * The planning sums.
 * @param {{ houses: number, birdsPerHouse: number, cycleDays: number, lossesPct: number, saleKg: number,
 *   houseM2?: number }} plan  decisions (cleanPlan fills gaps); houseM2: the measured floor of one house
 * @returns {{ chicksPerWeek: number, salePerWeek: number, densityKgM2: number, birdsPerM2: number,
 *   restDays: number, houseM2: number }}
 *   chicksPerWeek = houses x chicks per house x 7 / days per flock
 *   salePerWeek   = chicksPerWeek x (1 - losses)
 *   densityKgM2   = chicks per house x (1 - losses) x sale weight / floor of one house
 *   restDays      = days per flock - 42 growing days - 4 clean-out days
 */
export function planSums(plan = {}, houseM2 = plan.houseM2 ?? PLAN_CONTRACT.houseM2Drawings) {
  const p = cleanPlan(plan);
  const keep = 1 - p.lossesPct / 100;
  const m2 = Math.max(1, num(houseM2, PLAN_CONTRACT.houseM2Drawings));
  const chicksPerWeek = (p.houses * p.birdsPerHouse * 7) / p.cycleDays;
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    chicksPerWeek: r1(chicksPerWeek),
    salePerWeek: r1(chicksPerWeek * keep),
    densityKgM2: Math.round(((p.birdsPerHouse * keep * p.saleKg) / m2) * 100) / 100,
    birdsPerM2: Math.round(((p.birdsPerHouse * keep) / m2) * 100) / 100,
    restDays: p.cycleDays - PLAN_CONTRACT.growDays - PLAN_CONTRACT.cleanDays,
    houseM2: m2,
  };
}

/**
 * The company's reply (PHASE3.md §6.11, the level's key target): the plan run through the contract's terms,
 * as plain lines. The terms (on the contract letter, general): the company counts at least
 * PLAN_CONTRACT.lossesMinPct losses (or the farmer's own figure if it is higher); at least
 * PLAN_CONTRACT.restMinDays days of rest between flocks; at most PLAN_CONTRACT.houseBirds chicks a house
 * (its drinkers and feeders); at most densityMaxKgM2 kg/m² at catching; and at least salePerWeek birds for
 * sale every week. `pass` = every term met. Accepts the decisions (planSums runs on them) or a sent plan's
 * `{ decisions, sums }`. Nothing here is a verdict: the reply shows each number beside its term.
 * @returns {{ pass: boolean, lossesCountedPct: number, salePerWeek: number, contractPerWeek: number,
 *   densityKgM2: number, densityMaxKgM2: number, restDays: number, restMinDays: number, birdsPerHouse: number,
 *   houseBirds: number, chicksPerWeek: number, overPct: number,
 *   terms: { key: 'salePerWeek'|'density'|'rest'|'houseBirds', value: number, limit: number, met: boolean }[] }}
 */
export function planOutcome(plan, houseM2, contract = PLAN_CONTRACT) {
  const decisions = cleanPlan(plan && plan.decisions ? plan.decisions : plan);
  const m2 = houseM2 ?? (plan && plan.sums ? plan.sums.houseM2 : undefined) ?? plan?.houseM2 ?? contract.houseM2Drawings;
  const lossesCountedPct = Math.max(decisions.lossesPct, contract.lossesMinPct);
  const s = planSums({ ...decisions, lossesPct: lossesCountedPct }, m2);
  const terms = [
    { key: 'salePerWeek', value: s.salePerWeek, limit: contract.salePerWeek, met: s.salePerWeek >= contract.salePerWeek - 1e-9 },
    { key: 'density', value: s.densityKgM2, limit: contract.densityMaxKgM2, met: s.densityKgM2 <= contract.densityMaxKgM2 + 1e-9 },
    { key: 'rest', value: s.restDays, limit: contract.restMinDays, met: s.restDays >= contract.restMinDays },
    { key: 'houseBirds', value: decisions.birdsPerHouse, limit: contract.houseBirds, met: decisions.birdsPerHouse <= contract.houseBirds },
  ];
  return { pass: terms.every((t) => t.met), lossesCountedPct, salePerWeek: s.salePerWeek, contractPerWeek: contract.salePerWeek,
    densityKgM2: s.densityKgM2, densityMaxKgM2: contract.densityMaxKgM2, restDays: s.restDays, restMinDays: contract.restMinDays,
    birdsPerHouse: decisions.birdsPerHouse, houseBirds: contract.houseBirds, chicksPerWeek: s.chicksPerWeek,
    overPct: Math.round((s.salePerWeek / contract.salePerWeek - 1) * 1000) / 10, terms };
}
