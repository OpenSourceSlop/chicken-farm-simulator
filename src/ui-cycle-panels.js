// Phase 3 equipment and inspection panels (PHASE3.md §13.8, §14.3). Owner: package "panels". ui.js
// (package "run") calls registerCyclePanels once, after the Phase 2 panels are registered. The Phase 3
// additions to the Phase 2 panels (controller, water supply, silo, feeder box, husk heap, weigh panel) live in
// ui-climate.js, ui-water.js, ui-equipment.js and ui-inspect.js; the new panels in ui-cycle-*.js.
//
// registerCyclePanels(api)
//   api.register(id, build, { kind })   kind: 'panel' (the slow panel clock) | 'sign' | 'paused'
//   api.L        Phase 2's panel helpers (ui.js L): act(id, args) = farm.act, uiAct(id, args) = a ui-only
//                EV.ACTION, close(), env, farm, records, skills, props, flock, player, events, level()
//   api.boards(id)   the board / plate of today (content-signs-cycle boardsForDay(env.dayNumber))
//   api.plate(id, { open })   Phase 2's engraved plate (ui-boards buildPlate), reading the merged board of
//                today: Phase 3 plates and the extra lines from their fromDay
//   api.sourceLabel(src)   "Week 2 guide", "general practice", ...
//   api.openPanel(id)   open another panel (e.g. the plan sheet from the records book's Plan tab)
// A built panel is { el, update?(dt, force), onOpen?(), onClose?(), kind?, take?(payload) } (Phase 2's panel
// shape). take(p): ui.js calls it right after opening the panel for an EV.BIRD_PICK (p = { index, x, z,
// purpose }). From day 8 ui.js routes EV.BIRD_PICK to 'bird-check' (purpose 'check', 'lame' or 'sick').
//
// What this adds to L (read by the panels and the harness; nothing else depends on it):
//   L.cycle.panel(id)       the built panel of an id (tests: L.cycle.panel('bird-check').take(p))
//   L.cycle.samples         today's bird-check readings { add(e), today(day) } (the sample card, the tally)
// It also starts the climate memory the charts draw from (ui-cycle-kit installHistory).
import { injectCycleStyle } from './ui-cycle-style.js';
import { installHistory } from './ui-cycle-kit.js';
import { buildPlanSheet } from './ui-cycle-plan.js';
import { buildBirdCheck } from './ui-cycle-birdcheck.js';
import { buildFanPanel, buildPadPump } from './ui-cycle-fans.js';
import { buildCurtainWinch, buildGasTank } from './ui-cycle-house.js';
import { buildLoadingBay } from './ui-cycle-harvest.js';
import { buildWashBay, buildDeadBin } from './ui-cycle-clean.js';

/** Panel ids of Phase 3, the plate each shows and its clock class (PHASE3.md §13.3 / §13.4). */
export const CYCLE_PANELS = {
  'plan-sheet': { title: 'Planning sheet', plate: 'plan-sheet', kind: 'paused', build: buildPlanSheet },
  'bird-check': { title: 'Bird in the hand', plate: 'bird-check', kind: 'panel', build: buildBirdCheck },
  'curtain-winch': { title: 'Brooding curtain winch', plate: 'sign-curtain', kind: 'panel', build: buildCurtainWinch },
  'fan-panel': { title: 'Fan panel', plate: 'fan-panel', kind: 'panel', build: buildFanPanel },
  'pad-pump': { title: 'Cooling pad pump', plate: 'pad-pump', kind: 'panel', build: buildPadPump },
  'gas-tank': { title: 'Gas tank gauge', plate: 'gas-tank', kind: 'panel', build: buildGasTank },
  'loading-bay': { title: 'Loading bay: weight tickets', plate: 'loading-bay', kind: 'panel', build: buildLoadingBay },
  'wash-bay': { title: 'Wash bay', plate: 'wash-bay', kind: 'panel', build: buildWashBay },
  'dead-bin': { title: 'Dead bird bin', plate: null, kind: 'panel', build: buildDeadBin },
};


/** Today's bird-check readings (cleared when the clock goes back: a new run or a replay). */
function sampleLog() {
  let list = [];
  return {
    add(e) {
      const last = list[list.length - 1];
      if (last && e.day < last.day) list = [];
      list.push(e);
      while (list.length && list[0].day < e.day - 1) list.shift();
    },
    today(day) { return list.filter((e) => e.day === day); },
  };
}

export function registerCyclePanels(api) {
  injectCycleStyle();
  const L = api.L;
  installHistory(L);
  const built = {};
  L.cycle = { panel: (id) => built[id] ?? null, samples: sampleLog() };
  for (const [id, p] of Object.entries(CYCLE_PANELS)) {
    api.register(id, () => {
      const panel = p.build(api);
      built[id] = panel;
      // a panel removed by clearBuilt (a new run) is forgotten too
      const dispose = panel.dispose;
      panel.dispose = () => { if (built[id] === panel) delete built[id]; dispose?.(); };
      return panel;
    }, { kind: p.kind });
  }
}
