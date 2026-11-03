// The run: seven levels on one flock, from the plan to the rested house (PHASE3.md §2) — STUB.
// Owner: package "run", which builds chaining, level starts, replays and standard starts here and in
// level.js. The stub keeps the contract so main.js, the harness and the other packages can call it.
//
// createRun({ level, save, events, farm, env, records }) -> run
//   stub                  true until the run is built (scripts/test-run.mjs skips its chaining tests)
//   state()               { levelId, seed, plan, levels: { [id]: { state, key, attempts } } }
//   startRun({ seed, at })   a new run: Level 1 (plan) or, with at: 'level1', the brooding week.
//                         STUB: always the brooding week (the plan level is not built yet)
//   startLevel(id, { from: 'saved' | 'standard', seed })   start one level of the run. STUB: 'level1'
//                         is level.start; a later level is level.debug.freeRun to its start (no jobs)
//   next()                after a passed level: continue the run into the next level (keeps the flock)
//   replay(id)            restore that level's saved start (the run goes back to it)
//   serialize() / restore(d)   the run's part of the save (PHASE3.md §11)
// Events: EV.RUN { phase: 'start' | 'level-start' | 'level-end' | 'cycle-end', level, pass? }.
import { LEVEL1, levelById } from './config.js';
import { EV } from './events.js';

export function createRun({ level, events, farm } = {}) {
  let seed = 1, levelId = null;
  const levels = {};
  const emit = (p) => events?.emit(EV.RUN, p);
  const mark = (id, state) => { const l = levels[id] || (levels[id] = { state: 'reached', key: null, attempts: 0 }); l.state = state; l.attempts++; };

  const run = {
    stub: true,
    state() { return { levelId, seed, plan: farm?.plan ?? null, levels: JSON.parse(JSON.stringify(levels)) }; },
    startRun(opts = {}) {
      seed = opts.seed ?? 1;
      for (const k of Object.keys(levels)) delete levels[k];
      emit({ phase: 'start', level: LEVEL1.id });
      return run.startLevel(LEVEL1.id, { seed });
    },
    startLevel(id = LEVEL1.id, opts = {}) {
      seed = opts.seed ?? seed;
      const def = levelById(id);
      if (!def) throw new Error(`unknown level ${id}`);
      if (def.id === 'plan') throw new Error('the plan level is built by package "run" (PHASE3.md §14.2)');
      const ok = def === LEVEL1 ? level.start({ seed }) : level.debug.freeRun(def.startDay, def.startHour, { seed });
      if (ok) { levelId = def.id; mark(def.id, 'reached'); emit({ phase: 'level-start', level: def.id }); }
      return ok;
    },
    next() { return false; },
    replay(id) { return run.startLevel(id, { from: 'standard' }); },
    serialize() { return { v: 1, stub: true, seed, levelId, levels: JSON.parse(JSON.stringify(levels)) }; },
    restore(d) {
      if (!d) return;
      seed = d.seed ?? 1; levelId = d.levelId ?? null;
      for (const k of Object.keys(levels)) delete levels[k];
      Object.assign(levels, d.levels || {});
    },
  };
  return run;
}
