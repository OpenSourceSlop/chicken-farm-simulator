// Follow camera: orbits around the farmer (yaw), zooms 6..45 m, pitch rises with distance.
// Yaw convention matches the farmer: yaw 0 looks north (-Z) with the camera south of him.
import * as THREE from 'three';

export const ZOOM_MIN = 6;
export const ZOOM_MAX = 45;
export const ZOOM_DEFAULT = 22;
const PITCH_NEAR = THREE.MathUtils.degToRad(38);
const PITCH_FAR = THREE.MathUtils.degToRad(58);
const FOLLOW_RATE = 7; // 1/s, how quickly the view catches up with the farmer
const LEAD = 0.12; // seconds of velocity the view looks ahead
const YAW_RATE = 18;
const ZOOM_RATE = 9;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k, dt) => 1 - Math.exp(-k * dt);

export function createCameraRig(camera) {
  const st = {
    yaw: 0, yawT: 0,
    dist: ZOOM_DEFAULT, distT: ZOOM_DEFAULT,
    focus: new THREE.Vector3(),
  };
  const goal = new THREE.Vector3();

  const zoomT = (d) => clamp((d - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN), 0, 1);
  const pitchFor = (d) => PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * Math.sqrt(zoomT(d));
  const focusHeight = (d) => 1.0 - 0.5 * zoomT(d);

  function place() {
    const pitch = pitchFor(st.dist);
    const h = Math.cos(pitch) * st.dist;
    camera.position.set(
      st.focus.x + Math.sin(st.yaw) * h,
      Math.max(0.8, st.focus.y + Math.sin(pitch) * st.dist),
      st.focus.z + Math.cos(st.yaw) * h,
    );
    camera.lookAt(st.focus);
  }

  return {
    get yaw() { return st.yaw; },
    get yawTarget() { return st.yawT; },
    get distance() { return st.dist; },
    get distanceTarget() { return st.distT; },
    // Positive turns the view to the left (counter-clockwise seen from above).
    rotate(dYaw) { st.yawT += dYaw; },
    zoomBy(factor) { st.distT = clamp(st.distT * factor, ZOOM_MIN, ZOOM_MAX); },
    // Immediate, no smoothing (test hooks and screenshots stay deterministic).
    setView({ yaw, distance } = {}) {
      if (yaw != null && Number.isFinite(yaw)) { st.yaw = yaw; st.yawT = yaw; }
      if (distance != null && Number.isFinite(distance)) { st.dist = st.distT = clamp(distance, ZOOM_MIN, ZOOM_MAX); }
      place();
    },
    snapTo(target) {
      st.focus.set(target.x, focusHeight(st.dist), target.z);
      place();
    },
    update(dt, target, vel) {
      st.yaw += (st.yawT - st.yaw) * ease(YAW_RATE, dt);
      st.dist = Math.exp(Math.log(st.dist) + (Math.log(st.distT) - Math.log(st.dist)) * ease(ZOOM_RATE, dt));
      goal.set(target.x + vel.x * LEAD, focusHeight(st.dist), target.z + vel.z * LEAD);
      st.focus.lerp(goal, ease(FOLLOW_RATE, dt));
      st.focus.y = focusHeight(st.dist);
      place();
    },
  };
}
