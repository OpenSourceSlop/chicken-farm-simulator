// Skill progression by profile and flock (SKILLS.md §2.5): generates the pacing table the spec quotes. Revised after the
// design review: the ideal is MEASURED (runCycle, seed 1, plan -> clean-out: every award with its farm day); the normal is
// the ESTIMATE of §2.4 (the ideal's awards minus the slips of the table) until package "model" builds runCycle('normal'),
// which then replaces it; the milestones of SKILLS.md §2.3 that no rule awards yet (src/skills-payoff.js) are added at their
// designed tiers and checkpoint days, marked '~'. A second flock earns the same again (slot 2). The level-3 gate (config
// SKILLS_UPDATE.level3After: a finished flock) and the thresholds are applied here exactly as config levelFromPoints does.
// For each branch it prints: flock-1 points, the day level 2 comes in flock 1, the level at the end of flock 1, the day
// level 3 comes in flock 2, and how many of the level-3 payoff's job days in flock 2 come after it (the payoff is felt).
// Run: node scripts/skill-progress.mjs [--points 4,9,13] [--compare 4,9,15] [--json] [--assert]
// Package "model" turns it into the acceptance test of §2.5 (in npm test as test-skills) with runCycle('normal') and the
// rules of the new milestones; the asserts (--assert) are the targets of §2.5.
import { runCycle } from '../src/farm-profiles-cycle-run.js';
import { SKILL_BRANCHES, SKILLS_UPDATE, PAYOFFS, AUTO_SYSTEMS, LEVELS } from '../src/config.js';
import { EV } from '../src/events.js';
import { ALL_MILESTONES } from '../src/skills.js';
import { MILESTONES_PAYOFF } from '../src/skills-payoff.js';
import { jobById } from '../src/content-jobs.js';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const parsePts = (s) => (s ? s.split(',').map(Number) : null);
const POINTS = parsePts(opt('--points')) || SKILLS_UPDATE.levelPoints;
const COMPARE = parsePts(opt('--compare'));
const GATE = SKILLS_UPDATE.level3After ?? 1;

// ---------------- the ideal, measured ----------------
const awards = [];
const t0 = Date.now();
const r = runCycle('ideal', { seed: 1, onWorld: (w) => w.events.on(EV.SKILL_POINTS, (p) => { if (p.points) awards.push({ branch: p.branch, id: p.milestone, points: p.points, day: w.env.dayNumber, hour: +(w.env.hour ?? 0).toFixed(2) }); }) });
const passed = Object.values(r.levels).every((v) => v.pass);
// the checkpoint day of a planned milestone (its level's end, 20:00; a weigh-in at 09:30 of its day)
const levelEnd = Object.fromEntries(LEVELS.map((l) => [l.id, l.endDay]));
const PLANNED = {   // the ideal's designed tier (SKILLS.md §2.3) and checkpoint
  'night-air-w3': { points: 2, day: 21, hour: 20 }, 'fans-w3': { points: 3, day: 21, hour: 20 },
  'heat-deaths-fin': { points: 2, day: levelEnd.finish ?? 42, hour: 20 }, 'dark-fin': { points: 1, day: levelEnd.finish ?? 42, hour: 20 },
  'dead-fin': { points: 1, day: levelEnd.finish ?? 42, hour: 20 }, 'w28-weight': { points: 3, day: 28, hour: 9.5 },
  'records-w23': { points: 2, day: 21, hour: 20 },
};
for (const m of MILESTONES_PAYOFF) {
  if (awards.some((a) => a.id === m.id)) continue;   // a rule awards it already: measured
  const p = PLANNED[m.id];
  if (p) awards.push({ branch: m.branch, id: m.id, ...p, planned: true });
}
awards.sort((a, b) => a.day - b.day || a.hour - b.hour);

// ---------------- the normal: the ideal minus the slips of SKILLS.md §2.4 ----------------
// id -> points the slip costs (day7-weight: tier 1 instead of 3)
const SLIPS = {
  'flow-matched': 2, 'day7-weight': 2, 'vent-checked': 1, 'lux-measured': 1, 'droppings-read': 1, 'air-measured': 1, 'heatwave-ready': 2,
  'dips-w45': 1, 'dead-w45': 1, 'flow-w45': 1, 'catch-booked': 1, 'catch-light': 2, 'heat-feeders': 1, 'last-order': 2, 'weighed-weekly': 2,
};
const normal = awards.map((a) => ({ ...a, points: a.points - Math.min(a.points, SLIPS[a.id] || 0) })).filter((a) => a.points > 0);

// ---------------- the payoffs' job days (the level-3 one is felt on the job days after it arrives) ----------------
const jobDays = (id) => {
  const j = jobById(id);
  if (!j) return [];
  if (j.onDays) return j.onDays.slice();
  if (j.days) { const o = []; for (let d = j.days[0]; d <= j.days[1]; d++) o.push(d); return o; }
  return j.day != null ? [j.day] : [];
};
const l3Jobs = (branch) => {
  const p = Object.entries(PAYOFFS).find(([, v]) => v.branch === branch && v.level === 3);
  if (!p) return [];
  const [key, pay] = p;
  const ids = pay.system ? Object.keys(AUTO_SYSTEMS[pay.system].jobs) : pay.jobs;
  return [...new Set(ids.flatMap(jobDays))].sort((a, b) => a - b).map((d) => ({ d, key }));
};

// ---------------- the table ----------------
const at = (a) => (a ? `d${a.day}${a.hour >= 20 ? ' end' : ''}` : '—');
function table(list, pts) {
  const out = {};
  for (const b of SKILL_BRANCHES) {
    const mine = list.filter((a) => a.branch === b.id);
    const p1 = mine.reduce((s, a) => s + a.points, 0);
    let sum = 0, l2 = null;
    for (const a of mine) { sum += a.points; if (!l2 && sum >= pts[1]) l2 = a; }
    const endL = pts.filter((n) => p1 >= n).length;
    const endLevel = GATE >= 1 ? Math.min(2, endL) : endL;
    let l3 = null, l3Start = false;
    if (p1 >= pts[2]) l3Start = true;
    else { let s2 = p1; for (const a of mine) { s2 += a.points; if (s2 >= pts[2]) { l3 = a; break; } } }
    const jd = l3Jobs(b.id);
    const felt = l3Start ? jd.length : l3 ? jd.filter((x) => x.d > l3.day).length : 0;
    out[b.id] = { p1, l2: l2 ? { day: l2.day, hour: l2.hour, by: l2.id } : null, endLevel, l3: l3Start ? 'flock 2 start' : l3 ? { day: l3.day, hour: l3.hour, by: l3.id } : null,
      jobDays: jd.length, felt, planned: mine.filter((a) => a.planned).reduce((s, a) => s + a.points, 0) };
  }
  return out;
}
function print(name, t, pts) {
  console.log(`\n${name} · thresholds ${pts.join(' / ')} · level 3 after ${GATE} finished flock${GATE === 1 ? '' : 's'}`);
  console.log('branch'.padEnd(13), 'flock1', 'L2 in flock 1'.padEnd(22), 'end', 'L3 in flock 2'.padEnd(22), 'L3 jobs felt in flock 2');
  for (const b of SKILL_BRANCHES) {
    const x = t[b.id];
    const l2 = x.l2 ? `${at(x.l2)} (${x.l2.by})` : 'not in flock 1';
    const l3 = x.l3 === 'flock 2 start' ? 'flock 2 start' : x.l3 ? `${at(x.l3)} (${x.l3.by})` : 'not in flock 2';
    console.log(b.id.padEnd(13), `${String(x.p1).padStart(4)}${x.planned ? '~' : ' '}`, l2.padEnd(22), ` L${x.endLevel}`, l3.padEnd(22), `${x.felt} of ${x.jobDays} job days`);
  }
}
const ideal = table(awards, POINTS), norm = table(normal, POINTS);
if (argv.includes('--json')) {
  console.log(JSON.stringify({ points: POINTS, gate: GATE, ideal, normal: norm }, null, 1));
} else {
  console.log(`ideal: ${passed ? 'every level passed' : 'a level failed'} (${Date.now() - t0} ms); '~' = includes the designed tiers of milestones no rule awards yet`);
  print('ideal (measured)', ideal, POINTS);
  print('normal (estimate: the ideal minus the slips of SKILLS.md §2.4)', norm, POINTS);
  if (COMPARE) { print('ideal (measured)', table(awards, COMPARE), COMPARE); print('normal (estimate)', table(normal, COMPARE), COMPARE); }
}

// ---------------- the targets of SKILLS.md §2.5 ----------------
if (argv.includes('--assert')) {
  const ids = SKILL_BRANCHES.map((b) => b.id);
  const fails = [];
  const want = (ok, what) => { if (!ok) fails.push(what); };
  want(passed, 'ideal: every level passed');
  want(ids.every((b) => ideal[b].endLevel === 2), 'ideal: every branch at level 2 after flock 1 (and none at 3: the gate)');
  want(ids.every((b) => ideal[b].l3 === 'flock 2 start'), 'ideal: every branch at level 3 from the start of flock 2');
  want(ids.filter((b) => norm[b].endLevel === 2).length >= 10, 'normal: at least 10 branches at level 2 after flock 1');
  want(['ventilation', 'growth', 'water', 'feed', 'brooding', 'biosecurity'].every((b) => norm[b].l2 && norm[b].l2.day <= 29), 'normal: the priority branches at level 2 by day 29 of flock 1');
  want(ids.filter((b) => norm[b].l3 === 'flock 2 start').length >= 9, 'normal: at least 9 branches at level 3 from the start of flock 2');
  want(ids.every((b) => norm[b].l3 && (norm[b].l3 === 'flock 2 start' || norm[b].l3.day <= 14)), 'normal: every branch at level 3 by day 14 of flock 2');
  want(ids.every((b) => norm[b].felt >= Math.ceil(norm[b].jobDays / 2)), 'normal: every level-3 payoff felt on at least half its job days in flock 2');
  console.log(fails.length ? `\nFAIL ${fails.join('; ')}` : '\n§2.5 targets: all met');
  process.exit(fails.length ? 1 : 0);
}
