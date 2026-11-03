// The tunnel-ventilated (EVAP) broiler house and all its equipment. Owner: house agent.
// Builds the shell, pad, fans, feed and water lines, brooders and fittings from helper modules
// (src/house-*.js), merges static parts into a few vertex-coloured meshes and animates the rest.
import * as THREE from 'three';
import { HOUSE, HOUSE_BOUNDS, SPOTS, FEEDER_LINES_Z, DRINKER_LINES_Z } from './config.js';
import { Batch, makeMaterials, smooth, clamp01 } from './house-kit.js';
import { buildFloor, buildWalls, buildFrame, H, T } from './house-shell.js';
import { buildRoof, withDither, withChordFade } from './house-roof.js';
import { buildDoor, buildApron, houseSign } from './house-door.js';
import { buildPad } from './house-pad.js';
import { buildFans, FAN_Z } from './house-fans.js';
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
  const chords = new Batch();    // truss tie beams: no shadows, cleared out of the camera's sight line
  const rafters = new Batch();   // rafters, webs, ridge: shown with the roof only
  const porch = new Batch();     // door portal, leaves and canopy: fade while the farmer is at the door
  // ctx.farm (Phase 2): in level mode the lines, pans and brooders follow the farm model
  const kit = { group, mats, stat, statDS, farm: ctx.farm };

  const floor = buildFloor();
  group.add(floor);
  const walls = buildWalls(stat, mats, HOUSE.door, (north, south) => buildFrame(stat, chords, rafters, { [-1]: north, [1]: south }));
  for (const w of walls) group.add(w.group);
  walls[1].group.add(houseSign());
  buildDoor(stat, porch);
  buildApron(stat);

  const parts = [buildPad, buildFans, buildFeeders, buildDrinkers, buildBrooders, buildFittings].map((make) => make(kit));
  const drinkerPart = parts[3];

  group.add(stat.mesh(mats.vc));
  group.add(statDS.mesh(mats.vcDS, { receive: false }));
  const chordMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  withChordFade(chordMat, 'house-chords');
  group.add(chords.mesh(chordMat, { cast: false, receive: false }));
  const rafterMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const rafterFade = withDither(rafterMat, 'house-rafters');
  const rafterMesh = rafters.mesh(rafterMat, { cast: false, receive: false });
  group.add(rafterMesh);
  const porchMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const porchFade = withDither(porchMat, 'house-porch');
  const porchMesh = porch.mesh(porchMat);
  group.add(porchMesh);
  const roof = buildRoof(group);

  // Walls as boxes; the 1.8 m door gap in the south wall stays open.
  const d = HOUSE.door;
  const colliders = [
    { type: 'box', minX: xMin - T, maxX: xMax + T, minZ: zMin - T, maxZ: zMin + 0.12 },
    { type: 'box', minX: xMin - T, maxX: d.x - d.width / 2, minZ: zMax - 0.12, maxZ: zMax + T },
    { type: 'box', minX: d.x + d.width / 2, maxX: xMax + T, minZ: zMax - 0.12, maxZ: zMax + T },
    { type: 'box', minX: xMin - T - 0.1, maxX: xMin + 0.12, minZ: zMin - T, maxZ: zMax + T },
    { type: 'box', minX: xMax - 0.3, maxX: xMax + T + 0.1, minZ: zMin - T, maxZ: zMax + T },
    // tunnel fan discharge cones stick out 1.1 m onto the east apron
    { type: 'box', minX: xMax + T, maxX: xMax + T + 1.15, minZ: Math.min(...FAN_Z) - 0.9, maxZ: Math.max(...FAN_Z) + 0.9 },
  ];

  const interactables = [
    // inside: true = only usable from inside the house (not through the north wall)
    { id: 'controller', label: SPOTS.controller.label, x: SPOTS.controller.x, z: SPOTS.controller.z, radius: 2.0, inside: SPOTS.controller.inside },
    { id: 'sign-brooder', label: SPOTS.signBrooder.label, x: SPOTS.signBrooder.x, z: SPOTS.signBrooder.z, radius: 2.0, inside: SPOTS.signBrooder.inside },
  ];

  // Wall cutaway: a side wall slides down to the stub when the farmer is inside or within ~6 m of
  // the house and the camera (or the farmer) is on its outer side. End walls (pad, fans) stay up.
  // The roof (and the rafters under it) dissolves between 8 and 6 m, before the walls drop. The
  // door portal and canopy fade while the farmer is at the door or inside, seen from the south.
  let roofK = -1, porchK = 1;
  function cutaway(dt, view) {
    const cam = view.camera.position, p = view.playerPos;
    const dx = Math.max(xMin - p.x, 0, p.x - xMax), dz = Math.max(zMin - p.z, 0, p.z - zMax);
    const dist = view.playerInside ? 0 : Math.hypot(dx, dz);
    const near = view.playerInside || dist < 6;
    for (const w of walls) {
      const drop = near && ((cam.z - w.z) * w.n > 0.05 || (p.z - w.z) * w.n > 0.05);
      w.h = smooth(w.h, drop ? HOUSE.stubHeight : H, 7, dt);
      w.group.position.y = w.h - H;
    }
    const roofT = clamp01((dist - 6) / 2);
    roofK = roofK < 0 || dt <= 0 ? roofT : smooth(roofK, roofT, 5, dt);
    roof.setFade(roofK);
    rafterFade.value = roofK;
    rafterMesh.visible = roofK > 0.01;
    const atDoor = Math.hypot(p.x - HOUSE.door.x, p.z - zMax) < 3.5;
    const porchT = cam.z > zMax + 0.5 && (view.playerInside || atDoor) ? 0 : 1;
    porchK = dt <= 0 ? porchT : smooth(porchK, porchT, 6, dt);
    porchFade.value = porchK;
    porchMesh.visible = porchK > 0.01;
  }

  return {
    group,
    floor,             // the litter plane (props paints the Level 1 floor states into its shader)
    colliders,
    interactables,
    // Line layout for other modules (e.g. birds eating and drinking): x positions of pans and
    // nipples, line z, and their height above the litter by flock age.
    feeders: { z: FEEDER_LINES_Z, panX: PAN_X, rimHeight: feederRim },
    drinkers: { z: DRINKER_LINES_Z, nippleX: NIPPLE_X, nippleHeight },
    // nipple tip height of each drinker line now (m): the farm's heights in a level (props)
    lineHeights: drinkerPart.heights,
    update(dt, env, view) {
      cutaway(dt, view);
      for (const p of parts) p.update(dt, env, view);
    },
  };
}
