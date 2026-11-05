// The farm's level 3 automation (SKILLS.md §4): the controllers that take routine jobs over — the drinker winches, the
// minimum ventilation timer, the tunnel fan stages, the brooders' thermostat, the feed orders and feeder rims, the light
// program, the automatic bird scale. Pure logic (node and browser). Owner: package "model". STUB of the design round: the
// state, the shapes and the wiring are the contract (installAuto is called by farm.js; level.js sets farm.auto.on); the
// controllers themselves, adviseFans and the actions' effects come with the package.
//
// installAuto(farm, env) adds farm.auto and wraps farm.step / act / start / serialize / restore (the pattern of
// farm-cond.js installConditions):
//   farm.auto            plain data only (runCycle's snapshots structuredClone every farm field):
//     .on                { [system]: bool } set by level.js from perks.auto(system) at every start, resume, EV.PERKS and
//                        EV.SETTINGS; never set by runCycle / runProfile (every node profile plays by hand unless a test asks)
//     .hold              { [system]: env.day the farmer's own setting holds until } (config AUTO.handHold)
//     .last              { [system]: the last EV.AUTO payload }
//     .faults            [{ id, system, phase: 'planned'|'open'|'fixed'|'dropped', at, startedAt, foundAt, fixedAt, args }]
//                        (farm-faults.js plans and runs them; saved here)
//     .drift             °C the controller's sensor reads over the house (sensor-drift; 0 = calibrated)
//     .quietN            > 0 while goto(auto) or a standard start plays the ideal: no controller acts, no fault starts
//   farm.autoCtl         the API (a getter, not state):
//     .quiet(on)         quietN + / − 1
//     .ok(system, inst?) the system on, no open fault of it, and its reading in the job's band (job-engine 'auto-ok')
//     .status()          { on, systems: { [system]: { state: 'running'|'held'|'fault'|'off', text, since } }, faults, last }
//     .sensorC()         what the controller's sensor reads (env.houseTemp + drift): the LCD and the thermostat read this
// Every controller step goes through farm.act(id, { ...args, by: 'auto', quiet: true }) (no EV.ACTION: no job counts it as
// the farmer's press) and emits EV.AUTO { system, did, text, args, day, hour } once per change.
// The actions of SKILLS.md §12.2 routed here first (autoAct; results are the contract shapes):
//   auto.reset { system, line? }   -> { reset: bool, system, line? }        a stalled winch / tripped stages back on
//   auto.calibrate {}              -> { offsetC, sensorC, houseC }           the sensor set to the thermometer (drift 0)
//   scale.read { day? }            -> { day, n, meanG, uniformityPct, fouled } the automatic scale's figures of the day
//   scale.clean {}                 -> { cleaned: bool }                      the platform cleaned (scale-fouled fixed)
//   (auto.glance is ui-only: the farm sees it on the bus; farm-faults may mark a selfKnown fault found by it)
import { AUTO_SYSTEMS } from './config.js';
import { EV } from './events.js';
import { planFaults, stepFaults, openFaults, installFaultDebug } from './farm-faults.js';

export const AUTO_ACTION_IDS = new Set(['auto.reset', 'auto.calibrate', 'scale.read', 'scale.clean']);
const SYSTEMS = Object.keys(AUTO_SYSTEMS);
const fresh = () => ({ hold: {}, last: {}, faults: [], drift: 0 });

/**
 * The controllers' advice for the tunnel fans and the pad now (Ventilation 2's suggestion, Ventilation 3's stages):
 * { fans, pad, why } by the heat sign's rules for the age (the ideal's idealFans / idealPad / fansForFeel / eveningPad).
 * STUB: the fans and pad as they are (the package writes the rules).
 */
export function adviseFans(env, farm) {
  void farm;
  return { fans: env.fansManual ?? 0, pad: !!env.padOn, why: '' };
}

/** The pre-heat hours to bring the floor to 28 °C with the brooders at full (Heating 2's readout). STUB: null. */
export function preheatHours(env, farm) { void env; void farm; return null; }

/** The controllers' step (every farm step, after the model): STUB, nothing acts. */
export function stepAuto(farm, env, hrs) {
  if (farm.mode !== 'level' || farm.auto.quietN > 0) return;   // goto(auto) / a standard start: the ideal plays by hand
  stepFaults(farm, env, hrs);
}

/** The actions of AUTO_ACTION_IDS (else undefined). STUB: the result shapes, no state change. */
export function autoAct(farm, env, id, a = {}) {
  switch (id) {
    case 'auto.reset': return { reset: false, system: a.system ?? null, ...(a.line != null ? { line: a.line } : {}) };
    case 'auto.calibrate': return { offsetC: 0, sensorC: +env.houseTemp.toFixed(1), houseC: +env.houseTemp.toFixed(1) };
    case 'scale.read': return { day: a.day ?? env.dayNumber, n: 0, meanG: null, uniformityPct: null, fouled: false };
    case 'scale.clean': return { cleaned: false };
    default: return undefined;
  }
}

export function installAuto(farm, env) {
  farm.auto = { on: Object.fromEntries(SYSTEMS.map((s) => [s, false])), ...fresh(), quietN: 0 };
  const A = () => farm.auto;
  const api = {
    quiet(on) { const a = A(); a.quietN = Math.max(0, (a.quietN || 0) + (on ? 1 : -1)); return a.quietN > 0; },
    ok(system, inst) { void inst; return !!A().on[system] && !openFaults(farm).some((f) => f.system === system) && false; },   // STUB: never in band
    sensorC() { return env.houseTemp + (A().drift || 0); },
    status() {
      const a = A();
      return { on: { ...a.on }, systems: Object.fromEntries(SYSTEMS.map((s) => [s, { state: a.on[s] ? 'running' : 'off', text: '', since: null }])),
        faults: openFaults(farm).map((f) => ({ ...f })), last: { ...a.last } };
    },
  };
  Object.defineProperty(farm, 'autoCtl', { get: () => api, enumerable: false, configurable: true });

  const step = farm.step, act = farm.act, start = farm.start, serialize = farm.serialize, restore = farm.restore;
  farm.step = (e, gameSeconds) => { step(e, gameSeconds); if (farm.mode === 'level' && gameSeconds > 0) stepAuto(farm, e, gameSeconds / 3600); };
  farm.act = (id, args = {}) => {
    if (!AUTO_ACTION_IDS.has(id)) return act(id, args);
    const result = autoAct(farm, env, id, args);
    if (!args.quiet && farm.emit) farm.emit(EV.ACTION, { id, ...args, result });
    return result;
  };
  farm.start = (...a) => { const r = start(...a); Object.assign(farm.auto, fresh(), { quietN: 0, on: Object.fromEntries(SYSTEMS.map((s) => [s, false])) }); planFaults(farm, env); return r; };
  farm.serialize = () => { const a = A(); return { ...serialize(), auto: { hold: { ...a.hold }, last: { ...a.last }, faults: a.faults.map((f) => ({ ...f })), drift: a.drift || 0 } }; };
  farm.restore = (d) => {
    restore(d);
    const s = d && d.auto, a = A();
    Object.assign(a, fresh(), s ? { hold: { ...(s.hold || {}) }, last: { ...(s.last || {}) }, faults: (s.faults || []).map((f) => ({ ...f })), drift: s.drift || 0 } : {});
  };
  installFaultDebug(farm, env);
  return api;
}
