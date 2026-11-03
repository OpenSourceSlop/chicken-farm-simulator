// Instanced flock: growth, behaviour and animation of FLOCK_COUNT birds. Owner: flock agent.
//
// createFlock(ctx, { house }) -> { count, object3d, update(dt, env, farmerPos), metrics() }
//
// Pieces:
//   flock-geometry.js  one low-poly bird holding both the chick and the broiler shape
//   flock-shader.js    Lambert + shadow-depth materials that morph and pose each body part
//   flock-state.js     typed arrays per bird, feeder pans / nipples, initial placement
//   flock-field.js     cached env.comfort() lattice, spatial hash, density grid
//   flock-think.js     thermal state (hysteresis), activity and target choice (~2x per second)
//   flock-steer.js     seek, separation, cold cohesion, farmer clearing, integration
//   flock-pose.js      per-bird animation -> instance matrices + pose attributes
//   flock-render.js    near/far InstancedMeshes, per-bird frustum culling and LOD packing
//   flock-metrics.js   metrics()
// Two draw calls (+ two shadow draws) for the whole flock.
import * as THREE from 'three';
import { COLORS, FLOCK_COUNT, HEATERS, HOUSE_BOUNDS, weightAt } from './config.js';
import { PART } from './flock-geometry.js';
import { createFlockRender } from './flock-render.js';
import { createBirdMaterials, createBirdUniforms, setMorphUniforms } from './flock-shader.js';
import { createState, placeFlock, usableBounds } from './flock-state.js';
import { createBirdGrid, createComfortField } from './flock-field.js';
import { thinkBird } from './flock-think.js';
import { personalSpace, steerAll } from './flock-steer.js';
import { poseAll } from './flock-pose.js';
import { computeMetrics } from './flock-metrics.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createFlock(ctx, { house } = {}) {
  const { scene } = ctx;
  const n = FLOCK_COUNT;
  const S = createState(n);
  const field = createComfortField();
  const grid = createBirdGrid(n);
  const uniforms = createBirdUniforms();
  const { material, depth } = createBirdMaterials(uniforms);

  const render = createFlockRender(scene, ctx.camera, n, material, depth);

  // Palette (linear colours for the shader)
  const C = (hex) => new THREE.Color(hex);
  // COLORS.chick with a little more saturation: tone mapping and flat light wash small yellow
  // birds out to cream against the rice-husk litter
  const hsl = { h: 0, s: 0, l: 0 };
  const chick = C(COLORS.chick), white = C(COLORS.broiler);
  chick.getHSL(hsl);
  chick.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), hsl.l * 0.96);
  const chickHead = chick.clone().lerp(white, 0.08);
  const chickWing = chick.clone().multiplyScalar(0.93);
  const beakChick = C(0xf3c27a), beakAdult = C(COLORS.beak);
  const legChick = C(0xf0b27a), legAdult = C(0xf0bf4a);
  const combYoung = C(0xeba08f), combAdult = C(COLORS.comb);
  const eye = C(0x17120e);
  const col = uniforms.uCol.value;

  // Flock-wide values that depend on age: size, shape, feathers, comb, spacing and speed
  function applyDay(env, force) {
    const day = env.day, curtain = !!env.broodCurtain;
    if (!force && Math.abs(day - S.day) < 0.02 && curtain === S.curtain) return;
    const prevDay = S.day, prevCurtain = S.curtain;
    const reset = force || (curtain && !prevCurtain) || day < prevDay - 1 || day > prevDay + 3.5;
    S.day = day; S.curtain = curtain; S.bounds = usableBounds(curtain);

    S.L = 0.6 * Math.cbrt(weightAt(day) / 2850);  // ~0.17 m on day 1, 0.6 m at day 42
    const growth = Math.min(1, Math.max(0, (S.L - 0.15) / 0.45));
    S.baseSpeed = 0.25 + 0.1 * growth;
    S.morph = Math.min(1, Math.max(0, (day - 1) / 26));
    setMorphUniforms(uniforms, S.morph);
    uniforms.uComb.value = Math.pow(Math.min(1, Math.max(0, (day - 11) / 25)), 0.8);

    // feathers come in white from the wings first, the body by about day 21
    const wW = smooth(4, 12, day), bW = smooth(8, 21, day), hW = smooth(10, 23, day), tW = smooth(5, 13, day);
    col[PART.body].copy(chick).lerp(white, bW);
    col[PART.head].copy(chickHead).lerp(white, hW);
    col[PART.wingL].copy(chickWing).lerp(white, wW);
    col[PART.wingR].copy(col[PART.wingL]);
    col[PART.tail].copy(chick).lerp(white, tW);
    col[PART.beakUp].copy(beakChick).lerp(beakAdult, smooth(2, 20, day));
    col[PART.beakLow].copy(col[PART.beakUp]).multiplyScalar(0.92);
    col[PART.legL].copy(legChick).lerp(legAdult, smooth(3, 21, day));
    col[PART.legR].copy(col[PART.legL]);
    col[PART.eye].copy(eye);
    col[PART.comb].copy(combYoung).lerp(combAdult, smooth(14, 30, day));
    col[PART.wattle].copy(col[PART.comb]);

    // personal space from the free floor per bird (even hexagonal spacing), never below body size
    const b = S.bounds;
    const area = (b.xMax - b.xMin) * (b.zMax - b.zMin);
    const even = Math.sqrt((2 * area) / (Math.sqrt(3) * n));
    S.perM2 = n / area;
    S.rRight = Math.max(0.82 * even, 0.95 * S.L);
    // hot birds keep apart (at least 1.3 body lengths) yet still crowd the cooler wall bands
    S.rHot = Math.min(even, Math.max(0.72 * even, 1.3 * S.L));
    S.rHuddle = 0.62 * S.L;
    S.huddleR = 0.4 + 5 * S.L; // a cold bird blocked this close to its warm spot settles there
    // radius of one brooder's share of the flock packed at huddle spacing: targets scatter over it
    S.huddleSpread = 0.9 * Math.sqrt(((n / HEATERS.length) * 0.866 * S.rHuddle * S.rHuddle) / Math.PI);
    S.maxR = 1.15 * Math.max(S.rHot, S.rRight);

    if (reset) {
      placeFlock(S);
      grid.build(S.px, S.pz, n, S.maxR, S.perM2, S.bounds.zMax - S.bounds.zMin);
    }
  }

  const fctx = { farmerOn: false, wasOn: false, fx: 0, fz: 0, vx: 0, vz: 0, farmerR: 1.6, field, grid, anyTemp: false };
  let built = false;

  function update(dt, env, farmerPos) {
    dt = dt > 0 ? Math.min(dt, 0.05) : 0;
    env = env || ctx.env;
    applyDay(env, false);
    S.lightsOn = env.lightsOn !== false;
    if (field.refresh(env, dt) === 2) {
      // the climate jumped (heaters, setpoint, fans, test tools): everyone reconsiders soon
      for (let i = 0; i < n; i++) { S.thinkT[i] = Math.min(S.thinkT[i], S.rand() * 0.4); S.actT[i] = Math.min(S.actT[i], S.rand() * 1.2); }
    }
    if (dt > 0) {
      S.time += dt;
      const hb = HOUSE_BOUNDS;
      fctx.farmerOn = !api.debugIgnoreFarmer && !!farmerPos && farmerPos.x > hb.xMin - 0.3 && farmerPos.x < hb.xMax + 0.3 &&
        farmerPos.z > hb.zMin - 0.3 && farmerPos.z < hb.zMax + 0.3;
      if (fctx.farmerOn) {
        // his walking velocity (smoothed; a jump of over 1 m is a teleport, not a walk)
        const jx = farmerPos.x - fctx.fx, jz = farmerPos.z - fctx.fz;
        const k = Math.min(1, dt * 6), tele = !fctx.wasOn || jx * jx + jz * jz > 1;
        fctx.vx = tele ? 0 : fctx.vx + (jx / dt - fctx.vx) * k;
        fctx.vz = tele ? 0 : fctx.vz + (jz / dt - fctx.vz) * k;
        fctx.fx = farmerPos.x; fctx.fz = farmerPos.z;
      } else { fctx.vx = fctx.vz = 0; }
      fctx.wasOn = fctx.farmerOn;
      fctx.farmerR = 1.6 + 1.0 * Math.max(0, S.L - 0.15); // about 1.6 m for chicks, 2 m for broilers
      const t0 = prof.on ? performance.now() : 0;
      grid.build(S.px, S.pz, n, personalSpace(S), S.perM2, S.bounds.zMax - S.bounds.zMin);
      built = true;
      const t1 = prof.on ? performance.now() : 0;
      const { thinkT, actT, scare, stuck } = S;
      for (let i = 0; i < n; i++) {
        actT[i] -= dt;
        if (scare[i] > 0) scare[i] -= dt;
        thinkT[i] -= dt;
        if (thinkT[i] <= 0) {
          thinkT[i] = 0.35 + S.rand() * 0.35;
          thinkBird(S, i, field, env, fctx, grid);
        }
        if (S.arrived[i]) stuck[i] = 0;
      }
      const t2 = prof.on ? performance.now() : 0;
      steerAll(S, grid, dt, fctx);
      if (prof.on) { const t3 = performance.now(); prof.grid += t1 - t0; prof.think += t2 - t1; prof.steer += t3 - t2; }
    }
    const t4 = prof.on ? performance.now() : 0;
    poseAll(S, dt, render.stage);
    if (prof.on) prof.pose += performance.now() - t4;
    render.markDirty();
  }
  // optional phase timing for the test tools: flock.profile.on = true, read the ms totals
  const prof = { on: false, grid: 0, think: 0, steer: 0, pose: 0 };

  // initial flock at the current climate
  applyDay(ctx.env, true);
  field.refresh(ctx.env, 0);
  poseAll(S, 0, render.stage);

  const api = {
    count: n,
    object3d: render.group,
    meshes: render.meshes,
    renderStats: render.stats,
    setCulling: render.setCulling,
    update,
    metrics() {
      if (!built) { grid.build(S.px, S.pz, n, S.maxR, S.perM2, S.bounds.zMax - S.bounds.zMin); built = true; }
      return { ...computeMetrics(S, grid) };
    },
    // test tools only: true = birds ignore the farmer (to film them up close)
    debugIgnoreFarmer: false,
    _state: S, // internal, for debugging only
    profile: prof,
    // debugging aid for the test tools: activity and thermal-state counts
    debugCounts() {
      const acts = new Array(7).fill(0), th = { cold: 0, right: 0, hot: 0 };
      for (let i = 0; i < n; i++) { acts[S.act[i]]++; th[S.therm[i] < 0 ? 'cold' : S.therm[i] > 0 ? 'hot' : 'right']++; }
      return { idle: acts[0], wander: acts[1], eat: acts[2], drink: acts[3], rest: acts[4], huddle: acts[5], pant: acts[6], ...th };
    },
  };
  return api;
}
