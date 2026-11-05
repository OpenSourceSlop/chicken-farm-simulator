// Birds you walk past (SKILLS.md §3.10 Biosecurity 3 `passCheck`, §10; package "scene"). Pure logic over the flock's
// arrays (node-safe: no DOM). Inside the house, while the perks hold passCheck:
//   - a sick, lame or gasping drawn bird within AUTO.tagM (2 m) of the farmer gets a tag with the symptom check's words
//     (limps, sits hunched, gasps, watery droppings) that stays AUTO.tagSec (3 s) after he was last that near; at most
//     AUTO.tagMax (6) at once, the nearest; ui-deadmarks.js draws them as small chips kept off the HUD cards
//   - EV.BIRD_SEEN { index, look, x, z }: once per bird per day and look — 'gait' for a bird that walked while he passed
//     within 2 m (w2-check's rule type 'seen' counts ten from three parts), 'lame' | 'sick' | 'gasp' for a tag shown
// createTags(ctx, S, pop) -> { update(dt, farmerPos), list(), has(index), lameTagged(index), clear() }
import { AUTO, HOUSE_BOUNDS } from './config.js';
import { EV } from './events.js';
import { ACT, HOT } from './flock-state.js';
import { ST } from './flock-pop.js';

const LAME = 3;              // S.sick of a Phase 3 lame bird (flock-cycle.js); 2 = Phase 2's sick and lame bird
const WALKING = 0.08;        // m/s: a bird moving at least this fast is walking (its gait shows)
const SCAN = 0.2;            // s between scans of the flock

/** The tag's look and words for a drawn bird, or null (a well bird). */
export function symptomOf(S, i, farm) {
  const s = S.sick[i];
  if (s === LAME || s === 2) return { look: 'lame', text: 'limps' };
  if (s) {
    const d = farm?.flock?.droppings, h = farm?.problems?.find?.((p) => p.id === 'gumboro');
    const watery = d === 'watery' || d === 'white' || (h && (h.phase === 'active' || h.phase === 'found'));
    return { look: 'sick', text: watery ? 'sits hunched · watery droppings' : 'sits hunched' };
  }
  if (S.therm[i] === HOT && S.act[i] === ACT.PANT) return { look: 'gasp', text: 'gasps' };
  return null;
}

export function createTags(ctx, S, pop) {
  const tags = new Map();        // bird id -> { id, look, text, until, x, z, dist }
  const seen = new Map();        // `${id}|${look}` -> day number it was last seen (once per bird per day)
  let t = 0, acc = 0, on = false;
  const perkOn = () => !!(ctx.perks?.has?.('passCheck'));
  const inside = (p) => !!p && (ctx.player ? !!ctx.player.isInside : p.x > HOUSE_BOUNDS.xMin && p.x < HOUSE_BOUNDS.xMax && p.z > HOUSE_BOUNDS.zMin && p.z < HOUSE_BOUNDS.zMax);
  const day = () => (ctx.env ? ctx.env.dayNumber : 0);

  function emitSeen(id, look, x, z) {
    const k = `${id}|${look}`, d = day();
    if (seen.get(k) === d) return;
    seen.set(k, d);
    ctx.events?.emit(EV.BIRD_SEEN, { index: id, look, x: +x.toFixed(2), z: +z.toFixed(2) });
  }

  function scan(p) {
    const r2 = AUTO.tagM * AUTO.tagM, farm = ctx.farm;
    for (let i = 0; i < S.n; i++) {
      if (S.pen[i] || S.spawnT[i] > 0) continue;
      const dx = S.px[i] - p.x, dz = S.pz[i] - p.z, d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const id = S.id[i];
      if (S.spd[i] > WALKING) emitSeen(id, 'gait', S.px[i], S.pz[i]);
      const sym = symptomOf(S, i, farm);
      if (!sym) continue;
      const tg = tags.get(id);
      if (tg) { tg.until = t + AUTO.tagSec; tg.look = sym.look; tg.text = sym.text; }
      else tags.set(id, { id, look: sym.look, text: sym.text, until: t + AUTO.tagSec, x: S.px[i], z: S.pz[i], dist: Math.sqrt(d2) });
      emitSeen(id, sym.look, S.px[i], S.pz[i]);
    }
  }

  const api = {
    /** every frame in a level (flock-level.js): scan 5 times a second, follow the tagged birds, drop old tags */
    update(dt, farmerPos) {
      t += dt;
      on = perkOn() && inside(farmerPos);
      if (!on) { if (tags.size) tags.clear(); return; }
      if ((acc -= dt) <= 0) { acc = SCAN; scan(farmerPos); }
      for (const [id, tg] of tags) {
        const slot = S.slotOf ? S.slotOf[id] : -1;
        const active = pop && pop.status ? pop.status[id] === ST.ACTIVE : slot >= 0;
        if (tg.until < t || !active || slot < 0 || slot >= S.n) { tags.delete(id); continue; }
        tg.x = S.px[slot]; tg.z = S.pz[slot];
        tg.dist = Math.hypot(tg.x - farmerPos.x, tg.z - farmerPos.z);
        if (tg.dist > 2 * AUTO.tagM) tags.delete(id);   // he walked on (or jumped away): the tag is behind him
      }
      if (tags.size > AUTO.tagMax) {
        const keep = new Set([...tags.values()].sort((a, b) => a.dist - b.dist).slice(0, AUTO.tagMax).map((g) => g.id));
        for (const id of [...tags.keys()]) if (!keep.has(id)) tags.delete(id);
      }
    },
    /** The tags shown now, nearest first: [{ index, look, text, x, z, dist, left (s) }] (the harness: __game.flock.tags()). */
    list() {
      return [...tags.values()].sort((a, b) => a.dist - b.dist).map((g) => ({ index: g.id, look: g.look, text: g.text, x: +g.x.toFixed(2), z: +g.z.toFixed(2), dist: +g.dist.toFixed(2), left: +Math.max(0, g.until - t).toFixed(2) }));
    },
    has(index) { return tags.has(index); },
    /** A lame bird with its tag showing (E culls it: flock-catch.js) */
    lameTagged(index) { const g = tags.get(index); return !!g && g.look === 'lame'; },
    get on() { return on; },
    clear() { tags.clear(); seen.clear(); acc = 0; },
  };
  return api;
}
