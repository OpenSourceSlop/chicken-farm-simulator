// Shared helpers for the farm world: a vertex-coloured geometry builder (merges many small
// parts into one draw call), value noise and a seeded random generator. Owner: world agent.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
let jitterSeed = 12345;
function jrand() { jitterSeed = (Math.imul(jitterSeed, 1103515245) + 12345) & 0x7fffffff; return jitterSeed / 0x7fffffff; }

const baseCache = new Map();
function cached(key, make) {
  let g = baseCache.get(key);
  if (!g) { g = make(); g = g.index ? g.toNonIndexed() : g; baseCache.set(key, g); }
  return g;
}
export const unitBox = () => cached('box', () => new THREE.BoxGeometry(1, 1, 1));
export const unitCyl = (n = 8, top = 1) => cached(`cyl${n}:${top}`, () => new THREE.CylinderGeometry(top, 1, 1, n, 1));
export const unitCone = (n = 8) => cached(`cone${n}`, () => new THREE.ConeGeometry(1, 1, n, 1));
export const unitIco = (detail = 0) => cached(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
export const unitSphere = (w = 8, h = 6) => cached(`sph${w}x${h}`, () => new THREE.SphereGeometry(1, w, h));

// Seeded random numbers (mulberry32)
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// Smooth value noise in 0..1
export function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, oct = 3, seed = 0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, z * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm;
}
export const smoothstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Distance from a point to an axis-aligned rectangle (0 inside)
export function rectDist(x, z, x0, x1, z0, z1) {
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
  return Math.hypot(dx, dz);
}

// Accumulates triangles with per-face normals and vertex colours, then emits one BufferGeometry.
// Optional per-vertex `sway` weight (0 at the base of a plant, 1 at leaf tips) for wind animation.
export class GeoBuilder {
  constructor({ sway = false, uv = false } = {}) {
    this.pos = []; this.nor = []; this.col = [];
    this.sway = sway ? [] : null;
    this.uv = uv ? [] : null;
    this.parent = null;
  }

  // Add any geometry. o: { x,y,z, rx,ry,rz, s|sx,sy,sz, jitter, sway(fn(localY)->w) | swayAll, matrix }
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position.array;
    const UV = this.uv && g.attributes.uv ? g.attributes.uv.array : null;
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ');
    _q.setFromEuler(_e);
    _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_p, _q, _s);
    if (o.matrix) _m.premultiply(o.matrix);
    if (this.parent) _m.premultiply(this.parent);
    const jitter = o.jitter ?? 0;
    const base = _c.set(color);
    const br = base.r, bg = base.g, bb = base.b;
    const swayFn = o.sway, swayAll = o.swayAll ?? 0;
    const mirrored = _m.determinant() < 0; // keep front faces outward under negative scale
    const ib = mirrored ? 6 : 3, id = mirrored ? 3 : 6;
    for (let i = 0; i < P.length; i += 9) {
      _a.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(_m);
      _b.set(P[i + ib], P[i + ib + 1], P[i + ib + 2]).applyMatrix4(_m);
      _d.set(P[i + id], P[i + id + 1], P[i + id + 2]).applyMatrix4(_m);
      this.pos.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _d.x, _d.y, _d.z);
      // face normal
      const ux = _b.x - _a.x, uy = _b.y - _a.y, uz = _b.z - _a.z;
      const vx = _d.x - _a.x, vy = _d.y - _a.y, vz = _d.z - _a.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      const k = jitter ? 1 + (jrand() - 0.5) * jitter : 1;
      const r = br * k, gg = bg * k, b = bb * k;
      this.col.push(r, gg, b, r, gg, b, r, gg, b);
      if (this.sway) {
        if (swayFn) this.sway.push(swayFn(_a.y), swayFn(_b.y), swayFn(_d.y));
        else this.sway.push(swayAll, swayAll, swayAll);
      }
      if (this.uv) {
        if (UV) { const j = (i / 3) * 2, jb = j + (ib / 3) * 2, jd = j + (id / 3) * 2; this.uv.push(UV[j], UV[j + 1], UV[jb], UV[jb + 1], UV[jd], UV[jd + 1]); }
        else this.uv.push(0, 0, 0, 0, 0, 0);
      }
    }
    return this;
  }

  // Raw triangle with explicit corners and colour (used by the ground and paddies)
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, uvs) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    const c = color.isColor ? color : _c.set(color);
    this.col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
    if (this.sway) this.sway.push(0, 0, 0);
    if (this.uv) this.uv.push(...(uvs || [0, 0, 0, 0, 0, 0]));
    return this;
  }
  // Quad a-b-c-d (counter-clockwise seen from the front)
  quad(a, b, c, d, color, uvs) {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], color, uvs && [uvs[0], uvs[1], uvs[2], uvs[3], uvs[4], uvs[5]]);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], color, uvs && [uvs[0], uvs[1], uvs[4], uvs[5], uvs[6], uvs[7]]);
    return this;
  }

  // Axis-aligned box from min/max corners
  boxMM(x0, x1, y0, y1, z0, z1, color, o = {}) {
    return this.add(unitBox(), color, { ...o, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 });
  }
  // Box centred on x,z with its bottom at y
  box(w, h, d, x, y, z, color, o = {}) {
    return this.add(unitBox(), color, { ...o, x, y: y + h / 2, z, sx: w, sy: h, sz: d });
  }
  // Vertical cylinder, bottom at y
  cyl(r, h, x, y, z, color, n = 8, o = {}) {
    return this.add(unitCyl(n, o.top ?? 1), color, { ...o, x, y: y + h / 2, z, sx: r, sy: h, sz: r });
  }
  // Pipe (cylinder) between two points
  pipe(ax, ay, az, bx, by, bz, r, color, n = 6, o = {}) {
    _a.set(bx - ax, by - ay, bz - az);
    const len = _a.length();
    _a.divideScalar(len);
    _q.setFromUnitVectors(_up, _a);
    _s.set(r, len, r);
    _p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    const m = new THREE.Matrix4().compose(_p, _q, _s);
    return this.add(unitCyl(n), color, { ...o, matrix: m });
  }

  get count() { return this.pos.length / 3; }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.sway) g.setAttribute('sway', new THREE.Float32BufferAttribute(this.sway, 1));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(material, { cast = true, receive = true, name } = {}) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    if (name) m.name = name;
    return m;
  }
}

// Shared flat-shaded materials
export function makeMaterials() {
  return {
    flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    metal: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 70, specular: 0x5a5f64 }),
    // same looks, but screen-door faded when standing between the camera and the farmer
    flatFade: withOcclusionFade(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'occ-flat'),
    metalFade: withOcclusionFade(new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 70, specular: 0x5a5f64 }), 'occ-metal'),
    // window glass: glossy, glows warm at night (emissive set by world.js)
    glass: withOcclusionFade(new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 90, specular: 0x7a8894 }), 'occ-glass'),
  };
}

// Screen-door fade for world objects standing between the camera and the farmer (or right under
// the camera), so trees and buildings never hide the player. world.js updates the uniforms.
export const occlusion = { uCam: { value: new THREE.Vector3(0, 1e4, 0) }, uPlayer: { value: new THREE.Vector3() } };
const OCC_FRAG = /* glsl */`
uniform vec3 uCam; uniform vec3 uPlayer; varying vec3 vOccW;
float occBayer(vec2 p) {
  vec2 a = mod(p, 2.0), b = mod(floor(p * 0.5), 2.0);
  float d1 = 2.0 * a.x + 3.0 * a.y - 4.0 * a.x * a.y, d2 = 2.0 * b.x + 3.0 * b.y - 4.0 * b.x * b.y;
  return (4.0 * d1 + d2 + 0.5) / 16.0;
}`;
const OCC_TEST = /* glsl */`
  {
    vec3 ab = uPlayer - uCam;
    float t = dot(vOccW - uCam, ab) / max(dot(ab, ab), 1e-3);
    float d = length(vOccW - (uCam + ab * clamp(t, 0.0, 1.0)));
    // only what really stands across the sight line (a lamp head 3 m to the side stays whole)
    float f = smoothstep(2.3, 1.3, d) * step(t, 0.94);
    f = max(f, smoothstep(9.0, 4.5, length(vOccW - uCam)) * step(t, 0.85));
    f *= step(0.02, t) * step(0.45, vOccW.y);
    if (f > 0.01 && occBayer(floor(gl_FragCoord.xy)) < f * 0.86) discard;
  }`;
export function patchOcclusion(shader) {
  shader.uniforms.uCam = occlusion.uCam;
  shader.uniforms.uPlayer = occlusion.uPlayer;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vOccW;')
    // instanced meshes (the catch's crates and crew) test each instance where it stands
    .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\n  vOccW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n  vOccW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + OCC_FRAG)
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + OCC_TEST);
}
export function withOcclusionFade(material, key) {
  material.onBeforeCompile = patchOcclusion;
  material.customProgramCacheKey = () => key;
  return material;
}
