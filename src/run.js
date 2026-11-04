// The run: seven levels on one flock, from the plan to the rested house (PHASE3.md §2, §10, §11).
// Owner: package "run". level.js plays one level at a time; the run chains them, saves the level
// starts, replays a level (or the one before it) from its saved start, and makes standard starts.
//
// createRun({ level, save, events, farm, env, records }) -> run
//   stub                  false
//   state()               { levelId, seed, plan, lastCycle, levels: { [id]: { state, key, attempts, starts, carried } },
//                         summary, conditions }
//   startRun({ seed, at })   a new run: Level 1 (plan) or, with at: 'level1', the brooding week (no plan)
//   startLevel(id, { from: 'saved' | 'standard', seed })   start one level of the run: its saved start,
//                         else a standard start (the ideal farmer from the brooding week to its start)
//   next()                after a passed level: continue the run into the next level (keeps the flock)
//   replay(id, { day })   restore that level's saved start (the latest, or the one of `day`); the run goes
//                         back to it: later levels and their starts are deleted (skills are kept)
//   continueSave()        the run save (else a Phase 2 save, resumed as a run at the brooding week)
//   info()                the title card's Continue line: { levelId, title, day, hour } | null
//   card()                the run card: one row per level (PHASE3.md §1)
//   serialize() / restore(d)   the run's part of the save (PHASE3.md §11)
// Events: EV.RUN { phase: 'start' | 'level-start' | 'level-end' | 'cycle-end', level, pass?, condition }.
//
// Phase 4 (PHASE4.md §3.1): one condition per run, held on the farm only: startRun({ seed, at, condition }) and
// startLevel(id, { from, condition }) put it there through level.start -> farm.start(def, { condition }); replays carry it in
// the saved farm. state().condition mirrors farm.condition (the run save writes it for the run card). A condition other
// than the run's chosen on a level row starts a NEW run (the old one replaced as Start a new flock does) whose earlier
// levels are the condition ideal's standard-start trace (summary.fromStandard). conditionsDone[id] rises for a run played
// under one condition from the level it was started at through the clean-out; cyclesDone for every finished run (both in
// the skill profile: level.profile.cycles()). The harder flocks open once cyclesDone >= 1 (harderOpen) and where
// config CONDITIONS[id].available (the build switch).
//
// Saves (config RUN_SAVE): the run key { version 3, savedAt, run, blob } at the level's autosave moments
// and at each level start and end; the level starts `<startPrefix><id>[.<day>]` (weeks 4-5: .22 and .29).
// The store is save.js createRunStore() (package "sim"); every start is also kept in memory (node,
// storage blocked: replays still work).
import { LEVEL1, LEVELS, PLAN_LEVEL, RUN_SAVE, CONDITIONS, CONDITION_IDS, levelById, weightAt, conditionLabel } from './config.js';
import { EV } from './events.js';
import { createRunStore } from './save.js';
import { RUN_CARD } from './content.js';
import { int, one, two } from './ui-format.js';

const H = 1 / 24;
export const RUN_ORDER = LEVELS.map((l) => l.id);
export const nextLevelId = (id) => RUN_ORDER[RUN_ORDER.indexOf(id) + 1] ?? null;
export const prevLevelId = (id) => { const i = RUN_ORDER.indexOf(id); return i > 0 ? RUN_ORDER[i - 1] : null; };
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
/** A level's short name inside a sentence: "the brooding week", "Week 2", "Plan the farm". */
const inText = (def) => (def?.short || '').replace(/^The /, 'the ');
const startKey = (id, day, def = levelById(id)) => `${RUN_SAVE.startPrefix}${id}${def && def.starts.length > 1 ? `.${day}` : ''}`;
const validCond = (c) => (c && CONDITIONS[c] ? c : null);
const before = (a, b) => RUN_ORDER.indexOf(a) < RUN_ORDER.indexOf(b);
/** What the summary of a condition cycle draws beside the farmer's last normal-season cycle (PHASE4.md §3.3). */
export function compareOf(sum) {
  if (!sum) return null;
  const { sold = null, meanLiveG = null, fcr = null, epef = null, mortalityPct = null } = sum;
  return { sold, meanLiveG, fcr, epef, mortalityPct, deathsByLevel: clone(sum.deathsByLevel ?? null) };
}

/** The level's key number for the run card and the run state (what was measured, PHASE3.md §10). */
export function keyOf(res) {
  if (!res) return null;
  switch (res.levelId) {
    case 'plan': return res.plan?.outcome?.salePerWeek ?? null;
    case 'level1': return res.ratio ?? null;
    case 'finish': return res.harvest?.meanLiveG ?? null;
    case 'cleanout': return res.lab?.positive ?? null;
    default: return res.weightG ?? null;
  }
}
/** The key number in words for the run card ("day 14: 472 g"). */
export function keyText(id, key) {
  if (key == null) return '';
  const def = levelById(id);
  switch (id) {
    case 'plan': return `${int(key)} birds for sale a week`;
    case 'level1': return `day 7: ${two(key)} × chick weight`;
    case 'finish': return `harvest: ${int(key)} g live`;
    case 'cleanout': return `${int(key)} of 10 swabs grew bacteria`;
    default: return `day ${def?.target?.day ?? ''}: ${int(key)} g`;
  }
}

const VACCINE_DAY = 12; // content-jobs-cycle w2-vaccine (the vaccine plate: day 12)
/** What the model carries from the previous level into this one, as plain record lines (PHASE3.md §10). */
function carriedLines({ def, farm, levels }) {
  const out = [];
  const prev = prevLevelId(def.id), prevDef = prev && levelById(prev);
  if (!prevDef || def.id === LEVEL1.id || def.id === PLAN_LEVEL.id) return out;
  const v = farm.health?.vaccine;
  const vDay = v?.startAt ?? v?.mixedAt ?? v?.thirstFrom;
  const inPrev = vDay != null && Math.floor(vDay) >= prevDef.startDay && Math.floor(vDay) <= prevDef.endDay;
  if (v && v.hours != null && v.hours > 2.5 && inPrev) out.push(`vaccine drunk in ${one(v.hours)} h on day ${Math.floor(vDay)}`);
  else if (v && v.coverage != null && v.coverage < 0.85 && inPrev) out.push(`vaccine reached ${int(v.coverage * 100)} % of the birds on day ${Math.floor(vDay)}`);
  // the week 2 jobs that the next weeks pay for: the vaccination (day 12) and the curtain (about day 10)
  if (prev === 'week2' && v && v.state === 'none') out.push(`no vaccine given on day ${VACCINE_DAY}`);
  else if (prev === 'week2' && v && v.state !== 'drunk') out.push(`the vaccine was not drunk by day ${def.startDay}`);
  if (prev === 'week2' && farm.house && !farm.house.curtainOpen) out.push(`brooding curtain still down on day ${def.startDay}`);
  const pk = levels[prev]?.key;
  if (pk != null && prev !== 'plan') {
    const wDay = prev === 'level1' ? LEVEL1.endDay : prevDef.target?.day;
    const w = prev === 'level1' ? levels[prev]?.weightG : pk;
    const tg = wDay != null ? weightAt(wDay) : null;
    if (w != null && tg && w / tg < 0.98) out.push(`day ${wDay} weight ${int(w)} g, ${int((100 * w) / tg)} % of the target`);
  }
  const dis = farm.health?.disease || {};
  if ((dis.cocci ?? 0) > 0) out.push(`coccidiosis in the flock at the start of day ${def.startDay}`);
  if ((dis.gumboro ?? 0) > 0) out.push(`Gumboro in the flock at the start of day ${def.startDay}`);
  const lit = farm.litter?.meanMoisturePct;
  if (Number.isFinite(lit) && lit > 30) out.push(`litter ${int(lit)} % on day ${def.startDay} at 06:00`);
  return out;
}

export function createRun({ level, save, events, farm, env, records } = {}) {
  let seed = 1, levelId = null, plan = null, summary = null;
  let lastCycle = null;             // { plan, summary } of the last finished cycle (planCarry; kept across startRun)
  let conditions = [];
  // Phase 4 (PHASE4.md §3.1): farm.condition is the only holder; `condition` is its mirror in the run save
  let condition = null;
  let runCond = null;               // the condition the run was started under (conditionsDone counts it)
  let startedAt = null;             // the first level the farmer played in this run
  let standard = false;             // the levels before startedAt came from a standard start (the ideal farmer's trace)
  let mixed = false;                // farm.condition was not the run's at a level start or end (a harness's setCondition)
  let counted = false;              // this run has raised cyclesDone
  let lastNormal = null;            // { compare } of the last finished normal-season cycle (the summary's compare column)
  const levels = {};
  const mem = new Map();            // level starts in memory: key -> { version, levelId, day, savedAt, run, blob }
  let memRun = null;                // the run save in memory (node, storage blocked)
  const store = createRunStore();     // save.js (package "sim"): the run key and the level starts
  const emit = (p) => events?.emit(EV.RUN, p);
  const entry = (id) => levels[id] || (levels[id] = { state: 'reached', key: null, attempts: 0, starts: [], carried: [] });

  /** farm.condition while the run has a level on the farm, else the saved mirror. */
  const mirror = () => (levelId && farm ? farm.condition ?? null : condition);
  function serialize() {
    condition = mirror();
    return { v: 1, seed, levelId, plan: clone(plan), levels: clone(levels), summary: clone(summary), conditions: [...conditions], condition, lastCycle: clone(lastCycle),
      runCond, startedAt, standard, mixed, counted, lastNormal: clone(lastNormal) };
  }
  function adopt(d) {
    if (!d) return;
    seed = d.seed ?? 1; levelId = d.levelId ?? null; plan = clone(d.plan) ?? null; summary = clone(d.summary) ?? null; conditions = [...(d.conditions || [])]; condition = validCond(d.condition);
    // a Phase 3 run save: no condition, started at its plan (or the brooding week when it has none)
    runCond = 'runCond' in d ? validCond(d.runCond) : condition; startedAt = d.startedAt ?? (d.plan ? PLAN_LEVEL.id : LEVEL1.id);
    mixed = !!d.mixed; counted = !!d.counted; standard = !!d.standard;
    lastCycle = clone(d.lastCycle) ?? lastCycle;
    lastNormal = clone(d.lastNormal) ?? lastNormal;
    for (const k of Object.keys(levels)) delete levels[k];
    Object.assign(levels, clone(d.levels) || {});
  }
  /** The run key carries the run beside the blob: the blob's own copy (level.run, for the hot reload) is left out. */
  const lean = (blob) => (blob && blob.level && blob.level.run ? { ...blob, level: (({ run, ...rest }) => rest)(blob.level) } : blob);
  function saveRun(full = level.saveBlob()) {
    const blob = lean(full);
    const d = { version: RUN_SAVE.version, savedAt: Date.now(), run: serialize(), blob };
    memRun = clone(d);
    return store.save(d.run, blob);
  }
  function saveStart(id, day) {
    const e = entry(id);
    if (!e.starts.includes(day)) e.starts.push(day);
    e.starts.sort((a, b) => a - b);
    const r = serialize(), blob = lean(level.saveBlob());
    mem.set(startKey(id, day), clone({ version: RUN_SAVE.version, levelId: id, day, savedAt: Date.now(), run: r, blob }));
    store.saveStart(id, day, r, blob);
  }
  function loadStart(id, day) {
    const def = levelById(id);
    // the latest start the run knows of this level (a stale later start of a replayed level is not one)
    const known = levels[id]?.starts?.length ? levels[id].starts : def?.starts || [];
    const days = day != null ? [day] : [...known].sort((a, b) => b - a);
    for (const d of days) { const s = mem.get(startKey(id, d)) || store.loadStart(id, d); if (s && s.levelId === id) return clone(s); }
    return null;
  }
  function clearStarts(fromId) {
    const from = RUN_ORDER.indexOf(fromId);
    if (from < 0) return;
    for (const id of RUN_ORDER.slice(from)) { for (const d of levelById(id).starts) mem.delete(startKey(id, d)); delete levels[id]; }
    store.clearStarts(fromId);
  }

  /** A level of the run has started (fresh, entered or restored): the run's records and its start save. */
  function started(def, { restored = false } = {}) {
    levelId = def.id;
    condition = farm?.condition ?? null;
    if (condition !== runCond) mixed = true;
    const e = entry(def.id);
    e.state = 'reached'; e.attempts++; e.key = null;
    if (!restored) e.carried = carriedLines({ def, farm, levels });
    emit({ phase: 'level-start', level: def.id, condition });
    if (!restored) saveStart(def.id, def.startDay);
    saveRun();
    return true;
  }

  /** The levels before the one the farmer started this run at: played by the ideal farmer (a standard start). */
  const fromStandardIds = () => (standard && startedAt && startedAt !== PLAN_LEVEL.id ? RUN_ORDER.slice(0, RUN_ORDER.indexOf(startedAt)) : []);
  /** The cycle summary (records.cycleSummary) with the run's condition, the compare column and the standard-start marks. */
  function cycleSummary() {
    const compare = runCond && lastNormal?.compare ? clone(lastNormal.compare) : null;
    const s = records.cycleSummary({ plan, levels: clone(levels), condition: runCond, compare }) ?? null;
    if (!s) return null;
    const fs = fromStandardIds(), start = levelById(startedAt);
    s.condition = s.condition !== undefined ? s.condition : runCond;
    s.conditionLabel = s.condition ? conditionLabel(s.condition) : null;
    if (s.compare === undefined) s.compare = compare;
    s.startedAt = startedAt;
    s.fromStandard = fs;
    s.standardNote = fs.length && start ? `from a standard start at Level ${start.n}` : null;
    if (Array.isArray(s.deathsByLevel)) s.deathsByLevel = s.deathsByLevel.map((r) => (r && fs.includes(r.level) ? { ...r, fromStandard: true } : r));
    return s;
  }

  // the run's side of the level (level.attachRun)
  const api = {
    serialize,
    adopt,
    saveRun,
    startDay(day) { if (levelId) { saveStart(levelId, day); saveRun(); } },
    levelEnd(res) {
      const id = res.levelId, e = entry(id);
      e.state = res.pass ? 'passed' : 'failed';
      e.key = keyOf(res);
      if (id === 'level1') e.weightG = res.weightG ?? null;
      if (id === 'plan') plan = farm.plan ? clone({ decisions: farm.plan.decisions, sums: farm.plan.sums, outcome: farm.plan.outcome, measured: farm.plan.measured, sentAt: farm.plan.sentAt }) : null;
      if ((farm?.condition ?? null) !== runCond) mixed = true;
      emit({ phase: 'level-end', level: id, pass: !!res.pass, condition: farm?.condition ?? null });
      if (res.pass && !nextLevelId(id)) {
        const hadCycle = !!lastCycle;
        summary = cycleSummary();
        // the skill profile's counters (PHASE4.md §3.1): every finished run; a condition only for a run played under it alone
        if (!counted) { counted = true; level.profile?.raiseCycle?.(runCond && !mixed ? runCond : null, hadCycle ? 1 : 0); }
        lastCycle = { plan: clone(plan), summary: clone(summary), condition: runCond };
        if (!runCond) lastNormal = { compare: compareOf(summary), seed };
        emit({ phase: 'cycle-end', level: id, pass: true, condition: runCond });
      }
      api.decorate(res);
      saveRun();
    },
    /** The run's buttons and lines on a result (PHASE3.md §10). */
    decorate(res) {
      const id = res.levelId, def = levelById(id), e = entry(id);
      const nid = nextLevelId(id), ndef = nid && levelById(nid);
      const failDay = res.failDay ?? res.day ?? env.dayNumber;
      // the level's own saved starts that lie before the failing measurement, latest first
      const starts = (e.starts.length ? e.starts : [def.startDay]).filter((d) => d <= failDay || d === def.startDay).sort((a, b) => b - a);
      const pid = prevLevelId(id), pe = pid && levels[pid];
      const pdef = pid && levelById(pid);
      res.run = {
        next: res.pass && ndef ? { id: nid, title: ndef.title, short: ndef.short, label: `${RUN_CARD.continueTo} ${inText(ndef)}` } : null,
        last: !nid,
        replays: starts.map((d) => ({ id, day: d, label: starts.length > 1 ? `${RUN_CARD.replay} ${inText(def)} ${RUN_CARD.fromDay(d)}` : `${RUN_CARD.replay} ${inText(def)}` })),
        previous: pid && pe ? { id: pid, day: Math.max(...(pe.starts.length ? pe.starts : [pdef.startDay])), title: pdef.title, short: pdef.short,
          label: `${RUN_CARD.replay} ${inText(pdef)} ${RUN_CARD.fromDay(Math.max(...(pe.starts.length ? pe.starts : [pdef.startDay])))}`, carried: [...(e.carried || [])] } : null,
        summary: res.pass && !nid ? summary : null,
      };
      return res;
    },
  };
  level.attachRun(api);

  /** The ideal farmer from the brooding week to the start of level `id` (PHASE3.md §2.2). His skill
   *  points are not the player's: the profile is put back afterwards. */
  function standardStart(id, s) {
    const target = levelById(id);
    const snap = level.profile?.snapshot?.();
    startedAt = id; standard = true;   // the levels before it are the ideal farmer's (saved with every start of the trace)
    // the player's own entries of the levels before (attempts, keys): the ideal farmer's play does not replace them
    const before = Object.fromEntries(RUN_ORDER.slice(0, Math.max(0, RUN_ORDER.indexOf(id))).filter((k) => levels[k]).map((k) => [k, clone(levels[k])]));
    try {
      level.start({ seed: s, run: true, condition: runCond });
      started(LEVEL1);
      let cur = LEVEL1;
      while (cur.id !== target.id) {
        level.debug.goto(cur.endDay, 21, { auto: true });
        if (!level.result) level.debug.goto(cur.endDay + 1, 6.05, { auto: false });
        if (!level.result?.pass) return false; // the ideal did not pass (its result screen shows why)
        if (!run.next()) return false;
        cur = levelById(levelId);
      }
      // a new flock from here: the later levels of the abandoned one and their saved starts are gone
      clearStarts(nextLevelId(id));
      for (const [k, v] of Object.entries(before)) levels[k] = { ...v, starts: [...new Set([...(v.starts || []), ...(levels[k]?.starts || [])])].sort((a, b) => a - b) };
      saveRun();
      return true;
    } finally { if (snap) level.profile.restore(snap); }
  }

  /** A new run (Start a new flock, or a level row's condition other than the run's): the old run and its starts go;
   *  the last cycles (lastCycle, lastNormal) and the skill profile stay. */
  function newRun({ seed: sd, condition: c, at }) {
    seed = sd ?? seed ?? 1; plan = null; summary = null; conditions = []; levelId = null;
    runCond = condition = validCond(c); startedAt = at; standard = false; mixed = false; counted = false;
    clearStarts(RUN_ORDER[0]);
    for (const k of Object.keys(levels)) delete levels[k];
    emit({ phase: 'start', level: at, condition: runCond });
  }
  /** The harder flocks open after the first full cycle (skill profile cyclesDone; a Phase 3 profile without it: 1 if a
   *  finished cycle is stored). */
  let storedCycle;                  // a finished cycle in the stored run save (read once: the save is large)
  function cyclesDone() {
    const v = level.profile?.cycles?.()?.cyclesDone;
    if (Number.isFinite(v) && v > 0) return v;   // the skill profile's count (0 in a profile that never counted: a Phase 3 one)
    if (lastCycle) return 1;
    if (storedCycle === undefined) { try { storedCycle = !!store.load?.()?.run?.lastCycle; } catch { storedCycle = false; } }
    return storedCycle ? 1 : 0;
  }
  const run = {
    stub: false,
    store,
    get available() { return !!store.available; },
    state() {
      return { levelId, seed, plan: clone(plan), levels: clone(levels), summary: clone(summary), conditions: [...conditions], condition: mirror(), lastCycle: clone(lastCycle),
        runCondition: runCond, startedAt, lastNormal: clone(lastNormal), cyclesDone: cyclesDone(), conditionsDone: { ...(level.profile?.cycles?.()?.conditionsDone || {}) }, harderOpen: cyclesDone() >= 1 };
    },
    startRun(opts = {}) {
      const at = opts.at && levelById(opts.at) ? opts.at : PLAN_LEVEL.id;
      newRun({ seed: opts.seed ?? 1, condition: opts.condition, at });
      return run.startLevel(at, { seed, from: 'standard', condition: runCond });
    },
    /**
     * Start one level of the run: its saved start, else a standard start. A `condition` other than the run's
     * (PHASE4.md §3.1) starts a new run under it from this level (the levels before: the condition ideal's standard start).
     */
    startLevel(id = LEVEL1.id, opts = {}) {
      seed = opts.seed ?? seed;
      const def = levelById(id);
      if (!def) throw new Error(`unknown level ${id}`);
      if ('condition' in opts && validCond(opts.condition) !== runCond) newRun({ seed, condition: opts.condition, at: id });
      if (def.id === PLAN_LEVEL.id) { startedAt = id; standard = false; level.start({ def: PLAN_LEVEL, seed, run: true, condition: runCond }); return started(def); }
      if (def.id === LEVEL1.id) { if (!startedAt || before(id, startedAt) || !plan) { startedAt = id; standard = false; } level.start({ seed, run: true, condition: runCond }); return started(def); }
      if (opts.from !== 'standard' && run.replay(id, { day: opts.day })) return true;
      return standardStart(id, seed);
    },
    next() {
      const nid = levelId && nextLevelId(levelId);
      if (!nid) return false;
      const ndef = levelById(nid);
      // a fresh farm and flock after the plan (the plan and the condition stay in the run)
      if (levelId === PLAN_LEVEL.id) level.start({ seed, run: true, condition: farm?.condition ?? runCond });
      else if (!level.enter(ndef, { run: true })) return false;
      return started(ndef);
    },
    /** Back to a level's saved start (the latest, or the one of `day`). False when none is saved. */
    replay(id, { day } = {}) {
      const def = levelById(id);
      if (!def) return false;
      const attempts = Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.attempts]));
      if (def.id === PLAN_LEVEL.id || def.id === LEVEL1.id) {
        clearStarts(nextLevelId(id));
        if (def.id === PLAN_LEVEL.id) plan = null;
        return run.startLevel(id, { seed });
      }
      const s = loadStart(id, day);
      if (!s) return false;
      if (!level.resume(s.blob)) return false;   // the farm comes back with the condition it was saved under
      const keep = { counted, lastNormal: clone(lastNormal), lastCycle: clone(lastCycle) };
      adopt(s.run);                       // the run as it was at that start
      counted = counted || keep.counted; lastNormal = lastNormal ?? keep.lastNormal; lastCycle = lastCycle ?? keep.lastCycle;
      // the farmer plays from here: a level before the one the run was started at is his now
      if (!startedAt || before(id, startedAt)) startedAt = id;
      for (const [k, n] of Object.entries(attempts)) if (levels[k]) levels[k].attempts = Math.max(levels[k].attempts, n);
      clearStarts(nextLevelId(id));       // later levels and their starts are gone
      // this level's starts after the one restored are gone too (weeks 4-5 from day 22: the day 29 start)
      const e = entry(id);
      for (const d of def.starts) if (d > s.day) { mem.delete(startKey(id, d)); store.clearStart?.(id, d); }
      e.starts = [...new Set([...e.starts, s.day])].filter((d) => d <= s.day).sort((a, b) => a - b);
      return started(def, { restored: true });
    },
    continueSave() {
      const d = memRun || store.load();
      if (d?.blob && level.resume(d.blob)) { adopt(d.run); return true; }
      // a Phase 2 save (chickenFarm.level1.v1) continues as a run at the brooding week, with no plan
      const p2 = save?.load?.() ?? store.migratePhase2()?.blob;
      if (!p2 || !level.resume(p2)) return false;
      level.joinRun();
      plan = null; summary = null; seed = p2.level?.seed ?? 1;
      for (const k of Object.keys(levels)) delete levels[k];
      levelId = LEVEL1.id;
      const e = entry(LEVEL1.id); e.attempts = 1; e.starts = [LEVEL1.startDay];
      emit({ phase: 'level-start', level: LEVEL1.id });
      saveRun();
      save?.clear?.();                     // the run key replaces it
      return true;
    },
    info() {
      const d = memRun || store.load();
      const e = d?.blob?.env;
      if (e && typeof e.day === 'number') {
        const hour = e.hour ?? 0, id = d.blob.level?.levelId ?? d.run?.levelId;
        const c = validCond(d.run?.condition);
        return { levelId: id, title: levelById(id)?.title ?? '', short: levelById(id)?.short ?? '', day: Math.round(e.day - hour / 24), hour, savedAt: d.savedAt, run: true,
          condition: c, conditionLabel: c ? conditionLabel(c) : null };
      }
      const p = save?.info?.();
      return p ? { ...p, levelId: LEVEL1.id, title: LEVEL1.title, short: LEVEL1.short, run: false } : null;
    },
    /** One row per level for the run card (PHASE3.md §1). */
    card() {
      return LEVELS.map((def) => {
        const e = levels[def.id];
        const state = !e ? 'not reached' : def.id === levelId && e.state === 'reached' ? 'playing' : e.state === 'passed' ? 'passed' : e.state === 'failed' ? 'not passed' : 'reached';
        return { id: def.id, n: def.n, title: def.title, short: def.short, days: RUN_CARD.days(def), target: RUN_CARD.target[def.id] || '', state,
          key: e?.key ?? null, keyText: e && e.state !== 'reached' ? keyText(def.id, e.key) : '', starts: e ? [...e.starts] : [], attempts: e?.attempts ?? 0,
          canReplay: !!e,
          // Phase 4: the saved starts replay under the run's condition; a standard start may take another (a new run)
          condition: mirror(), conditionLabel: mirror() ? conditionLabel(mirror()) : null, fromStandard: !!e && fromStandardIds().includes(def.id) };
      });
    },
    /** A whole cycle passed in this run. */
    get cycleDone() { return levels.cleanout?.state === 'passed'; },
    /** Harder flocks (PHASE4.md §1.2): open after the first full cycle (the skill profile's cyclesDone). */
    get harderOpen() { return cyclesDone() >= 1; },
    cyclesDone,
    /** The run's condition (farm.condition while a level is on the farm; the save's mirror otherwise). */
    get condition() { return mirror(); },
    /** The four conditions for the run card, the summary and __game.conditions(): open once a cycle is done and where
     *  the build switch (CONDITIONS[id].available) is on; done = runs finished under it (conditionsDone). */
    conditionsAvailable() {
      const open = cyclesDone() >= 1, done = level.profile?.cycles?.()?.conditionsDone || {};
      return CONDITION_IDS.map((id) => { const c = CONDITIONS[id]; return { id, label: c.label, months: c.months, summary: c.summary, available: !!c.available, open, canStart: open && !!c.available, done: done[id] ?? 0 }; });
    },
    /** Is a start of this level saved (memory or storage)? */
    hasStart: (id, day) => !!loadStart(id, day),
    /** The saved start record { version, levelId, day, savedAt, run, blob } (tests, harness). */
    debugStart: (id, day) => loadStart(id, day),
    serialize,
    restore: adopt,
  };
  return run;
}
