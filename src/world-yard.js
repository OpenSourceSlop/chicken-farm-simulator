// Trees inside the farm fence: coconut palms, banana clumps, mango and rain trees along the fence
// and around the office. One merged, wind-swayed mesh. Owner: world agent.
import { FARM } from './config.js';
import { GeoBuilder, rng } from './world-util.js';
import { F, roadDist, inKeepOut } from './world-layout.js';
import { coconutPalm, bananaClump, mangoTree, rainTree, makeFoliageMaterial } from './world-trees.js';

// Hand-placed trees near the office and gate (kind, x, z, size)
const PLACED = [
  ['coconut', -26.6, 26.8, 8.5], ['coconut', -25.4, 21.5, 9.5], ['coconut', -24.2, 24.6, 7.2],
  ['banana', -27.0, 18.9, 1.0], ['banana', -33.2, 18.8, 0.9],
  ['mango', -19.5, 34.2, 1.05], ['banana', -4, 34.6, 0.9], ['banana', 9, 34.4, 1.0],
  ['coconut', 47, 24, 9], ['mango', 50, 30.5, 1.0], ['banana', 43, 32.5, 1.0],
  ['mango', -47, 24, 1.0], ['coconut', -50.5, 28.5, 9],
  ['rain', -44, -26, 1.1], ['mango', 20, -25, 1.1], ['rain', 44, -24, 1.0],
];

function fenceRows(r) {
  const out = [];
  const add = (kind, x, z, s) => out.push([kind, x, z, s]);
  // north fence: big trees and palms
  for (let x = F.xMin + 4; x < F.xMax - 3; x += 6.5 + r() * 3) {
    const k = r();
    add(k < 0.35 ? 'coconut' : k < 0.75 ? 'mango' : k < 0.88 ? 'rain' : 'banana', x, F.zMin + 3 + r() * 1.5, k < 0.35 ? 8 + r() * 2.5 : 0.85 + r() * 0.35);
  }
  // west and east fences
  for (const x of [F.xMin + 3.2, F.xMax - 3.2]) {
    for (let z = F.zMin + 9; z < F.zMax - 6; z += 6 + r() * 3) {
      const k = r();
      add(k < 0.4 ? 'coconut' : k < 0.75 ? 'mango' : 'banana', x + (r() - 0.5) * 1.2, z, k < 0.4 ? 7.5 + r() * 3 : 0.8 + r() * 0.35);
    }
  }
  // south fence: only low banana clumps (the camera looks north from here, keep the view open)
  for (let x = 18; x < F.xMax - 10; x += 9 + r() * 5) add('banana', x, F.zMax - 2.6 - r() * 0.6, 0.75 + r() * 0.25);
  return out;
}

export function buildYardTrees(group, colliders) {
  const r = rng(404);
  const b = new GeoBuilder({ sway: true });
  const trees = [...PLACED, ...fenceRows(r)];
  const placed = [];
  let seed = 100;
  for (const [kind, x, z, s] of trees) {
    seed++;
    const isPlaced = PLACED.some((p) => p[1] === x && p[2] === z);
    if (!isPlaced) {
      if (roadDist(x, z) < 5.5 || inKeepOut(x, z, 1)) continue;
      if (Math.abs(x - FARM.gate.x) < 9 && z > 26) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 4.5)) continue;
    }
    placed.push([x, z]);
    if (kind === 'coconut') { coconutPalm(b, x, z, s, seed); colliders.push({ type: 'circle', x, z, r: 0.3 }); }
    else if (kind === 'banana') { bananaClump(b, x, z, seed, s); colliders.push({ type: 'circle', x, z, r: 0.55 }); }
    else if (kind === 'mango') { mangoTree(b, x, z, s, seed); colliders.push({ type: 'circle', x, z, r: 0.4 * s }); }
    else if (kind === 'rain') { rainTree(b, x, z, s, seed); colliders.push({ type: 'circle', x, z, r: 0.5 * s }); }
  }
  const foliage = makeFoliageMaterial();
  const mesh = b.mesh(foliage.mat, { name: 'yard-trees' });
  mesh.customDepthMaterial = foliage.depth;
  group.add(mesh);
  return foliage.uniforms;
}
