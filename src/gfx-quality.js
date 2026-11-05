// Graphics quality (PHASE5.md §4.4, §6.5): the pixel ratio, the sun's shadow and the flock's detail, set by the settings
// menu (graphics group) or stepped down by the frame-time governor while a setting is 'auto'. The governor is Phase 1's,
// moved here from main.js unchanged: if the median frame over 2 s is slower than about 28 fps it steps quality down,
// high-DPI screens to a 1.0 pixel ratio first, then the cheaper sun shadow, and only below about 20 fps a 0.85 render
// scale; it only steps down, waits 3 s between steps, and is off under automation (the harness renders in software).
// Owner: package "settings". Phase 5 adds two steps at the end, only for parts left on auto: (4) the reduced flock,
// (5) shadows off; then it stops. A part set by hand is pinned (the governor skips its steps); set back to auto, that
// part starts again from the top (restart(part)).
// Review round: no quality change compiles a shader. three 0.160 keys every program on shadowMap.enabled and
// shadowMap.type (WebGLPrograms), so both stay as main.js set them (on, PCF soft) for the whole session: the simple shadow
// is the same soft filter on a 1024 map (Phase 1's step 2 switched to PCF: a recompile of every lit material on exactly
// the slow machines the governor serves), and 'off' is a 512 map with the house alone as caster (fix round: its roof and
// walls shade the floor), drawn only when the sun or the shadow box has moved (shadowMap.autoUpdate false): the shadow
// pass costs next to nothing, the lit shaders stay the same programs.
// A light's castShadow is in the program key too (numDirLightShadows): the sun keeps its own.
//
//   const quality = createQuality({ THREE, renderer, scene, world, perf, settings, flock, onResize })
//   quality.pixelRatio()   what main.js's resize() renders at (min(devicePixelRatio, the cap))
//   quality.frame(rawDt)   every frame (real seconds, before the cap): the fps readout and the governor
//   quality.apply()        the graphics settings now (also on every change of the graphics group)
//   quality.restart(part?) part ('ratio' | 'shadows' | 'flock', or every auto part) from the top, the governor watching
//   quality.state()        { auto: { ratio, shadows, flock }, ratioCap, shadows: 'high'|'low'|'off', flockDetail, step,
//                            governing, fps, taken: [{ part, what, at }] }
//   quality.stepsWords()   the governor's steps in effect in plain words ('shadows simple, sharpness 1'; '' for none)
//   quality.debug.feed(dt, n)   n frames of dt seconds into the governor (tests; works under automation)
import { GFX } from './config.js';

export function createQuality({ THREE, renderer, scene, world, perf = {}, settings = null, flock = null, onResize = () => {} } = {}) {
  const G = GFX.governor;
  const st = { ratioCap: GFX.maxPixelRatio, shadows: 'high', flockDetail: 'full', step: 0, taken: [] };
  const gov = { on: typeof navigator === 'undefined' || !navigator.webdriver, times: new Float32Array(120), n: 0, acc: 0, hold: G.firstHoldSec, clock: 0, fresh: true };
  const get = (k, d) => { try { return settings ? settings.get(`graphics.${k}`) : d; } catch { return d; } };
  const autoOf = () => ({ ratio: get('pixelRatio', 'auto') === 'auto', shadows: get('shadows', 'auto') === 'auto', flock: get('flockDetail', 'auto') === 'auto' });

  let casters = null;   // the casters switched off for one shadow pass of 'off' (back after that frame)
  function restoreCasters() { if (casters) { for (const o of casters) o.castShadow = true; casters = null; } }
  // Fix round: 'off' keeps the house's own shadow. The roof and walls are what shade the floor and the birds, so without
  // them the used litter read pale like fresh husk and the birds glared white (litter colour is a cue the farmer reads).
  // The house alone is drawn into the small map, and only when the sun has turned more than about 5 degrees (about a farm
  // hour) or the shadow box, which follows the farmer, has moved a few metres: the pass costs next to nothing, and no
  // program changes (the sun keeps castShadow; a mesh's castShadow is not in any program key).
  const OFF_TURN = Math.cos((5 * Math.PI) / 180), OFF_MOVE = 6;
  let offRef = null, shell = null;
  const sunDir = (sun, out) => { out.x = sun.position.x - sun.target.position.x; out.y = sun.position.y - sun.target.position.y; out.z = sun.position.z - sun.target.position.z;
    const l = Math.hypot(out.x, out.y, out.z) || 1; out.x /= l; out.y /= l; out.z /= l; return out; };
  const dirNow = { x: 0, y: 1, z: 0 };
  function inShell(o) { if (!shell) return false; for (let q = o; q; q = q.parent) if (q === shell) return true; return false; }
  /** One shadow pass of 'off': every caster outside the house off for that frame (back in frame()), the map drawn. */
  function drawShell() {
    const sun = world?.sun;
    if (!shell || !shell.parent) shell = scene.getObjectByName?.('house') || null;
    casters = casters || [];
    scene.traverse((o) => { if (o.castShadow && !o.isLight && !inShell(o)) { o.castShadow = false; casters.push(o); } });
    renderer.shadowMap.needsUpdate = true;
    if (sun?.position && sun.target?.position) {
      const d = sunDir(sun, { x: 0, y: 0, z: 0 }), t = sun.target.position;
      offRef = { dir: d, at: { x: t.x, y: t.y, z: t.z } };
    } else offRef = null;
  }
  /** Before each render: the casters back after the pass that drew 'off', and in 'off' a new pass when the sun or the
   *  shadow box has moved. */
  function sync() {
    if (casters && !renderer.shadowMap.needsUpdate) restoreCasters();
    if (st.shadows !== 'off' || casters) return;
    const sun = world?.sun;
    if (!sun?.position || !sun.target?.position || !offRef) return;
    sunDir(sun, dirNow);
    const t = sun.target.position, a = offRef.at;
    if (dirNow.x * offRef.dir.x + dirNow.y * offRef.dir.y + dirNow.z * offRef.dir.z < OFF_TURN || Math.hypot(t.x - a.x, t.z - a.z) > OFF_MOVE) drawShell();
  }
  function setShadows(mode) {
    if (mode === st.shadows) return;
    const sun = world?.sun, sm = renderer.shadowMap;
    void THREE;
    const size = mode === 'high' ? GFX.shadowHigh : mode === 'low' ? GFX.shadowLow : GFX.shadowOff;
    if (sun && sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    if (mode === 'off') {
      // meshes only: a light's castShadow is in the program key (numDirLightShadows), so the sun keeps its own
      restoreCasters();
      sm.autoUpdate = false;
      drawShell();
    } else {
      restoreCasters(); offRef = null;
      sm.autoUpdate = true; sm.needsUpdate = true;
    }
    perf.shadowMap = mode === 'off' ? 0 : size;
    st.shadows = mode;
  }
  function setFlock(level) { if (level === st.flockDetail) return; st.flockDetail = level; try { flock?.setDetail?.(level); } catch (err) { console.error('flock detail', err); } }

  /** The settings now: manual values pin; 'auto' keeps what the governor stepped to (from the top after a change to auto). */
  function apply({ resize = true } = {}) {
    const pr = get('pixelRatio', 'auto'), sh = get('shadows', 'auto'), fd = get('flockDetail', 'auto');
    if (pr !== 'auto') st.ratioCap = Math.min(GFX.maxPixelRatio, parseFloat(pr) || 1);
    if (sh !== 'auto') setShadows(sh);
    if (fd !== 'auto') setFlock(fd);
    // a part pinned by hand: the governor's steps of that part no longer count
    const a = autoOf();
    st.taken = st.taken.filter((t) => a[t.part]);
    st.step = st.taken.length;
    if (resize) onResize();
  }
  /** A setting went back to 'auto': that part (every auto part with no argument) starts again from the top and the
   *  governor watches again. */
  function restart(part = null) {
    const a = autoOf(), all = !part;
    if (a.ratio && (all || part === 'ratio')) st.ratioCap = GFX.maxPixelRatio;
    if (a.shadows && (all || part === 'shadows')) setShadows('high');
    if (a.flock && (all || part === 'flock')) setFlock('full');
    st.taken = st.taken.filter((t) => !all && t.part !== part);
    st.step = st.taken.length;
    gov.on = typeof navigator === 'undefined' || !navigator.webdriver;
    gov.hold = G.firstHoldSec; gov.n = 0; gov.acc = 0; gov.fresh = true;
    apply();
  }

  // Phase 1's three steps, then Phase 5's two, each only for a part left on auto
  function stepDown(median) {
    const a = autoOf(), ratio = renderer.getPixelRatio();
    gov.hold = G.holdSec;
    let t = null;
    if (a.ratio && ratio > 1.01) { st.ratioCap = 1; t = { part: 'ratio', what: 'sharpness 1' }; }
    else if (a.shadows && st.shadows === 'high') { setShadows('low'); t = { part: 'shadows', what: 'shadows simple' }; }
    else if (a.ratio && ratio > 0.86 && median > G.verySlowSec) { st.ratioCap = 0.85; t = { part: 'ratio', what: 'sharpness 0.85' }; }
    else if (a.flock && st.flockDetail === 'full') { setFlock('reduced'); t = { part: 'flock', what: 'flock detail reduced' }; }
    else if (a.shadows && st.shadows === 'low') { setShadows('off'); t = { part: 'shadows', what: 'shadows off' }; }
    else { gov.on = false; return false; }
    st.taken.push({ ...t, at: +gov.clock.toFixed(3) });
    st.step = st.taken.length;
    onResize();
    return true;
  }
  function sample(rawDt, force = false) {
    if (!gov.on || (!force && typeof document !== 'undefined' && document.hidden)) return;
    gov.clock += rawDt;
    if ((gov.hold -= rawDt) > 0) return;
    gov.fresh = false;
    gov.times[gov.n++ % gov.times.length] = rawDt;
    if ((gov.acc += rawDt) < G.windowSec) return;
    const k = Math.min(gov.n, gov.times.length);
    const sorted = Array.from(gov.times.subarray(0, k)).sort((x, y) => x - y);
    gov.acc = 0; gov.n = 0;
    const median = sorted[k >> 1];
    if (median <= G.slowSec) return;
    stepDown(median);
  }

  const PART_OF = { pixelRatio: 'ratio', shadows: 'shadows', flockDetail: 'flock' };
  settings?.subscribe?.((c) => {
    if (c.value === 'auto' && PART_OF[c.key]) restart(PART_OF[c.key]);
    else if (PART_OF[c.key]) apply();
  }, 'graphics');
  apply({ resize: false });   // main.js sizes the canvas itself once the quality object exists

  const api = {
    pixelRatio: () => Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, st.ratioCap),
    /** Fix round: before each render (main.js frame and renderNow): 'off' redraws the house's shadow when the sun or the
     *  shadow box has moved. */
    sync,
    /** Fix round (a Low boot linked the shadow programs in play): fn runs with every caster on and the soft shadow
     *  drawn each frame, so the warm-up compiles the depth programs whatever the stored quality; the setting after. */
    warm(fn) {
      const was = st.shadows;
      if (was !== 'high') setShadows('high');
      try { return fn(); } finally { if (was !== 'high') setShadows(was); }
    },
    frame(rawDt) {
      // after the frame that drew the 'off' shadow map (three clears needsUpdate when it has): the casters back
      if (casters && !renderer.shadowMap.needsUpdate) restoreCasters();
      perf.fps = (perf.fps || 0) + (1 / Math.max(rawDt, 1e-3) - (perf.fps || 0)) * 0.05;
      sample(rawDt);
    },
    apply,
    restart,
    state: () => ({ auto: autoOf(), ratioCap: st.ratioCap, shadows: st.shadows, flockDetail: st.flockDetail, step: st.step, governing: gov.on, fps: perf.fps || 0,
      taken: st.taken.map((t) => ({ ...t })) }),
    stepsWords() {
      const a = autoOf(), out = [];
      if (a.shadows && st.shadows !== 'high') out.push(st.shadows === 'off' ? 'shadows off' : 'shadows simple');
      if (a.ratio && st.ratioCap < GFX.maxPixelRatio) out.push(`sharpness ${st.ratioCap}`);
      if (a.flock && st.flockDetail === 'reduced') out.push('flock detail reduced');
      return out.join(', ');
    },
    debug: {
      /** n frames of dt seconds into the governor (works under automation: it switches the governor on first). */
      // (the first hold after a start or a restart is skipped; the 3 s between steps is kept)
      feed(dt, n = 1) { gov.on = true; if (gov.fresh) gov.hold = 0; for (let i = 0; i < n; i++) sample(dt, true); return api.state(); },
    },
  };
  return api;
}
