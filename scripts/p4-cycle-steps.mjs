// Builds the integrator's Phase 4 play-throughs (PHASE4.md §11.3) as harness steps files, on the helpers of
// scripts/p3-cycle-steps.mjs (the same routes, rounds and play timer):
//   node scripts/p4-cycle-steps.mjs     -> scripts/p4-hot.json, p4-rainy.json, p4-bad.json, p4-water.json, p4-clarity.json
//   node scripts/p4-cycle-steps.mjs --dev <name,...> <file>   one or more of hot, rainy, bad, water, clarity
// Every job of a "real input" part is done the way a player does it (walkTo by real clicks on the ground, E / Escape,
// clicks on panel buttons, the Next job button); goto(auto) only between those parts.
import {
  W, adv, ev, exp, shot, click, clickUntil, until, nextTo, E, esc, job, START, write,
  gateToHouse, houseOut, outToHouse, outToOffice, officeToHouse, autoTo, passed, continueOn, fansAll, atFans, signRecord,
} from './p3-cycle-steps.mjs';
import { DRINKER_LINES_Z } from '../src/config.js';

// ---------------- routes and machines of the conditions (config SPOTS3 / SPOTS4) ----------------
/** From outside the house door round the west end to the cooling pad pump (SPOTS3.padPump) and back. */
const doorToPad = () => [W(-27, 8, 0.6), W(-26.2, -3.0, 0.4)];
const padToDoor = () => [W(-27, 8, 0.6), W(-14, 8.2, 0.5)];
/** From outside the house door west along the north side to the generator's door (SPOTS4.generator). */
const doorToGen = () => [W(-24, 9.6, 0.6), W(-32.0, 8.7, 0.4)];
const genToDoor = () => [W(-24, 9.6, 0.6), W(-14, 8.2, 0.5)];
/** From outside the house door to the water tank's gauges at the tower's foot (SPOTS4.waterTank). */
const doorToTank = () => [W(-27, 8, 0.6), W(-27, -8.5, 0.6), W(-31.4, -11.0, 0.4)];
const tankToDoor = () => [W(-27, -8.5, 0.6), W(-27, 8, 0.6), W(-14, 8.2, 0.5)];
/** The fan panel at the east end from inside the door, and back to the door. */
const toFanPanel = () => [W(-8, 0, 0.6), W(22.4, -4.6, 0.35, 80)];
/** The page's view of a condition: the HUD's clock card tag, the open panel's text. */
const hudTag = (label) => exp(`(document.querySelector('#hud')?.textContent || '').includes('${label}') && 'the HUD names it: ${label}'`, `the HUD names the condition (${label})`);
const panelText = () => `(document.querySelector('#hud .panel:not([hidden])')?.textContent || '').replace(/\\s+/g, ' ')`;
const SUMMARY = (label, key) => [
  ev(`(() => { const b = [...document.querySelectorAll('#hud .panel:not([hidden]) button, .result-btns .btn')].find((x) => /summary/i.test(x.textContent)); if (b) b.click(); return b ? 'opened: ' + b.textContent.trim() : 'no summary button'; })()`), adv(0.4), shot(`${key}-summary`),
  exp(`(() => { const s = __game.run.state(); const ids = ['plan', 'level1', 'week2', 'week3', 'weeks45', 'finish', 'cleanout']; const t = ${panelText()}; return ids.every((id) => s.levels[id]?.state === 'passed') && s.summary && t.includes('${label}') && 'the cycle summary names it: ' + t.slice(0, 160); })()`, `the cycle summary: every level passed, "${label}" on it`),
];

// ---------------- p4-hot.json: the hot season (PHASE4.md §1.3, §4.1) ----------------
export function hot() {
  return [
    // after the first full cycle (the harness's way: the skill profile's count) the run card offers the harder flocks
    ev(`(__game.skills.profile.cyclesDone = 1, __game.level.toTitle(), 'title: ' + __game.level.mode + ', cycles done ' + __game.skills.profile.cyclesDone)`), adv(0.4),
    exp(`/Start a new flock in the hot season/.test(document.querySelector('#hud').textContent) && 'the run card: Harder flocks'`, 'the title card offers the harder flocks after a cycle'),
    shot('p4h-00-title'),
    click('Start a new flock in the hot season', 0, '#hud'), adv(0.4),
    exp(`__game.level.def.id === 'plan' && __game.farm.condition === 'hot' && __game.env.weather === 'hot' && 'planning day ' + __t() + ', ' + __game.farm.condition + ', ' + __game.env.weather`, 'a new flock in the hot season: the planning day in its weather'),
    hudTag('Hot season'), shot('p4h-01-plan'),
    ...autoTo(-2, 21), passed('plan'),
    ...continueOn('Continue to the brooding week', 'level1', -1),
    // ---- day 3 by real input: the pad with one tunnel fan from about 11:00 (the brooder sign's hot-season line) ----
    ...autoTo(3, 10.9), ev(`__timer('day 3')`),
    ...gateToHouse(), ...toFanPanel(), ...E('fan-panel', 'day 3 at 11:00: the fan panel'), adv(2.4),
    click('Start the pad pump'), adv(0.2), click('Fan 1 switch'), adv(0.2), shot('p4h-02-pad-one-fan'),
    exp(`__game.env.padOn && __game.env.fansManual === 1 && 'the pad on with one tunnel fan at ' + __t()`, 'day 3: the pad with one tunnel fan by real clicks'), ...esc(),
    ...nextTo(14), until(`__game.level.jobs.byKey('h-brood-air@3')?.status === 'open'`, 120), ev(`'Next job -> ' + __t()`),
    ...E('fan-panel', 'day 3 at 14:00: the fan panel read with the pad on'), adv(2.4), ...esc(),
    until(`__game.level.jobs.byKey('h-brood-air@3')?.status === 'done'`, 120, 1),
    job('h-brood-air@3', 'Keep the chicks’ afternoon heat down: the pad, one fan, the chicks near their row 30 farm minutes'),
    exp(`(() => { const e = __game.env; return 'house ' + e.houseTemp.toFixed(1) + ' °C (outside ' + e.outsideTemp.toFixed(1) + '), the row ' + e.targetTemp.toFixed(1) + ' °C, chicks feel ' + (__game.farm.comfort.feltMean ?? NaN).toFixed(1) + ' at ' + __t(); })()`, 'day 3 afternoon: the house under the pad'),
    shot('p4h-03-day3-house'), ev(`__timerEnd('day 3')`),
    ...autoTo(7, 21), passed('level1', ', ratio: r.ratio'), shot('p4h-04-brooding-result'),
    exp(`/Hot season/.test(${panelText()}) && 'the result screen names it'`, 'the brooding week result names the hot season'),
    ...continueOn('Continue to Week 2', 'week2', 8),
    // ---- day 10 by real input: the young birds' pad with one fan (sign-heat's young-birds line) ----
    ...autoTo(10, 10.9), ev(`__timer('day 10')`),
    ...gateToHouse(), ...toFanPanel(), ...E('fan-panel', 'day 10 at 11:00: the fan panel'), adv(2.4),
    ev(`__game.env.padOn ? 'pad already on' : ([...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((b) => /Start the pad pump/.test(b.textContent))?.click(), 'pad pump on')`), adv(0.2),
    ev(`__game.env.fansManual === 1 ? 'one fan already' : ([...document.querySelectorAll('#hud .panel:not([hidden]) [aria-label="Fan 1 switch"]')][0]?.click(), 'fan 1 switched')`), adv(0.2),
    exp(`__game.env.padOn && __game.env.fansManual === 1 && 'the young birds: the pad with one fan at ' + __t()`, 'day 10: the pad with one tunnel fan'), ...esc(),
    ...nextTo(13), until(`__game.level.jobs.byKey('h-young-heat@10')?.status === 'open'`, 120), ev(`'Next job -> ' + __t()`),
    ...E('fan-panel', 'day 10 afternoon: the fan panel read'), adv(2.4), shot('p4h-05-day10-fans'), ...esc(),
    until(`__game.level.jobs.byKey('h-young-heat@10')?.status === 'done'`, 120, 1),
    job('h-young-heat@10', 'Keep the young birds’ afternoon heat down: few panting, none chilled, 30 farm minutes'),
    exp(`'panting ' + __game.farm.comfort.pantShare.toFixed(2) + ', felt ' + (__game.farm.comfort.feltMean ?? NaN).toFixed(1) + ' °C, outside ' + __game.env.outsideTemp.toFixed(1) + ' at ' + __t()`, 'day 10 afternoon: the young birds under the pad'),
    ev(`__timerEnd('day 10')`),
    ...autoTo(14, 21), passed('week2'), ...continueOn('Continue to Week 3', 'week3', 15),
    ...autoTo(21, 21), passed('week3'), ...continueOn('Continue to Weeks 4 and 5', 'weeks45', 22),
    // ---- day 30 by real input: the heat wave (41 °C), the flush of the warm line water, the evening rule ----
    ...autoTo(30, 10.9), ev(`__timer('day 30')`),
    ...gateToHouse(), ...toFanPanel(), ...atFans([...fansAll(true), shot('p4h-06-heatwave-fans')], 'the heat wave: the fan panel, every fan and the pad'),
    ...houseOut(), ...doorToPad(), ...E('pad-pump', 'the heat wave: the pad pump'), click('Check the pad: water on every section'), adv(0.3),
    until(`/Checked [0-9]/.test(${panelText()})`, 60, 0.5), ...esc(),
    ...padToDoor(), ...outToHouse(), W(-21.3, DRINKER_LINES_Z[0], 0.4), ...E('drinker-0', 'the heat wave: a flow test on line 1'), click('Flow test'), adv(2.6), ...esc(),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-heatwave@')); return j && j.status === 'done' && 'p-heatwave done at ' + __t(); })()`, 'A heat wave is coming: fans read, the pad checked, a flow test'),
    ...nextTo(13), until('__game.env.hour >= 13', 120), ev(`'Next job -> ' + __t()`),
    W(-23.0, 5.45, 0.3), ...E('water-supply', 'day 30: the water supply, the lines’ water'), click('Lines'), adv(0.2),
    exp(`/°C/.test(${panelText()}) && 'each line’s water: ' + JSON.stringify(__game.farm.water.lineTempC?.map((v) => +v.toFixed(1)))`, 'the water supply shows each line’s water temperature (hot season)'),
    click('Open flush valve'), click('Open flush valve'), click('Open flush valve'), click('Open flush valve'), adv(0.2), shot('p4h-07-flush'),
    until(`__game.farm.water.lineTempC?.every((v) => v <= 30)`, 60, 0.5), adv(1),
    click('Close flush valve'), click('Close flush valve'), click('Close flush valve'), click('Close flush valve'), adv(0.2), ...esc(),
    job('h-flush@30', 'Flush the warm water out of the drinker lines: every line at 30 °C or under'),
    ...nextTo(18), until('__game.env.hour >= 18', 300), ev(`'Next job -> ' + __t()`),
    ...toFanPanel(), ...atFans([ev(`'evening ' + __t() + ': outside ' + __game.env.outsideTemp.toFixed(1) + ' °C, fans ' + __game.env.fansOn + ', pad ' + __game.env.padOn + ', panting ' + __game.farm.comfort.pantShare.toFixed(2)`)], 'day 30 evening: every fan and the pads (the heat sign: the pads on while the outside is over about 30 °C)'),
    until(`__game.level.jobs.byKey('r-vent-night@30')?.status === 'done'`, 120, 1),
    job('r-vent-night@30', 'the night ventilation: every fan and the pad while the outside air is over 29.5 °C'),
    ev(`__timerEnd('day 30')`), ev(`'not done on day 30: ' + (__missed(30) || 'none')`),
    ...autoTo(35, 21), passed('weeks45'), shot('p4h-08-weeks45-result'),
    ...continueOn('Continue to Finishing and harvest', 'finish', 36),
    ...autoTo(42, 21), passed('finish', ', live: r.liveG, fcr: r.fcr'),
    ...continueOn('Continue to Clean-out and rest', 'cleanout', 43),
    ...autoTo(67, 7), adv(0.5), passed('cleanout'),
    ...SUMMARY('Hot season', 'p4h-09'),
    ev(`Object.values(window.__timed).map((t) => t.text).join(' | ')`),
  ];
}

// ---------------- p4-rainy.json: the rainy season's storm and power cut on day 33 (PHASE4.md §1.4, §4.2) ----------------
export function rainy() {
  return [
    ev(`(__game.skills.profile.cyclesDone = 1, __game.level.toTitle(), __game.startRun({ seed: 1, condition: 'rainy' }), __game.run.startLevel('weeks45', { from: 'standard', condition: 'rainy' }), 'weeks 4-5 standard start: ' + __t() + ', ' + __game.farm.condition)`), adv(0.5),
    exp(`__game.level.def.id === 'weeks45' && __game.farm.condition === 'rainy' && __game.env.dayNumber === 22 && 'weeks 4-5 in the rainy season at ' + __t()`, 'a standard start of weeks 4 and 5 in the rainy season (day 22 06:00)'),
    hudTag('Rainy season'),
    ...autoTo(33, 13.8), ev(`__timer('day 33')`),
    exp(`(__game.farm.problems.find((p) => p.id === 'storm-33') || {}).phase !== undefined && 'storm-33 ' + (__game.farm.problems.find((p) => p.id === 'storm-33') || {}).phase + ', rain ' + __game.farm.weatherNow.rain + ' at ' + __t()`, 'day 33: the storm of the afternoon is due (the radio said so the day before)'),
    // ---- the storm: the flaps on the south inlets at the controller by the door ----
    ...gateToHouse(), W(-12, -4.6, 0.3), ...E('controller', 'day 33: the controller by the door'), adv(2.4), click('Ventilation'), adv(0.1),
    until('__game.farm.weatherNow.rain > 0', 60, 0.5),
    click('Close the storm flaps'), adv(0.2), shot('p4r-01-flaps'),
    exp(`__game.farm.house.flapsClosed === true && 'storm flaps closed at ' + __t() + ', rain ' + __game.farm.weatherNow.rain`, 'the storm: the flaps closed over the south inlets (a lit switch)'), ...esc(),
    // ---- the fan panel in the storm, then the cut at 15:10 (a Next job skip stops at it) ----
    ...toFanPanel(), ...E('fan-panel', 'the storm: the fan panel'), adv(2.4), ...esc(),
    ...[0, 1, 2, 3, 4, 5].flatMap(() => [{ clickTextUntil: 'Next job', until: '!__game.farm.power.on', max: 1, in: '.ljobs-foot' }, adv(0.3), { clickTextUntil: 'Skip to', until: '!__game.farm.power.on', max: 1, in: '.ljobs-foot' }, adv(0.3)]),
    until('!__game.farm.power.on', 200, 1),
    ev(`(window.__cutAt = __game.env.day, 'the power off at ' + __t())`),
    exp(`!__game.farm.power.on && Math.abs(__game.env.hour - (15 + 10 / 60)) < 2 / 60 && 'the cut at ' + __t() + ' (the skip stopped at it)'`, 'the power goes off at 15:10 in the storm; the skip stops'),
    adv(0.6),
    exp(`__game.env.timeScale === __game.config.LEVEL1.clock[__game.config.GENERATOR.clockWhileDark] && !!document.querySelector('#hud .alarm:not([hidden])') && 'the dark-house clock ' + __game.env.timeScale + ' and the alarm'`, 'the dark house: the alarm banner, the clock at the carrying speed'),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-power@')); return j && j.status === 'open' && 'pinned: ' + j.key; })()`, 'The power is off: start the generator (pinned)'),
    shot('p4r-02-dark'),
    // ---- the walk from the fan panel to the generator, its 2-minute start, the transfer switch ----
    W(-8, 0, 0.6), W(-14, 4.6, 0.5), ...houseOut(), ...doorToGen(),
    ev(`'at the generator ' + ((__game.env.day - __cutAt) * 1440).toFixed(1) + ' farm minutes after the cut'`),
    ...E('generator', 'E opens the generator'), click('Start the generator'), adv(0.3),
    until('__game.farm.generator.running', 20, 0.25), click('House on the generator'), adv(0.3),
    exp(`__game.farm.power.on && __game.farm.power.source === 'generator' && ((__game.env.day - __cutAt) * 1440) <= 11.5 && 'the power back on the generator ' + ((__game.env.day - __cutAt) * 1440).toFixed(1) + ' farm minutes after the cut'`, 'from the fan panel to the power back in 11 farm minutes or less (the walk, the 2-minute start, the switch)'),
    shot('p4r-03-generator'), ...esc(),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-power@')); return j && j.status === 'done' && 'p-power done: ' + JSON.stringify(__game.farm.flock.deathsByCause || {}).slice(0, 120); })()`, 'p-power done (the generator running, the house on it)'),
    // ---- the mains back at 18:10: back to the mains, the generator stopped ----
    ...[0, 1, 2, 3, 4, 5].flatMap(() => [{ clickTextUntil: 'Next job', until: '__game.farm.power.mains', max: 1, in: '.ljobs-foot' }, adv(0.3), { clickTextUntil: 'Skip to', until: '__game.farm.power.mains', max: 1, in: '.ljobs-foot' }, adv(0.3)]),
    until('__game.farm.power.mains', 400, 2),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-power-back@')); return __game.farm.power.mains && j && 'the mains back at ' + __t() + ': ' + j.key + ' ' + j.status; })()`, 'the mains is back (18:10): the pinned job opens'),
    ...E('generator', 'E opens the generator again'), click('House on the mains'), adv(0.2), click('Stop the generator'), adv(0.3), ...esc(),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-power-back@')); return j && j.status === 'done' && !__game.farm.generator.running && __game.farm.power.source === 'mains' && 'back on the mains, generator stopped at ' + __t(); })()`, 'The mains is back: switched over and the generator stopped'),
    ev(`__timerEnd('day 33')`),
    ...genToDoor(),
    ...autoTo(33, 21.5), ev(`(() => { const r = __game.records.row(33); return 'day 33 record: ' + JSON.stringify(r?.notes ?? r?.condNotes ?? r).slice(0, 400); })()`),
    ...autoTo(35, 21), passed('weeks45'), shot('p4r-04-weeks45-result'),
    exp(`/Rainy season/.test(${panelText()}) && 'the result names the rainy season'`, 'the weeks 4-5 result names the rainy season'),
  ];
}

// ---------------- p4-bad.json: a bad batch of chicks in the brooding week (PHASE4.md §1.5, §4.3) ----------------
const CHICK = (i) => [{ clickText: `Chick ${i}`, in: '#hud .panel:not([hidden]) .grade-box' }, { clickText: 'Turn on its back' }, { clickText: 'Look at the navel' }, { clickText: 'Look at the hocks' }];
export function bad() {
  const TIPS = [[-16, -1], [-16, 1], [-10, -1], [-10, 1], [-4, -1], [-4, 1]];
  return [
    ev(`(__game.skills.profile.cyclesDone = 1, __game.level.toTitle(), __game.startRun({ seed: 1, condition: 'badChicks', at: 'level1' }), 'a bad batch: ' + __t() + ', ' + __game.farm.condition)`), adv(0.5),
    exp(`__game.level.def.id === 'level1' && __game.farm.condition === 'badChicks' && __game.env.dayNumber === -1 && 'the prep day of a bad batch at ' + __t()`, 'a bad batch: the brooding week from the prep day'),
    hudTag('A bad batch of chicks'),
    // ---- the prep day: feed trays and chick paper at the feeder box ----
    ...gateToHouse(), W(-18, -4.9, 0.35), ...E('feeder-box', 'the prep day: the feeder box'), click('Put out feed trays and chick paper'), adv(0.2), shot('p4b-01-trays'), ...esc(),
    job('b-trays@-1', 'Put feed trays and chick paper by the brooders'),
    ...autoTo(0, 9.9),
    until('__game.farm.flock.inBoxes > 0', 60, 0.5), ev(`__timer('day 0')`),
    exp(`Math.abs(__game.env.hour - 10) < 0.3 && 'the chick truck two hours late: ' + __t() + ', ' + __game.farm.flock.inBoxes + ' chicks in boxes'`, 'the chick truck comes at 10:00 (the delivery ticket: a young parent flock)'),
    // ---- day 0 by real input: the box weighed, the ten chicks of the sample graded, four stacks graded ----
    ...houseOut(), W(-10.4, 9.6, 0.4), W(-10.6, 9.2, 0.3), ...E('chick-table', 'E opens the chick sample table'),
    click('Weigh the box'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(CHICK), adv(0.3), shot('p4b-02-sample'),
    click('Hand in the sheet'), adv(0.3),
    exp(`__game.farm.stats.chickWeightMeasuredG < 38 && 'the box weighs ' + __game.farm.stats.chickWeightMeasuredG.toFixed(1) + ' g a chick'`, 'the box weighing reads about 36 g (small chicks)'),
    exp(`(() => { const p = __game.farm.problems.find((x) => x.id === 'weak-batch'); return p && p.phase === 'found' && 'Many weak chicks in the boxes: found by ' + (p.foundBy || p.by || '?'); })()`, 'the weak batch found at the table'),
    click('Grade the stacks'), adv(0.2), shot('p4b-03-grade-tab'),
    ...[0, 1, 2, 3].flatMap((st) => [{ clickText: `Grade stack ${st + 1}`, in: '#hud .panel:not([hidden])' }, adv(0.3), until(`(window.__graded = __game.farm.flock.stacks[${st}]?.graded) === true`, 40, 0.25), adv(0.6)]),
    shot('p4b-04-graded'),
    exp(`__game.farm.flock.stacks.filter((s) => s.graded).length >= 4 && 'graded out ' + __game.farm.flock.gradedOut + ' chicks from four stacks at ' + __t()`, 'four stacks graded at the table (the weak ones in the cull box)'), ...esc(),
    // the stacks go in (p2-level1.json carries them by real input; here the tip is scripted)
    ev(`(${JSON.stringify(TIPS)}.forEach(([x, z], st) => __game.farm.act('chicks.tip', { stack: st, chicks: 1000, x, z })), 'stacks tipped by script: ' + __game.farm.flock.placed + ' placed at ' + __t())`),
    // ---- the hatchery told from the office phone (the records book's Phone page) ----
    ...outToOffice(), ...E('office-desk', 'the office desk'), click('Phone'), adv(0.1), shot('p4b-05-phone'),
    click('Call the hatchery about the chicks'), adv(0.3), ...esc(),
    exp(`__game.farm.flock.claimed > 0 && 'claimed ' + __game.farm.flock.claimed + ' chicks (the hatchery told on day 0 at ' + __t() + ')'`, 'the hatchery told on day 0: the graded-out chicks claimed'),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-weak-batch@')); return j && j.status === 'done' && j.key + ' done'; })()`, 'Many weak chicks in the boxes: four stacks graded and the hatchery told'),
    // ---- the thermostat at the row + 1 °C (b-warm) at the controller ----
    ...officeToHouse(), W(-12, -4.6, 0.3), ...E('controller', 'the controller: the thermostat'), adv(2.4), click('Temperature'), adv(0.1),
    clickUntil('Raise the brooder thermostat by 0.5 °C', `__game.env.heaterSetpoint >= Math.round(__game.config.targetTempAt(0) * 2) / 2 + 1`, 6), adv(0.2), shot('p4b-06-warmer'), ...esc(),
    until(`__game.level.jobs.byKey('b-warm@0')?.status === 'done'`, 60, 1),
    job('b-warm@0', 'Brood the small chicks 1 °C warmer: the thermostat at the row + 1 °C'),
    ev(`__timerEnd('day 0')`),
    ...autoTo(7, 21), passed('level1', ', ratio: r.ratio'), shot('p4b-07-result'),
    exp(`(() => { const r = __game.level.result; return r.ratio >= 4 && /A bad batch/.test(${panelText()}) && 'the day 7 weight ' + r.ratio.toFixed(2) + ' × the measured ' + __game.farm.stats.chickWeightMeasuredG.toFixed(1) + ' g; deaths ' + r.deathsPct.toFixed(2) + ' % (claimed apart ' + __game.farm.flock.claimed + ')'; })()`, 'the result against the measured chick weight, the claimed chicks apart, the condition named'),
  ];
}

// ---------------- p4-water.json: the worn well pump in weeks 4 and 5 (PHASE4.md §1.6, §4.4) ----------------
const readTank = (day, label) => [...doorToTank(), ...E('water-tank', label), click('Read the gauges'), adv(0.3), shot(`p4w-tank-${day}`),
  exp(`(() => { const r = __game.farm.condX?.gauges?.slice(-1)[0]; const t = __game.farm.waterTank; return 'day ${day} gauges at ' + __t() + ': tank ' + t.levelPct.toFixed(0) + ' %, marker ' + t.lowPct.toFixed(0) + ' %, pump ' + (r ? r[2] + ' bar' : JSON.stringify(t).slice(0, 80)); })()`, `day ${day}: the tank and the well pump's gauges read`), ...esc()];
export function water() {
  return [
    ev(`(__game.skills.profile.cyclesDone = 1, __game.level.toTitle(), __game.startRun({ seed: 1, condition: 'water' }), __game.run.startLevel('weeks45', { from: 'standard', condition: 'water' }), 'weeks 4-5 standard start: ' + __t() + ', ' + __game.farm.condition)`), adv(0.5),
    exp(`__game.level.def.id === 'weeks45' && __game.farm.condition === 'water' && __game.env.dayNumber === 22 && 'weeks 4-5 with a water problem at ' + __t()`, 'a standard start of weeks 4 and 5 with the water problem (day 22 06:00)'),
    hudTag('A water problem'),
    ...gateToHouse(), ...houseOut(), ...readTank(22, 'day 22: the water tank and the well pump'), job('w-tank@22', 'Read the water tank and the well pump’s gauges (day 22)'),
    ...autoTo(26, 6.5), ...gateToHouse(), ...houseOut(), ...readTank(26, 'day 26: the gauges'),
    ...autoTo(27, 6.5), ev(`__timer('day 27')`), ...gateToHouse(), ...houseOut(), ...readTank(27, 'day 27: the gauges'),
    exp(`(() => { const g = __game.farm.condX?.gauges?.slice(-1)[0]; const p = __game.farm.problems.find((x) => x.id === 'pump-wear'); return g && g[2] <= __game.config.WATER_TANK.wornBar && p?.phase === 'found' && 'the pump reads ' + g[2] + ' bar, ' + g[3] + ' A: The well pump gives less water'; })()`, 'day 27: the pump at about 2.1 bar and 6.4 A (the plate: 2.4 bar, 6 A)'),
    ...E('water-tank', 'the water tank: repair the pump'), click('Repair the pump'), adv(0.3), shot('p4w-repair'),
    exp(`__game.farm.waterTank.fixing && 'the repair runs: until ' + __game.farm.waterTank.fixUntil.toFixed(3)`, 'Repair the pump: a 2-hour farm process'), ...esc(),
    ...tankToDoor(),
    ...[0, 1, 2, 3].flatMap(() => [{ clickTextUntil: 'Next job', until: '!__game.farm.waterTank.fixing', max: 1, in: '.ljobs-foot' }, adv(0.3), { clickTextUntil: 'Skip to', until: '!__game.farm.waterTank.fixing', max: 1, in: '.ljobs-foot' }, adv(0.3)]),
    until('!__game.farm.waterTank.fixing', 400, 2),
    exp(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-pump@')); return j && j.status === 'done' && __game.farm.waterTank.pumpShare === 1 && 'the pump repaired at ' + __t() + ': ' + j.key + ' done'; })()`, 'The well pump gives less water: done once the repair ended (pump-ok)'),
    ev(`__timerEnd('day 27')`),
    ...autoTo(35, 21), passed('weeks45'), shot('p4w-weeks45-result'),
    exp(`(() => { const t = __game.farm.condX?.tankDays || {}; const low = Math.min(...Object.values(t).map((d) => d.low)); return /A water problem/.test(${panelText()}) && 'the result names it; the tank never under ' + low.toFixed(0) + ' %'; })()`, 'the weeks 4-5 result names the water problem; the tank kept up'),
  ];
}

// ---------------- p4-clarity.json: the clarity leftovers of the last check at 960 x 600 (PHASE4.md §6) ----------------
const strip = () => `[...document.querySelectorAll('#hud .panel:not([hidden]) .jstrip:not([hidden])')].map((x) => x.textContent).join(' ').replace(/\\s+/g, ' ')`;
const inView = (sel) => `(() => { const e = [...document.querySelectorAll('#hud .panel:not([hidden]) ' + ${JSON.stringify(sel)})].find((x) => x.offsetParent); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })()`;
const byText = (t) => `[...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(t)}) && b.offsetParent)`;
export function clarity() {
  return [
    ev(`(__game.level.toTitle(), __game.startLevel({ seed: 1 }), 'the prep day: ' + __t())`), adv(0.5),
    // §6.2, §6.3, §6.5: the controller's Ventilation tab at 960 x 600, the vent row of the strip
    ...gateToHouse(), W(-12, -4.6, 0.3), ...E('controller', 'the prep day: the controller'), adv(2.4), click('Ventilation'), adv(0.4), shot('p4c-01-vent'),
    exp(`${inView('button[aria-label="One second more"]')} && !!${byText('Send this setting')} && ${inView('.key--apply, button.key--apply')} && /% of the need/.test(${panelText()}) && 'the timer keys, Send this setting and the need on screen together'`, '§6.2 the vent keys, Send this setting and "% of the need" inside the 960 x 600 view'),
    exp(`(() => { const t = ${strip()}; return /about 900 m³\\/h/.test(t) && /835–1,210/.test(t) && 'the vent row: ' + t.slice(t.indexOf('about 900') - 20, t.indexOf('about 900') + 140); })()`, '§6.5 the prep day vent row: the sign’s "about 900 m³/h" and the 90–130 % band (835–1,210 m³/h)'),
    exp(`!!document.querySelector('#hud .panel:not([hidden]) .jstrip .js-band') && 'the strip bar marks the sign’s 90–130 % band'`, '§6.3 the Sign / Yours bar marks the band'),
    // §6.1: a pressed toggle is a lit switch, not the blue primary key
    ev(`(window.__applyBg = ((s) => s.backgroundImage + ' ' + s.backgroundColor)(getComputedStyle(${byText('Send this setting')})), 'apply key ' + __applyBg)`), ...esc(),
    W(-18, -4.9, 0.35), ...E('feeder-box', 'the feeder box'), adv(0.3), shot('p4c-02-feeder'),
    exp(`(() => { const t = ${strip()}; return /finished when/.test(t) && /5 cm/.test(t) && /95 %/.test(t) && 'feeder strip: ' + t.slice(t.indexOf('finished when'), t.indexOf('finished when') + 140); })()`, '§6.8 the feeder strip states the finished outcome per line (rim, flood windows, pans 95 % full)'),
    ev(`(() => { const p = [...document.querySelectorAll('#hud .panel:not([hidden]) .plate summary, #hud .panel:not([hidden]) .plate button')][0]; p?.click(); return 'plate opened'; })()`), adv(0.2),
    exp(`/give or take 3 cm/.test(${panelText()}) && /general/i.test(${panelText()}) && 'the feeder plate: give or take 3 cm (general)'`, '§6.4 the ±3 cm band on the feeder plate, tagged general'),
    click('Start auger'), adv(0.2), ev(`[...document.querySelectorAll('#hud .panel:not([hidden]) [aria-pressed]')].filter((x) => x.offsetParent).map((x) => x.textContent.trim().slice(0, 20) + '=' + x.getAttribute('aria-pressed')).join(' | ')`),
    exp(`(() => { const k = [...document.querySelectorAll('#hud .panel:not([hidden]) .key[aria-pressed="true"], #hud .panel:not([hidden]) [aria-pressed="true"]')].find((x) => x.offsetParent); if (!k) return false; const s = getComputedStyle(k), bg = s.backgroundImage + ' ' + s.backgroundColor, lamp = getComputedStyle(k, '::before').content; return bg !== __applyBg && lamp && lamp !== 'none' && 'pressed toggle ' + bg + ' (apply ' + __applyBg + '), lamp ' + lamp; })()`, '§6.1 an on toggle is a lit switch: not the apply key’s blue, its lamp lit'),
    ...esc(),
    W(-21.3, DRINKER_LINES_Z[0], 0.4), ...E('drinker-0', 'drinker line 1'), adv(0.2),
    ev(`(() => { const p = [...document.querySelectorAll('#hud .panel:not([hidden]) .plate summary, #hud .panel:not([hidden]) .plate button')][0]; p?.click(); return 'plate opened'; })()`), adv(0.2), shot('p4c-03-drinker-plate'),
    exp(`/give or take 3 ml\\/min/.test(${panelText()}) && 'the drinker plate: give or take 3 ml/min'`, '§6.4 the ±3 ml/min band on the drinker plate, tagged general'), ...esc(),
    // §6.9: the half-and-half of the feed change (w3-change) needs its 20 hours of mixed feed
    ev(`(__game.startRun({ seed: 1 }), __game.run.startLevel('week3', { from: 'standard' }), __game.level.debug.goto(15, 9), 'week 3: ' + __t())`), adv(0.4),
    exp(`(() => { const j = __game.level.jobs.byKey('w3-change@15'); const b = __game.farm.stats.blendH ?? 0; return j && j.status === 'open' && b > 10 && b < 20 && 'w3-change open after ' + b.toFixed(1) + ' h of the half-and-half (the rule waits for 20 h): ' + (document.querySelector('.ljobs')?.textContent.match(/half[^.]*/i)?.[0] ?? ''); })()`, '§6.9 w3-change waits for the half-and-half period'),
    // §6.6: r-fans-pm's strip at the fan panel shows only its own rule's step
    ev(`(__game.level.debug.goto(16, 13.1, { auto: true }), __game.level.debug.goto(16, 13.4), 'week 3 afternoon: ' + __t() + ', r-fans-pm ' + __game.level.jobs.byKey('r-fans-pm@16')?.status)`), adv(0.3),
    ...gateToHouse(), ...toFanPanel(), ...E('fan-panel', 'day 16 afternoon: the fan panel'), adv(2.6), shot('p4c-04-fans-strip'),
    exp(`(() => { const j = __game.level.jobs.byKey('r-fans-pm@16'); const blocks = [...document.querySelectorAll('#hud .panel:not([hidden]) .jstrip .js-job')]; const bad = blocks.filter((b) => /Done/.test(b.querySelector('.js-k')?.textContent || '') && b.querySelector('.js-step:not(.is-done)')); const mine = blocks.find((b) => /Afternoon check/.test(b.textContent)); return j?.status === 'done' && mine && bad.length === 0 && 'r-fans-pm done; its strip: ' + mine.querySelector('.js-k').textContent + ', ' + mine.querySelectorAll('.js-step').length + ' step(s), all ticked; ' + blocks.length + ' strips, none Done over an unticked step'; })()`, '§6.6 r-fans-pm: no Done over an unticked step'),
    // §6.12: Birds feel is the model's felt temperature (shown without the unlock; the wind chill line is the unlock)
    exp(`(() => { const c = document.querySelector('#hud .panel:not([hidden]) .cyc-windchill'); const v = parseFloat(c?.querySelector('.lcd-v, output, b, strong')?.textContent ?? c?.textContent.replace(/[^0-9.]/g, ' ').trim().split(' ')[0]); const m = __game.farm.comfort.feltMean; return c && !c.hidden && Math.abs(v - m) <= 0.11 && 'Birds feel ' + v + ' °C = feltMean ' + m.toFixed(2); })()`, '§6.12 the fan panel’s Birds feel is the model’s felt temperature'),
    ...esc(),
  ];
}

// ---------------- writing the files ----------------
const FILES = { hot: 'scripts/p4-hot.json', rainy: 'scripts/p4-rainy.json', bad: 'scripts/p4-bad.json', water: 'scripts/p4-water.json', clarity: 'scripts/p4-clarity.json' };
const PARTS = { hot, rainy, bad, water, clarity };
if (process.argv[1] && process.argv[1].endsWith('p4-cycle-steps.mjs')) {
  const dev = process.argv.indexOf('--dev');
  if (dev >= 0) write(process.argv[dev + 2], [...START, ...process.argv[dev + 1].split(',').flatMap((n) => PARTS[n]())]);
  else for (const [n, f] of Object.entries(FILES)) write(f, [...START, ...PARTS[n]()]);
}
