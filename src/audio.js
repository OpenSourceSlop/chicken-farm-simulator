// Sound layer: the game side. createAudio(ctx, deps) -> { update(dt), settings, unlock(), state(), debug }.
// main.js creates it after the level and calls update(dt) at the end of each frame; everything else is
// here: the AudioContext starts on the first key press or click (the browser's rule), stops while the
// tab is hidden or the sound is off, reads the farmer, the clock, the house and the flock every frame
// into engine.S (no allocation per frame), and turns bus events, panel opens and machine keys into cues.
// Files: audio-settings (volume / mute store), audio-mix (pure rules), audio-synth / -beds / -voices /
// -sched / -engine (Web Audio), audio-ui (the speaker button), audio-measure (offline level checks).
import { EV } from './events.js';
import { FEEDER_LINES_Z, LINE_X, BIRDS_PER_INSTANCE } from './config.js';
import { createSoundSettings, volumeToGain, DEFAULT_VOLUME, SOUND_KEY } from './audio-settings.js';
import { createEngine } from './audio-engine.js';
import { nearWeight, surfaceAt, flockVoice, fanSpinOf, padFlowOf } from './audio-mix.js';
import { COLD, HOT } from './flock-state.js';
import { createSoundUI } from './audio-ui.js';
import { measure } from './audio-measure.js';

// farm actions with a sound of their own (EV.ACTION ids; the machine key's click comes from the DOM)
const ACTION_CUES = {
  'water.main': 'waterValve', 'water.flush': 'waterValve', 'water.medicate': 'waterValve', 'water.disinfect': 'waterValve',
  'pad.flush': 'waterValve', 'water.pressure': 'valve', 'feed.valve': 'valve', 'water.clearFilter': 'valve', 'pad.fixFloat': 'valve',
  'water.height': 'winch', 'house.curtain': 'winch', 'sample.weigh': 'beep', 'sample.box': 'beep',
  'floor.probe': 'probe', 'air.probe': 'probe', 'light.lux': 'probe', 'litter.squeeze': 'squeeze',
};
const PAPER_PANELS = new Set(['notebook', 'office-desk', 'summary']);
const GAME_MIN = 1 / 1440;
const typing = (t) => !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
  || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|submit|reset)$/i.test(t.type || 'text')));

export function createAudio(ctx, deps = {}) {
  const env = ctx.env, player = deps.player || ctx.player, flock = deps.flock || ctx.flock;
  const events = deps.events || ctx.events, farm = deps.farm || ctx.farm, ui = deps.ui || ctx.ui;
  const settings = deps.settings || createSoundSettings();
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let ac = null, engine = null, failed = false, muteTimer = 0;

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
  const voice = {}; // flockVoice's output, reused
  let lastX = NaN, lastZ = NaN, lastDay = NaN, lastNow = 0, slowAcc = 0, flockAcc = 0, lastPanel = null;
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
    S.rain = +farm?.weatherNow?.rain || 0;
    S.powerOff = farm?.mode === 'level' && farm.power?.on === false;
    S.pickBird = pickBird;
    if (trickle.on && live) {
      trickle.real += dt;
      if ((env.day - trickle.t0) / GAME_MIN >= 1.05 || trickle.real > 15) trickle.on = false;
    }
    S.trickle = trickle.on ? Math.max(0, (env.day - trickle.t0) / GAME_MIN) : -1;
    if (!live || (slowAcc -= dt) <= 0 || S.teleport) { slowAcc = 0.25; augerAt(S); }
    if (!live || (flockAcc -= dt) <= 0 || S.teleport) { // the flock: twice a second (sounds() walks every bird)
      flockAcc = 0.5;
      const B = birdState(), n = B?.n | 0;
      let cold = 0, hot = 0;
      if (n && B.therm) for (let i = 0; i < n; i++) { const th = B.therm[i]; if (th === COLD) cold++; else if (th === HOT) hot++; }
      S.snd = flockVoice(flock?.sounds ? flock.sounds() : null, n ? cold / n : 0, n ? hot / n : 0, env.lightsOn === false, voice);
      S.flockW = flockNear(S.x, S.z);
    }
    if (!live) return;
    // a board, a plate or a page opened: paper (the panel host's open id, polled: the sandbox has no bus events)
    const id = ui?.openPanelId ?? null;
    if (id && id !== lastPanel) {
      const el = typeof document !== 'undefined' ? document.querySelector('#hud section.panel:not([hidden])') : null;
      if (id.startsWith('sign-') || PAPER_PANELS.has(id) || el?.querySelector('.sign-head, .plate.is-open')) engine.cue('paper');
    }
    lastPanel = id;
  }

  // ---- starting, muting, hiding ----
  function applyVolume() {
    if (!engine) return;
    const g = settings.gain() / volumeToGain(DEFAULT_VOLUME);
    engine.setVolume(g);
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
      engine = createEngine(ac);
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
  if (typeof window !== 'undefined') {
    for (const t of ['pointerdown', 'pointerup', 'keydown', 'touchend']) window.addEventListener(t, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) ac.suspend().catch(() => {});
      else if (!settings.muted) ac.resume().catch(() => {});
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.code === SOUND_KEY.code || (!e.code && (e.key || '').toLowerCase() === SOUND_KEY.letter)) settings.toggleMute();
    }, true);
    // machine keys click; a plate unfolding rustles; the flow-test button starts the cup filling
    document.addEventListener('click', (e) => {
      const b = e.target?.closest?.('button');
      if (!b || !engine || !b.closest('#hud')) return;
      if (b.classList.contains('plate-head')) { if (!b.closest('.plate')?.classList.contains('is-open')) cue('paper'); return; }
      if (b.matches('.key, .btn--machine')) cue('click');
      if (/^Flow test/.test(b.textContent.trim()) && !trickle.on) { trickle.on = true; trickle.t0 = env.day; trickle.real = 0; }
    }, true);
  }
  settings.subscribe(applyVolume);

  // ---- the bus: what the farmer and the farm do ----
  if (events) {
    events.on(EV.ACTION, (p) => {
      if (!engine || !p) return;
      if (p.id === 'water.flowtest') { trickle.on = false; return; }
      if (p.id === 'feed.line' && p.heightCm != null) { cue('winch'); return; }
      const c = ACTION_CUES[p.id];
      if (c) cue(c);
    });
    events.on(EV.BOX_TIP, (p) => cue('box', +p?.x, +p?.z));
    events.on(EV.JOB_DONE, () => cue('tick'));
    events.on(EV.JOB_SOON, () => cue('click'));   // PHASE4.md §15.2: the soft cue of a job 30 farm minutes from its close
    events.on(EV.WATCH, () => cue('paper'));      // PHASE4.md §15.1: the flock watch's warning goes in the notebook
    events.on(EV.DEAD_DROP, () => cue('bin'));
    events.on(EV.FARM_DELIVERY, (p) => { if (p?.phase === 'arrive' || p?.phase === 'leave') cue('truck'); });
  }

  const soundUI = typeof document !== 'undefined' ? createSoundUI(settings, { unlock }) : null;

  return {
    settings,
    unlock,
    get running() { return !!ac && ac.state === 'running'; },
    get engine() { return engine; },
    update(dt) {
      // nothing runs before the first gesture, while muted or while the tab is hidden (a suspended
      // clock would only pile automation up)
      if (!engine || ac.state !== 'running') return;
      fill(engine.S, dt, true);
      engine.update(dt);
    },
    /** for tests and the steps files: the context state, the voices sounding and the targets */
    state() {
      const p = player.position;
      return { started: !!engine, ctx: ac?.state ?? null, muted: settings.muted, volume: settings.volume,
        voices: engine ? engine.voicesAt() : 0, k: engine?.S.k ?? null, surface: surfaceAt(p.x, p.z), trickle: trickle.on,
        played: engine ? { ...engine.counts } : null };
    },
    debug: {
      /** render a few seconds of the current scene offline: per-layer peak and RMS (audio-measure.js) */
      measure: (opts) => measure((S) => fill(S, 0.05, false), opts),
    },
    dispose() { soundUI?.dispose?.(); ac?.close?.().catch(() => {}); },
  };
}
