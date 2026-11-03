// Management profiles for the whole cycle (days 8-69) — STUB (PHASE3.md §6.14, §13.8). Owner:
// package "sim", which replaces the placeholder care below with the ideal farmer of PHASE3.md §6.14
// and every named mistake, and builds runCycle. The run package's goto(auto) and standard starts call
// applyCycleRound at the rounds cycleStops() lists; test-cycle.mjs plays the same rounds.
//
//   applyCycleRound(farm, env, day, round, profile = 'ideal') -> [{ id, args, result }]
//     rounds: 'am' | 'pm' | 'eve' | 'night' | 'noon' and the dated ones ('curtain', 'vaccine', 'change',
//     'brooders', 'heatwave', 'withdraw', 'catch', 'clean1'..'clean4', 'swabs', 'book'), all through
//     farm.act and the env setters (never other events). STUB: Phase 2's ideal morning / afternoon on
//     any day, the curtain lifted from day 10, a feed order when the silos hold under 3 days of feed.
//   cycleStops(fromDay, toDay) -> [{ d, h, r }]   the rounds to play, in time order (STUB: 06:15 'am',
//     13:15 'pm', 20:00 'sign' each day)
//   climateCare(farm, env) -> stepper   STUB only: a fan and pad thermostat for free runs (tunnel fans
//     by the house temperature over the target, pads with four fans or more), so a placeholder flock
//     lives through weeks 4-6 until the real profiles exist. Stays exported (a no-op once the ideal
//     profile runs the fans itself) until the run package's merge drops level.js's import of it.
//   runCycle(name, { seed, from, to }) -> { farm, env, records, skills, levels, levelEnds, hourly, points }
//     (not built yet): the trace scripts/test-cycle.mjs checkCycle measures (its header lists the fields).
//     The ideal's fans and pads follow scripts/cycle-refs.mjs idealFans / idealPad at its stops; it uses
//     the base controls only (no vent.stages: a first-cycle farmer has no stage table).
import { EQUIP, FAN_COUNT, feedStdGAt } from './config.js';
import { applyRound } from './farm-profiles.js';

export const STUB = true;

/** Profile names (keys of CYCLE_TARGETS in scripts/test-cycle.mjs). */
export const CYCLE_PROFILES = ['ideal', 'noDark', 'lateLift', 'noStep', 'poorVaccine', 'poorVaccineCocci', 'cocciUntreated', 'minVentW3',
  'crumbleOn', 'abruptChange', 'overfullSilo', 'dustOn', 'noTunnel', 'fansNoPad', 'padInHumid', 'fanUnfixed', 'noWithdrawal',
  'longWithdrawal', 'brightCatch', 'wetDisinfect', 'litterLeft', 'shortRest', 'determinism'];

/** STUB: the rounds of each day from fromDay to toDay (inclusive). */
export function cycleStops(fromDay, toDay) {
  const out = [];
  for (let d = fromDay; d <= toDay; d++) out.push({ d, h: 6.25, r: 'am' }, { d, h: 13.25, r: 'pm' }, { d, h: 20, r: 'sign' });
  return out;
}

/** STUB placeholder care (see the header). */
export function applyCycleRound(farm, env, day, round, profile = 'ideal') {
  void profile;
  if (farm.mode !== 'level' || !(farm.flock.alive > 0)) return [];
  if (round === 'am') {
    const done = applyRound(farm, env, day, 'am', 'ideal');
    const need = (farm.flock.alive * feedStdGAt(farm.age)) / 1000;
    if (!farm.feed.order && farm.feed.siloKg < 3 * need) {
      const kg = Math.max(500, Math.min(EQUIP.siloCapacityKg - farm.feed.siloKg, Math.round((6 * need) / 100) * 100));
      done.push({ id: 'feed.order', args: { kg }, result: farm.act('feed.order', { kg }) });
    }
    if (day >= 10 && farm.house && !farm.house.curtainOpen) done.push({ id: 'house.curtain', args: { open: true }, result: farm.act('house.curtain', { open: true }) });
    return done;
  }
  if (round === 'pm') return applyRound(farm, env, day, 'pm', 'ideal');
  return [];
}

/** STUB: tunnel fans and pads by the house temperature (free runs only; never in a scored level). */
export function climateCare(farm, env) {
  let last = -1;
  return (e) => {
    if (farm.mode !== 'level' || !(farm.flock.alive > 0)) return;
    if (last >= 0 && e.day - last < 10 / 1440) return;
    const over = e.houseTemp - e.targetTemp;
    const want = over > 2 ? Math.max(1, Math.min(FAN_COUNT, Math.ceil((over - 2) / 1.2))) : 0;
    if (Math.abs(want - e.fansManual) >= 1) { e.setFans(want); last = e.day; }
    const pad = want >= 4 && e.outsideRH < 80;
    if (pad !== e.padOn) e.setPad(pad);
  };
}

export function runCycle() {
  throw new Error('runCycle is built by package "sim" (PHASE3.md §6.14)');
}
