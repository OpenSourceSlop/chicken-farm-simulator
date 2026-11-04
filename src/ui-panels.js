// Panel host (dialog open/close, focus, input lock) and the painted sign boards.
// Owner: systems/UI agent.
import { SIGNS, brooderTableRows } from './content.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One dialog at a time. While a panel is open the farmer does not take keyboard input.
export function createPanelHost(parent, { player, canvas, onOpen, onClose }) {
  const scrim = h('div', { class: 'scrim', hidden: true });
  parent.appendChild(scrim);
  const factories = new Map();
  const built = new Map();
  let current = null;
  // the steps hotfix: a panel whose machine job still runs (a flow test, the filter, a wash) when it closes keeps
  // its update running in the background until the job is done and recorded (panel.busy() says so)
  const background = new Set();

  scrim.addEventListener('click', () => close());

  // opts.kind: 'sign' (the clock stands still), 'paused' (records, notebook, skill tree, result),
  // 'panel' (equipment and inspection: the slow panel clock). A built panel may set its own .kind.
  const kinds = new Map();
  function register(id, factory, opts = {}) { factories.set(id, factory); kinds.set(id, opts.kind || 'panel'); }
  // Forget every built panel (a mode change: sandbox and level panels share ids).
  function clearBuilt() {
    if (current) close(false);
    background.clear();
    for (const p of built.values()) { p.dispose?.(); p.el.remove(); }
    built.clear();
  }

  function open(id) {
    if (!factories.has(id)) return false;
    if (current) close(false);
    let panel = built.get(id);
    if (!panel) {
      panel = factories.get(id)();
      panel.el.hidden = true;
      panel.el.addEventListener('keydown', trapTab);
      parent.appendChild(panel.el);
      built.set(id, panel);
    }
    const active = document.activeElement;
    current = { id, panel, returnFocus: active && active !== document.body ? active : null };
    player.inputEnabled = false;
    scrim.hidden = false;
    panel.el.hidden = false;
    panel.onOpen?.();
    panel.update?.(0, true);
    panel.el.focus({ preventScroll: true });
    onOpen?.(id);
    return true;
  }

  function close(restoreFocus = true) {
    if (!current) return;
    const { panel, returnFocus } = current;
    current = null;
    panel.onClose?.();
    if (panel.busy?.()) background.add(panel);
    panel.el.hidden = true;
    scrim.hidden = true;
    player.inputEnabled = true;
    if (restoreFocus) {
      const target = returnFocus && document.contains(returnFocus) ? returnFocus : canvas;
      target?.focus?.({ preventScroll: true });
    }
    onClose?.();
  }

  // Keep Tab inside the open dialog.
  function trapTab(e) {
    if (e.key !== 'Tab' || !current) return;
    const items = [...current.panel.el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === current.panel.el)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  }

  return {
    register,
    clearBuilt,
    open,
    close,
    has: (id) => factories.has(id),
    get openId() { return current ? current.id : null; },
    /** 'sign' | 'paused' | 'panel' | null for the open panel; an open plate inside makes it 'sign'. */
    get openKind() {
      if (!current) return null;
      const k = current.panel.kind || kinds.get(current.id) || 'panel';
      if (k === 'panel' && [...current.panel.el.querySelectorAll('.plate.is-open')].some((p) => p.offsetParent !== null)) return 'sign';
      return k;
    },
    get openPanel() { return current ? current.panel : null; },
    update(dt) {
      current?.panel.update?.(dt, false);
      for (const p of background) {
        if (p === current?.panel) { background.delete(p); continue; }
        p.update?.(dt, false);
        if (!p.busy?.()) background.delete(p);
      }
    },
    /** A mode change (title, result, sandbox): no machine job of the level runs on behind it. */
    dropBackground() { background.clear(); },
    /** Panels still finishing a machine job with their panel closed (tests). */
    get backgroundCount() { return background.size; },
    /** PHASE4.md §15.2: the ids of the panels finishing a machine job in the background (their jobs are held open). */
    backgroundIds() { const out = []; for (const [id, p] of built) if (background.has(p)) out.push(id); return out; },
  };
}

// Shared dialog frame: a close button with a visible label and the Esc hint.
export function dialogShell(cls, titleId, onClose) {
  const closeBtn = button({ class: 'panel-close', 'aria-label': 'Close' });
  closeBtn.innerHTML = `${ICONS.close}<span>Close</span><kbd class="kbd">Esc</kbd>`;
  closeBtn.addEventListener('click', onClose);
  const el = h('section', { class: `panel ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' });
  return { el, closeBtn };
}

const source = (text) => h('p', { class: 'src' }, h('span', { class: 'src-k' }, 'Source'), ` ${text}`);

// Tiny seeded random so the sign diagrams are the same every time.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Top view of a pen with one brooder: where the chicks sit when cold, hot or comfortable.
function chickDiagram(kind) {
  const W = 132, H = 78, cx = 66, cy = 39, rnd = seeded(kind === 'cold' ? 5 : kind === 'hot' ? 9 : 21);
  const dots = [];
  if (kind === 'cold') {
    for (let i = 0; i < 46; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 11; dots.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]); }
  } else if (kind === 'hot') {
    for (let i = 0; i < 46; i++) {
      const side = i % 4, d = 4 + rnd() * 5, u = rnd();
      if (side === 0) dots.push([8 + u * (W - 16), d + 2]);
      else if (side === 1) dots.push([8 + u * (W - 16), H - d - 2]);
      else if (side === 2) dots.push([d + 2, 8 + u * (H - 16)]);
      else dots.push([W - d - 2, 8 + u * (H - 16)]);
    }
  } else {
    for (let gx = 0; gx < 9; gx++) for (let gy = 0; gy < 5; gy++) {
      const x = 10 + gx * 14 + (rnd() - 0.5) * 7, y = 10 + gy * 14.5 + (rnd() - 0.5) * 7;
      if (Math.hypot(x - cx, y - cy) > 8) dots.push([x, y]);
    }
  }
  // Brooder glow only in the cold picture: the burner is running and the chicks crowd under it.
  const glow = kind === 'cold' ? '<circle cx="66" cy="39" r="17" style="fill: var(--accent)" opacity="0.22"/>' : '';
  const chicks = dots.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3"/>`).join('');
  return `<svg class="sign-diagram" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="3" style="fill: var(--sign-shade); stroke: var(--sign-paint)" stroke-width="1.6"/>
    ${glow}<circle cx="66" cy="39" r="9" style="fill: none; stroke: var(--sign-paint)" stroke-width="1.4" stroke-dasharray="3 2.4"/>
    <g style="fill: var(--chick)">${chicks}</g></svg>`;
}

function bolts() {
  return ['tl', 'tr', 'bl', 'br'].map((p) => h('span', { class: `bolt bolt--${p}`, 'aria-hidden': 'true' }));
}

// A painted farm sign board for `sign-gate` or `sign-brooder`.
export function buildSignPanel(id, env, onClose) {
  const sign = SIGNS[id];
  const titleId = uniqueId('sign-title');
  const { el, closeBtn } = dialogShell(`sign sign--${sign.kind}`, titleId, onClose);
  const head = h('header', { class: 'sign-head' },
    h('p', { class: 'sign-kicker' }, sign.kicker),
    h('h2', { class: 'sign-title', id: titleId }, sign.title));
  const body = h('div', { class: 'sign-body' });
  let todayDay = null;
  let todayValue = null;

  if (sign.kind === 'gate') {
    const ol = h('ol', { class: 'sign-steps' });
    sign.items.forEach((it, i) => ol.append(h('li', null, h('span', { class: 'sign-num', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', null, h('p', { class: 'sign-text' }, it.text), source(it.source)))));
    body.append(ol);
  } else {
    todayValue = h('strong');
    const today = h('p', { class: 'sign-today' }, h('span', { class: 'sign-today-k' }, 'Your flock today'), todayValue);
    const t = sign.table;
    const rows = brooderTableRows().map((r) => h('tr', null,
      h('th', { scope: 'row' }, `Day ${r.day}`),
      h('td', null, `${r.temp.toFixed(1).replace('.0', '')} °C`),
      h('td', { class: 'approx' }, r.approx ? 'approx.' : '')));
    const table = h('table', { class: 'sign-table' },
      h('caption', { class: 'sr-only' }, t.caption),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t.colAge), h('th', { scope: 'col', colspan: '2', class: 'th-temp' }, t.colTemp))),
      h('tbody', null, rows));
    const left = h('div', { class: 'sign-col' }, today, table, h('p', { class: 'sign-note' }, t.approxNote), source(t.source));
    const reads = sign.read.map((r) => h('li', { class: `read read--${r.kind}` },
      h('span', { html: chickDiagram(r.kind) }),
      h('div', null, h('p', { class: 'read-head' }, r.head), h('p', { class: 'read-text' }, r.text))));
    const right = h('div', { class: 'sign-col' },
      h('h3', { class: 'sign-sub' }, sign.readTitle), h('ul', { class: 'reads' }, reads), source(sign.readSource),
      h('div', { class: 'sign-preheat' }, h('span', { class: 'sign-flame', html: ICONS.flame, 'aria-hidden': 'true' }),
        h('div', null, h('p', { class: 'sign-text' }, sign.preheat.text), source(sign.preheat.source))));
    body.append(h('div', { class: 'sign-grid' }, left, right));
  }

  const board = h('div', { class: 'sign-board' }, bolts(), h('div', { class: 'sign-face' }, head, body));
  el.append(board, closeBtn, h('div', { class: 'sign-posts', 'aria-hidden': 'true' }, h('span'), h('span')));

  return {
    el,
    update() {
      if (!todayValue) return;
      const d = env.dayNumber;
      if (d !== todayDay) { todayDay = d; setText(todayValue, `day ${d}`); }
    },
  };
}
