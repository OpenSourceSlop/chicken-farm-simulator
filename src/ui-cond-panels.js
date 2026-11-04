// Phase 4 panels of the harder conditions (PHASE4.md §4, §10.3, §12.3). Owner: package "panels". ui.js (package "run")
// calls registerCondPanels(api) once, after registerCyclePanels, with the same api (PHASE3.md §13.8).
//
// Panel ids and their plates (the short waits are the panel's bar at the panel clock, then the action, §10.3):
//   generator      plate 'generator'      gen.start (2 min bar), gen.switch { to }, gen.stop, gen.test (10 min bar), gen.fuel
//                                         (the rainy season; ui-cond-generator.js)
//   water-tank     plate 'water-tank'     water.tank (the gauges), pump.fix (a farm process: fixing for 2 farm hours)
//                                         (a water problem; ui-cond-tank.js)
//   chick-grading  plate 'chick-grading'  chicks.grade { stack } per stack still in the boxes (6 min bar each)
//                                         (a bad batch; ui-cond-grading.js; the chick table's Grade the stacks tab shows it too)
// Each panel shows the open job done there at the top of its working plate (ui-jobstrip.js withJobStrip). A plate built
// with no condition on the farm reads its own board (ui-boards buildPlate), so a harness can open any of them.
// What this adds to L: L.cond.panel(id) the built panel of an id, L.cond.grading() the grading table, L.cond.stripRowsHtml(rows)
// the job strip's drawing of rows (tests and the harness).
import { withJobStrip, stripRowsHtml } from './ui-jobstrip.js';
import { injectCondStyle } from './ui-cond-kit.js';
import { buildGenerator } from './ui-cond-generator.js';
import { buildWaterTank } from './ui-cond-tank.js';
import { buildChickGrading, gradingFor } from './ui-cond-grading.js';

export const COND_PANELS = {
  generator: { title: 'Generator', plate: 'generator', kind: 'panel', build: buildGenerator },
  'water-tank': { title: 'Water tank and well pump', plate: 'water-tank', kind: 'panel', build: buildWaterTank },
  'chick-grading': { title: 'Grading the chicks', plate: 'chick-grading', kind: 'panel', build: buildChickGrading },
};

export function registerCondPanels(api) {
  injectCondStyle();
  const L = api.L;
  gradingFor(L); // the grading table listens to the bus from the start (the hatchery call, every chicks.grade)
  const built = {};
  L.cond = { panel: (id) => built[id] ?? null, grading: () => gradingFor(L), stripRowsHtml };
  for (const [id, p] of Object.entries(COND_PANELS)) {
    api.register(id, withJobStrip(L, id, () => {
      const panel = p.build(api);
      built[id] = panel;
      const dispose = panel.dispose;
      panel.dispose = () => { if (built[id] === panel) delete built[id]; dispose?.(); };
      return panel;
    }), { kind: p.kind });
  }
}
