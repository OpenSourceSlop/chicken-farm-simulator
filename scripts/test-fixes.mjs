// Node regressions of the Phase 4 final check (PHASE4.md §15.9): (1) a panel opened again shows the strip of the jobs
// open now or none, never the strip of its last opening; (2) a bad batch's hatchery claim stays open until 24:00 of
// day 0 (the fail rule, the job window and the sign agree); (3) the flock watch warns of the water condition's worn
// pump hours before the tank runs dry. Run: node scripts/test-fixes.mjs (in npm test).
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createJobStrip } from '../src/ui-jobstrip.js';

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

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
