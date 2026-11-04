// The saves panel (PHASE5.md §3.9): the autosave and the three slots, each named by condition, level, day and time;
// Save here, Load, Delete (asked again inside the panel, never confirm()), Back up as text (copied inside the click, with
// a select-the-text fallback) and Restore from a pasted backup. Opened from the title card ("Load a saved farm") and the
// game menu ("Save or load"). Owner after the design round: package "saves". This is the design round's STUB: the rows
// and Continue work on Phase 4's autosave; the slot keys are drawn disabled.
//
//   registerSavesPanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'saves', open() }
import { h, button, uniqueId, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { slotName } from './save-slots.js';

export const SAVES_ID = 'saves';

export function registerSavesPanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  const saves = () => ctx.saves || null;
  register(SAVES_ID, () => {
    const titleId = uniqueId('saves-title');
    const { el, closeBtn } = dialogShell('saves', titleId, () => closePanel());
    const rows = h('ul', { class: 'saves-list' });
    const note = h('p', { class: 'saves-note', role: 'status' });
    el.append(h('div', { class: 'saves-case card' },
      h('header', { class: 'saves-head' }, h('span', { html: ICONS.save, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Save or load'),
        h('p', null, 'The game saves by itself as you play (the autosave). Keep a farm in a slot to come back to it later.'))),
      rows, note), closeBtn);
    function render() {
      const s = saves();
      const list = s ? s.list() : [];
      rows.replaceChildren(...list.map((r) => {
        const name = r.empty ? 'Empty' : r.meta?.name || slotName(r.meta ? { ...r.meta, levelTitle: r.meta.levelTitle || r.meta.short } : null);
        const when = r.savedAt ? new Date(r.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const keys = [];
        if (r.slot === 'auto' && !r.empty) {
          const c = button({ class: 'btn btn--accent' }, 'Continue');
          c.addEventListener('click', () => { closePanel(); s?.continueLatest?.(); });
          keys.push(c);
        } else if (r.slot !== 'auto') {
          for (const t of ['Save here', 'Load', 'Delete', 'Back up', 'Restore']) keys.push(button({ class: 'btn', disabled: '' }, t));
        }
        return h('li', { class: 'saves-row', 'data-slot': String(r.slot) },
          h('div', { class: 'saves-what' }, h('p', { class: 'saves-k label' }, r.slot === 'auto' ? 'Autosave' : `Slot ${r.slot}`), h('p', { class: 'saves-name' }, name),
            when ? h('p', { class: 'saves-when' }, `saved ${when}`) : null),
          h('div', { class: 'saves-keys' }, keys));
      }));
      setText(note, s?.stub ? 'Save slots, backups and restores come with the saves package (PHASE5.md §3).' : '');
    }
    return { el, onOpen: render, update() {} };
  }, { kind: 'paused' });
  menu?.add?.({ id: 'saves', label: 'Save or load', icon: 'save', order: 30, onSelect: () => openPanel(SAVES_ID) });
  title?.addAction?.({ id: 'saves', label: 'Load a saved farm', icon: 'save', order: 10, onClick: () => openPanel(SAVES_ID) });
  return { id: SAVES_ID, open: () => openPanel(SAVES_ID) };
}
