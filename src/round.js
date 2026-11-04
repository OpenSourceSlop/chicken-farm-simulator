// Rounding for saves (plain data only). Owner: shared (sim / records).

/** A copy with every number rounded to `dp` decimals (non-finite numbers become null). */
export function roundDeep(o, dp = 3) {
  const k = 10 ** dp;
  const r = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * k) / k : null)
    : Array.isArray(v) ? v.map(r) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, r(b)])) : v);
  return r(o);
}
