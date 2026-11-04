// The first-play introduction (PHASE5.md §6.1): on a player's first level, four short pointer cards, one at a time, each
// anchored to the thing it names (the job card, a sign in view, the time bar, and the flock watch when it first shows);
// Next / Got it moves on, "Skip the introduction" ends it. No lesson, no question: each card only says where something is
// and what it shows. The farm clock stands still while a card shows (ui.panelKind reads 'paused'). Remembered in settings
// intro.done / intro.seen; the guide's "Show the introduction again" calls reset(). A card's text names keys as
// {key:<action id>} tokens, filled with the live bindings by content-guide.js fillGuide. While a card shows, the intro
// takes its keys through ui.claimKeys(fn) (§8.6: Enter and Esc work on the card, Esc never opens the menu behind it).
// Owner: package "experience".
//
//   const intro = createIntro(ctx, { root, claimKeys, busy(), mode() })
//   intro.start(reason)     'level-start' | 'watch-shown' | 'again': show the next unseen card for it; true when one shows
//   intro.active            a card is showing
//   intro.skip()            end the introduction (intro.done)
//   intro.reset()           every card unseen again (the guide's key)
//   intro.update(dt)        every frame: starts a card when its moment comes, and the card follows its anchor
//   intro.allow(on)         under automation (navigator.webdriver) the cards never start by themselves (every earlier
//                           steps file plays as before); a steps file that tests them calls allow(true) first
//   intro.state()           { active, card, anchorBox, cardBox, arrowBox } (harness; page pixels)
import { h, button, injectStyle, reducedMotion } from './ui-dom.js';
import { fillGuide } from './content-guide.js';

export const INTRO_CARDS = [
  { id: 'jobs', when: 'level-start', anchor: '.hud-tr--level .ljobs', text: 'Your jobs for today. The top one is the job to do now: the orange marker on the farm shows its place, and the job says which sign holds its facts.' },
  { id: 'signs', when: 'level-start', anchor: 'sign', text: 'Signs stand where you use their facts. Walk up to one and press E to read it; the small line under each fact names its source.' },
  { id: 'time', when: 'level-start', anchor: '.hud-bl .timebar', text: 'The farm clock: pause ({key:pause}), 1× and 4× ({key:speed1}, {key:speed4}). Next job ({key:nextJob}) skips to the next job. {key:menu} opens the menu (saves, settings, how to play); {key:map} opens the farm map.' },
  { id: 'watch', when: 'watch-shown', anchor: '.fw', text: 'The flock watch measures the birds every farm hour (weight, deaths, comfort, intake) beside this level’s line, and warns in words when a row turns red.' },
];
const KICKER = { jobs: 'Your first morning · 1 of 3', signs: 'Your first morning · 2 of 3', time: 'Your first morning · 3 of 3', watch: 'The birds are in' };
const ARROW = 11;      // the arrow's length from the card's edge to the anchor
const GUTTER = 16;

const CSS = `
.intro-card { position: absolute; z-index: 14; width: min(300px, calc(100vw - 32px)); padding: 13px 15px 12px; pointer-events: auto; }
.intro-card .intro-k { margin: 0 0 6px; }
.intro-card .intro-text { margin: 0 0 11px; font-size: 14px; line-height: 1.45; color: var(--ink); }
.intro-btns { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.intro-btns .btn { min-height: 32px; }
.intro-arrow { position: absolute; width: 0; height: 0; border: ${ARROW}px solid transparent; pointer-events: none; }
.intro-arrow[data-side="left"] { border-left-color: var(--accent); border-right-width: 0; }
.intro-arrow[data-side="right"] { border-right-color: var(--accent); border-left-width: 0; }
.intro-arrow[data-side="up"] { border-top-color: var(--accent); border-bottom-width: 0; }
.intro-arrow[data-side="down"] { border-bottom-color: var(--accent); border-top-width: 0; }
.intro-card::before { content: ""; position: absolute; inset: 0; border-radius: 8px; box-shadow: 0 0 0 2px var(--accent); pointer-events: none; }
.intro-ring { position: absolute; z-index: 13; border: 2px dashed var(--accent); border-radius: 9px; pointer-events: none; }
html:not(.reduce-motion) .intro-ring { animation: intro-ring 1.6s ease-in-out infinite; }
@keyframes intro-ring { 50% { opacity: 0.45; } }
`;

export function createIntro(ctx, { root = null, claimKeys = null, busy = () => false, mode = () => ctx.level?.mode } = {}) {
  injectStyle('intro-style', CSS);
  const S = ctx.settings;
  const get = (k, d) => { try { const v = S?.get?.(`intro.${k}`); return v == null ? d : v; } catch { return d; } };
  const put = (k, v) => { try { S?.set?.(`intro.${k}`, v); } catch { /* blocked */ } };
  let allowed = !(typeof navigator !== 'undefined' && navigator.webdriver);
  let current = null, release = null, ready = 0, lastBoxes = null;
  const text = h('p', { class: 'intro-text' });
  const kicker = h('p', { class: 'label intro-k' });
  const next = button({ class: 'btn btn--accent intro-next' }, 'Next');
  const skipBtn = button({ class: 'btn btn--quiet intro-skip' }, 'Skip the introduction');
  const arrow = h('span', { class: 'intro-arrow', 'aria-hidden': 'true' });
  const card = h('section', { class: 'card intro-card', role: 'dialog', 'aria-modal': 'false', 'aria-live': 'polite', 'aria-label': 'First play: where things are', hidden: true },
    kicker, text, h('div', { class: 'intro-btns' }, next, skipBtn), arrow);
  const ring = h('div', { class: 'intro-ring', hidden: true, 'aria-hidden': 'true' });
  (root || document.body).append(ring, card);
  next.addEventListener('click', () => advance());
  skipBtn.addEventListener('click', () => skip());

  const seen = () => { const s = get('seen', []); return Array.isArray(s) ? s : []; };
  const unseen = (when) => (get('done', false) ? [] : INTRO_CARDS.filter((c) => c.when === when && !seen().includes(c.id)));
  const visible = (el) => !!el && !el.hidden && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  const q = (sel) => (root || document).querySelector(sel);

  /** The sign the signs card points to: the day's own sign when it is on screen, else the nearest sign on screen within 25 m. */
  function signPoint() {
    const cam = ctx.camera, THREE = ctx.THREE, p = ctx.player?.position;
    if (!cam || !THREE || !p) return null;
    const list = (ctx.interact?.list || []).filter((it) => /^sign-/.test(it.id) && Number.isFinite(it.x) && Number.isFinite(it.z));
    const v = new THREE.Vector3();
    const screen = (it) => {
      v.set(it.x, it.y ?? 1.6, it.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.88) return null;
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight, d: Math.hypot(it.x - p.x, it.z - p.z), id: it.id };
    };
    const want = (ctx.env?.dayNumber ?? 0) <= -2 ? 'sign-gate' : 'sign-chicks';
    const own = list.find((it) => it.id === want), o = own && screen(own);
    if (o) return o;
    const on = list.map(screen).filter((s) => s && s.d <= 25).sort((a, b) => a.d - b.d);
    return on[0] || null;
  }
  function anchorBox(c) {
    if (c.anchor === 'sign') { const s = signPoint(); return s ? { x: s.x - 12, y: s.y - 12, w: 24, h: 24, sign: s.id } : null; }
    const el = q(c.anchor);
    if (!visible(el)) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  /** The card beside its anchor (left, right, above, below: the first that fits the window), the arrow's tip on the anchor. */
  function place(A) {
    const W = window.innerWidth, H = window.innerHeight, cw = card.offsetWidth || 300, ch = card.offsetHeight || 140, g = ARROW;
    const clampX = (x) => Math.max(GUTTER, Math.min(W - GUTTER - cw, x)), clampY = (y) => Math.max(GUTTER, Math.min(H - GUTTER - ch, y));
    let pos = null;
    if (A) {
      const cy = A.y + A.h / 2, cx = A.x + A.w / 2;
      const tries = [
        { side: 'left', x: A.x - g - cw, y: clampY(cy - ch / 2) }, { side: 'right', x: A.x + A.w + g, y: clampY(cy - ch / 2) },
        { side: 'up', x: clampX(cx - cw / 2), y: A.y - g - ch }, { side: 'down', x: clampX(cx - cw / 2), y: A.y + A.h + g },
      ];
      pos = tries.find((t) => t.x >= GUTTER - 0.5 && t.x + cw <= W - GUTTER + 0.5 && t.y >= GUTTER - 0.5 && t.y + ch <= H - GUTTER + 0.5) || null;
    }
    if (!pos) pos = { side: null, x: (W - cw) / 2, y: (H - ch) / 2 };
    card.style.left = `${Math.round(pos.x)}px`; card.style.top = `${Math.round(pos.y)}px`;
    arrow.hidden = !pos.side;
    if (pos.side) {
      arrow.dataset.side = pos.side;
      const along = pos.side === 'left' || pos.side === 'right' ? Math.max(10, Math.min(ch - 10 - 2 * g, A.y + A.h / 2 - pos.y - g)) : Math.max(10, Math.min(cw - 10 - 2 * g, A.x + A.w / 2 - pos.x - g));
      Object.assign(arrow.style, pos.side === 'left' ? { left: `${cw}px`, top: `${along}px`, right: '', bottom: '' } : pos.side === 'right' ? { left: `${-g}px`, top: `${along}px`, right: '', bottom: '' }
        : pos.side === 'up' ? { top: `${ch}px`, left: `${along}px`, right: '', bottom: '' } : { top: `${-g}px`, left: `${along}px`, right: '', bottom: '' });
    }
    ring.hidden = !A;
    if (A) Object.assign(ring.style, { left: `${Math.round(A.x - 4)}px`, top: `${Math.round(A.y - 4)}px`, width: `${Math.round(A.w + 8)}px`, height: `${Math.round(A.h + 8)}px` });
  }
  function show(c) {
    current = c;
    const group = INTRO_CARDS.filter((x) => x.when === c.when);
    setTextOnce(kicker, KICKER[c.id] || 'Where things are');
    setTextOnce(text, fillGuide(c.text, { keys: ctx.keys, settings: S }));
    setTextOnce(next, group[group.length - 1].id === c.id ? 'Got it' : 'Next');
    card.hidden = false;
    card.classList.remove('is-in'); void card.offsetWidth; if (!reducedMotion()) card.classList.add('is-in');
    place(anchorBox(c));
    if (!release && claimKeys) release = claimKeys(onKey);
    queueMicrotask?.(() => next.focus({ preventScroll: true }));
    return true;
  }
  function setTextOnce(el, t) { if (el.textContent !== t) el.textContent = t; }
  function hide() {
    current = null; card.hidden = true; ring.hidden = true;
    if (release) { release(); release = null; }
  }
  function markSeen(id) { const s = seen(); if (!s.includes(id)) put('seen', [...s, id]); }
  function advance() {
    if (!current) return;
    markSeen(current.id);
    const rest = unseen(current.when);
    if (rest.length) { show(rest[0]); return; }
    if (unseen('watch-shown').length === 0) put('done', true);
    hide();
  }
  function skip() {
    if (current) markSeen(current.id);
    put('done', true);
    hide();
  }
  // Enter and Esc on the card (before the menu or a panel sees them); every other key goes on to the farm
  function onKey(e) {
    if (!current) return false;
    if (e.key === 'Escape') { e.preventDefault(); skip(); return true; }
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      if (!e.repeat) { const a = document.activeElement; if (a && card.contains(a) && a.tagName === 'BUTTON') a.click(); else advance(); }
      return true;
    }
    return false;
  }
  const free = () => mode() === 'level' && !busy() && !ctx.ui?.openPanelId && !ctx.ui?.busy?.open;
  function start(reason = 'level-start') {
    if (reason === 'again') { reset(); reason = 'level-start'; }
    if (current || !free()) return false;
    const c = unseen(reason)[0];
    if (!c) return false;
    if (c.anchor !== 'sign' && !visible(q(c.anchor))) return false;
    return show(c);
  }
  function reset() { put('done', false); put('seen', []); }

  return {
    cards: INTRO_CARDS,
    get active() { return !!current; },
    start, skip, reset, next: advance,
    allow(on = true) { allowed = !!on; },
    update(dt) {
      if (current) {
        if (!free() && !ctx.ui?.openPanelId) { hide(); return; }       // a mode change under the card
        lastBoxes = anchorBox(current);
        place(lastBoxes);
        return;
      }
      if (!allowed || !free()) { ready = 0; return; }
      // the moment: a level running with its job card up (a short settle), or the flock watch showing for the first time
      ready += dt;
      if (ready < 0.6) return;
      if (unseen('level-start').length) start('level-start');
      else if (unseen('watch-shown').length && visible(q('.fw'))) start('watch-shown');
    },
    state() {
      const box = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      return { active: !!current, card: current?.id ?? null, anchorBox: current ? anchorBox(current) : null, cardBox: box(card), arrowBox: current && !arrow.hidden ? box(arrow) : null, text: current ? text.textContent : null, done: !!get('done', false), seen: seen() };
    },
  };
}
