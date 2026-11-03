// Chick boxes: six stacks of ten that ride in the chick truck, are set down by the driver at
// SPOTS2.boxStacks (box-stack-0..5), go away on the farmer's hand truck (player.carry('boxes')),
// are tipped on the litter one after another, and end on a pile of empties by the door. All boxes
// are one InstancedMesh (one draw call). Owner: package "props".
import * as THREE from 'three';
import { SPOTS2, LEVEL1 } from './config.js';
import { BOX, chickBoxGeometry } from './props-models.js';
import { instancedParts } from './props-kit.js';

const N_STACK = LEVEL1.stacks, PER = LEVEL1.boxes / LEVEL1.stacks;
const N_PILE = LEVEL1.boxes;
const N_TIP = PER;
export const PILE = { x: -16.6, z: 7.95 };

// stack state: 'truck' (in the truck) | 'ground' | 'carried' | 'tipped'
export function buildBoxes(material, group) {
  const n = N_STACK * PER + N_PILE + N_TIP;
  const mesh = instancedParts(chickBoxGeometry(), material, n, { cast: true, color: true });
  mesh.name = 'props-chick-boxes';
  group.add(mesh);
  const S = SPOTS2.boxStacks;
  const stacks = Array.from({ length: N_STACK }, (_, i) => ({ i, state: 'truck', x: S.x + i * S.dx, z: S.z, drop: 1 }));
  let pile = 0;            // empties on the pile
  const tip = { on: false, t: 0, x: 0, z: 0, yaw: 0, stack: -1 };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const tint = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = ((i * 2654435761) >>> 0) / 4294967296;
    mesh.setColorAt(i, tint.setRGB(0.93 + r * 0.1, 0.93 + r * 0.08, 0.92 + r * 0.06));
  }

  function put(i, x, y, z, ry = 0, rx = 0, rz = 0) {
    _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
    mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s));
  }

  const truckLocal = new THREE.Vector3();
  function update(dt, truck) {
    // stacks: in the truck (behind the open doors, moving with it), set down, or gone
    const tr = truck.chick.root;
    const parked = truck.st.chicks.state === 'parked';
    let unloadIdx = 0;
    for (const st of stacks) {
      if (st.state === 'truck' && parked && truck.st.chicks.time > 1.5 + st.i * 0.55) st.state = 'ground', st.drop = 0;
      for (let k = 0; k < PER; k++) {
        const i = st.i * PER + k;
        if (st.state === 'truck') {
          if (!tr.visible) { mesh.setMatrixAt(i, zero); continue; }
          // two rows of three stacks just inside the doors
          truckLocal.set(-3.2 + Math.floor(st.i / 2) * 0.65, 1.04 + k * BOX.h, (st.i % 2 ? 0.35 : -0.35));
          truckLocal.applyMatrix4(tr.matrixWorld);
          put(i, truckLocal.x, truckLocal.y, truckLocal.z, tr.rotation.y + Math.PI / 2);
        } else if (st.state === 'ground') {
          st.drop = Math.min(1, st.drop + dt * 2.2);
          const lift = (1 - st.drop) * 0.4;
          put(i, st.x, 0.03 + k * BOX.h + lift, st.z, Math.PI / 2 + ((k * 7 + st.i) % 3 - 1) * 0.03);
        } else mesh.setMatrixAt(i, zero);
      }
      if (st.state === 'ground') unloadIdx++;
    }
    // the pile of empties by the door: nested in leaning stacks of up to 12
    for (let k = 0; k < N_PILE; k++) {
      const i = N_STACK * PER + k;
      if (k >= pile) { mesh.setMatrixAt(i, zero); continue; }
      const col = Math.floor(k / 12), h = k % 12;
      put(i, PILE.x + (col % 3) * 0.66 - 0.66, 0.03 + h * 0.06, PILE.z + Math.floor(col / 3) * 0.5, Math.PI / 2 + (col % 2) * 0.08, 0, (h % 2) * 0.03);
    }
    // tipping: ten boxes set down in front of the farmer, tipped one after another
    for (let k = 0; k < N_TIP; k++) {
      const i = N_STACK * PER + N_PILE + k;
      if (!tip.on) { mesh.setMatrixAt(i, zero); continue; }
      const c = Math.cos(tip.yaw), s = Math.sin(tip.yaw);
      const u = (k % 5 - 2) * 0.66, v = -0.7 - Math.floor(k / 5) * 0.52;
      const x = tip.x + u * c + v * s, z = tip.z - u * s + v * c;
      const t0 = 0.15 + k * 0.16, f = Math.max(0, Math.min(1, (tip.t - t0) / 0.35));
      const back = Math.max(0, Math.min(1, (tip.t - t0 - 0.6) / 0.3));
      const a = Math.sin(f * Math.PI * 0.5) * 1.9 * (1 - back * 0.98);
      put(i, x, 0.03 + Math.sin(a) * BOX.d * 0.5, z, tip.yaw, -a);
    }
    if (tip.on) {
      tip.t += dt;
      if (tip.t > 0.15 + N_TIP * 0.16 + 1.2) { tip.on = false; pile = Math.min(N_PILE, pile + PER); }
    }
    mesh.instanceMatrix.needsUpdate = true;
    return unloadIdx;
  }

  return {
    mesh, stacks,
    get pile() { return pile; },
    set pile(v) { pile = Math.max(0, Math.min(N_PILE, v | 0)); },
    get tipping() { return tip.on; },
    startTip(stack, x, z, yaw) { Object.assign(tip, { on: true, t: 0, x, z, yaw, stack }); },
    reset() { for (const st of stacks) { st.state = 'truck'; st.drop = 1; } pile = 0; tip.on = false; },
    update,
  };
}
