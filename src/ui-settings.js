// The settings menu (PHASE5.md §4.2): Sound · Time · Graphics · Camera · Interface · Keys, every control applied at once
// and remembered (settings.js). Opened from the title card, the game menu (with { returnTo: 'menu' }: Esc comes back to
// the menu), the gear key on the time bar (the menu, then Settings), the speaker key (its Sound tab) and
// ui.openSettings(tab, via). Owner: package "settings". Its looks are its own (#settings-style, .set-* classes).
//
//   registerSettingsPanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'settings', open(tab?, via?) }
//   frozen DOM hooks (PHASE5.md §8.10): [data-tab] on each tab (role tab), [data-group] on each tab's panel (role tabpanel),
//   [data-setting="<group>.<key>"] on a setting's row with its one native control, whose value is the STORED value (a
//   volume of 40 % is value "0.4"); an input / change event on it applies it. The Keys tab: ui-settings-keys.js.
import { h, button, uniqueId, injectStyle } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { createKeysTab } from './ui-settings-keys.js';
import { SETTINGS_CSS } from './ui-settings-style.js';
import { fillGuide } from './content-guide.js';

export const SETTINGS_ID = 'settings';
/** The line of plain words under each tab (what it changes; no farming fact). {key:…} tokens are the live keys. */
export const TAB_WORDS = {
  sound: 'How loud the farm is. The speaker key on the time bar, or {key:sound}, turns the sound off and on.',
  time: 'How the farm clock runs. At 1× a farm day takes about 16 minutes; Next job skips to the next job.',
  graphics: 'How the farm is drawn. Lower settings run faster on an older computer. Automatic steps down by itself when the picture is slow.',
  camera: 'How the view turns and zooms when you drag, turn the wheel or use the keys.',
  interface: 'The size of the HUD, the flock watch card, how long messages stay, sound captions and the controls legend.',
  keys: 'Every key of the game. Press Change, then the new key. A key that another action uses swaps with it.',
};
// how a slider shows its value
const SHOW = {
  percent: (v) => `${Math.round(v * 100)} %`,
  times: (v) => `${(+v).toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}×`,
};
const showOf = (path) => (path.startsWith('camera.') ? SHOW.times : SHOW.percent);

/** One control for one schema item; onChange(value). Returns { el, sync(value) }. The control's value is the stored value. */
export function settingControl(path, it, value, onChange) {
  const id = uniqueId('set');
  if (it.type === 'range') {
    const show = showOf(path);
    const input = h('input', { id, type: 'range', min: String(it.min), max: String(it.max), step: String(it.step ?? 0.01), value: String(value) });
    const out = h('output', { for: id, class: 'set-out' }, show(value));
    input.addEventListener('input', () => { onChange(+input.value); out.textContent = show(+input.value); });
    return { el: h('div', { class: 'set-row set-row--range', 'data-setting': path }, h('label', { for: id }, it.label), input, out), sync(v) { input.value = String(v); out.textContent = show(v); } };
  }
  if (it.type === 'bool') {
    const input = h('input', { id, type: 'checkbox' });
    input.checked = !!value;
    input.addEventListener('change', () => onChange(input.checked));
    return { el: h('div', { class: 'set-row set-row--bool', 'data-setting': path }, input, h('label', { for: id }, it.label)), sync(v) { input.checked = !!v; } };
  }
  if (it.type === 'choice') {
    const sel = h('select', { id }, it.options.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = String(value);
    sel.addEventListener('change', () => onChange(sel.value));
    return { el: h('div', { class: 'set-row set-row--choice', 'data-setting': path }, h('label', { for: id }, it.label), sel), sync(v) { sel.value = String(v); } };
  }
  return { el: h('div', { class: 'set-row' }), sync() {} };
}

// the frame-rate readout on the time bar (graphics.showFps): a small "NN fps"
function createFpsReadout(ctx) {
  let el = null, timer = null, retry = null;
  const tick = () => { if (el) el.textContent = `${Math.round(ctx.perf?.fps || 0)} fps`; };
  function set(on, tries = 0) {
    if (typeof document === 'undefined') return;
    clearTimeout(retry);
    if (on && !el) {
      const bar = document.querySelector('#hud .timebar');
      // the time bar is put on the page after the panels register (a stored "show" at boot waits for it)
      if (!bar) { if (tries < 20) retry = setTimeout(() => set(!!ctx.settings?.get('graphics.showFps'), tries + 1), 250); return; }
      el = h('span', { class: 'set-fps', role: 'status', 'aria-label': 'Frame rate' }, '');
      bar.append(el);
      tick(); timer = setInterval(tick, 500);
    } else if (!on && el) { clearInterval(timer); timer = null; el.remove(); el = null; }
  }
  return { set, get el() { return el; } };
}

export function registerSettingsPanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  let wantTab = null, api = null, built = null;
  injectStyle('settings-style', SETTINGS_CSS);
  const S = ctx.settings;
  const fps = createFpsReadout(ctx);
  try { fps.set(!!S?.get('graphics.showFps')); } catch { /* no settings */ }
  // a control drawn anywhere follows every change (the U key, the speaker, a preset, another tab)
  S?.subscribe?.((c) => {
    if (c.path === 'graphics.showFps') fps.set(!!c.value);
    built?.sync(c.path);
  });

  register(SETTINGS_ID, () => {
    const titleId = uniqueId('settings-title');
    const { el, closeBtn } = dialogShell('settings', titleId, () => closePanel());
    const groups = Object.entries(S.schema).filter(([, G]) => !G.hidden);
    const ctls = new Map();
    const words = [];
    let keysTab = null, govLine = null, govT = 0;
    const tabs = groups.map(([g, G], i) => button({ class: 'set-tab', role: 'tab', id: `${titleId}-tab-${g}`, 'data-tab': g, 'aria-selected': 'false', 'aria-controls': `${titleId}-sec-${g}`, tabindex: i ? '-1' : '0' }, G.label));
    const secs = groups.map(([g, G]) => {
      const line = h('p', { class: 'set-words' }, '');
      words.push([line, TAB_WORDS[g] || '']);
      const sec = h('div', { class: 'set-sec', role: 'tabpanel', id: `${titleId}-sec-${g}`, 'aria-labelledby': `${titleId}-tab-${g}`, 'data-group': g, hidden: true }, line);
      if (g === 'keys' && ctx.keys) {
        keysTab = createKeysTab({ ctx });
        sec.append(keysTab.el);
        return sec;
      }
      const list = h('div', { class: 'set-list' });
      for (const [k, it] of Object.entries(G.items)) {
        if (it.hidden) continue;
        const p = `${g}.${k}`;
        const c = settingControl(p, it, S.get(p), (v) => S.set(p, v));
        ctls.set(p, c); list.append(c.el);
      }
      sec.append(list);
      if (g === 'graphics') { govLine = h('p', { class: 'set-gov', role: 'status' }, ''); sec.append(govLine); }
      const reset = button({ class: 'btn btn--quiet set-reset' }, 'Reset this tab');
      reset.addEventListener('click', () => { S.reset(g); for (const [p, c] of ctls) if (p.startsWith(`${g}.`)) c.sync(S.get(p)); });
      sec.append(h('div', { class: 'set-foot' }, reset));
      return sec;
    });
    let at = 0;
    const show = (i, focus = false) => {
      at = i;
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      secs.forEach((s, j) => { s.hidden = i !== j; });
      if (groups[i][0] !== 'keys') keysTab?.cancel();
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
    function drawGov() {
      if (!govLine) return;
      const q = ctx.quality, st = q?.state?.();
      if (!st) { govLine.textContent = ''; return; }
      const auto = st.auto.ratio || st.auto.shadows || st.auto.flock;
      const steps = q.stepsWords?.() || '';
      const now = `Now: shadows ${st.shadows === 'high' ? 'soft' : st.shadows === 'low' ? 'simple' : 'off'}, sharpness ${st.ratioCap}, flock ${st.flockDetail === 'reduced' ? 'reduced' : 'full'}`;
      govLine.textContent = `${auto ? `Automatic: ${steps || 'nothing stepped down'}. ` : ''}${now}. About ${Math.round(st.fps || 0)} frames a second.`;
    }
    el.append(h('div', { class: 'settings-case card' },
      h('header', { class: 'settings-head' }, h('span', { html: ICONS.gear, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Settings'),
        h('p', null, 'Every change works at once and is remembered in this browser.'))),
      h('div', { class: 'set-tabs', role: 'tablist', 'aria-label': 'Settings' }, tabs), ...secs), closeBtn);
    show(0);
    built = { sync(p) { const c = ctls.get(p); if (c) c.sync(S.get(p)); if (p === 'keys.bindings') keysTab?.refresh(); } };
    return {
      el,
      onOpen() {
        for (const [line, t] of words) line.textContent = fillGuide(t, { keys: ctx.keys, settings: S });
        for (const [p, c] of ctls) c.sync(S.get(p));
        keysTab?.refresh();
        const i = wantTab ? groups.findIndex(([g]) => g === wantTab) : -1;
        if (i >= 0) show(i);
        wantTab = null;
        drawGov();
      },
      onClose() { keysTab?.cancel(); },
      dispose() { keysTab?.dispose(); },
      update(dt) { if ((govT -= dt) <= 0) { govT = 0.5; if (!secs[at]?.hidden && groups[at][0] === 'graphics') drawGov(); } },
      // the tabs move with the arrow keys (ui.js offers the open panel every key first: PHASE5.md §8.6)
      onKey(e) {
        const i = tabs.indexOf(e.target);
        if (i < 0 || e.ctrlKey || e.altKey || e.metaKey) return false;
        const n = tabs.length, to = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
        if (to == null) return false;
        e.preventDefault();
        show(to % n, true);
        return true;
      },
      get tab() { return groups[at][0]; },
    };
  }, { kind: 'paused' });
  api = { id: SETTINGS_ID, open(tab = null, via = null) { wantTab = tab; return openPanel(SETTINGS_ID, via || undefined); } };
  menu?.add?.({ id: 'settings', label: 'Settings', icon: 'gear', order: 40, onSelect: (via) => api.open(null, via) });
  title?.addAction?.({ id: 'settings', label: 'Settings', icon: 'gear', order: 20, onClick: () => api.open() });
  return api;
}
