// Phase 3 parts of the water supply panel (ui-water.js builds it; PHASE3.md §6.7, §6.10, §13.3, §13.9).
// Package "panels". From day 8 the panel gets tabs: Lines (Phase 2's meter, filter and flush valves, plus
// the main valve and, with waterTest, the test kit; Phase 4: the kit in a water problem's run from the prep day, with
// the iron), Vaccine (water.main, vaccine.mix { stabiliser }, the
// vaccine plate), Medicine (water.medicate { on }, the medicator plate) and from day 43 Clean-out
// (water.disinfect { on }, then each line flushed with the tank disinfected: water.flush -> disinfected).
// The brooding week shows Phase 2's panel exactly (no tabs, no new rows).
import { DRINKER_LINES_Z, CYCLE } from './config.js';
import { h, button, setText, uniqueId } from './ui-dom.js';
import { buildPlate } from './ui-boards.js';
import { machineRow, toggleKey, readout } from './ui-equipment.js';
import { int, one } from './ui-format.js';
import { makeTabs, whenText, hoursText, mainShut } from './ui-cycle-kit.js';
// Skills update (SKILLS.md §3.1): the sight tubes, the trend, the winch motors (supplySkills / drinkerSkills below)
import { EQUIP } from './config.js';
import { columnsNow, COLUMN_BAND_CM } from './farm-auto.js';
import { nippleCmToday } from './job-figures.js';
import { skillBox, workLine, oneKey, row as skRow, note as skNote, perkHas, perkAuto, live, autoStatus, openFault, holdText, faultText, atText, ensureSkillsStyle } from './ui-cycle-skills.js';

const FROM_DAY = 8;

export function cycleWaterParts(L, { linesSec, foldPlates, needTime = null }) {
  const { env, farm, skills } = L;
  const memo = { shut: false, flush: [false, false, false, false] };
  const tabs = makeTabs(['Lines', 'Vaccine', 'Medicine', 'Clean-out'], { secs: [linesSec] });
  tabs.bar.hidden = true;
  // ---------- main valve (Lines and Vaccine tabs show the same valve) ----------
  const foldAll = () => { foldPlates(); vacPlate.fold(); medPlate.fold(); };
  // the steps hotfix: what waits on farm time runs a paused clock again, with the panel's note (ui-water.js)
  const wait = (text) => { foldAll(); needTime?.(text); };
  const valveToggle = () => {
    const shut = !mainShut(farm);
    const vs = farm.health?.vaccine?.state;
    if (shut) wait('with the main valve shut the lines run dry and the birds get thirsty: 1–2 farm hours (vaccine plate)');
    else if (vs === 'mixed') wait('the birds drink the vaccine water from the header tank: about 2 farm hours (vaccine plate). Walk slowly through the house while they drink');
    L.act('water.main', { open: !shut });
    memo.shut = shut; memo.at = env.day;
    sync();
  };
  // the key names what pressing it does: shut while the valve is open, open while it is shut
  const mainRow = (sub) => { const t = toggleKey('Open the main valve', 'Shut the main valve', valveToggle, 'Main valve · shut'); const r = machineRow('Main valve', sub, t.el); r.led.classList.add('led--pad'); return { ...r, t }; };
  const mainLines = mainRow('water to the header tank and the lines');
  mainLines.el.hidden = true;
  linesSec.prepend(mainLines.el);
  // water test kit (unlock waterTest)
  const testOut = readout('Water test');
  const testBtn = button({ class: 'btn btn--machine' }, 'Test the water');
  testBtn.addEventListener('click', () => {
    const r = L.act('water.test', {});
    // Phase 4, a water problem: the kit reads the iron too (water.test adds ironMgL)
    const iron = r && typeof r === 'object' && Number.isFinite(r.ironMgL) ? ` · iron ${one(r.ironMgL)} mg/L` : '';
    if (r && typeof r === 'object') testOut.set(`pH ${one(r.ph)} · chlorine ${one(r.chlorinePpm)} ppm${iron}`, `tested ${env.timeLabel}${iron ? ' · water supply plate: iron over about 0.3 mg/L clogs the filter and the nipples' : ''}`);
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
  // the farm's medication state (farm.health.medication)
  const medNow = () => !!farm.health.medication.on;
  const med = toggleKey('Stop the medicine', 'Start the medicine', () => {
    const on = !medNow();
    if (on) wait('the medicine goes into the water while the birds drink, for the days the vet’s letter names (medicator plate)');
    L.act('water.medicate', { on });
    sync();
  });
  med.stateText('Medicine · in the water');
  const medRow = machineRow('Medicator', 'medicine into the water at the vet’s dose', med.el);
  medRow.led.classList.add('led--pad');
  const medState = h('p', { class: 'cyc-line' });
  const medPlate = buildPlate('medicator');
  tabs.secs[2].append(medRow.el, medState, medPlate.el);
  // ---------- Clean-out ----------
  const dis = toggleKey('Run the tank clean', 'Put disinfectant in the tank', () => { L.act('water.disinfect', { on: !farm.clean?.disinfectant }); sync(); }, 'Disinfectant · in the tank');
  const disRow = machineRow('Header tank', 'disinfectant mixed as its label says', dis.el);
  disRow.led.classList.add('led--pad');
  const flushes = DRINKER_LINES_Z.map((z, i) => {
    const t = toggleKey('Close flush valve', 'Open flush valve', () => {
      const on = !(farm.water.lines[i].flushing || memo.flush[i]);
      if (on) wait(`line ${i + 1} fills with the disinfectant over farm time with its flush valve open; the row says when it is through`);
      L.act('water.flush', { line: i, on });
      memo.flush[i] = on;
      sync();
    });
    t.stateText('Flush valve · open');
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
    // the test kit: with its unlock from day 8, and in a water problem's run from the prep day (given with the condition)
    testBox.hidden = !((on && skills?.unlocked?.('waterTest')) || (farm.mode === 'level' && farm.condition === 'water'));
    const shut = mainShut(farm);
    for (const m of [mainLines, mainVac]) { m.t.set(shut); m.led.classList.toggle('is-on', !shut); m.setState(shut ? 'Main valve: shut, no water to the lines' : 'Main valve: open, water reaches the lines'); }
    for (const m of [mainLines, mainVac]) setText(m.small, shut ? `shut${memo.at != null ? ` since ${whenText(memo.at)}` : ''}: no water reaches the lines` : 'water to the header tank and the lines');
    const v = farm.health?.vaccine || { state: 'none' };
    const since = (t) => hoursText((env.day - t) * 24);
    setText(vacState, {
      none: 'No vaccine in the header tank.',
      thirst: `Main valve shut since ${whenText(v.thirstFrom)} (${since(v.thirstFrom)}): the lines run dry.`,
      mixed: `Vaccine mixed ${whenText(v.mixedAt)}, waiting in the header tank.`,
      drinking: `The birds have been drinking the vaccine since ${whenText(v.startAt)} (${since(v.startAt)}).`,
      drunk: `Header tank empty ${whenText(v.drunkAt)}: vaccine drunk in ${hoursText(v.hours)}.`,
    }[v.state] || '');
    const mixed = v.state !== 'none' && v.state !== 'thirst';
    mixBtn.disabled = mixed; stab.disabled = mixed;
    if (mixed && v.stabiliser != null) stab.checked = !!v.stabiliser;
    const litres = memo.litres ?? (v.state === 'mixed' && Number.isFinite(v.tankL) ? v.tankL : null);
    setText(tank, mixed ? `${litres != null ? `${int(litres)} L of vaccine water` : 'Vaccine water'}${v.stabiliser ? ' with stabiliser' : ''}, mixed ${whenText(v.mixedAt)}.` : 'Empty: mix the vaccine for about 2 hours of drinking.');
    const m = farm.health?.medication || {};
    const medOn = medNow();
    med.set(medOn); medRow.led.classList.toggle('is-on', medOn); medRow.setState(`Medicator: ${medOn ? 'on' : 'off'}`);
    const from = m.from;
    setText(medState, medOn ? `Medicine in the water since ${whenText(from)} (${hoursText((env.day - from) * 24)}).` : m.days ? `Off. The last course ran ${one(m.days)} days.` : 'Off.');
    dis.set(!!farm.clean?.disinfectant); disRow.led.classList.toggle('is-on', !!farm.clean?.disinfectant); disRow.setState(`Header tank: ${farm.clean?.disinfectant ? 'disinfectant in' : 'clean water'}`);
    flushes.forEach((f, i) => {
      const fl = !!(farm.water.lines[i].flushing || memo.flush[i]);
      if (!farm.water.lines[i].flushing && memo.flush[i] && !farm.clean?.disinfectant) memo.flush[i] = false;
      f.t.set(fl); f.r.led.classList.toggle('is-on', fl); f.r.setState(`Flush valve: ${fl ? 'open' : 'closed'}`);
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

// ---------------- Skills update (SKILLS.md §3.1, §5.1, §12.9): the sight tubes, the trend, the winch motors ----------------
// Water 2 (waterAllLines): the sight-tube board at the supply, Read the sight tubes -> water.columns {} (each line's
// column against the drinker plate's mark for the day; every line keeps lastColumn), the lines that read off named with
// their regulator. Water 1 (waterTrend): the Trend key beside the meter. Water 3 (autoWinch): the four heights against the
// plate with each motor's state; at the regulator the motor's row, Reset the motor (auto.reset { system: 'winch', line })
// and the farmer's winching holding until 06:00. Everything behind the perks: with live false nothing here shows.
const TUBE_MAX = EQUIP.pressureCm[1];
/** The sight-tube board: four clear tubes, the red mark at the plate's column, the blue water (cm) of each line. */
function tubesSvg(cols) {
  const W = 260, H = 120, top = 10, bot = 104, y = (cm) => bot - (Math.max(0, Math.min(TUBE_MAX, cm)) / TUBE_MAX) * (bot - top);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="5" fill="#eceae2" stroke="var(--plate-edge)"/>
    ${cols.map((c, i) => { const x = 22 + i * 62; return `<rect x="${x}" y="${top}" width="16" height="${bot - top}" rx="7" fill="#fbfbf8" stroke="#8d8a80"/>
      <rect x="${x + 3}" y="${y(c.cm).toFixed(1)}" width="10" height="${(bot - y(c.cm)).toFixed(1)}" rx="4" fill="#3d8fd6"/>
      <path d="M${x - 5} ${y(c.markCm).toFixed(1)}h26" stroke="#d2382b" stroke-width="2.4"/>
      <text x="${x + 8}" y="${H - 4}" font-size="10" text-anchor="middle" fill="#3b3a34" font-family="var(--font-display)">${i + 1}</text>`; }).join('')}</svg>`;
}
const offWords = (c) => { const d = c.cm - c.markCm; return Math.abs(d) <= COLUMN_BAND_CM + 1e-9 ? 'at the mark' : `${one(Math.abs(d))} cm ${d < 0 ? 'under' : 'over'} the mark`; };
const sameDay = (env, t) => Number.isFinite(t) && Math.floor(t + 1e-9) === Math.floor(env.day + 1e-9);
/** The Trend key's graph (Water 1), drawn for the panel's width at its own scale (12 px labels): bars litres per 1,000
 *  birds a day, the dashed line water : feed on its own 0–3 axis (the record book's water graph, ui-summary waterSvg). */
function trendSvg(pts) {
  const W = 480, H = 150, padL = 34, padR = 30, padT = 10, padB = 22;
  const d0 = Math.min(...pts.map((p) => p.d)), n = Math.max(7, Math.max(...pts.map((p) => p.d)) - d0 + 1);
  const vmax = Math.max(50, ...pts.map((p) => p.v || 0)) * 1.1, bw = (W - padL - padR) / n;
  const X = (d) => padL + (d - d0 + 0.5) * bw, Y = (v) => H - padB - (Math.max(0, v) / vmax) * (H - padT - padB), RY = (r) => H - padB - (Math.min(3, Math.max(0, r)) / 3) * (H - padT - padB);
  const ink = 'fill="var(--lcd-ink)" font-size="12" font-family="var(--font-display)"';
  const bars = pts.filter((p) => Number.isFinite(p.v)).map((p) => `<rect x="${(X(p.d) - bw * 0.35).toFixed(1)}" y="${Y(p.v).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(H - padB - Y(p.v)).toFixed(1)}" fill="var(--lcd-ink)" opacity="0.45"/>`).join('');
  const rp = pts.filter((p) => Number.isFinite(p.ratio));
  const line = rp.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)} ${RY(p.ratio).toFixed(1)}`).join('');
  const days = pts.filter((p, i) => i === 0 || i === pts.length - 1 || (p.d - d0) % 3 === 0).map((p) => `<text x="${X(p.d).toFixed(1)}" y="${H - 6}" text-anchor="middle" ${ink}>${p.d}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Water per 1,000 birds by day (bars) and water to feed (dashed line)">
    <path d="M${padL} ${H - padB}H${W - padR}" stroke="var(--lcd-ink)"/>${bars}
    ${line ? `<path d="${line}" fill="none" stroke="var(--lcd-ink)" stroke-width="2" stroke-dasharray="5 3"/>` : ''}
    <text x="${padL - 4}" y="${padT + 10}" text-anchor="end" ${ink}>${Math.round(vmax)}</text><text x="${padL - 4}" y="${H - padB}" text-anchor="end" ${ink}>0</text>
    <text x="${W - padR + 4}" y="${padT + 10}" ${ink}>3</text><text x="${W - padR + 4}" y="${H - padB}" ${ink}>0</text>${days}</svg>`;
}

/** The water supply's payoff parts: { trendKey, trendEl, el, onOpen(), update() }. */
export function supplySkills(L) {
  const { env, farm } = L;
  ensureSkillsStyle();
  // Water 1: the Trend key beside the meter (the record book's graph of the last 14 days, inline)
  let trendOpen = false;
  const trendKey = oneKey('Trend', () => { trendOpen = !trendOpen; drawTrend(); }, { label: 'Trend: water per 1,000 birds, the last 14 days' });
  trendKey.hidden = true; trendKey.setAttribute('data-skill-key', 'waterTrend');
  const trendEl = h('div', { class: 'cyc-chart', hidden: true });
  function drawTrend() {
    const on = live() && perkHas(L, 'waterTrend') && farm.mode === 'level';
    trendKey.hidden = !on;
    trendKey.setAttribute('aria-expanded', String(on && trendOpen));   // a disclosure (shows the graph under the meter), not a lit switch
    trendEl.hidden = !(on && trendOpen);
    if (trendEl.hidden) return;
    const rows = (L.records?.rows ? L.records.rows() : []).filter((r) => r.day >= Math.max(0, env.dayNumber - 14) && r.day <= env.dayNumber);
    const k = rows.map((r) => `${r.day}|${r.waterPerBirdMl}`).join(',');
    if (trendEl.__k === k) return;
    trendEl.__k = k;
    trendEl.innerHTML = rows.length >= 2 ? `<p class="ctrl-chart-k">Last 14 days · litres per 1,000 birds (bars), water : feed (dashed, 0–3) · Water 1</p>${trendSvg(rows.map((r) => ({ d: r.day, v: r.waterPerBirdMl, ratio: r.waterFeedRatio })))}`
      : '<p class="ctrl-chart-k">Water trend: it draws from two signed days of the record book</p>';
  }
  // Water 2: the sight-tube board
  const board = h('div', { class: 'skl-board' });
  const readKey = oneKey('Read the sight tubes', () => readTubes());
  const tubeWork = workLine();
  const tubeRows = h('div', { class: 'skl-tubes' });
  const offNote = skNote();
  let read = null; // { day, at, lines }
  function readTubes() {
    const r = L.act('water.columns', {}) || {};
    read = { day: env.dayNumber, at: env.timeLabel, lines: Array.isArray(r.lines) ? r.lines : [] };
    draw(true);
  }
  // (what a column means is on the water supply plate beside the panel: the sign's line, general practice)
  const tubes = skillBox('waterAllLines', 'Sight-tube board · one tube a line', board, skRow(readKey, tubeWork.el), tubeRows, offNote);
  // Water 3: the winch motors
  const winchTable = h('div');
  const winchNote = skNote();
  const winch = skillBox('autoWinch', 'Winch motors · the drinker plate’s height', winchTable, winchNote);
  const el = h('div', null, tubes.el, winch.el);
  let key = '';
  function draw(force) {
    const on2 = perkHas(L, 'waterAllLines') && farm.mode === 'level';
    tubes.show(on2);
    if (on2) {
      let cols = [];
      try { cols = columnsNow(farm, env); } catch { cols = []; }
      const k = cols.map((c) => `${c.cm}|${c.markCm}`).join(',');
      if (force || board.__k !== k) { board.__k = k; board.innerHTML = tubesSvg(cols); }
      const r = read && read.day === env.dayNumber ? read : null;
      const d = Math.max(0, env.dayNumber);
      tubeWork.set(r ? `Read ${r.at}: ${r.lines.filter((c) => c.inBand).length} of ${r.lines.length} lines at the mark (${one(r.lines[0]?.markCm)} cm for day ${d})` : `Red mark: the drinker plate’s column for day ${d}, ${one(cols[0]?.markCm)} cm`,
        r ? 'A line at its mark counts as flow-tested today.' : 'A line read at its mark counts as flow-tested today.');
      const rk = r ? r.lines.map((c) => `${c.cm}|${c.inBand}`).join(',') : '';
      if (force || tubeRows.__k !== rk) {
        tubeRows.__k = rk;
        tubeRows.replaceChildren(...(r ? r.lines : []).map((c) => h('span', { class: `skl-tube${c.inBand ? '' : ' is-off'}`, 'data-line': String(c.line) }, `Line ${c.line + 1}`, h('span', null, `${one(c.cm)} cm`), h('small', null, offWords(c)))));
      }
      const off = r ? r.lines.filter((c) => !c.inBand) : [];
      setText(offNote, !r ? '' : off.length ? off.map((c) => `Line ${c.line + 1}: a cup test at the line ${c.line + 1} regulator (west end); its pressure ${c.cm < c.markCm ? '+' : '−'} key ${c.cm < c.markCm ? 'raises' : 'lowers'} the column.`).join(' ') : 'Every line reads at the mark: no cup test on these lines today.');
      offNote.hidden = !r;
    }
    const on3 = farm.mode === 'level' && (perkAuto(L, 'winch') || !!openFault(L, 'winch-stall'));
    winch.show(on3);
    if (on3) {
      const st = autoStatus(L, 'winch'), plate = nippleCmToday(env);
      const rows = farm.water.lines.map((l, i) => {
        const stall = openFault(L, 'winch-stall', i), held = holdText(L, 'winch', i);
        return [i, l.heightCm, stall ? `stalled at ${int(l.heightCm)} cm` : held ? 'held: your winching' : st.on ? 'running' : 'off'];
      });
      const k = `${rows.map((r) => `${r[1]}|${r[2]}`).join(',')}|${plate}`;
      if (force || k !== key) {
        key = k;
        winchTable.replaceChildren(h('table', { class: 'skl-table' }, h('thead', null, h('tr', null, ['Line', 'Nipples', 'Plate', 'Motor'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', null, rows.map(([i, cm, w]) => h('tr', null, h('th', { scope: 'row' }, String(i + 1)), h('td', null, `${int(cm)} cm`), h('td', null, `${int(plate)} cm`), h('td', null, w))))));
      }
      const f = st.faults[0];
      setText(winchNote, f ? `${faultText(L, f)}. Winch the line by hand to the plate at its regulator and reset the motor there.` : st.text || 'The motors keep each line at the drinker plate’s height, at most 2 cm a farm hour.');
      winchNote.classList.toggle('skl-note--fault', !!f);
    }
  }
  return {
    trendKey, trendEl, el,
    /** the last read of today (the harness and the strip read it): { day, at, lines } | null */
    lastRead: () => (read && read.day === env.dayNumber ? read : null),
    onOpen() { trendOpen = false; drawTrend(); draw(true); },
    update() { drawTrend(); draw(false); },
  };
}

/** A drinker regulator's payoff parts: this line's sight tube read today (Water 2), its winch motor (Water 3). */
export function drinkerSkills(L, line) {
  const { env, farm } = L;
  ensureSkillsStyle();
  const tubeLine = workLine();
  const tubes = skillBox('waterAllLines', 'This line’s sight tube at the water supply', skRow(tubeLine.el));
  const motorLine = workLine();
  let said = '';
  const reset = oneKey('Reset the motor', () => {
    const r = L.act('auto.reset', { system: 'winch', line }) || {};
    said = r.reset ? `Motor reset ${env.timeLabel}: it follows the drinker plate again.` : `Reset pressed ${env.timeLabel}: the motor answers once the line is at the plate’s height.`;
    draw();
  }, { label: `Reset the line ${line + 1} winch motor` });
  const motorNote = skNote();
  const motor = skillBox('autoWinch', `Line ${line + 1} winch motor`, skRow(motorLine.el, reset), motorNote);
  const el = h('div', null, tubes.el, motor.el);
  function draw() {
    const l = farm.water.lines[line], lc = l.lastColumn;
    const on2 = perkHas(L, 'waterAllLines') && farm.mode === 'level' && !!lc && sameDay(env, lc.at);
    tubes.show(on2);
    if (on2) {
      let mark = null;
      try { mark = columnsNow(farm, env)[line]?.markCm; } catch { mark = null; }
      tubeLine.set(`Read ${atText(env, lc.at)}: ${one(lc.cm)} cm${mark != null ? `, mark ${one(mark)} cm` : ''} · ${lc.inBand ? 'at the mark: this line counts as flow-tested today' : 'off the mark: a cup test here'}`,
        lc.inBand ? '' : 'The pressure + key raises the column, − lowers it.');
    }
    const stall = openFault(L, 'winch-stall', line);
    const on3 = farm.mode === 'level' && (perkAuto(L, 'winch') || !!stall);
    motor.show(on3);
    if (!on3) return;
    const held = holdText(L, 'winch', line), plate = nippleCmToday(env);
    motorLine.set(stall ? `Stalled at ${int(l.heightCm)} cm (plate ${int(plate)} cm)` : held ? `Held: ${held}` : `Running: the nipples follow the drinker plate, ${int(plate)} cm today`,
      stall ? 'Winch the line by hand to the plate’s height, then reset the motor.' : 'Your own winching of this line holds until 06:00.');
    reset.hidden = !stall;
    setText(motorNote, said || (stall ? faultText(L, stall) : ''));
    motorNote.hidden = !motorNote.textContent;
  }
  return { el, onOpen() { said = ''; draw(); }, update() { draw(); } };
}
