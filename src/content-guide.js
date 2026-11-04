// How to play (PHASE5.md §6.2): the player guide inside the game. It says how the GAME works (controls, the day, jobs,
// signs, records, levels, saving); every farming fact stays on the signs and plates at the place it is used, so this
// page holds none, and no word of it is a verdict (scripts/test-contracts.mjs checks it). Owner after the design round:
// package "settings" (the guide's words and order); `controls: true` sections show the live key bindings (keys.js).
// Review round: the words name the live keys and the Time settings through tokens, so a rebound key or a changed setting
// reads the same everywhere: {key:<action id>} -> keys.label(id) ('Q', or 'B' after a rebind); {time:signs|atJob|hold} ->
// the sentence for the Time setting now. fillGuide(text, { keys, settings }) fills them (ui-guide.js draws the result).
import { KEY_ACTIONS, codeLabel } from './keys.js';

export const GUIDE = {
  title: 'How to play',
  intro: 'You run house 1 of a broiler farm: 6,000 chicks from the plan to the clean, rested house. Days pass in a few minutes; the farm’s numbers tell you how the flock is doing.',
  sections: [
    { id: 'controls', head: 'Getting around', controls: true,
      text: ['Walk with {key:forward} {key:left} {key:back} {key:right} or click the ground (a quick second click runs there). Turn the view with {key:turnLeft} {key:turnRight} or a right-drag, zoom with the wheel or {key:zoomIn} {key:zoomOut}.',
        '{key:use} uses what is in front of you: a sign, a machine’s panel, a bird, a box. {key:menu} closes a panel; with none open it opens the menu. {key:map} opens the farm map.',
        '{key:pause} pauses the clock, {key:speed1} and {key:speed4} set its speed, {key:nextJob} skips to the next job. Tab moves between the buttons on the screen and Enter presses one, so every panel works without the mouse.'] },
    { id: 'day', head: 'Your day',
      text: ['The job card (top right) lists today’s jobs in the order of the day’s rounds. The job at the top is the one to do now: the orange marker on the farm shows its place, and the card says which sign holds its facts.',
        'A job’s strip at the top of its panel shows its steps and the figures it works toward. A job closes when its window passes{time:hold}.',
        'Next job skips the clock to the next job. With jobs still open it asks first and stops when one of them closes.'] },
    { id: 'signs', head: 'Signs and plates',
      text: ['Facts sit on signs where you use them: the brooder sign by the controller, the water sign by the drinker lines, the plates on each machine. Under each fact a small line names its source: one of the guides, or general broiler practice.',
        'Read a sign, then look at the flock and the gauges and set the house.'] },
    { id: 'flock', head: 'Reading the flock',
      text: ['Stand still in the house and you see and hear the flock: where the birds sit, how they move, what the droppings look like, what you hear. The notebook ({key:notebook}) keeps what you saw and every reading you took.',
        'The flock watch (top left) measures the birds every farm hour: weight, deaths, comfort, intake, and the water supply where it matters, each beside the level’s line. It turns amber, then red, and writes a warning that says what, the likely cause and where to look.',
        'Views from the skill tree show more on the floor: floor temperature ({key:floorView}), the birds’ comfort ({key:comfortView}), litter moisture ({key:moistureView}).'] },
    { id: 'records', head: 'Records',
      text: ['The records book on the office desk holds a row for every day: body weight against the target, feed and water, deaths by cause, the litter, the house. Sign the day’s record in the evening.',
        'The result of a level is its key measurement: the day-7 chick weight, a week’s weight, the harvest, the swabs after the clean-out.'] },
    { id: 'levels', head: 'Levels',
      text: ['Seven levels follow one flock: plan the farm, the brooding week, week 2, week 3, weeks 4 and 5, finishing and harvest, clean-out and rest. Each level ends with its key target; when the target is missed the level is replayed from its start (or the level before it, when that is where the trouble began).',
        'After the first full cycle you can raise harder flocks: the hot season, the rainy season, a bad batch of chicks, a water problem.'] },
    { id: 'skills', head: 'Skill tree',
      text: ['Points come from what happens on your farm when you do a branch’s jobs in play. Each level of a branch unlocks a tool or a view ({key:skills} opens the tree).'] },
    { id: 'time', head: 'Time',
      text: ['Pause, 1× and 4× sit on the time bar (bottom left). {time:signs} At a machine’s panel the clock runs slowly{time:atJob}. It stops while a book, the menu, the map or this guide is open.'] },
    { id: 'saving', head: 'Saving',
      text: ['The game saves by itself as you play and keeps the start of every level for a replay. The menu’s Save or load keeps up to three farms in slots, loads them, and backs one up as text you can paste back later (in this browser or another).'] },
    { id: 'settings', head: 'Sound and settings',
      text: ['{key:sound} turns the sound on or off. Settings (the gear on the time bar, or the menu) hold the volume, the clock, the graphics, the camera, the HUD size, sound captions and the keys.'] },
  ],
};

/** The Time settings' sentences (settings.get('time.*'); the defaults are the farmer's requests). */
const TIME_WORDS = {
  signs: (get) => (get('time.signStops', true) ? 'The clock stops while you read a sign or a plate.' : 'The clock runs slowly while you read a sign or a plate.'),
  atJob: (get) => (get('time.atJobSlow', true) ? ', and at ⅔ speed while you stand at an open job’s place' : ''),
  hold: (get) => (get('time.holdJobs', true) ? '; while you are working at it, it is held open' : ', even while you are working at it'),
};
const DEFAULT_LABEL = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, codeLabel(a.codes[0])]));

/** A guide sentence with its tokens filled from the live keys and settings (both optional: the defaults then). */
export function fillGuide(text, { keys = null, settings = null } = {}) {
  const get = (p, d) => { try { const v = settings?.get?.(p); return v == null ? d : v; } catch { return d; } };
  const label = (id) => { try { return keys?.label?.(id) || DEFAULT_LABEL[id] || id; } catch { return DEFAULT_LABEL[id] || id; } };
  return String(text).replace(/\{key:(\w+)\}/g, (_, id) => label(id)).replace(/\{time:(\w+)\}/g, (_, k) => (TIME_WORDS[k] ? TIME_WORDS[k](get) : ''));
}
