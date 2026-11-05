// Faults of the level 3 automation (SKILLS.md §5): rare, realistic, winnable — a winch motor stalling, the controller
// restarting on its first timer setting, the fan stages tripping (in the rainy season off after every power cut), the
// temperature sensor drifting, a feed order lost, the bird scale's platform fouled. Pure logic. Owner: package "model".
// STUB of the design round: the shapes and the hooks are the contract; the plan, the effects and the fixes come with the
// package (config FAULTS, FAULT_PLAN hold the numbers).
//
//   planFaults(farm, env)        at farm.start of a flock: the flock's fault times (FAULT_PLAN[condition || 'normal']), from
//                                createRng(seed x FAULT_PLAN.rngMul + flock) — never farm.rng, so every Phase 1–5 trace is
//                                unchanged — into farm.auto.faults as { id: null, phase: 'planned', at } (the id is picked at
//                                its time among the systems on then, by the plan's weights; none on: 'dropped')
//   stepFaults(farm, env, hrs)   start a planned fault at its time (inside its window: FAULT_PLAN.window, FAULTS[id].hours /
//                                days); run an open one (the drift's rise, the order's red after redAfterH, the timer's retry);
//                                fix it when its fix action was done (FAULTS[id].fix) or its reading is back; emits EV.FAULT
//                                { id, system, phase, text, cause, sign, place, spot, line?, day, hour } on 'start' / 'found' /
//                                'fixed' / 'dropped' (the flock watch's Equipment row and warning read farm.auto.faults)
//   openFaults(farm)             the faults with phase 'open'
//   faultWords(fault, env, farm) { what, cause, place, fix } in plain words (the watch, the night check, the job card, records)
//   installFaultDebug(farm, env) farm.debug.fault(id, { line?, at? }) starts a fault now (harness and node tests; the
//                                system need not be on); farm.debug.faults() lists them
import { FAULTS } from './config.js';

export function planFaults(farm, env) { void env; if (farm.auto) farm.auto.faults = []; return []; }   // STUB: no faults planned
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
