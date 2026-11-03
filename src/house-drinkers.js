// Nipple drinker lines: square water pipe on a round suspension tube, a nipple with a small red
// drip cup every NIPPLE_SPACING, a pressure regulator with a sight tube at the west end, an end
// sight tube at the east end; blue PVC supply with water meter and medicator on the west wall.
// Raised with flock age (nipples at chick head height). Owner: house agent.
import * as THREE from 'three';
import { COLORS, DRINKER_LINES_Z, LINE_X, NIPPLE_X as SHARED_NIPPLE_X, HOUSE_BOUNDS } from './config.js';
import { Batch, mat, table, cone } from './house-kit.js';
import { FRAME_X, TRUSS_Y } from './house-shell.js';
import { Tags, lineMaterial } from './house-level.js';

const { xMin, zMax } = HOUSE_BOUNDS;
const PIPE_Y = 0.085;                  // pipe centre above the nipple tip
const SUS_Y = 0.165;                   // suspension tube centre
export const SUPPLY_Y = 2.28;          // overhead supply main
const REG_X = LINE_X.start + 0.12;
const PVC = 0x3a78b5, STEEL = 0x9ea6ac, GALV = 0xb4bcc2;

// Nipple tip height above the litter by age: chick head height on day 1, about 0.45 m at day 42.
const NIP = [[1, 0.12], [7, 0.17], [14, 0.24], [21, 0.31], [28, 0.37], [35, 0.42], [42, 0.45]];
export const nippleHeight = (day) => table(NIP, day);

export const NIPPLE_X = SHARED_NIPPLE_X; // shared with the flock (config.js)

export function buildDrinkers(kit) {
  const { stat, group } = kit;
  const b = new Batch();
  const tags = new Tags(b);
  const pipe = COLORS.drinkerPipe, cup = COLORS.nippleCup;
  for (const [li, z] of DRINKER_LINES_Z.entries()) {
    b.box(LINE_X.end - REG_X, 0.038, 0.038, (REG_X + LINE_X.end) / 2, PIPE_Y, z, pipe);
    b.rod([REG_X, SUS_Y, z], [LINE_X.end + 0.05, SUS_Y, z], 0.014, GALV, 6);
    for (let x = REG_X + 0.6; x < LINE_X.end; x += 1.2) b.box(0.03, SUS_Y - PIPE_Y, 0.046, x, (PIPE_Y + SUS_Y) / 2, z, 0x808a91);
    for (const x of NIPPLE_X) {
      b.add(cone(0.009, 0.005, 0.066, 5, true), STEEL, mat(x, PIPE_Y - 0.052, z));
      b.rod([x, PIPE_Y - 0.02, z + 0.018], [x, -0.012, z + 0.04], 0.004, cup, 3, true);
      b.add(cone(0.022, 0.014, 0.016, 6), cup, mat(x, -0.018, z + 0.04));
    }
    // pressure regulator with sight tube (west end)
    b.box(0.13, 0.2, 0.13, REG_X, PIPE_Y + 0.02, z, 0xe9edf0);
    b.box(0.14, 0.05, 0.14, REG_X, PIPE_Y + 0.14, z, 0x2f6fb5);
    b.cyl(0.03, 0.04, REG_X, PIPE_Y + 0.19, z, 0x2f6fb5, 8);                  // pressure knob
    b.cyl(0.012, 0.5, REG_X + 0.1, PIPE_Y + 0.29, z, 0xbfe3ec, 6);           // sight tube
    b.add(new THREE.SphereGeometry(0.016, 6, 4), 0xd8322f, mat(REG_X + 0.1, PIPE_Y + 0.27, z));
    b.cyl(0.018, 0.03, REG_X + 0.1, PIPE_Y + 0.55, z, 0xe9edf0, 6);
    b.rod([REG_X + 0.06, PIPE_Y + 0.06, z], [REG_X + 0.1, PIPE_Y + 0.06, z], 0.012, 0xbfe3ec, 4);
    // end of line: flush valve and sight tube (east end)
    b.box(0.08, 0.06, 0.06, LINE_X.end + 0.02, PIPE_Y, z, 0xe9edf0);
    b.cyl(0.012, 0.42, LINE_X.end + 0.02, PIPE_Y + 0.24, z, 0xbfe3ec, 6);
    b.add(new THREE.SphereGeometry(0.016, 6, 4), 0xd8322f, mat(LINE_X.end + 0.02, PIPE_Y + 0.2, z));
    tags.fill(li);
  }
  // one mesh for the four lines; each line's own height is a vertex offset (house-level.js)
  const lineMat = lineMaterial('house-drinker-lines');
  const lineGeo = b.geometry();
  lineGeo.setAttribute('aLine', tags.attribute());
  const lineMesh = new THREE.Mesh(lineGeo, lineMat.material);
  lineMesh.receiveShadow = true;
  const lineGroup = new THREE.Group();
  lineGroup.add(lineMesh);
  group.add(lineGroup);

  // supply hoses from the main down to each regulator (stretched as the lines rise)
  const hoses = new Batch();
  const hoseTags = new Tags(hoses);
  for (const [li, z] of DRINKER_LINES_Z.entries()) { hoses.cyl(0.013, 1, REG_X, -0.5, z, 0x2a5f93, 6); hoseTags.fill(li); }
  const hoseMat = lineMaterial('house-drinker-hoses', { hose: true });
  const hoseGeo = hoses.geometry();
  hoseGeo.setAttribute('aLine', hoseTags.attribute());
  const hoseMesh = new THREE.Mesh(hoseGeo, hoseMat.material);
  hoseMesh.receiveShadow = true;
  const hoseGroup = new THREE.Group();
  hoseGroup.add(hoseMesh);
  hoseGroup.position.y = SUPPLY_Y;
  group.add(hoseGroup);

  // winch cables
  const hang = [], hangLine = [];
  for (const [li, z] of DRINKER_LINES_Z.entries()) {
    for (const x of FRAME_X) if (x > LINE_X.start && x < LINE_X.end) { hang.push(x, z); hangLine.push(li); }
  }
  const n = hang.length / 2;
  const cablePos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) cablePos.set([hang[i * 2], TRUSS_Y - 0.03, hang[i * 2 + 1], hang[i * 2], 1, hang[i * 2 + 1]], i * 6);
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePos, 3));
  const cables = new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0x5b6268 }));
  cables.frustumCulled = false;
  group.add(cables);

  // supply: riser up the west wall in the south-west corner with water meter and medicator,
  // then an overhead main across the house above the regulators
  const zs = DRINKER_LINES_Z, zr = zMax - 0.45, xr = xMin + 0.3;
  stat.rod([xr, 0, zr], [xr, SUPPLY_Y, zr], 0.03, PVC, 8);
  stat.rod([xr, SUPPLY_Y, zr], [REG_X, SUPPLY_Y, zr], 0.03, PVC, 8);
  stat.rod([REG_X, SUPPLY_Y, zr], [REG_X, SUPPLY_Y, Math.min(...zs) - 0.1], 0.03, PVC, 8);
  for (const z of zs) stat.cyl(0.035, 0.07, REG_X, SUPPLY_Y - 0.04, z, 0x2a5f93, 8);
  for (let z = zr - 0.8; z > Math.min(...zs); z -= 2.6) stat.rod([REG_X, SUPPLY_Y, z], [REG_X, TRUSS_Y, z], 0.008, 0x6d757c, 4);
  // water meter: brass body with a round dial
  stat.box(0.16, 0.1, 0.1, xr, 0.95, zr, 0xb08d3c);
  stat.add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), 0x24496e, mat(xr + 0.04, 0.95, zr, 0, 0, Math.PI / 2));
  stat.add(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 12), 0xeef2f4, mat(xr + 0.075, 0.95, zr, 0, 0, Math.PI / 2));
  // medicator on a bypass loop
  const zm = zr - 0.35;
  stat.rod([xr, 0.62, zr], [xr, 0.62, zm], 0.022, PVC, 6);
  stat.rod([xr, 1.32, zr], [xr, 1.32, zm], 0.022, PVC, 6);
  stat.cyl(0.075, 0.42, xr, 0.97, zm, 0xf1f2ee, 10);
  stat.cyl(0.08, 0.1, xr, 1.23, zm, 0x2f6fb5, 10);
  stat.cyl(0.03, 0.12, xr, 0.7, zm, 0xe2e4df, 6);
  stat.box(0.06, 0.1, 0.06, xr, 1.5, zr, 0x2f6fb5);                          // valve
  stat.box(0.04, 0.04, 0.14, xr, 1.5, zr + 0.07, 0xd8322f);

  // Level 1: each line at the farm's height (cm above the litter); sandbox: Phase 1's table
  const heights = [NaN, NaN, NaN, NaN];
  let key = '';
  return {
    nippleHeight,
    heights,               // nipple tip height of each line now (m), read by the props
    update(dt, env) {
      const farm = kit.farm, lines = farm && farm.mode === 'level' && farm.water && farm.water.lines;
      const y0 = nippleHeight(env.day);
      for (let i = 0; i < 4; i++) heights[i] = lines && lines[i] ? Math.max(0.03, (lines[i].heightCm ?? 12) / 100) : y0;
      const k = lines ? heights.map((h) => h.toFixed(4)).join() : `p${y0.toFixed(5)}`;
      if (k === key) return;
      key = k;
      // the group carries the common height (Phase 1 exactly in the sandbox), uniforms the rest
      const base = lines ? 0 : y0;
      lineGroup.position.y = base;
      for (let i = 0; i < 4; i++) {
        lineMat.u.uLineDY.value[i] = heights[i] - base;
        hoseMat.u.uLen.value[i] = Math.max(0.05, SUPPLY_Y - (heights[i] + PIPE_Y + 0.16));
      }
      for (let i = 0; i < n; i++) cablePos[i * 6 + 4] = heights[hangLine[i]] + SUS_Y + 0.014;
      cableGeo.attributes.position.needsUpdate = true;
    },
  };
}
