// Phase 4 (PHASE4.md §8.4): the water tank and the well pump in a water problem. Owner: package "scene" (props).
//   sight gauge   a white board with a clear tube on the tank's south face (world-buildings.js waterTower): the blue
//                 water column at farm.waterTank.levelPct, the orange marker at lowPct (the lowest level since the
//                 last reading), ticks every 10 %
//   well pump     a pump box on the outlet pipe at the tower's foot, a pressure gauge (0-4 bar) and the starter's
//                 ammeter (0-10 A): the needles read WATER_TANK.pumpBar x pumpShare and pumpA + 3 x (1 - pumpShare)
//                 (the farm's water.tank figures), a little flutter while it runs, low when worn, at 0 and still
//                 while farm.waterTank.fixing (the pump stopped for the repair: a toolbox on the plinth)
// Shown with a water problem only.
import * as THREE from 'three';
import { FARM, WATER_TANK } from './config.js';
import { Batch, mat, canvasTexture, FONT } from './props-kit.js';
import { reducedMotion } from './world-cond.js';
import { decal } from './world-util.js';

const T = FARM.waterTank;
const TANK = { r: 1.45, y0: 7.3, y1: 9.8 };
export const GAUGE = { x: T.x + 0.3, z: T.z + TANK.r + 0.04, y0: 7.5, y1: 9.6, w: 0.36 };
export const PUMP = { x: T.x + 0.95, z: T.z + 0.4, y: 0.12 };
// the float gauge's board on the tower's south-east leg (the same level and marker as the strip on the tank, at
// eye height where the farmer reads the pump: a float in the tank on a cable over the board)
export const BOARD = { x: T.x + 1.51, z: T.z + 1.51 + 0.11, y0: 0.75, y1: 2.05, w: 0.24 };
const DIAL = { r: 0.13, bar: { x: PUMP.x - 0.08, y: 0.86 }, amp: { x: PUMP.x + 0.55, y: 0.9 } };
const SWEEP = (Math.PI * 3) / 2;                   // 270 degrees of scale

function gaugeFace() {
  return canvasTexture(128, 768, (g, w, h) => {
    g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2f5d8a'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#c9d8e0'; g.fillRect(52, 30, 24, h - 60);                    // the empty tube
    g.fillStyle = '#23302a'; g.font = `700 22px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let k = 0; k <= 10; k++) {
      const y = h - 30 - (k / 10) * (h - 60);
      g.fillRect(80, y - 2, k % 5 ? 16 : 28, 4);
      if (k % 5 === 0) g.fillText(`${k * 10}`, 46, y);
    }
  }, { mipmaps: false });
}

function dialFace() {
  return canvasTexture(256, 128, (g) => {
    const one = (cx, max, unit, mark) => {
      g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(cx, 64, 60, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a3e42'; g.lineWidth = 5; g.stroke();
      g.strokeStyle = '#23302a'; g.lineWidth = 3;
      for (let k = 0; k <= max; k++) {
        const a = Math.PI * 0.75 + (k / max) * SWEEP;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.lineTo(cx + Math.cos(a) * 54, 64 + Math.sin(a) * 54); g.stroke();
      }
      // the plate's figure in good order, marked green on the scale
      const a = Math.PI * 0.75 + (mark / max) * SWEEP;
      g.strokeStyle = '#3f9a52'; g.lineWidth = 7;
      g.beginPath(); g.arc(cx, 64, 49, a - 0.08, a + 0.08); g.stroke();
      g.fillStyle = '#23302a'; g.font = `700 18px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(unit, cx, 94);
    };
    one(64, 4, 'bar', WATER_TANK.pumpBar);
    one(192, 10, 'A', WATER_TANK.pumpA);
  }, { mipmaps: false });
}

export function buildWaterTank(group, parts, lit) {
  const root = new THREE.Group();
  root.name = 'props-water-tank';
  const b = new Batch();
  // the gauge board's frame and brackets on the tank
  const G = GAUGE, gh = G.y1 - G.y0, gy = (G.y0 + G.y1) / 2;
  b.box(G.w + 0.06, gh + 0.06, 0.03, G.x, gy, G.z - 0.03, 0x2f5d8a);
  for (const y of [G.y0 + 0.1, G.y1 - 0.1]) b.box(G.w + 0.2, 0.04, 0.12, G.x, y, G.z - 0.08, 0x8f989f);
  // the well pump: plinth, pump body, motor, the riser with the pressure gauge, the starter box with its ammeter
  const P = PUMP;
  b.box(0.95, 0.12, 0.6, P.x + 0.15, 0.06, P.z, 0xb9b4a8);
  b.box(0.42, 0.34, 0.36, P.x - 0.08, P.y + 0.17, P.z, 0x2f6f8f);
  b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12), 0x24576f, mat(P.x + 0.3, P.y + 0.2, P.z, 0, 0, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12), 0x1d4458, mat(P.x + 0.52, P.y + 0.2, P.z, 0, 0, Math.PI / 2));
  b.rod([P.x - 0.08, P.y + 0.34, P.z + 0.05], [DIAL.bar.x, DIAL.bar.y - DIAL.r, P.z + 0.05], 0.018, 0x9aa2a8, 6);
  b.add(new THREE.CylinderGeometry(DIAL.r + 0.015, DIAL.r + 0.015, 0.05, 16), 0x3a3e42, mat(DIAL.bar.x, DIAL.bar.y, P.z + 0.05, Math.PI / 2, 0, 0));
  b.box(0.05, 0.9, 0.05, DIAL.amp.x, 0.45, P.z - 0.02, 0x6d757c);
  b.box(0.34, 0.36, 0.14, DIAL.amp.x, DIAL.amp.y, P.z + 0.03, 0xa7aeb3);
  b.rod([DIAL.amp.x - 0.1, DIAL.amp.y - 0.18, P.z + 0.03], [P.x + 0.3, P.y + 0.36, P.z], 0.016, 0x2b2e31, 5);
  // the float gauge board: its frame on the leg, the cable up to the tank
  const B = BOARD, bh = B.y1 - B.y0;
  b.box(B.w + 0.05, bh + 0.05, 0.03, B.x, (B.y0 + B.y1) / 2, B.z - 0.025, 0x2f5d8a);
  for (const y of [B.y0 + 0.15, B.y1 - 0.15]) b.box(0.05, 0.04, 0.12, B.x, y, B.z - 0.08, 0x8f989f);
  b.rod([B.x - 0.08, B.y1 + 0.02, B.z - 0.01], [T.x + 1.25, TANK.y0 + 0.05, T.z + 1.3], 0.006, 0x2b2e31, 4);
  const fixed = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { cast: true, receive: true });
  fixed.name = 'props-water-tank-parts';
  // faces: the gauge board (canvas) and the two dials (one canvas)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(G.w, gh), decal(new THREE.MeshLambertMaterial({ map: gaugeFace() })));
  face.position.set(G.x, gy, G.z - 0.012);
  const dials = new THREE.Mesh(new THREE.PlaneGeometry(DIAL.r * 2, DIAL.r * 2), decal(new THREE.MeshLambertMaterial({ map: dialFace() })));
  const ug = dials.geometry.attributes.uv;
  for (let k = 0; k < ug.count; k++) ug.setX(k, ug.getX(k) * 0.5);
  dials.position.set(DIAL.bar.x, DIAL.bar.y, P.z + 0.078);
  const amp = new THREE.Mesh(new THREE.PlaneGeometry(DIAL.r * 2, DIAL.r * 2), dials.material);
  const ua = amp.geometry.attributes.uv;
  for (let k = 0; k < ua.count; k++) ua.setX(k, 0.5 + ua.getX(k) * 0.5);
  amp.position.set(DIAL.amp.x, DIAL.amp.y, P.z + 0.102);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(B.w, bh), face.material);
  board.position.set(B.x, (B.y0 + B.y1) / 2, B.z - 0.008);
  root.add(fixed, face, dials, amp, board);
  root.visible = false;
  group.add(root);

  const fill = parts.slot(), marker = parts.slot(), needle = parts.slot(), ampNeedle = parts.slot(), box = parts.slot(), boxLid = parts.slot();
  const bFill = parts.slot(), bMarker = parts.slot();
  const bY0 = B.y0 + bh * (30 / 768), bH = bh * (708 / 768);
  const runLamp = lit.slot();
  const st = { levelPct: NaN, lowPct: NaN, bar: 0, amps: 0, fixing: false };
  let t = 0;
  const tubeY0 = G.y0 + gh * (30 / 768), tubeH = gh * (708 / 768);
  const tubeX = G.x - G.w / 2 + G.w * (64 / 128);

  function needleAt(slot, cx, cy, z, v, max) {
    const a = -(Math.PI * 0.75 + (Math.max(0, Math.min(max, v)) / max) * SWEEP);  // canvas y down: mirror the angle
    const len = DIAL.r * 0.78;
    parts.set(slot, cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.5, z, len, 0.012, 0.006, 0xb02a1f, 0, 0, a);
  }

  return {
    root, st,
    hide() {
      if (!root.visible) return;
      root.visible = false;
      for (const s of [fill, marker, needle, ampNeedle, box, boxLid, bFill, bMarker]) parts.hide(s);
      lit.hide(runLamp);
    },
    update(dt, f) {
      root.visible = true;
      t += dt;
      const W = f.waterTank || {};
      const lvl = Math.max(0, Math.min(100, Number.isFinite(W.levelPct) ? W.levelPct : 95));
      const low = Math.max(0, Math.min(100, Number.isFinite(W.lowPct) ? W.lowPct : lvl));
      st.levelPct = lvl; st.lowPct = low; st.fixing = !!W.fixing;
      const h = Math.max(0.004, (tubeH * lvl) / 100);
      parts.set(fill, tubeX, tubeY0 + h / 2, G.z - 0.004, G.w * (24 / 128) - 0.006, h, 0.01, 0x2f7fc4);
      const my = tubeY0 + (tubeH * low) / 100;
      parts.set(marker, tubeX, my, G.z + 0.003, 0.12, 0.026, 0.02, 0xef6a1a);   // the low marker across the tube
      const bh2 = Math.max(0.003, (bH * lvl) / 100);
      parts.set(bFill, B.x, bY0 + bh2 / 2, B.z - 0.002, B.w * (24 / 128) - 0.004, bh2, 0.008, 0x2f7fc4);
      parts.set(bMarker, B.x, bY0 + (bH * low) / 100, B.z + 0.004, 0.085, 0.02, 0.016, 0xef6a1a);
      // the gauges: the farm's readings (water.tank), a little flutter while the pump runs
      const share = Math.max(0, Math.min(1, Number.isFinite(W.pumpShare) ? W.pumpShare : 1));
      const run = !W.fixing;
      const flutter = run && !reducedMotion() ? 0.025 * Math.sin(t * 9.1) + 0.015 * Math.sin(t * 23.3) : 0;
      st.bar = run ? WATER_TANK.pumpBar * share + flutter : 0;
      st.amps = run ? WATER_TANK.pumpA + 3 * (1 - share) + flutter * 2 : 0;
      needleAt(needle, DIAL.bar.x, DIAL.bar.y, PUMP.z + 0.084, st.bar, 4);
      needleAt(ampNeedle, DIAL.amp.x, DIAL.amp.y, PUMP.z + 0.108, st.amps, 10);
      lit.set(runLamp, DIAL.amp.x + 0.12, DIAL.amp.y + 0.14, PUMP.z + 0.1, 0.03, 0.03, 0.02, run ? 0x58f070 : 0x23382a);
      // the repair: the toolbox open on the plinth while the pump is stopped
      if (W.fixing) {
        parts.set(box, PUMP.x + 0.42, 0.2, PUMP.z + 0.22, 0.36, 0.16, 0.18, 0xc23a2a);
        parts.set(boxLid, PUMP.x + 0.42, 0.33, PUMP.z + 0.32, 0.36, 0.015, 0.17, 0xa83224, 0, -1.0);
      } else { parts.hide(box); parts.hide(boxLid); }
    },
  };
}
