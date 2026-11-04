// The Flock watch card (the farmer's request during Phase 4, PHASE4.md §15.1): under the clock card in every level with
// birds in the house, four rows with a calm dot each (green steady, amber watch, red alert) and the measured value
// beside the level's line, and the last early warning under them. It reads level.watch.status() twice a second; the
// warning itself comes as a caption and a notebook line (ui.js, records). Owner: integrator.
import { h, button, setText, store } from './ui-dom.js';
import { WATCH_STATES } from './flock-watch.js';

const ROWS = ['weight', 'deaths', 'comfort', 'intake'];
const LABEL = { weight: 'Weight', deaths: 'Deaths', comfort: 'Comfort', intake: 'Intake' };
const FOLD_KEY = 'chicken-farm.watch-folded';

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
  const warn = h('p', { class: 'fw-warn', hidden: true });
  const card = h('section', { class: 'card fw', hidden: true, 'aria-label': 'Flock watch' },
    h('header', { class: 'fw-head' }, title, sub, fold), list, warn);
  root.appendChild(card);
  let folded = store.get?.(FOLD_KEY) === '1';
  const setFold = (f) => { folded = f; card.classList.toggle('is-folded', f); setText(fold, f ? '+' : '–'); fold.setAttribute('aria-expanded', f ? 'false' : 'true'); store.set?.(FOLD_KEY, f ? '1' : '0'); };
  fold.addEventListener('click', () => setFold(!folded));
  setFold(folded);
  let acc = 0, lastWarn = '';

  return {
    el: card,
    update(dt, on) {
      if ((acc -= dt) > 0) return;
      acc = 0.5;
      const st = on ? ctx.level?.watch?.status?.() : null;
      const show = !!(st && st.on);
      if (card.hidden === show) card.hidden = !show;
      if (!show) return;
      setText(sub, ctx.level?.def?.short ?? '');
      for (const id of ROWS) {
        const r = st.rows[id], R = rows[id];
        const sig = r ? `${r.state}|${r.value}|${r.detail}` : '';
        if (sig === R.sig) continue;
        R.sig = sig;
        R.li.hidden = !r;
        if (!r) continue;
        R.dot.className = `fw-dot is-${r.state}`;
        R.dot.setAttribute('aria-label', WATCH_STATES[r.state]); R.dot.title = WATCH_STATES[r.state];
        R.li.dataset.state = r.state;
        setText(R.value, r.value); setText(R.detail, r.detail || '');
      }
      // the last warning while it is less than 12 farm hours old
      const w = st.last, env = ctx.env;
      const text = w && env && env.day - w.t < 0.5 ? w.text : '';
      if (text !== lastWarn) { lastWarn = text; setText(warn, text); warn.hidden = !text; }
    },
    hide() { card.hidden = true; },
  };
}
