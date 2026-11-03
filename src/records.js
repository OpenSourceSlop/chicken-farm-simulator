// Flock records: the farmer's notebook (readings as he takes them) and the daily record rows the
// office book shows. Pure logic. Owner: package "sim" (phase2/sim). STUB: shape only.
//
// createRecords({ farm, env, events }) -> records
//   The notebook fills itself from EV.ACTION results (meter readings, flow tests, probes, samples,
//   dead birds counted at the bin): doing a check is writing it down. ui-records.js shows it.
//   sign(day) closes a day's row (the office desk); a day nobody signed closes at the next
//   06:00 with `signed: false`. Rows hold only what the farmer measured: a reading not taken is
//   null ("not read"), never filled in from the hidden model.
//   On EV.LISTEN it writes a 'look' note from farm.observe(x, z): what the farmer sees and hears
//   there (spread, droppings, sounds), plain words next to that day's numbers.
//   timeline() gives the result screen's "your week": per HUD day the settings he made and the
//   readings he took (setpoint, flow per line, nipple heights, vent timer, light hours, floor at
//   arrival, crop tally), plain numbers beside the sign values; null where nothing was done.
import { EV } from './events.js';

/**
 * One notebook line.
 * @typedef {{ day: number, hour: number, kind: string, value: any, where?: string }} Note
 *   kind: 'water.meter' | 'feed.meter' | 'feed.silo' | 'water.flow' | 'floor.temp' | 'litter' |
 *         'lux' | 'dead' | 'vent.temp' | 'crop' | 'grade' | 'box' | 'weigh' | 'house.temp' | 'look' |
 *         'filter' | 'controller' | 'text'
 *
 * One daily record row (PHASE2.md "Flock records"). null = not measured that day.
 * @typedef {{
 *   day: number, signed: boolean,
 *   alive: number|null, deaths: number|null, culls: number|null, mortalityCumPct: number|null,
 *   feedKg: number|null, feedPerBirdG: number|null,
 *   waterL: number|null, waterPerBirdMl: number|null, waterFeedRatio: number|null,
 *   waterChangePct: number|null,
 *   weightG: number|null, weightSource: 'scale'|'weighed'|null, targetWeightG: number,
 *   weightRatio: number|null, uniformityPct: number|null, fcr: number|null,
 *   litterMoisturePct: number|null, houseMinC: number|null, houseMaxC: number|null, targetC: number,
 *   lightHours: number|null, cropFullPct: number|null, ventTempMeanC: number|null,
 *   chickWeightG: number|null,          // day 0: measured box weight / 100 (never a typed value)
 *   chickQualityNote: string|null,      // day 0: the farmer's own grading sheet, copied as he filled it
 *   looks: string[],                    // the day's 'look' notes (neutral words)
 *   skillLines: string[],               // "Skill points: Water +2, lines flushed 13 h before the chicks"
 *   notes: string[], jobsDone: number, jobsMissed: number
 * }} RecordRow
 */

export function createRecords({ farm, env, events } = {}) {
  /** @type {Note[]} */
  const notebook = [];
  /** @type {Map<number, RecordRow>} */
  const rows = new Map();
  const jobLog = [];

  const records = {
    notebook,
    /** Add a notebook line by hand (ui: sign facts noted, a text note). */
    note(kind, value, where) {
      const n = { day: env ? env.dayNumber : 0, hour: env ? env.hour : 0, kind, value, where };
      notebook.push(n);
      return n;
    },
    /** Notes of one day. */
    notesOf(day) { return notebook.filter((n) => n.day === day); },
    /** Job results (b reports them; skills read them). */
    logJob(key, day, result) { jobLog.push({ key, day, result }); },
    get jobLog() { return jobLog; },
    /** Today's provisional row (what the office book would show if signed now). */
    draft(day) { return emptyRow(day, env); },
    /** Close and return the row of `day`. Emits EV.RECORD_CLOSED. */
    sign(day, signed = true) {
      const row = { ...emptyRow(day, env), signed };
      rows.set(day, row);
      events && events.emit(EV.RECORD_CLOSED, { day, row, signed });
      return row;
    },
    row(day) { return rows.get(day) || null; },
    /** STUB: the result screen's "your week" (see the header). */
    timeline() { return []; },
    rows() { return [...rows.values()].sort((a, b) => a.day - b.day); },
    reset() { notebook.length = 0; rows.clear(); jobLog.length = 0; },
    serialize() { return { v: 1, notebook: notebook.slice(), rows: records.rows(), jobLog: jobLog.slice() }; },
    restore(d) {
      records.reset();
      if (!d) return;
      notebook.push(...(d.notebook || []));
      for (const r of d.rows || []) rows.set(r.day, r);
      jobLog.push(...(d.jobLog || []));
    },
  };
  void farm;
  return records;
}

function emptyRow(day, env) {
  return {
    day, signed: false, alive: null, deaths: null, culls: null, mortalityCumPct: null,
    feedKg: null, feedPerBirdG: null, waterL: null, waterPerBirdMl: null, waterFeedRatio: null, waterChangePct: null,
    weightG: null, weightSource: null, targetWeightG: 0, weightRatio: null, uniformityPct: null, fcr: null,
    litterMoisturePct: null, houseMinC: null, houseMaxC: null, targetC: env ? env.targetTemp : 0,
    lightHours: null, cropFullPct: null, ventTempMeanC: null, chickWeightG: null, chickQualityNote: null,
    looks: [], skillLines: [], notes: [], jobsDone: 0, jobsMissed: 0,
  };
}
