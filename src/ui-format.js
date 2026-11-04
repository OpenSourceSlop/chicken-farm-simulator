// Number, time and reading formatting for the Level 1 UI. Owner: package "level".
// Plain numbers only: nothing here colours or judges a value.
import { fmt0, fmt1 } from './ui-dom.js';
import { BROOD_BOUNDS, BIRD_BOUNDS, broodSector, houseSector } from './config.js';

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

/** A whole number without '.0', else one decimal: 11 -> "11", 10.5 -> "10.5". */
export const num = (n) => (n == null || !Number.isFinite(n) ? '—' : Math.abs(n - Math.round(n)) < 0.05 ? int(Math.round(n)) : fmt1(n));
const lineNo = (v) => (v.line ?? 0) + 1;

/** A place on the brooding floor in words ("west part, south side"); outside it: "". */
export function placeWords(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return '';
  const b = BROOD_BOUNDS;
  if (x < b.xMin - 0.5 || x > b.xMax + 0.5 || z < b.zMin - 0.5 || z > b.zMax + 0.5) {
    // Phase 3: the east half after the curtain lift, in the house's four parts along its length
    const hb = BIRD_BOUNDS;
    if (x < hb.xMin - 0.8 || x > hb.xMax + 0.8 || z < hb.zMin - 0.8 || z > hb.zMax + 0.8) return '';
    const s = houseSector(x, z);
    return `${['west end', 'west middle', 'east middle', 'east end'][Math.floor(s / 2)]} of the house, ${s % 2 ? 'south' : 'north'} side`;
  }
  const s = broodSector(x, z);
  return `${['west', 'middle', 'east'][Math.floor(s / 2)]} part, ${s % 2 ? 'south' : 'north'} side`;
}

/** A control the farmer set (notebook kind 'setting', value { id, ...args }) in his own words. */
export function settingText(v) {
  switch (v.id) {
    case 'water.height': return `Line ${lineNo(v)} winch: nipples at ${num(v.cm)} cm`;
    case 'water.pressure': return `Line ${lineNo(v)} pressure: ${num(v.cm)} cm water column`;
    case 'water.flush': return `Line ${lineNo(v)} flush valve ${v.on ? 'open' : 'shut'}`;
    case 'heat.setpoint': return `Brooder thermostat set to ${num(v.value)} °C`;
    case 'vent.timer': return v.fans > 0 && v.onSec > 0
      ? `Min. vent timer: ${num(v.fans)} fan${v.fans === 1 ? '' : 's'}, ${num(v.onSec)} s in every ${num(v.cycleSec)} s`
      : 'Min. vent timer off';
    case 'vent.fans': return v.n > 0 ? `Tunnel fans on by hand: ${num(v.n)}` : 'Tunnel fans off';
    case 'vent.pad': return `Cooling pad ${v.on ? 'on' : 'off'}`;
    case 'light.program': return v.darkHours > 0
      ? `Lights: dark from ${hhmm(v.darkStart ?? 0)} for ${num(v.darkHours)} h, dimmer ${num((v.dimmer ?? 1) * 100)} %`
      : `Lights on 24 h, dimmer ${num((v.dimmer ?? 1) * 100)} %`;
    case 'feed.line': {
      const parts = [];
      if (v.running != null) parts.push(v.running ? 'running' : 'stopped');
      if (v.flood != null) parts.push(v.flood ? 'flood on' : 'flood off');
      if (v.heightCm != null) parts.push(`pans at ${num(v.heightCm)} cm`);
      return `Feeder line ${lineNo(v)}: ${parts.join(', ') || 'set'}`;
    }
    case 'litter.depth': return `Litter depth ${num(v.cm)} cm`;
    // Phase 3 controls (PHASE3.md §13.3)
    case 'house.curtain': return v.open ? 'Brooding curtain lifted' : 'Brooding curtain down';
    case 'heat.brooders': return v.up ? 'Brooders off and winched up' : 'Brooders down';
    case 'feed.valve': return `Silo ${(v.silo ?? 0) + 1} slide valve ${v.open >= 1 ? 'open' : v.open > 0 ? 'half open' : 'shut'}`;
    case 'feed.withdraw': return v.on ? 'Feeder lines stopped: the feed taken away' : 'Feeder lines running again';
    case 'water.main': return `Main water valve ${v.open ? 'open' : 'shut'}`;
    case 'water.medicate': return `Medicine in the water ${v.on ? 'on' : 'off'}`;
    case 'water.disinfect': return `Disinfectant in the header tank ${v.on ? 'on' : 'off'}`;
    case 'vent.stages': return 'Tunnel fan stages set';
    case 'light.preset': return `Light program preset: ${v.id ?? ''}`.trim();
    default: {
      const parts = [];
      for (const [k, val] of Object.entries(v)) if (val != null && typeof val !== 'object' && k !== 'id') parts.push(`${k} ${typeof val === 'number' ? num(val) : val}`);
      return parts.join(' · ') || '—';
    }
  }
}

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
    case 'air': case 'air.probe': return [r.speedMs != null && `${one(r.speedMs)} m/s`, r.tempC != null && `${one(r.tempC)} °C`, r.rh != null && `${int(r.rh)} %`].filter(Boolean).join(' · ') || '—';
    case 'bird': case 'sample.bird': return `${r.look ?? 'bird'}: ${typeof r.value === 'number' ? num(r.value) : r.value ?? '—'}`;
    case 'fans': case 'fans.read': return [r.fans != null && `${int(r.fans)} tunnel fans`, r.houseC != null && `house ${one(r.houseC)} °C`, r.rh != null && `${int(r.rh)} %`, r.speedMs != null && `${one(r.speedMs)} m/s`].filter(Boolean).join(' · ') || 'fan panel read';
    case 'gas': case 'gas.meter': return [r.kgLeft != null && `${int(r.kgLeft)} kg gas left`, r.kgUsed != null && `${int(r.kgUsed)} kg used`].filter(Boolean).join(' · ') || 'gas gauge read';
    case 'pad': case 'pad.check': return Array.isArray(r.dry) ? `pad: ${r.dry.filter(Boolean).length} of ${r.dry.length} sections dry${r.flowing === false ? ', no flow' : ''}` : 'pad checked';
    case 'ticket': case 'load.ticket': return `truck ${(r.truck ?? 0) + 1}: ${int(r.crates)} crates, ${int(r.birds)} birds, net ${int(r.netKg)} kg`;
    case 'swab': case 'clean.swab': return `swab ${int(r.n ?? (r.spot ?? 0) + 1)} taken`;
    case 'booking': case 'phone.bookCatch': case 'phone.bookChicks': return r.booked ? `booked${r.bookedDay != null ? `: chicks on day ${r.bookedDay}` : ''}` : `not booked: ${r.reason ?? ''}`;
    case 'dead': case 'dead.count': return `${int(r.n)} dead counted at the bin`;
    case 'weigh': case 'sample.weigh': return `bird ${int(r.weightG)} g`;
    case 'box': case 'sample.box': return `box ${two(r.weightKg)} kg gross, box ${two(r.boxKg)} kg`;
    case 'filter': case 'water.filter': return `filter in ${one(r.inBar)} bar, out ${one(r.outBar)} bar`;
    case 'controller': case 'controller.read': return [`house ${one(r.houseC)} °C`, r.minC != null && `min ${one(r.minC)} / max ${one(r.maxC)} °C`, r.setpoint != null && `set ${one(r.setpoint)} °C`].filter(Boolean).join(' · ');
    case 'look': return [r.spread && `chicks ${r.spread}`, r.droppings && `droppings ${r.droppings}`, r.sounds && r.sounds].filter(Boolean).join('; ');
    case 'house.temp': return `house ${one(r.houseC ?? r.tempC)} °C`;
    case 'setting': return settingText(v);
    case 'tip': case 'chicks.tip': return `${int(r.placed)} chicks out on the litter${r.deadInBoxes ? `, ${int(r.deadInBoxes)} dead in the boxes` : ''}`;
    case 'cull': case 'chicks.cull': return `${int(r.n)} culled${r.reason === 'grading' ? ' at the chick table' : r.reason === 'sick' ? ' (sick bird)' : r.reason === 'lame' ? ' (lame bird)' : ''}`;
    case 'order': case 'feed.order': return r.arriveDay != null ? `${r.type ? `${r.type} ` : ''}feed ordered${r.kg != null ? ` (${int(r.kg)} kg)` : ''}, arrives day ${r.arriveDay} ${hhmm(r.arriveHour ?? 9)}` : 'feed ordered';
    // Phase 4: the conditions' readings (PHASE4.md §10.3 results, as the notebook keeps them)
    case 'tank': case 'water.tank': return [r.levelPct != null && `tank ${int(r.levelPct)} %`, r.lowPct != null && `marker ${int(r.lowPct)} %${r.lowAt != null ? ` at ${hhmm((r.lowAt % 1) * 24)}` : ''}`,
      r.pumpBar != null && `pump ${one(r.pumpBar)} bar, ${one(r.pumpA)} A${r.pumpOn === false ? ' (stopped)' : ''}`].filter(Boolean).join(' · ') || 'tank read';
    case 'water.test': return [r.ph != null && `pH ${one(r.ph)}`, r.chlorinePpm != null && `chlorine ${one(r.chlorinePpm)} ppm`, r.ironMgL != null && `iron ${one(r.ironMgL)} mg/L`].filter(Boolean).join(' · ') || 'water tested';
    case 'generator': case 'gen.test': case 'gen.start': case 'gen.stop': return [r.ok != null ? (r.ok ? 'test run' : 'test run: no start') : r.running != null ? (r.running ? 'running' : 'stopped') : null,
      r.fuelL != null && `${int(r.fuelL)} L fuel`, r.hoursLeft != null && `about ${one(r.hoursLeft)} h left`].filter(Boolean).join(' · ') || 'generator';
    case 'gen.switch': return `house on the ${r.source === 'generator' ? 'generator' : 'mains'}`;
    case 'chicks.grade': return `stack ${int((r.stack ?? 0) + 1)}: ${int(r.weak)} weak of ${int(r.looked)}, ${int(r.culled)} graded out`;
    case 'phone.hatchery': return `hatchery told: ${r.chickWeightG != null ? `${one(r.chickWeightG)} g a chick` : 'no box weighed'}${r.weakPct != null ? `, ${one(r.weakPct)} % weak` : ''}`;
    case 'inlets.storm': return `storm flaps ${r.closed ? 'closed' : 'open'}`;
    case 'pump.fix': return r.started ? `pump repair started (${int(r.hours ?? 2)} farm hours)` : 'pump repair already running';
    case 'grade': case 'sample.grade': return `chick ${int((r.i ?? 0) + 1)}: rights itself in ${one(r.reflexSec)} s, navel ${r.navel ?? '—'}, hocks ${r.hocks ?? '—'}`;
    case 'grade.sheet': case 'grade.submit': {
      const s = r.sheet || {};
      return `sheet handed in: navel not closed ${int(s.navelBad ?? 0)}, red hocks ${int(s.redHocks ?? 0)}, slow to right ${int(s.slowReflex ?? 0)}, culled ${int(s.culled ?? 0)}`;
    }
    default: {
      if (r.text) return String(r.text);
      const parts = [];
      for (const [k, val] of Object.entries(r)) if (val != null && typeof val !== 'object' && k !== 'id' && k !== 'day' && k !== 'hour') parts.push(`${k} ${typeof val === 'number' ? num(val) : val}`);
      return parts.join(' · ') || '—';
    }
  }
}
