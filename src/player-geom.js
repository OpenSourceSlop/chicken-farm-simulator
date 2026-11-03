// Small geometry helpers for the farmer: a tapered box (frustum) and a merger that bakes many
// coloured parts into one flat-shaded, vertex-coloured BufferGeometry (one draw call per limb).
import * as THREE from 'three';

// Box whose bottom is wb x db and top is wt x dt (height h, centred on the origin).
// topShiftZ slides the top face along Z (for a slanted front, e.g. a cap crown).
export function frustumGeometry(wb, db, wt, dt, h, topShiftZ = 0) {
  const y0 = -h / 2, y1 = h / 2;
  const b = [
    [-wb / 2, y0, -db / 2], [wb / 2, y0, -db / 2], [wb / 2, y0, db / 2], [-wb / 2, y0, db / 2],
  ];
  const t = [
    [-wt / 2, y1, -dt / 2 + topShiftZ], [wt / 2, y1, -dt / 2 + topShiftZ],
    [wt / 2, y1, dt / 2 + topShiftZ], [-wt / 2, y1, dt / 2 + topShiftZ],
  ];
  // Each quad listed counter-clockwise as seen from outside.
  const quads = [
    [b[0], b[1], b[2], b[3]], // bottom (-Y)
    [t[0], t[3], t[2], t[1]], // top (+Y)
    [b[1], b[0], t[0], t[1]], // front (-Z)
    [b[3], b[2], t[2], t[3]], // back (+Z)
    [b[2], b[1], t[1], t[2]], // right (+X)
    [b[0], b[3], t[3], t[0]], // left (-X)
  ];
  const pos = [];
  for (const [p0, p1, p2, p3] of quads) pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// Collects coloured parts, then merges them into one geometry.
export class PartList {
  constructor() { this.parts = []; }

  // geom is consumed (disposed after merge). Rotation in radians (XYZ order). s = uniform or [x,y,z].
  add(geom, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.set(s, s, s);
    this.parts.push({ geom, color, matrix: new THREE.Matrix4().compose(_p, _q, _s) });
    return this;
  }

  box(w, h, d, color, x, y, z, rx, ry, rz) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }

  frustum(wb, db, wt, dt, h, color, x, y, z, rx, ry, rz, shiftZ = 0) {
    return this.add(frustumGeometry(wb, db, wt, dt, h, shiftZ), color, x, y, z, rx, ry, rz);
  }

  // Low-poly cylinder (n sides) standing on Y.
  cyl(rt, rb, h, n, color, x, y, z, rx, ry, rz) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, n), color, x, y, z, rx, ry, rz);
  }

  merge() {
    const geos = [];
    let count = 0;
    for (const p of this.parts) {
      const g = p.geom.index ? p.geom.toNonIndexed() : p.geom;
      if (g !== p.geom) p.geom.dispose();
      g.applyMatrix4(_m.copy(p.matrix));
      geos.push([g, p.color]);
      count += g.attributes.position.count;
    }
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    let o = 0;
    for (const [g, color] of geos) {
      const a = g.attributes.position.array;
      pos.set(a, o * 3);
      _c.set(color);
      const n = a.length / 3;
      for (let i = 0; i < n; i++) {
        col[(o + i) * 3] = _c.r;
        col[(o + i) * 3 + 1] = _c.g;
        col[(o + i) * 3 + 2] = _c.b;
      }
      o += n;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeVertexNormals(); // non-indexed: flat normals per triangle
    out.computeBoundingSphere();
    this.parts = [];
    return out;
  }
}
