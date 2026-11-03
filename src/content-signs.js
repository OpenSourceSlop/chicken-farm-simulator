// Every fact on the Level 1 signs and equipment plates, with its source. Owner: package "level"
// (phase2/level); committed on main before the packages branch so props paints the 3D boards and
// ui draws the panels from the same data (PHASE2.md §5).
//
// Source rule (approved design): a fact carries a guide name only if it is in the list of guide
// facts in PHASE2.md §6.1; every other number or rule is 'general' (general broiler practice).
// No page numbers anywhere. `source` is a key of config GUIDES or an array of keys (shown joined).
//
// BOARDS: id -> { title, kicker, where, items: [{ text, source, pic? }], table? }
//   sign-*  are 3D boards (props paints them, ui opens them as a sign panel: the clock stops)
//   plates  ('feeder-box', 'silo', 'bird-scale', 'water-supply', 'drinker', 'controller-lights')
//           are a fact column inside that equipment panel
// The Phase 1 boards (sign-gate, sign-brooder) keep their 3D look from content.js; their Level 1
// item lists are here (a superset of the Phase 1 lines, with the source tags of PHASE2.md §5).
import { GUIDES, targetTempAt } from './config.js';

/** "Week 1 guide / Broiler Ventilation" from a key or keys; 'week1-4' = the four week guides. */
export function sourceLabel(src) {
  if (src === 'week1-4') return 'Week 1–4 guides';
  return [].concat(src).map((k) => GUIDES[k] || k).join(' / ');
}

// Brooder table for Level 1 (HUD days). Only day 1 (34 °C) and day 35 (20 °C) are guide values;
// the arrival day and the rows between are general practice (a straight line).
export const BROODER_ROWS_L1 = [0, 1, 2, 3, 4, 5, 6, 7, 14, 21, 28, 35].map((day) => ({
  day,
  temp: Math.round(targetTempAt(day) * 2) / 2,
  source: day === 1 || day === 35 ? ['week1', 'vent'] : 'general',
}));

export const BOARDS = {
  'sign-gate': {
    title: 'Farm gate – biosecurity', kicker: 'Before you go in', where: 'At the farm gate, beside the foot dip',
    items: [
      { text: 'Disinfect at the gate: walk through the foot dip.', source: 'bm101' },
      { text: 'Spray every vehicle before it comes onto the farm.', source: 'general' },
      { text: 'Report abnormal deaths in the flock straight away.', source: 'bm101' },
      { text: 'Change into farm clothes and farm boots before you go near the houses.', source: 'general' },
      { text: 'Dip your boots again at the house door, every time you go in.', source: 'general' },
    ],
  },
  'sign-brooder': {
    title: 'Brooder heaters – house temperature by flock age', kicker: 'Gas brooders', where: 'Inside, north wall, across from the door',
    table: { rows: BROODER_ROWS_L1, note: 'Rows marked general: a straight line between the guide’s day 1 and day 35 values.' },
    items: [
      { text: 'House temperature 34 °C on day 1, falling to 20 °C by day 35.', source: ['week1', 'vent'] },
      { text: 'Pre-heat the house so the floor reaches 28–30 °C before the chicks arrive.', source: 'week1' },
      { text: 'Read the chicks: huddled under the brooders = cold; along the walls, wings out, beaks open = hot; evenly spread, eating and drinking = comfortable.', source: 'week1-4', pic: 'spread' },
      { text: 'Measure the floor with a thermometer at chick level (T), in several places.', source: 'general' },
      { text: 'On every round, check that each brooder is burning.', source: 'general' },
    ],
  },
  'sign-water': {
    title: 'Water lines', kicker: 'Nipple drinkers', where: 'Inside, north wall, west end',
    items: [
      { text: 'Flush the water lines about 12 hours before the chicks arrive.', source: 'week1' },
      { text: 'Water flow per nipple = age in days + 20 ml/min.', source: ['bm101', 'week1'] },
      { text: 'Test it with a cup under one nipple for one minute.', source: 'general' },
      { text: 'Nipple height sets the drinking angle: chicks drink at eye level with the head a little up; raise the line as the birds grow so they stretch up to drink.', source: ['bm101', 'week1'], pic: 'nipple-angle' },
      { text: 'Day 0: nipple tip at chick eye level, about 10–12 cm above the litter.', source: 'general' },
      { text: 'Drinking angle about 45° for chicks, 75–85° for older birds.', source: 'general' },
      { text: 'Water to feed: about 1.6–2.0 litres of water per kg of feed in the first week; more when it is hot.', source: 'general' },
      { text: 'In week 1 the water used per bird should rise every day. A day without a rise is the first warning: check the filter and the lines that day.', source: 'general' },
      { text: 'Read the meter at the same time every morning.', source: 'general' },
      { text: 'Water quality: clear, no smell, pH 6–8.', source: 'general' },
    ],
  },
  'sign-vent': {
    title: 'Minimum ventilation', kicker: 'Fan timer', where: 'Inside, north wall, beside the climate controller',
    items: [
      { text: 'Minimum ventilation brings fresh air in and moisture and ammonia out, even on cold days.', source: 'vent' },
      { text: 'Fresh air per 1,000 birds: 150 m³/h at 40 g, 290 m³/h at 100 g, 480 m³/h at 200 g body weight.', source: 'general' },
      { text: 'Timer: on-seconds = cycle seconds × air needed ÷ (fans × 36,000 m³/h for one 50-inch fan). Cycle 300 s.', source: 'general' },
      { text: 'Example: 6,000 chicks of 42 g need about 900 m³/h: 1 fan, 8 s on in every 300 s.', source: 'general' },
      { text: 'More fan time than needed on a cold night takes heat out faster than the brooders can put it back.', source: 'general' },
      { text: 'The timer fans draw the air in through the side inlets, which throw it up under the roof: it mixes with the warm house air before it reaches the chicks.', source: 'general' },
      { text: 'Hot afternoon in the brooding week: the brooders go off by themselves once the house is over the thermostat. Then give the timer more fan time, for example 2 fans, 120 s on in every 300 s, and set it back by the table when the afternoon cools.', source: 'general' },
      { text: 'Keep the tunnel fans off for young chicks: air moving along the floor feels several degrees colder to them, and they pile up under the brooders.', source: 'general' },
      { text: 'Keep the litter at or below 30 % moisture.', source: 'vent' },
      { text: 'Each 5 % of humidity the air can still take up gives about 1 °C of pad cooling.', source: 'vent' },
    ],
  },
  'sign-litter': {
    title: 'Litter', kicker: 'Rice husk', where: 'Inside, north wall, at the brooding curtain',
    items: [
      { text: 'Keep the litter at or below 30 % moisture.', source: 'vent' },
      { text: 'Squeeze a handful (Q): falls apart = dry; holds, then breaks when you open the hand = right; sticks together = too wet.', source: 'general', pic: 'squeeze' },
      { text: 'Spread 5–10 cm of dry rice husk evenly before pre-heating.', source: 'general' },
      { text: 'Wet spots under the drinkers: look for a leaking nipple or too much pressure, then cover the spot with fresh litter.', source: 'general' },
    ],
  },
  'sign-chicks': {
    title: 'Chick arrival', kicker: 'Day 0', where: 'Outside the house, south wall, west of the door',
    items: [
      { text: 'On arrival check reflex, navel, hocks and uniformity.', source: 'week1' },
      { text: 'Reflex: on its back a chick rights itself within 3 s. Navel closed and dry. Hocks clean, not red.', source: 'general', pic: 'navel' },
      { text: 'Weigh a full box and take off the box weight: chick weight = net weight ÷ 100.', source: 'general' },
      { text: 'Cull weak chicks at the table: open navel, black button, no reflex.', source: 'general' },
      { text: 'Get the chicks out of the boxes quickly, near feed and water, over the whole brooding area.', source: 'general' },
      { text: 'Vent temperature 2–3 hours after placing.', source: 'week1' },
      { text: 'Vent 39.4–40.5 °C: comfortable. Lower = cold, higher = hot.', source: 'general' },
      { text: 'Crop check at 24 hours.', source: 'week1' },
      { text: 'At 24 hours at least 95 % of crops full and soft.', source: 'general', pic: 'crop' },
    ],
  },
  'sign-health': {
    title: 'Flock health', kicker: 'Every round', where: 'Outside the house, south wall, east of the door',
    items: [
      { text: 'Report abnormal deaths.', source: 'bm101' },
      { text: 'Abnormal in week 1: more than 0.3 % of the flock dying in one day (18 birds of 6,000).', source: 'general' },
      { text: 'Pick up dead birds every round, count them, put them in the bin.', source: 'general' },
      { text: 'What huddling, panting, droppings and breathing sounds tell you: firm brown droppings with a white cap / watery / none; quiet chirping / loud peeping / snicking.', source: 'week1-4', pic: 'droppings' },
      { text: 'Weak, lame or sick birds sit apart with fluffed feathers and closed eyes: cull them.', source: 'general' },
    ],
  },
  // ---- plates inside equipment panels ----
  'feeder-box': {
    title: 'Feeder lines', where: 'Feeder control box, north wall, beside the water lines sign',
    items: [
      { text: 'Days 0–3: pans on the litter (rim about 5 cm) and flooded, so the feed is easy to reach.', source: 'general', pic: 'pan-on-litter' },
      { text: 'From day 4: pan rim at the height of the birds’ backs.', source: 'general' },
      { text: 'Feed per bird per day, days 0–7: 14, 18, 22, 26, 30, 34, 38, 42 g.', source: 'general' },
    ],
  },
  silo: {
    title: 'Feed silos', where: 'Outside, north of the house',
    items: [
      { text: 'Order feed when the silos hold less than 2 days of feed. Feed ordered before 16:00 comes the next morning.', source: 'general' },
    ],
  },
  'controller-lights': {
    title: 'Light program', where: 'Climate controller, Lights',
    items: [
      { text: '23 hours of light in the brooding week.', source: 'week1' },
      { text: '30–40 lux at chick level in the first week.', source: 'general' },
    ],
  },
  'bird-scale': {
    title: 'Weighing', where: 'Bird scale, in the brooding area',
    items: [
      { text: 'Week 1 target: 4–5 × chick weight. A missed week 1 costs growth later.', source: 'week1' },
      { text: 'Weigh at least 50 birds from 5 places. Uniformity = share of birds within ±10 % of the mean.', source: 'general' },
    ],
  },
  'water-supply': {
    title: 'Water supply', where: 'Inside, south-west corner',
    items: [
      { text: 'Flush the lines about 12 hours before the chicks arrive.', source: 'week1' },
      { text: 'Read the meter at the same time each morning. In week 1 the litres per 1,000 birds should rise every day.', source: 'general' },
      { text: 'Filter gauges: the pressure after the filter falls when the filter clogs.', source: 'general' },
    ],
  },
  drinker: {
    title: 'Drinker line', where: 'Regulator at the west end of each line',
    items: [
      { text: 'Water flow per nipple = age in days + 20 ml/min.', source: ['bm101', 'week1'] },
      { text: 'Day 0: nipple tip at chick eye level, about 10–12 cm above the litter. Raise the line as the birds grow.', source: 'general' },
      { text: 'In week 1 raise the line about 1 cm a day, a little above the chicks\' eyes: about 17 cm on day 7.', source: 'general' },
      { text: 'Higher pressure (taller water column in the sight tube) gives more flow per nipple.', source: 'general' },
    ],
  },
};

/** Every board/plate id a job may link to (content-jobs.js `signs`). */
export const BOARD_IDS = Object.keys(BOARDS);
