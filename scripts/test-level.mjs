// Level flow in node: the real sim, farm, records, skills, job engine and level.js, with the 3D
// modules and the ui stubbed. Checks what the integrator's harness runs check, in seconds:
// level.debug.goto(auto) plays the ideal week (the same rounds as test-sim's ideal profile) and the
// level ends on the day 7 signing with a pass; a neglected week fails; save -> resume keeps the jobs.
//   node scripts/test-level.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { LEVEL1 } from '../src/config.js';
import { EV } from '../src/events.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const inBand = (v, [a, b], what) => assert(v >= a && v <= b, `${what} ${v} not in ${a}..${b}`);

function makeLevel() {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, shown: null, setMode(m) { this.mode = m; }, closePanel() {}, showResult(r) { this.shown = r; }, jobCard: { refresh() {} } };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {} };
  const store = { data: null, available: true, save(d) { this.data = JSON.parse(JSON.stringify(d)); return true; }, load() { return this.data; }, clear() { this.data = null; },
    loadProfile: () => null, saveProfile() {}, info() { return null; } };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
  return { ...w, level, ui, store };
}

test('goto(7, 21, auto) plays the ideal week: the level ends on the day 7 signing and passes', () => {
  const t0 = Date.now();
  const L = makeLevel();
  const ends = [];
  L.events.on(EV.LEVEL, (p) => { if (p.phase === 'end') ends.push(p.result); });
  L.level.start({ seed: 1 });
  L.level.debug.goto(7, 21, { auto: true });
  const r = L.level.result;
  assert(r, `level did not end (day ${L.env.dayNumber} ${L.env.timeLabel}, mode ${L.level.mode})`);
  assert(ends.length === 1, `EV.LEVEL end emitted ${ends.length} times`);
  console.log(`     ended '${r.reason}' at ${r.endedAt}: ratio ${r.ratio.toFixed(3)} (${r.weighedByHand ? 'weighed' : 'scale'}), deaths ${r.deathsPct.toFixed(2)} %, uniformity ${r.uniformityPct?.toFixed(1)} %, FCR ${r.fcr?.toFixed?.(3)}, ${Date.now() - t0} ms`);
  assert(r.reason === 'signed', `ended by ${r.reason}`);
  assert(r.pass, `did not pass: ${r.failText}`);
  inBand(r.ratio, [4.6, 4.95], 'ratio');
  assert(r.weighedByHand, 'not weighed by hand');
  assert(L.ui.shown === r, 'result screen not shown');
  const skills = { brooding: L.skills.level('brooding'), water: L.skills.level('water') };
  console.log(`     skills brooding ${L.skills.points('brooding')} pts (level ${skills.brooding}), water ${L.skills.points('water')} pts (level ${skills.water}); points on the result: ${r.points.length}`);
  assert(skills.brooding >= 2 && skills.water >= 2, `skill levels ${JSON.stringify(skills)}`);
  const missed = L.level.jobs.list().filter((j) => j.status === 'missed' && j.def.kind !== 'problem').map((j) => j.key);
  assert(!missed.length, `missed jobs: ${missed.join(' ')}`);
  const rows = [];
  for (let d = LEVEL1.startDay; d <= LEVEL1.endDay; d++) rows.push(L.records.row(d));
  assert(rows.every((x) => x && x.signed), 'every day signed');
  const tl = L.records.timeline?.();
  assert(Array.isArray(tl) && tl.length >= 8, 'records.timeline() for "Your week"');
});

test('a week with no management fails at the end (or early on deaths)', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  // no rounds at all: skip to day 8 06:00, the level ends by itself
  L.level.debug.goto(8, 6.5);
  const r = L.level.result;
  assert(r, 'level did not end');
  assert(!r.pass, `passed: ratio ${r.ratio}, deaths ${r.deathsPct}`);
  console.log(`     ended '${r.reason}' at ${r.endedAt}: ${r.failText}`);
});

test('save -> resume keeps day, hour, jobs and the farm', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(2, 10, { auto: true });
  const blob = JSON.parse(JSON.stringify(L.level.saveBlob()));
  const kb = JSON.stringify(blob).length / 1024;
  console.log(`     save blob ${kb.toFixed(1)} KB on day 2`);
  assert(kb < 60, `save blob ${kb.toFixed(1)} KB`);
  const before = L.level.jobs.list().map((j) => `${j.key}:${j.status}`).join(' ');
  const M = makeLevel();
  assert(M.level.resume(blob), 'resume failed');
  assert(M.env.dayNumber === 2 && Math.abs(M.env.hour - L.env.hour) < 1e-6, `resumed at day ${M.env.dayNumber} ${M.env.hour}`);
  const after = M.level.jobs.list().map((j) => `${j.key}:${j.status}`).join(' ');
  assert(before === after, 'job list differs after resume');
  assert(M.farm.flock.alive === L.farm.flock.alive, 'alive differs');
  // both play on the same way
  L.level.debug.goto(3, 12, { auto: true }); M.level.debug.goto(3, 12, { auto: true });
  assert(Math.abs(M.farm.flock.meanWeightG - L.farm.flock.meanWeightG) < 0.5, `weights ${M.farm.flock.meanWeightG} vs ${L.farm.flock.meanWeightG}`);
});

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
