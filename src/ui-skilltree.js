// The skill tree (K): eleven branch cards in a 4-4-3 grid, each with a low-poly badge, three level
// pips, its points and what each level unlocks; the card picked shows its milestones (all of the
// cycle, skills.js ALL_MILESTONES): the result in plain words, the level it is earned in, its points
// and, once earned, the measured value. Points come from play only (PHASE3.md §9). Owner: package "run".
import { SKILL_LEVEL_POINTS, UNLOCKS, LEVELS } from './config.js';
import { ALL_MILESTONES } from './skills.js';
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
  const titleId = uniqueId('tree-title');
  const { el, closeBtn } = dialogShell('tree', titleId, L.close);
  const grid = h('div', { class: 'tree-grid' });
  const miles = h('div', { class: 'tree-miles tree-miles--one' });
  el.append(h('div', { class: 'tree-case card' },
    h('header', { class: 'tree-head' }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Skill tree'),
      h('p', null, 'Points come from what happens on your farm, from the plan to the clean house. Each level of a branch unlocks a tool. Pick a branch to see its milestones.'))),
    grid, miles), closeBtn);
  let picked = null;

  const unlockOf = (branch, lvl) => Object.values(UNLOCKS).find((x) => x.branch === branch && x.level === lvl);

  function render() {
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
          h('div', { class: 'branch-pts' }, h('b', null, String(b.points)), ' points'), bar,
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
        h('span', null, m.text, h('small', { class: 'mile-level' }, ` · ${LEVEL_SHORT[m.level] || m.level}`), m.tier != null && detail ? h('small', { class: 'mile-detail' }, detail) : null));
    }));
    miles.replaceChildren(h('section', { class: 'branch-detail' }, h('h3', null, b.name), levels, h('p', { class: 'miles-k' }, 'Milestones · points · the level they come from'), list));
  }
  return { el, kind: 'paused', onOpen: render, update(dt, force) { if (force) render(); } };
}
