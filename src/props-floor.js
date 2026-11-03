// Level 1 floor states painted into the house floor shader: bare concrete <-> rice husk from
// farm.litter.coverGrid, wet cells darker from moistureGrid (> 30 % damp, > 38 % wet sheen, caked
// darker and lumpy), and the floor thermometer overlay (unlock floorOverlay, key F).
// Owner: package "props".
//
// The state lives in a 96 x 24 RGBA DataTexture (2 x 2 texels per FLOOR_GRID cell): r cover,
// g moisture (0..100 % -> 0..255), b caked. It is rewritten at most twice a second and only when
// the grids changed. In the sandbox (farm.mode 'off') uLevel = 0 and the shader leaves the
// Phase 1 litter exactly as it was.
import * as THREE from 'three';
import { FLOOR_GRID, BROOD_BOUNDS, HOUSE_BOUNDS } from './config.js';
import { dataTexture, clamp01 } from './props-kit.js';

const NX = FLOOR_GRID.nx, NZ = FLOOR_GRID.nz;
const TW = NX * 2, TH = NZ * 2;

const NOISE = /* glsl */`
float pfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = pfHash(i), b = pfHash(i + vec2(1.0, 0.0)), c = pfHash(i + vec2(0.0, 1.0)), d = pfHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`;

// Patch the house floor material (Lambert, husk map, vertex colours) once, before it compiles.
function patchFloor(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 colorDry;\nvarying vec3 vColorDry;\nvarying vec2 vFloorXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vColorDry = colorDry;\n  vFloorXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uLevel; uniform sampler2D uFloorState; uniform vec4 uFloorRect;
varying vec3 vColorDry; varying vec2 vFloorXZ;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  if (uLevel > 0.5) {
    vec2 xz = vFloorXZ;
    vec4 st = texture2D(uFloorState, (xz - uFloorRect.xy) / uFloorRect.zw);
    float n1 = pfNoise(xz * 1.3) * 0.6 + pfNoise(xz * 4.7 + 17.0) * 0.4;
    float n2 = pfNoise(xz * 9.0 + 3.0);
    vec4 tex = texture2D(map, vMapUv);
    // rice husk: the Phase 1 litter without the baked damp lines under the drinkers
    vec3 husk = diffuse * tex.rgb * vColorDry;
    // bare concrete: grey, slightly mottled, with saw-cut joints every 4 m and along the centre
    float mott = 0.9 + 0.12 * pfNoise(xz * 0.7) + 0.06 * (tex.r - 0.85);
    vec3 conc = vec3(0.50, 0.49, 0.46) * mott;
    vec2 jd = abs(fract((xz + vec2(0.0, 0.0)) / vec2(4.0, 6.0) + 0.5) - 0.5) * vec2(4.0, 6.0);
    conc *= 1.0 - 0.28 * (1.0 - smoothstep(0.012, 0.03, min(jd.x, jd.y)));
    // cover: husk where the swath reached; a ragged edge from noise, never a 1 m grid
    float e0 = 0.06 + n1 * 0.78;
    float husked = smoothstep(e0, e0 + 0.12, st.r);
    // a thin, patchy layer at the swath edge shows the concrete through it
    vec3 thin = mix(conc, husk, 0.55 + 0.45 * n2);
    vec3 col = mix(conc, mix(thin, husk, smoothstep(e0 + 0.06, e0 + 0.3, st.r)), husked);
    // moisture (percent) with a soft noisy edge
    float m = st.g * 100.0 + (n1 - 0.5) * 6.0;
    float damp = smoothstep(29.0, 34.0, m);
    float wet = smoothstep(37.0, 42.0, m);
    vec3 dampHusk = husk * vec3(0.74, 0.66, 0.55);
    vec3 wetHusk = husk * vec3(0.5, 0.43, 0.34);
    vec3 litterWet = mix(mix(col, dampHusk, damp * husked), wetHusk, wet * husked);
    // standing water on bare concrete reads darker grey
    vec3 concWet = conc * mix(1.0, 0.62, smoothstep(30.0, 50.0, m));
    col = mix(concWet, litterWet, husked);
    // wet sheen: small light glints on the soaked litter
    float glint = step(0.9, pfHash(floor(xz * 22.0))) * wet * husked;
    col += vec3(0.16, 0.15, 0.13) * glint;
    // caked: darker crust in lumps
    float lump = smoothstep(0.42, 0.62, pfNoise(xz * 6.0 + 9.0)) * 0.6 + smoothstep(0.55, 0.8, n2) * 0.4;
    col = mix(col, col * mix(0.72, 0.42, lump), st.b * husked);
    diffuseColor.rgb = col;
  }`);
  };
  material.customProgramCacheKey = () => 'house-floor-level';
}

// Blue (cool) -> orange (warm), continuous, no good / bad colours.
const RAMP = [[24, [0.18, 0.37, 0.82]], [27, [0.42, 0.66, 0.92]], [30, [0.93, 0.9, 0.8]], [33, [0.96, 0.69, 0.4]], [36, [0.91, 0.44, 0.12]]];
export function tempColor(t, out) {
  if (t <= RAMP[0][0]) { out[0] = RAMP[0][1][0]; out[1] = RAMP[0][1][1]; out[2] = RAMP[0][1][2]; return out; }
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, a] = RAMP[i - 1], [t1, b] = RAMP[i], k = (t - t0) / (t1 - t0);
      for (let j = 0; j < 3; j++) out[j] = a[j] + (b[j] - a[j]) * k;
      return out;
    }
  }
  const c = RAMP[RAMP.length - 1][1];
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return out;
}

export function buildFloorStates(ctx, house, group) {
  const tex = dataTexture(TW, TH);
  const uniforms = {
    uLevel: { value: 0 },
    uFloorState: { value: tex },
    uFloorRect: { value: new THREE.Vector4(FLOOR_GRID.x0, FLOOR_GRID.z0, NX * FLOOR_GRID.cell, NZ * FLOOR_GRID.cell) },
  };
  if (house && house.floor) patchFloor(house.floor.material, uniforms);

  // floor thermometer view: a plane 3 cm over the brooding floor
  const OW = 96, OH = 24;
  const otex = dataTexture(OW, OH);
  const b = BROOD_BOUNDS;
  const ow = b.xMax - b.xMin, oh = b.zMax - b.zMin;
  const og = new THREE.PlaneGeometry(ow, oh);
  og.rotateX(-Math.PI / 2);
  const omat = new THREE.MeshBasicMaterial({ map: otex, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false });
  const overlay = new THREE.Mesh(og, omat);
  overlay.position.set((b.xMin + b.xMax) / 2, 0.05, (b.zMin + b.zMax) / 2);
  overlay.renderOrder = 3;
  overlay.visible = false;
  overlay.name = 'floor-thermometer';
  group.add(overlay);

  const last = { cover: new Float32Array(NX * NZ).fill(-1), moist: new Float32Array(NX * NZ).fill(-1), caked: new Uint8Array(NX * NZ), level: -1 };
  let timer = 0, overlayTimer = 0;
  const rgb = [0, 0, 0];

  function writeState(farm, force) {
    const L = farm.litter || {};
    const cover = L.coverGrid, moist = L.moistureGrid, caked = L.cakedGrid || L.caked;
    if (!cover || !moist) return false;
    let changed = force;
    for (let i = 0; i < NX * NZ && !changed; i++) {
      if (Math.abs(cover[i] - last.cover[i]) > 0.004 || Math.abs(moist[i] - last.moist[i]) > 0.2) changed = true;
      const ck = caked ? (caked[i] ? 1 : 0) : 0;
      if (ck !== last.caked[i]) changed = true;
    }
    if (!changed) return false;
    const d = tex.image.data;
    for (let cz = 0; cz < NZ; cz++) {
      for (let cx = 0; cx < NX; cx++) {
        const i = cz * NX + cx;
        last.cover[i] = cover[i]; last.moist[i] = moist[i];
        // caked: the farm's flag when it has one, else what 6 h above 40 % leaves (>= 45 %)
        const ck = caked ? (caked[i] ? 1 : 0) : (moist[i] >= 45 ? 1 : 0);
        last.caked[i] = caked ? ck : 0;
        const r = Math.round(clamp01(cover[i]) * 255), g = Math.round(clamp01(moist[i] / 100) * 255), bb = ck * 255;
        for (let k = 0; k < 4; k++) {
          const tx = cx * 2 + (k & 1), tz = cz * 2 + (k >> 1), o = (tz * TW + tx) * 4;
          d[o] = r; d[o + 1] = g; d[o + 2] = bb; d[o + 3] = 255;
        }
      }
    }
    tex.needsUpdate = true;
    return true;
  }

  function writeOverlay(farm) {
    const d = otex.image.data;
    for (let j = 0; j < OH; j++) {
      const z = b.zMin + ((j + 0.5) / OH) * oh;
      for (let i = 0; i < OW; i++) {
        const x = b.xMin + ((i + 0.5) / OW) * ow;
        const t = farm.floorTempAt ? farm.floorTempAt(x, z) : 28;
        tempColor(Number.isFinite(t) ? t : 28, rgb);
        const o = (j * OW + i) * 4;
        d[o] = rgb[0] * 255; d[o + 1] = rgb[1] * 255; d[o + 2] = rgb[2] * 255; d[o + 3] = 255;
      }
    }
    otex.needsUpdate = true;
  }

  return {
    overlay,
    /** Read the farm grids (at most 2x a second unless forced). */
    update(dt, farm, level, overlayOn) {
      const lv = level ? 1 : 0;
      if (lv !== last.level) { uniforms.uLevel.value = lv; last.level = lv; timer = 0; }
      if (level) {
        timer -= dt;
        if (timer <= 0) { timer = 0.5; writeState(farm, false); }
      }
      overlay.visible = !!(level && overlayOn);
      if (overlay.visible) {
        overlayTimer -= dt;
        if (overlayTimer <= 0) { overlayTimer = 0.5; writeOverlay(farm); }
      }
    },
    refresh(farm) { if (farm) writeState(farm, true); timer = 0.5; overlayTimer = 0; },
    bounds: HOUSE_BOUNDS,
  };
}
