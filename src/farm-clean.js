// Farm model, clean-out and rest (PHASE3.md §6.10; wash steps general practice): the old litter out, the
// wash, wet and spray grids (576 cells, the litter grid's cell order), drying with the fans, the parts
// brushed, the drinker lines disinfected, the pans, the wash bay, the bait, the swabs at the ten fixed
// places and the lab letter that reads the whole house, closing the house and booking the next chicks.
// Pure logic, package "sim". EV.LETTER { kind: 'lab', day } when the lab result lies on the desk.
import { CLEAN, houseSector } from './config.js';
import { EV } from './events.js';
import { cellCentre, cellIndex, updateCover, ALL_CELLS } from './farm-litter.js';

// model constants (PHASE3.md §6.10)
export const CLEAN_MODEL = {
  litterLeftWash: 0.3, sprayWetK: 0.7, dryBase: 0.04, dryPerFan: 0.03, dryRhRef: 150,
  lab: { base: 0.02, spray: 0.9, brush: 0.1, litter: 0.15, sprayQuantile: 0.1 },
  litterLeftBelow: 0.5,     // a cell with more litter cover than this still holds litter
};
const N = ALL_CELLS.length;
const SECTOR = new Uint8Array(N);
for (let i = 0; i < N; i++) { const c = cellCentre(i); SECTOR[i] = houseSector(c.x, c.z); }
const mean = (g) => { let s = 0; for (let i = 0; i < g.length; i++) s += g[i]; return s / g.length; };

export function createClean() {
  return {
    wash: new Float32Array(N), spray: new Float32Array(N), wet: new Float32Array(N), washShare: 0, sprayShare: 0, wetShare: 0,
    brushed: Object.fromEntries(CLEAN.brushParts.map((p) => [p, false])), lines: [0, 0, 0, 0], disinfectant: false, pans: [false, false, false],
    washbay: Object.fromEntries(CLEAN.washItems.map((p) => [p, false])), baits: [false, false, false, false],
    closedDay: null, swabs: [], labDay: null, lab: null, labs: [], pass: 1, bookedDay: null,
    scrapedAt: null, washedAt: null, sprayedAt: null,
  };
}

function shares(C) { C.washShare = +mean(C.wash).toFixed(4); C.sprayShare = +mean(C.spray).toFixed(4); C.wetShare = +mean(C.wet).toFixed(4); }
function paint(x, z, r, fn) {
  const r2 = r * r;
  for (let i = 0; i < N; i++) { const c = cellCentre(i); if ((c.x - x) ** 2 + (c.z - z) ** 2 <= r2) fn(i); }
}

/** The clean-out actions; undefined = not one of them. */
export function cleanAct(farm, env, id, a) {
  const C = farm.clean, L = farm.litter;
  switch (id) {
    case 'clean.scrape': {
      paint(a.x ?? 0, a.z ?? 0, a.r ?? 2.0, (i) => { L.coverGrid[i] = 0; L.depthGrid[i] = 0; L.waterGrid[i] = 0; L.moistureGrid[i] = 60; L.cakedGrid[i] = 0; L.cakedHours[i] = 0; });
      updateCover(L); L.version++;
      if (C.scrapedAt == null) C.scrapedAt = env.day;
      return { share: +(1 - L.coverAll).toFixed(4) };
    }
    case 'clean.wash':
      paint(a.x ?? 0, a.z ?? 0, a.r ?? 2.5, (i) => { C.wash[i] = Math.max(C.wash[i], L.coverGrid[i] >= CLEAN_MODEL.litterLeftBelow ? CLEAN_MODEL.litterLeftWash : 1); C.wet[i] = 1; });
      shares(C); if (C.washedAt == null) C.washedAt = env.day;
      return { share: C.washShare };
    case 'clean.spray':
      paint(a.x ?? 0, a.z ?? 0, a.r ?? 2.5, (i) => { C.spray[i] = Math.max(C.spray[i], C.wash[i] * (1 - CLEAN_MODEL.sprayWetK * C.wet[i])); });
      shares(C); if (C.sprayedAt == null) C.sprayedAt = env.day;
      return { share: C.sprayShare };
    case 'clean.brush': if (a.part in C.brushed) C.brushed[a.part] = true; return true;
    case 'clean.washbay': if (a.item in C.washbay) C.washbay[a.item] = true; return true;
    case 'clean.bait': { const i = Math.max(0, Math.min(3, Math.round(a.i ?? C.baits.indexOf(false)))); if (i >= 0) C.baits[i] = true; return true; }
    case 'feed.wash': { const i = Math.max(0, Math.min(2, Math.round(a.line ?? 0))); C.pans[i] = true; return true; }
    case 'water.disinfect': C.disinfectant = !!a.on; return true;
    case 'clean.swab': {
      const spot = Number.isInteger(a.spot) ? a.spot : nearestSpot(a.x ?? 0, a.z ?? 0);
      if (!C.swabs.some((s) => s.spot === spot)) C.swabs.push({ x: +(a.x ?? CLEAN.swabSpots[spot].x).toFixed(2), z: +(a.z ?? CLEAN.swabSpots[spot].z).toFixed(2), spot, cell: cellIndex(a.x ?? 0, a.z ?? 0) });
      if (C.swabs.length >= CLEAN.swabs && C.labDay == null) C.labDay = env.dayNumber + CLEAN.labDays;
      return { n: C.swabs.length };
    }
    case 'house.close': C.closedDay = env.dayNumber; farm.house.closed = true; return true;
    case 'phone.bookChicks': {
      const d = Math.round(a.day ?? 0);
      if (C.closedDay == null) return { booked: false, bookedDay: C.bookedDay, reason: 'the house is not closed for its rest yet' };
      if (d < C.closedDay + CLEAN.bookMinDays || d > 69) return { booked: false, bookedDay: C.bookedDay, reason: `the hatchery has chicks for this house from day ${C.closedDay + CLEAN.bookMinDays} to day 69` };
      C.bookedDay = d;
      return { booked: true, bookedDay: d };
    }
    default: return undefined;
  }
}

/** water.flush with disinfectant in the header tank: that line is disinfected. */
export function flushDisinfect(farm, line) {
  const C = farm.clean;
  if (!C.disinfectant || !(line >= 0 && line < 4)) return false;
  C.lines[line] = 1;
  return true;
}

const nearestSpot = (x, z) => CLEAN.swabSpots.reduce((b, s, i) => ((s.x - x) ** 2 + (s.z - z) ** 2 < (CLEAN.swabSpots[b].x - x) ** 2 + (CLEAN.swabSpots[b].z - z) ** 2 ? i : b), 0);

/** One clean-out step: the wet floor dries with the fans; the lab letter on its day at 06:00. */
export function stepClean(farm, env, hrs) {
  const C = farm.clean, K = CLEAN_MODEL;
  if (C.wetShare > 0) {
    const k = (K.dryBase + K.dryPerFan * (env.fansEffective ?? env.fansManual ?? 0)) * Math.max(0, 1 - env.outsideRH / K.dryRhRef) * hrs;
    for (let i = 0; i < N; i++) C.wet[i] = Math.max(0, C.wet[i] - k);
    C.wetShare = +mean(C.wet).toFixed(4);
  }
  if (C.labDay != null && !C.lab && (env.dayNumber > C.labDay || (env.dayNumber === C.labDay && env.hour >= 6))) labLetter(farm, env);
}

/**
 * The lab letter (PHASE3.md §6.10): swab i (at its fixed place) grows bacteria with p = 0.02 + 0.9 x (1 - the
 * 10th-percentile spray of its house sector) + 0.1 x (parts not brushed / 5) + 0.15 x (litter cover of its
 * sector) (seeded): the whole house's cleaning shows at the ten places.
 */
export function labLetter(farm, env) {
  const C = farm.clean, K = CLEAN_MODEL.lab, L = farm.litter, rng = farm.rng;
  const bySector = Array.from({ length: 8 }, () => []), cover = new Array(8).fill(0), cnt = new Array(8).fill(0);
  for (let i = 0; i < N; i++) { bySector[SECTOR[i]].push(C.spray[i]); cover[SECTOR[i]] += L.coverGrid[i]; cnt[SECTOR[i]]++; }
  const p10 = bySector.map((a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(K.sprayQuantile * (s.length - 1))] : 0; });
  const notBrushed = Object.values(C.brushed).filter((v) => !v).length;
  const places = CLEAN.swabSpots.map((s, spot) => {
    const sec = houseSector(s.x, s.z);
    const p = Math.min(1, K.base + K.spray * (1 - p10[sec]) + K.brush * (notBrushed / CLEAN.brushParts.length) + K.litter * (cover[sec] / cnt[sec]));
    return { x: s.x, z: s.z, spot, positive: rng.next() < p, p: +p.toFixed(3) };
  });
  const positive = places.filter((p) => p.positive).length;
  C.lab = { positive, of: CLEAN.swabs, places: places.map(({ x, z, spot, positive: pos }) => ({ x, z, spot, positive: pos })), day: env.dayNumber, pass: C.pass };
  C.labs.push({ ...C.lab, p: places.map((p) => p.p) });
  farm.emit(EV.LETTER, { kind: 'lab', day: env.dayNumber });
  return C.lab;
}

/** More than two positive swabs (the swab-positive problem): a second pass, wash and spray cleared. */
export function secondPass(farm) {
  const C = farm.clean;
  C.wash.fill(0); C.spray.fill(0); shares(C);
  C.swabs = []; C.labDay = null; C.lab = null; C.pass += 1; C.washedAt = null; C.sprayedAt = null;
}

export function serializeClean(C) {
  const q = (g) => { const out = []; for (let i = 0; i < g.length;) { const v = Math.round(g[i] * 100); let j = i; while (j < g.length && Math.round(g[j] * 100) === v) j++; out.push(v, j - i); i = j; } return out; };
  const { wash, spray, wet, ...rest } = C;
  return { ...JSON.parse(JSON.stringify(rest)), wash: q(wash), spray: q(spray), wet: q(wet) };
}
export function restoreClean(d) {
  const C = createClean();
  if (!d) return C;
  const un = (r, g) => { let i = 0; for (let k = 0; r && k + 1 < r.length; k += 2) for (let n = 0; n < r[k + 1]; n++) g[i++] = r[k] / 100; };
  const { wash, spray, wet, ...rest } = d;
  Object.assign(C, JSON.parse(JSON.stringify(rest)));
  un(wash, C.wash); un(spray, C.spray); un(wet, C.wet);
  return C;
}
