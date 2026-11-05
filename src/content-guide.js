// How to play (PHASE5.md §6.2): the player guide inside the game. It says how the GAME works (controls, the screen, the
// day, jobs, signs, records, levels, saving); every farming fact stays on the signs and plates at the place it is used, so
// this page holds none, and no word of it is a verdict (scripts/test-contracts.mjs checks it). Owner: package "settings".
// Plain English a Thai farmer reads easily: one idea a sentence, the HUD's own names in **bold** (ui-guide.js draws
// **…** as bold). `controls: true` sections show the live key list (keys.js), `picture: true` the HUD picture.
// The words name the live keys and the Time settings through tokens, so a rebound key or a changed setting reads the same
// everywhere: {key:<action id>} -> keys.label(id) ('Q', or 'B' after a rebind); {time:signs|atJob|hold} -> the sentence
// for the Time setting now. fillGuide(text, { keys, settings }) fills them (ui-guide.js draws the result; the intro cards
// of ui-intro.js use it too).
import { KEY_ACTIONS, codeLabel } from './keys.js';
import { SKILLS_UPDATE } from './config.js';

const SKILLS_TEXT = ['Points come from what happens on your farm when you do a branch’s jobs in play.',
  'Each level of a branch unlocks a tool or a view. {key:skills} opens the **skill tree**.'];
const SKILLS_TEXT_LIVE = ['Points come from what happens on your farm when you do a branch’s jobs in play. {key:skills} opens the **skill tree**.',
  'Each branch has three levels. Level 1 (**See more**) shows you more: a view or a reading where the job is done.',
  'Level 2 (**Faster**) makes a job of the branch faster: fewer steps, less walking, one press where there were many. Its key shows the sign’s working beside it.',
  'Level 3 (**The equipment does it**) hands a routine job to the farm’s equipment once you have finished a flock. The job stays on the **job card** as a quick look at the reading.',
  'Now and then a piece of equipment stops. The **flock watch** has an **Equipment** row: it says what stopped and where to look, and the job is done by hand again until you fix it.',
  'Each milestone counts once in your first flock and once more in a later one. **Settings → Automation** switches the equipment off for every branch or one at a time.'];

export const GUIDE = {
  title: 'How to play',
  intro: 'You run house 1 of a broiler farm, from the plan to the clean, rested house. A farm day passes in a few minutes. The flock and the farm’s records show you how it goes.',
  sections: [
    { id: 'controls', head: 'Getting around', controls: true,
      text: ['Walk with {key:forward} {key:left} {key:back} {key:right}, or click the ground. Click twice quickly to run there, or hold {key:run} while you walk.',
        'Turn the view with {key:turnLeft} {key:turnRight} or by dragging with the right mouse button. Zoom with the wheel or {key:zoomIn} {key:zoomOut}.',
        '{key:use} uses what is in front of you: a sign, a machine’s panel, a bird or a box.',
        '{key:menu} closes a panel. With no panel open, it opens the **menu**.',
        '{key:map} opens the farm map. Click a place on it and you walk there.',
        'Tab moves between the buttons on the screen and Enter presses one, so every panel works without the mouse.'] },
    { id: 'screen', head: 'The screen', picture: true,
      text: ['The **clock** and the **gauges** sit at the top left: the farm time, the weather and the house as its controller reads it.',
        'The **flock watch** sits under them once the chicks are in the house.',
        'The **job card** at the top right lists the jobs of the day.',
        'The **time bar** at the bottom left holds pause, 1×, 4×, **Next job**, the map, the menu and the sound.',
        'When you stand at something you can use, its name and its key show at the bottom of the screen.'] },
    { id: 'day', head: 'Your day',
      text: ['The **job card** lists today’s jobs in the order of the day’s rounds.',
        'The job at the top is the one to do now. An orange marker on the farm shows its place, and the card says which sign holds its facts.',
        'The strip at the top of a job’s panel shows the job’s steps and the figures it works toward.',
        'A job closes when its window passes{time:hold}.',
        '**Next job** ({key:nextJob}) skips the clock to the next job. When jobs are still open it asks first, and it stops when one of them closes.'] },
    { id: 'signs', head: 'Signs and plates',
      text: ['Facts sit on signs at the place where you use them: the brooder sign by the controller, the water sign by the drinker lines, a plate on each machine.',
        'Under each fact a small line names its source: one of the guides, or general broiler practice.',
        'Read a sign, then look at the flock and the gauges, and set the house.'] },
    { id: 'flock', head: 'Reading the flock',
      text: ['Stand still in the house to see and hear the flock: where the birds sit, how they move, the droppings and the sounds they make.',
        'The **notebook** ({key:notebook}) keeps what you saw and every reading you took.',
        'The **flock watch** measures the birds every farm hour: weight, deaths, comfort and intake, and the water supply where it matters. Each row stands beside the level’s line.',
        'A row turns amber, then red, and a warning says what changed, the likely cause and where to look.',
        'Views from the **skill tree** show more on the floor: the floor temperature ({key:floorView}), the birds’ comfort ({key:comfortView}) and the litter moisture ({key:moistureView}).'] },
    { id: 'records', head: 'Records',
      text: ['The **records book** on the office desk keeps a row for every day: body weight against the target, feed and water, deaths by cause, the litter and the house.',
        'Sign the day’s record in the evening.',
        'Each level ends on its key measurement: the day-7 weight against the chick weight, a week’s weight, the harvest, the swabs after the clean-out.'] },
    { id: 'levels', head: 'Levels',
      text: ['Seven levels follow one flock: plan the farm, the brooding week, week 2, week 3, weeks 4 and 5, finishing and harvest, clean-out and rest.',
        'Each level has a key target. When the target is missed, you play the level again from its start, or from the level before when that is where the trouble began.',
        'After your first full cycle you can raise harder flocks: the hot season, the rainy season, a bad batch of chicks or a water problem.'] },
    { id: 'skills', head: 'Skill tree',
      // Skills update (SKILLS.md §6.4): while config SKILLS_UPDATE.live the section says what the three steps do (game words
      // only, no farming fact); with live false it reads as in Phase 5
      get text() { return SKILLS_UPDATE.live ? SKILLS_TEXT_LIVE : SKILLS_TEXT; } },
    { id: 'time', head: 'Time',
      text: ['The **time bar** holds pause ({key:pause}), 1× ({key:speed1}) and 4× ({key:speed4}).',
        '{time:signs}',
        'At a machine’s panel the clock runs slowly{time:atJob}.',
        'The clock stands still while a book, the menu, the map or this guide is open.',
        'Settings → Time changes how the clock runs.'] },
    { id: 'saving', head: 'Saving',
      text: ['The game saves by itself as you play. It keeps the start of every level, so you can play a level again.',
        'In the **menu**, **Save or load** keeps up to three farms in slots and loads them again.',
        '**Back up** gives a farm as text. Keep the text somewhere safe, like a note or a chat with yourself, and paste it back later in this browser or another.',
        '**Continue** on the title card goes on from your newest save.'] },
    { id: 'settings', head: 'Sound and settings',
      text: ['{key:sound}, or the speaker key on the time bar, turns the sound off and on.',
        '**Settings** (the gear on the time bar, or the menu) hold the volume, the clock, the graphics, the camera, the size of the HUD, sound captions and the keys.',
        'Every key can be changed in Settings → Keys. This guide always shows the keys as they are now.'] },
  ],
};

/** The HUD picture's boxes (ui-guide.js): where each card sits on the screen, in % of the screen, and its name. */
export const HUD_PICTURE = [
  { id: 'clock', name: 'Clock', x: 2, y: 3, w: 15, h: 15 },
  { id: 'gauges', name: 'Gauges', x: 18, y: 3, w: 30, h: 15 },
  { id: 'watch', name: 'Flock watch', x: 2, y: 21, w: 26, h: 30 },
  { id: 'jobs', name: 'Job card', x: 72, y: 3, w: 26, h: 42 },
  { id: 'prompt', name: 'What you can use', x: 35, y: 78, w: 32, h: 8 },
  { id: 'timebar', name: 'Time bar', x: 2, y: 88, w: 40, h: 9 },
];

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

/** A filled sentence as runs for drawing: [{ text, bold }] (the **…** marks; no other markup). */
export function guideRuns(text) {
  const out = [];
  String(text).split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return;
    const b = /^\*\*[^*]+\*\*$/.test(part);
    out.push({ text: b ? part.slice(2, -2) : part, bold: b });
  });
  return out;
}
