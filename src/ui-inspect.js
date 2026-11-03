// Inspection panels: the chick grading table (sample box of ten), a chick in the hand (vent, crop,
// sick bird) and the weigh panel at the catching frame. Owner: package "level".
// Nothing here checks what the farmer finds: his grading sheet is his own note (grade.submit), the
// readings go into the notebook as he takes them.
import { LEVEL1 } from './config.js';
import { h, button, setText, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell, readout, stepper } from './ui-equipment.js';
import { int, one, two, cropWords } from './ui-format.js';

// A chick drawn in 2D (top-left origin 0..60). flip = on its back, cull = gone.
function chickSvg({ flip = false, size = 1 } = {}) {
  const body = flip
    ? `<ellipse cx="30" cy="36" rx="18" ry="13" fill="var(--chick)"/><path d="M22 24l-3-8M38 24l3-8" stroke="var(--hen-beak)" stroke-width="2.6" stroke-linecap="round"/><circle cx="14" cy="40" r="8" fill="var(--chick)"/><circle cx="30" cy="38" r="3" fill="none" stroke="var(--wood-dark)" stroke-width="1.2"/>`
    : `<ellipse cx="28" cy="36" rx="17" ry="13" fill="var(--chick)"/><circle cx="42" cy="22" r="10" fill="var(--chick)"/><path d="M51 20l7 3-7 3z" fill="var(--hen-beak)"/><circle cx="45" cy="20" r="1.8" fill="var(--panel-solid)"/><path d="M20 34q6 6 14 2" fill="none" stroke="var(--wood-light)" stroke-width="1.5"/><path d="M24 48v6M32 48v6" stroke="var(--hen-beak)" stroke-width="2.4" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 60 60" width="${60 * size}" height="${60 * size}" aria-hidden="true">${body}</svg>`;
}

/** Chick sample table by the truck: ten chicks, the farmer's grading sheet, the box scale. */
export function buildGradingPanel(L) {
  const shell = equipShell({ cls: 'equip--grade', icon: ICONS.chick, title: 'Chick sample table', sub: 'One box of ten chicks · box scale · your grading sheet', signLinks: ['sign-chicks'], onClose: L.close });
  const chicks = Array.from({ length: 10 }, (_, i) => ({ i, sample: null, culled: false, flipAt: null, rightedIn: null, seen: {} }));
  let sel = 0;
  const grid = h('div', { class: 'grade-box', role: 'listbox', 'aria-label': 'Chicks in the sample box' });
  const cells = chicks.map((c) => {
    const b = button({ class: 'grade-chick', role: 'option', 'aria-label': `Chick ${c.i + 1}` });
    b.addEventListener('click', () => { sel = c.i; draw(); });
    grid.append(b);
    return b;
  });
  const look = h('div', { class: 'grade-look', 'aria-live': 'polite' });
  const flipBtn = button({ class: 'btn btn--machine' }, 'Turn on its back');
  const navelBtn = button({ class: 'btn btn--machine' }, 'Look at the navel');
  const hockBtn = button({ class: 'btn btn--machine' }, 'Look at the hocks');
  const cullBtn = button({ class: 'btn btn--machine btn--cull' }, 'Cull');
  const sampleOf = (c) => { if (!c.sample) c.sample = L.act('sample.grade', { i: c.i }) || {}; return c.sample; };
  flipBtn.addEventListener('click', () => { const c = chicks[sel]; if (c.culled) return; sampleOf(c); c.flipAt = performance.now(); c.rightedIn = null; draw(); });
  navelBtn.addEventListener('click', () => { const c = chicks[sel]; sampleOf(c); c.seen.navel = true; draw(); });
  hockBtn.addEventListener('click', () => { const c = chicks[sel]; sampleOf(c); c.seen.hocks = true; draw(); });
  cullBtn.addEventListener('click', () => { const c = chicks[sel]; if (c.culled) return; c.culled = true; L.act('chicks.cull', { n: 1, reason: 'grading' }); draw(); });
  // the farmer's sheet: tally boxes he fills himself
  const sheet = { navelBad: 0, redHocks: 0, slowReflex: 0, culled: 0 };
  const tallyRows = [['navelBad', 'Navel not closed / black button'], ['redHocks', 'Red hocks'], ['slowReflex', 'Slow to right itself (over 3 s)'], ['culled', 'Culled']].map(([k, label]) => {
    const s = stepper(label, '', (d) => { sheet[k] = Math.max(0, Math.min(10, sheet[k] + d)); s.set(String(sheet[k])); });
    s.set('0');
    return h('div', { class: 'tally' }, h('span', null, label), h('span', { class: 'tally-keys' }, s.els));
  });
  const boxRead = readout('Box scale');
  const weighBtn = button({ class: 'btn btn--machine' }, h('span', { html: ICONS.scale, 'aria-hidden': 'true' }), 'Weigh the box');
  weighBtn.addEventListener('click', () => { const r = L.act('sample.box', {}) || {}; boxRead.set(`${two(r.weightKg)} kg`, `gross, ${int(r.chicks ?? LEVEL1.chicksPerBox)} chicks · box weight printed: ${two(r.boxKg ?? 0.35)} kg`); });
  const submit = button({ class: 'btn btn--machine btn--go' }, 'Hand in the sheet');
  const handed = h('p', { class: 'equip-note' });
  submit.addEventListener('click', () => { L.uiAct('grade.submit', { sheet: { ...sheet } }); setText(handed, `Sheet handed in at ${L.env.timeLabel}: it goes into the record as your chick-quality note.`); });
  shell.main.append(h('div', { class: 'grade-grid' },
    h('div', null, grid, h('div', { class: 'grade-actions' }, flipBtn, navelBtn, hockBtn, cullBtn), look),
    h('div', { class: 'grade-sheet' }, h('p', { class: 'sheet-k' }, 'Grading sheet · sample box'), tallyRows,
      h('div', { class: 'equip-reads' }, boxRead.el, weighBtn), h('div', { class: 'equip-btns' }, submit), handed)));

  function draw() {
    chicks.forEach((c, i) => {
      const lying = c.flipAt != null && c.rightedIn == null;
      const k = `${c.culled}|${lying}|${i === sel}`;
      if (cells[i].__k !== k) {
        cells[i].__k = k;
        cells[i].innerHTML = c.culled ? '<span class="grade-gone">culled</span>' : chickSvg({ flip: lying });
        cells[i].classList.toggle('is-sel', i === sel);
        cells[i].setAttribute('aria-selected', String(i === sel));
      }
    });
    const c = chicks[sel];
    const lines = [h('p', { class: 'grade-name' }, `Chick ${c.i + 1}`)];
    if (c.culled) lines.push(h('p', null, 'Culled: in the cull bucket.'));
    else {
      if (c.flipAt != null) {
        const sec = c.rightedIn ?? (performance.now() - c.flipAt) / 1000;
        lines.push(h('p', null, c.rightedIn != null ? `Righted itself after ${one(sec)} s.` : `On its back… ${one(sec)} s`));
      }
      if (c.seen.navel) lines.push(h('p', null, `Navel: ${navelWords(c.sample?.navel)}.`));
      if (c.seen.hocks) lines.push(h('p', null, `Hocks: ${c.sample?.hocks === 'red' ? 'red' : 'clean'}.`));
      if (lines.length === 1) lines.push(h('p', { class: 'grade-hint' }, 'Pick a chick, then look at it.'));
    }
    look.replaceChildren(...lines);
    cullBtn.disabled = flipBtn.disabled = c.culled;
  }
  return {
    el: shell.el,
    update() {
      const now = performance.now();
      let changed = false;
      for (const c of chicks) {
        if (c.flipAt != null && c.rightedIn == null) {
          const t = (now - c.flipAt) / 1000;
          if (t >= (c.sample?.reflexSec ?? 1.5)) { c.rightedIn = c.sample?.reflexSec ?? t; }
          changed = true;
        }
      }
      if (changed || !cells[0].__k) draw();
    },
  };
}
const navelWords = (n) => ({ healed: 'closed and dry', closed: 'closed and dry', open: 'open', 'black-button': 'a black button', black: 'a black button' }[n] || (n ? String(n) : 'closed and dry'));

/** A chick (or a sick bird) in the farmer's hand: EV.BIRD_PICK { index, x, z, purpose }. */
export function buildChickInHandPanel(L) {

  const shell = equipShell({ cls: 'equip--hand', icon: ICONS.hand, title: 'Chick in hand', sub: '', signLinks: ['sign-chicks'], onClose: L.close });
  const pic = h('div', { class: 'hand-pic', html: chickSvg({ size: 2.2 }) });
  const out = readout('Reading');
  const ventBtn = button({ class: 'btn btn--machine btn--go' }, h('span', { html: ICONS.thermometer, 'aria-hidden': 'true' }), 'Take vent temperature');
  const cropBtn = button({ class: 'btn btn--machine btn--go' }, 'Feel the crop');
  const cullBtn = button({ class: 'btn btn--machine btn--cull' }, 'Cull');
  const backBtn = button({ class: 'btn btn--machine' }, 'Put back');
  const tally = h('p', { class: 'equip-note' });
  let bird = null, done = false;
  ventBtn.addEventListener('click', () => { if (!bird || done) return; const r = L.act('sample.vent', { x: bird.x, z: bird.z, index: bird.index }) || {}; out.set(`${one(r.tempC)} °C`, 'vent temperature'); done = true; sync(); });
  cropBtn.addEventListener('click', () => { if (!bird || done) return; const r = L.act('sample.crop', { x: bird.x, z: bird.z, index: bird.index }) || {}; out.set(cropWords(r.crop), 'crop'); done = true; sync(); });
  cullBtn.addEventListener('click', () => {
    if (!bird) return;
    L.act('chicks.cull', { n: 1, reason: 'sick', index: bird.index });
    L.flock?.releaseBird?.(bird.index, true);
    bird = null; L.close();
  });
  backBtn.addEventListener('click', () => L.close());
  shell.main.append(h('div', { class: 'hand-grid' }, pic, h('div', null, out.el, h('div', { class: 'equip-btns' }, ventBtn, cropBtn, cullBtn, backBtn), tally)));
  function sync() {
    const p = bird?.purpose;
    ventBtn.hidden = p !== 'vent'; cropBtn.hidden = p !== 'crop'; cullBtn.hidden = p !== 'sick';
    ventBtn.disabled = cropBtn.disabled = done;
    const t = L.sampleTally(p);
    setText(tally, p === 'sick' ? 'A bird sitting apart, feathers fluffed, eyes closed.' : t);
    const sub = shell.el.querySelector('.ctrl-brand p');
    if (sub) setText(sub, p === 'sick' ? 'A sick-looking bird' : p === 'crop' ? 'Crop check' : 'Vent temperature');
  }
  return {
    el: shell.el,
    /** Called by ui.js when a bird is picked up. */
    take(b) { bird = b; done = false; out.set('—', ''); sync(); },
    onClose() {
      // Put back: the flock lets the bird go and empties the hands (props.drop)
      if (bird) { L.flock?.releaseBird?.(bird.index, false); bird = null; }
      if (L.props.carrying === 'chick') L.props.drop();
    },
    update() {},
  };
}

/** Weigh panel at the catching frame: EV.FRAME_SET { x, z, birds }. */
export function buildWeighPanel(L) {
  const shell = equipShell({ cls: 'equip--weigh', icon: ICONS.scale, title: 'Weighing at the frame', sub: 'Hand scale · birds held in the catching frame', plates: ['bird-scale'], onClose: L.close });
  const list = h('ol', { class: 'weigh-list' });
  const frameMean = readout('This frame');
  const allMean = readout('All birds weighed today');
  const nextBtn = button({ class: 'btn btn--machine btn--go' }, 'Weigh next');
  const allBtn = button({ class: 'btn btn--machine' }, 'Weigh all');
  let frame = null, queue = [], weights = [], auto = false, wait = 0;
  const weighOne = () => {
    if (!frame || !queue.length) return;
    const b = queue.shift();
    const idx = typeof b === 'object' ? b.index : b;
    const r = L.act('sample.weigh', { x: frame.x, z: frame.z, index: idx }) || {};
    weights.push(r.weightG);
    draw();
  };
  nextBtn.addEventListener('click', () => { shell.foldPlates(); auto = false; wait = 0.4; nextPending = true; });
  allBtn.addEventListener('click', () => { shell.foldPlates(); auto = true; wait = 0.4; });
  let nextPending = false;
  shell.main.append(h('div', { class: 'equip-reads' }, frameMean.el, allMean.el), list, h('div', { class: 'equip-btns' }, nextBtn, allBtn),
    h('p', { class: 'equip-note' }, 'Close the panel to let the birds go; the frame stays in your hands for the next place.'));
  function draw() {
    list.replaceChildren(...weights.map((w, i) => h('li', null, h('span', null, `${i + 1}`), `${int(w)} g`)),
      ...queue.map(() => h('li', { class: 'is-waiting' }, h('span', null, '·'), 'in the frame')));
    const valid = weights.filter((w) => Number.isFinite(w));
    frameMean.set(valid.length ? `${int(valid.reduce((a, b) => a + b, 0) / valid.length)} g` : '—', `${valid.length} of ${valid.length + queue.length} birds`);
    const all = L.weighings();
    allMean.set(all.n ? `${int(all.mean)} g` : '—', all.n ? `${all.n} bird${all.n === 1 ? '' : 's'} · ${all.sectors} place${all.sectors === 1 ? '' : 's'}` : '');
    nextBtn.disabled = allBtn.disabled = !queue.length;
  }
  return {
    el: shell.el,
    take(f) { frame = f; queue = (f.birds || []).slice(); weights = []; auto = false; nextPending = false; draw(); },
    onClose() { if (frame) { L.flock?.releaseGroup?.(); frame = null; } },
    update(dt) {
      if ((auto || nextPending) && queue.length) {
        wait -= dt;
        if (wait <= 0) { weighOne(); nextPending = false; wait = 0.4; if (!queue.length) auto = false; }
      }
    },
  };
}
