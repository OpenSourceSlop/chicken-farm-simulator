// Writes scripts/p5-look.json (PHASE5.md §6.4, package experience): the look pass's shots of every view, each with the
// HUD cards' overlap check and a list of clipped texts for the review (run it at 1280 x 800 and at 960 x 600).
// Run: node scripts/p5-look-steps.mjs && node scripts/shoot.mjs --steps scripts/p5-look.json --size 960x600
import fs from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const S = [];
const ev = (js) => S.push({ eval: js });
const ex = (js, label) => S.push({ expect: js, label });
const adv = (s) => S.push({ advance: s });
const shot = (n) => S.push({ shot: n });
// the checks of one view: no two HUD cards overlap; every text that clips (overflow hidden, wider than its box) listed
const look = (name) => {
  ev(`(() => { const c = __look(); return '${name}: ' + (c.clipped.length ? 'clipped: ' + c.clipped.slice(0, 6).join(' | ') : 'no clipped text') + (c.overlaps.length ? ' · overlaps: ' + c.overlaps.join(', ') : ''); })()`);
  ex(`(() => { const c = __look(); return !c.overlaps.length && '${name}: no HUD card over another'; })()`, `${name}: the HUD cards clear of each other`);
  shot(`p5-look-${name}`);
};
const helpers = `(() => {
  const R = (e) => { if (!e || e.hidden || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? r : null; };
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  window.__look = () => {
    const sel = { clock: '#hud .hud-tl .clock', gauges: '#hud .hud-tl .gauges', jobs: '#hud .hud-tr--level .ljobs', watch: '#hud .fw', timebar: '#hud .hud-bl .timebar', alarm: '#hud .alarm', prompt: '#hud .hud-bc .prompt:not([hidden])', intro: '#hud .intro-card' };
    const has = !!document.querySelector('#hud .panel:not([hidden])') || !!document.querySelector('#hud .title:not([hidden])');
    const c = {}; for (const [k, s] of Object.entries(sel)) { const r = has ? null : R(document.querySelector(s)); if (r) c[k] = r; }
    const k = Object.keys(c), overlaps = [];
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (hit(c[k[i]], c[k[j]])) overlaps.push(k[i] + '/' + k[j]);
    const clipped = [];
    for (const e of document.querySelectorAll('#hud *')) {
      if (!e.childNodes.length || e.offsetParent === null || !e.textContent.trim() || e.closest('.sr-only')) continue;
      const cs = getComputedStyle(e);
      if (cs.overflowX === 'visible' && cs.textOverflow !== 'ellipsis') continue;
      if (e.scrollWidth > e.clientWidth + 1 && cs.whiteSpace === 'nowrap') clipped.push((e.getAttribute('class') || e.tagName).slice(0, 24) + ' "' + e.textContent.trim().slice(0, 30) + '"');
    }
    return { overlaps, clipped };
  };
  return 'look helpers ready';
})()`;

S.push({ wait: 800 }, { clearStorage: true }, { reload: true }, { wait: 1500 });
ev(`__game.stop(), 'stopped: the look pass (PHASE5.md §6.4, p5-look)'`);
ev(helpers);
// the title card: a first run, then with a save
ev(`__game.level.toTitle(), 'the title, a first visit'`); adv(0.3); look('title-first');
ev(`__game.run.startRun({ seed: 1 }), __game.level.toTitle(), 'the title with a save'`); adv(0.3); look('title-save');
// the planning day at the office and the planning sheet
ev(`__game.run.startRun({ seed: 1 }), __game.setState({ farmer: { x: -34.1, z: 28.6, yaw: 0 } }), 'the planning day at the office'`); adv(0.5); look('plan-office');
ev(`__game.ui.openPanel('office-desk'), 'the record book on the desk'`); adv(0.3); look('plan-sheet');
ev(`__game.ui.closePanel({ all: true }), __game.level.debug.result(true), 'the plan result'`); adv(0.3); look('result-plan');
// the brooding week: the prep day in the house, day 0 with the chick table, day 3 by night
ev(`__game.ui.closePanel({ all: true }), __game.startLevel({ seed: 1 }), __game.setState({ farmer: { x: -14, z: 2.5, yaw: 0 } }), 'the prep day in the house'`); adv(0.5); look('prep-house');
ev(`__game.level.debug.goto(0, 10.2, { auto: true }), __game.setState({ farmer: { x: -11.8, z: 10.6, yaw: 0 } }), 'day 0 at the chick table'`); adv(0.5); look('day0-table');
ev(`__game.level.debug.goto(3, 22, { auto: true }), __game.setState({ farmer: { x: -14, z: 1, yaw: 0 } }), 'day 3 by night'`); adv(0.5); look('day3-night');
ev(`__game.level.debug.result(true), 'the brooding week result'`); adv(0.3); look('result-brooding');
// week 2 day 10 (the curtain), week 3 day 16 afternoon
ev(`__game.ui.closePanel({ all: true }), __game.run.startLevel('week2', { from: 'standard' }), __game.level.debug.goto(10, 10, { auto: true }), __game.setState({ farmer: { x: 0, z: 1, yaw: 0 } }), 'week 2 day 10 at the curtain'`); adv(0.5); look('week2-curtain');
ev(`__game.ui.closePanel({ all: true }), __game.run.startLevel('week3', { from: 'standard' }), __game.level.debug.goto(16, 15, { auto: true }), __game.setState({ farmer: { x: -6, z: 1, yaw: 0 } }), 'week 3 day 16 afternoon'`); adv(0.5); look('week3-afternoon');
ev(`__game.level.debug.result(true), 'the week 3 result'`); adv(0.3); look('result-week3');
// the hot season's heat wave on day 30
ev(`__game.ui.closePanel({ all: true }), __game.run.startRun({ seed: 1, at: 'level1', condition: 'hot' }), __game.run.startLevel('weeks45', { from: 'standard', condition: 'hot' }), __game.level.debug.goto(30, 14, { auto: true }), __game.setState({ farmer: { x: 6, z: 1, yaw: 0 } }), 'the hot season, day 30 14:00'`); adv(0.5); look('hot-day30');
// the rainy season: day 33's storm and the power cut
ev(`__game.ui.closePanel({ all: true }), __game.run.startRun({ seed: 1, at: 'level1', condition: 'rainy' }), __game.run.startLevel('weeks45', { from: 'standard', condition: 'rainy' }), __game.level.debug.goto(33, 15, { auto: true }), __game.setState({ farmer: { x: -30, z: 12, yaw: 0 } }), 'the rainy season, day 33'`); adv(0.5); look('rainy-storm');
ev(`__game.farm.debug.power(false), 'the power cut'`); adv(1.5); look('rainy-cut');
// the bad batch's grading and the water condition's tank
ev(`__game.ui.closePanel({ all: true }), __game.run.startRun({ seed: 1, at: 'level1', condition: 'badChicks' }), __game.level.debug.goto(0, 10.05, { auto: true }), __game.setState({ farmer: { x: -11.8, z: 10.6, yaw: 0 } }), __game.ui.openPanel('chick-table'), 'the bad batch at the chick table: ' + __game.ui.openPanelId`); adv(0.3); look('bad-grading');
ev(`__game.ui.closePanel({ all: true }), __game.run.startRun({ seed: 1, at: 'level1', condition: 'water' }), __game.run.startLevel('weeks45', { from: 'standard', condition: 'water' }), __game.level.debug.goto(26, 15, { auto: true }), __game.setState({ farmer: { x: -32.2, z: -9.8, yaw: 0 } }), __game.ui.openPanel('water-tank'), 'the water tank: ' + __game.ui.openPanelId`); adv(0.3); look('water-tank');
// the catching night, the result and the harvest
ev(`__game.ui.closePanel({ all: true }), __game.run.startRun({ seed: 1, at: 'level1' }), __game.run.startLevel('finish', { from: 'standard' }), __game.level.debug.goto(41, 22.5, { auto: true }), __game.setState({ farmer: { x: -12, z: 9, yaw: 0 } }), 'the catching night: ' + !!__game.farm.harvest?.started`); adv(0.5); look('catching');
ev(`__game.level.debug.result(true), 'the finish result'`); adv(0.3); look('result-finish');
// the clean-out: the wash bay, the clean house, a rest day, the result and the cycle summary
ev(`__game.ui.closePanel({ all: true }), __game.run.startLevel('cleanout', { from: 'standard' }), __game.level.debug.goto(44, 10, { auto: true }), __game.setState({ farmer: { x: -27, z: 12, yaw: 0 } }), 'the wash bay'`); adv(0.5); look('washbay');
ev(`__game.setState({ farmer: { x: -6, z: 1, yaw: 0 } }), 'the clean house'`); adv(0.5); look('clean-house');
ev(`__game.level.debug.goto(49, 10, { auto: true }), __game.setState({ farmer: { x: -14, z: 9, yaw: 0 } }), 'a rest day: ' + __game.level.hudHooks.dayText()`); adv(0.5); look('rest-day');
ev(`__game.level.debug.result(true), 'the clean-out result'`); adv(0.3); look('result-cleanout');
ev(`__game.ui.openPanel('summary'), 'the cycle summary: ' + __game.ui.openPanelId`); adv(0.3); look('summary');
// the menu, the settings (every tab), the saves, the map (both views), the guide
ev(`__game.ui.closePanel({ all: true }), __game.startLevel({ seed: 1 }), __game.ui.menu.open('hook'), 'the menu'`); adv(0.3); look('menu');
for (const tab of ['sound', 'time', 'graphics', 'camera', 'interface', 'keys']) { ev(`__game.ui.openSettings('${tab}', { returnTo: 'menu' }), 'settings: ${tab}'`); adv(0.2); look(`settings-${tab}`); }
ev(`__game.ui.closePanel({ all: true }), __game.ui.openSaves(), 'the saves'`); adv(0.2); look('saves');
ev(`__game.ui.closePanel({ all: true }), __game.ui.map.open(), __game.ui.map.view('farm'), 'the map, the farm'`); adv(0.2); look('map-farm');
ev(`__game.ui.map.view('house'), 'the map, the house'`); adv(0.2); look('map-house');
ev(`__game.ui.closePanel({ all: true }), __game.ui.openGuide(), 'the guide'`); adv(0.2); look('guide');
ev(`__game.ui.closePanel({ all: true }), 'done'`);
fs.writeFileSync(`${here}p5-look.json`, `${JSON.stringify(S, null, 1)}\n`);
console.log(`p5-look.json: ${S.length} steps`);
