// Evaporative cooling pad across the west end wall: cross-fluted cellulose panels, water
// distribution pipe on top, gutter at the bottom, sump tank with pump outside. When env.padOn the
// pad turns darker and a slow water sheen runs down both faces. Owner: house agent.
import * as THREE from 'three';
import { COLORS, PAD, HOUSE_BOUNDS } from './config.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng, smooth } from './house-kit.js';
import { T, H } from './house-shell.js';
import { powerOff } from './world-cond.js';

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
    const step = 32; // coarse enough that the diamonds survive mipmapping at the default zoom
    g.lineWidth = 5;
    g.strokeStyle = 'rgb(255,255,255)';
    for (let k = -h; k < w + h; k += step) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); }
    g.lineWidth = 4;
    g.strokeStyle = 'rgb(150,142,132)';
    for (let k = -h; k < w + h; k += step) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
    g.fillStyle = 'rgb(110,96,82)';
    g.fillRect(0, 0, 2, h);
    g.fillRect(w - 1, 0, 1, h);
  }, { repeat: [20, PAD.height / 0.59] });
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 16; // three clamps this to what the GPU supports; keeps the lattice at grazing angles
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
  // wet pad at most 0.75x the dry colour; a small emissive floor keeps the honeycomb warm in shade
  const dry = new THREE.Color(COLORS.pad).lerp(new THREE.Color(0xe0b071), 0.3), wetC = dry.clone().multiplyScalar(0.75);
  // the pad body: one box per pad section (PAD_SECTIONS across the end wall, the farm's pad.check
  // sections from the north side), the wet colour applied in the shader per section, so a dry stripe
  // (Phase 3, a clogged distribution pipe: env.padWorking) stays light while the rest is wet
  const padMat = new THREE.MeshLambertMaterial({ color: dry.clone(), map: fluteTexture(), emissive: dry.clone().multiplyScalar(0.08) });
  const padU = sectionMask(padMat, 'house-pad-sections', 'pad');
  const padGeo = padSections(xc, (y0 + y1) / 2);
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.castShadow = pad.receiveShadow = true;
  group.add(pad);

  // water sheen on both faces
  const sheenTex = sheenTexture();
  const sheenMat = new THREE.MeshBasicMaterial({
    map: sheenTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9fc6dc,
  });
  const sheenU = sectionMask(sheenMat, 'house-pad-sheen', 'sheen');
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

  const over = buildOverflow(group, xc, gy, sx, sz);

  let wet = 0, flow = 0;
  const dry6 = [0, 0, 0, 0, 0, 0];
  return {
    /** dry pad sections now (0 = the north side), for tests */
    dry: dry6,
    uniforms: padU, material: padMat,
    get wet() { return wet; },
    overflow: over,
    update(dt, env) {
      // Phase 4: in a power cut the pump stops: the water sheet stops at once, the pad drains and lightens
      const dark = powerOff(kit.farm, env), running = env.padOn && !dark;
      wet = smooth(wet, running ? 1 : 0, running ? 0.8 : 0.25, dt);
      // Phase 3, level only: the share of the pad with water on it (env.padWorking): the sections the
      // farm's pad.check calls dry are the first ones from the north side
      const level = kit.farm && kit.farm.mode === 'level';
      const working = level ? Math.max(0, Math.min(1, env.padWorking)) : 1;
      const dryN = Math.round((1 - working) * PAD_SECTIONS);
      for (let k = 0; k < PAD_SECTIONS; k++) dry6[k] = padU.uDry.value[k] = sheenU.uDry.value[k] = k < dryN ? 1 : 0;
      // the colour stays the dry one: the shader darkens the wet sections (wetness x 0.75, as Phase 1's
      // colour lerp; the small emissive floor follows the same factor)
      padU.uWet.value = wet;
      sheen.visible = !dark && wet > 0.02 && dryN < PAD_SECTIONS;
      gutterWater.visible = wet > 0.3 || (level && !!kit.farm.house?.padFloatStuck);
      if (sheen.visible) {
        flow = (flow + dt * 0.22) % 1;
        sheenTex.offset.y = flow;
        sheenMat.opacity = 0.5 * wet;
      }
      over.update(dt, level && !!kit.farm.house?.padFloatStuck);
    },
  };
}

const PAD_SECTIONS = 6;

// Six boxes side by side across the end wall, each vertex tagged with its section (aSec); the flute
// texture keeps one tile per 0.59 m panel, as the single Phase 1 box had.
function padSections(xc, yc) {
  const geos = [], w = (Z1 - Z0) / PAD_SECTIONS;
  for (let k = 0; k < PAD_SECTIONS; k++) {
    const g = new THREE.BoxGeometry(PAD_T, PAD.height, w);
    // uv: the Phase 1 box spread u 0..1 over the full width on the two big faces; keep that
    const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(nrm.getX(i)) > 0.5) {
        const zf = (k * w + (pos.getZ(i) + w / 2)) / (Z1 - Z0);
        uv.setX(i, nrm.getX(i) > 0 ? 1 - zf : zf);
      }
    }
    g.translate(xc, yc, Z0 + (k + 0.5) * w);
    g.setAttribute('aSec', new THREE.Float32BufferAttribute(new Array(pos.count).fill(k), 1));
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// Per-section dryness for the pad body (aSec attribute) and the water sheen (from world z).
function sectionMask(material, key, mode) {
  const u = { uDry: { value: [0, 0, 0, 0, 0, 0] }, uWet: { value: 0 } };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    const decl = `uniform float uDry[${PAD_SECTIONS}]; uniform float uWet; varying float vDry;`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
${decl}
${mode === 'pad' ? 'attribute float aSec;' : ''}`).replace('#include <begin_vertex>', `#include <begin_vertex>
  ${mode === 'pad' ? 'int si = int(aSec + 0.5);' : `float zw = (modelMatrix * vec4(transformed, 1.0)).z;
  int si = int(clamp(floor((zw - (${Z0.toFixed(4)})) / ${((Z1 - Z0) / PAD_SECTIONS).toFixed(5)}), 0.0, ${PAD_SECTIONS - 1}.0));`}
  vDry = 0.0;
  for (int k = 0; k < ${PAD_SECTIONS}; k++) if (k == si) vDry = uDry[k];`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
${decl}`);
    if (mode === 'pad') {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n  float wetK = mix(1.0, 0.75, uWet * (1.0 - vDry)) * (1.0 + 0.12 * uWet * vDry);\n  diffuseColor.rgb *= wetK;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= wetK;');
    } else {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.a *= 1.0 - vDry;');
    }
  };
  material.customProgramCacheKey = () => key;
  return u;
}

// The float valve stuck (Phase 3 pad-overflow): the gutter runs over inside, a sheet of water on the
// litter along the pad, drips off the gutter lip; outside the sump overflows into a puddle.
function buildOverflow(group, xc, gy, sx, sz) {
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x6f9fb6, transparent: true, opacity: 0, depthWrite: false });
  const sheetGeo = new THREE.PlaneGeometry(1.6, Z1 - Z0 - 0.2, 4, 12);
  sheetGeo.rotateX(-Math.PI / 2);
  const p = sheetGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setX(i, x + 0.12 * Math.sin(z * 2.1) * (x + 0.8) / 1.6); }
  const sheet = new THREE.Mesh(sheetGeo, waterMat);
  sheet.position.set(xc + 0.95, 0.045, (Z0 + Z1) / 2);
  sheet.renderOrder = 2;
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.95, 14).rotateX(-Math.PI / 2), waterMat);
  puddle.position.set(sx + 0.1, 0.03, sz + 0.35);
  puddle.scale.set(1.3, 1, 0.8);
  const g = new THREE.Group();
  g.add(sheet, puddle);
  g.visible = false;
  group.add(g);
  let k = 0, t = 0;
  return {
    get on() { return g.visible; },
    update(dt, on) {
      k = smooth(k, on ? 1 : 0, on ? 0.6 : 1.5, dt);
      g.visible = k > 0.02;
      if (!g.visible) return;
      t += dt;
      waterMat.opacity = k * (0.42 + 0.06 * Math.sin(t * 2.3));
    },
  };
}
