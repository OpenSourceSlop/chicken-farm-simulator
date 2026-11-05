// The farm's level 3 automation (SKILLS.md §4): the controllers that take routine jobs over — the drinker winches, the
// minimum ventilation timer, the tunnel fan stage table, the brooders' thermostat, the feed orders and feeder rims, the
// light program, the automatic bird scale. Pure logic (node and browser). Owner: package "model". STUB of the design round
// (revised after the review): the state, the shapes and the wiring are the contract (installAuto is called by farm.js;
// level.js sets farm.auto.on); the controllers themselves, adviseFans and the actions' effects come with the package.
//
// installAuto(farm, env) adds farm.auto and wraps farm.step / act / start / serialize / restore (the pattern of
// farm-cond.js installConditions):
//   farm.auto            plain data only (runCycle's snapshots structuredClone every farm field):
//     .on                { [system]: bool } set by level.js from perks.auto(system) after EVERY farm.start, enterLevel and
//                        restore, and on EV.PERKS / EV.SETTINGS; farm.start resets it to all false; never set by runCycle /
//                        runProfile (every node profile plays by hand unless a test asks: runCycle's perks option)
//     .hold              the farmer's own settings and until when (env.day; config AUTO.handHold):
//                        { winch: { [line]: until }, feed: { [line]: until }, timer: until, brooders: until,
//                          stages: until (his fans / pad), stagesTable: until (his vent.stages), lights: until }
//     .last              { [system]: the last EV.AUTO payload }
//     .faults            the flock's fault plan and its faults (farm-faults.js; saved here, so a replay keeps the plan):
//                        [{ id: null | faultId, system, phase: 'planned'|'open'|'fixed'|'dropped', at, startedAt, foundAt,
//                           fixedAt, args, afterCut? }]
//     .drift             °C the controller's sensor reads over the house (sensor-drift; 0 = calibrated)
//     .quietN            > 0 while goto(auto) or a standard start plays the ideal: no controller acts, no fault starts.
//                        KEPT by farm.start and farm.restore (run.js holds it around the whole standard start)
//   farm.autoCtl         the API (a getter, not state):
//     .quiet(on)         quietN + / − 1; returns quietN > 0
//     .ok(system, inst?, part?)  the system on, no open fault of it, and its reading in the job part's band (job-engine
//                        'auto-ok' { system, part }: the winch every line ±3 cm of the plate; the timer 90–130 % of the vent
//                        sign's need; the stages the stage table of the age running; the brooders within 1 °C of the row;
//                        the feed an order of the job's type confirmed or on the way, or > 2 days of feed, the rims ±3 cm;
//                        the lights the program of the age; the scale >= 300 weighings today)
//     .status()          { on, systems: { [system]: { state: 'running'|'held'|'fault'|'off', text, since } }, faults, last }
//     .sensorC()         what the controller's sensor reads (env.houseTemp + drift): the LCD and the thermostat read this
// Every controller step goes through farm.act(id, { ...args, by: 'auto', quiet: true }): no EV.ACTION (no job counts it as
// the farmer's press), no problem hook (farm.js act skips actionSymptoms / cycleSymptoms / condSymptoms for by 'auto': no
// problem is found, acted on or fixed by the equipment), and one EV.AUTO { system, did, text, args, day, hour } per change.
// The env-only settings (heat.setpoint, vent.fans, vent.pad are ui-only ids: farm.act has no case for them) are applied
// here for by 'auto' (AUTO_ENV_ACTIONS: env.setHeaterSetpoint(c), env.setFans(n), env.setPad(on)).
// The actions of SKILLS.md §12.2 routed here first (autoAct; results are the contract shapes):
//   auto.reset { system, line? }   -> { reset: bool, system, line? }        a stalled winch / tripped stages back on
//   auto.calibrate {}              -> { offsetC, sensorC, houseC }           the sensor set to the thermometer (drift 0)
//   scale.read { day? }            -> { day, n, meanG, uniformityPct, fouled } the automatic scale's figures of the day
//   scale.clean {}                 -> { cleaned: bool }                      the platform cleaned (scale-fouled fixed)
//   water.columns {}               -> { lines: [{ line, cm, markCm, inBand }] } the sight tubes (Water 2): each line's water
//                                     column against the drinker plate's mark for the day; every line keeps lastColumn
//                                     { cm, inBand, at } (r-drinkers counts a line in band as tested, SKILLS.md §3.1)
//   (auto.glance is ui-only: the farm sees it on the bus; farm-faults may mark a selfKnown fault found by it)
import { AUTO_SYSTEMS, LEVEL1, flowTargetAt } from './config.js';
import { EV } from './events.js';
import { WATER, lineFlow } from './farm-water.js';
import { planFaults, stepFaults, openFaults, installFaultDebug } from './farm-faults.js';

export const AUTO_ACTION_IDS = new Set(['auto.reset', 'auto.calibrate', 'scale.read', 'scale.clean', 'water.columns']);
/** The ui-only setting ids a controller sends (applied to env here, by 'auto' only). */
export const AUTO_ENV_ACTIONS = new Set(['heat.setpoint', 'vent.fans', 'vent.pad']);
const SYSTEMS = Object.keys(AUTO_SYSTEMS);
const fresh = () => ({ hold: { winch: {}, feed: {} }, last: {}, faults: [], drift: 0 });
const allOff = () => Object.fromEntries(SYSTEMS.map((s) => [s, false]));
/** The sight tubes' band: ±1.5 cm of water column = ±3 ml/min at WATER.flowPerCm 2 (the drinker plate's band). */
export const COLUMN_BAND_CM = 1.5;

/**
 * The controllers' advice for the tunnel fans and the pad now (Ventilation 2's suggestion, Ventilation 3's stage table):
 * { fans, pad, why, row } by the heat sign's rules for the age (the ideal's idealFans / idealPad / fansForFeel / eveningPad,
 * moved into one module both the profiles and the controller import). why: the working in words for the strip ("heat sign,
 * day 25, felt 27.0 °C -> 4 fans, pad off"). STUB: the fans and pad as they are.
 */
export function adviseFans(env, farm) {
  void farm;
  return { fans: env.fansManual ?? 0, pad: !!env.padOn, why: '', row: null };
}

/** The sight tubes now (water.columns): the column each line holds against the plate's mark for the day. */
export function columnsNow(farm, env) {
  const water = farm.water, age = Math.max(0, env.dayNumber);
  const markCm = (flowTargetAt(age) - WATER.flowBase) / WATER.flowPerCm;
  return water.lines.map((l, i) => {
    // the column the regulator holds: its own setting, lower with a blocked filter or a weak supply (the nipples' own
    // blockage, l.flowK, does not show on a sight tube)
    const cm = (lineFlow({ ...water, lines: water.lines.map((x) => ({ ...x, flowK: undefined })) }, i) - WATER.flowBase) / WATER.flowPerCm;
    return { line: i, cm: Math.round(cm * 10) / 10, markCm: Math.round(markCm * 10) / 10, inBand: Math.abs(cm - markCm) <= COLUMN_BAND_CM + 1e-9 };
  });
}

/** The controllers' step (every farm step, after the model): STUB, nothing acts. */
export function stepAuto(farm, env, hrs) {
  if (farm.mode !== 'level' || farm.auto.quietN > 0) return;   // goto(auto) / a standard start: the ideal plays by hand
  stepFaults(farm, env, hrs);
}

/** The actions of AUTO_ACTION_IDS (else undefined). STUB: the result shapes; water.columns reads the model. */
export function autoAct(farm, env, id, a = {}) {
  switch (id) {
    case 'auto.reset': return { reset: false, system: a.system ?? null, ...(a.line != null ? { line: a.line } : {}) };
    case 'auto.calibrate': return { offsetC: 0, sensorC: +env.houseTemp.toFixed(1), houseC: +env.houseTemp.toFixed(1) };
    case 'scale.read': return { day: a.day ?? env.dayNumber, n: 0, meanG: null, uniformityPct: null, fouled: false };
    case 'scale.clean': return { cleaned: false };
    case 'water.columns': {
      const lines = columnsNow(farm, env), at = +env.day.toFixed(5);
      lines.forEach((c) => { farm.water.lines[c.line].lastColumn = { cm: c.cm, inBand: c.inBand, at }; });
      return { lines };
    }
    default: return undefined;
  }
}

export function installAuto(farm, env) {
  farm.auto = { on: allOff(), ...fresh(), quietN: 0 };
  const A = () => farm.auto;
  const api = {
    quiet(on) { const a = A(); a.quietN = Math.max(0, (a.quietN || 0) + (on ? 1 : -1)); return a.quietN > 0; },
    ok(system, inst, part) { void inst; void part; return !!A().on[system] && !openFaults(farm).some((f) => f.system === system) && false; },   // STUB: never in band
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
    if (args.by === 'auto' && AUTO_ENV_ACTIONS.has(id)) {
      if (id === 'heat.setpoint') env.setHeaterSetpoint(args.c);
      else if (id === 'vent.fans') env.setFans(args.n);
      else env.setPad(!!args.on);
      return true;   // a controller's setting: quiet, no EV.ACTION (its EV.AUTO instead)
    }
    if (!AUTO_ACTION_IDS.has(id)) return act(id, args);
    const result = autoAct(farm, env, id, args);
    if (!args.quiet && farm.emit) farm.emit(EV.ACTION, { id, ...args, result });
    return result;
  };
  // a farm.start resets the systems (off until level.js sets them) and the farm's data, never the quiet counter; the
  // flock's fault plan is drawn at the brooding week's start (opts.flockNo: level.js passes skills.profile.cyclesDone)
  farm.start = (...a) => {
    const quietN = A().quietN || 0;
    const r = start(...a);
    Object.assign(farm.auto, fresh(), { quietN, on: allOff() });
    const def = a[0], opts = a[1] || {};
    if (def && def.id === LEVEL1.id) planFaults(farm, env, { flockNo: opts.flockNo ?? 0 });
    return r;
  };
  farm.serialize = () => {
    const a = A();
    return { ...serialize(), auto: { hold: { ...a.hold, winch: { ...(a.hold.winch || {}) }, feed: { ...(a.hold.feed || {}) } }, last: { ...a.last }, faults: a.faults.map((f) => ({ ...f })), drift: a.drift || 0 } };
  };
  farm.restore = (d) => {
    const quietN = A().quietN || 0;
    restore(d);
    const s = d && d.auto, a = A();
    Object.assign(a, fresh(), s ? { hold: { winch: {}, feed: {}, ...(s.hold || {}) }, last: { ...(s.last || {}) }, faults: (s.faults || []).map((f) => ({ ...f })), drift: s.drift || 0 } : {}, { quietN });
  };
  installFaultDebug(farm, env);
  return api;
}
