// The saves panel (PHASE5.md §3.9): the autosave and the three slots, each named by condition, level, day and time;
// Save here, Load, Delete (asked again inside the panel, never confirm()), Back up as text (copied inside the click, with
// a select-the-text fallback) and Restore from a pasted backup (every part, in any order). Opened from the title card
// ("Load a saved farm"), the game menu ("Save or load") and over a result. Owner: package "saves".
//
//   registerSavesPanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'saves', open(via?) }
//   (via: { returnTo: 'menu' | 'result' }: closing the panel comes back there, PHASE5.md §8.6; the in-panel question takes
//   Esc through the panel's onKey: Esc answers its safe answer and the panel stays open)
// Frozen DOM hooks (§8.10): [data-slot] rows, [data-save-key] row keys, [data-answer="yes" | "no"], [data-copy-part],
// [data-restore-box]; the panel's own extra hooks: [data-backup-kind="whole" | "farm"], [data-restore-go], [data-restore-slot].
import { h, button, uniqueId, setText, injectStyle } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { SAVE_SLOTS } from './config.js';

export const SAVES_ID = 'saves';
// the saves screen's own rules (PHASE5.md §8.11: each package styles its own screens; the frame is the template's)
const SAVES_CSS = `
.saves { --p5-w: 720px; }
.saves .saves-head { padding-right: 132px; }
.saves-blocked { margin: 0 0 10px; padding: 8px 10px; border-radius: 6px; background: rgba(231, 182, 70, 0.14); border: 1px solid rgba(231, 182, 70, 0.4); color: var(--ink); font-size: 13px; line-height: 1.4; }
.saves-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.saves-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; padding: 9px 12px; border-radius: 6px; background: var(--panel-sunk); border: 1px solid transparent; }
.saves-row.is-asking { border-color: var(--accent); }
.saves-row[data-error] { border-color: rgba(240, 102, 74, 0.55); }
.saves-what { min-width: 0; }
.saves-k { margin: 0; display: flex; gap: 8px; align-items: baseline; }
.saves-tag { font: 600 11px/1 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.saves-name { margin: 3px 0 0; font: 600 14px/1.3 var(--font-display); color: var(--ink); overflow-wrap: anywhere; }
.saves-name.is-empty { color: var(--ink-faint); font-weight: 500; }
.saves-when { margin: 2px 0 0; font-size: 12px; color: var(--ink-dim); }
.saves-msg { margin: 4px 0 0; font-size: 13px; line-height: 1.4; color: var(--ink); }
.saves-keys { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.saves-keys .btn, .saves-ask .btn, .saves-box .btn { min-height: 30px; padding: 4px 10px; font-size: 12px; }
.saves-ask { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.saves-ask p { margin: 0; flex: 1 1 280px; font-size: 13px; line-height: 1.4; color: var(--ink); }
.saves-box { grid-column: 1 / -1; display: grid; gap: 8px; padding: 10px 12px; border-radius: 6px; background: rgba(8, 15, 11, 0.38); border: 1px dashed var(--panel-edge); max-height: min(200px, 34vh); overflow: auto; overscroll-behavior: contain; }
.saves-box p { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--ink-dim); }
.saves-box .saves-status { color: var(--ink); font-size: 13px; }
.saves-box-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.saves-parts { display: flex; flex-wrap: wrap; gap: 6px; }
.saves-parts .btn.is-copied { border-color: var(--ok); }
.saves-text { width: 100%; min-height: 76px; box-sizing: border-box; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--panel-edge); background: var(--panel-solid); color: var(--ink); font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
.saves-select { min-height: 30px; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--panel-edge); background: var(--panel-raised); color: var(--ink); font: 600 12px var(--font-display); }
.saves-check { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--ink); }
.saves-note { margin: 10px 0 0; min-height: 18px; color: var(--ink-dim); font-size: 13px; line-height: 1.4; }
@media (max-width: 700px) { .saves-row { grid-template-columns: minmax(0, 1fr); } .saves-keys { justify-content: flex-start; } }
`;

const KB = (n) => `${Math.max(1, Math.round(n / 1024)).toLocaleString('en')} KB`;
const savedWhen = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
/** "Week 2 · Day 12, 08:40" — the level and the day part of a slot's name (the questions name the farm by it). */
export function shortName(meta) {
  if (!meta) return '';
  const day = String(meta.name || '').split(' · ').slice(-1)[0];
  return [meta.levelShort, day].filter(Boolean).join(' · ');
}
const rowLabel = (slot) => (slot === 'auto' ? 'Autosave' : `Slot ${slot}`);
/** "About 214,000 characters: 25 parts of up to 9,000 characters each". */
export function lengthWords(chars, parts) {
  const about = (chars < 10000 ? Math.round(chars / 100) * 100 : Math.round(chars / 1000) * 1000).toLocaleString('en');
  return parts > 1 ? `About ${about} characters: ${parts} parts of up to ${SAVE_SLOTS.partChars.toLocaleString('en')} characters each.` : `About ${about} characters: one part.`;
}

/** The backup box (PHASE5.md §3.5): the text built when the box opens, one Copy key per part, the select fallback. */
function backupBox(saves, slot, { onDone } = {}) {
  const status = h('p', { class: 'saves-status', role: 'status' }, 'Preparing the backup…');
  const kinds = [['whole', 'The whole run'], ['farm', 'This farm only']].map(([k, label]) => button({ class: 'btn', 'aria-pressed': k === 'whole' ? 'true' : 'false', 'data-backup-kind': k }, label));
  const what = h('p', null);
  const parts = h('div', { class: 'saves-parts', role: 'group', 'aria-label': 'Copy the backup' });
  const ta = h('textarea', { class: 'saves-text', readonly: '', rows: 4, spellcheck: 'false', 'aria-label': 'The backup text' });
  const fallback = h('div', { class: 'saves-fallback', hidden: '' }, h('p', null, 'Press Ctrl+C (⌘C on a Mac) to copy, then keep it somewhere safe.'), ta);
  const el = h('div', { class: 'saves-box', 'data-box': 'backup' },
    h('div', { class: 'seg saves-box-row', role: 'group', 'aria-label': 'What the backup holds' }, ...kinds), status, what, parts, fallback,
    h('p', null, 'Keep every part somewhere safe (a note, or a chat with yourself). To bring the farm back, paste every part, in any order, into Restore.'));
  let built = null, token = 0, farmOnly = false;
  async function build() {
    const my = ++token;
    built = null;
    setText(status, 'Preparing the backup…'); setText(what, ''); parts.replaceChildren(); fallback.hidden = true;
    for (const b of kinds) b.setAttribute('aria-pressed', String((b.dataset.backupKind === 'farm') === farmOnly));
    let r;
    try { r = await saves.exportText(slot, { farmOnly }); } catch (err) { console.error('backup failed', err); r = { ok: false, message: saves.message('damaged') }; }
    if (my !== token) return;
    if (!r.ok) { setText(status, r.message); return; }
    built = r;
    setText(status, lengthWords(r.chars, r.parts.length));
    setText(what, farmOnly ? 'This farm only: the farm as it is now, without the level starts. After a restore, a Replay of an earlier level starts from that level’s standard start.'
      : `The whole run: the farm now and its ${r.starts} level start${r.starts === 1 ? '' : 's'}, so every Replay on the run card works after a restore.`);
    parts.replaceChildren(...r.parts.map((_, i) => {
      const b = button({ class: 'btn', 'data-copy-part': String(i + 1) }, r.parts.length > 1 ? `Copy part ${i + 1}` : 'Copy');
      b.addEventListener('click', () => copy(i, b));
      return b;
    }));
    onDone?.();
  }
  /** navigator.clipboard.writeText inside the click, with the text already built (Safari refuses one after an await). */
  function copy(i, btn) {
    if (!built) return;
    const text = built.parts[i], n = built.parts.length;
    const said = n > 1 ? `Part ${i + 1} of ${n} is on the clipboard: paste it somewhere safe, then copy the next part.` : 'The backup is on the clipboard: paste it somewhere safe.';
    const done = () => { setText(status, said); btn.classList.add('is-copied'); fallback.hidden = true; };
    let p = null;
    try { p = navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ? navigator.clipboard.writeText(text) : null; } catch { p = null; }
    if (p && typeof p.then === 'function') p.then(done, () => showText(i, btn));
    else showText(i, btn);
  }
  function showText(i, btn) {
    const n = built.parts.length;
    ta.value = built.parts[i];
    fallback.hidden = false;
    ta.focus({ preventScroll: true }); ta.select();
    let copied = false;
    try { copied = document.execCommand && document.execCommand('copy'); } catch { copied = false; }
    setText(status, copied ? `${n > 1 ? `Part ${i + 1} of ${n}` : 'The backup'} is on the clipboard (the text shows below too).`
      : `${n > 1 ? `Part ${i + 1} of ${n}` : 'The backup'} shows below, selected: press Ctrl+C (⌘C on a Mac) to copy it.`);
    if (copied) btn.classList.add('is-copied');
    ta.scrollIntoView?.({ block: 'nearest' });
  }
  for (const b of kinds) b.addEventListener('click', () => { const f = b.dataset.backupKind === 'farm'; if (f !== farmOnly || !built) { farmOnly = f; build(); } });
  build();
  return { el, kind: 'backup', slot, get text() { return built?.text ?? ''; }, get parts() { return built?.parts ?? []; }, focus() { (parts.querySelector('button') || kinds[0]).focus({ preventScroll: true }); } };
}

/** The restore box (PHASE5.md §3.5): the pasted parts in any order read at once (what the backup holds), a slot, Restore;
 *  with storage blocked "Restore and play now" (the backup plays from memory until the page closes). */
function restoreBox(saves, slot, { blocked, rows, onRestore }) {
  const id = uniqueId('saves-paste');
  const ta = h('textarea', { id, class: 'saves-text', rows: 4, spellcheck: 'false', autocomplete: 'off', 'data-restore-box': '', placeholder: 'Paste a backup here (every part, in any order)' });
  const status = h('p', { class: 'saves-status', role: 'status' }, 'Paste the whole backup: every part, in any order. The lines before the first part may be left out.');
  const merge = h('input', { type: 'checkbox' });
  const mergeRow = h('label', { class: 'saves-check', hidden: '' }, merge, 'Also bring its skill points (the larger of each)');
  const pick = h('select', { class: 'saves-select', 'data-restore-slot': '', 'aria-label': 'The slot to restore into' });
  // an empty slot first, then the others; the row's own slot when it is empty
  const order = rows.filter((r) => r.slot !== 'auto').sort((a, b) => (a.empty === b.empty ? (a.slot === slot ? -1 : b.slot === slot ? 1 : a.slot - b.slot) : a.empty ? -1 : 1));
  for (const r of order) pick.append(h('option', { value: String(r.slot) }, `Slot ${r.slot}${r.empty ? ' (empty)' : r.error ? ' (cannot be read)' : ` (${shortName(r.meta)})`}`));
  const go = button({ class: 'btn btn--accent', 'data-restore-go': '' }, blocked ? 'Restore and play now' : 'Restore');
  const el = h('div', { class: 'saves-box', 'data-box': 'restore' },
    h('label', { for: id, class: 'label' }, 'Paste a backup here (every part, in any order)'), ta, status, mergeRow,
    h('div', { class: 'saves-box-row' }, blocked ? null : h('span', { class: 'saves-when' }, 'Into'), blocked ? null : pick, go),
    blocked ? h('p', null, 'Saving is off in this browser: the backup plays now, and is gone when the page closes. Back it up again as text before you close the page.') : null);
  let token = 0, timer = 0, preview = null;
  async function read() {
    const my = ++token, text = ta.value;
    if (!text.trim()) { preview = null; setText(status, 'Paste the whole backup: every part, in any order.'); mergeRow.hidden = true; return; }
    setText(status, 'Reading the backup…');
    const r = await saves.previewText(text);
    if (my !== token) return;
    preview = { ...r, text };
    if (!r.ok) { setText(status, r.message); mergeRow.hidden = true; return; }
    const holds = r.starts ? `the farm and ${r.starts} level start${r.starts === 1 ? '' : 's'}` : 'this farm only (no level starts)';
    setText(status, `This backup holds ${r.meta?.name || 'a farm'}: ${holds}.${r.from && r.from !== SAVE_SLOTS.version ? ' It was made by an earlier version of the game and is read as this version’s save.' : ''}`);
    mergeRow.hidden = !r.profileOffer;
  }
  ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(read, 200); });
  ta.addEventListener('paste', () => { clearTimeout(timer); timer = setTimeout(read, 50); });
  go.addEventListener('click', async () => {
    clearTimeout(timer);
    if (!preview || preview.text !== ta.value) await read();
    if (!preview?.ok) { ta.focus({ preventScroll: true }); return; }
    onRestore({ text: ta.value, slot: blocked ? 'play' : +pick.value, merge: !mergeRow.hidden && merge.checked, meta: preview.meta, go });
  });
  return { el, kind: 'restore', slot, focus() { ta.focus({ preventScroll: true }); }, setStatus(t) { setText(status, t); }, get value() { return ta.value; } };
}

export function registerSavesPanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  const saves = () => ctx.saves || null;
  const mode = () => ctx.level?.mode ?? 'title';
  injectStyle('saves-style', SAVES_CSS);
  register(SAVES_ID, () => {
    const titleId = uniqueId('saves-title');
    const { el, closeBtn } = dialogShell('saves', titleId, () => closePanel());
    const blockedNote = h('p', { class: 'saves-blocked', role: 'status', hidden: '' });
    const list = h('ul', { class: 'saves-list' });
    const note = h('p', { class: 'saves-note', role: 'status', 'aria-live': 'polite' });
    el.append(h('div', { class: 'saves-case card' },
      h('header', { class: 'saves-head' }, h('span', { class: 'icon', html: ICONS.save, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Save or load'),
        h('p', null, 'The game saves by itself as you play (the autosave). Keep a farm in a slot to come back to it, or back it up as text to keep it anywhere.'))),
      blockedNote, list, note), closeBtn);
    const st = { ask: null, box: null, busy: false, rows: [] };
    const say = (t) => setText(note, t || '');
    const keyOf = (slot, key) => list.querySelector(`[data-slot="${slot}"] [data-save-key="${key}"]`);

    function ask(slot, text, yes, no, onYes, from) {
      st.ask = { slot, text, yes, no, onYes, from: from?.dataset?.saveKey || null };
      render();
      list.querySelector(`[data-slot="${slot}"] [data-answer="yes"]`)?.focus({ preventScroll: true });
    }
    function answer(yes) {
      const a = st.ask;
      if (!a) return;
      st.ask = null;
      render();
      if (yes) a.onYes();
      else (a.from && keyOf(a.slot, a.from) || list.querySelector(`[data-slot="${a.slot}"] button:not([disabled])`))?.focus({ preventScroll: true });
    }
    async function act(label, fn) {
      if (st.busy) return null;
      st.busy = true; say(label); render();
      try { return await fn(); } catch (err) { console.error('saves action failed', err); say(saves()?.message('damaged')); return null; } finally { st.busy = false; render(); }
    }
    const inPlay = () => mode() === 'level' || mode() === 'result';
    const autoRow = () => st.rows.find((r) => r.slot === 'auto');

    function doSave(n) {
      act(`Saving in Slot ${n}…`, async () => {
        const r = await saves().saveSlot(n);
        say(r.ok ? `Saved in Slot ${n}: ${r.meta?.name}.` : r.message);
        return r;
      }).then(() => keyOf(n, 'save')?.focus({ preventScroll: true }));
    }
    async function doLoad(n) {
      // the whole chain closes first (the resume closes panels itself); a refused load opens the panel again with its words
      closePanel({ all: true });
      const r = await saves().loadSlot(n);
      if (!r.ok) { openPanel(SAVES_ID); say(r.message); }
    }
    function doDelete(n) {
      const r = n === 'auto' ? saves().deleteAuto() : saves().deleteSlot(n);
      say(r.ok ? (n === 'auto' ? 'The autosave is deleted.' : `Slot ${n} is empty now.`) : r.message);
      if (st.box?.slot === n) st.box = null;
      render();
      list.querySelector(`[data-slot="${n}"] button:not([disabled])`)?.focus({ preventScroll: true });
    }
    function toggleBox(slot, kind) {
      if (st.box && st.box.slot === slot && st.box.kind === kind) { st.box = null; render(); keyOf(slot, kind)?.focus({ preventScroll: true }); return; }
      const s = saves();
      st.box = kind === 'backup' ? backupBox(s, slot, { onDone: () => {} })
        : restoreBox(s, slot, { blocked: !s.available, rows: st.rows, onRestore: (o) => restore(slot, o) });
      render();
      st.box.focus();
    }
    function restore(fromRow, o) {
      const s = saves();
      if (o.slot === 'play') {
        closePanel({ all: true });
        s.importText(o.text, 'play', { mergeProfile: o.merge }).then((r) => { if (!r.ok) { openPanel(SAVES_ID); say(r.message); } });
        return;
      }
      const target = st.rows.find((r) => r.slot === o.slot);
      const run = () => act('Restoring…', async () => {
        const r = await s.importText(o.text, o.slot, { mergeProfile: o.merge });
        if (r.ok) { st.box = null; say(`Restored into Slot ${o.slot}: ${r.meta?.name}.${o.merge ? ' Its skill points are added (the larger of each).' : ''}`); }
        else { say(r.message); st.box?.setStatus?.(r.message); }
        return r;
      }).then(() => keyOf(o.slot, 'load')?.focus({ preventScroll: true }));
      if (target && !target.empty) ask(fromRow, `Save the backup over Slot ${o.slot} (${target.error ? 'a save that cannot be read' : shortName(target.meta)})?`, 'Save over it', 'Keep it', run, o.go);
      else run();
    }

    /** One row's keys (every key a <button>; a disabled key says why in its title). */
    function keysOf(r) {
      const s = saves(), out = [], sandbox = mode() === 'sandbox', auto = autoRow();
      const key = (k, label, why, onClick, accent = false) => {
        const b = button({ class: `btn${accent && !why ? ' btn--accent' : ''}`, 'data-save-key': k, disabled: why || st.busy ? '' : null, title: why || null }, label);
        b.addEventListener('click', () => { if (!b.disabled) onClick(b); });
        out.push(b);
      };
      const dayNow = String(auto?.meta?.name || '').split(' · ').slice(-1)[0];
      if (r.slot === 'auto') {
        if (r.error) { key('delete', 'Delete', '', (b) => ask('auto', 'Delete the autosave? It cannot be read. This cannot be undone.', 'Delete', 'Keep it', () => doDelete('auto'), b)); return out; }
        key('continue', 'Continue', r.empty ? 'No game is saved yet' : inPlay() ? 'This is the farm in play now' : '', () => { closePanel({ all: true }); s.continueAuto(); }, true);
        key('backup', 'Back up', r.empty && !inPlay() ? 'No game is saved yet' : '', () => toggleBox('auto', 'backup'));
        return out;
      }
      if (sandbox) return out;   // the Phase 1 farm keeps no slots
      if (r.error && r.error !== 'blocked') { key('delete', 'Delete', '', (b) => ask(r.slot, `Delete Slot ${r.slot} (a save that cannot be read)? This cannot be undone.`, 'Delete', 'Keep it', () => doDelete(r.slot), b)); return out; }
      const off = !s.available ? s.message('blocked') : '';
      const nothing = !inPlay() && (!auto || auto.empty || auto.error) ? s.message('no-game') : '';
      key('save', 'Save here', off || nothing, (b) => {
        if (r.empty) doSave(r.slot);
        else ask(r.slot, `Save over Slot ${r.slot} (${shortName(r.meta)})?`, 'Save over it', 'Keep it', () => doSave(r.slot), b);
      });
      key('load', 'Load', off || (r.empty ? s.message('empty') : ''), (b) => {
        if (!inPlay()) doLoad(r.slot);
        else ask(r.slot, `Load Slot ${r.slot} (${shortName(r.meta)})? The farm in play now${dayNow ? ` (${dayNow})` : ''} stays only if it is saved in a slot.`, 'Load it', 'Cancel', () => doLoad(r.slot), b);
      });
      key('delete', 'Delete', off || (r.empty ? s.message('empty') : ''), (b) => ask(r.slot, `Delete Slot ${r.slot} (${shortName(r.meta)})? This cannot be undone.`, 'Delete', 'Keep it', () => doDelete(r.slot), b));
      key('backup', 'Back up', off || (r.empty ? s.message('empty') : ''), () => toggleBox(r.slot, 'backup'));
      key('restore', 'Restore', '', () => toggleBox(r.slot, 'restore'));
      return out;
    }
    function rowEl(r) {
      const asking = st.ask && st.ask.slot === r.slot;
      const name = r.error ? 'A save that cannot be read' : r.empty ? (r.slot === 'auto' ? 'No game saved yet' : 'Empty') : r.meta?.name || 'A saved farm';
      const when = r.savedAt ? `saved ${savedWhen(r.savedAt)}${r.chars ? ` · ${KB(r.chars)}` : ''}` : '';
      const askEl = asking ? h('div', { class: 'saves-ask' }, h('p', { role: 'status' }, st.ask.text),
        button({ class: 'btn btn--accent', 'data-answer': 'yes', onclick: () => answer(true) }, st.ask.yes),
        button({ class: 'btn', 'data-answer': 'no', onclick: () => answer(false) }, st.ask.no)) : null;
      return h('li', { class: `saves-row${asking ? ' is-asking' : ''}`, 'data-slot': String(r.slot), 'data-error': r.error || null, 'data-empty': r.empty ? '' : null },
        h('div', { class: 'saves-what' },
          h('p', { class: 'saves-k' }, h('span', { class: 'label' }, rowLabel(r.slot)), r.slot === 'auto' && r.inPlay && !r.error ? h('span', { class: 'saves-tag' }, 'In play now') : null),
          h('p', { class: `saves-name${r.empty || r.error ? ' is-empty' : ''}` }, name),
          when ? h('p', { class: 'saves-when' }, when) : null,
          r.error && r.error !== 'blocked' ? h('p', { class: 'saves-msg', role: 'status' }, r.message) : null),
        askEl || h('div', { class: 'saves-keys' }, keysOf(r)),
        st.box && st.box.slot === r.slot ? st.box.el : null);
    }
    function render() {
      const s = saves();
      st.rows = s ? s.list() : [];
      blockedNote.hidden = !s || s.available;
      setText(blockedNote, s && !s.available ? s.message('blocked') : '');
      // the open box's element moves with its row (a paste in the restore box survives every redraw)
      list.replaceChildren(...st.rows.map(rowEl));
    }
    return {
      el,
      onOpen() { st.ask = null; st.box = null; st.busy = false; say(''); render(); },
      update() {},
      /** PHASE5.md §8.6: Esc answers an open question with its safe answer; the panel stays open. */
      onKey(e) {
        if (st.ask && (e.key === 'Escape' || e.code === 'Escape')) { e.preventDefault(); answer(false); return true; }
        return false;
      },
      /** Tests and the steps files: the panel's state. */
      state: () => ({ ask: st.ask ? { slot: st.ask.slot, text: st.ask.text } : null, box: st.box ? { slot: st.box.slot, kind: st.box.kind } : null, note: note.textContent, busy: st.busy }),
    };
  }, { kind: 'paused' });
  menu?.add?.({ id: 'saves', label: 'Save or load', icon: 'save', order: 30, onSelect: (via) => openPanel(SAVES_ID, via) });
  title?.addAction?.({ id: 'saves', label: 'Load a saved farm', icon: 'save', order: 10, onClick: () => openPanel(SAVES_ID) });
  return { id: SAVES_ID, open: (via) => openPanel(SAVES_ID, via) };
}

