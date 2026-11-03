// The office desk: the flock record book (Today, Week, Graphs once unlocked, Phone) with the radio
// on top of Today. Nothing is coloured as good or bad; a reading not taken shows "not read".
// Owner: package "level". PHASE2.md §8.
import { LEVEL1, weightAt } from './config.js';
import { h, button, setText, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { int, one, two, signedPct, hhmm, readingText, dayTime } from './ui-format.js';

// What "Today" lists, in job order: [note kind(s), label]
const TODAY_LINES = [
  [['water.meter'], 'Water meter'],
  [['feed.meter'], 'Feed meter'],
  [['feed.silo'], 'Silo gauge'],
  [['water.flow', 'water.flowtest'], 'Flow per line'],
  [['water.height'], 'Nipple heights'],
  [['filter', 'water.filter'], 'Filter gauges'],
  [['floor.temp', 'floor.probe'], 'Floor temperature'],
  [['vent.temp', 'sample.vent'], 'Vent temperatures'],
  [['crop', 'sample.crop'], 'Crop check'],
  [['litter', 'litter.squeeze'], 'Litter squeezes'],
  [['dead', 'dead.count'], 'Dead birds counted'],
  [['controller', 'controller.read'], 'Controller'],
  [['weigh', 'sample.weigh'], 'Birds weighed'],
  [['look'], 'Look notes'],
];
const OPTIONAL = new Set(['Filter gauges', 'Vent temperatures', 'Crop check', 'Birds weighed', 'Nipple heights']);

export function buildRecordsPanel(L) {
  const { env, records, farm } = L;
  const titleId = uniqueId('book-title');
  const { el, closeBtn } = dialogShell('book', titleId, L.close);
  const tabs = ['Today', 'Week', 'Graphs', 'Phone'];
  const tabBtns = tabs.map((t) => button({ class: 'book-tab', role: 'tab', 'aria-selected': 'false' }, t));
  const pages = tabs.map(() => h('div', { class: 'book-page', role: 'tabpanel' }));
  let tab = 0;
  const show = (i) => { tab = i; tabBtns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); pages.forEach((p, j) => { p.hidden = i !== j; }); render(); };
  tabBtns.forEach((b, i) => b.addEventListener('click', () => show(i)));
  const head = h('header', { class: 'book-head' }, h('span', { class: 'book-icon', html: ICONS.book, 'aria-hidden': 'true' }),
    h('div', null, h('h2', { id: titleId }, 'Flock record · House 1'), h('p', null, `${LEVEL1.chicksPlaced.toLocaleString('en')} chicks · the clock stops while the book is open`)));
  el.append(h('div', { class: 'book-cover' }, head, h('div', { class: 'book-tabs', role: 'tablist' }, tabBtns), h('div', { class: 'book-paper' }, pages)), closeBtn);

  // ---- radio (top of Today) ----
  const forecast = h('p', { class: 'radio-text', 'aria-live': 'polite' });
  const radioBtn = button({ class: 'btn btn--paper' }, h('span', { html: ICONS.radio, 'aria-hidden': 'true' }), 'Turn on the radio');
  radioBtn.addEventListener('click', () => {
    const d = env.dayNumber;
    L.uiAct('radio.listen', { day: d });
    const f = farm.forecast?.(d);
    setText(forecast, f ? `Weather: ${f.text}` : 'Weather: no forecast');
  });
  const radio = h('div', { class: 'radio' }, radioBtn, forecast);

  // ---- phone ----
  const kgOpts = [1000, 2000, 3000, 4000];
  let kg = 2000;
  const kgBtns = kgOpts.map((k) => { const b = button({ class: 'btn btn--paper', 'aria-pressed': 'false' }, `${int(k)} kg`); b.addEventListener('click', () => { kg = k; render(); }); return b; });
  const orderBtn = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Order feed');
  const orderText = h('p', { class: 'book-note', 'aria-live': 'polite' });
  orderBtn.addEventListener('click', () => {
    const r = L.act('feed.order', { kg }) || {};
    setText(orderText, r.arriveDay != null ? `Ordered ${int(kg)} kg at ${env.timeLabel}. The feed truck comes ${dayTime(r.arriveDay + (r.arriveHour ?? 9) / 24)}.` : `Ordered ${int(kg)} kg at ${env.timeLabel}.`);
  });
  const vetBtn = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Report the deaths to the company vet');
  const vetText = h('p', { class: 'book-note', 'aria-live': 'polite' });
  vetBtn.addEventListener('click', () => { L.uiAct('phone.report', {}); setText(vetText, `Reported to the company vet at ${env.timeLabel}.`); });
  pages[3].append(h('h3', { class: 'book-h' }, 'Feed mill'), h('p', { class: 'book-note' }, 'Starter feed for the silos (capacity 6,000 kg). Ordered before 16:00, it comes the next morning at 09:00.'),
    h('div', { class: 'book-row' }, kgBtns), h('div', { class: 'book-row' }, orderBtn), orderText,
    h('h3', { class: 'book-h' }, 'Company vet'), h('div', { class: 'book-row' }, vetBtn), vetText);

  const signBtn = button({ class: 'btn btn--paper btn--ink' }, 'Sign today’s record');
  signBtn.addEventListener('click', () => { records.sign(env.dayNumber); render(); });

  function todayPage() {
    const d = env.dayNumber;
    const row = records.row?.(d);
    const out = [radio, h('h3', { class: 'book-h' }, d < 0 ? 'Prep day · the day before the chicks' : `Day ${fmt0(d)} · ${dayTime(env.day)}`)];
    if (d < 0) {
      const prep = L.jobs().filter((i) => i.day === -1);
      out.push(h('table', { class: 'ledger' }, h('tbody', null, prep.map((i) => h('tr', null, h('th', { scope: 'row' }, i.def.title),
        h('td', null, i.status === 'done' ? `done ${hhmm(((i.doneAt ?? 0) - Math.floor(i.doneAt ?? 0)) * 24)}` : i.status === 'missed' ? 'not done' : '—'))))));
    } else {
      const notes = records.notesOf ? records.notesOf(d) : [];
      out.push(h('table', { class: 'ledger' }, h('tbody', null, TODAY_LINES.map(([kinds, label]) => {
        const got = notes.filter((n) => kinds.includes(n.kind));
        if (!got.length && OPTIONAL.has(label)) return null;
        const cell = got.length ? h('td', null, h('ul', { class: 'ledger-list' }, got.slice(-12).map((n) => h('li', null, h('span', { class: 'ledger-t' }, hhmm(n.hour)), readingText(n.kind, n.value))))) : h('td', { class: 'not-read' }, '—  not read');
        return h('tr', null, h('th', { scope: 'row' }, label), cell);
      }))));
    }
    if (row && row.signed) out.push(h('p', { class: 'book-signed' }, `Signed. ${row.skillLines?.length ? row.skillLines.join(' · ') : ''}`));
    else out.push(h('div', { class: 'book-row book-row--sign' }, signBtn, h('span', { class: 'book-note' }, 'Signing closes today’s row.')));
    return out;
  }

  const weekPage = () => weekTable(L);

  function graphsPage() {
    if (!L.skills?.unlocked?.('waterTrend')) {
      return [h('div', { class: 'locked' }, h('span', { html: ICONS.lock, 'aria-hidden': 'true' }), h('p', null, 'The water trend graph comes with Water level 1 on the skill tree.'))];
    }
    const rows = (records.rows ? records.rows() : []).filter((r) => r.day >= 0);
    const per = rows.map((r) => ({ d: r.day, v: r.waterPerBirdMl, ratio: r.waterFeedRatio }));
    return [h('h3', { class: 'book-h' }, 'Water per 1,000 birds (L) and water : feed by day'), h('div', { class: 'graph', html: graphSvg(per) })];
  }

  function render() {
    const d = env.dayNumber;
    kgBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(kgOpts[i] === kg)));
    vetBtn.disabled = false;
    signBtn.disabled = !!records.row?.(d)?.signed;
    if (tab === 0) pages[0].replaceChildren(...todayPage());
    if (tab === 1) pages[1].replaceChildren(weekPage());
    if (tab === 2) pages[2].replaceChildren(...graphsPage());
  }
  return {
    el,
    kind: 'paused',
    onOpen() { setText(forecast, ''); show(tab); },
    update(dt, force) { if (force) render(); },
    showTab: show,
  };
}

export function weekTable(L, { dark = false } = {}) {
const { env, records, farm } = L;
  const rows = records.rows ? records.rows() : [];
  const d = env.dayNumber;
  const all = [];
  for (let day = LEVEL1.startDay; day <= LEVEL1.endDay; day++) all.push(rows.find((r) => r.day === day) || (day === d ? { ...(records.draft?.(day) || {}), day, draft: true } : { day, empty: true }));
  const chick = farm.stats?.chickWeightMeasuredG;
  const C = (v) => (v == null ? '—' : v);
  const head = ['Day', 'Alive', 'Deaths (culls)', 'Mortality %', 'Feed kg · g/bird', 'Water L · per 1,000 · change', 'Water : feed', 'Weight g', 'Target g', '× chick', 'Unif. %', 'FCR', 'Litter %', 'House min / max · target', 'Light h', 'Notes'];
  const tr = all.map((r) => h('tr', { class: r.draft ? 'is-draft' : r.empty ? 'is-empty' : '' },
    h('th', { scope: 'row' }, r.day < 0 ? 'Prep' : String(r.day)),
    h('td', null, C(r.alive != null ? int(r.alive) : null)),
    h('td', null, r.deaths != null ? `${int(r.deaths)} (${int(r.culls ?? 0)})` : '—'),
    h('td', null, r.mortalityCumPct != null ? two(r.mortalityCumPct) : '—'),
    h('td', null, r.feedKg != null ? `${int(r.feedKg)} · ${one(r.feedPerBirdG)}` : '—'),
    h('td', null, r.waterL != null ? `${int(r.waterL)} · ${one(r.waterPerBirdMl)} · ${signedPct(r.waterChangePct)}` : '—'),
    h('td', null, r.waterFeedRatio != null ? two(r.waterFeedRatio) : '—'),
    h('td', null, r.weightG != null ? `${int(r.weightG)} ${r.weightSource === 'weighed' ? '(weighed)' : '(scale)'}` : '—'),
    h('td', null, r.day >= 0 ? int(r.targetWeightG || weightAt(r.day)) : '—'),
    h('td', null, r.weightRatio != null ? two(r.weightRatio) : r.weightG != null && chick ? two(r.weightG / chick) : '—'),
    h('td', null, r.uniformityPct != null ? int(r.uniformityPct) : '—'),
    h('td', null, r.fcr != null ? two(r.fcr) : '—'),
    h('td', null, r.litterMoisturePct != null ? int(r.litterMoisturePct) : '—'),
    h('td', null, r.houseMinC != null ? `${one(r.houseMinC)} / ${one(r.houseMaxC)} · ${one(r.targetC)}` : r.day >= 0 && r.targetC ? `— · ${one(r.targetC)}` : '—'),
    h('td', null, r.lightHours != null ? one(r.lightHours) : '—'),
    h('td', { class: 'notes' }, [r.chickQualityNote, ...(r.notes || []), ...(r.skillLines || [])].filter(Boolean).join(' · ') || (r.draft ? 'today, not signed' : ''))));
  return h('div', { class: 'week' }, h('p', { class: 'book-note' }, `Feed and water: 24 h to this morning. Target weight: general practice. Week 1 target 4–5 × chick weight (Week 1 guide)${chick ? `; your chick weight ${one(chick)} g (box weighing)` : ''}.`),
    h('div', { class: 'ledger-scroll', tabindex: '0', role: 'region', 'aria-label': 'Week table' },
      h('table', { class: `ledger ledger--week${dark ? ' ledger--dark' : ''}` }, h('thead', null, h('tr', null, head.map((t) => h('th', { scope: 'col' }, t)))), h('tbody', null, tr))));
}

function graphSvg(pts) {
  const W = 520, H = 180, pad = 30;
  if (!pts.length) return '<p class="book-note">No signed rows yet.</p>';
  const max = Math.max(1, ...pts.map((p) => p.v || 0));
  const X = (d) => pad + (d / 7) * (W - pad * 2), Y = (v) => H - pad - (v / max) * (H - pad * 2);
  const bars = pts.map((p) => (p.v == null ? '' : `<rect x="${X(p.d) - 10}" y="${Y(p.v)}" width="20" height="${H - pad - Y(p.v)}" fill="var(--ledger-ink)" opacity="0.75"/><text x="${X(p.d)}" y="${Y(p.v) - 4}" font-size="10" text-anchor="middle">${one(p.v)}</text>`)).join('');
  const rmax = 3, RY = (r) => H - pad - (r / rmax) * (H - pad * 2);
  const ratio = pts.filter((p) => p.ratio != null).map((p, i) => `${i ? 'L' : 'M'}${X(p.d)} ${RY(p.ratio)}`).join('');
  const days = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => `<text x="${X(d)}" y="${H - 10}" font-size="10" text-anchor="middle">${d}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="Water per 1,000 birds by day, with water to feed ratio">${bars}${ratio ? `<path d="${ratio}" fill="none" stroke="var(--ledger-ink2)" stroke-width="2" stroke-dasharray="5 3"/>` : ''}${days}
    <text x="${W - pad}" y="14" font-size="10" text-anchor="end">dashed: water : feed (0–3)</text></svg>`;
}
