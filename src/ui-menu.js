// The game menu (PHASE5.md §4.2, §6.6): Esc with no panel open in a level, or the gear key on the time bar. The farm clock
// stands still while it is open (panel kind 'paused'). Each package adds its own entry, so no package edits another's
// file: experience adds Resume, the farm map and Back to the title card (ui.js), saves adds Save or load (ui-saves.js),
// settings adds Settings and How to play (ui-settings.js, ui-guide.js). Owner after the design round: package
// "experience" (look, focus order); add() and the entry shape are the frozen contract.
//
//   const menu = createGameMenu({ register, openPanel, closePanel, events, mode, keys })
//   menu.add({ id, label, icon?, hint?, order, onSelect(via), visible?(mode) })   hint: an action id of keys.js ('map') or a
//                          key's words; via = { returnTo: 'menu' }: an entry that opens a panel passes it on
//                          (openPanel(id, via)), so closing that panel comes back to the menu (review round, §8.6); the
//                          menu closes itself after onSelect when it is still the open panel ("Back to the farm")
//   menu.open(from)        'esc' | 'gear' | 'hook' (EV.MENU { open: true, from })
//   menu.entries()         the entries shown now [{ id, label }] (tests)
import { h, button, uniqueId, injectStyle, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { EV } from './events.js';

export const MENU_ID = 'menu';
// the menu's own look (PHASE5.md §8.11; the shared frame .menu-case / .menu-head is the template's)
const MENU_CSS = `
.menu { --p5-w: 440px; }
.menu-head { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; align-items: center; padding-right: 92px; }
.menu-head .icon { font-size: 26px; color: var(--accent); grid-row: span 2; }
.menu-head h2 { margin: 0; }
.menu-where { margin: 0; color: var(--ink-dim); font: 600 13px/1.35 var(--font-display); letter-spacing: 0.03em; }
.menu-note { margin: 10px 0 12px; color: var(--ink-dim); font-size: 13px; line-height: 1.45; }
.menu-list { gap: 6px; }
.menu-item { width: 100%; justify-content: flex-start; min-height: 44px; }
.menu-item .menu-label { flex: 1; text-align: left; }
.menu-item .kbd { height: 22px; min-width: 22px; font-size: 12px; background: var(--panel-raised-hi); color: var(--ink); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.3); }
.menu-item[data-menu="resume"] { border-color: var(--accent); }
.menu-item[data-menu="title"] { margin-top: 6px; }
`;

// isOpen(): the menu is the open panel now (ui.js: panels.openId === 'menu')
// where(): the farm's day, time and level in words for the menu's head ("Day 3 · 07:00 · Level 2 – The brooding week")
export function createGameMenu({ register, openPanel, closePanel, events = null, mode = () => 'level', keys = null, isOpen = null, where = null }) {
  injectStyle('menu-style', MENU_CSS);
  const items = [];
  let list = null, lastFrom = 'hook', lastPick = null, menuWhere = () => {};
  const hintOf = (hint) => { if (!hint) return null; try { return keys?.label?.(hint) || hint; } catch { return hint; } };
  function render() {
    if (!list) return;
    const m = mode();
    const shown = items.filter((it) => !it.visible || it.visible(m)).sort((a, b) => a.order - b.order);
    list.replaceChildren(...shown.map((it) => {
      const b = button({ class: 'btn btn--big menu-item', 'data-menu': it.id },
        it.icon && ICONS[it.icon] ? h('span', { html: ICONS[it.icon], 'aria-hidden': 'true' }) : null,
        h('span', { class: 'menu-label' }, it.label),
        it.hint ? h('kbd', { class: 'kbd' }, hintOf(it.hint)) : null);
      b.addEventListener('click', () => {
        lastPick = it.id;
        try { it.onSelect({ returnTo: MENU_ID }); } catch (err) { console.error(`menu ${it.id} failed`, err); }
        if (isOpen?.()) closePanel({ all: true });
      });
      return h('li', null, b);
    }));
  }
  register(MENU_ID, () => {
    const titleId = uniqueId('menu-title');
    const { el, closeBtn } = dialogShell('menu', titleId, () => closePanel());
    list = h('ul', { class: 'menu-list' });
    const whereLine = h('p', { class: 'menu-where' });
    el.append(h('div', { class: 'menu-case card' },
      h('header', { class: 'menu-head' }, h('span', { html: ICONS.gear, 'aria-hidden': 'true' }), h('h2', { id: titleId }, 'Paused'), whereLine),
      h('p', { class: 'menu-note' }, 'The farm clock stands still while this menu is open.'),
      list), closeBtn);
    menuWhere = () => { let t = ''; try { t = where?.() || ''; } catch { t = ''; } setText(whereLine, t); whereLine.hidden = !t; };
    // the focus: the entry picked last (back from Settings: on Settings), else the first
    const focusEntry = () => (list?.querySelector(`[data-menu="${lastPick}"]`) || list?.querySelector('button'))?.focus({ preventScroll: true });
    return {
      el,
      onOpen() { render(); menuWhere(); events?.emit?.(EV.MENU, { open: true, from: lastFrom }); queueMicrotask?.(focusEntry); },
      onClose() { events?.emit?.(EV.MENU, { open: false, from: lastFrom }); },
      // the ui.js key hook (§8.6): the up and down arrows move between the entries
      onKey(e) {
        if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return false;
        const bs = [...(list?.querySelectorAll('button') || [])];
        if (!bs.length) return false;
        const i = bs.indexOf(document.activeElement), d = e.code === 'ArrowDown' ? 1 : -1;
        bs[(i < 0 ? 0 : i + d + bs.length) % bs.length].focus({ preventScroll: true });
        e.preventDefault();
        return true;
      },
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
    open(from = 'hook') { lastFrom = from; lastPick = null; return openPanel(MENU_ID); },
    entries() { const m = mode(); return items.filter((it) => !it.visible || it.visible(m)).sort((a, b) => a.order - b.order).map((it) => ({ id: it.id, label: it.label })); },
  };
}
