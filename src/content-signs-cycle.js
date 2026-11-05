// Every fact on the Phase 3 signs and equipment plates, with its source (PHASE3.md §5) — contract
// data, committed by the integrator. Owner: package "run" (may reword texts; never moves a fact to a
// guide that PHASE3.md §5.1 / PHASE2.md §6.1 do not list). Same shape as content-signs.js BOARDS:
//   BOARDS_CYCLE: id -> { title, kicker?, where, items: [{ text, source, pic? }] }
//     sign-*  3D boards (scene paints them at config SPOTS3, run opens them as a sign panel)
//     others  plates: a fact column inside that equipment panel (panels builds them)
//   BOARD_EXTRA_ITEMS: id of a Phase 2 board or plate -> [{ text, source, fromDay }]: lines added from that
//     calendar day on, so the brooding week reads exactly as before
//   boardsForDay(day, condition) -> every board (Phase 2 + Phase 3) with the extra lines of that day merged in, and the
//                   Phase 4 lines of the condition (and of the tuned model) through content-signs-cond.js mergeBoardsP4
// source: a key of config GUIDES, an array of keys, or 'week1-4' (sourceLabel in content-signs.js).
// 'general' = general broiler practice. No page numbers anywhere (scripts/test-contracts.mjs checks).
import { BOARDS } from './content-signs.js';
import { keyWordProps } from './key-words.js'; // fix round: a fact's {key:id} token filled when read
import { mergeBoardsP4 } from './content-signs-cond.js';   // Phase 4: the one merge (PHASE4.md §3.2)
import { PHASE4, SKILLS_UPDATE } from './config.js';
import { mergeBoardsSkills } from './content-signs-skills.js';   // Skills update (SKILLS.md §3.12): only while SKILLS_UPDATE.live

const g = 'general';
const it = (text, source = g, pic) => (pic ? { text, source, pic } : { text, source });

export const BOARDS_CYCLE = {
  // ---------------- 3D boards ----------------
  'sign-plan': {
    title: 'Production planning', kicker: 'The planning sums', where: 'Office porch, beside the desk',
    items: [
      it('Chicks to place per week = birds for sale per week ÷ (1 − losses).'),
      it('Plan for about 4 % losses from chick to catching.'),
      it('Birds per m² at catching = kg of live bird allowed per m² ÷ sale weight.'),
      it('Allow about 32 kg of live bird per m² at catching in a tunnel (EVAP) house.'),
      it('Floor for one week’s chicks = chicks per week ÷ birds per m².'),
      it('Days a house is used per flock = 42 growing days + about 4 clean-out days + the rest days.'),
      it('Rest the clean, empty house at least 3 weeks before the next chicks.'),
      it('Houses needed = floor for one week’s chicks × weeks a house is used per flock ÷ floor of one house.'),
      it('Example: 1,000 birds for sale a week at 4 % losses = about 1,042 chicks a week.'),
      it('House 1 has drinkers and feeders for 6,000 birds.'),
    ],
  },
  'sign-light': {
    title: 'Light program for growing birds', kicker: 'From week 2', where: 'Inside, north wall, east of the minimum ventilation sign',
    items: [
      it('Light control against sudden death in week 2.', 'week2'),
      it('From the second week give the birds a dark period every night: rest in the dark lowers sudden deaths and leg problems.'),
      it('About 4–6 hours of darkness in one block from day 8, kept until the last days before catching.'),
      it('Light at bird level about 20 lux from week 2 (30–40 lux in week 1).'),
      it('Measure the light at bird height ({key:lux}), under the lamps and between them.'),
      it('Sudden death: big, well-grown birds found dead on their backs, legs up, often near the feeders.'),
      it('For catching dim the lights to about 10 lux at bird height: birds stay calm in low light.'),
    ],
  },
  'sign-curtain': {
    title: 'Opening up the house', kicker: 'The brooding curtain', where: 'Inside, north wall, beside the winch at the brooding curtain',
    items: [
      it('Lift the brooding curtain in week 2 and let the birds spread over the whole house.', 'week2'),
      it('Lift it about day 10, in the morning when the house is warm, and walk through the birds so they spread out.'),
      it('The day before, spread litter over the rest of the floor so it is dry and warm when the birds come.'),
      it('The lines feed the whole house: check flow and height at the far end too.'),
      it('Before the lift the birds have half the floor: the litter there gets wetter and the birds more crowded every day.'),
    ],
  },
  'sign-legs': {
    title: 'Legs and feathers', kicker: 'Week 2', where: 'Inside, north wall, east of the curtain',
    items: [
      it('Watch the feathering and the legs in week 2.', 'week2'),
      it('Gait score: 0 walks well, 1–2 small faults, 3 walks with difficulty, 4–5 can hardly walk or not at all.'),
      it('Cull birds that cannot reach feed and water (gait 4–5) the day you find them.'),
      it('Back and wings feathered by about day 21; slow or patchy feathering points to a house too hot or too cold, crowding or a feed problem.'),
      it('Dark spots and sores on the footpads come from wet litter.'),
      it('A dark period every night and dry litter give stronger legs.'),
    ],
  },
  'sign-air': {
    title: 'Air quality', kicker: 'Breathing and dust', where: 'Inside, north wall, middle of the east half',
    items: [
      it('Watch the breathing and the dust in weeks 4–5.', 'week4'),
      it('What the breathing sounds tell you.', 'week1-4'),
      it('Snicking or a rattle in the breathing: too much ammonia or dust in the air.'),
      it('Ammonia: if your eyes sting at bird height it is above about 20 ppm.'),
      it('Quiet breathing and no sting in your eyes at bird height: ammonia under about 15 ppm.'),
      it('Keep the house humidity at or under about 75 %: wet air wets the litter.'),
      it('Dust rises with dry litter, low humidity and busy birds, most in the hours after the lights come on; more air carries it out.'),
      it('Minimum ventilation brings fresh air in, moisture and ammonia out.', 'vent'),
      it('Run the minimum ventilation on cold days too.'),
      it('Ventilate for moisture as the birds grow.', 'week2'),
      it('Step the minimum ventilation up as the birds gain weight (the table on the minimum ventilation sign).'),
    ],
  },
  'sign-droppings': {
    title: 'Droppings', kicker: 'At the bird check', where: 'Inside, north wall, east end',
    items: [
      it('Read the droppings at the bird check.', 'week3', 'droppings'),
      it('Droppings tell you about the gut and the feed.'),
      it('Normal: firm, brown with a white cap. About one in ten is a soft, frothy, mustard-brown caecal dropping: also normal.'),
      it('Watery: heat or too much water. Undigested feed: a feed change or a gut upset.'),
      it('Blood or orange-red: call the vet. White and watery with hunched, sleepy birds: call the vet.'),
      it('Keep the litter dry.', 'week3'),
      it('Wet, caked litter spreads gut disease and burns the feet.'),
    ],
  },
  'sign-heat': {
    title: 'Heat and tunnel fans', kicker: 'From week 3', where: 'Inside, north wall, beside the fan panel',
    items: [
      it('Use the tunnel fans against heat stress.', 'week4'),
      it('Tunnel fans from week 3, by how the birds feel: young birds as few as the heat allows, big birds in the heat all six.'),
      it('Moving air cools the birds (wind chill); young birds feel it far more than big birds.'),
      it('All six fans give about 2.5 m/s at bird height, each fan about 0.4 m/s.'),
      it('At 2.5 m/s birds of 5 weeks feel about 3–4 °C cooler, birds of 2 weeks 6–7 °C.'),
      it('Big birds make more heat: each week the same afternoon needs more air.'),
      it('Heat stress: panting, wings out, lying along the walls; deaths start in the hottest hours.'),
      it('In the evening step the fans down as the house cools: young birds want the tunnel fans off at night, big birds still want some tunnel air on warm nights.'),
    ],
  },
  'sign-feed': {
    title: 'Feed program', kicker: 'Silos and feeder lines', where: 'Outside, beside the silo gauge',
    items: [
      it('Change the feed from crumble to pellets.', 'week3'),
      it('Starter crumble days 0–14, grower pellets days 15–28, finisher pellets from day 29.'),
      it('Change over a day: half from each silo for 24 hours, then the new feed only.'),
      it('Feed per bird per day: about 75 g on day 14, 130 g on day 21, 160 g on day 28, 185 g on day 35, 200 g by day 42.'),
      it('Feed ordered before 16:00 comes the next morning at 09:00; each silo holds 6 tonnes. A silo empties from the bottom: the oldest feed comes out first.'),
      it('The last order: enough to the feed withdrawal and no more. Less than one day’s feed (about 1.2 tonnes) left at catching; feed left over is waste.'),
      it('In a heat wave lift the feeders in the hottest hours (about 11:00–16:00): digesting feed makes heat.'),
      it('Before catching the pans should be empty 8–12 hours before the catch: stop the lines about an hour before that. Keep the water on until catching starts.'),
    ],
  },
  'sign-catch': {
    title: 'Catching and loading', kicker: 'Harvest night', where: 'Outside the house, south wall, east of the flock health sign',
    items: [
      it('Book the catching crew and the trucks at least 3 days ahead.'),
      it('The pans empty 8–12 hours before catching (stop the lines about an hour before that); keep the water on until catching starts.'),
      it('Dim the lights to about 10 lux at bird height and catch in the cool of the night.'),
      it('Keep at least three tunnel fans running for the birds still in the house and the crates on the trucks.'),
      it('Lift the drinker and feeder lines out of the way just before the crew starts.'),
      it('Pen small groups with catching panels: fewer birds pile up.'),
      it('About 10 birds of 2.8 kg to a crate; fewer in hot weather.'),
      it('The birds lose about 2 % of their weight between the feed going off and the plant.'),
      it('Birds caught with feed still in the crop and gut: the plant deducts the gut fill from the ticket (it is not paid).'),
      it('Read each truck’s weight ticket: crates, birds, gross, empty and net weight.'),
    ],
  },
  'sign-clean': {
    title: 'Clean-out', kicker: 'Between flocks', where: 'At the wash bay, west of the house',
    items: [
      it('1. Lift all lines and brooders; take out all the old litter.'),
      it('2. Brush the dust off the lines, fans, pad, brooders and inlets.'),
      it('3. Wash everything with detergent and the pressure washer, from the far end to the door.'),
      it('4. Let the house dry: disinfectant on a wet floor is too weak.'),
      it('5. Disinfect every surface.'),
      it('6. Clean the drinker lines with disinfectant and wash the feeder pans.'),
      it('7. Wash and disinfect boots, buckets, the barrow and the washer at the wash bay.'),
      it('8. Set rodent bait; close the house.'),
      it('9. Swab the ten places the lab marks with flags, where cleaning is hardest: the lab shows what still grows anywhere in the house.'),
      it('Rest the clean house at least 3 weeks (21 days) before the next chicks.'),
    ],
  },
  // ---------------- plates inside equipment panels ----------------
  'guard-hut': { title: 'Farm clothes', where: 'Guard hut inside the gate',
    items: [it('Change into farm clothes and boots before you go near the houses.'), it('Wash your hands; visitors sign the visitor book.')] },
  'plan-sheet': { title: 'Planning figures', where: 'Planning sheet, office desk',
    items: [it('Plan for about 4 % losses from chick to catching.'), it('At most about 32 kg of live bird per m² at catching.'),
      it('A house is used 42 growing days + about 4 clean-out days + the rest days (at least 21) per flock.'),
      it('The contract’s terms: the company counts at least 4 % losses, at least 21 days of rest and at most 6,000 chicks a house.'),
      it('The plant takes the contract’s birds a week and at most about 10 % more: a plan far over the contract has nowhere to sell its birds.')] },
  vaccine: { title: 'Vaccination', where: 'Water supply, Vaccine tab',
    items: [it('Vaccinate the flock in week 2.', 'week2'), it('Follow the vet’s schedule. Here: day 12, Gumboro vaccine in the drinking water.'),
      it('Stop chlorine and medicine in the water 2 days before.'), it('Turn the water off 1–2 hours before so the birds are thirsty.'),
      it('Mix the vaccine with skim milk powder in the header tank, enough for the birds to drink in about 2 hours.'),
      it('Walk slowly through the house while they drink so every bird gets up.')] },
  medicator: { title: 'Medicine in the water', where: 'Water supply, Medicine tab',
    items: [it('Give medicine in the drinking water at the vet’s dose for the full course; mix fresh each day.'),
      it('Bloody or orange droppings with hunched birds: call the vet the same day.')] },
  'pad-pump': { title: 'Cooling pad', where: 'Pad pump, outside the west end',
    items: [it('Cooling pads with the tunnel fans.', 'week4'),
      it('Each 5 % of humidity the air can still take up gives about 1 °C of pad cooling.', 'vent'),
      it('A pad in good order gives most of that, never all of it.'),
      it('The temperature + humidity limit: the pads help while the house humidity stays at or under about 90 %. Above it they add more damp than cool: pump off, keep all the fans running.'),
      it('Water should run down every part of the pad; a dry stripe lets hot air in.'),
      it('Run the pad pump only while the tunnel fans run.')] },
  'fan-panel': { title: 'Tunnel fans', where: 'Fan panel, east end, north wall',
    items: [it('Lamp on and the blade still: the motor runs but the belt is broken or slipping.'),
      it('All six fans give about 2.5 m/s at bird height.'),
      it('Big birds in the heat: all fans and the pads; young birds: as few tunnel fans as the heat allows.'),
      it('The house temperature and humidity side by side: with the pads on, watch the humidity (the pad plate’s limit).')] },
  'gas-tank': { title: 'Gas tank', where: 'Outside, north-west of the house',
    items: [it('Read the gas gauge every morning while the brooders run.'), it('Brooders burn most on cold nights and with too much minimum ventilation.'),
      it('In the cool season 6,000 chicks to day 21 burn about 200–300 kg of gas.')] },
  'bird-check': { title: 'Bird in the hand', where: 'Any bird you pick up from day 8',
    items: [it('Look at how it walks, the feathers, the feet, the breathing, the vent and droppings, the crop.'),
      it('What huddling, panting, droppings and breathing sounds tell you.', 'week1-4')] },
  'loading-bay': { title: 'Weight tickets', where: 'Loading bay by the door path',
    items: [it('Net weight = gross − empty truck. Mean live weight = net ÷ birds loaded.'),
      it('Dead on arrival is counted at the plant and comes back on the ticket.')] },
  'wash-bay': { title: 'Wash bay', where: 'West of the house',
    items: [it('Washer first with detergent, rinse, then the sprayer with disinfectant once the house is dry.'), it('Mix the disinfectant as its label says.'),
      it('The washer and the sprayer each cover a strip about 5 m wide: three passes along the house.')] },
};

export const BOARD_EXTRA_ITEMS = {
  'sign-vent': [
    { text: 'Fresh air per 1,000 birds as they grow: 950 m³/h at 500 g, 1,600 at 1 kg, 2,150 at 1.5 kg, 2,700 at 2 kg, 3,650 at 3 kg.', source: g, fromDay: 8 },
    { text: 'Ventilate for moisture as the birds grow.', source: 'week2', fromDay: 8 },
    { text: 'Step the timer up every day or two as the birds gain weight.', source: g, fromDay: 8 },
  ],
  'controller-lights': [
    { text: 'Light control against sudden death from week 2.', source: 'week2', fromDay: 8 },
    { text: 'A dark period every night (see the light program sign).', source: g, fromDay: 8 },
  ],
  'sign-litter': [
    { text: 'Keep the litter dry.', source: 'week3', fromDay: 15 },
    { text: 'Fork over caked patches and top up with fresh husk, most of all under the drinker lines.', source: g, fromDay: 15 },
  ],
  'feeder-box': [
    { text: 'Raise the pans every few days to the height of the birds’ backs.', source: g, fromDay: 8 },
    { text: 'Pan rim about 15 cm on day 13, 22 cm on day 20, 28 cm on day 27, 33 cm on day 34.', source: g, fromDay: 8 },
    { text: 'Before catching: stop the lines and winch the pans up once they are empty.', source: g, fromDay: 36 },
  ],
  drinker: [{ text: 'Nipple tip about 24 cm on day 14, 31 cm on day 21, 37 cm on day 28, 42 cm on day 35.', source: g, fromDay: 8 },
    { text: 'Catching: lift the lines to the top of the winch (55–60 cm) just before the crew starts.', source: g, fromDay: 36 }],
  silo: [{ text: 'Silo 1: starter crumble, later finisher pellets. Silo 2: grower pellets. Each holds 6 tonnes and empties from the bottom: the oldest feed comes out first.', source: g, fromDay: 13 }],
  'bird-scale': [
    { text: 'Weigh 50 birds from 5 places every week: days 14, 21, 28, 35 and before catching.', source: g, fromDay: 8 },
    { text: 'Target weights: 480 g on day 14, 950 g on day 21, 1,550 g on day 28, 2,200 g on day 35, 2,850 g on day 42.', source: g, fromDay: 8 },
  ],
  'water-supply': [
    { text: 'Vaccine and medicine go in through the header tank (Vaccine and Medicine tabs).', source: g, fromDay: 12 },
    { text: 'Clean-out: disinfectant in the header tank (Clean-out tab), then flush each line with it.', source: g, fromDay: 43 },
  ],
  'sign-health': [{ text: 'Abnormal after week 1: more than about 0.15 % of the flock dying in one day (9 birds of 6,000).', source: g, fromDay: 8 }],
};

/** Every board of the game for calendar day `day`: Phase 2's, Phase 3's, and the extra lines due; Phase 4: the run's
 *  condition (farm.condition: its lines, its boards and plates) and, while config PHASE4.tunedSigns, the tuned
 *  model's lines (content-signs-cond.js mergeBoardsP4). No condition and the switch off: exactly Phase 3's boards. */
export function boardsForDay(day, condition = null) {
  const out = {};
  for (const [id, b] of Object.entries({ ...BOARDS, ...BOARDS_CYCLE })) {
    const extra = (BOARD_EXTRA_ITEMS[id] || []).filter((x) => day >= x.fromDay).map(({ text, source }) => ({ text, source }));
    out[id] = extra.length ? { ...b, items: [...b.items, ...extra] } : b;
  }
  const merged = condition || PHASE4.tunedSigns ? mergeBoardsP4(out, day, condition, { tuned: PHASE4.tunedSigns }) : out;
  return SKILLS_UPDATE.live ? mergeBoardsSkills(merged, day) : merged;
}

export const BOARD_IDS_CYCLE = Object.keys(BOARDS_CYCLE);

// fix round: a fact that names a farm key reads it as bound now
for (const b of Object.values(BOARDS_CYCLE)) for (const it of b.items || []) keyWordProps(it, ['text']);
for (const list of Object.values(BOARD_EXTRA_ITEMS)) for (const it of [].concat(list || [])) if (it && typeof it === 'object') keyWordProps(it, ['text']);
