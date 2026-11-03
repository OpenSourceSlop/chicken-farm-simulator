// The flock in Level 1: reads ctx.farm every frame and wires the level parts. Owner: flock.
//
// farm.mode 'off' (sandbox): nothing here runs and the flock is exactly Phase 1's.
// farm.mode 'level': on entering, the house is emptied (prep day); then each frame
//   - S.lv: water access per line, pan fill, lux, wet litter, brooders out (flock-sick.js)
//   - population: drawn birds follow farm.flock.alive, chicks spill from tipped stacks (flock-pop.js)
//   - sizes from farm.flock.weightQuantile (uneven flock = visibly uneven sizes)
//   - sick birds 1:1 with farm.flock.sick (flock-sick.js), dead birds 1:1 (flock-dead.js)
//   - catching, the frame, putting back, culling (flock-catch.js)
// Events: listens to farm:death (lay dead birds) and farm:placed (placeBatch); emits bird:pick,
// bird:release, dead:pick. Providers: 'chick' and 'sick-bird' (5), 'dead-bird' (6).
import { EV } from './events.js';
import { COLD, HOT } from './flock-state.js';
import { ST } from './flock-pop.js';
import { createAccess, refreshAccess, thinkSick, updateSick } from './flock-sick.js';
import { createDeadBirds } from './flock-dead.js';
import { createCatcher } from './flock-catch.js';

export function createLevelFlock(ctx, { S, pop, uniforms, render, reset }) {
  const lv = createAccess();
  const isLevel = () => ctx.farm?.mode === 'level';
  const dead = createDeadBirds(ctx, S, uniforms, pop);
  const catcher = createCatcher(ctx, S, pop, isLevel);
  const farmer = () => ctx.player?.position || null;
  S.levelMode = false;
  S.lv = null;
  let stillT = 0, calmK = 1, lastTarget = 0, wantSick = 0;

  function switchMode(on) {
    S.levelMode = on;
    catcher.clear();
    dead.clear();
    if (on) {
      S.lv = lv;
      pop.clear();
      pop.sizes(ctx.farm, 0, true);
    } else {
      S.lv = null;
      pop.all();
      for (let i = 0; i < S.cap; i++) S.size[i] = S.size0[S.id[i]];
    }
    reset(); // flock-wide size and spacing for the new mode; re-places the sandbox flock
    render.markDirty();
  }

  // ---- events ----
  const ev = ctx.events;
  if (ev) {
    ev.on(EV.FARM_DEATH, (p) => { if (isLevel()) { sync(); dead.add(Math.max(0, Math.round(p?.n ?? 1)), p?.cause); } });
    ev.on(EV.FARM_PLACED, (p) => { if (isLevel()) { sync(); pop.placeBatch(p?.x ?? -10, p?.z ?? 0, p?.chicks ?? 0); } });
  }
  // an event can arrive before the first frame in level mode: switch first, so it is not wiped
  function sync() { if (isLevel() !== S.levelMode) switchMode(isLevel()); }

  // ---- providers (PHASE2.md §13.3) ----
  catcher.providers();
  ctx.interact?.addProvider?.('dead-bird', (p, inside) => {
    if (!isLevel() || !inside || !dead.list.length) return null;
    const c = ctx.props?.carrying;
    if (c && c !== 'bucket') return null;
    let best = null, bd = 2.25, k = 0;
    for (const d of dead.list) {
      const dd = (d.x - p.x) ** 2 + (d.z - p.z) ** 2;
      if (dd <= 2.25) k++;
      if (dd < bd) { bd = dd; best = d; }
    }
    if (!best) return null;
    return { id: 'dead-bird', label: k > 1 ? `${k} dead birds` : 'dead bird', verb: 'Pick up', x: best.x, z: best.z,
      radius: 1.5, inside: true, priority: 6, use: () => { const f = farmer() || p; dead.api.pickUp(f.x, f.z, 1.5); } };
  });

  const heldSick = () => { let k = 0; for (const h of catcher.held.values()) if (h.sick) k++; return k; };

  const lvl = {
    dead, catcher, lv,
    /** every frame before the flock moves; returns true in level mode */
    update(dt, env, farmerPos) {
      sync();
      if (!S.levelMode) return false;
      const farm = ctx.farm;
      refreshAccess(lv, farm, env);
      lastTarget = pop.reconcile(farm, dt, farmerPos);
      pop.sizes(farm, dt, false);
      wantSick = updateSick(S, farm, heldSick());
      dead.update(dt, farm);
      return true;
    },
    /** a bird's decision in a level when it follows its own rules; false = the normal think */
    think(i, field, env, fctx, grid) {
      if (S.pen[i]) return catcher.thinkPen(i);
      if (S.lagT[i] > 0) return true; // still sitting dazed where it was tipped out
      if (S.sick[i]) { thinkSick(S, i, fctx, grid); return true; }
      return false;
    },
    afterSteer(dt, grid) {
      catcher.afterSteer(dt);
      dead.pushLive(grid, dt);
      const lag = S.lagT;
      for (let i = 0, m = S.n; i < m; i++) if (lag[i] > 0) lag[i] -= dt;
    },
    afterPose() {},
    /** the farmer's clearing shrinks while he stands still: the chicks come back round his boots */
    farmerCalm(fctx, dt) {
      const still = fctx.vx * fctx.vx + fctx.vz * fctx.vz < 0.04;
      stillT = still ? stillT + dt : 0;
      const want = stillT > 1 ? Math.max(0.42, 1 - 0.35 * (stillT - 1)) : 1;
      calmK += (want - calmK) * Math.min(1, dt * (want < calmK ? 1.5 : 8));
      return calmK;
    },
    placeBatch(x, z, chicks) { if (isLevel()) { sync(); pop.placeBatch(x, z, chicks); } },
    resetLevel() {
      if (isLevel()) { S.levelMode = false; switchMode(true); return; }
      catcher.clear(); dead.clear();
    },
    serialize() {
      return { v: 1, ...dead.serialize(), ahead: +pop.aheadOfCount.toFixed(3), batch: pop.batchBirds,
        tip: pop.lastTip ? [Math.round(pop.lastTip.x * 100), Math.round(pop.lastTip.z * 100)] : null };
    },
    restore(d) {
      if (!d || d.v !== 1) return;
      if (isLevel()) { S.levelMode = false; switchMode(true); } // fresh floor, birds from the counts
      pop.aheadOfCount = +d.ahead || 0;
      pop.batchBirds = d.batch | 0;
      pop.lastTip = Array.isArray(d.tip) ? { x: d.tip[0] / 100, z: d.tip[1] / 100 } : null;
      dead.restore(d);
      if (S.levelMode) pop.reconcile(ctx.farm, 0, farmer());
    },
    sounds() {
      const n = S.n;
      if (!n) return { distress: 0, contented: 0, snick: 0 };
      let cold = 0, hot = 0;
      for (let i = 0; i < n; i++) { if (S.therm[i] === COLD) cold++; else if (S.therm[i] === HOT) hot++; }
      const farm = ctx.farm, inLevel = S.levelMode;
      const thirst = inLevel ? Math.max(0, 0.85 - lv.meanAcc) : 0, hunger = inLevel ? Math.max(0, 0.7 - lv.meanFill) : 0;
      // loud peeping once more than about a tenth of the birds are cold, hungry or thirsty (§6.9)
      const share = (cold + 0.6 * hot) / n + thirst + hunger;
      const distress = Math.max(0, Math.min(1, (share - 0.04) / 0.2));
      const nh3 = inLevel ? +farm?.litter?.ammoniaPpm || 0 : 0;
      const dark = ctx.env && ctx.env.lightsOn === false;
      const r2 = (v) => Math.round(v * 100) / 100;
      return { distress: r2(distress), contented: r2((1 - distress) * (dark ? 0.35 : 1)), snick: r2(Math.max(0, Math.min(1, (nh3 - 15) / 15))) };
    },
    debug: {
      /** counts for the harness (never shown to the player) */
      stats() {
        const causes = {};
        for (const d of dead.list) causes[d.cause] = (causes[d.cause] || 0) + 1;
        let sick = 0, lame = 0, pen = 0;
        for (let i = 0; i < S.n; i++) { if (S.sick[i]) sick++; if (S.sick[i] === 2) lame++; if (S.pen[i]) pen++; }
        return { level: S.levelMode, drawn: S.n, target: lastTarget, pending: pop.pending.length, held: catcher.held.size,
          sick, lame, wantSick, penned: pen, dead: dead.api.count, deadDrawn: dead.list.length, deadQueued: dead.queue.length, causes,
          ahead: +pop.aheadOfCount.toFixed(2) };
      },
      /** std / mean of the drawn birds' size factor (uniformity check) */
      sizeSpread() {
        let s1 = 0, s2 = 0;
        for (let i = 0; i < S.n; i++) { s1 += S.size[i]; s2 += S.size[i] * S.size[i]; }
        const m = s1 / Math.max(1, S.n);
        return { mean: +m.toFixed(4), std: +Math.sqrt(Math.max(0, s2 / Math.max(1, S.n) - m * m)).toFixed(4) };
      },
      /** birds drinking at each line (holding a nipple of that line) */
      drinkersByLine() {
        const out = [0, 0, 0, 0];
        for (let i = 0; i < S.n; i++) {
          const r = S.res[i];
          if (r >= S.nPans && S.act[i] === 3) out[Math.floor((r - S.nPans) / S.nipPerLine)]++;
        }
        return out;
      },
      /** mean distance from each sick bird to its nearest well bird, and the same for well birds */
      apart() {
        const nn = (i, wantSickPeer) => {
          let b = 1e9;
          for (let j = 0; j < S.n; j++) {
            if (j === i || (!!S.sick[j]) !== wantSickPeer) continue;
            const d = (S.px[j] - S.px[i]) ** 2 + (S.pz[j] - S.pz[i]) ** 2;
            if (d < b) b = d;
          }
          return Math.sqrt(b);
        };
        let ds = 0, ks = 0, dw = 0, kw = 0;
        for (let i = 0; i < S.n; i++) {
          if (S.sick[i]) { ds += nn(i, false); ks++; } else if (kw < 200 && i % 7 === 0) { dw += nn(i, false); kw++; }
        }
        return { sick: ks, sickToNearestWell: +(ds / Math.max(1, ks)).toFixed(3), wellToNearestWell: +(dw / Math.max(1, kw)).toFixed(3) };
      },
      sickBirds() { const o = []; for (let i = 0; i < S.n; i++) if (S.sick[i]) o.push({ index: S.id[i], x: +S.px[i].toFixed(2), z: +S.pz[i].toFixed(2), lame: S.sick[i] === 2 }); return o; },
      held: () => [...catcher.held.keys()],
      status: (id) => ['hidden', 'active', 'held', 'culled'][pop.status[id]],
      ST,
    },
  };
  return lvl;
}
