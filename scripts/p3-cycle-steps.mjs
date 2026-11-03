// Builds the integrator's Phase 3 play-throughs (PHASE3.md §16) as harness steps files:
//   node scripts/p3-cycle-steps.mjs        -> scripts/p3-cycle.json, scripts/p3-replay.json
// Every job of a "real input" day is done the way a player does it: walkTo (real mouse clicks on the
// ground), E / Q / L key presses, clicks on panel buttons, the Next job button; goto(auto) only
// between those days. The timed days record the play time: the seconds the harness advanced the game
// (walking, panels, carrying at their clock speeds) plus 2 s per click or key press in the HUD.
import { writeFileSync } from 'node:fs';
import { DRINKER_LINES_Z } from '../src/config.js';

// ---------------- step helpers ----------------
export const W = (x, z, tol = 0.45, max = 60) => ({ walkTo: [x, z], tol, max });
export const adv = (s) => ({ advance: s });
export const ev = (eval_) => ({ eval: eval_ });
export const exp = (expect, label) => ({ expect, label });
export const shot = (name) => ({ shot: name });
export const press = (k) => ({ press: k });
export const click = (text, times) => (times ? { clickText: text, times } : { clickText: text });
export const clickUntil = (text, until, max = 80) => ({ clickTextUntil: text, until, max });
export const until = (advanceUntil, max = 60, step = 0.5) => ({ advanceUntil, max, step });
export const next = () => [{ clickOn: '.ljobs-next' }, adv(0.4)];
/** E at an interactable and the panel it opens. */
export const E = (id, label) => [press('e'), adv(0.25), exp(`__game.ui.openPanelId === '${id}' || ('open: ' + __game.ui.openPanelId + ', nearest ' + __game.interact.nearest(__game.player)?.id) && false`, label || `E opens ${id}`)];
export const esc = () => [press('Escape'), adv(0.15)];
export const job = (key, label) => exp(`(() => { const j = __game.level.jobs.byKey('${key}'); return j && j.status === 'done' && '${key} done at ' + __t(); })()`, label || `${key} done`);

// The page helpers every play-through installs first: the clock label, the play timer, the nearest dead
// bird, the vent sign's timer for the flock, the open panel.
export const SETUP = ev(`__game.stop(), (() => {
  const g = __game;
  window.__t = () => 'day ' + g.env.dayNumber + ' ' + g.env.timeLabel;
  window.__play = 0; window.__inputs = 0; window.__inputSec = 0; window.__timed = {};
  let lastIn = null;
  const input = (key) => { window.__inputs++; window.__inputSec += key === lastIn ? 0.4 : 2; lastIn = key; };
  const a = g.advance.bind(g); g.advance = (s, dt) => { window.__play += s; return a(s, dt); };
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('#hud') && (e.target.closest('button, label, input') || e.target); if (b) input(b); }, true);
  document.addEventListener('keydown', (e) => { input('key:' + e.code); }, true);
  window.__timer = (name) => { window.__timed[name] = { play: window.__play, inputs: window.__inputs, sec: window.__inputSec, day: g.env.day }; return 'timer ' + name + ' at ' + __t(); };
  // play time = the seconds the game advanced (walking, panels, carrying at their clock speeds) + 2 s per click or key
  // press (0.4 s when it repeats the one before: pressing + again)
  window.__timerEnd = (name) => { const t = window.__timed[name]; const s = window.__play - t.play, n = window.__inputs - t.inputs, si = window.__inputSec - t.sec; t.min = (s + si) / 60; t.text = name + ': ' + (s / 60).toFixed(2) + ' min advanced + ' + n + ' inputs (' + (si / 60).toFixed(2) + ' min) = ' + t.min.toFixed(2) + ' min of play for ' + ((g.env.day - t.day) * 24).toFixed(1) + ' game h'; return t.text; };
  window.__deadNear = () => { if (!g.player.isInside) return null; const p = g.player.position; const d = g.flock.dead.near(p.x, p.z, 80); return d.length ? [d[0].x, d[0].z + (d[0].z > 0 ? -0.4 : 0.4)] : null; };
  window.__open = () => document.querySelector('#hud .panel:not([hidden])');
  window.__birdNear = (x, z) => { const S = g.flock._state; let best = -1, bd = 1e9; for (let i = 0; i < S.n; i++) { const d = Math.hypot(S.px[i] - x, S.pz[i] - z); if (d < bd) { bd = d; best = i; } } return best >= 0 && bd < 6 ? [S.px[best], S.pz[best]] : null; };
  window.__onSec = () => { const C = g.config, t = g.env.ventTimer || { fans: 1, cycleSec: 300 }; const need = C.minVentM3hPer1000(g.farm.flock.meanWeightG) * g.farm.flock.alive / 1000; return Math.min(t.cycleSec, Math.ceil((need / (C.EQUIP.fanM3h * t.fans)) * t.cycleSec)); };
  window.__shownOn = () => { const r = [...document.querySelectorAll('#hud .panel:not([hidden]) .ctrl-row')].find((x) => x.textContent.includes('On-seconds')); return r ? parseInt(r.querySelector('output, .ctrl-out, .lcd-v')?.textContent ?? r.textContent.replace(/[^0-9]/g, ' ').trim().split(' ').pop(), 10) : NaN; };
  window.__jobsOf = (d) => g.jobs().filter((j) => j.key.endsWith('@' + d)).map((j) => j.key.replace('@' + d, '') + ':' + j.status).join(' ');
  window.__missed = (d) => g.jobs().filter((j) => j.key.endsWith('@' + d) && j.status !== 'done').map((j) => j.key + ':' + j.status).join(' ');
  return 'helpers set';
})()`);

/** The play-through's parts in order (name -> () => steps). */
export const SEGMENTS = {};

// ---------------- routes (the farm's paths, config SPOTS / SPOTS2 / SPOTS3) ----------------
const DOOR_IN = [W(-14, 7.6, 0.5), W(-14, 6.9, 0.3), W(-14, 4.6, 0.5)];
export const gateToHouse = () => [W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN];
export const gateToOffice = () => [W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-34.1, 28.0, 0.4)];
export const officeToHouse = () => [W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN];
export const houseOut = () => [W(-14, 4.6, 0.5), W(-14, 8.2, 0.5)];
export const outToOffice = () => [W(-14, 12, 0.6), W(-38, 14, 0.6, 40), W(-38, 26, 0.6), W(-34.1, 28.0, 0.4)];
export const outToHouse = () => [W(-14, 8.2, 0.5), ...DOOR_IN];
export const toSilo = () => [W(-27, 8, 0.6), W(-27, -8.5, 0.6), W(-18.25, -7.0, 0.4)];
export const siloToBin = () => [W(-27, -8.5, 0.6), W(-27, 8, 0.6), W(-10.4, 9.3, 0.4)];
export const toBin = () => [W(-10.4, 9.3, 0.4)];
/** A bird that died while he was on the round: back in, pick it up, to the bin (every step skips when none lies there). */
const ifDead = (x, z, tol = 0.5) => ({ walkToExpr: `__game.farm.flock.deadOnFloor > 0 || __game.props.carrying === 'bucket' ? [${x}, ${z}] : null`, tol, max: 60, label: 'only while a dead bird lies on the floor' });
export const deadSweep = () => [ifDead(-14, 8.2), ifDead(-14, 7.6), ifDead(-14, 6.9, 0.3), ifDead(-14, 4.6),
  ...deadPick(4), ifDead(-14, 4.6), ifDead(-14, 8.2), ifDead(-10.4, 9.3, 0.4), ...binCount()];

// ---------------- the daily jobs (PHASE2.md daily jobs table, PHASE3.md §3.3) ----------------
/** Read the controller: open it and keep it open 2 s (controller.read). */
export const controllerRead = () => [W(-12, -4.6, 0.3), ...E('controller', 'E opens the controller'), adv(2.4)];
/** The minimum ventilation timer to the vent sign's figure for the flock's weight (controller open). */
export const minVent = () => [click('Ventilation'), adv(0.1),
  clickUntil('One second more', '__shownOn() >= __onSec()', 120), clickUntil('One second less', '__shownOn() <= __onSec()', 120),
  click('Set the timer'), adv(0.2), ev(`'timer ' + JSON.stringify(__game.env.ventTimer) + ' for the sign figure ' + __onSec() + ' s'`)];
/** Four flow tests, one at each drinker line's regulator; optionally the winch to the sign's height. */
export function drinkers({ raise = false, flow = true } = {}) {
  const out = [];
  DRINKER_LINES_Z.forEach((z, i) => {
    out.push(W(-21.3, z + (i === 0 ? 0.0 : 0), 0.4), ...E(`drinker-${i}`, `E opens drinker line ${i + 1}`));
    if (raise) out.push(clickUntil('Winch: one step up', `__game.farm.water.lines[${i}].heightCm >= __game.config.nippleHeightCmAt(__game.farm.age)`, 40));
    if (flow) out.push(click('Flow test'), adv(2.6));
    out.push(...esc());
  });
  return out;
}
export const waterMeter = () => [W(-23.0, 5.45, 0.3), ...E('water-supply', 'E opens the water supply'), click('Lines'), click('Read the meter'), adv(0.2), ...esc()];
export function feederBox({ raise = false } = {}) {
  const out = [W(-18, -4.9, 0.35), ...E('feeder-box', 'E opens the feeder box'), click('Read the feed meter'), adv(0.2)];
  if (raise) for (let i = 0; i < 3; i++) out.push(clickUntil(`Line ${i + 1} pan height: one step up`, `__game.farm.feed.lines[${i}].heightCm >= __game.config.feederRimCmAt(__game.farm.age)`, 40));
  out.push(...esc());
  return out;
}
export const silo = () => [...E('silo', 'E opens the silo panel'), click('Read the gauges'), adv(0.2), ...esc()];
/** Walk to each dead bird on the floor (up to n) and pick it up with E; the bucket fills. */
export function deadPick(n = 4) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ walkToExpr: '__deadNear()', tol: 0.7, max: 40, label: `dead bird ${i + 1}` }, { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'dead-bird'` }, adv(0.2));
  return out;
}
/** At the bin with the bucket: E counts them (the dead-bin panel once dead birds by look is unlocked). */
export const binCount = () => [{ pressIf: 'e', if: `__game.props.carrying === 'bucket'` }, adv(0.25),
  ev(`__game.ui.openPanelId === 'dead-bin' ? ([...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((b) => b.textContent.startsWith('Count them'))?.click(), 'counted at the bin panel') : 'counted at the bin: ' + __game.farm.flock.countedDead + ', on the floor ' + __game.farm.flock.deadOnFloor + ' at ' + __t()`), adv(0.2), { pressIf: 'Escape', if: '!!__game.ui.openPanelId' }];
/** Walk the floor the birds use (lanes 2 m from the lines, sight 2 m) and stand still to listen. */
export function walkFloor({ whole, pm = false }) {
  const lanes = whole ? (pm ? [W(-22, 0, 0.5), W(14, 0, 0.6, 60)] : [W(-22, -2.6, 0.5), W(22, -2.6, 0.6, 60)])
    : (pm ? [W(-22, 0, 0.5), W(1, 0, 0.6, 40)] : [W(-22, -2.6, 0.5), W(1, -2.6, 0.6, 40), W(1, 2.6, 0.5), W(-22, 2.6, 0.6, 40)]);
  return [...lanes, adv(2.8)];
}
/** Walk the birds up to drink (the vaccine plate): four lanes the length of the house. */
export const walkBirds = () => [W(-22, -4.4, 0.6), W(22, -4.4, 0.7, 60), W(22, -1.4, 0.6), W(-22, -1.4, 0.7, 60), W(-22, 1.4, 0.6), W(22, 1.4, 0.7, 60), W(22, 4.4, 0.6), W(-22, 4.4, 0.7, 60)];
/** Light meter (L) at bird level in three parts of the floor. */
export const lux3 = () => [W(-18, -2, 0.5), press('l'), adv(0.3), W(-18, 2, 0.5), press('l'), adv(0.3), W(-6, -2, 0.5), press('l'), adv(0.3)];
/** Squeeze a handful of litter (Q) in two parts of the floor, one by a drinker line. */
export const squeeze3 = () => [W(-20, -1.95, 0.5), press('q'), adv(0.3), W(-8, 1.95, 0.5), press('q'), adv(0.3), W(-4, 0.8, 0.5), press('q'), adv(0.3)];
/** At the office desk: sign today's record (the records book opens on Today). */
export const signRecord = () => [...E('office-desk', 'E opens the office desk'),
  // an open "Report the deaths to the company vet" job: the phone first (the Phone tab of the records book)
  ev(`(() => { const j = __game.jobs().find((x) => x.key.startsWith('p-report@') && x.status === 'open'); if (!j) return 'no report to phone'; const tab = [...document.querySelectorAll('#hud .panel:not([hidden]) [role=tab], #hud .panel:not([hidden]) button')].find((b) => b.textContent.trim() === 'Phone'); tab?.click(); const b = [...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((x) => x.textContent.includes('Report the deaths')); b?.click(); return 'phoned the vet: ' + (b ? 'reported' : 'no button'); })()`), adv(0.2),
  click('Today'), click('Sign today'), adv(0.6)];
/** Fan panel at the east end, open 2 s (fans.read). */
export const fanPanel = (extra = []) => [W(22.4, -4.6, 0.35), ...E('fan-panel', 'E opens the fan panel'), adv(2.4), ...extra, ...esc()];

// ---------------- Level 1: the planning day by walking (PHASE3.md §1, §4.1) ----------------
const typeIn = (name, text) => [{ clickOn: `#hud .panel:not([hidden]) input[name=${name}]` }, ...[...text].map((c) => press(c))];
export function planningDay() {
  return [
    ev(`__game.level.toTitle(), 'title: ' + __game.level.mode`), adv(0.3), shot('p3c-00-title'),
    click('Start a new flock'), adv(0.4),
    exp(`__game.level.def.id === 'plan' && __game.env.dayNumber === -2 && Math.hypot(__game.player.position.x + 40, __game.player.position.z - 40.5) < 1.5 && 'planning day ' + __t() + ' at the gate'`, 'Start a new flock: the planning day 07:00 at the gate'),
    ev(`__timer('planning day')`),
    W(-40, 36.9, 0.3), job('pl-gate-dip@-2', 'the gate foot dip, walked'),
    W(-36.0, 35.0, 0.4), ...E('sign-gate', 'E reads the farm rules at the gate'), adv(0.3), shot('p3c-01-gate-sign'), ...esc(), job('pl-gate-read@-2'),
    W(-44.6, 33.6, 0.4), press('e'), adv(1.5), job('pl-clothes@-2', 'farm clothes and boots at the guard hut (E)'),
    W(-38, 26, 0.6), W(-30.8, 26.8, 0.4), ...E('sign-plan', 'E reads the production planning sign'), adv(0.3), shot('p3c-02-plan-sign'), ...esc(),
    W(-34.1, 28.0, 0.4), ...E('office-desk', 'E opens the records book at the office desk'),
    click('Letters'), adv(0.1), click('The company’s contract'), adv(0.2), shot('p3c-03-contract'), job('pl-letter@-2', 'the contract read in the Letters tab'),
    click('Plan'), adv(0.1), click('Open the planning sheet'), adv(0.25),
    exp(`__game.ui.openPanelId === 'plan-sheet' && 'the planning sheet is open'`, 'Plan tab: Open the planning sheet'),
    click('Take the tape measure'), adv(0.2), exp(`__game.props.carrying === 'tape' && 'carrying the tape'`, 'the tape measure in hand'),
    ...officeToHouse(), job('pl-house-dip@-2', 'boots dipped at the house door'),
    W(-23.3, 0.6, 0.35), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    exp(`__game.props.debug.tools.st.tape && 'tape hooked on the ' + __game.props.debug.tools.st.tape.name`, 'tape hooked at the west end wall'),
    W(23.3, 0.6, 0.35, 80), shot('p3c-04-tape'), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    W(0.6, -5.3, 0.35), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    W(0.6, 5.3, 0.35), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    exp(`(() => { const m = __game.farm.plan?.measured || {}; return Math.abs(m.length - 48) < 0.2 && Math.abs(m.width - 12) < 0.2 && 'measured ' + m.length + ' x ' + m.width + ' m'; })()`, 'house 1 measured by walking: 48.0 x 12.0 m'),
    job('pl-measure@-2'),
    ...houseOut(), ...outToOffice(), ...E('office-desk', 'back at the office desk'), click('Plan'), adv(0.1), click('Open the planning sheet'), adv(0.25),
    click('Put the tape back'), adv(0.1), exp(`!__game.props.carrying && 'tape put back'`, 'the tape back at the office'),
    ...typeIn('chicksPerWeek', '3750'), ...typeIn('houses', '6'), ...typeIn('birdsPerHouse', '6000'), ...typeIn('cycleDays', '67'), ...typeIn('lossesPct', '4'), ...typeIn('saleKg', '2.8'),
    adv(0.3), shot('p3c-05-sheet'), click('Send the plan'), adv(0.3),
    exp(`(() => { const p = __game.farm.plan; return p && p.sentAt != null && p.outcome?.pass && Math.round(p.sums.salePerWeek) === 3611 && 'sent at ' + __t() + ': ' + Math.round(p.sums.salePerWeek) + ' birds a week, ' + p.sums.densityKgM2.toFixed(1) + ' kg/m2'; })()`, 'Send the plan before 16:00: 3,611 a week, 28.0 kg/m2'),
    ...esc(), ev(`__timerEnd('planning day')`),
    ...next(), ev(`'Next job -> ' + __t()`),
    ...E('office-desk', 'the reply on the desk'), click('Letters'), adv(0.1), click('The company’s reply'), adv(0.2), shot('p3c-06-reply'), job('pl-reply@-2', 'the company’s reply read'),
    ...esc(), ...next(), ev(`'Next job -> ' + __t()`),
    ...signRecord(),
    exp(`(() => { const r = __game.level.result; return __game.level.mode === 'result' && r?.levelId === 'plan' && r.pass && 'plan passed at ' + __t(); })()`, 'signing the plan page ends Level 1: passed'),
    exp(`__missed(-2) === '' && 'every job of the planning day done'`, 'every planning-day job done'), ev(`'not done: ' + (__missed(-2) || 'none')`),
    shot('p3c-07-plan-result'),
  ];
}

/** The level's result screen -> its Continue button. */
export const continueOn = (text, levelId, day) => [
  exp(`[...document.querySelectorAll('.result-btns .btn')][0]?.textContent.trim() === '${text}' && 'result: ${text}'`, `result screen: ${text}`),
  click(text), adv(0.4),
  exp(`__game.level.mode === 'level' && __game.level.def.id === '${levelId}' && __game.env.dayNumber === ${day} && '${levelId} at ' + __t()`, `${text}: ${levelId} from day ${day}`),
];
/** goto(day, hour, auto): the ideal farmer between the real-input days. */
export const autoTo = (day, hour) => [ev(`(__game.level.debug.goto(${day}, ${hour}, { auto: true }), 'goto(${day}, ${hour}, auto) -> ' + __game.level.mode + ' ' + __t())`), adv(0.4)];
/** A level ended by goto auto: its result passed. */
export const passed = (id, extra = '') => exp(`(() => { const r = __game.level.result; return __game.level.mode === 'result' && r?.levelId === '${id}' && r.pass && '${id} passed: ' + JSON.stringify({ w: r.weightG, d: r.deathsPct != null ? +r.deathsPct.toFixed(2) : null${extra} }); })()`, `${id} passed`);

// ---------------- the routine rounds of a flock day (PHASE2.md daily jobs, PHASE3.md §3.3) ----------------
export const rowOut = `window.__rowOut = (label) => { const r = [...document.querySelectorAll('#hud .panel:not([hidden]) .ctrl-row')].find((x) => x.querySelector('.ctrl-label')?.textContent.startsWith(label)); return r?.querySelector('output')?.textContent ?? ''; }`;
/** The morning round from the gate: dips, controller (+ extra controller work), walk, dead birds, drinkers, meter, feeders, silo, bin. */
export function morning({ day, whole, controller = [], inside = [], raise = false }) {
  return [
    ...gateToHouse(), ...controllerRead(), ...controller, ...esc(),
    ...walkFloor({ whole }),
    ...drinkers({ raise }), ...waterMeter(), ...feederBox({ raise }), ...inside, ...deadPick(6),
    ...houseOut(), ...toBin(), ...binCount(), ...deadSweep(), ...toSilo(), ...silo(), ...deadSweep(),
    exp(`(() => { const left = __game.jobs().filter((j) => j.key.endsWith('@${day}') && j.status === 'open'); return 'open after the morning round at ' + __t() + ': ' + (left.map((j) => j.key).join(' ') || 'none'); })()`, `day ${day}: the morning round`),
  ];
}
/** The afternoon round (13:00): dips, walk, controller, squeezes, dead birds, the extra jobs, bin. */
export function afternoon({ day, whole, controller = [], inside = [], raise = false }) {
  return [
    ...outToHouse(), ...walkFloor({ whole, pm: true }), ...controllerRead(), ...controller, ...esc(),
    ...squeeze3(), ...inside, ...(raise ? [...drinkers({ raise: true, flow: false }), ...feederBox({ raise: true })] : []), ...deadPick(6),
    ...houseOut(), ...toBin(), ...binCount(), ...deadSweep(),
  ];
}
/** The evening: the office desk at 16:00 or later, the record signed. */
export const evening = (day) => [...outToOffice(), exp(`'at the office ' + __t() + ': ' + (__missed(${day}) || 'nothing open')`, `day ${day}: at the office`),
  { pressIf: 'Escape', if: 'false' }, { clickOn: '.ljobs-next' }, adv(0.4), until('__game.env.hour >= 16', 300), ...signRecord(), ...esc()];
/** The growing birds' light program on the controller (Lights): the preset with Lighting level 1, else by hand. */
export const growingLights = (key) => [click('Lights'), adv(0.1), click('Growing (from day 8)'), adv(0.1), ev(rowOut),
  clickUntil('One hour earlier', `__game.level.jobs.byKey('${key}')?.status === 'done' || __rowOut('Dark period starts') === '22:00'`, 24),
  clickUntil('Half an hour more', `__game.level.jobs.byKey('${key}')?.status === 'done' || parseFloat(__rowOut('Dark hours')) >= 6`, 24),
  clickUntil('Dimmer down 10 %', `__game.level.jobs.byKey('${key}')?.status === 'done' || parseInt(__rowOut('Dimmer'), 10) <= 40`, 10),
  { pressIf: 'Escape', if: 'false' }, ev(`__game.level.jobs.byKey('${key}')?.status === 'done' ? 'light program set by the preset' : ([...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((b) => b.textContent.startsWith('Set the program'))?.click(), 'light program set by hand: ' + JSON.stringify(__game.env.lightProgram))`), adv(0.2)];

// ---------------- Level 2 → Level 3: Week 2 ----------------
SEGMENTS.week2 = () => [
  ...continueOn('Continue to the brooding week', 'level1', -1),
  ...autoTo(7, 21), passed('level1', ', ratio: r.ratio'), shot('p3c-08-brooding-result'),
  ...continueOn('Continue to Week 2', 'week2', 8),
  ev(`__timer('day 8')`), shot('p3c-09-day8-gate'),
  ...morning({ day: 8, whole: false, controller: [...growingLights('w2-lights@8'), ...minVent()], inside: lux3() }),
  job('w2-lights@8', 'the growing birds’ light program (controller, Lights)'), job('w2-lux@8', 'light measured at bird level with L in three parts'), job('r-minvent@8', 'minimum ventilation stepped up by the sign'),
  ...next(), ev(`'Next job -> ' + __t()`),
  ...afternoon({ day: 8, whole: false, raise: true }),
  job('r-raise@8', 'drinker and feeder lines raised for the birds’ size'),
  ...evening(8), ev(`__timerEnd('day 8')`),
  ev(`'not done on day 8: ' + (__missed(8) || 'none')`), exp(`__missed(8) === '' && 'every job of day 8 done'`, 'day 8 played by real input: every job done'),
  // day 10: the brooding curtain lifts at the winch
  ...autoTo(10, 6.05), ev(`'day 10 morning at ' + __t() + ', curtain ' + (__game.env.broodCurtain ? 'down' : 'up')`),
  ...gateToHouse(), W(2.0, -4.7, 0.35), ...E('curtain-winch', 'E opens the curtain winch'), click('Wind the curtain up'), adv(1.5), shot('p3c-10-winch'), ...esc(),
  exp(`__game.env.broodCurtain === false && 'curtain up at ' + __t()`, 'day 10: the brooding curtain wound up at the winch'),
  W(10, 0, 0.6), adv(30), shot('p3c-11-spread'), ...walkFloor({ whole: true }),
  exp(`__game.flock.debug.meanX() > -4 && 'the flock spreads: mean x ' + __game.flock.debug.meanX().toFixed(1)`, 'the birds walk out over the east half'),
  // day 12: vaccination in the drinking water at the water supply
  ...autoTo(12, 6.05), ...gateToHouse(), W(-23.0, 5.45, 0.3), ...E('water-supply', 'E opens the water supply'), click('Vaccine'), adv(0.1), click('Main valve'), adv(0.2), ...esc(),
  exp(`__game.farm.health.mainClosed === true && 'main valve shut at ' + __t()`, 'day 12: the main valve shut (the birds go thirsty)'),
  ...walkFloor({ whole: true }), until('(__game.env.day - __game.farm.health.vaccine.thirstFrom) * 24 >= 1.5', 120),
  W(-23.0, 5.45, 0.3), ...E('water-supply', 'back at the water supply'), click('Vaccine'), adv(0.1), click('Skim milk powder stabiliser'), click('Mix the vaccine'), adv(0.2), click('Main valve'), adv(0.2), shot('p3c-12-vaccine'), ...esc(),
  ...walkBirds(),
  until(`__game.farm.health.vaccine.state === 'drunk'`, 150),
  exp(`(() => { const v = __game.farm.health.vaccine; return v.state === 'drunk' && 'vaccine drunk in ' + v.hours.toFixed(1) + ' h, coverage ' + v.coverage.toFixed(2); })()`, 'the vaccine drunk (the record shows the hours)'),
  job('w2-vaccine@12', 'vaccinated in the drinking water by real clicks'),
  ...autoTo(14, 21), passed('week2'), shot('p3c-13-week2-result'),
];

// ---------------- birds in the hand (the bird check, day 8 on) ----------------
const CHECK_AT = [[-18, -2], [-6, 2.2], [6, -2], [18, 2.2], [-12, 2.2], [12, -2]];
/** Pick up n birds from parts of the house (E: the chick provider while a bird check is open) and do one look each. */
export function birdChecks(n, btn, key) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = CHECK_AT[i % CHECK_AT.length];
    const near = `__birdNear(${x + (i % 3) * 0.6}, ${z})`, chick = `__game.interact.nearest(__game.player)?.id === 'chick'`;
    out.push(W(x + (i % 3) * 0.6, z, 0.6),
      { walkToExpr: near, tol: 0.5, max: 10, label: 'the nearest bird' }, { pressIf: 'e', if: chick }, adv(0.25),
      { walkToExpr: `__game.ui.openPanelId ? null : ${near}`, tol: 0.4, max: 10, label: 'the nearest bird again' }, { pressIf: 'e', if: `!__game.ui.openPanelId && ${chick}` }, adv(0.25),
      exp(`__game.ui.openPanelId === 'bird-check' && 'bird ${i + 1} in the hand at ' + __t()`, `bird ${i + 1} in the hand: the bird check`),
      click(btn), adv(0.2), ...(i === 0 ? [shot(`p3c-check-${key}`)] : []), click('Put back'), adv(0.25));
  }
  return out;
}
const fansAll = (pad) => [click('All six'), adv(0.2), ...(pad ? [{ pressIf: 'Escape', if: 'false' }, ev(`__game.env.padOn ? 'pad already on' : ([...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((b) => /Pad pump (off|on)/.test(b.textContent))?.click(), 'pad pump ' + (__game.env.padOn ? 'on' : 'off'))`)] : [])];
const fansNight = (n) => [click('All off'), adv(0.2), ...(n > 0 ? [click(`Fan ${n} switch`)] : []), adv(0.2), ev(`'fans for the night: ' + __game.env.fansManual`)];
/** The fan panel at the east end (fans.read after 2 s), with what to switch. */
const atFans = (extra, label) => [W(22.4, -4.6, 0.35), ...E('fan-panel', label || 'E opens the fan panel'), adv(2.4), ...extra, ...esc()];

// ---------------- Level 4: Week 3 — day 16 by real input ----------------
SEGMENTS.week3 = () => [
  ...continueOn('Continue to Week 3', 'week3', 15),
  ...autoTo(16, 6.05), ev(`__timer('day 16')`),
  ...morning({ day: 16, whole: true, controller: minVent() }),
  ...outToHouse(), until('__game.env.hour >= 8', 60), ...birdChecks(10, 'Look at the vent and droppings', 'droppings'), ...houseOut(),
  job('w3-droppings@16', 'droppings checked on ten birds from three parts of the house'),
  ...next(), ev(`'Next job -> ' + __t()`),
  // 16-day-old birds: six fans, no pad (the heat sign: young birds as few tunnel fans as the heat allows; with the pad too they chill)
  ...outToHouse(), ...atFans([shot('p3c-14-fans-day16'), ...fansAll(false)], 'day 16 afternoon: the fan panel'), job('r-fans-pm@16', 'the fans and the house read in the afternoon heat'),
  ...afternoon({ day: 16, whole: true }).slice(DOOR_IN.length + 1),
  exp(`'panting share ' + __game.farm.comfort.pantShare.toFixed(2) + ' at ' + __t() + ', fans ' + __game.env.fansOn + ', pad ' + __game.env.padOn`, 'six fans in the warm afternoon'),
  job('p-heat3@16', 'Birds panting in the afternoon: handled at the fan panel'),
  ...evening(16),
  ...next(), ev(`'Next job -> ' + __t()`), ...officeToHouse(), until('__game.env.hour >= 18', 60), ...atFans(fansNight(1), 'the evening: ventilation for the night'), job('r-vent-night@16'),
  ev(`__timerEnd('day 16')`), ev(`'not done on day 16: ' + (__missed(16) || 'none')`), exp(`__missed(16) === '' && 'every job of day 16 done'`, 'day 16 played by real input: every job done'),
  ...autoTo(21, 21), passed('week3'), shot('p3c-15-week3-result'),
];

// ---------------- Level 5: Weeks 4 and 5 — day 25 by real input, the fan found, the heat wave ----------------
SEGMENTS.weeks45 = () => [
  ...continueOn('Continue to Weeks 4 and 5', 'weeks45', 22),
  ...autoTo(25, 6.05), ev(`__timer('day 25')`),
  ...morning({ day: 25, whole: true, inside: atFans(fansAll(false), 'day 25 morning: six tunnel fans for the hot day') }),
  ...next(), ev(`'Next job -> ' + __t()`),
  ...outToHouse(), ...atFans([shot('p3c-16-fans-day25'), ...fansAll(true)], 'day 25 hot afternoon: six fans and the pad'),
  ...afternoon({ day: 25, whole: true }).slice(DOOR_IN.length + 1),
  ...evening(25), ...next(), ev(`'Next job -> ' + __t()`), ...officeToHouse(), until('__game.env.hour >= 18', 60), ...atFans(fansNight(3), 'the evening: tunnel fans for the night'),
  ev(`__timerEnd('day 25')`), ev(`'not done on day 25: ' + (__missed(25) || 'none')`), exp(`__missed(25) === '' && 'every job of day 25 done'`, 'day 25 played by real input: every job done'),
  // day 27: a fan stops; found by walking past the east end
  ...autoTo(27, 9.6), ev(`'fans broken ' + JSON.stringify(__game.env.fansBroken) + ' at ' + __t()`), ...gateToHouse(), W(21.8, 2.85, 0.4, 80), adv(3), shot('p3c-17-fan-stopped'),
  exp(`(() => { const p = __game.farm.problems.find((q) => q.id === 'fan-belt'); return p && p.phase !== 'pending' && 'fan belt problem ' + p.phase + ' at ' + __t(); })()`, 'day 27: the stopped fan found by walking past it'),
  W(22.75, 2.85, 0.3), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'fan-3'` }, adv(0.5),
  exp(`__game.env.fansBroken.length === 0 && 'belt fitted: no fan stopped'`, 'E at fan 4 fits a new belt (fan.fix)'),
  // the heat wave (days 30-32): the fan panel at 11:00
  ...autoTo(30, 10.9), ...gateToHouse(), ...atFans([...fansAll(true), shot('p3c-18-heatwave-fans')], 'the heat wave: the fan panel'),
  W(4, 0, 0.6), adv(20), shot('p3c-19-heatwave-house'),
  exp(`'heat wave ' + __t() + ': outside ' + __game.env.outsideTemp.toFixed(1) + ', house ' + __game.env.houseTemp.toFixed(1) + ' °C, ' + __game.env.houseRH.toFixed(0) + ' %, panting ' + __game.farm.comfort.pantShare.toFixed(2)`, 'heat wave: the house with six fans and the pad'),
  ...autoTo(35, 21), passed('weeks45'), shot('p3c-20-weeks45-result'),
];

// ---------------- Level 6: Finishing and harvest — day 37 by real input, the catching night ----------------
SEGMENTS.finish = () => [
  ...continueOn('Continue to Finishing and harvest', 'finish', 36),
  ...autoTo(37, 6.05), ev(`__timer('day 37')`),
  ...morning({ day: 37, whole: true, inside: atFans(fansAll(false), 'day 37 morning: six tunnel fans for the big birds') }),
  ...outToOffice(), ...E('office-desk', 'the phone at the office desk'), click('Phone'), adv(0.1), click('Book the crew and the trucks'), adv(0.2), shot('p3c-21-phone'), ...esc(),
  job('f-book@37', 'the catching crew and trucks booked on the phone'),
  ...next(), ev(`'Next job -> ' + __t()`),
  ...[W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6)], ...outToHouse(), ...atFans(fansAll(true), 'day 37 afternoon: the fan panel'),
  ...afternoon({ day: 37, whole: true }).slice(DOOR_IN.length + 1),
  ...evening(37), ...next(), ev(`'Next job -> ' + __t()`), ...officeToHouse(), until('__game.env.hour >= 18', 60), ...atFans(fansNight(3), 'the evening: tunnel fans for the night'),
  ev(`__timerEnd('day 37')`), ev(`'not done on day 37: ' + (__missed(37) || 'none')`), exp(`__missed(37) === '' && 'every job of day 37 done'`, 'day 37 played by real input: every job done'),
  // the catching night (day 42 from 02:00): watched from the house, the tickets read at the loading bay
  ...autoTo(41, 20), ...autoTo(42, 1.95), ev(`'catch at ' + __game.farm.harvest.catchAt + ', now ' + __t() + ', farmer at ' + __game.player.position.x.toFixed(1) + ',' + __game.player.position.z.toFixed(1)`),
  W(-14, 12, 0.8), W(-14, 8.2, 0.5), ...DOOR_IN, W(-8, 3, 0.6), until('__game.farm.harvest.started', 60), adv(20), shot('p3c-22-catch-house'),
  ...houseOut(), W(-12, 11.0, 0.5), adv(10), shot('p3c-23-catch-yard'),
  until('!!__game.farm.harvest.result', 240, 1),
  ...E('loading-bay', 'E opens the loading bay'), click('Read the ticket of truck 1'), click('Read the ticket of truck 2'), adv(0.3), shot('p3c-24-tickets'), ...esc(),
  exp(`(() => { const r = __game.farm.harvest.result; return r && 'harvest: ' + JSON.stringify({ liveG: r.liveG ?? r.meanLiveG, birds: r.birds, doa: r.doa }); })()`, 'the catch done, the tickets read'),
  ...outToHouse(), W(0, 0, 0.6), adv(2), shot('p3c-25-empty-house'),
  ...autoTo(42, 21), passed('finish', ', live: r.liveG, fcr: r.fcr'), shot('p3c-26-harvest-result'),
];

// ---------------- Level 7: Clean-out and rest — day 44 by real input, the cycle summary ----------------
const washPass = (z) => [W(-23, z, 0.6, 60), W(23, z, 0.6, 90)];
SEGMENTS.cleanout = () => [
  ...continueOn('Continue to Clean-out and rest', 'cleanout', 43),
  ...autoTo(44, 6.05), ev(`__timer('day 44')`),
  ...gateToOffice().slice(0, 2), W(-27.0, 11.6, 0.4), ...E('wash-bay', 'E opens the wash bay'), click('Take the washer'), adv(0.2),
  exp(`__game.props.carrying === 'washer' && 'the washer in hand'`, 'the pressure washer taken at the wash bay'),
  W(-14, 8.2, 0.5), ...DOOR_IN, ...washPass(-3.6), ...washPass(0), ...washPass(3.6), shot('p3c-27-washed'),
  exp(`'washed ' + (__game.farm.clean.washShare * 100).toFixed(0) + ' % of the floor at ' + __t()`, 'three washer passes along the house'),
  ...houseOut(), W(-27.0, 11.6, 0.4), ...E('wash-bay', 'back at the wash bay'), click('Put the washer back'), adv(0.2), ...esc(),
  job('c-wash@44', 'the house washed with the pressure washer'),
  ...outToHouse(), W(-23.0, 5.45, 0.3), ...E('water-supply', 'E opens the water supply'), click('Clean-out'), adv(0.1), click('No disinfectant'), adv(0.1),
  click('Valve shut'), click('Valve shut'), click('Valve shut'), click('Valve shut'),
  ev(`document.querySelectorAll('#hud .panel:not([hidden]) .plate.is-open .plate-head').forEach((b) => b.click()), 'plate folded: the clock runs'`),
  until('__game.farm.clean.lines.every((v) => v >= 1)', 120), click('Valve open'), click('Valve open'), click('Valve open'), click('Valve open'), shot('p3c-28-lines'), ...esc(),
  job('c-lines@44', 'the drinker lines flushed with disinfectant'),
  W(-18, -4.9, 0.35), ...E('feeder-box', 'E opens the feeder box'),
  ...[0, 1, 2].flatMap((i) => [click(`Wash the pans of line ${i + 1}`), until(`__game.farm.clean.pans[${i}]`, 60, 0.5)]), ...esc(),
  job('c-pans@44', 'the feeder pans washed'),
  { advanceUntil: '__game.env.hour >= 13', max: 200 }, ...atFans([click('All six')], 'day 44: the fans to dry the house'),
  ...houseOut(), ...evening(44), ev(`__timerEnd('day 44')`),
  exp(`(() => { const m = __game.jobs().filter((j) => j.key.endsWith('@44') && j.status !== 'done' && j.key !== 'c-dry@44'); return m.length === 0 ? 'day 44 jobs done (the drying runs on)' : 'not done: ' + m.map((j) => j.key + ':' + j.status).join(' '); })()`, 'day 44 played by real input'),
  ...autoTo(67, 7), ev(`'after the rest: ' + __game.level.mode + ' ' + __t()`), adv(0.5),
  passed('cleanout', ', rest: r.restDays, positive: r.positive'), shot('p3c-29-cleanout-result'),
  exp(`(() => { const s = __game.run.state(); const lv = s.levels; const ids = ['plan', 'level1', 'week2', 'week3', 'weeks45', 'finish', 'cleanout']; return ids.every((id) => lv[id]?.state === 'passed') && s.summary && 'every level passed; the cycle summary: ' + JSON.stringify(s.summary).slice(0, 300); })()`, 'the cycle summary: every level passed'),
  ev(`(() => { const b = [...document.querySelectorAll('#hud .panel:not([hidden]) button, .result-btns .btn')].find((x) => /summary/i.test(x.textContent)); if (b) b.click(); return b ? 'opened: ' + b.textContent.trim() : 'no summary button'; })()`), adv(0.4), shot('p3c-30-cycle-summary'),
  ev(`Object.values(window.__timed).map((t) => t.text).join(' | ')`),
];

// ---------------- p3-replay.json: a poor vaccine and coccidiosis left fail week 3; Replay Week 2 ----------------
/** Vaccinate at the water supply: by the vaccine plate (main shut 1.5 h, stabiliser, open, walk) or poorly (no thirst, no stabiliser). */
export function vaccinate({ good }) {
  const out = [...gateToHouse(), W(-23.0, 5.45, 0.3), ...E('water-supply', 'E opens the water supply'), click('Vaccine'), adv(0.1)];
  if (good) out.push(click('Main valve'), adv(0.2), ...esc(), ...walkFloor({ whole: true }), until('(__game.env.day - __game.farm.health.vaccine.thirstFrom) * 24 >= 1.5', 120),
    W(-23.0, 5.45, 0.3), ...E('water-supply', 'back at the water supply'), click('Vaccine'), adv(0.1), click('Skim milk powder stabiliser'), click('Mix the vaccine'), adv(0.2), click('Main valve'), adv(0.2));
  else out.push(click('Mix the vaccine'), adv(0.2));
  out.push(shot(good ? 'p3r-vaccine-plate' : 'p3r-vaccine-poor'), ...esc(), ...(good ? walkBirds() : walkFloor({ whole: true })), until(`__game.farm.health.vaccine.state === 'drunk'`, 200),
    exp(`(() => { const v = __game.farm.health.vaccine; return v.state === 'drunk' && 'vaccine drunk in ' + v.hours.toFixed(1) + ' h, coverage ' + v.coverage.toFixed(2) + ', stabiliser ' + v.stabiliser; })()`, good ? 'the vaccine by the plate: drunk' : 'the poor vaccination: drunk slowly'));
  return out;
}
export function replay() {
  return [
    ev(`(__game.level.toTitle(), __game.startRun({ seed: 1 }), __game.run.startLevel('week2', { from: 'standard' }), 'week 2 standard start ' + __t())`), adv(0.5),
    exp(`__game.level.def.id === 'week2' && __game.env.dayNumber === 8 && 'week 2 at ' + __t()`, 'week 2 from its standard start (day 8 06:00)'),
    ...autoTo(12, 6.05), ...vaccinate({ good: false }),
    ...autoTo(14, 21), passed('week2'), ...continueOn('Continue to Week 3', 'week3', 15),
    ev(`(__game.level.debug.goto(21, 21, { auto: true, profile: 'cocciUntreated' }), 'week 3 with the coccidiosis left untreated -> ' + __game.level.mode + ' ' + __t())`), adv(0.6),
    exp(`(() => { const r = __game.level.result; return __game.level.mode === 'result' && r?.levelId === 'week3' && !r.pass && 'week 3 not passed: ' + r.failText; })()`, 'week 3 fails: deaths over the limit'),
    exp(`(() => { const t = document.querySelector('.result-carried')?.textContent || ''; const b = [...document.querySelectorAll('.result-btns .btn')].map((x) => x.textContent.trim()); return b.includes('Replay Week 2') && /vaccine drunk in \d+(\.\d)? h on day 12/.test(t) && 'buttons ' + b.join(' | ') + ' · ' + t; })()`, 'the fail screen offers Replay Week 2 with "vaccine drunk in … h on day 12"'),
    shot('p3r-week3-fail'),
    click('Replay Week 2'), adv(0.5),
    exp(`__game.level.mode === 'level' && __game.level.def.id === 'week2' && __game.env.dayNumber === 8 && Math.abs(__game.env.hour - 6) < 0.05 && 'week 2 again at ' + __t()`, 'Replay Week 2: day 8 06:00'),
    ...autoTo(12, 6.05), ...vaccinate({ good: true }),
    ...autoTo(14, 21), passed('week2'), ...continueOn('Continue to Week 3', 'week3', 15),
    ...autoTo(21, 21), passed('week3'), shot('p3r-week3-pass'),
  ];
}

// ---------------- writing the files ----------------
const START = [{ wait: 600 }, { clearStorage: true }, SETUP];
function write(path, steps) { writeFileSync(path, `[\n${steps.map((s) => `  ${JSON.stringify(s)}`).join(',\n')}\n]\n`); console.log(`${path}: ${steps.length} steps`); }
if (process.argv[1] && process.argv[1].endsWith('p3-cycle-steps.mjs')) {
  const dev = process.argv.indexOf('--dev');
  if (dev >= 0) {
    const name = process.argv[dev + 1], out = process.argv[dev + 2];
    // a comma list of segments; 'start:<level>' = a standard start of that level in a new run (a quick way in)
    // (a segment right after a standard start skips its first three steps: the Continue button of the level before)
    const names = name.split(',');
    const seg = names.flatMap((n, k) => n === 'plan' ? planningDay() : n === 'replay' ? replay() : n.startsWith('start:') ? [ev(`(__game.startRun({ seed: 1 }), __game.run.startLevel('${n.slice(6)}', { from: 'standard' }), 'standard start ' + __t())`), adv(0.5)]
      : (() => { if (!SEGMENTS[n]) throw new Error(`no segment ${n}`); const st = SEGMENTS[n](); return k > 0 && names[k - 1].startsWith('start:') ? st.slice(3) : st; })());
    write(out, [...START, ...seg]);
  } else {
    write('scripts/p3-cycle.json', [...START, ...planningDay(), ...Object.values(SEGMENTS).flatMap((f) => f())]);
    write('scripts/p3-replay.json', [...START, ...replay()]);
  }
}
