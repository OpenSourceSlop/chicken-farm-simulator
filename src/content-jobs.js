// Level 1 job definitions: what the job list shows, when each job is open, where it points, the
// signs that hold its facts, and the rule that marks it done. Owner: package "level" (phase2/level).
// The ids, spots and done rules are the contract the other packages build against (props emit the
// events, the farm emits the actions); titles and texts may still be reworded. PHASE2.md §3-§4.
//
// JobDef:
//   id        stable id; an instance on a day has key `${id}@${day}`
//   kind      'dated' (one day) | 'routine' (every day in `days`) | 'problem' (opened by a symptom)
//   day/days  HUD calendar day, or [first, last] inclusive
//   round     'am' | 'pm' | 'eve' | 'prep' (LEVEL1.rounds) | 'rel'
//   rel       for round 'rel': window relative to an anchor: { anchor: 'truck'|'placed', fromH, toH }
//             ('placed' = the first stack tipped)
//   window    explicit [fromHour, toHour] of its day (overrides the round; 26 = 02:00 next day)
//   closeOn   'placed': the job also closes when the first stack is tipped (d0-floor)
//   preTruck  day 0: listed in the "before the truck" group at the top of the card
//   pin       pinned to the top of the card while open (anchor jobs: grade, place, vent)
//   spot      where the marker points: a SPOTS / SPOTS2 / FARM key ('drinkers.0' = first line),
//             or 'heater' (nearest brooder), 'heater-out' (the brooder that is out), 'dead'
//             (nearest dead bird), 'leak' (the wet patch once found)
//   signs     sign / plate ids that hold the facts this job needs (the card links to them)
//   branch    skill branch the job feeds ('brooding' | 'water' | null)
//   done      completion rule (job-engine.js evaluates it; only events while the job is open count):
//     { type: 'event', event, match?, sameDay? } one bus event; match = matchPayload (events.js);
//                                                sameDay: payload.day === the instance's day
//     { type: 'action', id, match? }             one EV.ACTION with this id ({ id, ...args, result };
//                                                match e.g. { result: { fixed: true } })
//     { type: 'each', id, key, values }          the action once for every value of payload[key]
//     { type: 'count', id, n, sectors?, nearDrinker? }  n actions (from >= sectors broodSector()s;
//                                                nearDrinker: k of them within 1 m of a drinker line)
//     { type: 'coverage', frac, sight, listen? } share of the brooding-floor cells SEEN this round:
//                                                every cell within `sight` m of an EV.CELL position;
//                                                listen: and one EV.LISTEN. Phase 3 (PHASE3.md §3.1):
//                                                area 'brood' (default) | 'house' | 'used', tool
//     (Phase 3 also: onDays on routines, count sectorsOf / match, each has, action / stat anchors;
//      the Phase 3 jobs themselves are in content-jobs-cycle.js)
//     { type: 'state', test }                    named predicate (job-engine.js STATE_TESTS)
//     { type: 'all', of: [rules] }               every rule (each one latches when met)
//     { type: 'any', of: [rules] }               one of the rules
import { EV } from './events.js';
import { keyWordProps, keyWordValues } from './key-words.js'; // fix round: {key:id} tokens filled when read
import { JOBS_CYCLE, JOB_WHERE_CYCLE } from './content-jobs-cycle.js';
// Phase 4 (PHASE4.md §4, §5): the condition jobs, made only in a run of their condition (job-engine.js filters by farm.condition)
import { JOBS_COND, JOB_WHERE_COND } from './content-jobs-cond.js';

const R = (id, days, round, title, rest) => ({ id, kind: 'routine', days, round, title, ...rest });
const D = (id, day, round, title, rest) => ({ id, kind: 'dated', day, round, title, ...rest });
const P = (id, title, rest) => ({ id, kind: 'problem', title, ...rest });
const WEEK = [0, 7];
// Phase 3 (PHASE3.md §3.3): the daily rounds go on to day 41 (the catch is on day 42); the record to
// day 46 (the clean-out days). Level 1's engine only makes days -1..7, so the brooding week is unchanged.
const ROUTINE = [0, 41], ROUTINE1 = [1, 41];
// Phase 3 pacing (review: every flock day under 4.5 minutes of play): from day 8 the four flow tests come every
// other morning (even days) and the silo gauge on the other mornings and the feed-order days (13, 27, 36);
// the afternoon walk rests on the two quiet days of weeks 4-5 (26, 34)
const span = (a, b, keep = () => true) => { const o = []; for (let d = a; d <= b; d++) if (keep(d)) o.push(d); return o; };
export const FLOW_DAYS = [...span(0, 7), ...span(8, 41, (d) => d % 2 === 0)];
export const SILO_DAYS = [...span(0, 7), ...span(8, 41, (d) => d % 2 === 1 || [13, 27, 36].includes(d))];
const WALK_PM_DAYS = span(0, 41, (d) => d !== 26 && d !== 34);
const CONTROLLER_READ = { type: 'action', id: 'controller.read' }; // ui: controller open >= 2 s (all three tabs on one screen)
const GATE_DIP = { type: 'event', event: EV.FOOTDIP, match: { where: 'gate' } };
const HOUSE_DIP = { type: 'event', event: EV.HOUSE_ENTER, match: { dipped: true } };
const SIGNED = { type: 'event', event: EV.RECORD_CLOSED, match: { signed: true }, sameDay: true };
/** A rule with the label the job card and the panel strip show for it (one part of an all / any rule). */
export const lab = (label, rule) => ({ ...rule, label });
/** A state part that does not latch: met only while it holds (job-engine refreshLive). */
export const live = (label, test) => ({ type: 'state', test, live: true, label });

// State predicates the engine evaluates twice a second (job-engine.js implements them):
//   preheat-on       env.heaterSetpoint >= 30 and env.heatersOn
//   litter-covered   farm.litter.cover >= 0.95
//   pans-flooded     every farm.feed.lines[i].flood and panFill >= 0.95
//   lines-flushed    every farm.water.lines[i].flushClear >= 0.99
//   all-placed       farm.flock.inBoxes === 0 and farm.flock.placed > 0
//   dead-cleared     farm.flock.deadOnFloor === 0 and props.carrying !== 'bucket'
//   house-near-target  what the chicks feel (farm-problems feltNearTarget: comfort e at chick
//                      level, wind chill included) within -1.5..+1.5 °C of the target for 30 game min
// The clarity round (every job completes on its outcome; the figures in job-figures.js, the strips in job-strips.js):
//   preheat-on      the thermostat within 1 °C of the brooder sign's day 0 row (34 °C) and the brooders burning
//   litter-covered  + the depth at least 5 cm (litter sign 5–10 cm)
//   pans-flooded    + every rim at most 7 cm (the plate's "on the litter, about 5 cm")
//   lines-flushed   + every flush valve closed again
//   vent-in-band    the timer's air 90–130 % of the vent sign's table for the flock he knows (tomorrow's 6,000 chicks of 42 g on the prep day)
//   nipples-at      every drinker line 10–12 cm (drinker plate, day 0)
//   chick-lights    a dark period of at most 1 h and 30–40 lux at chick level (light plate)
//   flows-in-band   every line flow-tested since the job opened, the last reading within ±3 ml/min of age + 20, nipples ±3 cm of the plate
//   feeders-checked every line switched on, pans at least 30 % full, from day 4 every rim ±3 cm of the plate
//   lines-raised    every drinker line ±3 cm of the plate's nipple height and every pan rim ±3 cm of the plate's rim height
//   night-comfort   (Phase 4, PHASE4.md §2.4) for 30 game min after 18:00: a quarter of the birds panting at most (HEAT_P4.nightPantMax)
//                   and none chilled (mean felt comfort >= −1.5 °C), or from day 28 every working fan with the pad while the outside air is
//                   over about 30 °C (HEAT_P4; the pad off over 90 % house RH)
//   lines-up        every drinker line at or above 55 cm (catching)
//   all-up          every drinker line at or above 55 cm, every pan at or above 40 cm, the brooders up (clean-out)
//   catch-ready     the dimmer at most 20 % (about 10 lux) and at least 3 tunnel fans running (catch sign)
export const STATE_TEST_IDS = ['preheat-on', 'litter-covered', 'pans-flooded', 'lines-flushed', 'all-placed', 'dead-cleared', 'house-near-target',
  'vent-in-band', 'nipples-at', 'chick-lights', 'flows-in-band', 'feeders-checked', 'lines-raised', 'night-comfort', 'lines-up', 'all-up', 'catch-ready'];

export const JOBS = [
  // ---------------- prep day (day -1, 07:00-24:00) ----------------
  D('prep-gate', -1, 'prep', 'Enter through the foot dip at the gate', {
    spot: 'footDipGate', signs: ['sign-gate'], branch: null, done: GATE_DIP }),
  D('prep-preheat', -1, 'prep', 'Start pre-heating the house', {
    spot: 'controller', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'state', test: 'preheat-on' } }),
  D('prep-litter', -1, 'prep', 'Spread the rice husk litter', {
    spot: 'litterHeap', signs: ['sign-litter'], branch: 'brooding',
    done: { type: 'state', test: 'litter-covered' } }),
  D('prep-drinkers', -1, 'prep', 'Lower the drinker lines to chick height', {
    spot: 'drinkers.0', signs: ['sign-water', 'drinker'], branch: 'water',
    done: { type: 'state', test: 'nipples-at' } }),
  D('prep-feeders', -1, 'prep', 'Fill the feeder pans for the chicks', {
    spot: 'feederBox', signs: ['feeder-box'], branch: null,
    done: { type: 'state', test: 'pans-flooded' } }),
  D('prep-silo', -1, 'prep', 'Check the feed in the silos', {
    spot: 'silo', signs: ['silo'], branch: null, done: { type: 'action', id: 'feed.silo' } }),
  D('prep-lights', -1, 'prep', 'Set the light program for the chicks', {
    spot: 'controller', signs: ['controller-lights'], branch: 'brooding',
    done: { type: 'all', of: [lab('Send a light program to the controller', { type: 'action', id: 'light.program' }), live('23 h of light, 30–40 lux at chick level (light plate)', 'chick-lights')] } }),
  D('prep-vent', -1, 'prep', 'Set the minimum ventilation timer', {
    spot: 'controller', signs: ['sign-vent'], branch: null,
    done: { type: 'all', of: [lab('Send a timer setting to the controller', { type: 'action', id: 'vent.timer' }), live('Timer air 90–130 % of what tomorrow’s chicks need (vent sign table)', 'vent-in-band')] } }),
  D('prep-flush', -1, 'prep', 'Flush the water lines', {
    window: [16, 26], spot: 'waterSupply', signs: ['sign-water'], branch: 'water', // 16:00-02:00 = 16-6 h before the truck
    done: { type: 'state', test: 'lines-flushed' } }),
  D('prep-record', -1, 'eve', 'Sign the prep checklist at the office', {
    spot: 'officeDesk', signs: [], branch: null, done: SIGNED }),

  // ---------------- day 0: the chicks arrive (truck 08:00) ----------------
  D('d0-floor', 0, 'am', 'Measure the floor temperature before the chicks come', {
    window: [6, 12], closeOn: 'placed', preTruck: true, spot: 'heater', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'count', id: 'floor.probe', n: 3, sectors: 3 } }),
  D('d0-place', 0, 'rel', 'Place the chicks on the litter', {
    rel: { anchor: 'truck', fromH: 0, toH: 12 }, pin: true, spot: 'boxStacks', signs: ['sign-chicks', 'sign-brooder'], branch: 'brooding',
    done: { type: 'state', test: 'all-placed' } }),
  D('d0-grade', 0, 'rel', 'Grade a sample box of chicks', {
    rel: { anchor: 'truck', fromH: 0, toH: 6 }, pin: true, spot: 'chickTable', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'action', id: 'grade.submit', match: { complete: true } } }), // every chick looked at (or culled), the box weighed
  D('d0-vent', 0, 'rel', 'Take vent temperatures of the chicks', {
    rel: { anchor: 'placed', fromH: 2, toH: 3.5 }, pin: true, spot: 'heater', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'count', id: 'sample.vent', n: 5, sectors: 3 } }),
  D('d1-crop', 1, 'rel', 'Check the chicks’ crops', {
    rel: { anchor: 'placed', fromH: 22, toH: 28 }, pin: true, spot: 'heater', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'count', id: 'sample.crop', n: 10, sectors: 3 } }),
  D('d7-weigh', 7, 'am', 'Weigh sample birds', {
    window: [8, 18], pin: true, spot: 'birdScale', signs: ['bird-scale'], branch: 'brooding', // 08:00 day 7 = flock age 7.0
    done: { type: 'count', id: 'sample.weigh', n: 50, sectors: 5 } }),

  // ---------------- every day: morning round 06:00-12:00 ----------------
  R('r-dips', ROUTINE, 'am', 'Enter through the foot dips', {
    preTruck: true, spot: 'houseDoor', signs: ['sign-gate'], branch: null, done: { type: 'all', of: [lab('Foot dip at the gate', GATE_DIP), lab('Foot dip at the house door', HOUSE_DIP)] } }),
  R('r-controller', ROUTINE, 'am', 'Read the climate controller: temperature, ventilation, lights', {
    preTruck: true, spot: 'controller', signs: ['sign-brooder', 'sign-vent', 'controller-lights'], branch: 'brooding', done: CONTROLLER_READ }),
  R('r-meter', ROUTINE, 'am', 'Read the water meter', {
    preTruck: true, spot: 'waterSupply', signs: ['sign-water'], branch: 'water', done: { type: 'action', id: 'water.meter' } }),
  R('r-walk', ROUTINE1, 'am', 'Walk the house and look at the chicks', {
    spot: 'heater', signs: ['sign-health', 'sign-brooder'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.5, sight: 2, listen: true, area: 'used', maxCells: 150 } }), // 150 cells = week 1's half of 300
  R('r-drinkers', ROUTINE, 'am', 'Check drinker flow and height', {
    onDays: FLOW_DAYS, spot: 'drinkers.0', signs: ['sign-water', 'drinker'], branch: 'water',
    done: { type: 'all', of: [lab('A flow test on every line', { type: 'each', id: 'water.flowtest', key: 'line', values: [0, 1, 2, 3] }),
      live('Every line’s last flow within 3 ml/min of age + 20, nipples at the plate’s height', 'flows-in-band')] } }),
  R('r-feeders', ROUTINE, 'am', 'Check the feeders and the silo level', {
    onDays: SILO_DAYS, spot: 'feederBox', signs: ['feeder-box', 'silo'], branch: null,
    done: { type: 'all', of: [lab('Read the feed meter (feeder box)', { type: 'action', id: 'feed.meter' }), lab('Read the silo gauge (outside)', { type: 'action', id: 'feed.silo' }),
      live('Every line on, feed in every pan, rims at the birds’ backs from day 4', 'feeders-checked')] } }),
  R('r-dead-am', ROUTINE1, 'am', 'Pick up dead birds and count them at the bin', {
    spot: 'dead', signs: ['sign-health'], branch: null, done: { type: 'state', test: 'dead-cleared' } }),

  // ---------------- afternoon round 13:00-18:00, evening 16:00-24:00 ----------------
  R('r-dips-pm', ROUTINE, 'pm', 'Dip your boots at the house door', {
    spot: 'houseDoor', signs: ['sign-gate'], branch: null, done: HOUSE_DIP }),
  R('r-walk-pm', ROUTINE, 'pm', 'Walk the house again', {
    onDays: WALK_PM_DAYS, spot: 'heater', signs: ['sign-health', 'sign-brooder'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.35, sight: 2, listen: true, area: 'used', maxCells: 105 } }),
  R('r-controller-pm', [0, 14], 'pm', 'Read the afternoon temperature', {
    spot: 'controller', signs: ['sign-brooder'], branch: 'brooding', done: CONTROLLER_READ }),
  R('r-litter', ROUTINE, 'pm', 'Check the litter ({key:squeeze}: squeeze a handful)', {
    spot: 'signLitter', signs: ['sign-litter'], branch: null,
    // fix round: the parts of the floor in use (the brooding floor while the curtain is down, the whole house after)
    done: { type: 'count', id: 'litter.squeeze', n: 3, sectors: 2, nearDrinker: 1, sectorsOf: 'used' } }),
  R('r-dead-pm', ROUTINE, 'pm', 'Pick up dead birds', {
    spot: 'dead', signs: ['sign-health'], branch: null, done: { type: 'state', test: 'dead-cleared' } }),
  R('r-record', [0, 46], 'eve', 'Fill in the daily record at the office', {
    spot: 'officeDesk', signs: [], branch: null, done: SIGNED }),

  // ---------------- problems: opened by a symptom the farmer met (PHASE2.md §7) ----------------
  // Titles name what he saw, never the cause.
  P('p-brooder', 'A brooder is not burning', {
    problem: 'brooder-out', spot: 'heater-out', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'action', id: 'heat.relight', match: { result: { fixed: true } } } }),
  P('p-cold-night', 'Night check: a cold night is forecast', {
    problem: 'cold-night', window: [20, 24], spot: 'controller', signs: ['sign-brooder', 'sign-vent'], branch: 'brooding',
    done: { type: 'all', of: [lab('Read the controller', CONTROLLER_READ), lab('Walk 30 % of the brooding floor and look for huddles', { type: 'coverage', frac: 0.3, sight: 2 })] } }),
  P('p-water-drop', 'Low water flow: find the cause', {
    problem: 'blocked-filter', spot: 'waterSupply', signs: ['sign-water', 'water-supply'], branch: 'water',
    done: { type: 'action', id: 'water.clearFilter', match: { result: { fixed: true } } } }),
  P('p-leak', 'Wet litter here: find what wets it', {
    problem: 'leaking-nipple', spot: 'leak', signs: ['sign-litter', 'sign-water'], branch: 'water',
    done: { type: 'action', id: 'water.fixLeak', match: { result: { fixed: true } } } }),
  P('p-wet-patch', 'Put fresh litter on the wet patch', {
    problem: 'leaking-nipple', after: 'p-leak', spot: 'leak', signs: ['sign-litter'], branch: null,
    done: { type: 'action', id: 'litter.patch', match: { result: { onLeak: true } } } }),
  P('p-order-feed', 'Order feed for the silos', {
    problem: 'low-silo', spot: 'officeDesk', signs: ['silo', 'feeder-box'], branch: null,
    done: { type: 'action', id: 'feed.order', check: 'order-days' } }), // the silo to 3 days of feed (job-engine ACTION_CHECKS)
  P('p-warm', 'The house is above its target this afternoon', {
    problem: 'warm-afternoon', spot: 'controller', signs: ['sign-vent', 'sign-brooder'], branch: null,
    // done once he changed the air or the heat (any of the controller's settings) and the air the
    // chicks feel is back near the target (not over it, not chilled under it) for 30 min
    done: { type: 'all', of: [
      { type: 'any', label: 'Change the air or the heat at the controller', of: [{ type: 'action', id: 'vent.timer' }, { type: 'action', id: 'heat.setpoint' }, { type: 'action', id: 'vent.fans' }, { type: 'action', id: 'vent.pad' }] },
      lab('The chicks feel near the target for 30 farm minutes', { type: 'state', test: 'house-near-target' })] } }),
  P('p-report', 'Report the deaths to the company vet', {
    problem: 'abnormal-deaths', spot: 'officeDesk', signs: ['sign-health'], branch: null,
    done: { type: 'action', id: 'phone.report' } }),
];

/** Phase 3 (PHASE3.md §3.1): the one job list of every level (the engine makes only the jobs whose
 *  days lie inside its level, and problem jobs only for that level's problems). Phase 4: the condition jobs too
 *  (a job with `condition` only in a run of that condition, farm.condition). */
export const ALL_JOBS = [...JOBS, ...JOBS_CYCLE, ...JOBS_COND];
export const allJobs = () => ALL_JOBS;
export const jobById = (id) => ALL_JOBS.find((j) => j.id === id) || null;
/** The card's "where" line of any job (Phase 2's or the cycle's). */
export const jobWhere = (id) => JOB_WHERE[id] || JOB_WHERE_CYCLE[id] || JOB_WHERE_COND[id] || '';

// Skills update (SKILLS.md §6.2): the where line of a job a payoff moves (the place and the check, never the value; general
// words: the figures stay on the signs). Keys as {key:id} tokens, filled when read (keyWordValues below).
const ORDER_IDS = ['p-order-feed', 'w2-order', 'w45-order', 'f-order'];
const PHONE_IDS = ['p-order-feed', 'w2-order', 'w45-order', 'f-order', 'f-book', 'p-report', 'p-hunched', 'c-book'];
const WEIGH_IDS = ['d7-weigh', 'w2-weigh', 'w3-weigh', 'w45-weigh28', 'w45-weigh35', 'f-weigh'];
const each = (ids, text) => Object.fromEntries(ids.map((i) => [i, text]));
export const JOB_WHERE_PAYOFF = {
  pocketPhone: each(PHONE_IDS, 'The phone in your pocket: {key:phone} from anywhere (Farm Planning 2).'),
  phoneRecord: each(['r-record', 'prep-record'], 'The phone in your pocket: {key:phone}, then Sign today’s record (Farm Planning 3).'),
  siloOrder: each(ORDER_IDS, 'The silo gauge outside, north of the house: Order to 3 days (Feed 2); or the phone at the office desk.'),
  waterAllLines: { 'r-drinkers': 'Water supply, south-west corner inside: Read the sight tubes (Water 2); then a cup test only at the regulator of a line that reads off.' },
  frameWeigh: each(WEIGH_IDS, 'Bird scale: take the scale and frame, set the frame down in three parts of the house: 25 birds (Growth 2), Weigh the frame weighs each frame in one press; the marker shows a part not weighed yet.'),
  quickSamples: { 'd0-vent': 'Among the chicks: {key:use} picks one up. Three chicks, one from each of three parts of the floor (Brooding 2); the marker shows a part not sampled yet.',
    'd1-crop': 'Among the chicks: pick up six from three parts of the floor and feel the crop (Brooding 2; Next chick takes the next one near you); the marker shows a part not sampled yet.',
    'b-crop48': 'Any chicks on the floor: feel six crops from three parts of the floor (Brooding 2).' },
  tallyBucket: each(['r-dead-am', 'r-dead-pm'], 'Dead birds on the floor: {key:use} picks up every one near you into the tally bucket, counted as they go in (Biosecurity 2); then empty it at the bin outside the south wall.'),
  passCheck: { 'w2-check': 'Among the birds: walk slowly; each bird you see walk counts (Biosecurity 3), and {key:use} picks one up to watch it in the hand. Ten birds from three parts of the floor.' },
};
/** The order the where line takes a payoff in (the phone before the silo gauge: anywhere is nearest). */
const WHERE_ORDER = ['pocketPhone', 'phoneRecord', 'waterAllLines', 'passCheck', 'frameWeigh', 'quickSamples', 'tallyBucket', 'siloOrder'];
/** The card's where line as the payoffs give it now: has(key) -> the payoff holds for this job (the instance's variant or
 *  the perks); the job's own line otherwise. */
export function jobWhereNow(id, has = () => false) {
  for (const k of WHERE_ORDER) { const t = JOB_WHERE_PAYOFF[k][id]; if (t && has(k)) return t; }
  return jobWhere(id);
}

// One line of "where" for the open job on the card: the place and the check, never the value.
export const JOB_WHERE = {
  'prep-gate': 'Walk through the foot dip beside the gate sign.',
  'prep-preheat': 'Climate controller, inside on the north wall across from the door: the Temperature section.',
  'prep-litter': 'Rice husk heap west of the door: pick a depth, take the barrow and push it over the brooding floor, wall to wall.',
  'prep-drinkers': 'Regulator at the west end of each of the four drinker lines (line 1 by the north wall, line 4 by the south wall): winch each line to 10–12 cm, then walk on to the next regulator.',
  'prep-feeders': 'Feeder control box, north wall, between the water lines sign and the brooder sign: pans down on the litter, flood windows open, auger on; the pans fill over farm time.',
  'prep-silo': 'Feed silos outside, north of the house: read the level gauge.',
  'prep-lights': 'Climate controller: the Lights section.',
  'prep-vent': 'Climate controller: the Ventilation section. The minimum ventilation sign hangs beside it.',
  'prep-flush': 'Water supply, south-west corner inside: open each flush valve, close it when the water runs clear (about 10 farm minutes a line, with the clock running).',
  'prep-record': 'Office desk on the porch: the prep page of the record book.',
  'd0-floor': 'Brooding area: press {key:probe} at your feet, in three different parts of the floor (the marker shows a part not measured yet).',
  'd0-place': 'Chick boxes by the truck: {key:use} picks up a stack, {key:use} inside the brooding area tips it.',
  'd0-grade': 'Chick sample table beside the boxes.',
  'd0-vent': 'Among the chicks: {key:use} picks one up. Five chicks from three parts of the floor (the marker shows a part not sampled yet).',
  'd1-crop': 'Among the chicks: pick up ten from three parts of the floor and feel the crop (the marker shows a part not sampled yet).',
  'd7-weigh': 'Bird scale in the brooding area: take the scale and frame, set the frame down in five places (the marker shows a part not weighed yet).',
  'r-dips': 'Foot dip at the gate, then the dip at the house door.',
  'r-controller': 'Climate controller: keep the panel open a moment to read it.',
  'r-meter': 'Water meter at the water supply, south-west corner inside.',
  'r-walk': 'Walk the length of the brooding area; stand still a moment to look and listen.',
  'r-drinkers': 'Regulator at the west end of each of the four lines (line 1 by the north wall, line 4 by the south wall): a flow test on each, 1 farm minute with the clock running; then walk on to the next regulator.',
  'r-feeders': 'Feeder control box on the north wall (feed meter, every line on), then the silo gauge outside, north of the house.',
  'r-dead-am': 'Dead birds on the floor: {key:use} picks them up. Count them at the bin outside the south wall.',
  'r-dips-pm': 'Foot dip at the house door.',
  'r-walk-pm': 'Walk the brooding area again; stand still a moment to look and listen.',
  'r-controller-pm': 'Climate controller: keep the panel open a moment to read it.',
  'r-litter': 'On the litter: {key:squeeze} squeezes a handful. Two parts of the floor, one of them under a drinker line.',
  'r-dead-pm': 'Dead birds on the floor: {key:use} picks them up. Count them at the bin outside the south wall.',
  'r-record': 'Office desk on the porch: today’s page of the record book.',
  'p-brooder': 'The brooder that is not burning: E at it.',
  'p-cold-night': 'Between 20:00 and 24:00: the climate controller, then a short walk through the brooding area.',
  'p-water-drop': 'Water supply: the filter and its gauges, the meter, the lines (cleaning the filter takes 5 farm minutes).',
  'p-leak': 'The wet patch on the litter: look at the line above it.',
  'p-wet-patch': 'Rice husk heap: take a sack of husk, then {key:use} on the wet patch.',
  'p-order-feed': 'Office desk on the porch: the phone.',
  'p-warm': 'Climate controller: the brooders (Temperature) and the minimum ventilation timer (Ventilation); the minimum ventilation sign beside it. Then the chicks must feel near the target for 30 farm minutes with the clock running.',
  'p-report': 'Office desk on the porch: the phone.',
};

// fix round: a title or a place line that names a farm key reads it as bound now (Settings → Keys)
for (const j of ALL_JOBS) keyWordProps(j, ['title']);
for (const t of [JOB_WHERE, JOB_WHERE_CYCLE, JOB_WHERE_COND, ...Object.values(JOB_WHERE_PAYOFF)]) keyWordValues(t);
