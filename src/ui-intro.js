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
  { id: 'signs', when: 'level-start', anchor: 'sign', text: 'Signs stand where you use their facts. Walk up to one and press {key:use} to read it; the small line under each fact names its source.' },
  { id: 'time', when: 'level-start', anchor: '.hud-bl .timebar', text: 'The farm clock: pause ({key:pause}), 1× and 4× ({key:speed1}, {key:speed4}). Next job ({key:nextJob}) skips to the next job. {key:menu} opens the menu (saves, settings, how to play); {key:map} opens the farm map.' },
  { id: 'watch', when: 'watch-shown', anchor: '.fw', text: 'The flock watch measures the birds every farm hour (weight, deaths, comfort, intake) beside this level’s line, and warns in words when a row turns red.' },
];
// fix round: the kicker follows the day (a first level played on day 30 is not 'your first morning'; the birds are 'in'
// only on the chick day) and the number counts the cards of the group shown so far (the jobs card can wait for a job)
const MORNING_DAY = 0;  // planning (-2), prep (-1) and chick day (0): 'Your first morning'; later: 'Where things are'
const ARROW = 11;      // the arrow's length from the card's edge to the anchor
const GUTTER = 16;

const CSS = `
.intro-card { position: absolute; z-index: 14; width: min(300px, calc(100vw - 32px)); padding: 13px 15px 12px; pointer-events: auto; }
.card.intro-card { background-color: var(--panel-solid); }
/* fix round: no HUD caption behind or beside a card (it showed through; it said the next thing while the card speaks) */
.intro-on .caption { visibility: hidden; }
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
  /** Fix round: a sign's whole board on screen (its four corners projected; the boards face along z and lean back by
   *  tilt), so the card keeps off the board and not only off one point of it. null when the board is not known. */
  function boardRect(id) {
    const f = ctx.props?.boardFrame?.(id), cam = ctx.camera, THREE = ctx.THREE;
    if (!f || !cam || !THREE) return null;
    const v = new THREE.Vector3(), dy = (f.h / 2) * Math.cos(f.tilt || 0), dz = (f.h / 2) * Math.sin(f.tilt || 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      v.set(f.x + (sx * f.w) / 2, f.y + sy * dy, f.z - sy * dz).project(cam);
      if (v.z > 1) return null;
      const px = ((v.x + 1) / 2) * window.innerWidth, py = ((1 - v.y) / 2) * window.innerHeight;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function anchorBox(c) {
    if (c.anchor === 'sign') {
      const s = signPoint();
      if (!s) return null;
      const b = boardRect(s.id);
      return b && b.x <= s.x && s.x <= b.x + b.w ? { ...b, sign: s.id, world: true } : { x: s.x - 12, y: s.y - 12, w: 24, h: 24, sign: s.id, world: true };
    }
    const el = q(c.anchor);
    if (!visible(el)) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, el };
  }
  // what a card must not cover (fix round): the HUD cards, the prompt and caption, the job marker on the farm and the
  // edge pointers (the job's, the dead-bird and bucket chips); the anchor's own element is left out
  const AVOID = ['.hud-tl .clock', '.hud-tl .gauges', '.fw', '.ljobs', '.hud-tr .tasks', '.hud-bl .timebar', '.hud-bl .help:not([hidden])', '.hud-bc .prompt', '.caption', '.alarm', '.edge-pointer'];
  let markerObj = null;
  function markerRect() {
    const cam = ctx.camera, THREE = ctx.THREE;
    if (!cam || !THREE || !ctx.scene) return null;
    if (!markerObj || !markerObj.parent) markerObj = ctx.scene.getObjectByName('job-marker') || null;
    if (!markerObj?.visible) return null;
    const b = new THREE.Box3().setFromObject(markerObj), v = new THREE.Vector3();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y + 0.2 : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
      if (v.z > 1) return null;
      const px = ((v.x + 1) / 2) * window.innerWidth, py = ((1 - v.y) / 2) * window.innerHeight;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return x1 < 0 || y1 < 0 || x0 > window.innerWidth || y0 > window.innerHeight ? null : { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12, what: 'marker' };
  }
  function avoidRects(A) {
    const out = [];
    for (const sel of AVOID) {
      for (const el of (root || document).querySelectorAll(sel)) {
        if (!visible(el) || card.contains(el) || (A?.el && (A.el === el || A.el.contains(el) || el.contains(A.el)))) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ x: r.left, y: r.top, w: r.width, h: r.height, what: sel });
      }
    }
    const m = markerRect();
    if (m) out.push(m);
    return out;
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  let lastPlace = null;   // { side, off }: the card keeps its place while it still fits (no jumping as the view moves)
  /** The card beside its anchor: for a sign on the farm above or below it first, for a HUD card left or right first; each
   *  side tries the card slid along it (its arrow still on the anchor). The first place that fits the window and covers no
   *  HUD card, prompt, caption or job marker wins; when none is clear, the one that covers least. The arrow's tip on the anchor. */
  function place(A) {
    const W = window.innerWidth, H = window.innerHeight, cw = card.offsetWidth || 300, ch = card.offsetHeight || 140, g = ARROW;
    let pos = null;
    if (A) {
      const avoid = avoidRects(A), inWin = (t) => t.x >= GUTTER - 0.5 && t.x + cw <= W - GUTTER + 0.5 && t.y >= GUTTER - 0.5 && t.y + ch <= H - GUTTER + 0.5;
      const sides = A.world ? ['up', 'down', 'left', 'right'] : ['left', 'right', 'up', 'down'];
      const cand = (side, off) => {
        const across = side === 'left' || side === 'right', len = across ? ch : cw;
        const start = (across ? A.y + A.h / 2 : A.x + A.w / 2) - len / 2 + off;
        const t = { side, off,
          x: side === 'left' ? A.x - g - cw : side === 'right' ? A.x + A.w + g : start,
          y: side === 'up' ? A.y - g - ch : side === 'down' ? A.y + A.h + g : start };
        // the arrow must still land on the anchor: the card's span and the anchor's span share room for it
        const a0 = across ? A.y : A.x, a1 = a0 + (across ? A.h : A.w), c0 = across ? t.y : t.x;
        const lo = Math.max(a0, c0 + 10 + g), hi = Math.min(a1, c0 + len - 10 - g);
        if (hi < lo) return null;
        t.along = (lo + hi) / 2 - c0 - g;
        return t;
      };
      const tries = [];
      if (lastPlace) tries.push(cand(lastPlace.side, lastPlace.off));
      for (const side of sides) {
        const len = side === 'left' || side === 'right' ? ch : cw, span = (side === 'left' || side === 'right' ? A.h : A.w) + len;
        tries.push(cand(side, 0));
        for (let d = 16; d <= span / 2; d += 16) tries.push(cand(side, -d), cand(side, d));
      }
      let best = null, bestCost = Infinity;
      for (const t of tries) {
        if (!t || !inWin(t)) continue;
        const box = { x: t.x, y: t.y, w: cw, h: ch };
        let cost = 0;
        for (const r of avoid) cost += overlap(box, r);
        if (cost === 0) { best = t; break; }
        if (cost < bestCost) { bestCost = cost; best = t; }
      }
      pos = best;
    }
    lastPlace = pos ? { side: pos.side, off: pos.off } : null;
    if (!pos) pos = { side: null, x: (W - cw) / 2, y: (H - ch) / 2 };
    card.style.left = `${Math.round(pos.x)}px`; card.style.top = `${Math.round(pos.y)}px`;
    arrow.hidden = !pos.side;
    if (pos.side) {
      arrow.dataset.side = pos.side;
      const along = `${Math.round(pos.along)}px`;
      Object.assign(arrow.style, pos.side === 'left' ? { left: `${cw}px`, top: along, right: '', bottom: '' } : pos.side === 'right' ? { left: `${-g}px`, top: along, right: '', bottom: '' }
        : pos.side === 'up' ? { top: `${ch}px`, left: along, right: '', bottom: '' } : { top: `${-g}px`, left: along, right: '', bottom: '' });
    }
    ring.hidden = !A;
    if (A) Object.assign(ring.style, { left: `${Math.round(A.x - 4)}px`, top: `${Math.round(A.y - 4)}px`, width: `${Math.round(A.w + 8)}px`, height: `${Math.round(A.h + 8)}px` });
  }
  function show(c) {
    current = c;
    const group = INTRO_CARDS.filter((x) => x.when === c.when), shown = group.filter((x) => x.id !== c.id && seen().includes(x.id)).length;
    setTextOnce(kicker, kickerOf(c, shown + 1, group.length));
    setTextOnce(text, fillGuide(c.text, { keys: ctx.keys, settings: S }));
    setTextOnce(next, unseen(c.when).some((x) => x.id !== c.id && ready_(x)) ? 'Next' : 'Got it');
    card.hidden = false; lastPlace = null;
    (root || document.body).classList.add('intro-on');
    card.classList.remove('is-in'); void card.offsetWidth; if (!reducedMotion()) card.classList.add('is-in');
    place(anchorBox(c));
    if (!release && claimKeys) release = claimKeys(onKey);
    queueMicrotask?.(() => next.focus({ preventScroll: true }));
    return true;
  }
  function setTextOnce(el, t) { if (el.textContent !== t) el.textContent = t; }
  function hide() {
    current = null; card.hidden = true; ring.hidden = true;
    (root || document.body).classList.remove('intro-on');
    if (release) { release(); release = null; }
  }
  /** Fix round: the kicker from the day (a first level played on day 30 is not 'your first morning'; the birds are 'in'
   *  only on the chick day) and the card's number among the cards of its group shown so far. */
  function kickerOf(c, n, of) {
    const day = ctx.env?.dayNumber ?? 0;
    if (c.when === 'watch-shown') return day <= 1 ? 'The birds are in' : 'The flock watch';
    return `${day <= MORNING_DAY ? 'Your first morning' : 'Where things are'} · ${n} of ${of}`;
  }
  // the jobs card waits until the job card has a job open (it names 'the top one … the job to do now')
  const jobOpen = () => { try { const l = ctx.level?.jobs?.list?.(); return !Array.isArray(l) || l.some((i) => i.status === 'open'); } catch { return true; } };
  const ready_ = (c) => (c.id !== 'jobs' || jobOpen()) && (c.anchor === 'sign' || visible(q(c.anchor)));
  function markSeen(id) { const s = seen(); if (!s.includes(id)) put('seen', [...s, id]); }
  function advance() {
    if (!current) return;
    markSeen(current.id);
    const rest = unseen(current.when), nx = rest.find(ready_);
    if (nx) { show(nx); return; }
    if (unseen('watch-shown').length === 0 && unseen('level-start').length === 0) put('done', true);
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
    const c = unseen(reason).find(ready_);
    if (!c) return false;
    return show(c);
  }
  function reset() { put('done', false); put('seen', []); }

  return {
    cards: INTRO_CARDS,
    get active() { return !!current && !card.hidden; },
    start, skip, reset, next: advance,
    allow(on = true) { allowed = !!on; },
    update(dt) {
      if (current) {
        if (!free() && !ctx.ui?.openPanelId) { hide(); return; }       // a mode change under the card
        // a panel opened over the card (E on a sign): the card steps aside until it closes, then shows again
        if (ctx.ui?.openPanelId) { card.hidden = true; ring.hidden = true; (root || document.body).classList.remove('intro-on'); if (release) { release(); release = null; } return; }
        if (card.hidden) { show(current); return; }
        lastBoxes = anchorBox(current);
        place(lastBoxes);
        return;
      }
      if (!allowed || !free()) { ready = 0; return; }
      // the moment: a level running with its job card up (a short settle), or the flock watch showing for the first time
      ready += dt;
      if (ready < 0.6) return;
      if (unseen('level-start').length && start('level-start')) return;
      if (unseen('watch-shown').length && visible(q('.fw'))) start('watch-shown');
    },
    state() {
      const box = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const A = current ? anchorBox(current) : null;
      const strip = (r) => r && { x: r.x, y: r.y, w: r.w, h: r.h, ...(r.what ? { what: r.what } : {}), ...(r.sign ? { sign: r.sign } : {}) };
      return { active: !!current && !card.hidden, card: current?.id ?? null, anchorBox: strip(A), avoidBoxes: current ? avoidRects(A).map(strip) : [], markerBox: current ? strip(markerRect()) : null, kicker: current ? kicker.textContent : null, cardBox: box(card), arrowBox: current && !arrow.hidden ? box(arrow) : null, text: current ? text.textContent : null, done: !!get('done', false), seen: seen() };
    },
  };
}
