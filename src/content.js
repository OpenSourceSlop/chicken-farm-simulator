// Words on the farm: sign boards, today's jobs and the controls legend. Owner: systems/UI agent.
// Every fact on a sign carries its source: the guide's name, or "general practice" for common
// farm practice. No page numbers (the guide PDFs are not in this repo). Level 1's signs and plates
// are in content-signs.js.
import { targetTempAt, GUIDES } from './config.js';

// One source table for the whole game: config GUIDES (week1..week4, vent, bm101, general).
export const SOURCES = GUIDES;

// Brooder sign table: house temperature by flock age, read from config.targetTempAt.
// Day 1 and day 35 are the guide values; days in between are a straight line until the full
// table is loaded, so they are marked approximate.
export const BROODER_TABLE_DAYS = [1, 7, 14, 21, 28, 35];
export function brooderTableRows() {
  return BROODER_TABLE_DAYS.map((day) => {
    const exact = day === 1 || day === 35;
    const t = targetTempAt(day);
    const shown = exact ? t : Math.round(t * 2) / 2; // approximate rows to the thermostat's 0.5 °C step
    return { day, temp: shown, approx: !exact };
  });
}

export const SIGNS = {
  'sign-gate': {
    kind: 'gate',
    title: 'Farm gate – biosecurity',
    kicker: 'Before you go in',
    items: [
      { text: 'Disinfect at the gate: dip your boots in the foot dip.', source: SOURCES.bm101 },
      { text: 'Spray every vehicle before it comes onto the farm.', source: SOURCES.general },
      { text: 'Report abnormal deaths in the flock straight away.', source: SOURCES.bm101 },
      { text: 'Change into farm clothes and farm boots before you go near the chicken houses.', source: SOURCES.general },
    ],
  },
  'sign-brooder': {
    kind: 'brooder',
    title: 'Brooder heaters – house temperature by flock age',
    kicker: 'Gas brooders',
    table: {
      caption: 'House temperature by flock age',
      colAge: 'Flock age',
      colTemp: 'House temperature',
      approxNote: 'approx. = general practice: read off a straight line between the guide’s day 1 and day 35 values.',
      source: `${SOURCES.week1} / ${SOURCES.vent}`,
    },
    readTitle: 'Read the chicks',
    read: [
      { kind: 'cold', head: 'Too cold', text: 'Huddled together under the brooders.' },
      { kind: 'hot', head: 'Too hot', text: 'Along the walls, wings held out, beaks open.' },
      { kind: 'ok', head: 'Comfortable', text: 'Evenly spread, eating and drinking.' },
    ],
    readSource: SOURCES.week1,
    preheat: { text: 'Pre-heat the house so the floor reaches 28–30 °C before the chicks arrive.', source: SOURCES.week1 },
  },
};

// What the prompt pill says for an interactable: "Read the Brooder heaters sign".
export function promptVerb(id) {
  return id.startsWith('sign') ? 'Read the' : 'Use the';
}

// Today's jobs. `where` tells the player where to go; ui-tasks.js decides when each is done.
export const TASKS = [
  {
    id: 'walk-house',
    title: 'Walk to the chicken house',
    where: 'Follow the farm road north, then east. The door is in the south wall of the long house.',
  },
  {
    id: 'read-brooder-sign',
    title: 'Read the brooder heaters sign',
    where: 'Inside the house, on the north wall across from the door, on the left.',
  },
  {
    id: 'set-thermostat',
    title: 'Set the brooder thermostat',
    where: 'Climate controller, inside on the north wall across from the door, on the right. The sign gives the temperature for your flock’s age.',
  },
  {
    id: 'watch-chicks',
    title: 'Watch how the chicks spread under the brooders',
    where: 'Stand by one of the round gas brooders hanging over the chicks and watch them while the house warms up.',
  },
];

export const TASKS_DONE_LINE =
  'Morning jobs done. Walk around the farm, try the climate controller, and open the test tools (bottom right) to change the flock’s age, the weather and the time of day.';

export const HELP_KEYS = [
  { keys: ['W', 'A', 'S', 'D'], what: 'Walk, or click the ground' },
  { keys: ['Shift'], what: 'Run (hold)' },
  { keys: ['←', '→'], what: 'Turn, or right-drag' },
  { keys: ['Wheel', '+', '−'], what: 'Zoom in and out' },
  { keys: ['Double-click'], what: 'Run to that spot' },
  { keys: ['E'], what: 'Read a sign, use a machine' },
  { keys: ['Esc'], what: 'Close a sign or panel' },
  { keys: ['H'], what: 'Show or hide this help' },
];
