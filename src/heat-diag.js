// The house's heat balance in plain words (the farmer's night report after Phase 5): what takes the heat out of the house
// air and what puts it back, where the house heads in the hours ahead, and the one place to look. Pure logic (node and
// the browser). Read by the night check before a skip and the skip's stops (night-check.js), the flock watch's cold and
// heat causes (flock-watch.js), the climate controller's notes (ui-climate.js) and the morning summary. Owner: integrator.
//
// The model is sim.js levelClimate's own equation solved for its steady state (the house air settles within 2-3 farm
// hours: 1 / (walls + air + slab) is under 2 h even for a closed house):
//   0 = brooders(T) + birds + sun - (walls + air / thermalM3) x (T - inlet) - slab x (T - slabC)
//   brooders(T) = 6.5 °C/h x lit / 8 x clamp((thermostat + 0.3 - T) / 1.5)          (sim.js HEAT)
// Every figure is the model's (env.heatTerms, env.airflowM3h, the vent sign's table, the brooder sign's row); the words
// name the sign the farmer reads and the control he sets.
import { AIR, EQUIP, HEATERS, OUTSIDE_WATER_GM3, PAD_EFF, WEATHER, PLACEMENT_DAY, FAN_COUNT } from './config.js';
import { HEAT, SLAB, absHumSat, wetBulbOf } from './sim.js';
import { ventNeed, inletAirM3h, onSecFor, VENT_BAND } from './job-figures.js';
import { windChillP4 } from './farm-tuning.js';

/** Model values of the diagnosis (none is a sign fact). */
export const DIAG = {
  youngAge: 21,     // the young-bird weeks (the brooders down, under about 3 weeks): the brooder sign's row is the target
  fullAt: 0.95,     // brooder output at or over this share reads "at full"
  coldC: 2,         // the night check: the house heads this far or more under the row
  hotC: 2.5,        // ... this far or more over the row with the thermostat over it
  spOverC: 1.5,     // a thermostat this far over the row is named (a bad batch's +1 °C row is its own row)
  spUnderC: 0.75,   // ... this far under it
  airOver: VENT_BAND[1], airUnder: 0.5,   // the timer over 130 % of the table; under half of it (no air for the damp)
  gainC: 0.5,       // a fix that raises the house (or what the birds feel) less than this is not named
};
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const int = (v) => Math.round(v).toLocaleString('en');
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
export const fmtC = (v) => `${one(v)} °C`;
/** A sign's figure: whole degrees without the decimal ("34 °C", "33.5 °C"). */
export const rowC = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? `${Math.round(v)} °C` : `${one(v)} °C`);
const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
const times = (x) => (x >= 9.5 ? `about ${int(x)} times` : x >= 1.95 ? `about ${Math.round(x * 2) / 2} times` : `${int(x * 100)} % of`);

/** The brooder sign's row of today (half degrees, the bad batch's warmer row included). */
export const rowOf = (env) => Math.round((env.targetTemp ?? 34) * 2) / 2;
export const ageOf = (env, farm) => (Number.isFinite(farm?.age) ? farm.age : Math.max(0, env.day - PLACEMENT_DAY));
/** The young-bird weeks: under about 3 weeks with the brooders down. */
export const youngOf = (env, farm) => ageOf(env, farm) < DIAG.youngAge && !env.broodersUp;
export const birdsWord = (env, farm) => (ageOf(env, farm) < 8 ? 'chicks' : 'birds');
/** "the brooder sign gives 34 °C for day 1" (the bad batch: "…, +1 °C for this batch: 35 °C"). */
export function rowWords(env) {
  const r = rowOf(env), d = Math.max(0, env.dayNumber);
  const shift = env.targetShiftC && d <= (env.targetShiftToDay ?? 3) ? env.targetShiftC : 0;
  return shift ? `the brooder sign gives ${rowC(r - shift)} for day ${d}, +${shift} °C for this batch: ${rowC(r)}` : `the brooder sign gives ${rowC(r)} for day ${d}`;
}
export const timerWords = (t) => (t && t.fans > 0 && t.onSec > 0 ? `${plural(t.fans, 'fan')}, ${t.onSec} s in every ${t.cycleSec} s` : 'off');

/** The air going through the house now: the tunnel fans by hand, the timer, and the vent sign's need for the flock. */
export function airOf(env, farm) {
  const tunnelN = Math.max(0, (env.levelClimate ? env.fansEffective : env.fansOn) || 0);
  const t = env.ventTimer && env.ventTimer.fans > 0 && env.ventTimer.onSec > 0 ? env.ventTimer : null;
  const tunnelM3h = tunnelN * EQUIP.fanM3h, timerM3h = inletAirM3h(env, t);
  const v = ventNeed(env, farm), need = v.need > 0 ? v.need : 0, total = tunnelM3h + timerM3h;
  return { tunnelN, tunnelM3h, timer: t, timerM3h, need, birds: v.birds, weightG: v.weightG, total,
    share: need ? total / need : 0, timerShare: need ? timerM3h / need : 0, stages: !!env.fanStages, power: env.powerOn !== false };
}

/** °C the pad takes off the inlet air at outside `outC` (sim.js levelClimate: the tunnel share of the air only). */
function padDropAt(env, outC, airM3h, tunnelN) {
  if (!env.padOn || env.powerOn === false || !(tunnelN > 0)) return 0;
  const fanAir = Math.max(1e-6, (airM3h - AIR.infiltrationM3h) / EQUIP.fanM3h), share = Math.min(1, tunnelN / fanAir);
  if (env.cycleClimate) {
    const rh = clamp((100 * (OUTSIDE_WATER_GM3[env.weather] ?? 18)) / absHumSat(outC), 20, 100);
    return PAD_EFF * Math.max(0, outC - wetBulbOf(outC, rh)) * share * clamp(env.padWorking ?? 1, 0, 1);
  }
  return Math.min(9, (100 - (WEATHER[env.weather]?.rh ?? 60)) / 5) * 0.85 * share;
}

/**
 * Where the house air settles with the settings now (or the ones given) at outside `outC`:
 * { houseC, output (0..1 of the lit brooders), full (share of all eight), tin (inlet °C), k, needFor(h) (the output, as a
 * share of all eight brooders at full, that holds the house at h °C) }.
 */
export function settleAt(env, o = {}) {
  const outC = o.outC ?? env.outsideTemp, sunCh = o.sunCh ?? 0, sp = o.sp ?? env.heaterSetpoint;
  const tunnelN = o.tunnelN ?? (env.levelClimate ? env.fansEffective : env.fansOn) ?? 0;
  const airM3h = o.airM3h ?? env.airflowM3h, lit = o.lit ?? HEATERS.length - (env.brooderOut?.length || 0);
  const slabC = o.slabC ?? env.slabTemp, birdsCh = o.birdsCh ?? (env.flockHeatPerH || 0);
  const full = env.powerOn !== false && !env.broodersUp ? (HEAT.rate * lit) / HEATERS.length : 0;
  const k = AIR.wallLossPerH + airM3h / AIR.thermalM3, s = SLAB.sinkPerH;
  const tin = outC - (o.padOn === false ? 0 : padDropAt(env, outC, airM3h, tunnelN));
  const net = (T) => full * clamp((sp + HEAT.offAbove - T) / HEAT.band, 0, 1) + birdsCh + sunCh - k * (T - tin) - s * (T - slabC);
  let lo = -20, hi = 60;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (net(m) > 0) lo = m; else hi = m; }
  const T = (lo + hi) / 2;
  return { houseC: T, output: full > 0 ? clamp((sp + HEAT.offAbove - T) / HEAT.band, 0, 1) : 0, full: full / HEAT.rate, tin, k,
    needFor: (h) => (k * (h - tin) + s * (h - slabC) - birdsCh - sunCh) / HEAT.rate };
}

/** °C the moving air takes off what the birds feel with `tunnelN` tunnel fans (sim.js derive: the same formulas). */
export function chillOf(env, farm, houseC, tunnelN = env.fansEffective ?? 0) {
  const timerMean = env.ventTimer ? env.ventTimer.fans * (env.ventDuty || 0) * (env.inletShare ?? 1) : 0;
  const speed = env.powerOn === false ? 0 : (tunnelN + timerMean * 0.1) * (2.5 / FAN_COUNT);
  const age = ageOf(env, farm);
  if (env.windChillP4 && env.levelClimate) return windChillP4(speed, age, houseC);
  return speed * (3.0 - 1.6 * clamp((age + PLACEMENT_DAY - 7) / 28, 0, 1));
}

/** The weather event sun on the roof at time t (°C/h; sim.js weatherHeat with its 2 h ramps). */
export function sunAt(env, t) {
  let q = 0;
  for (const ev of env.weatherEvents || []) {
    if (!ev.heatPerH || !(t > ev.fromDay && t < ev.toDay)) continue;
    q += ev.heatPerH * Math.min(1, (t - ev.fromDay) / (2 / 24), (ev.toDay - t) / (2 / 24));
  }
  return q;
}
/** The next time of day `h` after `day` (env.day units). */
export function nextAt(day, h) { let t = Math.floor(day + 1e-9) + h / 24; if (t <= day + 1e-9) t += 1; return t; }

/** The hours from now to `toDay` (default the next 07:00), each settled: the coldest and the warmest house. */
export function hoursAhead(env, { toDay, o = {} } = {}) {
  const to = toDay ?? nextAt(env.day, 7), out = [];
  for (let t = env.day; t <= to + 1e-9; t += 1 / 24) {
    const outC = env.outsideAt ? env.outsideAt(t) : env.outsideTemp, sunCh = sunAt(env, t);
    out.push({ t, outC, sunCh, ...settleAt(env, { ...o, outC, sunCh }) });
  }
  let cold = out[0], warm = out[0];
  for (const x of out) { if (x.houseC < cold.houseC) cold = x; if (x.houseC > warm.houseC) warm = x; }
  return { hours: out, cold, warm, to };
}

/**
 * What keeps the house (or what the birds feel) under the row at the hour `at` ({ outC, sunCh }; default now): every
 * change the farmer can make, with the house it would settle at, the biggest first.
 * -> { base, felt, row, air, fixes: [{ kind, T, felt, gain }] }   kind: air | brooderOut | pad | thermostat
 */
export function coldFixes(env, farm, at = {}) {
  const a = airOf(env, farm), row = rowOf(env), base = settleAt(env, at);
  const feel = (T, n) => T - chillOf(env, farm, T, n);
  const felt = feel(base.houseC, a.tunnelN), fixes = [];
  const add = (kind, s, n = a.tunnelN) => { const f = feel(s.houseC, n); fixes.push({ kind, T: s.houseC, felt: f, gain: f - felt }); };
  const tunnelOn = a.tunnelN > 0 && !a.stages, timerOver = a.need > 0 && a.timerShare > DIAG.airOver;
  if (tunnelOn || timerOver) {
    const airTo = AIR.infiltrationM3h + (timerOver ? a.need : a.timerM3h) + (tunnelOn ? 0 : a.tunnelM3h);
    add('air', settleAt(env, { ...at, airM3h: airTo, tunnelN: tunnelOn ? 0 : a.tunnelN }), tunnelOn ? 0 : a.tunnelN);
  }
  if (env.brooderOut?.length) add('brooderOut', settleAt(env, { ...at, lit: HEATERS.length }));
  if (env.padOn && a.tunnelN > 0) add('pad', settleAt(env, { ...at, padOn: false }));
  if (env.heaterSetpoint < row - DIAG.spUnderC && !env.broodersUp) add('thermostat', settleAt(env, { ...at, sp: row }));
  fixes.sort((x, y) => y.gain - x.gain);
  return { base, felt, row, air: a, fixes: fixes.filter((f) => f.gain >= DIAG.gainC) };
}

const CTRL = 'the climate controller';
/** One cause in the flock watch's shape: { kind, why, sign, signName, place, check, fix: { panel, tab } | null }. */
export function causeWords(kind, env, farm, at = {}) {
  const a = airOf(env, farm), young = youngOf(env, farm), age = ageOf(env, farm), b = birdsWord(env, farm);
  const sp = env.heaterSetpoint, row = rowOf(env), need = `${int(a.need)} m³/h that ${int(a.birds)} ${b} need (the vent sign’s table)`;
  const fanSign = age < 8 ? { sign: 'sign-vent', signName: 'the minimum ventilation sign (its tunnel fans line)' } : { sign: 'sign-heat', signName: 'the heat and tunnel fans sign (its young-birds line)' };
  switch (kind) {
    case 'air': {
      if (a.tunnelN > 0 && !a.stages) {
        const extra = a.timerShare > DIAG.airOver ? `; the timer adds ${int(a.timerM3h)} m³/h (${timerWords(a.timer)})` : `; the timer alone gives ${int(a.timerM3h)} m³/h`;
        return { kind, ...(young ? fanSign : { sign: 'sign-heat', signName: 'the heat and tunnel fans sign' }), place: young ? 'controller' : 'fan-panel', fix: { panel: 'controller', tab: 'vent' },
          why: `${plural(a.tunnelN, 'tunnel fan')} run${a.tunnelN === 1 ? 's' : ''} all the time: ${int(a.tunnelM3h)} m³/h along the floor, ${times(a.total / Math.max(1, a.need))} the ${need}${extra}`,
          check: young ? `the Tunnel fans row on ${CTRL}’s Ventilation tab (switch them off: the timer gives the ${b} their air)` : `the tunnel fans at the fan panel or on ${CTRL}’s Ventilation tab (fewer fans while the night is cool)` };
      }
      const t = a.timer, set = t ? `${onSecFor(a.need, t.fans, t.cycleSec)} s on in every ${t.cycleSec} s with ${plural(t.fans, 'fan')}` : '';
      return { kind, sign: 'sign-vent', signName: 'the minimum ventilation sign', place: 'controller', fix: { panel: 'controller', tab: 'vent' },
        why: `the timer runs ${timerWords(t)}: ${int(a.timerM3h)} m³/h, ${times(a.timerShare)} the ${need}`,
        check: `the minimum ventilation timer on ${CTRL}’s Ventilation tab (back to the vent sign’s setting${set ? `: ${set}` : ''})` };
    }
    case 'brooderOut': {
      const n = env.brooderOut?.length || 0;
      return { kind, sign: 'sign-brooder', signName: 'the brooder sign (every brooder burning)', place: 'brooder', fix: null,
        why: `${plural(n, 'brooder')} ${n === 1 ? 'is' : 'are'} out (no flame): the house gets ${int((100 * (HEATERS.length - n)) / HEATERS.length)} % of the brooders’ heat`,
        check: 'each brooder’s flame on the brooding floor (relight the dark one at the brooder)' };
    }
    case 'pad': return { kind, sign: young ? 'sign-vent' : 'sign-heat', signName: young ? 'the minimum ventilation sign (its pad line)' : 'the heat and tunnel fans sign', place: 'controller', fix: { panel: 'controller', tab: 'vent' },
      why: 'the pad pump is on: the tunnel air comes in through the wet pad, cooler than the air outside', check: `the Cooling pad key on ${CTRL}’s Ventilation tab (off while the night is cool)` };
    case 'thermostat': return { kind, sign: 'sign-brooder', signName: 'the brooder sign', place: 'controller', fix: { panel: 'controller', tab: 'temp' },
      why: `the thermostat is at ${rowC(sp)}, ${one(row - sp)} °C under the row (${rowWords(env)})`, check: `the brooder thermostat on ${CTRL}’s Temperature tab (up to the brooder sign’s row)` };
    case 'thermostatHot': return { kind, sign: 'sign-brooder', signName: 'the brooder sign', place: 'controller', fix: { panel: 'controller', tab: 'temp' },
      why: `the thermostat is at ${rowC(sp)}, ${one(sp - row)} °C over the row (${rowWords(env)}): the brooders keep heating the house up to it`,
      check: `the brooder thermostat on ${CTRL}’s Temperature tab (back to the brooder sign’s row)` };
    case 'warmAir': return { kind, sign: 'sign-vent', signName: 'the minimum ventilation sign (its hot-afternoon line)', place: 'controller', fix: { panel: 'controller', tab: 'vent' },
      why: `the brooders are off and ${sunAt(env, env.day) > 0 ? 'the sun on the roof and the warm air hold' : 'the warm air holds'} the house over the row (${rowWords(env)})`,
      check: `the minimum ventilation timer on ${CTRL}’s Ventilation tab (more fan time while it is hot, back to the table when it cools)` };
    case 'floor': return { kind, sign: 'sign-litter', signName: 'the litter sign', place: 'litter', fix: null,
      why: `the house holds near the row (${fmtC(env.houseTemp)}, ${rowWords(env)}) with the brooders not at full, yet the ${b} feel colder: wet or thin litter under them, or a brooder out`,
      check: 'the litter under the chicks (squeeze a handful) and that each brooder burns' };
    case 'power': return { kind, sign: 'sign-power', signName: 'the power cut sign by the generator', place: 'generator', fix: null,
      why: 'the power is off: no brooder lights and no fan runs', check: 'the generator and its transfer switch at the generator house' };
    default: return { kind: 'capacity', sign: 'sign-brooder', signName: 'the brooder sign', place: 'controller', fix: { panel: 'controller', tab: 'temp' },
      why: `the brooders are at full and the night is colder than they can make up for (outside ${fmtC(at.outC ?? env.outsideTemp)})`,
      check: `that every brooder burns, and that the timer gives no more than the vent sign’s air (${int(VENT_BAND[0] * 100)}–${int(VENT_BAND[1] * 100)} % of the table, ${CTRL}’s Ventilation tab)` };
  }
}

/** The main cold cause now (or at `at`): the biggest fix, else the power, else the night beyond the brooders. */
export function coldCause(env, farm, at = {}) {
  if (env.powerOn === false) return causeWords('power', env, farm);
  const f = coldFixes(env, farm, at);
  // a brooder out chills the chicks around it more than the house mean shows (sim.js outAirDev, no radiant there)
  if (f.fixes.length) return causeWords(f.fixes[0].kind, env, farm, at);
  if (env.brooderOut?.length) return causeWords('brooderOut', env, farm, at);
  // the brooders with heat to spare and the house near the row: the cold is at the floor
  if (youngOf(env, farm) && env.heaterLevel < DIAG.fullAt && env.houseTemp >= rowOf(env) - 1.5) return causeWords('floor', env, farm, at);
  return causeWords('capacity', env, farm, at);
}
/** The main heat cause of young birds: the thermostat over the row, else the warm air with the brooders off; null if neither. */
export function hotCause(env, farm) {
  if (!env.broodersUp && env.powerOn !== false && env.heaterSetpoint >= rowOf(env) + DIAG.spOverC) return causeWords('thermostatHot', env, farm);
  return youngOf(env, farm) ? causeWords('warmAir', env, farm) : null;
}
