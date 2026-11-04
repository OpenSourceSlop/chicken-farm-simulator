// Sound layer, pure part: what should be heard where and when. No DOM and no Web Audio, so node tests
// (scripts/test-audio.mjs) check it. audio-engine.js turns these numbers into node gains.
//
//   surfaceAt(x, z)            'litter' | 'concrete' | 'gravel' | 'grass' | 'dip' under the farmer's boots
//   indoorness(x, z, inside)   0 outside .. 1 inside; a 3 m crossfade through the house door
//   ambientTargets(s, out)     bed gains 0..1 (and filter cut-offs) for the place, the hour and the house's machines
//   flockLoudness(birds)       0..~1.15 from the birds within earshot (nearness-weighted real birds)
//   flockMix(snd, F, day, out) event rates and bed gains of the flock from flock.sounds()
//   createStepTracker()        footfalls from the farmer's speed, the same cycle as player-anim.js
//   LEVELS                     dBFS of each layer at the default volume (the mix rule: background -30..-36)
import { HOUSE, HOUSE_BOUNDS, HEATERS, FARM, PAD } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

/** Small seeded generator (mulberry32): the offline renders and the node tests are repeatable. */
export function makeRng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Exponential gap (a Poisson process) with mean `mean` s, clipped to [min, max]: never a fixed beat. */
export const nextGap = (rng, mean, min = 0, max = Infinity) => clamp(-Math.log(1 - rng() * 0.999999) * mean, min, max);
/** One of n variants, never the same as `last` twice in a row (n > 1). */
export function pick(rng, n, last = -1) {
  if (n <= 1) return 0;
  let i = Math.floor(rng() * (n - 1));
  if (i >= last && last >= 0) i++;
  return Math.min(n - 1, i);
}
/** rng in [a, b) */
export const range = (rng, a, b) => a + (b - a) * rng();

// Levels of the sounds that come and go, in dBFS at the default slider position (audio-settings
// DEFAULT_VOLUME): the RMS of a sound while it plays sits near these (the beds' own levels are
// audio-beds.js BED_DB). Each event's peak over its level is EVENT_DB (audio-sched) / CUES (audio-engine).
// scripts/p5-sound.json measures every layer: background RMS -30..-36 dBFS, cues a few dB over it.
export const LEVELS = {
  birds: -36, distant: -42,
  flock: -36, distress: -31, pant: -40, snick: -35,
  steps: -38, cue: -32, tick: -33, click: -42,
};

// ---- where the farmer stands ----
const HB = HOUSE_BOUNDS, DOOR = HOUSE.door;
const APRON = 1.35; // the 1.2 m apron outside the 0.15 m walls
const inRect = (x, z, x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
function segDist(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1);
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}
const ROAD = [{ x: FARM.road[0].x, z: 62 }, ...FARM.road]; // the road runs on out of the gate to the public road
function roadDist(x, z) {
  let best = Infinity;
  for (let i = 1; i < ROAD.length; i++) { const d = segDist(x, z, ROAD[i - 1], ROAD[i]); if (d < best) best = d; }
  return best;
}
const GDIP = FARM.footDipGate, HDIP = FARM.footDipHouse;
const WASH = { x: -27, z: 10.5 };

export function surfaceAt(x, z) {
  if (inRect(x, z, HB.xMin, HB.xMax, HB.zMin, HB.zMax)) return 'litter';
  if (inRect(x, z, GDIP.x - GDIP.hw, GDIP.x + GDIP.hw, GDIP.z - GDIP.hd, GDIP.z + GDIP.hd)) return 'dip';
  if (inRect(x, z, HDIP.x - 0.75, HDIP.x + 0.75, HDIP.z - 0.4, HDIP.z + 0.4)) return 'dip';
  if (inRect(x, z, HB.xMin - APRON, HB.xMax + APRON, HB.zMin - APRON, HB.zMax + APRON)) return 'concrete';
  const p = FARM.doorPath;
  if (inRect(x, z, p[0].x - 1.25, p[0].x + 1.25, p[1].z - 0.5, p[0].z)) return 'concrete';
  if (Math.hypot(x - WASH.x, z - WASH.z) < 3) return 'concrete';
  if (roadDist(x, z) < 2.6) return 'gravel';
  if (inRect(x, z, 25, 34.5, 9.2, 18.6)) return 'gravel'; // turning and loading area by the fan end
  return 'grass';
}

/** 0 outside .. 1 inside. Only the door blends (the walls stop the farmer everywhere else). */
export function indoorness(x, z, inside) {
  const wx = 1 - smooth(0.9, 1.9, Math.abs(x - DOOR.x));
  const base = inside ? 1 : 0;
  if (wx <= 0) return base;
  const kDoor = smooth(DOOR.z + 1.8, DOOR.z - 1.4, z); // 1.4 m in = all inside, 1.8 m out = all outside
  return lerp(base, kDoor, wx);
}

// ---- time of day (game hours) ----
/** Bird calls per real minute: a dawn chorus, quiet midday, an evening round, none at night. */
export function birdRate(hour, weather) {
  const dawn = Math.exp(-(((hour - 6.8) / 1.0) ** 2)) * 9;
  const eve = Math.exp(-(((hour - 17.4) / 0.9) ** 2)) * 5;
  const day = hour > 6 && hour < 18.4 ? 2.4 : 0;
  return (dawn + eve + day) * (weather === 'rainy' ? 0.6 : 1) * (hour > 5.2 && hour < 19 ? 1 : 0);
}
/** Crickets 0..1: in from 18:00, full through the night, out by 06:30. */
export const insectLevel = (hour) => Math.max(smooth(18.0, 19.6, hour), 1 - smooth(5.0, 6.5, hour));
/** Cicadas 0..1: a short swell at dusk, a smaller one at dawn. */
export const cicadaLevel = (hour) => Math.exp(-(((hour - 18.5) / 0.55) ** 2)) + 0.4 * Math.exp(-(((hour - 6.0) / 0.4) ** 2));
const night = (hour) => hour < 5.5 || hour > 19;
/** Distant events per real minute: { moto, dog, frog, gecko }. Rare by design. */
export function distantRates(hour, weather, out = {}) {
  const n = night(hour), late = hour > 23 || hour < 4.5;
  out.moto = late ? 0.04 : n ? 0.16 : 0.24;
  out.dog = n ? 0.28 : 0.12;
  out.frog = n ? (weather === 'rainy' ? 2.5 : 0.9) : 0;
  out.gecko = n ? 0.1 : 0;
  return out;
}

// ---- the house's machines and the outdoor bed ----
const FAN_WALL = HB.xMax, PAD_WALL = PAD.x;
/**
 * s: { x, z, k (indoorness), hour, weather, rain (0..1), fanSpin (0..1: fans turning / 6), heaterLevel, padOn }
 * out (gains 0..1 before LEVELS): breeze, crickets, cicadas, fans, fanCut (Hz), gas, roar, pad, rain, rainCut,
 * outCut (Hz, the outdoor bed's low-pass: the walls muffle it inside), flockAtten, flockCut
 */
export function ambientTargets(s, out = {}) {
  const k = clamp(s.k, 0, 1), x = s.x, z = s.z;
  const calm = night(s.hour) ? 0.7 : 1;
  const wall = lerp(1, 0.13, k); // outdoor sounds through the walls and the pad
  out.breeze = calm * wall;
  out.crickets = insectLevel(s.hour) * wall;
  out.cicadas = cicadaLevel(s.hour) * wall;
  out.outCut = lerp(14000, 1100, k);
  // tunnel fans: inside louder toward the fan end; outside around the exhaust, fading with distance
  const fanIn = 0.36 + 0.64 * Math.exp(-(FAN_WALL - x) / 16);
  const dEx = Math.hypot(x - (FAN_WALL + 1), z * 0.8);
  const fanOut = 0.85 * Math.exp(-Math.max(0, dEx - 2) / 13);
  const spin = clamp(s.fanSpin, 0, 1);
  out.fans = Math.sqrt(spin) * lerp(fanOut, fanIn, k);
  out.fanCut = lerp(300 + 500 * Math.exp(-dEx / 9), 820, k);
  // gas brooders: a hiss under the nearest burning brooder, a soft roar through the brooding end
  let near = 0;
  for (let i = 0; i < HEATERS.length; i++) {
    const dx = x - HEATERS[i].x, dz = z - HEATERS[i].z;
    near += Math.exp(-(dx * dx + dz * dz) / (2 * 2.1 * 2.1));
  }
  const heat = clamp(s.heaterLevel || 0, 0, 1);
  out.gas = heat * Math.min(1, near) * k;
  out.roar = heat * (0.25 + 0.75 * Math.min(1, near)) * k * smooth(-30, -8, -Math.abs(x + 10));
  // pad: water trickling down the west end wall while the pump runs
  const dPadIn = Math.max(0, x - PAD_WALL);
  const dPadOut = Math.hypot(Math.min(0, x - (PAD_WALL - 0.3)), Math.max(0, Math.abs(z) - HB.zMax));
  const padIn = Math.exp(-dPadIn / 8), padOut = 0.8 * Math.exp(-dPadOut / 5) * (x < PAD_WALL + 1 ? 1 : 0.3);
  out.pad = s.padOn ? lerp(padOut, padIn, k) : 0;
  // rain (Phase 4 storms: farm.weatherNow.rain) drums on the roof inside
  out.rain = clamp(s.rain || 0, 0, 1) * lerp(0.75, 1, k);
  out.rainCut = lerp(5000, 2600, k);
  // the flock through the walls: faint and dull from the apron
  out.flockAtten = lerp(0.14, 1, k);
  out.flockCut = lerp(900, 16000, k);
  return out;
}

// ---- the flock ----
export const FLOCK_REF_BIRDS = 1200; // nearness-weighted birds at which the flock is at its level
/** Loudness 0..~1.15 from W, the real birds within earshot weighted 1 / (1 + (d / 3 m)²). */
export function flockLoudness(W) {
  if (!(W > 0)) return 0;
  return clamp(Math.log2(1 + W / 40) / Math.log2(1 + FLOCK_REF_BIRDS / 40), 0, 1.15);
}
/** Nearness weight of one bird d metres away (the same weight flockLoudness expects). */
export const nearWeight = (d) => 1 / (1 + (d / 3) * (d / 3));

/**
 * What the flock sounds like, as the game words it (farm-problems observe: loud peeping when more than a
 * tenth are cold, hungry or thirsty; hot birds pant with open beaks, they do not peep). flock.sounds()
 * counts hot birds toward its distress (0.6 each); this takes that part back out, using the drawn birds'
 * own cold and hot shares. snd: flock.sounds(); cold / hot: shares 0..1; dark: lights off.
 * out: { distress, contented, pant, snick, rattle } 0..1 for flockMix.
 */
export function flockVoice(snd, cold, hot, dark, out = {}) {
  const c = clamp(cold || 0, 0, 1), h = clamp(hot || 0, 0, 1), d = clamp(snd?.distress || 0, 0, 1);
  // the hungry / thirsty part of the game's share (when its distress is clamped at 1, the least that reaches it)
  const share = d < 1 ? d * 0.2 + 0.04 : 0.24;
  const extra = Math.max(0, share - c - 0.6 * h);
  out.distress = clamp((c + extra - 0.04) / 0.2, 0, 1);
  out.contented = (1 - out.distress) * (dark ? 0.35 : 1);
  out.pant = clamp(snd?.pant ?? h, 0, 1);
  out.snick = clamp(snd?.snick || 0, 0, 1);
  out.rattle = clamp(snd?.rattle || 0, 0, 1);
  return out;
}

/**
 * snd: flockVoice() { distress, contented, snick, rattle, pant } (0..1 each); F: flockLoudness; day: flock age.
 * out: chirp / distress / snick / rattle / flutter (events per second), murmur / chorus / pant (bed gains 0..1),
 * age (0 chicks .. 1 grown birds: pitch and call type).
 */
export function flockMix(snd, F, day, out = {}) {
  const f = clamp(F || 0, 0, 1.15);
  const age = smooth(6, 26, day || 0);
  const c = clamp(snd?.contented || 0, 0, 1), d = clamp(snd?.distress || 0, 0, 1);
  const pant = clamp(snd?.pant ?? 0, 0, 1), sn = clamp(snd?.snick || 0, 0, 1), ra = clamp(snd?.rattle || 0, 0, 1);
  const quiet = Math.max(0.1, 1 - 1.1 * pant); // hot birds hardly call: they pant with open beaks
  out.age = age;
  out.chirp = f * c * (1 - d) * quiet * lerp(6.5, 1.6, age);
  out.distress = f * d * lerp(15, 6, age);
  out.chorus = f * smooth(0.15, 0.8, d);
  out.murmur = f * age * (0.35 + 0.65 * c) * (1 - 0.5 * d) * (1 - 0.65 * pant); // panting birds hardly murmur
  out.pant = f * pant;
  out.flutter = f * pant * 0.45;
  out.snick = f * sn * 1.1;
  out.rattle = f * ra * 0.5;
  return out;
}

// ---- footfalls (the same cycle as player-anim.js, so a sound lands with each boot) ----
const WALK_CYCLE = 2.5, RUN_CYCLE = 3.3;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const crossed = (a, b, q) => (a < q && b >= q) || (a > b && (a < q || b >= q));
export function createStepTracker() {
  const st = { phase: 0, move: 0, run: 0 };
  return {
    /** dt s, speed m/s (player.speed), dist m moved this frame (default speed * dt; the game passes the real
     *  distance, so a slow machine's long frames keep the steps with the boots). Returns 0, or 1 / 2 on the
     *  frame the left / right boot lands. */
    update(dt, speed, dist = speed * dt) {
      st.move = damp(st.move, smooth(0.05, 1.2, speed), 9, dt);
      st.run = damp(st.run, smooth(4.4, 6.1, speed), 6, dt);
      const prev = st.phase;
      if (speed > 0.01 && dist > 0) st.phase = (st.phase + dist / lerp(WALK_CYCLE, RUN_CYCLE, st.run)) % 1;
      if (!(st.move > 0.4 && dt > 0)) return 0;
      return crossed(prev, st.phase, 0.25) ? 1 : crossed(prev, st.phase, 0.75) ? 2 : 0;
    },
    get run() { return st.run; },
    reset() { st.phase = 0; st.move = 0; st.run = 0; },
  };
}
/** Steps get quieter the longer the farmer walks without a stop (to 0.62 after about 12 s), as the ear stops hearing them. */
export const stepHabituation = (walkSeconds) => lerp(1, 0.62, smooth(3, 14, walkSeconds));
