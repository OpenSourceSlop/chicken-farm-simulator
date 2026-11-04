// Phase 4 (PHASE4.md §8): what the scene reads of the harder conditions, in one place. Owner: package "scene".
// Everything is off in the sandbox (farm.mode 'off') and in a run without the condition (farm.condition null), so
// every Phase 1-3 view looks exactly as before. Pure reads of the farm's state (PHASE4.md §10.4): the scene never
// changes the farm.
//   inLevel(farm)            a level runs (props, flock and the conditions' looks are on)
//   condOf(farm)             farm.condition in a level, else null
//   powerOff(farm, env)      the house has no power (farm.power.on false, or the sim's env.powerOn false)
//   rainOf(farm)             farm.weatherNow.rain 0..1 in a level (a harness may set it with no condition)
//   stormOf(farm)            a storm is on (lightning)
//   problemOn(farm, id)      a farm problem has started and is not fixed yet
//   reducedMotion()          prefers-reduced-motion: no lightning, steady alarm lamp, no flutter

export const inLevel = (farm) => !!(farm && farm.mode === 'level');
export const condOf = (farm) => (inLevel(farm) && farm.condition ? farm.condition : null);
export function powerOff(farm, env) {
  if (!inLevel(farm)) return false;
  if (env && env.powerOn === false) return true;
  return !!(farm.power && farm.power.on === false);
}
export function rainOf(farm) {
  if (!inLevel(farm) || !farm.weatherNow) return 0;
  const r = +farm.weatherNow.rain;
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}
export const stormOf = (farm) => rainOf(farm) > 0 && !!(farm.weatherNow && (farm.weatherNow.storm || farm.weatherNow.rain >= 0.5));
export function problemOn(farm, id) {
  if (!inLevel(farm) || !Array.isArray(farm.problems)) return false;
  const p = farm.problems.find((q) => q.id === id);
  return !!p && (p.phase === 'active' || p.phase === 'found');
}
// Phase 5: the system setting or the settings menu's "Reduce motion" (motion.js)
export { reducedMotion } from './motion.js';
