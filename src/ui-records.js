// The office desk: the flock record book (Today, Week, Plan, Harvest, Clean-out, Letters, Graphs, Phone)
// with the radio on top of Today. Nothing is coloured as good or bad; a reading not taken shows "not
// read". Owner: package "run" (Phase 2: "level"). PHASE2.md §8, PHASE3.md §8.
//   Week      one table per level (Week 1 · Week 2 · Week 3 · Week 4 · Week 5 · Finishing · Clean-out), rows of
//             past levels stay readable all cycle
//   Plan      the contract, his sheet and the company's reply (while the run has a plan; on the planning
//             day *Open the planning sheet*); planVsCycle adds the running cycle's numbers
//   Harvest, Clean-out, Letters  ui-letters.js; Graphs  ui-summary.js
//   Phone     feed by type, the company vet, the catching crew, the hatchery: the bookings are farm.act
//             calls and the line under them is what the phone answered (its reason, as given)
// Phase 4 (PHASE4.md §3.3, §4.3): the header names the run's condition ("Flock record · House 1 · Hot season"); in the
//             brooding week the Phone page has *Call the hatchery* (ui action phone.hatchery { chickWeightG, weakPct }:
//             the chick quality on the day the chicks came; a bad batch's graded-out chicks are claimed once it is told)
import { LEVEL1, FEED_TYPES, HARVEST, PLAN_LEVEL, levelOfDay, weightAt, feedTypeForDay, conditionLabel } from './config.js';
import { h, button, setText, uniqueId, fmt0, nodes } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { int, one, two, signedPct, hhmm, readingText, dayTime } from './ui-format.js';
import { jobById } from './content-jobs.js';
import { dayLabel } from './content.js';
import { sourceLabel } from './content-signs.js';
import { planPage, harvestPage, cleanPage, lettersPage } from './ui-letters.js';
import { graphsPage } from './ui-summary.js';
import { createJobStrip } from './ui-jobstrip.js';
import { needTime } from './ui-farmtime.js';

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
  [['lux', 'light.lux'], 'Light at bird level'],
  [['air', 'air.probe'], 'Air at bird height'],
  [['bird', 'sample.bird'], 'Birds in the hand'],
  [['litter', 'litter.squeeze'], 'Litter squeezes'],
  [['dead', 'dead.count'], 'Dead birds counted'],
  [['controller', 'controller.read'], 'Controller'],
  [['fans', 'fans.read'], 'Fan panel'],
  [['gas', 'gas.meter'], 'Gas tank'],
  [['weigh', 'sample.weigh'], 'Birds weighed'],
  // Phase 4: the conditions' readings (shown on a day that has them)
  [['tank', 'water.tank'], 'Water tank and pump'],
  [['water.test'], 'Water test'],
  [['generator', 'gen.test', 'gen.start', 'gen.stop', 'gen.switch'], 'Generator'],
  [['chicks.grade'], 'Chicks graded'],
  [['look'], 'Look notes'],
];
const OPTIONAL = new Set(['Filter gauges', 'Vent temperatures', 'Crop check', 'Birds weighed', 'Nipple heights', 'Light at bird level', 'Air at bird height', 'Birds in the hand', 'Fan panel', 'Gas tank',
  'Water tank and pump', 'Water test', 'Generator', 'Chicks graded']);
const RECORD_JOBS = new Set(['r-record', 'prep-record', 'pl-record']);

// The week tables of the cycle: one per level, weeks 4 and 5 as two (PHASE3.md §1 Level 5)
export const WEEK_TABS = [
  { id: 'w1', label: 'Week 1', from: -1, to: 7 }, { id: 'w2', label: 'Week 2', from: 8, to: 14 }, { id: 'w3', label: 'Week 3', from: 15, to: 21 },
  { id: 'w4', label: 'Week 4', from: 22, to: 28 }, { id: 'w5', label: 'Week 5', from: 29, to: 35 }, { id: 'fin', label: 'Finishing', from: 36, to: 42 },
  { id: 'clean', label: 'Clean-out', from: 43, to: 46 },
];

export function buildRecordsPanel(L) {
  const { env, records, farm } = L;
  const titleId = uniqueId('book-title');
  const { el, closeBtn } = dialogShell('book', titleId, L.close);
  const TABS = [
    { id: 'today', label: 'Today', page: () => todayPage() },
    { id: 'week', label: 'Week', page: () => weekPage() },
    { id: 'plan', label: 'Plan', page: () => planPage(L), when: () => !!(L.run()?.state().plan || farm.plan || env.dayNumber <= PLAN_LEVEL.endDay) },
    { id: 'harvest', label: 'Harvest', page: () => harvestPage(L), when: () => env.dayNumber >= 36 },
    { id: 'clean', label: 'Clean-out', page: () => cleanPage(L), when: () => env.dayNumber >= 43 },
    { id: 'letters', label: 'Letters', page: () => lettersPage(L, () => render()) },
    { id: 'graphs', label: 'Graphs', page: () => graphsPage(L) },
    { id: 'phone', label: 'Phone', page: () => phonePage() },
  ];
  const tabBtns = TABS.map((t) => button({ class: 'book-tab', role: 'tab', 'aria-selected': 'false' }, t.label));
  const pages = TABS.map(() => h('div', { class: 'book-page', role: 'tabpanel' }));
  let tab = 0, weekTab = null;
  // the open job done on the phone (orders, the vet): its strip at the top of the Phone page
  const phoneStrip = createJobStrip(L, 'office-desk');
  const show = (i) => { tab = i; tabBtns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); pages.forEach((p, j) => { p.hidden = i !== j; }); render(); };
  tabBtns.forEach((b, i) => b.addEventListener('click', () => show(i)));
  const sub = h('p');
  const titleEl = h('h2', { id: titleId }, 'Flock record · House 1');
  const head = h('header', { class: 'book-head' }, h('span', { class: 'book-icon', html: ICONS.book, 'aria-hidden': 'true' }),
    h('div', null, titleEl, sub));
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

  const signBtn = button({ class: 'btn btn--paper btn--ink' }, 'Sign today’s record');
  signBtn.addEventListener('click', () => { records.sign(env.dayNumber); render(); });
  // the record job of today has not opened yet (before 16:00): signing waits for the evening
  const signWait = () => L.jobs().some((i) => i.day === env.dayNumber && RECORD_JOBS.has(i.id) && i.status === 'waiting');

  function todayPage() {
    const d = env.dayNumber;
    const row = records.row?.(d);
    const out = [radio, h('h3', { class: 'book-h' }, d < 0 ? `${dayLabel(d)} · ${d === -2 ? 'no birds yet' : 'the day before the chicks'}` : `${dayLabel(d)} · ${hhmm(env.hour)}`)];
    if (d < 0 || (d > 46 && !farm.flock.alive)) {
      // the planning day, the prep day and the rest: the day's jobs and when they were done
      const jobs = L.jobs().filter((i) => i.day === d);
      out.push(h('table', { class: 'ledger' }, h('tbody', null, jobs.map((i) => h('tr', null, h('th', { scope: 'row' }, i.def.title),
        h('td', null, i.status === 'done' ? `done ${hhmm(((i.doneAt ?? 0) - Math.floor(i.doneAt ?? 0)) * 24)}` : i.status === 'missed' ? 'not done' : '—'))))));
    } else {
      const notes = records.notesOf ? records.notesOf(d) : [];
      out.push(h('table', { class: 'ledger' }, h('tbody', null, TODAY_LINES.map(([kinds, label]) => {
        const got = notes.filter((n) => kinds.includes(n.kind));
        if (!got.length && (OPTIONAL.has(label) || (d > 42 && label !== 'Look notes'))) return null;
        const cell = got.length ? h('td', null, h('ul', { class: 'ledger-list' }, got.slice(-12).map((n) => h('li', null, h('span', { class: 'ledger-t' }, hhmm(n.hour)), readingText(n.kind, n.value))))) : h('td', { class: 'not-read' }, '—  not read');
        return h('tr', null, h('th', { scope: 'row' }, label), cell);
      }))));
    }
    if (row && row.signed) out.push(h('p', { class: 'book-signed' }, `Signed. ${row.skillLines?.length ? row.skillLines.join(' · ') : ''}`));
    else out.push(h('div', { class: 'book-row book-row--sign' }, signBtn, h('span', { class: 'book-note' }, signWait() ? 'The day’s record is signed in the evening, from 16:00.' : 'Signing closes today’s row.')));
    return out;
  }

  function weekPage() {
    const d = env.dayNumber;
    const reached = WEEK_TABS.filter((w) => w.from <= Math.max(d, -1));
    const cur = reached.find((w) => d >= w.from && d <= w.to) || reached[reached.length - 1] || WEEK_TABS[0];
    if (!weekTab || !reached.includes(weekTab)) weekTab = cur;
    const subTabs = reached.length > 1 ? h('div', { class: 'book-subtabs', role: 'tablist', 'aria-label': 'Week tables' }, reached.map((w) => {
      const b = button({ class: 'book-subtab', role: 'tab', 'aria-selected': String(w === weekTab) }, w.label);
      b.addEventListener('click', () => { weekTab = w; render(); });
      return b;
    })) : null;
    return [subTabs, weekTable(L, { from: weekTab.from, to: weekTab.to })];
  }

  // ---- phone (PHASE3.md §13.3: the bookings are farm actions; the line under each is what the phone said) ----
  const kgOpts = [1000, 2000, 3000, 4000, 6000];
  let kg = 2000, feedType = null;
  const phoneLines = { order: '', vet: '', report: '', crew: '', hatchery: '', quality: '' };
  const say = (k, s) => { phoneLines[k] = s; render(); };
  function select(opts, value, onChange, label) {
    const s = h('select', { class: 'book-select', 'aria-label': label }, opts.map(([v, t]) => h('option', { value: String(v), ...(String(v) === String(value) ? { selected: true } : {}) }, t)));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  let crewDay = HARVEST.catchDefault.day, crewHour = HARVEST.catchDefault.hour, chickDay = null;
  function phonePage() {
    const d = env.dayNumber;
    const type = feedType || feedTypeForDay(Math.max(0, d)).id;
    phoneStrip.update();
    const out = [phoneStrip.el];
    // feed mill
    const typeBtns = FEED_TYPES.map((t) => { const b = button({ class: 'btn btn--paper', 'aria-pressed': String(t.id === type) }, t.label); b.addEventListener('click', () => { feedType = t.id; render(); }); return b; });
    const kgBtns = kgOpts.map((k) => { const b = button({ class: 'btn btn--paper', 'aria-pressed': String(k === kg) }, `${int(k)} kg`); b.addEventListener('click', () => { kg = k; render(); }); return b; });
    const order = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Order feed');
    order.addEventListener('click', () => {
      const r = L.act('feed.order', { kg, type }) || {};
      const clock = needTime('the feed truck comes as farm time passes; the clock runs once you close the book (Next job skips ahead)').text;
      const label = FEED_TYPES.find((t) => t.id === type)?.label.toLowerCase() || type;
      const took = r.kg != null && r.kg !== kg ? ` The silo had room for ${int(r.kg)} kg.` : '';
      say('order', `${r.arriveDay != null ? `Ordered ${int(r.kg ?? kg)} kg of ${label} at ${env.timeLabel}. The feed truck comes ${dayTime(r.arriveDay + (r.arriveHour ?? 9) / 24)}.${took}` : `Ordered ${int(kg)} kg of ${label} at ${env.timeLabel}.${took}`} ${clock}`);
    });
    out.push(h('h3', { class: 'book-h' }, 'Feed mill'),
      h('p', { class: 'book-note book-note--fact' }, 'Two silos of 6,000 kg: starter and finisher go to silo 1, grower to silo 2. Ordered before 16:00, it comes the next morning at 09:00.',
        h('small', { class: 'book-src' }, `Source: ${sourceLabel('general')} · the Feed program sign and the silo plate`)),
      h('div', { class: 'book-row' }, typeBtns), h('div', { class: 'book-row' }, kgBtns), h('div', { class: 'book-row' }, order), h('p', { class: 'book-note', 'aria-live': 'polite' }, phoneLines.order));
    // the company vet
    const report = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Report the deaths to the company vet');
    report.addEventListener('click', () => { L.uiAct('phone.report', {}); say('report', `Reported to the company vet at ${env.timeLabel}.`); });
    const reasons = d >= 8 ? ['Blood in the droppings', 'Birds sitting hunched, white watery droppings', 'Birds that cannot walk well', 'Something else in the flock'] : [];
    const vetBtns = reasons.map((why) => { const b = button({ class: 'btn btn--paper' }, why); b.addEventListener('click', () => {
      L.uiAct('phone.vet', { reason: why.toLowerCase() });
      // the steps hotfix: the letter comes over farm time: a paused clock runs again once the book closes
      say('vet', `You told the vet: ${why.toLowerCase()}, at ${env.timeLabel}. The vet’s answer comes as a letter on the desk. ${needTime('the letter comes as farm time passes; the clock runs once you close the book').text}`);
    }); return b; });
    out.push(h('h3', { class: 'book-h' }, 'Company vet'), h('div', { class: 'book-row' }, report), h('p', { class: 'book-note', 'aria-live': 'polite' }, phoneLines.report));
    if (vetBtns.length) out.push(h('p', { class: 'book-note' }, 'Call the vet about:'), h('div', { class: 'book-row' }, vetBtns), h('p', { class: 'book-note', 'aria-live': 'polite' }, phoneLines.vet));
    // Phase 4: the hatchery about the chicks that came (the brooding week; a bad batch's claim needs the call on day 0)
    if (d >= 0 && d <= LEVEL1.endDay) {
      const b = L.level()?.badBatch?.() || {}, w = farm.stats?.chickWeightMeasuredG ?? null;
      const weakPct = b.looked > 0 ? (100 * b.weak) / b.looked : null;
      const call = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Call the hatchery about the chicks');
      call.addEventListener('click', () => {
        L.uiAct('phone.hatchery', { chickWeightG: w != null ? Math.round(w * 10) / 10 : null, weakPct: weakPct != null ? Math.round(weakPct * 10) / 10 : null });
        say('quality', `You told the hatchery at ${env.timeLabel}, day ${d}: ${w != null ? `chicks of ${one(w)} g (your box weighing)` : 'the box not weighed'}${weakPct != null ? `, ${one(weakPct)} % weak at the grading (${int(b.gradedOut)} graded out)` : ''}.`);
      });
      out.push(h('h3', { class: 'book-h' }, 'Hatchery: the chicks that came'),
        h('p', { class: 'book-note book-note--fact' }, 'Chicks you grade out on the day they come are counted apart and claimed back once the hatchery is told the same day.',
          h('small', { class: 'book-src' }, `Source: ${sourceLabel('general')} · the chick sign`)),
        h('p', { class: 'book-note' }, `What you tell them: ${w != null ? `${one(w)} g a chick (box weighing)` : 'no box weighed yet'}${weakPct != null ? ` · ${one(weakPct)} % weak at the grading` : ''}.`),
        h('div', { class: 'book-row' }, call), h('p', { class: 'book-note', 'aria-live': 'polite' }, phoneLines.quality));
    }
    // the catching crew and the trucks (the last week)
    if (d >= 36 && d <= 42) {
      const hv = farm.harvest;
      const now = hv?.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24;
      const days = select([39, 40, 41, 42, 43].map((x) => [x, `Day ${x}`]), crewDay, (v) => { crewDay = +v; }, 'Catching day');
      const hours = select(Array.from({ length: 24 }, (_, i) => [i, hhmm(i)]), crewHour, (v) => { crewHour = +v; }, 'Catching time');
      const book = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Book the crew and the trucks');
      book.addEventListener('click', () => {
        const r = L.act('phone.bookCatch', { day: crewDay, hour: crewHour }) || {};
        say('crew', r.booked ? `Booked at ${env.timeLabel}: the crew and two trucks come ${dayTime(r.catchAt)}. ${needTime('the crew comes at the booked time as farm time passes (Next job skips ahead)').text}` : `The crew’s office: ${r.reason || 'no booking'}. The catch stays ${dayTime(r.catchAt ?? now)}.`);
      });
      out.push(h('h3', { class: 'book-h' }, 'Catching crew'), h('p', { class: 'book-note' }, `The catch now: ${dayTime(now)}${hv?.bookedAt != null ? ' (booked)' : ' (the company’s default)'}.`),
        h('div', { class: 'book-row' }, days, hours, book), h('p', { class: 'book-note', 'aria-live': 'polite' }, phoneLines.crew));
    }
    // the hatchery: the next chicks (clean-out and rest)
    if (d >= 43) {
      const c = farm.clean || {};
      const first = (c.closedDay ?? Math.max(d, 46)) + 1;
      if (chickDay == null) chickDay = Math.min(69, (c.closedDay ?? 46) + 21);
      const days = select(Array.from({ length: Math.max(1, 70 - first) }, (_, i) => first + i).map((x) => [x, `Day ${x}`]), chickDay, (v) => { chickDay = +v; }, 'Chick day');
      const book = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.phone, 'aria-hidden': 'true' }), 'Book the next chicks');
      book.addEventListener('click', () => {
        const r = L.act('phone.bookChicks', { day: chickDay }) || {};
        say('hatchery', r.booked ? `Booked at ${env.timeLabel}: the next chicks come on day ${r.bookedDay}. ${needTime('the house rests until then as farm time passes (Next job skips ahead)').text}` : `The hatchery: ${r.reason || 'no booking'}.`);
      });
      out.push(h('h3', { class: 'book-h' }, 'Hatchery'), h('p', { class: 'book-note' }, c.bookedDay != null ? `The next chicks: day ${c.bookedDay}.` : 'No chicks booked yet.'),
        h('div', { class: 'book-row' }, days, book), h('p', { class: 'book-note', 'aria-live': 'polite' }, phoneLines.hatchery));
    }
    return out;
  }

  function render() {
    const d = env.dayNumber;
    setText(sub, `${int(LEVEL1.chicksPlaced)} chicks · ${dayLabel(d, { bookedDay: farm.clean?.bookedDay })} · the clock stops while the book is open`);
    setText(titleEl, farm.condition ? `Flock record · House 1 · ${conditionLabel(farm.condition)}` : 'Flock record · House 1');
    TABS.forEach((t, i) => { tabBtns[i].hidden = t.when ? !t.when() : false; });
    if (tabBtns[tab].hidden) { tab = 0; tabBtns.forEach((b, j) => b.setAttribute('aria-selected', String(j === 0))); pages.forEach((p, j) => { p.hidden = j !== 0; }); }
    signBtn.disabled = !!records.row?.(d)?.signed || signWait();
    pages[tab].replaceChildren(...nodes(TABS[tab].page()));
  }
  return {
    el,
    kind: 'paused',
    onOpen() { setText(forecast, ''); weekTab = null; phoneStrip.onOpen(); show(tab); },
    onClose() { phoneStrip.onClose(); },
    update(dt, force) { if (force) render(); else if (TABS[tab].id === 'phone') phoneStrip.update(); },
    showTab: (i) => show(typeof i === 'string' ? Math.max(0, TABS.findIndex((t) => t.id === i || t.label === i)) : i),
  };
}

/** The week table of days from..to (Phase 2's brooding week by default). One line of numbers a day,
 *  the day's notes in a full-width row under it. */
export function weekTable(L, { dark = false, from = LEVEL1.startDay, to = LEVEL1.endDay } = {}) {
  const { env, records, farm } = L;
  const rows = records.rows ? records.rows() : [];
  const d = env.dayNumber;
  const brood = from <= LEVEL1.endDay;
  const targets = !brood && !!L.skills?.unlocked?.('recordsTargets');
  const all = [];
  for (let day = from; day <= to; day++) all.push(rows.find((r) => r.day === day) || (day === d ? { ...(records.draft?.(day) || {}), day, draft: true } : { day, empty: true }));
  const chick = farm.stats?.chickWeightMeasuredG;
  const C = (v) => (v == null ? '—' : v);
  // the columns a farmer checks first come first: birds, the house, then weight, feed and water
  const head = ['Day', 'Alive', 'Deaths (culls)', 'Mort. %', 'House min / max · target °C', 'Light h', 'Weight g', 'Target g', brood ? '× chick' : targets ? '% of target' : null, 'Unif. %', 'FCR',
    'Feed kg · g/bird', 'Water L · per 1,000 · change', 'Water : feed', 'Litter %'].filter(Boolean);
  const body = [];
  for (const r of all) {
    const tg = r.day >= 0 ? (r.targetWeightG || weightAt(r.day)) : null;
    body.push(h('tr', { class: `${r.draft ? 'is-draft' : r.empty ? 'is-empty' : ''} day-row` },
      h('th', { scope: 'row' }, r.day === -1 ? 'Prep' : r.day < -1 ? 'Plan' : String(r.day)),
      h('td', null, C(r.alive != null ? int(r.alive) : null)),
      h('td', null, r.deaths != null ? `${int(r.deaths)} (${int(r.culls ?? 0)})` : '—'),
      h('td', null, r.mortalityCumPct != null ? two(r.mortalityCumPct) : '—'),
      h('td', null, r.houseMinC != null ? `${one(r.houseMinC)} / ${one(r.houseMaxC)} · ${one(r.targetC)}` : r.day >= 0 && r.targetC ? `— · ${one(r.targetC)}` : '—'),
      h('td', null, r.lightHours != null ? one(r.lightHours) : '—'),
      h('td', null, r.weightG != null ? [`${int(r.weightG)} `, h('small', { class: 'wk-src' }, r.weightSource === 'weighed' ? 'weighed' : 'scale')] : '—'),
      h('td', null, r.day >= 0 && r.day <= 42 ? int(tg) : '—'),
      brood ? h('td', null, r.weightRatio != null ? two(r.weightRatio) : r.weightG != null && chick ? two(r.weightG / chick) : '—')
        : targets ? h('td', null, r.weightG != null && tg ? int((100 * r.weightG) / tg) : '—') : null,
      h('td', null, r.uniformityPct != null ? int(r.uniformityPct) : '—'),
      h('td', null, r.fcr != null ? two(r.fcr) : '—'),
      h('td', null, r.feedKg != null ? `${int(r.feedKg)} · ${one(r.feedPerBirdG)}` : '—'),
      h('td', null, r.waterL != null ? `${int(r.waterL)} · ${one(r.waterPerBirdMl)} · ${signedPct(r.waterChangePct)}` : '—'),
      h('td', null, r.waterFeedRatio != null ? two(r.waterFeedRatio) : '—'),
      h('td', null, r.litterMoisturePct != null ? int(r.litterMoisturePct) : '—')));
    // the day's notes under its numbers, full width, so every number row stays one line
    const lines = [];
    const facts = [r.chickQualityNote, ...(r.notes || [])].filter(Boolean);
    if (facts.length) lines.push(h('span', { class: 'notes-line' }, facts.join(' · ')));
    const missed = (r.missed || []).map((x) => jobById(x)?.title || x);
    if (missed.length) {
      lines.push(h('details', { class: 'notes-line notes-missed' }, h('summary', null, `Not done: ${missed.length} job${missed.length === 1 ? '' : 's'}`), h('span', null, missed.join(' · '))));
    } else if (r.jobsMissed) lines.push(h('span', { class: 'notes-line' }, `Not done: ${r.jobsMissed} job${r.jobsMissed === 1 ? '' : 's'}`));
    if (r.skillLines?.length) lines.push(h('span', { class: 'notes-line notes-points' }, `Points: ${r.skillLines.map((x) => x.replace(/^Skill points: /, '')).join(' · ')}`));
    if (!lines.length && r.draft) lines.push(h('span', { class: 'notes-line' }, 'today, not signed'));
    if (lines.length) body.push(h('tr', { class: 'notes-row' }, h('td', { colspan: String(head.length) }, lines)));
  }
  const note = brood ? `Feed and water: 24 h to this morning. Target weight: general practice. Week 1 target 4–5 × chick weight (Week 1 guide)${chick ? `; your chick weight ${one(chick)} g (box weighing)` : ''}.`
    : 'Feed and water: 24 h to this morning. Target weight: general practice (the bird scale plate).';
  return h('div', { class: 'week' }, h('p', { class: 'book-note' }, note),
    h('div', { class: 'ledger-scroll', tabindex: '0', role: 'region', 'aria-label': 'Week table' },
      h('table', { class: `ledger ledger--week${dark ? ' ledger--dark' : ''}` }, h('thead', null, h('tr', null, head.map((t) => h('th', { scope: 'col' }, t)))), h('tbody', null, body))));
}
