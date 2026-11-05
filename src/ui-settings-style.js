// The settings screen's own rules (PHASE5.md §8.11: #settings-style from ui-settings.js, the .set-* classes; the frame —
// .panel, .settings-case, .settings-head, the close key — is the template's). Owner: package "settings".
export const SETTINGS_CSS = `
.set-tabs { display: flex; gap: 4px; margin: 2px 0 0; border-bottom: 1px solid var(--panel-edge); }
.set-tab { flex: 1 1 0; min-width: 0; min-height: 34px; padding: 8px 6px; border: 0; border-radius: 6px 6px 0 0; background: rgba(255, 255, 255, 0.04);
  color: var(--ink-dim); font: 600 12px/1 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.set-tab:hover { color: var(--ink); background: rgba(255, 255, 255, 0.08); }
.set-tab[aria-selected="true"] { color: var(--ink); background: var(--panel-raised); box-shadow: inset 0 -3px 0 var(--accent); }
.set-sec { display: grid; gap: 10px; padding: 12px 2px 2px; }
.set-sec[hidden] { display: none; }
.set-words { margin: 0; color: var(--ink-dim); font-size: 13px; line-height: 1.45; }
.set-list { display: grid; gap: 6px; }
.set-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 34px; padding: 4px 10px; border-radius: 6px;
  background: var(--panel-sunk); color: var(--ink); font-size: 14px; line-height: 1.3; }
.set-row label { min-width: 0; }
.set-row--range { grid-template-columns: minmax(0, 1fr) 200px 52px; }
.set-row--bool { grid-template-columns: auto minmax(0, 1fr); }
.set-row .set-note { grid-column: 1 / -1; margin-top: -4px; color: var(--ink-dim); font-size: 12px; line-height: 1.35; }
.set-row .set-note[hidden] { display: none; }
.set-row--bool label { cursor: pointer; }
.set-row select { max-width: 360px; min-height: 30px; padding: 4px 8px; border-radius: 5px; border: 1px solid var(--panel-edge); background: var(--panel-raised);
  color: var(--ink); font: 14px/1.2 var(--font-body); }
.set-row input[type=range] { width: 100%; margin: 0; accent-color: var(--accent); }
.set-row input[type=checkbox] { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.set-out { font: 600 13px/1 var(--font-display); text-align: right; color: var(--ink); white-space: nowrap; }
.set-gov { margin: 0; color: var(--ink-faint); font-size: 12.5px; line-height: 1.4; }
.set-foot { display: flex; justify-content: flex-end; padding-top: 2px; }
.set-keys { display: grid; gap: 8px; }
.set-keys-status { min-height: 18px; margin: 0; color: var(--ink); font-size: 13px; line-height: 1.4; }
.set-keys-list { display: grid; gap: 10px; max-height: max(180px, calc(100vh - 320px)); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding-right: 6px; }
.set-keys-group { display: grid; gap: 3px; }
.set-keys-head { margin: 0 0 2px; }
.set-keys-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 96px; gap: 10px; align-items: center; min-height: 32px; padding: 2px 6px 2px 10px;
  border-radius: 5px; background: var(--panel-sunk); color: var(--ink); font-size: 13px; line-height: 1.3; }
.set-keys-row.is-waiting { box-shadow: inset 0 0 0 2px var(--accent); }
.set-keys-keys { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.set-keys-keys .kbd { height: 24px; min-width: 24px; font-size: 12px; }
.set-keys-change { min-height: 28px; padding: 4px 10px; }
.set-keys-row.is-waiting .set-keys-change { color: var(--accent); border-color: var(--accent); }
.set-keys-fixed { color: var(--ink-faint); font: 600 12px/1.2 var(--font-display); letter-spacing: 0.04em; text-align: center; }
.set-fps { min-width: 46px; padding: 0 4px 0 6px; color: var(--ink-dim); font: 600 12px/1 var(--font-display); letter-spacing: 0.03em; white-space: nowrap; text-align: right; }
@media (max-width: 860px) {
  .set-row--range { grid-template-columns: minmax(0, 1fr) 120px 48px; }
  .set-tab { font-size: 11px; letter-spacing: 0.04em; }
}
@media (max-width: 700px) {
  .set-tabs { flex-wrap: wrap; border-bottom: 0; }
  .set-tab { flex: 1 1 30%; border-radius: 6px; min-height: 44px; }
  .set-row, .set-row--range { grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 8px 10px; }
  .set-row--bool { grid-template-columns: auto minmax(0, 1fr); }
.set-row .set-note { grid-column: 1 / -1; margin-top: -4px; color: var(--ink-dim); font-size: 12px; line-height: 1.35; }
.set-row .set-note[hidden] { display: none; }
  .set-row select { max-width: 100%; min-height: 44px; }
  .set-keys-row { grid-template-columns: minmax(0, 1fr) auto; }
  .set-keys-row > :last-child { grid-column: 1 / -1; justify-self: end; }
  .set-keys-list { max-height: none; }
}
`;
