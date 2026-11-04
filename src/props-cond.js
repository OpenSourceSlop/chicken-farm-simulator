// Phase 4 scene of the harder conditions (PHASE4.md §8, §12.4). Owner: package "scene". main.js (integrator)
// builds it after the props and updates it every frame after props.update.
// STUB (the Phase 4 design): registers the two new machines so E reaches their panels in a run of their condition
// (`generator` in the rainy season, `water-tank` with a water problem; the panels package builds the panels, the
// stub of ui-cond-panels.js answers now). The scene package replaces it with PHASE4.md §8: rain and storms
// (farm.weatherNow), the power cut (farm.power: the house lights, fan blades, pad water and controller LCD dark),
// the generator set with its exhaust and the transfer switch, the well pump and the tank's sight gauge
// (farm.waterTank), the storm flaps (farm.house.flapsClosed), the sign-power board, the hot season's dry look,
// the bad batch's small, uneven and weak chicks and the feed trays and chick paper (farm.brood.trays).
// Everything stays hidden in the sandbox and in a run without its condition.
import { SPOTS4 } from './config.js';

/** @returns {{ update(dt: number, env: object, view: object): void, dispose(): void }} */
export function buildCondScene(ctx) {
  const { interact, farm } = ctx;
  const inCond = (id) => () => farm.mode === 'level' && farm.condition === id;
  const items = [
    { id: 'generator', label: SPOTS4.generator.label, x: SPOTS4.generator.x, z: SPOTS4.generator.z, radius: 2.2, inside: false, verb: 'Use the', enabled: inCond('rainy') },
    { id: 'water-tank', label: SPOTS4.waterTank.label, x: SPOTS4.waterTank.x, z: SPOTS4.waterTank.z, radius: 2.2, inside: false, verb: 'Read the', enabled: inCond('water') },
  ];
  if (interact) for (const it of items) interact.add(it);
  return {
    update() {},
    dispose() { if (interact) for (const it of items) interact.remove(it.id); },
  };
}
