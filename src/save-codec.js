// Save encoding (PHASE5.md §3.2, §3.5): a whole run as text that survives localStorage, the clipboard and a paste.
// Pure (no DOM): node tests run it as it is. Owner after the design round: package "saves" (it adds the gzip path through
// CompressionStream, 'gz64'); the text format, crc32 and the error codes are the frozen contract.
//
//   crc32(bytes | string)                 -> unsigned 32-bit CRC (IEEE), the check that a paste is whole
//   await encodePayload(obj, { gzip? })   -> { enc: 'gz64' | 'json64', crc, data } (data: base64; crc: of the encoded bytes)
//   await decodePayload({ enc, crc, data }) -> the object, or throws SaveError('damaged' | 'incomplete' | 'unknown-encoding')
//   composeText({ meta, enc, crc, data }) -> the backup text: two header lines, the payload line(s), END
//   parseText(text)                       -> { v, enc, crc, data, header } or throws SaveError('not-a-save' | 'incomplete' | 'newer')
// A backup's payload line: `CF5.<enc>.<crc as 8 hex digits>.<base64>` (wrapped at SAVE_SLOTS.wrap characters; whitespace
// inside it is ignored when it is pasted back).
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

/** The backup text (PHASE5.md §3.5). meta: { name, savedAt } (the header lines are for the player; parseText skips them). */
export function composeText({ meta = {}, enc, crc, data }) {
  const when = meta.savedAt ? new Date(meta.savedAt).toISOString().slice(0, 16).replace('T', ' ') : '';
  const line = `${SAVE_SLOTS.textMarker}.${enc}.${crc}.${data}`;
  const wrapped = line.match(new RegExp(`.{1,${SAVE_SLOTS.wrap}}`, 'g')) || [line];
  return [`CHICKEN FARM SAVE · format ${SAVE_SLOTS.version}`, `${meta.name || 'Saved farm'}${when ? ` · saved ${when}` : ''}`, ...wrapped, 'END'].join('\n');
}
/** Read a pasted backup (or a slot's stored text). Throws SaveError. */
export function parseText(text) {
  const s = String(text ?? '');
  const m = /CF(\d+)\.([a-z0-9]+)\.([0-9a-fA-F]{8})\.([A-Za-z0-9+/=\s]*)/.exec(s);
  if (!m) throw new SaveError('not-a-save');
  const v = +m[1];
  if (v > SAVE_SLOTS.version) throw new SaveError('newer', `format ${v}`);
  // the payload's letters run on into the END line: cut it off (no END at all: the paste stopped short)
  if (!/(^|\s)END\s*$/.test(s.slice(m.index).trimEnd() + '\n') && !/\nEND\b/.test(s.slice(m.index))) throw new SaveError('incomplete', 'no END line');
  const body = m[4].replace(/\s*END[\s\S]*$/, '');
  const header = s.slice(0, m.index).trim().split(/\n/).map((x) => x.trim()).filter(Boolean);
  return { v, enc: m[2], crc: m[3].toLowerCase(), data: body.replace(/\s+/g, ''), header };
}
