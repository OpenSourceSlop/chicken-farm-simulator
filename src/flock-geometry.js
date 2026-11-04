// Procedural low-poly bird for the instanced flock. Owner: flock agent.
// One merged, non-indexed geometry holds BOTH shapes with identical topology:
//   position = day-old chick, aPos2 = market-age broiler. The vertex shader blends them (uMorph).
// Model space: bird length 1 (beak tip to tail tip), forward +X, up +Y, right +Z, feet at y = 0.
// aPart tells the shader which body part a vertex belongs to, so it can pose it (see flock-shader.js).
import * as THREE from 'three';

export const PART = {
  body: 0, head: 1, beakUp: 2, beakLow: 3, wingL: 4, wingR: 5, legL: 6, legR: 7,
  tail: 8, eye: 9, comb: 10, wattle: 11,
};
export const PART_COUNT = 12;

// Joint positions for both shapes; the shader receives mix(chick, broiler, morph).
export const PIVOTS = {
  chick: {
    head: [0.1, 0.56, 0], beak: [0.39, 0.71, 0], wing: [0.04, 0.5, 0.22], hip: [-0.01, 0.15, 0.085],
    comb: [0.2, 0.925, 0], wattle: [0.36, 0.67, 0], legH: 0.1,
  },
  broiler: {
    head: [0.27, 0.54, 0], beak: [0.47, 0.66, 0], wing: [0.08, 0.53, 0.2], hip: [0, 0.2, 0.1],
    comb: [0.37, 0.76, 0], wattle: [0.43, 0.62, 0], legH: 0.15,
  },
};

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Matrix from position, scale and Euler rotation (applied scale -> rotate -> translate)
function T(px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz, 'XYZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz));
}

// Deterministic hash of a position, so coincident vertices get the same fluff offset (no cracks)
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

// Primitive as { pos, index }: indexed, with coincident vertices (UV seams, poles) welded, since
// flat shading needs positions only. Fewer vertices = less vertex work per bird.
function prim(geo) {
  const src = geo.getAttribute('position').array;
  const srcIndex = geo.index ? geo.index.array : Uint16Array.from({ length: src.length / 3 }, (_, k) => k);
  const map = new Map(), remap = [], pos = [];
  for (let v = 0; v < src.length / 3; v++) {
    const key = `${src[v * 3].toFixed(4)},${src[v * 3 + 1].toFixed(4)},${src[v * 3 + 2].toFixed(4)}`;
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(src[v * 3], src[v * 3 + 1], src[v * 3 + 2]); }
    remap.push(k);
  }
  const index = [];
  for (let t = 0; t < srcIndex.length; t += 3) {
    const a = remap[srcIndex[t]], b = remap[srcIndex[t + 1]], c = remap[srcIndex[t + 2]];
    if (a !== b && b !== c && a !== c) index.push(a, b, c); // drop triangles collapsed at the poles
  }
  return { pos, index };
}

// lod 0: close-up bird (309 triangles). lod 1: distant bird (113 triangles, no eyes or toes).
// lod 2 (Phase 5, PHASE5.md §4.4, the reduced flock detail of a slow computer): 64 triangles, 43 % under lod 1: a
// lower-segment body, head and wings (the wings still open in the heat), tapered legs, no wattle; the same parts and
// pivots, so the same poses and colours.
export function buildBirdGeometry(lod = 0) {
  const hi = lod === 0, lo = lod >= 2;
  const sph = (a, b, c) => new THREE.SphereGeometry(1, ...(hi ? a : lo ? c : b));
  const base = {
    body: prim(sph([9, 6], [6, 4], [5, 3])),
    neck: prim(sph([5, 3], [4, 2], [3, 2])),
    head: prim(sph([7, 5], [5, 3], [4, 2])),
    wing: prim(sph([6, 3], [4, 2], [3, 2])),
    blob: prim(new THREE.SphereGeometry(1, 4, 2)),
    // open cones pointing +X (ConeGeometry points +Y; rotate -90° about Z); bases hide inside
    cone: prim(new THREE.ConeGeometry(1, 1, lo ? 3 : 4, 1, true).rotateZ(-Math.PI / 2)),
    beak: prim(new THREE.ConeGeometry(1, 1, 3, 1, true).rotateX(Math.PI / 6).rotateZ(-Math.PI / 2)),
    spike: prim(new THREE.ConeGeometry(1, 1, 3, 1, true)),
    // lod 2: a leg tapering to the foot (an open cone pointing down: half the triangles of the open prism)
    leg: prim(lo ? new THREE.ConeGeometry(1.3, 1, 3, 1, true).rotateX(Math.PI) : new THREE.CylinderGeometry(1, 1, 1, 3, 1, true)),
    // flat triangular prism with one corner pointing +X: a three-toed foot
    foot: prim(new THREE.CylinderGeometry(1, 1, 1, 3).rotateY(Math.PI / 2)),
  };

  const posA = [], posB = [], parts = [], shades = [], index = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3();

  // Add one primitive: mA places it on the chick, mB on the broiler.
  // fluff: radial jitter (chick only) for a downy, irregular silhouette. shade: number or fn(bx,by,bz).
  function add(src, part, mA, mB, shade = 1, fluff = 0) {
    const first = posA.length / 3, p = src.pos;
    for (let i = 0; i < p.length; i += 3) {
      const bx = p[i], by = p[i + 1], bz = p[i + 2];
      const f = fluff ? 1 + fluff * (hash3(bx, by, bz) * 2 - 1) : 1;
      va.set(bx * f, by * f, bz * f).applyMatrix4(mA);
      vb.set(bx, by, bz).applyMatrix4(mB);
      posA.push(va.x, va.y, va.z);
      posB.push(vb.x, vb.y, vb.z);
      parts.push(part);
      shades.push(typeof shade === 'function' ? shade(bx, by, bz) : shade);
    }
    for (let k = 0; k < src.index.length; k++) index.push(first + src.index[k]);
  }

  // Body: chick round and downy, broiler long, deep and heavy with the breast forward.
  add(base.body, PART.body,
    T(-0.06, 0.4, 0, 0.35, 0.3, 0.3, 0, 0, 0.12),
    T(-0.05, 0.42, 0, 0.4, 0.255, 0.27, 0, 0, 0.14),
    (x, y) => 1.0 - 0.05 * y, 0.08);
  // Neck: hidden inside the chick, a short thick neck on the broiler
  add(base.neck, PART.body,
    T(0.1, 0.56, 0, 0.14, 0.14, 0.14),
    T(0.27, 0.56, 0, 0.11, 0.14, 0.1, 0, 0, -0.6), 1.0, 0.06);
  // Head: big round chick head, small broiler head
  add(base.head, PART.head,
    T(0.2, 0.73, 0, 0.21, 0.2, 0.2),
    T(0.37, 0.67, 0, 0.11, 0.095, 0.09), 1.0, 0.05);
  // Beak halves (upper larger), hinge near PIVOTS.beak
  add(base.beak, PART.beakUp,
    T(0.39 + 0.055, 0.72, 0, 0.11, 0.035, 0.045),
    T(0.47 + 0.04, 0.67, 0, 0.08, 0.024, 0.03));
  add(base.beak, PART.beakLow,
    T(0.39 + 0.04, 0.7, 0, 0.08, 0.022, 0.032),
    T(0.47 + 0.03, 0.652, 0, 0.06, 0.016, 0.022));
  // Eyes (dark beads on the head surface)
  for (const s of hi ? [-1, 1] : []) {
    add(base.blob, PART.eye,
      T(0.31, 0.78, 0.135 * s, 0.042, 0.045, 0.028),
      T(0.42, 0.7, 0.066 * s, 0.022, 0.022, 0.014));
  }
  // Wings, folded along the sides; tips slope down to the back and hug the body
  for (const s of [-1, 1]) {
    add(base.wing, s < 0 ? PART.wingL : PART.wingR,
      T(-0.08, 0.43, 0.255 * s, 0.19, 0.12, 0.06, 0, 0.1 * s, 0.25),
      T(-0.08, 0.46, 0.245 * s, 0.27, 0.14, 0.055, 0, 0.08 * s, 0.15),
      (x, y) => 0.9 + 0.05 * y);
  }
  // Tail: a downy nub on the chick, a short upturned wedge on the broiler
  add(base.cone, PART.tail,
    T(-0.4, 0.5, 0, 0.1, 0.06, 0.05, 0, 0, Math.PI - 0.6),
    T(-0.44, 0.55, 0, 0.11, 0.05, 0.075, 0, 0, Math.PI - 0.5), 0.92);
  // Legs and feet (feet belong to the leg part so they swing with it)
  for (const s of [-1, 1]) {
    const part = s < 0 ? PART.legL : PART.legR;
    add(base.leg, part, T(-0.01, 0.08, 0.085 * s, 0.018, 0.16, 0.018), T(0, 0.105, 0.1 * s, 0.03, 0.21, 0.03));
    if (hi) add(base.foot, part, T(0.025, 0.01, 0.085 * s, 0.06, 0.02, 0.045), T(0.04, 0.012, 0.1 * s, 0.085, 0.024, 0.06));
  }
  // Comb: a serrated crest on top of the head (scaled from 0 by uComb as the bird matures)
  const dc = [0.2 - 0.37, 0.925 - 0.76]; // broiler -> chick head-top offset
  const comb = [[0.33, 0.785, 0.07], [0.37, 0.8, 0.085], [0.41, 0.785, 0.065]];
  for (const [x, y, h] of hi ? comb : comb.slice(1, 2)) {
    add(base.spike, PART.comb, T(x + dc[0], y + dc[1], 0, 0.026, h, 0.012), T(x, y, 0, 0.026, h, 0.012));
  }
  if (hi) add(base.blob, PART.comb, T(0.37 + dc[0], 0.765 + dc[1], 0, 0.065, 0.028, 0.014), T(0.37, 0.765, 0, 0.065, 0.028, 0.014));
  // Wattles under the beak
  for (const s of hi ? [-1, 1] : lo ? [] : [0]) {
    add(base.blob, PART.wattle, T(0.36, 0.63, 0.018 * s, 0.024, 0.04, 0.012), T(0.43, 0.585, 0.018 * s, 0.026, 0.042, 0.012));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
  geo.setAttribute('aPos2', new THREE.Float32BufferAttribute(posB, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(parts, 1));
  geo.setAttribute('aShade', new THREE.Float32BufferAttribute(shades, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Generous bounds in model space (the instanced mesh gets its own house-sized sphere)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.45, 0), 0.8);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-0.6, 0, -0.6), new THREE.Vector3(0.6, 1, 0.6));
  return geo;
}
