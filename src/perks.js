// The perks: what the skills give the farmer now (SKILLS.md §3, §4, §12.3). Pure logic (node and browser), working core
// written at the design round; owner from then: package "model" (the API below is the frozen contract; a package may add a
// method, never change one). Every payoff of config PAYOFFS is read through here — never through skills.unlocked() alone —
// so a steps file that patches skills.unlocked for a layout review turns no automation on.
//
//   const perks = createPerks({ skills, settings?, events?, allowed? })   main.js after the skills and the settings
//   perks.has(key)        a PAYOFFS key: SKILLS_UPDATE.live, allowed, its branch at its level, and for a level 3 its
//                         settings (automation.all and automation.<branch>); a view key (config UNLOCKS): skills.unlocked(key)
//   perks.auto(system)    an AUTO_SYSTEMS system's payoff holds (has(AUTO_SYSTEMS[system].payoff))
//   perks.need(jobId)     a sampling job's numbers with the payoffs now: { n, sectors, key } | null (Brooding 2: d0-vent 3,
//                         d1-crop 6, b-crop48 6; Growth 2: the weigh jobs 25) — the job variant and the milestones read it
//   perks.easier(jobId)   the payoffs that ease the job, lowest level first: [{ key, name, saves, branch, level, step, has,
//                         toGo (points to the level; 0 once reached), later (true: level 3 in a first flock) }]
//   perks.handled(jobId)  { system, branch, key, label: 'handled by the controller (Water 3)', reading, glanceAt } while a
//                         system that takes the job is on, else null
//   perks.list()          every payoff: { key, ...PAYOFFS[key], has, toGo, setting (true / false: its automation setting) }
//   perks.allowed / allow(on)   false under automation (navigator.webdriver) until a steps file calls __game.perks.allow(true)
//   perks.version         bumps on every change; EV.PERKS { version, keys } when a payoff came or went
//   perks.refresh()       re-read everything now (EV.SKILL_POINTS / SKILL_UNLOCK / SETTINGS call it)
import { PAYOFFS, AUTO_SYSTEMS, SKILL_BRANCHES, SKILL_SHORT, SKILLS_UPDATE, skillLevelPoints } from './config.js';
import { EV } from './events.js';

const webdriver = () => { try { return typeof navigator !== 'undefined' && !!navigator.webdriver; } catch { return false; } };
const BRANCH_IDS = new Set(SKILL_BRANCHES.map((b) => b.id));
/** The jobs each payoff eases (PAYOFFS[key].jobs), by job id. */
const EASES = new Map();
for (const [key, p] of Object.entries(PAYOFFS)) for (const j of p.jobs || []) { if (!EASES.has(j)) EASES.set(j, []); EASES.get(j).push(key); }
for (const list of EASES.values()) list.sort((a, b) => PAYOFFS[a].level - PAYOFFS[b].level);

export function createPerks({ skills, settings = null, events = null, allowed = !webdriver() } = {}) {
  let allow = !!allowed, version = 0, last = new Map();
  const live = () => !!SKILLS_UPDATE.live;
  const setting = (branch) => {
    if (!settings || typeof settings.get !== 'function') return true;
    try {
      const all = settings.get('automation.all'), one = settings.get(`automation.${branch}`);
      return all !== false && one !== false;
    } catch { return true; }
  };
  const level = (branch) => (skills && typeof skills.level === 'function' ? skills.level(branch) : 0);
  const points = (branch) => (skills && typeof skills.points === 'function' ? skills.points(branch) : 0);
  const firstFlock = () => !((skills && skills.profile && skills.profile.cyclesDone) > 0);

  function has(key) {
    const p = PAYOFFS[key];
    if (!p) return !!(skills && typeof skills.unlocked === 'function' && skills.unlocked(key));
    if (!live() || !allow || !BRANCH_IDS.has(p.branch) || level(p.branch) < p.level) return false;
    return p.step !== 'auto' || setting(p.branch);
  }
  const toGo = (p) => Math.max(0, (skillLevelPoints()[p.level - 1] ?? Infinity) - points(p.branch));

  const perks = {
    get allowed() { return allow; },
    allow(on = true) { allow = !!on; perks.refresh(); return allow; },
    get version() { return version; },
    has,
    auto(system) { const s = AUTO_SYSTEMS[system]; return !!s && has(s.payoff); },
    need(jobId) {
      for (const key of EASES.get(jobId) || []) {
        const n = PAYOFFS[key].need && PAYOFFS[key].need[jobId];
        if (n && has(key)) return { ...n, key };
      }
      return null;
    },
    easier(jobId) {
      if (!live()) return [];
      return (EASES.get(jobId) || []).map((key) => {
        const p = PAYOFFS[key], h = has(key), reached = level(p.branch) >= p.level;
        return { key, name: p.name, saves: p.saves, branch: p.branch, level: p.level, step: p.step, has: h, toGo: reached ? 0 : toGo(p), later: p.level === 3 && firstFlock() && !reached };
      });
    },
    handled(jobId) {
      for (const [system, s] of Object.entries(AUTO_SYSTEMS)) {
        if (!(s.jobs || []).includes(jobId) || !perks.auto(system)) continue;
        const p = PAYOFFS[s.payoff];
        return { system, branch: s.branch, key: s.payoff, label: `handled by the controller (${SKILL_SHORT[s.branch]} ${p.level})`, reading: s.reading, glanceAt: [...s.glanceAt] };
      }
      return null;
    },
    list() {
      return Object.entries(PAYOFFS).map(([key, p]) => ({ key, ...p, has: has(key), toGo: level(p.branch) >= p.level ? 0 : toGo(p), setting: p.step === 'auto' ? setting(p.branch) : null }));
    },
    refresh() {
      const now = new Map(Object.keys(PAYOFFS).map((k) => [k, has(k)]));
      const keys = [...now].filter(([k, v]) => last.get(k) !== v).map(([k]) => k);
      last = now;
      if (keys.length) { version++; events && events.emit(EV.PERKS, { version, keys }); }
      return keys;
    },
  };
  last = new Map(Object.keys(PAYOFFS).map((k) => [k, has(k)]));
  if (events) {
    events.on(EV.SKILL_POINTS, () => perks.refresh());
    events.on(EV.SKILL_UNLOCK, () => perks.refresh());
    events.on(EV.SETTINGS, (p) => { if (!p || p.group === 'automation' || p.group == null) perks.refresh(); });
  }
  return perks;
}
