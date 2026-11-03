// Milestones of the whole cycle (PHASE3.md §9) — contract data, committed by the integrator. Owner:
// package "sim" (it writes the measured rules in skills-rules-cycle.js and may reword texts and rule
// notes, never ids, branches, levels or checkpoints without the integrator). skills.js merges these
// with Phase 2's MILESTONES; until rules exist nothing here is awarded.
//
// Milestone: { id, branch, level, checkpoint, text, tiers: [{ points, rule }] }
//   level       the level whose checkpoint evaluates it (config LEVELS ids)
//   checkpoint  EV.LEVEL checkpoint name (PHASE3.md §9): plan | placed | vent | crop | weighin | curtain |
//               vaccine | heatwave | catch | harvest | clean | swabs | rest | level-end, or 'problem' / 'day'
//   text        the result in the farmer's words (shown on the skill tree; never praise or a verdict)
//   tiers       points of each tier and the measured condition (a note for the rule writer)
//   needs       notebook kinds / stats the rule reads (records.compact keeps them, PHASE3.md §8.6)
const M = (id, branch, level, checkpoint, text, tiers, needs = []) => ({ id, branch, level, checkpoint, text, tiers: tiers.map(([points, rule]) => ({ points, rule })), needs });
const LEVEL_NAMES = { level1: 'the brooding week', week2: 'week 2', week3: 'week 3', weeks45: 'weeks 4–5', finish: 'the last week' };
const per = (ids, fn) => ids.map(fn);

export const MILESTONES_CYCLE = [
  // ---------------- Farm Planning (max 17) ----------------
  M('plan-measured', 'planning', 'plan', 'plan', 'House floor measured before the plan was sent',
    [[1, 'both plan.measure readings (length, width) before plan.send']]),
  M('plan-meets', 'planning', 'plan', 'plan', 'Birds for sale per week from the plan, against the contract',
    [[2, 'planSums.salePerWeek >= PLAN_CONTRACT.salePerWeek'], [3, 'and <= 105 % of it']]),
  M('plan-density', 'planning', 'plan', 'plan', 'Density at catching in the plan at or under the limit',
    [[2, 'planSums.densityKgM2 <= PLAN_CONTRACT.densityMaxKgM2']]),
  M('plan-rest', 'planning', 'plan', 'plan', 'Plan leaves 3 weeks of rest between flocks',
    [[1, 'planSums.restDays >= 21']]),
  M('catch-booked', 'planning', 'finish', 'catch', 'Catching crew and trucks booked 3 days ahead',
    [[1, 'phone.bookCatch >= 72 h before harvest.catchAt']]),
  M('last-order', 'planning', 'finish', 'catch', 'Last feed order planned to the catch',
    [[2, 'silos + pans at the withdrawal between 0 and one day of feed']]),
  M('sold-as-planned', 'planning', 'finish', 'harvest', 'Birds sold against the plan',
    [[2, 'sold >= plan chicks per house x (1 - plan losses)'], [3, 'and mean live weight >= the plan sale weight']], ['plan']),
  M('losses-as-planned', 'planning', 'finish', 'harvest', 'Losses at or under the plan’s allowance',
    [[2, '(deaths + culls + DOA) / placed <= plan lossesPct']], ['plan']),
  M('cycle-as-planned', 'planning', 'cleanout', 'rest', 'Next chicks on the plan’s cycle day',
    [[2, 'booked chick day within 3 days of plan cycleDays after placement']], ['plan']),

  // ---------------- Biosecurity & Health (max 20) ----------------
  M('gate-route', 'biosecurity', 'plan', 'plan', 'Gate rules read, farm clothes on, both dips walked on the first visit',
    [[1, 'sign.read sign-gate, bio.change, the gate dip and the house dip on the planning day']]),
  ...per(['level1', 'week2', 'week3', 'weeks45', 'finish'], (lv) => M(`dips-${lv === 'level1' ? 'l1' : lv === 'week2' ? 'w2' : lv === 'week3' ? 'w3' : lv === 'weeks45' ? 'w45' : 'fin'}`,
    'biosecurity', lv, 'level-end', `No dip missed in ${LEVEL_NAMES[lv]}`, [[1, 'no house entry without the dip and no dip job missed in the level']])),
  ...per(['week2', 'week3', 'weeks45'], (lv) => M(`dead-${lv === 'week2' ? 'w2' : lv === 'week3' ? 'w3' : 'w45'}`,
    'biosecurity', lv, 'level-end', `Dead birds picked up on every round of ${LEVEL_NAMES[lv]}`, [[1, 'no r-dead-am / r-dead-pm missed in the level']])),
  M('vaccine-drunk', 'biosecurity', 'week2', 'vaccine', 'Vaccine drunk within 2 hours',
    [[2, 'health.vaccine.coverage >= 0.85'], [3, '>= 0.95']]),
  M('lame-culled', 'biosecurity', 'week2', 'level-end', 'Lame birds culled the day they were found',
    [[1, 'no lame bird left on the floor at any evening signing, days 11-14']]),
  M('cocci-treated', 'biosecurity', 'week3', 'problem', 'Blood in the droppings: vet called and medicine in the water the same day',
    [[2, 'coccidiosis found and water.medicate on before 24:00 that day']]),
  M('swabs-clean', 'biosecurity', 'cleanout', 'swabs', 'Swabs after disinfection',
    [[2, 'lab: <= 2 of 10 positive'], [3, '0 positive']]),
  M('rest-3w', 'biosecurity', 'cleanout', 'rest', 'House rested 3 weeks or more',
    [[2, 'bookedDay - closedDay >= 21']]),

  // ---------------- Chick Arrival & Brooding (Phase 2's 14 + 2) ----------------
  M('curtain-ready', 'brooding', 'week2', 'curtain', 'Rest of the house littered when the curtain came up',
    [[1, 'litter cover >= 95 % of all 576 cells at house.curtain open']]),
  M('curtain-day', 'brooding', 'week2', 'curtain', 'Brooding curtain lifted on day 9, 10 or 11',
    [[1, 'house.curtain open on calendar day 9-11']]),

  // ---------------- Body Temperature & Comfort (max 16) ----------------
  M('vent-band', 'comfort', 'level1', 'vent', 'Vent temperatures 39.4–40.5 °C on most chicks',
    [[1, '>= 4 of the first 5 vent readings in 39.4-40.5 °C']]),
  M('comfort-w2', 'comfort', 'week2', 'level-end', 'Birds in their comfort band through week 2',
    [[2, 'bird-minutes with zone e in -1.5..hotFrom >= 90 %, days 8-14']]),
  M('no-chill-w2', 'comfort', 'week2', 'level-end', 'No tunnel chill on the young birds in week 2',
    [[1, 'no game hour with tunnel fans on and e < -2, days 8-14']]),
  M('comfort-w3', 'comfort', 'week3', 'level-end', 'Birds in their comfort band through week 3',
    [[2, '>= 90 %, days 15-21']]),
  M('panting-short', 'comfort', 'weeks45', 'level-end', 'Panting hours on the hot afternoons',
    [[2, 'panting bird-hours <= 0.6 x the flock, days 22-35'], [3, '<= 0.3 x']]),
  M('heatwave-safe', 'comfort', 'weeks45', 'heatwave', 'Birds lost to heat in the heat wave',
    [[1, 'heat deaths days 30-32 <= 0.2 % of the birds'], [3, '<= 0.05 %']]),
  M('comfort-fin', 'comfort', 'finish', 'level-end', 'Birds in their comfort band in the last week',
    [[2, '>= 85 %, days 36-41']]),
  M('catch-cool', 'comfort', 'finish', 'harvest', 'Birds kept cool while they were caught',
    [[2, 'DOA <= 0.2 % of the birds loaded']]),

  // ---------------- Heat & Ventilation (max 15) ----------------
  M('warm-timer', 'ventilation', 'level1', 'problem', 'Warm afternoon: the timer brought the chicks back',
    [[1, 'warm-afternoon fixed by "air" (PHASE2.md §7)']]),
  M('fans-afternoon', 'ventilation', 'weeks45', 'level-end', 'Tunnel fans on for the afternoon heat',
    [[2, 'on >= 10 of 14 afternoons with house >= target + 6 °C, >= 3 fans within 1 h']]),
  M('pads-limit', 'ventilation', 'weeks45', 'level-end', 'Pads off when the house was hot and humid',
    [[2, '<= 30 game min with the pad on while house °C + RH >= 110, days 22-35']]),
  M('fan-fixed', 'ventilation', 'weeks45', 'problem', 'Stopped fan found and fixed the same day',
    [[1, 'fan-belt fixed on the day it started']]),
  M('pad-flushed', 'ventilation', 'weeks45', 'problem', 'Dry pad section found and cleaned the same day',
    [[1, 'pad-clog fixed on the day it started']]),
  M('heatwave-ready', 'ventilation', 'weeks45', 'heatwave', 'Fans, pad and water checked before the heat wave',
    [[2, 'fans.read, pad.check and a water.flowtest on day 29 or before 10:00 day 30']]),
  M('heat-deaths-w45', 'ventilation', 'weeks45', 'level-end', 'Heat deaths in weeks 4–5',
    [[2, 'heat deaths days 22-35 <= 0.3 % of the birds'], [3, '<= 0.1 %']]),
  M('full-tunnel', 'ventilation', 'finish', 'level-end', 'Full tunnel on the hot finishing afternoon',
    [[2, 'six fans and the pad by 13:00 on day 38']]),
  M('catch-air', 'ventilation', 'finish', 'harvest', 'Fans running while the birds were caught',
    [[1, '>= 3 tunnel fans for the whole catch']]),

  // ---------------- Moisture & Minimum Ventilation (max 16) ----------------
  M('minvent-l1', 'moisture', 'level1', 'level-end', 'Minimum ventilation by the table in the brooding week',
    [[2, 'timer air within 30 % of the sign table on >= 6 mornings of days 0-7']]),
  M('litter-l1', 'moisture', 'level1', 'level-end', 'Litter at or under 30 % at the end of week 1',
    [[1, 'mean of the day 7 squeezes <= 30 %']]),
  M('damp-cleared', 'moisture', 'week2', 'problem', 'Damp spell: the house air dried out the same day',
    [[2, 'rainy-spell fixed by "air" within 6 h of being found']]),
  M('minvent-w2', 'moisture', 'week2', 'level-end', 'Minimum ventilation stepped up with the birds in week 2',
    [[2, 'timer air within 30 % of the table on >= 5 mornings of days 8-14']]),
  M('minvent-w3', 'moisture', 'week3', 'level-end', 'Minimum ventilation stepped up with the birds in week 3',
    [[2, 'on >= 5 mornings of days 15-21']]),
  M('litter-w3', 'moisture', 'week3', 'level-end', 'Litter moisture in week 3',
    [[2, 'mean squeeze <= 30 % on >= 5 days'], [3, 'and caked share of the floor <= 2 % on day 21']]),
  M('pad-overflow', 'moisture', 'week3', 'problem', 'Pad overflow found and the wet strip covered',
    [[1, 'pad.fixFloat and litter.patch on the strip']]),
  M('dust-cleared', 'moisture', 'weeks45', 'problem', 'Dusty air cleared within a day',
    [[2, 'dusty-air fixed by "air" within 24 h of being found']]),
  M('ammonia-w45', 'moisture', 'weeks45', 'level-end', 'Ammonia under 20 ppm through weeks 4–5',
    [[1, 'air.ammoniaPpm < 20 for >= 95 % of the hours, days 22-35']]),

  // ---------------- Heating (max 15) ----------------
  M('preheat-day', 'heating', 'level1', 'placed', 'Pre-heating ran from the prep day',
    [[2, 'setpoint >= 30 °C with the brooders burning by 12:00 on day -1']]),
  M('cold-night', 'heating', 'level1', 'level-end', 'Cold night: the house held its target',
    [[2, 'house >= target - 1 °C from 00:00 to 07:00 on day 3']]),
  M('thermostat-off', 'heating', 'level1', 'level-end', 'Brooders off by their thermostat on the warm afternoon',
    [[1, 'heaterLevel < 0.05 for >= 2 h between 12:00 and 17:00 on day 6']]),
  M('setpoint-w2', 'heating', 'week2', 'level-end', 'Setpoint by the table every morning of week 2',
    [[2, 'morning setpoint within 1 °C of the brooder table on all of days 8-14']]),
  M('nights-w2', 'heating', 'week2', 'level-end', 'Week 2 nights at the target',
    [[2, 'night house minimum >= target - 2 °C on >= 6 nights']]),
  M('no-overheat-w2', 'heating', 'week2', 'level-end', 'No hour more than 3 °C over the target with the brooders burning',
    [[2, 'no game hour with heaterLevel > 0.2 and house > target + 3 °C, days 8-14']]),
  M('gas-w13', 'heating', 'week3', 'level-end', 'Gas used in weeks 1–3',
    [[2, 'stats.gasKg per 1,000 birds placed <= 60 kg'], [3, '<= 45 kg']]),
  M('brooders-up', 'heating', 'weeks45', 'level-end', 'Brooders off and raised when the heat was no longer needed',
    [[1, 'heat.brooders up by 18:00 on day 22 and no cold stress after']]),

  // ---------------- Water (Phase 2's 11 + 9) ----------------
  ...per(['week2', 'week3', 'weeks45', 'finish'], (lv) => M(`flow-${lv === 'week2' ? 'w2' : lv === 'week3' ? 'w3' : lv === 'weeks45' ? 'w45' : 'fin'}`,
    'water', lv, 'level-end', `Flow kept at age + 20 ml/min in ${LEVEL_NAMES[lv]}`,
    [[1, 'morning flows of all 4 lines within 5 ml/min of day + 20 on >= 5 days (>= 10 in weeks 4-5)']], ['water.flow'])),
  ...per(['week2', 'week3'], (lv) => M(`raised-${lv === 'week2' ? 'w2' : 'w3'}`, 'water', lv, 'weighin', `Nipples raised with the birds in ${LEVEL_NAMES[lv]}`,
    [[1, 'all 4 lines within 3 cm of nippleHeightCmAt(weigh day) at the weigh-in']])),
  M('medicine-course', 'water', 'week3', 'level-end', 'Medicine in the water for the full course',
    [[1, 'water.medicate on for 3 days in a row']]),
  M('lines-cleaned', 'water', 'cleanout', 'clean', 'Drinker lines cleaned with disinfectant',
    [[2, 'every clean.lines[i] >= 1 before the house was closed']]),

  // ---------------- Feed & Digestion (max 16) ----------------
  M('pans-flooded', 'feed', 'level1', 'level-end', 'Pans flooded on the litter for the first days',
    [[1, 'all 3 lines flooded with the rim <= 6 cm on days 0-3']]),
  ...per(['level1', 'week2', 'week3', 'weeks45', 'finish'], (lv) => M(`never-out-${lv === 'level1' ? 'l1' : lv === 'week2' ? 'w2' : lv === 'week3' ? 'w3' : lv === 'weeks45' ? 'w45' : 'fin'}`,
    'feed', lv, 'level-end', `Feed never ran out in ${LEVEL_NAMES[lv]}`, [[1, 'mean pan fill >= 5 % all level (the withdrawal excepted)']])),
  M('pellet-change', 'feed', 'week3', 'level-end', 'Crumble to pellet change on time',
    [[2, 'pans >= 90 % grower by day 16 18:00 and no intake dip >= 5 %'], [3, 'and a blend (20-80 % grower) for >= 24 h']]),
  M('droppings-read', 'feed', 'week3', 'level-end', 'Droppings looked at on ten birds',
    [[1, '>= 10 sample.bird { look: droppings } in days 15-21']]),
  ...per(['week2', 'week3'], (lv) => M(`rim-${lv === 'week2' ? 'w2' : 'w3'}`, 'feed', lv, 'level-end', `Pans at the birds' back height in ${LEVEL_NAMES[lv]}`,
    [[1, 'pan heights within 3 cm of feederRimCmAt on >= 5 days']])),
  M('finisher-change', 'feed', 'weeks45', 'level-end', 'Finisher feed in the pans on day 29 or 30',
    [[1, 'pans >= 90 % finisher between day 29 06:00 and day 30 24:00']]),
  M('heat-feeders', 'feed', 'weeks45', 'heatwave', 'Feeders off in the hottest hours of the heat wave',
    [[1, 'lines stopped / pans up 11:00-16:00 on >= 2 of days 30-32']]),
  M('withdrawal', 'feed', 'finish', 'catch', 'Feed taken away 8–12 hours before catching',
    [[2, 'pans empty 8-12 h before harvest.catchAt']]),

  // ---------------- Lighting (max 15) ----------------
  M('light-23h', 'lighting', 'level1', 'level-end', '23 hours of light in the brooding week',
    [[2, 'light hours >= 22 on days 0-6']]),
  M('lux-l1', 'lighting', 'level1', 'level-end', '30–40 lux at chick level in week 1',
    [[1, 'luxLit between 26 and 44 on >= 6 of days 0-7']]),
  M('dark-w2', 'lighting', 'week2', 'level-end', 'A dark period every night from week 2',
    [[2, 'dark hours >= 4 on >= 6 of days 8-14']]),
  M('lux-measured', 'lighting', 'week2', 'level-end', 'Light measured at bird level in week 2',
    [[1, '>= 3 light.lux from 3 sectors in days 8-14']]),
  M('sds-w2', 'lighting', 'week2', 'level-end', 'Sudden deaths in week 2',
    [[2, 'sds deaths days 8-14 <= 0.1 % of the birds'], [3, '<= 0.05 %']]),
  M('lame-w3', 'lighting', 'week3', 'level-end', 'Lame birds in week 3',
    [[2, 'lame culls + legs deaths days 15-21 <= 0.2 % of the birds']]),
  M('dark-w45', 'lighting', 'weeks45', 'level-end', 'Dark period kept through weeks 4–5',
    [[2, 'dark hours >= 4 on >= 12 of days 22-35']]),
  M('catch-light', 'lighting', 'finish', 'harvest', 'Lights dimmed for the catch',
    [[2, 'dimmer <= 0.2 for the whole catch']]),

  // ---------------- Growth & Performance (max 19) ----------------
  ...per([['week2', 14], ['week3', 21], ['weeks45', 35]], ([lv, day]) => M(`w${day}-weight`, 'growth', lv, 'weighin', `Day ${day} weight against the target`,
    [[1, `weighed mean >= 95 % of weightAt(${day})`], [3, '>= 100 %']], ['weigh'])),
  M('weighed-weekly', 'growth', 'finish', 'harvest', 'Weighed 50 birds every week',
    [[2, '>= 50 sample.weigh on each of days 7, 14, 21, 28, 35 and 40']], ['weigh']),
  M('harvest-fcr', 'growth', 'finish', 'harvest', 'Feed conversion at harvest',
    [[2, 'harvest FCR <= 1.80'], [3, '<= 1.70']]),
  M('harvest-uniformity', 'growth', 'finish', 'harvest', 'Uniformity at the last weigh-in',
    [[2, 'day 40 weighing uniformity >= 70 %']], ['weigh']),
  M('epef', 'growth', 'finish', 'harvest', 'Production efficiency factor at harvest',
    [[1, 'EPEF >= 300'], [3, '>= 350']]),
];

/** Highest points a branch can earn from these milestones (the skill tree's bar). */
export const cycleMaxPoints = (branch) => MILESTONES_CYCLE.filter((m) => m.branch === branch).reduce((a, m) => a + Math.max(...m.tiers.map((t) => t.points)), 0);
