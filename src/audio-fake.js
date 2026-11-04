// A stand-in for the Web Audio API, enough to build and drive src/audio-engine.js without sound: node tests
// (scripts/test-audio.mjs, scripts/test-audio-hour.mjs through scripts/fake-audio.mjs) and the browser's long-session
// counter (audio.debug.hour, src/audio-hour.js). It renders nothing: it counts nodes and automation calls, and keeps each
// param's last scheduled events so the tests can see what the engine asked for and when. Its clock moves by advance(dt).
class FakeParam {
  constructor(ctx, v = 0) { this.ctx = ctx; this.value = v; this.events = []; }
  _ev(type, v, t) {
    this.ctx.calls++;
    this.events.push([type, v, t]);
    if (this.events.length > 64) this.events.splice(0, this.events.length - 64);
    return this;
  }
  setValueAtTime(v, t) { return this._ev('set', v, t); }
  linearRampToValueAtTime(v, t) { return this._ev('lin', v, t); }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError('exponentialRampToValueAtTime needs a positive value');
    return this._ev('exp', v, t);
  }
  setTargetAtTime(v, t, tau) {
    if (!(tau >= 0)) throw new RangeError('setTargetAtTime needs a time constant >= 0');
    return this._ev('target', v, t);
  }
  cancelScheduledValues(t) { this.ctx.calls++; this.events = this.events.filter((e) => e[2] < t); return this; }
}

class FakeNode {
  constructor(ctx, params = {}) {
    this.ctx = ctx;
    ctx.nodes++;
    this.outputs = [];
    for (const [k, v] of Object.entries(params)) this[k] = new FakeParam(ctx, v);
  }
  connect(dest) { this.outputs.push(dest); return dest; }
  disconnect() { this.outputs.length = 0; }
}
class FakeSource extends FakeNode {
  start() { this.started = true; }
  stop() { this.started = false; }
}

export class FakeAudioContext {
  constructor({ sampleRate = 8000 } = {}) {
    this.sampleRate = sampleRate;
    this.currentTime = 0;
    this.state = 'running';
    this.nodes = 0;
    this.calls = 0;
    this.destination = new FakeNode(this);
  }
  createGain() { return new FakeNode(this, { gain: 1 }); }
  createStereoPanner() { return new FakeNode(this, { pan: 0 }); }
  createBiquadFilter() { const n = new FakeNode(this, { frequency: 350, Q: 1, gain: 0 }); n.type = 'lowpass'; return n; }
  createOscillator() {
    const n = new FakeSource(this, { frequency: 440, detune: 0 });
    n.type = 'sine';
    n.setPeriodicWave = (w) => { n.wave = w; };
    return n;
  }
  createBufferSource() { const n = new FakeSource(this, { playbackRate: 1 }); n.loop = false; n.buffer = null; return n; }
  createConvolver() { const n = new FakeNode(this); n.buffer = null; return n; }
  createWaveShaper() { const n = new FakeNode(this); n.curve = null; return n; }
  createPeriodicWave(real, imag) { return { real, imag }; }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => data[c] };
  }
  /** move the clock (the tests' stand-in for the audio thread) */
  advance(dt) { this.currentTime += dt; }
}
