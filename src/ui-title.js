// Title card over the farm at dawn: Start Level 1, Continue (with a save), the Phase 1 sandbox,
// the skill tree (read-only). Owner: package "level". PHASE2.md §1 "Title card".
import { LEVEL_TEXT, LEVEL_KEYS, dayLabel } from './content.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { hhmm } from './ui-format.js';

/**
 * @param {HTMLElement} root  #hud
 * @param {{ onStart(): void, onContinue(): void, onSandbox(): void, onSkills(): void, saveInfo(): ({day,hour}|null), saveAvailable(): boolean }} o
 */
export function createTitle(root, o) {
  const titleId = uniqueId('title');
  const start = button({ class: 'btn btn--accent btn--big' }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), h('span', null, LEVEL_TEXT.start));
  const cont = button({ class: 'btn btn--big' }, h('span', { html: ICONS.next, 'aria-hidden': 'true' }), h('span'));
  const sandbox = button({ class: 'btn btn--quiet' }, h('span', { html: ICONS.outside, 'aria-hidden': 'true' }), LEVEL_TEXT.sandbox);
  const skills = button({ class: 'btn btn--quiet' }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), LEVEL_TEXT.skills);
  const saveNote = h('p', { class: 'title-save' });
  const keys = h('p', { class: 'title-keys' }, LEVEL_KEYS.map((k) => h('span', null, h('kbd', { class: 'kbd' }, k.key), ` ${k.what}`)));
  const card = h('section', { class: 'card title-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('p', { class: 'title-kicker' }, LEVEL_TEXT.kicker),
    h('h1', { id: titleId, class: 'title-h' }, LEVEL_TEXT.title),
    h('p', { class: 'title-line' }, LEVEL_TEXT.line),
    h('div', { class: 'title-btns' }, start, cont),
    saveNote,
    h('div', { class: 'title-more' }, sandbox, skills),
    keys);
  const el = h('div', { class: 'title', hidden: true }, card);
  root.appendChild(el);

  let confirm = false, confirmTimer = 0;
  start.addEventListener('click', () => {
    const info = o.saveInfo();
    if (info && !confirm) {
      confirm = true;
      setText(start.lastChild, LEVEL_TEXT.startAgain(dayLabel(info.day).toLowerCase()));
      start.classList.add('is-confirm');
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(reset, 5000);
      return;
    }
    reset();
    o.onStart();
  });
  cont.addEventListener('click', () => o.onContinue());
  sandbox.addEventListener('click', () => o.onSandbox());
  skills.addEventListener('click', () => o.onSkills());
  function reset() { confirm = false; start.classList.remove('is-confirm'); setText(start.lastChild, LEVEL_TEXT.start); }

  function sync() {
    const info = o.saveInfo();
    cont.hidden = !info;
    if (info) setText(cont.lastChild, LEVEL_TEXT.continueLabel(dayLabel(info.day), hhmm(info.hour)));
    setText(saveNote, o.saveAvailable() ? LEVEL_TEXT.saveNote : LEVEL_TEXT.noSave);
    saveNote.classList.toggle('is-off', !o.saveAvailable());
  }
  return {
    el,
    get open() { return !el.hidden; },
    show() { reset(); sync(); el.hidden = false; (cont.hidden ? start : cont).focus({ preventScroll: true }); },
    hide() { el.hidden = true; },
  };
}
