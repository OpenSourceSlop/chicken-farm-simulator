// The play-time model of a farm day (SKILLS.md §14.1, package "jobs"): for each job of the day (the engine's instances of
// that day in the card's order, the ideal's rounds deciding which problem jobs open) the walk from the last place to the
// job's places (the route length from player-path.js findPath on the house walls as house.js lays them, at 4 m/s) + 2 s per
// press the job needs (a table per job: each cup test 2 presses, the sight tubes 1, a light program by hand ~14, with the
// one-press key 1 …) + the real seconds of its farm-time waits at the panel clock (1 farm minute = 2.5 s) + the glance (1 s
// open) for a handed-over job. The same day three times: no skills, every branch at level 2, every branch at level 3
// (faults off: the controllers keep every reading in band). Printed per job and per day.
//   node scripts/skill-time.mjs                 the table for days 0, 1, 8, 14, 16, 25 and 37 (and the sample jobs alone)
//   node scripts/skill-time.mjs --days 8,16 --jobs   with the per-job lines
//   node scripts/skill-time.mjs --json          the figures as JSON (the integrator writes them in SKILLS.md §14.2)
//   node scripts/skill-time.mjs --assert        the bands of §14.2 (BANDS below: set from the first measurement)
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createRun } from '../src/run.js';
import { createPerks } from '../src/perks.js';
import { findPath } from '../src/player-path.js';
import { PLACES } from '../src/job-next.js';
import { HOUSE, HOUSE_BOUNDS, FARM, SPOTS2, SPOTS3, SKILLS_UPDATE, SKILL_BRANCHES, AUTO_SYSTEMS, levelOfDay, DRINKER_LINES_Z } from '../src/config.js';
import { columnsNow } from '../src/farm-auto.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
// days 0, 1 and 14 (the vent and crop samples, a weigh day) since the farmer's choice: Growth 2's 25 birds, Brooding 2's 3 chicks
const DAYS = String(opt('--days', '0,1,8,14,16,25,37')).split(',').map(Number);
const SHOW_JOBS = args.includes('--jobs'), JSON_OUT = args.includes('--json'), ASSERT = args.includes('--assert');

// ---------------- the model's figures (§14.1) ----------------
export const M = {
  speed: 4,          // m/s walking on the route
  press: 2,          // s per press (a key, a click)
  farmMin: 2.5,      // s of real time per farm minute at the panel clock (24 game s per real s)
  glance: 1,         // s a panel stays open for a handed-over job's glance
  read: 2,           // s reading the card, the strip or a sign row per job (a panel's few seconds open)
  repeat: 0.4,       // s for a press that repeats the one before (pressing + again: p3-cycle's own count)
  skipPresses: 4,    // Next job presses a day (the rounds' gaps)
};
// p3-cycle's measured real-input days (ARCHITECTURE.md, Phase 3 as integrated: 4.4 / 4.7 / 4.1 / 4.2 min of play)
const P3_MIN = { 8: 4.4, 16: 4.7, 25: 4.1, 37: 4.2 };
// §14.2 bands (% of the no-skill day), set from the first measurement (jobs package, seed 1: day 8 85 / 72 %, day 16 87 /
// 75 %, day 25 95 / 81 %, day 37 91 / 78 % at level 2 / 3; the no-skill days 4.73 / 5.33 / 4.25 / 4.38 min, +8 / +13 / +4 /
// +4 % on p3-cycle's) as each measured figure + 5 points; the integrator writes them in SKILLS.md §14.2
// days 0, 1, 14 (the farmer's choice after the skills review, seed 1: 84 / 82 %, 81 / 79 %, 79 / 58 %) the same way
// and day 16 / 25 / 37 at level 2 again once Ventilation 2 reads the fans at the controller (82 / 89 / 86 %)
const BANDS = { l2: { 0: 89, 1: 86, 8: 90, 14: 84, 16: 87, 25: 94, 37: 91 }, l3: { 0: 87, 1: 84, 8: 77, 14: 63, 16: 80, 25: 86, 37: 83 } };
/** The sample jobs alone (seconds of play: no skills, level 2, level 3), printed under the table. */
const SAMPLE_JOBS = { 0: 'd0-vent', 1: 'd1-crop', 14: 'w2-weigh' };

// ---------------- the farm's walls (house.js: the 1.8 m door gap in the south wall stays open) ----------------
const T = HOUSE.wallThickness, d = HOUSE.door, { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;
const COLLIDERS = [
  { type: 'box', minX: xMin - T, maxX: xMax + T, minZ: zMin - T, maxZ: zMin + 0.12 },
  { type: 'box', minX: xMin - T, maxX: d.x - d.width / 2, minZ: zMax - 0.12, maxZ: zMax + T },
  { type: 'box', minX: d.x + d.width / 2, maxX: xMax + T, minZ: zMax - 0.12, maxZ: zMax + T },
  { type: 'box', minX: xMin - T - 0.1, maxX: xMin + 0.12, minZ: zMin - T, maxZ: zMax + T },
  { type: 'box', minX: xMax - 0.3, maxX: xMax + T + 0.1, minZ: zMin - T, maxZ: zMax + T },
];
const routeCache = new Map();
/** The route length (m) from a to b round the house walls (player-path.js findPath, radius 0.35). */
export function routeM(a, b) {
  if (!a || !b) return 0;
  const k = `${a.x.toFixed(1)},${a.z.toFixed(1)}>${b.x.toFixed(1)},${b.z.toFixed(1)}`;
  if (routeCache.has(k)) return routeCache.get(k);
  const pts = findPath(a.x, a.z, b.x, b.z, 0.35, COLLIDERS, FARM.walk) || [b];
  let m = 0, p = a;
  for (const q of pts) { m += Math.hypot(q.x - p.x, q.z - p.z); p = q; }
  routeCache.set(k, m);
  return m;
}
// a place 0.9 m in front of a wall-mounted spot (the farmer stands there)
const stand = (s) => (!s ? null : s.inside && Math.abs(s.z) > 5.4 ? { x: s.x, z: s.z - Math.sign(s.z) * 0.9 } : { x: s.x, z: s.z });
const PL = (id) => {
  if (id === 'phone') return null;
  if (id.startsWith('drinkers.')) return stand({ ...SPOTS2.drinkers[+id.slice(9)], inside: true });
  if (id === 'birdScale') return stand(SPOTS2.birdScale);
  if (id === 'gate') return { x: FARM.spawn.x, z: FARM.spawn.z };
  return stand(PLACES[id]?.at || SPOTS2[id] || SPOTS3[id]);
};
const floor = (x, z) => ({ x, z });

// ---------------- the jobs: their places, presses and waits by the payoffs held (h(key)) ----------------
// step: { at: place id | { x, z } | 'phone', presses, wait (s), glance? }; a panel visit counts its open and close presses
const panel = (at, presses, wait = 0, rep = 0) => ({ at, presses: presses + 2, wait, rep });
const visit = (at, presses = 0, wait = 0) => ({ at, presses, wait });
const glance = (at) => ({ at, presses: 2, wait: M.glance, glance: true });
const phone = (presses) => ({ at: 'phone', presses: presses + 2, wait: 0 });
const lines4 = (fn) => [0, 1, 2, 3].map(fn);
/** A walk through the floor in use (the coverage rule's cells at 2 m sight: about cells / 4 m of walking). */
const walkSteps = (cells, house) => { const L = Math.min(house ? 44 : 18, cells / 4); const x0 = house ? -20 : -21; return [visit(floor(x0, -2)), visit(floor(x0 + L / 2, 2)), visit(floor(x0 + L, -2), 0, 2)]; };
export const JOB_MODEL = {
  'r-dips': () => [visit('footDipGate'), visit('houseDoor')],
  'r-dips-pm': () => [visit('houseDoor')],
  'r-controller': () => [panel('controller', 0, 2)], 'r-controller-pm': () => [panel('controller', 0, 2)],
  'r-meter': () => [panel('waterSupply', 1)],
  'r-feedmeter': () => [panel('feederBox', 1)],
  'r-feeders': () => [panel('feederBox', 1), panel('silo', 1)],
  'r-walk': (h, c) => walkSteps(150, c.house), 'r-walk-pm': (h, c) => walkSteps(105, c.house), 'w2-spread': () => walkSteps(144, true),
  'r-litter': () => [visit(floor(-12, -3), 1), visit(floor(-10, DRINKER_LINES_Z[1]), 2)],
  'r-record': (h) => (h('phoneRecord') ? [phone(1)] : [panel('officeDesk', 1)]),
  'r-drinkers': (h, c) => {
    // Water 2: the sight tubes, then a cup test only on the lines that read off (the farm's own columns at 06:00)
    if (h('waterAllLines')) return [panel('waterSupply', 1), ...c.offLines.map((i) => panel(`drinkers.${i}`, 1, M.farmMin))];
    return lines4((i) => panel(`drinkers.${i}`, 1, M.farmMin));
  },
  'r-raise': (h, c) => {
    const drink = c.handed('winch') ? [glance('waterSupply')] : lines4((i) => panel(`drinkers.${i}`, 1));
    const feed = c.handed('feed') ? [glance('feederBox')] : [panel('feederBox', 3)];
    return [...drink, ...feed];
  },
  // by hand: dark hours +, then the dimmer −, each pressed again (repeats), then Set the program; Lighting 2: one press
  'w2-lights': (h, c) => (c.handed('lights') ? [glance('controller')] : h('weekLights') ? [panel('controller', 1)] : [panel('controller', 3, 0, 10)]),
  'w2-lux': () => [visit(floor(-20, -2.5), 1), visit(floor(-15, 2.5), 1), visit(floor(-10, -2.5), 1)],
  // five birds from three parts of the house (the rule's 3 parts): two, two and one, each caught, looked at, let go
  'w3-droppings': () => [panel(floor(-18, -2.8), 1), panel(floor(-17, -1.8), 1), panel(floor(-6, 2.8), 1), panel(floor(-5, 1.8), 1), panel(floor(6, -2.8), 1)],
  // Ventilation 2 (the final check): the fans read at the controller's Ventilation tab too, the nearer of the two
  'r-fans-pm': (h, c) => (c.handed('stages') ? [glance(c.nearest(['controller', 'fanPanel']))] : h('fanAdvice') ? [panel(c.nearest(['controller', 'fanPanel']), 0, 2)] : [panel('fanPanel', 0, 2)]),
  // the night's fans and timer: by the heat sign by hand (about 4 presses), Set as suggested with Ventilation 2
  'r-vent-night': (h) => [panel('controller', h('fanAdvice') ? 1 : 2, 2, h('fanAdvice') ? 0 : 2)],
  'f-book': (h) => (h('pocketPhone') ? [phone(2)] : [panel('officeDesk', 3)]),
  'f-order': (h, c) => (h('pocketPhone') ? [phone(3)] : h('siloOrder') ? [panel('silo', 1)] : [panel('officeDesk', 4)]),
  'p-order-feed': (h, c) => (h('pocketPhone') ? [phone(3)] : h('siloOrder') ? [panel('silo', 1)] : [panel('officeDesk', 4)]),
  'p-heat3': (h) => [panel(h('fanAdvice') ? 'controller' : 'fanPanel', h('fanAdvice') ? 1 : 5, 2)],
  'p-panting': (h) => [panel(h('fanAdvice') ? 'controller' : 'fanPanel', h('fanAdvice') ? 1 : 5, 2)],
  'p-panting-fin': (h) => [panel(h('fanAdvice') ? 'controller' : 'fanPanel', h('fanAdvice') ? 1 : 5, 2)],
};
/** The dead-bird rounds: each bird a stoop (or one pick for every bird within 2.5 m with the tally), then the bin. */
function deadSteps(h, c) {
  const n = c.deadPerRound, picks = h('tallyBucket') ? Math.ceil(n / 1.6) : n, out = [];
  for (let i = 0; i < picks; i++) out.push(visit(floor(-20 + (40 * (i + 0.5)) / Math.max(1, picks), i % 2 ? 2.5 : -2.5), 1));
  out.push(panel('deadBin', h('tallyBucket') ? 1 : 2));
  return out;
}
JOB_MODEL['r-dead-am'] = deadSteps; JOB_MODEL['r-dead-pm'] = deadSteps;

// ---------------- the sample jobs (the farmer's choice after the skills review: Growth 2, Brooding 2) ----------------
// the brooding floor's parts (job-next's names: west / middle / east, north and south) and the frame's parts of the house
// it reaches from the bird scale (the frame goes down on the brooding floor only), nearest the scale first
const BROOD_PARTS = [[-19.0, -2.8], [-10.7, 2.8], [-2.5, -2.8], [-19.0, 2.8], [-10.7, -2.8], [-2.5, 2.8]];
const FRAME_PARTS = [[-5.8, -2.8], [-5.8, 2.8], [1.0, -2.8], [-17.4, -2.8], [-17.4, 2.8]];
/** Chicks from the parts of the floor (`perPart` chicks a part): each caught with E, its sample taken, put back with Esc; with
 *  Next chick (Brooding 2) every chick of a part after the first comes into the hand without the panel closing. */
function chickSteps(perPart, next) {
  const out = [];
  perPart.forEach((n, i) => {
    const [x, z] = BROOD_PARTS[i];
    for (let k = 0; k < n; k++) {
      if (k > 0 && next) out.push(visit(floor(x + 0.6 * k, z), 2));                  // Next chick + the sample
      else out.push(visit(floor(x + 1.2 * k, z), 3));                                 // E, the sample, Esc
    }
    if (next && n > 1) out.push(visit(floor(x + 0.6 * n, z), 1));                     // the panel closed after the last
  });
  return out;
}
/** The hand weighing: the frame taken at the bird scale, set down in each part (E) and the frame's birds weighed (Weigh all
 *  0.4 s a bird; Weigh the frame 1 s for the frame), then the frame put back. Growth 2: 25 birds from 3 parts (10, 10, 5). */
function weighSteps(h, c) {
  if (c.handed('scale')) return [glance('birdScale')];
  const small = h('frameWeigh'), birds = small ? [10, 10, 5] : [10, 10, 10, 10, 10];
  const out = [panel('birdScale', 1)];
  birds.forEach((n, i) => { const [x, z] = FRAME_PARTS[i]; out.push(visit(floor(x, z), 1), panel(floor(x, z), 1, small ? 1 : 0.4 * n)); });
  out.push(panel('birdScale', 1));
  return out;
}
JOB_MODEL['d0-vent'] = (h) => chickSteps(h('quickSamples') ? [1, 1, 1] : [2, 2, 1], h('quickSamples'));
JOB_MODEL['d1-crop'] = (h) => chickSteps(h('quickSamples') ? [2, 2, 2] : [4, 3, 3], h('quickSamples'));
for (const id of ['d7-weigh', 'w2-weigh', 'w3-weigh', 'w45-weigh28', 'w45-weigh35', 'f-weigh']) JOB_MODEL[id] = weighSteps;

/** A default job: one visit to its spot's panel with two presses (a reading, a key), or at its place. */
const defaultSteps = (h, c, inst) => [panel(inst.def.spot && !['dead', 'heater', 'lame'].includes(inst.def.spot) ? inst.def.spot : floor(-12, 0), 2)];

// ---------------- one day, one set of skills ----------------
function makeRun() {
  const w = makeWorld();
  w.perks = createPerks({ skills: w.skills, events: w.events, allowed: true });
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const ui = { panelKind: null, setMode() {}, closePanel() {}, showResult() {}, jobCard: { refresh() {}, reset() {} }, newRun() {}, clearCaptions() {} };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} };
  const store = { data: null, available: true, save(d) { this.data = d; return true; }, load() { return this.data; }, clear() {}, loadProfile: () => null, saveProfile() {}, info() { return null; } };
  const level = createLevel({ env: w.env }, { ...w, save: store, player, flock, props, ui });
  const run = createRun({ level, save: store, events: w.events, farm: w.farm, env: w.env, records: w.records });
  return { ...w, level, run };
}
/** The instances of `day` the ideal's day makes (the routines, the dated jobs and the problems it meets), card order. */
function dayJobs(day, lvl) {
  const R = makeRun();
  for (const b of SKILL_BRANCHES) R.skills.debug.force(b.id, lvl);
  const def = levelOfDay(day);
  if (!R.run.startLevel(def.id, { from: 'standard' })) throw new Error(`standard start ${def.id}: ${R.level.result?.failText}`);
  if (day + 5.95 / 24 > R.env.day + 1e-6) R.level.debug.goto(day, 5.95, { auto: true });
  const at6 = { cols: columnsNow(R.farm, R.env), house: R.env.broodCurtain === false, dead: R.records.row?.(day - 1)?.deaths ?? null };
  R.level.debug.goto(day, 23.9, { auto: true });
  const list = R.level.jobs.list().filter((i) => i.day === day).sort((a, b) => (a.opensAt ?? 99) - (b.opensAt ?? 99));
  return { R, list, at6 };
}
/** The model of one day for one level of every branch (0 = no skills). */
export function modelDay(day, lvl) {
  const was = SKILLS_UPDATE.live;
  SKILLS_UPDATE.live = lvl > 0;
  try {
    const { R, list, at6 } = dayJobs(day, lvl);
    const h = (k) => { try { return lvl > 0 && !!R.perks.has(k); } catch { return false; } };
    let pos = PL('gate'), total = M.skipPresses * M.press;
    const jobs = [];
    for (const inst of list) {
      const parts = inst.def.variant?.parts || {};
      const c = {
        house: at6.house || day >= 10,
        offLines: (at6.cols || []).filter((x) => !x.inBand).map((x) => x.line),
        deadPerRound: Math.max(1, Math.round(((at6.dead ?? 4) || 4) / 2)),
        handed: (s) => lvl >= 3 && !!parts[s],
        nearest: (ids) => ids.reduce((b, id) => (routeM(pos, PL(id)) < routeM(pos, PL(b)) ? id : b), ids[0]),
      };
      const steps = (JOB_MODEL[inst.id] || defaultSteps)(h, c, inst);
      let walk = 0, presses = 0, rep = 0, wait = 0, glanced = 0;
      for (const s of steps) {
        const p = s.at === 'phone' ? null : typeof s.at === 'string' ? PL(s.at) : s.at;
        if (p) { walk += routeM(pos, p); pos = p; }
        presses += s.presses; rep += s.rep || 0; wait += s.wait; if (s.glance) glanced++;
      }
      const sec = walk / M.speed + presses * M.press + rep * M.repeat + wait + M.read;
      total += sec;
      jobs.push({ id: inst.id, sec: Math.round(sec * 10) / 10, walkM: Math.round(walk), presses, wait: Math.round(wait * 10) / 10, glanced, variant: inst.def.variant?.keys || [] });
    }
    return { day, lvl, min: Math.round((total / 60) * 100) / 100, sec: Math.round(total), jobs };
  } finally { SKILLS_UPDATE.live = was; }
}

// ---------------- the table ----------------
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const out = [];
  for (const day of DAYS) {
    const r = [0, 2, 3].map((lvl) => modelDay(day, lvl));
    const [n, l2, l3] = r;
    out.push({ day, none: n.min, l2: l2.min, l3: l3.min, l2Pct: Math.round((l2.sec / n.sec) * 100), l3Pct: Math.round((l3.sec / n.sec) * 100), p3: P3_MIN[day] ?? null,
      vsP3Pct: P3_MIN[day] ? Math.round(((n.min - P3_MIN[day]) / P3_MIN[day]) * 100) : null, jobs: SHOW_JOBS || JSON_OUT ? r.map((x) => x.jobs) : undefined,
      sample: SAMPLE_JOBS[day] ? r.map((x) => x.jobs.filter((j) => j.id === SAMPLE_JOBS[day]).reduce((a, j) => a + j.sec, 0)) : undefined });
    if (SHOW_JOBS) {
      console.log(`day ${day}:`);
      const ids = [...new Set(r.flatMap((x) => x.jobs.map((j) => j.id)))];
      for (const id of ids) {
        const s = r.map((x) => x.jobs.filter((j) => j.id === id).reduce((a, j) => a + j.sec, 0));
        const note = r[2].jobs.find((j) => j.id === id)?.variant?.join('+') || '';
        console.log(`  ${id.padEnd(16)} ${s.map((v) => `${v.toFixed(1).padStart(6)} s`).join('  ')}${note ? `   (${note})` : ''}`);
      }
    }
  }
  if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
  else {
    console.log('day | no skills (min) | p3-cycle | level 2 (min, % of none) | level 3 (min, % of none)');
    for (const o of out) console.log(`${String(o.day).padStart(3)} | ${o.none.toFixed(2).padStart(6)}${o.p3 ? ` (${o.vsP3Pct >= 0 ? '+' : ''}${o.vsP3Pct} % vs p3)` : ''} | ${o.p3 ?? '—'} | ${o.l2.toFixed(2)} (${o.l2Pct} %) | ${o.l3.toFixed(2)} (${o.l3Pct} %)`);
    for (const o of out) {
      const id = SAMPLE_JOBS[o.day];
      if (!id || !o.sample) continue;
      console.log(`  ${id}: ${o.sample.map((v) => `${v.toFixed(1)} s`).join(' / ')} (no skills / level 2 / level 3)`);
    }
  }
  let bad = 0;
  if (ASSERT) {
    for (const o of out) {
      if (o.p3 && Math.abs(o.vsP3Pct) > 15) { bad++; console.log(`FAIL day ${o.day}: the no-skill model ${o.none} min is ${o.vsP3Pct} % off p3-cycle's ${o.p3}`); }
      if (BANDS.l2 && o.l2Pct > BANDS.l2[o.day]) { bad++; console.log(`FAIL day ${o.day}: level 2 ${o.l2Pct} % over the band ${BANDS.l2[o.day]} %`); }
      if (BANDS.l3 && o.l3Pct > BANDS.l3[o.day]) { bad++; console.log(`FAIL day ${o.day}: level 3 ${o.l3Pct} % over the band ${BANDS.l3[o.day]} %`); }
      if (!(o.l3Pct <= o.l2Pct && o.l2Pct <= 100)) { bad++; console.log(`FAIL day ${o.day}: level 3 ${o.l3Pct} % ≤ level 2 ${o.l2Pct} % ≤ 100 % does not hold`); }
    }
    console.log(bad ? `${bad} failed` : 'all passed');
  }
  process.exit(bad ? 1 : 0);
}
void AUTO_SYSTEMS;
