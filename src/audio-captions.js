// Sound captions (PHASE5.md §2.3): a meaningful sound raises EV.SOUND_CAPTION { key, text, x?, z? }; ui.js shows "[text]"
// while settings interface.soundCaptions is on. They come from the game's state, not from the audio graph, so they are
// raised while the sound is off (and before the first click starts it): a player without sound reads them.
// Each key at most once per change (a state key when it comes on, an event key when it happens), at most one caption
// every 8 real seconds (the rest wait in a short queue, the most important first, and go stale). Plain words, the ones
// the look notes use; no caption is a verdict.
//
//   const caps = createCaptions({ emit(p), now() })   now: real seconds (performance.now / 1000 in the game)
//   caps.update(G)      G: { powerOff, rain, genRun, genNear, catching, washer, inside, flock (flockKey()), day }
//   caps.raise(key, { x, z, at })   an event key (thunder, the truck, the phone, the generator starting or stopping); at: a
//                       real time to raise it (a rumble heard after its flash)
//   caps.list()         the captions raised, with their real time [{ key, text, t }]
import { ALARM } from './audio-rules.js';

export const CAPTION_WORDS = {
  alarm: 'Alarm in the house',
  thunderFar: 'Thunder, far off',
  thunderNear: 'Thunder close by',
  rain: 'Rain on the roof',
  genStart: 'Generator starting',
  genRunning: 'Generator running',
  genStop: 'Generator stops',
  truckIn: 'Truck arriving',
  truckOut: 'Truck leaving',
  crew: 'The catching crew at work',
  washer: 'Pressure washer',
  phone: 'Phone ringing',
  peeping: 'Chicks peeping loudly',
  peepingBirds: 'Birds peeping loudly',
  panting: 'Birds panting',
  snicks: 'Snicks and rattles in the flock',
  quiet: 'The flock is quiet',
};
// lower first: what a farmer must not miss
const PRIORITY = { alarm: 0, phone: 1, genStop: 2, genStart: 2, thunderNear: 3, peeping: 4, peepingBirds: 4, snicks: 4, panting: 4,
  quiet: 5, crew: 5, washer: 6, genRunning: 6, truckIn: 6, truckOut: 6, rain: 7, thunderFar: 7 };
export const CAPTION_GAP = 8;   // real seconds between two captions
const STALE = 12;               // a caption still waiting after this is dropped (the sound is over)

/** The flock as a farmer hears it (flockVoice output, the lights): a caption key or null. */
export function flockKey(snd, dark, present, day) {
  if (!present || !snd) return null;
  if (dark) return 'quiet';
  if (snd.distress > 0.3) return day >= 8 ? 'peepingBirds' : 'peeping';
  if (snd.snick > 0.15 || snd.rattle > 0.15) return 'snicks';
  if (snd.pant > 0.3) return 'panting';
  return null;
}

export function createCaptions({ emit, now = () => Date.now() / 1000, gap = CAPTION_GAP } = {}) {
  const raised = [];
  const queue = []; // { key, x, z, at, q } waiting
  const was = { powerOff: false, rain: false, catching: false, washer: false, genNear: false, inside: false, flock: null };
  let lastAt = -1e9, darkAt = -1, darkLate = false, genStartAt = -1e9;
  function push(key, o = {}) {
    if (!CAPTION_WORDS[key]) return false;
    const t = now(), at = Number.isFinite(o.at) ? o.at : t;
    if (queue.some((q) => q.key === key)) return false; // once per change: the same key is not queued twice
    queue.push({ key, x: o.x, z: o.z, at, q: at });
    if (queue.length > 8) queue.shift();
    return true;
  }
  function flush(G) {
    const t = now();
    for (let i = queue.length - 1; i >= 0; i--) if (t - queue[i].at > STALE) queue.splice(i, 1);
    if (t - lastAt < gap) return;
    let best = -1;
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (c.at > t) continue;
      if (c.key === 'alarm' && G && !G.powerOff) { queue.splice(i--, 1); continue; } // the power came back first
      if (best < 0 || PRIORITY[c.key] < PRIORITY[queue[best].key] || (PRIORITY[c.key] === PRIORITY[queue[best].key] && c.at < queue[best].at)) best = i;
    }
    if (best < 0) return;
    const c = queue.splice(best, 1)[0];
    lastAt = t;
    const p = { key: c.key, text: CAPTION_WORDS[c.key] };
    if (Number.isFinite(c.x)) { p.x = c.x; p.z = c.z; }
    raised.push({ key: c.key, text: p.text, t });
    if (raised.length > 200) raised.shift();
    try { emit?.(p); } catch { /* the bus */ }
  }
  return {
    raise(key, o) { const ok = push(key, o); flush(null); return ok; },
    update(G) {
      const t = now();
      // the power cut: the alarm when the house goes dark, and again when its gap grows (after 2 minutes)
      if (G.powerOff && !was.powerOff) { darkAt = t; darkLate = false; push('alarm'); }
      if (G.powerOff && !darkLate && darkAt >= 0 && t - darkAt >= ALARM.lateAfter) { darkLate = true; push('alarm'); }
      if (!G.powerOff) darkAt = -1;
      was.powerOff = !!G.powerOff;
      const rain = (G.rain || 0) > 0.05;
      if (rain && !was.rain) push('rain');             // once per shower
      if ((G.rain || 0) <= 0) was.rain = false; else if (rain) was.rain = true;
      if (G.catching && !was.catching) push('crew');
      was.catching = !!G.catching;
      const wash = !!G.washer;
      if (wash && !was.washer) push('washer');
      was.washer = wash;
      // the generator heard running: coming within earshot of it (not just after its own start caption)
      const near = !!(G.genRun && G.genNear);
      if (near && !was.genNear && t - genStartAt > 20) push('genRunning');
      was.genNear = near;
      // the flock as he hears it on entering the house, or when it changes while he is inside
      const f = G.inside ? G.flock ?? null : null;
      if (f && (f !== was.flock || !was.inside)) push(f);
      was.flock = f; was.inside = !!G.inside;
      flush(G);
    },
    /** an event key for the generator's start, so 'running' does not follow it at once */
    genStarted() { genStartAt = now(); },
    list: () => raised.slice(),
    get pending() { return queue.map((q) => q.key); },
  };
}
