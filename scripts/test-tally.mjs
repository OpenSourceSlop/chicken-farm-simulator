// The tally bucket (SKILLS.md §3.10, §13.1; package "scene"): Biosecurity 2's bucket counts each dead bird as it goes in
// (dead.count { at: 'pickup' }) and keeps that share on props.carryOpts (counted / countedCauses), so the bin counts only
// the rest (props-tally.js binShare: both bin paths, props.js countIntoBin and the dead-bin panel) — no bird twice. Cases:
// binShare's arithmetic; the bucket's weight and the 15 kg cap by age; the real flock-dead pickUp with the reach and the
// cap (nearest first, the rest left lying); and through the farm: 5 birds picked up with the tally, then emptied at the
// bin with a by-look tally raise countedDead by exactly 5 (and the day's count, the known count and the record's deaths by
// 5), while the Phase 4 bucket (no tally) still counts every bird at the bin once.
//   node scripts/test-tally.mjs
import * as THREE from 'three';
import { binShare, bucketRoom, bucketKg, birdKgOf, addToBucket, putInBucket, bucketCopy } from '../src/props-tally.js';
import { AUTO, LEVEL1, SKILLS_UPDATE, weightAt } from '../src/config.js';
import { EV } from '../src/events.js';
import { makeWorld } from '../src/farm-profiles-run.js';
import { knownAlive } from '../src/farm-act.js';
import { createDeadBirds } from '../src/flock-dead.js';
import { createBirdUniforms } from '../src/flock-shader.js';
import { createEvents } from '../src/events.js';

let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (c, msg) => { if (!c) throw new Error(msg); };

test('binShare: the bin counts only what the tally did not count at pickup', () => {
  const a = binShare({ n: 5, causes: { heat: 3, legs: 2 }, counted: 5, countedCauses: { heat: 3, legs: 2 } });
  assert(a.n === 0 && a.dropped === 5 && Object.keys(a.causes).length === 0, `all counted at pickup: ${JSON.stringify(a)}`);
  const b = binShare({ n: 4, causes: { heat: 4 }, counted: 1, countedCauses: { heat: 1 } });
  assert(b.n === 3 && b.causes.heat === 3 && b.dropped === 4, `part counted: ${JSON.stringify(b)}`);
  const c = binShare({ n: 2, causes: { cold: 2 } });
  assert(c.n === 2 && c.dropped === 2 && c.causes.cold === 2, 'no tally: the bin counts every bird (Phase 4)');
  const d = binShare({ n: 3, causes: {}, counted: 9 });
  assert(d.n === 0 && d.dropped === 3, 'counted never more than the birds in the bucket');
  const e = binShare(undefined);
  assert(e.n === 0 && e.dropped === 0, 'an empty bucket');
});

test('the 15 kg cap by age: chicks by the hundred in week 1, about 6 birds of 2.4 kg, 5 at harvest weight', () => {
  assert(AUTO.bucketMaxKg === 15 && AUTO.deadReachM === 2.5, `AUTO ${AUTO.bucketMaxKg} kg, ${AUTO.deadReachM} m`);
  const out = [];
  for (const [day, want] of [[0, (n) => n >= 300], [7, (n) => n >= 70 && n <= 120], [21, (n) => n >= 13 && n <= 18], [35, (n) => n >= 6 && n <= 8], [42, (n) => n === 5]]) {
    const kg = birdKgOf({ flock: { meanWeightG: weightAt(day) } });
    const room = bucketRoom({ n: 0, causes: {} }, kg);
    out.push(`day ${day}: ${room.n} birds of ${(kg * 1000).toFixed(0)} g`);
    assert(want(room.n), `day ${day}: room ${room.n} (bird ${kg} kg)`);
  }
  const big = 2.4, o = { n: 0, causes: {} };
  addToBucket(o, { n: 6, causes: { heat: 6 }, tally: true }, big);
  assert(Math.abs(bucketKg(o, big) - 14.4) < 1e-9 && bucketRoom(o, big).n === 0, `six birds of 2.4 kg fill it: ${JSON.stringify(bucketRoom(o, big))}`);
  const one = { n: 0, causes: {} };
  assert(bucketRoom(one, 20).n === 1, 'an empty bucket always takes a bird');
  console.log(`     ${out.join(' · ')}; 6 x 2.4 kg = 14.4 kg, full`);
});

// a dead-bird layer of the flock in node (the real flock-dead.js), with a props stand-in that records startCarry
function deadLayer() {
  const scene = new THREE.Scene(), events = createEvents(), calls = [];
  const props = { carrying: null, carryOpts: null, startCarry(kind, opts) { calls.push({ kind, opts }); this.carrying = kind; this.carryOpts = putInBucket(this.carryOpts, opts, { tally: !!opts.tally, farm: null }); } };
  const S = { n: 0, L: 0.5, bounds: { xMin: -23.2, xMax: 23.2, zMin: -5.6, zMax: 5.6 }, rand: (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })() };
  const dead = createDeadBirds({ scene, events, props }, S, createBirdUniforms(), { lastTip: null });
  return { dead, events, props, calls };
}

test('flock-dead pickUp: the tally takes the nearest birds within 2.5 m up to the room, the rest stay on the floor', () => {
  const { dead, events, props, calls } = deadLayer();
  const picks = [];
  events.on(EV.DEAD_PICK, (p) => picks.push(p));
  // eight birds round (0, 0): five within 1.5 m, two at 2.0-2.4 m, one at 3 m
  for (const [x, z] of [[0.3, 0], [-0.5, 0.2], [0, 0.9], [1.1, -0.4], [-1.2, -0.6], [2.0, 0.3], [0, -2.3], [3.0, 0]]) dead.api.layAt(x, z, 'heat');
  // Phase 4: 1.5 m, no cap
  const p4 = deadLayer();
  for (const [x, z] of [[0.3, 0], [-0.5, 0.2], [0, 0.9], [1.1, -0.4], [-1.2, -0.6], [2.0, 0.3], [0, -2.3], [3.0, 0]]) p4.dead.api.layAt(x, z, 'heat');
  const r4 = p4.dead.api.pickUp(0, 0, 1.5);
  assert(r4.n === 5 && !('left' in r4) && p4.calls[0].opts.tally === undefined, `Phase 4 pick: ${JSON.stringify(r4)}`);
  // the tally: 2.5 m, room for 6
  const r = dead.api.pickUp(0, 0, AUTO.deadReachM, { maxN: 6, tally: true });
  assert(r.n === 6 && r.left === 1 && dead.api.count === 2, `tally pick: ${JSON.stringify(r)}, ${dead.api.count} still on the floor`);
  assert(calls.length === 1 && calls[0].opts.tally === true && calls[0].opts.n === 6, 'one startCarry with the tally flag');
  assert(picks.length === 1 && picks[0].n === 6 && picks[0].carried === 6, `EV.DEAD_PICK ${JSON.stringify(picks[0])}`);
  assert(props.carryOpts.counted === 6 && props.carryOpts.n === 6, `counted on carryOpts: ${JSON.stringify(props.carryOpts)}`);
  // the one left within reach was the farthest of the seven (2.3 m), not the nearer ones
  const near = dead.api.near(0, 0, 2.5);
  assert(near.length === 1 && Math.abs(near[0].z + 2.3) < 0.01, `left in reach: ${JSON.stringify(near)}`);
});

test('through the farm: 5 birds with the tally, then the bin with deadByLook -> countedDead +5 exactly', () => {
  const live0 = SKILLS_UPDATE.live;
  SKILLS_UPDATE.live = true;
  try {
    const w = makeWorld();
    w.farm.start(LEVEL1, { seed: 2 });
    w.env.setDay(3); w.env.setHour(9);
    w.farm.flock.placed = 6000;
    const fl = w.farm.flock, d = w.env.dayNumber;
    const before = { counted: fl.countedDead, day: fl.countedByDay[d] || 0, known: knownAlive(fl), rec: w.records.draft(d).deaths || 0 };
    const counts = [];
    w.events.on(EV.ACTION, (p) => { if (p.id === 'dead.count') counts.push({ n: p.n, at: p.at }); });
    // two picks into the bucket (3 then 2), each counted as it goes in (props.startCarry -> putInBucket)
    let bucket = putInBucket(null, { n: 3, causes: { heat: 3 } }, { farm: w.farm, tally: true });
    bucket = putInBucket(bucket, { n: 2, causes: { legs: 2 } }, { farm: w.farm, tally: true });
    assert(bucket.n === 5 && bucket.counted === 5 && bucket.countedCauses.heat === 3 && bucket.countedCauses.legs === 2, `bucket ${JSON.stringify(bucket)}`);
    assert(fl.countedDead - before.counted === 5, `after pickup countedDead +${fl.countedDead - before.counted}`);
    // set down and picked up again: the counted share goes with the bucket
    const down = { x: -4, z: 1, ...bucketCopy(bucket), inside: true };
    bucket = putInBucket(null, bucketCopy(down), { farm: w.farm, tally: false });
    assert(bucket.counted === 5 && bucket.n === 5 && fl.countedDead - before.counted === 5, 'set down and picked up: no new count');
    // the bin (either path): only binShare, plus the panel's by-look tally that never adds to countedDead
    const share = binShare(bucket);
    if (share.n > 0) w.farm.act('dead.count', { n: share.n, causes: share.causes, at: 'bin' });
    else w.farm.act('dead.count', { n: 0, causes: {}, byLook: { back: 2, thin: 3 }, at: 'bin' });
    const after = { counted: fl.countedDead, day: fl.countedByDay[d] || 0, known: knownAlive(fl), rec: w.records.draft(d).deaths || 0 };
    assert(after.counted - before.counted === 5, `countedDead +${after.counted - before.counted}`);
    assert(after.day - before.day === 5, `the day's count +${after.day - before.day}`);
    assert(before.known - after.known === 5, `the known count -${before.known - after.known}`);
    assert(after.rec - before.rec === 5, `the record's deaths +${after.rec - before.rec} (${before.rec} -> ${after.rec})`);
    assert(counts.filter((c) => c.at === 'pickup').reduce((s, c) => s + c.n, 0) === 5 && counts.filter((c) => c.at === 'bin').reduce((s, c) => s + c.n, 0) === 0,
      `dead.count by where: ${JSON.stringify(counts)}`);
    console.log(`     countedDead ${before.counted} -> ${after.counted}, day ${d}: ${before.day} -> ${after.day}, known ${before.known} -> ${after.known}, record deaths ${before.rec} -> ${after.rec}; counts ${JSON.stringify(counts)}`);
  } finally { SKILLS_UPDATE.live = live0; }
});

test('the Phase 4 bucket (no tally): every bird counted once, at the bin', () => {
  const w = makeWorld();
  w.farm.start(LEVEL1, { seed: 2 });
  w.env.setDay(3); w.env.setHour(9);
  const fl = w.farm.flock, before = fl.countedDead;
  let bucket = putInBucket(null, { n: 3, causes: { heat: 3 } }, { farm: w.farm, tally: false });
  bucket = putInBucket(bucket, { n: 2, causes: { cold: 2 } }, { farm: w.farm, tally: false });
  assert(fl.countedDead === before && !('counted' in bucket) && !('kg' in bucket), `no count before the bin, no tally fields: ${JSON.stringify(bucket)}`);
  const share = binShare(bucket);
  w.farm.act('dead.count', { n: share.n, causes: share.causes });
  assert(fl.countedDead - before === 5 && share.dropped === 5, `countedDead +${fl.countedDead - before}`);
  // a tally pickup with the switch off still counts nothing (the perks never hold while live is false)
  assert(SKILLS_UPDATE.live === false, 'live is false on this branch by default');
});

for (const t of tests) {
  const t0 = Date.now();
  try { await t.fn(); console.log(`ok   ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); if (process.env.TRACE) console.log(e.stack); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
