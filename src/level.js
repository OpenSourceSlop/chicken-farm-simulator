// Level flow: title card (start / continue / sandbox), the job engine over the day's rounds,
// "Next job" time skips, the clock speeds of the level, day changes, checkpoints for the skill
// tree, the level result (pass or replay) and autosave. Owner: package "level" (phase2/level).
//
// createLevel(ctx, deps) -> level
//   deps = { farm, records, skills, save, player, flock, props, ui, interact, events }
//   mode            'sandbox' (Phase 1 farm, Phase 1 tasks and test tools) | 'title' | 'level' | 'result'
//   boot()          called once by main.js after the first frame is ready: shows the title card
//                   in a real browser; under automation (navigator.webdriver) stays in the sandbox
//                   so the Phase 1 harness scenarios keep working
//   start({ seed })     fresh Level 1 from the prep day (clears the level save, keeps the profile)
//   resume(data)        continue from a save (save.load()) or a hot-reload blob; continueSave()
//   toSandbox(), toTitle(), replay(), keepWalking()
//   update(dt)          every frame after the ui (real seconds): job engine, clock speed, autosave
//   nextJob()           the "Next job" button: point at the next open job, or skip the clock to
//                       when the next job opens (a second press within 3 s skips anyway; jobs whose
//                       window passes are missed)
//   jobs                { list(), open(), current(), complete(key) (debug), byKey(key) }
//   engine              the job engine itself (job-engine.js)
//   serialize()         JSON-safe state of the level itself (jobs, anchors, checkpoints, points)
//   saveBlob()          the whole save object of PHASE2.md §11 ({ level, env, farm, records, props,
//                       flock, player }); autosave and the artifact hot reload both use it, and
//                       resume(blob) takes it back
//   checkpoint events   EV.LEVEL { phase: 'checkpoint', name } for 'placed' (last stack tipped),
//                       'vent' / 'crop' (their windows closed), 'weighin', 'level-end'; skills.js
//                       listens (the level never calls skills.evaluate itself)
//   sampling            null | 'vent' | 'crop' | 'weigh' (catching chicks is possible only then)
//   hudHooks            what the HUD's pause / 1x / 4x buttons call in a level
//   debug               { goto(day, hour, { auto }), trigger(problemId), result(forcePass?) }
//
// JobInstance: { key, id, def, day, status: 'waiting'|'open'|'done'|'missed', opensAt, closesAt,
//   doneAt, progress (0..1), result }  (times as env.day floats)
import { FARM, LEVEL1 } from './config.js';
import { EV } from './events.js';
import { createJobEngine, LEVEL_END_DAY } from './job-engine.js';
import { applyRound } from './farm-profiles.js';
import { MILESTONES } from './skills.js';
import { hhmm, splitDay, two } from './ui-format.js';

const H = 1 / 24;
const CARRY_KINDS = new Set(['boxes', 'barrow', 'sack', 'frame']);
const NEXT_CONFIRM_MS = 3000;

export function createLevel(ctx, deps = {}) {
  const { farm, records, skills, save, player, flock, props, ui, events } = deps;
  const env = ctx.env;
  const engine = createJobEngine({ events, env, farm, props, records });
  const C = LEVEL1.clock;
  let fast = false, userPaused = false, seed = 1;
  let pending = null;               // { at: ms, label } after a first Next job press with jobs open
  let fired = new Set();            // checkpoints emitted this level
  let points = [];                  // skill points earned this level
  let weighs = [];                  // day 7 hand weighings [{ w, x, z }]
  let signed7 = false, ended = null, lastDay = null, tickAcc = 0;
  let saveIn = null, lastSaveDay = null;
  const details = new Map();        // milestone -> measured detail (profile)

  const emitLevel = (p) => events?.emit(EV.LEVEL, { day: env.dayNumber, ...p });
  const checkpoint = (name) => { if (fired.has(name)) return; fired.add(name); emitLevel({ phase: 'checkpoint', name }); };
  const inLevel = () => level.mode === 'level' && !ended;

  // ---------------- profile (skills kept across replays) ----------------
  function loadProfile() {
    const p = save?.loadProfile?.();
    if (p?.skills) skills?.restore?.(p.skills);
    for (const [k, v] of p?.details || []) details.set(k, v);
  }
  function saveProfile() { save?.saveProfile?.({ skills: skills?.serialize?.(), details: [...details] }); }

  // ---------------- autosave ----------------
  function saveNow() {
    if (!inLevel() || !save) return false;
    lastSaveDay = env.day;
    saveIn = null;
    return save.save(level.saveBlob());
  }
  const scheduleSave = (sec) => { if (saveIn == null || sec < saveIn) saveIn = sec; };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
    window.addEventListener('pagehide', () => saveNow());
  }

  // ---------------- bus ----------------
  if (events) {
    events.on(EV.JOB_DONE, () => { if (inLevel()) scheduleSave(2); });
    events.on(EV.SKILL_POINTS, (p) => {
      if (p.detail) details.set(p.milestone, p.detail);
      if (level.mode === 'level' || level.mode === 'result') points.push({ branch: p.branch, milestone: p.milestone, points: p.points, detail: p.detail || '', text: MILESTONES.find((m) => m.id === p.milestone)?.text || p.milestone });
      saveProfile();
    });
    events.on(EV.ACTION, (p) => { if (inLevel() && p.id === 'sample.weigh' && env.dayNumber === LEVEL1.endDay) weighs.push({ w: p.result?.weightG, x: p.x, z: p.z }); });
    events.on(EV.RECORD_CLOSED, (p) => {
      if (!inLevel()) return;
      if (p.day === LEVEL1.endDay && p.signed) signed7 = true;
      saveNow();
      // fail early: deaths and culls past the limit at any day's close
      if (mortalityPct() > LEVEL1.fail.mortalityMaxPct) end('mortality');
    });
  }

  function placedCount() { return farm.flock.placed || farm.flock.delivered || 0; }
  function mortalityPct() {
    const placed = placedCount();
    if (!placed) return 0;
    return (((farm.flock.deadTotal || 0) + (farm.flock.culls || 0)) / placed) * 100;
  }

  // ---------------- clock speed (PHASE2.md §2): paused > sign > panel > carry > fast > work ----------------
  function clock() {
    const kind = ui?.panelKind;
    if (userPaused || kind === 'paused') { env.paused = true; return; }
    env.paused = false;
    const placing = engine.anchors.truck != null && !fired.has('placed') && env.dayNumber === LEVEL1.arrivalDay;
    if (kind === 'sign') env.timeScale = C.sign;
    else if (kind === 'panel') env.timeScale = C.panel;
    else if (CARRY_KINDS.has(props?.carrying) || placing) env.timeScale = C.carry;
    else env.timeScale = fast ? C.fast : C.work;
  }

  // ---------------- checkpoints, the end ----------------
  function checks() {
    if (!inLevel()) return;
    const f = farm.flock;
    if (!fired.has('placed') && engine.anchors.placed != null && f.placed > 0 && f.inBoxes === 0) checkpoint('placed');
    const closed = (key) => { const i = engine.byKey(key); return i && i.closesAt != null && env.day >= i.closesAt - 1e-7; };
    if (closed('d0-vent@0')) checkpoint('vent');
    if (closed('d1-crop@1')) checkpoint('crop');
    const w = engine.byKey(`d7-weigh@${LEVEL1.endDay}`);
    if (w && (w.status === 'done' || closed(w.key))) checkpoint('weighin');
    if (env.day >= LEVEL_END_DAY - 1e-7) end('time');
    else if (signed7 && fired.has('weighin')) end('signed');
  }

  function weighResult() {
    const ok = weighs.filter((x) => Number.isFinite(x.w));
    if (!ok.length) return null;
    const mean = ok.reduce((a, b) => a + b.w, 0) / ok.length;
    const within = ok.filter((x) => Math.abs(x.w - mean) <= 0.1 * mean).length;
    return { n: ok.length, mean, uniformityPct: (within / ok.length) * 100 };
  }

  /** The result screen's numbers, from what was measured (PHASE2.md §10). */
  function computeResult(reason) {
    const placed = placedCount() || LEVEL1.chicksPlaced;
    const deaths = (farm.flock.deadTotal || 0) + (farm.flock.culls || 0);
    const deathsPct = (deaths / placed) * 100;
    const measured = farm.stats?.chickWeightMeasuredG;
    const chick = measured ?? farm.flock.chickWeightG ?? LEVEL1.chickWeightG;
    const wr = weighResult();
    // not weighed by hand: the automatic bird scale at the weigh-in age (08:00 day 7, about 2 % high)
    const weightG = wr ? wr.mean : farm.stats?.scaleAtWeighInG ?? (farm.flock.meanWeightG || 0) * 1.02;
    const ratio = chick ? weightG / chick : null;
    const pass = ratio != null && ratio >= LEVEL1.fail.weightRatioMin && deathsPct <= LEVEL1.fail.mortalityMaxPct;
    // what the farmer knows of the dead (the bin) and what he has not seen yet (the floor, the boxes)
    const fl = farm.flock, onFloor = fl.deadOnFloor || 0, inBoxes = (fl.boxDead || 0);
    const notPicked = onFloor > 0 ? ` (${onFloor.toLocaleString('en')} dead bird${onFloor === 1 ? '' : 's'} not picked up)` : '';
    const failText = deathsPct > LEVEL1.fail.mortalityMaxPct ? `deaths and culls reached ${two(deathsPct)} % on day ${env.dayNumber}${notPicked}` : `day 7 weight ${two(ratio)} × chick weight`;
    const floor = records?.timeline?.()?.find?.((e) => e.day === 0)?.floorAtArrivalC ?? null;
    const { day, hour } = splitDay(env.day);
    return { pass, reason, early: reason === 'mortality', endedAt: `day ${day}, ${hhmm(hour)}`, day, hour,
      ratio, weightG, weighedByHand: !!wr, chickWeightG: chick, chickSource: measured != null ? 'box' : 'delivery',
      deaths, placed, placedReal: (fl.placed || 0) > 0, countedDead: fl.countedDead || 0, deadOnFloor: onFloor, deadInBoxes: inBoxes, culls: fl.culls || 0,
      deathsPct, uniformityPct: wr && wr.n >= 10 ? wr.uniformityPct : farm.flock.uniformityPct ?? null,
      fcr: farm.flock.fcr || records?.row?.(LEVEL1.endDay)?.fcr || null, failText, floorAtArrival: floor, points: points.slice() };
  }

  function end(reason) {
    if (ended) return;
    checkpoint('level-end');
    engine.finish();
    ended = computeResult(reason);
    emitLevel({ phase: 'end', result: ended });
    save?.clear?.();
    showResult(ended);
  }
  function showResult(res) {
    level.mode = 'result';
    ui?.setMode?.('result');
    ui?.closePanel?.();
    ui?.showResult?.(res);
  }

  // ---------------- skips ----------------
  function skip(hours) {
    if (hours <= 0) return;
    const d0 = env.dayNumber;
    ui?.closePanel?.();
    env.skipHours(hours);
    flock?.afterSkip?.(hours); // the drawn flock spread over the skipped time
    engine.tick();
    checks();
    if (env.dayNumber !== d0 && env.hour >= 5.9 && env.hour < 12) player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw); // each morning at the gate
    scheduleSave(0.5);
  }
  function nextLabel() {
    if (!inLevel()) return 'Next job';
    if (pending && performance.now() - pending.at < NEXT_CONFIRM_MS) return pending.label;
    if (engine.open().length) return 'Next job';
    const t = engine.nextOpening();
    const s = splitDay(t);
    return s.day !== env.dayNumber ? `Skip to ${hhmm(s.hour)}, day ${s.day}` : `Skip to ${hhmm(s.hour)}`;
  }

  // ---------------- env for a fresh prep day ----------------
  function prepEnv() {
    env.reset();
    env.setWeather(LEVEL1.weather);
    env.setDay(LEVEL1.startDay);
    env.setHour(LEVEL1.startHour);
    env.forceHouseTemp(null);
    env.clearWeatherEvents?.();
    env.setFans(0); env.setPad(false); env.setVentTimer(null);
    env.setLightProgram({ darkStart: 2, darkHours: 1, dimmer: 1 });
    env.houseTemp = env.outsideTemp + 1; // an empty, cold house
    env.setHeaterSetpoint(20);            // brooders cold until the farmer pre-heats
    env.settleHeaters();
  }
  function resetRun() {
    fired = new Set(); points = []; weighs = []; signed7 = false; ended = null; pending = null;
    fast = false; userPaused = false; saveIn = null; lastSaveDay = null; tickAcc = 0;
  }
  function enterLevel(phase) {
    level.mode = 'level';
    lastDay = env.dayNumber;
    ui?.setMode?.('level');
    emitLevel({ phase });
  }

  // ---------------- debug.goto auto: the ideal farmer's rounds (farm-profiles.applyRound) ----------------
  function autoStops(target) {
    const st = farm.stats, out = [];
    const firstTip = st.firstTipAt ?? LEVEL1.arrivalDay + 8.1 * H;
    const add = (d, hr, r, t = d + hr * H) => { if (t > env.day + 1e-9 && t < target) out.push({ d, r, t }); };
    const prepDone = !!records?.row?.(LEVEL1.startDay)?.signed;
    for (let d = env.dayNumber; d <= Math.min(Math.floor(target), LEVEL1.endDay); d++) {
      if (d < LEVEL1.arrivalDay) {
        // the prep round is past due (goto called after 07:15): play it now rather than drop it
        if (!prepDone) { add(d, 7.25, 'prep', Math.max(d + 7.25 * H, env.day + 1e-6)); add(d, 20, 'eve'); add(d, 21, 'sign'); }
        continue;
      }
      add(d, d === 1 ? 6.5 : 6.25, 'am');
      if (d === LEVEL1.arrivalDay) { add(d, 8.1, 'truck'); add(d, 0, 'vent', firstTip + 2.6 * H); }
      if (d === 1) add(d, 0, 'crop', firstTip + 23 * H);
      if (d === 6) { add(d, 12, 'noon'); add(d, 17, 'late'); }
      if (d === LEVEL1.endDay) add(d, 9, 'weigh');
      add(d, d === 4 ? 15 : 13.25, 'pm');   // day 4: the leak shows by the afternoon (10:00 + 5 h)
      add(d, 20, 'sign');
    }
    return out.sort((a, b) => a.t - b.t);
  }
  function autoRound(s) {
    const jobOpen = (id) => engine.list().some((i) => i.id === id && i.status === 'open');
    let r = s.r;
    if (r === 'sign') { if (!records?.row?.(s.d)?.signed) records?.sign?.(s.d); return; }
    if (r === 'truck' && !(farm.flock.inBoxes > 0)) return;
    if (r === 'vent' && !jobOpen('d0-vent')) return;
    if (r === 'crop' && !jobOpen('d1-crop')) return;
    if (r === 'weigh' && !jobOpen('d7-weigh')) return;
    try { applyRound(farm, env, s.d, r, 'ideal'); } catch (err) { console.error('applyRound failed', err); }
    if (r === 'am' || r === 'pm') {
      // the dead birds of the round: picked up (the flock mirrors the farm's count) and counted at the bin
      const n = farm.flock.deadOnFloor;
      if (n > 0) { events?.emit(EV.DEAD_PICK, { n, causes: {}, carried: n }); farm.act('dead.count', { n, causes: {} }); }
    }
  }

  const level = {
    mode: 'sandbox',
    engine,
    /** null, or the sample the open job wants: 'vent' | 'crop' | 'weigh'. The flock's `chick`
     *  interact provider only answers while this is set. */
    sampling: null,
    get fast() { return fast; },
    hudHooks: {
      togglePause() { userPaused = !userPaused; },
      setFast(on) { fast = !!on; userPaused = false; },
      get fast() { return fast; },
      get userPaused() { return userPaused; },
      rateLabel() {
        if (env.paused) return userPaused ? 'Paused' : 'Stopped';
        if (env.timeScale === 0) return 'Stopped';
        if (env.timeScale === C.fast) return '4×';
        if (env.timeScale === C.work) return '1×';
        return `${env.timeScale / C.work}×`.replace('0.25×', '¼ speed');
      },
    },
    boot() {
      loadProfile();
      if (typeof navigator !== 'undefined' && navigator.webdriver) { level.mode = 'sandbox'; ui?.setMode?.('sandbox'); return; }
      level.toTitle();
    },
    start(opts = {}) {
      seed = opts.seed ?? 1;
      if (level.mode === 'sandbox' || level.mode === 'title') loadProfile();
      resetRun();
      save?.clear?.();
      ui?.closePanel?.();
      prepEnv();
      records?.reset?.();
      props?.reset?.();
      flock?.resetLevel?.();
      ui?.newRun?.();
      farm.start(LEVEL1, { seed });
      engine.start(LEVEL1.startDay);
      player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
      enterLevel('start');
      scheduleSave(1);
      return true;
    },
    resume(data) {
      if (!data || !data.level || !data.env) return false;
      // the skill profile first: a resume (Continue or the artifact hot reload) never starts from
      // empty skills, and the next award saves the profile it came from
      loadProfile();
      resetRun();
      ui?.closePanel?.();
      ui?.newRun?.();
      const e = data.env;
      // restore order (PHASE2.md §11): env -> farm -> records -> props -> flock -> level.
      // farm.start (keepClock) first: it puts the level climate on with the prep-day equipment;
      // the saved env values go on top of it and farm.restore rebuilds timer, light and weather.
      env.reset();
      env.setWeather(e.weather || LEVEL1.weather);
      env.setDay(Math.floor(e.day - (e.hour ?? 0) * H + 1e-6));
      env.setHour(e.hour ?? 0);
      farm.start(LEVEL1, { seed: data.level.seed ?? 1, keepClock: true });
      env.setFans(e.fansManual ?? e.fansOn ?? 0); env.setPad(!!e.padOn);
      env.setVentTimer(e.ventTimer ?? null);
      env.setLightProgram(e.lightProgram || { darkStart: 2, darkHours: 1, dimmer: 1 });
      env.setHeaterSetpoint(e.heaterSetpoint ?? 20);
      if (e.houseTemp != null) env.houseTemp = e.houseTemp;
      if (e.slabTemp != null) env.slabTemp = e.slabTemp;
      if (e.houseRH != null) env.houseRH = e.houseRH;
      if (e.heaterLevel != null) { env.heaterLevel = e.heaterLevel; env.heatersOn = e.heaterLevel > 0.02; }
      farm.restore(data.farm);
      if (farm.mode !== 'level') { farm.mode = 'level'; farm.level = LEVEL1; }
      records?.restore?.(data.records);
      props?.restore?.(data.props);
      flock?.restore?.(data.flock);
      if (props?.carrying === 'chick') props.drop?.(); // a chick in the hand is not in the save: hands empty
      const lv = data.level;
      seed = lv.seed ?? 1;
      engine.restore(lv.jobs);
      fired = new Set(lv.fired || []); points = lv.points || []; weighs = lv.weighs || []; signed7 = !!lv.signed7; fast = !!lv.fast;
      if (data.player && player) player.teleport(data.player.x, data.player.z, data.player.yaw);
      enterLevel('resume');
      engine.tick();
      return true;
    },
    continueSave() { const d = save?.load?.(); return d ? level.resume(d) : false; },
    toSandbox() {
      saveNow();
      resetRun();
      ui?.closePanel?.();
      farm.stop?.();
      props?.reset?.();
      flock?.resetLevel?.();
      env.reset();
      env.clearWeatherEvents?.();
      env.setVentTimer(null);
      player?.teleport?.(FARM.spawnSandbox.x, FARM.spawnSandbox.z, FARM.spawnSandbox.yaw);
      level.mode = 'sandbox';
      level.sampling = null;
      ui?.setMode?.('sandbox');
    },
    toTitle() {
      saveNow();
      ui?.closePanel?.();
      if (level.mode !== 'level') {
        // over the farm at dawn
        env.setHour(6.4);
        player?.teleport?.(FARM.spawn.x, FARM.spawn.z, FARM.spawn.yaw);
      }
      level.mode = 'title';
      env.paused = true;
      ui?.setMode?.('title');
    },
    replay() { return level.start({ seed }); },
    keepWalking() { if (!ended) return; level.mode = 'level'; ui?.closePanel?.(); ui?.setMode?.('level'); },
    update(dt) {
      if (level.mode === 'title' || level.mode === 'result') { env.paused = true; return; }
      if (level.mode !== 'level') return;
      if (ended) { // keep walking on day 7: the clock runs to 23:59, then stands; the level is over
        const stopAt = LEVEL1.endDay + 23.98 / 24;
        env.paused = !!userPaused || ui?.panelKind === 'paused' || env.day >= stopAt - 1e-9;
        env.timeScale = C.work;
        if (env.day > stopAt) { env.setDay(LEVEL1.endDay); env.setHour(23.98); }
        return;
      }
      clock();
      tickAcc += dt;
      if (tickAcc >= 0.5) { tickAcc = 0; engine.tick(); checks(); }
      if (env.dayNumber !== lastDay) { lastDay = env.dayNumber; emitLevel({ phase: 'day' }); }
      const open = (id) => engine.list().some((i) => i.id === id && i.status === 'open');
      level.sampling = open('d0-vent') ? 'vent' : open('d1-crop') ? 'crop' : open('d7-weigh') ? 'weigh' : null;
      if (saveIn != null && (saveIn -= dt) <= 0) saveNow();
      if (lastSaveDay == null) lastSaveDay = env.day;
      else if (env.day - lastSaveDay >= 2 * H) saveNow();
      if (pending && performance.now() - pending.at > NEXT_CONFIRM_MS) pending = null;
    },
    nextJob() {
      if (!inLevel()) return null;
      const open = engine.open();
      const now = performance.now();
      if (open.length && !(pending && now - pending.at < NEXT_CONFIRM_MS)) {
        const c = engine.cycle();
        const s = splitDay(engine.nextOpening());
        pending = { at: now, label: `Skip to ${hhmm(s.hour)} — ${open.length} job${open.length === 1 ? '' : 's'} open` };
        ui?.jobCard?.refresh?.();
        return { pointed: c?.key ?? null };
      }
      pending = null;
      const target = engine.nextOpening();
      const hrs = (target - env.day) * 24;
      skip(hrs);
      return { skipped: hrs };
    },
    nextLabel,
    jobs: {
      list: () => engine.list(),
      open: () => engine.open(),
      current: () => engine.current(),
      complete: (key) => engine.complete(key),
      byKey: (key) => engine.byKey(key),
    },
    skillDetail: (id) => details.get(id) || '',
    get result() { return ended; },
    serialize() {
      return { v: 1, mode: level.mode, seed, jobs: engine.serialize(), fired: [...fired], points, weighs, signed7, fast };
    },
    saveBlob() {
      const p = player;
      return {
        level: level.serialize(),
        env: { day: env.day, hour: env.hour, weather: env.weather, houseTemp: env.houseTemp, slabTemp: env.slabTemp, houseRH: env.houseRH,
          heaterSetpoint: env.heaterSetpoint, heaterLevel: env.heaterLevel, fansOn: env.fansOn, fansManual: env.fansManual, padOn: env.padOn,
          ventTimer: env.ventTimer, lightProgram: env.lightProgram },  // weatherEvents: rebuilt by the farm
        farm: farm?.serialize() ?? null,
        records: records?.serialize() ?? null,
        props: props?.serialize() ?? null,
        flock: flock?.serialize?.() ?? null,
        player: p ? { x: p.position.x, z: p.position.z, yaw: p.yaw } : null,
      };
    },
    debug: {
      /** Jump to day + hour. auto: the ideal farmer's management (farm-profiles.applyRound, the same
       *  rounds scripts/test-sim.mjs plays) at each round passed: the prep (unless the prep record is
       *  signed already), the flush, the morning and afternoon rounds, the truck, vent and crop
       *  samples, the day 6 warm-afternoon timer, the day 7 weigh-in; dead birds picked up and counted after
       *  each round, the evening record signed, and the jobs still open completed and logged. */
      goto(day, hour, { auto = false } = {}) {
        if (level.mode !== 'level') level.start({ seed });
        const target = day + hour * H;
        if (target <= env.day + 1e-9) return false;
        if (auto) {
          for (const s of autoStops(target)) {
            if (s.t > env.day + 1e-9) skip((s.t - env.day) * 24);
            if (ended) return true;
            autoRound(s);
            engine.tick(); checks();
            if (ended) return true;
            for (const i of engine.open()) engine.complete(i.key, { auto: true });
            engine.tick(); checks();
            if (ended) return true;
          }
        }
        if (target > env.day + 1e-9) skip((target - env.day) * 24);
        return true;
      },
      /** Start a problem now (the farm decides the symptom when the farmer meets it). */
      trigger(id) { farm.debug?.trigger?.(id); },
      /** Show the result screen now. forcePass true / false makes a passing / failing week for the harness. */
      result(forcePass) {
        const r = computeResult('debug');
        if (forcePass === false) { r.pass = false; r.ratio = 3.8; r.weightG = r.chickWeightG * 3.8; r.failText = `day 7 weight ${two(r.ratio)} × chick weight`; }
        else if (forcePass === true && !r.pass) { r.pass = true; }
        showResult(r);
        return r;
      },
    },
  };
  return level;
}
