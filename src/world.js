// Farm surroundings, sky and sunlight. Owner: world agent. (Stub: replace.)
import * as THREE from 'three';
import { COLORS, FARM, SPOTS } from './config.js';

export function buildWorld(ctx) {
  const { scene } = ctx;
  scene.background = new THREE.Color(0xbfd9ea);
  scene.fog = new THREE.Fog(0xbfd9ea, 90, 260);

  const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 140 });
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: COLORS.grass }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const colliders = [];
  const interactables = [
    { id: 'sign-gate', label: SPOTS.signGate.label, x: SPOTS.signGate.x, z: SPOTS.signGate.z, radius: 2.2 },
  ];

  return {
    colliders,
    interactables,
    sun,
    update(dt, env, view) {
      const p = view.playerPos;
      sun.target.position.set(p.x, 0, p.z);
      sun.position.set(p.x + 30, 50, p.z + 20);
    },
  };
}
