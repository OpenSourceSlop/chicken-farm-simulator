// The Flock watch card (the farmer's request during Phase 4, PHASE4.md §15.1): under the clock and gauge row in every
// level with birds in the house, four rows with a calm dot each (green steady, amber watch, red alert) and the measured
// value beside the level's line, and the last early warning under them. It reads level.watch.status() twice a second; the
// warning itself comes as a caption and a notebook line (ui.js, records). Owner: integrator.
// Review round: ui.js places it under the real bottom of the clock and gauge row (and the alarm banner) with setTop; on
// screens up to 1100 px wide it is a compact strip of the four dots while every row is steady and no warning is new (it
// opens by itself on an amber or red row, and on a click); the warning starts with where to look.
import { h, button, setText, store } from './ui-dom.js';
import { WATCH_STATES } from './flock-watch.js';

const ROWS = ['weight', 'deaths', 'comfort', 'intake'];
const LABEL = { weight: 'Weight', deaths: 'Deaths', comfort: 'Comfort', intake: 'Intake' };
const FOLD_KEY = 'chicken-farm.watch-folded';
const narrowNow = () => typeof window !== 'undefined' && window.innerWidth <= 1100;

/** "What happened. Likely cause: … See the sign; check the place." -> { where: 'See …; check ….', what: '…' }. */
export function splitWarning(text) {
  const i = text.lastIndexOf(' See ');
  return i < 0 ? { where: '', what: text } : { where: text.slice(i + 1), what: text.slice(0, i) };
}

export function createWatchCard(root, ctx) {
  const title = h('h2', { class: 'label' }, 'Flock watch');
  const sub = h('span', { class: 'fw-sub' });
  const fold = button({ class: 'fw-fold', 'aria-label': 'Fold the flock watch', title: 'Fold or open the flock watch', 'aria-expanded': 'true' }, '–');
  const rows = {};
  const list = h('ul', { class: 'fw-rows' }, ROWS.map((id) => {
    const dot = h('span', { class: 'fw-dot', role: 'img' });
    const value = h('span', { class: 'fw-value' });
    const detail = h('span', { class: 'fw-detail' });
    const li = h('li', { class: 'fw-row', 'data-row': id }, dot, h('span', { class: 'fw-k' }, LABEL[id]), h('span', { class: 'fw-v' }, value, detail));
    rows[id] = { li, dot, value, detail, sig: 'new' };
    return li;
  }));
  // the compact strip (narrow screens, all steady): the four dots and their labels
  const mini = h('button', { class: 'fw-mini', type: 'button', title: 'Open the flock watch', 'aria-label': 'Open the flock watch' },
    ROWS.map((id) => h('span', { class: 'fw-mini-i', 'data-row': id }, h('span', { class: 'fw-dot', role: 'img' }), LABEL[id])));
  const miniDots = [...mini.querySelectorAll('.fw-dot')];
  const warnWhere = h('b', { class: 'fw-warn-where' }), warnWhat = h('span');
  const warn = h('p', { class: 'fw-warn', hidden: true }, h('span', { class: 'fw-warn-in' }, warnWhere, ' ', warnWhat));
  const card = h('section', { class: 'card fw', hidden: true, 'aria-label': 'Flock watch' },
    h('header', { class: 'fw-head' }, title, sub, fold), list, mini, warn);
  root.appendChild(card);
  let folded = store.get?.(FOLD_KEY) === '1';
  let opened = false;      // narrow screens: the farmer opened the compact strip (until he folds it again)
  const setFold = (f) => { folded = f; card.classList.toggle('is-folded', f); setText(fold, f ? '+' : '–'); fold.setAttribute('aria-expanded', f ? 'false' : 'true'); store.set?.(FOLD_KEY, f ? '1' : '0'); };
  // narrow screens, every row steady: the fold key goes back to the compact strip; otherwise it folds the details
  fold.addEventListener('click', () => { if (narrowNow() && opened && lastCalm) { opened = false; acc = 0; return; } setFold(!folded); });
  mini.addEventListener('click', () => { opened = true; acc = 0; });
  setFold(folded);
  let acc = 0, lastWarn = '', lastTop = null, lastCalm = true;

  return {
    el: card,
    /** The card's top in px inside the HUD (ui.js: under the clock and gauge row and the alarm banner). */
    setTop(px) { if (px !== lastTop && Number.isFinite(px)) { lastTop = px; card.style.top = `${px}px`; } },
    update(dt, on) {
      if ((acc -= dt) > 0) return;
      acc = 0.5;
      const st = on ? ctx.level?.watch?.status?.() : null;
      const show = !!(st && st.on);
      if (card.hidden === show) card.hidden = !show;
      if (!show) return;
      setText(sub, ctx.level?.def?.short ?? '');
      let calm = true;
      ROWS.forEach((id, i) => {
        const r = st.rows[id], R = rows[id];
        if (r && r.state !== 'green') calm = false;
        miniDots[i].className = `fw-dot is-${r ? r.state : 'none'}`;
        const sig = r ? `${r.state}|${r.value}|${r.detail}` : '';
        if (sig === R.sig) return;
        R.sig = sig;
        R.li.hidden = !r;
        if (!r) return;
        R.dot.className = `fw-dot is-${r.state}`;
        R.dot.setAttribute('aria-label', WATCH_STATES[r.state]); R.dot.title = WATCH_STATES[r.state];
        R.li.dataset.state = r.state;
        setText(R.value, r.value); setText(R.detail, r.detail || '');
      });
      // the last warning while it is less than 12 farm hours old: where to look first, then what happened
      const w = st.last, env = ctx.env;
      const text = w && env && env.day - w.t < 0.5 ? w.text : '';
      if (text !== lastWarn) { lastWarn = text; const p = splitWarning(text); setText(warnWhere, p.where); setText(warnWhat, p.what); warn.hidden = !text; warn.title = text; }
      lastCalm = calm && !text;
      const compact = narrowNow() && !opened && lastCalm;
      card.classList.toggle('is-compact', compact);
    },
    hide() { card.hidden = true; },
  };
}
