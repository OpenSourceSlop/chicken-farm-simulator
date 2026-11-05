// The skill tree (K): eleven branch cards in a 4-4-3 grid, each with a low-poly badge, three level
// pips, its points and what each level unlocks; the card picked shows its milestones (all of the
// cycle, skills.js ALL_MILESTONES): the result in plain words, the level it is earned in, its points
// and, once earned, the measured value. Points come from play only (PHASE3.md §9). Owner: package "run".
// Phase 4 (PHASE4.md §7): the condition milestones (skills-cond.js MILESTONES_COND) under their branches, marked with
// the condition's name ("Hot season"); they are earned only in a run of that condition.
import { SKILL_LEVEL_POINTS, UNLOCKS, LEVELS, conditionLabel } from './config.js';
import { ALL_MILESTONES_P4 } from './skills.js';
// Skills update (SKILLS.md §6.1): the three steps per branch (live only; the Phase 5 tree otherwise)
import { SKILLS_UPDATE, SKILL_STEP_NAMES, UNLOCK_SHOWS, unlockLevel, skillLevelPoints } from './config.js';
import { nextLevelLine } from './job-words.js';
import { fillKeys } from './key-words.js';
import { injectStyle } from './ui-dom.js';
const TREE_CSS = `
.branch-steps > li { display: block; }
.branch-steps small { display: block; margin-left: 12px; font-size: 11.5px; line-height: 1.3; color: var(--ink-dim); }
.branch-steps small.step-state { display: inline; margin: 0; color: var(--accent); }
.branch-steps small.step-also { color: var(--ink-faint); }
.pip3.is-open { box-shadow: inset 0 0 0 2px var(--accent); background: transparent; }
`;

/** Every milestone the tree lists: skills.js ALL_MILESTONES_P4 (Phase 2's, the cycle's and the conditions'). */
const ALL_MILESTONES = ALL_MILESTONES_P4;
import { h, button, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';

const BADGE_ICON = {
  planning: ICONS.clipboard, biosecurity: ICONS.shield, brooding: ICONS.chick, comfort: ICONS.thermometer, ventilation: ICONS.fan,
  moisture: ICONS.wind, heating: ICONS.flame, water: ICONS.droplet, feed: ICONS.sack, lighting: ICONS.bulb, growth: ICONS.trend,
};
// Each badge: a faceted hexagon in its own hue (hue is identity only, never a judgement).
const HUES = { planning: 38, biosecurity: 160, brooding: 44, comfort: 12, ventilation: 200, moisture: 190, heating: 22, water: 205, feed: 30, lighting: 52, growth: 120 };
const LEVEL_SHORT = Object.fromEntries(LEVELS.map((l) => [l.id, l.short]));

function badge(id, level) {
  const hue = HUES[id] ?? 40, sat = 55, l0 = level > 0 ? 46 : 32;
  const c = (dl) => `hsl(${hue} ${sat}% ${l0 + dl}%)`;
  const pts = [[32, 3], [57, 17.5], [57, 46.5], [32, 61], [7, 46.5], [7, 17.5]];
  const facets = pts.map((p, i) => { const q = pts[(i + 1) % 6]; return `<polygon points="32,32 ${p.join(',')} ${q.join(',')}" fill="${c([10, 4, -4, -10, -6, 6][i])}"/>`; }).join('');
  const icon = (BADGE_ICON[id] || ICONS.tree).replace('class="icon"', 'class="badge-icon"').replace(' width="24" height="24"', ' x="18" y="18" width="28" height="28"');
  return `<svg class="badge" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${facets}<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <g style="color:var(--ink)">${icon}</g></svg>`;
}

/** Every milestone of a branch (Phase 2's and the cycle's) with what was earned: skills.milestones gives
 *  the earned tiers it knows; the rest of ALL_MILESTONES shows unearned. */
export function branchMilestones(skills, branch) {
  const known = new Map((skills.milestones?.(branch) || []).map((m) => [m.id, m]));
  return ALL_MILESTONES.filter((m) => m.branch === branch).map((m) => known.get(m.id) ? { ...m, ...known.get(m.id), level: m.level } : { ...m, tier: null, points: 0 });
}

export function buildSkillTreePanel(L) {
  injectStyle('tree-skills-style', TREE_CSS);
  const titleId = uniqueId('tree-title');
  const { el, closeBtn } = dialogShell('tree', titleId, L.close);
  const grid = h('div', { class: 'tree-grid' });
  const miles = h('div', { class: 'tree-miles tree-miles--one' });
  el.append(h('div', { class: 'tree-case card' },
    h('header', { class: 'tree-head' }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Skill tree'),
      h('p', null, 'Points come from what happens on your farm, from the plan to the clean house. Each level of a branch unlocks a tool. Pick a branch to see its milestones; the harder flocks add their own, named by the flock.'))),
    grid, miles), closeBtn);
  let picked = null;

  const unlockOf = (branch, lvl) => Object.values(UNLOCKS).find((x) => x.branch === branch && x.level === lvl);

  function render() {
    if (SKILLS_UPDATE.live) { renderLive(); return; }
    const skills = L.skills;
    const branches = skills.branches();
    if (!picked || !branches.some((b) => b.id === picked)) picked = (branches.find((b) => b.points > 0) || branches.find((b) => b.earnable) || branches[0]).id;
    const max = SKILL_LEVEL_POINTS[2];
    grid.replaceChildren(...branches.map((b) => {
      const pips = h('span', { class: 'pips3', 'aria-label': `Level ${b.level} of 3` }, [1, 2, 3].map((i) => h('span', { class: `pip3${b.level >= i ? ' is-on' : ''}` })));
      const bar = h('div', { class: 'pbar', role: 'img', 'aria-label': `${b.points} points; levels at ${SKILL_LEVEL_POINTS.join(', ')}` },
        h('span', { class: 'pbar-fill', style: `width:${Math.min(100, (b.points / max) * 100).toFixed(1)}%` }),
        SKILL_LEVEL_POINTS.map((p, i) => h('span', { class: 'pbar-mark', style: `left:${((p / max) * 100).toFixed(1)}%` }, h('small', null, `L${i + 1}`))));
      const next = unlockOf(b.id, Math.min(3, b.level + 1));
      // config SKILL_BRANCHES[i].earnable (all eleven from Phase 3, PHASE3.md §9); a branch that is not
      // earnable would show a preview of its first unlock.
      const card = b.earnable
        ? button({ class: `branch branch--earn branch--pick${b.id === picked ? ' is-picked' : ''}`, 'aria-pressed': String(b.id === picked) },
          h('div', { class: 'branch-top' }, h('span', { html: badge(b.id, b.level) }), h('div', null, h('h3', null, b.name), pips)),
          h('div', { class: 'branch-pts' }, h('b', null, String(b.points)), b.points === 1 ? ' point' : ' points'), bar,
          h('p', { class: 'branch-later branch-next' }, b.level < 3 && next ? [h('b', null, `Level ${b.level + 1}`), ` · ${next.name}`] : 'Every level reached'))
        : button({ class: `branch branch--later branch--pick${b.id === picked ? ' is-picked' : ''}`, 'aria-pressed': String(b.id === picked) },
          h('div', { class: 'branch-top' }, h('span', { html: badge(b.id, 0) }), h('div', null, h('h3', null, b.name), pips)),
          h('p', { class: 'branch-later' }, 'Comes in a later level'),
          unlockOf(b.id, 1) ? h('p', { class: 'branch-later branch-later--unlock' }, h('b', null, 'Level 1'), ` · ${unlockOf(b.id, 1).name}`) : null);
      card.addEventListener('click', () => { picked = b.id; render(); });
      return card;
    }));
    const b = branches.find((x) => x.id === picked);
    const levels = h('ol', { class: 'branch-levels' }, [1, 2, 3].map((i) => h('li', { class: b.level >= i ? 'is-on' : '' }, h('b', null, `Level ${i}`), ` · ${SKILL_LEVEL_POINTS[i - 1]} pts · `, unlockOf(b.id, i)?.name || '—')));
    const ms = branchMilestones(skills, b.id);
    const list = h('ul', { class: 'miles' }, ms.map((m) => {
      const best = m.tiers[m.tiers.length - 1].points;
      const detail = L.skillDetail(m.id);
      return h('li', { class: m.tier != null ? 'is-earned' : '' },
        h('span', { class: 'mile-pts' }, m.tier != null ? `${m.points}` : '0', h('small', null, `/${best}`)),
        h('span', null, m.text, m.condition ? h('small', { class: 'mile-cond' }, ` · ${conditionLabel(m.condition)}`) : null,
          h('small', { class: 'mile-level' }, ` · ${LEVEL_SHORT[m.level] || m.level}`), m.tier != null && detail ? h('small', { class: 'mile-detail' }, detail) : null));
    }));
    miles.replaceChildren(h('section', { class: 'branch-detail' }, h('h3', null, b.name), levels, h('p', { class: 'miles-k' }, 'Milestones · points · the level they come from'), list));
  }

  // ---------------- Skills update (SKILLS.md §6.1): three steps per branch, what each gives and saves ----------------
  const headLine = el.querySelector('.tree-head p');
  const HEAD_LIVE = 'Points come from what happens on your farm. Level 1 shows you more, level 2 makes a job faster, level 3 hands a routine job to the farm’s equipment once you have finished a flock. Each milestone counts once in your first flock and once more in a later one.';
  const HEAD_P5 = headLine?.textContent || '';
  const perksList = () => { try { return L.perks?.list?.() || []; } catch { return []; } };
  const cycles = () => L.skills?.profile?.cyclesDone ?? 0;
  /** The views (config UNLOCKS) a branch level gives, by the level in force (Feed's siloDays and feedGraph swap while live). */
  const viewsAt = (branch, lvl) => Object.entries(UNLOCKS).filter(([, u]) => u.branch === branch && unlockLevel(u) === lvl).map(([k, u]) => ({ key: k, ...u }));
  const payoffAt = (list, branch, lvl) => list.find((p) => p.branch === branch && p.level === lvl) || null;
  function renderLive() {
    if (headLine && headLine.textContent !== HEAD_LIVE) headLine.textContent = HEAD_LIVE;
    const skills = L.skills, need = skillLevelPoints(), scale = need[2] * 2, list = perksList(), cd = cycles();
    const branches = skills.branches();
    if (!picked || !branches.some((b) => b.id === picked)) picked = (branches.find((b) => b.points > 0) || branches[0]).id;
    grid.replaceChildren(...branches.map((b) => {
      // the level 3 pip opens (not filled) with 13 points in a first flock: "comes with your next flock"
      const waits = b.level < 3 && b.points >= need[2] && cd < 1;
      const pips = h('span', { class: 'pips3', 'aria-label': `Level ${b.level} of 3${waits ? '; level 3 comes with your next flock' : ''}` },
        [1, 2, 3].map((i) => h('span', { class: `pip3${b.level >= i ? ' is-on' : ''}${i === 3 && waits ? ' is-open' : ''}` })));
      const bar = h('div', { class: 'pbar', role: 'img', 'aria-label': `${b.points} points over two flocks; levels at ${need.join(', ')}` },
        h('span', { class: 'pbar-fill', style: `width:${Math.min(100, (b.points / scale) * 100).toFixed(1)}%` }),
        need.map((p, i) => h('span', { class: 'pbar-mark', style: `left:${((p / scale) * 100).toFixed(1)}%` }, h('small', null, `L${i + 1}`))));
      const nextLine = b.level >= 3 ? 'Every level reached' : fillKeys(nextLevelLine(b.id, b.level, b.points, cd));
      const card = button({ class: `branch branch--earn branch--pick${b.id === picked ? ' is-picked' : ''}`, 'aria-pressed': String(b.id === picked), 'data-branch': b.id },
        h('div', { class: 'branch-top' }, h('span', { html: badge(b.id, b.level) }), h('div', null, h('h3', null, b.name), pips)),
        h('div', { class: 'branch-pts' }, h('b', null, String(b.points)), b.points === 1 ? ' point' : ' points'), bar,
        h('p', { class: 'branch-later branch-next' }, nextLine));
      card.addEventListener('click', () => { picked = b.id; render(); });
      return card;
    }));
    const b = branches.find((x) => x.id === picked);
    const levels = h('ol', { class: 'branch-levels branch-steps' }, [1, 2, 3].map((i) => {
      const p = payoffAt(list, b.id, i), views = viewsAt(b.id, i);
      const name = i === 1 ? (views[0]?.name || '—') : p ? p.name : '—';
      const toGo = Math.max(0, need[i - 1] - b.points), reached = b.level >= i;
      const state = reached ? (i === 3 && p && p.setting === false ? 'off in Settings' : i === 3 ? 'on' : '')
        : i === 3 && cd < 1 ? (toGo > 0 ? `${toGo} point${toGo === 1 ? '' : 's'} to go, then with your next flock` : 'comes with your next flock') : `${toGo} point${toGo === 1 ? '' : 's'} to go`;
      const also = (i === 1 ? views.slice(1) : views).map((v) => h('small', { class: 'step-also' }, `also: ${UNLOCK_SHOWS[v.key] || v.name}`));
      const shows = i === 1 && views[0] ? h('small', { class: 'step-saves' }, UNLOCK_SHOWS[views[0].key] || '') : null;
      return h('li', { class: `${reached ? 'is-on' : ''}`, 'data-level': String(i) },
        h('b', null, `Level ${i} · ${SKILL_STEP_NAMES[i - 1]}`), ` · ${need[i - 1]} pts · `, fillKeys(name), state ? h('small', { class: 'step-state' }, ` · ${state}`) : null,
        shows, p ? h('small', { class: 'step-saves' }, fillKeys(p.saves)) : null, p ? h('small', { class: 'step-where' }, `Where: ${fillKeys(p.where)}`) : null, ...also);
    }));
    const ms = branchMilestones(skills, b.id);
    const two = (m) => (Array.isArray(m.points2) ? m.points2 : [m.points ?? 0, 0]);
    const listEl = h('ul', { class: 'miles' }, ms.map((m) => {
      const best = m.tiers[m.tiers.length - 1].points, [p1, p2] = two(m), detail = L.skillDetail(m.id);
      return h('li', { class: m.tier != null || p1 || p2 ? 'is-earned' : '' },
        h('span', { class: 'mile-pts', title: 'first flock · another flock' }, `${p1} · ${p2}`, h('small', null, `/${best}`)),
        h('span', null, m.text, m.condition ? h('small', { class: 'mile-cond' }, ` · ${conditionLabel(m.condition)}`) : null,
          h('small', { class: 'mile-level' }, ` · ${LEVEL_SHORT[m.level] || m.level}`), (m.tier != null || p1 || p2) && detail ? h('small', { class: 'mile-detail' }, detail) : null));
    }));
    miles.replaceChildren(h('section', { class: 'branch-detail' }, h('h3', null, b.name), levels,
      h('p', { class: 'miles-k' }, 'Milestones · points in your first flock · in another flock · the level they come from'), listEl));
  }
  function onOpen() { if (!SKILLS_UPDATE.live && headLine && headLine.textContent !== HEAD_P5) headLine.textContent = HEAD_P5; render(); }
  return { el, kind: 'paused', onOpen, update(dt, force) { if (force) render(); } };
}
