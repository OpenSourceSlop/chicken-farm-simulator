// Gas pancake brooders over the brooding area: steel canopy on a chain, ceramic burner glowing
// orange with env.heaterLevel, gas hose from a yellow gas line, a warm additive glow on the litter
// under each brooder. Also the translucent brooding curtain across the house. Owner: house agent.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, HEATERS, HEATER_HEIGHT, HOUSE, HOUSE_BOUNDS } from './config.js';
import { Batch, mat, lathe, canvasTexture, smooth } from './house-kit.js';
import { TRUSS_Y, T } from './house-shell.js';

const { xMin, zMin, zMax } = HOUSE_BOUNDS;
const HH = HEATER_HEIGHT;
const RIM_R = 0.46;
const GAS = 0xe2b33c, STEEL = 0x8f989f, CHAIN = 0x5d646a, HOSE = 0x2e2b28;

function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.65, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

function addChain(b, x, z, y0, y1) {
  const link = 0.042;
  for (let y = y0, i = 0; y < y1; y += link * 0.82, i++) {
    b.box(0.024, link, 0.007, x, y + link / 2, z, CHAIN, i % 2 ? Math.PI / 2 : 0);
  }
}

export function buildBrooders(kit) {
  const { stat, group, mats } = kit;
  const canopy = lathe('brooder', [
    [RIM_R, 0], [RIM_R - 0.03, 0.035], [0.3, 0.11], [0.13, 0.2], [0.06, 0.225], [0, 0.23],
    [0, 0.2], [0.13, 0.17], [0.3, 0.08], [RIM_R - 0.04, 0.0], [RIM_R - 0.02, -0.025], [RIM_R, 0],
  ], 16);
  const rib = new THREE.TorusGeometry(0.3, 0.012, 4, 16);
  const burners = new Batch();
  const glowGeos = [];
  const xs = [...new Set(HEATERS.map((h) => h.x))];
  const xEnd = Math.max(...xs) + 1.3;
  const xGas = xMin + 0.5;

  for (const s of [-1, 1]) {
    const hz = s * Math.abs(HEATERS[0].z);
    const zp = hz - s * 0.16;
    stat.bar([xMin + 0.1, TRUSS_Y - 0.05, hz], [xEnd, TRUSS_Y - 0.05, hz], 0.04, STEEL);  // support bar
    stat.rod([xGas, TRUSS_Y - 0.17, zp], [xEnd - 0.2, TRUSS_Y - 0.17, zp], 0.017, GAS, 6); // gas line
    for (let x = xGas + 1; x < xEnd; x += 3) stat.rod([x, TRUSS_Y - 0.17, zp], [x, TRUSS_Y - 0.05, hz], 0.006, CHAIN, 4);
  }
  // gas header: in through the north wall, across to both lines, valve box outside
  const z1 = Math.abs(HEATERS[0].z) - 0.16;
  stat.rod([xGas, TRUSS_Y - 0.17, zMin - T - 0.3], [xGas, TRUSS_Y - 0.17, z1], 0.02, GAS, 6);
  stat.rod([xGas, TRUSS_Y - 0.17, zMin - T - 0.3], [xGas, 0.5, zMin - T - 0.3], 0.02, GAS, 6);
  stat.box(0.2, 0.26, 0.14, xGas, 0.42, zMin - T - 0.3, 0xd6a531);
  stat.box(0.05, 0.04, 0.16, xGas, 0.6, zMin - T - 0.36, 0xd8322f);
  stat.rod([xGas, 0.3, zMin - T - 0.3], [xGas, 0.0, zMin - T - 0.3], 0.02, GAS, 6);

  for (const h of HEATERS) {
    const s = Math.sign(h.z);
    stat.add(canopy, COLORS.heater, mat(h.x, HH, h.z));
    stat.add(rib, 0x7f888e, mat(h.x, HH + 0.112, h.z, Math.PI / 2, 0, 0));
    stat.cyl(0.075, 0.1, h.x, HH + 0.29, h.z, 0x6f787f, 8);                     // valve housing
    stat.box(0.05, 0.05, 0.08, h.x + 0.08, HH + 0.3, h.z, 0xb08d3c);
    stat.add(new THREE.TorusGeometry(0.03, 0.008, 4, 8), CHAIN, mat(h.x, HH + 0.37, h.z));
    addChain(stat, h.x, h.z, HH + 0.38, TRUSS_Y - 0.07);
    // gas hose: from a tap on the gas line, sagging down to the valve housing
    const zp = h.z - s * 0.16;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(h.x + 0.3, TRUSS_Y - 0.2, zp),
      new THREE.Vector3(h.x + 0.42, TRUSS_Y - 0.55, zp + s * 0.03),
      new THREE.Vector3(h.x + 0.32, HH + 0.62, h.z - s * 0.05),
      new THREE.Vector3(h.x + 0.1, HH + 0.32, h.z),
    ]);
    stat.add(new THREE.TubeGeometry(curve, 14, 0.011, 5), HOSE);
    stat.box(0.05, 0.05, 0.05, h.x + 0.3, TRUSS_Y - 0.19, zp, 0xb08d3c);
    // ceramic burner under the canopy, with a hot rim
    burners.cyl(0.2, 0.05, h.x, HH + 0.07, h.z, 0xffffff, 16);
    burners.add(new THREE.TorusGeometry(RIM_R - 0.03, 0.012, 4, 24), 0x9a6040, mat(h.x, HH - 0.005, h.z, Math.PI / 2, 0, 0));
    const pg = new THREE.PlaneGeometry(4.6, 4.6);
    pg.rotateX(-Math.PI / 2);
    pg.translate(h.x, 0.032, h.z);
    glowGeos.push(pg);
  }

  const burnerMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0x6a4030, emissive: COLORS.heaterGlow, emissiveIntensity: 0 });
  group.add(burners.mesh(burnerMat, { cast: false, receive: false }));

  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTexture(), color: COLORS.heaterGlow, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const glow = new THREE.Mesh(mergeGeometries(glowGeos), glowMat);
  glow.renderOrder = 1;
  glow.visible = false;
  group.add(glow);

  // brooding curtain: clear plastic sheet with loose folds, on a wire under the trusses
  const cg = new THREE.PlaneGeometry(zMax - zMin, 2.62, 72, 1);
  cg.rotateY(Math.PI / 2);
  const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const z = cp.getZ(i), y = cp.getY(i);
    cp.setX(i, 0.05 * Math.sin(z * 6.3) + 0.025 * Math.sin(z * 17.1 + 1.3) + (y < -1.2 ? 0.04 : 0));
  }
  cg.computeVertexNormals();
  const curtainMat = new THREE.MeshLambertMaterial({
    color: 0xe4eef3, emissive: 0x67737a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
  });
  const curtain = new THREE.Group();
  const sheet = new THREE.Mesh(cg, curtainMat);
  sheet.position.set(HOUSE.broodCurtainX, 1.31, 0);
  const wire = new Batch();
  wire.rod([HOUSE.broodCurtainX, 2.63, zMin], [HOUSE.broodCurtainX, 2.63, zMax], 0.012, 0x6d757c, 4);
  for (let z = zMin + 0.4; z < zMax; z += 0.8) wire.cyl(0.018, 0.03, HOUSE.broodCurtainX, 2.6, z, 0xd8dcdf, 6);
  wire.box(0.07, 0.035, zMax - zMin - 0.1, HOUSE.broodCurtainX + 0.04, 0.035, 0, 0xc9d3d8);   // weighted hem on the litter
  curtain.add(sheet, wire.mesh(mats.vc, { cast: false }));
  curtain.renderOrder = 2;
  group.add(curtain);

  let level = 0, curtainK = 1;
  return {
    update(dt, env) {
      level = env.heaterLevel;
      burnerMat.emissiveIntensity = 2.2 * level;
      glow.visible = level > 0.01;
      glowMat.opacity = 0.42 * level;
      curtainK = smooth(curtainK, env.broodCurtain ? 1 : 0, 2.5, dt);
      curtain.visible = curtainK > 0.01;
      curtainMat.opacity = 0.5 * curtainK;
    },
  };
}
