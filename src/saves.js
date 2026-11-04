// Saves, the game side (PHASE5.md §3): the autosave (run.js's run key and level starts, unchanged since Phase 3), three
// save slots, Continue (always the newest readable save), backups as text and their restore, and the messages a player
// reads when a save cannot be read. main.js creates it after the run (ctx.saves); ui-saves.js draws the panel.
// Owner after the design round: package "saves". This file is the design round's STUB: Continue and the Continue line
// are Phase 4's (the autosave only); every slot and backup call answers { ok: false, code: 'not-built' }.
//
// createSaves({ run, level, save, events, settings, ui }) -> saves
//   available                     storage works (slots need it; a backup as text works without it)
//   list()                        [{ slot: 'auto' | 1 | 2 | 3, empty, meta, savedAt, chars, error? }] (meta: save-slots.js metaOf)
//   latest()                      the newest readable entry of list() (Continue), or null
//   latestInfo()                  the title card's Continue line: run.info()'s shape plus { slot } (null: no save)
//   continueLatest()              resume the newest save: true when a level runs after it (a slot is loaded into the autosave first)
//   async saveSlot(n)             the game now (or the autosave from the title card) into slot n: { ok, code?, message?, meta }
//   async loadSlot(n)             slot n into the autosave, then resume it: { ok, code?, message? }
//   deleteSlot(n)                 { ok }
//   async exportText(n | 'auto')  the backup text: { ok, text, chars, meta } (the panel copies it inside the click)
//   async importText(text, n)     a pasted backup into slot n: { ok, code?, message?, meta, migrated? }
//   message(code)                 SAVE_MESSAGES[code]
// Events: EV.SAVE { kind, slot, ok, message } after every slot, load, delete, backup and restore.
import { EV } from './events.js';
import { SAVE_SLOTS } from './config.js';
import { SAVE_MESSAGES } from './save-codec.js';

const NOT_BUILT = { ok: false, code: 'not-built', message: 'Save slots come with the saves package (PHASE5.md §3).' };

export function createSaves({ run, level, save, events } = {}) {
  void level; void save;
  const emit = (p) => events?.emit?.(EV.SAVE, p);
  const autoEntry = () => {
    const i = run?.info?.();
    return { slot: 'auto', empty: !i, meta: i ? { levelId: i.levelId, short: i.short, day: i.day, hour: i.hour, condition: i.condition ?? null, conditionLabel: i.conditionLabel ?? null } : null, savedAt: i?.savedAt ?? null };
  };
  const api = {
    stub: true,
    get available() { return !!run?.available; },
    list() {
      const out = [autoEntry()];
      for (let n = 1; n <= SAVE_SLOTS.count; n++) out.push({ slot: n, empty: true, meta: null, savedAt: null });
      return out;
    },
    latest() { const a = autoEntry(); return a.empty ? null : a; },
    latestInfo() { const i = run?.info?.(); return i ? { ...i, slot: 'auto' } : null; },
    continueLatest() { return run ? run.continueSave() : !!level?.continueSave?.(); },
    async saveSlot(n) { emit({ kind: 'slot', slot: n, ok: false, message: NOT_BUILT.message }); return { ...NOT_BUILT }; },
    async loadSlot(n) { emit({ kind: 'load', slot: n, ok: false, message: NOT_BUILT.message }); return { ...NOT_BUILT }; },
    deleteSlot(n) { emit({ kind: 'delete', slot: n, ok: false, message: NOT_BUILT.message }); return { ...NOT_BUILT }; },
    async exportText(n) { void n; return { ...NOT_BUILT, text: '' }; },
    async importText(text, n) { void text; void n; return { ...NOT_BUILT }; },
    message: (code) => SAVE_MESSAGES[code] || NOT_BUILT.message,
  };
  return api;
}
