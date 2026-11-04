// Sound layer, the controls: a speaker button at the end of the time bar (bottom left) that opens a
// small card with Sound on / off and a volume slider, and a "U  Sound on or off" row in both controls
// legends. Built from here into the HUD that ui.js made (no edit to ui.js); styles are injected once.
// The values live in audio-settings.js (the Phase 5 settings menu can drive the same store).
import { SOUND_KEY } from './audio-settings.js';

const CSS = `
.sound-btn .icon { font-size: 18px; }
.sound-btn.is-muted { color: var(--ink-faint); }
.sound-pop { width: 248px; padding: 10px 12px 11px; }
.sound-pop[hidden] { display: none; }
.sound-pop-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.sound-pop-head h2 { margin: 0; font-size: 12px; color: var(--ink); }
.sound-pop-head .btn { margin-left: auto; min-height: 28px; padding: 4px 10px; font-size: 12px; }
.sound-vol { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink-dim); }
.sound-vol input { width: 100%; accent-color: var(--accent); }
.sound-vol output { min-width: 30px; text-align: right; font: 600 12px/1 var(--font-display); color: var(--ink); }
.sound-note { margin: 8px 0 0; font-size: 12px; line-height: 1.35; color: var(--ink-faint); }
`;
const svg = (body) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const SPEAKER = '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>';
const ICON_ON = svg(`${SPEAKER}<path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.8a7.5 7.5 0 0 1 0 10.4"/>`);
const ICON_OFF = svg(`${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/>`);

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k of Object.keys(attrs || {})) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}

export function createSoundUI(settings, { unlock } = {}) {
  if (!document.getElementById('sound-ui-style')) {
    const st = el('style', { id: 'sound-ui-style' });
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const btn = el('button', { type: 'button', class: 'btn btn--icon sound-btn', 'aria-expanded': 'false', 'aria-controls': 'sound-pop' });
  const mute = el('button', { type: 'button', class: 'btn sound-mute' });
  const slider = el('input', { type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Sound volume' });
  const shown = el('output', { 'aria-hidden': 'true' });
  const pop = el('section', { class: 'card sound-pop', id: 'sound-pop', 'aria-labelledby': 'sound-pop-title', hidden: '' },
    el('div', { class: 'sound-pop-head' }, el('h2', { class: 'label', id: 'sound-pop-title' }, 'Sound'), mute),
    el('label', { class: 'sound-vol' }, el('span', null, 'Volume'), slider, shown),
    el('p', { class: 'sound-note' }, `Quiet farm sounds: the yard, the house's machines and the flock. ${SOUND_KEY.label} turns them on and off.`));

  function refresh() {
    const { volume, muted } = settings.state();
    btn.innerHTML = muted ? ICON_OFF : ICON_ON;
    btn.classList.toggle('is-muted', muted);
    const label = muted ? `Sound is off: open the sound controls (${SOUND_KEY.label})` : `Sound is on: open the sound controls (${SOUND_KEY.label})`;
    btn.setAttribute('aria-label', label);
    btn.title = `Sound (${SOUND_KEY.label})`;
    mute.textContent = muted ? 'Sound on' : 'Sound off';
    mute.setAttribute('aria-pressed', String(muted));
    const v = String(Math.round(volume * 100));
    if (slider.value !== v) slider.value = v;
    shown.textContent = v;
  }
  const open = (on) => { pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
  btn.addEventListener('click', (e) => { unlock?.(); open(pop.hidden); if (e.detail > 0) btn.blur(); });
  mute.addEventListener('click', (e) => { unlock?.(); settings.toggleMute(); if (e.detail > 0) mute.blur(); });
  slider.addEventListener('input', () => { unlock?.(); settings.set({ volume: +slider.value / 100, muted: false }); });
  slider.addEventListener('change', () => slider.blur());
  const onDocDown = (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) open(false); };
  const onKey = (e) => { if (e.key === 'Escape' && !pop.hidden) open(false); };
  document.addEventListener('pointerdown', onDocDown, true);
  window.addEventListener('keydown', onKey);
  const off = settings.subscribe(refresh);
  refresh();

  // mount into the HUD ui.js built: the time bar's end, the card above it, a row in each controls legend
  let tries = 0, raf = 0;
  function mount() {
    const bar = document.querySelector('#hud .timebar');
    if (!bar) { if (++tries < 120) raf = requestAnimationFrame(mount); return; }
    bar.appendChild(btn);
    bar.parentElement?.insertBefore(pop, bar);
    for (const list of document.querySelectorAll('#hud .help-list')) {
      if (list.querySelector('.sound-help')) continue;
      list.append(el('dt', { class: 'sound-help' }, el('kbd', { class: 'kbd' }, SOUND_KEY.label)), el('dd', { class: 'sound-help' }, 'Sound on or off'));
    }
  }
  mount();
  return {
    button: btn, card: pop, refresh,
    dispose() {
      cancelAnimationFrame(raf); off();
      document.removeEventListener('pointerdown', onDocDown, true);
      window.removeEventListener('keydown', onKey);
      btn.remove(); pop.remove();
    },
  };
}
