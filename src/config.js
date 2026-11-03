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
// Where the feed auger from the silos passes through the north wall into the house: the house's
// cross auger runs from here over the feeder-line hoppers (at LINE_X.start - 0.25); the world's
// feed auger rises from the silo boots to meet it at the outside face of the wall.
export const FEED_INLET = { x: LINE_X.start - 0.25, y: 2.42 };
export const NIPPLE_SPACING = 0.3;

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
