// Shared building kit for the chicken house: a vertex-coloured geometry batch (merges many small
// parts into one draw call), transform helpers, canvas textures and a seeded random.
// Owner: house agent.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// Matrix from position, Euler rotation (XYZ) and scale.
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// Matrix that maps a unit Y-axis part (y from -0.5 to 0.5) onto the segment p0 -> p1, radius r.
export function between(p0, p1, r = 1) {
  _d.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const len = _d.length() || 1e-6;
  _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
  _v.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
  return new THREE.Matrix4().compose(_v, _q, _s.set(r, len, r));
}

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const unitBox = () => cached('box', () => new THREE.BoxGeometry(1, 1, 1));
export const unitCyl = (seg = 8, open = false) => cached(`cyl${seg}${open}`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1, open));
export const cone = (rTop, rBot, h, seg = 12, open = false) =>
  cached(`cone${rTop},${rBot},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open));
export const lathe = (key, pts, seg = 12) =>
  cached(`lathe${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));

// Accumulates parts (each with one flat colour) into one non-indexed, vertex-coloured geometry.
export class Batch {
  constructor() { this.pos = []; this.col = []; }

  add(geo, color, matrix) {
    const p = geo.attributes.position;
    const idx = geo.index;
    _c.set(color);
    const n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i++) {
      _v.fromBufferAttribute(p, idx ? idx.getX(i) : i);
      if (matrix) _v.applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      this.col.push(_c.r, _c.g, _c.b);
    }
    return this;
  }

  // Axis-aligned box (w along x, h along y, d along z) centred at x,y,z, optional yaw / tilt.
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    return this.add(unitBox(), color, mat(x, y, z, rx, ry, rz, w, h, d));
  }

  // Vertical cylinder centred at x,y,z.
  cyl(r, h, x, y, z, color, seg = 8) {
    return this.add(unitCyl(seg), color, mat(x, y, z, 0, 0, 0, r, h, r));
  }

  // Round bar / pipe from p0 to p1 (arrays [x,y,z]).
  rod(p0, p1, r, color, seg = 6) {
    return this.add(unitCyl(seg), color, between(p0, p1, r));
  }

  // Square bar from p0 to p1 (a thin box oriented along the segment).
  bar(p0, p1, s, color) {
    return this.add(unitBox(), color, between(p0, p1, s));
  }

  get empty() { return this.pos.length === 0; }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
}

export function makeMaterials() {
  return {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    vcDS: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };
}

// 2D canvas -> sRGB texture.
export function canvasTexture(w, h, draw, { repeat = null, mipmaps = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (!mipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Deterministic random numbers so the house looks the same every load.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// Piecewise-linear lookup in [[x, y], ...] (x ascending).
export function table(rows, x) {
  if (x <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    if (x <= rows[i][0]) {
      const [x0, y0] = rows[i - 1], [x1, y1] = rows[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return rows[rows.length - 1][1];
}

// Rounded rectangle path on a 2D canvas.
export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export const FONT = '"Chakra Petch", "Segoe UI", system-ui, Arial, sans-serif';
