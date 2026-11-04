// Node tests for the sound layer (src/audio-*.js): the settings store, the pure mixer rules (where,
// when, how loud), the footfall cycle, and the engine itself on a fake Web Audio context
// (scripts/fake-audio.mjs): voice limits, rate limits under a burst of game steps, no automation when
// nothing changes. The real levels (dBFS per layer) are measured in the browser: scripts/p5-sound.json.
// Run: node scripts/test-audio.mjs   (also part of `npm test`)
import { createSoundSettings, volumeToGain, DEFAULT_VOLUME, SOUND_KEY } from '../src/audio-settings.js';
import { surfaceAt, indoorness, ambientTargets, birdRate, insectLevel, cicadaLevel, distantRates, flockLoudness, nearWeight,
  flockMix, flockVoice, createStepTracker, stepHabituation, makeRng, nextGap, pick, LEVELS, fanSpinOf, padFlowOf, CHIRP_MAX,
  flockHabituation, gainToDb } from '../src/audio-mix.js';
import { BED_DB } from '../src/audio-beds.js';
import { createEngine } from '../src/audio-engine.js';
import { voicePool, makeWaves } from '../src/audio-synth.js';
import * as V from '../src/audio-voices.js';
import { FakeAudioContext } from './fake-audio.mjs';
import { HOUSE, FARM, HEATERS } from '../src/config.js';
import { createSim } from '../src/sim.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- settings ----
function memStore(init = {}) { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }

test('settings: defaults, saved and read back, mute toggles, subscribers hear it', () => {
  const st = memStore();
  const s = createSoundSettings({ storage: st });
  assert(s.volume === DEFAULT_VOLUME && !s.muted, 'defaults');
  assert(near(s.gain(), volumeToGain(DEFAULT_VOLUME), 1e-9), 'gain at the default');
  const heard = [];
  const off = s.subscribe((x) => heard.push(x));
  s.set({ volume: 0.4 }); s.toggleMute();
  assert(heard.length === 2 && heard[1].muted === true, `subscribers: ${JSON.stringify(heard)}`);
  assert(s.gain() === 0, 'muted gain is 0');
  off(); s.toggleMute();
  assert(heard.length === 2, 'unsubscribed');
  const s2 = createSoundSettings({ storage: st });
  assert(near(s2.volume, 0.4, 1e-9) && s2.muted === false, `read back ${JSON.stringify(s2.state())}`);
  s2.set({ volume: 7 });
  assert(s2.volume === 1, 'clamped to 1');
});

test('settings: a storage that throws or holds rubbish never breaks the game', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createSoundSettings({ storage: bad });
  s.set({ volume: 0.2, muted: true });
  assert(s.volume === 0.2 && s.muted, 'still works in memory');
  const junk = createSoundSettings({ storage: memStore({ 'chicken-farm.sound': '{not json' }) });
  assert(junk.volume === DEFAULT_VOLUME, 'rubbish: defaults');
  const none = createSoundSettings({ storage: null });
  none.toggleMute();
  assert(none.muted, 'no storage: in memory');
  assert(volumeToGain(0) === 0 && volumeToGain(1) === 1 && volumeToGain(0.5) < volumeToGain(0.7), 'volume curve');
  assert(SOUND_KEY.code === 'KeyU', 'the sound key is U (M is the moisture view in a level)');
});

// ---- where ----
test('surfaces: litter inside, concrete apron and door path, gravel road, grass yard, the foot dips', () => {
  assert(surfaceAt(-10, 0) === 'litter' && surfaceAt(20, -5) === 'litter', 'inside');
  assert(surfaceAt(-14, 10) === 'concrete' && surfaceAt(0, 6.8) === 'concrete' && surfaceAt(25, 0) === 'concrete', 'apron, path');
  for (const p of [[-40, 30], [-40, 18], [0, 14], [28, 14], [-40, 50]]) assert(surfaceAt(p[0], p[1]) === 'gravel', `road ${p}`);
  for (const p of [[-30, 30], [10, -20], [40, -30]]) assert(surfaceAt(p[0], p[1]) === 'grass', `yard ${p}`);
  assert(surfaceAt(FARM.footDipGate.x, FARM.footDipGate.z) === 'dip' && surfaceAt(FARM.footDipHouse.x, FARM.footDipHouse.z) === 'dip', 'dips');
});

test('the house door crossfades over about 3 m, smoothly; the walls do not', () => {
  const dx = HOUSE.door.x;
  let prev = 0, maxStep = 0;
  for (let z = 9; z >= 3; z -= 0.05) {
    const k = indoorness(dx, z, z < HOUSE.door.z);
    assert(k >= prev - 1e-9, `monotonic at z ${z.toFixed(2)}`);
    maxStep = Math.max(maxStep, k - prev);
    prev = k;
  }
  assert(maxStep < 0.06, `no jump through the door (largest step ${maxStep.toFixed(3)} per 5 cm)`);
  assert(indoorness(dx, 8, false) === 0 && indoorness(dx, 4.5, true) === 1, 'fully out 2 m out, fully in 1.5 m in');
  assert(indoorness(0, 5.9, true) === 1 && indoorness(0, 6.3, false) === 0, 'away from the door the wall separates');
});

// ---- when and how loud ----
const base = (o) => ({ x: -30, z: 30, k: 0, hour: 10, weather: 'normal', rain: 0, fanSpin: 0, heaterLevel: 0, padOn: false, ...o });
test('outside: breeze always, birds by day, crickets at night, cicadas at dusk; muffled indoors', () => {
  assert(birdRate(2) === 0 && birdRate(23) === 0 && birdRate(6.8) > birdRate(12) && birdRate(12) > 0, 'birds by day, a dawn chorus');
  assert(insectLevel(23) > 0.99 && insectLevel(3) > 0.99 && insectLevel(12) < 0.01, 'crickets at night');
  assert(cicadaLevel(18.5) > 0.9 && cicadaLevel(12) < 0.01, 'cicadas at dusk');
  const r = distantRates(12, 'normal');
  assert(r.moto > 0 && r.moto < 0.5 && r.dog < 0.5 && r.frog === 0 && r.gecko === 0, `rare by day ${JSON.stringify(r)}`);
  const out = ambientTargets(base({}), {}), inn = ambientTargets(base({ x: -10, z: 0, k: 1 }), {});
  assert(out.breeze > 0.9 && inn.breeze < 0.2 && inn.outCut < 1500, 'muffled through the walls');
  assert(out.fans === 0 && out.gas === 0 && out.pad === 0, 'no machine sounds when nothing runs');
});

test('the house: fans by count and place, gas under a burning brooder, the pad while its pump runs', () => {
  const at = (o) => ambientTargets(base({ x: 0, z: 0, k: 1, ...o }), {});
  assert(at({ fanSpin: 0 }).fans === 0, 'no fans, no hum');
  let last = 0;
  for (let n = 1; n <= 6; n++) { const f = at({ fanSpin: n / 6 }).fans; assert(f > last, `more fans louder (${n})`); last = f; }
  assert(at({ fanSpin: 1, x: 22 }).fans > at({ fanSpin: 1, x: -22 }).fans * 1.8, 'louder at the fan end');
  assert(at({ fanSpin: 1, x: 30, z: 0, k: 0 }).fans > at({ fanSpin: 1, x: -40, z: 30, k: 0 }).fans * 5, 'outside by the exhaust, not across the yard');
  const h = HEATERS[0];
  assert(at({ heaterLevel: 0 }).gas === 0, 'no gas while the brooders are off');
  assert(at({ heaterLevel: 1, x: h.x, z: h.z }).gas > 3 * at({ heaterLevel: 1, x: 15, z: 0 }).gas, 'the hiss is under the brooder');
  assert(at({ heaterLevel: 0.5, x: h.x, z: h.z }).gas < at({ heaterLevel: 1, x: h.x, z: h.z }).gas, 'with its output');
  assert(at({ padOn: false, x: -23 }).pad === 0 && at({ padOn: true, x: -23 }).pad > 0.8 && at({ padOn: true, x: 20 }).pad < 0.01, 'pad trickle at the pad end');
});

test('mix rule: every bed and layer level sits in the quiet band', () => {
  for (const [k, v] of Object.entries(BED_DB)) assert(v <= -30 && v >= -46, `bed ${k} ${v} dBFS`);
  for (const [k, v] of Object.entries(LEVELS)) assert(v <= -30 && v >= -46, `level ${k} ${v} dBFS`);
});

test('the flock: silent when empty, chirps when comfortable, loud peeps when cold, quiet panting when hot, snicks', () => {
  assert(flockLoudness(0) === 0 && flockLoudness(NaN) === 0, 'empty house: silent');
  assert(flockLoudness(100) < flockLoudness(600) && flockLoudness(600) < flockLoudness(1200) && near(flockLoudness(1200), 1, 0.01), 'nearer and more: louder');
  assert(flockLoudness(1e7) <= 1.15, 'capped');
  assert(nearWeight(0) === 1 && nearWeight(3) === 0.5 && nearWeight(10) < 0.1, 'near weight');
  const mix = (snd, day = 2, F = 1) => flockMix(snd, F, day, {});
  const silent = mix({ distress: 1, contented: 1, snick: 1, pant: 1 }, 2, 0);
  for (const [k, v] of Object.entries(silent)) if (k !== 'age') assert(v === 0, `empty: ${k} ${v}`);
  const ok = mix(flockVoice({ distress: 0, contented: 1, snick: 0 }, 0, 0, false));
  assert(ok.chirp > 1.5 && ok.chirp <= CHIRP_MAX && ok.distress === 0, `comfortable: a few chirps a second ${JSON.stringify(ok)}`);
  assert(mix(flockVoice({ distress: 0, contented: 1 }, 0, 0, false), 2, 1.15).chirp <= CHIRP_MAX, 'contentment capped near the birds');
  const cold = mix(flockVoice({ distress: 1, contented: 0, snick: 0 }, 0.6, 0, false));
  assert(cold.distress > 2 * ok.chirp && cold.chirp < 0.5, `cold ${JSON.stringify(cold)}`);
  // the sandbox's flock.sounds() counts hot birds as distress: flockVoice takes that back out
  const hotV = flockVoice({ distress: 1, contented: 0, snick: 0 }, 0, 0.7, false);
  const hot = mix(hotV);
  assert(hotV.distress === 0 && hot.pant > 0.6 && hot.chirp < 0.4 * ok.chirp, `hot ${JSON.stringify(hotV)} ${JSON.stringify(hot)}`);
  const thirsty = flockVoice({ distress: 0.6, contented: 0.4, snick: 0 }, 0.02, 0, false);
  assert(thirsty.distress > 0.4, `hungry or thirsty chicks still peep ${JSON.stringify(thirsty)}`);
  const sn = mix(flockVoice({ distress: 0, contented: 0.8, snick: 0.8 }, 0, 0, false));
  assert(sn.snick > 0.5 && ok.snick === 0, 'snicking only with a breathing problem');
  assert(flockVoice({ distress: 0, contented: 1 }, 0, 0, true).contented < 0.5, 'quieter in the dark');
  assert(mix({ contented: 1 }, 35).murmur > 0.5 && mix({ contented: 1 }, 2).murmur === 0, 'grown birds murmur');
});

test('the fans under the minimum ventilation timer: a steady hum at game speed, heard switching on a slow clock', () => {
  const env = createSim();
  env.setLevelClimate(true);
  const fanDb = () => gainToDb(ambientTargets(base({ x: 0, z: 0, k: 1, fanSpin: fanSpinOf(env) }), {}).fans);
  for (const [scale, fans] of [[120, 1], [480, 1], [120, 2], [30, 2]]) {
    env.setVentTimer({ fans, onSec: 60 * fans, cycleSec: 300 });
    env.timeScale = scale;
    let lo = Infinity, hi = -Infinity, on = 0, off = 0;
    for (let i = 0; i < 60 * 12; i++) {
      env.update(1 / 60);
      const d = fanDb();
      lo = Math.min(lo, d); hi = Math.max(hi, d);
      if (env.fansOn > env.fansManual) on++; else off++;
    }
    assert(on > 0 && off > 0, `${scale}x: the timer switched its fans (on ${on}, off ${off} frames)`);
    assert(Number.isFinite(lo) && hi - lo < 1, `${scale}x, ${fans} fan(s): the hum moves ${(hi - lo).toFixed(2)} dB through the cycles (under 1 dB)`);
  }
  env.setVentTimer({ fans: 1, onSec: 60, cycleSec: 300 });
  env.timeScale = 5; // a 300 s cycle over 60 real seconds: the switching is heard
  const seen = new Set();
  for (let i = 0; i < 60 * 70; i++) { env.update(1 / 60); seen.add(fanSpinOf(env)); }
  assert(seen.has(0) && seen.has(1 / 6), `a slow clock follows the timer: ${[...seen].map((v) => v.toFixed(3))}`);
  env.timeScale = 120; env.paused = true;
  assert(Math.abs(fanSpinOf(env) - 0.2 / 6) < 1e-9, 'a stopped clock: the mean');
  env.paused = false; env.setLevelClimate(false); env.setFans(3);
  assert(fanSpinOf(env) === 0.5, 'the sandbox: the fans switched on');
});

test('the pad: a part-clogged pad trickles less; no pump, no trickle', () => {
  const at = (padOn) => ambientTargets(base({ x: -23, z: 0, k: 1, padOn }), {}).pad;
  const full = at(padFlowOf({ padOn: true, padWorking: 1 })), part = at(padFlowOf({ padOn: true, padWorking: 0.3 }));
  assert(gainToDb(part) < gainToDb(full) - 3, `padWorking 0.3 ${gainToDb(part).toFixed(1)} dB vs 1 ${gainToDb(full).toFixed(1)} dB`);
  assert(at(padFlowOf({ padOn: false, padWorking: 1 })) === 0 && at(padFlowOf({ padOn: true })) === full && at(true) === full, 'off; the default share; a plain true');
});

test('a contented full house: a few chirps a second, softer after a minute; a change in the flock is heard fresh', () => {
  const { eng, frame } = rig({ birds: 1, S: { x: -14, z: 0, inside: true, flockW: 1e6, snd: { distress: 0, contented: 1, snick: 0, rattle: 0, pant: 0 } } });
  let n = 0;
  const take = eng.pools.flock.take;
  eng.pools.flock.take = (kind, t0, dur) => { const v = take(kind, t0, dur); if (v && kind === 'tone') n++; return v; };
  for (let i = 0; i < 60 * 60; i++) frame();
  assert(n >= 100 && n <= 60 * 3, `${n} chirps in a minute (at most 3 a second)`);
  assert(eng.flock.habit < 0.7 && eng.flock.habit > 0.6, `about 3.5 dB softer after a minute: ${gainToDb(eng.flock.habit).toFixed(1)} dB`);
  eng.S.snd = { distress: 1, contented: 0, snick: 0, rattle: 0, pant: 0 };
  for (let i = 0; i < 12; i++) frame();
  assert(eng.flock.habit === 1 && flockHabituation(0) === 1, 'cold peeping starts the ear over');
});

test('cues placed in the world pan to their side; the farmer\'s own cues are centred', () => {
  const { ac, eng, frame } = rig({ S: { x: -14, z: 0, inside: true, camYaw: 0, speed: 4 } });
  for (let i = 0; i < 90; i++) frame(); // footfalls leave the voices panned a little left and right
  eng.S.speed = 0;
  for (let i = 0; i < 60; i++) frame();
  const pans = (kind) => eng.pools.cues.voices.filter((v) => v.kind === kind && v.busy > ac.currentTime + 0.05)
    .map((v) => v.pan.events.filter((e) => e[0] === 'set').pop()[1]);
  eng.cue('box', -8, 0); frame();
  assert(pans('noise').length === 1 && pans('noise')[0] > 0.5, `a box tipped 6 m to his right: pan ${pans('noise')}`);
  for (let i = 0; i < 90; i++) frame();
  eng.cue('alarm', -20, 0); frame();
  assert(pans('tone').length === 1 && pans('tone')[0] < -0.5, `the alarm 6 m to his left: pan ${pans('tone')}`);
  for (let i = 0; i < 90; i++) frame();
  eng.cue('door'); frame();
  assert(pans('noise').length === 1 && pans('noise')[0] === 0 && pans('tone').every((p) => p === 0), `the door is centred: ${pans('noise')} ${pans('tone')}`);
});

test('every one-shot ends inside the time its voice is held (no fade cut off by the next sound)', () => {
  const ac = new FakeAudioContext(), rng = makeRng(9), src = ac.createBufferSource();
  const P = voicePool(ac, ac.destination, { tones: 3, noises: 4, waves: makeWaves(ac), sources: [src] });
  const recipes = {
    chirp: (t) => V.chirp(P, t, 0.1, 0, 3000, rng), distress: (t) => V.distressPeep(P, t, 0.1, 0, 3000, rng), cluck: (t) => V.cluck(P, t, 0.1, 0, 400, rng),
    snick: (t) => V.snick(P, t, 0.1, 0, rng), rattle: (t) => V.rattle(P, t, 0.1, 0, rng), flutter: (t) => V.flutter(P, t, 0.1, 0, rng),
    twitter: (t) => V.twitter(P, t, 0.1, 0, rng), dove: (t) => V.dove(P, t, 0.1, 0, rng), bulbul: (t) => V.bulbul(P, t, 0.1, 0, rng),
    frog: (t) => V.frog(P, t, 0.1, 0, rng), gecko: (t) => V.gecko(P, t, 0.1, 0, rng), dog: (t) => V.dog(P, t, 0.1, 0, rng),
    door: (t) => V.door(P, t, 0.1, rng), valve: (t) => V.valve(P, t, 0.1, false, rng), waterValve: (t) => V.valve(P, t, 0.1, true, rng),
    winch: (t) => V.winch(P, t, 0.1, rng), beep: (t) => V.beep(P, t, 0.1), probe: (t) => V.beep(P, t, 0.1, true), paper: (t) => V.paper(P, t, 0.1, rng),
    click: (t) => V.click(P, t, 0.1, rng), tick: (t) => V.tick(P, t, 0.1, rng), box: (t) => V.thump(P, t, 0.1, rng), bin: (t) => V.thump(P, t, 0.1, rng, true),
    squeeze: (t) => V.crackle(P, t, 0.1, rng), alarm: (t) => V.alarm(P, t, 0.1),
  };
  for (const s of ['gravel', 'concrete', 'litter', 'dip', 'grass']) recipes[`step ${s}`] = (t) => V.footstep(P, t, 0.1, 0, s, rng() < 0.5 ? 0 : 1, rng);
  let t = 1;
  for (let k = 0; k < 60; k++) for (const [name, play] of Object.entries(recipes)) {
    t += 5;
    assert(play(t), `${name} found a voice`);
    for (const v of P.voices) {
      if (v.busy <= t) continue;
      const end = Math.max(...v.g.events.map((e) => e[2]));
      assert(end <= v.busy - 0.01 + 1e-9, `${name}: its last gain change at +${(end - t).toFixed(3)} s, the voice held to +${(v.busy - 0.01 - t).toFixed(3)} s`);
    }
  }
});

// ---- footfalls ----
test('footfalls land with the walk cycle: about 3.2 a second walking, none standing', () => {
  const tr = createStepTracker();
  let n = 0, lastSide = 0, alternate = true;
  for (let i = 0; i < 600; i++) { const s = tr.update(1 / 60, 4); if (s) { n++; if (s === lastSide) alternate = false; lastSide = s; } }
  assert(n >= 29 && n <= 33, `walking 10 s: ${n} steps`);
  assert(alternate, 'left, right, left');
  let m = 0;
  for (let i = 0; i < 600; i++) if (tr.update(1 / 60, 0)) m++;
  assert(m <= 1, `standing: ${m}`);
  const run = createStepTracker();
  let r = 0;
  for (let i = 0; i < 600; i++) if (run.update(1 / 60, 6.5)) r++;
  assert(r >= 36 && r <= 42 && run.run > 0.9, `running 10 s: ${r}`);
  assert(stepHabituation(0) === 1 && stepHabituation(20) < 0.65 && stepHabituation(8) < 1, 'steps fade on a long walk');
});

test('randomness: gaps never fall into a beat, variants never repeat back to back', () => {
  const rng = makeRng(3);
  const gaps = Array.from({ length: 400 }, () => nextGap(rng, 5, 0.5, 30));
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  assert(near(mean, 5, 0.8) && sd / mean > 0.6, `gaps mean ${mean.toFixed(2)} cv ${(sd / mean).toFixed(2)}`);
  assert(Math.min(...gaps) >= 0.5 && Math.max(...gaps) <= 30, 'clipped');
  let last = -1;
  for (let i = 0; i < 300; i++) { const p = pick(rng, 3, last); assert(p !== last && p >= 0 && p < 3, 'pick'); last = p; }
});

// ---- the engine, on a fake Web Audio context ----
function rig(o = {}) {
  const ac = new FakeAudioContext();
  const eng = createEngine(ac, { seed: 5, lookahead: 0.02 });
  const birds = o.birds ?? 0;
  Object.assign(eng.S, { x: -30, z: 30, inside: false, speed: 0, hour: 10, weather: 'normal', day: 2, flockW: 0, snd: null,
    pickBird: birds ? (rng, out) => { out.x = -14 + (rng() - 0.5) * 20; out.z = (rng() - 0.5) * 10; return true; } : () => false }, o.S || {});
  const frame = (dt = 1 / 60, move = true) => { eng.update(dt); eng.S.teleport = false; eng.S.jump = false; if (move) ac.advance(dt); };
  return { ac, eng, frame };
}
const voicesOf = (pool, kind, t) => pool.voices.filter((v) => v.kind === kind && v.busy > t).length;

test('engine: builds once on a context, under 200 nodes', () => {
  const { ac, frame } = rig();
  const n = ac.nodes;
  assert(n > 50 && n < 200, `${n} nodes`);
  for (let i = 0; i < 600; i++) frame();
  assert(ac.nodes === n, `no node made after start-up (${ac.nodes - n} more)`);
});

test('engine: a quiet yard writes little automation per frame (no per-frame writes when nothing changes)', () => {
  const { ac, eng, frame } = rig();
  for (let i = 0; i < 120; i++) frame();
  const c0 = ac.calls;
  for (let i = 0; i < 3600; i++) frame(); // a minute of frames
  const per = (ac.calls - c0) / 3600;
  assert(per < 3, `${per.toFixed(2)} automation calls a frame`);
  assert(eng.voicesAt() <= 3, 'a few voices at most in the yard');
});

test('engine: a cold flock, a walking farmer: at most a handful of voices, nothing piles up', () => {
  const { ac, eng, frame } = rig({ birds: 1, S: { x: -14, z: 0, inside: true, speed: 4, flockW: 1500,
    snd: { distress: 1, contented: 0, snick: 0.6, rattle: 0.3, pant: 0 } } });
  let max = 0, sum = 0, n = 0;
  for (let i = 0; i < 60 * 60; i++) { frame(); const v = eng.voicesAt(ac.currentTime); max = Math.max(max, v); sum += v; n++; }
  assert(max <= 12 && sum / n <= 6, `voices max ${max}, mean ${(sum / n).toFixed(1)}`);
});

test('engine: a burst of game steps in one task (advance, a skip) cannot stack sounds', () => {
  const { ac, eng, frame } = rig({ birds: 1, S: { x: -14, z: 0, inside: true, speed: 4, flockW: 1500,
    snd: { distress: 1, contented: 0, snick: 1, rattle: 1, pant: 0 } } });
  for (let i = 0; i < 30; i++) frame();
  const t = ac.currentTime;
  for (let i = 0; i < 1800; i++) { eng.cue('tick'); eng.cue('door'); frame(1 / 30, false); } // 60 game s, the clock still
  const P = eng.pools;
  let latest = 0;
  for (const k of ['flock', 'cues', 'out']) for (const v of P[k].voices) latest = Math.max(latest, v.busy);
  assert(latest < t + 3.6, `nothing is queued into the future (last voice ends ${(latest - t).toFixed(2)} s on)`);
  assert(voicesOf(P.cues, 'tone', t) <= 3 && voicesOf(P.cues, 'noise', t + 0.03) <= 4, 'the cue pool holds');
});

test('engine: cues are rate limited and dropped when the clock jumps', () => {
  const { ac, eng, frame } = rig();
  frame();
  for (let i = 0; i < 40; i++) eng.cue('tick');
  frame();
  assert(voicesOf(eng.pools.cues, 'tone', ac.currentTime) === 1, 'forty job ticks at once: one tick');
  const r2 = rig();
  r2.frame();
  r2.eng.cue('tick'); r2.eng.cue('paper');
  r2.eng.S.jump = true;
  r2.frame();
  assert(voicesOf(r2.eng.pools.cues, 'tone', r2.ac.currentTime) === 0 && voicesOf(r2.eng.pools.cues, 'noise', r2.ac.currentTime) === 0, 'a skip drops the queued cues');
  assert(!r2.eng.cue('nope'), 'unknown cue refused');
});

test('engine: the door sounds when he walks through it, not when he is teleported', () => {
  const { ac, eng, frame } = rig({ S: { x: -14, z: 7, inside: false } });
  for (let i = 0; i < 10; i++) frame();
  const before = voicesOf(eng.pools.cues, 'noise', ac.currentTime + 0.03);
  Object.assign(eng.S, { z: 5.5, inside: true });
  frame();
  assert(voicesOf(eng.pools.cues, 'noise', ac.currentTime + 0.03) > before, 'door on the way in');
  const r = rig({ S: { x: -30, z: 30, inside: false } });
  for (let i = 0; i < 10; i++) r.frame();
  Object.assign(r.eng.S, { x: 0, z: 0, inside: true, teleport: true });
  r.frame();
  assert(voicesOf(r.eng.pools.cues, 'noise', r.ac.currentTime + 0.03) === 0, 'no door on a teleport');
});

test('engine: an empty house is silent (no flock voice in a minute)', () => {
  const { ac, eng, frame } = rig({ S: { x: -10, z: 0, inside: true, flockW: 0, snd: { distress: 0, contented: 0, snick: 0 } } });
  let busy = 0;
  for (let i = 0; i < 3600; i++) { frame(); busy = Math.max(busy, eng.pools.flock.busyAt(ac.currentTime)); }
  assert(busy === 0, `flock voices ${busy}`);
});

test('engine: footfalls by the walk cycle, spaced, on every surface', () => {
  for (const [x, z, inside] of [[-40, 25, false], [-14, 11, false], [-10, 0, true], [-30, 30, false]]) {
    const { eng, frame } = rig({ S: { x, z, inside, speed: 4 } });
    let starts = 0, prevBusy = 0;
    for (let i = 0; i < 600; i++) {
      frame();
      let b = 0;
      for (const v of eng.pools.cues.voices) if (v.kind === 'noise' && v.busy > b) b = v.busy;
      if (b > prevBusy + 0.05) starts++;
      prevBusy = Math.max(prevBusy, b);
    }
    assert(starts >= 25 && starts <= 34, `${x},${z}: ${starts} footfalls in 10 s`);
  }
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
