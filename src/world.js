// Farm surroundings, sky and sunlight. Owner: world agent.
// buildWorld(ctx) -> { colliders, interactables, sun, update(dt, env, view) }
// Helper files (all world-*.js): util (geometry builder, noise), layout (derived positions),
// sky (dome, stars, sun/moon, fog), ground (yard, roads), fields (paddies, groves, hills),
// gate (fence, gate, guard hut, spray arch, foot dip, sign), buildings (office, generator,
// water tower), silos (silos, auger, spirit house), yard (trees inside the fence), trees, signs,
// lamps (yard lights that glow at night), props (pickup, motorbike, flag).
import * as THREE from 'three';
import { SPOTS } from './config.js';
import { GeoBuilder, makeMaterials, occlusion } from './world-util.js';
import { createSky } from './world-sky.js';
import { buildGround } from './world-ground.js';
import { buildFields } from './world-fields.js';
import { buildFence, buildGateArea } from './world-gate.js';
import { buildBuildings } from './world-buildings.js';
import { buildSilos, spiritHouse } from './world-silos.js';
import { buildYardTrees } from './world-yard.js';
import { makeSignTextures } from './world-signs.js';
import { POND } from './world-layout.js';
import { buildLamps } from './world-lamps.js';
import { buildProps } from './world-props.js';

export function buildWorld(ctx) {
  const { scene } = ctx;
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const mats = makeMaterials();
  const sky = createSky(ctx);
  const colliders = [];
  const signTex = makeSignTextures(ctx.renderer);

  root.add(buildGround(ctx, mats));
  const fields = buildFields(ctx, mats);
  root.add(fields.group);
  buildFence(root, mats, colliders);
  buildGateArea(root, mats, colliders, signTex);
  buildBuildings(root, mats, colliders, signTex);
  buildSilos(root, mats, colliders);
  const shrine = new GeoBuilder();
  spiritHouse(shrine, null, -29.6, 29.6, colliders);
  root.add(shrine.mesh(mats.flat, { name: 'spirit-house' }));
  const sway = buildYardTrees(root, colliders);
  const lamps = buildLamps(root, mats, colliders);
  const props = buildProps(root, mats, colliders);

  // the pond: overlapping circles along its long axis
  for (const k of [-0.86, -0.6, -0.22, 0.22, 0.6, 0.86]) {
    colliders.push({ type: 'circle', x: POND.x + k * POND.rx, z: POND.z, r: POND.rz * 1.12 * Math.sqrt(1 - k * k * 0.92) + 0.2 });
  }

  const interactables = [
    { id: 'sign-gate', label: SPOTS.signGate.label, x: SPOTS.signGate.x, z: SPOTS.signGate.z, radius: 2.2 },
  ];

  if (ctx.env) sky.update(0, ctx.env, { camera: ctx.camera, playerPos: new THREE.Vector3() });
  let time = 0;

  return {
    colliders,
    interactables,
    sun: sky.sun,
    update(dt, env, view) {
      time += dt;
      sway.uTime.value = time;
      props.update(time);
      sky.update(dt, env, view);
      fields.update(sky);
      lamps.update(sky.state.night);
      const glow = Math.max(0, Math.min(1, (sky.state.night - 0.15) / 0.5));
      mats.glass.emissive.setRGB(0.95 * glow, 0.56 * glow, 0.2 * glow);
      if (view && view.camera && view.playerPos) {
        occlusion.uCam.value.copy(view.camera.position);
        occlusion.uPlayer.value.set(view.playerPos.x, 1.0, view.playerPos.z);
      }
    },
  };
}
