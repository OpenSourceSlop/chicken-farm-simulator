// The tally bucket's share at the bin (SKILLS.md §3.10, review issue 2). Pure logic. Owner: package "scene"; package
// "panels" imports it read-only (the dead-bin panel's Count key), so both bin paths count the same way and no dead bird is
// counted twice. Contract in code since the design revision:
//   props.carryOpts while the bucket is carried: { n, causes: { [cause]: n }, counted, countedCauses } — n every bird in
//   the bucket, counted the share the tally already sent as dead.count { n, causes, at: 'pickup' } (Biosecurity 2).
//   binShare(carryOpts) -> { n, causes, dropped } — what the bin still counts: dead.count { n, causes, byLook?, at: 'bin' }
//   is sent only when n > 0 or byLook has a count (n 0 leaves countedDead as it is); dropped (every bird in the bucket) goes
//   with EV.DEAD_DROP { n: dropped, causes, counted } as before, so the bucket empties and r-dead-am / r-dead-pm's
//   dead-cleared holds.
export function binShare(o = {}) {
  const n = Math.max(0, Math.round(o.n || 0)), counted = Math.min(n, Math.max(0, Math.round(o.counted || 0)));
  const causes = { ...(o.causes || {}) };
  for (const [k, v] of Object.entries(o.countedCauses || {})) causes[k] = Math.max(0, (causes[k] || 0) - v);
  for (const k of Object.keys(causes)) if (!causes[k]) delete causes[k];
  return { n: n - counted, causes, dropped: n };
}
