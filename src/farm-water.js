// Farm model, water (PHASE2.md §6.4): drinker lines (pressure, height, flow, access), the main
// filter, flushing, the leak and the water meter with its 24 h memory. Pure logic, package "sim".
import { DRINKER_LINES_Z, EQUIP, LEVEL1, flowTargetAt, nippleHeightCmAt } from './config.js';

// model constants (tuning values, never shown on a sign)
export const WATER = {
  startHeightCm: 50,      // lines winched up on the prep day
  startPressureCm: 10,
  flowPerCm: 2, flowBase: 4,           // f = (2 x pressure cm + 4) x filterFactor, ml/min per nipple
  accessFull: 0.75, accessExp: 0.88,     // a_i = min(1, (f / need) / 0.8)^0.88 x hf (tuned, see report)
  highPerCm: 0.12, highMin: 0.05,       // nipple above the birds: hf = 1 - 0.12 x cm, >= 0.05
  lowPerCm: 0.03, lowMin: 0.7,          // nipple below the birds: hf = 1 - 0.03 x cm, >= 0.7
  spillBase: 0.02, spillOverflow: 0.7, spillPerCmLow: 0.02,   // spill: 0.7 x the drunk water per unit of flow above 1.25 x need (a jetting nipple)
  wetAbove: 1.5, wetPer: 0.5, wetMin: 0.5, wetUntilAge: 4,  // days 0-3: a nipple jetting > 1.5 x need wets the chicks, they keep off it
  leakLh: 0.5,
  flushMin: 10,                         // minutes until a flushed line runs clear
  flushLPerLine: 28,                    // litres through the meter while a line flushes (10 min)
  ratioBase: 1.75, ratioPerC: 0.03,     // water drunk = feed x (1.75 + 0.03 x max(0, house - 30)) L/kg
  filterInBar: 2.5,
};

export function createWater() {
  return {
    lines: DRINKER_LINES_Z.map(() => ({ heightCm: WATER.startHeightCm, pressureCm: WATER.startPressureCm,
      flowMlMin: 0, access: 1, flushing: false, flushClear: 0, blocked: 0, leakX: null })),
    meterL: 0,
    waterTempC: 27,
    flushedAt: null,          // env.day when the last line ran clear
    filterFactor: 1,          // main filter: 1 clean, LEVEL1 flowFactor while clogged
    leak: null,               // { line, x, z, cell } while a nipple leaks
    access: 1,                // flock water access A (0..1)
    quality: 1,               // q: 1 when the lines ran clear within 24 h before the truck, else 0.85
    drunkTodayL: 0,
    hist: [],                 // meter odometer at each whole game hour since the level start
    histStart: 0,             // hour index of hist[0]
  };
}

/** Flow per nipple of line i now (ml/min). Phase 4: x the tank's pressure (water.supplyK, the water condition) and x the
 *  line's own nipples (l.flowK: iron); both undefined in a normal run. */
export function lineFlow(water, i) {
  const l = water.lines[i];
  const f = (WATER.flowPerCm * l.pressureCm + WATER.flowBase) * water.filterFactor;
  return water.supplyK == null && l.flowK == null ? f : f * (water.supplyK ?? 1) * (l.flowK ?? 1);
}
/** Phase 4 (the hot season): the birds drink x (1 - 0.015 x (line °C - 30)) over 30 °C (water.lineTempC per line). */
export const lineWaterK = (c) => (c > 30 ? Math.max(0, 1 - 0.015 * (c - 30)) : 1);
export const LINE_WATER_FROM_AGE = 21;

/** Height factor of a line at flock age `age`. */
export function heightFactor(heightCm, age) {
  const d = heightCm - nippleHeightCmAt(Math.max(0, age));
  if (d > 0) return Math.max(WATER.highMin, Math.min(1, 1 - WATER.highPerCm * d));
  return Math.max(WATER.lowMin, Math.min(1, 1 - WATER.lowPerCm * -d));
}

/** Update flows and access (cheap; called every step and before a reading). */
export function updateAccess(water, age) {
  const need = flowTargetAt(Math.max(0, age));
  let sum = 0, max = 0;
  for (let i = 0; i < water.lines.length; i++) {
    const l = water.lines[i];
    l.flowMlMin = lineFlow(water, i);
    const r = l.flowMlMin / need;
    let a = Math.pow(Math.max(0, Math.min(1, r / WATER.accessFull)), WATER.accessExp) * heightFactor(l.heightCm, age);
    if (age < WATER.wetUntilAge && r > WATER.wetAbove) a *= Math.max(WATER.wetMin, Math.min(1, 1 - WATER.wetPer * (r - WATER.wetAbove)));
    // the hot season's warm line water: big birds (from day 21, the flush job's weeks) drink less over 30 °C; chicks and
    // young birds live in 25-34 °C air by design (sim package, PHASE4.md §2.7)
    if (water.lineTempC && age >= LINE_WATER_FROM_AGE) a *= lineWaterK(water.lineTempC[i]);
    l.access = a;
    sum += a; if (a > max) max = a;
  }
  water.access = 0.75 * (sum / water.lines.length) + 0.25 * max;
  return water.access;
}

/** Litres per kg of feed the birds drink at this house temperature. */
export const waterPerKg = (houseTemp) => WATER.ratioBase + WATER.ratioPerC * Math.max(0, houseTemp - 30);

/**
 * Split `drunkL` litres over the lines by their access; returns the spill per line (litres, to the
 * litter under each line) and adds drunk + spill to the meter.
 */
export function drink(water, drunkL, age, spillOut) {
  const need = flowTargetAt(Math.max(0, age));
  let sumA = 0;
  for (const l of water.lines) sumA += l.access;
  let total = drunkL;
  for (let i = 0; i < water.lines.length; i++) {
    const l = water.lines[i];
    const share = sumA > 0 ? l.access / sumA : 1 / water.lines.length;
    const d = drunkL * share;
    const low = Math.max(0, nippleHeightCmAt(Math.max(0, age)) - l.heightCm);
    const s = d * (WATER.spillBase + WATER.spillOverflow * Math.max(0, l.flowMlMin / need - 1.25) + WATER.spillPerCmLow * low);
    spillOut[i] = s;
    total += s;
  }
  water.meterL += total;
  water.drunkTodayL += drunkL;
}

/** Flushing and the leak for one step of `hrs` game hours. Returns the leak litres. */
export function stepLines(water, env, hrs) {
  const flushRate = (WATER.flushLPerLine * 60) / WATER.flushMin; // L/h while a valve is open
  let lastClear = true;
  for (const l of water.lines) {
    if (l.flushing) {
      water.meterL += flushRate * hrs;
      const was = l.flushClear;
      l.flushClear = Math.min(1, l.flushClear + (hrs * 60) / WATER.flushMin);
      if (was < 0.99 && l.flushClear >= 0.99) l.clearAt = env.day;
    }
    if (l.flushClear < 0.99) lastClear = false;
  }
  if (lastClear && water.flushedAt == null) water.flushedAt = Math.max(...water.lines.map((l) => l.clearAt ?? env.day));
  if (!water.leak) return 0;
  const leakL = WATER.leakLh * hrs;
  water.meterL += leakL;
  return leakL;
}

/** Hour index for the meter memory (whole game hours since day -1 00:00). */
const hourIndex = (day) => Math.floor((day + 1) * 24 + 1e-6);

/** Keep the odometer at every whole game hour (called each step). */
export function recordMeter(water, env) {
  const h = hourIndex(env.day);
  if (!water.hist.length) { water.histStart = h; water.hist.push(water.meterL); return; }
  while (water.histStart + water.hist.length <= h) water.hist.push(water.meterL);
}

/** Odometer at env.day-like time t (linear between the hourly marks), or null before the start. */
export function meterAt(water, t, nowDay) {
  if (t >= nowDay) return water.meterL;
  const x = (t + 1) * 24 - water.histStart;
  if (x < 0) return 0; // before the level started the meter stood at 0
  const i = Math.floor(x);
  const a = water.hist[i], b = i + 1 < water.hist.length ? water.hist[i + 1] : water.meterL;
  if (a == null) return null;
  return a + (b - a) * (x - i);
}

/** Pressure gauges on the main filter. */
export function filterGauges(water, rng) {
  const n = () => (rng.next() - 0.5) * 0.1;
  return { inBar: +(WATER.filterInBar + n()).toFixed(2), outBar: +(WATER.filterInBar * water.filterFactor + n()).toFixed(2) };
}

export const clampPressure = (cm) => Math.max(EQUIP.pressureCm[0], Math.min(EQUIP.pressureCm[1], cm));
export const clampHeight = (cm) => Math.max(EQUIP.nippleHeightCm[0], Math.min(EQUIP.nippleHeightCm[1], cm));
export const FILTER_FACTOR = LEVEL1.problems.find((p) => p.id === 'blocked-filter')?.flowFactor ?? 0.5;
