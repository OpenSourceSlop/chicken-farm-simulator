// Sound layer, the long-session check (PHASE5.md §2.2): the engine and the thunder planner driven through a scripted hour
// on a fake audio clock (audio-fake.js: nothing is rendered), then hourStats() checks what was played: every cap of §2.2 in
// every real minute, the gaps of every Poisson source (CV >= 0.6; thunder is flash-driven: its delays after each flash
// 1.5-7.9 s instead), no variant twice in a row, no node made after start-up, and the level table's loudest layers summed
// in every second under the checked bound (-16 dBFS). scripts/test-audio-hour.mjs runs it in node; audio.debug.hour(true)
// in the game.
import { createEngine } from './audio-engine.js';
import { createThunderPlanner } from './audio-scenes.js';
import { FakeAudioContext } from './audio-fake.js';
import { CAPS, MACHINES } from './audio-rules.js';
import { BED_DB } from './audio-beds.js';
import { BED5_DB } from './audio-machines.js';
import { makeRng, gainToDb } from './audio-mix.js';
import { maxPerMinute } from './audio-limit.js';
import { LOUDEST, layerOf, BED_CREST } from './audio-levels.js';

export const POISSON = ['chirp', 'distress', 'snick', 'rattle', 'flutter', 'bird', 'moto', 'dog', 'frog', 'gecko', 'drip', 'crate'];
export const VARIANT_KINDS = ['drip', 'crate', 'thunder'];
const contented = { distress: 0, contented: 1, snick: 0, rattle: 0, pant: 0 };
const birds = (rng, out) => { out.x = -20 + 40 * rng(); out.z = -5 + 10 * rng(); return true; };

/** The scripted hour (minutes): each segment sets the engine's state at its start; `at` lists timed changes (s). */
export const HOUR_SCRIPT = [
  { name: 'yard by day', min: 10, S: { x: -30, z: 30, inside: false, hour: 10, weather: 'normal', day: 20 }, walk: 1.4, clock: 1 },
  { name: 'the house, six fans', min: 10, S: { x: 6, z: 0, inside: true, hour: 13, day: 30, fanSpin: 1, padOn: 1, snd: contented, flockW: 1500, pickBird: birds }, walk: 1.2, clock: 1,
    at: [[300, { snd: { ...contented, contented: 0.6, snick: 0.6, rattle: 0.35 } }], [450, { snd: { ...contented, contented: 0.2, pant: 0.8 } }]] },
  { name: 'a storm', min: 8, S: { x: -20, z: 8, inside: false, hour: 15, weather: 'rainy', storm: true, rain: 1 }, flashes: true, clock: 1,
    at: [[180, { reduced: true }], [300, { storm: false, rain: 0, reduced: false }], [302, { paused: true }], [340, { paused: false }], [420, { rain: 0.6, storm: true }]] },
  { name: 'a power cut, the generator', min: 6, S: { x: -12, z: 0, inside: true, hour: 18, powerOff: true, fanSpin: 0, snd: contented, flockW: 900, pickBird: birds },
    at: [[90, { x: -32, z: 9.5, inside: false }], [220, { genRun: true }], [230, { cue: 'clunk', powerOff: false }], [260, { x: -12, z: 0, inside: true }],
      [320, { cue: 'clunk' }], [330, { genRun: false }]], clock: 1 },
  { name: 'the catching night', min: 10, S: { x: -12, z: 5, inside: true, hour: 22, day: 40, catching: true, crewX: -10, crewZ: 2, snd: { ...contented, distress: 0.4 }, flockW: 1200, pickBird: birds, fanSpin: 0.5 },
    at: [[5, { cue: 'truck' }], [540, { cue: 'truck' }], [590, { catching: false }]], crew: true, clock: 1 },
  { name: 'the wash bay', min: 6, S: { x: -27, z: 12.5, inside: false, hour: 9, day: 44, washer: 1, catching: false, snd: null, flockW: 0 },
    at: [[180, { x: 0, z: 0, inside: true, washer: 2 }], [250, { washer: 0, scraper: true }], [300, { scraper: false, sprayer: true }]], walkAt: 180, walk: 1.2, clock: 1 },
  { name: 'the office', min: 4, S: { x: -34, z: 25, inside: false, hour: 10, sprayer: false, washer: 0 },
    at: [[30, { cue: 'ring' }], [60, { cue: 'dial' }], [150, { cue: 'ring' }], [170, { cue: 'dial' }]], typing: [[80, 20], [190, 30]], clock: 1 },
  { name: 'a 4x skip', min: 6, S: { x: -20, z: 9, inside: false, hour: 16, weather: 'normal', day: 25 }, clock: 4, skips: 30, ticks: 3, walk: 1.4 },
];

export function runHour(script = HOUR_SCRIPT, { seed = 7, dt = 1 / 30 } = {}) {
  const ac = new FakeAudioContext();
  const eng = createEngine(ac, { seed, lookahead: 0.02, log: 200000 });
  const nodes0 = ac.nodes, rng = makeRng(seed + 1), planner = createThunderPlanner(makeRng(seed + 2));
  const S = eng.S, flashTimes = [], seconds = [], segs = [];
  let t = 0, flashes = 0, nextFlash = 12, reduced = false, paused = false, wet = 0, dryMin = Infinity, walkPhase = 0;
  for (const seg of script) {
    const t0 = t, end = t0 + seg.min * 60, at = (seg.at || []).slice();
    Object.assign(S, { storm: false, rain: 0, powerOff: false, genRun: false, catching: false, washer: 0, sprayer: false, scraper: false,
      pump: false, fanSpin: 0, padOn: 0, heaterLevel: 0, snd: null, flockW: 0, pickBird: () => false, speed: 0 }, seg.S, { teleport: true });
    reduced = false; paused = false;
    const home = { x: S.x, z: S.z };
    let typeUntil = -1, typeAt = 0, tickAt = 0, skipAt = seg.skips || Infinity, second = Math.floor(t);
    segs.push({ name: seg.name, t0, end });
    while (t < end) {
      const s = t - t0;
      while (at.length && at[0][0] <= s) {
        const [, ch] = at.shift();
        for (const [k, v] of Object.entries(ch)) {
          if (k === 'cue') eng.cue(v, v === 'ring' ? -34.1 : NaN, v === 'ring' ? 26.3 : NaN);
          else if (k === 'reduced') reduced = v;
          else if (k === 'paused') paused = v;
          else { if ((k === 'x' || k === 'z') && Math.abs(S[k] - v) > 3) S.teleport = true; S[k] = v; if (k === 'x') home.x = v; if (k === 'z') home.z = v; }
        }
      }
      // the farm clock (1x: 90 game s a real second, 4x: 360), the hour in the day
      const rate = paused ? 0 : 90 * (seg.clock || 1);
      S.hour = (S.hour + (rate * dt) / 3600) % 24;
      // the world's rain: wet rises while it rains and dries after (world-rain.js), the farm minutes since it stopped
      wet += ((S.rain > 0 ? 1 : 0) - wet) * (1 - Math.exp(-dt * (S.rain > 0 ? 0.35 : 0.04)));
      dryMin = S.rain > 0 ? 0 : dryMin + (rate * dt) / 60;
      S.wet = wet; S.dryMin = dryMin;
      if (seg.hold) Object.assign(S, seg.hold); // a segment that holds a state the world would move (a dripping eave)
      // lightning on world-rain's own timer (30-50 s) while the storm lasts, none under reduced motion
      if (seg.flashes && S.storm && !reduced && (nextFlash -= dt) <= 0) { nextFlash = 30 + 20 * rng(); flashes++; flashTimes.push(t); }
      const plan = planner.update(dt, { flashes, storm: S.storm, reduced });
      if (plan) eng.thunder(plan);
      // walking (20-40 s walks and stops), the crew moving, his typing, the skip's jobs
      const walking = seg.walk && s >= (seg.walkAt || 0) && Math.sin(walkPhase * 0.2) > -0.2;
      walkPhase += dt;
      S.speed = walking ? seg.walk : 0;
      S.dist = walking ? seg.walk * dt : 0;
      if (walking) { const a = walkPhase * seg.walk / 6; S.x = home.x + 6 * Math.cos(a); S.z = home.z + 3 * Math.sin(a); }
      if (seg.crew) { S.crewX = -12 + 6 * Math.sin(s * 0.05); S.crewZ = 2 * Math.cos(s * 0.07); }
      for (const [a0, len] of seg.typing || []) if (s >= a0 && s < a0 + len) typeUntil = 1;
      if (typeUntil > 0 && (typeAt -= dt) <= 0) { typeAt = 0.1 + 0.15 * rng(); eng.cue('pen'); }
      typeUntil = -1;
      S.jump = false;
      if (seg.ticks && (tickAt -= dt) <= 0) { tickAt = seg.ticks; eng.cue('tick'); eng.cue('click'); eng.cue('paper'); }
      if (s >= skipAt) { skipAt += seg.skips; S.jump = true; S.hour = (S.hour + 2) % 24; for (let i = 0; i < 6; i++) eng.cue('tick'); }
      eng.update(dt);
      S.teleport = false;
      ac.advance(dt);
      t += dt;
      if (Math.floor(t) !== second) { second = Math.floor(t); seconds.push(loudestNow(eng)); }
    }
  }
  const rows = eng.lim.events();
  const out = hourStats(rows, { flashTimes, seconds, nodes: [nodes0, ac.nodes], segs });
  out.rows = rows;
  out.seconds = Math.round(t); out.counts = { ...eng.counts }; out.segments = segs.map((g) => g.name);
  return out;
}

/** The loudest of each layer this second: the beds at their targets (peak = level + crest) and the events just played. */
function loudestNow(eng) {
  const A = eng.targets, F = eng.flock, T = eng.scenes.T, L = { outside: -120, house: -120, flock: -120, cues: -120 };
  const bed = (layer, db, g) => { if (g > 0.003) L[layer] = Math.max(L[layer], db + gainToDb(g) + BED_CREST); };
  for (const k of ['breeze', 'crickets', 'cicadas']) bed('outside', BED_DB[k], A[k]);
  for (const k of ['fans', 'gas', 'roar', 'pad', 'rain']) bed('house', BED_DB[k], A[k]);
  bed('house', BED_DB.auger, eng.S.auger);
  bed('flock', BED_DB.murmur, F.murmur); bed('flock', BED_DB.pant, F.pant);
  bed('outside', BED5_DB.dayCicadas, T.dayCic); bed('outside', BED5_DB.stormGust, T.storm); bed('house', BED5_DB.crew, T.crew);
  bed('house', BED5_DB.deskFan, T.desk);
  if (T.machine.owner >= 0) bed('house', BED5_DB[MACHINES[T.machine.owner]], T.machine.gain);
  return L;
}

const cvOf = (g) => { if (g.length < 2) return NaN; const m = g.reduce((a, b) => a + b, 0) / g.length; return m > 0 ? Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length) / m : NaN; };
/** the four layers' loudest, summed as power (dBFS) */
export const sumDb = (L) => 10 * Math.log10(Object.values(L).reduce((a, db) => a + 10 ** (db / 10), 0));

/** rows: the engine's event log (audio-limit events()). extra: { flashTimes, seconds (per-second layer peaks), nodes }. */
export function hourStats(rows, extra = {}) {
  rows = rows.slice().sort((a, b) => a.t - b.t);
  const per = maxPerMinute(rows.map((r) => ({ kind: r.kind === 'genStart' || r.kind === 'genStop' || r.kind === 'clunk' ? 'gen' : r.kind, t: r.t })));
  const caps = {};
  for (const [k, cap] of Object.entries(CAPS)) if (k !== 'alarmLate') caps[k] = { most: per[k] || 0, cap, ok: (per[k] || 0) <= cap };
  // the alarm after its first two minutes of a dark house (aux: the dark seconds; a full minute into its 15 s gaps)
  const late = maxPerMinute(rows.filter((r) => r.kind === 'alarm' && r.aux >= 180).map((r) => ({ kind: 'alarm', t: r.t }))).alarm || 0;
  caps.alarmLate = { most: late, cap: CAPS.alarmLate, ok: late <= CAPS.alarmLate };
  const cv = {};
  const segs = extra.segs || [{ t0: -Infinity, end: Infinity }];
  for (const k of POISSON) {
    const ts = rows.filter((r) => r.kind === k).map((r) => r.t), gaps = [];
    for (const sg of segs) { const inSeg = ts.filter((x) => x >= sg.t0 && x < sg.end); for (let i = 1; i < inSeg.length; i++) gaps.push(inSeg[i] - inSeg[i - 1]); }
    const c = cvOf(gaps);
    cv[k] = { n: gaps.length, cv: Number.isFinite(c) ? +c.toFixed(2) : null, ok: gaps.length < 20 || c >= 0.6 };
  }
  const repeats = {};
  for (const k of VARIANT_KINDS) {
    const vs = rows.filter((r) => r.kind === k && r.variant >= 0).map((r) => r.variant);
    let n = 0;
    for (let i = 1; i < vs.length; i++) if (vs[i] === vs[i - 1]) n++;
    repeats[k] = { n: vs.length, twice: n, ok: n === 0 };
  }
  const th = rows.filter((r) => r.kind === 'thunder');
  const delays = th.filter((r) => r.aux > 0).map((r) => r.aux);
  const thunder = { n: th.length, flashes: extra.flashTimes?.length ?? null, delayMin: delays.length ? Math.min(...delays) : null, delayMax: delays.length ? Math.max(...delays) : null,
    ok: delays.every((d) => d >= 1.5 - 1e-6 && d <= 7.9 + 1e-6) };
  // the summed loudest layers in every second: the beds at their targets, raised by the events played in that second
  // (each event's peak: the level table's at its nominal gain, plus the gain it was played at, r.db)
  for (const r of rows) {
    const L = extra.seconds?.[Math.floor(r.t)], ly = layerOf(r.kind);
    if (L && ly && r.kind in LOUDEST) L[ly] = Math.max(L[ly], LOUDEST[r.kind] + (r.db || 0));
  }
  let loudest = -120, loudestAt = -1;
  for (let i = 0; i < (extra.seconds?.length || 0); i++) {
    const sum = sumDb(extra.seconds[i]);
    if (sum > loudest) { loudest = sum; loudestAt = i; }
  }
  const nodes = extra.nodes ? { start: extra.nodes[0], end: extra.nodes[1], ok: extra.nodes[0] === extra.nodes[1] && extra.nodes[0] <= 230 } : null;
  const ok = Object.values(caps).every((c) => c.ok) && Object.values(cv).every((c) => c.ok) && Object.values(repeats).every((c) => c.ok)
    && thunder.ok && (nodes ? nodes.ok : true) && (extra.seconds ? loudest <= -16 : true);
  return { ok, events: rows.length, caps, cv, repeats, thunder, nodes, loudest: { db: +loudest.toFixed(1), second: loudestAt, ok: loudest <= -16 } };
}
