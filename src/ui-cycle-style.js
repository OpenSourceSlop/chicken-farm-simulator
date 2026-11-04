// CSS of the Phase 3 equipment and inspection panels (package "panels"). registerCyclePanels injects it
// once into <head>; it builds on the Phase 2 classes of index.template.html (equip case, plate, LCD,
// keys, ledger paper) and only adds the new parts. Colours come from the tokens: lamps and LCDs only,
// never a good / bad colour on a reading.
const CSS = `
.cyc-tabs { display: flex; gap: 4px; margin: 0 0 10px; }
.cyc-tabs .ctrl-tab { flex: 1 1 0; }
.cyc-sec { display: grid; gap: 8px; }
.cyc-k { margin: 0; font: 600 12px/1.2 var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; color: var(--key-sub); }
.cyc-k small { letter-spacing: 0.04em; text-transform: none; font-weight: 500; }
.cyc-line { margin: 0; font-size: 13.5px; line-height: 1.4; color: var(--key-ink); }
.cyc-line + .cyc-line { margin-top: 2px; }
.cyc-dim { color: var(--key-sub); }
.cyc-box { padding: 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.04); min-width: 0; color: var(--key-ink); }
.cyc-presets .ctrl-apply { justify-content: flex-start; gap: 6px; }
.cyc-presets .key--wide { min-width: 0; height: 34px; padding: 0 10px; font-size: 11.5px; letter-spacing: 0.05em; }
.cyc-row2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cyc-row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.cyc-check { display: inline-flex; align-items: center; gap: 8px; font: 600 13px/1.2 var(--font-display); letter-spacing: 0.04em; color: var(--key-ink); cursor: pointer; }
.cyc-check input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--key-on-hi); }
.cyc-num { width: 92px; box-sizing: border-box; padding: 5px 7px; border: 0; border-radius: 4px; background: var(--lcd); color: var(--lcd-ink); font: 700 15px/1.1 var(--font-display); text-align: right; box-shadow: inset 0 0 0 2px var(--plate-edge); }
.cyc-num:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.cyc-progress { height: 4px; margin-top: 6px; border-radius: 2px; background: rgba(0, 0, 0, 0.35); overflow: hidden; }
.cyc-progress > span { display: block; height: 100%; background: var(--accent); transform-origin: left center; transform: scaleX(0); }
.cyc-plate-col { min-width: 0; }
.cyc-plate-col .plate { margin-top: 0; }
.cyc-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 250px); gap: 10px; align-items: start; }
/* LCD strip with house °C and humidity side by side */
.cyc-lcd { padding: 10px 12px 8px; }
.cyc-lcd .lcd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 22px; }
.cyc-lcd .lcd-num { font-size: 23px; }
.cyc-lcd .lcd-cell--wide { grid-column: span 2; }
.cyc-windchill { flex-wrap: wrap; }
.cyc-windchill .lcd-sub { flex-basis: 100%; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; opacity: 0.8; margin-top: -2px; }
/* fan panel: six switches with lamps and an air vane */
.fanbank { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.fan-sw { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); }
.fan-sw .key { width: 40px; height: 36px; }
.fan-name { font: 600 13px/1.15 var(--font-display); letter-spacing: 0.07em; text-transform: uppercase; }
.fan-name small { display: block; font: 500 11.5px/1.2 var(--font-body); letter-spacing: 0; text-transform: none; color: var(--key-sub); }
.fan-vane { display: inline-flex; width: 30px; height: 30px; color: var(--key-sub); }
.fan-vane svg { width: 100%; height: 100%; }
.fan-vane.is-turning svg { animation: cyc-spin 0.6s linear infinite; color: var(--key-ink); }
@keyframes cyc-spin { to { transform: rotate(360deg); } }
.cyc-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.cyc-controls .cyc-dim { margin-right: auto; font: 600 12.5px/1.3 var(--font-display); }
.cyc-stages { display: grid; gap: 6px; }
.cyc-stage { display: grid; grid-template-columns: 74px minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: 8px; }
.cyc-stage .key { width: 34px; height: 32px; }
.cyc-stage .lcd-mini { min-width: 62px; padding: 6px; font-size: 15px; }
.cyc-stage .ctrl-keys { gap: 4px; }
.cyc-chart { padding: 8px 10px; border-radius: 5px; background: linear-gradient(180deg, var(--lcd), var(--lcd-shade)); color: var(--lcd-ink); }
.cyc-chart svg { display: block; width: 100%; }
.cyc-chart text { fill: currentColor; font-family: var(--font-display); }
/* pad pump */
.cyc-pad svg { display: block; width: 100%; max-width: 420px; height: auto; }
/* heat budget bars (diverging, neutral colours) */
.cyc-bars { display: grid; grid-template-columns: 110px minmax(0, 1fr) 54px; gap: 3px 8px; align-items: center; font: 600 12.5px/1.2 var(--font-display); color: var(--key-ink); }
.cyc-bars .bar { position: relative; height: 10px; border-radius: 2px; background: rgba(255, 255, 255, 0.06); }
.cyc-bars .bar::before { content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--key-sub); }
.cyc-bars .bar > span { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: var(--key-sub); }
.cyc-bars .bar > span.in { background: var(--sign-yellow); }
.cyc-bars .v { text-align: right; }
/* planning sheet (his own worksheet, ledger paper) */
.cyc-sheet { padding: 12px 14px; border-radius: 6px; background: var(--ledger-paper); color: var(--ledger-ink); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); }
.cyc-sheet h3 { margin: 0 0 6px; font: 700 12.5px/1.2 var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; }
.cyc-sheet h3 + .cyc-sheet-rows { margin-top: 2px; }
.cyc-sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; align-items: start; }
.cyc-sheet-col { min-width: 0; }
.cyc-sheet-wide { grid-column: 1 / -1; }
.cyc-sheet-rows { display: grid; grid-template-columns: minmax(0, 1fr) 92px; gap: 4px 8px; align-items: center; margin-bottom: 10px; }
.cyc-sheet-rows label { font-size: 13.5px; line-height: 1.3; }
.cyc-sheet-rows label small { display: block; font-size: 11.5px; color: var(--ledger-ink-dim); }
.cyc-sheet input[type="number"] { width: 100%; box-sizing: border-box; padding: 4px 6px; border: 0; border-bottom: 1.5px solid var(--ledger-ink); background: rgba(255, 255, 255, 0.5); color: var(--ledger-ink); font: 600 16px/1.2 var(--font-display); text-align: right; }
.cyc-sheet input[type="number"]:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.cyc-sheet .cyc-note { margin: 4px 0 8px; font-size: 12.5px; line-height: 1.4; color: var(--ledger-ink-dim); }
.cyc-terms { margin: 0 0 10px; padding: 0; list-style: none; display: grid; gap: 2px; font-size: 13px; line-height: 1.35; }
.cyc-terms li::before { content: "· "; color: var(--ledger-ink-dim); }
.cyc-calc { margin: 0 0 10px; padding: 8px 10px; border-radius: 4px; background: rgba(35, 50, 74, 0.08); font-size: 13px; line-height: 1.45; }
.cyc-calc b { font-family: var(--font-display); }
.cyc-sheet .equip-btns { margin-top: 4px; }
.cyc-sent { margin: 8px 0 0; font: 600 13px/1.4 var(--font-display); }
/* bird in the hand (day 8 on) */
.equip--check { width: min(900px, calc(100% - 2 * var(--gutter))); }
.cyc-hand-top { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px; align-items: center; margin-bottom: 10px; }
.cyc-hand-pic { display: grid; place-items: center; width: 116px; height: 110px; border-radius: 50%; background: radial-gradient(circle, rgba(198, 139, 92, 0.5) 0 46%, transparent 47%); }
.cyc-looks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.cyc-look { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; padding: 7px 9px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); }
.cyc-look .btn--machine { justify-self: stretch; padding: 4px 10px; white-space: normal; text-align: left; line-height: 1.2; }
.cyc-look-v { min-height: 1.3em; font: 600 13.5px/1.3 var(--font-display); color: var(--lcd); }
.cyc-guide { margin-top: 8px; padding: 8px; border-radius: 6px; background: var(--sign-face); color: var(--sign-paint); font-size: 12.5px; line-height: 1.35; }
.cyc-guide-pics { display: grid; grid-template-columns: repeat(3, 38px minmax(0, 1fr)); gap: 4px 8px; align-items: center; margin-bottom: 6px; }
.cyc-guide-lines { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 2px 8px; align-items: center; }
.cyc-guide .src { grid-column: 2; margin: 0 0 4px; font-size: 10.5px; color: var(--sign-paint-dim); }
.cyc-guide svg { display: block; }
.cyc-card { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: var(--ledger-paper); color: var(--ledger-ink); font-size: 12.5px; line-height: 1.45; }
.cyc-card b { font-family: var(--font-display); letter-spacing: 0.04em; }
/* curtain, gas tank, wash bay */
.cyc-pic svg { display: block; width: 100%; height: auto; }
.cyc-gauge svg { display: block; }
.cyc-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.cyc-items .ctrl-row { padding: 6px 8px; gap: 8px; }
.cyc-items .key--wide { min-width: 0; padding: 0 10px; }
.equip--wash .equip-reads .readout { flex: 1 1 0; min-width: 0; }
/* loading bay: house plan of the eight sections, printed weight tickets */
.cyc-plan svg { display: block; width: 100%; height: auto; }
.cyc-tickets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.cyc-ticket { padding: 10px 12px; border-radius: 3px; background: repeating-linear-gradient(180deg, transparent 0 19px, rgba(35, 50, 74, 0.08) 19px 20px), #f7f3e8; color: #22262a; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); font: 500 13px/1.45 var(--font-display); }
.cyc-ticket h4 { margin: 0 0 4px; font: 700 12.5px/1.2 var(--font-display); letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 1.5px dashed #22262a; padding-bottom: 4px; }
.cyc-ticket dl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 10px; margin: 0; }
.cyc-ticket dt { color: #4b5258; }
.cyc-ticket dd { margin: 0; text-align: right; font-weight: 700; }
.cyc-ticket .btn--machine { margin-top: 6px; }
.cyc-ticket .cyc-wait { margin: 0; color: #4b5258; }
/* dead bird bin: the birds in the bucket, the farmer's own counts */
.cyc-bucket { display: flex; flex-wrap: wrap; gap: 4px; min-height: 40px; padding: 8px; border-radius: 6px; background: #1d2023; }
.cyc-bucket svg { display: block; }
.cyc-tally { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 6px 10px; padding: 6px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); }
.cyc-tally .key { width: 34px; height: 30px; }
.cyc-tally .lcd-mini { min-width: 44px; padding: 5px 6px; font-size: 16px; }
/* weigh panel: weight spread chart */
.cyc-spread { margin-top: 10px; }
@media (max-width: 860px) {
  .cyc-split, .cyc-row2, .cyc-sheet { grid-template-columns: minmax(0, 1fr); }
  .fanbank { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cyc-lcd .lcd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .cyc-looks, .cyc-items, .cyc-tickets, .cyc-row3 { grid-template-columns: minmax(0, 1fr); }
  .cyc-guide-pics { grid-template-columns: repeat(2, 38px minmax(0, 1fr)); }
}
/* a short window (960 x 600): tighter rows so the panels fit without much scrolling */
@media (max-height: 700px) and (min-width: 700px) {
  .fan-sw { padding: 5px 8px; }
  .fan-sw .key { height: 32px; }
  .cyc-look { padding: 5px 8px; }
  .cyc-looks { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
  .cyc-hand-top { margin-bottom: 6px; }
  .cyc-sheet-rows { gap: 2px 10px; margin-bottom: 6px; }
  .cyc-sheet input[type="number"] { padding: 2px 6px; font-size: 15px; }
}
@media (prefers-reduced-motion: reduce) { .fan-vane.is-turning svg { animation: none; } }
`;

let injected = false;
/** Put the Phase 3 panel CSS into the page once (no-op without a document, e.g. in node). */
export function injectCycleStyle() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.id = 'cycle-panels-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}
