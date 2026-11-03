// Level floor states painted into the house floor shader: bare concrete <-> rice husk from
// farm.litter.coverGrid, wet cells darker from moistureGrid (> 30 % damp, > 38 % wet sheen, caked darker
// and lumpy); Phase 3 (PHASE3.md §12 item 9): sparse droppings on the litter by type (bloody spots in the
// coccidiosis zone), feathers on the litter of the caught sections, and the clean-out from farm.clean:
// washed concrete dark and wet with a sheen, drying lighter, disinfected a faint blue-white. The floor
// views (thermometer, moisture, light map, brooder zones) are props-overlay.js. Owner: package "props".
//
// Two 96 x 24 RGBA DataTextures (2 x 2 texels per FLOOR_GRID cell, the litter grid's cell order cz * nx +
// cx): state r cover, g moisture (0..100 % -> 0..255), b caked; clean r wash, g wet, b spray, a bloody
// droppings. Rewritten at most twice a second and only when the grids changed. In the sandbox (farm.mode
// 'off') uLevel = 0 and the shader leaves the Phase 1 litter exactly as it was; in the brooding week every
// Phase 3 term is 0 (no droppings until the litter has aged, nothing caught, nothing washed).
import * as THREE from 'three';
import { FLOOR_GRID, HOUSE_BOUNDS, HARVEST, CYCLE, FLOOR_TEMP_RAMP } from './config.js';
import { dataTexture, clamp01 } from './props-kit.js';
import { buildOverlay, rampColor } from './props-overlay.js';

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
uniform float uLevel; uniform sampler2D uFloorState; uniform sampler2D uFloorClean; uniform vec4 uFloorRect;
uniform float uDrop; uniform vec3 uDropCol; uniform float uFeather[${HARVEST.sections}];
varying vec3 vColorDry; varying vec2 vFloorXZ;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  if (uLevel > 0.5) {
    vec2 xz = vFloorXZ;
    vec2 fuv = (xz - uFloorRect.xy) / uFloorRect.zw;
    vec4 st = texture2D(uFloorState, fuv);
    vec4 cl = texture2D(uFloorClean, fuv);
    float n1 = pfNoise(xz * 1.3) * 0.6 + pfNoise(xz * 4.7 + 17.0) * 0.4;
    float n2 = pfNoise(xz * 9.0 + 3.0);
    vec4 tex = texture2D(map, vMapUv);
    // rice husk: the Phase 1 litter without the baked damp lines under the drinkers
    vec3 husk = diffuse * tex.rgb * vColorDry;
    // bare concrete: grey, slightly mottled, with saw-cut joints every 4 m and along the centre
    float mott = 0.9 + 0.1 * pfNoise(xz * 0.7) + 0.05 * pfNoise(xz * 3.1 + 5.0);
    vec3 conc = vec3(0.50, 0.49, 0.46) * mott;
    vec2 jd = abs(fract((xz + vec2(0.0, 0.0)) / vec2(4.0, 6.0) + 0.5) - 0.5) * vec2(4.0, 6.0);
    conc *= 1.0 - 0.28 * (1.0 - smoothstep(0.012, 0.03, min(jd.x, jd.y)));
    // clean-out: washed concrete is cleaner and lighter; disinfected a faint blue-white
    conc = mix(conc, conc * vec3(1.1, 1.11, 1.12) + vec3(0.02), cl.r);
    conc = mix(conc, mix(conc, vec3(0.64, 0.7, 0.76) * mott, 0.45) + vec3(0.01, 0.015, 0.03), cl.b);
    // cover: husk where the swath reached; a ragged edge from noise, never a 1 m grid
    float e0 = 0.06 + n1 * 0.78;
    float husked = smoothstep(e0, e0 + 0.12, st.r);
    // droppings on the litter (Phase 3): sparse spots that grow with the flock; bloody ones in the cocci zone
    vec2 dc = floor(xz * 7.0), df = fract(xz * 7.0) - 0.5;
    float dh = pfHash(dc);
    float dr = length(df * vec2(1.0, 1.4));
    float dspot = step(1.0 - uDrop * 0.12, dh) * (1.0 - smoothstep(0.1, 0.24, dr));
    vec3 dcol = mix(uDropCol, vec3(0.55, 0.1, 0.07), step(0.5, cl.a) * step(0.5, pfHash(dc + 7.0)));
    // the white urate cap of a normal dropping
    dcol = mix(dcol, vec3(0.86, 0.85, 0.8), (1.0 - smoothstep(0.03, 0.08, length(df - vec2(0.04, -0.03)))) * step(0.5, pfHash(dc + 3.0)));
    husk = mix(husk, dcol, dspot * 0.8);
    // feathers on the litter of the sections the crew has caught (Phase 3)
    float sx = clamp(floor((xz.x - uFloorRect.x) / (uFloorRect.z / ${HARVEST.sections.toFixed(1)})), 0.0, ${(HARVEST.sections - 1).toFixed(1)});
    float fk = 0.0;
    for (int k = 0; k < ${HARVEST.sections}; k++) if (float(k) == sx) fk = uFeather[k];
    float fe = step(0.93, pfHash(floor(xz * 11.0) + 21.0)) * (1.0 - smoothstep(0.08, 0.22, abs(fract(xz.x * 11.0) - 0.5 + 0.6 * (fract(xz.y * 11.0) - 0.5))));
    husk = mix(husk, vec3(0.97, 0.96, 0.93), fe * fk);
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
    // standing water on bare concrete reads darker grey; the washer's water darker still, drying lighter
    float washWet = cl.g * (1.0 - husked);
    vec3 concWet = conc * mix(1.0, 0.62, smoothstep(30.0, 50.0, m)) * mix(1.0, 0.58, washWet);
    col = mix(concWet, litterWet, husked);
    // wet sheen: small light glints on the soaked litter and on the wet concrete
    float glint = step(0.9, pfHash(floor(xz * 22.0))) * (wet * husked + washWet * 0.8);
    col += vec3(0.16, 0.15, 0.13) * glint;
    col += vec3(0.05, 0.06, 0.07) * washWet * smoothstep(0.55, 0.95, pfNoise(xz * 2.3 + 11.0));
    // caked: darker crust in lumps
    float lump = smoothstep(0.42, 0.62, pfNoise(xz * 6.0 + 9.0)) * 0.6 + smoothstep(0.55, 0.8, n2) * 0.4;
    col = mix(col, col * mix(0.72, 0.42, lump), st.b * husked);
    diffuseColor.rgb = col;
  }`);
  };
  material.customProgramCacheKey = () => 'house-floor-level-3';
}

/** Blue (cool) -> orange (warm), continuous (config FLOOR_TEMP_RAMP; the ui legend uses it too). */
export const tempColor = (t, out) => rampColor(FLOOR_TEMP_RAMP, t, out);

// Droppings colour by the flock's main droppings look (farm.cyc.droppings in the sim; general looks).
const DROP = { normal: [0.5, 0.41, 0.28], watery: [0.42, 0.36, 0.25], undigested: [0.66, 0.56, 0.34], bloody: [0.5, 0.33, 0.22], white: [0.88, 0.87, 0.82] };

export function buildFloorStates(ctx, house, group) {
  const tex = dataTexture(TW, TH), ctex = dataTexture(TW, TH);
  const uniforms = {
    uLevel: { value: 0 },
    uFloorState: { value: tex },
    uFloorClean: { value: ctex },
    uFloorRect: { value: new THREE.Vector4(FLOOR_GRID.x0, FLOOR_GRID.z0, NX * FLOOR_GRID.cell, NZ * FLOOR_GRID.cell) },
    uDrop: { value: 0 },
    uDropCol: { value: new THREE.Color().setRGB(...DROP.normal, THREE.SRGBColorSpace) },
    uFeather: { value: new Array(HARVEST.sections).fill(0) },
  };
  if (house && house.floor) patchFloor(house.floor.material, uniforms);
  const overlay = buildOverlay(group);

  const N = NX * NZ;
  const last = { cover: new Float32Array(N).fill(-1), moist: new Float32Array(N).fill(-1), caked: new Uint8Array(N), level: -1, clean: new Float32Array(N * 4).fill(-1) };
  let timer = 0, dropKey = '';

  function put(t, i, r, g, b, a) {
    const d = t.image.data, cx = i % NX, cz = (i / NX) | 0;
    for (let k = 0; k < 4; k++) {
      const o = ((cz * 2 + (k >> 1)) * TW + cx * 2 + (k & 1)) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
    }
  }

  function writeState(farm, force) {
    const L = farm.litter || {};
    const cover = L.coverGrid, moist = L.moistureGrid, caked = L.cakedGrid || L.caked;
    if (!cover || !moist) return false;
    let changed = force;
    for (let i = 0; i < N && !changed; i++) {
      if (Math.abs(cover[i] - last.cover[i]) > 0.004 || Math.abs(moist[i] - last.moist[i]) > 0.2) changed = true;
      const ck = caked ? (caked[i] ? 1 : 0) : 0;
      if (ck !== last.caked[i]) changed = true;
    }
    if (!changed) return false;
    for (let i = 0; i < N; i++) {
      last.cover[i] = cover[i]; last.moist[i] = moist[i];
      // caked: the farm's flag when it has one, else what 6 h above 40 % leaves (>= 45 %)
      const ck = caked ? (caked[i] ? 1 : 0) : (moist[i] >= 45 ? 1 : 0);
      last.caked[i] = caked ? ck : 0;
      put(tex, i, Math.round(clamp01(cover[i]) * 255), Math.round(clamp01(moist[i] / 100) * 255), ck * 255, 255);
    }
    tex.needsUpdate = true;
    return true;
  }

  // the clean-out grids and the bloody droppings zone (the wettest 6 m strip while coccidiosis shows)
  function writeClean(farm, force) {
    const C = farm.clean || {}, wash = C.wash, wet = C.wet, spray = C.spray;
    const moist = farm.litter?.moistureGrid;
    let bloodyStrip = -1;
    const look = farm.cyc?.droppings ?? (farm.health?.disease?.cocci > 0.3 ? 'bloody' : null);
    if (look === 'bloody' && moist) {
      let best = -1, bm = -1;
      for (let s = 0; s < 8; s++) {
        let sum = 0, n = 0;
        for (let i = 0; i < N; i++) if (Math.floor((i % NX) / 6) === s) { sum += moist[i]; n++; }
        if (n && sum / n > bm) { bm = sum / n; best = s; }
      }
      bloodyStrip = best;
    }
    let changed = force;
    for (let i = 0; i < N && !changed; i++) {
      const o = i * 4, b = Math.floor((i % NX) / 6) === bloodyStrip ? 1 : 0;
      if (Math.abs((wash ? wash[i] : 0) - last.clean[o]) > 0.01 || Math.abs((wet ? wet[i] : 0) - last.clean[o + 1]) > 0.01 ||
        Math.abs((spray ? spray[i] : 0) - last.clean[o + 2]) > 0.01 || b !== last.clean[o + 3]) changed = true;
    }
    if (!changed) return false;
    for (let i = 0; i < N; i++) {
      const o = i * 4, b = Math.floor((i % NX) / 6) === bloodyStrip ? 1 : 0;
      const w = wash ? clamp01(wash[i]) : 0, wt = wet ? clamp01(wet[i]) : 0, sp = spray ? clamp01(spray[i]) : 0;
      last.clean[o] = w; last.clean[o + 1] = wt; last.clean[o + 2] = sp; last.clean[o + 3] = b;
      put(ctex, i, Math.round(w * 255), Math.round(wt * 255), Math.round(sp * 255), b * 255);
    }
    ctex.needsUpdate = true;
    return true;
  }

  // droppings density by the age of the litter under the flock, colour by the droppings look; feathers
  // on the litter of the sections the crew has caught
  function writeUniforms(farm, env) {
    const day = env?.dayNumber ?? 0, age = Math.max(0, farm.age ?? 0);
    const birds = (farm.flock?.placed ?? 0) > 0;
    uniforms.uDrop.value = birds && day <= CYCLE.harvestDay + 1 ? Math.min(1, Math.max(0, (age - 6) / 30)) : day > CYCLE.harvestDay ? Math.min(1, 0.85) : 0;
    const look = farm.cyc?.droppings || 'normal';
    if (look !== dropKey) { dropKey = look; uniforms.uDropCol.value.setRGB(...(DROP[look] || DROP.normal), THREE.SRGBColorSpace); }
    const secs = farm.harvest?.sections;
    for (let k = 0; k < HARVEST.sections; k++) uniforms.uFeather.value[k] = secs && secs[k] && secs[k].state === 'done' ? 1 : 0;
  }

  return {
    overlay: overlay.mesh,
    /** Read the farm grids (at most 2x a second unless forced); `view` = the floor view on (or null). */
    update(dt, farm, level, view, env) {
      const lv = level ? 1 : 0;
      if (lv !== last.level) { uniforms.uLevel.value = lv; last.level = lv; timer = 0; }
      if (level) {
        timer -= dt;
        if (timer <= 0) { timer = 0.5; writeState(farm, false); writeClean(farm, false); writeUniforms(farm, env); }
      }
      overlay.update(dt, farm, env, level, view);
    },
    refresh(farm) { if (farm) { writeState(farm, true); writeClean(farm, true); } timer = 0.5; overlay.refresh(); },
    bounds: HOUSE_BOUNDS,
    uniforms,
    rampColor,
  };
}
