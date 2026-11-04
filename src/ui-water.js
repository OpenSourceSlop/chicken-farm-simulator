// Level 1 water panels: the drinker line regulator (side view with ruler and a chick's head, winch,
// pressure knob and sight tube, cup flow test) and the water supply (meter, filter gauges, filter
// cleaning, four flush valves with sight tubes, the all-lines overview once unlocked).
// Owner: package "level". Farm time a test needs runs on the panel clock; the plate folds first.
import { DRINKER_LINES_Z, EQUIP, flockAgeAt } from './config.js';
import { h, button, setText, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell, machineRow, readout, stepper, toggleKey } from './ui-equipment.js';
import { int, one, signedPct, hhmm } from './ui-format.js';
// Phase 3 (package "panels"): main valve, Vaccine / Medicine / Clean-out tabs, the water test kit
import { cycleWaterParts } from './ui-cycle-water.js';

const GAME_MIN = 1 / 1440;

// Eye height of a chick above the litter by flock age (cm, general practice drawing aid): a day-old
// chick's eye sits about 10 cm up; it rises as the bird grows. Only for the picture.
const eyeCm = (age) => 9.5 + Math.max(0, age) * 0.9;

/** Drinker line N: regulator at the west end of the line. */
export function buildDrinkerPanel(L, line) {
  const { farm, env } = L;
  const shell = equipShell({ cls: 'equip--drinker', icon: ICONS.droplet, title: `Drinker line ${line + 1}`, sub: 'Regulator, west end · winch, pressure, flow test', plates: ['drinker'], signLinks: ['sign-water'], onClose: L.close });
  const side = h('div', { class: 'drinker-view', 'aria-hidden': 'true' });
  const heightText = h('p', { class: 'drinker-read' });
  const winch = stepper('Winch', 'cm', (d) => {
    const [lo, hi] = EQUIP.nippleHeightCm;
    const cm = Math.max(lo, Math.min(hi, Math.round(farm.water.lines[line].heightCm + d)));
    L.act('water.height', { line, cm }); draw(true);
  }, { bigStep: 5 });
  const press = stepper('Pressure', 'cm', (d) => {
    const [lo, hi] = EQUIP.pressureCm;
    const cm = Math.max(lo, Math.min(hi, Math.round(farm.water.lines[line].pressureCm + d)));
    L.act('water.pressure', { line, cm }); draw(true);
  });
  const flow = readout('Flow test');
  const testBtn = button({ class: 'btn btn--machine btn--go' }, h('span', { html: ICONS.timer, 'aria-hidden': 'true' }), 'Flow test: a cup under a nipple for one minute');
  const cup = h('div', { class: 'cup', 'aria-hidden': 'true' }, h('span', { class: 'cup-water' }));
  const bar = h('div', { class: 'job-progress' }, h('span', { class: 'job-bar' }));
  let test = null; // { start, until }
  testBtn.addEventListener('click', () => {
    if (test) return;
    shell.foldPlates(); // a flow test takes one farm minute: the clock has to run
    test = { start: env.day, until: env.day + GAME_MIN };
    flow.set('…', 'water running into the cup');
  });
  shell.main.append(
    h('div', { class: 'drinker-grid' }, side,
      h('div', { class: 'ctrl-rows' },
        machineRow('Winch', 'Nipple tip above the litter · Shift: 5 cm a press', ...winch.els).el,
        machineRow('Pressure', 'Water column in the sight tube', ...press.els).el,
        h('div', { class: 'flowtest' }, cup, h('div', null, flow.el, bar)), testBtn)),
    heightText);

  function viewSvg() {
    const l = farm.water.lines[line];
    const age = flockAgeAt(env.day), scale = 4.2, base = 150;
    const y = (cm) => base - cm * scale;
    // the ruler covers the chick's 30 cm; a line winched higher is drawn at the top of the view
    // with its height written beside it, so it is always in the picture above the chick
    const TOP_CM = 28;
    const high = l.heightCm > TOP_CM;
    const tip = y(Math.min(l.heightCm, TOP_CM));
    const eye = y(eyeCm(age));
    const chickS = 0.9 + Math.max(0, age) * 0.08;
    const ruler = [];
    for (let cm = 0; cm <= 30; cm += 2) ruler.push(`<path d="M14 ${y(cm)}h${cm % 10 ? 6 : 12}" stroke="var(--key-sub)" stroke-width="${cm % 10 ? 1 : 1.6}"/>${cm % 10 ? '' : `<text x="30" y="${y(cm) + 4}" font-size="11" fill="var(--key-sub)" font-family="var(--font-display)">${cm}</text>`}`);
    const col = Math.max(0, Math.min(40, l.pressureCm));
    return `<svg viewBox="0 0 220 168" width="220" height="168">
      <rect x="2" y="2" width="216" height="164" rx="6" fill="var(--plate-edge)"/>
      <path d="M8 ${base}h204" stroke="var(--sign-yellow)" stroke-width="3"/>
      ${ruler.join('')}
      <path d="M60 ${tip - 22}h150" stroke="var(--drinker, #dedede)" stroke-width="7" stroke-linecap="round"/>
      <path d="M118 ${tip - 22}v18" stroke="var(--drinker, #dedede)" stroke-width="3"/>
      <circle cx="118" cy="${tip}" r="4.5" fill="var(--hen-comb)"/>
      <path d="M50 ${tip}h136" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3"/>
      ${high ? `<text x="126" y="${tip + 17}" font-size="11" font-weight="700" fill="var(--accent)" font-family="var(--font-display)">▲ line at ${fmt0(l.heightCm)} cm</text>` : ''}
      <g transform="translate(96 ${eye}) scale(${chickS.toFixed(2)})">${(() => {
        const by = Math.max(10, (base - eye) / chickS - 13); // body centre: the feet stand on the litter
        return `<path d="M-6 3L-16 ${by - 6}L6 ${by - 9}L6 3z" fill="var(--chick)"/>
        <ellipse cx="-8" cy="${by}" rx="17" ry="11" fill="var(--chick)"/>
        <path d="M-24 ${by - 3}l-6 -3 2 6z" fill="var(--chick)"/>
        <path d="M-12 ${by + 10}v3M-3 ${by + 10}v3" stroke="var(--hen-beak)" stroke-width="2.4" stroke-linecap="round"/>`;
      })()}
        <circle cx="0" cy="0" r="8" fill="var(--chick)"/><path d="M7 -2l7 2-7 2z" fill="var(--hen-beak)"/><circle cx="2.5" cy="-1.5" r="1.5" fill="var(--plate-edge)"/>
      </g>
      <text x="64" y="${eye + 4}" font-size="10" fill="var(--chick)" font-family="var(--font-display)">eye</text>
      <rect x="194" y="22" width="12" height="100" rx="5" fill="none" stroke="var(--key-sub)" stroke-width="1.5"/>
      <rect x="196.5" y="${120 - col * 2.4}" width="7" height="${col * 2.4}" rx="3" fill="var(--led-pad)"/>
      <text x="214" y="138" text-anchor="end" font-size="9" fill="var(--key-sub)" font-family="var(--font-display)">sight tube</text>
    </svg>`;
  }
  let key = '';
  function draw(force) {
    const l = farm.water.lines[line];
    const k = `${l.heightCm}|${l.pressureCm}|${(flockAgeAt(env.day)).toFixed(1)}`;
    if (force || k !== key) { key = k; side.innerHTML = viewSvg(); }
    winch.set(fmt0(l.heightCm), 'cm');
    press.set(fmt0(l.pressureCm), 'cm');
    setText(heightText, `Nipple tip ${fmt0(l.heightCm)} cm above the litter · water column ${fmt0(l.pressureCm)} cm`);
  }
  let acc = 0;
  return {
    el: shell.el,
    onClose() { if (test) { test = null; flow.set('—', 'test stopped'); } },
    update(dt, force) {
      if (test) {
        const t = Math.min(1, (env.day - test.start) / GAME_MIN);
        bar.firstChild.style.transform = `scaleX(${t.toFixed(3)})`;
        cup.firstChild.style.transform = `scaleY(${t.toFixed(3)})`;
        if (env.day >= test.until - 1e-9) {
          test = null;
          const r = L.act('water.flowtest', { line });
          flow.set(`${one(r?.mlMin)} ml`, `in one minute, ${env.timeLabel}`);
        }
      }
      acc -= dt;
      if (force || acc <= 0) { acc = 0.25; draw(force); }
    },
  };
}

/** Water supply, south-west corner: meter, main filter, flush valves. */
export function buildWaterSupplyPanel(L) {
  const { farm, env, skills } = L;
  const shell = equipShell({ cls: 'equip--supply', icon: ICONS.valve, title: 'Water supply', sub: 'Meter · main filter · flush valves for the four lines', plates: ['water-supply'], signLinks: ['sign-water'], onClose: L.close });
  // meter
  const dial = h('div', { class: 'odometer', 'aria-hidden': 'true' });
  const meter = readout('Meter');
  const readMeter = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the meter');
  readMeter.addEventListener('click', () => {
    const r = L.act('water.meter', {}) || {};
    meter.set(`${int(r.litres)} L`, [r.litres24h != null && `${int(r.litres24h)} L in 24 h`, r.per1000 != null && `${one(r.per1000)} L per 1,000 birds`, r.changePct != null && `${signedPct(r.changePct)} on the day before`].filter(Boolean).join(' · ') || `read ${env.timeLabel}`);
  });
  // filter
  const gauges = h('div', { class: 'gauges2', 'aria-hidden': 'true' });
  const filt = readout('Filter gauges');
  const readFilter = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the gauges');
  let shownBar = null;
  readFilter.addEventListener('click', () => { const r = L.act('water.filter', {}) || {}; shownBar = r; filt.set(`in ${one(r.inBar)} · out ${one(r.outBar)} bar`, `read ${env.timeLabel}`); drawGauges(); });
  const clean = button({ class: 'btn btn--machine' }, 'Clean the filter');
  const cleanBar = h('div', { class: 'job-progress', hidden: true }, h('span', { class: 'job-bar' }));
  let cleaning = null;
  clean.addEventListener('click', () => { if (cleaning) return; shell.foldPlates(); cleaning = { start: env.day }; cleanBar.hidden = false; setText(clean, 'Cleaning the filter…'); });
  // flush valves
  const valves = DRINKER_LINES_Z.map((z, i) => {
    const tube = h('span', { class: 'tube', 'aria-hidden': 'true' }, h('span', { class: 'tube-water' }));
    const t = toggleKey('Close flush valve', 'Open flush valve', () => {
      const on = !farm.water.lines[i].flushing;
      if (on) shell.foldPlates();
      L.act('water.flush', { line: i, on }); refresh();
    });
    const row = machineRow(`Line ${i + 1}`, h('small', null, tube, h('span', { class: 'tube-text' })), t.el);
    return { row, t, tube };
  });
  const overview = h('div', { class: 'overview' });
  // Phase 2's content is the Lines tab; from day 8 the Phase 3 tabs sit above it (the brooding week has none)
  const linesSec = h('div', { role: 'tabpanel' },
    h('div', { class: 'supply-top' },
      h('div', { class: 'supply-box' }, h('p', { class: 'supply-k' }, 'Water meter'), dial, meter.el, readMeter),
      h('div', { class: 'supply-box' }, h('p', { class: 'supply-k' }, 'Main filter'), gauges, filt.el, h('div', { class: 'equip-btns' }, readFilter, clean), cleanBar)),
    h('p', { class: 'supply-k supply-k--rows' }, 'Flush valves · sight tube at the east end of each line'),
    h('div', { class: 'ctrl-rows supply-valves' }, valves.map((v) => v.row.el)), overview);
  const cyc = cycleWaterParts(L, { linesSec, foldPlates: () => shell.foldPlates() });
  shell.main.append(cyc.bar, linesSec, ...cyc.secs);

  function drawGauges() {
    const g = (label, bar) => {
      const a = bar == null ? -120 : -120 + (Math.max(0, Math.min(4, bar)) / 4) * 240;
      return `<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="28" fill="var(--case-hi)" stroke="var(--plate-edge)" stroke-width="3"/>
        ${[0, 1, 2, 3, 4].map((b) => { const r = ((-120 + b * 60 - 90) * Math.PI) / 180; return `<text x="${32 + Math.cos(r) * 19 - 3}" y="${32 + Math.sin(r) * 19 + 3}" font-size="8" fill="var(--case-ink)">${b}</text>`; }).join('')}
        <path d="M32 32L32 9" stroke="var(--hen-comb)" stroke-width="2.4" stroke-linecap="round" transform="rotate(${a} 32 32)"/><circle cx="32" cy="32" r="3" fill="var(--case-ink)"/>
        <text x="32" y="50" font-size="8" text-anchor="middle" fill="var(--case-ink)" font-family="var(--font-display)">${label}</text></svg>`;
    };
    gauges.innerHTML = g('IN', shownBar?.inBar) + g('OUT', shownBar?.outBar);
  }
  function drawDial() {
    const s = String(Math.max(0, Math.round(farm.water.meterL))).padStart(6, '0');
    if (dial.__s === s) return;
    dial.__s = s;
    dial.innerHTML = [...s].map((c) => `<span>${c}</span>`).join('') + '<small>L</small>';
  }
  function refresh() {
    drawDial();
    valves.forEach((v, i) => {
      const l = farm.water.lines[i], clear = Math.max(0, Math.min(1, l.flushClear));
      v.t.set(!!l.flushing);
      v.row.setState(`Flush valve: ${l.flushing ? 'open, water running through the line' : 'closed'}`);
      v.row.led.classList.add('led--pad');
      v.row.led.classList.toggle('is-on', !!l.flushing);
      v.tube.style.setProperty('--clear', clear.toFixed(2));
      v.tube.classList.toggle('is-running', !!l.flushing);
      setText(v.row.small.lastChild, l.flushing ? 'flushing: water running' : clear > 0.98 ? 'clear water in the tube' : clear > 0.02 ? 'cloudy water in the tube' : 'brown water in the tube');
    });
    const on = skills?.unlocked?.('lineOverview');
    overview.hidden = !on;
    if (on) {
      const last = L.lastFlows();
      overview.innerHTML = `<p class="supply-k">All lines</p><table class="mini-table"><thead><tr><th>Line</th><th>Nipples</th><th>Water column</th><th>Last flow test</th></tr></thead><tbody>${
        farm.water.lines.map((l, i) => `<tr><th>${i + 1}</th><td>${fmt0(l.heightCm)} cm</td><td>${fmt0(l.pressureCm)} cm</td><td>${last[i] ? `${one(last[i].mlMin)} ml/min · ${hhmm(last[i].hour)}` : '—'}</td></tr>`).join('')}</tbody></table>`;
    }
  }
  let acc = 0;
  drawGauges();
  return {
    el: shell.el,
    onOpen() { shell.refreshPlates(); cyc.onOpen(); },
    onClose() { if (cleaning) { cleaning = null; cleanBar.hidden = true; setText(clean, 'Clean the filter'); } },
    update(dt, force) {
      if (cleaning) {
        const t = Math.min(1, (env.day - cleaning.start) / (5 * GAME_MIN));
        cleanBar.firstChild.style.transform = `scaleX(${t.toFixed(3)})`;
        if (t >= 1) {
          cleaning = null; cleanBar.hidden = true; setText(clean, 'Clean the filter');
          L.act('water.clearFilter', {});
          filt.set('—', `filter cleaned ${env.timeLabel}`); shownBar = null; drawGauges();
        }
      }
      acc -= dt;
      if (force || acc <= 0) { acc = 0.25; refresh(); cyc.update(); }
    },
  };
}
