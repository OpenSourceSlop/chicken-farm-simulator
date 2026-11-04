// Node regressions of the Phase 4 final check (PHASE4.md §15.9): (1) a panel opened again shows the strip of the jobs
// open now or none, never the strip of its last opening; (2) a bad batch's hatchery claim stays open until 24:00 of
// day 0 (the fail rule, the job window and the sign agree); (3) the flock watch warns of the water condition's worn
// pump hours before the tank runs dry. Run: node scripts/test-fixes.mjs (in npm test).
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createJobStrip } from '../src/ui-jobstrip.js';
import { EV } from '../src/events.js';
import { LEVEL1, WATER_TANK } from '../src/config.js';
import { createRun } from '../src/run.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const H = 1 / 24;

// ---- a minimal DOM: what ui-dom.js h() and ui-jobstrip.js touch ----
function fakeEl(tag) {
  return {
    tagName: tag, className: '', hidden: false, innerHTML: '', children: [], attrs: {},
    setAttribute(k, v) { if (k === 'hidden') this.hidden = true; else this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); },
    addEventListener() {}, querySelector: () => null,
  };
}
/** Run fn with the fake DOM as the page's document (only there: level.js listens to a real page's visibility). */
function withDom(fn) {
  const had = 'document' in globalThis, keep = globalThis.document;
  globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ text: String(t) }), head: fakeEl('head') };
  try { return fn(); } finally { if (had) globalThis.document = keep; else delete globalThis.document; }
}

/** A level through level.js (the job engine, the farm, the records), as test-jobs' makeLevelJs. */
function makeLevelJs(condition) {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, setMode() {}, closePanel() {}, showResult() {}, jobCard: { refresh() {}, reset() {} }, newRun() {} };
  const store = { save: () => true, load: () => null, clear() {}, loadProfile: () => null, saveProfile() {}, info: () => null };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock: { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} }, props, ui });
  level.start({ seed: 1, condition });
  return { ...w, level, ui, player, props, store };
}
/** A run with its save store (the standard starts of a condition). */
function makeRunLevel() {
  const W = makeLevelJs(null);
  const store = { data: null, available: true, save(d) { this.data = JSON.parse(JSON.stringify(d)); return true; }, load() { return this.data; }, clear() { this.data = null; },
    loadProfile: () => null, saveProfile() {}, info() { return null; } };
  W.run = createRun({ level: W.level, save: store, events: W.events, farm: W.farm, env: W.env, records: W.records });
  return W;
}
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the|fail|score|bad farmer|poor/i;

test('1: a panel opened again with no job for it shows no strip (not the strip of its last opening)', () => {
  const W = makeLevelJs(null);
  const L = { env: W.env, farm: W.farm, records: W.records, skills: W.skills, props: W.props, flock: null, player: W.player,
    engine: () => W.level.jobs, clockPaused: () => false };
  const strip = withDom(() => createJobStrip(L, 'water-supply'));
  W.level.debug.goto(-1, 16.5);                              // the prep day's flush is open at the water supply
  const flush = W.level.jobs.byKey('prep-flush@-1');
  assert(flush?.status === 'open', `the flush open at 16:30: ${flush?.status}`);
  strip.onOpen();
  assert(!strip.el.hidden && /Job here/.test(strip.el.innerHTML), 'the strip shows the open flush');
  const first = strip.el.innerHTML;
  strip.onClose();
  // the flush's window ends (02:00): no job for the water supply now
  W.level.debug.goto(0, 3);
  const open = W.level.jobs.open().filter((i) => i.id === 'prep-flush');
  assert(!open.length, 'the flush is no longer open');
  strip.onOpen();
  assert(strip.el.hidden && strip.el.innerHTML === '', `a panel opened again keeps the old strip: hidden ${strip.el.hidden}, ${strip.el.innerHTML.slice(0, 80)}`);
  strip.update();
  assert(strip.el.hidden && strip.el.innerHTML !== first, 'still none after an update');
  // the closed panel holds no html of its opening either
  W.level.debug.goto(0, 3.1);
  strip.onOpen(); strip.onClose();
  assert(strip.el.hidden && strip.el.innerHTML === '', 'closing clears the strip');
});

/** A bad batch at the truck: four stacks graded by hand at the table, every stack tipped, the hatchery not called yet. */
function badBatchNoCall({ morning = true } = {}) {
  const W = makeLevelJs('badChicks');
  if (morning) W.level.debug.goto(0, 10.05, { auto: true }); // the prep day and the morning as the ideal (the truck not yet)
  else { W.level.debug.goto(-1, 22, { auto: true }); W.level.debug.goto(0, 10.05); }   // day 0's jobs left to the farmer
  assert(W.farm.flock.inBoxes > 0, `the late truck has come: ${W.farm.flock.inBoxes} in boxes`);
  W.farm.act('sample.box');                                 // the box weighing finds the weak batch: its job opens
  const TIPS = [[-16, -1], [-16, 1], [-10, -1], [-10, 1], [-4, -1], [-4, 1]];
  for (let st = 0; st < 6; st++) {
    if (st < 4) { W.farm.act('chicks.grade', { stack: st }); W.events.emit(EV.ACTION, { id: 'chicks.grade', stack: st, result: { culled: 0 } }); }
    W.farm.act('chicks.tip', { stack: st, chicks: LEVEL1.chicksPlaced / LEVEL1.stacks, x: TIPS[st][0], z: TIPS[st][1] });
  }
  assert(!(W.farm.flock.claimed > 0) && W.farm.flock.gradedOut > 100, `graded out ${W.farm.flock.gradedOut}, claimed ${W.farm.flock.claimed}`);
  W.env.setHeaterSetpoint(W.env.targetTemp + 0.5);          // the brooders at the weak batch's row
  return W;
}
const call = (W) => W.events.emit(EV.ACTION, { id: 'phone.hatchery', chickWeightG: 36, weakPct: 4 });

test('2: a bad batch: day 0 signed at 20:00 before the call does not fail; a call at 22:00 claims and the week runs on', () => {
  const W = badBatchNoCall();
  W.level.debug.goto(0, 20);
  const job = W.level.jobs.list().find((i) => i.id === 'p-weak-batch');
  assert(job && job.status === 'open' && Math.abs(job.closesAt - 1) < 1e-9 && job.def.hardClose, `the job's window is the claim's: ${job?.status}, closes ${job?.closesAt}`);
  assert(W.level.levelDeaths().pct > 2.5, `over the limit before the call: ${W.level.levelDeaths().pct.toFixed(2)} %`);
  W.records.sign(0);
  assert(W.level.mode === 'level' && !W.level.result, `the level runs on after day 0's record (the claim open until 24:00): ${W.level.mode}`);
  W.level.debug.goto(0, 22);
  call(W);
  assert(W.farm.flock.claimed > 0 && W.level.levelDeaths().pct < 2.5, `claimed ${W.farm.flock.claimed}: ${W.level.levelDeaths().pct.toFixed(2)} %`);
  assert(W.level.jobs.byKey(job.key).status === 'done', `the job done by the call at 22:00: ${W.level.jobs.byKey(job.key).status}`);
  W.level.debug.goto(1, 2);
  assert(W.level.mode === 'level' && !W.level.result, 'no fail at 24:00 once claimed');
  // the save keeps the wait: a reload at 21:00 before the call still fails at 24:00 (next test) or passes once called
  const X = badBatchNoCall();
  X.level.debug.goto(0, 20); X.records.sign(0);
  const blob = JSON.parse(JSON.stringify(X.level.saveBlob()));
  assert(blob.level?.bad?.wait === 0 || JSON.stringify(blob).includes('"wait":0'), 'the wait is saved');
});

test('2: a bad batch without the call by 24:00 fails at 24:00 of day 0 on its culls; a call after 24:00 claims nothing', () => {
  const W = badBatchNoCall();
  W.level.debug.goto(0, 20);
  W.records.sign(0);
  assert(W.level.mode === 'level', `runs on at 20:00: ${W.level.result?.failText}`);
  W.level.debug.goto(0, 23.9);
  assert(W.level.mode === 'level', 'runs on at 23:54');
  W.level.debug.goto(1, 3);
  const r = W.level.result;
  assert(r && !r.pass && r.reason === 'mortality', `failed: ${r?.reason} ${r?.pass}`);
  assert(r.day === 1 && r.hour < 0.1, `at 24:00 of day 0: ${r.endedAt}`);
  assert(/graded out on day 0 count as culls: the hatchery was not told on day 0/.test(r.failText), r.failText);
  // the job closed with the claim and was not held (hardClose): a call after 24:00 does not count
  const Y = badBatchNoCall();
  Y.ui.openPanelId = 'office-desk'; Y.ui.panelKind = 'panel';
  const run = (sec) => { for (let t = 0; t < sec; t += 0.5) { Y.env.update(0.5); Y.level.update(0.5); } };
  Y.level.debug.goto(0, 23.95);
  while (Y.env.day < 1 + 2 / 1440 && Y.level.mode === 'level') run(0.5);
  const j = Y.level.jobs.list().find((i) => i.id === 'p-weak-batch');
  assert(j.status === 'missed' && j.heldFrom == null, `the job closed at 24:00 with its panel open: ${j.status}`);
  call(Y);
  assert(!(Y.farm.flock.claimed > 0), 'a call after 24:00 claims nothing');
});

test('3: the water condition\'s worn pump left unrepaired: the watch\'s supply row warns hours before the tank runs dry (the intake row still steady), with the tank, the pump and where to look', () => {
  const W = makeRunLevel();
  W.run.startRun({ seed: 1, at: 'level1', condition: 'water' });
  W.run.startLevel('weeks45', { from: 'standard', condition: 'water' });
  assert(W.level.def.id === 'weeks45' && W.farm.condition === 'water', `weeks 4-5 of the water condition: ${W.level.def.id}`);
  const warns = [];
  W.events.on(EV.WATCH, (p) => warns.push({ ...p, t: p.day + p.hour / 24, intake: W.level.watch.status().rows.intake?.state, supply: W.level.watch.status().rows.supply }));
  let under20 = null;
  W.env.addStepper(() => { if (under20 == null && W.farm.mode === 'level' && W.farm.waterTank.levelPct < WATER_TANK.linesFromPct) under20 = W.env.day; });
  W.level.debug.goto(29, 7.5, { auto: true, profile: 'waterPumpUnfixed' });
  const r0 = W.level.watch.status().rows.supply;
  assert(r0 && r0.state === 'amber' && /bar/.test(r0.detail), `the worn pump reads amber before the afternoons: ${JSON.stringify(r0)}`);
  W.level.debug.goto(30, 22, { auto: true, profile: 'waterPumpUnfixed' });
  const sup = warns.find((w) => w.kind === 'supply');
  assert(under20 != null, 'the tank fell under 20 % on day 30');
  assert(sup, `a supply warning: ${warns.map((w) => `d${w.day} ${w.hour} ${w.kind}`).join(', ')}`);
  const ahead = (under20 - sup.t) * 24;
  console.log(`     supply warning d${sup.day} ${sup.hour.toFixed(2)}, the tank under 20 % at d${Math.floor(under20)} ${((under20 % 1) * 24).toFixed(2)} (${ahead.toFixed(1)} farm hours ahead); intake ${sup.intake}\n     "${sup.text}"`);
  assert(ahead >= 4, `warned ${ahead.toFixed(1)} farm hours before the tank was under 20 % (at least 4)`);
  assert(!warns.some((w) => w.t < sup.t - 1e-6), 'the supply warning is the first one');
  assert(sup.sign === 'water-tank' && sup.place === 'water-tank' && /water tank/.test(sup.text) && /well pump/.test(sup.text) && /bar/.test(sup.text) && /water meter at the water supply/.test(sup.text),
    `what, why and where: ${sup.sign} ${sup.place} "${sup.text}"`);
  assert(!VERDICT.test(sup.text), `neutral words: ${sup.text}`);
  // the save keeps the tank in the samples: a resume reads the supply row at once
  const blob = JSON.parse(JSON.stringify(W.level.saveBlob()));
  const R = makeRunLevel();
  assert(R.level.resume(blob), 'resume');
  const rr = R.level.watch.status().rows.supply;
  assert(rr && rr.state === W.level.watch.status().rows.supply.state && R.level.watch.samples.some((x) => x.tank), `the supply row after the resume: ${JSON.stringify(rr)}`);
});

test('3: the water condition\'s ideal (the pump read and repaired when worn): no supply warning; amber while worn or under repair, steady after', () => {
  const W = makeRunLevel();
  W.run.startRun({ seed: 1, at: 'level1', condition: 'water' });
  W.run.startLevel('weeks45', { from: 'standard', condition: 'water' });
  const states = new Set(), warns = [];
  W.events.on(EV.WATCH, (p) => warns.push(p));
  for (const [d, h] of [[26, 15], [27, 7], [27, 9], [27, 12], [28, 15], [31, 15]]) {
    W.level.debug.goto(d, h, { auto: true });
    const r = W.level.watch.status().rows.supply;
    states.add(`d${d} ${h} ${r?.state}`);
  }
  console.log(`     ${[...states].join(' · ')}`);
  assert(!warns.some((w) => w.kind === 'supply'), `no supply warning for the ideal: ${warns.map((w) => `d${w.day} ${w.kind}`).join(', ')}`);
  assert(states.has('d27 7 amber') && states.has('d28 15 green') && states.has('d31 15 green'), [...states].join(', '));
  // no supply row outside the water condition
  const N = makeRunLevel();
  N.run.startRun({ seed: 1, at: 'level1', condition: null });
  N.level.debug.goto(1, 12, { auto: true });
  assert(N.level.watch.status().on && !N.level.watch.status().rows.supply, 'no supply row in the normal season');
});

test('4: b-warm holds over its window: open after the thermostat is set, done at 54 farm hours in the band; set back at once, missed', () => {
  const W = badBatchNoCall({ morning: false }); call(W);
  W.env.setHeaterSetpoint(35);                              // day 0: the row 34 °C + 1
  W.level.debug.goto(0, 14);
  const key = 'b-warm@0', j = () => W.level.jobs.byKey(key);
  assert(j()?.status === 'open', `open, not done on its first tick: ${j()?.status}`);
  const parts = W.level.engine.parts(j());
  assert(parts.length === 1 && !parts[0].met && j().progress > 0.05 && j().progress < 0.2, `the hours not yet: ${JSON.stringify(parts.map((p) => [p.label, p.met]))}, progress ${j().progress}`);
  W.level.debug.goto(2, 12);
  assert(j().status === 'open' && W.farm.condX.warmH > 40 && W.farm.condX.warmH < 54, `still open on day 2 at noon: ${j().status}, ${W.farm.condX.warmH} h`);
  W.level.debug.goto(3, 5);
  assert(j().status === 'done', `done once 54 farm hours in the band: ${j().status}, ${W.farm.condX.warmH} h`);
  const X = badBatchNoCall({ morning: false }); call(X);
  X.env.setHeaterSetpoint(35); X.level.debug.goto(0, 13);
  X.env.setHeaterSetpoint(34); X.level.debug.goto(3, 7);   // back to the row at once
  assert(X.level.jobs.byKey(key).status === 'missed', `missed: ${X.level.jobs.byKey(key).status}, ${X.farm.condX.warmH} h`);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
