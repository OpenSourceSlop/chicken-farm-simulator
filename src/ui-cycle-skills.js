// Skills update (SKILLS.md §3, §4.2, §5.1, §6.5, §12.9): what the payoffs share in the equipment panels. Package
// "panels". Every payoff is read through the perks (L.perks: has / auto), never skills.unlocked alone, so with
// config SKILLS_UPDATE.live false (or the perks not allowed under automation) nothing here shows and every panel is the
// Phase 5 panel exactly.
//   glanceFor(L, panelId, { extra })   a panel of AUTO_SYSTEMS[s].glanceAt open AUTO.glanceSec sends
//                                     L.uiAct('auto.glance', { system: s }) once per opening for every system on
//   skillBox(key, title)               the box a payoff's keys sit in: the tag ("Heating 2 · Faster"), a title, rows
//   workLine()                         the sign's working beside a one-press key (§6.5: the figure on it is the one sent)
//   oneKey(text, onClick, opts)        a one-press key (the panels' key look; its aria-label names the press)
//   autoStatus(L, system)              the system's state from farm.autoCtl.status() with its open faults and last act
//   holdText(L, system, line?)         "Your setting holds until 06:00, then the controller goes back to the table"
//   faultText(L, fault)                the fault's words (farm-faults faultWords) in one line
//   sinceRead(L, systems, since)       the controllers' lines (EV.AUTO payloads kept in farm.auto.last) after `since`
import { SKILLS_UPDATE, AUTO, AUTO_SYSTEMS, PAYOFFS, SKILL_SHORT, SKILL_STEP_NAMES, FAULTS } from './config.js';
import { h, button, setText, injectStyle } from './ui-dom.js';
import { hhmm, splitDay } from './ui-format.js';
import { faultWords } from './farm-faults.js';

const CSS = `
.skl { margin: 10px 0 0; padding: 9px 11px 10px; border-radius: 6px; background: rgba(231, 182, 70, 0.07); box-shadow: inset 3px 0 0 var(--sign-yellow); color: var(--key-ink); }
.skl[hidden], .skl-work[hidden], .skl-row[hidden] { display: none; }
.skl-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 8px; margin: 0 0 6px; }
.skl-tag { padding: 1px 6px; border-radius: 2px; background: var(--sign-yellow); color: var(--sign-yellow-ink); font: 700 11px/1.4 var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; }
.skl-title { font: 700 13px/1.25 var(--font-display); letter-spacing: 0.03em; }
.skl-rows { display: grid; gap: 6px; }
.skl-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.skl-row > .key { flex: 0 0 auto; }
.skl-work { flex: 1 1 220px; min-width: 0; margin: 0; padding: 5px 8px; border-radius: 4px; background: var(--panel-sunk, rgba(0, 0, 0, 0.25)); font: 600 12.5px/1.35 var(--font-display); letter-spacing: 0.02em; color: var(--key-ink); overflow-wrap: anywhere; }
.skl-work small { display: block; font: 500 12px/1.3 var(--font-body); letter-spacing: 0; color: var(--key-sub); }
.skl-note { margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--key-sub); }
.skl-note--fault { color: var(--sign-yellow); font-weight: 600; }
.key--skill { height: auto; min-height: 36px; max-width: 200px; padding: 6px 12px; white-space: normal; line-height: 1.15; font-size: 12px; }
.skl-table { width: 100%; border-collapse: collapse; font: 600 12.5px/1.3 var(--font-display); }
.skl-table th, .skl-table td { padding: 3px 6px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.skl-table th { color: var(--key-sub); font-weight: 600; letter-spacing: 0.06em; }
.skl-state { display: inline-flex; align-items: center; gap: 5px; }
.skl-state .led { width: 8px; height: 8px; }
.skl-tubes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.skl-tube { display: grid; justify-items: center; gap: 3px; padding: 4px 2px; border-radius: 4px; background: rgba(255, 255, 255, 0.04); font: 600 12px/1.25 var(--font-display); text-align: center; }
.skl-tube small { font: 500 12px/1.25 var(--font-body); color: var(--key-sub); }
.skl-tube.is-off { box-shadow: inset 0 0 0 1px var(--sign-yellow); }
.book-paper .skl { background: rgba(231, 182, 70, 0.14); color: var(--ledger-ink, #2b2a24); box-shadow: inset 3px 0 0 rgba(160, 112, 20, 0.8); }
.book-paper .skl-work { background: rgba(43, 42, 36, 0.08); color: var(--ledger-ink, #2b2a24); }
.book-paper .skl-work small, .book-paper .skl-note { color: rgba(43, 42, 36, 0.7); }
`;
export const ensureSkillsStyle = () => injectStyle('skills-panels-style', CSS);

/** The build switch (SKILLS.md §0): false = the Phase 5 game. */
export const live = () => !!SKILLS_UPDATE.live;
export const perkHas = (L, key) => { try { return !!L.perks?.has?.(key); } catch { return false; } };
export const perkAuto = (L, system) => { try { return !!L.perks?.auto?.(system); } catch { return false; } };
/** "Heating 2 · Faster" for a payoff key. */
export const payoffTag = (key) => { const p = PAYOFFS[key]; return p ? `${SKILL_SHORT[p.branch]} ${p.level} · ${SKILL_STEP_NAMES[p.level - 1]}` : ''; };

/** The glance at a handed-over system's reading (SKILLS.md §4.3, §12.9): once per opening, after AUTO.glanceSec open. */
export function glanceFor(L, panelId, { extra = null } = {}) {
  let openFor = 0, sent = false, last = [];
  const systems = () => Object.entries(AUTO_SYSTEMS).filter(([s, d]) => d.glanceAt.includes(panelId) && perkAuto(L, s)).map(([s]) => s);
  return {
    onOpen() { openFor = 0; sent = false; },
    update(dt) {
      if (sent) return;
      openFor += Math.max(0, dt || 0);
      if (openFor < AUTO.glanceSec) return;
      sent = true;
      last = systems();
      for (const system of last) L.uiAct('auto.glance', { system });
      try { extra?.(last); } catch (err) { console.error('glance extra failed', err); }
    },
    get sent() { return sent; },
    get systems() { return last; },
  };
}

/** A payoff's box: the tag, a title and its rows (add with box.rows.append). */
export function skillBox(key, title, ...rows) {
  ensureSkillsStyle();
  const tag = h('span', { class: 'skl-tag' }, payoffTag(key));
  const titleEl = h('span', { class: 'skl-title' }, title);
  const rowsEl = h('div', { class: 'skl-rows' }, rows);
  const el = h('div', { class: 'skl', hidden: true, 'data-payoff': key }, h('p', { class: 'skl-head' }, tag, titleEl), rowsEl);
  return { el, rows: rowsEl, tag, title: titleEl, show(on) { el.hidden = !on; return !!on; }, setTitle(t) { setText(titleEl, t); } };
}
/** The sign's working beside a key (two lines: the working, then a small note under it). */
export function workLine(cls = '') {
  const main = h('span'), sub = h('small', { hidden: true });
  const el = h('p', { class: `skl-work ${cls}`.trim(), 'aria-live': 'polite' }, main, sub);
  return { el, set(text, note = '') { el.hidden = !text; setText(main, text || ''); setText(sub, note || ''); sub.hidden = !note; } };
}
/** A one-press key: the panels' key look; its aria-label and title say what a press does. */
export function oneKey(text, onClick, { cls = '', label = null } = {}) {
  const b = button({ class: `key key--wide key--act key--skill ${cls}`.trim(), 'aria-label': label || text, title: label || text }, text);
  b.addEventListener('click', (e) => onClick(e));
  return b;
}
export const row = (...c) => h('div', { class: 'skl-row' }, c);
export const note = (cls = '') => h('p', { class: `skl-note ${cls}`.trim() });

/** The system's reading from farm.autoCtl.status() (the stub answers 'off' / 'running' with no text). */
export function autoStatus(L, system) {
  let st = null;
  try { st = L.farm?.autoCtl?.status?.() ?? null; } catch { st = null; }
  const sys = st?.systems?.[system] || { state: 'off', text: '', since: null };
  const faults = (st?.faults || []).filter((f) => f.system === system && (f.phase == null || f.phase === 'open'));
  return { ...sys, faults, last: st?.last?.[system] || null, on: !!st?.on?.[system] };
}
/** The open faults of one fault id (optionally one drinker line). */
export function openFault(L, id, line = null) {
  let list = [];
  try { list = (L.farm?.autoCtl?.status?.()?.faults || []).filter((f) => f.id === id && (f.phase == null || f.phase === 'open')); } catch { list = []; }
  return line == null ? list[0] || null : list.find((f) => (f.line ?? f.args?.line) === line) || null;
}
export const STATE_WORDS = { running: 'running', held: 'held by your setting', fault: 'stopped', off: 'off' };

/** env.day -> "06:00" today, "06:00 tomorrow", else "day 12, 06:00". */
export function atText(env, t) {
  const { day, hour } = splitDay(t), today = Math.floor(env.day + 1e-9);
  return day === today ? hhmm(hour) : day === today + 1 ? `${hhmm(hour)} tomorrow` : `day ${day}, ${hhmm(hour)}`;
}
/** The farmer's own setting and until when it holds (farm.auto.hold, SKILLS.md §4.2), '' when none holds now. */
export function holdText(L, system, line = null) {
  const hold = L.farm?.auto?.hold?.[system];
  const until = line != null ? hold?.[line] : hold;
  if (!(Number.isFinite(until) && until > L.env.day)) return '';
  return `Your setting holds until ${atText(L.env, until)}, then the controller goes back to the table`;
}
/** A fault in one line: what stopped, the cause, where to look (farm-faults faultWords; the stub gives `what` only). */
export function faultText(L, f) {
  if (!f) return '';
  let w = null;
  try { w = faultWords(f, L.env, L.farm); } catch { w = null; }
  const what = w?.what || FAULTS[f.id]?.what || 'Equipment fault';
  const since = Number.isFinite(f.startedAt) ? ` since ${atText(L.env, f.startedAt)}` : '';
  return [`${what}${since}`, w?.cause, w?.fix || w?.place].filter(Boolean).join(' · ');
}
/** The controllers' last acts after `since` (env.day; null = all): [{ system, label, text, at }]. */
export function sinceRead(L, systems, since = null) {
  const last = L.farm?.auto?.last || {};
  const out = [];
  for (const s of systems) {
    const p = last[s];
    if (!p || !p.text) continue;
    const at = Number.isFinite(p.day) && Number.isFinite(p.hour) ? p.day + p.hour / 24 : null;
    if (since != null && at != null && at <= since + 1e-9) continue;
    out.push({ system: s, label: AUTO_SYSTEMS[s]?.label || s, text: p.text, at });
  }
  return out;
}
