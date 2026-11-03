// Pictograms of the Phase 3 boards (simple line drawings on the painted 3D boards, the same flat style as
// props-boards.js's Phase 2 ones). pictogram3(g, id, x, y, w, h) draws the board's picture and returns
// true; with g null it only says whether the id has one. Owner: package "scene".
import { roundRect, FONT } from './props-kit.js';

const INK = '#33413a', WARM = '#e0892c', BLUE = '#3a78b5', PAPER = '#efe5cc', WHITE = '#f4f1ea';

const DRAW = {
  'sign-light'(g, w, h) {
    // a bulb over a row of birds, a moon for the dark hours
    g.fillStyle = '#f3cf5a'; g.beginPath(); g.arc(w * 0.38, h * 0.32, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9aa3a8'; g.fillRect(w * 0.38 - 14, h * 0.32 + 30, 28, 18);
    g.strokeStyle = WARM; g.lineWidth = 5;
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.45; g.beginPath(); g.moveTo(w * 0.38 + Math.cos(a) * 46, h * 0.32 + Math.sin(a) * 46); g.lineTo(w * 0.38 + Math.cos(a) * 62, h * 0.32 + Math.sin(a) * 62); g.stroke(); }
    g.fillStyle = '#2f4f6f'; g.beginPath(); g.arc(w * 0.78, h * 0.26, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAPER; g.beginPath(); g.arc(w * 0.84, h * 0.22, 22, 0, Math.PI * 2); g.fill();
    birds(g, w, h * 0.78, 4);
  },
  'sign-curtain'(g, w, h) {
    // the curtain rolled up under the wire, the flock walking out over the new floor
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(20, 40); g.lineTo(w - 20, 40); g.stroke();
    g.fillStyle = '#c9d8de'; roundRect(g, 30, 46, w - 60, 26, 13); g.fill();
    g.strokeStyle = BLUE; g.lineWidth = 6; g.setLineDash([10, 8]);
    g.beginPath(); g.moveTo(w * 0.25, h * 0.6); g.lineTo(w * 0.8, h * 0.6); g.stroke(); g.setLineDash([]);
    g.fillStyle = BLUE; g.beginPath(); g.moveTo(w * 0.84, h * 0.6); g.lineTo(w * 0.74, h * 0.53); g.lineTo(w * 0.74, h * 0.67); g.fill();
    birds(g, w * 0.55, h * 0.82, 3);
  },
  'sign-heat'(g, w, h) {
    // a thermometer beside a tunnel fan
    g.fillStyle = WHITE; roundRect(g, 34, 30, 30, 150, 15); g.fill();
    g.strokeStyle = INK; g.lineWidth = 4; roundRect(g, 34, 30, 30, 150, 15); g.stroke();
    g.fillStyle = '#d8322f'; g.fillRect(43, 80, 12, 100); g.beginPath(); g.arc(49, 186, 22, 0, Math.PI * 2); g.fill();
    fan(g, w * 0.64, h * 0.45, 62);
  },
  'sign-catch'(g, w, h) {
    // a stack of crates by a truck wheel
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) crate(g, 36 + c * 82, h - 66 - r * 50, 76, 44);
    g.fillStyle = '#26292c'; g.beginPath(); g.arc(w - 52, h - 40, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b8bec4'; g.beginPath(); g.arc(w - 52, h - 40, 12, 0, Math.PI * 2); g.fill();
  },
  'sign-clean'(g, w, h) {
    // a washer lance spraying over a floor
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(40, 70); g.lineTo(130, 110); g.stroke();
    g.fillStyle = '#d8b02a'; roundRect(g, 26, 56, 40, 30, 8); g.fill();
    g.strokeStyle = BLUE; g.lineWidth = 3;
    for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(134, 112); g.lineTo(150 + k * 8, h - 40 + (k % 2) * 6); g.stroke(); }
    g.fillStyle = '#8f8f88'; g.fillRect(20, h - 34, w - 40, 14);
    g.fillStyle = 'rgba(90,140,170,0.7)'; roundRect(g, 120, h - 40, 90, 10, 5); g.fill();
  },
  'sign-plan'(g, w, h) {
    // six houses and a calendar page
    for (let k = 0; k < 6; k++) {
      const x = 22 + (k % 3) * 64, y = 40 + Math.floor(k / 3) * 66;
      g.fillStyle = '#e9e3d2'; g.fillRect(x, y + 16, 54, 30);
      g.fillStyle = '#3f6f9e'; g.beginPath(); g.moveTo(x - 4, y + 18); g.lineTo(x + 27, y); g.lineTo(x + 58, y + 18); g.fill();
    }
    g.fillStyle = WHITE; roundRect(g, 40, h - 76, w - 80, 58, 8); g.fill();
    g.fillStyle = '#c4471d'; g.fillRect(40, h - 76, w - 80, 14);
    g.fillStyle = INK; g.font = `700 26px ${FONT}`; g.textAlign = 'center'; g.fillText('42 + 4 + 21', w / 2, h - 30); g.textAlign = 'left';
  },
  'sign-legs'(g, w, h) {
    // a bird standing on one good leg and a gait scale 0-5
    birds(g, w * 0.5, h * 0.5, 1, 2.2);
    g.fillStyle = INK; g.font = `700 28px ${FONT}`; g.textAlign = 'center';
    for (let k = 0; k <= 5; k++) g.fillText(String(k), 26 + k * ((w - 52) / 5), h - 22);
    g.textAlign = 'left';
  },
  'sign-air'(g, w, h) {
    // air flowing through the house, dust specks
    g.strokeStyle = BLUE; g.lineWidth = 6;
    for (let k = 0; k < 3; k++) {
      const y = 60 + k * 50;
      g.beginPath(); g.moveTo(24, y); g.bezierCurveTo(w * 0.4, y - 26, w * 0.6, y + 26, w - 40, y); g.stroke();
      g.fillStyle = BLUE; g.beginPath(); g.moveTo(w - 24, y); g.lineTo(w - 46, y - 12); g.lineTo(w - 46, y + 12); g.fill();
    }
    g.fillStyle = '#a08a62';
    for (let k = 0; k < 18; k++) { g.beginPath(); g.arc(30 + ((k * 53) % (w - 60)), 40 + ((k * 37) % (h - 80)), 3, 0, Math.PI * 2); g.fill(); }
  },
  'sign-feed'(g, w, h) {
    // a silo with crumble and pellets
    g.fillStyle = '#c3cbd1'; g.fillRect(40, 40, 80, 110);
    g.beginPath(); g.moveTo(40, 150); g.lineTo(80, 196); g.lineTo(120, 150); g.fill();
    g.beginPath(); g.moveTo(36, 42); g.lineTo(80, 14); g.lineTo(124, 42); g.fill();
    g.fillStyle = '#c9a764';
    for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(150 + (k % 4) * 18, 70 + Math.floor(k / 4) * 18, 5, 0, Math.PI * 2); g.fill(); }
    for (let k = 0; k < 8; k++) { g.save(); g.translate(152 + (k % 4) * 18, 160 + Math.floor(k / 4) * 22); g.rotate(0.4 * k); g.fillRect(-8, -3, 16, 6); g.restore(); }
  },
};

function birds(g, cx, cy, n, s = 1) {
  for (let k = 0; k < n; k++) {
    const x = cx - (n - 1) * 30 * s + k * 60 * s;
    g.fillStyle = WHITE; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, cy, 26 * s, 18 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(x + 20 * s, cy - 18 * s, 10 * s, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#d8322f'; g.fillRect(x + 16 * s, cy - 32 * s, 8 * s, 6 * s);
    g.fillStyle = '#f2a33a'; g.beginPath(); g.moveTo(x + 30 * s, cy - 20 * s); g.lineTo(x + 38 * s, cy - 17 * s); g.lineTo(x + 30 * s, cy - 14 * s); g.fill();
    g.strokeStyle = '#f0bf4a'; g.lineWidth = 3 * s;
    g.beginPath(); g.moveTo(x - 6 * s, cy + 16 * s); g.lineTo(x - 6 * s, cy + 30 * s); g.moveTo(x + 6 * s, cy + 16 * s); g.lineTo(x + 6 * s, cy + 30 * s); g.stroke();
  }
}
function fan(g, cx, cy, r) {
  g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = BLUE;
  for (let k = 0; k < 3; k++) { const a = (k * Math.PI * 2) / 3; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48, r * 0.45, r * 0.18, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
}
function crate(g, x, y, w, h) {
  g.fillStyle = '#2f6fb5'; roundRect(g, x, y, w, h, 5); g.fill();
  g.fillStyle = '#1f4f85';
  for (let k = 1; k < 5; k++) g.fillRect(x + (k * w) / 5 - 3, y + 6, 6, h - 12);
}

export function pictogram3(g, id, x, y, w, h) {
  const f = DRAW[id];
  if (!f) return false;
  if (!g) return true;
  g.save();
  g.translate(x, y);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = PAPER; roundRect(g, 0, 0, w, h, 16); g.fill();
  f(g, w, h);
  g.restore();
  return true;
}
