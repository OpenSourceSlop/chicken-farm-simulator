// Farm time a panel action needs (the steps hotfix: the farmer started a flow test with the clock paused and it
// never finished; closing the panel stopped it and nothing said why). Owner: package "level" (shared by every panel).
//   setFarmTimeHooks({ resume, paused, notice })  ui.js wires the level clock: resume() runs a paused clock again at
//                                                 normal speed and returns true if it was paused; notice(text) a caption
//   needTime(text) -> { text, resumed }           an action that waits on farm time starts: the clock runs again
//   farmTimeNote() -> { el, start(text), done(text?), hide() }   the line a panel shows under its keys:
//                                                 "Clock running: the test takes 1 farm minute"; while the farmer pauses
//                                                 the clock again it says the action waits for the clock
//   tickFarmTimeNotes()                           ui.update: the shown notes follow the pause
//   pausedText(what)                              the strip's and the card's line while the clock is paused
// Neutral words only: what runs, how long it takes, how to start the clock. No verdicts.
import { h, setText } from './ui-dom.js';

let hooks = null;
export function setFarmTimeHooks(next) { hooks = next || null; }
export const clockPaused = () => !!hooks?.paused?.();
export function resumeClock() { try { return !!hooks?.resume?.(); } catch { return false; } }
export function farmNotice(text, sec) { hooks?.notice?.(text, sec); }

/** What the strip and the card say while the farmer has the clock paused (the HUD's ▶ button starts it). */
export const pausedText = (what = 'This job waits on farm time') => `${what}: the clock is paused. Press ▶ in the time bar (bottom left) and the farm minutes pass again.`;

/** An action that waits on farm time starts: a paused clock runs again at normal speed. */
export function needTime(text) {
  const resumed = resumeClock();
  return { text: `Clock running: ${text}${resumed ? ' (the pause is off: the clock runs at normal speed)' : ''}.`, resumed };
}

const NOTES = new Set();
/** The note line of a panel (role status): start(text) resumes the clock and shows "Clock running: …". */
export function farmTimeNote({ cls = '' } = {}) {
  const el = h('p', { class: `equip-note equip-note--time farm-time${cls ? ` ${cls}` : ''}`, role: 'status', hidden: true });
  let base = '', shown = '';
  const note = {
    el,
    get text() { return el.hidden ? '' : el.textContent; },
    start(text) {
      const r = needTime(text);
      base = text; shown = r.text;
      el.hidden = false; setText(el, shown);
      NOTES.add(note);
      return r.resumed;
    },
    /** The action finished: a last line (its result), or hide the note. */
    done(text) {
      NOTES.delete(note); base = '';
      if (text) { el.hidden = false; setText(el, text); } else el.hidden = true;
    },
    hide() { NOTES.delete(note); base = ''; el.hidden = true; },
    tick() {
      if (!base || el.hidden) return;
      setText(el, clockPaused() ? `Clock paused: ${base}, once the clock runs again. Press ▶ in the time bar (bottom left).` : shown);
    },
  };
  return note;
}
export function tickFarmTimeNotes() { for (const n of NOTES) n.tick(); }
/** Forget every shown note (a new run rebuilds the panels). */
export function clearFarmTimeNotes() { NOTES.clear(); }

/** An open job whose outcome must hold over farm time and does not yet (a held part, the drying floor): the words a
 *  setting change at the controller or the fan panel shows ("the chicks feel near the target for 30 farm minutes"),
 *  or null. The setting itself is instant; the job then waits on the clock, so a paused clock runs again. */
export function heldWaitText(engine) {
  for (const inst of engine?.open?.() || []) {
    if (inst.def.done?.type === 'state' && inst.def.done.test === 'house-dry') return 'the floor dries over farm hours with the tunnel fans running (Next job skips ahead)';
    for (const p of engine.parts?.(inst) || []) if (p.held && !p.met && p.label) return `${p.label.charAt(0).toLowerCase()}${p.label.slice(1)} (${inst.def.title})`;
  }
  return null;
}
