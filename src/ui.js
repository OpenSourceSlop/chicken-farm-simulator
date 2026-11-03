// HUD, task list, sign and controller panels, Phase 1 test tools. Owner: systems/UI agent.
// createUI(ctx, { player, flock, house, world, interactables }) -> { update(dt), ... }
// Owns all DOM inside #hud. E opens the nearest interactable within its radius, Esc closes,
// and the farmer takes no keyboard input while a panel is open.
import { FARM } from './config.js';
import { SIGNS } from './content.js';
import { h, inFormControl, typingInControl } from './ui-dom.js';
import { createHud } from './ui-hud.js';
import { createTasks } from './ui-tasks.js';
import { createPanelHost, buildSignPanel } from './ui-panels.js';
import { buildControllerPanel } from './ui-controller.js';
import { createTestTools } from './ui-testtools.js';
import { createHelp, createNarrowNotice, createPrompt } from './ui-help.js';

// Keys the farmer listens to, by physical position (KeyboardEvent.code) like player-input.js, so
// they work with a Thai (Kedmanee) or any other layout; e.key is the fallback. While a panel is open
// (or a slider has focus) they stop here.
const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
const ARROW_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const isKeyE = (e, k) => e.code === 'KeyE' || k === 'e';
const isKeyHelp = (e, k) => e.code === 'KeyH' || k === 'h' || k === '?' || (e.code === 'Slash' && e.shiftKey);

export function createUI(ctx, { player, flock, interactables = [] }) {
  const { env, canvas } = ctx;
  const root = document.getElementById('hud');
  root.textContent = '';

  // top left: farm clock and gauges
  const hud = createHud(root, env);

  // top right: today's jobs
  const tr = h('div', { class: 'hud-tr' });
  root.appendChild(tr);
  const tasks = createTasks(tr, ctx, {
    player,
    root,
    avoid: () => [tr, root.querySelector('.hud-tl'), root.querySelector('.hud-bl'), root.querySelector('.hud-br')].filter(Boolean),
  });

  // bottom left: controls legend and time controls
  const help = createHelp();
  hud.timebar.append(h('div', { class: 'timebar-sep', 'aria-hidden': 'true' }), help.toggleBtn);
  // The legend shown on first load steps aside once the farmer has walked into the house, so it
  // never covers the flock; ? or H brings it back. If the player opened or closed it, leave it.
  let helpAuto = help.visible;
  help.toggleBtn.addEventListener('click', () => { helpAuto = false; });
  root.appendChild(h('div', { class: 'hud-bl' }, help.card, hud.timebar));

  // bottom right: Phase 1 test tools
  const tools = createTestTools(env, { flock, onReset: reset });
  const br = h('div', { class: 'hud-br' }, tools.panel, tools.toggle);
  root.appendChild(br);
  // The open tools take the height left under the jobs card, and scroll inside it if they must.
  function fitTools() {
    const room = window.innerHeight - tasks.el.getBoundingClientRect().bottom - 12 - 16;
    br.style.setProperty('--tools-room', `${Math.max(140, Math.floor(room))}px`);
  }
  tools.toggle.addEventListener('click', fitTools);
  window.addEventListener('resize', fitTools);

  // bottom centre: "E  Read the ..." and the panels themselves
  const prompt = createPrompt(root, (id) => panels.open(id));
  const panels = createPanelHost(root, {
    player,
    canvas,
    onOpen: (id) => { tasks.notify(`open:${id}`); prompt.show(null); root.classList.add('has-panel'); },
    onClose: () => root.classList.remove('has-panel'),
  });
  const closePanel = () => panels.close();
  for (const id of Object.keys(SIGNS)) panels.register(id, () => buildSignPanel(id, env, closePanel));
  panels.register('controller', () => buildControllerPanel(env, { onClose: closePanel, onSetpoint: () => tasks.notify('setpoint') }));

  const narrow = createNarrowNotice(root);

  // Nearest board within reach on the farmer's side of the wall: the indoor boards (inside: true)
  // cannot be used from outside the north wall, and outdoor ones not from inside the house.
  function nearestInteractable() {
    const p = player.position;
    let best = null, bestD = Infinity;
    for (const it of interactables) {
      if (!panels.has(it.id)) continue;
      if (it.inside != null && it.inside !== !!player.isInside) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d <= it.radius && d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  function reset() {
    panels.close(false);
    env.reset();
    player.teleport(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
    tasks.reset();
    hud.refresh();
  }

  // Capture phase on window, so this runs before the farmer's own key listeners.
  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (narrow.open) return;
    if (panels.openId) {
      if (MOVE_CODES.has(e.code) || MOVE_KEYS.has(k)) e.stopImmediatePropagation(); // typed WASD must not walk the farmer
      if (k === 'escape') { e.preventDefault(); panels.close(); }
      else if (isKeyE(e, k) && !e.repeat && !typingInControl(e.target)) { e.preventDefault(); panels.close(); }
      return;
    }
    if (inFormControl(e.target) && (ARROW_KEYS.has(k) || (e.code || '').startsWith('Arrow'))) {
      e.stopImmediatePropagation(); // arrows move the slider or select, not the camera
      return;
    }
    if (typingInControl(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isKeyE(e, k) && !e.repeat) {
      const target = nearestInteractable();
      if (target) { e.preventDefault(); panels.open(target.id); }
    } else if (isKeyHelp(e, k) && !e.repeat) {
      helpAuto = false;
      help.toggle();
    } else if (k === 'escape' && help.visible) {
      help.hide();
    }
  }, true);

  let hudAcc = 0;
  let fitAcc = 0;
  return {
    update(dt) {
      hudAcc -= dt;
      const tick = hudAcc <= 0;
      hud.refresh(tick); // clock every frame, gauges ~10 times a second; only changed text is written
      if (tick) {
        hudAcc = 0.1;
        if (tools.open && (fitAcc = (fitAcc + 1) % 5) === 0) fitTools();
      }
      tasks.update(dt, panels.openId);
      if (helpAuto && tasks.index >= 1) { helpAuto = false; if (help.visible) help.hide(); }
      panels.update(dt);
      tools.update(dt);
      prompt.show(panels.openId || narrow.open ? null : nearestInteractable());
    },
    // Extra hooks for the integrator and tests (not needed by other modules).
    openPanel: (id) => panels.open(id),
    closePanel,
    get openPanelId() { return panels.openId; },
    get taskIndex() { return tasks.index; },
    reset,
  };
}
