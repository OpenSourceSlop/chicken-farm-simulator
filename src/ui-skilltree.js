// The skill tree (K): eleven branch cards in a 4-4-3 grid, each with a low-poly badge, three level
// pips and what each level unlocks. The two earnable branches of Level 1 show a point bar and their
// milestones: the result in plain words, its points, and once earned the measured value. The
// others read "Comes in a later level". Points come from play only. Owner: package "level".
import { SKILL_LEVEL_POINTS, UNLOCKS, LATER_UNLOCKS } from './config.js';
import { h, uniqueId } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';

const BADGE_ICON = {
  planning: ICONS.clipboard, biosecurity: ICONS.shield, brooding: ICONS.chick, comfort: ICONS.thermometer, ventilation: ICONS.fan,
  moisture: ICONS.wind, heating: ICONS.flame, water: ICONS.droplet, feed: ICONS.sack, lighting: ICONS.bulb, growth: ICONS.trend,
};
// Each badge: a faceted hexagon in its own hue (hue is identity only, never a judgement).
const HUES = { planning: 38, biosecurity: 160, brooding: 44, comfort: 12, ventilation: 200, moisture: 190, heating: 22, water: 205, feed: 30, lighting: 52, growth: 120 };

function badge(id, level, earnable) {
  const hue = HUES[id] ?? 40, sat = earnable ? 55 : 14, l0 = level > 0 ? 46 : 32;
  const c = (dl) => `hsl(${hue} ${sat}% ${l0 + dl}%)`;
  const pts = [[32, 3], [57, 17.5], [57, 46.5], [32, 61], [7, 46.5], [7, 17.5]];
  const facets = pts.map((p, i) => { const q = pts[(i + 1) % 6]; return `<polygon points="32,32 ${p.join(',')} ${q.join(',')}" fill="${c([10, 4, -4, -10, -6, 6][i])}"/>`; }).join('');
  const icon = (BADGE_ICON[id] || ICONS.tree).replace('class="icon"', 'class="badge-icon"').replace(' width="24" height="24"', ' x="18" y="18" width="28" height="28"');
  return `<svg class="badge" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${facets}<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <g style="color:${earnable ? 'var(--ink)' : 'var(--ink-faint)'}">${icon}</g></svg>`;
}

export function buildSkillTreePanel(L) {
  const titleId = uniqueId('tree-title');
  const { el, closeBtn } = dialogShell('tree', titleId, L.close);
  const grid = h('div', { class: 'tree-grid' });
  const miles = h('div', { class: 'tree-miles' });
  el.append(h('div', { class: 'tree-case card' },
    h('header', { class: 'tree-head' }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), h('div', null, h('h2', { id: titleId }, 'Skill tree'),
      h('p', null, 'Points come from what happens on your farm: the floor at arrival, the flock at day 7, a leak found in time. Each level unlocks a tool.'))),
    grid, miles), closeBtn);

  function unlockText(branch, lvl) {
    const u = Object.values(UNLOCKS).find((x) => x.branch === branch && x.level === lvl);
    return u ? u.name : lvl === 3 ? 'Comes in a later level' : '—';
  }

  function render() {
    const skills = L.skills;
    const branches = skills.branches();
    const detailCards = [];
    grid.replaceChildren(...branches.map((b) => {
      const pips = h('span', { class: 'pips3', 'aria-label': `Level ${b.level} of 3` }, [1, 2, 3].map((i) => h('span', { class: `pip3${b.level >= i ? ' is-on' : ''}` })));
      const card = h('article', { class: `branch${b.earnable ? ' branch--earn' : ' branch--later'}` },
        h('div', { class: 'branch-top' }, h('span', { html: badge(b.id, b.level, b.earnable) }), h('div', null, h('h3', null, b.name), pips)));
      if (!b.earnable) {
        // what its first level will unlock, dimmed: the branch is earned in a later level
        card.append(h('p', { class: 'branch-later' }, 'Comes in a later level'),
          LATER_UNLOCKS[b.id] ? h('p', { class: 'branch-later branch-later--unlock' }, h('b', null, 'Level 1'), ` · ${LATER_UNLOCKS[b.id]}`) : null);
        return card;
      }
      const max = SKILL_LEVEL_POINTS[2];
      const bar = h('div', { class: 'pbar', role: 'img', 'aria-label': `${b.points} points; levels at ${SKILL_LEVEL_POINTS.join(', ')}` },
        h('span', { class: 'pbar-fill', style: `width:${Math.min(100, (b.points / max) * 100).toFixed(1)}%` }),
        SKILL_LEVEL_POINTS.map((p, i) => h('span', { class: 'pbar-mark', style: `left:${((p / max) * 100).toFixed(1)}%` }, h('small', null, `L${i + 1}`))));
      const levels = h('ol', { class: 'branch-levels' }, [1, 2, 3].map((i) => h('li', { class: b.level >= i ? 'is-on' : '' }, h('b', null, `Level ${i}`), ` · ${SKILL_LEVEL_POINTS[i - 1]} pts · `, unlockText(b.id, i))));
      const ms = skills.milestones(b.id);
      const list = h('ul', { class: 'miles' }, ms.map((m) => {
        const best = m.tiers[m.tiers.length - 1].points;
        const detail = L.skillDetail(m.id);
        return h('li', { class: m.tier != null ? 'is-earned' : '' },
          h('span', { class: 'mile-pts' }, m.tier != null ? `${m.points}` : `0`, h('small', null, `/${best}`)),
          h('span', null, m.text, m.tier != null && detail ? h('small', { class: 'mile-detail' }, detail) : null));
      }));
      card.append(h('div', { class: 'branch-pts' }, h('b', null, String(b.points)), ' points'), bar);
      detailCards.push(h('section', { class: 'branch-detail' }, h('h3', null, b.name), levels, h('p', { class: 'miles-k' }, 'Milestones · points'), list));
      return card;
    }));
    miles.replaceChildren(...detailCards);
  }
  return { el, kind: 'paused', onOpen: render, update(dt, force) { if (force) render(); } };
}
