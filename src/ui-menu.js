// The game menu (PHASE5.md §4.2, §6.6): Esc with no panel open in a level, or the gear key on the time bar. The farm clock
// stands still while it is open (panel kind 'paused'). Each package adds its own entry, so no package edits another's
// file: experience adds Resume, the farm map and Back to the title card (ui.js), saves adds Save or load (ui-saves.js),
// settings adds Settings and How to play (ui-settings.js, ui-guide.js). Owner after the design round: package
// "experience" (look, focus order); add() and the entry shape are the frozen contract.
//
//   const menu = createGameMenu({ register, openPanel, closePanel, events, mode })
//   menu.add({ id, label, icon?, hint?, order, onSelect(), visible?(mode) })   hint: the key shown beside it ('Tab')
//   menu.open(from)        'esc' | 'gear' | 'hook' (EV.MENU { open: true, from })
//   menu.entries()         the entries shown now [{ id, label }] (tests)
import { h, button, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { EV } from './events.js';

export const MENU_ID = 'menu';

export function createGameMenu({ register, openPanel, closePanel, events = null, mode = () => 'level' }) {
  const items = [];
  let list = null, lastFrom = 'hook';
  function render() {
    if (!list) return;
    const m = mode();
    const shown = items.filter((it) => !it.visible || it.visible(m)).sort((a, b) => a.order - b.order);
    list.replaceChildren(...shown.map((it) => {
      const b = button({ class: 'btn btn--big menu-item', 'data-menu': it.id },
        it.icon && ICONS[it.icon] ? h('span', { html: ICONS[it.icon], 'aria-hidden': 'true' }) : null,
        h('span', { class: 'menu-label' }, it.label),
        it.hint ? h('kbd', { class: 'kbd' }, it.hint) : null);
      b.addEventListener('click', () => { closePanel(); try { it.onSelect(); } catch (err) { console.error(`menu ${it.id} failed`, err); } });
      return h('li', null, b);
    }));
  }
  register(MENU_ID, () => {
    const titleId = uniqueId('menu-title');
    const { el, closeBtn } = dialogShell('menu', titleId, () => closePanel());
    list = h('ul', { class: 'menu-list' });
    el.append(h('div', { class: 'menu-case card' },
      h('header', { class: 'menu-head' }, h('h2', { id: titleId }, 'Paused'), h('p', null, 'The farm clock stands still while this menu is open.')),
      list), closeBtn);
    return {
      el,
      onOpen() { render(); events?.emit?.(EV.MENU, { open: true, from: lastFrom }); queueMicrotask?.(() => list?.querySelector('button')?.focus({ preventScroll: true })); },
      onClose() { events?.emit?.(EV.MENU, { open: false, from: lastFrom }); },
    };
  }, { kind: 'paused' });
  return {
    id: MENU_ID,
    add(entry) {
      const it = { order: 50, ...entry };
      const i = items.findIndex((x) => x.id === it.id);
      if (i >= 0) items.splice(i, 1, it); else items.push(it);
      render();
      return () => { const j = items.indexOf(it); if (j >= 0) items.splice(j, 1); render(); };
    },
    open(from = 'hook') { lastFrom = from; return openPanel(MENU_ID); },
    entries() { const m = mode(); return items.filter((it) => !it.visible || it.visible(m)).sort((a, b) => a.order - b.order).map((it) => ({ id: it.id, label: it.label })); },
  };
}
