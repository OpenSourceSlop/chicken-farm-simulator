// A bird in the hand from day 8 (PHASE3.md §1 Week 2, §6.5, §6.12, §13.7). Package "panels".
// ui.js (run) opens it for EV.BIRD_PICK { index, x, z, purpose: 'check' | 'lame' | 'sick' } and calls take(p).
// Each look is one sample.bird { x, z, index, look } and shows what the farmer sees, in plain words; nothing
// is marked. Cull (chicks.cull, reason 'lame' for a bird that cannot walk) or put back
// (flock.releaseBird). Unlocks: symptomCheck (one quick check takes every look), droppingsGuide (the
// droppings sign at the check), birdTemp (body temperature), sampleCard (today's samples on one card).
import { houseSector, flockAgeAt } from './config.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell } from './ui-equipment.js';
import { int, one, cropWords } from './ui-format.js';
import { broilerSvg } from './ui-cycle-kit.js';

const GAIT = ['walks well', 'a small fault in the walk', 'a small fault in the walk', 'walks with difficulty', 'can hardly walk', 'cannot walk'];
const WORDS = {
  gait: (v) => (Number.isFinite(v) ? `gait ${v}: ${GAIT[Math.max(0, Math.min(5, v))]}` : null),
  feathers: (v) => ({ good: 'back and wings feathered', patchy: 'patchy: bare spots on the back', poor: 'few feathers on the back and wings' }[v] ?? null),
  feet: (v) => ({ 0: 'footpads clean', 1: 'small dark spots on the footpads', 2: 'sores on the footpads' }[v] ?? null),
  breathing: (v) => ({ quiet: 'breathes quietly', snick: 'a snick now and then', rattle: 'a rattle in the breathing' }[v] ?? null),
  droppings: (v) => ({ normal: 'firm, brown with a white cap', caecal: 'a soft, frothy caecal dropping', watery: 'watery droppings', undigested: 'undigested feed in the droppings', bloody: 'blood in the droppings', white: 'white, watery droppings' }[v] ?? null),
  crop: (v) => (v ? `crop ${v === 'half' ? 'half full' : cropWords(v)}` : null),
  weight: (v) => (Number.isFinite(v) ? `${int(v)} g on the hand scale` : null),
  temp: (v) => (Number.isFinite(v) ? `${one(v)} °C body temperature` : null),
};
const LOOKS = [
  { look: 'gait', btn: 'Watch it walk' }, { look: 'feathers', btn: 'Look at the feathers' }, { look: 'feet', btn: 'Look at the feet' },
  { look: 'breathing', btn: 'Listen to the breathing' }, { look: 'droppings', btn: 'Look at the vent and droppings' }, { look: 'crop', btn: 'Feel the crop' },
  { look: 'weight', btn: 'Weigh it' }, { look: 'temp', btn: 'Take its temperature', unlock: 'birdTemp' },
];
// the sampleCard's short words for the same readings
const SHORT = {
  gait: { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' },
  feathers: { good: 'feathered', patchy: 'patchy', poor: 'few feathers' },
  feet: { 0: 'clean pads', 1: 'dark spots', 2: 'sores' },
  breathing: { quiet: 'quiet', snick: 'snick', rattle: 'rattle' },
  droppings: { normal: 'firm', caecal: 'caecal', watery: 'watery', undigested: 'undigested feed', bloody: 'blood', white: 'white, watery' },
  crop: { full: 'full', half: 'half full', empty: 'empty' },
};
const QUICK = ['gait', 'feathers', 'feet', 'breathing', 'droppings', 'crop'];
// droppings pictograms (the sign's kinds; paint colours only)
const DROP = {
  normal: '<ellipse cx="18" cy="14" rx="12" ry="7" fill="var(--wood)"/><ellipse cx="18" cy="10" rx="6" ry="3" fill="var(--sign-paint)"/>',
  caecal: '<path d="M6 16c4-8 20-8 24 0c-6 4-18 4-24 0z" fill="#b58a3c"/>',
  watery: '<ellipse cx="18" cy="15" rx="14" ry="5" fill="rgba(170,160,110,0.75)"/><ellipse cx="18" cy="13" rx="5" ry="2.5" fill="var(--wood)"/>',
  undigested: '<ellipse cx="18" cy="14" rx="12" ry="7" fill="var(--wood)"/><circle cx="13" cy="12" r="2" fill="var(--sign-yellow)"/><circle cx="21" cy="15" r="2" fill="var(--sign-yellow)"/><circle cx="24" cy="11" r="1.6" fill="var(--sign-yellow)"/>',
  bloody: '<ellipse cx="18" cy="14" rx="12" ry="7" fill="var(--wood)"/><path d="M12 12q3 3 6 0M20 16q3 2 5 -1" stroke="var(--hen-comb)" stroke-width="2.2" fill="none"/>',
  white: '<ellipse cx="18" cy="15" rx="13" ry="5" fill="var(--sign-paint)"/><ellipse cx="18" cy="14" rx="5" ry="2.5" fill="#e8e3d0"/>',
};
const dropPic = (k) => `<svg viewBox="0 0 36 24" width="36" height="24" aria-hidden="true">${DROP[k]}</svg>`;

export function buildBirdCheck(api) {
  const { L } = api;
  const { env, skills } = L;
  const shell = equipShell({ cls: 'equip--check', icon: ICONS.hand, title: 'Bird in the hand', sub: 'Bird check', plates: ['bird-check'], signLinks: ['sign-legs', 'sign-droppings'], onClose: L.close });
  const pic = h('div', { class: 'cyc-hand-pic' });
  const seen = h('p', { class: 'cyc-line cyc-dim' });
  const rows = LOOKS.map((x) => {
    const b = button({ class: 'btn btn--machine' }, x.btn);
    const v = h('span', { class: 'cyc-look-v', 'aria-live': 'polite' });
    b.addEventListener('click', () => take1(x.look));
    return { ...x, b, v, el: h('div', { class: 'cyc-look' }, b, v) };
  });
  const quick = button({ class: 'btn btn--machine btn--go' }, 'Quick check: every look');
  quick.addEventListener('click', () => { for (const k of QUICK) take1(k); });
  const cull = button({ class: 'btn btn--machine btn--cull' }, 'Cull');
  const back = button({ class: 'btn btn--machine' }, 'Put back');
  back.addEventListener('click', () => L.close());
  const guide = h('div', { class: 'cyc-guide', hidden: true });
  const card = h('div', { class: 'cyc-card', hidden: true });
  const tally = h('p', { class: 'cyc-line cyc-dim' });
  shell.main.append(h('div', { class: 'cyc-hand-top' }, pic, h('div', null, seen, tally, h('div', { class: 'equip-btns' }, quick, cull, back))),
    h('div', { class: 'cyc-looks' }, rows.map((r) => r.el)), guide, card);

  let bird = null, got = {}, pickNo = 0;
  const log = () => L.cycle?.samples;
  function take1(look) {
    if (!bird || got[look] !== undefined) return;
    const r = L.act('sample.bird', { x: bird.x, z: bird.z, index: bird.index, look });
    const value = r && typeof r === 'object' ? r.value : null;
    got[look] = value;
    log()?.add({ day: env.dayNumber, pick: bird.pick, x: bird.x, z: bird.z, look, value });
    sync();
  }
  cull.addEventListener('click', () => {
    if (!bird) return;
    const lame = bird.purpose === 'lame' || (Number.isFinite(got.gait) && got.gait >= 3);
    L.act('chicks.cull', { n: 1, reason: lame ? 'lame' : 'sick', index: bird.index });
    L.flock?.releaseBird?.(bird.index, true);
    if (L.props.carrying === 'chick') L.props.drop();
    bird = null; L.close();
  });

  function drawGuide() {
    const on = !!skills?.unlocked?.('droppingsGuide') && got.droppings !== undefined;
    guide.hidden = !on;
    if (!on || guide.__drawn) return;
    guide.__drawn = true;
    const b = api.boards('sign-droppings');
    const items = (b?.items || []).filter((it) => /read the droppings|normal|watery|blood|white/i.test(it.text));
    guide.replaceChildren(
      h('div', { class: 'cyc-guide-pics' }, ['normal', 'caecal', 'watery', 'undigested', 'bloody', 'white'].flatMap((k) => [h('span', { html: dropPic(k) }), h('span', null, WORDS.droppings(k))])),
      h('div', { class: 'cyc-guide-lines' }, items.flatMap((it) => [h('span', { html: ICONS.facts, 'aria-hidden': 'true' }), h('span', null, it.text), h('p', { class: 'src' }, api.sourceLabel(it.source))])));
    // the guide sits next to the reading: bring it into view the first time it opens (960 x 600)
    if (typeof guide.scrollIntoView === 'function' && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { try { guide.scrollIntoView({ block: 'nearest' }); } catch { /* old browsers */ } });
  }
  function drawCard() {
    const on = !!skills?.unlocked?.('sampleCard');
    card.hidden = !on;
    if (!on) return;
    const today = log()?.today(env.dayNumber) || [];
    const by = {};
    for (const e of today) if (e.value != null && e.look !== 'weight' && e.look !== 'temp') ((by[e.look] ||= {})[e.value] = (by[e.look][e.value] || 0) + 1);
    const w = today.filter((e) => e.look === 'weight' && Number.isFinite(e.value));
    const lines = Object.entries(by).map(([k, m]) => h('div', null, h('b', null, `${k}: `), Object.entries(m).map(([v, n]) => `${SHORT[k]?.[v] ?? v} × ${n}`).join(' · ')));
    if (w.length) lines.push(h('div', null, h('b', null, 'weight: '), `${w.length} bird${w.length === 1 ? '' : 's'}, mean ${int(w.reduce((a, e) => a + e.value, 0) / w.length)} g`));
    card.replaceChildren(h('div', null, h('b', null, `Today’s samples · day ${env.dayNumber}`)), ...(lines.length ? lines : [h('div', null, 'No readings yet today.')]));
  }
  function sync() {
    const p = bird?.purpose;
    for (const r of rows) {
      r.el.hidden = !!r.unlock && !skills?.unlocked?.(r.unlock);
      const v = got[r.look];
      r.b.disabled = !bird || v !== undefined;
      setText(r.v, v === undefined ? '' : WORDS[r.look]?.(v) ?? '—');
    }
    quick.hidden = !skills?.unlocked?.('symptomCheck');
    quick.disabled = !bird || QUICK.every((k) => got[k] !== undefined);
    cull.disabled = !bird;
    const age = flockAgeAt(env.day);
    const k = `${p}|${Math.round(age)}`;
    if (pic.__k !== k) { pic.__k = k; pic.innerHTML = broilerSvg(age, p === 'lame' ? 'sit' : p === 'sick' ? 'fluffed' : 'stand', 110); }
    setText(seen, p === 'lame' ? 'It was sitting and limped when it moved.' : p === 'sick' ? 'It was sitting apart, feathers fluffed.' : bird ? 'Picked up among the flock.' : 'No bird in your hands.');
    const sub = shell.el.querySelector('.ctrl-brand p');
    if (sub) setText(sub, p === 'lame' ? 'A bird that cannot walk well' : p === 'sick' ? 'A sick-looking bird' : 'Bird check');
    const today = log()?.today(env.dayNumber) || [];
    const picks = new Map();
    for (const e of today) picks.set(e.pick, houseSector(e.x ?? 0, e.z ?? 0));
    const n = picks.size, s = new Set(picks.values()).size;
    setText(tally, n ? `Birds checked today: ${n} from ${s} part${s === 1 ? '' : 's'} of the house.` : 'Birds checked today: none yet.');
    drawGuide(); drawCard();
  }
  return {
    el: shell.el,
    /** ui.js calls this right after opening the panel for EV.BIRD_PICK. */
    take(b) { bird = b ? { ...b, pick: `${env.dayNumber}:${++pickNo}:${b.index}` } : null; got = {}; guide.__drawn = false; sync(); },
    onOpen() { shell.refreshPlates(); sync(); },
    onClose() {
      if (bird) { L.flock?.releaseBird?.(bird.index, false); bird = null; }
      if (L.props.carrying === 'chick') L.props.drop();
    },
    update(dt, force) { if (force) sync(); },
  };
}
export const _test = { WORDS, LOOKS, SHORT };
