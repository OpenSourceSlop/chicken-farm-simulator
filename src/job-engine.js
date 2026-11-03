// Job engine: turns the job definitions of content-jobs.js into one instance per day, opens and
// closes them by their windows, and marks them done by their rules. No DOM, no three.js: it runs
// in node (scripts/test-jobs.mjs) exactly as in the game. Owner: package "level" (phase2/level).
// PHASE2.md §3.1–§3.2.
//
// createJobEngine({ events, env, farm, props, records, jobs = JOBS }) -> engine
//   start(day)        fresh instances for `day` (the prep day at level start); forgets everything else
//   restore(d)        from serialize()
//   tick()            windows, midnight (next day's instances), state rules; level.update calls it
//                     twice a second, node tests call it directly. Event rules run on the bus at once.
//   list()            every instance (all days so far), in creation order
//   open()            the open instances in card order (pinned, problems, before-the-truck, the rest)
//   current()         the instance the marker points at (setCurrent / cycle choose it)
//   byKey(key), complete(key, result?) (debug / goto auto), serialize(), finish() (level end:
//   every job not done becomes missed), nextOpening(after) (env.day of the next job opening, for
//   "Next job" skips), anchors { truck, placed } (env.day floats, null until they happen)
//
// Instance: { key: 'r-meter@3', id, def, day, status: 'waiting'|'open'|'done'|'missed', opensAt,
//   closesAt, doneAt, progress (0..1), result, st (rule state, JSON) }   times as env.day floats.
// Only events while an instance is open count. Completion never looks at the value: the result
// is what was measured or set, written to records.logJob(key, day, result).
import { BROOD_BOUNDS, DRINKER_LINES_Z, FLOOR_GRID, LEVEL1, broodSector } from './config.js';
import { EV, matchPayload } from './events.js';
import { JOBS } from './content-jobs.js';

const H = 1 / 24;
/** The level ends at 06:00 on day 8 at the latest (PHASE2.md §10). */
export const LEVEL_END_DAY = LEVEL1.endDay + 1 + 6 * H;
export const TRUCK_AT = LEVEL1.arrivalDay + LEVEL1.arrivalHour * H;
const EPS = 1e-7;

// The 300 brooding cells: FLOOR_GRID cells whose centre lies inside BROOD_BOUNDS.
export const BROOD_CELLS = (() => {
  const out = [];
  for (let cz = 0; cz < FLOOR_GRID.nz; cz++) {
    for (let cx = 0; cx < FLOOR_GRID.nx; cx++) {
      const x = FLOOR_GRID.x0 + (cx + 0.5) * FLOOR_GRID.cell, z = FLOOR_GRID.z0 + (cz + 0.5) * FLOOR_GRID.cell;
      if (x >= BROOD_BOUNDS.xMin && x <= BROOD_BOUNDS.xMax && z >= BROOD_BOUNDS.zMin && z <= BROOD_BOUNDS.zMax) out.push([x, z]);
    }
  }
  return out;
})();

const nearDrinkerLine = (z) => DRINKER_LINES_Z.some((lz) => Math.abs(z - lz) <= 1);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Does the job exist on calendar day `day`? */
export function jobOnDay(def, day) {
  if (def.kind === 'problem') return false;
  if (def.kind === 'dated') return def.day === day;
  const [a, b] = def.days || [def.day, def.day];
  return day >= a && day <= b;
}

/** [fromHour, toHour] of a non-relative job on its day, or null ('rel' jobs, problems without a window). */
export function windowHours(def) {
  if (def.window) return def.window;
  if (def.round === 'rel' || !def.round) return null;
  const r = LEVEL1.rounds[def.round];
  return r ? [r.from, r.to] : null;
}

// ---------------- rules ----------------
function initState(rule) {
  switch (rule.type) {
    case 'each': return { seen: {} };
    case 'count': return { list: [] };
    case 'coverage': return { cells: [], listened: false };
    case 'state': return { met: false, since: null, value: null };
    case 'all': case 'any': return { parts: rule.of.map(initState), met: rule.of.map(() => false) };
    default: return { met: false, payload: null };
  }
}

function countMet(rule, st) {
  const n = st.list.length;
  const sectors = new Set(st.list.map((r) => r.s)).size;
  const near = st.list.filter((r) => r.near).length;
  return n >= rule.n && sectors >= (rule.sectors || 0) && near >= (rule.nearDrinker || 0);
}
function countProgress(rule, st) {
  const parts = [Math.min(1, st.list.length / rule.n)];
  if (rule.sectors) parts.push(Math.min(1, new Set(st.list.map((r) => r.s)).size / rule.sectors));
  if (rule.nearDrinker) parts.push(Math.min(1, st.list.filter((r) => r.near).length / rule.nearDrinker));
  return Math.min(...parts) * 0.3 + (parts.reduce((a, b) => a + b, 0) / parts.length) * 0.7;
}
const coverageShare = (st) => st.cells.length / BROOD_CELLS.length;

/** Rule met right now (after the events so far)? */
function ruleMet(rule, st) {
  switch (rule.type) {
    case 'each': return rule.values.every((v) => String(v) in st.seen);
    case 'count': return countMet(rule, st);
    case 'coverage': return coverageShare(st) >= rule.frac - EPS && (!rule.listen || st.listened);
    case 'all': return st.met.every(Boolean);
    case 'any': return st.met.some(Boolean);
    default: return !!st.met;
  }
}

/** 0..1 for the job bar. */
function ruleProgress(rule, st, ctx) {
  switch (rule.type) {
    case 'each': return rule.values.filter((v) => String(v) in st.seen).length / rule.values.length;
    case 'count': return countProgress(rule, st);
    case 'coverage': {
      const c = Math.min(1, coverageShare(st) / rule.frac);
      return rule.listen ? c * 0.85 + (st.listened ? 0.15 : 0) : c;
    }
    case 'state': return st.met ? 1 : stateProgress(rule.test, ctx);
    case 'all': return rule.of.reduce((a, r, i) => a + (st.met[i] ? 1 : ruleProgress(r, st.parts[i], ctx)), 0) / rule.of.length;
    case 'any': return Math.max(...rule.of.map((r, i) => (st.met[i] ? 1 : ruleProgress(r, st.parts[i], ctx))));
    default: return st.met ? 1 : 0;
  }
}

/** Feed one bus event to a rule. Returns true if the rule's state changed. */
function ruleEvent(rule, st, type, p, inst) {
  switch (rule.type) {
    case 'event':
      if (st.met || type !== rule.event || !matchPayload(p, rule.match)) return false;
      if (rule.sameDay && p.day !== inst.day) return false;
      st.met = true; st.payload = slim(p); return true;
    case 'action':
      if (st.met || type !== EV.ACTION || p.id !== rule.id || !matchPayload(p, rule.match)) return false;
      st.met = true; st.payload = slim(p); return true;
    case 'each':
      if (type !== EV.ACTION || p.id !== rule.id || !matchPayload(p, rule.match)) return false;
      if (!rule.values.some((v) => v === p[rule.key])) return false;
      st.seen[String(p[rule.key])] = p.result ?? true; return true;
    case 'count': {
      if (type !== EV.ACTION || p.id !== rule.id || !matchPayload(p, rule.match)) return false;
      const x = Number(p.x), z = Number(p.z);
      const ok = Number.isFinite(x) && Number.isFinite(z);
      st.list.push({ x: ok ? x : null, z: ok ? z : null, s: ok ? broodSector(x, z) : -1, near: ok && nearDrinkerLine(z), r: p.result ?? null });
      return true;
    }
    case 'coverage': {
      if (type === EV.LISTEN) { if (st.listened) return false; st.listened = true; return true; }
      if (type !== EV.CELL) return false;
      let x = Number(p.x), z = Number(p.z);
      if (!Number.isFinite(x) && Number.isFinite(p.cx)) { x = FLOOR_GRID.x0 + (p.cx + 0.5) * FLOOR_GRID.cell; z = FLOOR_GRID.z0 + (p.cz + 0.5) * FLOOR_GRID.cell; }
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      const r2 = (rule.sight ?? 2) ** 2;
      let changed = false;
      const have = new Set(st.cells);
      for (let i = 0; i < BROOD_CELLS.length; i++) {
        const [cx, cz] = BROOD_CELLS[i];
        if (!have.has(i) && (cx - x) ** 2 + (cz - z) ** 2 <= r2 + EPS) { st.cells.push(i); have.add(i); changed = true; }
      }
      return changed;
    }
    case 'all': case 'any': {
      let changed = false;
      rule.of.forEach((r, i) => {
        if (st.met[i]) return; // parts latch once met
        if (ruleEvent(r, st.parts[i], type, p, inst)) { changed = true; if (ruleMet(r, st.parts[i])) st.met[i] = true; }
      });
      return changed;
    }
    default: return false;
  }
}

/** State rules: evaluated on every tick. Returns true if something changed. */
function ruleTick(rule, st, ctx) {
  if (rule.type === 'state') {
    if (st.met) return false;
    const v = stateTest(rule.test, st, ctx);
    if (v) { st.met = true; st.value = stateSnapshot(rule.test, ctx); return true; }
    return false;
  }
  if (rule.type === 'all' || rule.type === 'any') {
    let changed = false;
    rule.of.forEach((r, i) => { if (!st.met[i] && ruleTick(r, st.parts[i], ctx)) { changed = true; if (ruleMet(r, st.parts[i])) st.met[i] = true; } });
    return changed;
  }
  return false;
}

// Payloads go into the save: keep them small (no record rows, no functions).
function slim(p) {
  if (!p || typeof p !== 'object') return p ?? null;
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'row' || typeof v === 'function') continue;
    out[k] = v;
  }
  return out;
}

// ---------------- state predicates (content-jobs.js STATE_TEST_IDS) ----------------
function stateTest(test, st, { env, farm, props }) {
  switch (test) {
    case 'preheat-on': return env.heaterSetpoint >= 30 && !!env.heatersOn;
    case 'litter-covered': return (farm.litter?.cover ?? 0) >= 0.95;
    case 'pans-flooded': return farm.feed.lines.every((l) => l.flood && l.panFill >= 0.95);
    case 'lines-flushed': return farm.water.lines.every((l) => l.flushClear >= 0.99);
    case 'all-placed': return farm.flock.inBoxes === 0 && farm.flock.placed > 0;
    case 'dead-cleared': return farm.flock.deadOnFloor === 0 && props?.carrying !== 'bucket';
    case 'house-near-target': {
      // the air the chicks feel (house air less the wind chill of the fans) at or below target
      // + 1.5 °C for 30 game minutes in a row
      if (env.houseTemp - (env.windChill || 0) <= env.targetTemp + 1.5) { if (st.since == null) st.since = env.day; }
      else st.since = null;
      return st.since != null && env.day - st.since >= 30 / 1440 - EPS;
    }
    default: return false;
  }
}
function stateProgress(test, { env, farm }) {
  switch (test) {
    case 'litter-covered': return clamp01((farm.litter?.cover ?? 0) / 0.95);
    case 'pans-flooded': return farm.feed.lines.filter((l) => l.flood && l.panFill >= 0.95).length / farm.feed.lines.length;
    case 'lines-flushed': return farm.water.lines.reduce((a, l) => a + clamp01(l.flushClear), 0) / farm.water.lines.length;
    case 'all-placed': { const d = farm.flock.delivered || LEVEL1.chicksPlaced; return clamp01(farm.flock.placed / d); }
    case 'preheat-on': return env.heaterSetpoint >= 30 ? 0.5 : 0;
    default: return 0;
  }
}
// What the job's result records for a state rule: the measured state when it was met.
function stateSnapshot(test, { env, farm }) {
  switch (test) {
    case 'preheat-on': return { setpoint: env.heaterSetpoint, at: env.day };
    case 'litter-covered': return { cover: farm.litter.cover, depthCm: farm.litter.depthCm };
    case 'pans-flooded': return { lines: farm.feed.lines.map((l) => ({ heightCm: l.heightCm, flood: l.flood })) };
    case 'lines-flushed': return { flushDoneAt: farm.stats?.flushDoneAt ?? env.day };
    case 'all-placed': return { placed: farm.flock.placed, firstTipAt: farm.stats?.firstTipAt ?? null, lastTipAt: farm.stats?.lastTipAt ?? env.day };
    case 'dead-cleared': return { at: env.day };
    case 'house-near-target': return { houseC: env.houseTemp, targetC: env.targetTemp };
    default: return null;
  }
}

// The result written to the record: what was measured or set while doing the job, never a verdict.
function ruleResult(rule, st) {
  switch (rule.type) {
    case 'event': case 'action': return st.payload;
    case 'each': return { ...st.seen };
    case 'count': {
      // the samples themselves are in the notebook: the record keeps how many, where, and the values
      const one = (r) => (r && typeof r === 'object' && Object.keys(r).length === 1 ? Object.values(r)[0] : r);
      return { n: st.list.length, sectors: [...new Set(st.list.map((r) => r.s))], values: st.list.map((r) => one(r.r)) };
    }
    case 'coverage': return { seenPct: Math.round(coverageShare(st) * 100), listened: st.listened };
    case 'state': return st.value;
    case 'all': case 'any': return rule.of.map((r, i) => (st.met[i] ? ruleResult(r, st.parts[i]) : null));
    default: return null;
  }
}

// ---------------- the engine ----------------
export function createJobEngine({ events, env, farm, props, records, jobs = JOBS } = {}) {
  /** @type {any[]} */
  let list = [];
  const byKey = new Map();
  const anchors = { truck: null, placed: null };
  let lastDay = null;
  let currentKey = null;
  let started = false;
  const ctx = { env, farm, props };
  const emit = (t, p) => events && events.emit(t, p);
  const order = jobs.map((j) => j.id);
  const rank = (inst) => order.indexOf(inst.id);

  function make(def, day, opensAt, closesAt) {
    const key = `${def.id}@${day}`;
    if (byKey.has(key)) return byKey.get(key);
    const inst = { key, id: def.id, def, day, status: 'waiting', opensAt, closesAt, doneAt: null, progress: 0, result: null, st: initState(def.done) };
    list.push(inst); byKey.set(key, inst);
    return inst;
  }

  function relTimes(def) {
    const a = anchors[def.rel.anchor];
    return a == null ? [null, null] : [a + def.rel.fromH * H, a + def.rel.toH * H];
  }

  function createDay(day) {
    for (const def of jobs) {
      if (!jobOnDay(def, day)) continue;
      if (def.round === 'rel') { const [o, c] = relTimes(def); make(def, day, o, c); continue; }
      const w = windowHours(def);
      let close = day + w[1] * H;
      if (def.closeOn === 'placed' && anchors.placed != null && anchors.placed < close) close = Math.max(day + w[0] * H, anchors.placed);
      make(def, day, day + w[0] * H, close);
    }
  }

  function setAnchor(name, t) {
    if (anchors[name] != null) return;
    anchors[name] = t;
    for (const inst of list) {
      const d = inst.def;
      if (d.round === 'rel' && d.rel.anchor === name && inst.opensAt == null) [inst.opensAt, inst.closesAt] = relTimes(d);
      if (name === 'placed' && d.closeOn === 'placed' && inst.status !== 'done' && inst.closesAt > t) inst.closesAt = Math.max(inst.opensAt ?? t, t);
    }
  }

  function openProblem(problemId) {
    const day = env.dayNumber;
    for (const def of jobs) {
      if (def.kind !== 'problem' || def.problem !== problemId) continue;
      if (list.some((i) => i.id === def.id)) continue; // one instance per problem and level
      const w = def.window;
      const opensAt = w ? Math.max(env.day, day + w[0] * H) : env.day;
      const closesAt = w ? day + w[1] * H : LEVEL_END_DAY;
      make(def, day, opensAt, Math.max(opensAt, closesAt));
    }
    windows();
  }

  function finishInst(inst, result) {
    inst.status = 'done';
    inst.doneAt = env.day;
    inst.progress = 1;
    inst.result = result === undefined ? ruleResult(inst.def.done, inst.st) : result;
    records?.logJob?.(inst.key, inst.day, inst.result);
    emit(EV.JOB_DONE, { id: inst.id, key: inst.key, result: inst.result });
    windows(); // a job that waits for this one ('after') can open now
  }

  const afterOk = (inst) => !inst.def.after || list.some((i) => i.id === inst.def.after && i.status === 'done');

  /** Open and close by the clock. A window that passed while waiting goes straight to missed. */
  function windows() {
    const now = env.day;
    for (const inst of list) {
      if (inst.status === 'waiting' && inst.opensAt != null) {
        if (inst.closesAt != null && now >= inst.closesAt - EPS) { inst.status = 'missed'; emit(EV.JOB_MISSED, { id: inst.id, key: inst.key }); continue; }
        if (now >= inst.opensAt - EPS && afterOk(inst)) { inst.status = 'open'; emit(EV.JOB_OPEN, { id: inst.id, key: inst.key }); }
      } else if (inst.status === 'open' && inst.closesAt != null && now >= inst.closesAt - EPS) {
        inst.status = 'missed'; emit(EV.JOB_MISSED, { id: inst.id, key: inst.key });
      }
    }
  }

  function midnight() {
    const d = env.dayNumber;
    if (lastDay == null) lastDay = d;
    while (lastDay < d) { lastDay++; if (lastDay <= LEVEL1.endDay) createDay(lastDay); }
  }

  function anchorsByClock() {
    // The farm announces the truck (stats.truckAt / EV.FARM_DELIVERY); with the contract stub, or if
    // nothing came within half an hour, it counts as there at 08:00 on day 0.
    if (anchors.truck == null && farm?.stats?.truckAt != null) setAnchor('truck', farm.stats.truckAt);
    const grace = farm && farm.stub === false ? 0.5 * H : 0;
    if (anchors.truck == null && env.day >= TRUCK_AT + grace - EPS) setAnchor('truck', TRUCK_AT);
    if (anchors.placed == null && farm?.stats?.firstTipAt != null) setAnchor('placed', farm.stats.firstTipAt);
  }

  function evalOpen(type, p) {
    for (const inst of list) {
      if (inst.status !== 'open') continue;
      if (ruleEvent(inst.def.done, inst.st, type, p, inst)) {
        inst.progress = ruleProgress(inst.def.done, inst.st, ctx);
        if (ruleMet(inst.def.done, inst.st)) finishInst(inst);
      }
    }
  }

  function onBus(p, type) {
    if (!started || type === EV.JOB_OPEN || type === EV.JOB_DONE || type === EV.JOB_MISSED || type === EV.LEVEL) return;
    p = p || {};
    // anchors first, so a relative job can open on the same event
    if (type === EV.FARM_DELIVERY && p.kind === 'chicks' && p.phase === 'arrive') setAnchor('truck', env.day);
    if (anchors.placed == null && (type === EV.FARM_PLACED || type === EV.BOX_TIP || (type === EV.ACTION && p.id === 'chicks.tip'))) {
      if (anchors.truck == null) setAnchor('truck', Math.min(env.day, TRUCK_AT));
      setAnchor('placed', env.day);
    }
    if (type === EV.FARM_PROBLEM && p.phase === 'symptom') openProblem(p.id);
    midnight();
    windows();
    evalOpen(type, p);
  }
  const off = events ? events.on('*', onBus) : () => {};

  function tick() {
    if (!started) return;
    midnight();
    anchorsByClock();
    windows();
    for (const inst of list) {
      if (inst.status !== 'open') continue;
      ruleTick(inst.def.done, inst.st, ctx);
      inst.progress = ruleProgress(inst.def.done, inst.st, ctx);
      if (ruleMet(inst.def.done, inst.st)) finishInst(inst);
    }
  }

  /** Open jobs in card groups (PHASE2.md §3.5): pinned anchor jobs, problem jobs ("new"), the
   *  day 0 "before the truck" group until the first tip, then the rest in list order. */
  function groups() {
    const open = list.filter((i) => i.status === 'open');
    const byRank = (a, b) => a.day - b.day || rank(a) - rank(b);
    const pinned = open.filter((i) => i.def.pin).sort(byRank);
    const problems = open.filter((i) => i.def.kind === 'problem' && !i.def.pin);
    const preTruck = env.dayNumber === 0 && anchors.placed == null ? open.filter((i) => i.def.preTruck && !i.def.pin) : [];
    const used = new Set([...pinned, ...problems, ...preTruck]);
    const rest = open.filter((i) => !used.has(i)).sort(byRank);
    return { pinned, problems, preTruck, rest };
  }
  function cardOrder() { const g = groups(); return [...g.pinned, ...g.problems, ...g.preTruck, ...g.rest]; }

  function current() {
    const ord = cardOrder();
    const c = currentKey && byKey.get(currentKey);
    if (c && c.status === 'open') return c;
    currentKey = ord[0]?.key ?? null;
    return ord[0] || null;
  }

  /** The env.day of the next moment a job opens after `after` (Next job skips land there). */
  function nextOpening(after = env.day) {
    let best = LEVEL_END_DAY;
    const take = (t) => { if (t != null && t > after + EPS && t < best) best = t; };
    for (const inst of list) if (inst.status === 'waiting' && afterOk(inst)) take(inst.opensAt);
    for (let d = Math.max(MIN_LIST_DAY, (lastDay ?? env.dayNumber) + 1); d <= LEVEL1.endDay; d++) {
      for (const def of jobs) { if (!jobOnDay(def, d)) continue; const w = windowHours(def); if (w) take(d + w[0] * H); }
    }
    if (anchors.truck == null) take(TRUCK_AT);
    return best;
  }

  const engine = {
    anchors,
    get started() { return started; },
    /** Fresh instances for `day` (level start: the prep day). */
    start(day = LEVEL1.startDay) {
      list = []; byKey.clear(); anchors.truck = anchors.placed = null; currentKey = null;
      lastDay = day; started = true;
      createDay(day);
      tick();
    },
    tick,
    list: () => list,
    open: cardOrder,
    groups,
    current,
    /** Point the marker at this job (Next job cycles through the card). */
    setCurrent(key) { if (byKey.get(key)?.status === 'open') currentKey = key; return current(); },
    /** The open job after the current one in card order (wraps), made current. */
    cycle() {
      const ord = cardOrder();
      if (!ord.length) return null;
      const i = ord.findIndex((x) => x.key === current()?.key);
      currentKey = ord[(i + 1) % ord.length].key;
      return current();
    },
    byKey: (key) => byKey.get(key) || null,
    /** Debug / goto(auto): mark an open (or waiting) job done now and log its result. */
    complete(key, result) {
      const inst = byKey.get(key);
      if (!inst || inst.status === 'done' || inst.status === 'missed') return false;
      finishInst(inst, result === undefined ? { auto: true } : result);
      return true;
    },
    /** Level end: every job still waiting or open is missed. */
    finish() {
      for (const inst of list) if (inst.status === 'open' || inst.status === 'waiting') { inst.status = 'missed'; emit(EV.JOB_MISSED, { id: inst.id, key: inst.key }); }
      started = false;
    },
    nextOpening,
    /** Is this rule (or job) satisfied right now? Exposed for tests. */
    stats() {
      const c = { waiting: 0, open: 0, done: 0, missed: 0 };
      for (const i of list) c[i.status]++;
      return c;
    },
    serialize() {
      // compact (the autosave stays small all week): id and day come from the key, times to ~1 s,
      // a closed job keeps its rule state only for sample counts (the card's tallies)
      const t = (v) => (v == null ? v : Math.round(v * 1e5) / 1e5);
      return { v: 1, lastDay, anchors: { ...anchors }, currentKey, started,
        list: list.map((i) => {
          // a closed job without rule state is a tuple [key, status, opensAt, closesAt, doneAt]
          if ((i.status === 'done' || i.status === 'missed') && i.def.done?.type !== 'count') return [i.key, i.status, t(i.opensAt), t(i.closesAt), t(i.doneAt)];
          const o = { key: i.key, status: i.status, opensAt: t(i.opensAt), closesAt: t(i.closesAt), doneAt: t(i.doneAt) };
          // a closed job's result is in records.logJob already; open ones keep their rule state
          // (count jobs keep it closed too: the card shows their tallies)
          if (i.status !== 'done') o.progress = Math.round(i.progress * 1000) / 1000;
          if (i.status === 'waiting' || i.status === 'open' || i.def.done?.type === 'count') o.st = i.st;
          return o;
        }) };
    },
    restore(d) {
      list = []; byKey.clear(); anchors.truck = anchors.placed = null; currentKey = null;
      if (!d) { started = false; return; }
      lastDay = d.lastDay; currentKey = d.currentKey ?? null; started = d.started !== false;
      Object.assign(anchors, d.anchors || {});
      for (const raw of d.list || []) {
        const s = Array.isArray(raw) ? { key: raw[0], status: raw[1], opensAt: raw[2], closesAt: raw[3], doneAt: raw[4] } : raw;
        const at = s.key.lastIndexOf('@'), id = s.id ?? s.key.slice(0, at), day = s.day ?? Number(s.key.slice(at + 1));
        const def = jobs.find((j) => j.id === id);
        if (!def) continue;
        const inst = { ...s, id, day, def, progress: s.progress ?? (s.status === 'done' ? 1 : 0), result: s.result ?? null, st: s.st || initState(def.done) };
        list.push(inst); byKey.set(inst.key, inst);
      }
    },
    dispose() { off(); started = false; },
  };
  return engine;
}

const MIN_LIST_DAY = LEVEL1.startDay;
