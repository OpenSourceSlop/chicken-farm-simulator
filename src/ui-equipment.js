// Level 1 equipment panels: the shared machine case, and the feeder control box, silo gauge, rice
// husk heap and bird scale. Water (drinkers, water supply) is in ui-water.js, the level climate
// controller in ui-climate.js. Owner: package "level". Every control acts through farm.act (or a
// ui-only action on the bus); the panel shows what the machine shows, never a verdict.
import { EQUIP, FEEDER_LINES_Z, LEVEL1 } from './config.js';
import { BOARDS } from './content-signs.js';
import { h, button, setText, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { key } from './ui-controller.js';
import { buildPlate } from './ui-boards.js';
import { int, one } from './ui-format.js';

/**
 * Machine case: header with icon, title and where; a dark working plate; plate columns at the side.
 * @returns {{ el, main: HTMLElement, plates: ReturnType<typeof buildPlate>[], foldPlates() }}
 */
export function equipShell({ cls = '', icon, title, sub, plates = [], onClose, signLinks = [] }) {
  const titleId = uniqueId('equip-title');
  const { el, closeBtn } = dialogShell(`equip ${cls}`, titleId, onClose);
  const main = h('div', { class: 'equip-main' });
  const plateEls = plates.map((id) => buildPlate(id));
  const links = signLinks.length ? h('p', { class: 'equip-links' }, h('span', { html: ICONS.facts, 'aria-hidden': 'true' }),
    `Facts also on: ${signLinks.map((id) => `${BOARDS[id].title} (${BOARDS[id].where.toLowerCase()})`).join('; ')}`) : null;
  const side = plateEls.length || links ? h('div', { class: 'equip-side' }, plateEls.map((p) => p.el), links) : null;
  const screws = ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `screw screw--${p}`, 'aria-hidden': 'true' }));
  el.append(h('div', { class: 'equip-case' }, screws,
    h('header', { class: 'ctrl-brand' }, h('span', { class: 'ctrl-logo', html: icon || ICONS.sliders, 'aria-hidden': 'true' }),
      h('div', null, h('h2', { id: titleId }, title), sub ? h('p', null, sub) : null)),
    h('div', { class: `equip-grid${side ? '' : ' equip-grid--solo'}` }, main, side)), closeBtn);
  return { el, main, plates: plateEls, foldPlates() { for (const p of plateEls) p.fold(); } };
}

/** A labelled row of the working plate: led, label (+ small), controls. */
export function machineRow(title, sub, ...controls) {
  const led = h('span', { class: 'led', 'aria-hidden': 'true' });
  const small = typeof sub === 'string' ? h('small', null, sub) : sub;
  const el = h('div', { class: 'ctrl-row' }, led, h('div', { class: 'ctrl-label' }, h('span', null, title), small), h('div', { class: 'ctrl-keys' }, controls));
  return { el, led, small };
}

/** − value + with press-and-hold repeat. */
export function stepper(label, unit, onStep) {
  const out = h('output', { class: 'lcd-mini', 'aria-live': 'polite' });
  const minus = key(`${label}: one step down`, ICONS.minus, () => onStep(-1));
  const plus = key(`${label}: one step up`, ICONS.plus, () => onStep(1));
  return { els: [minus, out, plus], set: (v) => setText(out, `${v}${unit ? ` ${unit}` : ''}`) };
}

/** A wide toggle key (aria-pressed). */
export function toggleKey(onText, offText, onClick) {
  const b = button({ class: 'key key--wide', 'aria-pressed': 'false' });
  b.addEventListener('click', onClick);
  return { el: b, set(on) { b.setAttribute('aria-pressed', String(on)); setText(b, on ? onText : offText); } };
}

/** A small LCD readout box with a caption, for a reading the farmer took. */
export function readout(label) {
  const v = h('span', { class: 'readout-v' }, '—');
  const sub = h('span', { class: 'readout-sub' });
  const el = h('div', { class: 'readout' }, h('span', { class: 'readout-k' }, label), v, sub);
  return { el, set(text, subText = '') { setText(v, text); setText(sub, subText); } };
}

// ---------------- feeder control box ----------------
export function buildFeederPanel(L) {
  const { farm } = L;
  const shell = equipShell({ cls: 'equip--feeder', icon: ICONS.sliders, title: 'Feeder control box', sub: 'Three pan feeder lines · auger from the silos', plates: ['feeder-box'], onClose: L.close });
  const rows = FEEDER_LINES_Z.map((z, i) => {
    const run = toggleKey('Running', 'Stopped', () => { const l = farm.feed.lines[i]; L.act('feed.line', { line: i, running: !l.running }); refresh(); });
    const flood = toggleKey('Flood on', 'Flood off', () => { const l = farm.feed.lines[i]; L.act('feed.line', { line: i, flood: !l.flood }); refresh(); });
    const height = stepper(`Line ${i + 1} pan height`, 'cm', (d) => {
      const [lo, hi] = EQUIP.feederHeightCm;
      const cm = Math.max(lo, Math.min(hi, Math.round(farm.feed.lines[i].heightCm + d)));
      L.act('feed.line', { line: i, heightCm: cm }); refresh();
    });
    const pan = h('span', { class: 'pan-pic', 'aria-hidden': 'true' });
    const row = machineRow(`Line ${i + 1}`, h('small', null, pan), run.el, flood.el, ...height.els);
    return { row, run, flood, height, pan };
  });
  const meter = readout('Feed meter');
  const readBtn = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the feed meter');
  readBtn.addEventListener('click', () => { const r = L.act('feed.meter', {}); meter.set(`${int(r?.kg)} kg`, 'since the first fill'); });
  shell.main.append(h('div', { class: 'ctrl-rows' }, rows.map((r) => r.row.el)), h('div', { class: 'equip-reads' }, meter.el, readBtn));

  function panSvg(l) {
    // side view: litter line, pan at its rim height, feed heaped by fill (flood = heaped above the rim)
    const rim = Math.max(0, Math.min(45, l.heightCm)), y = 34 - rim * 0.55, fill = Math.max(0, Math.min(1, l.panFill));
    const heap = l.flood ? 6 : 0, fy = y + 10 - fill * 9 - heap * fill;
    return `<svg viewBox="0 0 120 40" width="120" height="40"><path d="M2 36h116" stroke="var(--key-sub)" stroke-width="1.5" stroke-dasharray="3 3"/>
      <path d="M60 0v${(y - 2).toFixed(1)}" stroke="var(--key-sub)" stroke-width="2"/>
      <path d="M40 ${y.toFixed(1)}h40l-5 9H45z" fill="var(--feeder, #e0582c)"/>
      ${fill > 0.02 ? `<path d="M43 ${(y + 2).toFixed(1)}Q60 ${fy.toFixed(1)} 77 ${(y + 2).toFixed(1)}z" fill="var(--sign-yellow)"/>` : ''}
      <text x="86" y="${(y + 8).toFixed(1)}" font-size="9" fill="var(--key-sub)" font-family="var(--font-display)">${fmt0(rim)} cm</text></svg>`;
  }
  let acc = 0;
  function refresh() {
    rows.forEach((r, i) => {
      const l = farm.feed.lines[i];
      r.run.set(!!l.running); r.flood.set(!!l.flood); r.height.set(fmt0(l.heightCm), 'cm');
      r.row.led.classList.toggle('is-on', !!l.running);
      r.row.led.classList.add('led--run');
      const k = `${Math.round(l.heightCm)}|${l.flood}|${Math.round(l.panFill * 20)}`;
      if (r.pan.__k !== k) { r.pan.__k = k; r.pan.innerHTML = panSvg(l); }
    });
  }
  return { el: shell.el, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.25; refresh(); } } };
}

// ---------------- silo gauge (outside, north of the house) ----------------
export function buildSiloPanel(L) {
  const { farm } = L;
  const shell = equipShell({ cls: 'equip--silo', icon: ICONS.scale, title: 'Feed silos', sub: 'Two silos · level gauge on the boot', plates: ['silo'], onClose: L.close });
  const strip = h('div', { class: 'silo-strip', 'aria-hidden': 'true' });
  const reading = readout('Gauge reading');
  const readBtn = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the gauge');
  readBtn.addEventListener('click', () => { const r = L.act('feed.silo', {}); reading.set(`about ${int(r?.kg)} kg`, `both silos, read ${L.env.timeLabel}`); });
  shell.main.append(h('div', { class: 'silo-wrap' }, strip, h('div', { class: 'equip-reads equip-reads--col' }, reading.el, readBtn,
    h('p', { class: 'equip-note' }, 'The office phone orders feed.'))));
  function draw() {
    const cap = EQUIP.siloCapacityKg, kg = Math.max(0, farm.feed.siloKg);
    const ticks = [0, 1000, 2000, 3000, 4000, 5000, 6000].map((t) => {
      const y = 150 - (t / cap) * 140;
      return `<path d="M44 ${y}h8" stroke="currentColor"/><text x="56" y="${y + 3.5}" font-size="9">${t ? `${t / 1000} t` : '0'}</text>`;
    }).join('');
    const fy = 150 - (kg / cap) * 140;
    strip.innerHTML = `<svg viewBox="0 0 90 160" width="90" height="160"><rect x="20" y="8" width="22" height="144" rx="4" fill="var(--panel-sunk)" stroke="currentColor"/>
      <rect x="23" y="${fy.toFixed(1)}" width="16" height="${(150 - fy).toFixed(1)}" fill="var(--sign-yellow)"/>${ticks}</svg>`;
  }
  let acc = 0;
  return { el: shell.el, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.5; draw(); } } };
}

// ---------------- rice husk heap ----------------
export function buildHeapPanel(L) {
  const { farm, props, env } = L;
  const shell = equipShell({ cls: 'equip--heap', icon: ICONS.sliders, title: 'Rice husk heap', sub: 'Litter for the brooding floor', signLinks: ['sign-litter'], onClose: L.close });
  const name = uniqueId('depth');
  const depths = EQUIP.litterDepthCm.map((cm) => {
    const input = h('input', { type: 'radio', name, value: String(cm) });
    input.addEventListener('change', () => { L.act('litter.depth', { cm }); refresh(); });
    return { cm, input, el: h('label', { class: 'depth-opt' }, input, h('span', { class: 'depth-pic', html: depthPic(cm), 'aria-hidden': 'true' }), h('span', null, `${cm} cm`)) };
  });
  const cover = readout('Floor covered');
  const barrow = button({ class: 'btn btn--machine btn--go' }, 'Take the barrow');
  const back = button({ class: 'btn btn--machine' }, 'Put the barrow back');
  const sack = button({ class: 'btn btn--machine' }, 'Take a sack of husk');
  barrow.addEventListener('click', () => { const sel = depths.find((d) => d.input.checked); props.startCarry('barrow', { depthCm: sel ? sel.cm : farm.litter.depthCm }); L.close(); });
  back.addEventListener('click', () => { props.drop(); refresh(); });
  sack.addEventListener('click', () => { props.startCarry('sack', {}); L.close(); });
  const hint = h('p', { class: 'equip-note' });
  shell.main.append(
    h('fieldset', { class: 'depth' }, h('legend', null, 'Depth to spread'), depths.map((d) => d.el)),
    h('div', { class: 'equip-reads' }, cover.el, h('div', { class: 'equip-btns' }, barrow, back, sack)), hint);
  function refresh() {
    for (const d of depths) d.input.checked = Math.round(farm.litter.depthCm) === d.cm;
    cover.set(`${Math.round((farm.litter.cover ?? 0) * 100)} %`, `${fmt0(farm.litter.depthCm)} cm set`);
    const carrying = props.carrying;
    barrow.hidden = carrying === 'barrow';
    back.hidden = carrying !== 'barrow';
    sack.hidden = env.dayNumber < LEVEL1.arrivalDay || carrying === 'barrow';
    barrow.disabled = !!carrying && carrying !== 'barrow';
    setText(hint, carrying === 'barrow' ? 'Push the barrow over the floor: it spreads a strip about 2.4 m wide.' : 'With the barrow the clock runs slower; walk the whole house from wall to wall.');
  }
  let acc = 0;
  return { el: shell.el, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.3; refresh(); } } };
}
function depthPic(cm) {
  const hgt = 2 + cm * 1.6;
  return `<svg viewBox="0 0 44 24" width="44" height="24"><rect x="2" y="${22 - hgt}" width="40" height="${hgt}" rx="1" fill="var(--sign-yellow)"/><path d="M2 22h40" stroke="var(--key-sub)" stroke-width="2"/></svg>`;
}

// ---------------- bird scale (hand scale, catching frame, automatic platform) ----------------
export function buildBirdScalePanel(L) {
  const { props, records, env } = L;
  const shell = equipShell({ cls: 'equip--scale', icon: ICONS.scale, title: 'Bird scale', sub: 'Hand scale, catching frame and the automatic platform', plates: ['bird-scale'], onClose: L.close });
  const auto = readout('Automatic platform, today');
  const sample = readout('Your weighing today');
  const take = button({ class: 'btn btn--machine btn--go' }, 'Take the scale and frame');
  const back = button({ class: 'btn btn--machine' }, 'Put them back');
  take.addEventListener('click', () => { props.startCarry('frame', {}); L.close(); });
  back.addEventListener('click', () => { props.drop(); refresh(); });
  shell.main.append(h('div', { class: 'equip-reads' }, auto.el, sample.el), h('div', { class: 'equip-btns' }, take, back),
    h('p', { class: 'equip-note' }, 'Set the frame down among the birds (E): it holds about ten. Weigh them, let them go, move on.'));
  function refresh() {
    const draft = records?.draft?.(env.dayNumber);
    auto.set(draft?.weightG && draft.weightSource === 'scale' ? `${int(draft.weightG)} g` : '—', 'birds that stepped on it');
    const w = L.weighings();
    sample.set(w.n ? `${int(w.mean)} g` : '—', w.n ? `${w.n} birds · ${w.sectors} places` : 'no birds weighed');
    take.hidden = props.carrying === 'frame';
    back.hidden = props.carrying !== 'frame';
  }
  let acc = 0;
  return { el: shell.el, update(dt, force) { acc -= dt; if (force || acc <= 0) { acc = 0.4; refresh(); } } };
}

export const fmtKg = (kg) => `${one(kg)} kg`;
