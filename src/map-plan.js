// The farm overview map, the pure part (PHASE5.md §5): every place the map draws and a click walks to, the projection of
// the farm (or the house) into the map's box, and where the farmer stands to use a place. No DOM, no three.js: node tests
// (scripts/test-map.mjs) check that every place has a free, reachable stand point and that the always-shown labels do not
// overlap at 960 x 600 and 1280 x 800. Owner after the design round: package "experience" (the list, labels and the look);
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
