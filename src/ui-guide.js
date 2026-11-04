// How to play (PHASE5.md §6.2): the guide page, opened from the title card, the game menu and the controls legend.
// The farm clock stands still while it is open. Owner after the design round: package "settings". Working STUB now:
// the sections of content-guide.js with the live key bindings (keys.js) in "Getting around".
//
//   registerGuidePanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'guide', open(section?) }
import { h, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { GUIDE } from './content-guide.js';

export const GUIDE_ID = 'guide';

export function registerGuidePanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  let want = null;
  register(GUIDE_ID, () => {
    const titleId = uniqueId('guide-title');
    const { el, closeBtn } = dialogShell('guide', titleId, () => closePanel());
    const keysList = h('dl', { class: 'help-list guide-keys' });
    const drawKeys = () => keysList.replaceChildren(...(ctx.keys ? ctx.keys.rows('level') : []).flatMap((r) => [h('dt', null, r.keys.map((k) => h('kbd', { class: 'kbd' }, k))), h('dd', null, r.what)]));
    const secs = GUIDE.sections.map((s) => h('section', { class: 'guide-sec', id: `guide-${s.id}`, 'data-guide': s.id },
      h('h3', null, s.head), ...s.text.map((t) => h('p', null, t)), s.controls ? keysList : null));
    el.append(h('div', { class: 'guide-case card' },
      h('header', { class: 'guide-head' }, h('span', { html: ICONS.book, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, GUIDE.title), h('p', null, GUIDE.intro))),
      ...secs), closeBtn);
    return {
      el,
      onOpen() { drawKeys(); if (want) el.querySelector(`#guide-${want}`)?.scrollIntoView?.({ block: 'start' }); want = null; },
    };
  }, { kind: 'paused' });
  const api = { id: GUIDE_ID, open(section = null) { want = section; return openPanel(GUIDE_ID); } };
  menu?.add?.({ id: 'guide', label: 'How to play', icon: 'help', order: 60, onSelect: () => api.open() });
  title?.addAction?.({ id: 'guide', label: 'How to play', icon: 'help', order: 30, onClick: () => api.open() });
  return api;
}
