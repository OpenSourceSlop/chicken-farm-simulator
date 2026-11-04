// Title card over the farm at dawn (PHASE3.md §1): Start a new flock (Level 1, Plan the farm), Start at
// the brooding week, Continue (with a run save, or a Phase 2 save), the Phase 1 sandbox, the skill tree,
// and the run card (ui-run.js). Owner: package "run" (Phase 2: "level").
import { LEVEL_TEXT, LEVEL_KEYS, dayLabel } from './content.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { hhmm } from './ui-format.js';
import { createRunCard, shortIn } from './ui-run.js';

/**
 * @param {HTMLElement} root  #hud
 * @param {{ onStart(): void, onStartBrooding(): void, onContinue(): void, onSandbox(): void, onSkills(): void,
 *   onReplay(id, day): void, saveInfo(): ({day,hour,short?}|null), saveAvailable(): boolean, run(): any,
 *   onStandard?(id, condition): void, onStartCondition?(id): void }} o
 */
export function createTitle(root, o) {
  const titleId = uniqueId('title');
  const start = button({ class: 'btn btn--accent btn--big' }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), h('span', null, LEVEL_TEXT.start));
  const brooding = button({ class: 'btn btn--big' }, h('span', { html: ICONS.chick, 'aria-hidden': 'true' }), h('span', null, LEVEL_TEXT.startBrooding));
  const cont = button({ class: 'btn btn--big' }, h('span', { html: ICONS.next, 'aria-hidden': 'true' }), h('span'));
  const sandbox = button({ class: 'btn btn--quiet' }, h('span', { html: ICONS.outside, 'aria-hidden': 'true' }), LEVEL_TEXT.sandbox);
  const skills = button({ class: 'btn btn--quiet' }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), LEVEL_TEXT.skills);
  // Phase 4: after the first full cycle the Harder flocks cards sit under the seven level rows of the run card; at
  // 960 x 600 they are below its fold: this key scrolls them into view (integrator, Phase 4 merge)
  const harderKey = button({ class: 'btn btn--quiet', hidden: true }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), 'Harder flocks');
  const saveNote = h('p', { class: 'title-save' });
  // Phase 5 (PHASE5.md §6.1): more title keys from the packages (Load a saved farm, Settings, How to play), after the
  // sandbox, the skill tree and Harder flocks, in `order`
  const more = h('div', { class: 'title-more' }, sandbox, skills, harderKey);
  const actions = [];
  const keys = h('p', { class: 'title-keys' }, LEVEL_KEYS.map((k) => h('span', null, h('kbd', { class: 'kbd' }, k.key), ` ${k.what}`)));
  const runCard = createRunCard({ run: o.run, onReplay: (id, day) => o.onReplay(id, day),
    // Phase 4 (PHASE4.md §1.2, §3.1): a level's standard start with a flock choice; a new flock under a harder condition
    onStandard: (id, cond) => o.onStandard?.(id, cond), onStartCondition: (id) => o.onStartCondition?.(id) });
  const card = h('section', { class: 'card title-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'title-main' },
      h('p', { class: 'title-kicker' }, LEVEL_TEXT.kicker),
      h('h1', { id: titleId, class: 'title-h' }, LEVEL_TEXT.title),
      h('p', { class: 'title-line' }, LEVEL_TEXT.line),
      h('div', { class: 'title-btns' }, cont, start, brooding),
      saveNote,
      more,
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
        setText(btn.lastChild, LEVEL_TEXT.startAgain(info.short ? `${shortIn(info)}, ${dayLabel(info.day).toLowerCase()}` : dayLabel(info.day).toLowerCase()));
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
  harderKey.addEventListener('click', () => {
    const sec = runCard.el.querySelector('.harder');
    sec?.scrollIntoView({ block: 'start' });
    sec?.querySelector('.harder-go:not([disabled])')?.focus({ preventScroll: true });
  });
  function reset() {
    confirm = null;
    for (const b of [start, brooding]) { b.classList.remove('is-confirm'); setText(b.lastChild, b.__label); }
  }

  function sync() {
    const info = o.saveInfo();
    cont.hidden = !info;
    if (info) setText(cont.lastChild, LEVEL_TEXT.continueLabel(where(info), hhmm(info.hour), info.conditionLabel || null));
    setText(saveNote, o.saveAvailable() ? LEVEL_TEXT.saveNote : LEVEL_TEXT.noSave);
    saveNote.classList.toggle('is-off', !o.saveAvailable());
    runCard.refresh();
    harderKey.hidden = !o.run?.()?.harderOpen;
    for (const a of actions) a.btn.hidden = !!(a.visible && !a.visible());
  }
  /** Phase 5 (PHASE5.md §8.6): a quiet title key { id, label, icon?, order (default 50), onClick(), visible?() }. */
  function addAction(a) {
    const btn = button({ class: 'btn btn--quiet', 'data-title-action': a.id },
      a.icon && ICONS[a.icon] ? h('span', { html: ICONS[a.icon], 'aria-hidden': 'true' }) : null, a.label);
    btn.addEventListener('click', () => { try { a.onClick(); } catch (err) { console.error(`title action ${a.id} failed`, err); } });
    const it = { order: 50, ...a, btn };
    const old = actions.findIndex((x) => x.id === a.id);
    if (old >= 0) { actions[old].btn.remove(); actions.splice(old, 1); }
    actions.push(it);
    actions.sort((x, y) => x.order - y.order);
    for (const x of actions) more.append(x.btn);
    btn.hidden = !!(a.visible && !a.visible());
    return btn;
  }
  return {
    el,
    addAction,
    /** Refresh the Continue line, the save note and the run card (a slot saved, loaded or deleted). */
    refresh: () => { if (!el.hidden) sync(); },
    get open() { return !el.hidden; },
    show() { reset(); sync(); el.hidden = false; (cont.hidden ? start : cont).focus({ preventScroll: true }); },
    hide() { el.hidden = true; },
  };
}
