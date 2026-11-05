// The farmer's night report (after Phase 5) by real input, on the helpers of p3-cycle-steps.mjs:
//   node scripts/night-steps.mjs                 -> scripts/req-night.json
//   node scripts/night-steps.mjs --dev <file>    the same steps to another file
// Day 0 of the brooding week from the ideal's 17:00 (goto auto). His own night first: the thermostat to 40 °C and one
// tunnel fan by real clicks at the controller (the HUD fan gauge and the controller's notes say so); Next job: the night
// check names the tunnel fan and the thermostat. Fix it at the controller: the tunnel fan off and, as the brief's case, a
// wide timer (2 fans, 120 s in every 300 s) sent by real clicks; Next job: the night check names the timer; Skip anyway: the
// skip stops on the cold with its cause before the chicks die in numbers; Next job again, Fix it: the timer back to the vent
// sign's setting and the thermostat to the row; Next job: no check, the night passes, the morning summary in the record.
import { W, adv, ev, exp, shot, click, clickUntil, until, E, esc, START, write, DOOR_IN } from './p3-cycle-steps.mjs';

const t = () => `' at ' + __t()`;
const PANEL = '#hud .panel:not([hidden])';
const open = (id) => `__game.ui.openPanelId === '${id}'`;
const onSec = `([...document.querySelectorAll('${PANEL} .ctrl-row')].find((r) => /On-seconds/.test(r.textContent))?.querySelector('output')?.textContent || '')`;
const timerFans = `([...document.querySelectorAll('${PANEL} .ctrl-row')].find((r) => /Fans on the timer/.test(r.textContent))?.querySelector('output')?.textContent || '')`;
const notes = (sel) => `[...document.querySelectorAll('${PANEL} ${sel}')].filter((e) => !e.hidden).map((e) => e.textContent).join(' | ')`;
const card = `(document.querySelector('${PANEL}.night') ? [...document.querySelectorAll('${PANEL} .nc-row, ${PANEL} .nc-off li')].map((e) => (e.querySelector('.fw-dot')?.className.replace('fw-dot is-', '') || '') + ' ' + e.textContent.replace(/\\s+/g, ' ').trim()).join(' || ') : '')`;
const nextJob = () => [{ clickOn: '.ljobs-next' }, adv(0.4)];
/** Next job until a panel opens (the night check) or the clock moved on (a skip ran); a job still open: the second press skips. */
const nextUntilCheck = () => [...nextJob(), { pressIf: 'j', if: `!__game.ui.openPanelId && !window.__skipped()` }, adv(0.4)];
const deadNow = `__game.farm.flock.deadByCause`;

export function nightSteps() {
  return [
    ev(`(__game.startLevel({ seed: 1 }), __game.level.debug.goto(0, 17, { auto: true }), window.__d0 = { ...__game.farm.flock.deadByCause }, window.__t0 = __game.env.day,
      window.__skipped = () => __game.env.day - window.__t0 > 1 / 24, 'day 0 evening, the ideal so far: ' + __game.farm.flock.alive + ' chicks' + ${t()})`),
    adv(0.5),
    // ---- his settings by real clicks: the thermostat all the way up and one tunnel fan ----
    W(-40, 36.9, 0.3), W(-38, 26, 0.6), W(-38, 14, 0.6), W(-14, 12, 0.6), ...DOOR_IN, W(-12, -4.6, 0.3),
    ...E('controller', 'E opens the climate controller'), click('Temperature'),
    clickUntil('Raise the brooder thermostat by 0.5 °C', `__game.env.heaterSetpoint >= 40`, 20), adv(0.3),
    exp(`(() => { const n = ${notes('.ctrl-note--sp')}; return __game.env.heaterSetpoint === 40 && /34 °C for day 0 · yours 40 °C: 6\\.0 °C over the sign’s row; once the air is right the house will overheat the chicks/.test(n) && 'thermostat 40 °C; the note: ' + n; })()`,
      'item 8: the thermostat shows the brooder sign’s row beside the setting and says it is 6 °C over'),
    click('Ventilation'), adv(0.2), click('One tunnel fan more'), adv(0.6),
    ev(`(window.__t0 = __game.env.day, 'clock mark' + ${t()})`),
    exp(`__game.env.fansManual === 1 && __game.env.ventTimer?.onSec === 8 && 'one tunnel fan by hand, the timer at the sign’s 1 fan 8 s / 300 s (his screenshot)'`, 'item 6: his settings: thermostat 40, the sign’s timer, one tunnel fan'),
    exp(`(() => { const n = ${notes('.ctrl-note--vent')}; return /1 tunnel fan running all the time: 36,000 m³\\/h along the floor/.test(n) && /keeps the tunnel fans off for young chicks/.test(n) && 'Ventilation tab: ' + n; })()`,
      'item 8: the Ventilation tab warns of the tunnel fan for young chicks with its airflow against their need'),
    exp(`(() => { const g = document.querySelector('#hud .hud-tl .gauges'); const f = [...g.querySelectorAll('.gauge')].find((e) => /Fans/.test(e.textContent)); const s = f?.textContent.replace(/\\s+/g, ' ').trim(); return s && /1 ?tunnel/.test(s) && /Timer 1 · 8 s \\/ 300 s/.test(s) && 'HUD: ' + s; })()`,
      'item 8: the HUD fan gauge separates the tunnel fan and the timer'),
    shot('night-01-controller-vent'),
    click('Temperature'), adv(1.2),
    exp(`(() => { const n = ${notes('.ctrl-note--temp')}; return /Brooders at \\d+ %/.test(n) && 'Temperature tab: ' + n + ' || floor: ' + ${notes('.ctrl-note--floor')}.slice(0, 80); })()`, 'item 3: the Temperature tab shows the brooders’ output in % (item 9: the floor note under it)'),
    shot('night-02-controller-temp'),
    ...esc(), W(-12, -1.5, 0.4), adv(0.3),
    shot('night-03-fan-gauge'),
    // ---- Next job: the night check (the farmer's case) ----
    ...nextUntilCheck(),
    exp(`${open('night-check')} && __game.env.day - window.__t0 < 1 / 24 && 'the night check, the clock held' + ${t()}`, 'item 1: Next job through the night shows the night check first'),
    exp(`(() => { const c = ${card}; return /^red /.test(c) && /1 tunnel fan runs all the time: 36,000 m³\\/h/.test(c) && /Tunnel fans row/.test(c) && /thermostat is at 40 °C, 6\\.0 °C over the row: once the air is right/.test(c) && !/check the thermostat at/.test(c) && 'card: ' + c; })()`,
      'item 1 / 7: it names the tunnel fan (its airflow against the need, where to switch it off) and the thermostat over the row'),
    exp(`(() => { const p = document.querySelector('${PANEL}.night'), b = p.querySelector('.nc-body'), r = (s) => p.querySelector(s).getBoundingClientRect(), f = r('[data-night=fix]'), k = r('[data-night=skip]');
      return p.scrollHeight <= p.clientHeight + 1 && b.scrollHeight <= b.clientHeight + 1 && f.bottom <= innerHeight && k.bottom <= innerHeight && f.top >= 0 && 'the card ' + p.clientHeight + ' px in a ' + innerWidth + ' x ' + innerHeight + ' window, no scroll; Skip anyway and Fix it at ' + Math.round(k.top) + '-' + Math.round(k.bottom) + ' px'; })()`,
      'check round 2: the card fits the window with both keys in view (no scroll)'),
    shot('night-04-night-check-tunnel'),
    click('Fix it at the controller'), adv(0.4),
    exp(`${open('controller')} && document.querySelector('${PANEL} .ctrl-tab[aria-selected="true"]')?.textContent === 'Ventilation' && 'Fix it: the controller on its Ventilation tab'`, 'Fix it opens the controller on the Ventilation tab'),
    click('One tunnel fan fewer'), adv(0.2),
    // ---- the brief's case: a wide timer (2 fans, 120 s in every 300 s), by real clicks ----
    clickUntil('One timer fan more', `${timerFans} === '2'`, 4),
    clickUntil('One second more', `${onSec} === '120 s'`, 130), adv(0.2),
    click('Send this setting to the timer'), adv(0.3),
    exp(`__game.env.fansManual === 0 && __game.env.ventTimer?.fans === 2 && __game.env.ventTimer?.onSec === 120 && 'tunnel fans 0; timer 2 fans, 120 s in every 300 s; thermostat ' + __game.env.heaterSetpoint`, 'the wide timer sent by real clicks'),
    ...esc(), adv(0.3),
    ...nextUntilCheck(),
    exp(`(() => { const c = ${card}; return ${open('night-check')} && /[Tt]he timer runs 2 fans, 120 s in every 300 s: 28,800 m³\\/h/.test(c) && /back to the vent sign’s setting/.test(c) && /would need \\d{3} % of their heat/.test(c) && 'card: ' + c; })()`,
      'item 1: the night check names the timer’s air against the chicks’ need and the brooders’ headroom'),
    shot('night-05-night-check-timer'),
    // ---- Skip anyway: the skip stops on the cold with its cause ----
    click('Skip anyway'), adv(0.6),
    exp(`(() => { const s = __game.level.skipStopped, c = document.querySelector('#hud .caption:not([hidden]) .caption-text')?.textContent || ''; const d = ${deadNow}; return s && s.trouble && /^Next job stopped at/.test(c) && /timer runs 2 fans, 120 s/.test(c) && /brooders are at full/.test(c) && __game.env.hour < 23.9 && __game.env.timeScale !== 360 * 4 && 'stopped (' + s.trouble + ')' + ${t()} + ', cold deaths so far ' + (d.cold - (window.__d0.cold || 0)) + '; caption: ' + c; })()`,
      'item 2: Skip anyway: the skip stops before the night is out, the cause in the caption, the clock back to 1x'),
    exp(`(() => { const d = ${deadNow}.cold - (window.__d0.cold || 0); const w = document.querySelector('#hud .fw-warn'); return d < 20 && w && !w.hidden && /timer/.test(w.textContent) && 'cold deaths ' + d + ' at the stop; the flock watch card: ' + w.textContent.slice(0, 90); })()`, 'item 2: the stop comes before mass deaths; the flock watch shows it'),
    shot('night-06-skip-stopped'),
    // ---- fixing it: back to the vent sign's timer and the row ----
    ...nextUntilCheck(),
    exp(`${open('night-check')} && 'the night check again (still off)' + ${t()}`, 'the next skip asks again while it is off'),
    click('Fix it at the controller'), adv(0.4),
    clickUntil('One timer fan fewer', `${timerFans} === '1'`, 4),
    clickUntil('One second less', `${onSec} === '8 s'`, 130), adv(0.2),
    click('Send this setting to the timer'), adv(0.3),
    click('Temperature'), clickUntil('Lower the brooder thermostat by 0.5 °C', `__game.env.heaterSetpoint <= 34`, 20), adv(0.3),
    exp(`__game.env.ventTimer?.fans === 1 && __game.env.ventTimer?.onSec === 8 && __game.env.heaterSetpoint === 34 && 'timer 1 fan 8 s / 300 s, thermostat 34 °C'`, 'set back to the vent sign and the brooder sign'),
    ...esc(), adv(0.3),
    ev(`(window.__d1 = { ...__game.farm.flock.deadByCause }, 'fixed' + ${t()})`),
    ...nextJob(), { pressIf: 'j', if: `!__game.ui.openPanelId && __game.env.hour > 12` }, adv(0.4),
    until(`__game.env.dayNumber === 1 && __game.env.hour >= 6`, 20, 0.5),
    exp(`(() => { const d = ${deadNow}, cold = d.cold - (window.__d1.cold || 0); return !(${open('night-check')}) && __game.env.dayNumber === 1 && cold <= 5 && 'no night check; the night passed to ' + __t() + ', cold deaths after the fix ' + cold; })()`,
      'fixed: no night check, the night passes with only the normal few deaths'),
    exp(`(() => { const n = (__game.records.draft(1).notes || []).find((x) => /^The night to day 1 06:00/.test(x)); return n && /died since 18:00/.test(n) && 'record row: ' + n; })()`, 'item 4: the morning summary of the night in the record book'),
    shot('night-07-morning'),
  ];
}

if (process.argv[1] && process.argv[1].endsWith('night-steps.mjs')) {
  const dev = process.argv.indexOf('--dev');
  write(dev >= 0 ? process.argv[dev + 1] : 'scripts/req-night.json', [...START, ...nightSteps()]);
}
