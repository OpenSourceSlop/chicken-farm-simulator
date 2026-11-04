// Save slots, the pure part (PHASE5.md §3.2-§3.8): the envelope a slot or a backup holds, its name, the migrations from
// the Phase 2-4 formats, the checks before a resume, and the slot store over any Storage-like object. No DOM: node tests
// run it with a fake storage. Owner: package "saves". metaOf, slotName and the envelope shape are the frozen contract (the
// panel and the title card read them); Phase 5 adds the slot store (read / write / remove / list, the quota and blocked
// rules, maxSlotChars) and the stored form of an envelope (meta outside, the payload packed by save-codec.js).
//
//   metaOf({ run, blob })            -> { name, condition, conditionLabel, levelId, levelN, levelShort, day, hour, time }
//   slotName(meta)                   -> "Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20"
//   makeEnvelope({ run, blob, starts, profile? }) -> { format, v, build, savedAt, meta, run, blob, starts, profile }
//   migrate(obj)                     -> an envelope (v 5) from a v1 level save, a v3 run save or an envelope; throws SaveError
//                                       (a v1 save gets level.levelId 'level1' and run null)
//   checkEnvelope(env)               -> null when it can be resumed, else the SaveError code ('invalid')
//   createSlotStore({ storage })     -> { available, list(), read(n), load(n), write(n, stored), remove(n), keyOf(n), chars(n) }
//                                       (storage: a Storage-like object or a function returning one; every access in try/catch)
//   await packEnvelope(env, { gzip? }) -> the stored form { format, v, build, savedAt, meta, enc, crc, data, chars }
//   await unpackStored(stored)       -> the envelope (migrated, checked) or throws SaveError
//   mergeProfiles(a, b)              -> the skill profile with the larger of each (a backup's skill points brought in)
import { SAVE_SLOTS, BUILD, LEVELS, levelById, conditionLabel, CONDITIONS } from './config.js';
import { SaveError, encodePayload, decodePayload, crc32, hex8 } from './save-codec.js';

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
    if (obj.data != null && obj.blob == null) throw new SaveError('damaged', 'stored form');   // unpackStored reads that one
    // (an envelope of an older 5.x build: its starts and its name filled in; nothing else is rewritten)
    return { ...obj, starts: Array.isArray(obj.starts) ? obj.starts : [], meta: obj.meta && obj.meta.name ? obj.meta : metaOf(obj), profile: obj.profile ?? null };
  }
  if (Number.isFinite(obj.version) && obj.version > SAVE_SLOTS.version) throw new SaveError('newer', `version ${obj.version}`);
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

/** An envelope in its stored form (PHASE5.md §3.2): meta outside (the list is drawn without unpacking a run), the run packed. */
export async function packEnvelope(env, { gzip = true } = {}) {
  const { meta, savedAt, build } = env;
  const p = await encodePayload(env, { gzip });
  return { format: SAVE_SLOTS.format, v: SAVE_SLOTS.version, build: build || BUILD.id, savedAt, meta, enc: p.enc, crc: p.crc, data: p.data, chars: p.data.length };
}
/** The stored form's own checks without unpacking: null when it reads, else the SaveError code (PHASE5.md §3.3, §3.7). */
export function storedError(st) {
  if (!st || typeof st !== 'object' || st.format !== SAVE_SLOTS.format) return 'damaged';
  if (!(st.v >= 1)) return 'damaged';
  if (st.v > SAVE_SLOTS.version) return 'newer';
  if (typeof st.data !== 'string' || !st.data.length || typeof st.enc !== 'string') return 'damaged';
  if (st.chars != null && st.chars !== st.data.length) return 'incomplete';
  try {
    const clean = st.data.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4) return 'incomplete';
    const bytes = typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(clean, 'base64')) : Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
    if (st.crc != null && hex8(crc32(bytes)) !== String(st.crc).toLowerCase()) return 'incomplete';
  } catch { return 'damaged'; }
  return null;
}
/** The envelope a stored slot holds: unpacked, migrated and checked; throws SaveError. */
export async function unpackStored(st) {
  const code = storedError(st);
  if (code) throw new SaveError(code);
  const obj = await decodePayload({ enc: st.enc, crc: st.crc, data: st.data });
  const env = migrate(obj);
  const bad = checkEnvelope(env);
  if (bad) throw new SaveError(bad);
  return env;
}

/** The three slot keys over a Storage-like object (PHASE5.md §3.3): a write never leaves a half slot; quota and blocked. */
export function createSlotStore({ storage = null } = {}) {
  const keyOf = (n) => `${SAVE_SLOTS.keyPrefix}${n}`;
  const st = () => { try { return typeof storage === 'function' ? storage() : storage; } catch { return null; } };
  const probe = () => { try { const s = st(); if (!s) return false; s.setItem('__cf_probe__', '1'); s.removeItem('__cf_probe__'); return true; } catch { return false; } };
  const readable = () => { try { const s = st(); if (!s) return false; s.getItem('__cf_probe__'); return true; } catch { return false; } };
  // storage that reads and writes, or that reads and holds keys but is full (a full storage refuses even the probe)
  const usable = () => readable() && (probe() || (() => { try { return (st().length || 0) > 0; } catch { return false; } })());
  const valid = (n) => Number.isInteger(n) && n >= 1 && n <= SAVE_SLOTS.count;
  const raw = (n) => { const s = st(); if (!s) throw new SaveError('blocked'); return s.getItem(keyOf(n)); };
  const store = {
    get available() { return usable(); },
    keyOf,
    /** The stored text's length (the row's size), 0 when empty or unreadable. */
    chars(n) { try { return (raw(n) || '').length; } catch { return 0; } },
    /** The parsed stored form of slot n, or null (empty); throws SaveError('blocked' | 'damaged'). */
    load(n) {
      if (!valid(n)) return null;
      let text;
      try { text = raw(n); } catch { throw new SaveError('blocked'); }
      if (text == null) return null;
      try { return JSON.parse(text); } catch { throw new SaveError('damaged', 'json'); }
    },
    /** One row: { slot, empty, meta, savedAt, chars, enc, error? } (error: the SaveError code of a slot that cannot be read). */
    read(n) {
      const row = { slot: n, empty: true, meta: null, savedAt: null, chars: 0, enc: null };
      let o;
      try { o = store.load(n); } catch (e) { return { ...row, empty: false, error: e.code || 'damaged' }; }
      if (!o) return row;
      const err = storedError(o);
      row.empty = false; row.chars = store.chars(n);
      if (o && typeof o === 'object') { row.meta = o.meta && typeof o.meta === 'object' ? o.meta : null; row.savedAt = Number.isFinite(o.savedAt) ? o.savedAt : null; row.enc = o.enc ?? null; }
      if (err) row.error = err;
      return row;
    },
    list: () => Array.from({ length: SAVE_SLOTS.count }, (_, i) => store.read(i + 1)),
    /** Write a stored form (packEnvelope's) into slot n: { ok, code? } — 'full' over maxSlotChars or on a quota error (the
     *  old slot kept as it was), 'blocked' with no storage. */
    write(n, stored) {
      if (!valid(n)) return { ok: false, code: 'invalid' };
      const text = JSON.stringify(stored);
      if (text.length > SAVE_SLOTS.maxSlotChars) return { ok: false, code: 'full', chars: text.length };
      const s = st();
      if (!s || !usable()) return { ok: false, code: 'blocked' };
      try { s.setItem(keyOf(n), text); return { ok: true, chars: text.length }; } catch { return { ok: false, code: usable() ? 'full' : 'blocked', chars: text.length }; }
    },
    remove(n) {
      if (!valid(n)) return { ok: false, code: 'invalid' };
      const s = st();
      if (!s) return { ok: false, code: 'blocked' };
      try { s.removeItem(keyOf(n)); return { ok: true }; } catch { return { ok: false, code: 'blocked' }; }
    },
  };
  return store;
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
