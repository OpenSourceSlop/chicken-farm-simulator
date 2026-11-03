// HUD, task list, sign and controller panels, Phase 1 test tools. Owner: systems/UI agent. (Stub: replace.)
export function createUI(ctx, { player, flock, house, world, interactables }) {
  const { env } = ctx;
  const hud = document.getElementById('hud');
  const el = document.createElement('div');
  el.className = 'hud-clock';
  hud.appendChild(el);
  return {
    update(dt) {
      el.textContent = `Day ${Math.floor(env.day)} · ${env.timeLabel} · House ${env.houseTemp.toFixed(1)} °C`;
    },
  };
}
