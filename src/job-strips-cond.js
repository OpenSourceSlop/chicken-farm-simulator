// Job strips of the Phase 4 condition jobs (PHASE4.md §4, §12.2; content-jobs-cond.js JOBS_COND). Pure logic, rows of
// plain text as job-strips.js (its row helpers; ui-jobstrip.js draws them). Each figure is a sign's or plate's, named,
// or the farmer's own reading: the pump against the plate's 2.4 bar and 6 A, the tank's marker, the line water against
// 30 °C, the generator's hours of fuel, a weak batch's brooder row + 1 °C. Neutral words only. Steps are the parts of the
// job's own rule; other things are lines (PHASE4.md §6.6). Nothing here runs at load (job-strips.js imports this file and
// this file imports its helpers back).
import { GENERATOR, WATER_TANK, HEAT, HEAT_P4, flockAgeAt } from './config.js';
import { int, one, hhmm } from './ui-format.js';
import { step, cmp, line, note, wait, time, pct, partRows, houseRow, birdsSeen, ventRows, rowShiftC, SHIFT_WORDS } from './job-strips.js';
import { brooderRowC, flowToday, fansWorking, FLOW_BAND } from './job-figures.js';
import { CHICKS_P4 } from './farm-cond-chicks.js';   // b-warm's held hours (the final check)

const C1 = (v) => `${one(v)} °C`;
const ageOf = (env) => Math.max(0, Math.floor(flockAgeAt(env.day)));
const at = (t) => (t == null ? '' : `day ${Math.floor(t)} ${hhmm((t % 1) * 24)}`);
const parts = (c, inst) => c.engine?.parts?.(inst) || [];
const fansPad = (c) => `Tunnel fans running ${c.env.fansEffective ?? 0} of ${fansWorking(c.env)} · pad pump ${c.env.padOn ? 'on' : 'off'} · humidity ${int(c.env.houseRH)} %`;
const genLine = (c) => {
  const P = c.farm.power || {}, G = c.farm.generator || {};
  const house = P.on ? `power on (${P.source === 'generator' ? 'the generator' : 'the mains'})` : 'no power: the fans, the pad, the lights and the augers stand';
  return `House: ${house} · mains ${P.mains ? 'on' : 'off'} · generator ${G.running ? 'running' : 'stopped'}`;
};
const fuelRow = (c) => { const G = c.farm.generator || {}; return cmp('Fuel', `generator plate: ${GENERATOR.fuelL} L, about ${int(GENERATOR.fuelL / GENERATOR.litresPerH)} hours at full load`, `${int(G.fuelL ?? 0)} L · about ${one(G.hoursLeft ?? 0)} h left`, (G.fuelL ?? 0) / GENERATOR.fuelL); };
/** The last reading of the tank and the pump in the notebook today (the water.tank result), or null. */
function tankRead(c, inst) {
  const own = inst?.st?.payload?.result;   // w-tank: the reading that did the job
  if (own && typeof own === 'object' && own.pumpBar != null) return { ...own, hour: ((inst.doneAt ?? c.env.day) % 1) * 24 };
  const n = (c.records?.notebook || []).filter((x) => (x.kind === 'water.tank' || x.kind === 'tank') && x.day === c.env.dayNumber).pop();
  return n && typeof n.value === 'object' ? { ...n.value, hour: n.hour } : null;
}
const pumpRow = (c, r) => cmp('Well pump', `water-tank plate: in good order about ${WATER_TANK.pumpBar} bar and ${WATER_TANK.pumpA} A`, r ? `${one(r.pumpBar)} bar, ${one(r.pumpA)} A at ${hhmm(r.hour ?? 0)}` : 'not read yet today');
const tankRow = (c, r) => cmp('Tank', 'the gauge’s marker: the lowest level since the last reading (plate: under about 30 % the pump gives less than the house draws)',
  r ? `${int(r.levelPct)} % now · marker ${int(r.lowPct)} %${r.lowAt != null ? ` at ${hhmm((r.lowAt % 1) * 24)}` : ''}` : 'not read yet today');
const lineTemps = (c) => (c.farm.water?.lineTempC || []).map((v) => one(v));

export const STRIPS_COND = {
  // ---------------- the hot season ----------------
  'h-brood-air': { panels: { 'pad-pump': null, 'fan-panel': null, controller: 'top' }, title: 'Keep the chicks’ afternoon heat down',
    rows: (c, inst) => [line('Brooder sign (hot season): from about 11:00 to 18:00 the pad with one tunnel fan, the timer on the sign’s setting, the brooders on their thermostat; two fans and the pad chill the chicks.'),
      houseRow(c, ' (the chicks comfortable within about 1.5 °C)'), line(fansPad(c)), line(birdsSeen(c)), ...partRows(c, inst)] },
  'h-young-heat': { panels: { 'fan-panel': null, 'pad-pump': null }, title: 'Keep the young birds’ afternoon heat down',
    rows: (c, inst) => { const d = ageOf(c.env); return [line(`Birds ${d} days | heat sign (hot season): the pad from about 11:00 into the evening, with one tunnel fan in week 2 and two or three in week 3; six fans and the pad chill young birds.`),
      line(fansPad(c)), line(birdsSeen(c)), ...partRows(c, inst)]; } },
  'h-flush': { panels: { 'water-supply': null }, title: 'Flush the warm water out of the drinker lines',
    rows(c, inst) {
      const t = c.farm.water?.lineTempC || [], seen = inst.st?.parts?.[0]?.seen || {}, p = parts(c, inst);
      return [line('Drinker plate (hot season): the water in the lines warms under the roof; over about 30 °C the birds drink less.'),
        ...[0, 1, 2, 3].map((i) => step(`Line ${i + 1}: water ${t[i] != null ? C1(t[i]) : '—'} · flush valve ${String(i) in seen ? 'opened this round' : 'not opened yet: press Open flush valve (about 2 farm minutes)'}`, String(i) in seen)),
        step(`The water in every line at 30 °C or under${t.length ? ` (now ${lineTemps(c).join(' · ')} °C)` : ''}`, p[1]?.met),
        wait('A flush puts the tank’s cooler water into the line in about 2 farm minutes with its valve open: let the clock run, then close it.')];
    } },
  // ---------------- the rainy season ----------------
  'rn-gen-test': { panels: { generator: null }, title: 'Test-run the generator',
    rows: (c, inst) => [line(genLine(c)), fuelRow(c), line(`Last test: ${c.farm.generator?.testedDay != null ? `day ${c.farm.generator.testedDay}` : 'none yet'} (power cut sign: test-run it every week).`),
      step('Press Test run: about 10 farm minutes on the panel’s bar', inst.status === 'done')] },
  'p-power': { panels: { generator: null, controller: 'top' }, title: 'The power is off: start the generator',
    rows(c, inst) {
      const cut = (c.farm.problems || []).find((p) => p.id === 'power-cut'), since = cut?.startedAt != null ? Math.max(0, (c.env.day - cut.startedAt) * 1440) : null;
      return [line(genLine(c)), ...(since != null ? [line(`The power went off at ${hhmm((cut.startedAt % 1) * 24)}: ${int(since)} farm minute${Math.round(since) === 1 ? '' : 's'} ago. The clock runs at the carrying speed while the house is dark.`)] : []),
        fuelRow(c), ...partRows(c, inst), note('Power cut sign: start the generator (about 2 minutes to full power), then switch the house over to it.')];
    } },
  'p-power-back': { panels: { generator: null }, title: 'The mains is back: switch over and stop the generator',
    rows: (c, inst) => [line(genLine(c)), fuelRow(c), ...partRows(c, inst), note('Power cut sign: left on, the generator runs dry and the house goes dark again.')] },
  'p-gen-dry': { panels: { generator: null }, title: 'The house is dark again: the generator stopped',
    rows: (c, inst) => [line(genLine(c)), fuelRow(c), ...partRows(c, inst)] },
  'p-rain-in': { panels: { controller: 'vent' }, title: 'Wet litter along the south wall after the storm',
    rows: (c, inst) => [line('Litter sign (rainy season): storms drive rain in through the side-wall inlets; close the storm flaps on the south inlets while it storms, open them again after.'),
      line(`Storm flaps: ${c.farm.house?.flapsClosed ? 'closed (the inlets give 70 % of the timer air: open them again when the storm has passed)' : 'open'} · ${c.farm.weatherNow?.rain ? 'raining now' : 'no rain now'}.`),
      step('Ventilation: close the Storm flaps on the south inlets', inst.status === 'done')] },
  'p-rain-patch': { panels: { 'litter-heap': null }, title: 'Fresh litter on the wet strip by the south wall',
    rows: (c, inst) => { const n = (inst.st?.list || []).length; return [line('Take a sack of husk here, walk to the wet strip along the south wall and press {key:use} on it.'), step(`Sacks on the wet strip: ${n} of 3`, n >= 3)]; } },
  'p-damp2': { panels: { controller: 'top' },
    rows: (c, inst) => [cmp('Humidity in', 'air and vent signs (rainy season): more air carries the damp out; this job: at or under 85 %', `${int(c.env.houseRH)} %`), ...ventRows(c, { purpose: false }), ...partRows(c, inst)] },
  // ---------------- a bad batch of chicks ----------------
  'b-trays': { panels: { 'feeder-box': null }, title: 'Feed trays and chick paper by the brooders',
    rows: (c, inst) => [line('Chick sign (weak batch): feed trays and chick paper by the brooders, so small chicks find feed in their first days.'),
      step(`Feed trays and chick paper: ${c.farm.brood?.trays ? 'out by the brooders' : 'not out yet (press Feed trays and chick paper)'}`, inst.status === 'done')] },
  'p-weak-batch': { panels: { 'chick-table': null, 'chick-grading': null, 'office-desk': null }, title: 'Many weak chicks in the boxes',
    rows(c, inst) {
      const w = c.farm.stats?.chickWeightMeasuredG, n = (inst.st?.parts?.[0]?.list || []).length, p = parts(c, inst);
      const out = (inst.st?.parts?.[0]?.list || []).reduce((a, x) => a + (x.r?.culled || 0), 0);
      return [cmp('Chick weight', 'chick sign: under about 38 g, or many open navels and slow reflexes, is a weak batch', w ? `${one(w)} g (your box weighing)` : 'box not weighed yet'),
        step(`Stacks graded: ${n} of 4 or more (Grade the stacks at the chick table: about 6 farm minutes a stack)`, p[0]?.met),
        line(`Graded out so far: ${int(out)} chicks (the cull box) · claimed: ${c.farm.flock?.claimed ? int(c.farm.flock.claimed) : 'not yet: the hatchery has not been told'}.`),
        step('Tell the hatchery before 24:00 today: office phone, Call the hatchery (the chicks graded out today are claimed back)', p[1]?.met)];
    } },
  'b-warm': { panels: { controller: 'temp' }, title: 'Brood the small chicks 1 °C warmer',
    rows(c, inst) {
      const d = Math.max(0, c.env.dayNumber), row = brooderRowC(d), sp = c.env.heaterSetpoint, sh = rowShiftC(c) || 1, over = sp - row, ok = over >= 0.5 - 1e-9 && over <= 1.5 + 1e-9;
      const heldH = Math.min(CHICKS_P4.warmHoldH, c.farm.condX?.warmH ?? 0);
      return [cmp('Thermostat', `brooder sign, day ${d}: ${C1(row)} + ${one(sh)} °C = ${C1(row + sh)} (${SHIFT_WORDS})`, C1(sp)),
        step(ok ? `Thermostat ${C1(sp)}: ${one(over)} °C over the sign’s row` : `Press ${over < 0.5 ? 'Raise' : 'Lower'} the brooder thermostat (0.5 °C a press) to ${one(row + 0.5)}–${one(row + 1.5)} °C`, ok),
        // the final check: the job holds over its window (farm-cond-chicks counts the hours in the band)
        time(`Kept in the band ${Math.floor(heldH)} of ${CHICKS_P4.warmHoldH} farm hours so far (to day 3 06:00): the clock must run, follow the row each morning`, heldH / CHICKS_P4.warmHoldH),
        line('Until day 3 at 06:00; then back to the sign’s row.')];
    } },
  'b-crop48': { panels: { 'chick-in-hand': null },
    rows: (c, inst) => { const L = inst.st?.list || [], s = new Set(L.map((x) => x.s)).size; return [line('Chick sign: at 48 hours the crops of nearly every chick are full and soft.'), step(`${L.length} of 10 chicks felt, ${s} of 3 parts of the floor`, L.length >= 10 && s >= 3)]; } },
  // ---------------- a water problem ----------------
  'w-test': { panels: { 'water-supply': null }, title: 'Test the well water',
    rows: (c, inst) => [line('Water supply plate (water problem): iron in well water over about 0.3 mg/L clogs the filter and the nipples.'), step('Water test kit: Test the water (iron, pH, chlorine)', inst.status === 'done')] },
  'w-tank': { panels: { 'water-tank': null }, title: 'Read the water tank and the well pump’s gauges',
    rows: (c, inst) => { const r = tankRead(c, inst); return [pumpRow(c, r), tankRow(c, r), step('Press Read the gauges (the marker goes back to the level)', inst.status === 'done')]; } },
  'p-filter-again': { panels: { 'water-supply': null },
    rows: (c, inst) => [line('Water supply plate (water problem): the iron clogs the main filter again; its gauges read low out against in.'), step('Clean the filter (about 5 farm minutes)', inst.status === 'done')] },
  'p-nipples': { panels: { drinker: null, 'water-supply': null }, title: 'One drinker line gives little water',
    rows(c, inst) {
      const l = c.farm.water?.lines?.[3], f = l?.lastFlow, want = flowToday(c.env), p = parts(c, inst);
      return [line('Water supply plate (water problem): iron clogs the nipples; a flush of the line clears them.'),
        step('Flush line 4: its flush valve at the water supply, about 2 farm minutes', p[0]?.met),
        step(`Then a flow test on line 4 at its regulator: ${f ? `${one(f.mlMin)} ml/min at ${hhmm((f.at % 1) * 24)}` : 'not tested yet'} | drinker plate: age + 20 = ${want} ml/min (±${FLOW_BAND})`, p[1]?.met)];
    } },
  'p-pump': { panels: { 'water-tank': null }, title: 'The well pump gives less water',
    rows(c, inst) {
      const T = c.farm.waterTank || {}, r = tankRead(c), p = parts(c, inst);
      const left = T.fixing && T.fixUntil != null ? Math.max(0, (T.fixUntil - c.env.day) * 1440) : null;
      return [pumpRow(c, r), tankRow(c, r), step(p[0]?.label || 'Repair the pump', p[0]?.met),
        ...(left != null ? [time(`The repair: about ${int(left)} farm minutes left (the tank alone feeds the house meanwhile; the panel may close)`, 1 - left / (WATER_TANK.repairH * 60))] : []),
        step(p[1]?.label || 'The pump in good order and running again', p[1]?.met)];
    } },
};
// figures some rows name (kept here so a reword keeps them in reach)
export const COND_STRIP_FIGURES = { padOffAboveRH: HEAT.padOffAboveRH, eveningAboveC: HEAT_P4.padEveningAboveC };
