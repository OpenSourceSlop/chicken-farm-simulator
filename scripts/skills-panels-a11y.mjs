// Skills update, package "panels" (SKILLS.md §15.3 acceptance): every panel with a new key at 960 × 600 with live on and
// every branch forced to level 3 — the p5-a11y text floors and focus rings on the panel, and no sideways scroll.
// Writes scripts/skills-panels-a11y.json (run: node scripts/shoot.mjs --size 960x600 --steps scripts/skills-panels-a11y.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const helpers = fs.readFileSync(path.join(here, 'p5-a11y-helpers.js'), 'utf8').trim();
const BRANCHES = ['water', 'moisture', 'heating', 'lighting', 'ventilation', 'feed', 'growth', 'planning', 'brooding', 'biosecurity', 'comfort'];
const force = (lv) => `for (const b of ${JSON.stringify(BRANCHES)}) __game.skills.debug.force(b, ${lv});`;
const steps = [
  { wait: 800 },
  { clearStorage: true },
  { eval: "__game.stop(), window.__open = () => document.querySelector('#hud .panel:not([hidden])'), 'stopped: the new keys of the panels package at 960 × 600 (SKILLS.md §15.3)'" },
  { eval: helpers },
  { eval: `(() => { __game.config.SKILLS_UPDATE.live = true; __game.perks.allow(true); ${force(3)} __game.startLevel({ seed: 1 }); __game.level.debug.goto(0, 14, { auto: true }); return 'live on, every branch at 3, the brooding week at ' + __game.env.timeLabel + ' on day ' + __game.env.dayNumber; })()` },
];
const check = (what) => {
  steps.push({ expect: `(() => { const f = __floors('#hud .panel:not([hidden])'); return f.n > 0 && !f.bad.length && '${what}: ' + f.n + ' texts at or over their floor'; })() || ('${what}: ' + __floors('#hud .panel:not([hidden])').bad.slice(0, 5).join(' | ')) && false`, label: `the text floors: ${what}` });
  steps.push({ expect: `(() => { const r = __rings('#hud .panel:not([hidden])'); return r.n > 0 && !r.bad.length && '${what}: ' + r.n + ' focusable, each with its ring'; })() || ('${what}: ' + __rings('#hud .panel:not([hidden])').bad.slice(0, 5).join(' | ')) && false`, label: `the focus rings: ${what}` });
  steps.push({ expect: `(() => { const p = __open(), q = p.getBoundingClientRect(), keys = [...p.querySelectorAll('[data-payoff]:not([hidden]) button, .equip-btns button')].filter((b) => b.offsetParent !== null); const side = p.scrollWidth - p.clientWidth, page = document.documentElement.scrollWidth - innerWidth; const out = keys.filter((b) => { const r = b.getBoundingClientRect(); return r.left < q.left - 1 || r.right > q.right + 1; }); return side <= 1 && page <= 0 && !out.length && '${what}: no sideways scroll, ' + keys.length + ' keys inside the panel'; })()`, label: `fits 960 × 600: ${what}` });
};
const open = (id, what, before = [], after = []) => {
  steps.push({ eval: '__game.ui.closePanel(), "closed"' }, ...before, { eval: `__game.ui.openPanelId === '${id}' ? 'open already' : __game.ui.openPanel('${id}')` }, { advance: 1.2 }, ...after);
  check(what);
  steps.push({ shot: `skills-panels-${id}` });
};
// the brooding week: a chick in the hand for the vent sample (Brooding 2: Next chick)
open('chick-in-hand', 'chick in hand (Next chick)', [{ eval: "__game.events.emit('bird:pick', { index: 7, x: -12, z: 0, purpose: 'vent' }), 'a chick in the hand (EV.BIRD_PICK, vent)'" }]);
steps.push({ expect: "(() => { const b = [...__open().querySelectorAll('button')].find((x) => x.textContent.trim() === 'Next chick'); return b && b.offsetParent !== null && 'Next chick shows for the vent sample'; })()", label: 'Next chick on the chick in hand' });
// the cycle: every other panel on day 36 (the last week: Order to the catch shows too)
steps.push({ eval: `(() => { __game.ui.closePanel(); __game.cycleAt(36, 10); ${force(3)} for (const k of Object.keys(__game.farm.auto.on)) __game.farm.auto.on[k] = true; __game.farm.debug.fault('winch-stall', { line: 2 }); return 'day ' + __game.env.dayNumber + ' ' + __game.env.timeLabel + ', ' + __game.perks.list().filter((p) => p.has).length + ' payoffs, a stalled winch on line 3'; })()` });
open('controller', 'controller, Temperature');
steps.push({ clickText: 'Ventilation', in: '#hud .panel:not([hidden]) .ctrl-tabs' }, { advance: 0.8 });
check('controller, Ventilation');
steps.push({ shot: 'skills-panels-controller-vent' }, { clickText: 'Lights', in: '#hud .panel:not([hidden]) .ctrl-tabs' }, { advance: 0.4 });
check('controller, Lights');
open('fan-panel', 'fan panel');
open('water-supply', 'water supply', [], [{ clickText: 'Read the sight tubes', in: '#hud .panel:not([hidden])' }, { clickText: 'Trend', in: '#hud .panel:not([hidden])' }, { advance: 0.3 }]);
open('drinker-2', 'line 3 regulator (motor stalled)');
open('silo', 'silo gauge');
open('feeder-box', 'feeder box');
open('bird-scale', 'bird scale display');
open('pocket-phone', 'pocket phone');
open('weigh', 'weigh panel (Weigh the frame, Records)', [{ eval: "(() => { const ids = (__game.flock.catchGroup(-6, 2, 10) || []).map((b) => b.index); __game.events.emit('frame:set', { x: -6, z: 2, birds: ids }); return 'the frame set down with ' + ids.length + ' birds'; })()" }]);
steps.push({ expect: "(() => { const b = [...__open().querySelectorAll('button')].find((x) => x.textContent.trim() === 'Weigh the frame'); const t = __open().textContent; return b && b.offsetParent !== null && /Day 36 target [\\d,]+ g \\(records\\)/.test(t) && 'Weigh the frame and the Records line show'; })()", label: 'Weigh the frame and the Records line' });
open('dead-bin', 'dead bird bin');
steps.push({ eval: `(() => { __game.ui.closePanel(); ${force(null)} __game.config.SKILLS_UPDATE.live = false; __game.perks.allow(false); return 'back to live off'; })()` });
fs.writeFileSync(path.join(here, 'skills-panels-a11y.json'), `${JSON.stringify(steps, null, 1)}\n`);
console.log(`wrote scripts/skills-panels-a11y.json (${steps.length} steps)`);
