// Yard lights: street-light poles, gate pillar lamps and wall lamps. At night the lamp heads glow,
// with a soft halo and a warm pool of light on the ground (decals, no real lights, so the
// shaders stay cheap). Owner: world agent.
import * as THREE from 'three';
import { FARM } from './config.js';
import { GeoBuilder, unitSphere } from './world-util.js';
import { GATE, F } from './world-layout.js';

const POLE = 0x9aa1a6;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildLamps(group, mats, colliders) {
  const poles = new GeoBuilder(), heads = new GeoBuilder(), pools = new GeoBuilder({ uv: true });
  const glowPos = [];
  const lamp = (x, y, z, poolR, r = 0.16) => {
    heads.add(unitSphere(8, 5), 0xffffff, { x, y, z, sx: r * 1.4, sy: r * 0.7, sz: r * 1.4 });
    glowPos.push(x, y - 0.05, z);
    pools.quad([x - poolR, 0.075, z - poolR], [x - poolR, 0.075, z + poolR], [x + poolR, 0.075, z + poolR], [x + poolR, 0.075, z - poolR], 0xffffff, [0, 0, 0, 1, 1, 1, 1, 0]);
  };
  // Street-light pole with a curved arm reaching toward the road
  const pole = (x, z, dirX, dirZ) => {
    poles.cyl(0.14, 0.3, x, 0, z, 0xbdb7aa, 8);
    poles.cyl(0.075, 6.0, x, 0.3, z, POLE, 8, { top: 0.7 });
    poles.pipe(x, 5.9, z, x + dirX * 0.9, 6.35, z + dirZ * 0.9, 0.04, POLE, 5);
    poles.pipe(x + dirX * 0.9, 6.35, z + dirZ * 0.9, x + dirX * 1.6, 6.3, z + dirZ * 1.6, 0.04, POLE, 5);
    poles.box(0.5, 0.12, 0.26, x + dirX * 1.75, 6.2, z + dirZ * 1.75, 0x5c6266);
    lamp(x + dirX * 1.75, 6.14, z + dirZ * 1.75, 7);
    colliders.push({ type: 'circle', x, z, r: 0.2 });
  };
  pole(-43.6, 11.2, 0.7, 0.7);
  pole(-11, 17.6, 0, -1);
  pole(12, 17.6, 0, -1);
  pole(35.6, 19.6, -0.6, -0.8);
  pole(-23.6, -12.6, 0.7, 0.7);
  pole(-43.8, 19.4, 1, 0);
  // gate pillar lamps
  for (const x of [GATE.x0 - 0.25, GATE.x1 + 0.25]) {
    poles.cyl(0.05, 0.22, x, 3.0, F.zMax, 0x3a3e42, 6);
    lamp(x, 3.32, F.zMax, 4, 0.17);
  }
  // wall lamps: office door, guard hut, generator shed
  const O = FARM.office, H = FARM.guardHut, G = FARM.generator;
  lamp(O.x - O.w / 2 + 1.4, 2.42, O.z + O.d / 2 + 0.18, 3.5, 0.11);
  lamp(H.x + H.w / 2 + 0.15, 2.3, H.z + 0.4, 3.5, 0.1);
  lamp(G.x, 2.55, G.z + 0.2, 3.2, 0.1);

  group.add(poles.mesh(mats.flatFade, { name: 'lamp-poles' }));
  const headMat = new THREE.MeshBasicMaterial({ color: 0x8c8c86 });
  const headMesh = heads.mesh(headMat, { cast: false, receive: false, name: 'lamp-heads' });
  group.add(headMesh);
  const tex = glowTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffc77a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolMesh = pools.mesh(poolMat, { cast: false, receive: false, name: 'lamp-pools' });
  poolMesh.renderOrder = 1;
  group.add(poolMesh);
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
  const glowMat = new THREE.PointsMaterial({ map: tex, color: 0xffd9a0, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Points(gGeo, glowMat);
  glow.name = 'lamp-glow';
  glow.renderOrder = 3;
  group.add(glow);

  const off = new THREE.Color(0x8c8c86), on = new THREE.Color(0xfff1c8);
  let last = -1;
  return {
    // night: 0 (day) .. 1 (full night)
    update(night) {
      const k = Math.max(0, Math.min(1, (night - 0.15) / 0.5));
      if (Math.abs(k - last) < 1e-3) return;
      last = k;
      headMat.color.copy(off).lerp(on, k);
      poolMat.opacity = 0.55 * k;
      glowMat.opacity = 0.9 * k;
      poolMesh.visible = glow.visible = k > 0.01;
    },
  };
}
