// Sound layer, Web Audio building blocks: noise buffers, the room reverb, a soft safety clipper, the
// timbres, and pooled voices. Everything is built once when the engine starts: a one-shot sound is
// automation on a voice that is already running (no node is created per sound or per frame).
//
//   toneVoice:  oscillator -> gain -> stereo pan -> bus   (f, g, pan params; setWave(name))
//   noiseVoice: shared looping noise -> biquad -> gain -> stereo pan -> bus   (f, q, g, pan params)
//   pool.take(t0, dur): a voice free at t0 (its last envelope has ended), marked busy until t0 + dur; null if none

const MIN = 1e-4;

/** Looping noise buffers: white, pink (Paul Kellet's filter) and brown, `seconds` long. */
export function noiseBuffers(ac, rng, seconds = 4) {
  const n = Math.floor(ac.sampleRate * seconds);
  const white = ac.createBuffer(1, n, ac.sampleRate), pink = ac.createBuffer(1, n, ac.sampleRate), brown = ac.createBuffer(1, n, ac.sampleRate);
  const w = white.getChannelData(0), p = pink.getChannelData(0), b = brown.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const x = rng() * 2 - 1;
    w[i] = x * 0.9;
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
    br = (br + 0.02 * x) / 1.02;
    b[i] = br * 3.5;
  }
  // fade the loop seam over 10 ms so it never clicks
  const f = Math.floor(ac.sampleRate * 0.01);
  for (const d of [w, p, b]) for (let i = 0; i < f; i++) { const t = i / f; d[i] = d[i] * t + d[n - f + i] * (1 - t); }
  return { white, pink, brown };
}

/** A looping source of one noise buffer (started at once; playbackRate decorrelates beds sharing a buffer). */
export function noiseSource(ac, buffer, rate = 1, offset = 0) {
  const s = ac.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  s.playbackRate.value = rate;
  s.start(0, offset % buffer.duration);
  return s;
}

/** Stereo room impulse: a few early reflections and an exponential tail (`decay` s to -60 dB), darker as it fades. */
export function roomImpulse(ac, rng, seconds = 1.4, decay = 1.1) {
  const n = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / ac.sampleRate;
      const amp = Math.pow(10, (-3 * t) / decay);
      const k = 0.15 + 0.75 * Math.exp(-t / 0.35); // the tail loses its highs
      lp += k * ((rng() * 2 - 1) - lp);
      d[i] = lp * amp * 0.5;
    }
    for (let r = 0; r < 6; r++) { // early reflections from the walls
      const i = Math.floor(ac.sampleRate * (0.008 + rng() * 0.05));
      d[i] += (rng() < 0.5 ? -1 : 1) * (0.35 - r * 0.04);
    }
  }
  return buf;
}

/** Soft safety clipper: exactly linear up to |0.5| (-6 dBFS), then bends smoothly to 0.95. The mix never gets near it. */
export function clipperCurve(n = 4097) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= 0.5 ? a : 0.5 + 0.45 * Math.tanh((a - 0.5) / 0.45));
  }
  return c;
}

/** Timbres as Fourier series (sine terms): a chick's peep, a bird's whistle, a hen's cluck, a wood block. */
export function makeWaves(ac) {
  const wave = (amps) => {
    const real = new Float32Array(amps.length + 1), imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => { imag[i + 1] = a; });
    return ac.createPeriodicWave(real, imag, { disableNormalization: false });
  };
  return {
    peep: wave([1, 0.22, 0.1, 0.04]),
    whistle: wave([1, 0.06, 0.02]),
    cluck: wave([1, 0.7, 0.5, 0.42, 0.3, 0.22, 0.15, 0.1, 0.06]),
    wood: wave([1, 0, 0.42, 0, 0.12]),
    sine: wave([1]),
  };
}

function toneVoice(ac, bus, waves, name) {
  const osc = ac.createOscillator();
  osc.setPeriodicWave(waves[name]);
  osc.frequency.value = 440;
  const g = ac.createGain();
  g.gain.value = 0;
  const p = ac.createStereoPanner();
  osc.connect(g); g.connect(p); p.connect(bus);
  osc.start();
  let wave = name;
  return {
    kind: 'tone', busy: 0, f: osc.frequency, g: g.gain, pan: p.pan,
    setWave(n) { if (n !== wave && waves[n]) { wave = n; osc.setPeriodicWave(waves[n]); } },
  };
}

function noiseVoice(ac, src, bus) {
  const flt = ac.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = 1000;
  flt.Q.value = 1;
  const g = ac.createGain();
  g.gain.value = 0;
  const p = ac.createStereoPanner();
  src.connect(flt); flt.connect(g); g.connect(p); p.connect(bus);
  return { kind: 'noise', busy: 0, f: flt.frequency, q: flt.Q, g: g.gain, pan: p.pan, flt };
}

/** A pool of voices on one bus. take() only returns a voice whose last sound has ended. */
export function voicePool(ac, bus, { tones = 0, noises = 0, waves, wave = 'sine', sources = [] }) {
  const voices = [];
  for (let i = 0; i < tones; i++) voices.push(toneVoice(ac, bus, waves, wave));
  for (let i = 0; i < noises; i++) voices.push(noiseVoice(ac, sources[i % sources.length], bus));
  return {
    voices,
    take(kind, t0, dur) {
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        if (v.kind !== kind || v.busy > t0 - 0.002) continue;
        v.busy = t0 + dur + 0.01;
        v.g.cancelScheduledValues(t0); v.f.cancelScheduledValues(t0); v.pan.cancelScheduledValues(t0);
        if (v.q) v.q.cancelScheduledValues(t0);
        v.g.setValueAtTime(0, t0);
        return v;
      }
      return null;
    },
    /** voices sounding at time t (for the tests: never more than the pool) */
    busyAt(t) { let n = 0; for (const v of voices) if (v.busy > t) n++; return n; },
  };
}

// ---- envelopes and sweeps on pooled voices (all times absolute, in the context's clock) ----
/** Attack to `peak` in a, hold h, exponential release r (to -60 dB), then exactly 0. Returns the end time. */
export function envelope(g, t0, peak, a, h, r) {
  const p = Math.max(MIN, peak);
  g.setValueAtTime(0, t0);
  g.linearRampToValueAtTime(p, t0 + a);
  if (h > 0) g.setValueAtTime(p, t0 + a + h);
  g.exponentialRampToValueAtTime(p * 1e-3, t0 + a + h + r);
  g.setValueAtTime(0, t0 + a + h + r + 0.001);
  return t0 + a + h + r + 0.001;
}
/** Exponential glide f0 -> f1 between t0 and t1 (both > 0 Hz). */
export function glide(f, t0, f0, t1, f1) {
  f.setValueAtTime(Math.max(1, f0), t0);
  f.exponentialRampToValueAtTime(Math.max(1, f1), t1);
}
/** A short burst at t (attack a, decay d): grains of gravel, ratchet clicks, wing beats. Returns its end:
 *  the next grain on the same voice must start after it (overlapping automation would garble both). */
export function grain(g, t, peak, d, a = 0.0015) {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(Math.max(MIN, peak), t + a);
  g.exponentialRampToValueAtTime(Math.max(MIN, peak) * 1e-3, t + a + d);
  g.setValueAtTime(0, t + a + d + 0.001);
  return t + a + d + 0.001;
}

/** A gain node; `v` initial gain. */
export function gainNode(ac, v = 1) { const g = ac.createGain(); g.gain.value = v; return g; }
export function biquad(ac, type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
/** A running LFO (oscillator -> depth gain) connected to a param; returns the oscillator's frequency param and the depth gain. */
export function lfo(ac, param, rate, depth, type = 'sine') {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = rate;
  const d = gainNode(ac, depth);
  o.connect(d); d.connect(param);
  o.start();
  return { rate: o.frequency, depth: d.gain };
}
/** Move a param smoothly toward v (time constant tau s) unless it is already within eps of it. */
export function toward(param, v, now, tau, last, eps = 0.003) {
  if (last != null && Math.abs(last - v) <= eps * Math.max(1, Math.abs(v))) return last;
  param.setTargetAtTime(v, now, tau);
  return v;
}
