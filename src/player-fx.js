// Small ground effects for the farmer: the click-to-walk target ring and running dust puffs.
import * as THREE from 'three';

const RING_LIFE = 1.6;

export function createTargetMarker(scene) {
  const common = {
    transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  };
  const light = new THREE.MeshBasicMaterial({ color: 0xfffbea, ...common });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1d2a22, ...common });
  const group = new THREE.Group();
  group.name = 'walkTarget';
  const flat = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m; };
  const ring = new THREE.Group();
  ring.add(flat(new THREE.RingGeometry(0.27, 0.47, 32), dark), flat(new THREE.RingGeometry(0.31, 0.43, 32), light));
  const dot = new THREE.Group();
  dot.add(flat(new THREE.CircleGeometry(0.1, 14), dark), flat(new THREE.CircleGeometry(0.065, 14), light));
  for (const g of [ring, dot]) { g.children[1].position.y = 0.002; g.children[1].renderOrder = 3; }
  group.add(ring, dot);
  group.visible = false;
  scene.add(group);
  const st = { t: RING_LIFE };

  return {
    group,
    show(x, z) {
      group.position.set(x, 0.035, z);
      st.t = 0;
      group.visible = true;
    },
    // Fade quickly (arrived or cancelled).
    hide() { if (group.visible) st.t = Math.max(st.t, RING_LIFE - 0.25); },
    // size: world scale so the ring keeps a similar size on screen at any zoom
    update(dt, size = 1) {
      if (!group.visible) return;
      st.t += dt;
      if (st.t >= RING_LIFE) { group.visible = false; light.opacity = dark.opacity = 0; return; }
      const pop = Math.min(1, st.t / 0.22);
      group.scale.setScalar(size);
      ring.scale.setScalar(1 + 0.7 * (1 - pop) * (1 - pop));
      const fade = Math.max(0, st.t < 0.8 ? 1 : 1 - (st.t - 0.8) / (RING_LIFE - 0.8));
      light.opacity = 0.95 * fade;
      dark.opacity = 0.4 * fade;
    },
  };
}

const PUFFS = 16;
const PUFF_LIFE = 0.75;

export function createDust(scene) {
  const geo = new THREE.IcosahedronGeometry(0.13, 0);
  const pool = [];
  for (let i = 0; i < PUFFS; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xd8c7a2, transparent: true, opacity: 0, depthWrite: false, flatShading: true });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.name = 'dust';
    scene.add(m);
    pool.push({ m, t: PUFF_LIFE, vx: 0, vz: 0, vy: 0, s: 1 });
  }
  let next = 0;

  return {
    // A couple of puffs where a boot hits the ground; (dirX, dirZ) is the running direction.
    puff(x, z, dirX, dirZ, strength = 1) {
      for (let k = 0; k < 2; k++) {
        const p = pool[next];
        next = (next + 1) % PUFFS;
        const side = (Math.random() - 0.5) * 1.2;
        p.m.position.set(x + (Math.random() - 0.5) * 0.12, 0.06, z + (Math.random() - 0.5) * 0.12);
        p.vx = -dirX * 0.5 + dirZ * side;
        p.vz = -dirZ * 0.5 - dirX * side;
        p.vy = 0.35 + Math.random() * 0.25;
        p.s = (0.55 + Math.random() * 0.35) * strength;
        p.t = 0;
        p.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        p.m.visible = true;
      }
    },
    update(dt) {
      for (const p of pool) {
        if (!p.m.visible) continue;
        p.t += dt;
        if (p.t >= PUFF_LIFE) { p.m.visible = false; continue; }
        const u = p.t / PUFF_LIFE;
        const drag = Math.exp(-3 * dt);
        p.vx *= drag; p.vz *= drag; p.vy *= drag;
        p.m.position.x += p.vx * dt;
        p.m.position.y += p.vy * dt;
        p.m.position.z += p.vz * dt;
        p.m.scale.setScalar(p.s * (0.45 + 0.9 * Math.sqrt(u)));
        p.m.material.opacity = 0.62 * (1 - u) * (1 - u);
      }
    },
  };
}
