// The time budgets, run alone (PHASE4.md §9.5): `npm run perf`. npm test leaves them out because a run that shares the
// 4 CPUs with Chromium or another package's tests fails them by chance (a 24 h skip once took 480 ms beside Chromium,
// 72 ms alone). Each budget is measured three times and the best counts; the calibration loop's time is printed with
// them so a slow machine shows as slow. Owner: integrator (the sim package adds the conditions' cycles, §12.1).
//   node scripts/test-perf.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { runCycle } from '../src/farm-profiles-cycle.js';
import { LEVELS, LEVEL1 } from '../src/config.js';
import { applyRound } from '../src/farm-profiles.js';

let failed = 0;
const best = (n, fn) => { let b = Infinity; for (let i = 0; i < n; i++) { const t = performance.now(); fn(); b = Math.min(b, performance.now() - t); } return b; };
const check = (name, ms, max) => { const ok = ms <= max; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${ms.toFixed(1)} ms (budget ${max})`); };
const calib = best(3, () => { let x = 0; for (let i = 0; i < 2e7; i++) x += Math.sqrt(i); return x; });
console.log(`calibration loop ${calib.toFixed(0)} ms (about 25-40 ms on the dev machine alone)`);

// Phase 2: the brooding week (scripts/test-sim.mjs keeps its own check)
{
  const w = makeWorld(); w.farm.start(LEVEL1, { seed: 1 });
  applyRound(w.farm, w.env, -1, 'prep'); w.env.skipHours(25); applyRound(w.farm, w.env, 0, 'am'); applyRound(w.farm, w.env, 0, 'truck'); w.env.skipHours(24);
  check('brooding week: a 24 h skip', best(3, () => w.env.skipHours(24)), 150);
  check('brooding week: farm.step x 200', best(3, () => { for (let i = 0; i < 200; i++) w.farm.step(w.env, 60); }), 60);
}
// Phase 3: the whole cycle, a 24 h skip and farm.step with the whole house in use
{
  check('the whole cycle (-2 -> 67)', best(1, () => runCycle('ideal', { seed: 3 })), 15000);
  const blob = runCycle('ideal', { seed: 1, from: 'plan', to: 'weeks45', keepStarts: true }).starts.weeks45;
  const w = makeWorld(), b = JSON.parse(JSON.stringify(blob));
  w.farm.start(LEVELS[1], { seed: b.farm.seed ?? 1, keepClock: true });
  for (const [k, v] of Object.entries(b.env)) if (!['maxDay', 'curtainForced', 'cycleClimate', 'fansBroken', 'padWorking', 'fanStages', 'broodersUp'].includes(k)) w.env[k] = v;
  w.env.setMaxDay(b.env.maxDay); w.env.setDay(Math.round(b.env.day - b.env.hour / 24)); w.env.setHour(b.env.hour);
  w.farm.restore(b.farm); w.records.restore(b.records); w.skills.restore(b.skills);
  w.env.skipHours(24);
  check('weeks 4-5: a 24 h skip', best(3, () => w.env.skipHours(24)), 200);
  check('weeks 4-5: farm.step x 300', best(3, () => { for (let i = 0; i < 300; i++) w.farm.step(w.env, 60); }), 150);
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
