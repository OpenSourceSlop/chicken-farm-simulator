// Sound layer, the game's state as the sound reads it (PHASE5.md §10.1 contract), every frame, muted or not: the captions
// and the thunder planner run on it while the sound is off, and audio.js copies it into the engine's S while it plays.
// Cheap reads only; the flock's voice (flock.sounds() walks every drawn bird) twice a second. No allocation per frame.
//
//   G.powerOff / genRun / genNear       the house dark (farm.power.on false); the generator running (or a test run), heard
//   G.rain / storm / flashes / wet / dryMin / reduced   farm.weatherNow.rain, stormOf(farm), world.weather.flashes and .wet,
//                                       farm minutes since the rain stopped, reduced motion
//   G.cond / catching / crewX / crewZ   farm.condition; the catch from its start to its end; the nearest crew member
//   G.washer / sprayer / scraper / pump the wash bay's machines (ui.busyPanels(), props.carrying), the well pump
//   G.snd / dark / present / flock      the flock's voice (audio-mix flockVoice), lights out, birds in the house, caption key
import { WATER_TANK } from './config.js';
import { flockVoice } from './audio-mix.js';
import { washerOf, PLACES } from './audio-rules.js';
import { flockKey } from './audio-captions.js';
import { COLD, HOT } from './flock-state.js';

const GAME_MIN = 1 / 1440;
export function createGameState({ env, player, flock, farm, ui, props, world, stormOf, reduced }) {
  const G = {
    x: 0, z: 0, inside: false, hour: 10, day: 1, inLevel: false,
    powerOff: false, genRun: false, genNear: false, rain: 0, storm: false, flashes: 0, wet: 0, dryMin: Infinity, reduced: false,
    cond: null, catching: false, crewX: NaN, crewZ: NaN, washer: 0, sprayer: false, scraper: false, pump: false,
    snd: null, dark: false, present: false, flock: null, cold: 0, hot: 0,
  };
  const voice = {};
  let flockAcc = 0, busyAcc = 0, rainDay = NaN, testUntil = -1, busy = [];
  const crewOf = () => { try { return props?.debug?.catchNight || null; } catch { return null; } };
  function readFlock() {
    const B = flock?._state, n = B?.n | 0;
    let cold = 0, hot = 0;
    if (n && B.therm) for (let i = 0; i < n; i++) { const th = B.therm[i]; if (th === COLD) cold++; else if (th === HOT) hot++; }
    G.cold = n ? cold / n : 0; G.hot = n ? hot / n : 0;
    G.dark = env.lightsOn === false;
    G.snd = flockVoice(flock?.sounds ? flock.sounds() : null, G.cold, G.hot, G.dark, voice);
    const alive = G.inLevel ? +farm.flock?.alive : n;
    G.present = n > 0 && !(alive <= 0);
    G.flock = flockKey(G.snd, G.dark, G.present, env.dayNumber ?? env.day);
  }
  return {
    G,
    /** a generator test run (gen.test): heard for `sec` real seconds from realNow */
    test(realNow, sec = 8) { testUntil = realNow + sec; },
    update(dt, realNow) {
      const p = player.position, lvl = farm?.mode === 'level';
      G.x = p.x; G.z = p.z; G.inside = !!player.isInside; G.hour = env.hour; G.day = env.day; G.inLevel = lvl;
      G.powerOff = lvl && farm.power?.on === false;
      G.genRun = (lvl && !!farm.generator?.running) || realNow < testUntil;
      G.genNear = G.genRun && Math.hypot(p.x - PLACES.generator.x, p.z - PLACES.generator.z) < 25;
      const r = lvl ? +farm.weatherNow?.rain || 0 : 0;
      G.rain = r > 0 ? Math.min(1, r) : 0;
      let storm = false;
      try { storm = lvl && !!stormOf?.(farm); } catch { storm = false; }
      G.storm = storm;
      const W = world?.weather;
      G.flashes = W ? W.flashes | 0 : 0;
      G.wet = W ? +W.wet || 0 : 0;
      if (G.rain > 0) rainDay = env.day;
      G.dryMin = Number.isFinite(rainDay) ? Math.max(0, (env.day - rainDay) / GAME_MIN) : Infinity;
      try { G.reduced = !!reduced?.(); } catch { G.reduced = false; }
      G.cond = lvl ? farm.condition || null : null;
      const hv = lvl ? farm.harvest : null;
      G.catching = !!(hv && hv.started && hv.endedAt == null);
      G.crewX = NaN; G.crewZ = NaN;
      const cn = G.catching ? crewOf() : null;
      if (cn && cn.working && cn.crew) {
        let best = Infinity;
        for (const c of cn.crew) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < best) { best = d; G.crewX = c.x; G.crewZ = c.z; } }
      }
      if ((busyAcc -= dt) <= 0) { busyAcc = 0.25; try { busy = ui?.busyPanels ? ui.busyPanels() : []; } catch { busy = []; } }
      const w = washerOf(busy, props?.carrying ?? null, G.inside);
      G.washer = w.washer; G.sprayer = w.sprayer; G.scraper = w.scraper;
      const T = lvl && G.cond === 'water' ? farm.waterTank : null;
      G.pump = !!T && !T.fixing && env.powerOn !== false && (T.levelPct ?? 100) < WATER_TANK.fullPct;
      if ((flockAcc -= dt) <= 0) { flockAcc = 0.5; readFlock(); }
      return G;
    },
    /** the flock's voice now (a teleport into the house: the next frame hears it) */
    refreshFlock() { flockAcc = 0; },
  };
}
