// HUD: farm clock card, gauge strip (measured values only) and time controls. Owner: systems/UI agent.
import { FAN_COUNT, TIME, WEATHER } from './config.js';
import { h, button, setText, setAttr, fmt1, fmt0 } from './ui-dom.js';
import { ICONS, weatherIcon } from './ui-icons.js';

const SPEEDS = [
  { label: '1×', scale: TIME.gameSecondsPerRealSecond, title: 'Normal speed: a farm day takes 4 minutes' },
  { label: '4×', scale: TIME.gameSecondsPerRealSecond * 4, title: 'Four times faster: a farm day takes 1 minute' },
];

function gauge(cls, icon, label, extra) {
  const value = h('div', { class: 'gauge-value' });
  const el = h('div', { class: `gauge ${cls}`, role: 'group', 'aria-label': label },
    h('div', { class: 'label', html: `${icon || ''}<span>${label}</span>` }), value, extra);
  return { el, value };
}

export function createHud(parent, env) {
  // ---- farm clock ----
  const day = h('div', { class: 'clock-day' });
  const time = h('div', { class: 'clock-time' });
  const sky = h('div', { class: 'clock-sky', 'aria-hidden': 'true' });
  const wIcon = h('span', { 'aria-hidden': 'true' });
  const wText = h('span');
  const rate = h('span', { class: 'clock-rate' });
  const clock = h('section', { class: 'card clock', 'aria-label': 'Farm clock' },
    h('div', null, day, time), sky, h('div', { class: 'clock-weather' }, wIcon, wText, rate));

  // ---- gauges ----
  const house = gauge('gauge--main', ICONS.thermometer, 'House');
  const houseSub = h('div', { class: 'gauge-sub' });
  house.el.appendChild(houseSub);
  const outside = gauge('', ICONS.outside, 'Outside');
  const humid = gauge('', ICONS.droplet, 'Humidity');
  const humidSub = h('div', { class: 'gauge-sub' });
  humid.el.appendChild(humidSub);
  const pipWrap = h('div', { class: 'pips', 'aria-hidden': 'true' });
  const pips = [];
  for (let i = 0; i < FAN_COUNT; i++) { const p = h('span', { class: 'pip' }); pips.push(p); pipWrap.appendChild(p); }
  const fans = gauge('', ICONS.fan, 'Fans', pipWrap);
  const burner = gauge('gauge--burner', null, 'Brooders');
  const flame = h('span', { class: 'flame', html: ICONS.flame, 'aria-hidden': 'true' });
  const burnerText = h('span');
  burner.value.append(flame, burnerText);
  const strip = h('section', { class: 'card gauges', 'aria-label': 'House gauges' },
    house.el, outside.el, humid.el, fans.el, burner.el);

  const tl = h('div', { class: 'hud-tl' }, clock, strip);

  // ---- time controls ----
  const playBtn = button({ class: 'btn btn--icon', 'aria-label': 'Pause the farm clock' });
  playBtn.addEventListener('click', () => { env.paused = !env.paused; refresh(); });
  const speedBtns = SPEEDS.map((s) => {
    const b = button({ class: 'btn', title: s.title, 'aria-pressed': 'false' }, s.label);
    b.addEventListener('click', () => { env.timeScale = s.scale; env.paused = false; refresh(); });
    return b;
  });
  const skipBtn = button({ class: 'btn', title: 'Move the farm clock on by one hour' });
  skipBtn.innerHTML = `${ICONS.skip}<span>Skip 1 hour</span>`;
  skipBtn.addEventListener('click', () => { env.skipHours(1); refresh(); });
  const morningBtn = button({ class: 'btn', title: 'Jump to 06:00 tomorrow morning' });
  morningBtn.innerHTML = `${ICONS.sunrise}<span>Next morning (06:00)</span>`;
  morningBtn.addEventListener('click', () => {
    const hrs = ((TIME.sunrise - env.hour + 24) % 24) || 24;
    env.skipHours(hrs);
    refresh();
  });
  const timebar = h('section', { class: 'card timebar', 'aria-label': 'Time controls' },
    playBtn, h('div', { class: 'seg', role: 'group', 'aria-label': 'Clock speed' }, speedBtns),
    h('div', { class: 'timebar-sep', 'aria-hidden': 'true' }), skipBtn, morningBtn);

  parent.appendChild(tl);

  let lastPaused = null;
  let lastScale = null;
  let lastNight = null;
  let lastWeather = null;

  let lastDay = -1;
  // `gauges` false: only the clock (every frame). Gauges and buttons refresh about 10 times a second.
  function refresh(gauges = true) {
    // clock
    if (env.dayNumber !== lastDay) { lastDay = env.dayNumber; setText(day, `Day ${lastDay}`); }
    setText(time, env.timeLabel);
    if (!gauges) return;
    if (env.isNight !== lastNight) {
      lastNight = env.isNight;
      sky.innerHTML = lastNight ? ICONS.moon : ICONS.sun;
      sky.classList.toggle('is-night', lastNight);
    }
    if (env.weather !== lastWeather) {
      lastWeather = env.weather;
      wIcon.innerHTML = weatherIcon(env.weather);
      setText(wText, WEATHER[env.weather]?.label ?? env.weather);
    }
    let speed = null;
    for (const s of SPEEDS) if (s.scale === env.timeScale) speed = s;
    setText(rate, env.paused ? 'Paused' : speed ? speed.label : `${fmt1(env.timeScale / TIME.gameSecondsPerRealSecond)}×`);
    rate.classList.toggle('is-paused', env.paused);

    // gauges: measured values only
    setGauge(house.value, fmt1(env.houseTemp), '°C');
    setText(houseSub, `feels ${fmt1(env.feelsLike)} °C`);
    houseSub.hidden = env.airSpeed < 0.05;
    setGauge(outside.value, fmt1(env.outsideTemp), '°C');
    setGauge(humid.value, fmt0(env.houseRH), '%');
    setText(humidSub, `outside ${fmt0(env.outsideRH)} %`);
    setGauge(fans.value, String(env.fansOn), `/ ${FAN_COUNT}`);
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('is-on', i < env.fansOn);
    setText(burnerText, env.heatersOn ? 'On' : 'Off');
    burner.el.classList.toggle('is-on', env.heatersOn);

    // time controls
    if (env.paused !== lastPaused) {
      lastPaused = env.paused;
      playBtn.innerHTML = env.paused ? ICONS.play : ICONS.pause;
      setAttr(playBtn, 'aria-label', env.paused ? 'Start the farm clock' : 'Pause the farm clock');
    }
    const speedKey = `${env.paused}|${env.timeScale}`;
    if (speedKey !== lastScale) {
      lastScale = speedKey;
      SPEEDS.forEach((s, i) => setAttr(speedBtns[i], 'aria-pressed', !env.paused && s.scale === env.timeScale));
    }
  }

  return { timebar, refresh };
}

// Number plus a smaller unit, written only when it changed.
function setGauge(el, num, unit) {
  const key = `${num}|${unit}`;
  if (el.__key === key) return;
  el.__key = key;
  el.textContent = num;
  el.appendChild(h('span', { class: 'unit' }, unit));
}
