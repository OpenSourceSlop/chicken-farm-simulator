// The run of seven levels in node (PHASE3.md §14.2). Owner: package "run". The real sim, farm,
// records, skills, job engine, level.js and run.js, with the 3D modules and the ui stubbed (as
// test-level.mjs). The chaining tests skip while run.stub or farm.cycleStub is true (they need the real run
// AND the real farm model: on the sim stub nothing heats, sickens or grows to the cycle's targets); the
// free-run stub test (the other packages' way to a level-mode farm at any age) runs now.
//   node scripts/test-run.mjs
//   RUN_ON_STUB=1 node scripts/test-run.mjs   the chaining tests on the sim stub too (the run package's own
//                                              check of the flow; tests whose numbers need the model fail there)
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel, IDEAL_PLAN } from '../src/level.js';
import { createRun } from '../src/run.js';
import { LEVELS, LEVEL1, levelById } from '../src/config.js';
import { EV } from '../src/events.js';
import { planSums } from '../src/farm-plan.js';

let failed = 0, skipped = 0;
const ON_STUB = !!process.env.RUN_ON_STUB;
function test(name, fn) {
  const t0 = Date.now();
  try { const r = fn(); if (r === 'skip') { skipped++; console.log(`skip ${name}`); } else console.log(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const H = 1 / 24;

function makeRun() {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, shown: null, setMode(m) { this.mode = m; }, closePanel() {}, showResult(r) { this.shown = r; }, jobCard: { refresh() {}, reset() {} }, newRun() {} };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} };
  const store = { data: null, available: true, save(d) { this.data = JSON.parse(JSON.stringify(d)); return true; }, load() { return this.data; }, clear() { this.data = null; },
    loadProfile: () => null, saveProfile() {}, info() { return null; } };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
  const run = createRun({ level, save: store, events: w.events, farm: w.farm, env: w.env, records: w.records });
  return { ...w, level, run, ui, store };
}
const at = (R, d, h) => Math.abs(R.env.day - (d + h * H)) < 1e-6;
/** The first path where two JSON values differ (numbers within 1e-9 relative count as the same), or null. */
function firstDiff(a, b, p = '') {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)) ? null : `${p}: ${a} vs ${b}`;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], `${p}.${k}`); if (d) return d; }
    return null;
  }
  return a === b ? null : `${p}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`;
}
const where = (R) => `day ${R.env.dayNumber} ${R.env.timeLabel} ${R.level.def.id} (${R.level.mode})`;
/** Play the current level to its end with the ideal farmer (or `profile`); the result shown. */
function playLevel(R, profile = 'ideal') {
  const def = R.level.def;
  R.level.debug.goto(def.endDay, 21, { auto: true, profile });
  if (!R.level.result) R.level.debug.goto(def.endDay + 1, 6.05);
  R.level.update(1);
  assert(R.level.result, `${def.id} did not end: ${where(R)}`);
  return R.level.result;
}
/** The plan of the planning day: two measures, the plan sent, the reply read, the page signed. */
function scriptedPlan(R, plan) {
  R.farm.act('plan.measure', { axis: 'length', m: 48.0 });
  R.farm.act('plan.measure', { axis: 'width', m: 12.0 });
  R.farm.act('plan.send', { ...plan, sums: planSums(plan, 576) });
  R.level.debug.goto(-2, 10.5);
  R.events.emit(EV.ACTION, { id: 'plan.reply', result: undefined });
  R.level.debug.goto(-2, 17);
  R.records.sign(-2);
  R.level.update(1);
  return R.level.result;
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

test('startLevel(week3, standard): the run plays the ideal farmer to day 15 06:00, a level-mode farm in week 3', () => {
  const R = makeRun();
  assert(R.run.startLevel('week3', { from: 'standard' }), `startLevel: ${where(R)} ${R.level.result?.failText ?? ''}`);
  assert(at(R, 15, 6) && R.level.def.id === 'week3' && R.level.mode === 'level', where(R));
  assert(R.run.state().levelId === 'week3' && R.run.state().levels.week2.state === 'passed', 'run.state()');
});

// ---------------- the chaining tests (PHASE3.md §14.2): the real run on the real sim ----------------
const chain = (name, fn) => test(name, () => {
  const R = makeRun();
  if ((R.run.stub || R.farm.cycleStub) && !ON_STUB) return 'skip';
  return fn(R);
});
let fullCycle = null; // the run of the third test, for the save sizes of the eighth

chain('a scripted plan (two measures, the reference plan, the reply, signed) passes with 3,611 birds a week; a 49-day plan at 0 % losses and a 12-house plan do not', (R) => {
  R.run.startRun({ seed: 1 });
  assert(R.level.def.id === 'plan' && at(R, -2, 7) && R.farm.flock.alive === 0, `the planning day 07:00, no birds: ${where(R)}`);
  const r = scriptedPlan(R, IDEAL_PLAN);
  assert(r && r.levelId === 'plan', 'the plan level ended on the signing');
  assert(r.pass && Math.round(r.plan.outcome.salePerWeek) === 3611, `reference plan: pass ${r.pass}, ${r.plan?.outcome?.salePerWeek} a week (${r.failText})`);
  assert(r.run.next && r.run.next.id === 'level1', 'Continue to the brooding week');
  const R2 = makeRun();
  R2.run.startRun({ seed: 1 });
  const r2 = scriptedPlan(R2, { houses: 5, birdsPerHouse: 6000, cycleDays: 49, lossesPct: 0, saleKg: 2.8 });
  assert(!r2.pass && /3 days of rest; the contract asks for 21/.test(r2.failText), `49-day plan: pass ${r2.pass}: ${r2.failText}`);
  assert(!r2.run.next && r2.run.replays[0].id === 'plan', 'not passed: Replay the plan, no Continue');
  console.log(`     ${r2.failText}`);
  // the most houses the sheet allows meets no contract: the plant takes at most 10 % over it
  const R3 = makeRun();
  R3.run.startRun({ seed: 1 });
  const r3 = scriptedPlan(R3, { houses: 12, birdsPerHouse: 6000, cycleDays: 100, lossesPct: 0, saleKg: 2.8 });
  assert(!r3.pass && /the company buys 3,600 a week and the plant takes at most 3,960: your plan gives 4,838/.test(r3.failText), `12-house plan: pass ${r3.pass}: ${r3.failText}`);
  console.log(`     ${r3.failText}`);
});

chain('goto(7, 21, auto) passes the brooding week; Continue starts week 2 at day 8 06:00 with the same flock, start saved', (R) => {
  R.run.startRun({ seed: 1, at: 'level1' });
  assert(R.level.def === LEVEL1 && at(R, -1, 7) && R.run.state().plan === null, `prep day, no plan: ${where(R)}`);
  R.level.debug.goto(7, 21, { auto: true });
  const r = R.level.result;
  assert(r && r.pass && r.reason === 'signed', `brooding week: ${r?.failText}`);
  assert(r.title === 'Level 2 – The brooding week' && r.run.next.id === 'week2', `result title ${r.title}`);
  const alive = R.farm.flock.alive, placed = R.farm.flock.placed;
  assert(R.run.next(), 'next()');
  assert(at(R, 8, 6) && R.level.def.id === 'week2' && R.level.mode === 'level', where(R));
  const s = R.level.startCounts();
  assert(R.farm.flock.placed === placed && Math.abs(R.farm.flock.alive - alive) <= Math.ceil(alive * 0.001) && s.alive === R.farm.flock.alive,
    `the same flock: ${alive} -> ${R.farm.flock.alive} alive, level start ${s.alive}`);
  assert(R.run.state().levels.week2.starts.includes(8) && R.run.replay && R.run.state().levels.level1.state === 'passed', 'week 2 start saved, the brooding week passed');
  const open = R.level.jobs.open().map((i) => i.key);
  assert(open.includes('w2-lights@8') && open.includes('r-drinkers@8'), `day 8 jobs: ${open.join(' ')}`);
});

chain('goto(auto) through every level passes each one; the cycle summary exists', (R) => {
  const t0 = Date.now();
  R.run.startRun({ seed: 1 });
  const lines = [];
  for (const def of LEVELS) {
    assert(R.level.def.id === def.id && at(R, def.startDay, def.startHour), `start of ${def.id}: ${where(R)}`);
    const r = playLevel(R);
    lines.push(`${def.id} ${r.pass ? 'passed' : 'NOT passed'} (${r.reason}, ${r.endedAt})`);
    assert(r.pass, `${def.id} not passed: ${r.failText}`);
    if (def !== LEVELS[LEVELS.length - 1]) assert(R.run.next(), `next() after ${def.id}`);
  }
  console.log(`     ${lines.join(' · ')}; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const st = R.run.state();
  assert(st.summary && st.summary.placed > 0 && R.level.result.run.summary, 'cycle summary in the run and on the last result');
  assert(LEVELS.every((d) => st.levels[d.id].state === 'passed'), 'every level passed in the run state');
  fullCycle = R;
});

chain('a failed week 3 replays from day 15 06:00 with a farm identical to the saved start', (R) => {
  assert(R.run.startLevel('week3', { from: 'standard' }), `standard start week 3: ${where(R)}`);
  const start = JSON.parse(JSON.stringify(R.farm.serialize()));
  R.level.debug.goto(17, 9, { auto: true });
  R.farm.flock.culls += Math.ceil(R.farm.flock.alive * 0.02);   // deaths and culls past the week's 1 %
  R.records.sign(17);
  const r = R.level.result;
  assert(r && !r.pass && r.early && /week 3 reached/.test(r.failText), `week 3 failed early: ${r?.failText}`);
  assert(r.run.replays.length === 1 && r.run.replays[0].day === 15 && r.run.previous?.id === 'week2', 'Replay Week 3 (day 15) and Replay Week 2');
  assert(R.run.replay('week3', { day: 15 }), 'replay');
  assert(at(R, 15, 6) && R.level.def.id === 'week3' && R.level.mode === 'level' && !R.level.result, where(R));
  const d = firstDiff(start, JSON.parse(JSON.stringify(R.farm.serialize())));
  assert(!d, `the farm is the saved start: ${d}`);
  assert(R.run.state().levels.week3.attempts === 2, `attempts ${R.run.state().levels.week3.attempts}`);
});

chain('poorVaccine: week 3 passes with the Gumboro deaths in its record; poorVaccineCocci fails week 3, its fail screen offers Replay Week 2 with "vaccine drunk in N h on day 12", and week 2 replayed with the ideal vaccination then passes week 3', (R) => {
  assert(R.run.startLevel('week2', { from: 'standard' }), `standard start week 2: ${where(R)}`);
  const w2 = playLevel(R, 'poorVaccine');
  assert(w2.pass, `week 2 with the poor vaccination: ${w2.failText}`);
  R.run.next();
  const w3 = playLevel(R, 'poorVaccine');
  assert(w3.pass && (R.farm.flock.deadByCause?.disease ?? 0) > 0, `poorVaccine week 3: pass ${w3.pass} (${w3.failText}), disease deaths ${R.farm.flock.deadByCause?.disease}`);
  const P = makeRun();
  assert(P.run.startLevel('week2', { from: 'standard' }), 'standard start week 2');
  assert(playLevel(P, 'poorVaccineCocci').pass, 'week 2 passes with the poor vaccination');
  P.run.next();
  const f = playLevel(P, 'poorVaccineCocci');
  assert(!f.pass, `poorVaccineCocci passed week 3 (${f.deathsPct?.toFixed(2)} %)`);
  const prev = f.run.previous;
  assert(prev && prev.id === 'week2' && prev.day === 8, `Replay Week 2 from day 8: ${JSON.stringify(prev)}`);
  const line = prev.carried.find((l) => /^vaccine drunk in \d+(\.\d)? h on day 12$/.test(l));
  assert(line, `carried lines: ${JSON.stringify(prev.carried)}`);
  console.log(`     week 3: ${f.failText}; Replay Week 2 shows "${line}"`);
  assert(P.run.replay('week2', { day: 8 }) && at(P, 8, 6) && P.level.def.id === 'week2', `replay week 2: ${where(P)}`);
  assert(playLevel(P).pass, 'week 2 replayed with the ideal vaccination');
  P.run.next();
  const again = playLevel(P);
  assert(again.pass, `week 3 after the replay: ${again.failText}`);
});

chain('weeks45 has two saved starts (day 22 and day 29); a fail on day 33 offers both', (R) => {
  assert(R.run.startLevel('weeks45', { from: 'standard' }), `standard start weeks45: ${where(R)}`);
  R.level.debug.goto(29, 7, { auto: true });
  const e = R.run.state().levels.weeks45;
  assert(JSON.stringify(e.starts) === '[22,29]', `starts ${JSON.stringify(e.starts)}`);
  R.level.debug.goto(33, 9, { auto: true });
  R.farm.flock.culls += Math.ceil(R.farm.flock.alive * 0.03);
  R.records.sign(33);
  const r = R.level.result;
  assert(r && !r.pass && r.failDay === 33, `failed on day 33: ${r?.failText}`);
  assert(JSON.stringify(r.run.replays.map((x) => x.day)) === '[29,22]', `replays ${JSON.stringify(r.run.replays)}`);
  assert(R.run.replay('weeks45', { day: 29 }) && at(R, 29, 6), `from day 29: ${where(R)}`);
  assert(R.run.replay('weeks45', { day: 22 }) && at(R, 22, 6) && JSON.stringify(R.run.state().levels.weeks45.starts) === '[22]', `from day 22, the day 29 start gone: ${where(R)}`);
});

chain('a standard start of weeks45 reaches day 22 06:00 in 6 s or less', (R) => {
  const t0 = Date.now();
  assert(R.run.startLevel('weeks45', { from: 'standard' }), where(R));
  const s = (Date.now() - t0) / 1000;
  console.log(`     ${s.toFixed(1)} s`);
  assert(at(R, 22, 6) && R.level.def.id === 'weeks45' && s <= 6, `${where(R)} in ${s.toFixed(1)} s`);
});

chain('every level start blob is 250 KB or less; a Phase 2 save continues as a run at level1', (R) => {
  const C = fullCycle || (() => { const X = makeRun(); X.run.startRun({ seed: 1 }); for (const d of LEVELS) { playLevel(X); if (d.id !== 'cleanout') X.run.next(); } return X; })();
  const sizes = [];
  for (const def of LEVELS) for (const d of C.run.state().levels[def.id].starts) {
    const kb = JSON.stringify(C.run.debugStart(def.id, d)).length / 1024;
    sizes.push(`${def.id}.${d} ${kb.toFixed(0)}`);
    assert(kb <= 250, `${def.id} day ${d}: ${kb.toFixed(1)} KB`);
  }
  console.log(`     level starts (KB): ${sizes.join(' · ')}`);
  // the run key at the end of the rest (day 67): blob and run as the browser writes them (PHASE3.md §6.15)
  const endKb = JSON.stringify({ run: C.run.state(), blob: C.level.saveBlob() }).length / 1024;
  console.log(`     the run key at ${where(C)}: ${endKb.toFixed(0)} KB`);
  assert(endKb <= 250, `run save at the end ${endKb.toFixed(1)} KB`);
  R.level.start({ seed: 1 });
  R.level.debug.goto(2, 10, { auto: true });
  assert(R.store.data && !R.level.inRun, 'Phase 2 saved its level (the lone brooding week)');
  const day = R.store.data.env.day;
  const R2 = makeRun();
  R2.store.data = JSON.parse(JSON.stringify(R.store.data));
  assert(R2.run.continueSave(), 'continueSave');
  assert(R2.level.inRun && R2.run.state().levelId === 'level1' && R2.run.state().plan === null && Math.abs(R2.env.day - day) < 1e-6, `a run at the brooding week: ${where(R2)}`);
  assert(R2.store.data === null, 'the Phase 2 save is replaced by the run key');
  R2.level.debug.goto(7, 21, { auto: true });
  assert(R2.level.result?.pass && R2.run.next() && R2.level.def.id === 'week2', 'and on into week 2');
});

chain('an unnoticed rainy spell opens no problem job; Next job with jobs open stops at the next 06:00 and says so', (R) => {
  R.run.startLevel('week2', { from: 'standard' });
  // no input: hour by hour through the rainy spell (days 9-10) to day 11 noon
  while (R.env.day < 11.5) { R.level.debug.goto(R.env.dayNumber, ((R.env.day - Math.floor(R.env.day)) * 24) + 1); R.level.update(1); }
  const p = R.farm.problems.find((x) => x.id === 'rainy-spell');
  assert(p && p.phase === 'fixed' && p.foundAt == null && p.fixedBy === 'weather', `the rainy spell passed unseen: ${JSON.stringify(p)}`);
  assert(!R.level.jobs.list().some((j) => j.id === 'p-damp'), `no p-damp job: ${R.level.jobs.list().filter((j) => j.def.kind === 'problem').map((j) => j.key).join(' ')}`);
  // Next job twice with jobs open: the label names the day, and the skip stops at the next 06:00 at the latest
  const open = R.level.jobs.open().length;
  assert(open > 0, 'jobs are open at day 11 noon');
  R.level.nextJob();
  const label = R.level.nextLabel(), d0 = R.env.day;
  R.level.nextJob();
  assert(/Skip to \d\d:\d\d(, day \d+)? — \d+ jobs? open/.test(label) && R.env.day <= Math.floor(d0) + 1 + 0.25 + 1e-6 && R.env.day > d0, `label "${label}", skipped ${d0.toFixed(3)} -> ${R.env.day.toFixed(3)}`);
  console.log(`     ${label}: ${where(R)}`);
});

chain('a standard start of a level the player had passed: the later levels and their saved starts of the old flock are gone', (R) => {
  R.run.startRun({ seed: 1, at: 'level1' });
  for (let i = 0; i < 3; i++) { assert(playLevel(R)?.pass, `level ${R.level.def.id} passes`); R.run.next(); }
  R.level.debug.goto(30, 10, { auto: true });
  assert(R.run.hasStart('weeks45', 22) && R.run.hasStart('weeks45', 29), 'weeks 4-5 has both starts');
  R.run.startLevel('week3', { from: 'standard' });
  const card = R.run.card().map((c) => `${c.id}:${c.state}`).join(' ');
  assert(!R.run.hasStart('weeks45', 22) && !R.run.hasStart('weeks45', 29) && R.run.state().levels.weeks45 == null, `weeks 4-5 starts gone: ${card}`);
  assert(R.run.state().levels.week2?.state === 'passed' && R.run.state().levels.level1?.attempts === 1, `the player's own entries kept: ${JSON.stringify(R.run.state().levels.level1)}`);
});

console.log(failed ? `${failed} failed` : `all passed${skipped ? ` (${skipped} skipped: run.stub / farm.cycleStub)` : ''}`);
process.exit(failed ? 1 : 0);
