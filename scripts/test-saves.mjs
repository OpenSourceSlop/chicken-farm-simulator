// Save slots, Continue, backups, migrations (PHASE5.md §3, §10.2) in node: the real sim, farm, records, skills, level.js,
// run.js and saves.js with a fake localStorage (as test-run plays the run). Owner: package "saves".
//   node scripts/test-saves.mjs            (added to npm test at the merge)
//   ONLY=<part of a name> node scripts/test-saves.mjs
import { makeWorld } from '../src/farm-profiles-run.js';
import { createLevel } from '../src/level.js';
import { createRun } from '../src/run.js';
import { createSaves } from '../src/saves.js';
import { createSaveStore } from '../src/save.js';
import { LEVELS, RUN_SAVE, SAVE_SLOTS, SAVE } from '../src/config.js';
import { EV } from '../src/events.js';
import { encodePayload, decodePayload, parseText, composeText, SAVE_MESSAGES } from '../src/save-codec.js';
import { makeEnvelope, mergeProfiles, migrate, metaOf } from '../src/save-slots.js';

let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const H = 1 / 24;
const KB = 1024;
const VERDICT = /correct|wrong|well done|good job|great job|mistake|perfect|excellent|match(es)? the/i;

// ---------------- a fake localStorage (a quota in characters: a write over `limit` throws) ----------------
function memStorage({ limit = Infinity, init = {} } = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { const s = String(v); if (s.length > limit) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } m.set(k, s); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    map: m,
  };
}
const throwing = { get length() { throw new Error('blocked'); }, key() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
const useStorage = (s) => { if (s) globalThis.localStorage = s; else delete globalThis.localStorage; return s; };

/** A game as main.js wires it, without the 3D: the real level, run, save store and saves on the fake storage. */
function makeGame() {
  const w = makeWorld();
  const pos = { x: 0, z: 0 };
  const player = { position: pos, yaw: 0, isInside: false, teleport(x, z, yaw) { pos.x = x; pos.z = z; this.yaw = yaw ?? 0; } };
  const title = { text: null, refreshed: 0, note(t) { this.text = t || null; }, refresh() { this.refreshed++; } };
  const ui = { panelKind: null, shown: null, title, setMode(m) { this.mode = m; }, closePanel() {}, showResult(r) { this.shown = r; }, jobCard: { refresh() {}, reset() {} }, newRun() {} };
  const props = { carrying: null, reset() {}, serialize: () => ({}), restore() {}, drop() {} };
  const flock = { resetLevel() {}, serialize: () => ({}), restore() {}, afterSkip() {} };
  const save = createSaveStore();
  const level = createLevel({ env: w.env }, { ...w, save, player, flock, props, ui });
  const run = createRun({ level, save, events: w.events, farm: w.farm, env: w.env, records: w.records });
  const saves = createSaves({ run, level, save, events: w.events, ui });
  const said = [];
  w.events.on(EV.SAVE, (p) => said.push(p));
  return { ...w, level, run, saves, save, ui, title, said };
}
const at = (G, d, h) => Math.abs(G.env.day - (d + h * H)) < 1e-6;
const where = (G) => `day ${G.env.dayNumber} ${G.env.timeLabel} ${G.level.def.id} (${G.level.mode})`;
function playLevel(G, profile = 'ideal') {
  const def = G.level.def;
  G.level.debug.goto(def.endDay, 21, { auto: true, profile });
  if (!G.level.result) G.level.debug.goto(def.endDay + 1, 6.05);
  G.level.update(1);
  assert(G.level.result, `${def.id} did not end: ${where(G)}`);
  return G.level.result;
}
/** The first path where two JSON values differ, or null. */
function firstDiff(a, b, p = '') {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], `${p}.${k}`); if (d) return d; }
    return null;
  }
  return a === b || (Number.isNaN(a) && Number.isNaN(b)) ? null : `${p}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`;
}
const runKeys = (S) => Object.fromEntries([...S.map].filter(([k]) => k === RUN_SAVE.key || k.startsWith(RUN_SAVE.startPrefix)));
const codeOf = async (G, text) => { const r = await G.saves.previewText(text); return r.ok ? 'ok' : r.code; };
const kb = (n) => `${(n / KB).toFixed(0)} KB`;

// the day-67 run of the ideal (seed 1), played once and kept in its own storage for the size and backup cases
let full = null;
function fullRun() {
  if (full) return full;
  const S = useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1 });
  for (const def of LEVELS) { const r = playLevel(G); assert(r.pass, `${def.id}: ${r.failText}`); if (def.id !== 'cleanout') assert(G.run.next(), `next after ${def.id}`); }
  full = { G, S };
  return full;
}
const measured = {};

test('the day-67 run in a slot: gz64 <= 300 KB, json64 (no CompressionStream) <= 1.2 MB, its backup text <= 300 K characters; decode(encode(x)) identical for both', async () => {
  const { G, S } = fullRun();
  useStorage(S);
  assert(at(G, 67, 6) || G.env.dayNumber >= 66, `the end of the rest: ${where(G)}`);
  const a = await G.saves.saveSlot(1);
  assert(a.ok, `slot 1: ${a.message}`);
  const gz = G.saves.debug.slotChars(1);
  const CS = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  let js;
  try { const b = await G.saves.saveSlot(2); assert(b.ok, `slot 2 (json64): ${b.message}`); js = G.saves.debug.slotChars(2); }
  finally { globalThis.CompressionStream = CS; }
  assert(JSON.parse(S.getItem(`${SAVE_SLOTS.keyPrefix}1`)).enc === 'gz64' && JSON.parse(S.getItem(`${SAVE_SLOTS.keyPrefix}2`)).enc === 'json64', 'the two packings');
  const whole = await G.saves.exportText(1), farm = await G.saves.exportText(1, { farmOnly: true });
  Object.assign(measured, { gz, js, whole: whole.chars, wholeParts: whole.parts.length, farm: farm.chars, farmParts: farm.parts.length, starts: whole.starts });
  console.log(`     slot gz64 ${kb(gz)}, json64 ${kb(js)}; backup: the whole run ${whole.chars.toLocaleString('en')} characters in ${whole.parts.length} parts (${whole.starts} level starts), the farm only ${farm.chars.toLocaleString('en')} in ${farm.parts.length} parts (${(100 * farm.chars / whole.chars).toFixed(1)} %)`);
  assert(gz <= 300 * KB, `gz64 slot ${kb(gz)}`);
  assert(js <= 1.2 * KB * KB, `json64 slot ${kb(js)}`);
  assert(whole.chars <= 300000 && whole.parts.every((p) => p.length <= SAVE_SLOTS.partChars), `the whole run's backup ${whole.chars} characters`);
  assert(farm.chars <= 0.3 * whole.chars, `the farm only ${farm.chars} of ${whole.chars}`);
  // decode(encode(x)) for both packings
  const env = makeEnvelope({ ...G.run.exportSave() });
  for (const gzip of [true, false]) {
    const p = await encodePayload(env, { gzip });
    assert(p.enc === (gzip ? 'gz64' : 'json64'), `packing ${p.enc}`);
    const d = firstDiff(await decodePayload(p), JSON.parse(JSON.stringify(env)));
    assert(!d, `${p.enc}: ${d}`);
  }
});

test('error codes: one flipped payload character and a text cut 40 characters short read incomplete; CF6 newer; hello not a save; every message neutral', async () => {
  const { G, S } = fullRun();
  useStorage(S);
  const env = makeEnvelope({ ...G.run.exportSave(), starts: [] });
  const p = await encodePayload(env), text = composeText({ meta: { ...env.meta, savedAt: env.savedAt }, ...p });
  assert(await codeOf(G, text) === 'ok', 'the whole text reads');
  const lines = text.split('\n'), li = 5, ch = lines[li][10];
  lines[li] = lines[li].slice(0, 10) + (ch === 'A' ? 'B' : 'A') + lines[li].slice(11);
  assert(await codeOf(G, lines.join('\n')) === 'incomplete', 'a flipped payload character');
  assert(await codeOf(G, text.slice(0, -40)) === 'incomplete', 'cut 40 characters short');
  assert(await codeOf(G, text.replace('CF5.', 'CF6.')) === 'newer', 'CF6');
  assert(await codeOf(G, 'hello') === 'not-a-save', 'hello');
  for (const m of Object.values(SAVE_MESSAGES)) assert(!VERDICT.test(m), `a verdict word: ${m}`);
});

test('names exactly: entering week 2 "Normal season · Level 3 – Week 2 · Day 8, 06:00"; a hot run at day 30 14:20 "Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20"', async () => {
  useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  G.level.debug.goto(7, 21, { auto: true });
  assert(G.level.result?.pass && G.run.next() && at(G, 8, 6), `into week 2: ${where(G)}`);
  assert((await G.saves.saveSlot(1)).ok, 'slot 1');
  const n1 = G.saves.list()[1].meta.name;
  useStorage(memStorage());
  const Hh = makeGame();
  Hh.run.startRun({ seed: 1, at: 'level1', condition: 'hot' });
  assert(Hh.run.startLevel('weeks45', { from: 'standard', condition: 'hot' }), 'hot weeks 4-5');
  Hh.level.debug.goto(30, 14 + 20 / 60, { auto: true });
  assert((await Hh.saves.saveSlot(2)).ok, 'slot 2');
  const n2 = Hh.saves.list()[2].meta.name;
  console.log(`     "${n1}" · "${n2}"`);
  assert(n1 === 'Normal season · Level 3 – Week 2 · Day 8, 06:00', n1);
  assert(n2 === 'Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20', n2);
});

test('load a slot over a run in play at weeks 4-5: the saved run back (state, level, day, hour, every start), no start of the replaced run, the run key newer than every slot; Replay Week 2 restores day 8 06:00; delete empties', async () => {
  const S = useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  G.level.debug.goto(7, 21, { auto: true });
  G.run.next();
  G.level.debug.goto(9, 10, { auto: true });
  assert((await G.saves.saveSlot(1)).ok, 'slot 1: week 2, day 9');
  const st = G.run.state(), saved = { levels: st.levels, plan: st.plan, condition: st.condition, startedAt: st.startedAt }, d0 = G.env.day, h0 = G.env.hour;
  const starts = Object.entries(st.levels).flatMap(([id, e]) => e.starts.map((d) => [id, d]));
  // the run in play goes on to weeks 4-5, day 29 (a start of its own there), then slot 1 is loaded over it
  G.level.debug.goto(14, 21, { auto: true }); G.run.next();
  playLevel(G); G.run.next();
  G.level.debug.goto(29, 9, { auto: true });
  assert(G.level.def.id === 'weeks45' && G.run.hasStart('weeks45', 29) && G.run.hasStart('week3', 15), `the run in play at weeks 4-5 with its starts: ${where(G)}`);
  await new Promise((r) => setTimeout(r, 3));
  const r = await G.saves.loadSlot(1);
  assert(r.ok, `load: ${r.message}`);
  const now = G.run.state();
  const diff = firstDiff({ levels: now.levels, plan: now.plan, condition: now.condition, startedAt: now.startedAt }, saved);
  assert(!diff, `the run state as saved: ${diff}`);
  assert(G.level.def.id === 'week2' && Math.abs(G.env.day - d0) < 1e-6 && Math.abs(G.env.hour - h0) < 1e-6 && G.level.mode === 'level', `the level, day and hour: ${where(G)}`);
  for (const [id, d] of starts) assert(G.run.hasStart(id, d), `start ${id} ${d} back`);
  assert(!G.run.hasStart('weeks45', 29) && !G.run.hasStart('weeks45', 22) && !G.run.hasStart('week3', 15), 'no start of the replaced run answers (the def.starts fallback included)');
  const info = G.run.store.info(), want = new Set(starts.map(([id]) => id));
  assert(Object.keys(info.starts).every((id) => want.has(id)) && !info.starts.weeks45 && !info.starts.week3, `store.info().starts only the loaded run's: ${JSON.stringify(info.starts)}`);
  const autoAt = JSON.parse(S.getItem(RUN_SAVE.key)).savedAt;
  assert(G.saves.list().filter((e) => e.slot !== 'auto' && !e.empty).every((e) => autoAt > e.savedAt) && G.saves.latest().slot === 'auto', 'the run key newer than every slot: Continue resumes the loaded farm');
  assert(G.run.replay('week2', { day: 8 }) && at(G, 8, 6) && G.level.def.id === 'week2', `Replay Week 2: ${where(G)}`);
  assert(G.saves.deleteSlot(1).ok && G.saves.list()[1].empty, 'deleted: empty');
  console.log(`     loaded week 2 day 9 over weeks 4-5 day 29: ${starts.length} starts back, store starts ${JSON.stringify(info.starts)}`);
});

test('a storage that throws over 400 K characters: full, the old slot unchanged; a blocked storage: available false, rows blocked, the backup of the game in play still works and plays from memory', async () => {
  const S = useStorage(memStorage({ limit: 400000 }));
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  assert(G.run.startLevel('weeks45', { from: 'standard' }), 'weeks 4-5');
  assert((await G.saves.saveSlot(1)).ok, 'a gz64 slot fits');
  const old = S.getItem(`${SAVE_SLOTS.keyPrefix}1`);
  const CS = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  let r;
  try { r = await G.saves.saveSlot(1); } finally { globalThis.CompressionStream = CS; }
  assert(!r.ok && r.code === 'full' && r.message === SAVE_MESSAGES.full, `a json64 slot over the quota: ${JSON.stringify(r)}`);
  assert(S.getItem(`${SAVE_SLOTS.keyPrefix}1`) === old, 'the old slot kept as it was');
  // blocked
  useStorage(throwing);
  const B = makeGame();
  B.run.startRun({ seed: 1, at: 'level1' });
  B.level.debug.goto(2, 10, { auto: true });
  const rows = B.saves.list();
  assert(B.saves.available === false && rows.slice(1).every((x) => x.error === 'blocked' && x.message === SAVE_MESSAGES.blocked), `rows blocked: ${JSON.stringify(rows.map((x) => x.error))}`);
  assert(!(await B.saves.saveSlot(1)).ok, 'no slot is written');
  const bk = await B.saves.exportText('auto');
  assert(bk.ok && /CF5\.gz64\./.test(bk.text), `the backup of the game in play: ${bk.message}`);
  const P = makeGame();
  const pr = await P.saves.importText(bk.text, 'play');
  assert(pr.ok && pr.memoryOnly && P.level.mode === 'level' && P.level.def.id === 'level1' && P.env.dayNumber === 2, `played from memory: ${pr.message} ${where(P)}`);
  assert(P.run.hasStart('level1', -1), 'its start from memory');
  useStorage(memStorage());
});

test('the autosave older than slot 2: continueLatest() loads slot 2; a slot of garbage JSON and one with a wrong crc: their codes, loadSlot refused, the other slot fine; the autosave key of garbage: its row damaged, Continue takes the newest slot', async () => {
  const S = useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  G.level.debug.goto(7, 21, { auto: true }); G.run.next();
  assert((await G.saves.saveSlot(2)).ok, 'slot 2: day 8');
  G.level.debug.goto(10, 9, { auto: true });
  G.level.toTitle();
  // the autosave (day 10) made older than slot 2 (day 8)
  const rk = JSON.parse(S.getItem(RUN_SAVE.key)), s2 = JSON.parse(S.getItem(`${SAVE_SLOTS.keyPrefix}2`));
  rk.savedAt = s2.savedAt - 60000; S.setItem(RUN_SAVE.key, JSON.stringify(rk));
  const C = makeGame();
  assert(C.saves.latest().slot === 2 && C.saves.latestInfo().short.startsWith('Slot 2: '), `the newest is slot 2: ${JSON.stringify(C.saves.latestInfo())}`);
  assert(await C.saves.continueLatest() === true && C.level.def.id === 'week2' && at(C, 8, 6), `Continue loads slot 2: ${where(C)}`);
  // garbage and a wrong crc
  S.setItem(`${SAVE_SLOTS.keyPrefix}1`, '{garbage');
  const bad = JSON.parse(S.getItem(`${SAVE_SLOTS.keyPrefix}2`)); bad.crc = bad.crc === '00000000' ? '11111111' : '00000000';
  S.setItem(`${SAVE_SLOTS.keyPrefix}3`, JSON.stringify(bad));
  const rows = C.saves.list();
  assert(rows[1].error === 'damaged' && rows[3].error === 'incomplete' && !rows[2].error && rows[2].meta?.name, `row codes: ${rows.map((x) => x.error || 'ok').join(' ')}`);
  const l1 = await C.saves.loadSlot(1), l3 = await C.saves.loadSlot(3);
  assert(!l1.ok && l1.code === 'damaged' && !l3.ok && l3.code === 'incomplete', `refused: ${l1.code} ${l3.code}`);
  assert((await C.saves.loadSlot(2)).ok, 'slot 2 still loads');
  // the autosave key of garbage
  S.setItem(RUN_SAVE.key, 'not json at all');
  const D = makeGame();
  const auto = D.saves.list()[0];
  assert(auto.error === 'damaged' && auto.message === SAVE_MESSAGES.damaged, `the autosave row: ${JSON.stringify(auto)}`);
  const li = D.saves.latestInfo();
  assert(li && li.slot === 2 && D.title.text === SAVE_MESSAGES['auto-unreadable'], `Continue takes slot 2, the title says why: ${JSON.stringify(li)} / ${D.title.text}`);
  assert(D.saves.continueAuto() === false && await D.saves.continueLatest() === true && D.level.def.id === 'week2', 'the autosave itself does not continue; the newest slot does');
});

test('fix round: a slot naming a level this build does not know reads invalid (Continue skips it, a load says why); a row is kept while its text is the same; a slot saved on a result reads level ended', async () => {
  const S = useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  G.level.debug.goto(2, 9, { auto: true });
  assert((await G.saves.saveSlot(1)).ok && (await G.saves.saveSlot(2)).ok, 'slots 1 and 2');
  // slot 1 from a later build that adds a level: its stored form passes every check, its meta names level99
  const st = JSON.parse(S.getItem(`${SAVE_SLOTS.keyPrefix}1`)); st.meta = { ...st.meta, levelId: 'level99', levelShort: 'A new level' }; st.savedAt += 1e6;
  S.setItem(`${SAVE_SLOTS.keyPrefix}1`, JSON.stringify(st));
  const C = makeGame();
  const rows = C.saves.list();
  assert(rows[1].error === 'invalid' && rows[1].message === SAVE_MESSAGES.invalid && !rows[2].error, `rows: ${rows.map((x) => x.error || 'ok').join(' ')}`);
  assert(C.saves.latest()?.slot !== 1, `Continue skips the unknown level: ${C.saves.latest()?.slot}`);
  const t0 = Date.now(); for (let i = 0; i < 50; i++) C.saves.list(); const ms = (Date.now() - t0) / 50;
  console.log(`     a list redraw with the rows kept: ${ms.toFixed(2)} ms`);
  // a slot saved on a failed result
  G.level.debug.goto(7, 21, { auto: true, profile: 'cold' });
  if (!G.level.result) G.level.debug.goto(8, 6.05);
  G.level.update(1);
  if (G.level.mode === 'result') {
    const r3 = await G.saves.saveSlot(3);
    assert(r3.ok && /· level ended$/.test(r3.meta.name), `a slot on a result: ${r3.meta?.name}`);
  }
});

test('raw JSON pastes: a v3 run key and a v1 Phase 2 save (a run at the brooding week); a v1 envelope through migrate; a Phase 3 blob (no farm.cond, env.powerOn, env.targetShift) loads and plays a day', async () => {
  const S = useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  G.level.debug.goto(3, 9, { auto: true });
  const rawV3 = S.getItem(RUN_SAVE.key);
  // the Phase 2 lone brooding week (its own key, chickenFarm.level1.v1)
  const P2 = makeGame();
  P2.level.start({ seed: 1 });
  P2.level.debug.goto(2, 10, { auto: true });
  const rawV1 = S.getItem(SAVE.key);
  assert(rawV1 && JSON.parse(rawV1).version === 1 && !P2.level.inRun, 'a Phase 2 save');
  useStorage(memStorage());
  const A = makeGame();
  const r3 = await A.saves.importText(rawV3, 1);
  assert(r3.ok && r3.from === 3 && r3.migrated, `a raw v3 paste into slot 1: ${r3.message}`);
  const v3day = JSON.parse(rawV3).blob.env.day;
  assert((await A.saves.loadSlot(1)).ok && A.level.def.id === 'level1' && Math.abs(A.env.day - v3day) < 1e-6 && A.level.inRun, `slot 1 plays: ${where(A)}`);
  const r1 = await A.saves.importText(rawV1, 'play');
  const v1day = JSON.parse(rawV1).env.day;
  assert(r1.ok && A.level.inRun && A.run.state().levelId === 'level1' && A.run.state().plan === null && Math.abs(A.env.day - v1day) < 1e-6, `a raw v1 paste plays as a run at the brooding week: ${r1.message} ${where(A)}`);
  A.level.debug.goto(7, 21, { auto: true });
  assert(A.level.result?.pass && A.run.next() && A.level.def.id === 'week2', 'and on into week 2');
  // a v1 envelope (migrate sets level.levelId 'level1', run null)
  const env1 = migrate(JSON.parse(rawV1));
  assert(env1.run === null && env1.blob.level.levelId === 'level1', 'migrate v1');
  const B = makeGame();
  // (as run.continueSave's Phase 2 branch since Phase 3: the brooding week's row, no saved start: a Replay starts it fresh)
  assert(B.run.importSave(env1) && B.level.inRun && B.run.state().levelId === 'level1' && B.run.state().levels.level1?.starts?.[0] === -1 && B.run.autosave()?.blob, `a v1 envelope: a run at the brooding week ${where(B)}`);
  // a Phase 3 blob: the Phase 4 fields removed (a save made before the conditions)
  const v3 = JSON.parse(rawV3);
  delete v3.blob.farm.cond; delete v3.blob.env.powerOn; delete v3.blob.env.targetShift; delete v3.blob.env.targetShiftC; delete v3.run.condition; delete v3.run.runCond;
  const C = makeGame();
  const rc = await C.saves.importText(JSON.stringify(v3), 'play');
  assert(rc.ok && C.level.mode === 'level' && C.farm.condition == null, `a Phase 3 blob: ${rc.message}`);
  C.level.debug.goto(4, 9, { auto: true });
  assert(C.env.dayNumber === 4 && C.level.mode === 'level' && C.farm.flock.alive > 5000, `it plays a day: ${where(C)}`);
});

test('a hot-season backup restored into slot 3 loads with farm.condition hot; mergeProfiles keeps the larger of each; the offer of a backup\'s skill points', async () => {
  useStorage(memStorage());
  const Hh = makeGame();
  Hh.run.startRun({ seed: 1, at: 'level1', condition: 'hot' });
  Hh.level.debug.goto(2, 12, { auto: true });
  const bk = await Hh.saves.exportText('auto');
  assert(bk.ok, bk.message);
  useStorage(memStorage());
  const N = makeGame();
  const pv = await N.saves.previewText(bk.text);
  assert(pv.ok && pv.meta.condition === 'hot' && /^Hot season · /.test(pv.meta.name), `the preview: ${JSON.stringify(pv.meta)}`);
  assert((await N.saves.importText(bk.text, 3)).ok && (await N.saves.loadSlot(3)).ok && N.farm.condition === 'hot' && N.run.condition === 'hot', `slot 3 loads hot: ${N.farm.condition}`);
  const a = { skills: { v: 1, earned: [['m1', 0], ['m2', 2]] }, details: [['m1', 'a']], cyclesDone: 1, conditionsDone: { hot: 1 } };
  const b = { skills: { v: 1, earned: [['m1', 1], ['m3', 0]] }, details: [['m3', 'b'], ['m1', 'b']], cyclesDone: 2, conditionsDone: { hot: 0, rainy: 1 } };
  const m = mergeProfiles(a, b), e = new Map(m.skills.earned);
  assert(e.get('m1') === 1 && e.get('m2') === 2 && e.get('m3') === 0 && m.cyclesDone === 2 && m.conditionsDone.hot === 1 && m.conditionsDone.rainy === 1 && new Map(m.details).get('m1') === 'a', `merged ${JSON.stringify(m)}`);
});

test('importSave(exportSave()) leaves the run key and every start byte-identical (the run key\'s savedAt stamped now)', async () => {
  const S = useStorage(memStorage());
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  assert(G.run.startLevel('weeks45', { from: 'standard' }), 'weeks 4-5');
  G.level.debug.goto(29, 8, { auto: true });
  const ex = G.run.exportSave();
  const before = runKeys(S), t0 = JSON.parse(before[RUN_SAVE.key]).savedAt;
  await new Promise((r) => setTimeout(r, 3));
  assert(G.run.importSave(makeEnvelope(ex)), 'importSave');
  const after = runKeys(S);
  assert(JSON.stringify(Object.keys(after).sort()) === JSON.stringify(Object.keys(before).sort()), `the same keys: ${Object.keys(after).length} / ${Object.keys(before).length}`);
  for (const k of Object.keys(before)) {
    if (k === RUN_SAVE.key) continue;
    assert(after[k] === before[k], `start ${k} byte-identical`);
  }
  const a = JSON.parse(after[RUN_SAVE.key]), b = JSON.parse(before[RUN_SAVE.key]);
  assert(a.savedAt > t0, 'the run key stamped now');
  a.savedAt = b.savedAt;
  assert(JSON.stringify(a) === JSON.stringify(b), `the run key byte-identical but its savedAt: ${firstDiff(a, b)}`);
  console.log(`     ${Object.keys(before).length - 1} level starts and the run key (${kb(before[RUN_SAVE.key].length)}) as they were`);
});

test('This farm only of the day-67 run (<= 30 % of the whole) restores and plays: a Replay of week 2 is then a standard start; the whole run in parts pasted in reverse order restores byte-identical; a part left out: missing-parts naming it', async () => {
  const { G, S } = fullRun();
  useStorage(S);
  if (G.saves.list()[1].empty) assert((await G.saves.saveSlot(1)).ok, 'slot 1');
  const whole = await G.saves.exportText(1), farm = await G.saves.exportText(1, { farmOnly: true });
  assert(farm.chars <= 0.3 * whole.chars && farm.starts === 0 && whole.starts >= 7, `farm only ${farm.chars} of ${whole.chars} (${whole.starts} starts)`);
  useStorage(memStorage());
  const F = makeGame();
  assert((await F.saves.importText(farm.text, 1)).ok && (await F.saves.loadSlot(1)).ok, 'the farm only restores and loads');
  assert(F.level.def.id === 'cleanout' && F.env.dayNumber >= 66 && !F.run.hasStart('week2', 8), `the farm as it was, no level starts: ${where(F)}`);
  assert(F.run.startLevel('week2') && at(F, 8, 6) && F.level.def.id === 'week2' && F.run.state().levels.level1?.state === 'passed', `a Replay of week 2: a standard start ${where(F)}`);
  // the whole run in parts, pasted in reverse order
  const rev = [...whole.parts].reverse().join('\n\n'), inOrder = whole.parts.join('\n\n');
  assert(whole.parts.length > 10 && parseText(rev).data === parseText(inOrder).data, `${whole.parts.length} parts, read back in any order`);
  const R = makeGame();
  const rr = await R.saves.importText(rev, 2);
  assert(rr.ok && rr.starts === whole.starts, `restored from parts in reverse: ${rr.message}`);
  // the restored slot holds the same run (the slot keeps no skill profile: that one is offered at the restore)
  const back = await decodePayload(parseText((await R.saves.exportText(2)).parts.join('\n'))), orig = await decodePayload(parseText(inOrder));
  for (const k of ['run', 'blob', 'starts', 'meta']) assert(firstDiff(back[k], orig[k]) === null, `slot 2's ${k}: ${firstDiff(back[k], orig[k])}`);
  const envA = await decodePayload(parseText(inOrder)), envB = await decodePayload(parseText(rev));
  assert(firstDiff(envA, envB) === null, 'byte-identical');
  const missing = whole.parts.filter((_, i) => i !== 2).join('\n');
  const mr = await R.saves.importText(missing, 3);
  assert(!mr.ok && mr.code === 'missing-parts' && mr.message.includes(`part 3 of ${whole.parts.length}`), `a part left out: ${mr.code} ${mr.message}`);
  console.log(`     ${mr.message}`);
});

test('the autosave that cannot write: EV.SAVE auto-failed once per level, with its message; a resume that throws: the title card, its note, the old autosave kept', async () => {
  const S = useStorage(memStorage({ limit: 20000 }));
  const G = makeGame();
  G.run.startRun({ seed: 1, at: 'level1' });
  G.level.debug.goto(3, 9, { auto: true });
  const af = G.said.filter((p) => p.kind === 'auto-failed');
  assert(af.length === 1 && af[0].message === SAVE_MESSAGES['auto-failed'] && af[0].ok === false, `once: ${af.length} ${JSON.stringify(af[0])}`);
  // a resume that throws half way
  useStorage(memStorage());
  const T = makeGame();
  T.run.startRun({ seed: 1, at: 'level1' });
  T.level.debug.goto(2, 9, { auto: true });
  assert((await T.saves.saveSlot(1)).ok, 'slot 1');
  T.level.debug.goto(3, 9, { auto: true });
  const keep = globalThis.localStorage.getItem(RUN_SAVE.key);
  const resume = T.level.resume;
  T.level.resume = () => { throw new Error('a test failure inside the resume'); };
  const err = console.error; console.error = () => {};
  let r;
  try { r = await T.saves.loadSlot(1); } finally { T.level.resume = resume; console.error = err; }
  assert(!r.ok && r.code === 'load-failed' && T.title.text === SAVE_MESSAGES['load-failed'], `load-failed with the title's note: ${JSON.stringify(r)} / ${T.title.text}`);
  assert(T.level.mode === 'title' && globalThis.localStorage.getItem(RUN_SAVE.key) === keep && T.saves.list()[1].meta?.name, 'the title card; the autosave and the slot as they were');
  assert(T.saves.continueAuto() && Math.abs(T.env.day - JSON.parse(keep).blob.env.day) < 1e-6, `Continue resumes the farm he had: ${where(T)}`);
  void S;
});

// ---------------- Skills update (SKILLS.md §11; package "model") ----------------
test('skills update: farm.auto (the fault plan, an open fault, the holds) and the v2 skill profile round-trip through a save; mergeProfiles keeps the higher tier per slot', async () => {
  const { SKILLS_UPDATE } = await import('../src/config.js');
  const was = SKILLS_UPDATE.live;
  try {
    SKILLS_UPDATE.live = true;
    const w = makeWorld();
    w.farm.start(LEVELS[1], { seed: 9, condition: 'hot', flockNo: 1 });
    w.farm.auto.on.winch = true;
    w.env.skipHours(8);
    w.farm.act('water.height', { line: 1, cm: 14 });
    w.farm.debug.fault('winch-stall', { line: 3 });
    w.skills.award('day7-weight', 1); w.skills.setProfile({ cyclesDone: 1 }); w.skills.award('day7-weight', 0);
    const blob = JSON.parse(JSON.stringify({ farm: w.farm.serialize(), skills: w.skills.serialize() }));
    assert(blob.farm.auto.faults.length === 3 && blob.farm.auto.faults.filter((f) => f.phase === 'planned').length === 2 && blob.farm.auto.hold.winch[1] > w.env.day, `farm.auto: ${JSON.stringify(blob.farm.auto)}`);
    assert(JSON.stringify(blob.farm.auto).length < 2000, `about 1 KB: ${JSON.stringify(blob.farm.auto).length}`);
    const v = makeWorld();
    v.farm.restore(blob.farm); v.skills.restore(blob.skills);
    assert(JSON.stringify(v.farm.serialize().auto) === JSON.stringify(blob.farm.auto) && JSON.stringify(v.skills.serialize()) === JSON.stringify(blob.skills), 'round trip');
    assert(blob.skills.v === 2 && v.skills.points('brooding') === 4 && JSON.stringify(blob.skills).length < 4000, `the profile: ${JSON.stringify(blob.skills)}`);
    const m = mergeProfiles({ skills: blob.skills, cyclesDone: 1 }, { skills: { v: 1, earned: [['day7-weight', 1], ['flushed-on-time', 0]] }, cyclesDone: 1 });
    const f = new Map(m.skills.flocks.map(([k, a, b]) => [k, [a, b]]));
    assert(f.get('day7-weight').join() === '1,0' && f.get('flushed-on-time').join() === '0,', `merged per slot: ${JSON.stringify(m.skills.flocks)}`);
  } finally { SKILLS_UPDATE.live = was; }
});


for (const t of tests) {
  if (process.env.ONLY && !t.name.includes(process.env.ONLY)) continue;
  const t0 = Date.now();
  try { await t.fn(); console.log(`ok   ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  catch (e) { failed++; console.log(`FAIL ${t.name}\n     ${e.message}`); if (process.env.TRACE) console.log(e.stack); }
}
if (Object.keys(measured).length) console.log(`measured: ${JSON.stringify(measured)}`);
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
