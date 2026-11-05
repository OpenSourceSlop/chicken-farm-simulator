// The farm map's marks over the drawn view (PHASE5.md §5.1, §5.4): the always-shown labels, words on the map, the open
// jobs' numbered markers (laid out by map-marks-plan.js) and the farmer's arrow. Owner: package "experience" (used by ui-map.js).
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
/** The open jobs' markers as laid out by map-marks-plan.js layoutMarkers (fix round): a short leader from the place's
 *  point to its marker, an orange round with the job's number (the card's), or one pill for the jobs at one place
 *  ('4 · 5 · 7'). */
export function drawMarkers(svg, laid) {
  const g = S('g', { class: 'map-markers' }, svg), out = [];
  for (const m of laid) {
    const el = S('g', { class: `map-marker${m.current ? ' is-current' : ''}${m.pill ? ' is-pill' : ''}`, 'data-marker': m.key, 'data-n': m.ns.join(',') }, g);
    if (m.leader) S('line', { x1: f1(m.leader.x1), y1: f1(m.leader.y1), x2: f1(m.leader.x2), y2: f1(m.leader.y2), class: 'map-leader' }, el);
    S('circle', { cx: f1(m.px.x), cy: f1(m.px.y), r: 2.2, class: 'map-markpt' }, el);
    if (m.pill) S('rect', { x: f1(m.x - m.w / 2), y: f1(m.y - m.h / 2), width: f1(m.w), height: f1(m.h), rx: f1(m.h / 2), class: 'map-pill' }, el);
    else S('circle', { cx: f1(m.x), cy: f1(m.y), r: m.r }, el);
    const t = S('text', { x: f1(m.x), y: f1(m.y + 4.2), 'text-anchor': 'middle' }, el);
    t.textContent = m.text;
    out.push({ ...m, el });
  }
  return out;
}
/** The farmer: an orange arrow at his position pointing where he faces (facing = (-sin yaw, -cos yaw), as interact reads it). */
export function drawFarmer(svg, P, player) {
  const pos = player?.position;
  if (!pos) return null;
  const q = P.toPx(pos.x, pos.z), deg = (-(player.yaw || 0) * 180) / Math.PI;
  const g = S('g', { class: 'map-me', transform: `translate(${f1(q.x)} ${f1(q.y)}) rotate(${deg.toFixed(1)})` }, svg);
  S('path', { d: 'M0 -12 L7 7 L0 3 L-7 7 Z', class: 'map-me-halo' }, g);   // fix round: the labels' light halo under it
  S('path', { d: 'M0 -12 L7 7 L0 3 L-7 7 Z' }, g);
  S('circle', { r: 1.6 }, g);
  return { x: q.x, y: q.y, deg: ((deg % 360) + 540) % 360 - 180 };
}
