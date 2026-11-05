// Job variants: a job as the farmer's payoffs make it (SKILLS.md §3, §4.3, §12.6). Pure logic. Owner: package "jobs".
// STUB of the design round (revised after the review): jobVariant returns the job as it is; the shapes below are the
// contract the engine, the job card, the strips and the milestones build on. No variant changes a job's sample size (the
// boards' 5 vent chicks, 10 crops, 50 birds hold) and no variant touches a problem job's rule.
//
//   jobVariant(jd, perks, ctx?) -> jd'   the job definition as the payoffs give it now, made when an instance is made
//                                        (job-engine.js createJobEngine({ variant }) calls it in make() and in restore):
//     - a job the equipment takes a part of (perks.handled(jd.id): [{ system, part, label, reading, glanceAt }], from config
//       AUTO_SYSTEMS[system].jobs = { jobId: part }):
//         part 'whole': done = { type: 'any', handled: system, label, of: [GLANCE(system), jd.done] }
//         part '<state test>' (r-raise: 'drinkers-raised' for the winch, 'pans-raised' for the feed): r-raise's
//           lines-raised splits into all[ drinkers-raised, pans-raised ] and only that part becomes any[ GLANCE, part ];
//           the other part stays the farmer's (a system off, a fault open: its manual part as before)
//       GLANCE(system) = { type: 'all', of: [{ type: 'state', test: 'auto-ok', system, part, live: true, label:
//         AUTO_SYSTEMS[system].keeps }, { type: 'action', id: 'auto.glance', match: { system }, label: 'Look at <reading> (<place>)' }] }
//       r-drinkers and r-feeders are never handed over (their flow tests and readings stay the farmer's; the controllers
//       only keep their live tests true)
//     - a job a level 2 payoff moves or shortens (no new rule, a new way to meet it):
//         waterAllLines  r-drinkers' `each` part also takes water.columns: a line whose sight tube read in band (the
//                        farm's water.lines[i].lastColumn { inBand, at } today) counts as flow-tested; places: the water
//                        supply first, then only the regulators of lines that read off
//         siloOrder      the order jobs' places: the silo gauge as well as the office phone
//         pocketPhone    the phone jobs' places: none (the card's Next line reads 'press {key:phone}')
//         phoneRecord    r-record's places: none (Sign today's record on the phone)
//         tallyBucket    r-dead-am / r-dead-pm: title 'Pick up dead birds (the tally counts them) and empty the bucket at
//                        the bin'; the rule as before (dead-cleared: the bucket emptied at the bin)
//         frameWeigh     the weigh jobs' rule as before (50 birds from 5 places); the strip names Weigh the frame
//     - jd'.variant = { v: VARIANT_V, keys: [payoff keys applied], parts: { [system]: part } } (saved with the instance: a
//       resume makes the same rule, whatever the perks are then)
//   variantKeyOf(jd') -> 'key1+key2' | ''   what the engine saves beside the instance
//   rebuildVariant(jd, saved, perks) -> jd' the saved instance's rule (its keys as saved, whatever the perks are now)
// The glance: a panel of AUTO_SYSTEMS[system].glanceAt open AUTO.glanceSec with perks.auto(system) sends ui-only
// auto.glance { system } once per opening (the bird scale's display sends scale.read too; the variant matches auto.glance).
export const VARIANT_V = 1;

/** STUB: the job as it is (no payoff applied). */
export function jobVariant(jd, perks, ctx = {}) { void perks; void ctx; return jd; }
export const variantKeyOf = (jd) => (jd && jd.variant && jd.variant.keys ? jd.variant.keys.join('+') : '');
/** STUB: the job as it is. */
export function rebuildVariant(jd, saved, perks) { void saved; void perks; return jd; }
