// Farmer, controls and camera rig. Owner: player agent.
// createPlayer(ctx, { colliders }) -> { object3d, position, yaw, isInside, inputEnabled,
//   teleport(x, z, yaw?), setView({ yaw, distance }), update(dt) }   (see ARCHITECTURE.md)
// Helpers: player-model (rig), player-anim (walk/run/idle), player-input (keys, mouse),
// player-camera (follow/orbit/zoom), player-collide (sliding), player-path (click routes),
// player-fx (target ring, dust).
import * as THREE from 'three';
import { FARM, HOUSE_BOUNDS } from './config.js';
import { buildFarmerModel } from './player-model.js';
import { createFarmerAnimator } from './player-anim.js';
import { createCameraRig, ZOOM_DEFAULT } from './player-camera.js';
import { createInput } from './player-input.js';
import { createCameraControls } from './player-controls.js';
import { moveAndSlide } from './player-collide.js';
import { findPath, freeSpot } from './player-path.js';
import { createTargetMarker, createDust, createContactShadow } from './player-fx.js';
import { createCarry } from './player-carry.js';

const RADIUS = 0.35;
const WALK = 4.0; // m/s
const RUN = 6.5;
const ACCEL = 24; // m/s^2
const DECEL = 30;
const TURN_RATE = 13; // 1/s, body turn toward the movement direction
// the camera's turn and zoom rates (ORBIT_PER_PX 0.0055 rad/px, KEY_TURN 1.7 rad/s, WHEEL_ZOOM 0.0015, KEY_ZOOM 1.3) and the
// Camera settings that scale them: player-controls.js (Phase 5, PHASE5.md §4.5)
const ARRIVE = 0.15; // click-to-walk stops this close to the target
const WAYPOINT_REACH = 0.4;
const ARRIVE_DECEL = 14; // m/s^2 used to ease into the target
const GIVE_UP = 1.0; // s blocked before a click walk is abandoned

const MAIN_DT_CAP = 0.05; // main.js caps each frame at this many seconds
const MAX_REAL_DT = 0.25;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createPlayer(ctx, { colliders = [] } = {}) {
  const { scene, camera, canvas } = ctx;
  const bounds = FARM.walk || FARM.fence; // the fenced farm and the road just outside the gate
  const model = buildFarmerModel();
  const root = model.root;
  scene.add(root);
  const anim = createFarmerAnimator(model);
  const cam = createCameraRig(camera);
  // Phase 5: the move, turn and zoom keys from keys.js (rebindable), the camera rates from settings 'camera.*' (live)
  const input = createInput(canvas, ctx.keys || null);
  const camCtl = createCameraControls(ctx.settings || null);
  const marker = createTargetMarker(scene);
  const dust = createDust(scene);
  createContactShadow(root);
  const carry = createCarry(root, model.material, model.joints);

  const st = {
    yaw: FARM.spawnSandbox.yaw ?? 0,
    vel: new THREE.Vector3(),
    animSpeed: 0,
    path: null, pathIdx: 0, blocked: 0, clickRun: false,
  };
  root.position.set(FARM.spawnSandbox.x, 0, FARM.spawnSandbox.z);
  root.rotation.y = st.yaw;
  cam.setView({ yaw: 0, distance: ZOOM_DEFAULT });
  cam.snapTo(root.position);

  // Click -> point on the ground plane y = 0
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function groundPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.direction.y > -1e-4) return null;
    return raycaster.ray.intersectPlane(groundPlane, hit);
  }

  function walkTo(x, z, run) {
    const goal = freeSpot(x, z, RADIUS, colliders, bounds);
    const p = root.position;
    st.path = findPath(p.x, p.z, goal.x, goal.z, RADIUS, colliders, bounds) || [goal];
    st.pathIdx = 0;
    st.blocked = 0;
    st.clickRun = !!run;
    marker.show(goal.x, goal.z);
  }
  function cancelPath() {
    if (!st.path) return;
    st.path = null;
    marker.hide();
  }

  const axes = { f: 0, r: 0, any: false };
  const pos = { x: 0, z: 0 };
  const foot = new THREE.Vector3();

  // main.js caps dt at 0.05 s, so below 20 fps (a slow laptop, or the headless test browser)
  // the game runs in slow motion. Only in that case use the real frame time, so the farmer
  // still walks at true speed and the controls stay responsive. Fixed steps (advance/settle at
  // 1/30 s, renderNow at 0) are untouched and stay deterministic.
  let lastNow = -1;
  let frozen = false;
  function frameDt(dtIn) {
    const dt = Math.max(0, Math.min(dtIn || 0, MAX_REAL_DT));
    const now = performance.now() / 1000;
    const real = lastNow < 0 ? dt : now - lastNow;
    lastNow = now;
    if (dt >= MAIN_DT_CAP * 0.95 && real > dt) return Math.min(real, MAX_REAL_DT);
    return dt;
  }

  function update(dtIn) {
    const dt = frameDt(dtIn);

    // Camera input
    const orbit = input.takeOrbit();
    if (orbit) cam.rotate(camCtl.orbit(orbit));
    const wheel = input.takeWheel();
    if (wheel) cam.zoomBy(camCtl.wheel(wheel));
    const moves = input.enabled && !frozen; // fix round: the user's pause freezes the farmer, the view still turns
    if (input.enabled) {
      const ra = input.rotateAxis();
      if (ra) cam.rotate(camCtl.keyTurn(ra, dt));
      const za = input.zoomAxis();
      if (za) cam.zoomBy(camCtl.keyZoom(za, dt));
    }

    // Click to walk
    for (let c = input.takeClick(); c; c = input.takeClick()) {
      const g = moves && groundPoint(c.x, c.y);
      if (g) walkTo(g.x, g.z, c.shift || c.double);
    }

    // Desired direction and speed
    let dx = 0, dz = 0, speed = 0;
    const running = input.running;
    input.axes(axes);
    if (!moves) cancelPath();
    else if (axes.any) {
      cancelPath();
      const yaw = cam.yaw;
      dx = -Math.sin(yaw) * axes.f + Math.cos(yaw) * axes.r;
      dz = -Math.cos(yaw) * axes.f - Math.sin(yaw) * axes.r;
      const len = Math.hypot(dx, dz);
      if (len > 1e-6) { dx /= len; dz /= len; speed = running ? RUN : WALK; }
    } else if (st.path) {
      const p = root.position;
      let wp = st.path[st.pathIdx];
      let dist = Math.hypot(wp.x - p.x, wp.z - p.z);
      while (st.pathIdx < st.path.length - 1 && dist < WAYPOINT_REACH) {
        wp = st.path[++st.pathIdx];
        dist = Math.hypot(wp.x - p.x, wp.z - p.z);
      }
      const last = st.pathIdx === st.path.length - 1;
      if (last && dist < ARRIVE) cancelPath();
      else {
        dx = (wp.x - p.x) / dist;
        dz = (wp.z - p.z) / dist;
        speed = running || st.clickRun ? RUN : WALK;
        if (last) speed = Math.min(speed, Math.sqrt(2 * ARRIVE_DECEL * dist), dt > 0 ? dist / dt : Infinity);
      }
    }

    // Accelerate toward the desired velocity
    const ex = dx * speed - st.vel.x, ez = dz * speed - st.vel.z;
    const el = Math.hypot(ex, ez);
    const stepV = (speed > 0 ? ACCEL : DECEL) * dt;
    if (el <= stepV) st.vel.set(dx * speed, 0, dz * speed);
    else { st.vel.x += (ex / el) * stepV; st.vel.z += (ez / el) * stepV; }

    // Move with collision sliding, clamped inside FARM.walk (the fence and the road outside the gate)
    const p = root.position;
    pos.x = p.x; pos.z = p.z;
    moveAndSlide(pos, st.vel.x * dt, st.vel.z * dt, RADIUS, colliders, bounds);
    const mx = pos.x - p.x, mz = pos.z - p.z;
    p.set(pos.x, 0, pos.z);
    let actual = 0;
    if (dt > 0) {
      actual = Math.hypot(mx, mz) / dt;
      // A wall takes away the blocked part of the velocity (but a push-out never adds speed).
      if (actual < st.vel.length()) st.vel.set(mx / dt, 0, mz / dt);
      if (st.path && speed > 0) {
        const progress = (mx * dx + mz * dz) / dt;
        if (progress < 0.3 * Math.min(speed, WALK)) st.blocked += dt;
        else st.blocked = Math.max(0, st.blocked - dt);
        if (st.blocked > GIVE_UP) cancelPath();
      }
    }

    // Face the way he is trying to go
    let turnRate = 0;
    let fx = 0, fz = 0;
    if (speed > 0) { fx = dx; fz = dz; } else if (actual > 0.6) { fx = st.vel.x; fz = st.vel.z; }
    if (fx || fz) {
      const diff = wrap(Math.atan2(-fx, -fz) - st.yaw);
      const turn = diff * (1 - Math.exp(-TURN_RATE * dt));
      st.yaw = wrap(st.yaw + turn);
      if (dt > 0) turnRate = turn / dt;
    }
    root.rotation.y = st.yaw;

    // Animate
    st.animSpeed += (actual - st.animSpeed) * (1 - Math.exp(-14 * dt));
    const step = anim.update(dt, st.animSpeed, turnRate);
    carry.apply(dt);
    if (step && anim.state.run > 0.55 && st.animSpeed > 4.6) {
      model.joints[step === 'L' ? 'ankleL' : 'ankleR'].getWorldPosition(foot);
      const sp = Math.max(0.01, st.vel.length());
      dust.puff(foot.x, foot.z, st.vel.x / sp, st.vel.z / sp, p.x > HOUSE_BOUNDS.xMin && p.x < HOUSE_BOUNDS.xMax ? 0.8 : 1);
    }
    marker.update(dt, Math.min(2.6, Math.max(0.8, cam.distance / 15)));
    dust.update(dt);
    cam.update(dt, p, st.vel);
  }

  const api = {
    object3d: root,
    position: root.position,
    get yaw() { return st.yaw; },
    get isInside() {
      const p = root.position;
      return p.x > HOUSE_BOUNDS.xMin && p.x < HOUSE_BOUNDS.xMax && p.z > HOUSE_BOUNDS.zMin && p.z < HOUSE_BOUNDS.zMax;
    },
    /** Fix round: true while the farm clock is paused by the player: no walking, no click or map walk (the view turns). */
    get frozen() { return frozen; },
    set frozen(v) { frozen = !!v; if (frozen) cancelPath(); },
    get inputEnabled() { return input.enabled; },
    set inputEnabled(v) {
      input.enabled = v;
      if (!v) cancelPath();
    },
    // Extras (not in the contract, handy for UI and tests)
    get cameraYaw() { return cam.yaw; },
    get zoom() { return cam.distance; },
    get speed() { return st.animSpeed; },
    get walking() { return !!st.path; },
    get colliders() { return colliders; },
    teleport(x, z, yaw) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      root.position.set(x, 0, z);
      if (yaw != null && Number.isFinite(yaw)) { st.yaw = wrap(yaw); root.rotation.y = st.yaw; }
      st.vel.set(0, 0, 0);
      st.animSpeed = 0;
      cancelPath();
      cam.snapTo(root.position);
    },
    setView(v = {}) {
      cam.setView(v);
      cam.snapTo(root.position);
    },
    walkTo(x, z, run = false) { if (input.enabled && !frozen) walkTo(x, z, run); },
    // Phase 2 (package "props", player-carry.js). carry(kind): the mesh of what the farmer holds,
    // called only by props.startCarry / props.drop: null | 'barrow' | 'sack' | 'boxes' (hand truck
    // with ten chick boxes) | 'bucket' | 'frame' (folded catching frame + hand scale) | 'chick';
    // props also shows 'scale' (only the hand scale) while the frame stands on the litter.
    // pose(name, seconds): a short action pose, 'crouch' (probe, squeeze, pick up, tip) |
    // 'reach' (nipple, valve, relight) | null.
    carrying: null,
    carry(kind) { api.carrying = kind === 'scale' ? 'frame' : kind || null; carry.set(kind || null); },
    pose(name, seconds = 1) { carry.pose(name, seconds); },
    // Phase 3 (package "scene"): a hand tool in his hand for a moment (props shows the light meter on L and
    // the air meter on V for 2 s, with the run's 'reach' pose): 'lightMeter' | 'airMeter'
    flash(kind, seconds = 2) { carry.flash(kind, seconds); },
    get flashing() { return carry.flashing; },
    update,
    dispose() {
      input.dispose();
      camCtl.dispose();
      scene.remove(root, marker.group);
    },
  };
  return api;
}
