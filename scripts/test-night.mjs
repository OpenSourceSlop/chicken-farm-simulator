// The farmer's night report after Phase 5 (night-brief items 1-9) in node: the heat balance against the sim, his night
// reproduced, the night check, the skip's stops, the causes, the morning summary, the controller's notes, big birds' nights,
// and the ideal never stopped. Owner: integrator.   node scripts/test-night.mjs [--quick]  (--quick: the ideal's scan in the
// normal season and the hot season only)
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createRun } from '../src/run.js';
import { CONDITION_IDS } from '../src/config.js';
import { EV } from '../src/events.js';
import { hoursAhead, settleAt, coldCause, controllerNotes, rowOf } from '../src/heat-diag.js';
import { nightCheck, nightHoursIn, createSkipGuard, NIGHT } from '../src/night-check.js';

const QUICK = process.argv.includes('--quick');
let failed = 0;
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); console.log(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;

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
  return { ...w, level, run, ui, store };
}
/** Day 0 of the brooding week after the ideal's afternoon (goto auto), then the farmer's settings. */
function day0(set, hour = 17) {
  const R = makeRun();
  R.level.start({ seed: 1 });
  R.level.debug.goto(0, hour, { auto: true });
  set?.(R.env, R.farm);
  R.env.skipHours(0.05);
  return R;
}
const SET = {
  sign: () => {},
  max40: (e) => e.setHeaterSetpoint(40),
  farmer: (e) => { e.setHeaterSetpoint(40); e.setFans(1); },
  timer: (e, f) => f.act('vent.timer', { fans: 2, onSec: 120, cycleSec: 300 }),
  tunnel3: (e) => { e.setHeaterSetpoint(40); e.setFans(3); },
  thermo30: (e) => e.setHeaterSetpoint(30),
  out4: (e) => e.setBrooderOut([0, 1, 2, 3]),
  padFan: (e) => { e.setPad(true); e.setFans(1); },
};
/** Next job through the night, Skip anyway whenever the check shows, until the first 06:00 after now (or `max` presses). */
function skipNight(R, max = 30) {
  const end = Math.floor(R.env.day - 0.25 + 1e-9) + 1.25 - 0.5 / 1440, out = [];
  for (let i = 0; i < max && R.env.day < end; i++) {
    let r = R.level.nextJob();
    if (r?.pointed !== undefined) r = R.level.nextJob();
    if (r?.nightCheck) { out.push({ check: r.nightCheck }); r = R.level.nextJob({ anyway: true }); }
    out.push(r);
  }
  return out;
}
const coldSince = (R, d0) => R.farm.flock.deadByCause.cold - (d0.cold || 0);

test('item 6: the heat balance (heat-diag settleAt) holds the sim within 1 °C at the coldest hour in every night case', () => {
  for (const [k, set] of Object.entries(SET)) {
    const R = day0(set, 16), ah = hoursAhead(R.env);
    let mn = 99;
    for (let i = 0; i < 14; i++) { R.env.skipHours(1); mn = Math.min(mn, R.env.houseTemp); }
    assert(Math.abs(ah.cold.houseC - mn) < 1, `${k}: projected ${ah.cold.houseC.toFixed(1)}, the sim's night low ${mn.toFixed(1)}`);
  }
});

test('item 6: his night reproduced — thermostat 40, the sign’s timer and one tunnel fan: the house 33.7 °C at 15:00 falls to about 26 °C by 06:00 with the brooders at full', () => {
  const R = day0(SET.farmer, 14), d0 = { ...R.farm.flock.deadByCause };
  R.env.skipHours(1);
  const h15 = R.env.houseTemp;
  R.env.skipHours(15);
  assert(Math.abs(h15 - 33.7) < 0.6 && Math.abs(R.env.houseTemp - 26.2) < 0.8 && R.env.heaterLevel > 0.99, `15:00 ${h15.toFixed(1)}, 06:00 ${R.env.houseTemp.toFixed(1)}, brooders ${R.env.heaterLevel.toFixed(2)}`);
  const cold = coldSince(R, d0);
  assert(cold > 120 && cold < 320, `cold deaths ${cold} (his screenshot: 34 dead on the floor at 06:44 after the bin rounds)`);
  // FANS 1/6 on his HUD: the tunnel fan by hand; the sign's timer runs 8 s in 300 s (on 2.7 % of the time)
  assert(R.env.fansManual === 1 && R.env.ventDuty < 0.03 && Math.round(R.env.airflowM3h) === 37260, `fans by hand ${R.env.fansManual}, timer duty ${R.env.ventDuty}, air ${R.env.airflowM3h}`);
  // his floor: 28-31 °C all night (the concrete holds the pre-heat), the air 26 °C: the air is what falls
  const f = R.env.floorTemp(-10, 0);
  assert(f > 28.5 && f < 31.5 && f - R.env.houseTemp > 2, `floor ${f.toFixed(1)} against the air ${R.env.houseTemp.toFixed(1)}`);
});

test('item 1 / 7: the night check — nothing at the signs; each case names its own cause and where to set it; the thermostat only when it is off the row', () => {
  const nc = (k) => { const R = day0(SET[k]); return { R, n: nightCheck(R.env, R.farm, { toDay: R.level.debug.nextSkip().target }) }; };
  assert(!nc('sign').n.show, 'the sign’s settings: no check');
  const kinds = (n) => n.problems.map((p) => p.kind).join('+');
  const m = nc('max40').n;
  assert(m.show && kinds(m) === 'thermostatHot' && m.problems[0].houseC > 38 && /40 °C, 6\.0 °C over the row/.test(m.problems[0].why), `max40: ${kinds(m)} ${m.problems[0]?.why}`);
  const t = nc('timer').n;
  assert(t.show && kinds(t) === 'air' && /the timer runs 2 fans, 120 s in every 300 s: 28,800 m³\/h/.test(t.problems[0].why) && t.lines.brooders.state === 'red' && /would need 2\d\d %/.test(t.lines.brooders.text), `timer: ${kinds(t)} · ${t.lines.brooders.text}`);
  const f = nc('farmer').n;
  assert(f.show && kinds(f) === 'air+thermostatHot' && /1 tunnel fan runs all the time: 36,000 m³\/h/.test(f.problems[0].why) && /Tunnel fans row/.test(f.problems[0].check) && /once the air is right/.test(f.problems[1].why) && f.fix.tab === 'vent', `farmer: ${kinds(f)}`);
  const u = nc('tunnel3').n;
  assert(u.show && /3 tunnel fans run all the time: 108,000/.test(u.problems[0].why), `tunnel3: ${u.problems[0]?.why}`);
  const c = nc('thermo30').n;
  assert(c.show && kinds(c) === 'thermostat' && c.fix.tab === 'temp' && /30 °C, 4\.0 °C under the row/.test(c.problems[0].why), `thermostat under: ${kinds(c)}`);
  const o = nc('out4').n;
  assert(o.show && o.problems[0].kind === 'brooderOut' && /4 brooders are out/.test(o.problems[0].why), `brooders out: ${kinds(o)}`);
  const p = nc('padFan').n;
  assert(p.show && kinds(p) === 'air+pad', `the pad with a fan: ${kinds(p)}`);
  for (const k of ['max40', 'timer', 'farmer', 'tunnel3', 'out4', 'padFan']) for (const x of nc(k).n.problems)
    assert(!(x.side === 'cold' && /thermostat/.test(x.check)) && !VERDICT.test(x.why + x.check), `${k}: ${x.kind} "${x.check}"`);
  assert(Math.abs(nightHoursIn(16 / 24, 1) - 5.5) < 1e-9 && nightHoursIn(10 / 24, 17 / 24) === 0, 'nightHoursIn');
});

test('item 2: Skip anyway — the skip stops before mass deaths with the cause, the clock back to 1x; a fixed timer then passes the night', () => {
  const R = day0(SET.timer), d0 = { ...R.farm.flock.deadByCause };
  R.level.hudHooks.setFast(true);
  let r = R.level.nextJob(); if (r?.pointed !== undefined) r = R.level.nextJob();
  assert(r?.nightCheck, 'the night check first');
  r = R.level.nextJob({ anyway: true });
  const s = R.ui.stops[0];
  // the skip from 17:05 runs to 00:00 (a job closes at midnight): the trouble of its last hour, the skip at its target
  assert(s && /^Next job reached 00:00: House/.test(s.text) && /timer runs 2 fans, 120 s/.test(s.text) && /brooders are at full/.test(s.text) && R.env.dayNumber === 1 && R.env.hour < 3,
    `stopped at ${R.env.timeLabel}: ${s?.text?.slice(0, 160)}`);
  assert(!R.level.fast && coldSince(R, d0) < 20, `fast ${R.level.fast}, cold deaths ${coldSince(R, d0)}`);
  assert(R.level.watch.status().last?.text === s.text, 'the flock watch card carries the stop');
  R.farm.act('vent.timer', { fans: 1, onSec: 8, cycleSec: 300 });
  const d1 = { ...R.farm.flock.deadByCause };
  skipNight(R);
  assert(R.env.dayNumber === 1 && R.env.hour >= 5.99 && coldSince(R, d1) <= 5 && R.ui.stops.length === 1, `after the fix: ${R.env.timeLabel}, cold ${coldSince(R, d1)}, stops ${R.ui.stops.length}`);
  // the heat side and his own night
  const H = day0(SET.max40);
  skipNight(H, 1);
  assert(H.ui.stops[0] && /40 °C, 6\.0 °C over the row/.test(H.ui.stops[0].text) && H.farm.flock.deadByCause.heat < 20, `max40 stop: ${H.ui.stops[0]?.text?.slice(0, 140)}`);
  const F = day0(SET.farmer), f0 = { ...F.farm.flock.deadByCause };
  skipNight(F, 1);
  assert(F.ui.stops[0] && /1 tunnel fan runs all the time/.test(F.ui.stops[0].text) && /Tunnel fans row/.test(F.ui.stops[0].text) && coldSince(F, f0) < 5, `farmer stop: ${F.ui.stops[0]?.text?.slice(0, 140)} · cold ${coldSince(F, f0)}`);
});

test('item 4: the morning summary — the night’s deaths by cause with the reason, on the record row; a quiet night stays quiet', () => {
  const H = day0(SET.max40);
  skipNight(H);
  const n = (H.records.draft(1).notes || []).find((x) => /^The night to day 1 06:00/.test(x));
  assert(n && /died of heat: the house held 3[6-9]\.\d–3[89]\.\d °C overnight; the brooder sign gives 34 °C for day 0; the thermostat was at 40 °C/.test(n), `heat night: ${n}`);
  const F = day0(SET.farmer);
  let ev = null; F.events.on(EV.NIGHT, (p) => { ev = p; });
  skipNight(F);
  const c = (F.records.draft(1).notes || []).find((x) => /^The night to day 1 06:00/.test(x));
  assert(c && /died of cold: the house fell to 2\d\.\d °C \(outside 19\.\d °C at 0\d:\d\d\): 1 tunnel fan runs all the time/.test(c) && ev?.notable, `cold night: ${c}`);
  const I = day0(SET.sign);
  let iev = null; I.events.on(EV.NIGHT, (p) => { iev = p; });
  skipNight(I);
  assert(iev && !iev.notable && !/cold|heat/.test(iev.text), `the ideal's night: ${iev?.text}`);
});

test('item 7: the flock watch’s cold warning names the tunnel fan with the thermostat at 40; the thermostat under the row is still named', () => {
  const F = day0(SET.farmer), ws = [];
  F.events.on(EV.WATCH, (p) => ws.push(p));
  for (let i = 0; i < 10; i++) F.env.skipHours(1);
  const w = ws.find((x) => x.kind === 'cold');
  assert(w && /House 2\d\.\d °C, brooders at full/.test(w.text) && /1 tunnel fan runs all the time/.test(w.text) && /Tunnel fans row/.test(w.text) && !/check the thermostat/.test(w.text), `farmer's warning: ${w?.text}`);
  const T = day0(SET.thermo30, 9), wt = [];
  T.events.on(EV.WATCH, (p) => wt.push(p));
  for (let i = 0; i < 12; i++) T.env.skipHours(1);
  const v = wt.find((x) => x.kind === 'cold');
  assert(v && /thermostat is at 30 °C, 4\.0 °C under the row/.test(v.text) && /brooder sign/.test(v.text), `thermostat under: ${v?.text}`);
});

test('items 3 / 8 / 9: the controller’s notes — the thermostat beside the row, the brooders at full and losing, the tunnel fan for chicks, the floor', () => {
  const F = day0(SET.farmer);
  F.env.skipHours(6);
  const n = controllerNotes(F.env, F.farm);
  assert(n.sp.state === 'red' && /34 °C for day 0 · yours 40 °C: 6\.0 °C over the sign’s row; once the air is right the house will overheat the chicks/.test(n.sp.text), n.sp.text);
  assert(n.temp.state === 'red' && /^Brooders at 100 %\. House 2\d\.\d °C and (falling [\d.]+ °C an hour toward 2\d °C with the settings now|holding)/.test(n.temp.text) && /more heat goes out than they put back/.test(n.temp.text) && /1 tunnel fan/.test(n.temp.text), n.temp.text);
  assert(n.vent.some((x) => x.state === 'red' && /keeps the tunnel fans off for young chicks/.test(x.text)), JSON.stringify(n.vent));
  assert(/follows the house air above it and the concrete under it/.test(n.floor.text) && /28–30 °C/.test(n.floor.text), n.floor.text);
  const I = day0(SET.sign), m = controllerNotes(I.env, I.farm);
  assert(m.sp.state === 'green' && m.temp.state === 'green' && !m.vent.length, `the sign's settings: ${m.sp.text} · ${m.temp.text}`);
});

test('check round 1: the controller’s notes follow the settings now — the tunnel fan off at 21:00 (house 30.6 °C): warming back at once, never the old cause or the losing state', () => {
  for (const sp of [34, 40]) {
    const F = day0(SET.farmer);
    F.env.skipHours(21 - F.env.hour);
    const before = controllerNotes(F.env, F.farm).temp;
    assert(before.state === 'red' && /more heat goes out/.test(before.text) && /1 tunnel fan/.test(before.text), `before: ${before.text}`);
    F.env.setFans(0); F.env.setHeaterSetpoint(sp);   // the moment after the press: the last step's heat terms still the old ones
    for (let m = 0; m <= 45; m += 5) {
      const t = controllerNotes(F.env, F.farm).temp, h = F.env.houseTemp;
      assert(!/more heat goes out|tunnel fan|falling|holding/.test(t.text), `thermostat ${sp}, ${F.env.timeLabel}: ${t.text}`);
      if (h < 33) assert(/^Brooders at \d+ %\. House \d\d\.\d °C and rising (about \d|\d\.\d) °C an hour toward \d\d °C with the settings now: warming back to the brooder sign’s row \(34 °C\)/.test(t.text), `${F.env.timeLabel} ${h.toFixed(1)}: ${t.text}`);
      if (m === 0) {
        assert(Math.abs(h - 30.6) < 0.4 && /rising about [45] °C an hour/.test(t.text), `21:00: ${h.toFixed(2)} · ${t.text}`);
        // the thermostat at the row: amber, toward the row; at 40: red, the thermostat named (where it heads: 38-39 °C)
        assert(sp === 34 ? t.state === 'amber' && /toward 34 °C with the settings now/.test(t.text) : t.state === 'red' && /toward 39 °C/.test(t.text) && /then on over it: the thermostat at 40 °C/.test(t.text), `${sp}: ${t.state} ${t.text}`);
      }
      F.env.skipHours(5 / 60);
    }
    if (sp === 34) { F.env.skipHours(1); const t = controllerNotes(F.env, F.farm).temp; assert(t.state === 'green', `settled: ${t.text}`); }
  }
});

test('check round 3: a line raised by watch.raise (the sunset line, a stop) is on the flock watch card at once (no cached copy from before it)', () => {
  const F = day0(SET.farmer, 18);
  F.level.update(0.016);
  F.env.skipHours(18.55 - F.env.hour);
  const before = F.level.watch.status();               // the card's read just before sunset (the live copy cached)
  assert(before.on && before.rows.comfort && before.last?.kind !== 'night', `before: on ${before.on}, last ${before.last?.kind}`);
  F.level.update(0.016);                                 // the running clock passed 18:30: the sunset line
  const w = F.level.watch.warnings.at(-1), now = F.level.watch.status();
  assert(w?.kind === 'night' && /^Sunset, and the night ahead: 1 tunnel fan runs all the time/.test(w.text), `raised: ${w?.text?.slice(0, 90)}`);
  assert(now.last === w && now.rows.comfort, `the card's next read: ${now.last?.kind} ${now.last?.text?.slice(0, 60)}`);
  const s = F.level.watch.raise({ kind: 'stop', text: 'Next job stopped at 19:00: a test line.' });
  assert(F.level.watch.status().last === s, 'a second raise shows at once too');
});

test('check round 4: trouble in the last farm hour of a skip that reached its target reads "Next job reached 00:00" (06:00), a stop on the way "stopped at"; the card names the skip’s own end', () => {
  const F = day0(SET.farmer), seen = { reached: [], stopped: [] };
  let first = null;
  const hh = (t) => { const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  for (let i = 0; i < 12 && !(F.env.dayNumber === 1 && F.env.hour >= 5.99); i++) {
    let r = F.level.nextJob(); if (r?.pointed !== undefined) r = F.level.nextJob();
    const target = F.level.debug.nextSkip().target, n0 = F.ui.stops.length;
    if (r?.nightCheck) {
      first ||= r.nightCheck;
      assert(r.nightCheck.skipWords === `Next job skips to ${hh(target)}${F.env.dayNumber === 0 ? ', day 1' : ''}` && Math.abs(r.nightCheck.skipTo - target) < 1e-9, `the card: ${r.nightCheck.skipWords} (target ${hh(target)})`);
      r = F.level.nextJob({ anyway: true });
    }
    const s = F.ui.stops[n0];
    if (!s) continue;
    const atEnd = Math.abs(F.env.day - target) < 1 / 1440;
    assert(s.text.startsWith(atEnd ? `Next job reached ${hh(target)}: ` : `Next job stopped at ${F.env.timeLabel}: `) && (atEnd ? !F.level.skipStopped || F.level.skipStopped.at < F.env.day - 1e-9 : F.level.skipStopped?.trouble) && !F.level.fast,
      `${F.env.timeLabel} (target ${hh(target)}): ${s.text.slice(0, 70)} · skipStopped ${JSON.stringify(F.level.skipStopped)}`);
    seen[atEnd ? 'reached' : 'stopped'].push(`${F.env.timeLabel}`);
  }
  // his night: a stop at 21:00 on the way, the skip to 00:00 reaching it with trouble in its last hour, then 06:00
  assert(first && seen.stopped.length && seen.reached.includes('00:00') && seen.reached.includes('06:00'), `stopped ${seen.stopped.join(',')} · reached ${seen.reached.join(',')}`);
  assert(/^Next job skips to (00|06):00, day 1$/.test(first.skipWords) && Math.abs(first.to - (1 + 7 / 24)) < 1e-6, `the first card: ${first.skipWords}, reads to ${first.to}`);
});

test('check round 5: a second level start on the same farm starts the flock watch clean (no cold hours from the last farm’s comfort before the chicks come)', () => {
  const R = makeRun(), sig = () => R.level.watch.samples.map((x) => `${x.t.toFixed(3)}:${x.cold ? 'C' : x.hot ? 'H' : '-'}${x.felt.toFixed(1)}`).join(' ');
  R.level.start({ seed: 1 }); R.level.debug.goto(0, 17, { auto: true });
  const fresh = sig(), fw = R.level.watch.warnings.length;
  R.env.setHeaterSetpoint(30); R.env.setFans(2); R.env.skipHours(10);   // a cold night: the farm's comfort is cold at its end
  assert(R.farm.comfort.coldShare > 0.5, `the first farm's night: cold share ${R.farm.comfort.coldShare}`);
  R.level.start({ seed: 1 });
  assert(!R.level.watch.samples.length && !R.level.watch.warnings.length && !R.level.watch.status().on && !(R.farm.comfort.coldShare > 0), 'the watch and the comfort clean at the start');
  R.level.debug.goto(0, 17, { auto: true });
  assert(sig() === fresh && R.level.watch.warnings.length === fw, `second start: ${R.level.watch.warnings.map((x) => x.text.slice(0, 60)).join(' | ')} · ${sig().slice(0, 120)}`);
});

test('item 5: older birds’ nights — four tunnel fans on day 16 (the check, then the watch stop names them); the hot season’s day 30 with no fan (a stop names the fans and pads)', () => {
  const R = makeRun();
  R.run.startRun({ seed: 1, at: 'week3' });
  R.level.debug.goto(16, 19, { auto: true }); R.env.setFans(4); R.env.skipHours(0.05);
  const out = skipNight(R, 3), c = out.find((x) => x?.check)?.check;
  assert(c && c.problems[0].kind === 'air' && /4 tunnel fans run all the time/.test(c.problems[0].why) && /off for the night once the evening cools/.test(c.problems[0].check), `day 16: ${c?.problems?.[0]?.why}`);
  const H = makeRun();
  H.run.startRun({ seed: 1, at: 'weeks45', condition: 'hot' });
  H.level.debug.goto(30, 19, { auto: true }); H.env.setFans(0); H.env.setPad(false); H.env.skipHours(0.05);
  skipNight(H, 2);
  const s = H.ui.stops[0];
  assert(s && /0 of 6 tunnel fans run and the pad pump is off/.test(s.text) && /fan panel/.test(s.text) && !/thermostat/.test(s.text), `hot night: ${s?.text?.slice(0, 200)}`);
});

test('save -> resume mid-night keeps the night log: the morning summary still comes', () => {
  const R = day0(SET.max40);
  R.level.nextJob({ anyway: true });
  const blob = JSON.parse(JSON.stringify(R.level.saveBlob()));
  const M = makeRun();
  M.level.resume(blob);
  skipNight(M);
  assert((M.records.draft(1).notes || []).some((x) => /^The night to day 1 06:00: .*died of heat/.test(x)), `after resume: ${(M.records.draft(1).notes || []).join(' | ').slice(0, 200)}`);
});

test(`the ideal is never stopped: no night check on a skip after its last round of the night and no stop through any night (${QUICK ? 'normal and hot seasons' : 'every condition'}, the brooding week to the finish)`, () => {
  for (const cond of QUICK ? [null, 'hot'] : [null, ...CONDITION_IDS]) {
    const R = makeRun(), { env, farm, level } = R, bad = [];
    let guard = null, lastHr = null, checks = 0;
    env.addStepper((e) => {
      if (farm.mode !== 'level' || level.mode !== 'level' || level.result) return;
      const hr = Math.floor(e.day * 24 + 1e-6); if (hr === lastHr) return; lastHr = hr; const h = ((hr % 24) + 24) % 24;
      // after the ideal's last round of the night: 21:00 (the hot season's 23:00 and 02:00 in weeks 2-3, 21:30 later)
      const last = cond === 'hot' && e.dayNumber >= 8 && e.dayNumber <= 21 ? [3, 4] : [22, 23, 0, 1, 2, 3, 4];
      if (last.includes(h)) {
        const sk = level.debug.nextSkip();
        if (sk.nightH >= NIGHT.minH) { checks++; const nc = nightCheck(e, farm, { toDay: sk.target }); if (nc.show) bad.push(`d${e.dayNumber} ${h}:00 check ${nc.problems.map((p) => p.kind).join('+')}`); }
      }
      // a Next job skip from 22:00 to the morning: its stops other than the flock watch's own (documented) warnings
      if (h === 22) guard = createSkipGuard(e, farm, level.watch);
      else if (guard && (h >= 23 || h <= 6)) { const t = guard.check(); if (t && t.kind !== 'watch') bad.push(`d${e.dayNumber} ${h}:00 stop ${t.kind}: ${t.text.slice(0, 90)}`); if (t || h === 6) guard = h === 6 ? null : createSkipGuard(e, farm, level.watch); }
    });
    R.run.startRun({ seed: 1, at: 'level1', condition: cond });
    for (let i = 0; i < 6; i++) {
      const def = level.def;
      level.debug.goto(def.endDay, 21, { auto: true });
      if (!level.result) level.debug.goto(def.endDay + 1, 6.05);
      level.update(1);
      assert(level.result?.pass, `${cond || 'normal'} ${def.id}: ${level.result?.failText}`);
      if (def.id === 'finish' || !R.run.next()) break;
    }
    assert(checks > 100 && !bad.length, `${cond || 'normal'} (${checks} checks): ${bad.slice(0, 4).join(' · ')}`);
    console.log(`     ${cond || 'normal'}: the ideal passes to the finish; ${checks} night checks after its evening rounds, none shown; no stop`);
  }
});


console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
