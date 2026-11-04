// Phase 4 panels of the harder conditions (PHASE4.md §4, §10.3, §12.3). Owner: package "panels". ui.js (package "run")
// calls registerCondPanels(api) once, after registerCyclePanels, with the same api (PHASE3.md §13.8).
// STUB (the Phase 4 design): plain placeholders that call the farm's Phase 4 actions, so the run and scene
// packages can open them (__game.ui.openPanel('generator')) and the farm stub answers; the panels package builds
// the real ones (the generator's fuel gauge, start key and transfer switch, the tank's level, pressure and
// current, the grading table of a bad batch) with their plates (content-signs-cond.js BOARDS_COND) and job strips.
//
// Panel ids and their plates (PHASE4.md §12.3; the short waits are the panel's bar at the panel clock, §10.3):
//   generator      plate 'generator'      gen.start, gen.switch { to }, gen.stop, gen.test, gen.fuel   (rainy season)
//   water-tank     plate 'water-tank'     water.tank (read), pump.fix                                  (water problem)
//   chick-grading  plate 'chick-grading'  chicks.grade { stack } per stack still in the boxes          (bad batch)
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell } from './ui-equipment.js';

export const COND_PANELS = {
  generator: { title: 'Generator', plate: 'generator', kind: 'panel' },
  'water-tank': { title: 'Water tank and well pump', plate: 'water-tank', kind: 'panel' },
  'chick-grading': { title: 'Grading the chicks', plate: 'chick-grading', kind: 'panel' },
};

const KEYS = {
  generator: [['Start the generator', 'gen.start'], ['House on the generator', 'gen.switch', { to: 'generator' }], ['House on the mains', 'gen.switch', { to: 'mains' }],
    ['Stop the generator', 'gen.stop'], ['Test run (10 minutes)', 'gen.test'], ['Fill the fuel tank', 'gen.fuel']],
  'water-tank': [['Read the gauges', 'water.tank'], ['Repair the pump', 'pump.fix']],
  'chick-grading': [0, 1, 2, 3, 4, 5].map((i) => [`Grade stack ${i + 1}`, 'chicks.grade', { stack: i }]),
};

function buildPlaceholder(api, id) {
  const { L } = api, p = COND_PANELS[id];
  const shell = equipShell({ cls: `equip--cond equip--${id}`, icon: ICONS.sliders, title: p.title, sub: 'Phase 4 placeholder (package panels builds it)', plates: [], onClose: L.close });
  const out = h('p', { class: 'equip-note' }, '—');
  const keys = KEYS[id].map(([label, action, args]) => {
    const b = button({ class: 'btn btn--machine' }, label);
    b.addEventListener('click', () => { const r = L.act(action, args || {}); setText(out, `${label}: ${JSON.stringify(r)}`); });
    return b;
  });
  shell.main.append(h('div', { class: 'equip-reads equip-reads--col' }, keys), out);
  return {
    el: shell.el,
    update() {
      const f = L.farm;
      if (id === 'generator' && f.power) setText(out, `Power ${f.power.on ? 'on' : 'off'} (${f.power.source ?? 'none'}) · mains ${f.power.mains ? 'on' : 'off'} · generator ${f.generator.running ? 'running' : 'stopped'}, ${Math.round(f.generator.fuelL)} L`);
    },
  };
}

export function registerCondPanels(api) {
  for (const [id, p] of Object.entries(COND_PANELS)) api.register(id, () => buildPlaceholder(api, id), { kind: p.kind });
}
