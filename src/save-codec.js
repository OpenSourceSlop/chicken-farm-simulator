// Save encoding (PHASE5.md §3.2, §3.5): a whole run as text that survives localStorage, the clipboard and a paste.
// Pure (no DOM): node tests run it as it is. Owner after the design round: package "saves" (it adds the gzip path through
// CompressionStream, 'gz64'); the text format, crc32 and the error codes are the frozen contract.
//
//   crc32(bytes | string)                 -> unsigned 32-bit CRC (IEEE), the check that a paste is whole
//   await encodePayload(obj, { gzip? })   -> { enc: 'gz64' | 'json64', crc, data } (data: base64; crc: of the encoded bytes)
//   await decodePayload({ enc, crc, data }) -> the object, or throws SaveError('damaged' | 'incomplete' | 'unknown-encoding')
//   composeText({ meta, enc, crc, data }) -> the backup text: two header lines, the marker line, the payload lines, END
//   composeParts({ meta, enc, crc, data }, maxChars?) -> [text]: one text when it fits in SAVE_SLOTS.partChars, else
//                                            numbered parts ("part 2 of 6"), each at most maxChars characters long
//   parseText(text)                       -> { v, enc, crc, chars, parts, data, header } or throws SaveError('not-a-save' |
//                                            'incomplete' | 'newer' | 'missing-parts' | 'mixed')
// The marker line: `CF5.<enc>.<crc as 8 hex digits>.<chars>.` (+ `p<k>of<n>.` on a part), then the base64 payload wrapped at
// SAVE_SLOTS.wrap characters on the lines after it, then END. The reader finds every marker anywhere in the paste (the
// header lines may be missing, the parts may come in any order) and counts the payload's characters after each one
// (whitespace and line breaks skipped): it never looks for END, so the letters E N D inside the base64 (about once in
// 262 K characters) cannot cut it short. Fewer characters than the marker says: 'incomplete'; the crc decides the rest.
import { SAVE_SLOTS } from './config.js';

/** An error a player can read: code is one of SAVE_MESSAGES' keys. */
export class SaveError extends Error {
  constructor(code, detail = '') { super(detail ? `${code}: ${detail}` : code); this.code = code; this.detail = detail; }
}
/** What the saves panel says for each code (plain words: what happened and what to do). */
export const SAVE_MESSAGES = {
  'not-a-save': 'This text is not a Chicken Farm save. Copy the whole backup, from its first line to END.',
  incomplete: 'Part of the save is missing. Copy the whole backup again, from its first line to END, and paste all of it.',
  damaged: 'This save is damaged and cannot be read.',
  newer: 'This save was made by a newer version of the game. Reload the page to get the newest version, then try again.',
  'unknown-encoding': 'This save uses a packing this version of the game does not know.',
  'missing-parts': 'Some parts of this backup are missing. A backup in parts says “part 2 of 6” on its first line: paste every part, in any order, into the box.',
  mixed: 'These parts come from different backups. Paste the parts of one backup only.',
  invalid: 'This save does not hold a farm this version can load.',
  full: 'The browser’s storage for this game is full. Delete a slot (back it up first if you want to keep it), then save again.',
  blocked: 'Saving is off in this browser (site storage is blocked or this is a private window). Back up your game as text instead.',
  'load-failed': 'This save could not be loaded. The farm you had is unchanged; the save is kept as it is.',
};

let TABLE = null;
function table() {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; }
  return TABLE;
}
const utf8 = (s) => new TextEncoder().encode(s);
export function crc32(input) {
  const b = typeof input === 'string' ? utf8(input) : input, T = table();
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export const hex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64) {
  const clean = String(b64).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) throw new SaveError('incomplete', 'base64');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(clean, 'base64'));
  const s = atob(clean), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** gzip is available (CompressionStream; Chrome 80+, Firefox 113+, Safari 16.4+, node 18+). */
export const canGzip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/**
 * Encode a JSON-safe object. Stub (design round): always 'json64' (base64 of the UTF-8 JSON); the saves package adds
 * 'gz64' (gzip, then base64) when canGzip() and opts.gzip !== false.
 * @returns {Promise<{ enc: 'gz64'|'json64', crc: string, data: string }>}
 */
export async function encodePayload(obj) {
  const bytes = utf8(JSON.stringify(obj));
  return { enc: 'json64', crc: hex8(crc32(bytes)), data: toBase64(bytes) };
}
/** @returns {Promise<any>} the object; throws SaveError. */
export async function decodePayload({ enc, crc, data }) {
  const bytes = fromBase64(data);
  if (crc != null && hex8(crc32(bytes)) !== String(crc).toLowerCase()) throw new SaveError('incomplete', 'crc');
  if (enc !== 'json64') throw new SaveError('unknown-encoding', enc);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SaveError('damaged', 'json'); }
}

/** The backup text (PHASE5.md §3.5) of one payload, or of one part of it (part: { k, n, from, to }). meta: { name, savedAt }. */
export function composeText({ meta = {}, enc, crc, data }, part = null) {
  const when = meta.savedAt ? new Date(meta.savedAt).toISOString().slice(0, 16).replace('T', ' ') : '';
  const body = part ? data.slice(part.from, part.to) : data;
  const head = `CHICKEN FARM SAVE · format ${SAVE_SLOTS.version}${part ? ` · part ${part.k} of ${part.n} (paste all ${part.n} parts, in any order)` : ''}`;
  const marker = `${SAVE_SLOTS.textMarker}.${enc}.${crc}.${data.length}.${part ? `p${part.k}of${part.n}.` : ''}`;
  const lines = body.match(new RegExp(`.{1,${SAVE_SLOTS.wrap}}`, 'g')) || [];
  return [head, `${meta.name || 'Saved farm'}${when ? ` · saved ${when}` : ''}`, marker, ...lines, 'END'].join('\n');
}
/** The parts' character ranges for n parts of a payload of `total` characters (every part but the last the same size). */
export function partRanges(total, n) {
  const size = Math.ceil(total / n), out = [];
  for (let k = 1; k <= n; k++) out.push({ k, n, from: (k - 1) * size, to: k === n ? total : k * size });
  return out;
}
/** The backup as texts of at most maxChars characters each: one text when it fits, else "part k of n" texts. */
export function composeParts(p, maxChars = SAVE_SLOTS.partChars) {
  const whole = composeText(p);
  if (whole.length <= maxChars) return [whole];
  for (let n = Math.max(2, Math.ceil(whole.length / maxChars)); n < 100000; n++) {
    const texts = partRanges(p.data.length, n).map((r) => composeText(p, r));
    if (texts.every((t) => t.length <= maxChars)) return texts;
  }
  throw new SaveError('full', 'parts');
}

const MARKER = /CF(\d+)\.([a-z0-9]+)\.([0-9a-fA-F]{8})\.(\d+)\.(?:p(\d+)of(\d+)\.)?/g;
// character classes by char code: 1 base64, 2 whitespace (a 210 K-character backup is read in a few milliseconds)
const CLS = new Uint8Array(128);
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=') CLS[c.charCodeAt(0)] = 1;
for (const c of ' \t\n\r\f\v') CLS[c.charCodeAt(0)] = 2;
const clsOf = (code) => (code < 128 ? CLS[code] : code === 0xa0 || code === 0x2028 || code === 0x2029 || code === 0xfeff ? 2 : 0);
/** Up to `want` base64 characters of s from index i on (whitespace skipped; a character outside base64 ends it). */
function takeB64(s, i, want) {
  const runs = [];
  let got = 0, start = -1;
  for (; i < s.length && got < want; i++) {
    const c = clsOf(s.charCodeAt(i));
    if (c === 1) { if (start < 0) start = i; got++; continue; }
    if (start >= 0) { runs.push(s.slice(start, i)); start = -1; }
    if (c !== 2) break;
  }
  if (start >= 0) runs.push(s.slice(start, i));
  return runs.join('');
}
/** Read a pasted backup (one text, or every part of one in any order; the header lines may be missing). Throws SaveError. */
export function parseText(text) {
  const s = String(text ?? '');
  const found = [];
  for (const m of s.matchAll(MARKER)) found.push(m);
  if (!found.length) throw new SaveError('not-a-save');
  for (const m of found) if (+m[1] > SAVE_SLOTS.version) throw new SaveError('newer', `format ${m[1]}`);
  const m0 = found[0], key = (m) => `${m[1]}.${m[2]}.${m[3].toLowerCase()}.${m[4]}.${m[6] || 1}`;
  if (found.some((m) => key(m) !== key(m0))) throw new SaveError('mixed');
  const v = +m0[1], enc = m0[2], crc = m0[3].toLowerCase(), chars = +m0[4], n = +(m0[6] || 1);
  const header = s.slice(0, m0.index).trim().split(/\n/).map((x) => x.trim()).filter(Boolean);
  const ranges = partRanges(chars, n), got = new Map();
  let short = null;
  for (const m of found) {
    const k = +(m[5] || 1);
    if (k < 1 || k > n) throw new SaveError('mixed', `part ${k} of ${n}`);
    if (got.has(k)) continue;
    const r = ranges[k - 1], want = r.to - r.from, chunk = takeB64(s, m.index + m[0].length, want);
    if (chunk.length < want) { short = short ?? k; continue; }
    got.set(k, chunk);
  }
  const missing = ranges.filter((r) => !got.has(r.k)).map((r) => r.k);
  if (missing.length) {
    if (n === 1 || (short != null && missing.length === 1 && missing[0] === short)) throw new SaveError('incomplete', n === 1 ? 'cut short' : `part ${short} cut short`);
    throw new SaveError('missing-parts', `part${missing.length > 1 ? 's' : ''} ${missing.join(', ')} of ${n}`);
  }
  return { v, enc, crc, chars, parts: n, data: ranges.map((r) => got.get(r.k)).join(''), header };
}
