// Title card over the farm at dawn (PHASE3.md §1): Start a new flock (Level 1, Plan the farm), Start at
// the brooding week, Continue (with a run save, or a Phase 2 save), the Phase 1 sandbox, the skill tree,
// and the run card (ui-run.js). Owner: package "run" (Phase 2: "level").
import { LEVEL_TEXT, LEVEL_KEYS, dayLabel } from './content.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { hhmm } from './ui-format.js';
import { createRunCard } from './ui-run.js';

/**
 * @param {HTMLElement} root  #hud
 * @param {{ onStart(): void, onStartBrooding(): void, onContinue(): void, onSandbox(): void, onSkills(): void,
 *   onReplay(id, day): void, saveInfo(): ({day,hour,short?}|null), saveAvailable(): boolean, run(): any }} o
 */
export function createTitle(root, o) {
  const titleId = uniqueId('title');
  const start = button({ class: 'btn btn--accent btn--big' }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), h('span', null, LEVEL_TEXT.start));
  const brooding = button({ class: 'btn btn--big' }, h('span', { html: ICONS.chick, 'aria-hidden': 'true' }), h('span', null, LEVEL_TEXT.startBrooding));
  const cont = button({ class: 'btn btn--big' }, h('span', { html: ICONS.next, 'aria-hidden': 'true' }), h('span'));
  const sandbox = button({ class: 'btn btn--quiet' }, h('span', { html: ICONS.outside, 'aria-hidden': 'true' }), LEVEL_TEXT.sandbox);
  const skills = button({ class: 'btn btn--quiet' }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), LEVEL_TEXT.skills);
  const saveNote = h('p', { class: 'title-save' });
  const keys = h('p', { class: 'title-keys' }, LEVEL_KEYS.map((k) => h('span', null, h('kbd', { class: 'kbd' }, k.key), ` ${k.what}`)));
  const runCard = createRunCard({ run: o.run, onReplay: (id, day) => o.onReplay(id, day) });
  const card = h('section', { class: 'card title-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'title-main' },
      h('p', { class: 'title-kicker' }, LEVEL_TEXT.kicker),
      h('h1', { id: titleId, class: 'title-h' }, LEVEL_TEXT.title),
      h('p', { class: 'title-line' }, LEVEL_TEXT.line),
      h('div', { class: 'title-btns' }, cont, start, brooding),
      saveNote,
      h('div', { class: 'title-more' }, sandbox, skills),
      keys),
    runCard.el);
  const el = h('div', { class: 'title', hidden: true }, card);
  root.appendChild(el);

  // a start over an existing save asks once more ("Start again — replaces your Week 3 save")
  let confirm = null, confirmTimer = 0;
  const where = (info) => (info.short ? `${info.short}, ${dayLabel(info.day).toLowerCase()}` : dayLabel(info.day));
  function guarded(btn, label, go) {
    btn.addEventListener('click', () => {
      const info = o.saveInfo();
      if (info && confirm !== btn) {
        reset(); confirm = btn;
        setText(btn.lastChild, LEVEL_TEXT.startAgain(info.short || dayLabel(info.day).toLowerCase()));
        btn.classList.add('is-confirm');
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(reset, 5000);
        return;
      }
      reset();
      go();
    });
    btn.__label = label;
  }
  guarded(start, LEVEL_TEXT.start, () => o.onStart());
  guarded(brooding, LEVEL_TEXT.startBrooding, () => o.onStartBrooding());
  cont.addEventListener('click', () => o.onContinue());
  sandbox.addEventListener('click', () => o.onSandbox());
  skills.addEventListener('click', () => o.onSkills());
  function reset() {
    confirm = null;
    for (const b of [start, brooding]) { b.classList.remove('is-confirm'); setText(b.lastChild, b.__label); }
  }

  function sync() {
    const info = o.saveInfo();
    cont.hidden = !info;
    if (info) setText(cont.lastChild, LEVEL_TEXT.continueLabel(where(info), hhmm(info.hour)));
    setText(saveNote, o.saveAvailable() ? LEVEL_TEXT.saveNote : LEVEL_TEXT.noSave);
    saveNote.classList.toggle('is-off', !o.saveAvailable());
    runCard.refresh();
  }
  return {
    el,
    get open() { return !el.hidden; },
    show() { reset(); sync(); el.hidden = false; (cont.hidden ? start : cont).focus({ preventScroll: true }); },
    hide() { el.hidden = true; },
  };
}
