// The farm overview map (PHASE5.md §5): Tab (from the farm view) or the map key on the time bar. The farm from above in the
// game's flat colours: the house with its equipment, the buildings, signs, the farmer and his facing, the open jobs'
// places and markers, dead birds, the set-down bucket and the flock's spread; a click on a place walks him there.
// The farm clock stands still while it is open (panel kind 'paused'). Owner after the design round: package
// "experience". This is the design round's working STUB: the fence, the road, the buildings and the farmer as SVG, and
// every place as a key in a list that walks him there (player.walkTo; the route finder of player-path.js).
//
//   createMap(ctx, { register, openPanel, closePanel }) -> { id: 'map', open(view?), places() }
import { h, button, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { MAP, FARM, HOUSE_BOUNDS } from './config.js';
import { MAP_PLACES, projector, standOf } from './map-plan.js';

export const MAP_ID = 'map';
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };

export function createMap(ctx, { register, openPanel, closePanel }) {
  const player = ctx.player;
  function walkTo(p) {
    const s = standOf(p);
    closePanel();
    // the panel gave the farmer his input back on close: walk there by the route finder (around the walls, in at the door)
    player?.walkTo?.(s.x, s.z, false);
  }
  register(MAP_ID, () => {
    const titleId = uniqueId('map-title');
    const { el, closeBtn } = dialogShell('map', titleId, () => closePanel());
    const W = 720, H = 520;
    const svg = svgEl('svg', { class: 'map-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The farm from above' });
    const P = projector(MAP.farm, { x: 8, y: 8, w: W - 16, h: H - 16 });
    const rect = (r, cls) => { const a = P.toPx(r.x0, r.z0), b = P.toPx(r.x1, r.z1); return svgEl('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: cls }); };
    svg.append(rect({ x0: FARM.fence.xMin, x1: FARM.fence.xMax, z0: FARM.fence.zMin, z1: FARM.fence.zMax }, 'map-fence'));
    const road = FARM.road.map((p) => { const q = P.toPx(p.x, p.z); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
    svg.append(svgEl('polyline', { points: road, class: 'map-road', 'stroke-width': (5 * P.scale).toFixed(1) }));
    svg.append(rect({ x0: HOUSE_BOUNDS.xMin, x1: HOUSE_BOUNDS.xMax, z0: HOUSE_BOUNDS.zMin, z1: HOUSE_BOUNDS.zMax }, 'map-house'));
    for (const p of MAP_PLACES) {
      if (p.rect && p.id !== 'house') svg.append(rect(p.rect, `map-bld map-bld--${p.id}`));
      if (p.label === 'always') { const q = P.toPx(p.at.x, p.rect ? p.rect.z0 - 1 : p.at.z); const t = svgEl('text', { x: q.x, y: q.y, class: 'map-label', 'text-anchor': 'middle' }); t.textContent = p.name; svg.append(t); }
    }
    const me = svgEl('g', { class: 'map-me' });
    me.append(svgEl('circle', { r: 5 }), svgEl('path', { d: 'M0 -11 L4 -4 L-4 -4 Z' }));
    svg.append(me);
    const list = h('ul', { class: 'map-places' });
    for (const p of MAP_PLACES) {
      const b = button({ class: 'btn btn--quiet map-place', 'data-place': p.id }, p.name);
      b.addEventListener('click', () => walkTo(p));
      list.append(h('li', null, b));
    }
    el.append(h('div', { class: 'map-case card' },
      h('header', { class: 'map-head' }, h('span', { html: ICONS.map, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Farm map'),
        h('p', null, 'The farm clock stands still while the map is open. Pick a place to walk there.'))),
      h('div', { class: 'map-body' }, svg, list)), closeBtn);
    return {
      el,
      update() {
        const pos = player?.position; if (!pos) return;
        const q = P.toPx(pos.x, pos.z), deg = (-(player.yaw || 0) * 180) / Math.PI;
        me.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${deg.toFixed(1)})`);
      },
    };
  }, { kind: 'paused' });
  return { id: MAP_ID, open: () => openPanel(MAP_ID), places: () => MAP_PLACES.map((p) => ({ id: p.id, name: p.name, stand: standOf(p) })), walkTo: (id) => { const p = MAP_PLACES.find((x) => x.id === id); if (p) walkTo(p); return !!p; } };
}
