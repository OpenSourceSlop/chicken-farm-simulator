// The wash bay (west of the house, clean-out; PHASE3.md §1 Level 7, §6.10, §13.7) and the dead bird bin by
// look (unlock deadByLook, §6.12, §13.9). Package "panels".
// Wash bay: take / put back the pressure washer, the sprayer and the swab kit (props.startCarry / drop; scene
// paints clean.wash / clean.spray while they are carried), the four wash items (clean.washbay { item }) and
// the floor as it is now (washed, dry, disinfected: the shares of farm.clean).
// Dead bin: the birds in the bucket as they look; the farmer counts them by look himself and counts them
// into the bin: dead.count { n, causes, byLook: { back, thin, wingsOut, hunched } }, then EV.DEAD_DROP.
import { CLEAN, CYCLE } from './config.js';
import { EV } from './events.js';
import { h, button, setText } from './ui-dom.js';
import { ICONS } from './ui-icons.js';
import { equipShell, machineRow, readout, stepper } from './ui-equipment.js';
import { machineJob, progressBar } from './ui-cycle-kit.js';

const TOOLS = [
  { kind: 'washer', name: 'Pressure washer', sub: 'detergent, a strip about 5 m wide', take: 'Take the washer', back: 'Put the washer back' },
  { kind: 'sprayer', name: 'Disinfectant sprayer', sub: 'once the floor is dry, a strip about 5 m wide', take: 'Take the sprayer', back: 'Put the sprayer back' },
  { kind: 'swabs', name: 'Swab kit', sub: 'ten swabs for the places the lab flags', take: 'Take the swab kit', back: 'Put the swab kit back' },
];
const ITEMS = { boots: 'Boots', buckets: 'Buckets', barrow: 'Barrow', washer: 'The washer itself' };

export function buildWashBay(api) {
  const { L } = api;
  const { env, farm, props } = L;
  const shell = equipShell({ cls: 'equip--wash', icon: ICONS.droplet, title: 'Wash bay', sub: 'West of the house · washer, sprayer, swab kit', plates: ['wash-bay'], signLinks: ['sign-clean'], onClose: L.close });
  const tools = TOOLS.map((t) => {
    const take = button({ class: 'btn btn--machine btn--go' }, t.take), back = button({ class: 'btn btn--machine' }, t.back);
    take.addEventListener('click', () => { props.startCarry(t.kind, {}); L.close(); });
    back.addEventListener('click', () => { props.drop(); refresh(); });
    const row = machineRow(t.name, t.sub, take, back);
    return { ...t, take, back, row };
  });
  const washed = readout('Floor washed'), dry = readout('Floor dry'), sprayed = readout('Disinfected'), swabs = readout('Swabs taken');
  const bar = progressBar();
  let busy = null;
  const washedAt = {}; // when the farmer washed each item here (the farm's clean.washbay is the record)
  let isOpen = false;
  const items = CLEAN.washItems.map((item) => {
    const job = machineJob(env, 3, () => {
      L.act('clean.washbay', { item }); washedAt[item] = env.timeLabel; busy = null; bar.set(0); refresh();
      shell.timeNote.done(`${ITEMS[item] || item} washed and disinfected ${env.timeLabel}.`);
      if (!isOpen) L.notice?.(`Wash bay: ${(ITEMS[item] || item).toLowerCase()} washed and disinfected ${env.timeLabel}.`, 5);
    });
    const b = button({ class: 'key key--wide', 'aria-label': `Wash and disinfect: ${ITEMS[item] || item}` }, 'Wash');
    // the steps hotfix: a wash takes farm time: a paused clock runs again, and a wash still running finishes when the bay closes
    b.addEventListener('click', () => { if (busy) return; shell.needTime(`washing and disinfecting ${(ITEMS[item] || item).toLowerCase()} takes 3 farm minutes`); busy = job; job.start(); refresh(); });
    const row = machineRow(ITEMS[item] || item, '', b);
    return { item, b, job, row };
  });
  const note = h('p', { class: 'equip-note' });
  shell.main.append(h('div', { class: 'ctrl-rows' }, tools.map((t) => t.row.el)),
    h('div', { class: 'equip-reads' }, washed.el, dry.el, sprayed.el, swabs.el),
    h('p', { class: 'cyc-k', style: 'margin-top: 12px' }, 'Wash and disinfect at the bay'), h('div', { class: 'cyc-items', style: 'margin-top: 6px' }, items.map((x) => x.row.el)), bar.el, shell.timeNote.el, note);
  const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v || 0)) * 100)} %`;
  function refresh() {
    const C = farm.clean || {};
    const open = env.dayNumber >= CYCLE.cleanFrom || !!farm.harvest?.result;
    for (const t of tools) {
      t.take.hidden = props.carrying === t.kind; t.back.hidden = props.carrying !== t.kind;
      t.take.disabled = !open || props.handsBusy(t.kind);
      t.row.led.classList.add('led--run'); t.row.led.classList.toggle('is-on', props.carrying === t.kind);
    }
    washed.set(pct(C.washShare), 'of the house floor');
    dry.set(pct(1 - (C.wetShare || 0)), C.wetShare > 0 ? 'wet floor dries with the fans' : 'of the house floor');
    sprayed.set(pct(C.sprayShare), 'of the house floor');
    swabs.set(`${(C.swabs || []).length} of ${CLEAN.swabs}`, C.lab ? 'the lab letter is on the desk' : C.labDay != null ? `lab letter day ${C.labDay}` : 'at the flagged places');
    for (const x of items) {
      const done = !!C.washbay[x.item];
      setText(x.row.small, x.job.running ? 'washing…' : done ? `washed and disinfected${washedAt[x.item] ? ` ${washedAt[x.item]}` : ''}` : 'not washed');
      x.row.led.classList.add('led--pad'); x.row.led.classList.toggle('is-on', x.job.running);
      x.b.disabled = !!busy;
    }
    setText(note, open ? 'The washer and the sprayer paint their strip as you walk inside with them; three passes along the house.' : 'The wash bay is for the clean-out, after the catch.');
  }
  let acc = 0;
  return {
    el: shell.el,
    onOpen() { isOpen = true; shell.refreshPlates(); },
    busy: () => !!busy,
    onClose() { isOpen = false; },
    update(dt, force) {
      if (busy) bar.set(busy.tick() || 0.001);
      acc -= dt;
      if (force || acc <= 0) { acc = 0.3; refresh(); }
    },
  };
}

// ---------------- dead bird bin, by look ----------------
const LOOK_OF = { sds: 'back', heat: 'wingsOut', legs: 'thin', weak: 'thin', starveout: 'thin', dehydration: 'thin', disease: 'hunched', respiratory: 'hunched' };
const BY_LOOK = [['back', 'On its back, legs up'], ['thin', 'Thin, small'], ['wingsOut', 'Wings out'], ['hunched', 'Hunched, feathers fluffed']];
function deadSvg(look) {
  const body = {
    back: '<ellipse cx="20" cy="18" rx="13" ry="9" fill="var(--hen)"/><path d="M15 9l-2-6M24 9l2-6" stroke="var(--hen-beak)" stroke-width="2.2" stroke-linecap="round"/><circle cx="6" cy="20" r="5" fill="var(--hen)"/>',
    thin: '<ellipse cx="20" cy="19" rx="9" ry="6" fill="var(--hen)"/><circle cx="31" cy="16" r="4" fill="var(--hen)"/><path d="M16 25l-3 3M22 25l2 3" stroke="var(--hen-beak)" stroke-width="1.6"/>',
    wingsOut: '<ellipse cx="20" cy="19" rx="11" ry="7" fill="var(--hen)"/><path d="M10 17L1 10l6 11zM30 17l9-7-6 11z" fill="var(--hen-shade)"/><circle cx="31" cy="23" r="4" fill="var(--hen)"/>',
    hunched: '<ellipse cx="20" cy="19" rx="14" ry="11" fill="var(--hen-shade)"/><circle cx="31" cy="13" r="4.5" fill="var(--hen)"/><path d="M8 14q12-8 24 0" stroke="var(--hen)" stroke-width="3" fill="none"/>',
    other: '<ellipse cx="20" cy="19" rx="12" ry="8" fill="var(--hen)"/><circle cx="32" cy="18" r="4.5" fill="var(--hen)"/>',
  }[look] || '';
  return `<svg viewBox="0 0 40 32" width="40" height="32" aria-hidden="true">${body}</svg>`;
}

export function buildDeadBin(api) {
  const { L } = api;
  const { props, events } = L;
  const shell = equipShell({ cls: 'equip--bin', icon: ICONS.sack, title: 'Dead bird bin', sub: 'Count the birds in the bucket by how they look', signLinks: ['sign-health'], onClose: L.close });
  const bucket = h('div', { class: 'cyc-bucket', role: 'img' });
  const inBucket = readout('In the bucket');
  const counts = Object.fromEntries(BY_LOOK.map(([k]) => [k, 0]));
  const tallies = BY_LOOK.map(([k, label]) => {
    const s = stepper(label, '', (d) => { counts[k] = Math.max(0, Math.min(99, counts[k] + d)); s.set(String(counts[k])); refresh(); });
    s.set('0');
    return { k, s, el: h('div', { class: 'cyc-tally' }, h('span', { html: deadSvg(k) }), h('span', null, label), h('span', { class: 'ctrl-keys' }, s.els)) };
  });
  const rest = h('p', { class: 'cyc-line cyc-dim' });
  const count = button({ class: 'btn btn--machine btn--go' }, 'Count them into the bin');
  count.addEventListener('click', () => {
    const o = props.carrying === 'bucket' ? props.carryOpts || { n: 0, causes: {} } : { n: 0, causes: {} };
    const n = o.n || 0, causes = { ...(o.causes || {}) };
    const byLook = { ...counts };
    L.act('dead.count', { n, causes, byLook });
    events?.emit(EV.DEAD_DROP, { n, causes });
    if (props.carrying === 'bucket') props.drop();
    L.close();
  });
  shell.main.append(h('div', { class: 'cyc-row2' }, h('div', null, bucket, h('div', { class: 'equip-reads' }, inBucket.el)),
    h('div', { class: 'ctrl-rows', style: 'margin-top: 0' }, tallies.map((t) => t.el), rest, h('div', { class: 'equip-btns' }, count))));
  let shown = '';
  function refresh() {
    const o = props.carrying === 'bucket' ? props.carryOpts || {} : {};
    const n = o.n || 0, causes = o.causes || {};
    const key = `${n}|${JSON.stringify(causes)}`;
    if (key !== shown) {
      shown = key;
      const looks = [];
      for (const [c, m] of Object.entries(causes)) for (let i = 0; i < m; i++) looks.push(LOOK_OF[c] || 'other');
      while (looks.length < n) looks.push('other');
      // mixed as they lie in the bucket (a fixed shuffle, the same every time)
      const mixed = looks.map((l, i) => [((i * 7919) % 97) / 97, l]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      bucket.innerHTML = mixed.length ? mixed.slice(0, 60).map(deadSvg).join('') : '<p class="cyc-line cyc-dim" style="margin:6px">The bucket is empty.</p>';
      bucket.setAttribute('aria-label', `${n} dead bird${n === 1 ? '' : 's'} in the bucket`);
      inBucket.set(String(n), n === 1 ? 'dead bird' : 'dead birds');
    }
    const counted = Object.values(counts).reduce((a, b) => a + b, 0);
    setText(rest, n ? `Your counts: ${counted} of ${n}${counted < n ? ` · ${n - counted} not by any of these looks` : ''}.` : 'Pick up the dead birds in the house first.');
    count.disabled = !n;
  }
  return {
    el: shell.el,
    onOpen() { for (const t of tallies) { counts[t.k] = 0; t.s.set('0'); } shown = ''; refresh(); },
    update(dt, force) { if (force) refresh(); },
  };
}
