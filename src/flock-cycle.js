// The growing flock over the whole cycle (PHASE3.md §12 items 13-17, 20). Owner: flock (package "scene").
//
// Nothing here runs in the sandbox or in the brooding week: cycleOn(S, env) is true only in a level from
// calendar day 8 (the lone Phase 2 week ends on day 7, so it plays and looks exactly as before).
//   zones(farm, out)       farm.comfort.eZ[8] (the mean comfort e of each 6 m strip, NaN where no birds)
//                          for the comfort field: each strip's birds feel what the farm says they feel
//   heatBand(S, farm, env) the panting band of growing birds: the farm's hotFrom ± 0.5 °C (farm-heat.js
//                          HEAT_MODEL; farm.comfort.hotFrom when the farm gives it) instead of Phase 1's
//                          fixed 1.5-4.5 °C, so the drawn panting share follows farm.comfort.pantShare
//   updateLame / thinkLame lame birds 1:1 with farm.flock.lameOnFloor (up to 24): they sit by the
//                          drinker lines and get up for short one-legged walks (S.sick = LAME)
//   water(lv, farm, env)   the vaccination: the main valve shut = dry lines (the birds crowd them);
//                          the lines open again = the flock rushes to drink
//   breathing(farm)        snick / rattle from the dust index and ammonia (flock.sounds)
import { DRINKER_LINES_Z, NIPPLE_X, PHASE4 } from './config.js';
import { hotFrom } from './farm-heat.js';
import { ACT } from './flock-state.js';
import { farmerPenalty, setTarget, startActivity, wetAt } from './flock-think.js';

export const LAME = 3;          // S.sick value of a lame bird (Phase 2: 1 sick, 2 sick and lame)
export const MAX_LAME = 24;

const fin = (v) => typeof v === 'number' && Number.isFinite(v);

/** The cycle look and behaviour: level mode from calendar day 8. */
export function cycleOn(S, env) { return !!S.levelMode && (env?.dayNumber ?? 0) >= 8; }

/** farm.comfort.eZ copied into out (Float64Array(8)); false when the farm has none. */
export function zones(farm, out) {
  const eZ = farm?.comfort?.eZ;
  if (!eZ || eZ.length < out.length) return false;
  let any = false;
  for (let k = 0; k < out.length; k++) { out[k] = eZ[k]; if (fin(eZ[k])) any = true; }
  return any;
}

/** Hot thresholds: S.hotK / S.hotB map each bird's own Phase 1 tolerance (1.5..4.5 °C) onto the band. */
export function heatBand(S, farm, env, on) {
  if (!on) { S.hotK = 1; S.hotB = 0; S.heatRef = 1.5; S.hotView = 1.5; return; } // chicks: the first pant at +1.5 °C
  const age = Math.max(0, farm?.age ?? (env.day - 1 / 3));
  const hf = fin(farm?.comfort?.hotFrom) ? farm.comfort.hotFrom : hotFrom(age);
  // Phase 4 (PHASE4.md §2.3 pantShareP4, §12.4): the tuned model's panting ramp, from the first birds (pantFrom) to
  // all of them (pantAll); each bird's own tolerance spreads over it, and the comfort view's orange sits where the
  // first birds pant. Until the farm exports pantFrom, Phase 3's ramp below (hotFrom - 1.5 once the tuned model is
  // live: config.PHASE4.tunedSigns, the switch the integrator sets with it).
  const c = farm?.comfort;
  if (fin(c?.pantFrom)) {
    const from = c.pantFrom, all = fin(c.pantAll) && c.pantAll > from ? c.pantAll : from + 4;
    S.hotK = (all - from) / 3; S.hotB = from - 1.5 * S.hotK; S.heatRef = from; S.hotView = Math.max(0.5, from);
    return;
  }
  // hotTh 1.5 -> hf - 0.5, 4.5 -> hf + 0.5 (the farm's panting ramp, PHASE3.md §6.3)
  S.hotK = 1 / 6; S.hotB = hf - 0.75; S.heatRef = hf - 0.5; S.hotView = TUNED() ? Math.max(0.5, hf - 1.5) : hf;
}
const TUNED = () => !!PHASE4.tunedSigns;

/** Lame birds on the floor (and in the hand) follow farm.flock.lameOnFloor, 1:1, at most 24. */
export function updateLame(S, farm, heldLame) {
  const want = Math.max(0, Math.min(MAX_LAME, Math.round(fin(farm?.flock?.lameOnFloor) ? farm.flock.lameOnFloor : 0)));
  let have = heldLame;
  for (let i = 0; i < S.n; i++) if (S.sick[i] === LAME) have++;
  if (have < want && S.n > 0) {
    // the fast growers go lame: pick from the heavier half of the flock
    for (let tries = 0; have < want && tries < 80; tries++) {
      const i = (S.rand() * S.n) | 0;
      if (S.sick[i] || S.pen[i] || S.spawnT[i] > 0 || (S.u[i] < 0.5 && tries < 50)) continue;
      S.sick[i] = LAME;
      S.thinkT[i] = 0; S.actT[i] = 0;
      have++;
    }
  } else if (have > want) {
    for (let i = 0; i < S.n && have > want; i++) {
      if (S.sick[i] !== LAME) continue;
      S.sick[i] = 0; S.actT[i] = 0; S.thinkT[i] = S.rand();
      have--;
    }
  }
  return want;
}

// A sitting place beside a drinker line, near where the bird is: lame birds stay close to water.
function lineSpot(S, i, ctx) {
  const r = S.rand, b = S.bounds, x = S.px[i], z = S.pz[i];
  let best = 0, bd = 1e9;
  for (let k = 0; k < DRINKER_LINES_Z.length; k++) { const d = Math.abs(DRINKER_LINES_Z[k] - z); if (d < bd) { bd = d; best = k; } }
  let bx = x, bz = z, bs = 1e9;
  for (let t = 0; t < 5; t++) {
    const cx = Math.max(b.xMin + 0.3, Math.min(b.xMax - 0.3, x + (r() - 0.5) * 2.4));
    const cz = Math.max(b.zMin + 0.1, Math.min(b.zMax - 0.1, DRINKER_LINES_Z[best] + (r() < 0.5 ? -1 : 1) * (0.25 + 0.3 * r())));
    const s = farmerPenalty(ctx, cx, cz) + (wetAt(S, cx, cz) ? 4 : 0) + 0.3 * Math.abs(cx - x) + r();
    if (s < bs) { bs = s; bx = cx; bz = cz; }
  }
  setTarget(S, i, bx, bz);
}

/** One decision for a lame bird: mostly sitting by a line; now and then a short limp to a nipple. */
export function thinkLame(S, i, ctx) {
  const a = S.act[i];
  if (a === ACT.DRINK && !S.arrived[i] && S.stuck[i] < 3) return; // limping over to the nipple
  if (S.actT[i] > 0 && (a === ACT.REST || a === ACT.DRINK || a === ACT.WANDER)) return;
  if (a === ACT.REST && S.rand() < 0.3) {
    // up on one leg for a few steps along the line (this is when the farmer sees it limp)
    startActivity(S, i, ACT.WANDER, 5 + S.rand() * 4);
    const x = S.px[i], b = S.bounds;
    const nx = Math.max(b.xMin + 0.3, Math.min(b.xMax - 0.3, x + (S.rand() < 0.5 ? -1 : 1) * (0.8 + 1.4 * S.rand())));
    let j = Math.round((nx - NIPPLE_X[0]) / (NIPPLE_X[1] - NIPPLE_X[0]));
    j = Math.max(0, Math.min(NIPPLE_X.length - 1, j));
    setTarget(S, i, NIPPLE_X[j], S.pz[i]);
    return;
  }
  startActivity(S, i, ACT.REST, 25 + S.rand() * 45);
  lineSpot(S, i, ctx);
}

/**
 * The vaccination in the drinking water (farm.health.vaccine, farm.health.mainClosed): while the main
 * valve is shut the lines are dry (lv.thirst: the birds walk to the lines and peck at dry nipples);
 * when it opens with the vaccine in the tank they rush to drink (lv.rush 1 -> 0 over about 40 s of play).
 * Returns 'opened' on the frame the lines open, else null.
 */
export function water(lv, farm, env, dt) {
  const v = farm?.health?.vaccine, st = v?.state;
  const closed = !!farm?.health?.mainClosed || st === 'thirst' || st === 'mixed';
  const was = lv.thirst;
  lv.thirst = closed;
  if (closed) for (let k = 0; k < lv.acc.length; k++) { lv.acc[k] = 0; lv.waterPull[k] = 0.01; }
  if (closed) lv.meanAcc = 0;
  if (was && !closed) { lv.rush = 1; return 'opened'; }
  lv.rush = Math.max(0, (lv.rush || 0) - dt / 40);
  return null;
}

/** Breathing sounds 0..1 from the dust index and the ammonia (PHASE3.md §6.13: rattle over Dx 1.5 or 25 ppm). */
export function breathing(farm) {
  const air = farm?.air || {};
  const dust = fin(air.dustIndex) ? air.dustIndex : 0;
  const nh3 = fin(air.ammoniaPpm) ? air.ammoniaPpm : fin(farm?.litter?.ammoniaPpm) ? farm.litter.ammoniaPpm : 0;
  const c = (v) => Math.max(0, Math.min(1, v));
  return { snick: c(Math.max((nh3 - 15) / 15, (dust - 1) / 0.5)), rattle: c(Math.max((nh3 - 25) / 10, (dust - 1.5) / 0.5)) };
}
