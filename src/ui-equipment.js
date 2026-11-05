// Level 1 equipment panels: the shared machine case, and the feeder control box, silo gauge, rice
// husk heap and bird scale. Water (drinkers, water supply) is in ui-water.js, the level climate
// controller in ui-climate.js. Owner: package "level". Every control acts through farm.act (or a
// ui-only action on the bus); the panel shows what the machine shows, never a verdict.
import { EQUIP, FEEDER_LINES_Z, LEVEL1 } from './config.js';
import { BOARDS } from './content-signs.js';
import { BOARDS_CYCLE } from './content-signs-cycle.js';
import { BOARDS_COND } from './content-signs-cond.js';
import { h, button, setText, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { key } from './ui-controller.js';
import { buildPlate } from './ui-boards.js';
import { int, one } from './ui-format.js';
// Phase 3 (package "panels"): feed withdrawal and pan wash, two silos and slide valves, fork and scraper
import { cycleFeederParts, cycleSiloParts, cycleHeapParts, siloSkills, feederSkills } from './ui-cycle-equip.js';
// the clarity round: the open job done here, its steps, the sign's target beside the live value
import { createJobStrip } from './ui-jobstrip.js';
// the steps hotfix: an action that waits on farm time runs a paused clock again and says so
import { farmTimeNote } from './ui-farmtime.js';
// Skills update (SKILLS.md §3.8, §5.1): the automatic scale's display (Growth 3), its glance and Clean the platform
import { skillBox, workLine, oneKey, row as skRow, note as skNote, perkAuto, openFault, faultText, glanceFor } from './ui-cycle-skills.js';

/**
 * Machine case: header with icon, title and where; a dark working plate; plate columns at the side.
 * @returns {{ el, main: HTMLElement, plates: ReturnType<typeof buildPlate>[], foldPlates() }}
 */
export function equipShell({ cls = '', icon, title, sub, plates = [], onClose, signLinks = [] }) {
  const titleId = uniqueId('equip-title');
  const { el, closeBtn } = dialogShell(`equip ${cls}`, titleId, onClose);
  const main = h('div', { class: 'equip-main' });
  const plateEls = plates.map((id) => buildPlate(id));
  /** The job strip at the top of the working plate (ui-jobstrip.js): the panel mounts it with its id. */
  // Phase 3: a link may name a board of the full cycle (content-signs-cycle.js BOARDS_CYCLE)
  // Phase 4: or a board of a condition (content-signs-cond.js BOARDS_COND: the power cut sign by the generator)
  const board = (id) => BOARDS[id] || BOARDS_CYCLE[id] || BOARDS_COND[id];
  const links = signLinks.some(board) ? h('p', { class: 'equip-links' }, h('span', { html: ICONS.facts, 'aria-hidden': 'true' }),
    `Facts also on: ${signLinks.filter(board).map((id) => `${board(id).title} (${board(id).where.toLowerCase()})`).join('; ')}`) : null;
  const side = plateEls.length ? h('div', { class: 'equip-side' }, plateEls.map((p) => p.el), links) : null;
  if (!plateEls.length && links) { links.classList.add('equip-links--below'); }
  const screws = ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `screw screw--${p}`, 'aria-hidden': 'true' }));
  el.append(h('div', { class: 'equip-case' }, screws,
    h('header', { class: 'ctrl-brand' }, h('span', { class: 'ctrl-logo', html: icon || ICONS.sliders, 'aria-hidden': 'true' }),
      h('div', null, h('h2', { id: titleId }, title), sub ? h('p', null, sub) : null)),
    h('div', { class: `equip-grid${side ? '' : ' equip-grid--solo'}` }, main, side), side ? null : links), closeBtn);
  const timeNote = farmTimeNote();
  return {
    el, main, plates: plateEls, timeNote,
    foldPlates() { for (const p of plateEls) p.fold(); },
    /** An action that waits on farm time starts here: the plates fold (an open plate stands the clock still), a paused
     *  clock runs again at normal speed, and the panel's note says so ("Clock running: the test takes 1 farm minute").
     *  The panel puts `timeNote.el` where the farmer reads it (under the key that started it). */
    needTime(text) { for (const p of plateEls) p.fold(); return timeNote.start(text); },
    /** Phase 3: rebuild a plate whose merged board of today has more lines (BOARD_EXTRA_ITEMS fromDay);
     *  the brooding week's plates never change. Panels call it when they open. */
    refreshPlates() {
      plateEls.forEach((p, i) => {
        const fresh = buildPlate(p.id, { open: p.open });
        const n = (x) => x.el.querySelectorAll('.plate-items > li').length;
        if (n(fresh) === n(p)) return;
        p.el.replaceWith(fresh.el);
        plateEls[i] = fresh;
      });
    },
  };
}

/** A labelled row of the working plate: led, label (+ small), controls. `setState(text)` writes the control's
 *  state beside the title ("Auger: off"): the keys name what pressing them does, the lamp and this word what is. */
export function machineRow(title, sub, ...controls) {
  const led = h('span', { class: 'led', 'aria-hidden': 'true' });
  const small = typeof sub === 'string' ? h('small', null, sub) : sub;
  const state = h('span', { class: 'ctrl-state', hidden: true });
  const el = h('div', { class: 'ctrl-row' }, led, h('div', { class: 'ctrl-label' }, h('span', null, title), state, small), h('div', { class: 'ctrl-keys' }, controls));
  return { el, led, small, state, setState(text) { state.hidden = !text; setText(state, text || ''); } };
}

/** − value + with press-and-hold repeat. */
export function stepper(label, unit, onStep, { bigStep = 0 } = {}) {
  const out = h('output', { class: 'lcd-mini', 'aria-live': 'polite' });
  // bigStep: with Shift held each press moves that many steps (a winch from 50 cm to 11 cm)
  const n = (e) => (bigStep && e && e.shiftKey ? bigStep : 1);
  const minus = key(`${label}: one step down`, ICONS.minus, (e) => onStep(-n(e)));
  const plus = key(`${label}: one step up`, ICONS.plus, (e) => onStep(n(e)));
  return { els: [minus, out, plus], set: (v) => setText(out, `${v}${unit ? ` ${unit}` : ''}`) };
}

/** A wide toggle key (aria-pressed) that names what pressing it does next: `whenOn` while the thing is on
 *  ("Stop auger"), `whenOff` while it is off ("Start auger"). The state itself is the row's lamp and its state
 *  word (machineRow setState), never the key's label. */
// Review round: a lit key that reads "STOP THE PAD PUMP" reads as "stop"; while it is on (lit) the key shows the state with
// its lamp (`onText`, "Pad pump · running"), the action stays in its aria-label and title (what a press does next).
export function toggleKey(whenOn, whenOff, onClick, onText = null) {
  const b = button({ class: 'key key--wide key--act', 'aria-pressed': 'false' });
  b.addEventListener('click', onClick);
  return { el: b, stateText(t) { onText = t; return this; }, set(on) {
    b.setAttribute('aria-pressed', String(on));
    const act = on ? whenOn : whenOff;
    setText(b, on && onText ? onText : act);
    if (b.getAttribute('aria-label') !== act) { b.setAttribute('aria-label', act); b.title = act; }
  } };
}

/** A small LCD readout box with a caption, for a reading the farmer took. */
export function readout(label) {
  const v = h('span', { class: 'readout-v' }, '—');
  const sub = h('span', { class: 'readout-sub' });
  const el = h('div', { class: 'readout' }, h('span', { class: 'readout-k' }, label), v, sub);
  return { el, set(text, subText = '') { setText(v, text); setText(sub, subText); } };
}

// ---------------- feeder control box ----------------
/** What the line's auger does now: the switch (automatic) and the control pan at the end of the line. */
export const augerWord = (l) => (!l.running ? 'Auger: off' : l.turning ? 'Auger: turning, filling the pans' : l.noFeed ? 'Auger: on, no feed from the silo' : 'Auger: on, stopped by the control pan (pans full)');
export function buildFeederPanel(L) {
  const { farm } = L;
  const shell = equipShell({ cls: 'equip--feeder', icon: ICONS.sliders, title: 'Feeder control box', sub: 'Three pan feeder lines · auger from the silos', plates: ['feeder-box'], onClose: L.close });
  const strip = createJobStrip(L, 'feeder-box');
  const rows = FEEDER_LINES_Z.map((z, i) => {
    // a running auger fills the pans over farm time: the plate folds so the clock runs
    // the steps hotfix: starting it runs a paused clock again, and the note under the rows says how long it takes
    const FILL = 'the auger fills the pans over farm time: about 25 farm minutes for flooded pans. Close the box and let the clock run (Next job works too)';
    const run = toggleKey('Stop auger', 'Start auger', () => { const l = farm.feed.lines[i]; if (!l.running) shell.needTime(FILL); L.act('feed.line', { line: i, running: !l.running }); refresh(); }, 'Auger · on');
    const flood = toggleKey('Close flood windows', 'Open flood windows', () => { const l = farm.feed.lines[i]; if (!l.flood) shell.needTime(FILL); L.act('feed.line', { line: i, flood: !l.flood }); refresh(); }, 'Flood windows · open');
    const height = stepper(`Line ${i + 1} pan height`, 'cm', (d) => {
      const [lo, hi] = EQUIP.feederHeightCm;
      const cm = Math.max(lo, Math.min(hi, Math.round(farm.feed.lines[i].heightCm + d)));
      L.act('feed.line', { line: i, heightCm: cm }); refresh();
    }, { bigStep: 5 });
    const pan = h('span', { class: 'pan-pic', 'aria-hidden': 'true' });
    const fill = h('span', { class: 'pan-fill' }), fillBar = h('span', { class: 'pan-bar', 'aria-hidden': 'true' }, h('span'));
    const row = machineRow(`Line ${i + 1}`, h('small', null, h('span', { class: 'pan-read' }, pan, h('span', { class: 'pan-num' }, fill, fillBar))), run.el, flood.el,
      h('span', { class: 'ctrl-keys-k' }, 'Pans: lower / raise'), ...height.els);
    return { row, run, flood, height, pan, fill, fillBar };
  });
  // one line on what each control does (the plate has the figures)
  const legend = h('ul', { class: 'equip-legend' },
    h('li', null, h('b', null, 'Start auger: '), 'the auger carries feed from the silo along the line into the pans. It stops by itself when the control pan at the end of the line is full, and starts again as the birds eat.'),
    h('li', null, h('b', null, 'Flood windows: '), 'open windows in each pan so the feed piles up in and around it, where day-old chicks reach it.'),
    h('li', null, h('b', null, 'Pans: lower / raise: '), 'the pan rim height above the litter (Shift: 5 cm a press).'));
  const timeNote = h('p', { class: 'equip-note equip-note--time' }, 'The pans fill over farm time while the auger turns: about 25 farm minutes for flooded pans. Close the box and let the clock run (Next job works too).');
  const meter = readout('Feed meter');
  const readBtn = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the feed meter');
  readBtn.addEventListener('click', () => {
    const prev = (L.records?.notebook || []).filter((n) => n.kind === 'feed.meter' && n.day < L.env.dayNumber).pop();
    const r = L.act('feed.meter', {});
    const was = prev && (typeof prev.value === 'object' ? prev.value.kg : prev.value);
    meter.set(`${int(r?.kg)} kg`, Number.isFinite(was) ? `${int(r.kg - was)} kg since your reading of day ${prev.day}` : 'since the first fill');
  });
  const cyc = cycleFeederParts(L, { foldPlates: () => shell.foldPlates(), needTime: (t) => shell.needTime(t), timeNote: shell.timeNote });
  // Phase 4, a bad batch (PHASE4.md §4.3): feed trays and chick paper by the brooders on the prep day to day 3 (brood.trays)
  const traysOn = () => !!farm.brood?.trays;
  const trays = toggleKey('Take the trays and paper away', 'Put out feed trays and chick paper', () => { L.act('brood.trays', { on: !traysOn() }); refresh(); }, 'Trays and paper · out');
  const trayRow = machineRow('Feed trays and chick paper', 'by the brooders, for small chicks to find feed from the first hour (chick arrival sign)', trays.el);
  trayRow.led.classList.add('led--run');
  trayRow.el.hidden = true;
  // Skills update (SKILLS.md §3.6): the rims the feed controller keeps and its orders (Feed 3), the glance
  const sk = feederSkills(L);
  shell.main.append(strip.el, h('div', { class: 'ctrl-rows' }, rows.map((r) => r.row.el), trayRow.el, cyc.els[0]), sk.el, shell.timeNote.el, legend, timeNote, h('div', { class: 'equip-reads' }, meter.el, readBtn), cyc.els[1]);

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
  let acc = 0, open = false;
  function refresh() {
    rows.forEach((r, i) => {
      const l = farm.feed.lines[i];
      r.run.set(!!l.running); r.flood.set(!!l.flood); r.height.set(fmt0(l.heightCm), 'cm');
      // the lamp lights while the auger turns; the switch stays on (automatic) while the control pan has it stopped
      r.row.led.classList.toggle('is-on', !!l.running && !!l.turning);
      r.row.led.classList.add('led--run');
      r.row.setState(`${augerWord(l)} · flood windows ${l.flood ? 'open' : 'closed'}`);
      setText(r.fill, `pans ${Math.round(Math.max(0, Math.min(1, l.panFill)) * 100)} % full`);
      r.fillBar.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, l.panFill)).toFixed(3)})`;
      const k = `${Math.round(l.heightCm)}|${l.flood}|${Math.round(l.panFill * 20)}`;
      if (r.pan.__k !== k) { r.pan.__k = k; r.pan.innerHTML = panSvg(l); }
    });
    const d = L.env.dayNumber, showTrays = farm.mode === 'level' && farm.condition === 'badChicks' && d >= -1 && d <= 3;
    trayRow.el.hidden = !showTrays;
    if (showTrays) { const on = traysOn(); trays.set(on); trayRow.led.classList.toggle('is-on', on); trayRow.setState(`Trays and chick paper: ${on ? 'out by the brooders' : 'not out'}`); }
  }
  return {
    el: shell.el,
    onOpen() { shell.refreshPlates(); strip.onOpen(); cyc.onOpen?.(); sk.onOpen(); open = true; },
    /** A pan wash still running finishes in the background when the box closes (the panel host keeps updating it). */
    busy: () => !!cyc.busy?.(),
    onClose() { cyc.onClose(); strip.onClose(); open = false; },
    update(dt, force) { if (open) sk.update(dt); acc -= dt; if (force || acc <= 0) { acc = 0.25; refresh(); cyc.update(); strip.update(); timeNote.hidden = !!shell.timeNote.text || !farm.feed.lines.some((l) => l.running && l.turning); } },
  };
}

// ---------------- silo gauge (outside, north of the house) ----------------
export function buildSiloPanel(L) {
  const { farm } = L;
  const shell = equipShell({ cls: 'equip--silo', icon: ICONS.scale, title: 'Feed silos', sub: 'Two silos · level gauge on the boot', plates: ['silo'], onClose: L.close });
  const strip = h('div', { class: 'silo-strip', 'aria-hidden': 'true' });
  const reading = readout('Gauge reading');
  const readBtn = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.eye, 'aria-hidden': 'true' }), 'Read the gauge');
  readBtn.addEventListener('click', () => { const r = L.act('feed.silo', {}); reading.set(`about ${int(r?.kg)} kg`, `both silos, read ${L.env.timeLabel}`); });
  const p2 = h('div', { class: 'silo-wrap' }, strip, h('div', { class: 'equip-reads equip-reads--col' }, reading.el, readBtn,
    h('p', { class: 'equip-note' }, 'The office phone orders feed.')));
  const cyc = cycleSiloParts(L);
  // Skills update (SKILLS.md §3.6): the days of feed and the orders at the gauge (Feed 2), the controller's orders (Feed 3)
  const sk = siloSkills(L);
  shell.main.append(p2, cyc.el, sk.el);
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
  return {
    el: shell.el,
    onOpen() { shell.refreshPlates(); sk.onOpen(); },
    update(dt, force) {
      sk.update(dt);
      acc -= dt;
      if (!(force || acc <= 0)) return;
      acc = 0.5;
      const on = cyc.active();
      p2.hidden = on; cyc.el.hidden = !on;
      if (on) cyc.update(); else draw();
    },
  };
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
  const cyc = cycleHeapParts(L);
  shell.main.append(
    h('fieldset', { class: 'depth' }, h('legend', null, 'Depth to spread'), depths.map((d) => d.el)),
    h('div', { class: 'equip-reads' }, cover.el, h('div', { class: 'equip-btns' }, barrow, back, sack, ...cyc.buttons)), hint);
  function refresh() {
    for (const d of depths) d.input.checked = Math.round(farm.litter.depthCm) === d.cm;
    cover.set(`${Math.round((farm.litter.cover ?? 0) * 100)} %`, `${fmt0(farm.litter.depthCm)} cm set`);
    const carrying = props.carrying;
    barrow.hidden = carrying === 'barrow';
    back.hidden = carrying !== 'barrow';
    sack.hidden = env.dayNumber < LEVEL1.arrivalDay || carrying === 'barrow';
    barrow.disabled = props.handsBusy('barrow');
    setText(hint, cyc.hint() ?? (carrying === 'barrow' ? 'Push the barrow over the floor: it spreads a strip about 2.4 m wide.' : 'With the barrow the clock runs slower; walk the whole house from wall to wall.'));
    cyc.update();
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
  // Skills update (Growth 3, autoScale): the display open AUTO.glanceSec sends auto.glance { system: 'scale' } and scale.read
  // { day } (the day's count, mean and uniformity for the records); Clean the platform (scale.clean) for a fouled scale
  let read = null, cleanSaid = '';
  const dispLine = workLine(), scaleNote = skNote();
  const cleanKey = oneKey('Clean the platform', () => {
    const r = L.act('scale.clean', {}) || {};
    cleanSaid = r.cleaned ? `Platform cleaned at ${env.timeLabel}: the birds step on it again.` : `Platform cleaned at ${env.timeLabel}.`;
    drawScale();
  }, { label: 'Clean the automatic scale’s platform' });
  const scaleBox = skillBox('autoScale', 'Automatic platform scale · today', skRow(dispLine.el, cleanKey), scaleNote);
  const showScale = () => L.farm?.mode === 'level' && (perkAuto(L, 'scale') || !!openFault(L, 'scale-fouled'));
  const glance = glanceFor(L, 'bird-scale', { extra: () => { if (showScale()) { read = L.act('scale.read', { day: env.dayNumber }) || null; drawScale(); } } });
  function drawScale() {
    if (!scaleBox.show(showScale())) return;
    const f = openFault(L, 'scale-fouled');
    dispLine.set(read ? `${read.n ? `${int(read.n)} weighings, mean ${int(read.meanG)} g${read.uniformityPct != null ? `, uniformity ${int(read.uniformityPct)} %` : ''}` : 'No weighings yet today'} (read ${env.timeLabel})` : 'Reading the display…',
      read?.fouled || f ? 'Litter on the platform: it reads light and counts few birds.' : 'Birds that stepped on the platform today.');
    setText(scaleNote, cleanSaid || (f ? faultText(L, f) : ''));
    scaleNote.hidden = !scaleNote.textContent;
    scaleNote.classList.toggle('skl-note--fault', !!f && !cleanSaid);
  }
  shell.main.append(h('div', { class: 'equip-reads' }, auto.el, sample.el), scaleBox.el, h('div', { class: 'equip-btns' }, take, back),
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
  return { el: shell.el,
    onOpen() { shell.refreshPlates(); read = null; cleanSaid = ''; glance.onOpen(); drawScale(); },
    update(dt, force) { glance.update(dt); acc -= dt; if (force || acc <= 0) { acc = 0.4; refresh(); drawScale(); } } };
}

export const fmtKg = (kg) => `${one(kg)} kg`;
