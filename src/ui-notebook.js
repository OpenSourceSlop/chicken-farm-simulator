// The farmer's notebook (N): every reading as he took it, by day, newest day first, with his look
// notes. The same readings the office book lists. The clock stops while it is open.
// Owner: package "run" (Phase 2: "level").
import { h, button, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { hhmm, readingText, placeWords } from './ui-format.js';
import { dayLabel } from './content.js';

const KIND_LABEL = {
  'water.meter': 'Water meter', 'feed.meter': 'Feed meter', 'feed.silo': 'Silo', 'water.flow': 'Flow test', 'water.flowtest': 'Flow test',
  'water.height': 'Nipples', 'floor.temp': 'Floor', 'floor.probe': 'Floor', litter: 'Litter', 'litter.squeeze': 'Litter', lux: 'Light',
  dead: 'Dead birds', 'vent.temp': 'Vent', crop: 'Crop', grade: 'Grading', box: 'Box scale', weigh: 'Weighing', 'house.temp': 'House',
  look: 'Look', filter: 'Filter', controller: 'Controller', text: 'Note', setting: 'Set', 'grade.sheet': 'Grading', cull: 'Cull', tip: 'Chicks out', order: 'Feed order',
  // Phase 3 readings
  'light.lux': 'Light', air: 'Air', 'air.probe': 'Air', bird: 'Bird', 'sample.bird': 'Bird', fans: 'Fan panel', 'fans.read': 'Fan panel', gas: 'Gas', 'gas.meter': 'Gas',
  watch: 'Flock watch', // PHASE4.md §15.1: the early warnings
  // Skills update (SKILLS.md §8): what a controller did, an equipment fault and its fix, a new skill level (the unlock caption)
  auto: 'Controller', fault: 'Equipment', skill: 'Skill',
  pad: 'Pad', 'pad.check': 'Pad', ticket: 'Ticket', 'load.ticket': 'Ticket', swab: 'Swab', 'clean.swab': 'Swab', letter: 'Letter', booking: 'Phone', 'phone.bookCatch': 'Phone', 'phone.bookChicks': 'Phone',
};
/** A note's label: a fans reading Ventilation 2 took at the controller's Ventilation tab says so (this check round). */
export const noteLabel = (n) => (n.kind === 'fans' && n.value?.at === 'controller' ? 'Controller · fans' : KIND_LABEL[n.kind] || n.kind);
// where a reading was taken, in words (the brooding floor's six parts); a place off it is left out
const whereText = (w) => { const s = Array.isArray(w) ? placeWords(w[0], w[1]) : ''; return s ? ` · ${s}` : ''; };

export function buildNotebookPanel(L) {
  const titleId = uniqueId('nb-title');
  const { el, closeBtn } = dialogShell('notebook', titleId, L.close);
  const body = h('div', { class: 'nb-pages' });
  const squeeze = button({ class: 'btn btn--paper' }, h('span', { html: ICONS.hand, 'aria-hidden': 'true' }), 'Squeeze the litter here (Q)');
  squeeze.addEventListener('click', () => { L.close(); L.squeeze(); });
  el.append(h('div', { class: 'nb-cover' },
    h('header', { class: 'nb-head' }, h('span', { html: ICONS.notebook, 'aria-hidden': 'true' }), h('h2', { id: titleId }, 'Notebook'),
      h('p', null, 'What you read and saw, as you took it. The clock stops while it is open.')),
    h('div', { class: 'nb-paper' }, h('div', { class: 'nb-tools' }, squeeze), body)), closeBtn);

  function render() {
    const notes = L.records.notebook || [];
    const days = [...new Set(notes.map((n) => n.day))].sort((a, b) => b - a);
    if (!days.length) { body.replaceChildren(h('p', { class: 'nb-empty' }, 'Nothing written yet. Readings go in here as you take them: the meter, a flow test, the floor thermometer (T), a handful of litter (Q).')); return; }
    body.replaceChildren(...days.map((d) => h('section', { class: 'nb-day' },
      h('h3', null, dayLabel(d)),
      h('ul', null, notes.filter((n) => n.day === d).slice().reverse().map((n) => h('li', { class: `nb-line nb-line--${n.kind.replace('.', '-')}` },
        h('span', { class: 'nb-t' }, hhmm(n.hour)), h('span', { class: 'nb-k' }, noteLabel(n)), h('span', { class: 'nb-v' }, readingText(n.kind, n.value), whereText(n.where))))))));
  }
  return { el, kind: 'paused', onOpen: render, update(dt, force) { if (force) render(); } };
}
