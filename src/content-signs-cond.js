// Every fact Phase 4 adds to the signs and plates, with its source (PHASE4.md §2.5, §4) — contract data committed
// by the Phase 4 design. Owner: package "run" (may reword texts; never moves a fact to a guide: every Phase 4 line
// is general practice, and a figure of config SIGN_FIGURES must keep the figure). Shapes as content-signs-cycle.js:
//   BOARD_P4_ITEMS  board id -> { add: [{ text, source, fromDay? }], replace: [{ was, text, source }] }   every run
//                   (the tuning's figures: wind chill, panting, the evening, water : feed, the ±3 bands)
//   BOARD_COND_ITEMS condition -> board id -> [{ text, source, fromDay? }]   lines shown only in a run of that condition
//   BOARDS_COND     new boards and plates: sign-power (3D board at config SPOTS4.signPower, scene paints it),
//                   plates 'generator', 'water-tank', 'chick-grading' (panels build them)
// One merge, frozen contract code on main now: mergeBoardsP4 below, called by content-signs-cycle.js boardsForDay(day,
// condition) (the plates, the sign dialogs, the job card and the 3D boards all read it).
const g = 'general';
const it = (text, source = g, fromDay) => (fromDay != null ? { text, source, fromDay } : { text, source });

export const BOARD_P4_ITEMS = {
  'sign-heat': {
    replace: [
      { was: 'At 2.5 m/s birds of 5 weeks feel about 3–4 °C cooler, birds of 2 weeks 6–7 °C.', text: 'At 2.5 m/s birds of 5 weeks feel about 5–6 °C cooler, birds of 2 weeks about 7 °C.', source: g },
      { was: 'In the evening step the fans down as the house cools: young birds want the tunnel fans off at night, big birds still want some tunnel air on warm nights.',
        text: 'In the evening step the fans down as the house cools: young birds want the tunnel fans off at night. Big birds (from day 28) on warm evenings want every fan, and the pads while the outside air is over about 30 °C (the controller’s Outside reading), until about 21:00; then tunnel air all night.', source: g },
    ],
    add: [
      it('Moving air cools less once the air is over about 35 °C; near 40 °C it gives little: then the pads cool the birds.'),
      it('Birds of 5 weeks start to pant when they feel about 24 °C, all of them by about 28 °C (felt: the fan panel’s Birds feel reading).'),
      it('In damp air the birds feel warmer still: about 1 °C at 87 % humidity, about 2 °C at 90 %, about 4 °C at 95 % (the Birds feel reading counts it).'),
      it('Young birds on a hot afternoon: the pad with one or two tunnel fans; six fans and the pad chill them.'),
    ],
  },
  drinker: {
    add: [
      it('Set each line to age + 20 ml/min, give or take 3 ml/min (the flow test).'),
      it('Nipple height: the figure for the day on this plate, give or take 3 cm.'),
      it('Water : feed about 1.8 L/kg while the birds are comfortable; while they are hot and panting they drink more: about 2–2.5 L/kg; in a heat wave without cooling up to about 3 L/kg.', g, 8),
    ],
  },
  'feeder-box': {
    // (review round: the brooding days' limit of the pans-on-the-litter rule, PANS_ON_LITTER_CM, on the plate itself)
    add: [it('Pan rim: the figure for the day on this plate, give or take 3 cm (days 0–3, pans on the litter: 7 cm at most).')],
  },
  // (pad-pump: 'A pad in good order gives most of that, never all of it.' is Phase 3's line, content-signs-cycle.js; now checked)
};

export const BOARD_COND_ITEMS = {
  hot: {
    'sign-brooder': [it('Hot season: every afternoon the closed house runs over the chicks’ row. From day 1, about 11:00 to 18:00: the pad with one tunnel fan, the timer on the sign’s setting; the brooders stay on their thermostat and burn only in the cool hours. Two fans and the pad chill the chicks.')],
    'sign-vent': [it('Hot season: on hot afternoons the one tunnel fan with the pad is the exception to “tunnel fans off for young chicks” (brooder sign).')],
    'sign-heat': [it('Hot season: every afternoon is hot. Young birds (days 8–20): the pad from about 11:00 into the evening, with one tunnel fan in week 2 and two or three in week 3. Big birds: the pads with every fan from about 11:00; in the hot season keep the pads on while the outside air stays over about 30 °C, often all night.')],
    drinker: [it('Hot season: the water in the lines warms under the roof; over about 30 °C the birds drink less. The water supply shows each line’s water temperature: flush the warm water out in the early afternoon.')],
    'pad-pump': [it('Hot season: check the water on the pad every day; a dry stripe on a 40 °C afternoon lets the heat straight in.')],
    'sign-catch': [it('Hot season: catch in the coolest hours, after midnight, and keep every fan running for the birds still inside.')],
  },
  rainy: {
    'sign-vent': [it('Rainy season: the outside air is already damp. Step the minimum ventilation up every morning, and about a quarter over the table while the house reads over 80 % at dawn; the damp does not leave by itself.')],
    'sign-litter': [it('Storms drive rain in through the side-wall inlets: close the storm flaps on the south inlets while it storms; open them again after.')],
    'pad-pump': [it('In the damp air of the rainy season a pad cools only about 2–4 °C.')],
    // review round: the reading the rainy ideal follows (general practice; the fan panel's Birds feel against the row)
    'sign-heat': [it('Rainy season: on damp afternoons (the house over about 85 %) the birds keep their heat. When the fan panel’s Birds feel reads well over the brooder sign’s row, switch on tunnel fans one at a time until it reads near the row: one or two for young birds, as many as it needs for big birds. The pad gives little cooling in air this damp.', g, 8)],
    'sign-health': [it('Wet litter in the rainy season: watch the droppings for blood (coccidiosis) and the feet for sores.', g, 8)],
  },
  badChicks: {
    'sign-chicks': [
      it('Chicks under about 38 g, or many with open navels and slow reflexes: a weak batch (often a young parent flock or a long trip). Grade every stack at the chick table and cull the weak ones before they go on the floor.'),
      it('Weak chicks with open navels carry yolk-sac infection: left in the flock most of them die in the first week, and they take some of the others with them.'),
      it('A weak batch: about 1 °C warmer for the first 3 days, feed trays and chick paper by the brooders, and feel the crops again at 48 hours.'),
      it('Tell the hatchery the same day, before 24:00: the chicks you grade out on the day they come are claimed back.'),
    ],
    'sign-brooder': [it('Small or weak chicks: about 1 °C over the table for the first 3 days.')],
  },
  water: {
    'water-supply': [
      it('Iron in well water over about 0.3 mg/L clogs the filter and the nipples and leaves rust stains: read the filter gauges every few days.'),
      it('The water test kit reads iron, pH and chlorine.'),
    ],
    'sign-water': [it('Water per bird should rise every day; a fall, most of all in the afternoon, is a warning: check the tank, the pump, the filter and the lines.')],
  },
};

export const BOARDS_COND = {
  // ---------------- 3D board (scene paints it at config SPOTS4.signPower; rainy season only) ----------------
  // the figures are the model's in the rainy season's storm (tuning-refs-cond CUT_REFS_P4: 10 / 30 / 120 min)
  'sign-power': {
    title: 'Power cut', kicker: 'The generator', where: 'Outside, beside the generator, west of the house', condition: 'rainy',
    items: [
      it('The controller’s alarm sounds when the power fails: the fans, the pad pump, the lights and the augers stop. Every minute counts: the farm clock slows while the house is dark.'),
      it('Without fans big birds overheat at once: within minutes the first die; after half an hour about 4 in 1,000; after two hours one or two in every hundred.'),
      it('Start the generator (about 2 minutes to full power), then switch the house over to it; check the fans turn.'),
      it('When the mains comes back: switch the house back to the mains, then stop the generator. Left on, it runs dry and the house goes dark again.'),
      it('Test-run the generator every week and keep its tank full.'),
    ],
  },
  // ---------------- plates (a fact column inside the panel) ----------------
  generator: {
    title: 'Generator', where: 'Generator house, west of the house', condition: 'rainy',
    items: [it('Fuel: 150 L, about 10 hours at full load (the panel shows the hours left).'), it('From the start key to full power: about 2 minutes.'), it('Test run: 10 minutes every week.')],
  },
  'water-tank': {
    title: 'Water tank and well pump', where: 'Water tank tower, north-west of the house', condition: 'water',
    items: [
      it('The well pump fills the 6 m³ tank; the drinker lines and the cooling pads draw on it, most in the afternoon.'),
      it('On a hot afternoon the pads draw about 700–1,200 L an hour; the birds drink about 100–150 L an hour.'),
      it('A pump in good order: about 2.4 bar and 6 A. A worn pump: pressure low, current high, and the tank falls in the afternoons.'),
      it('The gauge’s marker stays at the lowest level since the last reading.'),
      it('Under about 30 % the pump gives less than the house draws. Repair a worn pump in the morning, before the afternoon’s drinking (about 2 hours).'),
    ],
  },
  'chick-grading': {
    title: 'Grading the chicks', where: 'Chick sample table, outside the house door', condition: 'badChicks',
    items: [
      it('Grade out the weak chicks: open navel or black button, slow to stand, very small.'),
      it('Red hocks and small but lively chicks stay in, close to the brooders.'),
      it('Chicks graded out on the day they come are counted apart and claimed from the hatchery once you tell it.'),
    ],
  },
};
export const BOARD_IDS_COND = Object.keys(BOARDS_COND);

/**
 * The merge of every Phase 4 line into a day's boards (content-signs-cycle.js boardsForDay calls it; frozen
 * contract code of the Phase 4 design). `boards`: the Phase 2 + 3 boards of the day; `condition`: farm.condition.
 * BOARD_P4_ITEMS only while config PHASE4.tunedSigns (the tuned model is live); a condition's lines and boards only
 * in its run. Lines with fromDay show from that day. Returns a new object; the inputs are never changed.
 */
export function mergeBoardsP4(boards, day, condition, { tuned = false } = {}) {
  const due = (x) => x.fromDay == null || day >= x.fromDay;
  const strip = ({ text, source }) => ({ text, source });
  const out = { ...boards };
  if (condition) for (const [id, b] of Object.entries(BOARDS_COND)) if (b.condition === condition) out[id] = b;
  const edit = (id, fn) => { if (out[id]) out[id] = { ...out[id], items: fn(out[id].items) }; };
  if (tuned) for (const [id, p] of Object.entries(BOARD_P4_ITEMS)) edit(id, (items) => [...items.map((x) => { const r = (p.replace || []).find((q) => q.was === x.text); return r ? strip(r) : x; }), ...(p.add || []).filter(due).map(strip)]);
  if (condition && BOARD_COND_ITEMS[condition]) for (const [id, list] of Object.entries(BOARD_COND_ITEMS[condition])) edit(id, (items) => [...items, ...list.filter(due).map(strip)]);
  return out;
}
