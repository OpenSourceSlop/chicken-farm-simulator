// The live key names inside the game's words (fix round after Phase 5): a job title, a job's detail, a strip line, the
// Next: line and a sign fact name a farm key as a {key:<action id>} token ({key:squeeze} -> 'Q', or 'B' after Settings →
// Keys rebinds it), so the job list never tells the farmer to press a key that does nothing. No DOM here.
//
//   setKeyWords(keys)          main.js / ui.js: the keys.js object whose labels fill the tokens (null: the defaults)
//   fillKeys(text)             the text with every {key:id} token as that action's key now
//   keyWordProps(obj, props)   each named string property that holds a token becomes a getter that fills it when read
//                              (the content tables keep their shape: def.title reads 'Measure the light at bird level (L)')
//   keyWordValues(obj)         the same for every own string value of a table ({ id: text })
import { KEY_ACTIONS, codeLabel } from './keys.js';

const DEFAULT_LABEL = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, codeLabel(a.codes[0])]));
const TOKEN = /\{key:(\w+)\}/g;
let source = null;

export function setKeyWords(keys) { source = keys || null; }

export function keyLabelNow(id) {
  try { return source?.label?.(id) || DEFAULT_LABEL[id] || id; } catch { return DEFAULT_LABEL[id] || id; }
}

export function fillKeys(text) {
  if (typeof text !== 'string' || text.indexOf('{key:') < 0) return text;
  return text.replace(TOKEN, (_, id) => keyLabelNow(id));
}

function wrap(obj, p) {
  const d = Object.getOwnPropertyDescriptor(obj, p);
  if (!d || !('value' in d) || typeof d.value !== 'string' || d.value.indexOf('{key:') < 0) return;
  let raw = d.value;
  Object.defineProperty(obj, p, { get: () => fillKeys(raw), set: (v) => { raw = v; }, enumerable: true, configurable: true });
}

export function keyWordProps(obj, props) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const p of props) wrap(obj, p);
  return obj;
}

export function keyWordValues(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const p of Object.keys(obj)) wrap(obj, p);
  return obj;
}
