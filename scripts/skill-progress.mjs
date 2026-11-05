// Skill progression by profile and flock (SKILLS.md §2.5). Design-round baseline: one flock of each profile through the
// whole cycle (plan -> clean-out), the points of each branch and the level each reaches by the end of each level, with the
// thresholds of the switch as it is (config SKILLS_UPDATE.live) and as it will be (live). Package "model" turns it into the
// acceptance test of §2.5: `normal` (§2.4), two flocks on one skills object (cyclesDone raised between them, the two-flock
// counting), the asserts, and `--json` for the table it records in SKILLS.md. Not in npm test until then.
// Run: node scripts/skill-progress.mjs [profile ...]   (default: ideal)
import { runCycle } from '../src/farm-profiles-cycle-run.js';
import { SKILL_BRANCHES, LEVELS, SKILL_LEVEL_POINTS, SKILLS_UPDATE } from '../src/config.js';

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ORDER = LEVELS.map((l) => l.id);
const levelOf = (pts, need) => need.filter((n) => pts >= n).length;

for (const name of names.length ? names : ['ideal']) {
  const t0 = Date.now();
  const r = runCycle(name, { seed: 1 });
  const pass = Object.fromEntries(Object.entries(r.levels).map(([k, v]) => [k, v.pass]));
  console.log(`\n${name}: ${Object.values(pass).every(Boolean) ? 'every level passed' : `levels ${JSON.stringify(pass)}`} (${Date.now() - t0} ms)`);
  console.log('branch'.padEnd(13), 'pts', 'L(now)', 'L(live)', ' points by the end of each level');
  for (const b of SKILL_BRANCHES) {
    const ms = r.skills.milestones(b.id).filter((m) => m.tier != null);
    let sum = 0;
    const by = ORDER.map((lv) => { sum += ms.filter((m) => m.level === lv).reduce((a, m) => a + m.points, 0); return `${lv} ${sum}`; });
    const p = r.points[b.id];
    console.log(b.id.padEnd(13), String(p).padStart(3), `  L${levelOf(p, SKILL_LEVEL_POINTS)}    L${levelOf(p, SKILLS_UPDATE.levelPoints)}    `, by.join(' · '));
  }
}
