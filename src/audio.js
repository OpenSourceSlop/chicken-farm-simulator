// Sound layer: the game side. createAudio(ctx, deps) -> { update(dt), settings, unlock(), state(), captions(), debug }.
// main.js creates it after the run and calls update(dt) at the end of each frame; everything else is here: the
// AudioContext starts on the first key press or click (the browser's rule), stops while the tab is hidden or the sound is
// off, reads the game (audio-state.js, every frame, muted or not: the captions and the thunder run on it) into engine.S,
// and turns bus events, panel opens and machine keys into cues. Phase 5 (PHASE5.md §2): the layer sliders, the captions,
// the thunder after each flash, the generator, the catch, the wash bay, the office, the well pump; the speaker key is a
// one-click toggle and its controls are in Settings -> Sound (audio-ui.js).
// Files: audio-settings (volume / mute store; the game runs on settings.js soundView), audio-mix / -rules (pure rules),
// audio-synth / -beds / -machines / -voices / -cues / -sched / -scenes / -limit / -engine (Web Audio), audio-state (the
// game read), audio-captions, audio-ui (the speaker key), audio-measure (offline levels), audio-hour (the hour check).
import { EV } from './events.js';
import { FEEDER_LINES_Z, LINE_X, BIRDS_PER_INSTANCE } from './config.js';
import { createSoundSettings, volumeToGain, DEFAULT_VOLUME, SOUND_KEY } from './audio-settings.js';
import { createEngine } from './audio-engine.js';
import { nearWeight, surfaceAt, fanSpinOf, padFlowOf, makeRng } from './audio-mix.js';
import { ringHeard } from './audio-rules.js';
import { createGameState } from './audio-state.js';
import { createThunderPlanner } from './audio-scenes.js';
import { createCaptions } from './audio-captions.js';
import { createSoundUI } from './audio-ui.js';
import { measure } from './audio-measure.js';
import { runHour, HOUR_SCRIPT, hourStats } from './audio-hour.js';
import { stormOf } from './world-cond.js';
import { reducedMotion } from './motion.js';

// farm actions with a sound of their own (EV.ACTION ids; the machine key's click comes from the DOM)
const ACTION_CUES = {
  'water.main': 'waterValve', 'water.flush': 'waterValve', 'water.medicate': 'waterValve', 'water.disinfect': 'waterValve',
  'pad.flush': 'waterValve', 'water.pressure': 'valve', 'feed.valve': 'valve', 'water.clearFilter': 'valve', 'pad.fixFloat': 'valve',
  'water.height': 'winch', 'house.curtain': 'winch', 'sample.weigh': 'beep', 'sample.box': 'beep',
  'floor.probe': 'probe', 'air.probe': 'probe', 'light.lux': 'probe', 'litter.squeeze': 'squeeze',
  'gen.switch': 'clunk', 'feed.order': 'dial',
};
const PAPER_PANELS = new Set(['notebook', 'office-desk', 'summary']);
const GAME_MIN = 1 / 1440;
const typing = (t) => !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
  || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|submit|reset)$/i.test(t.type || 'text')));
const realNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export function createAudio(ctx, deps = {}) {
  const env = ctx.env, player = deps.player || ctx.player, flock = deps.flock || ctx.flock;
  const events = deps.events || ctx.events, farm = deps.farm || ctx.farm, ui = deps.ui || ctx.ui;
  const world = deps.world || ctx.world, props = deps.props || ctx.props, keys = deps.keys || ctx.keys;
  const settings = deps.settings || createSoundSettings();
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let ac = null, engine = null, failed = false, muteTimer = 0;
  let lastGen = null, lastReal = realNow(), startedAt = -1e9;

  // ---- the game, read every frame (muted or not): captions and thunder run on it ----
  const game = createGameState({ env, player, flock, farm, ui, props, world, stormOf, reduced: reducedMotion });
  const G = game.G;
  const planner = createThunderPlanner(makeRng((Math.random() * 2 ** 31) | 0));
  const emitCaption = (p) => { try { events?.emit?.(EV.SOUND_CAPTION, p); } catch { /* the bus */ } };
  const caps = createCaptions({ emit: emitCaption, now: realNow });

  // ---- the game's state for the engine, sampled cheaply ----
  const birdState = () => flock?._state;
  function pickBird(rng, out) {
    const B = birdState(), n = B?.n | 0;
    if (!n || !B.px) return false;
    const i = Math.floor(rng() * n);
    out.x = B.px[i]; out.z = B.pz[i];
    return true;
  }
  /** nearness-weighted real birds around (x, z), from a sample of at most ~240 drawn birds */
  function flockNear(x, z) {
    const B = birdState(), n = B?.n | 0;
    if (!n || !B.px) return 0;
    const stride = Math.max(1, Math.floor(n / 240));
    const alive = farm?.mode === 'level' ? +farm.flock?.alive : NaN;
    const per = Number.isFinite(alive) && alive > 0 ? alive / n : BIRDS_PER_INSTANCE;
    let w = 0;
    for (let i = (Math.random() * stride) | 0; i < n; i += stride) w += nearWeight(Math.hypot(B.px[i] - x, B.pz[i] - z));
    return w * stride * per;
  }
  function augerAt(S) {
    const lines = farm?.mode === 'level' ? farm.feed?.lines : null;
    let sum = 0, best = 0, bx = 0, bz = 0;
    if (lines) for (let i = 0; i < lines.length; i++) {
      if (!lines[i].turning) continue;
      const lz = FEEDER_LINES_Z[i] ?? 0, lx = Math.max(LINE_X.start, Math.min(LINE_X.end, S.x));
      const d = Math.hypot(S.x - lx, S.z - lz), p = Math.exp(-d / 6) * (S.inside ? 1 : 0.25);
      sum += p * p;
      if (p > best) { best = p; bx = lx; bz = lz; }
    }
    S.auger = Math.min(1, Math.sqrt(sum));
    S.augerPan = best > 0 ? panOf(bx - S.x, bz - S.z, S.camYaw) : 0;
  }
  const panOf = (dx, dz, yaw) => { const d = Math.hypot(dx, dz) || 1; return ((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d) * 0.6 * Math.min(1, d / 3); };

  const trickle = { on: false, t0: 0, real: 0 };
  let lastX = NaN, lastZ = NaN, lastDay = NaN, lastNow = 0, slowAcc = 0, flockAcc = 0, lastPanel = null;
  const COPY = ['storm', 'wet', 'dryMin', 'cond', 'genRun', 'catching', 'crewX', 'crewZ', 'washer', 'sprayer', 'scraper', 'pump', 'snd'];
  /** The game into S (engine.S, or an offline engine's for audio-measure). live: the frame's jumps, the panels. */
  function fill(S, dt, live) {
    const p = player.position;
    if (live) {
      // a teleport (a level start, the morning spawn, the harness) is a jump no run covers in the frame's real time
      const now = performance.now(), real = Math.min(2, Math.max(dt, (now - lastNow) / 1000)), moved = Math.hypot(p.x - lastX, p.z - lastZ);
      S.teleport = !(moved < 2.5 + 8 * real);
      S.dist = S.teleport ? 0 : moved;
      S.jump = Number.isFinite(lastDay) && env.day - lastDay > 10 * GAME_MIN;
      lastX = p.x; lastZ = p.z; lastDay = env.day; lastNow = now;
    } else { S.teleport = false; S.jump = false; S.dist = -1; }
    S.x = p.x; S.z = p.z; S.inside = player.isInside; S.speed = player.speed || 0; S.camYaw = player.cameraYaw || 0;
    S.hour = env.hour; S.weather = env.weather; S.day = env.day; S.heaterLevel = env.heaterLevel || 0;
    S.fanSpin = fanSpinOf(env); S.padOn = padFlowOf(env); S.outT = Number.isFinite(env.outsideTemp) ? env.outsideTemp : 26;
    S.rain = G.rain; S.powerOff = G.powerOff;
    for (const k of COPY) S[k] = G[k];
    S.pickBird = pickBird;
    if (trickle.on && live) {
      trickle.real += dt;
      if ((env.day - trickle.t0) / GAME_MIN >= 1.05 || trickle.real > 15) trickle.on = false;
    }
    S.trickle = trickle.on ? Math.max(0, (env.day - trickle.t0) / GAME_MIN) : -1;
    if (!live || (slowAcc -= dt) <= 0 || S.teleport) { slowAcc = 0.25; augerAt(S); }
    if (!live || (flockAcc -= dt) <= 0 || S.teleport) { flockAcc = 0.5; S.flockW = flockNear(S.x, S.z); }
    if (!live) return;
    // a board, a plate or a page opened: paper (the panel host's open id, polled: the sandbox has no bus events)
    const id = ui?.openPanelId ?? null;
    if (id && id !== lastPanel) {
      const el = typeof document !== 'undefined' ? document.querySelector('#hud section.panel:not([hidden])') : null;
      if (id.startsWith('sign-') || PAPER_PANELS.has(id) || el?.querySelector('.sign-head, .plate.is-open')) engine.cue('paper');
    }
    lastPanel = id;
  }

  // ---- starting, muting, hiding; the layer sliders ----
  const levels = () => (settings.levels ? settings.levels() : { background: 1, flock: 1, cues: 1 });
  function applyVolume() {
    if (!engine) return;
    engine.setVolume(settings.gain() / volumeToGain(DEFAULT_VOLUME));
    engine.setLayers(levels());
    clearTimeout(muteTimer);
    if (settings.muted) muteTimer = setTimeout(() => { if (settings.muted) ac?.suspend?.().catch(() => {}); }, 400);
    else if (!document.hidden) ac?.resume?.().catch(() => {});
  }
  function unlock() {
    if (engine || failed || !AC) { if (ac && ac.state !== 'running' && !settings.muted && !document.hidden) ac.resume().catch(() => {}); return !!engine; }
    // the context is made only while the page holds a user activation, so the browser lets it start (else
    // Chrome makes it blocked and warns "The AudioContext was not allowed to start")
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) return false;
    try {
      ac = new AC({ latencyHint: 'interactive' });
      engine = createEngine(ac, { log: 8192, logRing: true });
      startedAt = realNow();
      engine.master.gain.value = 0; // fade in from silence
      applyVolume();
      ac.resume?.().catch(() => {});
    } catch { failed = true; engine = null; ac = null; }
    return !!engine;
  }
  // only the events the HTML rules count as a user activation: a mouse press, a touch or pen lifted (a
  // touch's pointerdown does not count), a key other than Esc; synthetic events never do
  const activates = (e) => e.isTrusted !== false && (e.type === 'keydown' ? e.key !== 'Escape'
    : e.type === 'pointerdown' ? !e.pointerType || e.pointerType === 'mouse'
      : e.type === 'pointerup' ? !!e.pointerType && e.pointerType !== 'mouse' : true);
  const onGesture = (e) => { if (activates(e)) unlock(); };
  // a cue only while the sound plays: nothing raised while it was off or hidden bursts out when it comes back
  const cue = (name, x, z) => { if (engine && ac.state === 'running') engine.cue(name, x, z); };
  const isSoundKey = (e) => (keys?.matches ? keys.matches(e, 'sound') : e.code === SOUND_KEY.code || (!e.code && (e.key || '').toLowerCase() === SOUND_KEY.letter));
  if (typeof window !== 'undefined') {
    for (const t of ['pointerdown', 'pointerup', 'keydown', 'touchend']) window.addEventListener(t, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) ac.suspend().catch(() => {});
      else if (!settings.muted) ac.resume().catch(() => {});
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || typing(e.target)) return;
      if (isSoundKey(e)) settings.toggleMute();
    }, true);
    // machine keys click; a plate unfolding rustles; the flow-test button starts the cup filling
    document.addEventListener('click', (e) => {
      const b = e.target?.closest?.('button');
      if (!b || !engine || !b.closest('#hud')) return;
      if (b.classList.contains('plate-head')) { if (!b.closest('.plate')?.classList.contains('is-open')) cue('paper'); return; }
      if (b.matches('.key, .btn--machine')) cue('click');
      if (/^Flow test/.test(b.textContent.trim()) && !trickle.on) { trickle.on = true; trickle.t0 = env.day; trickle.real = 0; }
    }, true);
    // a pen on the planning sheet while he types into it (the cue's gap: at most 4 a second)
    document.addEventListener('input', (e) => {
      if (ui?.openPanelId === 'plan-sheet' && typing(e.target) && e.target.closest?.('#hud section.panel')) cue('pen');
    }, true);
  }
  settings.subscribe(applyVolume);

  // ---- the bus: what the farmer and the farm do ----
  if (events) {
    events.on(EV.ACTION, (p) => {
      if (!p) return;
      if (p.id === 'gen.test' && p.result?.ok !== false && !farm?.generator?.running) game.test(realNow(), 8); // a test run
      if (!engine) return;
      if (p.id === 'water.flowtest') { trickle.on = false; return; }
      if (p.id === 'feed.line' && p.heightCm != null) { cue('winch'); return; }
      const c = ACTION_CUES[p.id] || (/^phone\./.test(p.id || '') ? 'dial' : null);
      if (c) cue(c);
    });
    events.on(EV.BOX_TIP, (p) => cue('box', +p?.x, +p?.z));
    events.on(EV.JOB_DONE, () => cue('tick'));
    events.on(EV.JOB_SOON, () => cue('click'));   // PHASE4.md §15.2: the soft cue of a job 30 farm minutes from its close
    events.on(EV.WATCH, () => cue('paper'));      // PHASE4.md §15.1: the flock watch's warning goes in the notebook
    events.on(EV.DEAD_DROP, () => cue('bin'));
    events.on(EV.FARM_DELIVERY, (p) => {
      if (p?.phase !== 'arrive' && p?.phase !== 'leave') return;
      cue('truck');
      caps.raise(p.phase === 'arrive' ? 'truckIn' : 'truckOut');
    });
    events.on(EV.LETTER, () => { // the office phone rings when a letter comes, heard within 30 m of the desk
      if (!ringHeard(player.position)) return;
      cue('ring', -34.1, 26.3);
      caps.raise('phone', { x: -34.1, z: 26.3 });
    });
  }

  // the speaker key: a click that has just started the sound (its own press unlocked the context) leaves it on
  const soundUI = typeof document !== 'undefined' ? createSoundUI(settings, { unlock, keys, fresh: () => realNow() - startedAt < 1,
    openSettings: (tab) => ui?.openSettings?.(tab) }) : null;

  return {
    settings,
    unlock,
    get running() { return !!ac && ac.state === 'running'; },
    get engine() { return engine; },
    update(dt) {
      // the game's state and what follows from it whether or not the sound plays: captions, the thunder plan
      const now = realNow(), real = Math.min(1, Math.max(0, now - lastReal));
      lastReal = now;
      game.update(dt, now);
      if (lastGen !== null && G.genRun !== lastGen) { if (G.genRun) { caps.raise('genStart'); caps.genStarted(); } else caps.raise('genStop'); }
      lastGen = G.genRun;
      const plan = planner.update(real, G);
      if (plan) {
        caps.raise(plan.near ? 'thunderNear' : 'thunderFar', { at: now + plan.delay + 0.3 });
        if (engine && ac.state === 'running') engine.thunder(plan);
      }
      caps.update(G);
      // nothing runs before the first gesture, while muted or while the tab is hidden (a suspended clock would only
      // pile automation up)
      if (!engine || ac.state !== 'running') return;
      fill(engine.S, dt, true);
      engine.update(dt);
    },
    /** the sound captions raised so far, with their real time (PHASE5.md §9.2) */
    captions: () => caps.list(),
    /** for tests and the steps files: the context state, the voices sounding and the targets */
    state() {
      const p = player.position;
      return { started: !!engine, ctx: ac?.state ?? null, muted: settings.muted, volume: settings.volume, levels: levels(),
        layers: engine ? engine.layers : null, voices: engine ? engine.voicesAt() : 0, k: engine?.S.k ?? null,
        surface: surfaceAt(p.x, p.z), trickle: trickle.on, played: engine ? { ...engine.counts } : null,
        game: { powerOff: G.powerOff, genRun: G.genRun, storm: G.storm, catching: G.catching, washer: G.washer, pump: G.pump, flock: G.flock } };
    },
    debug: {
      /** render a few seconds of the current scene offline: per-layer peak and RMS (audio-measure.js) */
      measure: (opts) => measure((S) => { game.refreshFlock(); game.update(0.001, realNow()); fill(S, 0.05, false); }, opts),
      /** the long-session check (PHASE5.md §2.2): with a script, the scripted hour on a fake clock (audio-hour.js); with
       *  none, the live engine's caps, gaps and repeats since it started */
      hour: (script) => (script ? runHour(script === true ? HOUR_SCRIPT : script) : engine ? hourStats(engine.lim.events()) : null),
      planner,
      game: G,
    },
    dispose() { soundUI?.dispose?.(); ac?.close?.().catch(() => {}); },
  };
}
