// The settings menu (PHASE5.md §4.2): Sound · Time · Graphics · Camera · Interface · Keys, every control applied at once
// and remembered (settings.js). Opened from the title card, the game menu, the gear key on the time bar and the speaker
// key (its Sound tab). Owner after the design round: package "settings". This is the design round's working STUB: one
// generic control per setting drawn from SETTINGS_SCHEMA (a slider, a check box or a list), the Keys tab read-only.
//
//   registerSettingsPanel({ register, openPanel, closePanel, ctx, menu, title }) -> { id: 'settings', open(tab?, via?) }
//   (via: { returnTo } from the game menu: closing the settings comes back to the menu, PHASE5.md §8.6)
//   (ctx.settings: settings.js; ctx.keys: keys.js)
import { h, button, uniqueId, injectStyle } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';

export const SETTINGS_ID = 'settings';
// the settings screen's own rules (PHASE5.md §8.6: each package styles its own screens; the frame is the template's)
const SETTINGS_CSS = `
.set-sec { display: grid; gap: 10px; padding: 12px 2px 4px; }
.set-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; font-size: 14px; color: var(--ink); }
.set-row--range { grid-template-columns: minmax(0, 1fr) 180px 40px; } .set-row--bool { grid-template-columns: auto 1fr; }
.set-row select { max-width: 280px; font: inherit; } .set-row input[type=range] { accent-color: var(--accent); }
.set-note { margin: 6px 0 0; color: var(--ink-faint); font-size: 13px; }
@media (max-width: 860px) { .set-row--range { grid-template-columns: minmax(0, 1fr) 120px 36px; } }
`;

/** One control for one schema item; onChange(value). Returns { el, sync(value) }. */
export function settingControl(path, it, value, onChange) {
  const id = uniqueId('set');
  if (it.type === 'range') {
    const input = h('input', { id, type: 'range', min: String(it.min), max: String(it.max), step: String(it.step ?? 0.01), value: String(value) });
    const out = h('output', { for: id }, String(Math.round(value * 100)));
    input.addEventListener('input', () => { onChange(+input.value); out.textContent = String(Math.round(+input.value * 100)); });
    input.addEventListener('change', () => input.blur());
    return { el: h('div', { class: 'set-row set-row--range', 'data-setting': path }, h('label', { for: id }, it.label), input, out), sync(v) { input.value = String(v); out.textContent = String(Math.round(v * 100)); } };
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

export function registerSettingsPanel({ register, openPanel, closePanel, ctx, menu = null, title = null }) {
  let wantTab = null, api = null;
  injectStyle('settings-style', SETTINGS_CSS);
  register(SETTINGS_ID, () => {
    const S = ctx.settings;
    const titleId = uniqueId('settings-title');
    const { el, closeBtn } = dialogShell('settings', titleId, () => closePanel());
    const groups = Object.entries(S.schema).filter(([, G]) => !G.hidden);
    const tabs = groups.map(([g, G]) => button({ class: 'ctrl-tab', role: 'tab', 'data-tab': g, 'aria-selected': 'false' }, G.label));
    const secs = groups.map(([g, G]) => {
      const sec = h('div', { class: 'set-sec', role: 'tabpanel', 'data-group': g, hidden: true });
      const ctls = [];
      for (const [k, it] of Object.entries(G.items)) {
        if (it.hidden) continue;
        const c = settingControl(`${g}.${k}`, it, S.get(`${g}.${k}`), (v) => S.set(`${g}.${k}`, v));
        ctls.push([`${g}.${k}`, c]); sec.append(c.el);
      }
      if (g === 'keys' && ctx.keys) {
        sec.append(h('dl', { class: 'help-list set-keys' }, ctx.keys.rows('level').flatMap((r) => [h('dt', null, r.keys.map((k) => h('kbd', { class: 'kbd' }, k))), h('dd', null, r.what)])),
          h('p', { class: 'set-note' }, 'Changing a key comes with the settings package (PHASE5.md §4.3).'));
      }
      const reset = button({ class: 'btn btn--quiet' }, 'Reset this tab');
      reset.addEventListener('click', () => { S.reset(g); for (const [p, c] of ctls) c.sync(S.get(p)); });
      sec.append(reset);
      return sec;
    });
    const show = (i) => { tabs.forEach((t, j) => t.setAttribute('aria-selected', String(i === j))); secs.forEach((s, j) => { s.hidden = i !== j; }); };
    tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
    show(0);
    el.append(h('div', { class: 'settings-case card' },
      h('header', { class: 'settings-head' }, h('span', { html: ICONS.gear, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Settings'),
        h('p', null, 'Every change works at once and is remembered in this browser.'))),
      h('div', { class: 'cyc-tabs', role: 'tablist' }, tabs), ...secs), closeBtn);
    return {
      el,
      onOpen() { const i = wantTab ? groups.findIndex(([g]) => g === wantTab) : -1; if (i >= 0) show(i); wantTab = null; },
    };
  }, { kind: 'paused' });
  api = { id: SETTINGS_ID, open(tab = null, via = null) { wantTab = tab; return openPanel(SETTINGS_ID, via || undefined); } };
  menu?.add?.({ id: 'settings', label: 'Settings', icon: 'gear', order: 40, onSelect: (via) => api.open(null, via) });
  title?.addAction?.({ id: 'settings', label: 'Settings', icon: 'gear', order: 20, onClick: () => api.open() });
  return api;
}
