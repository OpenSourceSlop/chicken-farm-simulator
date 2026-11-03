// Climate controller: a hardware box with a live LCD and membrane keys. No target is shown here;
// the farmer reads the target off the brooder sign. Owner: systems/UI agent.
import { FAN_COUNT } from './config.js';
import { h, button, setText, uniqueId, fmt1, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';

const STEP = 0.5;

function lcdCell(label, unitText) {
  const value = h('span', { class: 'lcd-v' });
  const unit = h('span', { class: 'lcd-u' }, unitText);
  const el = h('div', { class: 'lcd-cell' }, h('span', { class: 'lcd-k' }, label), h('span', { class: 'lcd-num' }, value, unit));
  return { el, value, unit };
}

// A membrane key. Press and hold repeats (after 400 ms, every 120 ms). The mouse press acts on
// pointerdown; the click that follows it is then ignored, so Enter / Space still work for keyboards.
function key(label, icon, onPress) {
  const b = button({ class: 'key', 'aria-label': label, title: label });
  b.innerHTML = icon;
  let wait = 0, rep = 0, fromPointer = false;
  const stop = () => { clearTimeout(wait); clearInterval(rep); wait = rep = 0; };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stop();
    fromPointer = true;
    onPress();
    wait = setTimeout(() => { rep = setInterval(onPress, 120); }, 400);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) b.addEventListener(ev, stop);
  b.addEventListener('click', () => {
    if (fromPointer) { fromPointer = false; return; }
    onPress();
  });
  return b;
}

export function buildControllerPanel(env, { onClose, onSetpoint }) {
  const titleId = uniqueId('ctrl-title');
  const { el, closeBtn } = dialogShell('ctrl', titleId, onClose);

  // ---- LCD: measured values, updated live ----
  const house = lcdCell('House', '°C');
  const outside = lcdCell('Outside', '°C');
  const rhIn = lcdCell('Humidity in', '%');
  const rhOut = lcdCell('Humidity out', '%');
  const air = lcdCell('Air speed', 'm/s');
  const feels = lcdCell('Feels like', '°C');
  const chill = h('span', { class: 'lcd-foot-chill' });
  const clock = h('span');
  const status = {
    heat: h('span', { class: 'lcd-flag' }, 'HEAT'),
    fans: h('span', { class: 'lcd-flag' }),
    pad: h('span', { class: 'lcd-flag' }, 'PAD'),
  };
  const lcd = h('div', { class: 'lcd', role: 'group', 'aria-label': 'Controller display' },
    h('div', { class: 'lcd-grid' }, house.el, outside.el, rhIn.el, rhOut.el, air.el, feels.el),
    h('div', { class: 'lcd-foot' }, status.heat, status.fans, status.pad, chill, h('span', { class: 'lcd-clock' }, clock)));

  // ---- keys ----
  const spValue = h('output', { class: 'lcd-mini', 'aria-live': 'polite' });
  const fanValue = h('output', { class: 'lcd-mini', 'aria-live': 'polite' });
  const heatLed = h('span', { class: 'led led--heat', 'aria-hidden': 'true' });
  const fanLed = h('span', { class: 'led led--run', 'aria-hidden': 'true' });
  const padLed = h('span', { class: 'led led--pad', 'aria-hidden': 'true' });
  const heatState = h('span', { class: 'ctrl-state' });
  const padBtn = button({ class: 'key key--wide', 'aria-pressed': 'false' });

  const setpoint = (d) => { env.setHeaterSetpoint(env.heaterSetpoint + d); onSetpoint?.(); refresh(); };
  const row = (led, title, sub, ...controls) => h('div', { class: 'ctrl-row' }, led,
    h('div', { class: 'ctrl-label' }, h('span', null, title), sub ? h('small', null, sub) : null), h('div', { class: 'ctrl-keys' }, controls));

  const keys = h('div', { class: 'ctrl-rows' },
    row(heatLed, 'Brooder thermostat', heatState,
      key('Lower the brooder thermostat by 0.5 °C', ICONS.minus, () => setpoint(-STEP)), spValue,
      key('Raise the brooder thermostat by 0.5 °C', ICONS.plus, () => setpoint(STEP))),
    row(fanLed, 'Tunnel fans', 'East end wall',
      key('One tunnel fan fewer', ICONS.minus, () => { env.setFans(env.fansOn - 1); refresh(); }), fanValue,
      key('One tunnel fan more', ICONS.plus, () => { env.setFans(env.fansOn + 1); refresh(); })),
    row(padLed, 'Cooling pad', 'Water on the west end pad', padBtn));
  padBtn.addEventListener('click', () => { env.setPad(!env.padOn); refresh(); });

  const brand = h('header', { class: 'ctrl-brand' },
    h('span', { class: 'ctrl-logo', html: ICONS.fan, 'aria-hidden': 'true' }),
    h('div', null, h('h2', { id: titleId }, 'Climate controller'), h('p', null, 'House 1 · tunnel ventilation')));
  const screws = ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `screw screw--${p}`, 'aria-hidden': 'true' }));
  el.append(h('div', { class: 'ctrl-case' }, screws, brand, h('div', { class: 'ctrl-plate' }, lcd, keys)), closeBtn);

  let acc = 0;
  function refresh() {
    setText(house.value, fmt1(env.houseTemp));
    setText(outside.value, fmt1(env.outsideTemp));
    setText(rhIn.value, fmt0(env.houseRH));
    setText(rhOut.value, fmt0(env.outsideRH));
    setText(air.value, fmt1(env.airSpeed));
    setText(feels.value, fmt1(env.feelsLike));
    setText(chill, env.windChill > 0.05 ? `WIND CHILL ${fmt1(-env.windChill)}°` : 'NO WIND CHILL');
    setText(clock, `DAY ${env.dayNumber}  ${env.timeLabel}`);
    status.heat.classList.toggle('is-on', env.heatersOn);
    setText(status.fans, `FANS ${env.fansOn}/${FAN_COUNT}`);
    status.fans.classList.toggle('is-on', env.fansOn > 0);
    status.pad.classList.toggle('is-on', env.padOn);

    setText(spValue, `${fmt1(env.heaterSetpoint)} °C`);
    setText(fanValue, `${env.fansOn} / ${FAN_COUNT}`);
    setText(heatState, env.heatersOn ? 'Brooders burning' : 'Brooders off');
    heatLed.classList.toggle('is-on', env.heatersOn);
    fanLed.classList.toggle('is-on', env.fansOn > 0);
    padLed.classList.toggle('is-on', env.padOn);
    padBtn.setAttribute('aria-pressed', String(env.padOn));
    setText(padBtn, env.padOn ? 'Pad on' : 'Pad off');
    padBtn.setAttribute('aria-label', env.padOn ? 'Cooling pad is on. Turn it off' : 'Cooling pad is off. Turn it on');
  }

  return {
    el,
    update(dt, force) {
      acc -= dt;
      if (force || acc <= 0) { acc = 0.1; refresh(); }
    },
  };
}
