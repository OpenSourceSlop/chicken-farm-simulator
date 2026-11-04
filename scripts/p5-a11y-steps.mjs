// Writes scripts/p5-a11y.json (PHASE5.md §6.6, §6.7, package experience): the keyboard, focus-ring, text-floor and phone
// checks. The page helpers (window.__floors, __rings, __fid) live in scripts/p5-a11y-helpers.js and are evaluated first.
// Run: node scripts/p5-a11y-steps.mjs && node scripts/shoot.mjs --steps scripts/p5-a11y.json --size 960x600
import fs from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const helpers = fs.readFileSync(`${here}p5-a11y-helpers.js`, 'utf8').trim();
const S = [];
const ev = (js) => S.push({ eval: js });
const ex = (js, label) => S.push({ expect: js, label });
const press = (k) => S.push({ press: k });
const adv = (s) => S.push({ advance: s });
const shot = (n) => S.push({ shot: n });
const floorsOk = (sel, what) => {
  ev(`(() => { const f = __floors(${JSON.stringify(sel)}); return '${what}: ' + f.n + ' texts' + (f.bad.length ? ', under a floor: ' + f.bad.slice(0, 6).join(' | ') : ', none under a floor'); })()`);
  ex(`(() => { const f = __floors(${JSON.stringify(sel)}); return f.n > 0 && !f.bad.length && '${what}: ' + f.n + ' texts at or over their floor (11 px caps and sources at 4.5 : 1, 12 px others)'; })()`, `the two text floors: ${what}`);
};
const floorsReport = (sel, what) => ev(`(() => { const f = __floors(${JSON.stringify(sel)}); return '${what} (another package\\'s screen, for the integrator): ' + f.n + ' texts, ' + f.bad.length + ' under a floor' + (f.bad.length ? ': ' + f.bad.slice(0, 5).join(' | ') : ''); })()`);
const ringsOk = (sel, what) => {
  press('Tab'); press('Shift+Tab');   // a keyboard press first: the browser then shows :focus-visible for the focus calls
  ev(`(() => { const r = __rings(${JSON.stringify(sel)}); return '${what}: ' + r.n + ' focusable' + (r.bad.length ? ', no ring: ' + r.bad.slice(0, 6).join(' | ') : ''); })()`);
  ex(`(() => { const r = __rings(${JSON.stringify(sel)}); return r.n > 0 && !r.bad.length && '${what}: ' + r.n + ' focusable elements, each with its focus ring'; })()`, `the focus ring: ${what}`);
};

S.push({ wait: 800 }, { clearStorage: true }, { reload: true }, { wait: 1500 });
ev(`__game.stop(), 'stopped: accessibility (PHASE5.md §6.6, §6.7, p5-a11y)'`);
ev(helpers);
// ---- the title: tab order, rings, floors ----
ev(`__game.level.toTitle(), 'the title card, a first visit (no save)'`);
adv(0.3);
ex(`/Start a new flock/.test(__fid()) && 'the focus on ' + __fid()`, 'the title: the focus starts on Start a new flock');
S.push({ eval: `window.__order = [__fid()], 'order: ' + __order` });
for (let i = 0; i < 5; i++) { press('Tab'); ev(`(__order.push(__fid()), __order.join(' → '))`); }
ex(`(() => { const o = __order; return /brooding week/.test(o[1]) && /sandbox/i.test(o[2]) && /Skill tree/.test(o[3]) && o.slice(4).some((x) => x === 'saves' || x === 'settings') && 'Start → ' + o.slice(1).join(' → '); })()`, "the title's tab order: Start, Start at the brooding week, the quiet keys");
ex(`(() => { const t = document.querySelector('#hud .title'), runFirst = t.querySelector('.runcard button, .runcard select, .runcard [tabindex]'), keys = [...t.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent); return !!runFirst && keys.indexOf(runFirst) > keys.findIndex((b) => b.dataset.titleAction === 'guide') && 'the run card after the quiet keys'; })()`, 'the run card comes after the quiet keys');
ringsOk('#hud .title', 'the title card');
floorsOk('#hud .title', 'the title card');
shot('p5-a11y-title');
// ---- a level: the HUD, the menu by Tab and Enter ----
ev(`__game.startLevel({ seed: 1 }), 'the prep day'`);
adv(0.5);
floorsOk('#hud .hud-tl, #hud .hud-tr--level, #hud .hud-bl, #hud .fw, #hud .hud-bc', 'the HUD');
press('Escape'); adv(0.2);
ex(`__game.ui.openPanelId === 'menu' && __fid() === 'resume' && 'the menu, the focus on ' + __fid()`, 'Esc opens the menu, the focus on its first entry');
ringsOk('#hud .menu', 'the menu');
floorsOk('#hud .menu', 'the menu');
press('Enter'); adv(0.2);
ex(`__game.ui.openPanelId === null && 'Enter on Back to the farm closes it'`, 'the menu: Back to the farm by Enter');
for (const [id, panel] of [['map', 'map'], ['saves', 'saves'], ['settings', 'settings'], ['guide', 'guide']]) {
  adv(0.7); press('Escape'); adv(0.2);
  ev(`(() => { let n = 0; while (__fid() !== '${id}' && n++ < 8) { const bs = [...document.querySelectorAll('#hud .menu [data-menu]')]; bs[(bs.indexOf(document.activeElement) + 1) % bs.length].focus(); } return 'at ' + __fid(); })()`);
  press('Tab'); press('Shift+Tab');
  ex(`__fid() === '${id}' && 'Tab reaches ${id}'`, `the menu: Tab reaches ${id}`);
  press('Enter'); adv(0.3);
  ex(`__game.ui.openPanelId === '${panel}' && __game.ui.parentPanels.join() === 'menu' && '${panel} open over the menu'`, `the menu: Enter opens ${panel}`);
  if (panel === 'map') { ringsOk('#hud .map', 'the map'); floorsOk('#hud .map', 'the map'); }
  if (panel === 'settings') { ringsOk('#hud .settings', 'the settings'); floorsReport('#hud .settings', 'settings'); }
  if (panel === 'saves') { ringsOk('#hud .saves', 'the saves'); floorsReport('#hud .saves', 'saves'); }
  press('Escape'); adv(0.2);
  ex(`__game.ui.openPanelId === 'menu' && __fid() === '${id}' && 'Esc: back to the menu, the focus on ${id}'`, `Esc in ${panel}: the menu again, the focus where it was`);
  press('Escape'); adv(0.2);
}
// ---- panels by the keyboard: a sign, a machine panel, the records book, the skill tree, a result ----
const hold = (k, sec) => S.push({ holdKey: k, for: sec });
// the prep day's first job with the keyboard alone: walk in through the gate dip (W), the gate sign (D, then E)
ev(`__game.setState({ farmer: { x: -40, z: 40.5, yaw: 0 } }), document.activeElement?.blur?.(), 'at the gate, the keyboard only from here'`);
hold('w', 1.6); hold('d', 1.1);
ev(`'he stands at ' + __game.player.position.x.toFixed(1) + ', ' + __game.player.position.z.toFixed(1) + '; the prompt: ' + __game.ui.promptId`);
ex(`(() => { const j = __game.level.jobs.byKey('prep-gate@-1'); return j && (j.status === 'done' || j.progress > 0) && 'walked in through the gate dip: ' + j.status + ' ' + (j.progress * 100).toFixed(0) + ' %'; })()`, 'the gate dip by the walk keys');
ev(`window.__before = document.activeElement, 'focus before: ' + __fid()`);
press('e'); adv(0.2);
ex(`__game.ui.openPanelId === 'sign-gate' && 'E reads the gate sign'`, 'E opens the gate sign');
floorsOk('#hud .panel:not([hidden])', 'the gate sign');
press('Escape'); adv(0.2);
ex(`__game.ui.openPanelId === null && (document.activeElement === __before || document.activeElement === __game.renderer.domElement) && 'Esc closed it, the focus back on ' + __fid()`, 'Esc closes the sign, the focus back where it was');
adv(0.8);
// a machine panel: the climate controller (Tab to a key, Enter uses it)
ev(`__game.setState({ farmer: { x: -12, z: -4.4, yaw: 0 } }), 'at the climate controller'`);
adv(0.3); press('e'); adv(0.3);
ex(`__game.ui.openPanelId === 'controller' && 'the controller'`, 'E opens the climate controller');
ringsOk('#hud .panel:not([hidden])', 'the climate controller');
floorsOk('#hud .panel:not([hidden])', 'the climate controller');
ev(`window.__sp = __game.env.heaterSetpoint, (() => { const b = [...document.querySelectorAll('#hud .panel:not([hidden]) button')].find((x) => /raise|up|\\+/i.test(x.getAttribute('aria-label') || x.textContent)); b?.focus(); return 'focus on ' + __fid(); })()`);
press('Enter'); adv(0.2);
ev(`'the setpoint ' + __sp + ' -> ' + __game.env.heaterSetpoint`);
press('Escape'); adv(0.8);
// the records book at the office desk
ev(`__game.setState({ farmer: { x: -34.1, z: 27.4, yaw: 0 } }), 'at the office desk'`);
adv(0.3); press('e'); adv(0.3);
ex(`__game.ui.openPanelId === 'office-desk' && 'the records book'`, 'E opens the records book');
floorsOk('#hud .panel:not([hidden])', 'the records book');
press('Tab'); press('Enter'); adv(0.2);
ex(`__game.ui.openPanelId === 'office-desk' && 'used by Tab and Enter (' + __fid() + ')'`, 'the records book by Tab and Enter');
press('Escape'); adv(0.8);
press('k'); adv(0.3);
ex(`__game.ui.openPanelId === 'skilltree' && 'K: the skill tree'`, 'K opens the skill tree');
floorsOk('#hud .panel:not([hidden])', 'the skill tree');
press('Tab'); adv(0.1);
press('Escape'); adv(0.3);
ex(`__game.ui.openPanelId === null && 'Esc closed the skill tree'`, 'Esc closes the skill tree');
adv(0.8);
// a result: the keyboard reaches its keys; the skill tree over it comes back to it, the focus on its key
ev(`__game.level.debug.result(true), 'a result'`);
adv(0.3);
floorsOk('#hud .panel:not([hidden])', 'the result');
ev(`(() => { const b = [...document.querySelectorAll('#hud .result-btns button')].find((x) => /Skill tree/.test(x.textContent)); b.focus(); return 'focus on ' + __fid(); })()`);
press('Enter'); adv(0.3);
ex(`__game.ui.openPanelId === 'skilltree' && __game.ui.parentPanels.join() === 'result' && 'the skill tree over the result'`, "Enter on the result's Skill tree key");
press('Escape'); adv(0.3);
ex(`__game.ui.openPanelId === 'result' && /Skill tree/.test(__fid()) && 'Esc: the result again, the focus on Skill tree'`, 'Esc: the result again with the focus where it was');
ex(`!!document.querySelector('#hud .result-btns [data-result-key="saves"]') && 'the result has its Save or load key'`, "the result's Save or load key");
// ---- the clock and the map by their keys, then Tab to the time bar's Next job key ----
ev(`__game.startLevel({ seed: 1 }), document.activeElement?.blur?.(), window.__nl = __game.level.nextLabel(), 'a new prep day: ' + __nl`);
adv(0.5);
press('j'); adv(0.1);
ex(`__game.level.nextLabel() !== __nl && /Skip to/.test(__game.level.nextLabel()) && 'J pressed Next job: ' + __game.level.nextLabel()`, 'J: Next job');
press('p'); adv(0.1);
ex(`__game.level.hudHooks.userPaused && 'P paused the clock'`, 'P: pause');
press('4'); adv(0.1);
ex(`__game.level.fast && !__game.level.hudHooks.userPaused && '4: the clock at 4×'`, '4: 4×');
press('1'); adv(0.1);
ex(`!__game.level.fast && '1: the clock at 1×'`, '1: 1×');
press('o'); adv(0.2);
ex(`__game.ui.openPanelId === 'map' && 'O: the farm map'`, 'O: the map');
press('Escape'); adv(0.8);
ev(`document.querySelector('#hud .timebar .seg button:last-child').focus(), 'focus on the 4× key'`);
press('Tab');
ex(`/Next job|Skip to/.test(document.activeElement?.getAttribute('aria-label') || '') && "Tab: the time bar's Next job key"`, "Tab reaches the time bar's Next job key");
ev(`window.__t0 = __game.env.day, 'Enter on it twice (point, then skip)'`);
press('Enter'); press('Enter'); adv(0.2);
ex(`__game.env.day > __t0 && 'Enter pressed it: the clock skipped ' + ((__game.env.day - __t0) * 24).toFixed(2) + ' farm hours'`, 'Enter presses the Next job key');
// ---- phones: the note, no sideways scroll, 44 px keys, the title, menu and settings in one column ----
for (const [w, h] of [[390, 844], [412, 915]]) {
  S.push({ viewport: [w, h] });
  ev(`sessionStorage.removeItem('chicken-farm.narrow-look'), 'a phone ${w} x ${h}'`);
  S.push({ reload: true }, { wait: 1500 });
  ev(`__game.stop(), 'reloaded'`);
  adv(0.3);
  ex(`(() => { const n = document.querySelector('#hud .narrow'); return !!n && !n.hidden && /keyboard and a mouse/.test(n.textContent) && /look at the farm here/.test(n.textContent) && n.textContent.trim().slice(0, 80); })()`, `${w} x ${h}: the phone note shows, its words say what works`);
  ex(`document.scrollingElement.scrollWidth <= innerWidth && 'no sideways scroll: ' + document.scrollingElement.scrollWidth + ' <= ' + innerWidth`, `${w} x ${h}: nothing scrolls sideways`);
  ex(`(() => { const bs = [...document.querySelectorAll('#hud .narrow button')]; return bs.length && bs.every((b) => b.getBoundingClientRect().height >= 44) && 'its keys ' + bs.map((b) => Math.round(b.getBoundingClientRect().height)).join(', ') + ' px high'; })()`, `${w} x ${h}: the note's keys at least 44 px high`);
  shot(`p5-a11y-phone-${w}`);
  S.push({ clickText: 'Look anyway', in: '#hud .narrow' });
  ev(`__game.level.toTitle(), 'the title at phone width'`);
  adv(0.3);
  ex(`(() => { const c = document.querySelector('#hud .title-card').getBoundingClientRect(); return c.width <= innerWidth && document.scrollingElement.scrollWidth <= innerWidth && 'the title card ' + Math.round(c.width) + ' px wide, no sideways scroll'; })()`, `${w} x ${h}: the title card fits (one column)`);
  ev(`__game.startLevel({ seed: 1 }), __game.ui.menu.open('hook'), 'the menu at phone width'`);
  adv(0.3);
  ex(`(() => { const m = document.querySelector('#hud .menu').getBoundingClientRect(); return m.width <= innerWidth - 16 && m.left >= 0 && document.scrollingElement.scrollWidth <= innerWidth && 'the menu ' + Math.round(m.width) + ' px wide'; })()`, `${w} x ${h}: the menu fits`);
  ev(`__game.ui.closePanel({ all: true }), __game.ui.openSettings('time'), 'the settings at phone width'`);
  adv(0.3);
  ex(`(() => { const m = document.querySelector('#hud .settings').getBoundingClientRect(); return m.width <= innerWidth - 16 && m.left >= 0 && document.scrollingElement.scrollWidth <= innerWidth && 'the settings ' + Math.round(m.width) + ' px wide'; })()`, `${w} x ${h}: the settings fit`);
  ev(`__game.ui.closePanel({ all: true }), 'closed'`);
}
S.push({ viewport: [960, 600] });
fs.writeFileSync(`${here}p5-a11y.json`, `${JSON.stringify(S, null, 1)}\n`);
console.log(`p5-a11y.json: ${S.length} steps`);
