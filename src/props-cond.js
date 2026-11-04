// Phase 4 scene of the harder conditions (PHASE4.md §8, §12.4). Owner: package "scene". main.js (integrator)
// builds it after the props and updates it every frame after props.update.
//   interactables  `generator` (SPOTS4.generator, the rainy season) and `water-tank` (SPOTS4.waterTank, a water
//                  problem), priority 10; the panels package builds their panels (ui-cond-panels.js)
//   the generator  control panel, transfer switch, exhaust puffs, the set shaking (props-cond-gen.js)
//   the water tank sight gauge with its low marker, the well pump and its gauges (props-cond-water.js)
//   a bad batch    open boxes with chicks lying still, the cull box, the feed trays and chick paper (props-cond-batch.js)
//   facts tabs     on the generator panel, the pump and the chick table (the plates generator, water-tank,
//                  chick-grading; props.highlight)
// Elsewhere in the scene package: rain and storms, the season's colours and the lamps in a power cut (world*.js), the
// power cut in the house, the storm flaps and line 4's rust (house*.js), the sign-power board and the boards' faces
// from boardsForDay (props-boards.js), the flock at the drinker lines and the weak chicks (flock*.js).
// Everything stays hidden in the sandbox and in a run without its condition (farm.condition).
import * as THREE from 'three';
import { SPOTS4 } from './config.js';
import { EV } from './events.js';
import { createBoxPool } from './props-kit.js';
import { condOf, inLevel } from './world-cond.js';
import { buildGenerator, GEN_PANEL } from './props-cond-gen.js';
import { buildWaterTank, PUMP } from './props-cond-water.js';
import { buildBadBatch } from './props-cond-batch.js';

/** @returns {{ update(dt: number, env: object, view: object): void, dispose(): void }} */
export function buildCondScene(ctx) {
  const { interact, farm } = ctx;
  const inCond = (id) => () => farm.mode === 'level' && farm.condition === id;
  const items = [
    { id: 'generator', label: SPOTS4.generator.label, x: SPOTS4.generator.x, z: SPOTS4.generator.z, radius: 2.2, inside: false, verb: 'Use the', priority: 10, enabled: inCond('rainy') },
    { id: 'water-tank', label: SPOTS4.waterTank.label, x: SPOTS4.waterTank.x, z: SPOTS4.waterTank.z, radius: 2.2, inside: false, verb: 'Read the', priority: 10, enabled: inCond('water') },
  ];
  if (interact) for (const it of items) interact.add(it);

  const group = new THREE.Group();
  group.name = 'props-cond';
  ctx.scene.add(group);
  // two small instanced pools: lit lamps (unlit material) and the moving parts (handles, needles, the tank's fill)
  const lit = createBoxPool(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 16);
  const parts = createBoxPool(new THREE.MeshLambertMaterial({ color: 0xffffff }), 24);
  lit.mesh.name = 'props-cond-lamps';
  parts.mesh.name = 'props-cond-parts';
  group.add(lit.mesh, parts.mesh);
  const gen = buildGenerator(group, parts, lit, ctx.scene);
  const tank = buildWaterTank(group, parts, lit);
  const props = ctx.props;
  const batch = buildBadBatch(group, props);

  // the facts tabs of the condition plates (the panels' plates; the job card's signs list them)
  const tabs = props?.debug?.boards?.tabSpots;
  if (tabs) {
    tabs.set('generator', { x: GEN_PANEL.x + 0.12, y: GEN_PANEL.y + 0.48, z: GEN_PANEL.z + 0.12, ry: 0, rx: 0 });
    tabs.set('water-tank', { x: PUMP.x + 0.5, y: 1.35, z: PUMP.z + 0.15, ry: 0, rx: 0 });
    tabs.set('chick-grading', { x: SPOTS4.chickTable.x - 0.4, y: 1.25, z: SPOTS4.chickTable.z + 0.3, ry: 0, rx: 0 });
  }
  // the grading answers fill the cull box; a new level (props.reset) empties it
  const events = ctx.events;
  const offs = [];
  if (events) offs.push(events.on(EV.ACTION, (p) => { if (p && p.id === 'chicks.grade' && inLevel(farm)) batch.graded(p.result); }));

  const st = { cond: null };
  function update(dt, env) {
    const cond = condOf(farm);
    st.cond = cond;
    group.visible = inLevel(farm);
    if (!group.visible) return;
    if (cond === 'rainy') gen.update(dt, farm, ctx.player?.position); else gen.hide();
    if (cond === 'water') tank.update(dt, farm); else tank.hide();
    batch.update(farm, env, cond === 'badChicks');
    lit.flush(); parts.flush();
  }

  return {
    group, st,
    update,
    /** Props calls these with its own reset / save (the cull box's count rides in the props save). */
    reset() { batch.reset(); },
    serialize() { return batch.serialize(); },
    restore(d) { batch.restore(d); },
    debug: { gen, tank, batch, lit, parts },
    dispose() {
      if (interact) for (const it of items) interact.remove(it.id);
      for (const off of offs) if (typeof off === 'function') off();
      ctx.scene.remove(group);
    },
  };
}
