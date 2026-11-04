// The planning sheet (Level 1, Plan the farm; PHASE3.md §1, §4.1, §6.11, §13.7). Package "panels".
// His own worksheet: the contract's terms as plain lines (the letter), his tape readings, his own sums
// (written by him, never marked), his decisions and *Send the plan* until 16:00 on the planning day
// (plan.send). The company's reply is the run's letter. Unlocks: planningCalc (his sums live, worked by
// planSums for his decisions), planCarry (the sheet starts from the last cycle's numbers).
import { PLAN_CONTRACT, CYCLE } from './config.js';
import { planSums, PLAN_FIELDS, saleMax } from './farm-plan.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell } from './ui-equipment.js';
import { int, one, hhmm, splitDay } from './ui-format.js';
import { whenText } from './ui-cycle-kit.js';

// His own lines (the planning sign's sums, in the order the sign gives them)
const SUM_LINES = [
  { key: 'chicksPerWeek', label: 'Chicks to place per week', small: 'birds for sale ÷ (1 − losses)' },
  { key: 'birdsPerM2', label: 'Birds per m² at catching', small: 'kg allowed per m² ÷ sale weight' },
  { key: 'floorM2', label: 'Floor for one week’s chicks, m²', small: 'chicks per week ÷ birds per m²' },
  { key: 'housesNeeded', label: 'Houses needed', small: 'floor × weeks a house is used ÷ floor of one house' },
  // the clarity round: a line of his own for each contract term, so every term has his figure beside it
  { key: 'salePerWeek', label: 'Birds for sale a week', small: 'chicks a week × (1 − losses)' },
  { key: 'densityKgM2', label: 'kg of live bird per m² at catching', small: 'birds a house × sale weight ÷ floor of one house' },
  { key: 'restDays', label: 'Rest days between flocks', small: 'days a house is used − 42 growing − 4 clean-out' },
];
const C = PLAN_CONTRACT;
const TERMS = [
  `${int(C.salePerWeek)} birds for sale every week, about ${one(C.saleKg)} kg live weight`,
  `the plant takes at most ${int(saleMax(C))} birds a week (${int(C.saleMaxPct - 100)} % over the contract)`,
  `the company counts at least ${C.lossesMinPct} % losses from chick to catching`,
  `at least ${C.restMinDays} days of rest between flocks`,
  `at most ${int(C.houseBirds)} chicks a house (the drinkers and feeders of house 1)`,
  `at most ${C.densityMaxKgM2} kg of live bird per m² at catching`,
  'the company’s drawings show the standard house, 50 × 12 m',
];

/** The decisions a planCarry sheet starts from (the run's lastCycle, kept across a new run and saved): last plan's houses / chicks / days, the flock's losses and weight. */
function carried(L) {
  const st = L.ctx?.run?.state?.() || {};
  const last = st.lastCycle || null;
  if (!last) return null;
  const d = last.plan?.decisions || {}, a = last.summary?.actual || {};
  return {
    houses: d.houses, birdsPerHouse: d.birdsPerHouse, cycleDays: a.cycleDays ?? d.cycleDays,
    lossesPct: Number.isFinite(a.lossesPct) ? Math.round(a.lossesPct * 10) / 10 : d.lossesPct,
    saleKg: Number.isFinite(a.saleKg) ? Math.round(a.saleKg * 10) / 10 : d.saleKg,
  };
}

export function buildPlanSheet(api) {
  const { L } = api;
  const { farm, env, props, skills } = L;
  const shell = equipShell({ cls: 'equip--plan', icon: ICONS.clipboard, title: 'Planning sheet', sub: 'Office desk · your own sums for the company', plates: ['plan-sheet'], signLinks: ['sign-plan'], onClose: L.close });
  const field = (f, cls = '') => {
    const id = uniqueId('plan');
    const input = h('input', { type: 'number', id, name: f.key, inputmode: 'decimal', min: f.min, max: f.max, step: f.step ?? 'any', class: cls, autocomplete: 'off' });
    return { f, input, label: h('label', { for: id }, f.label, f.small ? h('small', null, f.small) : null) };
  };
  // the contract (the letter's terms) and his tape
  const tape = h('p', { class: 'cyc-note' });
  const takeTape = button({ class: 'btn btn--machine' }, 'Take the tape measure');
  const backTape = button({ class: 'btn btn--machine' }, 'Put the tape back');
  takeTape.addEventListener('click', () => { props.startCarry('tape', {}); L.close(); });
  backTape.addEventListener('click', () => { props.drop(); refresh(); });
  // his own sums and his decisions
  const sums = SUM_LINES.map((f) => field({ ...f, step: 'any' }));
  const dec = PLAN_FIELDS.map((f) => field(f));
  const calc = h('div', { class: 'cyc-calc', hidden: true });
  const sendBtn = button({ class: 'btn btn--machine btn--go' }, h('span', { html: ICONS.arrow, 'aria-hidden': 'true' }), 'Send the plan');
  const sent = h('p', { class: 'cyc-sent', 'aria-live': 'polite' });
  const rows = (list) => h('div', { class: 'cyc-sheet-rows' }, list.flatMap((x) => [x.label, x.input]));
  const sheet = h('div', { class: 'cyc-sheet' },
    h('div', { class: 'cyc-sheet-col' }, h('h3', null, 'The contract (the company’s letter)'), h('ul', { class: 'cyc-terms' }, TERMS.map((t) => h('li', null, t)))),
    h('div', { class: 'cyc-sheet-col' }, h('h3', null, 'House 1, measured'), tape, h('div', { class: 'equip-btns' }, takeTape, backTape)),
    h('div', { class: 'cyc-sheet-col' }, h('h3', null, 'Your sums'), rows(sums)),
    h('div', { class: 'cyc-sheet-col' }, h('h3', null, 'Your plan'), rows(dec)),
    h('div', { class: 'cyc-sheet-col cyc-sheet-wide' }, calc, h('div', { class: 'equip-btns' }, sendBtn), sent));
  shell.main.append(sheet);
  for (const x of [...sums, ...dec]) x.input.addEventListener('input', () => refresh());

  let started = null; // the env.day the sheet was set up for (a new planning day starts a fresh sheet)
  const value = (x) => { const v = parseFloat(String(x.input.value).replace(',', '.')); return Number.isFinite(v) ? v : null; };
  const decisions = () => Object.fromEntries(dec.map((x) => [x.f.key, value(x)]));
  const complete = () => dec.every((x) => value(x) != null);
  const houseM2 = () => { const m = farm.plan?.measured || {}; return m.length && m.width ? Math.round(m.length * m.width * 10) / 10 : C.houseM2Drawings; };
  const canSend = () => env.dayNumber === CYCLE.planDay && env.hour < C.sendBy && !farm.plan?.sentAt;

  sendBtn.addEventListener('click', () => {
    if (!complete() || !canSend()) { refresh(); return; }
    const own = Object.fromEntries(sums.map((x) => [x.f.key, value(x)]));
    L.act('plan.send', { ...decisions(), sums: own });
    refresh();
  });

  function setUp() {
    const day = Math.floor(env.day);
    if (started === day) return;
    started = day;
    for (const x of [...sums, ...dec]) x.input.value = '';
    const p = farm.plan;
    if (p?.decisions) for (const x of dec) if (p.decisions[x.f.key] != null) x.input.value = String(p.decisions[x.f.key]);
    if (p?.sheet) for (const x of sums) if (p.sheet[x.f.key] != null) x.input.value = String(p.sheet[x.f.key]);
    if (!p?.decisions && skills?.unlocked?.('planCarry')) {
      const c = carried(L);
      if (c) for (const x of dec) if (Number.isFinite(c[x.f.key])) x.input.value = String(c[x.f.key]);
    }
  }
  function refresh() {
    const m = farm.plan?.measured || {};
    setText(tape, [m.length ? `length ${one(m.length)} m` : 'length not measured', m.width ? `width ${one(m.width)} m` : 'width not measured'].join(' · ')
      + (m.length && m.width ? ` = ${int(Math.round(m.length * m.width))} m² of floor` : ' (the company’s drawings: 50 × 12 m = 600 m²)'));
    takeTape.hidden = props.carrying === 'tape';
    backTape.hidden = props.carrying !== 'tape';
    takeTape.disabled = !!props.carrying && props.carrying !== 'tape';
    // planningCalc: his sums for these decisions, live (the same sums the company runs)
    const on = !!skills?.unlocked?.('planningCalc') && complete();
    calc.hidden = !on;
    if (on) {
      const s = planSums(decisions(), houseM2());
      calc.replaceChildren(h('p', { style: 'margin: 0 0 2px; font-weight: 600' }, 'Planning calculator', h('span', { class: 'cyc-dim' }, ` · floor ${int(s.houseM2)} m² a house`)),
        h('span', null, 'chicks a week ', h('b', null, int(s.chicksPerWeek)), ' · for sale a week ', h('b', null, int(s.salePerWeek)),
          ' · ', h('b', null, one(s.densityKgM2)), ' kg/m² at catching · ', h('b', null, String(s.restDays)), ' rest days'));
    }
    const p = farm.plan;
    for (const x of [...sums, ...dec]) x.input.disabled = !!p?.sentAt;
    sendBtn.hidden = !!p?.sentAt;
    sendBtn.disabled = !complete() || !canSend();
    if (p?.sentAt) setText(sent, `Sent: ${whenText(p.sentAt)}. The company’s reply comes to the desk about ${hhmm(splitDay(p.replyAt ?? p.sentAt + C.replyAfterH / 24).hour)}.`);
    else if (env.dayNumber !== CYCLE.planDay) setText(sent, 'The plan goes to the company on the planning day.');
    else if (env.hour >= C.sendBy) setText(sent, `The company takes plans until ${hhmm(C.sendBy)}.`);
    else {
      // sending is final: the lines of his own sums still blank are named before he sends
      const blank = sums.filter((x) => value(x) == null).map((x) => x.f.label.toLowerCase());
      setText(sent, complete() ? `Sending is final: the company’s reply comes to the desk about ${C.replyAfterH === 1 ? 'an hour' : `${C.replyAfterH} hours`} after you send; it takes plans until ${hhmm(C.sendBy)}.${blank.length ? ` Your sums still blank: ${blank.join(', ')}.` : ''}`
        : 'Fill in your plan: houses, chicks per house, days per flock, losses and sale weight.');
    }
  }
  let acc = 0;
  return {
    el: shell.el,
    // the job strip (job-strips-cycle pl-sheet): each contract term beside his own figure
    stripCtx: () => ({ plan: { sums: Object.fromEntries(sums.map((x) => [x.f.key, value(x)])), decisions: decisions() } }),
    onOpen() { shell.refreshPlates(); setUp(); refresh(); },
    update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.5; refresh(); } },
  };
}
