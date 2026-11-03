// Game event bus shared by every Phase 2 module. Owner: integrator (complete, frozen).
// One bus per game: ctx.events. Packages talk through it instead of importing each other.
//
//   const off = events.on('footdip', (p) => ...);   events.emit('footdip', { where: 'gate' });
//   events.on('*', (p, type) => ...)                  // every event (records, tests)
//
// Event names and payloads are listed in EV below and in PHASE2.md "Event catalogue".
// Handlers run synchronously in the order they were added; a throwing handler is logged and the
// others still run (one bad listener must not stop the farm).

/** Event names (use these constants, not string literals, so typos fail loudly in review). */
export const EV = {
  // c: props / triggers / interactions
  FOOTDIP: 'footdip',               // { where: 'gate' | 'house' }
  HOUSE_ENTER: 'house:enter',       // { dipped: boolean } dipped = passed the house foot dip just before
  HOUSE_EXIT: 'house:exit',         // {}
  CELL: 'farmer:cell',              // { cx, cz, x, z } farmer stepped into a new FLOOR_GRID cell inside the house
  LITTER_SPREAD: 'litter:spread',   // { cover } floor fraction covered so far (0..1)
  BOX_PICK: 'boxes:pick',           // { stack, chicks } farmer picked up a stack of chick boxes
  BOX_TIP: 'boxes:tip',             // { stack, chicks, x, z } boxes emptied onto the litter here
  PROBE: 'probe',                   // { kind: 'floor' | 'litter' | 'lux', x, z, value } hand measurement
  LISTEN: 'listen',                 // { x, z, seconds } farmer stood still inside listening
  // d: flock
  BIRD_PICK: 'bird:pick',           // { index, x, z } a live bird was caught for a sample
  BIRD_RELEASE: 'bird:release',     // { index }
  DEAD_PICK: 'dead:pick',           // { n, causes: {cause: n}, carried } dead birds picked up
  DEAD_DROP: 'dead:drop',           // { n, causes } carried dead birds put in the bin (counted)
  // a: farm model
  FARM_DEATH: 'farm:death',         // { n, cause } n real birds died (cause: cold|heat|dehydration|weak|starveout|other|box)
  FARM_PLACED: 'farm:placed',       // { chicks, x, z, minutesInBox }
  FARM_PROBLEM: 'farm:problem',     // { id, phase: 'start' | 'symptom' | 'fixed' }
  FARM_DELIVERY: 'farm:delivery',   // { kind: 'chicks' | 'feed', phase: 'arrive' | 'leave' }
  RECORD_CLOSED: 'record:closed',   // { day, row } the daily record row is final
  SKILL_POINTS: 'skill:points',     // { branch, milestone, points, total, level }
  SKILL_UNLOCK: 'skill:unlock',     // { key } a key of config UNLOCKS became available
  // b: jobs / level / panels
  PANEL_OPEN: 'panel:open',         // { id }
  PANEL_CLOSE: 'panel:close',       // { id }
  ACTION: 'action',                 // { id, action, ...values } something done on a panel (see PHASE2.md)
  JOB_OPEN: 'job:open',             // { id, key }
  JOB_DONE: 'job:done',             // { id, key, result }
  JOB_MISSED: 'job:missed',         // { id, key }
  LEVEL: 'level',                   // { phase: 'start' | 'resume' | 'day' | 'end', day, result? }
};

/**
 * @returns {{ on(type: string, fn: (payload: any, type: string) => void): () => void,
 *             once(type: string, fn: Function): () => void,
 *             emit(type: string, payload?: any): void,
 *             clear(): void }}
 */
export function createEvents() {
  const map = new Map();
  const list = (t) => { let l = map.get(t); if (!l) { l = []; map.set(t, l); } return l; };
  function call(fn, payload, type) {
    try { fn(payload, type); } catch (err) { console.error(`event ${type} handler failed`, err); }
  }
  const bus = {
    on(type, fn) {
      list(type).push(fn);
      return () => { const l = map.get(type); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } };
    },
    once(type, fn) {
      const off = bus.on(type, (p, t) => { off(); fn(p, t); });
      return off;
    },
    emit(type, payload = {}) {
      const l = map.get(type);
      if (l) for (const fn of l.slice()) call(fn, payload, type);
      const all = map.get('*');
      if (all) for (const fn of all.slice()) call(fn, payload, type);
    },
    clear() { map.clear(); },
  };
  return bus;
}
