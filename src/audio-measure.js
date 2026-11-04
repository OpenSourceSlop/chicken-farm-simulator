// Sound layer, the level check: render a few seconds of the scene the game shows now with an
// OfflineAudioContext (no speakers, no user gesture needed) and report peak and RMS per layer.
// scripts/p5-sound.json calls it through __game.audio.debug.measure(opts) and checks the mix rule.
//
//   opts: { seconds = 6, skip = 1.5 (fade-ins left out), seed, volume = 1 (the default slider position),
//           state: { ... } engine.S overrides (place, hour, fans ...), walk: m/s (footfalls),
//           cues: [[name, atSeconds, x?, z?], ...], layers: ['mix', 'outside', 'house', 'flock', 'cues'],
//           calibrate: a bed's name (that bed alone at gain 1: audio-beds BED_CAL) }
//   -> { seconds, layers: { mix: { peakDb, rmsDb, rmsMaxDb, rms100Db, clipped, voices }, outside: ..., ... } }
// rmsDb: the whole render after `skip` (a bed's level); rmsMaxDb: the loudest 300 ms window; rms100Db: the
// loudest 100 ms (a short sound's level); voices: most pooled voices sounding at once (sampled every 50 ms).
import { createEngine, LAYERS } from './audio-engine.js';

const STEP = 0.05;
const dB = (meanSquare) => (meanSquare > 1e-12 ? +(10 * Math.log10(meanSquare)).toFixed(1) : -120);

export function levelStats(buf, skip) {
  const n = buf.length, rate = buf.sampleRate, s0 = Math.min(n - 1, Math.floor(skip * rate));
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const win = Math.floor(0.3 * rate), w1 = Math.floor(0.1 * rate), hop = Math.floor(0.02 * rate);
  let peak = 0, sum = 0, wsum = 0, wn = 0, wmax = 0;
  for (let i = s0; i < n; i++) {
    const a = L[i], b = R[i], e = a * a + b * b;
    sum += e; wsum += e; wn++;
    const m = a < 0 ? -a : a, m2 = b < 0 ? -b : b;
    if (m > peak) peak = m;
    if (m2 > peak) peak = m2;
    if (wn >= win) { if (wsum / (2 * wn) > wmax) wmax = wsum / (2 * wn); wsum = 0; wn = 0; }
  }
  // the loudest 100 ms (sliding, 20 ms hop): how loud a short sound is heard
  let m100 = 0;
  for (let i = s0; i + w1 <= n; i += hop) {
    let e = 0;
    for (let j = i; j < i + w1; j++) e += L[j] * L[j] + R[j] * R[j];
    if (e / (2 * w1) > m100) m100 = e / (2 * w1);
  }
  const count = Math.max(1, n - s0);
  return { peakDb: peak > 1e-6 ? +(20 * Math.log10(peak)).toFixed(1) : -120, rmsDb: dB(sum / (2 * count)), rmsMaxDb: dB(wmax),
    rms100Db: dB(m100), clipped: peak >= 0.99 };
}

/** readState(S): the adapter writes the game's current state into an engine's S (audio.js fill). */
export async function measure(readState, opts = {}) {
  const OAC = typeof window !== 'undefined' ? window.OfflineAudioContext || window.webkitOfflineAudioContext : null;
  if (!OAC) return { error: 'no OfflineAudioContext' };
  const sec = opts.seconds ?? 6, rate = opts.rate ?? 44100, skip = opts.skip ?? 1.5;
  const cues = (opts.cues || []).slice().sort((a, b) => a[1] - b[1]);
  const out = { seconds: sec, layers: {} };
  for (const name of opts.layers || ['mix', ...LAYERS]) {
    const ac = new OAC(2, Math.round(sec * rate), rate);
    const eng = createEngine(ac, { seed: opts.seed ?? 11, lookahead: 0.005, solo: name === 'mix' ? null : name, calibrate: opts.calibrate });
    eng.master.gain.value = opts.volume ?? 1;
    readState(eng.S);
    if (opts.state) Object.assign(eng.S, opts.state);
    let ci = 0, voices = 0;
    const tick = () => {
      if (opts.walk != null) { eng.S.speed = opts.walk; eng.S.dist = opts.walk * STEP; }
      while (ci < cues.length && cues[ci][1] <= ac.currentTime + 1e-6) { const c = cues[ci++]; eng.cue(c[0], c[2], c[3]); }
      eng.update(STEP);
      eng.S.teleport = false;
      const v = eng.voicesAt(ac.currentTime + 0.01);
      if (v > voices) voices = v;
    };
    for (let t = STEP; t < sec - 1e-6; t += STEP) ac.suspend(+t.toFixed(4)).then(() => { tick(); ac.resume(); });
    eng.S.teleport = true; // the first update sets every bed at once
    tick();
    const buf = await ac.startRendering();
    out.layers[name] = { ...levelStats(buf, skip), voices };
  }
  return out;
}
