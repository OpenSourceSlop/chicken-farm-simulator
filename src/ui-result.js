// Level result screen (PHASE2.md §10): four numbers large (day 7 weight × chick weight against the
// Week 1 guide band 4–5 ×, deaths %, uniformity %, FCR), the week table, "Your week" (what was set
// and read each day beside the sign values, plain numbers), the points earned, then the outcome
// and the buttons. Owner: package "level".
import { LEVEL1, flowTargetAt, nippleHeightCmAt, targetTempAt, minVentM3hPer1000, weightAt, EQUIP } from './config.js';
import { SKILL_BRANCHES } from './config.js';
import { h, button, uniqueId, fmt0 } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { int, one, two, hhmm } from './ui-format.js';
import { weekTable } from './ui-records.js';

function bandSvg(ratio) {
  const lo = 3, hi = 6, W = 300, X = (v) => 10 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 20);
  const ticks = [3, 3.5, 4, 4.5, 5, 5.5, 6].map((v) => `<path d="M${X(v)} 30v6" stroke="var(--ink-faint)"/><text x="${X(v)}" y="48" font-size="10" text-anchor="middle" fill="var(--ink-dim)">${v}</text>`).join('');
  const mark = ratio == null ? '' : `<path d="M${X(ratio)} 15v20" stroke="var(--ink)" stroke-width="3"/><path d="M${X(ratio) - 5} 14h10l-5 6z" fill="var(--ink)"/>`;
  return `<svg viewBox="0 0 ${W} 54" width="100%" style="max-width:${W}px" aria-hidden="true"><rect x="${X(4)}" y="16" width="${X(5) - X(4)}" height="14" rx="2" fill="var(--panel-raised-hi)" stroke="var(--ink-faint)" stroke-dasharray="3 2"/>
    <path d="M10 30H${W - 10}" stroke="var(--ink-faint)"/>${ticks}${mark}<text x="10" y="10" font-size="9" fill="var(--ink-dim)">Week 1 guide: 4–5 × (dashed band)</text></svg>`;
}

/** "Your week": per day what was set and read, beside the sign value. Plain numbers. */
function yourWeek(L, res) {
  const tl = L.records.timeline?.() || [];
  const byDay = new Map(tl.map((e) => [e.day, e]));
  const notes = (d, kinds) => (L.records.notesOf?.(d) || []).filter((n) => kinds.includes(n.kind));
  const rows = [];
  for (let d = 0; d <= LEVEL1.endDay; d++) {
    // records.timeline(): { setpointC, flowsMlMin, nippleHeightsCm, ventTimer, ventTimerM3h, ventSignM3h,
    // lightHours, floorAtArrivalC, cropTally: { full, of } } per day (null where nothing was done)
    const e = byDay.get(d) || {};
    const flows = (e.flowsMlMin || notes(d, ['water.flow', 'water.flowtest']).map((n) => n.value?.mlMin ?? n.value?.result?.mlMin)).filter(Number.isFinite);
    const heights = (e.nippleHeightsCm || []).filter(Number.isFinite);
    const sp = e.setpointC ?? notes(d, ['controller', 'controller.read']).map((n) => n.value?.setpoint).filter(Number.isFinite).pop();
    const timer = e.ventTimer ?? notes(d, ['controller', 'controller.read']).map((n) => n.value?.timer).filter(Boolean).pop();
    const air = e.ventTimerM3h ?? (timer ? Math.round((timer.fans * EQUIP.fanM3h * timer.onSec) / timer.cycleSec) : null);
    const need = e.ventSignM3h ?? Math.round((minVentM3hPer1000(weightAt(d)) * LEVEL1.chicksPlaced) / 1000);
    const floor = e.floorAtArrivalC ?? res.floorAtArrival;
    const crops = e.cropTally && typeof e.cropTally === 'object' ? `${e.cropTally.full} of ${e.cropTally.of} crops full and soft` : e.cropTally;
    rows.push(h('tr', null, h('th', { scope: 'row' }, String(d)),
      h('td', null, sp != null ? `${one(sp)}` : '—', h('small', null, ` sign ${one(Math.round(targetTempAt(d) * 2) / 2)}`)),
      h('td', null, flows.length ? flows.map((f) => fmt0(f)).join(' / ') : '—', h('small', null, ` sign ${flowTargetAt(d)}`)),
      h('td', null, heights.length ? heights.map((x) => fmt0(x)).join(' / ') : '—', h('small', null, ` about ${fmt0(nippleHeightCmAt(d))}`)),
      h('td', null, air != null ? int(air) : '—', h('small', null, ` sign ≈ ${int(need)}`)),
      h('td', null, e.lightHours != null ? one(e.lightHours) : '—'),
      h('td', null, d === 0 ? (floor != null ? `${one(floor)} °C` : '—') : d === 1 ? (crops || '—') : '')));
  }
  return h('div', { class: 'ledger-scroll', tabindex: '0', role: 'region', 'aria-label': 'Your week' },
    h('table', { class: 'ledger ledger--dark' }, h('thead', null, h('tr', null, ['Day', 'Thermostat °C', 'Flow ml/min (lines)', 'Nipples cm', 'Timer air m³/h', 'Light h', 'Floor at arrival · crops'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows)));
}

export function buildResultPanel(L) {
  const titleId = uniqueId('result-title');
  const { el, closeBtn } = dialogShell('result', titleId, L.close);
  closeBtn.hidden = true; // leave by the buttons
  const body = h('div', { class: 'result-body' });
  el.append(h('div', { class: 'result-case card' }, body), closeBtn);
  let res = null;
  function render() {
    if (!res) return;
    const big = (k, v, sub, extra) => h('div', { class: 'big' }, h('p', { class: 'big-k' }, k), h('p', { class: 'big-v' }, v), sub ? h('p', { class: 'big-sub' }, sub) : null, extra || null);
    const outcome = res.pass
      ? h('div', { class: 'outcome' }, h('h3', null, 'Level 1 complete'), h('p', null, 'The week is in the book. Replay it to try other settings, or keep walking the farm on day 7.'))
      : h('div', { class: 'outcome outcome--again' }, h('h3', null, `Level 1 not passed: ${res.failText}. Replay the brooding week.`),
        h('p', null, `The level needs at least ${LEVEL1.fail.weightRatioMin} × chick weight at day 7 and deaths and culls at or below ${LEVEL1.fail.mortalityMaxPct} % of the chicks placed.`));
    const pts = res.points || [];
    const branchName = (id) => SKILL_BRANCHES.find((b) => b.id === id)?.name || id;
    const btns = h('div', { class: 'result-btns' },
      res.pass ? button({ class: 'btn', onclick: () => L.level()?.keepWalking() }, 'Keep walking the farm') : null,
      button({ class: 'btn btn--accent', onclick: () => L.level()?.replay() }, 'Replay Level 1'),
      button({ class: 'btn', onclick: () => L.openPanel('skilltree') }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), 'Skill tree'),
      button({ class: 'btn', onclick: () => L.level()?.toTitle() }, 'Back to the title'));
    body.replaceChildren(
      h('header', { class: 'result-head' }, h('p', { class: 'sign-kicker' }, res.early ? `Ended ${res.endedAt}` : 'Day 7 · the brooding week'), h('h2', { id: titleId }, LEVEL1.title)),
      h('div', { class: 'bigs' },
        big('Day 7 weight', res.ratio != null ? `${two(res.ratio)} ×` : '—', `chick weight · ${int(res.weightG)} g ${res.weighedByHand ? 'weighed' : 'automatic scale, not weighed by hand'} ÷ ${one(res.chickWeightG)} g (${res.chickSource === 'box' ? 'box weighing' : 'delivery note'})`, h('div', { class: 'band', html: bandSvg(res.ratio) })),
        big('Deaths and culls', `${two(res.deathsPct)} %`, `${int(res.deaths)} of ${int(res.placed)} chicks ${res.placedReal === false ? 'delivered' : 'placed'}`,
          res.countedDead != null ? h('p', { class: 'big-sub' }, [`${int(res.countedDead)} counted at the bin`, `${int(res.deadOnFloor)} still lying in the house`,
            res.deadInBoxes ? `${int(res.deadInBoxes)} dead in the boxes` : null, res.culls ? `${int(res.culls)} culled` : null].filter(Boolean).join(' · ')) : null),
        big('Uniformity', res.uniformityPct != null ? `${fmt0(res.uniformityPct)} %` : '—', 'birds within ±10 % of the mean'),
        big('FCR', res.fcr != null ? two(res.fcr) : '—', 'feed ÷ live weight so far')),
      outcome, btns,
      h('h3', { class: 'result-h' }, 'Your week'), yourWeek(L, res),
      h('h3', { class: 'result-h' }, 'Points earned'),
      pts.length ? h('ul', { class: 'result-points' }, pts.map((p) => h('li', null, h('b', null, `${branchName(p.branch)} +${p.points}`), ` · ${p.text}${p.detail ? ` · ${p.detail}` : ''}`))) : h('p', { class: 'result-note' }, 'No points this week.'),
      h('h3', { class: 'result-h' }, 'The week in the book'), weekTable(L, { dark: true }),
      h('p', { class: 'result-note' }, `Result at ${hhmm(res.hour ?? 0)} on day ${fmt0(res.day ?? 7)}.`));
  }
  return { el, kind: 'paused', show(r) { res = r; render(); }, update(dt, force) { if (force) render(); } };
}
