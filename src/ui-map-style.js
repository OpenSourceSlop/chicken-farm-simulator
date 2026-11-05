// The farm map's own styles (PHASE5.md §8.11: each package styles its own screens; index.template.html keeps the shared
// panel frame .map-case / .map-head). Owner: package "experience". Injected once by ui-map.js (#map-style).
export const MAP_CSS = `
.map { --p5-w: 1100px; }
.map .map-case { padding: 20px 22px 18px; }
.map-head { margin-bottom: 0; }
.map-head p { margin-bottom: 10px; }
.map-body { display: grid; gap: 14px; align-items: start; }
.map-body.is-below { grid-template-columns: minmax(0, 1fr) !important; }
.map-box { position: relative; border-radius: 6px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--panel-edge); background: #3f6b3a; }
.map-svg { display: block; width: 100%; height: 100%; cursor: crosshair; user-select: none; }
.map-label { font: 600 12px var(--font-display); fill: var(--ink); paint-order: stroke; stroke: rgba(12, 20, 16, 0.82); stroke-width: 3.5px; stroke-linejoin: round; pointer-events: none; }
.map-word { font: 600 13px var(--font-display); fill: #fff3dc; paint-order: stroke; stroke: rgba(12, 20, 16, 0.85); stroke-width: 4px; stroke-linejoin: round; pointer-events: none; letter-spacing: 0.02em; }
.map-tagtext { font: 600 12px var(--font-display); fill: var(--ink); paint-order: stroke; stroke: rgba(12, 20, 16, 0.85); stroke-width: 3px; pointer-events: none; }
.map-pl { cursor: pointer; }
.map-pl .map-hit { fill: transparent; stroke: none; }
.map-pl.is-small { pointer-events: none; }
.map-post { fill: #f3ecd8; stroke: #14231b; stroke-width: 1.2; }
.map-postleg { stroke: #14231b; stroke-width: 2; }
.map-postn { font: 700 11px var(--font-display); fill: #14231b; pointer-events: none; letter-spacing: 0.02em; }
.map-mach { fill: #aeb6bd; stroke: #14231b; stroke-width: 1.2; }
.map-pl.is-faint { opacity: 0.45; }
/* fix round: a sign not on the farm now is a pale dashed board, its S number at full contrast (it is text to read) */
.map-pl--sign.is-faint { opacity: 1; }
.map-pl--sign.is-faint .map-post { fill: #cfc8b4; stroke-dasharray: 2 1.5; }
.map-pl--sign.is-faint .map-postleg { opacity: 0.5; }
.map-pl:hover .map-post, .map-pl:hover .map-mach, .map-pl.is-focus .map-post, .map-pl.is-focus .map-mach { stroke: var(--focus); stroke-width: 2.5; }
.map-pl.is-focus .map-hit, .map-pl:hover .map-hit { stroke: var(--focus); stroke-width: 2.5; stroke-dasharray: 4 3; }
.map-househit { fill: transparent; cursor: zoom-in; }
.map-househit:hover, .map-househit.is-focus { stroke: var(--focus); stroke-width: 2.5; stroke-dasharray: 5 4; }
.map-marker circle, .map-marker .map-pill { fill: var(--accent); stroke: #1e1305; stroke-width: 1.5; }
.map-marker.is-current circle, .map-marker.is-current .map-pill { stroke: #fff3dc; stroke-width: 2.5; }
.map-marker .map-markpt { fill: var(--accent); stroke: #1e1305; stroke-width: 1.2; }
.map-marker.is-current .map-markpt { stroke-width: 1.2; stroke: #1e1305; }
.map-leader { stroke: #1e1305; stroke-width: 1.6; stroke-linecap: round; opacity: 0.85; }
.map-dead { fill: none; stroke: #c8604a; stroke-width: 2.5; stroke-linecap: round; }
.map-dead-halo { fill: none; stroke: rgba(243, 236, 216, 0.92); stroke-width: 5.5; stroke-linecap: round; }
.map-me .map-me-halo { fill: none; stroke: rgba(243, 236, 216, 0.9); stroke-width: 4.5px; stroke-linejoin: round; }
.map-marker text { font: 700 12px var(--font-display); fill: #1e1305; pointer-events: none; }
.map-marker { cursor: pointer; }
.map-me path { fill: var(--accent); stroke: #1e1305; stroke-width: 1.5; stroke-linejoin: round; }
.map-me circle { fill: #1e1305; }
.map-rain { fill: #6aa8c8; opacity: 0.16; pointer-events: none; }
.map-tag { position: absolute; z-index: 2; max-width: 300px; padding: 6px 9px; border-radius: 6px; background: rgba(16, 24, 19, 0.94); border: 1px solid var(--panel-edge);
  color: var(--ink); font-size: 13px; line-height: 1.35; pointer-events: none; box-shadow: var(--shadow); }
.map-tag b { font-family: var(--font-display); font-weight: 600; }
.map-side { display: grid; gap: 10px; align-content: start; min-height: 0; overflow: auto; }
.map-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 7px; background: var(--panel-sunk); }
.map-tab { flex: 1; min-height: 32px; padding: 4px 10px; border: 0; border-radius: 5px; background: transparent; color: var(--ink-dim); font: 600 13px/1 var(--font-display); letter-spacing: 0.04em; cursor: pointer; }
.map-tab[aria-selected="true"] { background: var(--panel-raised-hi); color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent); }
.map-lists { display: grid; gap: 10px; overflow: auto; min-height: 0; padding-right: 2px; }
.map-group h3 { margin: 0 0 4px; }
.map-group ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.map-place { width: 100%; display: flex; align-items: center; gap: 7px; min-height: 30px; padding: 4px 8px; border-radius: 5px; border: 1px solid transparent; background: transparent;
  color: var(--ink); font: 500 13px/1.25 var(--font-body); text-align: left; cursor: pointer; }
.map-place:hover { background: var(--panel-raised); }
.map-place[aria-disabled="true"] { color: var(--ink-faint); }
.map-place .map-n { flex: none; min-width: 20px; height: 20px; display: inline-grid; place-items: center; border-radius: 10px; background: var(--accent); color: #1e1305; font: 700 12px/1 var(--font-display); }
.map-place .map-sn { flex: none; min-width: 26px; height: 20px; padding: 0 3px; display: inline-grid; place-items: center; border-radius: 2px; background: #f3ecd8; color: #14231b; font: 700 12px/1 var(--font-display); }
.map-key { margin: 0; color: var(--ink-dim); font-size: 12px; line-height: 1.4; }
.map-none { margin: 0; color: var(--ink-faint); font-size: 13px; }
`;
