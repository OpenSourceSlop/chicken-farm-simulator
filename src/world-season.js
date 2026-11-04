// Phase 4 (PHASE4.md §8.1, §8.6): the season's look of the land. Owner: package "scene" (world).
//   hot     the hot season (April-May): browner, drier grass, paler dry paddies (straw-coloured rice, muddy water)
//   rainy   the rainy season (August-September): a deeper green
//   null    the normal season: the Phase 1-3 colours exactly (the stored originals written back)
// The vertex colours of the terrain, the grass tufts and the rice plots are recoloured from their stored originals
// when the condition changes (a one-off pass, nothing per frame, no new shader). The wet look of rain (darker
// ground) is a colour factor on the ground's own material (the same program as mats.flat).
import * as THREE from 'three';

const GRASS_K = 6;            // greenness (g over the larger of r and b, linear) that counts as full grass

function shift(season, r, g, b, out, k0 = 0.85) {
  const green = g - Math.max(r, b);
  const k = Math.max(0, Math.min(1, green * GRASS_K)) * k0;
  if (k <= 0 || !season) { out[0] = r; out[1] = g; out[2] = b; return; }
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  let tr, tg, tb;
  if (season === 'hot') { tr = lum * 1.32; tg = lum * 1.04; tb = lum * 0.52; }  // dry, browner khaki
  else { tr = r * 0.72; tg = g * 0.98; tb = b * 0.7; }                         // rainy: deeper, lusher green
  out[0] = r + (tr - r) * k; out[1] = g + (tg - g) * k; out[2] = b + (tb - b) * k;
}

/** A recolourable vertex-colour attribute (a mesh's `color`, or an InstancedMesh's instanceColor). */
function slot(attr, k0) {
  return attr ? { attr, orig: Float32Array.from(attr.array), k0 } : null;
}

export function createSeason({ terrain, tufts, rice, ground }) {
  const slots = [slot(terrain?.geometry?.attributes?.color, 0.85), slot(tufts?.instanceColor, 0.8), slot(rice?.geometry?.attributes?.color, 0.95)].filter(Boolean);
  const tmp = [0, 0, 0];
  let season = null, wetK = -1;
  const base = ground ? ground.color.clone() : null;
  return {
    get season() { return season; },
    /** 'hot' | 'rainy' | null (any other condition looks as the normal season). */
    set(next) {
      const s = next === 'hot' || next === 'rainy' ? next : null;
      if (s === season) return false;
      season = s;
      for (const sl of slots) {
        const a = sl.attr.array, o = sl.orig;
        for (let i = 0; i < a.length; i += 3) {
          shift(s, o[i], o[i + 1], o[i + 2], tmp, sl.k0);
          a[i] = tmp[0]; a[i + 1] = tmp[1]; a[i + 2] = tmp[2];
        }
        sl.attr.needsUpdate = true;
      }
      return true;
    },
    /** The ground's wet albedo while and after rain (wet 0..1: about a quarter darker when soaked). */
    wet(wet) {
      if (!ground || Math.abs(wet - wetK) < 0.002) return;
      wetK = wet;
      ground.color.copy(base).multiplyScalar(1 - 0.27 * wet);
    },
  };
}

/** The paddy water's own colour by season (world-fields.js update): muddy and low in the hot season. */
export const WATER_BASE = { hot: new THREE.Color(0x7b7458), rainy: new THREE.Color(0x3f7f8a) };
