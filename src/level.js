// Level flow: title card (start / continue / sandbox), the job engine over the day's rounds,
// "Next job" time skips, the clock speeds of the level, day changes, the level result (pass or
// replay) and autosave. Owner: package "level" (phase2/level). STUB: stays in the Phase 1
// sandbox; start() only records the request so the hooks and the harness can be built now.
//
// createLevel(ctx, deps) -> level
//   deps = { farm, records, skills, save, player, flock, props, ui, interact, events }
//   mode            'sandbox' (Phase 1 farm, Phase 1 tasks and test tools) | 'title' | 'level' | 'result'
//   boot()          called once by main.js after the first frame is ready: shows the title card
//                   in a real browser; under automation (navigator.webdriver) stays in the sandbox
//                   so the Phase 1 harness scenarios keep working
//   start({ seed })     fresh Level 1 from the prep day (clears the level save, keeps the profile)
//   resume(data)        continue from a save (save.load())
//   toSandbox()         leave the level for the Phase 1 farm
//   update(dt)          every frame after the ui (real seconds): job engine, clock speed, autosave
//   nextJob()           the "Next job" button: point at the next open job, or skip the clock to
//                       when the next job opens (leaving open jobs as missed if the player chose to)
//   jobs                { list(): JobInstance[], open(): JobInstance[], current(): JobInstance|null,
//                         complete(key) (debug), byKey(key) }
//   serialize()         JSON-safe state of the level itself (jobs, anchors, clock mode)
//   saveBlob()          the whole save object of PHASE2.md §11 ({ level, env, farm, records, props,
//                       flock, player }); autosave and the artifact hot reload both use it, and
//                       resume(blob) takes it back
//   checkpoint events   emits EV.LEVEL { phase: 'checkpoint', name } for 'placed' (last stack
//                       tipped), 'vent' / 'crop' (their windows closed), 'weighin', 'level-end';
//                       skills.js listens (the level never calls skills.evaluate itself)
//   sampling            null | 'vent' | 'crop' | 'weigh' (catching chicks is possible only then)
//   debug               { goto(day, hour, { auto }) jump; auto: farm-profiles.applyRound(farm, env,
//                         day, round, 'ideal') acts on the farm for every round passed, then the
//                         jobs still open are completed and logged, so records and skills match,
//                         trigger(problemId), result(forcePass?) } for test tools and harness
//
// JobInstance: { key, id, def, day, status: 'waiting'|'open'|'done'|'missed', opensAt, closesAt,
//   doneAt, progress (0..1), result }  (times as env.day floats)

export function createLevel(ctx, deps = {}) {
  void deps;
  const empty = [];
  const level = {
    mode: 'sandbox',
    requested: null,
    /** null, or the sample the open job wants: 'vent' | 'crop' | 'weigh'. The flock's `chick`
     *  interact provider only answers while this is set. */
    sampling: null,
    boot() { /* STUB: the title card comes with package "level" */ },
    start(opts = {}) { level.requested = { kind: 'start', ...opts }; return false; },
    resume(data) { level.requested = { kind: 'resume', data }; return false; },
    toSandbox() { level.mode = 'sandbox'; },
    update(dt) { void dt; },
    nextJob() { return null; },
    jobs: {
      list: () => empty,
      open: () => empty,
      current: () => null,
      complete: () => false,
      byKey: () => null,
    },
    serialize() { return { v: 1, mode: level.mode }; },
    saveBlob() {
      const env = ctx.env, p = deps.player;
      return {
        level: level.serialize(),
        env: env ? { day: env.day, hour: env.hour, weather: env.weather, houseTemp: env.houseTemp, slabTemp: env.slabTemp,
          heaterSetpoint: env.heaterSetpoint, heaterLevel: env.heaterLevel, fansOn: env.fansOn, padOn: env.padOn,
          ventTimer: env.ventTimer, lightProgram: env.lightProgram } : null,  // weatherEvents: rebuilt by the farm
        farm: deps.farm?.serialize() ?? null,
        records: deps.records?.serialize() ?? null,
        props: deps.props?.serialize() ?? null,
        flock: deps.flock?.serialize?.() ?? null,
        player: p ? { x: p.position.x, z: p.position.z, yaw: p.yaw } : null,
      };
    },
    debug: {
      goto() { return false; },
      trigger(id) { deps.farm?.debug?.trigger(id); },
      result() { return null; },
    },
  };
  return level;
}
