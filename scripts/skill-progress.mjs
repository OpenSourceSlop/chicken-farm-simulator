// Skill progression by profile and flock (SKILLS.md §2.5): generates the pacing table the spec quotes. Package "model".
// MEASURED for both profiles: runCycle plays the whole cycle (plan -> clean-out, seed 1) with SKILLS_UPDATE.live on (the new
// milestones' rules, the two flock slots, the level 3 gate), every award recorded with its farm day; then the SECOND flock is
// played from the first's skill profile (runCycle skillsFrom, cyclesDone 1, perks 'earned': the level 3 equipment of the
// branches it reached runs, the profile meets any fault by hand) and its awards go to flock slot 2.
//   ideal    the ideal farmer (farm-profiles-cycle.js)
//   normal   the careful farmer of §2.4 (the ideal with the slips players make; farm-profiles-cycle.js MODS.normal)
// For each branch it prints: flock-1 points, the day level 2 comes in flock 1, the level at the end of flock 1, when level 3
// comes in flock 2, and how many of the level-3 payoff's job days in flock 2 come after it (the payoff is felt), and whether
// every level of each flock passed.
// Run: node scripts/skill-progress.mjs [--points 4,9,13] [--compare 4,9,15] [--json] [--assert]
// --assert: the targets of §2.5 (scripts/test-skills.mjs runs it in npm test).
import { runCycle } from '../src/farm-profiles-cycle-run.js';
import { SKILL_BRANCHES, SKILLS_UPDATE, PAYOFFS, AUTO_SYSTEMS } from '../src/config.js';
import { EV } from '../src/events.js';
import { jobById } from '../src/content-jobs.js';
import { jobByIdCycle } from '../src/content-jobs-cycle.js';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const parsePts = (s) => (s ? s.split(',').map(Number) : null);
const POINTS = parsePts(opt('--points')) || SKILLS_UPDATE.levelPoints;
const COMPARE = parsePts(opt('--compare'));
const GATE = SKILLS_UPDATE.level3After ?? 1;
const JSON_OUT = argv.includes('--json');

// ---------------- the two flocks of a profile, measured ----------------
function flock(name, opts = {}) {
  const awards = [];
  const t0 = Date.now();
  const trace = runCycle(name, { seed: 1, ...opts, onWorld: (w) => w.events.on(EV.SKILL_POINTS, (p) => {
    if (p.points) awards.push({ branch: p.branch, id: p.milestone, points: p.points, slot: p.slot ?? 0, day: w.env.dayNumber, hour: +(w.env.hour ?? 0).toFixed(2) });
  }) });
  const passed = Object.values(trace.levels).every((v) => v.pass) && Object.keys(trace.levels).length >= 7;
  return { trace, awards: awards.sort((a, b) => a.day - b.day || a.hour - b.hour), passed, ms: Date.now() - t0 };
}
const was = SKILLS_UPDATE.live;
SKILLS_UPDATE.live = true;
const runs = {};
try {
  for (const name of ['ideal', 'normal']) {
    const f1 = flock(name);
    const f2 = flock(name, { skillsFrom: f1.trace.skills.serialize(), cyclesDone: 1, perks: 'earned' });
    runs[name] = { f1, f2 };
  }
} finally { SKILLS_UPDATE.live = was; }

// ---------------- the payoffs' job days (the level-3 one is felt on the job days after it arrives) ----------------
const jobOf = (id) => jobById(id) || jobByIdCycle(id);
const jobDays = (id) => {
  const j = jobOf(id);
  if (!j) return [];
  if (j.onDays) return j.onDays.slice();
  if (j.days) { const o = []; for (let d = j.days[0]; d <= j.days[1]; d++) o.push(d); return o; }
  return j.day != null ? [j.day] : [];
};
const l3Jobs = (branch) => {
  const p = Object.entries(PAYOFFS).find(([, v]) => v.branch === branch && v.level === 3);
  if (!p) return [];
  const [, pay] = p, ids = pay.system ? Object.keys(AUTO_SYSTEMS[pay.system].jobs) : pay.jobs;
  return [...new Set(ids.flatMap(jobDays))].sort((a, b) => a - b);
};

// ---------------- the table ----------------
const at = (a) => (a ? `d${a.day}${a.hour >= 20 ? ' end' : ''}` : '—');
function table(run, pts) {
  const out = {};
  for (const b of SKILL_BRANCHES) {
    const one = run.f1.awards.filter((a) => a.branch === b.id), two = run.f2.awards.filter((a) => a.branch === b.id);
    const p1 = one.reduce((s, a) => s + a.points, 0), p2 = two.reduce((s, a) => s + a.points, 0);
    let sum = 0, l2 = null;
    for (const a of one) { sum += a.points; if (!l2 && sum >= pts[1]) l2 = a; }
    const endL = pts.filter((n) => p1 >= n).length, endLevel = GATE >= 1 ? Math.min(2, endL) : endL;
    let l3 = null;
    if (p1 >= pts[2]) l3 = 'flock 2 start';
    else { let s2 = p1; for (const a of two) { s2 += a.points; if (s2 >= pts[2]) { l3 = a; break; } } }
    const jd = l3Jobs(b.id), felt = l3 === 'flock 2 start' ? jd.length : l3 ? jd.filter((d) => d > l3.day).length : 0;
    out[b.id] = { p1, p2, l2: l2 ? { day: l2.day, hour: l2.hour, by: l2.id } : null, endLevel, l3: l3 === 'flock 2 start' ? l3 : l3 ? { day: l3.day, hour: l3.hour, by: l3.id } : null, jobDays: jd.length, felt };
  }
  return out;
}
function print(name, run, t, pts) {
  console.log(`\n${name} · thresholds ${pts.join(' / ')} · level 3 after ${GATE} finished flock${GATE === 1 ? '' : 's'} · flock 1 ${run.f1.passed ? 'every level passed' : 'A LEVEL FAILED'}, flock 2 ${run.f2.passed ? 'every level passed' : 'A LEVEL FAILED'}`);
  console.log('branch'.padEnd(13), 'flock1', 'flock2', 'L2 in flock 1'.padEnd(24), 'end', 'L3 in flock 2'.padEnd(24), 'L3 jobs felt in flock 2');
  for (const b of SKILL_BRANCHES) {
    const x = t[b.id];
    const l2 = x.l2 ? `${at(x.l2)} (${x.l2.by})` : 'not in flock 1';
    const l3 = x.l3 === 'flock 2 start' ? 'flock 2 start' : x.l3 ? `${at(x.l3)} (${x.l3.by})` : 'not in flock 2';
    console.log(b.id.padEnd(13), String(x.p1).padStart(6), String(x.p2).padStart(6), l2.padEnd(24), ` L${x.endLevel}`, l3.padEnd(24), `${x.felt} of ${x.jobDays} job days`);
  }
}
const ideal = table(runs.ideal, POINTS), norm = table(runs.normal, POINTS);
if (JSON_OUT) {
  console.log(JSON.stringify({ points: POINTS, gate: GATE, passed: { ideal: [runs.ideal.f1.passed, runs.ideal.f2.passed], normal: [runs.normal.f1.passed, runs.normal.f2.passed] }, ideal, normal: norm }, null, 1));
} else {
  console.log(`measured: runCycle ideal and normal, flock 1 and flock 2 (${['ideal', 'normal'].map((n) => `${n} ${runs[n].f1.ms + runs[n].f2.ms} ms`).join(', ')})`);
  print('ideal', runs.ideal, ideal, POINTS);
  print('normal', runs.normal, norm, POINTS);
  if (COMPARE) { print('ideal', runs.ideal, table(runs.ideal, COMPARE), COMPARE); print('normal', runs.normal, table(runs.normal, COMPARE), COMPARE); }
}

// ---------------- the targets of SKILLS.md §2.5 ----------------
export const fails = [];
if (argv.includes('--assert')) {
  const ids = SKILL_BRANCHES.map((b) => b.id);
  const want = (ok, what) => { if (!ok) fails.push(what); };
  want(runs.ideal.f1.passed && runs.ideal.f2.passed, 'ideal: every level passed in both flocks');
  want(runs.normal.f1.passed && runs.normal.f2.passed, 'normal: every level passed in both flocks');
  want(ids.every((b) => ideal[b].endLevel === 2), 'ideal: every branch at level 2 after flock 1 (and none at 3: the gate)');
  want(ids.every((b) => ideal[b].l3 === 'flock 2 start'), 'ideal: every branch at level 3 from the start of flock 2');
  want(ids.filter((b) => norm[b].endLevel === 2).length >= 10, 'normal: at least 10 branches at level 2 after flock 1');
  want(['ventilation', 'growth', 'water', 'feed', 'brooding', 'biosecurity'].every((b) => norm[b].l2 && norm[b].l2.day <= 29), 'normal: the priority branches at level 2 by day 29 of flock 1');
  want(ids.filter((b) => norm[b].l3 === 'flock 2 start').length >= 9, 'normal: at least 9 branches at level 3 from the start of flock 2');
  want(ids.every((b) => norm[b].l3 && (norm[b].l3 === 'flock 2 start' || norm[b].l3.day <= 14)), 'normal: every branch at level 3 by day 14 of flock 2');
  want(ids.every((b) => norm[b].felt >= Math.ceil(norm[b].jobDays / 2)), 'normal: every level-3 payoff felt on at least half its job days in flock 2');
  if (!JSON_OUT) console.log(fails.length ? `\nFAIL ${fails.join('; ')}` : '\n§2.5 targets: all met');
  if (import.meta.url === `file://${process.argv[1]}`) process.exit(fails.length ? 1 : 0);
}
