// Number, time and reading formatting for the Level 1 UI. Owner: package "level".
// Plain numbers only: nothing here colours or judges a value.
import { fmt0, fmt1 } from './ui-dom.js';

const pad2 = (n) => String(n).padStart(2, '0');
/** 13.5 -> "13:30" (hours past 24 wrap). */
export function hhmm(hour) {
  const m = Math.round((((hour % 24) + 24) % 24) * 60) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
/** env.day float -> { day, hour } (calendar day, hour of day). */
export function splitDay(t) {
  const day = Math.floor(t + 1e-9);
  return { day, hour: (t - day) * 24 };
}
/** env.day float -> "Day 3, 10:40" ("Prep day, 16:00" for day −1). */
export function dayTime(t, { short = false } = {}) {
  const { day, hour } = splitDay(t);
  const d = day < 0 ? (short ? 'Prep' : 'Prep day') : `Day ${fmt0(day)}`;
  return `${d}, ${hhmm(hour)}`;
}
/** 6000 -> "6,000"; null -> "—". */
export function int(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return fmt0(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export const one = (n) => (n == null || !Number.isFinite(n) ? '—' : fmt1(n));
export const two = (n) => (n == null || !Number.isFinite(n) ? '—' : (Math.round(n * 100) / 100).toFixed(2).replace('-', '−'));
/** Signed percent change: +18 % / −10 %. */
export function signedPct(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const v = Math.round(n);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} %`;
}

const CROP_WORDS = { full: 'full and soft', 'full-soft': 'full and soft', soft: 'full and soft', hard: 'hard', 'soft-watery': 'soft and watery', watery: 'soft and watery', empty: 'empty' };
export const cropWords = (c) => CROP_WORDS[c] || String(c ?? '—');
const FEEL_WORDS = { ok: 'holds, then breaks', damp: 'sticks together' };
export const feelWords = (f) => FEEL_WORDS[f] || String(f ?? '—');

/** A notebook reading (records Note or an action result) in plain words. */
export function readingText(kind, v) {
  if (v == null) return '—';
  if (typeof v !== 'object') return typeof v === 'number' ? one(v) : String(v);
  const r = v.result && typeof v.result === 'object' ? { ...v, ...v.result } : v;
  switch (kind) {
    case 'water.meter': return [r.litres != null && `meter ${int(r.litres)} L`, r.litres24h != null && `${int(r.litres24h)} L in 24 h`, r.per1000 != null && `${one(r.per1000)} L per 1,000 birds`, r.changePct != null && `${signedPct(r.changePct)} on the day before`].filter(Boolean).join(' · ') || `${int(r.litres)} L`;
    case 'feed.meter': return `feed meter ${int(r.kg)} kg`;
    case 'feed.silo': return `silos about ${int(r.kg)} kg`;
    case 'water.flow': case 'water.flowtest': return `line ${(r.line ?? 0) + 1}: ${one(r.mlMin)} ml/min`;
    case 'water.height': return `line ${(r.line ?? 0) + 1}: nipples at ${int(r.cm ?? r.heightCm)} cm`;
    case 'floor.temp': case 'floor.probe': return `floor ${one(r.tempC ?? r.value)} °C`;
    case 'vent.temp': case 'sample.vent': return `vent ${one(r.tempC)} °C`;
    case 'crop': case 'sample.crop': return `crop ${cropWords(r.crop)}`;
    case 'litter': case 'litter.squeeze': return `litter ${int(r.moisturePct)} % · ${feelWords(r.feel)}`;
    case 'lux': case 'light.lux': return `${int(r.lux)} lux`;
    case 'dead': case 'dead.count': return `${int(r.n)} dead counted at the bin`;
    case 'weigh': case 'sample.weigh': return `bird ${int(r.weightG)} g`;
    case 'box': case 'sample.box': return `box ${two(r.weightKg)} kg gross, box ${two(r.boxKg)} kg`;
    case 'filter': case 'water.filter': return `filter in ${one(r.inBar)} bar, out ${one(r.outBar)} bar`;
    case 'controller': case 'controller.read': return [`house ${one(r.houseC)} °C`, r.minC != null && `min ${one(r.minC)} / max ${one(r.maxC)} °C`, r.setpoint != null && `set ${one(r.setpoint)} °C`].filter(Boolean).join(' · ');
    case 'look': return [r.spread && `chicks ${r.spread}`, r.droppings && `droppings ${r.droppings}`, r.sounds && r.sounds].filter(Boolean).join('; ');
    case 'house.temp': return `house ${one(r.houseC ?? r.tempC)} °C`;
    default: {
      if (r.text) return String(r.text);
      const parts = [];
      for (const [k, val] of Object.entries(r)) if (val != null && typeof val !== 'object' && k !== 'id' && k !== 'day' && k !== 'hour') parts.push(`${k} ${typeof val === 'number' ? one(val) : val}`);
      return parts.join(' · ') || '—';
    }
  }
}
