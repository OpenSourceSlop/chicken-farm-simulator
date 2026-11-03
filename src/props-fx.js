// Small effects drawn with the shared box pool: a splash of disinfectant when a boot goes through
// a foot dip, and the drip from the leaking nipple (drops falling onto the wet patch, rings on
// the litter). Owner: package "props".
import { DRINKER_LINES_Z } from './config.js';

const SPLASH = 10, DRIPS = 4;

export function createFx(pool) {
  const drops = Array.from({ length: SPLASH }, () => ({ slot: pool.slot(), t: 9, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  const drips = Array.from({ length: DRIPS }, (_, i) => ({ slot: pool.slot(), ring: pool.slot(), t: i * 0.4 }));
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  return {
    splash(x, z) {
      for (const d of drops) {
        const a = rnd() * Math.PI * 2, v = 0.6 + rnd() * 0.9;
        Object.assign(d, { t: 0, x: x + Math.cos(a) * 0.12, y: 0.12, z: z + Math.sin(a) * 0.12, vx: Math.cos(a) * v, vy: 1.4 + rnd() * 1.2, vz: Math.sin(a) * v });
      }
    },
    /** leak: null or { x, z, y } of the dripping nipple tip */
    update(dt, leak) {
      for (const d of drops) {
        if (d.t > 0.8) { pool.hide(d.slot); continue; }
        d.t += dt;
        d.vy -= 9.8 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y < 0.1) { d.y = 0.1; d.vy = 0; d.vx *= 0.5; d.vz *= 0.5; }
        const s = 0.035 * (1 - d.t / 0.9);
        pool.set(d.slot, d.x, d.y, d.z, s, s * 1.4, s, 0x3f9aa3);
      }
      for (const d of drips) {
        if (!leak) { pool.hide(d.slot); pool.hide(d.ring); continue; }
        d.t += dt;
        const period = 1.6, ph = d.t % period;
        const fall = 0.32;                        // s from the tip to the litter
        if (ph < fall) {
          const y = leak.y - 0.5 * 9.8 * ph * ph;
          pool.set(d.slot, leak.x, Math.max(0.04, y), leak.z, 0.014, 0.03, 0.014, 0x9fd3e2);
          pool.hide(d.ring);
        } else {
          pool.hide(d.slot);
          const r = Math.min(1, (ph - fall) / 0.5);
          if (r < 1) pool.set(d.ring, leak.x, 0.04, leak.z, 0.05 + r * 0.22, 0.004, 0.05 + r * 0.22, 0x5a4a35, r * 2);
          else pool.hide(d.ring);
        }
      }
    },
    lineZ: DRINKER_LINES_Z,
  };
}
