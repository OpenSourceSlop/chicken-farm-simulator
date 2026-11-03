// The brooding curtain winch (north wall at the curtain, PHASE3.md §1 Week 2, §6.2) and the gas tank gauge
// (outside, north-west of the house, §6.3). Package "panels". The winch lifts or lowers the curtain
// (house.curtain { open }); its picture shows the floor the birds have and the litter beyond the curtain.
// The gas gauge is read by gas.meter: kg left, kg burned, and what went since the farmer's last reading.
import { FLOOR_GRID, BROOD_BOUNDS } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell, readout } from './ui-equipment.js';
import { int } from './ui-format.js';
import { whenText, gasOf } from './ui-cycle-kit.js';

const { nx, nz, cell, x0 } = FLOOR_GRID;
const CURTAIN_X = 2; // the curtain hangs across the house at x 2 (Phase 1 house-brooders)
const eastCols = () => { const out = []; for (let cx = 0; cx < nx; cx++) if (x0 + (cx + 0.5) * cell > CURTAIN_X) out.push(cx); return out; };

/** Top view of the house: the floor the birds have, the litter on each metre, the curtain. */
function houseSvg(farm, curtainUp) {
  const W = 384, S = W / nx, Hh = nz * S;
  const cover = farm.litter?.coverGrid;
  let cells = '';
  for (let cx = 0; cx < nx; cx++) {
    for (let cz = 0; cz < nz; cz++) {
      const c = cover ? cover[cx * nz + cz] : 1;
      if (c >= 0.5) cells += `<rect x="${(cx * S).toFixed(1)}" y="${(cz * S).toFixed(1)}" width="${S.toFixed(1)}" height="${S.toFixed(1)}" fill="var(--sign-yellow)" opacity="${(0.35 + 0.4 * Math.min(1, c)).toFixed(2)}"/>`;
    }
  }
  const cxLine = ((CURTAIN_X - x0) / (nx * cell)) * W;
  const broodW = ((BROOD_BOUNDS.xMax - x0) / (nx * cell)) * W;
  const birds = curtainUp ? `<rect x="2" y="2" width="${W - 4}" height="${Hh - 4}" fill="none" stroke="var(--chick)" stroke-width="2" stroke-dasharray="2 3"/>`
    : `<rect x="2" y="2" width="${(broodW - 2).toFixed(1)}" height="${Hh - 4}" fill="none" stroke="var(--chick)" stroke-width="2" stroke-dasharray="2 3"/>`;
  const curtain = curtainUp ? `<path d="M${cxLine.toFixed(1)} 0v${Hh}" stroke="var(--key-sub)" stroke-width="2" stroke-dasharray="2 5"/>`
    : `<path d="M${cxLine.toFixed(1)} 0v${Hh}" stroke="var(--case-hi)" stroke-width="5"/>`;
  return `<svg viewBox="-4 -16 ${W + 8} ${Hh + 34}" aria-hidden="true"><rect x="0" y="0" width="${W}" height="${Hh}" fill="#5c5f5d" stroke="var(--plate-edge)" stroke-width="2"/>${cells}${birds}${curtain}
    <text x="4" y="-5" font-size="10" fill="var(--key-sub)" font-family="var(--font-display)">WEST · PAD</text>
    <text x="${W}" y="-5" font-size="10" text-anchor="end" fill="var(--key-sub)" font-family="var(--font-display)">FANS · EAST</text>
    <text x="${cxLine.toFixed(1)}" y="${Hh + 13}" font-size="10" text-anchor="middle" fill="var(--key-sub)" font-family="var(--font-display)">curtain ${curtainUp ? 'up' : 'down'}</text></svg>`;
}

export function buildCurtainWinch(api) {
  const { L } = api;
  const { env, farm } = L;
  const shell = equipShell({ cls: 'equip--winch', icon: ICONS.up, title: 'Brooding curtain winch', sub: 'North wall at the curtain · crank and cable', plates: ['sign-curtain'], signLinks: ['sign-litter'], onClose: L.close });
  const pic = h('div', { class: 'cyc-pic' });
  const state = readout('Curtain');
  const beyond = readout('Litter beyond the curtain');
  const up = button({ class: 'btn btn--machine btn--go' }, h('span', { html: ICONS.up, 'aria-hidden': 'true' }), 'Wind the curtain up');
  const down = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.down, 'aria-hidden': 'true' }), 'Let the curtain down');
  up.addEventListener('click', () => { L.act('house.curtain', { open: true }); liftedAt = env.day; refresh(true); });
  down.addEventListener('click', () => { L.act('house.curtain', { open: false }); refresh(true); });
  const note = h('p', { class: 'equip-note' }, 'Legend: yellow = rice husk on that metre of floor, grey = bare concrete, dotted = where the birds can go.');
  shell.main.append(pic, h('div', { class: 'equip-reads' }, state.el, beyond.el), h('div', { class: 'equip-btns' }, up, down), note);
  let liftedAt = null;
  function refresh(force) {
    const open = farm.house?.curtainOpen ?? env.broodCurtain === false;
    if (open && liftedAt == null) liftedAt = farm.stats?.curtainAt ?? null;
    state.set(open ? 'Up' : 'Down', open ? `the birds have the whole house, 48 × 12 m${liftedAt != null ? ` · lifted ${whenText(liftedAt)}` : ''}` : 'the birds have the west part, about 26 × 12 m');
    const cols = eastCols(), cover = farm.litter?.coverGrid;
    let c = 0, n = 0;
    if (cover) for (const cx of cols) for (let cz = 0; cz < nz; cz++) { c += cover[cx * nz + cz] >= 0.5 ? 1 : 0; n++; }
    beyond.set(n ? `${Math.round((100 * c) / n)} %` : '—', 'of the east part covered with husk');
    up.hidden = open; down.hidden = !open;
    const k = `${open}|${n ? c : -1}`;
    if (force || pic.__k !== k) { pic.__k = k; pic.innerHTML = houseSvg(farm, open); }
  }
  let acc = 0;
  return { el: shell.el, onOpen() { shell.refreshPlates(); }, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.5; refresh(force); } } };
}

// ---------------- gas tank ----------------
function gaugeSvg(share) {
  // an LPG float gauge, 0-100 % of the tank; the needle shows the last reading only
  const a = share == null ? -135 : -135 + Math.max(0, Math.min(1, share)) * 270;
  const ticks = [0, 20, 40, 60, 80, 100].map((p) => {
    const r = ((-135 + p * 2.7 - 90) * Math.PI) / 180;
    return `<path d="M${(50 + Math.cos(r) * 34).toFixed(1)} ${(50 + Math.sin(r) * 34).toFixed(1)}L${(50 + Math.cos(r) * 40).toFixed(1)} ${(50 + Math.sin(r) * 40).toFixed(1)}" stroke="var(--case-ink)" stroke-width="2"/>
      <text x="${(50 + Math.cos(r) * 26).toFixed(1)}" y="${(53 + Math.sin(r) * 26).toFixed(1)}" font-size="8" text-anchor="middle" fill="var(--case-ink)" font-family="var(--font-display)">${p}</text>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" width="130" height="130" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="var(--case-hi)" stroke="var(--plate-edge)" stroke-width="4"/>${ticks}
    <text x="50" y="80" font-size="9" text-anchor="middle" fill="var(--case-ink)" font-family="var(--font-display)">% LPG</text>
    <path d="M50 50L50 16" stroke="var(--hen-comb)" stroke-width="3" stroke-linecap="round" transform="rotate(${a.toFixed(1)} 50 50)"/><circle cx="50" cy="50" r="4" fill="var(--case-ink)"/></svg>`;
}

export function buildGasTank(api) {
  const { L } = api;
  const { env, farm } = L;
  const shell = equipShell({ cls: 'equip--gas', icon: ICONS.flame, title: 'Gas tank', sub: 'LPG for the brooders · float gauge', plates: ['gas-tank'], onClose: L.close });
  const gauge = h('div', { class: 'cyc-gauge' });
  const reading = readout('Gauge reading');
  const since = readout('Since your last reading');
  const read = button({ class: 'btn btn--machine btn--go' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the gauge');
  const burners = h('p', { class: 'equip-note' });
  shell.main.append(h('div', { class: 'silo-wrap' }, gauge, h('div', { class: 'equip-reads equip-reads--col' }, reading.el, since.el, read)), burners);
  const reads = []; // { t, kgUsed }
  let share = null;
  read.addEventListener('click', () => {
    const g = gasOf(L.act('gas.meter', {}));
    if (!g) { reading.set('—', `read ${env.timeLabel}: the gauge shows no figure`); return; }
    const prev = reads[reads.length - 1];
    reads.push({ t: env.day, kgUsed: g.kgUsed });
    share = g.kgLeft + g.kgUsed > 0 ? g.kgLeft / (g.kgLeft + g.kgUsed) : null;
    reading.set(`about ${int(g.kgLeft)} kg left`, `${int(g.kgUsed)} kg burned since the brooders were lit · read ${env.timeLabel}`);
    since.set(prev ? `${int(Math.max(0, g.kgUsed - prev.kgUsed))} kg` : '—', prev ? `since ${whenText(prev.t)}` : 'your first reading');
    gauge.innerHTML = gaugeSvg(share);
  });
  gauge.innerHTML = gaugeSvg(null);
  reading.set('—', 'not read yet'); since.set('—', '');
  function refresh() {
    setText(burners, env.broodersUp ? 'The brooders are off and winched up.' : env.heatersOn ? 'The brooders are burning now.' : 'The brooders are not burning now.');
  }
  let acc = 0;
  return { el: shell.el, onOpen() { shell.refreshPlates(); }, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.5; refresh(); } } };
}
