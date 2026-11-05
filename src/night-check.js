// The night, read before and after it (the farmer's night report after Phase 5): the night check before a skip that
// runs through the night in the young-bird weeks, the skip's stops on trouble, and the morning summary of the night's
// deaths with their reason. Pure logic (node and the browser); the words come from heat-diag.js. Owner: integrator.
//
//   nightHoursIn(from, to)             hours of night (18:30-06:00) between two env.day times
//   nightCheck(env, farm, { toDay })   { show, lines: { temp, air, brooders } -> { state, text }, problems: [{ kind, side,
//                                      why, check, fix }], fix, cold, warm, to (the night read: the next 07:00 at least),
//                                      skipTo (toDay) } (show false: nothing to say)
//   createSkipGuard(env, farm, watch)  null, or { check() -> null | { kind, text, fix } } called at each farm hour of a skip:
//                                      a new flock watch warning, a death spike, the house falling well under the row with
//                                      the brooders at full, or holding well over it with the chicks panting (each only when
//                                      it was not so as the skip began)
//   createNightLog({ env, farm, records, events })   the env stepper behind the morning summary (records note 'night',
//                                      EV.NIGHT { day, text, deaths, byCause, notable }); serialize / restore / reset
import { AIR } from './config.js';
import { EV } from './events.js';
import { causeOf, watchState } from './flock-watch.js';
// Skills update (SKILLS.md §5.3): every open fault is a row of What is off, with its Fix it place
import { openFaults, faultWords } from './farm-faults.js';
const DEATH_KIND = { cold: 'cold', heat: 'heat', dehydration: 'water', weak: 'weak', starveout: 'weak', box: 'weak', sds: 'sds', legs: 'legs', disease: 'disease', respiratory: 'air' };
import { DIAG, airOf, hoursAhead, coldFixes, causeWords, coldCause, hotCause, rowOf, rowWords, rowC, fmtC, youngOf, birdsWord,
  timerWords, nextAt, comfortAt } from './heat-diag.js';

/** Model values of the night check and the stops (none is a sign fact). */
export const NIGHT = {
  fromH: 18.5, toH: 6, minH: 2,          // a skip with 2 h or more of night (sunset to sunrise) in it gets the check
  spikeMin: 5, spikeShare: 0.0008,        // a death spike: 5 birds or 0.08 % of the flock in a farm hour, whichever is more
  coldStopC: 3, hotStopC: 3,              // the stops: the house 3 °C under the row (brooders at full) or over it (panting)
  notableShare: 0.001,                    // the morning summary shows as a caption from 0.1 % of the flock or 3 climate deaths
};
const int = (v) => Math.round(v).toLocaleString('en');
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
const pct = (v) => `${int(v * 100)} %`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const plural = (n, w, ws = `${w}s`) => `${int(n)} ${n === 1 ? w : ws}`;
const hhmm = (t) => { const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** Hours of night (NIGHT.fromH to NIGHT.toH the next morning) between env.day times `from` and `to`. */
export function nightHoursIn(from, to) {
  let h = 0;
  for (let d = Math.floor(from) - 1; d <= Math.floor(to) + 1; d++) {
    const s = d + NIGHT.fromH / 24, e = d + 1 + NIGHT.toH / 24;
    h += Math.max(0, Math.min(to, e) - Math.max(from, s)) * 24;
  }
  return h;
}

/**
 * The open faults of the farm's equipment as night check rows (SKILLS.md §5.3): [{ kind: 'fault', side: 'equipment', id,
 * text, why, check, fix: { panel, tab, orPanel? }, signName, line? }] — the timer's first setting, the stages off, the sensor
 * reading high, a feed order not confirmed (the silo days and the mill's 16:00 rule), a stalled winch (the plate tonight and
 * tomorrow), a fouled scale.
 */
export function faultRows(env, farm) {
  if (!farm || farm.mode !== 'level') return [];
  return openFaults(farm).map((f) => {
    const w = faultWords(f, env, farm), text = w.night || w.what;
    return { kind: 'fault', side: 'equipment', id: f.id, text, why: text.replace(/\.$/, ''), check: `${w.place}: ${w.fix}`, signName: w.sign,
      fix: { panel: w.panel ?? null, tab: w.tab ?? null, ...(w.orPanel ? { orPanel: w.orPanel } : {}) }, ...(Number.isFinite(f.args?.line) ? { line: f.args.line } : {}) };
  });
}
/** The night ahead of a skip to `toDay` (the young-bird weeks; every open fault of the equipment at any age): what is off,
 *  and where to set it. */
export function nightCheck(env, farm, { toDay } = {}) {
  const faults = faultRows(env, farm);
  if (!farm || farm.mode !== 'level' || !(farm.flock?.alive > 0) || !youngOf(env, farm) || env.powerOn === false) {
    if (!faults.length || !farm || farm.mode !== 'level') return { show: false };
    const to = Math.max(toDay ?? 0, nextAt(env.day, 7));
    return { show: true, lines: {}, problems: faults, faults, fix: faults[0].fix, to, skipTo: toDay ?? null };
  }
  const row = rowOf(env), sp = env.heaterSetpoint, a = airOf(env, farm), b = birdsWord(env, farm);
  const to = Math.max(toDay ?? 0, nextAt(env.day, 7));
  const ah = hoursAhead(env, { toDay: to }), cold = ah.cold, lit = (8 - (env.brooderOut?.length || 0)) / 8;
  const problems = [];
  // what the birds feel at the coldest hour, as the flock watch reads an hour (the farm's comfort model with the brooders'
  // radiant, the tunnel fans' wind chill and the litter), or the house air itself 2 °C or more under the brooder sign's row
  const felt = comfortAt(env, farm, { houseC: cold.houseC, output: cold.output });
  const coldNight = felt.cold || cold.houseC < row - DIAG.coldC;
  if (coldNight) {
    const f = coldFixes(env, farm, { outC: cold.outC, sunCh: cold.sunCh });
    const kinds = f.fixes.map((x) => x.kind);
    if (!kinds.length) kinds.push(env.brooderOut?.length ? 'brooderOut' : 'capacity');
    for (const k of kinds) { const c = causeWords(k, env, farm, { outC: cold.outC }); problems.push({ kind: k, side: 'cold', why: c.why, check: c.check, fix: c.fix, signName: c.signName }); }
  }
  // the thermostat over the row: where the house settles tonight with the air the sign gives (today a tunnel fan or a wide
  // timer may hold it down; once that is put right the brooders take the house to the thermostat)
  if (!env.broodersUp && sp >= row + DIAG.spOverC) {
    const airFix = problems.some((p) => p.kind === 'air');
    const warm = airFix ? hoursAhead(env, { toDay: to, o: { airM3h: AIR.infiltrationM3h + Math.min(a.timerM3h, a.need * DIAG.airOver), tunnelN: 0 } }).warm : ah.warm;
    if (airFix || warm.houseC > row + DIAG.hotC) {
      const c = causeWords('thermostatHot', env, farm);
      problems.push({ kind: 'thermostatHot', side: 'hot', fix: c.fix, check: c.check, signName: c.signName, houseC: warm.houseC,
        why: airFix ? `the thermostat is at ${rowC(sp)}, ${one(sp - row)} °C over the row: once the air is right the house settles near ${fmtC(warm.houseC)} and overheats the ${b}`
          : `${c.why}: tonight the house settles near ${fmtC(warm.houseC)} and the ${b} pant` });
    }
  }
  if (a.need > 0 && a.share < DIAG.airUnder && !problems.some((p) => p.kind === 'air')) {
    problems.push({ kind: 'airLow', side: 'air', signName: 'the minimum ventilation sign', fix: { panel: 'controller', tab: 'vent' }, check: 'the minimum ventilation timer on the climate controller’s Ventilation tab (the vent sign’s setting)',
      why: `the timer gives ${int(a.timerM3h)} m³/h, ${pct(a.timerShare)} of the ${int(a.need)} m³/h the ${b} need: the damp and the ammonia stay in overnight` });
  }
  const spWords = sp >= row + DIAG.spOverC ? ` (${one(sp - row)} °C over the row)` : sp < row - DIAG.spUnderC ? ` (${one(row - sp)} °C under the row)` : '';
  const needShare = cold.needFor(row) / Math.max(1e-6, lit);
  const has = (k) => problems.some((p) => p.kind === k);
  const lines = {
    temp: { state: has('thermostatHot') || has('thermostat') ? 'red' : coldNight ? 'amber' : 'green',
      text: `House ${fmtC(env.houseTemp)} now. ${cap(rowWords(env))}. Thermostat ${rowC(sp)}${spWords}.` },
    air: { state: has('air') || has('pad') || has('airLow') ? 'red' : a.share > DIAG.airOver ? 'amber' : 'green',
      text: `Air going out now ${int(a.total)} m³/h: ${a.tunnelN ? `${plural(a.tunnelN, 'tunnel fan')} ${int(a.tunnelM3h)} (on by hand, running all the time) and ` : 'no tunnel fan; '}the timer ${int(a.timerM3h)} (${timerWords(a.timer)}). ${int(a.birds)} ${b} need about ${int(a.need)} m³/h (the vent sign’s table)${env.padOn ? '. The pad pump is on' : ''}.` },
    brooders: { state: needShare > 1 ? 'red' : needShare > 0.9 ? 'amber' : 'green',
      text: `Brooders at ${pct(env.heaterLevel)} now${env.brooderOut?.length ? `, ${plural(env.brooderOut.length, 'brooder')} out` : ''}. At ${hhmm(cold.t)}, the coldest hour (outside about ${rowC(Math.round(cold.outC))}), they would need ${pct(needShare)} of their heat to hold ${rowC(row)}${needShare > 1 ? `: the house heads for about ${fmtC(cold.houseC)}` : ''}.` },
  };
  problems.push(...faults);
  return { show: problems.length > 0, lines, problems, faults, fix: problems.find((p) => p.fix)?.fix || null, cold, warm: ah.warm, row, to, skipTo: toDay ?? null };
}

/** The flock's deaths by cause between two snapshots, biggest first: [[cause, n]]. */
const deltas = (a, b) => Object.entries(b || {}).map(([k, v]) => [k, (v || 0) - ((a || {})[k] || 0)]).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
const CAUSE_WORD = { cold: 'cold', heat: 'heat', weak: 'weakness (weak chicks)', starveout: 'starve-out', dehydration: 'thirst', box: 'the time in the boxes', other: 'other causes',
  sds: 'sudden death', legs: 'bad legs', disease: 'disease', respiratory: 'breathing trouble' };

/** The cold report of a stop: the house, its fall, the main cause and where to look; the thermostat line when it is over. */
export function coldReport(env, farm, fallCh = 0) {
  const row = rowOf(env), c = coldCause(env, farm), b = birdsWord(env, farm);
  const full = env.heaterLevel >= DIAG.fullAt ? '; the brooders are at full and cannot keep up' : '';
  const sp = env.heaterSetpoint, over = !env.broodersUp && sp >= row + DIAG.spOverC && c.kind !== 'thermostat'
    ? ` The thermostat at ${rowC(sp)} is ${one(sp - row)} °C over the row: once the air is right set it back to ${rowC(row)}, or the house will overheat the ${b}.` : '';
  return { text: `House ${fmtC(env.houseTemp)}${fallCh > 0.15 ? ` and falling ${one(fallCh)} °C an hour` : ''}, ${one(row - env.houseTemp)} °C under the row (${rowWords(env)}): ${c.why}${full}. See ${c.signName}; check ${c.check}.${over}`, fix: c.fix };
}
/** The heat report of a stop (young birds). */
export function hotReport(env, farm) {
  const row = rowOf(env), c = hotCause(env, farm) || causeWords('warmAir', env, farm), b = birdsWord(env, farm);
  return { text: `House ${fmtC(env.houseTemp)}, ${one(env.houseTemp - row)} °C over the row: ${c.why}; the ${b} are panting. See ${c.signName}; check ${c.check}.`, fix: c.fix };
}

/** The stops of one skip (see the header). */
export function createSkipGuard(env, farm, watch) {
  if (!farm || farm.mode !== 'level' || !(farm.flock?.alive > 0)) return null;
  const w0 = watch?.warnings?.length ?? 0;
  const climate = () => {
    if (!youngOf(env, farm)) return { cold: false, hot: false };
    const C = farm.comfort || {}, row = rowOf(env), held = env.heaterLevel >= DIAG.fullAt || env.heaterSetpoint < row - DIAG.spUnderC;
    return { cold: env.houseTemp <= row - NIGHT.coldStopC && held && (C.coldShare ?? 0) >= 0.5, hot: env.houseTemp >= row + NIGHT.hotStopC && (C.pantShare ?? 0) >= 0.5 };
  };
  const s0 = climate(), fl = farm.flock;
  // the death rate as the skip began (the watch's last two hourly samples): a skip run on after a stop stops again only
  // when the deaths per hour have doubled since
  const ss = watch?.samples || [];
  let rate0 = 0;
  if (ss.length >= 2) { const a = ss[ss.length - 2], b = ss[ss.length - 1], h = (b.t - a.t) * 24; if (h > 0.5) rate0 = Math.max(0, (b.dead ?? b.lost) - (a.dead ?? a.lost)) / h; }
  let lastT = env.day, lastDead = fl.deadTotal || 0, lastBy = { ...(fl.deadByCause || {}) }, lastHouse = env.houseTemp, spiked = false;
  return {
    check() {
      const ws = watch?.warnings || [];
      if (ws.length > w0) {
        const w = ws[ws.length - 1];
        const fix = w.kind === 'cold' || (w.kind === 'deaths' && /cold/.test(w.text)) ? coldCause(env, farm).fix : w.kind === 'hot' ? hotCause(env, farm)?.fix ?? null : null;
        // the review round: an equipment fault's stop names it in a few words (its what / cause / where are on the watch card)
        if (w.kind === 'equipment') return { kind: 'watch', equipment: true, fault: w.fault, text: `an equipment fault${w.short ? `, ${w.short}` : ''} (the flock watch card)`, fix: w.fix || null, warned: true };
        return { kind: 'watch', text: w.text, fix, warned: true };
      }
      const dt = (env.day - lastT) * 24;
      if (dt < 0.99) return null;
      const dead = fl.deadTotal || 0, rate = (dead - lastDead) / dt, fall = (lastHouse - env.houseTemp) / dt, by = deltas(lastBy, fl.deadByCause);
      lastT = env.day; lastDead = dead; lastBy = { ...(fl.deadByCause || {}) }; lastHouse = env.houseTemp;
      const s = climate();
      if (s.cold && !s0.cold) return { kind: 'cold', ...coldReport(env, farm, fall) };
      if (s.hot && !s0.hot) return { kind: 'hot', ...hotReport(env, farm) };
      const spike = rate >= Math.max(NIGHT.spikeMin, (fl.alive || 0) * NIGHT.spikeShare, 2 * rate0);
      if (spike && !spiked) {
        spiked = true;
        const main = by[0]?.[0], b = birdsWord(env, farm);
        // young birds' cold and heat: the heat balance's report; everything else (big birds' heat, disease, thirst …): the
        // flock watch's cause for that kind of death, with the farm's state (the fans, the pads, the power, the tank)
        const other = () => { const c = causeOf(DEATH_KIND[main] ?? null, farm.age ?? 0, watchState(env, farm)); return { text: `Likely cause: ${c.why}. See ${c.signName}; check ${c.check}.`, fix: null }; };
        const why = main === 'cold' ? coldReport(env, farm, fall) : main === 'heat' && youngOf(env, farm) ? hotReport(env, farm) : other();
        return { kind: 'spike', text: `${plural(Math.round(rate * dt), b.replace(/s$/, ''), b)} died in the last farm hour${main ? `, mostly of ${CAUSE_WORD[main] || main}` : ''}. ${why.text}`, fix: why.fix };
      }
      if (!spike) spiked = false;
      return null;
    },
  };
}

/** The morning summary: the night's deaths by cause (18:00 to 06:00) with the reason from the house's night. */
export function createNightLog({ env, farm, records, events, quiet = () => false } = {}) {
  let night = null, lastHour = null, last = null;
  function compose(n) {
    const fl = farm.flock, by = deltas(n.by, fl.deadByCause), total = by.reduce((s, [, k]) => s + k, 0);
    if (!total) return null;
    const b = n.age < 8 ? 'chicks' : 'birds', parts = [];
    for (const [k, c] of by) {
      if (k === 'heat') parts.push(`${int(c)} died of heat: the house held ${one(n.minH)}–${one(n.maxH)} °C overnight; ${n.rowWords}${n.spOver ? `; the thermostat was at ${rowC(n.sp)}` : ''}`);
      else if (k === 'cold') parts.push(`${int(c)} died of cold: the house fell to ${one(n.minH)} °C (outside ${one(n.minOut)} °C at ${hhmm(n.minOutAt)})${n.coldWhy ? `: ${n.coldWhy}` : ''}`);
      else parts.push(`${int(c)} of ${CAUSE_WORD[k] || k}`);
    }
    const climate = by.filter(([k]) => k === 'cold' || k === 'heat').reduce((s, [, k]) => s + k, 0);
    const notable = climate >= 3 || total >= Math.max(5, (n.alive || 0) * NIGHT.notableShare);
    return { day: env.dayNumber, text: `The night to day ${env.dayNumber} 06:00: ${plural(total, b.replace(/s$/, ''), b)} died since 18:00. ${parts.map(cap).join('. ')}.`, deaths: total,
      byCause: Object.fromEntries(by), notable };
  }
  const log = {
    step(e) {
      if (!farm || farm.mode !== 'level' || !(farm.flock?.placed > 0)) { night = null; return; }
      const hr = Math.floor(e.day * 24 + 1e-6);
      if (hr === lastHour) return;
      lastHour = hr;
      const h = ((hr % 24) + 24) % 24, fl = farm.flock;
      if (h === 18 && !night && fl.alive > 0) night = { t: e.day, by: { ...(fl.deadByCause || {}) }, alive: fl.alive, age: farm.age ?? 0, rowWords: rowWords(e), row: rowOf(e), sp: e.heaterSetpoint,
        spOver: false, minH: e.houseTemp, maxH: e.houseTemp, minOut: e.outsideTemp, minOutAt: e.day, coldWhy: '' };
      if (!night) return;
      night.maxH = Math.max(night.maxH, e.houseTemp);
      if (e.outsideTemp < night.minOut) { night.minOut = e.outsideTemp; night.minOutAt = e.day; }
      if (!e.broodersUp && e.heaterSetpoint >= night.row + DIAG.spOverC) { night.spOver = true; night.sp = Math.max(night.sp, e.heaterSetpoint); }
      if (e.houseTemp <= night.minH) {
        night.minH = e.houseTemp;
        if (e.houseTemp < rowOf(e) - 1) { try { night.coldWhy = coldCause(e, farm).why; } catch { night.coldWhy = ''; } }
      }
      if (h === 6) {
        const s = compose(night);
        night = null;
        if (!s || quiet()) return;
        last = s;
        records?.note?.('night', s.text);
        events?.emit?.(EV.NIGHT, { ...s });
      }
    },
    get last() { return last; },
    reset() { night = null; lastHour = null; last = null; },
    serialize() { return { v: 1, night: night ? { ...night, by: { ...night.by } } : null, lastHour, last }; },
    restore(d) { log.reset(); if (!d || d.v !== 1) return; night = d.night || null; lastHour = Number.isFinite(d.lastHour) ? d.lastHour : null; last = d.last || null; },
  };
  return log;
}
