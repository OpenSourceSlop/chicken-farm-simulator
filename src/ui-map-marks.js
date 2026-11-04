// The farm map's marks over the drawn view (PHASE5.md §5.1, §5.4): the always-shown labels, words on the map, the open
// jobs' numbered markers and the farmer's arrow. Owner: package "experience" (used by ui-map.js).
import { S } from './ui-map-draw.js';

const f1 = (v) => (Math.round(v * 10) / 10).toString();

/** The always-shown labels at their laid-out boxes (map-plan.js layoutLabels), each text at its box's centre. */
export function drawLabels(svg, labels) {
  const g = S('g', { class: 'map-labels' }, svg);
  for (const l of labels) { const t = S('text', { x: f1(l.x + l.w / 2), y: f1(l.y + l.h / 2 + 4.2), 'text-anchor': 'middle', class: 'map-label' }, g); t.textContent = l.text; }
  return g;
}
/** Words in the map itself (every state also in words): on the house, beside it, in a corner. */
export function drawWord(svg, x, y, text, anchor = 'middle', cls = 'map-word') {
  const t = S('text', { x: f1(x), y: f1(y), 'text-anchor': anchor, class: cls }, svg);
  t.textContent = text;
  return t;
}
/** The open jobs' markers: an orange round with the job's number (the card's); jobs at one place side by side. */
export function drawMarkers(svg, P, spots, { view, box }) {
  const g = S('g', { class: 'map-markers' }, svg), out = [], seen = new Map();
  const big = view === 'house';
  for (const s of spots) {
    const q = P.toPx(s.x, s.z);
    if (q.x < box.x || q.y < box.y || q.x > box.x + box.w || q.y > box.y + box.h) continue;
    const r = s.current ? (big ? 11 : 10) : big ? 9 : 8;
    const cell = `${Math.round(q.x / 16)},${Math.round(q.y / 16)}`, k = seen.get(cell) || 0;
    seen.set(cell, k + 1);
    // a pin up and to the right of its place, so the place itself stays clickable; jobs at one place side by side
    const x = q.x + r + 3 + k * (2 * r - 1), y = q.y - r - 4;
    const m = S('g', { class: `map-marker${s.current ? ' is-current' : ''}`, 'data-marker': s.key, 'data-n': s.n }, g);
    S('circle', { cx: f1(x), cy: f1(y), r }, m);
    const t = S('text', { x: f1(x), y: f1(y + 4.2), 'text-anchor': 'middle' }, m);
    t.textContent = String(s.n);
    out.push({ key: s.key, n: s.n, title: s.title, x, y, r, current: !!s.current, inside: !!s.inside, at: { x: s.x, z: s.z }, name: s.name || null, el: m });
  }
  return out;
}
/** The farmer: an orange arrow at his position pointing where he faces (facing = (-sin yaw, -cos yaw), as interact reads it). */
export function drawFarmer(svg, P, player) {
  const pos = player?.position;
  if (!pos) return null;
  const q = P.toPx(pos.x, pos.z), deg = (-(player.yaw || 0) * 180) / Math.PI;
  const g = S('g', { class: 'map-me', transform: `translate(${f1(q.x)} ${f1(q.y)}) rotate(${deg.toFixed(1)})` }, svg);
  S('path', { d: 'M0 -12 L7 7 L0 3 L-7 7 Z' }, g);
  S('circle', { r: 1.6 }, g);
  return { x: q.x, y: q.y, deg: ((deg % 360) + 540) % 360 - 180 };
}
