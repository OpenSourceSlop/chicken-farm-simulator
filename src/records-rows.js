// Daily record rows built from the notebook (PHASE2.md §8 "Week"). Package "sim", pure logic.
// A row holds what the farmer measured, counted and set; a reading not taken is null.
import { targetTempAt, weightAt } from './config.js';

/**
 * @typedef {{
 *   day: number, signed: boolean,
 *   alive: number|null, deaths: number|null, culls: number|null, mortalityCumPct: number|null,
 *   feedKg: number|null, feedPerBirdG: number|null,
 *   waterL: number|null, waterPerBirdMl: number|null, waterFeedRatio: number|null,
 *   waterChangePct: number|null,
 *   weightG: number|null, weightSource: 'scale'|'weighed'|null, targetWeightG: number,
 *   weightRatio: number|null, uniformityPct: number|null, fcr: number|null,
 *   litterMoisturePct: number|null, houseMinC: number|null, houseMaxC: number|null, targetC: number,
 *   lightHours: number|null, cropFullPct: number|null, ventTempMeanC: number|null,
 *   chickWeightG: number|null, chickQualityNote: string|null,
 *   looks: string[], skillLines: string[], notes: string[], jobsDone: number, jobsMissed: number,
 *   flowsMlMin: (number|null)[]|null, floorTempMeanC: number|null, cropTally: { full: number, of: number }|null,
 *   settings: object, prepChecks: string[]|null,
 *   // Phase 3 (PHASE3.md §8.1), null when not measured that day:
 *   darkHours: number|null, luxMeasured: number|null, houseRhMin: number|null, houseRhMax: number|null,
 *   airSpeedMs: number|null, fansMax: number|null, padOn: boolean|null, lameCulled: number|null,
 *   feedType: 'starter'|'grower'|'finisher'|null, vaccine: { hours: number }|null, medication: boolean|null,
 *   gasKgUsed: number|null, deadByLook: { back, thin, wingsOut, hunched }|null
 * }} RecordRow   (waterPerBirdMl = litres per 1,000 birds: the same number)
 */

const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

/** Deterministic noise in [-1, 1] for an instrument reading (seed, day): no shared random state. */
function hashNoise(seed, day, salt = 0) {
  let h = (Math.imul(seed | 0, 2654435761) ^ Math.imul(day + 17, 40503) ^ Math.imul(salt + 3, 9973)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
}

/** The settings in force now (what he set): setpoint, timer, light hours, nipple heights, pressures. */
export function settingsNow(farm, env) {
  if (!env) return {};
  const lp = env.lightProgram || {};
  return {
    setpointC: env.heaterSetpoint, ventTimer: env.ventTimer ? { ...env.ventTimer } : null,
    lightHours: lp.darkHours != null ? 24 - lp.darkHours : null, dimmer: lp.dimmer ?? null,
    nippleHeightsCm: farm ? farm.water.lines.map((l) => l.heightCm) : null,
    pressuresCm: farm ? farm.water.lines.map((l) => l.pressureCm) : null,
    panHeightsCm: farm ? farm.feed.lines.map((l) => l.heightCm) : null,
    ...(farm && farm.cyc && farm.cyc.on ? { curtainOpen: !!farm.house.curtainOpen, fansManual: env.fansManual, padOn: !!env.padOn, valves: farm.feed.valves ? farm.feed.valves.slice() : null } : {}),
  };
}

export function buildRow(day, { notebook, extras, farm, env }, signed) {
  const of = (kind, d = day) => notebook.filter((n) => n.kind === kind && n.day === d);
  const upTo = (kind) => notebook.filter((n) => n.kind === kind && n.day <= day);
  const ex = extras[day] || { notes: [], skillLines: [], jobsDone: 0, jobsMissed: 0, missed: [], lapses: 0 };
  // ---- birds: what he knows from the tips, the bin and his culls ----
  const tips = upTo('tip');
  const placed = tips.reduce((s, n) => s + (n.value?.placed || 0), 0);
  const boxDead = tips.reduce((s, n) => s + (n.value?.deadInBoxes || 0), 0);
  const lastTipIdx = tips.length ? notebook.lastIndexOf(tips[tips.length - 1]) : -1;
  const culls = upTo('cull');
  const cullsBefore = culls.filter((n) => notebook.indexOf(n) < lastTipIdx).reduce((s, n) => s + (n.value?.n || 0), 0);
  const cullsAll = culls.reduce((s, n) => s + (n.value?.n || 0), 0);
  const counted = upTo('dead').reduce((s, n) => s + (n.value?.n || 0), 0);
  const delivered = placed + boxDead + cullsBefore;
  const alive = placed > 0 ? placed - counted - (cullsAll - cullsBefore) : null;
  const deathsToday = of('dead').reduce((s, n) => s + (n.value?.n || 0), 0) + of('tip').reduce((s, n) => s + (n.value?.deadInBoxes || 0), 0);
  const cullsToday = of('cull').reduce((s, n) => s + (n.value?.n || 0), 0);
  // ---- feed and water: this morning's meters against yesterday's ----
  const feedNow = of('feed.meter')[0], feedPrev = of('feed.meter', day - 1)[0];
  const feedKg = feedNow && feedPrev ? feedNow.value.kg - feedPrev.value.kg : null;
  const meter = of('water.meter')[0];
  const waterL = meter ? meter.value.litres24h ?? null : null;
  // ---- weight: the automatic bird scale (+2 % +- 3 %, model), the hand weighing on day 7 ----
  const weighed = of('weigh').map((n) => n.value.weightG);
  let weightG = null, weightSource = null, uniformityPct = null;
  if (weighed.length) {
    weightG = mean(weighed); weightSource = 'weighed';
    uniformityPct = (100 * weighed.filter((w) => Math.abs(w - weightG) <= 0.1 * weightG).length) / weighed.length;
  } else if (farm && placed > 0 && farm.flock.alive > 0) {
    weightG = farm.flock.meanWeightG * 1.02 * (1 + 0.03 * hashNoise(farm.seed, day)); weightSource = 'scale';
  }
  const box = upTo('box')[0];
  const chickMeasured = box ? ((box.value.weightKg - box.value.boxKg) * 1000) / box.value.chicks : null;
  const chickRef = chickMeasured ?? (farm && placed > 0 ? farm.flock.chickWeightG : null); // else the delivery note
  const feedBase = of('feed.meter', 0)[0];
  const fcr = feedNow && feedBase && day > 0 && alive && weightG ? (feedNow.value.kg - feedBase.value.kg) / ((alive * weightG) / 1000) : null;
  // ---- the day's hand readings ----
  const squeezes = of('litter').map((n) => n.value.moisturePct);
  const ctl = of('controller');
  const lastCtl = ctl.length ? ctl[ctl.length - 1].value : null;
  const crops = of('crop').map((n) => n.value.crop);
  const vents = of('vent.temp').map((n) => n.value.tempC);
  const floors = of('floor.temp').map((n) => n.value.tempC);
  const flows = [0, 1, 2, 3].map((line) => { const f = of('water.flow').filter((n) => n.value.line === line && n.hour < 12); return f.length ? f[f.length - 1].value.mlMin : null; });
  const sheet = of('grade.sheet')[0];
  const lightCtl = lastCtl && lastCtl.light && lastCtl.light.darkHours != null ? 24 - lastCtl.light.darkHours : null;
  const notes = [...ex.notes];
  for (const n of of('order')) if (n.value && n.value.arriveDay != null) notes.push(`Feed ordered, arrives day ${n.value.arriveDay} ${String(n.value.arriveHour).padStart(2, '0')}:00`);
  for (const n of of('text')) notes.push(n.value);
  if (ex.lapses) notes.push(`House entered without the foot dip: ${ex.lapses}`);
  // ---- Phase 3: the cycle's readings (null when not taken) ----
  const cyc = cycleFields(day, of, notebook, farm);
  const s = sheet && sheet.value && sheet.value.sheet;
  const sheetNote = s ? `Grading sheet: navel not closed ${s.navelBad ?? 0}, red hocks ${s.redHocks ?? 0}, slow to right ${s.slowReflex ?? 0}, culled ${s.culled ?? 0}` : null;
  return {
    day, signed: !!signed,
    alive, deaths: placed > 0 || deathsToday ? deathsToday : null, culls: placed > 0 || cullsToday ? cullsToday : null,
    mortalityCumPct: delivered > 0 ? r2((100 * (counted + boxDead + cullsAll)) / delivered) : null,
    feedKg, feedPerBirdG: feedKg != null && alive ? r1((feedKg * 1000) / alive) : null,
    waterL, waterPerBirdMl: meter ? meter.value.per1000 ?? null : null,
    waterFeedRatio: waterL != null && feedKg ? r2(waterL / feedKg) : null,
    waterChangePct: meter ? meter.value.changePct ?? null : null,
    weightG: r1(weightG), weightSource, targetWeightG: Math.round(weightAt(Math.max(0, day))),
    weightRatio: weightG != null && chickRef ? r2(weightG / chickRef) : null, uniformityPct: r1(uniformityPct), fcr: r2(fcr),
    litterMoisturePct: r1(mean(squeezes)), houseMinC: lastCtl?.minC ?? null, houseMaxC: lastCtl?.maxC ?? null, targetC: Math.round(targetTempAt(day) * 2) / 2,
    lightHours: lightCtl, cropFullPct: crops.length ? r1((100 * crops.filter((c) => c === 'full-soft').length) / crops.length) : null,
    ventTempMeanC: r1(mean(vents)), chickWeightG: day === 0 || (box && box.day === day) ? r1(chickMeasured) : null,
    chickQualityNote: sheetNote, looks: of('look').map((n) => n.value), skillLines: [...ex.skillLines], notes,
    jobsDone: ex.jobsDone, jobsMissed: ex.jobsMissed, missed: [...(ex.missed || [])],
    flowsMlMin: flows.some((f) => f != null) ? flows : null, floorTempMeanC: r1(mean(floors)),
    cropTally: crops.length ? { full: crops.filter((c) => c === 'full-soft').length, of: crops.length } : null,
    settings: settingsNow(farm, env),
    prepChecks: day < 0 ? notebook.filter((n) => n.day === day && n.kind === 'setting').map((n) => n.value.id).filter((v, i, a) => a.indexOf(v) === i) : null,
    ...cyc,
  };
}

/** The Phase 3 fields of a row (PHASE3.md §8.1): what the farmer read and did with the cycle's instruments. */
function cycleFields(day, of, notebook, farm) {
  const ctl = of('controller'), last = ctl.length ? ctl[ctl.length - 1].value : null;
  const lux = of('lux').map((n) => n.value.lux).filter(Number.isFinite);
  const air = of('air').map((n) => n.value.speedMs).filter(Number.isFinite);
  const fans = of('fans');
  const lame = of('cull').filter((n) => n.value && n.value.reason === 'lame').reduce((a, n) => a + (n.value.n || 0), 0);
  const meter = of('feed.meter').find((n) => n.hour < 12 && n.value.type);
  const med = of('medicine');
  const gas = notebook.filter((n) => n.kind === 'gas' && n.day <= day);
  const gasToday = gas.filter((n) => n.day === day), gasPrev = gas.filter((n) => n.day < day);
  const look = of('dead').map((n) => n.value && n.value.byLook).filter(Boolean);
  const v = farm && farm.health && farm.health.vaccine;
  const darkFromCtl = last && last.light && last.light.darkHours != null ? last.light.darkHours : null;
  const sum = (k) => look.reduce((a, b) => a + (b[k] || 0), 0);
  return {
    darkHours: darkFromCtl, luxMeasured: lux.length ? r1(mean(lux)) : null,
    houseRhMin: last && Number.isFinite(last.rhMin) ? last.rhMin : null, houseRhMax: last && Number.isFinite(last.rhMax) ? last.rhMax : null,
    airSpeedMs: air.length ? r2(mean(air)) : null,
    fansMax: fans.length ? Math.max(...fans.map((n) => n.value.fans ?? 0)) : null,
    padOn: fans.length ? fans.some((n) => n.value.pad === true || n.value.padOn === true) || !!(farm && farm.stats && farm.stats.daily && farm.stats.daily[day] && farm.stats.daily[day].padSeen) : null,
    lameCulled: lame || null,
    feedType: meter ? meter.value.type : null,
    vaccine: v && v.state === 'drunk' && v.drunkAt != null && Math.floor(v.drunkAt) === day ? { hours: v.hours } : null,
    medication: med.length ? med.some((n) => n.value.on) : farm && farm.health && farm.health.medication.on && Math.floor(farm.health.medication.from) <= day ? true : null,
    gasKgUsed: gasToday.length && gasPrev.length ? Math.round(gasToday[gasToday.length - 1].value.kgUsed - gasPrev[gasPrev.length - 1].value.kgUsed) : null,
    deadByLook: look.length ? { back: sum('back'), thin: sum('thin'), wingsOut: sum('wingsOut'), hunched: sum('hunched') } : null,
  };
}
