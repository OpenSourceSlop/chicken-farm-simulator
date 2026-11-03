// Materials for the instanced flock. Owner: flock agent.
// The vertex shader blends chick -> broiler shape and poses each body part from three
// per-instance vec4s written by flock-pose.js (angles arrive as cos/sin, so there is no trig
// per vertex; that keeps software rendering and weak GPUs fast):
//   aAnimA = (cos pitch, sin pitch, headLift, sit 0..1)      pitch > 0 = beak down
//   aAnimB = (cos turn, sin turn, cos wing, sin wing)         wing = 0.95 rad * wingOut
//   aAnimC = (sin beakOpen, sin legSwing, tint -1..1, wingYaw) beak/leg angles < 0.7 rad
// Lengths are in model units (bird length = 1); the instance matrix scales to metres.
import * as THREE from 'three';
import { PART_COUNT, PIVOTS } from './flock-geometry.js';

const VERT_HEAD = /* glsl */`
attribute vec3 aPos2;
attribute float aPart;
attribute float aShade;
attribute vec4 aAnimA;
attribute vec4 aAnimB;
attribute vec4 aAnimC;
uniform float uMorph;
uniform float uComb;
uniform float uLegH;
uniform vec3 uHeadPivot;
uniform vec3 uBeakHinge;
uniform vec3 uWingPivot;
uniform vec3 uHipPivot;
uniform vec3 uCombPivot;
uniform vec3 uWattlePivot;

vec3 birdRotX(vec3 v, float c, float s) { return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 birdRotY(vec3 v, float c, float s) { return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 birdRotZ(vec3 v, float c, float s) { return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }

vec3 birdPose(vec3 chickPos) {
  vec3 p = mix(chickPos, aPos2, uMorph);
  float part = aPart;
  float sit = aAnimA.w;
  // comb (10) and wattles (11) grow with age
  if (part > 9.5) {
    vec3 piv = part < 10.5 ? uCombPivot : uWattlePivot;
    p = piv + (p - piv) * uComb;
  }
  // lower beak opens about the hinge (panting)
  if (part > 2.5 && part < 3.5) {
    float sb = aAnimC.x;
    p = uBeakHinge + birdRotZ(p - uBeakHinge, sqrt(1.0 - sb * sb), -sb);
  }
  // head group: head, beak, eyes, comb, wattles. Pitch, then turn, then lift.
  if ((part > 0.5 && part < 3.5) || part > 8.5) {
    vec3 q = birdRotZ(p - uHeadPivot, aAnimA.x, -aAnimA.y);
    q = birdRotY(q, aAnimB.x, aAnimB.y);
    p = uHeadPivot + q + vec3(0.0, aAnimA.z, 0.0);
  }
  // wings swing out about the shoulder (panting, cooling)
  if (part > 3.5 && part < 5.5) {
    float side = part > 4.5 ? 1.0 : -1.0;
    vec3 piv = vec3(uWingPivot.xy, uWingPivot.z * side);
    vec3 q = birdRotX(p - piv, aAnimB.z, -aAnimB.w * side);
    float wy = aAnimC.w * side;
    q = birdRotY(q, 1.0 - 0.5 * wy * wy, wy);
    p = piv + q;
  }
  if (part > 5.5 && part < 7.5) {
    // legs swing about the hip while walking, fold flat under the body when sitting
    float side = part > 6.5 ? 1.0 : -1.0;
    vec3 hip = vec3(uHipPivot.xy, uHipPivot.z * side);
    float sl = aAnimC.y * side;
    p = hip + birdRotZ(p - hip, sqrt(1.0 - sl * sl), sl);
    p.y *= (1.0 - 0.92 * sit);
    p.x = mix(p.x, hip.x, 0.4 * sit);
  } else {
    p.y -= sit * uLegH;
  }
  return p;
}
`;

const COLOR_HEAD = /* glsl */`
uniform vec3 uCol[${PART_COUNT}];
varying vec3 vBirdColor;
`;

const COLOR_CODE = /* glsl */`
{
  int pi = int(aPart + 0.5);
  vec3 col = uCol[pi];
  float feather = (pi <= 1 || pi == 4 || pi == 5 || pi == 8) ? 1.0 : 0.0;
  float tint = aAnimC.z;
  col *= aShade * (1.0 + 0.06 * tint * feather);
  col.b *= 1.0 + 0.3 * tint * feather * (1.0 - 0.8 * uMorph); // chicks vary in yellow, broilers stay white
  vBirdColor = col;
}
`;

// Uniforms shared by the colour and the shadow-depth materials
export function createBirdUniforms() {
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const c = PIVOTS.chick;
  return {
    uMorph: { value: 0 },
    uComb: { value: 0 },
    uGlow: { value: 0.22 },
    uLegH: { value: c.legH },
    uHeadPivot: { value: v3(c.head) },
    uBeakHinge: { value: v3(c.beak) },
    uWingPivot: { value: v3(c.wing) },
    uHipPivot: { value: v3(c.hip) },
    uCombPivot: { value: v3(c.comb) },
    uWattlePivot: { value: v3(c.wattle) },
    uCol: { value: Array.from({ length: PART_COUNT }, () => new THREE.Color(1, 1, 1)) },
  };
}

// Blend the joint uniforms for a morph value 0 (chick) .. 1 (broiler)
export function setMorphUniforms(u, m) {
  const a = PIVOTS.chick, b = PIVOTS.broiler;
  u.uMorph.value = m;
  u.uLegH.value = a.legH + (b.legH - a.legH) * m;
  const lerp3 = (vec, k) => vec.set(
    a[k][0] + (b[k][0] - a[k][0]) * m, a[k][1] + (b[k][1] - a[k][1]) * m, a[k][2] + (b[k][2] - a[k][2]) * m);
  lerp3(u.uHeadPivot.value, 'head');
  lerp3(u.uBeakHinge.value, 'beak');
  lerp3(u.uWingPivot.value, 'wing');
  lerp3(u.uHipPivot.value, 'hip');
  lerp3(u.uCombPivot.value, 'comb');
  lerp3(u.uWattlePivot.value, 'wattle');
}

export function createBirdMaterials(uniforms) {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}\n${COLOR_HEAD}`)
      .replace('#include <begin_vertex>', `vec3 transformed = birdPose(position);\n${COLOR_CODE}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBirdColor;\nuniform float uGlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vBirdColor;')
      // a little self-light keeps small birds readable against the litter and in wall shadow
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uGlow;');
  };
  material.customProgramCacheKey = () => 'flock-bird-lambert-3';

  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = birdPose(position);');
  };
  depth.customProgramCacheKey = () => 'flock-bird-depth-2';
  return { material, depth };
}
