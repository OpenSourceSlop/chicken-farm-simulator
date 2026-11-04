// Harness proofs of the farmer's four requests during Phase 4 (PHASE4.md §15.5), by real input (walkTo by real clicks
// on the ground, E / Shift+E / G / Escape key presses, clicks on panel buttons), on the helpers of p3-cycle-steps.mjs:
//   node scripts/req-steps.mjs            -> scripts/req-watch.json, req-clock.json, req-bucket.json, req-deadmark.json
//   node scripts/req-steps.mjs --dev <name,...> <file>   one or more of watch, clock, bucket, deadmark
// Setup (the level, the day and hour, a dead bird laid where the test needs it) goes through __game hooks; every
// action the request is about is a real key press or click.
import { W, adv, ev, exp, shot, press, click, clickUntil, until, E, esc, START, write, DOOR_IN, houseOut, toBin } from './p3-cycle-steps.mjs';

const pressKey = (k) => ({ press: k });
/** Fold the open panel's unfolded plate (a real click on its head): the panel clock runs again. */
const FOLD = { clickText: 'Plate', in: '#hud .panel:not([hidden]) .plate.is-open' };
const t = () => `' at ' + __t()`;
/** A level of the brooding week (Phase 2's lone level) on day 0 just after the vent job opens; the farmer at the gate. */
const ventOpen = () => [
  ev(`(__game.startLevel({ seed: 1 }), 'level ' + __game.level.mode + ${t()})`),
  ev(`(__game.level.debug.goto(0, 10.55, { auto: true }), 'after the truck' + ${t()})`),
  ev(`(() => { const j = __game.level.jobs.byKey('d0-vent@0'); __game.level.debug.goto(0, ((j.opensAt % 1) * 24) + 0.04); return 'vent ' + __game.level.jobs.byKey('d0-vent@0').status + ', sampling ' + __game.level.sampling + ${t()}; })()`),
  adv(0.3),
];
/** Lay one dead bird `d` m in front of the farmer (the farm's count follows), return where. */
const layDeadAhead = (d = 0.35) => ev(`(() => { const P = __game.player, y = P.yaw; const at = __game.flock.dead.layAt(P.position.x - Math.sin(y) * ${d}, P.position.z - Math.cos(y) * ${d}); __game.farm.flock.deadOnFloor++; __game.farm.flock.deadTotal++; return 'dead bird laid at ' + at.x.toFixed(2) + ',' + at.z.toFixed(2) + ', farmer at ' + P.position.x.toFixed(2) + ',' + P.position.z.toFixed(2); })()`);
const nearestChickM = `(() => { const S = __game.flock._state, p = __game.player.position; let bd = 1e9; for (let i = 0; i < S.n; i++) { if (S.pen[i] || S.spawnT[i] > 0) continue; const d = Math.hypot(S.px[i] - p.x, S.pz[i] - p.z); if (d < bd) bd = d; } return bd; })()`;
const nearestDeadM = `(() => { const p = __game.player.position, d = __game.flock.dead.near(p.x, p.z, 80); return d.length ? Math.hypot(d[0].x - p.x, d[0].z - p.z) : 1e9; })()`;
const captionHas = (re) => `(document.querySelector('#hud .caption:not([hidden]) .caption-text')?.textContent || '').match(${re})`;

// ---------------- req-bucket.json (request 3) ----------------
export function bucket() {
  return [
    ...ventOpen(),
    exp(`__game.level.chickJob === 'vent' && 'chick job: ' + __game.level.chickJob`, 'the vent job is a chick job'),
    W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN, W(-16.5, -1.4, 0.4),
    layDeadAhead(0.3), adv(0.4),
    until(`${nearestChickM} < 1.1`, 12, 0.25),
    // (d) a dead bird closer than the chick: the registry's nearest is the dead bird, E's target the chick
    exp(`(() => { const dd = ${nearestDeadM}, dc = ${nearestChickM}; const raw = __game.interact.nearest(__game.player)?.id; return dd < dc && raw === 'dead-bird' && __game.ui.promptId === 'chick' && __game.ui.promptAlts.includes('Shift+E') && 'dead bird ' + dd.toFixed(2) + ' m, chick ' + dc.toFixed(2) + ' m; nearest ' + raw + ', E prompt ' + __game.ui.promptId + ', pills ' + __game.ui.promptAlts.join(' + '); })()`, '(d) a dead bird closer than the chick: the E prompt is the chick, Shift+E the dead bird'),
    shot('rq-b-01-prompt'),
    pressKey('e'), adv(0.25),
    exp(`__game.props.carrying === 'chick' && __game.ui.openPanelId === 'chick-in-hand' && __game.farm.flock.deadOnFloor >= 1 && 'E took the chick; the dead bird still on the floor (' + __game.farm.flock.deadOnFloor + ')'`, '(d) E takes the chick, not the dead bird'),
    click('Take vent temperature'), adv(0.25), click('Put back'), adv(0.25), ...esc(),
    exp(`__game.props.carrying === null && 'hands empty'`, 'the chick put back'),
    // Shift+E: the dead bird into the bucket
    pressKey('Shift+E'), adv(0.25),
    exp(`__game.props.carrying === 'bucket' && __game.props.carryOpts.n === 1 && 'Shift+E: the bucket with ' + __game.props.carryOpts.n + ' dead bird'`, '(d) Shift+E picks up the dead bird'),
    exp(`__game.ui.promptAlts.includes('G') && 'pills: ' + __game.ui.promptAlts.join(' + ')`, '(b) the G pill shows while carrying the bucket'),
    // (a) the bucket blocks nothing one hand can do: a board and a machine panel open with it
    W(-16, -4.6, 0.3), ...E('sign-brooder', '(a) carrying the bucket, E reads the brooder sign'), ...esc(),
    exp(`__game.props.carrying === 'bucket' && 'still carrying the bucket'`, '(a) the sign read with the bucket in hand'),
    W(-16.5, -1.4, 0.4), until(`${nearestChickM} < 1.1`, 12, 0.25),
    // (c) carrying the bucket, E on a chick: the bucket goes down at his feet with its caption, the chick in his hand
    pressKey('e'), adv(0.25),
    exp(`(() => { const b = __game.props.bucketDown, p = __game.player.position; const c = ${captionHas('/Bucket set down here/')}; return __game.props.carrying === 'chick' && b && b.n === 1 && Math.hypot(b.x - p.x, b.z - p.z) < 0.7 && c && 'bucket set down ' + Math.hypot(b.x - p.x, b.z - p.z).toFixed(2) + ' m from him with ' + b.n + '; caption "' + c[0] + '"'; })()`, '(c) a vent sample with the bucket: the bucket set down at his feet, the caption, the chick in hand'),
    shot('rq-b-02-auto-down'),
    click('Take vent temperature'), adv(0.25), click('Put back'), adv(0.25), ...esc(),
    exp(`__game.scene.getObjectByName('bucket-mark')?.visible && __game.scene.getObjectByName('props-bucket-down')?.visible && 'the bucket on the floor with its marker'`, '(b) a marker shows where the bucket stands'),
    // in the chick job E does not pick up the bucket; Shift+E does
    W(__bx(), __bz(), 0.5),
    exp(`__game.ui.promptId !== 'bucket' && __game.ui.promptAlts.includes('Shift+E') && 'E prompt ' + __game.ui.promptId + ', pills ' + __game.ui.promptAlts.join(' + ')`, '(d) in the chick job E is not the bucket; Shift+E is'),
    pressKey('Shift+E'), adv(0.25),
    exp(`__game.props.carrying === 'bucket' && !__game.props.bucketDown && __game.props.carryOpts.n === 1 && 'bucket in hand again with ' + __game.props.carryOpts.n`, 'Shift+E picks up the bucket in the chick job'),
    // G sets it down; walk away: its chip; the vent job done; back: E picks it up there
    pressKey('g'), adv(0.25),
    exp(`(() => { const b = __game.props.bucketDown, c = ${captionHas('/Bucket set down here/')}; return !__game.props.carrying && b && b.n === 1 && c && 'G: bucket down at ' + b.x + ',' + b.z + ' "' + c[0] + '"'; })()`, '(b) G sets the bucket down at his feet'),
    W(-10, 0, 0.5), adv(0.3),
    exp(`(() => { const s = __game.ui.deadMarks().bucket; return s && /^Bucket · 1 bird · [0-9]+ m$/.test(s.text) && 'bucket chip: ' + s.text; })()`, '(b) the bucket chip shows it from 6 m'),
    shot('rq-b-03-bucket-chip'),
    ev(`(__game.level.jobs.complete('d0-vent@0'), 'vent job done (setup); chick job now ' + __game.level.chickJob)`),
    W(__bx(), __bz(), 0.5), adv(0.2),
    exp(`__game.ui.promptId === 'bucket' && 'E prompt: the bucket'`, '(b) with no chick job E is the bucket'),
    pressKey('e'), adv(0.25),
    exp(`__game.props.carrying === 'bucket' && __game.props.carryOpts.n === 1 && !__game.props.bucketDown && 'E picked it up there'`, '(b) E picks the bucket up where it was left'),
    W(-14, 4.6, 0.5), ...houseOut(), ...toBin(), pressKey('e'), adv(0.3),
    exp(`__game.farm.flock.countedDead >= 1 && !__game.props.carrying && 'counted at the bin: ' + __game.farm.flock.countedDead`, 'the bin counts the bucket'),
  ].map(fixBucketWalk);
}
// walkTo the bucket where it stands (worked out in the page)
const BUCKET_AT = '__game.props.bucketDown ? [__game.props.bucketDown.x + 0.5, __game.props.bucketDown.z] : null';
const __bx = () => 'BX', __bz = () => 'BZ';
function fixBucketWalk(s) { return s.walkTo && s.walkTo[0] === 'BX' ? { walkToExpr: BUCKET_AT, tol: s.tol, max: 40, label: 'to the bucket' } : s; }

// ---------------- req-deadmark.json (request 4) ----------------
export function deadmark() {
  const chip = `__game.ui.deadMarks()`;
  return [
    ...ventOpen(),
    W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN, W(-12, 0, 0.4),
    // three dead birds: 4 m, 9 m and 22 m east of him
    ev(`(() => { const out = []; for (const dx of [4, 9, 22]) { out.push(__game.flock.dead.layAt(-12 + dx, 1.5)); __game.farm.flock.deadOnFloor++; __game.farm.flock.deadTotal++; } return 'dead birds at ' + out.map((d) => d.x.toFixed(1)).join(', '); })()`),
    adv(0.6),
    exp(`(() => { const s = ${chip}, p = __game.player.position, n = __game.farm.flock.deadOnFloor; const near = __game.flock.dead.near(p.x, p.z, 80); const m = Math.round(Math.hypot(near[0].x - p.x, near[0].z - p.z)); return s.dead && s.dead.text === n + ' dead birds · ' + (m < 1 ? 'at your feet' : m + ' m') && 'chip "' + s.dead.text + '" (' + n + ' on the floor, nearest ' + m + ' m)'; })()`, 'the chip: the count and the nearest dead bird’s distance'),
    exp(`(() => { const s = ${chip}, p = __game.player.position; const within = __game.flock.dead.near(p.x, p.z, 80).filter((d) => Math.hypot(d.x - p.x, d.z - p.z) <= 15).length; return s.marks === within && within >= 2 && 'markers ' + s.marks + ' (the birds within 15 m: ' + within + ')'; })()`, 'a marker over each dead bird within 15 m, none farther'),
    exp(`(() => { const j = document.querySelector('.edge-pointer:not(.edge-pointer--dead):not(.edge-pointer--bucket)'); return __game.scene.getObjectByName('job-marker')?.visible && 'job marker shown' + (j && !j.hidden ? ' and its pointer' : ' on screen'); })()`, 'the job marker still shows with the dead-bird chip'),
    shot('rq-d-01-chip-on-screen'),
    // walk west out of sight of them: the chip goes to the edge, the job pointer stays apart
    W(-21, -2, 0.5), adv(0.4),
    exp(`(() => { const s = ${chip}; const el = document.querySelector('.edge-pointer--dead'), j = document.querySelector('.edge-pointer:not(.edge-pointer--dead):not(.edge-pointer--bucket)'); const r = el.getBoundingClientRect(), q = j && !j.hidden ? j.getBoundingClientRect() : null; const apart = !q || r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right; return s.dead && !el.hidden && apart && 'chip "' + s.dead.text + '"' + (s.dead.onScreen ? ' over the bird' : ' at the edge') + (q ? ', the job pointer apart' : ''); })()`, 'farther away: the chip still shows, apart from the job pointer'),
    exp(`(() => { const s = ${chip}, p = __game.player.position; const within = __game.flock.dead.near(p.x, p.z, 80).filter((d) => Math.hypot(d.x - p.x, d.z - p.z) <= 15).length; return s.marks === within && 'markers ' + s.marks + ' within 15 m'; })()`, 'markers follow the 15 m'),
    shot('rq-d-02-chip-far'),
    // pick them all up: the chip goes
    ...[0, 1, 2].flatMap((i) => [{ walkToExpr: '__deadNear()', tol: 0.6, max: 40, label: `dead bird ${i + 1}` }, { pressIf: 'Shift+E', if: `__game.level.chickJob && __game.interact.nearest(__game.player, (x) => x.id === 'dead-bird')` }, { pressIf: 'e', if: `!__game.level.chickJob && __game.interact.nearest(__game.player)?.id === 'dead-bird'` }, adv(0.3)]),
    exp(`__game.farm.flock.deadOnFloor === 0 && !${chip}.dead && ${chip}.marks === 0 && 'none on the floor: no chip, no markers'`, 'no dead birds: no chip, no markers'),
  ];
}

// ---------------- req-watch.json (request 1) ----------------
export function watchSteps() {
  const row = (k) => `__game.level.watch.status().rows.${k}`;
  const card = (k) => `(document.querySelector('#hud .fw:not([hidden]) .fw-row[data-row="${k}"]')?.dataset.state || 'none')`;
  return [
    ev(`(__game.startLevel({ seed: 1 }), __game.level.debug.goto(0, 9.0, { auto: true }), 'the chicks placed: ' + __game.farm.flock.placed + ${t()})`),
    adv(0.5),
    exp(`(() => { const st = __game.level.watch.status(); return st.on && !document.querySelector('#hud .fw').hidden && 'the card: ' + Object.entries(st.rows).map(([k, v]) => k + ' ' + v.state + ' (' + v.value + ')').join('; '); })()`, 'the Flock watch card shows once the chicks are out'),
    shot('rq-w-00-card'),
    W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN, W(-12, -4.6, 0.3),
    ...E('controller', 'E opens the climate controller'), click('Temperature'),
    click('Lower the brooder thermostat by 0.5 °C', 8), adv(0.3),
    exp(`__game.env.heaterSetpoint <= __game.env.targetTemp - 3.9 && 'thermostat ' + __game.env.heaterSetpoint + ' °C against the sign row ' + __game.env.targetTemp + ' °C'`, 'the thermostat 4 °C under the brooder sign’s row by real clicks'),
    ...esc(), W(-12, 0, 0.5),
    ev(`(window.__wt0 = __game.env.day, 'clock runs from ' + __t())`),
    until(`__game.level.watch.warnings.some((w) => w.kind === 'cold')`, 900, 1),
    exp(`(() => { const w = __game.level.watch.warnings.find((x) => x.kind === 'cold'); return w && /felt cold/.test(w.text) && /brooder sign/.test(w.text) && /thermostat/.test(w.text) && 'warning ' + ((w.t - window.__wt0) * 24).toFixed(1) + ' farm h after the change: ' + w.text; })()`, 'the early warning: what (cold hours), why, where (the brooder sign, the thermostat)'),
    adv(0.3),
    exp(`(() => { const c = ${captionHas('/felt cold/')}; return c && 'caption: ' + c.input.slice(0, 90); })()`, 'the warning as a caption'),
    exp(`${card('comfort')} === 'red' && /Cold/.test(${row('comfort')}.value) && 'card comfort ' + ${card('comfort')} + ': ' + ${row('comfort')}.value`, 'the card’s comfort row red'),
    exp(`(() => { const n = __game.records.notebook.filter((x) => x.kind === 'watch'); return n.length && 'notebook: ' + n.length + ' flock watch line(s)'; })()`, 'the warning in the notebook'),
    exp(`(() => { const d = __game.level.levelDeaths(); return __game.level.mode === 'level' && !__game.level.result && d.pct < 2 && 'the level runs: deaths ' + d.pct.toFixed(2) + ' % of the 2 % limit, ' + __t(); })()`, 'the warning comes while the level runs, well before a fail'),
    shot('rq-w-01-warning'),
    pressKey('n'), adv(0.3),
    exp(`/Flock watch/.test(document.querySelector('#hud .panel:not([hidden])')?.textContent || '') && 'the notebook shows the flock watch line'`, 'N: the notebook lists it'),
    shot('rq-w-02-notebook'), ...esc(),
    // acting on it: the thermostat back to the sign's row at the controller
    W(-12, -4.6, 0.3), ...E('controller', 'E opens the climate controller again'), click('Temperature'),
    clickUntil('Raise the brooder thermostat by 0.5 °C', `__game.env.heaterSetpoint >= __game.env.targetTemp - 0.01`, 12), adv(0.3), ...esc(), W(-12, 0, 0.5),
    until(`${row('comfort')}.now === 'right'`, 400, 1),
    exp(`${row('comfort')}.now === 'right' && 'comfort row: ' + ${row('comfort')}.value + ' (' + ${row('comfort')}.state + ')'`, 'thermostat back: the chicks right again (the row says so now)'),
    shot('rq-w-03-after'),
  ];
}

// ---------------- req-clock.json (request 2) ----------------
export function clock() {
  const C = '__game.config.LEVEL1.clock';
  const meter = `__game.level.jobs.byKey('r-meter@1')`;
  return [
    ev(`(window.__soonSeen = '', __game.events.on('job:soon', (p) => { window.__soonSeen += (p.keys || [p.key]).join(' ') + ' | '; }), 'soon cues listened to')`),
    ev(`(__game.startLevel({ seed: 1 }), __game.level.debug.goto(1, 6.2, { auto: true }), __game.level.debug.goto(1, 11.25), 'day 1 morning jobs open, none done' + ${t()} + ': r-meter ' + ${meter}.status)`),
    adv(0.6),
    exp(`${C}.work === 90 && ${C}.fast === 360 && ${C}.panel === 24 && ${C}.atJob === 60 && __game.env.timeScale === ${C}.work && document.querySelector('.clock-rate').textContent === '1×' && 'the default clock 90 game s a second (one farm hour = 40 s), rate 1×'`, 'the default clock is 25 % slower (90, was 120)'),
    W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN,
    exp(`(() => { const chip = [...document.querySelectorAll('.ljobs .job-soon:not([hidden])')].map((x) => x.textContent); return chip.some((x) => /^closes in [0-9]+ farm minutes?$/.test(x)) && 'job card chips: ' + chip.join(' | ') + ${t()}; })()`, 'the job card warns ahead: "closes in … farm minutes"'),
    exp(`window.__soonSeen.includes('r-meter@1') && 'the soft cue (EV.JOB_SOON: caption, chip pulse, click) for ' + window.__soonSeen.trim()`, 'the soft cue 30 farm minutes before the close'),
    shot('rq-c-01-soon-chip'),
    W(-23.0, 5.45, 0.3), adv(0.4),
    exp(`__game.env.timeScale === ${C}.atJob && document.querySelector('.clock-rate').textContent === '⅔ speed' && 'at the water supply: ' + __game.env.timeScale + ' (⅔ speed)'`, 'slower at an open job’s place: 60, ⅔ speed'),
    ...E('water-supply', 'E opens the water supply'), adv(0.2),
    exp(`__game.env.timeScale === 0 && 'its plate unfolded: the clock stands while he reads it'`, 'a plate open: the clock stands (as before)'),
    FOLD, adv(0.3),
    exp(`__game.env.timeScale === ${C}.panel && document.querySelector('.clock-rate').textContent === '¼ speed' && 'panel open, plate folded: ' + __game.env.timeScale + ' (¼ speed)'`, 'slower still with its panel open: 24'),
    until(`__game.env.hour >= 12.08`, 60, 0.5),
    exp(`(() => { const j = ${meter}; return j.status === 'open' && j.heldFrom != null && 'r-meter open at ' + __t() + ' (its window closed at ' + ((j.heldFrom % 1) * 24).toFixed(2) + ' h): held while the panel is open'; })()`, 'no job expires while its panel is open'),
    shot('rq-c-02-held'),
    ...esc(), W(-14, 0, 0.5), adv(0.3),
    exp(`(() => { const t = [...document.querySelectorAll('.ljobs .job-soon.is-held:not([hidden])')].map((x) => x.textContent); return t.length && 'chip: ' + t.join(' | '); })()`, 'the card: "held open while you work · N farm min after"'),
    until(`${meter}.status !== 'open'`, 60, 0.5),
    exp(`(() => { const j = ${meter}; const after = (__game.env.day - j.heldFrom) * 1440; return j.status === 'missed' && after >= 20 && 'missed ' + after.toFixed(0) + ' farm minutes after its window (the grace after the panel closed)' + ${t()}; })()`, 'after the panel closes it is missed only after the 20-minute grace'),
    // the same job done while held: day 2's meter read at its panel past 12:00
    ev(`(__game.level.debug.goto(2, 11.3), 'day 2' + ${t()} + ', r-meter@2 ' + __game.level.jobs.byKey('r-meter@2').status)`),
    W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN, W(-23.0, 5.45, 0.3),
    ...E('water-supply', 'E opens the water supply'), FOLD, adv(0.2),
    until(`__game.env.hour >= 12.05`, 80, 0.5),
    click('Read the meter'), adv(0.5),
    exp(`(() => { const j = __game.level.jobs.byKey('r-meter@2'); return j.status === 'done' && 'r-meter@2 done at ' + ((j.doneAt % 1) * 24).toFixed(2) + ' h, after its 12:00 close: held while he did it'; })()`, 'a job finished at its panel after its window closed: done, not missed'),
    ...esc(),
  ];
}

// ---------------- writing the files ----------------
const FILES = { watch: 'scripts/req-watch.json', clock: 'scripts/req-clock.json', bucket: 'scripts/req-bucket.json', deadmark: 'scripts/req-deadmark.json' };
const PARTS = { watch: watchSteps, clock, bucket, deadmark };
if (process.argv[1] && process.argv[1].endsWith('req-steps.mjs')) {
  const dev = process.argv.indexOf('--dev');
  if (dev >= 0) write(process.argv[dev + 2], [...START, ...process.argv[dev + 1].split(',').flatMap((n) => PARTS[n]())]);
  else for (const [n, f] of Object.entries(FILES)) write(f, [...START, ...PARTS[n]()]);
}
