// Phase 4: the rainy season's model (PHASE4.md §4.2) — the power (the mains, the transfer switch, the generator and its
// fuel), the house dark again (gen-dry), the mains' return (mains-back), storms (farm.weatherNow), rain blowing in at the
// south inlets with the storm flaps open (rain-in), the flaps (the timer air x 0.7 while closed) and the damp spell.
// Package "sim", pure logic. Every change of the house's power emits EV.POWER { on, source, mains }; env.powerOn follows.
import { GENERATOR, CONDITIONS } from './config.js';
import { EV } from './events.js';
import { at, H, stateOf, condDef, levelFor, isOn, isActive, condFind, condFix, pState, RAIN_CELLS, onRainStrip } from './farm-cond-core.js';
import { addWater, cellCentre } from './farm-litter.js';
import { cycleAct } from './farm-cycle-act.js';
import { doAct } from './farm-act.js';

// the rain-in strip's water (config: the rainy season's week 3 problem; later storms wet the strip too)
const RAIN_IN = CONDITIONS.rainy.levels.week3.problems.find((p) => p.id === 'rain-in');
export const FLAPS_AIR = 0.7;   // model: the timer air the inlets let in with the storm flaps closed (half shut)

export const powerFresh = () => ({
  power: { mains: true, on: true, source: 'mains', switch: 'mains' },
  generator: { running: false, fuelL: GENERATOR.fuelL, hours: 0, testedDay: null, startedAt: null, hoursLeft: GENERATOR.fuelL / GENERATOR.litresPerH },
  weatherNow: { rain: 0, storm: false, id: null },
});

/** The cut has been met: the power-cut problem found (its alarm) or fixed. */
const cutMet = (farm) => { const s = stateOf(farm, 'power-cut'); return !!s && (s.phase === 'found' || s.phase === 'fixed'); };

/**
 * The house's power from the transfer switch: its source is live (the mains, or the generator running). env.powerOn
 * follows; on a change EV.POWER. `why` 'gen': the generator stopped (dry or stopped by hand) — with the switch on the
 * generator after the cut was met, the house dark again is the gen-dry alarm (re-armed each time).
 */
export function setPowerEnv(farm, env, reset, why = null) {
  const P = farm.power, G = farm.generator;
  if (P.switch !== 'generator') P.switch = 'mains';
  const on = P.switch === 'generator' ? !!G.running : !!P.mains;
  const was = P.on;
  P.on = on; P.source = on ? P.switch : null;
  env.setPower(on);
  if (reset || was === on) return;
  farm.emit(EV.POWER, { on, source: P.source, mains: !!P.mains });
  if (on) { condFix(farm, env, 'power-cut', 'power'); condFix(farm, env, 'gen-dry', 'power'); return; }
  if (why === 'gen' && P.switch === 'generator' && farm.condition === 'rainy' && cutMet(farm)) {
    const st = stateOf(farm, 'gen-dry');
    if (st) { if (st.phase !== 'pending') Object.assign(st, pState('gen-dry')); condFind(farm, env, 'gen-dry', 'alarm', true); }
  }
}

/** A condition problem's start (farm-cond startCond): the power cut takes the mains off. */
export function powerStart(farm, env, st) {
  if (st.id === 'power-cut') { farm.power.mains = false; farm.condX.mainsBack = false; setPowerEnv(farm, env, false, 'cut'); }
  if (st.id === 'rain-in' && farm.house.flapsClosed) condFix(farm, env, 'rain-in', 'flaps');   // the flaps were shut first
}

/** The generator's fuel, the mains' return after the cut. */
export function stepGen(farm, env, hrs) {
  const G = farm.generator, P = farm.power, X = farm.condX;
  if (G.running && hrs > 0) {
    G.hours += hrs; G.fuelL = Math.max(0, G.fuelL - GENERATOR.litresPerH * hrs); G.hoursLeft = G.fuelL / GENERATOR.litresPerH;
    if (G.fuelL <= 1e-9) { G.fuelL = 0; G.hoursLeft = 0; G.running = false; setPowerEnv(farm, env, false, 'gen'); }
  }
  if (P.mains || X.mainsBack) return;
  const cut = condDef(farm, 'power-cut'), st = stateOf(farm, 'power-cut');
  if (!cut || !cut.back || !st || st.phase === 'pending' || st.phase === 'ended' || env.day < at(cut.back.day, cut.back.hour) - 1e-9) return;
  P.mains = true; X.mainsBack = true;
  // the transfer switch's mains lamp: the mains back while the generator carries the house
  if (P.switch === 'generator' && G.running) condFind(farm, env, 'mains-back', 'switch', true);
  setPowerEnv(farm, env, false, 'mains');
}

/** The rainy season's weather on the farm: the storm now, rain at the inlets, the damp spell's rule. */
export function stepRainy(farm, env, hrs) {
  const t = env.day, W = farm.weatherNow, X = farm.condX;
  const s = levelFor(farm).problems.find((p) => p.storm === true && p.until && t >= at(p.day, p.hour) && t < at(p.until.day, p.until.hour));
  W.storm = !!s; W.rain = s ? 1 : 0; W.id = s ? s.id : null;
  // storms end quietly (weather only)
  for (const p of levelFor(farm).problems) if (p.storm === true && p.until && t >= at(p.until.day, p.until.hour)) { const st = stateOf(farm, p.id); if (st && st.phase === 'active') st.phase = 'ended'; }
  // rain blows in at the south inlets from the first time (rain-in, day 19), every storm while the flaps are open
  const ri = stateOf(farm, 'rain-in');
  if (s && !farm.house.flapsClosed && ri && ri.startedAt != null && hrs > 0) {
    const kg = RAIN_IN.litresPerCellH * hrs;
    for (const i of RAIN_CELLS) addWater(farm.litter, i, kg);
    (X.rainDays || (X.rainDays = {}))[env.dayNumber] = 1;
  }
  // the damp spell (as Phase 3's rainy spell): dried out by more air (house RH at or under 85 % for an hour after he
  // changed the air), or passed with the weather when nobody met it
  const ds = stateOf(farm, 'damp-spell'), dd = condDef(farm, 'damp-spell');
  if (ds && dd && (ds.phase === 'active' || ds.phase === 'found')) {
    const ended = t >= at(dd.until.day, dd.until.hour) - 1e-9, ok = ds.phase === 'found' && ds.acted && env.houseRH <= 85;
    ds.okSince = ok ? (ds.okSince ?? t) : null;
    if (ok && t - ds.okSince >= H - 1e-9) condFix(farm, env, 'damp-spell', 'air');
    else if (ended && ds.phase === 'active') condFix(farm, env, 'damp-spell', 'weather');
  }
}

/** The generator, the transfer switch, the storm flaps (PHASE4.md §10.3: every one answers at once). */
export function powerAct(farm, env, id, a = {}) {
  const G = farm.generator, P = farm.power, X = farm.condX;
  switch (id) {
    case 'gen.start':
      if (G.fuelL > 0 && !G.running) { G.running = true; G.startedAt = +env.day.toFixed(5); }
      setPowerEnv(farm, env, false, 'start');
      return { running: G.running, fuelL: Math.round(G.fuelL), hoursLeft: +G.hoursLeft.toFixed(1) };
    case 'gen.stop':
      G.running = false;
      setPowerEnv(farm, env, false, 'gen');
      if (P.switch === 'mains' && P.mains) condFix(farm, env, 'mains-back', 'switch');
      return { running: false, fuelL: Math.round(G.fuelL) };
    case 'gen.switch':
      P.switch = a.to === 'generator' ? 'generator' : 'mains';
      setPowerEnv(farm, env, false, 'switch');
      if (P.switch === 'mains' && !G.running && P.mains) condFix(farm, env, 'mains-back', 'switch');
      return { on: P.on, source: P.source };
    case 'gen.test': {
      const ok = G.fuelL > 0;
      G.testedDay = env.dayNumber; G.fuelL = Math.max(0, G.fuelL - (GENERATOR.litresPerH * GENERATOR.testMin) / 60); G.hoursLeft = G.fuelL / GENERATOR.litresPerH;
      if (!G.running) G.hours += GENERATOR.testMin / 60;
      if (ok) X.genTests.push(env.dayNumber);
      return { ok, fuelL: Math.round(G.fuelL), minutes: GENERATOR.testMin };
    }
    case 'gen.fuel': G.fuelL = GENERATOR.fuelL; G.hoursLeft = G.fuelL / GENERATOR.litresPerH; return { fuelL: G.fuelL };
    case 'inlets.storm': {
      farm.house.flapsClosed = !!a.closed; env.setInletShare(farm.house.flapsClosed ? FLAPS_AIR : 1);
      const log = X.flaps || (X.flaps = []); log.push([+env.day.toFixed(5), farm.house.flapsClosed ? 1 : 0]); if (log.length > 40) log.shift();
      return true;
    }
    case 'litter.patch': {
      if (farm.condition !== 'rainy') return undefined;
      const base = cycleAct(farm, env, id, a) ?? doAct(farm, env, id, a);
      return { ...(base && typeof base === 'object' ? base : {}), onRain: onRainStrip(a.x ?? 0, a.z ?? 0) };
    }
    default: return undefined;
  }
}

/** Symptoms and fixes of the rainy season carried by actions. */
export function powerSymptoms(farm, env, id, a, result) {
  if (farm.condition !== 'rainy') return;
  switch (id) {
    case 'inlets.storm': if (a.closed) condFix(farm, env, 'rain-in', 'flaps'); break;
    case 'litter.squeeze': if (isActive(farm, 'rain-in') && result && result.moisturePct >= 35 && onRainStrip(a.x ?? 0, a.z ?? 0)) condFind(farm, env, 'rain-in', 'squeeze'); break;
    case 'controller.read': if (isActive(farm, 'damp-spell') && (a.rh ?? env.houseRH) >= 80) condFind(farm, env, 'damp-spell', 'controller'); break;
    case 'vent.timer': case 'vent.fans': { const st = stateOf(farm, 'damp-spell'); if (st && st.phase === 'found') st.acted = true; break; }
    default:
  }
}
/** A listen stop: rain at the inlets on the strip, the damp air. */
export function powerBus(farm, env, type, p) {
  if (farm.condition !== 'rainy' || type !== EV.LISTEN) return;
  if (isActive(farm, 'rain-in') && onRainStrip(p.x ?? 0, p.z ?? 0) && (farm.weatherNow.storm || wettest(farm).m >= 35)) condFind(farm, env, 'rain-in', 'listen');
  if (isActive(farm, 'damp-spell') && env.houseRH >= 85) condFind(farm, env, 'damp-spell', 'listen');
}
function wettest(farm) {
  let best = RAIN_CELLS[0], m = -1;
  for (const i of RAIN_CELLS) if (farm.litter.moistureGrid[i] > m) { m = farm.litter.moistureGrid[i]; best = i; }
  return { i: best, m };
}
/** The wet strip by the south wall (EV.NEAR there, the litter at least 35 %): centred on its wettest cell. */
export function powerZones(farm) {
  if (farm.condition !== 'rainy' || !isActive(farm, 'rain-in')) return [];
  const w = wettest(farm), c = cellCentre(w.i);
  return w.m >= 35 ? [{ problemId: 'rain-in', x: c.x, z: c.z, r: 3, dwellSec: 2, minMoisture: 35 }] : [];
}
export { isOn };
