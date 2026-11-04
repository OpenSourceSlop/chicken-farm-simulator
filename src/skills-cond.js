// Milestones of the Phase 4 conditions (PHASE4.md §7) — contract data committed by the Phase 4 design. Owner:
// package "sim" (it writes the measured rules in a new skills-rules-cond.js and may reword texts and rule notes,
// never ids, branches, levels, conditions or checkpoints without the integrator). Same shape as skills-cycle.js
// MILESTONES_CYCLE plus `condition`: evaluated only in a run of that condition (ctx.condition, the run's). They add
// points to the eleven branches (a milestone is a result of play, kept per profile, only ever raised); no new
// unlocks: each branch level already unlocks a tool or view (config UNLOCKS). Until skills.js merges these into
// ALL_MILESTONES (sim, PHASE4.md §10.5) nothing here is awarded.
const M = (id, condition, branch, level, checkpoint, text, tiers, needs = []) => ({ id, condition, branch, level, checkpoint, text, tiers: tiers.map(([points, rule]) => ({ points, rule })), needs });

export const MILESTONES_COND = [
  // ---------------- the hot season ----------------
  M('hot-brood-air', 'hot', 'comfort', 'level1', 'level-end', 'Hot afternoons of the brooding week with the chicks near their target',
    [[2, 'days 1-7, 13:00-18:00: the chicks within -1.5..+2 °C of the target (groupShare) for >= 80 % of the hours']]),
  M('hot-nights', 'hot', 'comfort', 'weeks45', 'level-end', 'Panting in the evenings and nights of weeks 4–5',
    [[2, 'panting bird-hours per bird 18:00-06:00, days 22-35: 15 or fewer'], [3, '8 or fewer']]),
  M('hot-wave', 'hot', 'ventilation', 'weeks45', 'heatwave', 'Heat deaths in the hot season’s heat wave',
    [[2, 'heat deaths days 30-32 <= 0.1 % of the birds'], [3, '<= 0.03 %']]),
  M('cool-water', 'hot', 'water', 'finish', 'level-end', 'Warm water flushed out of the lines at midday',
    [[1, 'h-flush done on 12 or more of days 22-41']]),
  // ---------------- the rainy season ----------------
  M('gen-tested', 'rainy', 'ventilation', 'weeks45', 'level-end', 'Generator test-run every week',
    [[1, 'gen.test with ok on each of days 8, 15, 22, 29 (rn-gen-test)']]),
  M('gen-fast', 'rainy', 'ventilation', 'weeks45', 'problem', 'Minutes from the power cut to the fans turning again',
    [[2, 'farm.power.on again within 20 farm minutes of the cut'], [3, 'within 10']]),
  M('storm-flaps', 'rainy', 'moisture', 'weeks45', 'level-end', 'Storm flaps closed through the storms',
    [[2, 'inlets.storm closed for >= 90 % of the storm hours of days 22-35']]),
  M('rain-litter', 'rainy', 'moisture', 'finish', 'harvest', 'Litter moisture through the rainy season',
    [[2, 'the farmer’s squeeze readings (r-litter) mean <= 32 % on every day from 22 to 41'], [3, '<= 30 %']]),
  // ---------------- a bad batch of chicks ----------------
  M('weak-graded', 'badChicks', 'brooding', 'level1', 'placed', 'Stacks graded before they were tipped',
    [[2, 'chicks.grade on 4 or more stacks before their chicks.tip'], [3, 'all 6']]),
  M('crop48', 'badChicks', 'brooding', 'level1', 'level-end', 'Crops at 48 hours',
    [[1, 'b-crop48 done with >= 90 % of the crops felt full']]),
  M('hatchery-told', 'badChicks', 'planning', 'level1', 'level-end', 'Chick quality reported to the hatchery on the day they came',
    [[1, 'phone.hatchery on day 0']]),
  M('bad-ratio', 'badChicks', 'growth', 'level1', 'weighin', 'Day 7 weight of a bad batch against its own chick weight',
    [[2, 'day 7 weighed mean >= 4.2 x the measured chick weight'], [3, '>= 4.5 x']]),
  // ---------------- a water problem ----------------
  M('iron-found', 'water', 'water', 'weeks45', 'level-end', 'Each blocked filter found the day it blocked',
    [[2, 'every iron-filter problem fixed before 24:00 of the day it started']]),
  M('pump-found', 'water', 'water', 'weeks45', 'problem', 'Well pump repaired before the tank first ran under 20 %',
    [[2, 'pump.fix (fixed) before farm.waterTank.levelPct first < 20']]),
  M('tank-read', 'water', 'water', 'weeks45', 'level-end', 'Water tank gauge read every morning of weeks 4–5',
    [[1, 'w-tank done on every day 22-35']]),
];
export const condMaxPoints = (branch, condition) => MILESTONES_COND.filter((m) => m.branch === branch && (!condition || m.condition === condition))
  .reduce((a, m) => a + Math.max(...m.tiers.map((t) => t.points)), 0);
