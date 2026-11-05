// Package "settings" (PHASE5.md §10.3): the settings store's values, the Graphics presets, the keys and their rebinding,
// the graphics quality's governor and manual settings (a fake renderer), the camera settings, and the reduced flock detail
// (the flock meshes' own triangles, the same behaviour). Node only, no browser:  node scripts/test-settings.mjs
import { SETTINGS_SCHEMA, createSettings, coerce, defaults, GRAPHICS_PRESETS, presetOf } from '../src/settings.js';
import { createKeys, KEY_ACTIONS, REBIND_WORDS } from '../src/keys.js';
import { createQuality } from '../src/gfx-quality.js';
import { createCameraControls, ORBIT_PER_PX, WHEEL_ZOOM } from '../src/player-controls.js';
import { moveActionOf, MOVE_ACTIONS } from '../src/player-input.js';
import { GFX } from '../src/config.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (c, m) => { if (!c) throw new Error(m); };
const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m }; };
const VERDICT = /\b(correct|incorrect|wrong|right answer|well done|great job|good job|excellent|perfect|failed you|mistake)\b/i;

test('coerce: every schema item clamps out-of-range numbers, sends unknown choices and wrong types to the default', () => {
  let n = 0;
  for (const [g, G] of Object.entries(SETTINGS_SCHEMA)) for (const [k, it] of Object.entries(G.items)) {
    const p = `${g}.${k}`, d = JSON.stringify(it.def);
    if (it.type === 'range') {
      assert(coerce(it, it.min - 5) === it.min && coerce(it, it.max + 5) === it.max, `${p}: clamped`);
      assert(coerce(it, String((it.min + it.max) / 2)) === (it.min + it.max) / 2, `${p}: a slider's string`);
      for (const bad of ['abc', null, undefined, {}, [], NaN, true]) assert(coerce(it, bad) === it.def, `${p}: ${String(bad)} -> default`);
    } else if (it.type === 'bool') {
      assert(coerce(it, true) === true && coerce(it, false) === false && coerce(it, 'true') === true && coerce(it, 'false') === false, `${p}: booleans`);
      for (const bad of [1, 0, 'yes', null, {}, []]) assert(coerce(it, bad) === it.def, `${p}: ${String(bad)} -> default`);
    } else if (it.type === 'choice') {
      for (const [o] of it.options) assert(coerce(it, o) === o, `${p}: ${o}`);
      for (const bad of ['nope', null, undefined, {}, [], 12345]) assert(coerce(it, bad) === it.def, `${p}: ${String(bad)} -> default`);
    } else if (it.type === 'map') {
      assert(JSON.stringify(coerce(it, { a: 'KeyB', b: 3, c: 'x'.repeat(40) })) === '{"a":"KeyB"}', `${p}: strings only`);
      for (const bad of [null, 'x', [], 5]) assert(JSON.stringify(coerce(it, bad)) === d, `${p}: ${String(bad)} -> default`);
    } else if (it.type === 'list') {
      assert(JSON.stringify(coerce(it, ['a', 2, 'b'])) === '["a","b"]', `${p}: strings only`);
      for (const bad of [null, 'x', {}, 5]) assert(JSON.stringify(coerce(it, bad)) === d, `${p}: ${String(bad)} -> default`);
    }
    n++;
  }
  assert(n >= 25, `${n} items checked`);
  // the store coerces on read: rubbish in storage reads as the defaults, the rest as stored
  const st = memStorage({ 'chickenFarm.settings.v1': JSON.stringify({ v: 1, values: { camera: { rotateSpeed: 99, zoomSpeed: 'x' }, graphics: { shadows: 'ultra' }, bogus: { a: 1 } } }) });
  const s = createSettings({ storage: st });
  assert(s.get('camera.rotateSpeed') === 2 && s.get('camera.zoomSpeed') === 1 && s.get('graphics.shadows') === 'auto', 'stored values coerced on read');
});

test('reset(group) gives one group its defaults and leaves the others', () => {
  const s = createSettings({ storage: memStorage() });
  s.setMany({ 'camera.rotateSpeed': 1.5, 'camera.invertZoom': true, 'sound.volume': 0.3, 'interface.watch': 'folded' });
  const seen = []; s.subscribe((c) => seen.push(c.path));
  assert(s.reset('camera') === 2 && seen.join() === 'camera.rotateSpeed,camera.invertZoom', `reset camera told ${seen}`);
  assert(s.get('camera.rotateSpeed') === 1 && s.get('camera.invertZoom') === false && s.get('sound.volume') === 0.3 && s.get('interface.watch') === 'folded', 'only the camera group');
  s.reset();
  assert(JSON.stringify(s.all()) === JSON.stringify(defaults()), 'reset() all');
});

test('Graphics presets: high, medium, low set the three; one changed by hand reads custom; automatic back', () => {
  const s = createSettings({ storage: memStorage() });
  const trio = () => [s.get('graphics.pixelRatio'), s.get('graphics.shadows'), s.get('graphics.flockDetail')].join(' · ');
  const want = { high: '1.5 · high · full', medium: '1 · low · full', low: '0.85 · off · reduced', auto: 'auto · auto · auto' };
  for (const [q, t] of Object.entries(want)) {
    s.set('graphics.quality', q);
    assert(trio() === t && s.get('graphics.quality') === q, `${q}: ${trio()} (${s.get('graphics.quality')})`);
    assert(presetOf(s.group('graphics')) === q, `presetOf ${q}`);
  }
  s.set('graphics.quality', 'medium');
  s.set('graphics.shadows', 'off');
  assert(s.get('graphics.quality') === 'custom' && trio() === '1 · off · full', `by hand: ${s.get('graphics.quality')} ${trio()}`);
  s.set('graphics.quality', 'auto');
  assert(trio() === want.auto, 'automatic sets the three back');
  assert(Object.keys(GRAPHICS_PRESETS).join() === 'auto,high,medium,low', 'four presets');
});

test('keys: the Phase 1-4 defaults and O / P / 1 / 4 / J; rebind and swap; useDead follows use; refused keys; alternates; rows', () => {
  const s = createSettings({ storage: memStorage() }), k = createKeys(s);
  const want = { forward: 'W', back: 'S', left: 'A', right: 'D', turnLeft: '←', turnRight: '→', zoomIn: '+', zoomOut: '−', use: 'E', bucket: 'G', squeeze: 'Q', probe: 'T',
    lux: 'L', air: 'V', notebook: 'N', skills: 'K', floorView: 'F', comfortView: 'C', moistureView: 'M', help: 'H', sound: 'U', menu: 'Esc', map: 'O', pause: 'P', speed1: '1', speed4: '4', nextJob: 'J' };
  for (const [id, l] of Object.entries(want)) assert(k.label(id) === l, `${id} on ${k.label(id)}, want ${l}`);
  assert(k.labels('run').join() === 'Shift' && k.labels('useDead').join('+') === 'Shift+E', 'run and Shift+E');
  const ev = (code, o = {}) => ({ code, key: /^Key/.test(code) ? code.slice(3).toLowerCase() : /^Digit/.test(code) ? code.slice(5) : code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...o });
  // a rebind and its swap
  let r = k.rebind('squeeze', 'KeyB');
  assert(r.ok && !r.swapped && k.matches(ev('KeyB'), 'squeeze') && !k.matches(ev('KeyQ'), 'squeeze') && k.actionOf(ev('KeyQ')) === null, 'Q -> B: B squeezes, Q does nothing');
  assert(k.rows('level').find((x) => x.id === 'squeeze').keys.join() === 'B', 'rows() shows the rebind');
  r = k.rebind('squeeze', 'KeyW');
  assert(r.ok && r.swapped === 'forward' && k.label('forward') === 'B' && k.label('squeeze') === 'W', `W swaps with Walk forward: ${JSON.stringify(r)}`);
  k.reset();
  // useDead follows use: E -> R, then Shift+R picks up the dead bird
  assert(k.rebind('use', 'KeyR').ok && k.matches(ev('KeyR', { shiftKey: true, key: 'R' }), 'useDead') && k.actionOf(ev('KeyR', { shiftKey: true, key: 'R' })) === 'useDead' && k.actionOf(ev('KeyR')) === 'use', 'Shift+R is useDead');
  assert(!k.matches(ev('KeyE', { shiftKey: true }), 'useDead') && k.labels('useDead').join('+') === 'Shift+R', 'Shift+E no longer');
  k.reset();
  // refused keys and their words
  assert(k.rebind('useDead', 'KeyX').reason === 'fixed' && k.rebind('run', 'KeyX').reason === 'fixed' && k.rebind('menu', 'KeyX').reason === 'fixed', 'fixed');
  for (const c of ['Escape', 'F5', 'F11', 'F12', 'ControlLeft', 'AltLeft', 'MetaLeft', 'CapsLock', 'PrintScreen']) assert(k.rebind('squeeze', c).reason === 'reserved', `${c} reserved`);
  for (const c of ['Tab', 'Enter', 'NumpadEnter', 'Space']) assert(k.rebind('squeeze', c).reason === 'ui', `${c} refused (ui)`);
  assert(k.rebind('nope', 'KeyX').reason === 'unknown', 'unknown');
  for (const w of Object.values(REBIND_WORDS)) assert(w && !VERDICT.test(w), `words: ${w}`);
  assert(k.label('squeeze') === 'Q', 'nothing changed by a refused key');
  // zoomIn keeps Numpad + across a swap
  assert(k.rebind('squeeze', 'Equal').ok && k.codes('zoomIn').join() === 'KeyQ,NumpadAdd' && k.matches(ev('NumpadAdd', { key: '+' }), 'zoomIn'), `zoomIn ${k.codes('zoomIn')}`);
  k.reset();
  // matches by key when the code is empty (letters and digits)
  assert(k.matches({ code: '', key: 'q' }, 'squeeze') && k.matches({ code: '', key: 'Q' }, 'squeeze') && k.matches({ code: '', key: '4' }, 'speed4') && k.matches({ code: '', key: 'o' }, 'map'), 'by key with no code');
  assert(!k.matches({ code: '', key: 'q', ctrlKey: true }, 'squeeze'), 'Ctrl+Q is no game key');
  k.rebind('speed4', 'Digit5');
  assert(k.matches({ code: '', key: '5' }, 'speed4') && !k.matches({ code: '', key: '4' }, 'speed4') && k.matches(ev('Numpad4'), 'speed4'), 'a digit rebind, Num 4 kept');
  k.reset();
  assert(JSON.stringify(s.get('keys.bindings')) === '{}', 'reset clears the stored bindings');
  for (const a of KEY_ACTIONS) assert(!VERDICT.test(a.what), `verdict word: ${a.what}`);
});

test('the farmer\'s keys (player-input.js on keys.matches): a rebound walk key walks, the old one does not', () => {
  const s = createSettings({ storage: memStorage() }), k = createKeys(s);
  const ev = (code, key = code.replace(/^Key/, '').toLowerCase(), o = {}) => ({ code, key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...o });
  const want = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', ShiftLeft: 'run', ArrowLeft: 'turnLeft', ArrowRight: 'turnRight', Equal: 'zoomIn', NumpadAdd: 'zoomIn', Minus: 'zoomOut', NumpadSubtract: 'zoomOut' };
  for (const [c, a] of Object.entries(want)) assert(moveActionOf(k, ev(c, c === 'ShiftLeft' ? 'Shift' : undefined, c === 'ShiftLeft' ? { shiftKey: true } : {})) === a, `${c} -> ${a}`);
  assert(moveActionOf(k, ev('KeyW', 'W', { shiftKey: true })) === 'forward', 'Shift+W still walks (runs)');
  assert(moveActionOf(k, ev('KeyE')) === null && moveActionOf(k, ev('KeyQ')) === null, 'E and Q are not his');
  assert(moveActionOf(k, ev('BracketRight', '+')) === 'zoomIn' && moveActionOf(k, ev('Slash', '-')) === 'zoomOut', 'a + / − on another key zooms (Phase 1 fallback)');
  k.rebind('forward', 'KeyI');
  assert(moveActionOf(k, ev('KeyI')) === 'forward' && moveActionOf(k, ev('KeyW')) === null, 'I walks forward, W does nothing');
  k.rebind('squeeze', 'KeyW');
  assert(moveActionOf(k, ev('KeyW')) === null && moveActionOf(k, ev('KeyI')) === 'forward', 'W taken by squeeze is no walk key');
  assert(MOVE_ACTIONS.length === 9, 'nine move actions');
});

// a fake renderer for the governor (three's renderer is not needed: the shadow map's flags, the pixel ratio)
function fakeGfx({ dpr = 1, settings }) {
  globalThis.window = { devicePixelRatio: dpr };
  const r = { shadowMap: { enabled: true, type: 2, autoUpdate: true, needsUpdate: false }, ratio: dpr, getPixelRatio() { return this.ratio; } };
  const sun = { isLight: true, castShadow: true, shadow: { mapSize: { x: 2048, y: 2048, set(a, b) { this.x = a; this.y = b; } }, map: null } };
  const meshes = [{ castShadow: true }, { castShadow: true }, { castShadow: false }];
  const scene = { traverse(fn) { fn(sun); for (const m of meshes) fn(m); } };
  const flock = { detail: 'full', setDetail(l) { this.detail = l; } };
  const q = createQuality({ THREE: { PCFSoftShadowMap: 2 }, renderer: r, scene, world: { sun }, settings, flock, onResize: () => { r.ratio = q.pixelRatio(); } });
  return { q, r, sun, meshes, flock };
}

test('the governor: 60 ms frames on a 2x screen step ratio 1, simple shadow, 0.85, reduced flock, shadows off, then stop; 30 ms: none', () => {
  const s = createSettings({ storage: memStorage() });
  const { q, r, sun, meshes, flock } = fakeGfx({ dpr: 2, settings: s });
  assert(q.pixelRatio() === GFX.maxPixelRatio, 'starts at the cap');
  const steps = [];
  for (let i = 0; i < 600 && q.state().governing; i++) {
    const before = q.state().step;
    q.debug.feed(0.06, 1);
    if (q.state().step > before) steps.push(q.state());
  }
  const order = steps.map((x) => x.taken[x.taken.length - 1].what);
  assert(order.join(' | ') === 'sharpness 1 | shadows simple | sharpness 0.85 | flock detail reduced | shadows off', `order: ${order.join(' | ')}`);
  const at = steps.map((x) => x.taken[x.taken.length - 1].at);
  for (let i = 1; i < at.length; i++) assert(at[i] - at[i - 1] >= GFX.governor.holdSec - 1e-6, `steps ${at[i - 1]} -> ${at[i]} s: 3 s apart at least`);
  assert(steps[0].ratioCap === 1 && steps[1].shadows === 'low' && steps[2].ratioCap === 0.85 && steps[3].flockDetail === 'reduced' && steps[4].shadows === 'off', 'each step\'s state');
  assert(r.ratio === 0.85 && flock.detail === 'reduced' && sun.shadow.mapSize.x === GFX.shadowOff, 'the renderer, the flock and the sun followed');
  assert(r.shadowMap.enabled === true && r.shadowMap.type === 2 && r.shadowMap.autoUpdate === false && sun.castShadow === true, 'shadows off: enabled and the type unchanged, the map no longer drawn, the sun keeps castShadow');
  assert(meshes[0].castShadow === false && meshes[1].castShadow === false, 'the one empty shadow pass has no caster');
  r.shadowMap.needsUpdate = false; q.frame(0.06);
  assert(meshes[0].castShadow === true && meshes[2].castShadow === false, 'the casters back after that frame');
  q.debug.feed(0.06, 200);
  assert(q.state().step === 5 && !q.state().governing, 'no more steps: the governor stops');
  assert(q.stepsWords() === 'shadows off, sharpness 0.85, flock detail reduced', `words: ${q.stepsWords()}`);
  // 30 ms frames: nothing
  const g2 = fakeGfx({ dpr: 2, settings: createSettings({ storage: memStorage() }) });
  g2.q.debug.feed(0.03, 1000);
  assert(g2.q.state().step === 0 && g2.q.state().ratioCap === GFX.maxPixelRatio && g2.q.state().shadows === 'high', 'frames of 30 ms: no step');
  // 40 ms frames (slow, not very slow): no 0.85, the flock and the shadow still step
  const g3 = fakeGfx({ dpr: 1, settings: createSettings({ storage: memStorage() }) });
  g3.q.debug.feed(0.04, 2000);
  assert(g3.q.state().taken.map((t) => t.what).join(' | ') === 'shadows simple | flock detail reduced | shadows off', `40 ms: ${g3.q.state().taken.map((t) => t.what).join(' | ')}`);
});

test('a manual setting pins its part through every step; back to auto restarts that part from the top', () => {
  const s = createSettings({ storage: memStorage() });
  const { q, r, sun, flock } = fakeGfx({ dpr: 2, settings: s });
  s.set('graphics.pixelRatio', '1.25');
  assert(q.state().ratioCap === 1.25 && r.ratio === 1.25 && s.get('graphics.quality') === 'custom', 'a pixel ratio by hand (the preset reads custom)');
  q.debug.feed(0.06, 2000);
  assert(q.state().ratioCap === 1.25 && q.state().taken.every((t) => t.part !== 'ratio'), 'the governor never touched the pinned ratio');
  assert(q.state().shadows === 'off' && flock.detail === 'reduced', 'the auto parts stepped');
  s.set('graphics.flockDetail', 'full');
  assert(flock.detail === 'full' && q.state().taken.every((t) => t.part !== 'flock'), 'the flock pinned to full');
  s.set('graphics.shadows', 'low');
  assert(q.state().shadows === 'low' && sun.shadow.mapSize.x === GFX.shadowLow && q.state().taken.length === 0, 'shadows pinned to simple: no step of the governor counts now');
  s.set('graphics.shadows', 'auto');
  assert(q.state().shadows === 'high' && sun.shadow.mapSize.x === GFX.shadowHigh && r.shadowMap.autoUpdate === true && q.state().governing, 'shadows back to auto: from the top, the governor watching');
  assert(q.state().ratioCap === 1.25 && flock.detail === 'full', 'the other parts as they were');
  s.set('graphics.quality', 'low');
  assert(q.state().ratioCap === 0.85 && q.state().shadows === 'off' && flock.detail === 'reduced' && r.shadowMap.enabled === true, 'Low');
  s.set('graphics.quality', 'high');
  assert(q.state().ratioCap === 1.5 && q.state().shadows === 'high' && flock.detail === 'full' && sun.shadow.mapSize.x === 2048, 'High');
  s.set('graphics.quality', 'auto');
  q.restart();
  assert(q.state().step === 0 && q.state().ratioCap === GFX.maxPixelRatio && q.state().shadows === 'high' && flock.detail === 'full', 'restart() from the top');
  delete globalThis.window;
});

test('the camera: turn speed 2 doubles a 200 px drag, invert flips it, zoom speed 0.5 halves the wheel\'s log zoom', () => {
  const s = createSettings({ storage: memStorage() }), cc = createCameraControls(s);
  const d1 = cc.orbit(200);
  assert(Math.abs(d1 + 200 * ORBIT_PER_PX) < 1e-12, `a 200 px right drag at 1: ${d1}`);
  s.set('camera.rotateSpeed', 2);
  assert(Math.abs(cc.orbit(200) / d1 - 2) < 0.01, 'turn speed 2: twice the yaw change');
  s.set('camera.invertRotate', true);
  assert(Math.abs(cc.orbit(200) / d1 + 2) < 0.01, 'the other way: the sign flips');
  assert(cc.keyTurn(1, 0.5) > 0 && Math.abs(cc.keyTurn(1, 0.5) - 1.7) < 1e-9, 'the arrow keys keep their direction, at the turn speed');
  const w1 = Math.log(cc.wheel(100));
  assert(Math.abs(w1 - 100 * WHEEL_ZOOM) < 1e-12, 'the wheel at 1');
  s.set('camera.zoomSpeed', 0.5);
  assert(Math.abs(Math.log(cc.wheel(100)) / w1 - 0.5) < 0.01, 'zoom speed 0.5 halves the log zoom');
  s.set('camera.invertZoom', true);
  assert(Math.abs(Math.log(cc.wheel(100)) / w1 + 0.5) < 0.01, 'the wheel the other way');
  assert(Math.log(cc.keyZoom(1, 1)) > 0, 'the − key still zooms out');
  s.reset('camera');
  assert(Math.abs(cc.orbit(200) - d1) < 1e-12, 'reset: as Phase 4');
  cc.dispose();
});

test('flock detail reduced: the flock meshes\' own triangles at least 40 % fewer; the same birds move exactly as at full detail', async () => {
  const THREE = await import('three');
  const { createFlock } = await import('../src/flock.js');
  const { createSim } = await import('../src/sim.js');
  const { buildBirdGeometry } = await import('../src/flock-geometry.js');
  const tri = (l) => buildBirdGeometry(l).index.count / 3;
  assert(tri(0) === 309 && tri(1) === 113 && tri(2) <= 0.6 * tri(1), `bird triangles ${tri(0)} / ${tri(1)} / ${tri(2)}`);
  const mk = (camPos) => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 600), env = createSim();
    env.setDay(3); env.setHour(10);
    camera.position.set(...camPos); camera.lookAt(-6, 0, 0); camera.updateMatrixWorld();
    return { f: createFlock({ scene, camera, env }, {}), env, scene };
  };
  // the default view (22 m away) and a close one (8 m: near birds in the near mesh)
  for (const cam of [[-14, 14, 17], [-8, 5, 6]]) {
    const a = mk(cam), b = mk(cam);
    b.f.setDetail('reduced');
    const p = new THREE.Vector3(-6, 0, 0);
    let ma = 0, mb = 0;
    for (let i = 0; i < 300; i++) {
      let t = performance.now(); a.f.update(1 / 30, a.env, p); ma += performance.now() - t;
      t = performance.now(); b.f.update(1 / 30, b.env, p); mb += performance.now() - t;
    }
    const pa = a.f.positions(), pb = b.f.positions();
    let diff = 0;
    for (let i = 0; i < pa.n; i++) if (pa.x[i] !== pb.x[i] || pa.z[i] !== pb.z[i]) diff++;
    assert(pa.n === pb.n && pa.n > 1000 && diff === 0, `${diff} of ${pa.n} birds moved differently at reduced detail`);
    assert(JSON.stringify(a.f.metrics()) === JSON.stringify(b.f.metrics()), 'the metrics are the same');
    a.scene.updateMatrixWorld(); b.scene.updateMatrixWorld();
    const ta = a.f.triangles(), tb = b.f.triangles();
    const ca = a.f.meshes.map((m) => m.count).join('+'), cb = b.f.meshes.map((m) => m.count).join('+');
    assert(ca === cb && ta > 0 && tb <= 0.6 * ta, `flock triangles ${ta} -> ${tb} (${(100 - 100 * tb / ta).toFixed(0)} % fewer), drawn ${ca} / ${cb}`);
    console.log(`     camera ${cam.join(', ')}: ${ca} drawn (near+far), triangles ${ta} -> ${tb} (${(100 - 100 * tb / ta).toFixed(0)} % fewer); update ${(ma / 300).toFixed(2)} / ${(mb / 300).toFixed(2)} ms`);
    // back to full: the full meshes again
    b.f.setDetail('full'); b.scene.updateMatrixWorld();
    assert(b.f.triangles() === ta && b.f.detail === 'full', 'full again');
  }
});

// ---------------- Skills update (SKILLS.md §7, §3.11, package "jobs") ----------------
test('skills update: Settings → Automation (all + one per branch, true, live-only tab) drives the perks; the phone key R only while live', async () => {
  const { SKILLS_UPDATE, SKILL_BRANCHES, PAYOFFS } = await import('../src/config.js');
  const { createPerks } = await import('../src/perks.js');
  const { createEvents, EV } = await import('../src/events.js');
  const A = SETTINGS_SCHEMA.automation;
  assert(A.hidden && A.liveOnly && A.by === 'jobs', 'the group is hidden and live-only');
  const keys = Object.keys(A.items);
  assert(keys.length === 12 && keys[0] === 'all' && SKILL_BRANCHES.every((b) => keys.includes(b.id)), `12 switches: ${keys}`);
  for (const [k, it] of Object.entries(A.items)) {
    assert(it.type === 'bool' && it.def === true && !VERDICT.test(it.label), `${k}: a bool, on, plain words`);
    if (k !== 'all') { const p = Object.values(PAYOFFS).find((x) => x.branch === k && x.level === 3); assert(p && it.label.startsWith(`${k === 'planning' ? 'Farm Planning' : ''}`), `${k}: its level 3 payoff`); }
  }
  const s = createSettings({ storage: memStorage() }), ev = createEvents();
  s.attachEvents?.(ev);
  const skills = { level: () => 3, points: () => 13, unlocked: () => true, profile: { cyclesDone: 1 } };
  const was = SKILLS_UPDATE.live;
  SKILLS_UPDATE.live = true;
  try {
    const perks = createPerks({ skills, settings: s, events: ev, allowed: true });
    assert(perks.auto('winch') && perks.has('boxHelper'), 'level 3 with the defaults');
    let pk = 0; ev.on(EV.PERKS, () => { pk++; });
    s.set('automation.water', false);
    assert(!perks.auto('winch') && perks.auto('timer') && perks.has('waterAllLines') && pk >= 1, 'water off: the winch off, the timer on, Water 2 stays; EV.PERKS');
    s.set('automation.all', false);
    assert(!perks.auto('timer') && !perks.has('boxHelper') && perks.has('ventFill'), 'all off: every level 3 off, the level 2 keys stay');
    s.reset('automation');
    assert(perks.auto('winch') && s.get('automation.all') === true, 'reset: on again');
    // the phone key: R, in the farm group, rebindable, in the legend and the Keys tab only while live
    const k = createKeys(s);
    const ev2 = (code) => ({ code, key: code.slice(3).toLowerCase(), shiftKey: false, ctrlKey: false, metaKey: false, altKey: false });
    assert(k.label('phone') === 'R' && k.matches(ev2('KeyR'), 'phone') && k.rows('level').some((r) => r.id === 'phone'), 'R is the phone while live');
    assert(k.rows('level').find((r) => r.id === 'floorView').what === 'Floor temperature view (Brooding 1)', 'the views name their branch level while live');
    const r = k.rebind('squeeze', 'KeyR');
    assert(r.ok && r.swapped === 'phone' && k.label('phone') === 'Q', `a rebind onto R swaps with the phone: ${JSON.stringify(r)}`);
    k.reset();
  } finally { SKILLS_UPDATE.live = was; }
  const k0 = createKeys(createSettings({ storage: memStorage() }));
  assert(!k0.matches(ev2c('KeyR'), 'phone') && !k0.rows('level').some((r) => r.id === 'phone'), 'live false: no phone key');
  assert(k0.rows('level').find((r) => r.id === 'floorView').what === KEY_ACTIONS.find((a) => a.id === 'floorView').what, 'live false: the Phase 5 words');
  const r0 = k0.rebind('squeeze', 'KeyR');
  assert(r0.ok && !r0.swapped, 'live false: R is a free key for a rebind');
});
const ev2c = (code) => ({ code, key: code.slice(3).toLowerCase(), shiftKey: false, ctrlKey: false, metaKey: false, altKey: false });

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`ok   ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
