// Sign boards and equipment plates, drawn from content-signs.js and content-signs-cycle.js (the same data props paints
// the 3D boards from). Every fact shows its source in small text. Owner: package "run" (Phase 2: "level").
//   buildBoardPanel(id, env, onClose)  a painted sign board as a dialog (the clock stands still)
//   buildPlate(id, { open })           an engraved plate column for an equipment panel; while it is
//                                      open the clock stands still (reading is free), so a machine
//                                      that needs farm time folds its plate (plate.fold())
//   PICS[pic]                          small pictograms for sign items
import { BOARDS, BROODER_ROWS_L1, sourceLabel } from './content-signs.js';
import { boardsForDay } from './content-signs-cycle.js';
import { BOARDS_COND } from './content-signs-cond.js';

// Phase 3 (PHASE3.md §13.9): plates read the merged boards of the day (Phase 3 plates and the extra lines
// from their fromDay; the brooding week reads exactly Phase 2's). ui.js sets the day source once.
let plateDay = () => 0;
export function setPlateDay(fn) { plateDay = typeof fn === 'function' ? fn : () => 0; }
// Phase 4 (PHASE4.md §3.2): the run's condition (farm.condition) for the merged boards; ui.js sets the source once.
let plateCond = () => null;
export function setPlateCondition(fn) { plateCond = typeof fn === 'function' ? fn : () => null; }
/** The condition the boards are merged for now (null = the normal season). */
export const plateCondition = () => { try { return plateCond() || null; } catch { return null; } };
import { h, button, setText, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';

const src = (s, cls = 'src') => h('p', { class: cls }, h('span', { class: 'src-k' }, 'Source'), ` ${sourceLabel(s)}`);

// ---------- pictograms (inline SVG, paint colours from the tokens) ----------
const svg = (body, vb = '0 0 120 72') => `<svg class="pic" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const P = 'style="fill:none;stroke:var(--sign-paint);stroke-width:2;stroke-linecap:round;stroke-linejoin:round"';
const F = (c) => `style="fill:${c};stroke:none"`;
const chickSide = (x, y, s = 1, up = 0) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(${-up})">
  <ellipse cx="0" cy="0" rx="11" ry="8.5" ${F('var(--chick)')}/><circle cx="9" cy="-9" r="6" ${F('var(--chick)')}/>
  <path d="M14.5 -10 l5 1.5 -5 1.6z" ${F('var(--hen-beak)')}/><circle cx="10.5" cy="-10.5" r="1.1" ${F('var(--sign-face-lo)')}/></g>`;

export const PICS = {
  spread: svg(`<rect x="3" y="3" width="114" height="66" rx="3" ${P} stroke-dasharray="4 3"/>
    ${[...Array(24)].map((_, i) => `<circle cx="${12 + (i % 8) * 13.5 + (Math.floor(i / 8) % 2) * 6}" cy="${16 + Math.floor(i / 8) * 20}" r="3.2" ${F('var(--chick)')}/>`).join('')}
    <circle cx="60" cy="36" r="8" ${P} stroke-dasharray="3 2.5"/>`),
  'nipple-angle': svg(`<path d="M6 12h108" ${P}/><path d="M62 12v12" ${P}/><circle cx="62" cy="27" r="3" ${F('var(--hen-comb)')}/>
    <path d="M6 66h108" ${P} stroke-dasharray="3 3"/>${chickSide(46, 52, 1.25, 28)}<path d="M80 30a22 22 0 0 0-14 24" ${P} stroke-dasharray="2 3"/><text x="84" y="46" style="fill:var(--sign-paint);font:600 11px var(--font-display)">45°</text>`),
  squeeze: svg(`<path d="M20 44c0-12 8-20 20-20h10c6 0 10 4 10 9v13c0 9-7 16-16 16H34c-8 0-14-6-14-14z" ${P}/>
    <path d="M32 34v-8M40 32v-9M48 33v-8" ${P}/>${[...Array(9)].map((_, i) => `<circle cx="${74 + (i % 3) * 13}" cy="${28 + Math.floor(i / 3) * 12}" r="${3 + (i % 2)}" ${F('var(--sign-yellow)')}/>`).join('')}
    <path d="M64 46l6 0" ${P}/>`),
  navel: svg(`<ellipse cx="60" cy="40" rx="34" ry="26" ${F('var(--chick)')}/><circle cx="60" cy="46" r="5" ${P}/><path d="M48 18l-4-8M72 18l4-8" ${P}/>
    <path d="M38 66v-6M82 66v-6" style="stroke:var(--hen-beak);stroke-width:3;stroke-linecap:round"/>`),
  crop: svg(`${chickSide(50, 46, 2)}<circle cx="72" cy="40" r="9" ${P} stroke-dasharray="3 2.5"/><path d="M96 20l-16 14" ${P}/>`),
  droppings: svg(`<ellipse cx="34" cy="44" rx="18" ry="10" ${F('var(--wood)')}/><ellipse cx="34" cy="38" rx="8" ry="4" ${F('var(--sign-paint)')}/>
    <ellipse cx="86" cy="46" rx="22" ry="8" ${F('rgba(160,150,90,0.7)')}/><path d="M68 46c6-3 12 3 18 0s12 3 18 0" ${P}/>`),
  'pan-on-litter': svg(`<path d="M4 58h112" ${P}/>${[...Array(14)].map((_, i) => `<circle cx="${8 + i * 8}" cy="${62 + (i % 2) * 3}" r="2.4" ${F('var(--sign-yellow)')}/>`).join('')}
    <path d="M60 6v24" ${P}/><path d="M30 46c0-10 60-10 60 0l-4 12H34z" ${F('var(--feeder, #e0582c)')}/><path d="M38 46h44" style="stroke:var(--sign-yellow);stroke-width:5;stroke-linecap:round"/>
    ${chickSide(18, 46, 0.9, 10)}`),
};

/** A painted sign board (sign-*): Phase 2's BOARDS and Phase 3's BOARDS_CYCLE, merged for the day
 *  (boardsForDay: the extra lines from their fromDay; the brooding week reads exactly Phase 2's). */
export function buildBoardPanel(id, env, onClose) {
  const boardOf = () => boardsForDay(env.dayNumber, plateCondition())[id] || BOARDS[id] || BOARDS_COND[id]; // Phase 4: sign-power
  let b = boardOf(), itemsDay = env.dayNumber;
  const titleId = uniqueId('board-title');
  const many = b.items.length > 5 || !!b.table;
  const { el, closeBtn } = dialogShell(`sign sign--board${many ? ' sign--wide' : ''}`, titleId, onClose);
  const head = h('header', { class: 'sign-head' },
    b.kicker ? h('p', { class: 'sign-kicker' }, b.kicker) : null,
    h('h2', { class: 'sign-title', id: titleId }, b.title),
    h('p', { class: 'sign-where' }, h('span', { html: ICONS.pin, 'aria-hidden': 'true' }), b.where));
  const itemsOf = (bd) => bd.items.map((it) => h('li', { class: `board-item${it.pic ? ' has-pic' : ''}` },
    it.pic && PICS[it.pic] ? h('span', { class: 'board-pic', html: PICS[it.pic] }) : null,
    h('div', null, h('p', { class: 'sign-text' }, it.text), src(it.source))));
  const items = h('ul', { class: 'board-items' }, itemsOf(b));

  let todayRow = null, todayDay = null;
  const rows = [];
  let body;
  if (b.table) {
    const trs = b.table.rows.map((r) => {
      const tr = h('tr', null, h('th', { scope: 'row' }, r.day === 0 ? 'Day 0' : `Day ${r.day}`),
        h('td', null, `${r.temp} °C`),
        h('td', { class: 'approx' }, sourceLabel(r.source)));
      rows.push({ day: r.day, tr });
      return tr;
    });
    todayRow = h('strong');
    const table = h('div', { class: 'sign-col' },
      h('p', { class: 'sign-today' }, h('span', { class: 'sign-today-k' }, 'Your flock today'), todayRow),
      h('table', { class: 'sign-table' }, h('caption', { class: 'sr-only' }, 'House temperature by day'),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col', class: 'th-temp' }, 'House temperature'), h('th', { scope: 'col', class: 'th-src' }, 'Source'))),
        h('tbody', null, trs)),
      h('p', { class: 'sign-note' }, b.table.note),
      h('p', { class: 'sign-note' }, 'Each row shows its source in the last column.'));
    body = h('div', { class: 'sign-body' }, h('div', { class: 'sign-grid' }, table, h('div', { class: 'sign-col' }, items)));
  } else {
    body = h('div', { class: 'sign-body' }, items);
  }
  const board = h('div', { class: 'sign-board' }, ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `bolt bolt--${p}`, 'aria-hidden': 'true' })),
    h('div', { class: 'sign-face' }, head, body));
  el.append(board, closeBtn);
  return {
    el,
    kind: 'sign',
    update() {
      // a board read on a later day shows the lines added from that day (PHASE3.md §5.4)
      if (env.dayNumber !== itemsDay) { itemsDay = env.dayNumber; const nb = boardOf(); if (nb.items.length !== b.items.length) { b = nb; items.replaceChildren(...itemsOf(b)); } }
      if (!todayRow) return;
      const d = env.dayNumber;
      if (d === todayDay) return;
      todayDay = d;
      setText(todayRow, d < 0 ? 'prep day' : `day ${fmt0(d)}`);
      let best = rows[0];
      for (const r of rows) if (r.day <= Math.max(0, d)) best = r;
      for (const r of rows) r.tr.classList.toggle('is-today', r === best);
    },
  };
}

/** An engraved plate (equipment facts). open = shown at first; the clock stands still while open. */
export function buildPlate(id, { open = true, day, condition } = {}) {
  // a condition's plate reads its own board when no condition is on the farm (the panels' harness runs)
  const b = boardsForDay(day ?? plateDay(), condition !== undefined ? condition : plateCondition())[id] || BOARDS[id] || BOARDS_COND[id];
  if (!b) throw new Error(`no board or plate '${id}' for day ${day ?? plateDay()} (condition ${condition ?? plateCondition()})`);
  const bodyId = uniqueId('plate');
  const toggle = button({ class: 'plate-head', 'aria-expanded': String(open), 'aria-controls': bodyId },
    h('span', { class: 'plate-icon', html: ICONS.facts, 'aria-hidden': 'true' }),
    h('span', { class: 'plate-title' }, h('small', null, 'Plate'), b.title),
    h('span', { class: 'plate-chev', html: ICONS.chevron, 'aria-hidden': 'true' }));
  const note = h('p', { class: 'plate-clock' }, 'The clock stands still while you read the plate.');
  const body = h('div', { class: 'plate-body', id: bodyId },
    h('ul', { class: 'plate-items' }, b.items.map((it) => h('li', null,
      it.pic && PICS[it.pic] ? h('span', { class: 'plate-pic', html: PICS[it.pic] }) : null,
      h('p', null, it.text), src(it.source, 'src plate-src')))), note);
  const el = h('aside', { class: 'plate', 'aria-label': `Plate: ${b.title}` }, h('span', { class: 'rivet rivet--l', 'aria-hidden': 'true' }), h('span', { class: 'rivet rivet--r', 'aria-hidden': 'true' }), toggle, body);
  const set = (on) => { el.classList.toggle('is-open', on); toggle.setAttribute('aria-expanded', String(on)); body.hidden = !on; };
  toggle.addEventListener('click', () => set(!el.classList.contains('is-open')));
  set(open);
  return { el, id, get open() { return el.classList.contains('is-open'); }, fold: () => set(false), unfold: () => set(true) };
}
