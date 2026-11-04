// Sound layer, the stochastic part: when a bird in the trees, a dog in the village or a chick in the
// house makes a sound. Every source is an inhomogeneous Poisson process (rates from audio-mix.js),
// so nothing ever falls into a beat; pitch, length, timbre and place vary on every call.
// Rate limits run on the audio clock: a burst of game steps in one task (the harness's advance(), a
// skip) never stacks sounds up, because the clock has not moved and the voices are still busy.
import { dbToGain, LEVELS, nextGap, pick, range, lerp, nearWeight, birdRate, distantRates } from './audio-mix.js';
import * as V from './audio-voices.js';

// Peak level of one event over its layer's LEVELS (dB): calibrated with scripts/p5-sound.json so the
// layers' RMS land on LEVELS at the default volume.
export const EVENT_DB = {
  chirp: 13, distress: 5.5, cluck: 9, snick: 24, rattle: 12, flutter: 14, burst: 7,
  twitter: 7, dove: 6, bulbul: 6, frog: 2, gecko: 2, dog: 4, moto: 6, truck: 9,
};
const peak = (kind, layer) => dbToGain(LEVELS[layer] + EVENT_DB[kind]);
const expo = (rng) => -Math.log(1 - rng() * 0.999999);

/**
 * pools: { flock, out } voice pools; E: the engine voice (motorbike / truck); S: the engine state;
 * pan(dx, dz): stereo position of a point relative to the farmer and the camera.
 */
export function createScheduler({ pools, E, S, rng, pan, note = () => {} }) {
  const u = { chirp: expo(rng), distress: expo(rng), snick: expo(rng), rattle: expo(rng), flutter: expo(rng), burst: 0,
    bird: expo(rng), moto: expo(rng), dog: expo(rng), frog: expo(rng), gecko: expo(rng) };
  const bird = { rep: 0, at: 0, kind: 0, pan: 0, last: -1 };
  const rates = {};
  const B = { x: 0, z: 0 };
  const burst = { left: 0, x: 0, z: 0 };

  /** a drawn bird to sound from: of two random birds the nearer (you hear the near ones) */
  function source() {
    if (!S.pickBird || !S.pickBird(rng, B)) return -1;
    let x = B.x, z = B.z, d = Math.hypot(x - S.x, z - S.z);
    if (S.pickBird(rng, B)) { const d2 = Math.hypot(B.x - S.x, B.z - S.z); if (d2 < d) { x = B.x; z = B.z; d = d2; } }
    B.x = x; B.z = z;
    return d;
  }
  const ON = { flock: true, out: true };
  function flockEvent(kind, t, M) {
    const d = source();
    if (d < 0) return;
    let ok = false;
    const w = nearWeight(d), p = pan(B.x - S.x, B.z - S.z);
    const near = 0.3 + 0.7 * Math.sqrt(w), age = M.age, P = pools.flock;
    if (kind === 'chirp') { // contented calls: habituated (M.habit) after a minute among a calm flock
      const h = near * (M.habit ?? 1);
      if (age > 0.55 && rng() < (age - 0.55) / 0.45) ok = V.cluck(P, t, peak('cluck', 'flock') * h, p, range(rng, 360, 470), rng);
      else ok = V.chirp(P, t, peak('chirp', 'flock') * h, p, lerp(3900, 2400, Math.min(1, age / 0.55)), rng);
    } else if (kind === 'distress') ok = V.distressPeep(P, t, peak('distress', 'distress') * near, p, lerp(4100, 1900, age), rng);
    else if (kind === 'snick') ok = V.snick(P, t, peak('snick', 'snick') * near, p, rng);
    else if (kind === 'rattle') ok = V.rattle(P, t, peak('rattle', 'snick') * near, p, rng);
    else if (kind === 'flutter') ok = V.flutter(P, t, peak('flutter', 'pant') * near, p, rng);
    if (ok) note(kind, t);
  }

  function sing(at, first) {
    const g = range(rng, 0.35, 1), P = pools.out;
    bird.at = bird.kind === 2 ? range(rng, 1.8, 3.2) : range(rng, 0.7, 2.2);
    let ok;
    if (bird.kind === 0) ok = V.twitter(P, at, peak('twitter', 'birds') * g, bird.pan, rng);
    else if (bird.kind === 1) ok = V.bulbul(P, at, peak('bulbul', 'birds') * g, bird.pan, rng);
    else ok = V.dove(P, at, peak('dove', 'birds') * g, bird.pan, rng);
    if (ok && first) note('bird', at, bird.kind); // a phrase's first call (its repeats from the same branch follow it)
  }

  return {
    /** chicks spilling out of a tipped box stack at (x, z): a quick run of peeps from there */
    burst(x, z) { burst.left = 1.6; burst.x = x; burst.z = z; },
    clear() { burst.left = 0; bird.rep = 0; },
    /** dt real s; t = start time for anything scheduled now; M = flockMix(); A = ambientTargets(); on: { flock, out }
     *  (a layer slider at 0 schedules no event of its layer, PHASE5.md §2.6) */
    update(dt, t, M, A, on = ON) {
      // ---- the flock ----
      if (!on.flock) { u.chirp = u.distress = u.snick = u.rattle = u.flutter = 1; burst.left = 0; } else {
        if ((u.chirp -= M.chirp * dt) <= 0) { u.chirp = expo(rng); flockEvent('chirp', t, M); }
        if ((u.distress -= M.distress * dt) <= 0) { u.distress = expo(rng); flockEvent('distress', t, M); }
        if ((u.snick -= M.snick * dt) <= 0) { u.snick = expo(rng); flockEvent('snick', t, M); }
        if ((u.rattle -= M.rattle * dt) <= 0) { u.rattle = expo(rng); flockEvent('rattle', t, M); }
        if ((u.flutter -= M.flutter * dt) <= 0) { u.flutter = expo(rng); flockEvent('flutter', t, M); }
        if (burst.left > 0) {
          burst.left -= dt;
          if ((u.burst -= 13 * dt) <= 0) {
            u.burst = expo(rng);
            const x = burst.x + range(rng, -1, 1), z = burst.z + range(rng, -1, 1);
            const d = Math.hypot(x - S.x, z - S.z), g = peak('burst', 'flock') * A.flockAtten / (1 + d / 6);
            if (V.chirp(pools.flock, t, g, pan(x - S.x, z - S.z), range(rng, 3600, 4300), rng)) note('burst', t);
          }
        }
      }
      if (!on.out) { bird.rep = 0; return; }
      // ---- the yard: birds by day, then a bird repeating its phrase from the same branch ----
      const P = pools.out;
      if ((u.bird -= (birdRate(S.hour, S.weather) / 60) * dt) <= 0) {
        u.bird = expo(rng);
        const r = rng(), dawn = S.hour < 9;
        bird.kind = r < (dawn ? 0.4 : 0.3) ? 0 : r < 0.72 ? 1 : 2; // twitter, bulbul, dove
        if (bird.kind === bird.last && rng() < 0.5) bird.kind = pick(rng, 3, bird.last);
        bird.last = bird.kind;
        bird.pan = range(rng, -0.85, 0.85);
        bird.rep = Math.floor(rng() * (bird.kind === 2 ? 3 : 4));
        bird.at = 0;
        sing(t, true);
      } else if (bird.rep > 0 && (bird.at -= dt) <= 0) { bird.rep--; sing(t, false); }
      // ---- far off: a motorbike on the public road, a dog, frogs in the paddies, a gecko ----
      distantRates(S.hour, S.weather, rates);
      const m = dt / 60;
      if ((u.moto -= rates.moto * m) <= 0) { u.moto = expo(rng); if (V.motorbike(E, t, peak('moto', 'distant') * range(rng, 0.6, 1), rng)) note('moto', t); }
      if ((u.dog -= rates.dog * m) <= 0) { u.dog = expo(rng); if (V.dog(P, t, peak('dog', 'distant') * range(rng, 0.5, 1), range(rng, -0.9, 0.9), rng)) note('dog', t); }
      if ((u.frog -= rates.frog * m) <= 0) { u.frog = expo(rng); if (V.frog(P, t, peak('frog', 'distant') * range(rng, 0.5, 1), range(rng, -0.9, 0.9), rng)) note('frog', t); }
      if ((u.gecko -= rates.gecko * m) <= 0) { u.gecko = expo(rng); if (V.gecko(P, t, peak('gecko', 'distant') * range(rng, 0.5, 1), range(rng, -0.7, 0.7), rng)) note('gecko', t); }
    },
    /** a truck on the farm road (chicks, feed or the catching crew) */
    truck(t) { return V.motorbike(E, t, peak('truck', 'distant'), rng, true); },
    /** for the tests: the time before each source's next event, in units of its rate */
    get pending() { return u; },
    nextGap: (mean) => nextGap(rng, mean),
  };
}
