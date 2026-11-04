// Small DOM helpers shared by the UI files. Owner: systems/UI agent.

// h('div', { class: 'x', onclick: fn, 'aria-label': 'y' }, child, 'text', [more])
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

// A real <button>. After a mouse click it gives focus back so keys keep driving the farmer;
// keyboard users keep focus (and the visible focus ring) on the button.
export function button(attrs, ...children) {
  const b = h('button', { type: 'button', ...attrs }, ...children);
  b.addEventListener('click', (e) => { if (e.detail > 0 && !b.closest('[role="dialog"]')) b.blur(); });
  return b;
}

/** Children for replaceChildren: arrays flattened, null / false dropped (h() does the same for its children). */
export const nodes = (...c) => c.flat(4).filter((x) => x != null && x !== false);

// Write text only when it changed (keeps per-frame HUD updates cheap).
export function setText(el, s) {
  if (el.__text !== s) { el.__text = s; el.textContent = s; }
}
export function setAttr(el, name, value) {
  const v = String(value);
  if (el.getAttribute(name) !== v) el.setAttribute(name, v);
}

let uid = 0;
export const uniqueId = (prefix) => `${prefix}-${++uid}`;

// Phase 5: one answer for the whole game (motion.js: the system setting or the settings menu's "Reduce motion")
export { reducedMotion } from './motion.js';

// localStorage can throw (private mode, blocked site data); never let that break the game.
export const store = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* ignore */ } },
};

// Number formatting: one decimal, no "-0.0", real minus sign.
export function fmt1(n) {
  const v = Math.round(n * 10) / 10;
  const s = Math.abs(v).toFixed(1);
  return v < 0 ? `−${s}` : s;
}
export function fmt0(n) {
  const v = Math.round(n);
  return v < 0 ? `−${Math.abs(v)}` : String(v);
}

// Focus in a form control (slider, select, checkbox): arrow keys belong to the control.
export function inFormControl(target) {
  return !!(target && target.closest && target.closest('input, select, textarea'));
}
// Focus in a place where letters are typed as text (none in Phase 1, kept for safety).
export function typingInControl(target) {
  return !!(target && target.matches && target.matches('textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"])'));
}
