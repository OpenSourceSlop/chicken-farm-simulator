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
//                                                listen: and one EV.LISTEN
//     { type: 'state', test }                    named predicate (job-engine.js STATE_TESTS)
//     { type: 'all', of: [rules] }               every rule (each one latches when met)
//     { type: 'any', of: [rules] }               one of the rules
import { EV } from './events.js';

const R = (id, days, round, title, rest) => ({ id, kind: 'routine', days, round, title, ...rest });
const D = (id, day, round, title, rest) => ({ id, kind: 'dated', day, round, title, ...rest });
const P = (id, title, rest) => ({ id, kind: 'problem', title, ...rest });
const WEEK = [0, 7];
const CONTROLLER_READ = { type: 'action', id: 'controller.read' }; // ui: controller open >= 2 s (all three tabs on one screen)
const GATE_DIP = { type: 'event', event: EV.FOOTDIP, match: { where: 'gate' } };
const HOUSE_DIP = { type: 'event', event: EV.HOUSE_ENTER, match: { dipped: true } };
const SIGNED = { type: 'event', event: EV.RECORD_CLOSED, match: { signed: true }, sameDay: true };

// State predicates the engine evaluates twice a second (job-engine.js implements them):
//   preheat-on       env.heaterSetpoint >= 30 and env.heatersOn
//   litter-covered   farm.litter.cover >= 0.95
//   pans-flooded     every farm.feed.lines[i].flood and panFill >= 0.95
//   lines-flushed    every farm.water.lines[i].flushClear >= 0.99
//   all-placed       farm.flock.inBoxes === 0 and farm.flock.placed > 0
//   dead-cleared     farm.flock.deadOnFloor === 0 and props.carrying !== 'bucket'
//   house-near-target  env.houseTemp - env.windChill (what the chicks feel) <= env.targetTemp + 1.5
//                      for 30 game min
export const STATE_TEST_IDS = ['preheat-on', 'litter-covered', 'pans-flooded', 'lines-flushed', 'all-placed', 'dead-cleared', 'house-near-target'];

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
    spot: 'drinkers.0', signs: ['sign-water'], branch: 'water',
    done: { type: 'each', id: 'water.height', key: 'line', values: [0, 1, 2, 3] } }),
  D('prep-feeders', -1, 'prep', 'Fill the feeder pans for the chicks', {
    spot: 'feederBox', signs: ['feeder-box'], branch: null,
    done: { type: 'state', test: 'pans-flooded' } }),
  D('prep-silo', -1, 'prep', 'Check the feed in the silos', {
    spot: 'silo', signs: ['silo'], branch: null, done: { type: 'action', id: 'feed.silo' } }),
  D('prep-lights', -1, 'prep', 'Set the light program for the chicks', {
    spot: 'controller', signs: ['controller-lights'], branch: 'brooding', done: { type: 'action', id: 'light.program' } }),
  D('prep-vent', -1, 'prep', 'Set the minimum ventilation timer', {
    spot: 'controller', signs: ['sign-vent'], branch: null, done: { type: 'action', id: 'vent.timer' } }),
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
    done: { type: 'action', id: 'grade.submit' } }),
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
  R('r-dips', WEEK, 'am', 'Enter through the foot dips', {
    preTruck: true, spot: 'houseDoor', signs: ['sign-gate'], branch: null, done: { type: 'all', of: [GATE_DIP, HOUSE_DIP] } }),
  R('r-controller', WEEK, 'am', 'Read the climate controller: temperature, ventilation, lights', {
    preTruck: true, spot: 'controller', signs: ['sign-brooder', 'sign-vent', 'controller-lights'], branch: 'brooding', done: CONTROLLER_READ }),
  R('r-meter', WEEK, 'am', 'Read the water meter', {
    preTruck: true, spot: 'waterSupply', signs: ['sign-water'], branch: 'water', done: { type: 'action', id: 'water.meter' } }),
  R('r-walk', [1, 7], 'am', 'Walk the house and look at the chicks', {
    spot: 'heater', signs: ['sign-health', 'sign-brooder'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.5, sight: 2, listen: true } }),
  R('r-drinkers', WEEK, 'am', 'Check drinker flow and height', {
    spot: 'drinkers.0', signs: ['sign-water'], branch: 'water',
    done: { type: 'each', id: 'water.flowtest', key: 'line', values: [0, 1, 2, 3] } }),
  R('r-feeders', WEEK, 'am', 'Check the feeders and the silo level', {
    spot: 'feederBox', signs: ['feeder-box', 'silo'], branch: null,
    done: { type: 'all', of: [{ type: 'action', id: 'feed.meter' }, { type: 'action', id: 'feed.silo' }] } }),
  R('r-dead-am', [1, 7], 'am', 'Pick up dead birds and count them at the bin', {
    spot: 'dead', signs: ['sign-health'], branch: null, done: { type: 'state', test: 'dead-cleared' } }),

  // ---------------- afternoon round 13:00-18:00, evening 16:00-24:00 ----------------
  R('r-dips-pm', WEEK, 'pm', 'Dip your boots at the house door', {
    spot: 'houseDoor', signs: ['sign-gate'], branch: null, done: HOUSE_DIP }),
  R('r-walk-pm', WEEK, 'pm', 'Walk the house again', {
    spot: 'heater', signs: ['sign-health', 'sign-brooder'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.35, sight: 2, listen: true } }),
  R('r-controller-pm', WEEK, 'pm', 'Read the afternoon temperature', {
    spot: 'controller', signs: ['sign-brooder'], branch: 'brooding', done: CONTROLLER_READ }),
  R('r-litter', WEEK, 'pm', 'Check the litter (Q: squeeze a handful)', {
    spot: 'signLitter', signs: ['sign-litter'], branch: null,
    done: { type: 'count', id: 'litter.squeeze', n: 3, sectors: 2, nearDrinker: 1 } }),
  R('r-dead-pm', WEEK, 'pm', 'Pick up dead birds', {
    spot: 'dead', signs: ['sign-health'], branch: null, done: { type: 'state', test: 'dead-cleared' } }),
  R('r-record', WEEK, 'eve', 'Fill in the daily record at the office', {
    spot: 'officeDesk', signs: [], branch: null, done: SIGNED }),

  // ---------------- problems: opened by a symptom the farmer met (PHASE2.md §7) ----------------
  // Titles name what he saw, never the cause.
  P('p-brooder', 'A brooder is not burning', {
    problem: 'brooder-out', spot: 'heater-out', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'action', id: 'heat.relight', match: { result: { fixed: true } } } }),
  P('p-cold-night', 'Night check: a cold night is forecast', {
    problem: 'cold-night', window: [20, 24], spot: 'controller', signs: ['sign-brooder', 'sign-vent'], branch: 'brooding',
    done: { type: 'all', of: [CONTROLLER_READ, { type: 'coverage', frac: 0.3, sight: 2 }] } }),
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
    done: { type: 'action', id: 'feed.order' } }),
  P('p-warm', 'The house is above its target this afternoon', {
    problem: 'warm-afternoon', spot: 'controller', signs: ['sign-brooder', 'sign-vent'], branch: null,
    // done once he changed the air (tunnel fans, the timer or the pad) and the chicks feel it
    done: { type: 'all', of: [
      { type: 'any', of: [{ type: 'action', id: 'vent.fans' }, { type: 'action', id: 'vent.timer' }, { type: 'action', id: 'vent.pad' }] },
      { type: 'state', test: 'house-near-target' }] } }),
  P('p-report', 'Report the deaths to the company vet', {
    problem: 'abnormal-deaths', spot: 'officeDesk', signs: ['sign-health'], branch: null,
    done: { type: 'action', id: 'phone.report' } }),
];

export const jobById = (id) => JOBS.find((j) => j.id === id) || null;

// One line of "where" for the open job on the card: the place and the check, never the value.
export const JOB_WHERE = {
  'prep-gate': 'Walk through the foot dip beside the gate sign.',
  'prep-preheat': 'Climate controller, inside on the north wall across from the door: the Temperature section.',
  'prep-litter': 'Rice husk heap west of the door: pick a depth, take the barrow and push it over the whole floor.',
  'prep-drinkers': 'Regulator at the west end of each drinker line: winch the line up or down.',
  'prep-feeders': 'Feeder control box, north wall, between the water lines sign and the brooder sign: run and flood each line.',
  'prep-silo': 'Feed silos outside, north of the house: read the level gauge.',
  'prep-lights': 'Climate controller: the Lights section.',
  'prep-vent': 'Climate controller: the Ventilation section. The minimum ventilation sign hangs beside it.',
  'prep-flush': 'Water supply, south-west corner inside: open each flush valve, close it when the water runs clear.',
  'prep-record': 'Office desk on the porch: the prep page of the record book.',
  'd0-floor': 'Brooding area: press T at your feet, in three different parts of the floor.',
  'd0-place': 'Chick boxes by the truck: E picks up a stack, E inside the brooding area tips it.',
  'd0-grade': 'Chick sample table beside the boxes.',
  'd0-vent': 'Among the chicks: E picks one up. Five chicks from three parts of the floor.',
  'd1-crop': 'Among the chicks: pick up ten from three parts of the floor and feel the crop.',
  'd7-weigh': 'Bird scale in the brooding area: take the scale and frame, set the frame down in five places.',
  'r-dips': 'Foot dip at the gate, then the dip at the house door.',
  'r-controller': 'Climate controller: keep the panel open a moment to read it.',
  'r-meter': 'Water meter at the water supply, south-west corner inside.',
  'r-walk': 'Walk the length of the brooding area; stand still a moment to look and listen.',
  'r-drinkers': 'Regulator at the west end of each line: a flow test on all four lines.',
  'r-feeders': 'Feeder control box (feed meter), then the silo gauge outside.',
  'r-dead-am': 'Dead birds on the floor: E picks them up. Count them at the bin outside the south wall.',
  'r-dips-pm': 'Foot dip at the house door.',
  'r-walk-pm': 'Walk the brooding area again; stand still a moment to look and listen.',
  'r-controller-pm': 'Climate controller: keep the panel open a moment to read it.',
  'r-litter': 'On the litter: Q squeezes a handful. Two parts of the floor, one under a drinker line.',
  'r-dead-pm': 'Dead birds on the floor: E picks them up. Count them at the bin outside the south wall.',
  'r-record': 'Office desk on the porch: today’s page of the record book.',
  'p-brooder': 'The brooder that is not burning: E at it.',
  'p-cold-night': 'Between 20:00 and 24:00: the climate controller, then a short walk through the brooding area.',
  'p-water-drop': 'Water supply: the filter and its gauges, the meter, the lines.',
  'p-leak': 'The wet patch on the litter: look at the line above it.',
  'p-wet-patch': 'Rice husk heap: take a sack of husk, then E on the wet patch.',
  'p-order-feed': 'Office desk on the porch: the phone.',
  'p-warm': 'Climate controller: tunnel fans, the cooling pad and the timer. Watch the house and the chicks.',
  'p-report': 'Office desk on the porch: the phone.',
};
