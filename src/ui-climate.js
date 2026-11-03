// The climate controller in a level: one LCD with the house now, min / max since the last read,
// setpoint, vent timer and light program, and three sections to set them (Temperature,
// Ventilation, Lights). Keeping it open 2 s reads it into the notebook (ui action controller.read,
// once per opening). No target is shown here: the farmer reads it off the brooder sign.
// Owner: package "level". Brooding level 2 adds the 24-hour temperature chart.
import { FAN_COUNT, EQUIP } from './config.js';
import { h, button, setText, uniqueId, fmt1, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { key, lcdCell } from './ui-controller.js';
import { buildPlate } from './ui-boards.js';
import { hhmm, int } from './ui-format.js';

const READ_AFTER = 2; // real seconds open before the controller counts as read

export function buildLevelControllerPanel(L) {
  const { env, farm, skills } = L;
  const titleId = uniqueId('ctrl-title');
  const { el, closeBtn } = dialogShell('ctrl ctrl--level', titleId, L.close);

  // ---- LCD ----
  const house = lcdCell('House', '°C'), outside = lcdCell('Outside', '°C');
  const rhIn = lcdCell('Humidity in', '%'), sp = lcdCell('Thermostat', '°C');
  const min = lcdCell('Min since read', '°C'), max = lcdCell('Max since read', '°C');
  const flags = { heat: h('span', { class: 'lcd-flag' }, 'HEAT'), fans: h('span', { class: 'lcd-flag' }), timer: h('span', { class: 'lcd-flag' }), light: h('span', { class: 'lcd-flag' }), pad: h('span', { class: 'lcd-flag' }, 'PAD') };
  const clock = h('span'), readFlag = h('span', { class: 'lcd-read' });
  const lcd = h('div', { class: 'lcd', role: 'group', 'aria-label': 'Controller display' },
    h('div', { class: 'lcd-grid' }, house.el, outside.el, rhIn.el, sp.el, min.el, max.el),
    h('div', { class: 'lcd-foot' }, flags.heat, flags.fans, flags.timer, flags.light, flags.pad, readFlag, h('span', { class: 'lcd-clock' }, clock)));

  // ---- sections ----
  const tabs = ['Temperature', 'Ventilation', 'Lights'];
  const tabBtns = tabs.map((t, i) => button({ class: 'ctrl-tab', role: 'tab', 'aria-selected': String(i === 0) }, t));
  const secs = tabs.map(() => h('div', { class: 'ctrl-sec', role: 'tabpanel' }));
  let tab = 0;
  const showTab = (i) => { tab = i; tabBtns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); secs.forEach((s, j) => { s.hidden = i !== j; }); };
  tabBtns.forEach((b, i) => b.addEventListener('click', () => showTab(i)));
  const out = () => h('output', { class: 'lcd-mini', 'aria-live': 'polite' });
  const row = (title, sub, ...c) => h('div', { class: 'ctrl-row' }, h('span', { class: 'led', 'aria-hidden': 'true' }), h('div', { class: 'ctrl-label' }, h('span', null, title), sub ? h('small', null, sub) : null), h('div', { class: 'ctrl-keys' }, c));

  // Temperature
  const spOut = out(), heatState = h('span');
  const setpoint = (d) => { env.setHeaterSetpoint(env.heaterSetpoint + d); L.uiAct('heat.setpoint', { value: env.heaterSetpoint }); refresh(); };
  const chart = h('div', { class: 'ctrl-chart' });
  secs[0].append(row('Brooder thermostat', heatState, key('Lower the brooder thermostat by 0.5 °C', ICONS.minus, () => setpoint(-0.5)), spOut, key('Raise the brooder thermostat by 0.5 °C', ICONS.plus, () => setpoint(0.5))), chart);

  // Ventilation
  const fanOut = out(), padBtn = button({ class: 'key key--wide', 'aria-pressed': 'false' });
  padBtn.addEventListener('click', () => { env.setPad(!env.padOn); refresh(); });
  const draft = { fans: env.ventTimer?.fans ?? 1, onSec: env.ventTimer?.onSec ?? 0, cycleSec: env.ventTimer?.cycleSec ?? 300 };
  const tFans = out(), tOn = out(), tCycle = out(), tAir = h('span', { class: 'ctrl-air' });
  const step = (k, d, lo, hi) => () => { draft[k] = Math.max(lo, Math.min(hi, draft[k] + d)); if (draft.onSec > draft.cycleSec) draft.onSec = draft.cycleSec; refresh(); };
  const applyTimer = button({ class: 'key key--wide key--apply' }, 'Set the timer');
  const timerOff = button({ class: 'key key--wide' }, 'Timer off');
  applyTimer.addEventListener('click', () => {
    const t = { ...draft };
    L.act('vent.timer', t);
    if (farm.stub) env.setVentTimer(t.onSec > 0 ? t : null); // the model sets it itself once sim merges
    refresh();
  });
  timerOff.addEventListener('click', () => { const t = { fans: draft.fans, onSec: 0, cycleSec: draft.cycleSec }; draft.onSec = 0; L.act('vent.timer', t); if (farm.stub) env.setVentTimer(null); refresh(); });
  secs[1].append(
    row('Tunnel fans', 'Running all the time', key('One tunnel fan fewer', ICONS.minus, () => { env.setFans(env.fansOn - 1); L.uiAct('vent.fans', { n: env.fansOn }); refresh(); }), fanOut,
      key('One tunnel fan more', ICONS.plus, () => { env.setFans(env.fansOn + 1); L.uiAct('vent.fans', { n: env.fansOn }); refresh(); })),
    h('div', { class: 'ctrl-timer' },
      h('p', { class: 'ctrl-timer-k' }, 'Minimum ventilation timer'),
      row('Fans on the timer', null, key('One timer fan fewer', ICONS.minus, step('fans', -1, 1, FAN_COUNT)), tFans, key('One timer fan more', ICONS.plus, step('fans', 1, 1, FAN_COUNT))),
      row('On-seconds', 'in each cycle', key('One second less', ICONS.minus, step('onSec', -1, 0, 600)), tOn, key('One second more', ICONS.plus, step('onSec', 1, 0, 600))),
      row('Cycle', 'seconds', key('Cycle 30 s shorter', ICONS.minus, step('cycleSec', -30, 60, 600)), tCycle, key('Cycle 30 s longer', ICONS.plus, step('cycleSec', 30, 60, 600))),
      h('div', { class: 'ctrl-apply' }, tAir, timerOff, applyTimer)),
    row('Cooling pad', 'Water on the west end pad', padBtn));

  // Lights
  const lp = { ...(env.lightProgram || { darkStart: 2, darkHours: 1, dimmer: 1 }) };
  const lStart = out(), lHours = out(), lDim = out(), lux = h('span', { class: 'ctrl-air' });
  const lstep = (k, d, lo, hi, wrap) => () => { let v = lp[k] + d; if (wrap) v = (v + 24) % 24; lp[k] = Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)); refresh(); };
  const applyLights = button({ class: 'key key--wide key--apply' }, 'Set the program');
  applyLights.addEventListener('click', () => { const p = { ...lp }; L.act('light.program', p); if (farm.stub) env.setLightProgram(p); refresh(); });
  const luxBtn = button({ class: 'key key--wide' }, 'Measure lux here');
  luxBtn.addEventListener('click', () => { const p = L.player.position; const r = L.act('light.lux', { x: p.x, z: p.z }); setText(lux, `${int(r?.lux)} lux at chick level here`); });
  const lightsPlate = buildPlate('controller-lights');
  secs[2].append(h('div', { class: 'ctrl-lights' }, h('div', null,
    row('Dark period starts', null, key('One hour earlier', ICONS.minus, lstep('darkStart', -1, 0, 23, true)), lStart, key('One hour later', ICONS.plus, lstep('darkStart', 1, 0, 23, true))),
    row('Dark hours', 'a day', key('Half an hour less', ICONS.minus, lstep('darkHours', -0.5, 0, 12)), lHours, key('Half an hour more', ICONS.plus, lstep('darkHours', 0.5, 0, 12))),
    row('Dimmer', 'light while on', key('Dimmer down 10 %', ICONS.minus, lstep('dimmer', -0.1, 0.1, 1)), lDim, key('Dimmer up 10 %', ICONS.plus, lstep('dimmer', 0.1, 0.1, 1))),
    h('div', { class: 'ctrl-apply' }, lux, luxBtn, applyLights)), lightsPlate.el));

  const brand = h('header', { class: 'ctrl-brand' }, h('span', { class: 'ctrl-logo', html: ICONS.fan, 'aria-hidden': 'true' }),
    h('div', null, h('h2', { id: titleId }, 'Climate controller'), h('p', null, 'House 1 · tunnel ventilation · min vent timer · lights')));
  const screws = ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `screw screw--${p}`, 'aria-hidden': 'true' }));
  el.append(h('div', { class: 'ctrl-case' }, screws, brand, h('div', { class: 'ctrl-plate' }, lcd,
    h('div', { class: 'ctrl-tabs', role: 'tablist' }, tabBtns), secs)), closeBtn);
  showTab(0);

  let openFor = 0, readThisOpening = false, lastRead = null;
  function readNow() {
    const mm = L.minmax();
    L.uiAct('controller.read', { houseC: +env.houseTemp.toFixed(1), minC: mm.min == null ? null : +mm.min.toFixed(1), maxC: mm.max == null ? null : +mm.max.toFixed(1),
      setpoint: env.heaterSetpoint, timer: env.ventTimer ? { ...env.ventTimer } : null, light: env.lightProgram ? { ...env.lightProgram } : null });
    lastRead = env.timeLabel;
    L.resetMinMax();
  }
  function drawChart() {
    if (!skills?.unlocked?.('brooderChart')) { chart.hidden = true; return; }
    chart.hidden = false;
    const hist = L.history();
    if (hist.length < 2) { chart.innerHTML = '<p class="ctrl-chart-k">24-hour chart: collecting</p>'; return; }
    const W = 300, Ht = 90, t1 = hist[hist.length - 1].t, t0 = t1 - 1;
    const temps = hist.map((p) => p.house).concat(hist.map((p) => p.sp));
    const lo = Math.floor(Math.min(...temps) - 1), hi = Math.ceil(Math.max(...temps) + 1);
    const X = (t) => ((t - t0) / (t1 - t0)) * W, Y = (v) => Ht - ((v - lo) / (hi - lo)) * Ht;
    const line = (k) => hist.filter((p) => p.t >= t0).map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
    chart.innerHTML = `<p class="ctrl-chart-k">Last 24 hours · house (solid) and thermostat (dashed) · ${lo}–${hi} °C</p>
      <svg viewBox="0 -4 ${W} ${Ht + 8}" width="100%" height="${Ht + 8}" preserveAspectRatio="none"><path d="${line('sp')}" fill="none" stroke="var(--lcd-ink)" stroke-width="1.4" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
      <path d="${line('house')}" fill="none" stroke="var(--lcd-ink)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function refresh() {
    setText(house.value, fmt1(env.houseTemp)); setText(outside.value, fmt1(env.outsideTemp));
    setText(rhIn.value, fmt0(env.houseRH)); setText(sp.value, fmt1(env.heaterSetpoint));
    const mm = L.minmax();
    setText(min.value, mm.min == null ? '--' : fmt1(mm.min)); setText(max.value, mm.max == null ? '--' : fmt1(mm.max));
    setText(clock, `DAY ${fmt0(env.dayNumber)}  ${env.timeLabel}`);
    setText(readFlag, lastRead ? `READ ${lastRead}` : '');
    flags.heat.classList.toggle('is-on', env.heatersOn);
    setText(flags.fans, `FANS ${env.fansOn}/${FAN_COUNT}`); flags.fans.classList.toggle('is-on', env.fansOn > 0);
    const t = env.ventTimer;
    setText(flags.timer, t ? `TIMER ${t.fans}× ${t.onSec}/${t.cycleSec}s` : 'TIMER OFF'); flags.timer.classList.toggle('is-on', !!t);
    const p = env.lightProgram || {};
    setText(flags.light, `DARK ${hhmm(p.darkStart ?? 2)} ${fmt1(p.darkHours ?? 1)}h ${Math.round((p.dimmer ?? 1) * 100)}%`); flags.light.classList.toggle('is-on', env.lightsOn);
    flags.pad.classList.toggle('is-on', env.padOn);
    setText(spOut, `${fmt1(env.heaterSetpoint)} °C`);
    setText(heatState, env.heatersOn ? 'Brooders burning' : 'Brooders off');
    setText(fanOut, `${env.fansOn} / ${FAN_COUNT}`);
    padBtn.setAttribute('aria-pressed', String(env.padOn)); setText(padBtn, env.padOn ? 'Pad on' : 'Pad off');
    setText(tFans, String(draft.fans)); setText(tOn, `${draft.onSec} s`); setText(tCycle, `${draft.cycleSec} s`);
    const air = Math.round((draft.fans * EQUIP.fanM3h * draft.onSec) / Math.max(1, draft.cycleSec));
    setText(tAir, `Timer air ≈ ${int(air)} m³/h`);
    setText(lStart, hhmm(lp.darkStart)); setText(lHours, `${fmt1(lp.darkHours)} h`); setText(lDim, `${Math.round(lp.dimmer * 100)} %`);
  }
  let acc = 0, chartAcc = 0;
  return {
    el,
    onOpen() {
      openFor = 0; readThisOpening = false;
      const vt = env.ventTimer; if (vt) Object.assign(draft, vt);
      Object.assign(lp, env.lightProgram || {});
    },
    update(dt, force) {
      openFor += dt;
      if (!readThisOpening && openFor >= READ_AFTER) { readThisOpening = true; readNow(); }
      acc -= dt; chartAcc -= dt;
      if (force || acc <= 0) { acc = 0.1; refresh(); }
      if (force || chartAcc <= 0) { chartAcc = 1; drawChart(); }
    },
  };
}
