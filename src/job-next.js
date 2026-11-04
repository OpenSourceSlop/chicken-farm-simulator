// Where a job that spans several places goes next (the steps hotfix: the farmer's "each task should clearly state
// what steps you need to take"). The flow test job needs a test at all four regulators, but the strip never said to
// walk on to the next one. Pure logic (node and browser): the job strip's "Then walk to …" row, the job card's
// "Next:" line and the job marker all read the same unfinished places.
//   jobPlaces(inst, c)  -> [{ id, at: { x, z, inside }, name, along?, todo }] the unfinished places of a job that
//                          spans several places (lines, parts of the floor, panel then desk …); [] when none is left;
//                          null for a job done at one place (its spot)
//   nextPlace(inst, c, { from, skip }) -> place + { way, text } | null: the nearest unfinished place from `from`
//                          (the farmer: { x, z, inside }); `skip` leaves out the place whose panel he has open
//   wayText(from, place) "about 3 m south along the west wall" · "out through the house door, then about 14 m …"
//   c = { env, farm, props, engine, flock? }   (the job strip's context)
// Directions are compass words on the farm map (north = the silo side, west = the cooling pad end).
import { SPOTS, SPOTS2, SPOTS3, SPOTS4, FARM, HEATERS, BROOD_BOUNDS, BIRD_BOUNDS, DRINKER_LINES_Z, CLEAN, FLOOR_GRID } from './config.js';
import { flowToday, nippleCmToday, nippleInBand, rimInBand, rimCmNow, LINES_UP_CM, PANS_UP_CM, NIPPLE_DAY0_CM, FLOW_BAND } from './job-figures.js';
import { sectorOf } from './job-engine.js';

const r1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const DOOR_IN = { x: -14, z: 5.0 }, DOOR_OUT = { x: -14, z: 7.8 };
// fixed places: the name the strip says and a landmark for the way there
export const PLACES = {
  feederBox: { at: SPOTS2.feederBox, name: 'the feeder control box', along: 'on the north wall' },
  silo: { at: SPOTS2.silo, name: 'the silo gauge', along: 'outside, north of the house' },
  controller: { at: SPOTS.controller, name: 'the climate controller', along: 'on the north wall across from the door' },
  waterSupply: { at: SPOTS2.waterSupply, name: 'the water supply', along: 'in the south-west corner' },
  fanPanel: { at: SPOTS3.fanPanel, name: 'the fan panel', along: 'at the east end of the north wall' },
  padPump: { at: SPOTS3.padPump, name: 'the cooling pad pump', along: 'outside the west end' },
  houseDoor: { at: SPOTS.houseDoor, name: 'the foot dip at the house door', along: 'in the south wall' },
  footDipGate: { at: { ...FARM.footDipGate, inside: false }, name: 'the foot dip at the gate', along: 'across the gateway' },
  deadBin: { at: SPOTS2.deadBin, name: 'the dead bird bin', along: 'outside the south wall, east of the door' },
  litterHeap: { at: SPOTS2.litterHeap, name: 'the rice husk heap', along: 'outside, west of the door' },
  officeDesk: { at: SPOTS2.officeDesk, name: 'the office desk', along: 'on the office porch by the gate' },
  catchPanels: { at: SPOTS3.catchPanels, name: 'the catching panels', along: 'inside, by the door' },
  boxStacks: { at: SPOTS2.boxStacks, name: 'the chick boxes', along: 'by the truck, south of the door' },
  washBay: { at: SPOTS3.washBay, name: 'the wash bay', along: 'west of the house' },
  // Phase 4 (config SPOTS4): the conditions' machines
  generator: { at: SPOTS4.generator, name: 'the generator', along: 'west of the house, beside the farm road' },
  waterTank: { at: SPOTS4.waterTank, name: 'the water tank gauge and well pump', along: 'north-west of the house' },
  chickTable: { at: SPOTS2.chickTable, name: 'the chick sample table', along: 'outside the house door' },
};
const place = (id, todo, extra = {}) => ({ id, ...PLACES[id], todo, ...extra });
const drinker = (i, todo) => ({ id: `drinkers.${i}`, at: SPOTS2.drinkers[i], name: `the line ${i + 1} regulator`, along: 'along the west wall', todo });
const floor = (x, z, name, todo) => ({ id: `floor:${name}`, at: { x, z, inside: true }, name, todo });

// ---------------- the way there ----------------
function compass(dx, dz) {
  const ax = Math.abs(dx), az = Math.abs(dz), ns = dz < 0 ? 'north' : 'south', ew = dx < 0 ? 'west' : 'east';
  return az > 2.2 * ax ? ns : ax > 2.2 * az ? ew : `${ns}-${ew}`;
}
const leg = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z); return d < 1.5 ? null : `about ${Math.max(2, Math.round(d))} m ${compass(b.x - a.x, b.z - a.z)}`; };
const northSide = (at) => at.inside === false && at.z < -6.5;   // the silos, the pad pump, the gas tank
/** The way from the farmer to a place, in plain words. */
export function wayText(from, p) {
  const at = p.at, inside = from?.inside ?? true;
  if (!from) return p.along || '';
  if (at.inside === true && !inside) { const l = leg(DOOR_IN, at); return `in through the house door${l ? `, then ${l}` : ''}${p.along ? ` (${p.along})` : ''}`; }
  if (at.inside === false && inside) {
    if (northSide(at)) return `out through the house door and round the west end of the house to the north side (${p.along || 'outside'})`;
    const l = leg(DOOR_OUT, at); return `out through the house door${l ? `, then ${l}` : ''}${p.along ? ` (${p.along})` : ''}`;
  }
  if (at.inside === false && northSide(at) && from.z > 6) return `round the west end of the house to the north side (${p.along || 'outside'})`;
  const l = leg(from, at);
  return l ? `${l}${p.along ? ` ${p.along}` : ''}` : 'right here';
}

// ---------------- parts of the floor ----------------
const BROOD_COL = ['west', 'middle', 'east'], HOUSE_COL = ['west end', 'west middle', 'east middle', 'east end'];
/** The sample parts a count job still needs: the brooding floor's six or the house's eight, by name and centre. */
function sectorPlaces(inst, c, todo) {
  const r = inst.def.done, st = inst.st;
  if (r.type !== 'count' || !r.sectors) return null;
  const have = new Set((st.list || []).map((x) => x.s)), need = r.sectors;
  if (have.size >= need) return (st.list || []).length >= r.n ? [] : null;   // any part of the floor will do now
  const house = sectorOf(r, 0, 0, c.env) >= 10, out = [];
  if (house) {
    const w = (BIRD_BOUNDS.xMax - BIRD_BOUNDS.xMin) / 4;
    for (let col = 0; col < 4; col++) for (const north of [true, false]) {
      const x = BIRD_BOUNDS.xMin + (col + 0.5) * w, z = north ? -2.8 : 2.8, s = sectorOf(r, x, z, c.env);
      if (!have.has(s)) out.push(floor(x, z, `the ${HOUSE_COL[col]} of the house, ${north ? 'north' : 'south'} side`, todo));
    }
  } else {
    const w = (BROOD_BOUNDS.xMax - BROOD_BOUNDS.xMin) / 3;
    for (let col = 0; col < 3; col++) for (const north of [true, false]) {
      const x = BROOD_BOUNDS.xMin + (col + 0.5) * w, z = north ? -2.8 : 2.8, s = sectorOf(r, x, z, c.env);
      if (!have.has(s)) out.push(floor(x, z, `the ${BROOD_COL[col]} part of the brooding floor, ${north ? 'north' : 'south'} side`, todo));
    }
  }
  return out;
}
const COUNT_TODO = {
  'd0-floor': 'press T at your feet there', 'w2-lux': 'press L at bird height there', 'w45-air': 'press V at bird height there',
  'd0-vent': 'pick up a chick there (E) and take its vent temperature', 'd1-crop': 'pick up a chick there (E) and feel its crop',
  'w2-check': 'pick up a bird there (E) and watch it walk', 'w3-droppings': 'pick up a bird there (E) and look at its droppings',
  'r-litter': 'squeeze a handful of litter there (Q)',
};
const WEIGH_IDS = new Set(['d7-weigh', 'w2-weigh', 'w3-weigh', 'w45-weigh28', 'w45-weigh35', 'f-weigh']);

// ---------------- floor cells still to do (a walk, the washer, the sprayer, the fork) ----------------
const NX = FLOOR_GRID.nx, NZ = FLOOR_GRID.nz, CELL = FLOOR_GRID.cell;
const cellXZ = (i) => ({ x: FLOOR_GRID.x0 + ((i % NX) + 0.5) * CELL, z: FLOOR_GRID.z0 + (Math.floor(i / NX) + 0.5) * CELL });
/** The nearest cell (litter grid order) that `todo(i)` still wants, at least 2.5 m from the farmer (he sees 2 m round him). */
function nearestCell(todo, from, { brood = false } = {}) {
  const f = from || { x: -14, z: 0 };
  let best = null, bd = Infinity;
  for (let i = 0; i < NX * NZ; i++) {
    const p = cellXZ(i);
    if (brood && (p.x < BROOD_BOUNDS.xMin || p.x > BROOD_BOUNDS.xMax)) continue;
    if (!todo(i)) continue;
    const d = Math.hypot(p.x - f.x, p.z - f.z);
    if (d < 2.5) continue;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
const WALKS = new Set(['r-walk', 'r-walk-pm', 'w2-spread']);
/** A walk's next stretch: the nearest floor not seen yet, then standing still to listen. */
function walkPlaces(inst, c) {
  const r = inst.def.done, st = inst.st || {}, cov = c.engine?.coverage?.(inst);
  if (!cov) return null;
  if (cov.seen >= cov.need) return [];
  const seen = new Set(st.cells || []), p = nearestCell((i) => !seen.has(i), c.from, { brood: cov.area !== 'house' });
  return p ? [floor(p.x, p.z, 'the floor you have not seen yet', `walk on there${r.listen && !st.listened ? '; stand still a moment on the way to look and listen' : ''}`)] : null;
}

// ---------------- the unfinished places of each multi-place job ----------------
/** A line's todo for the flow job: untested this round, a reading outside the band, nipples off the plate. */
export function flowTodo(l, inst, env) {
  const want = flowToday(env), f = l.lastFlow && l.lastFlow.at >= (inst.opensAt ?? -Infinity) - 1e-7 ? l.lastFlow : null;
  if (!f) return 'a flow test there (1 farm minute)';
  if (f.mlMin < want - FLOW_BAND - 1e-9) return `its flow ${r1(f.mlMin)} ml/min is below ${want - FLOW_BAND}: raise the pressure one step (+) and test again`;
  if (f.mlMin > want + FLOW_BAND + 1e-9) return `its flow ${r1(f.mlMin)} ml/min is above ${want + FLOW_BAND}: lower the pressure one step (−) and test again`;
  if (!nippleInBand(l.heightCm, env)) return `its nipples are at ${Math.round(l.heightCm)} cm: winch them to about ${Math.round(nippleCmToday(env))} cm and test again`;
  return null;
}
export function jobPlaces(inst, c) {
  const { env, farm, props } = c, id = inst.id, st = inst.st || {}, met = st.met || [];
  const W = farm?.water?.lines || [], F = farm?.feed?.lines || [], carrying = props?.carrying;
  const parts = c.engine?.parts?.(inst) || [];
  const lines = (todo) => W.map((l, i) => { const t = todo(l, i); return t ? drinker(i, t) : null; }).filter(Boolean);
  switch (id) {
    case 'r-drinkers': return lines((l) => flowTodo(l, inst, env));
    case 'prep-drinkers': return lines((l) => (l.heightCm > NIPPLE_DAY0_CM[1] ? `winch it down to ${NIPPLE_DAY0_CM[0]}–${NIPPLE_DAY0_CM[1]} cm (now ${Math.round(l.heightCm)} cm)`
      : l.heightCm < NIPPLE_DAY0_CM[0] ? `winch it up to ${NIPPLE_DAY0_CM[0]}–${NIPPLE_DAY0_CM[1]} cm (now ${Math.round(l.heightCm)} cm)` : null));
    case 'f-lines': return lines((l) => (l.heightCm < LINES_UP_CM ? `winch it up to ${LINES_UP_CM} cm or more (now ${Math.round(l.heightCm)} cm)` : null));
    case 'r-raise': {
      const out = lines((l) => (nippleInBand(l.heightCm, env) ? null : `winch it to about ${Math.round(nippleCmToday(env))} cm (now ${Math.round(l.heightCm)} cm)`));
      if (F.some((l) => !rimInBand(l.heightCm, env))) out.push(place('feederBox', `the pans to about ${Math.round(rimCmNow(env))} cm (Pans: lower / raise)`));
      return out;
    }
    case 'c-raise': {
      const out = lines((l) => (l.heightCm < LINES_UP_CM ? `winch it up to ${LINES_UP_CM} cm or more` : null));
      if (F.some((l) => l.heightCm < PANS_UP_CM)) out.push(place('feederBox', `every line’s pans up to ${PANS_UP_CM} cm or more`));
      if (!env.broodersUp) out.push(place('controller', 'Temperature: the brooders off and up'));
      return out;
    }
    case 'r-feeders': {
      const out = [];
      if (!met[0] || (parts[2] && !parts[2].met)) out.push(place('feederBox', !met[0] ? 'read the feed meter' : 'every line on, feed in every pan'));
      if (!met[1]) out.push(place('silo', 'read the level gauge'));
      return out;
    }
    case 'r-dips': return [!met[0] && place('footDipGate', 'walk through it'), !met[1] && place('houseDoor', 'walk through it, into the house')].filter(Boolean);
    case 'p-cold-night': return [!met[0] && place('controller', 'keep it open a moment to read it'), !met[1] && floor(HEATERS[0].x, 0, 'the brooding floor', 'walk 30 % of it and look for huddles')].filter(Boolean);
    case 'p-heatwave': return [!met[0] && place('fanPanel', 'keep it open a moment to read it'), !met[1] && place('padPump', 'start the pump, then check the pad'),
      !met[2] && drinker(0, 'a flow test on the line (1 farm minute)')].filter(Boolean);
    case 'f-ready': return [!met[0] && place('catchPanels', 'E puts them up'), parts[1] && !parts[1].met && place('controller', 'Lights: dimmer 20 % or less; at least 3 tunnel fans')].filter(Boolean);
    case 'p-blood': return [!met[0] && place('officeDesk', 'the phone: call the vet about blood in the droppings'), !met[1] && place('waterSupply', 'the Medicine tab: start the medicine')].filter(Boolean);
    // Phase 4: the condition jobs that span several places
    case 'h-brood-air': case 'h-young-heat': {
      if (met[0] && env.padOn && (env.fansManual ?? 0) > 0) return [];
      const fans = id === 'h-brood-air' || (env.dayNumber ?? 0) < 15 ? 'one tunnel fan' : 'two or three tunnel fans';
      return [!env.padOn && place('padPump', 'start the pad pump'), !((env.fansManual ?? 0) > 0) && place('fanPanel', `switch on ${fans}`)].filter(Boolean);
    }
    case 'p-weak-batch': return [!met[0] && place('chickTable', 'the Grade the stacks tab: grade four stacks or more'), !met[1] && place('officeDesk', 'the phone: Call the hatchery')].filter(Boolean);
    case 'p-nipples': return [!met[0] && place('waterSupply', 'open the line 4 flush valve (about 2 farm minutes)'), parts[1] && !parts[1].met && drinker(3, 'a flow test there (1 farm minute)')].filter(Boolean);
    case 'w2-vaccine': {
      const v = farm?.health?.vaccine || { state: 'none' };
      if (v.state === 'drinking' && (v.walked ?? 0) < 0.3) return [floor(-6, 0, 'the house floor', 'walk slowly through the house while the birds drink')];
      return v.state === 'drunk' || v.state === 'drinking' ? [] : [place('waterSupply', v.state === 'mixed' ? 'open the main valve' : v.state === 'thirst' ? 'Vaccine tab: mix the vaccine, then open the main valve' : 'shut the main valve (Vaccine tab)')];
    }
    case 'pl-measure': {
      const seen = st.seen || {}, axis = !('length' in seen) ? 'length' : !('width' in seen) ? 'width' : null;
      if (!axis) return [];
      if (carrying !== 'tape') return [place('officeDesk', 'take the tape measure')];
      const hook = props?.tapeHook, len = axis === 'length';
      if (!hook || hook.axis !== axis) return [floor(len ? -23 : -10, len ? 0 : -5.2, len ? 'the west end wall inside the house' : 'the north wall inside the house', 'E hooks the tape there')];
      return [floor(len ? 23 : -10, len ? 0 : 5.2, len ? 'the east end wall' : 'the south wall', 'E reads the tape there')];
    }
    case 'd0-place': {
      if (carrying === 'boxes') return [floor(HEATERS[0].x, 0, 'the brooding area', 'E tips the stack onto the litter')];
      return (farm?.flock?.inBoxes ?? 0) > 0 ? [place('boxStacks', 'E picks up the next stack')] : [];
    }
    case 'p-wet-patch': {
      const lk = farm?.water?.leak;
      if (carrying !== 'sack') return [place('litterHeap', 'take a sack of husk')];
      return lk ? [floor(lk.x, DRINKER_LINES_Z[lk.line ?? 2], 'the wet patch', 'E spreads the husk on it')] : null;
    }
    case 'p-pad-patch': return carrying !== 'sack' ? [place('litterHeap', 'take a sack of husk')] : [floor(-22.6, 0, 'the wet strip at the pad end', 'E spreads the husk on it')];
    case 'w3-topup': {
      const L2 = farm?.litter, caked = !met[0] && L2?.cakedGrid, list = (st.parts?.[1]?.list) || [];
      if (carrying === 'fork' && caked) { const p = nearestCell((i) => !!caked[i], c.from); return p ? [floor(p.x, p.z, 'the nearest caked patch', 'E forks it over')] : []; }
      if (carrying === 'sack' && !met[1]) {
        const fz = c.from?.z ?? 0, z = DRINKER_LINES_Z.reduce((b, v) => (Math.abs(v - fz) < Math.abs(b - fz) ? v : b), DRINKER_LINES_Z[0]);
        const parts = new Set(list.map((x) => x.s)), x = parts.size < 2 && parts.size ? (Math.min(...list.map((q) => q.x ?? 0)) < 0 ? 12 : -12) : Math.max(-22, Math.min(22, c.from?.x ?? -12));
        return [floor(x, z, 'the litter under a drinker line', 'E spreads the sack there')];
      }
      const out = [];
      if (!met[0]) out.push(place('litterHeap', 'take the fork (caked patches)'));
      else if (!met[1]) out.push(place('litterHeap', 'take a sack of husk (four, under the drinker lines)'));
      return out;
    }
    case 'c-wash': case 'c-spray': case 'p-rewash': {
      const C = farm?.clean, spray = id === 'c-spray' || (id === 'p-rewash' && met[0]), tool = spray ? 'sprayer' : 'washer';
      if (!C) return null;
      if (carrying !== tool) return [place('washBay', `take the ${spray ? 'disinfectant sprayer' : 'pressure washer'}`)];
      const p = nearestCell((i) => (spray ? (C.spray?.[i] ?? 1) < 0.9 : (C.wash?.[i] ?? 1) < 0.9), c.from);
      return p ? [floor(p.x, p.z, spray ? 'the floor not disinfected yet' : 'the floor not washed yet', spray ? 'walk the sprayer over it' : 'walk the washer over it')] : [];
    }
    case 'c-bait': return SPOTS3.bait.map((b, i) => (farm?.clean?.baits?.[i] ? null : { id: `bait.${i}`, at: b, name: `bait station ${i + 1}`, along: 'at a corner of the house', todo: 'E sets the bait' })).filter(Boolean);
    case 'c-brush': return Object.entries(SPOTS3.brush).filter(([k]) => !farm?.clean?.brushed?.[k]).map(([k, v]) => ({ id: `brush.${k}`, at: v, name: v.label.toLowerCase(), todo: 'E brushes the dust off' }));
    case 'c-swabs': case 'p-reswab': {
      if (carrying !== 'swabs') return [place('washBay', 'take the swab kit')];
      return CLEAN.swabSpots.map((s, i) => (String(i) in (st.seen || {}) ? null : { id: `swab.${i}`, at: { ...s, inside: true }, name: `the flag: ${s.label.toLowerCase()}`, todo: 'E takes a swab' })).filter(Boolean);
    }
    case 'p-lame': {
      const lame = (c.flock?.debug?.sickBirds?.() || []).filter((b) => b.lame), f = c.from || { x: -14, z: 0 };
      if (!lame.length) return null;
      const b = lame.reduce((a, q) => (Math.hypot(q.x - f.x, q.z - f.z) < Math.hypot(a.x - f.x, a.z - f.z) ? q : a));
      return [floor(b.x, b.z, 'the nearest bird sitting apart', 'E picks it up; watch it walk (legs sign: cull gait 4–5)')];
    }
    default: break;
  }
  if (WALKS.has(id)) return walkPlaces(inst, c);
  if (inst.def.spot === 'dead') {
    if (carrying === 'bucket') return [place('deadBin', 'count them into the bin')];
    const near = c.flock?.dead?.near?.(c.from?.x ?? -14, c.from?.z ?? 0, 80) || [];
    return near.length ? [floor(near[0].x, near[0].z, 'the nearest dead bird', 'E picks it up')] : null;
  }
  if (WEIGH_IDS.has(id)) {
    if (carrying !== 'frame') return (st.list || []).length >= inst.def.done.n ? [] : [{ id: 'birdScale', at: SPOTS2.birdScale, name: 'the bird scale', along: 'in the house', todo: 'take the scale and frame' }];
    return sectorPlaces(inst, c, 'set the frame down there (E)');
  }
  if (id in COUNT_TODO) {
    const more = sectorPlaces(inst, c, COUNT_TODO[id]);
    if (id === 'r-litter' && (inst.def.done.nearDrinker ?? 0) > (st.list || []).filter((x) => x.near).length) {
      const fz = c.from?.z ?? 0, z = DRINKER_LINES_Z.reduce((b, v) => (Math.abs(v - fz) < Math.abs(b - fz) ? v : b), DRINKER_LINES_Z[0]);
      return [floor(Math.max(-22, Math.min(1, c.from?.x ?? -10)), z, 'under a drinker line', 'squeeze a handful there (Q)'), ...(more || [])];
    }
    return more;
  }
  return null;
}

/** The nearest unfinished place of a multi-place job from the farmer (skipping the one whose panel is open). */
export function nextPlace(inst, c, { from = null, skip = null } = {}) {
  const all = jobPlaces(inst, { ...c, from });
  if (!all || !all.length) return null;
  const left = skip ? all.filter((p) => p.id !== skip) : all;
  if (!left.length) return null;
  const f = from || { x: -14, z: 0, inside: true };
  const d = (p) => Math.hypot(p.at.x - f.x, p.at.z - f.z) + ((p.at.inside ?? true) !== (f.inside ?? true) ? 6 : 0);
  const best = left.slice().sort((a, b) => d(a) - d(b))[0];
  const way = wayText(f, best), todo = way === 'right here' ? best.todo.replace(/ there\b/, ' here') : best.todo;
  return { ...best, todo, way, left: left.length, text: `${best.name.charAt(0).toUpperCase()}${best.name.slice(1)}, ${way}: ${todo}.` };
}
/** The id of the place a panel stands at (the strip's skip). */
export const PANEL_PLACE = { 'feeder-box': 'feederBox', silo: 'silo', controller: 'controller', 'water-supply': 'waterSupply', 'fan-panel': 'fanPanel',
  'pad-pump': 'padPump', 'office-desk': 'officeDesk', 'wash-bay': 'washBay', 'litter-heap': 'litterHeap', 'bird-scale': 'birdScale',
  generator: 'generator', 'water-tank': 'waterTank', 'chick-table': 'chickTable', 'chick-grading': 'chickTable' };
export const panelPlace = (panelId) => (panelId?.startsWith('drinker-') ? `drinkers.${panelId.slice(8)}` : PANEL_PLACE[panelId] || null);
