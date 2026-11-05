// The skills update's points (SKILLS.md §2, §11, §13.1; package "model"): the two flock slots (a replay raises its slot
// only, a third flock slot 2 only, a v1 profile restores as slot 1, mergeProfiles per slot), the thresholds and the level 3
// gate while live, skills.restore refreshing the perks, the seven new milestones on the ideal and on their mistakes, and
// skill-progress --assert (§2.5) on the measured runCycle('normal'). With SKILLS_UPDATE.live false nothing changes.
//   node scripts/test-skills.mjs            (part of npm test once the model package merges)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSkills } from '../src/skills.js';
import { createPerks } from '../src/perks.js';
import { createEvents, EV } from '../src/events.js';
import { SKILLS_UPDATE, SKILL_BRANCHES, weightAt } from '../src/config.js';
import { mergeProfiles } from '../src/save-slots.js';
import { MILESTONES_PAYOFF } from '../src/skills-payoff.js';
import { RULES_PAYOFF, weighDayDone, sampleNeed } from '../src/skills-rules-payoff.js';
import { RULES } from '../src/skills-rules.js';
import { RULES_CYCLE } from '../src/skills-rules-cycle.js';
import { RULES_COND } from '../src/skills-rules-cond.js';
import { weighInBird } from '../src/farm-flock.js';
import { runCycle } from '../src/farm-profiles-cycle-run.js';
import { cycleProfileOf } from '../src/farm-profiles-cycle.js';

let failed = 0;
async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const t0 = Date.now();
  const was = SKILLS_UPDATE.live;
  try { await fn(); console.log(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); if (process.env.TRACE) console.log(err.stack); } finally { SKILLS_UPDATE.live = was; }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|failed to/i;
const live = (on) => { SKILLS_UPDATE.live = on; };
const fresh = () => { const bus = createEvents(); const farm = { mode: 'level', condition: null }; return { bus, farm, skills: createSkills({ events: bus, farm }) }; };

await test('two flock slots: a replay raises its slot only; a later flock awards slot 2; a third flock slot 2 only; EV.SKILL_POINTS carries the slot', () => {
  live(true);
  const { bus, skills } = fresh(), ev = [];
  bus.on(EV.SKILL_POINTS, (p) => ev.push(p));
  assert(skills.award('day7-weight', 0) && skills.points('brooding') === 1, 'first flock tier 0: 1 point');
  assert(skills.award('day7-weight', 1) && skills.points('brooding') === 3 && ev.at(-1).points === 2 && ev.at(-1).slot === 0, 'a replay lifts slot 1 to tier 1 (+2)');
  assert(!skills.award('day7-weight', 0), 'a lower tier in the same slot does nothing');
  skills.setProfile({ cyclesDone: 1 });
  assert(skills.award('day7-weight', 0) && ev.at(-1).slot === 1 && ev.at(-1).points === 1 && skills.points('brooding') === 4, 'the second flock: slot 2 tier 0 (+1, 4 in all)');
  skills.setProfile({ cyclesDone: 2 });
  assert(skills.award('day7-weight', 1) && skills.points('brooding') === 6, 'a third flock raises slot 2 only');
  assert(!skills.award('day7-weight', 1), 'slot 2 already at tier 1');
  const m = skills.milestones('brooding').find((x) => x.id === 'day7-weight');
  assert(m.tiers2.join() === '1,1' && m.points2.join() === '3,3' && m.points === 6 && m.tier === 1, `milestones(): ${JSON.stringify({ t: m.tiers2, p: m.points2, pts: m.points })}`);
  assert(skills.points('brooding', { slot: 0 }) === 3 && skills.points('brooding', { slot: 1 }) === 3, 'points by slot');
});

await test('serialize v2 and restore; a v1 profile restores into slot 1; with live off the profile is Phase 5\'s v1', () => {
  live(true);
  const a = fresh();
  a.skills.award('flushed-on-time', 0); a.skills.setProfile({ cyclesDone: 1 }); a.skills.award('flushed-on-time', 0);
  const s = a.skills.serialize();
  assert(s.v === 2 && s.flocks.find((x) => x[0] === 'flushed-on-time').slice(1).join() === '0,0' && s.earned.find((x) => x[0] === 'flushed-on-time')[1] === 0, `v2: ${JSON.stringify(s)}`);
  const b = fresh(); b.skills.restore(s);
  assert(b.skills.points('water') === 4 && b.skills.profile.cyclesDone === 1, `v2 round trip: ${b.skills.points('water')}`);
  const c = fresh(); c.skills.restore({ v: 1, earned: [['flushed-on-time', 0], ['day7-weight', 1]], cyclesDone: 1 });
  assert(c.skills.points('water') === 2 && c.skills.points('water', { slot: 1 }) === 0 && c.skills.points('brooding') === 3, 'a v1 profile is slot 1');
  live(false);
  const d = fresh(); d.skills.award('day7-weight', 1); d.skills.setProfile({ cyclesDone: 1 }); d.skills.award('day7-weight', 1);
  const s1 = d.skills.serialize();
  assert(s1.v === 1 && !('flocks' in s1) && d.skills.points('brooding') === 3, `live off: Phase 5 (one tier per profile): ${JSON.stringify(s1)}`);
});

await test('mergeProfiles keeps the higher tier per slot (a v1 side is its slot 1)', () => {
  const a = { skills: { v: 2, earned: [['day7-weight', 1]], flocks: [['day7-weight', 1, null]] }, cyclesDone: 1 };
  const b = { skills: { v: 2, earned: [['day7-weight', 0], ['flushed-on-time', 0]], flocks: [['day7-weight', 0, 0], ['flushed-on-time', null, 0]] }, cyclesDone: 2 };
  const m = mergeProfiles(a, b), f = new Map(m.skills.flocks.map(([k, x, y]) => [k, [x, y]]));
  assert(m.skills.v === 2 && f.get('day7-weight').join() === '1,0' && f.get('flushed-on-time').join() === ',0' && m.cyclesDone === 2, `merged: ${JSON.stringify(m.skills)}`);
  const v1 = mergeProfiles({ skills: { v: 1, earned: [['day7-weight', 0]] } }, { skills: { v: 1, earned: [['day7-weight', 1]] } });
  assert(!v1.skills.flocks && new Map(v1.skills.earned).get('day7-weight') === 1, 'two v1 profiles merge as Phase 5');
});

await test('the thresholds and the level 3 gate while live: a first flock never at level 3; cycleDone opens it with EV.SKILL_UNLOCK gate', () => {
  live(true);
  const { bus, skills } = fresh(), un = [];
  bus.on(EV.SKILL_UNLOCK, (p) => un.push(p));
  for (const id of ['flushed-on-time', 'nipples-day0', 'flow-matched', 'drop-spotted', 'leak-fixed', 'meter-daily', 'raised-with-flock', 'ratio-steady', 'flow-w2', 'flow-w3', 'raised-w2', 'raised-w3', 'flow-w45']) skills.award(id, 0);
  assert(skills.points('water') >= SKILLS_UPDATE.levelPoints[2] && skills.level('water') === 2, `13+ points in a first flock: level ${skills.level('water')} (${skills.points('water')})`);
  assert(!un.some((p) => p.key === 'autoWinch'), 'no level 3 payoff unlocked in the first flock');
  skills.cycleDone();
  assert(skills.level('water') === 3 && un.some((p) => p.key === 'autoWinch' && p.payoff && p.gate), `cycleDone: level ${skills.level('water')}, ${JSON.stringify(un.filter((p) => p.gate))}`);
  live(false);
  assert(skills.levelPoints().join() === '4,9,15', 'live off: Phase 5 thresholds');
});

await test('skills.restore refreshes the perks: a restored profile at level 3 turns the payoff on (EV.PERKS)', () => {
  live(true);
  const { bus, skills } = fresh(), perks = createPerks({ skills, events: bus, allowed: true }), seen = [];
  bus.on(EV.PERKS, (p) => seen.push(p));
  assert(!perks.has('autoWinch'), 'nothing yet');
  const earned = [['flushed-on-time', 0], ['nipples-day0', 0], ['flow-matched', 0], ['drop-spotted', 0], ['leak-fixed', 0], ['meter-daily', 0], ['raised-with-flock', 0], ['ratio-steady', 0], ['flow-w2', 0], ['flow-w3', 0], ['raised-w2', 0], ['raised-w3', 0], ['flow-w45', 0]];
  skills.restore({ v: 1, earned, cyclesDone: 1 });
  assert(perks.has('autoWinch') && perks.auto('winch') && seen.some((p) => p.keys.includes('autoWinch')), `after restore: ${JSON.stringify(seen)}`);
});

await test('the seven new milestones: texts verdict-free; the rules\' tiers on the measured cases (night air, fans, heat deaths, dark, dead rounds, day 28, records)', () => {
  for (const m of MILESTONES_PAYOFF) assert(RULES_PAYOFF[m.id] && !VERDICT.test(m.text), `${m.id}: a rule and a plain text`);
  const daily = {}; for (let d = 15; d <= 21; d++) daily[d] = { nightH: 6, nightOk: d !== 18 };
  const farm = { stats: { daily, weighed: [], levelStart: { alive: 5600, heat: 2 } }, flock: { deadByCause: { heat: 7 } } };
  assert(RULES_PAYOFF['night-air-w3'](farm).tier === 0, 'night air on 6 of 7: tier 0');
  daily[18].nightOk = true; assert(RULES_PAYOFF['night-air-w3'](farm).tier === 1, 'all 7: tier 1');
  assert(RULES_PAYOFF['heat-deaths-fin'](farm).tier === 0, '5 heat deaths of 5,600: 0.09 % (tier 0)');
  farm.flock.deadByCause.heat = 9; assert(RULES_PAYOFF['heat-deaths-fin'](farm).tier == null, '7 of 5,600: 0.125 %, not earned');
  for (const d of [36, 37, 38, 39, 40]) daily[d] = { am: { dark: d === 37 ? 1 : 4 } };
  assert(RULES_PAYOFF['dark-fin'](farm).tier === 0, 'dark on 4 of 5 days');
  daily[38].am.dark = 2; assert(RULES_PAYOFF['dark-fin'](farm).tier == null, 'dark on 3 of 5: not earned');
  const recs = (missedIds = {}, signed = new Set()) => ({ notebook: [], jobLog: [], extrasOf: () => Object.fromEntries(Object.entries(missedIds).map(([d, ids]) => [d, { missedIds: ids }])), row: (d) => (signed.has(d) ? { signed: true } : null) });
  assert(RULES_PAYOFF['dead-fin'](farm, recs()).tier === 0 && RULES_PAYOFF['dead-fin'](farm, recs({ 39: ['r-dead-pm'] })).tier == null, 'dead-fin: a missed round in days 36-41 costs it');
  const all = new Set(); for (let d = 8; d <= 21; d++) all.add(d);
  assert(RULES_PAYOFF['records-w23'](farm, recs({}, all)).tier === 0, 'records signed on 14 of 14');
  all.delete(12); assert(RULES_PAYOFF['records-w23'](farm, recs({}, all)).tier == null, '13 of 14: not earned');
  const w = (g, n = 50) => Array.from({ length: n }, () => ({ t: 28.4, weightG: g }));
  farm.stats.weighed = w(1650); assert(RULES_PAYOFF['w28-weight'](farm).tier === 1, '1,650 g: over 103 % (tier 1)');
  farm.stats.weighed = []; assert(RULES_PAYOFF['w28-weight'](farm) === null, 'no weighing on day 28: nothing to measure');
  farm.stats.scaleReads = { 28: { n: 320, meanG: Math.round(weightAt(28)), fouled: false } }; assert(RULES_PAYOFF['w28-weight'](farm).tier === 0, 'Growth 3: a clean scale read of 320 weighings counts');
  farm.stats.scaleReads[28].fouled = true; assert(RULES_PAYOFF['w28-weight'](farm) === null, 'a fouled scale is never read');
});

await test('the farmer\'s choice: the milestones follow Growth 2\'s 25 birds and Brooding 2\'s 3 vent chicks (farm.stats.samples), the boards\' standard without', () => {
  const H = 1 / 24, tip = 0.35;
  const vent = (n, inBand = n) => Array.from({ length: n }, (_, i) => ({ t: tip + 2.5 * H, sector: i % 3, tempC: i < inBand ? 40 : 38.9 }));
  const farm = { stats: { firstTipAt: tip, ventReadings: vent(3), weighed: [] } };
  assert(sampleNeed(farm, 'sample.vent', 0).n === 5 && RULES['vent-checked'](farm).tier == null, 'no smaller sample: 3 vent chicks fall short of the 5');
  farm.stats.samples = { 'sample.vent': { 0: { n: 3, sectors: 3 } }, 'sample.weigh': { 14: { n: 25, sectors: 3 } } };
  assert(RULES['vent-checked'](farm).tier === 0, 'Brooding 2: 3 vent chicks from 3 parts earn vent-checked');
  farm.stats.ventReadings = vent(3, 2);
  assert(RULES_CYCLE['vent-band'](farm).tier === 0 && /2 of the first 3/.test(RULES_CYCLE['vent-band'](farm).detail), 'vent-band: 2 of the first 3 in band (all but one)');
  farm.stats.ventReadings = vent(3, 1);
  assert(RULES_CYCLE['vent-band'](farm).tier == null, 'vent-band: 1 of 3 is not');
  const wd = (d, n) => Array.from({ length: n }, () => ({ t: d + 0.4, weightG: 480 }));
  farm.stats.weighed = wd(14, 25);
  assert(weighDayDone(farm, 14) && !weighDayDone({ stats: { weighed: wd(21, 25) } }, 21), 'weighed-weekly: 25 birds count on a Growth 2 day, not on a day of the standard 50');
  // the uniformity from 25 birds (the hand weighing's stratified draw): within a few points of the flock's own
  const fl = { cohorts: { good: { n: 5600, w: 480, cv: 0.1 }, late: { n: 0, w: 400, cv: 0.1 }, weak: { n: 0, w: 300, cv: 0.1 } }, placed: 5600, alive: 5600 };
  let k = 0; const rng = { next: () => ((k = (k * 9301 + 49297) % 233280) / 233280) };
  const ws = Array.from({ length: 25 }, (_, i) => weighInBird(fl, rng, i, 0.3));
  const m = ws.reduce((a, b) => a + b, 0) / 25, u = (100 * ws.filter((x) => Math.abs(x - m) <= 0.1 * m).length) / 25;
  assert(Math.abs(m - 480) < 20 && u >= 60 && u <= 80, `25 birds: mean ${m.toFixed(0)} g, uniformity ${u.toFixed(0)} % (a cv 10 % flock: about 68 %)`);
});

await test('a bad batch\'s crop48 follows Brooding 2\'s 6 crops (farm.stats.samples), the boards\' 10 without', () => {
  const crops = (n, full = n) => ({ notebook: Array.from({ length: n }, (_, i) => ({ kind: 'crop', day: 2, hour: 9 + i * 0.05, value: { crop: i < full ? 'full-soft' : 'empty' } })) });
  const farm = { stats: {} };
  assert(sampleNeed(farm, 'sample.crop', 2).n === 10 && RULES_COND.crop48(farm, crops(6)) === null, 'no smaller sample: 6 crops fall short of the 10 (nothing to measure)');
  assert(RULES_COND.crop48(farm, crops(10)).tier === 0, 'the standard: 10 crops all full earn it');
  farm.stats.samples = { 'sample.crop': { 2: { n: 6, sectors: 3 } } };
  const r = RULES_COND.crop48(farm, crops(6));
  assert(r && r.tier === 0 && /100 %/.test(r.detail), `Brooding 2: 6 crops all full earn crop48 (${JSON.stringify(r)})`);
  assert(RULES_COND.crop48(farm, crops(6, 5)).tier == null, 'Brooding 2: 5 of 6 full (83 %) is under the 90 %');
  assert(RULES_COND.crop48(farm, crops(5)) === null, 'Brooding 2: 5 crops are not yet the 6');
  farm.stats.samples = { 'sample.crop': { 1: { n: 6, sectors: 3 } } };
  assert(RULES_COND.crop48(farm, crops(6)) === null, 'a smaller sample on day 1 (d1-crop) does not change day 2\'s');
});

await test('the ideal earns every new milestone; noDark misses dark-fin, no day 28 weigh-in misses w28-weight, no afternoon fans read in week 3 misses fans-w3', () => {
  live(true);
  const ideal = runCycle('ideal'), got = (r, id) => { const m = MILESTONES_PAYOFF.find((x) => x.id === id); return r.skills.milestones(m.branch).find((x) => x.id === id).tier; };
  const want = { 'night-air-w3': 1, 'fans-w3': 1, 'heat-deaths-fin': 0, 'dark-fin': 0, 'dead-fin': 0, 'w28-weight': 1, 'records-w23': 0 };
  for (const [id, t] of Object.entries(want)) assert(got(ideal, id) === t, `ideal ${id}: tier ${got(ideal, id)}, want ${t}`);
  assert(SKILL_BRANCHES.every((b) => ideal.skills.level(b.id) === 2), 'ideal: every branch at level 2 after flock 1 (the gate)');
  const noDark = runCycle('noDark', { to: 'finish' });
  assert(noDark.levels.finish && got(noDark, 'dark-fin') == null, `noDark: dark-fin ${got(noDark, 'dark-fin')}`);
  const skip28 = runCycle({ ...cycleProfileOf('ideal'), weighN: { 28: 0 }, name: 'skip28' }, { from: 'weeks45', to: 'weeks45' });
  assert(got(skip28, 'w28-weight') == null && skip28.levels.weeks45.pass, `day 28 weigh-in skipped: w28-weight ${got(skip28, 'w28-weight')}`);
  const noFans = runCycle({ ...cycleProfileOf('ideal'), noFansRead: [15, 21], name: 'noFans' }, { from: 'week3', to: 'week3' });
  assert(got(noFans, 'fans-w3') == null, `no fans read on days 15-21: fans-w3 ${got(noFans, 'fans-w3')}`);
});

await test('skill-progress --assert: §2.5 met on the measured runCycle(\'normal\') and the ideal (both flocks, every level passed)', () => {
  const script = fileURLToPath(new URL('./skill-progress.mjs', import.meta.url));
  let out = '';
  try { out = execFileSync(process.execPath, [script, '--assert'], { encoding: 'utf8', timeout: 300000 }); } catch (err) { throw new Error(`skill-progress failed: ${(err.stdout || '').split('\n').filter((l) => /FAIL|LEVEL FAILED/.test(l)).join(' ') || err.message}`); }
  assert(/§2\.5 targets: all met/.test(out), 'the targets line');
  console.log(out.split('\n').filter((l) => /^normal|^ideal ·|^(planning|growth|ventilation|heating) /.test(l)).map((l) => `     ${l}`).join('\n'));
});

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
