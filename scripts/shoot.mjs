// Screenshot and test harness. Builds the game, serves dist/index.html the way the artifact
// viewer wraps it, maps the three.js CDN to node_modules, then runs scripted steps in Chromium.
//
//   node scripts/shoot.mjs                         # build + run the "tour" scenario into shots/
//   node scripts/shoot.mjs --scenario cold-hot     # another built-in scenario
//   node scripts/shoot.mjs --steps my-steps.json   # your own steps (JSON array)
//   options: --no-build  --out <dir>  --size 1280x800  --only <shot name,...>
//
// Step forms (JSON objects):
//   {"state": {...}}         window.__game.setState(...)  e.g. {"day":1,"houseTemp":27,"heaterLevel":1,"farmer":{"x":-14,"z":0}}
//   {"settle": 20}           run the flock 20 s at a fixed step with the clock paused (no rendering)
//   {"advance": 5}           run everything 5 s at a fixed step (clock moves)
//   {"wait": 500}            let the page run in real time for 500 ms
//   {"key": "w", "hold": 800}   hold a key;  {"press": "e"}  tap a key
//   {"click": [640, 400]}    left click at canvas pixel;  {"click": [x,y], "button": "right"}
//   {"clickOn": "css"}       real mouse click on the centre of a page element (e.g. a HUD button)
//   {"holdKey": "w", "for": 0.6}  hold a key while the game advances 0.6 s at a fixed step
//                            (for steps files that stopped the render loop with __game.stop())
//   {"drag": {"from": [x,y], "to": [x,y], "button": "right"}}
//   {"wheel": 400}           mouse wheel at the canvas centre
//   {"eval": "js expression"}  evaluated in the page, result printed
//   {"metrics": "label"}     print flock metrics + climate snapshot
//   {"shot": "name"}         screenshot to <out>/<name>.png
//   {"viewport": [400, 800]}
//   {"reload": true}         reload the page (localStorage kept: autosave tests) and wait for __game.ready
//   {"clearStorage": true}   remove this page's localStorage (a fresh player)
// Real-input steps for play-throughs (steps files that stopped the loop with __game.stop()):
//   {"walkTo": [x, z], "tol": 0.6, "max": 60}   walk there by real mouse clicks on the ground (the
//                            farmer's click-to-walk and path finding): clicks the target, or a point
//                            toward it that is on screen and not under the HUD, advances until he
//                            gets there, repeats; prints where he ended and the game time it took
//   {"clickText": "Take the barrow", "in": ".panel", "times": 1}  real mouse click(s) on the centre of
//                            the first visible button / label / tab whose text (or aria-label)
//                            starts with this (default scope: the whole HUD)
//   {"advanceUntil": "js expr", "max": 120, "step": 0.5}  advance in steps until the expression is truthy
//   {"expect": "js expr", "label": "..."}   evaluate; print PASS / FAIL (a FAIL makes the exit code 1)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes(`--${name}`);

const outDir = path.resolve(root, opt('out', 'shots'));
const [vw, vh] = opt('size', '1280x800').split('x').map(Number);
const only = opt('only', null)?.split(',');

const SCENARIOS = {
  tour: [
    { wait: 1500 },
    { shot: 'gate' },
    // heaterLevel 1 / 0 = brooders full on / off; a setpoint alone lets the thermostat pick the level
    { state: { farmer: { x: -14, z: 1 }, day: 1, hour: 9, setpoint: 34, houseTemp: 27, heaterLevel: 1, paused: true } },
    { settle: 20 }, { metrics: 'cold day 1 (house 27 °C, brooders on)' }, { shot: 'cold-day1' },
    { state: { houseTemp: 34 } },
    { settle: 25 }, { metrics: 'right day 1 (house 34 °C, thermostat 34)' }, { shot: 'right-day1' },
    { state: { houseTemp: 38, heaterLevel: 0 } },
    { settle: 25 }, { metrics: 'hot day 1 (house 38 °C, brooders off)' }, { shot: 'hot-day1' },
    { state: { day: 30, setpoint: 20, houseTemp: 31, heaterLevel: 0, fans: 0, farmer: { x: 6, z: 1 } } },
    { settle: 25 }, { metrics: 'hot day 30 (house 31 °C, no fans)' }, { shot: 'hot-day30' },
    { state: { houseTemp: 21.5 } },
    { settle: 25 }, { metrics: 'right day 30 (house 21.5 °C)' }, { shot: 'right-day30' },
    { state: { day: 1, setpoint: 34, houseTemp: 34, farmer: { x: -10, z: 0.5 }, zoom: 7 } },
    { settle: 20 }, { shot: 'closeup-chicks' },
    { state: { day: 35, setpoint: 20, houseTemp: 20, heaterLevel: 0, farmer: { x: -4, z: 0.5 }, zoom: 7 } },
    { settle: 20 }, { shot: 'closeup-broilers' },
    { state: { day: 12, setpoint: 28.5, houseTemp: 29, fans: 6, pad: true, farmer: { x: 18, z: 9 }, zoom: 24, cameraYaw: 0.6 } },
    { settle: 10 }, { wait: 800 }, { shot: 'fan-end' },
    { state: { farmer: { x: -21, z: 9 }, cameraYaw: -0.6 } },
    { wait: 500 }, { shot: 'pad-end' },
    { state: { hour: 22, fans: 0, pad: false, day: 2, setpoint: 33.5, houseTemp: 33, farmer: { x: -14, z: 11 }, zoom: 26, cameraYaw: 0 } },
    { settle: 10 }, { wait: 500 }, { shot: 'night' },
    { state: { hour: 10, setpoint: 34, houseTemp: null, paused: false, farmer: { x: -12, z: -4.6, yaw: 0 }, zoom: 14 } },
    { wait: 400 }, { press: 'e' }, { wait: 500 }, { shot: 'controller-panel' }, { press: 'Escape' },
    { state: { farmer: { x: -16, z: -4.6 } } },
    { wait: 400 }, { press: 'e' }, { wait: 500 }, { shot: 'sign-panel' }, { press: 'Escape' },
    { viewport: [400, 820] }, { wait: 800 }, { shot: 'phone' },
    { viewport: [1280, 800] },
  ],
  'cold-hot': [
    { wait: 800 },
    { state: { farmer: { x: -14, z: 1 }, day: 1, hour: 9, setpoint: 34, houseTemp: 27, heaterLevel: 1, paused: true } },
    { settle: 20 }, { metrics: 'cold' }, { shot: 'cold' },
    { state: { houseTemp: 34 } }, { settle: 25 }, { metrics: 'right' }, { shot: 'right' },
    { state: { houseTemp: 38, heaterLevel: 0 } }, { settle: 25 }, { metrics: 'hot' }, { shot: 'hot' },
  ],
  // Phase 2 contract smoke test: every hook exists and a level can be asked for (PHASE2.md)
  'p2-hooks': [
    { wait: 500 },
    { eval: "['events','farm','records','skills','save','props','interact','level'].map(k => k + ':' + typeof window.__game[k]).join(' ')" },
    { eval: "'mode ' + __game.level.mode + ', farm ' + __game.farm.mode + ', save available ' + __game.save.available" },
    { eval: "__game.startLevel({ seed: 1 }), 'startLevel -> mode ' + __game.level.mode + ', jobs ' + __game.jobs().length" },
    { eval: "JSON.stringify(__game.farm.act('water.flowtest', { line: 0 }))" },
    { shot: 'p2-hooks' },
  ],
  walk: [
    { wait: 1000 }, { shot: 'walk-0' },
    { key: 'w', hold: 1500 }, { shot: 'walk-1' },
    { key: 'd', hold: 1000 }, { shot: 'walk-2' },
    { click: [800, 300] }, { wait: 1500 }, { shot: 'walk-3' },
    { drag: { from: [640, 400], to: [840, 400], button: 'right' } }, { wait: 300 }, { shot: 'walk-rotated' },
    { wheel: -600 }, { wait: 300 }, { shot: 'walk-zoomed' },
    { eval: 'JSON.stringify(window.__game.snapshot().player)' },
  ],
};

function loadSteps() {
  const file = opt('steps', null);
  if (file) return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const name = opt('scenario', 'tour');
  if (!SCENARIOS[name]) throw new Error(`unknown scenario ${name}; built-ins: ${Object.keys(SCENARIOS).join(', ')}`);
  return SCENARIOS[name];
}

// The artifact viewer wraps the published file in this skeleton
const SKELETON_HEAD = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';

async function main() {
  if (!flag('no-build')) execSync('node build.mjs', { cwd: root, stdio: 'inherit' });
  const page_html = SKELETON_HEAD + fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8') + '</body></html>';
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page_html); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;

  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  // Software WebGL on a busy shared machine can be slow; give every action plenty of time.
  page.setDefaultTimeout(180000);
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) problems.push(`[requestfailed] ${r.url()}`); });

  const threeDir = path.join(root, 'node_modules/three');
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (route) => {
    const rel = route.request().url().split('three@0.160.0/')[1].split('?')[0];
    const file = path.join(threeDir, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
  });
  await page.route(/fonts\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/fonts\.gstatic\.com/, (route) => route.abort());

  await page.goto(url);
  try {
    await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 120000 });
  } catch {
    console.log('GAME DID NOT BOOT. Problems:\n' + problems.join('\n'));
    await page.screenshot({ path: path.join(outDir, 'boot-failure.png') });
    await browser.close(); server.close(); process.exit(1);
  }

  const center = () => [page.viewportSize().width / 2, page.viewportSize().height / 2];
  let expectFails = 0;
  for (const step of loadSteps()) {
    if (step.walkTo) console.log(`walkTo [${step.walkTo}] ->`, await walkTo(page, step.walkTo, step));
    else if (step.clickText) {
      const at = await page.evaluate(([text, scope]) => {
        const els = [...document.querySelectorAll(`${scope} button, ${scope} label, ${scope} [role=tab]`)];
        const b = els.find((x) => x.offsetParent !== null && !x.disabled && (x.textContent.replace(/\s+/g, ' ').trim().startsWith(text) || (x.getAttribute('aria-label') || '').startsWith(text)));
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      }, [step.clickText, step.in || '#hud']);
      if (!at) console.log(`clickText "${step.clickText}": NOT FOUND`);
      else {
        for (let i = 0; i < (step.times ?? 1); i++) await page.mouse.click(at[0], at[1]);
        console.log(`clickText "${step.clickText}"${step.times ? ` x${step.times}` : ''}`);
      }
    } else if (step.advanceUntil) {
      const r = await page.evaluate(([expr, max, dt]) => {
        const f = new Function(`return (${expr});`);
        let t = 0;
        while (!f() && t < max) { window.__game.advance(dt); t += dt; }
        return { ok: !!f(), t };
      }, [step.advanceUntil, step.max ?? 120, step.step ?? 0.5]);
      console.log(`advanceUntil ${step.advanceUntil} -> ${r.ok ? 'met' : 'NOT MET'} after ${r.t.toFixed(1)} s`);
    } else if (step.expect) {
      const r = await page.evaluate(step.expect);
      if (!r) expectFails++;
      console.log(`${r ? 'PASS' : 'FAIL'} ${step.label || step.expect}${typeof r === 'string' ? `: ${r}` : ''}`);
    } else if (step.holdKey) {
      await page.keyboard.down(step.holdKey);
      await page.evaluate((s) => window.__game.advance(s), step.for ?? 0.5);
      await page.keyboard.up(step.holdKey);
    } else if (step.clickOn) await page.click(step.clickOn);
    else if (step.state) await page.evaluate((s) => window.__game.setState(s), step.state);
    else if (step.settle != null) await page.evaluate((s) => window.__game.settle(s), step.settle);
    else if (step.advance != null) await page.evaluate((s) => window.__game.advance(s), step.advance);
    else if (step.wait != null) await page.waitForTimeout(step.wait);
    else if (step.key) { await page.keyboard.down(step.key); await page.waitForTimeout(step.hold ?? 500); await page.keyboard.up(step.key); }
    else if (step.press) await page.keyboard.press(step.press);
    else if (step.click) await page.mouse.click(step.click[0], step.click[1], { button: step.button || 'left' });
    else if (step.drag) {
      const b = step.drag.button || 'left';
      await page.mouse.move(...step.drag.from); await page.mouse.down({ button: b });
      const n = 8;
      for (let i = 1; i <= n; i++) {
        await page.mouse.move(step.drag.from[0] + ((step.drag.to[0] - step.drag.from[0]) * i) / n, step.drag.from[1] + ((step.drag.to[1] - step.drag.from[1]) * i) / n);
      }
      await page.mouse.up({ button: b });
    } else if (step.wheel != null) { await page.mouse.move(...center()); await page.mouse.wheel(0, step.wheel); }
    else if (step.eval) console.log('eval:', step.eval, '=>', await page.evaluate(step.eval));
    else if (step.metrics) {
      const r = await page.evaluate(() => ({ m: window.__game.metrics(), s: window.__game.snapshot() }));
      console.log(`metrics [${step.metrics}]`, JSON.stringify(r.m), '| house', r.s.houseTemp?.toFixed?.(1), 'target', r.s.targetTemp?.toFixed?.(1), 'day', r.s.dayNumber ?? r.s.day?.toFixed?.(1));
    } else if (step.shot) {
      if (only && !only.includes(step.shot)) continue;
      await page.evaluate(() => window.__game.renderNow());
      const file = path.join(outDir, `${step.shot}.png`);
      await page.screenshot({ path: file });
      console.log('shot', path.relative(root, file));
    } else if (step.viewport) await page.setViewportSize({ width: step.viewport[0], height: step.viewport[1] });
    else if (step.reload) {
      await page.reload();
      await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 120000 });
    } else if (step.clearStorage) await page.evaluate(() => { try { localStorage.clear(); } catch { /* blocked */ } });
  }

  const fps = await page.evaluate(async () => { const f0 = window.__game.frames; await new Promise((r) => setTimeout(r, 2000)); return (window.__game.frames - f0) / 2; });
  console.log(`frames per second in headless SwiftShader (software, far slower than a real GPU): ${fps.toFixed(1)}`);
  console.log(problems.length ? `PROBLEMS (${problems.length}):\n${problems.join('\n')}` : 'No console errors or page errors.');
  if (expectFails) console.log(`${expectFails} expectation(s) FAILED`);
  await browser.close();
  server.close();
  process.exit(problems.some((p) => p.startsWith('[pageerror]')) || expectFails ? 1 : 0);
}

// Walk the farmer to (tx, tz) with real mouse clicks (click-to-walk), leg by leg: each leg clicks the
// target, or the farthest point toward it that is on screen and on the canvas (not under the HUD).
async function walkTo(page, [tx, tz], { tol = 0.6, max = 60 } = {}) {
  const t0 = await page.evaluate(() => window.__game.env.day);
  let spent = 0, legs = 0, stuck = 0;
  while (spent < max && legs < 24) {
    const pick = await page.evaluate(([tx, tz, tol]) => {
      const g = window.__game, p = g.player.position;
      if (Math.hypot(tx - p.x, tz - p.z) <= tol) return { done: true };
      g.player.update(0); // camera matrices for this position
      const cv = g.renderer.domElement, rect = cv.getBoundingClientRect();
      for (let f = 1; f > 0.04; f *= 0.8) {
        const wx = p.x + (tx - p.x) * f, wz = p.z + (tz - p.z) * f;
        const v = new g.THREE.Vector3(wx, 0, wz).project(g.camera);
        if (Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.92 || v.z > 1) continue;
        const px = rect.left + ((v.x + 1) / 2) * rect.width, py = rect.top + ((1 - v.y) / 2) * rect.height;
        if (document.elementFromPoint(px, py) !== cv) continue;
        return { px, py, wx, wz };
      }
      return { fail: true };
    }, [tx, tz, tol]);
    if (pick.done) break;
    if (pick.fail) return `NO CLICKABLE POINT toward ${tx},${tz}`;
    legs++;
    const from = await page.evaluate(() => { const p = window.__game.player.position; return [p.x, p.z]; });
    await page.mouse.click(pick.px, pick.py);
    let last = null, still = 0;
    for (let i = 0; i < 60 && spent < max; i++) {
      const s = await page.evaluate(([wx, wz]) => { window.__game.advance(0.5); const p = window.__game.player.position; return [Math.hypot(wx - p.x, wz - p.z), p.x, p.z]; }, [pick.wx, pick.wz]);
      spent += 0.5;
      if (s[0] < 0.4) break;
      if (last && Math.hypot(s[1] - last[0], s[2] - last[1]) < 0.05) { if (++still >= 2) break; } else still = 0;
      last = [s[1], s[2]];
    }
    const to = await page.evaluate(() => { const p = window.__game.player.position; return [p.x, p.z]; });
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.15 && ++stuck >= 2) break; // the goal is as close as he gets
  }
  const end = await page.evaluate(([tx, tz, t0]) => { const g = window.__game, p = g.player.position; return { x: p.x, z: p.z, d: Math.hypot(tx - p.x, tz - p.z), gameMin: (g.env.day - t0) * 1440, inside: g.player.isInside }; }, [tx, tz, t0]);
  return `at ${end.x.toFixed(1)},${end.z.toFixed(1)} (${end.d.toFixed(2)} m off${end.d > tol + 0.3 ? ' NOT REACHED' : ''}${end.inside ? ', inside' : ''}) after ${spent.toFixed(1)} s real, ${end.gameMin.toFixed(1)} game min, ${legs} click(s)`;
}

main().catch((e) => { console.error(e); process.exit(1); });
