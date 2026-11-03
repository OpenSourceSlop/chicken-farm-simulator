// Shared parts of the Phase 3 panels (package "panels"): the 24-hour climate memory the charts draw
// from, small SVG charts, tabs, a machine job that needs farm time, and the readers that turn a farm
// action's result into what the machine shows. The readers accept the result shapes of PHASE3.md §13.3;
// where the farm (the Phase 3 stub) answers only `true`, they read the same figures off the farm state
// so the panel still shows the machine (PHASE3.md §13.8; noted for the integrator).
import { AIR, HEATERS, HARVEST, FAN_COUNT } from './config.js';
import { wetBulbOf } from './sim.js';
import { h, button, setText } from './ui-dom.js';
import { hhmm, splitDay } from './ui-format.js';

export const GAME_MIN = 1 / 1440;
const HEAT_RATE = 6.5; // °C per hour from 8 brooders at full output (sim.js; the fallback heat budget only)

// ---------------- the climate memory (one per env, kept in farm time, skips included) ----------------
const HIST = new WeakMap();
/** Start recording the house every 10 game minutes in level mode (registerCyclePanels calls it once). */
export function installHistory(L) {
  const { env, farm } = L;
  if (!env || HIST.has(env)) return HIST.get(env);
  const hist = { rows: [], acc: 0 };
  HIST.set(env, hist);
  env.addStepper?.((e, s) => {
    if (farm?.mode !== 'level') return;
    const last = hist.rows[hist.rows.length - 1];
    if (last && e.day < last.t - 1e-6) { hist.rows.length = 0; hist.acc = 0; } // a new run or a replay went back in time
    hist.acc += s;
    if (hist.acc < 600) return;
    hist.acc = 0;
    hist.rows.push({ t: e.day, house: e.houseTemp, rh: e.houseRH, out: e.outsideTemp, outRh: e.outsideRH,
      fans: e.fansOn, eff: e.fansEffective ?? e.fansOn, pad: !!e.padOn, feedKg: farm.feed?.meterKg ?? null });
    while (hist.rows.length && hist.rows[0].t < e.day - 1.05) hist.rows.shift();
  });
  return hist;
}
/** The rows of the last 24 hours (or fewer). */
export const historyOf = (env) => (HIST.get(env)?.rows) || [];

// ---------------- SVG charts (LCD ink on the LCD green, no good / bad colours) ----------------
/**
 * lineChart({ rows, t1, series: [{ key, dash?, width?, step? }], lo, hi, unit, W, H, label })
 * The last 24 hours up to t1; lo / hi fix the scale (else from the data).
 */
export function lineChart({ rows, series, lo, hi, unit = '', W = 300, H = 80, bands = [] }) {
  if (!rows || rows.length < 2) return null;
  const t1 = rows[rows.length - 1].t, t0 = t1 - 1;
  const vals = series.flatMap((s) => rows.map((r) => r[s.key])).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  const a = lo ?? Math.floor(Math.min(...vals) - 1), b = hi ?? Math.ceil(Math.max(...vals) + 1);
  const X = (t) => ((t - t0) / (t1 - t0)) * W, Y = (v) => H - ((Math.max(a, Math.min(b, v)) - a) / Math.max(1e-6, b - a)) * H;
  const path = (s) => {
    let d = '', prev = null;
    for (const r of rows) {
      if (r.t < t0 || !Number.isFinite(r[s.key])) continue;
      const x = X(r.t).toFixed(1), y = Y(r[s.key]).toFixed(1);
      if (!d) d = `M${x} ${y}`;
      else d += s.step ? `H${x}V${y}` : `L${x} ${y}`;
      prev = r;
    }
    void prev;
    return d ? `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${s.width ?? 2}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} vector-effect="non-scaling-stroke"/>` : '';
  };
  const bandSvg = bands.map((bd) => {
    let out = '';
    for (let i = 0; i < rows.length - 1; i++) if (rows[i][bd.key] && rows[i].t >= t0) out += `<rect x="${X(rows[i].t).toFixed(1)}" y="0" width="${Math.max(0.5, X(rows[i + 1].t) - X(rows[i].t)).toFixed(1)}" height="${H}" fill="currentColor" opacity="0.12"/>`;
    return out;
  }).join('');
  const ticks = [0, 6, 12, 18, 24].map((k) => {
    const t = t0 + k / 24, x = X(t);
    return `<text x="${Math.max(0, Math.min(W - 24, x - 12)).toFixed(1)}" y="${H + 11}" font-size="9">${hhmm(splitDay(t).hour)}</text>`;
  }).join('');
  return { svg: `<svg viewBox="0 -2 ${W} ${H + 14}" preserveAspectRatio="none" height="${H + 14}" aria-hidden="true">${bandSvg}${series.map(path).join('')}${ticks}</svg>`, lo: a, hi: b, unit };
}

// ---------------- tabs ----------------
/** A row of tabs over sections; show(i) switches; visible(i, on) hides a tab and its section. */
export function makeTabs(names, { cls = 'cyc-tabs', secs: given = [] } = {}) {
  const btns = names.map((t, i) => button({ class: 'ctrl-tab', role: 'tab', 'aria-selected': String(i === 0) }, t));
  const secs = names.map((_, i) => given[i] || h('div', { class: 'cyc-sec', role: 'tabpanel' }));
  const bar = h('div', { class: cls, role: 'tablist' }, btns);
  let cur = 0;
  const show = (i) => { cur = i; btns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); secs.forEach((s, j) => { s.hidden = i !== j; }); };
  btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
  show(0);
  return {
    bar, secs, btns, show,
    get current() { return cur; },
    visible(i, on) { btns[i].hidden = !on; if (!on && cur === i) show(0); },
  };
}

// ---------------- a machine job that takes farm time (the plate folds first so the clock runs) ----------------
/** job(env, minutes, onDone): start() / cancel() / tick() -> 0..1 (calls onDone once at 1). */
export function machineJob(env, minutes, onDone) {
  let start = null;
  return {
    get running() { return start != null; },
    start() { if (start == null) start = env.day; },
    cancel() { start = null; },
    tick() {
      if (start == null) return 0;
      const t = Math.min(1, (env.day - start) / (minutes * GAME_MIN));
      if (t >= 1) { start = null; onDone(); return 1; }
      return t;
    },
  };
}
export const progressBar = () => { const bar = h('span'); const el = h('div', { class: 'cyc-progress', hidden: true }, bar); return { el, set(t) { el.hidden = !(t > 0 && t < 1); bar.style.transform = `scaleX(${Math.max(0, Math.min(1, t)).toFixed(3)})`; } }; };

// ---------------- time words ----------------
/** env.day float -> "day 12, 08:40" (the planning and prep days by name). */
export function whenText(t) {
  if (t == null || !Number.isFinite(t)) return '—';
  const { day, hour } = splitDay(t);
  const d = day === -2 ? 'planning day' : day === -1 ? 'prep day' : `day ${day}`;
  return `${d}, ${hhmm(hour)}`;
}
/** hours -> "1.8 h" / "35 min". */
export const hoursText = (hrs) => (hrs == null || !Number.isFinite(hrs) ? '—' : hrs < 1 ? `${Math.max(0, Math.round(hrs * 60))} min` : `${(Math.round(hrs * 10) / 10).toFixed(1)} h`);
export const setOnce = (el, s) => setText(el, s);

// ---------------- readers of the farm's answers (stub-tolerant) ----------------
const obj = (r) => (r && typeof r === 'object' ? r : null);

/** The house's heat terms, °C per hour (env.heatBudget, PHASE3.md §14.1; else the same terms worked out here). */
export function heatBudgetOf(env) {
  const b = typeof env.heatBudget === 'function' ? obj(env.heatBudget()) : null;
  if (b && Number.isFinite(b.wallsCh)) return { ...b, fallback: false };
  const tunnel = env.fanMean > 0 ? Math.min(1, (env.fansEffective ?? env.fansOn) / env.fanMean) : 0;
  const padDrop = !env.padOn ? 0 : env.cycleClimate
    ? 0.8 * Math.max(0, env.outsideTemp - wetBulbOf(env.outsideTemp, env.outsideRH)) * tunnel * Math.max(0, Math.min(1, env.padWorking ?? 1))
    : Math.min(9, (100 - env.outsideRH) / 5) * 0.85 * tunnel;
  const inlet = env.outsideTemp - padDrop;
  const lit = HEATERS.length - (env.brooderOut?.length || 0);
  return {
    brooderCh: env.broodersUp ? 0 : (HEAT_RATE * (env.heaterLevel || 0) * lit) / HEATERS.length,
    birdsCh: env.flockHeatPerH || 0,
    sunCh: env.sunHeatPerH || 0,
    wallsCh: -AIR.wallLossPerH * (env.houseTemp - inlet),
    airCh: -((env.airflowM3h ?? AIR.infiltrationM3h) / AIR.thermalM3) * (env.houseTemp - inlet),
    slabCh: -0.3 * (env.houseTemp - (env.slabTemp ?? env.houseTemp)),
    fallback: true,
  };
}

/** pad.check -> { dry: [6 bools], flowing, overflow }. */
export function padCheckOf(r, farm, env) {
  const o = obj(r);
  if (o && Array.isArray(o.dry)) return { dry: o.dry.slice(0, 6), flowing: !!o.flowing, overflow: !!(o.overflow ?? farm.house?.padFloatStuck) };
  const dryN = Math.round((1 - Math.max(0, Math.min(1, farm.house?.padWorking ?? env.padWorking ?? 1))) * 6);
  return { dry: Array.from({ length: 6 }, (_, k) => k < dryN), flowing: !!env.padOn, overflow: !!farm.house?.padFloatStuck };
}

/** load.ticket -> { crates, birds, grossKg, tareKg, netKg, doa } (the truck's figures when the farm answers true). */
export function ticketOf(r, farm, truck) {
  const o = obj(r);
  if (o && Number.isFinite(o.grossKg)) return o;
  const t = farm.harvest?.trucks?.[truck] || {};
  const net = Math.round(t.netKg || 0), tare = HARVEST.tareKg;
  return { crates: t.crates || 0, birds: t.birds || 0, grossKg: Math.round(t.grossKg ?? net + tare), tareKg: tare, netKg: net, doa: t.doa ?? 0 };
}

/** gas.meter -> { kgLeft, kgUsed } or null when the farm keeps no gas figure. */
export function gasOf(r, farm, tankKg = 500) {
  const o = obj(r);
  if (o && Number.isFinite(o.kgLeft)) return o;
  const used = farm.stats?.gasKg;
  return Number.isFinite(used) ? { kgLeft: Math.max(0, Math.round(tankKg - used)), kgUsed: Math.round(used) } : null;
}

/** Birds by the farmer's own counts: placed − dead counted at the bin − culls. */
export function knownBirds(farm) {
  const f = farm.flock || {};
  return Math.max(0, (f.placed || 0) - (f.countedDead || 0) - (f.culls || 0));
}

/** The main water valve: shut by water.main { open: false } (sim keeps farm.water.mainClosed). */
export function mainShut(farm, memo) {
  if (typeof farm.water?.mainClosed === 'boolean') return farm.water.mainClosed;
  if (typeof farm.health?.mainClosed === 'boolean') return farm.health.mainClosed;
  return !!memo.shut;
}

// ---------------- small pictures ----------------
/** A fan rotor (the air vane: turns while the fan moves air). */
export const ROTOR = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="none" stroke="currentColor" stroke-width="1.5"/>${[0, 120, 240].map((a) => `<path d="M0 0C2 -3 3 -8 0 -10C-3 -8 -2 -3 0 0z" fill="currentColor" transform="rotate(${a})"/>`).join('')}<circle r="1.6" fill="currentColor"/></svg>`;

/** A side view of a broiler (size by age; pose: 'stand' | 'sit' | 'fluffed'). */
export function broilerSvg(age, pose = 'stand', size = 150) {
  const s = Math.max(0.55, Math.min(1.25, 0.5 + age / 50));
  const sit = pose === 'sit', fluff = pose === 'fluffed';
  const body = `<ellipse cx="0" cy="${sit ? 8 : 0}" rx="${fluff ? 30 : 27}" ry="${fluff ? 24 : 21}" fill="var(--hen)"/>
    <path d="M-24 ${sit ? 0 : -8}q-10 -4 -14 -14q12 2 18 8z" fill="var(--hen-tail)"/>
    <path d="M-8 ${sit ? 4 : -4}q12 10 26 2" fill="none" stroke="var(--hen-shade)" stroke-width="3"/>
    <circle cx="22" cy="${sit ? -14 : -22}" r="11" fill="var(--hen)"/>
    <path d="M18 ${sit ? -25 : -33}q3 -7 7 -1q3 -6 6 1" fill="var(--hen-comb)"/>
    <path d="M32 ${sit ? -15 : -23}l8 3-8 3z" fill="var(--hen-beak)"/>
    <circle cx="25" cy="${sit ? -16 : -24}" r="1.6" fill="var(--panel-solid)"/>
    ${sit ? '' : '<path d="M-6 20v14M8 20v14M-10 34h8M4 34h8" stroke="var(--hen-beak)" stroke-width="3" stroke-linecap="round"/>'}`;
  return `<svg viewBox="-50 -50 100 100" width="${size}" height="${size}" aria-hidden="true"><g transform="scale(${s.toFixed(2)})">${body}</g></svg>`;
}

/** Six fans in the east wall: index -> "Fan 4". */
export const FAN_INDEXES = Array.from({ length: FAN_COUNT }, (_, i) => i);

/**
 * The weight spread of the birds weighed today (unlock uniformityChart): a histogram in 5 % steps of the
 * mean, the ±10 % band shaded, and the share inside it (the uniformity, a measured number).
 * @returns {{ svg: string, n: number, inside: number, mean: number } | null}
 */
export function spreadChart(weights) {
  const w = weights.filter((x) => Number.isFinite(x) && x > 0);
  if (w.length < 2) return null;
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const bins = new Array(12).fill(0); // -30 .. +30 % of the mean in 5 % steps
  for (const x of w) bins[Math.max(0, Math.min(11, Math.floor(((x / mean - 1) * 100 + 30) / 5)))]++;
  const inside = w.filter((x) => Math.abs(x / mean - 1) <= 0.1).length;
  const W = 300, Hh = 70, bw = W / 12, top = Math.max(...bins);
  const bars = bins.map((n, i) => (n ? `<rect x="${(i * bw + 1).toFixed(1)}" y="${(Hh - (n / top) * (Hh - 4)).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${((n / top) * (Hh - 4)).toFixed(1)}" fill="currentColor"/>` : '')).join('');
  const band = `<rect x="${(4 * bw).toFixed(1)}" y="0" width="${(4 * bw).toFixed(1)}" height="${Hh}" fill="currentColor" opacity="0.12"/>`;
  const ticks = [-30, -10, 0, 10, 30].map((p) => `<text x="${(((p + 30) / 60) * W - (p === 30 ? 22 : p === -30 ? 0 : 9)).toFixed(1)}" y="${Hh + 11}" font-size="9">${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %</text>`).join('');
  return { svg: `<svg viewBox="0 0 ${W} ${Hh + 14}" height="${Hh + 14}" preserveAspectRatio="none" aria-hidden="true">${band}${bars}${ticks}</svg>`, n: w.length, inside, mean };
}
