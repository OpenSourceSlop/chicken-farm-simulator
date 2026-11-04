// Fittings: climate controller cabinet with a live green LCD, the BROODER HEATERS sign (both on
// steel columns of the north wall across from the door, facing into the house so the default
// camera reads them), temperature probes at bird height, two lines of LED bulbs and warm night
// lights. Owner: house agent.
import * as THREE from 'three';
import { SPOTS, HOUSE_BOUNDS } from './config.js';
import { SIGNS, SOURCES, brooderTableRows } from './content.js';
import { Batch, mat, canvasTexture, roundRect, smooth, clamp01, FONT } from './house-kit.js';
import { TRUSS_Y } from './house-shell.js';
import { nippleHeight } from './house-drinkers.js';
import { powerOff, reducedMotion } from './world-cond.js';
import { decal } from './world-util.js';

const { xMin, xMax, zMin, zMax } = HOUSE_BOUNDS;
// Boards hang on the side-wall columns at SPOTS (north wall when z < 0). IN points into the house.
const IN = SPOTS.controller.z < 0 ? 1 : -1;
const FACE_Z = IN > 0 ? zMin + 0.12 : zMax - 0.12;   // front of the wall columns
const LIGHT_Z = [-1.0, 1.0];
const BULB_Y = 2.27;
const PROBES = [{ x: -9.2, z: -1.0 }, { x: 9.2, z: 1.0 }];

function signTexture() {
  return canvasTexture(512, 360, (g, w, h) => {
    g.fillStyle = '#f3ecd8'; roundRect(g, 0, 0, w, h, 18); g.fill();
    g.strokeStyle = '#2f6b5b'; g.lineWidth = 10; roundRect(g, 8, 8, w - 16, h - 16, 12); g.stroke();
    g.fillStyle = '#c4471d'; g.fillRect(20, 20, w - 40, 64);
    g.fillStyle = '#fff6e6'; g.font = `700 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BROODER HEATERS', w / 2, 54);
    // little brooder pictogram with heat waves
    g.fillStyle = '#6d757c';
    g.beginPath(); g.moveTo(52, 140); g.lineTo(132, 140); g.lineTo(108, 118); g.lineTo(76, 118); g.closePath(); g.fill();
    g.fillStyle = '#f07a1f'; g.fillRect(70, 141, 44, 8);
    g.strokeStyle = '#f07a1f'; g.lineWidth = 4;
    for (const dx of [-22, 0, 22]) {
      g.beginPath(); g.moveTo(92 + dx, 160);
      g.bezierCurveTo(84 + dx, 172, 100 + dx, 182, 92 + dx, 196); g.stroke();
    }
    g.fillStyle = '#23302a'; g.textAlign = 'left';
    g.font = `600 26px ${FONT}`;
    g.fillText('Target house temperature', 160, 118);
    // The same rows and sources as the E panel (content.js): approximate rows carry a "~"
    g.font = `500 22px ${FONT}`;
    brooderTableRows().forEach((r, i) => {
      const col = i < 3 ? 0 : 1, row = i % 3;
      g.fillText(`Day ${r.day}`, 156 + col * 170, 160 + row * 36);
      g.fillText(`${r.approx ? '~' : ''}${r.temp.toFixed(1).replace('.0', '')} °C`, 226 + col * 170, 160 + row * 36);
    });
    const sign = SIGNS['sign-brooder'];
    g.fillStyle = '#5b6a62'; g.font = `500 17px ${FONT}`;
    g.fillText('Watch the chicks: huddled = cold, along the walls = hot', 30, 270);
    g.font = `500 14px ${FONT}`;
    g.fillText(`~ = approx.   Table: ${sign.table.source}`, 30, 302);
    g.fillText(`Reading the chicks: ${sign.readSource || SOURCES.week1}`, 30, 326);
  });
}

function lcdCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t };
}

function drawLcd(lcd, env, dark = false) {
  const { g, c } = lcd;
  // Phase 4: no power, a blank screen (the alarm lamp above it blinks on its battery)
  if (dark) { g.fillStyle = '#0b100c'; g.fillRect(0, 0, c.width, c.height); lcd.t.needsUpdate = true; return; }
  g.fillStyle = '#0e2412'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#b9e27a';
  g.font = `700 54px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(`${env.houseTemp.toFixed(1)}°C`, 14, 60);
  g.font = `600 22px ${FONT}`;
  g.fillText(`SET ${env.heaterSetpoint.toFixed(1)}   RH ${Math.round(env.houseRH)}%`, 14, 92);
  g.fillText(`FAN ${env.fansOn}  ${env.padOn ? 'PAD ON' : 'PAD --'}  ${env.heatersOn ? 'HEAT' : ''}`, 14, 118);
  lcd.t.needsUpdate = true;
}


/** A soft round glow (white at the centre, clear at the rim): the alarm lamp's light on the cabinet face. */
function glowTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildFittings(kit) {
  const { stat, group, mats } = kit;
  const back = IN > 0 ? 0 : Math.PI;                // planes face into the house
  const L = IN;                                     // x mirror: -1 keeps the south-wall layout, +1 mirrors it for the north wall

  // climate controller on the column at SPOTS.controller
  const cx = SPOTS.controller.x, cy = 1.45, cz = FACE_Z + IN * 0.09;
  stat.box(0.06, 0.62, 0.04, cx - 0.1, cy, FACE_Z + IN * 0.02, 0x6d757c);
  stat.box(0.06, 0.62, 0.04, cx + 0.1, cy, FACE_Z + IN * 0.02, 0x6d757c);
  stat.box(0.48, 0.6, 0.16, cx, cy, cz, 0x9da3a8);
  stat.box(0.44, 0.56, 0.01, cx, cy, cz + IN * 0.083, 0xb3b9bd);
  stat.box(0.3, 0.17, 0.012, cx, cy + 0.13, cz + IN * 0.088, 0x2b3236);     // LCD bezel
  for (let i = 0; i < 6; i++) stat.box(0.045, 0.03, 0.02, cx + L * (0.1 - (i % 3) * 0.1), cy - 0.07 - Math.floor(i / 3) * 0.06, cz + IN * 0.09, i === 2 ? 0xd8322f : 0x3d4a55);
  stat.box(0.04, 0.1, 0.03, cx - L * 0.2, cy, cz + IN * 0.09, 0x50585e);     // latch
  stat.cyl(0.025, 0.04, cx - L * 0.16, cy + 0.32, cz, 0xe8a23a, 8);          // alarm lamp
  stat.rod([cx + L * 0.12, cy + 0.3, cz], [cx + L * 0.12, TRUSS_Y, cz], 0.016, 0x80888e, 6);   // conduits
  stat.rod([cx - L * 0.02, cy - 0.3, cz], [cx - L * 0.02, 0.02, cz], 0.016, 0x80888e, 6);
  stat.box(0.25, 0.05, 0.012, cx, cy + 0.25, cz + IN * 0.088, 0x2f5d8a);    // brand strip
  const lcd = lcdCanvas();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.135), decal(new THREE.MeshBasicMaterial({ map: lcd.t, toneMapped: false })));
  screen.position.set(cx, cy + 0.13, cz + IN * 0.095);
  screen.rotation.y = back;
  group.add(screen);
  // Phase 4: the red alarm lamp over the amber one, lit while the house has no power (blinking; steady under
  // prefers-reduced-motion), with a little red glow on the cabinet face
  const alarm = new THREE.Group();
  const alarmLamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
  alarmLamp.position.set(cx - L * 0.16, cy + 0.36, cz + IN * 0.01);
  // review round: a soft round glow centred on the lamp (a radial gradient drawn in code), not a hard-edged red box
  const alarmGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff3020, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  alarmGlow.position.set(cx - L * 0.16, cy + 0.36, cz + IN * 0.06);
  alarmGlow.rotation.y = back;
  alarm.add(alarmLamp, alarmGlow);
  alarm.visible = false;
  group.add(alarm);

  // BROODER HEATERS sign on the column at SPOTS.signBrooder
  const sx = SPOTS.signBrooder.x, sy = 1.5;
  stat.box(1.12, 0.79, 0.04, sx, sy, FACE_Z + IN * 0.02, 0x9aa2a8);
  for (const dy of [-0.25, 0.25]) stat.box(1.0, 0.05, 0.03, sx, sy + dy, FACE_Z - IN * 0.005, 0x7c858c);   // mounting rails
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.76), decal(new THREE.MeshLambertMaterial({ map: signTexture() })));
  sign.position.set(sx, sy, FACE_Z + IN * 0.042);
  sign.rotation.y = back;
  group.add(sign);

  // LED light lines: wire under the trusses, drops, sockets; bulbs in one emissive mesh
  const bulbs = new Batch();
  for (const z of LIGHT_Z) {
    stat.rod([xMin + 0.2, TRUSS_Y - 0.03, z], [xMax - 0.2, TRUSS_Y - 0.03, z], 0.004, 0x5a6066, 4);
    for (let x = xMin + 2; x < xMax; x += 4) {
      stat.rod([x, TRUSS_Y - 0.03, z], [x, BULB_Y + 0.07, z], 0.004, 0x5a6066, 4);
      stat.cyl(0.024, 0.05, x, BULB_Y + 0.055, z, 0x2b2f33, 8);
      bulbs.add(new THREE.SphereGeometry(0.05, 8, 6), 0xffffff, mat(x, BULB_Y, z, 0, 0, 0, 1, 1.15, 1));
    }
  }
  const bulbMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0xd9d6cf, emissive: 0xfff0cc, emissiveIntensity: 0 });
  group.add(bulbs.mesh(bulbMat, { cast: false, receive: false }));
  const lamps = [-16, 0, 16].map((x) => {
    const l = new THREE.PointLight(0xffd6a2, 0, 30, 1.5);
    l.position.set(x, 4.6, 0);   // above the ridge: a top-down fill like the many bulbs give
    group.add(l);
    return l;
  });

  // temperature probes at bird height
  const probe = new Batch();
  for (const p of PROBES) {
    probe.cyl(0.018, 0.11, p.x, 0.055, p.z, 0xf1f2ee, 8);
    probe.cyl(0.022, 0.03, p.x, 0.12, p.z, 0x2b2f33, 8);
  }
  const probeGroup = new THREE.Group();
  probeGroup.add(probe.mesh(mats.vc, { cast: false }));
  group.add(probeGroup);
  const probePos = new Float32Array(PROBES.length * 6);
  PROBES.forEach((p, i) => probePos.set([p.x, TRUSS_Y - 0.03, p.z, p.x, 1, p.z], i * 6));
  const probeGeo = new THREE.BufferGeometry();
  probeGeo.setAttribute('position', new THREE.BufferAttribute(probePos, 3));
  const probeCables = new THREE.LineSegments(probeGeo, new THREE.LineBasicMaterial({ color: 0x2b2f33 }));
  probeCables.frustumCulled = false;
  group.add(probeCables);

  let lcdTimer = 0, lcdText = '', lampK = 0, bulbK = 0, lastProbeY = NaN, blink = 0;
  let darkNow = false;
  return {
    alarm,
    /** test hooks: the house lamps' strength now (0 = off) and whether the house is dark (no power) */
    get lamp() { return lampK; },
    get dark() { return darkNow; },
    update(dt, env, view) {
      const dark = powerOff(kit.farm, env);
      darkNow = dark;
      // LCD: redraw only when what it shows changes (at most 4 times a second); at once when the power goes
      lcdTimer -= dt;
      if (lcdTimer <= 0 || dark !== (lcdText === 'dark')) {
        lcdTimer = 0.25;
        const key = dark ? 'dark' : `${env.houseTemp.toFixed(1)}|${env.heaterSetpoint}|${Math.round(env.houseRH)}|${env.fansOn}|${env.padOn}|${env.heatersOn}`;
        if (key !== lcdText) { lcdText = key; drawLcd(lcd, env, dark); }
      }
      blink = dark ? (blink + dt) % 1 : 0;
      alarm.visible = dark && (reducedMotion() || blink < 0.55);
      // lights: bulbs glow while the light programme is on; the interior is lit at night. The
      // world's night factor (view.night) switches them with the yard lamps and office windows.
      const h = env.hour;
      const night = view && Number.isFinite(view.night)
        ? clamp01((view.night - 0.15) / 0.5)
        : (h >= 12 ? clamp01((h - 17.9) / 1.0) : clamp01((6.4 - h) / 0.9));
      // env.lightLevel: 0 in the dark period, the dimmer while lit (1 in the sandbox: Phase 1)
      // Phase 4: no power, no light (the night look by night; by day only the shade roof's dimness)
      const lux = env.lightsOn && !dark ? env.lightLevel ?? 1 : 0;
      bulbK = smooth(bulbK, lux, 6, dt);
      // The roof shade (house-roof.js) keeps the sun off the litter at every hour, so the house
      // lights help by day as well (23 h light programme): a third of their night strength.
      lampK = smooth(lampK, env.lightsOn && !dark ? Math.max(0.35, night) * lux : 0, dark ? 30 : 6, dt);
      if (dark) bulbK = Math.min(bulbK, lampK);
      bulbMat.emissiveIntensity = bulbK * (0.7 + 1.3 * night);
      // Tuned against the world's real night (hemisphere 1.25 at 22:00, the moon kept off the litter
      // by the roof shade): a warm fill that reads as "lights on" without washing the litter out.
      for (const l of lamps) l.intensity = lampK * 20;
      // probes follow the drinker height (bird head height)
      const py = nippleHeight(env.day) + 0.05;
      if (Math.abs(py - lastProbeY) > 1e-4) {
        lastProbeY = py;
        probeGroup.position.y = py;
        for (let i = 0; i < PROBES.length; i++) probePos[i * 6 + 4] = py + 0.135;
        probeGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
