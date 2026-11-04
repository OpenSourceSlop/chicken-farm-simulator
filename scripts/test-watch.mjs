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
import { LEVEL1, feedStdGAt as feedStd } from '../src/config.js';
import { WATCH, refShare, causeOf } from '../src/flock-watch.js';
import { cycleProfileOf } from '../src/farm-profiles-cycle.js';
import { p2ProfileFor } from '../src/farm-profiles-cond.js';

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
    // review round: the ideal farmer's auto play of a standard start raises no notice and writes no notebook line
    assert(!L.warns.length && !L.records.notebook.some((n) => n.kind === 'watch'), `${lv}: the standard start is quiet: ${show(L.warns)}`);
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
  // review round: the card's rows are there at once after Continue (the watch restored once the level runs)
  assert(M.level.watch.status().on && M.level.watch.status().rows.comfort, 'the watch reads at once after the resume');
  M.level.update(0.1);
  M.level.debug.goto(1, 15.02);
  const after = M.level.watch.status();
  console.log(`     the watch in the save: ${kb.toFixed(1)} KB, ${n0} samples, ${w0} warnings`);
  assert(kb < 8, `the watch's part of the save ${kb.toFixed(1)} KB`);
  assert(M.level.watch.samples.length >= Math.min(n0 + 1, WATCH.keepH) && M.level.watch.warnings.length === w0, `samples ${M.level.watch.samples.length}, warnings ${M.level.watch.warnings.length}`);
  assert(after.on && after.rows.comfort.state === before.rows.comfort.state && after.rows.weight.state === before.rows.weight.state, `rows after resume: ${JSON.stringify(after.rows.comfort)} / ${JSON.stringify(before.rows.comfort)}`);
  assert(!M.warns.some((w) => w.kind === 'cold'), 'no second cold warning after the resume (the memory came along)');
  const hrs = M.level.watch.samples.map((x) => Math.floor(x.t * 24 + 0.01));   // (t is saved to 1e-5 day)
  assert(new Set(hrs).size === hrs.length, `no farm hour sampled twice after the resume: ${hrs.slice(-4).join(' ')}`);
});

// ---------------- review round ----------------
const playLevel = (L, profile = 'ideal') => {
  const def = L.level.def;
  L.level.debug.goto(def.endDay, 21, { auto: true, profile });
  if (!L.level.result) L.level.debug.goto(def.endDay + 1, 6.05);
  return L.level.result;
};
test('the comfort row reads the birds now: two fans and no pad at 36 °C on day 30 of the hot season read "hot now" within 10 farm minutes', () => {
  const L = makeLevel();
  L.run.startRun({ seed: 1, at: 'level1', condition: 'hot' });
  L.run.startLevel('weeks45', { from: 'standard', condition: 'hot' });
  L.level.debug.goto(30, 14.5, { auto: true });
  const before = L.level.watch.status().rows.comfort;
  L.env.setFans(2); L.env.setPad(false);
  L.level.debug.goto(30, 14.5 + 10 / 60);
  const c = L.level.watch.status().rows.comfort, felt = L.farm.comfort.feltMean;
  console.log(`     before "${before.value} · ${before.detail}"; 10 farm minutes after: "${c.value} · ${c.detail}" (${c.state}); the model: felt ${felt.toFixed(1)} °C, ${Math.round(L.farm.comfort.pantShare * 100)} % panting, house ${L.env.houseTemp.toFixed(1)} °C`);
  assert(c.now === 'hot' && /hot now/.test(c.value) && c.state !== 'green', `the row says hot now: ${c.value} (${c.state})`);
  assert(c.detail.includes(`felt ${(Math.round(felt * 10) / 10).toFixed(1)} °C`), `the live felt figure: ${c.detail} / ${felt}`);
});
test('where to look follows the condition: the hot season\'s brooding sun (the pad pump), the water problem\'s tank, the power cut\'s generator; cold from the fans at the fan panel', () => {
  const H = makeLevel();
  H.run.startRun({ seed: 1, at: 'level1', condition: 'hot' });
  const P = { ...profileOf('ideal'), ...p2ProfileFor(cycleProfileOf('hotNoBroodAir', { condition: 'hot' })) };
  playLevel(H, P);
  const hw = H.warns.filter((w) => w.kind === 'hot');
  assert(hw.length && hw.every((w) => /pad pump/.test(w.text) && !/thermostat/.test(w.text)), `hot brooding without the pad: the pad pump, not the thermostat: ${hw[0]?.text}`);
  const W = makeLevel();
  W.run.startRun({ seed: 1, at: 'level1', condition: 'water' });
  W.run.startLevel('weeks45', { from: 'standard', condition: 'water' }); W.warns.length = 0;
  playLevel(W, 'waterPumpUnfixed');
  assert(W.warns.length && W.warns.every((w) => w.sign === 'water-tank' && /well pump/.test(w.text)), `the pump left worn: the tank and the well pump: ${show(W.warns)} ${W.warns[0]?.text}`);
  const R = makeLevel();
  R.run.startRun({ seed: 1, at: 'level1', condition: 'rainy' });
  R.run.startLevel('weeks45', { from: 'standard', condition: 'rainy' }); R.warns.length = 0;
  let cutWarn = null;
  R.events.on(EV.WATCH, (p) => { if (R.farm.power?.on === false && !cutWarn) cutWarn = p; });
  playLevel(R, 'rainyNoGenerator');
  assert(cutWarn && cutWarn.sign === 'sign-power' && /generator/.test(cutWarn.text), `a warning in the cut names the generator: ${cutWarn?.text}`);
  console.log(`     hot brooding: "${hw[0].text}"\n     water: "${W.warns[0].text}"\n     the cut: "${cutWarn.text}"`);
  const fan = causeOf('cold', 16, { windChill: 6.8, airSpeed: 2.5, fans: 6 });
  assert(fan.sign === 'sign-heat' && fan.place === 'fan-panel' && /moving air/.test(fan.why), `cold from the fans at day 16: ${JSON.stringify(fan)}`);
  assert(causeOf('cold', 16, {}).check.includes('thermostat'), 'cold in still air at day 16: the thermostat');
});
// every warning the ideal meets through the cycle under each condition is one of the documented problem events
const ALLOWED = [
  ['day 3 low water flow (the blocked filter)', (w) => w.kind === 'intake' && w.day === 3 && w.sign === 'sign-water'],
  ['day 33 humid heat', (w) => w.kind === 'hot' && w.day === 33],
  ['week 3 coccidiosis (disease deaths at the droppings sign)', (w) => w.kind === 'deaths' && w.day >= 19 && w.day <= 21 && w.sign === 'sign-droppings'],
  ['a bad batch\'s culls before the hatchery call', (w) => w.kind === 'deaths' && w.day === 0 && w.place === 'office-desk' && /hatchery/.test(w.text)],
];
test('the ideal through the cycle under each condition: every warning is a documented problem event (no comfort alerts in the rainy season\'s damp spells, none for a bad batch\'s warmer nights)', () => {
  for (const c of [null, 'hot', 'rainy', 'water', 'badChicks']) {
    const L = makeLevel();
    L.run.startRun({ seed: 1, at: 'level1', condition: c });
    const got = [];
    for (let i = 0; i < 7; i++) {
      const r = playLevel(L);
      assert(r && r.pass, `${c || 'normal'} ${L.level.def.id}: the ideal passes (${r?.failText})`);
      if (L.level.def.id === 'cleanout' || !L.run.next()) break;
    }
    for (const w of L.warns) { const a = ALLOWED.find(([, f]) => f(w)); assert(a, `${c || 'normal'}: a warning outside the problem events: d${w.day} ${w.hour} ${w.kind}: ${w.text}`); got.push(`d${w.day} ${w.kind}`); }
    console.log(`     ${c || 'normal'}: ${got.join(', ') || 'none'}`);
  }
});

// ---------------- Phase 5 (PHASE5.md §6.8.1, §6.8.4; package saves) ----------------
const hourly = (L, from, to, profile, each) => {
  for (let t = from; t <= to + 1e-9; t += H) {
    const d = Math.floor(t + 1e-9), hr = Math.round((t - d) * 24);
    L.level.debug.goto(d, hr + 0.01, { auto: true, profile });
    if (L.level.result) return;
    each(d, hr);
  }
};
test('Phase 5 §6.8.1: the water condition\'s ideal on day 33 reads Supply steady with a full tank (the meter alone no longer raises it); the worn pump left still warns 6 farm hours ahead', () => {
  const W = makeLevel();
  W.run.startRun({ seed: 1, at: 'level1', condition: 'water' });
  W.run.startLevel('weeks45', { from: 'standard', condition: 'water' });
  const odd = [], at = {};
  hourly(W, 32 + 18 * H, 34 + 6 * H, 'ideal', (d, hr) => {
    const r = W.level.watch.status().rows.supply, t = W.farm.waterTank;
    if (d === 33 && (hr === 12 || hr === 15)) at[hr] = `${r?.state} (tank ${t.levelPct.toFixed(1)} %, ${r?.detail})`;
    // a full tank, not falling, the pump at its plate: no reason for amber (main read amber here on the meter alone)
    if (r && r.state !== 'green' && t.levelPct >= 90 && !(r.fall >= WATCH.supplyFallMin) && !r.worn && r.tank.on) odd.push(`d${d} ${hr} ${r.state} ${r.detail}`);
  });
  console.log(`     day 33 12:00 ${at[12]}; 15:00 ${at[15]}`);
  assert(/^green/.test(at[12] || '') && /^green/.test(at[15] || ''), `Supply steady at 12:00 and 15:00 of day 33: ${JSON.stringify(at)}`);
  assert(W.farm.waterTank.levelPct >= 90, `the tank full: ${W.farm.waterTank.levelPct}`);
  assert(!odd.length, `amber with a full tank and the pump at its plate: ${odd.join('; ')}`);
  // the worn pump left unrepaired still warns hours before the tank is under the lines' 20 %
  const U = makeLevel();
  U.run.startRun({ seed: 1, at: 'level1', condition: 'water' });
  U.run.startLevel('weeks45', { from: 'standard', condition: 'water' });
  let under20 = null;
  U.env.addStepper(() => { if (under20 == null && U.farm.mode === 'level' && U.farm.waterTank.levelPct < 20) under20 = U.env.day; });
  U.warns.length = 0;
  U.level.debug.goto(30, 22, { auto: true, profile: 'waterPumpUnfixed' });
  const sup = U.warns.find((w) => w.kind === 'supply'), ahead = sup && under20 != null ? (under20 - (sup.day + sup.hour * H)) * 24 : null;
  console.log(`     waterPumpUnfixed: supply warning d${sup?.day} ${sup?.hour?.toFixed(2)}, the tank under 20 % ${ahead?.toFixed(1)} farm hours later`);
  assert(sup && ahead >= 6, `warned ${ahead?.toFixed(1)} farm hours ahead (at least 6)`);
});
// main before the change (measured by the saves package, waterFilterLate from a standard start of weeks 4-5, hour by
// hour): no EV.WATCH warning on days 24-25; the intake row amber from day 24 09:00 to day 25 08:00 (feed 80-86 %)
const FILTER_MAIN = { from: 24 + 9 * H, to: 25 + 8 * H };
test('Phase 5 §6.8.1: the iron filter left until its flow test is skipped (waterFilterLate) still shows: the intake row out of steady over main\'s hours, its cause the water supply\'s filter, its plate and place', () => {
  const W = makeLevel();
  W.run.startRun({ seed: 1, at: 'level1', condition: 'water' });
  W.run.startLevel('weeks45', { from: 'standard', condition: 'water' });
  W.warns.length = 0;
  const off = [], named = [], other = [];
  hourly(W, 22, 26, 'waterFilterLate', (d, hr) => {
    const r = W.level.watch.status().rows, t = d + hr * H;
    if (t < 24 - 1e-9 || t > 26 - 1e-9) return;
    const out = r.intake && r.intake.state !== 'green';
    if (out) off.push(t);
    if (out && r.intake.cause?.sign === 'water-supply' && r.intake.cause.place === 'water-supply' && /water supply’s filter/.test(r.intake.cause.why) && /filter gauges/.test(r.intake.detail)) named.push(t);
    else if (out && W.farm.condX?.filterK) other.push(`d${d} ${hr} ${JSON.stringify(r.intake.cause)}`);
  });
  const span = (a) => (a.length ? `d${Math.floor(a[0])} ${Math.round((a[0] % 1) * 24)}:00 – d${Math.floor(a[a.length - 1])} ${Math.round((a[a.length - 1] % 1) * 24)}:00 (${a.length} h)` : 'none');
  console.log(`     intake out of steady ${span(off)} (main: d24 9:00 – d25 8:00); the filter named ${span(named)}; warnings d24-25: ${show(W.warns.filter((w) => w.day >= 24 && w.day <= 25)) || 'none'}`);
  assert(off.length && Math.abs(off[0] - FILTER_MAIN.from) < 1e-6 && Math.abs(off[off.length - 1] - FILTER_MAIN.to) < 1e-6, `the same hours as on main: ${span(off)}`);
  assert(named.length >= 18 && Math.abs(named[0] - FILTER_MAIN.from) < 1e-6, `the cause names the filter while it is clogged: ${span(named)}`);
  assert(!other.length, `an hour with the filter clogged and another cause: ${other.join('; ')}`);
  assert(!W.warns.some((w) => w.day >= 24 && w.day <= 25), `no new warning on days 24-25 (as on main): ${show(W.warns)}`);
});
test('Phase 5 §6.8.4: the hot ideal\'s intake row expects the hot season\'s appetite: never out of steady on days 21-41 from fHot alone; the note on the row', () => {
  const L = makeLevel();
  L.run.startRun({ seed: 1, at: 'level1', condition: 'hot' });
  L.run.startLevel('week3', { from: 'standard', condition: 'hot' });
  let hotRows = 0, noted = 0, raw = 0;
  const out = [];
  L.env.addStepper(() => {
    const s = L.level.watch.samples, last = s[s.length - 1];
    if (!last || L.farm.mode !== 'level' || last.age + 0 < 0 || L.env.day < 21 || L.env.day >= 42 || last.counted) return;
    last.counted = true;
    const r = L.level.watch.status().rows.intake;
    if (!r) return;
    if (r.hot) { hotRows++; if (/hot season: the birds eat a little less/.test(r.detail)) noted++; }
    // the same window without the expectation (the standard alone): how often fHot alone would have read amber
    let eat = 0, want = 0, n = 0;
    for (let i = s.length - 1; i > 0 && n < WATCH.litH; i--) {
      const a = s[i - 1], b = s[i];
      if (!a.lit || !b.lit || a.excl || b.excl || b.t - a.t > 1.5 * H) continue;
      eat += b.feedKg - a.feedKg; want += (a.alive * feedStd(a.age)) / 1000 / a.litH * ((b.t - a.t) * 24); n++;
    }
    if (n >= 3 && want > 0 && eat / want < WATCH.intakeGreen) raw++;
    if (r.state !== 'green') out.push(`d${Math.floor(last.t)} ${Math.round((last.t % 1) * 24)} ${r.state} ${r.value}`);
  });
  for (let i = 0; i < 3; i++) { const r = playLevel(L); assert(r && r.pass, `${L.level.def.id}: ${r?.failText}`); if (L.level.def.id === 'finish' || !L.run.next()) break; }
  console.log(`     hours with the hot-season expectation ${hotRows} (noted ${noted}); without it the feed would read under ${WATCH.intakeGreen * 100} % in ${raw} hours; out of steady: ${out.join(', ') || 'none'}`);
  assert(hotRows > 50 && noted === hotRows, `the row carries the hot-season note: ${noted} / ${hotRows}`);
  assert(!out.length, `the intake row out of steady from fHot alone: ${out.join(', ')}`);
  assert(!L.warns.some((w) => w.kind === 'intake' && w.day >= 21), `no intake warning: ${show(L.warns)}`);
});

if (failed) { console.log(`${failed} failed`); process.exit(1); } else console.log('all passed');
