// Controls legend, the "needs a keyboard and mouse" card for small screens, and the E prompt pill.
// Owner: systems/UI agent.
import { HELP_KEYS, promptVerb } from './content.js';
import { h, button, store, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

const HELP_SEEN_KEY = 'chicken-farm.help-dismissed';

export function createHelp(keys = HELP_KEYS, seenKey = HELP_SEEN_KEY) {
  const titleId = uniqueId('help-title');
  const list = h('dl', { class: 'help-list' });
  for (const row of keys) {
    const keys = row.keys.map((k) => h('kbd', { class: 'kbd' }, k));
    list.append(h('dt', null, keys), h('dd', null, row.what));
  }
  const closeBtn = button({ class: 'btn' }, 'Got it');
  // the level's longer list (Phase 3: L, V, C, M) reads in two columns so it stays low on a 600 px screen
  const card = h('section', { class: `card help${keys.length > 12 ? ' help--wide' : ''}`, 'aria-labelledby': titleId },
    h('div', { class: 'help-head' }, h('span', { html: ICONS.keyboard, 'aria-hidden': 'true' }),
      h('h2', { class: 'label', id: titleId }, 'Controls'), closeBtn),
    list);

  const toggleBtn = button({ class: 'btn btn--icon', 'aria-label': 'Show the controls (H)', title: 'Controls (H)', 'aria-expanded': 'false' }, '?');
  toggleBtn.style.fontSize = '16px';

  function set(show) {
    card.hidden = !show;
    toggleBtn.setAttribute('aria-expanded', String(show));
    toggleBtn.setAttribute('aria-label', show ? 'Hide the controls (H)' : 'Show the controls (H)');
  }
  closeBtn.addEventListener('click', () => { set(false); store.set(seenKey, '1'); });
  toggleBtn.addEventListener('click', () => toggle());
  function toggle() { set(card.hidden); if (card.hidden) store.set(seenKey, '1'); }

  set(store.get(seenKey) !== '1'); // shown on first load
  return { card, toggleBtn, toggle, get visible() { return !card.hidden; }, hide: () => set(false) };
}

// Overlay for phones and touch screens. "Look anyway" lets them see the farm.
export function createNarrowNotice(parent) {
  const query = typeof matchMedia === 'function' ? matchMedia('(max-width: 699px), (pointer: coarse)') : null;
  const titleId = uniqueId('narrow-title');
  const look = button({ class: 'btn' }, 'Look anyway');
  const el = h('div', { class: 'narrow', hidden: true },
    h('section', { class: 'card narrow-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('span', { html: ICONS.monitor, 'aria-hidden': 'true' }),
      h('h2', { id: titleId }, 'This farm needs a bigger screen'),
      h('p', null, 'Chicken Farm is played on a desktop or laptop computer with a keyboard and mouse. Open it there to walk the farm and run the house.'),
      look));
  parent.appendChild(el);
  let dismissed = false;
  look.addEventListener('click', () => { dismissed = true; sync(); });
  function sync() {
    const show = !!(query && query.matches) && !dismissed;
    if (el.hidden === show) {
      el.hidden = !show;
      if (show) look.focus({ preventScroll: true });
    }
  }
  query?.addEventListener?.('change', sync);
  sync();
  return { get open() { return !el.hidden; } };
}

// Bottom-centre pill: "E  Read the Brooder heaters sign". Clicking it does the same as E.
export function createPrompt(parent, onUse) {
  const text = h('span');
  const pill = button({ class: 'prompt', hidden: true }, h('kbd', { class: 'kbd', 'aria-hidden': 'true' }, 'E'), text);
  const wrap = h('div', { class: 'hud-bc' }, pill);
  parent.appendChild(wrap);
  let currentId = null, currentTarget = null;
  pill.addEventListener('click', () => { if (currentId) onUse(currentId, currentTarget); });
  return {
    show(target) {
      currentTarget = target;
      const id = target ? target.id : null;
      if (id === currentId) return;
      currentId = id;
      pill.hidden = !target;
      if (target) {
        const verb = target.verb || promptVerb(target.id);
        text.textContent = '';
        text.append(`${verb} `, h('b', null, target.label));
        pill.setAttribute('aria-label', `${verb} ${target.label} (E)`);
      }
    },
    get id() { return currentId; },
  };
}
