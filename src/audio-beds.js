// Sound layer, continuous beds: the breeze, crickets and cicadas (outside bus); tunnel fans, gas
// brooders, the pad, rain on the roof and the feeder augers (house bus); the flow-test cup (cues bus);
// the grown flock's murmur and the panting (flock bus). Built once; update() only moves gains and
// filter cut-offs toward their targets (setTargetAtTime), at most ten times a second.
import { gainNode, biquad, lfo, toward } from './audio-synth.js';
import { dbToGain, nextGap, range } from './audio-mix.js';

// Each bed at full strength (its target 1) plays at BED_DB dBFS at the default volume (the mix rule:
// background -30..-36, the quiet machines lower). BED_RAW_DB is what each chain measures alone at gain 1
// (scripts/p5-sound.json, measure({ calibrate: name }), reverb included); re-measure it after changing a chain.
export const BED_DB = {
  breeze: -37, crickets: -39, cicadas: -40, fans: -32, gas: -40, roar: -43, pad: -39, rain: -34,
  auger: -36, trickle: -38, murmur: -37, pant: -41,
};
export const BED_RAW_DB = {
  breeze: -17.7, crickets: -18.2, cicadas: -17.4, fans: -13.5, gas: -5.8, roar: -15.2, pad: -16.0, rain: -17.9,
  auger: -14.5, trickle: -24.8, murmur: -28.3, pant: -20.4,
};
const lvl = (name) => dbToGain(BED_DB[name] - BED_RAW_DB[name]);

export function buildBeds(ac, bus, src, rng) {
  const out = (node, dest) => { node.connect(dest); return node; };
  // ---- outside ----
  const breeze = out(gainNode(ac, 0), bus.outside);
  const breezeLP = biquad(ac, 'lowpass', 600, 0.4), gust = gainNode(ac, 1);
  src.pink.connect(breezeLP); breezeLP.connect(gust); gust.connect(breeze);
  const leavesBP = biquad(ac, 'bandpass', 3200, 0.6), leaves = gainNode(ac, 0.12);
  src.white2.connect(leavesBP); leavesBP.connect(leaves); leaves.connect(gust);

  const crickets = out(gainNode(ac, 0), bus.outside);
  const cr = [[4650, 29, 2.6, -0.45], [4180, 34, 1.9, 0.5]].map(([f, pulse, rate, pan]) => {
    const o = ac.createOscillator(); o.frequency.value = f;
    const gp = gainNode(ac, 0.5), gc = gainNode(ac, 0.5), on = gainNode(ac, 0.7), p = ac.createStereoPanner();
    p.pan.value = pan;
    o.connect(gp); gp.connect(gc); gc.connect(on); on.connect(p); p.connect(crickets);
    lfo(ac, gp.gain, pulse, 0.5, 'square'); lfo(ac, gc.gain, rate, 0.5, 'square');
    o.start();
    return { on: on.gain, next: 0 };
  });
  const cicadas = out(gainNode(ac, 0), bus.outside);
  const cicBP = biquad(ac, 'bandpass', 6400, 4), cicAM = gainNode(ac, 0.8);
  src.white.connect(cicBP); cicBP.connect(cicAM); cicAM.connect(cicadas);
  lfo(ac, cicAM.gain, 47, 0.2);

  // ---- the house ----
  const fans = out(gainNode(ac, 0), bus.house);
  const fanLP = biquad(ac, 'lowpass', 800, 0.5), whooshBP = biquad(ac, 'bandpass', 230, 0.9), whoosh = gainNode(ac, 0.85);
  src.brown.connect(fanLP); fanLP.connect(fans);
  src.pink2.connect(whooshBP); whooshBP.connect(whoosh); whoosh.connect(fanLP);
  lfo(ac, whoosh.gain, 6.3, 0.15); // the blades' beat
  const hum = ac.createOscillator(), humG = gainNode(ac, 0.035);
  hum.frequency.value = 100; hum.connect(humG); humG.connect(fans); hum.start(); // 50 Hz mains: the motors hum at 100 Hz

  const gas = out(gainNode(ac, 0), bus.house), roar = out(gainNode(ac, 0), bus.house);
  const gasHP = biquad(ac, 'highpass', 3800, 0.6), roarLP = biquad(ac, 'lowpass', 150, 0.6);
  src.white.connect(gasHP); gasHP.connect(gas);
  src.brown.connect(roarLP); roarLP.connect(roar);

  const pad = out(gainNode(ac, 0), bus.house);
  const padBP = biquad(ac, 'bandpass', 2300, 0.8), padBody = biquad(ac, 'bandpass', 900, 0.9), padAM = gainNode(ac, 0.7);
  src.white2.connect(padBP); padBP.connect(padAM); src.pink.connect(padBody); padBody.connect(padAM); padAM.connect(pad);
  lfo(ac, padAM.gain, 5.3, 0.18); lfo(ac, padAM.gain, 7.9, 0.12);

  const rain = out(gainNode(ac, 0), bus.house);
  const rainLP = biquad(ac, 'lowpass', 4000, 0.5), rainHP = biquad(ac, 'highpass', 250, 0.5);
  src.pink2.connect(rainLP); rainLP.connect(rainHP); rainHP.connect(rain);

  const auger = gainNode(ac, 0), augerPan = ac.createStereoPanner();
  auger.connect(augerPan); augerPan.connect(bus.house);
  const motor = ac.createOscillator(), motorLP = biquad(ac, 'lowpass', 650, 0.7), motorG = gainNode(ac, 0.5);
  motor.type = 'sawtooth'; motor.frequency.value = 97;
  motor.connect(motorLP); motorLP.connect(motorG); motorG.connect(auger); motor.start();
  lfo(ac, motor.frequency, 0.7, 1.2);
  const feedBP = biquad(ac, 'bandpass', 1700, 1.1), feedAM = gainNode(ac, 0.5);
  src.white.connect(feedBP); feedBP.connect(feedAM); feedAM.connect(auger);
  lfo(ac, feedAM.gain, 11, 0.5, 'square'); // feed pellets rattling down the tube into the pans

  // ---- cues: water running into the flow-test cup (the note rises as the cup fills) ----
  const trickle = out(gainNode(ac, 0), bus.cues);
  const trickBP = biquad(ac, 'bandpass', 900, 5), trickAM = gainNode(ac, 0.7);
  src.white2.connect(trickBP); trickBP.connect(trickAM); trickAM.connect(trickle);
  lfo(ac, trickAM.gain, 17, 0.2); lfo(ac, trickAM.gain, 23.7, 0.1);

  // ---- the flock's beds (grown birds murmur; hot birds pant) ----
  const murmur = out(gainNode(ac, 0), bus.flock), pant = out(gainNode(ac, 0), bus.flock);
  const murBP = biquad(ac, 'bandpass', 480, 1.6), murAM = gainNode(ac, 0.65);
  src.pink.connect(murBP); murBP.connect(murAM); murAM.connect(murmur);
  lfo(ac, murAM.gain, 3.1, 0.2); lfo(ac, murAM.gain, 4.7, 0.15);
  const pantBP = biquad(ac, 'bandpass', 1500, 1.3), pantAM = gainNode(ac, 0.6);
  src.white2.connect(pantBP); pantBP.connect(pantAM); pantAM.connect(pant);
  lfo(ac, pantAM.gain, 4.4, 0.4);

  const last = new Float64Array(24).fill(-1);
  let gustAt = 0;
  return {
    /** A: ambientTargets(); F: flockMix(); s: the engine state (auger, augerPan, trickle); solo: layer gains are set by the engine. */
    update(now, A, F, s, snap = false) {
      const k = snap ? 0.01 : 1, T = 0.35 * k; // snap: the first update sets every bed at once
      last[0] = toward(breeze.gain, A.breeze * lvl('breeze'), now, T, last[0]);
      last[1] = toward(crickets.gain, A.crickets * lvl('crickets'), now, 1.2 * k, last[1]);
      last[2] = toward(cicadas.gain, A.cicadas * lvl('cicadas'), now, 1.2 * k, last[2]);
      const fanG = A.fans * lvl('fans');
      last[3] = toward(fans.gain, fanG, now, (fanG > last[3] ? 1.4 : 2.6) * k, last[3]); // spin-up quicker than the coast-down
      last[4] = toward(fanLP.frequency, A.fanCut, now, T, last[4], 0.02);
      last[5] = toward(gas.gain, A.gas * lvl('gas'), now, 0.6 * k, last[5]);
      last[6] = toward(roar.gain, A.roar * lvl('roar'), now, 0.6 * k, last[6]);
      last[7] = toward(pad.gain, A.pad * lvl('pad'), now, 0.8 * k, last[7]);
      last[8] = toward(rain.gain, A.rain * lvl('rain'), now, 1.5 * k, last[8]);
      last[9] = toward(rainLP.frequency, A.rainCut, now, T, last[9], 0.02);
      last[10] = toward(auger.gain, (s.auger || 0) * lvl('auger'), now, 0.25 * k, last[10]);
      last[11] = toward(augerPan.pan, s.augerPan || 0, now, 0.3 * k, last[11], 0.02);
      const fill = s.trickle;
      last[12] = toward(trickle.gain, fill >= 0 ? lvl('trickle') : 0, now, (fill >= 0 ? 0.08 : 0.15) * k, last[12]);
      if (fill >= 0) last[13] = toward(trickBP.frequency, 900 + 1500 * Math.min(1, fill), now, 0.2 * k, last[13], 0.01);
      last[14] = toward(murmur.gain, F.murmur * lvl('murmur'), now, 0.8 * k, last[14]);
      last[15] = toward(pant.gain, F.pant * lvl('pant'), now, 0.8 * k, last[15]);
      // the wind comes in gusts, the crickets stop and start: random targets every few seconds
      if (now >= gustAt) {
        gustAt = now + nextGap(rng, 4.5, 1.5, 12);
        gust.gain.setTargetAtTime(range(rng, 0.5, 1.3), now, range(rng, 0.8, 2.5));
        breezeLP.frequency.setTargetAtTime(range(rng, 350, 950), now, range(rng, 0.8, 2.5));
      }
      for (let i = 0; i < cr.length; i++) {
        const c = cr[i];
        if (now < c.next) continue;
        c.next = now + nextGap(rng, 6, 2, 16);
        c.on.setTargetAtTime(rng() < 0.22 ? 0 : range(rng, 0.35, 1), now, 0.4);
      }
    },
  };
}
