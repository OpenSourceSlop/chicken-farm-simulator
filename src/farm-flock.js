// Farm model, the flock as numbers (PHASE2.md §6.3, §6.5, §6.6): delivery, boxes, placement and
// late starters, intake and growth per cohort (good / late / weak), uniformity, deaths by cause,
// culls, sick birds and droppings. Pure logic, package "sim".
import { LEVEL1, broodSector, feedStdGAt, feedPerGainAt } from './config.js';
import { mixtureStats, mixtureQuantile } from './farm-rng.js';
import { EV } from './events.js';
import { feedAccess } from './farm-feed.js';
import { GROUP_W } from './farm-comfort.js';

// model constants
export const FLOCK = {
  chickSdG: 1,            // delivery mean = 41.5 +- 1 g (seeded)
  cv: 0.08, weakCv: 0.1, weakShare: 0.008, weakWeight: 0.92, redHocks: 0.04,
  boxHazard: 0.0001, boxHazardRise: 0.0005, boxFreeH: 3,       // per hour in the boxes
  late: { base: 0.02, floor: 0.06, floorRef: 29, boxH: 0.004, flood: 0.06, water: 0.08, light: 0.03,
    sectors: 0.03, coldH: 0.01, feed: 0.4, min: 0.02, max: 0.6 },   // feed: pans out of reach or empty in the first 24 h
  lateIntakeEarly: 0.55, lateIntakeAfter: 0.8, lateEarlyAge: 3, weakIntake: 0.6,
  fpg0: 0.97, fpgPerDay: 0.03, coldGain: 0.04,
  cvBase: 0.0002, cvTemp: 0.04, cvWater: 0.01, cvFeed: 0.015,  // tuned (PHASE2.md: 0.001 / 0.01 / 0.02 / 0.015)
  cvGroup: 0.08,          // CV growth per day from the spread of the chick groups' temperature factors
  cvAir: 0.05,            // CV growth per day per unit of (1 - f_air): ammonia and wet air
  cvCaked: 0.03,          // CV growth per day per share of caked brooding floor (the chicks crowd off it)
  airFromPpm: 12, airPerPpm: 0.015, airMin: 0.5,                 // f_air = 1 - 0.015 x (NH3 - 12), >= 0.5
  hungryBelow: 0.3, hungryAfterH: 48, hungryRampH: 24, hungryRate: 0.004,  // chicks that cannot reach feed starve after 48 h
  // deaths per bird per hour
  weakRate: [[2, 0.006], [4, 0.0025], [Infinity, 0.0005]],
  starveRate: 0.001, starveFrom: 2, starveTo: 6,
  coldRate: 0.0004, coldFrom: -4, heatRate: 0.0003, heatFrom: 4,
  dehydRate: 0.0005, dehydBelow: 0.5,
  otherRate: 0.00001, otherFromDay: 3, otherPerLapse: 0.3, otherBadWater: 2.0,
  // Phase 3 (from Week 2; PHASE3.md §6.16)
  cvCycleK: 0.25, liftKeep: 0.88, liftCatchUp: 0.9,
  // Phase 3: birds that find no feed lose weight (maintenance, about 2 % of body weight a day with empty pans;
  // model, general) before they die of it, so the scale shows the drop a day or more before the deaths
  starveLossPerDay: 0.02,
};
const CAUSES = ['cold', 'heat', 'dehydration', 'weak', 'starveout', 'other', 'box'];
/** Tuning aid (node only): per-day CV terms and intake factors while on. */
export const FLOCK_DEBUG = { on: false, acc: {} };
const RATE_CAUSES = ['weak', 'starveout', 'cold', 'heat', 'dehydration', 'other'];
const RATES = new Float64Array(RATE_CAUSES.length); // reused every step (no garbage)

export function createFlock() {
  return {
    present: false, delivered: 0, inBoxes: 0, placed: 0, alive: 0, deadTotal: 0, culls: 0,
    deadByCause: Object.fromEntries(CAUSES.map((c) => [c, 0])),
    deadOnFloor: 0, sick: 0, boxDead: 0, cullsInBoxes: 0, countedDead: 0, countedByDay: {}, lapses: 0,
    chickWeightG: LEVEL1.chickWeightG, meanWeightG: LEVEL1.chickWeightG, cv: FLOCK.cv, uniformityPct: 0,
    lateStarters: 0, lateShare: null, droppings: 'normal',
    feedTodayKg: 0, waterTodayL: 0, cumFeedKg: 0, fcr: 0,
    cohorts: { good: { n: 0, w: 0, cv: FLOCK.cv }, late: { n: 0, w: 0, cv: FLOCK.cv }, weak: { n: 0, w: 0, cv: FLOCK.weakCv } },
    stacks: [],              // [{ chicks, weak, dead, acc }] still in the boxes (dead: died there, shown at the tip)
    gradeBox: [],            // the ten chicks on the sample table
    tips: { n: 0, floorDef: 0, boxH: 0, sectors: [] },
    first24: { minutes: 0, aSum: 0, floodSum: 0, reachSum: 0, coldH: 0, lightLow: 0 },
    hungryH: 0,              // hours the chicks have not reached feed (pans up, empty or out of reach)
    acc: Object.fromEntries(CAUSES.map((c) => [c, 0])),
    factors: { fT: 1, fL: 1, fF: 1, fW: 1, fAir: 1 },
    qVersion: 0,
  };
}

// Phase 2's 0.97 + 0.03a to age 14 (FLOCK.fpg0 / fpgPerDay), then config FPG_TABLE (PHASE3.md §6.1)
const fpg = (age) => (age <= 14 ? FLOCK.fpg0 + FLOCK.fpgPerDay * Math.max(0, age) : feedPerGainAt(age));
const cohortList = (fl) => [fl.cohorts.good, fl.cohorts.late, fl.cohorts.weak];

/** The chick truck: 6,000 chicks in 6 stacks of 10 boxes (weak chicks spread over the stacks). */
export function deliver(farm, env) {
  const fl = farm.flock, rng = farm.rng, L = farm.level || LEVEL1;
  fl.delivered = L.chicksPlaced; fl.inBoxes = L.chicksPlaced;
  fl.chickWeightG = L.chickWeightG + (rng.next() * 2 - 1) * FLOCK.chickSdG;
  fl.meanWeightG = fl.chickWeightG;
  const weak = Math.round(L.chicksPlaced * FLOCK.weakShare), per = L.chicksPlaced / L.stacks;
  fl.stacks = Array.from({ length: L.stacks }, () => ({ chicks: per, weak: 0, dead: 0, acc: 0 }));
  for (let k = 0; k < weak; k++) fl.stacks[rng.int(L.stacks)].weak++;
  fl.gradeBox = Array.from({ length: 10 }, () => gradeChick(fl, rng));
  for (const c of CAUSES) fl.acc[c] = rng.next(); // seeded jitter: where each death counter starts
  farm.stats.truckAt = env.day;
}

function gradeChick(fl, rng) {
  const weak = rng.next() < FLOCK.weakShare * 4; // a sample box the hatchery packed: a few more weak ones show
  const navel = weak ? (rng.next() < 0.6 ? (rng.next() < 0.5 ? 'open' : 'black button') : 'healed')
    : (rng.next() < 0.97 ? 'healed' : 'not fully closed');
  const reflexSec = +(weak ? (rng.next() < 0.7 ? rng.range(3.2, 6) : rng.range(1.5, 3)) : rng.range(0.8, 2.5)).toFixed(1);
  const hocks = rng.next() < FLOCK.redHocks ? 'red' : 'clean';
  const weightG = +(fl.chickWeightG * (weak ? FLOCK.weakWeight : 1) * (1 + FLOCK.cv * rng.normal())).toFixed(1);
  return { weak, navel, reflexSec, hocks, weightG, culled: false };
}

/** Box hazard per chick per hour after `h` hours in the boxes (share dying: 0.01 %/h for 3 h, then
 *  rising by 0.05 %/h each extra hour). */
const boxRate = (h) => Math.max(FLOCK.boxHazard, FLOCK.boxHazardRise * (h - FLOCK.boxFreeH));

/** Chicks still in the boxes: the box hazard runs while they wait (also past the placing window,
 *  so chicks never taken out die there). They are counted dead at once and show at the tip. */
export function stepBoxes(farm, env, hrs) {
  const fl = farm.flock, s = farm.stats;
  if (fl.inBoxes <= 0 || s.truckAt == null) return;
  const r = boxRate((env.day - s.truckAt) * 24) * hrs;
  for (const st of fl.stacks) {
    if (st.chicks <= 0) continue;
    st.acc = (st.acc || 0) + st.chicks * r;
    if (st.acc < 1) continue;
    const n = Math.min(st.chicks, Math.floor(st.acc));
    st.acc -= n;
    st.weak -= Math.min(st.weak, Math.round(n / 2));
    st.chicks -= n; st.dead = (st.dead || 0) + n; fl.inBoxes -= n;
    fl.boxDead += n; fl.deadTotal += n; fl.deadByCause.box += n;
  }
  syncAlive(fl);
}

/** Tip a stack onto the litter at (x, z). */
export function tip(farm, env, { stack, chicks, x, z }) {
  const fl = farm.flock, st = fl.stacks[stack];
  if (!st || st.chicks <= 0) return { placed: 0, deadInBoxes: 0 };
  const n = Math.max(0, Math.min(st.chicks, chicks ?? st.chicks));
  const h = farm.stats.truckAt != null ? (env.day - farm.stats.truckAt) * 24 : 0;
  const dead = st.dead || 0; // died in these boxes while they waited (stepBoxes), found now
  const weak = Math.min(st.weak, Math.round((st.weak * n) / st.chicks));
  st.chicks -= n; st.weak -= weak; fl.inBoxes -= n; st.dead = 0;
  const live = n, liveWeak = weak;
  const tFloor = env.floorTemp(x, z);
  const t = fl.tips;
  t.floorDef += live * Math.max(0, FLOCK.late.floorRef - tFloor); t.boxH += live * h; t.n += live;
  const sec = broodSector(x, z); if (!t.sectors.includes(sec)) t.sectors.push(sec);
  // live chicks into the cohorts (late share from the running estimate, settled over 24 h)
  const c = fl.cohorts, w0 = fl.chickWeightG;
  addBirds(c.weak, liveWeak, w0 * FLOCK.weakWeight);
  const rest = live - liveWeak, L = lateEstimate(farm, env);
  addBirds(c.late, rest * L, w0); addBirds(c.good, rest * (1 - L), w0);
  fl.placed += live;
  syncAlive(fl);
  fl.present = true;
  if (farm.stats.firstTipAt == null) firstTip(farm, env);
  if (fl.inBoxes <= 0) farm.stats.lastTipAt = env.day;
  if (dead > 0) farm.emit(EV.FARM_DEATH, { n: dead, cause: 'box', inBoxes: true });
  farm.emit(EV.FARM_PLACED, { chicks: live, x, z, minutesInBox: Math.round(h * 60), stack });
  return { placed: live, deadInBoxes: dead };
}

function firstTip(farm, env) {
  const s = farm.stats;
  s.firstTipAt = env.day;
  s.floorShareAtFirstTip = farm.floorShare28();
  s.heightsAtFirstTip = farm.water.lines.map((l) => l.heightCm);
  farm.water.quality = farm.water.flushedAt != null && s.truckAt - farm.water.flushedAt <= 1 && farm.water.flushedAt <= s.truckAt + 1e-9 ? 1 : 0.85;
}

function addBirds(c, n, w) {
  if (n <= 0) return;
  c.w = c.n + n > 0 ? (c.n * c.w + n * w) / (c.n + n) : w;
  c.n += n;
}
function moveBirds(from, to, n) {
  n = Math.min(n, from.n);
  if (n <= 0) return;
  addBirds(to, n, from.w); from.n -= n;
}

/** Late starter share L from what happened so far in the first 24 h (PHASE2.md §6.3). */
export function lateEstimate(farm, env) {
  const fl = farm.flock, K = FLOCK.late, t = fl.tips, f = fl.first24;
  if (fl.lateShare != null) return fl.lateShare;
  const n = Math.max(1, t.n);
  const A = f.minutes > 0 ? f.aSum / f.minutes : farm.water.access;
  const flooded = f.minutes > 0 ? f.floodSum / f.minutes : farm.feed.lines.filter((l) => l.flood).length / farm.feed.lines.length;
  if (f.minutes <= 0) feedAccess(farm.feed, farm.age, env.dayNumber);
  const reach = f.minutes > 0 ? f.reachSum / f.minutes : farm.feed.reach;
  const litH = 24 - (env.lightProgram?.darkHours ?? 1);
  const L = K.base + K.floor * (t.floorDef / n) + K.boxH * (t.boxH / n) + K.flood * (1 - flooded)
    + K.water * (1 - A) + K.light * (litH < 20 ? 1 : 0) + K.sectors * (fl.inBoxes <= 0 && t.sectors.length < 3 ? 1 : 0)
    + K.coldH * f.coldH + K.feed * (1 - Math.min(1, reach));
  return Math.max(K.min, Math.min(K.max, L));
}

/**
 * Phase 3: `n` birds die of `cause` now (the cycle's causes: sds, legs, disease, respiratory; heat and cold
 * from the house model): out of the cohorts, counted, on the floor, EV.FARM_DEATH. Returns the number.
 */
export function killBirds(farm, n, cause) {
  const fl = farm.flock;
  n = Math.min(Math.floor(n), Math.floor(fl.alive));
  if (!(n > 0)) return 0;
  removeDead(fl, n, cause);
  fl.deadTotal += n; fl.deadByCause[cause] = (fl.deadByCause[cause] || 0) + n; fl.deadOnFloor += n;
  const by = fl.floorByCause || (fl.floorByCause = {});
  by[cause] = (by[cause] || 0) + n;
  syncAlive(fl);
  farm.emit(EV.FARM_DEATH, { n, cause });
  return n;
}

/** Remove `n` birds of a cause: weak / starve-out from their cohort, the rest from all alike. */
function removeDead(fl, n, cause) {
  const c = fl.cohorts;
  if (cause === 'weak') { c.weak.n = Math.max(0, c.weak.n - n); return; }
  if (cause === 'starveout') { const t = Math.min(n, c.late.n); c.late.n -= t; n -= t; if (n <= 0) return; } // late starters first
  const all = c.good.n + c.late.n + c.weak.n;
  if (all <= 0) return;
  for (const k of cohortList(fl)) k.n = Math.max(0, k.n - (n * k.n) / all);
}

/** Culls: weak chicks at the table, sick birds on the floor (they leave the cohort that would die). */
export function cull(farm, { n = 1, reason = 'sick', index } = {}) {
  const fl = farm.flock;
  n = Math.max(0, Math.round(n));
  if (!n) return false;
  if (reason === 'grading' && index != null && fl.gradeBox[index]) fl.gradeBox[index].culled = true;
  const sample = index != null && reason === 'grading' ? fl.gradeBox[index] : null;
  if (reason === 'grading' && fl.inBoxes > 0) {
    // still in the boxes: out of a stack (out of its weak chicks when the sample chick was weak)
    const weak = !sample || sample.weak;
    const st = fl.stacks.find((s) => s.chicks >= n && (!weak || s.weak > 0)) || fl.stacks.find((s) => s.chicks >= n);
    if (!st) return false;
    st.chicks -= n; fl.inBoxes -= n;
    if (weak && st.weak > 0) st.weak -= Math.min(st.weak, n);
    fl.culls += n; fl.cullsInBoxes += n;
    return true;
  }
  const c = fl.cohorts;
  let left = n;
  const order = sample && !sample.weak ? [c.good, c.late, c.weak] : [c.weak, c.late, c.good];
  for (const k of order) { const t = Math.min(left, k.n); k.n -= t; left -= t; }
  fl.culls += n;
  const by = fl.cullsBy || (fl.cullsBy = {});
  by[reason] = (by[reason] || 0) + n;
  syncAlive(fl);
  return true;
}

/** Live birds on the litter: placed - deaths after placing - culls after placing (integers). */
export function syncAlive(fl) {
  fl.alive = Math.max(0, fl.placed - (fl.deadTotal - fl.boxDead) - (fl.culls - fl.cullsInBoxes) - (fl.caught || 0)); // Phase 3: caught at the harvest
}

const weakRate = (age) => FLOCK.weakRate.find(([to]) => age < to)[1];

/**
 * One step of the placed flock. `C` = comfortNow(). Returns { eatenKg, drunkL } for the equipment.
 * Feed comes from the pans (farm-feed eat), water through the lines (farm-water drink).
 */
export function stepFlock(farm, env, hrs, C, io) {
  const fl = farm.flock, c = fl.cohorts, age = farm.age, s = farm.stats;
  // ---- factors (PHASE2.md §6.5) ----
  // temperature per chick group (one per brooder; in week 1 the chicks stay under their own
  // brooder): the cold side from each group's e, averaged over the chicks; the spread between the
  // groups makes the flock less even. The hot side from the whole floor (they move away from heat).
  // Phase 3 (from Week 2, farm.cyc.on): the whole house's comfort (farm-house.js: the cold side per 6 m
  // strip of the floor in use, the hot side as f_heat), the new light factor and the cycle's factors
  const X = farm.cyc && farm.cyc.on ? farm.cyc : null;
  const eG = X ? C.eZ : C.eG, W = X ? C.wZ : GROUP_W;
  let fTc = 0, fTsq = 0, gainC = 0, coldG = 0, coldSq = 0;
  for (let i = 0; i < W.length; i++) {
    const w = W[i];
    if (!(w > 0)) continue;
    const e = eG ? eG[i] : C.e;
    const def = Math.max(0, -1.5 - e), ft = Math.max(0.2, 1 - 0.12 * def);
    fTc += w * ft; fTsq += w * ft * ft;
    gainC += w * Math.max(0, 1 - FLOCK.coldGain * def);
    if (e < -2) coldG += w;
    if (e < FLOCK.coldFrom) coldSq += w * (FLOCK.coldFrom - e) ** 2;
  }
  const fTsd = Math.sqrt(Math.max(0, fTsq - fTc * fTc));
  let fT = fTc;
  if (!X && C.meanOver > 1.5) fT *= 1 - 0.08 * (C.meanOver - 1.5);
  fT = Math.max(0.2, Math.min(1, fT));
  const lp = env.lightProgram || { darkHours: 1 };
  const darkH = Math.max(0, lp.darkHours || 0), litH = Math.max(1, 24 - darkH);
  const fL = X ? (1 - 0.01 * Math.max(0, darkH - 4) - 0.03 * Math.max(0, darkH - 8)) * (farm.luxLit() < 10 ? 0.95 : 1)
    : Math.min(1, (farm.luxLit() < 20 ? 0.9 : 1) * (1 - 0.04 * (darkH - 1)));
  const fF = io.feedAccess;
  const A = farm.water.access, fW = Math.pow(Math.max(0, A), 0.8);
  const fAir = Math.max(FLOCK.airMin, 1 - FLOCK.airPerPpm * Math.max(0, farm.litter.ammoniaPpm - FLOCK.airFromPpm));
  const FX = fl.factors; FX.fT = fT; FX.fL = fL; FX.fF = fF; FX.fW = fW; FX.fAir = fAir;
  const f = fT * fL * fF * fW * fAir * (X ? X.fx.f : 1);
  // ---- intake, spread over the lit hours ----
  const lit = env.lightsOn ? 24 / litH : 0;
  const std = feedStdGAt(age) / 1000 * (hrs / 24) * lit;  // kg per bird this step at full rate
  const lateK = age < FLOCK.lateEarlyAge ? FLOCK.lateIntakeEarly : FLOCK.lateIntakeAfter;
  const wGood = c.good.n * std * f, wLate = c.late.n * std * f * lateK, wWeak = c.weak.n * std * f * FLOCK.weakIntake;
  const wantKg = wGood + wLate + wWeak;
  let gotKg = wantKg > 0 ? io.eat(wantKg) : 0;
  // Phase 3: feed missed while the feeders were lifted in the heat is eaten back after (88 % of it, PHASE3.md §6.6)
  if (X) {
    const S = X.lift || (X.lift = { debtKg: 0 });
    if (X.liftOn) {
      const full = (c.good.n + c.late.n * lateK + c.weak.n * FLOCK.weakIntake) * std * fT * fL * fW * fAir * X.fx.f * Math.min(1, X.fFPrev ?? 1);
      S.debtKg = Math.min(S.debtKg + Math.max(0, full - gotKg), (fl.alive * feedStdGAt(age)) / 1000);
    } else if (S.debtKg > 0 && wantKg > 0) {
      const extra = io.eat(Math.min(S.debtKg * FLOCK.liftKeep, FLOCK.liftCatchUp * wantKg));
      S.debtKg = Math.max(0, S.debtKg - extra / FLOCK.liftKeep); gotKg += extra;
    }
  }
  const k = wantKg > 0 ? gotKg / wantKg : 0;
  const gainK = (1000 * k * gainC) / (fpg(age) * (X ? X.fx.fpgK : 1));
  if (c.good.n > 0) c.good.w += (wGood / c.good.n) * gainK;
  if (c.late.n > 0) c.late.w += (wLate / c.late.n) * gainK;
  if (c.weak.n > 0) c.weak.w += (wWeak / c.weak.n) * gainK;
  // Phase 3: no feed in the pans (not the withdrawal before catching, not the heat-wave lift): weight goes down
  // (the share of the birds that find feed: the pans' reach, then what the pans held of what they wanted)
  const fed = Math.min(1, farm.feed.reach ?? 1) * (wantKg > 0 ? Math.min(1, k) : 1);
  if (X && lit > 0 && fed < 0.98 && !farm.feed.withdrawn && !X.liftOn) {
    const loss = Math.min(0.5, FLOCK.starveLossPerDay * (1 - fed) * (hrs / 24) * lit);
    for (const g of [c.good, c.late, c.weak]) if (g.n > 0) g.w *= 1 - loss;
  }
  const fEff = f * (wantKg > 0 ? k : 1);
  // Phase 3: older birds' spread grows less from the same stress (model: Phase 2's terms x cvCycleK from Week 2)
  const dcv = (FLOCK.cvBase + (FLOCK.cvTemp * (1 - fT) + FLOCK.cvGroup * fTsd + FLOCK.cvWater * (1 - A)
    + FLOCK.cvFeed * (1 - Math.min(1, fF * (wantKg > 0 ? Math.min(1, k) : 1))) + FLOCK.cvCaked * (farm.litter.cakedShare || 0) + FLOCK.cvAir * (1 - fAir)) * (X ? FLOCK.cvCycleK : 1)
    + (X ? X.fx.dcv : 0)) * (hrs / 24);
  c.good.cv += dcv; c.late.cv += dcv; c.weak.cv += dcv;
  if (FLOCK_DEBUG.on && X) {
    const D = FLOCK_DEBUG.acc[env.dayNumber] || (FLOCK_DEBUG.acc[env.dayNumber] = { temp: 0, group: 0, water: 0, feed: 0, caked: 0, air: 0, crowd: 0, f: 0, n: 0, fT: 0, fF: 0, fW: 0, fAir: 0, fL: 0, fx: 0, k: 0 });
    const w = hrs / 24;
    D.temp += FLOCK.cvTemp * (1 - fT) * w; D.group += FLOCK.cvGroup * fTsd * w; D.water += FLOCK.cvWater * (1 - A) * w;
    D.feed += FLOCK.cvFeed * (1 - Math.min(1, fF * (wantKg > 0 ? k : 1))) * w; D.caked += FLOCK.cvCaked * (farm.litter.cakedShare || 0) * w;
    D.air += FLOCK.cvAir * (1 - fAir) * w; D.crowd += X.fx.dcv * w;
    if (env.lightsOn) { D.n++; D.f += f; D.fT += fT; D.fF += fF; D.fW += fW; D.fAir += fAir; D.fL += fL; D.fx += X.fx.f; D.k += wantKg > 0 ? k : 1; }
  }
  fl.cumFeedKg += gotKg; fl.feedTodayKg += gotKg;
  const drunkL = gotKg * io.waterPerKg;
  fl.waterTodayL += drunkL;
  // ---- first 24 h after the first tip: what decides the late starters ----
  if (fl.lateShare == null && s.firstTipAt != null) {
    const F = fl.first24, m = hrs * 60;
    F.minutes += m; F.aSum += A * m;
    F.floodSum += (farm.feed.lines.filter((l) => l.flood && l.kg > 1).length / farm.feed.lines.length) * m;
    F.reachSum = (F.reachSum || 0) + Math.min(1, farm.feed.reach) * m;
    F.coldH += hrs * coldG;
    const L = lateEstimate(farm, env), nonWeak = c.good.n + c.late.n, want2 = L * nonWeak;
    if (want2 > c.late.n) moveBirds(c.good, c.late, want2 - c.late.n); else moveBirds(c.late, c.good, c.late.n - want2);
    if (env.day - s.firstTipAt >= 1) {
      fl.lateShare = L;
      s.cropFillTrue = Math.max(0, 1 - L - 0.5 * (c.weak.n / Math.max(1, c.good.n + c.late.n + c.weak.n)));
    }
  }
  // ---- deaths (expected per hour, fractional counters per cause) ----
  const alive = c.good.n + c.late.n + c.weak.n;
  const rates = RATES;
  rates[0] = c.weak.n * weakRate(age);
  // chicks that cannot reach feed (pans winched up, empty): they live on the yolk, then starve
  const hungry = fF < FLOCK.hungryBelow || (wantKg > 0 && k < FLOCK.hungryBelow);
  fl.hungryH = hungry ? (fl.hungryH || 0) + hrs : Math.max(0, (fl.hungryH || 0) - 2 * hrs);
  const starving = fl.hungryH > FLOCK.hungryAfterH ? alive * FLOCK.hungryRate * Math.min(1, (fl.hungryH - FLOCK.hungryAfterH) / FLOCK.hungryRampH) : 0;
  rates[1] = (age >= FLOCK.starveFrom && age < FLOCK.starveTo ? c.late.n * FLOCK.starveRate : 0) + starving;
  rates[2] = alive * FLOCK.coldRate * coldSq;
  // Phase 3: heat deaths per cell of the floor in use (farm-heat.heatDeathRate through farm-house.js)
  rates[3] = X ? alive * (C.heatDeathPerH || 0) : C.meanOver > FLOCK.heatFrom ? alive * FLOCK.heatRate * (C.meanOver - FLOCK.heatFrom) ** 2 : 0;
  rates[4] = A < FLOCK.dehydBelow ? alive * FLOCK.dehydRate * ((FLOCK.dehydBelow - A) / FLOCK.dehydBelow) * (X ? X.fx.dehydK : 1) : 0;
  rates[5] = env.dayNumber >= FLOCK.otherFromDay ? alive * FLOCK.otherRate * (1 + FLOCK.otherPerLapse * fl.lapses) * (farm.water.quality < 1 ? FLOCK.otherBadWater : 1) * (X ? X.fx.otherK : 1) : 0;
  let next12 = 0;
  for (let ci = 0; ci < RATE_CAUSES.length; ci++) {
    const cause = RATE_CAUSES[ci], r = rates[ci];
    next12 += r * 12;
    if (r <= 0) continue;
    fl.acc[cause] += r * hrs;
    if (fl.acc[cause] >= 1) {
      const n = Math.min(Math.floor(fl.acc[cause]), Math.floor(alive));
      fl.acc[cause] -= n;
      if (n > 0) {
        removeDead(fl, n, cause);
        fl.deadTotal += n; fl.deadByCause[cause] += n; fl.deadOnFloor += n;
        if (X) { const by = fl.floorByCause || (fl.floorByCause = {}); by[cause] = (by[cause] || 0) + n; }
        farm.emit(EV.FARM_DEATH, { n, cause });
      }
    }
  }
  // Phase 3: the cycle's causes (sudden death, disease, breathing) from farm-health.js, per bird-hour
  if (X) for (const cause in X.rates) {
    const r = X.rates[cause] * alive;
    next12 += r * 12;
    if (!(r > 0)) continue;
    fl.acc[cause] = (fl.acc[cause] || 0) + r * hrs;
    if (fl.acc[cause] >= 1) { const n = Math.floor(fl.acc[cause]); fl.acc[cause] -= n; killBirds(farm, n, cause); }
  }
  syncAlive(fl);
  fl.sick = Math.min(24, Math.round(next12));
  // ---- what the litter shows, comfort minutes for the stats ----
  const ratio = io.waterPerKg;
  fl.droppings = X ? X.droppings : C.meanOver > 2 || ratio > 2.0 ? 'watery' : fEff < 0.7 && env.lightsOn ? 'few' : 'normal';
  if (age >= 0 && age < 7) {
    const m = hrs * 60, ok = m * C.groupShare; // the chicks whose group is in the comfort band
    s.levelMinutes += m; s.comfortMinutes += ok;
    const d = env.dayNumber;
    const byDay = s.comfortByDay || (s.comfortByDay = []);
    const row = byDay[d] || (byDay[d] = [0, 0]);
    row[0] += ok; row[1] += m;
    s.comfortShareByDay[d] = +(row[0] / row[1]).toFixed(4);
  }
  updateWeights(fl);
  // breath: the water the birds turn over at their intake, also when the lines limit them (they dry out)
  return { eatenKg: gotKg, drunkL, breathL: drunkL / Math.max(0.3, fW) };
}

/** Flock mean, CV and uniformity from the cohort mixture. */
export function updateWeights(fl) {
  const m = mixtureStats(cohortList(fl));
  if (m.n > 0) { fl.meanWeightG = m.mean; fl.cv = m.cv; fl.uniformityPct = 100 * m.uniformity; }
  fl.lateStarters = Math.round(fl.cohorts.late.n);
  fl.qVersion++;
}

/** weightQuantile(u) with a small table rebuilt only when the flock changed. */
export function makeQuantile(fl) {
  let ver = -1, table = null;
  return (u) => {
    if (fl.placed <= 0) return fl.meanWeightG;
    if (ver !== fl.qVersion) {
      ver = fl.qVersion;
      table = Array.from({ length: 33 }, (_, i) => mixtureQuantile(cohortList(fl), i / 32));
    }
    const x = Math.max(0, Math.min(1, u)) * 32, i = Math.min(31, Math.floor(x));
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
}

/**
 * The k-th bird of a hand weigh-in (model), grams: a stratified draw over the flock's weight mixture.
 * Bird k sits at the quantile frac(offset + k x 0.618...) (a golden-ratio sequence, a little jitter),
 * so 50 birds from five frames spread over the flock as the flock itself does: the sample's mean and
 * uniformity stay within a few points of the model's. (A plain random draw of 50 strays about
 * +-6 points of uniformity, and seed 1 read 68 % against the model's 73 %.)
 */
export function weighInBird(fl, rng, k, offset) {
  const u = (((offset + k * 0.6180339887 + (rng.next() - 0.5) * 0.015) % 1) + 1) % 1;
  return Math.max(10, mixtureQuantile(cohortList(fl), Math.min(0.995, Math.max(0.005, u))));
}

/** One live bird of the flock (cohort by share, normal within it), grams. */
export function drawBird(fl, rng) {
  const cs = cohortList(fl), n = cs.reduce((a, k) => a + Math.max(0, k.n), 0);
  let r = rng.next() * n, co = cs[0];
  for (const k of cs) { if (k.n <= 0) continue; co = k; if ((r -= k.n) <= 0) break; }
  return Math.max(10, co.w * (1 + co.cv * rng.normal()));
}
