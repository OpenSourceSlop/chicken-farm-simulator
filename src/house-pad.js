// Evaporative cooling pad across the west end wall: cross-fluted cellulose panels, water
// distribution pipe on top, gutter at the bottom, sump tank with pump outside. When env.padOn the
// pad turns darker and a slow water sheen runs down both faces. Owner: house agent.
import * as THREE from 'three';
import { COLORS, PAD, HOUSE_BOUNDS } from './config.js';
import { canvasTexture, rng, smooth } from './house-kit.js';
import { T, H } from './house-shell.js';

const { xMin, zMin, zMax } = HOUSE_BOUNDS;
const PAD_T = 0.15;
const Z0 = zMin + 0.12, Z1 = zMax - 0.12;           // between the corner columns
const PANEL_W = (Z1 - Z0) / 20;                      // 20 pad panels of about 0.59 m

// Cross-fluted cellulose: lit ridges one way, shadowed flute edges the other way, so the face
// reads as a fine diamond lattice; darker seams between the 0.6 m panels. One tile = one panel.
function fluteTexture() {
  const t = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = 'rgb(212,212,212)';
    g.fillRect(0, 0, w, h);
    const step = 16;
    g.lineWidth = 3;
    g.strokeStyle = 'rgb(255,255,255)';
    for (let k = -h; k < w + h; k += step) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); }
    g.lineWidth = 2;
    g.strokeStyle = 'rgb(150,142,132)';
    for (let k = -h; k < w + h; k += step) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
    g.fillStyle = 'rgb(110,96,82)';
    g.fillRect(0, 0, 2, h);
    g.fillRect(w - 1, 0, 1, h);
  }, { repeat: [20, PAD.height / 0.59] });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Vertical water streaks that scroll down the wet pad.
function sheenTexture() {
  const r = rng(11);
  const t = canvasTexture(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      const x = r() * w, len = 40 + r() * 140, y = r() * h, a = 0.25 + r() * 0.5;
      const grd = g.createLinearGradient(0, y, 0, y + len);
      grd.addColorStop(0, 'rgba(200,230,255,0)');
      grd.addColorStop(0.5, `rgba(220,240,255,${a})`);
      grd.addColorStop(1, 'rgba(200,230,255,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, 1 + r() * 2, len);
      if (y + len > h) g.fillRect(x, y - h, 1 + r() * 2, len);
    }
  }, { repeat: [24, 1.2] });
  return t;
}

export function buildPad(kit) {
  const { stat, group } = kit;
  const xc = PAD.x;
  const y0 = PAD.bottom, y1 = PAD.bottom + PAD.height;
  const galv = 0xa9b1b7, pvc = 0xd8dcdf, bluePipe = 0x3a78b5;

  // pad body
  const dry = new THREE.Color(COLORS.pad), wetC = new THREE.Color(0x96652f);
  const padMat = new THREE.MeshLambertMaterial({ color: dry.clone(), map: fluteTexture() });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(PAD_T, PAD.height, Z1 - Z0), padMat);
  pad.position.set(xc, (y0 + y1) / 2, (Z0 + Z1) / 2);
  pad.castShadow = pad.receiveShadow = true;
  group.add(pad);

  // water sheen on both faces
  const sheenTex = sheenTexture();
  const sheenMat = new THREE.MeshBasicMaterial({
    map: sheenTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9fc6dc,
  });
  const sheenGeo = new THREE.PlaneGeometry(Z1 - Z0, PAD.height);
  const sheen = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(sheenGeo, sheenMat);
    m.rotation.y = s * Math.PI / 2;
    m.position.set(xc + s * (PAD_T / 2 + 0.004), (y0 + y1) / 2, (Z0 + Z1) / 2);
    sheen.add(m);
  }
  sheen.visible = false;
  group.add(sheen);

  // frame: steel channel above and below, mullions every 4 panels
  stat.box(T + 0.04, 0.06, Z1 - Z0, xc, y1 + 0.03, (Z0 + Z1) / 2, galv);
  stat.box(T, H - y1 - 0.06, Z1 - Z0, xc, (y1 + 0.06 + H) / 2, (Z0 + Z1) / 2, COLORS.wallWhite);
  for (let i = 4; i < 20; i += 4) stat.box(PAD_T + 0.03, PAD.height, 0.04, xc, (y0 + y1) / 2, Z0 + i * PANEL_W, galv);
  // distribution pipe along the top (inside face) with feeder tees
  stat.rod([xc + 0.13, y1 + 0.12, Z0], [xc + 0.13, y1 + 0.12, Z1], 0.04, pvc, 8);
  for (let z = Z0 + 0.6; z < Z1; z += 1.2) stat.rod([xc + 0.13, y1 + 0.1, z], [xc + 0.03, y1 + 0.04, z], 0.012, pvc, 5);
  // gutter (U channel) under the pad and concrete below it
  const gy = y0 - 0.08;
  stat.box(0.3, 0.02, Z1 - Z0 + 0.2, xc, gy - 0.07, (Z0 + Z1) / 2, galv);
  for (const s of [-1, 1]) stat.box(0.02, 0.15, Z1 - Z0 + 0.2, xc + s * 0.15, gy, (Z0 + Z1) / 2, galv);
  stat.box(T, gy - 0.08, zMax - zMin, xc, (gy - 0.08) / 2, 0, COLORS.wallLow);
  const gutterWater = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.02, Z1 - Z0 + 0.18),
    new THREE.MeshLambertMaterial({ color: COLORS.water }),
  );
  gutterWater.position.set(xc, gy + 0.02, (Z0 + Z1) / 2);
  gutterWater.visible = false;
  group.add(gutterWater);

  // sump tank and pump on the apron outside the south-west corner, return and riser pipes
  const sx = xMin - T - 0.62, sz = zMax + T + 0.55;
  stat.box(0.9, 0.62, 0.7, sx, 0.36, sz, 0x9fa6aa);
  stat.box(0.94, 0.05, 0.74, sx, 0.69, sz, 0x7f878c);
  stat.cyl(0.11, 0.24, sx + 0.18, 0.84, sz, 0x2f6f8f, 10);            // pump motor
  stat.cyl(0.07, 0.1, sx + 0.18, 1.01, sz, 0x24576f, 10);
  stat.rod([sx - 0.15, 0.75, sz], [sx - 0.15, y1 + 0.12, sz], 0.035, bluePipe, 8);
  stat.rod([sx - 0.15, y1 + 0.12, sz], [sx - 0.15, y1 + 0.12, Z1 + 0.05], 0.035, bluePipe, 8);
  stat.rod([sx - 0.15, y1 + 0.12, Z1 + 0.05], [xc + 0.13, y1 + 0.12, Z1 + 0.05], 0.035, bluePipe, 8);
  stat.rod([xc - 0.05, gy - 0.02, Z1 + 0.1], [sx + 0.3, 0.45, sz - 0.2], 0.045, bluePipe, 8);    // return

  let wet = 0, flow = 0;
  return {
    update(dt, env) {
      wet = smooth(wet, env.padOn ? 1 : 0, env.padOn ? 0.8 : 0.25, dt);
      padMat.color.copy(dry).lerp(wetC, wet);
      sheen.visible = wet > 0.02;
      gutterWater.visible = wet > 0.3;
      if (sheen.visible) {
        flow = (flow + dt * 0.22) % 1;
        sheenTex.offset.y = flow;
        sheenMat.opacity = 0.5 * wet;
      }
    },
  };
}
