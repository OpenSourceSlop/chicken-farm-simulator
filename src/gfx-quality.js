// Graphics quality (PHASE5.md §4.4, §6.5): the pixel ratio, the sun's shadow and the flock's detail, set by the settings
// menu (graphics group) or stepped down by the frame-time governor while a setting is 'auto'. The governor is Phase 1's,
// moved here from main.js unchanged: if the median frame over 2 s is slower than about 28 fps it steps quality down,
// high-DPI screens to a 1.0 pixel ratio first, then the cheaper sun shadow, and only below about 20 fps a 0.85 render
// scale; it only steps down, waits 3 s between steps, and is off under automation (the harness renders in software).
// Owner after the design round: package "settings" (it adds the flock and shadow-off steps, PHASE5.md §4.4).
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

  function setShadows(mode) {
    if (mode === st.shadows) return;
    const sun = world?.sun;
    const wasOn = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = mode !== 'off';
    if (mode !== 'off' && sun) {
      const size = mode === 'high' ? GFX.shadowHigh : GFX.shadowLow;
      renderer.shadowMap.type = mode === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      perf.shadowMap = size;
    } else perf.shadowMap = 0;
    st.shadows = mode;
    // a shadow type or the shadow map on / off changes the programs: every material compiles again (once)
    if (wasOn !== renderer.shadowMap.enabled || mode !== 'off') scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
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
