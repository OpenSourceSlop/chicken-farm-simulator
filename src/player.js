// Farmer, controls and camera rig. Owner: player agent. (Stub: replace.)
import * as THREE from 'three';
import { COLORS, FARM, HOUSE_BOUNDS } from './config.js';

export function createPlayer(ctx, { colliders }) {
  const { scene, camera, canvas } = ctx;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), new THREE.MeshLambertMaterial({ color: COLORS.farmerSuit }));
  body.position.y = 0.8;
  body.castShadow = true;
  const root = new THREE.Group();
  root.add(body);
  scene.add(root);

  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  const state = { yaw: 0, camYaw: 0, distance: 22, inputEnabled: true };
  root.position.set(FARM.spawn.x, 0, FARM.spawn.z);

  const api = {
    object3d: root,
    position: root.position,
    get yaw() { return state.yaw; },
    get isInside() {
      const p = root.position;
      return p.x > HOUSE_BOUNDS.xMin && p.x < HOUSE_BOUNDS.xMax && p.z > HOUSE_BOUNDS.zMin && p.z < HOUSE_BOUNDS.zMax;
    },
    get inputEnabled() { return state.inputEnabled; },
    set inputEnabled(v) { state.inputEnabled = v; if (!v) keys.clear(); },
    teleport(x, z, yaw) { root.position.set(x, 0, z); if (yaw != null) state.yaw = yaw; },
    setView({ yaw, distance } = {}) { if (yaw != null) state.camYaw = yaw; if (distance != null) state.distance = distance; },
    update(dt) {
      if (state.inputEnabled) {
        const f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
        const r = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
        root.position.x += r * 4 * dt;
        root.position.z -= f * 4 * dt;
      }
      const pitch = 0.9;
      camera.position.set(
        root.position.x + Math.sin(state.camYaw) * Math.cos(pitch) * state.distance,
        Math.sin(pitch) * state.distance,
        root.position.z + Math.cos(state.camYaw) * Math.cos(pitch) * state.distance,
      );
      camera.lookAt(root.position.x, 0.8, root.position.z);
    },
  };
  return api;
}
