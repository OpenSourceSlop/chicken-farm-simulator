// The record book's graphs (unlocks: waterTrend, weightGraph, feedGraph, gasGraph, comfortGraph) and the
// cycle summary after the clean-out (PHASE3.md §1 "Cycle summary", §8.5). Graphs draw the farmer's numbers
// beside the plate's, in one ink: no good or bad colours. Owner: package "run".
// Phase 4 (PHASE4.md §1.2, §1.7, §3.3): the summary names the run's condition, draws the farmer's last normal-season
// cycle beside a condition cycle (plain numbers, no verdict), marks the levels that came from a standard start and,
// after a finished cycle, offers the Harder flocks (ui-run.js createHarderCards).
import { SKILL_BRANCHES, weightAt, feedStdGAt, flockAgeAt, conditionLabel, levelById, UNLOCKS, unlockLevel } from './config.js';
import { createHarderCards } from './ui-run.js';
import { condIn } from './content.js';
import { h, button, uniqueId, nodes } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { int, one, two } from './ui-format.js';
import { replyLines, deathsByLevelRows } from './ui-letters.js';

/** A small line / bar chart over days (SVG). series: [{ pts: [[day, v]], kind: 'line'|'bars'|'dots', dash, label }]. */
export function dayChart({ series, title, unit = '', yMin = 0, yMax = null, W = 760, H = 220 }) {
  const all = series.flatMap((s) => s.pts.filter((p) => Number.isFinite(p[1])));
  if (!all.length) return '<p class="book-note">No signed rows yet.</p>';
  const days = all.map((p) => p[0]), d0 = Math.min(...days), d1 = Math.max(d0 + 1, ...days);
  // A round top and round ticks (1-2-5 x 10^n) the farmer can read against the targets.
  const span = Math.max(1e-9, (yMax ?? Math.max(1, ...all.map((p) => p[1]))) - yMin);
  const raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw)), tickStep = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((v) => v >= raw - 1e-9);
  const top = yMax ?? yMin + Math.ceil(span / tickStep - 1e-9) * tickStep;
  const padL = 46, padR = 14, padT = 22, padB = 30;
  const X = (d) => padL + ((d - d0 + 0.5) / (d1 - d0 + 1)) * (W - padL - padR), Y = (v) => H - padB - ((v - yMin) / (top - yMin)) * (H - padT - padB);
  const bw = Math.min(30, ((W - padL - padR) / (d1 - d0 + 1)) * 0.6);
  const parts = series.map((s) => {
    const p = s.pts.filter((q) => Number.isFinite(q[1]));
    if (s.kind === 'bars') return p.map(([d, v]) => `<rect x="${(X(d) - bw / 2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - padB - Y(v)).toFixed(1)}" fill="var(--ledger-ink)" opacity="0.7"/>`).join('');
    if (s.kind === 'dots') return p.map(([d, v]) => `<circle cx="${X(d).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="var(--ledger-ink)"/>`).join('');
    const path = p.map(([d, v], i) => `${i ? 'L' : 'M'}${X(d).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    return `<path d="${path}" fill="none" stroke="${s.ink2 ? 'var(--ledger-ink2)' : 'var(--ledger-ink)'}" stroke-width="2"${s.dash ? ' stroke-dasharray="5 3"' : ''}/>`;
  }).join('');
  const step = Math.max(1, Math.ceil((d1 - d0 + 1) / 14));
  const ticks = []; for (let d = d0; d <= d1; d += step) ticks.push(`<text x="${X(d).toFixed(1)}" y="${H - 10}" font-size="11" text-anchor="middle">${d}</text>`);
  const yv = []; for (let v = yMin; v <= top + tickStep * 1e-6; v += tickStep) yv.push(v);
  const whole = Number.isInteger(tickStep) || tickStep >= 1;
  const yt = yv.map((v) => `<line x1="${padL - 3}" x2="${padL}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--ledger-rule)"/><text x="${padL - 6}" y="${(Y(v) + 4).toFixed(1)}" font-size="10" text-anchor="end">${whole && Math.abs(v - Math.round(v)) < 1e-6 ? int(v) : one(v)}</text>`).join('');
  const legend = series.filter((s) => s.label).map((s) => s.label).join(' · ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${title}: ${legend}">
    <line x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}" stroke="var(--ledger-rule)"/>${yt}${parts}${ticks.join('')}
    <text x="${padL}" y="12" font-size="10">${legend}${unit ? ` (${unit})` : ''}</text><text x="${W - padR}" y="${H - 4}" font-size="10" text-anchor="end">day</text></svg>`;
}

/** Phase 2's water graph (bars: litres per 1,000 birds; dashed: water : feed on its own axis 0-3), any days. Skills update:
 *  exported for the water supply panel's Trend key (Water 1, ui-cycle-water.js). */
export function waterSvg(pts) {
  const W = 760, H = 220, padL = 40, padR = 52, padT = 22, padB = 30;
  if (!pts.length) return '<p class="book-note">No signed rows yet.</p>';
  const d0 = Math.min(...pts.map((p) => p.d)), n = Math.max(8, Math.max(...pts.map((p) => p.d)) - d0 + 1);
  const max = Math.max(1, ...pts.map((p) => p.v || 0)) * 1.08;
  const X = (d) => padL + ((d - d0 + 0.5) / n) * (W - padL - padR), Y = (v) => H - padB - (v / max) * (H - padT - padB);
  const bw = Math.min(46, ((W - padL - padR) / n) * 0.6), small = n > 12;
  const bars = pts.map((p) => {
    if (p.v == null) return '';
    const y = Y(p.v), hgt = H - padB - y, inside = hgt > 22;
    return `<rect x="${X(p.d) - bw / 2}" y="${y}" width="${bw}" height="${hgt}" fill="var(--ledger-ink)" opacity="0.72"/>`
      + (small ? '' : `<text x="${X(p.d)}" y="${inside ? y + 15 : y - 4}" font-size="11" font-weight="600" text-anchor="middle" style="fill:${inside ? '#fffaf0' : 'var(--ledger-ink)'}">${one(p.v)}</text>`);
  }).join('');
  const rmax = 3, RY = (r) => H - padB - (Math.min(rmax, r) / rmax) * (H - padT - padB);
  const rp = pts.filter((p) => p.ratio != null);
  const ratio = rp.map((p, i) => `${i ? 'L' : 'M'}${X(p.d)} ${RY(p.ratio)}`).join('');
  const dots = rp.map((p) => `<circle cx="${X(p.d)}" cy="${RY(p.ratio)}" r="3" fill="var(--ledger-ink2)"/>`).join('');
  const rAxis = [0, 1, 2, 3].map((r) => `<line x1="${W - padR}" x2="${W - padR + 4}" y1="${RY(r)}" y2="${RY(r)}" stroke="var(--ledger-ink2)"/><text x="${W - padR + 8}" y="${RY(r) + 4}" font-size="10" fill="var(--ledger-ink2)">${r}</text>`).join('');
  const step = Math.max(1, Math.ceil(n / 14));
  const days = pts.filter((p) => (p.d - d0) % step === 0).map((p) => `<text x="${X(p.d)}" y="${H - 10}" font-size="11" text-anchor="middle">${small ? p.d : `day ${p.d}`}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Water per 1,000 birds by day (bars), with the water to feed ratio (line, right axis 0 to 3)">
    <line x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}" stroke="var(--ledger-rule)"/>${bars}
    <line x1="${W - padR}" x2="${W - padR}" y1="${padT}" y2="${H - padB}" stroke="var(--ledger-ink2)" opacity="0.6"/>${rAxis}
    ${ratio ? `<path d="${ratio}" fill="none" stroke="var(--ledger-ink2)" stroke-width="2" stroke-dasharray="5 3"/>${dots}` : ''}${days}
    <text x="${padL}" y="12" font-size="10">bars: litres per 1,000 birds</text>
    <text x="${W - 4}" y="12" font-size="10" text-anchor="end" fill="var(--ledger-ink2)">dashed: water : feed</text></svg>`;
}

const locked = (text) => h('div', { class: 'locked' }, h('span', { html: ICONS.lock, 'aria-hidden': 'true' }), h('p', null, text));

/** The Graphs tab: each graph comes with its unlock (PHASE3.md §9.1). */
export function graphsPage(L) {
  const rows = (L.records.rows ? L.records.rows() : []).filter((r) => r.day >= 0 && r.day <= 46);
  const u = (k) => !!L.skills?.unlocked?.(k);
  const out = [];
  // Skills update (SKILLS.md §15.3 item 8): each graph's hint names its level by unlockLevel (Feed's graph at level 3 while
  // live); with live false every level is the one these hints always named
  const lv = (key) => unlockLevel(UNLOCKS[key]);
  const add = (key, lock, title, chart, note) => {
    if (!u(key)) { out.push(locked(typeof lock === 'function' ? lock(lv(key)) : lock)); return; }
    out.push(h('h3', { class: 'book-h' }, title), h('div', { class: 'graph', html: chart }), note ? h('p', { class: 'book-note' }, note) : null);
  };
  add('waterTrend', (n) => `The water trend graph comes with Water level ${n} on the skill tree.`, 'Water per 1,000 birds (L) and water : feed by day',
    waterSvg(rows.map((r) => ({ d: r.day, v: r.waterPerBirdMl, ratio: r.waterFeedRatio }))));
  add('weightGraph', (n) => `The weight curve comes with Growth & Performance level ${n}.`, 'Weight against the target (g)',
    dayChart({ title: 'Weight', series: [{ pts: rows.map((r) => [r.day, r.weightG]), label: 'line: your flock (scale and weighings)' },
      { pts: rows.map((r) => [r.day, r.targetWeightG || weightAt(r.day)]), dash: true, ink2: true, label: 'dashed: the target (bird scale plate)' },
      { kind: 'dots', pts: rows.filter((r) => r.weightSource === 'weighed').map((r) => [r.day, r.weightG]), label: 'dots: hand weighings' }] }));
  add('feedGraph', (n) => `The feed graph comes with Feed & Digestion level ${n}.`, 'Feed per bird per day (g) against the feed plate',
    dayChart({ title: 'Feed per bird', series: [{ kind: 'bars', pts: rows.map((r) => [r.day, r.feedPerBirdG]), label: 'bars: your flock' },
      { pts: rows.map((r) => [r.day, feedStdGAt(Math.max(0, flockAgeAt(r.day + 0.25)))]), dash: true, ink2: true, label: 'dashed: the feed program sign' }] }));
  add('gasGraph', (n) => `The gas graph comes with Heating level ${n}.`, 'Gas used (kg) between two gauge readings',
    dayChart({ title: 'Gas used', series: [{ kind: 'bars', pts: rows.map((r) => [r.day, r.gasKgUsed]), label: 'bars: kg between readings' }] }),
    'The gas tank plate: in the cool season 6,000 chicks to day 21 burn about 200–300 kg of gas.');
  add('comfortGraph', (n) => `The comfort graph comes with Body Temperature & Comfort level ${n}.`, 'House minimum and maximum against the target (°C)',
    dayChart({ title: 'House temperature', yMin: 10, series: [{ pts: rows.map((r) => [r.day, r.houseMaxC]), label: 'top line: house maximum' }, { pts: rows.map((r) => [r.day, r.houseMinC]), label: 'lower line: house minimum' },
      { pts: rows.map((r) => [r.day, r.targetC]), dash: true, ink2: true, label: 'dashed: the brooder sign target' }] }));
  return out;
}

/** The cycle summary (PHASE3.md §1, §8.5): one page after the clean-out. Plain numbers. */
export function buildSummaryPanel(L) {
  const titleId = uniqueId('summary-title');
  const { el, closeBtn } = dialogShell('result summary', titleId, L.close);
  closeBtn.hidden = true; // leave by the buttons
  const body = h('div', { class: 'result-body' });
  el.append(h('div', { class: 'result-case card' }, body), closeBtn);
  let s = null;
  const harder = createHarderCards({ run: () => L.run?.(), onStart: (id) => L.startCondition?.(id) });
  function render() {
    const run = L.run?.();
    s = s || run?.state()?.summary || (typeof L.records.cycleSummary === 'function' ? L.records.cycleSummary({ plan: run?.state()?.plan ?? null, levels: run?.state()?.levels ?? {} }) : null);
    if (!s) { body.replaceChildren(h('p', null, 'The cycle summary comes after the clean-out.')); return; }
    const big = (k, v, sub) => h('div', { class: 'big' }, h('p', { class: 'big-k' }, k), h('p', { class: 'big-v' }, v), sub ? h('p', { class: 'big-sub' }, sub) : null);
    const kv = (rows) => h('table', { class: 'ledger ledger--dark' }, h('tbody', null, rows.filter(Boolean).map(([k, ...v]) => h('tr', null, h('th', { scope: 'row' }, k), ...v.map((x) => h('td', null, x))))));
    const p = s.plan, a = s.actual || {};
    const dbl = deathsByLevelRows(s.deathsByLevel);
    // Phase 4: the condition, the standard start's levels and the last normal-season cycle beside this one
    const cond = s.condition ?? run?.state()?.runCondition ?? null, cname = cond ? conditionLabel(cond) : '';
    const fs = new Set(s.fromStandard || []), cmpd = s.compare || null;
    const fsNames = [...fs].map((id) => levelById(id)?.n).filter(Boolean);
    const fsNote = fs.size ? `Levels ${Math.min(...fsNames)}–${Math.max(...fsNames)} ${s.standardNote || 'from a standard start'}: the ideal farmer played them${cond ? ` ${condIn(cond)}` : ''}.` : null;
    const was = (v, f) => (cmpd && v != null ? `last normal-season cycle: ${f(v)}` : null);
    const dblRows = dbl.map((d) => {
      const c = cmpd && !fs.has(d.id ?? d.level) ? deathsByLevelRows(cmpd.deathsByLevel).find((x) => x.name === d.name) : null;
      return [d.name + (fs.has(d.id ?? d.level) || d.fromStandard ? ' (from a standard start)' : ''), `${two(d.pct)} %`,
        d.deaths != null ? `${int(d.deaths)} dead, ${int(d.culls || 0)} culled${d.doa ? `, ${int(d.doa)} dead on arrival` : ''}` : '', ...(cmpd ? [c ? `${two(c.pct)} %` : '—'] : [])];
    });
    const weights = (s.weights || []).filter((w) => w.targetG);
    const chart = dayChart({ title: 'Weight', series: [{ pts: weights.map((w) => [w.day, w.weighedG]), label: 'line: weighed' }, { kind: 'dots', pts: weights.map((w) => [w.day, w.weighedG]) },
      { pts: weights.map((w) => [w.day, w.targetG]), dash: true, ink2: true, label: 'dashed: the target' }] });
    const pts = s.points && Object.keys(s.points).length ? s.points : Object.fromEntries(SKILL_BRANCHES.map((b) => [b.id, L.skills?.points?.(b.id) ?? 0]));
    const branchName = (id) => SKILL_BRANCHES.find((b) => b.id === id)?.name || id;
    const btns = h('div', { class: 'result-btns' },
      button({ class: 'btn btn--accent', onclick: () => run?.startRun({ seed: (run.state().seed ?? 1) + 1 }) }, h('span', { html: ICONS.play, 'aria-hidden': 'true' }), 'Start the next flock'),
      button({ class: 'btn', onclick: () => L.level()?.toTitle() }, 'Replay a level'),
      button({ class: 'btn', onclick: () => L.openPanel('skilltree') }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), 'Skill tree'),
      button({ class: 'btn', onclick: () => L.level()?.toTitle() }, 'Back to the title'));
    body.replaceChildren(...nodes(
      h('header', { class: 'result-head' }, h('p', { class: 'sign-kicker' }, cname ? `The whole cycle · ${cname}` : 'The whole cycle'), h('h2', { id: titleId }, cname ? `Cycle summary · ${cname}` : 'Cycle summary')),
      h('div', { class: 'bigs bigs--4' },
        big('Birds sold', s.sold != null ? int(s.sold) : '—', [`of ${int(s.placed)} chicks placed`, was(cmpd?.sold, int)].filter(Boolean).join(' · ')),
        big('Mean live weight', s.meanLiveG != null ? `${int(s.meanLiveG)} g` : '—', [s.liveKg != null ? `${int(s.liveKg)} kg live in all` : null, was(cmpd?.meanLiveG, (v) => `${int(v)} g`)].filter(Boolean).join(' · ') || null),
        big('FCR', s.fcr != null ? two(s.fcr) : '—', [s.epef != null ? `production efficiency ${int(s.epef)}` : null,
          cmpd && cmpd.fcr != null ? `last normal-season cycle: ${two(cmpd.fcr)}${cmpd.epef != null ? `, efficiency ${int(cmpd.epef)}` : ''}` : null].filter(Boolean).join(' · ') || null),
        big('Deaths, culls, dead on arrival', s.mortalityPct != null ? `${two(s.mortalityPct)} %` : '—', ['of the chicks placed', was(cmpd?.mortalityPct, (v) => `${two(v)} %`)].filter(Boolean).join(' · '))),
      btns,
      fsNote ? h('p', { class: 'result-note' }, fsNote) : null,
      cmpd ? [h('h3', { class: 'result-h' }, `${cname || 'This cycle'} beside your last normal-season cycle`),
        kv([['', cname || 'This cycle', 'Last normal season'], ['Birds sold', s.sold != null ? int(s.sold) : '—', cmpd.sold != null ? int(cmpd.sold) : '—'],
          ['Mean live weight', s.meanLiveG != null ? `${int(s.meanLiveG)} g` : '—', cmpd.meanLiveG != null ? `${int(cmpd.meanLiveG)} g` : '—'],
          ['FCR', s.fcr != null ? two(s.fcr) : '—', cmpd.fcr != null ? two(cmpd.fcr) : '—'], ['Production efficiency', s.epef != null ? int(s.epef) : '—', cmpd.epef != null ? int(cmpd.epef) : '—'],
          ['Deaths, culls, dead on arrival', s.mortalityPct != null ? `${two(s.mortalityPct)} %` : '—', cmpd.mortalityPct != null ? `${two(cmpd.mortalityPct)} %` : '—']])] : null,
      h('h3', { class: 'result-h' }, 'Weight against the target'), h('div', { class: 'graph graph--dark', html: chart }),
      h('h3', { class: 'result-h' }, 'Deaths by level'),
      dbl.length ? kv([...(cmpd ? [['', cname || 'This cycle', '', 'Last normal season']] : []), ...dblRows]) : h('p', { class: 'result-note' }, 'Not in the record.'),
      h('h3', { class: 'result-h' }, 'Used'),
      kv([['Feed', s.feedKg != null ? `${int(s.feedKg)} kg` : '—'], ['Water', s.waterL != null ? `${int(s.waterL)} L` : '—'], ['Gas', s.gasKg != null ? `${int(s.gasKg)} kg` : '—'],
        ['Rest before the next chicks', s.restDays != null ? `${int(s.restDays)} days` : '—'], ['Swabs that grew bacteria', s.swabsPositive != null ? `${int(s.swabsPositive)} of 10` : '—']]),
      h('h3', { class: 'result-h' }, 'Your plan beside the flock'),
      p ? kv([['', 'Plan', 'Flock'], ['Losses', `${one(p.lossesPct)} %`, a.lossesPct != null ? `${two(a.lossesPct)} %` : '—'],
        ['Sale weight', `${one(p.saleKg)} kg`, a.saleKg != null ? `${two(a.saleKg)} kg` : '—'],
        ['Birds for sale a week', p.salePerWeek != null ? int(p.salePerWeek) : '—', s.sold != null && a.cycleDays ? int((s.sold * 7) / a.cycleDays) : '—'],
        ['Days per flock', int(p.cycleDays), a.cycleDays != null ? int(a.cycleDays) : '—']])
        : h('p', { class: 'result-note' }, fs.size ? 'This run began from a standard start: no plan of yours to compare with.' : 'This run started at the brooding week: no plan to compare with.'),
      run?.state()?.plan?.outcome ? h('p', { class: 'result-note' }, `The company’s reply: ${replyLines(run.state().plan).join(' · ')}.`) : null,
      h('h3', { class: 'result-h' }, 'Skill points by branch'),
      h('ul', { class: 'result-points' }, Object.entries(pts).map(([b, n]) => h('li', null, h('b', null, branchName(b)), ` · ${int(n)} ${n === 1 ? 'point' : 'points'}`))),
      run ? harder.el : null));
    harder.refresh();
  }
  return { el, kind: 'paused', show(sum) { s = sum || null; render(); }, onOpen() { render(); }, update(dt, force) { if (force) render(); } };
}
