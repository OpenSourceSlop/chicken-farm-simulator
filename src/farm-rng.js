// Seeded random numbers and normal-distribution helpers for the farm model. Pure logic.
// Owner: package "sim". One generator per farm; its 32-bit state is saved with the farm so a
// restored game draws the same numbers as the one that was saved.

/** mulberry32: small, fast, good enough for jitter and samples. */
export function createRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const rng = {
    /** uniform 0..1 */
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** standard normal (Box-Muller, one value per call) */
    normal() {
      const u = Math.max(1e-12, rng.next()), v = rng.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /** uniform in [a, b) */
    range(a, b) { return a + (b - a) * rng.next(); },
    /** integer 0..n-1 */
    int(n) { return Math.floor(rng.next() * n); },
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  };
  return rng;
}

/** Error function (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function erf(x) {
  const sgn = x < 0 ? -1 : 1, a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return sgn * y;
}

/** Standard normal CDF. */
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * A mixture of normal cohorts [{ n, w, cv }] (count, mean g, coefficient of variation):
 * mean, CV and the share within +-10 % of the mean (uniformity).
 */
export function mixtureStats(cohorts) {
  let n = 0, s1 = 0, s2 = 0;
  for (const c of cohorts) {
    if (c.n <= 0) continue;
    const sd = c.cv * c.w;
    n += c.n; s1 += c.n * c.w; s2 += c.n * (sd * sd + c.w * c.w);
  }
  if (n <= 0) return { n: 0, mean: 0, cv: 0, uniformity: 0 };
  const mean = s1 / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  return { n, mean, cv: mean > 0 ? sd / mean : 0, uniformity: mixtureShare(cohorts, 0.9 * mean, 1.1 * mean) / n };
}

/** Number of birds of the mixture with weight in [lo, hi]. */
export function mixtureShare(cohorts, lo, hi) {
  let k = 0;
  for (const c of cohorts) {
    if (c.n <= 0) continue;
    const sd = Math.max(1e-6, c.cv * c.w);
    k += c.n * (phi((hi - c.w) / sd) - phi((lo - c.w) / sd));
  }
  return k;
}

/** Weight at quantile u (0..1) of the mixture, by bisection on the mixture CDF. */
export function mixtureQuantile(cohorts, u) {
  let n = 0, lo = Infinity, hi = 0;
  for (const c of cohorts) {
    if (c.n <= 0) continue;
    n += c.n; lo = Math.min(lo, c.w * (1 - 5 * c.cv)); hi = Math.max(hi, c.w * (1 + 5 * c.cv));
  }
  if (n <= 0) return 0;
  const target = Math.max(1e-4, Math.min(1 - 1e-4, u)) * n;
  lo = Math.max(0, lo);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (mixtureShare(cohorts, -Infinity, mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
