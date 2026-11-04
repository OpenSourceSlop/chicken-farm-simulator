// The generator panel (the rainy season, PHASE4.md §4.2, §10.3, §12.3). Package "panels". Generator house west of the
// house: the generator's controller (fuel, hours of fuel left, run hours, the engine), the fuel gauge, the engine's
// start key (a 2-minute bar at the panel clock, then gen.start, which answers at once), Stop, the weekly test run (a
// 10-minute bar, then gen.test), Fill the fuel tank (gen.fuel), the transfer switch "House on: mains / generator" as one
// lit switch pair (gen.switch { to }), the mains' state lamp, and the generator plate. Every reading is the farm's state
// (farm.power, farm.generator, PHASE4.md §10.4); the words say what is, never how well it was done.
import { GENERATOR } from './config.js';
import { EV } from './events.js';
import { h, button, setText, fmt0, fmt1 } from './ui-dom.js';
import { lcdCell } from './ui-controller.js';
import { equipShell, machineRow } from './ui-equipment.js';
import { whenText, hoursText } from './ui-cycle-kit.js';
import { ICONS4, timedKey, dial, lamp } from './ui-cond-kit.js';

const flag = (t) => h('span', { class: 'lcd-flag' }, t);
const QUARTERS = { 0: 'E', 37.5: '¼', 75: '½', 112.5: '¾', 150: 'F' };

export function buildGenerator(api) {
  const { L } = api;
  const { env, farm } = L;
  const shell = equipShell({ cls: 'equip--cond equip--generator', icon: ICONS4.bolt, title: 'Generator', sub: 'Generator house, west of the house · engine, fuel tank, transfer switch',
    plates: ['generator'], signLinks: ['sign-power'], onClose: L.close });
  const G = () => farm.generator || { running: false, fuelL: 0, hours: 0, hoursLeft: 0 };
  const P = () => farm.power || { mains: true, on: true, source: 'mains' };
  let isOpen = false, lever = null, darkSince = null, onSince = null;
  // the house's power as the farm reports it (EV.POWER): when it went dark, when it came back
  const off = L.events?.on?.(EV.POWER, (p) => { if (p.on) { darkSince = null; onSince = env.day; } else { darkSince = env.day; onSince = null; } });
  if (!P().on) darkSince = env.day;

  // ---- the generator's controller: an LCD and the fuel gauge ----
  const cFuel = lcdCell('Fuel', 'L'), cLeft = lcdCell('Fuel left', 'h'), cHours = lcdCell('Run hours', 'h'), cEngine = lcdCell('Engine', '');
  const fMains = flag('MAINS'), fGen = flag('GEN'), fHouse = flag('HOUSE'), fDark = flag('NO POWER'), fTest = h('span', { class: 'lcd-read' }), clock = h('span', { class: 'lcd-clock' });
  const lcd = h('div', { class: 'lcd cyc-lcd cond-lcd cond-lcd--2', role: 'group', 'aria-label': 'Generator controller display' },
    h('div', { class: 'lcd-grid' }, cFuel.el, cLeft.el, cHours.el, cEngine.el), h('div', { class: 'lcd-foot' }, fMains, fGen, fHouse, fDark, fTest, clock));
  const fuelDial = h('div'), fuelSub = h('small');
  const top = h('div', { class: 'cond-top' }, h('div', { class: 'cond-gauge' }, fuelDial, fuelSub), lcd);

  // ---- the engine: start (a 2-minute bar, then gen.start), stop ----
  let testKey = null; // one engine job at a time: the start and the test run lock each other
  const startKey = timedKey(L, shell, {
    label: 'Start the generator', busyLabel: 'Starting: about 2 farm minutes', minutes: GENERATOR.startMin, cls: 'btn btn--machine btn--go',
    takes: `the generator takes about ${GENERATOR.startMin} farm minutes from the start key to full power (generator plate)`,
    disabled: () => !!G().running || testKey?.running,
    isOpen: () => isOpen,
    act: () => L.act('gen.start', {}) || {},
    done: (r) => (r.running ? `Generator running at full power, ${env.timeLabel}: ${fmt1(r.hoursLeft ?? G().hoursLeft)} h of fuel at full load.`
      : `The engine did not start, ${env.timeLabel}: ${fmt0(r.fuelL ?? G().fuelL)} L of fuel in the tank.`),
    notice: (r) => (r.running ? `Generator running at full power (${env.timeLabel}).${P().on && P().source === 'generator' ? ' The house is on the generator.' : ' The transfer switch is on the mains.'}` : `Generator: the engine did not start (${env.timeLabel}).`),
  });
  const stopBtn = button({ class: 'btn btn--machine' }, 'Stop the generator');
  stopBtn.addEventListener('click', () => { if (!G().running) return; L.act('gen.stop', {}); refresh(); });
  const engine = machineRow('Engine', '', startKey.el, stopBtn);
  engine.led.classList.add('led--run');
  engine.el.append(h('div', { class: 'cond-row-bar' }, startKey.bar.el));

  // ---- the transfer switch: one lit switch pair, House on: mains | generator ----
  const leverKey = (to, text) => {
    const b = button({ class: 'key key--wide key--act', 'aria-pressed': 'false', 'aria-label': `House on the ${to}` }, text);
    b.addEventListener('click', () => { lever = to; L.act('gen.switch', { to }); refresh(); });
    return b;
  };
  const toMains = leverKey('mains', 'Mains'), toGen = leverKey('generator', 'Generator');
  // the mains' state lamp on the switch box (the grid's supply), beside what feeds the house
  const mainsLamp = lamp('run'), swSub = h('span', { class: 'cond-sub-line' });
  const sw = machineRow('Transfer switch', h('small', null, h('span', { class: 'cond-lamps' }, mainsLamp.el), swSub),
    h('span', { class: 'cond-switch-k' }, 'House on'), h('span', { class: 'cond-switch', role: 'group', 'aria-label': 'Transfer switch: house on' }, toMains, toGen));
  sw.led.classList.add('led--pad');

  // ---- the weekly test run (a 10-minute bar, then gen.test) and the fuel ----
  testKey = timedKey(L, shell, {
    label: `Test run (${GENERATOR.testMin} minutes)`, busyLabel: `Test running: ${GENERATOR.testMin} farm minutes`, minutes: GENERATOR.testMin,
    takes: `the test run takes ${GENERATOR.testMin} farm minutes (generator plate): the engine runs, the house stays on its switch position`,
    disabled: () => !!G().running || startKey.running,
    isOpen: () => isOpen,
    act: () => L.act('gen.test', {}) || {},
    done: (r) => (r.ok ? `Test run done ${env.timeLabel}: the engine started and ran ${fmt0(r.minutes ?? GENERATOR.testMin)} minutes; ${fmt0(r.fuelL)} L of fuel left.`
      : `Test run ${env.timeLabel}: the engine did not start (${fmt0(r.fuelL)} L of fuel).`),
  });
  const test = machineRow('Weekly test run', '', testKey.el);
  test.led.classList.add('led--run');
  test.el.append(h('div', { class: 'cond-row-bar' }, testKey.bar.el));
  const fillBtn = button({ class: 'btn btn--machine' }, 'Fill the fuel tank');
  fillBtn.addEventListener('click', () => { const r = L.act('gen.fuel', {}) || {}; shell.timeNote.done(`Fuel tank filled from the drum, ${env.timeLabel}: ${fmt0(r.fuelL ?? G().fuelL)} L.`); refresh(); });
  const fuel = machineRow('Fuel tank', `${fmt0(GENERATOR.fuelL)} L when full`, fillBtn);

  const state = h('p', { class: 'cond-state', role: 'status' });
  shell.main.append(top, state, shell.timeNote.el, h('div', { class: 'ctrl-rows' }, engine.el, sw.el, test.el, fuel.el));

  function leverNow() {
    const s = P().source;
    if (s === 'generator' || s === 'mains') return s;
    return lever || 'mains';
  }
  function refresh() {
    const g = G(), p = P(), lv = leverNow();
    const fuelL = Math.max(0, g.fuelL ?? 0), left = Number.isFinite(g.hoursLeft) ? g.hoursLeft : fuelL / GENERATOR.litresPerH;
    setText(cFuel.value, fmt0(fuelL)); setText(cLeft.value, fmt1(left)); setText(cHours.value, fmt1(g.hours ?? 0));
    setText(cEngine.value, startKey.running ? 'START' : testKey.running ? 'TEST' : g.running ? 'RUN' : 'STOP');
    fMains.classList.toggle('is-on', !!p.mains); fGen.classList.toggle('is-on', !!g.running || testKey.running);
    setText(fHouse, `HOUSE ${lv === 'generator' ? 'GEN' : 'MAINS'}`); fHouse.classList.toggle('is-on', !!p.on);
    fDark.classList.toggle('is-on', !p.on);
    setText(fTest, g.testedDay != null ? `TEST DAY ${g.testedDay}` : '');
    setText(clock, `DAY ${fmt0(env.dayNumber)}  ${env.timeLabel}`);
    const k = `${Math.round(fuelL)}`;
    if (fuelDial.__k !== k) { fuelDial.__k = k; fuelDial.innerHTML = dial({ v: fuelL, lo: 0, hi: GENERATOR.fuelL, step: GENERATOR.fuelL / 4, label: 'FUEL', unit: `${fmt0(fuelL)} L`, size: 96, fmt: (x) => QUARTERS[x] ?? '' }); }
    setText(fuelSub, `about ${hoursText(left)} of fuel at full load`);
    // the engine
    engine.led.classList.toggle('is-on', !!g.running || testKey.running);
    engine.setState(startKey.running ? 'Engine: cranking, full power in about 2 farm minutes' : g.running ? `Engine: running${g.startedAt != null ? ` since ${whenText(g.startedAt)}` : ''}`
      : fuelL <= 0 ? 'Engine: stopped, the fuel tank is empty' : 'Engine: stopped');
    stopBtn.disabled = !g.running;
    startKey.el.hidden = !!g.running;
    // the lever: the pressed key is where it stands (lit), the lamp says whether the house has power
    toMains.setAttribute('aria-pressed', String(lv === 'mains')); toGen.setAttribute('aria-pressed', String(lv === 'generator'));
    sw.led.classList.toggle('is-on', !!p.on);
    sw.setState(`House on the ${lv}: ${p.on ? 'the house has power' : 'no power to the house'}`);
    mainsLamp.set(!!p.mains, `Mains: ${p.mains ? 'on' : 'off'}`);
    setText(swSub, lv === 'generator' ? (g.running ? 'the generator feeds the house' : 'the generator is not running') : p.mains ? 'the grid feeds the house' : 'the grid gives no power now');
    test.led.classList.toggle('is-on', testKey.running);
    test.setState(testKey.running ? 'Test run: the engine is running' : g.testedDay != null ? `Last test run: day ${g.testedDay}` : 'No test run in this flock yet');
    setText(test.small, `${GENERATOR.testMin} minutes every week (generator plate)`);
    fuel.setState(`${fmt0(fuelL)} L in the tank`);
    fillBtn.disabled = fuelL >= GENERATOR.fuelL - 0.5;
    // the house in one line
    const t = !p.on ? `<b>The house is dark: no power</b>${darkSince != null ? ` since ${whenText(darkSince)} (${hoursText((env.day - darkSince) * 24)})` : ''}. The fans, the pad pump, the lights and the augers are stopped.`
      : p.source === 'generator' ? `<b>The house is on the generator</b>${onSince != null ? ` since ${whenText(onSince)}` : ''} · the mains is ${p.mains ? 'back on' : 'off'}.`
        : `The house is on the mains${g.running ? ' · the generator is running and feeds nothing' : ''}.`;
    if (state.__t !== t) { state.__t = t; state.innerHTML = t; }
  }
  let acc = 0;
  return {
    el: shell.el,
    onOpen() { isOpen = true; shell.refreshPlates(); },
    onClose() { isOpen = false; },
    /** A start or a test run still on its bar finishes with the panel closed (the panel host keeps updating it). */
    busy: () => startKey.running || testKey.running,
    dispose() { off?.(); },
    update(dt, force) {
      startKey.update(); testKey.update();
      acc -= dt;
      if (force || acc <= 0) { acc = 0.2; refresh(); }
    },
  };
}
