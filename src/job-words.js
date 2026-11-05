// The words of the payoffs where the farmer meets them (SKILLS.md §6): the job card's "would be easier" and "handled" lines,
// the strips' "easier now" rows and view lines, the unlock caption and the gate's one caption, the tree's next-level line.
// Pure (node and browser): every text is plain English with no verdict word; keys as {key:id} tokens, filled when drawn
// (key-words.js fillKeys). No farming fact here: the figures stay on the signs, the payoffs only say what they do and where.
// Owner: package "jobs".
import { PAYOFFS, AUTO_SYSTEMS, UNLOCKS, UNLOCK_SHOWS, SKILL_VIEWS, SKILL_SHORT, SKILL_STEP_NAMES, SKILL_BRANCHES, unlockLevel, skillLevelPoints } from './config.js';
import { PART_WORDS, PART_READING, GLANCE_WORDS, handedParts } from './job-variants.js';

const lower = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const upper = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** "Water 2" for a payoff or a view (its branch's short name and its level now). */
export const levelName = (branch, level) => `${SKILL_SHORT[branch] || branch} ${level}`;
const branchOf = (key) => PAYOFFS[key]?.branch || UNLOCKS[key]?.branch || null;

/** Each payoff in a few words for the job card's would-be-easier line ("Growth 2: weigh the frame in one press"). */
export const PAYOFF_CARD = {
  waterAllLines: 'read the sight tubes at the water supply', autoWinch: 'the winches keep the drinker lines at the plate',
  ventFill: 'the calculator fills the timer in one press', autoTimer: 'the controller steps the timer up with the flock',
  fanAdvice: 'the fans and the pad suggested for now, set in one press', autoStages: 'the controller keeps the fan stage table for the age',
  brooderRow: 'one press sets the thermostat to the brooder sign’s row', autoBrooders: 'the brooders follow the brooder sign’s curve',
  quickSamples: 'Next chick and a longer reach for the samples', boxHelper: 'a helper tips half the chick boxes with you',
  siloOrder: 'order at the silo gauge, in days of feed', autoFeed: 'feed orders itself and the feeder lines rise',
  weekLights: 'one press sets the light program for the age', autoLights: 'the controller changes the light program with the age',
  frameWeigh: 'weigh the frame in one press', autoScale: 'read the automatic scale’s day average',
  earlyWarning: 'the flock watch warns two farm hours earlier and names the fix', comfortAlways: 'the comfort colours show whenever you are inside',
  tallyBucket: 'the tally bucket picks up and counts the dead birds', passCheck: 'birds you walk past show a symptom tag',
  pocketPhone: 'the phone in your pocket ({key:phone})', phoneRecord: 'sign the day’s record on the phone',
};
/** The strip's "easier now" row of a payoff that holds, at the job's place (SKILLS.md §6.2). */
export const PAYOFF_NOW = {
  waterAllLines: 'read the sight tubes at the water supply (a cup test only on a line that reads off)',
  ventFill: 'Fill the timer works the seconds out from your count and weight (the working is under the key)',
  fanAdvice: 'Set as suggested sets the fans and the pad by the heat sign (the working is beside the key)',
  brooderRow: 'Set to the sign’s row sets the thermostat in one press (the row is beside the key)',
  quickSamples: 'Next chick puts this chick down and takes the next one near it',
  siloOrder: 'Order to 3 days at the silo gauge (the working is beside the key)',
  weekLights: 'Program for the days sets the light program for the age in one press (the sign’s row is beside the key)',
  frameWeigh: 'the Weigh the frame key weighs its ten birds in one press; the marker leads to the next part of the house',
  earlyWarning: 'the flock watch warns two farm hours earlier; Show me on its card opens the fix',
  comfortAlways: 'the comfort colours show while you are inside ({key:comfortView} turns them off for the visit)',
  tallyBucket: 'the tally bucket picks up every dead bird near you and counts them as you pick them up; empty it at the bin',
  passCheck: 'walk slowly past the birds: each bird you see walk counts, and a tag shows a bird to check in the hand',
  boxHelper: 'once the sample box is weighed, a helper tips the next stack with you',
  pocketPhone: 'the phone in your pocket: {key:phone} from anywhere',
  phoneRecord: 'Sign today’s record on the phone ({key:phone})',
};

/** The job card's one line under the title: the next payoff that eases the job and is not held yet (perks.easier). */
export function easierLine(easier = []) {
  const e = (easier || []).find((x) => !x.has && (x.toGo > 0 || x.later));
  if (!e) return '';
  const what = PAYOFF_CARD[e.key] || lower(e.name);
  const tail = e.later ? (e.toGo > 0 ? `${plural(e.toGo, 'point')} to go, then with your next flock` : 'with your next flock') : `${plural(e.toGo, 'point')} to go`;
  return `${levelName(e.branch, e.level)}: ${what} · ${tail}`;
}
/** The strip's first rows: each payoff that holds for this job, in words (level 3 equipment shows as handled lines). */
export function easierNowRows(easier = []) {
  return (easier || []).filter((e) => e.has && PAYOFF_NOW[e.key]).map((e) => `${levelName(e.branch, e.level)}: ${PAYOFF_NOW[e.key]}`);
}

/** What the farmer does by hand while a system's fault is open (the job card's manual part, shown first). */
export const FAULT_MANUAL = {
  'winch-stall': (f) => `Line ${(f?.args?.line ?? f?.line ?? 0) + 1}: by hand at its regulator (the winch motor stalled)`,
  'timer-reset': () => 'The timer: by hand at the climate controller (it restarted on its first setting)',
  'stage-trip': () => 'The tunnel fans: by hand at the fan panel or the controller (the fan stages are off)',
  'sensor-drift': () => 'The thermostat: by hand at the climate controller, and check the sensor against the thermometer (it reads high)',
  'order-lost': () => 'The feed order: by hand, on the phone or at the silo gauge (the mill has not confirmed the order)',
  'scale-fouled': () => 'The weighing: by hand with the frame, and clean the platform (the scale reads light)',
};
/** The open faults of the farm (farm.autoCtl.status().faults; [] without the model). */
export function openFaultsOf(farm) {
  try { return (farm?.autoCtl?.status?.()?.faults || []).filter((f) => f && (f.phase == null || f.phase === 'open')); } catch { return []; }
}
/**
 * One line per handed-over part of an instance (SKILLS.md §4.3, §5.3, §6.2): "drinker lines: handled by the controller
 * (Water 3) · look at the four line heights at the water supply or a line regulator"; a part whose system has a fault open
 * leads with its manual line. -> [{ text, system, part, fault }]
 */
export function handledLines(inst, farm) {
  const parts = handedParts(inst?.def);
  if (!parts.length) return [];
  const faults = openFaultsOf(farm), out = [];
  for (const { system, part } of parts) {
    const s = AUTO_SYSTEMS[system];
    if (!s) continue;
    const words = PART_WORDS[part] ?? part, label = `handled by the controller (${levelName(s.branch, PAYOFFS[s.payoff]?.level ?? 3)})`;
    const f = faults.find((x) => x.system === system);
    if (f) { out.push({ text: (FAULT_MANUAL[f.id] || (() => `${upper(s.label)}: by hand (${lower(f.what || 'the equipment stopped')})`))(f), system, part, fault: true }); continue; }
    out.push({ text: `${words ? `${words}: ${label}` : upper(label)} · look at ${PART_READING[part] || `${s.reading} ${GLANCE_WORDS[system] || ''}`}`.trim(), system, part, fault: false });
  }
  return out.sort((a, b) => b.fault - a.fault);
}

/** The level 1 view's line in the strips of the jobs it helps (SKILLS.md §3.0): unlocked or would-show, once per job. */
export function viewLine(viewKey, skills) {
  const v = SKILL_VIEWS[viewKey], u = UNLOCKS[viewKey];
  if (!v || !u) return '';
  const name = levelName(u.branch, 1), key = v.keyId ? `{key:${v.keyId}}` : null;
  let has = false, pts = 0;
  try { has = !!skills?.unlocked?.(viewKey); pts = skills?.points?.(u.branch) ?? 0; } catch { has = false; }
  if (has) return key ? `Your ${name} view: ${key} shows ${v.shows}` : `Your ${name} view, ${/^(the|a|an)\b/i.test(String(v.where)) ? 'at ' : ''}${v.where}: ${v.shows}`;
  const toGo = Math.max(0, skillLevelPoints()[0] - pts);
  return `${name} would show ${v.shows}${key ? ` (${key})` : ''}${toGo > 0 ? ` · ${plural(toGo, 'point')} to go` : ''}`;
}
/** The level 1 views whose strip line belongs to a job. */
export const viewsOfJob = (jobId) => Object.entries(SKILL_VIEWS).filter(([, v]) => (v.jobs || []).includes(jobId)).map(([k]) => k);

/** The unlock caption of one branch's new level (SKILLS.md §6.3): its payoff (step, name, where, saves) and its views. */
/** "Use it at the fan panel" / "Use it anywhere in a level" / "Use it inside the house": at only before a named place. */
const useAt = (w) => (/^(the|a|an)\b/i.test(String(w)) ? `Use it at ${w}` : `Use it ${w}`);
export function unlockCaption(keys = []) {
  const ks = keys.map((k) => (typeof k === 'string' ? k : k?.key)).filter(Boolean);
  if (!ks.length) return '';
  const pay = ks.find((k) => PAYOFFS[k]), views = ks.filter((k) => UNLOCKS[k]);
  if (pay) {
    const p = PAYOFFS[pay];
    const also = views.length ? ` Also: ${views.map((v) => `${lower(UNLOCKS[v].name)} (${UNLOCK_SHOWS[v] || ''})`).join('; ')}.` : '';
    const off = p.step === 'auto' ? ' You can switch it off in Settings → Automation.' : '';
    return `${levelName(p.branch, p.level)} · ${SKILL_STEP_NAMES[p.level - 1]}: ${lower(p.name)}. ${useAt(p.where)}. ${p.saves}.${also}${off}`;
  }
  const v = views[0], u = UNLOCKS[v], lvl = unlockLevel(u);
  const where = SKILL_VIEWS[v]?.where ? ` ${useAt(SKILL_VIEWS[v].where)}.` : '';
  const shows = UNLOCK_SHOWS[v] ? ` (${UNLOCK_SHOWS[v]})` : '';
  return `${levelName(u.branch, lvl)} · ${SKILL_STEP_NAMES[Math.max(0, lvl - 1)]}: ${lower(u.name)}${shows}.${where}`;
}
/** The review round: the unlock's caption in one short line (the full words stay in the notebook line and on the tree):
 *  "Water 2 · Faster unlocked: read all four sight tubes at the water supply (skill tree {key:skills})". */
export function unlockShort(keys = []) {
  const ks = keys.map((k) => (typeof k === 'string' ? k : k?.key)).filter(Boolean);
  if (!ks.length) return '';
  const pay = ks.find((k) => PAYOFFS[k]), v = ks.find((k) => UNLOCKS[k]);
  const name = (n) => lower(String(n || '').replace(/[;:,].*$/, '').replace(/\s*\([^)]*\)\s*$/, ''));
  if (pay) { const p = PAYOFFS[pay]; return `${levelName(p.branch, p.level)} · ${SKILL_STEP_NAMES[p.level - 1]} unlocked: ${name(p.name)} (skill tree {key:skills})`; }
  if (!v) return '';
  const u = UNLOCKS[v], lvl = unlockLevel(u);
  return `${levelName(u.branch, lvl)} · ${SKILL_STEP_NAMES[Math.max(0, lvl - 1)]} unlocked: ${name(u.name)} (skill tree {key:skills})`;
}
/** The unlocks of a batch grouped by branch and level, in the tree's branch order: [[keys of one level-up], …]. */
export function groupUnlocks(list = []) {
  const by = new Map();
  for (const it of list) {
    const k = typeof it === 'string' ? it : it?.key;
    const b = branchOf(k);
    if (!b) continue;
    const lvl = PAYOFFS[k]?.level ?? unlockLevel(UNLOCKS[k]);
    const g = `${b}|${lvl}`;
    if (!by.has(g)) by.set(g, []);
    if (!by.get(g).includes(k)) by.get(g).push(k);
  }
  const order = SKILL_BRANCHES.map((b) => b.id);
  return [...by.entries()].sort(([a], [b]) => order.indexOf(a.split('|')[0]) - order.indexOf(b.split('|')[0]) || +a.split('|')[1] - +b.split('|')[1]).map(([, v]) => v);
}
/** The finished flock's level 3 unlocks as one caption (SKILLS.md §1.2, §6.3). */
export function gateCaption(list = []) {
  const keys = list.map((it) => (typeof it === 'string' ? it : it?.key)).filter((k) => PAYOFFS[k]?.level === 3);
  const order = SKILL_BRANCHES.map((b) => b.id);
  const branches = [...new Set(keys.map((k) => PAYOFFS[k].branch))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!branches.length) return '';
  const n = branches.length, names = n <= 3 ? `: ${branches.map((b) => SKILL_SHORT[b]).join(', ')}` : '';
  return `Level 3 now: the equipment does it in ${n} branch${n === 1 ? '' : 'es'}${names} (Settings → Automation switches each off).`;
}
/** The tree card's next-level line (SKILLS.md §6.1): "Level 2 · Faster: read all four sight tubes … — 3 points to go". */
export function nextLevelLine(branch, level, points, cyclesDone = 0) {
  if (level >= 3) return '';
  const next = level + 1, key = Object.keys(PAYOFFS).find((k) => PAYOFFS[k].branch === branch && PAYOFFS[k].level === next);
  const view = Object.keys(UNLOCKS).find((k) => UNLOCKS[k].branch === branch && unlockLevel(UNLOCKS[k]) === next);
  const what = key ? lower(PAYOFFS[key].name) : view ? lower(UNLOCKS[view].name) : '';
  const toGo = Math.max(0, skillLevelPoints()[next - 1] - points);
  const later = next === 3 && !(cyclesDone > 0);
  const tail = later ? (toGo > 0 ? `${plural(toGo, 'point')} to go, then it comes with your next flock` : 'comes with your next flock') : `${plural(toGo, 'point')} to go`;
  return `Level ${next} · ${SKILL_STEP_NAMES[next - 1]}: ${what} — ${tail}`;
}
