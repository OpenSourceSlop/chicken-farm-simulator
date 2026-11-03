// Bird animation: writes instance matrices and the two per-instance pose vec4s read by the
// vertex shader (see flock-shader.js). Owner: flock agent. Each bird has its own phase so the
// flock never moves in lockstep.
import { ACT, HOT } from './flock-state.js';

const TAU = Math.PI * 2;

function fract(v) { return v - Math.floor(v); }

// stage = { M: n*16 instance matrices, A/B/C: n*4 pose vec4s, R: n bird scale (m) } (flock-render.js)
export function poseAll(S, dt, stage) {
  const mat = stage.M, animA = stage.A, animB = stage.B, animC = stage.C, rad = stage.R;
  const n = S.n, t = S.time, L = S.L, base = S.baseSpeed;
  const { px, pz, fx, fz, act, arrived, therm, size, phase, sitA, wingA, hp, hl, ht, beak, stride } = S;
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
    sitA[i] += (sitT - sitA[i]) * Math.min(1, dt * (sitT > sitA[i] ? 1.6 : 5));
    const wingT = hot ? (S.spd[i] > 0.3 * base ? 0.55 : 1) : 0;
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
    if (hot) {
      // panting: open beak, fast shallow head bob (gular flutter)
      const w = Math.sin(t * 28 + ph * 7);
      beakT = 0.8 + 0.2 * w;
      lift += 0.016 * w; pitch += 0.06 * w;
    }
    hp[i] += (pitch - hp[i]) * kHead;
    hl[i] += (lift - hl[i]) * kHead;
    ht[i] += (turn - ht[i]) * kTurn;
    beak[i] += (beakT - beak[i]) * kBeak;

    // instance matrix: yaw from facing (fx, fz), uniform scale s, little bob while walking
    const y = walk * (1 - sitA[i]) * 0.035 * s * Math.abs(Math.sin(st));
    const c = fx[i] * s, d = fz[i] * s;
    const o = i * 16;
    mat[o] = c; mat[o + 1] = 0; mat[o + 2] = d; mat[o + 3] = 0;
    mat[o + 4] = 0; mat[o + 5] = s; mat[o + 6] = 0; mat[o + 7] = 0;
    mat[o + 8] = -d; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0;
    mat[o + 12] = px[i]; mat[o + 13] = y; mat[o + 14] = pz[i]; mat[o + 15] = 1;

    rad[i] = s;
    const q = i * 4, wing = 0.95 * wingA[i];
    animA[q] = Math.cos(hp[i]); animA[q + 1] = Math.sin(hp[i]); animA[q + 2] = hl[i]; animA[q + 3] = sitA[i];
    animB[q] = Math.cos(ht[i]); animB[q + 1] = Math.sin(ht[i]); animB[q + 2] = Math.cos(wing); animB[q + 3] = Math.sin(wing);
    animC[q] = 0.6 * beak[i]; // sin(x) ~ x is plenty for a 0.6 rad beak gape
    animC[q + 1] = Math.sin(walk * (1 - sitA[i]) * 0.55 * Math.sin(st));
    animC[q + 2] = S.tint[i]; animC[q + 3] = 0.25 * wingA[i];
  }
}
