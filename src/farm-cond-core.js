// Phase 4: the shared helpers of the conditions' model (farm-cond*.js). Package "sim", pure logic: the level as the
// farm's condition plays it (cached config conditionLevel), problem states, and the symptom / fix of a condition problem.
import { LEVEL1, conditionLevel } from './config.js';
import { EV } from './events.js';

export const at = (d, h) => d + h / 24;
export const H = 1 / 24;
export const pState = (id) => ({ id, phase: 'pending', startedAt: null, foundAt: null, fixedAt: null, foundBy: null });
export const stateOf = (farm, id) => farm.problems.find((p) => p.id === id) || null;

/** The level of the farm now (the cycle level from Week 2, the plan level, or the brooding week). */
export const levelDef = (farm) => farm.cycleLevel || farm.level || LEVEL1;
/** The level as the farm's condition plays it, cached (config conditionLevel is pure). */
export function levelFor(farm, def = levelDef(farm)) {
  const key = `${def.id}|${farm.condition || ''}`, c = farm._lvCache;
  if (c && c.key === key && c.def === def) return c.value;
  const value = conditionLevel(def, farm.condition);
  farm._lvCache = { key, def, value };
  return value;
}
/** A merged problem def of the level now (null when the level as the condition plays it has none). */
export const condDef = (farm, id) => levelFor(farm).problems.find((p) => p.id === id) || null;
/** The level def's own problem (not one the condition added). */
export const isOwn = (farm, id) => (levelDef(farm).problems || []).some((p) => p.id === id);
export const isOn = (farm, id) => { const s = stateOf(farm, id); return !!s && (s.phase === 'active' || s.phase === 'found'); };
export const isActive = (farm, id) => { const s = stateOf(farm, id); return !!s && s.phase === 'active'; };

/** The farmer met a condition problem's symptom: found, EV.FARM_PROBLEM symptom (alarm problems carry alarm: true). */
export function condFind(farm, env, id, by, allowPending = false) {
  const st = stateOf(farm, id), def = condDef(farm, id);
  if (!st || !(st.phase === 'active' || (allowPending && st.phase === 'pending'))) return false;
  if (st.phase === 'pending') { st.phase = 'active'; st.startedAt = env.day; farm.emit(EV.FARM_PROBLEM, { id, phase: 'start' }); }
  st.phase = 'found'; st.foundAt = env.day; st.foundBy = by;
  farm.emit(EV.FARM_PROBLEM, { id, phase: 'symptom', by, ...(def && def.alarm ? { alarm: true } : {}) });
  return true;
}
/** A condition problem fixed (an active one never met is fixed quietly: 'passed', as Phase 3's weather). */
export function condFix(farm, env, id, by) {
  const st = stateOf(farm, id);
  if (!st || st.phase === 'fixed' || st.phase === 'pending' || st.phase === 'ended') return false;
  const unseen = st.phase === 'active';
  st.phase = 'fixed'; st.fixedAt = env.day; st.fixedBy = by;
  if (unseen) st.unseen = true;
  farm.emit(EV.FARM_PROBLEM, { id, phase: unseen ? 'passed' : 'fixed', by });
  return true;
}
/** The house strip by the south side-wall inlets (the rainy season's rain-in): two cell rows, x -12..12. */
export const RAIN_CELLS = [];
for (let iz = 10; iz < 12; iz++) for (let ix = 12; ix < 36; ix++) RAIN_CELLS.push(iz * 48 + ix);
export const onRainStrip = (x, z) => Math.abs(x) <= 12 && z >= 4 && z <= 6;
