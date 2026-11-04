// Farm model, finishing and harvest (PHASE3.md §6.9; general practice): the booking, the catch section by
// section from the door end, dead on arrival, the weight tickets and the harvest result. Pure logic,
// package "sim". Events: EV.CATCH { phase: 'start'|'section'|'end', i, birds },
// EV.FARM_DELIVERY { kind: 'catch', phase: 'arrive'|'leave', truck }.
import { HARVEST, HOUSE_BOUNDS, PLACEMENT_DAY, weightAt } from './config.js';
import { EV } from './events.js';
import { syncAlive, updateWeights } from './farm-flock.js';
import { feedLeftKg } from './farm-silos.js';

// model constants (PHASE3.md §6.9)
export const HARVEST_MODEL = {
  noPanelsMin: 5,
  doa: { base: 0.0010, heat: 0.0004, bright: 0.0008, brightLux: 12, noPanels: 0.001, longW: 0.0005, longFromH: 12 },
  shrink: { per: 0.0025, from: 2, cap: 10, longPer: 0.003, longFrom: 12 }, gutFullBelowH: 6, netNoise: 0.002,
  // feed still in the crops and guts (withdrawal under gutFullBelowH): the plant deducts this share of the
  // weighed kg from the ticket (gut fill and soiled carcasses are not paid; model value, general practice)
  gutDeduct: 0.03,
};
const W = (HOUSE_BOUNDS.xMax - HOUSE_BOUNDS.xMin) / HARVEST.sections;
const at = (o) => o.day + o.hour / 24;

export function createHarvest() {
  return {
    catchAt: null, bookedAt: null, started: false, startedAt: null, endedAt: null, panels: false,
    sections: Array.from({ length: HARVEST.sections }, (_, i) => ({ i, x0: HOUSE_BOUNDS.xMin + i * W, x1: HOUSE_BOUNDS.xMin + (i + 1) * W, state: 'waiting', birds: 0 })),
    trucks: Array.from({ length: HARVEST.trucks }, () => ({ crates: 0, birds: 0, liveKg: 0, netKg: 0, grossKg: 0, gutKg: 0, doa: 0, left: false })),
    cond: { eSum: 0, n: 0, luxMax: 0, fansMin: null, minutes: 0 },
    shrink: null, withdrawalH: null, result: null,
  };
}

/** The shrink between the feed going off and the plant, by withdrawal hours W (PHASE3.md §6.6). */
export function shrinkOf(W) {
  const S = HARVEST_MODEL.shrink;
  return 1 - S.per * Math.max(0, Math.min(S.cap, W - S.from)) - S.longPer * Math.max(0, W - S.longFrom);
}

/** phone.bookCatch { day, hour } -> { booked, catchAt, reason? } (a farm action). */
export function bookCatch(farm, env, a) {
  const hv = farm.harvest, t = (a.day ?? 0) + (a.hour ?? 0) / 24, from = at(HARVEST.bookFrom), to = at(HARVEST.bookTo);
  const now = hv.catchAt ?? at(HARVEST.catchDefault);
  if (hv.started) return { booked: false, catchAt: now, reason: 'the crew is already catching' };
  if (t < from - 1e-9 || t > to + 1e-9) return { booked: false, catchAt: now, reason: `the crew catches between day ${HARVEST.bookFrom.day} ${HARVEST.bookFrom.hour}:00 and day ${HARVEST.bookTo.day} ${String(HARVEST.bookTo.hour).padStart(2, '0')}:00` };
  if (t < env.day + 1e-9) return { booked: false, catchAt: now, reason: 'that time has already passed' };
  // the crew needs its notice (sign-catch: at least 3 days ahead); the catch stays where it was
  if ((t - env.day) * 24 < HARVEST.bookAheadH - 1e-6) return { booked: false, catchAt: now, reason: `the crew needs ${Math.round(HARVEST.bookAheadH / 24)} days’ notice` };
  hv.catchAt = t; hv.bookedAt = env.day; farm.stats.catchBookedAt = env.day;
  return { booked: true, catchAt: t };
}

/** load.ticket { truck } -> { crates, birds, grossKg, tareKg, gutKg, netKg, doa } (net = gross - empty truck - the plant's deduction). */
export function ticket(farm, a) {
  const t = farm.harvest.trucks[Math.max(0, Math.min(HARVEST.trucks - 1, Math.round(a.truck ?? 0)))];
  return { crates: t.crates, birds: t.birds, grossKg: Math.round(t.grossKg), tareKg: HARVEST.tareKg, gutKg: Math.round(t.gutKg || 0), netKg: Math.round(t.netKg), doa: t.doa };
}

/** One step of the catch (cycle mode): the company's default time, the crew, the sections, the end. */
export function stepHarvest(farm, env) {
  const hv = farm.harvest, fl = farm.flock;
  if (hv.result || !(fl.placed > 0)) return;
  if (hv.catchAt == null && env.day >= at(HARVEST.bookFrom) - 1e-9) hv.catchAt = at(HARVEST.catchDefault);
  if (!hv.started) {
    if (hv.catchAt == null || env.day < hv.catchAt - 1e-9 || !(fl.alive > 0)) return;
    hv.started = true; hv.startedAt = env.day;
    const feed = farm.feed;
    hv.withdrawalH = feed.pansEmptyAt != null ? Math.max(0, (env.day - feed.pansEmptyAt) * 24) : 0;
    hv.shrink = shrinkOf(hv.withdrawalH);
    hv.feedLeftKg = Math.round(feedLeftKg(feed));
    hv.ageAtCatch = env.day - PLACEMENT_DAY;
    const per = fl.alive / HARVEST.sections;
    let left = fl.alive;
    for (const s of hv.sections) { const n = s.i === HARVEST.sections - 1 ? left : Math.round(per); s.birds = n; left -= n; s.state = 'penned'; }
    farm.emit(EV.CATCH, { phase: 'start', i: null, birds: fl.alive });
    farm.emit(EV.FARM_DELIVERY, { kind: 'catch', phase: 'arrive' });
  }
  // conditions while birds are inside (DOA): comfort, light, fans
  const c = hv.cond;
  c.eSum += farm.comfort.meanOver ?? 0; c.n++;
  c.luxMax = Math.max(c.luxMax, env.lightsOn ? farm.luxLit() : 0);
  c.fansMin = c.fansMin == null ? env.fansEffective : Math.min(c.fansMin, env.fansEffective);
  const per = HARVEST.sectionMin + (hv.panels ? 0 : HARVEST_MODEL.noPanelsMin);
  const doneN = Math.min(HARVEST.sections, Math.floor(((env.day - hv.startedAt) * 1440 + 1e-6) / per));
  for (let k = 0; k < HARVEST.sections; k++) {
    const s = hv.sections[HARVEST.sectionOrder[k]];
    if (k < doneN && s.state !== 'done') {
      const birds = k === HARVEST.sections - 1 ? Math.round(fl.alive) : Math.min(Math.round(fl.alive), s.birds);
      loadBirds(farm, birds);
      s.state = 'done'; s.birds = 0;
      farm.emit(EV.CATCH, { phase: 'section', i: s.i, birds });
    } else if (k === doneN && s.state === 'penned') s.state = 'catching';
  }
  if (doneN >= HARVEST.sections) endCatch(farm, env);
}

function loadBirds(farm, n) {
  const fl = farm.flock, hv = farm.harvest;
  if (!(n > 0)) return;
  const k = Math.max(0, (fl.alive - n) / Math.max(1, fl.alive)), co = fl.cohorts;
  for (const key of ['good', 'late', 'weak']) if (co[key]) co[key].n *= k;
  fl.caught = (fl.caught || 0) + n;
  syncAlive(fl); updateWeights(fl);
  let left = n;
  for (let i = 0; i < hv.trucks.length && left > 0; i++) {
    const t = hv.trucks[i], room = i === hv.trucks.length - 1 ? left : HARVEST.cratesPerTruck * HARVEST.birdsPerCrate - t.birds, put = Math.min(room, left);
    if (put <= 0) continue;
    t.birds += put; t.crates = Math.ceil(t.birds / HARVEST.birdsPerCrate); t.liveKg += (put * fl.meanWeightG) / 1000; left -= put;
  }
}

function endCatch(farm, env) {
  const hv = farm.harvest, fl = farm.flock, M = HARVEST_MODEL.doa, rng = farm.rng;
  const loaded = hv.trucks.reduce((a, t) => a + t.birds, 0), c = hv.cond;
  const eCatch = c.n ? c.eSum / c.n : 0, hot = farm.comfort.hotFrom ?? 6;
  const doaShare = M.base + M.heat * Math.max(0, eCatch - hot) + M.bright * (c.luxMax > M.brightLux ? 1 : 0) + M.noPanels * (hv.panels ? 0 : 1)
    + M.longW * Math.max(0, hv.withdrawalH - M.longFromH);
  let doaLeft = Math.round(loaded * doaShare);
  const gutFull = hv.withdrawalH < HARVEST_MODEL.gutFullBelowH;
  hv.trucks.forEach((t, i) => {
    const d = i === hv.trucks.length - 1 ? doaLeft : Math.min(doaLeft, Math.round(t.birds * doaShare));
    t.doa = d; doaLeft -= d;
    const weighed = t.liveKg * hv.shrink * (1 + (rng.next() * 2 - 1) * HARVEST_MODEL.netNoise);
    t.gutKg = gutFull ? weighed * HARVEST_MODEL.gutDeduct : 0;
    t.netKg = weighed - t.gutKg;   // what the plant pays for
    t.grossKg = HARVEST.tareKg + weighed; t.left = true;
    farm.emit(EV.FARM_DELIVERY, { kind: 'catch', phase: 'leave', truck: i });
  });
  fl.alive = 0; fl.present = false; fl.lameOnFloor = 0; fl.deadOnFloor = 0;
  if (farm.health) farm.health.lame = [];
  hv.endedAt = env.day;
  const doa = hv.trucks.reduce((a, t) => a + t.doa, 0);
  fl.doa = doa; fl.deadByCause.doa = (fl.deadByCause.doa || 0) + doa;
  const netKg = hv.trucks.reduce((a, t) => a + t.netKg, 0);
  const feed = farm.feed, startKg = farm.stats.feedAtStartKg ?? 0;
  const usedKg = startKg + (feed.deliveredKg || 0) - hv.feedLeftKg;
  const fcr = netKg > 0 ? usedKg / netKg : null;
  const base = fl.delivered || fl.placed || 1;
  const mortalityPct = (100 * (fl.deadTotal + fl.culls + doa)) / base;
  const w = lastWeighing(farm.stats.weighed);
  const meanLiveG = loaded ? (1000 * netKg) / loaded : 0;
  const age = hv.ageAtCatch;
  const epef = fcr ? ((100 - mortalityPct) * (meanLiveG / 1000)) / (age * fcr) * 100 : null;
  hv.result = { sold: loaded - doa, loaded, liveKg: Math.round(netKg), meanLiveG: Math.round(meanLiveG), fcr: fcr ? +fcr.toFixed(3) : null,
    mortalityPct: +mortalityPct.toFixed(2), uniformityPct: w ? w.uniformityPct : null, uniformityDay: w ? w.day : null, epef: epef ? Math.round(epef) : null,
    feedLeftKg: hv.feedLeftKg, withdrawalH: +hv.withdrawalH.toFixed(1), gutFull, gutKg: Math.round(hv.trucks.reduce((a, t) => a + (t.gutKg || 0), 0)),
    doa, doaPct: loaded ? +((100 * doa) / loaded).toFixed(3) : 0,
    ageAtCatch: +age.toFixed(3), targetG: Math.round(weightAt(age) * HARVEST.shrink), catchAt: hv.startedAt, fansMin: c.fansMin, luxMax: Math.round(c.luxMax) };
  farm.emit(EV.CATCH, { phase: 'end', i: null, birds: loaded });
}

/** The last hand weighing of >= 10 birds: its day, mean and uniformity (+-10 %). */
export function lastWeighing(weighed) {
  if (!weighed || !weighed.length) return null;
  const days = [...new Set(weighed.map((x) => Math.floor(x.t)))];
  for (let k = days.length - 1; k >= 0; k--) {
    const w = weighed.filter((x) => Math.floor(x.t) === days[k]).map((x) => x.weightG);
    if (w.length < 10) continue;
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    return { day: days[k], n: w.length, meanG: m, uniformityPct: +((100 * w.filter((x) => Math.abs(x - m) <= 0.1 * m).length) / w.length).toFixed(1) };
  }
  return null;
}
