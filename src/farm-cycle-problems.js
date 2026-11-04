// Farm model, the problem events of the Phase 3 levels (PHASE3.md §7): each starts silently at its day and
// hour (conditional ones only when their condition holds), only the farm decides that the farmer met a
// symptom (an action it sees, an EV.NEAR for one of its zones, a listen stop, the radio) and when it was
// fixed. Also their weather (rh / rhDrop events), the radio's words and what the farmer sees and hears.
// Pure logic, package "sim". Phase 2's problems stay in farm-problems.js (its functions only know LEVEL1's).
import { HEAT, WEATHER, CLEAN } from './config.js';
import { EV } from './events.js';
import { findProblem, fixProblem } from './farm-problems.js';
import { startGumboro, startCocci, addLame, gumboroNow, cocciNow } from './farm-health.js';
import { killBirds } from './farm-flock.js';
import { secondPass } from './farm-clean.js';
import { eAt } from './farm-house.js';

const at = (d, h) => d + h / 24;
const H = 1 / 24;
export const RECURRING = ['abnormal-deaths', 'low-silo'];
const fresh = (id) => ({ id, phase: 'pending', startedAt: null, foundAt: null, fixedAt: null, foundBy: null });
// Phase 4: the level as the farm's condition plays it (dropped problems have no def; replaced ones carry their fields).
// Only the level def's own problems: the condition's own are farm-cond.js's
const defOf = (farm, id) => {
  const lv = farm.cycleLevel, own = lv && lv.problems.find((p) => p.id === id);
  if (!own) return null;
  return farm.condition && farm.levelFor ? farm.levelFor(lv).problems.find((p) => p.id === id) || null : own;
};
const levelProblems = (farm, def) => (farm.condition && farm.levelFor ? farm.levelFor(def).problems : def.problems);
const stateOf = (farm, id) => farm.problems.find((p) => p.id === id) || null;
const isActive = (farm, id) => { const p = stateOf(farm, id); return !!p && p.phase === 'active' && !!defOf(farm, id); };
const isFound = (farm, id) => { const p = stateOf(farm, id); return !!p && p.phase === 'found' && !!defOf(farm, id); };
const HEAT_IDS = ['warm-afternoon3', 'hot-afternoon', 'hot-finish'];
// the tunnel fans in the east end wall, staged from the centre outward (house-fans.js FAN_Z)
const FAN_Z = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5].map((k) => k * 1.9);
const FAN_Z_OF = (i) => FAN_Z[Math.max(0, Math.min(5, i | 0))];

/** The level's problems on the farm (pending), the recurring ones re-armed (enterLevel). */
export function addLevelProblems(farm, def) {
  // the earlier levels' problems that never came to an end (their weather is over): ended, so no later
  // reading finds them again
  for (const st of farm.problems) if ((st.phase === 'active' || st.phase === 'pending') && !RECURRING.includes(st.id) && !(def.problems || []).some((p) => p.id === st.id)) st.phase = 'ended';
  for (const id of RECURRING) { const st = stateOf(farm, id); if (st) Object.assign(st, fresh(id)); else farm.problems.push(fresh(id)); }
  for (const p of def.problems || []) { const st = stateOf(farm, p.id); if (st) Object.assign(st, fresh(p.id)); else farm.problems.push(fresh(p.id)); }
}

/** The weather events of the cycle level's problems (rh / rhDrop as given). */
export function installCycleWeather(farm, env) {
  const def = farm.cycleLevel;
  if (!def) return;
  for (const p of def.problems || []) {
    if (!p.until) continue;
    const drop = p.outsideDrop != null ? p.outsideDrop : -(p.outsideRise || 0);
    const ev = { id: p.id, fromDay: at(p.day, p.hour), toDay: at(p.until.day, p.until.hour), outsideDrop: drop, heatPerH: p.sunPerH || 0 };
    if (Number.isFinite(p.rh)) ev.rh = p.rh;
    if (Number.isFinite(p.rhDrop)) ev.rhDrop = p.rhDrop;
    env.addWeatherEvent(ev);
  }
}

/** What an active cycle problem changes in the house (also after a restore). */
export function applyCycleEffects(farm, env) {
  const on = (id) => { const p = stateOf(farm, id); return !!p && (p.phase === 'active' || p.phase === 'found') && !!defOf(farm, id); };
  const fan = defOf(farm, 'fan-belt');
  env.setFansBroken(on('fan-belt') ? [fan.fan] : []);
  farm.house.fansBroken = env.fansBroken.slice();
  const clog = defOf(farm, 'pad-clog');
  farm.house.padWorking = on('pad-clog') ? 1 - clog.share : 1;
  env.padWorking = farm.house.padWorking;
  farm.house.padFloatStuck = on('pad-overflow');
}

function start(farm, env, st) {
  st.phase = 'active'; st.startedAt = env.day;
  if (st.id === 'lame-birds' && !(farm.flock.lameOnFloor > 0)) addLame(farm, env, 1);
  if (st.id === 'sudden-deaths' && !((farm.flock.deadByCause.sds || 0) - (farm.stats.levelStart?.sds || 0) > 0)) killBirds(farm, 1, 'sds');
  if (st.id === 'gumboro') startGumboro(farm, env);
  if (st.id === 'coccidiosis') startCocci(farm, env);
  applyCycleEffects(farm, env);
  farm.emit(EV.FARM_PROBLEM, { id: st.id, phase: 'start' });
}

/** Every step: start the problems whose time came; the state rules that fix them. */
export function tickCycleProblems(farm, env) {
  if (!farm.cycleLevel) return;
  for (const st of farm.problems) {
    const def = defOf(farm, st.id);
    if (!def) continue;
    if (st.phase === 'pending') {
      if (def.conditional === 'lab') continue; // the lab letter starts it
      if (env.day < at(def.day, def.hour) - 1e-9) continue;
      // Gumboro only after a poor vaccination (no vaccine at all counts as the lowest coverage)
      if (def.conditional === 'vaccine' && !((farm.health.vaccine.coverage ?? 0.3) < def.below)) { st.phase = 'skipped'; continue; }
      start(farm, env, st);
      continue;
    }
    if (st.phase !== 'active' && st.phase !== 'found') continue;
    const id = st.id, ended = def.until && env.day >= at(def.until.day, def.until.hour) - 1e-9;
    if (id === 'rainy-spell') {
      const ok = st.phase === 'found' && st.acted && env.houseRH <= 75;
      st.okSince = ok ? (st.okSince ?? env.day) : null;
      if (ok && env.day - st.okSince >= 1 * H - 1e-9) fixProblem(farm, env, id, 'air');
      else if (ended && st.phase === 'active') fixProblem(farm, env, id, 'weather');
    } else if (HEAT_IDS.includes(id)) {
      const ok = st.phase === 'found' && st.acted && heatHandled(farm, env);
      st.okSince = ok ? (st.okSince ?? env.day) : null;
      if (ok && env.day - st.okSince >= 0.5 * H - 1e-9) fixProblem(farm, env, id, 'air');
      else if (ended && !ok) fixProblem(farm, env, id, 'weather');
    } else if (id === 'humid-heat') {
      const ok = st.phase === 'found' && st.acted && padHumidOk(farm, env);
      st.okSince = ok ? (st.okSince ?? env.day) : null;
      if (ok && env.day - st.okSince >= 0.5 * H - 1e-9) fixProblem(farm, env, id, 'air');
      else if (ended && !ok) fixProblem(farm, env, id, 'weather');
    } else if (id === 'dusty-air') {
      const ok = st.phase === 'found' && st.acted && airClear(farm);
      st.okSince = ok ? (st.okSince ?? env.day) : null;
      if (ok && env.day - st.okSince >= 2 * H - 1e-9) fixProblem(farm, env, id, 'air');
      else if (ended && !ok) fixProblem(farm, env, id, 'weather');
    } else if (id === 'lame-birds') {
      if (st.phase === 'found' && !(farm.flock.lameOnFloor > 0)) fixProblem(farm, env, id, 'cull');
    } else if (id === 'heat-wave') {
      if (st.phase === 'found' && st.read && st.padChecked && st.flowTested) fixProblem(farm, env, id, 'ready');
    } else if (id === 'pad-overflow' && st.phase !== 'fixed') {
      farm.house.padFloatStuck = true;
    }
  }
}

/**
 * heat-handled (PHASE3.md §3.1, the heat sign and the pad plate; Phase 4 PHASE4.md §2.2 row 23): never while the birds
 * are chilled (mean felt comfort under -1.5 °C: too much air for their age). Young birds (under 21 days) may have the
 * pad with few tunnel fans (the heat sign's young-birds line, the hot season's remedy: one fan in week 2, two or three
 * in week 3), never with more (six fans and the pad chill them). Then few birds panting (10 % or less), or every fan
 * that turns is on with the pad running (or off over its humidity limit).
 */
export const YOUNG_PAD_MAX_FANS = 3;   // model: the hot season's week 3 plan (two or three fans with the pad)
export function heatHandled(farm, env) {
  const C = farm.comfort || {}, e = Number.isFinite(C.meanOver) ? C.meanOver : (C.e ?? 0), pant = C.pantShare ?? 0;
  if (e < -1.5) return false;
  const young = (farm.age ?? 21) < 21;
  if (young && env.padOn && env.fansEffective > YOUNG_PAD_MAX_FANS) return false;
  if (pant <= 0.1) return true;
  const allFans = env.fansEffective >= 6 - (env.fansBroken || []).length;
  return allFans && (young || env.padOn || env.houseRH > HEAT.padOffAboveRH);
}
const darkHoursOf = (farm, env) => (env.lightProgram?.darkHours ?? farm.light?.darkHours) ?? 0;
// the pad plate: above about 90 % the pump off and all the fans running (every fan that turns)
export const padHumidOk = (farm, env) => (!env.padOn || env.houseRH <= HEAT.padOffAboveRH) && env.fansEffective >= 6 - (env.fansBroken || []).length;
export const airClear = (farm) => farm.air.dustIndex <= 1 && farm.air.ammoniaPpm <= 15;

/** Lab letter with more than two positive swabs: the swab-positive problem (wash and spray cleared). */
export function onLabLetter(farm, env) {
  const st = stateOf(farm, 'swab-positive'), lab = farm.clean.lab;
  if (!st || !lab) return;
  if (lab.positive > 2) {
    if (st.phase === 'pending' || st.phase === 'fixed') { Object.assign(st, fresh('swab-positive')); start(farm, env, st); }
    st.pending2nd = true;
  } else if (st.phase === 'found' || st.phase === 'active') fixProblem(farm, env, 'swab-positive', 'lab');
}

/** Symptoms and fixes carried by actions (farm.act results and the ui-only actions on the bus). */
export function cycleSymptoms(farm, env, id, a, result) {
  if (!farm.cycleLevel) return;
  const C = farm.comfort, pant = C.pantShare ?? 0;
  const mark = (pid) => { const st = stateOf(farm, pid); if (st && st.phase === 'found') st.acted = true; };
  switch (id) {
    case 'controller.read': {
      const rh = a.rh ?? env.houseRH;
      if (isActive(farm, 'rainy-spell') && rh >= 80) findProblem(farm, env, 'rainy-spell', 'controller');
      for (const h of HEAT_IDS) if (isActive(farm, h) && pant > 0.2) findProblem(farm, env, h, 'controller');
      if (isActive(farm, 'humid-heat') && rh >= 85 && env.houseTemp >= 30) findProblem(farm, env, 'humid-heat', 'controller');
      // the sudden deaths are dealt with by a dark period in the light program (the light sign), not by reading
      if (isFound(farm, 'sudden-deaths') && darkHoursOf(farm, env) >= 4) fixProblem(farm, env, 'sudden-deaths', 'controller');
      break;
    }
    case 'light.program':
      if (isFound(farm, 'sudden-deaths') && darkHoursOf(farm, env) >= 4) fixProblem(farm, env, 'sudden-deaths', 'light');
      break;
    case 'fans.read': {
      for (const h of HEAT_IDS) if (isActive(farm, h) && pant > 0.2) findProblem(farm, env, h, 'fans');
      if (isActive(farm, 'humid-heat') && env.houseRH >= 85 && env.houseTemp >= 30) findProblem(farm, env, 'humid-heat', 'fans');
      if (isActive(farm, 'fan-belt') && env.fansManual > defOf(farm, 'fan-belt').fan) findProblem(farm, env, 'fan-belt', 'fans');
      if (isActive(farm, 'heat-wave') && pant > 0.2 && env.dayNumber >= 30 && env.dayNumber <= 32) findProblem(farm, env, 'heat-wave', 'fans');
      const hw = stateOf(farm, 'heat-wave'); if (hw && hw.phase === 'found') hw.read = true;
      break;
    }
    case 'vent.fans': case 'vent.pad': case 'vent.stages': case 'vent.timer':
      for (const h of [...HEAT_IDS, 'humid-heat', 'rainy-spell', 'dusty-air']) {
        if (id === 'vent.timer' && h !== 'rainy-spell' && h !== 'dusty-air') continue;
        if ((id === 'vent.pad' || id === 'vent.stages') && (h === 'rainy-spell' || h === 'dusty-air')) continue;
        mark(h);
      }
      break;
    case 'litter.squeeze': {
      const m = result && result.moisturePct;
      if (isActive(farm, 'rainy-spell') && m >= 32) findProblem(farm, env, 'rainy-spell', 'squeeze');
      if (isActive(farm, 'pad-overflow') && m >= 35 && Math.hypot((a.x ?? 0) + 23, a.z ?? 0) <= 2.5) findProblem(farm, env, 'pad-overflow', 'squeeze');
      break;
    }
    case 'pad.check': {
      if (isActive(farm, 'pad-overflow')) findProblem(farm, env, 'pad-overflow', 'pad');
      if (isActive(farm, 'pad-clog')) findProblem(farm, env, 'pad-clog', 'pad');
      const hw = stateOf(farm, 'heat-wave'); if (hw && hw.phase === 'found') hw.padChecked = true;
      break;
    }
    case 'pad.fixFloat': if (result && result.fixed) fixProblem(farm, env, 'pad-overflow', 'float'); break;
    case 'pad.flush': if (result && result.fixed) fixProblem(farm, env, 'pad-clog', 'flush'); break;
    case 'fan.fix': if (result && result.fixed) fixProblem(farm, env, 'fan-belt', 'belt'); break;
    case 'water.flowtest': { const hw = stateOf(farm, 'heat-wave'); if (hw && hw.phase === 'found') hw.flowTested = true; break; }
    case 'radio.listen': {
      const def = defOf(farm, 'heat-wave');
      if (def && env.dayNumber === def.forecastDay) findProblem(farm, env, 'heat-wave', 'radio', true);
      break;
    }
    case 'sample.bird': {
      const v = result && result.value;
      if (a.look === 'gait' && v >= 3 && isActive(farm, 'lame-birds')) findProblem(farm, env, 'lame-birds', 'gait');
      if (a.look === 'droppings' && v === 'bloody' && isActive(farm, 'coccidiosis')) findProblem(farm, env, 'coccidiosis', 'droppings');
      if (a.look === 'droppings' && v === 'white' && isActive(farm, 'gumboro')) findProblem(farm, env, 'gumboro', 'droppings');
      if (a.look === 'breathing' && v === 'rattle' && isActive(farm, 'dusty-air')) findProblem(farm, env, 'dusty-air', 'breathing');
      break;
    }
    case 'air.probe':
      if (isActive(farm, 'fan-belt') && (a.x ?? 0) > 12 && env.fansManual > 0 && result && result.speedMs < 0.85 * env.fansManual * (HEAT.airSpeedAllFans / 6)) findProblem(farm, env, 'fan-belt', 'probe');
      break;
    case 'water.medicate': if (a.on) fixProblem(farm, env, 'coccidiosis', 'medicine'); break;
    case 'phone.vet':
      // the vet deals with what was reported: the Gumboro signs once found, or when the call names them
      if (stateOf(farm, 'gumboro') && (stateOf(farm, 'gumboro').phase === 'found'
        || (stateOf(farm, 'gumboro').phase === 'active' && /hunched|white/.test(String(a.reason ?? '').toLowerCase())))) fixProblem(farm, env, 'gumboro', 'vet');
      break;
    case 'swab.read': if (isActive(farm, 'swab-positive')) { findProblem(farm, env, 'swab-positive', 'lab'); secondPass(farm); } break;
    default:
  }
}

/** A listen stop at (x, z): what the farmer hears and sees there may be a symptom. */
export function cycleListen(farm, env, x, z) {
  if (!farm.cycleLevel || !(farm.flock.alive > 0)) return;
  const pant = farm.comfort.pantShare ?? 0;
  if (isActive(farm, 'rainy-spell') && env.houseRH >= 85) findProblem(farm, env, 'rainy-spell', 'listen');
  for (const h of HEAT_IDS) if (isActive(farm, h) && pant > 0.2) findProblem(farm, env, h, 'listen');
  if (isActive(farm, 'gumboro') && gumboroNow(farm.health, env) > 0.1) findProblem(farm, env, 'gumboro', 'listen');
  if (isActive(farm, 'coccidiosis') && cocciNow(farm.health, env) > 0.3 && Math.abs(Math.floor(((x + 24) / 48) * 8) - (farm.cyc.wettestZone ?? -9)) <= 0) findProblem(farm, env, 'coccidiosis', 'listen');
  if (isActive(farm, 'dusty-air') && farm.air.dustIndex > 1) findProblem(farm, env, 'dusty-air', 'listen');
  if (isActive(farm, 'humid-heat') && env.houseRH > 85 && env.houseTemp > 30) findProblem(farm, env, 'humid-heat', 'listen');
}

/** Zones where standing still is a symptom (active, not yet found). */
export function cycleZones(farm) {
  const z = [];
  if (isActive(farm, 'pad-overflow')) z.push({ problemId: 'pad-overflow', x: -23, z: 0, r: 2.5, dwellSec: 2, minMoisture: 35 });
  if (isActive(farm, 'fan-belt')) z.push({ problemId: 'fan-belt', x: 23, z: FAN_Z_OF(defOf(farm, 'fan-belt').fan), r: 2, dwellSec: 2 });
  if (isActive(farm, 'pad-clog')) z.push({ problemId: 'pad-clog', x: -23, z: -4, r: 2, dwellSec: 2 });
  return z;
}
export function cycleNear(farm, env, p) { if (p && p.problemId && isActive(farm, p.problemId)) findProblem(farm, env, p.problemId, 'near'); }

/** The office radio from Week 2: the level's weather in the farmer's words. */
export function cycleForecast(farm, env, day, base) {
  const def = farm.cycleLevel;
  if (!def) return base;
  const ev = (id) => levelProblems(farm, def).find((p) => p.id === id && p.until);
  const w = WEATHER[env.weather] || WEATHER.normal;
  const say = (text) => ({ ...base, text });
  const rain = ev('rainy-spell'), dry = ev('dusty-air'), wave = ev('heat-wave'), humid = ev('humid-heat');
  if (rain && day === rain.day - 1) return say(`Rain for two days from tomorrow. Tonight: low ${base.lowC} °C.`);
  if (dry && day === dry.day - 1) return say(`Dry air from tonight, for two days. Tomorrow: up to ${base.highC} °C.`);
  if (wave && day === wave.forecastDay) return say(`Heat wave: up to ${Math.round(w.max + wave.outsideRise)} °C for three days from tomorrow.`);
  if (humid && day === humid.day - 1) return say(`Tomorrow hot and humid, up to ${Math.round(w.max)} °C. Tonight: low ${base.lowC} °C.`);
  for (const id of HEAT_IDS) { const p = ev(id); if (p && day === p.day - 1) return say(`Tomorrow afternoon hot, up to ${Math.round(w.max + p.outsideRise)} °C. Tonight: low ${base.lowC} °C.`); }
  return base;
}

/** What the farmer sees and hears at (x, z) from Week 2 (PHASE3.md §6.13): neutral words. */
export function cycleObserve(farm, env, x, z, base) {
  const fl = farm.flock, C = farm.comfort, X = farm.cyc, air = farm.air, h = farm.health;
  if (!fl.present || !(fl.alive > 0)) return { spread: 'no birds in the house', droppings: 'none', sounds: 'quiet', air: 'still' };
  const gum = gumboroNow(h, env);
  const e = eAt(C, x);
  let spread = base.spread;
  if (gum > 0.1) spread = 'sitting hunched, feathers fluffed';
  else if ((C.pantShare ?? 0) > 0.2) spread = 'panting along the walls, wings out';
  else if (e < -1.5) spread = 'huddled together';
  else if (!farm.house.curtainOpen && (X.crowd?.ratio ?? 0) > 1.2) spread = 'crowded in the brooding half';
  else if (farm.house.curtainOpen) spread = 'spread over the whole house';
  const dl = X.droppings;
  const droppings = dl === 'bloody' ? 'blood in some droppings' : dl === 'white' ? 'white, watery droppings' : dl === 'undigested' ? 'undigested feed in the droppings'
    : dl === 'watery' ? 'wet and runny' : 'firm, some frothy caecal droppings';
  const sounds = air.dustIndex > 1.5 || air.ammoniaPpm > 25 || h.resp > 0.3 ? 'a rattle in the breathing' : e > (C.deathFrom ?? 9) - 1 ? 'gasping'
    : air.dustIndex > 1 || air.ammoniaPpm > 15 ? 'snicking' : base.sounds === 'loud peeping' ? 'loud calling' : 'quiet, a low murmur';
  const airW = env.houseRH > 85 && env.houseTemp > 30 ? 'damp, heavy heat' : env.houseRH > 85 && env.houseTemp < 26 ? 'damp air, wet patches by the walls'
    : air.ammoniaPpm > 20 ? 'the ammonia stings your eyes' : air.dustIndex > 1 ? 'dusty air' : 'fresh';
  return { spread, droppings, sounds, air: airW };
}

export { CLEAN };
