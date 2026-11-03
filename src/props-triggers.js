// Walk-through triggers of Level 1 (real seconds): the two foot dips (EV.FOOTDIP, with a splash),
// house enter / exit (EV.HOUSE_ENTER { dipped } = the house dip was crossed in the last 10 s),
// EV.CELL for each new FLOOR_GRID cell inside the house, EV.LISTEN after 2 s standing still
// inside with no panel open (once per stop), and EV.NEAR for farm.problemZones() (dwell inside
// a zone for its dwellSec, once per entry; minMoisture: the litter there must be that wet).
// Owner: package "props".
import { FARM, FLOOR_GRID } from './config.js';
import { EV } from './events.js';

const DIP = { hw: FARM.footDipGate.hw ?? 0.72, hd: FARM.footDipGate.hd ?? 0.48 }; // gate tray half sizes (world-gate.js)
const HOUSE_DIP = { hw: 0.63, hd: 0.45 };            // house tray 1.25 x 0.72 (house-door.js)
const DIPPED_FOR = 10;                               // s
const LISTEN_AFTER = 2;                              // s standing still

export function createTriggers(ctx, fx) {
  const st = {
    inGate: false, inHouseDip: false, houseDipAt: -1e9, time: 0,
    inside: null, cell: -1,
    still: 0, listened: false, lastX: NaN, lastZ: NaN,
    zones: new Map(),       // problemId -> { t, fired }
    panels: 0,
  };
  const ev = ctx.events;
  if (ev) {
    ev.on(EV.PANEL_OPEN, () => { st.panels++; st.still = 0; });
    ev.on(EV.PANEL_CLOSE, () => { st.panels = Math.max(0, st.panels - 1); st.still = 0; });
  }
  const emit = (t, p) => ev && ev.emit(t, p);
  const inRect = (p, c, h) => Math.abs(p.x - c.x) <= h.hw && Math.abs(p.z - c.z) <= h.hd;

  function update(dt, active) {
    const pl = ctx.player;
    if (!pl || !active) { st.inside = null; return; }
    st.time += dt;
    const p = pl.position;
    // foot dips
    const g = inRect(p, FARM.footDipGate, DIP);
    if (g && !st.inGate) { emit(EV.FOOTDIP, { where: 'gate' }); fx && fx.splash(p.x, p.z); }
    st.inGate = g;
    const h = inRect(p, FARM.footDipHouse, HOUSE_DIP);
    if (h && !st.inHouseDip) { st.houseDipAt = st.time; emit(EV.FOOTDIP, { where: 'house' }); fx && fx.splash(p.x, p.z); }
    if (h) st.houseDipAt = st.time;
    st.inHouseDip = h;
    // house door
    const inside = !!pl.isInside;
    if (st.inside === null) st.inside = inside;
    else if (inside !== st.inside) {
      st.inside = inside;
      if (inside) emit(EV.HOUSE_ENTER, { dipped: st.time - st.houseDipAt <= DIPPED_FOR });
      else emit(EV.HOUSE_EXIT, {});
      st.cell = -1;
    }
    // floor cells
    if (inside) {
      const cx = Math.floor((p.x - FLOOR_GRID.x0) / FLOOR_GRID.cell), cz = Math.floor((p.z - FLOOR_GRID.z0) / FLOOR_GRID.cell);
      if (cx >= 0 && cx < FLOOR_GRID.nx && cz >= 0 && cz < FLOOR_GRID.nz) {
        const c = cz * FLOOR_GRID.nx + cx;
        if (c !== st.cell) { st.cell = c; emit(EV.CELL, { cx, cz, x: p.x, z: p.z }); }
      }
    }
    // listen stop: standing still inside, no panel open, hands free of the barrow
    const moved = Math.hypot(p.x - st.lastX, p.z - st.lastZ);
    st.lastX = p.x; st.lastZ = p.z;
    const panelOpen = st.panels > 0 || pl.inputEnabled === false;
    if (!inside || panelOpen || !(moved < 0.002) || (pl.speed ?? 0) > 0.05) { st.still = 0; st.listened = false; }
    else {
      st.still += dt;
      if (st.still >= LISTEN_AFTER && !st.listened) {
        st.listened = true;
        emit(EV.LISTEN, { x: p.x, z: p.z, seconds: +st.still.toFixed(2) });
      }
    }
    // problem zones (only active, not yet found problems are listed by the farm)
    let zones = [];
    try { zones = (ctx.farm && ctx.farm.problemZones && ctx.farm.problemZones()) || []; } catch (err) { console.error(err); }
    const seen = new Set();
    for (const zn of zones) {
      seen.add(zn.problemId);
      let z = st.zones.get(zn.problemId);
      if (!z) { z = { t: 0, fired: false }; st.zones.set(zn.problemId, z); }
      let ok = Math.hypot(p.x - zn.x, p.z - zn.z) <= zn.r;
      if (ok && zn.minMoisture != null && ctx.farm.litterMoistureAt) ok = ctx.farm.litterMoistureAt(zn.x, zn.z) >= zn.minMoisture;
      if (!ok) { z.t = 0; z.fired = false; continue; }
      z.t += dt;
      if (!z.fired && z.t >= (zn.dwellSec ?? 2)) {
        z.fired = true;
        emit(EV.NEAR, { problemId: zn.problemId, x: p.x, z: p.z });
      }
    }
    for (const k of st.zones.keys()) if (!seen.has(k)) st.zones.delete(k);
  }

  return {
    update,
    reset() { st.inGate = false; st.inHouseDip = false; st.houseDipAt = -1e9; st.inside = null; st.cell = -1; st.still = 0; st.listened = false; st.zones.clear(); },
    state: st,
  };
}
