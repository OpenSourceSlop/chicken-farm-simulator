// Keyboard and mouse input for the farmer and camera. Keys are read by physical position
// (KeyboardEvent.code), so WASD works with a Thai or any other keyboard layout and Caps Lock.
// E and Escape belong to the UI and are never used here. Only events on the canvas count for
// the mouse, so HUD clicks never walk the farmer.

import { clock } from './clock.js';

const MOVE = { KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r' };
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const ROTATE = { ArrowLeft: 1, ArrowRight: -1 };
const ZOOM_IN = new Set(['Equal', 'NumpadAdd']);
const ZOOM_OUT = new Set(['Minus', 'NumpadSubtract']);
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

// Fallback for keyboards that report no useful code for + and -.
function keyAction(e) {
  if (MOVE[e.code]) return 'move';
  if (RUN.has(e.code)) return 'run';
  if (ROTATE[e.code]) return 'rotate';
  if (ZOOM_IN.has(e.code) || e.key === '+') return 'zoomIn';
  if (ZOOM_OUT.has(e.code) || e.key === '-') return 'zoomOut';
  return null;
}

export function createInput(canvas) {
  const held = new Set(); // codes (plus 'zoomIn' / 'zoomOut')
  const st = {
    enabled: true,
    orbitPx: 0, // accumulated horizontal drag pixels (consumed each frame)
    wheel: 0, // accumulated wheel delta in pixels (consumed each frame)
    clicks: [], // pending walk clicks in client pixels
    drag: null,
    lastClick: null,
  };

  const releaseAll = () => { held.clear(); };

  function onKeyDown(e) {
    if (e.code === 'MetaLeft' || e.code === 'MetaRight') { releaseAll(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    if (isFormTarget(e.target)) return;
    const act = keyAction(e);
    if (!act) return;
    if (act === 'run') { held.add(e.code); return; } // Shift alone is harmless even when disabled
    if (!st.enabled) return;
    if (act === 'zoomIn') held.add('zoomIn');
    else if (act === 'zoomOut') held.add('zoomOut');
    else held.add(e.code);
    if (act === 'rotate' || act === 'zoomIn' || act === 'zoomOut') e.preventDefault();
  }

  // Releasing is always safe, whatever has focus, so keys can never stick.
  function onKeyUp(e) {
    const act = keyAction(e);
    if (act === 'zoomIn') held.delete('zoomIn');
    else if (act === 'zoomOut') held.delete('zoomOut');
    held.delete(e.code);
    if (!e.shiftKey) { held.delete('ShiftLeft'); held.delete('ShiftRight'); }
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
    has: (code) => held.has(code),
    get running() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    // -1..1 axes in screen terms: forward and right
    axes(out) {
      out.f = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0);
      out.r = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
      out.any = held.has('KeyW') || held.has('KeyS') || held.has('KeyA') || held.has('KeyD');
      return out;
    },
    rotateAxis() { return (held.has('ArrowLeft') ? 1 : 0) - (held.has('ArrowRight') ? 1 : 0); },
    zoomAxis() { return (held.has('zoomOut') ? 1 : 0) - (held.has('zoomIn') ? 1 : 0); },
    takeOrbit() { const v = st.orbitPx; st.orbitPx = 0; return v; },
    takeWheel() { const v = st.wheel; st.wheel = 0; return v; },
    takeClick() { return st.clicks.shift() || null; },
    dispose() { for (const [t, type, fn, o] of listeners) t.removeEventListener(type, fn, o); },
  };
}
