// Tunnel fans in one row across the east end wall: galvanized box housings with a round venturi,
// wire guard inside, six stainless blades, shutter louvres and a discharge cone outside.
// Blades spin up smoothly when the fan index < env.fansOn; shutters open with the air flow.
// Owner: house agent.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, FAN_COUNT, FAN_DIAMETER, HOUSE_BOUNDS } from './config.js';
import { Batch, mat, smooth, canvasTexture, roundRect, FONT } from './house-kit.js';
import { T, H } from './house-shell.js';
import { powerOff } from './world-cond.js';

// Number plates 1..FAN_COUNT above the fans on the inside of the end wall (one atlas, one mesh),
// so "fans on: 3" can be matched to the fans that spin.
function numberPlates(top) {
  const cell = 96;
  const tex = canvasTexture(cell * FAN_COUNT, cell, (g) => {
    for (let i = 0; i < FAN_COUNT; i++) {
      g.fillStyle = '#f3ecd8'; roundRect(g, i * cell + 4, 4, cell - 8, cell - 8, 12); g.fill();
      g.strokeStyle = '#2f5d8a'; g.lineWidth = 6; roundRect(g, i * cell + 9, 9, cell - 18, cell - 18, 9); g.stroke();
      g.fillStyle = '#2f5d8a'; g.font = `700 60px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), i * cell + cell / 2, cell / 2 + 3);
    }
  });
  const geos = FAN_Z.map((z, i) => {
    const p = new THREE.PlaneGeometry(0.3, 0.3);
    const uv = p.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / FAN_COUNT);
    p.rotateY(-Math.PI / 2);
    p.translate(xMax - 0.005, (top + H) / 2, z);
    return p;
  });
  return new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: tex }));
}

const { xMax, zMin, zMax } = HOUSE_BOUNDS;
const R = FAN_DIAMETER / 2;                    // 0.635
const BOX = FAN_DIAMETER + 0.17;               // housing outer size
const BOX_IN = xMax - 0.28, BOX_OUT = xMax + T + 0.2;
const CY = 0.36 + BOX / 2;                     // fan centre height
const SPACING = 1.9;
const MAX_SPIN = 11;                           // rad/s on screen (reads as a fast spin, no strobing)
const SLATS = 7;
// Fan order: staged from the centre outward so the air stays even across the house.
const ORDER = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5].slice(0, FAN_COUNT);
export const FAN_Z = ORDER.map((k) => k * SPACING);

function housingGeometry() {
  const s = new THREE.Shape();
  const h = BOX / 2;
  s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h); s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, R + 0.02, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: BOX_OUT - BOX_IN, bevelEnabled: false, curveSegments: 20 });
  g.rotateY(Math.PI / 2);       // extrude along +x
  return g;
}

function rotorGeometry() {
  const b = new Batch();
  const blade = new THREE.Shape();
  blade.moveTo(0.1, -0.05); blade.lineTo(R - 0.04, -0.14); blade.quadraticCurveTo(R + 0.01, 0, R - 0.04, 0.13); blade.lineTo(0.1, 0.05);
  blade.closePath();
  const bg = new THREE.ShapeGeometry(blade, 3);
  for (let i = 0; i < 6; i++) {
    // blade in the YZ plane, pitched 24 degrees about its own radial axis
    // Ry(-90) puts the radial axis on +z (normal -x), Rz pitches it, Rx spreads the six blades
    const M = mat(0, 0, 0, (i / 6) * Math.PI * 2, 0, 0).multiply(mat(0, 0, 0, 0, 0, 0.42)).multiply(mat(0, 0, 0, 0, -Math.PI / 2, 0));
    b.add(bg, 0xd9dee2, M);
  }
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 10), 0x7d868d, mat(0, 0, 0, 0, 0, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 10), 0x50585e, mat(-0.08, 0, 0, 0, 0, Math.PI / 2));
  return b.geometry();
}

export function buildFans(kit) {
  const { stat, statDS, group } = kit;
  const galv = 0xb7bfc5, wire = 0x5f676d, white = COLORS.wallWhite;
  const xc = xMax + T / 2;
  const top = CY + BOX / 2, bot = CY - BOX / 2;

  // end wall around the fans: kick strip, top panel, fillers between the housings
  stat.box(T, bot, zMax - zMin, xc, bot / 2, 0, COLORS.wallLow);
  stat.box(T, H - top, zMax - zMin, xc, (top + H) / 2, 0, white);
  stat.box(T + 0.02, 0.06, zMax - zMin, xc, H - 0.03, 0, 0xb5bcc2);
  const edges = [zMin, ...FAN_Z.slice().sort((a, b) => a - b).flatMap((z) => [z - BOX / 2, z + BOX / 2]), zMax];
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i], b2 = edges[i + 1];
    if (b2 - a > 0.01) stat.box(T, top - bot, b2 - a, xc, CY, (a + b2) / 2, white);
  }

  const housing = housingGeometry();
  const rings = [0.2, 0.36, 0.5, R - 0.02].map((r) => new THREE.TorusGeometry(r, 0.01, 4, 28));
  const coneGeo = new THREE.CylinderGeometry(R + 0.2, R + 0.04, 0.9, 24, 1, true);
  const coneLip = new THREE.TorusGeometry(R + 0.2, 0.025, 4, 24);
  for (const z of FAN_Z) {
    stat.add(housing, galv, mat(BOX_IN, CY, z));
    // guard grille on the inside face: rings and spokes
    for (const rg of rings) stat.add(rg, wire, mat(BOX_IN - 0.03, CY, z, 0, Math.PI / 2, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI + Math.PI / 8;
      stat.rod([BOX_IN - 0.03, CY + Math.sin(a) * R, z + Math.cos(a) * R], [BOX_IN - 0.03, CY - Math.sin(a) * R, z - Math.cos(a) * R], 0.008, wire, 4);
    }
    // motor behind the hub on a cross bracket
    stat.add(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 10), 0x4e6a80, mat(BOX_IN + 0.42, CY, z, 0, 0, Math.PI / 2));
    stat.bar([BOX_IN + 0.42, CY - R, z], [BOX_IN + 0.42, CY + R, z], 0.04, galv);
    stat.bar([BOX_IN + 0.42, CY, z - R], [BOX_IN + 0.42, CY, z + R], 0.04, galv);
    // discharge cone outside
    statDS.add(coneGeo, 0xa7b0b6, mat(BOX_OUT + 0.445, CY, z, 0, 0, -Math.PI / 2));
    stat.add(coneLip, 0x8d969c, mat(BOX_OUT + 0.9, CY, z, 0, Math.PI / 2, 0));
    stat.box(0.05, 0.08, BOX, BOX_OUT - 0.02, CY + BOX / 2 + 0.04, z, 0x8d969c); // rain hood lip
    // feet of the cone support
    stat.bar([BOX_OUT + 0.6, CY - R - 0.2, z], [BOX_OUT + 0.6, 0.04, z], 0.04, 0x8d969c);
  }

  // spinning rotors and swinging shutter slats (instanced: one draw call each)
  const rotorMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const rotors = new THREE.InstancedMesh(rotorGeometry(), rotorMat, FAN_COUNT);
  rotors.castShadow = true;
  const slatGeo = new THREE.BoxGeometry(0.012, (BOX - 0.12) / SLATS + 0.02, BOX - 0.1);
  slatGeo.translate(0, -((BOX - 0.12) / SLATS + 0.02) / 2, 0);  // hinge at the top edge
  const slats = new THREE.InstancedMesh(slatGeo, new THREE.MeshLambertMaterial({ color: 0xdfe3e6 }), FAN_COUNT * SLATS);
  group.add(rotors, slats, numberPlates(top));

  const speed = new Float32Array(FAN_COUNT), angle = new Float32Array(FAN_COUNT), open = new Float32Array(FAN_COUNT);
  for (let i = 0; i < FAN_COUNT; i++) angle[i] = i * 0.37;
  const M = new THREE.Matrix4();
  // per-frame placement without allocations: rotation about x (rotor) or z (slat) + translation
  function place() {
    const e = M.elements;
    for (let i = 0; i < FAN_COUNT; i++) {
      const c = Math.cos(angle[i]), s = Math.sin(angle[i]);
      M.set(1, 0, 0, BOX_IN + 0.24, 0, c, -s, CY, 0, s, c, FAN_Z[i], 0, 0, 0, 1);
      rotors.setMatrixAt(i, M);
      const a = open[i] * 1.25, ca = Math.cos(a), sa = Math.sin(a);
      M.set(ca, -sa, 0, BOX_OUT - 0.04, sa, ca, 0, 0, 0, 0, 1, FAN_Z[i], 0, 0, 0, 1);
      for (let k = 0; k < SLATS; k++) {
        e[13] = CY + BOX / 2 - 0.06 - k * ((BOX - 0.12) / SLATS);
        slats.setMatrixAt(i * SLATS + k, M);
      }
    }
    rotors.instanceMatrix.needsUpdate = true;
    slats.instanceMatrix.needsUpdate = true;
  }
  place();

  return {
    // tests: blade angle and spin of each fan (rad, rad/s)
    angle, speed,
    update(dt, env) {
      let moving = false;
      // Phase 3: a fan whose belt is broken (env.fansBroken) has its lamp on but the blade stands
      // still and the shutters stay shut (no air through it); the sandbox never has one
      const broken = env.fansBroken && env.fansBroken.length ? env.fansBroken : null;
      // Phase 4: a power cut (farm.power.on false) stops every fan, tunnel and timer: the blades run down
      // evenly over 3 s (the motors lose their current at once) instead of coasting
      const dark = powerOff(kit.farm, env);
      for (let i = 0; i < FAN_COUNT; i++) {
        const on = !dark && i < env.fansOn && !(broken && broken.includes(i));
        const target = on ? MAX_SPIN : 0;
        if (dark) speed[i] = Math.max(0, speed[i] - (MAX_SPIN / 3) * dt);
        else speed[i] = smooth(speed[i], target, on ? 0.9 : 0.45, dt);
        if (!on && speed[i] < 0.05) speed[i] = 0;
        angle[i] = (angle[i] + speed[i] * dt) % (Math.PI * 2);
        const o = smooth(open[i], Math.min(1, speed[i] / (MAX_SPIN * 0.4)), 3, dt);
        if (speed[i] > 0 || Math.abs(o - open[i]) > 1e-4) moving = true;
        open[i] = o;
      }
      if (moving) place();
    },
  };
}
