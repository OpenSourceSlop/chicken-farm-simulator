// The Flock watch card (the farmer's request during Phase 4, PHASE4.md §15.1): under the clock and gauge row in every
// level with birds in the house, four rows with a calm dot each (green steady, amber watch, red alert) and the measured
// value beside the level's line, and the last early warning under them. It reads level.watch.status() twice a second; the
// warning itself comes as a caption and a notebook line (ui.js, records). Owner: integrator.
// Review round: ui.js places it under the real bottom of the clock and gauge row (and the alarm banner) with setTop; on
// screens up to 1100 px wide it is a compact strip of the four dots while every row is steady and no warning is new (it
// opens by itself on an amber or red row, and on a click); the warning starts with where to look.
// Phase 5 (package experience, PHASE5.md §4.1, §6.8.3): interface.watch shown / folded (the dots only, open on a click) /
// hidden (no card: the warnings still come as captions and notebook lines); the warning is shown whole: when the card
// would reach the time bar, fit() gives its box the room left and it scrolls inside, with a fade and "more below".
import { h, button, setText, store, injectStyle } from './ui-dom.js';
import { WATCH_STATES } from './flock-watch.js';
// Skills update (SKILLS.md §5.3, §3.9, §12.9): the Equipment row (while a system is on: status() gives it), Show me on the
// comfort row (a warning's fix: ui.showMe opens its panel and points the marker), where you stand (Comfort 3)
import { SKILLS_UPDATE } from './config.js';

// the final check: a fifth row, the water supply (the tank, its pump and the meter), only where the farm has the water
// condition's tank (the row and its compact dot are hidden while status() gives none)
const ROWS = ['weight', 'deaths', 'comfort', 'intake', 'supply', 'equipment'];
/** An equipment warning's four lines (12 px at 1.32, the box's padding): the clamp of index.template.html's .fw-warn.is-clamp. */
const CLAMP_PX = 74;
const LABEL = { weight: 'Weight', deaths: 'Deaths', comfort: 'Comfort', intake: 'Intake', supply: 'Supply', equipment: 'Equipment' };
const SKILL_CSS = `
.fw-showme { float: right; margin: 0 0 3px 8px; padding: 0 6px; min-height: 0; height: 20px; font: 600 11px/18px var(--font-display); letter-spacing: 0.03em; }
.fw-stand { display: block; color: var(--ink-dim); font-size: 11.5px; }
`;
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
/** Comfort 3 (SKILLS.md §3.9): the comfort where the farmer stands, against the row (the pure watch has no position). */
export function whereYouStand(env, player) {
  if (!env || !player?.isInside || typeof env.comfort !== 'function') return '';
  const p = player.position;
  let v = null;
  try { v = env.comfort(p.x, p.z); } catch { v = null; }
  if (!Number.isFinite(v)) return '';
  const row = (env.dayNumber ?? 0) <= 21 ? 'the row' : 'the target';
  return Math.abs(v) < 0.05 ? `where you stand: at ${row}` : `where you stand: ${one(Math.abs(v))} °C ${v < 0 ? 'under' : 'over'} ${row}`;
}
const FOLD_KEY = 'chicken-farm.watch-folded';
const narrowNow = () => typeof window !== 'undefined' && window.innerWidth <= 1100;

/** "What happened. Likely cause: … See the sign; check the place." -> { where: 'See …; check ….', what: '…' }. */
export function splitWarning(text) {
  const i = text.lastIndexOf(' See ');
  return i < 0 ? { where: '', what: text } : { where: text.slice(i + 1), what: text.slice(0, i) };
}

export function createWatchCard(root, ctx) {
  try { injectStyle('fw-skills-style', SKILL_CSS); } catch { /* a page without a full document (node tests) */ }
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
  // Skills update: Show me (the comfort warning's fix) and where you stand, on the comfort row
  const showMe = button({ class: 'btn btn--quiet fw-showme', hidden: true, 'data-watch': 'show-me' }, 'Show me');
  const stand = h('span', { class: 'fw-stand', hidden: true });
  let fixNow = null;
  showMe.addEventListener('click', (e) => { e.stopPropagation(); if (fixNow) ctx.ui?.showMe?.(fixNow); });
  // (integration) Show me belongs to the warning it opens (a comfort or an equipment warning): at the top of its box
  rows.comfort.li.querySelector('.fw-v').append(stand);
  // the compact strip (narrow screens, all steady): the four dots and their labels
  const mini = h('button', { class: 'fw-mini', type: 'button', title: 'Open the flock watch', 'aria-label': 'Open the flock watch' },
    ROWS.map((id) => h('span', { class: 'fw-mini-i', 'data-row': id }, h('span', { class: 'fw-dot', role: 'img' }), LABEL[id], h('span', { class: 'fw-mini-w', hidden: true }))));
  const miniDots = [...mini.querySelectorAll('.fw-dot')], miniItems = [...mini.querySelectorAll('.fw-mini-i')], miniWords = [...mini.querySelectorAll('.fw-mini-w')];
  const warnWhere = h('b', { class: 'fw-warn-where' }), warnWhat = h('span');
  const warn = h('p', { class: 'fw-warn', hidden: true, tabindex: '-1' }, showMe, h('span', { class: 'fw-warn-in' }, warnWhere, ' ', warnWhat));
  const more = button({ class: 'fw-more', hidden: true, 'aria-label': 'Show more of the warning' }, 'more below ▾');
  // the review round: an equipment warning is clamped to four lines (is-clamp); its more key opens the rest and closes it
  // again; any other warning scrolls inside its room as before
  const clamped = () => warn.classList.contains('is-clamp') && !warn.classList.contains('is-open');
  more.addEventListener('click', () => {
    if (warn.classList.contains('is-clamp')) { warn.classList.toggle('is-open'); acc = 0; tightKey = ''; syncMore(); return; }
    warn.scrollBy({ top: Math.max(24, warn.clientHeight * 0.7), behavior: 'smooth' });
  });
  const syncMore = () => {
    const over = warn.scrollHeight - warn.clientHeight > 1, open = warn.classList.contains('is-clamp') && warn.classList.contains('is-open');
    const m = open || (over && (clamped() || warn.scrollTop + warn.clientHeight < warn.scrollHeight - 1));
    if (more.hidden === m) more.hidden = !m;
    const label = open ? 'less ▴' : clamped() ? 'more ▾' : 'more below ▾';
    if (more.textContent !== label) more.textContent = label;
    warn.classList.toggle('is-more', m && !open);
  };
  warn.addEventListener('scroll', syncMore);
  const card = h('section', { class: 'card fw', hidden: true, 'aria-label': 'Flock watch' },
    h('header', { class: 'fw-head' }, title, sub, fold), list, mini, warn, more);
  root.appendChild(card);
  let folded = store.get?.(FOLD_KEY) === '1';
  let opened = false;      // narrow screens: the farmer opened the compact strip (until he folds it again)
  const setFold = (f) => { folded = f; card.classList.toggle('is-folded', f); setText(fold, f ? '+' : '–'); fold.setAttribute('aria-expanded', f ? 'false' : 'true'); store.set?.(FOLD_KEY, f ? '1' : '0'); };
  // narrow screens, every row steady: the fold key goes back to the compact strip; otherwise it folds the details
  fold.addEventListener('click', () => { if (opened && ((narrowNow() && lastCalm) || pref() === 'folded')) { opened = false; acc = 0; return; } setFold(!folded); });
  mini.addEventListener('click', () => { opened = true; acc = 0; });
  setFold(folded);
  let acc = 0, lastWarn = '', lastTop = null, lastCalm = true, tightKey = '';
  const pref = () => { try { return ctx.settings?.get?.('interface.watch') || 'shown'; } catch { return 'shown'; } };
  // a change in the settings shows at once (the next update draws it; the folded strip starts closed)
  try { ctx.settings?.subscribe?.((c) => { if (c.key === 'watch') { opened = false; acc = 0; } }, 'interface'); } catch { /* no store */ }
  /** The room the warning box has (PHASE5.md §6.8.3): the card's bottom stays 12 px over the time bar's top. */
  function fit(limitY) {
    if (card.hidden || warn.hidden || !Number.isFinite(limitY)) { if (warn.style.maxHeight) warn.style.maxHeight = ''; syncMore(); return; }
    // measured without clearing the box (its scroll position stays): the room from the box's top to 12 px over the time bar
    const r = card.getBoundingClientRect(), wr = warn.getBoundingClientRect(), s = r.width / Math.max(1, card.offsetWidth) || 1;
    const moreH = more.hidden ? 0 : more.getBoundingClientRect().height + 3 * s;
    const below = r.bottom - wr.bottom - moreH, room = (limitY - 12) - wr.top - below;
    // too little room for three lines of the warning (a large HUD on a 600 px screen): the rows keep their values and drop
    // their detail lines while this warning shows, so the warning keeps its room (the card never reaches the time bar)
    const key = `${lastWarn.length}|${Math.round(limitY)}|${Math.round(r.width)}`;
    if (key !== tightKey) { tightKey = key; if (card.classList.contains('is-tight')) { card.classList.remove('is-tight'); fit(limitY); return; } }
    if (!card.classList.contains('is-tight') && (clamped() ? Math.min(warn.scrollHeight, CLAMP_PX) : warn.scrollHeight) * s > room + 0.5 && room - 18 * s < 58 * s) { card.classList.add('is-tight'); fit(limitY); return; }
    const full = clamped() ? Math.min(warn.scrollHeight, CLAMP_PX) : warn.scrollHeight;
    const want = full * s <= room + 0.5 ? '' : `${Math.max(36, Math.floor((room - 18 * s) / s))}px`;
    if (warn.style.maxHeight !== want) warn.style.maxHeight = want;
    syncMore();
  }

  return {
    el: card,
    /** The card's top in px inside the HUD (ui.js: under the clock and gauge row and the alarm banner). */
    setTop(px) { if (px !== lastTop && Number.isFinite(px)) { lastTop = px; card.style.top = `${px}px`; } },
    fit,
    update(dt, on) {
      if ((acc -= dt) > 0) return;
      acc = 0.5;
      const mode = pref();
      const st = on && mode !== 'hidden' ? ctx.level?.watch?.status?.() : null;
      const show = !!(st && st.on);
      if (card.hidden === show) card.hidden = !show;
      if (!show) return;
      setText(sub, ctx.level?.def?.short ?? '');
      let calm = true;
      ROWS.forEach((id, i) => {
        const r = st.rows[id], R = rows[id];
        if (r && r.state !== 'green') calm = false;
        // fix round: a shape and a word for every state, not the colour alone (steady ●, watch ▲, alert ■ with !)
        const cls = `fw-dot is-${r ? r.state : 'none'}`, word = r ? WATCH_STATES[r.state] || '' : '';
        if (miniDots[i].className !== cls) { miniDots[i].className = cls; miniDots[i].setAttribute('aria-label', word); miniDots[i].title = word; }
        const mw = r && r.state !== 'green' ? ` · ${word}` : '';
        if (miniWords[i].textContent !== mw) { miniWords[i].textContent = mw; miniWords[i].hidden = !mw; }
        if (miniItems[i].hidden !== !r) miniItems[i].hidden = !r;
        // the review round: the Equipment row drops its detail while the warning box shows that fault's warning
        const wl = st.last, dropDetail = id === 'equipment' && r && wl && wl.kind === 'equipment' && wl.fault === r.fault && ctx.env && ctx.env.day - wl.t < 0.5;
        const sig = r ? `${r.state}|${r.value}|${dropDetail ? '' : r.detail}` : '';
        if (sig === R.sig) return;
        R.sig = sig;
        R.li.hidden = !r;
        if (!r) return;
        R.dot.className = `fw-dot is-${r.state}`;
        R.dot.setAttribute('aria-label', WATCH_STATES[r.state]); R.dot.title = WATCH_STATES[r.state];
        R.li.dataset.state = r.state;
        setText(R.value, r.value); setText(R.detail, dropDetail ? '' : r.detail || '');
      });
      // the last warning while it is less than 12 farm hours old: where to look first, then what happened
      const w = st.last, env = ctx.env;
      const text = w && env && env.day - w.t < 0.5 ? w.text : '';
      // Skills update: Show me while the last warning carries its fix (Comfort 2); where you stand inside (Comfort 3)
      if (SKILLS_UPDATE.live) {
        fixNow = text && w.fix ? w.fix : null;
        if (showMe.hidden === !!fixNow) showMe.hidden = !fixNow;
        let has3 = false;
        try { has3 = !!ctx.perks?.has?.('comfortAlways'); } catch { has3 = false; }
        const s = has3 ? whereYouStand(env, ctx.player) : '';
        if (stand.textContent !== s) setText(stand, s);
        stand.hidden = !s;
      } else if (!showMe.hidden || !stand.hidden) { showMe.hidden = true; stand.hidden = true; fixNow = null; }
      if (text !== lastWarn) {
        lastWarn = text; const p = splitWarning(text); setText(warnWhere, p.where); setText(warnWhat, p.what); warn.hidden = !text; warn.scrollTop = 0; warn.removeAttribute('title');
        warn.classList.toggle('is-clamp', !!(text && w.kind === 'equipment')); warn.classList.remove('is-open');
      }
      lastCalm = calm && !text;
      // folded (the settings): the dots only until he opens it; narrow screens: the dots while every row is steady
      const compact = mode === 'folded' ? !opened : narrowNow() && !opened && lastCalm;
      card.classList.toggle('is-compact', compact);
    },
    hide() { card.hidden = true; },
  };
}
