// The farm's level 3 automation (SKILLS.md §4): the controllers that take routine jobs over — the drinker winches, the
// minimum ventilation timer, the tunnel fan stage table, the brooders' thermostat, the feed orders and feeder rims, the
// light program, the automatic bird scale. Pure logic (node and browser). Owner: package "model". The controllers' steps
// are in farm-auto-ctl.js, the faults in farm-faults.js, the heat sign's fan rules in farm-fans.js.
//
// installAuto(farm, env, events) adds farm.auto and wraps farm.step / act / start / serialize / restore (the pattern of
// farm-cond.js installConditions):
//   farm.auto            plain data only (runCycle's snapshots structuredClone every farm field):
//     .on                { [system]: bool } set by level.js from perks.auto(system) after EVERY farm.start, enterLevel and
//                        restore, and on EV.PERKS / EV.SETTINGS; farm.start resets it to all false; runCycle / runProfile
//                        set it only with their perks option (SKILLS.md §13.1)
//     .hold              the farmer's own settings and until when (env.day; config AUTO.handHold): { winch: { [line]: until },
//                        feed: { [line]: until }, timer, brooders, stages (his fans / pad), stagesTable (his vent.stages),
//                        lights } — kept only while that system is on
//     .last              { [system]: the last EV.AUTO payload }
//     .faults            the flock's fault plan and its faults (farm-faults.js; saved here, so a replay keeps the plan)
//     .drift             °C the controller's sensor reads over the house (sensor-drift; 0 = calibrated)
//     .setC              the thermostat's figure on the controller (what was set; env.heaterSetpoint = setC - drift while
//                        the sensor reads high: the brooders hold the drifted sensor at it)
//     .mem               the controllers' own memory (the last 06:00 step, the last move of each line, the stage table)
//     .quietN            > 0 while goto(auto) or a standard start plays the ideal: no controller acts, no fault starts.
//                        KEPT by farm.start and farm.restore (run.js holds it around the whole standard start)
//   farm.autoCtl         the API (a getter, not state): quiet(on), ok(system, inst?, part?), status(), sensorC(), setpointC(),
//                        scale() (the automatic scale's figures of today)
// Every controller step goes through farm.act(id, { ...args, by: 'auto', quiet: true }): no EV.ACTION, no problem hook
// (farm.js), and one EV.AUTO { system, did, text, args, day, hour } per change. The ui-only settings (heat.setpoint,
// vent.fans, vent.pad: farm.act has no case for them) are applied here for by 'auto' (AUTO_ENV_ACTIONS).
// The actions of SKILLS.md §12.2 routed here first (autoAct; results are the contract shapes):
//   auto.reset { system, line? }   -> { reset: bool, system, line? }        a stalled winch / tripped stages back on
//   auto.calibrate {}              -> { offsetC, sensorC, houseC }           the sensor set to the thermometer (drift 0)
//   scale.read { day? }            -> { day, n, meanG, uniformityPct, fouled } the automatic scale's figures of the day
//   scale.clean {}                 -> { cleaned: bool }                      the platform cleaned (scale-fouled fixed)
//   water.columns {}               -> { lines: [{ line, cm, markCm, inBand }] } the sight tubes (Water 2); every line keeps
//                                     lastColumn { cm, inBand, at }
import { AUTO, AUTO_SYSTEMS, LEVEL1, LIGHT_PRESETS, flowTargetAt, SKILL_SHORT, SKILLS_UPDATE, HEAT, HEAT_P4, FAN_COUNT, flockAgeAt } from './config.js';
import { EV } from './events.js';
import { WATER, lineFlow } from './farm-water.js';
import { planFaults, stepFaults, openFaults, installFaultDebug, faultHand, faultAct, faultWords, dropQuiet } from './farm-faults.js';
import { stepControllers, isOpen, winchTarget, timerFor, stagesRunning, rowFor, lightsOk, lightsFor, feedOrderNow, hhmm } from './farm-auto-ctl.js';
import { ventNeed, VENT_BAND, nippleInBand, rimInBand } from './job-figures.js';
import { feedDays } from './farm-silos.js';
export { adviseFans, stageTableFor } from './farm-fans.js';

export const AUTO_ACTION_IDS = new Set(['auto.reset', 'auto.calibrate', 'scale.read', 'scale.clean', 'water.columns']);
/** The ui-only setting ids a controller sends (applied to env here, by 'auto' only). */
export const AUTO_ENV_ACTIONS = new Set(['heat.setpoint', 'vent.fans', 'vent.pad']);
/** The ui-only ids the farmer's hand sends (EV.ACTION with result undefined): the holds and the fixes read them. */
const UI_HAND = new Set(['heat.setpoint', 'vent.fans', 'vent.pad']);
const SYSTEMS = Object.keys(AUTO_SYSTEMS);
const fresh = () => ({ hold: { winch: {}, feed: {} }, last: {}, faults: [], drift: 0, setC: null, mem: {} });
const allOff = () => Object.fromEntries(SYSTEMS.map((s) => [s, false]));
const H = 1 / 24;
const int = (v) => Math.round(v).toLocaleString('en-US');
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
/** The sight tubes' band: ±1.5 cm of water column = ±3 ml/min at WATER.flowPerCm 2 (the drinker plate's band). */
export const COLUMN_BAND_CM = 1.5;
/** The next time of day `h` after `day` (env.day units). */
export const nextAt = (day, h) => { let t = Math.floor(day + 1e-9) + h / 24; if (t <= day + 1e-9) t += 1; return t; };

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

/** A noise in [-1, 1) for a day of a flock (the automatic scale's day mean; never farm.rng). */
const dayNoise = (seed, day, k = 0) => { let s = (Math.imul((seed | 0) + 7919, 2654435761) ^ Math.imul(day + 101 + k * 37, 40503)) >>> 0; s ^= s >>> 15; s = Math.imul(s, 2246822507) >>> 0; s ^= s >>> 13; return (s >>> 0) / 2147483648 - 1; };
/**
 * The automatic platform scale now (Growth 3): its weighings today (about AUTO.scalePerDay over the lit day from 08:00, a
 * quarter of them with the platform fouled), the day mean (the flock's mean x (1 ± AUTO.scaleNoisePct %), about 6 % light
 * fouled) and the uniformity. -> { day, n, meanG, uniformityPct, fouled }
 */
export function scaleNow(farm, env) {
  const fl = farm.flock, day = env.dayNumber, fouled = openFaults(farm).some((f) => f.id === 'scale-fouled');
  if (!(fl.placed > 0) || !(fl.alive > 0) || env.hour < 8) return { day, n: 0, meanG: null, uniformityPct: null, fouled };
  const F = { readLowPct: 6, countShare: 0.25 }, f = fouled ? F.countShare : 1;
  const n = Math.round(AUTO.scalePerDay * Math.min(1, (env.hour - 8) / 12) * f);
  const mean = fl.meanWeightG * (1 + (AUTO.scaleNoisePct / 100) * dayNoise(farm.seed, day)) * (fouled ? 1 - F.readLowPct / 100 : 1);
  return { day, n, meanG: n > 0 ? Math.round(mean) : null, uniformityPct: n > 0 ? Math.round(fl.uniformityPct || 0) : null, fouled };
}

/** The actions of AUTO_ACTION_IDS (else undefined). */
export function autoAct(farm, env, id, a = {}) {
  const fr = faultAct(farm, env, id, a);   // reset / calibrate / clean fix their faults (farm-faults.js)
  switch (id) {
    case 'auto.reset': return { reset: !!(fr && fr.fixed), system: a.system ?? null, ...(a.line != null ? { line: a.line } : {}) };
    case 'auto.calibrate': return { offsetC: +((fr && fr.offsetC) || 0).toFixed(1), sensorC: +env.houseTemp.toFixed(1), houseC: +env.houseTemp.toFixed(1) };
    case 'scale.read': {
      const s = scaleNow(farm, env), d = a.day ?? env.dayNumber;
      if (d !== s.day) return { day: d, n: 0, meanG: null, uniformityPct: null, fouled: s.fouled };
      if (s.n > 0) { const R = farm.stats.scaleReads || (farm.stats.scaleReads = {}); if (!R[d] || R[d].n <= s.n) R[d] = { n: s.n, meanG: s.meanG, uniformityPct: s.uniformityPct, fouled: s.fouled, at: +env.day.toFixed(5) }; }
      return s;
    }
    case 'scale.clean': return { cleaned: !!(fr && fr.fixed) };
    case 'water.columns': {
      const lines = columnsNow(farm, env), at = +env.day.toFixed(5);
      lines.forEach((c) => { farm.water.lines[c.line].lastColumn = { cm: c.cm, inBand: c.inBand, at }; });
      return { lines };
    }
    default: return undefined;
  }
}

/** The next change of week of the light program (days -1, 8, 36 at 06:00) after now. */
const nextLightChange = (env) => { for (const d of AUTO.lightDays) { const t = d + AUTO.morningHour * H; if (t > env.day + 1e-9) return t; } return Infinity; };
/** The farmer's own setting (SKILLS.md §4.2): his hand holds the system's part for a while; the fault module sees fixes. */
function hand(farm, env, id, a = {}, viaBus = false) {
  if (farm.mode !== 'level') return;
  const A = farm.auto, h = A.hold, on = A.on, at6 = nextAt(env.day, AUTO.handHold.winch.untilHour);
  const line = a.line != null ? Math.round(a.line) : null;
  switch (id) {
    case 'water.height': if (on.winch && line != null) h.winch[line] = at6; break;
    case 'feed.line': if (on.feed && line != null && a.heightCm != null) h.feed[line] = at6; break;
    case 'heat.setpoint': {
      const c = a.c ?? a.value;
      if (!Number.isFinite(c)) break;
      // the ui stepped env.heaterSetpoint (his figure less the drift while the sensor reads high); the farm path sends his figure
      const his = viaBus ? c + (A.drift || 0) : c;
      if (A.drift > 0 || on.brooders) A.setC = his;
      if (!viaBus && A.drift > 0) env.setHeaterSetpoint(his - A.drift);
      if (on.brooders) h.brooders = nextAt(env.day, AUTO.handHold.brooders.untilHour);
      break;
    }
    case 'vent.timer': if (on.timer) h.timer = env.hour < AUTO.handHold.timer.untilHour ? Math.floor(env.day + 1e-9) + AUTO.handHold.timer.untilHour * H : nextAt(env.day, AUTO.handHold.timer.lateUntilHour); break;
    case 'vent.fans': case 'vent.pad':
      if (on.stages) {
        h.stages = env.day + AUTO.handHold.stages.hours * H;
        // his fans or pad take the controller's table off (it comes back when the hold ends)
        if (env.fanStages && A.mem.stagesKey) { env.setFanStages(null); A.mem.stagesKey = null; }
      }
      break;
    case 'vent.stages': if (on.stages) { h.stagesTable = nextAt(env.day, AUTO.handHold.stages.tableUntilHour); A.mem.stagesKey = null; } break;
    case 'light.program': if (on.lights) h.lights = nextLightChange(env); break;
    default: break;
  }
  faultHand(farm, env, id, a);
}

// ---------------- the reading in the part's band (SKILLS.md §4.3: job-engine 'auto-ok' { system, part }) ----------------
const ORDER_TYPE = { 'w2-order': 'grower', 'w45-order': 'finisher' };
const jobIdOf = (inst) => (typeof inst === 'string' ? inst : inst ? inst.id ?? inst.jobId ?? inst.jd?.id ?? inst.def?.id ?? inst.key : null);
const idOnly = (k) => (k == null ? null : String(k).split('@')[0]);
export function autoOk(farm, env, system, inst, part) {
  const A = farm.auto;
  if (!A || !A.on[system] || isOpen(farm, system) || farm.mode !== 'level') return false;
  const id = idOnly(jobIdOf(inst));
  switch (system) {
    case 'winch': return farm.water.lines.every((l) => nippleInBand(l.heightCm, env));
    case 'timer': { const v = ventNeed(env, farm); return v.need > 0 && v.share >= VENT_BAND[0] - 1e-9 && v.share <= VENT_BAND[1] + 1e-9; }
    case 'stages': return stagesRunning(farm, env);
    case 'brooders': { const c = A.setC ?? env.heaterSetpoint, d = Math.max(0, env.dayNumber); return !env.broodersUp && Math.abs(c - rowFor(env, d)) <= 1 + 1e-9 && (farm.flock.placed > 0 || !!env.heatersOn || env.heaterLevel > 0.02); }
    case 'feed': {
      if (part === 'pans-raised') return farm.feed.lines.every((l) => rimInBand(l.heightCm, env));
      const type = ORDER_TYPE[id] || null, feed = farm.feed, from = inst && Number.isFinite(inst.opensAt) ? inst.opensAt - 3 : env.day - 3;
      const ordered = (feed.pending || []).some((o) => !type || o.type === type) || (feed.orders || []).some((o) => (!type || o.type === type) && o.orderedAt >= from - 1e-9);
      if (ordered) return true;
      const d = feedDays(farm, env);
      return d.days != null && d.days > AUTO.orderAtDays && !feedOrderNow(farm, env);
    }
    case 'lights': return lightsOk(env);
    case 'scale': return scaleNow(farm, env).n >= AUTO.scaleMinReads;
    default: return false;
  }
}

// ---------------- the readings in words (the controller's read, the Equipment row, the panels) ----------------
const LIGHT_LABEL = Object.fromEntries(Object.entries(LIGHT_PRESETS).map(([k, v]) => [k, v.label]));
function systemText(farm, env, s) {
  const A = farm.auto, last = A.last[s];
  switch (s) {
    case 'winch': { const want = winchTarget(env), h = farm.water.lines.map((l) => Math.round(l.heightCm)); const same = h.every((x) => x === h[0]); return `Winches: ${same ? `lines 1–4 at ${h[0]} cm` : `${h.map((x, i) => `${i + 1}: ${x}`).join(', ')} cm`} (plate ${want} cm)`; }
    case 'timer': { const v = farm.vent, t = timerFor(env, farm); return `Timer: ${v && v.fans > 0 ? `${v.fans} fan${v.fans === 1 ? '' : 's'} ${v.onSec} s / ${v.cycleSec} s` : 'off'} (the table for ${int(t.birds)} birds of ${int(t.weightG)} g: ${t.fans} fan ${t.onSec} s at 110 %)`; }
    case 'stages': return env.fanStages ? `Fan stages: the table for day ${env.dayNumber} · ${env.fansManual ?? 0} fans now${env.padOn ? ', pad on' : ''}` : `Fan stages: off · ${env.fansManual ?? 0} fans by hand`;
    case 'brooders': { const c = A.setC ?? env.heaterSetpoint, d = Math.max(0, env.dayNumber); return env.broodersUp ? 'Brooders: up for the big birds' : `Brooders: thermostat ${one(c)} °C (brooder sign, day ${d}: ${one(rowFor(env, d))} °C)`; }
    case 'feed': { const d = feedDays(farm, env), p = (farm.feed.pending || [])[0]; return `Feed: ${d.days != null ? `about ${one(d.days)} days in the silos` : `${int(d.kg)} kg in the silos`}${p ? `; ${int(p.kg)} kg ${p.type} confirmed by the mill, due day ${p.arriveDay} ${String(p.arriveHour).padStart(2, '0')}:00` : ''}`; }
    case 'lights': { const t = lightsFor(env); return `Lights: the ${(LIGHT_LABEL[t.preset] || t.preset).toLowerCase()} program${lightsOk(env) ? '' : ' (not set yet)'}`; }
    case 'scale': { const x = scaleNow(farm, env); return x.n ? `Bird scale: ${int(x.n)} weighings today, mean ${int(x.meanG)} g, uniformity ${x.uniformityPct} %` : 'Bird scale: no weighings yet today (from 08:00)'; }
    default: return last ? last.text : '';
  }
}
function holdText(farm, env, s) {
  const h = farm.auto.hold, untilW = (t) => (Number.isFinite(t) ? `until ${hhmm(t)}${Math.floor(t + 1e-9) > env.dayNumber ? ' tomorrow' : ''}` : 'for now');
  if (s === 'winch' || s === 'feed') {
    const ls = Object.entries(h[s] || {}).filter(([, t]) => t > env.day + 1e-9);
    return ls.length ? `line${ls.length === 1 ? '' : 's'} ${ls.map(([l]) => +l + 1).join(', ')}: your setting holds ${untilW(Math.max(...ls.map(([, t]) => t)))}` : '';
  }
  const k = s === 'stages' ? (h.stages > env.day ? 'stages' : h.stagesTable > env.day ? 'stagesTable' : null) : s;
  if (!k || !(h[k] > env.day + 1e-9)) return '';
  return `your setting holds ${untilW(h[k])}, then the controller goes back to the table`;
}
export function autoStatus(farm, env) {
  const A = farm.auto, open = openFaults(farm);
  const systems = Object.fromEntries(SYSTEMS.map((s) => {
    const f = open.find((x) => x.system === s), hold = A.on[s] ? holdText(farm, env, s) : '';
    const state = !A.on[s] ? 'off' : f ? 'fault' : hold ? 'held' : 'running';
    const text = !A.on[s] ? `${AUTO_SYSTEMS[s].label}: off` : f ? faultWords(f, env, farm).what : `${systemText(farm, env, s)}${hold ? ` · ${hold}` : ''}`;
    return [s, { state, text, since: f ? f.startedAt : A.last[s] ? A.last[s].day + A.last[s].hour / 24 : null, label: AUTO_SYSTEMS[s].label, branch: SKILL_SHORT[AUTO_SYSTEMS[s].branch] }];
  }));
  return { on: { ...A.on }, systems, faults: open.map((f) => ({ ...f, words: faultWords(f, env, farm) })), last: { ...A.last } };
}

/**
 * The update's own day stats (SKILLS.md §2.3, while SKILLS_UPDATE.live only: with the switch off the farm's stats are Phase
 * 5's): stats.daily[d].nightOk — the night-comfort state (r-vent-night's: a quarter panting at most and none chilled, or big
 * birds on a warm evening with every fan and the pad) held for 30 farm minutes after 18:00 (night-air-w3); nightH the hours
 * of the evening read.
 */
export function payoffStats(farm, env, hrs) {
  if (!SKILLS_UPDATE.live || !(farm.flock.alive > 0) || !(farm.flock.placed > 0) || env.hour < 18) return;
  const daily = farm.stats.daily || (farm.stats.daily = {}), D = daily[env.dayNumber] || (daily[env.dayNumber] = { h: 0 });
  const C = farm.comfort || {}, e = Number.isFinite(C.meanOver) ? C.meanOver : C.e;
  let calm = (C.pantShare ?? 0) <= HEAT_P4.nightPantMax + 1e-9 && Number.isFinite(e) && e >= -1.5 - 1e-9;
  if (!calm) {
    const big = flockAgeAt(env.day) >= HEAT_P4.padEveningFromAge - 1e-9, warm = (env.outsideTemp ?? 0) >= HEAT_P4.padEveningAboveC - 1e-9;
    calm = big && warm && (env.fansEffective ?? 0) >= FAN_COUNT - (env.fansBroken || []).length && (!!env.padOn || env.houseRH > HEAT.padOffAboveRH);
  }
  D.nightH = +((D.nightH || 0) + hrs).toFixed(4);
  D.nightRun = calm ? +((D.nightRun || 0) + hrs).toFixed(4) : 0;
  if (D.nightRun >= 0.5 - 1e-9) D.nightOk = true;
}

/** The controllers' step (every farm step, after the model). */
export function stepAuto(farm, env, hrs) {
  if (farm.mode !== 'level') return;
  // goto(auto) / a standard start: the ideal plays by hand; a planned fault whose time passes meanwhile is dropped
  if (farm.auto.quietN > 0) { dropQuiet(farm, env); return; }
  stepFaults(farm, env, hrs);
  stepControllers(farm, env, hrs);
}

export function installAuto(farm, env, events = null) {
  farm.auto = { on: allOff(), ...fresh(), quietN: 0 };
  const A = () => farm.auto;
  const api = {
    quiet(on) { const a = A(); a.quietN = Math.max(0, (a.quietN || 0) + (on ? 1 : -1)); return a.quietN > 0; },
    ok(system, inst, part) { return autoOk(farm, env, system, inst, part); },
    /** What the controller's sensor reads (the house + the drift): the LCD shows this. */
    sensorC() { return env.houseTemp + (A().drift || 0); },
    /** The thermostat's figure on the controller (what was set; env.heaterSetpoint is it less the drift). */
    setpointC() { const a = A(); return a.drift > 0 && Number.isFinite(a.setC) ? a.setC : env.heaterSetpoint; },
    status() { return autoStatus(farm, env); },
    scale() { return scaleNow(farm, env); },
  };
  Object.defineProperty(farm, 'autoCtl', { get: () => api, enumerable: false, configurable: true });

  const step = farm.step, act = farm.act, start = farm.start, serialize = farm.serialize, restore = farm.restore;
  farm.step = (e, gameSeconds) => { step(e, gameSeconds); if (farm.mode === 'level' && gameSeconds > 0) { payoffStats(farm, e, gameSeconds / 3600); stepAuto(farm, e, gameSeconds / 3600); } };
  farm.act = (id, args = {}) => {
    if (args.by === 'auto' && AUTO_ENV_ACTIONS.has(id)) {
      if (id === 'heat.setpoint') env.setHeaterSetpoint(args.c);
      else if (id === 'vent.fans') env.setFans(args.n);
      else env.setPad(!!args.on);
      return true;   // a controller's setting: quiet, no EV.ACTION (its EV.AUTO instead)
    }
    if (!AUTO_ACTION_IDS.has(id)) {
      const r = act(id, args);
      if (args.by !== 'auto') hand(farm, env, id, args);
      return r;
    }
    const result = autoAct(farm, env, id, args);
    if (!args.quiet && farm.emit) farm.emit(EV.ACTION, { id, ...args, result });
    return result;
  };
  // the ui-only settings by the farmer's hand (the panels emit EV.ACTION with result undefined; farm.act never sees them)
  if (events) events.on(EV.ACTION, (p) => { if (p && UI_HAND.has(p.id) && p.result === undefined && p.by !== 'auto') hand(farm, env, p.id, p, true); });
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
  const dataOf = (a) => ({ hold: { ...a.hold, winch: { ...(a.hold.winch || {}) }, feed: { ...(a.hold.feed || {}) } }, last: { ...a.last }, faults: a.faults.map((f) => ({ ...f, args: { ...(f.args || {}) } })), drift: a.drift || 0,
    ...(a.setC != null ? { setC: a.setC } : {}), ...(Object.keys(a.mem || {}).length ? { mem: JSON.parse(JSON.stringify(a.mem)) } : {}) });
  farm.serialize = () => ({ ...serialize(), auto: dataOf(A()) });
  farm.restore = (d) => {
    const quietN = A().quietN || 0;
    restore(d);
    const s = d && d.auto, a = A();
    Object.assign(a, fresh(), s ? { hold: { winch: {}, feed: {}, ...(s.hold || {}) }, last: { ...(s.last || {}) }, faults: (s.faults || []).map((f) => ({ ...f, args: { ...(f.args || {}) } })), drift: s.drift || 0,
      setC: s.setC ?? null, mem: s.mem ? JSON.parse(JSON.stringify(s.mem)) : {} } : {}, { quietN });
  };
  installFaultDebug(farm, env);
  return api;
}
