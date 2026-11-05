// Phase 3 parts of the feeder box, the silos and the rice husk heap (ui-equipment.js builds those panels;
// PHASE3.md §6.4, §6.6, §6.10, §13.3, §13.7). Package "panels". The brooding week shows Phase 2's panels
// exactly: every part here waits for its day (or its unlock).
//   feeder box  day 36 on: Take the feed away (feed.withdraw { on }); day 43 on: wash the pans (feed.wash { line })
//   silos       day 8 on: two gauges with their deliveries, the slide valves (feed.valve { silo, open }), which
//               silo each feed goes to; siloDays: days of feed left at the last 24 hours' rate
//   husk heap   day 8 on: the fork (startCarry 'fork'); day 43 on: the scraper (startCarry 'scraper')
import { FEEDER_LINES_Z, EQUIP, FEED_TYPES, FINISH, CYCLE, feedStdGAt, flockAgeAt } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { machineRow, toggleKey, readout } from './ui-equipment.js';
import { int, one } from './ui-format.js';
import { whenText, machineJob, progressBar, historyOf, knownBirds } from './ui-cycle-kit.js';
import { farmTimeNote } from './ui-farmtime.js';
// Skills update (SKILLS.md §3.6, §5.1, §6.5): siloSkills / feederSkills below
import { HARVEST, LEVEL1, AUTO, feedTypeForDay } from './config.js';
import { feedDays } from './farm-silos.js';
import { knownAliveOf, rimCmNow } from './job-figures.js';
import { skillBox, workLine, oneKey, row as skRow, note as skNote, perkHas, perkAuto, live, autoStatus, openFault, holdText, faultText, atText, glanceFor, ensureSkillsStyle } from './ui-cycle-skills.js';

const level = (L) => L.farm.mode === 'level';
const TYPE_FILL = { starter: 'var(--sign-yellow)', grower: '#c98f3a', finisher: '#9c6a34' };
const TYPE_NAME = Object.fromEntries(FEED_TYPES.map((t) => [t.id, t.label]));

// ---------------- feeder box ----------------
export function cycleFeederParts(L, { foldPlates, needTime = null, timeNote = null }) {
  const { env, farm } = L;
  const memo = { withdrawn: null };
  const withdrawnNow = () => !!farm.feed.withdrawn;
  // the steps hotfix: what waits on farm time runs a paused clock again, with the box's note
  const wait = (text) => { foldPlates(); needTime?.(text); };
  const wd = toggleKey('Give the feed back', 'Take the feed away', () => {
    const on = !withdrawnNow();
    if (on) wait('the lines stop and the birds empty the pans over the next farm hours (feed and catch signs: pans empty 8–12 h before the catch)');
    else foldPlates();
    L.act('feed.withdraw', { on });
    memo.withdrawn = on; memo.at = env.day;
    sync();
  });
  wd.stateText('Feed · taken away');
  const wdRow = machineRow('Feed withdrawal', '', wd.el);
  wdRow.led.classList.add('led--run');
  wdRow.el.hidden = true;
  const bar = progressBar();
  let busy = null;
  const washed = []; // when the farmer washed each line's pans here (the farm's clean.pans is the record)
  let isOpen = false;
  const pans = FEEDER_LINES_Z.map((z, i) => {
    const job = machineJob(env, 4, () => {
      L.act('feed.wash', { line: i }); washed[i] = env.timeLabel; busy = null; bar.set(0); sync();
      timeNote?.done(`Line ${i + 1} pans washed ${env.timeLabel}.`);
      if (!isOpen) L.notice?.(`Line ${i + 1} pans washed ${env.timeLabel}.`, 5);
    });
    const b = button({ class: 'key key--wide', 'aria-label': `Wash the pans of line ${i + 1}` }, 'Wash the pans');
    b.addEventListener('click', () => { if (busy) return; wait(`washing the pans of line ${i + 1} takes 4 farm minutes`); busy = job; job.start(); sync(); });
    const row = machineRow(`Line ${i + 1} pans`, '', b);
    row.led.classList.add('led--pad');
    return { b, job, row };
  });
  const wash = h('div', { class: 'cyc-sec', hidden: true, style: 'margin-top: 12px' }, h('p', { class: 'cyc-k' }, 'Clean-out: wash the feeder pans'), h('div', { class: 'ctrl-rows', style: 'margin-top: 0' }, pans.map((p) => p.row.el)), bar.el);
  function sync() {
    const d = env.dayNumber, on = level(L);
    wdRow.el.hidden = !on || d < FINISH.startDay || !!farm.harvest?.result;
    const w = withdrawnNow();
    wd.set(w); wdRow.led.classList.toggle('is-on', w);
    const empty = farm.feed.pansEmptyAt;
    setText(wdRow.small, w ? `the lines stopped${memo.at != null ? ` ${whenText(memo.at)}` : ''}${empty != null ? ` · pans empty ${whenText(empty)}` : ''} · water stays on` : 'stop the lines before the catch; the pans winch up once empty');
    wash.hidden = !on || d < CYCLE.cleanFrom;
    pans.forEach((p, i) => {
      const done = !!farm.clean.pans[i];
      setText(p.row.small, p.job.running ? 'washing…' : done ? `washed${washed[i] ? ` ${washed[i]}` : ''}` : 'not washed');
      p.row.led.classList.toggle('is-on', p.job.running);
      p.b.disabled = !!busy;
    });
  }
  return {
    els: [wdRow.el, wash],
    busy: () => !!busy,
    update() { if (busy) bar.set(busy.tick() || 0.001); sync(); },
    onOpen() { isOpen = true; },
    // a wash still running finishes in the background (the feeder box's busy())
    onClose() { isOpen = false; },
  };
}

// ---------------- silos ----------------
function silosSvg(silos) {
  const cap = EQUIP.siloCapacityKg, Hh = 140;
  const one1 = (s, x) => {
    let y = 150, bands = '';
    for (const l of s.layers?.length ? s.layers : s.kg > 0 ? [{ type: s.type, kg: s.kg }] : []) {
      const hh = (Math.max(0, l.kg) / cap) * Hh;
      y -= hh;
      bands += `<rect x="${x + 3}" y="${y.toFixed(1)}" width="16" height="${hh.toFixed(1)}" fill="${TYPE_FILL[l.type] || 'var(--sign-yellow)'}"/>`;
    }
    return `<rect x="${x}" y="8" width="22" height="144" rx="4" fill="var(--panel-sunk)" stroke="currentColor"/>${bands}`;
  };
  const ticks = [0, 2000, 4000, 6000].map((t) => { const y = 150 - (t / cap) * Hh; return `<path d="M54 ${y}h6" stroke="currentColor"/><text x="62" y="${y + 3.5}" font-size="9">${t ? `${t / 1000} t` : '0'}</text>`; }).join('');
  return `<svg viewBox="0 0 100 172" width="100" height="172"><g>${one1(silos[0] || {}, 6)}${one1(silos[1] || {}, 30)}</g>${ticks}
    <text x="17" y="166" font-size="9" text-anchor="middle">1</text><text x="41" y="166" font-size="9" text-anchor="middle">2</text></svg>`;
}

export function cycleSiloParts(L) {
  const { env, farm, skills } = L;
  const memo = { valves: [1, 0] };
  const valvesNow = () => farm.feed.valves;
  const strip = h('div', { class: 'silo-strip', 'aria-hidden': 'true' });
  const legend = h('p', { class: 'equip-note' }, FEED_TYPES.map((t) => h('span', { style: 'margin-right: 10px; white-space: nowrap' },
    h('span', { style: `display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; background: ${TYPE_FILL[t.id]}` }), t.label)));
  const reading = readout('Gauge reading');
  const readBtn = button({ class: 'btn btn--machine' }, 'Read the gauges');
  readBtn.addEventListener('click', () => {
    const r = L.act('feed.silo', {}) || {};
    if (Array.isArray(r.silos)) reading.set(r.silos.map((s, i) => `${i + 1}: about ${int(s.kg)} kg`).join(' · '), `read ${env.timeLabel}`);
    else reading.set(`about ${int(r.kg)} kg`, `both silos, read ${env.timeLabel}`);
  });
  const valves = [0, 1].map((i) => {
    const opts = [[0, 'Shut'], [0.5, 'Half'], [1, 'Open']].map(([v, t]) => {
      const b = button({ class: 'key key--wide', 'aria-pressed': 'false', 'aria-label': `Silo ${i + 1} slide valve ${t.toLowerCase()}` }, t);
      b.addEventListener('click', () => {
        // a feed change runs over farm time as the birds eat the pans down and the augers refill them (feed sign: about 24 h)
        if (v > 0 && (valvesNow()[i] ?? 0) !== v) note.start('the pans change to the feed of this silo as the birds eat and the augers refill them: half and half for about 24 farm hours (feed sign)');
        L.act('feed.valve', { silo: i, open: v }); memo.valves[i] = v; sync();
      });
      return { v, b };
    });
    const row = machineRow(`Silo ${i + 1} slide valve`, '', ...opts.map((o) => o.b));
    row.led.classList.add('led--run');
    return { opts, row };
  });
  const where = h('p', { class: 'equip-note' }, `Feed ordered at the office phone goes in by type: ${FEED_TYPES.map((t) => `${t.label.toLowerCase()} → silo ${t.silo + 1}`).join(', ')}.`);
  const note = farmTimeNote();
  const days = readout('Days of feed left');
  const daysBox = h('div', { class: 'equip-reads', hidden: true }, days.el);
  const el = h('div', { hidden: true },
    h('div', { class: 'silo-wrap' }, strip, h('div', { class: 'equip-reads equip-reads--col' }, reading.el, readBtn, legend)),
    h('div', { class: 'ctrl-rows' }, valves.map((v) => v.row.el)), note.el, daysBox, where);
  function sync() {
    // the silos as the farm keeps them (their sum is feed.siloKg)
    const silos = farm.feed.silos;
    const vs = valvesNow();
    valves.forEach((v, i) => {
      for (const o of v.opts) o.b.setAttribute('aria-pressed', String(Math.abs((vs[i] ?? 0) - o.v) < 0.01));
      v.row.led.classList.toggle('is-on', (vs[i] ?? 0) > 0);
      const s = silos[i];
      setText(v.row.small, s ? (s.layers?.length ? `bottom: ${TYPE_NAME[s.layers[0].type] || s.layers[0].type}${s.layers.length > 1 ? `, then ${s.layers.slice(1).map((l) => (TYPE_NAME[l.type] || l.type).toLowerCase()).join(', ')}` : ''}` : 'empty') : '');
    });
    const k = silos.map((s) => `${Math.round(s.kg / 50)}:${(s.layers || []).map((l) => l.type).join('/')}`).join('|');
    if (strip.__k !== k) { strip.__k = k; strip.innerHTML = silosSvg(silos); }
    // Skills update: while live the days of feed are siloSkills' line (feedDays, Feed 2), not this readout
    const on = !live() && !!skills?.unlocked?.('siloDays');
    daysBox.hidden = !on;
    if (on) {
      const rows = historyOf(env).filter((r) => Number.isFinite(r.feedKg));
      const total = silos.reduce((a, s) => a + Math.max(0, s.kg || 0), 0);
      let perDay = null, how = '';
      if (rows.length >= 2 && rows[rows.length - 1].t - rows[0].t >= 0.8) {
        const a = rows[0], b = rows[rows.length - 1];
        perDay = (b.feedKg - a.feedKg) / (b.t - a.t);
        how = 'at the feed meter’s rate of the last 24 hours';
      }
      if (!(perDay > 0)) { perDay = (knownBirds(farm) * feedStdGAt(flockAgeAt(env.day))) / 1000; how = 'at the feed sign’s figure for today'; }
      days.set(perDay > 0 ? `about ${one(total / perDay)} days` : '—', how);
    }
  }
  return {
    el,
    /** day 8 on (level): the two-silo view replaces Phase 2's single strip. */
    active: () => level(L) && env.dayNumber >= 8,
    update() { sync(); },
  };
}

// ---------------- husk heap ----------------
const TOOLS = [
  { kind: 'fork', fromDay: 8, take: 'Take the fork', back: 'Put the fork back', hint: 'At a caked patch press E: the fork breaks it up. Top up with a sack after.' },
  { kind: 'scraper', fromDay: CYCLE.cleanFrom, take: 'Take the scraper', back: 'Put the scraper back', hint: 'Walk the house from wall to wall: the scraper takes a strip about 4 m wide onto the trailer.' },
];
export function cycleHeapParts(L) {
  const { env, props } = L;
  const tools = TOOLS.map((t) => {
    const take = button({ class: 'btn btn--machine' }, t.take), back = button({ class: 'btn btn--machine' }, t.back);
    take.addEventListener('click', () => { props.startCarry(t.kind, {}); L.close(); });
    back.addEventListener('click', () => { props.drop(); });
    return { ...t, take, back };
  });
  return {
    buttons: tools.flatMap((t) => [t.take, t.back]),
    /** the hint for a carried Phase 3 tool, or null */
    hint: () => tools.find((t) => props.carrying === t.kind)?.hint ?? null,
    update() {
      for (const t of tools) {
        const on = level(L) && env.dayNumber >= t.fromDay;
        t.take.hidden = !on || props.carrying === t.kind;
        t.back.hidden = !on || props.carrying !== t.kind;
        t.take.disabled = props.handsBusy(t.kind);
      }
    },
  };
}

// ---------------- Skills update (SKILLS.md §3.6, §5.1, §6.5): the silo gauge's days of feed and its orders ----------------
// Feed 2 (siloOrder, with the siloDays view at level 2 while live): the days of feed from farm-silos feedDays (one figure for
// the gauge, the warning, the phone and the feed controller), the 2-day line, Order to 3 days and from day 36 Order to the
// catch (feed.order { kg, type, silo, from: 'silo' }) each with its working before and after the press and the farm-time
// note. Feed 3 (autoFeed): the controller's orders and the mill's confirmation (or the order-lost fault's words); at the
// feeder box the rims the controller keeps. The glance at both (AUTO_SYSTEMS.feed.glanceAt).
const sumKg = (list) => (list || []).reduce((a, o) => a + (o.kg || 0), 0);
const typeLabel = (t) => (TYPE_NAME[t] || t || '').toLowerCase();
/** The type an open order job asks for, else the feed of the coming days. */
function orderType(env, jobs) {
  const open = (id) => jobs.some((i) => i.id === id && (i.status === 'open' || i.status === 'waiting') && i.day === env.dayNumber);
  if (open('w2-order')) return 'grower';
  if (open('w45-order')) return 'finisher';
  return feedTypeForDay(Math.max(0, env.dayNumber) + 2).id;
}
/** Order to 3 days (the order job's own figure: the known birds × the feed sign at the next 3 days' middle). */
export function orderTo3(env, farm, jobs = []) {
  const f = farm.feed, birds = knownAliveOf(farm.flock) || LEVEL1.chicksPlaced, age = Math.max(0, flockAgeAt(env.day));
  const perDay = (birds * feedStdGAt(age + 1.5)) / 1000, need = Math.min(3 * perDay, EQUIP.siloCapacityKg - 50);
  const type = orderType(env, jobs), silo = FEED_TYPES.find((t) => t.id === type)?.silo ?? 0;
  const cyc = !!(farm.cyc?.on && f.silos);
  const inSilo = cyc ? f.silos[silo].kg : f.siloKg || 0, coming = cyc ? sumKg((f.pending || []).filter((o) => o.silo === silo)) : f.order?.kg || 0;
  const kg = Math.max(0, Math.ceil((need - inSilo - coming) / 10) * 10);
  const where = cyc ? `silo ${silo + 1}` : 'the silo';
  const text = kg > 0 ? `3 days × ${int(perDay)} kg − ${int(inSilo)} kg in ${where}${coming ? ` − ${int(coming)} kg on the way` : ''} → ${int(kg)} kg ${cyc ? typeLabel(type) : 'feed'}`
    : `3 days × ${int(perDay)} kg: ${where} holds ${int(inSilo + coming)} kg with what is on the way, nothing to order`;
  return { kg, type, silo, perDay, inSilo, coming, text };
}
/** Order to the catch (from day 36): to the withdrawal (about 11 h before the catch) with about 300 kg left (under 1.2 t). */
export function orderToCatch(env, farm) {
  const f = farm.feed, birds = knownAliveOf(farm.flock), age = Math.max(0, flockAgeAt(env.day));
  const catchAt = farm.harvest?.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24;
  const days = Math.max(0, catchAt - 11 / 24 - env.day), eat = (birds * feedStdGAt(age + days / 2) * days) / 1000;
  const have = f.silos ? f.silos.reduce((a, x) => a + x.kg, 0) + sumKg(f.pending) : (f.siloKg || 0) + (f.order?.kg || 0);
  const kg = Math.max(0, Math.ceil((eat - have + 300) / 10) * 10);
  const text = `to the withdrawal (${atText(env, catchAt - 11 / 24)}): ${one(days)} days × ${int(eat / Math.max(0.01, days))} kg − ${int(have)} kg in the silos and on the way → ${kg > 0 ? `${int(kg)} kg finisher, about ${int(have + kg - eat)} kg left` : 'nothing to order'}`;
  return { kg, type: 'finisher', silo: FEED_TYPES.find((t) => t.id === 'finisher')?.silo ?? 0, text };
}

export function siloSkills(L) {
  const { env, farm } = L;
  ensureSkillsStyle();
  const glance = glanceFor(L, 'silo');
  const daysLine = workLine(), warn = skNote('skl-note--fault');
  const w3 = workLine(), wC = workLine(), said = skNote();
  const note = farmTimeNote();
  const order = (o) => {
    if (!(o.kg > 0)) { setText(said, `Nothing ordered at ${env.timeLabel}: ${o.text}.`); said.hidden = false; return; }
    const r = L.act('feed.order', { kg: o.kg, type: o.type, silo: o.silo, from: 'silo' }) || {};
    const label = typeLabel(r.type || o.type) || 'feed';
    // the working stays beside the order sent (SKILLS.md §6.5: before and after the press)
    setText(said, r.arriveDay != null ? `Ordered ${int(r.kg ?? o.kg)} kg of ${label} at ${env.timeLabel} (${o.text}): the feed truck comes day ${r.arriveDay}, ${String(r.arriveHour ?? 9).padStart(2, '0')}:00.` : `Ordered ${int(o.kg)} kg at ${env.timeLabel} (${o.text}).`);
    note.start('the feed truck comes as farm time passes (Next job skips ahead)');
    sync();
  };
  const k3 = oneKey('Order to 3 days', () => order(orderTo3(env, farm, L.jobs())));
  const kC = oneKey('Order to the catch', () => order(orderToCatch(env, farm)));
  const box = skillBox('siloOrder', 'Days of feed and the order', daysLine.el, warn, skRow(k3, w3.el), skRow(kC, wC.el), said, note.el);
  const autoLine = workLine(), autoNote = skNote();
  const auto = skillBox('autoFeed', 'The feed controller’s orders', autoLine.el, autoNote);
  const el = h('div', null, box.el, auto.el);
  function sync() {
    const lvl = farm.mode === 'level';
    if (box.show(lvl && (perkHas(L, 'siloOrder') || (live() && perkHas(L, 'siloDays'))))) {
      let fd = null;
      try { fd = feedDays(farm, env); } catch { fd = null; }
      const per = fd?.kgPerDay ? `${int(knownAliveOf(farm.flock))} birds × ${int((fd.kgPerDay * 1000) / Math.max(1, knownAliveOf(farm.flock)))} g` : '';
      daysLine.set(fd?.days != null ? `About ${one(fd.days)} days of feed at today’s intake (${per}, the feed sign)` : 'Days of feed: no birds to feed yet',
        (fd?.bySilo || []).length > 1 ? fd.bySilo.map((x, i) => `silo ${i + 1}: ${int(x.kg)} kg, ${x.days != null ? `${one(x.days)} days` : '—'}`).join(' · ') : '');
      const coming = sumKg(farm.feed.pending) + (farm.feed.order?.kg || 0);
      setText(warn, fd?.days != null && fd.days <= AUTO.orderAtDays && !coming ? `About ${one(fd.days)} days of feed left: an order here or at the phone.` : '');
      warn.hidden = !warn.textContent;
      const has2 = perkHas(L, 'siloOrder');
      const o3 = orderTo3(env, farm, L.jobs());
      k3.hidden = !has2; w3.set(has2 ? o3.text : '');
      const catchOn = has2 && env.dayNumber >= 36 && !farm.harvest?.result;
      kC.hidden = !catchOn;
      const oc = catchOn ? orderToCatch(env, farm) : null;
      wC.set(oc ? oc.text : '');
      said.hidden = !said.textContent;
    }
    const lost = openFault(L, 'order-lost');
    if (auto.show(lvl && (perkAuto(L, 'feed') || !!lost))) {
      const st = autoStatus(L, 'feed'), last = farm.auto?.last?.feed;
      // an order the model marks lost or unconfirmed (o.lost / o.confirmed === false) reads so; else the mill confirmed it
      const pend = (farm.feed.pending || []).map((o) => `${int(o.kg)} kg ${typeLabel(o.type)}${o.by === 'auto' ? ' (the controller)' : ''}, due day ${o.arriveDay} ${String(o.arriveHour ?? 9).padStart(2, '0')}:00, ${o.lost || o.confirmed === false ? 'not confirmed by the mill' : 'confirmed by the mill'}`);
      autoLine.set(lost ? faultText(L, lost) : pend.length ? `On the way: ${pend.join(' · ')}` : 'No order on the way',
        lost ? 'Order by hand: Order to 3 days here, or the phone.' : last?.text || st.text || 'The controller orders to 3 days at 2 days of feed, to day 35.');
      autoLine.el.classList.toggle('skl-note--fault', !!lost);
      setText(autoNote, env.dayNumber > AUTO.lastAutoOrderDay ? 'From day 36 the last order is yours: only you know the catch.' : '');
      autoNote.hidden = !autoNote.textContent;
    }
  }
  let acc = 0;
  return { el, onOpen() { glance.onOpen(); setText(said, ''); acc = 0; sync(); }, update(dt) { glance.update(dt); acc -= dt || 0; if (acc <= 0) { acc = 0.25; sync(); } } };
}

/** The feeder box's Feed 3 row: the rims the feed controller keeps (each line held by the farmer's own setting to 06:00). */
export function feederSkills(L) {
  const { env, farm } = L;
  ensureSkillsStyle();
  const glance = glanceFor(L, 'feeder-box');
  const line = workLine();
  const box = skillBox('autoFeed', 'Feeder rims and the feed orders', line.el);
  function sync() {
    if (!box.show(farm.mode === 'level' && perkAuto(L, 'feed'))) return;
    const d = env.dayNumber, held = farm.feed.lines.map((l, i) => (holdText(L, 'feed', i) ? i + 1 : null)).filter(Boolean);
    const lost = openFault(L, 'order-lost');
    line.set(d < AUTO.rimFromDay ? 'Days 0–3 the pans stay on the litter; the controller keeps the rims from day 4.' : `The controller keeps the rims at the feeder plate’s ${int(rimCmNow(env))} cm${held.length ? ` · line ${held.join(', ')} held by your setting until 06:00` : ''}`,
      lost ? faultText(L, lost) : (farm.feed.pending || []).length ? `Feed order on the way: ${(farm.feed.pending || []).map((o) => `${int(o.kg)} kg, day ${o.arriveDay}`).join(' · ')}, confirmed by the mill` : '');
  }
  let acc = 0;
  return { el: box.el, onOpen() { glance.onOpen(); acc = 0; sync(); }, update(dt) { glance.update(dt); acc -= dt || 0; if (acc <= 0) { acc = 0.25; sync(); } } };
}
