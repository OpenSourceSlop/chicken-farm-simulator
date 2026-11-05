// Builds the integrator's Phase 5 play-through (PHASE5.md §9.3) as a harness steps file, on the helpers of
// scripts/p3-cycle-steps.mjs (the same routes, the play timer):
//   node scripts/p5-play-steps.mjs      -> scripts/p5-play.json
// A first visit: the title's first-run line, Start a new flock, the introduction's three cards by real clicks, the
// planning day by real input (the gate sign by E, the farm map on O to the office, Save in slot 1 from the menu, the
// planning sheet), goto(auto) to the brooding week's result, Save in slot 2 from the result's Save or load key, Back up
// slot 1 (the whole run, in parts, the select fallback), storage cleared and the page reloaded, Restore into slot 1 by
// pasting the parts in reverse order, Continue (the newest: slot 1's planning day), Settings → Keys (Q → B, W → I and
// back), B squeezes on day 0, HUD Large and the watch folded, reduced motion, the map's House view with the flock's dots,
// the hot season's day 30 at 13:00 with sound captions on and the sound off, the rainy day 33's power cut with
// [Alarm in the house]. The harness prints any console or page error.
import { W, adv, ev, exp, shot, press, click, E, esc, job, SETUP, write, officeToHouse, houseOut, outToOffice, outToHouse, signRecord, continueOn, autoTo, passed, next } from './p3-cycle-steps.mjs';

const near = (x, z) => `Math.hypot(__game.player.position.x - (${x}), __game.player.position.z - (${z}))`;
const panel = () => `__game.ui.openPanelId`;
const typeIn = (name, text) => [{ clickOn: `#hud .panel:not([hidden]) input[name=${name}]` }, ...[...text].map((c) => press(c))];
const clickOn = (sel) => ({ clickOn: sel });
const wait = (ms) => ({ wait: ms });
/** A select or check box of the settings panel by its frozen hook (PHASE5.md §8.10), set the way a player's change does. */
const setChoice = (path, value) => ev(`(() => { const s = document.querySelector('#hud .settings [data-setting="${path}"] select'); s.value = '${value}'; s.dispatchEvent(new Event('change', { bubbles: true })); return '${path} -> ' + JSON.stringify(__game.settings.get('${path}')); })()`);

// ---------------- the first visit: title, the introduction ----------------
function firstVisit() {
  return [
    wait(800), { clearStorage: true }, { reload: true }, wait(1200), SETUP,
    ev(`__game.ui.intro.allow(true), __game.level.toTitle(), 'a first visit: the title card (under automation the game boots in the sandbox), the introduction allowed'`), adv(0.3),
    exp(`(() => { const l = document.querySelector('#hud .title-first'); return !!l && !l.hidden && l.offsetParent !== null && /New here\\? Start a new flock/.test(l.textContent) && l.textContent; })()`, 'a first visit: the first-run line under the title keys'),
    exp(`!document.querySelector('#hud .title [data-title-continue]:not([hidden])') && [...document.querySelectorAll('#hud .title .btn')].every((b) => !/^Continue/.test(b.textContent) || b.hidden || b.offsetParent === null) && 'no Continue (no save)'`, 'no save: no Continue'),
    shot('p5p-00-title'),
    click('Start a new flock', 0, '#hud'), adv(1.2),
    exp(`(() => { const s = __game.ui.intro.state(); return __game.level.def.id === 'plan' && s.active && s.card === 'jobs' && 'planning day ' + __t() + ': the jobs card on the job card'; })()`, 'Start a new flock: the planning day, the jobs card'),
    shot('p5p-01-intro-jobs'),
    clickOn('#hud .intro-card .intro-next'), adv(0.3),
    exp(`__game.ui.intro.state().card === 'signs' && 'the signs card: ' + __game.ui.intro.state().text.slice(0, 60)`, 'Next (a real click): the signs card'),
    clickOn('#hud .intro-card .intro-next'), adv(0.3),
    exp(`(() => { const s = __game.ui.intro.state(); return s.card === 'time' && /O opens the farm map/.test(s.text) && /Next job \\(J\\)/.test(s.text) && s.text; })()`, 'Next: the time card with the live keys'),
    clickOn('#hud .intro-card .intro-next'), adv(0.3),
    exp(`!__game.ui.intro.state().active && __game.ui.panelKind == null && 'Got it: no card, the clock runs'`, 'Got it: the introduction ends'),
  ];
}

// ---------------- the planning day by real input, with the map and the menu ----------------
function planningDay() {
  return [
    ev(`__timer('planning day')`),
    W(-40, 36.9, 0.3), job('pl-gate-dip@-2', 'the gate foot dip, walked'),
    W(-36.0, 35.0, 0.4), ...E('sign-gate', 'E reads the farm rules at the gate'), adv(0.3),
    exp(`(() => { const p = document.querySelector('#hud .panel:not([hidden])'); const src = p && [...p.querySelectorAll('.src')]; return src && src.length > 0 && src.every((s) => s.textContent.trim()) && src.length + ' facts, each with its source line'; })()`, 'the gate sign: every fact shows its source'),
    shot('p5p-02-gate-sign'), ...esc(), job('pl-gate-read@-2'),
    W(-44.6, 33.6, 0.4), press('e'), adv(1.5), job('pl-clothes@-2', 'farm clothes and boots at the guard hut (E)'),
    // the farm map on O: the office picked in the side list, he walks there
    press('o'), adv(0.2),
    exp(`${panel()} === 'map' && __game.ui.panelKind === 'paused' && __game.ui.map.state().view === 'farm' && 'the farm map, the clock stopped'`, 'O opens the farm map'),
    ev(`(() => { const el = document.querySelector('#hud .map [data-place-shape="office"]'); el?.dispatchEvent(new PointerEvent('pointerenter')); return 'hover: ' + __game.ui.map.state().tag; })()`),
    exp(`/Office/.test(__game.ui.map.state().tag) && /s walking/.test(__game.ui.map.state().tag) && __game.ui.map.state().tag`, 'hovering the office names it with its walk'),
    shot('p5p-03-map'),
    ev(`window.__office = __game.ui.map.places().find((p) => p.id === 'office').stand, 'office stand ' + JSON.stringify(__office)`),
    clickOn('#hud .map [data-place="office"]'), adv(0.1),
    exp(`${panel()} === null && 'the map closed; he walks'`, 'a click on the office in the side list closes the map'),
    { advanceUntil: `${near('__office.x', '__office.z')} < 1.5`, max: 60, step: 0.5 },
    exp(`${near('__office.x', '__office.z')} < 1.5 && 'at the office: ' + ${near('__office.x', '__office.z')}.toFixed(2) + ' m from its stand, ' + __t()`, 'he walks to the office by the route finder'),
    // Save in slot 1 from the menu; Esc in the saves panel shows the menu again
    press('Escape'), adv(0.2),
    exp(`${panel()} === 'menu' && 'the game menu'`, 'Esc opens the game menu'),
    clickOn('#hud [data-menu="saves"]'), adv(0.2),
    exp(`${panel()} === 'saves' && __game.ui.parentPanels.includes('menu') && 'the saves panel over the menu'`, 'Save or load from the menu'),
    clickOn('#hud [data-slot="1"] [data-save-key="save"]'), wait(500), adv(0.1),
    exp(`(() => { const r = __game.saves.list()[1]; if (!r.meta) return false; sessionStorage.setItem('__p5s1', JSON.stringify({ name: r.meta.name, day: r.meta.day, hour: r.meta.hour })); return /^Normal season · Level 1 – Plan the farm · Planning day, \\d\\d:\\d\\d$/.test(r.meta.name) && 'slot 1: ' + r.meta.name; })()`, 'Save here in slot 1: named by condition, level, day and time'),
    shot('p5p-04-saves'),
    press('Escape'), adv(0.2),
    exp(`${panel()} === 'menu' && 'the menu again'`, 'Esc in the saves panel: the menu again'),
    press('Escape'), adv(0.2),
    exp(`${panel()} === null && __game.level.mode === 'level' && 'the farm'`, 'a second Esc: the farm'),
    // the rest of the planning day as Phase 3's play-through plays it
    W(-38, 26, 0.6), W(-30.8, 26.8, 0.4), ...E('sign-plan', 'E reads the production planning sign'), adv(0.3), ...esc(),
    W(-34.1, 28.0, 0.4), ...E('office-desk', 'E opens the records book at the office desk'),
    click('Letters'), adv(0.1), click('The company’s contract'), adv(0.2), job('pl-letter@-2', 'the contract read in the Letters tab'),
    click('Plan'), adv(0.1), click('Open the planning sheet'), adv(0.25),
    click('Take the tape measure'), adv(0.2), exp(`__game.props.carrying === 'tape' && 'carrying the tape'`, 'the tape measure in hand'),
    ...officeToHouse(), job('pl-house-dip@-2', 'boots dipped at the house door'),
    W(-23.3, 0.6, 0.35), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    W(23.3, 0.6, 0.35, 80), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    W(0.6, -5.3, 0.35), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    W(0.6, 5.3, 0.35), { pressIf: 'e', if: `__game.interact.nearest(__game.player)?.id === 'tape'` }, adv(0.9),
    job('pl-measure@-2', 'house 1 measured by walking'),
    ...houseOut(), ...outToOffice(), ...E('office-desk', 'back at the office desk'), click('Plan'), adv(0.1), click('Open the planning sheet'), adv(0.25),
    click('Put the tape back'), adv(0.1),
    ...typeIn('chicksPerWeek', '3750'), ...typeIn('houses', '6'), ...typeIn('birdsPerHouse', '6000'), ...typeIn('cycleDays', '67'), ...typeIn('lossesPct', '4'), ...typeIn('saleKg', '2.8'),
    adv(0.3), click('Send the plan'), adv(0.3),
    exp(`(() => { const p = __game.farm.plan; return p && p.sentAt != null && p.outcome?.pass && Math.round(p.sums.salePerWeek) + ' birds a week, sent at ' + __t(); })()`, 'the plan sent'),
    ...esc(), ...next(),
    ...E('office-desk', 'the reply on the desk'), click('Letters'), adv(0.1), click('The company’s reply'), adv(0.2), job('pl-reply@-2', 'the company’s reply read'),
    ...esc(), ...next(), ...signRecord(),
    exp(`(() => { const r = __game.level.result; return __game.level.mode === 'result' && r?.levelId === 'plan' && r.pass && 'plan passed at ' + __t(); })()`, 'signing the plan page ends Level 1: passed'),
    ev(`__timerEnd('planning day')`),
    exp(`__timed['planning day'].min < 6 && 'the planning day by real input with the map and the menu: ' + __timed['planning day'].min.toFixed(2) + ' min of play (Phase 4 ceiling 6)'`, 'a real-input day under 6 minutes of play, with the menu and the map used'),
    shot('p5p-05-plan-result'),
  ];
}

// ---------------- the brooding week's result, slot 2 from its Save or load key ----------------
function broodingResult() {
  return [
    ...continueOn('Continue to the brooding week', 'level1', -1),
    ...autoTo(7, 21), passed('level1', ', ratio: r.ratio'),
    clickOn('#hud [data-result-key="saves"]'), adv(0.2),
    exp(`${panel()} === 'saves' && __game.ui.parentPanels.includes('result') && 'the saves panel over the result'`, 'the result\'s Save or load key'),
    clickOn('#hud [data-slot="2"] [data-save-key="save"]'), wait(500), adv(0.1),
    exp(`(() => { const r = __game.saves.list()[2]; return r.meta && /Level 2 – The brooding week · Day 7, \\d\\d:\\d\\d · level ended$/.test(r.meta.name) && 'slot 2: ' + r.meta.name; })()`, 'Save here in slot 2 from the result'),
    press('Escape'), adv(0.2),
    exp(`${panel()} === 'result' && [...document.querySelectorAll('.result-btns .btn')].some((b) => /Week 2/.test(b.textContent)) && 'the result again, with its keys'`, 'closing the saves panel shows the result again'),
  ];
}

// ---------------- Back up slot 1 in parts (the select fallback), clear the storage, restore by pasting in reverse ----------------
function backupRestore() {
  return [
    // the artifact viewer's frame may refuse clipboard writes: the Copy key then shows the part selected in a box
    ev(`(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('not allowed here')) } }); } catch (e) { return 'clipboard: ' + e.message; } return 'the clipboard refuses writes (as in a sandboxed frame)'; })()`),
    clickOn('#hud [data-result-key="saves"]'), adv(0.2),
    clickOn('#hud [data-slot="1"] [data-save-key="backup"]'), wait(900), adv(0.1),
    exp(`(() => { const b = document.querySelector('#hud [data-slot="1"] .saves-box'); const k = b ? b.querySelectorAll('[data-copy-part]').length : 0; window.__nParts = k; return k >= 1 && b.querySelector('[data-backup-kind="whole"]')?.getAttribute('aria-pressed') === 'true' && 'the whole run: ' + b.querySelector('.saves-status').textContent + ' (' + k + ' Copy keys)'; })()`, 'Back up slot 1: the whole run, its length in words and one Copy key per part'),
    clickOn('#hud [data-slot="1"] [data-copy-part="1"]'), wait(500),
    exp(`(() => { const ta = document.querySelector('#hud [data-slot="1"] .saves-fallback:not([hidden]) textarea'); return ta && document.activeElement === ta && ta.selectionEnd - ta.selectionStart === ta.value.length && /CF5\\.(gz64|json64)\\./.test(ta.value) && 'part 1 shown selected in the box (' + ta.value.length + ' characters)'; })()`, 'Copy part 1, refused: the text shows selected with the copy words'),
    shot('p5p-06-backup'),
    // every part copied in turn from the box the Copy key shows (the player's Ctrl+C), kept for after the reload
    ev(`(async () => { const parts = []; const keys = [...document.querySelectorAll('#hud [data-slot="1"] [data-copy-part]')]; for (const k of keys) { k.click(); await new Promise((r) => setTimeout(r, 350)); const ta = document.querySelector('#hud [data-slot="1"] .saves-fallback:not([hidden]) textarea'); parts.push(ta ? ta.value : ''); } sessionStorage.setItem('__p5bk', parts.slice().reverse().join('\\n\\n')); return parts.length + ' parts copied from the box, ' + parts.map((p) => p.length).join(' / ') + ' characters'; })()`),
    exp(`(sessionStorage.getItem('__p5bk') || '').split('CF5.').length - 1 === __nParts && __nParts + ' markers kept'`, 'every part copied'),
    // slot 2 (the brooding week's result: more level starts) comes in parts: each copied from its box, kept for the end
    clickOn('#hud [data-slot="2"] [data-save-key="backup"]'), wait(900), adv(0.1),
    exp(`(() => { const b = document.querySelector('#hud [data-slot="2"] .saves-box'); const k = b ? b.querySelectorAll('[data-copy-part]').length : 0; window.__nParts2 = k; sessionStorage.setItem('__p5s2', __game.saves.list()[2].meta.name); return k >= 2 && /parts of up to 9,000 characters/.test(b.querySelector('.saves-status').textContent) && 'slot 2, the whole run: ' + b.querySelector('.saves-status').textContent; })()`, 'Back up slot 2: the whole run in parts'),
    shot('p5p-06b-backup-parts'),
    ev(`(async () => { const parts = []; for (const k of [...document.querySelectorAll('#hud [data-slot="2"] [data-copy-part]')]) { k.click(); await new Promise((r) => setTimeout(r, 350)); const ta = document.querySelector('#hud [data-slot="2"] .saves-fallback:not([hidden]) textarea'); parts.push(ta ? ta.value : ''); } sessionStorage.setItem('__p5bk2', parts.slice().reverse().join('\\n\\n')); return parts.length + ' parts copied from the box: ' + parts.map((p) => p.length).join(' / ') + ' characters, ' + parts.map((p) => (p.match(/part (\\d+) of (\\d+)/) || [])[0]).join(', '); })()`),
    exp(`(sessionStorage.getItem('__p5bk2') || '').split('CF5.').length - 1 === __nParts2 && (sessionStorage.getItem('__p5bk2').match(/p\\d+of\\d+\\./g) || []).length === __nParts2 && __nParts2 + ' part markers kept'`, 'every part of slot 2 copied'),
    { clearStorage: true }, { reload: true }, wait(1200), SETUP,
    ev(`__game.level.toTitle(), __game.advance(0.2), 'title, storage cleared: ' + JSON.stringify(__game.saves.list().map((r) => r.empty))`),
    clickOn('#hud [data-title-action="saves"]'), adv(0.2),
    exp(`${panel()} === 'saves' && __game.saves.list().every((r) => r.empty) && 'every row empty'`, 'Load a saved farm on the title card: every row empty'),
    clickOn('#hud [data-slot="1"] [data-save-key="restore"]'), adv(0.1),
    ev(`(() => { const ta = document.querySelector('#hud [data-restore-box]'); ta.focus(); ta.value = sessionStorage.getItem('__p5bk'); ta.dispatchEvent(new Event('input', { bubbles: true })); return 'pasted ' + ta.value.length + ' characters (the parts in reverse order)'; })()`),
    wait(900),
    exp(`(() => { const s = document.querySelector('#hud [data-slot="1"] .saves-box .saves-status').textContent, n = JSON.parse(sessionStorage.getItem('__p5s1')).name; return s.includes(n) && s; })()`, 'the parts read in reverse order: the box names the farm'),
    shot('p5p-07-restore'),
    clickOn('#hud [data-slot="1"] [data-restore-go]'), wait(900), adv(0.1),
    exp(`__game.saves.list()[1].meta?.name === JSON.parse(sessionStorage.getItem('__p5s1')).name && 'restored: ' + __game.saves.list()[1].meta.name`, 'Restore into slot 1: its name back'),
    ev(`__game.ui.closePanel({ all: true }), __game.advance(0.2), 'title: ' + (document.querySelector('#hud .title')?.textContent.match(/Continue[^\\n]{0,80}/)?.[0] || '')`),
    exp(`/Continue/.test(document.querySelector('#hud .title').textContent) && /Slot 1/.test(document.querySelector('#hud .title').textContent) && 'the Continue line names slot 1'`, 'the title\'s Continue names slot 1'),
    click('Continue', 0, '.title'), wait(900), adv(0.2),
    exp(`(() => { const s = JSON.parse(sessionStorage.getItem('__p5s1')); return __game.level.mode === 'level' && __game.level.def.id === 'plan' && __game.env.dayNumber === s.day && Math.abs(__game.env.hour - s.hour) < 0.05 && 'Continue: ' + __t() + ' (slot 1 ' + s.name + ')'; })()`, 'Continue: the newest save, slot 1\'s planning day'),
  ];
}

// ---------------- Settings: keys, the HUD, the watch, reduced motion ----------------
function settingsPart() {
  return [
    adv(0.8), press('Escape'), adv(0.2), clickOn('#hud [data-menu="settings"]'), adv(0.2),
    exp(`${panel()} === 'settings' && __game.ui.parentPanels.includes('menu') && 'Settings over the menu'`, 'the menu\'s Settings'),
    clickOn('#hud .settings [data-tab="keys"]'), adv(0.1),
    clickOn('#hud .settings [data-key-action="squeeze"] [data-key-change]'), adv(0.1), press('b'), adv(0.1),
    exp(`__game.keys.label('squeeze') === 'B' && /B/.test(document.querySelector('#hud .settings [data-key-action="squeeze"]').textContent) && ${panel()} === 'settings' && 'Squeeze on B, its row shows it'`, 'Keys: Change on Squeeze, B'),
    ev(`window.__p0 = [__game.player.position.x, __game.player.position.z], 'he stands at ' + __p0.map((v) => v.toFixed(2))`),
    clickOn('#hud .settings [data-key-action="forward"] [data-key-change]'), adv(0.1), press('i'), adv(0.3),
    exp(`__game.keys.label('forward') === 'I' && 'Walk forward on I'`, 'Keys: Walk forward on I'),
    clickOn('#hud .settings [data-key-action="forward"] [data-key-change]'), adv(0.1), press('w'), adv(0.5),
    exp(`__game.keys.label('forward') === 'W' && Math.hypot(__game.player.position.x - __p0[0], __game.player.position.z - __p0[1]) < 0.01 && ${panel()} === 'settings' && 'Walk forward back on W: the capture took W (he did not walk)'`, 'Keys: W back on Walk forward, taken by the capture'),
    shot('p5p-08-keys'),
    clickOn('#hud .settings [data-tab="interface"]'), adv(0.1),
    setChoice('interface.hudScale', '1.15'), setChoice('interface.watch', 'folded'), setChoice('interface.reducedMotion', 'on'), adv(0.3),
    exp(`+__game.settings.get('interface.hudScale') === 1.15 && Math.abs(__game.ui.hudScale - 1.15) < 0.01 && document.documentElement.classList.contains('reduce-motion') && 'HUD 1.15, reduced motion on'`, 'Interface: HUD Large, reduced motion on, applied at once'),
    press('Escape'), adv(0.2), press('Escape'), adv(0.2),
    exp(`${panel()} === null && 'the farm'`, 'Esc, Esc: the farm'),
    // Q does nothing now; B squeezes on day 0 (after a goto)
    ...autoTo(-2, 21), passed('plan'), ...continueOn('Continue to the brooding week', 'level1', -1), ...autoTo(0, 10),
    ev(`__game.setState({ farmer: { x: -14, z: 9, yaw: 0 } }), 'at the house door ' + __t()`), ...outToHouse(), W(-20, -1.95, 0.5),
    ev(`__game.ui.clearCaptions(), 'captions cleared'`), press('q'), adv(0.2),
    exp(`!/Litter here/.test(__game.ui.captionNow?.text || '') && 'Q: nothing (' + (__game.ui.captionNow?.text || 'no caption') + ')'`, 'Q does nothing after the rebind'),
    press('b'), adv(0.2),
    exp(`/Litter here/.test(__game.ui.captionNow?.text || '') && 'B: ' + __game.ui.captionNow.text`, 'B squeezes a handful of litter'),
    exp(`(() => { const c = document.querySelector('#hud .fw'); return c && !c.hidden && c.classList.contains('is-compact') && 'the flock watch folded: the dots only'; })()`, 'the flock watch folded'),
    shot('p5p-09-hud-large'),
    // the map's House view with the flock's dots
    press('o'), adv(0.2), clickOn('#hud .map [data-map-view="house"]'), adv(0.2),
    exp(`(() => { const s = __game.ui.map.state(); return s.view === 'house' && s.birds.n >= 1700 && s.birds.inside === s.birds.n && 'House view: ' + s.birds.n + ' dots, all inside the house'; })()`, 'the map\'s House view with the flock\'s dots'),
    shot('p5p-10-map-house'),
    press('Escape'), adv(0.2),
  ];
}

// ---------------- the harder flocks with captions and the sound off ----------------
function conditions() {
  return [
    adv(0.8), press('Escape'), adv(0.2), clickOn('#hud [data-menu="settings"]'), adv(0.2), clickOn('#hud .settings [data-tab="interface"]'), adv(0.1),
    clickOn('#hud .settings [data-setting="interface.soundCaptions"] input'), adv(0.1),
    clickOn('#hud .settings [data-tab="sound"]'), adv(0.1), clickOn('#hud .settings [data-setting="sound.muted"] input'), adv(0.1),
    exp(`__game.settings.get('interface.soundCaptions') === true && __game.settings.get('sound.muted') === true && __game.audio.settings.muted === true && 'captions on, the sound off'`, 'Settings: sound captions on, the sound off (real clicks)'),
    press('Escape'), adv(0.2), press('Escape'), adv(0.2),
    ev(`__game.startLevel({ level: 'weeks45', condition: 'hot' }), 'a standard start: ' + __t() + ', ' + __game.farm.condition`), adv(0.3),
    ...autoTo(30, 13),
    exp(`__game.farm.condition === 'hot' && __game.env.dayNumber === 30 && Math.abs(__game.env.hour - 13) < 0.1 && 'the hot season, ' + __t() + ', outside ' + __game.env.outsideTemp.toFixed(1) + ' °C, house ' + __game.env.houseTemp.toFixed(1) + ' °C'`, 'the hot season, day 30 at 13:00 (a standard start)'),
    ev(`__game.setState({ farmer: { x: -14, z: 9, yaw: 0 } }), 'outside the door'`), ...outToHouse(), adv(1),
    ev(`'captions raised: ' + JSON.stringify((__game.audio.captions?.() || []).slice(-4).map((c) => c.text)) + ', showing ' + (__game.ui.captionNow?.text || 'none')`),
    shot('p5p-11-hot-noon'),
    ev(`__game.startLevel({ level: 'weeks45', condition: 'rainy' }), 'a standard start: ' + __t() + ', ' + __game.farm.condition`), adv(0.3),
    ...autoTo(33, 15.0),
    ev(`__game.ui.clearCaptions(), 'rainy day 33 ' + __t() + ', power ' + __game.farm.power.on`),
    { advanceUntil: `__game.farm.power.on === false`, max: 30, step: 0.25 },
    exp(`__game.farm.power.on === false && 'the cut at ' + __t()`, 'the rainy day 33: the power cut'),
    adv(0.5),
    exp(`(__game.ui.captionNow?.text === '[Alarm in the house]' || (__game.audio.captions?.() || []).some((c) => c.key === 'alarm')) && 'the caption: ' + (__game.ui.captionNow?.text || '') + ' (sound muted: ' + __game.audio.settings.muted + ')'`, 'the power cut with the sound off: [Alarm in the house]'),
    exp(`__game.ui.captionNow?.text === '[Alarm in the house]' && 'shown on the HUD'`, 'the alarm caption shows on the HUD within a second'),
    shot('p5p-12-power-cut'),
  ];
}

// ---------------- the backup in parts, pasted in reverse order into slot 3 ----------------
function restoreParts() {
  return [
    ev(`__game.ui.openSaves(), __game.ui.openPanelId`), adv(0.2),
    clickOn('#hud [data-slot="3"] [data-save-key="restore"]'), adv(0.1),
    ev(`(() => { const ta = document.querySelector('#hud [data-restore-box]'); ta.focus(); ta.value = sessionStorage.getItem('__p5bk2'); ta.dispatchEvent(new Event('input', { bubbles: true })); return 'pasted ' + ta.value.length + ' characters: the parts of slot 2 in reverse order'; })()`),
    wait(900),
    exp(`(() => { const s = document.querySelector('#hud [data-slot="3"] .saves-box .saves-status').textContent; return s.includes(sessionStorage.getItem('__p5s2')) && s; })()`, 'the parts in reverse order read at once'),
    clickOn('#hud [data-slot="3"] [data-restore-go]'), wait(900), adv(0.1),
    exp(`__game.saves.list()[3].meta?.name === sessionStorage.getItem('__p5s2') && 'slot 3: ' + __game.saves.list()[3].meta.name`, 'Restore in parts into slot 3: slot 2\'s farm'),
    shot('p5p-13-restored-parts'),
    press('Escape'), adv(0.2),
    exp(`${panel()} === null && __game.level.mode === 'level' && 'the farm again'`, 'Esc closes the saves panel'),
  ];
}

const steps = [...firstVisit(), ...planningDay(), ...broodingResult(), ...backupRestore(), ...settingsPart(), ...conditions(), ...restoreParts()];
write('scripts/p5-play.json', steps);
