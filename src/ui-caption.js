// Neutral captions (what the farmer sees, hears or reads: "You see: chicks evenly spread …",
// "Litter 22 %: falls apart") and the reading that floats over the farmer for 3 s after T.
// Owner: package "level".
import { h, setText, reducedMotion } from './ui-dom.js';

export function createCaption(root) {
  const text = h('p', { class: 'caption-text' });
  const el = h('div', { class: 'caption', hidden: true, role: 'status', 'aria-live': 'polite' }, text);
  root.appendChild(el);
  const queue = [];
  let left = 0;
  // now: replace the caption showing (feedback on what the farmer just did: the bucket set down, PHASE4.md §15.3)
  function show(msg, seconds = 4.5, { now = false } = {}) {
    if (!msg) return;
    if (!now && !el.hidden && left > 1.2) { queue.push([msg, seconds]); if (queue.length > 3) queue.shift(); return; }
    setText(text, msg); el.hidden = false; left = seconds;
    el.classList.remove('is-in'); void el.offsetWidth; if (!reducedMotion()) el.classList.add('is-in');
  }
  return {
    show,
    clear() { queue.length = 0; left = 0; el.hidden = true; },
    update(dt) {
      if (el.hidden) return;
      left -= dt;
      if (left <= 0) { el.hidden = true; const n = queue.shift(); if (n) show(n[0], n[1]); }
    },
  };
}

/** A reading floating over the farmer's head (3 s), projected from 3D each frame. */
export function createFloatLabel(root, ctx) {
  const el = h('div', { class: 'float-read', hidden: true, 'aria-hidden': 'true' });
  root.appendChild(el);
  const v = new ctx.THREE.Vector3();
  let left = 0;
  return {
    show(msg, seconds = 3) { setText(el, msg); el.hidden = false; left = seconds; },
    update(dt) {
      if (el.hidden) return;
      left -= dt;
      if (left <= 0) { el.hidden = true; return; }
      const p = ctx.player.position;
      v.set(p.x, 2.2, p.z).project(ctx.camera);
      const x = (v.x * 0.5 + 0.5) * root.clientWidth, y = (-v.y * 0.5 + 0.5) * root.clientHeight;
      el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
      el.style.opacity = String(Math.min(1, left / 0.4));
    },
  };
}
