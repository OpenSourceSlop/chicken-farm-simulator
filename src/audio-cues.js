// Sound layer, Phase 5 one-shot recipes (PHASE5.md §2.1): automation on pooled voices (audio-synth.js), like
// audio-voices.js; each returns false when no voice is free (the sound is skipped, the mix never stacks up).
// P = a voice pool, t = start (context clock), g = peak gain, pan -1..1, rng = the engine's generator, v = the variant
// (audio-mix pick(): never the same twice in a row).
import { envelope, glide, grain } from './audio-synth.js';
import { range } from './audio-mix.js';

const panAt = (v, t, pan) => v.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
export const VARIANTS = { drip: 4, crate: 4, thunder: 4 };

/** A drop off the eaves after the rain: 0 a plink, 1 a plink and a smaller one, 2 a low plop in a puddle, 3 a tick on the gutter. */
export function drip(P, t, g, pan, v, rng) {
  const voice = P.take('tone', t, v === 1 ? 0.16 : 0.1);
  if (!voice) return false;
  panAt(voice, t, pan);
  if (v === 3) {
    voice.setWave('wood');
    voice.f.setValueAtTime(range(rng, 2300, 3100), t);
    envelope(voice.g, t, g * 1.05, 0.001, 0.003, 0.035);
    return true;
  }
  voice.setWave('sine');
  if (v === 2) {
    const f = range(rng, 650, 950);
    glide(voice.f, t, f * 1.25, t + 0.02, f * 0.8);
    voice.f.exponentialRampToValueAtTime(f * 1.35, t + 0.06);
    envelope(voice.g, t, g, 0.003, 0.012, 0.05);
    return true;
  }
  const f = range(rng, 1700, 2600);
  glide(voice.f, t, f, t + 0.014, f * 1.7);
  envelope(voice.g, t, g, 0.002, 0.006, 0.045);
  if (v === 1) {
    const t2 = t + range(rng, 0.05, 0.08), f2 = f * range(rng, 1.08, 1.25);
    glide(voice.f, t2, f2, t2 + 0.012, f2 * 1.6);
    envelope(voice.g, t2, g * 0.55, 0.002, 0.004, 0.04);
  }
  return true;
}

/** A catching crate (plastic, a wooden floor under it): 0 a knock, 1 set down, 2 the crate door snapping shut, 3 crates stacked. */
export function crate(P, t, g, pan, v, rng) {
  const n = P.take('noise', t, 0.34);
  if (!n) return false;
  panAt(n, t, pan);
  const body = P.take('tone', t, 0.2);
  if (body) { panAt(body, t, pan); body.setWave('wood'); }
  if (v === 0) {
    n.q.setValueAtTime(1.5, t); n.f.setValueAtTime(range(rng, 950, 1250), t);
    grain(n.g, t, g, 0.06, 0.002); grain(n.g, t + range(rng, 0.09, 0.12), g * 0.6, 0.05, 0.002);
    if (body) { body.f.setValueAtTime(range(rng, 480, 560), t); envelope(body.g, t, g * 0.5, 0.002, 0.004, 0.08); }
  } else if (v === 1) {
    n.q.setValueAtTime(1.2, t); n.f.setValueAtTime(range(rng, 600, 750), t); grain(n.g, t, g * 0.6, 0.09, 0.003);
    if (body) { body.f.setValueAtTime(range(rng, 380, 440), t); envelope(body.g, t, g * 0.42, 0.002, 0.006, 0.12); }
  } else if (v === 2) {
    n.q.setValueAtTime(2, t); n.f.setValueAtTime(range(rng, 1600, 2000), t); grain(n.g, t, g * 1.4, 0.045, 0.0015);
    if (body) { body.f.setValueAtTime(range(rng, 850, 980), t); envelope(body.g, t, g * 0.7, 0.0015, 0.003, 0.05); }
  } else {
    n.q.setValueAtTime(1.5, t); n.f.setValueAtTime(range(rng, 800, 1000), t);
    let s = t;
    for (let i = 0; i < 3; i++) s = grain(n.g, s, g * (1 - i * 0.2), 0.05, 0.002) + range(rng, 0.03, 0.05);
    if (body) { body.f.setValueAtTime(range(rng, 420, 500), t); envelope(body.g, t, g * 0.5, 0.002, 0.004, 0.09); }
  }
  return true;
}

/** The office phone: two soft electronic rings (a trill of two notes), 0.5 s apart. */
export function ring(P, t, g, pan) {
  const v = P.take('tone', t, 2.2);
  if (!v) return false;
  v.setWave('sine'); panAt(v, t, pan);
  for (let r = 0; r < 2; r++) {
    const s = t + r * 1.3;
    for (let i = 0; i < 28; i++) v.f.setValueAtTime(i % 2 ? 1060 : 860, s + i * (0.8 / 28));
    v.g.setValueAtTime(0, s);
    v.g.linearRampToValueAtTime(g, s + 0.03);
    v.g.setValueAtTime(g, s + 0.74);
    v.g.linearRampToValueAtTime(0, s + 0.8);
  }
  return true;
}

/** A phone call made: a few key tones, then the line's ringing tone (about 425 Hz) for a second. */
export function dial(P, t, g, rng) {
  const v = P.take('tone', t, 2.1);
  if (!v) return false;
  v.setWave('sine');
  const n = 5 + Math.floor(rng() * 3);
  let s = t;
  for (let i = 0; i < n; i++) {
    v.f.setValueAtTime(700 + 160 * Math.floor(rng() * 6), s);
    envelope(v.g, s, g * 0.7, 0.004, 0.06, 0.02);
    s += 0.07 + range(rng, 0.03, 0.07);
  }
  s += 0.2;
  v.f.setValueAtTime(425, s);
  envelope(v.g, s, g * 0.45, 0.01, 0.75, 0.04);
  return true;
}

/** A pen on the planning sheet: two to four short strokes. */
export function pen(P, t, g, rng) {
  const v = P.take('noise', t, 0.34);
  if (!v) return false;
  v.q.setValueAtTime(1, t); v.lp.setValueAtTime(9000, t);
  v.g.setValueAtTime(0, t);
  let s = t;
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const d = range(rng, 0.04, 0.065);
    v.f.setValueAtTime(range(rng, 3200, 4800), s);
    v.g.linearRampToValueAtTime(g * range(rng, 0.6, 1), s + 0.012);
    v.g.linearRampToValueAtTime(0, s + d);
    s += d + range(rng, 0.008, 0.02);
  }
  return true;
}

/** The scraper's blade on the litter, on a step. */
export function scrape(P, t, g, rng) {
  const v = P.take('noise', t, 0.3);
  if (!v) return false;
  v.q.setValueAtTime(0.9, t); glide(v.f, t, range(rng, 1300, 1700), t + 0.22, range(rng, 1800, 2200)); v.lp.setValueAtTime(6000, t);
  v.g.setValueAtTime(0, t);
  v.g.linearRampToValueAtTime(g, t + 0.05);
  v.g.linearRampToValueAtTime(g * 0.7, t + 0.15);
  v.g.linearRampToValueAtTime(0, t + 0.27);
  return true;
}

/** The generator's starter: about 1.2 s of cranking (compression strokes on a whirr), then it catches. */
export function crank(P, t, g, rng) {
  const w = P.take('tone', t, 1.35);
  if (!w) return false;
  w.setWave('cluck');
  glide(w.f, t, range(rng, 120, 135), t + 1.15, range(rng, 165, 185));
  w.g.setValueAtTime(0, t);
  const rate = range(rng, 5, 6);
  for (let i = 0, s = t; s < t + 1.15; i++, s = t + i / rate) {
    w.g.linearRampToValueAtTime(g * 0.5, s + 0.03);
    w.g.linearRampToValueAtTime(g * 0.22, s + 0.6 / rate);
  }
  w.g.linearRampToValueAtTime(0, t + 1.3);
  const n = P.take('noise', t, 1.35);
  if (n) {
    n.q.setValueAtTime(1.2, t); n.f.setValueAtTime(range(rng, 380, 460), t);
    let s = t;
    while (s < t + 1.1) s = grain(n.g, s, g * range(rng, 0.5, 0.8), 0.07, 0.006) + 1 / rate - 0.077;
    grain(n.g, t + 1.2, g, 0.1, 0.004); // it catches
  }
  return true;
}

/** The generator stopping: its last chugs as it runs down (the bed itself falls over 2 s). */
export function genStop(P, t, g, rng) {
  const w = P.take('tone', t, 1.4);
  if (!w) return false;
  w.setWave('cluck');
  glide(w.f, t, range(rng, 70, 80), t + 1.2, range(rng, 38, 44));
  const n = P.take('noise', t, 1.4);
  if (n) { n.q.setValueAtTime(0.8, t); n.f.setValueAtTime(range(rng, 420, 520), t); }
  let s = t + 0.1, k = 1;
  for (let i = 0; i < 5; i++, k *= 0.78) {
    envelope(w.g, s, g * k, 0.008, 0.02, 0.07);
    if (n) grain(n.g, s, g * 0.6 * k, 0.07, 0.006);
    s += 0.12 + i * 0.07;
  }
  return true;
}

/** The transfer switch thrown: one heavy clunk. */
export function clunk(P, t, g, rng) {
  const n = P.take('noise', t, 0.3);
  if (!n) return false;
  n.q.setValueAtTime(1, t); n.f.setValueAtTime(range(rng, 150, 200), t);
  envelope(n.g, t, g, 0.002, 0.012, 0.16);
  const w = P.take('tone', t, 0.24);
  if (w) { w.setWave('cluck'); glide(w.f, t, range(rng, 120, 140), t + 0.12, range(rng, 80, 95)); envelope(w.g, t, g, 0.002, 0.015, 0.16); }
  return true;
}

/** The controller's alarm in a power cut: two-tone beeps (high, low, high, low). */
export function alarm2(P, t, g, pan = 0) {
  const v = P.take('tone', t, 1.0);
  if (!v) return false;
  v.setWave('sine'); panAt(v, t, pan);
  for (let i = 0; i < 4; i++) {
    const s = t + i * 0.24;
    v.f.setValueAtTime(i % 2 ? 1310 : 1750, s);
    envelope(v.g, s, g, 0.005, 0.1, 0.03);
  }
  return true;
}
