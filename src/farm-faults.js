// Faults of the level 3 automation (SKILLS.md §5): rare, realistic, winnable — a winch motor stalling, the controller
// restarting on its first timer setting, the fan stage output tripping (in the rainy season off after every power cut),
// the temperature sensor drifting, a feed order lost, the bird scale's platform fouled. Pure logic. Owner: package "model".
// STUB of the design round (revised after the review): the shapes and the hooks are the contract; the plan's draw, the
// effects and the fixes come with the package (config FAULTS, FAULT_PLAN hold the numbers).
//
// ONE rule for the plan (SKILLS.md §5.2):
//   planFaults(farm, env, { flockNo })   at the brooding week's farm.start only (farm-auto.js installAuto calls it; a later
//                                level's enterLevel draws nothing): FAULT_PLAN[farm.condition || 'normal'] from
//                                createRng(farm.seed x FAULT_PLAN.rngMul + flockNo) — never farm.rng, so every Phase 1–5
//                                trace is unchanged — into farm.auto.faults as items { id: null, system: null, phase:
//                                'planned', at } (at: env.day; flock days FAULT_PLAN.window.fromDay..toDay, not on notDays,
//                                minGapDays apart, inside window.hours). Saved with the farm: a replay or a resume keeps it.
//   stepFaults(farm, env, hrs)   an item whose time has come (and quietN 0, no fault open): the fault is picked among the
//                                systems on now by the plan's weights, each fault's own FAULTS[id].hours / days holding
//                                (else the next system; none on: 'dropped'). order-lost arms then: the next automatic order
//                                within FAULTS['order-lost'].armH is never confirmed (no order in that time: 'dropped').
//                                Runs an open fault (the drift's rise, the order's red after redAfterH, the controllers'
//                                retries: timer-reset retryH, stage-trip retryH from its start — the bound), fixes it when
//                                its fix action was done by the farmer (FAULTS[id].fix) or the retry came; emits EV.FAULT
//                                { id, system, phase, text, cause, sign, place, spot, line?, day, hour } on 'start' /
//                                'found' / 'fixed' / 'dropped' (the flock watch's Equipment row and warning read
//                                farm.auto.faults). The rainy season's after-cut stage trip (FAULT_PLAN.rainy.afterCut,
//                                farm-cond-power.js EV.POWER on while stages is on) is an item { afterCut: true } outside
//                                the plan's max and the "one open" rule.
//   openFaults(farm)             the faults with phase 'open'
//   faultWords(fault, env, farm) { what, cause, place, fix } in plain words (the watch, the night check, the job card, records)
//   installFaultDebug(farm, env) farm.debug.fault(id, { line?, at? }) starts a fault now (harness and node tests; the
//                                system need not be on); farm.debug.faults() lists them
import { FAULTS } from './config.js';

export function planFaults(farm, env, opts = {}) { void env; void opts; if (farm.auto) farm.auto.faults = []; return []; }   // STUB: no faults planned
export function stepFaults(farm, env, hrs) { void farm; void env; void hrs; }
export const openFaults = (farm) => (farm.auto?.faults || []).filter((f) => f.phase === 'open');

/** Plain words of a fault for the watch, the night check and the records. STUB: the config's `what` only. */
export function faultWords(fault, env, farm) {
  void env; void farm;
  const F = FAULTS[fault?.id] || {};
  return { what: F.what || 'Equipment fault', cause: '', place: '', fix: '' };
}

export function installFaultDebug(farm, env) {
  if (!farm.debug) return;
  /** Start a fault now (SKILLS.md §13.2). STUB: records it as open with no effect on the model. */
  farm.debug.fault = (id, opts = {}) => {
    const F = FAULTS[id];
    if (!F || !farm.auto) return null;
    const f = { id, system: F.system, phase: 'open', at: env.day, startedAt: env.day, foundAt: F.selfKnown ? env.day : null, fixedAt: null, args: { ...opts }, stub: true };
    farm.auto.faults.push(f);
    return { ...f };
  };
  farm.debug.faults = () => (farm.auto?.faults || []).map((f) => ({ ...f }));
}
