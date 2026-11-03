// Roof of the chicken house. Owner: house agent.
//  - The visible roof (silver-grey ribbed sheets, ridge cap, eave and barge trims, gable infills)
//    shows from the yard and the road; it dissolves (screen-door dither) as the farmer comes within
//    8 m, so the "roof cut away" view is complete before the walls start to drop at 6 m.
//  - A shadow-only roof plus full-height side walls (never drawn, only cast shadows) keep the
//    litter in shade at every hour, as under a real roof: the interior is lit evenly by the sky and
//    the house lamps, with no sun patches or moving equipment shadows over the flock.
//  - Shader patches: a dither fade driven by a uniform, and the tie-beam fade that clears the
//    trusses out of the line between the camera and the farmer.
import * as THREE from 'three';
import { COLORS, HOUSE_BOUNDS } from './config.js';
import { Batch } from './house-kit.js';
import { H, T, TRUSS_Y, RIDGE_Y } from './house-shell.js';
import { occlusion } from './world-util.js';

const { xMin, xMax, zMax } = HOUSE_BOUNDS;
const OVER = 0.3;                   // overhang past the walls
const ZW = zMax + T / 2;            // wall centre line (6.075)
const ZE = ZW + T / 2 + OVER;       // eave edge
const XE = xMax + T + OVER;         // gable edge
const LIFT = 0.07;                  // sheets sit on the purlins, above the rafters
const SHEET = 0xb3bbc1, RIB_LO = 0xa3acb3, CAP = 0x8f989f, TRIM = 0xa5adb4; // light silver-grey, below white in full sun
// roof surface height over the floor point at |z|
const roofY = (az) => TRUSS_Y + LIFT + (RIDGE_Y - TRUSS_Y) * (1 - az / 6.05);

const BAYER = /* glsl */`
float roofBayer(vec2 p) {
  vec2 a = mod(p, 2.0), b = mod(floor(p * 0.5), 2.0);
  float d1 = 2.0 * a.x + 3.0 * a.y - 4.0 * a.x * a.y, d2 = 2.0 * b.x + 3.0 * b.y - 4.0 * b.x * b.y;
  return (4.0 * d1 + d2 + 0.5) / 16.0;
}`;

// Screen-door fade: uniform 1 = solid, 0 = gone. No transparency, so no sorting problems.
export function withDither(material, key) {
  const uFade = { value: 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = uFade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uFade;\n${BAYER}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (roofBayer(floor(gl_FragCoord.xy)) >= uFade) discard;');
  };
  material.customProgramCacheKey = () => key;
  return uFade;
}

// Tie beams (truss bottom chords): dither away the beam whose plane holds the camera (seen edge-on
// it is a bar down the middle of the screen, through the farmer and the boards) and any beam
// crossing close to the line from the camera to the farmer. Uses the world's occlusion uniforms.
export function withChordFade(material, key) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCam = occlusion.uCam;
    shader.uniforms.uPlayer = occlusion.uPlayer;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vChordW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vChordW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uCam; uniform vec3 uPlayer; varying vec3 vChordW;\n${BAYER}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    vec3 ab = uPlayer - uCam;
    float t = clamp(dot(vChordW - uCam, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    float d = length(vChordW - (uCam + ab * t));
    float f = max(smoothstep(1.6, 0.8, abs(vChordW.x - uCam.x)), smoothstep(1.5, 0.7, d));
    if (f > 0.01 && roofBayer(floor(gl_FragCoord.xy)) < f) discard;
  }`);
  };
  material.customProgramCacheKey = () => key;
}

// One ribbed sheet face over a slope: profile across x (flat pan, rising web, rib top, falling web)
// repeated every PITCH, running from the eave (z = side * ZE) up to the ridge.
const PITCH = 0.42;
const PROFILE = [[0, 0], [0.24, 0], [0.28, 0.035], [0.34, 0.035], [0.38, 0]];
function slopeGeometry(side) {
  const pos = [], col = [], idx = [];
  const lo = new THREE.Color(RIB_LO), hi = new THREE.Color(SHEET);
  const zA = side * ZE, zB = side * 0.0;
  const yA = roofY(ZE), yB = roofY(0);
  const xs = [];
  for (let x0 = -XE; x0 < XE - 1e-6; x0 += PITCH) for (const [dx, h] of PROFILE) if (x0 + dx < XE) xs.push([x0 + dx, h]);
  xs.push([XE, 0]);
  // normal of the slope plane (pointing up and out), to lift the ribs off the plane
  const n = new THREE.Vector3(0, ZE, side * (yA - yB)).normalize();
  for (const [x, h] of xs) {
    for (const [z, y] of [[zA, yA], [zB, yB]]) {
      pos.push(x + n.x * h, y + n.y * h, z + n.z * h);
      const c = h > 0 ? hi : lo;
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// Batch.add paints one colour; the sheets carry their own (pans darker than the rib tops).
function addColored(b, g) {
  const p = g.attributes.position, c = g.attributes.color, base = b.pos.length / 3;
  for (let i = 0; i < p.count; i++) { b.pos.push(p.getX(i), p.getY(i), p.getZ(i)); b.col.push(c.getX(i), c.getY(i), c.getZ(i)); }
  for (let i = 0; i < g.index.count; i++) b.idx.push(base + g.index.getX(i));
}

// Gable infill at end x: the triangle between the end wall top (H) and the roof line.
function gableGeometry(x, thick) {
  const shape = new THREE.Shape();
  shape.moveTo(-ZW, H - 0.02);
  shape.lineTo(ZW, H - 0.02);
  shape.lineTo(ZW, roofY(ZW) - 0.02);
  shape.lineTo(0, roofY(0) - 0.02);
  shape.lineTo(-ZW, roofY(ZW) - 0.02);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateY(Math.PI / 2);          // shape x -> world -z, extrusion -> +x
  g.translate(x - thick / 2, 0, 0);
  return g;
}

export function buildRoof(group) {
  // ---- visible roof ----
  const b = new Batch();
  for (const side of [-1, 1]) addColored(b, slopeGeometry(side));
  // ridge cap (two bent flashings) and the trims along the eaves and the gable edges
  const capW = 0.32, rise = (roofY(0) - roofY(capW)) || 0.07;
  for (const side of [-1, 1]) {
    b.box(2 * XE + 0.04, 0.025, capW, 0, roofY(capW / 2) + 0.055, side * capW / 2, CAP, 0, side * Math.atan2(rise, capW));
    b.box(2 * XE, 0.1, 0.03, 0, roofY(ZE) - 0.03, side * (ZE + 0.01), TRIM);
    for (const sx of [-1, 1]) {
      const za = side * ZE, zb = 0, ya = roofY(ZE) + 0.02, yb = roofY(0) + 0.02;
      b.bar([sx * (XE + 0.01), ya, za], [sx * (XE + 0.01), yb, zb], 0.06, TRIM);
    }
  }
  for (const x of [xMin - T / 2, xMax + T / 2]) b.add(gableGeometry(x, T), COLORS.wallWhite);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const fade = withDither(mat, 'house-roof');
  const roof = b.mesh(mat, { cast: false, receive: true });
  roof.name = 'house-roof';
  group.add(roof);

  // ---- shadow-only roof and side walls ----
  const c = new Batch();
  const ya = roofY(ZE), yb = roofY(0);
  for (const side of [-1, 1]) {
    const slope = new THREE.PlaneGeometry(2 * XE, Math.hypot(ZE, yb - ya));
    slope.rotateX(-Math.PI / 2 + side * Math.atan2(yb - ya, ZE));
    slope.translate(0, (ya + yb) / 2, side * ZE / 2);
    c.add(slope, 0xffffff);
    c.box(xMax - xMin + 2 * T, roofY(ZW) - 0.45, 0.02, 0, (0.45 + roofY(ZW)) / 2, side * ZW, 0xffffff);
  }
  for (const x of [xMin - T / 2, xMax + T / 2]) c.add(gableGeometry(x, 0.02), 0xffffff);
  const casterMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const caster = c.mesh(casterMat, { cast: true, receive: false });
  caster.name = 'house-shade';
  group.add(caster);

  return {
    roof,
    // k: 1 = roof on (farmer away from the house), 0 = roof off
    setFade(k) {
      fade.value = k;
      roof.visible = k > 0.01;
    },
  };
}
