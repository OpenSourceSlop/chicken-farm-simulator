// The tally bucket's share at the bin (SKILLS.md §3.10, review issue 2). Pure logic. Owner: package "scene"; package
// "panels" imports it read-only (the dead-bin panel's Count key), so both bin paths count the same way and no dead bird is
// counted twice. Contract in code since the design revision:
//   props.carryOpts while the bucket is carried: { n, causes: { [cause]: n }, counted, countedCauses } — n every bird in
//   the bucket, counted the share the tally already sent as dead.count { n, causes, at: 'pickup' } (Biosecurity 2).
//   binShare(carryOpts) -> { n, causes, dropped } — what the bin still counts: dead.count { n, causes, byLook?, at: 'bin' }
//   is sent only when n > 0 or byLook has a count (n 0 leaves countedDead as it is); dropped (every bird in the bucket) goes
//   with EV.DEAD_DROP { n: dropped, causes, counted } as before, so the bucket empties and r-dead-am / r-dead-pm's
//   dead-cleared holds.
import { AUTO } from './config.js';

export function binShare(o = {}) {
  const n = Math.max(0, Math.round(o.n || 0)), counted = Math.min(n, Math.max(0, Math.round(o.counted || 0)));
  const causes = { ...(o.causes || {}) };
  for (const [k, v] of Object.entries(o.countedCauses || {})) causes[k] = Math.max(0, (causes[k] || 0) - v);
  for (const k of Object.keys(causes)) if (!causes[k]) delete causes[k];
  return { n: n - counted, causes, dropped: n };
}

// The bucket's weight and room (SKILLS.md §3.10: the tally bucket holds under AUTO.bucketMaxKg, 15 kg; the birds' weight
// from the flock's mean: about 6 birds of 2.4 kg, 30 or more chicks in week 1; a full bucket goes to the bin first). Used by
// props.js and the flock's dead-bird provider while the tally holds (never with SKILLS_UPDATE.live false: Phase 5's bucket
// has no cap); scripts/test-tally.mjs checks it.
//   o: props.carryOpts of the bucket or props.bucketDown: { n, causes, counted?, countedCauses?, kg? }

/** One dead bird's weight now (kg): the flock's mean (a chick never under 30 g). */
export const birdKgOf = (farm) => Math.max(0.03, (Number(farm?.flock?.meanWeightG) || 40) / 1000);
/** The weight in the bucket (kg): its own sum when kept, else its birds at today's weight. */
export const bucketKg = (o, birdKg) => (Number.isFinite(o?.kg) ? o.kg : Math.max(0, o?.n || 0) * birdKg);
/** How many more birds of birdKg go in under maxKg: { n, kg, maxKg }; an empty bucket always takes one bird. */
export function bucketRoom(o, birdKg, maxKg = AUTO.bucketMaxKg) {
  const kg = bucketKg(o, birdKg), n = Math.floor((maxKg - kg) / birdKg + 1e-9);
  return { n: (o?.n || 0) > 0 ? Math.max(0, n) : Math.max(1, n), kg: +kg.toFixed(3), maxKg };
}
/** Birds into the bucket (o changed in place): n, causes and the weight; with tally the counted share grows by the same. */
export function addToBucket(o, { n = 0, causes = {}, tally = false } = {}, birdKg = 0.04) {
  const kg0 = bucketKg(o, birdKg);
  o.n = (o.n || 0) + n;
  o.causes = o.causes || {};
  for (const [k, v] of Object.entries(causes)) o.causes[k] = (o.causes[k] || 0) + v;
  o.kg = +(kg0 + n * birdKg).toFixed(3);
  if (tally) {
    o.counted = (o.counted || 0) + n;
    o.countedCauses = o.countedCauses || {};
    for (const [k, v] of Object.entries(causes)) o.countedCauses[k] = (o.countedCauses[k] || 0) + v;
  }
  return o;
}
/** A copy of the bucket's fields (carried <-> set down <-> saved); the tally's fields only when it has them. */
export const bucketCopy = (o) => ({ n: o?.n || 0, causes: { ...(o?.causes || {}) },
  ...(o && o.counted != null ? { counted: o.counted, countedCauses: { ...(o.countedCauses || {}) } } : {}),
  ...(o && Number.isFinite(o.kg) ? { kg: o.kg } : {}) });

/**
 * Dead birds into a bucket (props.startCarry 'bucket' calls it for the bucket set down, the one carried, or a new one in
 * the hand when `o` is null). Without the tally exactly Phase 4 (n and causes added); with it (Biosecurity 2,
 * props.tallyOn) the weight and the counted share grow too and the birds are counted at once: farm.act('dead.count',
 * { n, causes, at: 'pickup' }). Returns the bucket.
 */
export function putInBucket(o, opts = {}, { farm = null, tally = false } = {}) {
  const n = Math.max(0, Math.round(opts.n || 0)), causes = opts.causes || {};
  let b = o;
  if (!b) b = tally ? addToBucket({ n: 0, causes: {} }, { n, causes, tally: true }, birdKgOf(farm)) : bucketCopy(opts);
  else if (tally) addToBucket(b, { n, causes, tally: true }, birdKgOf(farm));
  else {
    b.n += opts.n || 0;
    for (const [k, v] of Object.entries(causes)) b.causes[k] = (b.causes[k] || 0) + v;
  }
  if (tally && n > 0) farm?.act?.('dead.count', { n, causes: { ...causes }, at: 'pickup' });
  return b;
}
