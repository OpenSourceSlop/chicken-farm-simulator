// The run card on the title screen (PHASE3.md §1, PHASE4.md §1.2): the seven levels in a column, each with its days,
// its key target in words, its state (not reached · playing · passed with its key number · not passed) and, once
// reached, Replay from its saved start (a second press confirms: "Replay Week 2 — your run goes back to day 8") under
// the condition it was saved under, and Play from a standard start with a flock choice (Normal season or one of the four
// harder flocks; another flock than the run's starts a new run from that level). Under the levels the Harder flocks:
// four cards, each with *Start a new flock in the hot season*; shut until the first full cycle ("Harder flocks: after
// your first full cycle"). Plus the card shown while a standard start plays the ideal farmer ("Getting the flock to day
// 22 in the hot season …"). Owner: package "run".
import { RUN_CARD, HARDER } from './content.js';
import { levelById, CONDITIONS, CONDITION_IDS, conditionLabel } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

/** A level's short name inside a sentence: "the brooding week", "Week 2". */
export const shortIn = (def) => (def?.short || '').replace(/^The /, 'the ');

/**
 * The Harder flocks cards (the run card, the cycle summary). `o.run()` the run, `o.onStart(id)` a new flock under it.
 * A start asks once more (5 s) when a run is going: it replaces it.
 * @returns {{ el: HTMLElement, refresh(): void }}
 */
export function createHarderCards(o) {
  const grid = h('div', { class: 'harder-grid' });
  const shut = h('p', { class: 'harder-shut', hidden: true }, RUN_CARD.harderShut);
  const el = h('section', { class: 'harder', 'aria-label': RUN_CARD.harderHeading }, h('h3', { class: 'harder-h' }, RUN_CARD.harderHeading), shut, grid);
  let confirm = null, timer = 0;
  function card(c, open, going) {
    const go = button({ class: 'btn harder-go', disabled: !(open && c.available), 'aria-label': RUN_CARD.startIn(c.id) }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), h('span', null, RUN_CARD.startIn(c.id)));
    go.addEventListener('click', () => {
      if (going && confirm !== c.id) {
        confirm = c.id; setText(go.lastChild, RUN_CARD.confirmNew(RUN_CARD.startIn(c.id))); go.classList.add('is-confirm');
        clearTimeout(timer); timer = setTimeout(() => { confirm = null; refresh(); }, 5000);
        return;
      }
      confirm = null; clearTimeout(timer);
      o.onStart(c.id);
    });
    const note = !open ? null : !c.available ? h('p', { class: 'harder-note' }, RUN_CARD.harderOff) : c.done ? h('p', { class: 'harder-note' }, RUN_CARD.harderDone(c.done)) : null;
    return h('article', { class: `harder-card${open && c.available ? '' : ' is-shut'}` },
      h('p', { class: 'harder-name' }, c.label, c.months ? h('small', null, ` · ${c.months}`) : null),
      h('p', { class: 'harder-line' }, HARDER[c.id]?.line || c.summary || ''), note, go);
  }
  function refresh() {
    const run = o.run();
    if (!run) { el.hidden = true; return; }
    el.hidden = false;
    const list = run.conditionsAvailable ? run.conditionsAvailable() : CONDITION_IDS.map((id) => ({ id, ...CONDITIONS[id], open: false }));
    const open = !!run.harderOpen, going = !!run.state?.().levelId;
    shut.hidden = open;
    grid.replaceChildren(...list.map((c) => card(c, open, going)));
  }
  return { el, refresh };
}

/**
 * @param {{ run(): any, onReplay(id: string, day: number): void, onStandard?(id: string, condition: string|null): void,
 *   onStartCondition?(id: string): void }} o
 * @returns {{ el: HTMLElement, refresh(): void }}
 */
export function createRunCard(o) {
  const list = h('ol', { class: 'runcard-list' });
  const note = h('p', { class: 'runcard-note', hidden: true });
  const harderLine = h('p', { class: 'runcard-harder', hidden: true });
  const harder = createHarderCards({ run: o.run, onStart: (id) => o.onStartCondition?.(id) });
  const el = h('section', { class: 'runcard', 'aria-label': RUN_CARD.heading },
    h('h2', { class: 'runcard-h' }, RUN_CARD.heading), list, harderLine, harder.el, note);
  let confirm = null, timer = 0;
  const picked = new Map();   // level id -> the flock chosen in its select (null = the normal season)
  const arm = (key, btn, text) => {
    confirm = key; setText(btn.lastChild, text); btn.classList.add('is-confirm');
    clearTimeout(timer); timer = setTimeout(() => { confirm = null; refresh(); }, 5000);
  };

  function condSelect(r, run) {
    const open = !!run.harderOpen, list = run.conditionsAvailable ? run.conditionsAvailable() : [];
    const cur = picked.has(r.id) ? picked.get(r.id) : (r.condition ?? null);
    const s = h('select', { class: 'runcard-select', 'aria-label': `${RUN_CARD.conditionLabel}: ${r.short}`, disabled: !open },
      h('option', { value: '', ...(cur == null ? { selected: true } : {}) }, conditionLabel(null)),
      list.map((c) => h('option', { value: c.id, disabled: !c.canStart, ...(cur === c.id ? { selected: true } : {}) }, c.label)));
    s.title = open ? RUN_CARD.newRunNote : RUN_CARD.harderShut;
    s.addEventListener('change', () => { picked.set(r.id, s.value || null); confirm = null; refresh(); });
    return s;
  }

  function row(r, run) {
    const def = levelById(r.id);
    const state = h('span', { class: `runcard-state runcard-state--${r.state.replace(' ', '-')}` }, RUN_CARD.states[r.state] || r.state);
    const key = r.keyText ? h('span', { class: 'runcard-key' }, r.keyText) : null;
    const day = r.starts.length ? r.starts[0] : def.startDay;
    let replay = null, std = null, sel = null;
    if (r.canReplay) {
      // the saved start replays under the condition it was saved under (shown, fixed)
      const cond = r.conditionLabel ? ` · ${r.conditionLabel}` : '';
      const label = `${RUN_CARD.replay} ${RUN_CARD.fromDay(day)}${cond}`;
      replay = button({ class: 'btn btn--quiet runcard-replay', 'aria-label': `${RUN_CARD.replay} ${def.short} ${RUN_CARD.fromDay(day)}${cond}` }, h('span', { html: ICONS.sunrise, 'aria-hidden': 'true' }), h('span', null, label));
      replay.addEventListener('click', () => {
        if (confirm !== `r:${r.id}`) { arm(`r:${r.id}`, replay, RUN_CARD.confirm(shortIn(def), day)); return; }
        confirm = null; clearTimeout(timer);
        o.onReplay(r.id, day);
      });
      // Phase 4: a standard start of this level with the flock chosen (another flock than the run's: a new run)
      sel = condSelect(r, run);
      std = button({ class: 'btn btn--quiet runcard-replay runcard-std' }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), h('span', null, RUN_CARD.playStandard));
      std.addEventListener('click', () => {
        const c = picked.has(r.id) ? picked.get(r.id) : (r.condition ?? null), other = c !== (r.condition ?? null);
        if (confirm !== `s:${r.id}`) { arm(`s:${r.id}`, std, other ? RUN_CARD.confirmNew(RUN_CARD.playStandard) : RUN_CARD.confirmStd(shortIn(def), def.startDay)); return; }
        confirm = null; clearTimeout(timer);
        o.onStandard?.(r.id, c);
      });
    }
    return h('li', { class: `runcard-row${r.state === 'playing' ? ' is-playing' : ''}${r.state === 'not reached' ? ' is-later' : ''}` },
      h('span', { class: 'runcard-n', 'aria-hidden': 'true' }, String(r.n)),
      h('div', { class: 'runcard-body' },
        h('p', { class: 'runcard-title' }, def.short, h('small', null, ` · ${r.days}`)),
        h('p', { class: 'runcard-target' }, r.target),
        h('div', { class: 'runcard-meta' }, h('span', null, state, key ? ' · ' : null, key, r.fromStandard ? h('small', { class: 'runcard-std-mark' }, ' · from a standard start') : null), replay),
        std ? h('div', { class: 'runcard-cond' }, sel, std) : null));
  }

  function refresh() {
    const run = o.run();
    if (!run) { el.hidden = true; return; }
    el.hidden = false;
    list.replaceChildren(...run.card().map((r) => row(r, run)));
    const c = run.condition ? conditionLabel(run.condition) : null;
    harderLine.hidden = !c;
    setText(harderLine, c ? `This run: ${c}.` : '');
    harder.refresh();
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
      if (!el.hidden) return false; // fix round: a second press while the first long job waits is not queued
      setText(text, msg); el.hidden = false;
      const go = () => { try { fn(); } finally { el.hidden = true; } };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 30)); else go();
      return true;
    },
  };
}
