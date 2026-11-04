// Every fact Phase 4 adds to the signs and plates, with its source (PHASE4.md §2.5, §4) — contract data committed
// by the Phase 4 design. Owner: package "run" (may reword texts; never moves a fact to a guide: every Phase 4 line
// is general practice, and a figure of config SIGN_FIGURES must keep the figure). Shapes as content-signs-cycle.js:
//   BOARD_P4_ITEMS  board id -> { add: [{ text, source, fromDay? }], replace: [{ was, text, source }] }   every run
//                   (the tuning's figures: wind chill, panting, the evening, water : feed, the ±3 bands)
//   BOARD_COND_ITEMS condition -> board id -> [{ text, source, fromDay? }]   lines shown only in a run of that condition
//   BOARDS_COND     new boards and plates: sign-power (3D board at config SPOTS4.signPower, scene paints it),
//                   plates 'generator', 'water-tank', 'chick-grading' (panels build them)
// The run package merges them in boardsForDay(day, condition) (content-signs-cycle.js; one merge function, as Phase 3).
const g = 'general';
const it = (text, source = g, fromDay) => (fromDay != null ? { text, source, fromDay } : { text, source });

export const BOARD_P4_ITEMS = {
  'sign-heat': {
    replace: [
      { was: 'At 2.5 m/s birds of 5 weeks feel about 3–4 °C cooler, birds of 2 weeks 6–7 °C.', text: 'At 2.5 m/s birds of 5 weeks feel about 5–6 °C cooler, birds of 2 weeks about 7 °C.', source: g },
      { was: 'In the evening step the fans down as the house cools: young birds want the tunnel fans off at night, big birds still want some tunnel air on warm nights.',
        text: 'In the evening step the fans down as the house cools: young birds want the tunnel fans off at night. Big birds (from week 5) on warm evenings want every fan, and the pads while the outside air is over about 30 °C, until about 21:00; then tunnel air all night.', source: g },
    ],
    add: [
      it('Moving air cools less once the air is over about 35 °C; near 40 °C it gives little: then the pads cool the birds.'),
      it('Birds of 5 weeks start to pant when they feel about 24 °C, all of them by about 28 °C (felt: the house less the wind chill).'),
      it('Young birds on a hot afternoon: the pad with one or two tunnel fans; six fans and the pad chill them.'),
    ],
  },
  drinker: {
    add: [
      it('Set each line to age + 20 ml/min, give or take 3 ml/min (the flow test).'),
      it('Nipple height: the figure for the day on this plate, give or take 3 cm.'),
      it('Water : feed about 1.8 L/kg while the birds are comfortable; on hot days they drink more: about 2–2.5 L/kg; in a heat wave up to about 3 L/kg.', g, 8),
    ],
  },
  'feeder-box': {
    add: [it('Pan rim: the figure for the day on this plate, give or take 3 cm.')],
  },
  'pad-pump': {
    add: [it('A pad in good order gives most of that, never all of it.')],
  },
};

export const BOARD_COND_ITEMS = {
  hot: {
    'sign-brooder': [it('Hot season: the brooders run only in the cool hours. On hot afternoons the chicks need air: step the timer up, then one or two tunnel fans.')],
    'sign-heat': [it('Hot season: every afternoon is hot. Big birds want the pads with the tunnel fans from about 11:00, and on into the evening.')],
    drinker: [it('Hot season: water in the lines over about 30 °C and the birds drink less. Flush the warm water out of each line at midday.')],
    'pad-pump': [it('Hot season: check the water on the pad every day; a dry stripe on a 40 °C afternoon lets the heat straight in.')],
    'sign-catch': [it('Hot season: catch in the coolest hours, after midnight, and keep every fan running for the birds still inside.')],
  },
  rainy: {
    'sign-vent': [it('Rainy season: the outside air is already damp. Step the minimum ventilation up early and keep it up; the damp does not leave by itself.')],
    'sign-litter': [it('Storms drive rain in through the side-wall inlets: close the storm flaps on the south inlets while it storms; open them again after.')],
    'pad-pump': [it('In the damp air of the rainy season a pad cools only about 2–4 °C.')],
    'sign-health': [it('Wet litter in the rainy season: watch the droppings for blood (coccidiosis) and the feet for sores.', g, 8)],
  },
  badChicks: {
    'sign-chicks': [
      it('Chicks under about 38 g, or many with open navels and slow reflexes: a weak batch (often a young parent flock or a long trip). Grade every stack and cull the weak ones at once.'),
      it('A weak batch: about 1 °C warmer for the first 3 days, feed trays and chick paper by the brooders, and feel the crops again at 48 hours.'),
      it('Tell the hatchery the same day: the chicks you grade out are claimed back.'),
    ],
    'sign-brooder': [it('Small or weak chicks: about 1 °C over the table for the first 3 days.')],
  },
  water: {
    'water-supply': [
      it('Iron in well water over about 0.3 mg/L clogs the filter and the nipples and leaves rust stains: read the filter gauges every few days.'),
      it('The water test kit reads iron, pH and chlorine.'),
    ],
    'sign-water': [it('Water per bird should rise every day; a fall, most of all in the afternoon, is the first warning: check the tank, the pump, the filter and the lines.')],
  },
};

export const BOARDS_COND = {
  // ---------------- 3D board (scene paints it at config SPOTS4.signPower; rainy season only) ----------------
  'sign-power': {
    title: 'Power cut', kicker: 'The generator', where: 'Outside, beside the generator, west of the house', condition: 'rainy',
    items: [
      it('The controller’s alarm sounds when the power fails: the fans, the pad pump, the lights and the augers stop.'),
      it('Without fans big birds overheat at once: after half an hour the first die, after two hours a few in every hundred.'),
      it('Start the generator, then switch the house over to it; check the fans turn.'),
      it('When the mains comes back: switch the house back to the mains, then stop the generator.'),
      it('Test-run the generator every week and keep its tank full.'),
    ],
  },
  // ---------------- plates (a fact column inside the panel) ----------------
  generator: {
    title: 'Generator', where: 'Generator house, west of the house', condition: 'rainy',
    items: [it('Fuel: 150 L, about 10 hours at full load.'), it('From the start key to full power: about 2 minutes.'), it('Test run: 10 minutes every week.')],
  },
  'water-tank': {
    title: 'Water tank and well pump', where: 'Water tank tower, north-west of the house', condition: 'water',
    items: [
      it('The well pump fills the 10 m³ tank; the house draws on it most in the afternoon.'),
      it('Tank under about 30 % in the afternoon: the pump gives less than the birds drink. Check its pressure and current.'),
      it('A worn pump: pressure low, current high. Repair it in the morning, before the afternoon’s drinking.'),
    ],
  },
  'chick-grading': {
    title: 'Grading the chicks', where: 'Chick sample table, outside the house door', condition: 'badChicks',
    items: [
      it('Grade out the weak chicks: open navel or black button, slow to stand, very small.'),
      it('Red hocks and small but lively chicks stay in, close to the brooders.'),
      it('Graded-out chicks are counted apart and claimed from the hatchery.'),
    ],
  },
};
export const BOARD_IDS_COND = Object.keys(BOARDS_COND);
