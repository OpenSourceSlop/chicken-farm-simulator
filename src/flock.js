// Instanced flock: growth, behaviour and animation of FLOCK_COUNT birds. Owner: flock agent.
//
// createFlock(ctx, { house }) -> { count, object3d, update(dt, env, farmerPos), metrics() }
//   extras for the test tools: meshes, renderStats {near, far, culled}, setCulling(bool),
//   debugIgnoreFarmer (bool), debugCounts(), profile {on, grid, think, steer, pose, level}, _state.
//   Phase 2 (Level 1) API: placeBatch, catchNearest, catchGroup, releaseBird, releaseGroup, dead,
//   sounds, resetLevel, serialize / restore, debug (see the api object and flock-level.js).
//
// Behaviour in one paragraph: every ~0.5 s each bird samples the felt comfort (see
// flock-field.js) here and 2 m around and keeps a thermal state with hysteresis. Cold birds
// (< -1.5 °C) go to the warmest floor (under the brooders) and sit packed; comfortable birds
// eat at pans, drink at nipples, stroll toward emptier comfortable floor and rest; hot birds
// (> +1.5 °C) move away from the brooders to the side walls (and toward the pad when fans run),
// sit or stand with wings out and pant. Everyone steps away from the farmer. Birds stay in
// BROOD_BOUNDS while env.broodCurtain, then spread over BIRD_BOUNDS. A day jump (> 3.5 days
// forward, > 1 day back, or the curtain closing) re-places the flock as a fresh flock of that age.
// ctx.camera is used to cull birds and pick near/far models just before each render.
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
//   flock-level.js     Level 1: reads ctx.farm, wires the parts below, providers, events, sounds
//   flock-pop.js       which birds are on the floor (counts, placement spill, weight sizes)
//   flock-dead.js      dead birds 1:1 where they died, pick-up into the bucket
//   flock-catch.js     catching a bird for a sample, the catching frame, putting birds back
//   flock-sick.js      sick and lame birds, and how access to water, feed, dry litter steers the flock
// Two draw calls (+ two shadow draws) for the whole flock.
import * as THREE from 'three';
import { COLORS, FLOCK_COUNT, HEATERS, HOUSE, HOUSE_BOUNDS, weightAt } from './config.js';
import { PART } from './flock-geometry.js';
import { createFlockRender } from './flock-render.js';
import { createBirdMaterials, createBirdUniforms, setMorphUniforms } from './flock-shader.js';
import { ACT, createState, makeHuddleSites, placeFlock, releaseRes, usableBounds } from './flock-state.js';
import { createBirdGrid, createComfortField } from './flock-field.js';
import { thinkBird } from './flock-think.js';
import { personalSpace, steerAll } from './flock-steer.js';
import { poseAll } from './flock-pose.js';
import { computeMetrics } from './flock-metrics.js';
import { createPopulation } from './flock-pop.js';
import { createLevelFlock } from './flock-level.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createFlock(ctx, { house } = {}) {
  const { scene } = ctx;
  const n = FLOCK_COUNT;
  const S = createState(n);
  const field = createComfortField();
  const grid = createBirdGrid(n);
  const uniforms = createBirdUniforms();
  const { material, depth } = createBirdMaterials(uniforms);

  const pop = createPopulation(S);
  S.size0 = Float32Array.from(S.size); // Phase 1 sizes (the sandbox); a level sizes by weight quantile
  const render = createFlockRender(scene, ctx.camera, n, material, depth, () => S.n);

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
  // In a level the look follows the flock age (Phase 1 day 1 = age 0) and the size follows the
  // farm's mean weight; the sandbox keeps Phase 1's day and weight table.
  const lookDay = (env) => (S.levelMode ? Math.max(0, ctx.farm.age) + 1 : env.day);
  const lengthOf = (w) => 0.6 * Math.cbrt(w / 2850); // ~0.17 m on day 1, 0.6 m at day 42
  function applyDay(env, force) {
    const day = lookDay(env), curtain = !!env.broodCurtain;
    const meanW = S.levelMode && ctx.farm.flock.meanWeightG > 0 ? ctx.farm.flock.meanWeightG : weightAt(day);
    const grown = S.levelMode && Math.abs(lengthOf(meanW) - S.L) > 0.004 * S.L;
    if (!force && Math.abs(day - S.day) < 0.02 && curtain === S.curtain && !grown) return;
    const prevDay = S.day, prevCurtain = S.curtain;
    // The curtain lifting during a time jump (Next morning, Skip, the test tools) re-places the flock
    // over the whole house at once; lifting while the clock runs starts a spreading phase instead.
    const lifted = !curtain && prevCurtain && S.day >= 0;
    const reset = force || (curtain && !prevCurtain) || day < prevDay - 1 || day > prevDay + 3.5 || (lifted && day > prevDay + 0.04);
    S.day = day; S.curtain = curtain; S.bounds = usableBounds(curtain);
    if (!S.sites || curtain !== prevCurtain || force) { S.sites = makeHuddleSites(S.bounds); S.site.fill(-1); }
    if (lifted && !reset) {
      // the curtain lifted with the clock running: the share of the flock that belongs on the new
      // floor walks out to an even spread over it (cold or hot birds still follow the climate)
      S.spreadT = 80;
      const b = S.bounds, x0 = HOUSE.broodCurtainX, share = (b.xMax - x0) / (b.xMax - b.xMin);
      for (let i = 0; i < n; i++) {
        if (S.therm[i] !== 0 || S.rand() > share) { S.actT[i] = Math.min(S.actT[i], S.rand() * 4); continue; }
        releaseRes(S, i);
        S.act[i] = ACT.WANDER; S.actT[i] = 70;
        S.tx[i] = x0 + 0.3 + S.rand() * (b.xMax - x0 - 0.3); S.tz[i] = b.zMin + S.rand() * (b.zMax - b.zMin);
        S.arrived[i] = 0; S.stuck[i] = 0;
      }
    }

    S.L = lengthOf(meanW);
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
    // radius of one huddle site's share of the flock (cold, no brooder running)
    S.siteR = 0.95 * Math.sqrt(((n / (S.sites.length / 2)) * 0.866 * S.rHuddle * S.rHuddle) / Math.PI);
    S.maxR = 1.15 * Math.max(S.rHot, S.rRight);

    if (reset) {
      placeFlock(S);
      grid.build(S.px, S.pz, S.n, S.maxR, S.perM2, S.bounds.zMax - S.bounds.zMin);
    }
  }

  const lvl = createLevelFlock(ctx, { S, pop, uniforms, grid, render, reset: () => applyDay(ctx.env, true) });
  /** After a time jump of 30 game minutes or more in a level the drawn flock has had that time to
   *  spread from where it was (the box tips, a huddle): the free birds are re-placed over the floor
   *  (as on a long jump), then think at the new climate. Penned and sick birds stay; held birds and
   *  dead birds are not in the drawn flock. */
  function afterSkip(hours) {
    if (!S.levelMode || !(hours >= 0.5)) return false;
    // chicks still to spill from a tip are out by now: drop the spill queue, the count comes back
    // spread over the floor
    pop.pending.length = 0;
    pop.reconcile(ctx.farm, 0, ctx.player?.position || null);
    if (S.n <= 0) return false;
    applyDay(ctx.env, false);
    placeFlock(S, (i) => !!(S.pen[i] || S.sick[i]));
    for (let i = 0; i < S.n; i++) S.lagT[i] = 0;
    grid.build(S.px, S.pz, S.n, S.maxR, S.perM2, S.bounds.zMax - S.bounds.zMin);
    built = true;
    field.refresh(ctx.env, 0);
    render.markDirty();
    return true;
  }
  const fctx = { farmerOn: false, wasOn: false, fx: 0, fz: 0, vx: 0, vz: 0, farmerR: 1.6, field, grid, anyTemp: false, padPull: 0 };
  let built = false;

  function update(dt, env, farmerPos) {
    dt = dt > 0 ? Math.min(dt, 0.05) : 0;
    env = env || ctx.env;
    const t00 = prof.on ? performance.now() : 0;
    // Level 1 (farm.mode 'level'): counts, placement, sick and dead birds, catching (flock-level.js)
    const lv = lvl.update(dt, env, farmerPos);
    if (prof.on) prof.level += performance.now() - t00;
    applyDay(env, false);
    S.lightsOn = env.lightsOn !== false;
    uniforms.uBrood.value = 0.55 * (env.heaterLevel || 0); // the brooder pools light the birds in them
    if (field.refresh(env, dt) === 2) {
      // the climate jumped (heaters, setpoint, fans, test tools): everyone reconsiders soon
      for (let i = 0; i < S.n; i++) { S.thinkT[i] = Math.min(S.thinkT[i], S.rand() * 0.4); S.actT[i] = Math.min(S.actT[i], S.rand() * 1.2); }
    }
    if (dt > 0) {
      S.time += dt;
      if (S.spreadT > 0) S.spreadT -= dt;
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
      // in a level the birds settle back round a farmer who stands still (he can reach down to them)
      if (lv) fctx.farmerR *= lvl.farmerCalm(fctx, dt);
      const t0 = prof.on ? performance.now() : 0;
      grid.build(S.px, S.pz, S.n, personalSpace(S), S.perM2, S.bounds.zMax - S.bounds.zMin);
      built = true;
      const t1 = prof.on ? performance.now() : 0;
      const { thinkT, actT, scare, stuck } = S;
      for (let i = 0, m = S.n; i < m; i++) {
        actT[i] -= dt;
        if (scare[i] > 0) scare[i] -= dt;
        thinkT[i] -= dt;
        if (thinkT[i] <= 0) {
          thinkT[i] = 0.35 + S.rand() * 0.35;
          // sick, penned and just-tipped birds follow their own rules in a level
          if (!lv || !lvl.think(i, field, env, fctx, grid)) thinkBird(S, i, field, env, fctx, grid);
        }
        if (S.arrived[i]) stuck[i] = 0;
      }
      const t2 = prof.on ? performance.now() : 0;
      steerAll(S, grid, dt, fctx);
      if (lv) lvl.afterSteer(dt, grid);
      if (prof.on) { const t3 = performance.now(); prof.grid += t1 - t0; prof.think += t2 - t1; prof.steer += t3 - t2; }
    }
    const t4 = prof.on ? performance.now() : 0;
    poseAll(S, dt, render.stage);
    if (lv) lvl.afterPose(dt);
    if (prof.on) prof.pose += performance.now() - t4;
    render.markDirty();
  }
  // optional phase timing for the test tools: flock.profile.on = true, read the ms totals
  const prof = { on: false, grid: 0, think: 0, steer: 0, pose: 0, level: 0 };

  // initial flock at the current climate
  applyDay(ctx.env, true);
  field.refresh(ctx.env, 0);
  poseAll(S, 0, render.stage);

  const api = {
    /** birds on the floor now (FLOCK_COUNT in the sandbox) */
    get count() { return S.n; },
    object3d: render.group,
    meshes: render.meshes,
    renderStats: render.stats,
    setCulling: render.setCulling,
    update,
    metrics() {
      if (!built) { grid.build(S.px, S.pz, S.n, S.maxR, S.perM2, S.bounds.zMax - S.bounds.zMin); built = true; }
      return { ...computeMetrics(S, grid) };
    },
    // ---- Phase 2 (package "flock", PHASE2.md §12.2 / §13): flock-level.js and its parts. ----
    // The flock reads ctx.farm itself in update(): farm.mode 'off' = Phase 1 behaviour. In 'level'
    // mode it draws round(farm.flock.alive / BIRDS_PER_INSTANCE) birds once placed (none before),
    // sizes them from farm.flock.weightQuantile(), shows farm.flock.sick sick birds (1:1, up to 24),
    // keeps the dead ones (EV.FARM_DEATH, 1:1) lying where they died until picked up, and follows
    // per-line water and feed access, wet litter, light and the brooders. Providers on ctx.interact:
    // 'chick' (ctx.level.sampling set, hands empty, priority 5), 'sick-bird' (nearest sick bird
    // within 1.2 m, hands empty, 5), 'dead-bird' (hands empty or the bucket, within 1.5 m, 6).
    /** Chicks from a tipped stack: count real chicks spill out at (x, z) and spread. */
    placeBatch(x, z, chicks) { lvl.placeBatch(x, z, chicks); },
    /** Catch the nearest live bird within maxDist of (x, z) for a sample: { index, x, z } | null.
     *  Calls ctx.props.startCarry('chick', { index }) and emits EV.BIRD_PICK. */
    catchNearest(x, z, maxDist = 1.2, purpose) { return lvl.catcher.catchNearest(x, z, maxDist, purpose); },
    /** Up to n birds caught around (x, z) with a catching frame (weighing): [{ index, x, z }]. */
    catchGroup(x, z, n) { return lvl.catcher.catchGroup(x, z, n); },
    /** Put a caught bird back (it walks off); culled = it was culled (hidden for good). Calls
     *  ctx.props.drop() and emits EV.BIRD_RELEASE { index, culled }. */
    releaseBird(index, culled = false) { return lvl.catcher.releaseBird(index, culled); },
    /** Let the birds held by the catching frame go (weigh panel closed). */
    releaseGroup() { lvl.catcher.releaseGroup(); },
    /** Dead birds on the floor, one drawn dead bird = one real bird (mirrors farm.flock.deadOnFloor,
     *  which the farm owns): { count, near(x, z, r) -> [{ id, x, z, cause }], pickUp(x, z, r) -> { n, causes } }. */
    dead: lvl.dead.api,
    /** Save blob part: dead birds' positions and causes (PHASE2.md §11). Live birds come back from
     *  the farm's counts and sizes. */
    serialize() { return lvl.serialize(); },
    restore(d) { lvl.restore(d); },
    /** What the farmer hears standing in the house (0..1 each): distress peeping, contented chirping, snicking. */
    sounds() { return lvl.sounds(); },
    /** Wipe the level's birds (prep day: empty house). */
    resetLevel() { lvl.resetLevel(); },
    /** level.skip: the clock jumped `hours` forward (>= 0.5 re-places the free birds). */
    afterSkip,
    /** Test hooks: counts and spreads for the p2-flock steps files (never shown to the player). */
    debug: lvl.debug,
    // test tools only: true = birds ignore the farmer (to film them up close)
    debugIgnoreFarmer: false,
    _state: S, // internal, for debugging only
    profile: prof,
    // debugging aid for the test tools: activity and thermal-state counts
    debugCounts() {
      const acts = new Array(7).fill(0), th = { cold: 0, right: 0, hot: 0 };
      for (let i = 0; i < S.n; i++) { acts[S.act[i]]++; th[S.therm[i] < 0 ? 'cold' : S.therm[i] > 0 ? 'hot' : 'right']++; }
      return { idle: acts[0], wander: acts[1], eat: acts[2], drink: acts[3], rest: acts[4], huddle: acts[5], pant: acts[6], ...th };
    },
  };
  return api;
}
