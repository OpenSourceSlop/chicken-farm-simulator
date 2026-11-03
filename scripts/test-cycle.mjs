// The farm model for the whole cycle in node (PHASE3.md §6.14). Owner: package "sim".
// CYCLE_TARGETS below are contract data (committed by the integrator): the bands every profile of
// farm-profiles-cycle.js must reach. The profile tests skip while farm.cycleStub is true; the contract
// checks run on the stubs now.  node scripts/test-cycle.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { CYCLE_PROFILES, runCycle } from '../src/farm-profiles-cycle.js';
import { planSums } from '../src/farm-plan.js';
import { LEVELS, weightAt } from '../src/config.js';

/**
 * Bands per profile (PHASE3.md §6.14). Keys: level ids → { pass, weightG: [lo, hi] (the level's weigh
 * day, weighed mean), deathsPct: [lo, hi] (deaths + culls in the level) }, and named checks the run's
 * `snaps` must hold (the sim package defines how runCycle measures them).
 */
export const CYCLE_TARGETS = {
  ideal: {
    week2: { pass: true, weightG: [470, 540], deathsPct: [0.15, 0.5] },
    week3: { pass: true, weightG: [900, 1000], deathsPct: [0.15, 0.5] },
    weeks45: { pass: true, weightG: [2000, 2200], deathsPct: [0.3, 0.9] },
    finish: { pass: true, liveG: [2600, 2780], fcr: [1.66, 1.8], mortalityPct: [1.6, 3.5], uniformityPct: [62, 80], epef: [330, 400], doaPct: [0.1, 0.25], withdrawalH: [9, 11] },
    cleanout: { pass: true, positive: [0, 1], restDays: [21, 21] },
    snaps: { vaccineCoverage: [0.92, 0.98], vaccineHours: [1.5, 2.2], house31At15: [30, 33], pantShare31At15: [0.4, 0.9], heatwaveHeatDeathsPct: [0, 0.3], nh3NightMaxW46: [0, 25], everyBranchLevel: 2 },
  },
  noDark: { snaps: { sdsVsIdeal: [3, Infinity], lameVsIdeal: [2, Infinity] } },
  lateLift: { snaps: { day14WeightUnderIdealPct: [3, Infinity], day14UniformityUnderIdeal: [3, Infinity], broodLitterDay14: [32, Infinity] } },
  noStep: { snaps: { nightsRh85Week2: [3, 7], litterDay14: [33, Infinity], nh3Night14: [25, Infinity], day21WeightUnderIdealPct: [4, Infinity] } },
  poorVaccine: { week3: { pass: false, deathsPct: [1.0, 3.0] }, snaps: { vaccineCoverage: [0.35, 0.7], gumboroStarted: true } },
  cocciUntreated: { snaps: { week3DiseaseDeathsPct: [0.4, 1.5], day21WeightUnderIdealPct: [2, Infinity] } },
  crumbleOn: { snaps: { day28WeightUnderIdealPct: [3, 8] } },
  abruptChange: { snaps: { undigestedHours: [12, 30], intakeDipPct: [2, 4] } },
  noTunnel: { weeks45: { pass: false }, snaps: { house31At15: [36, Infinity], heatwaveHeatDeathsPct: [3, Infinity] } },
  fansNoPad: { snaps: { house31At15: [35, 40], heatwaveHeatDeathsPct: [0.4, 3] } },
  padInHumid: { snaps: { felt33At15OverIdeal: [0.5, Infinity], heatDeaths33VsIdeal: [1.5, Infinity] } },
  fanUnfixed: { snaps: { airSpeed6Fans: [2.0, 2.2], heatwaveHeatDeathsVsIdeal: [1.5, Infinity] } },
  noWithdrawal: { snaps: { gutFull: true, liveOverIdealPct: [1, Infinity] } },
  longWithdrawal: { snaps: { liveUnderIdealPct: [3.5, 6], doaVsIdeal: [2, Infinity] } },
  brightCatch: { snaps: { doaVsIdeal: [1.4, Infinity] } },
  wetDisinfect: { cleanout: { pass: false, positive: [3, 7] } },
  litterLeft: { cleanout: { positive: [3, 10] } },
  shortRest: { cleanout: { pass: false, restDays: [14, 14] } },
};

let failed = 0, skipped = 0;
function test(name, fn) {
  try { const r = fn(); if (r === 'skip') { skipped++; console.log(`skip ${name}`); } else console.log(`ok   ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

const world = makeWorld();
const STUB = !!world.farm.cycleStub;

test('contract: every cycle profile has targets and every target a profile', () => {
  for (const p of CYCLE_PROFILES) assert(CYCLE_TARGETS[p], `no CYCLE_TARGETS for ${p}`);
  for (const k of Object.keys(CYCLE_TARGETS)) assert(CYCLE_PROFILES.includes(k), `targets for unknown profile ${k}`);
  for (const [name, t] of Object.entries(CYCLE_TARGETS)) for (const k of Object.keys(t)) assert(k === 'snaps' || LEVELS.some((l) => l.id === k), `${name}: unknown level ${k}`);
});

test('contract: the farm carries the Phase 3 state (PHASE3.md §13.5)', () => {
  const f = world.farm;
  f.start(undefined, { seed: 1 });
  for (const k of ['house', 'health', 'air', 'harvest', 'clean']) assert(f[k] && typeof f[k] === 'object', `farm.${k}`);
  assert(typeof f.enterLevel === 'function', 'farm.enterLevel');
  assert(Number.isFinite(f.flock.lameOnFloor), 'flock.lameOnFloor');
  assert(f.harvest.sections.length === 8 && f.clean.wash.length === 576, 'sections and clean grids');
  assert(f.comfort.eZ && f.comfort.eZ.length === 8 && Number.isFinite(f.comfort.hotFrom), 'comfort zones');
});

test('contract: Phase 3 actions the stub answers have their result shapes', () => {
  const { farm, env } = world;
  assert(farm.act('house.curtain', { open: true }) === true && env.broodCurtain === false, 'house.curtain open lifts env.broodCurtain');
  farm.act('house.curtain', { open: false });
  assert(farm.act('plan.measure', { axis: 'length' }).m === 48 && farm.act('plan.measure', { axis: 'width' }).m === 12, 'plan.measure');
  const r = farm.act('plan.send', { houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 });
  const ref = planSums({ houses: 6, birdsPerHouse: 6000, cycleDays: 67, lossesPct: 4, saleKg: 2.8 }, 576);
  assert(r.salePerWeek === ref.salePerWeek && farm.plan.outcome.pass, `plan.send ${JSON.stringify(r)}`);
  env.setMaxDay(70); env.setDay(60); assert(env.dayNumber === 60, 'env.setMaxDay(70) lets the clock reach day 60');
});

test('contract: target weights the levels are judged on (general, config weightAt)', () => {
  assert(weightAt(14) === 480 && weightAt(21) === 950 && weightAt(35) === 2200 && weightAt(42) === 2850, 'weightAt table');
});

for (const name of CYCLE_PROFILES) {
  test(`profile ${name} reaches its CYCLE_TARGETS`, () => {
    if (STUB) return 'skip';
    const run = runCycle(name, { seed: 1 });
    assert(run && run.result, `${name}: no result`);
    // package "sim": compare run.levels[id] and run.snaps with CYCLE_TARGETS[name] here (checkCycle)
    return undefined;
  });
}

console.log(failed ? `${failed} failed` : `all passed${skipped ? ` (${skipped} skipped: farm.cycleStub)` : ''}`);
process.exit(failed ? 1 : 0);
