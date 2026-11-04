// Review round (Phase 4 farmer's requests): the HUD's left column under every condition, the normal season and the power
// cut, at 960 x 600 and 1280 x 800: no gauge under the flock watch card or the alarm banner; the help legend over the
// watch card (elementFromPoint at the G row); a reload inside the cut brings the alarm back.
//   node scripts/rv-hud-steps.mjs  ->  scripts/rv-hud.json
//   node scripts/shoot.mjs --steps scripts/rv-hud.json --size 960x600 --no-build --out shots/review/hud
import { writeFileSync } from 'node:fs';

const RECTS = `(window.__rects = () => { const R = (e) => e.getBoundingClientRect(); const q = (s) => [...document.querySelectorAll(s)].filter((e) => !e.hidden && e.offsetParent);
  const f = (n, e) => { const r = R(e); return n + '[' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ']'; };
  return [...q('.hud-tl .clock'), ...q('.hud-tl .gauges'), ...q('.alarm'), ...q('.fw')].map((e) => f(e.classList[1] || e.classList[0], e)).join(' '); }, 'ok')`;
const CLEAR = (label) => ({
  expect: `(() => { const R = (e) => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const fw = document.querySelector('.fw'), al = document.querySelector('.alarm'), bad = [];
    for (const g of document.querySelectorAll('.hud-tl .gauge')) for (const [n, e] of [['the flock watch', fw], ['the alarm', al]]) if (e && !e.hidden && e.offsetParent && hit(R(g), R(e))) bad.push(g.getAttribute('aria-label') + ' under ' + n);
    return !bad.length && fw && !fw.hidden && ('${label}: ' + __rects()); })()`,
  label: `${label}: no gauge under the flock watch or the alarm`,
});
const at = (cond, lv, d, h) => ({ eval: `(__game.skills.profile.cyclesDone = Math.max(1, __game.skills.profile.cyclesDone || 0), __game.startRun({ seed: 1, at: '${lv === 'level1' ? 'level1' : 'plan'}', condition: ${cond ? `'${cond}'` : 'null'} }), ${lv === 'level1' ? '' : `__game.run.startLevel('${lv}', { from: 'standard', condition: ${cond ? `'${cond}'` : 'null'} }), `}__game.level.debug.goto(${d}, ${h}, { auto: true }), '${cond || 'normal'} day ${d} ' + __game.env.timeLabel + ' power ' + JSON.stringify(__game.farm.power?.on))` });
const steps = [{ eval: "__game.stop(), 'stopped'" }, { clearStorage: true }, { eval: RECTS }];
const CASES = [[null, 'week2', 10, 15.2, 'normal-d10'], ['rainy', 'week2', 10, 15.2, 'rainy-d10'], ['rainy', 'weeks45', 26, 15.0, 'rainy-d26'], ['hot', 'weeks45', 30, 15.2, 'hot-d30'],
  ['badChicks', 'level1', 1, 15.2, 'bad-d1'], ['water', 'weeks45', 27, 14.0, 'water-d27']];
let n = 1;
for (const [vw, vh] of [[960, 600], [1280, 800]]) {
  steps.push({ viewport: [vw, vh] });
  for (const [c, lv, d, h, name] of CASES) {
    if (vw === 1280 && !['rainy-d26', 'bad-d1'].includes(name)) continue;
    steps.push(at(c, lv, d, h), { advance: 1.2 }, CLEAR(`${name} ${vw}`), { shot: `rv-hud-${String(n++).padStart(2, '0')}-${name}-${vw}` });
  }
  // the power cut (rainy, day 33 15:15): the alarm under the gauges, the watch under the alarm
  steps.push(at('rainy', 'weeks45', 33, 15.0), { eval: "(__game.level.debug.goto(33, 15.25), 'cut ' + JSON.stringify(__game.farm.power))" }, { advance: 1.2 },
    { expect: "(() => { const a = document.querySelector('.alarm'); return __game.farm.power.on === false && a && !a.hidden && ('alarm: ' + a.innerText.slice(0, 60)); })()", label: `the cut ${vw}: the alarm banner shows` },
    CLEAR(`power cut ${vw}`), { shot: `rv-hud-${String(n++).padStart(2, '0')}-powercut-${vw}` });
}
// a reload inside the cut: the banner comes back (review round)
steps.push({ viewport: [960, 600] }, { reload: true }, { eval: "__game.stop(), 'after reload ' + __game.level.mode" }, { eval: RECTS },
  { eval: "(__game.run.continueSave(), 'continue at ' + __game.env.timeLabel + ' power ' + JSON.stringify(__game.farm.power))" }, { advance: 1.2 },
  { expect: "(() => { const a = document.querySelector('.alarm'); return __game.farm.power.on === false && a && !a.hidden && /power is off/.test(a.innerText) && ('alarm after the reload: ' + a.innerText.slice(0, 70)); })()", label: 'the alarm banner after a reload in the cut' },
  { expect: "(() => { const s = __game.level.watch.status(); return s.on && !document.querySelector('.fw').hidden && 'the watch card shows at once after Continue'; })()", label: 'the flock watch after Continue' },
  CLEAR('power cut after the reload 960'), { shot: `rv-hud-${String(n++).padStart(2, '0')}-powercut-reload-960` });
// the help legend over the watch card: elementFromPoint at the centre of the G row
steps.push(at(null, 'week2', 10, 15.2), { advance: 0.6 }, { press: 'h' }, { advance: 0.4 },
  { expect: "(() => { const dd = [...document.querySelectorAll('.help:not([hidden]) dd')].find((d) => /bucket down/i.test(d.textContent)); if (!dd) return false; const r = dd.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest('.help') && ('the G row is on top: ' + dd.textContent.slice(0, 50)); })()", label: 'the help legend over the flock watch (the G row)' },
  { shot: `rv-hud-${String(n++).padStart(2, '0')}-help-960` }, { press: 'h' });
writeFileSync(new URL('./rv-hud.json', import.meta.url), JSON.stringify(steps, null, 1));
console.log(`scripts/rv-hud.json: ${steps.length} steps`);
