// Level 1 job definitions: what the job list shows, when each job is open, where it points, the
// signs that hold its facts, and the rule that marks it done. Owner: package "level" (phase2/level).
// The ids, spots and done rules are the contract the other packages build against (props emit the
// events, the farm emits the actions); titles and texts may still be reworded. PHASE2.md "Jobs".
//
// JobDef:
//   id        stable id; an instance on a day has key `${id}@${day}`
//   kind      'dated' (one day) | 'routine' (every day in `days`) | 'problem' (opened by a symptom)
//   day/days  flock day, or [first, last] inclusive
//   round     'am' | 'pm' | 'eve' (LEVEL1.rounds) | 'prep' (day -1, 07:00-24:00) | 'rel'
//   rel       for round 'rel': window relative to an anchor: { anchor: 'truck'|'placed', fromH, toH }
//   window    explicit [fromHour, toHour] (overrides the round)
//   spot      where the marker points: a SPOTS / SPOTS2 / FARM key ('drinkers.0' = first line),
//             or 'heater' (nearest brooder), 'dead' (nearest dead bird), 'leak' (the leak)
//   signs     sign / panel ids that hold the facts this job needs (the card links to them)
//   branch    skill branch the job feeds ('brooding' | 'water' | null)
//   done      completion rule (job-engine.js evaluates it):
//     { type: 'event', event, match }            one bus event whose payload matches
//     { type: 'action', id, match? }             one EV.ACTION with this id
//     { type: 'each', id, key, values }          EV.ACTION id once for every value of payload[key]
//     { type: 'count', id, n, sectors?, area? }  n actions (from >= sectors broodSector()s)
//     { type: 'coverage', frac, listen? }        share of the brooding floor cells walked this round
//     { type: 'state', test }                    named predicate on farm/records (job-engine.js)
//     { type: 'all', of: [rules] }               every rule
//     { type: 'any', of: [rules] }               one of the rules
import { EV } from './events.js';

const R = (id, days, round, title, rest) => ({ id, kind: 'routine', days, round, title, ...rest });
const D = (id, day, round, title, rest) => ({ id, kind: 'dated', day, round, title, ...rest });
const P = (id, title, rest) => ({ id, kind: 'problem', title, ...rest });
const WEEK = [0, 7];

export const JOBS = [
  // ---------------- prep day (day -1) ----------------
  D('prep-gate', -1, 'prep', 'Enter through the foot dip at the gate', {
    spot: 'footDipGate', signs: ['sign-gate'], branch: null,
    done: { type: 'event', event: EV.FOOTDIP, match: { where: 'gate' } } }),
  D('prep-preheat', -1, 'prep', 'Start pre-heating the house', {
    spot: 'controller', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'state', test: 'preheat-on' } }),             // brooder setpoint >= 30 °C and burning
  D('prep-litter', -1, 'prep', 'Spread the rice husk litter', {
    spot: 'litterHeap', signs: ['sign-litter'], branch: 'brooding',
    done: { type: 'state', test: 'litter-covered' } }),         // farm.litter.cover >= 0.95
  D('prep-drinkers', -1, 'prep', 'Lower the drinker lines to chick height', {
    spot: 'drinkers.0', signs: ['sign-water'], branch: 'water',
    done: { type: 'each', id: 'water.height', key: 'line', values: [0, 1, 2, 3] } }),
  D('prep-feeders', -1, 'prep', 'Fill the feeder pans for the chicks', {
    spot: 'feederBox', signs: ['feeder-box'], branch: null,
    done: { type: 'state', test: 'pans-flooded' } }),           // every line flood on and pans full
  D('prep-silo', -1, 'prep', 'Check the feed in the silos', {
    spot: 'silo', signs: ['silo'], branch: null,
    done: { type: 'action', id: 'feed.silo' } }),
  D('prep-lights', -1, 'prep', 'Set the light program for the chicks', {
    spot: 'lightPanel', signs: ['light-panel'], branch: 'brooding',
    done: { type: 'action', id: 'light.program' } }),
  D('prep-vent', -1, 'prep', 'Set the minimum ventilation timer', {
    spot: 'signVent', signs: ['sign-vent'], branch: null,
    done: { type: 'action', id: 'vent.timer' } }),
  D('prep-flush', -1, 'prep', 'Flush the water lines', {
    window: [12, 26], spot: 'waterSupply', signs: ['sign-water'], branch: 'water', // 26 = 02:00 next day
    done: { type: 'state', test: 'lines-flushed' } }),          // every line ran clear
  D('prep-record', -1, 'eve', 'Sign the prep checklist at the office', {
    spot: 'officeDesk', signs: [], branch: null,
    done: { type: 'action', id: 'record.sign' } }),

  // ---------------- day 0: the chicks arrive ----------------
  D('d0-floor', 0, 'am', 'Measure the floor temperature before the chicks come', {
    window: [6, 8], spot: 'heater', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'count', id: 'floor.probe', n: 3, sectors: 3 } }),
  D('d0-grade', 0, 'rel', 'Grade a sample box of chicks', {
    rel: { anchor: 'truck', fromH: 0, toH: 6 }, spot: 'chickTable', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'action', id: 'grade.submit' } }),
  D('d0-place', 0, 'rel', 'Place the chicks on the litter', {
    rel: { anchor: 'truck', fromH: 0, toH: 12 }, spot: 'boxStacks', signs: ['sign-chicks', 'sign-brooder'], branch: 'brooding',
    done: { type: 'state', test: 'all-placed' } }),
  D('d0-vent', 0, 'rel', 'Take vent temperatures of the chicks', {
    rel: { anchor: 'placed', fromH: 1.5, toH: 4 }, spot: 'heater', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'count', id: 'sample.vent', n: 5, sectors: 3 } }),
  D('d1-crop', 1, 'rel', 'Check the chicks’ crops', {
    rel: { anchor: 'placed', fromH: 22, toH: 28 }, spot: 'heater', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'count', id: 'sample.crop', n: 10, sectors: 3 } }),
  D('d7-weigh', 7, 'am', 'Weigh sample birds', {
    window: [6, 18], spot: 'birdScale', signs: ['bird-scale'], branch: 'brooding',
    done: { type: 'count', id: 'sample.weigh', n: 50, sectors: 5 } }),

  // ---------------- every day, days 0-7 ----------------
  R('r-dips', WEEK, 'am', 'Enter through the foot dips', {
    spot: 'houseDoor', signs: ['sign-gate'], branch: null,
    done: { type: 'all', of: [{ type: 'event', event: EV.FOOTDIP, match: { where: 'gate' } }, { type: 'event', event: EV.HOUSE_ENTER, match: { dipped: true } }] } }),
  R('r-walk', WEEK, 'am', 'Walk the house and look at the chicks', {
    spot: 'heater', signs: ['sign-health', 'sign-brooder'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.6, listen: true } }),
  R('r-temp', WEEK, 'am', 'Check the temperature against today’s target', {
    spot: 'controller', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'event', event: EV.PANEL_OPEN, match: { id: 'controller' } } }),
  R('r-meter', WEEK, 'am', 'Read the water meter', {
    spot: 'waterSupply', signs: ['sign-water'], branch: 'water',
    done: { type: 'action', id: 'water.meter' } }),
  R('r-drinkers', WEEK, 'am', 'Check drinker flow and height', {
    spot: 'drinkers.0', signs: ['sign-water'], branch: 'water',
    done: { type: 'each', id: 'water.flowtest', key: 'line', values: [0, 1, 2, 3] } }),
  R('r-feeders', WEEK, 'am', 'Check the feeders and the silo level', {
    spot: 'feederBox', signs: ['feeder-box', 'silo'], branch: null,
    done: { type: 'all', of: [{ type: 'action', id: 'feed.meter' }, { type: 'action', id: 'feed.silo' }] } }),
  R('r-vent', WEEK, 'am', 'Set minimum ventilation for today', {
    spot: 'signVent', signs: ['sign-vent'], branch: null,
    done: { type: 'action', id: 'vent.timer' } }),
  R('r-lights', WEEK, 'am', 'Check the light program', {
    spot: 'lightPanel', signs: ['light-panel'], branch: null,
    done: { type: 'any', of: [{ type: 'action', id: 'light.program' }, { type: 'action', id: 'light.lux' }] } }),
  R('r-dead-am', WEEK, 'am', 'Pick up dead birds and count them at the bin', {
    spot: 'dead', signs: ['sign-health'], branch: null,
    done: { type: 'state', test: 'dead-cleared' } }),           // none left on the brooding floor, carried ones binned
  R('r-dips-pm', WEEK, 'pm', 'Dip your boots at the house door', {
    spot: 'houseDoor', signs: ['sign-gate'], branch: null,
    done: { type: 'event', event: EV.HOUSE_ENTER, match: { dipped: true } } }),
  R('r-walk-pm', WEEK, 'pm', 'Walk the house again', {
    spot: 'heater', signs: ['sign-health', 'sign-brooder'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.5, listen: true } }),
  R('r-temp-pm', WEEK, 'pm', 'Check the afternoon temperature', {
    spot: 'controller', signs: ['sign-brooder'], branch: 'brooding',
    done: { type: 'event', event: EV.PANEL_OPEN, match: { id: 'controller' } } }),
  R('r-litter', WEEK, 'pm', 'Check the litter', {
    spot: 'signLitter', signs: ['sign-litter'], branch: null,
    done: { type: 'count', id: 'litter.squeeze', n: 3, sectors: 2, nearDrinker: 1 } }),
  R('r-dead-pm', WEEK, 'pm', 'Pick up dead birds', {
    spot: 'dead', signs: ['sign-health'], branch: null,
    done: { type: 'state', test: 'dead-cleared' } }),
  R('r-record', WEEK, 'eve', 'Fill in the daily record at the office', {
    spot: 'officeDesk', signs: [], branch: null,
    done: { type: 'action', id: 'record.sign' } }),

  // ---------------- problems: opened by a symptom the farmer saw (PHASE2.md "Problem events") ----------------
  P('p-water-drop', 'Find why the water intake dropped', {
    problem: 'blocked-line', spot: 'drinkers.0', signs: ['sign-water'], branch: 'water',
    done: { type: 'action', id: 'water.clearBlock', match: { fixed: true } } }),
  P('p-leak', 'Fix the leaking nipple', {
    problem: 'leaking-nipple', spot: 'leak', signs: ['sign-water', 'sign-litter'], branch: 'water',
    done: { type: 'action', id: 'water.fixLeak', match: { fixed: true } } }),
  P('p-wet-patch', 'Put fresh litter on the wet patch', {
    problem: 'leaking-nipple', after: 'p-leak', spot: 'leak', signs: ['sign-litter'], branch: null,
    done: { type: 'action', id: 'litter.patch' } }),
  P('p-cold-night', 'Night check: a cold night is coming', {
    problem: 'cold-night', window: [20, 24], spot: 'controller', signs: ['sign-brooder', 'sign-vent'], branch: 'brooding',
    done: { type: 'all', of: [{ type: 'event', event: EV.PANEL_OPEN, match: { id: 'controller' } }, { type: 'coverage', frac: 0.4 }] } }),
  P('p-order-feed', 'Order feed before the silo runs out', {
    problem: 'low-silo', spot: 'officeDesk', signs: ['silo'], branch: null,
    done: { type: 'action', id: 'feed.order' } }),
  P('p-report', 'Report the abnormal deaths', {
    problem: 'abnormal-deaths', spot: 'officeDesk', signs: ['sign-health'], branch: null,
    done: { type: 'action', id: 'phone.report' } }),
];

export const jobById = (id) => JOBS.find((j) => j.id === id) || null;
