// Sound layer, the level table of the hour check (PHASE5.md §2.2): each event kind's loudest peak (dBFS at the default
// volume, played at its nominal gain), as scripts/p5-sound.json and scripts/p5-sound-scenes.json measure them with an
// OfflineAudioContext (rounded up to the dB, reverb included), and the layer it plays on. A bed's peak is its level plus
// BED_CREST (noise beds peak about 11 dB over their RMS). audio-hour.js sums the four layers' loudest in every second.
export const LOUDEST = {
  // the flock (p5-sound.json: comfortable chicks' layer peaks -24, cold chicks' -22)
  chirp: -24, distress: -22, snick: -24, rattle: -28, flutter: -28, burst: -25,
  // the yard and far off (a placed sound can pan 2 dB louder into one side: included)
  bird: -26, moto: -31, dog: -30, frog: -34, gecko: -34, truck: -28, drip: -32, thunder: -25,
  // the farmer's actions and the machines (p5-sound.json cues alone: peaks -21..-24; p5-sound-scenes events alone)
  door: -22, valve: -24, waterValve: -24, winch: -29, beep: -24, probe: -24, paper: -24, click: -35, tick: -23, box: -23,
  bin: -22, squeeze: -28, alarm: -32, step: -25, crate: -20, ring: -35, dial: -37, pen: -33, scrape: -31,
  genStart: -29, genStop: -28, clunk: -25,
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
