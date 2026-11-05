// The milestones the skills update adds (SKILLS.md §2.3) — contract data of the design round. Owner: package "model" (it
// writes the rules in skills-rules-cycle.js or a new skills-rules-payoff.js and merges these into skills.js's tables while
// SKILLS_UPDATE.live; it may reword texts and rule notes, never ids, branches, levels or checkpoints without the integrator).
// Same shape as skills-cycle.js MILESTONES_CYCLE. Each is a measured result of the branch's own jobs, its threshold on the
// sign the job links (general practice). Until the merge nothing here is awarded or shown.
const M = (id, branch, level, checkpoint, text, tiers, needs = []) => ({ id, branch, level, checkpoint, text, tiers: tiers.map(([points, rule]) => ({ points, rule })), needs });

// Revised after the review (SKILLS.md §2.3): night-air-w3 gets a 5-of-7 tier, and three are added so the normal profile's
// Heat & Ventilation, Growth and Farm Planning reach level 2 inside the first flock (fans-w3, w28-weight, records-w23).
export const MILESTONES_PAYOFF = [
  M('night-air-w3', 'ventilation', 'week3', 'level-end', 'Night ventilation set on the evenings of week 3',
    [[1, 'the night-comfort state (job-engine nightComfortNow: a quarter panting at most, none chilled) held for 30 farm minutes after 18:00 on >= 5 of the 7 evenings of days 15-21'],
      [2, 'on all 7 evenings']]),
  M('fans-w3', 'ventilation', 'week3', 'level-end', 'Tunnel fans checked on the afternoons of week 3',
    [[1, 'r-fans-pm done on >= 5 of days 15-21'], [3, 'r-fans-pm done on all 7 of days 15-21']]),
  M('heat-deaths-fin', 'ventilation', 'finish', 'level-end', 'Heat deaths in the last week',
    [[2, 'heat deaths days 36-41 <= 0.1 % of the birds alive at the level start']]),
  M('dark-fin', 'lighting', 'finish', 'level-end', 'A dark period kept in the last week',
    [[1, 'dark hours >= 4 on >= 4 of days 36-40 (the light sign: about 4-6 hours)']]),
  M('dead-fin', 'biosecurity', 'finish', 'level-end', 'Dead birds picked up on every round of the last week',
    [[1, 'no r-dead-am / r-dead-pm missed on days 36-41']]),
  M('w28-weight', 'growth', 'weeks45', 'weighin', 'Day 28 weight: 98 % of the target or more',
    [[1, 'weighed mean >= 98 % of weightAt(28) (the day 28 weigh-in: weighin@28)'], [3, '>= 103 %']], ['weigh']),
  M('records-w23', 'planning', 'week3', 'level-end', 'The daily record signed every evening of weeks 2 and 3',
    [[2, 'r-record done (the record signed: EV.RECORD_CLOSED signed) on all 14 days 8-21']]),
];
