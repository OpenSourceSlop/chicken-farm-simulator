// Autosave store over localStorage. Every access is inside try/catch: in a private window, with
// storage blocked, or in the artifact preview, localStorage can be missing or throw, and the game
// must then run exactly the same without saving. Owner: package "sim" (phase2/sim).
// This file is complete; level.js (package "level") decides when to save and what goes in.
//
// createSaveStore({ key, profileKey, version }) -> { available, load(), save(data), clear(),
//   loadProfile(), saveProfile(p), info() }
// The level save is one JSON object { version, savedAt, ...data }; a save with another version is
// ignored (load() returns null) so an old save never breaks a new build. The profile (skill
// points, kept across replays) lives under its own key.
import { SAVE, RUN_SAVE, LEVELS } from './config.js';

function storage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__cf_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** The profile's cycle counts on the profile and in its skills (the larger of the two when both are there). */
export function withCycles(p) {
  const sk = p.skills && typeof p.skills === 'object' ? p.skills : null;
  const cyclesDone = Math.max(Number.isFinite(p.cyclesDone) ? p.cyclesDone : 0, sk && Number.isFinite(sk.cyclesDone) ? sk.cyclesDone : 0);
  const conditionsDone = { ...((sk && sk.conditionsDone) || {}) };
  for (const [k, n] of Object.entries(p.conditionsDone || {})) if (Number.isFinite(n)) conditionsDone[k] = Math.max(n, conditionsDone[k] || 0);
  const out = { ...p, cyclesDone, conditionsDone };
  if (sk && (cyclesDone || Object.keys(conditionsDone).length)) out.skills = { ...sk, cyclesDone, conditionsDone };
  return out;
}

export function createSaveStore({ key = SAVE.key, profileKey = SAVE.profileKey, version = SAVE.version } = {}) {
  const read = (k) => {
    try {
      const s = storage();
      const raw = s && s.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      const s = storage();
      if (!s) return false;
      s.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false; // quota or blocked: play on without saving
    }
  };
  const remove = (k) => { try { storage()?.removeItem(k); } catch { /* ignore */ } };

  return {
    get available() { return !!storage(); },
    /** The saved level, or null (none, unreadable, or another version). */
    load() {
      const d = read(key);
      return d && d.version === version ? d : null;
    },
    /** @param {object} data  JSON-safe level state. Returns true when it was written. */
    save(data) { return write(key, { ...data, version, savedAt: Date.now() }); },
    clear() { remove(key); },
    /** Short description for the title card: { day (calendar day, -1 = prep day), hour, savedAt } or null. */
    info() {
      const d = this.load();
      if (!d || !d.env || typeof d.env.day !== 'number') return null;
      const hour = d.env.hour ?? 0;
      return { day: Math.round(d.env.day - hour / 24), hour, savedAt: d.savedAt };
    },
    // Phase 4 (PHASE4.md §3.1, §11.1): the profile's cyclesDone / conditionsDone ride in the skills' part (skills.serialize)
    // and on the profile itself (the run's gate); a Phase 3 profile without them reads 0 / {} (the run may count its
    // stored lastCycle as one cycle). Both places are kept in step on load and save.
    loadProfile() {
      const p = read(profileKey);
      if (!p || p.version !== version) return null;
      return withCycles(p);
    },
    saveProfile(p) { return write(profileKey, { ...withCycles({ ...p }), version }); },
  };
}

// ---------------- Phase 3: the run store (PHASE3.md §11) ----------------
// createRunStore({ key, startPrefix, version }) -> {
//   available                      storage works in this browser
//   load()                         the run save { version, savedAt, run, blob } or null
//   save(run, blob)                the run key (run.serialize(), level.saveBlob()); a full storage drops the
//                                  oldest level start that is not the current level's and tries again
//   loadStart(id, day?)            a level start { version, levelId, day, savedAt, run, blob } (day: weeks 4-5 keep
//                                  day 22 and day 29; without it the latest start of that level)
//   saveStart(id, day, run, blob)  a level start under `${startPrefix}${id}[.${day}]` (the day only when the level
//                                  has more than one saved start); quota as save()
//   clearStart(id, day)            delete one level start
//   clearStarts(fromId)            delete the starts of that level and of every later one (a replay from the run
//                                  card truncates the run)
//   info()                         for the title card: { levelId, day, hour, savedAt, starts: { [levelId]: [day] } } or null
//   migratePhase2({ remove })      Phase 2's level save (SAVE.key), read once: { run: null, blob } to resume as a run
//                                  at level1 with no plan; remove: true deletes it (the run key replaces it)
//   clear()                        the run key and every start
// }
export function createRunStore({ key = RUN_SAVE.key, startPrefix = RUN_SAVE.startPrefix, version = RUN_SAVE.version } = {}) {
  const read = (k) => { try { const st = storage(); const raw = st && st.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const writeRaw = (k, v) => { try { const st = storage(); if (!st) return false; st.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const remove = (k) => { try { storage()?.removeItem(k); } catch { /* ignore */ } };
  const startKeys = () => {
    try { const st = storage(); if (!st) return []; const out = []; for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && k.startsWith(startPrefix)) out.push(k); } return out; } catch { return []; }
  };
  const multi = (id) => { const L = LEVELS.find((l) => l.id === id); return !!(L && L.starts && L.starts.length > 1); };
  const startKey = (id, day) => `${startPrefix}${id}${multi(id) && day != null ? `.${day}` : ''}`;
  /** Write; on a failure drop the oldest level start that is not `keepLevel`'s and try again. */
  function write(k, v, keepLevel) {
    if (writeRaw(k, v)) return true;
    const starts = startKeys().map((sk) => ({ sk, d: read(sk) })).filter((x) => x.d && x.d.levelId !== keepLevel && x.sk !== k)
      .sort((a, b) => (a.d.savedAt || 0) - (b.d.savedAt || 0));
    for (const x of starts) { remove(x.sk); if (writeRaw(k, v)) return true; }
    return false;
  }
  const store = {
    get available() { return !!storage(); },
    load() { const d = read(key); return d && d.version === version ? d : null; },
    save(run, blob) { return write(key, { version, savedAt: Date.now(), run, blob }, run && run.levelId); },
    loadStart(id, day) {
      if (day != null || !multi(id)) { const d = read(startKey(id, day)); return d && d.version === version ? d : null; }
      const L = LEVELS.find((l) => l.id === id), days = (L.starts || []).slice().reverse();
      for (const dd of days) { const d = read(startKey(id, dd)); if (d && d.version === version) return d; }
      return null;
    },
    saveStart(id, day, run, blob) { return write(startKey(id, day), { version, levelId: id, day, savedAt: Date.now(), run, blob }, id); },
    /** Delete one saved start (weeks 4-5: a replay from day 22 drops the day 29 start). */
    clearStart(id, day) { remove(startKey(id, day)); },
    clearStarts(fromId) {
      const i0 = LEVELS.findIndex((l) => l.id === fromId);
      if (i0 < 0) return 0;
      const ids = new Set(LEVELS.slice(i0).map((l) => l.id));
      let n = 0;
      for (const sk of startKeys()) { const id = sk.slice(startPrefix.length).split('.')[0]; if (ids.has(id)) { remove(sk); n++; } }
      return n;
    },
    info() {
      const d = store.load();
      const starts = {};
      for (const sk of startKeys()) { const s = read(sk); if (s && s.version === version) (starts[s.levelId] ||= []).push(s.day); }
      for (const k of Object.keys(starts)) starts[k].sort((a, b) => a - b);
      if (!d) return Object.keys(starts).length ? { levelId: null, day: null, hour: null, savedAt: null, starts } : null;
      const env = d.blob && d.blob.env, hour = env ? env.hour ?? 0 : null;
      return { levelId: (d.run && d.run.levelId) || null, day: env && typeof env.day === 'number' ? Math.round(env.day - hour / 24) : null, hour, savedAt: d.savedAt, starts };
    },
    migratePhase2({ remove: rm = false } = {}) {
      const d = read(SAVE.key);
      if (!d || d.version !== SAVE.version) return null;
      if (rm) remove(SAVE.key);
      const { version: v, savedAt, ...blob } = d;
      void v;
      return { run: null, blob, savedAt, levelId: 'level1' };
    },
    clear() { remove(key); for (const sk of startKeys()) remove(sk); },
  };
  return store;
}
