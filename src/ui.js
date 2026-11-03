// HUD, task list, sign and controller panels, Phase 1 test tools. Owner: systems/UI agent.
import { h } from './ui-dom.js';
import { createHud } from './ui-hud.js';

export function createUI(ctx, { player, flock, house, world, interactables }) {
  const { env } = ctx;
  const root = document.getElementById('hud');
  root.textContent = '';

  const hud = createHud(root, env);
  const bl = h('div', { class: 'hud-bl' }, hud.timebar);
  root.appendChild(bl);

  let hudClock = 0;
  return {
    update(dt) {
      hudClock -= dt;
      if (hudClock <= 0) { hudClock = 0.1; hud.refresh(); }
    },
  };
}
