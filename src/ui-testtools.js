// Phase 1 test tools: change flock age, weather and time, hold the house temperature, and read the
// target temperature and flock metrics. Clearly marked as not part of the game. Owner: systems/UI agent.
import { WEATHER } from './config.js';
import { h, button, setText, uniqueId, fmt1 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

const pct = (v) => `${Math.round((v || 0) * 100)} %`;

function range(id, min, max, step) {
  return h('input', { type: 'range', id, min, max, step });
}

// perf (optional): { fps, pixelRatio, shadowMap } kept up to date by main.js
export function createTestTools(env, { flock, onReset, perf }) {
  const regionId = uniqueId('tools');
  const toggle = button({ class: 'btn tools-toggle', 'aria-expanded': 'false', 'aria-controls': regionId });
  toggle.innerHTML = `${ICONS.sliders}<span>Test tools – Phase 1 only</span><span class="chev">${ICONS.chevron}</span>`;

  // flock age
  const ageId = uniqueId('t-age');
  const age = range(ageId, 1, 42, 1); // day 1 = the chicks' arrival day
  const ageOut = h('output', { for: ageId });
  age.addEventListener('input', () => env.setDay(Number(age.value)));

  // weather
  const wId = uniqueId('t-weather');
  const weather = h('select', { id: wId }, Object.entries(WEATHER).map(([k, w]) => h('option', { value: k }, w.label)));
  weather.addEventListener('change', () => env.setWeather(weather.value));

  // time of day
  const hourId = uniqueId('t-hour');
  const hour = range(hourId, 0, 23.75, 0.25);
  const hourOut = h('output', { for: hourId });
  hour.addEventListener('input', () => env.setHour(Number(hour.value)));

  // hold house temperature
  const holdId = uniqueId('t-hold');
  const holdTempId = uniqueId('t-hold-temp');
  const hold = h('input', { type: 'checkbox', id: holdId });
  const holdTemp = range(holdTempId, 15, 40, 0.5);
  holdTemp.setAttribute('aria-label', 'Held house temperature');
  const holdOut = h('output', { for: holdTempId });
  hold.addEventListener('change', () => {
    if (hold.checked) { holdTemp.value = String(Math.round(env.houseTemp * 2) / 2); env.forceHouseTemp(Number(holdTemp.value)); }
    else env.forceHouseTemp(null);
    sync(true);
  });
  holdTemp.addEventListener('input', () => { if (hold.checked) env.forceHouseTemp(Number(holdTemp.value)); sync(true); });

  // readouts
  const rd = {
    target: h('dd', { class: 'rd-target' }), huddle: h('dd'), comfy: h('dd'), pant: h('dd'), spread: h('dd'), perf: h('dd'),
  };
  const targetLabel = h('dt', { class: 'rd-wide' });
  const readouts = h('dl', { class: 'readouts' },
    targetLabel, rd.target,
    h('dt', null, 'Huddling'), rd.huddle,
    h('dt', null, 'Comfortable'), rd.comfy,
    h('dt', null, 'Panting'), rd.pant,
    h('dt', { title: '0 = all in one clump, 1 = evenly spread over the floor' }, 'Spread index'), rd.spread,
    h('dt', { title: 'Frames per second, and the pixel ratio the game renders at (it lowers it on a slow graphics card)' }, 'Frame rate'), rd.perf);

  const status = h('span', { class: 'tools-status', role: 'status' });
  const resetBtn = button({ class: 'btn' }, 'Reset farm');
  let statusTimer = 0;
  resetBtn.addEventListener('click', () => {
    onReset();
    status.textContent = 'Farm reset to day 1, 08:00.';
    statusTimer = 4;
    sync(true);
  });

  const field = (labelEl, out, ...input) => h('div', { class: 'field' }, labelEl, out, input);
  const panel = h('section', { class: 'card tools', id: regionId, hidden: true, 'aria-label': 'Test tools, Phase 1 only' },
    h('p', { class: 'tools-note' }, 'For testing the look and the controls in Phase 1. Not part of the game.'),
    field(h('label', { for: ageId }, 'Flock age'), ageOut, age),
    field(h('label', { for: wId }, 'Weather'), weather),
    field(h('label', { for: hourId }, 'Time of day'), hourOut, hour),
    field(h('label', { for: holdId }, hold, 'Hold house temperature'), holdOut, holdTemp),
    h('p', { class: 'label tools-sub' }, 'Readouts'),
    readouts,
    h('div', { class: 'tools-foot' }, resetBtn, status));

  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) sync(true);
  });

  // Keep the inputs in step with the farm (the clock moves on), but never fight the user's hand.
  const busy = (el) => document.activeElement === el && el.matches(':active, :focus-visible');
  let metricsAcc = 0;
  function sync(force) {
    if (force || !busy(age)) age.value = String(env.dayNumber);
    setText(ageOut, `Day ${env.dayNumber}`);
    if (force || !busy(weather)) weather.value = env.weather;
    if (force || !busy(hour)) hour.value = String(Math.floor(env.hour * 4) / 4);
    setText(hourOut, env.timeLabel);
    const held = env.forcedHouseTemp != null;
    hold.checked = held;
    holdTemp.disabled = !held;
    if (held && (force || !busy(holdTemp))) holdTemp.value = String(env.forcedHouseTemp);
    setText(holdOut, held ? `${fmt1(env.forcedHouseTemp)} °C` : 'off');
    setText(targetLabel, `Target temperature, day ${env.dayNumber}`);
    setText(rd.target, `${fmt1(env.targetTemp)} °C`);
  }
  function readMetrics() {
    const m = flock?.metrics?.() || {};
    setText(rd.huddle, pct(m.fracHuddling));
    setText(rd.comfy, pct(m.fracComfortable));
    setText(rd.pant, pct(m.fracPanting));
    setText(rd.spread, (m.spreadIndex ?? 0).toFixed(2));
    if (perf) setText(rd.perf, `${Math.round(perf.fps)} fps · ${perf.pixelRatio.toFixed(2).replace(/0$/, '')}×${perf.shadowMap < 2048 ? ' · low shadows' : ''}`);
  }

  return {
    toggle,
    panel,
    get open() { return !panel.hidden; },
    update(dt) {
      if (statusTimer > 0 && (statusTimer -= dt) <= 0) status.textContent = '';
      if (panel.hidden) return;
      sync(false);
      metricsAcc -= dt;
      if (metricsAcc <= 0) { metricsAcc = 0.5; readMetrics(); }
    },
  };
}
