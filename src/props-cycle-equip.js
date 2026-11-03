// Phase 3 equipment the farmer reads and works (PHASE3.md §12 items 2, 4-7): the guard hut bench and
// clothes rack, the brooding curtain winch, the fan panel (six lamps, the pad pump lamp and an air-speed
// display; a broken fan's lamp stays on), the pad pump box outside the west end, the white LPG tank with
// its gauge, the two silo slide valves on the boots. Static parts go into the props' static batch; lamps,
// handles and needles into the shared box pool. Owner: package "scene".
import * as THREE from 'three';
import { FARM, SPOTS2, SPOTS3, HOUSE, HOUSE_BOUNDS, FAN_COUNT } from './config.js';
import { WATER } from './props-equip.js';
import { Batch, mat, placer, canvasTexture, FONT, clamp01, lerp } from './props-kit.js';
import { hutRack, lpgTank } from './props-cycle-models.js';

const STEEL = 0x8f989f, BOX = 0x9da3a8, BOX_FACE = 0xb3b9bd, GAS = 0xe2b33c;
const { xMin, zMin } = HOUSE_BOUNDS;
const T = HOUSE.wallThickness;
const GAS_TANK_KG = 500;   // the farm's tank at the start of the flock (model; the gauge reads gasKg against it)

function lcd() {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 64;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t, last: '' };
}
function drawLcd(d, text) {
  if (d.last === text) return;
  d.last = text;
  const g = d.g;
  g.fillStyle = '#9fc59a'; g.fillRect(0, 0, 192, 64);
  g.fillStyle = '#1e3a2a'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 96, 34);
  d.t.needsUpdate = true;
}

export function buildCycleEquipment(stat, pool, group) {
  const tabSpots = new Map(), colliders = [];
  const hasDoc = typeof document !== 'undefined';

  // ---------------- guard hut: bench and clothes rack on the east side, under the eave ----------------
  {
    const H = FARM.guardHut, x1 = H.x + H.w / 2;
    const b = new Batch(); hutRack(b);
    stat.add(b.geometry(), null, mat(x1 + 0.25, 0, SPOTS3.guardHut.z - 0.15));
    tabSpots.set('guard-hut', { x: x1 + 0.3, y: 1.95, z: SPOTS3.guardHut.z + 0.5, ry: Math.PI / 2, rx: 0 });
  }

  // ---------------- curtain winch on the north wall beside the curtain ----------------
  const W = SPOTS3.curtainWinch, wz = zMin + 0.2;
  stat.box(0.08, 2.6, 0.08, W.x + 0.3, 1.3, zMin + 0.06, STEEL);                  // post (stays when the wall drops)
  stat.box(0.34, 0.4, 0.22, W.x + 0.3, 1.15, wz + 0.04, 0x6d7a5a);                // gearbox
  stat.add(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), 0x5f676d, mat(W.x + 0.3, 1.45, wz + 0.04, 0, 0, Math.PI / 2)); // drum
  stat.rod([W.x + 0.3, 1.5, wz + 0.04], [HOUSE.broodCurtainX, 2.6, wz - 0.02], 0.006, 0x3a3e42, 3); // cable to the wire
  stat.box(0.05, 0.05, 0.12, W.x + 0.3, 1.15, wz + 0.2, 0x3a3e42);                // crank shaft
  const crank = pool.slot(), crankKnob = pool.slot();
  tabSpots.set('curtain-winch', { x: W.x + 0.3, y: 1.6, z: wz + 0.2, ry: 0, rx: 0 });

  // ---------------- fan panel on the north wall at the fan end ----------------
  const F = SPOTS3.fanPanel, fz = zMin + 0.2;
  stat.box(0.08, 2.6, 0.08, F.x, 1.3, zMin + 0.06, STEEL);
  stat.box(0.86, 0.62, 0.18, F.x, 1.45, fz + 0.04, BOX);
  stat.box(0.82, 0.58, 0.01, F.x, 1.45, fz + 0.135, BOX_FACE);
  stat.box(0.7, 0.06, 0.012, F.x, 1.7, fz + 0.142, 0x2f5d8a);                     // brand strip
  for (let i = 0; i < FAN_COUNT; i++) {                                            // fan switches under the lamps
    stat.add(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), 0x2b2f33, mat(F.x - 0.3 + i * 0.12, 1.36, fz + 0.15, Math.PI / 2, 0, 0));
  }
  stat.add(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), 0x2b2f33, mat(F.x + 0.3, 1.24, fz + 0.15, Math.PI / 2, 0, 0)); // pad pump switch
  stat.rod([F.x + 0.3, 1.76, fz + 0.04], [F.x + 0.3, 2.66, fz + 0.04], 0.016, 0x80888e, 6); // conduit
  const fanLamps = Array.from({ length: FAN_COUNT }, () => pool.slot()), padLamp = pool.slot();
  let speedLcd = null, speedFace = null;
  if (hasDoc) {
    speedLcd = lcd();
    drawLcd(speedLcd, '0.0 m/s');
    speedFace = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: speedLcd.t, toneMapped: false }));
    speedFace.position.set(F.x - 0.18, 1.58, fz + 0.142);
    speedFace.name = 'props-fan-panel-lcd';
    group.add(speedFace);
  }
  tabSpots.set('fan-panel', { x: F.x + 0.3, y: 1.9, z: fz + 0.15, ry: 0, rx: 0 });

  // ---------------- pad pump box outside the west end ----------------
  const P = SPOTS3.padPump;
  const PP = placer(stat, P.x, P.z, -Math.PI / 2 + 0.55);
  PP.box(0.07, 1.3, 0.07, 0, 0.65, -0.12, STEEL);
  PP.box(0.42, 0.5, 0.18, 0, 1.15, 0, 0x2f6f8f);
  PP.box(0.38, 0.46, 0.01, 0, 1.15, 0.095, 0x3f84a6);
  PP.box(0.3, 0.05, 0.012, 0, 1.33, 0.1, 0xf4f1ea);
  PP.add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), 0x2b2f33, 0.1, 1.05, 0.11, Math.PI / 2, 0, 0);   // pump switch
  PP.add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), 0x2b2f33, -0.1, 1.05, 0.11, Math.PI / 2, 0, 0); // flush valve knob
  stat.rod([P.x + 0.1, 0.9, P.z], [xMin - T - 0.05, 0.9, P.z], 0.016, 0x80888e, 5);   // conduit to the pad
  // distribution pipe flush valve on the riser at the north-west corner
  stat.rod([xMin - T - 0.15, 0.2, zMin + 0.4], [xMin - T - 0.15, 2.5, zMin + 0.4], 0.035, 0x3a78b5, 8);
  stat.box(0.1, 0.1, 0.1, xMin - T - 0.15, 1.2, zMin + 0.4, 0xd8322f);
  const pumpLamp = pool.slot(), floatLamp = pool.slot();
  const ppLamp = PP.P(0.12, 0.11), ppFloat = PP.P(-0.12, 0.11);
  tabSpots.set('pad-pump', { x: PP.P(0, 0.12)[0], y: 1.56, z: PP.P(0, 0.12)[1], ry: -Math.PI / 2 + 0.55, rx: 0 });
  colliders.push({ type: 'circle', x: P.x, z: P.z, r: 0.3 });

  // ---------------- LPG tank on legs, north-west of the house ----------------
  const G = SPOTS3.gasTank;
  {
    const b = new Batch(); lpgTank(b);
    stat.add(b.geometry(), null, mat(G.x, 0, G.z - 0.6));
    // gas line to the brooders' valve box on the north wall (house-brooders.js)
    const vx = xMin + 0.5, vz = zMin - T - 0.3;
    stat.rod([G.x + 0.95, 0.45, G.z - 0.6], [G.x + 1.3, 0.12, G.z - 0.6], 0.025, GAS, 5);
    stat.rod([G.x + 1.3, 0.12, G.z - 0.6], [vx, 0.12, G.z - 0.6], 0.025, GAS, 5);
    stat.rod([vx, 0.12, G.z - 0.6], [vx, 0.12, vz - 0.12], 0.025, GAS, 5);
    stat.box(2.6, 0.06, 1.4, G.x, 0.03, G.z - 0.6, 0xc9c4b8);                     // concrete plinth
  }
  const gasNeedle = pool.slot();
  const gaugeAt = { x: G.x + 0.1, y: 0.95 + 0.55 + 0.2, z: G.z - 0.6 + 0.052 };
  tabSpots.set('gas-tank', { x: G.x - 0.6, y: 1.9, z: G.z - 0.1, ry: 0, rx: 0 });
  colliders.push({ type: 'box', minX: G.x - 1.25, maxX: G.x + 1.25, minZ: G.z - 1.2, maxZ: G.z });

  // ---------------- loading bay: the ticket box on a post by the truck stop ----------------
  const LB = SPOTS3.loadingBay;
  stat.box(0.08, 1.35, 0.08, LB.x, 0.675, LB.z - 0.05, STEEL);
  stat.box(0.44, 0.34, 0.16, LB.x, 1.32, LB.z, 0x2f6fb5);
  stat.box(0.34, 0.24, 0.01, LB.x, 1.33, LB.z + 0.085, 0xf4f1ea);
  for (let k = 0; k < 4; k++) stat.box(0.26, 0.012, 0.004, LB.x, 1.4 - k * 0.05, LB.z + 0.09, 0x9aa7b5);
  tabSpots.set('loading-bay', { x: LB.x + 0.2, y: 1.66, z: LB.z + 0.1, ry: 0, rx: 0 });
  colliders.push({ type: 'circle', x: LB.x, z: LB.z, r: 0.2 });
  // plates without a 3D object of their own: the vaccine and medicine tabs on the water supply, the
  // planning sheet on the office desk
  {
    const c = Math.cos(WATER.face), s = Math.sin(WATER.face), at = (u) => ({ x: WATER.x + u * c, z: WATER.z - u * s });
    tabSpots.set('vaccine', { ...at(0.15), y: 2.05, ry: WATER.face, rx: 0 });
    tabSpots.set('medicator', { ...at(-0.3), y: 2.05, ry: WATER.face, rx: 0 });
    const O = SPOTS2.officeDesk;
    tabSpots.set('plan-sheet', { x: O.x - 0.3, y: 1.15, z: O.z + 1.15, ry: 0, rx: 0 });
  }

  // ---------------- silo slide valves on the boots ----------------
  const valves = FARM.silos.map((s) => {
    stat.box(0.42, 0.08, 0.06, s.x, 0.86, s.z + 0.2, 0x6d757c);                     // guide
    return { x: s.x, z: s.z + 0.24, plate: pool.slot(), handle: pool.slot() };
  });

  let t = 0, crankA = 0, lcdT = 0;
  const lampOn = 0x6be36b, lampOff = 0x2f4f2f;
  return {
    tabSpots, colliders,
    /** test hooks */
    get lcdText() { return speedLcd ? speedLcd.last : null; },
    update(dt, farm, env, roll) {
      t += dt;
      // the winch crank turns while the curtain moves (house-brooders' roll changes)
      if (roll && roll.moving) crankA += dt * 6;
      pool.set(crank, W.x + 0.3 + Math.cos(crankA) * 0.07, 1.15 + Math.sin(crankA) * 0.07, wz + 0.27, 0.025, 0.16, 0.025, 0x3a3e42, 0, 0, -crankA + Math.PI / 2);
      pool.set(crankKnob, W.x + 0.3 + Math.cos(crankA) * 0.14, 1.15 + Math.sin(crankA) * 0.14, wz + 0.31, 0.04, 0.04, 0.06, 0xd8322f);
      // fan panel: a lamp per fan that has power (a broken fan's lamp is on too: its belt is the fault)
      for (let i = 0; i < FAN_COUNT; i++) {
        const on = i < (env.fansOn ?? 0);
        pool.set(fanLamps[i], F.x - 0.3 + i * 0.12, 1.47, fz + 0.15, 0.045, 0.045, 0.02, on ? lampOn : lampOff);
      }
      pool.set(padLamp, F.x + 0.3, 1.36, fz + 0.15, 0.045, 0.045, 0.02, env.padOn ? 0x4fb3e8 : 0x2a3f4f);
      if (speedFace && (lcdT -= dt) <= 0) { lcdT = 0.5; drawLcd(speedLcd, `${(env.airSpeed ?? 0).toFixed(1)} m/s`); }
      // pad pump box: running lamp; the amber lamp while the float valve is stuck (water over the sump)
      pool.set(pumpLamp, ppLamp[0], 1.22, ppLamp[1], 0.04, 0.04, 0.04, env.padOn ? lampOn : lampOff);
      const stuck = !!farm.house?.padFloatStuck;
      pool.set(floatLamp, ppFloat[0], 1.22, ppFloat[1], 0.04, 0.04, 0.04, stuck && (t % 1.2) < 0.7 ? 0xffb43a : 0x5a4a2a);
      // gas gauge: the share of the tank left
      const used = farm.stats?.gasKg ?? 0;
      const k = clamp01(1 - used / GAS_TANK_KG), a = lerp(-2.2, 2.2, k);
      pool.set(gasNeedle, gaugeAt.x + Math.sin(a) * 0.03, gaugeAt.y + Math.cos(a) * 0.03, gaugeAt.z, 0.008, 0.065, 0.004, 0x1e1e1e, 0, 0, -a);
      // silo slide valves: the plate slides out of the boot as the valve opens (0, half, full)
      const vs = farm.feed?.valves || [1, 0];
      valves.forEach((v, i) => {
        const o = clamp01(vs[i] ?? 0);
        pool.set(v.plate, v.x - 0.12 + 0.24 * o, 0.86, v.z, 0.3, 0.03, 0.05, 0xb4bcc2);
        pool.set(v.handle, v.x - 0.28 + 0.24 * o, 0.86, v.z + 0.02, 0.04, 0.12, 0.04, 0xd8322f);
      });
    },
  };
}
