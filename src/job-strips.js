// Job strips (the clarity round: every job says what to do and what the finished outcome is). The open job
// done at a panel shows there as a strip: its steps with live progress, the target from the sign beside the
// live value ("Air your flock needs (vent sign table): 928 m³/h | your timer: 960 m³/h"), and a note when the
// job needs farm time to pass. Pure logic (node and browser): rows of plain text; ui-jobstrip.js draws them.
// Neutral words only: figures side by side, never a verdict. Every figure is a sign's or plate's (named) or
// the farmer's own reading; the done rules read the same figures (job-figures.js).
//
//   STRIPS[jobId] = { panels: { panelId: section|null }, title?, rows(c, inst) -> Row[] }
//     panelId 'drinker' = every drinker-N panel; the controller's sections: 'top' (above the tabs) | 'temp' |
//     'vent' | 'lights'; null = anywhere in the panel. A job without an entry shows its rule's parts
//     (labels from content-jobs) in the panel its spot names (SPOT_PANEL).
//   Row: { k: 'step', text, done } | { k: 'cmp', what, sign, yours, bar } | { k: 'line', text } |
//        { k: 'note', text } | { k: 'time', text, bar }   (bar 0..1 or null)
//   c = { env, farm, records, skills, engine, props, line?, ventDraft?, weighings? } (ui-jobstrip builds it)
import { EQUIP, LEVEL1, FAN_COUNT, MIN_VENT_PER_1000, flockAgeAt, feedStdGAt } from './config.js';
import { FEED } from './farm-feed.js';
import { int, one, hhmm } from './ui-format.js';
import { ventNeed, ventTableRows, timerAirM3h, knownFlock, nippleCmToday, rimCmNow, nippleInBand, rimInBand, flowToday, brooderRowC, luxOfDimmer,
  fansWorking, VENT_BAND, NIPPLE_DAY0_CM, PANS_ON_LITTER_CM, HEIGHT_BAND_CM, FLOW_BAND } from './job-figures.js';

export const step = (text, done = false) => ({ k: 'step', text, done: !!done });
export const cmp = (what, sign, yours, bar = null) => ({ k: 'cmp', what, sign, yours, bar: bar == null ? null : Math.max(0, Math.min(1, bar)) });
export const line = (text) => ({ k: 'line', text });
export const note = (text) => ({ k: 'note', text });
export const time = (text, bar) => ({ k: 'time', text, bar: Math.max(0, Math.min(1, bar ?? 0)) });
export const pct = (v) => `${Math.round((v ?? 0) * 100)} %`;
const cm = (v) => `${Math.round(v)} cm`;
const C1 = (v) => `${one(v)} °C`;

/** The panel a job's spot names (the strip shows there when the job has no STRIPS entry). */
export const SPOT_PANEL = { controller: 'controller', feederBox: 'feeder-box', waterSupply: 'water-supply', fanPanel: 'fan-panel', padPump: 'pad-pump',
  officeDesk: 'office-desk', silo: 'silo', litterHeap: 'litter-heap', birdScale: 'bird-scale', chickTable: 'chick-table', washBay: 'wash-bay',
  loadingBay: 'loading-bay', curtainWinch: 'curtain-winch' };
const spotPanel = (spot) => (spot?.startsWith('drinkers.') ? 'drinker' : SPOT_PANEL[spot] || null);

/** The engine's parts of a job as step rows (and a time row for a part that must hold for farm minutes). */
export function partRows(c, inst, { skip = [] } = {}) {
  const out = [];
  c.engine.parts(inst).forEach((p, i) => {
    if (skip.includes(i) || !p.label) return;
    if (p.held && !p.met) out.push(time(heldText(p), p.held.min / p.held.of));
    else out.push(step(p.label, p.met));
  });
  return out;
}
/** "The chicks feel near the target: 12 of 30 farm minutes so far: close the panel and let the clock run". */
export function heldText(p) {
  const m = Math.floor(p.held.min), of = p.held.of, what = (p.label || '').replace(/ for \d+ farm minutes.*$/, '');
  return m <= 0 ? `${what}: not yet (it must hold for ${of} farm minutes)` : `${what}: ${m} of ${of} farm minutes so far: close the panel and let the clock run`;
}

// ---------------- shared rows ----------------
/** The vent sign's table read for the flock the farmer knows: "480 per 1,000 at 200 g, 950 at 500 g -> about 560 per 1,000". */
function tableText(v) {
  if (v.weightG <= MIN_VENT_PER_1000[0][0] + 2) return `${int(MIN_VENT_PER_1000[0][1])} m³/h per 1,000 at ${MIN_VENT_PER_1000[0][0]} g`;
  const [[w0, q0], [w1, q1]] = ventTableRows(v.weightG, MIN_VENT_PER_1000);
  return `${int(q0)} per 1,000 at ${int(w0)} g, ${int(q1)} at ${int(w1)} g → about ${int(v.per1000)} per 1,000`;
}
const timerText = (t) => (t && t.fans > 0 && t.onSec > 0 ? `${t.fans} fan${t.fans === 1 ? '' : 's'} ${t.onSec}/${t.cycleSec} s` : 'off');
/** Air the flock needs beside the timer's air (and the setting not sent yet, if the panel has one). */
export function ventRows(c, { purpose = true, example = false } = {}) {
  const v = ventNeed(c.env, c.farm), out = [];
  if (purpose) out.push(line('Minimum ventilation brings fresh air in and moisture and ammonia out, even on cold days (Broiler Ventilation).'));
  out.push(line(v.prep ? `Set it now for tomorrow’s flock: ${int(v.birds)} chicks of about ${int(v.weightG)} g (the vent sign’s example).`
    : `Your birds: ${int(v.birds)} (placed less your dead counts and culls), about ${int(v.weightG)} g (${v.weightFrom}).`));
  out.push(cmp(`Air your flock needs (vent sign table: ${tableText(v)})`, `${int(v.need)} m³/h`, `timer now ${timerText(c.env.ventTimer)} = ${int(v.air)} m³/h (${pct(v.share)})`, v.need ? v.air / (v.need * VENT_BAND[1]) : 0));
  const d = c.ventDraft;
  if (d && timerText(d) !== timerText(c.env.ventTimer)) out.push(line(`This setting (not sent yet): ${timerText(d)} = ${int(timerAirM3h(d))} m³/h, ${pct(v.need ? timerAirM3h(d) / v.need : 0)} of the need.`));
  if (example) out.push(note('Worked example on the sign: 6,000 chicks of 42 g need about 900 m³/h: 1 fan, 8 s on in every 300 s.'));
  return out;
}
/** The house beside the brooder sign's row of today. */
export function houseRow(c, extra = '') {
  const d = Math.max(0, c.env.dayNumber);
  return cmp('House now', `brooder sign, day ${d}: ${C1(brooderRowC(d))}${extra}`, C1(c.env.houseTemp));
}
/** What the farmer sees of the birds' comfort: panting and huddling (an observation, like a look note). */
export function birdsSeen(c) {
  const C = c.farm.comfort || {}, k = Math.round((C.pantShare ?? 0) * 10), cold = Math.round((C.coldShare ?? 0) * 10);
  const who = c.env.dayNumber >= 8 ? 'birds' : 'chicks';
  return `${k <= 0 ? `no ${who} panting` : `about ${k} in 10 ${who} panting`} · ${cold <= 0 ? 'none huddled' : `about ${cold} in 10 huddled`} (what you see)`;
}
const brooderState = (env) => (env.broodersUp ? 'off and winched up' : env.heatersOn ? 'burning' : 'off (the house is over the thermostat)');
const lightAt = (env, farm) => env.lightProgram || farm.light || { darkStart: 2, darkHours: 1, dimmer: 1 };
const lightRows = (c, { sign, signLux }) => {
  const p = lightAt(c.env, c.farm);
  return [cmp('Light a day', sign, `${one(24 - (p.darkHours ?? 1))} h (24 − ${one(p.darkHours ?? 1)} h dark from ${hhmm(p.darkStart ?? 2)})`),
    cmp('Light at chick level', signLux, `dimmer ${pct(p.dimmer)} ≈ ${int(luxOfDimmer(p.dimmer))} lux (press L at chick level to measure)`)];
};

// ---------------- the brooding week's jobs ----------------
/** The feeder box's lines: rim, flood windows, auger, fill (one row a line). */
export function feederLine(l, i, env) {
  const auger = !l.running ? 'auger off' : l.turning ? 'auger turning' : l.noFeed ? 'auger stopped: no feed from the silo' : 'auger stopped by the control pan: pans full';
  return `Line ${i + 1} · rim ${cm(l.heightCm)} · flood windows ${l.flood ? 'open' : 'closed'} · ${auger} · pans ${pct(l.panFill)} full`;
}
export const STRIPS = {
  'prep-feeders': { panels: { 'feeder-box': null }, title: 'Fill the pans for tomorrow’s chicks',
    rows(c) {
      const out = [line('Feeder lines plate: days 0–3 pans on the litter (rim about 5 cm) and flooded, so the feed is easy to reach.')];
      c.farm.feed.lines.forEach((l, i) => { const r = step(feederLine(l, i, c.env), l.flood && l.panFill >= 0.95 && l.heightCm <= PANS_ON_LITTER_CM); r.bar = l.panFill; out.push(r); });
      out.push(note('The auger fills the pans over farm time: about 25 farm minutes for flooded pans. Close the box and let the clock run (Next job works too).'));
      return out;
    } },
  'r-feeders': { panels: { 'feeder-box': null, silo: null }, title: 'Check the feeders and the silo level', rows: (c, inst) => feederCheckRows(c, inst, true) },
  'r-feedmeter': { panels: { 'feeder-box': null }, title: 'Read the feed meter', rows: (c, inst) => [meterRow(c, inst.st)] },
  'prep-vent': { panels: { controller: 'vent' }, title: 'Set the minimum ventilation for tomorrow’s chicks',
    rows: (c, inst) => [...ventRows(c, { example: true }), ...partRows(c, inst)] },
  'r-minvent': { panels: { controller: 'vent' }, title: 'Step up the minimum ventilation for the birds’ weight',
    rows: (c, inst) => [...ventRows(c, { purpose: false }), line('Vent sign: step the timer up every day or two as the birds gain weight.'), ...partRows(c, inst)] },
  'r-controller': { panels: { controller: 'top' }, title: 'Morning read: the controller beside the signs', rows: (c, inst) => readRows(c, inst, true) },
  'r-controller-pm': { panels: { controller: 'top' }, title: 'Afternoon read: the house beside the brooder sign', rows: (c, inst) => readRows(c, inst, false) },
  'prep-preheat': { panels: { controller: 'temp' }, title: 'Pre-heat for tomorrow’s chicks',
    rows: (c) => [line('Brooder sign: floor 28–30 °C before the chicks arrive; house 34 °C on day 1.'),
      cmp('Thermostat', 'brooder sign, day 0: 34 °C', C1(c.env.heaterSetpoint)), step(`Brooders: ${brooderState(c.env)}`, c.env.heatersOn),
      line(`House now ${C1(c.env.houseTemp)}: it warms over the night. Measure the floor with T tomorrow from 06:00.`)] },
  'prep-lights': { panels: { controller: 'lights' }, title: 'Light program for the chicks',
    rows: (c, inst) => [...lightRows(c, { sign: 'light plate: 23 h', signLux: 'light plate: 30–40 lux (dimmer 50–67 %)' }), ...partRows(c, inst)] },
  'p-warm': { panels: { controller: 'top' }, title: 'The house is above its target this afternoon',
    rows(c, inst) {
      const t = c.env.ventTimer, done = inst.status === 'done';
      return [houseRow(c, ' (chicks comfortable within about 1.5 °C)'), line(`Brooders: ${brooderState(c.env)}: they go off by themselves above the thermostat.`),
        line(`Tunnel fans running: ${c.env.fansEffective ?? 0} (vent sign: keep them off for young chicks; moving air feels several degrees colder).`),
        cmp('Timer', 'vent sign for a hot afternoon: for example 2 fans, 120 s on in every 300 s', `${timerText(t)} = ${int(timerAirM3h(t))} m³/h`),
        line(birdsSeen(c)), ...partRows(c, inst), ...(done ? [note('When the afternoon cools, set the timer back by the vent sign’s table.')] : [])];
    } },
  'p-cold-night': { panels: { controller: 'top' }, title: 'Night check: a cold night is forecast',
    rows(c, inst) {
      const v = ventNeed(c.env, c.farm);
      return [houseRow(c, ` · thermostat ${C1(c.env.heaterSetpoint)}`),
        cmp('Timer air', `sign table need ${int(v.need)} m³/h: more than needed takes heat out faster than the brooders put it back (vent sign)`, `${int(v.air)} m³/h`),
        line(birdsSeen(c)), ...partRows(c, inst)];
    } },
  'prep-drinkers': { panels: { drinker: null }, title: 'Lower the lines to chick height',
    rows: (c) => [line('Drinker plate: day 0 nipple tip at chick eye level, about 10–12 cm above the litter.'),
      ...c.farm.water.lines.map((l, i) => step(`Line ${i + 1}: ${cm(l.heightCm)}${i === c.line ? ' (this line)' : ''}`, l.heightCm >= NIPPLE_DAY0_CM[0] && l.heightCm <= NIPPLE_DAY0_CM[1])),
      note('Shift + − winches 5 cm a press.')] },
  'r-drinkers': { panels: { drinker: null }, title: 'Check drinker flow and height',
    rows(c, inst) {
      const want = flowToday(c.env), nip = nippleCmToday(c.env);
      return [cmp('Flow target today', `drinker plate: age + 20 = ${want} ml/min (±${FLOW_BAND})`, `nipples: plate about ${cm(nip)} today (±${HEIGHT_BAND_CM})`),
        ...c.farm.water.lines.map((l, i) => {
          const f = l.lastFlow && l.lastFlow.at >= (inst.opensAt ?? 0) - 1e-7 ? l.lastFlow : null;
          return step(`Line ${i + 1}${i === c.line ? ' (this line)' : ''}: ${f ? `${one(f.mlMin)} ml/min at ${hhmm((f.at % 1) * 24)}` : 'not tested this round'} · nipples ${cm(l.heightCm)}`,
            f && Math.abs(f.mlMin - want) <= FLOW_BAND + 1e-9 && nippleInBand(l.heightCm, c.env));
        }),
        note('Pressure +: more flow per nipple (drinker plate). Test the line again after a change.')];
    } },
  'prep-flush': { panels: { 'water-supply': null }, title: 'Flush the water lines',
    rows: (c) => [line('Water lines sign: flush the lines about 12 hours before the chicks arrive.'),
      ...c.farm.water.lines.map((l, i) => step(`Line ${i + 1}: ${l.flushClear >= 0.99 ? 'clear' : l.flushClear > 0.02 ? 'cloudy' : 'brown'} water in the tube · flush valve ${l.flushing ? 'open' : 'closed'}`, l.flushClear >= 0.99 && !l.flushing)),
      note('Each line runs clear in about 10 farm minutes with its valve open: let the clock run, then close the valve.')] },
  'prep-litter': { panels: { 'litter-heap': null }, title: 'Spread the rice husk litter',
    rows: (c) => [cmp('Depth', 'litter sign: 5–10 cm', `${cm(c.farm.litter.depthCm)} chosen`),
      cmp('Brooding floor covered (west of the curtain)', '95 % or more', pct(c.farm.litter.cover), (c.farm.litter.cover ?? 0) / 0.95),
      note('With the barrow the clock runs slower: push it over the brooding floor, wall to wall.')] },
};

// ---------------- rows several strips share ----------------
function meterRow(c, st) {
  const birds = knownFlock(c.env, c.farm).birds, g = feedStdGAt(Math.max(0, flockAgeAt(c.env.day) + 0.5)), day = c.env.dayNumber;
  const prev = (c.records?.notebook || []).filter((n) => n.kind === 'feed.meter' && n.day < day).pop();
  const now = (c.records?.notebook || []).filter((n) => n.kind === 'feed.meter' && n.day === day).pop();
  const kgOf = (n) => (n && typeof n.value === 'object' ? n.value.kg : n?.value);
  const since = now && prev ? `, ${int(kgOf(now) - kgOf(prev))} kg since the reading of day ${prev.day}` : '';
  return cmp('Feed meter', `feed plate: ${int(birds)} birds × about ${int(g)} g = ${int((birds * g) / 1000)} kg a day`, now ? `${int(kgOf(now))} kg${since}` : 'not read yet today');
}
function feederCheckRows(c, inst, withSilo) {
  const parts = c.engine.parts(inst), rim = rimCmNow(c.env), out = [];
  out.push(line(c.env.dayNumber < 4 ? 'Feeder plate, days 0–3: pans on the litter (about 5 cm) and flooded, feed in every pan.'
    : `Feeder plate: pan rim at the height of the birds’ backs (about ${cm(rim)} today, ±${HEIGHT_BAND_CM}), feed in every pan.`));
  c.farm.feed.lines.forEach((l, i) => { const r = step(feederLine(l, i, c.env), l.running && l.panFill >= FEED.accessFill && (c.env.dayNumber < 4 || rimInBand(l.heightCm, c.env))); r.bar = l.panFill; out.push(r); });
  out.push(meterRow(c, inst.st), step('Read the feed meter (feeder box)', parts[0]?.met));
  if (withSilo) {
    const birds = knownFlock(c.env, c.farm).birds, g = feedStdGAt(Math.max(0, flockAgeAt(c.env.day) + 0.5));
    const read = parts[1]?.st?.payload?.result;
    out.push(cmp('Silo gauge (outside, north of the house)', `silo plate: order below 2 days of feed (about ${int((2 * birds * g) / 1000)} kg today)`,
      read ? `about ${int(read.kg)} kg` : 'not read yet today'), step('Read the silo gauge', parts[1]?.met));
  }
  return out;
}
function readRows(c, inst, all) {
  const mm = c.minmax?.() || {}, out = [houseRow(c)];
  if (mm.min != null) out.push(line(`Min ${C1(mm.min)} / max ${C1(mm.max)} since your last read.`));
  if (all) {
    const v = ventNeed(c.env, c.farm), p = lightAt(c.env, c.farm), wk2 = c.env.dayNumber >= 8;
    out.push(cmp('Timer air', `vent sign table for about ${int(v.birds)} birds of about ${int(v.weightG)} g: about ${int(v.need)} m³/h`, `${int(v.air)} m³/h`),
      cmp('Lights', wk2 ? 'light sign: 4–6 h dark in one block, about 20 lux' : 'light plate: 23 h of light, 30–40 lux',
        `${one(24 - (p.darkHours ?? 1))} h of light, dimmer ${pct(p.dimmer)} ≈ ${int(luxOfDimmer(p.dimmer))} lux (L measures it)`));
  }
  const read = c.engine.parts(inst)[0];
  out.push(step(read?.met ? `Read into your notebook${c.readAt ? ` at ${c.readAt}` : ''}` : 'Keep the controller open a moment: it reads into your notebook', read?.met));
  return out;
}

/** Every strip to show at a panel: the open jobs whose strip (or spot) names it, the current job first. */
export function stripsAt(engine, panelId, section, extra = {}) {
  if (!engine) return [];
  const want = panelId.startsWith('drinker-') ? 'drinker' : panelId;
  const cur = engine.current?.(), out = [];
  const open = engine.open?.() || [];
  for (const inst of [...(cur ? [cur] : []), ...open.filter((i) => i !== cur)]) {
    const S = STRIPS[inst.id] || extra[inst.id];
    const panels = S ? S.panels : { [spotPanel(inst.def.spot)]: 'top' };
    if (!(want in panels)) continue;
    const sec = panels[want];
    out.push({ inst, strip: S || null, section: sec ?? null, here: section == null || sec == null || sec === section });
  }
  return out;
}
export { FAN_COUNT, EQUIP, LEVEL1, fansWorking, timerText, lightRows, lightAt, brooderState, tableText };
