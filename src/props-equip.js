// Level 1 equipment the farmer reads and works: the water supply (meter dial, filter with two
// pressure gauges, four flush valves and sight tubes, streams at the east ends while flushing),
// the drinker regulators' pressure floats, the feeder control box, the silo level strips and
// gauge. Static parts go into the props' static batch; moving and recoloured parts into the
// shared box pool. Owner: package "props".
import * as THREE from 'three';
import { SPOTS2, DRINKER_LINES_Z, LINE_X, FARM, HOUSE_BOUNDS, EQUIP } from './config.js';
import { placer, canvasTexture, roundRect, FONT, clamp01, lerp } from './props-kit.js';

const PVC = 0x3a78b5, PVC_DK = 0x2a5f93, STEEL = 0x8f989f, GALV = 0xb4bcc2, WHITE = 0xe9edf0;
const REG_X = LINE_X.start + 0.12;      // drinker regulators (house-drinkers.js)
const PIPE_Y = 0.085;
const BROWN = new THREE.Color(0x7a5232), CLEAR = new THREE.Color(0xcfe9f0), _c = new THREE.Color();

// Water station in the south-west corner: a steel frame with a backboard, standing at an angle so
// it reads from the default camera and from inside the house.
export const WATER = { x: -23.05, z: 3.95, face: 0.8 };

function meterFace() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t };
}

function drawMeter(m, litres) {
  const { g } = m;
  g.fillStyle = '#20384f'; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2f4f2'; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#33413a'; g.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.beginPath(); g.moveTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); g.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106); g.stroke();
  }
  g.fillStyle = '#33413a'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('WATER  m³', 128, 70);
  // odometer: cubic metres and litres
  const L = Math.max(0, Math.floor(litres));
  const digits = String(Math.floor(L / 1000)).padStart(5, '0');
  g.fillStyle = '#111'; roundRect(g, 46, 104, 164, 46, 6); g.fill();
  g.font = `700 34px ${FONT}`;
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < 4 ? '#f4f1ea' : '#e8a23a';
    g.fillText(digits[i], 64 + i * 32, 128);
  }
  g.fillStyle = '#5b6a62'; g.font = `600 20px ${FONT}`;
  g.fillText(`${String(L % 1000).padStart(3, '0')} L`, 128, 176);
  // the litre pointer turns once per 10 L
  const a = ((L % 10) / 10) * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = '#c4471d'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); g.stroke();
  g.fillStyle = '#c4471d'; g.beginPath(); g.arc(128, 128, 8, 0, Math.PI * 2); g.fill();
  m.t.needsUpdate = true;
}

export function buildEquipment(stat, pool, group) {
  const tabSpots = new Map();
  const colliders = [];

  // ---------------- water supply ----------------
  const W = placer(stat, WATER.x, WATER.z, WATER.face);
  W.box(1.5, 1.3, 0.03, 0, 1.15, -0.06, 0xd9d2c0);                                  // backboard
  for (const u of [-0.74, 0.74]) W.box(0.06, 1.95, 0.06, u, 0.975, -0.08, STEEL);    // posts
  for (const y of [0.5, 1.8]) W.box(1.56, 0.05, 0.05, 0, y, -0.08, STEEL);
  for (const u of [-0.74, 0.74]) W.box(0.22, 0.02, 0.22, u, 0.01, -0.08, 0x6d757c);
  // supply in at the top left, down through the filter and the meter, into the manifold
  W.rod([-0.6, 2.25, 0.04], [-0.6, 1.62, 0.04], 0.03, PVC, 8);
  W.box(0.07, 0.07, 0.07, -0.6, 1.6, 0.04, PVC_DK);
  W.rod([-0.6, 1.6, 0.04], [-0.45, 1.6, 0.04], 0.03, PVC, 8);
  W.add(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 12), 0xf1f2ee, -0.45, 1.56, 0.06);   // filter head
  W.add(new THREE.CylinderGeometry(0.085, 0.085, 0.38, 12), 0x2f6fb5, -0.45, 1.33, 0.06);   // filter bowl
  W.add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), 0x1f4f85, -0.45, 1.12, 0.06);
  for (const u of [-0.6, -0.3]) {                                                       // gauge stems and cases
    W.rod([u, 1.6, 0.04], [u, 1.72, 0.04], 0.008, 0xb08d3c, 4);
    W.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14), 0x2b2f33, u, 1.78, 0.05, Math.PI / 2, 0, 0);
    W.add(new THREE.CylinderGeometry(0.052, 0.052, 0.006, 14), 0xf4f4ef, u, 1.78, 0.067, Math.PI / 2, 0, 0);
  }
  W.rod([-0.45, 1.6, 0.04], [-0.12, 1.6, 0.04], 0.03, PVC, 8);
  W.rod([-0.12, 1.6, 0.04], [-0.12, 1.33, 0.04], 0.03, PVC, 8);
  W.box(0.2, 0.12, 0.12, -0.12, 1.22, 0.05, 0xb08d3c);                                   // meter body
  W.add(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), 0x24496e, -0.12, 1.22, 0.11, Math.PI / 2, 0, 0);
  W.rod([-0.12, 1.12, 0.04], [-0.12, 0.72, 0.04], 0.03, PVC, 8);
  W.rod([-0.12, 0.72, 0.04], [0.62, 0.72, 0.04], 0.03, PVC, 8);                        // manifold
  const valveU = [0.08, 0.26, 0.44, 0.62];
  for (const u of valveU) {
    W.box(0.07, 0.07, 0.07, u, 0.72, 0.05, 0xe2e4df);                                     // ball valve
    W.rod([u, 0.76, 0.04], [u, 0.86, 0.04], 0.016, PVC, 6);
    W.rod([u, 1.32, 0.04], [u, 2.25, 0.04], 0.02, PVC, 6);                                // up to the line
    W.box(0.045, 0.04, 0.045, u, 0.87, 0.04, WHITE);
    W.box(0.045, 0.04, 0.045, u, 1.31, 0.04, WHITE);
  }
  // meter face (readable close up)
  const meter = meterFace();
  drawMeter(meter, 0);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.105, 20), new THREE.MeshBasicMaterial({ map: meter.t, toneMapped: false }));
  {
    const [px, pz] = W.P(-0.12, 0.137);
    face.position.set(px, 1.22, pz);
    face.rotation.y = WATER.face;
  }
  group.add(face);
  tabSpots.set('water-supply', { x: W.P(0.6, 0)[0], y: 2.05, z: W.P(0.6, 0)[1], ry: WATER.face, rx: 0 });
  const wb = { minX: WATER.x - 0.75, maxX: WATER.x + 0.55, minZ: WATER.z - 0.6, maxZ: WATER.z + 0.55 };
  colliders.push({ type: 'box', ...wb });

  const slots = {
    tubes: valveU.map(() => pool.slot()),
    handles: valveU.map(() => pool.slot()),
    needles: [pool.slot(), pool.slot()],
    streams: DRINKER_LINES_Z.map(() => pool.slot()),
    splash: DRINKER_LINES_Z.map(() => pool.slot()),
    floats: DRINKER_LINES_Z.map(() => pool.slot()),
  };

  // ---------------- feeder control box (north wall, west end) ----------------
  const F = placer(stat, SPOTS2.feederBox.x, HOUSE_BOUNDS.zMin + 0.2, 0);
  for (const u of [-0.24, 0.24]) F.box(0.05, 1.75, 0.05, u, 0.875, -0.05, STEEL);
  F.box(0.56, 0.68, 0.2, 0, 1.42, 0.06, 0x9da3a8);
  F.box(0.52, 0.64, 0.01, 0, 1.42, 0.165, 0xb3b9bd);
  F.box(0.4, 0.06, 0.012, 0, 1.68, 0.172, 0x2f5d8a);                                    // brand strip
  for (let i = 0; i < 3; i++) {
    const y = 1.52 - i * 0.14;
    F.add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), 0x2b2f33, -0.16, y, 0.18, Math.PI / 2, 0, 0); // run switch
    F.box(0.012, 0.045, 0.012, -0.16, y + 0.01, 0.2, 0xd8322f);
    F.add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), 0x2b2f33, 0.0, y, 0.18, Math.PI / 2, 0, 0);   // flood switch
    F.box(0.012, 0.045, 0.012, 0.0, y + 0.01, 0.2, 0xe8a23a);
  }
  F.rod([0.18, 1.76, 0.06], [0.18, 2.66, 0.06], 0.016, 0x80888e, 6);                   // conduit
  F.rod([-0.18, 1.08, 0.06], [-0.18, 0.02, 0.06], 0.016, 0x80888e, 6);
  const fx = SPOTS2.feederBox.x, fz = HOUSE_BOUNDS.zMin + 0.2;
  tabSpots.set('feeder-box', { x: fx + 0.22, y: 1.86, z: fz + 0.2, ry: 0, rx: 0 });
  const lamps = [0, 1, 2].flatMap(() => [pool.slot(), pool.slot()]);

  // ---------------- silos: level strips and the gauge post ----------------
  const silos = FARM.silos.map((s) => {
    const z = s.z + 1.31, x = s.x;
    stat.box(0.2, 2.62, 0.03, x, 3.62, z + 0.01, 0x3d4a55);                             // window frame
    for (let y = 2.5; y <= 4.8; y += 0.46) stat.box(0.24, 0.012, 0.035, x, y, z + 0.02, 0xf4f1ea);  // scale marks
    return { x, z, fill: pool.slot(), empty: pool.slot() };
  });
  const g = SPOTS2.silo;
  stat.box(0.08, 1.2, 0.08, g.x, 0.6, g.z - 0.1, STEEL);
  stat.box(0.34, 0.3, 0.1, g.x, 1.28, g.z - 0.06, 0xe9edf0);
  stat.box(0.3, 0.26, 0.01, g.x, 1.28, g.z, 0x24496e);
  stat.box(0.6, 0.02, 0.6, g.x, 0.15, g.z - 0.1, 0x6d757c);
  const siloNeedle = pool.slot();
  tabSpots.set('silo', { x: g.x + 0.2, y: 1.6, z: g.z, ry: 0, rx: 0 });
  colliders.push({ type: 'circle', x: g.x, z: g.z - 0.1, r: 0.25 });

  // regulators' facts tab (plate 'drinker' links all four)
  tabSpots.set('drinker', { x: REG_X, y: 0.9, z: DRINKER_LINES_Z[0] + 0.12, ry: 0, rx: 0 });

  let meterL = -1, meterTimer = 0, t = 0;
  return {
    tabSpots,
    colliders,
    update(dt, farm, env, lineY) {
      t += dt;
      const water = farm.water || {};
      const lines = water.lines || [];
      // meter dial: redraw when the litres change (at most twice a second)
      meterTimer -= dt;
      if (meterTimer <= 0) {
        meterTimer = 0.5;
        const L = Math.floor(water.meterL || 0);
        if (L !== meterL) { meterL = L; drawMeter(meter, L); }
      }
      // flush valves: handle along the pipe = closed, across = open; sight tube brown -> clear
      valveU.forEach((u, i) => {
        const ln = lines[i] || {};
        const open = !!ln.flushing;
        const [hx, hz] = W.P(u, 0.13);
        pool.set(slots.handles[i], hx, 0.76, hz, 0.14, 0.022, 0.03, open ? 0x2d6fb5 : 0xd8322f, WATER.face + (open ? Math.PI / 2 : 0));
        const clear = clamp01(ln.flushClear ?? 1);
        _c.copy(BROWN).lerp(CLEAR, clear);
        const [tx, tz] = W.P(u, 0.04);
        pool.set(slots.tubes[i], tx, 1.09, tz, 0.03, 0.42, 0.03, _c.getHex(), WATER.face);
        // stream out of the line's east end while flushing
        const z = DRINKER_LINES_Z[i];
        const y0 = (lineY ? lineY[i] : 0.3) + PIPE_Y;
        if (open) {
          const wob = 1 + 0.08 * Math.sin(t * 23 + i * 2);
          pool.set(slots.streams[i], LINE_X.end + 0.1, y0 / 2, z, 0.05 * wob, y0, 0.05 * wob, _c.getHex());
          pool.set(slots.splash[i], LINE_X.end + 0.12, 0.035, z, 0.5 * wob, 0.012, 0.4, _c.clone().multiplyScalar(0.8).getHex(), t * 0.5);
        } else { pool.hide(slots.streams[i]); pool.hide(slots.splash[i]); }
        // regulator float: the sight-tube column shows the pressure (cm of water)
        const cm = ln.pressureCm ?? 10;
        const fy = (lineY ? lineY[i] : 0.3) + PIPE_Y + 0.06 + Math.min(0.46, cm / 100);
        pool.set(slots.floats[i], REG_X + 0.1, fy, z, 0.03, 0.03, 0.03, 0xd8322f);
      });
      // filter gauges: 0..4 bar over 270 degrees (in, out = in x filter factor)
      const inBar = 2.5, outBar = 2.5 * (water.filterFactor ?? 1);
      [inBar, outBar].forEach((bar, k) => {
        const u = k ? -0.3 : -0.6;
        const a = lerp(-2.36, 2.36, bar / 4);
        const [nx, nz] = W.P(u + Math.sin(a) * 0.02, 0.075);
        pool.set(slots.needles[k], nx, 1.78 + Math.cos(a) * 0.02, nz, 0.006, 0.045, 0.004, 0x1e1e1e, WATER.face, 0, -a);
      });
      // feeder box lamps: green = running, amber = flood
      const fl = (farm.feed && farm.feed.lines) || [];
      for (let i = 0; i < 3; i++) {
        const y = 1.52 - i * 0.14;
        const run = !!(fl[i] && fl[i].running), flood = !!(fl[i] && fl[i].flood);
        pool.set(lamps[i * 2], fx + 0.13, y, fz + 0.18, 0.04, 0.04, 0.02, run ? 0x6be36b : 0x2f4f2f);
        pool.set(lamps[i * 2 + 1], fx + 0.21, y, fz + 0.18, 0.04, 0.04, 0.02, flood ? 0xffb43a : 0x5a4a2a);
      }
      // silo level strips: each silo holds half of the feed
      const kg = farm.feed ? farm.feed.siloKg ?? 0 : 0;
      const k = clamp01(kg / EQUIP.siloCapacityKg);
      const y0 = 2.33, H = 2.58;
      for (const s of silos) {
        const h = Math.max(0.001, H * k);
        pool.set(s.fill, s.x, y0 + h / 2, s.z + 0.03, 0.14, h, 0.02, 0xc9a764);
        pool.set(s.empty, s.x, y0 + h + (H - h) / 2, s.z + 0.03, 0.14, Math.max(0.001, H - h), 0.02, 0x1d2a33);
      }
      const na = lerp(-1.2, 1.2, k);
      pool.set(siloNeedle, g.x + Math.sin(na) * 0.05, 1.24 + Math.cos(na) * 0.05, g.z + 0.012, 0.012, 0.11, 0.006, 0xe8a23a, 0, 0, -na);
    },
  };
}
