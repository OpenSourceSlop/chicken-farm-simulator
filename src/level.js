// Level flow: title card (start / continue / sandbox), the job engine over the day's rounds, "Next
// job" time skips, the clock speeds of the level, day changes, checkpoints for the skill tree, the
// level result (pass or replay) and autosave, for every level of the run (PHASE3.md §2, §10).
// Owner: package "run" (Phase 2: "level").
//
// createLevel(ctx, deps) -> level
//   deps = { farm, records, skills, save, player, flock, props, ui, interact, events }
//   mode            'sandbox' (Phase 1 farm, Phase 1 tasks and test tools) | 'title' | 'level' | 'result'
//   boot()          called once by main.js after the first frame is ready: shows the title card
//                   in a real browser; under automation (navigator.webdriver) stays in the sandbox
//                   so the Phase 1 harness scenarios keep working
//   start({ seed, def?, run? })  a fresh level that starts a flock: Phase 2's brooding week (LEVEL1, the
//                   default: from the prep day, clears the Phase 2 level save, keeps the profile) or the
//                   plan level (PLAN_LEVEL: an empty, clean house, no flock). run: part of a run.
//   enter(def, { run })  the next level on the same flock (PHASE3.md §2.2): keeps the farm, records, props
//                   and flock; the clock skips to the level's start (the farm integrates the night with
//                   the farmer's settings), the farmer at the gate, farm.enterLevel(def), the jobs of the
//                   level's days. The run saves the level start before the first frame.
//   resume(data)        continue from a save or a hot-reload blob (any level: data.level.levelId);
//                       continueSave() (the Phase 2 key)
//   toSandbox(), toTitle(), replay(), keepWalking()
//   update(dt)          every frame after the ui (real seconds): job engine, clock speed, autosave
//   nextJob()           the "Next job" button: point at the next open job, or skip the clock to when
//                       the next job opens (a second press within 3 s skips anyway; jobs whose window
//                       passes are missed); never past the level's end or the catch
//   jobs                { list(), open(), current(), complete(key) (debug), byKey(key) }
//   engine              the job engine itself (job-engine.js)
//   def                 the current level def (config LEVELS); inRun: part of a run
//   attachRun(api)      run.js: { serialize(), adopt(state), saveRun(blob), levelEnd(result),
//                       decorate(result), startDay(day) } (the run's side of saves and results)
//   serialize()         JSON-safe state of the level itself (jobs, anchors, checkpoints, points)
//   saveBlob()          the whole save object of PHASE2.md §11 ({ level, env, farm, records, props,
//                       flock, player }) with Phase 3's level.levelId and env fields (PHASE3.md §11)
//   checkpoint events   EV.LEVEL { phase: 'checkpoint', name, day, level?, run? } (PHASE3.md §9): plan,
//                       placed, vent, crop, weighin (each weigh day), curtain, vaccine, heatwave, catch,
//                       harvest, clean, swabs, rest, level-end. Phase 2's lone brooding week sends no
//                       `level` (skills.js then takes 'level1'); skills.js listens, the level never
//                       calls skills.evaluate itself
//   sampling            null | 'vent' | 'crop' | 'weigh' | 'bird' (catching birds is possible only then;
//                       'bird': a bird-check or droppings job open, day 8 on)
//   hudHooks            what the HUD's pause / 1x / 4x buttons call in a level
//   debug               { goto(day, hour, { auto }), trigger(problemId), result(forcePass?),
//                         freeRun(day, hour) (a level-mode farm at any age for tools: no jobs, no end) }
//
// JobInstance: { key, id, def, day, status: 'waiting'|'open'|'done'|'missed', opensAt, closesAt,
//   doneAt, progress (0..1), result }  (times as env.day floats)
//
// Phase 4 (PHASE4.md §3, §10.5): the condition is farm.condition only (farm.start(def, { condition }) at start({ condition }),
// the save's farm at resume, kept by enter). The level reads the level as the condition plays it (config conditionLevel:
// target, fail, a bad batch's claim and truck hour); checkpoints and results carry `condition`. Every EV.POWER { on: false }
// and every alarm symptom (EV.FARM_PROBLEM symptom with alarm) stops a Next job skip; while the house has no power the
// clock runs at LEVEL1.clock[GENERATOR.clockWhileDark] and Next job does not skip. rebuildJobs(): the level's jobs again
// for the farm's condition (__game.setCondition, EV.LEVEL { phase: 'condition' }). The run's cycle counters live in the
// skill profile (profile.cycles(): cyclesDone, conditionsDone; also skills.profile for the harness).
import { FARM, LEVEL1, LEVELS, CYCLE, PLAN_LEVEL, WEEKS45, FINISH, CLEANOUT, HARVEST, PLACEMENT_DAY, GENERATOR, CONDITIONS, levelById, levelOfDay, weightAt, conditionLevel, conditionLabel } from './config.js';
import { EV } from './events.js';
import { createJobEngine, LEVEL_END_DAY } from './job-engine.js';
import { applyRound, profileOf } from './farm-profiles.js';
// a condition's own rounds of the brooding week and its Phase 2 profile (package "sim", farm-profiles-cond.js)
import { broodStopsCond, p2ProfileFor } from './farm-profiles-cond.js';
// the cycle profiles (package "sim"): applyCycleRound at the rounds cycleStops lists (goto auto, free runs)
import * as cycleProfiles from './farm-profiles-cycle.js';
import { planSums } from './farm-plan.js';
import { ALL_MILESTONES_P4 as ALL_MILESTONES } from './skills.js'; // Phase 2 + cycle + the condition milestones
import { hhmm, splitDay, two, int } from './ui-format.js';
import { dayLabel } from './content.js';
import { clock as stepClock } from './clock.js';

const H = 1 / 24;
const CARRY_KINDS = new Set(['boxes', 'barrow', 'sack', 'frame']);
const NEXT_CONFIRM_MS = 3000;
/** The ideal plan of goto(auto) on the planning day (the planning sign's reference: PHASE3.md §6.11). */
export const IDEAL_PLAN = { houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 };
/** How the result lines name a level's days ("deaths and culls in week 3 reached …"). */
export const LEVEL_WORDS = { plan: 'the plan', level1: 'the brooding week', week2: 'week 2', week3: 'week 3', weeks45: 'weeks 4 and 5', finish: 'the last week', cleanout: 'the clean-out' };
const isWeekLevel = (d) => d?.target?.kind === 'weight';
/** Levels are compared by id, never by object (PHASE4.md §3.2). */
const is = (d, ref) => !!d && d.id === (typeof ref === 'string' ? ref : ref.id);
/** The Phase 2 round names of the brooding week's goto(auto) (a condition's extra stops have other names). */
const L1_ROUNDS = new Set(['prep', 'eve', 'sign', 'am', 'truck', 'vent', 'crop', 'noon', 'late', 'weigh', 'pm']);

export function createLevel(ctx, deps = {}) {
  const { farm, records, skills, save, player, flock, props, ui, events } = deps;
  const env = ctx.env;
  const engine = createJobEngine({ events, env, farm, props, records });
  const C = LEVEL1.clock;
  let def = LEVEL1;                 // the level that runs (config LEVELS)
  let inRun = false;                // part of a run (run.js): checkpoints carry level + run, results the run's buttons
  let runApi = null;                // run.js (attachRun)
  let fast = false, userPaused = false, seed = 1;
  let pending = null;               // { at: ms, label } after a first Next job press with jobs open
  let fired = new Set();            // checkpoints emitted this level
  let points = [];                  // skill points earned this level
  let weighs = [];                  // hand weighings on the level's weigh days [{ w, x, z, day }]
  let signedEnd = false, ended = null, lastDay = null, tickAcc = 0;
  let saveIn = null, lastSaveDay = null;
  let failAt = null;                // { day, pct } the first day close with the level deaths over the limit
  let startAt = null;               // env.day this level started
  const details = new Map();        // milestone -> measured detail (profile)
  let free = null;                  // { def, off } while debug.freeRun runs the farm (tools)
  let alarms = 0;                   // EV.POWER { on: false } and alarm symptoms so far (a Next job skip stops at a new one)
  let pinStops = 0;                 // pinned condition jobs opened so far (a minute-by-minute skip stops at a new one too)
  let bad = { gradedOut: 0, looked: 0, weak: 0, called: null };  // a bad batch: the grading at the table, the hatchery call (env.day)

  /** The level as the farm's condition plays it (config conditionLevel: problems, target, fail, delivery, …). */
  const lv = () => (farm.levelFor ? farm.levelFor(def) : conditionLevel(def, farm.condition ?? null));
  const condNow = () => farm.condition ?? null;
  const dark = () => !!farm.power && farm.power.on === false;
  const lvTag = () => (inRun || !is(def, LEVEL1) ? { level: def.id, run: inRun } : {});
  const emitLevel = (p) => events?.emit(EV.LEVEL, { day: env.dayNumber, ...lvTag(), condition: condNow(), ...p });
  const checkpoint = (name, key = name, extra = {}) => { if (fired.has(key)) return; fired.add(key); emitLevel({ phase: 'checkpoint', name, ...extra }); };
  const inLevel = () => level.mode === 'level' && !ended;
  const uiAct = (id, args = {}) => events?.emit(EV.ACTION, { id, ...args, result: undefined });

  // ---------------- profile (skills kept across replays) ----------------
  // the run's cycle counters (PHASE4.md §3.1): kept in the skill profile across runs and replays; the same object is
  // skills.profile (the sim package may give its own: then that one is used), so a harness can set cyclesDone
  const cyc = (skills && typeof skills.profile === 'object' && skills.profile) || { cyclesDone: undefined, conditionsDone: {} };
  if (skills && !skills.profile) skills.profile = cyc;
  if (!cyc.conditionsDone) cyc.conditionsDone = {};
  function loadProfile() {
    const p = save?.loadProfile?.();
    if (p?.skills) skills?.restore?.(p.skills);
    for (const [k, v] of p?.details || []) details.set(k, v);
    const cd = p?.cyclesDone ?? p?.skills?.cyclesDone;
    if (Number.isFinite(cd)) cyc.cyclesDone = Math.max(cyc.cyclesDone ?? 0, cd);
    for (const [k, n] of Object.entries(p?.conditionsDone ?? p?.skills?.conditionsDone ?? {})) if (Number.isFinite(n)) cyc.conditionsDone[k] = Math.max(cyc.conditionsDone[k] ?? 0, n);
  }
  function saveProfile() { save?.saveProfile?.({ skills: skills?.serialize?.(), details: [...details], ...(cyc.cyclesDone != null ? { cyclesDone: cyc.cyclesDone } : {}), conditionsDone: { ...cyc.conditionsDone } }); }

  // ---------------- autosave (a run's levels save under the run's key, PHASE3.md §11) ----------------
  function saveNow() {
    if (!inLevel() || free) return false;
    lastSaveDay = env.day;
    saveIn = null;
    if (inRun && runApi) return runApi.saveRun(level.saveBlob());
    return save ? save.save(level.saveBlob()) : false;
  }
  const scheduleSave = (sec) => { if (saveIn == null || sec < saveIn) saveIn = sec; };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
    window.addEventListener('pagehide', () => saveNow());
  }

  // ---------------- bus ----------------
  const weighDays = () => (is(def, LEVEL1) ? [LEVEL1.endDay] : def.weighDays || []);
  if (events) {
    // Phase 4: every power cut and every alarm stops a Next job skip (skip() watches the count)
    events.on(EV.POWER, (p) => { if (p && p.on === false) alarms++; });
    events.on(EV.FARM_PROBLEM, (p) => { if (p && p.phase === 'symptom' && p.alarm) alarms++; });
    // a pinned condition job that opens (the mains back while the generator carries the house) stops it too (integrator)
    events.on(EV.JOB_OPEN, (p) => { if (p && farm.condition && engine?.byKey?.(p.key)?.def?.pin) pinStops++; });
    // farm.setCondition on a running farm (a harness, __game.setCondition): the jobs again for the new condition
    events.on(EV.LEVEL, (p) => { if (p && p.phase === 'condition' && level.mode === 'level' && !ended && !free) level.rebuildJobs(); });
    events.on(EV.JOB_DONE, () => { if (inLevel()) scheduleSave(2); });
    events.on(EV.SKILL_POINTS, (p) => {
      if (p.detail) details.set(p.milestone, p.detail);
      if (level.mode === 'level' || level.mode === 'result') points.push({ branch: p.branch, milestone: p.milestone, points: p.points, detail: p.detail || '', text: ALL_MILESTONES.find((m) => m.id === p.milestone)?.text || p.milestone });
      saveProfile();
      // the run save follows the profile soon, so a reload never resumes from before points the profile holds
      if (inLevel() && !free) scheduleSave(0.5);
    });
    events.on(EV.ACTION, (p) => {
      if (!inLevel() || free) return;
      if (p.id === 'sample.weigh' && weighDays().includes(env.dayNumber)) weighs.push({ w: p.result?.weightG, x: p.x, z: p.z, day: env.dayNumber });
      if (p.id === 'plan.reply' && is(def, PLAN_LEVEL)) checkpoint('plan');
      if (p.id === 'swab.read' && is(def, CLEANOUT)) checkpoint('swabs', `swabs@${farm.clean?.labDay ?? env.dayNumber}`);
      // a bad batch (PHASE4.md §3.4): the chicks graded out at the table and the call to the hatchery on day 0
      if (p.id === 'chicks.grade' && Number.isFinite(p.result?.culled)) { bad.gradedOut += p.result.culled; bad.looked += p.result.looked || 0; bad.weak += p.result.weak || 0; }
      if (p.id === 'phone.hatchery' && bad.called == null) bad.called = env.day;
    });
    events.on(EV.RECORD_CLOSED, (p) => {
      if (!inLevel() || free) return;
      if (p.day === def.endDay && p.signed) signedEnd = true;
      saveNow();
      // fail early: deaths and culls past the limit at any day's close
      const max = lv().fail?.mortalityMaxPct;
      if (max != null && levelDeaths().pct > max) { failAt = failAt || { day: p.day, pct: levelDeaths().pct }; end('mortality'); }
    });
  }
  function placedCount() { return farm.flock.placed || farm.flock.delivered || 0; }
  /** A bad batch's brooding week counts the chicks claimed from the hatchery apart (fail.claimedApart, PHASE4.md §3.4):
   *  farm.flock.claimed (the farm moves the day-0 culls there once the hatchery is told the same day). */
  const claimedApart = () => (lv().fail?.claimedApart ? Math.max(0, Math.min(farm.flock.claimed || 0, farm.flock.culls || 0)) : 0);
  function mortalityPct() {
    const placed = placedCount();
    if (!placed) return 0;
    return (((farm.flock.deadTotal || 0) + (farm.flock.culls || 0) - claimedApart()) / placed) * 100;
  }
  /** The level's start counters: the farm's own (farm.stats.levelStart, set by farm.enterLevel; PHASE3.md §13.9). */
  function startCounts() {
    return farm.stats.levelStart || { level: def.id, day: def.startDay, alive: 0, deaths: 0, culls: 0, doa: 0 };
  }
  const doaNow = () => farm.harvest?.result?.doa ?? 0;
  /** Deaths and culls (and dead on arrival in the last week) since the level's start, as % of the birds alive then. */
  function levelDeaths() {
    if (is(def, LEVEL1)) { const placed = placedCount(); return { n: (farm.flock.deadTotal || 0) + (farm.flock.culls || 0) - claimedApart(), of: placed, pct: mortalityPct(), claimed: claimedApart() }; }
    const s = startCounts(), withDoa = lv().fail?.withDoa;
    const n = ((farm.flock.deadTotal || 0) - (s.deaths || 0)) + ((farm.flock.culls || 0) - (s.culls || 0)) + (withDoa ? doaNow() - (s.doa || 0) : 0);
    return { n, of: s.alive || 0, pct: s.alive ? (100 * n) / s.alive : 0, deaths: (farm.flock.deadTotal || 0) - (s.deaths || 0), culls: (farm.flock.culls || 0) - (s.culls || 0), doa: withDoa ? doaNow() - (s.doa || 0) : 0 };
  }

  // ---------------- clock speed (PHASE2.md §2): paused > sign > panel > carry > fast > work ----------------
  function clock() {
    const kind = ui?.panelKind;
    if (userPaused || kind === 'paused') { env.paused = true; return; }
    env.paused = false;
    const placing = is(def, LEVEL1) && engine.anchors.truck != null && !fired.has('placed') && env.dayNumber === LEVEL1.arrivalDay;
    const catching = !!farm.harvest?.started && !farm.harvest?.result; // the crew works on its own (PHASE3.md §2.3)
    if (kind === 'sign') env.timeScale = C.sign;
    // Phase 4: the house dark (no mains, no generator on the switch): every farm minute counts (carry speed)
    else if (dark()) env.timeScale = C[GENERATOR.clockWhileDark] ?? C.carry;
    else if (catching) env.timeScale = fast ? C.fast : C.work;
    else if (kind === 'panel') env.timeScale = C.panel;
    else if (CARRY_KINDS.has(props?.carrying) || placing) env.timeScale = C.carry;
    else env.timeScale = fast ? C.fast : C.work;
  }

  // ---------------- checkpoints, the end ----------------
  const closed = (key) => { const i = engine.byKey(key); return !!i && i.closesAt != null && env.day >= i.closesAt - 1e-7; };
  const doneOrClosed = (key) => { const i = engine.byKey(key); return !!i && (i.status === 'done' || i.status === 'missed' || closed(key)); };
  const weighInst = (d) => engine.list().find((i) => i.day === d && i.def.done?.id === 'sample.weigh' && i.def.kind !== 'problem');
  function checks() {
    if (!inLevel() || free) return;
    const f = farm.flock;
    if (is(def, LEVEL1)) {
      if (!fired.has('placed') && engine.anchors.placed != null && f.placed > 0 && f.inBoxes === 0) checkpoint('placed');
      if (closed('d0-vent@0')) checkpoint('vent');
      if (closed('d1-crop@1')) checkpoint('crop');
      const w = engine.byKey(`d7-weigh@${LEVEL1.endDay}`);
      if (w && (w.status === 'done' || closed(w.key))) checkpoint('weighin');
      if (env.day >= LEVEL_END_DAY - 1e-7) end('time');
      else if (signedEnd && fired.has('weighin')) end('signed');
      return;
    }
    for (const d of def.weighDays || []) { const w = weighInst(d); if (w && (w.status === 'done' || w.status === 'missed' || closed(w.key))) checkpoint('weighin', `weighin@${d}`, { day: d }); }
    if (def.id === 'week2') {
      if (doneOrClosed('w2-curtain@9')) checkpoint('curtain');
      if (doneOrClosed('w2-vaccine@12')) checkpoint('vaccine');
    }
    if (is(def, WEEKS45) && env.day >= 32 + 19 * H - 1e-7) checkpoint('heatwave');
    if (is(def, FINISH) && farm.harvest?.started && f.alive === 0) checkpoint('catch');
    if (is(def, CLEANOUT)) {
      if (doneOrClosed('c-spray@45')) checkpoint('clean');
      if (engine.byKey('c-lab@48')?.status === 'done' && farm.clean?.lab) checkpoint('swabs', `swabs@${farm.clean.labDay ?? 48}`);
    }
    if (is(def, PLAN_LEVEL) && engine.byKey('pl-reply@-2')?.status === 'done') checkpoint('plan');
    // the end (PHASE3.md §10)
    if (env.day >= engine.endAt() - 1e-7) { end(is(def, CLEANOUT) ? 'rest' : 'time'); return; }
    if (!signedEnd) return;
    if (is(def, PLAN_LEVEL) && fired.has('plan')) end('signed');
    else if (isWeekLevel(def) && fired.has(`weighin@${lv().target.day}`)) end('signed');
    else if (is(def, FINISH) && farm.harvest?.started && f.alive === 0) { checkpoint('harvest'); end('signed'); }
  }

  function weighResult(day) {
    const ok = weighs.filter((x) => Number.isFinite(x.w) && (x.day ?? LEVEL1.endDay) === day);
    if (!ok.length) return null;
    const mean = ok.reduce((a, b) => a + b.w, 0) / ok.length;
    const within = ok.filter((x) => Math.abs(x.w - mean) <= 0.1 * mean).length;
    return { n: ok.length, mean, uniformityPct: (within / ok.length) * 100 };
  }

  /** Phase 2's result screen numbers of the brooding week (PHASE2.md §10), unchanged. */
  function computeResultL1(reason) {
    const F = lv().fail || LEVEL1.fail;
    const placed = placedCount() || LEVEL1.chicksPlaced;
    const claimed = claimedApart();
    const deaths = (farm.flock.deadTotal || 0) + (farm.flock.culls || 0) - claimed;
    const deathsPct = (deaths / placed) * 100;
    const measured = farm.stats?.chickWeightMeasuredG;
    const chick = measured ?? farm.flock.chickWeightG ?? LEVEL1.chickWeightG;
    const wr = weighResult(LEVEL1.endDay);
    // not weighed by hand: the automatic bird scale at the weigh-in age (08:00 day 7, about 2 % high);
    // a level that ended before the weigh-in age has no day 7 weight (null: the screen says what ended it)
    const weightG = wr ? wr.mean : farm.stats?.scaleAtWeighInG ?? null;
    const ratio = chick && weightG != null ? weightG / chick : null;
    const pass = ratio != null && ratio >= F.weightRatioMin && deathsPct <= F.mortalityMaxPct;
    // what the farmer knows of the dead (the bin) and what he has not seen yet (the floor, the boxes)
    const fl = farm.flock, onFloor = fl.deadOnFloor || 0, inBoxes = (fl.boxDead || 0);
    const notPicked = onFloor > 0 ? ` (${onFloor.toLocaleString('en')} dead bird${onFloor === 1 ? '' : 's'} not picked up)` : '';
    // a bad batch: the chicks graded out on day 0 count as culls of the level unless the hatchery was told that day
    const unclaimed = F.claimedApart && bad.gradedOut > 0 && !(claimed > 0) ? `; the ${int(bad.gradedOut)} chicks graded out on day 0 count as culls: the hatchery was not told on day 0` : '';
    const failText = deathsPct > F.mortalityMaxPct ? `deaths and culls reached ${two(deathsPct)} % on day ${env.dayNumber}${notPicked}${unclaimed}`
      : ratio != null ? `day 7 weight ${two(ratio)} × chick weight` : (fl.placed || 0) > 0 ? 'no day 7 weight' : 'no chicks were placed';
    const floor = records?.timeline?.()?.find?.((e) => e.day === 0)?.floorAtArrivalC ?? null;
    const { day, hour } = splitDay(env.day);
    return { pass, reason, early: reason === 'mortality', endedAt: `day ${day}, ${hhmm(hour)}`, day, hour,
      ratio, weightG, weighedByHand: !!wr, chickWeightG: chick, chickSource: measured != null ? 'box' : 'delivery',
      deaths, placed, placedReal: (fl.placed || 0) > 0, countedDead: fl.countedDead || 0, deadOnFloor: onFloor, deadInBoxes: inBoxes, culls: fl.culls || 0,
      // uniformity only from a hand weighing of 10 birds or more (the scale gives no spread); FCR only
      // once chicks were placed and are eating
      deathsPct, uniformityPct: wr && wr.n >= 10 ? wr.uniformityPct : null,
      fcr: (fl.placed || 0) > 0 && fl.alive > 0 ? (Number.isFinite(fl.fcr) && fl.fcr > 0 ? fl.fcr : records?.row?.(LEVEL1.endDay)?.fcr || null) : null,
      failText, floorAtArrival: floor, points: points.slice(),
      // Phase 4: the level's limits as the condition has them, a bad batch's claim
      mortalityMaxPct: F.mortalityMaxPct, weightRatioMin: F.weightRatioMin, claimedApart: !!F.claimedApart, claimed, gradedOut: bad.gradedOut,
      hatcheryCalled: bad.called != null && Math.floor(bad.called + 1e-9) === LEVEL1.arrivalDay };
  }

  /** The plan level: the company's reply (farm.plan.outcome, planOutcome's terms) is the measurement. */
  function planResult() {
    const p = farm.plan, o = p?.outcome;
    if (!o) return { pass: false, plan: null, failText: 'no plan went to the company' };
    const words = {
      salePerWeek: (t) => (t.max != null && t.value > t.max
        ? `the company buys ${int(t.limit)} a week and the plant takes at most ${int(t.max)}: your plan gives ${int(t.value)}`
        : `the company counts ${two(o.lossesCountedPct).replace(/\.00$/, '')} % losses: your plan gives ${int(t.value)} birds for sale a week; the contract asks for ${int(t.limit)}`),
      density: (t) => `your plan gives ${two(t.value)} kg of live bird per m² at catching; the contract allows ${int(t.limit)}`,
      rest: (t) => `your plan leaves ${int(t.value)} days of rest; the contract asks for ${int(t.limit)}`,
      houseBirds: (t) => `your plan puts ${int(t.value)} chicks in a house; the contract allows ${int(t.limit)}`,
    };
    const unmet = (o.terms || []).filter((t) => !t.met);
    return { pass: !!o.pass, plan: { decisions: p.decisions, sums: p.sums, outcome: o, measured: p.measured, sheet: p.sheet ?? null },
      failText: unmet.map((t) => (words[t.key] ? words[t.key](t) : `${t.key} ${t.value} (limit ${t.limit})`)).join('; ') };
  }

  /** A week level: the weigh-in of the target day (by hand, else the scale at 08:00) and the level deaths. */
  function weekResult(ld) {
    const M = lv(), day = M.target.day, targetG = weightAt(day);
    const wr = weighResult(day);
    const scale = farm.stats.scaleAt?.[day] ?? null;
    const weightG = wr && wr.n >= 10 ? wr.mean : scale;
    const share = weightG != null ? weightG / targetG : null;
    const max = M.fail.mortalityMaxPct;
    const pass = share != null && share >= M.target.minShare && ld.pct <= max && !failAt;
    const failText = failAt || ld.pct > max ? `deaths and culls in ${LEVEL_WORDS[def.id]} reached ${two(failAt?.pct ?? ld.pct)} % on day ${failAt?.day ?? env.dayNumber}`
      : share != null ? `day ${day} weight ${int(weightG)} g${wr && wr.n >= 10 ? '' : ' (automatic scale)'}, ${int(share * 100)} % of the ${int(targetG)} g target` : `no day ${day} weight`;
    const weighs2 = (def.weighDays || []).filter((d) => d !== day).map((d) => { const w = weighResult(d); return w && w.n >= 10 ? { day: d, weightG: w.mean, targetG: weightAt(d), uniformityPct: w.uniformityPct } : null; }).filter(Boolean);
    return { pass, failText, weightG, targetG, targetDay: day, share, minShare: M.target.minShare, weighedByHand: !!(wr && wr.n >= 10), weighedN: wr?.n ?? 0,
      uniformityPct: wr && wr.n >= 10 ? wr.uniformityPct : null, otherWeighs: weighs2, mortalityMaxPct: max };
  }

  /** The last week: the harvest (the tickets) against the target at the catch age less the shrink. */
  function finishResult(ld) {
    const hv = farm.harvest, r = hv?.result, M = lv();
    const max = M.fail.mortalityMaxPct;
    if (!r) return { pass: false, harvest: null, failText: failAt || ld.pct > max ? `deaths and culls in the last week reached ${two(ld.pct)} % on day ${failAt?.day ?? env.dayNumber}` : 'the birds were not caught', mortalityMaxPct: max };
    const age = (hv.startedAt ?? hv.catchAt ?? env.day) - PLACEMENT_DAY;
    const targetG = weightAt(age), expectG = targetG * HARVEST.shrink, share = r.meanLiveG / expectG;
    const pass = share >= M.target.minShare && ld.pct <= max && !failAt;
    const failText = failAt || ld.pct > max ? `deaths, culls and dead on arrival in the last week reached ${two(failAt?.pct ?? ld.pct)} %`
      : `harvest live weight ${int(r.meanLiveG)} g, ${int(share * 100)} % of ${int(targetG)} g less ${int((1 - HARVEST.shrink) * 100)} % shrink`;
    return { pass, failText, harvest: { ...r, trucks: (hv.trucks || []).map((t) => ({ ...t })) }, catchAgeDays: age, targetG, expectG, share, minShare: M.target.minShare, mortalityMaxPct: max };
  }

  /** The clean-out: the lab letter and the rest days before the booked chicks. */
  function cleanResult() {
    const c = farm.clean || {}, lab = c.lab;
    const rest = c.bookedDay != null && c.closedDay != null ? c.bookedDay - c.closedDay : null;
    const maxPos = lv().target.maxPositive, minRest = lv().target.restMinDays;
    const pass = !!lab && lab.positive <= maxPos && rest != null && rest >= minRest;
    const lines = [];
    if (!lab) lines.push('no swabs went to the lab');
    else if (lab.positive > maxPos) lines.push(`${int(lab.positive)} of ${int(lab.of)} swabs grew bacteria`);
    if (c.bookedDay == null) lines.push('no chicks were booked');
    else if (rest != null && rest < minRest) lines.push(`the next chicks came after ${int(rest)} days of rest`);
    return { pass, failText: lines.join('; '), lab: lab ? { ...lab } : null, restDays: rest, bookedDay: c.bookedDay ?? null, closedDay: c.closedDay ?? null, maxPositive: maxPos, restMinDays: minRest, pass2: c.pass ?? 1 };
  }

  /** The result of the level that runs: only what was measured (PHASE3.md §10). */
  function computeResult(reason) {
    const c = condNow();
    const base = { levelId: def.id, n: def.n, title: def.title, short: def.short, inRun, condition: c, conditionLabel: c ? conditionLabel(c) : null };
    if (is(def, LEVEL1)) return { ...computeResultL1(reason), ...base };
    const ld = levelDeaths();
    const part = is(def, PLAN_LEVEL) ? planResult() : isWeekLevel(def) ? weekResult(ld) : is(def, FINISH) ? finishResult(ld) : is(def, CLEANOUT) ? cleanResult() : { pass: false, failText: '' };
    const { day, hour } = splitDay(env.day);
    const fl = farm.flock;
    return { ...base, ...part, reason, early: reason === 'mortality', endedAt: `day ${day}, ${hhmm(hour)}`, day, hour, failDay: failAt?.day ?? day,
      deaths: ld.n, deathsPct: ld.pct, aliveStart: ld.of, culls: ld.culls ?? 0, doa: ld.doa ?? 0, alive: fl.alive ?? 0,
      fcr: fl.alive > 0 && Number.isFinite(fl.fcr) && fl.fcr > 0 ? fl.fcr : part.harvest?.fcr ?? null, points: points.slice() };
  }

  function end(reason) {
    if (ended) return;
    if (is(def, CLEANOUT)) checkpoint('rest');
    checkpoint('level-end');
    engine.finish();
    ended = computeResult(reason);
    emitLevel({ phase: 'end', result: ended });
    if (!inRun) save?.clear?.();
    if (inRun && runApi) { try { runApi.levelEnd(ended); } catch (err) { console.error('run level end failed', err); } }
    showResult(ended);
  }
  function showResult(res) {
    level.mode = 'result';
    ui?.setMode?.('result');
    ui?.closePanel?.();
    ui?.showResult?.(res);
  }

  // ---------------- skips ----------------
  /** Saved starts inside the level (weeks 4-5: day 29 06:00) the clock reaches in (from, to]. */
  const innerStarts = (from, to) => (def.starts || []).filter((d) => d !== def.startDay).map((d) => ({ d, t: d + 6 * H })).filter((s) => s.t > from + 1e-9 && s.t <= to + 1e-9);
  /** Can the power go off during a skip? (a condition run, or the generator carrying the house: its fuel runs out) */
  const canCut = () => !!farm.condition || !!farm.generator?.running;
  /**
   * Move the farm `h` hours on. With `stop` (a Next job skip) and a power cut possible, the clock moves a farm minute
   * at a time and stops at the first EV.POWER { on: false } or alarm symptom (PHASE4.md §4.2: every farm minute counts).
   * Returns false when an alarm stopped it.
   */
  function advance(h, stop) {
    if (!(h > 0)) return true;
    if (!stop || !canCut()) { env.skipHours(h); flock?.afterSkip?.(h); return true; }
    const a0 = alarms, p0 = pinStops, t0 = env.day, target = env.day + h / 24;
    while (target - env.day > 0.5 / 1440 && alarms === a0 && pinStops === p0) {
      const before = env.day;
      env.skipHours(Math.min(1 / 60, (target - env.day) * 24));
      if (env.day <= before + 1e-12) break;
    }
    const done = (env.day - t0) * 24;
    if (done > 0) flock?.afterSkip?.(done); // the drawn flock spread over the skipped time
    if (alarms === a0 && pinStops !== p0) pinStopAt = env.day;
    return alarms === a0 && pinStops === p0;
  }
  /** The last Next job skip an alarm stopped: { at, alarms } (the ui says why the clock stopped there). */
  let stoppedAt = null, pinStopAt = null;
  function skip(hours, { stopOnAlarm = false } = {}) {
    if (hours <= 0) return;
    engine.tick(); // a state met just before the skip still counts (its window may close during it)
    const d0 = env.dayNumber, target = env.day + hours / 24;
    ui?.closePanel?.();
    let stopped = false;
    // a saved start inside the level is taken exactly at its 06:00 (PHASE3.md §11)
    for (const s of innerStarts(env.day, target)) {
      if (s.t > env.day + 1e-9 && !advance((s.t - env.day) * 24, stopOnAlarm)) { stopped = true; break; }
      engine.tick(); checks();
      if (ended) return;
      reachStart(s.d);
    }
    if (!stopped && target > env.day + 1e-9) stopped = !advance((target - env.day) * 24, stopOnAlarm);
    if (stopped) stoppedAt = { at: env.day, alarms };
    engine.tick();
    checks();
    if (env.dayNumber !== d0 && env.hour >= 5.9 && env.hour < 12) player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw); // each morning at the gate
    scheduleSave(0.5);
  }
  const reached = new Set();
  function reachStart(day, { teleport = true } = {}) {
    if (!inLevel() || reached.has(`${def.id}@${day}`)) return;
    reached.add(`${def.id}@${day}`);
    // the morning after a skip starts at the gate; the running clock leaves the farmer where he is (PHASE3.md §2.3)
    if (teleport) player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
    if (inRun && runApi) { try { runApi.startDay(day); } catch (err) { console.error('run start save failed', err); } }
  }
  /** Where a Next job skip lands. With jobs open (the confirmed second press) it stops at the earliest moment one
   *  of them closes, or the next 06:00, whichever comes first, never at a level end weeks away. */
  function skipTarget(open = engine.open()) {
    const next = engine.nextOpening();
    if (!open.length) return next;
    const morning = Math.floor(env.day - 0.25 + 1e-9) + 1 + 0.25; // the next 06:00
    let cap = morning;
    for (const i of open) if (i.closesAt != null && i.closesAt > env.day + 1e-6 && i.closesAt < cap) cap = i.closesAt;
    return Math.min(next, cap);
  }
  /** The skip in words: the day when it is not today, and the level's end when the skip ends the level. */
  function skipText(t, openN = 0) {
    const s = splitDay(t), when = s.day !== env.dayNumber ? `${hhmm(s.hour)}, day ${s.day}` : hhmm(s.hour);
    const jobs = openN ? ` — ${openN} job${openN === 1 ? '' : 's'} open` : '';
    return t >= engine.endAt() - 1e-7 ? `End ${def.short ?? 'the level'} at ${when}${jobs}` : `Skip to ${when}${jobs}`;
  }
  function nextLabel() {
    if (free) return 'No jobs (free run)';
    if (!inLevel()) return 'Next job';
    if (dark()) return 'No skipping: the power is off';
    if (pending && stepClock.now() - pending.at < NEXT_CONFIRM_MS) return pending.label;
    if (engine.open().length) return 'Next job';
    return skipText(skipTarget([]));
  }

  // ---------------- env for a fresh start (the prep day, or the planning day) ----------------
  function prepEnv(d = LEVEL1, condition = null) {
    env.reset();
    // the level's weather as the condition has it (config conditionLevel: the hot season's planning day is hot too)
    env.setWeather(conditionLevel(d, condition).weather || d.weather);
    env.setDay(d.startDay);
    env.setHour(d.startHour);
    env.forceHouseTemp(null);
    env.clearWeatherEvents?.();
    env.setFans(0); env.setPad(false); env.setVentTimer(null);
    env.setLightProgram({ darkStart: 2, darkHours: 1, dimmer: 1 });
    env.houseTemp = env.outsideTemp + 1; // an empty, cold house
    env.setHeaterSetpoint(20);            // brooders cold until the farmer pre-heats
    env.settleHeaters();
  }
  /** Everything of one level (a new level, a replay, a resume). */
  function resetLevelState() {
    fired = new Set(); points = []; weighs = []; signedEnd = false; ended = null; pending = null; failAt = null;
    startAt = null; reached.clear(); stoppedAt = null; bad = { gradedOut: 0, looked: 0, weak: 0, called: null };
    fast = false; userPaused = false; saveIn = null; lastSaveDay = null; tickAcc = 0;
  }
  function resetRun() {
    if (free) { env.setMaxDay?.(42); free = null; }
    resetLevelState();
  }
  function enterMode(phase) {
    level.mode = 'level';
    lastDay = env.dayNumber;
    ui?.setMode?.('level');
    emitLevel({ phase });
  }

  // ---------------- debug.goto auto: the ideal farmer's rounds ----------------
  // brooding week: farm-profiles.applyRound at the rounds test-sim plays; the planning day: the planning
  // sign's reference plan (IDEAL_PLAN); from week 2: farm-profiles-cycle.applyCycleRound at its cycleStops
  /** A condition's ideal profile (the sim package's cycleProfileOf(name, { condition }); a name in the normal season). */
  const profileFor = (name = 'ideal') => (condNow() && cycleProfiles.cycleProfileOf ? cycleProfiles.cycleProfileOf(name, { condition: condNow() }) : name);
  /** The brooding week's ideal under the farm's condition: Phase 2's ideal plus the condition's (the sim's playBrooding:
   *  the hot season drops the warm-afternoon timer; a bad batch grades, calls, follows the warmer row). */
  const p2Profile = () => (condNow() ? { ...profileOf('ideal'), ...p2ProfileFor(cycleProfiles.cycleProfileOf('ideal', { condition: condNow() })) } : 'ideal');
  function autoStopsL1(target) {
    const st = farm.stats, out = [];
    const truckH = lv().delivery?.arrivalHour ?? LEVEL1.arrivalHour;   // a bad batch's truck comes late (PHASE4.md §4.3)
    const firstTip = st.firstTipAt ?? LEVEL1.arrivalDay + (truckH + 0.1) * H;
    const add = (d, hr, r, t = d + hr * H) => { if (t > env.day + 1e-9 && t < target) out.push({ d, r, t }); };
    const prepDone = !!records?.row?.(LEVEL1.startDay)?.signed;
    for (let d = env.dayNumber; d <= Math.min(Math.floor(target), LEVEL1.endDay); d++) {
      if (d < LEVEL1.arrivalDay) {
        // the prep round is past due (goto called after 07:15): play it now rather than drop it
        if (!prepDone) { add(d, 7.25, 'prep', Math.max(d + 7.25 * H, env.day + 1e-6)); add(d, 20, 'eve'); add(d, 21, 'sign'); }
        continue;
      }
      add(d, d === 1 ? 6.5 : 6.25, 'am');
      if (d === LEVEL1.arrivalDay) { add(d, truckH + 0.1, 'truck'); add(d, 0, 'vent', firstTip + 2.6 * H); }
      if (d === 1) add(d, 0, 'crop', firstTip + 23 * H);
      if (d === 6) { add(d, 12, 'noon'); add(d, 17, 'late'); }
      if (d === LEVEL1.endDay) add(d, 9, 'weigh');
      add(d, d === 4 ? 15 : 13.25, 'pm');   // day 4: the leak shows by the afternoon (10:00 + 5 h)
      add(d, 20, 'sign');
    }
    // a condition's own rounds of the brooding week (the sim's broodStopsCond: the hot season's 11:00 pad and its 18:00
    // end, the storms' flaps, the water test, a bad batch's crops at 48 h and warmer thermostat), after Phase 2's rounds
    // of the same minute (as the sim's playBrooding sorts them); played by applyRound with the condition's Phase 2 profile
    if (condNow()) for (const s of broodStopsCond(condNow(), farm.delivery).stops) {
      const t = s.d + s.h * H;
      if (s.d >= env.dayNumber && s.d <= LEVEL1.endDay && !L1_ROUNDS.has(s.r) && t > env.day + 1e-9 && t < target) out.push({ d: s.d, r: s.r, t, late: 1 });
    }
    return out.sort((a, b) => a.t - b.t || (a.late || 0) - (b.late || 0));
  }
  function autoStops(target) {
    if (is(def, LEVEL1)) return autoStopsL1(target);
    const out = [];
    const add = (d, r, t) => { if (t > env.day + 1e-9 && t < target) out.push({ d, r, t }); };
    if (is(def, PLAN_LEVEL)) {
      const d = PLAN_LEVEL.startDay;
      if (!farm.plan?.sentAt) add(d, 'plan', Math.max(d + 7.25 * H, env.day + 1e-6));
      const sent = farm.plan?.sentAt ?? Math.max(d + 7.25 * H, env.day + 1e-6);
      add(d, 'reply', sent + 1.05 * H);
      add(d, 'sign', d + 20 * H);
      return out.sort((a, b) => a.t - b.t);
    }
    const last = Math.min(Math.floor(target), def.endDay);
    for (const s of cycleProfiles.cycleStops(env.dayNumber, last, condNow())) add(s.d, s.r, s.d + s.h * H);
    return out.sort((a, b) => a.t - b.t);
  }
  function pickDead() {
    // the dead birds of the round: picked up (the flock mirrors the farm's count) and counted at the bin
    const n = farm.flock.deadOnFloor;
    if (n > 0) { events?.emit(EV.DEAD_PICK, { n, causes: {}, carried: n }); farm.act('dead.count', { n, causes: {} }); }
  }
  function planRound(r) {
    if (r === 'plan') {
      uiAct('sign.read', { board: 'sign-gate' });
      events?.emit(EV.FOOTDIP, { where: 'gate' });
      farm.act('bio.change', {});
      uiAct('plan.letter', {});
      farm.act('plan.measure', { axis: 'length', m: 48.0 });
      farm.act('plan.measure', { axis: 'width', m: 12.0 });
      events?.emit(EV.HOUSE_ENTER, { dipped: true });
      farm.act('plan.send', { ...IDEAL_PLAN, sums: planSums(IDEAL_PLAN, 48 * 12) });
    } else if (r === 'reply') uiAct('plan.reply', {});
  }
  function autoRound(s, profile = 'ideal') {
    const jobOpen = (id) => engine.list().some((i) => i.id === id && i.status === 'open');
    const r = s.r;
    if (r === 'sign') { if (!records?.row?.(s.d)?.signed) records?.sign?.(s.d); return; }
    if (is(def, PLAN_LEVEL)) { planRound(r); return; }
    if (is(def, LEVEL1)) {
      if (r === 'truck' && !(farm.flock.inBoxes > 0)) return;
      if (r === 'vent' && !jobOpen('d0-vent')) return;
      if (r === 'crop' && !jobOpen('d1-crop')) return;
      if (r === 'weigh' && !jobOpen('d7-weigh')) return;
      try { applyRound(farm, env, s.d, r, p2Profile()); } catch (err) { console.error('applyRound failed', err); }
      if (r === 'am' || r === 'pm') pickDead();
      return;
    }
    try { cycleProfiles.applyCycleRound(farm, env, s.d, r, profileFor(profile)); } catch (err) { console.error('applyCycleRound failed', err); }
    pickDead();
  }

  let prevDay = null;

  const level = {
    mode: 'sandbox',
    engine,
    /** null, or the sample the open job wants: 'vent' | 'crop' | 'weigh' | 'bird'. The flock's `chick`
     *  interact provider only answers while this is set. */
    sampling: null,
    get fast() { return fast; },
    get inRun() { return inRun; },
    get startAt() { return startAt; },
    hudHooks: {
      // the pause holds at once (not from the next frame): env.paused is set here too
      togglePause() { userPaused = !userPaused; if (level.mode === 'level' && userPaused) env.paused = true; },
      setFast(on) { fast = !!on; userPaused = false; },
      /** A panel action that waits on farm time (a flow test, pans filling, a flush): a clock the farmer paused runs
       *  again at normal speed (the open panel's own speed while it stays open). True if it was paused. */
      resume() { if (!userPaused) return false; userPaused = false; fast = false; return true; },
      get fast() { return fast; },
      get userPaused() { return userPaused; },
      /** The HUD's day (PHASE3.md §2.3). */
      // the HUD clock keeps one width: the booked chick day stays on the job card and in the book
      dayText() { return dayLabel(env.dayNumber); },
      /** Phase 4: the condition's name under the day ("Hot season"); '' in the normal season (PHASE4.md §1.2). */
      conditionText() { return condNow() ? conditionLabel(condNow()) : ''; },
      /** The house has no power: the clock runs at the carrying speed and Next job does not skip. */
      get dark() { return dark(); },
      rateLabel() {
        if (env.paused) return userPaused ? 'Paused' : 'Stopped';
        if (env.timeScale === 0) return 'Stopped';
        if (env.timeScale === C.fast) return '4×';
        if (env.timeScale === C.work) return '1×';
        return `${env.timeScale / C.work}×`.replace('0.25×', '¼ speed');
      },
    },
    /** run.js: its side of saves and results (see the header). */
    attachRun(api) { runApi = api || null; },
    /** A Phase 2 save resumed as the brooding week of a run (run.continueSave). */
    joinRun() { inRun = true; },
    /** The skill profile as it is now / put back (a standard start plays the ideal farmer: his points
     *  are not the player's). */
    profile: {
      snapshot() { return { skills: skills?.serialize?.() ?? null, details: [...details] }; },
      restore(p) { if (!p) return; if (p.skills) skills?.restore?.(p.skills); details.clear(); for (const [k, v] of p.details || []) details.set(k, v); saveProfile(); },
      /** Phase 4 (PHASE4.md §3.1): { cyclesDone (undefined in a Phase 3 profile), conditionsDone: { [id]: n } }. */
      cycles() { return { cyclesDone: cyc.cyclesDone, conditionsDone: { ...cyc.conditionsDone } }; },
      /** A run reached its cycle summary with every level passed: cyclesDone + 1 (from `base` when the profile has none
       *  yet), and conditionsDone[condition] + 1 for a run played under that condition alone. Saved at once. */
      raiseCycle(condition = null, base = 0) {
        cyc.cyclesDone = (cyc.cyclesDone || base) + 1;   // 0 or none: from `base` (a Phase 3 profile with a finished cycle stored)
        if (condition && CONDITIONS[condition]) cyc.conditionsDone[condition] = (cyc.conditionsDone[condition] ?? 0) + 1;
        saveProfile();
        return { cyclesDone: cyc.cyclesDone, conditionsDone: { ...cyc.conditionsDone } };
      },
    },
    boot() {
      loadProfile();
      if (typeof navigator !== 'undefined' && navigator.webdriver) { level.mode = 'sandbox'; ui?.setMode?.('sandbox'); return; }
      level.toTitle();
    },
    /** A fresh level that starts the flock: the brooding week (Phase 2, default) or the planning day. */
    start(opts = {}) {
      const d = is(opts.def, PLAN_LEVEL) || opts.level === 'plan' ? PLAN_LEVEL : LEVEL1;
      seed = opts.seed ?? 1;
      if (level.mode === 'sandbox' || level.mode === 'title') loadProfile();
      resetRun();
      inRun = !!opts.run;
      def = d;
      if (!inRun) save?.clear?.();
      ui?.closePanel?.();
      const cond = opts.condition && CONDITIONS[opts.condition] ? opts.condition : null;
      prepEnv(d, cond);
      records?.reset?.();
      props?.reset?.();
      flock?.resetLevel?.();
      ui?.newRun?.();
      // Phase 4: the condition goes on the farm here and only here (null = the normal season, PHASE4.md §3.1)
      farm.start(d, { seed, condition: cond });
      // the planning day of a condition run in the condition's weather (the farm keeps the plan level's own; PHASE4.md §1.2)
      if (cond && is(d, PLAN_LEVEL)) { const w = conditionLevel(d, cond).weather; if (w && env.weather !== w) { env.setWeather(w); env.houseTemp = env.outsideTemp + 1; } }
      startAt = env.day;
      reached.add(`${d.id}@${d.startDay}`);
      engine.start(d.startDay, d);
      player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
      prevDay = env.day;
      enterMode('start');
      scheduleSave(1);
      return true;
    },
    /** The next level of the run on the same flock (PHASE3.md §2.2). */
    enter(next, opts = {}) {
      if (typeof next === 'string') next = levelById(next);
      if (!next || is(next, LEVEL1) || is(next, PLAN_LEVEL)) return false;
      if (free) free = null;
      if (opts.run != null) inRun = !!opts.run;
      resetLevelState();
      ui?.closePanel?.();
      env.setMaxDay?.(CYCLE.lastDay);
      const t = next.startDay + next.startHour * H;
      if (t > env.day + 1e-9) { const h = (t - env.day) * 24; env.skipHours(h); flock?.afterSkip?.(h); } // the night, with the farmer's settings
      def = next;
      farm.enterLevel(next);
      // the notebook of the levels before the last one folds away (the rows stay whole; PHASE3.md §8.6): the run save
      // stays under its 250 KB to the end of the rest
      const prevDef = LEVELS[LEVELS.findIndex((l) => l.id === next.id) - 1];
      if (records?.compact && prevDef) records.compact(prevDef.startDay);
      startAt = env.day;
      reached.add(`${next.id}@${next.startDay}`);
      engine.start(next.startDay, next);
      ui?.jobCard?.reset?.();
      ui?.clearCaptions?.();
      player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
      prevDay = env.day;
      enterMode('start');
      return true;
    },
    resume(data) {
      if (!data || !data.level || !data.env) return false;
      // the skill profile first: a resume (Continue or the artifact hot reload) never starts from
      // empty skills, and the next award saves the profile it came from
      loadProfile();
      resetRun();
      ui?.closePanel?.();
      ui?.newRun?.();
      const e = data.env, lv = data.level;
      const d = levelById(lv.levelId) || LEVEL1;
      const maxDay = e.maxDay ?? (is(d, LEVEL1) || is(d, PLAN_LEVEL) ? 42 : CYCLE.lastDay);
      // restore order (PHASE2.md §11, PHASE3.md §11): env -> farm -> records -> props -> flock -> level.
      // farm.start (keepClock) first: it puts the level climate on with the start equipment; the saved
      // env values go on top of it and farm.restore rebuilds timer, light and weather.
      env.reset();
      env.setMaxDay?.(maxDay);
      env.setWeather(e.weather || d.weather);
      env.setDay(Math.floor(e.day - (e.hour ?? 0) * H + 1e-6));
      env.setHour(e.hour ?? 0);
      // the save's condition (farm.serialize().cond; farm.restore puts it back on the farm)
      const sc = data.farm?.cond?.condition;
      farm.start(d, { seed: lv.seed ?? 1, keepClock: true, condition: sc && CONDITIONS[sc] ? sc : null });
      env.setMaxDay?.(maxDay);
      env.setFans(e.fansManual ?? e.fansOn ?? 0); env.setPad(!!e.padOn);
      env.setVentTimer(e.ventTimer ?? null);
      env.setLightProgram(e.lightProgram || { darkStart: 2, darkHours: 1, dimmer: 1 });
      env.setHeaterSetpoint(e.heaterSetpoint ?? 20);
      if (e.houseTemp != null) env.houseTemp = e.houseTemp;
      if (e.slabTemp != null) env.slabTemp = e.slabTemp;
      if (e.houseRH != null) env.houseRH = e.houseRH;
      if (e.heaterLevel != null) { env.heaterLevel = e.heaterLevel; env.heatersOn = e.heaterLevel > 0.02; }
      // Phase 3 env fields (PHASE3.md §11)
      if ('curtain' in e) env.setBroodCurtain?.(e.curtain);
      if (e.cycleClimate != null) env.setCycleClimate?.(!!e.cycleClimate);
      if (Array.isArray(e.fansBroken)) env.setFansBroken?.(e.fansBroken);
      if (e.padWorking != null) env.padWorking = e.padWorking;
      if (e.fanStages !== undefined) env.setFanStages?.(e.fanStages);
      if (e.broodersUp != null) { if (env.setBroodersUp) env.setBroodersUp(!!e.broodersUp); else env.broodersUp = !!e.broodersUp; }
      // Phase 4: optional (a Phase 3 save has neither); farm.restore puts the farm's power state back after this
      if (e.powerOn != null) env.setPower?.(!!e.powerOn);
      if (e.targetShift != null) env.setTargetShift?.(e.targetShift);
      farm.restore(data.farm);
      if (farm.mode !== 'level') { farm.mode = 'level'; farm.level = d; }
      records?.restore?.(data.records);
      props?.restore?.(data.props);
      flock?.restore?.(data.flock);
      if (props?.carrying === 'chick') props.drop?.(); // a chick in the hand is not in the save: hands empty
      def = d;
      seed = lv.seed ?? 1;
      inRun = !!lv.inRun;
      engine.restore(lv.jobs, d);
      fired = new Set(lv.fired || []); points = lv.points || []; weighs = lv.weighs || []; signedEnd = !!(lv.signedEnd ?? lv.signed7); fast = !!lv.fast;
      failAt = lv.failAt ?? null; startAt = lv.startAt ?? env.day;
      if (lv.bad) bad = { gradedOut: lv.bad.gradedOut || 0, looked: lv.bad.looked || 0, weak: lv.bad.weak || 0, called: lv.bad.called ?? null };
      for (const k of lv.reached || []) reached.add(k);
      if (inRun && lv.run && runApi) runApi.adopt(lv.run);
      if (data.player && player) player.teleport(data.player.x, data.player.z, data.player.yaw);
      prevDay = env.day;
      enterMode('resume');
      engine.tick();
      // a level saved at its end (a run's level-end save) shows its result again, it does not play on
      if (lv.ended) end(lv.ended);
      return true;
    },
    continueSave() { const d = save?.load?.(); return d ? level.resume(d) : false; },
    toSandbox() {
      saveNow();
      resetRun();
      inRun = false;
      ui?.closePanel?.();
      farm.stop?.();
      props?.reset?.();
      flock?.resetLevel?.();
      env.reset();
      env.clearWeatherEvents?.();
      env.setVentTimer(null);
      player?.teleport?.(FARM.spawnSandbox.x, FARM.spawnSandbox.z, FARM.spawnSandbox.yaw);
      level.mode = 'sandbox';
      level.sampling = null;
      def = LEVEL1;
      ui?.setMode?.('sandbox');
    },
    toTitle() {
      saveNow();
      ui?.closePanel?.();
      if (level.mode !== 'level') {
        // over the farm at dawn
        env.setHour(6.4);
        player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
      }
      level.mode = 'title';
      env.paused = true;
      ui?.setMode?.('title');
    },
    /** Phase 2's lone brooding week: start it again (a run replays through run.replay). */
    replay() { return level.start({ seed }); },
    keepWalking() { if (!ended || inRun) return; level.mode = 'level'; ui?.closePanel?.(); ui?.setMode?.('level'); },
    update(dt) {
      if (level.mode === 'title' || level.mode === 'result') { env.paused = true; return; }
      if (level.mode !== 'level') return;
      if (ended) { // keep walking on the last day: the clock runs to 23:59, then stands; the level is over
        const stopAt = def.endDay + 23.98 / 24;
        env.paused = !!userPaused || ui?.panelKind === 'paused' || env.day >= stopAt - 1e-9;
        env.timeScale = C.work;
        if (env.day > stopAt) { env.setDay(def.endDay); env.setHour(23.98); }
        return;
      }
      clock();
      // a saved start inside the level (weeks 4-5: day 29 06:00) reached by the running clock
      if (prevDay != null && !free) for (const s of innerStarts(prevDay, env.day)) reachStart(s.d, { teleport: false });
      prevDay = env.day;
      tickAcc += dt;
      if (tickAcc >= 0.5) { tickAcc = 0; engine.tick(); checks(); }
      if (env.dayNumber !== lastDay) { lastDay = env.dayNumber; emitLevel({ phase: 'day' }); }
      const list = engine.list();
      const open = (id) => list.some((i) => i.id === id && i.status === 'open');
      const weighOpen = list.some((i) => i.status === 'open' && i.def.done?.id === 'sample.weigh' && i.def.kind !== 'problem');
      level.sampling = open('d0-vent') ? 'vent' : open('d1-crop') ? 'crop' : weighOpen ? 'weigh'
        : env.dayNumber >= 8 && (open('w2-check') || open('w3-droppings')) ? 'bird' : null;
      if (saveIn != null && (saveIn -= dt) <= 0) saveNow();
      if (lastSaveDay == null) lastSaveDay = env.day;
      else if (env.day - lastSaveDay >= 2 * H) saveNow();
      if (pending && stepClock.now() - pending.at > NEXT_CONFIRM_MS) pending = null;
    },
    nextJob() {
      if (!inLevel() || free) return null;
      const open = engine.open();
      const now = stepClock.now();
      // Phase 4: no skip while the house is dark (PHASE4.md §4.2): the marker stays on the power job
      if (dark()) { pending = null; ui?.jobCard?.refresh?.(); return { refused: 'dark', pointed: engine.current()?.key ?? null }; }
      if (open.length && !(pending && now - pending.at < NEXT_CONFIRM_MS)) {
        const c = engine.cycle();
        pending = { at: now, label: skipText(skipTarget(open), open.length) };
        ui?.jobCard?.refresh?.();
        return { pointed: c?.key ?? null };
      }
      pending = null;
      const target = skipTarget(open);
      const hrs = (target - env.day) * 24;
      // a long jump (more than a day: the rest days) shows the busy card while the farm runs it
      const t0 = env.day;
      if (hrs > 24 && ui?.busy?.run) { ui.busy.run(skipText(target), () => skip(hrs, { stopOnAlarm: true })); return { skipped: hrs }; }
      skip(hrs, { stopOnAlarm: true });
      const went = (env.day - t0) * 24;
      return went < hrs - 1 / 60 && stoppedAt ? { skipped: went, stopped: pinStopAt === env.day ? 'job' : 'alarm' } : { skipped: hrs };
    },
    nextLabel,
    /** A bad batch's grading at the table so far ({ gradedOut, looked, weak, called }; the records book's hatchery call). */
    badBatch() { return { ...bad }; },
    /** The last Next job skip an alarm stopped ({ at, alarms }) or null. */
    get skipStopped() { return stoppedAt; },
    /**
     * Phase 4 (PHASE4.md §3.2): the level's jobs again for the farm's condition (farm.setCondition on a running farm:
     * __game.setCondition, EV.LEVEL { phase: 'condition' }): another condition's jobs go, the condition's come.
     */
    rebuildJobs() {
      if (level.mode !== 'level' || ended || free) return false;
      const r = engine.rebuild();
      ui?.jobCard?.refresh?.();
      return r;
    },
    /** Today's hand weighings the level keeps (saved with the level: they survive a reload). */
    weighsToday() { return weighs.filter((x) => (x.day ?? LEVEL1.endDay) === env.dayNumber); },
    jobs: {
      list: () => engine.list(),
      open: () => engine.open(),
      current: () => engine.current(),
      complete: (key) => engine.complete(key),
      byKey: (key) => engine.byKey(key),
    },
    skillDetail: (id) => details.get(id) || '',
    get result() { return ended; },
    /** The current level def (config LEVELS): the level that runs, or the level of a free run's day. */
    get def() { return free ? free.def : def; },
    /** Deaths and culls (and DOA in the last week) since the level's start: { n, of, pct }. */
    levelDeaths,
    /** The level's start counters (farm.stats.levelStart, or the level's own while the farm keeps none). */
    startCounts,
    serialize() {
      return { v: 1, mode: level.mode, seed, levelId: def.id, inRun, jobs: engine.serialize(), fired: [...fired], points, weighs,
        signed7: signedEnd, signedEnd, fast, failAt, startAt, reached: [...reached], ended: ended ? ended.reason : null,
        ...(bad.gradedOut || bad.called != null ? { bad: { ...bad } } : {}),
        ...(inRun && runApi ? { run: runApi.serialize() } : {}) };
    },
    saveBlob() {
      const p = player;
      return {
        level: level.serialize(),
        env: { day: env.day, hour: env.hour, weather: env.weather, houseTemp: env.houseTemp, slabTemp: env.slabTemp, houseRH: env.houseRH,
          heaterSetpoint: env.heaterSetpoint, heaterLevel: env.heaterLevel, fansOn: env.fansOn, fansManual: env.fansManual, padOn: env.padOn,
          ventTimer: env.ventTimer, lightProgram: env.lightProgram,  // weatherEvents: rebuilt by the farm
          // Phase 3 (PHASE3.md §11)
          maxDay: env.maxDay, curtain: env.curtainForced ?? null, cycleClimate: !!env.cycleClimate, fansBroken: [...(env.fansBroken || [])],
          padWorking: env.padWorking ?? 1, fanStages: env.fanStages ?? null, broodersUp: !!env.broodersUp,
          // Phase 4 (PHASE4.md §11.1; the sim's env fields once it has them): the house's power and a weak batch's +1 °C
          ...(env.powerOn != null ? { powerOn: !!env.powerOn } : {}), ...((env.targetShiftC ?? env.targetShift) != null ? { targetShift: env.targetShiftC ?? env.targetShift } : {}) },
        farm: farm?.serialize() ?? null,
        records: records?.serialize() ?? null,
        props: props?.serialize() ?? null,
        flock: flock?.serialize?.() ?? null,
        player: p ? { x: p.position.x, z: p.position.z, yaw: p.yaw } : null,
      };
    },
    debug: {
      /** Jump to day + hour inside the level. auto: the ideal farmer's management at each round passed
       *  (the brooding week: farm-profiles.applyRound at the rounds scripts/test-sim.mjs plays; the
       *  planning day: the reference plan; from week 2: farm-profiles-cycle.applyCycleRound at its
       *  cycleStops); dead birds picked up and counted after each round, the evening record signed, and
       *  the jobs still open completed and logged. A target past the level's end ends the level there. */
      goto(day, hour, { auto = false, profile = 'ideal' } = {}) {
        if (level.mode !== 'level') level.start({ seed });
        const target = day + hour * H;
        if (target <= env.day + 1e-9) return false;
        if (auto) {
          {
            for (const s of autoStops(target)) {
              if (s.t > env.day + 1e-9) skip((s.t - env.day) * 24);
              if (ended) return true;
              autoRound(s, profile);
              engine.tick(); checks();
              if (ended) return true;
              for (const i of engine.open()) engine.complete(i.key, { auto: true });
              engine.tick(); checks();
              if (ended) return true;
            }
          }
        }
        if (ended) return true;
        // a later level stops at its end (Next job never skips past it); the brooding week as Phase 2
        const to = is(def, LEVEL1) ? target : Math.min(target, engine.endAt());
        if (to > env.day + 1e-9) skip((to - env.day) * 24);
        return true;
      },
      /**
       * A level-mode farm at (day, hour) for any day up to the clean-out, for the other packages' tools
       * (__game.cycleAt). Inside the brooding week it is goto(auto). Later: the ideal week to day 7 12:00,
       * then the clock runs with the cycle profile's care (farm-profiles-cycle.js) at its stops, records
       * signed at 20:00, dead birds counted; no jobs, no level end, no autosave.
       */
      freeRun(day, hour = 6, opts = {}) {
        const target = day + hour * H;
        if (!free && !(level.mode === 'level' && !ended && is(def, LEVEL1))) level.start({ seed: opts.seed ?? seed });
        if (!free && target <= LEVEL1.endDay + 12 * H) return level.debug.goto(day, hour, { auto: true });
        if (!free) {
          level.debug.goto(LEVEL1.endDay, 12, { auto: true });
          if (ended) return false;
          engine.finish();
          env.setMaxDay?.(CYCLE.lastDay);
          free = { def: levelOfDay(day) };
        }
        free.def = levelOfDay(day);
        if (target <= env.day + 1e-9) return true;
        for (const s of cycleProfiles.cycleStops(env.dayNumber, Math.floor(target), condNow())) {
          const t = s.d + s.h * H;
          if (t <= env.day + 1e-9 || t >= target) continue;
          skip((t - env.day) * 24);
          if (s.r === 'sign') { if (!records?.row?.(s.d)?.signed) records?.sign?.(s.d); continue; }
          try { cycleProfiles.applyCycleRound(farm, env, s.d, s.r, profileFor('ideal')); } catch (err) { console.error('applyCycleRound failed', err); }
          pickDead();
        }
        if (target > env.day + 1e-9) skip((target - env.day) * 24);
        return true;
      },
      /** Start a problem now (the farm decides the symptom when the farmer meets it). */
      trigger(id) { farm.debug?.trigger?.(id); },
      /** Show the result screen now. forcePass true / false makes a passing / failing level for the harness. */
      result(forcePass) {
        const r = computeResult('debug');
        if (is(def, LEVEL1)) {
          if (forcePass === false) { r.pass = false; r.ratio = 3.8; r.weightG = r.chickWeightG * 3.8; r.failText = `day 7 weight ${two(r.ratio)} × chick weight`; }
          else if (forcePass === true && !r.pass) { r.pass = true; }
        } else if (forcePass === false) { r.pass = false; if (!r.failText) r.failText = `not passed on day ${env.dayNumber}`; }
        else if (forcePass === true) r.pass = true;
        if (inRun && runApi) { try { runApi.decorate(r); } catch (err) { console.error('run decorate failed', err); } }
        showResult(r);
        return r;
      },
    },
  };
  return level;
}
