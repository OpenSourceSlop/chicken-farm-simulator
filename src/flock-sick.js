// Sick and lame birds, and what the farm's equipment does to the flock's choices. Owner: flock.
//
// refreshAccess(S, farm, env): S.lv, the level's view of the farm that flock-think.js reads
//   (null in the sandbox, so Phase 1 behaviour is untouched): water access per drinker line,
//   pan fill per feeder line, lux, wet litter (> 40 %), brooders out.
// updateSick(S, farm): farm.flock.sick real birds are drawn 1:1 (up to 24) as sick birds, chosen
//   among the small ones (the weak and late chicks). One in three of them is lame.
// thinkSick(S, i, ...): a sick bird sits apart, fluffed up with its eyes shut (flock-pose.js,
//   flock-shader.js), away from the feeders and the crowd; now and then it gets up and shuffles
//   (lame: limps) to a nipple, drinks a little and sits down again. It barely moves for the farmer,
//   so he can walk up and pick it up (the 'sick-bird' provider, flock-catch.js).
import { DRINKER_LINES_Z, FEEDER_LINES_Z, FLOOR_GRID, HEATERS } from './config.js';
import { ACT } from './flock-state.js';
import { drinkerSpot, farmerPenalty, setTarget, startActivity, wetAt } from './flock-think.js';

export const MAX_SICK = 24;

export function createAccess() {
  return {
    acc: new Float32Array(DRINKER_LINES_Z.length).fill(1),
    waterPull: new Float32Array(DRINKER_LINES_Z.length).fill(1),
    fill: new Float32Array(FEEDER_LINES_Z.length).fill(1),
    feedPull: new Float32Array(FEEDER_LINES_Z.length).fill(1),
    meanAcc: 1, minLine: 0, meanFill: 1, lowLux: false, lux: 40,
    moist: null, x0: FLOOR_GRID.x0, z0: FLOOR_GRID.z0, nx: FLOOR_GRID.nx, nz: FLOOR_GRID.nz,
    out: [],
  };
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function refreshAccess(lv, farm, env) {
  const lines = farm.water?.lines || [];
  let sum = 0, min = 2;
  for (let k = 0; k < lv.acc.length; k++) {
    const a = Math.max(0, Math.min(1, num(lines[k]?.access, 1)));
    lv.acc[k] = a;
    lv.waterPull[k] = Math.max(0.01, a * a * a);
    sum += a;
    if (a < min) { min = a; lv.minLine = k; }
  }
  lv.meanAcc = sum / lv.acc.length;
  const fl = farm.feed?.lines || [];
  let fs = 0;
  for (let k = 0; k < lv.fill.length; k++) {
    const f = Math.max(0, Math.min(1, num(fl[k]?.panFill, 1)));
    lv.fill[k] = f;
    lv.feedPull[k] = (0.15 + f) * (0.15 + f);
    fs += f;
  }
  lv.meanFill = fs / lv.fill.length;
  // lux at the birds: the farm's reading if it has one, else the program's dimmer
  lv.lux = typeof farm.luxAt === 'function' ? num(farm.luxAt(-10, 0), 40) : 60 * num(env.lightLevel, 1);
  lv.lowLux = env.lightsOn !== false && lv.lux < 20;
  const g = farm.litter?.moistureGrid;
  lv.moist = g && g.length === lv.nx * lv.nz ? g : null;
  const out = env.brooderOut;
  lv.out = Array.isArray(out) ? out.filter((k) => k >= 0 && k < HEATERS.length) : [];
}

/** Sick birds on the floor (and in the hand) match farm.flock.sick, 1:1, at most 24. */
export function updateSick(S, farm, heldSick) {
  const want = Math.max(0, Math.min(MAX_SICK, Math.round(num(farm.flock?.sick, 0))));
  let have = heldSick;
  // (Phase 3 lame birds, sick 3, are flock-cycle.js's: not counted or cleared here)
  for (let i = 0; i < S.n; i++) if (S.sick[i] && S.sick[i] !== 3) have++;
  if (have < want && S.n > 0) {
    // weak birds are small birds: pick from the lightest third of the flock
    for (let tries = 0; have < want && tries < 60; tries++) {
      const i = (S.rand() * S.n) | 0;
      if (S.sick[i] || S.pen[i] || S.spawnT[i] > 0 || (S.u[i] > 0.33 && tries < 40)) continue;
      S.sick[i] = S.rand() < 0.34 ? 2 : 1;
      S.thinkT[i] = 0; S.actT[i] = 0;
      have++;
    }
  } else if (have > want) {
    for (let i = 0; i < S.n && have > want; i++) {
      if (!S.sick[i] || S.sick[i] === 3) continue;
      S.sick[i] = 0; S.actT[i] = 0; S.thinkT[i] = S.rand();
      have--;
    }
  }
  return want;
}

// A quiet spot: few birds, off the feeder lines, dry litter, out of the farmer's way; the side
// walls and the gaps between the lines are typical.
function quietSpot(S, i, ctx, grid) {
  const r = S.rand, b = S.bounds, x = S.px[i], z = S.pz[i];
  let bx = x, bz = z, bs = 1e9;
  for (let k = 0; k < 7; k++) {
    let cx = x, cz = z;
    if (k > 0) { const a = r() * 6.283, d = 0.8 + r() * 3.2; cx = x + Math.cos(a) * d; cz = z + Math.sin(a) * d; }
    cx = cx < b.xMin + 0.2 ? b.xMin + 0.2 : cx > b.xMax - 0.2 ? b.xMax - 0.2 : cx;
    cz = cz < b.zMin + 0.1 ? b.zMin + 0.1 : cz > b.zMax - 0.1 ? b.zMax - 0.1 : cz;
    let feed = 9;
    for (const fz of FEEDER_LINES_Z) feed = Math.min(feed, Math.abs(cz - fz));
    let s = 2.5 * grid.crowd(cx, cz) + (feed < 0.7 ? 2 : 0) + farmerPenalty(ctx, cx, cz) + (wetAt(S, cx, cz) ? 6 : 0);
    s += 0.15 * Math.min(Math.abs(cz - b.zMin), Math.abs(b.zMax - cz)); // the walls are quieter
    if (k === 0) s -= 0.6; // staying put is easiest
    if (s < bs) { bs = s; bx = cx; bz = cz; }
  }
  setTarget(S, i, bx, bz);
}

/** One decision for a sick bird. */
export function thinkSick(S, i, ctx, grid) {
  const a = S.act[i];
  if (a === ACT.DRINK && !S.arrived[i] && S.stuck[i] < 3) return; // shuffling to the nipple
  if (S.actT[i] > 0 && (a === ACT.REST || a === ACT.DRINK)) return;
  if (a === ACT.REST && S.rand() < 0.22) {
    // up for a sip now and then (this is when a lame bird is seen limping)
    startActivity(S, i, ACT.DRINK, 4 + S.rand() * 4);
    if (drinkerSpot(S, i, ctx)) return;
  }
  startActivity(S, i, ACT.REST, 18 + S.rand() * 40);
  quietSpot(S, i, ctx, grid);
}
