// Phase 3 parts of the level climate controller (ui-climate.js builds the panel; PHASE3.md §14.3). Package
// "panels". Nothing here shows in the brooding week: the brooder row comes from day 8, the rest with its
// unlock (none of them can be earned in Phase 2's lone week).
//   Temperature  Brooders off and winched up (heat.brooders { up: true }, a second press confirms; day 8 on)
//                heatLoss: the house air's heat terms, °C per hour (env.heatBudget)
//   Ventilation  minVentCalc: fresh air for the birds and their weight (the vent sign's table) -> timer seconds
//                humidityChart: 24 hours of house and outside humidity
//                the rainy season (Phase 4): the storm flaps on the south inlets (inlets.storm { closed }), a lit switch
//   Lights       lightPresets: config LIGHT_PRESETS (light.preset, then light.program)
//                dimming: dawn and dusk dimming minutes, sent as light.program { rampMin }
import { EQUIP, LIGHT_PRESETS, minVentM3hPer1000, FAN_COUNT } from './config.js';
import { h, button, setText, uniqueId, fmt1 } from './ui-dom.js';
import { machineRow, stepper, toggleKey } from './ui-equipment.js';
import { int } from './ui-format.js';
import { heatBudgetOf, lineChart, historyOf, knownBirds } from './ui-cycle-kit.js';
import { clock } from './clock.js';

const FROM_DAY = 8;
const signed = (v) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${fmt1(Math.abs(v))}`;

export function cycleControllerParts(L, { draft, lp, refresh }) {
  const { env, farm, skills, records } = L;
  const levelDay = () => farm.mode === 'level' && env.dayNumber >= FROM_DAY;
  // ---------- Temperature: brooders up, heat loss ----------
  const upBtn = button({ class: 'key key--wide' }, 'Off and up');
  let confirmAt = 0;
  upBtn.addEventListener('click', () => {
    const now = clock.now();
    if (now - confirmAt > 3000) { confirmAt = now; setText(upBtn, 'Press again'); return; }
    confirmAt = 0;
    L.act('heat.brooders', { up: true });
    sync(); refresh();
  });
  const brooders = machineRow('Brooders', 'off for good and winched up out of the way', upBtn);
  brooders.led.classList.add('led--heat');
  const heat = h('div', { class: 'cyc-box', hidden: true });
  // ---------- Ventilation: the minimum ventilation calculator, the humidity chart ----------
  const birdsId = uniqueId('mv'), wId = uniqueId('mv');
  const birdsIn = h('input', { type: 'number', id: birdsId, min: 0, max: 9000, step: 10, class: 'cyc-num' });
  const weightIn = h('input', { type: 'number', id: wId, min: 30, max: 3500, step: 10, class: 'cyc-num' });
  const calcOut = h('p', { class: 'cyc-line' });
  const toTimer = button({ class: 'key key--wide' }, 'Into the timer');
  let calcSec = null;
  toTimer.addEventListener('click', () => { if (calcSec == null) return; draft.onSec = Math.max(0, Math.min(draft.cycleSec, Math.round(calcSec))); refresh(); });
  for (const i of [birdsIn, weightIn]) i.addEventListener('input', () => calc());
  const calcBox = h('div', { class: 'ctrl-timer', hidden: true },
    h('p', { class: 'ctrl-timer-k' }, 'Minimum ventilation calculator', h('small', null, ' · the table on the minimum ventilation sign')),
    h('div', { class: 'cyc-row2' }, h('label', { class: 'cyc-check', for: birdsId }, 'Birds ', birdsIn), h('label', { class: 'cyc-check', for: wId }, 'Weight, g ', weightIn)),
    h('div', { class: 'ctrl-apply' }, calcOut, toTimer));
  const rhChart = h('div', { class: 'cyc-chart', hidden: true });
  // Phase 4, the rainy season (PHASE4.md §4.2): the storm flaps on the south side-wall inlets (inlets.storm { closed }),
  // a lit switch; while it storms with them open the rain drives in along the south wall
  const flapsShut = () => !!farm.house?.flapsClosed;
  const flaps = toggleKey('Open the storm flaps', 'Close the storm flaps', () => { L.act('inlets.storm', { closed: !flapsShut() }); sync(); refresh(); });
  const flapRow = machineRow('Storm flaps on the south inlets', '', flaps.el);
  flapRow.led.classList.add('led--pad');
  flapRow.el.hidden = true;
  // ---------- Lights: presets and dimming ----------
  const presetBtns = Object.entries(LIGHT_PRESETS).map(([id, p]) => {
    const b = button({ class: 'key key--wide' }, p.label);
    b.addEventListener('click', () => {
      Object.assign(lp, { darkStart: p.darkStart, darkHours: p.darkHours, dimmer: p.dimmer });
      L.uiAct('light.preset', { preset: id }); // the payload's id is the action id: the preset key travels as `preset`
      L.act('light.program', { ...lp });
      refresh();
    });
    return b;
  });
  const presets = h('div', { class: 'ctrl-timer cyc-presets', hidden: true }, h('p', { class: 'ctrl-timer-k' }, 'Light programs'), h('div', { class: 'ctrl-apply' }, presetBtns));
  // lp.rampMin is set only once dimming is unlocked, so Phase 2's light.program carries exactly its fields
  const dim = stepper('Dawn and dusk dimming', 'min', (d) => { lp.rampMin = Math.max(0, Math.min(60, (lp.rampMin || 0) + d * 15)); refresh(); });
  const dimRow = machineRow('Dawn and dusk', 'the lights fade in and out', ...dim.els);
  dimRow.el.hidden = true;

  function calc() {
    const n = parseFloat(birdsIn.value), w = parseFloat(weightIn.value);
    if (!(n > 0) || !(w > 0)) { calcSec = null; setText(calcOut, 'Birds and their weight give the fresh air.'); toTimer.disabled = true; return; }
    const need = (n / 1000) * minVentM3hPer1000(w);
    const fans = Math.max(1, Math.min(FAN_COUNT, draft.fans || 1));
    calcSec = (need / (fans * EQUIP.fanM3h)) * draft.cycleSec;
    setText(calcOut, `≈ ${int(need)} m³/h · ${fans} timer fan${fans === 1 ? '' : 's'}: ${Math.round(calcSec)} s on in every ${draft.cycleSec} s`);
    toTimer.disabled = false;
  }
  function drawHeat() {
    const on = !!skills?.unlocked?.('heatLoss') && farm.mode === 'level';
    heat.hidden = !on;
    if (!on) return;
    const b = heatBudgetOf(env);
    const terms = [['Brooders', b.brooderCh], ['Birds', b.birdsCh], ['Sun on the roof', b.sunCh], ['Walls', b.wallsCh], ['Fresh air', b.airCh], ['Floor', b.slabCh]].filter(([, v]) => Number.isFinite(v));
    const max = Math.max(2, ...terms.map(([, v]) => Math.abs(v)));
    const net = terms.reduce((a, [, v]) => a + v, 0);
    heat.replaceChildren(h('p', { class: 'cyc-k' }, 'Heat into and out of the house air', h('small', null, ' · °C per hour')),
      h('div', { class: 'cyc-bars', style: 'margin-top: 6px' }, terms.flatMap(([k, v]) => {
        const w = (Math.abs(v) / max) * 50, bar = h('span', { class: v >= 0 ? 'in' : '' });
        bar.style.left = `${v >= 0 ? 50 : 50 - w}%`; bar.style.width = `${w}%`;
        return [h('span', null, k), h('span', { class: 'bar' }, bar), h('span', { class: 'v' }, signed(v))];
      })),
      h('p', { class: 'cyc-line cyc-dim', style: 'margin-top: 4px' }, `All together ${signed(net)} °C per hour`));
  }
  function drawRh() {
    const on = !!skills?.unlocked?.('humidityChart') && farm.mode === 'level';
    rhChart.hidden = !on;
    if (!on) return;
    const c = lineChart({ rows: historyOf(env), series: [{ key: 'rh' }, { key: 'outRh', dash: '4 3', width: 1.3 }], lo: 20, hi: 100, H: 60 });
    rhChart.innerHTML = c ? `<p class="ctrl-chart-k">Last 24 hours · humidity in (solid) and outside (dashed) · 20–100 %</p>${c.svg}` : '<p class="ctrl-chart-k">24-hour humidity chart: collecting</p>';
  }
  function sync() {
    const show = levelDay();
    brooders.el.hidden = !show;
    const up = !!(env.broodersUp ?? farm.house?.broodersUp);
    upBtn.hidden = up;
    if (clock.now() - confirmAt > 3000) setText(upBtn, 'Off and up');
    setText(brooders.small, up ? 'off and winched up' : 'off for good and winched up out of the way');
    brooders.led.classList.toggle('is-on', !up && !!env.heatersOn);
    calcBox.hidden = !skills?.unlocked?.('minVentCalc') || farm.mode !== 'level';
    presets.hidden = !skills?.unlocked?.('lightPresets') || farm.mode !== 'level';
    dimRow.el.hidden = !skills?.unlocked?.('dimming') || farm.mode !== 'level';
    const rainy = farm.mode === 'level' && farm.condition === 'rainy', shut = flapsShut(), rain = (farm.weatherNow?.rain ?? 0) > 0;
    flapRow.el.hidden = !rainy;
    if (rainy) {
      flaps.set(shut); flapRow.led.classList.toggle('is-on', shut);
      flapRow.setState(`Storm flaps: ${shut ? 'closed over the south inlets' : 'open'}${rain ? ' · raining now' : ''}`);
      setText(flapRow.small, shut ? 'closed, they keep the driven rain out; the inlets let less air in while they are shut' : 'hinged plates over the south side-wall inlets: closed, they keep driven rain out of the house');
    }
    dim.set(String(lp.rampMin || 0));
  }
  let slow = 0;
  return {
    temp: [brooders.el, heat],
    vent: [flapRow.el, calcBox, rhChart],
    lights: [presets],
    lightsRows: [dimRow.el],
    onOpen() {
      // the calculator starts from the farmer's own numbers: birds by his counts, today's scale weight
      birdsIn.value = String(knownBirds(farm) || '');
      const w = records?.draft?.(env.dayNumber)?.weightG;
      weightIn.value = Number.isFinite(w) ? String(Math.round(w)) : '';
      if (skills?.unlocked?.('dimming')) lp.rampMin = env.lightProgram?.rampMin ?? lp.rampMin ?? 0;
      calc();
    },
    update(dt, force) {
      sync();
      slow -= dt;
      if (force || slow <= 0) { slow = 1; drawHeat(); drawRh(); if (!calcBox.hidden) calc(); }
    },
  };
}
