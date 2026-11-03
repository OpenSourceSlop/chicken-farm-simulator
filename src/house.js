// The tunnel-ventilated chicken house and its equipment. Owner: house agent. (Stub: replace.)
import * as THREE from 'three';
import { COLORS, HOUSE, HOUSE_BOUNDS, SPOTS } from './config.js';

export function buildHouse(ctx) {
  const { scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.length, HOUSE.width), new THREE.MeshLambertMaterial({ color: COLORS.litter }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshLambertMaterial({ color: COLORS.wallWhite });
  const t = HOUSE.wallThickness, h = HOUSE.wallHeight;
  const colliders = [];
  function wall(minX, maxX, minZ, maxZ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, h, maxZ - minZ), wallMat);
    m.position.set((minX + maxX) / 2, h / 2, (minZ + maxZ) / 2);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    colliders.push({ type: 'box', minX, maxX, minZ, maxZ });
  }
  const { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;
  const d = HOUSE.door;
  wall(xMin, xMax, zMin - t, zMin);                       // north
  wall(xMin, d.x - d.width / 2, zMax, zMax + t);           // south, west of door
  wall(d.x + d.width / 2, xMax, zMax, zMax + t);           // south, east of door
  wall(xMin - t, xMin, zMin, zMax);                        // west (pad end)
  wall(xMax, xMax + t, zMin, zMax);                        // east (fan end)

  const interactables = [
    { id: 'controller', label: SPOTS.controller.label, x: SPOTS.controller.x, z: SPOTS.controller.z, radius: 2.0 },
    { id: 'sign-brooder', label: SPOTS.signBrooder.label, x: SPOTS.signBrooder.x, z: SPOTS.signBrooder.z, radius: 2.0 },
  ];

  return {
    group,
    colliders,
    interactables,
    update(dt, env, view) {},
  };
}
