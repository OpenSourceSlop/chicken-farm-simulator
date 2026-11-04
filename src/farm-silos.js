// Farm model, feed for the whole cycle (PHASE3.md §6.6): two silos as stacks of deliveries drawn from
// the bottom, the slide valves, orders by feed type, the pan mix, feed form, the change shock, the
// withdrawal before catching and the heat-wave feeder lift. Pure logic, package "sim".
// In the brooding week the silos only follow Phase 2's single figure (feed.siloKg: the augers and the
// day 4 order change it; reconcileSilos books it as starter in silo 1), so the week is Phase 2's. From
// Week 2 (farm.cyc.on) stepAugersCycle replaces Phase 2's augers and orders go by type.
import { EQUIP, FEED_TYPES, feedTypeForDay, HEAT } from './config.js';
import { FEED, panCap, augerState } from './farm-feed.js';

// model constants
export const SILO_MODEL = {
  shockPoints: 0.6, shockWindowH: 12, shockH: 24, shockIntake: 0.97, blendLo: 0.2, blendHi: 0.8, blendH: 24,
  pelletFpg: 0.98, emptyBelow: 0.05, panUpCm: 45,
  debtRate: 0.6, debtKeep: 0.88,      // feed the birds missed while the feeders were up: eaten back at up to +60 %, 88 % of it
  heatK: 0.85,                        // the flock's heat x 0.85 from 1 h after the feeders went up in the heat
};
const TYPES = FEED_TYPES.map((t) => t.id);
const siloOf = (type) => (FEED_TYPES.find((t) => t.id === type) || FEED_TYPES[0]).silo;

/** Add the cycle's feed state to a Phase 2 feed (silos, valves, pan mix). Idempotent. */
export function ensureSilos(feed) {
  if (!feed.silos) {
    const kg = feed.siloKg ?? 0;
    feed.silos = [{ type: 'starter', kg, layers: kg > 0 ? [{ type: 'starter', kg }] : [] }, { type: 'grower', kg: 0, layers: [] }];
  }
  if (!feed.valves) feed.valves = [1, 0];
  if (!feed.panType) feed.panType = { starter: 1, grower: 0, finisher: 0 };
  if (!feed.pending) feed.pending = [];
  if (feed.withdrawn == null) feed.withdrawn = false;
  if (!feed.mixHist) feed.mixHist = [];
  if (feed.deliveredKg == null) feed.deliveredKg = 0;
  return feed;
}

const sumSilos = (feed) => feed.silos[0].kg + feed.silos[1].kg;
function topType(s) { s.type = s.layers.length ? s.layers[0].type : s.type; }
/** Take up to kg from the bottom of silo s; returns { kg, byType }. */
function drawFrom(s, kg, byType) {
  let left = kg;
  while (left > 1e-9 && s.layers.length) {
    const L = s.layers[0], t = Math.min(L.kg, left);
    L.kg -= t; left -= t; byType[L.type] = (byType[L.type] || 0) + t;
    if (L.kg <= 1e-6) s.layers.shift();
  }
  s.kg = Math.max(0, s.layers.reduce((a, l) => a + l.kg, 0));
  topType(s);
  return kg - left;
}

/** Brooding week: book Phase 2's changes of feed.siloKg in silo 1 (starter). */
export function reconcileSilos(feed) {
  ensureSilos(feed);
  const d = feed.siloKg - sumSilos(feed);
  if (Math.abs(d) < 1e-6) return;
  const s = feed.silos[0];
  if (d > 0) { s.layers.push({ type: 'starter', kg: d }); s.kg += d; feed.deliveredKg += d; topType(s); }
  else drawFrom(s, -d, {});
}

/** Feed the open valves can reach (kg). */
const reachable = (feed) => feed.silos.reduce((a, s, i) => a + (feed.valves[i] > 0 ? s.kg : 0), 0);

/** The augers fill the pans from the silos through the valves (cycle mode); the pan mix follows. */
export function stepAugersCycle(feed, hrs) {
  const before = feed.lines.reduce((a, l) => a + l.kg, 0);
  const added = {};
  let addKg = 0;
  for (const l of feed.lines) {
    const room0 = panCap(l) - l.kg, avail0 = reachable(feed), kg0 = l.kg;
    if (l.running && !feed.withdrawn) {
      const room = room0, avail = avail0;
      if (room > 0 && avail > 0) {
        const kg = Math.min(room, FEED.augerKgH * hrs, avail);
        // the valves share the draw (an empty silo gives nothing, the other one gives it all)
        const w = feed.silos.map((s, i) => (s.kg > 0 ? feed.valves[i] : 0)), ws = w[0] + w[1];
        let got = 0;
        for (let i = 0; i < 2; i++) if (w[i] > 0) got += drawFrom(feed.silos[i], (kg * w[i]) / ws, added);
        if (got < kg - 1e-9) for (let i = 0; i < 2; i++) if (w[i] > 0 && feed.silos[i].kg > 0) got += drawFrom(feed.silos[i], kg - got, added);
        l.kg += got; feed.meterKg += got; addKg += got;
      }
    }
    augerState(l, l.kg - kg0, hrs, room0, avail0); // the control pan (farm-feed.js): the feeder box shows it
    l.panFill = Math.min(1, l.kg / panCap(l));
  }
  feed.siloKg = sumSilos(feed);
  if (addKg > 0) feed.drawMix = Object.fromEntries(TYPES.map((t) => [t, +((added[t] || 0) / addKg).toFixed(3)]));
  if (addKg > 0) {
    const mix = feed.panType, tot = before + addKg;
    for (const t of TYPES) mix[t] = tot > 0 ? (mix[t] * before + (added[t] || 0)) / tot : mix[t];
  }
}

/** An order (cycle mode): type by default today's feed; its silo's room cuts it. */
export function orderFeed(feed, env, a) {
  ensureSilos(feed);
  const type = TYPES.includes(a.type) ? a.type : feedTypeForDay(env.dayNumber).id;
  const silo = siloOf(type), s = feed.silos[silo];
  const pendingKg = feed.pending.filter((o) => o.silo === silo).reduce((x, o) => x + o.kg, 0);
  const room = Math.max(0, EQUIP.siloCapacityKg - s.kg - pendingKg);
  const kg = Math.max(0, Math.min(room, Math.round(a.kg ?? 0)));
  if (!kg) return { arriveDay: null, arriveHour: null, kg: 0, type, silo, roomKg: Math.round(room) };
  const arriveDay = env.dayNumber + (env.hour < 16 ? 1 : 2), arriveHour = 9;
  const o = { kg, type, silo, arriveDay, arriveHour, orderedAt: env.day };
  feed.pending.push(o);
  feed.orders.push({ ...o, arrivedAt: null });
  return { arriveDay, arriveHour, kg, type, silo, roomKg: Math.round(room) };
}

/** Deliveries that came (cycle mode): a new top layer on the silo. Returns the arrivals. */
export function deliverFeed(feed, env) {
  const out = [];
  for (let k = feed.pending.length - 1; k >= 0; k--) {
    const o = feed.pending[k];
    if (env.day < o.arriveDay + o.arriveHour / 24 - 1e-9) continue;
    feed.pending.splice(k, 1);
    const s = feed.silos[o.silo], kg = Math.min(o.kg, EQUIP.siloCapacityKg - s.kg);
    if (kg > 0) { s.layers.push({ type: o.type, kg }); s.kg += kg; topType(s); feed.deliveredKg += kg; }
    feed.siloKg = sumSilos(feed);
    const rec = feed.orders.find((x) => x.orderedAt === o.orderedAt && x.type === o.type); if (rec) rec.arrivedAt = env.day;
    out.push({ ...o, kg });
  }
  return out;
}

/** Feed form (PHASE3.md §6.6): the pans' mix at this age, and the feed per gain factor of pellets. */
export function feedForm(feed, age) {
  const m = feed.panType;
  const starter = age <= 16 ? 1 : Math.max(0.9, 1 - 0.01 * (age - 16));
  const grower = age >= 12 ? 1 : 0.97, finisher = age >= 26 ? 1 : 0.97;
  const pellet = (m.grower || 0) + (m.finisher || 0);
  return { fForm: (m.starter || 0) * starter + (m.grower || 0) * grower + (m.finisher || 0) * finisher, fpgK: 1 - (1 - SILO_MODEL.pelletFpg) * pellet };
}

/** The main type in the pans now. */
export const mainType = (feed) => TYPES.reduce((a, t) => ((feed.panType[t] || 0) > (feed.panType[a] || 0) ? t : a), TYPES[0]);

/**
 * The change shock (PHASE3.md §6.6): a type's share of the pans moving more than 60 points in 12 h gives
 * 24 h of undigested droppings and intake x 0.97, unless that type stood in a 20-80 % blend for 24 h.
 * Keeps an hourly history of the mix; returns the env.day the shock lasts to (or the one it had).
 */
export function checkShock(feed, env, until) {
  const K = SILO_MODEL, hist = feed.mixHist, hour = Math.floor(env.day * 24 + 1e-6);
  if (hist.length && hist[hist.length - 1][0] === hour) return until;
  hist.push([hour, ...TYPES.map((t) => +(feed.panType[t] || 0).toFixed(3))]);
  while (hist.length > 37) hist.shift();
  if (until != null && env.day < until) return until;
  const now = hist[hist.length - 1];
  for (let k = 0; k < TYPES.length; k++) {
    const past = hist.filter((h) => h[0] >= hour - K.shockWindowH);
    const moved = Math.max(...past.map((h) => Math.abs(now[k + 1] - h[k + 1])));
    if (moved <= K.shockPoints) continue;
    const blendH = hist.filter((h) => h[k + 1] >= K.blendLo && h[k + 1] <= K.blendHi).length;
    if (blendH >= K.blendH) continue;
    // the move this shock is for: only once (the history forgets it after 12 h)
    feed.mixHist = hist.map((h) => { const c = h.slice(); c[k + 1] = now[k + 1]; return c; });
    return env.day + K.shockH / 24;
  }
  return until;
}

/** Withdrawal (feed.withdraw): the lines stop; the pans winch up once the birds emptied them. */
export function withdraw(feed, env, on) {
  feed.withdrawn = !!on;
  if (on) { feed.withdrawAt = env.day; for (const l of feed.lines) l.running = false; }
  else { feed.withdrawAt = null; feed.pansEmptyAt = null; }
  return true;
}
/** Each step while withdrawn: the time the pans ran empty (<= 5 %), then the pans go up. */
export function stepWithdrawal(feed, env) {
  if (!feed.withdrawn) return;
  const fill = feed.lines.reduce((a, l) => a + Math.min(1, l.kg / FEED.panKgNormal), 0) / feed.lines.length;
  if (feed.pansEmptyAt == null && fill <= SILO_MODEL.emptyBelow) feed.pansEmptyAt = env.day;
  if (feed.pansEmptyAt != null) for (const l of feed.lines) l.heightCm = SILO_MODEL.panUpCm;
}

/** The feeders are up in the hottest hours (lines stopped, pans high) on a hot day: since when. */
export function feedersUpInHeat(feed, env) {
  const [from, to] = HEAT.feedersOffHours;
  const up = !feed.withdrawn && feed.lines.every((l) => !l.running && l.heightCm >= 40);
  return up && env.hour >= from - 0.5 && env.hour <= to + 0.5;
}

/** Feed left in the silos and the pans (kg). */
export const feedLeftKg = (feed) => sumSilos(feed) + feed.lines.reduce((a, l) => a + l.kg, 0);

export function serializeSilos(feed) {
  return { silos: feed.silos.map((s) => ({ type: s.type, kg: +s.kg.toFixed(2), layers: s.layers.map((l) => ({ type: l.type, kg: +l.kg.toFixed(2) })) })) };
}
