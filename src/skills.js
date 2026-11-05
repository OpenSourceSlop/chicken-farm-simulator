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
import { SKILL_BRANCHES, UNLOCKS, conditionLevel, levelById, skillLevelPoints, levelFromPoints, unlockLevel, PAYOFFS, SKILLS_UPDATE } from './config.js';
import { EV } from './events.js';
import { RULES } from './skills-rules.js';
import { RULES_CYCLE } from './skills-rules-cycle.js';
// Phase 3: the milestones of the whole cycle (contract data; rules come with package "sim", PHASE3.md §9)
import { MILESTONES_CYCLE, needsProblemOf } from './skills-cycle.js';
// Phase 4: the conditions' milestones (contract data) and their rules (PHASE4.md §7, §9.4)
import { MILESTONES_COND } from './skills-cond.js';
import { RULES_COND } from './skills-rules-cond.js';
// Skills update (SKILLS.md §2.3): the seven milestones the update adds (contract data) and their rules, merged while live
import { MILESTONES_PAYOFF } from './skills-payoff.js';
import { RULES_PAYOFF } from './skills-rules-payoff.js';

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
// Phase 4: every milestone the skill tree shows and evaluate() weighs — the cycle's and the conditions' (MILESTONES_COND
// carry `condition`: only in a run of that condition). ALL_MILESTONES stays Phase 2 + the cycle (scripts/test-contracts.mjs).
export const ALL_MILESTONES_P4 = [...ALL_MILESTONES, ...MILESTONES_COND];
const P2_IDS = new Set(MILESTONES.map((m) => m.id));
const COND_IDS = new Set(MILESTONES_COND.map((m) => m.id));
const PAY_IDS = new Set(MILESTONES_PAYOFF.map((m) => m.id));
/** Skills update: every milestone with the update's seven (SKILLS.md §2.3); evaluated and shown only while live. */
export const ALL_MILESTONES_SKILLS = [...ALL_MILESTONES_P4, ...MILESTONES_PAYOFF];
/** The milestone table in force: Phase 5's, plus the update's seven while SKILLS_UPDATE.live. */
export const milestoneTable = () => (SKILLS_UPDATE.live ? ALL_MILESTONES_SKILLS : ALL_MILESTONES_P4);
const byId = new Map(ALL_MILESTONES_SKILLS.map((m) => [m.id, m]));
// the problem ids of a level as a condition plays it (needsProblem: a milestone of a dropped problem is not evaluated)
const PROBS = new Map();
const levelProblems = (level, condition) => {
  const k = `${level}|${condition || ''}`;
  if (!PROBS.has(k)) { const def = levelById(level); PROBS.set(k, new Set(def ? conditionLevel(def, condition || null).problems.map((p) => p.id) : [])); }
  return PROBS.get(k);
};
/** The milestone can be earned in a run of `condition`: its own condition, and the problem it measures on its level. */
export function milestoneInPlay(m, condition) {
  if (m.condition && m.condition !== (condition || null)) return false;
  const need = needsProblemOf(m);
  return !need || levelProblems(m.level, condition).has(need);
}

export function createSkills({ events, records, farm } = {}) {
  /** milestone id -> best tier index earned in either flock slot (the profile's; Phase 5's `earned`, kept across replays) */
  const earned = new Map();
  /** Skills update (SKILLS.md §2.2): milestone id -> [slot 1 tier | null, slot 2 tier | null] (slot 1: the first flock,
   *  profile.cyclesDone 0; slot 2: every later flock). While SKILLS_UPDATE.live is false only `earned` counts (Phase 5). */
  const flocks = new Map();
  let currentLevel = 'level1';      // the level of the bus checkpoints ('problem', 'day') and of checkpoints without one
  // Phase 4 (PHASE4.md §3.1, §7): the profile's cycles finished (any run) and the condition cycles played under one condition
  const profile = { cyclesDone: 0, conditionsDone: {} };
  const live = () => !!SKILLS_UPDATE.live;
  const tierPts = (m, t) => (t == null ? 0 : m.tiers[t].points);
  /** The flock slot an award goes to now: 1 once a cycle is finished (while live), else 0. */
  const slotNow = () => (live() && profile.cyclesDone >= 1 ? 1 : 0);
  const slotsOf = (id) => flocks.get(id) || [null, null];

  /** A branch's points: both slots while live (or one: slot 0 | 1), else the best tier of each milestone (Phase 5). */
  const pointsOf = (branch, { slot } = {}) => {
    let p = 0;
    for (const m of milestoneTable()) {
      if (m.branch !== branch) continue;
      if (!live()) { if (earned.has(m.id) && (slot == null || slot === 0)) p += tierPts(m, earned.get(m.id)); continue; }
      const s = slotsOf(m.id);
      if (slot == null) p += tierPts(m, s[0]) + tierPts(m, s[1]); else p += tierPts(m, s[slot]);
    }
    return p;
  };
  // Skills update (SKILLS.md §2.2, §13.2): the thresholds in force (config skillLevelPoints: [4, 9, 13] while
  // SKILLS_UPDATE.live, else Phase 2's [4, 9, 15]) and, while live, the level 3 gate (a finished flock: profile.cyclesDone
  // >= SKILLS_UPDATE.level3After; config levelFromPoints); a harness's forced level (skills.debug.force: never saved) wins
  const forced = new Map();
  const levelOf = (branch) => (forced.has(branch) ? forced.get(branch) : levelFromPoints(pointsOf(branch), profile.cyclesDone));
  /** The view unlocks (config UNLOCKS, level by unlockLevel) and, while live, the payoffs (config PAYOFFS) a branch level gives. */
  const keysAt = (branch, from, to) => [
    ...Object.entries(UNLOCKS).filter(([, u]) => u.branch === branch && unlockLevel(u) > from && unlockLevel(u) <= to).map(([key]) => ({ key })),
    ...(SKILLS_UPDATE.live ? Object.entries(PAYOFFS).filter(([, u]) => u.branch === branch && u.level > from && u.level <= to).map(([key]) => ({ key, payoff: true })) : []),
  ];

  const skills = {
    branches() {
      return SKILL_BRANCHES.map((b) => ({ ...b, points: pointsOf(b.id), level: levelOf(b.id), needs: skillLevelPoints() }));
    },
    /** The points for levels 1, 2, 3 in force (SKILLS.md §2.2). */
    levelPoints: () => skillLevelPoints(),
    /** points(branch) both flock slots while live; points(branch, { slot: 0 | 1 }) one slot (SKILLS.md §2.2). */
    points: (branch, opts) => pointsOf(branch, opts),
    level: levelOf,
    /** Milestones of a branch with what was earned: [{ ...milestone, tier: best index|null, points, tiers2: [slot 1, slot 2],
     *  points2: [p1, p2] }] (points: both slots while live; the best tier's otherwise, as Phase 5) */
    milestones(branch) {
      return milestoneTable().filter((m) => m.branch === branch).map((m) => {
        const t = earned.has(m.id) ? earned.get(m.id) : null, s = live() ? slotsOf(m.id) : [t, null];
        const points2 = [tierPts(m, s[0]), tierPts(m, s[1])];
        return { ...m, tier: t, points: live() ? points2[0] + points2[1] : tierPts(m, t), tiers2: [s[0], s[1]], points2 };
      });
    },
    /** Every milestone the tree shows and evaluate() weighs now (the update's seven while live). */
    allMilestones: () => milestoneTable(),
    /** The flock slot an award goes to now (0: the first flock, 1: a later one). */
    slotNow,
    /** @param {keyof typeof UNLOCKS} key */
    unlocked(key) {
      const u = UNLOCKS[key];
      if (u) return levelOf(u.branch) >= unlockLevel(u);
      // a payoff key (SKILLS.md §3): the branch level only — whether it acts is the perks' (perks.js: live, allowed, settings)
      const p = PAYOFFS[key];
      return !!p && SKILLS_UPDATE.live && levelOf(p.branch) >= p.level;
    },
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
      // Phase 4: the run's condition (the farm's: the only holder; checkpoints carry it as ctx.condition)
      const condition = ctx.condition !== undefined ? ctx.condition : farm.condition ?? null;
      for (const m of milestoneTable()) {
        if (m.level !== level) continue;
        if (checkpoint !== 'level-end' && m.checkpoint !== checkpoint) continue;
        if (!milestoneInPlay(m, condition)) continue;
        const p2 = P2_IDS.has(m.id), cond = COND_IDS.has(m.id);
        // the cycle's and the conditions' milestones of the brooding week count only inside a run, at its level-end
        // (a bad batch's are measured at their own checkpoints: placed, weighin, level-end)
        if (!p2 && !cond && level === 'level1' && !(ctx.run && checkpoint === 'level-end')) continue;
        if (cond && level === 'level1' && !ctx.run && !condition) continue;
        const rule = p2 ? RULES[m.id] : cond ? RULES_COND[m.id] : PAY_IDS.has(m.id) ? RULES_PAYOFF[m.id] : RULES_CYCLE[m.id];
        let r = null;
        try { r = rule ? (p2 ? rule(farm, records) : rule(farm, records, { ...ctx, checkpoint, skills })) : null; } catch (err) { console.error(`milestone ${m.id} rule failed`, err); }
        if (!r || r.tier == null) continue;
        const before = live() ? tierPts(m, slotsOf(m.id)[slotNow()]) : earned.has(m.id) ? m.tiers[earned.get(m.id)].points : 0;
        if (skills.award(m.id, r.tier, r.detail || '')) out.push({ id: m.id, tier: r.tier, delta: m.tiers[r.tier].points - before });
      }
      return out;
    },
    /** Award directly (used by evaluate and tests). Returns true when it raised the tier. */
    award(id, tier = 0, detail = '') {
      const m = byId.get(id);
      if (!m || !m.tiers[tier]) return false;
      // Skills update (SKILLS.md §2.2): while live the tier is kept per flock slot (a replay raises its slot only, a third
      // flock slot 2 only); else per profile (Phase 5: a later flock adds nothing)
      const slot = slotNow(), s = slotsOf(id);
      if (live() ? s[slot] != null && s[slot] >= tier : earned.has(id) && earned.get(id) >= tier) return false;
      const before = levelOf(m.branch);
      const had = live() ? tierPts(m, s[slot]) : earned.has(id) ? m.tiers[earned.get(id)].points : 0;
      const ns = [s[0], s[1]];
      ns[slot] = Math.max(ns[slot] ?? -1, tier);
      flocks.set(id, ns);
      earned.set(id, Math.max(earned.has(id) ? earned.get(id) : -1, tier));
      const total = pointsOf(m.branch), level = levelOf(m.branch);
      events && events.emit(EV.SKILL_POINTS, { branch: m.branch, milestone: id, tier, points: m.tiers[tier].points - had, total, level, detail, slot });
      if (level > before) for (const k of keysAt(m.branch, before, level)) events && events.emit(EV.SKILL_UNLOCK, k);
      return true;
    },
    reset() { earned.clear(); flocks.clear(); },
    /** Harness and node tests only (SKILLS.md §13.2): force a branch's level (null clears it); never saved. Emits
     *  EV.SKILL_UNLOCK for the keys it passes and EV.SKILL_POINTS-free: the perks listen to EV.SKILL_UNLOCK. */
    debug: {
      force(branch, level = null) {
        const before = levelOf(branch);
        if (level == null) forced.delete(branch); else forced.set(branch, Math.max(0, Math.min(3, Math.round(level))));
        const after = levelOf(branch);
        if (after > before) for (const k of keysAt(branch, before, after)) events && events.emit(EV.SKILL_UNLOCK, { ...k, forced: true });
        else if (after !== before) events && events.emit(EV.SKILL_UNLOCK, { key: null, branch, forced: true, level: after });
        return after;
      },
      forced() { return Object.fromEntries(forced); },
    },
    /** Phase 4: the profile's cycles (the gate of the harder flocks) — { cyclesDone, conditionsDone: { [id]: n } }: the live
     *  object (level.js keeps its counters in it and saves it; a harness may set __game.skills.profile.cyclesDone). */
    get profile() { return profile; },
    /** The run raises it at a cycle's end: every finished run counts; `condition` once the run was played under that one
     *  condition from its start level through the clean-out (PHASE4.md §3.1). Returns the profile. */
    cycleDone({ condition = null, underOne = true } = {}) {
      const before = SKILL_BRANCHES.map((b) => levelOf(b.id));
      profile.cyclesDone += 1;
      if (condition && underOne) profile.conditionsDone[condition] = (profile.conditionsDone[condition] || 0) + 1;
      // Skills update (SKILLS.md §2.2): the finished flock opens the level 3 gate (while live): the payoffs it passes unlock
      // now (EV.SKILL_UNLOCK { key, payoff, gate: true }; the unlock caption waits for the next level start)
      SKILL_BRANCHES.forEach((b, i) => { const after = levelOf(b.id); if (after > before[i]) for (const k of keysAt(b.id, before[i], after)) events && events.emit(EV.SKILL_UNLOCK, { ...k, gate: true }); });
      return skills.profile;
    },
    /** Set the profile's fields (a profile store without them reads 0: the run may pass lastCycle's 1). */
    setProfile(p = {}) {
      if (Number.isFinite(p.cyclesDone)) profile.cyclesDone = Math.max(0, Math.floor(p.cyclesDone));
      if (p.conditionsDone && typeof p.conditionsDone === 'object') profile.conditionsDone = Object.fromEntries(Object.entries(p.conditionsDone).filter(([, n]) => Number.isFinite(n)));
    },
    // Skills update (SKILLS.md §11): v2 { earned (the best of either slot, for a Phase 5 reader), flocks: [[id, slot 1, slot 2]],
    // cyclesDone, conditionsDone } while live, or once a slot-2 tier exists; v1 exactly as Phase 5 otherwise
    serialize() {
      const prof = profile.cyclesDone || Object.keys(profile.conditionsDone).length ? { cyclesDone: profile.cyclesDone, conditionsDone: { ...profile.conditionsDone } } : {};
      const two = [...flocks.values()].some((x) => x[1] != null);
      if (!live() && !two) return { v: 1, earned: [...earned], ...prof };
      return { v: 2, earned: [...earned], flocks: [...flocks].map(([k, x]) => [k, x[0] ?? null, x[1] ?? null]), cyclesDone: profile.cyclesDone, conditionsDone: { ...profile.conditionsDone } };
    },
    restore(d) {
      earned.clear(); flocks.clear();
      for (const [k, v] of (d && d.earned) || []) earned.set(k, v);
      // v2: the slots as saved; v1 (a Phase 2-5 profile): every tier into slot 1
      if (d && d.v === 2 && Array.isArray(d.flocks)) {
        for (const [k, a, b] of d.flocks) flocks.set(k, [Number.isFinite(a) ? a : null, Number.isFinite(b) ? b : null]);
        for (const [k, v] of earned) if (!flocks.has(k)) flocks.set(k, [v, null]);
      } else for (const [k, v] of earned) flocks.set(k, [v, null]);
      profile.cyclesDone = (d && Number.isFinite(d.cyclesDone)) ? d.cyclesDone : 0; profile.conditionsDone = d && d.conditionsDone ? { ...d.conditionsDone } : {};
      // Skills update (SKILLS.md §4.2, review issue 4): a restored profile (level.profile.restore after a standard start, a
      // loaded save) may change what the skills give: the perks refresh on this and level.js re-syncs farm.auto.on on the
      // EV.PERKS that follows. key null: no unlock caption (listeners of EV.SKILL_UNLOCK skip key null)
      events && events.emit(EV.SKILL_UNLOCK, { key: null, restore: true });
    },
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
