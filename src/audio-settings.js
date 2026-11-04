// Sound settings: volume and mute, remembered in localStorage (inside try/catch: private windows and
// blocked site data must never break the game). One small module with no DOM and no Web Audio, so the
// Phase 5 settings menu can reuse it as it is:
//
//   const s = createSoundSettings();            // reads the stored values (defaults if none)
//   s.volume (0..1), s.muted, s.gain()           // gain() = the master gain the mixer applies
//   s.set({ volume: 0.5 }); s.toggleMute();      // both save and tell every subscriber
//   const off = s.subscribe((st) => ...);        // st = { volume, muted }
//
// The sound key: M is the litter moisture view in a level (ui.js, LEVEL_HELP_KEYS), so sound on / off
// is on U. A settings menu that rebinds keys changes SOUND_KEY here.

export const SOUND_STORE_KEY = 'chicken-farm.sound';
export const SOUND_KEY = { code: 'KeyU', letter: 'u', label: 'U' };
/** Slider position the game starts at (0..1). With the curve below it is about -6 dB under full scale. */
export const DEFAULT_VOLUME = 0.7;

/** Slider (0..1) to master gain: a squared curve, so the low half of the slider is usable. */
export const volumeToGain = (v) => {
  const x = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  return x * x;
};

function defaultStorage() {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

/**
 * @param {{ storage?: Storage | null, key?: string }} [opts] storage: anything with getItem / setItem
 *   (node tests pass a fake, or one that throws); null = nothing is remembered.
 */
export function createSoundSettings(opts = {}) {
  const storage = 'storage' in opts ? opts.storage : defaultStorage();
  const key = opts.key || SOUND_STORE_KEY;
  const st = { volume: DEFAULT_VOLUME, muted: false };
  const subs = [];

  try {
    const raw = storage ? storage.getItem(key) : null;
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Number.isFinite(d.volume)) st.volume = Math.max(0, Math.min(1, d.volume));
      if (d && typeof d.muted === 'boolean') st.muted = d.muted;
    }
  } catch { /* unreadable or blocked: keep the defaults */ }

  function save() {
    try { if (storage) storage.setItem(key, JSON.stringify({ volume: +st.volume.toFixed(3), muted: st.muted })); } catch { /* blocked */ }
  }
  function notify() {
    for (const fn of subs.slice()) { try { fn(api.state()); } catch { /* one bad listener must not stop the others */ } }
  }

  const api = {
    get volume() { return st.volume; },
    get muted() { return st.muted; },
    /** The gain the master bus applies: 0 when muted. */
    gain() { return st.muted ? 0 : volumeToGain(st.volume); },
    state() { return { volume: st.volume, muted: st.muted }; },
    set(patch = {}) {
      let changed = false;
      if (patch.volume != null && Number.isFinite(+patch.volume)) {
        const v = Math.max(0, Math.min(1, +patch.volume));
        if (v !== st.volume) { st.volume = v; changed = true; }
      }
      if (typeof patch.muted === 'boolean' && patch.muted !== st.muted) { st.muted = patch.muted; changed = true; }
      if (changed) { save(); notify(); }
      return api.state();
    },
    toggleMute() { return api.set({ muted: !st.muted }); },
    subscribe(fn) {
      subs.push(fn);
      return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    },
  };
  return api;
}
