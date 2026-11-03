// The farmer's notebook (N): every reading as he took it, by day, newest day first, with his look
// notes. The same readings the office book lists. The clock stops while it is open.
// Owner: package "level".
import { h, button, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { hhmm, readingText } from './ui-format.js';

const KIND_LABEL = {
  'water.meter': 'Water meter', 'feed.meter': 'Feed meter', 'feed.silo': 'Silo', 'water.flow': 'Flow test', 'water.flowtest': 'Flow test',
  'water.height': 'Nipples', 'floor.temp': 'Floor', 'floor.probe': 'Floor', litter: 'Litter', 'litter.squeeze': 'Litter', lux: 'Light',
  dead: 'Dead birds', 'vent.temp': 'Vent', crop: 'Crop', grade: 'Grading', box: 'Box scale', weigh: 'Weighing', 'house.temp': 'House',
  look: 'Look', filter: 'Filter', controller: 'Controller', text: 'Note',
};

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
      h('h3', null, d < 0 ? 'Prep day' : `Day ${fmt0(d)}`),
      h('ul', null, notes.filter((n) => n.day === d).slice().reverse().map((n) => h('li', { class: `nb-line nb-line--${n.kind.replace('.', '-')}` },
        h('span', { class: 'nb-t' }, hhmm(n.hour)), h('span', { class: 'nb-k' }, KIND_LABEL[n.kind] || n.kind), h('span', { class: 'nb-v' }, readingText(n.kind, n.value), n.where ? ` · ${n.where}` : '')))))));
  }
  return { el, kind: 'paused', onOpen: render, update(dt, force) { if (force) render(); } };
}
