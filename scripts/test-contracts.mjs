// Node tests for the shared, integrator-owned Phase 2 contracts: the event bus and matchPayload
// (events.js), the interact registry's priority rule (interact.js), and the content tables every
// package reads (content-jobs.js, content-signs.js, skills.js milestone texts). Owner: integrator.
// Run: node scripts/test-contracts.mjs   (also part of `npm test`)
import { createEvents, matchPayload, EV } from '../src/events.js';
import { createInteract } from '../src/interact.js';
import { JOBS, STATE_TEST_IDS } from '../src/content-jobs.js';
import { BOARDS, BOARD_IDS, sourceLabel } from '../src/content-signs.js';
import { MILESTONES } from '../src/skills.js';
import { SPOTS, SPOTS2, FARM, GUIDES } from '../src/config.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

test('events: handlers run in order, a throwing one does not stop the rest', () => {
  const bus = createEvents(), got = [];
  const err = console.error; console.error = () => {};
  bus.on('x', () => got.push(1)); bus.on('x', () => { throw new Error('boom'); }); bus.on('x', () => got.push(3));
  bus.on('*', (p, t) => got.push(t));
  bus.emit('x', {});
  console.error = err;
  assert(got.join(',') === '1,3,x', got.join(','));
});

test('matchPayload: flat keys, nested result, missing keys', () => {
  const action = { id: 'water.clearFilter', line: 1, result: { fixed: true, minutes: 5 } };
  assert(matchPayload(action, { id: 'water.clearFilter' }), 'flat');
  assert(matchPayload(action, { result: { fixed: true } }), 'nested subset');
  assert(!matchPayload(action, { result: { fixed: false } }), 'nested mismatch');
  assert(!matchPayload(action, { fixed: true }), 'a flat key does not look inside result');
  assert(!matchPayload({ id: 'x' }, { result: { fixed: true } }), 'missing nested');
  assert(matchPayload({ where: 'gate' }, null), 'no pattern matches');
});

test('interact: priority beats distance, fixed beat default providers, null providers ignored', () => {
  const reg = createInteract([{ id: 'controller', label: 'Climate controller', x: 0, z: 0, radius: 1.5 }]);
  const at = (x, z) => ({ position: { x, z }, isInside: true });
  // three overlapping providers, all within reach of the farmer at (5, 0)
  reg.addProvider('litter', (p) => ({ id: 'litter', label: 'litter', x: p.x, z: p.z, radius: 1 }));            // d = 0, priority 0
  reg.addProvider('dead-bird', () => ({ id: 'dead-bird', label: 'dead bird', x: 5.8, z: 0, radius: 1.2, priority: 6 }));
  reg.addProvider('tip', () => null);                                                                       // hands empty: no tip
  assert(reg.nearest(at(5, 0)).id === 'dead-bird', 'dead bird (priority 6) beats litter at the feet (0)');
  reg.addProvider('tip', (p) => ({ id: 'tip', label: 'tip', x: p.x, z: p.z + 0.3, radius: 2, priority: 20 }));
  assert(reg.nearest(at(5, 0)).id === 'tip', 'tip while carrying boxes (20) beats the dead bird');
  assert(reg.nearest(at(0.5, 0)).id === 'tip', 'priority 20 beats a fixed board (10)');
  reg.removeProvider('tip');
  assert(reg.nearest(at(0.5, 0)).id === 'controller', 'fixed (10) beats dead bird (6) and litter (0)');
  // a dead bird at the feet (within its nearRadius 0.8 m: nearPriority 15) beats the board behind it;
  // 1.2 m away the board answers again, and a tip while carrying (20) still wins
  const reg2 = createInteract([{ id: 'sign-vent', label: 'Minimum ventilation', x: 0, z: -1, radius: 2 }]);
  let bird = { x: 0.5, z: 0 };
  reg2.addProvider('dead-bird', () => bird && ({ id: 'dead-bird', label: 'dead bird', x: bird.x, z: bird.z, radius: 1.5, priority: 6, nearRadius: 0.8, nearPriority: 15 }));
  assert(reg2.nearest(at(0, 0)).id === 'dead-bird', 'dead bird 0.5 m away beats the board (2 m reach)');
  bird = { x: 1.2, z: 0 };
  assert(reg2.nearest(at(0, 0)).id === 'sign-vent', 'dead bird 1.2 m away: the board answers');
  bird = null;
  assert(reg2.nearest(at(0, 0)).id === 'sign-vent', 'no dead bird: the board answers');
  bird = { x: 0.3, z: 0 };
  reg2.addProvider('tip', (p) => ({ id: 'tip', label: 'tip', x: p.x, z: p.z, radius: 2, priority: 20 }));
  assert(reg2.nearest(at(0, 0)).id === 'tip', 'carrying boxes: the tip (20) beats a bird at the feet (15)');
  const err = console.error; console.error = () => {};
  reg.addProvider('broken', () => { throw new Error('x'); });
  assert(reg.nearest(at(5, 0)).id === 'dead-bird', 'a throwing provider is skipped');
  console.error = err;
});

test('signs: every item has a known source, no page numbers', () => {
  for (const [id, b] of Object.entries(BOARDS)) {
    assert(b.title && b.items.length, `${id} empty`);
    for (const it of b.items) {
      for (const k of [].concat(it.source)) assert(k === 'week1-4' || k in GUIDES, `${id}: unknown source ${k}`);
      assert(!/\bp\.\s*\d|\bpage\b/i.test(it.text + sourceLabel(it.source)), `${id}: page reference in "${it.text}"`);
    }
  }
});

test('jobs: signs, spots and state tests resolve', () => {
  const spotOk = (s) => s in SPOTS || s in SPOTS2 || s in FARM || /^drinkers\.[0-3]$/.test(s) || ['heater', 'heater-out', 'dead', 'leak'].includes(s);
  const ids = new Set();
  for (const j of JOBS) {
    assert(!ids.has(j.id), `duplicate job ${j.id}`); ids.add(j.id);
    assert(spotOk(j.spot), `${j.id}: spot ${j.spot}`);
    for (const s of j.signs) assert(BOARD_IDS.includes(s), `${j.id}: sign ${s} not in content-signs`);
    const walk = (r) => { if (r.type === 'state') assert(STATE_TEST_IDS.includes(r.test), `${j.id}: state ${r.test}`); (r.of || []).forEach(walk);
      if (r.type === 'event') assert(Object.values(EV).includes(r.event), `${j.id}: event ${r.event}`); };
    walk(j.done);
  }
});

test('player-facing words: no verdicts in job titles, signs or milestone texts', () => {
  const bad = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;
  const texts = [...JOBS.map((j) => j.title), ...Object.values(BOARDS).flatMap((b) => b.items.map((i) => i.text)), ...MILESTONES.map((m) => m.text)];
  for (const t of texts) assert(!bad.test(t), `verdict word in "${t}"`);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
