// Flock drawing: two InstancedMeshes (close-up and distant bird), per-bird frustum culling and
// LOD by distance to the camera. Owner: flock agent.
//
// flock-pose.js writes every bird's instance matrix and pose into staging arrays. Just before each
// render, the visible birds are packed into the two meshes. The packing runs from the flock group's
// updateMatrixWorld(), which WebGLRenderer.render() calls (via scene.updateMatrixWorld) BEFORE it
// uploads instance buffers and draws shadows, so it always uses the camera actually being rendered
// (also for window.__game.renderNow() right after a teleport). It is skipped when neither the birds
// nor the camera changed. Shadows of birds just outside the view are dropped (too small to matter).
import * as THREE from 'three';
import { buildBirdGeometry } from './flock-geometry.js';

const HI_DIST = 10; // metres from the camera: closer birds use the detailed model

// count(): birds in use (slots 0..count-1; a level packs the active birds first, flock-pop.js)
export function createFlockRender(scene, camera, n, material, depth, count = () => n) {
  const stage = {
    M: new Float32Array(n * 16), A: new Float32Array(n * 4), B: new Float32Array(n * 4), C: new Float32Array(n * 4),
    R: new Float32Array(n),
  };
  const group = new THREE.Group();
  group.name = 'flock';

  function makeMesh(lod) {
    const geo = buildBirdGeometry(lod);
    const attr = (name) => {
      const at = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      at.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, at);
      return at;
    };
    const a = attr('aAnimA'), b = attr('aAnimB'), c = attr('aAnimC');
    const mesh = new THREE.InstancedMesh(geo, material, n);
    mesh.name = lod === 0 ? 'flock-near' : 'flock-far';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = depth;
    // The house's shadow roof keeps the litter in shade at every hour, so the birds' own sun shadows
    // would never show: no shadow pass for the flock (it was 1800 birds drawn a second time).
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // one fixed sphere around the house: never culled as a whole while the house is in view
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 26);
    mesh.count = 0;
    group.add(mesh);
    return { mesh, a, b, c };
  }
  const near = makeMesh(0), far = makeMesh(1);

  const frustum = new THREE.Frustum();
  const pm = new THREE.Matrix4();
  const planes = new Float64Array(24);
  const camCache = new Float64Array(33).fill(NaN);
  let dirty = true;
  let enabled = true;
  const stats = { near: 0, far: 0, culled: 0 };

  function cameraChanged() {
    const w = camera.matrixWorld.elements, p = camera.projectionMatrix.elements;
    let changed = false;
    for (let k = 0; k < 16; k++) {
      if (camCache[k] !== w[k]) { camCache[k] = w[k]; changed = true; }
      if (camCache[16 + k] !== p[k]) { camCache[16 + k] = p[k]; changed = true; }
    }
    return changed;
  }

  function copyBird(dst, k, i) {
    const M = stage.M, A = stage.A, B = stage.B, C = stage.C;
    const m = dst.mesh.instanceMatrix.array, a = dst.a.array, b = dst.b.array, c = dst.c.array;
    const o = k * 16, s = i * 16;
    for (let e = 0; e < 16; e++) m[o + e] = M[s + e];
    const q = k * 4, r = i * 4;
    a[q] = A[r]; a[q + 1] = A[r + 1]; a[q + 2] = A[r + 2]; a[q + 3] = A[r + 3];
    b[q] = B[r]; b[q + 1] = B[r + 1]; b[q + 2] = B[r + 2]; b[q + 3] = B[r + 3];
    c[q] = C[r]; c[q + 1] = C[r + 1]; c[q + 2] = C[r + 2]; c[q + 3] = C[r + 3];
  }

  // Pack visible birds into the near/far meshes for the current camera.
  function pack(force) {
    camera.updateMatrixWorld();
    if (!cameraChanged() && !dirty && !force) return;
    dirty = false;
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    for (let p = 0; p < 6; p++) {
      const pl = frustum.planes[p];
      planes[p * 4] = pl.normal.x; planes[p * 4 + 1] = pl.normal.y; planes[p * 4 + 2] = pl.normal.z; planes[p * 4 + 3] = pl.constant;
    }
    const cx = camera.matrixWorld.elements[12], cy = camera.matrixWorld.elements[13], cz = camera.matrixWorld.elements[14];
    const M = stage.M, R = stage.R, hi2 = HI_DIST * HI_DIST;
    let kn = 0, kf = 0, culled = 0;
    for (let i = 0, m = count(); i < m; i++) {
      const o = i * 16, x = M[o + 12], y = M[o + 13] + 0.4 * R[i], z = M[o + 14], r = R[i] + 0.15;
      let inside = enabled;
      if (inside) {
        for (let p = 0; p < 24; p += 4) {
          if (planes[p] * x + planes[p + 1] * y + planes[p + 2] * z + planes[p + 3] < -r) { inside = false; break; }
        }
      } else inside = true;
      if (!inside) { culled++; continue; }
      const dx = x - cx, dy = y - cy, dz = z - cz;
      if (enabled && dx * dx + dy * dy + dz * dz < hi2) copyBird(near, kn++, i);
      else copyBird(far, kf++, i);
    }
    near.mesh.count = kn; far.mesh.count = kf;
    stats.near = kn; stats.far = kf; stats.culled = culled;
    near.mesh.instanceMatrix.needsUpdate = true; near.a.needsUpdate = true; near.b.needsUpdate = true; near.c.needsUpdate = true;
    far.mesh.instanceMatrix.needsUpdate = true; far.a.needsUpdate = true; far.b.needsUpdate = true; far.c.needsUpdate = true;
  }

  group.updateMatrixWorld = function (force) {
    THREE.Group.prototype.updateMatrixWorld.call(this, force);
    pack(false);
  };
  scene.add(group);

  return {
    group, stage, stats, meshes: [near.mesh, far.mesh],
    markDirty() { dirty = true; },
    pack,
    // false: draw every bird with the distant model and no culling (debugging)
    setCulling(v) { enabled = !!v; dirty = true; },
  };
}
