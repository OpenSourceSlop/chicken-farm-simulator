// Shared kit for the Phase 2 props: materials (the same parameters as the house and world ones, so
// three.js reuses their shader programs), a dynamic DataTexture helper and small geometry helpers.
// Owner: package "props".
import * as THREE from 'three';
import { Batch, mat, between, unitBox, unitCyl, cone, disc, lathe, canvasTexture, roundRect, rng, clamp01, smooth, FONT } from './house-kit.js';

export { Batch, mat, between, unitBox, unitCyl, cone, disc, lathe, canvasTexture, roundRect, rng, clamp01, smooth, FONT };

// One set of materials for every prop. Vertex-coloured, flat-shaded Lambert like the house: the
// program is the one the house already compiled.
export function makePropMaterials() {
  return {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    vcDS: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
  };
}

// A mesh from a batch, no shadows by default (inside the house everything is in roof shade).
export function batchMesh(b, material, { cast = false, receive = true, name } = {}) {
  const m = b.mesh(material, { cast, receive });
  if (name) m.name = name;
  return m;
}

// RGBA8 DataTexture that is rewritten from typed data (linear filter, no mipmaps).
export function dataTexture(w, h) {
  const data = new Uint8Array(w * h * 4);
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// Local frame helper: parts given in a prop's own coordinates (u to the right along its front,
// v out of its front, y up) placed at (x, z) facing `face` (yaw: 0 = front faces +z, toward the
// default camera; pi/2 = faces +x).
export function placer(b, x, z, face = 0) {
  const c = Math.cos(face), s = Math.sin(face);
  const P = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  return {
    P,
    box(w, h, d, u, y, v, color, ry = 0, rx = 0, rz = 0) {
      const [px, pz] = P(u, v);
      b.box(w, h, d, px, y, pz, color, face + ry, rx, rz);
    },
    cyl(r, h, u, y, v, color, seg = 8) {
      const [px, pz] = P(u, v);
      b.cyl(r, h, px, y, pz, color, seg);
    },
    rod(p0, p1, r, color, seg = 6) {
      const [ax, az] = P(p0[0], p0[2]), [bx, bz] = P(p1[0], p1[2]);
      b.rod([ax, p0[1], az], [bx, p1[1], bz], r, color, seg);
    },
    add(geo, color, u, y, v, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
      const [px, pz] = P(u, v);
      b.add(geo, color, mat(px, y, pz, rx, face + ry, rz, sx, sy, sz));
    },
  };
}

// Instanced boxes with a colour each; hidden instances are scaled to zero (the count never
// changes, so the shader program the warm-up compiled is the one that draws them).
export function instancedParts(geo, material, n, { cast = false, color = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, n);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) m.setMatrixAt(i, zero);
  if (color) {
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) m.setColorAt(i, c);
  }
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

// A pool of instanced unit boxes, each with its own transform and colour: the small moving or
// recoloured parts of every prop (valve handles, gauge needles, sight tubes, lamps, water streams,
// level strips) in one draw call. slot() hands out an index; set() places it; hide() scales it to 0.
export function createBoxPool(material, n = 96) {
  const mesh = instancedParts(new THREE.BoxGeometry(1, 1, 1), material, n);
  mesh.name = 'props-pool';
  let used = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let dirty = false;
  return {
    mesh,
    slot() { if (used >= n) throw new Error('props box pool full'); return used++; },
    set(i, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0) {
      _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
      mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
      if (color != null) mesh.setColorAt(i, _c.set(color));
      dirty = true;
    },
    color(i, color) { mesh.setColorAt(i, _c.set(color)); dirty = true; },
    hide(i) { mesh.setMatrixAt(i, zero); dirty = true; },
    flush() {
      if (!dirty) return;
      dirty = false;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
