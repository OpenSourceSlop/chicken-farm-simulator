// Shared layout and model constants. Units: metres, °C, game hours.
// World axes: X runs along the chicken house (west = -X, east = +X), Z runs across it
// (north = -Z, south = +Z), Y is up. Ground is y = 0. The default camera looks north.

export const HOUSE = {
  length: 48,            // x from -24 to +24
  width: 12,             // z from -6 to +6
  wallHeight: 2.6,
  wallThickness: 0.15,
  stubHeight: 0.6,       // height a wall drops to when cut away for the camera
  door: { x: -14, z: 6, width: 1.8 }, // door in the south wall
  broodCurtainX: 2,      // brooding curtain across the house while chicks are young
  broodUntilDay: 10,     // after this flock age the curtain is gone and birds use the whole house
};

export const HOUSE_BOUNDS = { xMin: -24, xMax: 24, zMin: -6, zMax: 6 };
// Usable bird floor (inside walls, clear of the pad and fan ends)
export const BIRD_BOUNDS = { xMin: -23.2, xMax: 23.2, zMin: -5.6, zMax: 5.6 };
export const BROOD_BOUNDS = { xMin: -23.2, xMax: 1.8, zMin: -5.6, zMax: 5.6 };

// Gas brooders hanging over the brooding area (pancake brooders, 1.5 m up)
export const HEATERS = [-19, -13, -7, -1].flatMap((x) => [{ x, z: -2.6 }, { x, z: 2.6 }]);
export const HEATER_HEIGHT = 1.5;

export const FEEDER_LINES_Z = [-3.9, 0, 3.9];
export const DRINKER_LINES_Z = [-4.9, -1.95, 1.95, 4.9];
export const LINE_X = { start: -22.5, end: 22.5 };
export const FEEDER_PAN_SPACING = 0.76;
export const NIPPLE_SPACING = 0.3;
// Exact x of every feeder pan and drinker nipple along each line. house.js draws them here and the
// flock eats and drinks here (the pans start 0.6 m in from the hopper end, the nipples 0.45 m).
export const FEEDER_PAN_X = [];
for (let x = LINE_X.start + 0.6; x <= LINE_X.end - 0.45; x += FEEDER_PAN_SPACING) FEEDER_PAN_X.push(+x.toFixed(3));
export const NIPPLE_X = [];
for (let x = LINE_X.start + 0.45; x <= LINE_X.end - 0.2; x += NIPPLE_SPACING) NIPPLE_X.push(+x.toFixed(3));
// Where the feed auger from the silos passes through the north wall into the house: the house's
// cross auger runs from here over the feeder-line hoppers (at LINE_X.start - 0.25); the world's
// feed auger rises from the silo boots to meet it at the outside face of the wall.
export const FEED_INLET = { x: LINE_X.start - 0.25, y: 2.42 };

export const FAN_COUNT = 6;            // tunnel fans in the east end wall (x = +24), 2 rows of 3
export const FAN_DIAMETER = 1.27;      // 50-inch fans
export const PAD = { x: -24, height: 2.0, bottom: 0.4 }; // cooling pad covers the west end wall

// Fixed interactive spots (world.js and house.js build the 3D objects; ui.js reads these)
export const SPOTS = {
  // Both boards hang on north-wall columns across from the door, facing south (toward the camera)
  controller: { x: -12.0, z: -5.8, label: 'Climate controller', inside: true },
  signBrooder: { x: -16.0, z: -5.8, label: 'Brooder heaters sign', inside: true },
  signGate: { x: -35.5, z: 35.6, label: 'Farm gate sign', inside: false },
  houseDoor: { x: -14, z: 6.9, label: 'House door', inside: false },
};

export const FARM = {
  fence: { xMin: -56, xMax: 56, zMin: -36, zMax: 38 },
  gate: { x: -40, z: 38, width: 6 },
  spawn: { x: -38, z: 34, yaw: 0 }, // just inside the gate, facing north
  office: { x: -32, z: 23, w: 7, d: 5 },
  guardHut: { x: -47, z: 34, w: 3, d: 3 },
  footDipGate: { x: -35.5, z: 37 },
  footDipHouse: { x: -14, z: 6.9 },
  silos: [{ x: -20, z: -9.6 }, { x: -16.5, z: -9.6 }],
  waterTank: { x: -34, z: -12 },
  generator: { x: -32, z: 6, w: 4, d: 3 },
  road: [ // polyline of the farm road centre, 5 m wide
    { x: -40, z: 40 }, { x: -40, z: 14 }, { x: 30, z: 14 },
  ],
  doorPath: [{ x: -14, z: 14 }, { x: -14, z: 6.2 }], // 2.5 m wide concrete path to the door
};

export const FLOCK_COUNT = 1800;

// Target house temperature by flock age. The guides give 34 °C on day 1 and 20 °C by day 35;
// days between are a straight line until the full table from content-map.md is loaded.
export function targetTempAt(day) {
  if (day <= 1) return 34;
  if (day >= 35) return 20;
  return 34 - ((day - 1) * 14) / 34;
}

// Typical broiler body weight (grams) by age, for growth visuals. General practice.
const WEIGHT_TABLE = [[0, 42], [7, 190], [14, 480], [21, 950], [28, 1550], [35, 2200], [42, 2850]];
export function weightAt(day) {
  const d = Math.max(0, Math.min(42, day));
  for (let i = 1; i < WEIGHT_TABLE.length; i++) {
    const [d1, w1] = WEIGHT_TABLE[i];
    const [d0, w0] = WEIGHT_TABLE[i - 1];
    if (d <= d1) return w0 + ((w1 - w0) * (d - d0)) / (d1 - d0);
  }
  return WEIGHT_TABLE[WEIGHT_TABLE.length - 1][1];
}

// Weather presets: outside temperature daily min/max and relative humidity
export const WEATHER = {
  cool: { label: 'Cool season', min: 19, max: 29, rh: 60 },
  normal: { label: 'Normal', min: 24, max: 33, rh: 65 },
  hot: { label: 'Hot season', min: 28, max: 38, rh: 55 },
  rainy: { label: 'Rainy season', min: 24, max: 30, rh: 85 },
};

export const TIME = {
  startDay: 1,
  startHour: 8,
  gameSecondsPerRealSecond: 360, // one game day takes 4 real minutes at normal speed
  sunrise: 6,
  sunset: 18.5,
};

// Shared palette for 3D materials (flat colours, low-poly look)
export const COLORS = {
  grass: 0x7fae4e,
  grassDark: 0x5f8f3a,
  soil: 0xa86f45,
  road: 0xb9a48a,
  concrete: 0xc9c4b8,
  litter: 0xd9b979,       // rice-husk litter
  wallWhite: 0xeeeae0,
  wallLow: 0xb8b2a6,      // concrete kick wall
  curtain: 0x2f6b5b,      // green sidewall curtain
  steel: 0xaeb6bd,
  steelDark: 0x6d757c,
  pad: 0xc98a4a,          // cellulose cooling pad
  feederPan: 0xe0582c,
  drinkerPipe: 0xdedede,
  nippleCup: 0xd8322f,
  heater: 0x9aa3a8,
  heaterGlow: 0xff7a1f,
  roofBlue: 0x3f6f9e,
  roofRed: 0xb5523b,
  water: 0x6aa8c8,
  paddy: 0x9cc65a,
  chick: 0xf5d36b,
  broiler: 0xf4f1ea,
  comb: 0xd8322f,
  beak: 0xf2a33a,
  farmerSuit: 0x3b6ea5,
  farmerBoots: 0xf0f0ea,
  skin: 0xc68b5c,
};

// ================================================================================================
// Phase 2 (Level 1, the brooding week). Shared constants: every package reads these, nobody edits
// them without the integrator. See PHASE2.md for what each one means and where it comes from.
// Values a farmer would read off a sign carry their source in PHASE2.md / content-signs.js;
// numbers marked "model" are tuning constants of the simulation, never shown as facts.
// ================================================================================================

// Flock days: day 0 = placement day (the chicks arrive at LEVEL1.arrivalHour), day -1 = prep day.
// sim.js clamps env.dayNumber to MIN_DAY..MAX_DAY. Phase 1 (sandbox) keeps using days 1..42.
export const MIN_DAY = -1;
// Two clocks in a level (PHASE2.md §2):
//   calendar day N = env.dayNumber (the HUD's "Day N", changes at midnight). Job windows, record
//     rows and everything the farmer reads off a sign by day ("day 3: 33 °C", "age + 20 ml/min")
//     use it.
//   flock age a = env.day - PLACEMENT_DAY (days since 08:00 on day 0; negative before). The model's
//     continuous rates (intake, growth, need for water, nipple and pan height) use it. Day 7 08:00
//     is age 7.0, the earliest weigh-in.
export const PLACEMENT_DAY = 0 + 8 / 24;   // = LEVEL1.arrivalDay + LEVEL1.arrivalHour / 24
export const flockAgeAt = (envDay) => envDay - PLACEMENT_DAY;

// The six guides. Every sign fact carries one of these keys, or 'general'.
export const GUIDES = {
  week1: 'Week 1 guide',
  week2: 'Week 2 guide',
  week3: 'Week 3 guide',
  week4: 'Week 4 guide',
  vent: 'Broiler Ventilation',
  bm101: 'Broiler Management 101',
  general: 'general practice',
};

// Level 1: from the prep day to the day 7 weigh-in.
export const LEVEL1 = {
  id: 'level1',
  title: 'Level 1 – The brooding week',
  startDay: -1, startHour: 7,         // prep day, 07:00 at the farm gate
  arrivalDay: 0, arrivalHour: 8,      // chick truck at the house door
  endDay: 7,                          // the level ends when the day 7 record is signed
  weather: 'cool',
  chicksPlaced: 6000,                 // 60 boxes of 100; FLOCK_COUNT instances draw them
  boxes: 60, chicksPerBox: 100, stacks: 6, // boxes come in 6 stacks of 10; one carry = one stack
  chickWeightG: 41.5,                 // mean day-old weight of this delivery (model; seeded +-1 g)
  // Clock: game seconds per real second while the level runs (Phase 1 sandbox keeps TIME).
  //   work   walking about (one farm hour = 30 s)
  //   panel  an equipment or inspection panel is open (a 1-minute flow test takes 2 s)
  //   carry  carrying chick boxes, the barrow or the catching frame, and from the truck stopping
  //          until the last stack is tipped (placing 6,000 chicks takes about 30-45 farm minutes)
  //   sign   a sign board or a plate is open: 0 = the clock stands still while you read
  //   fast   the 4x button on the time bar
  // The records book, notebook, skill tree and result screen also stop the clock.
  clock: { work: 120, fast: 480, panel: 30, carry: 30, sign: 0 },
  // Job rounds (game hours). A job is open inside its window; when the window ends it is "missed".
  rounds: {
    am: { from: 6, to: 12, label: 'Morning round' },
    pm: { from: 13, to: 18, label: 'Afternoon round' },
    eve: { from: 16, to: 24, label: 'Evening' },
    prep: { from: 7, to: 24, label: 'Prep day' },
  },
  siloStartKg: 1100,                  // starter feed in the silos at 07:00 on the prep day (model)
  // Level result thresholds. Week 1 target 4-5 x chick weight is the Week 1 guide; the mortality
  // limit is general practice.
  targetRatio: [4, 5],
  fail: { weightRatioMin: 4.0, mortalityMaxPct: 2.0 },
  // Problem events of the slice, one a day from day 1 (calendar day, game hour they start).
  // The farm starts them silently; a problem job opens only on a symptom (PHASE2.md §7).
  problems: [
    { id: 'brooder-out', day: 1, hour: 5, heater: 5 },          // index into HEATERS: the flame goes out
    { id: 'cold-night', day: 2, hour: 19, outsideDrop: 6, until: { day: 3, hour: 7 } },
    { id: 'blocked-filter', day: 3, hour: 10, flowFactor: 0.5 }, // main filter at the water supply: every line's flow x 0.5
    { id: 'leaking-nipple', day: 4, hour: 10, line: 2, x: -9.15 },
    { id: 'low-silo', day: 4, hour: 6 },                        // no event: the silo simply runs low (siloStartKg)
    { id: 'warm-afternoon', day: 6, hour: 11, outsideRise: 4, until: { day: 6, hour: 17 } },
  ],
};

// One drawn bird stands for this many real birds in the records.
export const BIRDS_PER_INSTANCE = LEVEL1.chicksPlaced / FLOCK_COUNT;

// Grid the farm model keeps over the house floor (litter cover, moisture, floor temperature).
export const FLOOR_GRID = { cell: 1.0, nx: 48, nz: 12, x0: HOUSE_BOUNDS.xMin, z0: HOUSE_BOUNDS.zMin };

// Equipment (model values; flow and heights are what the farmer sets on the panels).
export const EQUIP = {
  fanM3h: 36000,                      // one 50-inch tunnel fan, m3/h (general practice)
  nippleHeightCm: [5, 60],            // winch range of a drinker line (tip above litter)
  feederHeightCm: [0, 45],            // pan rim range
  pressureCm: [2, 40],                // regulator sight-tube column
  litterDepthCm: [2, 5, 8, 10],       // choices at the litter heap
  siloCapacityKg: 6000,
  luxMax: 60,                         // at bird level with the dimmer at 100 %
};

// Air through the house: ONE figure for heat loss, humidity and ammonia (PHASE2.md §6.2).
// env.airflowM3h = infiltrationM3h + (manual fans + timer fans x duty) x EQUIP.fanM3h.
// Heat exchange toward the inlet air, per hour = wallLossPerH + airflowM3h / thermalM3. With these
// numbers the house loses heat exactly as in Phase 1 (0.25 + 0.9 per running fan per hour), so the
// sandbox is unchanged. thermalM3 is the air plus the heat stored in walls, litter and equipment.
export const AIR = { infiltrationM3h: 300, thermalM3: 40000, wallLossPerH: 0.25 - 300 / 40000 }; // model

// Minimum ventilation: fresh air needed per 1,000 birds by body weight (general practice; the
// numbers on sign-vent). [body weight g, m3/h per 1,000 birds]; straight line between, flat outside.
export const MIN_VENT_PER_1000 = [[40, 150], [100, 290], [200, 480]];
export function minVentM3hPer1000(weightG) {
  const t = MIN_VENT_PER_1000;
  if (weightG <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [w1, q1] = t[i], [w0, q0] = t[i - 1];
    if (weightG <= w1) return q0 + ((q1 - q0) * (weightG - w0)) / (w1 - w0);
  }
  return t[t.length - 1][1];
}

// Standard feed intake, g per bird per day at flock age a (general practice). The feeder plate
// shows it per HUD day: 14, 18, 22, 26, 30, 34, 38, 42 g on days 0-7 (the value at mid-day).
export const feedStdGAt = (age) => (age < 0 ? 0 : 12 + 4 * age);

// Interactive spots added in Phase 2. house/world/props build the objects here; ui/jobs read them.
// Boards on the north wall face south like Phase 1's (stand at z ~ -4.6 and press E).
export const SPOTS2 = {
  // between the water and brooder signs: clear of the line 1 drinker regulator at x -22.2
  feederBox: { x: -18.0, z: -5.8, label: 'Feeder control box', inside: true },
  signWater: { x: -20.0, z: -5.8, label: 'Water lines sign', inside: true },
  signVent: { x: -8.0, z: -5.8, label: 'Minimum ventilation sign', inside: true },
  signLitter: { x: 0.0, z: -5.8, label: 'Litter sign', inside: true },
  waterSupply: { x: -23.2, z: 5.0, label: 'Water meter and flush valves', inside: true },
  // drinker line regulators at the west end of each line (one per DRINKER_LINES_Z entry)
  drinkers: DRINKER_LINES_Z.map((z, i) => ({ x: -22.2, z, label: `Drinker line ${i + 1}`, inside: true })),
  birdScale: { x: -6.0, z: -1.0, label: 'Bird scale', inside: true },
  // outside the house
  signChicks: { x: -17.0, z: 6.4, label: 'Chick arrival sign', inside: false },
  signHealth: { x: -11.0, z: 6.4, label: 'Flock health sign', inside: false },
  deadBin: { x: -10.4, z: 7.9, label: 'Dead bird bin', inside: false },
  chickTable: { x: -11.8, z: 9.2, label: 'Chick sample table', inside: false },
  boxStacks: { x: -15.6, z: 9.6, dx: 0.75, label: 'Chick boxes', inside: false }, // 6 stacks along +x
  litterHeap: { x: -19.0, z: 8.8, label: 'Rice husk heap', inside: false },
  silo: { x: -18.25, z: -8.1, label: 'Feed silos', inside: false },
  officeDesk: { x: -34.1, z: 26.3, label: 'Office: flock records', inside: false },
  truckStop: { x: -9.5, z: 14.0, yaw: 0 },  // chick truck parks on the farm road, tail at the path
};

// Skill tree: the 11 branches from the plan doc. Phase 2 makes two earnable; the rest show as "later levels".
export const SKILL_BRANCHES = [
  { id: 'planning', name: 'Farm Planning', earnable: false },
  { id: 'biosecurity', name: 'Biosecurity & Health', earnable: false },
  { id: 'brooding', name: 'Chick Arrival & Brooding', earnable: true },
  { id: 'comfort', name: 'Body Temperature & Comfort', earnable: false },
  { id: 'ventilation', name: 'Heat & Ventilation', earnable: false },
  { id: 'moisture', name: 'Moisture & Minimum Ventilation', earnable: false },
  { id: 'heating', name: 'Heating', earnable: false },
  { id: 'water', name: 'Water', earnable: true },
  { id: 'feed', name: 'Feed & Digestion', earnable: false },
  { id: 'lighting', name: 'Lighting', earnable: false },
  { id: 'growth', name: 'Growth & Performance', earnable: false },
];
// Points needed for branch levels 1, 2, 3 (level 3 is not reachable in Level 1).
export const SKILL_LEVEL_POINTS = [4, 9, 15];
// What a branch level unlocks (tool or view). Keys are read by props (overlay) and ui (graphs).
export const UNLOCKS = {
  floorOverlay: { branch: 'brooding', level: 1, name: 'Floor thermometer view' },
  brooderChart: { branch: 'brooding', level: 2, name: '24-hour temperature chart on the controller' },
  waterTrend: { branch: 'water', level: 1, name: 'Water meter trend graph' },
  lineOverview: { branch: 'water', level: 2, name: 'All-lines water overview' },
};

// Floor thermometer view (unlock floorOverlay): litter surface °C -> sRGB colour, continuous blue
// (cool) to orange (warm), no good / bad colours. props-floor paints the floor with it; the ui
// draws the same ramp as the °C legend.
export const FLOOR_TEMP_RAMP = [[24, [0.18, 0.37, 0.82]], [27, [0.42, 0.66, 0.92]], [30, [0.95, 0.85, 0.58]], [33, [0.95, 0.62, 0.3]], [36, [0.86, 0.36, 0.1]]];

// localStorage keys (always inside try/catch, see save.js)
export const SAVE = { key: 'chickenFarm.level1.v1', profileKey: 'chickenFarm.profile.v1', version: 1 };

// Sample spread: the brooding floor in 6 sectors (west / middle / east x north / south half).
// Vent, crop and weighing samples count how many different sectors they came from.
export function broodSector(x, z) {
  const b = BROOD_BOUNDS, t = (x - b.xMin) / (b.xMax - b.xMin);
  const col = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
  return col * 2 + (z < 0 ? 0 : 1);
}

// Nipple tip height (cm above the litter) a line should have at a flock age: chick eye level on
// day 0, then raised so the birds stretch up to drink (general practice; same curve as Phase 1's
// automatic line height in house-drinkers.js).
const NIPPLE_CM = [[0, 11], [1, 12], [7, 17], [14, 24], [21, 31], [28, 37], [35, 42], [42, 45]];
export function nippleHeightCmAt(day) {
  const d = Math.max(0, Math.min(42, day));
  for (let i = 1; i < NIPPLE_CM.length; i++) {
    const [d1, h1] = NIPPLE_CM[i], [d0, h0] = NIPPLE_CM[i - 1];
    if (d <= d1) return h0 + ((h1 - h0) * (d - d0)) / (d1 - d0);
  }
  return 45;
}
// Water flow a nipple should give: age in days + 20 ml/min (Broiler Management 101 / Week 1 guide).
// Signs and milestones pass the HUD day number; the model passes flock age.
export const flowTargetAt = (day) => Math.max(0, day) + 20;

// Feeder pan rim height (cm above the litter) by flock age: on the litter, flooded, for the first
// days, then at the birds' back (general practice). Phase 1's table in house-feeders.js, keyed by
// flock age (Phase 1 day 1 = age 0); the sim and props both read this one.
const RIM_CM = [[0, 5], [6, 9], [13, 15], [20, 22], [27, 28], [34, 33], [41, 35]];
export function feederRimCmAt(age) {
  const d = Math.max(0, Math.min(41, age));
  for (let i = 1; i < RIM_CM.length; i++) {
    const [d1, h1] = RIM_CM[i], [d0, h0] = RIM_CM[i - 1];
    if (d <= d1) return h0 + ((h1 - h0) * (d - d0)) / (d1 - d0);
  }
  return 35;
}
