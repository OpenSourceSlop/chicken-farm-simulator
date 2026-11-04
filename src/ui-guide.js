// How to play (PHASE5.md §6.2): the guide page, opened from the title card, the game menu, the controls legend's
// "Full guide" and ui.openGuide(section, via). The farm clock stands still while it is open. Owner: package "settings".
// The words are content-guide.js's, filled with the live keys and Time settings every time it opens (fillGuide); a
// contents row, a labelled picture of the HUD, the live key list in "Getting around", and "Show the introduction again"
// (ctx.ui.intro.reset(), then the guide closes and the first card shows on the farm). Its looks: #guide-style (.guide-*).
//
//   registerGuidePanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'guide', open(section?, via?) }
//   frozen DOM hook (PHASE5.md §8.10): [data-guide="<section id>"] on each section; 'controls' holds the live key list
import { h, button, uniqueId, injectStyle } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { GUIDE, HUD_PICTURE, fillGuide, guideRuns } from './content-guide.js';
import { uiOf } from './ui-settings-keys.js';

export const GUIDE_ID = 'guide';
// the guide's own rules (PHASE5.md §8.11: each package styles its own screens; the frame is the template's)
const GUIDE_CSS = `
.guide-intro { margin: -4px 0 10px; color: var(--ink-dim); font-size: 14px; line-height: 1.45; max-width: 64ch; }
.guide-toc { display: flex; flex-wrap: wrap; gap: 4px 6px; margin: 0 0 8px; padding: 0 0 10px; list-style: none; border-bottom: 1px solid var(--panel-edge); }
.guide-body { max-height: max(220px, calc(100vh - 250px)); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding-right: 8px; }
.guide-toc button { min-height: 28px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--panel-edge); background: var(--panel-sunk); color: var(--ink-dim);
  font: 600 12px/1.2 var(--font-display); letter-spacing: 0.03em; cursor: pointer; }
.guide-toc button:hover { color: var(--ink); }
.guide-sec { padding: 4px 0 2px; border-top: 1px solid var(--panel-edge); scroll-margin-top: 8px; }
.guide-sec:first-of-type { border-top: 0; }
.guide-sec h3 { margin: 12px 0 6px; font: 600 16px/1.3 var(--font-display); color: var(--ink); }
.guide-sec p { margin: 0 0 6px; font-size: 14px; line-height: 1.55; color: var(--ink-dim); max-width: 64ch; }
.guide-sec strong { color: var(--ink); font-weight: 600; }
.guide .guide-keys { margin: 8px 0 4px; padding: 10px 12px; border-radius: 6px; background: var(--panel-sunk); grid-template-columns: auto 1fr auto 1fr; gap: 5px 12px; }
.guide .guide-keys dd { font-size: 13px; color: var(--ink-dim); }
.guide-hud { position: relative; aspect-ratio: 16 / 9; max-width: 520px; margin: 8px 0 10px; border-radius: 8px; overflow: hidden;
  background: linear-gradient(180deg, #8fb4c9 0%, #b9cfd6 34%, #7a9a5c 35%, #5f7f45 100%); border: 1px solid var(--panel-edge); }
.guide-hud-box { position: absolute; display: grid; place-items: center; padding: 2px 4px; border-radius: 5px; border: 1px solid var(--panel-edge);
  background: var(--panel); color: var(--ink); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); text-align: center;
  font: 600 11px/1.15 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; }
.guide-hud-box.is-jobs { border-left: 3px solid var(--accent); }
.guide-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--panel-edge); }
.guide-foot p { margin: 0; flex: 1 1 240px; color: var(--ink-faint); font-size: 13px; line-height: 1.4; }
@media (max-width: 760px) { .guide .guide-keys { grid-template-columns: auto 1fr; } }
`;

/** Draw a filled sentence into an element: **…** runs bold, the rest as text (never HTML). */
function drawRuns(el, text) {
  el.replaceChildren(...guideRuns(text).map((r) => (r.bold ? h('strong', null, r.text) : document.createTextNode(r.text))));
}

/** The labelled picture of the HUD: the cards' places as boxes with their names. */
function hudPicture() {
  const names = HUD_PICTURE.map((b) => b.name).join(', ');
  return h('div', { class: 'guide-hud', role: 'img', 'aria-label': `A picture of the game screen with its cards: ${names}` },
    HUD_PICTURE.map((b) => h('span', { class: `guide-hud-box is-${b.id}`, style: `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`, 'aria-hidden': 'true' }, b.name)));
}

export function registerGuidePanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  let want = null;
  injectStyle('guide-style', GUIDE_CSS);
  register(GUIDE_ID, () => {
    const titleId = uniqueId('guide-title');
    const { el, closeBtn } = dialogShell('guide', titleId, () => closePanel());
    const keysList = h('dl', { class: 'help-list guide-keys', 'aria-label': 'Every key, as set now' });
    const drawKeys = () => keysList.replaceChildren(...(ctx.keys ? ctx.keys.rows('level') : []).flatMap((r) => [h('dt', null, r.keys.map((k) => h('kbd', { class: 'kbd' }, k))), h('dd', null, r.what)]));
    // the words name the live keys and Time settings (content-guide.js tokens): filled again on every open
    const paras = [];
    const secById = new Map();
    const secs = GUIDE.sections.map((s) => {
      const sec = h('section', { class: 'guide-sec', id: `${titleId}-${s.id}`, 'data-guide': s.id, 'aria-labelledby': `${titleId}-${s.id}-h` },
        h('h3', { id: `${titleId}-${s.id}-h` }, s.head),
        s.picture ? hudPicture() : null,
        ...s.text.map((t) => { const p = h('p', null, ''); paras.push([p, t]); return p; }),
        s.controls ? keysList : null);
      secById.set(s.id, sec);
      return sec;
    });
    const toc = h('ul', { class: 'guide-toc', 'aria-label': 'Sections' }, GUIDE.sections.map((s) => {
      const b = button({}, s.head);
      b.addEventListener('click', () => { secById.get(s.id)?.scrollIntoView?.({ block: 'start' }); secById.get(s.id)?.querySelector('h3')?.focus?.(); });
      return h('li', null, b);
    }));
    for (const sec of secs) sec.querySelector('h3').tabIndex = -1;
    const again = button({ class: 'btn', 'data-intro-again': '' }, 'Show the introduction again');
    again.addEventListener('click', () => {
      const intro = uiOf(ctx)?.intro;
      try { intro?.reset?.(); } catch (err) { console.error('intro reset failed', err); }
      closePanel({ all: true });
      // the first card shows on the farm once no panel is open (in a level now; on the title card at the next start)
      try { if (intro && !intro.active) intro.start?.('again'); } catch (err) { console.error('intro start failed', err); }
    });
    const foot = h('div', { class: 'guide-foot' }, h('p', null, 'The four short pointers of the first morning (the job card, a sign, the time bar, the flock watch) can show again.'), again);
    const body = h('div', { class: 'guide-body' }, ...secs, foot);
    el.append(h('div', { class: 'guide-case card' },
      h('header', { class: 'guide-head' }, h('span', { html: ICONS.book, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, GUIDE.title))),
      h('p', { class: 'guide-intro' }, GUIDE.intro),
      toc, body), closeBtn);
    const drawText = () => { for (const [p, t] of paras) drawRuns(p, fillGuide(t, { keys: ctx.keys, settings: ctx.settings })); };
    return {
      el,
      onOpen() {
        drawKeys(); drawText();
        const sec = want ? secById.get(want) : null;
        if (sec) sec.scrollIntoView?.({ block: 'start' });
        else body.scrollTop = 0;
        want = null;
      },
      /** The section now at the top of the guide's view (tests). */
      get section() {
        const top = body.getBoundingClientRect().top;
        let best = null;
        for (const [id, s] of secById) if (s.getBoundingClientRect().top - top <= 24) best = id;
        return best;
      },
    };
  }, { kind: 'paused' });
  const api = { id: GUIDE_ID, open(section = null, via = null) { want = section; return openPanel(GUIDE_ID, via || undefined); } };
  menu?.add?.({ id: 'guide', label: 'How to play', icon: 'help', order: 60, onSelect: (via) => api.open(null, via) });
  title?.addAction?.({ id: 'guide', label: 'How to play', icon: 'help', order: 30, onClick: () => api.open() });
  return api;
}
