// The settings store (PHASE5.md §4): one object of groups, remembered in localStorage inside try/catch (a private window,
// blocked site data or the artifact preview must never break the game: the defaults then hold for the session), applied
// live by whoever owns the thing a setting changes (subscribe). No DOM and no three.js here, so node tests use it as it is.
// Owner after the design round: package "settings" (the API below and the existing keys are the frozen contract; a package
// may add a key to its own group, PHASE5.md §8.3).
//
//   const settings = createSettings({ storage?, events? });
//   settings.get('sound.volume')            -> 0.7
//   settings.set('camera.rotateSpeed', 1.5) -> 1.5 (clamped / validated, stored, every subscriber told, EV.SETTINGS)
//   settings.setMany({ 'interface.hudScale': '1.15', 'interface.watch': 'folded' })
//   settings.group('graphics')              -> { quality, pixelRatio, shadows, flockDetail, showFps } (a copy)
//   settings.reset('camera') / reset()      -> the defaults of one group / of everything
//   const off = settings.subscribe((c) => ..., 'sound')   c = { group, key, path, value, prev }; filter: a group or a path
//   settings.all()                          -> a deep copy of every value (the guide, tests)
//   settings.schema                         -> SETTINGS_SCHEMA (the menu draws its controls from it)
//   soundView(settings)                     -> the audio-settings.js API (volume, muted, gain(), state(), set(), toggleMute(),
//                                              subscribe()) over the sound group; it also keeps the Phase 4 key
//                                              'chicken-farm.sound' in step (scripts/p5-sound.json reads it)
import { SETTINGS_STORE } from './config.js';
import { EV } from './events.js';
import { volumeToGain } from './audio-settings.js';
import { setMotionOverride } from './motion.js';

/**
 * Every setting: type 'range' { min, max, step } | 'bool' | 'choice' { options: [[value, label]] } | 'map' (an object of
 * strings: key bindings) | 'list' (strings). `hidden` items are not drawn by the menu (the first-play memory).
 * `by` names the package that applies it (PHASE5.md §4.1); `live`: applied at once (every setting is).
 */
export const SETTINGS_SCHEMA = {
  sound: { label: 'Sound', by: 'sound', items: {
    volume: { type: 'range', min: 0, max: 1, step: 0.01, def: 0.7, label: 'Master volume' },
    muted: { type: 'bool', def: false, label: 'Sound off' },
    background: { type: 'range', min: 0, max: 1, step: 0.05, def: 1, label: 'Yard and house (background)' },
    flock: { type: 'range', min: 0, max: 1, step: 0.05, def: 1, label: 'The flock' },
    cues: { type: 'range', min: 0, max: 1, step: 0.05, def: 1, label: 'Your actions and the machines' },
  } },
  time: { label: 'Time', by: 'experience', items: {
    defaultSpeed: { type: 'choice', def: '1x', label: 'Clock speed at the start of each level', options: [['1x', '1× (a farm day in about 16 minutes)'], ['4x', '4× (a farm day in about 4 minutes)']] },
    signStops: { type: 'bool', def: true, label: 'Stop the clock while I read a sign or a plate' },
    atJobSlow: { type: 'bool', def: true, label: 'Slow the clock to ⅔ at an open job’s place' },
    holdJobs: { type: 'bool', def: true, label: 'Hold a job open while I am working at it' },
  } },
  graphics: { label: 'Graphics', by: 'settings', items: {
    quality: { type: 'choice', def: 'auto', label: 'Quality', options: [['auto', 'Automatic (steps down on a slow computer)'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['custom', 'Custom']] },
    pixelRatio: { type: 'choice', def: 'auto', label: 'Sharpness (pixel ratio)', options: [['auto', 'Automatic'], ['1.5', '1.5'], ['1.25', '1.25'], ['1', '1'], ['0.85', '0.85 (softer, faster)']] },
    shadows: { type: 'choice', def: 'auto', label: 'Shadows', options: [['auto', 'Automatic'], ['high', 'Soft'], ['low', 'Simple'], ['off', 'Off']] },
    flockDetail: { type: 'choice', def: 'auto', label: 'Flock detail', options: [['auto', 'Automatic'], ['full', 'Full'], ['reduced', 'Reduced']] },
    showFps: { type: 'bool', def: false, label: 'Show the frame rate' },
  } },
  camera: { label: 'Camera', by: 'settings', items: {
    rotateSpeed: { type: 'range', min: 0.5, max: 2, step: 0.05, def: 1, label: 'Turn speed (drag and arrow keys)' },
    zoomSpeed: { type: 'range', min: 0.5, max: 2, step: 0.05, def: 1, label: 'Zoom speed (wheel and + / −)' },
    invertRotate: { type: 'bool', def: false, label: 'Turn the other way when dragging' },
    invertZoom: { type: 'bool', def: false, label: 'Zoom the other way with the wheel' },
  } },
  interface: { label: 'Interface', by: 'experience', items: {
    hudScale: { type: 'choice', def: '1', label: 'HUD size', options: [['0.9', 'Small'], ['1', 'Normal'], ['1.15', 'Large'], ['1.3', 'Larger']] },
    watch: { type: 'choice', def: 'shown', label: 'Flock watch card', options: [['shown', 'Shown'], ['folded', 'Folded to its dots'], ['hidden', 'Hidden (warnings still in captions and the notebook)']] },
    soundCaptions: { type: 'bool', def: false, label: 'Sound captions ([Alarm], [Thunder], [Chicks peeping loudly] …)' },
    captionTime: { type: 'choice', def: '1', label: 'How long messages stay', options: [['1', 'Normal'], ['1.5', 'Longer'], ['2', 'Twice as long']] },
    helpLegend: { type: 'choice', def: 'first', label: 'Controls legend', options: [['first', 'Show it until I close it'], ['always', 'Show it at every level start'], ['never', 'Only when I press H']] },
    reducedMotion: { type: 'choice', def: 'system', label: 'Reduce motion', options: [['system', 'As the computer is set'], ['on', 'Always (no flashes, pulses or bobbing)']] },
  } },
  keys: { label: 'Keys', by: 'settings', items: {
    bindings: { type: 'map', def: {}, label: 'Key bindings', hidden: true },   // { [action id]: KeyboardEvent.code } (keys.js)
  } },
  // Skills update (SKILLS.md §7): the level 3 payoffs switched off for every branch or one at a time. Hidden: package "jobs"
  // draws its tab only while config SKILLS_UPDATE.live (so the six Phase 5 tabs stay); every default true (an earned level 3 acts).
  automation: { label: 'Automation', by: 'jobs', hidden: true, liveOnly: true, items: {
    all: { type: 'bool', def: true, label: 'Let the farm’s equipment do the jobs my level 3 skills hand to it' },
    water: { type: 'bool', def: true, label: 'Water 3: the drinker winches follow the flock’s age' },
    moisture: { type: 'bool', def: true, label: 'Moisture 3: the minimum ventilation timer steps up by itself' },
    ventilation: { type: 'bool', def: true, label: 'Ventilation 3: the fan stages add tunnel fans as the house warms' },
    heating: { type: 'bool', def: true, label: 'Heating 3: the brooders follow the brooder sign’s curve' },
    feed: { type: 'bool', def: true, label: 'Feed 3: feed orders itself and the feeder lines rise' },
    lighting: { type: 'bool', def: true, label: 'Lighting 3: the light program changes with the age and dims at dawn and dusk' },
    growth: { type: 'bool', def: true, label: 'Growth 3: the automatic bird scale gives the weigh-in' },
    comfort: { type: 'bool', def: true, label: 'Comfort 3: the comfort colours show whenever I am in the house' },
    biosecurity: { type: 'bool', def: true, label: 'Biosecurity 3: birds I walk past show a symptom tag' },
    brooding: { type: 'bool', def: true, label: 'Brooding 3: a helper tips the chick boxes on arrival day' },
    planning: { type: 'bool', def: true, label: 'Farm Planning 3: the next plan is filled in from this cycle' },
  } },
  intro: { label: 'First play', by: 'experience', hidden: true, items: {
    done: { type: 'bool', def: false, label: 'Introduction finished' },
    seen: { type: 'list', def: [], label: 'Pointers already shown' },
  } },
};

/** The Graphics presets (PHASE5.md §4.1): the three hand settings each one sets. Changing one of the three by hand makes
 *  `graphics.quality` read 'custom'; picking a preset sets the three (createSettings links them, so every settings object
 *  behaves the same with or without the menu). */
export const GRAPHICS_PRESETS = {
  auto: { pixelRatio: 'auto', shadows: 'auto', flockDetail: 'auto' },
  high: { pixelRatio: '1.5', shadows: 'high', flockDetail: 'full' },
  medium: { pixelRatio: '1', shadows: 'low', flockDetail: 'full' },
  low: { pixelRatio: '0.85', shadows: 'off', flockDetail: 'reduced' },
};
const PRESET_KEYS = ['pixelRatio', 'shadows', 'flockDetail'];
/** The preset the three hand settings match now, or 'custom'. */
export function presetOf(graphics) {
  for (const [name, p] of Object.entries(GRAPHICS_PRESETS)) if (PRESET_KEYS.every((k) => graphics[k] === p[k])) return name;
  return 'custom';
}

function defaultStorage() {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}
const clone = (v) => (v == null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));

/** A value for `item` from anything (stored JSON, a slider's string): clamped, validated, else the default. */
export function coerce(item, v) {
  switch (item.type) {
    case 'range': {
      const n = typeof v === 'string' ? parseFloat(v) : v;
      if (!Number.isFinite(n)) return item.def;
      return Math.max(item.min, Math.min(item.max, n));
    }
    case 'bool': return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : item.def;
    case 'choice': { const s = v == null ? '' : String(v); return item.options.some(([o]) => o === s) ? s : item.def; }
    case 'map': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return clone(item.def);
      const out = {};
      for (const [k, c] of Object.entries(v)) if (typeof c === 'string' && c.length <= 32) out[k] = c;
      return out;
    }
    case 'list': return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 64) : clone(item.def);
    default: return clone(item.def);
  }
}

export function defaults() {
  const out = {};
  for (const [g, G] of Object.entries(SETTINGS_SCHEMA)) { out[g] = {}; for (const [k, it] of Object.entries(G.items)) out[g][k] = clone(it.def); }
  return out;
}

/**
 * @param {{ storage?: Storage|null, key?: string, legacySoundKey?: string, events?: { emit(type, p): void } }} [opts]
 *   storage: anything with getItem / setItem (node tests pass a fake, or one that throws); null = nothing is remembered.
 */
export function createSettings(opts = {}) {
  const storage = 'storage' in opts ? opts.storage : defaultStorage();
  const key = opts.key || SETTINGS_STORE.key, legacy = opts.legacySoundKey ?? SETTINGS_STORE.legacySoundKey;
  let events = opts.events || null;
  const values = defaults();
  const subs = [];
  let stored = false;

  const read = (k) => { try { const raw = storage ? storage.getItem(k) : null; return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const d = read(key);
  if (d && d.values && typeof d.values === 'object') {
    stored = true;
    for (const [g, G] of Object.entries(SETTINGS_SCHEMA)) {
      const src = d.values[g];
      if (!src || typeof src !== 'object') continue;
      for (const [k, it] of Object.entries(G.items)) if (k in src) values[g][k] = coerce(it, src[k]);
    }
  } else {
    // Phase 4's sound store (audio-settings.js): its volume and mute carry over once
    const s = legacy ? read(legacy) : null;
    if (s && Number.isFinite(s.volume)) values.sound.volume = coerce(SETTINGS_SCHEMA.sound.items.volume, s.volume);
    if (s && typeof s.muted === 'boolean') values.sound.muted = s.muted;
  }

  function save() {
    try { if (storage) { storage.setItem(key, JSON.stringify({ v: SETTINGS_STORE.version, values })); stored = true; } } catch { /* blocked or full */ }
  }
  function notify(c) {
    for (const s of subs.slice()) {
      if (s.filter && !(c.path === s.filter || c.group === s.filter || c.path.startsWith(`${s.filter}.`))) continue;
      try { s.fn(c); } catch (err) { console.error('settings listener failed', err); }
    }
    try { events?.emit?.(EV.SETTINGS, { group: c.group, key: c.key, value: clone(c.value), prev: clone(c.prev) }); } catch { /* bus */ }
  }
  const split = (path) => { const i = String(path).indexOf('.'); return i < 0 ? [path, null] : [path.slice(0, i), path.slice(i + 1)]; };
  function itemOf(path) {
    const [g, k] = split(path);
    const it = SETTINGS_SCHEMA[g]?.items?.[k];
    if (!it) throw new Error(`unknown setting ${path}`);
    return { g, k, it };
  }
  function put(path, value, changes) {
    const { g, k, it } = itemOf(path);
    const v = coerce(it, value), prev = values[g][k];
    if (JSON.stringify(v) === JSON.stringify(prev)) return v;
    values[g][k] = v;
    changes.push({ group: g, key: k, path: `${g}.${k}`, value: v, prev });
    return v;
  }

  const api = {
    schema: SETTINGS_SCHEMA,
    get available() { try { if (!storage) return false; storage.setItem('__cf_probe__', '1'); storage.removeItem?.('__cf_probe__'); return true; } catch { return false; } },
    /** True once the settings were read from or written to storage (a first run reads false). */
    get stored() { return stored; },
    get(path) { const { g, k } = itemOf(path); return clone(values[g][k]); },
    group(g) { if (!values[g]) throw new Error(`unknown settings group ${g}`); return clone(values[g]); },
    all: () => clone(values),
    set(path, value) {
      const changes = [];
      const v = put(path, value, changes);
      if (changes.length) { save(); for (const c of changes) notify(c); }
      return clone(v);
    },
    setMany(patch = {}) {
      const changes = [];
      for (const [p, v] of Object.entries(patch)) put(p, v, changes);
      if (changes.length) { save(); for (const c of changes) notify(c); }
      return changes.length;
    },
    reset(g = null) {
      const changes = [], def = defaults();
      for (const grp of g ? [g] : Object.keys(SETTINGS_SCHEMA)) for (const k of Object.keys(def[grp] || {})) put(`${grp}.${k}`, def[grp][k], changes);
      if (changes.length) { save(); for (const c of changes) notify(c); }
      return changes.length;
    },
    /** The game's bus (main.js creates the settings before the bus): EV.SETTINGS from then on. */
    attachEvents(ev) { events = ev || null; },
    subscribe(fn, filter = null) {
      const s = { fn, filter };
      subs.push(s);
      return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
    },
  };
  // the Graphics presets (settings package, PHASE5.md §4.1): a preset sets the three hand settings; one of them changed by
  // hand away from the preset reads 'custom' (setMany puts all three before telling anyone, so a preset never reads custom)
  api.subscribe((c) => {
    const gr = values.graphics;
    if (c.key === 'quality') { const p = GRAPHICS_PRESETS[c.value]; if (p) api.setMany(Object.fromEntries(PRESET_KEYS.map((k) => [`graphics.${k}`, p[k]]))); return; }
    if (!PRESET_KEYS.includes(c.key) || gr.quality === 'custom') return;
    const p = GRAPHICS_PRESETS[gr.quality];
    if (p && PRESET_KEYS.some((k) => gr[k] !== p[k])) api.set('graphics.quality', 'custom');
  }, 'graphics');
  // reduced motion follows the setting at once and on every change (motion.js; the CSS class on <html>)
  setMotionOverride(values.interface.reducedMotion);
  api.subscribe((c) => setMotionOverride(c.value), 'interface.reducedMotion');
  // keep the Phase 4 sound key in step (scripts/p5-sound.json reads it; a Phase 4 build reading it after a downgrade)
  api.subscribe(() => {
    try { if (storage && legacy) storage.setItem(legacy, JSON.stringify({ volume: +values.sound.volume.toFixed(3), muted: values.sound.muted })); } catch { /* blocked */ }
  }, 'sound');
  return api;
}

/**
 * The sound group as audio-settings.js createSoundSettings() shapes it, so audio.js and audio-ui.js run on the settings
 * store unchanged: volume (0..1), muted, gain(), state(), set({ volume?, muted? }), toggleMute(), subscribe(fn).
 * levels() adds the three layer sliders (PHASE5.md §2.6: package sound applies them to the engine's layer gains).
 */
export function soundView(settings) {
  const state = () => ({ volume: settings.get('sound.volume'), muted: settings.get('sound.muted') });
  const api = {
    get volume() { return settings.get('sound.volume'); },
    get muted() { return settings.get('sound.muted'); },
    gain() { return settings.get('sound.muted') ? 0 : volumeToGain(settings.get('sound.volume')); },
    state,
    levels: () => ({ background: settings.get('sound.background'), flock: settings.get('sound.flock'), cues: settings.get('sound.cues') }),
    set(patch = {}) {
      const p = {};
      if (patch.volume != null && Number.isFinite(+patch.volume)) p['sound.volume'] = +patch.volume;
      if (typeof patch.muted === 'boolean') p['sound.muted'] = patch.muted;
      settings.setMany(p);
      return state();
    },
    toggleMute() { return api.set({ muted: !settings.get('sound.muted') }); },
    subscribe(fn) { return settings.subscribe(() => fn(state()), 'sound'); },
  };
  return api;
}
