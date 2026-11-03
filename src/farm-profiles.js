// Management profiles: the ideal farmer (and the deliberate mistakes of PHASE2.md §6.10) as code.
// One place for "what good management does each round", used by scripts/test-sim.mjs and by
// level.debug.goto(day, hour, { auto: true }) so the end-to-end harness run plays the same farm the
// node tests check. Owner: package "sim" (phase2/sim). Pure logic (no three.js, no DOM).
// STUB: applyRound does nothing yet; runProfile / checkProfile throw (test-sim skips them while
// farm.stub is true).
//
//   applyRound(farm, env, day, round, profile = 'ideal')
//     Performs that round's management for the profile through farm.act(...) and the env setters
//     (env.setHeaterSetpoint, env.setVentTimer via 'vent.timer', env.setFans ...). round is one of
//     'prep' | 'am' | 'pm' | 'eve'. It never emits events itself: farm.act emits the actions, so the
//     job engine and the records see exactly what a player's panels would send.
//   runProfile(name, { seed }) -> { farm, env, records, skills, snaps, result }
//     A whole level for a profile: start, prep day, skips, rounds, problems found when the profile
//     says, weigh-in at 09:00 day 7, the end. snaps holds the readings the targets need.
//   checkProfile(name, run, targets, { assert, inBand })
//     Asserts targets[name] (scripts/test-sim.mjs PROFILE_TARGETS) against the run.

/** Profile names (keys of PROFILE_TARGETS in scripts/test-sim.mjs). */
export const PROFILES = ['ideal', 'smallMistakes', 'latePreheat', 'noFlush', 'neglect', 'coldNightWideTimer',
  'noMinVent', 'leakUnfixed24h', 'filterNeverFound', 'noFeedOrder', 'brooderNeverRelit'];

export function applyRound(farm, env, day, round, profile = 'ideal') {
  void farm; void env; void day; void round; void profile;
  return []; // STUB: the actions performed, [{ id, args, result }]
}

export function runProfile(name) {
  throw new Error(`farm-profiles.runProfile(${name}): not implemented (package "sim")`);
}

export function checkProfile(name) {
  throw new Error(`farm-profiles.checkProfile(${name}): not implemented (package "sim")`);
}
