// Flock state: typed arrays per bird, feeder/drinker spots, placement. Owner: flock agent.
import {
  BIRD_BOUNDS, BROOD_BOUNDS, DRINKER_LINES_Z, FEEDER_LINES_Z, FEEDER_PAN_SPACING, LINE_X,
  NIPPLE_SPACING,
} from './config.js';

// Activities
export const ACT = { IDLE: 0, WANDER: 1, EAT: 2, DRINK: 3, REST: 4, HUDDLE: 5, PANT: 6 };
// Thermal states (with hysteresis, see flock-think.js)
export const COLD = -1, RIGHT = 0, HOT = 1;
export const PAN_RADIUS = 0.17; // pan feeder rim radius, metres

// Small fast seeded PRNG (mulberry32) so runs and screenshots are repeatable
export function makeRand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createState(n) {
  const rand = makeRand(20240611);
  const F = () => new Float32Array(n);
  const S = {
    n, rand,
    px: F(), pz: F(), vx: F(), vz: F(), fx: F(), fz: F(), tx: F(), tz: F(),
    size: F(), phase: F(), tint: F(), sitPref: F(), boldness: F(),
    act: new Uint8Array(n), actT: F(), thinkT: F(),
    therm: new Int8Array(n), tIdx: F(), tAmb: F(), arrived: new Uint8Array(n), res: new Int32Array(n).fill(-1),
    rad: F(), spd: F(), scare: F(), stuck: F(),
    sitA: F(), wingA: F(), hp: F(), hl: F(), ht: F(), beak: F(), stride: F(),
    // flock-wide values, refreshed when the day changes
    day: -1, L: 0.15, morph: 0, baseSpeed: 0.25, curtain: true, bounds: BROOD_BOUNDS,
    rRight: 0.35, rHot: 0.42, rHuddle: 0.08, maxR: 0.5, perM2: 6, time: 0,
    lightsOn: true,
  };
  for (let i = 0; i < n; i++) {
    // ±8 % size spread (roughly normal), slight colour tint, personality
    const g = (rand() + rand() + rand() - 1.5) / 1.5;
    S.size[i] = 1 + 0.08 * g;
    S.phase[i] = rand() * Math.PI * 2;
    S.tint[i] = (rand() + rand()) - 1;
    S.sitPref[i] = rand();
    S.boldness[i] = rand();
  }
  buildResources(S);
  return S;
}

// Feeder pans and drinker nipples over the full line length. Each bird may hold one spot (S.res).
function buildResources(S) {
  const pans = [];
  for (const z of FEEDER_LINES_Z) {
    for (let x = LINE_X.start; x <= LINE_X.end + 1e-6; x += FEEDER_PAN_SPACING) pans.push(x, z);
  }
  const nips = [];
  for (const z of DRINKER_LINES_Z) {
    for (let x = LINE_X.start; x <= LINE_X.end + 1e-6; x += NIPPLE_SPACING) nips.push(x, z);
  }
  S.pans = Float32Array.from(pans);
  S.nPans = pans.length / 2;
  S.panPerLine = S.nPans / FEEDER_LINES_Z.length;
  S.nips = Float32Array.from(nips);
  S.nNips = nips.length / 2;
  S.nipPerLine = S.nNips / DRINKER_LINES_Z.length;
  S.resUse = new Uint8Array(S.nPans + S.nNips);
}

export function releaseRes(S, i) {
  const r = S.res[i];
  if (r >= 0) { if (S.resUse[r] > 0) S.resUse[r]--; S.res[i] = -1; }
}

export function usableBounds(curtain) { return curtain ? BROOD_BOUNDS : BIRD_BOUNDS; }

// Place the whole flock. Young chicks are "just placed" along the feeder and drinker lines of the
// brooding area; an older flock (e.g. restored on reload) is scattered over the usable floor.
export function placeFlock(S) {
  const { n, rand } = S;
  const b = S.bounds;
  S.resUse.fill(0);
  const lines = [...FEEDER_LINES_Z, ...DRINKER_LINES_Z];
  for (let i = 0; i < n; i++) {
    let x, z;
    if (S.day < 4) {
      const lz = lines[(rand() * lines.length) | 0];
      x = b.xMin + 0.3 + rand() * (b.xMax - b.xMin - 0.6);
      z = lz + (rand() + rand() + rand() - 1.5) * 0.35;
    } else {
      x = b.xMin + rand() * (b.xMax - b.xMin);
      z = b.zMin + rand() * (b.zMax - b.zMin);
    }
    S.px[i] = Math.min(b.xMax, Math.max(b.xMin, x));
    S.pz[i] = Math.min(b.zMax, Math.max(b.zMin, z));
    S.vx[i] = S.vz[i] = 0;
    const a = rand() * Math.PI * 2;
    S.fx[i] = Math.cos(a); S.fz[i] = Math.sin(a);
    S.tx[i] = S.px[i]; S.tz[i] = S.pz[i];
    S.act[i] = ACT.IDLE;
    S.actT[i] = rand() * 3;
    S.thinkT[i] = rand() * 0.5;
    S.therm[i] = RIGHT;
    S.tIdx[i] = 0; S.tAmb[i] = 0;
    S.arrived[i] = 1;
    S.res[i] = -1;
    S.sitA[i] = 0; S.wingA[i] = 0; S.hp[i] = 0; S.hl[i] = 0; S.ht[i] = 0; S.beak[i] = 0;
    S.stride[i] = rand() * 6.28; S.spd[i] = 0; S.scare[i] = 0; S.stuck[i] = 0;
  }
}
