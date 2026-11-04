// How to play (PHASE5.md §6.2): the guide page, opened from the title card, the game menu and the controls legend.
// The farm clock stands still while it is open. Owner after the design round: package "settings". Working STUB now:
// the sections of content-guide.js with the live key bindings (keys.js) in "Getting around".
//
//   registerGuidePanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'guide', open(section?, via?) }
import { h, uniqueId, injectStyle } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { GUIDE, fillGuide } from './content-guide.js';

export const GUIDE_ID = 'guide';
// the guide's own rules (PHASE5.md §8.6: each package styles its own screens; the frame is the template's)
const GUIDE_CSS = `
.guide-sec h3 { margin: 14px 0 4px; font: 600 15px/1.3 var(--font-display); color: var(--ink); }
.guide-sec p { margin: 0 0 6px; font-size: 14px; line-height: 1.5; color: var(--ink-dim); }
`;

export function registerGuidePanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  let want = null;
  injectStyle('guide-style', GUIDE_CSS);
  register(GUIDE_ID, () => {
    const titleId = uniqueId('guide-title');
    const { el, closeBtn } = dialogShell('guide', titleId, () => closePanel());
    const keysList = h('dl', { class: 'help-list guide-keys' });
    const drawKeys = () => keysList.replaceChildren(...(ctx.keys ? ctx.keys.rows('level') : []).flatMap((r) => [h('dt', null, r.keys.map((k) => h('kbd', { class: 'kbd' }, k))), h('dd', null, r.what)]));
    // the words name the live keys and Time settings (content-guide.js tokens): filled again on every open
    const paras = [];
    const secs = GUIDE.sections.map((s) => h('section', { class: 'guide-sec', id: `guide-${s.id}`, 'data-guide': s.id },
      h('h3', null, s.head), ...s.text.map((t) => { const p = h('p', null, ''); paras.push([p, t]); return p; }), s.controls ? keysList : null));
    const drawText = () => { for (const [p, t] of paras) p.textContent = fillGuide(t, { keys: ctx.keys, settings: ctx.settings }); };
    el.append(h('div', { class: 'guide-case card' },
      h('header', { class: 'guide-head' }, h('span', { html: ICONS.book, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, GUIDE.title), h('p', null, GUIDE.intro))),
      ...secs), closeBtn);
    return {
      el,
      onOpen() { drawKeys(); drawText(); if (want) el.querySelector(`#guide-${want}`)?.scrollIntoView?.({ block: 'start' }); want = null; },
    };
  }, { kind: 'paused' });
  const api = { id: GUIDE_ID, open(section = null, via = null) { want = section; return openPanel(GUIDE_ID, via || undefined); } };
  menu?.add?.({ id: 'guide', label: 'How to play', icon: 'help', order: 60, onSelect: (via) => api.open(null, via) });
  title?.addAction?.({ id: 'guide', label: 'How to play', icon: 'help', order: 30, onClick: () => api.open() });
  return api;
}
