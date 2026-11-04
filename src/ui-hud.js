// HUD: farm clock card, gauge strip (measured values only) and time controls. Owner: systems/UI agent.
import { FAN_COUNT, TIME, WEATHER } from './config.js';
import { MAX_DAY } from './sim.js';
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
  // Phase 4 (PHASE4.md §1.2): the condition's name under the day ("Hot season"); empty in the normal season
  const cond = h('div', { class: 'clock-cond', hidden: true });
  const time = h('div', { class: 'clock-time' });
  const sky = h('div', { class: 'clock-sky', 'aria-hidden': 'true' });
  const wIcon = h('span', { 'aria-hidden': 'true' });
  const wText = h('span');
  const rate = h('span', { class: 'clock-rate' });
  const clock = h('section', { class: 'card clock', 'aria-label': 'Farm clock' },
    h('div', null, day, cond, time), sky, h('div', { class: 'clock-weather' }, wIcon, wText, rate));

  // ---- gauges ----
  const house = gauge('gauge--main', ICONS.thermometer, 'House');
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
  // In a level the level owns the clock (PHASE2.md §2): the buttons ask it instead of setting env.
  let level = null;
  playBtn.addEventListener('click', () => { if (level) level.togglePause(); else env.paused = !env.paused; refresh(); });
  const speedBtns = SPEEDS.map((s, i) => {
    const b = button({ class: 'btn', title: s.title, 'aria-pressed': 'false' }, s.label);
    b.addEventListener('click', () => {
      if (level) level.setFast(i === 1);
      else { env.timeScale = s.scale; env.paused = false; }
      refresh();
    });
    return b;
  });
  const skipBtn = button({ class: 'btn', title: 'Move the farm clock on by one hour', 'aria-label': 'Skip 1 hour' });
  skipBtn.innerHTML = `${ICONS.skip}<span>Skip 1 hour</span>`;
  skipBtn.addEventListener('click', () => { if (!passesLastDay(1)) env.skipHours(1); refresh(); });
  const morningBtn = button({ class: 'btn', title: 'Jump to 06:00 tomorrow morning', 'aria-label': 'Next morning (06:00)' });
  morningBtn.innerHTML = `${ICONS.sunrise}<span>Next morning (06:00)</span>`;
  morningBtn.addEventListener('click', () => {
    let hrs = (TIME.sunrise - env.hour + 24) % 24;
    if (hrs < 1 / 60) hrs += 24; // already 06:00: go to tomorrow's
    if (passesLastDay(hrs)) return;
    env.skipHours(hrs);
    refresh();
  });
  // The flock ends on day MAX_DAY: no jump may run the clock past its last midnight.
  const passesLastDay = (hrs) => env.dayNumber >= MAX_DAY && env.hour + hrs >= 24 - 1e-6;
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
    // in a level the level names the day (PHASE3.md §2.3: "Planning day", "Day 42 · the catch", "Clean-out day 2")
    if (level?.dayText) setText(day, level.dayText());
    else if (env.dayNumber !== lastDay) { lastDay = env.dayNumber; setText(day, level && lastDay < 0 ? 'Prep day' : `Day ${fmt0(lastDay)}`); }
    const ct = level?.conditionText ? level.conditionText() : '';
    if (cond.hidden === !!ct) cond.hidden = !ct;
    if (ct) setText(cond, ct);
    setAttr(clock, 'aria-label', ct ? `Farm clock: ${day.textContent} · ${ct}` : 'Farm clock');
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
    const rateText = level ? level.rateLabel() : env.paused ? 'Paused' : speed ? speed.label : `${fmt1(env.timeScale / TIME.gameSecondsPerRealSecond)}×`;
    setText(rate, rateText);
    rate.classList.toggle('is-paused', env.paused || (!!level && env.timeScale === 0));

    // gauges: measured values only
    setGauge(house.value, fmt1(env.houseTemp), '°C');
    setGauge(outside.value, fmt1(env.outsideTemp), '°C');
    setGauge(humid.value, fmt0(env.houseRH), '%');
    setText(humidSub, `outside ${fmt0(env.outsideRH)} %`);
    setGauge(fans.value, String(env.fansOn), `/ ${FAN_COUNT}`);
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('is-on', i < env.fansOn);
    setText(burnerText, env.heatersOn ? 'On' : 'Off');
    burner.el.classList.toggle('is-on', env.heatersOn);

    // time controls: at the end of the flock the jumps stop
    const endMorning = passesLastDay(((TIME.sunrise - env.hour + 24) % 24) || 24), endSkip = passesLastDay(1);
    if (morningBtn.disabled !== endMorning) {
      morningBtn.disabled = endMorning;
      setAttr(morningBtn, 'title', endMorning ? `End of the flock (day ${MAX_DAY})` : 'Jump to 06:00 tomorrow morning');
    }
    if (skipBtn.disabled !== endSkip) {
      skipBtn.disabled = endSkip;
      setAttr(skipBtn, 'title', endSkip ? `End of the flock (day ${MAX_DAY})` : 'Move the farm clock on by one hour');
    }
    const shownPaused = level ? level.userPaused : env.paused;
    if (shownPaused !== lastPaused) {
      lastPaused = shownPaused;
      playBtn.innerHTML = shownPaused ? ICONS.play : ICONS.pause;
      setAttr(playBtn, 'aria-label', shownPaused ? 'Start the farm clock' : 'Pause the farm clock');
    }
    const userPaused = level ? level.userPaused : env.paused;
    const speedKey = `${userPaused}|${env.timeScale}|${level ? level.fast : ''}`;
    if (speedKey !== lastScale) {
      lastScale = speedKey;
      SPEEDS.forEach((s, i) => setAttr(speedBtns[i], 'aria-pressed', level ? !userPaused && level.fast === (i === 1) : !env.paused && s.scale === env.timeScale));
    }
  }

  // hooks = { togglePause(), setFast(on), fast, userPaused, rateLabel() } in a level; null = sandbox
  function setLevel(hooks) {
    level = hooks;
    skipBtn.hidden = morningBtn.hidden = !!hooks;
    SPEEDS.forEach((s, i) => setAttr(speedBtns[i], 'title', hooks ? (i ? 'Four times faster while you walk' : 'Normal speed while you walk: a farm hour takes 30 s') : s.title));
    lastDay = null; lastScale = null; lastPaused = null;
    refresh();
  }

  return { timebar, refresh, setLevel };
}

// Number plus a smaller unit, written only when it changed.
function setGauge(el, num, unit) {
  const key = `${num}|${unit}`;
  if (el.__key === key) return;
  el.__key = key;
  el.textContent = num;
  el.appendChild(h('span', { class: 'unit' }, unit));
}
