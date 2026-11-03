// House climate and farm clock. Pure logic, no three.js.
// Owner: systems/UI agent. Other modules read `env`; only ui.js and test hooks call the setters.
import {
  HEATERS, HOUSE, BIRD_BOUNDS, FAN_COUNT, TIME, WEATHER, targetTempAt, weightAt,
} from './config.js';

const HOUR = 3600;
export const MAX_DAY = 42;  // the last day of the flock; after it the clock keeps day 42
// Modulating brooders: the burner output follows the house air across a 1.5 °C band (full heat
// 1.2 °C below the setpoint, none 0.3 °C above it, so the house settles close to the setpoint).
// A steady output instead of an on/off relay that would flip every few real seconds at game speed.
const HEAT_BAND = 1.5, HEAT_OFF_ABOVE = 0.3;
const HEAT_RATE = 6.5;      // °C per hour from 8 brooders at full output

// The farm clock keeps `day` and `hour` in step: the whole number of `day` is the calendar day of
// the flock (it changes at midnight) and the fraction is the time of day, so day = N + hour / 24.
// Day 1 is the arrival day; the chicks arrive at TIME.startHour on day 1.
function initialState() {
  return {
    // clock
    day: TIME.startDay + TIME.startHour / 24, // flock age in days (float). Day 1 = arrival day.
    hour: TIME.startHour,          // 0–24
    timeScale: TIME.gameSecondsPerRealSecond,
    paused: false,
    // weather
    weather: 'cool',
    outsideTemp: 24,
    outsideRH: 60,
    // house
    houseTemp: 27,
    houseRH: 60,
    heaterSetpoint: 27,
    heatersOn: false,              // burners lit (output above 2 %)
    heaterDemand: 0,               // 0..1 burner output the thermostat asks for
    heaterLevel: 0,                // 0..1 actual output (follows the demand within a few game minutes)
    fansOn: 0,                     // 0..FAN_COUNT tunnel fans running
    padOn: false,
    airSpeed: 0,                   // m/s at bird level
    lightsOn: true,
    forcedHouseTemp: null,         // test hook: hold house temperature at this value
    // derived each update
    targetTemp: targetTempAt(TIME.startDay),
    windChill: 0,
    feelsLike: 27,
    bodyWeight: weightAt(TIME.startDay),
    broodCurtain: true,
  };
}

// Calendar day number (0..MAX_DAY). Robust to float drift in `hour`.
function dayNumberOf(env) {
  return Math.max(0, Math.min(MAX_DAY, Math.round(env.day - env.hour / 24)));
}

export function createSim() {
  const env = {
    ...initialState(),

    get isNight() { return this.hour < TIME.sunrise || this.hour > TIME.sunset; },
    get timeLabel() {
      const mins = Math.floor(this.hour * 60 + 1e-4) % (24 * 60); // 1e-4: 05:59.99999 reads 06:00
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    },
    // Whole calendar day of the flock (changes at midnight). Use this for "Day N" labels.
    get dayNumber() { return dayNumberOf(this); },

    // Temperature a chick feels at floor point (x, z): house air, plus radiant heat under a
    // running brooder, minus wind chill, slightly cooler beside the side walls and near the pad.
    localTemp(x, z) {
      let t = this.houseTemp - this.windChill + this.brooderHeat(x, z);
      const wallDist = Math.min(z - BIRD_BOUNDS.zMin, BIRD_BOUNDS.zMax - z);
      if (wallDist < 1.5) t -= 1.0 * (1 - wallDist / 1.5);
      if (this.fansOn > 0) {
        // air warms as it travels from the pad (west) to the fans (east)
        const along = (x - BIRD_BOUNDS.xMin) / (BIRD_BOUNDS.xMax - BIRD_BOUNDS.xMin);
        t += (along - 0.5) * 1.5 * (this.fansOn / FAN_COUNT);
      }
      return t;
    },
    // Signed difference between what a bird feels at (x, z) and the target for its age.
    comfort(x, z) { return this.localTemp(x, z) - this.targetTemp; },
    // Radiant part of localTemp at floor point (x, z): °C added by the running brooders
    // (Gaussian, sigma 1.6 m, up to +7 °C at full glow). 0 when the brooders are cold.
    brooderHeat(x, z) {
      if (this.heaterLevel <= 0.01) return 0;
      let r = 0;
      for (const h of HEATERS) {
        const dx = x - h.x, dz = z - h.z;
        r += Math.exp(-(dx * dx + dz * dz) / (2 * 1.6 * 1.6));
      }
      return 7 * this.heaterLevel * Math.min(1, r);
    },

    // setDay picks the calendar day (whole number, 0..42) and keeps the time of day.
    setDay(d) { const n = Math.max(0, Math.min(MAX_DAY, Math.floor(d))); this.day = n + this.hour / 24; derive(this); emit('day'); },
    setHour(h) { const n = dayNumberOf(this); this.hour = ((h % 24) + 24) % 24; this.day = n + this.hour / 24; derive(this); emit('time'); },
    setWeather(w) { if (WEATHER[w]) { this.weather = w; derive(this); emit('weather'); } },
    setHeaterSetpoint(t) {
      this.heaterSetpoint = Math.max(15, Math.min(40, Math.round(t * 2) / 2));
      thermostat(this); // the burner valve answers at once, even while the clock is paused
      emit('controls');
    },
    // Test hook: jump the burner output straight to what the thermostat asks for now (setState
    // uses it after changing the setpoint or the house temperature with the clock paused).
    settleHeaters() { thermostat(this); this.heaterLevel = this.heaterDemand; },
    setFans(n) { this.fansOn = Math.max(0, Math.min(FAN_COUNT, Math.round(n))); derive(this); emit('controls'); },
    setPad(on) { this.padOn = !!on; emit('controls'); },
    forceHouseTemp(t) { this.forcedHouseTemp = t == null ? null : t; if (t != null) this.houseTemp = t; derive(this); emit('controls'); },
    skipHours(h) {
      const d0 = dayNumberOf(this);
      stepGame(this, h * HOUR, true);
      // land on a whole minute: float drift (05:59.99999) must not make the next jump to 06:00 a no-op
      let n = dayNumberOf(this), hr = Math.round(this.hour * 60) / 60;
      if (hr >= 24) { hr -= 24; n = Math.min(MAX_DAY, n + 1); }
      this.hour = hr; this.day = n + hr / 24;
      derive(this);
      emit('time');
      if (dayNumberOf(this) !== d0) emit('day');
    },
    // Back to the start of the flock: day 1, 08:00, cool season, controls at their first settings.
    reset() {
      Object.assign(this, initialState());
      derive(this);
      emit('day'); emit('time'); emit('weather'); emit('controls');
    },

    // dt in real seconds
    update(dt) {
      if (this.paused) return;
      const d0 = dayNumberOf(this);
      stepGame(this, dt * this.timeScale, false);
      if (dayNumberOf(this) !== d0) emit('day');
    },

    on(name, fn) { (listeners[name] ||= []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; },
  };

  const listeners = {};
  function emit(name) { for (const fn of listeners[name] || []) fn(env); for (const fn of listeners['*'] || []) fn(env, name); }

  derive(env);
  return env;
}

function outsideTempAt(weather, hour) {
  const w = WEATHER[weather];
  const mean = (w.min + w.max) / 2, amp = (w.max - w.min) / 2;
  // coolest near 05:00, hottest near 15:00
  return mean + amp * Math.sin(((hour - 9) / 24) * Math.PI * 2);
}

function derive(env) {
  env.outsideTemp = outsideTempAt(env.weather, env.hour);
  env.outsideRH = WEATHER[env.weather].rh;
  // The target follows the whole flock day (the brooder sign's table): day 1 is 34 °C all day.
  env.targetTemp = targetTempAt(dayNumberOf(env));
  env.bodyWeight = weightAt(env.day);
  env.broodCurtain = env.day < HOUSE.broodUntilDay;
  env.airSpeed = env.fansOn * (2.5 / FAN_COUNT);
  // Wind chill felt by the birds (general practice): young birds feel moving air more.
  const ageK = 3.0 - 1.6 * Math.max(0, Math.min(1, (env.day - 7) / 28));
  env.windChill = env.airSpeed * ageK;
  env.feelsLike = env.houseTemp - env.windChill;
  // Light program: 23 hours of light, dark 02:00–03:00 (week 1 guide)
  env.lightsOn = !(env.hour >= 2 && env.hour < 3);
}

// Brooder thermostat, measured on the house air: proportional output across HEAT_BAND.
function thermostat(env) {
  const d = (env.heaterSetpoint + HEAT_OFF_ABOVE - env.houseTemp) / HEAT_BAND;
  env.heaterDemand = d < 0 ? 0 : d > 1 ? 1 : d;
  env.heatersOn = env.heaterDemand > 0.02;
}

// Advance the farm by `gs` game seconds in steps of at most one game minute.
function stepGame(env, gs, fast) {
  let left = gs;
  while (left > 0) {
    const s = Math.min(left, 60);
    left -= s;
    const hrs = s / HOUR;
    let n = dayNumberOf(env);
    env.hour += hrs;
    if (env.hour >= 24) { env.hour -= 24; n = Math.min(MAX_DAY, n + 1); } // after day 42 the clock keeps day 42
    env.day = n + env.hour / 24;
    derive(env);

    thermostat(env);
    const k = 1 - Math.exp(-hrs * 12); // output (and glow) follows the valve within a few game minutes
    env.heaterLevel += (env.heaterDemand - env.heaterLevel) * (fast ? 1 : k);

    if (env.forcedHouseTemp != null) {
      env.houseTemp = env.forcedHouseTemp;
    } else {
      // Inlet air: through the wet pad it cools by about 1 °C for every 5 % of humidity it can still take up.
      const padDrop = env.padOn && env.fansOn > 0 ? Math.min(9, (100 - env.outsideRH) / 5) * 0.85 : 0;
      const inlet = env.outsideTemp - padDrop;
      const birdHeat = 0.2 + 1.3 * (env.bodyWeight / 2850);    // °C per hour from the flock
      const heat = HEAT_RATE * env.heaterLevel;                  // °C per hour from 8 brooders
      const leak = 0.25 + env.fansOn * 0.9;                      // air exchanges toward inlet temp
      const dT = heat + birdHeat - leak * (env.houseTemp - inlet);
      env.houseTemp += dT * hrs;
      env.houseRH = Math.max(35, Math.min(98, env.outsideRH + padDrop * 5 * (env.fansOn > 0 ? 1 : 0)));
    }
    env.feelsLike = env.houseTemp - env.windChill;
  }
}
