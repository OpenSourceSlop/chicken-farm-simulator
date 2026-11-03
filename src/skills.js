// Skill tree logic: points per branch from milestones (results of play, never questions),
// branch levels and the tools they unlock. Pure logic. Owner: package "sim" (phase2/sim).
// STUB: the milestone table is the contract (ids are referenced by PHASE2.md and the UI);
// evaluate() awards nothing yet.
//
// createSkills({ events, records, farm }) -> skills
//   evaluate(checkpoint, ctx) runs the milestone checks for that checkpoint and awards points
//   (emits EV.SKILL_POINTS, and EV.SKILL_UNLOCK when a level is reached). A milestone is earned
//   once per profile; a better result on a replay raises it to the higher tier only.
//   Checkpoints: 'placed' (all chicks out of the boxes), 'vent' (vent window closed), 'crop'
//   (crop window closed), 'day' (a record row closed; ctx.day), 'problem' (a problem fixed),
//   'weighin' (day 7 weighing finished), 'level-end'.
import { SKILL_BRANCHES, SKILL_LEVEL_POINTS, UNLOCKS } from './config.js';
import { EV } from './events.js';

/**
 * @typedef {{ id: string, branch: string, checkpoint: string, text: string,
 *   tiers: { points: number, rule: string }[] }} Milestone
 * `text` names the result in the farmer's words; `rule` is the measured condition (PHASE2.md).
 */
/** @type {Milestone[]} */
export const MILESTONES = [
  // Chick Arrival & Brooding
  { id: 'floor-ready', branch: 'brooding', checkpoint: 'placed', text: 'Floor at 28–30 °C when the chicks arrived',
    tiers: [{ points: 2, rule: 'litter surface >= 28 °C on >= 90 % of the brooding floor at the first tip' }] },
  { id: 'graded', branch: 'brooding', checkpoint: 'placed', text: 'Chick grading notes match the sample box',
    tiers: [{ points: 1, rule: 'navel, hock and reflex counts each within 1 of the 10 sampled chicks, box weighed' }] },
  { id: 'placed-fast', branch: 'brooding', checkpoint: 'placed', text: 'All chicks out of the boxes within an hour',
    tiers: [{ points: 1, rule: 'last stack tipped <= 60 game min after the truck stopped' }] },
  { id: 'vent-checked', branch: 'brooding', checkpoint: 'vent', text: 'Vent temperatures taken 2–3 hours after placing',
    tiers: [{ points: 1, rule: '>= 5 vent readings between 2 h and 3 h after placement, from >= 3 floor zones' }] },
  { id: 'crop-fill', branch: 'brooding', checkpoint: 'crop', text: 'Crops full at 24 hours',
    tiers: [{ points: 1, rule: 'true crop fill at 24 h >= 85 %' }, { points: 2, rule: '>= 95 %' }] },
  { id: 'steady-heat', branch: 'brooding', checkpoint: 'level-end', text: 'Chicks comfortable through the week',
    tiers: [{ points: 2, rule: 'comfortable-floor share >= 0.6 averaged over days 0-6 (sim metric)' }] },
  { id: 'day7-weight', branch: 'brooding', checkpoint: 'weighin', text: 'Day 7 weight against chick weight',
    tiers: [{ points: 1, rule: 'weighed mean >= 4.0 x chick weight' }, { points: 3, rule: '>= 4.5 x' }] },
  { id: 'low-mortality', branch: 'brooding', checkpoint: 'level-end', text: 'Week 1 deaths at or below 1 %',
    tiers: [{ points: 1, rule: '(deaths + culls) / placed <= 1.0 % by the end of day 7' }] },
  // Water
  { id: 'flushed-on-time', branch: 'water', checkpoint: 'placed', text: 'Lines flushed about 12 hours before the chicks',
    tiers: [{ points: 2, rule: 'all 4 lines ran clear, the last one finished 6-18 h before the truck' }] },
  { id: 'nipples-day0', branch: 'water', checkpoint: 'placed', text: 'Nipples at chick height when the chicks arrived',
    tiers: [{ points: 1, rule: 'all 4 lines within 2 cm of the day 0 nipple height at the first tip' }] },
  { id: 'flow-matched', branch: 'water', checkpoint: 'level-end', text: 'Water flow kept at age + 20 ml/min',
    tiers: [{ points: 2, rule: 'flow-tested and every line within 3 ml/min of age + 20 on >= 6 of days 0-7' }] },
  { id: 'drop-spotted', branch: 'water', checkpoint: 'problem', text: 'Water drop found on the day it started',
    tiers: [{ points: 2, rule: 'blocked-line problem found (symptom job opened by the farmer) the same flock day' }] },
  { id: 'leak-fixed', branch: 'water', checkpoint: 'problem', text: 'Leak fixed before the litter caked',
    tiers: [{ points: 1, rule: 'leaking nipple replaced <= 6 game h after it started' }] },
  { id: 'meter-daily', branch: 'water', checkpoint: 'level-end', text: 'Water meter read every morning',
    tiers: [{ points: 1, rule: 'meter read in the morning round on all of days 0-7' }] },
  { id: 'raised-with-flock', branch: 'water', checkpoint: 'weighin', text: 'Nipples raised as the birds grew',
    tiers: [{ points: 1, rule: 'all 4 lines within 3 cm of the day 7 nipple height at the weigh-in' }] },
  { id: 'ratio-steady', branch: 'water', checkpoint: 'level-end', text: 'Water to feed ratio steady all week',
    tiers: [{ points: 1, rule: 'recorded water:feed between 1.6 and 2.2 on >= 6 of days 1-7' }] },
];

export function createSkills({ events } = {}) {
  /** milestone id -> best tier index earned (profile, kept across replays) */
  const earned = new Map();

  const pointsOf = (branch) => {
    let p = 0;
    for (const m of MILESTONES) {
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
      return MILESTONES.filter((m) => m.branch === branch).map((m) => {
        const t = earned.has(m.id) ? earned.get(m.id) : null;
        return { ...m, tier: t, points: t == null ? 0 : m.tiers[t].points };
      });
    },
    /** @param {keyof typeof UNLOCKS} key */
    unlocked(key) { const u = UNLOCKS[key]; return !!u && levelOf(u.branch) >= u.level; },
    /** STUB: package "sim" checks the milestones of this checkpoint here. */
    evaluate(checkpoint, ctx = {}) { void checkpoint; void ctx; return []; },
    /** Award directly (used by evaluate and tests). Returns true when it raised the tier. */
    award(id, tier = 0, detail = '') {
      const m = MILESTONES.find((x) => x.id === id);
      if (!m || (earned.has(id) && earned.get(id) >= tier)) return false;
      const before = levelOf(m.branch);
      earned.set(id, tier);
      const total = pointsOf(m.branch), level = levelOf(m.branch);
      events && events.emit(EV.SKILL_POINTS, { branch: m.branch, milestone: id, points: m.tiers[tier].points, total, level, detail });
      if (level > before) for (const [key, u] of Object.entries(UNLOCKS)) if (u.branch === m.branch && u.level > before && u.level <= level) events && events.emit(EV.SKILL_UNLOCK, { key });
      return true;
    },
    reset() { earned.clear(); },
    serialize() { return { v: 1, earned: [...earned] }; },
    restore(d) { earned.clear(); for (const [k, v] of (d && d.earned) || []) earned.set(k, v); },
  };
  return skills;
}
