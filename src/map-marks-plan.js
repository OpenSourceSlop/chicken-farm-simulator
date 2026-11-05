// The farm map's marks, the pure part (fix round after the Phase 5 review): where the sign posts and machine marks sit,
// the open jobs' markers merged by place and laid out clear of the labels, the posts, the farmer and each other, and the
// side list's rows (one row a job, by job number). No DOM: ui-map-marks.js draws what this returns and scripts/test-map.mjs
// checks there are no overlaps on the planning and prep days at 960 x 600 and 1280 x 800. Owner: package "experience".
//
//   markBoxes(P, box, view)               -> [{ id, kind, x, y, w, h }] the sign posts' boards and the machine marks drawn
//   buildingCentres(P, box)               -> the middle of each building (its click target), kept clear of markers
//   signText(id)                          'S3': a sign's mark on the map, the side list and the tag (letter and number, so it
//                                         never reads as job 3, whose marker is an orange round with a bare number)
//   layoutMarkers(P, box, spots, { view, obstacles })
//                                         -> [{ key, keys, ns, n, text, title, titles, x, y, w, h, r, pill, current, inside,
//                                              at: { x, z }, px: { x, y }, leader, places }]
//   jobRows(spots, from)                  -> [{ n, key, title, current, inside, places: [spot, …] (nearest first) }] by n
import { MAP_PLACES, SIGN_NUMBERS, labelWidth, boxesOverlap } from './map-plan.js';

const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
export const signText = (id) => (SIGN_NUMBERS[id] ? `S${SIGN_NUMBERS[id]}` : '');
/** A sign board's size on the map: wide enough for 'S12' in 11 px bold. */
export const postSize = (id, big) => ({ w: Math.max(big ? 18 : 16, Math.ceil(labelWidth(signText(id), 11) * 1.12) + 5), h: big ? 14 : 13 });

/** The marks drawPlaces draws for a view (the same rules): every place but the house, the inside ones only in the House
 *  view, those inside the map box. Signs are small boards (w x h) on a short leg, machines small squares. */
export function markBoxes(P, box, view) {
  const big = view === 'house', out = [];
  for (const p of MAP_PLACES) {
    if (p.id === 'house' || (p.inside && !big) || p.rect) continue;
    const q = P.toPx(p.at.x, p.at.z);
    if (q.x < box.x - 2 || q.y < box.y - 2 || q.x > box.x + box.w + 2 || q.y > box.y + box.h + 2) continue;
    if (p.kind === 'sign') { const s = postSize(p.id, big); out.push({ id: p.id, kind: 'sign', x: q.x - s.w / 2, y: q.y - s.h / 2, w: s.w, h: s.h + 3 }); }
    else { const r = (big ? 7 : 6) * 0.8; out.push({ id: p.id, kind: p.kind, x: q.x - r, y: q.y - r, w: 2 * r, h: 2 * r }); }
  }
  return out;
}

/** Fix round: the middle of each building (its click target) as a small box: a job's marker keeps off it. */
export function buildingCentres(P, box) {
  const out = [];
  for (const p of MAP_PLACES) {
    if (!p.rect || p.id === 'house') continue;
    const a = P.toPx(p.rect.x0, p.rect.z0), b = P.toPx(p.rect.x1, p.rect.z1), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const w = Math.min(16, Math.abs(b.x - a.x)), h = Math.min(16, Math.abs(b.y - a.y));
    if (cx >= box.x && cy >= box.y && cx <= box.x + box.w && cy <= box.y + box.h) out.push({ id: p.id, kind: 'building', x: cx - w / 2, y: cy - h / 2, w, h });
  }
  return out;
}

/** The jobs at one place (their points within a marker's width on the map) become one marker: '4 · 5 · 7'. The current
 *  job's group first, then by job number; the marker points (a short leader) to its first place. */
function groups(P, box, spots, big) {
  const R = big ? 9 : 8, near = 2 * R, out = [];
  const list = spots.slice().sort((a, b) => (b.current - a.current) || a.n - b.n);
  for (const s of list) {
    const q = P.toPx(s.x, s.z);
    if (q.x < box.x || q.y < box.y || q.x > box.x + box.w || q.y > box.y + box.h) continue;
    const g = out.find((o) => Math.hypot(o.px.x - q.x, o.px.y - q.y) < near);
    if (g) { g.items.push(s); continue; }
    out.push({ px: q, items: [s] });
  }
  return out;
}

/** The markers laid out: each tries eight sides of its place at three distances, the first clear of every obstacle (the
 *  labels, the posts and machine marks, the farmer, the markers placed before it and the other places' points) inside
 *  the box; when none is clear, the one that covers least. */
export function layoutMarkers(P, box, spots, { view = 'farm', obstacles = [] } = {}) {
  const big = view === 'house', placed = [], gs = groups(P, box, spots, big);
  const points = gs.map((g) => ({ x: g.px.x - 3, y: g.px.y - 3, w: 6, h: 6 }));
  const inBox = (b) => b.x >= box.x + 2 && b.y >= box.y + 2 && b.x + b.w <= box.x + box.w - 2 && b.y + b.h <= box.y + box.h - 2;
  const DIRS = [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [1, 0], [-1, 0]];
  gs.forEach((g, gi) => {
    const s0 = g.items[0], current = g.items.some((s) => s.current);
    const ns = [...new Set(g.items.map((s) => s.n))].sort((a, b) => a - b), text = ns.join(' · ');
    const r = current ? (big ? 11 : 10) : big ? 9 : 8, pill = ns.length > 1;
    const w = pill ? Math.ceil(labelWidth(text, 12)) + 12 : 2 * r, h = 2 * r, q = g.px;
    let best = null;
    for (const gap of [4, 12, 22]) {
      for (const [dx, dy] of DIRS) {
        const cx = q.x + dx * (w / 2 + gap) * (dy && dx ? 0.8 : 1), cy = q.y + dy * (h / 2 + gap) * (dy && dx ? 0.8 : 1);
        const b = { x: cx - w / 2, y: cy - h / 2, w, h };
        if (!inBox(b)) continue;
        let cost = 0;
        for (const o of obstacles) if (boxesOverlap(o, b, 1)) cost += 60 + area(o, b);
        for (const o of placed) if (boxesOverlap(o, b, 1)) cost += 200 + area(o, b);
        points.forEach((o, k) => { if (k !== gi && boxesOverlap(o, b)) cost += 40 + area(o, b); });
        if (!best || cost < best.cost) best = { cost, b, cx, cy };
        if (cost === 0) break;
      }
      if (best && best.cost === 0) break;
    }
    if (!best) { const b = { x: q.x + 4, y: q.y - h - 4, w, h }; best = { cost: 1e9, b, cx: b.x + w / 2, cy: b.y + h / 2 }; }
    placed.push(best.b);
    // the leader: from the place's point to the marker's edge
    const ex = Math.max(best.b.x, Math.min(q.x, best.b.x + w)), ey = Math.max(best.b.y, Math.min(q.y, best.b.y + h));
    const titles = [...new Map(g.items.map((s) => [s.n, s.title])).entries()].sort((a, b) => a[0] - b[0]).map(([n, t]) => `${n} · ${t}`);
    g.marker = {
      key: s0.key, keys: [...new Set(g.items.map((s) => s.key))], ns, n: ns[0], text, title: s0.title, titles,
      x: best.cx, y: best.cy, w, h, r, pill, current, inside: !!s0.inside, at: { x: s0.x, z: s0.z }, px: { x: q.x, y: q.y },
      leader: Math.hypot(ex - q.x, ey - q.y) > 2 ? { x1: q.x, y1: q.y, x2: ex, y2: ey } : null,
      name: s0.name || null, places: g.items.length, clear: best.cost === 0,
    };
  });
  return gs.map((g) => g.marker);
}

/** The side list: one row a job (its places nearest first), in the job card's order of numbers. */
export function jobRows(spots, from = { x: 0, z: 0 }) {
  const by = new Map();
  for (const s of spots) {
    const k = s.key;
    if (!by.has(k)) by.set(k, { n: s.n, key: k, title: s.title, current: !!s.current, inside: !!s.inside, places: [] });
    const row = by.get(k);
    row.places.push(s); row.current = row.current || !!s.current;
  }
  const d = (s) => Math.hypot(s.x - from.x, s.z - from.z);
  for (const row of by.values()) { row.places.sort((a, b) => d(a) - d(b)); row.inside = row.places[0].inside; }
  return [...by.values()].sort((a, b) => a.n - b.n);
}
