// The 3D job marker (bobbing diamond and ground ring, the Phase 1 look) and the edge pointer that
// points to it when it is off screen. Used by the level job card (ui-jobs.js); the Phase 1 sandbox
// keeps its own copy in ui-tasks.js. Owner: package "level".
import { h, setText, reducedMotion } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

function cssColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** spot = { x, z, y (gem height), gz (gem z offset) } or null (hidden). */
export function createMarker(ctx, root, { name = 'job-marker', avoid } = {}) {
  const { THREE, scene, camera } = ctx;
  const accent = new THREE.Color(cssColor('--accent', '#f28c28'));
  const marker = new THREE.Group();
  marker.name = name;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshLambertMaterial({ color: accent, emissive: accent.clone().multiplyScalar(0.45), flatShading: true, transparent: true, depthTest: false }));
  gem.scale.set(1, 1.5, 1);
  gem.renderOrder = 20;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 19;
  marker.add(gem, ring);
  marker.visible = false;
  scene.add(marker);

  const pointerIcon = h('span', { class: 'edge-arrow', html: ICONS.arrow });
  const pointerText = h('span');
  const pointer = h('div', { class: 'edge-pointer', hidden: true, 'aria-hidden': 'true' }, pointerIcon, pointerText);
  root.prepend(pointer);
  const ndc = new THREE.Vector3();
  let t = 0, rects = [], rectAge = 0, lastMetres = -1;

  function updatePointer(s, p) {
    camera.updateMatrixWorld();
    ndc.set(s.x, s.y * 0.6, s.z + s.gz).project(camera);
    let x = ndc.x, y = ndc.y;
    const behind = ndc.z > 1;
    if (behind) { x = -x; y = -y; }
    if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.94) { pointer.hidden = true; return; }
    const W = root.clientWidth, H = root.clientHeight;
    const k = Math.max(Math.abs(x) / 0.86, Math.abs(y) / (y > 0 ? 0.66 : 0.7), 1e-6);
    const px = (x / k * 0.5 + 0.5) * W;
    let py = (-y / k * 0.5 + 0.5) * H;
    if ((rectAge -= 1) <= 0) { rectAge = 30; rects = avoid ? avoid().map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0) : []; }
    for (const r of rects) if (px > r.left - 34 && px < r.right + 34 && py > r.top - 22 && py < r.bottom + 22) py = (r.top + r.bottom) / 2 < H / 2 ? r.bottom + 24 : r.top - 24;
    pointer.hidden = false;
    pointer.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) translate(-50%, -50%)`;
    pointerIcon.style.transform = `rotate(${Math.atan2(-y, x).toFixed(3)}rad)`;
    const metres = Math.round(Math.hypot(s.x - p.x, s.z - p.z));
    if (metres !== lastMetres) { lastMetres = metres; setText(pointerText, `${metres} m`); }
  }

  return {
    object3d: marker,
    /** The edge pointer element (PHASE4.md §15.4: the dead-bird chip keeps clear of it). */
    pointer,
    /** s: spot or null; p: farmer position; panelOpen: hide the pointer. */
    update(dt, s, p, panelOpen) {
      t += dt;
      marker.visible = !!s;
      if (!s) { pointer.hidden = true; return; }
      const still = reducedMotion();
      ring.position.set(0, 0.05, 0);
      marker.position.set(s.x, 0, s.z);
      gem.position.set(0, s.y + (still ? 0 : Math.sin(t * 2.4) * 0.14), s.gz);
      gem.rotation.y = still ? 0.6 : t * 1.3;
      const pulse = still ? 1 : 1 + 0.12 * Math.sin(t * 3.1);
      ring.scale.set(pulse, pulse, pulse);
      if (panelOpen) pointer.hidden = true;
      else updatePointer(s, p);
    },
    hide() { marker.visible = false; pointer.hidden = true; },
  };
}
