// The measured conditions behind each milestone of skills-cycle.js MILESTONES_CYCLE (PHASE3.md §9). Each rule
// reads the farm (stats, the per-day stats of farm-cycle-step.js, problems, health, harvest, clean, plan), the
// records (notebook, rows, missed jobs) and the checkpoint's ctx, and returns { tier, detail } or null (nothing
// to measure yet). Package "sim", pure logic. The detail is the measured value in plain words, never a verdict.
import { PLAN_CONTRACT, HARVEST, HEAT, CLEAN, weightAt, nippleHeightCmAt, flowTargetAt, houseSector, levelById } from './config.js';

const prob = (farm, id) => farm.problems.find((p) => p.id === id) || null;
const day = (farm, d) => (farm.stats.daily && farm.stats.daily[d]) || {};
const range = (a, b) => { const o = []; for (let d = a; d <= b; d++) o.push(d); return o; };
const sum = (farm, days, k) => days.reduce((s, d) => s + (day(farm, d)[k] || 0), 0);
const notes = (records, kind, d) => records.notebook.filter((n) => n.kind === kind && (d == null || n.day === d));
const pct1 = (v) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} %`;
const hm = (t) => { const m = Math.round((t - Math.floor(t)) * 1440); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const levelDays = (id) => { const L = levelById(id); return range(Math.max(L.startDay, 0), Math.min(L.endDay, 41)); };
const ls = (farm) => farm.stats.levelStart || {};
const planOf = (farm, ctx) => (ctx && ctx.plan && ctx.plan.decisions ? ctx.plan : null) || (farm.plan && farm.plan.decisions ? farm.plan : null);
const tierAt = (v, steps) => { let t = null; steps.forEach((ok, i) => { if (ok(v)) t = i; }); return t; };

/** Missed job ids on the given days (records extras, from EV.JOB_MISSED). */
function missed(records, days) {
  const ex = records.extrasOf ? records.extrasOf() : {};
  return days.flatMap((d) => (ex[d] && ex[d].missedIds) || []);
}
const lapsesIn = (farm) => (farm.flock.lapses || 0) - (ls(farm).lapses || 0);

// ---- shared templates ----
const dips = (lv) => (farm, records) => {
  const m = missed(records, levelDays(lv)).filter((id) => /dip/.test(id)).length, lapses = lv === 'level1' ? farm.flock.lapses || 0 : lapsesIn(farm);
  return { tier: m === 0 && lapses === 0 ? 0 : null, detail: `${lapses} house entries without the dip, ${m} dip rounds missed` };
};
const deadRounds = (lv) => (farm, records) => {
  const m = missed(records, levelDays(lv)).filter((id) => id === 'r-dead-am' || id === 'r-dead-pm').length;
  return { tier: m === 0 ? 0 : null, detail: m ? `${m} dead-bird rounds missed` : 'dead birds picked up on every round' };
};
const comfortIn = (lv, share) => (farm) => {
  const days = levelDays(lv), h = sum(farm, days, 'h'), ok = sum(farm, days, 'cIn');
  if (!h) return null;
  return { tier: ok / h >= share ? 0 : null, detail: `birds in their comfort band ${Math.round((100 * ok) / h)} % of the time` };
};
const timerMornings = (lv, need) => (farm) => {
  let n = 0;
  for (const d of levelDays(lv)) { const a = day(farm, d).am; if (a && a.table > 0 && Math.abs(a.vent - a.table) <= 0.3 * a.table) n++; }
  return { tier: n >= need ? 0 : null, detail: `timer air within 30 % of the table on ${n} mornings` };
};
const flows = (lv, need) => (farm, records) => {
  let n = 0;
  for (const d of levelDays(lv)) {
    const f = [0, 1, 2, 3].map((line) => { const x = notes(records, 'water.flow', d).filter((k) => k.value.line === line && k.hour < 12); return x.length ? x[x.length - 1].value.mlMin : null; });
    if (f.every((v) => v != null && Math.abs(v - flowTargetAt(d)) <= 5 + 1e-9)) n++;
  }
  return { tier: n >= need ? 0 : null, detail: `morning flows at age + 20 ml/min on ${n} days` };
};
const neverOut = (lv) => (farm) => {
  const days = levelDays(lv).filter((d) => d >= 0), low = sum(farm, days, 'panLow');
  if (!sum(farm, days, 'h')) return null;
  return { tier: low < 1 / 60 ? 0 : null, detail: low < 1 / 60 ? 'feed in the pans all the time' : `pans empty for ${(Math.round(low * 10) / 10)} h` };
};
const rims = (lv) => (farm) => {
  let n = 0;
  for (const d of levelDays(lv)) { const a = day(farm, d).am; if (a && a.pans && a.pans.every((h) => Math.abs(h - a.rim) <= 3 + 1e-9)) n++; }
  return { tier: n >= 5 ? 0 : null, detail: `pans at the birds' back height on ${n} days` };
};
const raised = (d) => (farm) => {
  const h = farm.water.lines.map((l) => l.heightCm), want = nippleHeightCmAt(d);
  return { tier: h.every((x) => Math.abs(x - want) <= 3 + 1e-9) ? 0 : null, detail: `nipples at ${h.join(', ')} cm on day ${d}` };
};
const weighedMean = (farm, d) => { const w = farm.stats.weighed.filter((x) => Math.floor(x.t) === d).map((x) => x.weightG); return w.length >= 10 ? w.reduce((a, b) => a + b, 0) / w.length : null; };
const weight = (d) => (farm) => {
  const m = weighedMean(farm, d);
  if (m == null) return null;
  const share = m / weightAt(d);
  return { tier: share >= 1.03 ? 1 : share >= 0.98 ? 0 : null, detail: `day ${d}: ${Math.round(m).toLocaleString('en-US')} g, ${Math.round(share * 100)} % of the target` };
};
const darkDays = (lv, need) => (farm) => {
  let n = 0;
  for (const d of levelDays(lv)) { const a = day(farm, d).am; if (a && a.dark >= 4) n++; }
  return { tier: n >= need ? 0 : null, detail: `a dark period of 4 hours or more on ${n} days` };
};
const deathsOf = (farm, cause) => ((farm.flock.deadByCause[cause] || 0) - (ls(farm)[cause] || 0));
const sharePct = (farm, n) => (ls(farm).alive > 0 ? (100 * n) / ls(farm).alive : 0);
const fixedByAir = (id, withinH, beforeT, noChill = false) => (farm) => {
  const p = prob(farm, id);
  if (!p || p.foundAt == null || p.fixedAt == null) return null;
  // noChill: no bird died of cold between finding the heat and dealing with it (too much air for young birds)
  const chilled = noChill ? Math.max(0, (p.coldAtFix ?? 0) - (p.coldAtFound ?? 0)) : 0;
  const ok = p.fixedBy === 'air' && chilled === 0 && (withinH == null || (p.fixedAt - p.foundAt) * 24 <= withinH + 1e-9) && (beforeT == null || p.fixedAt <= beforeT + 1e-9);
  const when = `fixed ${(Math.round((p.fixedAt - p.foundAt) * 240) / 10)} h after it was found`;
  return { tier: ok ? 0 : null, detail: p.fixedBy === 'air' ? (chilled ? `${when}; ${chilled} ${chilled === 1 ? 'bird' : 'birds'} died of cold meanwhile` : when) : 'it passed with the weather' };
};
const sameDay = (id) => (farm) => {
  const p = prob(farm, id);
  if (!p || p.fixedAt == null || p.startedAt == null) return null;
  return { tier: Math.floor(p.fixedAt) === Math.floor(p.startedAt) ? 0 : null, detail: `fixed on day ${Math.floor(p.fixedAt)} at ${hm(p.fixedAt)}` };
};

const RULES_B = {
  // ---------------- Body Temperature & Comfort ----------------
  'vent-band': (farm) => { const r = farm.stats.ventReadings.slice(0, 5); if (r.length < 5) return null; const n = r.filter((v) => v.tempC >= 39.4 && v.tempC <= 40.5).length; return { tier: n >= 4 ? 0 : null, detail: `${n} of the first 5 vent temperatures at 39.4–40.5 °C` }; },
  'comfort-w2': comfortIn('week2', 0.9), 'comfort-w3': comfortIn('week3', 0.9), 'comfort-fin': comfortIn('finish', 0.85),
  'no-chill-w2': (farm) => { const h = sum(farm, levelDays('week2'), 'chill'); return { tier: h < 1e-6 ? 0 : null, detail: h < 1e-6 ? 'no tunnel chill on the young birds' : `${(Math.round(h * 10) / 10)} h of tunnel air on chilled birds` }; },
  'panting-short': (farm) => { const h = sum(farm, range(22, 35), 'pant'); return { tier: tierAt(h, [(v) => v <= 60, (v) => v <= 45]), detail: `${Math.round(h)} hours of panting per bird in weeks 4–5` }; },
  'heatwave-safe': (farm) => { const h = farm.stats.pantWave ?? 0; return { tier: tierAt(h, [(v) => v <= 12, (v) => v <= 6]), detail: `${(Math.round(h * 10) / 10)} hours of panting per bird in the heat wave` }; },
  'catch-cool': (farm) => { const r = farm.harvest.result; if (!r) return null; return { tier: r.doaPct <= 0.2 + 1e-9 ? 0 : null, detail: `${pct1(r.doaPct)} dead on arrival` }; },
  // ---------------- Heat & Ventilation ----------------
  'warm-timer': (farm) => { const p = prob(farm, 'warm-afternoon'); return p ? { tier: p.phase === 'fixed' && p.fixedBy === 'air' ? 0 : null, detail: p.phase === 'fixed' ? `the warm afternoon passed (${p.fixedBy === 'air' ? 'after the timer change' : 'with the weather'})` : 'the warm afternoon was not dealt with' } : null; },
  'w3-heat': fixedByAir('warm-afternoon3', 2, null, true), 'hot-first': fixedByAir('hot-afternoon', null, 25 + 18 / 24), 'dust-cleared': fixedByAir('dusty-air', 24), 'damp-cleared': fixedByAir('rainy-spell', 6),
  'air-measured': (farm, records, ctx) => {
    const p = notes(records, 'air').filter((n) => n.day <= 23 && n.where);
    if ((ctx && ctx.day != null && ctx.day < 23) && p.length < 3) return null;
    const sec = new Set(p.map((n) => houseSector(n.where[0], n.where[1]))).size;
    return { tier: p.length >= 3 && sec >= 3 ? 0 : null, detail: `${p.length} air speed readings from ${sec} parts of the house` };
  },
  'pads-limit': (farm) => { const h = sum(farm, range(22, 35), 'padHum'); return { tier: h <= 0.5 + 1e-9 ? 0 : null, detail: `${Math.round(h * 60)} min with the pads on over ${HEAT.padOffAboveRH} % house humidity` }; },
  'fan-fixed': sameDay('fan-belt'), 'pad-flushed': sameDay('pad-clog'),
  'heatwave-ready': (farm, records) => {
    const before = (k) => notes(records, k).some((n) => n.day === 29 || (n.day === 30 && n.hour < 10));
    const ok = [before('fans'), before('pad'), before('water.flow')];
    return { tier: ok.every(Boolean) ? 0 : null, detail: `${ok.filter(Boolean).length} of 3 checks (fans, pad, water) before the heat wave` };
  },
  'heat-deaths-w45': (farm) => { const p = sharePct(farm, deathsOf(farm, 'heat')); return { tier: tierAt(p, [(v) => v <= 0.3 + 1e-9, (v) => v <= 0.1 + 1e-9]), detail: `heat deaths ${pct1(p)} of the birds` }; },
  'heat-finish': (farm) => { const h = day(farm, 38).pant ?? 0; return { tier: h <= 3 + 1e-9 ? 0 : null, detail: `${(Math.round(h * 10) / 10)} hours of panting per bird on day 38` }; },
  'catch-air': (farm) => { const r = farm.harvest.result; if (!r) return null; return { tier: (r.fansMin ?? 0) >= HARVEST.catchFansMin ? 0 : null, detail: `at least ${r.fansMin ?? 0} tunnel fans running through the catch` }; },
  // ---------------- Moisture & Minimum Ventilation ----------------
  'minvent-l1': timerMornings('level1', 6), 'minvent-w2': timerMornings('week2', 5), 'minvent-w3': timerMornings('week3', 5),
  'litter-l1': (farm, records) => { const q = notes(records, 'litter', 7).map((n) => n.value.moisturePct); if (!q.length) return null; const m = q.reduce((a, b) => a + b, 0) / q.length; return { tier: m <= 30 + 1e-9 ? 0 : null, detail: `litter ${Math.round(m)} % on day 7` }; },
  'litter-w3': (farm, records) => {
    let n = 0;
    for (const d of range(15, 21)) { const r = records.row(d); if (r && r.litterMoisturePct != null && r.litterMoisturePct <= 30 + 1e-9) n++; }
    const caked = day(farm, 21).cakedAtSign;
    return { tier: n >= 5 ? (caked != null && caked <= 0.02 + 1e-9 ? 1 : 0) : null, detail: `litter at 30 % or under on ${n} days${caked != null ? `, ${Math.round(caked * 100)} % caked on day 21` : ''}` };
  },
  'pad-overflow': (farm) => { const p = prob(farm, 'pad-overflow'); if (!p || p.phase !== 'fixed') return null; const ok = p.fixedBy === 'float' && farm.stats.padPatchedAt != null; return { tier: ok ? 0 : null, detail: ok ? 'float valve freed and the wet strip covered' : 'the wet strip is not covered yet' }; },
  'ammonia-w45': (farm) => { const days = range(22, 35), all = sum(farm, days, 'nh3All'); if (!all) return null; const lo = sum(farm, days, 'nh3Lo'); return { tier: lo / all >= 0.95 ? 0 : null, detail: `ammonia under 20 ppm ${Math.round((100 * lo) / all)} % of the time` }; },
  // ---------------- Heating ----------------
  'preheat-day': (farm) => { const t = farm.stats.preheatAt; return { tier: t != null && t <= -1 + 0.5 + 1e-9 ? 0 : null, detail: t != null ? `brooders at 30 °C or more from day ${Math.floor(t)} ${hm(t)}` : 'no pre-heating on the prep day' }; },
  'cold-night': (farm) => { const v = day(farm, 3).nightMin; if (v == null) return null; return { tier: v >= -1 - 1e-9 ? 0 : null, detail: `night low ${v >= 0 ? '+' : ''}${(Math.round(v * 10) / 10)} °C against the target on day 3` }; },
  'thermostat-off': (farm) => { const h = day(farm, 6).heatOff1217 || 0; return { tier: h >= 2 - 1e-9 ? 0 : null, detail: `brooders off ${(Math.round(h * 10) / 10)} h of the warm afternoon` }; },
  'setpoint-w2': (farm) => { let n = 0; const days = levelDays('week2'); for (const d of days) { const a = day(farm, d).am; if (a && Math.abs(a.setpoint - a.sign) <= 1 + 1e-9) n++; } return { tier: n === days.length ? 0 : null, detail: `morning setpoint by the table on ${n} of ${days.length} days` }; },
  'nights-w2': (farm) => { let n = 0; for (const d of levelDays('week2')) { const v = day(farm, d).nightMin; if (v != null && v >= -2 - 1e-9) n++; } return { tier: n >= 6 ? 0 : null, detail: `${n} nights at the target` }; },
  'no-overheat-w2': (farm) => { const h = sum(farm, levelDays('week2'), 'overH'); return { tier: h < 1e-6 ? 0 : null, detail: h < 1e-6 ? 'no overheating with the brooders burning' : `${(Math.round(h * 10) / 10)} h more than 3 °C over the target with the brooders burning` }; },
  'gas-w13': (farm) => { const g = day(farm, 21).gasAtSign ?? farm.stats.gasKg; if (g == null) return null; return { tier: tierAt(g, [(v) => v <= 300, (v) => v <= 250]), detail: `${Math.round(g)} kg of gas to day 21` }; },
  'brooders-up': (farm) => { const t = farm.stats.broodersUpAt; if (t == null) return { tier: null, detail: 'brooders still down' }; const cold = sum(farm, range(Math.ceil(t), 35), 'cold'); return { tier: t <= 22 + 18 / 24 + 1e-9 && cold <= 1 ? 0 : null, detail: `brooders up on day ${Math.floor(t)} at ${hm(t)}` }; },
  // ---------------- Water ----------------
  'flow-w2': flows('week2', 5), 'flow-w3': flows('week3', 5), 'flow-w45': flows('weeks45', 10), 'flow-fin': flows('finish', 5),
  'raised-w2': raised(14), 'raised-w3': raised(21),
  'medicine-course': (farm) => { const m = farm.health.medication; if (m.from == null) return null; const h = m.onH || 0; return { tier: h >= 70 || (m.on && h >= 48) ? 0 : null, detail: `medicine in the water for ${(Math.round(h / 2.4) / 10)} days` }; },
  'lines-cleaned': (farm) => { const c = farm.clean; const ok = c.closedDay != null ? !!farm.stats.linesCleanAtClose : c.lines.every((v) => v >= 1); return { tier: ok ? 0 : null, detail: `${c.lines.filter((v) => v >= 1).length} of 4 drinker lines disinfected` }; },
  // ---------------- Feed & Digestion ----------------
  'pans-flooded': (farm) => { let n = 0; for (const d of range(0, 3)) { const a = day(farm, d).am; if (a && a.flooded && a.pans.every((h) => h <= 6 + 1e-9)) n++; } return { tier: n === 4 ? 0 : null, detail: `pans flooded on the litter on ${n} of days 0–3` }; },
  'never-out-l1': neverOut('level1'), 'never-out-w2': neverOut('week2'), 'never-out-w3': neverOut('week3'), 'never-out-w45': neverOut('weeks45'), 'never-out-fin': neverOut('finish'),
  'pellet-change': (farm) => {
    const s = farm.stats, t = s.growerAt90;
    if (t == null) return null;
    const ratio = (d) => { const a = day(farm, d), b = day(farm, d + 1); return a.std > 0 && b.feed0 != null ? (b.feed0 - a.feed0) / a.std : null; };
    const dips = [15, 16].map((d) => { const r0 = ratio(d - 1), r1 = ratio(d); return r0 && r1 ? 1 - r1 / r0 : 0; });
    const dip = Math.max(...dips);
    return { tier: t <= 16.75 + 1e-9 && dip < 0.05 ? ((s.blendH || 0) >= 24 - 1e-6 ? 1 : 0) : null, detail: `pans grower from day ${Math.floor(t)} ${hm(t)}, intake change ${Math.round(-dip * 100)} %` };
  },
  'droppings-read': (farm, records) => { const n = notes(records, 'bird').filter((k) => k.day >= 15 && k.day <= 21 && k.value.look === 'droppings').length; return { tier: n >= 10 ? 0 : null, detail: `droppings looked at on ${n} birds` }; },
  'rim-w2': rims('week2'), 'rim-w3': rims('week3'),
  'finisher-change': (farm) => { const t = farm.stats.finisherAt90; return { tier: t != null && t >= 29.25 - 1e-9 && t < 31 ? 0 : null, detail: t != null ? `pans finisher from day ${Math.floor(t)} ${hm(t)}` : 'no finisher in the pans' }; },
  'heat-feeders': (farm) => { const n = [30, 31, 32].filter((d) => (day(farm, d).feedersUp || 0) >= 4).length; return { tier: n >= 2 ? 0 : null, detail: `feeders up in the hottest hours on ${n} heat-wave days` }; },
  'withdrawal': (farm) => { const h = farm.harvest; if (h.withdrawalH == null) return null; const [a, b] = HARVEST.withdrawalH; return { tier: h.withdrawalH >= a - 1e-9 && h.withdrawalH <= b + 1e-9 ? 0 : null, detail: `pans empty ${(Math.round(h.withdrawalH * 10) / 10)} h before the catch` }; },
  // ---------------- Lighting ----------------
  'light-23h': (farm) => { let n = 0; for (const d of range(0, 6)) { const a = day(farm, d).am; if (a && a.dark != null && a.dark <= 2) n++; } return { tier: n === 7 ? 0 : null, detail: `22 hours of light or more on ${n} of days 0–6` }; },
  'lux-l1': (farm) => { let n = 0; for (const d of range(0, 7)) { const a = day(farm, d).am; if (a && a.lux >= 26 && a.lux <= 44) n++; } return { tier: n >= 6 ? 0 : null, detail: `30–40 lux at chick level on ${n} days` }; },
  'light-arrival': (farm) => { const l = farm.stats.lightAtTip; if (!l) return null; const ok = l.on && l.dimmer >= 0.5 && l.dark <= 1; return { tier: ok ? 0 : null, detail: `lights ${l.on ? 'on' : 'off'} at ${Math.round(l.dimmer * 60)} lux when the chicks arrived` }; },
  'dark-w2': darkDays('week2', 6), 'dark-w45': darkDays('weeks45', 12),
  'lux-measured': (farm, records) => { const p = notes(records, 'lux').filter((n) => n.day >= 8 && n.day <= 14 && n.where); const sec = new Set(p.map((n) => houseSector(n.where[0], n.where[1]))).size; return { tier: p.length >= 3 && sec >= 3 ? 0 : null, detail: `${p.length} light readings from ${sec} parts of the house` }; },
  'sds-w2': (farm) => { const p = sharePct(farm, deathsOf(farm, 'sds')); return { tier: tierAt(p, [(v) => v <= 0.1 + 1e-9, (v) => v <= 0.05 + 1e-9]), detail: `${deathsOf(farm, 'sds')} birds found dead on their backs (${pct1(p)})` }; },
  'lame-w3': (farm) => { const n = deathsOf(farm, 'legs') + (((farm.flock.cullsBy && farm.flock.cullsBy.lame) || 0) - (ls(farm).lameCulls || 0)); const p = sharePct(farm, n); return { tier: p <= 0.2 + 1e-9 ? 0 : null, detail: `${n} lame birds (${pct1(p)})` }; },
  'catch-light': (farm) => { const r = farm.harvest.result; if (!r) return null; return { tier: (r.luxMax ?? 99) <= 12 ? 0 : null, detail: `${r.luxMax} lux at bird height through the catch` }; },
  // ---------------- Growth & Performance ----------------
  'w14-weight': weight(14), 'w21-weight': weight(21), 'w35-weight': weight(35),
  'weighed-weekly': (farm) => { const n = [7, 14, 21, 28, 35, 40].filter((d) => farm.stats.weighed.filter((x) => Math.floor(x.t) === d).length >= 50).length; return { tier: n === 6 ? 0 : null, detail: `50 birds weighed on ${n} of the 6 weigh days` }; },
  'harvest-fcr': (farm) => { const r = farm.harvest.result; if (!r || r.fcr == null) return null; return { tier: tierAt(r.fcr, [(v) => v <= 1.75 + 1e-9, (v) => v <= 1.65 + 1e-9]), detail: `feed conversion ${r.fcr.toFixed(2)}` }; },
  'harvest-uniformity': (farm) => { const r = farm.harvest.result; if (!r || r.uniformityPct == null) return null; return { tier: r.uniformityPct >= 70 ? 0 : null, detail: `uniformity ${Math.round(r.uniformityPct)} % at the day ${r.uniformityDay} weighing` }; },
  'epef': (farm) => { const r = farm.harvest.result; if (!r || r.epef == null) return null; return { tier: tierAt(r.epef, [(v) => v >= 340, (v) => v >= 390]), detail: `production efficiency ${r.epef}` }; },
};

export const RULES_CYCLE = {
  // ---------------- Farm Planning ----------------
  'plan-measured': (farm) => { const p = farm.plan; if (!p || p.sentAt == null) return null; const m = p.measuredAt || {}; const ok = m.length != null && m.width != null && m.length <= p.sentAt && m.width <= p.sentAt; return { tier: ok ? 0 : null, detail: ok ? `house measured ${p.measured.length} × ${p.measured.width} m` : 'plan sent without the measured floor' }; },
  'plan-meets': (farm) => { const s = farm.plan && farm.plan.sums; if (!s) return null; const v = s.salePerWeek, c = PLAN_CONTRACT.salePerWeek; return { tier: v >= c ? (v <= 1.05 * c ? 1 : 0) : null, detail: `${Math.round(v).toLocaleString('en-US')} birds for sale a week (contract ${c.toLocaleString('en-US')})` }; },
  'plan-density': (farm) => { const s = farm.plan && farm.plan.sums; if (!s) return null; return { tier: s.densityKgM2 <= PLAN_CONTRACT.densityMaxKgM2 + 1e-9 ? 0 : null, detail: `${s.densityKgM2} kg/m² at catching` }; },
  'plan-rest': (farm) => { const s = farm.plan && farm.plan.sums; if (!s) return null; return { tier: s.restDays >= 21 ? 0 : null, detail: `${s.restDays} days of rest in the plan` }; },
  'catch-booked': (farm) => { const h = farm.harvest; if (h.bookedAt == null || h.catchAt == null) return null; const ahead = (h.catchAt - h.bookedAt) * 24; return { tier: ahead >= HARVEST.bookAheadH - 1e-6 ? 0 : null, detail: `booked ${(Math.round(ahead / 2.4) / 10)} days before the catch` }; },
  'last-order': (farm) => { const h = farm.harvest; if (h.feedLeftKg == null) return null; return { tier: h.feedLeftKg < 1200 ? 0 : null, detail: `${Math.round(h.feedLeftKg).toLocaleString('en-US')} kg of feed left at catching` }; },
  'sold-as-planned': (farm, records, ctx) => {
    const r = farm.harvest.result, p = planOf(farm, ctx);
    if (!r || !p) return null;
    const want = p.decisions.birdsPerHouse * (1 - p.decisions.lossesPct / 100);
    const t = r.sold >= want ? (r.meanLiveG >= p.decisions.saleKg * 1000 ? 1 : 0) : null;
    return { tier: t, detail: `${r.sold.toLocaleString('en-US')} birds sold at ${(r.meanLiveG / 1000).toFixed(2)} kg (plan ${Math.round(want).toLocaleString('en-US')} at ${p.decisions.saleKg} kg)` };
  },
  'losses-as-planned': (farm, records, ctx) => { const r = farm.harvest.result, p = planOf(farm, ctx); if (!r || !p) return null; return { tier: r.mortalityPct <= p.decisions.lossesPct + 1e-9 ? 0 : null, detail: `losses ${pct1(r.mortalityPct)} (plan ${p.decisions.lossesPct} %)` }; },
  'cycle-as-planned': (farm, records, ctx) => { const c = farm.clean, p = planOf(farm, ctx); if (!p || c.bookedDay == null) return null; const d = c.bookedDay; return { tier: Math.abs(d - p.decisions.cycleDays) <= 3 ? 0 : null, detail: `next chicks on day ${d} (plan: day ${p.decisions.cycleDays})` }; },
  // ---------------- Biosecurity & Health ----------------
  'gate-route': (farm) => { const g = farm.stats.gate || {}; const n = ['sign', 'change', 'gateDip', 'houseDip'].filter((k) => g[k]).length; return { tier: n === 4 ? 0 : null, detail: `${n} of the 4 gate steps on the planning day` }; },
  'dips-l1': dips('level1'), 'dips-w2': dips('week2'), 'dips-w3': dips('week3'), 'dips-w45': dips('weeks45'), 'dips-fin': dips('finish'),
  'dead-w2': deadRounds('week2'), 'dead-w3': deadRounds('week3'), 'dead-w45': deadRounds('weeks45'),
  'vaccine-drunk': (farm) => { const v = farm.health.vaccine; if (v.state !== 'drunk' || v.hours == null) return null; return { tier: tierAt(v.hours, [(h) => h <= 2.5 + 1e-9, (h) => h <= 2 + 1e-9]), detail: `vaccine drunk in ${v.hours} h on day 12` }; },
  'lame-culled': (farm) => { const left = [11, 12, 13, 14].filter((d) => (day(farm, d).lameAtSign || 0) > 0).length; return { tier: left === 0 ? 0 : null, detail: left ? `lame birds still on the floor on ${left} evenings` : 'no lame bird left on the floor in the evening' }; },
  'cocci-treated': (farm) => { const p = prob(farm, 'coccidiosis'), m = farm.health.medication; if (!p || p.foundAt == null) return null; const ok = m.from != null && Math.floor(m.from) === Math.floor(p.foundAt); return { tier: ok ? 0 : null, detail: m.from != null ? `medicine in the water on day ${Math.floor(m.from)} at ${hm(m.from)}` : 'no medicine in the water' }; },
  'swabs-clean': (farm) => { const lab = farm.clean.lab; if (!lab) return null; return { tier: lab.positive === 0 ? 1 : lab.positive <= CLEAN.maxPositive ? 0 : null, detail: `${lab.positive} of ${lab.of} swabs grew bacteria` }; },
  'rest-3w': (farm) => { const c = farm.clean; if (c.bookedDay == null || c.closedDay == null) return null; const r = c.bookedDay - c.closedDay; return { tier: r >= 21 ? 0 : null, detail: `${r} days of rest` }; },
  // ---------------- Chick Arrival & Brooding ----------------
  'curtain-ready': (farm) => { const s = farm.stats; if (s.coverAtLift == null) return null; return { tier: s.coverAtLift >= 0.95 ? 0 : null, detail: `litter on ${Math.round(s.coverAtLift * 100)} % of the house at the lift` }; },
  'curtain-day': (farm) => { const t = farm.stats.curtainAt; if (t == null) return null; const d = Math.floor(t); return { tier: d >= 9 && d <= 11 ? 0 : null, detail: `curtain lifted on day ${d}` }; },
  ...RULES_B,
};
