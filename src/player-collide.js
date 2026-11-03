// Circle-vs-collider resolution in the XZ plane. Colliders follow the shared contract:
// { type: 'box', minX, maxX, minZ, maxZ } or { type: 'circle', x, z, r }.
// Pushing the circle out along the contact normal gives sliding along walls for free.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Push point p ({x, z}) out of one collider for a circle of radius r. Returns true on contact.
export function pushOut(p, r, c) {
  if (c.type === 'box') {
    if (p.x < c.minX - r || p.x > c.maxX + r || p.z < c.minZ - r || p.z > c.maxZ + r) return false;
    const cx = clamp(p.x, c.minX, c.maxX);
    const cz = clamp(p.z, c.minZ, c.maxZ);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 1e-12) {
      const d = Math.sqrt(d2);
      const k = (r - d) / d;
      p.x += dx * k;
      p.z += dz * k;
      return true;
    }
    // Centre inside the box: leave through the nearest face.
    const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z;
    const m = Math.min(l, rr, t, b);
    if (m === l) p.x = c.minX - r;
    else if (m === rr) p.x = c.maxX + r;
    else if (m === t) p.z = c.minZ - r;
    else p.z = c.maxZ + r;
    return true;
  }
  if (c.type === 'circle') {
    const dx = p.x - c.x, dz = p.z - c.z;
    const R = c.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) return false;
    const d = Math.sqrt(d2);
    if (d < 1e-6) { p.z = c.z + R; return true; }
    const k = (R - d) / d;
    p.x += dx * k;
    p.z += dz * k;
    return true;
  }
  return false;
}

export function clampToBounds(p, r, b) {
  if (!b) return;
  p.x = clamp(p.x, b.xMin + r, b.xMax - r);
  p.z = clamp(p.z, b.zMin + r, b.zMax - r);
}

// Resolve against all colliders (a few passes settle corners), then keep inside the bounds.
export function resolve(p, r, colliders, bounds) {
  let hit = false;
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (let i = 0; i < colliders.length; i++) if (pushOut(p, r, colliders[i])) any = true;
    clampToBounds(p, r, bounds);
    if (!any) break;
    hit = true;
  }
  return hit;
}

// Move p by (dx, dz) in small sub-steps so thin walls are never skipped.
export function moveAndSlide(p, dx, dz, r, colliders, bounds, maxStep = 0.1) {
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(len / maxStep));
  let hit = false;
  for (let i = 0; i < n; i++) {
    p.x += dx / n;
    p.z += dz / n;
    if (resolve(p, r, colliders, bounds)) hit = true;
  }
  return hit;
}

export function overlapsAny(x, z, r, colliders) {
  for (const c of colliders) {
    if (c.type === 'box') {
      const cx = clamp(x, c.minX, c.maxX), cz = clamp(z, c.minZ, c.maxZ);
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    } else if (c.type === 'circle') {
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true;
    }
  }
  return false;
}
