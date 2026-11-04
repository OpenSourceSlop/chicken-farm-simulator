// Sound layer, Phase 5 beds (PHASE5.md §2.1): built once at start-up with the others, on ONE shared noise source and
// ONE machine bed, so the graph stays under the 230-node ceiling (about 210 in all):
//   shared noise ─ BP ─ gain ──────────────────────────▶ the breeze's gust gain (storm gusts, outside)
//                ├ BP ─ AM (LFO) ─ bed ───────────────▶ outside   (the hot season's day cicadas)
//                ├ BP ×3 (formants) ─ syllables ─ bed ─ pan ─▶ house (the catching crew's murmur: voices, never words)
//                ├ BP ─ AM (LFO) ─ bed ───────────────▶ house     (the office desk fan)
//                └ BP ─ gN ┐
//   osc1 ─ g1 ─────────────┼─ LP ─ bed ─ pan ─────────▶ house     (the machine bed: generator, washer, sprayer, well pump,
//   osc2 ─ g2 ─────────────┘   osc1 ─ depth ─▶ gN.gain              idling truck: one at a time, the loudest at him)
//   brown noise ─ LP ─ gain ─ pan ───────────────────▶ outside   (thunder: one rumble at a time)
// update() moves gains, cut-offs and pitches toward targets at most ten times a second; the machine bed retunes only
// while it is silent (a 0.3 s crossfade through nothing when another machine takes it).
import { gainNode, biquad, lfo, toward, noiseSource } from './audio-synth.js';
import { dbToGain, nextGap, range, lerp, clamp } from './audio-mix.js';
import { MACHINES } from './audio-rules.js';
import { BED_DB, BED_RAW_DB } from './audio-beds.js';

// Each bed at its full target plays at BED5_DB dBFS at the default volume; BED5_RAW_DB is what each chain measures alone
// at gain 1 (scripts/p5-sound-scenes.json, measure({ calibrate: name })). The machine profiles are measured one by one.
export const BED5_DB = { dayCicadas: -42, crew: -40, deskFan: -45, stormGust: -48, generator: -34.3, washer: -37.5, sprayer: -42, pump: -44, truck: -40 };
export const BED5_RAW_DB = { dayCicadas: -18.9, crew: -21.2, deskFan: -20.6, stormGust: -15, generator: -9.6, washer: -14.5, sprayer: -19.3, pump: -14.3, truck: -11.8 };
const LVL = Object.fromEntries(Object.keys(BED5_DB).map((k) => [k, dbToGain(BED5_DB[k] - BED5_RAW_DB[k])]));
// the storm's gust band plays through the breeze's own gain (its swells): its level is set past that gain
LVL.stormGust /= dbToGain(BED_DB.breeze - BED_RAW_DB.breeze);
export const BED5_NAMES = Object.keys(BED5_DB);

// the machine bed's tunings (MACHINES order): pitches, waves, mix, the noise band, the firing rhythm on the noise, cut-offs
const PROFILES = {
  generator: { f1: 26, w1: 'sawtooth', f2: 78, w2: 'triangle', g1: 0.8, g2: 0.3, bp: 1100, q: 0.7, gN: 0.35, am: 0.3, lpOut: 2400, lpIn: 650 },
  washer: { f1: 124, w1: 'sawtooth', f2: 248, w2: 'triangle', g1: 0.3, g2: 0.12, bp: 3800, q: 0.6, gN: 0.85, am: 0, lpOut: 9000, lpIn: 9000 },
  sprayer: { f1: 60, w1: 'sine', f2: 120, w2: 'sine', g1: 0, g2: 0, bp: 4400, q: 1.1, gN: 1, am: 0, lpOut: 9000, lpIn: 9000 },
  pump: { f1: 100, w1: 'sawtooth', f2: 200, w2: 'sine', g1: 0.55, g2: 0.3, bp: 700, q: 1.5, gN: 0.15, am: 0, lpOut: 900, lpIn: 500 },
  truck: { f1: 34, w1: 'sawtooth', f2: 68, w2: 'triangle', g1: 0.8, g2: 0.3, bp: 900, q: 0.8, gN: 0.25, am: 0.3, lpOut: 700, lpIn: 420 },
};

export function buildMachines(ac, bus, nb, src, rng, gust) {
  const shared = noiseSource(ac, nb.white, 1.13, 2.9); // the one new noise source (PHASE5.md §2.1)
  const chain = (...nodes) => { for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]); return nodes[nodes.length - 1]; };
  // storm gusts: a wider, higher whoosh inside the breeze's own gusts
  const gustBP = biquad(ac, 'bandpass', 800, 0.45), gustG = gainNode(ac, 0);
  chain(shared, gustBP, gustG); gustG.connect(gust);
  // the hot season's day cicadas (its own bed, not the dusk one)
  const cicBP = biquad(ac, 'bandpass', 5400, 3.5), cicAM = gainNode(ac, 0.75), cic = gainNode(ac, 0);
  chain(shared, cicBP, cicAM, cic); cic.connect(bus.outside);
  lfo(ac, cicAM.gain, 41, 0.25);
  // the crew's murmur: three moving formants, a slow random syllable envelope
  const F = [[520, 1.5], [1400, 1.8], [2500, 2]].map(([f, q]) => { const b = biquad(ac, 'bandpass', f, q); shared.connect(b); return b; });
  const syl = gainNode(ac, 0), crew = gainNode(ac, 0), crewPan = ac.createStereoPanner();
  for (const b of F) b.connect(syl);
  chain(syl, crew, crewPan); crewPan.connect(bus.house);
  // the desk fan on the office porch
  const fanBP = biquad(ac, 'bandpass', 380, 0.5), fanAM = gainNode(ac, 0.85), desk = gainNode(ac, 0);
  chain(shared, fanBP, fanAM, desk); desk.connect(bus.house);
  lfo(ac, fanAM.gain, 7.6, 0.12);
  // the machine bed
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g1 = gainNode(ac, 0), g2 = gainNode(ac, 0);
  const mBP = biquad(ac, 'bandpass', 1100, 0.7), gN = gainNode(ac, 0), amD = gainNode(ac, 0);
  const mLP = biquad(ac, 'lowpass', 2400, 0.6), bed = gainNode(ac, 0), bedPan = ac.createStereoPanner();
  o1.type = 'sawtooth'; o1.frequency.value = 26; o2.type = 'triangle'; o2.frequency.value = 78;
  o1.connect(g1); o2.connect(g2); chain(shared, mBP, gN);
  o1.connect(amD); amD.connect(gN.gain);
  g1.connect(mLP); g2.connect(mLP); gN.connect(mLP); chain(mLP, bed, bedPan); bedPan.connect(bus.house);
  o1.start(); o2.start();
  // thunder
  const tLP = biquad(ac, 'lowpass', 300, 0.7), tG = gainNode(ac, 0), tPan = ac.createStereoPanner();
  chain(src.brown, tLP, tG, tPan); tPan.connect(bus.outside);

  const last = new Float64Array(16).fill(-1);
  let owner = -1, tuned = -1, retuneAt = 0, sylAt = 0, cicAt = 0, cicWave = 0.7, cicWant = 0.7, wanderAt = 0, wander = 0, wanderWant = 0;
  let pumpAt = 0, pulseUntil = 0, thunderEnd = 0, genState = 'off', genAt = 0, carried = false;
  function tune(i, now) {
    const p = PROFILES[MACHINES[i]];
    o1.type = p.w1; o2.type = p.w2;
    o1.frequency.cancelScheduledValues(now); o2.frequency.cancelScheduledValues(now);
    o1.frequency.setValueAtTime(p.f1, now); o2.frequency.setValueAtTime(p.f2, now);
    g1.gain.setValueAtTime(p.g1, now); g2.gain.setValueAtTime(p.g2, now);
    mBP.frequency.setValueAtTime(p.bp, now); mBP.Q.setValueAtTime(p.q, now);
    gN.gain.cancelScheduledValues(now); gN.gain.setValueAtTime(p.gN, now); amD.gain.setValueAtTime(p.am * p.gN, now);
    tuned = i; last[6] = -1; last[7] = -1;
  }
  return {
    /** T: targets of audio-scenes (machine { owner, gain, pan, inside }, dayCic, crew, crewPan, desk, storm) */
    update(now, T, snap = false) {
      const k = snap ? 0.01 : 1;
      last[0] = toward(gustG.gain, T.storm * LVL.stormGust, now, 1.2 * k, last[0]);
      // the cicadas swell and fade in waves of 20-60 s
      if (now >= cicAt) { cicAt = now + range(rng, 20, 60); cicWant = range(rng, 0.3, 1); }
      cicWave += (cicWant - cicWave) * (snap ? 1 : 0.012);
      if (T.calib) cicWave = 1; // calibration: the chain at its nominal level (no wave, no wander)
      last[1] = toward(cic.gain, T.dayCic * cicWave * LVL.dayCicadas, now, 2 * k, last[1]);
      // the crew: a syllable every 0.12-0.35 s, now and then a pause; the formants move with each
      if (T.crew > 0.005 && now >= sylAt) {
        const pause = rng() < 0.18;
        sylAt = now + (pause ? range(rng, 0.3, 1.0) : range(rng, 0.12, 0.35));
        syl.gain.setTargetAtTime(pause ? 0.2 : range(rng, 0.55, 1), now, range(rng, 0.08, 0.14));
        F[0].frequency.setTargetAtTime(range(rng, 420, 720), now, 0.05);
        F[1].frequency.setTargetAtTime(range(rng, 1100, 1900), now, 0.05);
        F[2].frequency.setTargetAtTime(range(rng, 2300, 2900), now, 0.05);
      }
      last[2] = toward(crew.gain, T.crew * LVL.crew, now, 0.6 * k, last[2]);
      last[3] = toward(crewPan.pan, Math.max(-0.5, Math.min(0.5, T.crewPan || 0)), now, 0.3 * k, last[3], 0.02); // a crowd: never hard to one side
      last[4] = toward(desk.gain, T.desk * LVL.deskFan, now, 0.5 * k, last[4]);
      // the machine bed: the owner's level, a slow +-1.5 dB wander over 20-90 s
      if (now >= wanderAt) { wanderAt = now + range(rng, 20, 90); wanderWant = range(rng, -1.5, 1.5); }
      wander += (wanderWant - wander) * (snap ? 1 : 0.01);
      if (T.calib) wander = 0;
      const M = T.machine;
      let want = M.owner;
      if (genState === 'stopping' && now < genAt) want = 0; // the generator runs down on the bed
      if (want !== owner) { owner = want; retuneAt = now + (snap || last[5] < 0.002 ? 0 : 0.3); }
      let g = 0;
      if (owner >= 0) {
        if (now >= retuneAt && tuned !== owner) tune(owner, now);
        const name = MACHINES[owner], p = PROFILES[name];
        if (tuned === owner && now >= retuneAt) {
          g = (name === 'generator' && genState === 'stopping' ? 0 : M.gain) * LVL[name] * dbToGain(wander);
          if (name === 'generator' && genState === 'starting' && now < genAt) g = 0; // the starter cranks first
          last[6] = toward(mLP.frequency, lerp(p.lpOut, p.lpIn, M.inside ? 1 : 0), now, 0.3 * k, last[6], 0.02);
          last[7] = toward(bedPan.pan, M.pan || 0, now, 0.3 * k, last[7], 0.02);
          if (name === 'sprayer' && now >= pumpAt) { // the hand pump: a stroke about once a second, never on a beat
            pumpAt = now + range(rng, 0.8, 1.25);
            gN.gain.setTargetAtTime(1, now, 0.08); gN.gain.setTargetAtTime(0.35, now + 0.35, 0.18);
          }
          if (name === 'washer' && (!!M.carried !== carried || (pulseUntil > 0 && now > pulseUntil))) { // his steps pulse the hiss
            carried = !!M.carried; pulseUntil = 0;
            gN.gain.setTargetAtTime(carried ? 0.4 : p.gN, now, 0.15);
          }
        }
      }
      if (genState === 'starting' && now >= genAt) { // it catches: a rev past its speed, then it settles
        genState = 'running';
        if (tuned === 0) { const f = o1.frequency; f.cancelScheduledValues(now); f.setValueAtTime(14, now); f.linearRampToValueAtTime(31, now + 0.5); f.linearRampToValueAtTime(26, now + 1.4); }
      }
      if (genState === 'stopping' && now >= genAt) genState = 'off';
      const tau = genState === 'stopping' ? 0.6 : owner >= 0 && retuneAt > now ? 0.08 : 0.4;
      last[5] = toward(bed.gain, g, now, tau * k, last[5]);
    },
    /** the washer in his hands: its hiss rises with each step (gN pulses) */
    stepPulse(t) {
      if (tuned < 0 || MACHINES[tuned] !== 'washer') return;
      gN.gain.setTargetAtTime(0.75, t, 0.04); pulseUntil = t + 0.12;
    },
    /** the generator catches at t + 1.2 (the starter cranks first: audio-cues crank) and revs up */
    genStart(t) { genState = 'starting'; genAt = t + 1.2; },
    /** the generator stops: its pitch and level run down over 2 s */
    genStop(t) {
      if (tuned !== 0) return;
      genState = 'stopping'; genAt = t + 2;
      o1.frequency.cancelScheduledValues(t); o1.frequency.setValueAtTime(26, t); o1.frequency.linearRampToValueAtTime(8, t + 2);
      o2.frequency.cancelScheduledValues(t); o2.frequency.setValueAtTime(78, t); o2.frequency.linearRampToValueAtTime(24, t + 2);
      bed.gain.cancelScheduledValues(t); bed.gain.setTargetAtTime(0, t, 0.6); last[5] = 0;
    },
    get genState() { return genState; },
    /** a rumble at t: th = thunderOf() { km, len, near }, g its peak, inside: through the roof (-6 dB, under 400 Hz); v the variant */
    thunder(t, th, g, inside, pan, v) {
      if (t < thunderEnd) return false;
      const len = th.len, roof = inside ? 400 : 20000, P = tG.gain, f = tLP.frequency;
      const top = Math.min(roof, th.near ? range(rng, 1400, 2000) : range(rng, 160, 240)); // a near one cracks first
      const body = Math.min(roof, th.near ? range(rng, 220, 340) : range(rng, 120, 200));
      P.cancelScheduledValues(t); f.cancelScheduledValues(t); tPan.pan.cancelScheduledValues(t);
      tPan.pan.setValueAtTime(clamp(pan, -0.8, 0.8), t);
      f.setValueAtTime(top, t); f.exponentialRampToValueAtTime(Math.max(60, body), t + (th.near ? 0.45 : 1.2));
      const peak = Math.max(1e-4, g * (inside ? 0.5 : 1) * (th.near ? 1 : 0.6));
      P.setValueAtTime(0, t);
      P.linearRampToValueAtTime(peak, t + (th.near ? 0.04 : range(rng, 0.3, 0.6)));
      // the roll: a few swells (the variant sets how many and where), then the tail
      const swells = [[0.35, 0.6, 0.85], [0.25, 0.45, 0.65, 0.8], [0.3, 0.5], [0.5, 0.7, 0.85]][v & 3];
      let s = t + (th.near ? 0.25 : 0.7);
      for (const a of swells) {
        const at = t + a * len;
        if (at <= s) continue;
        P.linearRampToValueAtTime(peak * range(rng, 0.25, 0.45), (s + at) / 2);
        P.linearRampToValueAtTime(peak * range(rng, 0.5, v === 2 ? 1 : 0.85), at);
        s = at;
      }
      P.exponentialRampToValueAtTime(Math.max(1e-5, peak * 1e-3), t + len);
      P.setValueAtTime(0, t + len + 0.01);
      thunderEnd = t + len + 0.05;
      return true;
    },
    get thunderBusy() { return thunderEnd; },
  };
}
