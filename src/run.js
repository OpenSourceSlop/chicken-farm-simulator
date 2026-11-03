// The run: seven levels on one flock, from the plan to the rested house (PHASE3.md §2, §10, §11).
// Owner: package "run". level.js plays one level at a time; the run chains them, saves the level
// starts, replays a level (or the one before it) from its saved start, and makes standard starts.
//
// createRun({ level, save, events, farm, env, records }) -> run
//   stub                  false
//   state()               { levelId, seed, plan, levels: { [id]: { state, key, attempts, starts, carried } },
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
// Events: EV.RUN { phase: 'start' | 'level-start' | 'level-end' | 'cycle-end', level, pass? }.
//
// Saves (config RUN_SAVE): the run key { version 3, savedAt, run, blob } at the level's autosave moments
// and at each level start and end; the level starts `<startPrefix><id>[.<day>]` (weeks 4-5: .22 and .29).
// The store is save.js createRunStore() (package "sim") when it exists, else the local one below with
// the same contract; every start is also kept in memory (node, storage blocked: replays still work).
import { LEVEL1, LEVELS, PLAN_LEVEL, RUN_SAVE, SAVE, CONDITIONS, levelById, weightAt } from './config.js';
import { EV } from './events.js';
import * as saveModule from './save.js';
import { RUN_CARD } from './content.js';
import { cycleSummary as cycleSummaryOf } from './records-cycle.js';
import { int, one, two } from './ui-format.js';

const H = 1 / 24;
const RUN_STORE_FN = 'createRunStore';
export const RUN_ORDER = LEVELS.map((l) => l.id);
export const nextLevelId = (id) => RUN_ORDER[RUN_ORDER.indexOf(id) + 1] ?? null;
export const prevLevelId = (id) => { const i = RUN_ORDER.indexOf(id); return i > 0 ? RUN_ORDER[i - 1] : null; };
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
/** A level's short name inside a sentence: "the brooding week", "Week 2", "Plan the farm". */
const inText = (def) => (def?.short || '').replace(/^The /, 'the ');
const startKey = (id, day, def = levelById(id)) => `${RUN_SAVE.startPrefix}${id}${def && def.starts.length > 1 ? `.${day}` : ''}`;

function storage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.setItem('__cf_probe__', '1'); s.removeItem('__cf_probe__');
    return s;
  } catch { return null; }
}

/** The run store of PHASE3.md §11 over localStorage (every access in try/catch), used while save.js has
 *  no createRunStore: { available, load(), save(run, blob), loadStart(id, day?), saveStart(id, day, run,
 *  blob), clearStarts(fromId), info(), migratePhase2() }. A failed write (quota) deletes the oldest level
 *  start that is not the one being written and tries again. */
export function createLocalRunStore() {
  const read = (k) => { try { const raw = storage()?.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const remove = (k) => { try { storage()?.removeItem(k); } catch { /* ignore */ } };
  const startKeys = () => { const s = storage(); const out = []; try { for (let i = 0; s && i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(RUN_SAVE.startPrefix)) out.push(k); } } catch { /* ignore */ } return out; };
  function write(k, v) {
    const s = storage();
    if (!s) return false;
    const text = JSON.stringify(v);
    for (let tries = 0; tries < 8; tries++) {
      try { s.setItem(k, text); return true; } catch {
        // quota: drop the oldest level start (not this one) and try again
        const old = startKeys().filter((x) => x !== k).map((x) => ({ x, t: read(x)?.savedAt ?? 0 })).sort((a, b) => a.t - b.t)[0];
        if (!old) return false;
        remove(old.x);
      }
    }
    return false;
  }
  return {
    get available() { return !!storage(); },
    load() { const d = read(RUN_SAVE.key); return d && d.version === RUN_SAVE.version ? d : null; },
    save(run, blob) { return write(RUN_SAVE.key, { version: RUN_SAVE.version, savedAt: Date.now(), run, blob }); },
    loadStart(id, day) {
      const def = levelById(id);
      const days = day != null ? [day] : [...(def?.starts || [])].reverse();
      for (const d of days) { const s = read(startKey(id, d, def)); if (s && s.version === RUN_SAVE.version && s.levelId === id) return s; }
      return null;
    },
    saveStart(id, day, run, blob) { return write(startKey(id, day), { version: RUN_SAVE.version, levelId: id, day, savedAt: Date.now(), run, blob }); },
    /** Delete the starts of level `fromId` and every later level. */
    clearStarts(fromId) {
      const from = fromId == null ? 0 : RUN_ORDER.indexOf(fromId);
      if (from < 0) return;
      for (const id of RUN_ORDER.slice(from)) for (const d of levelById(id).starts) remove(startKey(id, d));
    },
    clear() { remove(RUN_SAVE.key); },
    info() {
      const d = this.load();
      const e = d?.blob?.env;
      if (!e || typeof e.day !== 'number') return null;
      const hour = e.hour ?? 0;
      return { levelId: d.blob.level?.levelId ?? d.run?.levelId ?? null, day: Math.round(e.day - hour / 24), hour, savedAt: d.savedAt };
    },
    /** The Phase 2 save (chickenFarm.level1.v1), read once: its blob, or null. */
    migratePhase2() { const d = read(SAVE.key); return d && d.version === SAVE.version ? d : null; },
  };
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

/** What the model carries from the previous level into this one, as plain record lines (PHASE3.md §10). */
function carriedLines({ def, farm, levels }) {
  const out = [];
  const prev = prevLevelId(def.id), prevDef = prev && levelById(prev);
  if (!prevDef || def === LEVEL1 || def === PLAN_LEVEL) return out;
  const v = farm.health?.vaccine;
  const vDay = v?.startAt ?? v?.mixedAt ?? v?.thirstFrom;
  if (v && v.hours != null && v.hours > 2.5 && vDay != null && Math.floor(vDay) >= prevDef.startDay && Math.floor(vDay) <= prevDef.endDay) out.push(`vaccine drunk in ${one(v.hours)} h on day ${Math.floor(vDay)}`);
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
  let conditions = [];
  const levels = {};
  const mem = new Map();            // level starts in memory: key -> { version, levelId, day, savedAt, run, blob }
  let memRun = null;                // the run save in memory (node, storage blocked)
  // save.js createRunStore (package "sim") when it exists: looked up by name, so the build is the same before and after it lands
  const makeStore = saveModule[RUN_STORE_FN];
  const store = typeof makeStore === 'function' ? makeStore() : createLocalRunStore();
  const emit = (p) => events?.emit(EV.RUN, p);
  const entry = (id) => levels[id] || (levels[id] = { state: 'reached', key: null, attempts: 0, starts: [], carried: [] });

  function serialize() { return { v: 1, seed, levelId, plan: clone(plan), levels: clone(levels), summary: clone(summary), conditions: [...conditions] }; }
  function adopt(d) {
    if (!d) return;
    seed = d.seed ?? 1; levelId = d.levelId ?? null; plan = clone(d.plan) ?? null; summary = clone(d.summary) ?? null; conditions = [...(d.conditions || [])];
    for (const k of Object.keys(levels)) delete levels[k];
    Object.assign(levels, clone(d.levels) || {});
  }
  function saveRun(blob = level.saveBlob()) {
    const d = { version: RUN_SAVE.version, savedAt: Date.now(), run: serialize(), blob };
    memRun = clone(d);
    return store.save(d.run, blob);
  }
  function saveStart(id, day) {
    const e = entry(id);
    if (!e.starts.includes(day)) e.starts.push(day);
    e.starts.sort((a, b) => a - b);
    const r = serialize(), blob = level.saveBlob();
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
    const e = entry(def.id);
    e.state = 'reached'; e.attempts++; e.key = null;
    if (!restored) e.carried = carriedLines({ def, farm, levels });
    emit({ phase: 'level-start', level: def.id });
    if (!restored) saveStart(def.id, def.startDay);
    saveRun();
    return true;
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
      emit({ phase: 'level-end', level: id, pass: !!res.pass });
      if (res.pass && !nextLevelId(id)) {
        summary = (typeof records?.cycleSummary === 'function' ? records.cycleSummary({ plan, levels: clone(levels) }) : cycleSummaryOf(records, farm, { plan, levels: clone(levels) })) ?? null;
        emit({ phase: 'cycle-end', level: id, pass: true });
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
    try {
      level.start({ seed: s, run: true });
      started(LEVEL1);
      let cur = LEVEL1;
      while (cur.id !== target.id) {
        level.debug.goto(cur.endDay, 21, { auto: true });
        if (!level.result) level.debug.goto(cur.endDay + 1, 6.05, { auto: false });
        if (!level.result?.pass) return false; // the ideal did not pass (its result screen shows why)
        if (!run.next()) return false;
        cur = levelById(levelId);
      }
      return true;
    } finally { if (snap) level.profile.restore(snap); }
  }

  const run = {
    stub: false,
    store,
    get available() { return !!store.available; },
    state() { return { levelId, seed, plan: clone(plan), levels: clone(levels), summary: clone(summary), conditions: [...conditions] }; },
    startRun(opts = {}) {
      seed = opts.seed ?? 1; plan = null; summary = null; conditions = []; levelId = null;
      clearStarts(RUN_ORDER[0]);
      for (const k of Object.keys(levels)) delete levels[k];
      const at = opts.at && levelById(opts.at) ? opts.at : PLAN_LEVEL.id;
      emit({ phase: 'start', level: at });
      return run.startLevel(at, { seed, from: 'standard' });
    },
    startLevel(id = LEVEL1.id, opts = {}) {
      seed = opts.seed ?? seed;
      const def = levelById(id);
      if (!def) throw new Error(`unknown level ${id}`);
      if (def === PLAN_LEVEL) { level.start({ def: PLAN_LEVEL, seed, run: true }); return started(def); }
      if (def === LEVEL1) { level.start({ seed, run: true }); return started(def); }
      if (opts.from !== 'standard' && run.replay(id, { day: opts.day })) return true;
      return standardStart(id, seed);
    },
    next() {
      const nid = levelId && nextLevelId(levelId);
      if (!nid) return false;
      const ndef = levelById(nid);
      if (levelId === PLAN_LEVEL.id) level.start({ seed, run: true });   // a fresh farm and flock; the plan stays in the run
      else if (!level.enter(ndef, { run: true })) return false;
      return started(ndef);
    },
    /** Back to a level's saved start (the latest, or the one of `day`). False when none is saved. */
    replay(id, { day } = {}) {
      const def = levelById(id);
      if (!def) return false;
      const attempts = Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.attempts]));
      if (def === PLAN_LEVEL || def === LEVEL1) {
        clearStarts(nextLevelId(id));
        if (def === PLAN_LEVEL) plan = null;
        return run.startLevel(id, { seed });
      }
      const s = loadStart(id, day);
      if (!s) return false;
      if (!level.resume(s.blob)) return false;
      adopt(s.run);                       // the run as it was at that start
      for (const [k, n] of Object.entries(attempts)) if (levels[k]) levels[k].attempts = Math.max(levels[k].attempts, n);
      clearStarts(nextLevelId(id));       // later levels and their starts are gone
      // this level's starts after the one restored are gone too (weeks 4-5 from day 22: the day 29 start)
      const e = entry(id);
      for (const d of def.starts) if (d > s.day) mem.delete(startKey(id, d));
      e.starts = [...new Set([...e.starts, s.day])].filter((d) => d <= s.day).sort((a, b) => a - b);
      return started(def, { restored: true });
    },
    continueSave() {
      const d = memRun || store.load();
      if (d?.blob && level.resume(d.blob)) { adopt(d.run); return true; }
      // a Phase 2 save (chickenFarm.level1.v1) continues as a run at the brooding week, with no plan
      const p2 = save?.load?.() ?? store.migratePhase2?.();
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
        return { levelId: id, title: levelById(id)?.title ?? '', short: levelById(id)?.short ?? '', day: Math.round(e.day - hour / 24), hour, savedAt: d.savedAt, run: true };
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
          canReplay: !!e };
      });
    },
    /** A whole cycle passed: the harder conditions come in Phase 4 (shown, nothing to click). */
    get cycleDone() { return levels.cleanout?.state === 'passed'; },
    conditionsAvailable: () => Object.entries(CONDITIONS).map(([id, c]) => ({ id, ...c })),
    /** Is a start of this level saved (memory or storage)? */
    hasStart: (id, day) => !!loadStart(id, day),
    /** The saved start record { version, levelId, day, savedAt, run, blob } (tests, harness). */
    debugStart: (id, day) => loadStart(id, day),
    serialize,
    restore: adopt,
  };
  return run;
}
