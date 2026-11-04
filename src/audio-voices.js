// Sound layer, one-shot recipes: each one schedules automation on a pooled voice (audio-synth.js) and
// returns false when no voice is free (the sound is simply skipped: the mix never stacks up).
// P = a voice pool, t = start time (context clock), g = peak gain, pan = -1..1, rng = the engine's generator.
import { envelope, glide, grain } from './audio-synth.js';
import { range } from './audio-mix.js';

const BARKS = new Float64Array(4); // bark times, reused (no allocation per sound)
const panAt = (v, t, pan) => v.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);

// ---- the flock ----
/** A chick's contented twitter: short rising notes, sometimes two. */
export function chirp(P, t, g, pan, pitch, rng) {
  const two = rng() < 0.3;
  const v = P.take('tone', t, two ? 0.24 : 0.13);
  if (!v) return false;
  v.setWave('peep'); panAt(v, t, pan);
  const p = pitch * range(rng, 0.9, 1.1);
  glide(v.f, t, p * 0.8, t + 0.03, p * 1.12);
  v.f.exponentialRampToValueAtTime(p * 0.96, t + 0.075);
  envelope(v.g, t, g, 0.007, 0.028, 0.045);
  if (two) {
    const t2 = t + range(rng, 0.1, 0.13), p2 = p * range(rng, 1.02, 1.12);
    glide(v.f, t2, p2 * 0.85, t2 + 0.03, p2 * 1.1);
    envelope(v.g, t2, g * 0.8, 0.006, 0.022, 0.04);
  }
  return true;
}
/** A cold or hungry chick's distress peep: loud, long, falling. */
export function distressPeep(P, t, g, pan, pitch, rng) {
  const v = P.take('tone', t, 0.2);
  if (!v) return false;
  v.setWave('peep'); panAt(v, t, pan);
  const p = pitch * range(rng, 0.93, 1.07);
  glide(v.f, t, p * 1.28, t + 0.17, p * 0.78);
  envelope(v.g, t, g, 0.012, 0.085, 0.07);
  return true;
}
/** A grown bird's soft cluck (contented, low). */
export function cluck(P, t, g, pan, pitch, rng) {
  const v = P.take('tone', t, 0.17);
  if (!v) return false;
  v.setWave('cluck'); panAt(v, t, pan);
  const p = pitch * range(rng, 0.9, 1.1);
  glide(v.f, t, p, t + 0.12, p * 0.84);
  envelope(v.g, t, g, 0.005, 0.03, 0.1);
  return true;
}
/** Snicking: a short sneeze-like "tchk", sometimes a smaller second one. */
export function snick(P, t, g, pan, rng) {
  const v = P.take('noise', t, 0.08);
  if (!v) return false;
  panAt(v, t, pan);
  v.q.setValueAtTime(2.4, t);
  glide(v.f, t, range(rng, 3600, 4600), t + 0.025, 2100);
  grain(v.g, t, g, 0.03, 0.002);
  if (rng() < 0.45) grain(v.g, t + 0.04, g * 0.45, 0.018, 0.002);
  return true;
}
/** A wet rattle in the breathing (rales): a few low, quick pulses. */
export function rattle(P, t, g, pan, rng) {
  const v = P.take('noise', t, 0.3);
  if (!v) return false;
  panAt(v, t, pan);
  v.q.setValueAtTime(4, t);
  v.f.setValueAtTime(range(rng, 560, 760), t);
  for (let i = 0; i < 5; i++) grain(v.g, t + i * 0.045, g * (1 - i * 0.12), 0.03, 0.004);
  return true;
}
/** Wings fluttering (hot birds shift and lift their wings). */
export function flutter(P, t, g, pan, rng) {
  const v = P.take('noise', t, 0.46);
  if (!v) return false;
  panAt(v, t, pan);
  v.q.setValueAtTime(0.8, t);
  v.f.setValueAtTime(range(rng, 1000, 1500), t);
  const rate = range(rng, 15, 19);
  for (let i = 0; i < 7; i++) grain(v.g, t + i / rate, g * range(rng, 0.55, 1), 0.04, 0.006);
  return true;
}

// ---- the yard ----
/** A small bird's twitter: 2-5 quick whistled notes. */
export function twitter(P, t, g, pan, rng) {
  const n = 2 + Math.floor(rng() * 4);
  const v = P.take('tone', t, n * 0.15);
  if (!v) return false;
  v.setWave('whistle'); panAt(v, t, pan);
  let s = t;
  for (let i = 0; i < n; i++) {
    const d = range(rng, 0.045, 0.085), f0 = range(rng, 2900, 5200), f1 = f0 * range(rng, 0.8, 1.3);
    glide(v.f, s, f0, s + d, f1);
    envelope(v.g, s, g * range(rng, 0.6, 1), 0.006, d * 0.4, d * 0.5);
    s += d + range(rng, 0.03, 0.06);
  }
  return true;
}
/** A spotted dove's "coo-crroo-coo" from a tree. */
export function dove(P, t, g, pan, rng) {
  const v = P.take('tone', t, 1.25);
  if (!v) return false;
  v.setWave('whistle'); panAt(v, t, pan);
  const p = range(rng, 470, 540);
  glide(v.f, t, p * 0.96, t + 0.16, p);
  envelope(v.g, t, g * 0.8, 0.03, 0.08, 0.06);
  const t2 = t + 0.26;
  glide(v.f, t2, p * 1.06, t2 + 0.36, p * 0.98);
  for (let i = 0; i < 6; i++) grain(v.g, t2 + i * 0.06, g * (0.7 + 0.3 * Math.sin(i)), 0.044, 0.012); // the "crr"
  const t3 = t2 + 0.46;
  glide(v.f, t3, p * 0.92, t3 + 0.28, p * 0.86);
  envelope(v.g, t3, g * 0.75, 0.04, 0.1, 0.12);
  return true;
}
/** A bulbul's bubbly whistle: three or four notes with jumps. */
export function bulbul(P, t, g, pan, rng) {
  const n = 3 + (rng() < 0.5 ? 1 : 0);
  const v = P.take('tone', t, n * 0.17);
  if (!v) return false;
  v.setWave('whistle'); panAt(v, t, pan);
  let s = t, f = range(rng, 1500, 2100);
  for (let i = 0; i < n; i++) {
    const d = range(rng, 0.07, 0.12), f1 = f * range(rng, 1.05, 1.35);
    glide(v.f, s, f, s + d, f1);
    envelope(v.g, s, g, 0.01, d * 0.5, d * 0.4);
    s += d + range(rng, 0.025, 0.05);
    f = range(rng, 1400, 2600);
  }
  return true;
}
/** A frog in the rice fields: two or three croaks of fast pulses. */
export function frog(P, t, g, pan, rng) {
  const n = 2 + (rng() < 0.4 ? 1 : 0);
  const v = P.take('noise', t, n * 0.5);
  if (!v) return false;
  panAt(v, t, pan);
  v.q.setValueAtTime(7, t);
  v.f.setValueAtTime(range(rng, 380, 520), t);
  const rate = range(rng, 34, 46);
  for (let c = 0; c < n; c++) {
    const s = t + c * range(rng, 0.38, 0.5);
    for (let i = 0; i < 8; i++) grain(v.g, s + i / rate, g * (0.6 + 0.4 * Math.sin((i / 7) * Math.PI)), 0.012, 0.003);
  }
  return true;
}
/** A tokay gecko on a wall far off: "to-kay", two to four times, each a little softer. */
export function gecko(P, t, g, pan, rng) {
  const n = 2 + Math.floor(rng() * 3);
  const v = P.take('tone', t, n * 0.85);
  if (!v) return false;
  v.setWave('cluck'); panAt(v, t, pan);
  for (let i = 0; i < n; i++) {
    const s = t + i * range(rng, 0.72, 0.82), k = g * Math.pow(0.82, i);
    glide(v.f, s, 880, s + 0.09, 640);
    envelope(v.g, s, k * 0.8, 0.006, 0.03, 0.06);
    glide(v.f, s + 0.16, 620, s + 0.4, 410);
    envelope(v.g, s + 0.16, k, 0.01, 0.1, 0.12);
  }
  return true;
}
/** A dog in the village: two or three barks. */
export function dog(P, t, g, pan, rng) {
  const n = 2 + (rng() < 0.45 ? 1 : 0);
  const v = P.take('tone', t, n * 0.6);
  if (!v) return false;
  v.setWave('cluck'); panAt(v, t, pan);
  let s = t;
  for (let i = 0; i < n; i++) {
    const p = range(rng, 430, 560);
    BARKS[i] = s;
    glide(v.f, s, p, s + 0.11, p * 0.62);
    envelope(v.g, s, g * range(rng, 0.75, 1), 0.004, 0.03, 0.09);
    s += range(rng, 0.3, 0.55);
  }
  const b = P.take('noise', t, n * 0.6);
  if (b) { // the breath of each bark
    panAt(b, t, pan); b.q.setValueAtTime(1.4, t); b.f.setValueAtTime(1100, t);
    for (let i = 0; i < n; i++) grain(b.g, BARKS[i], g * 0.35, 0.08, 0.004);
  }
  return true;
}
/** A motorbike passing on the public road (E = the engine voice: sawtooth -> low-pass -> gain -> pan). */
export function motorbike(E, t, g, rng, truck = false) {
  if (E.busy > t) return false;
  const d = truck ? range(rng, 8, 10) : range(rng, 9, 13), mid = t + d * range(rng, 0.42, 0.55);
  E.busy = t + d + 0.05;
  const base = truck ? range(rng, 40, 48) : range(rng, 62, 74), dir = rng() < 0.5 ? -1 : 1;
  E.f.cancelScheduledValues(t); E.g.cancelScheduledValues(t); E.cut.cancelScheduledValues(t); E.pan.cancelScheduledValues(t);
  E.f.setValueAtTime(base, t);
  E.f.linearRampToValueAtTime(base * (truck ? 1.1 : 1.35), mid);
  E.f.linearRampToValueAtTime(base * (truck ? 0.98 : 1.08), mid + 0.6); // the pitch drops as it passes
  E.f.linearRampToValueAtTime(base * (truck ? 0.95 : 1.15), t + d);
  E.cut.setValueAtTime(truck ? 180 : 300, t);
  E.cut.linearRampToValueAtTime(truck ? 340 : 820, mid);
  E.cut.linearRampToValueAtTime(truck ? 200 : 320, t + d);
  E.g.setValueAtTime(0, t);
  E.g.linearRampToValueAtTime(g, mid);
  E.g.linearRampToValueAtTime(0, t + d);
  E.pan.setValueAtTime(-0.8 * dir, t);
  E.pan.linearRampToValueAtTime(0.8 * dir, t + d);
  return true;
}

// ---- what the farmer does ----
/** One footfall on a surface; run = 0..1 (louder and shorter). */
export function footstep(P, t, g, pan, surface, run, rng) {
  const v = P.take('noise', t, 0.24);
  if (!v) return false;
  panAt(v, t, pan);
  const k = g * (1 + 0.35 * run) * range(rng, 0.8, 1.1);
  if (surface === 'gravel') {
    v.q.setValueAtTime(0.9, t); v.f.setValueAtTime(range(rng, 2200, 3000), t);
    let s = t;
    for (let i = 0; i < 3; i++) s = grain(v.g, s, k * range(rng, 0.55, 1), range(rng, 0.016, 0.026), 0.004) + range(rng, 0.002, 0.012); // grains never overlap on one voice
  } else if (surface === 'concrete') {
    v.q.setValueAtTime(1.1, t); glide(v.f, t, range(rng, 1300, 1700), t + 0.05, 900);
    envelope(v.g, t, k, 0.005, 0.01, 0.055);
  } else if (surface === 'litter') {
    v.q.setValueAtTime(0.7, t); v.f.setValueAtTime(range(rng, 3600, 4800), t);
    envelope(v.g, t, k * 0.8, 0.012, 0.02, 0.09 - 0.03 * run);
  } else if (surface === 'dip') {
    v.q.setValueAtTime(1.4, t); glide(v.f, t, 600, t + 0.16, range(rng, 1200, 1500));
    envelope(v.g, t, k * 1.2, 0.01, 0.04, 0.16);
  } else { // grass
    v.q.setValueAtTime(0.5, t); v.f.setValueAtTime(range(rng, 4400, 5800), t);
    envelope(v.g, t, k * 0.7, 0.02, 0.02, 0.11);
  }
  return true;
}
/** Through the house door: a soft thump of the boot on the sill and the steel leaf's faint ring. */
export function door(P, t, g, rng) {
  const v = P.take('noise', t, 0.3);
  if (!v) return false;
  v.q.setValueAtTime(0.7, t); v.f.setValueAtTime(160, t);
  envelope(v.g, t, g, 0.004, 0.02, 0.18);
  const r = P.take('tone', t, 0.5);
  if (r) { r.setWave('sine'); glide(r.f, t, range(rng, 370, 420), t + 0.4, 350); envelope(r.g, t + 0.005, g * 0.16, 0.002, 0, 0.42); }
  return true;
}
/** A valve or regulator turned: a dry creak; water valves let a soft rush through. */
export function valve(P, t, g, water, rng) {
  const v = P.take('tone', t, 0.5);
  if (!v) return false;
  v.setWave('cluck');
  glide(v.f, t, range(rng, 210, 260), t + 0.4, range(rng, 380, 460));
  for (let i = 0; i < 9; i++) grain(v.g, t + i * 0.044, g * range(rng, 0.45, 0.8), 0.034, 0.008);
  if (water) {
    const w = P.take('noise', t + 0.2, 0.8);
    if (w) { w.q.setValueAtTime(0.6, t + 0.2); w.f.setValueAtTime(950, t + 0.2); envelope(w.g, t + 0.2, g * 0.5, 0.15, 0.2, 0.4); }
  }
  return true;
}
/** A winch or ratchet cranked: a few even clicks. */
export function winch(P, t, g, rng) {
  const v = P.take('noise', t, 0.6);
  if (!v) return false;
  v.q.setValueAtTime(1.6, t); v.f.setValueAtTime(range(rng, 1900, 2500), t);
  const rate = range(rng, 8, 10);
  for (let i = 0; i < 5; i++) grain(v.g, t + i / rate, g * range(rng, 0.7, 1), 0.03, 0.004);
  return true;
}
/** An electronic beep (the scale; probe = the thermometer, higher and shorter). */
export function beep(P, t, g, probe = false) {
  const v = P.take('tone', t, 0.14);
  if (!v) return false;
  v.setWave('sine'); v.f.setValueAtTime(probe ? 2900 : 2050, t);
  envelope(v.g, t, g, 0.004, probe ? 0.03 : 0.075, 0.04);
  return true;
}
/** Paper: a board's sheet or a plate turned over, a page of the notebook. */
export function paper(P, t, g, rng) {
  const v = P.take('noise', t, 0.42);
  if (!v) return false;
  v.q.setValueAtTime(0.7, t);
  glide(v.f, t, range(rng, 2200, 2800), t + 0.15, range(rng, 3400, 4200));
  v.f.exponentialRampToValueAtTime(range(rng, 2400, 3000), t + 0.36);
  v.g.setValueAtTime(0, t);
  let s = t;
  for (let i = 0; i < 4; i++) { const d = range(rng, 0.05, 0.1); v.g.linearRampToValueAtTime(g * range(rng, 0.4, 1), s + d * 0.4); v.g.linearRampToValueAtTime(g * 0.15, s + d); s += d; }
  v.g.linearRampToValueAtTime(0, s + 0.04);
  return true;
}
/** A machine key pressed: the smallest click. */
export function click(P, t, g, rng) {
  const v = P.take('noise', t, 0.03);
  if (!v) return false;
  v.q.setValueAtTime(1.6, t); v.f.setValueAtTime(range(rng, 3400, 4200), t);
  grain(v.g, t, g, 0.014, 0.002);
  return true;
}
/** A job finished: one soft wood-block tick (never a fanfare, never a right / wrong sound). */
export function tick(P, t, g, rng) {
  const v = P.take('tone', t, 0.12);
  if (!v) return false;
  v.setWave('wood'); v.f.setValueAtTime(820 * range(rng, 0.98, 1.02), t);
  envelope(v.g, t, g, 0.0025, 0.004, 0.1);
  return true;
}
/** Cardboard: a stack of chick boxes tipped (the chicks' peeps come from the flock), or a bin lid (lid = true). */
export function thump(P, t, g, rng, lid = false) {
  const v = P.take('noise', t, 0.45);
  if (!v) return false;
  v.q.setValueAtTime(lid ? 1.2 : 0.6, t); v.f.setValueAtTime(lid ? 320 : range(rng, 200, 260), t);
  envelope(v.g, t, g, lid ? 0.003 : 0.02, lid ? 0.02 : 0.12, lid ? 0.2 : 0.25);
  return true;
}
/** A handful of litter squeezed: a few dry crackles. */
export function crackle(P, t, g, rng) {
  const v = P.take('noise', t, 0.3);
  if (!v) return false;
  v.q.setValueAtTime(0.9, t); v.f.setValueAtTime(range(rng, 3000, 3800), t);
  for (let i = 0, s = t; i < 4; i++, s += range(rng, 0.04, 0.07)) grain(v.g, s, g * range(rng, 0.5, 1), 0.03, 0.004);
  return true;
}
/** The controller's alarm after a power cut: three soft beeps. */
export function alarm(P, t, g) {
  const v = P.take('tone', t, 0.75);
  if (!v) return false;
  v.setWave('sine'); v.f.setValueAtTime(1750, t);
  for (let i = 0; i < 3; i++) envelope(v.g, t + i * 0.24, g, 0.005, 0.1, 0.03);
  return true;
}
