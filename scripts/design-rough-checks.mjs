// The rough farm checks of the Phase 4 design (PHASE4.md §4: the numbers marked "rough"). They run the Phase 2 / 3
// farm as it is on main with a condition's weather, delivery or problems patched in, so the §4 bands rest on more than
// the env-only references (scripts/tuning-refs-cond.mjs). Not the final model: the sim package confirms the bands on
// its own (scripts/test-cond.mjs) and records any move in PHASE4.md §2.7. Not in npm test (each part patches shared
// config / model objects, so each runs in its own process). Owner: integrator.
//   node scripts/design-rough-checks.mjs            all three parts (hot brooding week, rainy weeks 2-3, a bad batch)
//   node scripts/design-rough-checks.mjs hot 1 4    one part (seeds 1..4)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LEVEL1, WEEK2, WEEK3, weightAt, CONDITIONS } from '../src/config.js';
import { EV } from '../src/events.js';
import { FLOCK } from '../src/farm-flock.js';
import { makeWorld, schedule } from '../src/farm-profiles-run.js';
import { applyRound, profileOf } from '../src/farm-profiles.js';
import { runCycle } from '../src/farm-profiles-cycle.js';

const [part, s0 = '1', s1 = s0] = process.argv.slice(2);
if (!part) {
  for (const p of ['hot', 'rainy', 'bad']) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), p, '1', p === 'rainy' ? '1' : '4'], { stdio: 'inherit' });
    if (r.status) process.exit(r.status);
  }
  process.exit(0);
}
const pct = (fl, placed = fl.delivered) => (100 * (fl.deadTotal + fl.culls)) / Math.max(1, placed);
const f2 = (x) => (x == null ? '—' : x.toFixed(2));

/** Phase 2's brooding week (its ideal profile) with `patch(world)` before and `each(world)` on every env step. */
function brooding(seed, { patch, each, P = profileOf('ideal') } = {}) {
  const world = makeWorld(), { env, events, farm, records } = world;
  farm.start(LEVEL1, { seed });
  if (patch) patch(world);
  if (each) env.addStepper(() => each(world));
  let weighG = null;
  for (const ev of schedule(P)) {
    if (ev.t > env.day + 1e-9) env.skipHours((ev.t - env.day) * 24);
    const [kind] = ev.what.split(':');
    if (kind === 'cp' || kind === 'snap') continue;
    if (kind === 'sign') { records.sign(ev.d); continue; }
    applyRound(farm, env, ev.d, kind, P);
    if (kind === 'am' || kind === 'pm') { const n = farm.flock.deadOnFloor; if (n > 0) { events.emit(EV.DEAD_PICK, { n, causes: {}, carried: n }); farm.act('dead.count', { n, causes: {} }); } }
    if (kind === 'weigh') { const w = farm.stats.weighed.map((x) => x.weightG); weighG = w.reduce((a, b) => a + b, 0) / Math.max(1, w.length); }
  }
  const fl = farm.flock, chick = farm.stats.chickWeightMeasuredG ?? fl.chickWeightG;
  return { world, ratio: weighG / chick, fl, gasKg: farm.stats.gasKg ?? 0, uniformity: fl.uniformityPct };
}

if (part === 'hot') {
  // the hot season's brooding week: weather 'hot', the cycle climate, the daily sun, no warm-afternoon problem
  const sun = CONDITIONS.hot.sun;
  const patch = ({ env }) => {
    env.setWeather('hot'); env.setCycleClimate(true);
    env.weatherEvents = env.weatherEvents.filter((e) => e.id !== 'warm-afternoon');
    for (let d = -1; d <= 8; d++) env.addWeatherEvent({ id: `sun-${d}`, fromDay: d + sun.fromHour / 24, toDay: d + sun.toHour / 24, outsideDrop: 0, heatPerH: sun.perH });
  };
  // hot:ideal: the pad with one tunnel fan 11:00-18:00 from day 1 (the sign's timer stays)
  const pad = ({ env }) => {
    if (env.dayNumber < 1 || env.dayNumber > 7) return;
    const on = env.hour >= 11 && env.hour < 18;
    if (on && (env.fansManual !== 1 || !env.padOn)) { env.setFans(1); env.setPad(true); }
    if (!on && (env.fansManual || env.padOn)) { env.setFans(0); env.setPad(false); }
  };
  const P = { ...profileOf('ideal'), warm: 'none' };
  for (let seed = +s0; seed <= +s1; seed++) {
    const a = brooding(seed, { patch, each: pad, P }), b = brooding(seed, { patch, P });
    console.log(`hot brooding seed ${seed}: hot:ideal ratio ${f2(a.ratio)} deaths+culls ${f2(pct(a.fl))} % heat ${a.fl.deadByCause.heat} gas ${a.gasKg.toFixed(0)} kg`
      + ` | hotNoBroodAir ratio ${f2(b.ratio)} deaths+culls ${f2(pct(b.fl))} % heat ${b.fl.deadByCause.heat}`);
  }
  const n = brooding(+s0);
  console.log(`  normal-season ideal (cool): gas ${n.gasKg.toFixed(0)} kg, ratio ${f2(n.ratio)}`);
}

if (part === 'rainy') {
  // weeks 2-3 of Phase 3's ideal and noStep with the rainy season's weather, its damper spell and storms
  runCycle('ideal', { seed: +s0, from: 'plan', to: 'week2', stopAtStart: true }); // the standard start in the normal brooding week
  WEEK2.weather = 'rainy'; WEEK3.weather = 'rainy';
  WEEK2.problems = WEEK2.problems.map((p) => (p.id === 'rainy-spell' ? { ...p, rh: 97 } : p)).concat([{ id: 'storm-12', day: 12, hour: 14, outsideDrop: 4, rh: 98, until: { day: 12, hour: 18 } }]);
  WEEK3.problems = WEEK3.problems.concat([{ id: 'storm-19', day: 19, hour: 13, outsideDrop: 4, rh: 98, until: { day: 19, hour: 17 } }]);
  for (const name of ['ideal', 'noStep']) {
    const tr = runCycle(name, { seed: +s0, from: 'week2', to: 'week3' }), H = tr.hourly;
    const at = (d, h) => H.find((r) => r.day === d && r.hour === h);
    const nights = H.filter((r) => r.day >= 17 && r.day <= 21 && (r.hour >= 22 || r.hour <= 5));
    console.log(`rainy weeks 2-3 ${name}: pass ${JSON.stringify(Object.fromEntries(Object.entries(tr.levels).map(([k, v]) => [k, v.pass])))}`
      + ` day 21 ${at(21, 9).meanWeightG.toFixed(0)} g (${(100 * at(21, 9).meanWeightG / weightAt(21)).toFixed(1)} %), litter 15:00 day 21 ${at(21, 15).litterMean.toFixed(1)} %,`
      + ` NH3 nights 17-21 max ${Math.max(...nights.map((r) => r.nh3)).toFixed(1)} ppm`);
  }
  console.log('  (the rainy ideal\'s every-morning timer x 1.25 of PHASE4.md §4.2 was measured with a patched profile: day 21 975 g, litter 32.8 %, NH3 14 ppm)');
}

if (part === 'bad') {
  // a bad batch: the delivery of CONDITIONS.badChicks patched into Phase 2's flock (the truck hour and the yolk-sac
  // infection are left out: the infection adds about 0.9 % ungraded, 0.1 % graded, PHASE4.md §4.3)
  const D = CONDITIONS.badChicks.levels.level1.delivery;
  const base = structuredClone(FLOCK), chick0 = LEVEL1.chickWeightG;
  const run = (seed, { grade = 0, trays = false, warm = false } = {}) => {
    Object.assign(FLOCK, structuredClone(base));
    LEVEL1.chickWeightG = D.chickWeightG; FLOCK.chickSdG = D.chickWeightSdG; FLOCK.cv = D.cv; FLOCK.weakShare = D.weakShare; FLOCK.redHocks = D.redHockShare;
    FLOCK.late.base = trays ? D.lateBase - 0.03 : D.lateBase; FLOCK.boxFreeH = 1;
    FLOCK.weakRate = base.weakRate.map(([a, r]) => [a, r * (D.weakDeathShare / 0.35)]);
    let claimed = 0, done = false;
    const P = { ...profileOf('ideal'), setpointOffset: warm ? 1 : 0 };
    const each = ({ env, farm }) => {
      const fl = farm.flock;
      if (grade && !done && fl.delivered > 0 && fl.inBoxes === fl.delivered) {
        done = true;
        for (const st of fl.stacks) { const n = Math.round(st.weak * grade); st.weak -= n; st.chicks -= n; fl.inBoxes -= n; claimed += n; }
      }
      if (warm && env.dayNumber >= 4) P.setpointOffset = 0;
    };
    const r = brooding(seed, { each, P });
    LEVEL1.chickWeightG = chick0;
    return { ...r, claimed, placedPct: pct(r.fl, r.fl.delivered - claimed) };
  };
  for (let seed = +s0; seed <= +s1; seed++) {
    const ideal = run(seed, { grade: 0.9, trays: true, warm: true }), noGrade = run(seed), noTrays = run(seed, { grade: 0.9, warm: true });
    console.log(`bad batch seed ${seed}: bad:ideal ratio ${f2(ideal.ratio)} deaths+culls ${f2(ideal.placedPct)} % of placed, claimed ${(100 * ideal.claimed / ideal.fl.delivered).toFixed(1)} %, uniformity ${ideal.uniformity.toFixed(0)} %`
      + ` | badNoGrade ${f2(noGrade.placedPct)} % | badNoTrays ${f2(noTrays.placedPct)} % (starve-outs ${noTrays.fl.deadByCause.starveout} vs ${ideal.fl.deadByCause.starveout})`);
  }
}
