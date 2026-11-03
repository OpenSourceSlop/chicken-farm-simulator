// Job engine: turns the job definitions of content-jobs.js (and content-jobs-cycle.js) into one
// instance per day, opens and closes them by their windows, and marks them done by their rules. No
// DOM, no three.js: it runs in node (scripts/test-jobs.mjs) exactly as in the game. Owner: package
// "run" (Phase 2: "level"). PHASE2.md §3.1–§3.2, PHASE3.md §3.1.
//
// createJobEngine({ events, env, farm, props, records, jobs = ALL_JOBS, level = LEVEL1 }) -> engine
//   start(day, def?)  fresh instances for `day` (the level's first day); `def` switches the level def
//                     (config LEVELS): windows use def.rounds, days run def.startDay..def.endDay,
//                     problem jobs only for def.problems (and the two recurring ones)
//   restore(d)        from serialize() (a Phase 2 save, v 1, too)
//   tick()            windows, midnight (next day's instances), anchors, state rules; level.update
//                     calls it twice a second, node tests call it directly. Event rules run on the bus.
//   list()            every instance of this level, in creation order
//   open()            the open instances in card order (pinned, problems, before-the-truck, the rest)
//   current()         the instance the marker points at (setCurrent / cycle choose it)
//   byKey(key), complete(key, result?) (debug / goto auto), serialize(), finish() (level end: every
//   job not done becomes missed), nextOpening(after) (env.day of the next job opening, for "Next
//   job" skips; never past the level end), endAt() (the level's last moment), anchors { truck,
//   placed, + the level def's anchors } (env.day floats, null until they happen), coverage(inst)
//
// Phase 3 rule fields (PHASE3.md §3.1): onDays (routines), coverage { area 'brood'|'house'|'used',
// maxCells, tool }, count { sectorsOf 'brood'|'house'|'used', match }, each { has }, action / each
// match on the result; anchors from def.anchors: { action, match } (first matching EV.ACTION) or
// { stat } (read every tick: farm.harvest.catchAt for 'catchAt', else farm.stats[stat]; it moves
// the windows of the jobs still waiting on it); rel.fromH may be negative.
//
// Instance: { key: 'r-meter@3', id, def, day, status: 'waiting'|'open'|'done'|'missed', opensAt,
//   closesAt, doneAt, progress (0..1), result, st (rule state, JSON) }   times as env.day floats.
// Only events while an instance is open count. Completion never looks at the value: the result
// is what was measured or set, written to records.logJob(key, day, result).
import { BROOD_BOUNDS, CLEANOUT, CYCLE, DRINKER_LINES_Z, FAN_COUNT, FLOOR_GRID, HARVEST, HEAT, LEVEL1, ROUNDS, broodSector, houseSector, levelById } from './config.js';
import { EV, matchPayload } from './events.js';
import { ALL_JOBS } from './content-jobs.js';
import { feltNearTarget } from './farm-problems.js';

const H = 1 / 24;
/** The brooding week ends at 06:00 on day 8 at the latest (PHASE2.md §10). */
export const LEVEL_END_DAY = LEVEL1.endDay + 1 + 6 * H;
export const TRUCK_AT = LEVEL1.arrivalDay + LEVEL1.arrivalHour * H;
const EPS = 1e-7;
const NX = FLOOR_GRID.nx, NZ = FLOOR_GRID.nz, CELL = FLOOR_GRID.cell, NCELLS = NX * NZ;
const cellX = (i) => FLOOR_GRID.x0 + ((i % NX) + 0.5) * CELL;
const cellZ = (i) => FLOOR_GRID.z0 + (Math.floor(i / NX) + 0.5) * CELL;
const inBroodXZ = (x, z) => x >= BROOD_BOUNDS.xMin && x <= BROOD_BOUNDS.xMax && z >= BROOD_BOUNDS.zMin && z <= BROOD_BOUNDS.zMax;
/** Problems every level re-arms (PHASE3.md §7): their jobs open in any level. */
const RECURRING = ['abnormal-deaths', 'low-silo'];

// The 300 brooding cells (FLOOR_GRID cells whose centre lies inside BROOD_BOUNDS), as [x, z] (Phase 2's
// export) and as grid indices (cz * nx + cx, the litter grid's order).
const BROOD_IDX = [];
const IN_BROOD = new Uint8Array(NCELLS);
for (let i = 0; i < NCELLS; i++) if (inBroodXZ(cellX(i), cellZ(i))) { BROOD_IDX.push(i); IN_BROOD[i] = 1; }
export const BROOD_CELLS = BROOD_IDX.map((i) => [cellX(i), cellZ(i)]);
export const HOUSE_CELLS = NCELLS;

const nearDrinkerLine = (z) => DRINKER_LINES_Z.some((lz) => Math.abs(z - lz) <= 1);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The level's last moment: day endDay + 1 at 06:00; the clean-out ends at 06:00 on the booked chick
 *  day (day CYCLE.lastDay 06:00 when nothing was booked). */
export function levelEndAt(def = LEVEL1, farm = null) {
  if (def === CLEANOUT || def?.id === 'cleanout') return (farm?.clean?.bookedDay ?? CYCLE.lastDay) + 6 * H;
  return def.endDay + 1 + 6 * H;
}

/** Does the job exist on calendar day `day`? (routines: inside `days`, and on `onDays` if given) */
export function jobOnDay(def, day) {
  if (def.kind === 'problem') return false;
  if (def.kind === 'dated') return def.day === day;
  const [a, b] = def.days || [def.day, def.day];
  if (day < a || day > b) return false;
  return !def.onDays || def.onDays.includes(day);
}

/** [fromHour, toHour] of a non-relative job on its day, or null ('rel' jobs, problems without a window). */
export function windowHours(def, rounds = ROUNDS) {
  if (def.window) return def.window;
  if (def.round === 'rel' || !def.round) return null;
  const r = rounds[def.round] || ROUNDS[def.round];
  return r ? [r.from, r.to] : null;
}

// ---------------- areas and sectors (PHASE3.md §3.1) ----------------
/** 'brood' | 'house' for an area name; 'used' = the brooding cells while the curtain is down. */
function areaNow(name, env) {
  if (name === 'used') return env?.broodCurtain === false ? 'house' : 'brood';
  return name === 'house' ? 'house' : 'brood';
}
const areaSize = (a) => (a === 'house' ? NCELLS : BROOD_IDX.length);
/** Sample sector: the brooding floor's six (Phase 2's numbers 0..5) or the house's eight (10..17). */
function sectorOf(rule, x, z, env) {
  return areaNow(rule.sectorsOf || 'brood', env) === 'house' ? 10 + houseSector(x, z) : broodSector(x, z);
}
/** The cells a walk has seen of its area right now, and how many it needs. */
export function coverageOf(rule, st, env) {
  const a = areaNow(rule.area || 'brood', env);
  const seen = a === 'house' ? st.cells.length : st.cells.reduce((n, i) => n + IN_BROOD[i], 0);
  const need = Math.min(rule.frac * areaSize(a), rule.maxCells ?? Infinity);
  return { area: a, seen, need, size: areaSize(a) };
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

/** Rule met right now (after the events so far)? */
function ruleMet(rule, st, ctx) {
  switch (rule.type) {
    case 'each': return rule.values.every((v) => String(v) in st.seen);
    case 'count': return countMet(rule, st);
    case 'coverage': { const c = coverageOf(rule, st, ctx.env); return c.seen >= c.need - EPS && (!rule.listen || st.listened); }
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
      const cv = coverageOf(rule, st, ctx.env), c = Math.min(1, cv.seen / Math.max(1, cv.need));
      return rule.listen ? c * 0.85 + (st.listened ? 0.15 : 0) : c;
    }
    case 'state': return st.met ? 1 : stateProgress(rule.test, ctx);
    case 'all': return rule.of.reduce((a, r, i) => a + (st.met[i] ? 1 : ruleProgress(r, st.parts[i], ctx)), 0) / rule.of.length;
    case 'any': return Math.max(...rule.of.map((r, i) => (st.met[i] ? 1 : ruleProgress(r, st.parts[i], ctx))));
    default: return st.met ? 1 : 0;
  }
}

/** Feed one bus event to a rule. Returns true if the rule's state changed. */
function ruleEvent(rule, st, type, p, inst, ctx) {
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
      if (rule.has && p[rule.has] === undefined) return false;   // e.g. a feeder height change, not a run / flood toggle
      if (!rule.values.some((v) => v === p[rule.key])) return false;
      st.seen[String(p[rule.key])] = p.result ?? true; return true;
    case 'count': {
      if (type !== EV.ACTION || p.id !== rule.id || !matchPayload(p, rule.match)) return false;
      const x = Number(p.x), z = Number(p.z);
      const ok = Number.isFinite(x) && Number.isFinite(z);
      st.list.push({ x: ok ? x : null, z: ok ? z : null, s: ok ? sectorOf(rule, x, z, ctx.env) : -1, near: ok && nearDrinkerLine(z), r: p.result ?? null });
      return true;
    }
    case 'coverage': {
      if (type === EV.LISTEN) { if (st.listened) return false; st.listened = true; return true; }
      if (type !== EV.CELL) return false;
      if (rule.tool && ctx.props?.carrying !== rule.tool) return false;   // the washer, sprayer or scraper in the hand
      let x = Number(p.x), z = Number(p.z);
      if (!Number.isFinite(x) && Number.isFinite(p.cx)) { x = FLOOR_GRID.x0 + (p.cx + 0.5) * CELL; z = FLOOR_GRID.z0 + (p.cz + 0.5) * CELL; }
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      const sight = rule.sight ?? 2, r2 = sight ** 2, house = areaNow(rule.area || 'brood', ctx.env) === 'house';
      const have = new Set(st.cells);
      let changed = false;
      const c0 = Math.max(0, Math.floor((x - sight - FLOOR_GRID.x0) / CELL)), c1 = Math.min(NX - 1, Math.floor((x + sight - FLOOR_GRID.x0) / CELL));
      const r0 = Math.max(0, Math.floor((z - sight - FLOOR_GRID.z0) / CELL)), r1 = Math.min(NZ - 1, Math.floor((z + sight - FLOOR_GRID.z0) / CELL));
      for (let cz = r0; cz <= r1; cz++) for (let cx = c0; cx <= c1; cx++) {
        const i = cz * NX + cx;
        if (have.has(i) || (!house && !IN_BROOD[i])) continue;
        if ((cellX(i) - x) ** 2 + (cellZ(i) - z) ** 2 <= r2 + EPS) { st.cells.push(i); have.add(i); changed = true; }
      }
      return changed;
    }
    case 'all': case 'any': {
      let changed = false;
      rule.of.forEach((r, i) => {
        if (st.met[i]) return; // parts latch once met
        if (ruleEvent(r, st.parts[i], type, p, inst, ctx)) { changed = true; if (ruleMet(r, st.parts[i], ctx)) st.met[i] = true; }
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
    rule.of.forEach((r, i) => { if (!st.met[i] && ruleTick(r, st.parts[i], ctx)) { changed = true; if (ruleMet(r, st.parts[i], ctx)) st.met[i] = true; } });
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

// ---------------- state predicates (content-jobs.js STATE_TEST_IDS, content-jobs-cycle.js STATE_TEST_IDS_CYCLE) ----------------
/** The condition held `min` game minutes in a row (st.since remembers when it began). */
function held(st, cond, env, min) {
  if (cond) { if (st.since == null) st.since = env.day; } else st.since = null;
  return st.since != null && env.day - st.since >= min / 1440 - EPS;
}
/** Litter cover over all 576 cells (farm.litter.cover is the brooding floor's share). */
function houseCover(farm) {
  const g = farm.litter?.coverGrid;
  if (!g || !g.length) return farm.litter?.cover ?? 0;
  let s = 0;
  for (let i = 0; i < g.length; i++) s += Math.min(1, g[i]);
  return s / g.length;
}
/** Caked share of the floor in use (the brooding cells while the curtain is down, all after). */
function cakedShare(farm, env) {
  const g = farm.litter?.cakedGrid;
  if (!g) return 0;
  const house = areaNow('used', env) === 'house';
  let n = 0, c = 0;
  for (let i = 0; i < g.length; i++) { if (!house && !IN_BROOD[i]) continue; n++; c += g[i] ? 1 : 0; }
  return n ? c / n : 0;
}
const ammonia = (farm) => farm.air?.ammoniaPpm ?? farm.litter?.ammoniaPpm ?? 0;
const brokenFans = (env) => (env.fansBroken || []).length;

function stateTest(test, st, { env, farm, props }) {
  const C = farm.clean || {};
  switch (test) {
    case 'preheat-on': return env.heaterSetpoint >= 30 && !!env.heatersOn;
    case 'litter-covered': return (farm.litter?.cover ?? 0) >= 0.95;
    case 'pans-flooded': return farm.feed.lines.every((l) => l.flood && l.panFill >= 0.95);
    case 'lines-flushed': return farm.water.lines.every((l) => l.flushClear >= 0.99);
    case 'all-placed': return farm.flock.inBoxes === 0 && farm.flock.placed > 0;
    case 'dead-cleared': return farm.flock.deadOnFloor === 0 && props?.carrying !== 'bucket';
    case 'house-near-target':
      // what the chicks feel (farm-problems feltNearTarget: house air less the wind chill of the
      // fans, at chick level) within -1.5..+1.5 °C of the target for 30 game minutes in a row:
      // tunnel air that chills the chicks does not count
      return held(st, feltNearTarget(env, farm), env, 30);
    // ---- Phase 3 (PHASE3.md §3.1) ----
    case 'house-ready': return houseCover(farm) >= 0.95;
    case 'rh-under': return held(st, env.houseRH <= 75, env, 60);
    case 'lame-cleared': return (farm.flock.lameOnFloor ?? 0) === 0;
    case 'vaccine-drunk': return farm.health?.vaccine?.state === 'drunk';
    case 'pans-grower': return (farm.feed?.panType?.grower ?? 0) >= 0.9;
    case 'pans-finisher': return (farm.feed?.panType?.finisher ?? 0) >= 0.9;
    case 'caked-cleared': return cakedShare(farm, env) <= 0.02;
    case 'air-clear': return held(st, (farm.air?.dustIndex ?? 0) <= 1 && ammonia(farm) <= 15, env, 120);
    case 'heat-handled': {
      // done by doing what the heat sign and the pad plate say, even while the weather still makes
      // some birds pant: every fan that turns is on and the pad runs (or is off over its humidity limit)
      const allFans = env.fansEffective >= FAN_COUNT - brokenFans(env);
      const padOk = !!env.padOn || env.houseRH > HEAT.padOffAboveRH;
      return held(st, (farm.comfort?.pantShare ?? 0) <= 0.1 || (allFans && padOk), env, 30);
    }
    case 'pad-humid-ok': return held(st, (!env.padOn || env.houseRH <= HEAT.padOffAboveRH) && env.fansEffective >= 5, env, 30);
    case 'house-empty': return !!farm.harvest?.started && farm.flock.alive === 0;
    case 'litter-removed': return houseCover(farm) <= 0.05;
    case 'house-washed': return (C.washShare ?? 0) >= 0.95;
    case 'house-disinfected': return (C.sprayShare ?? 0) >= 0.95;
    // a floor that was never washed is not "dried with the fans" (run package: the share washed > 0)
    case 'house-dry': return (C.wetShare ?? 0) <= 0.1 && (C.washShare ?? 0) > 0;
    case 'lines-disinfected': return Array.isArray(C.lines) && C.lines.length > 0 && C.lines.every((v) => v >= 1);
    case 'rest-done': return C.bookedDay != null && env.day >= C.bookedDay + 6 * H - EPS;
    default: return false;
  }
}
function stateProgress(test, { env, farm }) {
  const C = farm.clean || {};
  switch (test) {
    case 'litter-covered': return clamp01((farm.litter?.cover ?? 0) / 0.95);
    case 'pans-flooded': return farm.feed.lines.filter((l) => l.flood && l.panFill >= 0.95).length / farm.feed.lines.length;
    case 'lines-flushed': return farm.water.lines.reduce((a, l) => a + clamp01(l.flushClear), 0) / farm.water.lines.length;
    case 'all-placed': { const d = farm.flock.delivered || LEVEL1.chicksPlaced; return clamp01(farm.flock.placed / d); }
    case 'preheat-on': return env.heaterSetpoint >= 30 ? 0.5 : 0;
    case 'house-ready': return clamp01(houseCover(farm) / 0.95);
    case 'litter-removed': return clamp01((1 - houseCover(farm)) / 0.95);
    case 'house-washed': return clamp01((C.washShare ?? 0) / 0.95);
    case 'house-disinfected': return clamp01((C.sprayShare ?? 0) / 0.95);
    case 'house-dry': return (C.washShare ?? 0) > 0 ? clamp01((1 - (C.wetShare ?? 0)) / 0.9) : 0;
    case 'lines-disinfected': return Array.isArray(C.lines) && C.lines.length ? C.lines.filter((v) => v >= 1).length / C.lines.length : 0;
    case 'pans-grower': return clamp01((farm.feed?.panType?.grower ?? 0) / 0.9);
    case 'pans-finisher': return clamp01((farm.feed?.panType?.finisher ?? 0) / 0.9);
    case 'vaccine-drunk': return ({ none: 0, thirst: 0.25, mixed: 0.5, drinking: 0.75, drunk: 1 })[farm.health?.vaccine?.state] ?? 0;
    default: return 0;
  }
}
// What the job's result records for a state rule: the measured state when it was met.
function stateSnapshot(test, { env, farm }) {
  const C = farm.clean || {};
  switch (test) {
    case 'preheat-on': return { setpoint: env.heaterSetpoint, at: env.day };
    case 'litter-covered': return { cover: farm.litter.cover, depthCm: farm.litter.depthCm };
    case 'pans-flooded': return { lines: farm.feed.lines.map((l) => ({ heightCm: l.heightCm, flood: l.flood })) };
    case 'lines-flushed': return { flushDoneAt: farm.stats?.flushDoneAt ?? env.day };
    case 'all-placed': return { placed: farm.flock.placed, firstTipAt: farm.stats?.firstTipAt ?? null, lastTipAt: farm.stats?.lastTipAt ?? env.day };
    case 'dead-cleared': return { at: env.day };
    case 'house-near-target': return { houseC: env.houseTemp, targetC: env.targetTemp };
    case 'house-ready': case 'litter-removed': return { coverPct: Math.round(houseCover(farm) * 100) };
    case 'rh-under': case 'pad-humid-ok': return { houseRH: Math.round(env.houseRH), padOn: !!env.padOn, fans: env.fansEffective };
    case 'heat-handled': return { pantShare: +(farm.comfort?.pantShare ?? 0).toFixed(2), fans: env.fansEffective, padOn: !!env.padOn, houseC: +env.houseTemp.toFixed(1) };
    case 'air-clear': return { dust: +(farm.air?.dustIndex ?? 0).toFixed(2), nh3: Math.round(ammonia(farm)) };
    case 'vaccine-drunk': return { hours: farm.health?.vaccine?.hours ?? null };
    case 'pans-grower': case 'pans-finisher': return { panType: { ...(farm.feed?.panType || {}) } };
    case 'house-washed': return { washPct: Math.round((C.washShare ?? 0) * 100) };
    case 'house-disinfected': return { sprayPct: Math.round((C.sprayShare ?? 0) * 100) };
    case 'house-dry': return { wetPct: Math.round((C.wetShare ?? 0) * 100) };
    case 'rest-done': return { bookedDay: C.bookedDay ?? null, closedDay: C.closedDay ?? null };
    default: return { at: env.day };
  }
}

// The result written to the record: what was measured or set while doing the job, never a verdict.
function ruleResult(rule, st, ctx) {
  switch (rule.type) {
    case 'event': case 'action': return st.payload;
    case 'each': return { ...st.seen };
    case 'count': {
      // the samples themselves are in the notebook: the record keeps how many, where, and the values
      const one = (r) => (r && typeof r === 'object' && Object.keys(r).length === 1 ? Object.values(r)[0] : r);
      return { n: st.list.length, sectors: [...new Set(st.list.map((r) => r.s))], values: st.list.map((r) => one(r.r)) };
    }
    case 'coverage': { const c = coverageOf(rule, st, ctx.env); return { seenPct: Math.round((c.seen / c.size) * 100), listened: st.listened }; }
    case 'state': return st.value;
    case 'all': case 'any': return rule.of.map((r, i) => (st.met[i] ? ruleResult(r, st.parts[i], ctx) : null));
    default: return null;
  }
}

// ---------------- the engine ----------------
export function createJobEngine({ events, env, farm, props, records, jobs = ALL_JOBS, level = LEVEL1 } = {}) {
  let def = level || LEVEL1;
  /** @type {any[]} */
  let list = [];
  const byKey = new Map();
  const anchors = { truck: null, placed: null };
  let lastDay = null;
  let currentKey = null;
  let started = false;
  const ctx = { env, farm, props, get def() { return def; } };
  const emit = (t, p) => events && events.emit(t, p);
  const order = jobs.map((j) => j.id);
  const rank = (inst) => order.indexOf(inst.id);
  const isL1 = () => def === LEVEL1 || def.id === LEVEL1.id;
  const rounds = () => def.rounds || ROUNDS;
  const levelAnchors = () => def.anchors || {};
  const endAt = () => levelEndAt(def, farm);
  const inLevel = (d) => d >= def.startDay && d <= def.endDay;
  const problemIds = () => new Set([...(def.problems || []).map((p) => p.id), ...RECURRING]);

  function make(jd, day, opensAt, closesAt) {
    const key = `${jd.id}@${day}`;
    if (byKey.has(key)) return byKey.get(key);
    const inst = { key, id: jd.id, def: jd, day, status: 'waiting', opensAt, closesAt, doneAt: null, progress: 0, result: null, st: initState(jd.done) };
    list.push(inst); byKey.set(key, inst);
    return inst;
  }

  function relTimes(jd) {
    const a = anchors[jd.rel.anchor];
    return a == null ? [null, null] : [a + jd.rel.fromH * H, a + jd.rel.toH * H];
  }

  function createDay(day) {
    for (const jd of jobs) {
      if (!jobOnDay(jd, day)) continue;
      if (jd.round === 'rel') { const [o, c] = relTimes(jd); make(jd, day, o, c); continue; }
      const w = windowHours(jd, rounds());
      if (!w) continue;
      let close = day + w[1] * H;
      if (jd.closeOn === 'placed' && anchors.placed != null && anchors.placed < close) close = Math.max(day + w[0] * H, anchors.placed);
      make(jd, day, day + w[0] * H, close);
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
  /** A stat anchor (the booked catch) may move: the jobs still waiting on it move with it. */
  function moveAnchor(name, t) {
    if (anchors[name] != null && Math.abs(anchors[name] - t) < EPS) return;
    anchors[name] = t;
    for (const inst of list) if (inst.def.round === 'rel' && inst.def.rel.anchor === name && inst.status === 'waiting') [inst.opensAt, inst.closesAt] = relTimes(inst.def);
  }
  function statValue(stat) {
    if (stat === 'catchAt') return farm?.harvest?.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour * H; // the company's default
    return farm?.stats?.[stat] ?? null;
  }

  function openProblem(problemId) {
    const day = env.dayNumber;
    for (const jd of jobs) {
      if (jd.kind !== 'problem' || jd.problem !== problemId) continue;
      if (list.some((i) => i.id === jd.id)) continue; // one instance per problem and level
      const w = jd.window;
      const opensAt = w ? Math.max(env.day, day + w[0] * H) : env.day;
      const closesAt = w ? day + w[1] * H : endAt();
      make(jd, day, opensAt, Math.max(opensAt, closesAt));
    }
    windows();
  }

  function finishInst(inst, result) {
    inst.status = 'done';
    inst.doneAt = env.day;
    inst.progress = 1;
    inst.result = result === undefined ? ruleResult(inst.def.done, inst.st, ctx) : result;
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
    while (lastDay < d) { lastDay++; if (inLevel(lastDay)) createDay(lastDay); }
  }

  function anchorsByClock() {
    if (isL1()) {
      // The farm announces the truck (stats.truckAt / EV.FARM_DELIVERY); with the contract stub, or if
      // nothing came within half an hour, it counts as there at 08:00 on day 0.
      if (anchors.truck == null && farm?.stats?.truckAt != null) setAnchor('truck', farm.stats.truckAt);
      const grace = farm && farm.stub === false ? 0.5 * H : 0;
      if (anchors.truck == null && env.day >= TRUCK_AT + grace - EPS) setAnchor('truck', TRUCK_AT);
      if (anchors.placed == null && farm?.stats?.firstTipAt != null) setAnchor('placed', farm.stats.firstTipAt);
    }
    for (const [name, a] of Object.entries(levelAnchors())) if (a.stat) { const v = statValue(a.stat); if (v != null) moveAnchor(name, v); }
  }

  function evalOpen(type, p) {
    for (const inst of list) {
      if (inst.status !== 'open') continue;
      if (ruleEvent(inst.def.done, inst.st, type, p, inst, ctx)) {
        inst.progress = ruleProgress(inst.def.done, inst.st, ctx);
        if (ruleMet(inst.def.done, inst.st, ctx)) finishInst(inst);
      }
    }
  }

  function onBus(p, type) {
    if (!started || type === EV.JOB_OPEN || type === EV.JOB_DONE || type === EV.JOB_MISSED || type === EV.LEVEL) return;
    p = p || {};
    // anchors first, so a relative job can open on the same event
    if (isL1()) {
      if (type === EV.FARM_DELIVERY && p.kind === 'chicks' && p.phase === 'arrive') setAnchor('truck', env.day);
      if (anchors.placed == null && (type === EV.FARM_PLACED || type === EV.BOX_TIP || (type === EV.ACTION && p.id === 'chicks.tip'))) {
        if (anchors.truck == null) setAnchor('truck', Math.min(env.day, TRUCK_AT));
        setAnchor('placed', env.day);
      }
    }
    if (type === EV.ACTION) {
      for (const [name, a] of Object.entries(levelAnchors())) if (a.action && anchors[name] == null && p.id === a.action && matchPayload(p, a.match)) setAnchor(name, env.day);
    }
    if (type === EV.FARM_PROBLEM && p.phase === 'symptom' && problemIds().has(p.id)) openProblem(p.id);
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
      if (ruleMet(inst.def.done, inst.st, ctx)) finishInst(inst);
    }
  }

  /** Open jobs in card groups (PHASE2.md §3.5): pinned anchor jobs, problem jobs ("new"), the
   *  day 0 "before the truck" group until the first tip, then the rest in list order. */
  function groups() {
    const open = list.filter((i) => i.status === 'open');
    const byRank = (a, b) => a.day - b.day || rank(a) - rank(b);
    const pinned = open.filter((i) => i.def.pin).sort(byRank);
    const problems = open.filter((i) => i.def.kind === 'problem' && !i.def.pin);
    const preTruck = isL1() && env.dayNumber === 0 && anchors.placed == null ? open.filter((i) => i.def.preTruck && !i.def.pin) : [];
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

  /** The env.day of the next moment a job opens after `after` (Next job skips land there): never past
   *  the level's end, and never past the catch (a stat anchor). */
  function nextOpening(after = env.day) {
    let best = endAt();
    const take = (t) => { if (t != null && t > after + EPS && t < best) best = t; };
    for (const inst of list) if (inst.status === 'waiting' && afterOk(inst)) take(inst.opensAt);
    for (let d = Math.max(def.startDay, (lastDay ?? env.dayNumber) + 1); d <= def.endDay; d++) {
      for (const jd of jobs) { if (!jobOnDay(jd, d)) continue; const w = windowHours(jd, rounds()); if (w) take(d + w[0] * H); }
    }
    if (isL1() && anchors.truck == null) take(TRUCK_AT);
    for (const [name, a] of Object.entries(levelAnchors())) if (a.stat) take(anchors[name]);
    return best;
  }

  function reset(newDef) {
    if (newDef) def = newDef;
    list = []; byKey.clear(); currentKey = null;
    for (const k of Object.keys(anchors)) delete anchors[k];
    anchors.truck = anchors.placed = null;
    for (const name of Object.keys(levelAnchors())) anchors[name] = null;
  }

  const engine = {
    anchors,
    get started() { return started; },
    /** The level def the engine runs (config LEVELS). */
    get level() { return def; },
    /** Fresh instances for `day` (level start: its first day). `newDef` switches the level. */
    start(day, newDef) {
      reset(newDef);
      day = day ?? def.startDay;
      lastDay = day; started = true;
      createDay(day);
      // rel jobs on a level anchor for the level's later days are made now: a moved anchor (a catch
      // booked for the evening before) never leaves one created after its window
      const la = levelAnchors();
      for (let d = day + 1; d <= def.endDay; d++) for (const jd of jobs) if (jd.round === 'rel' && jd.rel.anchor in la && jobOnDay(jd, d)) make(jd, d, ...relTimes(jd));
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
    /** The level's last moment (env.day): def.endDay + 1 at 06:00, the clean-out's booked chick day 06:00. */
    endAt,
    /** A walk's cells seen and needed (the job card's text). */
    coverage(inst) { return inst?.def.done.type === 'coverage' ? coverageOf(inst.def.done, inst.st, env) : null; },
    stats() {
      const c = { waiting: 0, open: 0, done: 0, missed: 0 };
      for (const i of list) c[i.status]++;
      return c;
    },
    serialize() {
      // compact (the autosave stays small all week): id and day come from the key, times to ~1 s,
      // a closed job keeps its rule state only for sample counts (the card's tallies)
      const t = (v) => (v == null ? v : Math.round(v * 1e5) / 1e5);
      return { v: 2, levelId: def.id, lastDay, anchors: { ...anchors }, currentKey, started,
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
    /** From serialize(). `newDef` (else the saved levelId, else Phase 2's level) is the level it runs. */
    restore(d, newDef) {
      reset(newDef || (d?.levelId && levelById(d.levelId)) || LEVEL1);
      if (!d) { started = false; return; }
      lastDay = d.lastDay; currentKey = d.currentKey ?? null; started = d.started !== false;
      Object.assign(anchors, d.anchors || {});
      // a Phase 2 save (v 1) kept a walk's cells as indices into the 300 brooding cells
      const mapCells = (rule, st) => {
        if (!st || !rule) return;
        if (rule.type === 'coverage' && Array.isArray(st.cells)) st.cells = st.cells.map((k) => BROOD_IDX[k]).filter((i) => i != null);
        if (rule.of && st.parts) rule.of.forEach((r, k) => mapCells(r, st.parts[k]));
      };
      for (const raw of d.list || []) {
        const s = Array.isArray(raw) ? { key: raw[0], status: raw[1], opensAt: raw[2], closesAt: raw[3], doneAt: raw[4] } : raw;
        const at = s.key.lastIndexOf('@'), id = s.id ?? s.key.slice(0, at), day = s.day ?? Number(s.key.slice(at + 1));
        const jd = jobs.find((j) => j.id === id);
        if (!jd) continue;
        const inst = { ...s, id, day, def: jd, progress: s.progress ?? (s.status === 'done' ? 1 : 0), result: s.result ?? null, st: s.st || initState(jd.done) };
        if ((d.v ?? 1) < 2) mapCells(jd.done, inst.st);
        list.push(inst); byKey.set(inst.key, inst);
      }
    },
    dispose() { off(); started = false; },
  };
  return engine;
}
