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
import { SAVE } from './config.js';

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
    /** Short description for the title card: { day, hour, savedAt } or null. */
    info() {
      const d = this.load();
      return d ? { day: d.env?.dayNumber ?? null, hour: d.env?.hour ?? null, savedAt: d.savedAt } : null;
    },
    loadProfile() { const p = read(profileKey); return p && p.version === version ? p : null; },
    saveProfile(p) { return write(profileKey, { ...p, version }); },
  };
}
