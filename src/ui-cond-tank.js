// The water tank and the well pump (a water problem, PHASE4.md §4.4, §10.3, §12.3). Package "panels". The tank tower
// north-west of the house: the tank's sight gauge (the level now, live, and its drag marker: the lowest level since the
// last reading, farm.waterTank.lowPct / lowAt), the pump's pressure gauge and ammeter beside the plate's 2.4 bar / 6 A
// (the needles show the reading taken, as the filter gauges do), Read the gauges (water.tank: the marker goes back to
// the level), Repair the pump (pump.fix: a farm process of WATER_TANK.repairH hours, shown from fixing / fixUntil; the
// panel may close while it runs), and the water-tank plate. Readings only: no colour says good or bad.
import { WATER_TANK } from './config.js';
import { h, button, setText, fmt0, fmt1 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell, machineRow, readout } from './ui-equipment.js';
import { whenText, hoursText, progressBar } from './ui-cycle-kit.js';
import { ICONS4, dial } from './ui-cond-kit.js';

/** The sight gauge: a glass tube with the water in it, ticks every 10 %, the plate's 30 % and the drag marker. */
function sightSvg(levelPct, lowPct) {
  const top = 10, bot = 190, Y = (p) => bot - (Math.max(0, Math.min(100, p)) / 100) * (bot - top);
  let ticks = '';
  for (let p = 0; p <= 100; p += 10) ticks += `<path d="M48 ${Y(p).toFixed(1)}h${p % 50 ? 5 : 9}" stroke="var(--key-sub)" stroke-width="${p % 50 ? 1 : 1.6}"/>${p % 20 ? '' : `<text x="62" y="${(Y(p) + 3.5).toFixed(1)}" font-size="10" fill="var(--key-sub)" font-family="var(--font-display)">${p}</text>`}`;
  const lvl = Number.isFinite(levelPct) ? levelPct : 0;
  const water = `<rect x="27" y="${Y(lvl).toFixed(1)}" width="16" height="${(bot - Y(lvl)).toFixed(1)}" fill="var(--led-pad)" opacity="0.85"/><path d="M27 ${Y(lvl).toFixed(1)}h16" stroke="#e8f6fd" stroke-width="1.5"/>`;
  const plate = `<path d="M18 ${Y(WATER_TANK.lowPct).toFixed(1)}h34" stroke="var(--sign-yellow)" stroke-width="1.2" stroke-dasharray="3 2"/>`;
  const m = Number.isFinite(lowPct) ? Y(lowPct) : null;
  const marker = m == null ? '' : `<g class="cond-marker"><path d="M8 ${(m - 6).toFixed(1)}L22 ${m.toFixed(1)}L8 ${(m + 6).toFixed(1)}z" fill="var(--sign-yellow)" stroke="var(--sign-yellow-ink)" stroke-width="1"/><path d="M22 ${m.toFixed(1)}h6" stroke="var(--sign-yellow)" stroke-width="2"/></g>`;
  return `<svg viewBox="0 0 84 204" width="72" height="175" aria-hidden="true">
    <rect x="24" y="${top - 4}" width="22" height="${bot - top + 8}" rx="6" fill="rgba(0,0,0,0.35)" stroke="var(--plate-edge)" stroke-width="2"/>
    ${water}<rect x="25" y="${top - 3}" width="4" height="${bot - top + 6}" rx="2" fill="#ffffff" opacity="0.12"/>${ticks}${plate}${marker}
    <text x="42" y="202" font-size="9" text-anchor="middle" fill="var(--key-sub)" font-family="var(--font-display)">% full</text></svg>`;
}

export function buildWaterTank(api) {
  const { L } = api;
  const { env, farm } = L;
  const shell = equipShell({ cls: 'equip--cond equip--water-tank', icon: ICONS4.tank, title: 'Water tank and well pump', sub: 'Tank tower, north-west of the house · sight gauge, pump gauges',
    plates: ['water-tank'], signLinks: ['sign-water'], onClose: L.close });
  const T = () => farm.waterTank || { levelPct: WATER_TANK.startPct, lowPct: WATER_TANK.startPct, lowAt: null, pumpShare: 1, fixing: false, fixUntil: null, fixedAt: null };
  let isOpen = false, last = null, watching = false;

  // ---- the sight gauge (live) and the pump's dials (the last reading) ----
  const sight = h('div', { class: 'cond-sight', role: 'img' });
  const sightSub = h('small', { class: 'cond-dim' });
  const barDial = h('div', { class: 'cond-gauge' }), ampDial = h('div', { class: 'cond-gauge' });
  const barSub = h('small', null, `plate: about ${fmt1(WATER_TANK.pumpBar)} bar`), ampSub = h('small', null, `plate: about ${fmt0(WATER_TANK.pumpA)} A`);
  const rTank = readout('Tank and marker'), rPump = readout('Well pump');
  const readBtn = button({ class: 'btn btn--machine btn--go' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the gauges');
  readBtn.addEventListener('click', () => {
    const r = L.act('water.tank', {}) || {};
    last = { ...r, at: env.day };
    draw(true);
  });
  // ---- the repair: a farm process (pump.fix answers at once; the farm keeps fixing for repairH hours) ----
  const fixBtn = button({ class: 'btn btn--machine' }, 'Repair the pump');
  const fixBar = progressBar();
  fixBtn.addEventListener('click', () => {
    if (T().fixing) return;
    const r = L.act('pump.fix', {}) || {};
    if (r.started) {
      watching = true;
      shell.needTime(`the repair takes about ${fmt0(r.hours ?? WATER_TANK.repairH)} farm hours: the pump stands still and the tank alone feeds the lines and the pads. Close the panel and carry on; the repair goes on (Next job skips ahead)`);
    }
    draw(true);
  });
  const pump = machineRow('Well pump', '', fixBtn);
  pump.led.classList.add('led--pad');
  pump.el.append(h('div', { class: 'cond-row-bar' }, fixBar.el));
  const state = h('p', { class: 'cond-state', role: 'status' });
  shell.main.append(
    h('div', { class: 'cond-tank' }, h('div', { class: 'cond-gauge' }, sight, sightSub),
      h('div', null,
        h('div', { class: 'cond-dials' }, h('div', { class: 'cond-gauge' }, barDial, barSub), h('div', { class: 'cond-gauge' }, ampDial, ampSub), h('div', { class: 'cond-dial-btns' }, readBtn)),
        h('div', { class: 'equip-reads' }, rTank.el, rPump.el))),
    state, h('div', { class: 'ctrl-rows' }, pump.el), shell.timeNote.el);

  let key = '';
  function draw(force) {
    const t = T(), lvl = t.levelPct, low = t.lowPct;
    const k = `${Math.round(lvl)}|${Math.round(low)}|${last ? last.at : ''}`;
    if (force || k !== key) {
      key = k;
      sight.innerHTML = sightSvg(lvl, low);
      sight.setAttribute('aria-label', `Sight gauge: the tank ${fmt0(lvl)} % full; the marker at ${fmt0(low)} %`);
      barDial.innerHTML = dial({ v: last?.pumpBar ?? null, lo: 0, hi: 4, step: 1, mark: WATER_TANK.pumpBar, label: 'PRESSURE', unit: 'bar', size: 84 });
      ampDial.innerHTML = dial({ v: last?.pumpA ?? null, lo: 0, hi: 10, step: 2, mark: WATER_TANK.pumpA, label: 'CURRENT', unit: 'A', size: 84 });
    }
    setText(sightSub, `${fmt0(lvl)} % now · marker ${fmt0(low)} %${t.lowAt != null ? ` (${whenText(t.lowAt)})` : ''}`);
    if (last) {
      rTank.set(`${fmt0(last.levelPct)} % · marker ${fmt0(last.lowPct)} %`, `the lowest since the reading before${last.lowAt != null ? `, at ${whenText(last.lowAt)}` : ''} · read ${whenText(last.at)}`);
      rPump.set(last.pumpOn === false ? 'stopped' : `${fmt1(last.pumpBar)} bar · ${fmt1(last.pumpA)} A`, last.pumpOn === false ? `the pump stands still for the repair · read ${whenText(last.at)}` : `plate: about ${fmt1(WATER_TANK.pumpBar)} bar and ${fmt0(WATER_TANK.pumpA)} A in good order · read ${whenText(last.at)}`);
    } else {
      rTank.set('—', 'Read the gauges: the marker goes back to the level');
      rPump.set('—', `plate: about ${fmt1(WATER_TANK.pumpBar)} bar and ${fmt0(WATER_TANK.pumpA)} A in good order`);
    }
    // the repair from the farm's own state
    const fixing = !!t.fixing, from = fixing && Number.isFinite(t.fixUntil) ? t.fixUntil - WATER_TANK.repairH / 24 : null;
    fixBar.set(fixing && from != null ? Math.max(0.001, Math.min(0.999, (env.day - from) / (WATER_TANK.repairH / 24))) : 0);
    fixBtn.disabled = fixing;
    setText(fixBtn, fixing ? 'Repair running' : 'Repair the pump');
    pump.led.classList.toggle('is-on', !fixing);
    pump.setState(fixing ? 'Pump: stopped for the repair' : 'Pump: switched on, it fills the tank by its float switch');
    const hrs = Number.isFinite(t.pumpHours) ? ` · run hours ${fmt1(t.pumpHours)}` : '';
    setText(pump.small, `${fmt1(WATER_TANK.m3)} m³ tank · the drinker lines and the cooling pads draw on it${hrs}`);
    const s = fixing ? `<b>Repair running</b>${from != null ? ` since ${whenText(from)}, until ${whenText(t.fixUntil)} (${hoursText((t.fixUntil - env.day) * 24)} left)` : ''}: the pump stands still; the tank alone feeds the lines and the pads.`
      : t.fixedAt != null ? `The pump was repaired ${whenText(t.fixedAt)}. The tank is ${fmt0(lvl)} % full.` : `The tank is ${fmt0(lvl)} % full (the sight gauge).`;
    if (state.__t !== s) { state.__t = s; state.innerHTML = s; }
    // a repair started here that has ended: the note says so (a caption if the panel is closed)
    if (watching && !fixing) {
      watching = false;
      const done = `Pump repaired ${t.fixedAt != null ? whenText(t.fixedAt) : env.timeLabel}: it runs again and fills the tank.`;
      shell.timeNote.done(done);
      if (!isOpen) L.notice?.(`Well pump: ${done}`, 6);
    }
  }
  let acc = 0;
  return {
    el: shell.el,
    onOpen() { isOpen = true; shell.refreshPlates(); },
    onClose() { isOpen = false; },
    /** A repair started here: the panel host keeps updating the closed panel until it ends (its caption). */
    busy: () => watching,
    update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.25; draw(force); } },
  };
}
