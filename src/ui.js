// HUD, panels and keys. Owner: package "run" (Phase 2: "level"; Phase 1: systems/UI agent).
// createUI(ctx, deps) -> ui. Owns all DOM inside #hud. Two modes share the clock, gauges and the
// panel host:
//   sandbox  the Phase 1 farm exactly as before: four tutorial jobs, Phase 1 boards and controller,
//            test tools, Skip 1 hour / Next morning
//   level    Level 1 (PHASE2.md): the job card, Next job, the boards and plates of content-signs.js,
//            every equipment and inspection panel, records, notebook, skill tree, result; E through
//            ctx.interact.nearest(), Q squeeze, T floor thermometer, N notebook, K skill tree, F floor view;
//            Phase 3: L light meter, V air meter, C comfort view, M litter moisture view (PHASE3.md §13.6)
// plus the title card and the run card (level.js decides the mode and calls setMode; ctx.run the run).
import { FARM, HOUSE_BOUNDS } from './config.js';
import { SIGNS, LEVEL_HELP_KEYS, lookCaption } from './content.js';
import { BOARDS } from './content-signs.js';
import { EV } from './events.js';
import { h, button, setText, inFormControl, typingInControl } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { createHud } from './ui-hud.js';
import { createTasks } from './ui-tasks.js';
import { createPanelHost, buildSignPanel } from './ui-panels.js';
import { buildControllerPanel } from './ui-controller.js';
import { createTestTools } from './ui-testtools.js';
import { createHelp, createNarrowNotice, createPrompt } from './ui-help.js';
import { buildBoardPanel, buildPlate, setPlateDay, setPlateCondition } from './ui-boards.js';
import { buildFeederPanel, buildSiloPanel, buildHeapPanel, buildBirdScalePanel } from './ui-equipment.js';
import { buildDrinkerPanel, buildWaterSupplyPanel } from './ui-water.js';
import { buildLevelControllerPanel } from './ui-climate.js';
import { buildGradingPanel, buildChickInHandPanel, buildWeighPanel } from './ui-inspect.js';
import { buildRecordsPanel } from './ui-records.js';
import { buildNotebookPanel } from './ui-notebook.js';
import { buildSkillTreePanel } from './ui-skilltree.js';
import { buildResultPanel } from './ui-result.js';
import { createTitle } from './ui-title.js';
import { createJobCard } from './ui-jobs.js';
import { createCaption, createFloatLabel } from './ui-caption.js';
import { createDeadMarks } from './ui-deadmarks.js'; // PHASE4.md §15.4: the nearest dead bird's chip, markers within 15 m
import { createWatchCard } from './ui-watch.js';       // PHASE4.md §15.1: the flock watch card
import { int, one, feelWords } from './ui-format.js';
import { FLOOR_TEMP_RAMP, COMFORT_RAMP, MOISTURE_RAMP, levelById, conditionLabel } from './config.js';
import { sectorOf } from './job-engine.js';
import { BOARDS_CYCLE } from './content-signs-cycle.js';
import { BOARDS_COND } from './content-signs-cond.js';
import { RUN_CARD } from './content.js';
import { createBusyCard } from './ui-run.js';
import { setFarmTimeHooks, tickFarmTimeNotes, clearFarmTimeNotes } from './ui-farmtime.js';
import { buildSummaryPanel } from './ui-summary.js';
// Phase 3 (PHASE3.md §13.8): the panels package registers its panels here
import { registerCyclePanels } from './ui-cycle-panels.js';
import { registerCondPanels } from './ui-cond-panels.js'; // Phase 4 (package "panels"; placeholders until it builds them)
import { withJobStrip } from './ui-jobstrip.js';
import { boardsForDay } from './content-signs-cycle.js';
import { sourceLabel } from './content-signs.js';

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
const ARROW_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const isKeyE = (e, k) => e.code === 'KeyE' || k === 'e';
const isKeyHelp = (e, k) => e.code === 'KeyH' || k === 'h' || k === '?' || (e.code === 'Slash' && e.shiftKey);
const isCode = (e, k, code, letter) => e.code === code || (!e.code && k === letter);
const P1_IDS = new Set(['sign-gate', 'controller', 'sign-brooder']); // what E reaches in the sandbox
const TWO_HANDS_PANELS = new Set(['chick-table', 'chick-grading']);    // PHASE4.md §15.3 (c): panels that handle chicks
const clockText = (t) => { const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const inHouse = (p) => p.x > HOUSE_BOUNDS.xMin && p.x < HOUSE_BOUNDS.xMax && p.z > HOUSE_BOUNDS.zMin && p.z < HOUSE_BOUNDS.zMax;

export function createUI(ctx, deps) {
  const { env, canvas } = ctx;
  const { player, flock, interactables = [] } = deps;
  const farm = deps.farm || ctx.farm, events = deps.events || ctx.events, records = deps.records || ctx.records;
  const skills = deps.skills || ctx.skills, props = deps.props || ctx.props, interact = deps.interact || ctx.interact;
  const root = document.getElementById('hud');
  root.textContent = '';
  let mode = 'sandbox';

  // top left: farm clock and gauges
  const hud = createHud(root, env);

  // top right: Phase 1 jobs (sandbox)
  const tr = h('div', { class: 'hud-tr' });
  root.appendChild(tr);
  // HUD elements the edge pointer keeps clear of: the cards, the E prompt and the captions
  // (review round: the visible clock and gauge cards, not the .hud-tl row, which is wider than its cards when it wraps)
  const avoid = () => [tr, trL, root.querySelector('.hud-tl .clock'), root.querySelector('.hud-tl .gauges'), root.querySelector('.hud-bl'), root.querySelector('.hud-br'),
    root.querySelector('.hud-bc .prompt'), root.querySelector('.caption'), root.querySelector('.fw'), root.querySelector('.alarm')].filter((e) => e && !e.hidden);
  const tasks = createTasks(tr, ctx, { player, root, avoid });
  const p1Marker = ctx.scene.getObjectByName('task-marker');
  const p1Pointer = root.querySelector('.edge-pointer');

  // bottom left: controls legend and time controls (one legend per mode)
  const help = createHelp();
  const lhelp = createHelp(LEVEL_HELP_KEYS, 'chicken-farm.level-help-dismissed');
  lhelp.toggleBtn.hidden = true; lhelp.hide();
  const nextBar = button({ class: 'btn', title: 'Next job', 'aria-label': 'Next job' });
  nextBar.innerHTML = `${ICONS.next}<span>Next job</span>`; // icon outside a span: narrow screens hide the text spans
  nextBar.hidden = true;
  const nextBarText = nextBar.querySelector('span');
  let nextBarAcc = 0;
  // the time-bar button says what the next press does, as the job card's button does ("Skip to 10:13")
  function refreshNextBar(dt) {
    if ((nextBarAcc -= dt) > 0) return;
    nextBarAcc = 0.25;
    const label = ctx.level?.nextLabel?.() || 'Next job';
    if (nextBarText.textContent !== label) { nextBarText.textContent = label; nextBar.title = label; nextBar.setAttribute('aria-label', label); }
  }
  hud.timebar.append(nextBar, h('div', { class: 'timebar-sep', 'aria-hidden': 'true' }), help.toggleBtn, lhelp.toggleBtn);
  let helpAuto = help.visible;
  help.toggleBtn.addEventListener('click', () => { helpAuto = false; });
  const bl = h('div', { class: 'hud-bl' }, help.card, lhelp.card, hud.timebar);
  root.appendChild(bl);

  // bottom right: Phase 1 test tools
  const tools = createTestTools(env, { flock, onReset: reset, perf: ctx.perf });
  const br = h('div', { class: 'hud-br' }, tools.panel, tools.toggle);
  root.appendChild(br);
  function fitTools() {
    const room = window.innerHeight - tasks.el.getBoundingClientRect().bottom - 12 - 16;
    br.style.setProperty('--tools-room', `${Math.max(140, Math.floor(room))}px`);
  }
  tools.toggle.addEventListener('click', fitTools);
  window.addEventListener('resize', fitTools);

  // bottom centre: "E  Read the ..." and the panels
  const prompt = createPrompt(root, (id, target) => useTarget(target || { id }));
  const panels = createPanelHost(root, {
    player,
    canvas,
    onOpen: (id) => {
      tasks.notify(`open:${id}`); prompt.show(null); root.classList.add('has-panel');
      // review round: a notice raised just before the panel opened (the bucket set down for the chick in hand) shows in it
      if (pendingNote && rt - pendingNote.at < 1.5) { const t = pendingNote.text; pendingNote = null; panelNotice(t); } else pendingNote = null;
      // PHASE4.md §15.3 (c): grading chicks at the table needs both hands: the bucket goes down at his feet first
      if (mode === 'level' && props?.carrying === 'bucket' && TWO_HANDS_PANELS.has(id)) props.setBucketDown({ auto: true });
      if (mode !== 'sandbox') {
        events.emit(EV.PANEL_OPEN, { id });
        if ((BOARDS[id] || BOARDS_CYCLE[id] || BOARDS_COND[id]) && id.startsWith('sign-')) uiAct('sign.read', { board: id });
      }
    },
    onClose: () => {
      root.classList.remove('has-panel');
      pnote.hidden = true; pnoteFor = null;
      // a flock watch warning raised while the panel was open: its caption now, with its full time
      if (queuedWatch && mode === 'level') { caption.show(queuedWatch, 9, { soft: true }); queuedWatch = null; }
      if (mode !== 'sandbox' && lastOpen) events.emit(EV.PANEL_CLOSE, { id: lastOpen });
    },
  });
  let lastOpen = null;
  // review round: the HUD's captions sit under the panel scrim: a notice raised while a panel is open (or as it opens) is
  // written at the top of the panel itself (the bucket set down for a two-handed job, a flock watch warning)
  const pnote = h('p', { class: 'pnotice', role: 'status', hidden: true });
  let pnoteFor = null, pendingNote = null, queuedWatch = null, rt = 0;
  function panelNotice(text) {
    const P = panels.openPanel;
    if (!panels.openId || !P?.el) { pendingNote = { text, at: rt }; return false; }
    const host = P.el.querySelector('.equip-main') || P.el.querySelector('.sign-body') || P.el;
    setText(pnote, text); pnote.hidden = false; host.prepend(pnote); pnoteFor = panels.openId;
    return true;
  }
  const closePanel = () => panels.close();
  const openPanel = (id) => { const ok = panels.open(id); if (ok) lastOpen = id; return ok; };

  // top right in a level: the job card; captions and the floating reading
  const trL = h('div', { class: 'hud-tr hud-tr--level', hidden: true });
  root.appendChild(trL);
  const caption = createCaption(root);
  // floor thermometer view (F, unlock floorOverlay): its °C legend, the same ramp props paints
  const rampCss = FLOOR_TEMP_RAMP.map(([t, c]) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')}) ${(((t - 24) / 12) * 100).toFixed(0)}%`).join(', ');
  const floorLegend = h('div', { class: 'floor-legend', hidden: true, role: 'img', 'aria-label': 'Floor thermometer view: litter surface temperature, blue 24 °C to orange 36 °C' },
    h('p', { class: 'floor-legend-k' }, h('span', null, 'Floor thermometer view'), h('kbd', { class: 'kbd' }, 'F')),
    h('div', { class: 'floor-legend-bar', style: `background: linear-gradient(90deg, ${rampCss})` }),
    h('div', { class: 'floor-legend-ticks' }, FLOOR_TEMP_RAMP.map(([t], i) => h('span', null, i === FLOOR_TEMP_RAMP.length - 1 ? `${t} °C` : `${t}`))));
  root.appendChild(floorLegend);
  // Phase 3 views (C comfort, M litter moisture; PHASE3.md §9.1): continuous ramps, a legend in °C or %
  const rampLegend = (title, key, ramp, unit, label, tickWords = null) => {
    const lo = ramp[0][0], hi = ramp[ramp.length - 1][0], n = ramp.length;
    // with words the ticks are equal cells and each colour stop sits under the middle of its cell
    const at = (t, i) => (tickWords ? ((i + 0.5) / n) * 100 : ((t - lo) / (hi - lo)) * 100);
    const css = ramp.map(([t, c], i) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')}) ${at(t, i).toFixed(0)}%`).join(', ');
    const ticks = tickWords || ramp.map(([t], i) => (i === ramp.length - 1 ? `${t} ${unit}` : `${t}`));
    const el = h('div', { class: `floor-legend${tickWords ? ' floor-legend--words' : ''}`, hidden: true, role: 'img', 'aria-label': label },
      h('p', { class: 'floor-legend-k' }, h('span', null, title), h('kbd', { class: 'kbd' }, key)),
      h('div', { class: 'floor-legend-bar', style: `background: linear-gradient(90deg, ${css})` }),
      h('div', { class: `floor-legend-ticks${tickWords ? ' floor-legend-ticks--words' : ''}` }, ticks.map((t) => h('span', null, t))));
    root.appendChild(el);
    return el;
  };
  // the warm half follows the birds' own panting threshold at this age (flock-shader.js uHotFrom)
  const comfortLegend = rampLegend('Comfort view', 'C', COMFORT_RAMP, '°C', 'Comfort view: each bird by what it feels, blue colder than the target, white at the target, orange where panting starts at this age, red 3 °C past it',
    ['cold', 'cool', 'right', 'panting starts', 'too hot']);
  const comfortSub = h('p', { class: 'floor-legend-sub' });
  comfortLegend.append(comfortSub);
  let comfortSubText = '';
  const syncComfortSub = () => {
    const hf = flock?.comfortHotFrom?.();
    const t = Number.isFinite(hf) ? `White at the target · birds this age start to pant at +${hf.toFixed(1)} °C` : '';
    if (t !== comfortSubText) { comfortSubText = t; comfortSub.textContent = t; }
  };
  const moistureLegend = rampLegend('Litter moisture view', 'M', MOISTURE_RAMP, '%', 'Litter moisture view: light sand 10 % to dark brown 50 %');
  const views = { comfort: false };
  const busy = createBusyCard(root);
  const floatRead = createFloatLabel(root, ctx);
  const narrow = createNarrowNotice(root);
  // Phase 4 (PHASE4.md §4.2): the alarm banner: every power cut and every alarm symptom; it stays while the house is dark
  const alarmText = h('span', { class: 'alarm-text' });
  const alarm = h('div', { class: 'alarm', role: 'alert', hidden: true }, h('span', { class: 'alarm-lamp', 'aria-hidden': 'true' }), h('span', { class: 'alarm-k' }, 'Alarm'), alarmText);
  root.appendChild(alarm);
  const ALARM = { 'power-cut': 'The power is off in house 1: the fans, the pad pump, the lights and the augers have stopped.', 'gen-dry': 'The house is dark again: the generator has stopped.' };
  let alarmMsg = '', alarmT = 0;
  const raiseAlarm = (msg) => { alarmMsg = msg; alarmT = 12; };

  // ---- what the level panels share (L) ----
  const uiAct = (id, args = {}) => events.emit(EV.ACTION, { id, ...args, result: undefined });
  const mm = { min: null, max: null };
  const hist = [];
  let histAcc = 0;
  const lastFlows = [];
  let weigh = { day: null, list: [] };
  const details = new Map();
  const L = {
    ctx, env, farm, events, records, skills, props, flock, player, interact,
    act: (id, args = {}) => farm.act(id, args),
    uiAct,
    close: closePanel,
    openPanel,
    level: () => ctx.level,
    engine: () => ctx.level?.engine ?? null,
    jobs: () => ctx.level?.engine?.list() ?? [],
    // the controller's min / max memory is the farm's (saved with it; controller.read restarts it)
    minmax: () => { const m = farm.controllerMemory?.(); return m ? { min: m.minC, max: m.maxC } : mm; },
    resetMinMax: () => { mm.min = mm.max = env.houseTemp; },
    history: () => hist,
    lastFlows: () => lastFlows,
    weighings() {
      // the level's own list on a weigh day (saved, so a reload keeps it), else this page's; the places are
      // counted as the weigh job counts its parts (the brooding floor in week 1, the whole house from week 2)
      const kept = ctx.level?.weighsToday?.() || [];
      const l = kept.length ? kept : weigh.day === env.dayNumber ? weigh.list : [];
      const rule = { sectorsOf: env.dayNumber >= 8 ? 'house' : 'brood' };
      const ok = l.filter((x) => Number.isFinite(x.w)).map((x) => ({ ...x, s: sectorOf(rule, x.x ?? 0, x.z ?? 0, env) }));
      return { n: ok.length, mean: ok.length ? ok.reduce((a, b) => a + b.w, 0) / ok.length : null, sectors: new Set(ok.map((x) => x.s)).size, list: ok };
    },
    sampleTally(purpose) {
      const id = purpose === 'crop' ? 'd1-crop' : purpose === 'vent' ? 'd0-vent' : null;
      const inst = id && L.jobs().find((i) => i.id === id);
      if (!inst) return '';
      const n = inst.st.list.length, s = new Set(inst.st.list.map((x) => x.s)).size;
      return `${purpose === 'crop' ? 'Crops felt' : 'Vent temperatures'} so far: ${n} chick${n === 1 ? '' : 's'} from ${s} part${s === 1 ? '' : 's'} of the floor.`;
    },
    skillDetail: (id) => ctx.level?.skillDetail?.(id) || details.get(id) || '',
    squeeze: () => squeeze(),
    // Phase 3: the run, the letters that came to the desk, a level replay (saved start, else a standard start)
    run: () => ctx.run ?? null,
    letters: [],
    lettersRead: new Set(),
    replayLevel: (id, day) => replayLevel(id, day),
    standardLevel: (id, condition) => standardLevel(id, condition),
    startCondition: (id) => startCondition(id),
    /** The farm's condition (the only holder) and its name ('' in the normal season). */
    condition: () => farm?.condition ?? null,
    conditionName: () => (farm?.condition ? conditionLabel(farm.condition) : ''),
    // the steps hotfix: an action that waits on farm time runs a paused clock again (level hudHooks.resume)
    runClock: () => (mode === 'level' ? !!ctx.level?.hudHooks?.resume?.() : false),
    clockPaused: () => mode === 'level' && !!ctx.level?.hudHooks?.userPaused,
    notice: (text, sec) => caption.show(text, sec),
  };
  setFarmTimeHooks({ resume: () => L.runClock(), paused: () => L.clockPaused(), notice: (t, s) => L.notice(t, s) });
  /** Back to a level of the run: its saved start, else a standard start behind the card (PHASE3.md §2.2). */
  function replayLevel(id, day) {
    const run = ctx.run, def = levelById(id);
    if (!run || !def) return false;
    if (run.replay(id, { day })) return true;
    busy.run(RUN_CARD.standard(def.startDay, run.state().runCondition), () => run.startLevel(id, { from: 'standard' }));
    return true;
  }
  /** Phase 4 (PHASE4.md §3.1): a level's standard start with the flock chosen on its row (another flock: a new run). */
  function standardLevel(id, condition = null) {
    const run = ctx.run, def = levelById(id);
    if (!run || !def) return false;
    busy.run(RUN_CARD.standard(def.startDay, condition), () => run.startLevel(id, { from: 'standard', condition }));
    return true;
  }
  /** A new flock under a harder condition (the Harder flocks cards): Plan the farm under it. */
  const startCondition = (id) => (ctx.run ? ctx.run.startRun({ seed: (ctx.run.state().seed ?? 1), condition: id }) : false);
  // the controller's memory and chart: tracked in farm time, skips included
  env.addStepper((e, s) => {
    if (mode !== 'level') return;
    const t = e.houseTemp;
    mm.min = mm.min == null ? t : Math.min(mm.min, t);
    mm.max = mm.max == null ? t : Math.max(mm.max, t);
    histAcc += s;
    if (histAcc >= 600) { histAcc = 0; hist.push({ t: e.day, house: t, sp: e.heaterSetpoint }); while (hist.length && hist[0].t < e.day - 1.05) hist.shift(); }
  });
  events.on(EV.ACTION, (p) => {
    if (mode !== 'level') return;
    if (p.id === 'water.flowtest' && p.result) lastFlows[p.line] = { mlMin: p.result.mlMin, hour: env.hour };
    if (p.id === 'sample.weigh') {
      if (weigh.day !== env.dayNumber) weigh = { day: env.dayNumber, list: [] };
      weigh.list.push({ w: p.result?.weightG, x: p.x ?? 0, z: p.z ?? 0 });
    }
    if (p.id === 'chicks.tip' && p.result && typeof p.result === 'object') {
      const dead = p.result.deadInBoxes || 0;
      caption.show(`${int(p.result.placed ?? p.chicks)} chicks out on the litter.${dead ? ` ${int(dead)} dead in these boxes.` : ''}`);
    }
    if (p.id === 'dead.count') caption.show(`${int(p.n)} dead bird${p.n === 1 ? '' : 's'} counted at the bin.`);
  });
  // a look note is soft (PHASE4.md §15: the slower clock makes listen stops land beside actions): the next caption, the
  // result of what the farmer just did, replaces it at once (the notebook keeps the note)
  events.on(EV.LISTEN, (p) => { if (mode === 'level') caption.show(lookCaption(farm.observe(p.x, p.z), env.dayNumber >= 8 ? 'birds' : 'chicks'), 6, { soft: true }); });
  events.on(EV.POWER, (p) => { if (mode === 'level' && p && p.on === false) raiseAlarm(p.mains === false && p.source == null ? ALARM['power-cut'] : 'The power is off in house 1.'); });
  events.on(EV.FARM_PROBLEM, (p) => { if (mode === 'level' && p && p.phase === 'symptom' && p.alarm) raiseAlarm(ALARM[p.id] || 'The controller’s alarm sounds.'); });
  events.on(EV.FARM_DELIVERY, (p) => { if (mode === 'level' && p.kind === 'feed' && p.phase === 'arrive') caption.show('The feed truck is filling the silos.'); });
  events.on(EV.SKILL_POINTS, (p) => { if (p.detail) details.set(p.milestone, p.detail); });
  // PHASE4.md §15.3: the bucket set down (by G or by a two-handed task), picked up, a dead bird into the bucket on the floor
  events.on(EV.BUCKET, (p) => {
    if (mode !== 'level' || !p) return;
    const n = (x) => `${int(x)} dead bird${x === 1 ? '' : 's'}`;
    const now = { now: true };
    if (p.into) caption.show(`Dead bird into the bucket you set down (${n(p.n)} in it).`, 4.5, now);
    else if (p.down) {
      caption.show(p.auto ? `Bucket set down here (${n(p.n)}): both hands for this job. E picks it up again.` : `Bucket set down here (${n(p.n)}). E picks it up again.`, 4.5, now);
      // a two-handed job opens its panel at once: the same notice at the top of that panel
      if (p.auto) panelNotice(`Bucket set down at your feet (${n(p.n)}): both hands for this job. E picks it up again there.`);
    }
    else caption.show(`Bucket picked up (${n(p.n)}). Count them into the bin by the door.`, 4.5, now);
  });
  // PHASE4.md §15.2: the soft cue of a job 30 farm minutes from its close (the card's chip pulses; a quiet click sounds)
  events.on(EV.JOB_SOON, (p) => {
    if (mode !== 'level') return;
    const inst = ctx.level?.engine?.byKey?.(p.key);
    if (!inst) return;
    const at = p.closesAt != null ? ` (${clockText(p.closesAt)})` : '';
    const more = (p.keys?.length || 1) - 1, m = Math.max(1, Math.round((p.closesAt - env.day) * 1440));
    caption.show(more > 0 ? `${inst.def.title} and ${more} more job${more === 1 ? '' : 's'}: close in ${m} farm minutes${at}.` : `${inst.def.title}: closes in ${m} farm minutes${at}.`, 5, { ifFree: true });
  });
  // a bird in the hand: from day 8 the bird check (panels' bird-check), in week 1 Phase 2's chick in hand
  events.on(EV.BIRD_PICK, (p) => {
    if (mode !== 'level') return;
    const id = env.dayNumber >= 8 && panels.has('bird-check') ? 'bird-check' : 'chick-in-hand';
    if (openPanel(id)) panels.openPanel?.take?.(p);
  });
  // something new on the office desk (the farm: contract, reply, vet, lab)
  events.on(EV.LETTER, (p) => {
    if (mode !== 'level') return;
    L.letters.push({ kind: p.kind, day: p.day ?? env.dayNumber, hour: Math.round(env.hour * 100) / 100, text: p.text ?? null });
    caption.show(p.kind === 'lab' ? 'The lab’s letter lies on the office desk.' : p.kind === 'vet' ? 'The vet’s letter lies on the office desk.' : 'A letter lies on the office desk.');
  });
  events.on(EV.FRAME_SET, (p) => {
    if (mode !== 'level') return;
    if (openPanel('weigh')) panels.openPanel?.take?.(p);
  });

  // ---- panels: Phase 1 ids keep their sandbox panels; a level builds its own ----
  const lvl = (build, sandboxBuild) => () => (mode === 'sandbox' && sandboxBuild ? sandboxBuild() : build());
  for (const id of Object.keys(SIGNS)) panels.register(id, lvl(() => buildBoardPanel(id, env, closePanel), () => buildSignPanel(id, env, closePanel)), { kind: 'sign' });
  for (const id of Object.keys(BOARDS)) if (id.startsWith('sign-') && !SIGNS[id]) panels.register(id, () => buildBoardPanel(id, env, closePanel), { kind: 'sign' });
  // Phase 3 boards (scene paints them at SPOTS3; the panel reads the merged boards of the day)
  for (const id of Object.keys(BOARDS_CYCLE)) if (id.startsWith('sign-')) panels.register(id, () => buildBoardPanel(id, env, closePanel), { kind: 'sign' });
  // Phase 4 boards (the scene paints sign-power by the generator in the rainy season; the panel reads the day's merge)
  for (const id of Object.keys(BOARDS_COND)) if (id.startsWith('sign-') && !BOARDS[id] && !BOARDS_CYCLE[id]) panels.register(id, () => buildBoardPanel(id, env, closePanel), { kind: 'sign' });
  panels.register('controller', lvl(() => buildLevelControllerPanel(L), () => buildControllerPanel(env, { onClose: closePanel, onSetpoint: () => tasks.notify('setpoint') })));
  panels.register('feeder-box', () => buildFeederPanel(L));
  // the job strip (ui-jobstrip.js): the open job done at a machine shows at the top of its panel
  const js = (id, build) => withJobStrip(L, id, build);
  panels.register('silo', js('silo', () => buildSiloPanel(L)));
  panels.register('litter-heap', js('litter-heap', () => buildHeapPanel(L)));
  panels.register('bird-scale', js('bird-scale', () => buildBirdScalePanel(L)));
  panels.register('water-supply', js('water-supply', () => buildWaterSupplyPanel(L)));
  for (let i = 0; i < 4; i++) panels.register(`drinker-${i}`, js(`drinker-${i}`, () => buildDrinkerPanel(L, i)));
  panels.register('chick-table', js('chick-table', () => buildGradingPanel(L)));
  panels.register('chick-in-hand', js('chick-in-hand', () => buildChickInHandPanel(L)));
  panels.register('weigh', js('weigh', () => buildWeighPanel(L)));
  panels.register('office-desk', () => buildRecordsPanel(L), { kind: 'paused' });
  panels.register('notebook', () => buildNotebookPanel(L), { kind: 'paused' });
  panels.register('skilltree', () => buildSkillTreePanel(L), { kind: 'paused' });
  panels.register('result', () => buildResultPanel(L), { kind: 'paused' });
  panels.register('summary', () => buildSummaryPanel(L), { kind: 'paused' });
  // Phase 3 panels (package "panels"; placeholders until it builds them)
  try {
    setPlateDay(() => env.dayNumber);
    setPlateCondition(() => farm?.condition ?? null); // Phase 4: the run's condition (PHASE4.md §3.2)
    registerCyclePanels({
      register: (id, build, opts) => panels.register(id, build, opts),
      L, boards: (id) => boardsForDay(env.dayNumber, farm?.condition ?? null)[id] || null, sourceLabel,
      plate: (id, opts) => buildPlate(id, opts), openPanel: (id) => openPanel(id),
    });
  } catch (err) { console.error('Phase 3 panels failed to register', err); }
  // Phase 4 panels (package "panels"; PHASE4.md §12.3), the same api
  try {
    registerCondPanels({
      // the condition jobs' strips (job-strips-cond.js) at the top of each panel's working plate (a panel that mounts its
      // own .jstrip keeps it: withJobStrip leaves it alone)
      register: (id, build, opts) => panels.register(id, withJobStrip(L, id, build), opts),
      L, boards: (id) => boardsForDay(env.dayNumber, farm?.condition ?? null)[id] || null, sourceLabel,
      plate: (id, opts) => buildPlate(id, opts), openPanel: (id) => openPanel(id),
    });
  } catch (err) { console.error('Phase 4 panels failed to register', err); }

  // ---- title card and the job card ----
  const title = createTitle(root, {
    onStart: () => (ctx.run ? ctx.run.startRun({ seed: 1 }) : ctx.level?.start({ seed: 1 })),
    onStartBrooding: () => (ctx.run ? ctx.run.startRun({ seed: 1, at: 'level1' }) : ctx.level?.start({ seed: 1 })),
    onContinue: () => (ctx.run ? ctx.run.continueSave() : ctx.level?.continueSave()),
    onSandbox: () => ctx.level?.toSandbox(),
    onSkills: () => openPanel('skilltree'),
    onReplay: (id, day) => replayLevel(id, day),
    onStandard: (id, cond) => standardLevel(id, cond),
    onStartCondition: (id) => startCondition(id),
    saveInfo: () => (ctx.run ? ctx.run.info() : deps.save?.info?.() ?? null),
    saveAvailable: () => (ctx.run ? !!ctx.run.available : !!deps.save?.available),
    run: () => ctx.run ?? null,
  });
  const jobCard = createJobCard(trL, ctx, L, {
    root, avoid,
    onNext: () => ctx.level?.nextJob(),
    onNotebook: () => togglePanel('notebook'),
    onSkills: () => togglePanel('skilltree'),
    nextLabel: () => ctx.level?.nextLabel?.() ?? 'Next job',
  });
  nextBar.addEventListener('click', () => ctx.level?.nextJob());
  const deadMarks = createDeadMarks(ctx, root, { avoid, jobPointer: () => jobCard.pointerEl });
  const watchCard = createWatchCard(root, ctx);
  // PHASE4.md §15.1: the flock watch's early warning as a caption (the notebook line comes from the watch itself)
  events.on(EV.WATCH, (p) => {
    if (mode !== 'level' || !p?.text) return;
    // a panel open: the warning at the top of the panel now, its caption when the panel closes (review round)
    if (panels.openId) { panelNotice(`Flock watch: ${p.text}`); queuedWatch = p.text; } else caption.show(p.text, 9, { soft: true });
  });
  const togglePanel = (id) => { if (panels.openId === id) closePanel(); else openPanel(id); };

  // ---- E, Q, T ----
  const accept = (it) => !!it.use || panels.has(it.id);
  // PHASE4.md §15.3 (d): while a job needs birds in the hand, E never picks up a dead bird or the bucket (Shift+E does)
  const DEAD_IDS = new Set(['dead-bird', 'bucket']);
  const chickJob = () => (mode === 'level' ? ctx.level?.chickJob ?? null : null);
  const acceptE = (it) => accept(it) && !(DEAD_IDS.has(it.id) && chickJob());
  const deadTarget = () => (mode === 'level' && interact ? interact.nearest(player, (it) => DEAD_IDS.has(it.id) && accept(it)) : null);
  function nearestTarget() {
    if (mode === 'sandbox') {
      // Phase 1: the nearest board within reach on the farmer's side of the wall
      const p = player.position;
      let best = null, bestD = Infinity;
      for (const it of interactables) {
        if (!P1_IDS.has(it.id) || !panels.has(it.id)) continue;
        if (it.inside != null && it.inside !== !!player.isInside) continue;
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d <= it.radius && d < bestD) { bestD = d; best = it; }
      }
      return best;
    }
    if (mode !== 'level') return null;
    return interact ? interact.nearest(player, acceptE) : null;
  }
  /** The prompt's extra pills: Shift+E for the dead bird (or the bucket) in a chick job; G while carrying the bucket. */
  function promptAlts() {
    if (mode !== 'level') return [];
    const out = [];
    if (chickJob()) {
      const d = deadTarget();
      if (d) out.push({ key: 'Shift+E', text: d.id === 'bucket' ? 'Pick up the bucket' : 'Pick up the dead bird', act: () => useTarget(d) });
    }
    if (props?.carrying === 'bucket') out.push({ key: 'G', text: 'Set the bucket down', act: () => setBucketDown() });
    return out;
  }
  function setBucketDown() {
    if (props?.carrying !== 'bucket') { if (props?.bucketDown) caption.show('The bucket stands where you set it down: E picks it up there.'); return false; }
    return props.setBucketDown({ auto: false });
  }
  function useTarget(t) {
    if (!t) return;
    if (t.use && mode === 'level') { try { t.use(); } catch (err) { console.error('use failed', err); } return; }
    openPanel(t.id);
  }
  function squeeze() {
    const p = player.position;
    if (!player.isInside && !inHouse(p)) { caption.show('Squeeze the litter inside the house.'); return; }
    player.pose?.('crouch', 1);
    const r = farm.act('litter.squeeze', { x: p.x, z: p.z }) || {};
    caption.show(`Litter here: ${int(r.moisturePct)} % · ${feelWords(r.feel)}.`);
  }
  function probe() {
    const p = player.position;
    if (!player.isInside && !inHouse(p)) { caption.show('The floor thermometer is for the house floor.'); return; }
    player.pose?.('crouch', 1);
    const r = farm.act('floor.probe', { x: p.x, z: p.z }) || {};
    events.emit(EV.PROBE, { kind: 'floor', x: p.x, z: p.z, value: r.tempC });
    floatRead.show(`Floor ${one(r.tempC)} °C`);
    // the brooder sign's figure beside the reading (the clarity round): the farmer compares
    if (env.dayNumber <= 0) caption.show(`Floor ${one(r.tempC)} °C · brooder sign: 28–30 °C before the chicks arrive. A cold floor: raise the brooder thermostat (pre-heat).`);
  }
  // L: the light meter at bird level (lux at your feet); V: the air meter at bird height (PHASE3.md §6.12)
  function luxMeter() {
    const p = player.position;
    if (!player.isInside && !inHouse(p)) { caption.show('The light meter is for the light at bird level inside the house.'); return; }
    player.pose?.('reach', 2);
    const r = farm.act('light.lux', { x: p.x, z: p.z }) || {};
    floatRead.show(r.lux != null ? `${int(r.lux)} lux` : 'Light meter');
    if (r.lux != null) caption.show(`Light ${int(r.lux)} lux at bird level · ${env.dayNumber >= 8 ? 'light sign: about 20 lux from week 2' : 'light plate: 30–40 lux at chick level in the first week'}.`);
  }
  function airMeter() {
    const p = player.position;
    if (!player.isInside && !inHouse(p)) { caption.show('The air meter is for the air at bird height inside the house.'); return; }
    player.pose?.('reach', 2);
    const r = farm.act('air.probe', { x: p.x, z: p.z }) || {};
    floatRead.show(r.speedMs != null ? `${one(r.speedMs)} m/s · ${one(r.tempC)} °C · ${int(r.rh)} %` : 'Air meter');
    if (r.speedMs != null) caption.show(`Air ${one(r.speedMs)} m/s at bird height with ${env.fansEffective ?? 0} tunnel fans · heat sign: all six fans about 2.5 m/s, each fan about 0.4 m/s.`);
  }
  // C / M: the views that come with a branch level (one floor overlay at a time)
  function toggleView(key) {
    if (key === 'comfort') {
      if (!skills?.unlocked?.('comfortOverlay')) { caption.show('The comfort view comes with Body Temperature & Comfort level 1 on the skill tree.'); return; }
      views.comfort = !views.comfort;
      flock?.setOverlay?.('comfort', views.comfort);
      return;
    }
    if (!skills?.unlocked?.('moistureOverlay')) { caption.show('The litter moisture view comes with Moisture & Minimum Ventilation level 1 on the skill tree.'); return; }
    const on = !props?.overlay?.moisture;
    if (on && props?.overlay?.floorTemp) props.setOverlay?.('floorTemp', false);
    props?.setOverlay?.('moisture', on);
  }

  function reset() {
    panels.close(false);
    env.reset();
    player.teleport(FARM.spawnSandbox.x, FARM.spawnSandbox.z, FARM.spawnSandbox.yaw);
    tasks.reset();
    hud.refresh();
  }

  // Capture phase on window, so this runs before the farmer's own key listeners.
  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (narrow.open) return;
    if (panels.openId) {
      if (MOVE_CODES.has(e.code) || MOVE_KEYS.has(k)) e.stopImmediatePropagation(); // typed WASD must not walk the farmer
      if (k === 'escape') { e.preventDefault(); if (panels.openId !== 'result') panels.close(); }
      else if (isKeyE(e, k) && !e.repeat && !typingInControl(e.target) && panels.openId !== 'result') { e.preventDefault(); panels.close(); }
      else if (mode === 'level' && !e.repeat && isCode(e, k, 'KeyN', 'n') && panels.openId === 'notebook') { e.preventDefault(); panels.close(); }
      else if (mode !== 'sandbox' && !e.repeat && isCode(e, k, 'KeyK', 'k') && panels.openId === 'skilltree') { e.preventDefault(); panels.close(); }
      return;
    }
    if (title.open) return;
    if (inFormControl(e.target) && (ARROW_KEYS.has(k) || (e.code || '').startsWith('Arrow'))) { e.stopImmediatePropagation(); return; }
    if (typingInControl(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isKeyE(e, k) && !e.repeat) {
      // Shift+E in a level: the dead bird (or the bucket) when a chick job keeps them off E
      const target = e.shiftKey && mode === 'level' && chickJob() ? deadTarget() : nearestTarget();
      if (target) { e.preventDefault(); useTarget(target); }
    } else if (mode === 'level' && !e.repeat && isCode(e, k, 'KeyG', 'g')) {
      e.preventDefault(); setBucketDown();
    } else if (isKeyHelp(e, k) && !e.repeat) {
      helpAuto = false;
      (mode === 'sandbox' ? help : lhelp).toggle();
    } else if (k === 'escape' && (mode === 'sandbox' ? help : lhelp).visible) {
      (mode === 'sandbox' ? help : lhelp).hide();
    } else if (mode === 'level' && !e.repeat) {
      if (isCode(e, k, 'KeyQ', 'q')) { e.preventDefault(); squeeze(); }
      else if (isCode(e, k, 'KeyT', 't')) { e.preventDefault(); probe(); }
      else if (isCode(e, k, 'KeyN', 'n')) { e.preventDefault(); openPanel('notebook'); }
      else if (isCode(e, k, 'KeyK', 'k')) { e.preventDefault(); openPanel('skilltree'); }
      else if (isCode(e, k, 'KeyF', 'f') && skills?.unlocked?.('floorOverlay')) { e.preventDefault(); const on = !props.overlay?.floorTemp; if (on && props.overlay?.moisture) props.setOverlay?.('moisture', false); props?.setOverlay?.('floorTemp', on); }
      else if (isCode(e, k, 'KeyL', 'l')) { e.preventDefault(); luxMeter(); }
      else if (isCode(e, k, 'KeyV', 'v')) { e.preventDefault(); airMeter(); }
      else if (isCode(e, k, 'KeyC', 'c')) { e.preventDefault(); toggleView('comfort'); }
      else if (isCode(e, k, 'KeyM', 'm')) { e.preventDefault(); toggleView('moisture'); }
    }
  }, true);

  // ---- modes ----
  function setMode(m) {
    if (m === mode && m !== 'title') return;
    const was = mode;
    mode = m;
    if ((was === 'sandbox') !== (m === 'sandbox')) panels.clearBuilt();
    if (m !== 'level') panels.dropBackground();
    const lv = m !== 'sandbox';
    tr.hidden = lv; br.hidden = lv;
    trL.hidden = m !== 'level' && m !== 'result';
    help.toggleBtn.hidden = lv; lhelp.toggleBtn.hidden = !lv;
    if (lv) help.hide(); else lhelp.hide();
    nextBar.hidden = m !== 'level';
    hud.setLevel(lv ? ctx.level?.hudHooks ?? null : null);
    root.classList.toggle('is-level', lv);
    root.classList.toggle('is-title', m === 'title');
    if (m === 'title') { panels.close(false); title.show(); } else title.hide();
    if (m !== 'level' && m !== 'result') jobCard.hide();
    if (m !== 'level') { alarm.hidden = true; alarmT = 0; }
    if (m === 'sandbox') tasks.reset();
  }
  /** A new run of the level (start, replay, continue): no panel, chart, reading or sample of the
   *  run before carries over (level.start / level.resume call it). */
  function newRun() {
    panels.close(false);
    panels.clearBuilt();
    clearFarmTimeNotes();
    jobCard.reset(); caption.clear();
    L.letters.length = 0; L.lettersRead.clear();
    if (views.comfort) { views.comfort = false; flock?.setOverlay?.('comfort', false); }
    mm.min = mm.max = null; hist.length = 0; histAcc = 0; lastFlows.length = 0; weigh = { day: null, list: [] };
    alarmMsg = ''; alarmT = 0; alarm.hidden = true;
  }

  let hudAcc = 0, fitAcc = 0;
  // review round: the left column stacks under the real bottom of the clock and gauge row (it wraps under the longer
  // condition labels at 960 px): the alarm banner under the gauges, the flock watch card under both
  const tlEl = root.querySelector('.hud-tl');
  function layoutLeft() {
    if (!tlEl) return;
    const top = root.getBoundingClientRect().top;
    let y = tlEl.getBoundingClientRect().bottom - top;
    if (window.innerWidth < 700) alarm.style.top = '';
    else if (!alarm.hidden) { alarm.style.top = `${Math.round(y + 8)}px`; y = alarm.getBoundingClientRect().bottom - top; }
    watchCard.setTop(Math.round(y + 8));
  }
  return {
    update(dt) {
      rt += dt;
      hudAcc -= dt;
      const tick = hudAcc <= 0;
      hud.refresh(tick);
      if (tick && mode !== 'sandbox') layoutLeft();
      if (pnoteFor && pnoteFor !== panels.openId) { pnote.hidden = true; pnoteFor = null; }
      if (tick) { hudAcc = 0.1; if (mode === 'sandbox' && tools.open && (fitAcc = (fitAcc + 1) % 5) === 0) fitTools(); }
      if (mode === 'sandbox') {
        deadMarks.hide(); watchCard.hide();
        tasks.update(dt, panels.openId);
        if (helpAuto && tasks.index >= 1) { helpAuto = false; if (help.visible) help.hide(); }
        tools.update(dt);
      } else {
        // the sandbox marker stays hidden in a level
        if (p1Marker) p1Marker.visible = false;
        if (p1Pointer) p1Pointer.hidden = true;
        if (mode === 'level' || mode === 'result') jobCard.update(dt, !!panels.openId);
        if (mode === 'level') refreshNextBar(dt);
        deadMarks.update(dt, mode === 'level' && farm?.mode === 'level', !!panels.openId || busy.open);
        watchCard.update(dt, (mode === 'level' || mode === 'result') && farm?.mode === 'level');
      }
      panels.update(dt);
      tickFarmTimeNotes();
      floorLegend.hidden = !(mode === 'level' && props?.overlay?.floorTemp);
      comfortLegend.hidden = !(mode === 'level' && views.comfort);
      if (!comfortLegend.hidden) syncComfortSub();
      moistureLegend.hidden = !(mode === 'level' && props?.overlay?.moisture);
      caption.update(dt);
      floatRead.update(dt);
      // the alarm banner: while the house is dark, and a while after an alarm symptom
      const dark = mode === 'level' && farm?.power && farm.power.on === false;
      // review round: a reload (Continue, the hot reload) inside a cut brings the banner back (its event came before the save)
      if (dark && !alarmMsg) alarmMsg = farm.power.mains === false ? ALARM['power-cut'] : ALARM['gen-dry'];
      alarmT = Math.max(0, alarmT - dt);
      const show = mode === 'level' && (dark || alarmT > 0) && !!alarmMsg;
      if (alarm.hidden === show) alarm.hidden = !show;
      if (show) setText(alarmText, `${alarmMsg}${dark ? ' The farm clock runs slower while the house is dark (every farm minute counts); Next job does not skip.' : ''}${ctx.level?.skipStopped && Math.abs(ctx.level.skipStopped.at - env.day) < 2 / 1440 ? ' The Next job skip stopped here.' : ''}`);
      { const off = panels.openId || narrow.open || title.open || busy.open; prompt.show(off ? null : nearestTarget(), off ? [] : promptAlts()); }
    },
    // hooks for level.js, the integrator and tests
    busy,
    openPanel,
    closePanel,
    get openPanelId() { return panels.openId; },
    /** Panels finishing a machine job in the background (closed with a flow test running, …). */
    get backgroundPanels() { return panels.backgroundCount; },
    backgroundPanelIds: () => panels.backgroundIds?.() || [],
    /** 'sign' | 'paused' | 'panel' | null: the open panel's clock class (PHASE2.md §2). */
    get panelKind() { return title.open ? 'paused' : panels.openKind; },
    get taskIndex() { return tasks.index; },
    get mode() { return mode; },
    setMode,
    newRun,
    showResult(res) { if (openPanel('result')) panels.openPanel?.show?.(res); },
    showSummary(sum) { if (openPanel('summary')) panels.openPanel?.show?.(sum); },
    luxMeter,
    airMeter,
    toggleView,
    replayLevel,
    caption: (msg, s) => caption.show(msg, s),
    /** PHASE4.md §15.3: the keys of the prompt's extra pills now ('Shift+E', 'G'), for the harness. */
    get promptAlts() { return prompt.alts; },
    get promptId() { return prompt.id; },
    /** PHASE4.md §15.4: the dead-bird chip, the bucket's chip and the markers shown now. */
    deadMarks: () => deadMarks.state(),
    clearCaptions: () => caption.clear(),
    jobCard,
    squeeze,
    probe,
    reset,
    L,
  };
}
