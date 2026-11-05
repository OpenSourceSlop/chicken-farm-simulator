// Node tests of the skills update's job side (SKILLS.md §13.1, package "jobs"): the job variants of every payoff (the glance
// any-rule and its two ways to finish, with a FAKE farm.autoCtl.ok since the model's stub answers false), r-raise's split,
// r-drinkers never handed over (with Water 3 on it still needs its four flow tests, or in-band sight tubes with Water 2),
// the payoffs' places, a variant saved and resumed with the same rule, perks off -> the job as on main, the would-be-easier
// and handled lines, the unlock and gate captions, the seen rule, and every new text verdict-free with its tokens filled.
//   node scripts/test-payoffs.mjs
import { createSim } from '../src/sim.js';
import { createFarm } from '../src/farm.js';
import { createEvents, EV } from '../src/events.js';
import { createJobEngine } from '../src/job-engine.js';
import { createSkills } from '../src/skills.js';
import { createRecords } from '../src/records.js';
import { createPerks } from '../src/perks.js';
import { jobById, JOB_WHERE_PAYOFF, jobWhereNow } from '../src/content-jobs.js';
import { jobVariant, applyVariant, rebuildVariant, variantKeyOf, DEAD_TITLE, RULE_KEYS } from '../src/job-variants.js';
import { jobPlaces, nextPlace, PHONE_TODO } from '../src/job-next.js';
import { stripRows, stripsAt, STRIPS } from '../src/job-strips.js';
import { STRIPS_CYCLE } from '../src/job-strips-cycle.js';
import { easierLine, handledLines, unlockCaption, gateCaption, nextLevelLine, PAYOFF_CARD, PAYOFF_NOW, FAULT_MANUAL, viewLine, groupUnlocks } from '../src/job-words.js';
import { fillKeys } from '../src/key-words.js';
import { nippleCmToday, rimCmNow, flowToday } from '../src/job-figures.js';
import { SKILLS_UPDATE, AUTO_SYSTEMS, PAYOFFS, SKILL_VIEWS, SKILL_BRANCHES, LEVEL1, CYCLE, WEEK2, WEEKS45, houseSector, BROOD_BOUNDS } from '../src/config.js';
import { GUIDE, fillGuide } from '../src/content-guide.js';
import { SETTINGS_SCHEMA } from '../src/settings.js';
import { KEY_ACTIONS, createKeys } from '../src/keys.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const H = 1 / 24;
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the|fail|score|bad farmer|poor/i;
const plain = (t) => fillKeys(String(t));
const clean = (t, where) => { const s = plain(t); assert(!/[{}]/.test(s), `${where}: an unfilled token in "${s}"`); assert(!VERDICT.test(s), `${where}: a verdict word in "${s}"`); return s; };

/** A skills world: real skills (forced levels) and perks (allowed), the switch on while the test runs. */
function perksWorld(levels = {}) {
  const env = createSim(), events = createEvents(), farm = createFarm(env, { events });
  const records = createRecords({ farm, env, events });
  const skills = createSkills({ events, records, farm });
  const perks = createPerks({ skills, events, allowed: true });
  for (const [b, l] of Object.entries(levels)) skills.debug.force(b, l);
  return { env, events, farm, skills, perks };
}
/** A level of the run with the engine making variants from `perks` (the clock at day, hour; the farm in level mode). */
function world(def, { day = def.startDay, hour = 6, levels = {}, perks: P = null, ok = false } = {}) {
  const S = perksWorld(levels);
  const { env, events, farm } = S;
  env.addStepper(farm.step);
  farm.start(LEVEL1, { seed: 1 });
  env.setMaxDay(CYCLE.lastDay); env.setDay(day); env.setHour(hour);
  const perks = P || S.perks;
  // the FAKE controller reading: the model's stub answers false; a test sets W.ok
  const W = { ...S, perks, ok };
  farm.autoCtl.ok = (system, inst, part) => (typeof W.ok === 'function' ? W.ok(system, part) : !!W.ok);
  const props = { carrying: null };
  const jobs = createJobEngine({ events, env, farm, props, records: { logJob() {} }, level: def, variant: (jd) => jobVariant(jd, perks) });
  jobs.start(day, def);
  W.jobs = jobs; W.props = props;
  W.at = (d, h) => { const t = d + h * H; if (t > env.day + 1e-9) env.skipHours((t - env.day) * 24); jobs.tick(); };
  W.act = (id, args = {}) => { events.emit(EV.ACTION, { id, ...args, result: args.result }); jobs.tick(); };
  W.st = (key) => jobs.byKey(key)?.status;
  W.c = () => ({ env, farm, props, engine: jobs, perks, skills: S.skills, from: { x: -14, z: 0, inside: true } });
  return W;
}
const live = (fn) => { const was = SKILLS_UPDATE.live; SKILLS_UPDATE.live = true; try { return fn(); } finally { SKILLS_UPDATE.live = was; } };
/** Lines in band for today (nipples at the plate, rims at the plate). */
function linesAtPlate(W) { const n = nippleCmToday(W.env), r = rimCmNow(W.env); for (const l of W.farm.water.lines) l.heightCm = n; for (const l of W.farm.feed.lines) l.heightCm = r; }
/** A house sector's centre for count / seen samples (the house's eight parts). */
const HOUSE_PTS = [[-18, -2.8], [-18, 2.8], [-6, -2.8], [-6, 2.8], [6, -2.8], [6, 2.8], [18, -2.8], [18, 2.8]];

test('perks off -> every job exactly as on main (live false, not allowed, the setting off)', () => {
  const S = perksWorld({ water: 3, feed: 3, growth: 3, planning: 3, biosecurity: 3, moisture: 3 });
  const ids = ['r-raise', 'r-drinkers', 'prep-vent', 'w2-weigh', 'w2-order', 'r-record', 'r-dead-am', 'w2-check', 'p-order-feed'];
  for (const id of ids) assert(jobVariant(jobById(id), S.perks) === jobById(id), `live false: ${id} changed`);
  live(() => {
    S.perks.allow(false);
    for (const id of ids) assert(jobVariant(jobById(id), S.perks) === jobById(id), `not allowed: ${id} changed`);
    S.perks.allow(true);
    assert(jobVariant(jobById('r-raise'), S.perks) !== jobById('r-raise'), 'allowed and live: r-raise is a variant');
    const off = createPerks({ skills: S.skills, settings: { get: (p) => (p === 'automation.all' ? false : true) }, allowed: true });
    const v = jobVariant(jobById('r-raise'), off);
    assert(v === jobById('r-raise'), 'automation.all off: r-raise as on main (level 2 changes nothing on it)');
    assert(jobVariant(jobById('prep-vent'), off) === jobById('prep-vent'), 'automation.all off: prep-vent as on main');
    assert(jobVariant(null, S.perks) === null && jobVariant(jobById('r-raise'), null) === jobById('r-raise'), 'no job or no perks: as it is');
  });
});

test('every handed-over whole job: any[ GLANCE(auto-ok live + auto.glance), the job as before ]; no problem job handed over', () => live(() => {
  const S = perksWorld(Object.fromEntries(SKILL_BRANCHES.map((b) => [b.id, 3])));
  let n = 0;
  for (const [system, s] of Object.entries(AUTO_SYSTEMS)) for (const [jobId, part] of Object.entries(s.jobs)) {
    const jd = jobById(jobId);
    assert(jd, `${system}: job ${jobId} exists`);
    assert(jd.kind !== 'problem', `${jobId}: a problem job is never handed over`);
    assert(!['r-drinkers', 'r-feeders'].includes(jobId), `${jobId} is never handed over`);
    const v = jobVariant(jd, S.perks);
    assert(v.variant && v.variant.parts[system] === part && v.variant.keys.includes(s.payoff), `${jobId}: variant parts ${JSON.stringify(v.variant)}`);
    if (part !== 'whole') continue;
    const any = v.done;
    assert(any.type === 'any' && any.handled === system && any.of.length === 2, `${jobId}: any rule ${JSON.stringify(any).slice(0, 80)}`);
    const g = any.of[0];
    assert(g.type === 'all' && g.glance === system && g.of[0].test === 'auto-ok' && g.of[0].live && g.of[0].system === system && g.of[1].id === 'auto.glance' && g.of[1].match.system === system, `${jobId}: the glance`);
    const { label, ...orig } = any.of[1], { label: l0, ...base } = jd.done;
    void label; void l0;
    assert(JSON.stringify(orig) === JSON.stringify(base), `${jobId}: the job as before under the glance`);
    assert(v.title === jd.title && v.id === jd.id && v.spot === jd.spot, `${jobId}: title, id and spot kept`);
    n++;
  }
  assert(n >= 12, `whole jobs ${n}`);
  for (const id of ['r-drinkers', 'r-feeders']) assert(S.perks.handled(id).length === 0, `${id}: perks.handled empty`);
}));

test('r-raise splits: Water 3 alone, Feed 3 alone, both (only the handed-over part is any[ GLANCE, part ])', () => live(() => {
  const shape = (levels) => {
    const S = perksWorld(levels), v = jobVariant(jobById('r-raise'), S.perks);
    return v.done.type === 'all' ? v.done.of.map((r) => (r.type === 'any' ? `${r.handled}:${r.of[1].test}` : r.test)).join(',') : v.done.test;
  };
  assert(shape({ water: 3 }) === 'winch:drinkers-raised,pans-raised', `Water 3 alone: ${shape({ water: 3 })}`);
  assert(shape({ feed: 3 }) === 'drinkers-raised,feed:pans-raised', `Feed 3 alone: ${shape({ feed: 3 })}`);
  assert(shape({ water: 3, feed: 3 }) === 'winch:drinkers-raised,feed:pans-raised', `both: ${shape({ water: 3, feed: 3 })}`);
  assert(shape({ water: 2, feed: 2 }) === 'lines-raised', 'level 2: lines-raised as on main');
}));

test('a whole job done by the glance (fake ok) or by hand as before: w2-weigh with Growth 3', () => live(() => {
  const W = world(WEEK2, { day: 14, hour: 7.9, levels: { growth: 3 } });
  W.at(14, 8.05);
  const key = 'w2-weigh@14';
  assert(W.st(key) === 'open' && W.jobs.byKey(key).def.done.handled === 'scale', 'w2-weigh open as the scale variant');
  W.act('auto.glance', { system: 'scale' });
  assert(W.st(key) === 'open', 'the glance with the reading out of band does not finish it');
  W.ok = true; W.at(14, 8.2);
  assert(W.st(key) === 'done', `the glance with the reading in band finishes it: ${W.st(key)}`);
  // by hand: 50 birds from 5 parts of the house, the reading never in band
  const M = world(WEEK2, { day: 14, hour: 8.05, levels: { growth: 3 } });
  M.at(14, 8.1);
  for (let i = 0; i < 50; i++) { const [x, z] = HOUSE_PTS[i % 5]; M.act('sample.weigh', { x, z, result: { weightG: 450 } }); }
  assert(M.st(key) === 'done', `fifty birds from five parts by hand: ${M.st(key)}`);
}));

test('r-raise with Water 3: the drinker part by the glance, the feeder part by hand; with Water 3 + Feed 3 both by glances', () => live(() => {
  const W = world(WEEK2, { day: 11, hour: 13.1, levels: { water: 3 } });
  W.at(11, 13.2);
  const key = 'r-raise@11', inst = W.jobs.byKey(key);
  assert(W.st(key) === 'open', `r-raise open: ${W.st(key)}`);
  W.ok = (s) => s === 'winch';
  W.act('auto.glance', { system: 'winch' });
  assert(W.st(key) === 'open' && inst.st.met[0] && !inst.st.met[1], `the drinker part by the glance, feeders still to do: ${JSON.stringify(inst.st.met)}`);
  for (const l of W.farm.feed.lines) l.heightCm = rimCmNow(W.env);
  W.at(11, 13.3);
  assert(W.st(key) === 'done', `the feeders by hand finish it: ${W.st(key)}`);
  const B = world(WEEK2, { day: 11, hour: 13.1, levels: { water: 3, feed: 3 }, ok: true });
  B.at(11, 13.2);
  B.act('auto.glance', { system: 'winch' });
  assert(B.st(key) === 'open', 'one glance is one part');
  B.act('auto.glance', { system: 'feed' });
  assert(B.st(key) === 'done', `two glances: ${B.st(key)}`);
  // a fault open: the drinker part by hand at the regulators as before
  const F = world(WEEK2, { day: 11, hour: 13.1, levels: { water: 3 } });
  F.at(11, 13.2);
  linesAtPlate(F); F.at(11, 13.3);
  assert(F.st(key) === 'done', `by hand with no glance: ${F.st(key)}`);
}));

test('with Water 3 on, r-drinkers is never handed over: four flow tests (or in-band sight tubes with Water 2); no handled line', () => live(() => {
  const W = world(WEEK2, { day: 10, hour: 6.05, levels: { water: 3 }, ok: true });
  W.at(10, 6.1);
  const key = 'r-drinkers@10', inst = W.jobs.byKey(key);
  assert(inst && W.st(key) === 'open', 'r-drinkers open on day 10');
  assert(W.perks.handled('r-drinkers').length === 0 && handledLines(inst, W.farm).length === 0, 'no handled line for r-drinkers');
  assert(!inst.def.variant.parts.winch && inst.def.done.type === 'all', 'r-drinkers keeps its all rule (Water 2 sight tubes only)');
  linesAtPlate(W);
  W.act('auto.glance', { system: 'winch' });
  assert(W.st(key) === 'open', 'the winch glance does not finish r-drinkers');
  // the tubes: lines 1, 2, 4 at the mark, line 3 low
  const want = flowToday(W.env), at = W.env.day;
  const cols = [0, 1, 2, 3].map((i) => ({ line: i, cm: i === 2 ? 8 : 12, markCm: 12, inBand: i !== 2 }));
  cols.forEach((c) => { W.farm.water.lines[c.line].lastColumn = { cm: c.cm, inBand: c.inBand, at }; });
  W.act('water.columns', { result: { lines: cols } });
  assert(W.st(key) === 'open', 'three lines in band by the tubes: not done');
  W.farm.water.lines[2].lastFlow = { mlMin: want, at: W.env.day + 1e-6 };
  W.act('water.flowtest', { line: 2, result: { mlMin: want } });
  assert(W.st(key) === 'done', `the one cup test on line 3 finishes it: ${W.st(key)}`);
  // Water 3 held but Water 2 not (a perks object without waterAllLines): the four flow tests as on main
  const real = perksWorld({ water: 3 }).perks;
  const fake = { ...real, has: (k) => k !== 'waterAllLines' && real.has(k), handled: (id) => real.handled(id), easier: () => [] };
  assert(jobVariant(jobById('r-drinkers'), fake) === jobById('r-drinkers'), 'without Water 2 r-drinkers is the job as on main');
  const M = world(WEEK2, { day: 10, hour: 6.05, perks: fake, ok: true });
  M.at(10, 6.1); linesAtPlate(M);
  for (const i of [0, 1, 2]) { M.farm.water.lines[i].lastFlow = { mlMin: want, at: M.env.day }; M.act('water.flowtest', { line: i, result: { mlMin: want } }); }
  M.act('auto.glance', { system: 'winch' });
  assert(M.st(key) === 'open', 'three flow tests and a glance: not done');
  M.farm.water.lines[3].lastFlow = { mlMin: want, at: M.env.day }; M.act('water.flowtest', { line: 3, result: { mlMin: want } });
  assert(M.st(key) === 'done', `the fourth flow test: ${M.st(key)}`);
}));

test('the sight tubes\' places (the water supply first, then only the lines that read off) and the tube strip', () => live(() => {
  const W = world(WEEK2, { day: 10, hour: 6.05, levels: { water: 2 } });
  W.at(10, 6.1); linesAtPlate(W);
  const inst = W.jobs.byKey('r-drinkers@10');
  assert(inst.def.variant.keys.includes('waterAllLines') && inst.def.done.of.every((r) => r.tubes), 'Water 2: the tubes variant');
  let pl = jobPlaces(inst, W.c());
  assert(pl.length === 1 && pl[0].id === 'waterSupply', `before the tubes: the supply only: ${pl.map((p) => p.id)}`);
  const at = W.env.day, cols = [0, 1, 2, 3].map((i) => ({ line: i, cm: i === 2 ? 8 : 12, markCm: 12, inBand: i !== 2 }));
  cols.forEach((c) => { W.farm.water.lines[c.line].lastColumn = { cm: c.cm, inBand: c.inBand, at }; });
  W.act('water.columns', { result: { lines: cols } });
  pl = jobPlaces(inst, W.c());
  assert(pl.length === 1 && pl[0].id === 'drinkers.2' && /cup test/.test(pl[0].todo), `after: line 3 only: ${JSON.stringify(pl.map((p) => [p.id, p.todo]))}`);
  const rows = stripRows(STRIPS['r-drinkers'], { ...W.c(), records: { notebook: [] } }, inst, 'water-supply');
  assert(rows.some((r) => /Water 2: read the sight tubes/.test(r.text || '')), 'the strip leads with the Water 2 row');
  assert(rows.some((r) => /Line 3: sight tube 8\.0 cm, off the mark/.test(r.text || '')), `the tube rows: ${rows.map((r) => r.text).join(' | ')}`);
  const at2 = stripsAt(W.jobs, 'water-supply', null, STRIPS_CYCLE, W.perks);
  assert(at2.some((s) => s.inst.id === 'r-drinkers'), 'r-drinkers shows its strip at the water supply with Water 2');
}));

test('the phone, the silo gauge and the glance as places; the phone has no marker and its Next line names the key', () => live(() => {
  const W = world(WEEK2, { day: 13, hour: 6.05, levels: { planning: 2, feed: 1 } });
  W.at(13, 6.2);
  const order = W.jobs.byKey('w2-order@13');
  const np = nextPlace(order, W.c(), { from: { x: 0, z: 0, inside: true } });
  assert(np && np.phone && np.at === null && /^Press R \(the phone, anywhere\): order grower pellets/.test(np.text), `the pocket phone: ${np?.text}`);
  assert(jobWhereNow('w2-order', (k) => k === 'pocketPhone').startsWith('The phone in your pocket: R'), 'the where line names the phone and its key');
  const S = world(WEEK2, { day: 13, hour: 6.05, levels: { feed: 2 } });
  S.at(13, 6.2);
  const ids = jobPlaces(S.jobs.byKey('w2-order@13'), S.c()).map((p) => p.id).join(',');
  assert(ids === 'silo,officeDesk', `Feed 2: the silo gauge or the office: ${ids}`);
  for (const id of Object.keys(PHONE_TODO)) assert(jobById(id), `phone job ${id} exists`);
  // a whole job handed over: the glance places while the reading is in band, the job's own places by hand otherwise
  const G = world(WEEKS45, { day: 28, hour: 8.05, levels: { growth: 3 } });
  G.at(28, 8.2);
  const wg = G.jobs.byKey('w45-weigh28@28');
  G.ok = true;
  assert(jobPlaces(wg, G.c())[0].id === 'birdScale' && /Growth 3/.test(jobPlaces(wg, G.c())[0].todo), 'in band: look at the scale (Growth 3)');
  G.ok = false;
  assert(jobPlaces(wg, G.c())[0].todo === 'take the scale and frame', `out of band: weigh by hand: ${jobPlaces(wg, G.c())[0].todo}`);
  // the frame in hand: only the parts of the house the frame goes down in (the brooding floor, props.js)
  G.props.carrying = 'frame';
  const fp = jobPlaces(wg, G.c()) || [];
  assert(fp.length === 6 && fp.every((p) => p.at.x <= BROOD_BOUNDS.xMax - 0.5) && new Set(fp.map((p) => houseSector(p.at.x, p.at.z))).size === 6,
    `the frame's parts: ${fp.map((p) => `${p.name} (${p.at.x.toFixed(1)})`).join('; ')}`);
  G.props.carrying = null;
}));

test('a variant instance is saved and resumed with the same rule, whatever the perks are then', () => live(() => {
  const W = world(WEEK2, { day: 11, hour: 13.1, levels: { water: 3, feed: 3 } });
  W.at(11, 13.2);
  const d = W.jobs.serialize();
  const saved = d.list.find((x) => x.key === 'r-raise@11');
  assert(saved && saved.variant && saved.variant.parts.winch === 'drinkers-raised' && saved.variant.parts.feed === 'pans-raised', `saved variant: ${JSON.stringify(saved?.variant)}`);
  const R = world(WEEK2, { day: 11, hour: 13.2, levels: {} });
  R.jobs.restore(JSON.parse(JSON.stringify(d)), WEEK2);
  const inst = R.jobs.byKey('r-raise@11');
  assert(JSON.stringify(inst.def.done) === JSON.stringify(W.jobs.byKey('r-raise@11').def.done), 'the same rule after the resume with no perks');
  assert(variantKeyOf(inst.def) === 'autoWinch+autoFeed', `keys: ${variantKeyOf(inst.def)}`);
  assert(rebuildVariant(jobById('r-raise'), null) === jobById('r-raise'), 'no saved variant: the job as on main');
  R.ok = true; R.act('auto.glance', { system: 'winch' }); R.act('auto.glance', { system: 'feed' });
  assert(R.st('r-raise@11') === 'done', 'the resumed variant finishes by its glances');
}));

test('the passing check (Biosecurity 3): w2-check by ten birds seen walking from three parts, or in the hand; the tally titles', () => live(() => {
  const W = world(WEEK2, { day: 10, hour: 8.05, levels: { biosecurity: 3 } });
  W.at(10, 8.1);
  const key = 'w2-check@10', inst = W.jobs.byKey(key);
  assert(inst.def.done.type === 'seen' && inst.def.done.n === 10 && inst.def.done.sectors === 3, `the seen rule keeps 10 birds from 3 parts: ${JSON.stringify(inst.def.done).slice(0, 90)}`);
  const pts = [[-21, -2.5], [-17, 2.5], [-13, -2.5]];
  for (let i = 0; i < 8; i++) { const [x, z] = pts[i % 3]; W.events.emit(EV.BIRD_SEEN, { index: i, look: 'gait', x, z }); }
  W.events.emit(EV.BIRD_SEEN, { index: 3, look: 'gait', x: -21, z: -2.5 });   // the same bird again
  W.events.emit(EV.BIRD_SEEN, { index: 40, look: 'sick', x: -21, z: -2.5 });  // another look
  W.jobs.tick();
  assert(W.st(key) === 'open' && inst.st.list.length === 8, `eight birds, each once, gait only: ${inst.st.list.length}`);
  W.act('sample.bird', { look: 'gait', index: 90, x: -21, z: 2.5, result: { gait: 0 } });
  W.events.emit(EV.BIRD_SEEN, { index: 91, look: 'gait', x: -17, z: -2.5 }); W.jobs.tick();
  assert(W.st(key) === 'done', `nine seen and one in the hand: ${W.st(key)} (${inst.st.list.length})`);
  const D = perksWorld({ biosecurity: 2 });
  for (const id of ['r-dead-am', 'r-dead-pm']) assert(jobVariant(jobById(id), D.perks).title === DEAD_TITLE, `${id}: the tally title`);
  assert(jobVariant(jobById('p-lame'), perksWorld({ biosecurity: 3 }).perks) === jobById('p-lame'), 'a problem job keeps its rule (p-lame)');
}));

test('the job card\'s words: would be easier, with your next flock, handled lines, the fault\'s manual part first', () => live(() => {
  assert(easierLine([{ key: 'frameWeigh', name: 'x', branch: 'growth', level: 2, has: false, toGo: 3, later: false }]) === 'Growth 2: weigh the frame in one press · 3 points to go', 'the Growth 2 line');
  assert(easierLine([{ key: 'autoScale', branch: 'growth', level: 3, has: false, toGo: 0, later: true }]) === 'Growth 3: read the automatic scale’s day average · with your next flock', 'level 3 in a first flock');
  assert(/2 points to go, then with your next flock$/.test(easierLine([{ key: 'autoWinch', branch: 'water', level: 3, has: false, toGo: 2, later: true }])), 'points, then the next flock');
  assert(easierLine([{ key: 'frameWeigh', branch: 'growth', level: 2, has: true, toGo: 0 }]) === '', 'nothing once held');
  const S = perksWorld({ growth: 1 });
  const e = S.perks.easier('w2-weigh');
  assert(e[0].key === 'frameWeigh' && e[0].toGo === 9 - S.skills.points('growth'), `perks.easier: ${JSON.stringify(e[0])}`);
  const V = world(WEEK2, { day: 11, hour: 13.2, levels: { water: 3, feed: 3 } });
  V.at(11, 13.3);
  const inst = V.jobs.byKey('r-raise@11');
  const hl = handledLines(inst, V.farm).map((x) => x.text);
  assert(hl[0] === 'drinker lines: handled by the controller (Water 3) · look at the four line heights at the water supply or a line regulator' && hl[1].startsWith('feeder lines: handled by the controller (Feed 3)'), `handled: ${hl.join(' | ')}`);
  const st0 = V.farm.autoCtl.status;
  V.farm.autoCtl.status = () => ({ ...st0(), faults: [{ id: 'winch-stall', system: 'winch', phase: 'open', args: { line: 2 } }] });
  const hf = handledLines(inst, V.farm);
  assert(hf[0].fault && hf[0].text === 'Line 3: by hand at its regulator (the winch motor stalled)' && !hf[1].fault, `fault first: ${hf.map((x) => x.text).join(' | ')}`);
  V.farm.autoCtl.status = st0;
}));

test('the unlock caption, the gate\'s one caption and the tree\'s next-level line', () => live(() => {
  const w2 = unlockCaption([{ key: 'lineOverview' }, { key: 'waterAllLines', payoff: true }]);
  assert(w2.startsWith('Water 2 · Faster: read all four sight tubes at the water supply. Use it at the sight-tube board') && w2.includes('Saves the four one-minute flow tests'), w2);
  assert(/Also: all-lines water overview/.test(w2) && !/Automation/.test(w2), 'level 2: its view, no Automation line');
  const w3 = unlockCaption([{ key: 'waterTest' }, { key: 'autoWinch', payoff: true }]);
  assert(w3.startsWith('Water 3 · The equipment does it:') && w3.endsWith('You can switch it off in Settings → Automation.'), w3);
  assert(unlockCaption([{ key: 'planningCalc' }]).startsWith('Farm Planning 1 · See more: planning calculator at the office desk'), 'a level 1 view');
  assert(unlockCaption([]) === '' && groupUnlocks([{ key: null }]).length === 0, 'nothing for key null');
  const all3 = Object.keys(PAYOFFS).filter((k) => PAYOFFS[k].level === 3);
  assert(gateCaption(all3.map((key) => ({ key, gate: true }))) === 'Level 3 now: the equipment does it in 11 branches (Settings → Automation switches each off).', gateCaption(all3));
  assert(gateCaption(['autoWinch']) === 'Level 3 now: the equipment does it in 1 branch: Water (Settings → Automation switches each off).', gateCaption(['autoWinch']));
  assert(/— 3 points to go$/.test(nextLevelLine('water', 1, 6, 0)), nextLevelLine('water', 1, 6, 0));
  assert(/comes with your next flock$/.test(nextLevelLine('water', 2, 13, 0)), nextLevelLine('water', 2, 13, 0));
  assert(/— 0 points to go$/.test(nextLevelLine('water', 2, 13, 1)), nextLevelLine('water', 2, 13, 1));
}));

test('every new text: plain words, no verdict, every {key:id} token filled', () => live(() => {
  for (const [k, t] of Object.entries(PAYOFF_CARD)) clean(t, `card ${k}`);
  for (const [k, t] of Object.entries(PAYOFF_NOW)) clean(t, `now ${k}`);
  for (const [k, by] of Object.entries(JOB_WHERE_PAYOFF)) for (const [id, t] of Object.entries(by)) { assert(jobById(id), `${k}: job ${id}`); clean(t, `where ${k} ${id}`); }
  for (const [id, fn] of Object.entries(FAULT_MANUAL)) clean(fn({ args: { line: 1 } }), `fault ${id}`);
  for (const k of Object.keys(PAYOFFS)) clean(unlockCaption([{ key: k, payoff: true }]), `caption ${k}`);
  for (const b of SKILL_BRANCHES) for (const l of [0, 1, 2]) for (const p of [0, 6, 14]) clean(nextLevelLine(b.id, l, p, 0), `next ${b.id}`);
  const S = perksWorld({ brooding: 1 });
  for (const v of Object.keys(SKILL_VIEWS)) clean(viewLine(v, S.skills), `view ${v}`);
  for (const sec of GUIDE.sections) for (const t of sec.text) clean(fillGuide(t), `guide ${sec.id}`);
  assert(GUIDE.sections.find((s) => s.id === 'skills').text.some((t) => /Equipment/.test(t)), 'the guide\'s Skills section while live');
  for (const it of Object.values(SETTINGS_SCHEMA.automation.items)) clean(it.label, 'automation label');
  const phone = KEY_ACTIONS.find((a) => a.id === 'phone');
  assert(phone && phone.codes[0] === 'KeyR' && createKeys(null).rows('level').some((r) => r.id === 'phone'), 'the phone key on R in the legend while live');
  for (const k of RULE_KEYS) assert(PAYOFFS[k], `rule key ${k} is a payoff`);
}));

test('live false: the phone key is not in the legend nor matched; the guide reads as in Phase 5', () => {
  assert(!SKILLS_UPDATE.live, 'live is false here');
  const k = createKeys(null);
  assert(!k.rows('level').some((r) => r.id === 'phone') && !k.matches({ code: 'KeyR', key: 'r' }, 'phone'), 'no phone without live');
  assert(GUIDE.sections.find((s) => s.id === 'skills').text.length === 2, 'the Phase 5 skills section');
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`ok   ${t.name}`); }
  catch (err) { failed++; console.log(`FAIL ${t.name}\n     ${err.message}`); if (process.env.TRACE) console.log(err.stack); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
