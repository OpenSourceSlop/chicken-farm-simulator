// Milestones of the whole cycle (PHASE3.md §9) — contract data, committed by the integrator. Owner:
// package "sim" (it writes the measured rules in skills-rules-cycle.js and may reword texts and rule
// notes, never ids, branches, levels or checkpoints without the integrator). skills.js merges these
// with Phase 2's MILESTONES; until rules exist nothing here is awarded.
//
// Milestone: { id, branch, level, checkpoint, text, tiers: [{ points, rule }] }
//   level       the level whose checkpoint evaluates it (config LEVELS ids). The milestones of level 'level1'
//               count only inside a run (checkpoint ctx.run) and only at the brooding week's level-end, so the
//               week plays exactly as Phase 2 (its unlocks come with the result screen); Phase 2's lone
//               brooding week (__game.startLevel({ seed: 1 })) awards only skills.js MILESTONES.
//   Every threshold a tier names is on the sign or plate the job links (PHASE3.md §9), or is a measured
//   outcome the text states (deaths, hours of panting, kg of feed left): never a hidden setting.
//   checkpoint  EV.LEVEL checkpoint name (PHASE3.md §9): plan | placed | vent | crop | weighin | curtain |
//               vaccine | heatwave | catch | harvest | clean | swabs | rest | level-end, or 'problem' / 'day'
//   text        the result in the farmer's words (shown on the skill tree; never praise or a verdict)
//   tiers       points of each tier and the measured condition (a note for the rule writer)
//   needs       notebook kinds / stats the rule reads (records.compact keeps them, PHASE3.md §8.6)
//   needsProblem (Phase 4, PHASE4.md §7) the problem whose outcome it measures: not evaluated where the level as the
//               run's condition plays it lacks that problem (NEEDS_PROBLEM below; a 'heatwave' checkpoint needs 'heat-wave')
const M = (id, branch, level, checkpoint, text, tiers, needs = []) => ({ id, branch, level, checkpoint, text, tiers: tiers.map(([points, rule]) => ({ points, rule })), needs });
const LEVEL_NAMES = { level1: 'the brooding week', week2: 'week 2', week3: 'week 3', weeks45: 'weeks 4–5', finish: 'the last week' };
const per = (ids, fn) => ids.map(fn);

// Phase 4: the problem each of these milestones measures (PHASE4.md §7; a condition may drop it)
export const NEEDS_PROBLEM = {
  'warm-timer': 'warm-afternoon', 'thermostat-off': 'warm-afternoon', 'w3-heat': 'warm-afternoon3', 'hot-first': 'hot-afternoon',
  'pads-limit': 'humid-heat', 'heat-finish': 'hot-finish', 'dust-cleared': 'dusty-air', 'fan-fixed': 'fan-belt', 'pad-flushed': 'pad-clog',
  'damp-cleared': 'rainy-spell', 'pad-overflow': 'pad-overflow', 'cocci-treated': 'coccidiosis', 'cold-night': 'cold-night', 'lame-culled': 'lame-birds',
  // Phase 2's (skills.js MILESTONES)
  'brooder-relit': 'brooder-out', 'drop-spotted': 'blocked-filter', 'leak-fixed': 'leaking-nipple',
};
/** The problem a milestone needs (its own needsProblem, the table above, or 'heat-wave' for the heat-wave checkpoint). */
export const needsProblemOf = (m) => m.needsProblem || NEEDS_PROBLEM[m.id] || (m.checkpoint === 'heatwave' ? 'heat-wave' : null);

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
  M('catch-booked', 'planning', 'finish', 'catch', 'Catching crew and trucks booked at least 3 days ahead',
    [[1, 'phone.bookCatch (booked) >= HARVEST.bookAheadH before harvest.catchAt (sign-catch)']]),
  M('last-order', 'planning', 'finish', 'catch', 'Less than one day of feed (1.2 t) left at catching',
    [[2, 'silos + pans at the catch < 1,200 kg (sign-feed)']]),
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
  M('vaccine-drunk', 'biosecurity', 'week2', 'vaccine', 'Hours the birds took to drink the vaccine',
    [[2, 'health.vaccine.hours <= 2.5 (the vaccine plate: about 2 hours)'], [3, '<= 2.0']]),
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
  M('vent-band', 'comfort', 'level1', 'level-end', 'Vent temperatures 39.4–40.5 °C on most chicks',
    [[1, '>= 4 of the first 5 vent readings in 39.4-40.5 °C (with Brooding 2: >= 2 of the first 3)']]),
  M('comfort-w2', 'comfort', 'week2', 'level-end', 'Birds in their comfort band through week 2',
    [[2, 'bird-minutes with zone e in -1.5..hotFrom >= 90 %, days 8-14']]),
  M('no-chill-w2', 'comfort', 'week2', 'level-end', 'No tunnel chill on the young birds in week 2',
    [[1, 'no game hour with tunnel fans on and e < -2, days 8-14']]),
  M('comfort-w3', 'comfort', 'week3', 'level-end', 'Birds in their comfort band through week 3',
    [[2, '>= 90 %, days 15-21']]),
  M('panting-short', 'comfort', 'weeks45', 'level-end', 'Hours of panting per bird in weeks 4–5: 60 or fewer',
    [[2, 'sum of pantShare over the hours of days 22-35 <= 60'], [3, '<= 45']]),
  M('heatwave-safe', 'comfort', 'weeks45', 'heatwave', 'Hours of panting per bird in the heat wave: 12 or fewer',
    [[1, 'sum of pantShare over the hours, day 30 06:00 to day 32 19:00 <= 12'], [3, '<= 6']]),
  M('comfort-fin', 'comfort', 'finish', 'level-end', 'Birds in their comfort band in the last week',
    [[2, '>= 85 %, days 36-41']]),
  M('catch-cool', 'comfort', 'finish', 'harvest', 'Birds kept cool while they were caught',
    [[2, 'DOA <= 0.2 % of the birds loaded']]),

  // ---------------- Heat & Ventilation (max 15) ----------------
  M('warm-timer', 'ventilation', 'level1', 'level-end', 'Warm afternoon: the timer brought the chicks back',
    [[1, 'warm-afternoon fixed by "air" (PHASE2.md §7)']]),
  M('w3-heat', 'ventilation', 'week3', 'problem', 'First warm afternoon of week 3: birds panting for under 2 hours after it was found, none chilled',
    [[1, 'warm-afternoon3 fixed by "air" (heat-handled) within 2 h of being found, no cold deaths in between']]),
  M('air-measured', 'ventilation', 'weeks45', 'day', 'Air speed measured at bird height in three parts of the house',
    [[1, '>= 3 air.probe from 3 house sectors by the day 23 record']]),
  M('hot-first', 'ventilation', 'weeks45', 'problem', 'First hot afternoon: fewer than one bird in ten panting again the same afternoon',
    [[1, 'hot-afternoon fixed by "air" (heat-handled) before 18:00 on day 25']]),
  M('pads-limit', 'ventilation', 'weeks45', 'level-end', 'Pads off while the house humidity was over 90 % (the pad plate)',
    [[2, '<= 30 game min with the pad on and house RH > HEAT.padOffAboveRH, days 22-35']]),
  M('fan-fixed', 'ventilation', 'weeks45', 'problem', 'Stopped fan found and fixed the same day',
    [[1, 'fan-belt fixed on the day it started']]),
  M('pad-flushed', 'ventilation', 'weeks45', 'problem', 'Dry pad section found and cleaned the same day',
    [[1, 'pad-clog fixed on the day it started']]),
  M('heatwave-ready', 'ventilation', 'weeks45', 'heatwave', 'Fans, pad and water checked before the heat wave',
    [[2, 'fans.read, pad.check and a water.flowtest on day 29 or before 10:00 day 30']]),
  M('heat-deaths-w45', 'ventilation', 'weeks45', 'level-end', 'Heat deaths in weeks 4–5',
    [[2, 'heat deaths days 22-35 <= 0.3 % of the birds'], [3, '<= 0.1 %']]),
  M('heat-finish', 'ventilation', 'finish', 'level-end', 'Hours of panting per bird on the hot finishing afternoon: 3 or fewer',
    [[2, 'sum of pantShare over the hours of day 38 <= 3']]),
  M('catch-air', 'ventilation', 'finish', 'harvest', 'At least three tunnel fans running through the catch (sign-catch)',
    [[1, 'env.fansEffective >= HARVEST.catchFansMin from the catch start to the house empty']]),

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
  M('preheat-day', 'heating', 'level1', 'level-end', 'Pre-heating ran from the prep day',
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
  M('gas-w13', 'heating', 'week3', 'level-end', 'Gas used to day 21, against the gas plate (200–300 kg)',
    [[2, 'stats.gasKg at the day 21 record <= 300 kg'], [3, '<= 250 kg']]),
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
  M('withdrawal', 'feed', 'finish', 'catch', 'Pans empty 8–12 hours before the catch (sign-feed)',
    [[2, 'harvest.catchAt - the time the pans ran empty (<= 5 %) in HARVEST.withdrawalH']]),

  // ---------------- Lighting (max 15) ----------------
  M('light-23h', 'lighting', 'level1', 'level-end', '23 hours of light in the brooding week',
    [[2, 'light hours >= 22 on days 0-6']]),
  M('lux-l1', 'lighting', 'level1', 'level-end', '30–40 lux at chick level in week 1',
    [[1, 'luxLit between 26 and 44 on >= 6 of days 0-7']]),
  M('light-arrival', 'lighting', 'level1', 'level-end', 'Lights on and bright when the chicks arrived',
    [[1, 'lights on, dimmer >= 0.5 and dark <= 1 h at the first tip (the chick arrival sign)']]),
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
  M('catch-light', 'lighting', 'finish', 'harvest', 'Lights at about 10 lux or less through the catch (sign-catch)',
    [[2, 'luxLit <= 12 from the catch start to the house empty']]),

  // ---------------- Growth & Performance (max 19) ----------------
  ...per([['week2', 14], ['week3', 21], ['weeks45', 35]], ([lv, day]) => M(`w${day}-weight`, 'growth', lv, 'weighin', `Day ${day} weight: 98 % of the target or more`,
    [[1, `weighed mean >= 98 % of weightAt(${day})`], [3, '>= 103 %']], ['weigh'])),
  M('weighed-weekly', 'growth', 'finish', 'harvest', 'Weighed 50 birds every week (25 with Growth 2)',
    [[2, '>= the day\'s sample (50; 25 with Growth 2) sample.weigh on each of days 7, 14, 21, 28, 35 and 40']], ['weigh']),
  M('harvest-fcr', 'growth', 'finish', 'harvest', 'Feed conversion at harvest: 1.75 or under',
    [[2, 'harvest FCR <= 1.75'], [3, '<= 1.65']]),
  M('harvest-uniformity', 'growth', 'finish', 'harvest', 'Uniformity at the last weigh-in',
    [[2, 'day 40 weighing uniformity >= 70 %']], ['weigh']),
  M('epef', 'growth', 'finish', 'harvest', 'Production efficiency factor at harvest: 340 or more',
    [[1, 'EPEF >= 340'], [3, '>= 390']]),
];

/** Highest points a branch can earn from these milestones (the skill tree's bar). */
export const cycleMaxPoints = (branch) => MILESTONES_CYCLE.filter((m) => m.branch === branch).reduce((a, m) => a + Math.max(...m.tiers.map((t) => t.points)), 0);
