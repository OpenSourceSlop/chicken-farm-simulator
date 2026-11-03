// What the farmer does with the Phase 3 props (PHASE3.md §12 items 2-8, §13.4): the interactables
// (guard hut, curtain winch, fan panel, pad pump, gas tank, wash bay, loading bay, fan-0..5 while that
// fan's belt is broken, bait-0..3 and the brush spots on clean-out days, the catching panels on the
// catching night, the house door after the swabs), the providers that answer only while he carries their
// tool (tape 20, fork 20, swab 20), the quiet painting of the scraper (r 2.0), washer and sprayer (r 2.5)
// every 0.3 m he walks inside, the washer hose to the wash bay, the tape line, and the light / air meter
// in his hand for 2 s on L / V. Owner: package "scene".
import { SPOTS, SPOTS3, CLEAN, CYCLE, FAN_COUNT, HOUSE_BOUNDS, FLOOR_GRID } from './config.js';
import { EV } from './events.js';
import { FAN_Z } from './house-fans.js';
import { WASH_REEL } from './props-cycle-yard.js';

const { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;
const PAINT = { scraper: { id: 'clean.scrape', r: 2.0, ahead: 1.15 }, washer: { id: 'clean.wash', r: 2.5, ahead: 1.0 }, sprayer: { id: 'clean.spray', r: 2.5, ahead: 0.95 } };
const TAPE_REACH = 1.2;            // m from a wall where the tape hooks / reads
const HOOK_Y = 0.9;

export function createCycleTools(ctx, { props, pool, yard, lv }) {
  const farm = () => ctx.farm, pl = () => ctx.player, env = () => ctx.env;
  const st = { tape: null, lastPaint: null, panelsSeen: false, painted: 0 };
  const day = () => env()?.dayNumber ?? 0;
  const clean = () => day() >= CYCLE.cleanFrom;
  const reg = (it) => ctx.interact && ctx.interact.add({ inside: false, ...it, enabled: it.enabled || lv });
  const pose = (n, s) => pl()?.pose?.(n, s);

  // ---------------- fixed interactables ----------------
  reg({ id: 'guard-hut', label: 'farm clothes and boots', verb: 'Change into', x: SPOTS3.guardHut.x, z: SPOTS3.guardHut.z, radius: 1.6,
    use() { farm()?.act('bio.change', {}); pose('crouch', 1.0); } });
  const panelAt = (id, s, radius, extra = {}) => reg({ id, label: s.label, x: s.x, z: s.z, radius, inside: s.inside, verb: 'Use the', ...extra });
  panelAt('curtain-winch', SPOTS3.curtainWinch, 1.5, { enabled: () => lv() && day() >= 8 });
  panelAt('fan-panel', SPOTS3.fanPanel, 1.6, { enabled: () => lv() && day() >= 8 });
  panelAt('pad-pump', SPOTS3.padPump, 1.6, { enabled: () => lv() && day() >= 8 });
  panelAt('gas-tank', SPOTS3.gasTank, 2.0, { verb: 'Read the' });
  panelAt('wash-bay', SPOTS3.washBay, 2.0, { enabled: () => lv() && clean() });
  panelAt('loading-bay', SPOTS3.loadingBay, 1.8, { verb: 'Read the', enabled: () => lv() && day() >= 41 && !!(farm()?.harvest?.started) });
  for (let i = 0; i < FAN_COUNT; i++) {
    reg({ id: `fan-${i}`, label: `fan ${i + 1}: a new belt`, verb: 'Fit', x: xMax - 0.75, z: FAN_Z[i], radius: 1.3, inside: true,
      enabled: () => lv() && (env()?.fansBroken || []).includes(i),
      use() { farm()?.act('fan.fix', { index: i }); pose('reach', 1.5); } });
  }
  SPOTS3.bait.forEach((b, i) => reg({ id: `bait-${i}`, label: `bait station ${i + 1}`, verb: 'Set bait in', x: b.x, z: b.z, radius: 1.3,
    enabled: () => lv() && clean() && !farm()?.clean?.baits?.[i],
    use() { farm()?.act('clean.bait', { x: b.x, z: b.z, i }); pose('crouch', 1.0); } }));
  for (const [part, s] of Object.entries(SPOTS3.brush)) {
    reg({ id: `brush-${part}`, label: s.label.toLowerCase(), verb: 'Brush the dust off the', x: s.x, z: s.z, radius: 1.6, inside: true,
      enabled: () => lv() && clean() && !farm()?.clean?.brushed?.[part] && !props.carrying,
      use() { farm()?.act('clean.brush', { part }); pose('reach', 1.5); } });
  }
  const catchNight = () => { const d = day(), h = env()?.hour ?? 0, hv = farm()?.harvest || {}; return ((d === 41 && h >= 12) || (d === 42 && !hv.result)) && (farm()?.flock?.alive ?? 0) > 0; };
  reg({ id: 'catch-panels', label: SPOTS3.catchPanels.label.toLowerCase(), verb: 'Put up the', x: SPOTS3.catchPanels.x, z: SPOTS3.catchPanels.z, radius: 1.5, inside: true,
    enabled: () => lv() && catchNight() && !(farm()?.harvest?.panels || st.panelsSeen),
    use() { farm()?.act('catch.panels', {}); st.panelsSeen = true; pose('crouch', 1.2); } });
  reg({ id: 'house-door', label: 'house for the rest', verb: 'Close the', x: SPOTS.houseDoor.x, z: SPOTS.houseDoor.z, radius: 1.6,
    enabled: () => lv() && clean() && (farm()?.clean?.swabs?.length ?? 0) >= CLEAN.swabs && !farm()?.house?.closed,
    use() { farm()?.act('house.close', {}); pose('reach', 1.0); } });
  ctx.events?.on(EV.ACTION, (p) => {
    if (p.id === 'catch.panels') st.panelsSeen = true;
    // L / V (the run's keys): the meter in his hand for 2 s
    if (p.id === 'light.lux') pl()?.flash?.('lightMeter', 2);
    if (p.id === 'air.probe') pl()?.flash?.('airMeter', 2);
  });

  // ---------------- providers (only while carrying the tool) ----------------
  function wallNear(p) {
    const dW = p.x - xMin, dE = xMax - p.x, dN = p.z - zMin, dS = zMax - p.z;
    const opts = [
      { axis: 'length', end: -1, d: dW, name: 'west end wall' }, { axis: 'length', end: 1, d: dE, name: 'east end wall' },
      { axis: 'width', end: -1, d: dN, name: 'north wall' }, { axis: 'width', end: 1, d: dS, name: 'south wall' },
    ].filter((o) => o.d <= TAPE_REACH).sort((a, b) => a.d - b.d);
    return opts;
  }
  const hookPoint = (w, p) => (w.axis === 'length' ? { x: w.end < 0 ? xMin : xMax, z: p.z } : { x: p.x, z: w.end < 0 ? zMin : zMax });
  if (ctx.interact) {
    ctx.interact.addProvider('tape', (p, inside) => {
      if (!lv() || props.carrying !== 'tape' || !inside) return null;
      const walls = wallNear(p), h = st.tape;
      if (!h) {
        const w = walls[0];
        if (!w) return null;
        return { id: 'tape', label: `the tape on the ${w.name}`, verb: 'Hook', x: p.x, z: p.z, radius: 1, priority: 20,
          use() { st.tape = { ...w, ...hookPoint(w, p) }; pose('crouch', 0.8); } };
      }
      const far = walls.find((w) => w.axis === h.axis && w.end === -h.end);
      if (far) {
        return { id: 'tape', label: `the tape at the ${far.name}`, verb: 'Read', x: p.x, z: p.z, radius: 1, priority: 20,
          use() {
            const q = hookPoint(far, p), m = Math.round(Math.hypot(q.x - h.x, q.z - h.z) * 100) / 100;
            farm()?.act('plan.measure', { axis: h.axis, m });
            st.tape = null; pose('reach', 0.8);
          } };
      }
      const same = walls.find((w) => w.axis === h.axis && w.end === h.end);
      if (!same) return null;
      return { id: 'tape', label: 'the tape', verb: 'Unhook', x: p.x, z: p.z, radius: 1, priority: 20, use() { st.tape = null; } };
    });
    ctx.interact.addProvider('fork', (p, inside) => {
      if (!lv() || props.carrying !== 'fork' || !inside) return null;
      const L = farm()?.litter, caked = L && (L.cakedGrid || L.caked);
      if (!caked) return null;
      const yaw = pl()?.yaw ?? 0, fx = p.x - Math.sin(yaw) * 0.9, fz = p.z - Math.cos(yaw) * 0.9;
      for (const [x, z] of [[fx, fz], [p.x, p.z]]) {
        const cx = Math.floor((x - FLOOR_GRID.x0) / FLOOR_GRID.cell), cz = Math.floor((z - FLOOR_GRID.z0) / FLOOR_GRID.cell);
        if (cx < 0 || cz < 0 || cx >= FLOOR_GRID.nx || cz >= FLOOR_GRID.nz || !caked[cz * FLOOR_GRID.nx + cx]) continue;
        return { id: 'fork', label: 'the caked litter here', verb: 'Fork over', x, z, radius: 1.4, priority: 20,
          use() { farm()?.act('litter.fork', { x, z }); pose('crouch', 1.2); } };
      }
      return null;
    });
    ctx.interact.addProvider('swab', (p, inside) => {
      if (!lv() || props.carrying !== 'swabs' || !inside || !clean() || day() < CYCLE.cleanFrom + 3) return null;
      const done = new Set((farm()?.clean?.swabs || []).map((s) => s.spot));
      let best = -1, bd = 1.0;
      CLEAN.swabSpots.forEach((f, i) => { if (done.has(i)) return; const d = Math.hypot(f.x - p.x, f.z - p.z); if (d <= bd) { bd = d; best = i; } });
      if (best < 0) return null;
      const f = CLEAN.swabSpots[best];
      return { id: 'swab', label: `a swab here (${f.label.toLowerCase()})`, verb: 'Take', x: f.x, z: f.z, radius: 1.0, priority: 20,
        use() { farm()?.act('clean.swab', { x: f.x, z: f.z, spot: best }); pose('crouch', 1.0); } };
    });
  }

  // ---------------- per frame: painting, the tape line, the hose ----------------
  const tapeSlot = pool.slot(), hoseSlots = [pool.slot(), pool.slot(), pool.slot(), pool.slot()];
  function seg(slot, a, b, r, color) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    if (L < 0.01) { pool.hide(slot); return; }
    const ry = Math.atan2(-dz, dx), rz = Math.atan2(dy, Math.hypot(dx, dz));
    pool.set(slot, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, L, r, r, color, ry, 0, rz);
  }
  return {
    st,
    slots: { tape: tapeSlot, hose: hoseSlots },
    get panelsSeen() { return st.panelsSeen; },
    update(dt, level) {
      const P = pl(), f = farm();
      if (!level || !P || !f) { pool.hide(tapeSlot); for (const s of hoseSlots) pool.hide(s); return; }
      const p = P.position, yaw = P.yaw ?? 0, kind = props.carrying;
      // the scraper / washer / sprayer works a strip as he walks inside (quiet: no EV.ACTION each step)
      const paint = PAINT[kind];
      if (paint && P.isInside) {
        const bx = Math.max(xMin + 0.5, Math.min(xMax - 0.5, p.x - Math.sin(yaw) * paint.ahead));
        const bz = Math.max(zMin + 0.5, Math.min(zMax - 0.5, p.z - Math.cos(yaw) * paint.ahead));
        const lp = st.lastPaint;
        if (!lp || lp.kind !== kind || Math.hypot(bx - lp.x, bz - lp.z) > 0.3) {
          st.lastPaint = { x: bx, z: bz, kind };
          f.act(paint.id, { x: +bx.toFixed(2), z: +bz.toFixed(2), r: paint.r, quiet: true });
          st.painted++;
        }
      } else st.lastPaint = null;
      // the tape from its hook at the wall to his hand
      if (st.tape && kind === 'tape') seg(tapeSlot, { x: st.tape.x, y: HOOK_Y, z: st.tape.z }, { x: p.x - Math.sin(yaw) * 0.25, y: 1.0, z: p.z - Math.cos(yaw) * 0.25 }, 0.012, 0xe8b62a);
      else { pool.hide(tapeSlot); if (kind !== 'tape') st.tape = null; }
      // the washer hose: from the reel at the wash bay, in at the door, to his hands
      if (kind === 'washer') {
        const hand = { x: p.x - Math.sin(yaw) * 0.3 + Math.cos(yaw) * 0.2, y: 0.95, z: p.z - Math.cos(yaw) * 0.3 - Math.sin(yaw) * 0.2 };
        const pts = P.isInside
          ? [WASH_REEL, { x: SPOTS.houseDoor.x - 0.4, y: 0.03, z: zMax + 1.2 }, { x: SPOTS.houseDoor.x, y: 0.03, z: zMax - 0.6 }, { x: p.x, y: 0.03, z: p.z }, hand]
          : [WASH_REEL, { x: p.x, y: 0.03, z: p.z }, hand];
        for (let k = 0; k < hoseSlots.length; k++) { if (k < pts.length - 1) seg(hoseSlots[k], pts[k], pts[k + 1], 0.025, 0x2b2e31); else pool.hide(hoseSlots[k]); }
      } else for (const s of hoseSlots) pool.hide(s);
      void yard;
    },
    reset() { st.tape = null; st.lastPaint = null; st.panelsSeen = false; },
  };
}
