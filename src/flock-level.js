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
import { DRINKER_LINES_Z, AUTO } from './config.js';
import { ACT, COLD, HOT, makeRand } from './flock-state.js';
import { ST } from './flock-pop.js';
import { createAccess, refreshAccess, thinkSick, updateSick } from './flock-sick.js';
import { createDeadBirds } from './flock-dead.js';
import { createCatcher } from './flock-catch.js';
// Phase 3 (package "scene"): the growing flock over the whole cycle and the catch
import { cycleOn, zones, heatBand, updateLame, thinkLame, water, breathing, LAME } from './flock-cycle.js';
import { createCatchFlock } from './flock-harvest.js';
// Skills update (package "scene", SKILLS.md §3.10): the symptom tags of the birds he walks past (Biosecurity 3)
import { createTags } from './flock-tags.js';

export function createLevelFlock(ctx, { S, pop, uniforms, render, reset }) {
  const lv = createAccess();
  const isLevel = () => ctx.farm?.mode === 'level';
  const dead = createDeadBirds(ctx, S, uniforms, pop);
  const catcher = createCatcher(ctx, S, pop, isLevel);
  const catchFlock = createCatchFlock(S, pop);
  const tags = createTags(ctx, S, pop);
  catcher.tags = tags;
  const farmer = () => ctx.player?.position || null;
  S.levelMode = false;
  S.lv = null;
  let stillT = 0, calmK = 1, lastTarget = 0, wantSick = 0, wantLame = 0, cyc = false;
  const zoneE = new Float64Array(8);
  let zonesOk = false;

  function switchMode(on) {
    S.levelMode = on;
    catcher.clear();
    dead.clear();
    catchFlock.clear();
    tags.clear();
    cyc = false; heatBand(S, null, null, false);
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
  /** A level start or a saved start always draws the same flock: the drawn birds' generator restarts from the
   *  level seed and the minute of the farm clock (it ran on from page load before, frame by frame). */
  function reseed() {
    const seed = ((ctx.farm?.seed ?? 1) * 2654435761 + Math.round((ctx.env?.day ?? 0) * 1440) * 40503) >>> 0;
    S.rand = makeRand(seed || 1);
  }
  if (ev) {
    ev.on(EV.FARM_DEATH, (p) => { if (isLevel()) { sync(); dead.add(Math.max(0, Math.round(p?.n ?? 1)), p?.cause); } });
    ev.on(EV.FARM_PLACED, (p) => { if (isLevel()) { sync(); pop.placeBatch(p?.x ?? -10, p?.z ?? 0, p?.chicks ?? 0); } });
  }
  // an event can arrive before the first frame in level mode: switch first, so it is not wiped
  function sync() { if (isLevel() !== S.levelMode) switchMode(isLevel()); }
  // the drinker lines open again after the thirst (vaccination): the flock gets up and goes to drink
  function rush() {
    for (let i = 0; i < S.n; i++) {
      if (S.pen[i] || S.sick[i]) continue;
      if (S.act[i] === ACT.REST || S.act[i] === ACT.IDLE || S.act[i] === ACT.WANDER) { S.actT[i] = S.rand() * 1.5; S.thinkT[i] = Math.min(S.thinkT[i], S.rand() * 0.4); }
    }
  }

  // ---- providers (PHASE2.md §13.3) ----
  catcher.providers();
  ctx.interact?.addProvider?.('dead-bird', (p, inside) => {
    if (!isLevel() || !inside || !dead.list.length) return null;
    const c = ctx.props?.carrying;
    if (c && c !== 'bucket') return null;
    // Skills update (SKILLS.md §3.10): with Biosecurity 2's tally bucket E takes every dead bird within AUTO.deadReachM
    // (2.5 m) while the bucket holds under AUTO.bucketMaxKg, counting them as they go in; else Phase 4's 1.5 m
    const tally = !!ctx.props?.tallyOn?.();
    const reach = tally ? AUTO.deadReachM : 1.5, r2 = reach * reach;
    let best = null, bd = r2, k = 0;
    for (const d of dead.list) {
      const dd = (d.x - p.x) ** 2 + (d.z - p.z) ** 2;
      if (dd <= r2) k++;
      if (dd < bd) { bd = dd; best = d; }
    }
    if (!best) return null;
    const room = tally ? ctx.props.bucketRoom() : null;
    // the review round: the tally's count in the prompt ("Pick up 3 dead birds · 5 in the bucket"), not only on its rim
    const inB = tally ? Math.round(ctx.props.bucketTally?.n || 0) : 0, tail = inB > 0 ? ` · ${inB} in the bucket` : '';
    const label = room && room.n <= 0 ? `dead bird${k > 1 ? 's' : ''} (the bucket is full${inB > 0 ? `: ${inB} in it` : ''})` : k > 1 ? `${k} dead birds${tail}` : `dead bird${tail}`;
    return { id: 'dead-bird', label, verb: 'Pick up', x: best.x, z: best.z,
      // a bird right at his feet (0.8 m) beats the board or machine whose 2 m reach he stands in
      radius: reach, inside: true, priority: 6, nearRadius: 0.8, nearPriority: 15,
      use: () => {
        const f = farmer() || p;
        if (!tally) { dead.api.pickUp(f.x, f.z, 1.5); return; }
        const rm = ctx.props.bucketRoom();
        if (rm.n <= 0) { ctx.ui?.caption?.(`The bucket is full (about ${Math.round(rm.maxKg)} kg of birds): empty it at the dead-bird bin first.`, 4.5); return; }
        const got = dead.api.pickUp(f.x, f.z, reach, { maxN: rm.n, tally: true });
        if (got.left > 0) ctx.ui?.caption?.(`The bucket is full now (about ${Math.round(rm.maxKg)} kg): ${got.left} more lie here. Empty it at the dead-bird bin first.`, 5);
      } };
  });

  const heldSick = () => { let k = 0; for (const h of catcher.held.values()) if (h.sick && h.sick !== LAME) k++; return k; };
  const heldLame = () => { let k = 0; for (const h of catcher.held.values()) if (h.sick === LAME) k++; return k; };

  const lvl = {
    dead, catcher, lv, tags,
    /** every frame before the flock moves; returns true in level mode */
    update(dt, env, farmerPos) {
      sync();
      if (!S.levelMode) return false;
      const farm = ctx.farm;
      refreshAccess(lv, farm, env);
      // Phase 3, from day 8: the farm's comfort per strip, the panting band of growing birds, the
      // vaccination's dry and open lines
      cyc = cycleOn(S, env);
      heatBand(S, farm, env, cyc);
      zonesOk = cyc && zones(farm, zoneE);
      if (cyc) { if (water(lv, farm, env, dt) === 'opened') rush(); } else { lv.thirst = false; lv.rush = 0; }
      // the catch sets the drawn birds per section while it runs (flock-harvest.js)
      if (catchFlock.update(dt, farm, env)) { let w = 0; for (const v of catchFlock.want) w += v; lastTarget = Math.round(w); }
      else lastTarget = pop.reconcile(farm, dt, farmerPos);
      pop.sizes(farm, dt, false);
      wantSick = updateSick(S, farm, heldSick(), env);
      wantLame = updateLame(S, farm, heldLame());
      dead.update(dt, farm);
      tags.update(dt, farmerPos);
      return true;
    },
    /** comfort per 6 m strip for the comfort field (Phase 3, day 8 on) or null */
    zones() { return zonesOk ? zoneE : null; },
    /** a bird's decision in a level when it follows its own rules; false = the normal think */
    think(i, field, env, fctx, grid) {
      if (S.pen[i]) return catcher.thinkPen(i);
      if (S.lagT[i] > 0) return true; // still sitting dazed where it was tipped out
      if (S.sick[i] === LAME) { thinkLame(S, i, fctx); return true; }
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
      reseed();
      if (isLevel()) { S.levelMode = false; switchMode(true); return; }
      catcher.clear(); dead.clear(); tags.clear();
    },
    serialize() {
      return { v: 1, ...dead.serialize(), ahead: +pop.aheadOfCount.toFixed(3), batch: pop.batchBirds,
        tip: pop.lastTip ? [Math.round(pop.lastTip.x * 100), Math.round(pop.lastTip.z * 100)] : null };
    },
    restore(d) {
      if (!d || d.v !== 1) return;
      reseed();
      if (isLevel()) { S.levelMode = false; switchMode(true); } // fresh floor, birds from the counts
      pop.aheadOfCount = +d.ahead || 0;
      pop.batchBirds = d.batch | 0;
      pop.lastTip = Array.isArray(d.tip) ? { x: d.tip[0] / 100, z: d.tip[1] / 100 } : null;
      dead.restore(d);
      // fix round: the drawn dead birds no more than the farm's count right away (a standard start's snapshot carried
      // the last flock's dead onto the emptied house for a second)
      const want = ctx.farm?.flock?.deadOnFloor;
      if (typeof want === 'number') dead.trimTo?.(ctx.farm?.house?.closed ? 0 : want);
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
      const out = { distress: r2(distress), contented: r2((1 - distress) * (dark ? 0.35 : 1)), snick: r2(Math.max(0, Math.min(1, (nh3 - 15) / 15))) };
      if (!cyc) return out;
      // Phase 3 (day 8 on): the breathing (dust and ammonia) and the panting of the drawn birds
      const br = breathing(farm);
      out.snick = r2(Math.max(out.snick, br.snick));
      out.rattle = r2(br.rattle);
      out.pant = r2(Math.max(0, Math.min(1, hot / n)));
      return out;
    },
    debug: {
      /** counts for the harness (never shown to the player) */
      stats() {
        const causes = {};
        for (const d of dead.list) causes[d.cause] = (causes[d.cause] || 0) + 1;
        let sick = 0, lame = 0, pen = 0;
        for (let i = 0; i < S.n; i++) { if (S.sick[i]) sick++; if (S.sick[i] === 2) lame++; if (S.pen[i]) pen++; }
        let lame3 = 0, hot = 0;
        for (let i = 0; i < S.n; i++) { if (S.sick[i] === LAME) lame3++; if (S.therm[i] === HOT) hot++; }
        return { level: S.levelMode, drawn: S.n, target: lastTarget, pending: pop.pending.length, held: catcher.held.size,
          sick, lame, wantSick, penned: pen, dead: dead.api.count, deadDrawn: dead.list.length, deadQueued: dead.queue.length, causes,
          ahead: +pop.aheadOfCount.toFixed(2),
          // Phase 3
          cycle: cyc, lameBirds: lame3, wantLame, panting: hot, hotFrom: +(S.heatRef + 0.5).toFixed(2), catchOn: catchFlock.on,
          thirst: !!lv.thirst, rush: +(lv.rush || 0).toFixed(2) };
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
      sickBirds() { const o = []; for (let i = 0; i < S.n; i++) if (S.sick[i]) o.push({ index: S.id[i], x: +S.px[i].toFixed(2), z: +S.pz[i].toFixed(2), lame: S.sick[i] === 2 || S.sick[i] === LAME, phase3Lame: S.sick[i] === LAME }); return o; },
      /** Phase 3: drawn birds per 6 m section (x -24 + 6i ..), and the catch's wanted counts */
      sections() { const c = new Array(8).fill(0); for (let i = 0; i < S.n; i++) c[Math.max(0, Math.min(7, Math.floor((S.px[i] + 24) / 6)))]++; return { drawn: c, want: Array.from(catchFlock.want, (v) => +v.toFixed(1)) }; },
      /** Phase 4: the crowding at the drinker lines: the share of the drawn birds within 0.45 m of a line, the birds
       *  holding a nipple, and the access the flock reads (lv.houseShort: the house's water is short) */
      crowd() {
        let near = 0, drink = 0;
        for (let i = 0; i < S.n; i++) {
          let d = 9;
          for (const z of DRINKER_LINES_Z) d = Math.min(d, Math.abs(S.pz[i] - z));
          if (d < 0.45) near++;
          if (S.res[i] >= S.nPans && S.act[i] === 3) drink++;
        }
        return { nearLines: +(near / Math.max(1, S.n)).toFixed(3), drinking: drink, meanAcc: +lv.meanAcc.toFixed(3), houseShort: !!lv.houseShort, drawn: S.n };
      },
      /** Phase 3: mean x of the drawn birds (the spread after the curtain lift) */
      meanX() { let s = 0; for (let i = 0; i < S.n; i++) s += S.px[i]; return S.n ? +(s / S.n).toFixed(2) : null; },
      catchFlock,
      held: () => [...catcher.held.keys()],
      status: (id) => ['hidden', 'active', 'held', 'culled'][pop.status[id]],
      ST,
    },
  };
  return lvl;
}
