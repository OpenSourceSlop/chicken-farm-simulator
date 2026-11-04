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
    const on = !!skills?.unlocked?.('siloDays');
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
