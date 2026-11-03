// Farm model, health from Week 2 (PHASE3.md §6.5, §6.7): vaccination in the drinking water, Gumboro
// after a poor vaccination, coccidiosis and its medicine, breathing (ammonia, dust), sudden death and
// lame birds, and the bird check's readings. Pure logic, package "sim". The cycle's death rates go to
// farm.cyc.rates (farm-flock.js integrates them), the intake factor to farm.cyc.fx (f_health).
import { feedStdGAt, weightAt } from './config.js';
import { killBirds, drawBird } from './farm-flock.js';
import { zoneOfX } from './farm-heat.js';

// model constants (PHASE3.md §6.5, §6.7; tuning log §6.16)
export const HEALTH = {
  linesL: 85,                    // plain water standing in the four drinker lines (drunk first when the main stayed open)
  tankHours: 2,                  // the header tank takes 2 h of today's water at the plate's rate
  thirstBoost: 0.2, thirstMaxH: 2, dryAfterH: 0.5,
  cov: { base: 0.97, perHourOver2: 0.07, shortThirst: 0.15, shortThirstH: 0.75, noStabiliser: 0.15, access: 0.3, noWalk: 0.1, walkShare: 0.3, min: 0.3, max: 0.99 },
  gumboro: { below: 0.85, span: 0.45, days: 5, ratePerH: 0.00008, intakeK: 0.35 },
  cocci: { ratePerH: 0.00012, growthPerDay: 1.5, litterRef: 28, litterPer: 10, perLapse: 0.05, treatHours: 24, intakeK: 0.15, intakeMaxG: 2, minSev: 0.6 },
  resp: { nh3: 25, dust: 1.5, riseH: 6, fallH: 24, ratePerH: 0.00002, intakeK: 0.03 },
  sds: { ratePerH: 4.5e-6, fromAge: 8, toAge: 42 },
  lame: { ratePerH: 8e-6, fromAge: 10, toAge: 42, dieAfterH: 72, litterFrom: 30 },
};
const H = 1 / 24;

export function createHealth() {
  return {
    vaccine: { state: 'none', thirstFrom: null, mixedAt: null, startAt: null, drunkAt: null, hours: null, stabiliser: false, coverage: null,
      tankL: 0, linesL: 0, thirstH: 0, accSum: 0, accN: 0, walked: 0 },
    medication: { on: false, from: null, days: 0, onH: 0 },
    disease: { gumboro: 0, cocci: 0 },
    gumboroAt: null, cocciAt: null, cocciTreatedAt: null, cocciPeak: 0, cocciSev0: 0,
    resp: 0,                       // respiratory risk 0..1 (share of birds with a rattle)
    vet: [],                       // vet advice letters [{ day, reason }]
    lame: [],                      // lame birds on the floor: their onset (env.day)
    acc: { lame: 0 },
    gain: { w: [], g: 1 },         // mean weight at each whole hour (last 25 h) -> g = gain / the target curve's gain
    zoneDays: [],                  // [{ day, e: [8], m: [8] }] daily means of each 6 m strip (last 8 days)
    zoneAcc: null,
    mainClosed: false,
  };
}

const hump = (t, days) => (t > 0 && t < days ? Math.sin((Math.PI * t) / days) : 0);
const darkHours = (env) => Math.max(0, (env.lightProgram && env.lightProgram.darkHours) || 0);

/** Gumboro severity now (0..1 x the hump) and its share. */
export function gumboroNow(h, env) {
  if (h.gumboroAt == null) return 0;
  const G = HEALTH.gumboro, cov = h.vaccine.coverage ?? 0.3;
  return Math.max(0, (G.below - cov) / G.span) * hump(env.day - h.gumboroAt, G.days);
}
/** Coccidiosis rate factor now: 1.5^days untreated, decaying to 0 over treatHours once the medicine is on. */
export function cocciNow(h, env) {
  if (h.cocciAt == null) return 0;
  const C = HEALTH.cocci;
  if (h.cocciTreatedAt != null) return Math.max(0, h.cocciPeak * (1 - ((env.day - h.cocciTreatedAt) * 24) / C.treatHours));
  return h.cocciSev0 * Math.pow(C.growthPerDay, env.day - h.cocciAt);
}

/** Start Gumboro (the farm's problem tick decides: day 18 06:00, coverage under 0.85). */
export function startGumboro(farm, env) { farm.health.gumboroAt = env.day; }
/** Start coccidiosis (day 19 05:00): severity from the litter and the biosecurity lapses. */
export function startCocci(farm, env) {
  const C = HEALTH.cocci, h = farm.health;
  h.cocciAt = env.day;
  h.cocciSev0 = Math.max(C.minSev, (1 + (farm.litter.meanMoisturePct - C.litterRef) / C.litterPer) * (1 + C.perLapse * (farm.flock.lapses || 0)));
}

/**
 * One health step (cycle mode). Sets farm.cyc.rates (per bird-hour), farm.cyc.fx.fHealth and the flock's
 * main droppings look; integrates lame birds and the vaccine in the drinking water (drunkL this step).
 */
export function stepHealth(farm, env, hrs, age, drunkL) {
  const h = farm.health, fl = farm.flock, X = farm.cyc, R = X.rates;
  // ---- growth speed g (sudden death and lame birds rise with it) ----
  const gw = h.gain;
  const hourNow = Math.floor(env.day * 24 + 1e-6);
  if (gw.hour !== hourNow) {
    gw.hour = hourNow; gw.w.push(fl.meanWeightG); if (gw.w.length > 25) gw.w.shift();
    if (gw.w.length >= 25) { const target = weightAt(age) - weightAt(age - 1); gw.g = Math.max(0.5, Math.min(1.5, (gw.w[24] - gw.w[0]) / Math.max(1, target))); }
  }
  const g = gw.g, dark = darkHours(env);
  // ---- sudden death (on its back) ----
  const S = HEALTH.sds;
  R.sds = age >= S.fromAge && age <= S.toAge ? S.ratePerH * (1 + Math.max(0, 4 - dark)) * g : 0;
  // ---- lame birds: new ones, the ones that die after 72 h ----
  const Lm = HEALTH.lame;
  if (age >= Lm.fromAge && age <= Lm.toAge && fl.alive > 0) {
    const r = Lm.ratePerH * (1 + 0.5 * Math.max(0, 4 - dark)) * (1 + 0.1 * Math.max(0, farm.litter.meanMoisturePct - Lm.litterFrom)) * g;
    h.acc.lame += r * fl.alive * hrs;
    while (h.acc.lame >= 1) { h.acc.lame -= 1; h.lame.push(+env.day.toFixed(5)); }
  }
  while (h.lame.length && env.day - h.lame[0] >= Lm.dieAfterH * H - 1e-9) { h.lame.shift(); killBirds(farm, 1, 'legs'); }
  fl.lameOnFloor = h.lame.length;
  // ---- respiratory risk from ammonia and dust ----
  const P = HEALTH.resp, air = farm.air;
  if (air.ammoniaPpm > P.nh3 || air.dustIndex > P.dust) h.resp = Math.min(1, h.resp + hrs / P.riseH);
  else h.resp = Math.max(0, h.resp - hrs / P.fallH);
  R.respiratory = P.ratePerH * h.resp;
  // ---- Gumboro, coccidiosis ----
  const gum = gumboroNow(h, env), coc = cocciNow(h, env);
  h.disease.gumboro = +gum.toFixed(4); h.disease.cocci = +Math.min(1, coc / 2).toFixed(4);
  R.disease = HEALTH.gumboro.ratePerH * gum + HEALTH.cocci.ratePerH * coc;
  const med = h.medication;
  if (med.on) med.onH += hrs;
  if (h.cocciAt != null && h.cocciTreatedAt == null && med.on) { h.cocciPeak = coc; h.cocciTreatedAt = env.day; }
  // ---- the vaccine in the drinking water ----
  stepVaccine(farm, env, hrs, drunkL);
  // ---- intake and the droppings look ----
  const fh = (1 - HEALTH.gumboro.intakeK * gum) * (1 - HEALTH.cocci.intakeK * Math.min(HEALTH.cocci.intakeMaxG, coc)) * (1 - P.intakeK * h.resp);
  X.fx.fHealth = Math.max(0.5, fh);
  X.droppings = coc > 0.3 ? 'bloody' : gum > 0.25 ? 'white' : X.shockUntil != null && env.day < X.shockUntil ? 'undigested'
    : farm.comfort.pantShare > 0.3 || (X.waterPerKg ?? 0) > 2.0 ? 'watery' : 'normal';
  // ---- daily means of each 6 m strip (feathers, feet at the bird check) ----
  const C = farm.comfort, za = h.zoneAcc || (h.zoneAcc = { day: env.dayNumber, e: new Array(8).fill(0), m: new Array(8).fill(0), n: new Array(8).fill(0) });
  if (za.day !== env.dayNumber) {
    h.zoneDays.push({ day: za.day, e: za.e.map((v, i) => (za.n[i] ? +(v / za.n[i]).toFixed(2) : null)), m: za.m.map((v, i) => (za.n[i] ? +(v / za.n[i]).toFixed(1) : null)) });
    if (h.zoneDays.length > 8) h.zoneDays.shift();
    h.zoneAcc = { day: env.dayNumber, e: new Array(8).fill(0), m: new Array(8).fill(0), n: new Array(8).fill(0) };
  } else if (C.eZ) {
    const zm = X.zoneMoisture || [];
    for (let z = 0; z < 8; z++) if (Number.isFinite(C.eZ[z])) { za.e[z] += C.eZ[z] * hrs; za.m[z] += (zm[z] ?? farm.litter.meanMoisturePct) * hrs; za.n[z] += hrs; }
  }
}

function stepVaccine(farm, env, hrs, drunkL) {
  const v = farm.health.vaccine;
  if (v.state === 'drinking') {
    let drink = drunkL * (1 + HEALTH.thirstBoost * Math.min(HEALTH.thirstMaxH, v.thirstH));
    const fromLines = Math.min(v.linesL, drink); v.linesL -= fromLines; drink -= fromLines;
    v.tankL = Math.max(0, v.tankL - drink);
    v.accSum += farm.water.access * hrs; v.accN += hrs;
    if (v.tankL <= 1e-6) {
      v.state = 'drunk'; v.drunkAt = env.day; v.hours = +((env.day - v.startAt) * 24).toFixed(2);
      v.coverage = vaccineCoverage(v);
    }
  }
}

/** The vaccine's coverage (model, PHASE3.md §6.7; never shown: the record shows the hours). */
export function vaccineCoverage(v) {
  const K = HEALTH.cov, T = v.hours ?? 0, acc = v.accN > 0 ? v.accSum / v.accN : 1;
  const c = K.base - K.perHourOver2 * Math.max(0, T - 2) - (v.thirstH < K.shortThirstH ? K.shortThirst : 0) - (v.stabiliser ? 0 : K.noStabiliser)
    - K.access * (1 - Math.min(1, acc)) - (v.walked < K.walkShare ? K.noWalk : 0);
  return +Math.max(K.min, Math.min(K.max, c)).toFixed(3);
}

/** Today's water at the plate's rate for `hours` of lit drinking (the header tank). */
export function tankLitres(farm, env, age, hours = HEALTH.tankHours) {
  const lit = Math.max(1, 24 - darkHours(env));
  return Math.round(((farm.flock.alive * feedStdGAt(age)) / 1000) * 1.75 * (hours / lit));
}

/** Vaccination actions (water.main, vaccine.mix). Returns the action result. */
export function vaccineAct(farm, env, id, a, age) {
  const v = farm.health.vaccine, h = farm.health;
  if (id === 'water.main') {
    const open = !!a.open;
    if (!open) {
      h.mainClosed = true; farm.water.mainClosed = true;
      if (v.state === 'none') { v.state = 'thirst'; v.thirstFrom = env.day; }
    } else {
      h.mainClosed = false; farm.water.mainClosed = false;
      if (v.state === 'mixed') startDrinking(farm, env);
      else if (v.state === 'thirst') { v.state = 'none'; v.thirstFrom = null; }
    }
    return true;
  }
  if (id === 'vaccine.mix') {
    if (v.state === 'none' || v.state === 'thirst') {
      v.mixedAt = env.day; v.stabiliser = !!a.stabiliser; v.tankL = tankLitres(farm, env, age);
      v.state = 'mixed';
      if (!h.mainClosed) startDrinking(farm, env); // the main stayed open: the lines drink their plain water first
    }
    return { litres: v.tankL };
  }
  return undefined;
}

function startDrinking(farm, env) {
  const v = farm.health.vaccine;
  v.thirstH = v.thirstFrom != null ? Math.max(0, (env.day - v.thirstFrom) * 24) : 0;
  const dry = Math.min(1, v.thirstH / HEALTH.dryAfterH);
  v.linesL = HEALTH.linesL * (1 - dry);
  v.state = 'drinking'; v.startAt = env.day; v.accSum = 0; v.accN = 0; v.walked = 0;
}

/** The farmer walked these cells while the birds drank the vaccine (share of the 576 cells). */
export function vaccineWalk(farm, share) {
  const v = farm.health.vaccine;
  if (v.state === 'drinking') v.walked = Math.min(1, v.walked + share);
}

/**
 * A bird in the hand (sample.bird, PHASE3.md §6.12): { look, value }. a.lame / the picked bird's purpose
 * 'lame': one of the lame birds.
 */
export function sampleBird(farm, env, a, age) {
  const rng = farm.rng, look = a.look || 'gait', h = farm.health, fl = farm.flock, X = farm.cyc;
  const lame = !!a.lame || (farm.inHand && farm.inHand.lame && (a.index == null || a.index === farm.inHand.index));
  const zone = zoneOfX(a.x ?? 0), C = farm.comfort;
  const week = h.zoneDays.slice(-7);
  const zMean = (k) => { const v = week.map((d) => d[k][zone]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  switch (look) {
    case 'gait': {
      if (lame) return { look, value: rng.next() < 0.5 ? 4 : 5 };
      const p12 = 0.25 + (h.gain.g > 1.1 ? 0.25 : 0), r = rng.next();
      return { look, value: r < p12 * 0.7 ? 1 : r < p12 ? 2 : 0 };
    }
    case 'feathers': {
      const e = zMean('e') ?? C.e ?? 0, hf = C.hotFrom ?? 2;
      const crowded = (X.crowdWeek ?? 0) > 1.2;
      return { look, value: crowded && (e < -1.5 || e > hf) ? 'poor' : e < -1.5 || e > hf || crowded ? 'patchy' : 'good' };
    }
    case 'feet': {
      const m = zMean('m') ?? farm.litter.meanMoisturePct;
      return { look, value: m > 38 ? 2 : m > 30 ? 1 : 0 };
    }
    case 'breathing': {
      const air = farm.air, r = rng.next();
      const value = air.dustIndex > 1.5 || air.ammoniaPpm > 25 || r < h.resp ? 'rattle' : air.dustIndex > 1 || air.ammoniaPpm > 15 ? 'snick' : 'quiet';
      return { look, value };
    }
    case 'droppings': {
      const r = rng.next(), coc = cocciNow(h, env), gum = gumboroNow(h, env);
      const wettest = X.wettestZone ?? 0;
      const pBlood = coc > 0.05 ? Math.min(0.9, 0.35 + (zone === wettest ? 0.25 : 0) + 0.1 * coc) : 0;
      if (r < pBlood) return { look, value: 'bloody' };
      const r2 = rng.next();
      if (gum > 0.05 && r2 < 0.3 + 0.5 * gum) return { look, value: 'white' };
      if (X.shockUntil != null && env.day < X.shockUntil && r2 < 0.8) return { look, value: 'undigested' };
      if ((C.pantShare > 0.3 || X.droppings === 'watery') && r2 < 0.6) return { look, value: 'watery' };
      return { look, value: r2 > 0.9 ? 'caecal' : 'normal' };
    }
    case 'crop': {
      const empty = !env.lightsOn || (farm.feed.withdrawn && farm.feed.lines.every((l) => l.kg < 1)), r = rng.next();
      return { look, value: empty ? (r < 0.7 ? 'empty' : 'half') : r < 0.8 ? 'full' : 'half' };
    }
    case 'weight': return { look, value: Math.round(drawBird(fl, rng)) };
    case 'temp': {
      const e = C.eZ ? (Number.isFinite(C.eZ[zone]) ? C.eZ[zone] : C.e) : C.e;
      return { look, value: +Math.max(40.5, Math.min(44, 41.2 + 0.22 * Math.max(-3, e) + (rng.next() - 0.5) * 0.3)).toFixed(1) };
    }
    default: return { look, value: null };
  }
}

/** Cull lame birds (chicks.cull { reason: 'lame', n }): the oldest go first. Returns how many were lame. */
export function cullLame(farm, n) {
  const h = farm.health, k = Math.min(n, h.lame.length);
  h.lame.splice(0, k);
  farm.flock.lameOnFloor = h.lame.length;
  return k;
}

/** Add lame birds now (the lame-birds problem makes sure there is one from day 11). */
export function addLame(farm, env, n = 1) { for (let i = 0; i < n; i++) farm.health.lame.push(+env.day.toFixed(5)); farm.flock.lameOnFloor = farm.health.lame.length; }
