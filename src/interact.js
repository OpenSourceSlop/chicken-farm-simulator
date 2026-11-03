// Interactable registry: what E can reach. Owner: integrator (complete, frozen).
//
// Phase 1 passed ui.js a fixed array (world + house boards). Phase 2 adds things that come and go
// (chick box stacks, dead birds, a chick to pick up, the litter heap) and actions that are not a
// panel. Every package registers its own; ui.js asks nearest(player) when E is pressed.
//
// Interactable: { id, label, x, z, radius, inside?, verb?, use?, enabled? }
//   id       panel id (ui opens the panel registered under it) unless `use` is given
//   label    what the prompt names: "E  <verb> <label>"
//   inside   true / false: only answers when player.isInside matches (boards through walls)
//   verb     prompt verb, e.g. 'Pick up', 'Read the', 'Use the' (ui picks a default when absent)
//   use()    called on E instead of opening a panel (pick up a stack, tip boxes, catch a chick)
//   enabled() false hides it for now (e.g. the chick table before the truck came)
//
// Provider: a function (playerPos, isInside) -> Interactable | null for things that are not at a
// fixed place (the nearest dead bird, the nearest chick while a sample job is open). Providers are
// asked only when no fixed interactable is in reach, so boards and machines always win.

/**
 * @typedef {{ id: string, label: string, x: number, z: number, radius: number, inside?: boolean,
 *   verb?: string, use?: () => void, enabled?: () => boolean, priority?: number }} Interactable
 */

/** @param {Interactable[]} [initial] */
export function createInteract(initial = []) {
  const fixed = [...initial];
  const providers = new Map();

  const usable = (it, inside) => (it.inside == null || it.inside === !!inside) && (!it.enabled || it.enabled());

  return {
    /** Fixed interactables (same array every call; Phase 1 ui.js iterates it). */
    get list() { return fixed; },
    /** @param {Interactable} it */
    add(it) { this.remove(it.id); fixed.push(it); return it; },
    remove(id) { const i = fixed.findIndex((f) => f.id === id); if (i >= 0) fixed.splice(i, 1); },
    get(id) { return fixed.find((f) => f.id === id) || null; },
    /** @param {string} key @param {(p: {x:number,z:number}, inside: boolean) => (Interactable|null)} fn */
    addProvider(key, fn) { providers.set(key, fn); return () => providers.delete(key); },
    removeProvider(key) { providers.delete(key); },
    /**
     * Nearest usable interactable for the farmer, or null.
     * @param {{ position: {x:number,z:number}, isInside: boolean }} player
     * @param {(it: Interactable) => boolean} [accept] extra filter (ui: "has a panel or a use()")
     */
    nearest(player, accept) {
      const p = player.position, inside = player.isInside;
      let best = null, bestD = Infinity;
      for (const it of fixed) {
        if (!usable(it, inside) || (accept && !accept(it))) continue;
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d <= it.radius && d < bestD) { bestD = d; best = it; }
      }
      if (best) return best;
      for (const fn of providers.values()) {
        let it = null;
        try { it = fn(p, inside); } catch (err) { console.error('interact provider failed', err); }
        if (!it || !usable(it, inside) || (accept && !accept(it))) continue;
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d <= it.radius && d < bestD) { bestD = d; best = it; }
      }
      return best;
    },
  };
}
