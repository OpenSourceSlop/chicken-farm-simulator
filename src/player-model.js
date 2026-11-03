// Low-poly farmer in a biosecurity outfit: blue coverall, white rubber boots, cap.
// Built facing -Z (yaw 0 = north) as a joint hierarchy so player-anim.js can animate it.
// Each limb segment is one merged, vertex-coloured mesh (about 14 draw calls in all).
import * as THREE from 'three';
import { COLORS } from './config.js';
import { PartList } from './player-geom.js';

const C = {
  suit: COLORS.farmerSuit,
  suitDark: 0x2b5486,
  zip: 0xa9b4bf,
  boot: COLORS.farmerBoots,
  bootRim: 0xd6d8d0,
  sole: 0x8d918c,
  skin: COLORS.skin,
  skinDark: 0xa86f47,
  hair: 0x2a1f17,
  eye: 0x1a120d,
  mouth: 0x7c3a2b,
  cap: 0xf1ede2,
  capBrim: 0xd8d0bb,
  capBand: 0x2a4a73,
  logo: 0x5e9e3c,
};

// Rig dimensions (model units before RIG_SCALE). Hip joint height = THIGH + SHIN + ANKLE.
export const DIMS = {
  pelvisY: 0.9, // pelvis joint height above the soles at rest
  hipDrop: 0.03, // hip joints sit this far below the pelvis joint
  thigh: 0.41,
  shin: 0.39,
  ankle: 0.07, // ankle joint to sole
};
const RIG_SCALE = 0.945; // brings the cap top to about 1.73 m
const HEAD_SCALE = 1.15; // a slightly large head reads better from the high camera

export function buildFarmerModel() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const root = new THREE.Group();
  root.name = 'farmer';
  const rig = new THREE.Group();
  rig.scale.setScalar(RIG_SCALE);
  root.add(rig);
  const meshes = [];

  const joint = (parent, x, y, z, name) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const attach = (parent, parts, name) => {
    const m = new THREE.Mesh(parts.merge(), mat);
    m.name = name;
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };

  // Pelvis
  const pelvis = joint(rig, 0, DIMS.pelvisY, 0, 'pelvis');
  attach(pelvis, new PartList()
    .frustum(0.33, 0.21, 0.35, 0.22, 0.2, C.suit, 0, 0.01, 0)
    .box(0.15, 0.08, 0.18, C.suit, 0, -0.09, 0)
    .box(0.36, 0.03, 0.23, C.suitDark, 0, 0.095, 0), 'pelvis');

  // Legs
  const legs = {};
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? -1 : 1; // wearer's left is -X when facing -Z
    const hip = joint(pelvis, sx * 0.1, -DIMS.hipDrop, 0, `hip${side}`);
    attach(hip, new PartList()
      .frustum(0.13, 0.15, 0.165, 0.18, 0.44, C.suit, 0, -0.2, 0), `thigh${side}`);
    const knee = joint(hip, 0, -DIMS.thigh, 0, `knee${side}`);
    attach(knee, new PartList()
      .box(0.145, 0.1, 0.16, C.suit, 0, -0.01, -0.005)
      .frustum(0.12, 0.13, 0.14, 0.15, 0.2, C.suit, 0, -0.1, 0)
      .frustum(0.135, 0.15, 0.158, 0.172, 0.26, C.boot, 0, -0.262, 0)
      .box(0.168, 0.03, 0.182, C.bootRim, 0, -0.14, 0), `shin${side}`);
    const ankle = joint(knee, 0, -DIMS.shin, 0, `ankle${side}`);
    attach(ankle, new PartList()
      .box(0.14, 0.085, 0.25, C.boot, 0, -0.025, -0.045)
      .frustum(0.135, 0.07, 0.11, 0.05, 0.07, C.boot, 0, -0.033, -0.185)
      .box(0.15, 0.022, 0.3, C.sole, 0, -0.059, -0.062), `foot${side}`);
    legs[side] = { hip, knee, ankle };
  }

  // Torso
  const spine = joint(pelvis, 0, 0.1, 0, 'spine');
  attach(spine, new PartList()
    .frustum(0.33, 0.22, 0.39, 0.22, 0.3, C.suit, 0, 0.15, 0)
    .frustum(0.39, 0.225, 0.43, 0.24, 0.13, C.suit, 0, 0.335, 0)
    .box(0.022, 0.37, 0.01, C.zip, 0, 0.2, -0.123)
    .box(0.095, 0.085, 0.012, C.suitDark, -0.105, 0.285, -0.124)
    .box(0.1, 0.022, 0.018, C.suitDark, -0.105, 0.333, -0.127)
    .box(0.062, 0.1, 0.014, C.suitDark, -0.05, 0.37, -0.125, 0, 0, -0.5)
    .box(0.062, 0.1, 0.014, C.suitDark, 0.05, 0.37, -0.125, 0, 0, 0.5)
    .box(0.2, 0.055, 0.08, C.suitDark, 0, 0.41, 0.065), 'torso');

  // Head (pivot at the base of the neck)
  const neck = joint(spine, 0, 0.42, 0, 'neck');
  const headPivot = joint(neck, 0, 0.0, 0, 'headPivot');
  headPivot.scale.setScalar(HEAD_SCALE);
  const head = new PartList()
    .cyl(0.055, 0.062, 0.12, 6, C.skin, 0, 0.03, 0.005)
    .frustum(0.18, 0.2, 0.215, 0.23, 0.24, C.skin, 0, 0.18, -0.005)
    .box(0.034, 0.044, 0.02, C.eye, -0.05, 0.183, -0.114)
    .box(0.034, 0.044, 0.02, C.eye, 0.05, 0.183, -0.114)
    .box(0.055, 0.016, 0.02, C.hair, -0.05, 0.222, -0.118, 0, 0, 0.1)
    .box(0.055, 0.016, 0.02, C.hair, 0.05, 0.222, -0.118, 0, 0, -0.1)
    .frustum(0.034, 0.03, 0.026, 0.02, 0.055, C.skinDark, 0, 0.155, -0.122)
    .box(0.056, 0.013, 0.012, C.mouth, 0, 0.105, -0.108)
    .box(0.03, 0.06, 0.05, C.skin, -0.11, 0.18, 0.005)
    .box(0.03, 0.06, 0.05, C.skin, 0.11, 0.18, 0.005)
    .frustum(0.19, 0.03, 0.212, 0.035, 0.15, C.hair, 0, 0.2, 0.106)
    .box(0.02, 0.045, 0.06, C.hair, -0.106, 0.24, 0.07)
    .box(0.02, 0.045, 0.06, C.hair, 0.106, 0.24, 0.07)
    // cap: domed crown (two tiers), button, front logo, brim
    .frustum(0.238, 0.254, 0.226, 0.24, 0.05, C.cap, 0, 0.282, 0.004)
    .frustum(0.226, 0.24, 0.15, 0.16, 0.045, C.cap, 0, 0.3295, 0.004)
    .box(0.026, 0.012, 0.026, C.capBand, 0, 0.356, 0.004)
    .box(0.075, 0.035, 0.01, C.logo, 0, 0.288, -0.121)
    .box(0.185, 0.016, 0.095, C.capBrim, 0, 0.262, -0.165, -0.06, 0, 0);
  attach(headPivot, head, 'head');

  // Arms
  const arms = {};
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? -1 : 1;
    const shoulder = joint(spine, sx * 0.215, 0.37, 0, `shoulder${side}`);
    attach(shoulder, new PartList()
      .frustum(0.125, 0.135, 0.1, 0.11, 0.12, C.suit, sx * 0.008, -0.03, 0)
      .frustum(0.1, 0.11, 0.12, 0.13, 0.3, C.suit, 0, -0.14, 0), `upperArm${side}`);
    const elbow = joint(shoulder, 0, -0.28, 0, `elbow${side}`);
    attach(elbow, new PartList()
      .frustum(0.085, 0.095, 0.105, 0.115, 0.24, C.suit, 0, -0.11, 0)
      .box(0.1, 0.035, 0.11, C.suitDark, 0, -0.215, 0)
      .frustum(0.085, 0.1, 0.082, 0.098, 0.125, C.skin, 0, -0.295, -0.005)
      .box(0.03, 0.06, 0.035, C.skin, -sx * 0.026, -0.27, -0.05), `forearm${side}`);
    arms[side] = { shoulder, elbow };
  }

  return {
    root,
    rig,
    meshes,
    material: mat,
    scale: RIG_SCALE,
    joints: {
      pelvis, spine, neck,
      hipL: legs.L.hip, kneeL: legs.L.knee, ankleL: legs.L.ankle,
      hipR: legs.R.hip, kneeR: legs.R.knee, ankleR: legs.R.ankle,
      shoulderL: arms.L.shoulder, elbowL: arms.L.elbow,
      shoulderR: arms.R.shoulder, elbowR: arms.R.elbow,
    },
  };
}
