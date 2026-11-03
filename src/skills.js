// Skill tree logic: points per branch from milestones (results of play, never questions),
// branch levels and the tools they unlock. Pure logic. Owner: package "sim" (phase2/sim).
// The milestone table is the contract (ids are referenced by PHASE2.md and the UI); the measured
// conditions live in skills-rules.js. evaluate() runs only while farm.mode is 'level'.
//
// createSkills({ events, records, farm }) -> skills
//   Skills subscribe to the bus themselves; nobody calls evaluate() from outside:
//     EV.LEVEL { phase: 'checkpoint', name }   'placed' (last stack tipped), 'vent' / 'crop' (their
//                                              job windows closed), 'weighin', 'level-end' (level.js)
//     EV.FARM_PROBLEM { phase: 'found'|'fixed' } -> checkpoint 'problem'
//     EV.RECORD_CLOSED                          -> checkpoint 'day' (ctx.day)
//   evaluate(checkpoint, ctx) reads farm.stats, farm.problems, records (rows, notebook, jobLog) and
//   awards the milestones of that checkpoint. award() emits EV.SKILL_POINTS with the DELTA
//   (a replay that lifts day7-weight from tier 0 to tier 1 emits +2, not +3), and EV.SKILL_UNLOCK
//   when a branch level is reached. A milestone is kept per profile; a replay can only raise it.
//   Milestone texts are what the player sees: results in plain words, never praise or verdicts.
import { SKILL_BRANCHES, SKILL_LEVEL_POINTS, UNLOCKS } from './config.js';
import { EV } from './events.js';
import { RULES } from './skills-rules.js';
import { RULES_CYCLE } from './skills-rules-cycle.js';
// Phase 3: the milestones of the whole cycle (contract data; rules come with package "sim", PHASE3.md §9)
import { MILESTONES_CYCLE } from './skills-cycle.js';

/**
 * @typedef {{ id: string, branch: string, checkpoint: string, text: string,
 *   tiers: { points: number, rule: string }[] }} Milestone
 * `text` names the result in the farmer's words; `rule` is the measured condition (PHASE2.md §9).
 * Times: "first tip" = farm.stats.firstTipAt, "truck" = farm.stats.truckAt.
 */
/** @type {Milestone[]} */
export const MILESTONES = [
  // Chick Arrival & Brooding (max 14)
  { id: 'floor-ready', branch: 'brooding', checkpoint: 'placed', text: 'Floor at 28 °C or more when the chicks arrived',
    tiers: [{ points: 2, rule: 'stats.floorShareAtFirstTip >= 0.9 (litter surface >= 28 °C)' }] },
  { id: 'chick-weight', branch: 'brooding', checkpoint: 'placed', text: 'Chick weight measured before placing',
    tiers: [{ points: 1, rule: 'sample.box done before the first tip (stats.boxWeighedAt < stats.firstTipAt)' }] },
  { id: 'placed-fast', branch: 'brooding', checkpoint: 'placed', text: 'All chicks out of the boxes within 90 minutes',
    tiers: [{ points: 1, rule: 'stats.lastTipAt - stats.truckAt <= 90 game min' }] },
  { id: 'vent-checked', branch: 'brooding', checkpoint: 'vent', text: 'Vent temperatures taken 2–3 hours after placing',
    tiers: [{ points: 1, rule: '>= 5 stats.ventReadings inside the d0-vent window (first tip + 2 h .. + 3.5 h), >= 3 sectors' }] },
  { id: 'crop-fill', branch: 'brooding', checkpoint: 'crop', text: 'Crops full at 24 hours',
    tiers: [{ points: 1, rule: 'stats.cropFillTrue >= 0.85' }, { points: 2, rule: '>= 0.95' }] },
  { id: 'brooder-relit', branch: 'brooding', checkpoint: 'problem', text: 'Cold brooder found and relit the same morning',
    tiers: [{ points: 1, rule: 'brooder-out fixed by 12:00 on day 1' }] },
  { id: 'steady-heat', branch: 'brooding', checkpoint: 'level-end', text: 'Chicks comfortable through the week',
    tiers: [{ points: 2, rule: 'stats.comfortMinutes / stats.levelMinutes >= 0.95 (share of the chicks whose group e is within -1.5..+2 °C, age 0..7)' }] },
  { id: 'day7-weight', branch: 'brooding', checkpoint: 'weighin', text: 'Day 7 weight against chick weight',
    tiers: [{ points: 1, rule: 'weighed mean >= 4.0 x chick weight' }, { points: 3, rule: '>= 4.5 x' }] },
  { id: 'low-mortality', branch: 'brooding', checkpoint: 'level-end', text: 'Week 1 deaths at or below 1 %',
    tiers: [{ points: 1, rule: '(deaths + culls) / placed <= 1.0 % at the end of day 7 (chicks placed, flock age >= 7.0)' }] },
  // Water (max 11)
  { id: 'flushed-on-time', branch: 'water', checkpoint: 'placed', text: 'Lines flushed about 12 hours before the chicks',
    tiers: [{ points: 2, rule: 'all 4 lines ran clear, stats.flushDoneAt 6-18 h before stats.truckAt' }] },
  { id: 'nipples-day0', branch: 'water', checkpoint: 'placed', text: 'Nipples at chick height when the chicks arrived',
    tiers: [{ points: 1, rule: 'every stats.heightsAtFirstTip within 2 cm of nippleHeightCmAt(0) = 11 cm' }] },
  { id: 'flow-matched', branch: 'water', checkpoint: 'level-end', text: 'Water flow kept at age + 20 ml/min',
    tiers: [{ points: 2, rule: 'morning flow test of all 4 lines within 3 ml/min of HUD day + 20 on >= 6 of days 0-7' }] },
  { id: 'drop-spotted', branch: 'water', checkpoint: 'problem', text: 'Water drop traced on the next round',
    tiers: [{ points: 2, rule: 'blocked-filter found (symptom from a flow test or the filter gauges) by 12:00 on day 4' }] },
  { id: 'leak-fixed', branch: 'water', checkpoint: 'problem', text: 'Leak fixed before the litter caked',
    tiers: [{ points: 1, rule: 'leaking nipple replaced before its cell caked' }] },
  { id: 'meter-daily', branch: 'water', checkpoint: 'level-end', text: 'Water meter read every morning',
    tiers: [{ points: 1, rule: 'water.meter in the morning round on all of days 0-7' }] },
  { id: 'raised-with-flock', branch: 'water', checkpoint: 'weighin', text: 'Nipples raised as the birds grew',
    tiers: [{ points: 1, rule: 'all 4 lines within 3 cm of nippleHeightCmAt(7) = 17 cm at the weigh-in' }] },
  { id: 'ratio-steady', branch: 'water', checkpoint: 'level-end', text: 'Water to feed ratio steady all week',
    tiers: [{ points: 1, rule: 'recorded water:feed between 1.6 and 2.2 on >= 5 of days 1-7' }] },
];
// Phase 3: Phase 2's milestones and the cycle's in one table. Every Phase 2 milestone belongs to the brooding
// week (level 'level1'). evaluate() takes only the milestones of the checkpoint's level: ctx.level, else the
// level the run (EV.RUN level-start) or the level (EV.LEVEL checkpoints with `level`) last announced, else
// 'level1' (Phase 2's lone brooding week emits no level). So Phase 2's rules never run on later days (day7-weight
// at the day 14 weigh-in). The current skill tree still uses MILESTONES; package "sim" switches evaluate() to
// ALL_MILESTONES when the cycle rules exist (the cycle milestones of level 'level1' count only in a run, at
// the brooding week's level-end: ctx.run), package "run" its skill tree.
export const ALL_MILESTONES = [...MILESTONES.map((m) => ({ ...m, level: 'level1' })), ...MILESTONES_CYCLE];
const P2_IDS = new Set(MILESTONES.map((m) => m.id));
const byId = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

export function createSkills({ events, records, farm } = {}) {
  /** milestone id -> best tier index earned (profile, kept across replays) */
  const earned = new Map();
  let currentLevel = 'level1';      // the level of the bus checkpoints ('problem', 'day') and of checkpoints without one

  const pointsOf = (branch) => {
    let p = 0;
    for (const m of ALL_MILESTONES) {
      if (m.branch !== branch || !earned.has(m.id)) continue;
      p += m.tiers[earned.get(m.id)].points;
    }
    return p;
  };
  const levelOf = (branch) => SKILL_LEVEL_POINTS.filter((need) => pointsOf(branch) >= need).length;

  const skills = {
    branches() {
      return SKILL_BRANCHES.map((b) => ({ ...b, points: pointsOf(b.id), level: levelOf(b.id), needs: SKILL_LEVEL_POINTS }));
    },
    points: pointsOf,
    level: levelOf,
    /** Milestones of a branch with what was earned: [{ ...milestone, tier: index|null, points }] */
    milestones(branch) {
      return ALL_MILESTONES.filter((m) => m.branch === branch).map((m) => {
        const t = earned.has(m.id) ? earned.get(m.id) : null;
        return { ...m, tier: t, points: t == null ? 0 : m.tiers[t].points };
      });
    },
    /** @param {keyof typeof UNLOCKS} key */
    unlocked(key) { const u = UNLOCKS[key]; return !!u && levelOf(u.branch) >= u.level; },
    /**
     * Award the milestones of this checkpoint (PHASE3.md §9): only those of the checkpoint's level (ctx.level,
     * else the level last announced); at a level-end every milestone of the level. The cycle milestones of
     * 'level1' count only inside a run (ctx.run) at the brooding week's level-end, so the lone brooding week
     * awards exactly Phase 2's. Returns the awards made: [{ id, tier, delta }].
     */
    evaluate(checkpoint, ctx = {}) {
      const out = [];
      if (!farm || farm.mode !== 'level') return out;
      const level = ctx.level ?? currentLevel;
      for (const m of ALL_MILESTONES) {
        if (m.level !== level) continue;
        if (checkpoint !== 'level-end' && m.checkpoint !== checkpoint) continue;
        const p2 = P2_IDS.has(m.id);
        if (!p2 && level === 'level1' && !(ctx.run && checkpoint === 'level-end')) continue;
        const rule = p2 ? RULES[m.id] : RULES_CYCLE[m.id];
        let r = null;
        try { r = rule ? (p2 ? rule(farm, records) : rule(farm, records, { ...ctx, checkpoint })) : null; } catch (err) { console.error(`milestone ${m.id} rule failed`, err); }
        if (!r || r.tier == null) continue;
        const before = earned.has(m.id) ? m.tiers[earned.get(m.id)].points : 0;
        if (skills.award(m.id, r.tier, r.detail || '')) out.push({ id: m.id, tier: r.tier, delta: m.tiers[r.tier].points - before });
      }
      return out;
    },
    /** Award directly (used by evaluate and tests). Returns true when it raised the tier. */
    award(id, tier = 0, detail = '') {
      const m = byId.get(id);
      if (!m || (earned.has(id) && earned.get(id) >= tier)) return false;
      const before = levelOf(m.branch);
      const had = earned.has(id) ? m.tiers[earned.get(id)].points : 0;
      earned.set(id, tier);
      const total = pointsOf(m.branch), level = levelOf(m.branch);
      events && events.emit(EV.SKILL_POINTS, { branch: m.branch, milestone: id, tier, points: m.tiers[tier].points - had, total, level, detail });
      if (level > before) for (const [key, u] of Object.entries(UNLOCKS)) if (u.branch === m.branch && u.level > before && u.level <= level) events && events.emit(EV.SKILL_UNLOCK, { key });
      return true;
    },
    reset() { earned.clear(); },
    serialize() { return { v: 1, earned: [...earned] }; },
    restore(d) { earned.clear(); for (const [k, v] of (d && d.earned) || []) earned.set(k, v); },
  };
  // The bus drives the checkpoints (PHASE2.md §9): nobody else calls evaluate().
  if (events) {
    events.on(EV.RUN, (p) => { if (p && p.phase === 'level-start' && p.level) currentLevel = p.level; });
    events.on(EV.LEVEL, (p) => {
      if (p.phase === 'farm-start') currentLevel = 'level1';   // Phase 2's level.start (a run's later levels announce themselves after it)
      if (p.level) currentLevel = p.level;
      if (p.phase === 'checkpoint') skills.evaluate(p.name, p);
    });
    events.on(EV.FARM_PROBLEM, (p) => { if (p.phase === 'symptom' || p.phase === 'found' || p.phase === 'fixed') skills.evaluate('problem', p); });
    events.on(EV.RECORD_CLOSED, (p) => skills.evaluate('day', p));
  }
  return skills;
}
