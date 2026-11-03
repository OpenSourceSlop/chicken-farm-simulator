// Boot, render loop and module wiring. Owner: integrator.
import * as THREE from 'three';
import * as config from './config.js';
import { createSim } from './sim.js';
import { buildWorld } from './world.js';
import { buildHouse } from './house.js';
import { createPlayer } from './player.js';
import { createFlock } from './flock.js';
import { createUI } from './ui.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);

  const ctx = { THREE, renderer, scene, camera, canvas, config };

  const env = createSim();
  ctx.env = env;
  if (saved.env) Object.assign(env, saved.env);

  const world = buildWorld(ctx);
  const house = buildHouse(ctx);
  const colliders = [...world.colliders, ...house.colliders];
  const player = createPlayer(ctx, { colliders });
  const flock = createFlock(ctx, { house });
  const interactables = [...world.interactables, ...house.interactables];
  const ui = createUI(ctx, { player, flock, house, world, interactables });

  if (saved.player) player.teleport(saved.player.x, saved.player.z, saved.player.yaw);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
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
    flock.update(dt, env, player.position);
    ui.update(dt);
  }

  const clock = new THREE.Clock();
  let frames = 0;
  let running = true;
  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    renderer.render(scene, camera);
    frames++;
    requestAnimationFrame(frame);
  }

  // Test and tooling hooks (used by scripts/shoot.mjs and the Phase 1 test tools)
  const game = {
    ready: true,
    THREE, scene, camera, renderer, env, world, house, player, flock, ui,
    get frames() { return frames; },
    // Run the simulation forward `seconds` of real time without rendering, at a fixed step.
    advance(seconds, dt = 1 / 30) {
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) step(dt);
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
      if (s.heaterLevel != null) { env.heaterLevel = s.heaterLevel; env.heatersOn = s.heaterLevel > 0.5; }
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
      return out;
    },
    stop() { running = false; },
  };
  window.__game = game;

  // Keep the farm state when the artifact viewer hot-reloads a new version
  window.claude?.hot?.snapshot?.(() => ({
    env: {
      day: env.day, hour: env.hour, weather: env.weather, houseTemp: env.houseTemp,
      heaterSetpoint: env.heaterSetpoint, fansOn: env.fansOn, padOn: env.padOn, timeScale: env.timeScale,
    },
    player: { x: player.position.x, z: player.position.z, yaw: player.yaw },
  }));

  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
  requestAnimationFrame(frame);
}

function boot() {
  try {
    if (window.claude?.hot?.ready) window.claude.hot.ready(start);
    else start(window.claude?.hot?.data ?? {});
  } catch (err) {
    console.error(err);
    showBootError(`The farm failed to load: ${err && err.message ? err.message : err}`);
  }
}

boot();
