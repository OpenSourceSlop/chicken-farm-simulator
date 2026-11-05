// The level 2 / 3 equipment in the house (SKILLS.md §10; package "scene"), read through the perks and the farm's controllers;
// with SKILLS_UPDATE.live false none of it shows (the Phase 5 house exactly):
//   - the sight-tube board (Water 2 `waterAllLines`): four clear upright tubes on a white board at the water supply, each
//     with a red mark at the column the drinker plate's flow for the day needs (its pale band ±COLUMN_BAND_CM) and a blue
//     water column from farm-auto.js columnsNow, the same figure water.columns sends (a line off band sits off its mark)
//   - the winch motors (Water 3 `autoWinch`, its setting on, or a winch fault open): a grey motor box at each drinker line's
//     west end with a drum that turns while the line moves and a lamp (one instanced mesh of 4): green running, dark while
//     the farmer's own winching holds the line, red while stalled (blinking; steady under reduced motion)
//   - the controller's sensor and a dial thermometer (Heating 3 `autoBrooders`, or a drift / brooders fault): a white sensor
//     box under the controller and a round dial beside it, its needle at the house temperature (the LCD shows
//     farm.autoCtl.sensorC(): house.js), so a drifted sensor shows as two different numbers side by side
//   - the automatic scale (Growth 3 `autoScale`, or a scale fault): a small display post by the platform, and litter heaped
//     on the platform while scale-fouled is open
// One merged mesh per kind (props' occlusion material), the moving parts in the props' box pool, the lamps instanced.
// buildAutoEquipment(ctx, { pool, mats, group }) -> { update(dt, farm, env, lineY), state() }
import * as THREE from 'three';
import { SPOTS, SPOTS2, DRINKER_LINES_Z, HOUSE_BOUNDS, SKILLS_UPDATE } from './config.js';
import { Batch, placer, instancedParts } from './props-kit.js';
import { WATER } from './props-equip.js';
import { columnsNow, COLUMN_BAND_CM } from './farm-auto.js';
import { reducedMotion } from './world-cond.js';

const GREY = 0x8f989f, DARK = 0x2b2f33, WHITE = 0xeef1f2, CLEAR = 0xcfe9f0;
// the board stands just west of the water station, facing the same way (toward the door and the default camera)
const TB = { u: -0.99, w: 0.42, y0: 0.86, y1: 1.6, cmTop: 40 };
const TUBE_DU = [-0.135, -0.045, 0.045, 0.135];
const M_PER_CM = (TB.y1 - TB.y0) / TB.cmTop;
// the winch motors hang from the overhead supply main at each line's west end (by the regulator's hose), at about head
// height, their cable going up to the truss and east along the line's pulleys
const WX = -22.66, WY = 1.95, MAIN_Y = 2.28, TRUSS = 2.73;
// the controller (house-fittings.js: the cabinet at SPOTS.controller, its face 0.09 m off the wall column)
const CX = SPOTS.controller.x, CZ = HOUSE_BOUNDS.zMin + 0.12;
const DIAL = { x: CX + 0.44, y: 1.5, z: CZ + 0.07, r: 0.085 };
const SENS = { x: CX + 0.16, y: 0.96, z: CZ + 0.05 };
const SC = { x: SPOTS2.birdScale.x + 0.45, z: SPOTS2.birdScale.z + 0.1 };

function buildTubes(b) {
  const T = placer(b, WATER.x, WATER.z, WATER.face);
  for (const du of [-0.17, 0.17]) T.box(0.04, 1.1, 0.04, TB.u + du, 0.55, -0.05, GREY);         // legs
  T.box(TB.w, 0.92, 0.02, TB.u, 1.22, -0.03, WHITE);                                               // white board
  T.box(TB.w, 0.07, 0.025, TB.u, 1.72, -0.025, 0x2f5d8a);                                          // blue header strip
  T.box(TB.w - 0.06, 0.03, 0.06, TB.u, TB.y0 - 0.03, 0.0, 0xe2e4df);                               // the manifold the tubes stand on
  TUBE_DU.forEach((du, i) => {
    T.box(0.024, TB.y1 - TB.y0 + 0.04, 0.024, TB.u + du, (TB.y0 + TB.y1) / 2, 0.012, CLEAR);       // the clear tube
    T.box(0.032, 0.02, 0.032, TB.u + du, TB.y1 + 0.03, 0.012, WHITE);                              // its cap
    for (let k = 0; k <= i; k++) T.box(0.012, 0.012, 0.01, TB.u + du - 0.012 * i + 0.024 * k, TB.y0 - 0.075, 0.0, DARK); // line 1-4: dots
    for (let cm = 10; cm < TB.cmTop; cm += 10) T.box(0.012, 0.004, 0.006, TB.u + du + 0.02, TB.y0 + cm * M_PER_CM, -0.016, 0x6d757c); // 10 cm ticks
  });
  T.rod([TB.u + 0.19, TB.y0 - 0.03, 0.0], [-0.12, 0.72, 0.04], 0.012, 0x3a78b5, 6);                // fed from the manifold
}

function buildWinches(b) {
  DRINKER_LINES_Z.forEach((z) => {
    b.rod([WX, WY + 0.08, z], [WX, MAIN_Y, z], 0.012, 0x6d757c, 4);                                 // hanger from the main
    b.box(0.32, 0.2, 0.2, WX, WY, z, GREY);                                                         // motor box
    b.box(0.1, 0.14, 0.14, WX - 0.21, WY, z, 0x6d757c);                                             // gearbox
    b.box(0.26, 0.02, 0.18, WX, WY + 0.11, z, 0x7c858c);                                            // lid
    b.box(0.06, 0.03, 0.06, WX + 0.06, WY + 0.125, z + 0.04, DARK);                                 // lamp socket
    b.rod([WX + 0.21, WY + 0.04, z + 0.07], [WX + 0.21, TRUSS - 0.04, z + 0.07], 0.004, 0x5b6268, 3); // cable up from the drum
    b.rod([WX + 0.21, TRUSS - 0.04, z + 0.07], [-20, TRUSS - 0.04, z + 0.07], 0.004, 0x5b6268, 3);   // and along the pulleys
  });
}

function buildSensor(b) {
  b.box(0.11, 0.14, 0.05, SENS.x, SENS.y, SENS.z, 0xf1f2ee);                                       // sensor box
  for (let k = 0; k < 4; k++) b.box(0.08, 0.008, 0.006, SENS.x, SENS.y - 0.04 + k * 0.025, SENS.z + 0.027, 0x9aa2a8); // vent slots
  b.rod([SENS.x, SENS.y + 0.07, SENS.z], [SENS.x, 1.15, SENS.z], 0.006, 0x2b2f33, 4);              // cable up to the cabinet
  b.box(0.22, 0.24, 0.02, DIAL.x, DIAL.y, CZ + 0.01, 0x9aa2a8);                                    // backing plate on the column
  b.add(new THREE.CylinderGeometry(DIAL.r + 0.012, DIAL.r + 0.012, 0.03, 16), 0x3d4a55, new THREE.Matrix4().compose(new THREE.Vector3(DIAL.x, DIAL.y, DIAL.z - 0.008), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)));
  b.add(new THREE.CylinderGeometry(DIAL.r, DIAL.r, 0.01, 16), 0xf4f4ef, new THREE.Matrix4().compose(new THREE.Vector3(DIAL.x, DIAL.y, DIAL.z + 0.004), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)));
  for (let k = 0; k <= 5; k++) {                                                                   // ticks 0, 10, .. 50 °C over 270°
    const a = dialAngle(k * 10), r = DIAL.r - 0.012;
    b.box(0.006, 0.016, 0.004, DIAL.x + Math.sin(a) * r, DIAL.y + Math.cos(a) * r, DIAL.z + 0.011, DARK, 0, 0, -a);
  }
  b.box(0.05, 0.012, 0.004, DIAL.x, DIAL.y - 0.045, DIAL.z + 0.011, 0x2f5d8a);                     // °C plate
}

function buildScale(b) {
  const P = placer(b, SC.x, SC.z, 0);
  P.box(0.05, 0.95, 0.05, 0.38, 0.475, -0.12, GREY);                                               // display post
  P.box(0.24, 0.02, 0.24, 0.38, 0.01, -0.12, 0x6d757c);
  P.box(0.22, 0.14, 0.07, 0.38, 1.0, -0.12, 0xe9edf0);                                             // display
  P.box(0.17, 0.07, 0.008, 0.38, 1.01, -0.082, 0x1e3a2a);
  P.rod([0.38, 0.9, -0.12], [0.05, 0.55, 0.0], 0.005, DARK, 3);                                    // load cell cable
}

/** The dial's needle angle (radians, 0 = up) for a temperature: 0..50 °C over 270°. */
export function dialAngle(c) { return -2.356 + (Math.max(0, Math.min(50, c)) / 50) * 4.712; }

export function buildAutoEquipment(ctx, { pool, mats, group }) {
  const make = (build, name) => {
    const b = new Batch(); build(b);
    const m = b.mesh(mats.out || mats.vc, { cast: false, receive: true });
    m.name = name; m.visible = false; group.add(m);
    return m;
  };
  const tubes = make(buildTubes, 'props-auto-tubes'), winches = make(buildWinches, 'props-auto-winches');
  const sensor = make(buildSensor, 'props-auto-sensor'), scale = make(buildScale, 'props-auto-scale');
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const lamps = instancedParts(new THREE.SphereGeometry(0.042, 8, 6), lampMat, DRINKER_LINES_Z.length, { cast: false });
  lamps.name = 'props-auto-lamps'; lamps.visible = false; group.add(lamps);
  const slot = (n) => Array.from({ length: n }, () => pool.slot());
  const S = { cols: slot(4), marks: slot(4), bands: slot(4), drums: slot(4), stripes: slot(4), needle: pool.slot(), litter: slot(6) };
  const T = placer(new Batch(), WATER.x, WATER.z, WATER.face);   // its P() for the pool parts on the board
  const st = { t: 0, acc: 0, cols: null, lampState: ['off', 'off', 'off', 'off'], prevY: [NaN, NaN, NaN, NaN], spin: [0, 0, 0, 0], ang: [0, 0, 0, 0], status: null, shown: {} };
  const _m = new THREE.Matrix4(), _c = new THREE.Color(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const LAMP = { green: 0x5cff6a, red: 0xff3a2a, off: 0x2f3a2f };

  function hideAll(list) { for (const i of list) pool.hide(i); }
  const openOf = (farm, system) => (farm.auto?.faults || []).filter((f) => f.phase === 'open' && f.system === system);

  return {
    update(dt, farm, env, lineY) {
      st.t += dt;
      const live = !!SKILLS_UPDATE.live && farm?.mode === 'level', P = ctx.perks;
      const has = (k) => live && !!P?.has?.(k);
      const refresh = (st.acc -= dt) <= 0;
      if (refresh) { st.acc = 0.25; st.status = live && farm.autoCtl?.status ? farm.autoCtl.status() : null; }
      // ---- the sight tubes (Water 2) ----
      const showTubes = has('waterAllLines');
      tubes.visible = showTubes;
      if (showTubes) {
        if (!st.cols || refresh) { try { st.cols = columnsNow(farm, env); } catch { st.cols = null; } }
        (st.cols || []).forEach((c, i) => {
          const du = TB.u + TUBE_DU[i];
          const h = Math.max(0.004, Math.min(TB.cmTop, c.cm) * M_PER_CM);
          let [x, z] = T.P(du, 0.012);
          // the water fills the clear tube up to its column (a box a little wider than the tube)
          pool.set(S.cols[i], x, TB.y0 + h / 2, z, 0.027, h, 0.027, c.inBand ? 0x3a86d0 : 0x2f6fb5, WATER.face);
          pool.set(S.marks[i], x, TB.y0 + c.markCm * M_PER_CM, z, 0.05, 0.007, 0.033, 0xd8322f, WATER.face);
          [x, z] = T.P(du, -0.018);
          pool.set(S.bands[i], x, TB.y0 + c.markCm * M_PER_CM, z, 0.04, 2 * COLUMN_BAND_CM * M_PER_CM, 0.004, 0xbfe3c4, WATER.face);
        });
      } else if (st.shown.tubes) { hideAll(S.cols); hideAll(S.marks); hideAll(S.bands); }
      st.shown.tubes = showTubes;
      // ---- the winch motors (Water 3) ----
      const stalls = live ? openOf(farm, 'winch') : [];
      const showWinch = has('autoWinch') || stalls.length > 0;
      winches.visible = lamps.visible = showWinch;
      if (showWinch) {
        const on = !!farm.auto?.on?.winch, hold = farm.auto?.hold?.winch || {};
        const blink = reducedMotion() ? 1 : (st.t % 0.9) < 0.55 ? 1 : 0;
        DRINKER_LINES_Z.forEach((z, i) => {
          const stalled = stalls.some((f) => f.id === 'winch-stall' && Math.round(f.args?.line ?? 0) === i);
          const held = Number(hold[i]) > env.day;
          const state = stalled ? 'stalled' : !on ? 'off' : held ? 'held' : 'running';
          st.lampState[i] = state;
          const col = state === 'stalled' ? (blink ? LAMP.red : LAMP.off) : state === 'running' ? LAMP.green : LAMP.off;
          _p.set(WX + 0.06, WY + 0.16, z + 0.04); _q.identity();   // on the lid: seen from the camera above
          lamps.setMatrixAt(i, _m.compose(_p, _q, _s)); lamps.setColorAt(i, _c.set(col));
          // the drum turns while the line moves (its height from the house: farm.water.lines[i].heightCm)
          const y = lineY ? lineY[i] : NaN;
          if (Number.isFinite(st.prevY[i]) && Math.abs(y - st.prevY[i]) > 1e-5) st.spin[i] = Math.sign(y - st.prevY[i]) * 1.2;
          st.prevY[i] = y;
          if (st.spin[i] !== 0 && !stalled) { st.ang[i] += Math.sign(st.spin[i]) * dt * 5; st.spin[i] -= Math.sign(st.spin[i]) * Math.min(Math.abs(st.spin[i]), dt); }
          pool.set(S.drums[i], WX + 0.21, WY, z + 0.04, 0.08, 0.08, 0.13, 0x5f676d, 0, 0, st.ang[i]);
          pool.set(S.stripes[i], WX + 0.21 + Math.sin(st.ang[i]) * 0.041, WY - Math.cos(st.ang[i]) * 0.041, z + 0.04, 0.014, 0.014, 0.135, 0xe8a23a, 0, 0, st.ang[i]);
        });
        lamps.instanceMatrix.needsUpdate = true; if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
      } else if (st.shown.winch) { hideAll(S.drums); hideAll(S.stripes); for (let i = 0; i < 4; i++) lamps.setMatrixAt(i, zero); lamps.instanceMatrix.needsUpdate = true; }
      st.shown.winch = showWinch;
      // ---- the sensor and the dial thermometer (Heating 3) ----
      const showSensor = has('autoBrooders') || (live && ((farm.auto?.drift || 0) !== 0 || openOf(farm, 'brooders').length > 0));
      sensor.visible = showSensor;
      if (showSensor) {
        const a = dialAngle(env.houseTemp);
        pool.set(S.needle, DIAL.x + Math.sin(a) * 0.03, DIAL.y + Math.cos(a) * 0.03, DIAL.z + 0.014, 0.006, 0.07, 0.004, 0xc4471d, 0, 0, -a);
      } else if (st.shown.sensor) pool.hide(S.needle);
      st.shown.sensor = showSensor;
      // ---- the automatic scale (Growth 3): its display post, and litter on the platform while it is fouled ----
      const scaleFaults = live ? openOf(farm, 'scale') : [];
      const showScale = has('autoScale') || scaleFaults.length > 0;
      const fouled = scaleFaults.some((f) => f.id === 'scale-fouled');
      scale.visible = showScale;
      if (fouled) {
        [[-0.1, 0.05, 0.16, 0.035, 0.12, 0.3], [0.08, -0.07, 0.14, 0.03, 0.1, 1.2], [0.1, 0.11, 0.12, 0.028, 0.09, 2.1], [-0.12, -0.1, 0.1, 0.025, 0.08, 0.7], [0.0, 0.0, 0.18, 0.02, 0.14, 1.7], [-0.02, 0.14, 0.06, 0.03, 0.05, 2.6]].forEach(([u, v, w, h, d, ry], k) => {
          pool.set(S.litter[k], SC.x + u, 0.09 + h / 2, SC.z + v, w, h, d, k % 2 ? 0x7a5c35 : 0x8f7246, ry);
        });
      } else if (st.shown.fouled) hideAll(S.litter);
      st.shown.fouled = fouled;
    },
    /** What shows now (the harness: __game.props.debug.auto.state()). */
    state() {
      return { tubes: tubes.visible, columns: tubes.visible && st.cols ? st.cols.map((c) => ({ ...c })) : null,
        winch: winches.visible, lamps: winches.visible ? [...st.lampState] : null, drumTurns: [...st.ang].map((a) => +a.toFixed(2)),
        sensor: sensor.visible, dialC: sensor.visible ? +ctx.env?.houseTemp?.toFixed?.(1) : null,
        scale: scale.visible, fouled: !!st.shown.fouled };
    },
    meshes: { tubes, winches, sensor, scale, lamps },
  };
}
