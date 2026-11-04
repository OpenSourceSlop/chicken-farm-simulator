// The fan panel (east end, north wall) and the cooling pad pump (outside the west end): PHASE3.md §1 Week 3
// to the catch, §6.3, §13.3. Package "panels". House °C and humidity side by side, six fan switches with
// their lamps and air vanes (a lamp on with a still vane: no air from that fan), the pad pump, the air
// speed. Open 2 s = fans.read (once per opening). Unlocks: windChill (the wind chill readout),
// tunnelStages (the stage table, vent.stages), fanChart (24 hours of fans, pad and house).
import { FAN_COUNT } from './config.js';
import { h, button, setText, fmt1, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { key, lcdCell } from './ui-controller.js';
import { equipShell, machineRow, toggleKey, stepper } from './ui-equipment.js';
import { ROTOR, FAN_INDEXES, lineChart, historyOf, machineJob, progressBar, padCheckOf } from './ui-cycle-kit.js';
import { heldWaitText } from './ui-farmtime.js';

const READ_AFTER = 2; // real seconds open before the panel counts as read (as the controller)

/** House °C and humidity side by side (+ more cells). */
function climateLcd(env, extra = [], label = 'Fan panel display') {
  const house = lcdCell('House', '°C'), rh = lcdCell('Humidity in', '%');
  const cells = [house, rh, ...extra.map(([k, u]) => lcdCell(k, u))];
  const clock = h('span', { class: 'lcd-clock' }), flags = h('span', { class: 'lcd-foot-flags' });
  const el = h('div', { class: 'lcd cyc-lcd', role: 'group', 'aria-label': label }, h('div', { class: 'lcd-grid' }, cells.map((c) => c.el)), h('div', { class: 'lcd-foot' }, flags, clock));
  return { el, cells, flags, set(values) { cells.forEach((c, i) => setText(c.value, values[i] ?? '--')); setText(clock, `DAY ${fmt0(env.dayNumber)}  ${env.timeLabel}`); } };
}

export function buildFanPanel(api) {
  const { L } = api;
  const { env, skills } = L;
  const shell = equipShell({ cls: 'equip--fans', icon: ICONS.fan, title: 'Fan panel', sub: 'Six tunnel fans · pad pump · air at bird height', plates: ['fan-panel'], signLinks: ['sign-heat'], onClose: L.close });
  const lcd = climateLcd(env, [['Air at birds', 'm/s'], ['Outside', '°C']]);
  // Wind chill (unlock): what the birds feel in the moving air, with the cooling as a plain offset (no minus sign).
  const chill = lcdCell('Birds feel', '°C');
  chill.el.classList.add('cyc-windchill', 'lcd-cell--wide');
  const chillSub = h('span', { class: 'lcd-sub' });
  chill.el.append(chillSub);
  lcd.el.querySelector('.lcd-grid').append(chill.el);
  const fFans = h('span', { class: 'lcd-flag' }), fPad = h('span', { class: 'lcd-flag' }, 'PAD'), fStage = h('span', { class: 'lcd-flag' }, 'STAGES'), fRead = h('span', { class: 'lcd-read' });
  lcd.flags.append(fFans, ' ', fPad, ' ', fStage, ' ', fRead);
  // six switches: fans run 1..n (env.setFans), so switch k on runs fans 1..k, off stops k and the ones after
  // the steps hotfix: a held job waiting on these settings (few birds panting for 30 farm minutes, the floor drying)
  // runs a paused clock again; the note under the switches says what it waits for
  const waits = () => { const t = heldWaitText(L.engine()); if (t) shell.needTime(t); };
  const setFans = (n) => { env.setFans(n); L.uiAct('vent.fans', { n: env.fansManual ?? env.fansOn }); waits(); refresh(); };
  const fans = FAN_INDEXES.map((i) => {
    const sw = key(`Fan ${i + 1} switch`, `<span>${i + 1}</span>`, () => setFans(i < (env.fansManual ?? env.fansOn) ? i : i + 1));
    const led = h('span', { class: 'led led--run', 'aria-hidden': 'true' });
    const vane = h('span', { class: 'fan-vane', html: ROTOR, title: `Fan ${i + 1} air vane` });
    const sub = h('small');
    const el = h('div', { class: 'fan-sw' }, sw, h('span', { class: 'fan-name' }, h('span', null, led, ` Fan ${i + 1}`), sub), vane);
    return { sw, led, vane, sub, el };
  });
  const allOff = button({ class: 'key key--wide' }, 'All off');
  const allOn = button({ class: 'key key--wide' }, 'All six');
  allOff.addEventListener('click', () => setFans(0));
  allOn.addEventListener('click', () => setFans(FAN_COUNT));
  const pad = toggleKey('Stop the pad pump', 'Start the pad pump', () => { env.setPad(!env.padOn); L.uiAct('vent.pad', { on: env.padOn }); waits(); refresh(); });
  const hint = h('span', { class: 'cyc-dim' });
  // stage table (unlock tunnelStages)
  const draft = { stages: [{ overC: 1, fans: 2 }, { overC: 2, fans: 4 }, { overC: 3, fans: 6 }], padOn: false, padOverC: 5 };
  const stageRows = draft.stages.map((s, i) => {
    const over = stepper(`Stage ${i + 1}: degrees over the target`, '°C', (d) => { s.overC = Math.max(0, Math.min(10, s.overC + d * 0.5)); refresh(); });
    const nf = stepper(`Stage ${i + 1}: fans`, '', (d) => { s.fans = Math.max(0, Math.min(FAN_COUNT, s.fans + d)); refresh(); });
    return { over, nf, el: h('div', { class: 'cyc-stage' }, h('span', { class: 'fan-name' }, `Stage ${i + 1}`), h('span', { class: 'ctrl-keys' }, over.els), h('span', { class: 'ctrl-keys' }, nf.els)) };
  });
  const padStage = stepper('Pad from degrees over the target', '°C', (d) => { draft.padOverC = Math.max(0, Math.min(12, draft.padOverC + d * 0.5)); refresh(); });
  const padIn = toggleKey('Run the pad by hand', 'Put the pad in the table', () => { draft.padOn = !draft.padOn; refresh(); });
  const setStages = button({ class: 'key key--wide key--apply' }, 'Set the stages');
  const stagesOff = button({ class: 'key key--wide' }, 'Stages off');
  setStages.addEventListener('click', () => { L.act('vent.stages', { stages: draft.stages.map((s) => ({ ...s })), padOverC: draft.padOn ? draft.padOverC : null }); waits(); refresh(); });
  stagesOff.addEventListener('click', () => { L.act('vent.stages', { stages: null, padOverC: null }); waits(); refresh(); });
  const stages = h('div', { class: 'ctrl-timer cyc-stages', hidden: true },
    h('p', { class: 'ctrl-timer-k' }, 'Fan stages', h('small', null, ' · the house °C over the target sets the fans')),
    h('div', { class: 'cyc-stage' }, h('span'), h('span', { class: 'cyc-k' }, 'over the target'), h('span', { class: 'cyc-k' }, 'fans')),
    stageRows.map((r) => r.el),
    h('div', { class: 'cyc-stage' }, h('span', { class: 'fan-name' }, 'Pad'), h('span', { class: 'ctrl-keys' }, padStage.els), h('span', { class: 'ctrl-keys' }, padIn.el)),
    h('div', { class: 'ctrl-apply' }, stagesOff, setStages));
  const chart = h('div', { class: 'cyc-chart', hidden: true });
  shell.main.append(lcd.el, h('div', { class: 'fanbank' }, fans.map((f) => f.el)),
    h('div', { class: 'cyc-controls' }, hint, allOff, allOn, pad.el), shell.timeNote.el, stages, chart);

  let openFor = 0, readThis = false, lastRead = null;
  function readNow() {
    L.uiAct('fans.read', { fans: env.fansOn, houseC: +env.houseTemp.toFixed(1), rh: Math.round(env.houseRH), speedMs: +(env.airSpeed ?? 0).toFixed(2), pad: !!env.padOn });
    lastRead = env.timeLabel;
  }
  function drawChart() {
    const on = !!skills?.unlocked?.('fanChart');
    chart.hidden = !on;
    if (!on) return;
    const rows = historyOf(env);
    const f = lineChart({ rows, series: [{ key: 'fans', step: true }], lo: 0, hi: FAN_COUNT, H: 36, bands: [{ key: 'pad' }] });
    const t = lineChart({ rows, series: [{ key: 'house' }, { key: 'out', dash: '4 3', width: 1.3 }], H: 46 });
    chart.innerHTML = !f || !t ? '<p class="ctrl-chart-k">24-hour chart: collecting</p>'
      : `<p class="ctrl-chart-k">Last 24 hours · fans running 0–6 (pad on shaded)</p>${f.svg}<p class="ctrl-chart-k">House (solid) and outside (dashed) · ${t.lo}–${t.hi} °C</p>${t.svg}`;
  }
  function refresh() {
    const broken = env.fansBroken || [], manual = env.fansManual ?? env.fansOn;
    lcd.set([fmt1(env.houseTemp), fmt0(env.houseRH), fmt1(env.airSpeed ?? 0), fmt1(env.outsideTemp)]);
    const showChill = !!skills?.unlocked?.('windChill');
    chill.el.hidden = !showChill;
    if (showChill) {
      const wc = Math.max(0, env.windChill ?? 0);
      setText(chill.value, fmt1(env.houseTemp - wc));
      setText(chillSub, wc > 0.05 ? `wind chill: ${fmt1(wc)} °C cooler in ${fmt1(env.airSpeed ?? 0)} m/s air` : 'still air: no wind chill');
    }
    setText(fFans, `FANS ${env.fansOn}/${FAN_COUNT}`); fFans.classList.toggle('is-on', env.fansOn > 0);
    fPad.classList.toggle('is-on', !!env.padOn);
    fStage.hidden = !env.fanStages; fStage.classList.toggle('is-on', !!env.fanStages);
    setText(fRead, lastRead ? `READ ${lastRead}` : '');
    fans.forEach((f, i) => {
      const lamp = i < env.fansOn, air = lamp && !broken.includes(i);
      f.sw.setAttribute('aria-pressed', String(i < manual));
      f.led.classList.toggle('is-on', lamp);
      f.vane.classList.toggle('is-turning', air);
      setText(f.sub, i < manual ? 'switched on' : lamp ? 'on the timer' : 'off');
    });
    pad.set(!!env.padOn);
    setText(hint, env.fanStages ? 'The stage table runs the fans.' : env.ventTimer ? `Timer: ${env.ventTimer.fans} fan${env.ventTimer.fans === 1 ? '' : 's'} ${env.ventTimer.onSec}/${env.ventTimer.cycleSec} s` : 'Timer off');
    const st = !!skills?.unlocked?.('tunnelStages');
    stages.hidden = !st;
    if (st) {
      stageRows.forEach((r, i) => { r.over.set(`+${fmt1(draft.stages[i].overC)}`, '°C'); r.nf.set(String(draft.stages[i].fans)); });
      padStage.set(`+${fmt1(draft.padOverC)}`, '°C'); padIn.set(draft.padOn);
    }
  }
  let acc = 0, chartAcc = 0;
  return {
    el: shell.el,
    onOpen() {
      shell.refreshPlates(); openFor = 0; readThis = false;
      const s = env.fanStages;
      if (s?.stages?.length) { s.stages.slice(0, 3).forEach((x, i) => Object.assign(draft.stages[i], x)); draft.padOn = s.padOverC != null; if (s.padOverC != null) draft.padOverC = s.padOverC; }
    },
    update(dt, force) {
      openFor += dt;
      if (!readThis && openFor >= READ_AFTER) { readThis = true; readNow(); }
      acc -= dt; chartAcc -= dt;
      if (force || acc <= 0) { acc = 0.15; refresh(); }
      if (force || chartAcc <= 0) { chartAcc = 1; drawChart(); }
    },
  };
}

// ---------------- cooling pad pump ----------------
const padSvg = (c) => {
  // the pad seen from outside: six sections, water running down the wet ones (after a check)
  const W = 360, Hh = 100, sw = W / 6;
  const secs = Array.from({ length: 6 }, (_, k) => {
    const x = k * sw + 3, dry = c ? c.dry[k] : false, wet = c && c.flowing && !dry;
    return `<rect x="${x}" y="8" width="${sw - 6}" height="64" rx="2" fill="${!c ? 'var(--panel-raised)' : dry ? '#d9c79c' : '#8a7550'}" stroke="var(--plate-edge)"/>
      ${wet ? [0.2, 0.45, 0.7].map((f) => `<path d="M${(x + (sw - 6) * f).toFixed(1)} 10v60" stroke="var(--led-pad)" stroke-width="2" stroke-dasharray="5 4" opacity="0.9"/>`).join('') : ''}
      <text x="${x + (sw - 6) / 2}" y="96" font-size="10" text-anchor="middle" fill="var(--key-sub)" font-family="var(--font-display)">${k + 1}${c && dry ? ' dry' : ''}</text>`;
  }).join('');
  const sump = `<rect x="2" y="72" width="${W - 4}" height="5" rx="2" fill="${c?.overflow ? 'var(--led-pad)' : 'var(--key)'}"/>${c?.overflow ? `<path d="M10 77q8 6 16 0t16 0t16 0" stroke="var(--led-pad)" fill="none" stroke-width="2"/>` : ''}`;
  return `<svg viewBox="0 0 ${W} ${Hh}" aria-hidden="true">${secs}${sump}</svg>`;
};

export function buildPadPump(api) {
  const { L } = api;
  const { env, farm } = L;
  const shell = equipShell({ cls: 'equip--pad', icon: ICONS.pad, title: 'Cooling pad pump', sub: 'West end · pump, distribution pipe, float valve', plates: ['pad-pump'], signLinks: ['sign-heat'], onClose: L.close });
  const lcd = climateLcd(env, [['Outside', '°C'], ['Humidity out', '%']], 'Pad pump display');
  const pump = toggleKey('Stop the pump', 'Start the pump', () => { env.setPad(!env.padOn); L.uiAct('vent.pad', { on: env.padOn }); const t = heldWaitText(L.engine()); if (t) shell.needTime(t); refresh(); });
  const pumpRow = machineRow('Pad pump', 'water over the pad while the tunnel fans run', pump.el);
  pumpRow.led.classList.add('led--pad');
  const pic = h('div', { class: 'cyc-pad' });
  const status = h('p', { class: 'cyc-line', 'aria-live': 'polite' });
  const notes = h('p', { class: 'cyc-line cyc-dim' });
  let check = null, last = [];
  const bar = progressBar();
  // each job takes farm time (a walk along the pad, a flush, the float valve): the plate folds first
  // the steps hotfix: a paused clock runs again when one starts, and one still running finishes when the panel closes
  let isOpen = false;
  const done = (text) => { shell.timeNote.done(text); if (!isOpen) L.notice?.(`Pad pump: ${text}`, 5); };
  const job = (min, fn) => machineJob(env, min, () => { fn(); bar.set(0); refresh(); });
  const jobs = {
    check: job(2, () => { check = { ...padCheckOf(L.act('pad.check', {})), at: env.timeLabel, day: env.dayNumber }; done(`pad checked ${env.timeLabel}.`); }),
    flush: job(10, () => { L.act('pad.flush', {}); last.push(`Distribution pipe flushed ${env.timeLabel}.`); check = null; done(`distribution pipe flushed ${env.timeLabel}.`); }),
    float: job(3, () => { L.act('pad.fixFloat', {}); last.push(`Float valve freed ${env.timeLabel}.`); check = null; done(`float valve freed ${env.timeLabel}.`); }),
  };
  const TAKES = { check: 'walking along the pad takes 2 farm minutes', flush: 'flushing the distribution pipe takes 10 farm minutes', float: 'freeing the float valve takes 3 farm minutes' };
  const btn = (text, k) => { const b = button({ class: 'btn btn--machine' }, text); b.addEventListener('click', () => { if (Object.values(jobs).some((j) => j.running)) return; shell.needTime(TAKES[k]); jobs[k].start(); refresh(); }); return b; };
  const bCheck = btn('Check the pad: water on every section', 'check');
  bCheck.classList.add('btn--go');
  const bFlush = btn('Flush the distribution pipe', 'flush'), bFloat = btn('Free the float valve', 'float');
  shell.main.append(lcd.el, h('div', { class: 'ctrl-rows' }, pumpRow.el), h('div', { class: 'cyc-box', style: 'margin-top: 10px' }, pic, status, bar.el),
    h('div', { class: 'equip-btns' }, bCheck, bFlush, bFloat), shell.timeNote.el, notes);
  function refresh() {
    lcd.set([fmt1(env.houseTemp), fmt0(env.houseRH), fmt1(env.outsideTemp), fmt0(env.outsideRH)]);
    pump.set(!!env.padOn); pumpRow.led.classList.toggle('is-on', !!env.padOn); pumpRow.setState(`Pump: ${env.padOn ? 'on, water over the pad' : 'off'}`);
    const c = check && check.day === env.dayNumber ? check : null;
    const k = c ? `${c.dry.join()}|${c.flowing}|${c.overflow}` : 'none';
    if (pic.__k !== k) { pic.__k = k; pic.innerHTML = padSvg(c); }
    const running = Object.entries(jobs).find(([, j]) => j.running);
    if (running) setText(status, running[0] === 'check' ? 'Walking along the pad…' : running[0] === 'flush' ? 'Flushing the distribution pipe…' : 'Working on the float valve…');
    else if (c) {
      const wet = c.dry.filter((d) => !d).length;
      setText(status, `Checked ${c.at}: ${c.flowing ? `water running on ${wet} of 6 sections` : 'the pump is off, the pad is not running'}${c.overflow ? ' · water over the sump' : ''}.`);
    } else setText(status, 'Not checked today.');
    setText(notes, last.slice(-2).join(' '));
    for (const b of [bCheck, bFlush, bFloat]) b.disabled = !!running;
  }
  let acc = 0;
  return {
    el: shell.el,
    onOpen() { isOpen = true; shell.refreshPlates(); },
    busy: () => Object.values(jobs).some((j) => j.running),
    onClose() { isOpen = false; },
    update(dt, force) {
      for (const j of Object.values(jobs)) if (j.running) bar.set(j.tick() || 0.001);
      acc -= dt;
      if (force || acc <= 0) { acc = 0.2; refresh(); }
    },
  };
}
