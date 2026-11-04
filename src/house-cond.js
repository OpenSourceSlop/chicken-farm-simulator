// Phase 4 (PHASE4.md §8.4, §8.5): the house's parts of the harder conditions. Owner: package "scene" (house).
//   storm flaps   the rainy season: the south side-wall inlets (one between each pair of columns, the door bay left
//                 out) with a hinged galvanised flap over each; the flaps hang open as hoods and swing down shut
//                 while farm.house.flapsClosed. They ride on the sliding south wall (the camera cutaway).
//   rust          a water problem: rust-brown stains on line 4's nipples and pipe while `iron-nipples` lasts
// Both hidden in the sandbox and in any run without their condition (the Phase 1-3 house exactly as before).
import * as THREE from 'three';
import { HOUSE_BOUNDS, HOUSE, DRINKER_LINES_Z, NIPPLE_X } from './config.js';
import { Batch, mat, smooth } from './house-kit.js';
import { T } from './house-shell.js';
import { condOf, problemOn } from './world-cond.js';

const { xMin, xMax, zMax } = HOUSE_BOUNDS;
const INLET = { w: 0.9, h: 0.22, y: 2.03 };         // the inlet opening at the top of the curtain band (under
const FLAP = { w: 1.04, h: 0.34, hinge: 2.2 };      // the eave's shadow line: in view from the yard); the plate, hinged at its top edge
const OPEN = -1.1;                                   // open: swung out about 63 degrees (a hood over the dark inlet gap)
// review round: open and closed differ in shape and value from the yard: open, a galvanised hood over the dark gap with a
// wet stain under it while it rains; closed, a flat plate in a light painted colour over the slot
const FLAP_OPEN_C = new THREE.Color(0x66717a), FLAP_SHUT_C = new THREE.Color(0xf4efdc);
const PIPE_Y = 0.085;                                // drinker pipe centre above the nipple tip (house-drinkers.js)
const RUST_LINE = 3;                                 // line 4 (PHASE4.md §4.4 iron-nipples, config line 3)

/** Inlet x positions: column midpoints along the south wall, not in the door bay. */
export function inletX() {
  const out = [];
  for (let x = xMin + 2; x < xMax - 1; x += 4) if (Math.abs(x - HOUSE.door.x) > 1.6) out.push(x);
  return out;
}

export function buildCondHouse(kit, southWall, lineHeights) {
  const xs = inletX();
  const face = zMax + T + 0.004;                    // outside face of the south wall panel
  // ---- inlets: a dark slot in a galvanised frame, with the flap brackets (one merged mesh) ----
  const b = new Batch();
  for (const x of xs) {
    b.box(INLET.w, INLET.h, 0.02, x, INLET.y, face - 0.006, 0x1d2326);
    for (const s of [-1, 1]) b.box(0.035, INLET.h + 0.07, 0.03, x + s * (INLET.w / 2 + 0.017), INLET.y, face + 0.006, 0xa9b1b7);
    for (const s of [-1, 1]) b.box(INLET.w + 0.1, 0.035, 0.03, x, INLET.y + s * (INLET.h / 2 + 0.017), face + 0.006, 0xa9b1b7);
    for (const s of [-1, 1]) b.box(0.03, 0.05, 0.05, x + s * (FLAP.w / 2 - 0.06), FLAP.hinge, face + 0.022, 0x7d868d); // hinges
  }
  const vcMat = kit.mats.vc;
  const frames = b.mesh(vcMat, { cast: false, receive: true });
  frames.name = 'house-storm-inlets';
  // ---- flaps: instanced, hinged at the top edge ----
  const flapGeo = new THREE.BoxGeometry(FLAP.w, FLAP.h, 0.014);
  flapGeo.translate(0, -FLAP.h / 2, 0.007);
  const flapMat = new THREE.MeshLambertMaterial({ color: FLAP_OPEN_C.clone(), flatShading: true });
  const flaps = new THREE.InstancedMesh(flapGeo, flapMat, xs.length);
  flaps.name = 'house-storm-flaps';
  flaps.castShadow = true;
  // the wet stain under each open inlet while it rains (one merged mesh)
  const wb = new Batch();
  for (const x of xs) wb.box(INLET.w * 0.9, 0.55, 0.004, x, INLET.y - INLET.h / 2 - 0.3, face + 0.002, 0x1f2a2e);
  const stains = wb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }), { cast: false, receive: false });
  stains.name = 'house-storm-stains'; stains.visible = false;
  const group = new THREE.Group();
  group.name = 'house-storm';
  group.add(frames, flaps, stains);
  group.visible = false;
  southWall.add(group);
  const M = new THREE.Matrix4();
  let angle = OPEN, placed = NaN;
  function place() {
    xs.forEach((x, i) => flaps.setMatrixAt(i, M.copy(mat(x, FLAP.hinge, face + 0.03, angle, 0, 0))));
    flaps.instanceMatrix.needsUpdate = true;
    placed = angle;
  }
  place();

  // ---- rust stains on line 4: a brown blob on each nipple and a streak on the pipe under it ----
  // (review round: readable at zoom 14: a 16 cm rust sleeve on the pipe at each nipple, the drip cups tinted brown)
  const rb = new Batch();
  rb.add(new THREE.IcosahedronGeometry(0.02, 0), 0x8a4a22, mat(0, 0.03, 0, 0, 0, 0, 1, 1.4, 1));
  rb.box(0.16, 0.05, 0.05, 0, PIPE_Y, 0, 0x8c4720);                                             // the rust sleeve on the pipe
  rb.box(0.012, 0.05, 0.008, 0.01, PIPE_Y - 0.045, 0.021, 0x93512a);                            // a rusty drip
  rb.add(new THREE.CylinderGeometry(0.029, 0.02, 0.022, 7), 0x7a3f1d, mat(0, -0.016, 0.04));    // the drip cup rust-brown
  const rustMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const rust = new THREE.InstancedMesh(rb.geometry(), rustMat, NIPPLE_X.length + 1);   // + the band by the regulator
  rust.name = 'house-rust-line4';
  rust.visible = false;
  const rz = DRINKER_LINES_Z[RUST_LINE];
  let rustY = NaN;
  kit.group.add(rust);

  return {
    group, flaps, rust,
    get angle() { return angle; },
    update(dt, env) {
      const farm = kit.farm, cond = condOf(farm);
      // storm flaps: the rainy season only
      const rainy = cond === 'rainy';
      group.visible = rainy;
      if (rainy) {
        const want = farm.house && farm.house.flapsClosed ? 0 : OPEN;
        angle = dt > 0 ? smooth(angle, want, 4, dt) : want;
        if (Math.abs(angle - want) < 1e-3) angle = want;
        if (angle !== placed) { place(); flapMat.color.copy(FLAP_OPEN_C).lerp(FLAP_SHUT_C, 1 - angle / OPEN); }
        stains.visible = angle < OPEN * 0.5 && (farm.weatherNow?.rain ?? 0) > 0.05;
      }
      // rust on line 4's nipples: the water problem, while the iron clogs them
      const on = cond === 'water' && problemOn(farm, 'iron-nipples');
      rust.visible = on;
      if (on) {
        const y = Number.isFinite(lineHeights[RUST_LINE]) ? lineHeights[RUST_LINE] : 0.2;
        if (!(Math.abs(y - rustY) <= 1e-4)) {
          rustY = y;
          NIPPLE_X.forEach((x, i) => rust.setMatrixAt(i, M.makeTranslation(x, y, rz)));
          rust.setMatrixAt(NIPPLE_X.length, M.makeTranslation(NIPPLE_X[0] - 0.22, y, rz));   // the pipe by the regulator
          rust.instanceMatrix.needsUpdate = true;
        }
      }
      void env;
    },
  };
}
