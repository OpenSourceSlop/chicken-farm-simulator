// Phase 3 yard and clean-out props (PHASE3.md §12 items 8, 11, 12): the wash bay (concrete pad, drain,
// pressure-washer cart, hose reel, drums, boot brush), the litter trailer by the west end that fills
// while the scraper works, four bait stations, the ten swab flags at CLEAN.swabSpots (clean-out days from
// day 46; a swabbed flag turns over), the stack of catching panels by the door and the panels across the
// house at the section edges on the catching night. Owner: package "scene".
import * as THREE from 'three';
import { SPOTS3, CLEAN, HARVEST, HOUSE_BOUNDS, CYCLE } from './config.js';
import { Batch, mat, clamp01, instancedParts } from './props-kit.js';
import { C } from './props-models.js';
import { C3, washerCart, drum, trailer, baitBox, catchPanel, swabFlag } from './props-cycle-models.js';

const { xMin, zMin, zMax } = HOUSE_BOUNDS;
export const WASH_REEL = { x: SPOTS3.washBay.x + 1.15, y: 0.42, z: SPOTS3.washBay.z - 0.35 };
export const TRAILER = { x: -29.3, z: 0.6 };
const PANELS_PER_EDGE = 10, EDGES = HARVEST.sections + 1;

export function buildCycleYard(stat, pool, group, mats) {
  const tabSpots = new Map(), colliders = [];

  // ---------------- wash bay ----------------
  const B = SPOTS3.washBay;
  stat.box(4.2, 0.08, 3.0, B.x, 0.04, B.z - 0.2, C3.concrete);                      // sloped pad
  stat.box(4.3, 0.12, 0.12, B.x, 0.06, B.z - 1.75, 0x9e998d);                       // kerb
  stat.box(1.6, 0.012, 0.22, B.x - 0.4, 0.085, B.z - 0.2, 0x3a3e42);                // drain grate
  for (let k = 0; k < 7; k++) stat.box(0.02, 0.014, 0.2, B.x - 1.1 + k * 0.23, 0.09, B.z - 0.2, 0x5f676d);
  {
    const b = new Batch(); washerCart(b);
    stat.add(b.geometry(), null, mat(B.x + 0.2, 0.08, B.z - 0.35));
    const d = new Batch(); drum(d, C3.drum);
    stat.add(d.geometry(), null, mat(B.x - 1.6, 0.08, B.z - 1.1));
    const d2 = new Batch(); drum(d2, C3.drumGreen);
    stat.add(d2.geometry(), null, mat(B.x - 1.0, 0.08, B.z - 1.15));
    stat.add(d2.geometry(), null, mat(B.x - 1.32, 0.08, B.z - 0.62));
  }
  // boot brush: a low frame with upright brushes, and a tap stand
  stat.box(0.6, 0.06, 0.45, B.x - 1.5, 0.11, B.z + 0.6, 0x6d757c);
  for (const s of [-1, 1]) stat.box(0.5, 0.18, 0.06, B.x - 1.5, 0.23, B.z + 0.6 + s * 0.14, 0x2f5f8a);
  stat.box(0.06, 0.9, 0.06, B.x + 1.75, 0.53, B.z + 0.7, 0x8f989f);
  stat.box(0.12, 0.05, 0.05, B.x + 1.75, 0.95, B.z + 0.76, 0xd8322f);
  colliders.push({ type: 'box', minX: B.x - 1.95, maxX: B.x - 0.65, minZ: B.z - 1.5, maxZ: B.z - 0.3 });
  colliders.push({ type: 'box', minX: B.x - 0.15, maxX: B.x + 1.5, minZ: B.z - 0.75, maxZ: B.z + 0.05 });
  tabSpots.set('wash-bay', { x: B.x + 0.6, y: 1.5, z: B.z - 0.1, ry: 0, rx: 0 });

  // ---------------- litter trailer by the west end ----------------
  {
    const b = new Batch(); trailer(b);
    stat.add(b.geometry(), null, mat(TRAILER.x, 0, TRAILER.z, 0, Math.PI / 2, 0));
    colliders.push({ type: 'box', minX: TRAILER.x - 1.05, maxX: TRAILER.x + 1.05, minZ: TRAILER.z - 1.75, maxZ: TRAILER.z + 1.75 });
  }
  const trailerHusk = pool.slot();

  // ---------------- bait stations at the four corners ----------------
  const baits = SPOTS3.bait.map((p) => {
    const b = new Batch(); baitBox(b);
    stat.add(b.geometry(), null, mat(p.x, 0.02, p.z, 0, Math.abs(p.x) > 1 ? Math.PI / 2 : 0, 0));
    return { ...p, tag: pool.slot() };
  });

  // ---------------- swab flags (pool: stick + flag each) ----------------
  const flags = CLEAN.swabSpots.map((p) => ({ ...p, stick: pool.slot(), flag: pool.slot() }));

  // ---------------- catching panels: a stack by the door, and the panels across the house ----------------
  const stack = Array.from({ length: 6 }, () => pool.slot());
  const pb = new Batch(); catchPanel(pb);
  const panels = instancedParts(pb.geometry(), mats.vc, EDGES * PANELS_PER_EDGE, { color: false });
  panels.name = 'props-catch-panels';
  panels.visible = false;
  group.add(panels);
  const _m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let panelsKey = '';

  return {
    tabSpots, colliders, flags, baits, panels,
    update(dt, farm, env, cleanDay, panelsSeen) {
      const day = env.dayNumber ?? 0;
      // trailer: fills with the litter the scraper takes out (clean-out days)
      const cover = farm.litter?.cover ?? 0, L = 1 - clamp01(cover);
      const fill = day >= CYCLE.cleanFrom ? L : 0;
      if (fill > 0.01) pool.set(trailerHusk, TRAILER.x, 0.58 + 0.33 * fill, TRAILER.z, 1.55, 0.66 * fill, 3.05, C.husk);
      else pool.hide(trailerHusk);
      // bait: a yellow block in the station once baited
      const bt = farm.clean?.baits || [];
      baits.forEach((b, i) => { if (bt[i]) pool.set(b.tag, b.x, 0.2, b.z, 0.14, 0.05, 0.08, 0xe8b62a); else pool.hide(b.tag); });
      // swab flags on clean-out days from day 46 (CYCLE.cleanFrom + 3): a swabbed place's flag turns over
      const swabbed = new Set((farm.clean?.swabs || []).map((s) => s.spot));
      const showFlags = cleanDay && day >= CYCLE.cleanFrom + 3 && !farm.house?.closed;
      flags.forEach((f, i) => {
        if (!showFlags) { pool.hide(f.stick); pool.hide(f.flag); return; }
        pool.set(f.stick, f.x, 0.3, f.z, 0.014, 0.6, 0.014, C3.flagStick);
        if (swabbed.has(i)) pool.set(f.flag, f.x + 0.012, 0.47, f.z, 0.012, 0.16, 0.1, 0x9fc59a);
        else pool.set(f.flag, f.x + 0.09, 0.53, f.z, 0.16, 0.1, 0.012, C3.flag);
      });
      // panels: stacked by the door on the catching night until they are put up (catch.panels)
      const hv = farm.harvest || {};
      const night = (day === 41 && env.hour >= 12) || (day === 42 && !hv.result);
      const up = !!(hv.panels || panelsSeen);
      const P = SPOTS3.catchPanels;
      stack.forEach((s, k) => {
        if (night && !up && (farm.flock?.alive ?? 0) > 0) pool.set(s, P.x + 0.06 * k, 0.33, P.z + 0.55, 0.03, 0.65, 1.2, k % 2 ? C3.panel : 0x2f6b4f, 0.35, 0, 0.12);
        else pool.hide(s);
      });
      // across the house at the edges of the sections still holding birds
      const secs = Array.isArray(hv.sections) ? hv.sections : [];
      const live = secs.length === HARVEST.sections && secs.some((s) => s.state !== 'waiting') && (up || secs.some((s) => s.state === 'penned' || s.state === 'catching'));
      const key = live ? secs.map((s) => s.state[0]).join('') + (up ? 'u' : '') : '';
      if (key !== panelsKey) {
        panelsKey = key;
        panels.visible = live;
        for (let e = 0; e < EDGES; e++) {
          const left = secs[e - 1], right = secs[e];
          const want = live && up && ((left && left.state !== 'done') || (right && right.state !== 'done')) && e > 0 && e < EDGES - 1;
          const x = xMin + (e * (HOUSE_BOUNDS.xMax - xMin)) / HARVEST.sections;
          for (let k = 0; k < PANELS_PER_EDGE; k++) {
            const z = zMin + 0.6 + k * 1.2;
            if (want && z < zMax) panels.setMatrixAt(e * PANELS_PER_EDGE + k, _m.makeTranslation(x, 0.02, z));
            else panels.setMatrixAt(e * PANELS_PER_EDGE + k, zero);
          }
        }
        panels.instanceMatrix.needsUpdate = true;
      }
    },
    /** where the swab provider answers: within 1 m of a flag (index into CLEAN.swabSpots) */
    nearestFlag(p, r = 1.0) {
      let best = -1, bd = r * r;
      flags.forEach((f, i) => { const d = (f.x - p.x) ** 2 + (f.z - p.z) ** 2; if (d <= bd) { bd = d; best = i; } });
      return best;
    },
  };
}
