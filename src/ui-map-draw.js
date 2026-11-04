// The farm map's drawing (PHASE5.md §5.1): the farm or the house from above in the game's flat colours, as SVG in map
// pixels (the viewBox is the box's own size, so 12 px text is 12 px on screen). Owner: package "experience". ui-map.js
// owns the panel, the keys, the tags and the walking; this file draws one view from the live state when the map opens
// (the clock stands still while it is open) and returns where everything went (ui.map.state()).
//   drawView(svg, { view: 'farm'|'house', P, box, ctx, spots, labels, present(p), shut }) -> { shapes, markers, dead, bucket, birds, farmer }
import { FARM, HOUSE_BOUNDS, HOUSE, COLORS, HEATERS, DRINKER_LINES_Z, FEEDER_LINES_Z, LINE_X, SPOTS2, SPOTS3 } from './config.js';
import { MAP_PLACES, SIGN_NUMBERS } from './map-plan.js';
import { FAN_Z } from './house-fans.js';

const NS = 'http://www.w3.org/2000/svg';
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
export const MAP_COLORS = {
  paddy: hex(COLORS.paddy), grass: hex(COLORS.grass), grassDark: hex(COLORS.grassDark), road: hex(COLORS.road), concrete: hex(COLORS.concrete),
  roofRed: hex(COLORS.roofRed), roofBlue: hex(COLORS.roofBlue), wall: hex(COLORS.wallWhite), steel: hex(COLORS.steel), steelDark: hex(COLORS.steelDark),
  pad: hex(COLORS.pad), water: hex(COLORS.water), litter: hex(COLORS.litter), heater: hex(COLORS.heater), feeder: hex(COLORS.feederPan),
  pipe: hex(COLORS.drinkerPipe), curtain: hex(COLORS.curtain), chick: hex(COLORS.chick), broiler: hex(COLORS.broiler),
  floor: '#8a7550', tree: '#3f6a2c', ink: '#14231b', accent: '#f28c28',
};
export function S(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}
const f1 = (v) => (Math.round(v * 10) / 10).toString();
/** A world rect as a map rect. */
function wr(P, x0, z0, x1, z1, attrs, parent) {
  const a = P.toPx(x0, z0), b = P.toPx(x1, z1);
  return S('rect', { x: f1(Math.min(a.x, b.x)), y: f1(Math.min(a.y, b.y)), width: f1(Math.abs(b.x - a.x)), height: f1(Math.abs(b.y - a.y)), ...attrs }, parent);
}
const wc = (P, x, z, rM, attrs, parent, minPx = 0) => { const q = P.toPx(x, z); return S('circle', { cx: f1(q.x), cy: f1(q.y), r: f1(Math.max(minPx, rM * P.scale)), ...attrs }, parent); };
const wl = (P, x0, z0, x1, z1, attrs, parent) => { const a = P.toPx(x0, z0), b = P.toPx(x1, z1); return S('line', { x1: f1(a.x), y1: f1(a.y), x2: f1(b.x), y2: f1(b.y), ...attrs }, parent); };
const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(' ')})`; };

/** The ground, the road, the paths, the fence, the trees and the buildings of the Farm view. */
function drawYard(g, P, box, ctx, present) {
  const C = MAP_COLORS, F = FARM.fence;
  S('rect', { x: box.x, y: box.y, width: box.w, height: box.h, fill: C.paddy }, g);
  // the rice fields' dikes beyond the fence
  for (let x = -60; x <= 60; x += 14) wl(P, x, -40, x, 47, { stroke: C.grassDark, 'stroke-width': 1, opacity: 0.45 }, g);
  wr(P, F.xMin, F.zMin, F.xMax, F.zMax, { fill: C.grass }, g);
  const road = [{ x: FARM.road[0].x, z: 46 }, ...FARM.road].map((p) => { const q = P.toPx(p.x, p.z); return `${f1(q.x)},${f1(q.y)}`; }).join(' ');
  S('polyline', { points: road, fill: 'none', stroke: C.road, 'stroke-width': f1(5 * P.scale), 'stroke-linejoin': 'round' }, g);
  const dp = FARM.doorPath;
  wl(P, dp[0].x, dp[0].z, dp[1].x, dp[1].z, { stroke: C.concrete, 'stroke-width': f1(2.5 * P.scale) }, g);
  // the fence, the gate gap and its posts
  const gx0 = FARM.gate.x - FARM.gate.width / 2, gx1 = FARM.gate.x + FARM.gate.width / 2;
  const fence = { stroke: '#4a5a40', 'stroke-width': 2, fill: 'none' };
  wl(P, F.xMin, F.zMin, F.xMax, F.zMin, fence, g); wl(P, F.xMin, F.zMin, F.xMin, F.zMax, fence, g); wl(P, F.xMax, F.zMin, F.xMax, F.zMax, fence, g);
  wl(P, F.xMin, F.zMax, gx0, F.zMax, fence, g); wl(P, gx1, F.zMax, F.xMax, F.zMax, fence, g);
  for (const x of [gx0, gx1]) wc(P, x, F.zMax, 0.4, { fill: '#2c3a26' }, g, 2.5);
  // the trees (the yard's round colliders) as dark rounds
  const trees = S('g', { fill: C.tree, opacity: 0.85 }, g);
  for (const c of ctx.colliders || ctx.player?.colliders || []) {
    if (c.type !== 'circle' || c.r < 0.25 || c.r > 0.75) continue;
    if (c.x > HOUSE_BOUNDS.xMin - 3 && c.x < HOUSE_BOUNDS.xMax + 3 && c.z > HOUSE_BOUNDS.zMin - 5 && c.z < HOUSE_BOUNDS.zMax + 3) continue;
    wc(P, c.x, c.z, 1.7, {}, trees, 3);
  }
  // the buildings and the machines outside, each in its own flat colour
  const B = (p) => MAP_PLACES.find((x) => x.id === p);
  const of = (id, fill, extra = {}) => { const p = B(id); return p?.rect ? wr(P, p.rect.x0, p.rect.z0, p.rect.x1, p.rect.z1, { fill, stroke: C.ink, 'stroke-width': 1, ...extra }, g) : null; };
  of('office', C.roofRed); of('guardHut', C.roofRed); of('generator', C.steelDark); of('washBay', C.concrete); of('loadingBay', C.concrete);
  wc(P, FARM.waterTank.x, FARM.waterTank.z, 1.5, { fill: C.water, stroke: C.ink, 'stroke-width': 1 }, g);
  for (const s of FARM.silos) wc(P, s.x, s.z, 1.5, { fill: C.steel, stroke: C.ink, 'stroke-width': 1 }, g);
  wl(P, FARM.silos[1].x, FARM.silos[1].z, LINE_X.start - 0.25, HOUSE_BOUNDS.zMin, { stroke: C.steelDark, 'stroke-width': 2 }, g);   // the auger to the inlet
  const gas = SPOTS3.gasTank;
  wr(P, gas.x - 1.2, gas.z - 0.6, gas.x + 1.2, gas.z + 0.6, { fill: C.wall, stroke: C.ink, 'stroke-width': 1, rx: 3 }, g);
  wc(P, SPOTS2.litterHeap.x, SPOTS2.litterHeap.z, 1.3, { fill: C.litter, stroke: '#7a6438', 'stroke-width': 1 }, g);
  wr(P, SPOTS2.deadBin.x - 0.5, SPOTS2.deadBin.z - 0.4, SPOTS2.deadBin.x + 0.5, SPOTS2.deadBin.z + 0.4, { fill: '#2f3a33' }, g);
  if (present('chickTable')) wr(P, SPOTS2.chickTable.x - 0.7, SPOTS2.chickTable.z - 0.4, SPOTS2.chickTable.x + 0.7, SPOTS2.chickTable.z + 0.4, { fill: '#c9a46a', stroke: C.ink, 'stroke-width': 0.8 }, g);
  const bs = SPOTS2.boxStacks, left = ctx.props?.stacks?.left ?? 0;
  if (left > 0 && ctx.env?.dayNumber === 0) for (let i = 0; i < left; i++) wr(P, bs.x + i * bs.dx - 0.3, bs.z - 0.3, bs.x + i * bs.dx + 0.3, bs.z + 0.3, { fill: '#e7d3a1', stroke: C.ink, 'stroke-width': 0.6 }, g);
  const H = ctx.farm?.harvest;
  if (H?.started && !H?.endedAt) { const lb = SPOTS3.loadingBay; wr(P, lb.x - 4, lb.z + 1.4, lb.x + 4, lb.z + 3.6, { fill: '#cfd6d8', stroke: C.ink, 'stroke-width': 1 }, g); }
}

/** The house from above, its roof cut away: the floor, the pad and fans, the lines, the brooders, the curtain. */
function drawHouse(g, P, ctx, { big = false } = {}) {
  const C = MAP_COLORS, Hb = HOUSE_BOUNDS, env = ctx.env || {};
  const house = S('g', { class: 'map-house-g' }, g);
  wr(P, Hb.xMin, Hb.zMin, Hb.xMax, Hb.zMax, { fill: C.floor, stroke: C.wall, 'stroke-width': big ? 4 : 2.5 }, house);
  // the door gap in the south wall
  wl(P, HOUSE.door.x - HOUSE.door.width / 2, Hb.zMax, HOUSE.door.x + HOUSE.door.width / 2, Hb.zMax, { stroke: C.concrete, 'stroke-width': big ? 5 : 3 }, house);
  wr(P, Hb.xMin, Hb.zMin + 0.3, Hb.xMin + 0.45, Hb.zMax - 0.3, { fill: C.pad }, house);                     // the cooling pad, west
  for (const z of FAN_Z) wc(P, Hb.xMax - 0.35, z, 0.62, { fill: C.steelDark, stroke: C.wall, 'stroke-width': 1 }, house, 1.6);   // the six fans, east
  for (const z of DRINKER_LINES_Z) wl(P, LINE_X.start, z, LINE_X.end, z, { stroke: C.pipe, 'stroke-width': big ? 2 : 1, opacity: 0.85 }, house);
  for (const z of FEEDER_LINES_Z) wl(P, LINE_X.start, z, LINE_X.end, z, { stroke: C.feeder, 'stroke-width': big ? 2.5 : 1.2, opacity: 0.8, 'stroke-dasharray': big ? '3 3' : '2 2' }, house);
  for (const ht of HEATERS) wc(P, ht.x, ht.z, 0.7, { fill: C.heater, stroke: C.ink, 'stroke-width': 0.8, opacity: env.broodersUp ? 0.35 : 0.95 }, house, 1.8);
  if (env.broodCurtain) wl(P, HOUSE.broodCurtainX, Hb.zMin, HOUSE.broodCurtainX, Hb.zMax, { stroke: C.curtain, 'stroke-width': big ? 4 : 2.5 }, house);
  return house;
}

/** The flock's spread: every drawn bird a dot in its colour (chick yellow to broiler white). */
function drawBirds(g, P, ctx, px) {
  const pos = ctx.flock?.positions?.();
  const out = { n: 0, inside: 0, color: null };
  if (!pos || !pos.n) return out;
  const a = P.toPx(HOUSE_BOUNDS.xMin, HOUSE_BOUNDS.zMin), b = P.toPx(HOUSE_BOUNDS.xMax, HOUSE_BOUNDS.zMax);
  const color = mix(MAP_COLORS.chick, MAP_COLORS.broiler, Math.max(0, Math.min(1, pos.morph ?? 0)));
  let d = '';
  for (let i = 0; i < pos.n; i++) {
    const q = P.toPx(pos.x[i], pos.z[i]);
    if (q.x >= a.x && q.x <= b.x && q.y >= a.y && q.y <= b.y) out.inside++;
    d += `M${f1(q.x - px / 2)} ${f1(q.y - px / 2)}h${px}v${px}h-${px}z`;
  }
  out.n = pos.n; out.color = color;
  S('path', { d, fill: color, class: 'map-birds' }, g);
  return out;
}

/** One view drawn into the svg; returns the live layers' map positions (ui.map.state()). */
export function drawView(svg, { view, P, box, ctx, spots = [], labels = [], present = () => true, shut = false, dark = false, rain = false }) {
  svg.replaceChildren();
  const big = view === 'house';
  // the resting house's hatch
  const defs = S('defs', {}, svg), hatch = S('pattern', { id: 'map-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  S('rect', { width: 8, height: 8, fill: 'rgba(20, 28, 24, 0.55)' }, hatch); S('rect', { width: 3, height: 8, fill: 'rgba(243, 236, 216, 0.28)' }, hatch);
  const base = S('g', {}, svg);
  drawYard(base, P, box, ctx, present);   // the House view too: the yard round the house at its larger scale
  drawHouse(base, P, ctx, { big });
  const live = S('g', {}, svg);
  const birds = drawBirds(live, P, ctx, big ? 3 : 2);
  if (dark) { wr(P, HOUSE_BOUNDS.xMin, HOUSE_BOUNDS.zMin, HOUSE_BOUNDS.xMax, HOUSE_BOUNDS.zMax, { fill: '#0b120e', opacity: 0.62, class: 'map-dark' }, live); }
  if (shut) wr(P, HOUSE_BOUNDS.xMin, HOUSE_BOUNDS.zMin, HOUSE_BOUNDS.xMax, HOUSE_BOUNDS.zMax, { fill: 'url(#map-hatch)', class: 'map-shut' }, live);
  // dead birds on the floor: small dark crosses; the bucket set down with its count
  const dead = { n: ctx.farm?.flock?.deadOnFloor ?? 0, crosses: 0, at: [] };
  for (const d of ctx.flock?.dead?.near?.(0, 0, 200) || []) {
    const q = P.toPx(d.x, d.z), s = big ? 4 : 3;
    S('path', { d: `M${f1(q.x - s)} ${f1(q.y - s)}L${f1(q.x + s)} ${f1(q.y + s)}M${f1(q.x + s)} ${f1(q.y - s)}L${f1(q.x - s)} ${f1(q.y + s)}`, stroke: '#1a1a1a', 'stroke-width': 2, class: 'map-dead' }, live);
    dead.crosses++; dead.at.push({ x: q.x, y: q.y });
  }
  const bd = ctx.props?.bucketDown;
  const bucket = bd ? { ...P.toPx(bd.x, bd.z), n: bd.n || 0 } : null;
  if (bucket) {
    S('rect', { x: f1(bucket.x - 5), y: f1(bucket.y - 5), width: 10, height: 10, rx: 2, fill: '#3b6ea5', stroke: '#fff', 'stroke-width': 1.5, class: 'map-bucket' }, live);
    const t = S('text', { x: f1(bucket.x + 8), y: f1(bucket.y + 4), class: 'map-tagtext' }, live); t.textContent = `bucket · ${bucket.n}`;
  }
  // the House view's own words: the two ends, the door, the curtain while it is down
  if (big) {
    const Hb = HOUSE_BOUNDS, w = (x, z, t, a = 'middle') => { const q = P.toPx(x, z); const e = S('text', { x: f1(q.x), y: f1(q.y), 'text-anchor': a, class: 'map-tagtext' }, live); e.textContent = t; };
    w(Hb.xMin, Hb.zMin - 0.9, 'Cooling pad (west end)', 'start'); w(Hb.xMax, Hb.zMin - 0.9, 'Tunnel fans (east end)', 'end');
    w(HOUSE.door.x, Hb.zMax + 1.5, 'Door');
    if (ctx.env?.broodCurtain) w(HOUSE.broodCurtainX, Hb.zMin - 0.9, 'Brooding curtain');
  }
  return { base, live, birds, dead, bucket };
}

/** The sign posts and machine marks of a view (their shapes carry data-place-shape; ui-map.js adds the events). */
export function drawPlaces(svg, P, { view, present = () => true, shut = false, box }) {
  const big = view === 'house', shapes = new Map();
  const g = S('g', { class: 'map-places-g' }, svg);
  for (const p of MAP_PLACES) {
    // in the Farm view the house is one target (its inside places about 5 px apart): they are picked in the House view
    if (p.id === 'house' || (p.inside && !big)) continue;
    const q = P.toPx(p.at.x, p.at.z);
    if (q.x < box.x - 2 || q.y < box.y - 2 || q.x > box.x + box.w + 2 || q.y > box.y + box.h + 2) continue;
    const faint = !present(p) || (shut && p.inside);
    const el = S('g', { class: `map-pl map-pl--${p.kind}${faint ? ' is-faint' : ''}`, 'data-place-shape': p.id }, g);
    const r = p.rect ? null : big ? 7 : 6;
    if (p.rect) { const a = P.toPx(p.rect.x0, p.rect.z0), b = P.toPx(p.rect.x1, p.rect.z1); S('rect', { x: f1(a.x - 2), y: f1(a.y - 2), width: f1(b.x - a.x + 4), height: f1(b.y - a.y + 4), class: 'map-hit' }, el); }
    else if (p.kind === 'sign') {
      S('rect', { x: f1(q.x - r), y: f1(q.y - r), width: f1(2 * r), height: f1(2 * r), rx: 2, class: 'map-post' }, el);
      const t = S('text', { x: f1(q.x), y: f1(q.y + 4.2), class: 'map-postn', 'text-anchor': 'middle' }, el); t.textContent = String(SIGN_NUMBERS[p.id] || '');
    } else S('rect', { x: f1(q.x - r * 0.8), y: f1(q.y - r * 0.8), width: f1(r * 1.6), height: f1(r * 1.6), rx: 1.5, class: 'map-mach' }, el);
    // a generous hit area round the small marks
    if (!p.rect) S('circle', { cx: f1(q.x), cy: f1(q.y), r: big ? 11 : 9, class: 'map-hit' }, el);
    const bb = p.rect ? (() => { const a = P.toPx(p.rect.x0, p.rect.z0), b = P.toPx(p.rect.x1, p.rect.z1); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; })() : { x: q.x - r, y: q.y - r, w: 2 * r, h: 2 * r };
    shapes.set(p.id, { el, box: bb, faint });
  }
  return shapes;
}
