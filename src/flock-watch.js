// The flock watch (the farmer's request during Phase 4, PHASE4.md §15.1): the level's key targets tracked live — the
// weight against the level's line, the deaths against its limit, the hours the birds felt too cold or too hot, the
// intake against what birds of this age take — each with a calm state (green 'steady', amber 'watch', red 'alert'),
// and an early warning when a trend heads toward failing the level: what is happening, the likely cause from the model,
// where to look (the sign and the place). Factual words only: it is a reading of the model like a gauge, never a grade.
// Pure logic (node and browser). Owner: integrator.
//
// createFlockWatch({ env, farm, events, records }) -> watch
//   attach(fn)    fn() -> { active, def (the level as the condition plays it), deaths { n, of, pct }, chickG, endAt,
//                 catchAt } | null; the level's side (level.js)
//   step          the env stepper (main.js / level.js add it): one sample per farm hour, skips and goto(auto) included
//   status()      { on, rows: { weight, deaths, comfort, intake } -> { state, label, value, detail } | null, last }
//   warnings      every warning raised this level [{ kind, state, text, cause, sign, place, day, hour, t }]
//   reset(), serialize(), restore(d)
//   EV.WATCH { kind, state, text, cause, sign, place, day, hour } on each warning; records.note('watch', text)
import { weightAt, feedStdGAt, PLACEMENT_DAY, LEVEL1, HARVEST } from './config.js';
import { EV } from './events.js';

/** Model values of the watch (PHASE4.md §15.1; none is a sign fact). */
export const WATCH = {
  weightGreen: 1.04,      // projected weigh-in weight at or over 1.04 x the line: steady
  deathsAmber: 0.75,      // projected level deaths over 75 % of the limit: watch
  deathsNowRed: 0.8,      // 80 % of the limit reached: alert
  windowH: 8, comfortAmber: 2, comfortRed: 4,   // cold or hot hours of the last 8
  litH: 6, intakeGreen: 0.88, intakeRed: 0.75,  // the last 6 lit hours' feed and water against the standard
  intakeFromH: 24,        // hours after the first tip before the intake row reads (the crop check's day comes first)
  trendH: 24, aheadMaxH: 72, keepH: 30,
  rewarnH: 12, clearH: 6, // the same kind warns again only after 6 h out of red, at most once per 12 farm hours
  waterPerKg: 1.8,        // the water sign's general figure: about 1.8 L of water per kg of feed
};
export const WATCH_STATES = { green: 'steady', amber: 'watch', red: 'alert' };

// The model's ideal growth path in the brooding week as a share of weightAt (seed 1: the chicks start on their yolk and
// catch up by day 6); 1.0 from day 8, where every level's line is a share of weightAt itself.
const REF_SHARE = [[0, 0.99], [0.5, 0.93], [1, 0.886], [2, 0.875], [3, 0.9], [4, 0.895], [5, 0.951], [6, 1.008], [7, 1.063], [8, 1.0]];
export function refShare(age) {
  const a = Math.max(0, age);
  if (a >= 8) return 1;
  for (let i = 1; i < REF_SHARE.length; i++) {
    const [a1, s1] = REF_SHARE[i], [a0, s0] = REF_SHARE[i - 1];
    if (a <= a1) return s0 + ((s1 - s0) * (a - a0)) / (a1 - a0);
  }
  return 1;
}
export const refWeight = (age) => weightAt(age) * refShare(age);

// The sign and the place for each likely cause (the young-bird and the grown-bird versions).
const SIGN = { brooder: 'the brooder sign', heat: 'the heat and tunnel fans sign', water: 'the water lines sign', feeder: 'the feeder lines plate on the feeder box',
  light: 'the light program sign', lightPlate: 'the light program plate on the controller', vent: 'the minimum ventilation sign', air: 'the air quality sign',
  legs: 'the legs and feathers sign', droppings: 'the droppings sign', chicks: 'the chick arrival sign', health: 'the flock health sign' };
export function causeOf(kind, age) {
  const young = age < 8, brooding = age < 21;
  switch (kind) {
    case 'cold': return brooding ? { why: young ? 'the chicks are cold: the house or the brooders run under the brooder sign’s row' : 'the birds are cold: the house runs under its target', sign: 'sign-brooder', signName: SIGN.brooder, place: 'controller', check: 'the thermostat at the climate controller' }
      : { why: 'the birds are cold: moving air or a cool night chills them', sign: 'sign-heat', signName: SIGN.heat, place: 'fan-panel', check: 'the tunnel fans at the fan panel' };
    case 'heat': return young ? { why: 'the chicks are hot: the house runs over the brooder sign’s row', sign: 'sign-brooder', signName: SIGN.brooder, place: 'controller', check: 'the thermostat at the climate controller' }
      : { why: 'the birds are hot for their age', sign: 'sign-heat', signName: SIGN.heat, place: 'fan-panel', check: 'the fan panel and the pad pump' };
    case 'water': return { why: 'water reaches few birds (the flow, the nipple height or the filter)', sign: 'sign-water', signName: SIGN.water, place: 'drinker-0', check: 'a flow test at the drinker line regulators and the water supply’s filter' };
    case 'feed': return { why: 'feed is out of reach or the pans run empty', sign: 'feeder-box', signName: SIGN.feeder, place: 'feeder-box', check: 'the pans’ height and the feed in them at the feeder box' };
    case 'light': return { why: 'the light program cuts their eating time', sign: young ? 'controller-lights' : 'sign-light', signName: young ? SIGN.lightPlate : SIGN.light, place: 'controller', check: 'the lights at the climate controller' };
    case 'air': return { why: 'ammonia in the air: too little fresh air', sign: young ? 'sign-vent' : 'sign-air', signName: young ? SIGN.vent : SIGN.air, place: 'controller', check: 'the minimum ventilation timer at the climate controller' };
    case 'weak': return { why: 'weak chicks and chicks that never found feed die first', sign: 'sign-chicks', signName: SIGN.chicks, place: 'feeder-box', check: 'feed and water in reach of every chick' };
    case 'legs': return { why: 'birds with bad legs cannot reach feed and water', sign: 'sign-legs', signName: SIGN.legs, place: 'bird-scale', check: 'how they walk, and the cull of lame birds' };
    case 'disease': return { why: 'a disease in the flock', sign: 'sign-droppings', signName: SIGN.droppings, place: 'bird-check', check: 'the droppings of a few birds in the hand and the company vet by phone' };
    case 'claim': return { why: 'the chicks graded out at the table count as culls until the hatchery is told the same day', sign: 'sign-chicks', signName: SIGN.chicks, place: 'office-desk', check: 'the phone in the records book at the office desk' };
    case 'sds': return { why: 'sudden deaths of fast-growing birds', sign: 'sign-light', signName: SIGN.light, place: 'controller', check: 'the dark hours of the light program' };
    default: return { why: 'more deaths than usual', sign: 'sign-health', signName: SIGN.health, place: 'office-desk', check: 'the dead birds’ causes and the records book' };
  }
}
const DEATH_KIND = { cold: 'cold', heat: 'heat', dehydration: 'water', weak: 'weak', starveout: 'weak', box: 'weak', sds: 'sds', legs: 'legs', disease: 'disease', respiratory: 'air' };
const CAUSE_WORD = { cold: 'cold', heat: 'heat', water: 'thirst', weak: 'weak chicks', sds: 'sudden death', legs: 'legs', disease: 'disease', air: 'breathing', claim: 'culls at the chick table' };

const int = (v) => Math.round(v).toLocaleString('en');
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
const two = (v) => (Math.round(v * 100) / 100).toFixed(2);
const H = 1 / 24;

/** Is this hour cold / hot for the birds (model; PHASE4.md §15.1)? */
export function hourComfort(C, age) {
  if (!C) return { cold: false, hot: false };
  const cold = age < 14 ? (C.coldShare ?? 0) >= 0.5 : (C.coldDeathPerH ?? 0) > 1e-5;
  const hot = (C.pantShare ?? 0) >= 0.5 || (C.heatDeathPerH ?? 0) > 1e-5;
  return { cold, hot };
}

export function createFlockWatch({ env, farm, events, records } = {}) {
  let ctxFn = null, samples = [], lastHour = null;
  let mem = {};                 // kind -> { active, lastAt, clearSince }
  let warnings = [];
  let status = { on: false, rows: {}, last: null };

  function sample(L) {
    const fl = farm.flock, C = farm.comfort || {}, age = farm.age;
    const f = fl.factors || {};
    const lp = env.lightProgram || { darkHours: 1 };
    const hc = hourComfort(C, age);
    return { t: env.day, age, w: fl.placed > 0 && fl.alive > 0 ? fl.meanWeightG * 1.02 : null, alive: fl.alive || 0,
      lost: L.deaths?.n ?? 0, dead: fl.deadTotal || 0, of: L.deaths?.of ?? 0, causes: { ...(fl.deadByCause || {}) },
      cold: hc.cold, hot: hc.hot, felt: C.feltMean ?? (C.meanOver ?? 0) + env.targetTemp, tgt: env.targetTemp, e: C.meanOver ?? 0,
      feedKg: fl.cumFeedKg || 0, waterL: farm.water?.meterL || 0, lit: !!env.lightsOn, litH: Math.max(1, 24 - (lp.darkHours || 0)),
      excl: !!(farm.feed?.withdrawn || farm.cyc?.liftOn || farm.power?.on === false || farm.water?.mainClosed), // the withdrawal, the heat-wave lift, a cut, the vaccine's thirst
      f: { fT: f.fT ?? 1, fL: f.fL ?? 1, fF: f.fF ?? 1, fW: f.fW ?? 1, fAir: f.fAir ?? 1 } };
  }

  /** The level's line: { ageD, dayD, lineG, word } or null (no weigh-in in this level). */
  function lineOf(L) {
    const d = L.def, tg = d?.target;
    if (!tg) return null;
    if (tg.kind === 'ratio') { const chick = L.chickG || LEVEL1.chickWeightG; return { ageD: LEVEL1.endDay + 9 * H - PLACEMENT_DAY, dayD: LEVEL1.endDay, lineG: (d.fail?.weightRatioMin ?? LEVEL1.fail.weightRatioMin) * chick, word: `the day ${LEVEL1.endDay} weigh-in` }; }
    if (tg.kind === 'weight') return { ageD: tg.day + 9 * H - PLACEMENT_DAY, dayD: tg.day, lineG: tg.minShare * weightAt(tg.day), word: `the day ${tg.day} weigh-in` };
    if (tg.kind === 'harvest') {
      const at = L.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour * H, age = at - PLACEMENT_DAY;
      return { ageD: age, dayD: Math.floor(at), lineG: tg.minShare * weightAt(age), word: 'the catch' };
    }
    return null;
  }
  const back = (h) => { const t = samples[samples.length - 1].t - h * H; for (let i = samples.length - 1; i >= 0; i--) if (samples[i].t <= t + 1e-6) return samples[i]; return null; };

  function evaluate(L) {
    const s = samples[samples.length - 1], rows = {};
    if (!s || s.w == null || !(s.alive > 0)) { status = { on: false, rows: {}, last: warnings[warnings.length - 1] || null }; return null; }
    const who = s.age < 8 ? 'Chicks' : 'Birds', ln = lineOf(L);
    // ---- weight ----
    if (ln) {
      const sNow = s.w / refWeight(s.age), p24 = back(WATCH.trendH);
      const left = (ln.ageD - s.age) * 24;
      const trend = p24 && p24.w != null && s.age >= 0.5 ? sNow - p24.w / refWeight(p24.age) : 0;
      const P = left > 0 ? refWeight(ln.ageD) * (sNow + 0.5 * trend * (Math.min(left, WATCH.aheadMaxH) / 24)) : s.w;
      const q = P / ln.lineG, todayLine = ln.lineG * refWeight(s.age) / refWeight(ln.ageD);
      const state = left <= 0 ? (s.w >= ln.lineG ? 'green' : 'red') : q >= WATCH.weightGreen ? 'green' : q >= 1 ? 'amber' : 'red';
      rows.weight = { state, label: 'Weight', value: `${int(s.w)} g · today's line ${int(Math.min(todayLine, ln.lineG))} g`,
        detail: left > 0 ? `on course for ${int(P)} g at ${ln.word} (line ${int(ln.lineG)} g)` : `${ln.word}: line ${int(ln.lineG)} g`, P, line: ln.lineG, word: ln.word };
    }
    // ---- deaths ----
    const limit = L.def?.fail?.mortalityMaxPct;
    if (limit != null && L.deaths) {
      const pct = L.deaths.pct || 0, p24 = back(WATCH.trendH);
      const of = L.deaths.of || s.alive || 1;
      // the trend from the deaths alone (culls are the farmer's own decisions, a bad batch's grading all at once)
      const rate = p24 ? (100 * Math.max(0, (s.dead ?? s.lost) - (p24.dead ?? p24.lost))) / of * (24 / Math.max(1, (s.t - p24.t) * 24)) : 0;
      const left = Math.max(0, ((L.endAt ?? s.t) - s.t) * 24);
      const proj = pct + rate * (Math.min(left, WATCH.aheadMaxH) / 24);
      const state = proj >= limit || pct >= WATCH.deathsNowRed * limit ? 'red' : proj >= WATCH.deathsAmber * limit ? 'amber' : 'green';
      // the main cause of the last day's deaths
      let main = null, mn = 0;
      if (p24) for (const [k, v] of Object.entries(s.causes)) { const d = v - (p24.causes[k] || 0); if (d > mn) { mn = d; main = k; } }
      // a bad batch: the chicks graded out at the table count as culls until the hatchery is told (PHASE4.md §4.3)
      const claimable = !!L.def?.fail?.claimedApart && (farm.flock.culls || 0) > (farm.flock.claimed || 0) && (L.deaths?.claimed ?? 0) === 0;
      rows.deaths = { state, label: 'Deaths', value: `${two(pct)} % of the ${limit} % limit`, detail: `on course for ${two(proj)} %`, pct, proj, limit, rate,
        main: claimable && (farm.flock.culls || 0) > (s.dead || 0) ? 'claim' : DEATH_KIND[main] || null };
    }
    // ---- comfort ----
    const win = samples.slice(-WATCH.windowH);
    const nc = win.filter((x) => x.cold).length, nh = win.filter((x) => x.hot).length;
    const n = Math.max(nc, nh), feel = nc >= nh ? 'Cold' : 'Hot';
    const cs = n >= WATCH.comfortRed ? 'red' : n >= WATCH.comfortAmber ? 'amber' : 'green';
    const now = s.cold ? 'cold' : s.hot ? 'hot' : 'right';
    rows.comfort = { state: cs, label: 'Comfort', value: n ? `${feel} ${n} of the last ${win.length} h · ${now} now` : `Right for the last ${win.length} h`, detail: `felt ${one(s.felt)} °C`, cold: nc, hot: nh, hours: win.length, now };
    // ---- intake (the last 6 lit hours, from 24 h after the first tip) ----
    const tip = farm.stats?.firstTipAt;
    if (tip != null && (s.t - tip) * 24 >= WATCH.intakeFromH) {
      let eat = 0, want = 0, drink = 0, hrs = 0;
      for (let i = samples.length - 1; i > 0 && hrs < WATCH.litH; i--) {
        const a = samples[i - 1], b = samples[i];
        if (!a.lit || !b.lit || a.excl || b.excl || b.t - a.t > 1.5 * H) continue;
        eat += b.feedKg - a.feedKg; drink += b.waterL - a.waterL;
        want += (a.alive * feedStdGAt(a.age)) / 1000 / a.litH * ((b.t - a.t) * 24);
        hrs++;
      }
      if (hrs >= 3 && want > 0) {
        const fs = eat / want, ws = drink / (want * WATCH.waterPerKg), m = Math.min(fs, ws);
        rows.intake = { state: m >= WATCH.intakeGreen ? 'green' : m >= WATCH.intakeRed ? 'amber' : 'red', label: 'Intake', value: `feed ${int(fs * 100)} % · water ${int(ws * 100)} %`, detail: `of what ${who.toLowerCase()} this age take (the last ${hrs} lit hours)`, feed: fs, water: ws, hours: hrs };
      }
    }
    status = { on: true, rows, last: warnings[warnings.length - 1] || null, age: s.age };
    return rows;
  }

  /** The model's likely cause now: the comfort, then the weakest growth factor, then the last day's deaths. */
  function likely(rows, s) {
    if (rows.comfort?.cold >= WATCH.comfortAmber) return 'cold';
    if (rows.comfort?.hot >= WATCH.comfortAmber) return 'heat';
    const f = s.f, lows = [['water', f.fW], ['feed', f.fF], [s.e > 0.5 ? 'heat' : 'cold', f.fT], ['light', f.fL], ['air', f.fAir]].filter((x) => x[1] < 0.93).sort((a, b) => a[1] - b[1]);
    if (lows.length) return lows[0][0];
    return rows.deaths?.main || null;
  }
  const weightClause = (rows) => (rows.weight && rows.weight.state !== 'green' ? ` Weight is on course for ${int(rows.weight.P)} g at ${rows.weight.word} (line ${int(rows.weight.line)} g).` : '');
  const where = (c) => ` See ${c.signName}; check ${c.check}.`;

  function textOf(kind, rows, s) {
    const who = s.age < 8 ? 'Chicks' : 'Birds';
    if (kind === 'cold' || kind === 'hot') {
      const c = causeOf(kind === 'cold' ? 'cold' : 'heat', s.age), r = rows.comfort;
      const row = s.age < 21 ? `, brooder sign row ${one(s.tgt)} °C` : `, target ${one(s.tgt)} °C`;
      const head = kind === 'cold' ? `${who} felt cold for ${r.cold} of the last ${r.hours} hours (felt ${one(s.felt)} °C${row}): they eat less, grow less and the weakest die.`
        : s.age < 8 ? `${who} felt hot for ${r.hot} of the last ${r.hours} hours (felt ${one(s.felt)} °C${row}): they eat less and pant.`
          : `${who} panted for ${r.hot} of the last ${r.hours} hours (felt ${one(s.felt)} °C): they eat less and the weakest die in the heat.`;
      return { text: head + weightClause(rows) + where(c), c };
    }
    const k = likely(rows, s), c = causeOf(k, s.age);
    const cause = k ? ` Likely cause: ${c.why}.` : '';
    if (kind === 'weight') { const r = rows.weight; return { text: `Weight is on course for ${int(r.P)} g at ${r.word}, under the line of ${int(r.line)} g (${int(s.w)} g now).${cause}${where(c)}`, c }; }
    if (kind === 'deaths') {
      // the birds' comfort first (cold chicks die as weak chicks in the model), else the last day's main cause
      const r = rows.deaths, dc = r.main === 'claim' ? causeOf('claim', s.age) : k === 'cold' || k === 'heat' || !r.main ? c : causeOf(r.main, s.age);
      return { text: `Deaths and culls are on course for ${two(r.proj)} % by the end of this level (the limit is ${r.limit} %; ${two(r.pct)} % now, ${two(r.rate)} % in the last day${r.main ? `, mostly ${CAUSE_WORD[r.main]}` : ''}). Likely cause: ${dc.why}.${where(dc)}`, c: dc };
    }
    const r = rows.intake;
    return { text: `Feed eaten in the last ${r.hours} lit hours is ${int(r.feed * 100)} % of what ${who.toLowerCase()} of this age eat (water ${int(r.water * 100)} %).${cause}${where(c)}`, c };
  }

  function warnings_(rows, s) {
    const red = { weight: rows.weight?.state === 'red' && (rows.weight.P != null), deaths: rows.deaths?.state === 'red',
      cold: (rows.comfort?.cold ?? 0) >= WATCH.comfortRed, hot: (rows.comfort?.hot ?? 0) >= WATCH.comfortRed, intake: rows.intake?.state === 'red' };
    for (const kind of ['cold', 'hot', 'weight', 'deaths', 'intake']) {
      const m = mem[kind] || (mem[kind] = { active: false, lastAt: null, clearSince: null });
      if (!red[kind]) { if (m.active) { if (m.clearSince == null) m.clearSince = s.t; if ((s.t - m.clearSince) * 24 >= WATCH.clearH - 1e-6) { m.active = false; m.clearSince = null; } } continue; }
      m.clearSince = null;
      if (m.active || (m.lastAt != null && (s.t - m.lastAt) * 24 < WATCH.rewarnH - 1e-6)) { m.active = true; continue; }
      // a comfort warning already names the weight: the weight warning waits while the comfort one is active
      if (kind === 'weight' && (mem.cold?.active || mem.hot?.active) && (s.t - (mem.cold?.lastAt ?? mem.hot?.lastAt ?? -9)) * 24 < WATCH.rewarnH) continue;
      m.active = true; m.lastAt = s.t;
      const { text, c } = textOf(kind, rows, s);
      const day = Math.floor(s.t + 1e-9), hour = Math.round((s.t - day) * 24 * 100) / 100;
      const w = { kind, state: 'red', text, cause: c.why, sign: c.sign, place: c.place, day, hour, t: s.t };
      warnings.push(w);
      records?.note?.('watch', text);
      events?.emit?.(EV.WATCH, { ...w });
    }
  }

  const watch = {
    attach(fn) { ctxFn = typeof fn === 'function' ? fn : null; },
    /** env stepper: one sample per farm hour while the level runs. */
    step: (e) => {
      if (!ctxFn || farm.mode !== 'level') return;
      const hr = Math.floor(e.day * 24 + 1e-6);
      if (hr === lastHour) return;
      lastHour = hr;
      let L = null;
      try { L = ctxFn(); } catch (err) { console.error('flock watch ctx failed', err); }
      if (!L || !L.active) { status = { on: false, rows: {}, last: warnings[warnings.length - 1] || null }; return; }
      samples.push(sample(L));
      if (samples.length > WATCH.keepH) samples.splice(0, samples.length - WATCH.keepH);
      const rows = evaluate(L);
      if (rows) warnings_(rows, samples[samples.length - 1]);
    },
    status: () => status,
    get warnings() { return warnings; },
    get samples() { return samples; },
    /** A new level (start, enter, replay): the samples and the warning memory start again. */
    reset() { samples = []; mem = {}; warnings = []; lastHour = null; status = { on: false, rows: {}, last: null }; },
    serialize() {
      const r3 = (v) => Math.round(v * 1000) / 1000;
      return { v: 1, mem: JSON.parse(JSON.stringify(mem)), warnings: warnings.slice(-6).map((w) => ({ ...w })),
        samples: samples.map((x) => [r3(x.t), r3(x.age), x.w == null ? null : Math.round(x.w * 10) / 10, x.alive, x.lost, x.of, x.cold ? 1 : 0, x.hot ? 1 : 0, Math.round(x.felt * 100) / 100,
          Math.round(x.tgt * 100) / 100, r3(x.e), Math.round(x.feedKg * 10) / 10, Math.round(x.waterL), x.lit ? 1 : 0, x.litH, x.excl ? 1 : 0,
          [x.f.fT, x.f.fL, x.f.fF, x.f.fW, x.f.fAir].map(r3), Object.values(x.causes), x.dead]),
        causeKeys: samples.length ? Object.keys(samples[0].causes) : [] };
    },
    restore(d) {
      watch.reset();
      if (!d || d.v !== 1) return;
      mem = d.mem || {}; warnings = d.warnings || [];
      const keys = d.causeKeys || [];
      samples = (d.samples || []).map((a) => ({ t: a[0], age: a[1], w: a[2], alive: a[3], lost: a[4], of: a[5], cold: !!a[6], hot: !!a[7], felt: a[8], tgt: a[9], e: a[10],
        feedKg: a[11], waterL: a[12], lit: !!a[13], litH: a[14], excl: !!a[15], f: { fT: a[16][0], fL: a[16][1], fF: a[16][2], fW: a[16][3], fAir: a[16][4] },
        causes: Object.fromEntries(keys.map((k, i) => [k, a[17][i] || 0])), dead: a[18] ?? a[4] }));
      lastHour = samples.length ? Math.floor(samples[samples.length - 1].t * 24 + 1e-6) : null;
      let L = null;
      try { L = ctxFn?.(); } catch { L = null; }
      if (L && L.active && samples.length) evaluate(L);
    },
  };
  return watch;
}
