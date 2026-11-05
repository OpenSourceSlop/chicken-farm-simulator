// Builds the integrator's Skills update play-through (SKILLS.md §13.3 skills-play, §14.2, §16 step 5):
//   node scripts/skills-play-steps.mjs                  -> scripts/skills-play.json
//   node scripts/skills-play-steps.mjs --dev <parts> <out>   (parts, comma list: none, skilled, night, fault, weigh)
// config SKILLS_UPDATE.live on (main since the integration) and the perks allowed (__game.perks.allow(true)), seed 1, on the
// p3-cycle helpers. Every job of a timed day by real input — walkTo (mouse clicks on the ground), E / Q / R key presses,
// clicks on panel keys, the Next job button — and goto(auto) only to reach the day:
//  1. none     day 16 with no skill (a week 3 standard start, a fresh profile): the day as p3-cycle plays it, timed
//  2. skilled  day 16 with every branch at level 3 (skills.debug.force: a second flock's tree): the four lines read at the
//              sight tubes (Water 2), the tally bucket (Biosecurity 2), r-fans-pm by the fan stages' glance (Ventilation 3),
//              the record signed on the pocket phone in the house (R, Farm Planning 2 and 3); timed against part 1
//  3. night    the Next job skip to day 17: the feed controller's order (Feed 3; the silo hooked to about 2.3 days first)
//  4. fault    day 17: the controller's timer resets at 07:00 inside a Next job skip (a stepper starts timer-reset): the
//              skip stops, the flock watch's Equipment row and warning name it; at the controller Fill the timer
//              (Moisture 2's calculator, one click) fixes it by hand; r-minvent done
//  5. weigh    day 21 08:24: the weekly weighing with Weigh the frame (Growth 2) in five parts, before the automatic scale
//              has its 300 birds; w3-weigh done; the week passes
import { W, adv, ev, exp, shot, press, click, E, esc, job, START, write, until, nextTo,
  gateToHouse, controllerRead, feederBox, waterMeter, walkFloor, deadPick, houseOut, toBin, binCount, deadSweep, outToHouse,
  atFans, fansAll, birdChecks, nightThenRecord, nightAtController, autoTo, passed, morning } from './p3-cycle-steps.mjs';

const BRANCHES = ['planning', 'biosecurity', 'brooding', 'comfort', 'ventilation', 'moisture', 'heating', 'water', 'feed', 'lighting', 'growth'];
const PANEL = '#hud .panel:not([hidden])';

/** The page hooks of this play-through (after p3-cycle's SETUP): the skills' events kept for the checks. */
const HOOKS = ev(`(() => {
  const g = __game;
  window.__autos = []; window.__faults = []; window.__warn = []; window.__acts = [];
  g.events.on('farm:auto', (p) => window.__autos.push({ system: p.system, did: p.did, text: p.text, t: g.env.day }));
  g.events.on('farm:fault', (p) => window.__faults.push({ id: p.id, phase: p.phase, text: p.text, t: g.env.day }));
  g.events.on('watch:warning', (p) => window.__warn.push({ kind: p.kind, text: p.text, t: g.env.day }));
  g.events.on('action', (p) => window.__acts.push({ id: p.id, line: p.line, by: p.by, from: p.from, t: g.env.day }));
  g.config.SKILLS_UPDATE.live = true; g.perks.allow(true);
  return 'live ' + g.config.SKILLS_UPDATE.live + ', perks allowed ' + g.perks.allowed;
})()`);

/** A week 3 standard start in a new run (seed 1); `force` every branch at level 3 first (none: the fresh profile's 0). */
const startWeek3 = (force) => [
  ev(`(() => { const g = __game; g.level.toTitle?.(); ${force ? `for (const b of ${JSON.stringify(BRANCHES)}) g.skills.debug.force(b, 3);` : `for (const b of ${JSON.stringify(BRANCHES)}) g.skills.debug.force(b, null);`}
    g.startRun({ seed: 1 }); g.run.startLevel('week3', { from: 'standard' });
    // the flock's fault plan stays out of the timed days (SKILLS.md §14.1: faults off); part 4 starts its own
    const F = g.farm.auto.faults; for (let i = F.length - 1; i >= 0; i--) if (F[i].phase === 'planned') F.splice(i, 1);
    return 'week 3 standard start at ' + __t() + '; systems on: ' + (Object.entries(g.farm.auto.on).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'); })()`),
  adv(0.5),
  exp(`__game.level.def.id === 'week3' && __game.env.dayNumber === 15 && 'week 3 at ' + __t()`, `week 3 from its standard start (${force ? 'every branch at level 3' : 'no skill'})`),
];

/** p3-cycle's afternoon of day 16 (the fan panel at the east end, five droppings checks walking west, the squeezes). */
const afternoon16 = () => [...outToHouse(),
  ...atFans([shot(`sp-fans-16`), ...fansAll(false)], 'day 16 afternoon: the fan panel'), job('r-fans-pm@16', 'the fans and the house read in the afternoon heat'),
  ...birdChecks(3, 'Look at the vent and droppings', 'sp-droppings', [[18, 2.2], [6, -2], [-6, 2.2]]),
  W(-4, 0.8, 0.5), press('q'), adv(0.3), W(-8, 1.95, 0.5), press('q'), adv(0.3),
  ...birdChecks(2, 'Look at the vent and droppings', 'sp-droppings-b', [[-12, -2], [-18, 2.2]]),
  W(-20, -1.95, 0.5), press('q'), adv(0.3),
  job('w3-droppings@16', 'droppings checked on five birds from three parts of the house'),
  ...deadPick(6), ...houseOut(), ...toBin(), ...binCount(), ...deadSweep(),
  job('p-heat3@16', 'Birds panting in the afternoon: handled at the fan panel')];

// ---------------- 1. day 16 with no skill ----------------
export function partNone() {
  return [
    ...startWeek3(false),
    exp(`__game.perks.list().every((p) => !p.has) && 'no payoff: ' + __game.perks.list().length + ' payoffs off'`, 'a fresh profile: no payoff'),
    ...autoTo(16, 6.05), ev(`__timer('day 16 none')`),
    ...morning({ day: 16, whole: true }),
    ...nextTo(13), ev(`'Next job -> ' + __t()`),
    ...afternoon16(),
    ...nightThenRecord(16, 2),
    ev(`__timerEnd('day 16 none')`), exp(`__missed(16) === '' && 'every job of day 16 done (no skill)'`, 'day 16 with no skill: every job done by real input'),
    ev(`'regulator visits ' + __acts.filter((a) => a.id === 'water.flowtest').length + ' flow tests'`),
  ];
}

// ---------------- 2. day 16 with every branch at level 3 ----------------
/** Water 2: the four lines read at the water supply (one click), the meter in the same visit; no regulator. */
const tubesAndMeter = (day) => [W(-23.0, 5.45, 0.3), ...E('water-supply', 'E opens the water supply'),
  ev(`window.__flow0 = __acts.filter((a) => a.id === 'water.flowtest').length, 'flow tests so far ' + __flow0`),
  click('Read the sight tubes'), adv(0.3), shot('sp-tubes-16'),
  exp(`(() => { const L = __game.farm.water.lines; return L.every((l) => l.lastColumn && l.lastColumn.inBand && Math.floor(l.lastColumn.at) === ${day}) && 'the four tubes at the mark: ' + L.map((l, i) => 'line ' + (i + 1) + ' ' + l.lastColumn.cm + ' cm').join(', '); })()`,
    'Water 2: the four drinker lines read at the sight tubes in one click'),
  click('Lines'), click('Read the meter'), adv(0.2), ...esc(),
  job(`r-drinkers@${day}`, `r-drinkers@${day} done at the water supply (no regulator walked to)`),
];
function morningSkilled(day) {
  return [
    ...gateToHouse(), ...controllerRead(), ...esc(),
    ...feederBox({ raise: false }), ...tubesAndMeter(day),
    ...walkFloor({ whole: true }),
    ev(`window.__dead0 = { counted: __game.farm.flock.countedDead, picks: __acts.filter((a) => a.id === 'dead.count').length }, 'dead counted so far ' + __dead0.counted`),
    ...deadPick(6),
    ev(`(() => { const t = __game.props.bucketTally; return 'the tally on the bucket: ' + JSON.stringify(t && { n: t.n, kg: t.kg, full: t.full }); })()`),
    ...houseOut(), ...toBin(), ...binCount(), ...deadSweep(),
    exp(`(() => { const left = __game.jobs().filter((j) => j.key.endsWith('@${day}') && j.status === 'open'); return 'open after the morning round at ' + __t() + ': ' + (left.map((j) => j.key).join(' ') || 'none'); })()`, `day ${day}: the morning round with the skills`),
  ];
}
/** The night: the ventilation at the controller, then the record signed on the pocket phone where he stands. */
const nightAndPhone = (day) => [...nextTo(18), ev(`'Next job -> ' + __t()`), ...outToHouse(),
  ...nightAtController(2, `day ${day} evening: the ventilation for the night at the controller`),
  until(`__game.level.jobs.byKey('r-vent-night@${day}')?.status === 'done'`, 40),
  job(`r-vent-night@${day}`, `r-vent-night@${day}: the birds comfortable 30 farm minutes after the night setting`),
  press('r'), adv(0.4),
  exp(`(() => { const p = __game.player.position, d = Math.hypot(p.x + 34.1, p.z - 28); return __game.ui.openPanelId === 'pocket-phone' && 'R opens the pocket phone at ' + __t() + ', ' + d.toFixed(0) + ' m from the office desk'; })()`, 'R (a real key press) opens the pocket phone in the house (Farm Planning 2)'),
  ev(`(() => { const b = [...document.querySelectorAll('${PANEL} button')].find((x) => x.textContent.includes('Report the deaths') && !x.disabled && x.offsetParent); if (!b) return 'no report to phone'; b.click(); return 'phoned the vet from the pocket'; })()`), adv(0.2),
  click('Sign today'), adv(0.6), shot('sp-phone-record-16'),
  job(`r-record@${day}`, `r-record@${day} signed on the phone (Farm Planning 3), no walk to the office`), ...esc()];
export function partSkilled() {
  return [
    ...startWeek3(true),
    exp(`(() => { const L = __game.perks.list(); return L.every((p) => p.has) && Object.values(__game.farm.auto.on).every(Boolean) && 'every payoff on (' + L.length + '); the seven controllers on'; })()`, 'every branch at level 3: every payoff and controller on'),
    ...autoTo(16, 6.05),
    exp(`(() => { const j = __game.level.jobs.byKey('r-fans-pm@16'), d = __game.level.jobs.byKey('r-drinkers@16'); return j?.def.variant?.parts?.stages === 'whole' && d?.def.variant?.keys.includes('waterAllLines') && !d.def.variant.parts?.winch && 'day 16 made with the payoffs: r-fans-pm handed to the stages, r-drinkers with the sight tubes (never handed over)'; })()`, 'day 16 jobs made with the payoffs'),
    ev(`__timer('day 16 skills')`),
    ...morningSkilled(16),
    exp(`(() => { const n = __acts.filter((a) => a.id === 'water.flowtest').length - __flow0, p = __acts.filter((a) => a.id === 'dead.count'); return n === 0 && 'no cup test at a regulator; dead.count at pickup ' + p.filter((a) => a.t >= 16).length + ' times, counted ' + (__game.farm.flock.countedDead - __dead0.counted); })()`, 'the morning: no regulator visit, the dead birds counted into the bucket'),
    ...nextTo(13), ev(`'Next job -> ' + __t()`),
    exp(`(() => { const a = __autos.filter((x) => x.system === 'stages' && x.t >= 16); return a.length > 0 && 'the stage table ran the tunnel fans: ' + a.slice(-1)[0].text + ' (' + __game.env.fansOn + ' fans at ' + __t() + ')'; })()`, 'Ventilation 3: the stage table runs the tunnel fans in the morning heat'),
    ...afternoon16(),
    ...nightAndPhone(16),
    ev(`__timerEnd('day 16 skills')`), exp(`__missed(16) === '' && 'every job of day 16 done (every branch at 3)'`, 'day 16 with every branch at level 3: every job done by real input'),
    exp(`(() => { const a = __timed['day 16 none'], b = __timed['day 16 skills']; if (!a || !b) return 'one part only: ' + (a || b).text; const r = b.min / a.min; return r < 0.95 && 'day 16 play: ' + a.min.toFixed(2) + ' min with no skill, ' + b.min.toFixed(2) + ' min with every branch at 3 (' + Math.round(100 * r) + ' %), ' + (a.min - b.min).toFixed(2) + ' min saved'; })()`,
      'SKILLS.md §14.2: day 16 by real input, every branch at 3 against none'),
  ];
}

// ---------------- 3. the night: the feed controller orders ----------------
export function partNight() {
  return [
    ev(`(() => { const g = __game, f = g.farm.feed; f.pending.length = 0; f.silos[1].kg = 0; f.silos[1].layers = []; const fd = g.feedDays(); const kg = Math.round(2.3 * fd.kgPerDay); f.silos[0].kg = kg; f.silos[0].layers = [{ type: 'starter', kg }]; f.siloKg = kg; window.__a0 = __autos.length; window.__s0 = g.level.skipStopped; return 'hook: the silos at ' + kg + ' kg (' + g.feedDays().days + ' days at ' + fd.kgPerDay + ' kg a day), nothing on the way, at ' + __t(); })()`),
    { clickOn: '.ljobs-next' }, adv(0.4), { pressIf: 'j', if: `!__game.ui.openPanelId && __game.env.dayNumber === 16 && __game.env.hour > 18` }, adv(0.4),
    ev(`__game.ui.openPanelId === 'night-check' ? ([...document.querySelectorAll('${PANEL} button')].find((b) => /Skip anyway/.test(b.textContent))?.click(), 'the night check: ' + document.querySelector('${PANEL}').textContent.replace(/\\s+/g, ' ').slice(0, 160)) : 'no night check (nothing off)'`), adv(0.4),
    until(`__game.env.dayNumber === 17 && __game.env.hour >= 5.9 || __game.level.skipStopped !== window.__s0`, 60, 0.5),
    ev(`'after the night skip: ' + __t() + (__game.level.skipStopped !== window.__s0 ? ' (stopped: ' + __game.level.skipStopped.trouble + ')' : '')`),
    exp(`(() => { const o = __autos.slice(__a0).find((x) => x.system === 'feed' && /order/i.test(x.text)), p = __game.farm.feed.pending.find((x) => x.by === 'auto'); return o && p && 'the feed controller ordered in the night: ' + o.text + '; on the way: ' + p.kg + ' kg ' + p.type + ' due day ' + p.arriveDay + ' ' + String(p.arriveHour ?? 9).padStart(2, '0') + ':00'; })()`,
      'Feed 3: the feed controller orders at the 2-day rule while the farmer sleeps'),
    exp(`__game.records.notebook.some((n) => n.kind === 'auto' && /[Ff]eed/.test(String(n.value)) && n.day >= 16) && 'the notebook keeps the controller’s order'`, 'the order in the notebook (kind auto)'),
  ];
}

// ---------------- 4. a fault caught by the flock watch and fixed by hand ----------------
export function partFault() {
  return [
    // the plan is random among the systems on: a stepper (inside the skip, as a planned item would) starts timer-reset at 07:00
    ev(`(() => { const g = __game; let done = false; g.env.addStepper(() => { if (!done && g.env.dayNumber === 17 && g.env.hour >= 7) { done = true; g.farm.debug.fault('timer-reset'); } });
      window.__w0 = __warn.length; window.__f0 = __faults.length; window.__s0 = g.level.skipStopped; window.__timer0 = { ...(g.env.ventTimer || {}) };
      return 'day 17 at ' + __t() + ': the timer on the table (' + JSON.stringify(window.__timer0) + '); it resets at 07:00'; })()`),
    { clickOn: '.ljobs-next' }, adv(0.3), { clickTextUntil: 'Skip to', until: `__game.env.hour >= 13 || __game.level.skipStopped !== window.__s0`, max: 1, in: '.ljobs-foot' }, adv(0.3),
    until(`__game.level.skipStopped !== window.__s0 || __game.env.hour >= 12.9`, 60, 0.5),
    exp(`(() => { const f = __faults.slice(__f0).find((x) => x.id === 'timer-reset' && x.phase === 'start'), s = __game.level.skipStopped; return f && s !== window.__s0 && __game.env.hour < 9 && 'the timer reset at ' + ((f.t % 1) * 24).toFixed(2) + ' h inside the skip; Next job stopped at ' + __t() + ' (' + s.trouble + '): ' + (document.querySelector('#hud .caption')?.textContent || '').slice(0, 140); })()`,
      'the controller resets inside a Next job skip: the skip stops within the farm hour'),
    exp(`(() => { const g = __game, r = g.level.watch.status().rows.equipment, w = g.level.watch.warnings.find((x) => x.kind === 'equipment' && x.t >= 17); return r && r.state !== 'green' && w && w.fix && w.fix.panel === 'controller' && /timer/i.test(w.text) && !/correct|wrong|mistake|failed to/i.test(w.text) && 'Equipment row ' + r.state + ': ' + r.value + ' | warning: ' + w.text.slice(0, 160); })()`,
      'the flock watch: the Equipment row and its warning name the timer, its cause and the controller'),
    exp(`/timer/i.test(document.querySelector('#hud').textContent) && 'the HUD names the timer (the watch card, the caption)'`, 'the warning on the HUD'),
    shot('sp-fault-timer'),
    W(-12, -4.6, 0.3, 80), ...E('controller', 'E opens the controller'), click('Ventilation'), adv(0.2),
    ev(`(() => { const t = [...document.querySelectorAll('${PANEL} [data-payoff="ventCalc"], ${PANEL} .skl-work')].map((e) => e.textContent.replace(/\\s+/g, ' ')).join(' | '); return 'the working beside Fill the timer: ' + t.slice(0, 200); })()`),
    click('Fill the timer'), adv(0.4), shot('sp-fault-fixed'),
    exp(`(() => { const g = __game, f = __faults.slice(__f0).find((x) => x.id === 'timer-reset' && x.phase === 'fixed'), r = g.level.watch.status().rows.equipment; return f && r.state === 'green' && 'fixed by hand: ' + f.text + '; timer ' + JSON.stringify(g.env.ventTimer) + '; the row ' + r.value; })()`,
      'Fill the timer (Moisture 2, one click) fixes the reset by hand: EV.FAULT fixed, the row steady'),
    exp(`(() => { const C = __game.config, fl = __game.farm.flock, t = __game.env.ventTimer, need = C.minVentM3hPer1000(fl.meanWeightG) * fl.alive / 1000, air = C.EQUIP.fanM3h * t.fans * t.onSec / t.cycleSec, p = Math.round((100 * air) / need); return p >= 100 && p <= 125 && 'the timer at ' + p + ' % of the vent sign’s need'; })()`, 'the timer at the vent sign’s need again'),
    job('r-minvent@17', 'r-minvent@17 done by the hand setting'),
    ...esc(),
  ];
}

// ---------------- 5. the weekly weighing with Weigh the frame ----------------
export function partWeigh() {
  const part = (x, z, n) => [W(x, z, 0.4), ev(`window.__wn = __game.ui.L.weighings().n, 'weighed so far ' + __wn`), press('e'), adv(0.2),
    exp(`__game.ui.openPanelId === 'weigh' && 'the frame set down in part ${n}'`, `the frame set down in part ${n}`),
    click('Weigh the frame'), adv(1.4), until(`__game.ui.L.weighings().n >= __wn + 10`, 6, 0.25),
    exp(`__game.ui.L.weighings().n >= __wn + 10 && 'part ${n}: ' + (__game.ui.L.weighings().n - __wn) + ' birds weighed in one press'`, `Weigh the frame in part ${n} (one click)`),
    press('Escape'), adv(0.2)];
  return [
    ...autoTo(20, 21), ev(`(__game.level.debug.goto(21, 8.4), 'the clock to ' + __t())`), adv(0.5),
    exp(`(() => { const i = __game.level.jobs.byKey('w3-weigh@21'), s = __game.auto().systems.scale; return i && i.status === 'open' && i.def.variant?.parts?.scale === 'whole' && 'w3-weigh open at ' + __t() + ' (the scale has its part; under 300 birds weighed so far today: ' + JSON.stringify(s && (s.text || s.state)) + ')'; })()`, 'w3-weigh@21 open: the scale part not met yet in the morning'),
    ev(`__game.level.engine.setCurrent('w3-weigh@21'), __game.ui.jobCard.refresh(), 'w3-weigh is the current job'`), adv(0.3),
    W(-14, 7.4, 0.4), W(-14, 6.9, 0.3), ev(`__timer('frame 21')`),
    W(-6, -1.6, 0.35), ...E('bird-scale', 'E opens the bird scale'), click('Take the scale and frame'), press('Escape'), adv(0.2),
    exp(`__game.props.carrying === 'frame' && 'carrying the frame'`, 'the hand scale and the frame in hand'),
    ...part(1.0, -2.6, 1), ...part(-6, -3.8, 2), ...part(-6, 2.6, 3), ...part(-18, 2.6, 4), ...part(-18, -2.6, 5),
    W(-6, -1.6, 0.35), press('e'), adv(0.2), click('Put them back'), press('Escape'), adv(0.2), ev(`__timerEnd('frame 21')`),
    exp(`(() => { const i = __game.level.jobs.byKey('w3-weigh@21'), w = __game.ui.L.weighings(); return i.status === 'done' && w.n >= 50 && w.sectors >= 5 && 'w3-weigh done: ' + w.n + ' birds from ' + w.sectors + ' parts, ' + __timed['frame 21'].text; })()`, 'w3-weigh done with 50 birds from 5 parts by Weigh the frame'),
    shot('sp-weigh-21'),
    ...autoTo(21, 21), passed('week3'), shot('sp-week3-result'),
    ev(`'faults this level: ' + JSON.stringify(__game.level.result?.faults || []) + '; unlocks: ' + JSON.stringify(__game.level.result?.unlocks || [])`),
  ];
}

// ---------------- writing the file ----------------
export const PARTS = { none: partNone, skilled: partSkilled, night: partNight, fault: partFault, weigh: partWeigh };
if (process.argv[1] && process.argv[1].endsWith('skills-play-steps.mjs')) {
  const dev = process.argv.indexOf('--dev');
  const names = dev >= 0 ? process.argv[dev + 1].split(',') : Object.keys(PARTS);
  const out = dev >= 0 ? process.argv[dev + 2] : 'scripts/skills-play.json';
  for (const n of names) if (!PARTS[n]) throw new Error(`no part ${n}`);
  write(out, [...START, HOOKS, ...names.flatMap((n) => PARTS[n]())]);
}
