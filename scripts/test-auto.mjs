// The level 3 equipment and its faults (SKILLS.md §4, §5, §13.1; package "model"), in node: runCycle with every system on
// (perks 'all') keeps each controller's reading in its band over the whole cycle and passes every level at the ideal's
// figures ± 1 %; the farmer's hand holds a controller for its time; no problem is moved by the equipment; every fault
// through farm.debug.fault (its effect and bound, EV.FAULT, the Equipment row, the flock watch's warning, a skip stopped,
// the night check's row, the fix by hand, the level passing); the fault plan over 200 seeds.
//   node scripts/test-auto.mjs [--quick]    (--quick: 40 seeds for the plan)
import { runCycle } from '../src/farm-profiles-cycle-run.js';
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createRun } from '../src/run.js';
import { EV } from '../src/events.js';
import { SKILLS_UPDATE, LEVEL1, FAULTS, FAULT_PLAN, AUTO, AUTO_SYSTEMS, nippleHeightCmAt, feederRimCmAt, flockAgeAt } from '../src/config.js';
import { ventNeed } from '../src/job-figures.js';
import { feedDays } from '../src/farm-silos.js';
import { lightsOk, rowFor } from '../src/farm-auto-ctl.js';
import { nightCheck, createSkipGuard } from '../src/night-check.js';
import { equipmentRow } from '../src/flock-watch.js';

let failed = 0;
const QUICK = process.argv.includes('--quick');
async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const t0 = Date.now(), was = SKILLS_UPDATE.live;
  try { await fn(); console.log(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); if (process.env.TRACE) console.log(err.stack); } finally { SKILLS_UPDATE.live = was; }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|failed to/i;
const H = 1 / 24;

// ---------------- the whole cycle with every system on ----------------
const ideal = runCycle('ideal');
const M = { winch: 0, winchAt: '', rim: 0, rimAt: '', vent: [], sp: [], feedMin: 9, feedAt: '', lights: [], scale: [], spChanged: 0, spDays: 0, rate: 0 };
let lastH = null, lastSp = null;
const auto = runCycle('ideal', { perks: 'all', onWorld: (w) => w.env.addStepper((e) => {
  const { farm } = w, hr = Math.floor(e.day * 24 + 1e-6);
  if (hr === lastH || farm.mode !== 'level') return;
  lastH = hr;
  const d = e.dayNumber, h = Math.round(e.hour) % 24, catchSoon = farm.harvest && farm.harvest.catchAt != null && e.day >= farm.harvest.catchAt - H;
  if (e.day >= -1 + 9 * H && d <= 41 && !catchSoon) for (const [i, l] of farm.water.lines.entries()) {
    const x = Math.abs(l.heightCm - nippleHeightCmAt(Math.max(0, d)));
    if (x > M.winch) { M.winch = x; M.winchAt = `day ${d} ${h}:00 line ${i + 1} ${l.heightCm} cm`; }
  }
  if (d >= 4 && d <= 40 && !farm.feed.withdrawn && !(farm.cyc && farm.cyc.liftOn) && farm.flock.alive > 0) for (const l of farm.feed.lines) {
    const x = Math.abs(l.heightCm - feederRimCmAt(Math.max(0, flockAgeAt(e.day))));
    if (l.running && x > M.rim) { M.rim = x; M.rimAt = `day ${d} ${h}:00 ${l.heightCm} cm`; }
  }
  if (h === 7 && d >= -1 && d <= 41 && !catchSoon) M.vent.push(ventNeed(e, farm).share);
  if (h === 6 && d >= 0 && d <= 21) { M.spDays++; if (Math.abs(e.heaterSetpoint - rowFor(e, d)) < 1e-6) M.spChanged++; }
  if (d >= 1 && d <= 35 && farm.flock.alive > 0) { const f = feedDays(farm, e); if (f.days != null && f.days < M.feedMin) { M.feedMin = f.days; M.feedAt = `day ${d} ${h}:00`; } }
  if (h === 12 && d >= -1 && d <= 41 && !catchSoon && !lightsOk(e)) M.lights.push(d);
  if (h === 14 && d >= 1 && d <= 41 && farm.flock.alive > 0) { const s = farm.autoCtl.scale(); M.scale.push({ d, n: s.n, r: s.meanG / farm.flock.meanWeightG }); }
  void lastSp;
}) });
const near = (a, b, p) => Math.abs(a - b) <= Math.abs(b) * p + 1e-9;

await test('every system on (perks all): every level passes at the ideal\'s figures ± 1 % (weight, FCR, EPEF)', () => {
  for (const [k, v] of Object.entries(ideal.levels)) assert(auto.levels[k] && auto.levels[k].pass === v.pass, `${k}: ${auto.levels[k]?.pass} (ideal ${v.pass})`);
  const a = auto.levels.finish, b = ideal.levels.finish;
  assert(near(a.liveG, b.liveG, 0.01) && near(a.fcr, b.fcr, 0.01) && near(a.epef, b.epef, 0.01), `finish ${a.liveG} g FCR ${a.fcr} EPEF ${a.epef} (ideal ${b.liveG} / ${b.fcr} / ${b.epef})`);
  // the weigh-ins within 2 % (the stage table keeps the birds a little cooler than the ideal's fan plan: day 35 about +1.7 %)
  for (const lv of ['week2', 'week3', 'weeks45']) assert(near(auto.levels[lv].weightG, ideal.levels[lv].weightG, 0.02) || auto.levels[lv].weightG == null, `${lv}: ${auto.levels[lv].weightG} g (ideal ${ideal.levels[lv].weightG})`);
  console.log(`     finish ${a.liveG} g, FCR ${a.fcr}, EPEF ${a.epef} (ideal ${b.liveG} g, ${b.fcr}, ${b.epef})`);
});
await test('the winch keeps every line ±3 cm of the drinker plate from day -1 09:00 to day 41; the rims ±3 cm of the feeder plate from day 4', () => {
  assert(M.winch <= 3 + 1e-9, `winch ${M.winch.toFixed(2)} cm off at ${M.winchAt}`);
  assert(M.rim <= 3 + 1e-9, `rims ${M.rim.toFixed(2)} cm off at ${M.rimAt}`);
  console.log(`     winch at most ${M.winch.toFixed(2)} cm off, rims at most ${M.rim.toFixed(2)} cm off`);
});
await test('the timer gives 90-130 % of the vent sign\'s need at every morning; the brooders hold the row at every 06:00 to day 21', () => {
  const lo = Math.min(...M.vent), hi = Math.max(...M.vent);
  assert(M.vent.length >= 40 && lo >= 0.9 && hi <= 1.3, `vent share ${lo.toFixed(2)}–${hi.toFixed(2)} over ${M.vent.length} mornings`);
  assert(M.spDays >= 20 && M.spChanged === M.spDays, `thermostat at the row on ${M.spChanged} of ${M.spDays} mornings`);
  console.log(`     timer ${Math.round(lo * 100)}–${Math.round(hi * 100)} % of the need; thermostat at the row on ${M.spChanged} of ${M.spDays} mornings`);
});
await test('the feed never under a day with the controller ordering (days 1-35); the lights the program of the age; the scale 300 weighings by 14:00 within 1 % of the flock', () => {
  assert(M.feedMin >= 1, `feed ${M.feedMin} days at ${M.feedAt}`);
  assert(!M.lights.length, `lights off the program at noon on days ${M.lights.join(', ')}`);
  const sc = M.scale.filter((x) => x.n < AUTO.scaleMinReads || Math.abs(x.r - 1) > 0.01);
  assert(M.scale.length >= 30 && !sc.length, `scale: ${JSON.stringify(sc.slice(0, 3))}`);
  console.log(`     feed at least ${M.feedMin} days; scale ${M.scale.length} days at 14:00, every one ≥ ${AUTO.scaleMinReads} weighings within 1 %`);
});
await test('the stage table keeps the afternoons\' panting (days 15-41, 12:00-17:00) at or under the ideal\'s, heat deaths no more', () => {
  const pant = (r) => r.hourly.filter((x) => x.day >= 15 && x.day <= 41 && x.hour >= 12 && x.hour <= 17).reduce((a, x) => a + x.pantShare, 0);
  const pi = pant(ideal), pa = pant(auto), hi = ideal.farm.flock.deadByCause.heat || 0, ha = auto.farm.flock.deadByCause.heat || 0;
  assert(pa <= pi + 1e-6 && ha <= hi, `panting ${pa.toFixed(2)} (ideal ${pi.toFixed(2)}), heat deaths ${ha} (ideal ${hi})`);
  console.log(`     afternoon panting ${pa.toFixed(2)} bird-hours share (ideal ${pi.toFixed(2)}), heat deaths ${ha} (ideal ${hi})`);
});

// ---------------- the level harness (level.js, the flock watch, the skip guard) ----------------
function makeRun() {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, setMode(m) { this.mode = m; }, closePanel() {}, showResult(r) { this.shown = r; }, jobCard: { refresh() {}, reset() {} }, newRun() {},
    nightCheck(nc) { this.nc = nc; }, skipStopped(t) { this.stops.push(t); }, stops: [] };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} };
  const store = { data: null, available: true, save(d) { this.data = JSON.parse(JSON.stringify(d)); return true; }, load() { return this.data; }, clear() { this.data = null; }, loadProfile: () => null, saveProfile() {}, info() { return null; } };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
  const run = createRun({ level, save: store, events: w.events, farm: w.farm, env: w.env, records: w.records });
  const faults = [], autos = [];
  w.events.on(EV.FAULT, (p) => faults.push(p)); w.events.on(EV.AUTO, (p) => autos.push(p));
  return { ...w, level, run, ui, store, faults, autos };
}
/** A run at `at`, played to day d hour h by the ideal, then `systems` on (the controllers take over from here). */
function at(lv, d, h, systems = []) {
  SKILLS_UPDATE.live = true;
  const R = makeRun();
  R.run.startRun({ seed: 1, at: lv });
  if (d != null) R.level.debug.goto(d, h, { auto: true });
  for (const s of systems) R.farm.auto.on[s] = true;
  return R;
}

await test('the farmer\'s hand holds: his timer until 18:00 then the table; his winching of a line until 06:00; his fans take the stage table off for 2 h', () => {
  const R = at('week2', 10, 9, ['timer', 'winch']);
  R.env.skipHours(0.2);
  R.farm.act('vent.timer', { fans: 2, onSec: 150, cycleSec: 300 });
  R.env.skipHours(17.9 - R.env.hour);
  assert(R.farm.vent.onSec === 150 && R.farm.vent.fans === 2, `17:54 his setting stands: ${JSON.stringify(R.farm.vent)}`);
  R.env.skipHours(0.3);
  const share = ventNeed(R.env, R.farm).share;
  assert(R.farm.vent.onSec !== 150 && share >= 0.9 && share <= 1.3, `18:12 back to the table: ${JSON.stringify(R.farm.vent)} (${(share * 100).toFixed(0)} %)`);
  R.farm.act('water.height', { line: 1, cm: 30 });
  R.env.skipHours(5);
  assert(R.farm.water.lines[1].heightCm === 30 && Math.abs(R.farm.water.lines[0].heightCm - nippleHeightCmAt(10)) <= 1, 'line 2 holds his height overnight, line 1 the plate');
  R.env.skipHours(Math.ceil((Math.floor(R.env.day) + 1 + 6.1 / 24 - R.env.day) * 24) + 3);
  assert(Math.abs(R.farm.water.lines[1].heightCm - nippleHeightCmAt(R.env.dayNumber)) < 30 - nippleHeightCmAt(R.env.dayNumber) - 4, `after 06:00 the winch brings line 2 back (${R.farm.water.lines[1].heightCm} cm)`);
  const S = at('weeks45', 25, 12, ['stages']);
  S.env.skipHours(0.2);
  assert(S.env.fanStages, 'the stage table runs');
  S.env.setFans(1); S.farm.act('vent.fans', { n: 1 });
  assert(!S.env.fanStages && S.env.fansManual === 1, 'his fans take the table off');
  S.env.skipHours(1.9);
  assert(!S.env.fanStages, 'held for 2 farm hours');
  S.env.skipHours(0.3);
  assert(S.env.fanStages, 'the table again after 2 h');
});

await test('no problem moved by equipment: the lights do not fix sudden deaths (no sds-w2), the stages do not mark warm-afternoon3 acted, the timer does not mark the rainy spell acted', () => {
  const R = at('week2', 13, 5, []);
  const sds = R.farm.problems.find((p) => p.id === 'sudden-deaths');
  if (sds && sds.phase === 'active') { sds.phase = 'found'; sds.foundAt = R.env.day; }
  R.farm.act('light.program', { darkStart: 2, darkHours: 1, dimmer: 0.6 });   // the farmer's own program (holds to day 36)
  R.farm.auto.hold = { winch: {}, feed: {} };                                     // let go of his hold: the controller sets the age's
  R.farm.auto.on.lights = true;
  R.env.skipHours(3);
  assert(lightsOk(R.env) && R.autos.some((a) => a.system === 'lights'), 'the controller set the growing program');
  assert(!sds || sds.phase !== 'fixed', `sudden deaths ${sds && sds.phase} after the controller's program`);
  const W = at('week3', 16, 11.5, ['stages']);
  W.env.skipHours(3);
  const w3 = W.farm.problems.find((p) => p.id === 'warm-afternoon3');
  assert(w3 && !w3.acted && !(w3.phase === 'fixed' && w3.fixedBy === 'air'), `warm-afternoon3 ${w3 && w3.phase} acted ${w3 && w3.acted}`);
  const T = at('week2', 9, 6.5, []);
  const rs = T.farm.problems.find((p) => p.id === 'rainy-spell');
  if (rs && (rs.phase === 'active' || rs.phase === 'pending')) { rs.phase = 'found'; rs.foundAt = T.env.day; }
  T.farm.auto.on.timer = true; T.farm.auto.mem.timerBirds = null;
  T.env.skipHours(6);
  assert(T.autos.some((a) => a.system === 'timer') || T.farm.auto.mem.timerBirds != null, 'the timer controller ran');
  assert(!rs || !rs.acted, `rainy spell acted ${rs && rs.acted} by the controller`);
});

// ---------------- every fault through farm.debug.fault (SKILLS.md §5.1, §5.3) ----------------
const plate = (R) => Math.round(nippleHeightCmAt(Math.max(0, R.env.dayNumber)));
const FCASES = [
  { id: 'winch-stall', lv: 'weeks45', d: 24, h: 9, sys: ['winch'], opts: { line: 2 },
    effect: (R, f) => { const cm = f.args.cm; R.env.skipHours(12); assert(R.farm.water.lines[2].heightCm === cm && [0, 1, 3].every((i) => Math.abs(R.farm.water.lines[i].heightCm - nippleHeightCmAt(R.env.dayNumber)) <= 3), `line 3 stays at ${cm} cm, the others follow the plate`); assert(plate(R) - cm <= 3, 'a line 3 cm low a day later at most'); },
    fix: (R) => { R.farm.act('water.height', { line: 2, cm: plate(R) }); R.farm.act('auto.reset', { system: 'winch', line: 2 }); } },
  { id: 'timer-reset', lv: 'week2', d: 9, h: 9, sys: ['timer'],
    effect: (R) => { const s = FAULTS['timer-reset'].firstSetting; assert(R.farm.vent.fans === s.fans && R.farm.vent.onSec === s.onSec, `the first setting: ${JSON.stringify(R.farm.vent)}`); },
    fix: (R) => R.farm.act('vent.timer', { fans: 1, onSec: 40, cycleSec: 300 }) },
  { id: 'stage-trip', lv: 'weeks45', d: 25, h: 8.5, sys: ['stages'], pre: 0.5,
    effect: (R, f) => { assert(!R.env.fanStages && R.env.fansManual === f.args.fans, `the stages off, the fans stay at ${f.args.fans}`); },
    fix: (R) => R.farm.act('auto.reset', { system: 'stages' }) },
  { id: 'sensor-drift', lv: 'level1', d: 2, h: 9, sys: ['brooders'], pre: 0.2, wait: 2.2,
    effect: (R) => { const a = R.farm.auto; assert(a.drift >= 1 && a.drift <= FAULTS['sensor-drift'].driftMaxC && Math.abs(R.env.heaterSetpoint - (a.setC - a.drift)) <= 0.25 + 1e-6, `drift ${a.drift} °C, thermostat ${R.env.heaterSetpoint} (set ${a.setC})`); },
    fix: (R) => { R.farm.act('heat.setpoint', { c: R.farm.auto.setC + 1 }); assert(R.farm.auto.faults.some((f) => f.id === 'sensor-drift' && f.phase === 'open'), 'a hand thermostat setting does not fix the drift'); R.farm.act('auto.calibrate'); } },
  { id: 'order-lost', lv: 'week3', d: 17, h: 8, sys: ['feed'], wait: 6.1,
    effect: (R) => { const p = R.farm.feed.pending.length; R.env.skipHours(1); assert(R.farm.feed.pending.length <= p, 'no automatic order goes in while the order is lost'); },
    fix: (R) => { const o = R.farm.act('feed.order', { kg: 2000, type: 'grower' }); assert(o.arriveDay === R.env.dayNumber + 1, `ordered before 16:00 the truck comes tomorrow (day ${o.arriveDay})`); } },
  { id: 'scale-fouled', lv: 'week3', d: 20, h: 9, sys: ['scale'], pre: 5,
    effect: (R) => { const s = R.farm.autoCtl.scale(); assert(s.fouled && s.n < AUTO.scalePerDay * 0.3 && s.meanG < R.farm.flock.meanWeightG * 0.97, `fouled: ${s.n} weighings, ${s.meanG} g (flock ${Math.round(R.farm.flock.meanWeightG)})`); },
    fix: (R) => R.farm.act('scale.clean') },
];
for (const C of FCASES) {
  await test(`fault ${C.id}: its effect and bound, EV.FAULT, the Equipment row, the watch's warning (what / cause / place / fix), the night check's row, fixed by hand`, () => {
    const R = at(C.lv, C.d, C.h, C.sys);
    R.env.skipHours(C.pre ?? 0.1);
    const f = R.farm.debug.fault(C.id, C.opts || {});
    const live = R.farm.auto.faults.find((x) => x.id === C.id && x.phase === 'open');
    assert(live && R.faults.some((p) => p.id === C.id && p.phase === 'start' && p.text && !VERDICT.test(p.text)), `EV.FAULT start: ${JSON.stringify(R.faults.at(-1))}`);
    if (C.wait) R.env.skipHours(C.wait);
    const row = equipmentRow(R.env, R.farm);
    assert(row && (row.state === 'red' || (C.id === 'sensor-drift' || C.id === 'scale-fouled') && row.state === 'amber'), `Equipment row ${JSON.stringify(row)}`);
    if (C.id === 'order-lost') assert(R.faults.some((p) => p.id === C.id && p.phase === 'start'), 'a lost order: the row amber at once, red 6 farm hours later');
    assert(R.level.watch.status().rows.equipment?.state === row.state, 'the watch card carries the row');
    if (C.id !== 'scale-fouled') {
      const w = R.level.watch.warnings.find((x) => x.kind === 'equipment' && x.fault === C.id);
      assert(w && w.fix && w.fix.text && w.place && /Likely cause/.test(w.text) && !VERDICT.test(w.text), `the equipment warning: ${JSON.stringify(w)}`);
    }
    const nc = nightCheck(R.env, R.farm);
    assert(nc.show && nc.faults.some((x) => x.id === C.id && x.fix && x.text && !VERDICT.test(x.text)), `night check rows: ${JSON.stringify(nc.faults)}`);
    C.effect(R, live);
    C.fix(R);
    assert(R.faults.some((p) => p.id === C.id && p.phase === 'fixed') && !R.farm.auto.faults.some((x) => x.id === C.id && x.phase === 'open'), `fixed by hand: ${JSON.stringify(R.faults.map((p) => `${p.id}:${p.phase}`))}`);
    void f;
  });
}
await test('the controllers\' own retries bound the faults: the timer\'s first setting at most 12 h, the stage trip 2 h, with the high-temperature alarm', () => {
  const R = at('week2', 9, 9, ['timer']);
  R.env.skipHours(0.1); R.farm.debug.fault('timer-reset');
  R.env.skipHours(11.8);
  assert(R.farm.auto.faults.some((f) => f.id === 'timer-reset' && f.phase === 'open'), 'open before 12 h');
  R.env.skipHours(0.4);
  const f = R.farm.auto.faults.find((x) => x.id === 'timer-reset');
  assert(f.phase === 'fixed' && f.fixedBy === 'retry' && ventNeed(R.env, R.farm).share >= 0.9, `retry: ${f.phase} ${f.fixedBy}, ${JSON.stringify(R.farm.vent)}`);
  const S = at('weeks45', 30, 9, ['stages']);
  S.env.skipHours(0.5); S.farm.debug.fault('stage-trip');
  S.env.setFans(0); S.env.forceHouseTemp?.(S.env.targetTemp + 6); S.env.skipHours(0.1); S.env.forceHouseTemp?.(null);
  assert(S.faults.some((p) => p.id === 'stage-trip' && p.phase === 'found' && p.alarm), 'the high-temperature alarm at the target + 5 °C');
  S.env.skipHours(2);
  const g = S.farm.auto.faults.find((x) => x.id === 'stage-trip');
  assert(g.phase === 'fixed' && g.fixedBy === 'retry' && S.env.fanStages, `retry after 2 h: ${g.phase} ${g.fixedBy}`);
});
await test('a fault that starts in a Next job skip stops it within the farm hour (the skip guard sees the equipment warning)', () => {
  const R = at('weeks45', 24, 8, ['winch']);
  R.env.skipHours(0.2);
  R.farm.auto.faults.push({ id: null, system: null, phase: 'planned', at: +(R.env.day + 0.75 * H).toFixed(5), args: {} });
  const guard = createSkipGuard(R.env, R.farm, R.level.watch), t0 = R.env.day;
  let stop = null;
  for (let i = 0; i < 6 * 60 && !stop; i++) { R.env.skipHours(1 / 60); if (Math.abs(R.env.day * 24 - Math.round(R.env.day * 24)) < 1e-6) stop = guard.check(); }
  assert(stop && stop.kind === 'watch' && R.faults.some((p) => p.phase === 'start'), `stop ${JSON.stringify(stop)}`);
  assert((R.env.day - t0) * 24 <= 2.01, `stopped ${((R.env.day - t0) * 24).toFixed(2)} h into the skip`);
});
await test('a fault met by hand on the farmer\'s rounds: the level passes (runCycle with every system on, the fault at its time)', () => {
  for (const [lv, d, h, id] of [['weeks45', 24, 9, 'winch-stall'], ['level1', 2, 9, 'sensor-drift'], ['week2', 9, 9, 'timer-reset'], ['week3', 17, 9, 'order-lost']]) {
    let done = false;
    const r = runCycle('ideal', { perks: 'all', from: lv, to: lv, onWorld: (w) => w.env.addStepper((e) => { if (!done && w.farm.mode === 'level' && e.day >= d + h / 24) { done = true; w.farm.debug.fault(id, { line: 1 }); } }) });
    const f = r.farm.auto.faults.find((x) => x.id === id);
    assert(r.levels[lv].pass && f && f.phase === 'fixed', `${id}: ${lv} ${r.levels[lv].pass ? 'passed' : 'failed'}, fault ${f && f.phase}`);
  }
});

// ---------------- the fault plan (SKILLS.md §5.2) ----------------
await test(`the plan over ${QUICK ? 40 : 200} seeds: normal 0.5-0.7 items on average, the harder flocks exactly 2; every item in its window, never on a level's last day, 2 days apart; drawn per flock`, () => {
  SKILLS_UPDATE.live = true;
  const w = makeWorld(), W = FAULT_PLAN.window, n = QUICK ? 40 : 200, count = {};
  for (const cond of [null, 'hot', 'rainy', 'badChicks', 'water']) {
    let items = 0;
    for (let seed = 1; seed <= n; seed++) {
      w.farm.start(LEVEL1, { seed, condition: cond, flockNo: 0 });
      const it = w.farm.auto.faults;
      items += it.length;
      for (const x of it) {
        const d = Math.floor(x.at), hr = (x.at - d) * 24;
        assert(x.phase === 'planned' && d >= W.fromDay && d <= W.toDay && !W.notDays.includes(d) && hr >= W.hours[0] && hr < W.hours[1], `${cond} seed ${seed}: ${JSON.stringify(x)}`);
      }
      for (let i = 1; i < it.length; i++) assert(Math.floor(it[i].at) - Math.floor(it[i - 1].at) >= W.minGapDays, `${cond} seed ${seed}: ${it.map((x) => x.at).join(', ')}`);
      if (cond) assert(it.length === 2, `${cond} seed ${seed}: ${it.length} items`);
    }
    count[cond || 'normal'] = items / n;
  }
  assert(count.normal >= 0.5 && count.normal <= 0.7, `normal: ${count.normal} items a flock`);
  w.farm.start(LEVEL1, { seed: 5, flockNo: 0 }); const a = JSON.stringify(w.farm.auto.faults);
  w.farm.start(LEVEL1, { seed: 5, flockNo: 1 }); const b = JSON.stringify(w.farm.auto.faults);
  w.farm.start(LEVEL1, { seed: 5, flockNo: 0 });
  assert(JSON.stringify(w.farm.auto.faults) === a && (a !== b || a === '[]'), 'the same flock draws the same plan; another flock its own');
  SKILLS_UPDATE.live = false; w.farm.start(LEVEL1, { seed: 5 });
  assert(w.farm.auto.faults.length === 0, 'live off: no plan (the Phase 5 farm)');
  console.log(`     items a flock: ${Object.entries(count).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')}`);
});
await test('no fault starts while quietN > 0 (its item is dropped); an item picks among the systems on; order-lost arms and hits the next automatic order', () => {
  const R = at('weeks45', 24, 8, ['winch']);
  R.env.skipHours(0.1);
  R.farm.auto.faults.push({ id: null, system: null, phase: 'planned', at: +(R.env.day + 0.5 * H).toFixed(5), args: {} });
  R.farm.autoCtl.quiet(true); R.env.skipHours(1); R.farm.autoCtl.quiet(false); R.env.skipHours(0.5);
  assert(R.farm.auto.faults.at(-1).phase === 'dropped' && !R.faults.some((p) => p.phase === 'start'), `quiet: ${JSON.stringify(R.farm.auto.faults.at(-1))}`);
  R.farm.auto.faults.push({ id: null, system: null, phase: 'planned', at: +(R.env.day + 0.2 * H).toFixed(5), args: {} });
  R.env.skipHours(0.5);
  assert(R.farm.auto.faults.at(-1).id === 'winch-stall', `the one system on: ${R.farm.auto.faults.at(-1).id}`);
  const F = at('week3', 16, 9, ['feed']);
  F.env.skipHours(0.1);
  const f = { id: null, system: null, phase: 'planned', at: +(F.env.day + 0.1 * H).toFixed(5), args: {} };
  F.farm.auto.faults.push(f); F.env.skipHours(0.3);
  assert(f.id === 'order-lost' && f.phase === 'armed', `armed: ${f.phase}`);
  // then the silos down to about two and a half days (the ideal's own big orders filled them): the controller's next order
  for (const sl of F.farm.feed.silos) { for (const l of sl.layers) l.kg *= 0.25; sl.kg = sl.layers.reduce((x, l) => x + l.kg, 0); }
  F.farm.feed.siloKg = F.farm.feed.silos.reduce((x, sl) => x + sl.kg, 0);
  const pend = F.farm.feed.pending.length;
  for (let i = 0; i < 48 && f.phase === 'armed'; i++) F.env.skipHours(1);
  assert(f.phase === 'open' && f.args.kg > 0 && F.faults.some((p) => p.id === 'order-lost' && p.phase === 'start') && F.farm.feed.pending.length === pend, `hit the next order: ${f.phase} ${JSON.stringify(f.args)}`);
});
await test('the rainy season: after each power cut the controller comes back with its stages off (outside the plan); its retry 2 h after the power is back', () => {
  SKILLS_UPDATE.live = true;
  const R = makeRun();
  R.run.startRun({ seed: 1, at: 'weeks45', condition: 'rainy' });
  R.level.debug.goto(26, 9, { auto: true });
  R.farm.auto.on.stages = true; R.env.skipHours(0.2);
  assert(R.env.fanStages, 'the stage table runs');
  const planned = R.farm.auto.faults.filter((f) => !f.afterCut).length;
  R.farm.debug.power(false); R.env.skipHours(0.3); R.farm.debug.power(true); R.env.skipHours(0.1);
  const f = R.farm.auto.faults.find((x) => x.afterCut);
  assert(f && f.id === 'stage-trip' && f.phase === 'open' && !R.env.fanStages && R.faults.some((p) => p.afterCut && p.phase === 'start'), `after the cut: ${JSON.stringify(f)}`);
  assert(R.farm.auto.faults.filter((x) => !x.afterCut).length === planned, 'outside the plan\'s items');
  R.env.skipHours(2.1);
  assert(f.phase === 'fixed' && f.fixedBy === 'retry' && R.env.fanStages, `retry 2 h after the power: ${f.phase} ${f.fixedBy}`);
});

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
