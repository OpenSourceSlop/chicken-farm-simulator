// The flock watch (the farmer's request during Phase 4, PHASE4.md §15.1) on the real farm through level.js, in node:
// the ideal brooding week stays calm and passes; the thermostat 4 °C under the brooder sign's row all week fails on
// deaths and the watch warns at least a farm day before; acting on that first warning (the thermostat back to the sign's
// row) lets the week pass; week 2 neglected and week 3's coccidiosis left warn a day before they end; the warning texts
// say what, why and where in neutral words; serialize -> restore keeps the samples and the warning memory.
//   node scripts/test-watch.mjs        (part of npm test)
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createRun } from '../src/run.js';
import { profileOf } from '../src/farm-profiles.js';
import { EV } from '../src/events.js';
import { LEVEL1 } from '../src/config.js';
import { WATCH, refShare } from '../src/flock-watch.js';

let failed = 0;
function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const t0 = Date.now();
  try { fn(); console.log(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); if (process.env.TRACE) console.log(err.stack); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the|fail|score|bad farmer|poor/i;

function makeLevel() {
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
  const warns = [];
  w.events.on(EV.WATCH, (p) => warns.push(p));
  return { ...w, level, run, ui, store, warns };
}
const H = 1 / 24;
const show = (ws) => ws.map((x) => `d${x.day} ${x.hour.toFixed(2)} ${x.kind}`).join(', ');
/** Play the brooding week hour by hour with profile P until `stop()` holds (or the level ends). */
function playUntil(L, P, stop) {
  for (let d = -1; d <= 8; d++) for (let hr = d === -1 ? 8 : 0; hr < 24; hr++) {
    if (L.level.result || stop()) return;
    L.level.debug.goto(d, hr + 0.01, { auto: true, profile: P });
  }
}
const COLD = { ...profileOf('ideal'), setpointOffset: -4 };   // the thermostat 4 °C under the brooder sign's row

test('the ideal brooding week: no weight, deaths or comfort warning; the level passes; the card reads steady at the end', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(7, 21, { auto: true });
  const r = L.level.result;
  assert(r && r.pass, `the ideal passes: ${r?.failText}`);
  const loud = L.warns.filter((w) => w.kind !== 'intake');
  assert(!loud.length, `no weight / deaths / comfort warnings for the ideal: ${show(loud)}`);
  // the one intake warning the ideal meets is day 3's low water flow (the blocked filter its morning round finds on day 4)
  for (const w of L.warns) assert(/water/.test(w.text), `an intake warning of the ideal names the water: ${w.text}`);
  const st = L.level.watch.status();
  console.log(`     ideal: ${r.ratio.toFixed(2)} x, ${r.deathsPct.toFixed(2)} %; warnings: ${show(L.warns) || 'none'}; rows ${Object.entries(st.rows).map(([k, v]) => `${k} ${v.state}`).join(', ')}`);
  assert(['weight', 'deaths', 'comfort', 'intake'].every((k) => st.rows[k]?.state === 'green'), 'every row steady at the end');
});

let coldFirst = null;
test('the thermostat 4 °C under the sign all week: the level fails on deaths; the first warning a farm day or more before, naming the cold, the brooder sign and the thermostat', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(7, 21, { auto: true, profile: COLD });
  const r = L.level.result;
  assert(r && !r.pass, `the cold week fails: ${r?.pass}`);
  const failT = r.day + r.hour * H;
  const first = L.warns[0];
  assert(first, 'a warning came');
  coldFirst = first;
  const lead = failT - first.t;
  console.log(`     fails ${r.endedAt} (${r.failText}); first warning d${first.day} ${first.hour.toFixed(2)} [${first.kind}], ${lead.toFixed(2)} farm days before; ${L.warns.length} warnings: ${show(L.warns)}`);
  console.log(`     "${first.text}"`);
  assert(lead >= 1, `the first warning ${lead.toFixed(2)} farm days before the fail (at least 1)`);
  assert(first.kind === 'cold' && /cold/.test(first.text) && /brooder sign/.test(first.text) && /thermostat/.test(first.text), `what, why, where: ${first.text}`);
  assert(L.warns.some((w) => w.kind === 'deaths') && L.warns.some((w) => w.kind === 'weight'), `deaths and weight warnings follow: ${show(L.warns)}`);
  // the notebook line (and the day's record row note) for each warning
  const nb = L.records.notebook.filter((n) => n.kind === 'watch');
  assert(nb.length === L.warns.length && nb[0].value === first.text, `notebook lines ${nb.length} / ${L.warns.length}`);
  const row0 = L.records.row(first.day);
  assert(row0 && row0.notes.some((t) => t.includes(first.text)), 'the day\'s record row carries the warning');
});

test('acting on the first warning (the thermostat back to the sign\'s row) lets the cold week pass', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  playUntil(L, COLD, () => L.warns.length > 0);
  const first = L.warns[0];
  assert(first && coldFirst && Math.abs(first.t - coldFirst.t) < 1.01 / 24, `the same first warning when played hour by hour: ${first?.t} vs ${coldFirst?.t}`);
  L.env.setHeaterSetpoint(L.env.targetTemp);   // what the warning says: the thermostat to the brooder sign's row
  L.level.debug.goto(7, 21, { auto: true });
  const r = L.level.result;
  console.log(`     acted at d${first.day} ${first.hour.toFixed(2)}: ${r?.pass ? 'passes' : 'does not pass'} at ${r?.ratio?.toFixed(2)} x, deaths ${r?.deathsPct?.toFixed(2)} %; later warnings ${show(L.warns.slice(1)) || 'none'}`);
  assert(r && r.pass, `passes once acted on: ${r?.failText}`);
});

test('week 2 neglected (noCare) and week 3 with the coccidiosis left (cocciUntreated): a warning a farm day before the level ends without a pass', () => {
  for (const [lv, prof] of [['week2', 'noCare'], ['week3', 'cocciUntreated']]) {
    const L = makeLevel();
    L.run.startRun({ seed: 1 });
    L.run.startLevel(lv, { from: 'standard' });
    L.warns.length = 0;
    const def = L.level.def;
    L.level.debug.goto(def.endDay, 21, { auto: true, profile: prof });
    if (!L.level.result) L.level.debug.goto(def.endDay + 1, 6.05);
    const r = L.level.result;
    assert(r && !r.pass, `${lv} ${prof} does not pass: ${r?.failText}`);
    const endT = r.day + r.hour * H, first = L.warns[0];
    console.log(`     ${lv} ${prof}: ${r.failText}; ended ${r.endedAt}; warnings ${show(L.warns)}`);
    assert(first && endT - first.t >= 1, `${lv}: the first warning ${first ? (endT - first.t).toFixed(2) : '—'} farm days before the end (at least 1)`);
  }
});

test('warning texts: what, why and where in neutral words; every state word and row label verdict-free', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(7, 21, { auto: true, profile: COLD });
  for (const w of L.warns) {
    assert(!VERDICT.test(w.text), `verdict word in "${w.text}"`);
    assert(/ See .+; check .+\.$/.test(w.text), `names the sign and the place: "${w.text}"`);
    assert(w.sign && w.place && w.cause, `sign / place / cause fields: ${JSON.stringify(w)}`);
  }
  const st = L.level.watch.status();
  for (const r of Object.values(st.rows)) assert(!VERDICT.test(`${r.value} ${r.detail}`), `verdict word in a row: ${r.value} ${r.detail}`);
  assert(refShare(0) > 0.95 && refShare(1.5) < 0.9 && refShare(7) > 1.05 && refShare(20) === 1, 'the brooding week\'s growth path');
  assert(WATCH.comfortRed === 4 && WATCH.windowH === 8, 'the comfort window');
});

test('save -> resume keeps the watch: samples, the warning memory and the rows', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(1, 14, { auto: true, profile: COLD });
  const blob = JSON.parse(JSON.stringify(L.level.saveBlob()));
  const kb = JSON.stringify(blob.level.watch).length / 1024;
  const before = L.level.watch.status(), n0 = L.level.watch.samples.length, w0 = L.level.watch.warnings.length;
  const M = makeLevel();
  M.level.resume(blob);
  M.level.update(0.1);
  M.level.debug.goto(1, 15.02);
  const after = M.level.watch.status();
  console.log(`     the watch in the save: ${kb.toFixed(1)} KB, ${n0} samples, ${w0} warnings`);
  assert(kb < 8, `the watch's part of the save ${kb.toFixed(1)} KB`);
  assert(M.level.watch.samples.length >= Math.min(n0 + 1, WATCH.keepH) && M.level.watch.warnings.length === w0, `samples ${M.level.watch.samples.length}, warnings ${M.level.watch.warnings.length}`);
  assert(after.on && after.rows.comfort.state === before.rows.comfort.state && after.rows.weight.state === before.rows.weight.state, `rows after resume: ${JSON.stringify(after.rows.comfort)} / ${JSON.stringify(before.rows.comfort)}`);
  assert(!M.warns.some((w) => w.kind === 'cold'), 'no second cold warning after the resume (the memory came along)');
});

if (failed) { console.log(`${failed} failed`); process.exit(1); } else console.log('all passed');
