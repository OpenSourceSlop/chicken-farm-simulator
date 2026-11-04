// Reduced motion, one answer for the whole game (PHASE5.md §4.1, §6.6): the computer's prefers-reduced-motion, or the
// settings menu's "Reduce motion: Always" (settings.js calls setMotionOverride). While it is on the page carries the class
// `reduce-motion` on <html> (index.template.html stops every transition and animation under it) and the 3D reads
// reducedMotion(): no lightning flashes, a steady alarm lamp, no bobbing markers or pulsing chips, no generator shake.
// ui-dom.js and world-cond.js re-export reducedMotion from here. Owner: integrator (frozen).
const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let override = 'system';

function sync() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.classList.toggle('reduce-motion', reducedMotion());
}
query?.addEventListener?.('change', sync);

/** True while motion should be reduced (the setting 'on', or the system asks for it). */
export const reducedMotion = () => override === 'on' || !!(query && query.matches);
/** 'system' (default) | 'on'. */
export function setMotionOverride(v) { override = v === 'on' ? 'on' : 'system'; sync(); }
export const motionOverride = () => override;
sync();
