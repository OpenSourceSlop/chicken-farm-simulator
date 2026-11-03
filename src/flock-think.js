// Bird decisions: thermal state, activity and target. Owner: flock agent.
// Called for each bird every ~0.5 s (staggered), so the cost stays small and flat.
import { DRINKER_LINES_Z, FEEDER_LINES_Z, FEEDER_PAN_SPACING, HEATERS, LINE_X, NIPPLE_SPACING } from './config.js';
import { ACT, COLD, HOT, PAN_RADIUS, RIGHT, releaseRes } from './flock-state.js';

// Hysteresis (°C from target): enter cold below -1.5, leave above -1.0; enter hot above +1.5,
// leave below +1.1 (the floor near a running brooder is rarely below +1, so a wider band traps birds).
const ENTER = 1.5, LEAVE_COLD = 1.0, LEAVE_HOT = 1.1;

function clampX(S, x) { const b = S.bounds; return x < b.xMin ? b.xMin : x > b.xMax ? b.xMax : x; }
function clampZ(S, z) { const b = S.bounds; return z < b.zMin ? b.zMin : z > b.zMax ? b.zMax : z; }

function nearestHeater(x, z) {
  let best = 0, bd = 1e9;
  for (let k = 0; k < HEATERS.length; k++) {
    const dx = x - HEATERS[k].x, dz = z - HEATERS[k].z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// Comfort here (c0) and on the floor 2 m around (amb). Cold is judged on a blend of both, so a
// bird in a small warm island inside a cold house still reads (and behaves) as cold: it huddles.
// Hot is judged mostly on the spot itself.
function sampleThermal(S, i, field) {
  const x = S.px[i], z = S.pz[i];
  const c0 = field.sample(x, z);
  const amb = (field.sample(clampX(S, x + 2), z) + field.sample(clampX(S, x - 2), z) +
    field.sample(x, clampZ(S, z + 2)) + field.sample(x, clampZ(S, z - 2))) * 0.25;
  S.tIdx[i] += (c0 - S.tIdx[i]) * 0.6;
  S.tAmb[i] += (amb - S.tAmb[i]) * 0.6;
}

function farmerPenalty(ctx, x, z) {
  if (!ctx.farmerOn) return 0;
  const dx = x - ctx.fx, dz = z - ctx.fz, r = ctx.farmerR + 0.6;
  return dx * dx + dz * dz < r * r ? 50 : 0;
}

function setTarget(S, i, x, z) {
  S.tx[i] = clampX(S, x); S.tz[i] = clampZ(S, z);
  S.arrived[i] = 0; S.stuck[i] = 0;
}

// Scratch "best candidate" shared by the spot finders (no closures, no allocation per call)
let bx = 0, bz = 0, bs = 0;

function tryWarm(S, field, ctx, cx, cz) {
  cx = clampX(S, cx); cz = clampZ(S, cz);
  const s = -Math.abs(field.sample(cx, cz)) - farmerPenalty(ctx, cx, cz);
  if (s > bs) { bs = s; bx = cx; bz = cz; }
}

// Cold: the warmest reachable floor (where |comfort| is smallest), usually right under a brooder.
function warmSpot(S, i, field, env, ctx) {
  const { rand } = S;
  const x = S.px[i], z = S.pz[i];
  bx = x; bz = z; bs = -Math.abs(field.sample(x, z)) + 0.3; // small bias to stay put
  if (env.heaterLevel > 0.05) {
    const h = HEATERS[nearestHeater(x, z)];
    if (h.x <= S.bounds.xMax) {
      tryWarm(S, field, ctx, h.x, h.z);
      const a = rand() * 6.283, r = 0.6 + rand() * 1.6;
      tryWarm(S, field, ctx, h.x + Math.cos(a) * r, h.z + Math.sin(a) * r);
    }
  }
  for (let k = 0; k < 3; k++) {
    const a = rand() * 6.283, r = 0.5 + rand() * 2.5;
    tryWarm(S, field, ctx, x + Math.cos(a) * r, z + Math.sin(a) * r);
  }
  if (bx === x && bz === z && S.act[i] === ACT.HUDDLE) return; // nothing better: stay put
  // aim at a point scattered around the best spot so the huddle is a blob, not a single point
  const a = rand() * 6.283, r = Math.sqrt(rand()) * (0.12 + 1.6 * S.L);
  setTarget(S, i, bx + Math.cos(a) * r, bz + Math.sin(a) * r);
}

// Lower is better: comfort, keep clear of the brooders, prefer the side walls, tolerate a fairly
// dense band along the walls but not a pile-up.
function coolScore(S, field, ctx, grid, cx, cz) {
  const h = HEATERS[nearestHeater(cx, cz)];
  const hd = Math.hypot(cx - h.x, cz - h.z);
  const wall = Math.min(cz - S.bounds.zMin, S.bounds.zMax - cz);
  return field.sample(cx, cz) + 1.6 * Math.max(0, 1 - hd / 3.2) + 0.35 * Math.min(wall, 3) +
    1.0 * Math.max(0, grid.crowd(cx, cz) - 2.2) + farmerPenalty(ctx, cx, cz);
}

function tryCool(S, field, ctx, grid, cx, cz) {
  cx = clampX(S, cx); cz = clampZ(S, cz);
  const s = coolScore(S, field, ctx, grid, cx, cz);
  if (s < bs) { bs = s; bx = cx; bz = cz; }
}

// Hot: cooler floor away from the brooders, along the side walls, toward the pad when fans run.
function coolSpot(S, i, field, env, ctx, grid) {
  const { rand } = S;
  const b = S.bounds;
  const x = S.px[i], z = S.pz[i];
  bx = x; bz = z; bs = coolScore(S, field, ctx, grid, x, z) - 0.2;
  const wallZ = z > 0 ? b.zMax - 0.15 - rand() * 1.2 : b.zMin + 0.15 + rand() * 1.2;
  tryCool(S, field, ctx, grid, x + (rand() - 0.5) * 3, wallZ);
  if (env.fansOn > 0) tryCool(S, field, ctx, grid, x - 2 - rand() * 4, z + (rand() - 0.5) * 2);
  for (let k = 0; k < 3; k++) {
    const a = rand() * 6.283, r = 0.6 + rand() * 3;
    tryCool(S, field, ctx, grid, x + Math.cos(a) * r, z + Math.sin(a) * r);
  }
  setTarget(S, i, bx + (rand() - 0.5) * 0.3, bz + (rand() - 0.5) * 0.3);
}

// Right: a stroll toward comfortable, less crowded floor (this is what spreads the flock evenly)
function wanderSpot(S, i, field, ctx, grid, reach) {
  const { rand } = S;
  const x = S.px[i], z = S.pz[i];
  bx = x; bz = z; bs = 1e9;
  for (let k = 0; k < 4; k++) {
    const a = rand() * 6.283, r = reach * (0.3 + 0.7 * rand());
    const cx = clampX(S, x + Math.cos(a) * r), cz = clampZ(S, z + Math.sin(a) * r);
    const c = Math.abs(field.sample(cx, cz));
    const s = 2 * Math.max(0, c - 1.0) + 0.8 * grid.crowd(cx, cz) + farmerPenalty(ctx, cx, cz);
    if (s < bs) { bs = s; bx = cx; bz = cz; }
  }
  setTarget(S, i, bx, bz);
}

function nearestLine(lines, z, rand) {
  let a = 0, b = 1, da = 1e9, db = 1e9;
  for (let k = 0; k < lines.length; k++) {
    const d = Math.abs(lines[k] - z);
    if (d < da) { b = a; db = da; a = k; da = d; } else if (d < db) { b = k; db = d; }
  }
  return rand() < 0.75 || db > 4 ? a : b;
}

// Claim a feeder pan near the bird; returns false if every nearby pan is crowded.
function feederSpot(S, i, ctx) {
  const { rand } = S;
  const line = nearestLine(FEEDER_LINES_Z, S.pz[i], rand);
  const per = S.panPerLine, cap = S.L < 0.3 ? 7 : 5;
  const j0 = Math.round((S.px[i] - LINE_X.start) / FEEDER_PAN_SPACING);
  let best = -1, use = 255;
  for (let k = 0; k < 3; k++) {
    const j = j0 + Math.round((rand() - 0.5) * 8);
    if (j < 0 || j >= per) continue;
    const r = line * per + j;
    const px = S.pans[r * 2];
    if (px > S.bounds.xMax - 0.25 || px < S.bounds.xMin + 0.25) continue;
    if (farmerPenalty(ctx, px, S.pans[r * 2 + 1])) continue;
    if (Math.abs(ctx.field.sample(px, S.pans[r * 2 + 1])) > 1.2) continue;
    if (S.resUse[r] < use) { use = S.resUse[r]; best = r; }
  }
  if (best < 0 || use >= cap) return false;
  S.res[i] = best; S.resUse[best]++;
  const cx = S.pans[best * 2], cz = S.pans[best * 2 + 1];
  const a = Math.atan2(S.pz[i] - cz, S.px[i] - cx) + (rand() - 0.5) * 1.6;
  const r = PAN_RADIUS + 0.3 * S.L * S.size[i];
  setTarget(S, i, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
  return true;
}

// Claim a nipple; the bird stands beside the line with its head under the nipple.
function drinkerSpot(S, i, ctx) {
  const { rand } = S;
  const line = nearestLine(DRINKER_LINES_Z, S.pz[i], rand);
  const per = S.nipPerLine;
  const j0 = Math.round((S.px[i] - LINE_X.start) / NIPPLE_SPACING);
  let best = -1, use = 255;
  for (let k = 0; k < 3; k++) {
    const j = j0 + Math.round((rand() - 0.5) * 12);
    if (j < 0 || j >= per) continue;
    const r = line * per + j;
    const nx = S.nips[r * 2];
    if (nx > S.bounds.xMax - 0.2 || nx < S.bounds.xMin + 0.2) continue;
    if (farmerPenalty(ctx, nx, S.nips[r * 2 + 1])) continue;
    if (!ctx.anyTemp && Math.abs(ctx.field.sample(nx, S.nips[r * 2 + 1])) > 1.2) continue;
    if (S.resUse[S.nPans + r] < use) { use = S.resUse[S.nPans + r]; best = r; }
  }
  if (best < 0 || use >= 2) return false;
  S.res[i] = S.nPans + best; S.resUse[S.nPans + best]++;
  const nx = S.nips[best * 2], nz = S.nips[best * 2 + 1];
  const side = S.pz[i] >= nz ? 1 : -1;
  setTarget(S, i, nx + (rand() - 0.5) * 0.04, nz + side * 0.3 * S.L * S.size[i]);
  return true;
}

function startActivity(S, i, act, dur) {
  if (S.act[i] !== act || act === ACT.EAT || act === ACT.DRINK) releaseRes(S, i);
  S.act[i] = act; S.actT[i] = dur;
}

// Pick what a comfortable bird does next. Older broilers rest much more.
function chooseRight(S, i, field, env, ctx, grid) {
  const { rand } = S;
  if (!S.lightsOn) { startActivity(S, i, ACT.REST, 20 + rand() * 30); setTarget(S, i, S.px[i], S.pz[i]); return; }
  const age = Math.min(1, Math.max(0, (S.day - 1) / 34));
  // weights: eat, drink, wander, idle, rest
  const wE = 0.26, wD = 0.14, wW = 0.32 - 0.12 * age, wI = 0.14 - 0.04 * age, wR = 0.14 + 0.36 * age;
  let r = rand() * (wE + wD + wW + wI + wR);
  if ((r -= wE) < 0) {
    startActivity(S, i, ACT.EAT, 12 + rand() * 20);
    if (feederSpot(S, i, ctx)) return;
  } else if ((r -= wD) < 0) {
    startActivity(S, i, ACT.DRINK, 6 + rand() * 9);
    if (drinkerSpot(S, i, ctx)) return;
  } else if ((r -= wW + wI) >= 0) {
    startActivity(S, i, ACT.REST, 12 + rand() * (20 + 30 * age));
    if (rand() < 0.5) wanderSpot(S, i, field, ctx, grid, 1.2); else setTarget(S, i, S.px[i], S.pz[i]);
    return;
  }
  if (rand() < 0.3) { startActivity(S, i, ACT.IDLE, 2 + rand() * 5); setTarget(S, i, S.px[i], S.pz[i]); return; }
  startActivity(S, i, ACT.WANDER, 12);
  wanderSpot(S, i, field, ctx, grid, 1.5 + rand() * 4.5);
}

// One decision tick for bird i. ctx = { farmerOn, fx, fz, farmerR }.
export function thinkBird(S, i, field, env, ctx, grid) {
  const { rand } = S;
  sampleThermal(S, i, field);
  const tc = 0.55 * S.tIdx[i] + 0.45 * S.tAmb[i]; // cold index
  const tt = 0.85 * S.tIdx[i] + 0.15 * S.tAmb[i]; // hot index
  const prev = S.therm[i];
  let th = prev;
  if (prev === COLD) { if (tc > -LEAVE_COLD) th = tt > ENTER ? HOT : RIGHT; }
  else if (prev === HOT) { if (tt < LEAVE_HOT) th = tc < -ENTER ? COLD : RIGHT; }
  else if (tc < -ENTER) th = COLD;
  else if (tt > ENTER) th = HOT;
  S.therm[i] = th;
  const changed = th !== prev;
  const a = S.act[i];

  if (th === COLD) {
    if (changed || a !== ACT.HUDDLE) { startActivity(S, i, ACT.HUDDLE, 2 + rand() * 3); warmSpot(S, i, field, env, ctx); }
    else if (S.actT[i] <= 0) {
      // look again for warmer floor; a bird already in the warmest spot stays put
      S.actT[i] = 3 + rand() * 4;
      warmSpot(S, i, field, env, ctx);
    }
    return;
  }
  if (th === HOT) {
    if (changed || (a !== ACT.PANT && a !== ACT.DRINK) || S.actT[i] <= 0) {
      if (a === ACT.PANT && !changed && rand() < 0.6) { S.actT[i] = 4 + rand() * 6; return; }
      if (rand() < 0.15 && a !== ACT.DRINK) {
        startActivity(S, i, ACT.DRINK, 6 + rand() * 8);
        ctx.anyTemp = true; // a hot bird drinks wherever the nipple is
        const ok = drinkerSpot(S, i, ctx);
        ctx.anyTemp = false;
        if (ok) return;
      }
      startActivity(S, i, ACT.PANT, 5 + rand() * 6);
      coolSpot(S, i, field, env, ctx, grid);
    }
    return;
  }
  // RIGHT
  if (changed || a === ACT.HUDDLE || a === ACT.PANT || S.actT[i] <= 0) { chooseRight(S, i, field, env, ctx, grid); return; }
  if (a === ACT.WANDER && S.arrived[i]) { startActivity(S, i, ACT.IDLE, 1 + rand() * 4); return; }
  // give up on a feeder or drinker that cannot be reached
  if ((a === ACT.EAT || a === ACT.DRINK) && !S.arrived[i] && S.stuck[i] > 2.5) chooseRight(S, i, field, env, ctx, grid);
}
