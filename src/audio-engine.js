// Sound layer engine: the node graph and the per-frame update. It runs on any BaseAudioContext, so the
// game plays it live (AudioContext) and scripts/p5-sound.json renders it offline (OfflineAudioContext)
// to measure each layer. audio.js fills `engine.S` from the game every frame and calls update(dt).
//
//   buses: outside (low-pass: muffled inside) · house · flock (low-pass and attenuation through the
//   walls) · cues; each -> its layer gain -> master (the volume) -> soft clipper -> destination, and a
//   send to one shared room reverb.
import { makeRng, dbToGain, gainToDb, LEVELS, indoorness, ambientTargets, flockLoudness, flockMix, surfaceAt,
  createStepTracker, stepHabituation, flockHabituation, flockSignature } from './audio-mix.js';
import { noiseBuffers, noiseSource, roomImpulse, clipperCurve, makeWaves, voicePool, gainNode, biquad, toward } from './audio-synth.js';
import { buildBeds } from './audio-beds.js';
import { createScheduler } from './audio-sched.js';
import * as V from './audio-voices.js';
import * as C from './audio-cues.js';
import { buildMachines, BED5_NAMES } from './audio-machines.js';
import { createScenes } from './audio-scenes.js';
import { createLimiter } from './audio-limit.js';
import { CAPS, layerGain, MACHINES, PLACES } from './audio-rules.js';
import { HOUSE } from './config.js';

export const LAYERS = ['outside', 'house', 'flock', 'cues'];
// Each cue: [its layer level in LEVELS, the recipe's gain over that level (dB), the shortest gap between
// two of a kind (audio-clock s)]. The gains are calibrated with scripts/p5-sound.json so a cue's loudest
// 100 ms sits at -34..-40 dBFS (the key click -56, the winch -49) with its peak at or under -22 dBFS.
const CUES = {
  door: ['cue', 21, 0.8], valve: ['cue', 15, 0.6], waterValve: ['cue', 14.5, 0.6], winch: ['cue', 15.5, 0.5],
  beep: ['cue', 3, 0.25], probe: ['cue', 3.5, 0.3], paper: ['cue', 15, 0.45], click: ['click', 20, 0.05],
  tick: ['tick', 11, 2.0], box: ['cue', 20, 1.2], bin: ['cue', 24.5, 0.8], squeeze: ['cue', 14, 0.5],
  alarm: ['cue', 3, 4], truck: ['cue', 0, 20],
  // Phase 5 (PHASE5.md §2.1): the office phone (two rings when a letter comes, a dial and line tone for a call), the pen on
  // the planning sheet (at most 4 a second), the transfer switch; the alarm is two-tone (audio-cues alarm2)
  ring: ['cue', -2, 2], dial: ['cue', -6, 2], pen: ['cue', -4, 0.25], clunk: ['cue', 2, 2],
};
const CUE_NAMES = Object.keys(CUES);
// footfalls: gain over LEVELS.steps; the loudest 100 ms of a walk at -42 (the foot dip) .. -47 dBFS, peaks <= -27
const STEP_DB = { gravel: 19, concrete: 20, litter: 14, grass: 13.5, dip: 19.5 };
const CONTROLLER = PLACES.controller;
const LAYER_SLIDER = { outside: 'background', house: 'background', flock: 'flock', cues: 'cues' };

/** opts: { rng | seed, lookahead (s ahead of the clock a sound starts), solo (a layer name: the others silent),
 *  calibrate (a bed alone at gain 1), log (event log size: the hour check), logRing (a live log that wraps) } */
export function createEngine(ac, opts = {}) {
  const rng = opts.rng || makeRng(opts.seed ?? ((Math.random() * 2 ** 31) | 0));
  const look = opts.lookahead ?? 0.04;
  // ---- graph ----
  const master = gainNode(ac, 1), clip = ac.createWaveShaper();
  clip.curve = clipperCurve();
  master.connect(clip); clip.connect(ac.destination);
  const reverb = ac.createConvolver();
  reverb.buffer = roomImpulse(ac, rng, 1.4, 1.05);
  const revRet = gainNode(ac, 0.42);
  reverb.connect(revRet); revRet.connect(master);
  const layer = {}, inBus = {}, lv = { outside: 1, house: 1, flock: 1, cues: 1 }, on = { out: true, flock: true, cues: true };
  const SEND = { outside: 0.5, house: 0.22, flock: 0.3, cues: 0.12 };
  for (const name of LAYERS) {
    const g = gainNode(ac, opts.solo && opts.solo !== name ? 0 : 1);
    const send = gainNode(ac, SEND[name]);
    g.connect(master); g.connect(send); send.connect(reverb);
    layer[name] = g;
  }
  const outLP = biquad(ac, 'lowpass', 14000, 0.5);
  outLP.connect(layer.outside); inBus.outside = outLP;
  inBus.house = layer.house;
  const flockLP = biquad(ac, 'lowpass', 16000, 0.5), flockAtt = gainNode(ac, 1);
  flockLP.connect(flockAtt); flockAtt.connect(layer.flock); inBus.flock = flockLP;
  inBus.cues = layer.cues;

  const nb = noiseBuffers(ac, rng, 4);
  const src = {
    white: noiseSource(ac, nb.white, 1, 0), white2: noiseSource(ac, nb.white, 0.93, 1.7),
    pink: noiseSource(ac, nb.pink, 1, 0.4), pink2: noiseSource(ac, nb.pink, 1.07, 2.6), brown: noiseSource(ac, nb.brown, 1, 1.1),
  };
  const waves = makeWaves(ac);
  const pools = {
    flock: voicePool(ac, inBus.flock, { tones: 5, noises: 3, waves, wave: 'peep', sources: [src.white, src.white2] }),
    out: voicePool(ac, inBus.outside, { tones: 3, noises: 2, waves, wave: 'whistle', sources: [src.white2, src.pink] }),
    cues: voicePool(ac, inBus.cues, { tones: 3, noises: 4, waves, wave: 'sine', sources: [src.white, src.white2, src.pink] }),
  };
  // the engine voice: a motorbike on the public road, a truck on the farm road
  const eo = ac.createOscillator(), eLP = biquad(ac, 'lowpass', 400, 0.9), eG = gainNode(ac, 0), eP = ac.createStereoPanner();
  eo.type = 'sawtooth'; eo.frequency.value = 60;
  eo.connect(eLP); eLP.connect(eG); eG.connect(eP); eP.connect(inBus.outside); eo.start();
  const E = { busy: 0, f: eo.frequency, cut: eLP.frequency, g: eG.gain, pan: eP.pan };

  // ---- state the game fills every frame (audio.js) ----
  const S = {
    x: 0, z: 0, inside: false, speed: 0, dist: -1, camYaw: 0, teleport: false, jump: false,
    hour: 10, weather: 'normal', rain: 0, fanSpin: 0, heaterLevel: 0, padOn: false, day: 1,
    snd: null, flockW: 0, pickBird: null, auger: 0, augerPan: 0, trickle: -1, powerOff: false, k: 0, outT: 26,
    // Phase 5: the storm, the wet eaves (world.weather.wet; farm minutes since the rain stopped), the season, the generator,
    // the catching night (the crew's place), the wash bay's machines (washer 1 at the bay, 2 in his hands), the well pump
    storm: false, wet: 0, dryMin: Infinity, cond: null, genRun: false, catching: false, crewX: NaN, crewZ: NaN,
    washer: 0, sprayer: false, scraper: false, pump: false,
  };
  const A = {}, M = { chirp: 0, distress: 0, chorus: 0, murmur: 0, pant: 0, flutter: 0, snick: 0, rattle: 0, age: 0, habit: 1 };
  function pan(dx, dz) {
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return 0;
    const rx = Math.cos(S.camYaw), rz = -Math.sin(S.camYaw); // the camera's right on the ground
    return ((dx * rx + dz * rz) / d) * 0.75 * Math.min(1, d / 2);
  }
  // every event is counted against its per-minute cap and logged (audio-limit.js; the hour check reads the log)
  const lim = createLimiter(CAPS, { logSize: opts.log ?? 0, ring: !!opts.logRing });
  const note = (kind, t, v = -1, db = 0, aux = 0) => { counts[kind] = (counts[kind] || 0) + 1; lim.note(kind, t, v, db, aux); };
  const capped = { allow: lim.allow, note, count: lim.count };
  const sched = createScheduler({ pools, E, S, rng, pan, note });
  const beds = buildBeds(ac, inBus, src, rng);
  const machines = buildMachines(ac, inBus, nb, src, rng, beds.gust);
  const scenes = createScenes({ pools, machines, S, rng, pan, lim: capped });
  const steps = createStepTracker();

  // ---- cues: a small ring (no allocation), played on the next update (dropped if the clock jumped) ----
  const QN = 32, qName = new Int16Array(QN), qX = new Float32Array(QN), qZ = new Float32Array(QN);
  let qHead = 0, qLen = 0;
  const lastAt = new Float64Array(CUE_NAMES.length).fill(-1e9);
  // what has played (tests and the steps files: a real key press, click or walk made its sound)
  const counts = { steps: 0, drip: 0, crate: 0, thunder: 0, genStart: 0, genStop: 0, scrape: 0 };
  for (const n of CUE_NAMES) counts[n] = 0;
  function cue(name, x = NaN, z = NaN) {
    const i = CUE_NAMES.indexOf(name);
    if (i < 0 || qLen >= QN) return false;
    const j = (qHead + qLen++) % QN;
    qName[j] = i; qX[j] = x; qZ[j] = z;
    return true;
  }
  function play(i, x, z, now) {
    const name = CUE_NAMES[i], c = CUES[name], lv = c[0], db = c[1], gap = c[2];
    const t = Math.max(now + look, lastAt[i] + gap);
    if (t > now + 0.6) return; // a flood of one kind (goto, a skip): the rest are dropped
    if (!on.cues || !lim.allow(name, t)) return; // a silent layer schedules nothing; the per-minute caps (PHASE5.md §2.2)
    let g = dbToGain(LEVELS[lv] + db), p = 0, rel = 0;
    if (Number.isFinite(x)) { const dx = x - S.x, dz = z - S.z, k = 1 + Math.hypot(dx, dz) / 6; p = pan(dx, dz); g /= k; rel = -gainToDb(k); }
    const P = pools.cues;
    let ok = false;
    switch (name) {
      case 'door': ok = V.door(P, t, g, rng); break;
      case 'valve': case 'waterValve': ok = V.valve(P, t, g, name === 'waterValve', rng, p); break;
      case 'winch': ok = V.winch(P, t, g, rng); break;
      case 'beep': case 'probe': ok = V.beep(P, t, g, name === 'probe', p); break;
      case 'paper': ok = V.paper(P, t, g, rng); break;
      case 'click': ok = V.click(P, t, g, rng); break;
      case 'tick': ok = V.tick(P, t, g, rng); break;
      case 'box': ok = V.thump(P, t, g, rng, false, p); if (Number.isFinite(x)) sched.burst(x, z); break;
      case 'bin': ok = V.thump(P, t, g, rng, true, p); break;
      case 'squeeze': ok = V.crackle(P, t, g, rng); break;
      case 'alarm': ok = C.alarm2(P, t, g, p); break;
      case 'truck': ok = sched.truck(t); break;
      case 'ring': ok = C.ring(P, t, g, p); break;
      case 'dial': ok = C.dial(P, t, g, rng); break;
      case 'pen': ok = C.pen(P, t, g, rng); break;
      case 'clunk': ok = C.clunk(P, t, g, rng); break;
    }
    if (ok) { lastAt[i] = t; note(name, t, -1, rel); }
  }

  /** calibration (audio-measure opts.calibrate): every bed silent but `name`, which plays at gain 1 */
  function calibrate(name) {
    for (const k of ['breeze', 'crickets', 'cicadas', 'fans', 'gas', 'roar', 'pad', 'rain']) A[k] = k === name ? 1 : 0;
    for (const k of ['murmur', 'pant']) M[k] = k === name ? 1 : 0;
    A.outCut = 14000; A.flockCut = 16000; A.flockAtten = 1; A.fanCut = 820; A.rainCut = 4000;
    S.auger = name === 'auger' ? 1 : 0; S.augerPan = 0; S.trickle = name === 'trickle' ? 0.5 : -1;
  }
  /** calibration of a Phase 5 bed: that one alone at its full target */
  function calibrate5(name, T) {
    const M = T.machine, i = MACHINES.indexOf(name);
    T.dayCic = name === 'dayCicadas' ? 1 : 0; T.crew = name === 'crew' ? 1 : 0; T.desk = name === 'deskFan' ? 1 : 0;
    T.storm = name === 'stormGust' ? 1 : 0; T.crewPan = 0;
    M.owner = i; M.gain = i >= 0 ? 1 : 0; M.pan = 0; M.inside = false; M.carried = false;
    if (name === 'stormGust') A.breeze = 1;
  }
  const atDoor = (x, z) => Math.abs(x - HOUSE.door.x) < 2.2 && Math.abs(z - HOUSE.door.z) < 4.5;
  let lastX = NaN, lastZ = NaN;
  let bedAcc = 0, bedNow = -1, lastInside = null, walkT = 0, lastStepAt = -1e9, habT = 0, habSig = -1;
  const lastBus = new Float64Array(4).fill(-1);
  let bedNow5 = -1;
  function update(dtIn) {
    const dt = Math.min(Math.max(dtIn || 0, 0), 0.25);
    const now = ac.currentTime, t = now + look;
    // cues queued since the last frame (none survive a clock jump: a skip is not the farmer's doing)
    while (qLen > 0) { const j = qHead; qHead = (qHead + 1) % QN; qLen--; if (!S.jump) play(qName[j], qX[j], qZ[j], now); }
    // the ear gets used to a contented flock in the house; a change in the flock, or a while outside, starts it over
    const sig = flockSignature(S.snd);
    if (sig !== habSig) { habSig = sig; habT = 0; }
    habT = S.k > 0.5 ? habT + dt : Math.max(0, habT - 4 * dt);
    // the place, the hour and the machines: ten times a second (of game steps and of the audio clock,
    // so a burst of steps in one task never piles automation up)
    if (((bedAcc -= dt) <= 0 && now - bedNow >= 0.05) || bedNow < 0 || S.teleport) {
      const first = bedNow < 0, tau = first ? 0.003 : 0.3;
      bedAcc = 0.1; bedNow = now;
      S.k = indoorness(S.x, S.z, S.inside);
      ambientTargets(S, A);
      flockMix(S.snd, flockLoudness(S.flockW), S.day, M);
      M.habit = flockHabituation(habT); M.murmur *= M.habit;
      if (opts.calibrate) calibrate(opts.calibrate);
      beds.update(now, A, M, S, first);
      const T = scenes.targets(now, first ? 0 : Math.max(0.05, Math.min(0.25, now - (bedNow5 < 0 ? now : bedNow5))));
      bedNow5 = now;
      if (opts.calibrate) calibrate5(opts.calibrate, T);
      machines.update(now, T, first);
      lastBus[0] = toward(outLP.frequency, A.outCut, now, tau, lastBus[0], 0.02);
      lastBus[1] = toward(flockLP.frequency, A.flockCut, now, tau, lastBus[1], 0.02);
      lastBus[2] = toward(flockAtt.gain, A.flockAtten, now, tau, lastBus[2]);
    }
    if (opts.calibrate) return; // one bed alone at full gain: no events, no steps
    sched.update(dt, t, M, A, on);
    scenes.update(dt, now, t, on);
    // footfalls, landing with the walk cycle; the house door when he passes it
    if (S.teleport) { steps.reset(); walkT = 0; sched.clear(); }
    const st = steps.update(dt, S.speed, S.dist >= 0 ? S.dist : S.speed * dt);
    walkT = S.speed > 0.5 ? walkT + dt : Math.max(0, walkT - 3 * dt);
    if (st && t >= lastStepAt + 0.14) {
      const surf = surfaceAt(S.x, S.z);
      const g = dbToGain(LEVELS.steps + STEP_DB[surf]) * stepHabituation(walkT);
      if (on.cues && V.footstep(pools.cues, t, g, st === 1 ? -0.07 : 0.07, surf, steps.run, rng)) { lastStepAt = t; note('step', t); counts.steps++; counts.surface = surf; }
      scenes.step(t, surf, on);
    }
    // through the door: in or out, with both this frame's and the last frame's place at the door (a teleport
    // between the yard and the house, or a long frame on a slow machine elsewhere, is no door)
    if (lastInside !== null && S.inside !== lastInside && !S.teleport && atDoor(S.x, S.z) && atDoor(lastX, lastZ)) play(CUE_NAMES.indexOf('door'), NaN, NaN, now);
    lastInside = S.inside; lastX = S.x; lastZ = S.z;
    // the controller's alarm in a power cut (its gap grows), drips, crates, thunder, the generator: audio-scenes.js
  }
  /** the layer sliders (PHASE5.md §2.6): outside and house x background², flock x flock², cues and footfalls x cues² */
  function setLayers(v = {}, tau = 0.05) {
    for (const name of LAYERS) {
      const x = v[LAYER_SLIDER[name]];
      lv[name] = x == null ? lv[name] : layerGain(x);
      const solo = opts.solo && opts.solo !== name ? 0 : 1;
      layer[name].gain.setTargetAtTime(lv[name] * solo, ac.currentTime, tau);
    }
    on.out = lv.outside > 0; on.flock = lv.flock > 0; on.cues = lv.cues > 0;
    return { ...lv };
  }

  return {
    ac, S, master, layer, pools, cue, update, counts, setLayers, lim, scenes, machines,
    /** a rumble of createThunderPlanner (audio-scenes.js) to start p.delay s from now */
    thunder: (p) => scenes.thunder(p, ac.currentTime + look),
    get layers() { return { ...lv }; },
    get on() { return { ...on }; },
    /** the master gain (the settings' volume over the default's, so the default is 1) */
    setVolume(g, tau = 0.06) { master.gain.setTargetAtTime(g, ac.currentTime, tau); },
    /** voices sounding at the context time t (tests: at most a handful) */
    voicesAt(t = ac.currentTime) { let n = 0; for (const k in pools) n += pools[k].busyAt(t); return n + (E.busy > t ? 1 : 0); },
    get targets() { return A; },
    get flock() { return M; },
  };
}
