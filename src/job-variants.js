// Job variants: a job as the farmer's payoffs make it (SKILLS.md §3, §4.3, §12.5). Pure logic. Owner: package "jobs".
// STUB of the design round: jobVariant returns the job as it is; the shapes below are the contract the engine, the job
// card, the strips and the milestones build on.
//
//   jobVariant(jd, perks, ctx?) -> jd'   the job definition as the payoffs give it now, made when an instance is made
//                                        (job-engine.js createJobEngine({ variant }) calls it in make() and in restore):
//     - a sampling job's count (perks.need(jd.id)): done.n / sectors from PAYOFFS[key].need (d0-vent 3, d1-crop 6, b-crop48 6,
//       the weigh jobs 25), the label and the strip naming the new figure
//     - a job handed to a system (perks.handled(jd.id)): done = { type: 'any', handled: system, label: 'handled by the
//       controller (Water 3)', of: [GLANCE, done] } with
//       GLANCE = { type: 'all', of: [{ type: 'state', test: 'auto-ok', system, live: true, label: AUTO_SYSTEMS[system].keeps },
//                                   { type: 'action', id: 'auto.glance', match: { system }, label: 'Look at <reading> (<place>)' }] }
//       (r-raise splits into its drinker part 'drinkers-raised' (winch) and its feeder part 'pans-raised' (feed), each its own
//       any-rule; a job of two parts keeps the manual parts of the systems that are off)
//     - a job a level 2 payoff moves (job-next places): `places` override (r-drinkers: ['waterSupply'] then the regulators of
//       lines out of band; the order jobs: the silo gauge too; the phone jobs: none — anywhere, with R)
//     - jd'.variant = { v: VARIANT_V, keys: [payoff keys applied] } (saved with the instance: a resume makes the same rule)
//   variantKeyOf(jd') -> 'key1+key2' | ''   what the engine saves beside the instance
//   rebuildVariant(jd, saved, perks) -> jd' the saved instance's rule (its keys as saved, whatever the perks are now)
export const VARIANT_V = 1;

/** STUB: the job as it is (no payoff applied). */
export function jobVariant(jd, perks, ctx = {}) { void perks; void ctx; return jd; }
export const variantKeyOf = (jd) => (jd && jd.variant && jd.variant.keys ? jd.variant.keys.join('+') : '');
/** STUB: the job as it is. */
export function rebuildVariant(jd, saved, perks) { void saved; void perks; return jd; }
