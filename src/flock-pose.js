// Bird animation: writes instance matrices and the two per-instance pose vec4s read by the
// vertex shader (see flock-shader.js). Owner: flock agent. Each bird has its own phase so the
// flock never moves in lockstep.
import { ACT, HOT } from './flock-state.js';

const TAU = Math.PI * 2;

function fract(v) { return v - Math.floor(v); }

// stage = { M: n*16 instance matrices, A/B/C: n*4 pose vec4s, R: n bird scale (m) } (flock-render.js)
export function poseAll(S, dt, stage) {
  const mat = stage.M, animA = stage.A, animB = stage.B, animC = stage.C, rad = stage.R, E = stage.E;
  const n = S.n, t = S.time, L = S.L, base = S.baseSpeed;
  const { px, pz, fx, fz, act, arrived, therm, size, phase, sitA, wingA, hp, hl, ht, beak, stride } = S;
  // level only (all 0 in the sandbox): sick / lame birds, chicks tumbling out of a box, dazed after the tip
  const { sick, spawnT, lagT } = S;
  const kHead = Math.min(1, dt * 14), kTurn = Math.min(1, dt * 4), kBeak = Math.min(1, dt * 12);
  const kWing = Math.min(1, dt * 2.5);
  for (let i = 0; i < n; i++) {
    const a = act[i], si = size[i], ph = phase[i], s = L * si;
    const hot = therm[i] === HOT;
    const scared = S.scare[i] > 0;
    const arr = arrived[i];

    // sitting: resting, huddling, and most panting birds once they reach their spot
    let sitT = 0;
    if (!scared && arr) {
      if (a === ACT.HUDDLE || a === ACT.REST) sitT = 1;
      else if (a === ACT.PANT && S.sitPref[i] < 0.72) sitT = 1;
    }
    // Phase 3: a lame bird (sick 3) is alert, not fluffed or dull: it sits, and limps when it walks
    const lame = sick[i] === 3, sk = lame ? 0 : sick[i];
    if (lagT[i] > 0) sitT = 1; // just tipped out: sits a moment, then gets up and goes
    sitA[i] += (sitT - sitA[i]) * Math.min(1, dt * (sitT > sitA[i] ? 1.6 : 5));
    // heat stress shows in degrees: wings held further out and harder panting the hotter the bird
    let heat = 0;
    if (hot) { heat = (S.tIdx[i] - S.heatRef) / 4; heat = heat < 0.3 ? 0.3 : heat > 1 ? 1 : heat; }
    // a sick bird lets its wings hang a little away from the body
    const wingT = sk ? 0.3 : hot ? heat * (S.spd[i] > 0.3 * base ? 0.55 : 1) : 0;
    wingA[i] += (wingT - wingA[i]) * kWing;

    // walking cycle: small fast steps for chicks, slower strides for broilers
    const spd = S.spd[i];
    // a bird that has arrived and is only being jostled shuffles its feet but keeps its pose
    const walkRaw = Math.min(1, spd / (0.35 * base * si));
    const walk = arr ? (spd > 0.4 * base ? 0.5 * walkRaw : 0) : walkRaw;
    stride[i] += dt * TAU * (spd / (0.3 * s));
    const st = stride[i];

    let pitch, lift, turn = 0, beakT = 0;
    if (walk > 0.35 && !arr && sitA[i] < 0.5) {
      pitch = 0.12 + 0.1 * Math.sin(2 * st);
      lift = 0.012 * Math.sin(2 * st + 1);
    } else if (a === ACT.EAT && arr) {
      // bursts of quick pecks into the pan, with a pause to look up now and then
      const cyc = fract(t * 1.6 + ph);
      const peck = cyc < 0.35 ? Math.sin((cyc / 0.35) * Math.PI) : 0;
      if (fract(t * 0.13 + ph * 0.37) > 0.8) { pitch = 0.05; lift = 0; turn = 0.4 * Math.sin(t * 0.9 + ph); }
      else { pitch = 0.55 + 0.75 * peck; lift = -0.05 - 0.1 * peck; }
    } else if (a === ACT.DRINK && arr) {
      // head up under the nipple, little upward pecks
      const tap = Math.max(0, Math.sin(t * 7 + ph * 3));
      pitch = -0.8 - 0.15 * tap; lift = 0.06 + 0.03 * tap;
    } else if (a === ACT.HUDDLE) {
      pitch = 0.32; lift = -0.09; turn = 0.15 * Math.sin(t * 0.15 + ph);
    } else if (a === ACT.REST) {
      pitch = 0.18 + 0.05 * Math.sin(t * 0.5 + ph); lift = -0.06;
      turn = 0.45 * Math.sin(t * 0.23 + ph * 3) * Math.sin(t * 0.11 + ph);
    } else if (a === ACT.PANT) {
      pitch = -0.18; lift = 0.02; turn = 0.25 * Math.sin(t * 0.35 + ph);
    } else {
      // standing about: looking around, the odd peck at the litter
      const cyc = fract(t * 0.3 + ph);
      const peck = cyc < 0.12 ? Math.sin((cyc / 0.12) * Math.PI) : 0;
      pitch = 0.08 + 1.05 * peck; lift = -0.15 * peck;
      turn = 0.6 * Math.sin(t * 0.6 + ph * 5) * Math.sin(t * 0.31 + ph);
    }
    if (sk) {
      // sick: head drawn in and down, still; it hardly looks up even when it walks
      const nod = Math.max(0, Math.sin(t * 0.4 + ph)) ** 8; // now and then the head drops further
      pitch = 0.42 + 0.25 * nod; lift = -0.11 - 0.03 * nod; turn = 0.1 * Math.sin(t * 0.1 + ph);
    }
    if (hot && !sk) {
      // panting: open beak, fast shallow head bob (gular flutter), stronger with the heat
      const w = Math.sin(t * (20 + 8 * heat) + ph * 7);
      beakT = (0.45 + 0.45 * heat) + 0.15 * w;
      lift += 0.016 * heat * w; pitch += 0.06 * heat * w;
    }
    hp[i] += (pitch - hp[i]) * kHead;
    hl[i] += (lift - hl[i]) * kHead;
    ht[i] += (turn - ht[i]) * kTurn;
    beak[i] += (beakT - beak[i]) * kBeak;

    // instance matrix: yaw from facing (fx, fz), uniform scale s, little bob while walking
    let y = walk * (1 - sitA[i]) * 0.035 * s * Math.abs(Math.sin(st));
    const o = i * 16;
    if (sk || lame || spawnT[i] > 0) {
      // sick: fluffed up (rounder, wider); lame: a rolling limp while it walks; a chick from the
      // box drops the last few centimetres with a tumble
      let roll = 0, fl = sk ? 1 : 0;
      if (sk === 2 && walk > 0.2) { const w = Math.sin(st); roll = 0.24 * w * walk; y += 0.03 * s * Math.abs(w); }
      // Phase 3 lame bird: a hop on the good leg, the body dropping hard onto the bad side
      if (lame && walk > 0.15) { const w = Math.sin(st); roll = 0.32 * Math.max(0, w) * walk - 0.06; y += 0.05 * s * Math.max(0, -w); }
      if (spawnT[i] > 0) { const k = spawnT[i] / 0.3; y += 0.9 * s * k * k; roll += 1.4 * k * (ph > 3.14 ? 1 : -1); spawnT[i] -= dt; }
      writeBirdMatrix(mat, o, px[i], y, pz[i], fx[i], fz[i], roll, s * (1 - 0.06 * fl), s * (1 + 0.1 * fl), s * (1 + 0.24 * fl));
    } else {
      const c = fx[i] * s, d = fz[i] * s;
      mat[o] = c; mat[o + 1] = 0; mat[o + 2] = d; mat[o + 3] = 0;
      mat[o + 4] = 0; mat[o + 5] = s; mat[o + 6] = 0; mat[o + 7] = 0;
      mat[o + 8] = -d; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0;
      mat[o + 12] = px[i]; mat[o + 13] = y; mat[o + 14] = pz[i]; mat[o + 15] = 1;
    }

    rad[i] = s;
    E[i] = S.tIdx[i]; // felt comfort (°C over the target) for the comfort view
    const q = i * 4, wing = 0.95 * wingA[i];
    animA[q] = Math.cos(hp[i]); animA[q + 1] = Math.sin(hp[i]); animA[q + 2] = hl[i]; animA[q + 3] = sitA[i];
    animB[q] = Math.cos(ht[i]); animB[q + 1] = Math.sin(ht[i]); animB[q + 2] = Math.cos(wing); animB[q + 3] = Math.sin(wing);
    animC[q] = 0.6 * beak[i]; // sin(x) ~ x is plenty for a 0.6 rad beak gape
    animC[q + 1] = Math.sin(walk * (1 - sitA[i]) * (lame ? 0.2 : 0.55) * Math.sin(st));
    // tint +3 = eyes closed and a dull coat (flock-shader.js): sick birds
    animC[q + 2] = S.tint[i] + (sk ? 3 : 0); animC[q + 3] = 0.25 * wingA[i];
  }
}

// Bird instance matrix: facing (fx, fz) in the ground plane, then `roll` about the facing axis
// (+ = onto its right side), scales along / up / across the bird, standing at (x, y, z).
export function writeBirdMatrix(m, o, x, y, z, fx, fz, roll, sx, sy, sz) {
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // right axis of the bird = (-fz, 0, fx); up' = up*cos + right*sin; right' = right*cos - up*sin
  m[o] = fx * sx; m[o + 1] = 0; m[o + 2] = fz * sx; m[o + 3] = 0;
  m[o + 4] = -fz * sr * sy; m[o + 5] = cr * sy; m[o + 6] = fx * sr * sy; m[o + 7] = 0;
  m[o + 8] = -fz * cr * sz; m[o + 9] = -sr * sz; m[o + 10] = fx * cr * sz; m[o + 11] = 0;
  m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
}
