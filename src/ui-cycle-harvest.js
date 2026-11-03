// The loading bay on the catching night (PHASE3.md §1 Level 6, §6.9, §13.7). Package "panels". A plan of
// the house with the crew's eight sections (waiting, penned, catching, done), each truck's crates, and the
// printed weight tickets (load.ticket { truck }: crates, birds, gross, empty truck, net, dead on arrival).
// The ticket is the plant's paper: plain numbers, the farmer works out the mean weight himself.
import { HARVEST, HOUSE_BOUNDS } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell } from './ui-equipment.js';
import { int } from './ui-format.js';
import { whenText, ticketOf } from './ui-cycle-kit.js';

const SEC_LOOK = { waiting: 'birds waiting', penned: 'penned', catching: 'being caught', done: 'empty' };

function sectionsSvg(hv) {
  const W = 384, Hh = 96, L = HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin;
  const secs = (hv?.sections || []).map((s) => {
    const x = ((s.x0 - HOUSE_BOUNDS.xMin) / L) * W, w = ((s.x1 - s.x0) / L) * W;
    const fill = s.state === 'done' ? '#5c5f5d' : 'var(--hen)';
    const op = s.state === 'done' ? 1 : s.state === 'catching' ? 0.55 : 0.85;
    const pen = s.state === 'penned' || s.state === 'catching' ? `<path d="M${(x + 2).toFixed(1)} 4v${Hh - 8}M${(x + w - 2).toFixed(1)} 4v${Hh - 8}" stroke="var(--sign-yellow)" stroke-width="3"/>` : '';
    const stripes = s.state === 'catching' ? `<path d="${Array.from({ length: 6 }, (_, k) => `M${(x + 4 + k * (w - 8) / 6).toFixed(1)} ${Hh - 6}l${((w - 8) / 6).toFixed(1)} -${Hh - 12}`).join('')}" stroke="var(--case-ink)" stroke-width="1.2" opacity="0.5"/>` : '';
    return `<rect x="${(x + 1).toFixed(1)}" y="2" width="${(w - 2).toFixed(1)}" height="${Hh - 4}" fill="${fill}" opacity="${op}"/>${stripes}${pen}
      <text x="${(x + w / 2).toFixed(1)}" y="${Hh + 12}" font-size="10" text-anchor="middle" fill="var(--key-sub)" font-family="var(--font-display)">${s.i + 1}</text>`;
  }).join('');
  const doorX = ((-14 - HOUSE_BOUNDS.xMin) / L) * W;
  return `<svg viewBox="-4 -14 ${W + 8} ${Hh + 30}" aria-hidden="true"><rect x="0" y="0" width="${W}" height="${Hh}" fill="none" stroke="var(--plate-edge)" stroke-width="2"/>${secs}
    <rect x="${(doorX - 10).toFixed(1)}" y="${Hh - 2}" width="20" height="6" fill="var(--accent)"/>
    <text x="${doorX.toFixed(1)}" y="-4" font-size="10" text-anchor="middle" fill="var(--key-sub)" font-family="var(--font-display)">door</text></svg>`;
}

export function buildLoadingBay(api) {
  const { L } = api;
  const { env, farm } = L;
  const shell = equipShell({ cls: 'equip--bay', icon: ICONS.truck, title: 'Loading bay', sub: 'Catching crew · two trucks · weight tickets', plates: ['loading-bay'], signLinks: ['sign-catch'], onClose: L.close });
  const plan = h('div', { class: 'cyc-plan' });
  const crew = h('p', { class: 'cyc-line', 'aria-live': 'polite' });
  const tickets = Array.from({ length: HARVEST.trucks }, (_, i) => {
    const body = h('div');
    const b = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), `Read the ticket of truck ${i + 1}`);
    const el = h('div', { class: 'cyc-ticket', 'data-truck': String(i) }, h('h4', null, `Truck ${i + 1} · weight ticket`), body, b);
    const t = { i, el, body, b, read: null };
    b.addEventListener('click', () => { t.read = { ...ticketOf(L.act('load.ticket', { truck: i })), at: env.timeLabel }; drawTicket(t); refresh(); });
    return t;
  });
  shell.main.append(plan, crew, h('div', { class: 'cyc-tickets' }, tickets.map((t) => t.el)));

  function drawTicket(t) {
    const r = t.read;
    t.el.dataset.gross = String(r.grossKg); t.el.dataset.tare = String(r.tareKg); t.el.dataset.net = String(r.netKg); t.el.dataset.birds = String(r.birds);
    const row = (k, v) => [h('dt', null, k), h('dd', null, v)];
    t.body.replaceChildren(h('dl', null, row('Crates', int(r.crates)), row('Birds loaded', int(r.birds)), row('Gross', `${int(r.grossKg)} kg`),
      row('Empty truck', `${int(r.tareKg)} kg`), row('Net', `${int(r.netKg)} kg`), row('Dead on arrival', r.doa == null ? '—' : int(r.doa)), row('Read', r.at)));
  }
  function refresh() {
    const hv = farm.harvest || {};
    const k = (hv.sections || []).map((s) => s.state).join();
    if (plan.__k !== k) { plan.__k = k; plan.innerHTML = sectionsSvg(hv); }
    const secs = hv.sections || [], done = secs.filter((s) => s.state === 'done').length, now = secs.find((s) => s.state === 'catching');
    if (!hv.started) setText(crew, hv.catchAt != null ? `The crew and the trucks come ${whenText(hv.catchAt)}.` : 'No catch booked yet: the company’s default is day 42, 02:00.');
    else if (!hv.result) setText(crew, `Sections caught: ${done} of ${secs.length}${now ? ` · the crew is at section ${now.i + 1}` : ''}. ${secs.map((s) => `${s.i + 1} ${SEC_LOOK[s.state] || s.state}`).join(' · ')}`);
    else setText(crew, 'The house is empty. The trucks have left for the plant.');
    for (const t of tickets) {
      const tr = hv.trucks?.[t.i] || {};
      const ready = !!tr.left || (tr.crates || 0) >= HARVEST.cratesPerTruck;
      t.b.hidden = !ready || !!t.read;
      if (!t.read) t.body.replaceChildren(h('p', { class: 'cyc-wait' }, !hv.started ? 'No birds loaded.' : ready ? 'Weighed: the ticket is here.' : `Loading: ${int(tr.crates || 0)} of ${HARVEST.cratesPerTruck} crates on.`));
    }
  }
  let acc = 0;
  return { el: shell.el, onOpen() { shell.refreshPlates(); }, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.4; refresh(); } } };
}
