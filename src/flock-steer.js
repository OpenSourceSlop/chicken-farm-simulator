// Bird movement: seek target, separation (spatial hash), cold cohesion, farmer clearing,
// integration and facing. Owner: flock agent. All typed arrays, no allocation per frame.
// Stability: separation is a capped positional correction, velocities are low-pass filtered,
// and sitting birds have "static friction", so long fixed-step runs settle without jitter.
import { ACT, COLD, HOT, releaseRes } from './flock-state.js';

export function steerAll(S, grid, dt, fctx) {
  const n = S.n, b = S.bounds, rand = S.rand;
  const { px, pz, vx, vz, fx, fz, tx, tz, rad, size, act, arrived, therm, stuck, scare, sitA } = S;
  const items = grid.items, cs = grid.cellStart, gnx = grid.nx, gnz = grid.nz;
  const L = S.L, base = S.baseSpeed;
  const arriveR = 0.03 + 0.15 * L;
  const slowR = 0.08 + 1.0 * L;
  const kv = Math.min(1, dt * 5);
  const kSep = Math.min(0.5, dt * 9);
  const invDt = 1 / dt;
  const fOn = fctx.farmerOn, ffx = fctx.fx, ffz = fctx.fz, fR = fctx.farmerR;

  // personal space for this frame
  for (let i = 0; i < n; i++) {
    const a = act[i];
    let r = S.rRight;
    if (a === ACT.HUDDLE) r = S.rHuddle;
    else if (therm[i] === HOT) r = S.rHot;
    else if ((a === ACT.EAT || a === ACT.DRINK) && arrived[i]) r = 0.55 * S.rRight;
    else if (a === ACT.REST) r = 0.75 * S.rRight;
    rad[i] = Math.max(r, 0.6 * L) * size[i];
  }

  for (let i = 0; i < n; i++) {
    const x = px[i], z = pz[i], si = size[i], a = act[i], th = therm[i];
    // 1. seek the target
    let dvx = 0, dvz = 0, want = 0;
    const hurry = (th !== 0 && !arrived[i]) ? 1.6 : 1;
    const maxSp = base * si * hurry;
    const dxT = tx[i] - x, dzT = tz[i] - z, dT = Math.sqrt(dxT * dxT + dzT * dzT);
    if (!arrived[i]) {
      if (dT < arriveR) arrived[i] = 1;
      else {
        const sp = maxSp * Math.min(1, dT / slowR);
        dvx = (dxT / dT) * sp; dvz = (dzT / dT) * sp; want = sp;
      }
    } else if ((a === ACT.EAT || a === ACT.DRINK) && dT > arriveR) {
      // hold the spot at the pan or nipple against small shoves
      const sp = Math.min(maxSp, dT * 1.5);
      dvx = (dxT / dT) * sp; dvz = (dzT / dT) * sp;
    }

    // 2. neighbours
    const ri = rad[i];
    let sx = 0, sz = 0, cx = 0, cz = 0, cn = 0;
    const gx = grid.cellX(x), gz = grid.cellZ(z);
    const z0 = gz > 0 ? gz - 1 : 0, z1 = gz < gnz - 1 ? gz + 1 : gz;
    const x0 = gx > 0 ? gx - 1 : 0, x1 = gx < gnx - 1 ? gx + 1 : gx;
    for (let qz = z0; qz <= z1; qz++) {
      const row = qz * gnx;
      for (let c = row + x0, ce = row + x1; c <= ce; c++) {
        for (let k = cs[c], ke = cs[c + 1]; k < ke; k++) {
          const j = items[k];
          if (j === i) continue;
          const dx = x - px[j], dz = z - pz[j];
          const d2 = dx * dx + dz * dz;
          const rij = 0.5 * (ri + rad[j]);
          if (d2 < rij * rij) {
            if (d2 < 1e-10) { sx += (rand() - 0.5) * rij; sz += (rand() - 0.5) * rij; }
            else { const d = Math.sqrt(d2); const o = (rij - d) / d; sx += dx * o; sz += dz * o; }
          }
          if (th === COLD) { cx += dx; cz += dz; cn++; }
        }
      }
    }
    // cold birds draw together (they huddle even where there is no heat source)
    if (cn > 0) {
      const k = (0.35 * base * si) / Math.max(0.3, Math.sqrt(cx * cx + cz * cz) / cn);
      dvx -= (cx / cn) * k; dvz -= (cz / cn) * k;
    }

    // 3. farmer: a moving clearing around him
    if (fOn) {
      const dx = x - ffx, dz = z - ffz, d2 = dx * dx + dz * dz;
      const R = fR * (0.9 + 0.2 * S.boldness[i]);
      if (d2 < R * R) {
        const d = Math.sqrt(d2) + 1e-6, k = 1 - d / R, ux = dx / d, uz = dz / d;
        const flee = base * si * (1.4 + 3.0 * k);
        dvx = dvx * (1 - k) + ux * flee; dvz = dvz * (1 - k) + uz * flee;
        scare[i] = 1.2;
        if (k > 0.2 && (a !== ACT.WANDER || arrived[i])) {
          if (th !== COLD && a !== ACT.PANT) { releaseRes(S, i); act[i] = ACT.WANDER; S.actT[i] = 4 + rand() * 4; }
          const r = R - d + 0.4 + rand() * 0.8, side = (rand() - 0.5) * 0.8;
          tx[i] = x + (ux - uz * side) * r; tz[i] = z + (uz + ux * side) * r;
          tx[i] = tx[i] < b.xMin ? b.xMin : tx[i] > b.xMax ? b.xMax : tx[i];
          tz[i] = tz[i] < b.zMin ? b.zMin : tz[i] > b.zMax ? b.zMax : tz[i];
          arrived[i] = 0; stuck[i] = 0;
        }
        if (d < 0.45 * R) { const push = (0.45 * R - d) * Math.min(1, dt * 8); px[i] += ux * push; pz[i] += uz * push; }
      }
    }

    // 4. integrate
    vx[i] += (dvx - vx[i]) * kv;
    vz[i] += (dvz - vz[i]) * kv;
    let ex = sx * 0.5 * kSep, ez = sz * 0.5 * kSep;
    const eLen = Math.sqrt(ex * ex + ez * ez), eMax = dt * 2.5 * base * si;
    if (eLen > eMax) { ex *= eMax / eLen; ez *= eMax / eLen; }
    let mx = vx[i] * dt + ex, mz = vz[i] * dt + ez;
    if (sitA[i] > 0.5 && scare[i] <= 0) {
      // static friction: a sitting bird only shifts when shoved
      const m = Math.sqrt(mx * mx + mz * mz), thr = dt * 0.25 * base;
      if (m <= thr) { mx = 0; mz = 0; vx[i] *= 0.5; vz[i] *= 0.5; } else { mx *= 1 - thr / m; mz *= 1 - thr / m; }
    }
    let nx = px[i] + mx, nz = pz[i] + mz;
    nx = nx < b.xMin ? b.xMin : nx > b.xMax ? b.xMax : nx;
    nz = nz < b.zMin ? b.zMin : nz > b.zMax ? b.zMax : nz;
    const mvx = nx - px[i], mvz = nz - pz[i];
    px[i] = nx; pz[i] = nz;
    const sp = Math.sqrt(mvx * mvx + mvz * mvz) * invDt;
    S.spd[i] += (sp - S.spd[i]) * Math.min(1, dt * 8);

    // stuck: blocked by other birds or a wall on the way to the target
    if (want > 0.02) {
      const prog = (mvx * dvx + mvz * dvz) / (want * want * dt + 1e-9);
      if (prog < 0.35) stuck[i] += dt; else stuck[i] = Math.max(0, stuck[i] - dt * 2);
      const lim = a === ACT.EAT || a === ACT.DRINK ? 1.0 : 1.2;
      if (stuck[i] > lim) {
        if (a === ACT.EAT || a === ACT.DRINK) { if (dT < 0.25 + 1.2 * L) arrived[i] = 1; }
        else if (a === ACT.HUDDLE) { if (dT < S.huddleR) arrived[i] = 1; } // else keep pushing in
        else arrived[i] = 1;
      }
    }

    // 5. facing: along the walk, toward the pan or drinker line while eating/drinking
    let hx = 0, hz = 0;
    if (S.spd[i] > 0.3 * base * si) { const m = Math.sqrt(mvx * mvx + mvz * mvz) || 1; hx = mvx / m; hz = mvz / m; }
    else if (arrived[i] && a === ACT.EAT && S.res[i] >= 0) {
      const r = S.res[i];
      hx = S.pans[r * 2] - nx; hz = S.pans[r * 2 + 1] - nz;
    } else if (arrived[i] && a === ACT.DRINK && S.res[i] >= S.nPans) {
      const r = S.res[i] - S.nPans;
      hz = S.nips[r * 2 + 1] - nz; hx = 0.15 * fx[i];
    }
    if (hx !== 0 || hz !== 0) {
      const m = Math.sqrt(hx * hx + hz * hz); hx /= m; hz /= m;
      const kt = Math.min(1, dt * 6);
      let ax = fx[i] + (hx - fx[i]) * kt, az = fz[i] + (hz - fz[i]) * kt;
      let al = Math.sqrt(ax * ax + az * az);
      if (al < 1e-3) { ax = -fz[i]; az = fx[i]; al = 1; }
      fx[i] = ax / al; fz[i] = az / al;
    }
  }
}
