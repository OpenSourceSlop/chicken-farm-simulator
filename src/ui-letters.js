// The record book's letters and the pages of the plan, the harvest and the clean-out (PHASE3.md §8.2–§8.4).
// Plain numbers only: the company's reply is each term with his number beside it, the lab letter is how
// many swabs grew bacteria. Opening a letter is the reading (ui actions plan.letter, plan.reply, swab.read).
// Owner: package "run".
//   planPage(L)            the contract's terms, his sheet and decisions, the reply; planVsCycle: the cycle beside it
//   harvestPage(L)         the weight tickets and the harvest record (day 42)
//   cleanPage(L)           what was done and when, the lab letter, the rest
//   lettersPage(L, again)  the letters on the desk (contract, reply, vet, lab)
import { PLAN_CONTRACT, HARVEST, CLEAN, HOUSE_BOUNDS, LEVELS, PLACEMENT_DAY, weightAt, levelById } from './config.js';
import { h, button } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { int, one, two, num, hhmm, dayTime } from './ui-format.js';

const C = PLAN_CONTRACT;
/** The contract letter's terms, as plain lines (PHASE3.md §1 Level 1). */
export const CONTRACT_LINES = [
  `${int(C.salePerWeek)} birds for sale every week, about ${one(C.saleKg)} kg live weight`,
  `We count at least ${int(C.lossesMinPct)} % losses from chick to catching`,
  `At least ${int(C.restMinDays)} days of rest between flocks`,
  `At most ${int(C.houseBirds)} chicks a house (the drinkers and feeders of house 1)`,
  `At most ${int(C.densityMaxKgM2)} kg of live bird per m² at catching`,
  'Our drawings show the standard house, 50 × 12 m',
  `Send the plan by ${hhmm(C.sendBy)} today`,
];
const kv = (rows) => h('table', { class: 'ledger' }, h('tbody', null, rows.filter(Boolean).map(([k, v]) => h('tr', null, h('th', { scope: 'row' }, k), h('td', null, v)))));
const planOf = (L) => L.run?.()?.state()?.plan || (L.farm.plan?.outcome ? L.farm.plan : null);

/** The company's reply as term lines: "3,611 birds for sale a week (contract 3,600)". */
export function replyLines(plan) {
  const d = plan.decisions || {}, o = plan.outcome || {};
  const t = Object.fromEntries((o.terms || []).map((x) => [x.key, x]));
  return [
    `${int(d.houses)} houses × ${int(d.birdsPerHouse)} chicks every ${int(d.cycleDays)} days`,
    `losses counted ${num(o.lossesCountedPct)} %`,
    t.salePerWeek && `${int(t.salePerWeek.value)} birds for sale a week (contract ${int(t.salePerWeek.limit)})`,
    t.density && `${one(t.density.value)} kg/m² at catching (limit ${int(t.density.limit)})`,
    t.rest && `${int(t.rest.value)} rest days (at least ${int(t.rest.limit)})`,
    t.houseBirds && `${int(t.houseBirds.value)} chicks a house (at most ${int(t.houseBirds.limit)})`,
  ].filter(Boolean);
}

export function planPage(L) {
  const { env, farm } = L;
  const out = [];
  if (env.dayNumber <= -2) {
    const open = button({ class: 'btn btn--paper btn--ink' }, h('span', { html: ICONS.clipboard, 'aria-hidden': 'true' }), 'Open the planning sheet');
    open.addEventListener('click', () => L.openPanel('plan-sheet'));
    out.push(h('div', { class: 'book-row' }, open), h('p', { class: 'book-note' }, `The sheet is yours: the sums and the decisions. Send the plan by ${hhmm(C.sendBy)}; the company’s reply comes about an hour later.`));
  }
  out.push(h('h3', { class: 'book-h' }, 'The company’s contract'), h('ul', { class: 'letter-lines' }, CONTRACT_LINES.map((l) => h('li', null, l))));
  const plan = planOf(L);
  if (!plan) { out.push(h('p', { class: 'book-note' }, 'No plan sent yet.')); return out; }
  const d = plan.decisions || {}, s = plan.sums || {}, m = plan.measured || farm.plan?.measured || {};
  out.push(h('h3', { class: 'book-h' }, 'Your plan'), kv([
    ['Houses', int(d.houses)], ['Chicks per house', int(d.birdsPerHouse)], ['Days per flock', int(d.cycleDays)],
    ['Losses you plan for', `${one(d.lossesPct)} %`], ['Sale weight', `${one(d.saleKg)} kg`],
    ['House 1 measured', m.length && m.width ? `${one(m.length)} × ${one(m.width)} m = ${int(m.length * m.width)} m²` : 'not measured (the company’s drawings: 600 m²)'],
    ['Chicks per week', int(s.chicksPerWeek)], ['Birds for sale a week', int(s.salePerWeek)], ['Kg per m² at catching', two(s.densityKgM2)], ['Rest days', int(s.restDays)],
  ]));
  if (plan.outcome) out.push(h('h3', { class: 'book-h' }, 'The company’s reply'), h('ul', { class: 'letter-lines' }, replyLines(plan).map((l) => h('li', null, l))));
  if (L.skills?.unlocked?.('planVsCycle')) {
    const fl = farm.flock, placed = fl.placed || 0;
    const lossPct = placed ? (100 * ((fl.deadTotal || 0) + (fl.culls || 0))) / placed : null;
    const w = fl.alive > 0 ? fl.meanWeightG : farm.harvest?.result?.meanLiveG ?? null;
    out.push(h('h3', { class: 'book-h' }, 'Your plan beside the flock'), kv([
      ['Losses so far', lossPct != null ? `${two(lossPct)} % (plan ${one(d.lossesPct)} %)` : '—'],
      ['Weight now', w != null ? `${int(w)} g (plan sale weight ${int(d.saleKg * 1000)} g)` : '—'],
      ['Days of the cycle used', `${int(Math.max(0, env.dayNumber))} of ${int(d.cycleDays)}`],
    ]));
  }
  return out;
}

/** records-cycle deathsByLevel() -> [{ level, name, deaths, culls, doa, pct }] (an older { id: pct } map is read too). */
export function deathsByLevelRows(dbl) {
  if (!dbl) return [];
  const list = Array.isArray(dbl) ? dbl : Object.entries(dbl).map(([level, v]) => (typeof v === 'number' ? { level, pct: v } : { level, ...v }));
  return list.filter((d) => d && Number.isFinite(d.pct)).map((d) => ({ ...d, name: levelById(d.level)?.short ?? String(d.level) }));
}

/** Weight tickets and the harvest record (PHASE3.md §8.3); target columns with Growth level 1. */
export function harvestPage(L) {
  const { farm, records } = L;
  const hv = farm.harvest, r = hv?.result;
  const out = [h('h3', { class: 'book-h' }, 'Harvest')];
  if (!hv?.started) { out.push(h('p', { class: 'book-note' }, `The catch: ${dayTime(hv?.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24)}${hv?.bookedAt != null ? ' (booked)' : ' (the company’s default)'}. Nothing caught yet.`)); return out; }
  const page = records.harvestPage() || {};
  const tickets = page.tickets || (hv.trucks || []).map((t, i) => ({ truck: i, crates: t.crates, birds: t.birds, grossKg: t.netKg + HARVEST.tareKg, tareKg: HARVEST.tareKg, netKg: t.netKg, doa: t.doa ?? null }));
  out.push(h('div', { class: 'ledger-scroll', tabindex: '0', role: 'region', 'aria-label': 'Weight tickets' }, h('table', { class: 'ledger ledger--week' },
    h('thead', null, h('tr', null, ['Truck', 'Crates', 'Birds', 'Gross kg', 'Empty kg', 'Net kg', 'Dead on arrival'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', null, tickets.map((t) => h('tr', { class: 'day-row' }, h('th', { scope: 'row' }, String((t.truck ?? 0) + 1)), h('td', null, int(t.crates)), h('td', null, int(t.birds)),
      h('td', null, int(t.grossKg)), h('td', null, int(t.tareKg)), h('td', null, int(t.netKg)), h('td', null, t.doa != null ? int(t.doa) : '—')))))));
  if (!r) { out.push(h('p', { class: 'book-note' }, 'The crew is catching.')); return out; }
  const targets = !!L.skills?.unlocked?.('recordsTargets');
  const age = (hv.startedAt ?? hv.catchAt) - PLACEMENT_DAY, expect = weightAt(age) * HARVEST.shrink;
  const byLevel = deathsByLevelRows(page.deathsByLevel).map((d) => `${d.name} ${two(d.pct)} %`).join(' · ') || null;
  out.push(kv([
    ['Birds sold', int(r.sold)],
    ['Mean live weight', `${int(r.meanLiveG)} g${targets ? ` (target ${int(expect)} g: ${int(weightAt(age))} g at ${one(age)} days less ${int((1 - HARVEST.shrink) * 100)} % shrink)` : ''}`],
    ['FCR', r.fcr != null ? two(r.fcr) : '—'],
    ['Deaths, culls and dead on arrival', r.mortalityPct != null ? `${two(r.mortalityPct)} % of the chicks placed` : '—'],
    byLevel ? ['By level', byLevel] : null,
    ['Uniformity (day 40 weighing)', r.uniformityPct != null ? `${int(r.uniformityPct)} %` : '—'],
    ['Production efficiency (EPEF)', r.epef != null ? `${int(r.epef)} = livability % × live kg ÷ (age days × FCR) × 100` : '—'],
    ['Feed left at catching', r.feedLeftKg != null ? `${int(r.feedLeftKg)} kg` : '—'],
    ['Feed withdrawal', r.withdrawalH != null ? `${one(r.withdrawalH)} h from empty pans to the catch` : '—'],
    ['The plant’s note', r.gutFull ? 'feed in the guts of the birds' : (page.notes || []).join(' · ') || '—'],
  ]));
  return out;
}

/** What was done in the clean-out and when, the lab letter and the rest (PHASE3.md §8.4). */
export function cleanPage(L) {
  const { farm, records } = L;
  const c = farm.clean || {};
  const page = records.cleanPage() || {};
  const g = farm.litter?.coverGrid;
  const cover = g ? Array.from(g).reduce((a, v) => a + Math.min(1, v), 0) / g.length : null;
  const pct = (v) => (v != null ? `${int(v * 100)} %` : '—');
  const n = (o) => (o ? Object.values(o).filter(Boolean).length : 0);
  const out = [h('h3', { class: 'book-h' }, 'Clean-out')];
  out.push(kv([
    ['Litter left on the floor', cover != null ? pct(cover) : '—'],
    ['Lines, fans, pad, brooders, inlets brushed', `${n(c.brushed)} of ${CLEAN.brushParts.length}`],
    ['Floor washed', pct(c.washShare)],
    ['Floor wet', pct(c.wetShare)],
    ['Floor disinfected', pct(c.sprayShare)],
    ['Drinker lines disinfected', `${(c.lines || []).filter((v) => v >= 1).length} of 4`],
    ['Feeder lines’ pans washed', `${(c.pans || []).filter(Boolean).length} of 3`],
    ['Wash bay: boots, buckets, barrow, washer', `${n(c.washbay)} of ${CLEAN.washItems.length}`],
    ['Bait stations set', `${(c.baits || []).filter(Boolean).length} of 4`],
    ['Swabs taken', `${(c.swabs || []).length} of ${CLEAN.swabs}`],
    ['House closed', c.closedDay != null ? `day ${c.closedDay}` : '—'],
    ['Next chicks booked', c.bookedDay != null ? `day ${c.bookedDay}` : '—'],
    ['Rest days', c.bookedDay != null && c.closedDay != null ? int(c.bookedDay - c.closedDay) : page.restDays != null ? int(page.restDays) : '—'],
  ]));
  if (c.lab) out.push(h('h3', { class: 'book-h' }, 'The lab letter'), labLetter(L, c.lab));
  return out;
}

/** The lab's letter: how many swabs grew bacteria; with Biosecurity level 3 (swabMap) the places on a plan. */
function labLetter(L, lab) {
  const lines = [h('p', { class: 'letter-big' }, `${int(lab.positive)} of ${int(lab.of)} swabs grew bacteria.`),
    h('p', { class: 'book-note' }, 'The result is the whole house’s cleaning: what still grows anywhere shows at the lab’s places.')];
  if (L.skills?.unlocked?.('swabMap') && lab.places?.length) {
    const W = 480, Hh = 140, X = (x) => 10 + ((x - HOUSE_BOUNDS.xMin) / (HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin)) * (W - 20), Z = (z) => 10 + ((z - HOUSE_BOUNDS.zMin) / (HOUSE_BOUNDS.zMax - HOUSE_BOUNDS.zMin)) * (Hh - 20);
    const pts = lab.places.map((p, i) => `<g><circle cx="${X(p.x).toFixed(1)}" cy="${Z(p.z).toFixed(1)}" r="7" fill="${p.positive ? 'var(--ledger-ink)' : 'none'}" stroke="var(--ledger-ink)" stroke-width="2"/><text x="${X(p.x).toFixed(1)}" y="${(Z(p.z) + 3.5).toFixed(1)}" font-size="9" text-anchor="middle" style="fill:${p.positive ? 'var(--ledger-paper)' : 'var(--ledger-ink)'}">${i + 1}</text></g>`).join('');
    lines.push(h('div', { class: 'graph', html: `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="max-width:${W}px" role="img" aria-label="Swab places on a plan of the house: filled = grew bacteria">
      <rect x="10" y="10" width="${W - 20}" height="${Hh - 20}" fill="none" stroke="var(--ledger-rule)" stroke-width="2"/>
      <text x="12" y="${Hh - 2}" font-size="10">west: the pad</text><text x="${W - 12}" y="${Hh - 2}" font-size="10" text-anchor="end">east: the fans</text>${pts}</svg>` }),
      h('p', { class: 'book-note' }, 'Filled: grew bacteria. Open: clean.'));
  }
  return h('div', { class: 'letter' }, lines);
}

/** The letters on the office desk. Opening one is reading it (the jobs that ask for it count it). */
/** The vet's letter: what the farmer told on the phone and the advice (farm.health.vet). */
function vetLetter(v) {
  const told = v.reason ? h('p', null, `You told the vet: ${String(v.reason).replace(/-/g, ' ')}.`) : null;
  const advice = /medicine/.test(v.advice || '')
    ? 'Medicine in the water for 3 days: the dose on the label, mixed fresh each day, for the full course (the Medicine tab at the water supply).'
    : 'Keep the daily records and call again if the deaths rise.';
  return [told, h('p', null, advice)];
}

export function lettersPage(L, again) {
  const { env, farm } = L;
  const out = [];
  const read = L.lettersRead || (L.lettersRead = new Set());
  const letter = (key, title, body, uiId) => {
    const open = read.has(key);
    const b = button({ class: `letter-head${open ? ' is-open' : ''}`, 'aria-expanded': String(open) }, h('span', { html: ICONS.book, 'aria-hidden': 'true' }), h('span', null, title));
    b.addEventListener('click', () => { if (!read.has(key)) { read.add(key); if (uiId) L.uiAct(uiId, {}); } else read.delete(key); again?.(); });
    return h('article', { class: 'letter' }, b, open ? h('div', { class: 'letter-body' }, body()) : null);
  };
  const plan = planOf(L);
  if (env.dayNumber <= -2 || plan) out.push(letter('contract', 'The company’s contract', () => h('ul', { class: 'letter-lines' }, CONTRACT_LINES.map((l) => h('li', null, l))), 'plan.letter'));
  const p = farm.plan;
  if (p?.replyAt != null && env.day >= p.replyAt - 1e-9 && (p.outcome || plan?.outcome)) out.push(letter('reply', 'The company’s reply to your plan', () => h('ul', { class: 'letter-lines' }, replyLines(p.outcome ? p : plan).map((l) => h('li', null, l))), 'plan.reply'));
  else if (plan?.outcome && env.dayNumber > -2) out.push(letter('reply', 'The company’s reply to your plan', () => h('ul', { class: 'letter-lines' }, replyLines(plan).map((l) => h('li', null, l)))));
  // the vet's answers are the farm's (farm.health.vet, saved with the farm): { day, hour, reason, advice }
  for (const v of farm.health?.vet || []) out.push(letter(`vet@${v.day}@${v.hour}`, `The vet’s letter, day ${v.day}`, () => vetLetter(v)));
  const lab = farm.clean?.lab;
  if (lab) out.push(letter(`lab@${farm.clean.labDay ?? ''}@${farm.clean.pass ?? 1}`, `The lab’s letter: the swabs of day ${(farm.clean.labDay ?? env.dayNumber) - CLEAN.labDays}`, () => labLetter(L, lab), 'swab.read'));
  if (!out.length) out.push(h('p', { class: 'book-note' }, 'No letters on the desk.'));
  return [h('h3', { class: 'book-h' }, 'Letters on the desk'), ...out];
}

/** The lines of the cycle's plan beside the flock (the cycle summary). */
export const levelShort = (id) => LEVELS.find((l) => l.id === id)?.short ?? id;
