// House climate and farm clock. Pure logic, no three.js.
// Owner: systems/UI agent. Other modules read `env`; only ui.js and test hooks call the setters.
import {
  HEATERS, HOUSE, BIRD_BOUNDS, BROOD_BOUNDS, FAN_COUNT, TIME, WEATHER, MIN_DAY, AIR, EQUIP, targetTempAt, weightAt,
  OUTSIDE_WATER_GM3, PAD_EFF, PLACEMENT_DAY,
} from './config.js';
import { windChillP4 } from './farm-tuning.js';
//
// Phase 2 additions (package "sim", PHASE2.md §6.2). The level climate runs only while
// env.levelClimate is true (farm.start sets it, farm.stop clears it). With it false the climate is
// exactly Phase 1's (the sandbox; scripts/test-sim.mjs checks a digest of it).
//   env.addStepper(fn(env, gameSeconds, fast))  called after every <= 60 game-second step (the farm
//                                               model integrates here, also during skipHours)
//   env.setLevelClimate(on)                     level climate on / off (the farm calls it)
//   env.setVentTimer({ fans, onSec, cycleSec } | null)   minimum ventilation fan timer
//   env.ventTimer, env.ventDuty (0..1 share of the cycle the timer fans run)
//   env.fansManual  tunnel fans switched on by hand (setFans). In a level env.fansOn shows the
//                   manual fans plus the timer fans during the on-part of each cycle (phase from the
//                   game clock), so the LED and the blades cycle. A panel that steps the fans by
//                   one should call env.setFans(env.fansManual +- 1).
//   env.fanMean     mean running fans (manual + timer fans x duty): air, heat, wind chill use it
//   env.airflowM3h  fresh air, m3/h = AIR.infiltrationM3h + fanMean x EQUIP.fanM3h
//   env.setLightProgram({ darkStart, darkHours, dimmer }) light program (Phase 1 default: dark 02-03)
//   env.lightProgram, env.lightLevel (0..1: dimmer while lit, 0 in the dark period)
//   env.addWeatherEvent({ id, fromDay, toDay, outsideDrop })   (day = N + h/24; a negative drop is
//                   a rise; 2 h ramps inside the window). The farm owns them, rebuilt on restore.
//   env.slabTemp (°C, concrete under the litter), env.floorTemp(x, z) litter surface °C
//   env.litterDepthCm (house mean) and env.litterDepthAt(x, z) (cm, set by the farm; 0 = concrete)
//   env.setBrooderOut([i]) / env.brooderOut  HEATERS indices whose flame is out (no radiant, heat
//                   rate x (8 - out) / 8)
//   env.flockHeatPerH (°C/h from the birds) and env.vapourGh (g/h of water vapour: breath and
//                   litter drying) are set by the farm each step; the climate uses them next step.
//   env.dayNumber may be MIN_DAY (-1) on the prep day.
//
// Phase 3 (PHASE3.md §13.8; package "sim" owns the file, these two are the contract in code now):
//   env.setMaxDay(n) / env.maxDay   last calendar day the clock may reach (MAX_DAY 42 by default; the
//                   clean-out level sets 70). reset() goes back to 42.
//   env.setBroodCurtain(closed | null)   true = the brooding curtain is down, false = lifted (the farm's
//                   house.curtain action in a level); null = Phase 1's rule (down before day 10).
//                   env.broodCurtain follows it.
//   env.setCycleClimate(on) / env.cycleClimate   the Phase 3 outside air and pad (PHASE3.md §6.3), on
//                   from Week 2 (farm.enterLevel sets it; the brooding week and the sandbox keep it
//                   off, so every Phase 1 and Phase 2 number is unchanged):
//                   - outside air keeps the day's water content OUTSIDE_WATER_GM3[weather] (g/m3), so
//                     the RH falls as the afternoon warms (normal: about 89 % at 05:00, 54 % at 15:00);
//                     a weather event with `rh` sets the outside RH during it, `rhDrop` takes points
//                     off it (2 h ramps)
//                   - the pad cools by PAD_EFF x (outside - wet bulb) x tunnel share x env.padWorking
//                     and adds 0.49 g/m3 of water per °C it cools (Phase 2's figure)
//   env.setFansBroken([i]) / env.fansBroken   tunnel fans (0-based) whose belt is broken: inside the
//                   first fansManual their lamp is on (fansOn counts them) but they move no air;
//                   env.fansEffective = fansManual - broken among them (air, heat, wind chill use it)
//   env.padWorking  0..1 share of the pad with water on it (the farm sets it; 1 by default)
//   env.wetBulb()   outside wet-bulb °C (the pad's limit)
//   env.setBroodersUp(on) / env.broodersUp   the brooders are off for good and winched up (heat.brooders
//                   { up: true }, week 4): the thermostat asks for nothing, no radiant (the house look
//                   winches them up 0.62 m)
//   env.setFanStages({ stages: [{ overC, fans }], padOverC } | null) / env.fanStages   the fan panel's stage
//                   table (unlock tunnelStages): each climate step the tunnel fans follow the house
//                   temperature over the target (the most fans of every stage whose overC it passed), the
//                   pad runs from padOverC; null = the fans and the pad by hand
//   env.heatBudget() -> { wallsCh, airCh, brooderCh, birdsCh, sunCh, slabCh }   °C per hour each term moved the
//                   house air in the last level-climate step (negative = cooling): the heat loss readout
//
// Phase 4 (PHASE4.md §9.1, §9.2; package "sim"):
//   env.setWindChillP4(on) / env.windChillP4   the Phase 4 wind chill (farm-tuning.js windChillP4: by age, speed and
//                   house air) instead of Phase 2's formula; the farm turns it on with the cycle model (Week 2 on).
//                   Off: the brooding week of every condition and the sandbox keep Phase 2's / Phase 1's.
//   env.setPower(on) / env.powerOn   the house has power (the farm's mains or generator). While false the env counts
//                   no fans (manual or timer: fansOn, fansEffective, fanMean 0, no air speed), no pad, no lights and no
//                   brooder ignition (heaterDemand 0); the farmer's settings (fansManual, ventTimer, padOn, setpoint)
//                   stay and act again when the power comes back.
//   env.setTargetShift(c, toDay = 3) / env.targetShiftC   env.targetTemp = the brooder sign's row + c on calendar days
//                   0..toDay (a bad batch brooded 1 °C warmer); 0 = the sign's row (every reader agrees with it)

const HOUR = 3600;
export const MAX_DAY = 42;  // the last day of the flock; after it the clock keeps day 42
// Modulating brooders: the burner output follows the house air across a 1.5 °C band (full heat
// 1.2 °C below the setpoint, none 0.3 °C above it, so the house settles close to the setpoint).
// A steady output instead of an on/off relay that would flip every few real seconds at game speed.
const HEAT_BAND = 1.5, HEAT_OFF_ABOVE = 0.3;
const HEAT_RATE = 6.5;      // °C per hour from 8 brooders at full output
// Concrete slab under the litter (model, PHASE2.md §6.2): it follows the house air (+1 °C per unit
// of brooder output) with a 30 h time constant and pulls the house air toward itself.
const SLAB = { tauH: 30, brooderC: 1.0, sinkPerH: 0.3, kBare: 0.1, kPerCm: 0.02 };
const RAMP_DAYS = 2 / 24;   // weather events ramp in and out over 2 h
// A brooder that is out leaves the air around it cooler than the house mean: the other brooders'
// heat reaches it only by mixing (model). Air there = house - OUT_AIR.c x output x (g - mean g),
// g a Gaussian of OUT_AIR.sigma m around it; mean g over the brooding floor keeps the house mean.
const OUT_AIR = { c: 6, sigma: 2.5 };
// Minimum ventilation draws its air in through the side-wall inlets, which throw it up under the
// roof: it mixes with the house air before it reaches the chicks. Air speed at bird level from the
// timer fans = this share of what the same fans give in tunnel mode (model). The tunnel fans pull
// the air through the pad end, along the house at bird level (full speed, full wind chill).
const INLET_SPEED_SHARE = 0.1;
const OUT_MEAN = HEATERS.map((h) => {
  let s = 0, n = 0;
  for (let x = BROOD_BOUNDS.xMin + 0.5; x < BROOD_BOUNDS.xMax; x += 1) for (let z = BROOD_BOUNDS.zMin + 0.5; z < BROOD_BOUNDS.zMax; z += 1) {
    s += Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * OUT_AIR.sigma ** 2)); n++;
  }
  return s / n;
});

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
    curtainForced: null,           // Phase 3: true / false from setBroodCurtain, null = the day-10 rule
    maxDay: MAX_DAY,               // Phase 3: setMaxDay (the clean-out level runs to day 70)
    cycleClimate: false,           // Phase 3: outside water content, wet-bulb pad (setCycleClimate)
    fansBroken: [],                // Phase 3: tunnel fans with a broken belt (setFansBroken)
    fansEffective: 0,              // Phase 3: manual fans that move air
    padWorking: 1,                 // Phase 3: share of the pad with water on it (farm sets it)
    broodersUp: false,             // Phase 3: brooders off for good and winched up (setBroodersUp)
    windChillP4: false,            // Phase 4: the tuned wind chill (setWindChillP4; the farm, from Week 2)
    powerOn: true,                 // Phase 4: the house has power (setPower; the farm's mains or generator)
    targetShiftC: 0,               // Phase 4: the target over the sign's row on days 0..targetShiftToDay (setTargetShift)
    targetShiftToDay: 3,
    fanStages: null,               // Phase 3: { stages: [{ overC, fans }], padOverC } or null (setFanStages)
    heatTerms: null,               // Phase 3: the last level-climate step's terms, °C/h (heatBudget)
    // Phase 2 (see the contract at the top)
    ventTimer: null,               // { fans, onSec, cycleSec } or null (manual fans only)
    ventDuty: 0,
    lightProgram: { darkStart: 2, darkHours: 1, dimmer: 1 },
    lightLevel: 1,
    weatherEvents: [],
    slabTemp: 27,
    airflowM3h: AIR.infiltrationM3h, // fresh air through the house (infiltration + fans), m3/h
    litterDepthCm: 5,
    levelClimate: false,           // Level 1 climate (slab, timer, humidity balance) instead of Phase 1's
    fansManual: 0,                 // fans switched on by hand (setFans)
    fanMean: 0,                    // mean running fans (manual + timer x duty)
    brooderOut: [],                // HEATERS indices that are out
    flockHeatPerH: 0,              // set by the farm (level mode)
    vapourGh: 0,                   // set by the farm (level mode): breath, g/h
    dryPotentialGh: 0,             // set by the farm: litter drying at 0 % RH, g/h
  };
}

// Calendar day number (MIN_DAY..env.maxDay). Robust to float drift in `hour`.
function dayNumberOf(env) {
  return Math.max(MIN_DAY, Math.min(env.maxDay ?? MAX_DAY, Math.round(env.day - env.hour / 24)));
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
      if (this.levelClimate && this.brooderOut.length) t += this.outAirDev(x, z);
      const wallDist = Math.min(z - BIRD_BOUNDS.zMin, BIRD_BOUNDS.zMax - z);
      if (wallDist < 1.5) t -= 1.0 * (1 - wallDist / 1.5);
      const fans = this.levelClimate ? this.fansEffective : this.fansOn; // tunnel air: pad (west) to fans (east)
      if (fans > 0) {
        // air warms as it travels from the pad (west) to the fans (east)
        const along = (x - BIRD_BOUNDS.xMin) / (BIRD_BOUNDS.xMax - BIRD_BOUNDS.xMin);
        t += (along - 0.5) * 1.5 * (fans / FAN_COUNT);
      }
      return t;
    },
    // Signed difference between what a bird feels at (x, z) and the target for its age.
    comfort(x, z) { return this.localTemp(x, z) - this.targetTemp; },
    // Level only: how much cooler (negative) the air at (x, z) is because of brooders that are out.
    outAirDev(x, z) {
      let d = 0;
      for (const i of this.brooderOut) {
        const h = HEATERS[i];
        if (!h) continue;
        d -= OUT_AIR.c * this.heaterLevel * (Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * OUT_AIR.sigma ** 2)) - OUT_MEAN[i]);
      }
      return d;
    },
    // Radiant part of localTemp at floor point (x, z): °C added by the running brooders
    // (Gaussian, sigma 1.6 m, up to +7 °C at full glow). 0 when the brooders are cold.
    brooderHeat(x, z) {
      if (this.heaterLevel <= 0.01) return 0;
      let r = 0;
      const out = this.brooderOut;
      for (let i = 0; i < HEATERS.length; i++) {
        if (out.length && out.includes(i)) continue; // a brooder whose flame is out gives no radiant
        const h = HEATERS[i], dx = x - h.x, dz = z - h.z;
        r += Math.exp(-(dx * dx + dz * dz) / (2 * 1.6 * 1.6));
      }
      return 7 * this.heaterLevel * Math.min(1, r);
    },

    // setDay picks the calendar day (whole number, 0..42) and keeps the time of day.
    setDay(d) { const n = Math.max(MIN_DAY, Math.min(this.maxDay ?? MAX_DAY, Math.floor(d))); this.day = n + this.hour / 24; derive(this); emit('day'); },
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
    setFans(n) { this.fansOn = this.fansManual = Math.max(0, Math.min(FAN_COUNT, Math.round(n))); derive(this); emit('controls'); },
    setPad(on) { this.padOn = !!on; emit('controls'); },
    forceHouseTemp(t) { this.forcedHouseTemp = t == null ? null : t; if (t != null) this.houseTemp = t; derive(this); emit('controls'); },
    skipHours(h) {
      const d0 = dayNumberOf(this);
      stepGame(this, h * HOUR, true);
      // land on a whole minute: float drift (05:59.99999) must not make the next jump to 06:00 a no-op
      let n = dayNumberOf(this), hr = Math.round(this.hour * 60) / 60;
      if (hr >= 24) { hr -= 24; n = Math.min(this.maxDay ?? MAX_DAY, n + 1); }
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

    // ---- Phase 2 contract (see the top of the file) ----
    addStepper(fn) { steppers.push(fn); return () => { const i = steppers.indexOf(fn); if (i >= 0) steppers.splice(i, 1); }; },
    setVentTimer(t) {
      this.ventTimer = t && t.fans > 0 && t.cycleSec > 0 ? { fans: Math.min(FAN_COUNT, Math.round(t.fans)), onSec: Math.max(0, Math.min(t.cycleSec, t.onSec)), cycleSec: t.cycleSec } : null;
      this.ventDuty = this.ventTimer ? this.ventTimer.onSec / this.ventTimer.cycleSec : 0;
      derive(this);
      emit('controls');
    },
    setLightProgram(p) { this.lightProgram = { ...this.lightProgram, ...p }; derive(this); emit('controls'); },
    addWeatherEvent(ev) { this.weatherEvents = this.weatherEvents.filter((e) => e.id !== ev.id); this.weatherEvents.push({ ...ev }); derive(this); },
    clearWeatherEvents() { this.weatherEvents = []; derive(this); },
    setLevelClimate(on) {
      this.levelClimate = !!on;
      if (!on) this.fansOn = this.fansManual; // the timer fans stop showing
      derive(this); emit('controls');
    },
    setBrooderOut(list) { this.brooderOut = (list || []).slice(); emit('controls'); },
    // Phase 3 contract (see the top of the file)
    setMaxDay(n) { this.maxDay = Math.max(MAX_DAY, Math.min(99, Math.round(n))); },
    setBroodCurtain(closed) { this.curtainForced = closed == null ? null : !!closed; derive(this); emit('controls'); },
    setCycleClimate(on) { this.cycleClimate = !!on; derive(this); emit('weather'); },
    setFansBroken(list) { this.fansBroken = (list || []).filter((i) => i >= 0 && i < FAN_COUNT); derive(this); emit('controls'); },
    wetBulb() { return wetBulbOf(this.outsideTemp, this.outsideRH); },
    setBroodersUp(on) { this.broodersUp = !!on; thermostat(this); if (this.broodersUp) this.heaterLevel = 0; derive(this); emit('controls'); },
    // Phase 4 contract (see the top of the file)
    setWindChillP4(on) { this.windChillP4 = !!on; derive(this); },
    setPower(on) { const was = this.powerOn; this.powerOn = !!on; thermostat(this); if (!this.powerOn) this.heaterLevel = 0; derive(this); if (was !== this.powerOn) emit('controls'); },
    setTargetShift(c, toDay = 3) { this.targetShiftC = Number.isFinite(c) ? c : 0; this.targetShiftToDay = Number.isFinite(toDay) ? toDay : 3; derive(this); },
    setFanStages(t) {
      const stages = t && Array.isArray(t.stages) ? t.stages.filter((x) => Number.isFinite(x.overC) && Number.isFinite(x.fans))
        .map((x) => ({ overC: x.overC, fans: Math.max(0, Math.min(FAN_COUNT, Math.round(x.fans))) })).sort((a, b) => a.overC - b.overC) : null;
      this.fanStages = stages && stages.length ? { stages, padOverC: Number.isFinite(t.padOverC) ? t.padOverC : null } : null;
      if (this.fanStages) applyFanStages(this);
      emit('controls');
    },
    heatBudget() {
      const h = this.heatTerms || { wallsCh: 0, airCh: 0, brooderCh: 0, birdsCh: 0, sunCh: 0, slabCh: 0 };
      const r = (v) => Math.round(v * 100) / 100;
      return { wallsCh: r(h.wallsCh), airCh: r(h.airCh), brooderCh: r(h.brooderCh), birdsCh: r(h.birdsCh), sunCh: r(h.sunCh), slabCh: r(h.slabCh) };
    },
    litterDepthAt: null,           // (x, z) -> cm, set by the farm in a level
    // Litter surface temperature (PHASE2.md §6.2): the slab under it plus a share k of the air and
    // brooder radiant above it, k = 0.1 + 0.02 x depth cm (model). Outside a level: the felt air.
    floorTemp(x, z) {
      if (!this.levelClimate) return this.houseTemp + this.brooderHeat(x, z) * 0.6;
      const depth = this.litterDepthAt ? this.litterDepthAt(x, z) : this.litterDepthCm;
      const k = SLAB.kBare + SLAB.kPerCm * depth;
      return this.slabTemp + k * (this.houseTemp + this.brooderHeat(x, z) - this.slabTemp);
    },

    on(name, fn) { (listeners[name] ||= []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; },
  };

  const listeners = {};
  const steppers = [];
  env._steppers = steppers; // stepGame runs them
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

// Weather events (cold night, warm afternoon): °C taken off the outside air now, 2 h ramps; an
// event may also carry sun on the roof (heatPerH, °C per hour into the house air, same ramps).
function weatherRamp(env, ev) {
  if (!(env.day > ev.fromDay && env.day < ev.toDay)) return 0;
  return Math.min(1, (env.day - ev.fromDay) / RAMP_DAYS, (ev.toDay - env.day) / RAMP_DAYS);
}
function weatherDrop(env) {
  let d = 0;
  for (const ev of env.weatherEvents) d += ev.outsideDrop * weatherRamp(env, ev);
  return d;
}
function weatherHeat(env) {
  let q = 0;
  for (const ev of env.weatherEvents) if (ev.heatPerH) q += ev.heatPerH * weatherRamp(env, ev);
  return q;
}

function derive(env) {
  env.outsideTemp = outsideTempAt(env.weather, env.hour);
  env.sunHeatPerH = 0;
  if (env.weatherEvents.length) { env.outsideTemp -= weatherDrop(env); env.sunHeatPerH = weatherHeat(env); }
  env.outsideRH = WEATHER[env.weather].rh;
  if (env.cycleClimate) {
    // Phase 3: the day's water content stays, the RH follows the temperature; an event's rh overrides it
    let rh = Math.max(20, Math.min(100, (100 * (OUTSIDE_WATER_GM3[env.weather] ?? 18)) / absHumSat(env.outsideTemp)));
    for (const ev of env.weatherEvents) {
      if (Number.isFinite(ev.rh)) rh += (ev.rh - rh) * weatherRamp(env, ev);
      if (Number.isFinite(ev.rhDrop)) rh = Math.max(15, rh - ev.rhDrop * weatherRamp(env, ev));
    }
    env.outsideRH = rh;
  }
  // The target follows the whole flock day (the brooder sign's table): day 1 is 34 °C all day.
  const dn = dayNumberOf(env);
  env.targetTemp = targetTempAt(dn) + (env.targetShiftC && dn >= 0 && dn <= env.targetShiftToDay ? env.targetShiftC : 0);
  env.bodyWeight = weightAt(env.day);
  env.broodCurtain = env.curtainForced != null ? env.curtainForced : env.day < HOUSE.broodUntilDay;
  if (env.levelClimate) {
    // Level: manual fans plus the minimum ventilation timer. Air, heat and wind chill use the mean;
    // fansOn shows the timer fans during the on-part of each cycle (phase from the game clock).
    // Phase 3: a broken fan inside the first fansManual shows its lamp (fansOn) but moves no air
    const t = env.ventTimer, broken = env.fansBroken.length ? env.fansBroken.filter((i) => i < env.fansManual).length : 0;
    env.fansEffective = Math.max(0, Math.min(FAN_COUNT, env.fansManual) - broken);
    env.fanMean = Math.min(FAN_COUNT, env.fansEffective + (t ? t.fans * env.ventDuty : 0));
    const onPart = !!t && ((env.hour * HOUR) % t.cycleSec) < t.onSec;
    env.fansOn = Math.min(FAN_COUNT, env.fansManual + (onPart ? t.fans : 0));
    const timerMean = env.fanMean - env.fansEffective;
    env.airSpeed = (env.fansEffective + timerMean * INLET_SPEED_SHARE) * (2.5 / FAN_COUNT);
    // Phase 4: no power, no fans (the settings stay: fansManual, ventTimer)
    if (env.powerOn === false) { env.fansEffective = 0; env.fanMean = 0; env.fansOn = 0; env.airSpeed = 0; }
  } else {
    env.fanMean = env.fansOn;
    env.fansEffective = env.fansOn;
    env.airSpeed = env.fansOn * (2.5 / FAN_COUNT);
  }
  env.airflowM3h = AIR.infiltrationM3h + env.fanMean * EQUIP.fanM3h;
  // Wind chill felt by the birds (general practice): young birds feel moving air more.
  // Phase 4 (from Week 2, env.windChillP4): by age, speed and the house air (farm-tuning.js)
  if (env.windChillP4 && env.levelClimate) env.windChill = windChillP4(env.airSpeed, env.day - PLACEMENT_DAY, env.houseTemp);
  else {
    const ageK = 3.0 - 1.6 * Math.max(0, Math.min(1, (env.day - 7) / 28));
    env.windChill = env.airSpeed * ageK;
  }
  env.feelsLike = env.houseTemp - env.windChill;
  // Light program: 23 hours of light, dark 02:00–03:00 (week 1 guide) unless the farm sets another
  const lp = env.lightProgram || { darkStart: 2, darkHours: 1, dimmer: 1 };
  const intoDark = (((env.hour - lp.darkStart) % 24) + 24) % 24;
  env.lightsOn = env.powerOn !== false && !(lp.darkHours > 0 && intoDark < lp.darkHours);
  env.lightLevel = env.lightsOn ? (lp.dimmer ?? 1) : 0;
}

// Brooder thermostat, measured on the house air: proportional output across HEAT_BAND.
// Phase 3: brooders winched up (env.broodersUp) ask for nothing.
function thermostat(env) {
  const d = env.broodersUp || env.powerOn === false ? 0 : (env.heaterSetpoint + HEAT_OFF_ABOVE - env.houseTemp) / HEAT_BAND;
  env.heaterDemand = d < 0 ? 0 : d > 1 ? 1 : d;
  env.heatersOn = env.heaterDemand > 0.02;
}

// Phase 3: the fan panel's stage table sets the tunnel fans (and the pad) from the house over its target.
function applyFanStages(env) {
  const t = env.fanStages;
  if (!t) return;
  const over = env.houseTemp - env.targetTemp;
  let n = 0;
  for (const s of t.stages) if (over >= s.overC) n = Math.max(n, s.fans);
  if (n !== env.fansManual) { env.fansManual = n; env.fansOn = n; derive(env); }
  const pad = t.padOverC != null && over >= t.padOverC;
  if (pad !== env.padOn) env.padOn = pad;
}

// Saturation water content of air, g/m3, at t °C (polynomial fit, good for 0-45 °C).
export function absHumSat(t) { return 5.018 + 0.32321 * t + 8.1847e-3 * t * t + 3.1243e-4 * t * t * t; }
// Wet-bulb °C of air at t °C and rh %: the temperature where evaporating water (0.49 g/m3 per °C of
// cooling, the pad's figure) saturates the air. Bisection on absHumSat, so a pad at 100 % efficiency
// would give exactly 100 % RH.
export function wetBulbOf(t, rh) {
  const x = (absHumSat(t) * Math.max(0, Math.min(100, rh))) / 100;
  let lo = Math.min(t, 0), hi = t;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (absHumSat(m) - x - 0.49 * (t - m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

// Level 1 climate step (PHASE2.md §6.2): one airflow figure for heat, humidity (and, in the farm,
// ammonia); brooders with some out; the concrete slab as a slow heat store under the litter; the
// flock's heat and vapour from the farm model.
function levelClimate(env, hrs) {
  // the pad cools only the air the tunnel fans pull through it (the timer air comes in at the side
  // inlets): the mixed inlet air is cooler by padDrop x the tunnel share of the air
  const tunnelShare = env.fanMean > 0 ? Math.min(1, env.fansEffective / env.fanMean) : 0;
  // Phase 2: about 1 °C per 5 % of humidity the air can still take up (Broiler Ventilation), 85 % of it.
  // Phase 3 (cycle climate): PAD_EFF of the way to the outside wet bulb, on the share of the pad that is wet.
  const padDrop = !env.padOn || env.powerOn === false ? 0 : env.cycleClimate
    ? PAD_EFF * Math.max(0, env.outsideTemp - wetBulbOf(env.outsideTemp, env.outsideRH)) * tunnelShare * Math.max(0, Math.min(1, env.padWorking))
    : Math.min(9, (100 - env.outsideRH) / 5) * 0.85 * tunnelShare;
  const inlet = env.outsideTemp - padDrop;
  const lit = HEATERS.length - env.brooderOut.length;
  const heat = (HEAT_RATE * env.heaterLevel * lit) / HEATERS.length + (env.sunHeatPerH || 0);
  const exchange = AIR.wallLossPerH + env.airflowM3h / AIR.thermalM3;
  const sink = SLAB.sinkPerH * (env.houseTemp - env.slabTemp);
  const dT = heat + env.flockHeatPerH - exchange * (env.houseTemp - inlet) - sink;
  const ht = env.heatTerms || (env.heatTerms = {});
  ht.brooderCh = heat - (env.sunHeatPerH || 0); ht.sunCh = env.sunHeatPerH || 0; ht.birdsCh = env.flockHeatPerH;
  ht.airCh = -(env.airflowM3h / AIR.thermalM3) * (env.houseTemp - inlet); ht.wallsCh = -AIR.wallLossPerH * (env.houseTemp - inlet); ht.slabCh = -sink;
  env.houseTemp += dT * hrs;
  env.slabTemp += ((env.houseTemp + SLAB.brooderC * env.heaterLevel - env.slabTemp) / SLAB.tauH) * hrs;
  // Absolute-humidity balance: inlet air (outside, plus what the pad adds: about 0.49 g/m3 per °C
  // of evaporative cooling) plus the flock's vapour spread through the air that passes. Breath is
  // env.vapourGh; the litter dries in proportion to (1 - RH) (env.dryPotentialGh = drying at 0 %
  // RH), solved together with the balance so humidity and drying agree in every step.
  const q = env.airflowM3h, d0 = env.dryPotentialGh || 0, xs = absHumSat(env.houseTemp);
  const x0 = (absHumSat(env.outsideTemp) * env.outsideRH) / 100 + 0.49 * padDrop;
  env.houseRH = Math.max(20, Math.min(98, (100 * (x0 + (env.vapourGh + d0) / q)) / (xs + d0 / q)));
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
    if (env.hour >= 24) { env.hour -= 24; n = Math.min(env.maxDay ?? MAX_DAY, n + 1); } // after the last day the clock keeps it
    env.day = n + env.hour / 24;
    derive(env);

    thermostat(env);
    const k = 1 - Math.exp(-hrs * 12); // output (and glow) follows the valve within a few game minutes
    env.heaterLevel += (env.heaterDemand - env.heaterLevel) * (fast ? 1 : k);

    if (env.forcedHouseTemp != null) {
      env.houseTemp = env.forcedHouseTemp;
    } else if (env.levelClimate) {
      if (env.fanStages) applyFanStages(env);
      levelClimate(env, hrs);
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
    const st = env._steppers;
    if (st) for (let i = 0; i < st.length; i++) st[i](env, s, fast);
  }
}
