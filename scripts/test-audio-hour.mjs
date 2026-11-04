// The long-session check of the sound layer (PHASE5.md §2.2, §10.1): the engine and the thunder planner driven through a
// scripted hour on the fake audio clock (src/audio-hour.js: yard by day 10 min, the house with six fans 10, a storm 8, a
// power cut with the generator 6, the catching night 10, the wash bay 6, the office 4, a 4x skip 6), then: every cap of
// §2.2 in every real minute, every Poisson source's gaps with a CV of at least 0.6 (thunder is flash-driven: its delays
// after each flash 1.5-7.9 s instead; its reduced-motion timer is Poisson and checked here on a long storm), no variant
// twice in a row, no node made after start-up, the summed loudest layers in every second at or under -16 dBFS.
// Run: node scripts/test-audio-hour.mjs   (to join `npm test` at the merge)
import { runHour, HOUR_SCRIPT } from '../src/audio-hour.js';
import { CAPS, THUNDER_TIMER } from '../src/audio-rules.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const list = (o, f) => Object.entries(o).map(([k, v]) => `${k} ${f(v)}`).join(', ');

test('the scripted hour: every cap, every Poisson source, no repeats, no node made, the loudest second', () => {
  const r = runHour(HOUR_SCRIPT, { seed: 7 });
  assert(r.seconds === 3600 && HOUR_SCRIPT.reduce((a, s) => a + s.min, 0) === 60, `an hour: ${r.seconds} s`);
  console.log(`     ${r.events} events in ${r.seconds} s: ${r.segments.join(' · ')}`);
  console.log(`     most in a minute (cap): ${list(r.caps, (c) => `${c.most}/${c.cap}`)}`);
  console.log(`     gap CV (gaps): ${list(r.cv, (c) => (c.n ? `${c.cv} (${c.n})` : '-'))}`);
  console.log(`     thunder: ${r.thunder.n} rumbles after ${r.thunder.flashes} flashes and the reduced-motion timer, delays ${r.thunder.delayMin?.toFixed(2)}..${r.thunder.delayMax?.toFixed(2)} s`);
  console.log(`     loudest second: ${r.loudest.db} dBFS (second ${r.loudest.second}); nodes ${r.nodes.start} -> ${r.nodes.end}`);
  for (const [k, c] of Object.entries(r.caps)) assert(c.ok, `${k}: ${c.most} in a minute over its cap ${c.cap}`);
  for (const k of ['tick', 'paper', 'alarm', 'crate']) assert(r.caps[k].most === CAPS[k], `${k} reached its cap (${r.caps[k].most}): the script tests the cap`);
  for (const [k, c] of Object.entries(r.cv)) assert(c.ok, `${k}: gaps CV ${c.cv} over ${c.n} gaps (under 0.6: a beat)`);
  for (const k of ['chirp', 'distress', 'snick', 'rattle', 'flutter', 'bird', 'frog', 'crate']) assert(r.cv[k].n >= 20, `${k}: only ${r.cv[k].n} gaps in the hour`);
  for (const [k, c] of Object.entries(r.repeats)) assert(c.ok && c.n > 0, `${k}: ${c.twice} variants twice in a row of ${c.n}`);
  assert(r.thunder.ok && r.thunder.n >= r.thunder.flashes && r.thunder.flashes >= 4, `thunder delays ${r.thunder.delayMin}..${r.thunder.delayMax} s`);
  assert(r.nodes.ok, `nodes ${r.nodes.start} -> ${r.nodes.end} (at most 230, none after start-up)`);
  assert(r.loudest.ok, `the summed loudest layers reach ${r.loudest.db} dBFS in second ${r.loudest.second}`);
  for (const k of ['genStart', 'genStop', 'clunk', 'ring', 'dial', 'pen', 'scrape', 'drip', 'thunder', 'crate', 'alarm', 'truck']) assert(r.counts[k] > 0, `${k} played in the hour`);
  assert(r.ok, 'the hour holds');
});

test('the reduced-motion thunder: an exponential timer (mean 40 s, never under 20 s), its gaps Poisson, 3 a minute at most', () => {
  const storm = [{ name: 'a long storm under reduced motion', min: 120, S: { x: -30, z: 30, inside: false, hour: 15, weather: 'rainy', storm: true, rain: 1 },
    at: [[0, { reduced: true }]], clock: 1 }];
  const r = runHour(storm, { seed: 3, dt: 1 / 20 });
  const ts = r.rows.filter((e) => e.kind === 'thunder').map((e) => e.t);
  const gaps = ts.slice(1).map((t, i) => t - ts[i]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const cv = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / mean;
  console.log(`     ${ts.length} rumbles in 2 h, gaps ${Math.min(...gaps).toFixed(1)}..${Math.max(...gaps).toFixed(1)} s, mean ${mean.toFixed(1)} s, CV ${cv.toFixed(2)}, most in a minute ${r.caps.thunder.most}`);
  assert(ts.length >= 100, `${ts.length} rumbles`);
  assert(Math.min(...gaps) >= THUNDER_TIMER.min - 0.1, `the 20 s floor: ${Math.min(...gaps).toFixed(2)}`);
  assert(mean > 36 && mean < 54, `mean gap ${mean.toFixed(1)} s`);
  assert(cv >= 0.6, `CV ${cv.toFixed(2)} (Poisson, not a beat)`);
  assert(r.caps.thunder.ok && r.thunder.delayMax === null, 'no flash delays under reduced motion; the cap holds');
  assert(r.repeats.thunder.ok, 'no rumble shape twice in a row');
});

test('a dripping eave for ten minutes: 0.2-0.6 a second, under 40 a minute, Poisson, four variants never twice in a row', () => {
  const eave = [{ name: 'the eaves after the rain', min: 10, S: { x: -10, z: 7.5, inside: false, hour: 16, weather: 'rainy' }, hold: { wet: 1, dryMin: 0, rain: 0 }, clock: 1 }];
  const r = runHour(eave, { seed: 5 });
  const ts = r.rows.filter((e) => e.kind === 'drip').map((e) => e.t);
  console.log(`     ${ts.length} drips in 10 min (${(ts.length / 600).toFixed(2)} a second), most in a minute ${r.caps.drip.most}, CV ${r.cv.drip.cv}, variants ${[...new Set(r.rows.filter((e) => e.kind === 'drip').map((e) => e.variant))].sort()}`);
  assert(ts.length / 600 >= 0.4 && ts.length / 600 <= 0.62, `${(ts.length / 600).toFixed(2)} drips a second (0.6 at a wet eave)`);
  assert(r.caps.drip.ok && r.caps.drip.most <= 40, `most in a minute ${r.caps.drip.most}`);
  assert(r.cv.drip.cv >= 0.6, `CV ${r.cv.drip.cv}`);
  assert(r.repeats.drip.ok && new Set(r.rows.filter((e) => e.kind === 'drip').map((e) => e.variant)).size === 4, 'four variants, never twice in a row');
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
