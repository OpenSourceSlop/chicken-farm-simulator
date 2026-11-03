// The Level 1 sign boards in 3D, painted from content-signs.js BOARDS: sign-water, sign-vent and
// sign-litter on north-wall columns (facing into the house like the Phase 1 brooder sign), and
// sign-chicks and sign-health on low posts outside the south wall (below the HOUSE 1 sign). All
// five faces share one canvas atlas and one draw call. Also the orange "facts" tabs that mark the
// boards and equipment plates the current job links to (props.highlight). Owner: package "props".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPOTS, SPOTS2, SPOTS3, HOUSE_BOUNDS } from './config.js';
import { BOARDS, sourceLabel } from './content-signs.js';
import { BOARDS_CYCLE } from './content-signs-cycle.js';
import { pictogram3 } from './props-pictos.js';
import { Batch, canvasTexture, roundRect, FONT, instancedParts } from './props-kit.js';

const { zMin } = HOUSE_BOUNDS;
const FACE_Z = zMin + 0.12;              // front of the north-wall columns (as house-fittings.js)
export const BOARD_W = 1.5, BOARD_H = 1.04;
const PX_W = 1024, PX_H = 710;
const OUT_TILT = 0.3;                    // outdoor boards lean back toward the high camera

const HEAD = { 'sign-water': '#2f6fb5', 'sign-vent': '#3d7f6f', 'sign-litter': '#a8742c', 'sign-chicks': '#c4471d', 'sign-health': '#8c3b5a',
  // Phase 3 boards (BOARDS_CYCLE)
  'sign-plan': '#4a5f8c', 'sign-light': '#b08a1c', 'sign-curtain': '#3d7f6f', 'sign-legs': '#8c5a3b', 'sign-air': '#4f7f9a',
  'sign-droppings': '#7a5a36', 'sign-heat': '#c4471d', 'sign-feed': '#a8742c', 'sign-catch': '#2f6fb5', 'sign-clean': '#2f7a6a' };

/** Board ids and where they hang. inside: true = north wall, false = outside the south wall. */
export const BOARD_SPOTS = [
  { id: 'sign-water', ...SPOTS2.signWater },
  { id: 'sign-vent', ...SPOTS2.signVent },
  { id: 'sign-litter', ...SPOTS2.signLitter },
  { id: 'sign-chicks', ...SPOTS2.signChicks },
  { id: 'sign-health', ...SPOTS2.signHealth },
];
/** Phase 3 boards (content-signs-cycle.js BOARDS_CYCLE) at config SPOTS3; inside ones hang on the
 *  north-wall columns, outside ones stand on posts (the office porch, the silo gauge, the south wall,
 *  the wash bay). */
export const BOARD_SPOTS3 = [
  { id: 'sign-light', ...SPOTS3.signLight }, { id: 'sign-curtain', ...SPOTS3.signCurtain }, { id: 'sign-legs', ...SPOTS3.signLegs },
  { id: 'sign-air', ...SPOTS3.signAir }, { id: 'sign-droppings', ...SPOTS3.signDroppings }, { id: 'sign-heat', ...SPOTS3.signHeat },
  { id: 'sign-plan', ...SPOTS3.signPlan }, { id: 'sign-feed', ...SPOTS3.signFeed }, { id: 'sign-catch', ...SPOTS3.signCatch },
  { id: 'sign-clean', ...SPOTS3.signClean },
];

// A short line for the 3D board: the first sentence, or the part before a colon when that part
// says enough on its own. The full text is on the E panel.
export function shortLine(item) {
  if (item.short) return item.short;
  let t = item.text.trim();
  const dot = t.search(/\.\s/);
  if (dot > 0) t = t.slice(0, dot + 1);
  const colon = t.indexOf(': ');
  if (colon >= 25 && t.length > 90) t = `${t.slice(0, colon)}.`;
  return t;
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Pictograms (simple line drawings, the same ideas as the ui panels draw).
function pictogram(g, id, x, y, w, h) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = '#efe5cc'; roundRect(g, 0, 0, w, h, 16); g.fill();
  const ink = '#33413a', warm = '#e0892c', blue = '#3a78b5';
  g.strokeStyle = ink; g.lineWidth = 6;
  if (id === 'nipple-angle') {
    g.beginPath(); g.moveTo(14, 46); g.lineTo(w - 14, 46); g.stroke();                 // pipe
    g.fillStyle = '#d8322f'; g.fillRect(w / 2 - 6, 50, 12, 26);                         // nipple
    g.fillStyle = '#f3cf5a';
    g.beginPath(); g.ellipse(w / 2 - 6, h - 60, 46, 34, -0.2, 0, Math.PI * 2); g.fill(); // chick body
    g.beginPath(); g.arc(w / 2 + 2, 104, 24, 0, Math.PI * 2); g.fill();                  // head up to the nipple
    g.fillStyle = warm; g.beginPath(); g.moveTo(w / 2 + 2, 78); g.lineTo(w / 2 - 6, 86); g.lineTo(w / 2 + 10, 86); g.fill();
    g.strokeStyle = blue; g.lineWidth = 4; g.setLineDash([8, 7]);
    g.beginPath(); g.moveTo(w / 2 + 2, 120); g.lineTo(w / 2 + 70, 190); g.stroke(); g.setLineDash([]);
    g.fillStyle = ink; g.font = `600 26px ${FONT}`; g.fillText('45°', w / 2 + 40, 150);
  } else if (id === 'squeeze') {
    g.fillStyle = '#c68b5c';
    g.beginPath(); g.ellipse(w / 2, h / 2 + 8, 70, 52, 0, 0, Math.PI * 2); g.fill();      // hand
    g.fillStyle = '#d3b273';
    for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(w / 2 - 40 + (i % 6) * 16, h / 2 - 20 + Math.floor(i / 6) * 14, 7, 3, i, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = ink; g.lineWidth = 5;
    for (const dx of [-60, 60]) { g.beginPath(); g.moveTo(w / 2 + dx, 34); g.lineTo(w / 2 + dx * 0.7, 58); g.stroke(); }
  } else if (id === 'navel' || id === 'crop') {
    g.fillStyle = '#f3cf5a';
    g.beginPath(); g.ellipse(w / 2, h / 2 + 14, 66, 56, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 + 44, h / 2 - 46, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = warm; g.beginPath(); g.moveTo(w / 2 + 72, h / 2 - 50); g.lineTo(w / 2 + 92, h / 2 - 44); g.lineTo(w / 2 + 72, h / 2 - 38); g.fill();
    g.fillStyle = ink; g.beginPath(); g.arc(w / 2 + 52, h / 2 - 52, 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = blue; g.lineWidth = 5;
    g.beginPath(); g.arc(id === 'navel' ? w / 2 - 6 : w / 2 + 30, id === 'navel' ? h / 2 + 46 : h / 2 - 8, 18, 0, Math.PI * 2); g.stroke();
  } else if (id === 'droppings') {
    for (let i = 0; i < 3; i++) {
      const cx = 40 + i * ((w - 80) / 2), cy = h / 2 + 10;
      g.fillStyle = ['#7a5a36', '#9c8a5a', '#d6cdb6'][i];
      g.beginPath(); g.ellipse(cx, cy, 26, 18, 0, 0, Math.PI * 2); g.fill();
      if (i === 0) { g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(cx + 4, cy - 10, 12, 7, 0, 0, Math.PI * 2); g.fill(); }
    }
  } else { // fan (minimum ventilation) as the default pictogram
    g.strokeStyle = ink; g.lineWidth = 6;
    g.beginPath(); g.arc(w / 2, h / 2, 74, 0, Math.PI * 2); g.stroke();
    g.fillStyle = blue;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3;
      g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 36, h / 2 + Math.sin(a) * 36, 34, 14, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = ink; g.beginPath(); g.arc(w / 2, h / 2, 10, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function paintBoard(g, id, ox, oy, B = BOARDS[id]) {
  g.save();
  g.translate(ox, oy);
  const w = PX_W, h = PX_H;
  g.fillStyle = '#f5efdc'; roundRect(g, 0, 0, w, h, 22); g.fill();
  g.strokeStyle = '#2f6b5b'; g.lineWidth = 12; roundRect(g, 10, 10, w - 20, h - 20, 14); g.stroke();
  g.fillStyle = HEAD[id] || '#c4471d'; g.fillRect(24, 24, w - 48, 128);
  g.fillStyle = '#fff6e6'; g.textBaseline = 'middle'; g.textAlign = 'left';
  let size = 84;
  g.font = `700 ${size}px ${FONT}`;
  const title = B.title.toUpperCase();
  while (g.measureText(title).width > w - 100 && size > 36) { size -= 2; g.font = `700 ${size}px ${FONT}`; }
  g.fillText(title, 48, 90);
  if (B.kicker) {
    g.font = `600 26px ${FONT}`;
    const kw = g.measureText(B.kicker).width + 28;
    g.fillStyle = '#2f6b5b'; roundRect(g, 40, 164, kw, 38, 10); g.fill();
    g.fillStyle = '#f5efdc'; g.fillText(B.kicker, 54, 184);
  }
  const pic = (B.items.find((it) => it.pic) || {}).pic || (id === 'sign-vent' ? 'fan' : null) || (pictogram3(null, id) ? id : null);
  const picW = 230;
  if (pic && !pictogram3(g, pic, w - picW - 40, 172, picW, 240)) pictogram(g, pic, w - picW - 40, 172, picW, 240);
  // facts: short lines with their source in small text, as many as fit
  let y = 222;
  const left = 46, maxW = (pic ? w - picW - 70 : w - 80) - left;
  const bottom = h - 74;
  let shown = 0;
  for (const it of B.items) {
    g.font = `500 29px ${FONT}`;
    const lines = wrap(g, shortLine(it), y > 400 ? w - 92 - left : maxW);
    const need = lines.length * 34 + 30;
    if (y + need > bottom) break;
    g.fillStyle = '#c4471d'; g.beginPath(); g.arc(left + 6, y + 15, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#23302a';
    lines.forEach((l, i) => g.fillText(l, left + 22, y + 16 + i * 34));
    y += lines.length * 34;
    g.fillStyle = '#6b766f'; g.font = `500 19px ${FONT}`;
    g.fillText(`Source: ${sourceLabel(it.source)}`, left + 22, y + 8);
    y += 34;
    shown++;
  }
  g.fillStyle = '#5b6a62'; g.font = `600 22px ${FONT}`; g.textAlign = 'right';
  g.fillText(shown < B.items.length ? `${B.items.length - shown} more facts: stand here and press E` : 'Stand here and press E to read', w - 44, h - 44);
  g.restore();
}

function tabTexture() {
  return canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#ef7d1a'; roundRect(g, 0, 0, w, h, 18); g.fill();
    g.fillStyle = '#fff8ec'; g.font = `700 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('FACTS', w / 2, h / 2 + 3);
  }, { mipmaps: false });
}

// One atlas (2 columns of 1024 x 710 boards, as many rows as needed) and one merged mesh per board set.
function boardFaces(stat, spots, data, name) {
  const rows = Math.ceil(spots.length / 2), AH = rows * (PX_H + 2);
  const atlas = canvasTexture(2048, AH, (g) => {
    spots.forEach((s, i) => paintBoard(g, s.id, (i % 2) * PX_W, Math.floor(i / 2) * (PX_H + 2), data[s.id]));
  });
  const geos = [];
  const tabSpots = new Map();
  spots.forEach((s, i) => {
    const pg = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
    const u0 = (i % 2) * 0.5, u1 = u0 + 0.5;
    const vTop = 1 - (Math.floor(i / 2) * (PX_H + 2)) / AH, vBot = vTop - PX_H / AH;
    const uv = pg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? vTop : vBot);
    const M = new THREE.Matrix4();
    if (s.inside) {
      const y = 1.55, z = FACE_Z + 0.046;
      M.makeTranslation(s.x, y, z);
      // backing plate and rails on the column (a full-height column piece keeps the board up when
      // the north wall is lowered for the camera)
      stat.box(BOARD_W + 0.05, BOARD_H + 0.04, 0.04, s.x, y, FACE_Z + 0.022, 0x9aa2a8);
      for (const dy of [-0.28, 0.28]) stat.box(BOARD_W - 0.1, 0.05, 0.03, s.x, y + dy, FACE_Z - 0.004, 0x7c858c);
      stat.box(0.125, 2.72, 0.125, s.x, 1.36, zMin + 0.06, 0x8f989f);
      tabSpots.set(s.id, { x: s.x + BOARD_W / 2 - 0.12, y: y + BOARD_H / 2 + 0.08, z: z + 0.01, ry: 0, rx: 0 });
    } else {
      const y = 0.74, z = s.z;
      const R = new THREE.Matrix4().makeRotationX(-OUT_TILT);
      M.makeTranslation(s.x, y, z).multiply(R);
      // two posts and a frame, leaning back a little
      const back = (BOARD_H / 2) * Math.sin(OUT_TILT);
      for (const dx of [-BOARD_W / 2 + 0.12, BOARD_W / 2 - 0.12]) {
        stat.box(0.07, y + BOARD_H / 2 + 0.05, 0.07, s.x + dx, (y + BOARD_H / 2 + 0.05) / 2, z - back - 0.05, 0x5f676d);
      }
      stat.add(new THREE.BoxGeometry(BOARD_W + 0.08, BOARD_H + 0.08, 0.04), 0x2b3a33,
        new THREE.Matrix4().makeTranslation(s.x, y, z - 0.025).multiply(R));
      tabSpots.set(s.id, { x: s.x + BOARD_W / 2 - 0.12, y: y + (BOARD_H / 2 + 0.07) * Math.cos(OUT_TILT), z: z - (BOARD_H / 2) * Math.sin(OUT_TILT) + 0.02, ry: 0, rx: -OUT_TILT });
    }
    pg.applyMatrix4(M);
    geos.push(pg);
  });
  const faces = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: atlas }));
  faces.name = name;
  faces.receiveShadow = true;
  return { faces, tabSpots };
}

/**
 * @returns {{ group, interactables, tabs: { set(ids) }, tabSpots: Map, frames: Batch }}
 */
export function buildBoards(stat) {
  const group = new THREE.Group();
  group.name = 'props-boards';
  const p2 = boardFaces(stat, BOARD_SPOTS, BOARDS, 'props-board-faces');
  // Phase 3: the ten new boards in their own atlas (hidden with the props in the sandbox)
  const p3 = boardFaces(stat, BOARD_SPOTS3, BOARDS_CYCLE, 'props-board-faces-3');
  group.add(p2.faces, p3.faces);
  const tabSpots = new Map([...p2.tabSpots, ...p3.tabSpots]);

  // Phase 1 boards and the equipment plates get tabs too (their 3D objects are elsewhere)
  tabSpots.set('sign-brooder', { x: SPOTS.signBrooder.x + 0.42, y: 1.97, z: FACE_Z + 0.06, ry: 0, rx: 0 });
  tabSpots.set('controller-lights', { x: SPOTS.controller.x + 0.18, y: 1.86, z: FACE_Z + 0.2, ry: 0, rx: 0 });
  tabSpots.set('sign-gate', { x: SPOTS.signGate.x + 1.15, y: 2.45, z: SPOTS.signGate.z - 0.2, ry: 0, rx: -0.33 });

  const tabGeo = new THREE.PlaneGeometry(0.34, 0.13);
  const tabMat = new THREE.MeshBasicMaterial({ map: tabTexture(), toneMapped: false, side: THREE.DoubleSide });
  const MAX_TABS = 24;
  const tabMesh = instancedParts(tabGeo, tabMat, MAX_TABS, { color: false });
  tabMesh.name = 'props-facts-tabs';
  group.add(tabMesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let shown = [];
  let pulse = 0;

  const interactables = [...BOARD_SPOTS, ...BOARD_SPOTS3].map((s) => ({
    id: s.id, label: s.label, x: s.x, z: s.z, radius: 2.0, inside: s.inside, verb: 'Read the',
  }));

  return {
    group,
    interactables,
    tabSpots,
    /** Show the facts tab on these ids (unknown ids are ignored). */
    setTabs(ids) {
      shown = ids.filter((id) => tabSpots.has(id)).slice(0, MAX_TABS);
    },
    update(dt) {
      pulse += dt;
      const bob = 0.012 * Math.sin(pulse * 3.2);
      for (let i = 0; i < MAX_TABS; i++) {
        const sp = shown[i] && tabSpots.get(shown[i]);
        if (!sp) { tabMesh.setMatrixAt(i, zero); continue; }
        _p.set(sp.x, sp.y + bob, sp.z);
        _q.setFromEuler(_e.set(sp.rx || 0, sp.ry || 0, 0));
        tabMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      tabMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
