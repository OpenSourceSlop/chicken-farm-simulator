// The run card on the title screen (PHASE3.md §1): the seven levels in a column, each with its days,
// its key target in words, its state (not reached · playing · passed with its key number · not
// passed) and, once reached, Replay from its saved start (a second press confirms: "Replay Week 2 —
// your run goes back to day 8"). After a full cycle a line says the harder flocks come in the next
// build (nothing to click: Phase 4). Plus the card shown while a standard start plays the ideal farmer
// ("Getting the flock to day 22 …"). Owner: package "run".
import { RUN_CARD } from './content.js';
import { levelById } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

/** A level's short name inside a sentence: "the brooding week", "Week 2". */
export const shortIn = (def) => (def?.short || '').replace(/^The /, 'the ');

/**
 * @param {{ run(): any, onReplay(id: string, day: number): void }} o
 * @returns {{ el: HTMLElement, refresh(): void }}
 */
export function createRunCard(o) {
  const list = h('ol', { class: 'runcard-list' });
  const note = h('p', { class: 'runcard-note', hidden: true });
  const harder = h('p', { class: 'runcard-harder', hidden: true }, RUN_CARD.harder);
  const el = h('section', { class: 'runcard', 'aria-label': RUN_CARD.heading },
    h('h2', { class: 'runcard-h' }, RUN_CARD.heading), list, harder, note);
  let confirm = null, timer = 0;

  function row(r) {
    const def = levelById(r.id);
    const state = h('span', { class: `runcard-state runcard-state--${r.state.replace(' ', '-')}` }, RUN_CARD.states[r.state] || r.state);
    const key = r.keyText ? h('span', { class: 'runcard-key' }, r.keyText) : null;
    const day = r.starts.length ? r.starts[0] : def.startDay;
    let replay = null;
    if (r.canReplay) {
      const label = `${RUN_CARD.replay} ${RUN_CARD.fromDay(day)}`;
      replay = button({ class: 'btn btn--quiet runcard-replay', 'aria-label': `${RUN_CARD.replay} ${def.short} ${RUN_CARD.fromDay(day)}` }, h('span', { html: ICONS.sunrise, 'aria-hidden': 'true' }), h('span', null, label));
      replay.addEventListener('click', () => {
        if (confirm !== r.id) {
          confirm = r.id;
          setText(replay.lastChild, RUN_CARD.confirm(shortIn(def).replace(/^the /, 'the '), day));
          replay.classList.add('is-confirm');
          clearTimeout(timer); timer = setTimeout(() => { confirm = null; refresh(); }, 5000);
          return;
        }
        confirm = null; clearTimeout(timer);
        o.onReplay(r.id, day);
      });
    }
    return h('li', { class: `runcard-row${r.state === 'playing' ? ' is-playing' : ''}${r.state === 'not reached' ? ' is-later' : ''}` },
      h('span', { class: 'runcard-n', 'aria-hidden': 'true' }, String(r.n)),
      h('div', { class: 'runcard-body' },
        h('p', { class: 'runcard-title' }, def.short, h('small', null, ` · ${r.days}`)),
        h('p', { class: 'runcard-target' }, r.target),
        h('div', { class: 'runcard-meta' }, h('span', null, state, key ? ' · ' : null, key), replay)));
  }

  function refresh() {
    const run = o.run();
    if (!run) { el.hidden = true; return; }
    el.hidden = false;
    list.replaceChildren(...run.card().map(row));
    harder.hidden = !run.cycleDone;
    note.hidden = !!run.available;
    setText(note, RUN_CARD.noStorage);
  }
  return { el, refresh };
}

/** The card shown while a standard start plays the ideal farmer to a level's start. */
export function createBusyCard(root) {
  const text = h('p', { class: 'busy-text' });
  const el = h('div', { class: 'busy', hidden: true, role: 'status', 'aria-live': 'polite' }, h('div', { class: 'card busy-card' }, h('span', { class: 'busy-icon', html: ICONS.timer, 'aria-hidden': 'true' }), text));
  root.appendChild(el);
  return {
    get open() { return !el.hidden; },
    /** Show the card, then run `fn` once the browser has painted it. */
    run(msg, fn) {
      setText(text, msg); el.hidden = false;
      const go = () => { try { fn(); } finally { el.hidden = true; } };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 30)); else go();
    },
  };
}
