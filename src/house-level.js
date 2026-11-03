// Level 1 look of the house equipment (PHASE2.md §12.1.3): every drinker and feeder line at its
// own height (farm.water.lines[i].heightCm, farm.feed.lines[i].heightCm), the feed in the pans
// by panFill (flooded = heaped), one brooder out (no flame, no glow). Done in the vertex / fragment
// shaders of the existing merged meshes, so the house keeps its draw calls and, in the sandbox
// (all offsets 0, pans full, no brooder out), looks exactly as in Phase 1. Owner: house agent
// (package "props").
import * as THREE from 'three';

// Per-vertex attribute builder that follows a Batch as parts are added.
export class Tags {
  constructor(batch, size = 1) { this.b = batch; this.size = size; this.data = []; }
  // tag every vertex added since the last call with `value` (a number or an array of `size`)
  fill(value) {
    const n = this.b.pos.length / 3;
    const v = [].concat(value);
    while (this.data.length / this.size < n) this.data.push(...v);
  }
  attribute() { return new THREE.Float32BufferAttribute(this.data, this.size); }
}

/**
 * Lambert vertex-coloured, flat material with per-line uniforms.
 * opts.feed: aFeed (xyz pan centre at feed level, w 1 = feed disc, 2 = flood heap)
 * opts.hose: the unit hose is stretched by uLen[line]
 */
export function lineMaterial(key, { feed = false, hose = false, side = THREE.FrontSide } = {}) {
  const u = {
    uLineDY: { value: [0, 0, 0, 0] },
    uFill: { value: [1, 1, 1, 1] },
    uHeap: { value: [0, 0, 0, 0] },
    uLen: { value: [1, 1, 1, 1] },
  };
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLine; uniform float uLineDY[4];
${feed ? 'attribute vec4 aFeed; uniform float uFill[4]; uniform float uHeap[4];' : ''}
${hose ? 'uniform float uLen[4];' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  int li = int(aLine + 0.5);
  ${feed ? `
  if (aFeed.w > 0.5) {
    vec3 c = aFeed.xyz, d = transformed - c;
    if (aFeed.w < 1.5) {
      float f = uFill[li];
      float rs = mix(0.55, 1.0, f);
      transformed = c + vec3(d.x * rs, d.y, d.z * rs);
      transformed.y += mix(-0.035, 0.0, smoothstep(0.0, 0.3, f));
    } else {
      float h = uHeap[li], s = step(0.001, h);
      transformed = c + d * vec3(s, s * h, s);
    }
  }` : ''}
  ${hose ? 'transformed.y *= uLen[li];' : ''}
  transformed.y += uLineDY[li];`);
  };
  m.customProgramCacheKey = () => key;
  return { material: m, u };
}

/**
 * Brooder burners / glow with a per-heater "out" mask: attribute aHeater, uniform uOut[8].
 * mode 'emissive' darkens the burner's glow; mode 'alpha' removes the glow pool on the litter.
 */
export function brooderMask(material, key, mode) {
  const uOut = { value: [0, 0, 0, 0, 0, 0, 0, 0] };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uOut = uOut;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHeater; uniform float uOut[8]; varying float vOut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vOut = uOut[int(aHeater + 0.5)];');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vOut;');
    if (mode === 'emissive') {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 - vOut;');
    } else {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.a *= 1.0 - vOut;');
    }
  };
  material.customProgramCacheKey = () => key;
  return uOut;
}
