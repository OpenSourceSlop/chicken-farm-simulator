// Key bindings (PHASE5.md §4.3): every game key in one table, matched by physical key (KeyboardEvent.code, so WASD works
// with a Thai layout), rebindable in the settings menu (settings 'keys.bindings': { [action id]: code }). No DOM here.
// The defaults are exactly the Phase 1-4 keys. Owner after the design round: package "settings" (table, rebind rules,
// the Keys tab); each package moves its own key checks onto matches() (ui.js: experience; player-input.js: settings;
// audio.js: sound), PHASE5.md §8.4.
//
//   const keys = createKeys(settings)
//   keys.matches(e, 'squeeze')     the event is this action's key (no modifier other than the action's own)
//   keys.actionOf(e, ids?)         the action id this key press is (of `ids`, default all), or null
//   keys.codes('use') / label('use') / labels('zoomIn')    ['KeyE'] / 'E' / ['+', 'Wheel']
//   keys.rows('level' | 'sandbox') the controls legend and the guide: [{ id, keys: [labels], what }]
//   keys.rebind('squeeze', 'KeyB') { ok, swapped?: 'otherId', reason? } (a key another action uses swaps with it)
//   keys.reset(id?)                defaults again
//   keys.subscribe(fn)             a binding changed

/** group: 'move' | 'farm' | 'views' | 'game'. fixed: not rebindable. extra: shown in the legend, never a code (Wheel). */
export const KEY_ACTIONS = [
  { id: 'forward', group: 'move', codes: ['KeyW'], what: 'Walk forward' },
  { id: 'back', group: 'move', codes: ['KeyS'], what: 'Walk back' },
  { id: 'left', group: 'move', codes: ['KeyA'], what: 'Walk left' },
  { id: 'right', group: 'move', codes: ['KeyD'], what: 'Walk right' },
  { id: 'run', group: 'move', codes: ['ShiftLeft', 'ShiftRight'], what: 'Run (hold)', fixed: true },
  { id: 'turnLeft', group: 'move', codes: ['ArrowLeft'], what: 'Turn the view left (or right-drag)' },
  { id: 'turnRight', group: 'move', codes: ['ArrowRight'], what: 'Turn the view right' },
  { id: 'zoomIn', group: 'move', codes: ['Equal', 'NumpadAdd'], what: 'Zoom in (or the wheel)', extra: ['Wheel'] },
  { id: 'zoomOut', group: 'move', codes: ['Minus', 'NumpadSubtract'], what: 'Zoom out' },
  { id: 'use', group: 'farm', codes: ['KeyE'], what: 'Use, pick up, read a sign' },
  { id: 'useDead', group: 'farm', codes: ['KeyE'], shift: true, what: 'Pick up a dead bird while a job with chicks is open', fixed: true, follows: 'use' },
  { id: 'bucket', group: 'farm', codes: ['KeyG'], what: 'Set the dead-bird bucket down (E picks it up again)' },
  { id: 'squeeze', group: 'farm', codes: ['KeyQ'], what: 'Squeeze a handful of litter' },
  { id: 'probe', group: 'farm', codes: ['KeyT'], what: 'Floor thermometer at your feet' },
  { id: 'lux', group: 'farm', codes: ['KeyL'], what: 'Light meter: lux at bird height' },
  { id: 'air', group: 'farm', codes: ['KeyV'], what: 'Air meter: air speed, °C and humidity at bird height' },
  { id: 'notebook', group: 'views', codes: ['KeyN'], what: 'Notebook: your readings' },
  { id: 'skills', group: 'views', codes: ['KeyK'], what: 'Skill tree' },
  { id: 'floorView', group: 'views', codes: ['KeyF'], what: 'Floor temperature view (once unlocked)' },
  { id: 'comfortView', group: 'views', codes: ['KeyC'], what: 'Comfort view of the flock (once unlocked)' },
  { id: 'moistureView', group: 'views', codes: ['KeyM'], what: 'Litter moisture view (once unlocked)' },
  { id: 'map', group: 'views', codes: ['Tab'], what: 'Farm map (from the farm view)' },
  { id: 'help', group: 'game', codes: ['KeyH'], what: 'Show or hide the controls legend', alsoKeys: ['?'] },
  { id: 'sound', group: 'game', codes: ['KeyU'], what: 'Sound on or off' },
  { id: 'menu', group: 'game', codes: ['Escape'], what: 'Close a panel; with none open, the game menu', fixed: true },
];
const BY_ID = new Map(KEY_ACTIONS.map((a) => [a.id, a]));
/** Codes no action may take (the browser's own keys, modifiers). */
export const RESERVED_CODES = new Set(['Escape', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
  'CapsLock', 'ContextMenu', 'F5', 'F11', 'F12', 'PrintScreen']);
/** The actions of each mode's legend (the sandbox keeps Phase 1's short list). */
const MODE_IDS = {
  sandbox: ['forward', 'run', 'turnLeft', 'zoomIn', 'use', 'map', 'help', 'sound', 'menu'],
};

const NAMED = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Equal: '+', NumpadAdd: '+', Minus: '−', NumpadSubtract: '−',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc', Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', Slash: '/',
  Backslash: '\\', Comma: ',', Period: '.', Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backquote: '`' };
/** 'KeyQ' -> 'Q', 'Digit3' -> '3', 'ArrowLeft' -> '←', 'Numpad4' -> 'Num 4'. */
export function codeLabel(code) {
  if (!code) return '';
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}
/** The letter a code types on a US layout ('KeyQ' -> 'q'): the fallback for keyboards that send no code. */
const letterOf = (code) => (/^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : null);

export function createKeys(settings = null) {
  const subs = [];
  const over = () => { try { return settings?.get?.('keys.bindings') || {}; } catch { return {}; } };
  const codes = (id) => {
    const a = BY_ID.get(id);
    if (!a) return [];
    if (a.follows) return codes(a.follows);
    const o = over()[id];
    return o && !a.fixed ? [o] : [...a.codes];
  };
  function matches(e, id) {
    const a = BY_ID.get(id);
    if (!a || !e) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (a.shift != null && !!e.shiftKey !== a.shift) return false;
    const cs = codes(id);
    if (e.code) return cs.includes(e.code) || (a.alsoKeys || []).includes(e.key);
    const k = (e.key || '').toLowerCase();
    return cs.some((c) => letterOf(c) === k) || (a.alsoKeys || []).includes(e.key);
  }
  function rebind(id, code) {
    const a = BY_ID.get(id);
    if (!a) return { ok: false, reason: 'unknown' };
    if (a.fixed) return { ok: false, reason: 'fixed' };
    if (!code || RESERVED_CODES.has(code)) return { ok: false, reason: 'reserved' };
    const o = { ...over() };
    const other = KEY_ACTIONS.find((b) => b.id !== id && !b.fixed && !b.follows && codes(b.id).includes(code));
    let swapped = null;
    if (other) { const mine = codes(id)[0]; o[other.id] = mine; swapped = other.id; }
    o[id] = code;
    // a binding back to the default is no override
    for (const [k, c] of Object.entries(o)) if (BY_ID.get(k)?.codes[0] === c && BY_ID.get(k).codes.length === 1) delete o[k];
    settings?.set?.('keys.bindings', o);
    for (const fn of subs.slice()) { try { fn({ id, code, swapped }); } catch { /* listener */ } }
    return { ok: true, swapped };
  }
  return {
    actions: KEY_ACTIONS,
    codes,
    matches,
    actionOf(e, ids = null) {
      for (const a of KEY_ACTIONS) if ((!ids || ids.includes(a.id)) && matches(e, a.id)) return a.id;
      return null;
    },
    label: (id) => codeLabel(codes(id)[0]),
    labels: (id) => { const a = BY_ID.get(id); const ls = [...new Set(codes(id).map(codeLabel))]; return a?.shift ? ['Shift', ...ls] : [...ls, ...(a?.extra || [])]; },
    rows(mode = 'level') {
      const ids = MODE_IDS[mode] || KEY_ACTIONS.map((a) => a.id);
      return ids.map((id) => BY_ID.get(id)).filter(Boolean).map((a) => ({ id: a.id, keys: this.labels(a.id), what: a.what }));
    },
    rebind,
    reset(id = null) {
      if (!settings) return;
      if (!id) settings.set('keys.bindings', {});
      else { const o = { ...over() }; delete o[id]; settings.set('keys.bindings', o); }
      for (const fn of subs.slice()) { try { fn({ id, reset: true }); } catch { /* listener */ } }
    },
    subscribe(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
  };
}
