// Sound layer, the per-minute caps and the event log (PHASE5.md §2.2). Both run on the audio clock, so a burst of game
// steps in one task (the harness's advance(), a skip) cannot stack sounds: the clock has not moved.
//
//   const lim = createLimiter(CAPS)
//   lim.allow('tick', t)            true while fewer than CAPS.tick played in (t - 60, t]
//   lim.note('tick', t, variant?, db?, aux?) one played (counted for its cap and kept in the log; aux: a thunder's delay)
//   lim.count('tick', t)            how many in the minute up to t
//   lim.log                         the event log (fixed typed arrays, no allocation per event): kinds, times,
//                                   variants, levels; lim.events() copies it out for the hour check
// A kind with no cap is only logged. Nothing here allocates after start-up.
export const LOG_KINDS = [
  'chirp', 'distress', 'snick', 'rattle', 'flutter', 'bird', 'moto', 'dog', 'frog', 'gecko', 'burst',
  'door', 'valve', 'waterValve', 'winch', 'beep', 'probe', 'paper', 'click', 'tick', 'box', 'bin', 'squeeze', 'alarm', 'truck',
  'step', 'drip', 'thunder', 'crate', 'ring', 'dial', 'pen', 'scrape', 'genStart', 'genStop', 'clunk', 'gust',
];
const KIND = new Map(LOG_KINDS.map((k, i) => [k, i]));
/** The kinds that share one cap (the generator's start, stop and the switch's clunk: CAPS.gen). */
const CAP_OF = { genStart: 'gen', genStop: 'gen', clunk: 'gen' };
const RING = 64; // the last 64 times of each capped kind (no cap is over 40 a minute)

export function createLimiter(caps = {}, { logSize = 0, ring = false } = {}) {
  const capKeys = Object.keys(caps);
  const times = {};
  const heads = {};
  for (const k of capKeys) { times[k] = new Float64Array(RING).fill(-1e9); heads[k] = 0; }
  const N = logSize | 0;
  const log = { n: 0, kind: new Int16Array(N), t: new Float64Array(N), variant: new Int8Array(N), db: new Float32Array(N), aux: new Float32Array(N) };
  const capOf = (kind) => CAP_OF[kind] || kind;
  function count(kind, t) {
    const c = capOf(kind), a = times[c];
    if (!a) return 0;
    let n = 0;
    for (let i = 0; i < RING; i++) if (a[i] > t - 60 && a[i] <= t + 1e-9) n++;
    return n;
  }
  const api = {
    caps,
    count,
    /** the cap for this kind now (the alarm's falls after its first two minutes: pass `late`) */
    allow(kind, t, late = false) {
      const c = capOf(kind);
      let cap = caps[c];
      if (c === 'alarm' && late && caps.alarmLate != null) cap = caps.alarmLate;
      return cap == null || count(kind, t) < cap;
    },
    note(kind, t, variant = -1, db = 0, aux = 0) {
      const c = capOf(kind);
      if (times[c]) { times[c][heads[c]] = t; heads[c] = (heads[c] + 1) % RING; }
      if (N > 0 && (ring || log.n < N)) {
        const i = log.n++ % N; // a live log wraps (ring); the hour check's holds the whole hour
        log.kind[i] = KIND.has(kind) ? KIND.get(kind) : -1; log.t[i] = t; log.variant[i] = variant; log.db[i] = db; log.aux[i] = aux;
      }
    },
    log,
    /** the log as plain rows [{ kind, t, variant, db }] (tests, debug.hour) */
    events() {
      const out = [];
      for (let j = Math.max(0, log.n - N); j < log.n; j++) { const i = j % N; out.push({ kind: LOG_KINDS[log.kind[i]] ?? '?', t: log.t[i], variant: log.variant[i], db: log.db[i], aux: log.aux[i] }); }
      return out;
    },
    clearLog() { log.n = 0; },
  };
  return api;
}

/** Per kind: the most events in any real minute (windows starting at every event), from rows sorted by time. */
export function maxPerMinute(rows) {
  const by = {};
  for (const r of rows) (by[r.kind] || (by[r.kind] = [])).push(r.t);
  const out = {};
  for (const [k, ts] of Object.entries(by)) {
    ts.sort((a, b) => a - b);
    let best = 0, j = 0;
    for (let i = 0; i < ts.length; i++) { while (ts[i] - ts[j] >= 60 - 1e-9) j++; best = Math.max(best, i - j + 1); }
    out[k] = best;
  }
  return out;
}
/** The coefficient of variation of the gaps between successive times (sd / mean); NaN under 2 gaps. */
export function gapCV(ts) {
  if (ts.length < 3) return NaN;
  const g = [];
  for (let i = 1; i < ts.length; i++) g.push(ts[i] - ts[i - 1]);
  const m = g.reduce((a, b) => a + b, 0) / g.length;
  const sd = Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length);
  return m > 0 ? sd / m : NaN;
}
