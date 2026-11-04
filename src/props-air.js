// Dust in the house air (PHASE3.md §12 item 10, §6.4): motes drifting in the lamp light while
// farm.air.dustIndex > 1 (more of them toward the rattle at 1.5), around the farmer inside the house.
// One instanced mesh of small dull specks; nothing is drawn while the air is clear. Owner: "scene".
import * as THREE from 'three';
import { HOUSE_BOUNDS } from './config.js';

const N = 260;

export function buildDust(group) {
  // a dull grey-brown haze, normally blended (matte like the rest of the scene, never brighter than the litter)
  const geo = new THREE.PlaneGeometry(0.05, 0.05);
  const mat = new THREE.MeshBasicMaterial({ color: 0xb8a888, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.name = 'props-dust';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 4;
  group.add(mesh);
  // each mote: a home point around the farmer (re-seeded when he moves away), a slow drift and a bob
  const P = new Float32Array(N * 3), ph = new Float32Array(N);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) { P[i * 3] = 0; P[i * 3 + 1] = 0.3 + rnd() * 1.8; P[i * 3 + 2] = 0; ph[i] = rnd() * 6.28; }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let t = 0, seeded = false;
  const b = HOUSE_BOUNDS;

  return {
    mesh,
    /** dust index of the farm (farm.air.dustIndex), the farmer, the camera (the specks face it) */
    update(dt, dust, player, camera, level) {
      const on = level && dust > 1 && player && player.isInside;
      mesh.visible = !!on;
      if (!on) { seeded = false; return; }
      t += dt;
      const show = Math.round(N * Math.min(1, 0.35 + (dust - 1) / 0.8));
      const px = player.position.x, pz = player.position.z;
      if (camera) _q.copy(camera.quaternion);
      for (let i = 0; i < N; i++) {
        let x = P[i * 3], z = P[i * 3 + 2];
        if (!seeded || Math.abs(x - px) > 6 || Math.abs(z - pz) > 5) { x = px + (rnd() - 0.5) * 11; z = pz + (rnd() - 0.5) * 8; P[i * 3] = x; P[i * 3 + 2] = z; }
        // drift with the tunnel air toward the fans (east), bob in the light
        x += dt * (0.12 + 0.05 * Math.sin(ph[i] + t * 0.3));
        P[i * 3] = x;
        if (i >= show || x < b.xMin || x > b.xMax || z < b.zMin || z > b.zMax) { mesh.setMatrixAt(i, zero); continue; }
        const y = P[i * 3 + 1] + 0.08 * Math.sin(t * 0.7 + ph[i]);
        const s = 0.7 + 0.6 * ((ph[i] * 7.3) % 1);
        _p.set(x, y, z); _s.set(s, s, s);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      seeded = true;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
