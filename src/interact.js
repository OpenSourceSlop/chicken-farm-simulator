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
//   priority     see "Choice" below
//   nearRadius, nearPriority   within nearRadius m of the farmer it competes with nearPriority
//                instead (a dead bird right at his feet beats the board behind it)
//
// Provider: a function (playerPos, isInside) -> Interactable | null for things that are not at a
// fixed place (the nearest dead bird, the nearest chick while a sample job is open, the tip spot
// while carrying boxes). A provider returns null when it cannot act now (e.g. the farmer's hands
// are full), so it never hides another one.
//
// Choice (nearest): of everything in reach, the highest `priority` wins, then the nearest, where
// "nearest" counts what the farmer faces as up to FACING_M closer (player.yaw given: facing is
// (-sin yaw, -cos yaw)). So of two machines side by side the one he turns to answers.
// Defaults: fixed interactables 10, providers 0, so boards and machines beat providers as in
// Phase 1. Phase 2 priorities (PHASE2.md §13.3): tip / patch / frame (only while carrying the
// matching thing) 20, dead-bird 6 (15 within 0.8 m: a bird at his feet beats a board or machine
// whose 2 m reach he stands in), sick-bird and chick 5. The litter squeeze is not on E (key Q).

/**
 * @typedef {{ id: string, label: string, x: number, z: number, radius: number, inside?: boolean,
 *   verb?: string, use?: () => void, enabled?: () => boolean, priority?: number,
 *   nearRadius?: number, nearPriority?: number }} Interactable
 */

const FACING_M = 0.45;

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
      const fx = Number.isFinite(player.yaw) ? -Math.sin(player.yaw) : 0, fz = Number.isFinite(player.yaw) ? -Math.cos(player.yaw) : 0;
      let best = null, bestP = -Infinity, bestD = Infinity;
      const consider = (it, defaultPriority) => {
        if (!it || !usable(it, inside) || (accept && !accept(it))) return;
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d > it.radius) return;
        const pr = it.nearRadius != null && d <= it.nearRadius ? (it.nearPriority ?? it.priority ?? defaultPriority) : (it.priority ?? defaultPriority);
        const face = d > 0.2 ? (FACING_M * ((it.x - p.x) * fx + (it.z - p.z) * fz)) / d : 0;
        const score = d - face;
        if (pr > bestP || (pr === bestP && score < bestD)) { best = it; bestP = pr; bestD = score; }
      };
      for (const it of fixed) consider(it, 10);
      for (const fn of providers.values()) {
        let it = null;
        try { it = fn(p, inside); } catch (err) { console.error('interact provider failed', err); }
        consider(it, 0);
      }
      return best;
    },
  };
}
