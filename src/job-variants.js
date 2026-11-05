// Job variants: a job as the farmer's payoffs make it (SKILLS.md §3, §4.3, §12.6). Pure logic. Owner: package "jobs".
// No variant changes a job's sample size (the boards' 5 vent chicks, 10 crops, 50 birds hold) and no variant touches a
// problem job's rule (a problem job may only get new places: the pocket phone, the silo gauge).
//
//   jobVariant(jd, perks, ctx?) -> jd'   the job definition as the payoffs give it now, made when an instance is made
//                                        (job-engine.js createJobEngine({ variant }) calls it in make(); restore() uses
//                                        rebuildVariant with the saved variant):
//     - a job the equipment takes a part of (perks.handled(jd.id): [{ system, part, label, reading, glanceAt }], from config
//       AUTO_SYSTEMS[system].jobs = { jobId: part }):
//         part 'whole': done = { type: 'any', handled: system, label, of: [GLANCE(system), jd.done] }
//         part '<state test>' (r-raise: 'drinkers-raised' for the winch, 'pans-raised' for the feed): r-raise's
//           lines-raised splits into all[ drinkers-raised, pans-raised ] and only that part becomes any[ GLANCE, part ];
//           the other part stays the farmer's (a system off, a fault open: its manual part as before)
//       GLANCE(system) = { type: 'all', glance: system, of: [{ type: 'state', test: 'auto-ok', system, part, live: true, label:
//         AUTO_SYSTEMS[system].keeps }, { type: 'action', id: 'auto.glance', match: { system }, label: 'Look at <reading> (<place>)' }] }
//       r-drinkers and r-feeders are never handed over (their flow tests and readings stay the farmer's; the controllers
//       only keep their live tests true)
//     - a job a level 2 (or a level 3 without equipment) payoff moves or shortens (no new sample size, a new way to meet it):
//         waterAllLines  r-drinkers' `each` part and its flows-in-band take the sight tubes (tubes: true): a line whose tube
//                        read in band since the job opened (water.columns; the farm's water.lines[i].lastColumn) counts as
//                        tested; places: the water supply first, then only the regulators of lines that read off
//         passCheck      w2-check: the ten birds from three parts of the floor may be birds seen walking (rule type 'seen':
//                        EV.BIRD_SEEN look 'gait') or birds checked in the hand (sample.bird look gait), as before
//         siloOrder      the order jobs' places: the silo gauge as well as the office phone (rule as before)
//         pocketPhone    the phone jobs' places: the phone, anywhere (the card's Next line reads 'press {key:phone}')
//         phoneRecord    r-record's / prep-record's place: the phone (Sign today's record)
//         tallyBucket    r-dead-am / r-dead-pm: title 'Pick up dead birds (the tally counts them) and empty the bucket at
//                        the bin'; the rule as before (dead-cleared: the bucket emptied at the bin)
//         frameWeigh     the weigh jobs' rule as before (50 birds from 5 places); the strip names Weigh the frame
//     - jd'.variant = { v: VARIANT_V, keys: [payoff keys applied], parts: { [system]: part } } (saved with the instance: a
//       resume makes the same rule, whatever the perks are then)
//   variantKeyOf(jd') -> 'key1+key2' | ''   what the engine saves beside the instance
//   rebuildVariant(jd, saved, perks) -> jd' the saved instance's rule (its keys and parts as saved, whatever the perks are now)
// The glance: a panel of AUTO_SYSTEMS[system].glanceAt open AUTO.glanceSec with perks.auto(system) sends ui-only
// auto.glance { system } once per opening (the bird scale's display sends scale.read too; the variant matches auto.glance).
import { AUTO_SYSTEMS, PAYOFFS, SKILLS_UPDATE } from './config.js';

export const VARIANT_V = 1;
/** The payoffs that change a job's rule, title or places (the rest only add strip rows and keys at the panels). */
export const RULE_KEYS = ['waterAllLines', 'passCheck', 'siloOrder', 'pocketPhone', 'phoneRecord', 'tallyBucket', 'frameWeigh'];
/** Of those, the ones that only move the places (allowed on a problem job too: its rule never changes). */
export const PLACE_KEYS = new Set(['siloOrder', 'pocketPhone', 'phoneRecord']);
/** The words of a handed-over part (the job card's "drinker lines: handled by …"); 'whole' has none. */
export const PART_WORDS = { 'drinkers-raised': 'drinker lines', 'pans-raised': 'feeder lines', whole: '' };
/** Where each system's reading is looked at, in words (AUTO_SYSTEMS[s].glanceAt as the farmer finds them). */
export const GLANCE_WORDS = {
  winch: 'at the water supply or a line regulator', timer: 'at the climate controller', stages: 'at the climate controller or the fan panel',
  brooders: 'at the climate controller', feed: 'at the silo gauge or the feeder box', lights: 'at the climate controller', scale: 'at the bird scale',
};
/** A named part's own reading and place (r-raise: the line heights for the winch, the rims for the feed controller). */
export const PART_READING = { 'drinkers-raised': 'the four line heights at the water supply or a line regulator', 'pans-raised': 'the pan rims at the feeder box' };
export const DEAD_TITLE = 'Pick up dead birds (the tally counts them) and empty the bucket at the bin';
const DEAD_JOBS = new Set(['r-dead-am', 'r-dead-pm']);

/** A copy of a job definition that keeps its getters (the {key:id} titles read the key as bound now). */
function copyDef(jd) { return Object.defineProperties({}, Object.getOwnPropertyDescriptors(jd)); }
const setProp = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true });

/** The glance part of a handed-over job: the reading in band (live) and a look at it. */
export function glanceRule(system, part = 'whole') {
  const s = AUTO_SYSTEMS[system];
  const look = `Look at ${PART_READING[part] || `${s.reading} ${GLANCE_WORDS[system] || ''}`}`.trim();
  return { type: 'all', glance: system, label: look, of: [
    { type: 'state', test: 'auto-ok', system, part, live: true, label: s.keeps },
    { type: 'action', id: 'auto.glance', match: { system }, label: look }] };
}
const LABEL_DRINKERS = 'Drinker lines at the drinker plate’s height for the birds’ size (±3 cm)';
const LABEL_PANS = 'Feeder pans at the feeder plate’s rim height (±3 cm)';
/** r-raise's lines-raised as its two parts (the drinker winches, the feeder rims). */
function splitRaise(done) {
  if (done && done.type === 'state' && done.test === 'lines-raised') {
    return { type: 'all', label: done.label, of: [{ type: 'state', test: 'drinkers-raised', label: LABEL_DRINKERS }, { type: 'state', test: 'pans-raised', label: LABEL_PANS }] };
  }
  return done;
}
/** The part `part` of an all-rule (by its state test) handed to `system`: any[ GLANCE, the part ]. */
function handPart(done, system, part) {
  const d = splitRaise(done);
  if (!d || d.type !== 'all') return d;
  let hit = false;
  const of = d.of.map((r) => {
    if (hit || r.type !== 'state' || r.test !== part) return r;
    hit = true;
    const words = PART_WORDS[part] || part;
    return { type: 'any', handled: system, part, label: `${words[0].toUpperCase()}${words.slice(1)}: the controller keeps them, or by hand`, of: [glanceRule(system, part), { ...r, label: r.label || words }] };
  });
  return hit ? { ...d, of } : d;
}
/** r-drinkers with the sight tubes (Water 2): the each part and the live part accept an in-band tube read since the job opened. */
function tubesRule(done) {
  if (!done || done.type !== 'all') return done;
  return { ...done, of: done.of.map((r) => {
    if (r.type === 'each' && r.id === 'water.flowtest') return { ...r, tubes: true, label: 'Every line tested: its sight tube in band at the water supply, or a cup test at its regulator' };
    if (r.type === 'state' && r.test === 'flows-in-band') return { ...r, tubes: true, label: 'Every line’s flow (sight tube or cup test) within 3 ml/min of age + 20, nipples at the plate’s height' };
    return r;
  }) };
}
/** w2-check with the passing check (Biosecurity 3): ten birds from three parts, seen walking or checked in the hand. */
function seenRule(done) {
  if (!done || done.type !== 'count' || done.id !== 'sample.bird') return done;
  return { type: 'seen', look: 'gait', n: done.n, sectors: done.sectors, sectorsOf: done.sectorsOf, action: { id: done.id, match: done.match },
    label: `${done.n} birds from ${done.sectors} parts of the floor: seen walking as you pass, or watched walking in the hand` };
}

/** The job with the given payoff keys and handed-over parts applied (the one builder: make and resume). */
export function applyVariant(jd, { keys = [], parts = {} } = {}) {
  if (!jd || (!keys.length && !Object.keys(parts).length)) return jd;
  const problem = jd.kind === 'problem';
  const has = (k) => keys.includes(k) && (!problem || PLACE_KEYS.has(k));
  let done = jd.done, title = null;
  if (has('waterAllLines') && jd.id === 'r-drinkers') done = tubesRule(done);
  if (has('passCheck') && jd.id === 'w2-check') done = seenRule(done);
  if (has('tallyBucket') && DEAD_JOBS.has(jd.id)) title = DEAD_TITLE;
  if (!problem) {
    for (const [system, part] of Object.entries(parts)) {
      if (!AUTO_SYSTEMS[system]) continue;
      if (part === 'whole') {
        const orig = done.label ? done : { ...done, label: 'Or by hand, as before' };
        done = { type: 'any', handled: system, part, label: `${AUTO_SYSTEMS[system].label}: the controller keeps it, or by hand`, of: [glanceRule(system, part), orig] };
      } else done = handPart(done, system, part);
    }
  }
  const out = copyDef(jd);
  setProp(out, 'done', done);
  if (title) setProp(out, 'title', title);
  setProp(out, 'variant', { v: VARIANT_V, keys: [...keys], parts: problem ? {} : { ...parts } });
  return out;
}

/** The job as the payoffs give it now (perks: perks.js; off, not allowed or live false: the job as it is). */
export function jobVariant(jd, perks, ctx = {}) {
  void ctx;
  if (!jd || !perks || !SKILLS_UPDATE.live) return jd;
  const keys = [], parts = {};
  let handled = [];
  try { handled = jd.kind === 'problem' ? [] : perks.handled(jd.id) || []; } catch { handled = []; }
  for (const h of handled) { if (!(h.system in parts)) { parts[h.system] = h.part; keys.push(h.key); } }
  for (const k of RULE_KEYS) {
    const p = PAYOFFS[k];
    if (!p || !(p.jobs || []).includes(jd.id)) continue;
    if (jd.kind === 'problem' && !PLACE_KEYS.has(k)) continue;
    let on = false;
    try { on = !!perks.has(k); } catch { on = false; }
    if (on && !keys.includes(k)) keys.push(k);
  }
  return keys.length || Object.keys(parts).length ? applyVariant(jd, { keys, parts }) : jd;
}
export const variantKeyOf = (jd) => (jd && jd.variant && jd.variant.keys ? jd.variant.keys.join('+') : '');
/** The saved instance's rule: its keys and parts as saved (a resume makes the same rule, whatever the perks are now). */
export function rebuildVariant(jd, saved, perks) {
  void perks;
  if (!jd || !saved || (saved.v ?? VARIANT_V) > VARIANT_V) return jd;
  return applyVariant(jd, { keys: Array.isArray(saved.keys) ? saved.keys : [], parts: saved.parts && typeof saved.parts === 'object' ? saved.parts : {} });
}
/** The system of an instance's handed-over parts: [{ system, part }] (from its variant). */
/** The job's own rule (and its state) under a whole hand-over any[ GLANCE, the job as before ] (integration): the code
 *  that reads a rule's shape — level.js's weigh-in checkpoint and sample jobs, job-next's frame places — reads this one, so
 *  a weigh job handed to the bird scale (Growth 3) still ends its week on the signing and still leads the frame. */
export function baseRule(def, st) {
  let r = def?.done, s = st;
  while (r && r.type === 'any' && r.handled && r.part === 'whole' && Array.isArray(r.of) && r.of.length === 2) { r = r.of[1]; s = s?.parts?.[1]; }
  return { rule: r, st: s };
}
const baseId = (def) => baseRule(def).rule?.id;
/** The id of the action the job's own rule counts (sample.weigh, chicks.grade …), under any whole hand-over. */
export const baseDoneId = baseId;
export const handedParts = (def) => Object.entries(def?.variant?.parts || {}).map(([system, part]) => ({ system, part }));
/** The variant applied a payoff key to this job (the rule, title or places of the instance). */
export const variantHas = (def, key) => !!def?.variant?.keys?.includes(key);
