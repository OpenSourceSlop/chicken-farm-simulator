// Job definitions of the Phase 4 conditions and the clarity round's new rules (PHASE4.md §4, §5, §6) — contract
// data committed by the Phase 4 design. Owner: package "run" (titles and "where" lines may be reworded; ids,
// days, windows, spots, signs, rules and branches are the contract the other packages build against). Same
// JobDef shape as content-jobs-cycle.js, plus:
//   condition  the job is made only in a run of that condition (config CONDITIONS key)
//   problem    as Phase 3: opened by EV.FARM_PROBLEM symptom of a problem of the level as the condition plays it
//              (config conditionLevel(def, condition).problems)
// The run package wires JOBS_COND into the engine's allJobs() (filtered by the run's condition) and implements
// the new state tests (STATE_TEST_IDS_P4) in job-engine.js; the sim package gives the farm state they read.
import { EV } from './events.js';

const R = (id, days, round, title, rest) => ({ id, kind: 'routine', days, round, title, ...rest });
const D = (id, day, round, title, rest) => ({ id, kind: 'dated', day, round, title, ...rest });
const P = (id, title, rest) => ({ id, kind: 'problem', title, ...rest });
const A = (id, match) => (match ? { type: 'action', id, match } : { type: 'action', id });
const ANY = (...ids) => ({ type: 'any', of: ids.map((i) => A(i)) });
const ALL = (...of) => ({ type: 'all', of });
const ST = (test, extra) => ({ type: 'state', test, ...(extra || {}) });
const L = (label, rule) => ({ ...rule, label });
const LIVE = (label, test, extra) => ({ type: 'state', test, live: true, label, ...(extra || {}) });
void EV;

/**
 * New state tests (the run package implements them in job-engine.js, reading the farm state of PHASE4.md §10.4):
 *   power-on         farm.power.on (the house has power: the mains, or the generator on the transfer switch)
 *   brood-warmer     the thermostat 0.5–1.5 °C over the brooder sign's row of the day (a bad batch, days 0–3)
 *   line-flow-ok     the line `line`'s last flow test (farm.water.lines[line].lastFlow) within ±3 ml/min of age + 20
 *   rh-under         Phase 3's test with a `max` (default 75): house RH at or under max for 60 game min
 *   blend-24h        the augers drew half from each silo (20–80 % new) for at least 20 h of this change
 *                    (farm.stats.blendH for grower, blendFinH for finisher: `feed` 'grower' | 'finisher')
 *   medicine-course  the medicine in the water on 3 calendar days, counting the day it started
 *                    (farm.health.medication.daysOn >= 3; the vet's course)
 *   feed-withdrawn   farm.feed.withdrawn (the feed is off: f-withdraw done also when the farmer took it early)
 *   night-comfort    (re-defined, PHASE4.md §2.4) for 30 game min after 18:00: panting share <= HEAT_P4.nightPantMax and the mean
 *                    felt comfort >= -1.5 °C, or every working fan on with the pad on while the outside air is
 *                    >= config HEAT_P4.padEveningAboveC from HEAT_P4.padEveningFromAge (or the house RH over 90 %)
 */
export const STATE_TEST_IDS_P4 = ['power-on', 'brood-warmer', 'line-flow-ok', 'rh-under', 'blend-24h', 'medicine-course', 'feed-withdrawn', 'night-comfort'];

export const JOBS_COND = [
  // ---------------- the hot season ----------------
  R('h-brood-air', [1, 7], 'pm', 'Keep the chicks’ afternoon heat down', { condition: 'hot', spot: 'controller', signs: ['sign-brooder', 'sign-vent'], branch: 'comfort',
    done: ALL(L('More air: the timer, then one or two tunnel fans', ANY('vent.timer', 'vent.fans')), L('The chicks feel near their target for 30 farm minutes', ST('house-near-target'))) }),
  R('h-flush', [22, 41], 'pm', 'Flush the warm water out of the drinker lines', { condition: 'hot', window: [12, 15], spot: 'waterSupply', signs: ['drinker', 'water-supply'], branch: 'water',
    done: { type: 'each', id: 'water.flush', key: 'line', values: [0, 1, 2, 3], match: { on: true } } }),

  // ---------------- the rainy season ----------------
  R('rn-gen-test', [8, 41], 'am', 'Test-run the generator', { condition: 'rainy', onDays: [8, 15, 22, 29, 36], spot: 'generator', signs: ['generator', 'sign-power'], branch: 'ventilation',
    done: A('gen.test', { result: { ok: true } }) }),
  P('p-power', 'The power is off: start the generator', { condition: 'rainy', problem: 'power-cut', pin: true, spot: 'generator', signs: ['generator', 'sign-power'], branch: 'ventilation',
    done: ALL(L('Start the generator', A('gen.start', { result: { running: true } })), L('Switch the house to the generator', A('gen.switch', { to: 'generator' })),
      LIVE('The fans and the pad running again', 'power-on')) }),
  P('p-power-back', 'The mains is back: switch over and stop the generator', { condition: 'rainy', problem: 'mains-back', spot: 'generator', signs: ['generator', 'sign-power'], branch: 'ventilation',
    done: ALL(L('Switch the house back to the mains', A('gen.switch', { to: 'mains' })), L('Stop the generator', A('gen.stop'))) }),
  P('p-rain-in', 'Wet litter along the south wall after the storm: find what wets it', { condition: 'rainy', problem: 'rain-in', spot: 'controller', signs: ['sign-litter', 'sign-vent'], branch: 'moisture',
    done: A('inlets.storm', { closed: true }) }),
  P('p-rain-patch', 'Put fresh litter on the wet strip by the south wall', { condition: 'rainy', problem: 'rain-in', after: 'p-rain-in', spot: 'litterHeap', signs: ['sign-litter'], branch: 'moisture',
    done: { type: 'count', id: 'litter.patch', n: 3, match: { result: { onRain: true } } } }),
  P('p-damp2', 'The air in the house feels damp again', { condition: 'rainy', problem: 'damp-spell', spot: 'controller', signs: ['sign-vent', 'sign-air'], branch: 'moisture',
    done: ALL(L('More air: the timer or the tunnel fans', ANY('vent.timer', 'vent.fans')), L('Humidity in at or under 85 % for 60 farm minutes', ST('rh-under', { max: 85 }))) }),

  // ---------------- a bad batch of chicks ----------------
  D('b-trays', -1, 'prep', 'Put feed trays and chick paper by the brooders', { condition: 'badChicks', spot: 'feederBox', signs: ['sign-chicks', 'feeder-box'], branch: 'brooding',
    done: A('brood.trays', { on: true }) }),
  P('p-weak-batch', 'Many weak chicks in the boxes', { condition: 'badChicks', problem: 'weak-batch', pin: true, spot: 'chickTable', signs: ['sign-chicks', 'chick-grading'], branch: 'brooding',
    done: ALL(L('Grade four stacks or more at the chick table and cull the weak ones', { type: 'count', id: 'chicks.grade', n: 4 }),
      L('Tell the hatchery (office phone)', A('phone.hatchery'))) }),
  D('b-warm', 0, 'am', 'Brood the small chicks 1 °C warmer', { condition: 'badChicks', window: [6, 72], spot: 'controller', signs: ['sign-brooder', 'sign-chicks'], branch: 'heating',
    done: LIVE('Thermostat 0.5–1.5 °C over the brooder sign’s row of the day', 'brood-warmer') }),
  D('b-crop48', 2, 'am', 'Check the crops again at 48 hours', { condition: 'badChicks', window: [8, 12], spot: 'birdScale', signs: ['sign-chicks'], branch: 'brooding',
    done: { type: 'count', id: 'sample.crop', n: 10, sectors: 3 } }),

  // ---------------- a water problem ----------------
  D('w-test', 1, 'am', 'Test the well water', { condition: 'water', window: [8, 18], spot: 'waterSupply', signs: ['water-supply'], branch: 'water', done: A('water.test') }),
  R('w-tank', [22, 41], 'am', 'Read the water tank gauge', { condition: 'water', spot: 'waterTank', signs: ['water-tank'], branch: 'water', done: A('water.tank') }),
  P('p-filter-again', 'Low water flow again: find the cause', { condition: 'water', problem: 'iron-filter', spot: 'waterSupply', signs: ['water-supply', 'sign-water'], branch: 'water',
    done: A('water.clearFilter', { result: { fixed: true } }) }),
  P('p-nipples', 'One drinker line gives little water', { condition: 'water', problem: 'iron-nipples', spot: 'drinkers.3', signs: ['drinker', 'water-supply'], branch: 'water',
    done: ALL(L('Flush line 4', A('water.flush', { line: 3, on: true })), LIVE('A flow test on line 4 within 3 ml/min of age + 20', 'line-flow-ok', { line: 3 })) }),
  P('p-pump', 'The water tank runs low in the afternoon', { condition: 'water', problem: 'pump-wear', pin: true, spot: 'waterTank', signs: ['water-tank', 'water-supply'], branch: 'water',
    done: A('pump.fix', { result: { fixed: true } }) }),
];

/** Where each condition job is done (job card, "Where"). */
export const JOB_WHERE_COND = {
  'h-brood-air': 'Climate controller by the door: the vent timer, then the tunnel fan keys.',
  'h-flush': 'Water meter and flush valves, inside the west end: each line’s flush valve for two minutes.',
  'rn-gen-test': 'Generator, west of the house, beside the farm road.',
  'p-power': 'Generator, west of the house: start it, then the transfer switch.',
  'p-power-back': 'Generator: the transfer switch back to the mains, then stop it.',
  'p-rain-in': 'Climate controller by the door, Ventilation: the storm flaps on the south inlets.',
  'p-rain-patch': 'Rice husk heap outside the door: a sack on each wet patch by the south wall.',
  'p-damp2': 'Climate controller by the door: the vent timer or the tunnel fans.',
  'b-trays': 'Feeder control box, north wall: feed trays and chick paper by the brooders.',
  'p-weak-batch': 'Chick sample table outside the door: grade the stacks; then the office phone.',
  'b-warm': 'Climate controller by the door, Temperature: the thermostat.',
  'b-crop48': 'Any chicks on the floor: feel the crops.',
  'w-test': 'Water meter and flush valves: the water test kit.',
  'w-tank': 'Water tank tower, north-west of the house: the gauge and the well pump.',
  'p-filter-again': 'Water meter and flush valves: the filter gauges.',
  'p-nipples': 'Drinker line 4 regulator, inside the west end; then the flow test.',
  'p-pump': 'Water tank tower, north-west of the house: the well pump.',
};

/**
 * Phase 4 rule changes of Phase 2 / 3 jobs (the clarity round, PHASE4.md §6; the run package edits
 * content-jobs*.js to these and keeps test-jobs.mjs passing). Contract: job id -> the new `done`.
 */
export const DONE_P4 = {
  'w3-change': ALL(L('Half from each silo for a day (feed sign)', ST('blend-24h', { feed: 'grower' })), L('The pans 90 % grower pellets', ST('pans-grower'))),
  'w45-change': ALL(L('Half from each silo for a day (feed sign)', ST('blend-24h', { feed: 'finisher' })), L('The pans 90 % finisher pellets', ST('pans-finisher'))),
  'p-blood': ALL(L('Call the vet: blood in the droppings', A('phone.vet', { reason: 'blood in the droppings' })), L('Start the medicine (water supply, Medicine tab)', A('water.medicate', { on: true })),
    L('The medicine in the water on 3 days (the vet’s course)', ST('medicine-course'))),
  'f-withdraw': L('The feed taken away (feeder box)', ST('feed-withdrawn')),
};
