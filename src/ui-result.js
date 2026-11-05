// Level result screen (PHASE2.md §10, PHASE3.md §10): the key numbers large, each only when measured;
// the level's "Your week" and week table; the points earned; then "<Level> complete" or "<Level> not
// passed: <the measurement>." and the buttons. In a run: Continue to <next> · Replay <level> (its saved
// starts before the failing measurement) · Replay <previous level> with the record lines the failure
// carried over, as plain facts · Skill tree · Back to the title. Titles come from def.title.
// Phase 4 (PHASE4.md §3.3): the title names the run's condition ("Level 5 – Weeks 4 and 5 · Hot season") and the
// limits are the level's as the condition has them (a bad batch's 2.5 %, the chicks claimed from the hatchery apart).
// Owner: package "run" (Phase 2: "level").
import { LEVEL1, flowTargetAt, nippleHeightCmAt, targetTempAt, minVentM3hPer1000, weightAt, EQUIP, levelById } from './config.js';
import { SKILL_BRANCHES } from './config.js';
import { h, button, uniqueId, fmt0, nodes } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { dialogShell } from './ui-panels.js';
import { int, one, two, num, hhmm } from './ui-format.js';
import { weekTable } from './ui-records.js';
import { harvestPage, cleanPage, replyLines } from './ui-letters.js';
import { shortIn } from './ui-run.js';
import { SKILLS_UPDATE } from './config.js';
import { unlockCaption, groupUnlocks } from './job-words.js';
import { fillKeys } from './key-words.js';

/** Skills update: the payoffs and views this level unlocked (the caption's words, one line a level-up) and, on a failed level,
 *  the equipment's faults met in it ("Fan stages off from day 25 08:23 to 10:23"). Nothing while live is false. */
function skillsLines(res) {
  if (!SKILLS_UPDATE.live || !res) return [];
  const out = [], groups = groupUnlocks(res.unlocks || []);
  if (groups.length) out.push(h('h3', { class: 'result-h' }, 'New on your skill tree'), h('ul', { class: 'result-points result-unlocks' }, groups.map((g) => h('li', null, fillKeys(unlockCaption(g))))));
  if (!res.pass && res.faults?.length) out.push(h('p', { class: 'result-carried result-faults' }, h('b', null, 'The equipment in this level: '), res.faults.join(' · ')));
  return out;
}
/** The hour a result ended at; 24:00 for a level that ended at the close of its day (a bad batch's claim, PHASE5.md §6.8.2). */
const endHour = (res) => ((res.hour ?? 0) >= 24 ? '24:00' : hhmm(res.hour ?? 0));

function bandSvg(ratio) {
  const lo = 3, hi = 6, W = 300, X = (v) => 10 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 20);
  const ticks = [3, 3.5, 4, 4.5, 5, 5.5, 6].map((v) => `<path d="M${X(v)} 30v6" stroke="var(--ink-faint)"/><text x="${X(v)}" y="48" font-size="10" text-anchor="middle" fill="var(--ink-dim)">${v}</text>`).join('');
  const mark = ratio == null ? '' : `<path d="M${X(ratio)} 15v20" stroke="var(--ink)" stroke-width="3"/><path d="M${X(ratio) - 5} 14h10l-5 6z" fill="var(--ink)"/>`;
  return `<svg viewBox="0 0 ${W} 54" width="100%" style="max-width:${W}px" aria-hidden="true"><rect x="${X(4)}" y="16" width="${X(5) - X(4)}" height="14" rx="2" fill="var(--panel-raised-hi)" stroke="var(--ink-faint)" stroke-dasharray="3 2"/>
    <path d="M10 30H${W - 10}" stroke="var(--ink-faint)"/>${ticks}${mark}<text x="10" y="10" font-size="9" fill="var(--ink-dim)">Week 1 guide: 4–5 × (dashed band)</text></svg>`;
}

/** "Your week" of the brooding week: per day what was set and read, beside the sign value. Plain numbers. */
function yourWeek(L, res) {
  const tl = L.records.timeline?.() || [], hot = L.farm?.condition === 'hot';
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
    // review round: the hot season's decisive column: the house at 15:00 beside the row, the pad and the tunnel fans
    const pm = hot ? L.farm?.condX?.st?.pm15?.[d] : null;
    rows.push(h('tr', null, h('th', { scope: 'row' }, String(d)),
      h('td', null, sp != null ? `${one(sp)}` : '—', h('small', null, ` sign ${one(Math.round(targetTempAt(d) * 2) / 2)}`)),
      h('td', null, flows.length ? flows.map((f) => fmt0(f)).join(' / ') : '—', h('small', null, ` sign ${flowTargetAt(d)}`)),
      h('td', null, heights.length ? heights.map((x) => fmt0(x)).join(' / ') : '—', h('small', null, ` about ${fmt0(nippleHeightCmAt(d))}`)),
      h('td', null, air != null ? int(air) : '—', h('small', null, ` sign ≈ ${int(need)}`)),
      h('td', null, e.lightHours != null ? one(e.lightHours) : '—'),
      h('td', null, d === 0 ? (floor != null ? `${one(floor)} °C` : '—') : d === 1 ? (crops || '—') : ''),
      hot ? h('td', null, pm ? `${one(pm[0])}` : '—', h('small', null, pm ? ` row ${one(pm[1])} · pad ${pm[2] ? 'on' : 'off'} · ${pm[3]} fan${pm[3] === 1 ? '' : 's'}` : '')) : null));
  }
  return h('div', { class: 'ledger-scroll', tabindex: '0', role: 'region', 'aria-label': 'Your week' },
    h('table', { class: 'ledger ledger--dark' }, h('thead', null, h('tr', null, ['Day', 'Thermostat °C', 'Flow ml/min (lines)', 'Nipples cm', 'Timer air m³/h', 'Light h', 'Floor at arrival · crops', ...(hot ? ['House at 15:00 °C'] : [])].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows)));
}

/** "Your week" of a later level (records.timeline(), PHASE3.md §8.7): what was set and read each day. */
function yourDays(L, def) {
  const tl = (L.records.timeline?.() || []).filter((e) => e.day >= def.startDay && e.day <= Math.min(def.endDay, 46));
  if (!tl.length) return h('p', { class: 'result-note' }, 'No signed days in the record.');
  const yn = (v) => (v == null ? '—' : v ? 'yes' : 'no');
  return h('div', { class: 'ledger-scroll', tabindex: '0', role: 'region', 'aria-label': 'Your days' },
    h('table', { class: 'ledger ledger--dark' }, h('thead', null, h('tr', null, ['Day', 'Dark h', 'Lux measured', 'Timer air m³/h', 'Tunnel fans (most)', 'Pad on', 'Feed in the pans', 'Notes'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, tl.map((e) => h('tr', null, h('th', { scope: 'row' }, String(e.day)),
        h('td', null, e.darkHours != null ? one(e.darkHours) : e.lightHours != null ? one(24 - e.lightHours) : '—'),
        h('td', null, e.luxMeasured != null ? int(e.luxMeasured) : '—'),
        h('td', null, e.ventTimerM3h != null ? int(e.ventTimerM3h) : '—', e.ventSignM3h != null ? h('small', null, ` sign ≈ ${int(e.ventSignM3h)}`) : null),
        h('td', null, e.fansMax != null ? int(e.fansMax) : '—'),
        h('td', null, yn(e.padOn)),
        h('td', null, e.feedType ?? '—'),
        h('td', null, [e.curtainOpen ? 'curtain up' : null, e.vaccineHours != null ? `vaccine drunk in ${one(e.vaccineHours)} h` : null].filter(Boolean).join(' · ') || ''))))));
}

const branchName = (id) => SKILL_BRANCHES.find((b) => b.id === id)?.name || id;
const big = (k, v, sub, extra, extra2) => h('div', { class: 'big' }, h('p', { class: 'big-k' }, k), h('p', { class: 'big-v' }, v), sub ? h('p', { class: 'big-sub' }, sub) : null, extra || null, extra2 || null);
// review round: the brooding week's deaths by cause on the deaths card (the model's causes in the farmer's words)
const CAUSE_WORDS = { heat: 'heat', cold: 'cold', dehydration: 'thirst', weak: 'weak chicks', starveout: 'never found feed', box: 'in the boxes', sds: 'sudden death', legs: 'legs', disease: 'disease', respiratory: 'breathing' };
export function byCauseText(by) {
  const parts = Object.entries(by || {}).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${CAUSE_WORDS[k] || k} ${int(n)}`);
  return parts.length ? parts.join(', ') : null;
}
// the grid follows the number of cards shown (an early end shows two or three)
const bigs = (...cards) => { const c = cards.filter(Boolean); return h('div', { class: `bigs bigs--${c.length}` }, c); };
const deathsCard = (res, def) => big(def.fail?.withDoa ? 'Deaths, culls, dead on arrival' : 'Deaths and culls', `${two(res.deathsPct)} %`,
  `${int(res.deaths)} of ${int(res.aliveStart)} birds alive on day ${def.startDay}${res.doa ? ` · ${int(res.doa)} dead on arrival` : ''}${res.culls ? ` · ${int(res.culls)} culled` : ''}`);

/** The key numbers of a level, only those that were measured. */
function cardsOf(res, def) {
  if (def === LEVEL1 || res.levelId === LEVEL1.id) {
    return bigs(
      // only what was measured: no day 7 weight before the weigh-in age, then the card says what ended the level
      res.ratio != null
        ? big('Day 7 weight', `${two(res.ratio)} ×`, `chick weight · ${int(res.weightG)} g ${res.weighedByHand ? 'weighed' : 'automatic scale, not weighed by hand'} ÷ ${one(res.chickWeightG)} g (${res.chickSource === 'box' ? 'box weighing' : 'delivery note'})`, h('div', { class: 'band', html: bandSvg(res.ratio) }))
        : big(res.early ? 'Ended early' : 'Day 7 weight', res.early ? `Day ${fmt0(res.day)}, ${endHour(res)}` : 'not weighed', res.failText ? `${res.failText.charAt(0).toUpperCase()}${res.failText.slice(1)}. No day 7 weighing.` : 'No day 7 weighing.'),
      big('Deaths and culls', `${two(res.deathsPct)} %`, `${int(res.deaths)} of ${int(res.placed)} chicks ${res.placedReal === false ? 'delivered' : 'placed'}`,
        res.countedDead != null ? h('p', { class: 'big-sub' }, [`${int(res.countedDead)} counted at the bin`, `${int(res.deadOnFloor)} still lying in the house`,
          res.deadInBoxes ? `${int(res.deadInBoxes)} dead in the boxes` : null, res.culls ? `${int(res.culls)} culled` : null,
          // a bad batch (PHASE4.md §3.4): the chicks graded out on day 0 and claimed from the hatchery are counted apart
          res.claimedApart && res.claimed ? `${int(res.claimed)} graded out on day 0, claimed from the hatchery (not counted here)` : null,
          res.claimedApart && !res.claimed && res.gradedOut ? `${int(res.gradedOut)} graded out on day 0 counted as culls: the hatchery was not told that day` : null].filter(Boolean).join(' · ')) : null,
        res.byCause ? h('p', { class: 'big-sub' }, `By cause: ${res.byCause}`) : null),
      res.uniformityPct != null ? big('Uniformity', `${fmt0(res.uniformityPct)} %`, 'birds within ±10 % of the mean, hand weighing') : null,
      res.fcr != null ? big('FCR', two(res.fcr), 'feed ÷ live weight so far') : null);
  }
  if (res.levelId === 'plan') {
    const o = res.plan?.outcome, t = Object.fromEntries((o?.terms || []).map((x) => [x.key, x]));
    if (!o) return bigs(big('The plan', 'not sent', 'No plan went to the company.'));
    return bigs(
      t.salePerWeek ? big('Birds for sale a week', int(t.salePerWeek.value), `contract ${int(t.salePerWeek.limit)}${t.salePerWeek.max != null ? `, at most ${int(t.salePerWeek.max)}` : ''} · the company counts ${num(o.lossesCountedPct)} % losses`) : null,
      t.density ? big('At catching', `${one(t.density.value)} kg/m²`, `the contract allows ${int(t.density.limit)}`) : null,
      t.rest ? big('Rest days', int(t.rest.value), `the contract asks for at least ${int(t.rest.limit)}`) : null,
      t.houseBirds ? big('Chicks a house', int(t.houseBirds.value), `the contract allows ${int(t.houseBirds.limit)}`) : null);
  }
  if (res.levelId === 'finish') {
    const r = res.harvest;
    return bigs(
      r ? big('Harvest live weight', `${int(r.meanLiveG)} g`, `${int((res.share ?? 0) * 100)} % of ${int(res.targetG)} g at ${one(res.catchAgeDays)} days less ${int((1 - 0.98) * 100)} % shrink · the weight tickets`)
        : big('Harvest', 'not caught', res.failText ? `${res.failText.charAt(0).toUpperCase()}${res.failText.slice(1)}.` : null),
      r ? big('Birds sold', int(r.sold), r.doa != null ? `${int(r.doa)} dead on arrival at the plant` : null) : null,
      deathsCard(res, def),
      r && r.fcr != null ? big('FCR', two(r.fcr), r.epef != null ? `production efficiency ${int(r.epef)}` : 'all feed ÷ net kg') : null);
  }
  if (res.levelId === 'cleanout') {
    return bigs(
      big('Swabs that grew bacteria', res.lab ? `${int(res.lab.positive)} of ${int(res.lab.of)}` : '—', res.lab ? 'the lab letter: the whole house’s cleaning' : 'no swabs went to the lab'),
      big('Rest days', res.restDays != null ? int(res.restDays) : '—', res.closedDay != null ? `house closed on day ${res.closedDay}${res.bookedDay != null ? `, chicks on day ${res.bookedDay}` : ''}` : 'the house was not closed'));
  }
  // a week level
  return bigs(
    res.weightG != null ? big(`Day ${res.targetDay} weight`, `${int(res.weightG)} g`, `${int((res.share ?? 0) * 100)} % of the ${int(res.targetG)} g target · ${res.weighedByHand ? `${int(res.weighedN)} birds weighed` : 'automatic scale, not weighed by hand'}`)
      : big(res.early ? 'Ended early' : `Day ${res.targetDay} weight`, res.early ? `Day ${fmt0(res.day)}, ${endHour(res)}` : 'not weighed', `No day ${res.targetDay} weighing.`),
    deathsCard(res, def),
    res.uniformityPct != null ? big('Uniformity', `${fmt0(res.uniformityPct)} %`, 'birds within ±10 % of the mean, hand weighing') : null,
    res.fcr != null ? big('FCR', two(res.fcr), 'feed ÷ live weight so far') : null);
}

/** What the level needs, in plain words (the outcome's second line). */
function needsText(res, def) {
  if (res.levelId === LEVEL1.id) return `The level needs at least ${res.weightRatioMin ?? LEVEL1.fail.weightRatioMin} × chick weight at day 7 and deaths and culls at or below ${res.mortalityMaxPct ?? LEVEL1.fail.mortalityMaxPct} % of the chicks placed${res.claimedApart ? '; the chicks graded out on day 0 count apart once the hatchery is told the same day' : ''}.`;
  if (res.levelId === 'plan') return 'The level needs every term of the contract met in the company’s reply.';
  if (res.levelId === 'finish') return `The level needs a harvest live weight of at least ${int(def.target.minShare * 100)} % of the target at the catch age less the 2 % shrink, and deaths, culls and dead on arrival at or below ${def.fail.mortalityMaxPct} % of the birds alive on day ${def.startDay}.`;
  if (res.levelId === 'cleanout') return `The level needs ${def.target.maxPositive} or fewer of the 10 swabs to grow bacteria and at least ${def.target.restMinDays} days of rest before the next chicks.`;
  return `The level needs at least ${int((res.minShare ?? def.target.minShare) * 100)} % of the ${int(weightAt(def.target.day))} g target on day ${def.target.day} and deaths and culls at or below ${res.mortalityMaxPct ?? def.fail.mortalityMaxPct} % of the birds alive on day ${def.startDay}.`;
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
    const def = levelById(res.levelId) || LEVEL1;
    // the condition in the title (PHASE4.md §3.3): "Level 5 – Weeks 4 and 5 · Hot season"
    const name = res.title || def.title, title = `${name}${res.conditionLabel ? ` · ${res.conditionLabel}` : ''}`;
    const R = res.run;   // the run's buttons and lines (run.js decorate); null for Phase 2's lone brooding week
    const outcome = res.pass
      ? h('div', { class: 'outcome' }, h('h3', null, `${name} complete`), h('p', null, R
        ? (res.levelId === 'plan' && R.next ? 'The plan is in the book. Continue to the brooding week: house 1 gets the first flock of your plan.' : R.next ? `The level is in the book. ${R.next.label} on the same flock, or replay it to try other settings.` : 'The house rests clean. The cycle summary is the whole flock, from the plan to the next chicks.')
        : 'The week is in the book. Replay it to try other settings, or keep walking the farm on day 7.'))
      : h('div', { class: 'outcome outcome--again' }, h('h3', null, `${name} not passed: ${res.failText}.`), h('p', null, needsText(res, def)));
    const pts = res.points || [];
    const run = () => L.run?.();
    const prev = R?.previous;
    const btns = h('div', { class: 'result-btns' },
      R?.next && res.pass ? button({ class: 'btn btn--accent', onclick: () => run()?.next() }, h('span', { html: ICONS.next, 'aria-hidden': 'true' }), R.next.label) : null,
      R?.last && res.pass ? button({ class: 'btn btn--accent', onclick: () => L.openPanel('summary') }, 'See the cycle summary') : null,
      !R && res.pass ? button({ class: 'btn', onclick: () => L.level()?.keepWalking() }, 'Keep walking the farm') : null,
      ...(R ? R.replays.map((r, i) => button({ class: `btn${!res.pass && i === 0 ? ' btn--accent' : ''}`, onclick: () => (L.replayLevel ? L.replayLevel(r.id, r.day) : run()?.replay(r.id, { day: r.day })) }, r.label))
        : [button({ class: 'btn btn--accent', onclick: () => L.level()?.replay() }, `Replay ${shortIn(def)}`)]),
      prev ? button({ class: 'btn', onclick: () => (L.replayLevel ? L.replayLevel(prev.id, prev.day) : run()?.replay(prev.id, { day: prev.day })) }, prev.label) : null,
      button({ class: 'btn', onclick: () => L.openPanel('skilltree') }, h('span', { html: ICONS.tree, 'aria-hidden': 'true' }), 'Skill tree'),
      // Phase 5 (PHASE5.md §3.3, §8.9): the saves panel over the result (a parent: closing it shows the result again)
      L.ctx?.ui?.openSaves ? button({ class: 'btn', 'data-result-key': 'saves', onclick: () => L.ctx.ui.openSaves() }, h('span', { html: ICONS.save, 'aria-hidden': 'true' }), 'Save or load') : null,
      button({ class: 'btn', onclick: () => L.level()?.toTitle() }, 'Back to the title'));
    // the record lines the previous level carried into this one, as plain facts under its button
    const carried = prev && prev.carried?.length ? h('p', { class: 'result-carried' }, h('b', null, `From ${shortIn(levelById(prev.id))}: `), prev.carried.join(' · ')) : null;
    const kicker = res.early ? `Ended ${res.endedAt}` : res.levelId === LEVEL1.id ? 'Day 7 · the brooding week' : res.levelId === 'plan' ? 'Planning day' : res.levelId === 'cleanout' ? `Day ${fmt0(res.day)} · the next chicks` : `Day ${fmt0(res.day)} · ${def.short}`;
    const isL1 = res.levelId === LEVEL1.id;
    const paper = (nodes) => h('div', { class: 'book-paper result-paper' }, nodes);
    body.replaceChildren(...nodes(
      h('header', { class: 'result-head' }, h('p', { class: 'sign-kicker' }, kicker), h('h2', { id: titleId }, title)),
      // (review round: the brooding week's deaths by cause, from the flock's own count: the level is the flock so far)
      cardsOf(isL1 && !res.byCause ? { ...res, byCause: byCauseText(L.farm?.flock?.deadByCause) } : res, def),
      outcome, btns, carried,
      res.levelId === 'plan' && res.plan?.outcome ? [h('h3', { class: 'result-h' }, 'The company’s reply'), h('ul', { class: 'result-points' }, replyLines(res.plan).map((l) => h('li', null, l)))] : null,
      res.levelId === 'finish' ? [h('h3', { class: 'result-h' }, 'The harvest record'), paper(harvestPage(L))] : null,
      res.levelId === 'cleanout' ? [h('h3', { class: 'result-h' }, 'The clean-out page'), paper(cleanPage(L))] : null,
      res.levelId !== 'plan' ? [h('h3', { class: 'result-h' }, isL1 ? 'Your week' : 'Your days'), isL1 ? yourWeek(L, res) : yourDays(L, def)] : null,
      h('h3', { class: 'result-h' }, 'Points earned'),
      pts.length ? h('ul', { class: 'result-points' }, pts.map((p) => h('li', null, h('b', null, `${branchName(p.branch)} +${p.points}`), ` · ${p.text}${p.detail ? ` · ${p.detail}` : ''}`))) : h('p', { class: 'result-note' }, 'No points this level.'),
      // Skills update (SKILLS.md §6.3, §5.4): the level's new payoffs in the unlock caption's words; a failed level's faults
      ...skillsLines(res),
      res.levelId !== 'plan' ? [h('h3', { class: 'result-h' }, isL1 ? 'The week in the book' : 'The days in the book'),
        weekTable(L, { dark: true, from: isL1 ? LEVEL1.startDay : def.startDay, to: isL1 ? LEVEL1.endDay : Math.min(def.endDay, 46) })] : null,
      h('p', { class: 'result-note' }, `Result at ${endHour(res)} on day ${fmt0(res.day ?? def.endDay)}.`)));
  }
  return { el, kind: 'paused', show(r) { res = r; render(); }, update(dt, force) { if (force) render(); } };
}
