// Controls legend, the "needs a keyboard and mouse" card for small screens, and the E prompt pill.
// Owner: package "experience" (Phase 5: the legend's rows come from keys.js, so a rebound key shows here at once; the
// interface.helpLegend setting decides when it opens by itself; the phone note's words, PHASE5.md §6.7).
import { HELP_KEYS, promptVerb } from './content.js';
import { h, button, store, uniqueId, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { SKILLS_UPDATE } from './config.js';
// Skills update (SKILLS.md §3.0, §3.11): while live the views name their branch level and the pocket phone has its row
const LIVE_SHORT = { floorView: 'Floor temperature view (Brooding 1)', comfortView: 'Comfort view of the flock (Comfort 1)', moistureView: 'Litter moisture view (Moisture 1)', phone: 'The pocket phone (Farm Planning 2)' };
const shortWhat = (r) => (SKILLS_UPDATE.live && LIVE_SHORT[r.id]) || SHORT[r.id] || r.what;

const HELP_SEEN_KEY = 'chicken-farm.help-dismissed';

/**
 * The legend's rows from keys.js (PHASE5.md §4.3): `keys.rows(mode)` with the walk, turn, zoom and clock keys each on one
 * row, so the level's list stays low in two columns (the floor, comfort and moisture views keep a row each: their names
 * are what the farmer looks for). Every label is the key as bound now. Returns [{ ids, keys: [label], what }] (ids: the
 * keys.js actions of the row).
 */
/** The legend's own short words per action (one line each in a column of the two-column card; keys.js keeps the full
 *  words for the Keys tab and the guide). */
const SHORT = {
  use: 'Use, pick up, read a sign', useDead: 'Pick up a dead bird in a chick job', bucket: 'Set the dead-bird bucket down',
  squeeze: 'Squeeze a handful of litter', probe: 'Floor thermometer at your feet', lux: 'Light meter at bird height',
  air: 'Air meter at bird height', notebook: 'Notebook: your readings', skills: 'Skill tree', floorView: 'Floor temperature view',
  comfortView: 'Comfort view of the flock', moistureView: 'Litter moisture view', map: 'Farm map', nextJob: 'Next job',
  help: 'Show or hide this legend', sound: 'Sound on or off', menu: 'Close a panel, or the game menu', run: 'Run (hold)',
};
export function legendRows(keys, mode = 'level') {
  if (!keys?.rows) return null;
  const rows = keys.rows(mode === 'sandbox' ? 'sandbox' : 'level');
  const has = new Set(rows.map((r) => r.id));
  const L = (id) => { try { return keys.labels(id); } catch { return []; } };
  const main = (id) => { try { return keys.label(id); } catch { return ''; } };
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const GROUPS = [
    { ids: ['forward', 'left', 'back', 'right'], keys: () => uniq(['forward', 'left', 'back', 'right'].map(main)), what: 'Walk, or click the ground' },
    { ids: ['turnLeft', 'turnRight'], keys: () => uniq([main('turnLeft'), main('turnRight')]), what: 'Turn, or right-drag' },
    { ids: ['zoomIn', 'zoomOut'], keys: () => uniq(['Wheel', main('zoomIn'), main('zoomOut')]), what: 'Zoom in and out' },
    { ids: ['pause', 'speed1', 'speed4'], keys: () => uniq([main('pause'), main('speed1'), main('speed4')]), what: 'Pause the clock; 1× or 4×' },
  ];
  const out = [], done = new Set();
  for (const r of rows) {
    if (done.has(r.id)) continue;
    const g = GROUPS.find((x) => x.ids.includes(r.id));
    if (g) {
      for (const id of g.ids) done.add(id);
      out.push({ ids: g.ids.filter((id) => has.has(id) || mode !== 'sandbox'), keys: g.keys(), what: g.what });
      if (g.ids[0] === 'forward' && mode === 'sandbox') out.push({ ids: [], keys: ['Double-click'], what: 'Run to that spot' });
      continue;
    }
    done.add(r.id);
    out.push({ ids: [r.id], keys: r.id === 'useDead' ? ['Shift', main('use')] : L(r.id).length ? L(r.id) : r.keys, what: shortWhat(r) });
  }
  return out;
}

/**
 * The controls legend card and its "?" key. Two forms (both kept):
 *   createHelp(rows, seenKey)                       static rows [{ keys, what }] (Phase 1-4)
 *   createHelp({ keys, mode, seenKey, settings })   rows from keys.js, drawn again on every rebind (Phase 5)
 * interface.helpLegend (settings): 'first' as Phase 4 (the sandbox legend shows until Got it; the level's on H),
 * 'always' (ui.js shows it at each level start: showAuto()), 'never' (only on H).
 */
export function createHelp(arg = HELP_KEYS, seenKey0 = HELP_SEEN_KEY) {
  const live = !Array.isArray(arg) && arg && typeof arg === 'object';
  const keys = live ? arg.keys : null, mode = live ? arg.mode || 'level' : null, settings = live ? arg.settings : null;
  const seenKey = live ? arg.seenKey || HELP_SEEN_KEY : seenKey0;
  const staticRows = live ? (arg.fallback || HELP_KEYS) : arg;
  const titleId = uniqueId('help-title');
  const list = h('dl', { class: 'help-list' });
  const keyWord = (id, d) => { try { return keys?.label?.(id) || d; } catch { return d; } };
  let count = 0;
  function render() {
    const rows = (live && legendRows(keys, mode)) || staticRows;
    count = rows.length;
    list.replaceChildren();
    for (const row of rows) {
      // every row comes from keys.rows (the sound key's U row too: the sound package no longer injects one; its row is
      // data-legend="sound")
      const ks = row.keys.map((k) => h('kbd', { class: 'kbd' }, k));
      list.append(h('dt', { 'data-legend': row.ids?.join(' ') || null }, ks), h('dd', null, row.what));
    }
    card?.classList.toggle('help--wide', count > 12);
    if (typeof fit === 'function') fit();
    if (toggleBtn) {
      const hk = keyWord('help', 'H');
      toggleBtn.title = `Controls (${hk})`;
      toggleBtn.setAttribute('aria-label', `${card.hidden ? 'Show' : 'Hide'} the controls (${hk})`);
    }
  }
  const closeBtn = button({ class: 'btn' }, 'Got it');
  // a link to the full guide (PHASE5.md §6.2): ui.js sets onGuide
  const guideBtn = button({ class: 'btn btn--quiet help-guide', hidden: true }, 'Full guide');
  let card = null, toggleBtn = null;
  card = h('section', { class: 'card help', 'aria-labelledby': titleId },
    h('div', { class: 'help-head' }, h('span', { html: ICONS.keyboard, 'aria-hidden': 'true' }),
      h('h2', { class: 'label', id: titleId }, 'Controls'), guideBtn, closeBtn),
    list);
  toggleBtn = button({ class: 'btn btn--icon', 'aria-label': 'Show the controls (H)', title: 'Controls (H)', 'aria-expanded': 'false' }, '?');
  toggleBtn.style.fontSize = '16px';
  render();
  if (keys?.subscribe) keys.subscribe(() => render());

  // the legend kept under the top-left cards (the clock and the gauges wrap to two rows at 960 x 600 since the fan
  // gauge): when it would reach them it gets the room left and scrolls inside, as the flock watch's warning does
  function fit() {
    if (!card || card.hidden || typeof document === 'undefined' || !card.getBoundingClientRect) return;
    card.style.maxHeight = ''; card.style.overflowY = '';
    const tl = document.querySelector?.('#hud .hud-tl');
    if (!tl || !card.isConnected) return;
    const r = card.getBoundingClientRect(), k = tl.getBoundingClientRect();
    if (!r.height || !k.height || r.left >= k.right || r.top >= k.bottom + 4) return;
    const scale = card.offsetHeight ? r.height / card.offsetHeight : 1, room = (r.bottom - k.bottom - 8) / (scale || 1);
    if (room < 120) return;
    card.style.maxHeight = `${Math.floor(room)}px`; card.style.overflowY = 'auto';
  }
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', () => fit());

  function set(show) {
    card.hidden = !show;
    fit();
    const hk = keyWord('help', 'H');
    toggleBtn.setAttribute('aria-expanded', String(show));
    toggleBtn.setAttribute('aria-label', show ? `Hide the controls (${hk})` : `Show the controls (${hk})`);
  }
  closeBtn.addEventListener('click', () => { set(false); store.set(seenKey, '1'); });
  toggleBtn.addEventListener('click', () => toggle());
  function toggle() { set(card.hidden); if (card.hidden) store.set(seenKey, '1'); }
  const pref = () => { try { return settings?.get?.('interface.helpLegend') || 'first'; } catch { return 'first'; } };

  set(pref() !== 'never' && store.get(seenKey) !== '1'); // shown on first load ('first', as Phase 1-4)
  return {
    card, toggleBtn, toggle, render,
    get visible() { return !card.hidden; },
    hide: () => set(false),
    show: () => set(true),
    /** A level start (or the sandbox entered): 'always' shows the legend; 'first' and 'never' leave it as it is. */
    showAuto() { if (pref() === 'always') set(true); },
    /** The legend's "Full guide" key (the guide panel of package settings). */
    onGuide(fn) { guideBtn.hidden = !fn; guideBtn.onclick = fn ? () => fn() : null; },
    get rowCount() { return count; },
  };
}

/** The phone note's words (PHASE5.md §6.7): what works here and what needs the computer. */
export const NARROW_TEXT = {
  title: 'Chicken Farm needs a keyboard',
  body: 'Chicken Farm is played on a desktop or laptop with a keyboard and a mouse. You can look at the farm here, but the jobs need a keyboard.',
  look: 'Look anyway',
};
const NARROW_SEEN = 'chicken-farm.narrow-look';

// Overlay for phones and touch screens. "Look anyway" lets them see the farm (remembered for the session).
export function createNarrowNotice(parent) {
  const query = typeof matchMedia === 'function' ? matchMedia('(max-width: 699px), (pointer: coarse)') : null;
  const titleId = uniqueId('narrow-title');
  const look = button({ class: 'btn btn--accent narrow-look' }, NARROW_TEXT.look);
  const el = h('div', { class: 'narrow', hidden: true },
    h('section', { class: 'card narrow-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('span', { html: ICONS.monitor, 'aria-hidden': 'true' }),
      h('h2', { id: titleId }, NARROW_TEXT.title),
      h('p', null, NARROW_TEXT.body),
      look));
  parent.appendChild(el);
  let dismissed = false;
  try { dismissed = window.sessionStorage?.getItem(NARROW_SEEN) === '1'; } catch { dismissed = false; }
  look.addEventListener('click', () => { dismissed = true; try { window.sessionStorage?.setItem(NARROW_SEEN, '1'); } catch { /* blocked */ } sync(); });
  function sync() {
    const show = !!(query && query.matches) && !dismissed;
    if (el.hidden === show) {
      el.hidden = !show;
      if (show) look.focus({ preventScroll: true });
    }
  }
  query?.addEventListener?.('change', sync);
  sync();
  return { get open() { return !el.hidden; }, el };
}

// Bottom-centre pill: "E  Read the Brooder heaters sign". Clicking it does the same as E.
// PHASE4.md §15.3: up to two more pills beside it, `alts` = [{ key: 'Shift+E' | 'G', text, act() }] ("Shift+E Pick up
// the dead bird" while a chick job is open; "G Set the bucket down" while he carries it); clicking one does its act().
// Phase 5: `useKey()` names the use key as bound now (keys.js), the alts carry their own labels.
export function createPrompt(parent, onUse, { useKey = () => 'E' } = {}) {
  const text = h('span');
  const useKbd = h('kbd', { class: 'kbd', 'aria-hidden': 'true' }, 'E');
  const pill = button({ class: 'prompt', hidden: true }, useKbd, text);
  const altPills = [0, 1].map(() => {
    const k = h('kbd', { class: 'kbd', 'aria-hidden': 'true' }), t = h('span');
    const b = button({ class: 'prompt prompt--alt', hidden: true }, k, t);
    return { b, k, t, act: null, sig: '' };
  });
  for (const a of altPills) a.b.addEventListener('click', () => a.act?.());
  const wrap = h('div', { class: 'hud-bc' }, pill, ...altPills.map((a) => a.b));
  parent.appendChild(wrap);
  let currentId = null, currentTarget = null, currentLabel = null, currentKey = null;
  pill.addEventListener('click', () => { if (currentId) onUse(currentId, currentTarget); });
  return {
    show(target, alts = []) {
      currentTarget = target;
      const id = target ? target.id : null;
      altPills.forEach((a, i) => {
        const x = alts[i] || null, sig = x ? `${x.key}|${x.text}` : '';
        a.act = x?.act || null;
        if (sig === a.sig) return;
        a.sig = sig; a.b.hidden = !x;
        if (x) { setText(a.k, x.key); setText(a.t, x.text); a.b.setAttribute('aria-label', `${x.text} (${x.key})`); }
      });
      let k = 'E';
      try { k = useKey() || 'E'; } catch { k = 'E'; }
      if (id === currentId && k === currentKey && (!target || target.label === currentLabel)) return;
      currentId = id; currentLabel = target ? target.label : null; currentKey = k;
      pill.hidden = !target;
      setText(useKbd, k);
      if (target) {
        const verb = target.verb || promptVerb(target.id);
        text.textContent = '';
        text.append(`${verb} `, h('b', null, target.label));
        pill.setAttribute('aria-label', `${verb} ${target.label} (${k})`);
      }
    },
    get id() { return currentId; },
    /** The keys of the extra pills shown now (harness checks). */
    get alts() { return altPills.filter((a) => !a.b.hidden).map((a) => a.k.textContent); },
    get useKey() { return useKbd.textContent; },
  };
}
