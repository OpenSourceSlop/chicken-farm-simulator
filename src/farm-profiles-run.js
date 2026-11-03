// Whole-level runs of the management profiles (farm-profiles.js) for scripts/test-sim.mjs:
// runProfile plays the farmer (applyRound) and the level's part (record signing, dead birds to the
// bin, EV.LEVEL checkpoints for skills); checkProfile compares a run with PROFILE_TARGETS.
// Owner: package "sim". Pure logic, node only in practice (the browser uses applyRound).
import { LEVEL1 } from './config.js';
import { createSim } from './sim.js';
import { createEvents, EV } from './events.js';
import { createFarm } from './farm.js';
import { createRecords } from './records.js';
import { createSkills, MILESTONES } from './skills.js';
import { applyRound, profileOf } from './farm-profiles.js';
import { underLineMoisture } from './farm-litter.js';

/** A farm wired as main.js wires it. */
export function makeWorld() {
  const env = createSim();
  const events = createEvents();
  const farm = createFarm(env, { events });
  env.addStepper(farm.step);
  const records = createRecords({ farm, env, events });
  const skills = createSkills({ events, records, farm });
  return { env, events, farm, records, skills };
}

/** The day's schedule of a profile: [day, hour, what] in time order. */
function schedule(P) {
  const s = [[-1, 7, 'prep']];
  if (!(P.preheat.day === -1 && P.preheat.hour === 7)) s.push([P.preheat.day, P.preheat.hour, 'preheat']);
  s.push([-1, 20, 'eve'], [-1, 21, 'sign']);
  s.push([0, 6.25, 'am'], [0, 8, 'truck'], [0, 8.01, 'cp:placed'], [0, 10.75, 'vent'], [0, 11.75, 'cp:vent']);
  for (let d = 0; d <= 7; d++) {
    if (d > 0) s.push([d, d === 1 ? 6.5 : 8.5, 'am']); // day 1 early (the brooder), then after the first walk
    if (d === 1) s.push([1, 9, 'crop'], [1, 12.25, 'cp:crop']);
    if (d === 3) s.push([3, 4, 'snap:night']);
    if (d === 5) s.push([5, 10, 'snap:leak'], [5, 10, 'leak24']);
    if (d === 6) s.push([6, 12, 'noon'], [6, 10, 'snap:day6'], [6, 15, 'snap:warm'], [6, 17, 'late']);
    if (d === 7) s.push([7, 9, 'weigh'], [7, 9.5, 'cp:weighin']);
    s.push([d, 15, 'pm'], [d, 20, 'sign']);
  }
  s.push([7, 20.1, 'cp:level-end']);
  return s.map(([d, h, what], i) => ({ t: d + h / 24, d, h, what, i })).sort((a, b) => a.t - b.t || a.i - b.i);
}

const pct = (fl) => (100 * (fl.deadTotal + fl.culls)) / Math.max(1, fl.delivered);

export function runProfile(name, { seed = 1, onStep = null } = {}) {
  const P = profileOf(name);
  const world = makeWorld();
  const { env, events, farm, records, skills } = world;
  farm.start(LEVEL1, { seed });
  if (onStep) env.addStepper((e) => onStep(world, e));
  const snaps = { meterChange: {}, rhMinFromDay4: 100, litterMax: 0, failedEarlyAt: null };
  env.addStepper((e) => {
    // minimum ventilation only: hours with a tunnel fan switched on by hand (the warm afternoon) left out
    if (e.day >= 4 && e.fansManual === 0 && e.houseRH < snaps.rhMinFromDay4) snaps.rhMinFromDay4 = e.houseRH;
  });
  const pickDead = () => {
    const n = farm.flock.deadOnFloor;
    if (n <= 0) return;
    events.emit(EV.DEAD_PICK, { n, causes: {}, carried: n });
    farm.act('dead.count', { n, causes: {} });
  };
  for (const ev of schedule(P)) {
    if (ev.t > env.day + 1e-9) env.skipHours((ev.t - env.day) * 24);
    const [kind, arg] = ev.what.split(':');
    if (kind === 'cp') { events.emit(EV.LEVEL, { phase: 'checkpoint', name: arg, day: env.dayNumber }); continue; }
    if (kind === 'snap') {
      if (arg === 'night') snaps.houseAt04Day3 = env.houseTemp;
      if (arg === 'day6') { snaps.litterMeanDay6 = farm.litter.meanMoisturePct; snaps.nh3Day6 = farm.litter.ammoniaPpm; snaps.litterUnderLinesDay6 = underLineMoisture(farm.litter); }
      if (arg === 'warm') { snaps.houseOverTargetAt15Day6 = env.houseTemp - env.targetTemp; snaps.pantShareAt15Day6 = farm.comfort.pantShare; }
      if (arg === 'leak') {
        const leak = farm.water.leak, cell = leak ? leak.cell : null;
        snaps.leakCellPct = cell == null ? null : farm.litter.moistureGrid[cell];
        snaps.leakCaked = cell == null ? null : !!farm.litter.cakedGrid[cell];
      }
      continue;
    }
    if (kind === 'sign') {
      records.sign(ev.d);
      if (ev.d >= 0 && pct(farm.flock) > LEVEL1.fail.mortalityMaxPct && snaps.failedEarlyAt == null) snaps.failedEarlyAt = ev.d;
      continue;
    }
    const acts = applyRound(farm, env, ev.d, kind, P);
    if (kind === 'am') {
      const m = acts.find((a) => a.id === 'water.meter');
      if (m) snaps.meterChange[ev.d] = m.result.changePct;
    }
    if (kind === 'am' || kind === 'pm') pickDead();
    if (kind === 'pm') snaps.litterMax = Math.max(snaps.litterMax, farm.litter.meanMoisturePct);
    if (kind === 'weigh') {
      const w = farm.stats.weighed.map((x) => x.weightG);
      snaps.weighMeanG = w.reduce((a, b) => a + b, 0) / Math.max(1, w.length);
      snaps.uniformityPct = farm.flock.uniformityPct;
      snaps.fcr = farm.flock.cumFeedKg / Math.max(1e-9, (farm.flock.alive * farm.flock.meanWeightG) / 1000);
      snaps.nh3Day7 = farm.litter.ammoniaPpm;
      snaps.trueMeanG = farm.flock.meanWeightG;
    }
  }
  const fl = farm.flock, st = farm.stats;
  const chick = st.chickWeightMeasuredG ?? fl.chickWeightG;
  snaps.ratio = (snaps.weighMeanG ?? fl.meanWeightG) / chick;
  snaps.deathsPct = pct(fl);
  snaps.comfortShare = st.comfortMinutes / Math.max(1, st.levelMinutes);
  const pass = snaps.ratio >= LEVEL1.fail.weightRatioMin && snaps.deathsPct <= LEVEL1.fail.mortalityMaxPct && snaps.failedEarlyAt == null;
  const result = { pass, ratio: +snaps.ratio.toFixed(3), mortalityPct: +snaps.deathsPct.toFixed(2), uniformityPct: snaps.uniformityPct,
    fcr: snaps.fcr, failedEarlyAt: snaps.failedEarlyAt };
  return { ...world, snaps, result };
}

const idealCache = new Map();
const idealRun = (seed) => { if (!idealCache.has(seed)) idealCache.set(seed, runProfile('ideal', { seed })); return idealCache.get(seed); };

export function checkProfile(name, run, targets, { assert, inBand }) {
  const T = targets[name], S = run.snaps, fl = run.farm.flock, st = run.farm.stats;
  if (!T) throw new Error(`no targets for ${name}`);
  const ideal = () => idealRun(run.farm.seed).snaps;
  for (const [k, v] of Object.entries(T)) {
    switch (k) {
      case 'ratio': inBand(S.ratio, v, 'ratio'); break;
      case 'uniformityPct': inBand(S.uniformityPct, v, 'uniformity %'); break;
      case 'deathsPct': inBand(S.deathsPct, v, 'deaths + culls %'); break;
      case 'fcr': inBand(S.fcr, v, 'FCR'); break;
      case 'litterMeanPct': inBand(S.litterMax, v, 'mean litter % (highest afternoon)'); break;
      case 'nh3Day7': inBand(S.nh3Day7, v, 'NH3 day 7'); break;
      case 'cropFill': inBand(st.cropFillTrue, v, 'crop fill'); break;
      case 'floorShare28AtTip': inBand(st.floorShareAtFirstTip, v, 'floor >= 28 share'); break;
      case 'meterChangePct': for (const [d, b] of Object.entries(v)) inBand(S.meterChange[d], b, `meter change day ${d}`); break;
      case 'skillLevels': for (const [b, lv] of Object.entries(v)) assert(run.skills.level(b) === lv, `skill ${b} level ${run.skills.level(b)} (points ${run.skills.points(b)}), want ${lv}`); break;
      case 'passes': assert(run.result.pass === v, `passes ${run.result.pass} (ratio ${S.ratio.toFixed(3)}, deaths ${S.deathsPct.toFixed(2)} %), want ${v}`); break;
      case 'uniformityBelowIdeal': assert(ideal().uniformityPct - S.uniformityPct >= v, `uniformity ${S.uniformityPct.toFixed(1)} vs ideal ${ideal().uniformityPct.toFixed(1)}, want >= ${v} below`); break;
      case 'waterQuality': assert(run.farm.water.quality === v, `water quality ${run.farm.water.quality}`); break;
      case 'deathsOverIdeal': inBand(S.deathsPct - ideal().deathsPct, v, 'deaths over ideal (points)'); break;
      case 'houseAt04Day3': inBand(S.houseAt04Day3, v, 'house 04:00 day 3'); break;
      case 'coldDeaths': inBand(fl.deadByCause.cold, v, 'cold deaths'); break;
      case 'rhMinFromDay4': assert(S.rhMinFromDay4 >= v, `RH min from day 4 ${S.rhMinFromDay4.toFixed(1)}`); break;
      case 'litterMeanDay6': inBand(S.litterMeanDay6, v, 'mean litter day 6'); break;
      case 'nh3Day6': inBand(S.nh3Day6, v, 'NH3 day 6'); break;
      case 'leakCellPct': inBand(S.leakCellPct, v, 'leak cell %'); break;
      case 'caked': assert(S.leakCaked === v, `leak cell caked ${S.leakCaked}`); break;
      case 'meterChangePctDay4': inBand(S.meterChange[4], v, 'meter change day 4'); break;
      case 'dehydrationDeaths': assert(fl.deadByCause.dehydration === v, `dehydration deaths ${fl.deadByCause.dehydration}`); break;
      case 'pansEmptyBetween': {
        const [a, b] = v.map((x) => x.day + x.hour / 24), e = st.pansEmptyAt;
        assert(e != null && e >= a && e <= b, `pans empty at ${e == null ? 'never' : `day ${Math.floor(e)} ${((e % 1) * 24).toFixed(1)} h`}`);
        break;
      }
      case 'comfortShareBelowIdeal': assert(ideal().comfortShare - S.comfortShare >= v, `comfort share ${S.comfortShare.toFixed(4)} vs ideal ${ideal().comfortShare.toFixed(4)}`); break;
      case 'ratioBelowIdeal': assert(ideal().ratio - S.ratio >= v, `ratio ${S.ratio.toFixed(3)} vs ideal ${ideal().ratio.toFixed(3)}, want >= ${v} below`); break;
      case 'litterUnderLinesDay6': inBand(S.litterUnderLinesDay6, v, 'litter under the drinker lines day 6'); break;
      case 'houseOverTargetAt15Day6': inBand(S.houseOverTargetAt15Day6, v, 'house over target 15:00 day 6'); break;
      case 'pantShareAt15Day6': inBand(S.pantShareAt15Day6, v, 'panting share 15:00 day 6'); break;
      case 'notEarned': for (const id of v) {
        const m = MILESTONES.find((x) => x.id === id), got = m && run.skills.milestones(m.branch).find((x) => x.id === id);
        assert(m && got.tier == null, `milestone ${id} earned (${got?.points} points)`);
      } break;
      default: throw new Error(`unknown target ${k}`);
    }
  }
}
