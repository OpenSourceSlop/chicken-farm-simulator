// Graphics quality (PHASE5.md §4.4, §6.5): the pixel ratio, the sun's shadow and the flock's detail, set by the settings
// menu (graphics group) or stepped down by the frame-time governor while a setting is 'auto'. The governor is Phase 1's,
// moved here from main.js unchanged: if the median frame over 2 s is slower than about 28 fps it steps quality down,
// high-DPI screens to a 1.0 pixel ratio first, then the cheaper sun shadow, and only below about 20 fps a 0.85 render
// scale; it only steps down, waits 3 s between steps, and is off under automation (the harness renders in software).
// Owner after the design round: package "settings" (it adds the flock and shadow-off steps, PHASE5.md §4.4).
// Review round: no quality change compiles a shader. three 0.160 keys every program on shadowMap.enabled and
// shadowMap.type (WebGLPrograms), so both stay as main.js set them (on, PCF soft) for the whole session: the simple shadow
// is the same soft filter on a 1024 map (Phase 1's step 2 switched to PCF: a recompile of every lit material on exactly
// the slow machines the governor serves), and 'off' is a 256 map rendered once with no caster (every fragment lit) and
// then never again (shadowMap.autoUpdate false): the shadow pass costs nothing, the lit shaders stay the same programs.
//
//   const quality = createQuality({ THREE, renderer, scene, world, perf, settings, flock, onResize })
//   quality.pixelRatio()   what main.js's resize() renders at (min(devicePixelRatio, the cap))
//   quality.frame(rawDt)   every frame (real seconds, before the cap): the fps readout and the governor
//   quality.apply()        the graphics settings now (also on every change of the graphics group)
//   quality.state()        { auto: { ratio, shadows, flock }, ratioCap, shadows: 'high'|'low'|'off', flockDetail, step, governing, fps }
//   quality.debug.feed(dt, n)   n frames of dt seconds into the governor (tests; works under automation)
import { GFX } from './config.js';

export function createQuality({ THREE, renderer, scene, world, perf = {}, settings = null, flock = null, onResize = () => {} } = {}) {
  const G = GFX.governor;
  const st = { ratioCap: GFX.maxPixelRatio, shadows: 'high', flockDetail: 'full', step: 0 };
  const gov = { on: typeof navigator === 'undefined' || !navigator.webdriver, times: new Float32Array(120), n: 0, acc: 0, hold: G.firstHoldSec };
  const get = (k, d) => { try { return settings ? settings.get(`graphics.${k}`) : d; } catch { return d; } };
  const autoOf = () => ({ ratio: get('pixelRatio', 'auto') === 'auto', shadows: get('shadows', 'auto') === 'auto', flock: get('flockDetail', 'auto') === 'auto' });

  let casters = null;   // the casters switched off for the one empty shadow pass of 'off' (back after that frame)
  function restoreCasters() { if (casters) { for (const o of casters) o.castShadow = true; casters = null; } }
  function setShadows(mode) {
    if (mode === st.shadows) return;
    const sun = world?.sun, sm = renderer.shadowMap;
    void THREE;
    const size = mode === 'high' ? GFX.shadowHigh : mode === 'low' ? GFX.shadowLow : GFX.shadowOff;
    if (sun && sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    if (mode === 'off') {
      casters = casters || [];
      // meshes only: a light's castShadow is in the program key (numDirLightShadows), so the sun keeps its own
      scene.traverse((o) => { if (o.castShadow && !o.isLight) { o.castShadow = false; casters.push(o); } });
      sm.autoUpdate = false; sm.needsUpdate = true;
    } else {
      restoreCasters();
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
    if (resize) onResize();
  }
  /** A setting went back to 'auto': that part starts again from the top and the governor watches again. */
  function restart() {
    const a = autoOf();
    if (a.ratio) st.ratioCap = GFX.maxPixelRatio;
    if (a.shadows) setShadows('high');
    if (a.flock) setFlock('full');
    st.step = 0;
    gov.on = typeof navigator === 'undefined' || !navigator.webdriver;
    gov.hold = G.firstHoldSec; gov.n = 0; gov.acc = 0;
    apply();
  }

  function stepDown(median) {
    const a = autoOf(), ratio = renderer.getPixelRatio();
    gov.hold = G.holdSec;
    if (a.ratio && ratio > 1.01) st.ratioCap = 1;
    else if (a.shadows && st.shadows === 'high') setShadows('low');
    else if (a.ratio && ratio > 0.86 && median > G.verySlowSec) st.ratioCap = 0.85;
    else { gov.on = false; return false; }
    st.step++;
    onResize();
    return true;
  }
  function sample(rawDt, force = false) {
    if (!gov.on || (!force && typeof document !== 'undefined' && document.hidden)) return;
    if ((gov.hold -= rawDt) > 0) return;
    gov.times[gov.n++ % gov.times.length] = rawDt;
    if ((gov.acc += rawDt) < G.windowSec) return;
    const k = Math.min(gov.n, gov.times.length);
    const sorted = Array.from(gov.times.subarray(0, k)).sort((x, y) => x - y);
    gov.acc = 0; gov.n = 0;
    const median = sorted[k >> 1];
    if (median <= G.slowSec) return;
    stepDown(median);
  }

  settings?.subscribe?.((c) => { if (c.value === 'auto' && c.key !== 'quality') restart(); else apply(); }, 'graphics');
  apply({ resize: false });   // main.js sizes the canvas itself once the quality object exists

  const api = {
    pixelRatio: () => Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, st.ratioCap),
    frame(rawDt) {
      // after the frame that drew the empty shadow map (three clears needsUpdate when it has): the casters back
      if (casters && !renderer.shadowMap.needsUpdate) restoreCasters();
      perf.fps = (perf.fps || 0) + (1 / Math.max(rawDt, 1e-3) - (perf.fps || 0)) * 0.05;
      sample(rawDt);
    },
    apply,
    restart,
    state: () => ({ auto: autoOf(), ratioCap: st.ratioCap, shadows: st.shadows, flockDetail: st.flockDetail, step: st.step, governing: gov.on, fps: perf.fps || 0 }),
    debug: {
      /** n frames of dt seconds into the governor (works under automation: it switches the governor on first). */
      feed(dt, n = 1) { gov.on = true; gov.hold = Math.min(gov.hold, 0); for (let i = 0; i < n; i++) sample(dt, true); return api.state(); },
    },
  };
  return api;
}
