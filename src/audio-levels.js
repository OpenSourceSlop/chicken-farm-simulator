// Sound layer, the level table of the hour check (PHASE5.md §2.2): each event kind's loudest peak (dBFS at the default
// volume, played at its nominal gain), as scripts/p5-sound.json and scripts/p5-sound-scenes.json measure them with an
// OfflineAudioContext (rounded up to the dB, reverb included), and the layer it plays on. A bed's peak is its level plus
// BED_CREST (noise beds peak about 11 dB over their RMS). audio-hour.js sums the four layers' loudest in every second.
export const LOUDEST = {
  // the flock
  chirp: -27, distress: -24, snick: -27, rattle: -31, flutter: -31, burst: -27,
  // the yard and far off
  bird: -28, moto: -33, dog: -32, frog: -36, gecko: -36, truck: -30, drip: -37, thunder: -20,
  // the farmer's actions and the machines
  door: -24, valve: -26, waterValve: -26, winch: -31, beep: -26, probe: -26, paper: -26, click: -37, tick: -25, box: -25,
  bin: -24, squeeze: -30, alarm: -28, step: -27, crate: -27, ring: -30, dial: -33, pen: -35, scrape: -31,
  genStart: -27, genStop: -31, clunk: -27,
};
export const BED_CREST = 11;
const LAYER = {
  outside: ['bird', 'moto', 'dog', 'frog', 'gecko', 'truck', 'drip', 'thunder'],
  flock: ['chirp', 'distress', 'snick', 'rattle', 'flutter', 'burst'],
};
const BY_KIND = new Map();
for (const [layer, kinds] of Object.entries(LAYER)) for (const k of kinds) BY_KIND.set(k, layer);
/** the layer an event kind plays on (every other kind: the cues) */
export const layerOf = (kind) => BY_KIND.get(kind) || 'cues';
