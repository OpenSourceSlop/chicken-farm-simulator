// Job definitions of the Phase 3 levels (PHASE3.md §4) — contract data, committed by the integrator.
// Owner: package "run" (titles and "where" lines may be reworded; ids, days, windows, spots, signs,
// rules and branches are the contract the other packages build against). Same JobDef shape as
// content-jobs.js, plus the Phase 3 fields of PHASE3.md §3.1:
//   onDays    routine made only on these calendar days (inside `days`)
//   rel       anchors beyond truck / placed come from the level def (`config.LEVELS[i].anchors`):
//             'sent' (plan.send), 'curtain' (house.curtain open), 'catch' (farm.harvest.catchAt);
//             fromH may be negative (before the anchor)
//   window    hours past 24 run into the next days (66 = day + 2, 18:00)
//   rules     coverage { area: 'brood'|'house'|'used', tool }, count { sectorsOf: 'brood'|'house'|'used',
//             match }, each { has }; new state tests: STATE_TEST_IDS_CYCLE below
//   spot      a SPOTS / SPOTS2 / SPOTS3 / FARM key, 'drinkers.N', or dynamic: Phase 2's 'heater',
//             'heater-out', 'dead', 'leak' and 'lame' (nearest lame bird), 'fan-broken' (the stopped
//             fan), 'bait' (the next bait station not done), 'swab' (the next swab place not done, CLEAN.swabSpots)
// The Phase 2 routines continue to day 41 (content-jobs.js); these are the jobs only Phase 3 adds.
import { EV } from './events.js';
// Phase 4 (PHASE4.md §6 items 7, 9, 10): the clarity round's rules for the feed changes, the medicine and the withdrawal
import { DONE_P4 } from './content-jobs-cond.js';

const R = (id, days, round, title, rest) => ({ id, kind: 'routine', days, round, title, ...rest });
const D = (id, day, round, title, rest) => ({ id, kind: 'dated', day, round, title, ...rest });
const P = (id, title, rest) => ({ id, kind: 'problem', title, ...rest });
const A = (id, match) => (match ? { type: 'action', id, match } : { type: 'action', id });
/** An order whose amount is enough (job-engine ACTION_CHECKS: 'order-days' the silo to 3 days, 'order-withdrawal' to the withdrawal). */
const ORDER = (type, check) => ({ type: 'action', id: 'feed.order', ...(type ? { match: { type } } : {}), check });
const ANY = (...ids) => ({ type: 'any', of: ids.map((i) => A(i)) });
const ALL = (...of) => ({ type: 'all', of });
const ST = (test) => ({ type: 'state', test });
/** The label the job card and the panel strip show for a part (content-jobs.js lab / live). */
const L = (label, rule) => ({ ...rule, label });
const LIVE = (label, test) => ({ type: 'state', test, live: true, label });
const VET_HUNCHED = 'birds sitting hunched, white watery droppings', VET_BLOOD = 'blood in the droppings'; // ui-records.js vet buttons (reason in lower case)
const GATE_DIP = { type: 'event', event: EV.FOOTDIP, match: { where: 'gate' } };
const HOUSE_DIP = { type: 'event', event: EV.HOUSE_ENTER, match: { dipped: true } };
const SIGNED = { type: 'event', event: EV.RECORD_CLOSED, match: { signed: true }, sameDay: true };
const WEIGH = { type: 'count', id: 'sample.weigh', n: 50, sectors: 5, sectorsOf: 'house' };
// the lines at the plates' heights for the birds' size (job-figures: ±3 cm of nippleHeightCmAt / feederRimCmAt, the skills' band)
const RAISE = ST('lines-raised');
const even = (a, b) => { const o = []; for (let d = a; d <= b; d += 2) o.push(d); return o; };
// the mornings of days 8-41 without the silo gauge (content-jobs.js SILO_DAYS: odd days and the order days 13, 27, 36)
const FEEDMETER_DAYS = even(8, 41).filter((d) => d !== 36);

// State predicates of Phase 3 (the run package implements them in job-engine.js; PHASE3.md §3.1).
//   heat-handled  farm.comfort.pantShare <= 0.1, or every fan that turns is on (env.fansEffective = 6 - broken) and
//                 the pad runs (or is off with house RH > HEAT.padOffAboveRH), for 30 game min: met by doing what the
//                 heat sign and the pad plate say, even while the weather still makes some birds pant
//   pad-humid-ok  (pad off, or house RH <= HEAT.padOffAboveRH) and env.fansEffective >= 5, for 30 game min
//   dark-period   the light program gives a dark block of at least 4 hours (the light sign: about 4-6 hours)
// Phase 4 (content-jobs-cond.js STATE_TEST_IDS_P4, the clarity round's DONE_P4 rules these jobs now use):
//   blend-24h { feed }  the augers drew 20-80 % new feed for at least 20 h of the change (farm.stats.blendH / blendFinH)
//   medicine-course     the medicine in the water on 3 calendar days counting the first (farm.health.medication.daysOn)
//   feed-withdrawn      the feed is off (farm.feed.withdrawn): an early withdrawal completes f-withdraw when it opens
export const STATE_TEST_IDS_CYCLE = ['house-ready', 'rh-under', 'lame-cleared', 'vaccine-drunk', 'pans-grower', 'pans-finisher',
  'caked-cleared', 'air-clear', 'heat-handled', 'pad-humid-ok', 'house-empty', 'litter-removed', 'house-washed',
  'house-disinfected', 'house-dry', 'lines-disinfected', 'rest-done', 'dark-period', 'blend-24h', 'medicine-course', 'feed-withdrawn'];
/** The Phase 3 state tests (test-jobs' case table): the list above less the Phase 4 ones the DONE_P4 rules brought in. */
export const STATE_TEST_IDS_P3 = STATE_TEST_IDS_CYCLE.slice(0, 18);
const SWABS = { type: 'each', id: 'clean.swab', key: 'spot', values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }; // config CLEAN.swabSpots

export const JOBS_CYCLE = [
  // ---------------- Level 1: Plan the farm (day -2) ----------------
  D('pl-gate-read', -2, 'plan', 'Read the farm rules at the gate', { spot: 'signGate', signs: ['sign-gate'], branch: 'biosecurity', done: A('sign.read', { board: 'sign-gate' }) }),
  D('pl-gate-dip', -2, 'plan', 'Enter through the foot dip', { spot: 'footDipGate', signs: ['sign-gate'], branch: 'biosecurity', done: GATE_DIP }),
  D('pl-clothes', -2, 'plan', 'Change into farm clothes and boots', { spot: 'guardHut', signs: ['sign-gate', 'guard-hut'], branch: 'biosecurity', done: A('bio.change') }),
  D('pl-letter', -2, 'plan', 'Read the company’s contract at the office', { spot: 'officeDesk', signs: ['sign-plan'], branch: 'planning', done: A('plan.letter') }),
  D('pl-measure', -2, 'plan', 'Measure house 1: length and width', { spot: 'houseDoor', signs: ['sign-plan'], branch: 'planning',
    done: { type: 'each', id: 'plan.measure', key: 'axis', values: ['length', 'width'] } }),
  D('pl-house-dip', -2, 'plan', 'Dip your boots at the house door', { spot: 'houseDoor', signs: ['sign-gate'], branch: 'biosecurity', done: HOUSE_DIP }),
  D('pl-sheet', -2, 'plan', 'Work out the plan on the planning sheet', { window: [7, 16], spot: 'officeDesk', signs: ['sign-plan', 'plan-sheet'], branch: 'planning', done: A('plan.send') }),
  D('pl-reply', -2, 'rel', 'Read the company’s reply', { rel: { anchor: 'sent', fromH: 1, toH: 12 }, after: 'pl-sheet', spot: 'officeDesk', signs: ['sign-plan'], branch: 'planning', done: A('plan.reply') }),
  D('pl-record', -2, 'eve', 'Sign the plan page at the office', { spot: 'officeDesk', signs: [], branch: null, done: SIGNED }),

  // ---------------- Level 3: Week 2 (days 8-14) ----------------
  D('w2-lights', 8, 'am', 'Set the light program for the growing birds', { spot: 'controller', signs: ['controller-lights', 'sign-light'], branch: 'lighting',
    done: ALL(L('Send a light program to the controller', ANY('light.program', 'light.preset')), LIVE('A dark block of 4–6 hours (light sign)', 'dark-period')) }),
  D('w2-lux', 8, 'am', 'Measure the light at bird level ({key:lux})', { spot: 'signLight', signs: ['sign-light'], branch: 'lighting',
    done: { type: 'count', id: 'light.lux', n: 3, sectors: 3, sectorsOf: 'used' } }),
  // the feed meter alone on the mornings without the silo gauge (content-jobs.js SILO_DAYS)
  R('r-feedmeter', [8, 41], 'am', 'Read the feed meter at the feeder box', { onDays: FEEDMETER_DAYS, spot: 'feederBox', signs: ['feeder-box'], branch: null, done: A('feed.meter') }),
  // every other morning, on the mornings without the flow tests (content-jobs.js FLOW_DAYS: even days)
  R('r-minvent', [8, 20], 'am', 'Step up the minimum ventilation for the birds’ weight', { onDays: [9, 11, 13, 15, 17, 19], spot: 'controller', signs: ['sign-vent'], branch: 'moisture',
    done: ALL(L('Send the timer more air than before', A('vent.timer', { result: { stepUp: true } })), LIVE('Timer air 90–130 % of what your birds need (vent sign table)', 'vent-in-band')) }),
  D('w2-ready', 9, 'pm', 'Get the rest of the house ready for the birds', { spot: 'litterHeap', signs: ['sign-curtain', 'sign-litter'], branch: 'brooding', done: ST('house-ready') }),
  D('w2-curtain', 9, 'pm', 'Lift the brooding curtain and let the birds spread', { window: [13, 66], pin: true, spot: 'curtainWinch', signs: ['sign-curtain'], branch: 'brooding',
    done: A('house.curtain', { open: true }) }),
  D('w2-spread', 9, 'rel', 'Walk the whole house and look at the spread', { rel: { anchor: 'curtain', fromH: 0.5, toH: 6 }, spot: 'curtainWinch', signs: ['sign-curtain', 'sign-health'], branch: 'brooding',
    done: { type: 'coverage', frac: 0.25, sight: 2, listen: true, area: 'house' } }),
  R('w2-check', [10, 13], 'am', 'Check ten birds in the hand: watch each one walk', { onDays: [10, 13], window: [8, 18], spot: 'birdScale', signs: ['sign-legs', 'bird-check'], branch: 'biosecurity',
    done: { type: 'count', id: 'sample.bird', match: { look: 'gait' }, n: 10, sectors: 3, sectorsOf: 'used' } }),
  D('w2-vaccine', 12, 'am', 'Vaccinate the flock in the drinking water', { window: [6, 16], pin: true, spot: 'waterSupply', signs: ['vaccine', 'water-supply'], branch: 'biosecurity', done: ST('vaccine-drunk') }),
  D('w2-order', 13, 'am', 'Order grower pellets for the feed change', { window: [6, 16], spot: 'officeDesk', signs: ['sign-feed', 'silo'], branch: 'feed', done: ORDER('grower', 'order-days') }),
  R('r-raise', [8, 34], 'pm', 'Raise the drinker and feeder lines for the birds’ size', { onDays: [8, 11, 14, 17, 20, 24, 28, 32], spot: 'drinkers.0', signs: ['drinker', 'feeder-box'], branch: 'water', done: RAISE }),
  D('w2-weigh', 14, 'am', 'Weigh sample birds', { window: [8, 18], pin: true, spot: 'birdScale', signs: ['bird-scale'], branch: 'growth', done: WEIGH }),
  P('p-damp', 'The air in the house feels damp', { problem: 'rainy-spell', spot: 'controller', signs: ['sign-vent', 'sign-air'], branch: 'moisture',
    done: ALL(L('More air: the timer or the tunnel fans', ANY('vent.timer', 'vent.fans')), L('Humidity in at or under 75 % for 60 farm minutes', ST('rh-under'))) }),
  P('p-lame', 'Birds that cannot walk well', { problem: 'lame-birds', spot: 'lame', signs: ['sign-legs'], branch: 'biosecurity', done: ST('lame-cleared') }),
  P('p-sds', 'Big birds found dead on their backs', { problem: 'sudden-deaths', spot: 'controller', signs: ['sign-light', 'controller-lights'], branch: 'lighting', done: ALL(L('Read the controller', A('controller.read')), LIVE('A dark block of 4–6 hours (light sign)', 'dark-period')) }),

  // ---------------- Level 4: Week 3 (days 15-21) ----------------
  // Phase 4 (§6.9): the half-and-half day is part of the rule (DONE_P4: blend-24h, then the pans 90 % grower)
  D('w3-change', 15, 'am', 'Change the feed lines to grower pellets', { window: [6, 42], pin: true, spot: 'silo', signs: ['sign-feed', 'silo', 'feeder-box'], branch: 'feed', done: DONE_P4['w3-change'] }),
  R('w3-droppings', [16, 19], 'am', 'Check the droppings on five birds', { onDays: [16, 19], window: [8, 18], spot: 'birdScale', signs: ['sign-droppings', 'bird-check'], branch: 'feed',
    done: { type: 'count', id: 'sample.bird', match: { look: 'droppings' }, n: 5, sectors: 3, sectorsOf: 'house' } }),
  D('w3-topup', 18, 'am', 'Fork over caked litter and top it up under the drinker lines', { window: [8, 18], spot: 'litterHeap', signs: ['sign-litter', 'sign-droppings'], branch: 'moisture',
    done: ALL(L('Fork over the caked patches (caked litter 2 % or less of the floor in use)', ST('caked-cleared')),
      L('Four sacks of fresh husk under the drinker lines, in two parts of the house', { type: 'count', id: 'litter.patch', n: 4, nearDrinker: 4, sectors: 2, sectorsOf: 'house' })) }),
  D('w3-weigh', 21, 'am', 'Weigh sample birds', { window: [8, 18], pin: true, spot: 'birdScale', signs: ['bird-scale'], branch: 'growth', done: WEIGH }),
  P('p-pad-wet', 'Wet litter at the pad end: find what wets it', { problem: 'pad-overflow', spot: 'padPump', signs: ['pad-pump', 'sign-litter'], branch: 'moisture',
    done: A('pad.fixFloat', { result: { fixed: true } }) }),
  P('p-pad-patch', 'Put fresh litter on the wet strip', { problem: 'pad-overflow', after: 'p-pad-wet', spot: 'litterHeap', signs: ['sign-litter'], branch: 'moisture',
    done: A('litter.patch', { result: { onPad: true } }) }),
  // Phase 4 (§6.10): the vet's course of 3 days is part of the rule (DONE_P4: medicine-course)
  P('p-blood', 'Blood in the droppings', { problem: 'coccidiosis', spot: 'officeDesk', signs: ['sign-droppings', 'medicator'], branch: 'biosecurity', done: DONE_P4['p-blood'] }),
  P('p-heat3', 'Birds panting in the afternoon', { problem: 'warm-afternoon3', spot: 'fanPanel', signs: ['sign-heat', 'fan-panel'], branch: 'ventilation',
    done: ALL(L('Switch the fans or the pad', ANY('vent.fans', 'vent.pad')), L('Few birds panting and none chilled for 30 farm minutes', ST('heat-handled'))) }),
  P('p-hunched', 'Birds sitting hunched with white watery droppings', { problem: 'gumboro', spot: 'officeDesk', signs: ['sign-droppings', 'sign-health'], branch: 'biosecurity',
    done: A('phone.vet', { reason: VET_HUNCHED }) }),

  // ---------------- Level 5: Weeks 4 and 5 (days 22-35) ----------------
  D('w45-brooders', 22, 'am', 'Turn the brooders off and winch them up', { window: [6, 18], spot: 'heater', signs: ['sign-brooder', 'sign-heat'], branch: 'heating', done: A('heat.brooders', { up: true }) }),
  R('r-fans-pm', [15, 41], 'pm', 'Check the fans and the house in the afternoon heat', { spot: 'fanPanel', signs: ['sign-heat', 'fan-panel'], branch: 'ventilation',
    done: A('fans.read') }),   // the walk is r-walk-pm's (PHASE3.md §3.3)
  // at the controller by the door (its tunnel fan keys) or at the fan panel
  R('r-vent-night', [15, 41], 'night', 'Set the ventilation for the night', { spot: 'controller', signs: ['sign-heat', 'sign-vent'], branch: 'moisture',
    done: ALL(L('Read or set the fans (controller or fan panel)', ANY('fans.read', 'controller.read', 'vent.fans', 'vent.timer')),
      L('A quarter of the birds panting at most and none chilled for 30 farm minutes after 18:00 (from day 28, while the outside air is over about 30 °C: every fan and the pad)', ST('night-comfort'))) }),
  D('w45-air', 23, 'am', 'Measure the air speed at bird height ({key:air})', { window: [8, 18], spot: 'fanPanel', signs: ['sign-heat'], branch: 'ventilation',
    done: { type: 'count', id: 'air.probe', n: 3, sectors: 3, sectorsOf: 'house' } }),
  D('w45-pad', 24, 'am', 'Check the cooling pad: water on every section', { window: [8, 18], spot: 'padPump', signs: ['pad-pump'], branch: 'ventilation', done: A('pad.check', { result: { flowing: true } }) }),
  D('w45-order', 27, 'am', 'Order finisher pellets', { window: [6, 16], spot: 'officeDesk', signs: ['sign-feed'], branch: 'feed', done: ORDER('finisher', 'order-days') }),
  D('w45-weigh28', 28, 'am', 'Weigh sample birds', { window: [8, 18], pin: true, spot: 'birdScale', signs: ['bird-scale'], branch: 'growth', done: WEIGH }),
  D('w45-change', 29, 'am', 'Change the feed lines to finisher pellets', { window: [6, 42], spot: 'silo', signs: ['sign-feed', 'silo'], branch: 'feed', done: DONE_P4['w45-change'] }),
  D('w45-weigh35', 35, 'am', 'Weigh sample birds', { window: [8, 18], pin: true, spot: 'birdScale', signs: ['bird-scale'], branch: 'growth', done: WEIGH }),
  P('p-dust', 'Dusty air and birds breathing with a rattle', { problem: 'dusty-air', spot: 'fanPanel', signs: ['sign-air'], branch: 'moisture',
    done: ALL(L('More air: the timer or the tunnel fans', ANY('vent.timer', 'vent.fans')), L('Breathing quiet and the air fresh for 120 farm minutes', ST('air-clear'))) }),
  P('p-panting', 'Birds panting in the afternoon heat', { problem: 'hot-afternoon', spot: 'fanPanel', signs: ['sign-heat', 'fan-panel'], branch: 'ventilation',
    done: ALL(L('Switch the fans, the pad or the stages', ANY('vent.fans', 'vent.pad', 'vent.stages')), L('Few birds panting and none chilled for 30 farm minutes', ST('heat-handled'))) }),
  P('p-fan', 'Fan 4 is not turning', { problem: 'fan-belt', spot: 'fan-broken', signs: ['fan-panel'], branch: 'ventilation', done: A('fan.fix', { result: { fixed: true } }) }),
  P('p-pad-dry', 'Part of the cooling pad is dry', { problem: 'pad-clog', spot: 'padPump', signs: ['pad-pump'], branch: 'ventilation', done: A('pad.flush', { result: { fixed: true } }) }),
  P('p-heatwave', 'A heat wave is coming: get the house ready', { problem: 'heat-wave', spot: 'fanPanel', signs: ['sign-heat', 'pad-pump', 'sign-feed'], branch: 'ventilation',
    // (this check round: the fan panel's own read, not Ventilation 2's at the controller: { at: undefined } matches only a
    // fans.read without an `at`, events.js matchPayload)
    done: ALL(L('Fans: read the fan panel', A('fans.read', { at: undefined })), L('Pad: check it with the pump on', A('pad.check', { result: { flowing: true } })), L('Water: a flow test on a line', A('water.flowtest'))) }),
  P('p-humid', 'Hot and humid in the house', { problem: 'humid-heat', spot: 'padPump', signs: ['pad-pump'], branch: 'ventilation',
    done: ALL(L('Switch the pad or the fans', ANY('vent.pad', 'vent.fans')), L('Pad off above 90 % humidity, every fan on, for 30 farm minutes', ST('pad-humid-ok'))) }),

  // ---------------- Level 6: Finishing and harvest (days 36-42) ----------------
  D('f-order', 36, 'am', 'Order the last feed for the flock', { window: [6, 16], spot: 'officeDesk', signs: ['sign-feed', 'silo'], branch: 'planning', done: ORDER(null, 'order-withdrawal') }),
  // to day 39 06:00: the latest catch the crew takes (day 42 06:00) is then still 3 days ahead (sign-catch)
  D('f-book', 37, 'am', 'Book the catching crew and the trucks', { window: [6, 54], spot: 'officeDesk', signs: ['sign-catch'], branch: 'planning', done: A('phone.bookCatch', { result: { booked: true } }) }),
  D('f-weigh', 40, 'am', 'Weigh sample birds before catching', { window: [8, 18], pin: true, spot: 'birdScale', signs: ['bird-scale'], branch: 'growth', done: WEIGH }),
  // pans empty 8–12 h before the catch, the lines stopped about an hour before that (feed and catch signs): 13–9 h before
  // Phase 4 (§6.7): done on the outcome, the feed off (an early withdrawal completes it when the window opens)
  D('f-withdraw', 41, 'rel', 'Take the feed away before catching', { rel: { anchor: 'catch', fromH: -13, toH: -9 }, spot: 'feederBox', signs: ['sign-feed', 'sign-catch'], branch: 'feed',
    done: DONE_P4['f-withdraw'] }),
  D('f-ready', 41, 'rel', 'Get the house ready for the catching crew', { rel: { anchor: 'catch', fromH: -3, toH: 0.5 }, spot: 'controller', signs: ['sign-catch', 'sign-light'], branch: 'comfort',
    done: ALL(L('Put up the catching panels by the door', A('catch.panels')), LIVE('Lights dimmed to about 10 lux, at least three tunnel fans running (catch sign)', 'catch-ready')) }),
  D('f-lines', 42, 'rel', 'Lift the drinker lines as the catching starts', { rel: { anchor: 'catch', fromH: -1, toH: 1 }, spot: 'drinkers.0', signs: ['sign-catch'], branch: 'water',
    done: ST('lines-up') }),
  D('f-catch', 42, 'rel', 'Catch and load the birds with the crew', { rel: { anchor: 'catch', fromH: 0, toH: 6 }, pin: true, spot: 'loadingBay', signs: ['sign-catch'], branch: 'comfort', done: ST('house-empty') }),
  D('f-tickets', 42, 'rel', 'Read the weight tickets at the loading bay', { rel: { anchor: 'catch', fromH: 0.5, toH: 8 }, spot: 'loadingBay', signs: ['sign-catch', 'loading-bay'], branch: 'growth',
    done: { type: 'each', id: 'load.ticket', key: 'truck', values: [0, 1] } }),
  P('p-panting-fin', 'Birds panting in the afternoon heat', { problem: 'hot-finish', spot: 'fanPanel', signs: ['sign-heat', 'fan-panel'], branch: 'ventilation',
    done: ALL(L('Switch the fans, the pad or the stages', ANY('vent.fans', 'vent.pad', 'vent.stages')), L('Few birds panting and none chilled for 30 farm minutes', ST('heat-handled'))) }),

  // ---------------- Level 7: Clean-out and rest (days 43 → the booked chick day) ----------------
  D('c-raise', 43, 'am', 'Winch all the lines and brooders up', { spot: 'drinkers.0', signs: ['sign-clean'], branch: 'biosecurity', done: ST('all-up') }),
  D('c-litter', 43, 'clean', 'Take the old litter out of the house', { spot: 'litterHeap', signs: ['sign-clean'], branch: 'biosecurity', done: ST('litter-removed') }),
  D('c-brush', 43, 'clean', 'Brush the dust off the lines, fans, pad, brooders and inlets', { spot: 'brush', signs: ['sign-clean'], branch: 'biosecurity',
    done: { type: 'each', id: 'clean.brush', key: 'part', values: ['lines', 'fans', 'pad', 'brooders', 'inlets'] } }),
  D('c-wash', 44, 'clean', 'Wash the house with the pressure washer', { pin: true, spot: 'washBay', signs: ['sign-clean', 'wash-bay'], branch: 'biosecurity', done: ST('house-washed') }),
  D('c-lines', 44, 'clean', 'Clean the drinker lines with disinfectant', { spot: 'waterSupply', signs: ['sign-clean', 'water-supply'], branch: 'water',
    done: ALL(L('Disinfectant in the header tank', A('water.disinfect', { on: true })), L('Every line flushed with it', ST('lines-disinfected'))) }),
  D('c-pans', 44, 'clean', 'Wash the feeder pans', { spot: 'feederBox', signs: ['sign-clean'], branch: 'feed', done: { type: 'each', id: 'feed.wash', key: 'line', values: [0, 1, 2] } }),
  D('c-dry', 44, 'clean', 'Let the house dry with the fans', { window: [13, 42], spot: 'controller', signs: ['sign-clean'], branch: 'moisture', done: ST('house-dry') }),
  D('c-spray', 45, 'clean', 'Disinfect the house', { spot: 'washBay', signs: ['sign-clean', 'wash-bay'], branch: 'biosecurity', done: ST('house-disinfected') }),
  D('c-washbay', 45, 'clean', 'Wash and disinfect the tools at the wash bay', { spot: 'washBay', signs: ['sign-clean', 'wash-bay'], branch: 'biosecurity',
    done: { type: 'each', id: 'clean.washbay', key: 'item', values: ['boots', 'buckets', 'barrow', 'washer'] } }),
  D('c-bait', 45, 'clean', 'Set rodent bait round the house', { spot: 'bait', signs: ['sign-clean'], branch: 'biosecurity', done: { type: 'count', id: 'clean.bait', n: 4 } }),
  D('c-swabs', 46, 'am', 'Take swabs from the clean house', { window: [6, 18], spot: 'swab', signs: ['sign-clean', 'wash-bay'], branch: 'biosecurity', done: SWABS }),
  D('c-close', 46, 'eve', 'Close the house for the rest', { window: [6, 24], spot: 'houseDoor', signs: ['sign-clean'], branch: 'biosecurity', done: A('house.close') }),
  D('c-lab', 48, 'eve', 'Read the lab result', { window: [6, 24], spot: 'officeDesk', signs: ['sign-clean'], branch: 'biosecurity', done: A('swab.read') }),
  D('c-book', 48, 'eve', 'Book the next chicks', { window: [6, 456], spot: 'officeDesk', signs: ['sign-clean', 'sign-plan'], branch: 'planning', done: A('phone.bookChicks', { result: { booked: true } }) }),
  D('c-rest', 48, 'eve', 'Rest the house', { window: [6, 528], after: 'c-book', spot: 'houseDoor', signs: ['sign-clean'], branch: null, done: ST('rest-done') }),
  P('p-rewash', 'Swabs grew bacteria: wash and disinfect again', { problem: 'swab-positive', spot: 'washBay', signs: ['sign-clean'], branch: 'biosecurity',
    done: ALL(L('Wash the whole house again', ST('house-washed')), L('Disinfect it again', ST('house-disinfected'))) }),
  P('p-reswab', 'Take new swabs', { problem: 'swab-positive', after: 'p-rewash', spot: 'swab', signs: ['sign-clean'], branch: 'biosecurity', done: SWABS }),
];

export const jobByIdCycle = (id) => JOBS_CYCLE.find((j) => j.id === id) || null;

// One line of "where" for the open job (the place and the check, never the value).
export const JOB_WHERE_CYCLE = {
  'pl-gate-read': 'Farm gate sign, beside the foot dip: read the farm rules.',
  'pl-gate-dip': 'Walk through the foot dip across the gateway.',
  'pl-clothes': 'Guard hut inside the gate: farm clothes and boots.',
  'pl-letter': 'Office desk on the porch: the company’s letter in the record book.',
  'pl-measure': 'Take the tape measure from the office desk; inside house 1 hook it at one end wall and read it at the other, then side wall to side wall.',
  'pl-house-dip': 'Foot dip at the house door.',
  'pl-sheet': 'Office desk: the planning sheet. The planning sign hangs on the porch beside it.',
  'pl-reply': 'Office desk: the company’s reply in the record book.',
  'pl-record': 'Office desk: the plan page of the record book.',
  'w2-lights': 'Climate controller: the Lights section. The light program sign hangs east of the vent sign.',
  'w2-lux': 'Brooding floor: press {key:lux} at bird height in three different parts of the floor (the marker shows a part not measured yet).',
  'r-minvent': 'Climate controller: the Ventilation section; the minimum ventilation sign has the table by weight.',
  'r-feedmeter': 'Feeder control box on the north wall: the feed meter.',
  'w2-ready': 'Rice husk heap: the barrow over the floor east of the brooding curtain.',
  'w2-curtain': 'The winch on the north wall at the brooding curtain.',
  'w2-spread': 'Walk the whole length of the house; stand still a moment to look and listen.',
  'w2-check': 'Among the birds: {key:use} picks one up. Ten birds from three parts of the floor: watch each one walk (the feathers and feet looks are there too).',
  'w2-vaccine': 'Water supply, south-west corner: shut the main valve (1–2 farm hours of thirst), mix the vaccine (Vaccine tab), open the valve, then walk the birds up to drink (about 2 farm hours).',
  'w2-order': 'Office desk: the phone. The feed program sign hangs by the silos.',
  'r-raise': 'Regulator at the west end of each drinker line (winch each one to the plate), then the feeder control box (the pan heights).',
  'w2-weigh': 'Bird scale: take the scale and frame, set the frame down in five parts of the house.',
  'p-damp': 'Climate controller: humidity and the Ventilation section; squeeze the litter by the walls.',
  'p-lame': 'Lame birds sit apart: {key:use} picks one up; cull the ones that cannot reach feed and water.',
  'p-sds': 'Climate controller: the Lights section (a dark period every night). The light program sign hangs east of the vent sign.',
  'w3-change': 'Feed silos outside: the two slide valves, half from each; the pans change over about 24 farm hours as the birds eat.',
  'w3-droppings': 'Among the birds: {key:use} picks one up and look at the vent and the droppings. Five birds from three parts of the house.',
  'w3-topup': 'Rice husk heap: the fork for caked patches and sacks of husk for under the drinker lines.',
  'w3-weigh': 'Bird scale: take the scale and frame, set the frame down in five parts of the house.',
  'p-pad-wet': 'Cooling pad pump outside the west end: look at the float valve and the sump.',
  'p-pad-patch': 'Rice husk heap: a sack of husk for the wet strip at the pad end.',
  'p-blood': 'Office desk: the phone to the company vet; then the Medicine tab at the water supply.',
  'p-heat3': 'Fan panel at the east end: more tunnel fans for the afternoon; walk the house and look at the birds again.',
  'p-hunched': 'Office desk: the phone to the company vet.',
  'w45-brooders': 'Climate controller: the Temperature section.',
  'r-fans-pm': 'Fan panel at the east end, north wall: keep it open a moment to read it.',
  'r-vent-night': 'Climate controller by the door (its tunnel fan keys) or the fan panel, between 18:00 and 22:00: the fans for the night.',
  'w45-air': 'Press {key:air} at bird height in three parts of the house.',
  'w45-pad': 'Cooling pad pump outside the west end.',
  'w45-order': 'Office desk: the phone.',
  'w45-weigh28': 'Bird scale: take the scale and frame, set the frame down in five parts of the house.',
  'w45-change': 'Feed silos outside: the two slide valves; the pans change over about 24 farm hours as the birds eat.',
  'w45-weigh35': 'Bird scale: take the scale and frame, set the frame down in five parts of the house.',
  'p-dust': 'Fan panel and the climate controller; the air quality sign hangs on the north wall.',
  'p-panting': 'Fan panel at the east end: the tunnel fans and the pad pump.',
  'p-fan': 'The fan that stands still in the east end wall: E at it.',
  'p-pad-dry': 'Cooling pad pump outside the west end.',
  'p-heatwave': 'Fan panel at the east end (read it), the cooling pad pump outside the west end (pump on, check the pad), then a flow test at a drinker line.',
  'p-humid': 'Cooling pad pump and the fan panel.',
  'f-order': 'Office desk: the phone.',
  'f-book': 'Office desk: the phone.',
  'f-weigh': 'Bird scale: take the scale and frame, set the frame down in five parts of the house.',
  'f-withdraw': 'Feeder control box, north wall.',
  'f-ready': 'The catching panels inside by the door ({key:use} puts them up), then the climate controller: Lights dimmed to 20 % or less, at least three tunnel fans.',
  'f-lines': 'Regulator at the west end of each of the four drinker lines: winch each one up to 55 cm or more, then walk on to the next regulator.',
  'f-catch': 'Loading bay by the door path; keep the fans running for the birds still inside.',
  'f-tickets': 'Loading bay: each truck’s weight ticket.',
  'p-panting-fin': 'Fan panel at the east end: the tunnel fans and the pad pump.',
  'c-raise': 'Regulator at the west end of each drinker line, the feeder control box (pans up), then the climate controller (Temperature: brooders off and up).',
  'c-litter': 'Rice husk heap: take the scraper and push it over the whole floor.',
  'c-brush': 'Inside: the lines, the fans, the pad, the brooders and the side inlets; the marker points to the nearest part not brushed yet.',
  'c-wash': 'Wash bay west of the house: take the pressure washer and wash the whole house.',
  'c-lines': 'Water supply: disinfectant in the header tank (Clean-out tab), then flush each line (farm time with each valve open).',
  'c-pans': 'Feeder control box: wash each line’s pans (4 farm minutes a line).',
  'c-dry': 'Climate controller by the door (its tunnel fan keys) or the fan panel: fans on until the floor is dry.',
  'c-spray': 'Wash bay: take the sprayer and disinfect the whole house.',
  'c-washbay': 'Wash bay: boots, buckets, the barrow and the washer (3 farm minutes each).',
  'c-bait': 'Bait stations at the four corners of the house.',
  'c-swabs': 'Wash bay: take the swab kit; the lab’s ten places are marked with small flags: E at each one.',
  'c-close': 'House door: close the house.',
  'c-lab': 'Office desk: the lab letter in the record book.',
  'c-book': 'Office desk: the phone to the hatchery.',
  'c-rest': 'The house rests until the chicks you booked.',
  'p-rewash': 'Wash bay: the washer, then the sprayer, over the whole house again.',
  'p-reswab': 'Wash bay: the swab kit; E at each of the ten flagged places again.',
};
