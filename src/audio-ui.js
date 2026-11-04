// Sound layer, the speaker key (PHASE5.md §2.5): the last key of the time bar, a one-click sound on / off whose icon and
// label say the state (U still toggles: keys.js 'sound'); Shift+click opens Settings -> Sound, which holds the volume and
// the three layer sliders. The Phase 4 sound card (#sound-pop) is gone and the controls legend draws its U row from
// keys.js (the experience package). Mounted into the HUD ui.js built (no edit to ui.js); its looks in #sound-ui-style.
import { SOUND_KEY } from './audio-settings.js';

const STYLE_ID = 'sound-ui-style';
const CSS = `
.sound-btn .icon { font-size: 18px; }
.sound-btn.is-muted { color: var(--ink-faint); }
.sound-btn.is-muted .icon { opacity: 0.85; }
.sound-btn .sound-off-bar { stroke: var(--warn, #e2a33a); }
`;
const svg = (body) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const SPEAKER = '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>';
const ICON_ON = svg(`${SPEAKER}<path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.8a7.5 7.5 0 0 1 0 10.4"/>`);
const ICON_OFF = svg(`${SPEAKER}<path class="sound-off-bar" d="M16 9.5l5 5M21 9.5l-5 5"/>`);

/**
 * settings: the sound view (volume, muted, toggleMute, subscribe); opts: { unlock(), keys (keys.js: the live label of
 * 'sound'), openSettings(tab), fresh() (true when this very press started the sound: it stays on) }
 */
export function createSoundUI(settings, { unlock, keys, openSettings, fresh } = {}) {
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--icon sound-btn';
  btn.dataset.sound = 'toggle';
  const keyLabel = () => { try { return keys?.label?.('sound') || SOUND_KEY.label; } catch { return SOUND_KEY.label; } };

  function refresh() {
    const muted = !!settings.muted, k = keyLabel();
    btn.innerHTML = muted ? ICON_OFF : ICON_ON;
    btn.classList.toggle('is-muted', muted);
    btn.dataset.state = muted ? 'off' : 'on';
    btn.setAttribute('aria-label', muted ? `Sound is off (${k}): click to turn it on, Shift+click for the sound settings`
      : `Sound is on (${k}): click to turn it off, Shift+click for the sound settings`);
    btn.title = muted ? `Sound off (${k}) · Shift+click: sound settings` : `Sound on (${k}) · Shift+click: sound settings`;
  }
  btn.addEventListener('click', (e) => {
    const started = fresh?.() === true;
    unlock?.();
    if (e.shiftKey) { openSettings?.('sound'); }
    else if (!(started && !settings.muted)) settings.toggleMute(); // the press that started the sound leaves it playing
    if (e.detail > 0) btn.blur();
  });
  const off = settings.subscribe(refresh);
  const offKeys = keys?.subscribe ? keys.subscribe(refresh) : null;
  refresh();

  // mount at the end of the time bar ui.js built (after the map and gear keys: the speaker mounts last)
  let tries = 0, raf = 0;
  function mount() {
    const bar = document.querySelector('#hud .timebar');
    if (!bar) { if (++tries < 120) raf = requestAnimationFrame(mount); return; }
    bar.appendChild(btn);
  }
  mount();
  return {
    button: btn, refresh,
    dispose() { cancelAnimationFrame(raf); off(); offKeys?.(); btn.remove(); },
  };
}
