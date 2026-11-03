// Flock state: typed arrays per bird, feeder/drinker spots, placement. Owner: flock agent.
import {
  BIRD_BOUNDS, BROOD_BOUNDS, DRINKER_LINES_Z, FEEDER_LINES_Z, FEEDER_PAN_X, NIPPLE_X,
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
    n, cap: n, rand,
    px: F(), pz: F(), vx: F(), vz: F(), fx: F(), fz: F(), tx: F(), tz: F(),
    size: F(), phase: F(), tint: F(), sitPref: F(), boldness: F(),
    act: new Uint8Array(n), actT: F(), thinkT: F(),
    therm: new Int8Array(n), tIdx: F(), tAmb: F(), arrived: new Uint8Array(n), res: new Int32Array(n).fill(-1),
    // own heat tolerance: starts panting this far above target (1.5 .. 4.5 °C), so the share of
    // panting birds grows with the heat instead of the whole flock switching at once
    hotTh: F(),
    site: new Int16Array(n).fill(-1), // huddle site of a cold bird when no brooder is running
    rad: F(), spd: F(), scare: F(), stuck: F(),
    sitA: F(), wingA: F(), hp: F(), hl: F(), ht: F(), beak: F(), stride: F(),
    // flock-wide values, refreshed when the day changes
    day: -1, L: 0.15, morph: 0, baseSpeed: 0.25, curtain: true, bounds: BROOD_BOUNDS,
    rRight: 0.35, rHot: 0.42, rHuddle: 0.08, maxR: 0.5, perM2: 6, time: 0,
    lightsOn: true,
    sites: null, siteR: 0.6, // huddle sites (x, z pairs) for the usable floor, see makeHuddleSites
    spreadT: 0,              // seconds left of the "curtain just lifted" spreading phase
  };
  for (let i = 0; i < n; i++) {
    // ±8 % size spread (roughly normal), slight colour tint, personality
    const g = (rand() + rand() + rand() - 1.5) / 1.5;
    S.size[i] = 1 + 0.08 * g;
    S.phase[i] = rand() * Math.PI * 2;
    S.tint[i] = (rand() + rand()) - 1;
    S.sitPref[i] = rand();
    S.boldness[i] = rand();
    S.hotTh[i] = 1.5 + 3.0 * rand();
  }
  buildResources(S);
  return S;
}

// Feeder pans and drinker nipples exactly where house.js draws them (config FEEDER_PAN_X and
// NIPPLE_X, evenly spaced). Each bird may hold one spot (S.res).
function buildResources(S) {
  const pans = [];
  for (const z of FEEDER_LINES_Z) for (const x of FEEDER_PAN_X) pans.push(x, z);
  const nips = [];
  for (const z of DRINKER_LINES_Z) for (const x of NIPPLE_X) nips.push(x, z);
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

// Where cold birds pile up when no brooder is running (shared body heat): a staggered grid of spots
// in the gaps between the feeder and drinker lines, clear of the side walls and the pad, about one
// per 120-130 birds in the brooding area. Returns [x0, z0, x1, z1, ...].
const SITE_ROWS = [-2.95, -0.98, 0.98, 2.95];
export function makeHuddleSites(b) {
  const out = [];
  const x0 = b.xMin + 2.6, x1 = b.xMax - 1.6;
  SITE_ROWS.forEach((z, r) => { for (let x = x0 + (r % 2) * 3; x <= x1 + 1e-6; x += 6) out.push(x, z); });
  return Float32Array.from(out);
}

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
    S.site[i] = -1;
    S.arrived[i] = 1;
    S.res[i] = -1;
    S.sitA[i] = 0; S.wingA[i] = 0; S.hp[i] = 0; S.hl[i] = 0; S.ht[i] = 0; S.beak[i] = 0;
    S.stride[i] = rand() * 6.28; S.spd[i] = 0; S.scare[i] = 0; S.stuck[i] = 0;
  }
}
