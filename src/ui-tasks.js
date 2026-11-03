// "Today's jobs": the task list, its auto-completion and the 3D marker over the current job.
// Owner: systems/UI agent.
import { HEATERS, HEATER_HEIGHT, SPOTS } from './config.js';
import { TASKS, TASKS_DONE_LINE } from './content.js';
import { h, setText, uniqueId, reducedMotion } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

// Job 4 counts while the farmer stands within WATCH_RADIUS of a brooder with no panel open (the
// two boards are more than 2 m from the nearest brooder, so reading them does not count). It needs
// WATCH_SECONDS, and the house within WARM_BAND of the setpoint so the chicks have really moved;
// after WATCH_MAX seconds of watching it counts anyway.
const WATCH_RADIUS = 2.0;   // metres from a brooder
const WATCH_SECONDS = 8;    // real seconds
const WATCH_MAX = 25;       // real seconds
const WARM_BAND = 1.0;      // °C

function cssColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

// avoid(): HUD elements the edge pointer must not hide under.
export function createTasks(parent, ctx, { player, root, avoid }) {
  const { THREE, scene, camera } = ctx;
  let index = 0;            // current task; TASKS.length = all done
  let watched = 0;          // seconds spent near a brooder during task 4
  const flags = { sign: false, setpoint: false };

  // ---------- DOM ----------
  const titleId = uniqueId('jobs-title');
  const count = h('span', { class: 'jobs-count' });
  const list = h('ol', { class: 'jobs-list' });
  const doneLine = h('p', { class: 'jobs-done', hidden: true }, TASKS_DONE_LINE);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const card = h('section', { class: 'card jobs', 'aria-labelledby': titleId },
    h('header', { class: 'jobs-head' },
      h('span', { class: 'jobs-icon', html: ICONS.clipboard, 'aria-hidden': 'true' }),
      h('h2', { class: 'label', id: titleId }, 'Today’s jobs'), count),
    list, doneLine, live);
  parent.appendChild(card);

  const items = TASKS.map((t, i) => {
    const mark = h('span', { class: 'job-mark', 'aria-hidden': 'true' });
    const where = h('p', { class: 'job-where' }, h('span', { html: ICONS.pin, 'aria-hidden': 'true' }), h('span', null, t.where));
    const bar = h('span', { class: 'job-bar' });
    const progress = h('div', { class: 'job-progress', hidden: true, 'aria-hidden': 'true' }, bar);
    const state = h('span', { class: 'sr-only' });
    const li = h('li', { class: 'job' }, mark,
      h('div', { class: 'job-body' }, h('p', { class: 'job-title' }, state, t.title), where, progress));
    list.appendChild(li);
    return { li, mark, where, progress, bar, state, n: i + 1 };
  });

  function render() {
    items.forEach((it, i) => {
      const done = i < index, current = i === index;
      it.li.classList.toggle('is-done', done);
      it.li.classList.toggle('is-current', current);
      if (current) it.li.setAttribute('aria-current', 'step'); else it.li.removeAttribute('aria-current');
      it.mark.innerHTML = done ? ICONS.check : String(it.n);
      setText(it.state, done ? 'Done: ' : current ? 'Now: ' : 'Later: ');
      it.li.classList.toggle('is-later', i > index + 1);
      it.where.hidden = !current;
      it.progress.hidden = !(current && i === 3);
    });
    setText(count, `${Math.min(index, TASKS.length)} / ${TASKS.length}`);
    doneLine.hidden = index < TASKS.length;
    card.classList.toggle('is-all-done', index >= TASKS.length);
  }

  function complete() {
    const done = TASKS[index];
    const li = items[index].li;
    index++;
    li.classList.remove('just-done');
    void li.offsetWidth; // restart the flash
    li.classList.add('just-done');
    clearTimeout(li.__doneTimer);
    li.__doneTimer = setTimeout(() => li.classList.remove('just-done'), 2400); // then it folds into the count
    live.textContent = index < TASKS.length ? `Done: ${done.title}. Next: ${TASKS[index].title}.` : `Done: ${done.title}. ${TASKS_DONE_LINE}`;
    render();
  }

  // ---------- 3D marker: a bobbing diamond and a ground ring over the current job ----------
  // Same orange as the HUD: read the --accent token so there is one source for the colour.
  const accent = new THREE.Color(cssColor('--accent', '#f28c28'));
  const marker = new THREE.Group();
  marker.name = 'task-marker';
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshLambertMaterial({ color: accent, emissive: accent.clone().multiplyScalar(0.45), flatShading: true, transparent: true, depthTest: false }),
  );
  gem.scale.set(1, 1.5, 1);
  gem.renderOrder = 20;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.68, 40),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 19;
  marker.add(gem, ring);
  scene.add(marker);

  function nearestHeater(p) {
    let best = HEATERS[0], bd = Infinity;
    for (const ht of HEATERS) {
      const d = Math.hypot(ht.x - p.x, ht.z - p.z);
      if (d < bd) { bd = d; best = ht; }
    }
    return { heater: best, dist: bd };
  }

  // Where the marker sits for each job: x, z of the ground ring, gem height, gem offset in z.
  // Wall boards: the ring sits on the floor in front of the board (toward the house middle), the
  // gem over the board itself.
  const front = (spot) => (spot.z < 0 ? 1 : -1);
  function markerSpot(i, p) {
    if (i === 0) return { x: SPOTS.houseDoor.x, z: SPOTS.houseDoor.z, y: 3.3, gz: 0 };
    if (i === 1) { const f = front(SPOTS.signBrooder); return { x: SPOTS.signBrooder.x, z: SPOTS.signBrooder.z + f * 1.1, y: 2.7, gz: -f * 0.9 }; }
    if (i === 2) { const f = front(SPOTS.controller); return { x: SPOTS.controller.x, z: SPOTS.controller.z + f * 1.1, y: 2.7, gz: -f * 0.9 }; }
    const { heater } = nearestHeater(p);
    return { x: heater.x, z: heater.z, y: HEATER_HEIGHT + 1.0, gz: 0 };
  }

  let t = 0;
  function update(dt, openId) {
    t += dt;
    const p = player.position;
    if (index === 0 && player.isInside) complete();
    else if (index === 1 && (flags.sign || openId === 'sign-brooder')) complete();
    else if (index === 2 && flags.setpoint) complete();
    else if (index === 3) {
      if (!openId && nearestHeater(p).dist <= WATCH_RADIUS) watched += dt;
      const env = ctx.env;
      const warm = !env || Math.abs(env.houseTemp - env.heaterSetpoint) <= WARM_BAND;
      const need = warm ? WATCH_SECONDS : WATCH_MAX;
      items[3].bar.style.transform = `scaleX(${Math.min(1, watched / need).toFixed(3)})`;
      if (watched >= need) complete();
    }

    marker.visible = index < TASKS.length;
    if (!marker.visible) { pointer.hidden = true; return; }
    const s = markerSpot(index, p);
    const still = reducedMotion();
    ring.position.set(0, 0.05, 0);
    marker.position.set(s.x, 0, s.z);
    gem.position.set(0, s.y + (still ? 0 : Math.sin(t * 2.4) * 0.14), s.gz);
    gem.rotation.y = still ? 0.6 : t * 1.3;
    const pulse = still ? 1 : 1 + 0.12 * Math.sin(t * 3.1);
    ring.scale.set(pulse, pulse, pulse);
    if (openId) pointer.hidden = true;
    else updatePointer(s, p);
  }

  // ---------- edge pointer: when the marker is off screen, an arrow at the screen edge points to it ----------
  const pointerIcon = h('span', { class: 'edge-arrow', html: ICONS.arrow });
  const pointerText = h('span');
  const pointer = h('div', { class: 'edge-pointer', hidden: true, 'aria-hidden': 'true' }, pointerIcon, pointerText);
  (root || parent).prepend(pointer); // first in the HUD, so the cards paint over it
  const ndc = new THREE.Vector3();
  let lastMetres = -1;
  let rects = [];
  let rectAge = 0;
  function updatePointer(s, p) {
    camera.updateMatrixWorld();
    ndc.set(s.x, s.y * 0.6, s.z + s.gz).project(camera);
    let x = ndc.x, y = ndc.y;
    const behind = ndc.z > 1;
    if (behind) { x = -x; y = -y; }
    if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.94) { pointer.hidden = true; return; }
    const W = (root || parent).clientWidth, H = (root || parent).clientHeight;
    // on an ellipse-ish box inside the screen, clear of the clock card above and the time controls below
    const k = Math.max(Math.abs(x) / 0.86, Math.abs(y) / (y > 0 ? 0.66 : 0.7), 1e-6);
    const px = (x / k * 0.5 + 0.5) * W;
    let py = (-y / k * 0.5 + 0.5) * H;
    // never hide under a HUD card: step above or below it (card rects re-read twice a second)
    if ((rectAge -= 1) <= 0) { rectAge = 30; rects = avoid ? avoid().map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0) : []; }
    for (const r of rects) {
      if (px > r.left - 34 && px < r.right + 34 && py > r.top - 22 && py < r.bottom + 22) {
        py = (r.top + r.bottom) / 2 < H / 2 ? r.bottom + 24 : r.top - 24;
      }
    }
    pointer.hidden = false;
    pointer.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) translate(-50%, -50%)`;
    pointerIcon.style.transform = `rotate(${Math.atan2(-y, x).toFixed(3)}rad)`;
    const metres = Math.round(Math.hypot(s.x - p.x, s.z - p.z));
    if (metres !== lastMetres) { lastMetres = metres; setText(pointerText, `${metres} m`); }
  }

  // Events from the panels. They only count for the job that is current now.
  function notify(event) {
    if (event === 'open:sign-brooder' && index === 1) flags.sign = true;
    if (event === 'setpoint' && index === 2) flags.setpoint = true;
  }

  function reset() {
    index = 0; watched = 0; flags.sign = false; flags.setpoint = false;
    items[3].bar.style.transform = 'scaleX(0)';
    live.textContent = '';
    render();
  }

  render();
  return { el: card, update, notify, reset, get index() { return index; } };
}
