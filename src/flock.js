// Instanced flock and bird behaviour. Owner: flock agent. (Stub: replace.)
import * as THREE from 'three';
import { BROOD_BOUNDS, COLORS, FLOCK_COUNT, HEATERS, BIRD_BOUNDS } from './config.js';

export function createFlock(ctx, { house }) {
  const { scene } = ctx;
  const n = FLOCK_COUNT;
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshLambertMaterial({ color: COLORS.chick }), n);
  scene.add(mesh);
  const pos = new Float32Array(n * 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    pos[i * 2] = BROOD_BOUNDS.xMin + Math.random() * (BROOD_BOUNDS.xMax - BROOD_BOUNDS.xMin);
    pos[i * 2 + 1] = BROOD_BOUNDS.zMin + Math.random() * (BROOD_BOUNDS.zMax - BROOD_BOUNDS.zMin);
    m.makeTranslation(pos[i * 2], 0.08, pos[i * 2 + 1]);
    mesh.setMatrixAt(i, m);
  }
  return {
    count: n,
    mesh,
    update(dt, env, farmerPos) {},
    metrics() {
      return { count: n, meanDistToHeater: 0, meanDistToWall: 0, meanNearestNeighbor: 0, fracHuddling: 0, fracPanting: 0, fracComfortable: 1, spreadIndex: 0 };
    },
  };
}
