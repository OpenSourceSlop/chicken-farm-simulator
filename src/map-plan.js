// The farm overview map, the pure part (PHASE5.md §5): every place the map draws and a click walks to, the projection of
// the farm (or the house) into the map's box, and where the farmer stands to use a place. No DOM, no three.js: node tests
// (scripts/test-map.mjs) check that every place has a free, reachable stand point and that the always-shown labels do not
// overlap at 960 x 600, 1280 x 800 and a 600 px box. Owner after the design round: package "experience" (the list, labels, look);
// MAP_PLACES' shape, project() and standOf() are the frozen contract.
//
//   MAP_PLACES      [{ id, name, kind: 'building'|'machine'|'sign'|'spot', at: { x, z }, inside, rect?, label: 'always'|'hover',
//                    panel?: the ui panel / interactable id it opens }]
//   projector(view, box)  view: config MAP.farm | MAP.house; box: { x, y, w, h } px -> { toPx(x, z), toWorld(px, py), scale }
//   standOf(place)  -> { x, z, inside } where a click on the place walks him (the board's floor in front of it, else its spot)
import { HOUSE_BOUNDS, FARM, SPOTS, SPOTS2, SPOTS3, SPOTS4, MAP } from './config.js';

const rectOf = (c, w, d) => ({ x0: c.x - w / 2, x1: c.x + w / 2, z0: c.z - d / 2, z1: c.z + d / 2 });
const spot = (id, s, kind, extra = {}) => ({ id, name: s.label, kind, at: { x: s.x, z: s.z }, inside: !!s.inside, label: 'hover', ...extra });

export const MAP_PLACES = [
  // buildings and yard areas (labels always shown)
  { id: 'house', name: 'Chicken house', kind: 'building', at: { x: SPOTS.houseDoor.x, z: SPOTS.houseDoor.z }, inside: false, label: 'always',
    rect: { x0: HOUSE_BOUNDS.xMin, x1: HOUSE_BOUNDS.xMax, z0: HOUSE_BOUNDS.zMin, z1: HOUSE_BOUNDS.zMax } },
  { id: 'office', name: 'Office', kind: 'building', at: { x: SPOTS2.officeDesk.x, z: SPOTS2.officeDesk.z }, inside: false, label: 'always', rect: rectOf(FARM.office, FARM.office.w, FARM.office.d), panel: 'office-desk' },
  { id: 'guardHut', name: 'Guard hut', kind: 'building', at: { x: SPOTS3.guardHut.x, z: SPOTS3.guardHut.z }, inside: false, label: 'always', rect: rectOf(FARM.guardHut, FARM.guardHut.w, FARM.guardHut.d) },
  { id: 'gate', name: 'Farm gate', kind: 'building', at: { x: FARM.gate.x, z: FARM.gate.z - 2.2 }, inside: false, label: 'always',
    rect: { x0: FARM.gate.x - FARM.gate.width / 2, x1: FARM.gate.x + FARM.gate.width / 2, z0: FARM.gate.z - 0.3, z1: FARM.gate.z + 0.3 } },
  { id: 'silos', name: 'Feed silos', kind: 'building', at: { x: SPOTS2.silo.x, z: SPOTS2.silo.z }, inside: false, label: 'always', panel: 'silo',
    rect: { x0: FARM.silos[0].x - 1.5, x1: FARM.silos[1].x + 1.5, z0: FARM.silos[0].z - 1.5, z1: FARM.silos[0].z + 1.5 } },
  { id: 'waterTank', name: 'Water tank', kind: 'building', at: { x: SPOTS4.waterTank.x, z: SPOTS4.waterTank.z }, inside: false, label: 'always', panel: 'water-tank',
    rect: rectOf(FARM.waterTank, 3, 3) },
  { id: 'generator', name: 'Generator', kind: 'building', at: { x: SPOTS4.generator.x, z: SPOTS4.generator.z }, inside: false, label: 'always', panel: 'generator',
    rect: rectOf(FARM.generator, FARM.generator.w, FARM.generator.d) },
  { id: 'washBay', name: 'Wash bay', kind: 'building', at: { x: SPOTS3.washBay.x, z: SPOTS3.washBay.z }, inside: false, label: 'always', panel: 'wash-bay', rect: rectOf(SPOTS3.washBay, 4, 3) },
  { id: 'loadingBay', name: 'Loading bay', kind: 'building', at: { x: SPOTS3.loadingBay.x, z: SPOTS3.loadingBay.z }, inside: false, label: 'always', panel: 'loading-bay', rect: rectOf(SPOTS3.loadingBay, 4, 2.5) },
  // machines and spots outside
  spot('gasTank', SPOTS3.gasTank, 'machine', { panel: 'gas-tank' }),
  spot('padPump', SPOTS3.padPump, 'machine', { panel: 'pad-pump' }),
  spot('litterHeap', SPOTS2.litterHeap, 'spot', { panel: 'litter-heap' }),
  spot('chickTable', SPOTS2.chickTable, 'spot', { panel: 'chick-table' }),
  spot('deadBin', SPOTS2.deadBin, 'spot', { panel: 'dead-bin' }),
  spot('footDipGate', { ...FARM.footDipGate, label: 'Foot dip at the gate', inside: false }, 'spot'),
  // signs outside
  spot('signGate', SPOTS.signGate, 'sign', { panel: 'sign-gate' }),
  spot('signPlan', SPOTS3.signPlan, 'sign', { panel: 'sign-plan' }),
  spot('signChicks', SPOTS2.signChicks, 'sign', { panel: 'sign-chicks' }),
  spot('signHealth', SPOTS2.signHealth, 'sign', { panel: 'sign-health' }),
  spot('signCatch', SPOTS3.signCatch, 'sign', { panel: 'sign-catch' }),
  spot('signClean', SPOTS3.signClean, 'sign', { panel: 'sign-clean' }),
  spot('signFeed', SPOTS3.signFeed, 'sign', { panel: 'sign-feed' }),
  spot('signPower', SPOTS4.signPower, 'sign', { panel: 'sign-power' }),
  // inside the house: the north wall's boards and machines, the water supply, the drinker regulators, the curtain winch
  spot('controller', SPOTS.controller, 'machine', { panel: 'controller' }),
  spot('signBrooder', SPOTS.signBrooder, 'sign', { panel: 'sign-brooder' }),
  spot('feederBox', SPOTS2.feederBox, 'machine', { panel: 'feeder-box' }),
  spot('signWater', SPOTS2.signWater, 'sign', { panel: 'sign-water' }),
  spot('signVent', SPOTS2.signVent, 'sign', { panel: 'sign-vent' }),
  spot('signLitter', SPOTS2.signLitter, 'sign', { panel: 'sign-litter' }),
  spot('signLight', SPOTS3.signLight, 'sign', { panel: 'sign-light' }),
  spot('curtainWinch', SPOTS3.curtainWinch, 'machine', { panel: 'curtain-winch' }),
  spot('signCurtain', SPOTS3.signCurtain, 'sign', { panel: 'sign-curtain' }),
  spot('signLegs', SPOTS3.signLegs, 'sign', { panel: 'sign-legs' }),
  spot('signAir', SPOTS3.signAir, 'sign', { panel: 'sign-air' }),
  spot('signDroppings', SPOTS3.signDroppings, 'sign', { panel: 'sign-droppings' }),
  spot('signHeat', SPOTS3.signHeat, 'sign', { panel: 'sign-heat' }),
  spot('fanPanel', SPOTS3.fanPanel, 'machine', { panel: 'fan-panel' }),
  spot('waterSupply', SPOTS2.waterSupply, 'machine', { panel: 'water-supply' }),
  ...SPOTS2.drinkers.map((d, i) => spot(`drinker${i}`, d, 'machine', { panel: `drinker-${i}` })),
  spot('birdScale', SPOTS2.birdScale, 'machine', { panel: 'bird-scale' }),
  spot('catchPanels', SPOTS3.catchPanels, 'machine', { panel: 'catch-panels' }),
];

/** Where a click on the place walks him: in front of a north-wall board inside, else the place's own spot (the walk's
 *  route finder, player-path.js freeSpot, moves it off any collider). */
export function standOf(p) {
  if (p.inside && p.at.z < HOUSE_BOUNDS.zMin + 0.5) return { x: p.at.x, z: MAP.standZ, inside: true };
  return { x: p.at.x, z: p.at.z, inside: !!p.inside };
}

/** The map's projection: north (-z) up, the view's whole area fitted inside box, centred. */
export function projector(view, box) {
  const w = view.xMax - view.xMin, d = view.zMax - view.zMin;
  const scale = Math.min(box.w / w, box.h / d);
  const ox = box.x + (box.w - w * scale) / 2, oy = box.y + (box.h - d * scale) / 2;
  return {
    scale,
    toPx: (x, z) => ({ x: ox + (x - view.xMin) * scale, y: oy + (z - view.zMin) * scale }),
    toWorld: (px, py) => ({ x: view.xMin + (px - ox) / scale, z: view.zMin + (py - oy) / scale }),
  };
}

// ---------------- Phase 5, package experience: the side list's groups, the labels' layout, the walk in words ----------------

/** The side list's groups (PHASE5.md §5.3): buildings, machines outside, signs outside, inside the house. */
export const PLACE_GROUPS = [
  { id: 'buildings', name: 'Buildings' },
  { id: 'outside', name: 'Machines and spots outside' },
  { id: 'signs', name: 'Signs outside' },
  { id: 'inside', name: 'Inside the house' },
];
export const groupOf = (p) => (p.kind === 'building' ? 'buildings' : p.inside ? 'inside' : p.kind === 'sign' ? 'signs' : 'outside');
/** Each sign's number on the map (its post shows it; the side list and its tag name it). */
export const SIGN_NUMBERS = Object.fromEntries(MAP_PLACES.filter((p) => p.kind === 'sign').map((p, i) => [p.id, i + 1]));

/**
 * Advance widths of Chakra Petch SemiBold in em (the map's label face, PHASE5.md §5.4): a fixed table so node
 * (scripts/test-map.mjs) lays the labels out as the page does; the page takes the larger of this and the width its own
 * font measures, so a fallback font never makes two labels touch.
 */
const EM = {
  A: 0.62, B: 0.6, C: 0.58, D: 0.62, E: 0.54, F: 0.52, G: 0.62, H: 0.64, I: 0.27, J: 0.48, K: 0.6, L: 0.5, M: 0.76, N: 0.64, O: 0.64, P: 0.58,
  Q: 0.64, R: 0.6, S: 0.56, T: 0.54, U: 0.62, V: 0.6, W: 0.86, X: 0.6, Y: 0.58, Z: 0.54,
  a: 0.52, b: 0.54, c: 0.48, d: 0.54, e: 0.52, f: 0.33, g: 0.54, h: 0.54, i: 0.25, j: 0.25, k: 0.5, l: 0.27, m: 0.82, n: 0.54, o: 0.54, p: 0.54,
  q: 0.54, r: 0.37, s: 0.47, t: 0.35, u: 0.54, v: 0.49, w: 0.75, x: 0.49, y: 0.49, z: 0.45,
  ' ': 0.25, '·': 0.27, '–': 0.5, '-': 0.36, ',': 0.24, '.': 0.24, ':': 0.24, '(': 0.3, ')': 0.3, '’': 0.2,
};
/** The table width of `text` at `px` (6 % over the font's own advance: the halo and rounding). */
export function labelWidth(text, px = MAP.minLabelPx) {
  let em = 0;
  for (const ch of String(text)) em += EM[ch] ?? (/\d/.test(ch) ? 0.55 : 0.6);
  return em * px * 1.06;
}

export const boxesOverlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** Each always-shown label's sides, the first the one it takes when the room is there. */
const LABEL_SIDES = {
  house: ['n', 's', 'in'], office: ['n', 'e', 's', 'w'], guardHut: ['n', 's', 'e', 'w'], gate: ['e', 'n', 's', 'w'],
  silos: ['n', 'w', 'e', 's'], waterTank: ['n', 'w', 's', 'e'], generator: ['w', 'n', 's', 'e'], washBay: ['s', 'w', 'n', 'e'],
  loadingBay: ['s', 'e', 'n', 'w'],
};
const LABEL_ORDER = ['house', 'silos', 'waterTank', 'office', 'generator', 'washBay', 'loadingBay', 'guardHut', 'gate'];
const placeRect = (p, P) => {
  const r = p.rect || { x0: p.at.x - 1, x1: p.at.x + 1, z0: p.at.z - 1, z1: p.at.z + 1 };
  const a = P.toPx(r.x0, r.z0), b = P.toPx(r.x1, r.z1);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
};

/**
 * The always-shown labels of the Farm view placed north, south, east or west of their buildings, each clear of every
 * label placed before it and inside the map box, and off the other buildings where there is room (PHASE5.md §5.4); fix
 * round: off the obstacles too (the sign posts, the machine marks and the farmer: map-marks-plan.js markBoxes).
 * measure(text, px) -> px (the page: max of its font and labelWidth; node: labelWidth). Returns
 * [{ id, text, side, x, y, w, h }] (the label's box in map px; the text sits at its centre).
 */
export function layoutLabels(P, box, { measure = labelWidth, px = MAP.minLabelPx, places = MAP_PLACES, obstacles = [] } = {}) {
  const always = LABEL_ORDER.map((id) => places.find((p) => p.id === id && p.label === 'always')).filter(Boolean);
  for (const p of places) if (p.label === 'always' && !always.includes(p)) always.push(p);
  const rects = new Map(always.map((p) => [p.id, placeRect(p, P)]));
  const h = Math.round(px + 5), gap = 3, done = [];
  const inBox = (b) => b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
  for (const p of always) {
    const r = rects.get(p.id), w = Math.ceil(measure(p.name, px)) + 6;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const at = {
      n: { x: cx - w / 2, y: r.y - gap - h }, s: { x: cx - w / 2, y: r.y + r.h + gap }, e: { x: r.x + r.w + gap, y: cy - h / 2 },
      w: { x: r.x - gap - w, y: cy - h / 2 }, in: { x: cx - w / 2, y: r.y + Math.min(r.h - h, 6) },
    };
    const sides = LABEL_SIDES[p.id] || ['n', 's', 'e', 'w'];
    let best = null;
    sides.forEach((side, k) => {
      const base = at[side];
      // the side's own spot, then nudged along the building's edge when a neighbour is in the way
      const shifts = side === 'n' || side === 's' || side === 'in' ? [0, -w / 3, w / 3, -w / 2, w / 2, -0.75 * w, 0.75 * w] : [0, -h, h, -1.6 * h, 1.6 * h];
      shifts.forEach((d, j) => {
        const b = side === 'e' || side === 'w' ? { x: base.x, y: base.y + d, w, h } : { x: base.x + d, y: base.y, w, h };
        if (!inBox(b) || done.some((o) => boxesOverlap(o, b, 2))) return;
        let cost = k * 40 + j * 12;
        for (const [id, o] of rects) if (id !== p.id || side !== 'in') cost += overlapArea(o, b) * (id === 'house' ? 3 : 1);
        // fix round: the sign posts, the machine marks and the farmer's arrow (ui-map.js; map-marks-plan.js markBoxes)
        for (const o of obstacles) if (boxesOverlap(o, b, 1)) cost += 400 + overlapArea(o, b) * 6;
        if (!best || cost < best.cost) best = { cost, side, ...b };
      });
    });
    if (!best) best = { cost: 1e9, side: sides[0], ...at[sides[0]], w, h };   // no room anywhere: its first side
    done.push({ id: p.id, text: p.name, side: best.side, x: best.x, y: best.y, w: best.w, h: best.h });
  }
  return done;
}

/** The walk in words (the tag, PHASE5.md §5.3): "about 64 m · 16 s walking (about 24 farm minutes at 1×)". */
export function walkWords(metres, { speed = 4, work = 90 } = {}) {
  if (!Number.isFinite(metres)) return 'no way there from here';
  const m = Math.max(1, Math.round(metres)), s = Math.max(1, Math.round(metres / speed)), fm = Math.max(1, Math.round((metres / speed) * work / 60));
  return `about ${m} m · ${s} s walking (about ${fm} farm minute${fm === 1 ? '' : 's'} at 1×)`;
}
/** A route's length: the polyline from (x, z) through its waypoints. */
export function routeLength(x, z, path) {
  if (!Array.isArray(path) || !path.length) return null;
  let L = 0, px = x, pz = z;
  for (const q of path) { L += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
  return L;
}

/**
 * The map box for a window (PHASE5.md §5.4), the one ui-map.js draws: the panel up to 1100 px wide and the window's height
 * less 32 px; the side list 220 px beside the map (under it below 860 px wide). -> { w, h, listBelow, panelW, panelH }.
 */
export const MAP_LAYOUT = { maxW: 1100, margin: 32, padX: 22, chromeV: 100, list: 220, gap: 14, listBelowFrom: 860, listBelowH: 150 };
export function mapBoxSize(winW, winH) {
  const L = MAP_LAYOUT;
  const panelW = Math.min(L.maxW, winW - L.margin), panelH = winH - L.margin;
  const listBelow = winW < L.listBelowFrom;
  const w = Math.floor(panelW - 2 * L.padX - (listBelow ? 0 : L.list + L.gap));
  const h = Math.floor(panelH - L.chromeV - (listBelow ? L.listBelowH + L.gap : 0));
  return { w: Math.max(200, w), h: Math.max(160, h), listBelow, panelW, panelH };
}
