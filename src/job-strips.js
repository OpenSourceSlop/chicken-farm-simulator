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
//        { k: 'note', text } | { k: 'time', text, bar }   (bar 0..1 or null; Phase 4, PHASE4.md §6.3: a cmp bar may be
//        { v, band: [lo, hi], max }, the value and the sign's band on a 0..max scale, drawn by ui-jobstrip.js)
//   Phase 4: the condition jobs' strips are job-strips-cond.js STRIPS_COND (stripsAt finds them too).
//   c = { env, farm, records, skills, engine, props, line?, ventDraft?, weighings? } (ui-jobstrip builds it)
import { EQUIP, LEVEL1, FAN_COUNT, MIN_VENT_PER_1000, CONDITIONS, flockAgeAt, feedStdGAt } from './config.js';
import { FEED } from './farm-feed.js';
import { int, one, hhmm } from './ui-format.js';
import { ventNeed, ventTableRows, timerAirM3h, knownFlock, nippleCmToday, rimCmNow, nippleInBand, rimInBand, flowToday, brooderRowC, luxOfDimmer,
  fansWorking, VENT_BAND, NIPPLE_DAY0_CM, PANS_ON_LITTER_CM, HEIGHT_BAND_CM, FLOW_BAND, CHICK_LUX, inletAirM3h, flapsWords } from './job-figures.js';
// the steps hotfix: the next place of a job that spans several places, and the clock's pause
import { jobPlaces, nextPlace, panelPlace, flowTodo, tubeTodo, placeKey } from './job-next.js';
import { HELD_MIN, lineReading } from './job-engine.js';
// Skills update (SKILLS.md §3.0, §6.2): the payoffs' rows at the job's places (easier now, handled, the level 1 view's line)
import { SKILLS_UPDATE, AUTO_SYSTEMS } from './config.js';
import { easierNowRows, handledLines, viewLine, viewsOfJob } from './job-words.js';
import { handedParts, variantHas } from './job-variants.js';
import { fillKeys } from './key-words.js'; // fix round: {key:id} tokens in strip lines, as the keys are bound now
// Phase 4: the condition jobs' strips (they import the row helpers from here; nothing of theirs runs at load)
import { STRIPS_COND } from './job-strips-cond.js';

export const step = (text, done = false) => ({ k: 'step', text: fillKeys(text), done: !!done });
export const cmp = (what, sign, yours, bar = null) => ({ k: 'cmp', what, sign, yours: fillKeys(yours), bar: bar == null ? null : typeof bar === 'object' ? bar : Math.max(0, Math.min(1, bar)) });
/** The vent row's bar (PHASE4.md §6.3): the share of the need on a 0–160 % scale with the sign's 90–130 % marked. */
export const ventBar = (share) => ({ v: Math.max(0, share || 0), band: [...VENT_BAND], max: 1.6 });
/** "over the sign's 90–130 %" / "under …" when the share is outside the band (else ''). */
export const ventBandWords = (share) => (share > VENT_BAND[1] + 1e-9 ? ': over the sign’s 90–130 %' : share < VENT_BAND[0] - 1e-9 ? ': under the sign’s 90–130 %' : '');
/** A bad batch brooded 1 °C warmer (config CONDITIONS.badChicks delivery targetShiftC on days 0..shiftDays, PHASE4.md
 *  §4.3): the shift on this day, else 0. Every place that prints the brooder sign's row adds it with its label. */
export function rowShiftC(c) {
  const dl = c?.farm?.condition ? CONDITIONS[c.farm.condition]?.levels?.level1?.delivery : null, d = c?.env?.dayNumber ?? 0;
  return dl && dl.targetShiftC && d >= 0 && d <= (dl.shiftDays ?? 3) ? dl.targetShiftC : 0;
}
export const SHIFT_WORDS = 'the sign’s row + 1 °C (weak batch)';
export const line = (text) => ({ k: 'line', text: fillKeys(text) });
export const note = (text) => ({ k: 'note', text: fillKeys(text) });
export const time = (text, bar) => ({ k: 'time', text, bar: Math.max(0, Math.min(1, bar ?? 0)) });
/** How long something takes in farm time (the steps hotfix): a time row without a bar; a paused clock adds its line. */
export const wait = (text) => ({ k: 'time', text, bar: null, farm: true });
export const pct = (v) => `${Math.round((v ?? 0) * 100)} %`;
const cm = (v) => `${Math.round(v)} cm`;
const C1 = (v) => `${one(v)} °C`;

/** The panel a job's spot names (the strip shows there when the job has no STRIPS entry). */
export const SPOT_PANEL = { controller: 'controller', feederBox: 'feeder-box', waterSupply: 'water-supply', fanPanel: 'fan-panel', padPump: 'pad-pump',
  officeDesk: 'office-desk', silo: 'silo', litterHeap: 'litter-heap', birdScale: 'bird-scale', chickTable: 'chick-table', washBay: 'wash-bay',
  loadingBay: 'loading-bay', curtainWinch: 'curtain-winch', generator: 'generator', waterTank: 'water-tank' };
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
  const m = Math.floor(p.held.min), of = p.held.of, what = (p.label || '').replace(/,?\s+for \d+ farm minutes.*$/, '');
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
  // the prep day (PHASE4.md §6.5): the sign's own example beside the timer; the worked figure and the band under it
  if (v.prep) {
    out.push(cmp('Air your flock needs (vent sign)', `about 900 m³/h (the sign’s example: ${int(v.birds)} chicks of ${int(v.weightG)} g)`,
      `timer now ${timerText(c.env.ventTimer)} = ${int(v.air)} m³/h (${pct(v.share)})${ventBandWords(v.share)}`, ventBar(v.share)));
    out.push(line(`${int(v.need)} m³/h worked out: ${int(v.per1000)} per 1,000 at ${int(v.weightG)} g (the table’s ${int(MIN_VENT_PER_1000[0][1])} at ${int(MIN_VENT_PER_1000[0][0])} g, a little more at ${int(v.weightG)} g); 90–130 % is ${int(VENT_BAND[0] * v.need)}–${int(Math.round((VENT_BAND[1] * v.need) / 10) * 10)} m³/h.`));
  } else out.push(cmp(`Air your flock needs (vent sign table: ${tableText(v)})`, `${int(v.need)} m³/h`, `timer now ${timerText(c.env.ventTimer)} = ${int(v.air)} m³/h (${pct(v.share)})${ventBandWords(v.share)}`, ventBar(v.share)));
  const d = c.ventDraft;
  if (d && timerText(d) !== timerText(c.env.ventTimer)) out.push(line(`This setting (not sent yet): ${timerText(d)} = ${int(inletAirM3h(c.env, d))} m³/h, ${pct(v.need ? inletAirM3h(c.env, d) / v.need : 0)} of the need.`));
  // review round: the storm flaps shut cut the inlets' air; they open again once the storm has passed (litter sign)
  if (flapsWords(c.env)) out.push(note(`The ${flapsWords(c.env)} of the timer air: open them again when the storm has passed (litter sign).`));
  if (example) out.push(note('Worked example on the sign: 6,000 chicks of 42 g need about 900 m³/h: 1 fan, 8 s on in every 300 s.'));
  return out;
}
/** The house beside the brooder sign's row of today (a bad batch on days 0–3: the row + 1 °C, so labelled). */
export function houseRow(c, extra = '') {
  const d = Math.max(0, c.env.dayNumber), sh = rowShiftC(c);
  const sign = sh ? `brooder sign, day ${d}: ${C1(brooderRowC(d))} + ${one(sh)} °C = ${C1(brooderRowC(d) + sh)} (${SHIFT_WORDS})` : `brooder sign, day ${d}: ${C1(brooderRowC(d))}`;
  return cmp('House now', `${sign}${extra}`, C1(c.env.houseTemp));
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
    cmp('Light at chick level', signLux, `dimmer ${pct(p.dimmer)} ≈ ${int(luxOfDimmer(p.dimmer))} lux (press {key:lux} at chick level to measure)`)];
};

// ---------------- the brooding week's jobs ----------------
/** The feeder box's lines: rim, flood windows, auger, fill (one row a line). */
export function feederLine(l, i, env) {
  const auger = !l.running ? 'auger off' : l.turning ? 'auger turning' : l.noFeed ? 'auger stopped: no feed from the silo' : 'auger stopped by the control pan: pans full';
  return `Line ${i + 1} · rim ${cm(l.heightCm)} · flood windows ${l.flood ? 'open' : 'closed'} · ${auger} · pans ${pct(l.panFill)} full`;
}
/** What a feeder line still needs, in the box's own key words (the steps hotfix). */
export function feederTodo(l, env, prep = false) {
  const early = prep || env.dayNumber < 4, t = [], rim = rimCmNow(env);
  if (!l.running) t.push('Start auger');
  if (early && !l.flood) t.push('Open flood windows');
  if (early && l.heightCm > PANS_ON_LITTER_CM) t.push('Pans: lower, to about 5 cm (Shift: 5 cm a press)');
  else if (!early && !rimInBand(l.heightCm, env)) t.push(`Pans: ${l.heightCm > rim ? 'lower' : 'raise'}, to about ${cm(rim)}`);
  return t.join(' · ');
}
/** The minimum ventilation setting beside the band, and the keys that move it there (prep-vent, r-minvent). */
function ventTodo(c) {
  const v = ventNeed(c.env, c.farm), d = c.ventDraft, unsent = d && timerText(d) !== timerText(c.env.ventTimer);
  const air = unsent ? inletAirM3h(c.env, d) : v.air, share = v.need ? air / v.need : 0, what = unsent ? 'This setting' : 'The timer now';
  if (share < VENT_BAND[0] - 1e-9) return step(`${what}: ${pct(share)} of the need, under 90 %. Press One second more (Shift: 10 s) until it gives 90–130 %, then Send this setting to the timer.`);
  if (share > VENT_BAND[1] + 1e-9) return step(`${what}: ${pct(share)} of the need, over 130 %. Press One second less (Shift: 10 s) until it gives 90–130 %, then Send this setting to the timer.`);
  return step(`${what}: ${pct(share)} of the need (90–130 %)${unsent ? ': press Send this setting to the timer' : ''}.`, !unsent);
}
export const STRIPS = {
  'prep-feeders': { panels: { 'feeder-box': null }, title: 'Fill the pans for tomorrow’s chicks',
    rows(c) {
      const out = [line('Feeder lines plate: days 0–3 pans on the litter (rim about 5 cm) and flooded, so the feed is easy to reach. All three lines are on this box.')];
      c.farm.feed.lines.forEach((l, i) => { const todo = feederTodo(l, c.env, true); const r = step(`${feederLine(l, i, c.env)}${todo ? `: ${todo}` : ''}`, l.flood && l.panFill >= 0.95 && l.heightCm <= PANS_ON_LITTER_CM); r.bar = l.panFill; out.push(r); });
      // PHASE4.md §6.8: the finished outcome of every line, in the plate's figures
      out.push(line('Each line is finished when: rim about 5 cm (7 at most), flood windows open, pans 95 % full.'));
      if (!c.farm.feed.lines.every((l) => l.panFill >= 0.95)) out.push(wait('The auger fills the pans over farm time: about 25 farm minutes for flooded pans. Close the box and let the clock run (Next job works too).'));
      return out;
    } },
  'r-feeders': { panels: { 'feeder-box': null, silo: null }, title: 'Check the feeders and the silo level', rows: (c, inst) => feederCheckRows(c, inst, true) },
  'r-feedmeter': { panels: { 'feeder-box': null }, title: 'Read the feed meter', rows: (c, inst) => [meterRow(c, inst.st), step('Press Read the feed meter', inst.status === 'done')] },
  'prep-vent': { panels: { controller: 'vent' }, title: 'Set the minimum ventilation for tomorrow’s chicks',
    rows: (c, inst) => [...ventRows(c, { example: true }), ventTodo(c), ...partRows(c, inst)] },
  'r-minvent': { panels: { controller: 'vent' }, title: 'Step up the minimum ventilation for the birds’ weight',
    rows: (c, inst) => [...ventRows(c, { purpose: false }), line('Vent sign: step the timer up every day or two as the birds gain weight. The new setting must give more air than the one before.'), ventTodo(c), ...partRows(c, inst)] },
  'r-controller': { panels: { controller: 'top' }, title: 'Morning read: the controller beside the signs', rows: (c, inst) => readRows(c, inst, true) },
  'r-controller-pm': { panels: { controller: 'top' }, title: 'Afternoon read: the house beside the brooder sign', rows: (c, inst) => readRows(c, inst, false) },
  'prep-preheat': { panels: { controller: 'temp' }, title: 'Pre-heat for tomorrow’s chicks',
    rows: (c) => {
      const sp = c.env.heaterSetpoint, row = brooderRowC(0), near = Math.abs(sp - row) <= 1 + 1e-9;
      return [line('Brooder sign: floor 28–30 °C before the chicks arrive; house 34 °C on day 1.'),
        cmp('Thermostat', `brooder sign, day 0: ${row} °C`, C1(sp)),
        step(near ? `Thermostat ${C1(sp)}: within 1 °C of the sign’s ${row} °C` : `Press ${sp < row ? 'Raise' : 'Lower'} the brooder thermostat (0.5 °C a press) to ${row - 1}–${row + 1} °C`, near),
        step(`Brooders: ${brooderState(c.env)}`, c.env.heatersOn),
        line(`House now ${C1(c.env.houseTemp)}: it warms over the night (the job itself is done once the thermostat is set and the brooders burn). Measure the floor with {key:probe} tomorrow from 06:00.`)];
    } },
  'prep-lights': { panels: { controller: 'lights' }, title: 'Light program for the chicks',
    rows: (c, inst) => [...lightRows(c, { sign: 'light plate: 23 h', signLux: `light plate: ${CHICK_LUX[0]}–${CHICK_LUX[1]} lux (dimmer 50–67 %)` }),
      step('Dark hours 1 h or less (Half an hour less / more), Dimmer 50–67 % (Dimmer down / up 10 %), then press Set the program.', inst.status === 'done'), ...partRows(c, inst)] },
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
    rows: (c) => [line('Drinker plate: day 0 nipple tip at chick eye level, about 10–12 cm above the litter. Each of the four lines has its own regulator at the west end of the line (line 1 by the north wall, line 4 by the south wall).'),
      ...c.farm.water.lines.map((l, i) => {
        const ok = l.heightCm >= NIPPLE_DAY0_CM[0] && l.heightCm <= NIPPLE_DAY0_CM[1];
        const todo = ok ? '' : l.heightCm > NIPPLE_DAY0_CM[1] ? ': winch it down (−)' : ': winch it up (+)';
        return step(`Line ${i + 1}: ${cm(l.heightCm)}${i === c.line ? ' (this line)' : ''}${todo}`, ok);
      }),
      note('The winch moves 1 cm a press, Shift + − or + 5 cm a press. The job is done once all four lines are at 10–12 cm.')] },
  'r-drinkers': { panels: { drinker: null }, title: 'Check drinker flow and height',
    rows(c, inst) {
      const want = flowToday(c.env), nip = nippleCmToday(c.env);
      if (inst.def.done?.of?.some?.((r) => r.tubes)) return tubeRows(c, inst, want, nip);
      return [line('A flow test on all four lines this round, each at its own regulator at the west end of the line (line 1 by the north wall, line 4 by the south wall).'),
        cmp('Flow target today', `drinker plate: age + 20 = ${want} ml/min (±${FLOW_BAND}: ${want - FLOW_BAND}–${want + FLOW_BAND})`, `nipples: plate about ${cm(nip)} today (±${HEIGHT_BAND_CM})`),
        ...c.farm.water.lines.map((l, i) => {
          const f = l.lastFlow && l.lastFlow.at >= (inst.opensAt ?? 0) - 1e-7 ? l.lastFlow : null, todo = flowTodo(l, inst, c.env);
          const what = f ? `${one(f.mlMin)} ml/min at ${hhmm((f.at % 1) * 24)}` : 'not tested this round';
          return step(`Line ${i + 1}${i === c.line ? ' (this line)' : ''}: ${what} · nipples ${cm(l.heightCm)}${f && todo ? `: ${todo}` : ''}`, !todo);
        }),
        wait('Each test: press the blue Flow test key. A cup sits under a nipple for 1 farm minute (about 2 s with this panel open), then the reading is recorded. A paused clock starts again when you press it.'),
        note('Pressure + gives more flow per nipple, − less (drinker plate). Test the line again after a change.')];
    } },
  'prep-flush': { panels: { 'water-supply': null }, title: 'Flush the water lines',
    rows: (c) => [line('Water lines sign: flush the lines about 12 hours before the chicks arrive.'),
      ...c.farm.water.lines.map((l, i) => {
        const clear = l.flushClear >= 0.99, todo = clear ? (l.flushing ? ': press Close flush valve' : '') : l.flushing ? ': flushing, wait for clear water' : ': press Open flush valve';
        return step(`Line ${i + 1}: ${clear ? 'clear' : l.flushClear > 0.02 ? 'cloudy' : 'brown'} water in the tube · flush valve ${l.flushing ? 'open' : 'closed'}${todo}`, clear && !l.flushing);
      }),
      line('All four flush valves are here at the water supply; the sight tubes are at the east end of the lines.'),
      wait('Each line runs clear in about 10 farm minutes with its valve open: let the clock run, then close the valve. A paused clock starts again when you open a valve.')] },
  'prep-litter': { panels: { 'litter-heap': null }, title: 'Spread the rice husk litter',
    rows: (c) => [cmp('Depth', 'litter sign: 5–10 cm', `${cm(c.farm.litter.depthCm)} chosen`),
      step(`Pick a depth of 5–10 cm here (now ${cm(c.farm.litter.depthCm)})`, (c.farm.litter.depthCm ?? 0) >= 5),
      step(c.props?.carrying === 'barrow' ? 'Barrow in your hands' : 'Press Take the barrow', c.props?.carrying === 'barrow' || (c.farm.litter.cover ?? 0) >= 0.95),
      cmp('Brooding floor covered (west of the curtain)', '95 % or more', pct(c.farm.litter.cover), (c.farm.litter.cover ?? 0) / 0.95),
      step('Push it over the brooding floor, wall to wall, west of the curtain (the marker shows bare floor)', (c.farm.litter.cover ?? 0) >= 0.95),
      step('Bring the barrow back here: Put the barrow back', (c.farm.litter.cover ?? 0) >= 0.95 && c.props?.carrying !== 'barrow'),
      note('With the barrow the clock runs slower; the barrow spreads a strip about 2.4 m wide.')] },
};

/** r-drinkers with the sight tubes (Water 2): each line's latest reading, tube or cup, and what it still needs. */
function tubeRows(c, inst, want, nip) {
  const from = inst.opensAt ?? -Infinity;
  return [line('Read the sight tubes at the water supply: a line whose column stands at the drinker plate’s mark counts as tested. A cup test only on a line that reads off, at its own regulator.'),
    cmp('Flow target today', `drinker plate: age + 20 = ${want} ml/min (±${FLOW_BAND}: ${want - FLOW_BAND}–${want + FLOW_BAND}); the tube’s mark for it`, `nipples: plate about ${cm(nip)} today (±${HEIGHT_BAND_CM})`),
    ...c.farm.water.lines.map((l, i) => {
      const rd = lineReading(l, from, c.env, true), todo = tubeTodo(l, inst, c.env);
      const what = !rd ? 'not read this round' : rd.by === 'tube' ? `sight tube ${one(rd.columnCm)} cm${rd.inBand ? ', at the mark' : ', off the mark'}` : `cup test ${one(rd.mlMin)} ml/min`;
      return step(`Line ${i + 1}${i === c.line ? ' (this line)' : ''}: ${what} · nipples ${cm(l.heightCm)}${rd && todo ? `: ${todo}` : ''}`, !todo);
    }),
    note('Blocked nipples do not show on a tube: the water meter and the birds show them.')];
}
/** The panels a payoff adds to a job's strip (the glance places, the sight tubes, the silo gauge, the pocket phone). */
export function payoffPanels(inst, perks) {
  if (!SKILLS_UPDATE.live || !inst) return [];
  const out = new Set(), c = { perks };
  for (const { system } of handedParts(inst.def)) for (const p of AUTO_SYSTEMS[system]?.glanceAt || []) out.add(p.startsWith('drinker-') ? 'drinker' : p);
  if (inst.id === 'r-drinkers' && variantHas(inst.def, 'waterAllLines')) out.add('water-supply');
  if (['p-order-feed', 'w2-order', 'w45-order', 'f-order'].includes(inst.id) && placeKey(inst, c, 'siloOrder')) out.add('silo');
  if (['p-order-feed', 'w2-order', 'w45-order', 'f-order', 'f-book', 'p-report', 'p-blood', 'p-hunched', 'c-book', 'p-weak-batch'].includes(inst.id) && placeKey(inst, c, 'pocketPhone')) out.add('pocket-phone');
  if ((inst.id === 'r-record' || inst.id === 'prep-record') && placeKey(inst, c, 'phoneRecord')) out.add('pocket-phone');
  if (inst.id === 'r-fans-pm' && placeKey(inst, c, 'fanAdvice')) out.add('controller');
  return [...out];
}
/** The payoffs' rows at the top of a job's strip (live only): what holds now, the handed-over parts, the level 1 view. */
export function skillRows(c, inst) {
  // the review round: no skill rows in a done strip; each skill line once per panel (c.skillSeen, shared by the panel's
  // strips of one draw); one payoff or view line per strip besides the handled parts; the Comfort 2 line belongs to the
  // flock watch card (its Show me), not to a panel's strips
  if (!SKILLS_UPDATE.live || !inst || (inst.status && inst.status !== 'open')) return [];
  const out = [], seen = c.skillSeen instanceof Set ? c.skillSeen : null;
  const once = (t) => { if (!t || (seen && seen.has(t))) return false; if (seen) seen.add(t); return true; };
  let ez = [];
  try { ez = (c.perks?.easier?.(inst.id) || []).filter((e) => e.key !== 'earlyWarning'); } catch { ez = []; }
  let promo = 0;
  for (const t of easierNowRows(ez)) if (promo < 1 && once(t)) { out.push(line(t)); promo++; }
  let hl = [];
  try { hl = handledLines(inst, c.farm); } catch { hl = []; }
  for (const x of hl) if (once(x.text)) out.push(x.fault ? note(x.text) : line(x.text));
  for (const v of viewsOfJob(inst.id)) { const t = viewLine(v, c.skills); if (promo < 1 && once(t)) { out.push(note(t)); promo++; } }
  return out;
}

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
  c.farm.feed.lines.forEach((l, i) => {
    const todo = feederTodo(l, c.env), low = l.running && l.panFill < FEED.accessFill ? 'the pans fill over farm time while the auger turns' : '';
    const r = step(`${feederLine(l, i, c.env)}${todo || low ? `: ${[todo, low].filter(Boolean).join(' · ')}` : ''}`, l.running && l.panFill >= FEED.accessFill && (c.env.dayNumber < 4 || rimInBand(l.heightCm, c.env))); r.bar = l.panFill; out.push(r);
  });
  out.push(line(c.env.dayNumber < 4 ? `Each line is finished when: auger on, feed in the pans (${pct(FEED.accessFill)} full or more).`
    : `Each line is finished when: rim at the plate’s figure ± ${HEIGHT_BAND_CM} cm (about ${cm(rim)} today), auger on, feed in the pans.`));
  out.push(meterRow(c, inst.st), step('Press Read the feed meter (feeder box)', parts[0]?.met));
  if (withSilo) {
    const birds = knownFlock(c.env, c.farm).birds, g = feedStdGAt(Math.max(0, flockAgeAt(c.env.day) + 0.5));
    const read = parts[1]?.st?.payload?.result;
    out.push(cmp('Silo gauge (outside, north of the house)', `silo plate: order below 2 days of feed (about ${int((2 * birds * g) / 1000)} kg today)`,
      read ? `about ${int(read.kg)} kg` : 'not read yet today'), step('Read the silo gauge: outside, at the silos north of the house (Read the gauge)', parts[1]?.met));
  }
  return out;
}
function readRows(c, inst, all) {
  // once read, the min / max he read (the controller's memory restarts at the read)
  const read0 = c.engine.parts(inst)[0], got = read0?.met ? read0.st?.payload : null;
  const mm = got && got.minC != null ? { min: got.minC, max: got.maxC } : c.minmax?.() || {}, out = [houseRow(c)];
  if (mm.min != null) out.push(line(`Min ${C1(mm.min)} / max ${C1(mm.max)} since the read before${got ? ' (what you read)' : ''}.`));
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

// ---------------- the steps hotfix: where to go next, and the clock's pause ----------------
/** State tests whose outcome comes over farm time (the pans fill, the lines run clear, the birds drink, the floor dries). */
const TIME_TESTS = new Set(['pans-flooded', 'lines-flushed', 'house-dry', 'vaccine-drunk', 'pans-grower', 'pans-finisher', 'lines-disinfected', 'rest-done', 'house-empty', ...Object.keys(HELD_MIN)]);
/** The job waits on farm time now (a part that must hold, a state that grows with the clock, a machine at work). */
export function waitsOnTime(inst, c) {
  if (!inst || inst.status !== 'open') return false;
  const r = inst.def.done;
  if (r.type === 'state' && TIME_TESTS.has(r.test)) return true;
  return (c.engine?.parts?.(inst) || []).some((p) => !p.met && p.test && TIME_TESTS.has(p.test));
}
/** The last step of a job that spans several places: "Then walk to the line 2 regulator, about 3 m south along the west
 *  wall: a flow test there" (the panel's own place left out; "Next:" once this place is done). */
export function thenRows(c, inst, panelId) {
  if (inst.status !== 'open') return [];
  const skip = panelPlace(panelId), all = jobPlaces(inst, c);
  if (!all || !all.length) return [];
  const np = nextPlace(inst, c, { from: c.from, skip });
  if (!np) return [];
  if (np.phone) return [{ ...step(`Next: ${np.text}`), next: true }];   // the pocket phone: anywhere
  const here = !!skip && all.some((p) => p.id === skip);
  return [{ ...step(`${here ? 'Then walk to' : 'Next: walk to'} ${np.name}, ${np.way}: ${np.todo}.`), next: true }];
}
/** The pause line when this job waits on farm time and the farmer has the clock paused. */
export function pausedRows(c, inst, rows) {
  if (!c.paused || inst.status !== 'open') return [];
  if (!rows.some((r) => r.k === 'time' || r.farm) && !waitsOnTime(inst, c)) return [];
  return [{ k: 'time', text: 'The clock is paused: farm minutes do not pass. Press ▶ in the time bar (bottom left, close this panel first) or use a key here that needs farm time: it starts the clock too.', bar: null, paused: true }];
}
/** Every row a strip shows: its own rows (or the rule's parts), the next place, the pause line. */
export function stripRows(S, c, inst, panelId) {
  const own = S ? S.rows({ ...c, inst }, inst) : partRows(c, inst);
  return [...skillRows(c, inst), ...own, ...thenRows(c, inst, panelId), ...pausedRows(c, inst, own), ...heldRows(inst)];
}
/** PHASE4.md §15.2: a job held open past its window while the farmer does it says so (its close and the grace). */
export function heldRows(inst) {
  if (inst?.heldFrom == null || inst.status !== 'open') return [];
  const m = Math.round((((inst.heldFrom % 1) + 1) % 1) * 1440) % 1440;
  return [{ k: 'note', text: `Its window closed at ${hhmm(m / 60)}: it stays open while you work here, and about 20 farm minutes after you stop.` }];
}

/** Every strip to show at a panel: the open jobs whose strip (or spot) names it, the current job first. */
export function stripsAt(engine, panelId, section, extra = {}, perks = null) {
  if (!engine) return [];
  const want = panelId.startsWith('drinker-') ? 'drinker' : panelId;
  const cur = engine.current?.(), out = [];
  const open = engine.open?.() || [];
  for (const inst of [...(cur ? [cur] : []), ...open.filter((i) => i !== cur)]) {
    const S = STRIPS[inst.id] || extra[inst.id] || STRIPS_COND[inst.id];
    let panels = S ? S.panels : { [spotPanel(inst.def.spot)]: 'top' };
    // Skills update: the payoffs' places show the job's strip too (the glance, the sight tubes, the silo gauge, the phone)
    const more = payoffPanels(inst, perks);
    if (more.length) panels = { ...panels, ...Object.fromEntries(more.filter((p) => !(p in panels)).map((p) => [p, null])) };
    if (!(want in panels)) continue;
    const sec = panels[want];
    out.push({ inst, strip: S || null, section: sec ?? null, here: section == null || sec == null || sec === section });
  }
  return out;
}
export { FAN_COUNT, EQUIP, LEVEL1, fansWorking, timerText, lightRows, lightAt, brooderState, tableText };
