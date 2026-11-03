// The tunnel-ventilated (EVAP) broiler house and all its equipment. Owner: house agent.
// Builds the shell, pad, fans, feed and water lines, brooders and fittings from helper modules
// (src/house-*.js), merges static parts into a few vertex-coloured meshes and animates the rest.
import * as THREE from 'three';
import { HOUSE, HOUSE_BOUNDS, SPOTS, FEEDER_LINES_Z, DRINKER_LINES_Z } from './config.js';
import { Batch, makeMaterials, smooth, clamp01 } from './house-kit.js';
import { buildFloor, buildWalls, buildFrame, H, T } from './house-shell.js';
import { buildDoor, buildApron, houseSign } from './house-door.js';
import { buildPad } from './house-pad.js';
import { buildFans } from './house-fans.js';
import { buildFeeders, PAN_X, feederRim } from './house-feeders.js';
import { buildDrinkers, NIPPLE_X, nippleHeight } from './house-drinkers.js';
import { buildBrooders } from './house-brooders.js';
import { buildFittings } from './house-fittings.js';

const { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;

export function buildHouse(ctx) {
  const { scene } = ctx;
  const group = new THREE.Group();
  group.name = 'house';
  scene.add(group);

  const mats = makeMaterials();
  const stat = new Batch();      // static, single-sided, casts shadows
  const statDS = new Batch();    // static, double-sided (open cones)
  const roof = new Batch();      // trusses and ridge: no shadows, fade when the camera comes close
  const kit = { group, mats, stat, statDS };

  group.add(buildFloor());
  const walls = buildWalls(stat, mats, HOUSE.door);
  for (const w of walls) group.add(w.group);
  walls[1].group.add(houseSign());
  buildFrame(stat, roof);
  buildDoor(stat);
  buildApron(stat);

  const parts = [buildPad, buildFans, buildFeeders, buildDrinkers, buildBrooders, buildFittings].map((make) => make(kit));

  group.add(stat.mesh(mats.vc));
  group.add(statDS.mesh(mats.vcDS, { receive: false }));
  const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true });
  const roofMesh = roof.mesh(roofMat, { cast: false, receive: false });
  roofMesh.renderOrder = 3;
  group.add(roofMesh);

  // Walls as boxes; the 1.8 m door gap in the south wall stays open.
  const d = HOUSE.door;
  const colliders = [
    { type: 'box', minX: xMin - T, maxX: xMax + T, minZ: zMin - T, maxZ: zMin + 0.12 },
    { type: 'box', minX: xMin - T, maxX: d.x - d.width / 2, minZ: zMax - 0.12, maxZ: zMax + T },
    { type: 'box', minX: d.x + d.width / 2, maxX: xMax + T, minZ: zMax - 0.12, maxZ: zMax + T },
    { type: 'box', minX: xMin - T - 0.1, maxX: xMin + 0.12, minZ: zMin - T, maxZ: zMax + T },
    { type: 'box', minX: xMax - 0.3, maxX: xMax + T + 0.1, minZ: zMin - T, maxZ: zMax + T },
  ];

  const interactables = [
    { id: 'controller', label: SPOTS.controller.label, x: SPOTS.controller.x, z: SPOTS.controller.z, radius: 2.0 },
    { id: 'sign-brooder', label: SPOTS.signBrooder.label, x: SPOTS.signBrooder.x, z: SPOTS.signBrooder.z, radius: 2.0 },
  ];

  // Wall cutaway: a side wall slides down to the stub when the farmer is inside or within ~6 m of
  // the house and the camera (or the farmer) is on its outer side. End walls (pad, fans) stay up.
  function cutaway(dt, view) {
    const cam = view.camera.position, p = view.playerPos;
    const dx = Math.max(xMin - p.x, 0, p.x - xMax), dz = Math.max(zMin - p.z, 0, p.z - zMax);
    const near = view.playerInside || Math.hypot(dx, dz) < 6;
    for (const w of walls) {
      const drop = near && ((cam.z - w.z) * w.n > 0.05 || (p.z - w.z) * w.n > 0.05);
      w.h = smooth(w.h, drop ? HOUSE.stubHeight : H, 7, dt);
      w.group.position.y = w.h - H;
    }
    // trusses turn see-through when the camera comes down close to them
    roofMat.opacity = 0.22 + 0.78 * clamp01((cam.y - 5.5) / 5);
  }

  return {
    group,
    colliders,
    interactables,
    // Line layout for other modules (e.g. birds eating and drinking): x positions of pans and
    // nipples, line z, and their height above the litter by flock age.
    feeders: { z: FEEDER_LINES_Z, panX: PAN_X, rimHeight: feederRim },
    drinkers: { z: DRINKER_LINES_Z, nippleX: NIPPLE_X, nippleHeight },
    update(dt, env, view) {
      cutaway(dt, view);
      for (const p of parts) p.update(dt, env, view);
    },
  };
}
