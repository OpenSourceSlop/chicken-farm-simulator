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
// Phase 4 (package "scene", PHASE4.md §8.1, §8.2, §8.6): rain and storms, the season's colours, the power cut's lamps
import { buildRain } from './world-rain.js';
import { createSeason } from './world-season.js';
import { condOf, powerOff, rainOf, stormOf } from './world-cond.js';

export function buildWorld(ctx) {
  const { scene } = ctx;
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const mats = makeMaterials();
  const sky = createSky(ctx);
  const colliders = [];
  const signTex = makeSignTextures(ctx.renderer);

  const ground = buildGround(ctx, mats);
  root.add(ground);
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

  // Phase 4: rain, puddles and lightning; the season's land colours; the wet ground; the lamps out in a power cut
  const rain = buildRain(root);
  const season = createSeason({ ...ground.userData, ground: ground.userData.groundMat, rice: fields.riceMesh });
  const metalBase = mats.metalFade.color.clone();
  const wx = { rain: 0, flash: 0, hot: 0 };
  let powerK = 1, wetK = -1, lastCond, lastDay = null;
  const genRoof = root.getObjectByName('generator-roof');

  return {
    colliders,
    interactables,
    sun: sky.sun,
    // 0 by day .. 1 at full night (after update). main.js passes it on as view.night, so the house
    // lights come on together with the yard lamps and office windows.
    get night() { return sky.state.night; },
    /** Phase 4: the rain's state (rain, wet, flash, flashes) for the scene's other parts and the harness. */
    get weather() { return rain.st; },
    // test hooks: rain.flash() forces a lightning flash; rain.drawn = streak instances drawn now
    debug: { rain: { flash: () => rain.flash(), get drawn() { return rain.debug.drawn; }, st: rain.st, parts: rain.debug }, season, sky },
    update(dt, env, view) {
      time += dt;
      sway.uTime.value = time;
      props.update(time);
      const farm = ctx.farm, cond = condOf(farm);
      season.set(cond);
      // a new run in another season (or the sandbox) starts with its own weather: no rain or wet ground carried over from
      // the last storm of the run before (Phase 5 integration: a rainy day's streaks and puddles showed in a new normal run)
      // fix round: also when the farm's time jumps more than an hour between frames (a slot loaded, a replay, a level start
      // or a long skip in the same season: a storm's streaks and wet ground stayed on a dry hour)
      const day = Number.isFinite(env?.day) ? env.day : null, jump = day != null && lastDay != null && Math.abs(day - lastDay) > 1 / 24;
      lastDay = day;
      if (cond !== lastCond || jump) { lastCond = cond; const r0 = rainOf(farm); rain.st.rain = r0; rain.st.wet = r0 > 0 ? 1 : 0; }
      const r = rain.update(dt, rainOf(farm), stormOf(farm), view, sky.horizon);
      wx.rain = r.rain; wx.flash = r.flash; wx.hot = cond === 'hot' ? 1 : 0;
      sky.update(dt, env, view, wx);
      fields.update(sky, season.season);
      season.wet(r.wet);
      if (view) view.rainWet = r.wet; // the house's wet roof reads it (house.update gets the same view object)
      if (Math.abs(r.wet - wetK) > 0.002) {
        wetK = r.wet;
        mats.metalFade.color.copy(metalBase).multiplyScalar(1 - 0.18 * r.wet);
        if (genRoof) genRoof.material.color.copy(metalBase).multiplyScalar(1 - 0.18 * r.wet);
      }
      // the power cut: the yard lamps and the office windows go dark (back on with the power, EV.POWER)
      powerK = powerOff(farm, env) ? 0 : 1;
      lamps.update(sky.state.night, powerK);
      const glow = Math.max(0, Math.min(1, (sky.state.night - 0.15) / 0.5)) * powerK;
      mats.glass.emissive.setRGB(0.95 * glow, 0.56 * glow, 0.2 * glow);
      if (view && view.camera && view.playerPos) {
        occlusion.uCam.value.copy(view.camera.position);
        occlusion.uPlayer.value.set(view.playerPos.x, 1.0, view.playerPos.z);
      }
    },
  };
}
