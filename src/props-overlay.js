// Floor views (one at a time, props.setOverlay): the floor thermometer (Phase 2, unlock floorOverlay, F),
// litter moisture (unlock moistureOverlay, M: config MOISTURE_RAMP over the floor in use), the light map
// (unlock luxMap: lux at bird level under and between the lamps) and the brooder heat zones (unlock
// brooderZones: the warmth each burning brooder adds at the litter, °C). Continuous ramps, no good / bad
// colours; the run package draws the legends from the same config ramps. Owner: package "scene".
//
// One plane 3 cm over the bird floor (BIRD_BOUNDS), a 192 x 48 RGBA texture written at most twice a
// second while a view is on; texels the birds cannot use now (east of the brooding curtain while it is
// down) are left clear.
import * as THREE from 'three';
import { BIRD_BOUNDS, BROOD_BOUNDS, FLOOR_TEMP_RAMP, MOISTURE_RAMP, FLOOR_GRID, HOUSE_BOUNDS } from './config.js';
import { dataTexture } from './props-kit.js';

export const OVERLAYS = ['floorTemp', 'moisture', 'lux', 'brooderZones'];
// light map (lux, sRGB): dark blue-grey at 0 to warm white at 60 (EQUIP.luxMax)
export const LUX_RAMP = [[0, [0.16, 0.18, 0.28]], [10, [0.36, 0.38, 0.56]], [20, [0.7, 0.68, 0.62]], [40, [0.98, 0.9, 0.62]], [60, [1.0, 0.98, 0.86]]];
// brooder heat zones (°C the brooders add at the litter): clear at 0, then yellow to deep orange
export const BROODER_RAMP = [[0.3, [0.98, 0.9, 0.55]], [2, [0.98, 0.78, 0.36]], [4, [0.94, 0.56, 0.2]], [7, [0.82, 0.3, 0.1]]];
const BULB_X = []; for (let x = HOUSE_BOUNDS.xMin + 2; x < HOUSE_BOUNDS.xMax; x += 4) BULB_X.push(x);
const BULB_Z = [-1.0, 1.0];

export function rampColor(ramp, t, out) {
  if (t <= ramp[0][0]) { const c = ramp[0][1]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return out; }
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i][0]) {
      const [t0, a] = ramp[i - 1], [t1, b] = ramp[i], k = (t - t0) / (t1 - t0);
      for (let j = 0; j < 3; j++) out[j] = a[j] + (b[j] - a[j]) * k;
      return out;
    }
  }
  const c = ramp[ramp.length - 1][1];
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return out;
}

/** Lux at bird height at (x, z): the farm's level, brighter under the lamps, dimmer between them. */
export function luxPattern(base, x, z) {
  let d2 = 1e9;
  for (const bz of BULB_Z) for (const bx of BULB_X) { const d = (x - bx) ** 2 + (z - bz) ** 2; if (d < d2) d2 = d; }
  const wall = Math.min(z - HOUSE_BOUNDS.zMin, HOUSE_BOUNDS.zMax - z);
  return base * (0.72 + 0.45 * Math.exp(-d2 / (2 * 1.7 * 1.7))) * (wall < 1.2 ? 0.85 + 0.125 * wall : 1);
}

export function buildOverlay(group) {
  const OW = 192, OH = 48, b = BIRD_BOUNDS;
  const tex = dataTexture(OW, OH);
  tex.colorSpace = THREE.SRGBColorSpace;   // the ramps are sRGB colours
  const ow = b.xMax - b.xMin, oh = b.zMax - b.zMin;
  const geo = new THREE.PlaneGeometry(ow, oh);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((b.xMin + b.xMax) / 2, 0.05, (b.zMin + b.zMax) / 2);
  mesh.renderOrder = 3;
  mesh.visible = false;
  mesh.name = 'floor-overlay';
  group.add(mesh);
  const rgb = [0, 0, 0];
  let timer = 0, shown = null;

  function write(name, farm, env) {
    const d = tex.image.data;
    const curtain = env ? env.broodCurtain !== false : true;
    const L = farm.litter || {}, moist = L.moistureGrid, cover = L.coverGrid;
    const base = name === 'lux' ? (typeof farm.luxAt === 'function' ? farm.luxAt(0, 0) : 60 * (env?.lightLevel ?? 1)) : 0;
    for (let j = 0; j < OH; j++) {
      const z = b.zMin + ((j + 0.5) / OH) * oh;
      for (let i = 0; i < OW; i++) {
        const x = b.xMin + ((i + 0.5) / OW) * ow, o = (j * OW + i) * 4;
        // floor the birds use now (the thermometer view is Phase 2's brooding floor while the curtain is down)
        const used = !curtain || x <= BROOD_BOUNDS.xMax;
        let a = used ? 255 : 0;
        if (name === 'floorTemp') {
          const t = farm.floorTempAt ? farm.floorTempAt(x, z) : 28;
          rampColor(FLOOR_TEMP_RAMP, Number.isFinite(t) ? t : 28, rgb);
        } else if (name === 'moisture') {
          const cx = Math.floor((x - FLOOR_GRID.x0) / FLOOR_GRID.cell), cz = Math.floor((z - FLOOR_GRID.z0) / FLOOR_GRID.cell);
          const c = cz * FLOOR_GRID.nx + cx;
          const m = moist ? moist[c] : 25;
          rampColor(MOISTURE_RAMP, Number.isFinite(m) ? m : 25, rgb);
          if (cover && cover[c] < 0.3) a = Math.round(a * 0.35);   // bare concrete: the reading means little
        } else if (name === 'lux') {
          rampColor(LUX_RAMP, luxPattern(base, x, z), rgb);
        } else {
          const h = env && typeof env.brooderHeat === 'function' ? env.brooderHeat(x, z) : 0;
          rampColor(BROODER_RAMP, h, rgb);
          a = used ? Math.round(255 * Math.min(1, Math.max(0, (h - 0.2) / 1.2))) : 0;
          // contour lines every 2 °C
          const f = (h / 2) % 1;
          if (h > 1 && (f < 0.06 || f > 0.94)) { rgb[0] *= 0.6; rgb[1] *= 0.5; rgb[2] *= 0.45; }
        }
        d[o] = rgb[0] * 255; d[o + 1] = rgb[1] * 255; d[o + 2] = rgb[2] * 255; d[o + 3] = a;
      }
    }
    tex.needsUpdate = true;
  }

  return {
    mesh,
    get shown() { return shown; },
    update(dt, farm, env, level, name) {
      const on = !!(level && name);
      mesh.visible = on;
      if (!on) { shown = null; return; }
      if (name !== shown) { shown = name; timer = 0; }
      if ((timer -= dt) <= 0) { timer = 0.5; write(name, farm, env); }
    },
    refresh() { timer = 0; },
  };
}
