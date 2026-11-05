// Level flow in node: the real sim, farm, records, skills, job engine and level.js, with the 3D
// modules and the ui stubbed. Checks what the integrator's harness runs check, in seconds:
// level.debug.goto(auto) plays the ideal week (the same rounds as test-sim's ideal profile) and the
// level ends on the day 7 signing with a pass; a neglected week fails; save -> resume keeps the jobs.
//   node scripts/test-level.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { LEVEL1, SKILLS_UPDATE, AUTO_SYSTEMS, AUTO } from '../src/config.js';
import { EV } from '../src/events.js';
import { createPerks } from '../src/perks.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const inBand = (v, [a, b], what) => assert(v >= a && v <= b, `${what} ${v} not in ${a}..${b}`);

/** Skills update: a level on an existing world with the perks in its deps (as main.js passes them). */
function makeLevelWith(w, perks) {
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, setMode() {}, closePanel() {}, showResult() {}, jobCard: { refresh() {}, reset() {} }, newRun() {}, clearCaptions() {} };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} };
  const store = { data: null, available: true, save(d) { this.data = d; return true; }, load() { return this.data; }, clear() {}, loadProfile: () => null, saveProfile() {}, info() { return null; } };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui, perks });
  return { ...w, level };
}
/** A fresh farm world that shares the skills (and so the perks) of `w`. */
function makeWorldWith(skills, w0) { const w = makeWorld(); void w0; return { ...w, skills }; }

function makeLevel(profileStore = null) {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, shown: null, setMode(m) { this.mode = m; }, closePanel() {}, showResult(r) { this.shown = r; }, jobCard: { refresh() {} } };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {} };
  const store = { data: null, available: true, save(d) { this.data = JSON.parse(JSON.stringify(d)); return true; }, load() { return this.data; }, clear() { this.data = null; },
    loadProfile: () => (profileStore ? JSON.parse(JSON.stringify(profileStore.p ?? null)) : null),
    saveProfile(p) { if (profileStore) profileStore.p = JSON.parse(JSON.stringify(p)); }, info() { return null; } };
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
  // only measured numbers on the result: an early end has no day 7 weight and no uniformity
  if (r.early) assert(r.ratio == null && r.weightG == null && r.uniformityPct == null && (r.placedReal || r.fcr == null), `early end shows unmeasured numbers: ${JSON.stringify({ ratio: r.ratio, u: r.uniformityPct, fcr: r.fcr })}`);
  else assert(r.ratio != null && r.uniformityPct == null, `day 8 end, not weighed by hand: scale ratio ${r.ratio}, no uniformity ${r.uniformityPct}`);
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

// ---------------- review round 2 ----------------
let weighedRatio = null;
test('not weighed by hand: the result uses the automatic scale at the weigh-in age, not at the end', () => {
  const A = makeLevel();
  A.level.start({ seed: 1 });
  A.level.debug.goto(7, 21, { auto: true });
  weighedRatio = A.level.result.ratio;
  const B = makeLevel();
  B.level.start({ seed: 1 });
  B.level.debug.goto(7, 8.5, { auto: true }); // the ideal week up to the weigh-in, nobody weighs
  B.level.debug.goto(8, 6.5);                  // the level ends by itself at 06:00 day 8
  const r = B.level.result;
  assert(r && r.reason === 'time' && !r.weighedByHand, `ended ${r?.reason}, by hand ${r?.weighedByHand}`);
  console.log(`     weighed ${weighedRatio.toFixed(3)} x, scale at age 7.0 ${r.ratio.toFixed(3)} x (true mean at the end ${(B.farm.flock.meanWeightG / r.chickWeightG).toFixed(2)} x)`);
  assert(Math.abs(r.ratio - weighedRatio) <= 0.1, `scale ratio ${r.ratio.toFixed(3)} vs weighed ${weighedRatio.toFixed(3)}`);
});

test('goto(auto) called after 07:15 on the prep day still plays the prep round', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.env.skipHours(0.3); // 07:18
  L.level.debug.goto(7, 21, { auto: true });
  const r = L.level.result;
  assert(r && r.pass, `did not pass: ${r?.failText}`);
  assert(L.farm.stats.floorShareAtFirstTip >= 0.9, `floor share at the first tip ${L.farm.stats.floorShareAtFirstTip}`);
});

test('resume (Continue / hot reload) keeps the skill profile: one more award leaves every milestone', () => {
  const store = { p: null };
  const A = makeLevel(store);
  A.level.boot?.();
  A.level.start({ seed: 1 });
  A.level.debug.goto(7, 21, { auto: true });
  const had = store.p?.skills?.earned?.length ?? 0;
  assert(had >= 15, `profile after run 1: ${had} milestones`);
  // replay, save on day 0, resume the blob in a new level (no boot: the hot-reload path)
  A.level.replay();
  A.level.debug.goto(0, 10, { auto: true });
  const blob = JSON.parse(JSON.stringify(A.level.saveBlob()));
  const M = makeLevel(store);
  assert(M.level.resume(blob), 'resume failed');
  assert(M.skills.points('brooding') >= 9 && M.skills.unlocked('floorOverlay'), `after resume: brooding ${M.skills.points('brooding')} pts`);
  M.level.debug.goto(1, 12, { auto: true });
  const now = store.p?.skills?.earned?.length ?? 0;
  console.log(`     profile: ${had} milestones after run 1, ${now} after resume and the next awards`);
  assert(now >= had, `profile shrank to ${now} milestones`);
});

test('save -> resume keeps the house humidity', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(1, 3, { auto: true });
  const blob = JSON.parse(JSON.stringify(L.level.saveBlob()));
  const M = makeLevel();
  M.level.resume(blob);
  for (const k of ['day', 'hour', 'houseTemp', 'slabTemp', 'heaterSetpoint', 'heaterLevel', 'houseRH']) {
    assert(Math.abs(M.env[k] - L.env[k]) < 1e-6, `${k}: ${M.env[k]} vs ${L.env[k]}`);
  }
});

test('keep walking after the end: the clock stops at 23:59 on day 7, the farm stops', () => {
  const L = makeLevel();
  L.level.start({ seed: 1 });
  L.level.debug.goto(7, 21, { auto: true });
  assert(L.level.result, 'level did not end');
  L.level.keepWalking();
  const dead0 = L.farm.flock.deadTotal;
  for (let i = 0; i < 2 * 3600 * 10; i++) { L.level.update(0.1); L.env.update(0.1); } // 2 h of real time at 1x
  assert(L.env.dayNumber === 7 && L.env.hour >= 23.9, `clock at day ${L.env.dayNumber} ${L.env.hour.toFixed(2)}`);
  const w = L.farm.flock.meanWeightG, a = L.farm.age;
  for (let i = 0; i < 3600; i++) { L.level.update(0.1); L.env.update(0.1); }
  assert(L.farm.flock.meanWeightG === w && L.farm.age === a, 'the farm kept growing');
  console.log(`     day ${L.env.dayNumber} ${L.env.timeLabel}, dead ${dead0} -> ${L.farm.flock.deadTotal}, age ${a.toFixed(2)}`);
});

// ---------------- Phase 4 (PHASE4.md §3.4): a bad batch's brooding week ----------------
test('a bad batch: the level counts the claimed chicks apart (2.5 % limit); unclaimed graded-out chicks count as culls and the result says why', () => {
  // the ideal of goto(auto) (the sim's bad:ideal brooding rounds) grades the six stacks at the table and calls the hatchery
  const L = makeLevel();
  L.level.start({ seed: 1, condition: 'badChicks' });
  assert(L.farm.condition === 'badChicks', 'the condition is on the farm');
  L.level.debug.goto(0, 12, { auto: true });
  const fl = L.farm.flock, placed = fl.placed, claimed = fl.claimed;
  assert(claimed > 0 && claimed <= fl.culls && fl.gradedOut > 0, `the farm claims the graded-out chicks: claimed ${claimed}, culls ${fl.culls}, graded out ${fl.gradedOut}`);
  const withClaim = L.level.levelDeaths().pct;
  fl.claimed = 0; const base = L.level.levelDeaths().pct; fl.claimed = claimed;
  assert(Math.abs(base - withClaim - (100 * claimed) / placed) < 1e-6, `claimed apart: ${base.toFixed(3)} -> ${withClaim.toFixed(3)} %`);
  const b = L.level.badBatch();
  assert(b.gradedOut === fl.gradedOut && b.looked >= 5900 && b.called != null, JSON.stringify(b));
  const r = L.level.debug.result();
  assert(r.mortalityMaxPct === 2.5 && r.claimedApart && r.claimed === claimed && r.weightRatioMin === 4 && r.hatcheryCalled, `the merged limits: ${r.mortalityMaxPct}, claimed ${r.claimed}`);
  // no claim (the hatchery not told): four stacks graded by hand at the table, every stack tipped, no call; the
  // graded-out chicks are culls of the level, past 2.5 % at the day's close, and the fail text names the missing call
  const M = makeLevel();
  M.level.start({ seed: 1, condition: 'badChicks' });
  M.level.debug.goto(0, 10.05);
  assert(M.farm.flock.inBoxes > 0, `the late truck has come: ${M.farm.flock.inBoxes} in boxes`);
  const TIPS = [[-16, -1], [-16, 1], [-10, -1], [-10, 1], [-4, -1], [-4, 1]];
  for (let st = 0; st < 6; st++) {
    if (st < 4) M.farm.act('chicks.grade', { stack: st });
    M.farm.act('chicks.tip', { stack: st, chicks: LEVEL1.chicksPlaced / LEVEL1.stacks, x: TIPS[st][0], z: TIPS[st][1] });
  }
  assert(!(M.farm.flock.claimed > 0) && M.level.badBatch().gradedOut > 100, `graded out ${M.level.badBatch().gradedOut}, claimed ${M.farm.flock.claimed}`);
  M.level.debug.goto(1, 21, { auto: true });
  M.records.sign(1);
  const f = M.level.result;
  assert(f && !f.pass && /graded out on day 0 count as culls, because the hatchery was not told on day 0/.test(f.failText), `fails on deaths and names the call: ${f?.failText}`);
  // the normal season: Phase 2's limit and no claim
  const N = makeLevel();
  N.level.start({ seed: 1 });
  N.farm.flock.claimed = 100;
  const n = N.level.debug.result();
  assert(n.mortalityMaxPct === LEVEL1.fail.mortalityMaxPct && !n.claimedApart && n.claimed === 0 && n.condition === null, `normal: ${n.mortalityMaxPct} ${n.claimedApart} ${n.claimed}`);
});

test('the hot season\'s brooding week by goto(auto): the HUD names it, the jobs of the hot season come, p-warm never', () => {
  const L = makeLevel();
  L.level.start({ seed: 1, condition: 'hot' });
  L.level.debug.goto(3, 15, { auto: true });
  const ids = new Set(L.level.jobs.list().map((i) => i.id));
  assert(ids.has('h-brood-air') && !ids.has('p-warm') && !ids.has('w-test'), `jobs: ${[...ids].filter((i) => /^(h-|p-|w-)/.test(i)).join(' ')}`);
  assert(L.level.hudHooks.conditionText() === 'Hot season', 'the HUD tag');
  const s = L.level.saveBlob();
  const R = makeLevel();
  assert(R.level.resume(JSON.parse(JSON.stringify(s))) && R.farm.condition === 'hot' && R.level.jobs.byKey('h-brood-air@3'), 'resume keeps the condition and its jobs');
});

// ---------------- Skills update (SKILLS.md §4.2, §12.9, package "jobs"): the perks wired into the level ----------------
test('skills update: farm.auto.on from the perks after start, enter and restore, and on EV.PERKS / settings; goto(auto) quiet; flockNo', () => {
  const was = SKILLS_UPDATE.live;
  SKILLS_UPDATE.live = true;
  try {
    const w = makeWorld();
    const settings = { v: {}, get(p) { return this.v[p]; } };
    const perks = createPerks({ skills: w.skills, settings, events: w.events, allowed: true });
    const L = makeLevelWith(w, perks);
    let starts = [];
    const start0 = w.farm.start;
    w.farm.start = (def, opts) => { starts.push(opts?.flockNo); return start0(def, opts); };
    w.skills.profile.cyclesDone = 1;
    L.level.start({ seed: 1 });
    assert(starts[0] === 1, `farm.start gets flockNo = cyclesDone: ${starts}`);
    const on = () => Object.entries(w.farm.auto.on).filter(([, v]) => v).map(([k]) => k).sort().join(',');
    assert(on() === '', `nothing on before any level 3: ${on()}`);
    w.skills.debug.force('water', 3);
    assert(on() === 'winch', `EV.PERKS: Water 3 turns the winch on: ${on()}`);
    for (const b of ['moisture', 'ventilation', 'heating', 'feed', 'lighting', 'growth']) w.skills.debug.force(b, 3);
    assert(on() === Object.keys(AUTO_SYSTEMS).sort().join(','), `every system on: ${on()}`);
    settings.v['automation.water'] = false; w.events.emit(EV.SETTINGS, { group: 'automation', key: 'water', value: false });
    assert(!w.farm.auto.on.winch && w.farm.auto.on.timer, 'the Automation setting turns one system off');
    settings.v['automation.water'] = true; w.events.emit(EV.SETTINGS, { group: 'automation', key: 'water', value: true });
    // goto(auto) quiets the controllers the whole way (quietN > 0 at every farm step of the ideal's play)
    let minQ = Infinity, steps = 0;
    w.env.addStepper(() => { if (w.farm.mode === 'level') { steps++; minQ = Math.min(minQ, w.farm.auto.quietN); } });
    L.level.debug.goto(1, 12, { auto: true });
    assert(steps > 0 && minQ >= 1 && w.farm.auto.quietN === 0, `goto(auto) quiet: min ${minQ} over ${steps} steps, after ${w.farm.auto.quietN}`);
    // a farm.start resets on; the level sets it again (start, resume)
    const blob = JSON.parse(JSON.stringify(L.level.saveBlob()));
    const R = makeLevelWith(makeWorldWith(w.skills, w), perks);
    assert(R.level.resume(blob) && Object.values(R.farm.auto.on).filter(Boolean).length === Object.keys(AUTO_SYSTEMS).length, 'resume: every system on again from the perks');
    // enter the next level: on again after enterLevel
    const E = makeLevelWith(w, perks);
    E.level.start({ seed: 1 });
    E.level.debug.goto(7, 21, { auto: true });
    if (!E.level.result) E.level.debug.goto(8, 6.05);
    assert(E.level.result?.pass, 'the ideal brooding week passes');
    w.farm.auto.on.winch = false;
    assert(E.level.enter('week2') && w.farm.auto.on.winch, 'enter: on again after enterLevel');
    // the early warning's lead on the flock watch from Comfort 2
    w.skills.debug.force('comfort', 2);
    assert(E.level.watch.lead().comfortH === AUTO.earlyComfortH && E.level.watch.lead().fix === true, `setLead from earlyWarning: ${JSON.stringify(E.level.watch.lead())}`);
  } finally { SKILLS_UPDATE.live = was; }
});

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
