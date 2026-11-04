(() => {
  // shown: not hidden, a box, and its centre inside every scrolling or clipping box around it (a list scrolled past it hides it)
  const V = (e, clip = true) => {
    if (!e || !(e instanceof Element)) return false;
    if (e.closest('[hidden], [aria-hidden="true"], .sr-only')) return false;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (!clip) return true;
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(`${s.overflowX} ${s.overflowY}`)) { const b = n.getBoundingClientRect(); if (c.x < b.left || c.x > b.right || c.y < b.top || c.y > b.bottom) return false; }
    }
    return true;
  };
  const rgb = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; };
  const most = (s) => { let best = null; for (const m of String(s).matchAll(/rgba?\(([^)]+)\)/g)) { const c = rgb(m[0]); if (c && (!best || c[3] > best[3])) best = c; } return best; };
  // the backgrounds behind the text: an ancestor counts only where the text's centre lies inside its box (a label set
  // outside its tick mark, top: 15px, sits on the panel, not on the tick)
  const inside = (n, c) => { const r = n.getBoundingClientRect(); return c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom; };
  const bg = (e) => { const layers = [], er = e.getBoundingClientRect(), c0 = { x: er.left + er.width / 2, y: er.top + er.height / 2 }; for (let n = e; n && n !== document.documentElement; n = n.parentElement) { if (n !== e && !inside(n, c0)) continue; const cs = getComputedStyle(n); let c = rgb(cs.backgroundColor); if ((!c || c[3] === 0) && /gradient/.test(cs.backgroundImage)) c = most(cs.backgroundImage); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; } } let base = [201, 196, 184]; for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; base = base.map((v, k) => v * (1 - c[3]) + c[k] * c[3]); } return base; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (e) => { const cs = getComputedStyle(e); let op = 1; for (let n = e; n && n !== document.documentElement; n = n.parentElement) op *= +getComputedStyle(n).opacity; const fg = rgb(cs.color) || [255, 255, 255, 1], b = bg(e), a = fg[3] * op; const f = b.map((v, k) => v * (1 - a) + fg[k] * a); const x = lum(f), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  window.__floors = (root) => {
    const out = [], seen = new Set(), list = typeof root === 'string' ? [...document.querySelectorAll(root)] : [root];
    let n = 0;
    for (const r of list) {
      const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const t = tw.currentNode, txt = t.textContent.trim();
        if (!txt || !/[A-Za-z0-9]/.test(txt)) continue;
        const e = t.parentElement;
        if (!e || seen.has(e) || !V(e)) continue;
        seen.add(e); n++;
        const cs = getComputedStyle(e), px = parseFloat(cs.fontSize);
        const caps = cs.textTransform === 'uppercase' || (txt.length >= 2 && /[A-Z]/.test(txt) && txt === txt.toUpperCase());
        const src = !!e.closest('.src, .src-k, .book-src, .wk-src, .plate-src');
        const floor = caps || src ? 11 : 12;
        const tag = `"${txt.slice(0, 28)}" (${(e.getAttribute('class') || e.tagName).slice(0, 40)})`;
        if (px < floor - 0.01) out.push(`${px}px under ${floor}: ${tag}`);
        else if (caps || src) { const k = contrast(e); if (k < 4.5) out.push(`contrast ${k.toFixed(2)}: ${tag}`); }
      }
    }
    return { n, bad: out };
  };
  window.__rings = (root) => {
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const r = typeof root === 'string' ? document.querySelector(root) : root;
    const els = r ? [...r.querySelectorAll(sel)].filter((e) => V(e, false)) : [];
    const bad = [];
    for (const e of els) {
      e.focus({ preventScroll: true });
      const cs = getComputedStyle(e);
      const ok = document.activeElement === e && ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow && cs.boxShadow !== 'none'));
      if (!ok) bad.push(`${(e.getAttribute('class') || e.tagName).slice(0, 30)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
    }
    return { n: els.length, bad };
  };
  window.__fid = () => { const a = document.activeElement; if (!a || a === document.body) return 'body'; const d = a.dataset || {}; return d.menu || d.titleAction || d.place || d.mapView || d.tab || (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 40); };
  return 'a11y helpers ready';
})()
