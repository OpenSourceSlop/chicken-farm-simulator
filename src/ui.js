// HUD, panels and keys. Owner: package "level" (Phase 1: systems/UI agent).
// createUI(ctx, deps) -> ui. Owns all DOM inside #hud. Two modes share the clock, gauges and the
// panel host:
//   sandbox  the Phase 1 farm exactly as before: four tutorial jobs, Phase 1 boards and controller,
//            test tools, Skip 1 hour / Next morning
//   level    Level 1 (PHASE2.md): the job card, Next job, the boards and plates of content-signs.js,
//            every equipment and inspection panel, records, notebook, skill tree, result; E through
//            ctx.interact.nearest(), Q squeeze, T floor thermometer, N notebook, K skill tree, F floor view
// plus the title card (level.js decides the mode and calls setMode).
import { FARM, HOUSE_BOUNDS } from './config.js';
import { SIGNS, LEVEL_HELP_KEYS, lookCaption } from './content.js';
import { BOARDS } from './content-signs.js';
import { EV } from './events.js';
import { h, button, inFormControl, typingInControl } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { createHud } from './ui-hud.js';
import { createTasks } from './ui-tasks.js';
import { createPanelHost, buildSignPanel } from './ui-panels.js';
import { buildControllerPanel } from './ui-controller.js';
import { createTestTools } from './ui-testtools.js';
import { createHelp, createNarrowNotice, createPrompt } from './ui-help.js';
import { buildBoardPanel } from './ui-boards.js';
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
import { int, one, feelWords } from './ui-format.js';
import { broodSector, FLOOR_TEMP_RAMP } from './config.js';
// Phase 3 (PHASE3.md §13.8): the panels package registers its panels here
import { registerCyclePanels } from './ui-cycle-panels.js';
import { boardsForDay } from './content-signs-cycle.js';
import { sourceLabel } from './content-signs.js';

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
const ARROW_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const isKeyE = (e, k) => e.code === 'KeyE' || k === 'e';
const isKeyHelp = (e, k) => e.code === 'KeyH' || k === 'h' || k === '?' || (e.code === 'Slash' && e.shiftKey);
const isCode = (e, k, code, letter) => e.code === code || (!e.code && k === letter);
const P1_IDS = new Set(['sign-gate', 'controller', 'sign-brooder']); // what E reaches in the sandbox
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
  const avoid = () => [tr, trL, root.querySelector('.hud-tl'), root.querySelector('.hud-bl'), root.querySelector('.hud-br'),
    root.querySelector('.hud-bc .prompt'), root.querySelector('.caption')].filter((e) => e && !e.hidden);
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
      if (mode !== 'sandbox') {
        events.emit(EV.PANEL_OPEN, { id });
        if (BOARDS[id] && id.startsWith('sign-')) uiAct('sign.read', { board: id });
      }
    },
    onClose: () => {
      root.classList.remove('has-panel');
      if (mode !== 'sandbox' && lastOpen) events.emit(EV.PANEL_CLOSE, { id: lastOpen });
    },
  });
  let lastOpen = null;
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
  const floatRead = createFloatLabel(root, ctx);
  const narrow = createNarrowNotice(root);

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
      const l = weigh.day === env.dayNumber ? weigh.list : [];
      const ok = l.filter((x) => Number.isFinite(x.w));
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
  };
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
      weigh.list.push({ w: p.result?.weightG, s: broodSector(p.x ?? 0, p.z ?? 0) });
    }
    if (p.id === 'chicks.tip' && p.result && typeof p.result === 'object') {
      const dead = p.result.deadInBoxes || 0;
      caption.show(`${int(p.result.placed ?? p.chicks)} chicks out on the litter.${dead ? ` ${int(dead)} dead in these boxes.` : ''}`);
    }
    if (p.id === 'dead.count') caption.show(`${int(p.n)} dead bird${p.n === 1 ? '' : 's'} counted at the bin.`);
  });
  events.on(EV.LISTEN, (p) => { if (mode === 'level') caption.show(lookCaption(farm.observe(p.x, p.z)), 6); });
  events.on(EV.FARM_DELIVERY, (p) => { if (mode === 'level' && p.kind === 'feed' && p.phase === 'arrive') caption.show('The feed truck is filling the silos.'); });
  events.on(EV.SKILL_POINTS, (p) => { if (p.detail) details.set(p.milestone, p.detail); });
  events.on(EV.BIRD_PICK, (p) => {
    if (mode !== 'level') return;
    if (openPanel('chick-in-hand')) panels.openPanel?.take?.(p);
  });
  events.on(EV.FRAME_SET, (p) => {
    if (mode !== 'level') return;
    if (openPanel('weigh')) panels.openPanel?.take?.(p);
  });

  // ---- panels: Phase 1 ids keep their sandbox panels; a level builds its own ----
  const lvl = (build, sandboxBuild) => () => (mode === 'sandbox' && sandboxBuild ? sandboxBuild() : build());
  for (const id of Object.keys(SIGNS)) panels.register(id, lvl(() => buildBoardPanel(id, env, closePanel), () => buildSignPanel(id, env, closePanel)), { kind: 'sign' });
  for (const id of Object.keys(BOARDS)) if (id.startsWith('sign-') && !SIGNS[id]) panels.register(id, () => buildBoardPanel(id, env, closePanel), { kind: 'sign' });
  panels.register('controller', lvl(() => buildLevelControllerPanel(L), () => buildControllerPanel(env, { onClose: closePanel, onSetpoint: () => tasks.notify('setpoint') })));
  panels.register('feeder-box', () => buildFeederPanel(L));
  panels.register('silo', () => buildSiloPanel(L));
  panels.register('litter-heap', () => buildHeapPanel(L));
  panels.register('bird-scale', () => buildBirdScalePanel(L));
  panels.register('water-supply', () => buildWaterSupplyPanel(L));
  for (let i = 0; i < 4; i++) panels.register(`drinker-${i}`, () => buildDrinkerPanel(L, i));
  panels.register('chick-table', () => buildGradingPanel(L));
  panels.register('chick-in-hand', () => buildChickInHandPanel(L));
  panels.register('weigh', () => buildWeighPanel(L));
  panels.register('office-desk', () => buildRecordsPanel(L), { kind: 'paused' });
  panels.register('notebook', () => buildNotebookPanel(L), { kind: 'paused' });
  panels.register('skilltree', () => buildSkillTreePanel(L), { kind: 'paused' });
  panels.register('result', () => buildResultPanel(L), { kind: 'paused' });
  // Phase 3 panels (package "panels"; placeholders until it builds them)
  try {
    registerCyclePanels({
      register: (id, build, opts) => panels.register(id, build, opts),
      L, boards: (id) => boardsForDay(env.dayNumber)[id] || null, sourceLabel,
    });
  } catch (err) { console.error('Phase 3 panels failed to register', err); }

  // ---- title card and the job card ----
  const title = createTitle(root, {
    onStart: () => ctx.level?.start({ seed: 1 }),
    onContinue: () => ctx.level?.continueSave(),
    onSandbox: () => ctx.level?.toSandbox(),
    onSkills: () => openPanel('skilltree'),
    saveInfo: () => deps.save?.info?.() ?? null,
    saveAvailable: () => !!deps.save?.available,
  });
  const jobCard = createJobCard(trL, ctx, L, {
    root, avoid,
    onNext: () => ctx.level?.nextJob(),
    onNotebook: () => togglePanel('notebook'),
    onSkills: () => togglePanel('skilltree'),
    nextLabel: () => ctx.level?.nextLabel?.() ?? 'Next job',
  });
  nextBar.addEventListener('click', () => ctx.level?.nextJob());
  const togglePanel = (id) => { if (panels.openId === id) closePanel(); else openPanel(id); };

  // ---- E, Q, T ----
  const accept = (it) => !!it.use || panels.has(it.id);
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
    return interact ? interact.nearest(player, accept) : null;
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
      const target = nearestTarget();
      if (target) { e.preventDefault(); useTarget(target); }
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
      else if (isCode(e, k, 'KeyF', 'f') && skills?.unlocked?.('floorOverlay')) { e.preventDefault(); props?.setOverlay?.('floorTemp', !props.overlay?.floorTemp); }
    }
  }, true);

  // ---- modes ----
  function setMode(m) {
    if (m === mode && m !== 'title') return;
    const was = mode;
    mode = m;
    if ((was === 'sandbox') !== (m === 'sandbox')) panels.clearBuilt();
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
    if (m === 'sandbox') tasks.reset();
  }
  /** A new run of the level (start, replay, continue): no panel, chart, reading or sample of the
   *  run before carries over (level.start / level.resume call it). */
  function newRun() {
    panels.close(false);
    panels.clearBuilt();
    jobCard.reset(); caption.clear();
    mm.min = mm.max = null; hist.length = 0; histAcc = 0; lastFlows.length = 0; weigh = { day: null, list: [] };
  }

  let hudAcc = 0, fitAcc = 0;
  return {
    update(dt) {
      hudAcc -= dt;
      const tick = hudAcc <= 0;
      hud.refresh(tick);
      if (tick) { hudAcc = 0.1; if (mode === 'sandbox' && tools.open && (fitAcc = (fitAcc + 1) % 5) === 0) fitTools(); }
      if (mode === 'sandbox') {
        tasks.update(dt, panels.openId);
        if (helpAuto && tasks.index >= 1) { helpAuto = false; if (help.visible) help.hide(); }
        tools.update(dt);
      } else {
        // the sandbox marker stays hidden in a level
        if (p1Marker) p1Marker.visible = false;
        if (p1Pointer) p1Pointer.hidden = true;
        if (mode === 'level' || mode === 'result') jobCard.update(dt, !!panels.openId);
        if (mode === 'level') refreshNextBar(dt);
      }
      panels.update(dt);
      floorLegend.hidden = !(mode === 'level' && props?.overlay?.floorTemp);
      caption.update(dt);
      floatRead.update(dt);
      prompt.show(panels.openId || narrow.open || title.open ? null : nearestTarget());
    },
    // hooks for level.js, the integrator and tests
    openPanel,
    closePanel,
    get openPanelId() { return panels.openId; },
    /** 'sign' | 'paused' | 'panel' | null: the open panel's clock class (PHASE2.md §2). */
    get panelKind() { return title.open ? 'paused' : panels.openKind; },
    get taskIndex() { return tasks.index; },
    get mode() { return mode; },
    setMode,
    newRun,
    showResult(res) { if (openPanel('result')) panels.openPanel?.show?.(res); },
    caption: (msg, s) => caption.show(msg, s),
    jobCard,
    squeeze,
    probe,
    reset,
    L,
  };
}
