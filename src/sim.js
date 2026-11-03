// House climate and farm clock. Pure logic, no three.js.
// Owner: systems/UI agent. Other modules read `env`; only ui.js and test hooks call the setters.
import {
  HEATERS, HOUSE, BIRD_BOUNDS, FAN_COUNT, TIME, WEATHER, targetTempAt, weightAt,
} from './config.js';

const HOUR = 3600;

export function createSim() {
  const env = {
    // clock
    day: TIME.startDay,            // flock age in days (float). Day 1 = arrival day.
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
    heatersOn: false,
    heaterLevel: 0,                // 0..1 smoothed, for glow visuals
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

    get isNight() { return this.hour < TIME.sunrise || this.hour > TIME.sunset; },
    get timeLabel() {
      const h = Math.floor(this.hour);
      const m = Math.floor((this.hour - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    // Temperature a chick feels at floor point (x, z): house air, plus radiant heat under a
    // running brooder, minus wind chill, slightly cooler beside the side walls and near the pad.
    localTemp(x, z) {
      let t = this.houseTemp - this.windChill;
      if (this.heaterLevel > 0.01) {
        let r = 0;
        for (const h of HEATERS) {
          const dx = x - h.x, dz = z - h.z;
          r += Math.exp(-(dx * dx + dz * dz) / (2 * 1.6 * 1.6));
        }
        t += 7 * this.heaterLevel * Math.min(1, r);
      }
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

    setDay(d) { this.day = Math.max(0, Math.min(42, d)); derive(this); emit('day'); },
    setHour(h) { this.hour = ((h % 24) + 24) % 24; derive(this); emit('time'); },
    setWeather(w) { if (WEATHER[w]) { this.weather = w; derive(this); emit('weather'); } },
    setHeaterSetpoint(t) { this.heaterSetpoint = Math.max(15, Math.min(40, Math.round(t * 2) / 2)); emit('controls'); },
    setFans(n) { this.fansOn = Math.max(0, Math.min(FAN_COUNT, Math.round(n))); derive(this); emit('controls'); },
    setPad(on) { this.padOn = !!on; emit('controls'); },
    forceHouseTemp(t) { this.forcedHouseTemp = t == null ? null : t; if (t != null) this.houseTemp = t; derive(this); emit('controls'); },
    skipHours(h) { stepGame(this, h * HOUR, true); emit('time'); },

    // dt in real seconds
    update(dt) {
      if (this.paused) return;
      stepGame(this, dt * this.timeScale, false);
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
  env.targetTemp = targetTempAt(env.day);
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

// Advance the farm by `gs` game seconds in steps of at most one game minute.
function stepGame(env, gs, fast) {
  let left = gs;
  while (left > 0) {
    const s = Math.min(left, 60);
    left -= s;
    const hrs = s / HOUR;
    env.hour += hrs;
    if (env.hour >= 24) { env.hour -= 24; }
    env.day = Math.min(42, env.day + hrs / 24);
    derive(env);

    // Thermostat with 0.3 °C hysteresis
    if (env.houseTemp < env.heaterSetpoint - 0.3) env.heatersOn = true;
    else if (env.houseTemp > env.heaterSetpoint + 0.3) env.heatersOn = false;
    const k = 1 - Math.exp(-hrs * 12); // glow follows the burner within a few game minutes
    env.heaterLevel += ((env.heatersOn ? 1 : 0) - env.heaterLevel) * (fast ? 1 : k);

    if (env.forcedHouseTemp != null) {
      env.houseTemp = env.forcedHouseTemp;
    } else {
      // Inlet air: through the wet pad it cools by about 1 °C for every 5 % of humidity it can still take up.
      const padDrop = env.padOn && env.fansOn > 0 ? Math.min(9, (100 - env.outsideRH) / 5) * 0.85 : 0;
      const inlet = env.outsideTemp - padDrop;
      const birdHeat = 0.2 + 1.3 * (env.bodyWeight / 2850);    // °C per hour from the flock
      const heat = env.heatersOn ? 6.5 : 0;                      // °C per hour from 8 brooders
      const leak = 0.25 + env.fansOn * 0.9;                      // air exchanges toward inlet temp
      const dT = heat + birdHeat - leak * (env.houseTemp - inlet);
      env.houseTemp += dT * hrs;
      env.houseRH = Math.max(35, Math.min(98, env.outsideRH + padDrop * 5 * (env.fansOn > 0 ? 1 : 0)));
    }
    env.feelsLike = env.houseTemp - env.windChill;
  }
}
