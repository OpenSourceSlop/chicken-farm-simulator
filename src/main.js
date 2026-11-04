// Boot, render loop and module wiring. Owner: integrator.
import * as THREE from 'three';
import { clock as inputClock } from './clock.js';
import * as config from './config.js';
import { HOUSE } from './config.js';
import { createSim } from './sim.js';
import { buildWorld } from './world.js';
import { buildHouse } from './house.js';
import { createPlayer } from './player.js';
import { createFlock } from './flock.js';
import { createUI } from './ui.js';
// Phase 2 (PHASE2.md): shared bus and registry, farm model, records, skills, save, props, level
import { createEvents } from './events.js';
import { createInteract } from './interact.js';
import { buildCondScene } from './props-cond.js'; // Phase 4 (package "scene"; PHASE4.md §10.7)
import { createFarm } from './farm.js';
import { createRecords } from './records.js';
import { createSkills } from './skills.js';
import { createSaveStore } from './save.js';
import { buildProps } from './props.js';
import { createLevel } from './level.js';
// Phase 3 (PHASE3.md): the run of seven levels on one flock (a stub until package "run" builds it)
import { createRun } from './run.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // release the test context at once
    return !!gl;
  } catch {
    return false;
  }
}

// Highest pixel ratio we render at: 1.5 keeps 4K panels and 150 % Windows scaling sharp enough
// without paying for 4x the pixels.
const MAX_PIXEL_RATIO = 1.5;

function showBootError(message) {
  const boot = document.getElementById('boot');
  if (boot) {
    boot.hidden = false;
    boot.classList.add('boot--error');
    boot.textContent = message;
  }
}

function start(saved = {}) {
  const canvas = document.getElementById('game');
  if (!webglAvailable()) {
    showBootError('This game needs WebGL. Open it in a recent desktop browser such as Chrome, Edge, Firefox or Safari.');
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // quality.ratioCap drops if the frame-time governor finds the GPU too slow (see frame())
  const quality = { ratioCap: MAX_PIXEL_RATIO, step: 0 };
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, quality.ratioCap);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);

  // perf: read by the Phase 1 test tools (frame rate the approver can report)
  const perf = { fps: 0, pixelRatio: renderer.getPixelRatio(), shadowMap: 2048 };
  const ctx = { THREE, renderer, scene, camera, canvas, config, perf };

  const env = createSim();
  ctx.env = env;
  if (saved.env) Object.assign(env, saved.env);

  // Phase 2 core, created before any 3D module so they can all read ctx.events and ctx.farm.
  const events = createEvents();
  ctx.events = events;
  const farm = createFarm(env, { events });
  ctx.farm = farm;
  env.addStepper(farm.step);         // the farm integrates with every climate step, skips included
  const records = createRecords({ farm, env, events });
  const skills = createSkills({ events, records, farm });
  const save = createSaveStore();
  ctx.records = records;
  ctx.skills = skills;

  const world = buildWorld(ctx);
  const house = buildHouse(ctx);
  // ctx.interact: every module registers what E can reach; Phase 1 boards are its first entries.
  const interact = createInteract([...world.interactables, ...house.interactables]);
  ctx.interact = interact;
  const props = buildProps(ctx, { house, world });
  ctx.props = props;                 // flock and ui call props.startCarry / props.drop (PHASE2.md §13.6)
  const condScene = buildCondScene(ctx); // Phase 4: the conditions' machines, rain, the power cut
  ctx.condScene = condScene;
  // ctx.colliders: the one array the farmer collides with; props may add / remove its own entries.
  const colliders = [...world.colliders, ...house.colliders, ...props.colliders];
  ctx.colliders = colliders;
  const player = createPlayer(ctx, { colliders });
  ctx.player = player;
  const flock = createFlock(ctx, { house });
  ctx.flock = flock;
  const interactables = interact.list;
  const deps = { farm, records, skills, save, player, flock, props, interact, events };
  const ui = createUI(ctx, { ...deps, house, world, interactables });
  const level = createLevel(ctx, { ...deps, ui });
  ctx.level = level;
  const run = createRun({ level, save, events, farm, env, records });
  ctx.run = run;

  if (saved.player) player.teleport(saved.player.x, saved.player.z, saved.player.yaw);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    // browser zoom or another screen changes devicePixelRatio: follow it (up to the cap)
    if (renderer.getPixelRatio() !== pixelRatio()) renderer.setPixelRatio(pixelRatio());
    perf.pixelRatio = renderer.getPixelRatio();
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // One simulation step. dt is real seconds.
  const view = { camera, playerPos: player.position, playerInside: false, night: 0 };
  function step(dt) {
    env.update(dt);
    player.update(dt);
    view.playerInside = player.isInside;
    world.update(dt, env, view);
    view.night = world.night; // the world's day/night state drives the house lights too
    house.update(dt, env, view);
    props.update(dt, env, view);
    condScene.update(dt, env, view);
    flock.update(dt, env, player.position);
    ui.update(dt);
    level.update(dt);
  }

  // Frame-time governor: if the median frame over 2 s is slower than about 28 fps, step quality
  // down: high-DPI screens to 1.0 pixel ratio first, then a cheaper sun shadow, and only below
  // about 20 fps a 0.85 render scale (which softens the picture). A browser capped at 30 fps
  // (battery saver) never triggers it. It only steps down, waits 3 s between steps, and is off
  // under automation (the screenshot harness renders in software).
  const governor = { on: !navigator.webdriver, times: new Float32Array(120), n: 0, acc: 0, hold: 4 };
  function govern(rawDt) {
    perf.fps += (1 / Math.max(rawDt, 1e-3) - perf.fps) * 0.05;
    if (!governor.on || document.hidden) return;
    if ((governor.hold -= rawDt) > 0) return;
    governor.times[governor.n++ % governor.times.length] = rawDt;
    if ((governor.acc += rawDt) < 2) return;
    const k = Math.min(governor.n, governor.times.length);
    const sorted = Array.from(governor.times.subarray(0, k)).sort((a, b) => a - b);
    governor.acc = 0; governor.n = 0;
    const median = sorted[k >> 1];
    if (median <= 0.036) return;
    governor.hold = 3;
    const ratio = renderer.getPixelRatio();
    if (ratio > 1.01) quality.ratioCap = 1;
    else if (world.sun && world.sun.shadow.mapSize.x > 1024) {
      renderer.shadowMap.type = THREE.PCFShadowMap;
      world.sun.shadow.mapSize.set(1024, 1024);
      world.sun.shadow.map?.dispose();
      world.sun.shadow.map = null;
      perf.shadowMap = 1024;
      scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    } else if (ratio > 0.86 && median > 0.05) quality.ratioCap = 0.85;
    else { governor.on = false; return; }
    quality.step++;
    resize();
  }

  const clock = new THREE.Clock();
  let frames = 0;
  let running = true;
  let failures = 0;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame); // first, so one bad frame cannot stop the loop by itself
    const raw = clock.getDelta();
    try {
      step(Math.min(raw, 0.05));
      renderer.render(scene, camera);
      frames++;
      failures = 0;
      govern(raw);
    } catch (err) {
      console.error(err);
      if (++failures >= 3) {
        running = false;
        showBootError(`The farm stopped: ${err && err.message ? err.message : err}. Reload the page to start again.`);
      }
    }
  }

  // Test and tooling hooks (used by scripts/shoot.mjs and the Phase 1 test tools)
  const game = {
    ready: true,
    THREE, scene, camera, renderer, env, world, house, player, flock, ui,
    config,                       // the config module (steps files read the signs' numbers from it)
    // Phase 2 (PHASE2.md "Test hooks")
    events, farm, records, skills, save, props, interact, level,
    // Phase 3 (PHASE3.md §15): the run; startLevel({ level }) for a later level is a standard start
    // (stub: level.debug.freeRun to its start); cycleAt(day, hour) = a level-mode farm at any age
    run,
    startRun(opts = {}) { return run.startRun(opts); },
    startLevel(opts = {}) { return opts.level && opts.level !== 'level1' ? run.startLevel(opts.level, opts) : level.start(opts); },
    cycleAt(day, hour = 6) { return level.debug.freeRun(day, hour); },
    // Phase 4 (PHASE4.md §11): the harder conditions. startRun({ condition }) / startLevel({ level, from, condition })
    // carry it (run package); setCondition(id) sets it on the running farm for the other packages' harness runs only.
    conditions() { return run.conditionsAvailable ? run.conditionsAvailable() : []; },
    setCondition(id) { farm.condition = id && config.CONDITIONS[id] ? id : null; return farm.condition; },
    nextJob() { return level.nextJob(); },
    jobs() { return level.jobs.list().map((j) => ({ key: j.key, status: j.status, progress: j.progress })); },
    get frames() { return frames; },
    // Run the simulation forward `seconds` of real time without rendering, at a fixed step.
    advance(seconds, dt = 1 / 30) {
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) { if (inputClock.virtual) inputClock.ms += dt * 1000; step(dt); }
    },
    // Settle the flock at the current climate without moving the clock.
    settle(seconds = 20, dt = 1 / 30) {
      const paused = env.paused;
      env.paused = true;
      this.advance(seconds, dt);
      env.paused = paused;
    },
    setState(s = {}) {
      if (s.weather != null) env.setWeather(s.weather);
      if (s.day != null) env.setDay(s.day);
      if (s.hour != null) env.setHour(s.hour);
      if (s.setpoint != null) env.setHeaterSetpoint(s.setpoint);
      if (s.fans != null) env.setFans(s.fans);
      if (s.pad != null) env.setPad(s.pad);
      if ('houseTemp' in s) env.forceHouseTemp(s.houseTemp);
      if (s.heaterLevel != null) { env.heaterLevel = env.heaterDemand = s.heaterLevel; env.heatersOn = s.heaterLevel > 0.02; }
      // a new setpoint or house temperature with the clock paused: the burners answer at once
      else if (s.setpoint != null || 'houseTemp' in s) env.settleHeaters();
      if (s.paused != null) env.paused = s.paused;
      if (s.farmer) player.teleport(s.farmer.x, s.farmer.z, s.farmer.yaw);
      if (s.cameraYaw != null || s.zoom != null) player.setView?.({ yaw: s.cameraYaw, distance: s.zoom });
      return this.snapshot();
    },
    renderNow() { player.update(0); renderer.render(scene, camera); },
    metrics() { return flock.metrics(); },
    snapshot() {
      const keys = ['day', 'dayNumber', 'hour', 'weather', 'outsideTemp', 'houseTemp', 'houseRH', 'heaterSetpoint', 'heatersOn',
        'heaterLevel', 'fansOn', 'padOn', 'airSpeed', 'targetTemp', 'windChill', 'feelsLike', 'lightsOn', 'broodCurtain'];
      const out = {};
      for (const k of keys) out[k] = env[k];
      out.player = { x: player.position.x, z: player.position.z, inside: player.isInside };
      out.mode = level.mode;
      out.farmMode = farm.mode;
      out.levelId = level.def?.id ?? null;
      out.maxDay = env.maxDay;
      out.fansBroken = env.fansBroken ?? [];
      return out;
    },
    stop() { running = false; inputClock.virtual = true; inputClock.ms = performance.now(); },
  };
  window.__game = game;

  // Keep the farm state when the artifact viewer hot-reloads a new version. In a level the whole
  // save blob (PHASE2.md §11) goes along, the same object the autosave writes.
  window.claude?.hot?.snapshot?.(() => ({
    env: {
      day: env.day, hour: env.hour, weather: env.weather, houseTemp: env.houseTemp,
      heaterSetpoint: env.heaterSetpoint, fansOn: env.fansOn, padOn: env.padOn, timeScale: env.timeScale,
    },
    player: { x: player.position.x, z: player.position.z, yaw: player.yaw },
    // a running level only: after the end (keep walking) a reload goes back to the title card
    levelSave: level.mode === 'level' && !level.result ? level.saveBlob() : null,
  }));

  // Compile every shader program now, behind the boot card. Otherwise the first look into the
  // house (flock, brooder glow, curtain) and the first dusk (stars, lamp glow) compile in the middle
  // of play, which freezes the game for a moment on a real GPU (ANGLE / D3D11 especially).
  function warmUp() {
    const p0 = { x: player.position.x, z: player.position.z, yaw: player.yaw };
    const hour0 = env.hour, paused0 = env.paused;
    const shown = [];
    const showAll = () => scene.traverse((o) => { if (!o.visible && !o.isLight) { o.visible = true; shown.push(o); } });
    try {
      showAll();
      renderer.compile(scene, camera);
      env.paused = true;
      for (const hour of [10, 22]) {
        player.teleport(HOUSE.door.x, 0, 0);
        env.setHour(hour);
        player.update(0);
        view.playerInside = player.isInside;
        world.update(0, env, view);
        view.night = world.night;
        house.update(0, env, view);
        props.update(0, env, view);
        flock.update(0, env, player.position);
        showAll(); // the updates hide some things again (glow, stars): one real frame with all of it
        renderer.render(scene, camera);
      }
    } catch (err) {
      console.warn('shader warm-up skipped:', err);
    } finally {
      for (const o of shown) o.visible = false;
      env.setHour(hour0);
      env.paused = paused0;
      player.teleport(p0.x, p0.z, p0.yaw);
      player.update(0);
      view.playerInside = player.isInside;
      world.update(0, env, view);
      view.night = world.night;
      house.update(0, env, view);
      props.update(0, env, view);
      flock.update(0, env, player.position);
    }
  }
  warmUp();
  // Title card / sandbox (level.js). A hot reload of a running level resumes it instead
  // (level.resume loads the skill profile first, so the skill tree carries over).
  if (!(saved.levelSave && level.resume(saved.levelSave))) level.boot();

  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
  requestAnimationFrame(frame);
}

function safeStart(saved) {
  try {
    start(saved);
  } catch (err) {
    console.error(err);
    showBootError(`The farm failed to load: ${err && err.message ? err.message : err}`);
  }
}

function boot() {
  // hot.ready calls back later, outside this function: safeStart catches errors there too
  if (window.claude?.hot?.ready) window.claude.hot.ready((d) => safeStart(d));
  else safeStart(window.claude?.hot?.data ?? {});
}

boot();
