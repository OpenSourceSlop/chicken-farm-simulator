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
// Skills update (SKILLS.md §3.2–§3.4, §3.7, §4.2, §6.5): controllerSkills below
import { AUTO, AUTO_SYSTEMS, SKILL_SHORT, SKILL_STEP_NAMES, lightPresetForDay } from './config.js';
import { ventNeed, onSecFor, brooderRowC } from './job-figures.js';
import { preheatHours } from './heat-diag.js';
import { fanAdviceFor } from './ui-cycle-fans.js';
import { hhmm, one } from './ui-format.js';
import { skillBox, workLine, oneKey, row as skRow, note as skNote, perkHas, perkAuto, autoStatus, openFault, holdText, faultText, atText, sinceRead, glanceFor, STATE_WORDS, ensureSkillsStyle } from './ui-cycle-skills.js';

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
  const flaps = toggleKey('Open the storm flaps', 'Close the storm flaps', () => { L.act('inlets.storm', { closed: !flapsShut() }); sync(); refresh(); }, 'Storm flaps · closed');
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

// ---------------- Skills update: the one-press keys and their working (SKILLS.md §6.5) ----------------
// Each key's line is built from the same function the press uses (ventNeed, brooderRowC, lightPresetForDay, adviseFans,
// preheatHours), so the figure on the line is the figure sent.
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Moisture 2 (ventFill): the timer at AUTO.ventShare (110 %) of the vent sign's need for the flock the farmer knows; 1 fan
 *  while it fits in 300 s, else 2 fans. -> { t, v, pct, text } */
export function fillTimerFor(env, farm) {
  const v = ventNeed(env, farm, null), inlet = Math.max(0.1, env.inletShare ?? 1), air = (v.need * AUTO.ventShare) / inlet;
  let fans = 1, onSec = onSecFor(air, 1, 300);
  if (onSec > 300) { fans = 2; onSec = onSecFor(air, 2, 300); }
  const t = { fans, onSec: Math.max(1, Math.min(300, onSec)), cycleSec: 300 };
  const pct = Math.round(ventNeed(env, farm, t).share * 100);
  const who = v.prep ? `tomorrow’s ${int(v.birds)} chicks × ${int(v.weightG)} g` : `${int(v.birds)} birds × ${int(v.weightG)} g`;
  return { t, v, pct, text: `${who} → vent sign ${int(v.need)} m³/h → ${plural(fans, 'fan')} ${t.onSec} s / ${t.cycleSec} s (${pct} %)` };
}
/** Heating 2 (brooderRow): the brooder sign's row of the day (the prep day: the chicks' day 0); a bad batch's warmer row
 *  (+1 °C) on days 0–3 while its job b-warm is open. -> { c, text } */
export function rowFor(env, farm, jobs = []) {
  const d = env.dayNumber, day = Math.max(0, d), row = brooderRowC(day);
  const warm = farm?.condition === 'badChicks' && d >= 0 && d <= 3 && jobs.some((i) => i.id === 'b-warm' && (i.status === 'open' || i.status === 'waiting'));
  const c = warm ? row + 1 : row;
  return { c, warm, text: `Brooder sign, day ${day}${d < 0 ? ' (the chicks tomorrow)' : ''}: ${one(row)} °C${warm ? ` + 1 °C for the small chicks of this batch = ${one(c)} °C` : ''}` };
}
const RANGE = { brooding: 'days −1–7', growing: 'days 8–35', finishing: 'days 36–41' };
/** Lighting 2 (weekLights): the light sign's program for the age. -> { id, p, key, text } */
export function weekProgramFor(day) {
  const id = lightPresetForDay(day), p = LIGHT_PRESETS[id];
  const end = (p.darkStart + p.darkHours) % 24;
  return { id, p, key: `Program for ${RANGE[id]}`, text: `Light sign, ${RANGE[id]}: dark ${hhmm(p.darkStart)}–${hhmm(end)} (${one(p.darkHours)} h), dimmer ${Math.round(p.dimmer * 100)} %` };
}
/**
 * The controller's payoff parts (ui-climate.js mounts them): { top, temp, fill, fans, lights, onOpen(), onRead(), update(dt) }.
 *   top     the controllers since the last read and each handed-over system's state (Moisture 3, Heating 3, Lighting 3,
 *           Ventilation 3)
 *   temp    Set to the sign's row and the pre-heat line (Heating 2); the sensor beside the thermometer and Check the
 *           sensor against the thermometer (Heating 3, auto.calibrate)
 *   fill    Fill the timer (Moisture 2: vent.timer { …, by: 'calc' }), put at the top of the timer box
 *   fans    the fan suggestion and Set as suggested (Ventilation 2: vent.fans / vent.pad { by: 'advice' })
 *   lights  Program for days N–M (Lighting 2: light.program { …, by: 'week' })
 */
/** A controller's text without its own leading label ("Timer: 1 fan …" → "1 fan …"; "Controller: timer stepped …"). */
export const unlabel = (t) => String(t || '').replace(/^(Winches|Timer|Controller|Fan stages|Brooders|Feed|Feeder lines|Lights|Bird scale): /, '');
export function controllerSkills(L, { draft, lp, refresh, waits }) {
  const { env, farm } = L;
  ensureSkillsStyle();
  const glance = glanceFor(L, 'controller');
  const said = { row: '', fill: '', fans: '', lights: '', sensor: '' };
  // ---- Heating 2 / 3 ----
  const rowWork = workLine(), preheat = workLine();
  const rowKey = oneKey('Set to the sign’s row', () => {
    const r = rowFor(env, farm, L.jobs());
    // while the sensor drifts the brooders hold the sensor at the figure: env.heaterSetpoint is his figure less the drift,
    // as the ± keys step it (the model adds the drift back for a bus step), so the thermostat shows the row
    const drift = farm.auto?.drift || 0;
    env.setHeaterSetpoint(r.c - drift);
    L.uiAct('heat.setpoint', { value: env.heaterSetpoint, c: env.heaterSetpoint, by: 'row' });
    said.row = `Thermostat set to ${one(r.c)} °C at ${env.timeLabel}`;
    waits(); refresh();
  });
  const row2 = skillBox('brooderRow', 'Brooder thermostat to the sign', skRow(rowKey, rowWork.el), preheat.el);
  const sensorWork = workLine(), sensorNote = skNote();
  const calKey = oneKey('Check the sensor against the thermometer', () => {
    const r = L.act('auto.calibrate', {}) || {};
    said.sensor = `Checked at ${env.timeLabel}: the sensor read ${one(r.sensorC)} °C, the thermometer ${one(r.houseC)} °C${Math.abs(r.offsetC || 0) >= 0.05 ? `; the sensor is set to the thermometer (${one(Math.abs(r.offsetC))} °C)` : ''}.`;
    refresh();
  });
  const sensor = skillBox('autoBrooders', 'Controller sensor and the thermometer beside it', skRow(sensorWork.el, calKey), sensorNote);
  // ---- Moisture 2 ----
  const fillWork = workLine();
  const fillKey = oneKey('Fill the timer', () => {
    const f = fillTimerFor(env, farm);
    Object.assign(draft, f.t);
    L.act('vent.timer', { ...f.t, by: 'calc' });
    said.fill = `Sent at ${env.timeLabel}: ${f.text}`;
    waits(); refresh();
  });
  const fill = skillBox('ventFill', 'Minimum ventilation calculator', skRow(fillKey, fillWork.el));
  // ---- Ventilation 2 ----
  const fanWork = workLine();
  const fanKey = oneKey('Set as suggested', () => {
    const a = fanAdviceFor(env, farm);
    env.setFans(a.fans); L.uiAct('vent.fans', { n: env.fansManual ?? env.fansOn, by: 'advice' });
    env.setPad(a.pad); L.uiAct('vent.pad', { on: env.padOn, by: 'advice' });
    said.fans = `Set at ${env.timeLabel}: ${a.tail}`;
    waits(); refresh();
  }, { label: 'Set the tunnel fans and the pad as suggested' });
  const fans = skillBox('fanAdvice', 'Fans and pad for now', skRow(fanKey, fanWork.el));
  // ---- Lighting 2 ----
  const lightWork = workLine();
  const lightKey = oneKey('Program for days 8–35', () => {
    const w = weekProgramFor(env.dayNumber);
    Object.assign(lp, { darkStart: w.p.darkStart, darkHours: w.p.darkHours, dimmer: w.p.dimmer });
    L.act('light.program', { darkStart: lp.darkStart, darkHours: lp.darkHours, dimmer: lp.dimmer, ...(lp.rampMin != null ? { rampMin: lp.rampMin } : {}), by: 'week' });
    said.lights = `Sent at ${env.timeLabel}: ${w.text}`;
    refresh();
  });
  const lights = skillBox('weekLights', 'Light program for the flock’s age', skRow(lightKey, lightWork.el));
  // ---- the controllers since the last read (level 3) ----
  const SYS = Object.keys(AUTO_SYSTEMS).filter((s) => AUTO_SYSTEMS[s].glanceAt.includes('controller'));
  const sysList = h('div', { class: 'skl-rows' }), sinceEl = skNote();
  const top = skillBox('autoTimer', 'The controllers', sysList, sinceEl);
  let lastReadAt = null, since = null, acc = 0, preAt = -Infinity, preCache = null;

  function sysWords(s) {
    const st = autoStatus(L, s), f = st.faults[0];
    if (f) return { state: 'fault', text: faultText(L, f) };
    const held = holdText(L, s) || (s === 'stages' ? holdText(L, 'stagesTable') : '');
    return { state: held ? 'held' : st.state, text: held || st.text || STATE_WORDS[st.state] || st.state };
  }
  function sync() {
    const lvl = farm.mode === 'level';
    // Heating 2
    if (row2.show(lvl && perkHas(L, 'brooderRow'))) {
      const r = rowFor(env, farm, L.jobs());
      rowWork.set(r.text, said.row);
      let p = null;
      if (env.day - preAt > 10 / 1440 || env.day < preAt) { preAt = env.day; try { preCache = preheatHours(env, farm); } catch { preCache = null; } } p = preCache;   // the heat balance: once per 10 farm minutes
      preheat.set(p && Number.isFinite(p.hours) ? `Pre-heat: about ${Math.round(p.hours)} hours to bring the floor to ${one(p.targetC)} °C with the brooders at full in this weather${Number.isFinite(p.startBy) ? ` — start by ${atText(env, p.startBy)}` : ''}` : '', p?.why || '');
    }
    // Heating 3: the sensor and the thermometer
    const drift = openFault(L, 'sensor-drift');
    if (sensor.show(lvl && (perkAuto(L, 'brooders') || !!drift))) {
      let s = env.houseTemp;
      try { s = farm.autoCtl?.sensorC?.() ?? env.houseTemp; } catch { s = env.houseTemp; }
      sensorWork.set(`Sensor ${one(s)} °C · thermometer ${one(env.houseTemp)} °C`, said.sensor || 'The brooders hold the sensor at the brooder sign’s row.');
      setText(sensorNote, drift ? faultText(L, drift) : holdText(L, 'brooders'));
      sensorNote.hidden = !sensorNote.textContent;
      sensorNote.classList.toggle('skl-note--fault', !!drift);
    }
    // Moisture 2
    if (fill.show(lvl && perkHas(L, 'ventFill'))) {
      const f = fillTimerFor(env, farm);
      fillWork.set(f.text, said.fill || 'The vent sign’s table for your count and the bird scale’s weight, at about 110 %.');
    }
    // Ventilation 2
    if (fans.show(lvl && perkHas(L, 'fanAdvice'))) { const a = fanAdviceFor(env, farm); fanWork.set(a.text, said.fans); }
    // Lighting 2
    if (lights.show(lvl && perkHas(L, 'weekLights'))) {
      const w = weekProgramFor(env.dayNumber);
      if (lightKey.textContent !== w.key) { setText(lightKey, w.key); lightKey.setAttribute('aria-label', w.key); lightKey.title = w.key; }
      lightWork.set(w.text, said.lights);
    }
    // level 3: the controllers' states and what they did since the last read
    const on = SYS.filter((s) => perkAuto(L, s) || autoStatus(L, s).faults.length);
    if (top.show(lvl && on.length > 0)) {
      setText(top.tag, `${on.map((s) => `${SKILL_SHORT[AUTO_SYSTEMS[s].branch]} 3`).join(' · ')} · ${SKILL_STEP_NAMES[2]}`);
      const k = on.map((s) => { const w = sysWords(s); return `${s}|${w.state}|${w.text}`; }).join('\n');
      if (sysList.__k !== k) {
        sysList.__k = k;
        // (review round: the model's texts start with their own label, "Timer: …": the bold label once)
        sysList.replaceChildren(...on.map((s) => { const w = sysWords(s); return h('p', { class: `skl-note${w.state === 'fault' ? ' skl-note--fault' : ''}` }, h('b', null, `${AUTO_SYSTEMS[s].label}: `), unlabel(w.text)); }));
      }
      const lines = sinceRead(L, on, since);
      setText(sinceEl, lines.length ? `Since ${since == null ? 'the level began' : `your read at ${atText(env, since)}`}: ${lines.map((x) => `${x.label}: ${unlabel(x.text)}${x.at != null ? ` (${atText(env, x.at)})` : ''}`).join(' · ')}` : since == null ? '' : `No change since your read at ${atText(env, since)}.`);
      sinceEl.hidden = !sinceEl.textContent;
    }
  }
  return {
    top: top.el, temp: [row2.el, sensor.el], fill: fill.el, fans: fans.el, lights: lights.el,
    onOpen() { glance.onOpen(); since = lastReadAt; preAt = -Infinity; for (const k of Object.keys(said)) said[k] = ''; sync(); },
    /** the controller was read (open 2 s): the next opening shows what the controllers did after now */
    onRead() { lastReadAt = env.day; },
    update(dt, force) { glance.update(dt); acc -= dt || 0; if (force || acc <= 0) { acc = 0.25; sync(); } },
  };
}
