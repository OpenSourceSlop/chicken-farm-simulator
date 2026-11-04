// Save slots, the pure part (PHASE5.md §3.2-§3.8): the envelope a slot or a backup holds, its name, the migrations from
// the Phase 2-4 formats, the checks before a resume, and the slot store over any Storage-like object. No DOM: node tests
// run it with a fake storage. Owner after the design round: package "saves". metaOf, slotName and the envelope shape are
// the frozen contract (the panel and the title card read them); the store and the migrations are STUBS now.
//
//   metaOf({ run, blob })            -> { name, condition, conditionLabel, levelId, levelN, levelShort, day, hour, time }
//   slotName(meta)                   -> "Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20"
//   makeEnvelope({ run, blob, starts, profile? }) -> { format, v, build, savedAt, meta, run, blob, starts, profile }
//   migrate(obj)                     -> an envelope (v 5) from a v1 level save, a v3 run save or an envelope; throws SaveError
//                                       (a v1 save gets level.levelId 'level1' and run null)
//   checkEnvelope(env)               -> null when it can be resumed, else the SaveError code ('invalid')
//   createSlotStore({ storage })     -> { available, list(), read(n), write(n, stored), remove(n), keyOf(n) }   (stub)
//   mergeProfiles(a, b)              -> the skill profile with the larger of each (a backup's skill points brought in)
import { SAVE_SLOTS, BUILD, LEVELS, levelById, conditionLabel, CONDITIONS } from './config.js';
import { SaveError } from './save-codec.js';

const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (h) => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; };
/** "Planning day", "Prep day", "Day 30", "Clean-out day 2", "Rest day 5" (content.js dayLabel without the booking). */
function dayWords(d) {
  if (d <= -2) return 'Planning day';
  if (d < 0) return 'Prep day';
  if (d <= 42) return `Day ${d}`;
  if (d <= 46) return `Clean-out day ${d - 42}`;
  return `Rest day ${d - 46}`;
}

/** What a slot row and a backup's header say about a saved game (from the run key's { run, blob }). */
export function metaOf({ run = null, blob = null } = {}) {
  const env = blob?.env || {}, lv = blob?.level || {};
  const levelId = lv.levelId || run?.levelId || null, def = levelById(levelId);
  const c = blob?.farm?.cond?.condition ?? run?.condition ?? null;
  const condition = c && CONDITIONS[c] ? c : null;
  const hour = Number.isFinite(env.hour) ? env.hour : 0;
  const day = Number.isFinite(env.day) ? Math.round(env.day - hour / 24) : null;
  const meta = { condition, conditionLabel: conditionLabel(condition), levelId, levelN: def?.n ?? null, levelShort: def?.short ?? '', levelTitle: def?.title ?? '',
    day, hour, time: hhmm(hour) };
  meta.name = slotName(meta);
  return meta;
}
export function slotName(m) {
  if (!m) return 'Empty';
  const parts = [m.conditionLabel || 'Normal season'];
  if (m.levelTitle) parts.push(m.levelTitle);
  if (m.day != null) parts.push(`${dayWords(m.day)}, ${m.time ?? hhmm(m.hour ?? 0)}`);
  return parts.join(' · ');
}

/** A whole run in the Phase 5 envelope (PHASE5.md §3.2). starts: [{ levelId, day, savedAt, run, blob }]. */
export function makeEnvelope({ run, blob, starts = [], profile = null, savedAt = Date.now() }) {
  return { format: SAVE_SLOTS.format, v: SAVE_SLOTS.version, build: BUILD.id, savedAt, meta: metaOf({ run, blob }), run, blob, starts, profile };
}

/**
 * Any saved game this build knows, as an envelope (PHASE5.md §3.6): the envelope itself, the v3 run save ({ version: 3,
 * savedAt, run, blob }) and the v1 Phase 2 level save ({ version: 1, savedAt, level, env, farm, records, props, flock,
 * player }: Phase 2's level.serialize() has no levelId, so it is set to 'level1'; run null: run.importSave continues it as a
 * run at the brooding week, as run.continueSave does since Phase 3). The saves package adds the later checks.
 */
export function migrate(obj) {
  if (!obj || typeof obj !== 'object') throw new SaveError('not-a-save');
  if (obj.format === SAVE_SLOTS.format) {
    if (obj.v > SAVE_SLOTS.version) throw new SaveError('newer', `format ${obj.v}`);
    return obj;
  }
  if (obj.version === 3 && obj.blob) return makeEnvelope({ run: obj.run ?? null, blob: obj.blob, starts: [], savedAt: obj.savedAt ?? Date.now() });
  if (obj.version === 1 && obj.level && obj.env) {
    const { version, savedAt, ...blob } = obj;
    void version;
    blob.level = { ...blob.level, levelId: blob.level.levelId || 'level1' };
    return makeEnvelope({ run: null, blob, starts: [], savedAt: savedAt ?? Date.now() });
  }
  throw new SaveError('not-a-save');
}

/** null when the envelope holds a level this build can resume; else 'invalid' (PHASE5.md §3.7). */
export function checkEnvelope(e) {
  const b = e?.blob;
  if (!b || !b.level || !b.env || !b.farm) return 'invalid';
  if (!LEVELS.some((l) => l.id === b.level.levelId)) return 'invalid';
  if (!Number.isFinite(b.env.day) || b.env.day < -2.01 || b.env.day > 71) return 'invalid';
  return null;
}

/** STUB (package saves): the slot keys over a Storage-like object. */
export function createSlotStore({ storage = null } = {}) {
  const keyOf = (n) => `${SAVE_SLOTS.keyPrefix}${n}`;
  return {
    get available() { try { if (!storage) return false; storage.setItem('__cf_probe__', '1'); storage.removeItem('__cf_probe__'); return true; } catch { return false; } },
    keyOf,
    list: () => Array.from({ length: SAVE_SLOTS.count }, (_, i) => ({ slot: i + 1, empty: true, meta: null, savedAt: null })),
    read: () => null,
    write: () => ({ ok: false, code: 'not-built' }),
    remove: () => ({ ok: false, code: 'not-built' }),
  };
}

/** The larger of each: earned milestones (by tier), cycles, conditions, details (PHASE5.md §3.5). */
export function mergeProfiles(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const ea = new Map(a.skills?.earned || []), eb = b.skills?.earned || [];
  for (const [k, v] of eb) { const o = ea.get(k); ea.set(k, o == null ? v : (typeof v === 'number' && typeof o === 'number' ? Math.max(o, v) : o)); }
  const cd = { ...(a.conditionsDone || {}) };
  for (const [k, n] of Object.entries(b.conditionsDone || {})) cd[k] = Math.max(cd[k] || 0, n || 0);
  const details = new Map(a.details || []);
  for (const [k, v] of b.details || []) if (!details.has(k)) details.set(k, v);
  return { ...a, skills: { ...(a.skills || {}), earned: [...ea] }, details: [...details], cyclesDone: Math.max(a.cyclesDone || 0, b.cyclesDone || 0), conditionsDone: cd };
}
