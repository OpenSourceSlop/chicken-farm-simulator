// Faults of the level 3 automation (SKILLS.md §5): rare, realistic, winnable — a winch motor stalling, the controller
// restarting on its first timer setting, the fan stage output tripping (in the rainy season off after every power cut),
// the temperature sensor drifting, a feed order lost, the bird scale's platform fouled. Pure logic. Owner: package "model".
// Config FAULTS, FAULT_PLAN hold the numbers (model values; the sign lines that name them are general practice).
//
// ONE rule for the plan (SKILLS.md §5.2):
//   planFaults(farm, env, { flockNo })   at the brooding week's farm.start only, while SKILLS_UPDATE.live (with the switch
//                                off the farm is Phase 5's: no plan): FAULT_PLAN[farm.condition || 'normal'] from
//                                createRng(seed x rngMul + flockNo) — never farm.rng — into farm.auto.faults as items
//                                { id: null, system: null, phase: 'planned', at } (flock days window.fromDay..toDay, not on
//                                notDays, minGapDays apart, inside window.hours). Saved with the farm.
//   stepFaults(farm, env, hrs)   an item whose time has come (quietN 0, no fault open or armed): the fault is picked among
//                                the systems on now by the plan's weights, each fault's own hours / days holding; none ->
//                                'dropped'. order-lost arms ('armed') and hits the next automatic order within armH
//                                ('hit' -> 'open'); none -> 'dropped'. An item due while a fault is open waits (to the next
//                                window hour; past toDay dropped); one whose time passes while quietN > 0 is dropped
//                                (dropQuiet). Runs the open faults (the drift's rise, the order's red, the retries) and the
//                                rainy season's after-cut trip (afterCut: outside the plan's max and the one-open rule).
//   faultHand / faultAct         the farmer's hand: the fixes of FAULTS[id].fix (the drift by auto.calibrate only)
//   openFaults(farm)             the faults with phase 'open'
//   faultWords(fault, env, farm) { what, cause, place, fix, sign, spot } in plain words (the watch, the night check, records)
//   installFaultDebug(farm, env) farm.debug.fault(id, { line?, at? }) starts a fault now (the system need not be on);
//                                farm.debug.faults() lists them
// EV.FAULT { id, system, phase: 'start'|'found'|'fixed'|'dropped', text, cause, sign, place, spot, line?, day, hour, alarm? }
import { FAULTS, FAULT_PLAN, AUTO, SKILLS_UPDATE, PLACEMENT_DAY, nippleHeightCmAt } from './config.js';
import { EV } from './events.js';
import { createRng } from './farm-rng.js';
import { timerFor, rowFor } from './farm-auto-ctl.js';
import { feedDays } from './farm-silos.js';

const H = 1 / 24;
const int = (v) => Math.round(v).toLocaleString('en-US');
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
const hhmm = (t) => { const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const openFaults = (farm) => (farm.auto?.faults || []).filter((f) => f.phase === 'open');
/** A fault that holds the plan's "one at a time" (open, armed or hit; the rainy season's after-cut trips are exempt). */
const busy = (farm) => (farm.auto?.faults || []).some((f) => (f.phase === 'open' || f.phase === 'armed' || f.phase === 'hit') && !f.afterCut);
const inHours = (h, [a, b]) => h >= a - 1e-9 && h < b - 1e-9;
const planOf = (farm) => FAULT_PLAN[farm.condition || 'normal'] || FAULT_PLAN.normal;

/** Draw the flock's plan (see the header). Returns the items. */
export function planFaults(farm, env, opts = {}) {
  if (!farm.auto) return [];
  farm.auto.faults = [];
  if (!SKILLS_UPDATE.live) return [];
  const P = planOf(farm), W = FAULT_PLAN.window, rng = createRng(((farm.seed || 1) * FAULT_PLAN.rngMul + (opts.flockNo || 0)) >>> 0);
  const n = P.chance >= 1 ? P.max : rng.next() < P.chance ? Math.min(1, P.max) : 0;
  const days = [];
  for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
    const d = W.fromDay + Math.floor(rng.next() * (W.toDay - W.fromDay + 1));
    if (W.notDays.includes(d) || days.some((x) => Math.abs(x - d) < W.minGapDays)) continue;
    days.push(d); k++;
  }
  days.sort((a, b) => a - b);
  farm.auto.faults = days.map((d) => ({ id: null, system: null, phase: 'planned', at: +(d + (W.hours[0] + rng.next() * (W.hours[1] - W.hours[0])) * H).toFixed(5), startedAt: null, foundAt: null, fixedAt: null, args: {} }));
  return farm.auto.faults.map((f) => ({ ...f }));
}

/** The planned items whose time passed while the ideal played quietly (a standard start, goto(auto)) are dropped. */
export function dropQuiet(farm, env) {
  for (const f of farm.auto?.faults || []) if ((f.phase === 'planned' && f.at <= env.day + 1e-9) || f.phase === 'armed') drop(farm, env, f, 'quiet');
}
function drop(farm, env, f, why) {
  f.phase = 'dropped'; f.droppedAt = +env.day.toFixed(5); f.why = why;
  emitFault(farm, env, f, 'dropped');
}

// ---------------- the words (SKILLS.md §5.1, §5.3) ----------------
const lineN = (f) => (f.args && Number.isFinite(f.args.line) ? f.args.line : 0);
export function faultWords(f, env, farm) {
  const F = FAULTS[f?.id] || {}, t0 = f?.startedAt ?? env.day;
  switch (f?.id) {
    case 'winch-stall': {
      const L = lineN(f), cm = Math.round(farm.water.lines[L]?.heightCm ?? f.args.cm ?? 0), plate = Math.round(nippleHeightCmAt(Math.max(0, env.dayNumber)));
      return { what: `Line ${L + 1} winch motor stalled at ${Math.round(f.args.cm ?? cm)} cm (plate ${plate} cm) at ${hhmm(t0)}; the other lines go on rising.`, cause: 'the winch motor tripped its overload', place: `the drinker line ${L + 1} regulator`,
        fix: 'winch it by hand to the drinker plate’s height and reset the motor', sign: 'drinker', spot: `drinkers.${L}`, panel: `drinker-${L}`, tab: null, line: L, night: `Line ${L + 1}’s winch motor is stalled at ${cm} cm; the drinker plate says ${plate} cm tonight and ${Math.round(nippleHeightCmAt(Math.max(0, env.dayNumber + 1)))} cm tomorrow.` };
    }
    case 'timer-reset': {
      const t = timerFor(env, farm, 1), s = F.firstSetting || { fans: 1, onSec: 8, cycleSec: 300 };
      return { what: `The controller restarted on its first timer setting at ${hhmm(t0)}: ${s.fans} fan ${s.onSec} s / ${s.cycleSec} s against the vent sign’s ${t.onSec} s for your birds.`, cause: 'a power blip restarted the controller',
        place: 'the climate controller’s Ventilation tab', fix: 'set the timer by hand or Fill the timer; the controller then steps on from your setting', sign: 'sign-vent', spot: 'controller', panel: 'controller', tab: 'vent' };
    }
    case 'stage-trip': return { what: `The fan stages are off since ${hhmm(t0)}; the fans run at ${env.fansManual ?? f.args.fans ?? 0}.`, cause: f.afterCut ? 'the controller came back from the power cut with its stages off' : 'the stage output tripped after a power blip',
      place: 'the fan panel at the east end', fix: 'set the fans by hand and switch the stages on again (Set the stages)', sign: 'fan-panel', spot: 'fanPanel', panel: 'fan-panel', tab: null };
    case 'sensor-drift': {
      const d = farm.auto?.drift || 0;
      return { what: `The controller’s sensor reads ${one(d)} °C over the house thermometer: the brooders hold the house ${one(d)} °C under the row.`, cause: 'the controller’s temperature sensor reads high',
        place: 'the thermometer beside the climate controller', fix: 'Check the sensor against the thermometer on the Temperature tab', sign: 'sign-brooder', spot: 'controller', panel: 'controller', tab: 'temp',
        night: `The controller’s sensor reads ${one(d)} °C over the house thermometer: the brooders hold the house ${one(d)} °C under the row tonight.` };
    }
    case 'order-lost': {
      const fd = feedDays(farm, env), at = f.args.at ?? t0, late = env.hour >= 16;
      const due = late ? 'comes the day after tomorrow at 09:00' : 'comes tomorrow at 09:00';
      return { what: `The feed order of ${hhmm(at)} is not confirmed by the mill: ${fd.days != null ? one(fd.days) : '?'} days of feed in the silos.`, cause: 'the controller’s order never reached the mill: no truck is coming',
        place: 'the silo gauge, or the phone', fix: 'order by hand: the office phone, the pocket phone or the silo gauge', sign: 'silo', spot: 'silo', panel: 'pocket-phone', tab: null, orPanel: 'office',
        night: `The feed order of ${hhmm(at)} is not confirmed: ${fd.days != null ? one(fd.days) : '?'} days of feed in the silos. Ordered now${late ? ' (after 16:00)' : ''} the feed ${due}.` };
    }
    case 'scale-fouled': {
      const s = farm.autoCtl?.scale?.() || { n: 0 };
      return { what: `Bird scale: ${int(s.n)} weighings today, about ${int(AUTO.scalePerDay)} before.`, cause: 'litter on the scale’s platform: it reads light and counts few birds', place: 'the bird scale',
        fix: 'clean the platform and weigh by hand', sign: 'bird-scale', spot: 'birdScale', panel: 'bird-scale', tab: null };
    }
    default: return { what: F.what || 'Equipment fault', cause: '', place: '', fix: '', sign: F.plate || '', spot: F.spot || '' };
  }
}
function emitFault(farm, env, f, phase, extra = {}) {
  if (!farm.emit) return;
  const w = f.id ? faultWords(f, env, farm) : { what: 'A planned equipment fault did not happen', cause: '', place: '', sign: '', spot: '' };
  const text = phase === 'fixed' ? fixedText(farm, env, f) : phase === 'dropped' ? `No fault: ${f.why || 'nothing on to fail'}` : `${w.what} Look at ${w.place}: ${w.fix}.`;
  farm.emit(EV.FAULT, { id: f.id, system: f.system, phase, text, cause: w.cause, sign: w.sign, place: w.place, spot: w.spot, ...(f.args && Number.isFinite(f.args.line) ? { line: f.args.line } : {}),
    day: env.dayNumber, hour: Math.round(env.hour * 100) / 100, ...(f.afterCut ? { afterCut: true } : {}), ...extra });
}
function fixedText(farm, env, f) {
  const at = hhmm(env.day), by = f.fixedBy === 'retry';
  switch (f.id) {
    case 'winch-stall': return `Line ${lineN(f) + 1} winched by hand to ${Math.round(farm.water.lines[lineN(f)]?.heightCm ?? 0)} cm; the motor reset ${at}`;
    case 'timer-reset': return by ? `The controller’s own retry put the timer back on the table at ${at}` : `Timer set by hand at ${at}; the controller steps on from it`;
    case 'stage-trip': return by ? `The controller’s retry switched the fan stages on again at ${at}` : `Fan stages on again at ${at}`;
    case 'sensor-drift': return `Sensor checked against the thermometer at ${at}: ${one(f.args.offsetC ?? 0)} °C taken off`;
    case 'order-lost': return `Feed ordered by hand at ${at}`;
    case 'scale-fouled': return `Bird scale platform cleaned at ${at}`;
    default: return `Fixed at ${at}`;
  }
}

// ---------------- a fault starts, runs and is fixed ----------------
/** The fault's effect on the farm at its start (the system's own controller then holds off: farm-auto-ctl isOpen). */
export function startFault(farm, env, f, id, args = {}) {
  const F = FAULTS[id], A = farm.auto;
  Object.assign(f, { id, system: F.system, phase: 'open', startedAt: +env.day.toFixed(5), foundAt: F.selfKnown ? +env.day.toFixed(5) : null, fixedAt: null, args: { ...(f.args || {}), ...args } });
  switch (id) {
    case 'winch-stall': {
      const L = Number.isFinite(args.line) ? Math.max(0, Math.min(3, Math.round(args.line))) : Math.floor(((f.at || env.day) * 997) % 4);
      f.args.line = L; f.args.cm = Math.round(farm.water.lines[L].heightCm);
      break;
    }
    case 'timer-reset': { f.args.prev = { ...(farm.vent || {}) }; farm.act('vent.timer', { ...F.firstSetting, by: 'auto', quiet: true }); break; }
    case 'stage-trip': {
      f.args.fans = env.fansManual ?? 0;
      if (env.fanStages) farm.act('vent.stages', { stages: null, by: 'auto', quiet: true });
      if (A.mem) A.mem.stagesKey = null;
      break;
    }
    case 'sensor-drift': if (A.setC == null) A.setC = env.heaterSetpoint; break;
    case 'order-lost': f.phase = 'armed'; f.armedAt = +env.day.toFixed(5); f.startedAt = null; f.foundAt = null; return f;
    default: break;
  }
  emitFault(farm, env, f, 'start');
  return f;
}
export function fixFault(farm, env, f, by = 'hand', extra = {}) {
  if (!f || f.phase !== 'open') return false;
  const A = farm.auto;
  f.phase = 'fixed'; f.fixedAt = +env.day.toFixed(5); f.fixedBy = by; Object.assign(f.args, extra);
  if (f.foundAt == null) f.foundAt = f.fixedAt;
  if (f.id === 'sensor-drift') { const c = A.setC ?? env.heaterSetpoint; A.drift = 0; if (!env.broodersUp) env.setHeaterSetpoint(c); }
  if (f.id === 'stage-trip' || f.id === 'timer-reset') { if (A.mem) { A.mem.stagesKey = null; if (by === 'retry') A.mem.timerBirds = null; } }
  if (f.id === 'timer-reset' && by === 'retry') { delete A.hold.timer; }
  emitFault(farm, env, f, 'fixed');
  return true;
}
/** The farmer's hand (not by 'auto'): the fixes of FAULTS[id].fix that are farm actions. */
export function faultHand(farm, env, id, a = {}) {
  for (const f of openFaults(farm)) {
    if (f.id === 'winch-stall' && id === 'water.height' && Math.round(a.line ?? -1) === lineN(f)) { f.args.handCm = a.cm; f.args.handAt = +env.day.toFixed(5); }
    if (f.id === 'timer-reset' && id === 'vent.timer') fixFault(farm, env, f, 'hand');
    if (f.id === 'stage-trip' && id === 'vent.stages' && a.stages) fixFault(farm, env, f, 'hand');
    if (f.id === 'order-lost' && id === 'feed.order' && (a.kg ?? 0) > 0) fixFault(farm, env, f, 'hand');
  }
}
/** The fix keys that are AUTO_ACTION_IDS (auto.reset, auto.calibrate, scale.clean) and the scale's read (finds a fouling). */
export function faultAct(farm, env, id, a = {}) {
  const open = openFaults(farm);
  if (id === 'auto.reset') {
    const f = open.find((x) => (x.id === 'winch-stall' && (a.system == null || a.system === 'winch') && (a.line == null || Math.round(a.line) === lineN(x))) || (x.id === 'stage-trip' && (a.system == null || a.system === 'stages')));
    return { fixed: f ? fixFault(farm, env, f, 'hand') : false };
  }
  if (id === 'auto.calibrate') {
    const f = open.find((x) => x.id === 'sensor-drift'), off = farm.auto.drift || 0;
    return { fixed: f ? fixFault(farm, env, f, 'hand', { offsetC: off }) : false, offsetC: off };
  }
  if (id === 'scale.clean') { const f = open.find((x) => x.id === 'scale-fouled'); return { fixed: f ? fixFault(farm, env, f, 'hand') : false }; }
  if (id === 'scale.read') { const f = open.find((x) => x.id === 'scale-fouled' && x.foundAt == null); if (f) { f.foundAt = +env.day.toFixed(5); emitFault(farm, env, f, 'found'); } }
  return null;
}

/** The fault a planned item becomes now: among the systems on, by the plan's weights, its own hours / days holding. */
function pick(farm, env, item, k) {
  const P = planOf(farm), W = P.weights || {}, A = farm.auto, h = env.hour, day = env.dayNumber;
  const ids = Object.keys(FAULTS).filter((id) => {
    const F = FAULTS[id];
    if (!A.on[F.system] || !inHours(h, F.hours)) return false;
    if (F.days && (day < F.days[0] || day > F.days[1])) return false;
    if (id === 'sensor-drift' && env.broodersUp) return false;
    if (id === 'stage-trip' && !env.fanStages) return false;
    if (id === 'scale-fouled' && !(farm.flock.alive > 0)) return false;
    return true;
  });
  if (!ids.length) return null;
  const w = ids.map((id) => W[id] || 1), sum = w.reduce((a, b) => a + b, 0);
  const rng = createRng(((farm.seed || 1) * FAULT_PLAN.rngMul + 7 + k * 131 + Math.round(item.at * 100)) >>> 0);
  let r = rng.next() * sum;
  for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r < 0) return ids[i]; }
  return ids[ids.length - 1];
}

/** The faults' step (farm-auto.js stepAuto, quietN 0). */
export function stepFaults(farm, env, hrs) {
  const A = farm.auto, W = FAULT_PLAN.window, list = A.faults || [];
  void hrs;
  // the rainy season's trip after each power cut while the stages run (outside the plan)
  const P = planOf(farm), m = A.mem || (A.mem = {});
  const power = env.powerOn !== false;
  if (m.powerWas === false && power && P.afterCut && A.on.stages && SKILLS_UPDATE.live && !list.some((f) => f.phase === 'open' && f.id === 'stage-trip')) {
    const f = { id: null, system: null, phase: 'planned', at: +env.day.toFixed(5), args: {}, afterCut: true };
    list.push(f);
    startFault(farm, env, f, P.afterCut, {});
  }
  m.powerWas = power;
  list.forEach((f, k) => {
    if (f.phase === 'planned' && f.at <= env.day + 1e-9) {
      if (env.dayNumber > W.toDay) { drop(farm, env, f, 'past the window'); return; }
      if (busy(farm) || !inHours(env.hour, W.hours) || W.notDays.includes(env.dayNumber)) return;   // waits for the fix / the next window hour
      const id = pick(farm, env, f, k);
      if (!id) { drop(farm, env, f, 'no controller on to fail'); return; }
      startFault(farm, env, f, id);
      return;
    }
    if (f.phase === 'armed' && env.day - f.armedAt > FAULTS['order-lost'].armH * H + 1e-9) { drop(farm, env, f, 'no automatic order to lose'); return; }
    if (f.phase === 'hit') {
      Object.assign(f, { phase: 'open', startedAt: f.args.at ?? +env.day.toFixed(5), foundAt: f.args.at ?? +env.day.toFixed(5) });
      emitFault(farm, env, f, 'start');
      return;
    }
    if (f.phase !== 'open') return;
    const F = FAULTS[f.id], since = (env.day - f.startedAt) * 24;
    if (f.id === 'sensor-drift') {
      const d = Math.min(F.driftMaxC, F.driftPerH * since);
      if (Math.abs(d - (A.drift || 0)) > 1e-6) { A.drift = d; if (!env.broodersUp && A.setC != null) env.setHeaterSetpoint(A.setC - d); }
      if (f.foundAt == null && d >= F.amberC - 1e-9) { f.foundAt = +env.day.toFixed(5); emitFault(farm, env, f, 'found'); }
      if (env.broodersUp || env.dayNumber > 21) fixFault(farm, env, f, 'retry');   // the brooders up: nothing left to hold
    }
    if (f.id === 'timer-reset' && since >= F.retryH - 1e-9) fixFault(farm, env, f, 'retry');
    if (f.id === 'stage-trip') {
      if (!f.alarmed && env.houseTemp >= env.targetTemp + F.alarmOverC) { f.alarmed = true; emitFault(farm, env, f, 'found', { alarm: true, text: `High temperature alarm: house ${one(env.houseTemp)} °C, ${one(env.houseTemp - env.targetTemp)} °C over the target with the fan stages off.` }); }
      const from = f.afterCut ? (f.powerBackAt ?? f.startedAt) : f.startedAt;
      if (power && (env.day - from) * 24 >= F.retryH - 1e-9) fixFault(farm, env, f, 'retry');
      if (!power) f.powerBackAt = null; else if (f.powerBackAt == null) f.powerBackAt = +env.day.toFixed(5);
    }
    if (f.id === 'order-lost' && !f.red && since >= F.redAfterH - 1e-9) f.red = true;
  });
}
/** The Equipment row's state of an open fault: 'red' (the controller knows, or the drift over redC), 'amber' (a lost order's
 *  first redAfterH hours, the drift over amberC, a fouled scale), 'green' (a drift not over amberC yet). */
export function faultState(farm, env, f) {
  const F = FAULTS[f.id] || {};
  if (f.id === 'sensor-drift') { const d = farm.auto.drift || 0; return d > F.redC + 1e-9 ? 'red' : d > F.amberC + 1e-9 ? 'amber' : 'green'; }
  if (f.id === 'order-lost') return f.red ? 'red' : 'amber';
  if (f.id === 'scale-fouled') return 'amber';
  return 'red';
}

export function installFaultDebug(farm, env) {
  if (!farm.debug) return;
  /** Start a fault now (SKILLS.md §13.2; the harness and node tests): the system need not be on; order-lost arms. */
  farm.debug.fault = (id, opts = {}) => {
    if (!FAULTS[id] || !farm.auto) return null;
    const f = { id: null, system: null, phase: 'planned', at: +env.day.toFixed(5), args: {}, debug: true };
    farm.auto.faults.push(f);
    startFault(farm, env, f, id, opts);
    if (id === 'order-lost') { f.phase = 'open'; f.startedAt = f.foundAt = +env.day.toFixed(5); f.args.at = f.startedAt; emitFault(farm, env, f, 'start'); }
    return { ...f, args: { ...f.args } };
  };
  farm.debug.faults = () => (farm.auto?.faults || []).map((f) => ({ ...f, args: { ...(f.args || {}) } }));
  void PLACEMENT_DAY; void rowFor;
}
