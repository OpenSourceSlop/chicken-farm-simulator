// Phase 4 tuning audit (PHASE4.md §2): measures the farm model as it plays, for the audit table.
// Owner: package "sim" (Phase 4); written by the Phase 4 design. Pure node, no browser.
//   node scripts/tuning-audit.mjs            the ideal (seed 1) by week + the env-only checks, as text
//   node scripts/tuning-audit.mjs --json     the same numbers as JSON (the sim package diffs them after tuning)
// It never grades: it prints the model's numbers beside the reference columns of PHASE4.md §2, which the
// acceptance tests (scripts/test-tuning.mjs, scripts/test-cycle.mjs) hold.
import { runCycle } from '../src/farm-profiles-cycle.js';
import { weightAt, feedStdGAt, targetTempAt, minVentM3hPer1000, PLACEMENT_DAY } from '../src/config.js';
// Phase 4 (the sim package's re-run, PHASE4.md §2.7): the env checks with the tuned responses (farm-tuning.js; the env's
// own wind chill switched to the Phase 4 one, as the farm runs it from Week 2) and the check flock's Phase 4 loads
import { heatStateP4 as heatState, hotFromP4 as hotFrom, deathFromP4 as deathFrom } from '../src/farm-tuning.js';
import { makeEnvP4 } from './tuning-refs.mjs';
const makeEnv = (o) => { const W = makeEnvP4(o); W.env.setWindChillP4(true); return W; };

const json = process.argv.includes('--json');
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const out = {};

// ---- the ideal, seed 1, the whole cycle ----
const t0 = performance.now();
const run = runCycle('ideal', { seed: 1 });
const H = run.hourly;
const at = (day, hour) => H.find((r) => r.day === day && r.hour === hour) || null;
const span = (from, to) => H.filter((r) => r.t >= from - 1e-9 && r.t < to - 1e-9);
const rows = run.records.rows();
const row = (d) => rows.find((r) => r.day === d) || null;

// growth, intake, FCR, water by week (the records' rows are what the farmer reads; the hourly trace is the truth)
out.weeks = [7, 14, 21, 28, 35, 41].map((d) => {
  const h = at(d, 9) || at(d, 8), h0 = at(d - 1, 9) || at(d - 1, 8);
  const feedDay = h && h0 ? h.feedEatenKg - h0.feedEatenKg : null;
  const rw = row(d);
  const age = d + 9 / 24 - PLACEMENT_DAY;
  return {
    day: d, weightG: r1(h && h.meanWeightG), targetG: r1(weightAt(age)), share: r3(h && h.meanWeightG / weightAt(age)),
    intakeG: r1(feedDay != null ? (1000 * feedDay) / h.alive : null), feedStdG: r1(feedStdGAt(age - 0.5)),
    fcrRow: rw ? rw.fcr : null, fcrTrue: r3(h ? h.feedEatenKg / ((h.alive * h.meanWeightG) / 1000) : null),
    waterFeed: rw ? rw.waterFeedRatio : null, waterPerBirdMl: rw ? rw.waterPerBirdMl : null, uniformity: rw ? rw.uniformityPct : null,
    litterPct: r1(at(d, 15) && at(d, 15).litterMean), nh3Day: r1(at(d, 14) && at(d, 14).nh3), nh3Night: r1(at(d, 4) && at(d, 4).nh3),
    rh5: r1(at(d, 5) && at(d, 5).houseRH), rh15: r1(at(d, 15) && at(d, 15).houseRH),
  };
});

// the house against the target by age (05:00 and 15:00), what the birds feel, panting
out.climate = [3, 8, 12, 16, 18, 22, 25, 28, 31, 33, 35, 37, 38, 41].map((d) => {
  const a = at(d, 5), b = at(d, 15), e = at(d, 19), n = at(d, 22);
  const f = (r) => (r ? { out: r1(r.outC), outRh: r1(r.outRH), house: r1(r.houseC), rh: r1(r.houseRH), felt: r1(r.feltMean), pant: r2(r.pantShare), fans: r.fansManual, pad: r.padOn, speed: r2(r.airSpeed) } : null);
  return { day: d, target: r1(targetTempAt(d)), hotFrom: r1(hotFrom(d)), at05: f(a), at15: f(b), at19: f(e), at22: f(n) };
});

// deaths by cause and level (% of the birds alive at the level start)
const LV = [['level1', -1, 8.25], ['week2', 8.25, 15.25], ['week3', 15.25, 22.25], ['weeks45', 22.25, 36.25], ['finish', 36.25, 42.5]];
out.deaths = LV.map(([id, from, to]) => {
  const a = span(from, to); if (!a.length) return { id };
  const first = a[0], last = a[a.length - 1], base = first.alive || 6000;
  const causes = {};
  for (const k of new Set([...Object.keys(first.dead), ...Object.keys(last.dead)])) { const v = (last.dead[k] || 0) - (first.dead[k] || 0); if (v > 0) causes[k] = r2((100 * v) / base); }
  const culls = Object.keys(last.culls).reduce((s, k) => s + (last.culls[k] || 0) - (first.culls[k] || 0), 0);
  return { id, causes, cullsPct: r2((100 * culls) / base), level: run.levels[id] ? { pass: run.levels[id].pass, deathsPct: r2(run.levels[id].deathsPct), weightG: r1(run.levels[id].weightG) } : null };
});
out.harvest = run.levels.finish ? Object.fromEntries(Object.entries(run.levels.finish).filter(([, v]) => typeof v !== 'object')) : null;
out.cycleMs = Math.round(performance.now() - t0);

// the evening of day 37 (the known item): the ideal's farm at 18:00, then 3 fans / 6 fans / 6 fans + pad to 23:00
out.day37Evening = ['ideal3', 'ideal6', 'ideal6pad'].map((plan) => {
  const W = makeEnv({ fromDay: 36 + 6 / 24 });
  const { env } = W, rowsOut = [];
  while (env.day < 37 + 23 / 24) {
    const h = env.hour, a = env.day - PLACEMENT_DAY, birds = W.birds, w = W.w();
    const m3h = (minVentM3hPer1000(w) * birds) / 1000;
    env.setHeaterSetpoint(15); env.setVentTimer({ fans: 1, onSec: Math.round(Math.min(1, m3h / 36000) * 300), cycleSec: 300 });
    const day37eve = env.day >= 37 + 18 / 24;
    const fans = day37eve ? (plan === 'ideal3' ? 3 : 6) : Math.max(0, Math.min(6, Math.ceil((env.outsideTemp - env.targetTemp - 1) / 1.2)));
    env.setFans(fans); env.setPad(day37eve ? plan === 'ideal6pad' : fans >= 6 && env.outsideTemp - env.targetTemp >= 12);
    env.skipHours(0.25);
    { const s0 = heatState(env, { age: env.day - PLACEMENT_DAY, weightG: W.w() }); W.last.eMean = s0.eMean; }
    if (day37eve && Math.abs(env.hour - Math.round(env.hour)) < 1e-6) {
      const s = heatState(env, { age: a, weightG: w });
      rowsOut.push({ hour: Math.round(env.hour), out: r1(env.outsideTemp), outRh: r1(env.outsideRH), house: r1(env.houseTemp), rh: r1(env.houseRH), chill: r2(env.windChill), felt: r1(s.feltMean), e: r1(s.eMean), pant: r2(s.pantShare), deathPctH: r3(s.deathPerH * 100) });
    }
    void h;
  }
  return { plan, hotFrom: r1(hotFrom(37)), deathFrom: r1(deathFrom(37, weightAt(37) * 1.04)), rows: rowsOut };
});

// wind chill as the env computes it (°C cooler at bird height) by age and air speed
out.windChill = [7, 14, 21, 28, 35, 42].map((age) => {
  const W = makeEnv({ fromDay: age + PLACEMENT_DAY });
  const r = { age };
  for (const n of [1, 2, 3, 6]) { W.env.setFans(n); r[`${(n * 2.5 / 6).toFixed(2)}ms`] = r2(W.env.windChill); }
  return r;
});

// minimum ventilation the sign asks for, per bird and per kg (m3/h)
out.minVent = [42, 100, 200, 500, 1000, 1500, 2000, 2500, 3000].map((g) => ({ g, perBirdM3h: r3(minVentM3hPer1000(g) / 1000), perKgM3h: r2(minVentM3hPer1000(g) / g) }));

if (json) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
const p = (o) => console.log(JSON.stringify(o));
console.log(`ideal seed 1, whole cycle in ${out.cycleMs} ms`);
console.log('-- by week (day, weight g / target, share, intake g/bird/day / feed table, FCR row / true, water:feed, ml/bird, uniformity, litter %, NH3 day / night, RH 05 / 15)');
for (const w of out.weeks) p(w);
console.log('-- climate (05:00, 15:00, 19:00, 22:00)');
for (const c of out.climate) p(c);
console.log('-- deaths by level (% of the birds alive at the level start)');
for (const d of out.deaths) p(d);
console.log('-- harvest'); p(out.harvest);
console.log('-- day 37 evening (env alone, the check flock)');
for (const d of out.day37Evening) { console.log(`${d.plan} hotFrom ${d.hotFrom} deathFrom ${d.deathFrom}`); for (const r of d.rows) p(r); }
console.log('-- wind chill °C by age and air speed'); for (const w of out.windChill) p(w);
console.log('-- minimum ventilation (sign table)'); for (const m of out.minVent) p(m);
