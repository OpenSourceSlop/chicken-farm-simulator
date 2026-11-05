// The farm overview map (PHASE5.md §5): O (keys.js 'map') or the map key on the time bar. The farm from above in the
// game's flat colours (ui-map-draw.js): the house with its equipment, the buildings, signs, the farmer and his facing,
// the open jobs' numbered markers, dead birds, the set-down bucket and the flock's spread; a House view of the house alone.
// Hover or focus names a place with its walk; a click walks him there by the route finder. The farm clock stands still
// while it is open (panel kind 'paused'). Owner: package "experience".
//
//   createMap(ctx, { register, openPanel, closePanel, jobCard? }) -> { id: 'map', open(via?), places(), walkTo(id),
//     state(), pxOf(x, z), route(id), view(name?) }
//   (via: { returnTo: 'menu' } from the game menu: Esc on the map comes back to the menu; a place picked closes the whole
//   chain and walks, PHASE5.md §8.6)
import { h, button, uniqueId, injectStyle } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { MAP, FARM, HOUSE_BOUNDS, LEVEL1, SPOTS } from './config.js';
import { MAP_PLACES, projector, standOf, layoutLabels, labelWidth, mapBoxSize, groupOf, PLACE_GROUPS, SIGN_NUMBERS, walkWords, routeLength } from './map-plan.js';
import { drawView, drawPlaces, S } from './ui-map-draw.js';
import { drawLabels, drawWord, drawMarkers, drawFarmer } from './ui-map-marks.js';
import { markBoxes, buildingCentres, layoutMarkers, jobRows, signText } from './map-marks-plan.js';
import { findPath, freeSpot } from './player-path.js';
import { clock as inputClock } from './clock.js';
import { MAP_CSS } from './ui-map-style.js';

export const MAP_ID = 'map';
const SHUT = 'The house is shut while it rests';
const BY_ID = new Map(MAP_PLACES.map((p) => [p.id, p]));
const inHouse = (x, z) => x > HOUSE_BOUNDS.xMin && x < HOUSE_BOUNDS.xMax && z > HOUSE_BOUNDS.zMin && z < HOUSE_BOUNDS.zMax;
const inWalk = (x, z) => x >= FARM.walk.xMin && x <= FARM.walk.xMax && z >= FARM.walk.zMin && z <= FARM.walk.zMax;

export function createMap(ctx, { register, openPanel, closePanel, jobCard = null }) {
  injectStyle('map-style', MAP_CSS);
  const player = ctx.player;
  let view = 'farm', focusId = null, built = null, last = null, routes = new Map();
  const farmNow = () => ctx.farm || null;
  const shut = () => !!farmNow()?.house?.closed;
  /** A place whose thing is not on the farm now is drawn faint (it still walks). */
  function present(p) {
    const d = ctx.env?.dayNumber ?? 0;
    if (p.id === 'catchPanels') return d >= 41 && d <= 42;
    if (p.id === 'chickTable') return d >= -1 && d <= 0;
    if (p.id === 'signPower') return farmNow()?.condition === 'rainy';
    return true;
  }
  /** The walk from where he stands (the route finder's own path, his radius, the farm's colliders); cached while open. */
  function routeTo(x, z) {
    const k = `${x.toFixed(2)},${z.toFixed(2)}`;
    if (routes.has(k)) return routes.get(k);
    const pos = player?.position, cols = ctx.colliders || player?.colliders || [];
    let r = null;
    if (pos) {
      try {
        const goal = freeSpot(x, z, 0.35, cols, FARM.walk);
        const path = findPath(pos.x, pos.z, goal.x, goal.z, 0.35, cols, FARM.walk);
        r = path ? { len: routeLength(pos.x, pos.z, path), path, goal } : null;
      } catch { r = null; }
    }
    routes.set(k, r);
    return r;
  }
  const walkText = (x, z) => walkWords(routeTo(x, z)?.len ?? null, { work: LEVEL1.clock.work });
  // ---- walking: the whole chain closes, then he walks by the route finder (a double click or Shift runs) ----
  let swallowUntil = 0, swallowAt = null;
  // only a click on the 3D view (the canvas) is swallowed, on the input clock (clock.js: the harness's steps move it), so
  // a key of the HUD or a panel pressed right after the walk still works (Phase 5 integration)
  function swallow(e) {
    if (inputClock.now() > swallowUntil || !(e.target && e.target.tagName === 'CANVAS')) return;
    // the second click of a double click lands on the 3D view once the map is shut: it runs instead of walking elsewhere
    e.stopImmediatePropagation(); e.preventDefault();
    if ((e.type === 'dblclick' || e.type === 'pointerdown') && swallowAt) { player?.walkTo?.(swallowAt.x, swallowAt.z, true); swallowAt = null; }
  }
  for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick']) window.addEventListener(t, swallow, true);
  // fix round: one resize listener for the map's life (the panel is built again at every level start: one more each time)
  window.addEventListener('resize', () => { if (built && !built.el.hidden && svg?.isConnected) redraw(); });
  function walkPoint(x, z, run = false) {
    // fix round: the player's pause freezes the farmer: the map still shows the farm, the walk waits for the clock
    const pausedText = ctx.level?.mode === 'level' ? ctx.level?.hudHooks?.pausedText?.() : '';
    if (pausedText) { showTag(null, `<b>${pausedText}</b> · he walks there when the farm clock runs`); return false; }
    closePanel({ all: true });
    player?.walkTo?.(x, z, !!run);
    swallowUntil = inputClock.now() + 380; swallowAt = run ? null : { x, z };
    return true;
  }
  function walkPlace(p, run = false) {
    if (p.inside && shut()) { showTag(p.id, `<b>${p.name}</b> · ${SHUT}`); return false; }
    const s = standOf(p);
    return walkPoint(s.x, s.z, run);
  }

  // ---- the panel ----
  let svg, box, tag, lists, jobsList, tabs, body, mapBox, P = null, drawn = null;
  register(MAP_ID, () => {
    const titleId = uniqueId('map-title');
    const { el, closeBtn } = dialogShell('map', titleId, () => closePanel());
    svg = S('svg', { class: 'map-svg', role: 'img', 'aria-label': 'The farm from above' });
    tag = h('div', { class: 'map-tag', role: 'status', 'aria-live': 'polite', hidden: true });
    mapBox = h('div', { class: 'map-box' }, svg, tag);
    tabs = ['farm', 'house'].map((v) => button({ class: 'map-tab', role: 'tab', 'data-map-view': v, 'aria-selected': String(v === view), tabindex: v === view ? '0' : '-1' }, v === 'farm' ? 'Farm' : 'House'));
    for (const t of tabs) t.addEventListener('click', () => setView(t.dataset.mapView, true));
    jobsList = h('ul');
    const groups = PLACE_GROUPS.map((g) => h('section', { class: 'map-group' }, h('h3', { class: 'label' }, g.name),
      h('ul', null, MAP_PLACES.filter((p) => groupOf(p) === g.id).map((p) => h('li', null, placeButton(p))))));
    lists = h('div', { class: 'map-lists' }, h('section', { class: 'map-group' }, h('h3', { class: 'label' }, 'Jobs now'), jobsList), ...groups,
      h('p', { class: 'map-key' }, 'Orange rounds: the open jobs, numbered as on the job card (jobs at one place share one). Boards marked S1, S2 …: signs. Grey squares: machines. Red crosses: dead birds. The arrow: you.'));
    const side = h('nav', { class: 'map-side', 'aria-label': 'Places on the farm' }, h('div', { class: 'map-tabs', role: 'tablist', 'aria-label': 'Map view' }, tabs), lists);
    body = h('div', { class: 'map-body' }, mapBox, side);
    el.append(h('div', { class: 'map-case card' },
      h('header', { class: 'map-head' }, h('span', { html: ICONS.map, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Farm map'),
        h('p', null, 'The farm clock stands still while the map is open. Pick a place to walk there, or click the ground.'))), body), closeBtn);
    svg.addEventListener('click', onSvgClick);
    svg.addEventListener('pointermove', onSvgMove);
    svg.addEventListener('pointerleave', () => { if (!focusId) hideTag(); });
    built = {
      el,
      onOpen() { routes = new Map(); redraw(); queueMicrotask?.(() => (tabs.find((t) => t.dataset.mapView === view))?.focus({ preventScroll: true })); },
      onClose() { hideTag(); focusId = null; },
      onKey,
    };
    return built;
  }, { kind: 'paused' });

  function placeButton(p) {
    const sn = SIGN_NUMBERS[p.id];
    const b = button({ class: 'map-place', 'data-place': p.id }, sn ? h('span', { class: 'map-sn', 'aria-hidden': 'true' }, signText(p.id)) : null, h('span', null, p.name));
    b.addEventListener('click', (e) => walkPlace(p, e.shiftKey));
    b.addEventListener('focus', () => setFocus(p.id));
    b.addEventListener('blur', () => { if (focusId === p.id) setFocus(null); });
    return b;
  }
  // fix round: one row a job in the job card's order (a job of several places says how many and walks to the nearest)
  function fillJobs(spots) {
    const rows = jobRows(spots, player?.position || { x: 0, z: 0 });
    jobsList.replaceChildren(...(rows.length ? rows.map((row) => {
      const s = row.places[0], k = row.places.length;
      const where = k > 1 ? ` · ${k} places (the nearest first)` : s.name ? ` · ${s.name}` : '';
      const b = button({ class: 'map-place', 'data-job': row.key, 'data-places': String(k) }, h('span', { class: 'map-n', 'aria-hidden': 'true' }, String(row.n)), h('span', null, `${row.title}${where}`));
      b.addEventListener('click', (e) => { if (s.inside && shut()) showTag(null, `<b>${row.title}</b> · ${SHUT}`); else walkPoint(s.x, s.z, e.shiftKey); });
      b.addEventListener('focus', () => { setFocus(null); const m = drawn?.markers.find((x) => x.keys.includes(row.key)); if (m) showMarkerTag(m); else showTag(null, `<b>${row.n} · ${row.title}</b>`); });
      return h('li', null, b);
    }) : [h('li', null, h('p', { class: 'map-none' }, 'No job open now.'))]));
  }

  // ---- drawing ----
  function redraw() {
    const size = mapBoxSize(window.innerWidth, window.innerHeight);
    built.el.style.width = `${size.panelW}px`;
    body.classList.toggle('is-below', size.listBelow);
    body.style.gridTemplateColumns = size.listBelow ? '' : `${size.w}px 220px`;
    mapBox.style.width = `${size.w}px`; mapBox.style.height = `${size.h}px`;
    lists.style.maxHeight = size.listBelow ? '150px' : `${size.h - 50}px`;
    box = { x: 0, y: 0, w: size.w, h: size.h };
    svg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    P = projector(view === 'farm' ? MAP.farm : MAP.house, box);
    const f = farmNow(), dark = !!f?.power && f.power.on === false, rain = (f?.weatherNow?.rain ?? 0) > 0.05;
    let spots = [];
    try { spots = jobCard?.spots?.() || []; } catch { spots = []; }
    if (ctx.level?.mode !== 'level') spots = [];
    // a job done at one place: that place's name from the map's own list (its nearest place within 3 m)
    spots = spots.map((s) => ({ ...s, name: s.name || nearestName(s.x, s.z) }));
    const d = drawView(svg, { view, P, box, ctx, present, shut: shut(), dark, rain });
    const shapes = drawPlaces(svg, P, { view, present, shut: shut(), box });
    const marks = S('g', {}, svg);
    // the house: one target in the Farm view (a click opens the House view)
    let houseHit = null;
    if (view === 'farm') {
      const a = P.toPx(HOUSE_BOUNDS.xMin, HOUSE_BOUNDS.zMin), b = P.toPx(HOUSE_BOUNDS.xMax, HOUSE_BOUNDS.zMax);
      houseHit = S('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: 'map-househit', 'data-place-shape': 'house' }, marks);
      shapes.set('house', { el: houseHit, box: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, faint: false });
    }
    const hc = P.toPx(0, 0), ht = P.toPx(0, HOUSE_BOUNDS.zMin), hb = P.toPx(HOUSE_BOUNDS.xMax, HOUSE_BOUNDS.zMax);
    if (dark) drawWord(marks, hc.x, hc.y + 5, 'No power');
    if (shut()) drawWord(marks, hc.x, hc.y + (dark ? 22 : 5), SHUT);
    if (d.dead.n > 0) drawWord(marks, hb.x - 4, hb.y + 16, `${d.dead.n} dead bird${d.dead.n === 1 ? '' : 's'}`, 'end');
    if (rain) { S('rect', { x: 0, y: 0, width: box.w, height: box.h, class: 'map-rain' }, marks); drawWord(marks, 10, 20, 'Raining', 'start'); }
    void ht;
    // fix round: the labels clear of the sign posts, machine marks and the farmer; the jobs' markers (merged by place)
    // clear of all of those and of each other; the farmer's arrow under the labels
    const posts = markBoxes(P, box, view), fq = player?.position ? P.toPx(player.position.x, player.position.z) : null;
    const me = fq ? [{ id: 'farmer', x: fq.x - 12, y: fq.y - 12, w: 24, h: 24 }] : [];
    // the map's own words ('5 dead birds', 'Cooling pad (west end)', 'No power', the bucket's count) as drawn
    const words = [...svg.querySelectorAll('.map-word, .map-tagtext')].map((t) => { try { const b = t.getBBox(); return b.width > 0 ? { id: t.textContent, x: b.x - 1, y: b.y - 1, w: b.width + 2, h: b.height + 2 } : null; } catch { return null; } }).filter(Boolean);
    const farmer = drawFarmer(marks, P, player);
    const labels = view === 'farm' ? layoutLabels(P, box, { measure: measureLabel, px: MAP.minLabelPx, obstacles: [...posts, ...me, ...words] }) : [];
    drawLabels(marks, labels);
    const laid = layoutMarkers(P, box, spots, { view, obstacles: [...labels, ...posts, ...me, ...words, ...buildingCentres(P, box)] });
    const markers = drawMarkers(marks, laid);
    drawn = { shapes, markers, labels, words, dead: d.dead, bucket: d.bucket, birds: d.birds, farmer, houseHit, spots };
    for (const [id, s] of shapes) s.el.addEventListener('pointerenter', () => showTag(id));
    for (const m of markers) m.el.addEventListener('pointerenter', () => showMarkerTag(m));
    fillJobs(spots);
    for (const t of tabs) { const on = t.dataset.mapView === view; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
    if (focusId) setFocus(focusId);
    last = { view, box, scale: P.scale };
  }
  function nearestName(x, z) {
    // the house door's own jobs (the boot dip) are named by the door, not by a machine inside it; a place not on the
    // farm now (the catching panels before day 41) names no job (Phase 5 integration)
    if (Math.hypot(SPOTS.houseDoor.x - x, SPOTS.houseDoor.z - z) < 1) return SPOTS.houseDoor.label;
    let best = null, bd = 3;
    for (const p of MAP_PLACES) {
      if (p.id === 'house' || !present(p)) continue;
      const d = p.rect && x >= p.rect.x0 && x <= p.rect.x1 && z >= p.rect.z0 && z <= p.rect.z1 ? 0 : Math.hypot(p.at.x - x, p.at.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? best.name : null;
  }
  let mctx = null;
  /** A label's width: the larger of the fixed Chakra Petch table (as test-map) and the face the page really draws. */
  function measureLabel(text, px) {
    try {
      if (!mctx) mctx = document.createElement('canvas').getContext('2d');
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-display') || 'sans-serif';
      mctx.font = `600 ${px}px ${fam}`;
      return Math.max(labelWidth(text, px), mctx.measureText(text).width + 1);
    } catch { return labelWidth(text, px); }
  }
  function setView(v, focusTab = false) {
    if (v !== 'farm' && v !== 'house') return;
    view = v; hideTag();
    if (built && !built.el.hidden) redraw();
    if (focusTab) tabs.find((t) => t.dataset.mapView === v)?.focus({ preventScroll: true });
  }

  // ---- tags: hover or focus names a place and its walk ----
  function placeTagText(p) {
    if (p.inside && shut()) return `<b>${p.name}</b> · ${SHUT}`;
    if (p.id === 'house' && view === 'farm') return `<b>${p.name}</b> · click for the House view · the door: ${walkText(standOf(p).x, standOf(p).z)}`;
    const s = standOf(p), sn = signText(p.id);
    return `<b>${sn ? `${sn} · ` : ''}${p.name}</b> · ${walkText(s.x, s.z)}${present(p) ? '' : ' · not on the farm now'}`;
  }
  function showTag(id, html = null) {
    if (!tag) return;
    const p = id ? BY_ID.get(id) : null;
    tag.innerHTML = html || (p ? placeTagText(p) : '');
    tag.hidden = !tag.innerHTML;
    const s = id && drawn?.shapes.get(id);
    place(s ? s.box : null);
  }
  function showMarkerTag(m) {
    if (!tag) return;
    const head = m.titles && m.titles.length > 1 ? m.titles.map((t) => `<b>${t}</b>`).join('<br>') : `<b>${m.n} · ${m.title}</b>`;
    tag.innerHTML = `${head}${m.name ? ` · ${m.name}` : ''}${m.inside && shut() ? ` · ${SHUT}` : ''}`;
    tag.hidden = false;
    const mm = drawn?.markers.find((x) => x.key === m.key);
    place(mm ? { x: mm.x - mm.w / 2, y: mm.y - mm.h / 2, w: mm.w, h: mm.h } : null);
  }
  function place(b) {
    if (!box) return;
    const W = Math.min(300, box.w - 12), x = b ? Math.max(6, Math.min(box.w - W - 6, b.x + b.w / 2 - W / 2)) : 6;
    const above = b ? b.y - 8 : 6, y = b && above > 60 ? above : b ? b.y + b.h + 8 : 6;
    tag.style.left = `${Math.round(x)}px`; tag.style.maxWidth = `${W}px`;
    if (b && above > 60) { tag.style.top = ''; tag.style.bottom = `${Math.round(box.h - y)}px`; } else { tag.style.bottom = ''; tag.style.top = `${Math.round(y)}px`; }
  }
  const hideTag = () => { if (tag) { tag.hidden = true; tag.innerHTML = ''; } };
  function setFocus(id) {
    for (const s of drawn?.shapes.values() || []) s.el.classList.remove('is-focus');
    focusId = id;
    if (!id) { hideTag(); return; }
    const p = BY_ID.get(id);
    const shapeId = view === 'farm' && p?.inside ? 'house' : id;
    drawn?.shapes.get(shapeId)?.el.classList.add('is-focus');
    showTag(drawn?.shapes.has(id) ? id : shapeId, p ? placeTagText(p) : null);
  }

  // ---- clicks on the map ----
  const local = (e) => { const r = svg.getBoundingClientRect(); return { x: ((e.clientX - r.left) * box.w) / Math.max(1, r.width), y: ((e.clientY - r.top) * box.h) / Math.max(1, r.height) }; };
  function onSvgMove(e) {
    if (e.target.closest?.('[data-place-shape], [data-marker]')) return;
    if (!focusId) hideTag();
  }
  function onSvgClick(e) {
    const run = e.shiftKey || e.detail >= 2;
    const m = e.target.closest?.('[data-marker]');
    if (m) {
      const s = drawn.markers.find((x) => x.key === m.dataset.marker && x.el === m);
      if (!s) return;
      if (view === 'farm' && s.inside) { setView('house'); return; }
      if (s.inside && shut()) { showMarkerTag(s); return; }
      walkPoint(s.at.x, s.at.z, run); return;
    }
    const sh = e.target.closest?.('[data-place-shape]');
    if (sh) {
      const p = BY_ID.get(sh.dataset.placeShape);
      if (!p) return;
      if (view === 'farm' && (p.id === 'house' || p.inside)) { focusId = focusId && BY_ID.get(focusId)?.inside ? focusId : null; setView('house'); return; }
      walkPlace(p, run); return;
    }
    // open ground: inside the fence in the Farm view (the house opens the House view), the floor in the House view
    const q = local(e), w = P.toWorld(q.x, q.y);
    if (view === 'farm') { if (inHouse(w.x, w.z)) { setView('house'); return; } if (inWalk(w.x, w.z)) walkPoint(w.x, w.z, run); return; }
    if (inHouse(w.x, w.z) && shut()) { showTag(null, SHUT); place({ x: q.x, y: q.y, w: 0, h: 0 }); return; }
    if (inWalk(w.x, w.z)) walkPoint(w.x, w.z, run);
  }

  // ---- keys: the arrows move within the side list and between the view tabs; O closes the map ----
  function onKey(e) {
    if (ctx.keys?.matches?.(e, 'map') && !e.repeat) { e.preventDefault(); closePanel(); return true; }
    const a = document.activeElement;
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && tabs.includes(a)) {
      e.preventDefault(); setView(view === 'farm' ? 'house' : 'farm', true); return true;
    }
    if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && lists.contains(a)) {
      const bs = [...lists.querySelectorAll('button')], i = bs.indexOf(a), d = e.code === 'ArrowDown' ? 1 : -1;
      bs[Math.max(0, Math.min(bs.length - 1, i + d))]?.focus({ preventScroll: false });
      e.preventDefault(); return true;
    }
    return false;
  }

  const rectOf = (el) => { const b = el?.getBBox?.(); return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
  return {
    id: MAP_ID,
    open: (via) => openPanel(MAP_ID, via || undefined),
    places: () => MAP_PLACES.map((p) => ({ id: p.id, name: p.name, stand: standOf(p), group: groupOf(p) })),
    walkTo: (id) => { const p = BY_ID.get(id); return p ? walkPlace(p) : false; },
    /** The view shown ('farm' | 'house'); with a name, switch to it. */
    view(v) { if (v) setView(v); return view; },
    /** PHASE5.md §9.2: what the map shows now, in map pixels (the harness). */
    state() {
      if (!drawn) return null;
      return {
        view, box: last ? { w: last.box.w, h: last.box.h, scale: last.scale } : null, shut: shut(),
        places: MAP_PLACES.filter((p) => drawn.shapes.has(p.id)).map((p) => { const s = drawn.shapes.get(p.id); const l = drawn.labels.find((x) => x.id === p.id); return { id: p.id, ...s.box, faint: s.faint, label: l ? { text: l.text, x: l.x, y: l.y, w: l.w, h: l.h } : null }; }),
        labels: drawn.labels.map((l) => ({ id: l.id, text: l.text, side: l.side, x: l.x, y: l.y, w: l.w, h: l.h, drawn: rectOf(svg.querySelectorAll('.map-label')[drawn.labels.indexOf(l)]) })),
        markers: drawn.markers.map(({ el, ...m }) => m), posts: markBoxes(P, box, view), words: drawn.words, dead: { n: drawn.dead.n, crosses: drawn.dead.crosses },
        jobRows: [...jobsList.querySelectorAll('[data-job]')].map((b) => b.textContent),
        bucket: drawn.bucket, birds: drawn.birds, farmer: drawn.farmer, tag: tag && !tag.hidden ? tag.textContent : null, focus: focusId,
      };
    },
    /** A world point in map pixels (the state's units). */
    toMap(x, z) { return P ? P.toPx(x, z) : null; },
    /** A world point in page pixels on the map now (a harness clicks there). */
    pxOf(x, z) { if (!P || !svg) return null; const r = svg.getBoundingClientRect(), q = P.toPx(x, z); return { x: r.left + (q.x * r.width) / box.w, y: r.top + (q.y * r.height) / box.h }; },
    /** The route from where he stands to a place's stand point: { len, goal } or null. */
    route(id) { const p = BY_ID.get(id); if (!p) return null; const s = standOf(p); const r = routeTo(s.x, s.z); return r ? { len: r.len, goal: r.goal } : null; },
    clearRoutes() { routes = new Map(); },
  };
}
