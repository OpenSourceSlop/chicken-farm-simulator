// "Today's jobs": the task list, its auto-completion and the 3D marker over the current job.
// Owner: systems/UI agent.
import { HEATERS, HEATER_HEIGHT, SPOTS } from './config.js';
import { TASKS, TASKS_DONE_LINE } from './content.js';
import { h, setText, uniqueId, reducedMotion } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

const WATCH_RADIUS = 4;     // metres from a brooder
const WATCH_SECONDS = 5;    // real seconds

function cssColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function createTasks(parent, ctx, { player }) {
  const { THREE, scene } = ctx;
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

  // Where the marker sits for each job: x, z of the ground ring, gem height, gem offset in z
  function markerSpot(i, p) {
    if (i === 0) return { x: SPOTS.houseDoor.x, z: SPOTS.houseDoor.z, y: 3.3, gz: 0 };
    if (i === 1) return { x: SPOTS.signBrooder.x, z: SPOTS.signBrooder.z - 1.1, y: 2.7, gz: 0.9 };
    if (i === 2) return { x: SPOTS.controller.x, z: SPOTS.controller.z - 1.1, y: 2.7, gz: 0.9 };
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
      if (nearestHeater(p).dist <= WATCH_RADIUS) watched += dt;
      items[3].bar.style.transform = `scaleX(${Math.min(1, watched / WATCH_SECONDS).toFixed(3)})`;
      if (watched >= WATCH_SECONDS) complete();
    }

    marker.visible = index < TASKS.length;
    if (!marker.visible) return;
    const s = markerSpot(index, p);
    const still = reducedMotion();
    ring.position.set(0, 0.05, 0);
    marker.position.set(s.x, 0, s.z);
    gem.position.set(0, s.y + (still ? 0 : Math.sin(t * 2.4) * 0.14), s.gz);
    gem.rotation.y = still ? 0.6 : t * 1.3;
    const pulse = still ? 1 : 1 + 0.12 * Math.sin(t * 3.1);
    ring.scale.set(pulse, pulse, pulse);
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
