// Sound layer, the Phase 5 situations on the engine (PHASE5.md §2.1-2.2): the targets of the new beds (ten times a
// second) and their events (every frame): drips off the eaves and crate clacks (Poisson, four variants, never the same
// twice), thunder (flash-driven: createThunderPlanner, shared with the captions so both hear the same rumble), the power
// cut's alarm with its growing gap, the generator's start / stop on the machine bed, the ear's habituation to the crew and
// the generator. Every event goes through the per-minute caps (audio-limit.js) and is logged for the hour check.
import { dbToGain, gainToDb, nextGap, pick, range, lerp, smooth, clamp } from './audio-mix.js';
import { PLACES, CAPS, machineOwner, dayCicadas, dripRate, thunderOf, THUNDER_TIMER, alarmGap, ALARM, deskFanTarget,
  crewTarget, crateRate, wallDistance, MACHINES } from './audio-rules.js';
import { VARIANTS } from './audio-cues.js';
import * as C from './audio-cues.js';
import { HOUSE_BOUNDS } from './config.js';

// peak gains of the new events (dBFS before the recipe's filters), calibrated with scripts/p5-sound-scenes.json so drips
// sit at -48 (loudest 100 ms), crates -38, the alarm -38, a near rumble -38 +- 3 over its first 2 s
export const EVENT5_DB = { drip: -35, crate: -27, thunder: -14, alarm: -29 };
const expo = (rng) => -Math.log(1 - rng() * 0.999999);

/**
 * Thunder from the lightning (one rumble per flash, its delay km / 0.343 s), or, under reduced motion (no flashes), an
 * exponential timer (mean 40 s, never under 20 s) while the storm lasts. At most CAPS.thunder rumbles a minute and one at a
 * time (a flash while one still rolls is silent). Real seconds. update() returns the rumble planned now or null:
 * { at (real s it starts), km, delay, len, near, v (variant), flashAt }.
 */
export function createThunderPlanner(rng, { cap = CAPS.thunder } = {}) {
  let now = 0, seen = null, rmAt = 0, end = -1e9, vLast = -1;
  const recent = new Float64Array(8).fill(-1e9);
  let ri = 0;
  const plan = { at: 0, km: 0, delay: 0, len: 0, near: false, v: 0, flashAt: 0 };
  function make(at0, kmFixed, flash) {
    thunderOf(rng, kmFixed, plan);
    if (!flash) plan.delay = 0; // the reduced-motion timer: no flash to follow
    plan.flashAt = at0; plan.at = at0 + plan.delay;
    let n = 0;
    for (let i = 0; i < recent.length; i++) if (recent[i] > plan.at - 60) n++;
    if (n >= cap || plan.at < end) return null;
    plan.v = pick(rng, VARIANTS.thunder, vLast); vLast = plan.v;
    recent[ri] = plan.at; ri = (ri + 1) % recent.length;
    end = plan.at + plan.len + 0.05;
    return plan;
  }
  return {
    get now() { return now; },
    /** dt real s; G: { flashes (world.weather.flashes), storm, reduced (reduced motion), thunderKm? (a fixed distance) } */
    update(dt, G) {
      now += Math.max(0, dt || 0);
      const f = G.flashes | 0;
      let out = null;
      if (seen === null) seen = f;
      if (f > seen) { seen = f; out = make(now, G.thunderKm, true); }
      else if (f < seen) seen = f;
      if (G.storm && G.reduced) {
        if (rmAt <= 0) rmAt = now + nextGap(rng, THUNDER_TIMER.mean, THUNDER_TIMER.min);
        else if (now >= rmAt) { rmAt = now + nextGap(rng, THUNDER_TIMER.mean, THUNDER_TIMER.min); if (!out) out = make(now, G.thunderKm, false); }
      } else rmAt = 0;
      return out;
    },
  };
}

/** The ear gets used to a steady sound he stands beside: -3 dB after 2 real minutes in one place, back at once when he moves
 *  4 m or the sound changes (sig). */
export function createPlaceHabit() {
  let ax = NaN, az = NaN, t = 0, sig = null;
  return {
    update(dt, x, z, heard, s) {
      if (!heard || s !== sig || !(Math.hypot(x - ax, z - az) < 4)) { ax = x; az = z; t = 0; sig = s; }
      else t += dt;
      return lerp(1, 0.708, smooth(90, 120, t));
    },
    get seconds() { return t; },
  };
}

export function createScenes({ pools, machines, S, rng, pan, lim }) {
  const M = { owner: -1, gain: 0, gains: new Float64Array(MACHINES.length), pan: 0, inside: false, carried: false };
  const T = { machine: M, dayCic: 0, crew: 0, crewPan: 0, desk: 0, storm: 0 };
  const habCrew = createPlaceHabit(), habGen = createPlaceHabit();
  const u = { drip: expo(rng), crate: expo(rng) };
  const last = { drip: -1, crate: -1 };
  let lastGen = null, darkAt = -1, alarmAt = 0, habDt = 0, genCueAt = -1e9;
  const pend = []; // planned rumbles (at most two: one rolling, one waiting)
  const peak = (k) => dbToGain(EVENT5_DB[k]);
  const at = (P) => pan(P.x - S.x, P.z - S.z);
  return {
    T,
    /** ten times a second: the beds' targets */
    targets(now, dt) {
      habDt = dt;
      machineOwner(S, M);
      const name = M.owner >= 0 ? MACHINES[M.owner] : null;
      if (name === 'generator') M.gain *= habGen.update(dt, S.x, S.z, true, S.genRun ? 1 : 0); else habGen.update(dt, S.x, S.z, false, 0);
      M.inside = !!S.inside;
      M.carried = S.washer === 2;
      M.pan = name === 'generator' ? at(PLACES.generator) : name === 'washer' && S.washer === 1 ? at(PLACES.washBay)
        : name === 'pump' ? at(PLACES.pump) : name === 'truck' ? at(PLACES.loadingBay) : 0;
      const k = clamp(S.k ?? (S.inside ? 1 : 0), 0, 1), wall = lerp(1, 0.13, k);
      T.dayCic = dayCicadas(S.hour, S.cond) * wall;
      const crew = crewTarget(S);
      T.crew = crew * habCrew.update(dt, S.x, S.z, crew > 0.02, S.catching ? 1 : 0);
      T.crewPan = Number.isFinite(S.crewX) ? pan(S.crewX - S.x, S.crewZ - S.z) : at(PLACES.catchPanels);
      T.desk = deskFanTarget(S);
      T.storm = S.storm ? wall : 0;
      return T;
    },
    /** a planned rumble (createThunderPlanner) to start `delay` s from now on the audio clock */
    thunder(p, now) {
      if (pend.length >= 2) return false;
      pend.push({ t: now + p.delay, km: p.km, len: p.len, near: p.near, v: p.v, delay: p.delay });
      return true;
    },
    /** every frame: t = the start time for anything now; on = { out, cues } (a layer at 0 schedules nothing) */
    update(dt, now, t, on) {
      // thunder on its planned time: outside, or through the roof (-6 dB, under 400 Hz)
      for (let i = pend.length - 1; i >= 0; i--) {
        const p = pend[i];
        if (p.t > t + 0.05) continue;
        pend.splice(i, 1);
        const ang = rng() * Math.PI * 2;
        if (on.out && machines.thunder(Math.max(p.t, t), p, peak('thunder'), !!S.inside, pan(Math.cos(ang), Math.sin(ang)), p.v)) lim.note('thunder', Math.max(p.t, t), p.v, gainToDb((S.inside ? 0.5 : 1) * (p.near ? 1 : 0.5)), p.delay);
      }
      // drips off the eaves (outside, within 6 m of a wall, after the rain)
      const dr = on.out ? dripRate(S) : 0;
      if (dr > 0 && (u.drip -= dr * dt) <= 0) {
        u.drip = expo(rng);
        if (lim.allow('drip', t)) {
          const B = HOUSE_BOUNDS, x = clamp(S.x + range(rng, -4, 4), B.xMin, B.xMax), z = S.z > 0 ? B.zMax + 0.6 : B.zMin - 0.6;
          const v = pick(rng, VARIANTS.drip, last.drip), g = peak('drip') * range(rng, 0.6, 1) / (1 + wallDistance(S.x, S.z, false) / 4);
          if (C.drip(pools.out, t, g, pan(x - S.x, z - S.z), v, rng)) { last.drip = v; lim.note('drip', t, v, gainToDb(g / peak('drip'))); }
        }
      }
      // crate clacks near the crew and the panels
      const cr = on.cues ? crateRate(S) : 0;
      if (cr > 0 && (u.crate -= cr * dt) <= 0) {
        u.crate = expo(rng);
        if (lim.allow('crate', t)) {
          const cx = Number.isFinite(S.crewX) ? S.crewX : PLACES.catchPanels.x, cz = Number.isFinite(S.crewZ) ? S.crewZ : PLACES.catchPanels.z;
          const x = cx + range(rng, -2, 2), z = cz + range(rng, -1.5, 1.5), d = Math.hypot(x - S.x, z - S.z);
          const v = pick(rng, VARIANTS.crate, last.crate), g = peak('crate') * range(rng, 0.6, 1) / (1 + d / 5);
          if (C.crate(pools.cues, t, g, pan(x - S.x, z - S.z), v, rng)) { last.crate = v; lim.note('crate', t, v, gainToDb(g / peak('crate'))); }
        }
      }
      // the controller's alarm in a dark house: every 6 s for the first two minutes, then every 15 s, never stopping
      if (S.powerOff) {
        if (darkAt < 0) { darkAt = t; alarmAt = t; }
        if (t + 0.04 >= alarmAt) { // on its own times (not the frames'): exactly 6 s, then 15 s apart
          const at0 = Math.max(alarmAt, t), dark = at0 - darkAt;
          alarmAt = at0 + alarmGap(dark);
          const P = PLACES.controller, d = Math.hypot(S.x - P.x, S.z - P.z);
          if (on.cues && d < 30 && lim.allow('alarm', at0, dark >= ALARM.lateAfter + 60)) {
            const g = peak('alarm') / (1 + d / 6);
            if (C.alarm2(pools.cues, at0, g, at(P))) lim.note('alarm', at0, -1, gainToDb(g / peak('alarm')), dark);
          }
        }
      } else darkAt = -1;
      // the generator: the starter cranks and it catches; stopped, it runs down
      const run = !!S.genRun;
      if (lastGen !== null && run !== lastGen && !S.jump && !S.teleport) {
        if (run) machines.genStart(t); else machines.genStop(t);
        const kind = run ? 'genStart' : 'genStop';
        if (on.cues && t >= genCueAt + 2 && lim.allow(kind, t)) {
          genCueAt = t;
          const g = dbToGain(run ? -30 : -34) * Math.exp(-Math.hypot(S.x - PLACES.generator.x, S.z - PLACES.generator.z) / 20) * (S.inside ? 0.4 : 1);
          if ((run ? C.crank : C.genStop)(pools.cues, t, g, rng)) lim.note(kind, t, -1, gainToDb(g / dbToGain(run ? -30 : -34)));
        }
      }
      lastGen = run;
      return habDt;
    },
    /** a footfall at t on `surface`: the scraper scrapes on the litter, the washer's hiss rises with the step */
    step(t, surface, on) {
      if (S.washer === 2) machines.stepPulse(t);
      if (on.cues && S.scraper && surface === 'litter' && C.scrape(pools.cues, t + 0.01, dbToGain(-34), rng)) lim.note('scrape', t, -1, 0);
    },
    get pending() { return pend.length; },
  };
}
