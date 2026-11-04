// Phase 4 (PHASE4.md §8.3): the generator in the rainy season. Owner: package "scene" (props).
//   on the generator shed's back wall (world-buildings.js generatorShed, open to the south): the generator's control
//   panel (west end: display, start key, the running lamp) and the transfer switch box (east end: the house on the
//   mains or the generator, its rotary handle and two lamps), with their conduits to the roof
//   while farm.generator.running: exhaust puffs from the stack (a few instanced puffs) and the set shaking a little
// Shown in the rainy season only (the shed and the set themselves are Phase 1's).
import * as THREE from 'three';
import { FARM } from './config.js';
import { Batch, mat } from './props-kit.js';
import { reducedMotion } from './world-cond.js';

const G = FARM.generator;
const BACK_Z = G.z - G.d / 2 + 0.15;                // inner face of the shed's back wall
export const GEN_PANEL = { x: G.x - 1.62, y: 1.18, z: BACK_Z + 0.09 };
export const GEN_SWITCH = { x: G.x + 1.6, y: 1.18, z: BACK_Z + 0.09 };
const STACK = { x: G.x - 0.2, y: 3.62, z: G.z - 0.2 };  // the exhaust's rain cap (world-buildings.js)
const PUFFS = 10, LIFE = 2.4, EVERY = LIFE / PUFFS;
const DIM = { green: 0x23382a, amber: 0x3a3020 }, LIT = { green: 0x58f070, amber: 0xffb02a };

function boxes(b) {
  const P = GEN_PANEL, S = GEN_SWITCH;
  for (const q of [P, S]) {
    b.box(0.5, 0.95, 0.03, q.x, q.y - 0.12, BACK_Z + 0.015, 0x8a7a5e);          // plywood backboard
    b.box(0.42, 0.56, 0.17, q.x, q.y, q.z, 0xa7aeb3);                           // steel cabinet
    b.box(0.44, 0.03, 0.19, q.x, q.y + 0.29, q.z, 0x7d868d);                    // rain lip
    b.rod([q.x + 0.1, q.y + 0.3, q.z - 0.02], [q.x + 0.1, 2.75, q.z - 0.02], 0.022, 0x6d757c, 6); // conduit to the roof
  }
  // control panel: display, start key, stop button, a hazard label
  b.box(0.26, 0.11, 0.012, P.x, P.y + 0.12, P.z + 0.087, 0x16261a);
  b.box(0.05, 0.05, 0.03, P.x - 0.1, P.y - 0.08, P.z + 0.095, 0x2b2e31);
  b.box(0.012, 0.035, 0.012, P.x - 0.1, P.y - 0.08, P.z + 0.115, 0xd9a520);     // the key
  b.box(0.055, 0.055, 0.02, P.x + 0.04, P.y - 0.08, P.z + 0.09, 0xc23a2a);      // stop
  b.box(0.3, 0.06, 0.006, P.x, P.y - 0.2, P.z + 0.088, 0xf0c419);
  // transfer switch: labels either side of the handle's hub
  b.box(0.11, 0.035, 0.006, S.x - 0.1, S.y + 0.17, S.z + 0.088, 0xe9e3d2);
  b.box(0.11, 0.035, 0.006, S.x + 0.1, S.y + 0.17, S.z + 0.088, 0xe9e3d2);
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), 0x2b2e31, mat(S.x, S.y - 0.04, S.z + 0.095, Math.PI / 2, 0, 0));
}

export function buildGenerator(group, parts, lit, scene) {
  const b = new Batch();
  boxes(b);
  const fixed = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { cast: true, receive: true });
  fixed.name = 'props-generator-panels';
  const root = new THREE.Group();
  root.name = 'props-generator';
  root.add(fixed);
  // exhaust puffs: one instanced mesh, grey, a little see-through
  const puffMat = new THREE.MeshLambertMaterial({ color: 0x8e908c, flatShading: true, transparent: true, opacity: 0.5, depthWrite: false });
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), puffMat, PUFFS);
  puffs.name = 'props-generator-puffs';
  puffs.frustumCulled = false;
  root.add(puffs);
  root.visible = false;
  group.add(root);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < PUFFS; i++) puffs.setMatrixAt(i, zero);
  const age = new Float32Array(PUFFS).fill(-1), seed = new Float32Array(PUFFS);
  for (let i = 0; i < PUFFS; i++) seed[i] = ((i * 2654435761) >>> 0) / 4294967296;
  // lamps (lit pool): the running lamp on the control panel, mains and generator on the transfer switch
  const lamp = { run: lit.slot(), mains: lit.slot(), gen: lit.slot() };
  const handle = parts.slot(), key = parts.slot();
  let spawn = 0, t = 0, setMesh = null, setBase = null, shaking = false, roof = null, roofK = 1;
  const st = { running: false, source: null, puffs: 0 };

  function lamps(f) {
    const P = GEN_PANEL, S = GEN_SWITCH, z = P.z + 0.095;
    lit.set(lamp.run, P.x + 0.12, P.y - 0.08, z, 0.035, 0.035, 0.02, f.generator?.running ? LIT.green : DIM.green);
    lit.set(lamp.mains, S.x - 0.1, S.y + 0.22, S.z + 0.095, 0.035, 0.035, 0.02, f.power?.mains ? LIT.green : DIM.green);
    lit.set(lamp.gen, S.x + 0.1, S.y + 0.22, S.z + 0.095, 0.035, 0.035, 0.02, f.power?.source === 'generator' && f.generator?.running ? LIT.amber : DIM.amber);
    // the handle points to the side that feeds the house (left: mains, right: generator)
    const toGen = f.power?.source === 'generator';
    parts.set(handle, S.x + (toGen ? 0.045 : -0.045), S.y + 0.0, S.z + 0.11, 0.035, 0.17, 0.025, 0xc23a2a, 0, 0, toGen ? -0.75 : 0.75);
    parts.set(key, P.x - 0.1, P.y - 0.08, P.z + 0.125, 0.04, 0.012, 0.012, 0xd9a520, 0, 0, f.generator?.running ? Math.PI / 2 : 0);
  }

  return {
    root, puffs, st,
    hide() {
      if (!root.visible) return;
      root.visible = false;
      for (const k of Object.values(lamp)) lit.hide(k);
      parts.hide(handle); parts.hide(key);
      if (setMesh && setBase) setMesh.position.copy(setBase);
      if (roof) { roofK = 1; roof.userData.fade.value = 1; roof.visible = true; }
    },
    update(dt, f, playerPos) {
      root.visible = true;
      t += dt;
      lamps(f);
      // the shed roof dissolves while the farmer stands at the generator (its panels on the back wall in view)
      if (!roof) roof = scene.getObjectByName('generator-roof');
      if (roof && roof.userData.fade) {
        const near = !!playerPos && Math.abs(playerPos.x - G.x) < G.w / 2 + 2.2 && playerPos.z > G.z - G.d / 2 - 0.5 && playerPos.z < G.z + G.d / 2 + 3.2;
        roofK = dt > 0 ? roofK + ((near ? 0 : 1) - roofK) * (1 - Math.exp(-dt * 5)) : near ? 0 : 1;
        roof.userData.fade.value = roofK;
        roof.visible = roofK > 0.01;
      }
      const run = !!f.generator?.running;
      st.running = run; st.source = f.power?.source ?? null;
      // the set shakes a little while it runs (still under prefers-reduced-motion)
      if (!setMesh) { setMesh = scene.getObjectByName('generator-set'); if (setMesh) setBase = setMesh.position.clone(); }
      if (setMesh && setBase) {
        shaking = run && !reducedMotion();
        if (shaking) setMesh.position.set(setBase.x + 0.004 * Math.sin(t * 157), setBase.y + 0.003 * Math.abs(Math.sin(t * 211)), setBase.z + 0.003 * Math.sin(t * 131));
        else setMesh.position.copy(setBase);
      }
      // exhaust: a puff every EVERY seconds while it runs; each rises, drifts east with the wind, grows and goes
      if (run) { spawn -= dt; if (spawn <= 0) { spawn = EVERY; const i = age.findIndex((a) => a < 0); if (i >= 0) age[i] = 0; } }
      let n = 0;
      for (let i = 0; i < PUFFS; i++) {
        if (age[i] < 0) { puffs.setMatrixAt(i, zero); continue; }
        age[i] += dt;
        const a = age[i] / LIFE;
        if (a >= 1) { age[i] = -1; puffs.setMatrixAt(i, zero); continue; }
        const s = (0.12 + 0.5 * a) * (a > 0.75 ? (1 - a) / 0.25 : 1);
        p.set(STACK.x + a * 1.1 + (seed[i] - 0.5) * 0.2, STACK.y + a * 2.2, STACK.z + (seed[i] - 0.5) * 0.3);
        puffs.setMatrixAt(i, M.compose(p, q, sc.set(s, s * 0.85, s)));
        n++;
      }
      st.puffs = n;
      puffs.instanceMatrix.needsUpdate = true;
    },
    get shaking() { return shaking; },
  };
}
