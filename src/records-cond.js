// Flock records of the Phase 4 conditions (PHASE4.md §3.3, §9.3): the facts of the day logged from the bus into the
// day's extras (extras[d].cond, saved with the records) and composed into plain notes when the row is built: storms,
// the power cut and the generator, rain at the inlets and the flaps, the hot season's outside readings, heat wave and hot
// nights, the line water at the flush, a bad batch's chicks and the hatchery, the well water, the pump and the tank.
// Plain facts only: nothing here is a verdict. Package "sim", pure logic.
import { EV } from './events.js';

const hm = (h) => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const r1 = (v) => (Math.round(v * 10) / 10).toLocaleString('en-US');
const thousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Log the condition facts of the bus into extras[d].cond (records.js calls it once with its own ex()). */
export function installCondRecords({ farm, env, events, ex, today, live }) {
  if (!events) return;
  const C = (d = today()) => { const e = ex(d); return e.cond || (e.cond = {}); };
  const H = () => +(env ? env.hour : 0).toFixed(3);
  const push = (k, v, d) => { const c = C(d); (c[k] || (c[k] = [])).push(v); };
  events.on(EV.POWER, (p) => { if (live() && farm && farm.condition) push('power', [H(), p.on ? 1 : 0, p.source ?? null, p.mains ? 1 : 0]); });
  events.on(EV.FARM_PROBLEM, (p) => {
    if (!live() || !farm || !farm.condition || !p) return;
    if (p.phase === 'start' && /^storm-/.test(p.id)) { const def = farm.levelFor && farm.levelFor().problems.find((x) => x.id === p.id); if (def && def.until) C().storm = [def.hour, def.until.hour]; }
    if (p.phase === 'start' && p.id === 'power-cut') C().cutAt = H();
    if (p.phase === 'symptom' && p.id === 'gen-dry') push('dark', H());
    if (p.phase === 'symptom' && p.id === 'rain-in') C().rainIn = 1;
    if (p.phase === 'fixed' && p.id === 'pump-wear' && farm.waterTank) C().pumpFix = [farm.waterTank.fixFrom, farm.waterTank.fixedAt];
    if (p.phase === 'symptom' && p.id === 'weak-batch') C().weakSeen = 1;
  });
  events.on(EV.FARM_DELIVERY, (p) => { if (live() && p && p.kind === 'chicks' && p.phase === 'arrive' && p.note) C().delivery = p.note; });
  events.on(EV.ACTION, (p) => {
    if (!live() || !farm || !farm.condition || !p || !p.id) return;
    const r = p.result;
    switch (p.id) {
      case 'gen.start': if (r && r.running) push('genOn', H()); break;
      case 'gen.stop': push('genOff', H()); break;
      case 'gen.switch': push('switch', [H(), p.to === 'generator' ? 'generator' : 'mains']); break;
      case 'gen.test': if (r) C().genTest = [H(), r.ok ? 1 : 0]; break;
      case 'inlets.storm': push('flaps', [H(), p.closed ? 1 : 0]); break;
      case 'water.test': if (r && r.ironMgL != null) C().iron = r.ironMgL; break;
      case 'water.tank': if (r) C().tank = [H(), r.pumpBar, r.pumpA, r.lowPct, r.lowAt]; break;
      case 'water.flush': if (p.on && farm.water.lineTempC) { const c = C(); if (c.lineC == null) c.lineC = [H(), +Math.max(...farm.water.lineTempC).toFixed(1)]; } break;
      case 'chicks.grade': if (r && r.looked > 0) { const c = C(), g = c.grade || (c.grade = [0, 0, 0]); g[0] += r.looked; g[1] += r.weak; g[2] += r.culled; } break;
      case 'phone.hatchery': C().hatchery = H(); break;
      case 'controller.read': case 'fans.read': break;
      default:
    }
  });
}

/** The condition's notes of a row (composed from extras[d].cond and the farm). */
export function condNotes(day, { extras, farm, env }) {
  const c = (extras[day] && extras[day].cond) || {}, out = [];
  if (!farm || !farm.condition) return out;
  if (c.delivery) out.push(`Chicks: ${c.delivery}`);
  if (c.storm) out.push(`Storm ${hm(c.storm[0])}–${hm(c.storm[1])}`);
  // the power cut: off, the generator, the mains' return
  if (c.cutAt != null) {
    const def = farm.levelFor && farm.levelFor().problems.find((p) => p.id === 'power-cut'), back = def && def.back ? def.back.hour : null;
    const genOn = (c.genOn || []).find((h) => h >= c.cutAt), stop = (c.genOff || []).find((h) => back == null || h >= back);
    let s = `Power cut ${hm(c.cutAt)}–${back != null ? hm(back) : '?'}`;
    s += genOn != null ? `; generator on at ${hm(genOn)}` : ', no generator';
    if (genOn != null && back != null) s += `; mains back ${hm(back)}${stop != null ? `, generator stopped ${hm(stop)}` : ', generator left running'}`;
    out.push(s);
  }
  for (const h of c.dark || []) { const on = (c.genOn || []).find((g) => g >= h); out.push(`House dark at ${hm(h)}: the generator stopped${on != null ? `; started again at ${hm(on)}` : ''}`); }
  const off = farm.condX && farm.condX.st && farm.condX.st.powerOff ? farm.condX.st.powerOff[day] : null;
  if (off && c.cutAt == null && !(c.dark || []).length) out.push(`House without power for ${Math.round(off)} minutes`);
  if (c.genTest) out.push(`Generator test-run at ${hm(c.genTest[0])}${c.genTest[1] ? '' : ': it did not start'}`);
  const rained = c.rainIn || (farm.condX && farm.condX.rainDays && farm.condX.rainDays[day]);
  const closed = (c.flaps || []).find((f) => f[1] === 1);
  if (rained) out.push(`Rain in at the south inlets${closed ? `; storm flaps closed ${hm(closed[0])}` : ''}`);
  else if (closed && c.storm) out.push(`Storm flaps closed ${hm(closed[0])}`);
  if (farm.condition === 'hot' && env) {
    const S = farm.condX && farm.condX.st, o = S && S.outsideMax ? S.outsideMax[day] : null;
    if (o) out.push(`Outside ${r1(o[0])} °C at ${hm(o[1])}, controller`);
    const evs = env.weatherEvents || [], has = (id, t) => evs.some((e) => e.id === id && t > e.fromDay && t < e.toDay);
    if (has('heat-wave', day + 15 / 24)) out.push(`Heat wave: ${Math.round(env.outsideAt(day + 15 / 24))} °C at 15:00`);
    if (has('hot-spell', day + 23 / 24)) out.push(`Hot night: ${r1(env.outsideAt(day + 23 / 24))} °C at 23:00`);
    if (c.lineC) out.push(`Water in the lines ${r1(c.lineC[1])} °C before the flush at ${hm(c.lineC[0])}`);
    // review round: what decided the hot afternoons: the house at 15:00 beside the row, the pad and the tunnel fans
    const pm = S && S.pm15 ? S.pm15[day] : null;
    if (pm) out.push(`Afternoon: house ${r1(pm[0])} °C at 15:00 (${day < 21 ? 'row' : 'target'} ${r1(pm[1])} °C), pad ${pm[2] ? 'on' : 'off'}, ${pm[3]} tunnel fan${pm[3] === 1 ? '' : 's'}`);
  }
  if (c.grade) {
    const w = farm.stats && farm.stats.chickWeightMeasuredG, told = farm.condX && farm.condX.hatcheryAt != null;
    out.push(`Chicks: ${w != null ? `${r1(w)} g, ` : ''}${r1((100 * c.grade[1]) / Math.max(1, c.grade[0]))} % weak at grading; ${thousands(c.grade[2])} graded out${told ? ' (claimed)' : ', not claimed: the hatchery was not told on day 0'}`);
  }
  if (c.hatchery != null) out.push('Chick quality reported to the hatchery');
  if (c.iron != null) out.push(`Well water: iron ${r1(c.iron)} mg/L`);
  if (c.tank) out.push(`Pump ${r1(c.tank[1])} bar, ${r1(c.tank[2])} A at ${hm(c.tank[0])}; tank lowest ${Math.round(c.tank[3])} %${c.tank[4] != null ? ` at ${hm((c.tank[4] % 1) * 24)}` : ''}`);
  if (c.pumpFix && c.pumpFix[0] != null && c.pumpFix[1] != null) out.push(`Pump repaired ${hm((c.pumpFix[0] % 1) * 24)}–${hm((c.pumpFix[1] % 1) * 24)}`);
  return out;
}

/** The timeline's Phase 4 fields of a day: the hottest outside reading he took, the minutes without power. */
export function condTimeline(day, farm) {
  const S = farm && farm.condX && farm.condX.st;
  const o = S && S.outsideMax ? S.outsideMax[day] : null, off = S && S.powerOff ? S.powerOff[day] : null;
  return { outsideMaxC: o ? o[0] : null, powerOffMin: off != null ? Math.round(off) : null };
}
