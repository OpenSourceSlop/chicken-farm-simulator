// Milestones of the Phase 4 conditions (PHASE4.md §7) — contract data committed by the Phase 4 design. Owner:
// package "sim" (it writes the measured rules in a new skills-rules-cond.js and may reword texts and rule notes,
// never ids, branches, levels, conditions or checkpoints without the integrator). Same shape as skills-cycle.js
// MILESTONES_CYCLE plus `condition`: evaluated only in a run of that condition (ctx.condition, the run's). They add
// points to the eleven branches (a milestone is a result of play, kept per profile, only ever raised); no new
// unlocks: each branch level already unlocks a tool or view (config UNLOCKS). Until skills.js merges these into
// ALL_MILESTONES (sim, PHASE4.md §10.5) nothing here is awarded.
// needsProblem (also on the Phase 2 / 3 milestones, skills.js / skills-cycle.js): the problem whose outcome the milestone
// measures; skills.evaluate skips the milestone where the level as the condition plays it (config conditionLevel) has no
// such problem (a milestone with checkpoint 'heatwave' needs 'heat-wave'), so a dropped problem earns nothing and costs
// nothing; scripts/test-contracts.mjs checks every branch can still reach level 2 in every condition.
const M = (id, condition, branch, level, checkpoint, text, tiers, needs = []) => ({ id, condition, branch, level, checkpoint, text, tiers: tiers.map(([points, rule]) => ({ points, rule })), needs });

export const MILESTONES_COND = [
  // ---------------- the hot season ----------------
  M('hot-brood-air', 'hot', 'comfort', 'level1', 'level-end', 'Hot afternoons of the brooding week with the chicks near their row',
    [[2, 'days 1-7, 14:00-18:00: the chicks within -1.5..+1.5 °C of the row (farm.comfort.e) for >= 75 % of the hours (the pad with one fan: 100 %, tuning-refs-cond hot-brood-pad1)']]),
  M('hot-nights', 'hot', 'comfort', 'weeks45', 'level-end', 'Panting in the evenings and nights of weeks 4–5',
    [[2, 'panting bird-hours per bird 18:00-06:00, days 22-35: 15 or fewer'], [3, '8 or fewer']]),
  M('hot-wave', 'hot', 'ventilation', 'weeks45', 'heatwave', 'Heat deaths in the hot season’s heat wave',
    [[2, 'heat deaths days 30-32 <= 0.1 % of the birds'], [3, '<= 0.03 %']]),
  M('cool-water', 'hot', 'water', 'finish', 'level-end', 'Warm water flushed out of the lines in the early afternoon',
    [[1, 'h-flush done on 8 or more of its 10 days (even days 22-40)']]),
  // ---------------- the rainy season ----------------
  M('gen-tested', 'rainy', 'ventilation', 'weeks45', 'level-end', 'Generator test-run every week',
    [[1, 'gen.test with ok on each of days 8, 15, 22, 29 (rn-gen-test)']]),
  // the clock runs at 'carry' speed while the house is dark (config GENERATOR.clockWhileDark): from the fan panel the
  // walk, the 2-minute start and the switch take about 9-11 farm minutes, from the controller by the door about 5
  M('gen-fast', 'rainy', 'ventilation', 'weeks45', 'problem', 'Minutes from the power cut to the fans turning again',
    [[2, 'farm.power.on again within 15 farm minutes of the cut'], [3, 'within 8']]),
  M('storm-flaps', 'rainy', 'moisture', 'weeks45', 'level-end', 'Storm flaps closed through the storms',
    [[2, 'inlets.storm closed for >= 90 % of the storm hours of days 22-35']]),
  M('rain-litter', 'rainy', 'moisture', 'finish', 'harvest', 'Litter moisture through the rainy season',
    [[2, 'the farmer’s squeeze readings (r-litter) mean <= 34 % on every day from 22 to 41'], [3, '<= 32 %']]),
  // ---------------- a bad batch of chicks ----------------
  M('weak-graded', 'badChicks', 'brooding', 'level1', 'placed', 'Stacks graded before they were tipped',
    [[2, 'chicks.grade on 4 or more stacks before their chicks.tip'], [3, 'all 6']]),
  M('crop48', 'badChicks', 'brooding', 'level1', 'level-end', 'Crops at 48 hours',
    [[1, 'b-crop48 done with >= 90 % of the crops felt full']]),
  M('hatchery-told', 'badChicks', 'planning', 'level1', 'level-end', 'Chick quality reported to the hatchery on the day they came',
    [[1, 'phone.hatchery on day 0 (the graded-out chicks are claimed)']]),
  M('bad-ratio', 'badChicks', 'growth', 'level1', 'weighin', 'Day 7 weight of a bad batch against its own chick weight',
    [[2, 'day 7 weighed mean >= 4.4 x the measured chick weight'], [3, '>= 4.7 x']]),
  // ---------------- a water problem ----------------
  M('iron-found', 'water', 'water', 'weeks45', 'level-end', 'Each blocked filter found the day it blocked',
    [[2, 'every iron-filter problem (days 12 and 24, before their flow-test mornings) fixed before 24:00 of the day it started']]),
  M('pump-found', 'water', 'water', 'weeks45', 'problem', 'Worn well pump found before the tank ran low',
    [[2, 'pump.fix started before the gauge’s marker first read under 30 % (WATER_TANK.lowPct)']]),
  M('tank-read', 'water', 'water', 'weeks45', 'level-end', 'Water tank and pump gauges read every morning of weeks 4–5',
    [[1, 'w-tank done on every day 22-35']]),
];
export const condMaxPoints = (branch, condition) => MILESTONES_COND.filter((m) => m.branch === branch && (!condition || m.condition === condition))
  .reduce((a, m) => a + Math.max(...m.tiers.map((t) => t.points)), 0);
