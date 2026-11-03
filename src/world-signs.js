// Painted signs drawn on canvases (no image files): the farm gate sign and the office sign.
// Owner: world agent.
import * as THREE from 'three';

const FONT = '"Chakra Petch", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const BODY = '"Sarabun", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

function fitText(g, text, maxW, size, weight, family) {
  let s = size;
  do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
}

// Pictogram: a boot stepping into a tray of disinfectant
function bootIcon(g, x, y, s, ink, liquid) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = liquid;
  g.fillRect(-46, 26, 92, 14);
  g.strokeStyle = ink; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-50, 14); g.lineTo(-50, 42); g.lineTo(50, 42); g.lineTo(50, 14); g.stroke();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(-14, -44); g.lineTo(10, -44); g.lineTo(10, 8); g.lineTo(34, 14); g.quadraticCurveTo(40, 30, 30, 32);
  g.lineTo(-16, 32); g.lineTo(-16, -44); g.closePath(); g.fill();
  g.restore();
}
// Pictogram: a truck under spray nozzles
function truckIcon(g, x, y, s, ink, liquid) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = ink; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-56, 44); g.lineTo(-56, -46); g.lineTo(56, -46); g.lineTo(56, 44); g.stroke();
  g.fillStyle = liquid;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 15, -40); g.lineTo(i * 15 - 5, -28); g.lineTo(i * 15 + 5, -28); g.fill(); }
  g.fillStyle = ink;
  g.fillRect(-40, -18, 50, 40);
  g.beginPath(); g.moveTo(12, -6); g.lineTo(32, -6); g.lineTo(42, 8); g.lineTo(42, 22); g.lineTo(12, 22); g.fill();
  g.fillStyle = liquid;
  g.beginPath(); g.arc(-26, 26, 9, 0, Math.PI * 2); g.arc(28, 26, 9, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawGate(c) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const green = '#1d5a3c', cream = '#f6eed8', aqua = '#62cdbf';
  g.fillStyle = green; g.fillRect(0, 0, W, H);
  g.strokeStyle = cream; g.lineWidth = 12; g.strokeRect(20, 20, W - 40, H - 40);
  g.fillStyle = cream; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, 'FARM GATE', W - 120, 190, 700, FONT);
  g.fillText('FARM GATE', W / 2, H * 0.25);
  g.fillRect(70, H * 0.445, W - 140, 6);
  fitText(g, 'Biosecurity: dip boots,', W - 110, 84, 700, BODY);
  g.fillText('Biosecurity: dip boots,', W / 2, H * 0.59);
  g.fillText('spray vehicles', W / 2, H * 0.79);
  const w = g.measureText('spray vehicles').width;
  bootIcon(g, W / 2 - w / 2 - 95, H * 0.79, 0.85, cream, aqua);
  truckIcon(g, W / 2 + w / 2 + 95, H * 0.79, 0.8, cream, aqua);
}

function drawOffice(c) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.fillStyle = '#244f78'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f4ecd6'; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#f4ecd6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, 'OFFICE', W - 70, 110, 700, FONT);
  g.fillText('OFFICE', W / 2, H / 2 + 4);
}

function canvasTexture(w, h, draw, renderer) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  // Repaint once the page fonts have arrived (falls back to system fonts until then)
  try {
    document.fonts?.ready?.then(() => { draw(c); t.needsUpdate = true; });
  } catch { /* fonts API missing: keep the fallback lettering */ }
  return t;
}

export function makeSignTextures(renderer) {
  return {
    gate: canvasTexture(1024, 572, drawGate, renderer),
    office: canvasTexture(512, 160, drawOffice, renderer),
  };
}
