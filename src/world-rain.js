// Phase 4 (PHASE4.md §8.1): rain and storms over the farm. Owner: package "scene" (world).
//   streaks    up to RAIN_MAX instanced streaks in a box that follows the camera (one draw call). The streaks are
//              anchored in the world and wrap inside the box, so walking does not drag the rain along; none fall
//              inside the house under its roof line (the roof is cut away for the camera, the rain is not).
//   puddles    flat pools on the farm road, the door path, the turning area and the house apron (one draw call),
//              filling while it rains and drying slowly after
//   lightning  a flash about every 40 s of real time while a storm lasts (none under prefers-reduced-motion);
//              flash() forces one (the harness's lightning frame)
// Nothing is drawn while farm.weatherNow.rain is 0 (and never in the sandbox).
import * as THREE from 'three';
import { HOUSE_BOUNDS, FARM } from './config.js';
import { ROAD_SAMPLES } from './world-layout.js';
import { rng } from './world-util.js';
import { reducedMotion } from './world-cond.js';

export const RAIN_MAX = 3000;
const BOX = new THREE.Vector3(44, 18, 44);

const rainVert = /* glsl */`
attribute vec4 aOff;
uniform vec3 uCenter; uniform vec3 uSize; uniform vec3 uCam; uniform vec4 uHouse; uniform vec2 uWind;
uniform float uTime; uniform float uLen; uniform float uWidth; uniform float uInside;
varying float vA;
void main() {
  vec3 base = uCenter - uSize * 0.5;
  base.y = 0.0;
  vec3 o = aOff.xyz * uSize;
  float sp = 9.0 * (0.8 + 0.4 * aOff.w);
  o.y -= uTime * sp;
  o.xz += uWind * uTime * sp * 0.12;
  vec3 p = base + mod(o - base, uSize);
  vec3 dir = normalize(vec3(uWind.x * 0.12, -1.0, uWind.y * 0.12));
  vec3 toCam = uCam - p; toCam.y = 0.0;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4))));
  vec3 w = p + right * position.x * uWidth + dir * (position.y - 0.5) * uLen * (0.8 + 0.4 * aOff.w);
  // under the house roof (cut away for the camera) no rain falls
  // (with the farmer inside, the roof and the walls are cut away for the camera: no streak over the house at any height)
  bool inHouse = p.x > uHouse.x && p.x < uHouse.y && p.z > uHouse.z && p.z < uHouse.w && (p.y < 4.3 || uInside > 0.5);
  // review round: with the farmer inside, a streak in the yard between the camera and the house that the eye sees over
  // the litter is culled too: the ray from the camera through it meets the floor (y = 0) inside the house footprint
  if (uInside > 0.5 && p.y < uCam.y - 0.05) {
    float t = uCam.y / (uCam.y - p.y);
    vec2 hit = uCam.xz + (p.xz - uCam.xz) * t;
    if (hit.x > uHouse.x && hit.x < uHouse.y && hit.y > uHouse.z && hit.y < uHouse.w) inHouse = true;
  }
  // thin out the streaks right in front of the lens
  float dc = length(uCam - p);
  vA = (0.25 + 0.75 * position.y) * smoothstep(1.5, 5.0, dc);
  if (inHouse || p.y < 0.02) w = vec3(0.0, -500.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const rainFrag = /* glsl */`
uniform vec3 uColor; uniform float uAlpha;
varying float vA;
void main() {
  gl_FragColor = vec4(uColor, uAlpha * vA);
  #include <colorspace_fragment>
}`;

function streaks() {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute('position', quad.attributes.position);
  const r = rng(404), off = new Float32Array(RAIN_MAX * 4);
  for (let i = 0; i < RAIN_MAX * 4; i++) off[i] = r();
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  g.instanceCount = 0;
  const H = HOUSE_BOUNDS;
  const uniforms = {
    uCenter: { value: new THREE.Vector3() }, uSize: { value: BOX.clone() }, uCam: { value: new THREE.Vector3() },
    uHouse: { value: new THREE.Vector4(H.xMin - 0.3, H.xMax + 0.3, H.zMin - 0.3, H.zMax + 0.3) }, uWind: { value: new THREE.Vector2(0.6, 0.35) },
    uTime: { value: 0 }, uLen: { value: 1.25 }, uWidth: { value: 0.022 }, uInside: { value: 0 },
    uColor: { value: new THREE.Color(0xcdd6de) }, uAlpha: { value: 0.42 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: rainVert, fragmentShader: rainFrag, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'rain-streaks';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;
  return { mesh, uniforms, geo: g };
}

// Irregular flat pools: a fan of triangles with a wobbling rim.
function pools() {
  const r = rng(77), pos = [];
  const add = (x, y, z, rx, rz, rot) => {
    const n = 11, rim = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, w = 0.75 + 0.35 * r();
      const u = Math.cos(a) * rx * w, v = Math.sin(a) * rz * w;
      rim.push([x + u * Math.cos(rot) - v * Math.sin(rot), z + u * Math.sin(rot) + v * Math.cos(rot)]);
    }
    for (let k = 0; k < n; k++) {
      const p = rim[k], q = rim[(k + 1) % n];
      pos.push(x, y, z, q[0], y, q[1], p[0], y, p[1]);
    }
  };
  // the farm road: in the wheel tracks, every few samples
  for (let i = 3; i < ROAD_SAMPLES.length - 2; i += 3) {
    const s = ROAD_SAMPLES[i], nx = -s.tz, nz = s.tx, side = r() < 0.5 ? -1 : 1;
    if (r() < 0.25) continue;
    add(s.x + nx * side * 1.2, 0.062, s.z + nz * side * 1.2, 0.5 + 0.6 * r(), 0.3 + 0.3 * r(), Math.atan2(s.tz, s.tx));
  }
  // the turning area by the fan end, the concrete door path, the house apron (south and north)
  const end = ROAD_SAMPLES[ROAD_SAMPLES.length - 1];
  for (let k = 0; k < 5; k++) add(end.x - 4 + r() * 8, 0.045, 10 + r() * 3.5, 0.6 + 0.6 * r(), 0.4 + 0.4 * r(), r() * 3);
  const dp = FARM.doorPath[0];
  for (let k = 0; k < 3; k++) add(dp.x - 0.6 + r() * 1.2, 0.075, 8.5 + r() * 4, 0.45 + 0.3 * r(), 0.3 + 0.2 * r(), r() * 3);
  const H = HOUSE_BOUNDS;
  for (let k = 0; k < 9; k++) {
    const x = H.xMin + 2 + r() * (H.xMax - H.xMin - 4);
    if (Math.abs(x - FARM.doorPath[0].x) < 2) continue;
    const south = r() < 0.65;
    add(x, 0.052, south ? H.zMax + 0.85 : H.zMin - 0.85, 0.7 + 0.8 * r(), 0.25 + 0.15 * r(), 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshPhongMaterial({ color: 0x6f7f8c, specular: 0x8a96a0, shininess: 120, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'rain-puddles';
  mesh.renderOrder = 1;
  mesh.receiveShadow = false;
  mesh.visible = false;
  return { mesh, mat };
}

export function buildRain(root) {
  const s = streaks(), p = pools();
  root.add(s.mesh, p.mesh);
  const st = { rain: 0, wet: 0, t: 0, flash: 0, flashT: -1, next: 12 + Math.random() * 20, flashes: 0 };
  const sky = new THREE.Color();
  return {
    st,
    /** Start a lightning flash now (the harness's lightning frame; also while reduced motion is on). */
    flash() { st.flashT = 0; st.flashes++; },
    /**
     * rain 0..1 (farm.weatherNow.rain), storm: lightning, dt real seconds, view { camera, playerPos },
     * skyTone: the sky's horizon colour (the puddles mirror it). Returns { wet, flash } for the sky and ground.
     */
    update(dt, rain, storm, view, skyTone) {
      st.rain += (rain - st.rain) * (1 - Math.exp(-dt * 1.5));
      if (rain <= 0 && st.rain < 0.01) st.rain = 0;
      st.wet += ((rain > 0 ? 1 : 0) - st.wet) * (1 - Math.exp(-dt * (rain > 0 ? 0.35 : 0.04)));
      if (rain <= 0 && st.wet < 0.005) st.wet = 0;
      st.t += dt;
      // streaks: as many as the rain is heavy, in a box between the farmer and the camera
      const n = Math.round(RAIN_MAX * st.rain);
      s.geo.instanceCount = n;
      s.mesh.visible = n > 0;
      if (n > 0 && view && view.camera) {
        const c = view.camera.position, f = view.playerPos || c;
        s.uniforms.uCam.value.copy(c);
        s.uniforms.uCenter.value.set(f.x + (c.x - f.x) * 0.3, 0, f.z + (c.z - f.z) * 0.3);
        s.uniforms.uTime.value = st.t % 1000;
        s.uniforms.uInside.value = view.playerInside ? 1 : 0;
      }
      p.mesh.visible = st.wet > 0.01;
      p.mat.opacity = 0.7 * st.wet;
      if (skyTone) p.mat.color.copy(sky.copy(skyTone).multiplyScalar(0.55));
      // lightning: two quick pulses, about every 40 s while the storm lasts
      if (storm && rain > 0 && !reducedMotion()) {
        st.next -= dt;
        if (st.next <= 0) { st.next = 30 + Math.random() * 20; st.flashT = 0; st.flashes++; }
      }
      if (st.flashT >= 0) {
        const t = st.flashT;
        st.flash = t < 0.09 ? 1 : t < 0.2 ? 0.15 : t < 0.32 ? 0.8 : Math.max(0, 0.8 - (t - 0.32) * 4);
        st.flashT += dt;
        if (st.flashT > 0.6) { st.flashT = -1; st.flash = 0; }
      } else st.flash = 0;
      return st;
    },
    debug: { streaks: s, puddles: p, get drawn() { return s.mesh.visible ? s.geo.instanceCount : 0; } },
  };
}
