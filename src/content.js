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
  if (id.startsWith('sign')) return 'Read the';
  if (id === 'silo') return 'Read the gauge:';
  if (id.startsWith('box-stack')) return 'Pick up';
  if (id === 'office-desk') return 'Open the record book:';
  return 'Use the';
}

// ---------------- Level 1 ----------------
// The title card (PHASE3.md §1 "Title card and run screen"): one flock, from the plan to the clean house.
export const LEVEL_TEXT = {
  title: 'Chicken Farm — one flock, from the plan to the clean house',
  kicker: 'House 1 · 6,000 broiler chicks',
  line: 'Plan the farm, take in 6,000 chicks, grow them to the harvest and rest the clean house: seven levels on one flock.',
  start: 'Start a new flock',
  startBrooding: 'Start at the brooding week',
  startAgain: (what) => `Start again — replaces your save (${what})`,
  continueLabel: (where, time, cond) => `Continue — ${where}, ${time}${cond ? ` · ${cond}` : ''}`,
  sandbox: 'Walk the Phase 1 farm (sandbox)',
  skills: 'Skill tree',
  noSave: 'Saving is off in this browser: replays start from a standard flock, and closing the page ends the run.',
  saveNote: 'The game saves by itself as you play, and keeps the start of every level for a replay.',
};

/** HUD day label (PHASE3.md §2.3): "Planning day", "Prep day", "Day N", "Day 42 · the catch", "Clean-out
 *  day k", "Rest day k". `o.bookedDay`: while resting, the booked chick day. */
export function dayLabel(d, o = {}) {
  if (d <= -2) return 'Planning day';
  if (d < 0) return 'Prep day';
  if (d < 42) return `Day ${d}`;
  if (d === 42) return 'Day 42 · the catch';
  if (d <= 46) return `Clean-out day ${d - 42}`;
  return o.bookedDay != null ? `Rest day ${d - 46} · chicks booked: day ${o.bookedDay}` : `Rest day ${d - 46}`;
}

// The run card on the title screen and the run's result buttons (PHASE3.md §1, §10).
export const RUN_CARD = {
  heading: 'The run: one flock, seven levels',
  continueTo: 'Continue to',
  replay: 'Replay',
  fromDay: (d) => (d <= -2 ? 'from the planning day' : d === -1 ? 'from the prep day' : `from day ${d}`),
  days: (def) => (def.id === 'plan' ? 'Planning day' : def.id === 'level1' ? 'Prep day – day 7' : def.id === 'cleanout' ? 'Day 43 – the next chicks' : `Days ${def.startDay}–${def.endDay}`),
  target: {
    plan: 'Every term of the contract in the company’s reply',
    level1: 'Day 7: weigh 50 birds',
    week2: 'Day 14: weigh 50 birds',
    week3: 'Day 21: weigh 50 birds',
    weeks45: 'Day 35: weigh 50 birds',
    finish: 'Day 42: the weight tickets',
    cleanout: 'The lab’s swabs and 3 weeks of rest',
  },
  states: { 'not reached': 'not reached', playing: 'playing', reached: 'reached', passed: 'passed', 'not passed': 'not passed' },
  confirm: (short, d) => `Replay ${short} — your run goes back to ${d <= -2 ? 'the planning day' : d === -1 ? 'the prep day' : `day ${d}`}`,
  noStorage: 'Saving is off in this browser: replays start from a standard flock.',
  // Phase 4 (PHASE4.md §1.2, §3.1): the harder flocks and the level rows' condition choice
  standard: (d, cond) => `Getting the flock to day ${d}${cond ? ` ${condIn(cond)}` : ''} …`,
  playStandard: 'Play from a standard start',
  conditionLabel: 'Flock',
  harderHeading: 'Harder flocks',
  harderShut: 'Harder flocks: after your first full cycle',
  harderOff: 'Not in this build yet',
  harderDone: (n) => `${n} cycle${n === 1 ? '' : 's'} finished under it`,
  startIn: (id) => `Start a new flock ${condIn(id)}`,
  newRunNote: 'Another flock than this run’s starts a new run from this level; the levels before it come from a standard start.',
  confirmNew: (what) => `${what} — replaces this run`,
  confirmStd: (short, d) => `Standard start of ${short} — your run goes back to ${d <= -2 ? 'the planning day' : d === -1 ? 'the prep day' : `day ${d}`}`,
};
/** "in the hot season", "with a bad batch of chicks" (a condition inside a sentence). */
export function condIn(id) {
  return { hot: 'in the hot season', rainy: 'in the rainy season', badChicks: 'with a bad batch of chicks', water: 'with a water problem' }[id] || '';
}
/** The harder flocks' cards (PHASE4.md §1.2): name, months (a season) and one line each. */
export const HARDER = {
  hot: { line: 'Afternoons of 37–38 °C with the sun on the roof, nights hardly under 28 °C, a heat wave to about 41 °C in week 5.' },
  rainy: { line: 'Damp air day and night, storms every week, a power cut in week 5.' },
  badChicks: { line: 'Small, uneven, many weak.' },
  water: { line: 'Iron in the well water and an old pump.' },
};

// Keys of a level (title card and the help card). Physical keys, as in Phase 1.
export const LEVEL_KEYS = [
  { key: 'E', what: 'use' }, { key: 'Q', what: 'squeeze litter' }, { key: 'T', what: 'floor thermometer' },
  { key: 'L', what: 'light meter' }, { key: 'V', what: 'air meter' },
  { key: 'N', what: 'notebook' }, { key: 'K', what: 'skill tree' }, { key: 'H', what: 'help' },
];
export const LEVEL_HELP_KEYS = [
  { keys: ['W', 'A', 'S', 'D'], what: 'Walk, or click the ground' },
  { keys: ['Shift'], what: 'Run (hold)' },
  { keys: ['←', '→'], what: 'Turn, or right-drag' },
  { keys: ['Wheel', '+', '−'], what: 'Zoom in and out' },
  { keys: ['E'], what: 'Use, pick up, read a sign' },
  { keys: ['Shift', 'E'], what: 'Pick up a dead bird while a job with chicks is open' },
  { keys: ['G'], what: 'Set the dead-bird bucket down (E picks it up again)' },
  { keys: ['Q'], what: 'Squeeze a handful of litter' },
  { keys: ['T'], what: 'Floor thermometer at your feet' },
  { keys: ['L'], what: 'Light meter: lux at bird height' },
  { keys: ['V'], what: 'Air meter: air speed, °C and humidity at bird height' },
  { keys: ['N'], what: 'Notebook: your readings' },
  { keys: ['K'], what: 'Skill tree' },
  { keys: ['F'], what: 'Floor temperature view (once unlocked)' },
  { keys: ['C'], what: 'Comfort view of the flock (once unlocked)' },
  { keys: ['M'], what: 'Litter moisture view (once unlocked)' },
  { keys: ['Esc'], what: 'Close a panel' },
  { keys: ['H'], what: 'Show or hide this help' },
];

// What the farmer sees and hears on a listen stop, as the caption shows it (neutral words).
/** The look note as a caption: "chicks" in the brooding week, "birds" from day 8; an empty house as it is. */
export const lookCaption = (o, who = 'chicks') => (/^no birds/.test(o.spread) ? `You see: ${o.spread}. You hear: ${o.sounds}.`
  : `You see: ${who} ${o.spread}; droppings ${o.droppings}. You hear: ${o.sounds}.`);

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
