// The run of seven levels in node (PHASE3.md §14.2). Owner: package "run". The real sim, farm,
// records, skills, job engine, level.js and run.js, with the 3D modules and the ui stubbed (as
// test-level.mjs). The chaining tests skip while run.stub or farm.cycleStub is true (they need the real run
// AND the real farm model: on the sim stub nothing heats, sickens or grows to the cycle's targets); the
// free-run stub test (the other packages' way to a level-mode farm at any age) runs now.
//   node scripts/test-run.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createRun } from '../src/run.js';
import { LEVELS } from '../src/config.js';

let failed = 0, skipped = 0;
function test(name, fn) {
  try { const r = fn(); if (r === 'skip') { skipped++; console.log(`skip ${name}`); } else console.log(`ok   ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

function makeRun() {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, shown: null, setMode(m) { this.mode = m; }, closePanel() {}, showResult(r) { this.shown = r; }, jobCard: { refresh() {} } };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} };
  const store = { data: null, available: true, save(d) { this.data = JSON.parse(JSON.stringify(d)); return true; }, load() { return this.data; }, clear() { this.data = null; },
    loadProfile: () => null, saveProfile() {}, info() { return null; } };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
  const run = createRun({ level, save: store, events: w.events, farm: w.farm, env: w.env, records: w.records });
  return { ...w, level, run, ui, store };
}

test('free run (stub for the other packages): a level-mode farm on day 30 at 14:00', () => {
  const t0 = Date.now();
  const R = makeRun();
  R.level.start({ seed: 1 });
  assert(R.level.debug.freeRun(30, 14), 'freeRun returned false');
  const f = R.farm.flock;
  console.log(`     day ${R.env.dayNumber} ${R.env.timeLabel}, level ${R.level.def.id}, alive ${f.alive}, ${Math.round(f.meanWeightG)} g, ${Date.now() - t0} ms`);
  assert(R.env.dayNumber === 30 && Math.abs(R.env.hour - 14) < 0.02, `clock ${R.env.dayNumber} ${R.env.timeLabel}`);
  assert(R.level.mode === 'level' && !R.level.result, 'still in level mode, no level end');
  assert(R.level.def.id === 'weeks45' && R.farm.mode === 'level', `def ${R.level.def.id}`);
  assert(f.alive > 5000 && f.meanWeightG > 800, `flock ${f.alive} birds of ${f.meanWeightG} g`);
  assert(R.env.broodCurtain === false, 'the curtain is up after day 10');
  assert(R.level.debug.freeRun(44, 9) && R.env.dayNumber === 44, 'free run on into the clean-out days (env.maxDay 70)');
  R.level.start({ seed: 1 });
  assert(R.env.maxDay === 42 && R.env.dayNumber === -1, 'a new level start leaves the free run');
});

test('run stub: startLevel(week3) is a level-mode farm at day 15 06:00', () => {
  const R = makeRun();
  assert(R.run.startLevel('week3', { from: 'standard' }), 'startLevel');
  assert(R.env.dayNumber === 15 && Math.abs(R.env.hour - 6) < 0.02 && R.level.def.id === 'week3', `day ${R.env.dayNumber} ${R.env.timeLabel} ${R.level.def.id}`);
  assert(R.run.state().levelId === 'week3', 'run.state().levelId');
});

const CHAIN = [
  'a scripted plan (two measures, the reference plan, the reply, signed) passes with 3,611 birds a week; a 49-day plan at 0 % losses does not',
  'goto(7, 21, auto) passes the brooding week; Continue starts week 2 at day 8 06:00 with the same flock, start saved',
  'goto(auto) through every level passes each one; the cycle summary exists',
  'a failed week 3 replays from day 15 06:00 with a farm identical to the saved start',
  'poorVaccine: week 3 passes with the Gumboro deaths in its record; poorVaccineCocci fails week 3, its fail screen offers Replay Week 2 with "vaccine drunk in N h on day 12", and week 2 replayed with the ideal vaccination then passes week 3',
  'weeks45 has two saved starts (day 22 and day 29); a fail on day 33 offers both',
  'a standard start of weeks45 reaches day 22 06:00 in 6 s or less',
  'every level start blob is 250 KB or less; a Phase 2 save continues as a run at level1',
];
for (const name of CHAIN) test(name, () => {
  const R = makeRun();
  if (R.run.stub || R.farm.cycleStub) return 'skip';
  void LEVELS;
  throw new Error('package "run": write this test (PHASE3.md §14.2)');
});

console.log(failed ? `${failed} failed` : `all passed${skipped ? ` (${skipped} skipped: run.stub / farm.cycleStub)` : ''}`);
process.exit(failed ? 1 : 0);
