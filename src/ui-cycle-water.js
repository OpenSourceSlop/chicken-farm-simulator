// Phase 3 parts of the water supply panel (ui-water.js builds it; PHASE3.md §6.7, §6.10, §13.3, §13.9).
// Package "panels". From day 8 the panel gets tabs: Lines (Phase 2's meter, filter and flush valves, plus
// the main valve and, with waterTest, the test kit), Vaccine (water.main, vaccine.mix { stabiliser }, the
// vaccine plate), Medicine (water.medicate { on }, the medicator plate) and from day 43 Clean-out
// (water.disinfect { on }, then each line flushed with the tank disinfected: water.flush -> disinfected).
// The brooding week shows Phase 2's panel exactly (no tabs, no new rows).
import { DRINKER_LINES_Z, CYCLE } from './config.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { buildPlate } from './ui-boards.js';
import { machineRow, toggleKey, readout } from './ui-equipment.js';
import { int, one } from './ui-format.js';
import { makeTabs, whenText, hoursText, mainShut } from './ui-cycle-kit.js';

const FROM_DAY = 8;

export function cycleWaterParts(L, { linesSec, foldPlates }) {
  const { env, farm, skills } = L;
  const memo = { shut: false, flush: [false, false, false, false] };
  const tabs = makeTabs(['Lines', 'Vaccine', 'Medicine', 'Clean-out'], { secs: [linesSec] });
  tabs.bar.hidden = true;
  // ---------- main valve (Lines and Vaccine tabs show the same valve) ----------
  const foldAll = () => { foldPlates(); vacPlate.fold(); medPlate.fold(); };
  const valveToggle = () => {
    const shut = !mainShut(farm, memo);
    if (shut) foldAll();
    L.act('water.main', { open: !shut });
    memo.shut = shut; memo.at = env.day;
    sync();
  };
  const mainRow = (sub) => { const t = toggleKey('Main valve shut', 'Main valve open', valveToggle); const r = machineRow('Main valve', sub, t.el); r.led.classList.add('led--pad'); return { ...r, t }; };
  const mainLines = mainRow('water to the header tank and the lines');
  mainLines.el.hidden = true;
  linesSec.prepend(mainLines.el);
  // water test kit (unlock waterTest)
  const testOut = readout('Water test');
  const testBtn = button({ class: 'btn btn--machine' }, 'Test the water');
  testBtn.addEventListener('click', () => {
    const r = L.act('water.test', {});
    if (r && typeof r === 'object') testOut.set(`pH ${one(r.ph)} · chlorine ${one(r.chlorinePpm)} ppm`, `tested ${env.timeLabel}`);
    else testOut.set('—', `tested ${env.timeLabel}`);
  });
  const testBox = h('div', { class: 'equip-reads', hidden: true }, testOut.el, testBtn);
  linesSec.append(testBox);
  // ---------- Vaccine ----------
  const mainVac = mainRow('water to the header tank and the lines');
  const stabId = uniqueId('stab');
  const stab = h('input', { type: 'checkbox', id: stabId });
  const mixBtn = button({ class: 'btn btn--machine btn--go' }, 'Mix the vaccine into the header tank');
  const tank = h('p', { class: 'cyc-line' });
  mixBtn.addEventListener('click', () => {
    const r = L.act('vaccine.mix', { stabiliser: !!stab.checked });
    memo.litres = r && typeof r === 'object' ? r.litres : null;
    sync();
  });
  const vacState = h('p', { class: 'cyc-line', 'aria-live': 'polite' });
  const vacPlate = buildPlate('vaccine');
  tabs.secs[1].append(mainVac.el,
    h('div', { class: 'cyc-box cyc-sec' }, h('p', { class: 'cyc-k' }, 'Header tank'), h('div', { class: 'equip-btns', style: 'margin-top: 0; align-items: center' }, h('label', { class: 'cyc-check', for: stabId }, stab, 'Skim milk powder stabiliser'), mixBtn), tank),
    vacState, vacPlate.el);
  // ---------- Medicine ----------
  // the farm's medication state when it answers the action (sim); else what the farmer set here (the stub)
  const medNow = () => (memo.med ? memo.med.on : !!farm.health?.medication?.on);
  const med = toggleKey('Medicator on', 'Medicator off', () => {
    const on = !medNow();
    L.act('water.medicate', { on });
    memo.med = farm.health?.medication?.on === on ? null : { on, at: env.day };
    sync();
  });
  const medRow = machineRow('Medicator', 'medicine into the water at the vet’s dose', med.el);
  medRow.led.classList.add('led--pad');
  const medState = h('p', { class: 'cyc-line' });
  const medPlate = buildPlate('medicator');
  tabs.secs[2].append(medRow.el, medState, medPlate.el);
  // ---------- Clean-out ----------
  const dis = toggleKey('Disinfectant in', 'No disinfectant', () => { L.act('water.disinfect', { on: !farm.clean?.disinfectant }); sync(); });
  const disRow = machineRow('Header tank', 'disinfectant mixed as its label says', dis.el);
  disRow.led.classList.add('led--pad');
  const flushes = DRINKER_LINES_Z.map((z, i) => {
    const t = toggleKey('Valve open', 'Valve shut', () => {
      const on = !(farm.water.lines[i].flushing || memo.flush[i]);
      if (on) foldAll();
      L.act('water.flush', { line: i, on });
      memo.flush[i] = on;
      sync();
    });
    const r = machineRow(`Line ${i + 1}`, '', t.el);
    r.led.classList.add('led--pad');
    return { t, r };
  });
  tabs.secs[3].append(h('div', { class: 'ctrl-rows', style: 'margin-top: 0' }, disRow.el), h('p', { class: 'cyc-k' }, 'Flush each line with the disinfectant'),
    h('div', { class: 'cyc-items' }, flushes.map((f) => f.r.el)));

  function sync() {
    const d = env.dayNumber, on = farm.mode === 'level' && d >= FROM_DAY, clean = d >= CYCLE.cleanFrom;
    tabs.bar.hidden = !on;
    tabs.visible(1, on && !clean); tabs.visible(2, on && !clean); tabs.visible(3, on && clean);
    if (!on && tabs.current !== 0) tabs.show(0);
    mainLines.el.hidden = !on;
    testBox.hidden = !on || !skills?.unlocked?.('waterTest');
    const shut = mainShut(farm, memo);
    for (const m of [mainLines, mainVac]) { m.t.set(shut); m.led.classList.toggle('is-on', !shut); }
    for (const m of [mainLines, mainVac]) setText(m.small, shut ? `shut${memo.at != null ? ` since ${whenText(memo.at)}` : ''}: no water reaches the lines` : 'water to the header tank and the lines');
    const v = farm.health?.vaccine || { state: 'none' };
    const since = (t) => hoursText((env.day - t) * 24);
    setText(vacState, {
      none: 'No vaccine in the header tank.',
      thirst: `Main valve shut since ${whenText(v.thirstFrom)} (${since(v.thirstFrom)}): the lines run dry.`,
      mixed: `Vaccine mixed ${whenText(v.mixedAt)}, waiting in the header tank.`,
      drinking: `The birds are drinking the vaccine since ${whenText(v.startAt)} (${since(v.startAt)}).`,
      drunk: `Header tank empty ${whenText(v.drunkAt)}: vaccine drunk in ${hoursText(v.hours)}.`,
    }[v.state] || '');
    const mixed = v.state !== 'none' && v.state !== 'thirst';
    mixBtn.disabled = mixed; stab.disabled = mixed;
    if (mixed && v.stabiliser != null) stab.checked = !!v.stabiliser;
    const litres = memo.litres ?? (v.state === 'mixed' && Number.isFinite(v.tankL) ? v.tankL : null);
    setText(tank, mixed ? `${litres != null ? `${int(litres)} L of vaccine water` : 'Vaccine water'}${v.stabiliser ? ' with stabiliser' : ''}, mixed ${whenText(v.mixedAt)}.` : 'Empty: mix the vaccine for about 2 hours of drinking.');
    const m = farm.health?.medication || {};
    const medOn = medNow();
    med.set(medOn); medRow.led.classList.toggle('is-on', medOn);
    const from = memo.med ? memo.med.at : m.from;
    setText(medState, medOn ? `Medicine in the water since ${whenText(from)} (${hoursText((env.day - from) * 24)}).` : m.days ? `Off. The last course ran ${one(m.days)} days.` : 'Off.');
    dis.set(!!farm.clean?.disinfectant); disRow.led.classList.toggle('is-on', !!farm.clean?.disinfectant);
    flushes.forEach((f, i) => {
      const fl = !!(farm.water.lines[i].flushing || memo.flush[i]);
      if (!farm.water.lines[i].flushing && memo.flush[i] && !farm.clean?.disinfectant) memo.flush[i] = false;
      f.t.set(fl); f.r.led.classList.toggle('is-on', fl);
      setText(f.r.small, (farm.clean?.lines?.[i] ?? 0) >= 1 ? 'disinfectant through the line' : fl ? 'flushing' : 'not flushed with disinfectant');
    });
  }
  return {
    bar: tabs.bar, secs: tabs.secs.slice(1),
    plates: [vacPlate, medPlate],
    onOpen() { sync(); },
    update() { sync(); },
    fold() { vacPlate.fold(); medPlate.fold(); },
  };
}
