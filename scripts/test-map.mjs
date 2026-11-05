// Node checks of the farm overview map's pure part (PHASE5.md §5, §10.4, package experience): the places are unique and
// cover every place the farmer uses; the projection round-trips in both views; the always-shown labels never overlap at
// the map boxes of 960 x 600, 1280 x 800 and a 600 px wide box (the font's widths from a fixed Chakra Petch 12 px table);
// jobCard.spots() has its shape from a real job engine (open jobs with places, the current one first).
// Run: node scripts/test-map.mjs
import * as THREE from 'three';
import { MAP_PLACES, standOf, projector, layoutLabels, labelWidth, boxesOverlap, mapBoxSize, groupOf, PLACE_GROUPS, SIGN_NUMBERS, walkWords, routeLength } from '../src/map-plan.js';
import { MAP, SPOTS, SPOTS2, SPOTS3, SPOTS4, FARM, HOUSE_BOUNDS } from '../src/config.js';
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { markBoxes, buildingCentres, layoutMarkers, jobRows, signText } from '../src/map-marks-plan.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|fail|score|bad farmer|poor/i;

test('MAP_PLACES: unique ids, every place a name, a group and a finite stand point; 44 places', () => {
  const ids = MAP_PLACES.map((p) => p.id);
  assert(new Set(ids).size === ids.length, 'unique ids');
  assert(ids.length === 44, `44 places: ${ids.length}`);
  for (const p of MAP_PLACES) {
    const s = standOf(p);
    assert(p.name && Number.isFinite(s.x) && Number.isFinite(s.z), `place ${p.id}`);
    assert(PLACE_GROUPS.some((g) => g.id === groupOf(p)), `group of ${p.id}`);
    assert(!VERDICT.test(p.name), `neutral name: ${p.name}`);
    if (p.inside) assert(s.x > HOUSE_BOUNDS.xMin && s.x < HOUSE_BOUNDS.xMax && s.z > HOUSE_BOUNDS.zMin && s.z < HOUSE_BOUNDS.zMax, `an inside place stands inside: ${p.id}`);
    else assert(s.x >= FARM.walk.xMin && s.x <= FARM.walk.xMax && s.z >= FARM.walk.zMin && s.z <= FARM.walk.zMax, `an outside place stands on the farm: ${p.id}`);
  }
  // the nine buildings and areas carry the always-shown labels
  assert(MAP_PLACES.filter((p) => p.label === 'always').map((p) => p.id).sort().join(',') === 'gate,generator,guardHut,house,loadingBay,office,silos,washBay,waterTank', 'the always-shown labels');
  assert(Object.keys(SIGN_NUMBERS).length === MAP_PLACES.filter((p) => p.kind === 'sign').length, 'every sign has its number');
  assert(standOf(MAP_PLACES.find((p) => p.id === 'house')).z === SPOTS.houseDoor.z, 'the Chicken house walks him to the door');
});

test('every SPOTS place a farmer uses has a map place (the same spot)', () => {
  // not places of their own: the house door (the Chicken house place stands there), the truck's parking, the chick boxes
  // (they stand only on day 0: the chick table is the place), the clean-out's bait stations and brush spots (the job card
  // points to each; the map shows the open job's marker there), SPOTS4's copy of the chick table
  const skip = new Set(['SPOTS.houseDoor', 'SPOTS2.truckStop', 'SPOTS2.boxStacks', 'SPOTS3.bait', 'SPOTS3.brush', 'SPOTS4.chickTable']);
  const at = MAP_PLACES.map((p) => p.at);
  const near = (s) => at.some((a) => Math.hypot(a.x - s.x, a.z - s.z) < 0.05) || MAP_PLACES.some((p) => p.rect && s.x >= p.rect.x0 - 0.5 && s.x <= p.rect.x1 + 0.5 && s.z >= p.rect.z0 - 0.5 && s.z <= p.rect.z1 + 0.5 && p.kind === 'building');
  const missing = [];
  for (const [name, T] of [['SPOTS', SPOTS], ['SPOTS2', SPOTS2], ['SPOTS3', SPOTS3], ['SPOTS4', SPOTS4]]) {
    for (const [k, v] of Object.entries(T)) {
      if (skip.has(`${name}.${k}`)) continue;
      const list = Array.isArray(v) ? v : [v];
      for (const s of list) if (s && Number.isFinite(s.x) && !near(s)) missing.push(`${name}.${k}`);
    }
  }
  assert(!missing.length, `no map place for ${missing.join(', ')}`);
});

test('projector: round trips in the Farm and House views at several boxes; north up', () => {
  for (const view of [MAP.farm, MAP.house]) {
    for (const box of [{ x: 0, y: 0, w: 658, h: 462 }, { x: 8, y: 8, w: 830, h: 662 }, { x: 0, y: 0, w: 600, h: 380 }]) {
      const P = projector(view, box);
      for (const [x, z] of [[-40, 38], [0, 0], [-23.2, 5], [22.4, -5.8]]) {
        const q = P.toPx(x, z), w = P.toWorld(q.x, q.y);
        assert(Math.abs(w.x - x) < 1e-9 && Math.abs(w.z - z) < 1e-9, `round trip ${x},${z}`);
      }
      assert(P.toPx(0, -5).y < P.toPx(0, 5).y && P.toPx(-5, 0).x < P.toPx(5, 0).x, 'north up, west left');
      const a = P.toPx(view.xMin, view.zMin), b = P.toPx(view.xMax, view.zMax);
      assert(a.x >= box.x - 1e-6 && a.y >= box.y - 1e-6 && b.x <= box.x + box.w + 1e-6 && b.y <= box.y + box.h + 1e-6, 'the view inside its box');
    }
  }
  const f = projector(MAP.farm, mapBoxSize(960, 600)), hs = projector(MAP.house, mapBoxSize(960, 600));
  console.log(`     960 x 600: map box ${mapBoxSize(960, 600).w} x ${mapBoxSize(960, 600).h} px · Farm ${f.scale.toFixed(2)} px/m · House ${hs.scale.toFixed(2)} px/m`);
  assert(mapBoxSize(960, 600).w >= 600 && mapBoxSize(960, 600).h >= 380, 'the map box at 960 x 600 is at least 600 x 380');
  assert(f.scale >= 5 && hs.scale >= 12, 'about 5.2 px a metre (Farm), 13 (House)');
});

test('the always-shown labels never overlap: 960 x 600, 1280 x 800 and a 600 px wide box (Feed silos and Water tank first)', () => {
  const boxes = [['960 x 600', { x: 0, y: 0, ...mapBoxSize(960, 600) }], ['1280 x 800', { x: 0, y: 0, ...mapBoxSize(1280, 800) }],
    ['600 x 429', { x: 0, y: 0, w: 600, h: 429 }], ['600 x 380', { x: 0, y: 0, w: 600, h: 380 }]];
  for (const [name, box] of boxes) {
    const P = projector(MAP.farm, box);
    const L = layoutLabels(P, box, { measure: labelWidth, px: MAP.minLabelPx });
    assert(L.length === 9, `${name}: nine labels`);
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      assert(a.x >= 0 && a.y >= 0 && a.x + a.w <= box.w && a.y + a.h <= box.h, `${name}: ${a.id} inside the box`);
      assert(a.w >= labelWidth(a.text) && a.h >= MAP.minLabelPx, `${name}: ${a.id} as wide as its text`);
      for (let j = i + 1; j < L.length; j++) assert(!boxesOverlap(a, L[j]), `${name}: ${a.id} and ${L[j].id} overlap`);
    }
    const s = L.find((l) => l.id === 'silos'), t = L.find((l) => l.id === 'waterTank');
    const gapPx = Math.max(t.x - (s.x + s.w), s.x - (t.x + t.w), t.y - (s.y + s.h), s.y - (t.y + t.h));
    console.log(`     ${name}: ${L.map((l) => `${l.id} ${l.side}`).join(' · ')} · silos to water tank ${gapPx.toFixed(1)} px apart`);
  }
});

test('the walk in words and the route length', () => {
  assert(walkWords(64) === 'about 64 m · 16 s walking (about 24 farm minutes at 1×)', walkWords(64));
  assert(routeLength(0, 0, [{ x: 3, z: 4 }, { x: 3, z: 10 }]) === 11, 'polyline length');
  assert(routeLength(0, 0, null) === null && /no way/.test(walkWords(null)), 'no route');
});

// ---- jobCard.spots() from the real job engine (ui-jobs.js on a minimal DOM) ----
function fakeEl(tag) {
  const el = {
    tagName: tag, className: '', hidden: false, innerHTML: '', textContent: '', children: [], attrs: {}, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); },
    replaceChildren(...c) { this.children = c; }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
  };
  return el;
}
test('jobCard.spots(): [{ key, n, title, x, z, inside, current }] for the open jobs with places, the current one first', async () => {
  const had = 'document' in globalThis, keep = globalThis.document;
  try {
    const { createJobCard } = await import('../src/ui-jobs.js');
    const w = makeWorld();
    const pos = { x: FARM.spawn.x, z: FARM.spawn.z };
    const player = { position: pos, yaw: 0, isInside: false, teleport(x, z) { pos.x = x; pos.z = z; } };
    const ui = { panelKind: null, setMode() {}, closePanel() {}, showResult() {}, jobCard: { refresh() {}, reset() {}, atAnyJob: () => false, atJob: () => false }, newRun() {} };
    const store = { save: () => true, load: () => null, clear() {}, loadProfile: () => null, saveProfile() {}, info: () => null };
    const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {}, highlight() {} };
    const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {}, dead: { near: () => [] } };
    const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
    level.start({ seed: 1 });
    level.debug.goto(-1, 16.5);
    // the page's document only now (level.js listens to a real page's visibility)
    globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ text: String(t) }), head: fakeEl('head'), documentElement: fakeEl('html') };
    const scene = { add() {} };
    const ctx = { THREE, scene, camera: new THREE.PerspectiveCamera(), env: w.env, farm: w.farm, props, flock, player, events: w.events, level, keys: null };
    const L = { engine: () => level.engine };
    const card = createJobCard(fakeEl('div'), ctx, L, { root: fakeEl('div'), avoid: () => [], onNext() {}, onNotebook() {}, onSkills() {}, nextLabel: () => 'Next job' });
    const open = level.jobs.open();
    const spots = card.spots();
    assert(open.length >= 2 && spots.length >= 2, `open jobs ${open.length}, spots ${spots.length}`);
    for (const s of spots) {
      assert(typeof s.key === 'string' && Number.isInteger(s.n) && s.n >= 1 && s.title && Number.isFinite(s.x) && Number.isFinite(s.z) && typeof s.inside === 'boolean' && typeof s.current === 'boolean', `shape: ${JSON.stringify(s)}`);
      assert(open.some((i) => i.key === s.key), `an open job: ${s.key}`);
    }
    const cur = level.jobs.current();
    assert(spots[0].current && spots[0].key === cur.key && spots.filter((s) => s.current).every((s) => s.key === cur.key), `the current job first: ${spots[0].key} / ${cur.key}`);
    assert(spots.every((s, i) => i === 0 || s.current || spots[i - 1].current || s.n >= spots[i - 1].n), 'then by number');
    // a job done at several places gives each unfinished place (the prep day's drinker lines: the four regulators)
    const multi = spots.filter((s) => s.key === 'prep-drinkers@-1');
    console.log(`     ${open.length} open jobs, ${spots.length} places: ${spots.map((s) => `${s.n}${s.current ? '*' : ''} ${s.key} (${s.x.toFixed(1)}, ${s.z.toFixed(1)}${s.inside ? ' in' : ''})`).join(' · ')}`);
    assert(multi.length === 4 && multi.every((s) => s.inside && Math.abs(s.x + 22.2) < 0.01), `the drinker lines at their four regulators: ${multi.length}`);
    // the numbers follow the card's order of open jobs (1, 2, 3 …)
    assert([...new Set(spots.map((s) => s.n))].sort((a, b) => a - b).every((n, i) => n === i + 1 || n > i), 'numbered from 1');
  } finally { if (had) globalThis.document = keep; else delete globalThis.document; }
});

// ---- fix round: the marks clear of each other (labels, sign posts, machine marks, the jobs' markers) ----
/** The open jobs' spots on a day from the real job engine and job card (as the page's ui.jobCard.spots()). */
async function spotsOn(day, hour, opts = {}) {
  const had = 'document' in globalThis, keep = globalThis.document;
  try {
    const { createJobCard } = await import('../src/ui-jobs.js');
    const w = makeWorld();
    const pos = { x: FARM.spawn.x, z: FARM.spawn.z };
    const player = { position: pos, yaw: 0, isInside: false, teleport(x, z) { pos.x = x; pos.z = z; } };
    const ui = { panelKind: null, setMode() {}, closePanel() {}, showResult() {}, jobCard: { refresh() {}, reset() {}, atAnyJob: () => false, atJob: () => false }, newRun() {} };
    const store = { save: () => true, load: () => null, clear() {}, loadProfile: () => null, saveProfile() {}, info: () => null };
    const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {}, highlight() {} };
    const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {}, dead: { near: () => [] } };
    const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
    level.start({ seed: 1, ...opts });
    level.debug.goto(day, hour);
    globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ text: String(t) }), head: fakeEl('head'), documentElement: fakeEl('html') };
    const ctx = { THREE, scene: { add() {} }, camera: new THREE.PerspectiveCamera(), env: w.env, farm: w.farm, props, flock, player, events: w.events, level, keys: null };
    const card = createJobCard(fakeEl('div'), ctx, { engine: () => level.engine }, { root: fakeEl('div'), avoid: () => [], onNext() {}, onNotebook() {}, onSkills() {}, nextLabel: () => 'Next job' });
    return { spots: card.spots(), pos: { ...pos } };
  } finally { if (had) globalThis.document = keep; else delete globalThis.document; }
}
const hits = (A, B, same = false) => { const out = []; for (let i = 0; i < A.length; i++) for (let j = same ? i + 1 : 0; j < B.length; j++) if (boxesOverlap(A[i], B[j])) out.push([A[i].id || A[i].text, B[j].id || B[j].text]); return out; };
test('fix round: no marker, label or sign post on another (the planning day and the prep day, both views, 960 x 600 and 1280 x 800)', async () => {
  for (const [day, hour, name, opts] of [[-2, 7.2, 'planning day', { level: 'plan' }], [-2, 11, 'planning day 11:00', { level: 'plan' }], [-1, 6.6, 'prep day'], [-1, 16.5, 'prep day afternoon']]) {
    const { spots, pos } = await spotsOn(day, hour, opts);
    for (const size of [[960, 600], [1280, 800]]) {
      const box = { x: 0, y: 0, ...mapBoxSize(...size) };
      for (const view of ['farm', 'house']) {
        const P = projector(MAP[view], box), q = P.toPx(pos.x, pos.z), me = { id: 'farmer', x: q.x - 12, y: q.y - 12, w: 24, h: 24 };
        const marks = markBoxes(P, box, view);
        const labels = view === 'farm' ? layoutLabels(P, box, { measure: labelWidth, px: MAP.minLabelPx, obstacles: [...marks, me] }) : [];
        const centres = buildingCentres(P, box);
        const markers = layoutMarkers(P, box, spots, { view, obstacles: [...labels, ...marks, me, ...centres] }).map((m) => ({ ...m, id: `job ${m.text}`, x: m.x - m.w / 2, y: m.y - m.h / 2 }));
        const bad = [...hits(markers, markers, true), ...hits(markers, labels), ...hits(markers, marks), ...hits(labels, marks), ...hits(markers, centres)];
        const tag = `${name} ${size.join(' x ')} ${view}`;
        console.log(`     ${tag}: ${spots.length} job places -> ${markers.length} markers (${markers.map((m) => m.text).join(', ')}), ${labels.length} labels, ${marks.length} marks; overlaps ${bad.length}`);
        assert(!bad.length, `${tag}: ${bad.map((b) => b.join(' on ')).join('; ')}`);
        const inView = spots.filter((sp) => { const r = P.toPx(sp.x, sp.z); return r.x >= 0 && r.y >= 0 && r.x <= box.w && r.y <= box.h; });
        assert(inView.every((sp) => markers.some((m) => m.keys.includes(sp.key) && m.ns.includes(sp.n))), `${tag}: every job with a place in view has its number on a marker`);
      }
    }
  }
});
test('fix round: the side list has one row a job, by job number; signs read S1, S2 … on the map', async () => {
  const { spots, pos } = await spotsOn(-1, 16.5);
  const rows = jobRows(spots, pos);
  assert(rows.length === new Set(spots.map((s) => s.key)).size, `one row a job: ${rows.length}`);
  assert(rows.every((r, i) => !i || r.n > rows[i - 1].n), `by number: ${rows.map((r) => r.n).join(', ')}`);
  const multi = rows.find((r) => r.places.length > 1);
  assert(multi && multi.places.every((p, i) => !i || Math.hypot(p.x - pos.x, p.z - pos.z) >= Math.hypot(multi.places[i - 1].x - pos.x, multi.places[i - 1].z - pos.z)), 'a job of several places: nearest first');
  assert(signText('signGate') === 'S1' && /^S\d+$/.test(signText('signHeat')) && signText('office') === '', `sign marks: ${signText('signGate')}, ${signText('signHeat')}`);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
