// Saves, the game side (PHASE5.md §3): the autosave (run.js's run key and level starts, unchanged since Phase 3), three
// save slots, Continue (always the newest readable save), backups as text and their restore, and the messages a player
// reads when a save cannot be read. main.js creates it after the run (ctx.saves); ui-saves.js draws the panel.
// Owner: package "saves".
//
// createSaves({ run, level, save, events, settings, ui, storage? }) -> saves
//   available                     storage works (slots need it; a backup as text works without it)
//   list()                        [{ slot: 'auto' | 1 | 2 | 3, empty, meta, savedAt, chars, error?, message?, inPlay? }]
//                                 (meta: save-slots.js metaOf; error: the code of a key that exists but does not read)
//   latest()                      the newest readable entry of list() (Continue), or null
//   latestInfo()                  the title card's Continue line: run.info()'s shape plus { slot } (null: no save); a slot's
//                                 short reads "Slot 2: Week 2" so the line says "Continue — Slot 2: Week 2, day 12, 08:40"
//   continueLatest()              resume the newest save (a slot through the autosave first): true / a promise of true
//   continueAuto()                resume the autosave itself (the autosave row's Continue), whatever the slots hold
//   async saveSlot(n)             the game now (or the autosave from the title card) into slot n: { ok, code?, message?, meta }
//   async loadSlot(n)             slot n into the autosave, then resume it: { ok, code?, message?, meta }
//   deleteSlot(n)                 { ok, code?, message? }
//   async exportText(n | 'auto', { farmOnly? })  { ok, text, parts: [text], chars, payloadChars, meta, starts, farmOnly }
//   async previewText(text)       what a pasted backup holds: { ok, meta, starts, profileOffer } or { ok: false, code, message }
//   async importText(text, n | 'play', { mergeProfile? })  a pasted backup into slot n, or played at once from memory
//   message(code)                 SAVE_MESSAGES[code]
//   debug.slotChars(n), debug.corrupt(n)   (the steps files)
// Events: EV.SAVE { kind, slot, ok, message? } after every slot, load, delete, backup and restore; { kind: 'auto-failed' }
// once per level when the autosave cannot write (ui.js shows it).
import { EV } from './events.js';
import { SAVE_SLOTS } from './config.js';
import { SAVE_MESSAGES, SaveError, composeParts, composeText, parseText, encodePayload, decodePayload } from './save-codec.js';
import { createSlotStore, makeEnvelope, metaOf, migrate, checkEnvelope, packEnvelope, unpackStored, mergeProfiles } from './save-slots.js';

const localStore = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const isSlot = (n) => Number.isInteger(n) && n >= 1 && n <= SAVE_SLOTS.count;
/** The message of a code, with the parts a backup in parts lacks ("Missing: parts 3, 5 of 25."). */
const messageOf = (code, detail = '') => `${SAVE_MESSAGES[code] || SAVE_MESSAGES.damaged}${code === 'missing-parts' && detail ? ` Missing: ${detail}.` : ''}`;
const earnedKey = (p) => JSON.stringify([...(p?.skills?.earned || [])].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

export function createSaves({ run, level, save, events, settings, ui, storage = localStore } = {}) {
  void settings;
  const slots = createSlotStore({ storage });
  const emit = (p) => events?.emit?.(EV.SAVE, p);
  const title = () => ui?.title ?? null;
  const fail = (code, extra = {}, detail = '') => {
    const r = { ok: false, code, message: messageOf(code, detail), ...extra };
    if (extra.kind) emit({ kind: extra.kind, slot: extra.slot ?? null, ok: false, message: r.message, code });
    return r;
  };
  const refresh = () => { try { title()?.refresh?.(); } catch { /* the title card is optional */ } };
  let failNote = false;          // a load-failed note on the title card (an unreadable autosave's note waits for it)

  // ---- the rows ----
  function autoEntry() {
    const d = run?.autosave?.() ?? null;
    const inPlay = level?.mode === 'level' || level?.mode === 'result';
    if (d && d.blob) return { slot: 'auto', empty: false, meta: metaOf({ run: d.run, blob: d.blob }), savedAt: d.savedAt ?? null, chars: run.store?.chars?.() || 0, inPlay };
    const err = run?.store?.keyError?.() ?? null;
    if (err) return { slot: 'auto', empty: false, meta: null, savedAt: null, chars: run.store?.chars?.() || 0, error: err, message: messageOf(err) };
    const i = save?.info?.() ?? null;   // a Phase 2 player's brooding-week save (Continue makes it a run)
    if (i) return { slot: 'auto', empty: false, meta: metaOf({ run: null, blob: { level: { levelId: 'level1' }, env: { day: i.day + (i.hour ?? 0) / 24, hour: i.hour ?? 0 }, farm: {} } }), savedAt: i.savedAt ?? null, chars: 0, phase2: true, inPlay };
    return { slot: 'auto', empty: true, meta: null, savedAt: null, chars: 0 };
  }
  const slotEntry = (r) => (r.error ? { ...r, message: messageOf(r.error) } : r);
  const readable = (e) => e && !e.empty && !e.error;
  function latest() {
    let best = null;
    for (const e of api.list()) if (readable(e) && (!best || (e.savedAt ?? -1) > (best.savedAt ?? -1))) best = e;
    return best;
  }

  // ---- the farm now as an envelope ----
  function profileNow() {
    try { const p = save?.loadProfile?.(); if (p) return p; } catch { /* storage blocked */ }
    try { return level?.profile ? { ...level.profile.snapshot(), ...level.profile.cycles() } : null; } catch { return null; }
  }
  /** The run's whole save (run.exportSave writes the autosave first), else a lone brooding week or a Phase 2 save. */
  function envelopeNow({ farmOnly = false, profile = null } = {}) {
    const ex = run?.exportSave?.() ?? null;
    if (ex && ex.blob) return makeEnvelope({ run: ex.run, blob: ex.blob, starts: farmOnly ? [] : ex.starts, profile, savedAt: Date.now() });
    if (level?.mode === 'level' && !level.inRun && level.saveBlob) {
      const blob = JSON.parse(JSON.stringify(level.saveBlob()));
      blob.level = { ...blob.level, levelId: blob.level?.levelId || 'level1' };
      return makeEnvelope({ run: null, blob, starts: [], profile, savedAt: Date.now() });
    }
    const p2 = save?.load?.();
    return p2 ? { ...migrate(p2), profile } : null;
  }
  async function envelopeOfText(text) {
    const t = String(text ?? '').trim();
    let env;
    if (t.startsWith('{')) {
      // a raw JSON of the Phase 3-4 run key, the Phase 2 level save or a stored slot (a player who copied his storage by hand)
      let obj;
      try { obj = JSON.parse(t); } catch { throw new SaveError(/CF\d+\./.test(t) ? 'not-a-save' : 'incomplete', 'json'); }
      env = obj && obj.format === SAVE_SLOTS.format && obj.data != null && obj.blob == null ? await unpackStored(obj) : migrate(obj);
      from.v = obj?.format === SAVE_SLOTS.format ? obj.v : obj?.version ?? null;
    } else {
      const obj = await decodePayload(parseText(t));
      from.v = obj?.format === SAVE_SLOTS.format ? obj.v : obj?.version ?? null;
      env = migrate(obj);
    }
    const bad = checkEnvelope(env);
    if (bad) throw new SaveError(bad);
    return env;
  }
  const from = { v: null };   // the format the last pasted text held (1, 3 or 5: the restore box says a migration happened)
  function profileOffer(p) {
    if (!p) return false;
    const local = profileNow(), m = mergeProfiles(local, p);
    return !local || earnedKey(m) !== earnedKey(local) || (m.cyclesDone || 0) > (local.cyclesDone || 0)
      || Object.entries(m.conditionsDone || {}).some(([k, n]) => n > ((local.conditionsDone || {})[k] || 0));
  }
  function mergeProfileIn(p) {
    const local = profileNow(), m = mergeProfiles(local, p);
    if (!m) return false;
    // the level's profile in memory first (its skills and details; the cycle counts ride in the skills' part), then the store
    m.skills = { ...(m.skills || {}), cyclesDone: m.cyclesDone || 0, conditionsDone: { ...(m.conditionsDone || {}) } };
    try { level?.profile?.restore?.({ skills: m.skills, details: m.details }); } catch (err) { console.error('merging the skill points failed', err); }
    try { save?.saveProfile?.({ skills: m.skills, details: m.details, cyclesDone: m.cyclesDone, conditionsDone: m.conditionsDone }); } catch { /* storage blocked */ }
    return true;
  }

  /** Put an envelope in play: run.importSave (the four steps of §3.3), or the level alone without a run (Phase 2 tests). */
  function loadEnvelope(env, { memoryOnly = false, kind = 'load', slot = null } = {}) {
    let ok = false;
    try { ok = run ? run.importSave(env, { memoryOnly }) : !!level?.resume?.(env.blob); }
    catch (err) {
      // the resume began and threw: run.importSave went back to the title card and put the old keys back
      console.error('loading a save failed', err);
      try { if (level && level.mode !== 'title') { level.mode = 'title'; ui?.setMode?.('title'); } } catch { /* nothing more to do */ }
      failNote = true;
      try { title()?.note?.(SAVE_MESSAGES['load-failed']); } catch { /* optional */ }
      refresh();
      return fail('load-failed', { kind, slot });
    }
    if (!ok) return fail('load-failed', { kind, slot });
    failNote = false;
    try { title()?.note?.(null); } catch { /* optional */ }
    emit({ kind, slot, ok: true, message: null });
    return { ok: true, meta: env.meta, memoryOnly };
  }
  async function loadSlotNow(n, kind = 'load') {
    if (!isSlot(n)) return fail('invalid', { kind, slot: n });
    let st;
    try { st = slots.load(n); } catch (e) { return fail(e.code || 'damaged', { kind, slot: n }); }
    if (!st) return fail('empty', { kind, slot: n });
    let env;
    try { env = await unpackStored(st); } catch (e) { return fail(e.code || 'damaged', { kind, slot: n }, e.detail); }
    return loadEnvelope(env, { kind, slot: n });
  }

  // the autosave that cannot write (quota): once per level, through EV.SAVE (ui.js shows it)
  let autoFailedFor;
  run?.onSave?.((p) => {
    if (p.ok || !slots.available || autoFailedFor === p.levelId) return;
    autoFailedFor = p.levelId;
    emit({ kind: 'auto-failed', slot: 'auto', ok: false, message: SAVE_MESSAGES['auto-failed'], code: 'auto-failed' });
  });
  events?.on?.(EV.RUN, (p) => { if (p?.phase === 'level-start' || p?.phase === 'start') autoFailedFor = undefined; });

  const api = {
    stub: false,
    slots,
    get available() { return slots.available; },
    list() { return [autoEntry(), ...slots.list().map(slotEntry)]; },
    latest,
    latestInfo() {
      const auto = autoEntry(), e = latest();
      // the autosave key that does not read: Continue takes the newest slot and the title card says so
      if (auto.error && e && !failNote) { try { title()?.note?.(SAVE_MESSAGES['auto-unreadable']); } catch { /* optional */ } }
      if (!e) return null;
      if (e.slot === 'auto') { const i = run ? run.info() : save?.info?.(); return i ? { ...i, slot: 'auto' } : null; }
      const m = e.meta || {};
      return { levelId: m.levelId, title: m.levelTitle, short: `Slot ${e.slot}: ${m.levelShort || ''}`.trim(), levelShort: m.levelShort, day: m.day, hour: m.hour, savedAt: e.savedAt,
        run: true, condition: m.condition ?? null, conditionLabel: m.conditionLabel ?? null, slot: e.slot, slotLabel: `Slot ${e.slot}`, name: m.name };
    },
    continueLatest() {
      const e = latest();
      if (!e || e.slot === 'auto') return api.continueAuto();
      return loadSlotNow(e.slot, 'load').then((r) => !!r.ok);
    },
    continueAuto() {
      if (autoEntry().error) return false;
      return run ? run.continueSave() : !!level?.continueSave?.();
    },
    async saveSlot(n) {
      if (!isSlot(n)) return fail('invalid', { kind: 'slot', slot: n });
      if (level?.mode === 'sandbox') return fail('no-game', { kind: 'slot', slot: n });
      if (!slots.available) return fail('blocked', { kind: 'slot', slot: n });
      const env = envelopeNow();
      if (!env) return fail('no-game', { kind: 'slot', slot: n });
      const w = slots.write(n, await packEnvelope(env));
      if (!w.ok) return fail(w.code, { kind: 'slot', slot: n });
      emit({ kind: 'slot', slot: n, ok: true, message: null });
      refresh();
      return { ok: true, meta: env.meta, chars: w.chars };
    },
    async loadSlot(n) { const r = await loadSlotNow(n, 'load'); refresh(); return r; },
    deleteSlot(n) {
      if (!isSlot(n)) return fail('invalid', { kind: 'delete', slot: n });
      const r = slots.remove(n);
      if (!r.ok) return fail(r.code, { kind: 'delete', slot: n });
      emit({ kind: 'delete', slot: n, ok: true, message: null });
      refresh();
      return { ok: true };
    },
    async exportText(n, { farmOnly = false } = {}) {
      let env;
      const profile = profileNow();
      if (n === 'auto') env = envelopeNow({ farmOnly, profile });
      else {
        if (!isSlot(n)) return { ...fail('invalid', { kind: 'backup', slot: n }), text: '', parts: [] };
        let st;
        try { st = slots.load(n); } catch (e) { return { ...fail(e.code || 'damaged', { kind: 'backup', slot: n }), text: '', parts: [] }; }
        if (!st) return { ...fail('empty', { kind: 'backup', slot: n }), text: '', parts: [] };
        try { env = await unpackStored(st); } catch (e) { return { ...fail(e.code || 'damaged', { kind: 'backup', slot: n }), text: '', parts: [] }; }
        env = { ...env, starts: farmOnly ? [] : env.starts || [], profile };
      }
      if (!env) return { ...fail('no-game', { kind: 'backup', slot: n }), text: '', parts: [] };
      const p = await encodePayload(env), meta = { ...env.meta, savedAt: env.savedAt };
      const parts = composeParts({ meta, ...p }), text = parts.length === 1 ? parts[0] : parts.join('\n\n');
      emit({ kind: 'backup', slot: n, ok: true, message: null });
      return { ok: true, text, parts, chars: parts.length === 1 ? text.length : composeText({ meta, ...p }).length, payloadChars: p.data.length, enc: p.enc,
        meta: env.meta, starts: (env.starts || []).length, farmOnly };
    },
    async previewText(text) {
      try { const env = await envelopeOfText(text); return { ok: true, meta: env.meta, starts: (env.starts || []).length, profileOffer: profileOffer(env.profile), from: from.v }; }
      catch (e) { return { ok: false, code: e.code || 'damaged', message: messageOf(e.code || 'damaged', e.detail), detail: e.detail || '' }; }
    },
    async importText(text, n, { mergeProfile = false } = {}) {
      let env;
      try { env = await envelopeOfText(text); } catch (e) { return fail(e.code || 'damaged', { kind: 'restore', slot: n, detail: e.detail || '' }, e.detail); }
      if (mergeProfile && env.profile) mergeProfileIn(env.profile);
      if (n === 'play') { const r = loadEnvelope(env, { memoryOnly: !slots.available, kind: 'restore', slot: 'play' }); refresh(); return r; }
      if (!isSlot(n)) return fail('invalid', { kind: 'restore', slot: n });
      if (!slots.available) return fail('blocked', { kind: 'restore', slot: n });
      const w = slots.write(n, await packEnvelope({ ...env, profile: null }));
      if (!w.ok) return fail(w.code, { kind: 'restore', slot: n });
      emit({ kind: 'restore', slot: n, ok: true, message: null });
      refresh();
      return { ok: true, meta: env.meta, starts: (env.starts || []).length, migrated: from.v !== SAVE_SLOTS.version, from: from.v, profileOffer: profileOffer(env.profile) };
    },
    message: (code) => SAVE_MESSAGES[code] || SAVE_MESSAGES.damaged,
    debug: {
      slotChars: (n) => slots.chars(n),
      /** A slot that does not parse (the steps files: its row says the save is damaged and offers Delete only). */
      corrupt(n) {
        try { const s = typeof storage === 'function' ? storage() : storage; s.setItem(slots.keyOf(n), '{"format":"chicken-farm-save","v":5,"meta":{"name":"x"},"enc":"gz64","data":"H4sI'); return true; } catch { return false; }
      },
    },
  };
  return api;
}
