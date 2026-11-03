// House shell: litter floor, side walls (concrete kick wall + insulated panel with a green
// curtain band that slides down for the camera cutaway), steel columns, eave beams, roof trusses.
// Owner: house agent.
import * as THREE from 'three';
import { COLORS, HOUSE, HOUSE_BOUNDS, DRINKER_LINES_Z, HEATERS, SPOTS } from './config.js';
import { Batch, canvasTexture, rng } from './house-kit.js';

const { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;
export const T = HOUSE.wallThickness;          // 0.15
export const H = HOUSE.wallHeight;             // 2.6
export const KICK = 0.5;                       // concrete kick wall height
export const EAVE_Y = H + 0.1;                 // top of the eave beam (trusses sit here)
export const TRUSS_Y = EAVE_Y + 0.03;          // bottom chord centre: hang point for equipment
export const RIDGE_Y = 4.0;
export const FRAME_X = [];
for (let x = xMin; x <= xMax + 1e-6; x += 4) FRAME_X.push(x);
export const SIDE_LIGHT = 0x8f989f;            // columns
export const TRUSS = 0xb3bbc1;

const PANEL_T = 0.1;                           // panel hides inside the 0.15 kick wall when lowered
const BAND = { y0: 1.0, y1: 2.2 };             // green curtain band on the side walls

// --- litter floor -----------------------------------------------------------------------------
function huskTexture() {
  const r = rng(7);
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(240,240,240)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const v = r();
      const c = v < 0.45 ? [255, 252, 238] : v < 0.85 ? [214, 205, 188] : [176, 160, 136];
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.55 + r() * 0.45})`;
      g.save();
      g.translate(r() * w, r() * h);
      g.rotate(r() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, 1.4 + r() * 1.8, 0.6 + r() * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }, { repeat: [30, 7.5] });
  t.colorSpace = THREE.NoColorSpace; // multiplicative detail, keep values linear
  return t;
}

function hash(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function buildFloor() {
  const geo = new THREE.PlaneGeometry(xMax - xMin, zMax - zMin, 96, 24);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const dryCol = new Float32Array(pos.count * 3);   // Level 1: the same litter without the baked damp lines
  // a little darker than COLORS.litter: in the even roof shade the chicks must stand out on it
  const base = new THREE.Color(COLORS.litter).multiplyScalar(0.88);
  const damp = new THREE.Color(0xb39058);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = vnoise(x * 0.45, z * 0.45) * 0.6 + vnoise(x * 1.7 + 40, z * 1.7) * 0.4;
    c.copy(base).multiplyScalar(0.93 + n * 0.16);
    const edge0 = Math.min(z - zMin, zMax - z, x - xMin, xMax - x);
    const k0 = edge0 < 0.4 ? 0.9 + (edge0 / 0.4) * 0.1 : 1;
    dryCol[i * 3] = c.r * k0; dryCol[i * 3 + 1] = c.g * k0; dryCol[i * 3 + 2] = c.b * k0;
    // damper, darker litter under the nipple lines
    let wet = 0;
    for (const dz of DRINKER_LINES_Z) wet = Math.max(wet, 1 - Math.abs(z - dz) / 0.45);
    wet *= 0.55 + vnoise(x * 1.3, z * 2 + 9) * 0.6;
    // drier, lighter litter right under the brooders
    let dry = 0;
    for (const hh of HEATERS) dry = Math.max(dry, 1 - Math.hypot(x - hh.x, z - hh.z) / 1.6);
    c.lerp(damp, Math.max(0, Math.min(0.55, wet)));
    c.multiplyScalar(1 + dry * 0.05);
    // a little darker where litter packs along the walls
    const edge = Math.min(z - zMin, zMax - z, x - xMin, xMax - x);
    if (edge < 0.4) c.multiplyScalar(0.9 + (edge / 0.4) * 0.1);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('colorDry', new THREE.BufferAttribute(dryCol, 3));
  const mat = new THREE.MeshLambertMaterial({ map: huskTexture(), vertexColors: true });
  const floor = new THREE.Mesh(geo, mat);
  floor.position.set((xMin + xMax) / 2, 0.02, (zMin + zMax) / 2);
  floor.receiveShadow = true;
  floor.renderOrder = -1;   // drawn first so the ground under it is rejected by the depth test
  return floor;
}

// --- walls ------------------------------------------------------------------------------------
// One side-wall panel run from x0 to x1 on the wall line zc (centre of the wall thickness).
function panelRun(b, x0, x1, zc) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  const wall = COLORS.wallWhite, band = COLORS.curtain, fold = 0x4a8c79;
  b.box(w, H - KICK, PANEL_T, cx, (KICK + H) / 2, zc, wall);
  b.box(w, BAND.y1 - BAND.y0, PANEL_T + 0.02, cx, (BAND.y0 + BAND.y1) / 2, zc, band);
  // folds of the curtain and its rope rail
  for (let y = BAND.y0 + 0.14; y < BAND.y1 - 0.08; y += 0.16) b.box(w, 0.05, PANEL_T + 0.03, cx, y, zc, fold);
  b.box(w, 0.05, PANEL_T + 0.035, cx, BAND.y1 + 0.02, zc, 0x9aa1a6);
  b.box(w, 0.05, PANEL_T + 0.035, cx, BAND.y0 - 0.02, zc, 0x9aa1a6);
  // top flashing (what stays visible as the stub cap when the panel is lowered)
  b.box(w, 0.08, PANEL_T + 0.02, cx, H - 0.04, zc, 0xb5bcc2);
}

// Static parts (kick walls) go into `stat`; returns the two sliding wall panels (north, south) for
// the cutaway. frame(north, south) may add more parts that slide with each panel (see buildFrame).
export function buildWalls(stat, mats, door, frame) {
  const kick = COLORS.wallLow;
  const dx0 = door.x - door.width / 2 - 0.1, dx1 = door.x + door.width / 2 + 0.1; // incl. door posts
  const zN = zMin - T / 2, zS = zMax + T / 2;
  // concrete kick walls (with a darker plinth line)
  const kickRun = (x0, x1, zc) => {
    stat.box(x1 - x0, KICK, T, (x0 + x1) / 2, KICK / 2, zc, kick);
    stat.box(x1 - x0, 0.04, T + 0.01, (x0 + x1) / 2, KICK - 0.02, zc, 0xa49e92);
  };
  kickRun(xMin, xMax, zN);
  kickRun(xMin, dx0, zS);
  kickRun(dx1, xMax, zS);

  const north = new Batch();
  panelRun(north, xMin, xMax, zN);
  const south = new Batch();
  panelRun(south, xMin, dx0, zS);
  panelRun(south, dx1, xMax, zS);
  if (frame) frame(north, south);
  const mk = (b, z, n) => {
    const m = b.mesh(mats.vc);
    const g = new THREE.Group();
    g.add(m);
    return { group: g, z, n, h: H };
  };
  return [mk(north, zMin, -1), mk(south, zMax, 1)];
}

// Steel frame. Columns every 4 m on the inside of the side walls: the base up to the stub stays in
// `stat`, the rest and the eave beam ride on that side's sliding wall (side[-1] north, side[1]
// south), so nothing tall is left standing on the camera side when the wall drops. The two
// north-wall columns that carry the boards (SPOTS) stay whole. Gable trusses: the bottom chords
// (tie beams, where the equipment hangs) go into `chords`; rafters, Fink webs and the ridge line
// into `rafters`, which show only with the roof (both drawn without shadows).
export function buildFrame(stat, chords, rafters, side) {
  const cs = 0.12, stub = HOUSE.stubHeight;
  const boardX = [SPOTS.signBrooder, SPOTS.controller].map((p) => (p.z < 0 ? -1 : 1) * 1000 + p.x);
  for (const x of FRAME_X) {
    const cx = Math.max(xMin + cs / 2, Math.min(xMax - cs / 2, x));
    for (const s of [-1, 1]) {
      const z = s * (zMax - cs / 2);
      if (boardX.some((k) => Math.abs(k - (s * 1000 + x)) < 0.5)) stat.box(cs, EAVE_Y, cs, cx, EAVE_Y / 2, z, SIDE_LIGHT);
      else {
        stat.box(cs, stub, cs, cx, stub / 2, z, SIDE_LIGHT);
        side[s].box(cs, H - stub, cs, cx, (stub + H) / 2, z, SIDE_LIGHT);
      }
      stat.box(0.2, 0.02, 0.2, cx, 0.03, z, 0x7c858c); // base plate
    }
  }
  for (const s of [-1, 1]) {
    side[s].box(xMax - xMin + 0.1, 0.1, 0.14, 0, H + 0.05, s * (zMax - 0.06), SIDE_LIGHT);
  }
  const top = (z) => TRUSS_Y + (RIDGE_Y - TRUSS_Y) * (1 - Math.abs(z) / 6.05);
  const m = 0.04;
  for (const x of FRAME_X) {
    const tx = Math.max(xMin + 0.06, Math.min(xMax - 0.06, x));
    chords.bar([tx, TRUSS_Y, -6.05], [tx, TRUSS_Y, 6.05], m, TRUSS);
    for (const s of [-1, 1]) {
      rafters.bar([tx, TRUSS_Y, s * 6.05], [tx, RIDGE_Y, 0], m, TRUSS);
      rafters.bar([tx, TRUSS_Y, s * 2.0], [tx, top(3.0), s * 3.0], m * 0.75, TRUSS);
      rafters.bar([tx, TRUSS_Y, s * 2.0], [tx, RIDGE_Y - 0.05, 0], m * 0.75, TRUSS);
    }
  }
  rafters.bar([xMin, RIDGE_Y + 0.04, 0], [xMax, RIDGE_Y + 0.04, 0], 0.07, 0x87909a);
}
