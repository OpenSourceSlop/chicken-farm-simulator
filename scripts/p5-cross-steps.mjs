// Writes scripts/p5-cross.json: the integrator's cross-panel look and accessibility pass over the five Phase 5 screens
// together (PHASE5.md §6.4, §6.6, §11): the game menu, the settings (every tab), the saves (a question, the backup box,
// the restore box), the guide (every section) and the map (both views). For each: every focusable element shows its
// focus ring, every text is at or over its floor (11 px caps and source lines at 4.5 : 1, 12 px others), the panel is
// solid (the HUD does not show through), nothing scrolls sideways; across them: the close key in the same place and
// style, the headings in one face and size, the same case padding. The page helpers are scripts/p5-a11y-helpers.js.
// Run: node scripts/p5-cross-steps.mjs && node scripts/shoot.mjs --steps scripts/p5-cross.json --size 960x600 (and 1280x800)
import fs from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const helpers = fs.readFileSync(`${here}p5-a11y-helpers.js`, 'utf8').trim();
const S = [];
const ev = (js) => S.push({ eval: js });
const ex = (js, label) => S.push({ expect: js, label });
const press = (k) => S.push({ press: k });
const adv = (s) => S.push({ advance: s });
const shot = (n) => S.push({ shot: n });
const click = (sel) => S.push({ clickOn: sel });
const PANELS = ['menu', 'settings', 'saves', 'guide', 'map'];

/** Rings, floors, solid, no sideways scroll for the open panel (what: its name in the report). */
function screen(sel, what) {
  press('Tab'); press('Shift+Tab');   // a keyboard press first: the browser shows :focus-visible for the focus calls
  ev(`(() => { const r = __rings(${JSON.stringify(sel)}), f = __floors(${JSON.stringify(sel)}); return '${what}: ' + r.n + ' focusable' + (r.bad.length ? ', no ring: ' + r.bad.slice(0, 5).join(' | ') : '') + '; ' + f.n + ' texts' + (f.bad.length ? ', under a floor: ' + f.bad.slice(0, 5).join(' | ') : ''); })()`);
  ex(`(() => { const r = __rings(${JSON.stringify(sel)}); return r.n > 0 && !r.bad.length && '${what}: ' + r.n + ' focusable, each with its ring'; })()`, `${what}: the focus rings`);
  ex(`(() => { const f = __floors(${JSON.stringify(sel)}); return f.n > 0 && !f.bad.length && '${what}: ' + f.n + ' texts at or over their floor'; })()`, `${what}: the text floors`);
  ex(`(() => { const c = document.querySelector(${JSON.stringify(sel)} + ' > .card, ' + ${JSON.stringify(sel)} + ' > [class$="-case"]'); const a = c && getComputedStyle(c).backgroundColor.match(/[\\d.]+/g); return c && a && (a.length < 4 || +a[3] >= 0.99) && document.scrollingElement.scrollWidth <= innerWidth && '${what}: solid (' + getComputedStyle(c).backgroundColor + '), no sideways scroll'; })()`, `${what}: solid, nothing sideways`);
}
/** The open panel's frame: its close key's offset from the panel's top-right, the heading's face and size, the padding. */
const frame = (id) => ev(`(() => { const p = document.querySelector('#hud .${id}'), c = p.querySelector(':scope > .panel-close'), h = p.querySelector('h2'), k = p.querySelector(':scope > [class*="-case"]'); const pr = k.getBoundingClientRect(), cr = c.getBoundingClientRect(), hs = getComputedStyle(h), ks = getComputedStyle(k), cs = getComputedStyle(c); (window.__frames = window.__frames || {})['${id}'] = { top: Math.round(cr.top - pr.top), right: Math.round(pr.right - cr.right), h: Math.round(cr.height), face: hs.fontFamily.split(',')[0], size: hs.fontSize, pad: ks.padding, closeBg: cs.backgroundColor }; return '${id} frame: ' + JSON.stringify(__frames['${id}']); })()`);

S.push({ wait: 800 }, { clearStorage: true }, { reload: true }, { wait: 1500 });
ev(`__game.stop(), 'stopped: the cross-panel look and accessibility pass (PHASE5.md §11)'`);
ev(helpers);
ev(`__game.startRun({ seed: 1, at: 'level1' }), __game.level.debug.goto(2, 9, { auto: true }), __game.advance(0.3), 'a run at the brooding week, day 2'`);
// ---- the menu ----
press('Escape'); adv(0.2);
ex(`__game.ui.openPanelId === 'menu' && 'the menu'`, 'Esc: the menu');
screen('#hud .menu', 'the menu'); frame('menu'); shot('p5x-menu');
// ---- the settings, every tab ----
click('#hud [data-menu="settings"]'); adv(0.2);
frame('settings');
for (const tab of ['sound', 'time', 'graphics', 'camera', 'interface', 'keys']) {
  click(`#hud .settings [data-tab="${tab}"]`); adv(0.1);
  ex(`document.querySelector('#hud .settings [data-tab="${tab}"]').getAttribute('aria-selected') === 'true' && 'the ${tab} tab'`, `settings: the ${tab} tab shows`);
  screen('#hud .settings', `settings, ${tab}`);
  if (tab === 'sound' || tab === 'keys') shot(`p5x-settings-${tab}`);
}
press('Escape'); adv(0.2);
// ---- the saves: a slot saved, a question, the backup box, the restore box ----
click('#hud [data-menu="saves"]'); adv(0.2);
frame('saves');
click('#hud [data-slot="1"] [data-save-key="save"]'); S.push({ wait: 500 }); adv(0.1);
click('#hud [data-slot="1"] [data-save-key="delete"]'); adv(0.1);
ex(`!!document.querySelector('#hud [data-slot="1"] [data-answer="no"]') && 'a question open'`, 'saves: an in-panel question');
screen('#hud .saves', 'saves with a question'); shot('p5x-saves-question');
click('#hud [data-slot="1"] [data-answer="no"]'); adv(0.1);
click('#hud [data-slot="1"] [data-save-key="backup"]'); S.push({ wait: 800 }); adv(0.1);
screen('#hud .saves', 'saves with the backup box');
click('#hud [data-slot="2"] [data-save-key="restore"]'); adv(0.1);
screen('#hud .saves', 'saves with the restore box'); shot('p5x-saves-restore');
press('Escape'); adv(0.2);
// ---- the guide, every section ----
click('#hud [data-menu="guide"]'); adv(0.2);
frame('guide');
ev(`(() => { const ids = [...document.querySelectorAll('#hud .guide [data-guide]')].map((s) => s.dataset.guide); window.__gids = ids; return 'sections: ' + ids.join(', '); })()`);
for (let i = 0; i < 11; i++) {
  ev(`(() => { const id = __gids[${i}]; if (!id) return 'no section ${i}'; document.querySelector('#hud .guide [data-guide="' + id + '"]').scrollIntoView({ block: 'start' }); return 'scrolled to ' + id; })()`);
  ex(`(() => { const id = __gids[${i}]; if (!id) return 'none'; const f = __floors('#hud .guide [data-guide="' + id + '"]'); return f.bad.length ? (console.log('guide floors', f.bad), false) : 'guide, ' + id + ': ' + f.n + ' texts at or over their floor'; })()`, `the guide, section ${i + 1}: the text floors`);
}
screen('#hud .guide', 'the guide'); shot('p5x-guide');
press('Escape'); adv(0.2);
// ---- the map, both views ----
click('#hud [data-menu="map"]'); adv(0.2);
frame('map');
screen('#hud .map', 'the map, Farm view'); shot('p5x-map-farm');
click('#hud .map [data-map-view="house"]'); adv(0.2);
screen('#hud .map', 'the map, House view');
press('Escape'); adv(0.2); press('Escape'); adv(0.2);
// ---- across the five: one close key, one heading, one padding ----
ex(`(() => { const F = __frames, ids = ${JSON.stringify(PANELS)}; if (!ids.every((id) => F[id])) return false; const k = (f) => [f.top, f.right, f.h, f.closeBg].join(); const a = ids.map((id) => k(F[id])); return a.every((x) => x === a[0]) && 'the close key ' + F.menu.top + ' px from the top and ' + F.menu.right + ' px from the right of every panel, ' + F.menu.h + ' px high'; })()`, 'the five panels: the close key in the same place and style');
ex(`(() => { const F = __frames, ids = ${JSON.stringify(PANELS)}; const a = ids.map((id) => F[id].face + ' ' + F[id].size); return a.every((x) => x === a[0]) && 'every heading ' + a[0]; })()`, 'the five panels: the headings in one face and size');
ex(`(() => { const F = __frames, ids = ${JSON.stringify(PANELS)}; const a = ids.map((id) => F[id].pad); return a.every((x) => x === a[0]) && 'every case padded ' + a[0]; })()`, 'the five panels: the same case padding');

fs.writeFileSync(`${here}p5-cross.json`, `[\n${S.map((s) => `  ${JSON.stringify(s)}`).join(',\n')}\n]\n`);
console.log(`scripts/p5-cross.json: ${S.length} steps`);
