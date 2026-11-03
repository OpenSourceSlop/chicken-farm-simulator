// Sky dome, stars, sun/moon light and the day-night look. Owner: world agent.
import * as THREE from 'three';
import { TIME } from './config.js';
import { rng, smoothstep, clamp } from './world-util.js';

// Colour keyframes by hour. zen = sky overhead, hor = horizon/fog, hs/hg = hemisphere sky/ground,
// hi = hemisphere intensity, sc = sunlight colour, si = peak sun (or moon) intensity.
const KEYS = [
  { h: 0.0, zen: 0x0b1634, hor: 0x24365e, hs: 0x8aa2d8, hg: 0x34404c, hi: 1.25, sc: 0xa8c0ff, si: 0.85 },
  { h: 4.8, zen: 0x0d1838, hor: 0x283a62, hs: 0x8aa2d8, hg: 0x34404c, hi: 1.25, sc: 0xa8c0ff, si: 0.85 },
  { h: 5.6, zen: 0x2a3f72, hor: 0xc98a7e, hs: 0xa6a8cc, hg: 0x4a4a48, hi: 1.15, sc: 0xff9a60, si: 1.6 },
  { h: 6.3, zen: 0x4a76b6, hor: 0xf2bf94, hs: 0xd6d2dc, hg: 0x625c48, hi: 1.15, sc: 0xffb070, si: 2.6 },
  { h: 7.5, zen: 0x4f8ad2, hor: 0xd4e2ea, hs: 0xd8e4f0, hg: 0x66704a, hi: 1.1, sc: 0xffd9a8, si: 2.9 },
  { h: 10, zen: 0x3f82d4, hor: 0xc2dbee, hs: 0xd6e8f8, hg: 0x5e6c42, hi: 0.95, sc: 0xfff2e0, si: 3.0 },
  { h: 14, zen: 0x3d80d2, hor: 0xc4dcee, hs: 0xd6e8f8, hg: 0x5e6c42, hi: 0.95, sc: 0xfff0dc, si: 3.0 },
  { h: 16.3, zen: 0x4a84cc, hor: 0xd6e0e2, hs: 0xd8e2ee, hg: 0x626a44, hi: 0.95, sc: 0xffe2b4, si: 2.9 },
  { h: 17.5, zen: 0x5274b2, hor: 0xf4c890, hs: 0xe2d8d2, hg: 0x6c5e42, hi: 1.1, sc: 0xffbc72, si: 2.9 },
  { h: 18.3, zen: 0x3a4f8a, hor: 0xf49a5e, hs: 0xd8bcc0, hg: 0x5e4c3c, hi: 1.15, sc: 0xff9450, si: 2.6 },
  { h: 19.0, zen: 0x1e2b5a, hor: 0x9c6070, hs: 0x9ca4d0, hg: 0x3c3c48, hi: 1.15, sc: 0xb0b8ee, si: 0.9 },
  { h: 19.8, zen: 0x0d1838, hor: 0x283a62, hs: 0x8aa2d8, hg: 0x34404c, hi: 1.25, sc: 0xa8c0ff, si: 0.85 },
  { h: 24.0, zen: 0x0b1634, hor: 0x24365e, hs: 0x8aa2d8, hg: 0x34404c, hi: 1.25, sc: 0xa8c0ff, si: 0.85 },
].map((k) => ({ ...k, zen: new THREE.Color(k.zen), hor: new THREE.Color(k.hor), hs: new THREE.Color(k.hs), hg: new THREE.Color(k.hg), sc: new THREE.Color(k.sc) }));

// Fog distance keyframes: morning mist over the paddies, clear midday, softer at night.
const FOG = [[0, 70, 330], [5, 55, 280], [6.5, 45, 240], [8.5, 80, 360], [16, 90, 380], [18.5, 75, 330], [20, 70, 330], [24, 70, 330]];

const SUN_TILT = 0.45;   // sun arc leans south (Thailand ~15 deg N), so shadows fall north, away from the camera
const MOON_TILT = 0.55;
const MIN_LIGHT_ELEV = 0.4; // sin of the lowest angle the light may take (keeps mornings and evenings bright)

function arcDir(t, tilt, out) {
  return out.set(Math.cos(t), Math.sin(t) * Math.cos(tilt), Math.sin(t) * Math.sin(tilt));
}
export function sunDirAt(hour, out) {
  const t = ((hour - TIME.sunrise) / (TIME.sunset - TIME.sunrise)) * Math.PI;
  return arcDir(t, SUN_TILT, out);
}
function moonDirAt(hour, out) {
  const night = 24 - (TIME.sunset - TIME.sunrise);
  const t = ((((hour - TIME.sunset) % 24) + 24) % 24) / night * Math.PI;
  return arcDir(Math.min(t, Math.PI + 0.3), MOON_TILT, out);
}

const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFrag = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunVis; uniform float uGlow;
uniform vec3 uMoonDir; uniform float uMoonVis;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h * 1.15, 0.0, 1.0), 0.6)) : mix(uHorizon, uBottom, clamp(-h * 5.0, 0.0, 1.0));
  float s = max(dot(d, uSunDir), 0.0);
  float band = pow(1.0 - abs(h), 6.0);
  col += uSunColor * (pow(s, 5.0) * 0.30 * uGlow * band + pow(s, 48.0) * 0.45) * uSunVis;
  col = mix(col, uSunColor * 1.4 + vec3(0.35), smoothstep(0.99935, 0.99965, s) * uSunVis * step(-0.02, h));
  float m = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.32, 0.40, 0.62) * pow(m, 40.0) * 0.35 * uMoonVis;
  float disc = smoothstep(0.99955, 0.99972, m) * uMoonVis;
  vec3 moon = vec3(0.92, 0.92, 0.84) * (0.85 + 0.15 * smoothstep(0.9996, 1.0, dot(d, normalize(uMoonDir + vec3(0.004, 0.006, 0.0)))));
  col = mix(col, moon, disc);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(ctx) {
  const { scene, renderer } = ctx;
  const group = new THREE.Group();
  group.name = 'sky';
  scene.add(group);

  const uniforms = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSunVis: { value: 1 }, uGlow: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonVis: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(470, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // Stars: fixed points on the upper half of the dome, faded in at night
  const r = rng(77);
  const starPos = [], starCol = [];
  for (let i = 0; i < 650; i++) {
    const u = r(), v = 0.06 + 0.94 * Math.pow(r(), 0.8);
    const th = u * Math.PI * 2, y = v, rr = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(th) * rr * 440, y * 440, Math.sin(th) * rr * 440);
    const b = 0.45 + 0.55 * r() * r();
    starCol.push(b, b, b * (0.9 + 0.2 * r()));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  group.add(stars);

  // Lights
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7a4a, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.name = 'sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  const sc = sun.shadow.camera;
  sc.near = 1; sc.far = 220;
  scene.add(sun, sun.target);

  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xbfd9ea, 80, 360);

  // Working objects (no per-frame allocation)
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
  const k = { zen: new THREE.Color(), hor: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sc: new THREE.Color(), hi: 1, si: 1 };
  const right = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3();
  const state = { half: 0, hour: -1, night: 0, dayLight: 1 };
  const warm = new THREE.Color(0xff8a3c);

  function sampleKeys(hour) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smoothstep(0, 1, (hour - a.h) / (b.h - a.h));
    k.zen.copy(a.zen).lerp(b.zen, t); k.hor.copy(a.hor).lerp(b.hor, t);
    k.hs.copy(a.hs).lerp(b.hs, t); k.hg.copy(a.hg).lerp(b.hg, t); k.sc.copy(a.sc).lerp(b.sc, t);
    k.hi = a.hi + (b.hi - a.hi) * t; k.si = a.si + (b.si - a.si) * t;
  }
  function sampleFog(hour) {
    let i = 0;
    while (i < FOG.length - 2 && FOG[i + 1][0] <= hour) i++;
    const a = FOG[i], b = FOG[i + 1];
    const t = (hour - a[0]) / (b[0] - a[0]);
    scene.fog.near = a[1] + (b[1] - a[1]) * t;
    scene.fog.far = a[2] + (b[2] - a[2]) * t;
  }

  function setShadowHalf(half) {
    if (Math.abs(half - state.half) < 0.5) return;
    state.half = half;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.updateProjectionMatrix();
  }
  setShadowHalf(35);

  function update(dt, env, view) {
    const hour = env.hour;
    sampleKeys(hour);
    sampleFog(hour);
    sunDirAt(hour, sunDir);
    moonDirAt(hour, moonDir);

    // Sun strength fades out near the horizon; the moon takes over after dusk
    const sunI = k.si * smoothstep(-0.03, 0.14, sunDir.y);
    const night = 1 - smoothstep(-0.12, 0.04, sunDir.y);
    const moonI = 0.85 * smoothstep(0.0, 0.3, moonDir.y) * night;
    state.night = night;
    const useSun = sunI >= moonI;
    lightDir.copy(useSun ? sunDir : moonDir);
    if (lightDir.y < MIN_LIGHT_ELEV) { // keep the shadow light above ~12 degrees so shadows stay usable
      const hz = Math.hypot(lightDir.x, lightDir.z) || 1;
      const c = Math.sqrt(1 - MIN_LIGHT_ELEV * MIN_LIGHT_ELEV);
      lightDir.set((lightDir.x / hz) * c, MIN_LIGHT_ELEV, (lightDir.z / hz) * c);
    }
    sun.intensity = useSun ? sunI : moonI;
    sun.color.copy(k.sc);
    state.dayLight = smoothstep(-0.05, 0.3, sunDir.y);

    hemi.color.copy(k.hs);
    hemi.groundColor.copy(k.hg);
    hemi.intensity = k.hi;

    // Sky dome and fog
    uniforms.uTop.value.copy(k.zen);
    uniforms.uHorizon.value.copy(k.hor);
    uniforms.uBottom.value.copy(k.hor).multiplyScalar(0.8);
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uSunColor.value.copy(k.sc).lerp(warm, 1 - smoothstep(0.0, 0.5, sunDir.y));
    uniforms.uSunVis.value = smoothstep(-0.06, 0.02, sunDir.y);
    uniforms.uGlow.value = 0.6 + 1.6 * (1 - smoothstep(0.05, 0.45, sunDir.y));
    uniforms.uMoonDir.value.copy(moonDir);
    uniforms.uMoonVis.value = night * smoothstep(-0.05, 0.08, moonDir.y);
    starMat.opacity = night * 0.95;
    stars.visible = starMat.opacity > 0.01;
    scene.fog.color.copy(k.hor);
    scene.background.copy(k.hor);

    if (view && view.camera) group.position.copy(view.camera.position);

    // Shadow box follows the farmer; grows a little when the camera is far out.
    if (view && view.playerPos) {
      const camDist = view.camera ? view.camera.position.distanceTo(view.playerPos) : 22;
      setShadowHalf(clamp(Math.round(camDist * 0.95), 35, 50));
      const p = view.playerPos;
      // Snap the box centre to whole shadow texels in light space to stop shimmering.
      right.set(0, 1, 0).cross(lightDir).normalize();
      upv.copy(lightDir).cross(right).normalize();
      const texel = (2 * state.half) / sun.shadow.mapSize.x;
      tmp.set(p.x, 0, p.z);
      const a = Math.round(tmp.dot(right) / texel) * texel;
      const b = Math.round(tmp.dot(upv) / texel) * texel;
      const c = tmp.dot(lightDir);
      tmp.set(0, 0, 0).addScaledVector(right, a).addScaledVector(upv, b).addScaledVector(lightDir, c);
      sun.target.position.copy(tmp);
      sun.position.copy(tmp).addScaledVector(lightDir, 110);
      sun.target.updateMatrixWorld();
    }
  }

  return { sun, hemi, group, uniforms, state, horizon: k.hor, zenith: k.zen, sunColor: k.sc, update };
}
