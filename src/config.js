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
  // where the farmer may walk: the fenced farm plus the first 5 m of the farm road outside the gate
  // (the road's guard-post colliders and the fence keep him on it), so the level spawn outside the
  // gate (spawn, z 40.5) lies inside the player's clamp
  walk: { xMin: -56, xMax: 56, zMin: -36, zMax: 43 },
  gate: { x: -40, z: 38, width: 6 },
  spawn: { x: -40, z: 40.5, yaw: 0 }, // Level 1: outside the gate on the farm road, facing north: walking in crosses the dip
  spawnSandbox: { x: -38, z: 34, yaw: 0 }, // Phase 1 sandbox: just inside the gate, facing north (as approved)
  office: { x: -32, z: 23, w: 7, d: 5 },
  guardHut: { x: -47, z: 34, w: 3, d: 3 },
  footDipGate: { x: -40, z: 36.9, hw: 2.2, hd: 0.5 }, // across the gateway, just inside the gate rail (tray half sizes)
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

// Flock days: day 0 = placement day (the chicks arrive at LEVEL1.arrivalHour), day -1 = prep day,
// day -2 = the planning day of Phase 3 (PHASE3.md §2.1). sim.js clamps env.dayNumber to
// MIN_DAY..env.maxDay (42; 70 in the clean-out level). Phase 1 (sandbox) keeps using days 1..42.
export const MIN_DAY = -2;
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

// A job is never missed while the farmer is doing it (PHASE4.md §15.2, model): an open job reaching its close while
// its panel is open, he stands at its place, holds its bird or carries its tool closes graceMin farm minutes later
// (again each time, so he has graceMin after he stops); the job card warns from warnMin farm minutes before a close.
export const JOB_HOLD = { graceMin: 20, warnMin: 30, placeM: 2.5 };

// Level 1: from the prep day to the day 7 weigh-in.
export const LEVEL1 = {
  id: 'level1',
  n: 2, short: 'The brooding week',  // Phase 3: the second level of the run (PHASE3.md §2.1)
  title: 'Level 2 – The brooding week', // titles carry the run number (Phase 2 said "Level 1")
  startDay: -1, startHour: 7,         // prep day, 07:00 at the farm gate
  arrivalDay: 0, arrivalHour: 8,      // chick truck at the house door
  endDay: 7,                          // the level ends when the day 7 record is signed
  weather: 'cool',
  chicksPlaced: 6000,                 // 60 boxes of 100; FLOCK_COUNT instances draw them
  boxes: 60, chicksPerBox: 100, stacks: 6, // boxes come in 6 stacks of 10; one carry = one stack
  chickWeightG: 41.5,                 // mean day-old weight of this delivery (model; seeded +-1 g)
  // Clock: game seconds per real second while the level runs (Phase 1 sandbox keeps TIME).
  // The farmer's request during Phase 4 (PHASE4.md §15.2): 25 % slower than Phase 2's 120 / 480 / 30 / 30.
  //   work   walking about (one farm hour = 40 s)
  //   atJob  standing at an open job's place (within 2.5 m of where its marker points; not at 4x)
  //   panel  an equipment or inspection panel is open (a 1-minute flow test takes 2.5 s)
  //   carry  carrying chick boxes, the barrow or the catching frame, and from the truck stopping
  //          until the last stack is tipped (placing 6,000 chicks takes about 30-45 farm minutes)
  //   sign   a sign board or a plate is open: 0 = the clock stands still while you read
  //   fast   the 4x button on the time bar
  // The records book, notebook, skill tree and result screen also stop the clock.
  clock: { work: 90, fast: 360, panel: 24, carry: 24, sign: 0, atJob: 60 },
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
    // a hot, sunny afternoon: about 32 °C outside at 15:00 and the sun on the roof (model, °C/h into
    // the house air): the closed house runs over its target unless more air goes through it
    { id: 'warm-afternoon', day: 6, hour: 11, outsideRise: 3, sunPerH: 1.5, until: { day: 6, hour: 17 } },
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
// Phase 3 extends the table to 3 kg (PHASE3.md §6.4); up to 200 g it is Phase 2's.
export const MIN_VENT_PER_1000 = [[40, 150], [100, 290], [200, 480], [500, 950], [1000, 1600], [1500, 2150], [2000, 2700], [3000, 3650]];
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
// Phase 3 (PHASE3.md §6.1): 12 + 4a up to age 7 exactly as Phase 2, then FEED_STD_TABLE (straight
// lines, flat after day 42); the feed sign shows about 75 / 130 / 160 / 185 / 200 g on days 14-42.
export const FEED_STD_TABLE = [[7, 40], [14, 75], [21, 128], [28, 160], [35, 185], [42, 200]];
// Feed per gram of gain by flock age (model, PHASE3.md §6.1): Phase 2's 0.97 + 0.03a up to age 14
// (identical through the brooding week), then FPG_TABLE. With every intake factor at 0.97 (the ideal
// farmer) the flock weighs about 5 % over weightAt on every weigh day (203 / 505 / 993 / 1,632 /
// 2,320 g on days 7-35, 2,985 g at the catch); scripts/test-cycle.mjs holds it.
export const FPG_TABLE = [[14, 1.39], [21, 1.43], [28, 1.63], [35, 1.77], [42, 2.03]];
export function feedPerGainAt(age) {
  const a = Math.max(0, age);
  if (a <= 14) return 0.97 + 0.03 * a;
  const t = FPG_TABLE;
  for (let i = 1; i < t.length; i++) {
    const [a1, f1] = t[i], [a0, f0] = t[i - 1];
    if (a <= a1) return f0 + ((f1 - f0) * (a - a0)) / (a1 - a0);
  }
  return t[t.length - 1][1];
}
export function feedStdGAt(age) {
  if (age < 0) return 0;
  if (age <= 7) return 12 + 4 * age;
  const t = FEED_STD_TABLE;
  for (let i = 1; i < t.length; i++) {
    const [a1, f1] = t[i], [a0, f0] = t[i - 1];
    if (age <= a1) return f0 + ((f1 - f0) * (age - a0)) / (a1 - a0);
  }
  return t[t.length - 1][1];
}

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

// Skill tree: the 11 branches from the plan doc. Phase 2 made two earnable; Phase 3 makes all eleven
// earnable (milestones: skills.js ALL_MILESTONES = Phase 2's + skills-cycle.js, PHASE3.md §9). `earnable`
// is what the skill tree reads (a card that is not earnable shows a preview of its first unlock).
export const SKILL_BRANCHES = [
  { id: 'planning', name: 'Farm Planning', earnable: true },
  { id: 'biosecurity', name: 'Biosecurity & Health', earnable: true },
  { id: 'brooding', name: 'Chick Arrival & Brooding', earnable: true },
  { id: 'comfort', name: 'Body Temperature & Comfort', earnable: true },
  { id: 'ventilation', name: 'Heat & Ventilation', earnable: true },
  { id: 'moisture', name: 'Moisture & Minimum Ventilation', earnable: true },
  { id: 'heating', name: 'Heating', earnable: true },
  { id: 'water', name: 'Water', earnable: true },
  { id: 'feed', name: 'Feed & Digestion', earnable: true },
  { id: 'lighting', name: 'Lighting', earnable: true },
  { id: 'growth', name: 'Growth & Performance', earnable: true },
];
// Points needed for branch levels 1, 2, 3 (level 3 is not reachable in Level 1).
export const SKILL_LEVEL_POINTS = [4, 9, 15];
// What a branch level unlocks (tool or view). Keys are read by props (overlay) and ui (graphs).
// Phase 3: every level of every branch unlocks one (PHASE3.md §9.1; `by` = the package that builds it).
export const UNLOCKS = {
  floorOverlay: { branch: 'brooding', level: 1, name: 'Floor thermometer view', by: 'scene' },
  brooderChart: { branch: 'brooding', level: 2, name: '24-hour temperature chart on the controller', by: 'panels' },
  waterTrend: { branch: 'water', level: 1, name: 'Water meter trend graph', by: 'run' },
  lineOverview: { branch: 'water', level: 2, name: 'All-lines water overview', by: 'panels' },
  // Phase 3 (the plan's examples are the level 1 unlocks)
  planningCalc: { branch: 'planning', level: 1, name: 'Planning calculator at the office desk', by: 'panels' },
  planVsCycle: { branch: 'planning', level: 2, name: 'Your plan beside the flock in the record book', by: 'run' },
  planCarry: { branch: 'planning', level: 3, name: 'The next plan starts from this cycle\'s numbers', by: 'panels' },
  symptomCheck: { branch: 'biosecurity', level: 1, name: 'Quick symptom check when you inspect a bird', by: 'panels' },
  deadByLook: { branch: 'biosecurity', level: 2, name: 'Dead birds counted by how they look, at the bin', by: 'panels' },
  swabMap: { branch: 'biosecurity', level: 3, name: 'Swab places on the lab letter', by: 'run' },
  sampleCard: { branch: 'brooding', level: 3, name: 'The day\'s samples on one card when you hold a bird', by: 'panels' },
  comfortOverlay: { branch: 'comfort', level: 1, name: 'Comfort colour overlay on the flock', by: 'scene' },
  comfortGraph: { branch: 'comfort', level: 2, name: 'Comfort graph in the record book', by: 'run' },
  birdTemp: { branch: 'comfort', level: 3, name: 'Body temperature in the bird check', by: 'panels' },
  windChill: { branch: 'ventilation', level: 1, name: 'Wind chill readout on the fan panel', by: 'panels' },
  tunnelStages: { branch: 'ventilation', level: 2, name: 'Tunnel fan stages on the fan panel', by: 'panels' },
  fanChart: { branch: 'ventilation', level: 3, name: '24-hour fans, pad and house chart on the fan panel', by: 'panels' },
  moistureOverlay: { branch: 'moisture', level: 1, name: 'Litter moisture overlay', by: 'scene' },
  minVentCalc: { branch: 'moisture', level: 2, name: 'Minimum ventilation calculator on the controller', by: 'panels' },
  humidityChart: { branch: 'moisture', level: 3, name: '24-hour humidity chart on the controller', by: 'panels' },
  heatLoss: { branch: 'heating', level: 1, name: 'Heat loss readout for the house', by: 'panels' },
  gasGraph: { branch: 'heating', level: 2, name: 'Gas use graph in the record book', by: 'run' },
  brooderZones: { branch: 'heating', level: 3, name: 'Brooder heat zones on the floor view', by: 'scene' },
  waterTest: { branch: 'water', level: 3, name: 'Water test kit at the water supply', by: 'panels' },
  droppingsGuide: { branch: 'feed', level: 1, name: 'Droppings guide at the bird check', by: 'panels' },
  feedGraph: { branch: 'feed', level: 2, levelLive: 3, name: 'Feed per bird graph against the plate', by: 'run' },   // levelLive: SKILLS_UPDATE
  siloDays: { branch: 'feed', level: 3, levelLive: 2, name: 'Days of feed left on the silo gauge', by: 'panels' },
  lightPresets: { branch: 'lighting', level: 1, name: 'Light program presets', by: 'panels' },
  luxMap: { branch: 'lighting', level: 2, name: 'Light map on the floor view', by: 'scene' },
  dimming: { branch: 'lighting', level: 3, name: 'Dawn and dusk dimming in the light program', by: 'panels' },
  recordsTargets: { branch: 'growth', level: 1, name: 'Flock records screen with targets', by: 'run' },
  weightGraph: { branch: 'growth', level: 2, name: 'Weight curve against the target in the record book', by: 'run' },
  uniformityChart: { branch: 'growth', level: 3, name: 'Weight spread chart in the weigh panel', by: 'panels' },
};
// What the branches of later levels will unlock (the plan's examples; shown dimmed on the tree,
// nothing here can be earned in Level 1).
export const LATER_UNLOCKS = {
  planning: 'Planning calculator at the office desk',
  biosecurity: 'Quick symptom check when you inspect a bird',
  comfort: 'Comfort colour overlay on the flock',
  ventilation: 'Wind chill readout on the fan panel',
  moisture: 'Litter moisture overlay',
  heating: 'Heat loss readout for the house',
  feed: 'Droppings guide at the bird check',
  lighting: 'Light program presets',
  growth: 'Flock records screen with targets',
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

// ================================================================================================
// Phase 3 (the full flock cycle, PHASE3.md). Shared constants: every package reads these, nobody edits
// them without the integrator. Figures a farmer reads off a sign are general practice unless
// PHASE3.md §5.1 or PHASE2.md §6.1 name a guide; numbers marked "model" are simulation tuning values.
// ================================================================================================

// One calendar for the whole run (PHASE3.md §2.1): -2 planning day, -1 prep day, 0 chicks, 42 catch,
// 43-46 clean-out, then the rest until the booked chick day. env.setMaxDay(lastDay) in the clean-out.
export const CYCLE = { planDay: -2, prepDay: -1, placeDay: 0, harvestDay: 42, cleanFrom: 43, cleanDays: 4,
  growDays: 42, restMinDays: 21, lastDay: 70 };

// Rounds of every level: Phase 2's plus the planning day and the evening ventilation (weeks 4-6).
export const ROUNDS = {
  ...LEVEL1.rounds,
  plan: { from: 7, to: 24, label: 'Planning day' },
  night: { from: 18, to: 22, label: 'Evening ventilation' },
  clean: { from: 6, to: 20, label: 'Clean-out day' },
};
const CLOCK = LEVEL1.clock; // every level runs on Phase 2's clock speeds

// Key target of the brooding week in Phase 3 terms (its pass rule stays LEVEL1.fail, PHASE2.md §10).
LEVEL1.target = { kind: 'ratio', day: LEVEL1.endDay, min: LEVEL1.fail.weightRatioMin };
LEVEL1.starts = [LEVEL1.startDay];

// The seven levels of a run. problems: same shape as LEVEL1.problems (the farm starts them silently;
// `until` makes a weather event; `rh` = the outside RH during it, `rhDrop` = points off it; an event
// without them keeps the day's water content, so the RH falls as it heats: about 47 % at 15:00 on the
// hot afternoon, 40 % in the heat wave; conditional ones start only when their condition holds,
// PHASE3.md §7). anchors: job-engine anchors beyond truck / placed (§3.1). starts: the saved starts a
// level can be replayed from (its first day, and day 29 for weeks 4-5).
// Every level from Week 2 on runs the cycle climate (env.setCycleClimate(true), farm.enterLevel).
// Title = "Level <n> – <short>" (the run card, the result screen).
export const PLAN_LEVEL = {
  id: 'plan', n: 1, title: 'Level 1 – Plan the farm', short: 'Plan the farm', starts: [-2],
  startDay: -2, startHour: 7, endDay: -2, weather: 'cool', rounds: ROUNDS, clock: CLOCK, chicksPlaced: 0,
  anchors: { sent: { action: 'plan.send' } },
  problems: [],
  target: { kind: 'plan' }, fail: {},
};
export const WEEK2 = {
  id: 'week2', n: 3, title: 'Level 3 – Week 2', short: 'Week 2', starts: [8],
  startDay: 8, startHour: 6, endDay: 14, weather: 'cool', rounds: ROUNDS, clock: CLOCK, weighDays: [14],
  anchors: { curtain: { action: 'house.curtain', match: { open: true } } },
  problems: [
    { id: 'rainy-spell', day: 9, hour: 7, outsideDrop: 2, rh: 92, until: { day: 10, hour: 18 }, forecastDay: 8 },
    { id: 'lame-birds', day: 11, hour: 6 },
    { id: 'sudden-deaths', day: 13, hour: 4 },
  ],
  // 95 % of the day-14 target: a week with no care (no light program, curtain, vaccine or line raising)
  // weighs about 91 % and does not pass; the ideal is about 105 %, the curtain left down alone 96 %
  target: { kind: 'weight', day: 14, minShare: 0.95 }, fail: { mortalityMaxPct: 1.0 },
};
export const WEEK3 = {
  id: 'week3', n: 4, title: 'Level 4 – Week 3', short: 'Week 3', starts: [15],
  startDay: 15, startHour: 6, endDay: 21, weather: 'normal', rounds: ROUNDS, clock: CLOCK, weighDays: [21],
  anchors: {},
  problems: [
    // the first warm afternoon of the season: the tunnel fans the birds need now (PHASE3.md §7)
    { id: 'warm-afternoon3', day: 16, hour: 11, outsideRise: 2, sunPerH: 1, until: { day: 16, hour: 17 } },
    { id: 'pad-overflow', day: 17, hour: 10, litresPerCellH: 0.8, columns: 2 },
    { id: 'coccidiosis', day: 19, hour: 5 },
    { id: 'gumboro', day: 18, hour: 6, conditional: 'vaccine', below: 0.85 },
  ],
  target: { kind: 'weight', day: 21, minShare: 0.9 }, fail: { mortalityMaxPct: 1.0 },
};
export const WEEKS45 = {
  id: 'weeks45', n: 5, title: 'Level 5 – Weeks 4 and 5', short: 'Weeks 4 and 5', starts: [22, 29],
  startDay: 22, startHour: 6, endDay: 35, weather: 'normal', rounds: ROUNDS, clock: CLOCK, weighDays: [28, 35],
  anchors: {},
  problems: [
    { id: 'dusty-air', day: 23, hour: 4, rhDrop: 30, until: { day: 24, hour: 18 } },
    { id: 'hot-afternoon', day: 25, hour: 11, outsideRise: 3, sunPerH: 1.5, until: { day: 25, hour: 17 } },
    { id: 'fan-belt', day: 27, hour: 9, fan: 3 },
    { id: 'pad-clog', day: 29, hour: 10, share: 0.33 },
    { id: 'heat-wave', day: 30, hour: 10, outsideRise: 6, sunPerH: 2, until: { day: 32, hour: 19 }, forecastDay: 29 },
    { id: 'humid-heat', day: 33, hour: 10, rh: 85, until: { day: 33, hour: 18 } },
  ],
  target: { kind: 'weight', day: 35, minShare: 0.9 }, fail: { mortalityMaxPct: 2.0 },
};
export const FINISH = {
  id: 'finish', n: 6, title: 'Level 6 – Finishing and harvest', short: 'Finishing and harvest', starts: [36],
  startDay: 36, startHour: 6, endDay: 42, weather: 'normal', rounds: ROUNDS, clock: CLOCK, weighDays: [40],
  anchors: { catch: { stat: 'catchAt' } },
  problems: [
    { id: 'hot-finish', day: 38, hour: 11, outsideRise: 4, sunPerH: 1.5, until: { day: 38, hour: 17 } },
  ],
  // the harvest live weight (tickets) against weightAt(age at the catch) x the expected shrink (HARVEST.shrink)
  target: { kind: 'harvest', minShare: 0.9 }, fail: { mortalityMaxPct: 1.5, withDoa: true },
};
export const CLEANOUT = {
  id: 'cleanout', n: 7, title: 'Level 7 – Clean-out and rest', short: 'Clean-out and rest', starts: [43],
  startDay: 43, startHour: 6, endDay: CYCLE.lastDay, weather: 'normal', rounds: ROUNDS, clock: CLOCK,
  anchors: {},
  problems: [{ id: 'swab-positive', conditional: 'lab' }],
  target: { kind: 'clean', maxPositive: 2, restMinDays: CYCLE.restMinDays }, fail: {},
};
export const LEVELS = [PLAN_LEVEL, LEVEL1, WEEK2, WEEK3, WEEKS45, FINISH, CLEANOUT];
export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
/** The flock level a calendar day belongs to (the plan level for day -2, the brooding week -1..7). */
export function levelOfDay(day) {
  if (day <= CYCLE.planDay) return PLAN_LEVEL;
  for (const l of LEVELS.slice(1)) if (day <= l.endDay) return l;
  return CLEANOUT;
}

// Feed program (general; PHASE3.md §6.6). silo: 0 = silo 1, 1 = silo 2 (each EQUIP.siloCapacityKg).
export const FEED_TYPES = [
  { id: 'starter', label: 'Starter crumble', form: 'crumble', fromDay: 0, toDay: 14, silo: 0 },
  { id: 'grower', label: 'Grower pellets', form: 'pellet', fromDay: 15, toDay: 28, silo: 1 },
  { id: 'finisher', label: 'Finisher pellets', form: 'pellet', fromDay: 29, toDay: 42, silo: 0 },
];
export const feedTypeForDay = (day) => FEED_TYPES.find((t) => day <= t.toDay) || FEED_TYPES[FEED_TYPES.length - 1];

// Light program presets (general; unlock lightPresets). lux at birds = EQUIP.luxMax x dimmer.
export const LIGHT_PRESETS = {
  brooding: { label: 'Brooding (week 1)', darkStart: 2, darkHours: 1, dimmer: 0.6 },
  growing: { label: 'Growing (from day 8)', darkStart: 22, darkHours: 6, dimmer: 0.35 },
  finishing: { label: 'Finishing', darkStart: 0, darkHours: 4, dimmer: 0.35 },
  catching: { label: 'Catching', darkStart: 0, darkHours: 0, dimmer: 0.1 },
};

// Outside air in the Phase 3 levels (env.cycleClimate, PHASE3.md §6.3; model): the day's water content
// in g/m3 by weather. The RH follows the temperature: 'normal' about 89 % at 05:00 (24 °C) and 54 % at
// 15:00 (33 °C); 'cool' about 86 % / 48 %. A weather event with `rh` sets the outside RH during it.
// Phase 4: 'hot' 22 g/m3 (the hot season, 28-38 °C: about 80 % at dawn, 47 % at 15:00); 'rainy' 21 (24-30 °C: 96 % / 69 %).
export const OUTSIDE_WATER_GM3 = { cool: 14, normal: 19.5, hot: 22, rainy: 21 };
// Cooling pad efficiency (model): the pad takes the air this share of the way to its wet bulb.
export const PAD_EFF = 0.8;

// Heat and tunnel figures on the signs (general): air speed with all six fans; the temperature +
// humidity limit as one rule (PHASE3.md §6.3): the pads help while the house humidity they make stays
// at or under padOffAboveRH; above it they add more damp than cool. The heat-wave feeder hours.
export const HEAT = { airSpeedAllFans: 2.5, padOffAboveRH: 90, feedersOffHours: [11, 16] };

// The planning day (general, PHASE3.md §6.11): the company's contract and the planning sign's figures.
// The contract letter's terms (PHASE3.md §6.11): the company counts at least lossesMinPct losses (the
// farmer's own figure when higher), wants restMinDays of rest between flocks and at most houseBirds chicks a
// house (the drinkers and feeders of house 1). sendBy: the plan goes out by this hour of the planning day.
export const PLAN_CONTRACT = {
  salePerWeek: 3600, saleKg: 2.8, densityMaxKgM2: 32, lossesHintPct: 4, lossesMinPct: 4, restMinDays: 21, growDays: 42, cleanDays: 4,
  saleMaxPct: 110, // the plant books 3,600 a week and takes at most 10 % more (general: a contract term on the letter)
  houseBirds: 6000, houseM2Drawings: 600,  // the company's drawings show the standard house, 50 x 12 m; house 1 measures 48 x 12
  houses: [1, 12], birdsPerHouse: [1000, 9000], cycleDays: [49, 100], sendBy: 16, replyAfterH: 1,
};

// Finishing and harvest (general; model where PHASE3.md §6.9 says so).
/** The LPG tank at the start of the flock, kg (model: the gas tank's gauge reads farm.stats.gasKg against it). */
export const GAS_TANK_KG = 500;

export const HARVEST = {
  catchDefault: { day: 42, hour: 2 }, bookFrom: { day: 41, hour: 18 }, bookTo: { day: 42, hour: 6 },
  sections: 8, sectionMin: 22, sectionOrder: [1, 0, 2, 3, 4, 5, 6, 7], crew: 4, trucks: 2,
  cratesPerTruck: 300, birdsPerCrate: 10, tareKg: 12000,
  withdrawalH: [8, 12],   // the pans are empty this many hours before the catch (sign-feed, sign-catch)
  stopLinesBeforeEmptyH: 1, // the lines stop about an hour before the pans run empty
  shrink: 0.98,           // the birds lose about 2 % of their weight between feed off and the plant
  bookAheadH: 72,         // book the crew and the trucks at least 3 days ahead (sign-catch)
  catchLux: 10,           // dim to about 10 lux at bird height for the catch (sign-catch)
  catchFansMin: 3,        // keep at least half the tunnel fans running while the birds are caught (sign-catch)
};

// Clean-out and rest (general).
// swabSpots: the ten places the lab asks to be swabbed, where cleaning is hardest (a small flag marks each;
// the farmer swabs every one; the lab result comes from the whole house, PHASE3.md §6.10).
export const CLEAN = {
  restMinDays: CYCLE.restMinDays, bookMinDays: 14, swabs: 10, swabSectors: 5, labDays: 2, maxPositive: 2,
  swabSpots: [
    { x: -20.0, z: -1.95, label: 'Under drinker line 2, west' }, { x: 16.0, z: 1.95, label: 'Under drinker line 3, east' },
    { x: -8.0, z: -3.9, label: 'Feeder pans, line 1' }, { x: 10.0, z: 3.9, label: 'Feeder pans, line 3' },
    { x: -23.4, z: 2.0, label: 'Cooling pad, inside' }, { x: 23.4, z: -1.5, label: 'Tunnel fans, inside' },
    { x: -23.4, z: -5.6, label: 'North-west corner' }, { x: 23.4, z: 5.6, label: 'South-east corner' },
    { x: 4.0, z: 5.6, label: 'Side-wall inlet, south' }, { x: -14.0, z: 5.4, label: 'Inside the door' },
  ],
  brushParts: ['lines', 'fans', 'pad', 'brooders', 'inlets'], washItems: ['boots', 'buckets', 'barrow', 'washer'],
};

// Interactive spots added in Phase 3 (scene builds the objects; run / panels read them).
// North-wall boards hang on the columns at x = 4 m steps (house-shell FRAME_X), facing south.
export const SPOTS3 = {
  guardHut: { x: -45.4, z: 34.0, label: 'Guard hut: farm clothes and boots', inside: false },
  signPlan: { x: -30.6, z: 26.0, label: 'Production planning sign', inside: false },
  signLight: { x: -4.0, z: -5.8, label: 'Light program sign', inside: true },
  curtainWinch: { x: 2.0, z: -5.6, label: 'Brooding curtain winch', inside: true },
  signCurtain: { x: 4.0, z: -5.8, label: 'Opening up the house sign', inside: true },
  signLegs: { x: 8.0, z: -5.8, label: 'Legs and feathers sign', inside: true },
  signAir: { x: 12.0, z: -5.8, label: 'Air quality sign', inside: true },
  signDroppings: { x: 16.0, z: -5.8, label: 'Droppings sign', inside: true },
  signHeat: { x: 20.0, z: -5.8, label: 'Heat and tunnel fans sign', inside: true },
  fanPanel: { x: 22.4, z: -5.8, label: 'Fan panel', inside: true },
  padPump: { x: -25.4, z: -3.0, label: 'Cooling pad pump', inside: false },
  gasTank: { x: -27.0, z: -9.0, label: 'Gas tank gauge', inside: false },
  signFeed: { x: -14.6, z: -8.1, label: 'Feed program sign', inside: false },
  washBay: { x: -27.0, z: 10.5, label: 'Wash bay', inside: false },
  signClean: { x: -27.0, z: 13.4, label: 'Clean-out sign', inside: false },
  loadingBay: { x: -12.0, z: 12.2, label: 'Loading bay: weight tickets', inside: false },
  signCatch: { x: -7.0, z: 6.4, label: 'Catching and loading sign', inside: false },
  catchPanels: { x: -12.6, z: 4.6, label: 'Catching panels', inside: true },
  bait: [{ x: -25.2, z: -6.8 }, { x: 25.2, z: -6.8 }, { x: 25.2, z: 6.8 }, { x: -25.2, z: 6.8 }].map((p, i) => ({ ...p, label: `Bait station ${i + 1}`, inside: false })),
  // clean-out: where E brushes each part of the house (enabled on clean-out days)
  brush: {
    lines: { x: 6.0, z: 0.0, label: 'Feeder and drinker lines', inside: true },
    fans: { x: 22.8, z: 0.0, label: 'Tunnel fans', inside: true },
    pad: { x: -23.4, z: -3.4, label: 'Cooling pad (inside)', inside: true },
    brooders: { x: -13.0, z: -2.6, label: 'Brooders', inside: true },
    inlets: { x: 10.0, z: 5.3, label: 'Side-wall inlets', inside: true },
  },
};

// The whole house in 8 sample sectors (four along x, two across z), for counts after the curtain lift.
export function houseSector(x, z) {
  const b = BIRD_BOUNDS, t = (x - b.xMin) / (b.xMax - b.xMin);
  const col = Math.max(0, Math.min(3, Math.floor(t * 4)));
  return col * 2 + (z < 0 ? 0 : 1);
}

// Overlay ramps (sRGB, continuous, no good / bad colours): comfort = felt °C minus the target
// (blue cooler, white at the target, orange warmer); litter moisture % (light sand to dark brown).
export const COMFORT_RAMP = [[-6, [0.18, 0.37, 0.82]], [-3, [0.45, 0.66, 0.92]], [0, [0.96, 0.96, 0.94]], [3, [0.96, 0.66, 0.32]], [6, [0.86, 0.36, 0.1]]];
export const MOISTURE_RAMP = [[10, [0.93, 0.86, 0.64]], [20, [0.84, 0.72, 0.45]], [30, [0.64, 0.5, 0.3]], [40, [0.42, 0.31, 0.19]], [50, [0.26, 0.19, 0.13]]];

// Run saves (PHASE3.md §11). The skill profile stays SAVE.profileKey.
export const RUN_SAVE = { key: 'chickenFarm.run.v3', startPrefix: 'chickenFarm.run.v3.start.', version: 3 };


// ================================================================================================
// Phase 4 (simulation tuning and the harder replay conditions, PHASE4.md). Shared constants: every package reads
// these, nobody edits them without the integrator. The tuned model values live in src/farm-tuning.js (sim);
// figures a farmer reads off a sign are general practice (SIGN_FIGURES); numbers marked "model" are tuning values.
// ================================================================================================

// Interactive spots added in Phase 4 (scene builds the objects; run / panels read them).
export const SPOTS4 = {
  generator: { x: -32.0, z: 8.0, label: 'Generator', inside: false },               // south door of FARM.generator
  signPower: { x: -29.4, z: 8.0, label: 'Power cut sign', inside: false },           // beside it, facing south
  waterTank: { x: -32.2, z: -11.0, label: 'Water tank gauge and well pump', inside: false }, // east foot of FARM.waterTank
  chickTable: SPOTS2.chickTable,                                                      // the grading of a bad batch (PHASE4.md §4.3)
};

// The evening of big birds (heat sign, general; PHASE4.md §2.4): from day padEveningFromAge, 18:00-21:00, every fan
// and the pads while the outside air is at or over padEveningAboveC (the controller's Outside reading); the night
// ventilation job is met with at most nightPantMax of the birds panting (a few birds pant on warm evenings).
export const HEAT_P4 = { padEveningAboveC: 29.5, padEveningFromAge: 28, eveningUntil: 21, nightPantMax: 0.25 };

// The generator and the well pump (general where a sign says so, else model; PHASE4.md §4.2, §4.4).
// startMin / testMin are panel waits (the panel's bar at the panel clock, then the action: PHASE4.md §10.3);
// clockWhileDark: the level clock speed (LEVEL1.clock key) while the house has no power, as Phase 2's chick
// placement (every farm minute counts; the walk to the generator takes about 4-7 farm minutes at it).
export const GENERATOR = { fuelL: 150, litresPerH: 15, startMin: 2, testMin: 10, kva: 60, clockWhileDark: 'carry' };
// The tank feeds the drinker lines and the cooling pads: on a hot afternoon the pads draw about 700-1,200 L an hour
// (0.49 g per m³ of tunnel air per °C they cool, plus padBleed), the birds about 100-150 (scripts/tuning-refs.mjs
// TANK_REFS_P4). The pump fills it at pumpM3h x pumpShare while it is under fullPct; the line pressure falls under
// linesFromPct, the pad runs dry from the far end under padFromPct (model). The pump's gauges (water.tank): pumpBar x
// pumpShare bar and pumpA + 3 x (1 - pumpShare) A (the plate prints the good-order figures, general); the gauge's
// marker keeps the lowest level since the last reading. wornBar: a reading at or under it is the worn pump's symptom.
export const WATER_TANK = { m3: 6, pumpM3h: 1.2, fullPct: 95, startPct: 95, lowPct: 30, linesFromPct: 20, padFromPct: 15, repairH: 2,
  padBleed: 0.1, pumpBar: 2.4, pumpA: 6, wornBar: 2.2 };
// Phase 4 build switches (the integrator sets them at the merges; a harness may set them on __game.config.PHASE4):
//   tunedSigns  the sign lines of the tuned model (content-signs-cond.js BOARD_P4_ITEMS) in every run; true at the sim
//               merge, when the model that the lines describe goes live (until then every board reads as Phase 3)
export const PHASE4 = { tunedSigns: true };

/**
 * The harder replay conditions (PHASE4.md §3-§4), offered after the first full cycle (skills profile cyclesDone)
 * and selectable for any level on the run card. One condition per run, held on the farm only (`farm.condition`: the
 * run puts it there through farm.start(def, { condition }); the engine, the signs, the HUD and level.js read it).
 * Each changes the levels through `levels[levelId]`:
 *   weather     the level's weather key (WEATHER / OUTSIDE_WATER_GM3); `weather` on the condition = every level
 *   drop        problem ids of the level def that do not happen
 *   replace     { [problemId]: fields } merged into the level def's problem
 *   problems    extra problems (same shape as config LEVELS problems; `until` makes a weather event, `storm` marks
 *               rain, `back` ends a power cut, `alarm` emits its symptom at once and stops a skip, `conditional`
 *               starts only when the farm's condition holds, `recurring` re-arms after it is fixed)
 *   target/fail fields merged into the level def's (the brooding week of a bad batch counts the chicks graded out
 *               on day 0 apart, once the hatchery is told the same day: `claimedApart`)
 *   delivery    the brooding week's chick delivery as the condition has it (a bad batch: weight, spread, weak share,
 *               the truck's hour, the growth and infection terms), null = Phase 2's
 *   routineDays { [routine job id]: [fromDay, toDay] } the days a Phase 2/3 routine runs in this condition
 * sun:          { fromHour, toHour, perH } the afternoon sun on the roof every day of every level (the farm installs a
 *               weather event `sun-<day>` per day: heatPerH only, Phase 2's 2 h ramps; model). The hot season's: a
 *               closed house runs 4-6 °C over the chicks' row by 15:00 (scripts/tuning-refs.mjs hot brooding refs).
 * cycleClimateFrom: the first level that runs the cycle climate (the hot and rainy seasons: the brooding week; the
 *               brooding week keeps Phase 2's wind chill and chick comfort in every condition, PHASE4.md §2.3).
 * dropMilestones: none: a milestone with `needsProblem` (skills*.js) is not evaluated where the merged levels lack it.
 * Condition jobs, signs and milestones: content-jobs-cond.js, content-signs-cond.js, skills-cond.js.
 * `available` is what the run card reads; the integrator sets it true at the run merge (as `earnable`).
 */
export const CONDITIONS = {
  hot: {
    label: 'Hot season', months: 'April–May', available: true, weather: 'hot', cycleClimateFrom: 'level1',
    sun: { fromHour: 11, toHour: 17, perH: 1.5 },     // every afternoon is Phase 2's warm afternoon, in 38 °C air
    summary: 'April–May: afternoons of 37–38 °C with the sun on the roof, nights hardly under 28 °C, a heat wave to about 41 °C in week 5. The cooling pads decide, from the first day.',
    levels: {
      level1: { drop: ['warm-afternoon'] },           // every afternoon is warm: the routine h-brood-air instead
      // April-May is the dry hot season: no rainy spell in week 2 (92 % in 36 °C air is no Thai April afternoon; the pad
      // could not cool it and 10-day-olds panted all day; integrator, Phase 4 merge)
      week2: { drop: ['rainy-spell'], routineDays: { 'r-fans-pm': [8, 41], 'r-vent-night': [8, 41] } },
      // the daily sun carries the afternoons: the events' own sun off (the heat wave keeps a little)
      week3: { replace: { 'warm-afternoon3': { outsideRise: 2.5, sunPerH: 0 } } },          // about 40 °C on day 16
      weeks45: {
        replace: { 'hot-afternoon': { outsideRise: 1.5, sunPerH: 0 }, 'heat-wave': { outsideRise: 3, sunPerH: 0.5 } },  // about 39.5 / 41 °C
        drop: ['humid-heat'],
        problems: [{ id: 'hot-spell', day: 33, hour: 18, outsideRise: 2, sunPerH: 0, until: { day: 35, hour: 18 } }], // nights about 30 °C
      },
      finish: { replace: { 'hot-finish': { outsideRise: 2, sunPerH: 0 } } },                 // about 40 °C on day 38
    },
  },
  rainy: {
    label: 'Rainy season', months: 'August–September', available: true, weather: 'rainy', cycleClimateFrom: 'level1',
    summary: 'August–September: damp air day and night (about 96 % at dawn), storms every week, wet litter, weak pad cooling and a power cut in week 5 that needs the generator.',
    levels: {
      level1: { problems: [{ id: 'storm-5', day: 5, hour: 14, outsideDrop: 4, rh: 98, storm: true, until: { day: 5, hour: 18 } }] },
      week2: { replace: { 'rainy-spell': { rh: 97 } }, problems: [{ id: 'storm-12', day: 12, hour: 14, outsideDrop: 4, rh: 98, storm: true, until: { day: 12, hour: 18 } }] },
      week3: { problems: [
        { id: 'storm-19', day: 19, hour: 13, outsideDrop: 4, rh: 98, storm: true, until: { day: 19, hour: 17 } },
        { id: 'rain-in', day: 19, hour: 13.5, storm: 'storm-19', litresPerCellH: 0.6, rows: 2 },   // the south inlets' two cell rows
      ] },
      weeks45: {
        drop: ['dusty-air', 'hot-afternoon', 'heat-wave', 'humid-heat'],
        problems: [
          { id: 'storm-26', day: 26, hour: 14, outsideDrop: 4, rh: 98, storm: true, until: { day: 26, hour: 18 } },
          { id: 'damp-spell', day: 29, hour: 7, outsideDrop: 2, rh: 97, until: { day: 31, hour: 18 }, forecastDay: 28 },
          { id: 'storm-33', day: 33, hour: 14, outsideDrop: 4, rh: 98, storm: true, until: { day: 33, hour: 18 } },
          { id: 'power-cut', day: 33, hour: 15 + 10 / 60, back: { day: 33, hour: 18 + 10 / 60 }, alarm: true },
          { id: 'mains-back', day: 33, hour: 18 + 10 / 60, conditional: 'generator' },   // only while the generator carries the house
          // the house dark again with the mains still off: the generator ran dry or was stopped (any day of the level)
          { id: 'gen-dry', conditional: 'dark-again', alarm: true },
        ],
      },
      finish: { drop: ['hot-finish'], problems: [{ id: 'storm-39', day: 39, hour: 14, outsideDrop: 4, rh: 98, storm: true, until: { day: 39, hour: 18 } }] },
    },
  },
  badChicks: {
    label: 'A bad batch of chicks', months: '', available: true, cycleClimateFrom: null,
    summary: 'Chicks from a young parent flock after a long trip: small (about 36 g) and uneven, many weak ones. Grade them, cull the weak, report the batch and brood them closer.',
    levels: {
      level1: {
        problems: [{ id: 'weak-batch', day: 0, hour: 10 }],
        fail: { mortalityMaxPct: 2.5, claimedApart: true },   // the chicks graded out on day 0 are the hatchery's claim
        // the delivery (model; Phase 2's are 41.5 g, CV 8 %, 0.8 % weak, 4 % red hocks, 08:00, 35 % of the weak die):
        // the sim's delivery reads it, the run's truck anchor and the chick truck follow arrivalHour (PLACEMENT_DAY
        // and the flock's age stay Phase 2's: the age counts from 08:00 day 0 in every run)
        //   gainK72h       the small chicks' gain in their first 72 h on the floor x this (they start slower)
        //   infectionPerPctH  yolk-sac infection: while weak chicks are in the flock (days 0-7), the others die at this
        //                  share an hour per 1 % of the flock that is weak (4.5 % weak ungraded: about +0.9 % in the week)
        //   targetShiftC / shiftDays  env.targetTemp is the sign's row + targetShiftC on days 0..shiftDays (every reader
        //                  agrees: the comfort, the strips, the readings label it "the sign's row + 1 °C (weak batch)")
        delivery: { chickWeightG: 36, chickWeightSdG: 1.5, cv: 0.14, weakShare: 0.045, redHockShare: 0.1, arrivalHour: 10, roadH: 7, lateBase: 0.05, weakDeathShare: 0.45,
          gainK72h: 0.85, infectionPerPctH: 0.000012, targetShiftC: 1, shiftDays: 3, note: 'parent flock 25 weeks old, 7 h on the road' },
      },
    },
  },
  water: {
    label: 'A water problem', months: '', available: true, cycleClimateFrom: null,
    summary: 'Iron in the well water and an old well pump: the filter and the nipples clog, and in week 4 the pump wears and the tank runs low in the afternoons. Find it from the pump\'s gauges, the water meter and the birds.',
    levels: {
      level1: { problems: [{ id: 'iron-water', day: -1, hour: 7 }] },
      // the filter blocks before a flow-test morning (content-jobs.js FLOW_DAYS: even days), away from the pump's days
      week2: { problems: [{ id: 'iron-filter', day: 12, hour: 4, flowFactor: 0.6 }] },
      week3: { problems: [{ id: 'iron-nipples', day: 18, hour: 4, line: 3, flowFactor: 0.7 }] },
      weeks45: { problems: [{ id: 'iron-filter', day: 24, hour: 4, flowFactor: 0.6 }, { id: 'pump-wear', day: 26, hour: 6, lossPerDay: 0.12, minShare: 0.25 }] },
    },
  },
};
export const CONDITION_IDS = Object.keys(CONDITIONS);
export const conditionLabel = (id) => (id && CONDITIONS[id] ? CONDITIONS[id].label : 'Normal season');

/**
 * A level as a condition plays it (PHASE4.md §3.2): the level def's problems with the condition's dropped, replaced
 * and added, its weather, target and fail rules and the routine days. Pure; the level def itself is never changed
 * (compare levels by `id`, never by object). No condition: the def's own `problems` array (same object).
 * @returns {{ condition: string|null, problems: object[], weather: string, target: object, fail: object,
 *   routineDays: object, cycleClimate: boolean, delivery: object|null }}
 */
export function conditionLevel(def, condId) {
  const c = condId ? CONDITIONS[condId] : null;
  const ownClimate = def.id !== LEVEL1.id && def.id !== PLAN_LEVEL.id;
  if (!c) return { condition: null, problems: def.problems || [], weather: def.weather, target: def.target, fail: def.fail, routineDays: {}, cycleClimate: ownClimate, delivery: null };
  const part = (c.levels && c.levels[def.id]) || {}, drop = new Set(part.drop || []);
  const problems = (def.problems || []).filter((p) => !drop.has(p.id))
    .map((p) => (part.replace && part.replace[p.id] ? { ...p, ...part.replace[p.id] } : p)).concat(part.problems || []);
  const order = LEVELS.map((l) => l.id), from = c.cycleClimateFrom ? order.indexOf(c.cycleClimateFrom) : -1;
  // routine days carry on into the later levels of the condition (week 2's r-fans-pm from day 8 stays in week 3)
  const routineDays = {};
  for (const l of LEVELS.slice(0, order.indexOf(def.id) + 1)) Object.assign(routineDays, (c.levels[l.id] || {}).routineDays || {});
  return { condition: condId, problems, weather: part.weather || c.weather || def.weather, target: { ...def.target, ...(part.target || {}) },
    fail: { ...def.fail, ...(part.fail || {}) }, routineDays, cycleClimate: ownClimate || (from >= 0 && order.indexOf(def.id) >= from && def.id !== PLAN_LEVEL.id),
    delivery: part.delivery || null };
}

/**
 * Every figure a Phase 4 sign prints that the model must also give (PHASE4.md §2.5; all general practice). `text`
 * is how the board prints it (package run: content-signs*.js; scripts/test-contracts.mjs finds its first words on
 * `board`); `model` names the check in scripts/test-tuning.mjs (package sim: the model's value lies in `band`).
 * Each check runs in the weather the sign is read in (the power-cut figures in the rainy season's storm, the pad's
 * draw in a hot afternoon, the hot brooding line in the hot season).
 */
export const SIGN_FIGURES = [
  { id: 'wind-chill-5wk', board: 'sign-heat', text: 'at 2.5 m/s birds of 5 weeks feel about 5–6 °C cooler', model: 'windChill35', band: [5, 6] },
  { id: 'wind-chill-2wk', board: 'sign-heat', text: 'birds of 2 weeks about 7 °C', model: 'windChill14', band: [6.5, 7.5] },
  { id: 'wind-chill-hot', board: 'sign-heat', text: 'moving air cools less once the air is over about 35 °C; near 40 °C it gives little: then the pads cool the birds', model: 'windChillHot', band: [0.1, 0.4] },
  { id: 'air-per-fan', board: 'sign-heat', text: 'All six fans give about 2.5 m/s at bird height, each fan about 0.4 m/s', model: 'airPerFan', band: [0.4, 0.43] },
  { id: 'pant-felt-5wk', board: 'sign-heat', text: 'birds of 5 weeks start to pant when they feel about 24 °C, all of them by about 28 °C (felt: the fan panel’s Birds feel reading)', model: 'firstPant35', band: [23.5, 24.5] },
  { id: 'pant-all-5wk', board: 'sign-heat', text: 'all of them by about 28 °C', model: 'allPant35', band: [27.5, 28.5] },
  // the damp part of what the birds feel (farm-heat humidityTerm; the fan panel's Birds feel reading counts it)
  { id: 'damp-felt-87', board: 'sign-heat', text: 'in damp air the birds feel warmer still: about 1 °C at 87 % humidity', model: 'dampFelt87', band: [0.8, 1.2] },
  { id: 'damp-felt-90', board: 'sign-heat', text: 'about 2 °C at 90 %', model: 'dampFelt90', band: [1.6, 2.2] },
  { id: 'damp-felt-95', board: 'sign-heat', text: 'about 4 °C at 95 %', model: 'dampFelt95', band: [3.6, 4.4] },
  { id: 'evening-from', board: 'sign-heat', text: 'big birds (from day 28) on warm evenings want every fan', model: 'eveningFromAge', band: [28, 28] },
  { id: 'evening-above', board: 'sign-heat', text: 'the pads while the outside air is over about 30 °C', model: 'eveningAboveC', band: [29, 30.5] },
  { id: 'young-pad', board: 'sign-heat', text: 'young birds on a hot afternoon: the pad with one or two tunnel fans', model: 'youngPad1E', band: [-1.5, 1.5] },
  { id: 'water-feed', board: 'drinker', text: 'water : feed about 1.8 L/kg while the birds are comfortable', model: 'waterRatioComfort', band: [1.7, 1.9] },
  { id: 'water-feed-hot', board: 'drinker', text: 'while they are hot and panting they drink more: about 2–2.5 L/kg', model: 'waterRatioHot', band: [2, 2.5] },
  { id: 'water-feed-wave', board: 'drinker', text: 'in a heat wave without cooling up to about 3 L/kg', model: 'waterRatioWave', band: [2.8, 3.2] },
  { id: 'pad-most', board: 'pad-pump', text: 'a pad in good order gives most of that, never all of it', model: 'padShareOfRule', band: [0.6, 0.95] },
  { id: 'pad-most-max', board: 'pad-pump', text: 'a pad in good order gives most of that, never all of it', model: 'padShareOfRuleMax', band: [0.6, 0.95] },
  { id: 'pad-rainy', board: 'pad-pump', text: 'in the damp air of the rainy season a pad cools only about 2–4 °C', model: 'rainyPadC', band: [2, 4] },
  // the hot season's brooding week: the pad with one tunnel fan keeps the chicks near their row (the closed house does not)
  { id: 'hot-brood-pad', board: 'sign-brooder', text: 'hot season: every afternoon the closed house runs over the chicks’ row', model: 'hotBroodClosedE', band: [3.5, 7] },
  { id: 'hot-brood-pad1', board: 'sign-brooder', text: 'the pad with one tunnel fan', model: 'hotBroodPad1E', band: [-1.5, 1.5] },
  // the power cut, measured in the rainy season's storm (storm-33, the cut at 15:10): deaths to the next morning
  { id: 'power-cut-10', board: 'sign-power', text: 'without fans big birds overheat at once: within minutes the first die', model: 'powerCut10', band: [0.03, 0.3] },
  { id: 'power-cut-30', board: 'sign-power', text: 'after half an hour about 4 in 1,000', model: 'powerCut30', band: [0.3, 0.6] },
  { id: 'power-cut-120', board: 'sign-power', text: 'after two hours one or two in every hundred', model: 'powerCut120', band: [1, 2.2] },
  { id: 'gen-fuel-hours', board: 'generator', text: 'Fuel: 150 L, about 10 hours at full load', model: 'genFuelHours', band: [9.5, 10.5] },
  // the tank and the well pump (the water condition; scripts/tuning-refs.mjs TANK_REFS_P4)
  { id: 'pump-good', board: 'water-tank', text: 'a pump in good order: about 2.4 bar and 6 A', model: 'pumpGoodBar', band: [2.3, 2.5] },
  { id: 'pad-draw', board: 'water-tank', text: 'on a hot afternoon the pads draw about 700–1,200 L an hour', model: 'padDrawHotLh', band: [700, 1200] },
  { id: 'birds-draw', board: 'water-tank', text: 'the birds drink about 100–150 L an hour', model: 'birdsDrawHotLh', band: [90, 170] },
];


// ================================================================================================
// Phase 5 (polish: sound, save slots, the settings menu, the farm overview map, the final quality pass; PHASE5.md).
// Shared constants: every package reads these, nobody edits them without the integrator. Phase 5 adds no farming
// figure to any sign except the hot season's appetite line (general practice, PHASE5.md §6.8.4, checked by test-cond).
// ================================================================================================

/** The build that wrote a save (shown on a slot and in a backup; a save of a newer format is refused, PHASE5.md §3.6). */
export const BUILD = { phase: 5, id: 'phase5' };

// Save slots and backups (PHASE5.md §3). The autosave stays RUN_SAVE (its keys are never renamed: a republish of the page
// keeps every Phase 3-4 autosave); a slot is one localStorage key holding a whole run (the run key and every level start)
// under the versioned envelope `format` / `version`. textMarker opens a backup's payload line ("CF5.gz64.<crc>.<base64>").
// maxSlotChars: a slot that would store more than this is refused with the "full" message (the JSON fallback of a whole
// cycle is about 0.9 M characters, gzip + base64 about 0.21 M). A backup's payload line is
// "CF5.<enc>.<crc>.<chars>." (the payload's length in characters: the reader counts them, PHASE5.md §3.5) and a backup
// longer than partChars is split into numbered parts ("CF5.<enc>.<crc>.<chars>.p2of6.", "Part 2 of 6"), each part's
// whole text at most partChars characters (a chat message or a note holds about 10,000), pasted back in any order.
export const SAVE_SLOTS = {
  count: 3, keyPrefix: 'chickenFarm.slot.v5.', format: 'chicken-farm-save', version: 5, textMarker: 'CF5',
  maxSlotChars: 1600000, wrap: 76, partChars: 9000,
  // the formats a slot, a backup or the live keys may hold, oldest first (PHASE5.md §3.6): migrations go up this list
  known: [{ v: 1, what: 'Phase 2 brooding-week save (chickenFarm.level1.v1)' }, { v: 3, what: 'Phase 3-4 run save (chickenFarm.run.v3)' }, { v: 5, what: 'Phase 5 save envelope' }],
};

// Settings (PHASE5.md §4): one key for every group (settings.js; the old sound key 'chicken-farm.sound' is read once and
// kept in step for the Phase 4 steps files), and the first-play pointers' memory (ui-intro.js).
export const SETTINGS_STORE = { key: 'chickenFarm.settings.v1', legacySoundKey: 'chicken-farm.sound', version: 1 };

// Graphics (PHASE5.md §4.4, §6.5): the frame-time governor (gfx-quality.js) and the budgets the harness checks at the named
// views of scripts/p5-gfx.json (measured on main at the design run, SwiftShader 960 x 600, pixel ratio 1: 66-93 draw calls,
// 312-553 K triangles, 66 shader programs after the warm-up).
export const GFX = {
  maxPixelRatio: 1.5,
  governor: { windowSec: 2, holdSec: 3, firstHoldSec: 4, slowSec: 0.036, verySlowSec: 0.05 },
  // the sun's shadow map: high 2048, low 1024, off 256 kept empty (PHASE5.md §4.4, review round: the shadow type and
  // renderer.shadowMap.enabled never change, both are in three's program key, so no setting compiles a shader mid-play)
  shadowHigh: 2048, shadowLow: 1024, shadowOff: 512,
  budget: { calls: 110, triangles: 650000, programs: 66 },
};

// The farm overview map (PHASE5.md §5): the area it draws (the fence plus the farm road out of the gate), the house view's
// area, and where a click walks (a place's stand point: boards on the north wall from z = standZ inside; anything else at
// the nearest free spot within standR of its spot).
export const MAP = {
  farm: { xMin: -58, xMax: 58, zMin: -38, zMax: 45 },
  house: { xMin: -25.5, xMax: 25.5, zMin: -7.5, zMax: 7.5 },
  standZ: -4.6, standR: 2.5,
  minLabelPx: 12,
};

// ---------------------------------------------------------------------------------------------------------------------
// Skills update (SKILLS.md): skills that make playing easier. Contract data of the design round (revised after the
// critic's review); owners per SKILLS.md §15.
//   live          the build switch (false on main until the last merge, SKILLS.md §16; a steps file may set
//                 __game.config.SKILLS_UPDATE.live): the new level thresholds, the level 3 gate and the two-flock points,
//                 the payoffs, the job card's and the tree's new words, the sign lines and the moved Feed views.
//                 false = the Phase 5 game.
//   levelPoints   points for levels 1, 2, 3 while live (SKILL_LEVEL_POINTS [4, 9, 15] otherwise)
//   level3After   level 3 needs this many finished flocks too (skills.profile.cyclesDone >= 1): a first flock reaches
//                 level 2 at most, and a branch with 13 points at the end of it is at level 3 from the next plan
//                 (SKILLS.md §2.2, the pacing measured by scripts/skill-progress.mjs, §2.5)
//   flocks        a milestone counts once per flock slot, in up to this many flocks (slot 1: cyclesDone 0, slot 2: >= 1)
export const SKILLS_UPDATE = { live: false, levelPoints: [4, 9, 13], level3After: 1, flocks: 2 };
/** The thresholds in force (skills.js, the perks, the tree and the job card read this, never a constant). */
export const skillLevelPoints = () => (SKILLS_UPDATE.live ? SKILLS_UPDATE.levelPoints : SKILL_LEVEL_POINTS);
/** The level a branch's points give, with the level 3 gate while live (cyclesDone: the profile's finished flocks). */
export const levelFromPoints = (pts, cyclesDone = 0) => {
  const n = skillLevelPoints().filter((need) => pts >= need).length;
  return SKILLS_UPDATE.live && n >= 3 && cyclesDone < SKILLS_UPDATE.level3After ? 2 : n;
};
/** The level a view unlock needs now (Feed's siloDays and feedGraph swap levels while live: SKILLS.md §2.1). */
export const unlockLevel = (u) => (SKILLS_UPDATE.live && u && u.levelLive != null ? u.levelLive : u ? u.level : Infinity);
/** The three steps of every branch (the tree's level names). */
export const SKILL_STEP_NAMES = ['See more', 'Faster', 'The equipment does it'];
/** Short branch names for the job card's "handled by the controller (Water 3)" and the captions. */
export const SKILL_SHORT = { planning: 'Farm Planning', biosecurity: 'Biosecurity', brooding: 'Brooding', comfort: 'Comfort', ventilation: 'Ventilation',
  moisture: 'Moisture', heating: 'Heating', water: 'Water', feed: 'Feed', lighting: 'Lighting', growth: 'Growth' };

// Level 1 · See more (SKILLS.md §3.0): each branch's level 1 view, what it shows, where it is used, its key (keys.js action
// id) and the jobs whose strip names it ("Your Brooding 1 view: F shows the floor's warmth" / "Brooding 1 would show …").
export const SKILL_VIEWS = {
  planningCalc: { shows: 'works the sums on the planning sheet', where: 'the planning sheet at the office desk', jobs: ['pl-sheet'] },
  symptomCheck: { shows: 'a quick look at the bird you hold: its symptoms in plain words', where: 'the bird check', jobs: ['w2-check', 'p-lame', 'p-hunched'] },
  floorOverlay: { shows: 'the floor\'s warmth under and between the brooders', where: 'anywhere in the house', keyId: 'floorView', jobs: ['d0-floor', 'prep-preheat', 'prep-litter'] },
  comfortOverlay: { shows: 'each bird in the colour of what it feels', where: 'anywhere in the house', keyId: 'comfortView', jobs: ['r-walk', 'r-walk-pm', 'p-warm', 'p-heat3', 'r-vent-night'] },
  windChill: { shows: 'how much cooler the moving air makes the birds feel', where: 'the fan panel', jobs: ['r-fans-pm', 'p-heat3', 'p-panting', 'p-humid'] },
  moistureOverlay: { shows: 'the litter\'s wetness over the floor', where: 'anywhere in the house', keyId: 'moistureView', jobs: ['r-litter', 'w3-topup', 'p-leak', 'p-damp', 'p-pad-wet'] },
  heatLoss: { shows: 'where the house\'s heat goes, degrees an hour', where: 'the climate controller\'s Temperature tab', jobs: ['prep-preheat', 'p-cold-night'] },
  waterTrend: { shows: '14 days of water per 1,000 birds and water : feed', where: 'the Trend key beside the meter at the water supply', jobs: ['r-meter'] },
  droppingsGuide: { shows: 'the droppings sign\'s pictures beside the bird you hold', where: 'the bird check', jobs: ['w3-droppings', 'p-blood', 'p-hunched'] },
  lightPresets: { shows: 'the light sign\'s programs to pick from', where: 'the climate controller\'s Lights tab', jobs: ['prep-lights', 'w2-lights', 'p-sds'] },
  recordsTargets: { shows: 'the target beside each day\'s weight and intake', where: 'the record book and the weigh panel', jobs: ['d7-weigh', 'w2-weigh', 'w3-weigh', 'w45-weigh28', 'w45-weigh35', 'f-weigh'] },
};
/** What every view unlock gives, in plain words (SKILLS.md §6.1: the tree says it for all 33; level 1 from SKILL_VIEWS). */
export const UNLOCK_SHOWS = {
  ...Object.fromEntries(Object.entries(SKILL_VIEWS).map(([k, v]) => [k, v.shows])),
  brooderChart: 'the last 24 hours of house temperature and the brooders on the controller',
  sampleCard: 'the day\'s vent, crop and weight samples on one card while you hold a bird',
  lineOverview: 'all four lines\' height, pressure and last flow on one panel',
  waterTest: 'a water test kit at the supply: pH, hardness and iron of the well water',
  planVsCycle: 'your plan\'s figures beside the flock\'s in the record book',
  planCarry: 'the next planning sheet starts from this cycle\'s houses, birds, days and losses',
  deadByLook: 'the dead birds in the bucket by how they look (on the back, thin, wings out, hunched)',
  swabMap: 'where each swab was taken, on the lab letter',
  comfortGraph: 'the flock\'s comfort hour by hour in the record book',
  birdTemp: 'the bird\'s body temperature in the bird check',
  tunnelStages: 'a stage table on the fan panel that adds tunnel fans as the house warms',
  fanChart: 'the last 24 hours of fans, pad and house on the fan panel',
  minVentCalc: 'the vent sign\'s need for your count and weight, beside the timer, on the controller',
  humidityChart: 'the last 24 hours of house humidity on the controller',
  gasGraph: 'gas used day by day against the gas plate in the record book',
  brooderZones: 'each brooder\'s warm circle on the floor view',
  feedGraph: 'feed per bird day by day against the feed plate in the record book',
  siloDays: 'the days of feed left in the silos at today\'s intake, on the silo gauge',
  luxMap: 'the light at bird level over the floor',
  dimming: 'dawn and dusk dimming minutes in the light program',
  weightGraph: 'the weight curve against the target in the record book',
  uniformityChart: 'the spread of the day\'s weights in the weigh panel',
};

const WEIGH_JOBS = ['d7-weigh', 'w2-weigh', 'w3-weigh', 'w45-weigh28', 'w45-weigh35', 'f-weigh'];
const PHONE_JOBS = ['p-order-feed', 'w2-order', 'w45-order', 'f-order', 'f-book', 'p-report', 'p-blood', 'p-hunched', 'c-book', 'p-weak-batch'];
const ORDER_JOBS = ['p-order-feed', 'w2-order', 'w45-order', 'f-order'];
const RECORD_JOBS = ['r-record', 'prep-record'];
// Levels 2 and 3 (SKILLS.md §3): { branch, level, step: 'faster' | 'auto', name, saves (the tree's plain words: what it
// saves), where (the unlock caption's "use it at"), jobs (the jobs it eases: the job card and the strips), by (the package
// that builds it), system / fault (an automated one: AUTO_SYSTEMS, FAULTS) }. No payoff changes a job's sample size (the
// boards' 5 vent chicks, 10 crops and 50 birds hold). A text may hold {key:<keys.js action id>} tokens (key-words.js
// fillKeys when drawn: 'phone' is the jobs package's new R key).
export const PAYOFFS = {
  // Water
  waterAllLines: { branch: 'water', level: 2, step: 'faster', name: 'Read all four sight tubes at the water supply', saves: 'Saves the four one-minute flow tests on flow-test mornings: a cup test only on a line that reads off',
    where: 'the sight-tube board on the water supply panel, south-west corner inside', jobs: ['r-drinkers'], by: 'panels' },
  autoWinch: { branch: 'water', level: 3, step: 'auto', system: 'winch', fault: 'winch-stall', name: 'The drinker winches follow the flock\'s age',
    saves: 'Saves winching four drinker lines by hand on the eight raise days', where: 'the winch motors at the drinker lines\' west ends: look at the heights at the water supply', jobs: ['prep-drinkers', 'r-raise'], by: 'model' },
  // Moisture & Minimum Ventilation
  ventFill: { branch: 'moisture', level: 2, step: 'faster', name: 'The minimum ventilation calculator fills the timer', saves: 'Saves working the timer seconds out of the vent sign\'s table and stepping them in',
    where: 'the climate controller\'s Ventilation tab: Fill the timer', jobs: ['prep-vent', 'r-minvent', 'p-damp'], by: 'panels' },
  autoTimer: { branch: 'moisture', level: 3, step: 'auto', system: 'timer', fault: 'timer-reset', name: 'The minimum ventilation timer steps up with the flock',
    saves: 'Saves stepping the timer up by the table every other morning', where: 'the climate controller: it shows what the timer did since your last read', jobs: ['prep-vent', 'r-minvent'], by: 'model' },
  // Heat & Ventilation
  fanAdvice: { branch: 'ventilation', level: 2, step: 'faster', name: 'The fan panel and the controller suggest the fans and the pad for now', saves: 'Saves working the fans and the pad out of the heat sign, and the walk to the fan panel to set them',
    where: 'the fan panel and the controller\'s Tunnel fans row: Set as suggested', jobs: ['r-fans-pm', 'r-vent-night', 'p-heat3', 'p-panting', 'p-panting-fin', 'p-humid'], by: 'panels' },
  autoStages: { branch: 'ventilation', level: 3, step: 'auto', system: 'stages', fault: 'stage-trip', name: 'The controller keeps the fan stage table for the birds\' age',
    saves: 'Saves the walk to the fan panel every afternoon and stepping the fans through the heat', where: 'the fan stages: look at them when you read the controller', jobs: ['r-fans-pm'], by: 'model' },
  // Heating
  brooderRow: { branch: 'heating', level: 2, step: 'faster', name: 'One press sets the thermostat to the brooder sign\'s row; the heat-loss readout gives the pre-heat time', saves: 'Saves stepping the thermostat to the row; tells you when to start the pre-heat',
    where: 'the climate controller\'s Temperature tab: Set to the sign\'s row', jobs: ['prep-preheat', 'p-cold-night', 'b-warm'], by: 'panels' },
  autoBrooders: { branch: 'heating', level: 3, step: 'auto', system: 'brooders', fault: 'sensor-drift', name: 'The brooders follow the brooder sign\'s curve',
    saves: 'Saves setting the thermostat by the table every morning to day 21 and starting the pre-heat', where: 'the climate controller: compare its sensor with the thermometer beside it', jobs: ['prep-preheat'], by: 'model' },
  // Chick Arrival & Brooding
  quickSamples: { branch: 'brooding', level: 2, step: 'faster', name: 'Next chick and a longer reach for the chick samples', saves: 'Saves putting each chick down, stepping and catching again for the vent and crop samples',
    where: 'the chick in your hand: Next chick', jobs: ['d0-vent', 'd1-crop', 'b-crop48'], by: 'panels' },
  boxHelper: { branch: 'brooding', level: 3, step: 'auto', name: 'A helper tips the chick boxes with you on arrival day', saves: 'Saves carrying half of the six stacks of chick boxes',
    where: 'the chick truck on arrival day, once the sample box is weighed: the helper takes the next stack', jobs: ['d0-place'], by: 'scene' },
  // Feed & Digestion
  siloOrder: { branch: 'feed', level: 2, step: 'faster', name: 'The silo gauge shows days of feed, warns at 2 days and orders', saves: 'Saves the walk to the office to order, and the sums from kilos to days',
    where: 'the silo gauge outside the north wall: Order to 3 days', jobs: ORDER_JOBS, by: 'panels' },
  autoFeed: { branch: 'feed', level: 3, step: 'auto', system: 'feed', fault: 'order-lost', name: 'Feed orders itself and the feeder lines rise with the flock',
    saves: 'Saves the feed orders to day 35 and raising three feeder lines by hand', where: 'the silo gauge and the feeder box: look for the order\'s confirmation', jobs: ['w2-order', 'w45-order', 'r-raise'], by: 'model' },
  // Lighting
  weekLights: { branch: 'lighting', level: 2, step: 'faster', name: 'One press sets the light program for the flock\'s age', saves: 'Saves picking the dark hours and the dimmer from the light sign',
    where: 'the climate controller\'s Lights tab: Program for the day', jobs: ['prep-lights', 'w2-lights', 'p-sds'], by: 'panels' },
  autoLights: { branch: 'lighting', level: 3, step: 'auto', system: 'lights', name: 'The controller changes the light program with the age and dims at dawn and dusk',
    saves: 'Saves setting the light program at each change of week', where: 'the climate controller\'s Lights tab', jobs: ['prep-lights', 'w2-lights'], by: 'model' },
  // Growth & Performance
  frameWeigh: { branch: 'growth', level: 2, step: 'faster', name: 'The scale with memory weighs the frame\'s birds in one press', saves: 'Saves a press and the wait for every bird at each of the five places, and finding the places still to weigh',
    where: 'the catching frame on weigh days: Weigh the frame', jobs: WEIGH_JOBS, by: 'panels' },
  autoScale: { branch: 'growth', level: 3, step: 'auto', system: 'scale', fault: 'scale-fouled', name: 'The automatic bird scale gives the day\'s weight',
    saves: 'Saves hand weighing on weigh days: read the scale\'s day average', where: 'the bird scale\'s display', jobs: WEIGH_JOBS, by: 'model' },
  // Body Temperature & Comfort
  earlyWarning: { branch: 'comfort', level: 2, step: 'faster', name: 'The flock watch warns two farm hours earlier and names the fix', saves: 'Saves hours of cold or hot birds before you hear of it',
    where: 'the flock watch card: Show me', jobs: ['r-walk', 'r-walk-pm', 'p-warm', 'p-heat3', 'p-panting'], by: 'model' },
  comfortAlways: { branch: 'comfort', level: 3, step: 'auto', name: 'The comfort colours show whenever you are in the house', saves: 'Saves pressing {key:comfortView} at every visit, and shows a cold or hot corner as you pass',
    where: 'inside the house ({key:comfortView} turns them off for the visit)', jobs: ['r-walk', 'r-walk-pm'], by: 'scene' },
  // Biosecurity & Health
  tallyBucket: { branch: 'biosecurity', level: 2, step: 'faster', name: 'The tally bucket picks up every dead bird within 2.5 m and counts them as you pick them up', saves: 'Saves stooping for each bird and the count at the bin: the bin is then one press',
    where: 'the dead-bird bucket on every round; empty it at the bin as before', jobs: ['r-dead-am', 'r-dead-pm'], by: 'scene' },
  passCheck: { branch: 'biosecurity', level: 3, step: 'auto', name: 'Birds you walk past show a quick symptom tag', saves: 'Saves catching birds to find the sick and lame ones',
    where: 'walking slowly through the house', jobs: ['w2-check', 'p-lame'], by: 'scene' },
  // Farm Planning
  pocketPhone: { branch: 'planning', level: 2, step: 'faster', name: 'A phone in your pocket', saves: 'Saves the walk to the office for every order, vet call and booking',
    where: 'anywhere in a level: {key:phone}', jobs: PHONE_JOBS, by: 'jobs' },
  phoneRecord: { branch: 'planning', level: 3, step: 'auto', name: 'The daily record on the phone; the next plan starts from this cycle', saves: 'Saves the walk to the office every evening to sign the day\'s record',
    where: 'the phone ({key:phone}): Sign today\'s record', jobs: RECORD_JOBS, by: 'jobs' },
};

// Level 3 automation (SKILLS.md §4): the farm's controllers (farm-auto.js, package "model"). glanceAt: the panels whose
// opening for AUTO.glanceSec emits auto.glance { system } (the handed-over job's quick look); jobs: { jobId: part } — the
// part of the job the equipment does, made with the glance variant while the system is on (job-variants.js, package
// "jobs"): 'whole' (the job's done rule) or the id of the state test of the part it keeps (r-raise splits lines-raised into
// drinkers-raised and pans-raised). A job's other parts stay the farmer's (r-drinkers' flow tests, r-feeders' readings: the
// controllers only keep their live tests true). Problem jobs are never handed over: the find and the act stay the
// farmer's. keeps: the job card's words for the live part.
const DRINKER_PANELS = DRINKER_LINES_Z.map((_, i) => `drinker-${i}`);
const WEIGH_WHOLE = Object.fromEntries(WEIGH_JOBS.map((j) => [j, 'whole']));
export const AUTO_SYSTEMS = {
  winch: { branch: 'water', payoff: 'autoWinch', label: 'Winches', glanceAt: ['water-supply', ...DRINKER_PANELS], reading: 'the four line heights',
    keeps: 'The winches keep every line at the drinker plate\'s height', jobs: { 'prep-drinkers': 'whole', 'r-raise': 'drinkers-raised' } },
  timer: { branch: 'moisture', payoff: 'autoTimer', label: 'Timer', glanceAt: ['controller'], reading: 'the timer against the vent sign',
    keeps: 'The controller keeps the timer at about 110 % of the vent sign\'s table', jobs: { 'prep-vent': 'whole', 'r-minvent': 'whole' } },
  stages: { branch: 'ventilation', payoff: 'autoStages', label: 'Fan stages', glanceAt: ['controller', 'fan-panel'], reading: 'the fan stages and the house',
    keeps: 'The controller\'s stage table for the age runs the tunnel fans', jobs: { 'r-fans-pm': 'whole' } },
  brooders: { branch: 'heating', payoff: 'autoBrooders', label: 'Brooders', glanceAt: ['controller'], reading: 'the thermostat against the brooder sign',
    keeps: 'The controller holds the thermostat at the brooder sign\'s row', jobs: { 'prep-preheat': 'whole' } },
  feed: { branch: 'feed', payoff: 'autoFeed', label: 'Feed', glanceAt: ['silo', 'feeder-box'], reading: 'the silo days and the order',
    keeps: 'The feed controller keeps an order on the way and the rims at the plate', jobs: { 'w2-order': 'whole', 'w45-order': 'whole', 'r-raise': 'pans-raised' } },
  lights: { branch: 'lighting', payoff: 'autoLights', label: 'Lights', glanceAt: ['controller'], reading: 'the light program',
    keeps: 'The controller keeps the light program of the age', jobs: { 'prep-lights': 'whole', 'w2-lights': 'whole' } },
  scale: { branch: 'growth', payoff: 'autoScale', label: 'Bird scale', glanceAt: ['bird-scale'], reading: 'the scale\'s day average',
    keeps: 'The automatic scale has weighed 300 birds or more today', jobs: WEIGH_WHOLE },
};
/** The job ids a system takes a part of (AUTO_SYSTEMS[s].jobs keys). */
export const autoJobsOf = (system) => Object.keys(AUTO_SYSTEMS[system]?.jobs || {});
/** Model values of the controllers and the level 2 payoffs (SKILLS.md §3, §4; none is a sign fact unless the sign says it). */
export const AUTO = {
  glanceSec: 1,                       // a panel open this long gives the glance (the controller read takes 2 s anyway)
  morningHour: 6,                     // the daily steps (timer, brooders) and the end of the farmer's own winch / thermostat setting
  winchCmPerH: 2, rimCmPerH: 2, rimFromDay: 4,
  ventShare: 1.1, ventRecountPct: 2,  // the timer at 110 % of the vent sign's need; again when his count changes 2 %
  stagesFromDay: 15, padFromDay: 21,
  orderAtDays: 2, orderToDays: 3, lastAutoOrderDay: 35,
  lightDays: [-1, 8, 36], rampMin: 20, rampFromDay: 8,
  scalePerDay: 600, scaleMinReads: 300, scaleNoisePct: 0.5,
  // the farmer's own setting holds (SKILLS.md §4.2; farm.auto.hold keeps the times, per line for the winch and the rims):
  //   winch, feed rims: that line until the next 06:00 · brooders: until the next 06:00 · timer: until 18:00 that day (or the
  //   next 06:00 for a setting sent after 18:00) · stages: his own fans / pad for 2 farm hours, his own stage table
  //   (vent.stages) until the next 06:00 · lights: his own program until the next change of week (days 8, 36)
  handHold: { winch: { untilHour: 6, perLine: true }, feed: { untilHour: 6, perLine: true }, brooders: { untilHour: 6 },
    timer: { untilHour: 18, lateUntilHour: 6 }, stages: { hours: 2, tableUntilHour: 6 }, lights: { untilChange: true } },
  // the level 2 / 3 hands-on payoffs (scene, panels)
  deadReachM: 2.5,                    // Biosecurity 2: E at a dead bird picks up every drawn dead bird this near
  bucketMaxKg: 15,                    // Biosecurity 2: the bucket holds this weight of dead birds (about 6 birds of 2.4 kg,
                                      // 30 or more chicks in week 1); a full bucket goes to the bin first
  chickReachM: 2.0, nextChickM: 2.5,  // Brooding 2: the catch reach (was 1.2 m) and Next chick's (the same part of the floor)
  tagM: 2.0, tagSec: 3, tagMax: 6,    // Biosecurity 3: the symptom tags
  helperRate: 2,                      // Brooding 3: two stacks move at a time (the helper starts after sample.box; a bad
                                      // batch's helper takes only stacks the farmer has graded)
  frameWeighSec: 1,                   // Growth 2: the frame's birds weighed in one press, 1 s (each bird's weight kept)
  earlyComfortH: 2,                   // Comfort 2: the watch warns at 2 cold / hot hours of 8 (WATCH.comfortAmber) instead of 4
  showMeH: 2,                         // Comfort 2: the job marker points to the fix's place this long
};

// Faults (SKILLS.md §5; farm-faults.js, package "model"). selfKnown: the controller knows at once (the Equipment row red at
// the start); else a cross-check finds it (amber / red bands). spot: where to look (a SPOTS key; 'drinkers.N' = the line's
// regulator). fix: the actions that fix it by hand (the fault's own fix; a hand setting meanwhile holds as AUTO.handHold).
// hours: the farm hours it may start in (else the planned item waits for the next day's window); retryH: the controller's
// own retry, which bounds the fault. All model values; the sign lines that name them are general practice.
export const FAULTS = {
  'winch-stall': { system: 'winch', selfKnown: true, spot: 'drinkers.N', plate: 'drinker', fix: ['water.height', 'auto.reset'], hours: [7, 15], what: 'Winch motor stalled' },
  'timer-reset': { system: 'timer', selfKnown: true, spot: 'controller', plate: 'sign-vent', fix: ['vent.timer'], retryH: 12, hours: [7, 15],
    firstSetting: { fans: 1, onSec: 8, cycleSec: 300 }, what: 'Controller restarted on its first timer setting' },
  'stage-trip': { system: 'stages', selfKnown: true, spot: 'fanPanel', plate: 'fan-panel', fix: ['vent.stages', 'auto.reset'], hours: [7, 10], retryH: 2, alarmOverC: 5,
    what: 'Fan stages off' },
  'sensor-drift': { system: 'brooders', selfKnown: false, spot: 'controller', plate: 'sign-brooder', fix: ['auto.calibrate'], driftPerH: 0.5, driftMaxC: 2.5, amberC: 1, redC: 2,
    warnAmberUnderDays: 7, hours: [7, 15], days: [0, 21], what: 'Temperature sensor reading high' },
  'order-lost': { system: 'feed', selfKnown: true, spot: 'silo', plate: 'silo', fix: ['feed.order'], redAfterH: 6, armH: 24, minDays: 1.8, hours: [7, 15],
    what: 'Feed order not confirmed by the mill' },
  'scale-fouled': { system: 'scale', selfKnown: false, spot: 'birdScale', plate: 'bird-scale', fix: ['scale.clean'], readLowPct: 6, countShare: 0.25, hours: [7, 15],
    what: 'Bird scale platform fouled' },
};
// How often (SKILLS.md §5.2): ONE rule. Planned once per flock at the brooding week's farm.start (level.js passes flockNo:
// skills.profile.cyclesDone) from createRng(seed x rngMul + flockNo) — never the model's own farm.rng — into
// farm.auto.faults as { at, phase: 'planned' } items (saved with the farm, so a replay or a resume keeps the same plan). At
// an item's time the fault is picked among the systems on then (weights; each fault's own hours / days must hold, else the
// next system; none: 'dropped'). order-lost arms then and hits the next automatic order within FAULTS[...].armH. At most one
// open at a time (an item due while one is open waits for its fix). The rainy season's stage trip after each power cut
// (afterCut) is outside the plan: exempt from max and from "one open".
export const FAULT_PLAN = {
  normal: { max: 1, chance: 0.6, weights: {} },
  hot: { max: 2, chance: 1, weights: { 'stage-trip': 2, 'sensor-drift': 2 } },
  rainy: { max: 2, chance: 1, weights: { 'timer-reset': 2 }, afterCut: 'stage-trip' },
  badChicks: { max: 2, chance: 1, weights: { 'sensor-drift': 2, 'scale-fouled': 2 } },
  water: { max: 2, chance: 1, weights: { 'winch-stall': 2 } },
  // the items' times: flock days fromDay..toDay, never on a level's last day (notDays), minGapDays apart, inside hours
  window: { fromDay: 1, toDay: 40, notDays: [7, 14, 21, 35], minGapDays: 2, hours: [7, 15] },
  rngMul: 31,
};
/** The light sign's program for a day (Lighting 2's one press, Lighting 3's controller): config LIGHT_PRESETS by age. */
export const lightPresetForDay = (day) => (day <= 7 ? 'brooding' : day <= 35 ? 'growing' : 'finishing');
