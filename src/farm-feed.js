// Farm model, feed (PHASE2.md §6.5): silo, feeder lines and pans (auger, flood, rim height), the
// feed meter and feed orders. Pure logic, package "sim".
import { FEEDER_LINES_Z, EQUIP, LEVEL1, feederRimCmAt } from './config.js';

// model constants
export const FEED = {
  startHeightCm: 40,       // pans winched up on the prep day
  panKgNormal: 18,         // feed in one line's pans, normal fill (3 lines drain in ~7 h on day 6)
  panKgFlood: 66,          // flooded (heaped) pans; flooding all three takes ~200 kg
  augerKgH: 150,           // one line's auger
  accessFill: 0.3,         // birds eat freely down to 30 % pan fill, less below
  notFloodedEarly: 0.9,    // f_F x 0.9 if the pans are not flooded on days 0-3
  rimPerCm: 0.1,           // f_F x (1 - 0.1 x cm the rim sits above feederRimCmAt)
};

export function createFeed() {
  return {
    siloKg: LEVEL1.siloStartKg,
    meterKg: 0,
    lines: FEEDER_LINES_Z.map(() => ({ heightCm: FEED.startHeightCm, running: false, flood: false, panFill: 0, kg: 0 })),
    order: null,             // { kg, arriveDay, orderedAt } while a delivery is on its way
    orders: [],              // every order: { kg, orderedAt, arriveDay, arrivedAt }
    access: 0,               // f_F of the flock now
    reach: 0,                // share of the pans the chicks can reach and eat from (fill x rim height, no flood factor)
    emptyAt: null,           // env.day when the pans ran empty (mean fill < 5 %)
  };
}

export const panCap = (l) => (l.flood ? FEED.panKgFlood : FEED.panKgNormal);

/** Augers fill the pans from the silo; the meter counts what leaves the silo. */
export function stepAugers(feed, hrs) {
  for (const l of feed.lines) {
    if (l.running && feed.siloKg > 0) {
      const room = panCap(l) - l.kg;
      if (room > 0) {
        const kg = Math.min(room, FEED.augerKgH * hrs, feed.siloKg);
        l.kg += kg; feed.siloKg -= kg; feed.meterKg += kg;
      }
    }
    l.panFill = Math.min(1, l.kg / panCap(l));
  }
}

/** f_F at flock age `age`: pan fill, flood in the first days, rim height. */
export function feedAccess(feed, age, calendarDay) {
  let s = 0, r = 0;
  const rim = feederRimCmAt(Math.max(0, age));
  for (const l of feed.lines) {
    const fill = Math.min(1, l.kg / FEED.panKgNormal / FEED.accessFill);
    const early = calendarDay <= 3 && !l.flood ? FEED.notFloodedEarly : 1;
    const rimF = Math.max(0, 1 - FEED.rimPerCm * Math.max(0, l.heightCm - rim));
    s += fill * early * rimF; r += fill * rimF;
  }
  feed.access = s / feed.lines.length;
  feed.reach = r / feed.lines.length;
  return feed.access;
}

/** The birds eat `kg` from the pans (split by what each line holds). Returns what was there. */
export function eat(feed, kg) {
  let have = 0;
  for (const l of feed.lines) have += l.kg;
  if (have <= 0) return 0;
  const take = Math.min(kg, have);
  for (const l of feed.lines) { l.kg -= take * (l.kg / have); l.panFill = Math.min(1, l.kg / panCap(l)); }
  return take;
}

export const meanPanFill = (feed) => feed.lines.reduce((a, l) => a + Math.min(1, l.kg / FEED.panKgNormal), 0) / feed.lines.length;
export const clampPanHeight = (cm) => Math.max(EQUIP.feederHeightCm[0], Math.min(EQUIP.feederHeightCm[1], cm));
