// Job strips of the Phase 3 jobs (job-strips.js has the API, the rows and the brooding week's strips). Pure
// logic. Figures from the signs and plates (named in each row) and the farmer's own readings; neutral words.
import { HARVEST, HEAT, CLEAN, PLAN_CONTRACT, flockAgeAt, feedStdGAt, weightAt } from './config.js';
import { int, one, hhmm } from './ui-format.js';
import { knownFlock, ventNeed, nippleCmToday, rimCmNow, nippleInBand, rimInBand, luxOfDimmer, fansWorking, timerAirM3h, brooderRowC,
  LINES_UP_CM, PANS_UP_CM, CATCH_DIMMER_MAX, CATCH_FANS_MIN, DARK_H, HEIGHT_BAND_CM } from './job-figures.js';
import { step, cmp, line, note, time, pct, partRows, houseRow, birdsSeen, ventRows, lightAt, timerText, heldText } from './job-strips.js';

const cm = (v) => `${Math.round(v)} cm`;
const list = (a) => a.map((v) => Math.round(v)).join(' · ');
const ageOf = (env) => Math.max(0, Math.floor(flockAgeAt(env.day)));
const fanLine = (c) => `Fans turning ${c.env.fansEffective ?? 0} of ${fansWorking(c.env)} · pad pump ${c.env.padOn ? 'on' : 'off'} · humidity ${int(c.env.houseRH)} % (pad plate: the pads help up to about ${HEAT.padOffAboveRH} %)`;
const heatAge = (c) => (ageOf(c.env) < 21 ? `Birds ${ageOf(c.env)} days: as few tunnel fans as the heat allows; the pads are for big birds (heat sign, fan plate).`
  : `Birds ${ageOf(c.env)} days: big birds in the heat want all six fans and the pads (heat sign).`);
const heatRows = (c, inst) => [line(`${birdsSeen(c)} | heat sign: panting, wings out, lying along the walls = heat stress.`), line(heatAge(c)), line(fanLine(c)), ...partRows(c, inst)];
const lastLook = (c) => (c.records?.notebook || []).filter((n) => n.kind === 'look' && n.day === c.env.dayNumber).pop();
const darkRows = (c) => {
  const p = lightAt(c.env, c.farm);
  return [cmp('Dark period', `light sign: ${DARK_H[0]}–${DARK_H[1]} h in one block`, `${hhmm(p.darkStart ?? 2)} for ${one(p.darkHours ?? 1)} h`),
    cmp('Light at bird level', 'light sign: about 20 lux from week 2', `dimmer ${pct(p.dimmer)} ≈ ${int(luxOfDimmer(p.dimmer))} lux (L measures it)`)];
};
const raiseRows = (c, intro) => {
  const nip = nippleCmToday(c.env), rim = rimCmNow(c.env), W = c.farm.water.lines, F = c.farm.feed.lines;
  return [line(intro), step(`Drinker lines ${list(W.map((l) => l.heightCm))} cm | drinker plate: nipples about ${cm(nip)} today (±${HEIGHT_BAND_CM})`, W.every((l) => nippleInBand(l.heightCm, c.env))),
    step(`Feeder pans ${list(F.map((l) => l.heightCm))} cm | feeder plate: rim about ${cm(rim)} today (±${HEIGHT_BAND_CM})`, F.every((l) => rimInBand(l.heightCm, c.env))),
    note('Shift + raises 5 cm a press on the winches.')];
};
/** A feed order the job needs: the silo of that feed, what the birds eat a day by the feed sign, the room. */
function orderRows(c, inst, type, days) {
  const f = c.farm.feed, birds = knownFlock(c.env, c.farm).birds, age = Math.max(0, flockAgeAt(c.env.day));
  const g = feedStdGAt(age + days / 2), perDay = (birds * g) / 1000, silo = type === 'grower' ? 1 : 0, s = f.silos?.[silo];
  const read = (c.records?.notebook || []).filter((n) => n.kind === 'feed.silo').pop();
  return [line(`Silo ${silo + 1} (${s?.type ?? type}): your last gauge reading ${read ? `about ${int(read.value?.kg ?? read.value)} kg on day ${read.day}` : 'none yet'} · each silo holds 6,000 kg.`),
    cmp('Feed for the next days', `feed sign: about ${int(g)} g a bird a day: ${int(birds)} birds eat about ${int(perDay)} kg a day`, `${days} days ≈ ${int(perDay * days)} kg`),
    note('Ordered before 16:00, it comes tomorrow at 09:00 (silo plate).'), ...partRows(c, inst)];
}
const weighRows = (c, inst) => {
  const w = c.weighings?.() || { n: 0, sectors: 0, mean: null }, d = c.env.dayNumber, chick = c.farm.stats?.chickWeightMeasuredG ?? c.farm.flock?.chickWeightG;
  const target = d <= 7 ? `bird scale plate: 4–5 × your chick weight ${one(chick)} g = ${int(chick * 4)}–${int(chick * 5)} g` : `bird scale plate, day ${d}: ${int(weightAt(d))} g`;
  return [cmp('Weighed', 'plate: at least 50 birds from 5 places', `${w.n} birds, ${w.sectors} places`, Math.min(w.n / 50, w.sectors / 5)), cmp('Mean weight', target, w.mean ? `${int(w.mean)} g` : '—')];
};
const birdCount = (inst, n, parts) => { const L = inst.st.list || [], s = new Set(L.map((x) => x.s)).size; return step(`${L.length} of ${n} birds, ${s} of ${parts} parts of the house`, L.length >= n && s >= parts); };

const GRADE = { panels: { 'chick-table': null }, title: 'Grade the sample box (chick arrival sign: reflex, navel, hocks, uniformity)',
  rows(c, inst) {
    const g = c.grade;
    if (!g) return partRows(c, inst);
    const b = g.box, net = b ? b.weightKg - (b.boxKg ?? 0.35) : null;
    return [step(`Looked at: reflex ${g.n('reflex')}/10 · navel ${g.n('navel')}/10 · hocks ${g.n('hocks')}/10 · culled ${g.culled}`, ['reflex', 'navel', 'hocks'].every((k) => g.n(k) + g.culled >= 10)),
      step(b ? `Box: ${one(b.weightKg)} kg gross − ${one(b.boxKg ?? 0.35)} kg box = ${one(net)} kg ÷ ${b.chicks ?? 100} = ${one((net * 1000) / (b.chicks ?? 100))} g a chick (chick arrival sign)` : 'Weigh the box (the sign: chick weight = net weight ÷ 100)', !!b),
      line(`Your sheet: ${g.sheet.navelBad} navel · ${g.sheet.redHocks} hocks · ${g.sheet.slowReflex} slow · ${g.sheet.culled} culled`), step('Hand in the sheet', inst.status === 'done')];
  } };
const WEIGH = { panels: { 'bird-scale': null, weigh: null }, title: 'Weigh sample birds', rows: weighRows };
const HEAT_STRIP = { panels: { 'fan-panel': null, 'pad-pump': null }, rows: heatRows };
const PLAN_TERMS = (C) => [['salePerWeek', 'Birds for sale a week', `contract ${int(C.salePerWeek)}, at most ${int(Math.round((C.salePerWeek * C.saleMaxPct) / 100))}`, (v) => v >= C.salePerWeek && v <= (C.salePerWeek * C.saleMaxPct) / 100],
  ['lossesPct', 'Losses, %', `at least ${C.lossesMinPct} %`, (v) => v >= C.lossesMinPct], ['densityKgM2', 'kg of live bird per m² at catching', `at most ${C.densityMaxKgM2}`, (v) => v <= C.densityMaxKgM2],
  ['restDays', 'Rest days between flocks', `at least ${C.restMinDays}`, (v) => v >= C.restMinDays], ['birdsPerHouse', 'Chicks a house', `at most ${int(C.houseBirds)}`, (v) => v <= C.houseBirds]];
export const STRIPS_CYCLE = {
  'pl-sheet': { panels: { 'plan-sheet': null }, title: 'The contract’s terms beside your own figures',
    rows(c) {
      const P = c.plan, C = PLAN_CONTRACT;
      if (!P) return [];
      const mine = { ...P.sums, lossesPct: P.decisions.lossesPct, birdsPerHouse: P.decisions.birdsPerHouse };
      return [...PLAN_TERMS(C).map(([k, what, term, ok]) => { const v = mine[k]; return step(`${what}: yours ${Number.isFinite(v) ? (k === 'densityKgM2' || k === 'lossesPct' ? one(v) : int(v)) : '— (not worked out yet)'} | contract: ${term}`, Number.isFinite(v) && ok(v)); }),
        note('Sending is final: the company’s reply comes to the desk about an hour later.')];
    } },
  'd0-grade': GRADE,
  'd7-weigh': WEIGH, 'w2-weigh': WEIGH, 'w3-weigh': WEIGH, 'w45-weigh28': WEIGH, 'w45-weigh35': WEIGH, 'f-weigh': WEIGH,
  'w2-lights': { panels: { controller: 'lights' }, title: 'Light program for growing birds', rows: (c, inst) => [...darkRows(c), ...partRows(c, inst)] },
  'p-sds': { panels: { controller: 'lights' }, rows: (c, inst) => [line('Light sign: a dark period every night lowers sudden deaths.'), ...darkRows(c), ...partRows(c, inst)] },
  'f-ready': { panels: { controller: 'lights' }, title: 'Get the house ready for the catching crew',
    rows(c, inst) {
      const p = lightAt(c.env, c.farm), parts = c.engine.parts(inst);
      return [cmp('Lights', `catch and light signs: about 10 lux at bird height (dimmer ${Math.round(CATCH_DIMMER_MAX * 100)} % or less)`, `dimmer ${pct(p.dimmer)} ≈ ${int(luxOfDimmer(p.dimmer))} lux`),
        cmp('Tunnel fans running', `catch sign: at least ${CATCH_FANS_MIN}`, String(c.env.fansEffective ?? 0)),
        step(`Catching panels: ${c.farm.harvest?.panels ? 'put up' : 'stacked by the door (E at them)'}`, parts[0]?.met), ...partRows(c, inst, { skip: [0] })];
    } },
  'r-raise': { panels: { drinker: null, 'feeder-box': null }, title: 'Raise the lines for the birds’ size', rows: (c) => raiseRows(c, `Day ${c.env.dayNumber}: the birds stretch up a little to drink; the pan rims at their backs.`) },
  'c-raise': { panels: { drinker: null, 'feeder-box': null, controller: 'temp' }, title: 'Winch all the lines and brooders up',
    rows: (c) => [line('Clean-out sign, step 1: lift every line and the brooders out of the way.'),
      step(`Drinker lines ${list(c.farm.water.lines.map((l) => l.heightCm))} cm | ${LINES_UP_CM} cm or more (the top of the winch is 60 cm)`, c.farm.water.lines.every((l) => l.heightCm >= LINES_UP_CM)),
      step(`Feeder pans ${list(c.farm.feed.lines.map((l) => l.heightCm))} cm | ${PANS_UP_CM} cm or more (the top is 45 cm)`, c.farm.feed.lines.every((l) => l.heightCm >= PANS_UP_CM)),
      step(`Brooders: ${c.env.broodersUp ? 'up' : 'down (controller, Temperature: Off and up)'}`, !!c.env.broodersUp)] },
  'f-lines': { panels: { drinker: null }, title: 'Lift the drinker lines as the catching starts',
    rows: (c) => [line('Catch sign: lift the lines out of the way just before the crew starts; keep the water on until catching starts.'),
      step(`Lines ${list(c.farm.water.lines.map((l) => l.heightCm))} cm | out of the way: ${LINES_UP_CM} cm or more (the top of the winch is 60 cm)`, c.farm.water.lines.every((l) => l.heightCm >= LINES_UP_CM)),
      note('Shift + raises 5 cm a press.')] },
  'r-vent-night': { panels: { controller: 'top', 'fan-panel': null }, title: 'Night ventilation',
    rows(c, inst) {
      const v = ventNeed(c.env, c.farm);
      return [line(`Birds ${ageOf(c.env)} days, ${c.env.timeLabel}.`), houseRow(c),
        line(`Tunnel fans running: ${c.env.fansEffective ?? 0} (heat sign: step them down as the house cools; big birds still want some tunnel air on warm nights).`),
        cmp('Timer air', `vent sign table: about ${int(v.need)} m³/h for your birds`, `${int(v.air)} m³/h`), line(birdsSeen(c)), ...partRows(c, inst)];
    } },
  'p-damp': { panels: { controller: 'top' },
    rows(c, inst) {
      const v = ventNeed(c.env, c.farm), sq = (c.records?.notebook || []).filter((n) => n.kind === 'litter').pop();
      return [cmp('Humidity in', 'air sign: at or under about 75 %; wet air wets the litter', `${int(c.env.houseRH)} %`),
        cmp('Timer air', `vent sign table: about ${int(v.need)} m³/h for your birds; more air carries the damp out`, `${int(v.air)} m³/h · tunnel fans ${c.env.fansEffective ?? 0}`),
        line(`Litter, your last squeeze: ${sq ? `${int(sq.value?.moisturePct)} % on day ${sq.day}` : 'none yet'} (litter sign: at or below 30 %).`), ...partRows(c, inst)];
    } },
  'p-dust': { panels: { 'fan-panel': null, controller: 'top' },
    rows(c, inst) {
      const look = lastLook(c), v = ventNeed(c.env, c.farm);
      const heard = look && typeof look.value === 'string' ? look.value.replace(/^.*You hear: /, 'you heard ') : '';
      return [line(`Last listen stop${look ? ` ${hhmm(look.hour)}: ${heard}` : ': none today'} | air sign: snicking or a rattle = too much ammonia or dust.`),
        cmp('Fresh air', `vent sign table: about ${int(v.need)} m³/h for your birds`, `timer ${int(v.air)} m³/h · tunnel fans ${c.env.fansEffective ?? 0}`),
        ...partRows(c, inst), note('Stand still in the house a moment to listen again: quiet breathing and no sting in your eyes is the air the sign wants.')];
    } },
  'p-heat3': HEAT_STRIP, 'p-panting': HEAT_STRIP, 'p-panting-fin': HEAT_STRIP,
  'r-fans-pm': { panels: { 'fan-panel': null }, title: 'Afternoon check: the fans and the house',
    rows(c, inst) {
      const on = c.env.fansManual ?? 0, broken = (c.env.fansBroken || []).filter((i) => i < on).length, pad = (c.records?.notebook || []).filter((n) => n.kind === 'pad' && n.day === c.env.dayNumber).pop();
      return [step(on ? `Every fan you switched on turns: ${on - broken} of ${on} vanes turning (fan plate: lamp on and the blade still = broken belt)`
        : 'No tunnel fans switched on (fan plate: a lamp on with the blade still = broken belt)', on > 0 && broken === 0),
        houseRow(c, ' (tunnel air makes the birds feel cooler)'), line(`${birdsSeen(c)} | heat sign: big birds in the heat want all six fans and the pads.`),
        line(`Pad: ${pad ? `checked ${hhmm(pad.hour)} today` : 'not checked today (pad pump outside the west end)'}.`), ...partRows(c, inst)];
    } },
  'w45-pad': { panels: { 'pad-pump': null },
    rows: (c, inst) => [step(`Pump: ${c.env.padOn ? 'on: water runs over the pad' : 'off. The check needs water running over the pad (pad plate: run the pump only while the tunnel fans run)'}`, c.env.padOn),
      step('Check the pad: water on every section', inst.st.met)] },
  'p-heatwave': { panels: { 'fan-panel': null, 'pad-pump': null, drinker: null }, title: 'A heat wave is coming: get the house ready',
    rows: (c, inst) => [...partRows(c, inst), line('On the hot days lift the feeders 11:00–16:00 (feed sign), and run all the fans and the pad (heat sign).')] },
  'p-humid': { panels: { 'pad-pump': null, 'fan-panel': null },
    rows: (c, inst) => [cmp('Humidity in', `pad plate: the pads help at or under about ${HEAT.padOffAboveRH} %; above it pump off and all the fans`, `${int(c.env.houseRH)} %`), line(fanLine(c)), ...partRows(c, inst)] },
  'w2-vaccine': { panels: { 'water-supply': null }, title: 'Vaccinate in the drinking water (vaccine plate)',
    rows(c) {
      const v = c.farm.health?.vaccine || { state: 'none' }, s = v.state, h = (t) => (t != null ? one((c.env.day - t) * 24) : '—');
      const thirstH = s === 'thirst' && v.thirstFrom != null ? (c.env.day - v.thirstFrom) * 24 : (v.thirstH ?? 0);
      return [step(`Shut the main valve so the birds get thirsty: ${one(thirstH)} h so far (plate: 1–2 hours)`, thirstH >= 1),
        step(`Vaccine with skim milk stabiliser into the header tank: ${s === 'none' || s === 'thirst' ? 'not yet' : v.stabiliser ? 'mixed with stabiliser' : 'mixed without stabiliser'}`, s !== 'none' && s !== 'thirst' && v.stabiliser),
        step('Open the main valve: the birds drink', s === 'drinking' || s === 'drunk'),
        step(`Walk slowly through the house while they drink: ${pct(v.walked)} of the floor walked`, (v.walked ?? 0) >= 0.3),
        step(`Header tank empty: ${s === 'drunk' ? `drunk in ${one(v.hours)} h` : s === 'drinking' ? `drinking ${h(v.startAt)} h so far` : 'not yet'} (plate: about 2 hours)`, s === 'drunk')];
    } },
  'c-lines': { panels: { 'water-supply': null },
    rows: (c, inst) => [step(`Disinfectant in the header tank: ${c.farm.clean?.disinfectant ? 'yes' : 'not yet'}`, c.farm.clean?.disinfectant || c.engine.parts(inst)[0]?.met),
      step(`Lines flushed with it: ${(c.farm.clean?.lines || []).filter((x) => x >= 1).length} of 4`, (c.farm.clean?.lines || []).every((x) => x >= 1)), note('Each line takes farm time with its flush valve open: let the clock run.')] },
  'p-blood': { panels: { 'office-desk': null, 'water-supply': null },
    rows: (c, inst) => { const m = c.farm.health?.medication || {}; return [...partRows(c, inst), line(m.on ? `Medicator on since day ${Math.floor(m.from)} ${hhmm(((m.from ?? 0) % 1) * 24)}: the vet’s course, mixed fresh each day (medicator plate).` : 'The vet’s answer comes as a letter on the desk: it names the medicine and the days.')]; } },
  'p-hunched': { panels: { 'office-desk': null },
    rows: (c, inst) => [line('Droppings sign: white and watery with hunched, sleepy birds: call the vet.'), step('Phone: call the vet about “Birds sitting hunched, white watery droppings”', inst.st.met),
      note('The vet’s answer comes as a letter on the desk.')] },
  'p-order-feed': { panels: { 'office-desk': null }, rows: (c, inst) => orderRows(c, inst, 'starter', 3) },
  'w2-order': { panels: { 'office-desk': null }, rows: (c, inst) => orderRows(c, inst, 'grower', 3) },
  'w45-order': { panels: { 'office-desk': null }, rows: (c, inst) => orderRows(c, inst, 'finisher', 3) },
  'f-order': { panels: { 'office-desk': null },
    rows(c, inst) {
      const birds = knownFlock(c.env, c.farm).birds, catchAt = c.farm.harvest?.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24;
      const days = Math.max(0, catchAt - 11 / 24 - c.env.day), g = feedStdGAt(Math.max(0, flockAgeAt(c.env.day)) + days / 2);
      return [cmp('Feed to the withdrawal (about 11 h before the catch)', 'feed sign: enough to the withdrawal and no more; less than one day’s feed (about 1.2 t) left at catching',
        `${int(birds)} birds × about ${int(g)} g × ${one(days)} days ≈ ${one((birds * g * days) / 1e6)} t`), ...orderRows(c, inst, 'finisher', 0).slice(0, 1), ...partRows(c, inst)];
    } },
  'w3-change': { panels: { silo: null, 'feeder-box': null }, rows: (c, inst) => changeRows(c, inst, 'grower') },
  'w45-change': { panels: { silo: null, 'feeder-box': null }, rows: (c, inst) => changeRows(c, inst, 'finisher') },
  'f-withdraw': { panels: { 'feeder-box': null }, title: 'Take the feed away before catching',
    rows(c, inst) {
      const at = c.farm.harvest?.catchAt ?? HARVEST.catchDefault.day + HARVEST.catchDefault.hour / 24, t = (x) => `day ${Math.floor(x)} ${hhmm((x % 1) * 24)}`;
      return [line(`Catch: ${t(at)} (booked).`), cmp('Stop the lines', 'feed and catch signs: pans empty 8–12 h before the catch, so stop the lines about 9–13 h before', `${t(at - 13 / 24)} to ${t(at - 9 / 24)} · now ${c.env.timeLabel}`),
        line('Water stays on until catching starts.'), step('Take the feed away (feeder box)', inst.st.met)];
    } },
  'c-dry': { panels: { 'wash-bay': null, controller: 'top', 'fan-panel': null },
    rows: (c) => [line('Clean-out sign, step 4: disinfectant on a wet floor is too weak: let the house dry with the fans first.'),
      cmp('Floor wet', 'dry enough at 10 % or less', pct(c.farm.clean?.wetShare)), line(`Tunnel fans running ${c.env.fansEffective ?? 0}: more fans dry faster.`),
      note('Drying takes hours of farm time: close the panel and use Next job.')] },
  'c-spray': { panels: { 'wash-bay': null },
    rows: (c) => [line(`Disinfected ${pct(c.farm.clean?.sprayShare)} of the floor · floor still wet ${pct(c.farm.clean?.wetShare)} (clean-out sign step 4: spray on a dry floor).`),
      note('Spray in three passes along the house; a wet patch takes the disinfectant weakly: spray it again once it is dry.')] },
  'w3-topup': { panels: { 'litter-heap': null },
    rows: (c, inst) => [line(`Caked patches on the floor in use: ${pct(c.farm.litter?.cakedShare)} of it (fork: E at a caked patch).`),
      (() => { const L = inst.st.list || [], near = L.filter((x) => x.near).length, s = new Set(L.map((x) => x.s)).size; return step(`Sacks under the drinker lines: ${near} of 4, ${s} of 2 parts of the house`, near >= 4 && s >= 2); })()] },
  'w2-check': { panels: { 'bird-check': null }, rows: (c, inst) => [birdCount(inst, 10, 3), line('Watch each bird walk (gait 0–5). Legs sign: cull gait 4–5 the day you find them.')] },
  'w3-droppings': { panels: { 'bird-check': null }, rows: (c, inst) => [birdCount(inst, 5, 3), line('Droppings sign: normal = firm, brown with a white cap.')] },
  'p-lame': { panels: { 'bird-check': null }, rows: (c) => [step(`Birds that cannot walk well, sitting apart: ${c.farm.flock.lameOnFloor ?? 0} left (the marker points to the nearest)`, !(c.farm.flock.lameOnFloor > 0)), line('Legs sign: cull gait 4–5 the day you find them.')] },
};
function changeRows(c, inst, type) {
  const f = c.farm.feed, v = f.valves || [1, 0], word = (x) => (x >= 1 ? 'Open' : x > 0 ? 'Half' : 'Shut');
  const s = (f.silos || []).map((x, i) => `silo ${i + 1} ${x.type}: about ${int(x.kg)} kg, slide valve ${word(v[i])}`).join(' · ');
  return [line(`Feed sign: half from each silo for about 24 hours, then the new feed only.`), line(s),
    step(`Pans: ${type} ${pct(f.panType?.[type])} (of the feed in them)`, (f.panType?.[type] ?? 0) >= 0.9),
    note('The pans change as the birds eat and the augers refill them: let the clock run.')];
}
export { CLEAN, timerAirM3h, brooderRowC, heldText, time, ventRows, timerText };
