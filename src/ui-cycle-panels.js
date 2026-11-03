// Phase 3 equipment and inspection panels — STUB (PHASE3.md §13.8, §14.3). Owner: package "panels",
// which builds every panel below (and the Phase 3 additions to ui-climate / ui-water / ui-equipment /
// ui-inspect) in its own ui-cycle-*.js files. ui.js (package "run") calls registerCyclePanels once,
// after the Phase 2 panels are registered.
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
// purpose }) or an EV.FRAME_SET (Phase 2's chick-in-hand and weigh panels do the same). From day 8 ui.js
// (package "run") routes EV.BIRD_PICK to 'bird-check' (purpose 'check', 'lame' or 'sick'); days 0-7 stay
// 'chick-in-hand'.
//
// The stub registers a placeholder for every new panel id: its title, its plate (facts with their
// sources) and one line saying the panel is being built, so E on a new interactable opens something.
import { h } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell } from './ui-equipment.js';

/** Panel ids of Phase 3 and the plate each shows (PHASE3.md §13.3 / §13.4). */
export const CYCLE_PANELS = {
  'plan-sheet': { title: 'Planning sheet', plate: 'plan-sheet' },
  'bird-check': { title: 'Bird in the hand', plate: 'bird-check' },
  'curtain-winch': { title: 'Brooding curtain winch', plate: 'sign-curtain' },
  'fan-panel': { title: 'Fan panel', plate: 'fan-panel' },
  'pad-pump': { title: 'Cooling pad pump', plate: 'pad-pump' },
  'gas-tank': { title: 'Gas tank gauge', plate: 'gas-tank' },
  'loading-bay': { title: 'Loading bay: weight tickets', plate: 'loading-bay' },
  'wash-bay': { title: 'Wash bay', plate: 'wash-bay' },
  'dead-bin': { title: 'Dead bird bin', plate: null },
};

export const STUB = true;

export function registerCyclePanels(api) {
  for (const [id, p] of Object.entries(CYCLE_PANELS)) {
    api.register(id, () => placeholder(api, p), { kind: 'panel' });
  }
}

function placeholder(api, p) {
  const shell = equipShell({ cls: 'equip--cycle', icon: ICONS.sliders, title: p.title, sub: 'Full flock cycle (Phase 3)', plates: [], onClose: () => api.L.close() });
  const b = p.plate ? api.boards(p.plate) : null;
  shell.main.append(h('p', { class: 'equip-note' }, 'This panel is being built for the full flock cycle.'),
    b ? h('ul', { class: 'equip-note' }, b.items.map((x) => h('li', null, `${x.text} `, h('small', null, `(${api.sourceLabel(x.source)})`)))) : null);
  return { el: shell.el };
}
