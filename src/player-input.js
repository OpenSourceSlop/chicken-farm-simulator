// Keyboard and mouse input for the farmer and camera. Keys are read by physical position
// (KeyboardEvent.code), so WASD works with a Thai or any other keyboard layout and Caps Lock.
// E and Escape belong to the UI and are never used here. Only events on the canvas count for
// the mouse, so HUD clicks never walk the farmer.
// Phase 5 (PHASE5.md §4.3, package "settings"): every move, turn and zoom key is keys.js's (keys.matches), so a key rebound in
// Settings -> Keys walks him at once; a held key is remembered by its physical key with the action it had when pressed, so
// a release always lets go (a rebind while a key is down cannot leave him walking).

import { clock } from './clock.js';
import { createKeys } from './keys.js';

/** The actions this module reads (keys.js ids). */
export const MOVE_ACTIONS = ['forward', 'back', 'left', 'right', 'run', 'turnLeft', 'turnRight', 'zoomIn', 'zoomOut'];
const DRAG_PX = 5;
const DOUBLE_MS = 380;
const DOUBLE_PX = 24;

// Keys typed into text-like controls (text fields, selects, text areas, editable text) are not
// for the farmer. A focused HUD button, slider or checkbox keeps WASD walking (ui.js stops the
// arrow keys a slider needs before they reach us).
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'image']);
function isFormTarget(t) {
  if (!t || t === window || t === document) return false;
  const tag = t.tagName;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((t.type || 'text').toLowerCase());
  return tag === 'SELECT' || tag === 'TEXTAREA' || !!t.isContentEditable;
}

/** The farmer's action of a key event (keys.js), with the Phase 1 fallback for keyboards that report no useful code for
 *  + and − (only when the key is no other action's). */
export function moveActionOf(keys, e) {
  const id = keys.actionOf(e, MOVE_ACTIONS);
  if (id) return id;
  if (e.key !== '+' && e.key !== '-') return null;
  if (keys.actionOf(e)) return null;
  return e.key === '+' ? 'zoomIn' : 'zoomOut';
}
const keyOf = (e) => e.code || `key:${(e.key || '').toLowerCase()}`;

export function createInput(canvas, keysIn = null) {
  const keys = keysIn || createKeys(null);
  const down = new Map(); // physical key -> the action it had when pressed
  const held = new Set(); // the actions held now (forward, run, zoomIn …)
  const sync = () => { held.clear(); for (const a of down.values()) held.add(a); };
  const st = {
    enabled: true,
    orbitPx: 0, // accumulated horizontal drag pixels (consumed each frame)
    wheel: 0, // accumulated wheel delta in pixels (consumed each frame)
    clicks: [], // pending walk clicks in client pixels
    drag: null,
    lastClick: null,
  };

  const releaseAll = () => { down.clear(); held.clear(); };

  function onKeyDown(e) {
    if (e.code === 'MetaLeft' || e.code === 'MetaRight') { releaseAll(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    if (isFormTarget(e.target)) return;
    const act = moveActionOf(keys, e);
    if (!act) return;
    if (act === 'run') { down.set(keyOf(e), act); sync(); return; } // Shift alone is harmless even when disabled
    if (!st.enabled) return;
    down.set(keyOf(e), act); sync();
    if (act === 'turnLeft' || act === 'turnRight' || act === 'zoomIn' || act === 'zoomOut') e.preventDefault();
  }

  // Releasing is always safe, whatever has focus, so keys can never stick.
  function onKeyUp(e) {
    down.delete(keyOf(e));
    if (e.code) down.delete(`key:${(e.key || '').toLowerCase()}`);
    if (!e.shiftKey) for (const [k, a] of down) if (a === 'run') down.delete(k);
    sync();
  }

  function endDrag() {
    const d = st.drag;
    if (!d) return;
    st.drag = null;
    try { if (canvas.hasPointerCapture?.(d.id)) canvas.releasePointerCapture(d.id); } catch { /* already released */ }
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch') return;
    if (st.drag) endDrag(); // a drag whose release we never saw must not block new clicks
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    if (e.button === 1) e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch { /* focus is optional */ }
    st.drag = { id: e.pointerId, button: e.button, x0: e.clientX, y0: e.clientY, last: e.clientX, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is optional */ }
  }

  function onPointerMove(e) {
    const d = st.drag;
    if (!d || e.pointerId !== d.id) return;
    if (e.buttons === 0) { endDrag(); return; } // released somewhere we did not hear about
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > DRAG_PX) d.moved = true;
    // Right or middle drag turns the view; a left drag (beyond the click threshold) does too,
    // which helps on laptop touchpads where a right-drag is awkward.
    if (d.moved) st.orbitPx += e.clientX - d.last;
    d.last = e.clientX;
  }

  function onPointerUp(e) {
    const d = st.drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.button === 0 && !d.moved && st.enabled) {
      // A quick second click near the first one means "run there".
      const now = clock.now(); // real time; under the harness's fixed steps the steps' own clock
      const lc = st.lastClick;
      const double = !!lc && now - lc.t < DOUBLE_MS && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < DOUBLE_PX;
      st.lastClick = double ? null : { t: now, x: e.clientX, y: e.clientY };
      st.clicks.push({ x: e.clientX, y: e.clientY, shift: e.shiftKey, double });
    }
    endDrag();
  }

  function onWheel(e) {
    e.preventDefault(); // no page scroll or pinch-zoom of the page over the game
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33;
    else if (e.deltaMode === 2) dy *= 600;
    if (e.ctrlKey) dy *= 3; // touchpad pinch arrives as small ctrl+wheel steps
    st.wheel += Math.max(-600, Math.min(600, dy));
  }

  const onContextMenu = (e) => e.preventDefault();
  const onMouseDown = (e) => { if (e.button === 1) e.preventDefault(); }; // no autoscroll
  const onBlur = () => { releaseAll(); endDrag(); };
  const onVisibility = () => { if (document.hidden) onBlur(); };

  const listeners = [
    [window, 'keydown', onKeyDown],
    [window, 'keyup', onKeyUp],
    [window, 'blur', onBlur],
    [document, 'visibilitychange', onVisibility],
    [canvas, 'pointerdown', onPointerDown],
    [canvas, 'pointermove', onPointerMove],
    [canvas, 'pointerup', onPointerUp],
    [canvas, 'pointercancel', endDrag],
    [canvas, 'lostpointercapture', (e) => { if (st.drag && e.pointerId === st.drag.id) st.drag = null; }],
    [canvas, 'wheel', onWheel, { passive: false }],
    [canvas, 'contextmenu', onContextMenu],
    [canvas, 'mousedown', onMouseDown],
  ];
  for (const [t, type, fn, o] of listeners) t.addEventListener(type, fn, o);

  return {
    held,
    get enabled() { return st.enabled; },
    set enabled(v) {
      st.enabled = !!v;
      if (!st.enabled) { releaseAll(); st.clicks.length = 0; }
    },
    /** An action held now ('forward' …), or a physical key held for one of them ('KeyW'). */
    has: (id) => held.has(id) || down.has(id),
    get running() { return held.has('run'); },
    // -1..1 axes in screen terms: forward and right
    axes(out) {
      out.f = (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0);
      out.r = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      out.any = held.has('forward') || held.has('back') || held.has('left') || held.has('right');
      return out;
    },
    rotateAxis() { return (held.has('turnLeft') ? 1 : 0) - (held.has('turnRight') ? 1 : 0); },
    zoomAxis() { return (held.has('zoomOut') ? 1 : 0) - (held.has('zoomIn') ? 1 : 0); },
    takeOrbit() { const v = st.orbitPx; st.orbitPx = 0; return v; },
    takeWheel() { const v = st.wheel; st.wheel = 0; return v; },
    takeClick() { return st.clicks.shift() || null; },
    dispose() { for (const [t, type, fn, o] of listeners) t.removeEventListener(type, fn, o); },
  };
}
