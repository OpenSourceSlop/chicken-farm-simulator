// The seven level 3 controllers (SKILLS.md §3, §4.1): each step reads the farm, and acts only through farm.act(id, { ...,
// by: 'auto', quiet: true }) (farm.js skips the problem hooks for it; farm-auto.js applies the ui-only settings to env) —
// never while farm.auto.quietN > 0 (farm-auto.js stepAuto). Pure logic, package "model". Each change is one EV.AUTO
// { system, did, text, args, day, hour } (records: a notebook line of kind 'auto').
import { AUTO, LIGHT_PRESETS, FEED_TYPES, PLACEMENT_DAY, nippleHeightCmAt, feederRimCmAt, feedStdGAt, flockAgeAt, lightPresetForDay, feedTypeForDay } from './config.js';
import { EV } from './events.js';
import { ventNeed, onSecFor, brooderRowC, knownAliveOf } from './job-figures.js';
import { stageTableFor } from './farm-fans.js';
import { feedDays } from './farm-silos.js';
import { preheatHours } from './heat-diag.js';

const H = 1 / 24;
const int = (v) => Math.round(v).toLocaleString('en-US');
const hhmm = (t) => { const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const lines4 = (n) => (n === 4 ? 'lines 1–4' : `line${n === 1 ? '' : 's'}`);
export const isOpen = (farm, system) => (farm.auto.faults || []).some((f) => f.phase === 'open' && f.system === system && !f.afterCutPending);
const held = (farm, env, key, line) => { const h = farm.auto.hold[key]; const t = line == null ? h : h && h[line]; return Number.isFinite(t) && t > env.day + 1e-9; };

/** One controller step that changed something: the action (quiet, by auto) and its EV.AUTO. */
export function autoDo(farm, env, system, did, text, id, args) {
  const r = id ? farm.act(id, { ...args, by: 'auto', quiet: true }) : null;
  const p = { system, did, text, args: { ...args }, day: env.dayNumber, hour: Math.round(env.hour * 100) / 100 };
  farm.auto.last[system] = p;
  farm.emit && farm.emit(EV.AUTO, p);
  return r;
}
/** The catch is near (or done): the controllers that stop for it (the catching lift, the catch's fans and lights). */
export const catchNear = (farm, env) => !!(farm.harvest && (farm.harvest.started || farm.harvest.result || (farm.harvest.catchAt != null && env.day >= farm.harvest.catchAt - H))) || env.day >= 41 + 20 * H;
/** The flock is in the house (or tomorrow's chicks on the prep day). */
const flockOn = (farm) => !(farm.flock.placed > 0) || farm.flock.alive > 0;
/** Crossed hour h of a day since the system's last step (the 06:00 steps; also a skip over it). */
function crossed(farm, env, key, h) {
  const m = farm.auto.mem, t = Math.floor(env.day - h * H + 1e-9);
  if (m[key] === t) return false;
  const first = m[key] == null;
  m[key] = t;
  return !first || env.hour >= h - 1e-9;
}

// ---------------- Water 3: the drinker winches ----------------
export const winchTarget = (env) => Math.round(nippleHeightCmAt(Math.max(0, env.dayNumber)));
function stepWinch(farm, env) {
  if (catchNear(farm, env) || !flockOn(farm)) return;
  const want = winchTarget(env), stall = (farm.auto.faults || []).find((f) => f.phase === 'open' && f.id === 'winch-stall');
  const mv = farm.auto.mem.winchAt || (farm.auto.mem.winchAt = {});
  let moved = 0;
  farm.water.lines.forEach((l, i) => {
    if (held(farm, env, 'winch', i) || (stall && stall.args.line === i)) return;
    const d = want - l.heightCm;
    if (Math.abs(d) < 0.5) return;
    // at most AUTO.winchCmPerH: one centimetre a step of 1 / winchCmPerH farm hours
    if (mv[i] != null && env.day - mv[i] < H / AUTO.winchCmPerH - 1e-9) return;
    mv[i] = env.day;
    farm.act('water.height', { line: i, cm: l.heightCm + Math.sign(d) * Math.min(1, Math.abs(d)), by: 'auto', quiet: true });
    moved++;
  });
  if (moved && farm.water.lines.every((l, i) => Math.abs(l.heightCm - want) < 0.5 || held(farm, env, 'winch', i) || (stall && stall.args.line === i))) {
    const on = farm.water.lines.filter((l) => Math.abs(l.heightCm - want) < 0.5).length;
    autoDo(farm, env, 'winch', 'raised', `Winches: ${lines4(on)} to ${want} cm (plate ${want} cm)`, null, { cm: want });
  }
}

// ---------------- Moisture 3: the minimum ventilation timer ----------------
/** The timer at AUTO.ventShare of the vent sign's need for the flock the farmer knows: 1 fan while it fits in the cycle. */
export function timerFor(env, farm, share = AUTO.ventShare) {
  const v = ventNeed(env, farm), need = v.need * share;
  let fans = 1, on = onSecFor(need, 1, 300);
  while (on > 300 && fans < 6) { fans++; on = onSecFor(need, fans, 300); }
  return { fans, onSec: Math.max(1, Math.min(300, on)), cycleSec: 300, birds: v.birds, weightG: v.weightG, need: v.need };
}
function stepTimer(farm, env) {
  if (farm.flock.placed > 0 && !(farm.flock.alive > 0)) return;
  const m = farm.auto.mem, h = farm.auto.hold;
  let go = crossed(farm, env, 'timerDay', AUTO.morningHour) || m.timerBirds == null;
  if (Number.isFinite(h.timer) && h.timer <= env.day + 1e-9) { delete h.timer; go = true; }   // his setting held to here: back to the table
  if (held(farm, env, 'timer')) return;
  const t = timerFor(env, farm);
  if (m.timerBirds > 0 && Math.abs(t.birds - m.timerBirds) / m.timerBirds >= AUTO.ventRecountPct / 100) go = true;
  if (!go) return;
  m.timerBirds = t.birds;
  const v = farm.vent;
  if (v && v.fans === t.fans && v.onSec === t.onSec && v.cycleSec === 300) return;
  autoDo(farm, env, 'timer', 'stepped', `Controller: timer stepped to ${t.fans} fan${t.fans === 1 ? '' : 's'} ${t.onSec} s / 300 s for ${int(t.birds)} birds of ${int(t.weightG)} g`,
    'vent.timer', { fans: t.fans, onSec: t.onSec, cycleSec: 300 });
}

// ---------------- Ventilation 3: the fan stage table for the age ----------------
const tableKey = (t) => (t ? `${t.key}|${t.stages.map((s) => `${s.overC}:${s.fans}`).join(',')}|${t.padOverC}` : '');
function stepStages(farm, env) {
  const m = farm.auto.mem, h = farm.auto.hold;
  if (catchNear(farm, env) || farm.flock.age < AUTO.stagesFromDay - 1e-9 || !(farm.flock.alive > 0)) {
    if (m.stagesKey && env.fanStages) { farm.act('vent.stages', { stages: null, by: 'auto', quiet: true }); }
    m.stagesKey = null;
    return;
  }
  const morning = crossed(farm, env, 'stagesDay', AUTO.morningHour);
  if (held(farm, env, 'stages') || held(farm, env, 'stagesTable')) { m.stagesKey = null; return; }
  const t = stageTableFor(env, farm), k = tableKey(t);
  if (!t || (k === m.stagesKey && env.fanStages && !morning)) return;
  m.stagesKey = k;
  const first = t.stages[0];
  autoDo(farm, env, 'stages', 'table', `Fan stages: the table for day ${env.dayNumber} (${first.overC < -10 ? `the evening line: every fan${t.padOverC != null ? ' and the pad' : ''}` : `${t.stages.length} stages from +${first.overC} °C${t.padOverC != null ? `, the pad over +${t.padOverC} °C` : ''}`})`,
    'vent.stages', { stages: t.stages, padOverC: t.padOverC });
}
/** The stage table of the age is running (the controller's own, as it set it). */
export const stagesRunning = (farm, env) => { const t = stageTableFor(env, farm); return !!(t && env.fanStages && farm.auto.mem.stagesKey === tableKey(t)); };

// ---------------- Heating 3: the brooders' thermostat by the brooder sign's row ----------------
/** The brooder sign's row of a day for this flock (a bad batch's warmer row on its first days). */
export const rowFor = (env, day) => brooderRowC(Math.max(0, day)) + (env.targetShiftC && day >= 0 && day <= (env.targetShiftToDay ?? 3) ? env.targetShiftC : 0);
function stepBrooders(farm, env) {
  const a = farm.auto, m = a.mem;
  if (env.broodersUp || env.dayNumber > 21 || !flockOn(farm)) return;
  if (held(farm, env, 'brooders')) { crossed(farm, env, 'broodDay', AUTO.morningHour); return; }
  let want = null, why = '';
  if (!(farm.flock.placed > 0) && env.dayNumber < 0) {
    // the prep day: the pre-heat starts at the time the heat-loss readout gives for the floor at 28 °C before the chicks
    if (m.preheated) return;
    const p = preheatHours(env, farm);
    if (p && env.day + 1e-9 < p.startBy) return;
    m.preheated = true; want = rowFor(env, 0); why = `pre-heat started for the chicks (brooder sign, day 0: ${want} °C)`;
  } else if (crossed(farm, env, 'broodDay', AUTO.morningHour) || a.setC == null) {
    want = rowFor(env, env.dayNumber); why = `thermostat to ${want} °C (brooder sign, day ${env.dayNumber})`;
  }
  if (want == null || (a.setC === want && Math.abs(env.heaterSetpoint - (want - (a.drift || 0))) < 1e-6)) return;
  a.setC = want;
  autoDo(farm, env, 'brooders', 'setpoint', `Brooders: ${why}`, 'heat.setpoint', { c: want - (a.drift || 0) });
}

// ---------------- Feed 3: the orders and the feeder rims ----------------
const END = { starter: 15.1, grower: 29.6, finisher: 41.6 };   // the ideal's own ends of each feed (the changes' blends)
const stockOf = (feed, type) => (feed.silos || []).reduce((a, s) => a + s.layers.filter((l) => l.type === type).reduce((x, l) => x + l.kg, 0), 0);
const pendingOf = (feed, type) => (feed.pending || []).filter((o) => o.type === type).reduce((a, o) => a + o.kg, 0);
/** The order the feed controller would place now: { kg, type } or null. */
export function feedOrderNow(farm, env) {
  const feed = farm.feed, fl = farm.flock, age = env.day - PLACEMENT_DAY, cyc = !!(farm.cyc && farm.cyc.on);
  if (!(fl.placed > 0) || !(fl.alive > 0) || env.dayNumber > AUTO.lastAutoOrderDay || feed.withdrawn) return null;
  const perDay = (t) => (knownAliveOf(fl) * feedStdGAt(Math.max(0, age + t))) / 1000;
  if (!cyc) {   // the brooding week: Phase 2's one silo figure
    const d = feedDays(farm, env);
    if (feed.order || d.days == null || d.days > AUTO.orderAtDays + 1e-9) return null;
    return { kg: Math.round(Math.max(0, AUTO.orderToDays * d.kgPerDay - d.kg) / 100) * 100, type: 'starter' };
  }
  for (const T of FEED_TYPES) {
    const end = END[T.id], start = T.id === 'starter' ? 0 : T.fromDay - 0.4;
    if (env.day > end || start - age > AUTO.orderAtDays + 1) continue;
    const from = Math.max(age, start - PLACEMENT_DAY + PLACEMENT_DAY), left = Math.max(0, end - Math.max(env.day, start));
    let need = 0; for (let t = 0; t < Math.min(AUTO.orderToDays, left); t += 0.25) need += perDay(Math.max(0, from - age) + t) * 0.25;
    let soon = 0; for (let t = 0; t < Math.min(AUTO.orderAtDays, left); t += 0.25) soon += perDay(Math.max(0, from - age) + t) * 0.25;
    const have = stockOf(feed, T.id) + pendingOf(feed, T.id);
    if (pendingOf(feed, T.id) > 0 || have >= soon - 1e-6 || need <= 0) continue;
    const kg = Math.round(Math.max(0, need - have) / 100) * 100;
    if (kg >= 200) return { kg, type: T.id };
  }
  return null;
}
function stepFeed(farm, env) {
  const m = farm.auto.mem, feed = farm.feed;
  const hr = Math.floor(env.day * 24 + 1e-6);
  if (m.feedHr !== hr) {
    m.feedHr = hr;
    const o = feedOrderNow(farm, env);
    if (o && o.kg > 0) {
      const lost = (farm.auto.faults || []).find((f) => f.id === 'order-lost' && f.phase === 'armed');
      const d = feedDays(farm, env);
      if (lost && (d.days ?? 0) >= 1.8 - 1e-9) {
        // the fault: the message to the mill is never confirmed (farm-faults.js opens it); no order goes in
        lost.phase = 'hit'; lost.args = { ...lost.args, kg: o.kg, type: o.type, at: +env.day.toFixed(5), days: d.days };
        autoDo(farm, env, 'feed', 'order-sent', `Feed order sent by the controller: ${int(o.kg)} kg ${o.type}, not confirmed yet`, null, { kg: o.kg, type: o.type });
      } else {
        const r = farm.act('feed.order', { kg: o.kg, type: o.type, by: 'auto', quiet: true });
        const due = r && r.arriveDay != null ? `, due day ${r.arriveDay} ${String(r.arriveHour).padStart(2, '0')}:00` : '';
        if (r && (r.kg ?? o.kg) > 0) autoDo(farm, env, 'feed', 'ordered', `Feed ordered by the controller: ${int(r.kg ?? o.kg)} kg ${o.type}${due}`, null, { kg: r.kg ?? o.kg, type: o.type, arriveDay: r.arriveDay ?? null });
      }
    }
  }
  // the rims from day 4 (the pans on the litter to day 3), not in the withdrawal or the heat wave's lift
  if (env.dayNumber < AUTO.rimFromDay || catchNear(farm, env) || feed.withdrawn || (farm.cyc && farm.cyc.liftOn) || !(farm.flock.alive > 0)) return;
  const want = Math.floor(feederRimCmAt(Math.max(0, flockAgeAt(env.day)))), mv = m.rimAt || (m.rimAt = {});
  let moved = 0;
  feed.lines.forEach((l, i) => {
    if (held(farm, env, 'feed', i) || !l.running) return;
    const d = want - l.heightCm;
    if (Math.abs(d) < 0.5 || (mv[i] != null && env.day - mv[i] < H / AUTO.rimCmPerH - 1e-9)) return;
    mv[i] = env.day; moved++;
    farm.act('feed.line', { line: i, heightCm: l.heightCm + Math.sign(d) * Math.min(1, Math.abs(d)), by: 'auto', quiet: true });
  });
  if (moved && feed.lines.every((l, i) => Math.abs(l.heightCm - want) < 0.5 || held(farm, env, 'feed', i) || !l.running)) autoDo(farm, env, 'feed', 'rims', `Feeder lines: rims to ${want} cm (feeder plate)`, null, { cm: want });
}

// ---------------- Lighting 3: the program by age, dawn and dusk dimming ----------------
export function lightsFor(env) {
  const d = env.dayNumber, P = LIGHT_PRESETS[lightPresetForDay(d)];
  return { darkStart: P.darkStart, darkHours: P.darkHours, dimmer: P.dimmer, ...(d >= AUTO.rampFromDay ? { rampMin: AUTO.rampMin } : {}), preset: lightPresetForDay(d) };
}
export const lightsOk = (env) => { const t = lightsFor(env), p = env.lightProgram || {}; return p.darkHours === t.darkHours && Math.abs((p.dimmer ?? 1) - t.dimmer) < 0.01 && (p.darkStart ?? 0) === t.darkStart; };
function stepLights(farm, env) {
  if (catchNear(farm, env) || held(farm, env, 'lights') || lightsOk(env)) return;
  const t = lightsFor(env), { preset, ...p } = t;
  const dark = p.darkHours ? `dark ${String(p.darkStart).padStart(2, '0')}:00–${String((p.darkStart + p.darkHours) % 24).padStart(2, '0')}:00 (${p.darkHours} h)` : 'no dark hour';
  autoDo(farm, env, 'lights', 'program', `Lights: the ${preset} program, ${dark}, dimmer ${Math.round(p.dimmer * 100)} %${p.rampMin ? `, dawn and dusk over ${p.rampMin} min` : ''}`, 'light.program', p);
}

// ---------------- Growth 3: the automatic bird scale (read on demand: farm-auto.js scaleNow) ----------------

const STEP = { winch: stepWinch, timer: stepTimer, stages: stepStages, brooders: stepBrooders, feed: stepFeed, lights: stepLights };
/** Every controller on (farm.auto.on) without an open fault of its own takes its step. */
export function stepControllers(farm, env) {
  for (const [s, fn] of Object.entries(STEP)) if (farm.auto.on[s] && !isOpen(farm, s) && env.powerOn !== false) fn(farm, env);
}
export { hhmm };
