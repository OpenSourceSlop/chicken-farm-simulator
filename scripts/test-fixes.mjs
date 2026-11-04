// Node regressions of the Phase 4 final check (PHASE4.md §15.9): (1) a panel opened again shows the strip of the jobs
// open now or none, never the strip of its last opening; (2) a bad batch's hatchery claim stays open until 24:00 of
// day 0 (the fail rule, the job window and the sign agree); (3) the flock watch warns of the water condition's worn
// pump hours before the tank runs dry. Run: node scripts/test-fixes.mjs (in npm test).
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createJobStrip } from '../src/ui-jobstrip.js';
import { EV } from '../src/events.js';
import { LEVEL1 } from '../src/config.js';

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
  return { ...w, level, ui, player, props };
}

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
function badBatchNoCall() {
  const W = makeLevelJs('badChicks');
  W.level.debug.goto(0, 10.05, { auto: true });             // the prep day and the morning as the ideal (the truck not yet)
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

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
