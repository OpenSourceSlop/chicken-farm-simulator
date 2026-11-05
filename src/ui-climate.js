// The climate controller in a level: one LCD with the house now, min / max since the last read,
// setpoint, vent timer and light program, and three sections to set them (Temperature,
// Ventilation, Lights). Keeping it open 2 s reads it into the notebook (ui action controller.read,
// once per opening). The LCD shows measured values only; the target is the brooder sign's row of the day, shown
// as the sign's figure in the job strips above the sections (Sign / Yours, ui-jobstrip.js) while a job works toward it.
// Owner: package "panels" (Phase 3 on). Brooding level 2 adds the 24-hour temperature chart.
import { FAN_COUNT, EQUIP } from './config.js';
import { h, button, setText, uniqueId, fmt1, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { key, lcdCell } from './ui-controller.js';
import { buildPlate } from './ui-boards.js';
import { hhmm, int } from './ui-format.js';
// Phase 3 (package "panels"): brooders up, heat loss, min vent calculator, humidity chart, light presets, dimming
import { cycleControllerParts } from './ui-cycle-controller.js';
// the clarity round: the open job done here, its steps, the sign's target beside the live value
import { createJobStrip } from './ui-jobstrip.js';
import { timerAirM3h, luxOfDimmer, ventNeed, inletAirM3h, flapsWords } from './job-figures.js';
// the steps hotfix: a setting a held job waits on runs a paused clock again, with a note under the display
import { farmTimeNote, heldWaitText } from './ui-farmtime.js';
// the night fix (after Phase 5): what the brooders do and why, the thermostat beside the sign's row, the ventilation's
// warnings (tunnel fans for young birds, the brooders at full and losing) and the floor, from the house's heat balance
import { controllerNotes } from './heat-diag.js';
import { injectStyle } from './ui-dom.js';
const NOTE_CSS = `
.ctrl-note { display: grid; grid-template-columns: 12px minmax(0, 1fr); gap: 8px; align-items: start; margin: 6px 0 0; padding: 6px 8px; border-radius: 6px; background: var(--panel-sunk); color: var(--ink); font-size: 12.5px; line-height: 1.45; }
.ctrl-note .fw-dot { margin-top: 3px; }
.ctrl-note--floor { color: var(--ink-dim); }
.ctrl-notes { display: grid; gap: 6px; margin: 4px 0 8px; }
.ctrl-notes:empty { display: none; }
`;
/** One note line: the watch's state dot and the words (refreshed in place). */
function noteLine(cls = '') {
  const dot = h('span', { class: 'fw-dot', role: 'img' }), text = h('span');
  const el = h('p', { class: `ctrl-note ${cls}`, hidden: true }, dot, text);
  return { el, set(n) { el.hidden = !n; if (!n) return; const c = `fw-dot is-${n.state || 'green'}`; if (dot.className !== c) dot.className = c; dot.setAttribute('aria-label', { green: 'steady', amber: 'watch', red: 'alert' }[n.state] || ''); setText(text, n.text); } };
}

const READ_AFTER = 2; // real seconds open before the controller counts as read

/** "This setting ≈ 960 m³/h = 103 % of the need (vent sign: about 900; 928 worked out for tomorrow's chicks)": the
 *  timer setting on the keys (not sent yet or sent) beside the need of the flock the farmer knows (job-figures ventNeed:
 *  the vent sign's table; on the prep day the sign's own example of 6,000 chicks of 42 g). */
export function ventLine(env, farm, draft) {
  const v = ventNeed(env, farm, draft), air = Math.round(inletAirM3h(env, draft)), fl = flapsWords(env);
  if (!(v.need > 0)) return `This setting ≈ ${int(air)} m³/h${fl ? ` (${fl})` : ''}`;
  const share = Math.round((air / v.need) * 100);
  const need = Math.round(v.need);
  return `This setting ≈ ${int(air)} m³/h = ${share} % of the need (${v.prep ? `vent sign: about 900; ${int(need)} worked out for tomorrow’s chicks` : `${int(need)} m³/h worked out for today’s flock from the vent sign’s table`}${fl ? `; ${fl}` : ''})`;
}

/** Scroll the panel (not the page) so `el` is inside its visible part, the least distance (block: nearest). */
function scrollIntoPanel(el) {
  const box = el.closest('.panel');
  if (!box) return;
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom + 6, r.top - b.top);
  else if (r.top < b.top) box.scrollTop -= b.top - r.top + 6;
}

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
  const SECTION = { temp: 'Temperature', vent: 'Ventilation', lights: 'Lights' };
  const tabBtns = tabs.map((t, i) => button({ class: 'ctrl-tab', role: 'tab', 'aria-selected': String(i === 0) }, t));
  const secs = tabs.map(() => h('div', { class: 'ctrl-sec', role: 'tabpanel' }));
  let tab = 0, keepTimerInView = 0;
  // the clarity round (PHASE4.md §6.2): the Ventilation tab opens with the timer's keys, its line and Send this setting
  // on screen together (a short window scrolls the panel to them; the job strips above settle first, so a few frames)
  const showTab = (i) => { tab = i; tabBtns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); secs.forEach((s, j) => { s.hidden = i !== j; }); if (i === 1) keepTimerInView = 0.6; };
  tabBtns.forEach((b, i) => b.addEventListener('click', () => showTab(i)));
  const out = () => h('output', { class: 'lcd-mini', 'aria-live': 'polite' });
  const row = (title, sub, ...c) => h('div', { class: 'ctrl-row' }, h('span', { class: 'led', 'aria-hidden': 'true' }), h('div', { class: 'ctrl-label' }, h('span', null, title), sub ? h('small', null, sub) : null), h('div', { class: 'ctrl-keys' }, c));

  // the steps hotfix: after a setting, an open job that must hold over farm time (the chicks near the target for 30
  // farm minutes, the floor drying) needs the clock: a paused clock runs again and the note says what it waits for
  const timeNote = farmTimeNote();
  const waits = () => { const t = heldWaitText(L.engine()); if (t) timeNote.start(t); };
  // Temperature
  const spOut = out(), heatState = h('span');
  const setpoint = (d) => { env.setHeaterSetpoint(env.heaterSetpoint + d); L.uiAct('heat.setpoint', { value: env.heaterSetpoint }); waits(); refresh(); };
  const chart = h('div', { class: 'ctrl-chart' });
  // the night fix: the thermostat beside the brooder sign's row, the brooders' output and what the house does, the floor
  injectStyle('ctrl-night-style', NOTE_CSS);
  const spNote = noteLine('ctrl-note--sp'), tempNote = noteLine('ctrl-note--temp'), floorNote = noteLine('ctrl-note--floor');
  const ventNotes = h('div', { class: 'ctrl-notes ctrl-notes--vent' });
  secs[0].append(row('Brooder thermostat', heatState, key('Lower the brooder thermostat by 0.5 °C', ICONS.minus, () => setpoint(-0.5)), spOut, key('Raise the brooder thermostat by 0.5 °C', ICONS.plus, () => setpoint(0.5))),
    spNote.el, tempNote.el, chart, floorNote.el);

  // Ventilation. In a level env.fansOn also counts the timer fans while they run: step the fans
  // switched on by hand (env.fansManual).
  const manualFans = (d) => { env.setFans((env.fansManual ?? env.fansOn) + d); L.uiAct('vent.fans', { n: env.fansManual ?? env.fansOn }); waits(); refresh(); };
  const padState = h('span', { class: 'ctrl-sub' });
  const fanOut = out(), padBtn = button({ class: 'key key--wide key--act', 'aria-pressed': 'false' });
  padBtn.addEventListener('click', () => { env.setPad(!env.padOn); L.uiAct('vent.pad', { on: env.padOn }); waits(); refresh(); });
  const draft = { fans: env.ventTimer?.fans ?? 1, onSec: env.ventTimer?.onSec ?? 0, cycleSec: env.ventTimer?.cycleSec ?? 300 };
  const tFans = out(), tOn = out(), tCycle = out(), tAir = h('span', { class: 'ctrl-air' }), tNow = h('p', { class: 'ctrl-timer-now' });
  // Shift held: the big step (10 s on-seconds), as the winches step 5 cm
  const step = (k, d, lo, hi, big = d) => (e) => { draft[k] = Math.max(lo, Math.min(hi, draft[k] + (e && e.shiftKey ? big : d))); if (draft.onSec > draft.cycleSec) draft.onSec = draft.cycleSec; refresh(); };
  let timerBox = null;
  const applyTimer = button({ class: 'key key--wide key--apply key--act' }, 'Send this setting to the timer');
  const timerOff = button({ class: 'key key--wide key--act' }, 'Switch the timer off');
  applyTimer.addEventListener('click', () => {
    const t = { ...draft };
    L.act('vent.timer', t); // the farm sets env.setVentTimer itself
    waits(); refresh();
  });
  timerOff.addEventListener('click', () => { const t = { fans: draft.fans, onSec: 0, cycleSec: draft.cycleSec }; draft.onSec = 0; L.act('vent.timer', t); waits(); refresh(); });
  secs[1].append(ventNotes,
    row('Tunnel fans', 'running all the time, switched by hand: air along the floor, for big birds in the heat', key('One tunnel fan fewer', ICONS.minus, () => manualFans(-1)), fanOut,
      key('One tunnel fan more', ICONS.plus, () => manualFans(1))),
    timerBox = h('div', { class: 'ctrl-timer' },
      h('p', { class: 'ctrl-timer-k' }, 'Minimum ventilation timer', h('small', null, ' · fresh air in at the side inlets, moisture and ammonia out')),
      tNow,
      row('Fans on the timer', 'how many fans the timer starts', key('One timer fan fewer', ICONS.minus, step('fans', -1, 1, FAN_COUNT)), tFans, key('One timer fan more', ICONS.plus, step('fans', 1, 1, FAN_COUNT))),
      row('On-seconds', 'how long they run in each cycle · Shift: 10 s', key('One second less', ICONS.minus, step('onSec', -1, 0, 600, -10)), tOn, key('One second more', ICONS.plus, step('onSec', 1, 0, 600, 10))),
      row('Cycle', 'one on-and-off round, seconds', key('Cycle 30 s shorter', ICONS.minus, step('cycleSec', -30, 60, 600)), tCycle, key('Cycle 30 s longer', ICONS.plus, step('cycleSec', 30, 60, 600))),
      h('div', { class: 'ctrl-apply' }, tAir, timerOff, applyTimer)),
    row('Cooling pad', padState, padBtn));

  // Lights
  const lp = { ...(env.lightProgram || { darkStart: 2, darkHours: 1, dimmer: 1 }) };
  const lStart = out(), lHours = out(), lDim = out(), lux = h('span', { class: 'ctrl-air' }), lightDay = h('span'), dimLux = h('span');
  const lstep = (k, d, lo, hi, wrap) => () => { let v = lp[k] + d; if (wrap) v = (v + 24) % 24; lp[k] = Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)); refresh(); };
  const applyLights = button({ class: 'key key--wide key--apply' }, 'Set the program');
  applyLights.addEventListener('click', () => { const p = { ...lp }; L.act('light.program', p); refresh(); });
  const luxBtn = button({ class: 'key key--wide' }, 'Measure lux here');
  luxBtn.addEventListener('click', () => { const p = L.player.position; const r = L.act('light.lux', { x: p.x, z: p.z }); setText(lux, `${int(r?.lux)} lux at chick level here`); });
  let lightsPlate = buildPlate('controller-lights');
  const cyc = cycleControllerParts(L, { draft, lp, refresh: () => refresh() });
  secs[0].insertBefore(h('div', { style: 'display: contents' }, cyc.temp), chart);
  secs[1].append(...cyc.vent);
  secs[2].append(h('div', { class: 'ctrl-lights' }, h('div', null, ...cyc.lights,
    row('Dark period starts', null, key('One hour earlier', ICONS.minus, lstep('darkStart', -1, 0, 23, true)), lStart, key('One hour later', ICONS.plus, lstep('darkStart', 1, 0, 23, true))),
    row('Dark hours', lightDay, key('Half an hour less', ICONS.minus, lstep('darkHours', -0.5, 0, 12)), lHours, key('Half an hour more', ICONS.plus, lstep('darkHours', 0.5, 0, 12))),
    row('Dimmer', dimLux, key('Dimmer down 10 %', ICONS.minus, lstep('dimmer', -0.1, 0.1, 1)), lDim, key('Dimmer up 10 %', ICONS.plus, lstep('dimmer', 0.1, 0.1, 1))),
    ...cyc.lightsRows,
    h('div', { class: 'ctrl-apply' }, lux, luxBtn, applyLights)), lightsPlate.el));

  const brand = h('header', { class: 'ctrl-brand' }, h('span', { class: 'ctrl-logo', html: ICONS.fan, 'aria-hidden': 'true' }),
    h('div', null, h('h2', { id: titleId }, 'Climate controller'), h('p', null, 'House 1 · tunnel ventilation · min vent timer · lights')));
  const screws = ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `screw screw--${p}`, 'aria-hidden': 'true' }));
  // job strips: the jobs read at the controller above the tabs, each section's jobs at the top of its tab
  let lastRead = null;
  const sctx = () => ({ ventDraft: { ...draft }, readAt: lastRead });
  const strips = [createJobStrip(L, 'controller', { section: 'top', ctx: sctx, label: SECTION }),
    ...['temp', 'vent', 'lights'].map((sec) => createJobStrip(L, 'controller', { section: sec, ctx: sctx }))];
  secs.forEach((sec, i) => sec.prepend(strips[i + 1].el));
  el.append(h('div', { class: 'ctrl-case' }, screws, brand, h('div', { class: 'ctrl-plate' }, lcd, strips[0].el, timeNote.el,
    h('div', { class: 'ctrl-tabs', role: 'tablist' }, tabBtns), secs)), closeBtn);
  showTab(0);

  let openFor = 0, readThisOpening = false;
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
    // the night fix: the tunnel fans by hand on their own flag (the timer's fans are the TIMER flag)
    const tn = env.fansManual ?? env.fansOn;
    setText(flags.fans, `TUNNEL ${tn}/${FAN_COUNT}`); flags.fans.classList.toggle('is-on', tn > 0);
    const t = env.ventTimer;
    setText(flags.timer, t ? `TIMER ${t.fans}× ${t.onSec}/${t.cycleSec}s` : 'TIMER OFF'); flags.timer.classList.toggle('is-on', !!t);
    const p = env.lightProgram || {};
    setText(flags.light, `DARK ${hhmm(p.darkStart ?? 2)} ${fmt1(p.darkHours ?? 1)}h ${Math.round((p.dimmer ?? 1) * 100)}%`); flags.light.classList.toggle('is-on', env.lightsOn);
    flags.pad.classList.toggle('is-on', env.padOn);
    setText(spOut, `${fmt1(env.heaterSetpoint)} °C`);
    setText(heatState, env.heatersOn ? 'Brooders burning' : 'Brooders off');
    setText(fanOut, `${env.fansManual ?? env.fansOn} / ${FAN_COUNT}`);
    // review round: lit, the key shows the pump's state; what a press does stays in its aria-label and title
    const padAct = env.padOn ? 'Stop the pad pump' : 'Start the pad pump';
    padBtn.setAttribute('aria-pressed', String(env.padOn)); setText(padBtn, env.padOn ? 'Pad pump · running' : padAct);
    if (padBtn.getAttribute('aria-label') !== padAct) { padBtn.setAttribute('aria-label', padAct); padBtn.title = padAct; }
    setText(padState, `Pad pump: ${env.padOn ? 'on, water over the west end pad' : 'off'} · it cools the tunnel air of big birds in the heat`);
    setText(tFans, String(draft.fans)); setText(tOn, `${draft.onSec} s`); setText(tCycle, `${draft.cycleSec} s`);
    // the clarity round (PHASE4.md §6.2): the setting beside the need it is for, on screen with the keys
    setText(tAir, ventLine(env, farm, draft));
    const vt = env.ventTimer;
    setText(tNow, `Timer now: ${vt && vt.fans > 0 && vt.onSec > 0 ? `${vt.fans} fan${vt.fans === 1 ? '' : 's'}, ${vt.onSec} s on in every ${vt.cycleSec} s = ${int(timerAirM3h(vt))} m³/h` : 'off'}`);
    // the night fix: the notes from the heat balance (cheap: a few steady-state solves only while the house is cold)
    let n = null;
    try { n = controllerNotes(env, farm); } catch (err) { n = null; }
    spNote.set(n?.sp); tempNote.set(n?.temp); floorNote.set(n?.floor);
    const vk = (n?.vent || []).map((x) => `${x.state}|${x.text}`).join('\n');
    if (ventNotes.__k !== vk) { ventNotes.__k = vk; ventNotes.replaceChildren(...(n?.vent || []).map((x) => { const l = noteLine('ctrl-note--vent'); l.set(x); return l.el; })); }
    setText(lStart, hhmm(lp.darkStart)); setText(lHours, `${fmt1(lp.darkHours)} h`); setText(lDim, `${Math.round(lp.dimmer * 100)} %`);
    setText(lightDay, `a day · light ${fmt1(24 - lp.darkHours)} h a day`); setText(dimLux, `light while on · about ${int(luxOfDimmer(lp.dimmer))} lux at bird level`);
  }
  let acc = 0, chartAcc = 0, stripAcc = 0;
  return {
    el,
    onOpen() {
      openFor = 0; readThisOpening = false;
      const vt = env.ventTimer; if (vt) Object.assign(draft, vt);
      Object.assign(lp, env.lightProgram || {});
      // Phase 3: the lights plate gains its week 2 lines from day 8 (merged board of the day)
      const fresh = buildPlate('controller-lights', { open: lightsPlate.open });
      if (fresh.el.querySelectorAll('.plate-items > li').length !== lightsPlate.el.querySelectorAll('.plate-items > li').length) { lightsPlate.el.replaceWith(fresh.el); lightsPlate = fresh; }
      cyc.onOpen();
      for (const st of strips) st.onOpen();
      if (tab === 1) keepTimerInView = 0.6;
    },
    onClose() { for (const st of strips) st.onClose(); },
    /** The night fix: open on a section ('temp' | 'vent' | 'lights'; the night check's Fix it). */
    openTab(name) { const i = { temp: 0, vent: 1, lights: 2 }[name]; if (i != null) showTab(i); },
    update(dt, force) {
      openFor += dt;
      if (!readThisOpening && openFor >= READ_AFTER) { readThisOpening = true; readNow(); }
      acc -= dt; chartAcc -= dt;
      if (force || acc <= 0) { acc = 0.1; refresh(); }
      stripAcc -= dt; if (force || stripAcc <= 0) { stripAcc = 0.25; for (const st of strips) st.update(); }
      if (keepTimerInView > 0 && tab === 1 && timerBox) { keepTimerInView -= dt; scrollIntoPanel(timerBox); }
      if (force || chartAcc <= 0) { chartAcc = 1; drawChart(); }
      cyc.update(dt, force);
    },
  };
}
