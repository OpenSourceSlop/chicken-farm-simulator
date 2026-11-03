// Flock records: the farmer's notebook (readings as he takes them) and the daily record rows the
// office book shows. Pure logic. Owner: package "sim" (phase2/sim). PHASE2.md §8.
//
// createRecords({ farm, env, events }) -> records
//   The notebook fills itself from EV.ACTION results (meter readings, flow tests, probes, samples,
//   dead birds counted at the bin, the settings he made): doing a check is writing it down.
//   sign(day) closes a day's row (the office desk); a day nobody signed closes at the next 06:00
//   with `signed: false`. Rows hold only what the farmer measured: a reading not taken is null
//   ("not read"), never filled in from the hidden model. The one instrument that reads by itself
//   is the automatic bird scale in the brooding area (row weight, source 'scale').
//   On EV.LISTEN it writes a 'look' note from farm.observe(x, z): what the farmer sees and hears
//   there (spread, droppings, sounds), plain words next to that day's numbers.
//   timeline() gives the result screen's "your week": per HUD day the settings he made and the
//   readings he took beside the sign values; null where nothing was done.
import { EV } from './events.js';
import { LEVEL1, MIN_DAY, targetTempAt, weightAt, nippleHeightCmAt, flowTargetAt, minVentM3hPer1000, EQUIP } from './config.js';
import { buildRow, settingsNow } from './records-rows.js';

/**
 * One notebook line.
 * @typedef {{ day: number, hour: number, kind: string, value: any, where?: number[] }} Note
 *   kind: 'water.meter' | 'feed.meter' | 'feed.silo' | 'water.flow' | 'floor.temp' | 'litter' |
 *         'lux' | 'dead' | 'vent.temp' | 'crop' | 'grade' | 'box' | 'weigh' | 'look' | 'filter' |
 *         'controller' | 'grade.sheet' | 'cull' | 'tip' | 'order' | 'setting' | 'text'
 * One daily record row: see records-rows.js (RecordRow). null = not measured that day.
 */

// EV.ACTION id -> notebook kind (readings and the things he did)
const KIND = {
  'water.meter': 'water.meter', 'feed.meter': 'feed.meter', 'feed.silo': 'feed.silo', 'water.flowtest': 'water.flow',
  'floor.probe': 'floor.temp', 'litter.squeeze': 'litter', 'light.lux': 'lux', 'dead.count': 'dead',
  'sample.vent': 'vent.temp', 'sample.crop': 'crop', 'sample.grade': 'grade', 'sample.box': 'box', 'sample.weigh': 'weigh',
  'water.filter': 'filter', 'controller.read': 'controller', 'grade.submit': 'grade.sheet', 'chicks.cull': 'cull',
  'chicks.tip': 'tip', 'feed.order': 'order', 'water.clearFilter': 'text', 'water.fixLeak': 'text', 'heat.relight': 'text',
  'litter.patch': 'text', 'phone.report': 'text',
};
const SETTINGS = new Set(['heat.setpoint', 'vent.timer', 'vent.fans', 'light.program', 'water.pressure', 'water.height', 'feed.line', 'litter.depth', 'water.flush']);
const TEXT = {
  'water.clearFilter': 'Main water filter cleaned', 'water.fixLeak': 'Nipple replaced on drinker line', 'heat.relight': 'Brooder relit',
  'litter.patch': 'Fresh husk put on a wet patch', 'phone.report': 'Deaths reported to the company vet',
};
const PROBLEM_WORDS = {
  'brooder-out': 'a brooder not burning', 'cold-night': 'a cold night forecast', 'blocked-filter': 'low water flow',
  'leaking-nipple': 'a wet patch of litter', 'low-silo': 'the silo running low', 'warm-afternoon': 'the house above its target',
  'abnormal-deaths': 'more dead birds than usual',
};
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const strip = (p) => { const o = { ...p }; delete o.id; delete o.result; delete o.quiet; return o; };

export function createRecords({ farm, env, events } = {}) {
  /** @type {Note[]} */
  const notebook = [];
  /** @type {Map<number, object>} */
  const rows = new Map();
  const jobLog = [];
  /** per day: notes for the row that are not readings (problems, deliveries, jobs, skill lines) */
  const extras = {};
  const state = { closedThrough: null };
  const today = () => (env ? env.dayNumber : 0);
  const ex = (d) => (extras[d] ||= { notes: [], skillLines: [], jobsDone: 0, jobsMissed: 0, missed: [], lapses: 0 });
  const live = () => !farm || farm.mode === 'level';

  const records = {
    notebook,
    /** Add a notebook line by hand (ui: sign facts noted, a text note). */
    note(kind, value, where) {
      const n = { day: today(), hour: env ? r2(env.hour) : 0, kind, value };
      if (where) n.where = where;
      notebook.push(n);
      return n;
    },
    /** Notes of one day. */
    notesOf(day) { return notebook.filter((n) => n.day === day); },
    /** Job results (the job engine reports them; skills read them). */
    logJob(key, day, result) { jobLog.push({ key, day, result: result ?? null }); },
    get jobLog() { return jobLog; },
    /** Today's provisional row (what the office book would show if signed now). */
    draft(day = today()) { return buildRow(day, ctx(), false); },
    /** Close and return the row of `day`. Emits EV.RECORD_CLOSED. */
    sign(day = today(), signed = true) {
      const row = buildRow(day, ctx(), signed);
      rows.set(day, row);
      if (state.closedThrough == null || day > state.closedThrough) state.closedThrough = day;
      events && events.emit(EV.RECORD_CLOSED, { day, row, signed });
      return row;
    },
    row(day) { return rows.get(day) || null; },
    rows() { return [...rows.values()].sort((a, b) => a.day - b.day); },
    /** The result screen's "your week": settings and readings beside the sign values, per day. */
    timeline() { return records.rows().map(timelineOf); },
    reset() { notebook.length = 0; rows.clear(); jobLog.length = 0; for (const k of Object.keys(extras)) delete extras[k]; state.closedThrough = null; },
    // notebook lines saved as [day, hour, kind, value, where?] (the autosave stays small all week)
    serialize() { return { v: 1, notebook: notebook.map((n) => (n.where ? [n.day, n.hour, n.kind, n.value, n.where] : [n.day, n.hour, n.kind, n.value])), rows: records.rows(), jobLog: jobLog.map((j) => [j.key, j.day]), extras: JSON.parse(JSON.stringify(extras)), closedThrough: state.closedThrough }; },
    restore(d) {
      records.reset();
      if (!d) return;
      for (const n of d.notebook || []) {
        if (!Array.isArray(n)) { notebook.push(n); continue; }
        const o = { day: n[0], hour: n[1], kind: n[2], value: n[3] };
        if (n[4]) o.where = n[4];
        notebook.push(o);
      }
      for (const r of d.rows || []) rows.set(r.day, r);
      // saved as [key, day]: the results are in the notebook (nothing reads them from the log)
      jobLog.push(...(d.jobLog || []).map((j) => (Array.isArray(j) ? { key: j[0], day: j[1], result: null } : j)));
      Object.assign(extras, JSON.parse(JSON.stringify(d.extras || {})));
      state.closedThrough = d.closedThrough ?? null;
    },
  };
  const ctx = () => ({ notebook, extras, farm, env, rows });

  if (events) {
    events.on(EV.ACTION, (p) => {
      if (!live() || !p || !p.id) return;
      const where = p.x != null && p.z != null && p.id !== 'sample.weigh' ? [r1(p.x), r1(p.z)] : undefined;
      if (SETTINGS.has(p.id)) {
        if (p.quiet) return;
        // a setting is written down when it changes (the same pressure set again is not a new line)
        const v = { id: p.id, ...strip(p) }, js = JSON.stringify(v);
        for (let i = notebook.length - 1; i >= 0; i--) {
          const n = notebook[i];
          if (n.kind === 'setting' && n.value.id === v.id && n.value.line === v.line) {
            if (JSON.stringify(n.value) === js) return;
            // stepping the same control again right away (a winch or thermostat key pressed many
            // times): one line with the value it ends on
            if (i === notebook.length - 1 && n.day === today() && env && Math.abs(env.hour - n.hour) < 0.25) { n.value = v; n.hour = r2(env.hour); return; }
            break;
          }
        }
        records.note('setting', v);
        return;
      }
      const kind = KIND[p.id];
      if (!kind) return;
      if (kind === 'text') { records.note('text', TEXT[p.id]); return; }
      let value = p.result === undefined ? strip(p) : p.result;
      if (kind === 'water.flow') value = { line: p.line, ...p.result };
      if (kind === 'dead') value = { n: p.n };
      if (kind === 'cull') value = { n: p.n, reason: p.reason };
      if (kind === 'grade') value = { i: p.i, ...p.result };
      records.note(kind, value, where);
    });
    events.on(EV.LISTEN, (p) => {
      if (!live() || !farm) return;
      const o = farm.observe(p.x, p.z);
      const text = `You see: chicks ${o.spread}; droppings ${o.droppings}. You hear: ${o.sounds}.`;
      // the same words again within the hour (he stood still twice in the same flock): one line
      for (let i = notebook.length - 1; i >= 0; i--) {
        const n = notebook[i];
        if (n.kind !== 'look') continue;
        if (n.value === text && n.day === today() && env && Math.abs(env.hour - n.hour) < 1) return;
        break;
      }
      records.note('look', text, [r2(p.x), r2(p.z)]);
    });
    events.on(EV.FARM_PROBLEM, (p) => {
      if (!live() || !PROBLEM_WORDS[p.id]) return;
      if (p.phase === 'symptom') ex(today()).notes.push(`Seen: ${PROBLEM_WORDS[p.id]}`);
      if (p.phase === 'fixed') ex(today()).notes.push(`Dealt with: ${PROBLEM_WORDS[p.id]}`);
    });
    events.on(EV.FARM_DELIVERY, (p) => {
      if (!live() || p.phase !== 'arrive') return;
      ex(today()).notes.push(p.kind === 'feed' ? `Feed delivered: ${p.kg} kg` : `Chicks delivered: ${(farm && farm.flock.delivered) || LEVEL1.chicksPlaced}`);
    });
    events.on(EV.SKILL_POINTS, (p) => {
      if (!live() || !p.points) return;
      const name = p.branch === 'water' ? 'Water' : p.branch === 'brooding' ? 'Brooding' : p.branch;
      ex(today()).skillLines.push(`Skill points: ${name} +${p.points}${p.detail ? `, ${p.detail}` : ''}`);
    });
    events.on(EV.JOB_DONE, () => { if (live()) ex(today()).jobsDone++; });
    events.on(EV.JOB_MISSED, (p) => { if (live()) { const e = ex(today()); e.jobsMissed++; if (p && p.id) e.missed.push(p.id); } });
    events.on(EV.HOUSE_ENTER, (p) => { if (live() && p && p.dipped === false) ex(today()).lapses++; });
  }
  // A day nobody signed closes by itself at 06:00 the next morning.
  if (env && env.addStepper) {
    env.addStepper((e) => {
      if (!farm || farm.mode !== 'level' || e.hour < 6) return;
      const first = farm.level ? farm.level.startDay : MIN_DAY;
      for (let d = Math.max(first, (state.closedThrough ?? first - 1) + 1); d < e.dayNumber; d++) if (!rows.has(d)) records.sign(d, false);
      if (state.closedThrough == null || state.closedThrough < e.dayNumber - 1) state.closedThrough = e.dayNumber - 1;
    });
  }
  return records;
}

/** "Your week" for one row: what he set and read, beside the sign values. */
function timelineOf(row) {
  const s = row.settings || {};
  const d = row.day;
  const birds = row.alive ?? (d >= 0 ? LEVEL1.chicksPlaced : 0);
  const w = row.weightG;
  return {
    day: d,
    setpointC: s.setpointC ?? null, signSetpointC: Math.round(targetTempAt(d) * 2) / 2,
    flowsMlMin: row.flowsMlMin, flowSignMlMin: d >= 0 ? flowTargetAt(d) : null,
    nippleHeightsCm: s.nippleHeightsCm ?? null, nippleSignCm: d >= 0 ? Math.round(nippleHeightCmAt(d)) : null,
    ventTimer: s.ventTimer ?? null,
    ventTimerM3h: s.ventTimer ? Math.round((s.ventTimer.fans * EQUIP.fanM3h * s.ventTimer.onSec) / s.ventTimer.cycleSec) : null,
    ventSignM3h: w != null && birds > 0 ? Math.round((minVentM3hPer1000(w) * birds) / 1000) : null,
    lightHours: s.lightHours ?? null,
    floorAtArrivalC: row.floorTempMeanC ?? null,
    cropTally: row.cropTally ?? null,
    weightG: row.weightG, targetWeightG: Math.round(weightAt(Math.max(0, d))),
  };
}

export { settingsNow };
