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
  quickSamples: '3 vent chicks instead of 5, 6 crops instead of 10', boxHelper: 'a helper tips half the chick boxes with you',
  siloOrder: 'order at the silo gauge, in days of feed', autoFeed: 'feed orders itself and the feeder lines rise',
  weekLights: 'one press sets the light program for the age', autoLights: 'the controller changes the light program with the age',
  frameWeigh: 'weigh 25 birds instead of 50', autoScale: 'read the automatic scale’s day average',
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
  quickSamples: 'the smaller sample: 3 vent chicks, one from each part, 6 crops (the boards’ 5 and 10 stay the standard); Next chick takes the next one near you',
  siloOrder: 'Order to 3 days at the silo gauge (the working is beside the key)',
  weekLights: 'Program for the days sets the light program for the age in one press (the sign’s row is beside the key)',
  frameWeigh: 'the smaller weighing: 25 birds from three parts of the house (the plate’s 50 from 5 stays the standard); Weigh the frame weighs a frame in one press',
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
/** The final check: the unlock caption says what came and where to use it, with its key (SKILLS.md §6.3). One or two short
 *  sentences each, so the caption stays a short line or two in the gap between the HUD cards; level 3 adds where to switch
 *  it off. Keys as {key:id} tokens (filled when shown, as bound now). */
export const UNLOCK_USE = {
  // level 2 and 3 payoffs
  waterAllLines: 'the sight tubes. Read all four lines at the water supply, south-west corner inside',
  autoWinch: 'the drinker winches follow the age. Look at the heights at the water supply',
  ventFill: 'Fill the timer. One press on the climate controller\u2019s Ventilation tab',
  autoTimer: 'the timer steps up with the flock. Look at it on the controller\u2019s Ventilation tab',
  fanAdvice: 'Set as suggested. One press at the fan panel or the controller\u2019s Ventilation tab',
  autoStages: 'the fan stage table runs the tunnel fans. Look at the stages at the controller',
  brooderRow: 'Set to the sign\u2019s row. One press on the climate controller\u2019s Temperature tab',
  autoBrooders: 'the brooders follow the sign. Check the sensor on the controller\u2019s Temperature tab',
  quickSamples: 'smaller chick samples. 3 vent chicks, one a part of the floor, and 6 crops; Next chick in the hand',
  boxHelper: 'a helper tips the chick boxes. At the truck, once the sample box is weighed',
  siloOrder: 'days of feed and Order to 3 days. At the silo gauge outside the north wall',
  autoFeed: 'feed orders itself. Look for the order at the silo gauge',
  weekLights: 'Program for the days. One press on the climate controller\u2019s Lights tab',
  autoLights: 'the light program follows the age. Look at it on the controller\u2019s Lights tab',
  frameWeigh: 'weigh 25 birds instead of 50. At the bird scale on weigh days: the frame in three parts of the house',
  autoScale: 'the scale\u2019s day average. Read it at the bird scale\u2019s display',
  earlyWarning: 'earlier warnings. Show me on the flock watch card opens the fix',
  comfortAlways: 'the comfort colours whenever you are inside. {key:comfortView} turns them off for a visit',
  tallyBucket: 'the tally bucket. {key:use} at a dead bird picks up every one within 2.5 m; empty it at the bin',
  passCheck: 'symptom tags. Walk slowly past the birds in the house',
  pocketPhone: 'a phone in your pocket. Press {key:phone} anywhere to order feed, call the vet or book the crew',
  phoneRecord: 'the daily record on the phone. Press {key:phone}, then Sign today\u2019s record',
  // level 1 views (SKILL_VIEWS: the key where it has one)
  floorOverlay: 'the floor thermometer view. Press {key:floorView} anywhere in the house',
  comfortOverlay: 'the comfort colours. Press {key:comfortView} anywhere in the house',
  moistureOverlay: 'the litter moisture view. Press {key:moistureView} anywhere in the house',
  planningCalc: 'the planning calculator. Work the sums on the planning sheet at the office desk',
  symptomCheck: 'the quick symptom check. Quick look in the bird check, with a bird in your hand',
  windChill: 'the wind chill readout. The Birds feel line on the fan panel',
  heatLoss: 'the heat loss readout. On the climate controller\u2019s Temperature tab',
  waterTrend: 'the water trend. The Trend key beside the meter at the water supply',
  droppingsGuide: 'the droppings guide. In the bird check, beside the bird you hold',
  lightPresets: 'the light presets. On the climate controller\u2019s Lights tab',
  recordsTargets: 'targets in the records. In the record book and on the weigh panel',
};
/** Level 3's words: where the equipment is switched off. */
export const UNLOCK_OFF = 'Switch it off in Settings \u2192 Automation.';
/** The unlock's caption: "Farm Planning 2: a phone in your pocket. Press R anywhere to order feed, call the vet or book the
 *  crew." (the full words, saves and also-views, stay in the notebook line and on the tree). */
export function unlockShort(keys = []) {
  const ks = keys.map((k) => (typeof k === 'string' ? k : k?.key)).filter(Boolean);
  if (!ks.length) return '';
  const pay = ks.find((k) => PAYOFFS[k]), v = ks.find((k) => UNLOCKS[k]);
  const name = (n) => lower(String(n || '').replace(/[;:,].*$/, '').replace(/\s*\([^)]*\)\s*$/, ''));
  if (pay) {
    const p = PAYOFFS[pay], use = UNLOCK_USE[pay] || `${name(p.name)}. ${upper(useAt(p.where))}`;
    return `${levelName(p.branch, p.level)}: ${use}.${p.step === 'auto' ? ` ${UNLOCK_OFF}` : ''}`;
  }
  if (!v) return '';
  const u = UNLOCKS[v], lvl = unlockLevel(u), w = SKILL_VIEWS[v]?.where;
  return `${levelName(u.branch, lvl)}: ${UNLOCK_USE[v] || `${name(u.name)}${w ? `. ${upper(useAt(w))}` : ''}`}.`;
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
