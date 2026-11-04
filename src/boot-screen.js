// The loading card and the error messages that replace it (PHASE5.md §6.3). index.template.html draws the card (#boot:
// the hen, "Chicken Farm", the line under it, the bar) and its own inline script says so when three.js cannot load;
// main.js calls this module while it builds the farm and when something stops it. Owner after the design round:
// package "experience" (the texts, the steps' words, the look); the API is the frozen contract.
//
//   const boot = createBootScreen()
//   await boot.step('Building the farm')   the line under the title; resolves after the page has painted it
//   boot.error(kind, detail?)              the card becomes the message of BOOT_ERRORS[kind] (detail: the error's words, or
//                                          { saved } for 'context-lost': whether level.saveNow() wrote the game just then)
//   boot.hide()                            the farm is ready
//   boot.shown                             the card is up (loading or an error)
/** Every message the player can meet before or outside the game (plain words; what to do next). */
export const BOOT_ERRORS = {
  webgl: 'This game needs WebGL. Open it in a recent desktop browser such as Chrome, Edge, Firefox or Safari.',
  library: 'Could not load the 3D library (cdn.jsdelivr.net). Check the internet connection and reload the page.',
  load: (d) => `The farm failed to load: ${d}`,
  stopped: (d) => `The farm stopped: ${d}. Reload the page to start again.`,
  'context-lost': (d) => (d && d.saved
    ? 'The graphics stopped (the computer reset its graphics card). The game was saved just now: reload the page and press Continue.'
    : 'The graphics stopped (the computer reset its graphics card). Reload the page; Continue goes on from the last time the game saved.'),
  // the template's 20 s timer while the module runs (three.js loaded): a line under the step words, the card stays
  slow: 'Still loading… a slow connection or computer can take a minute.',
};

export function createBootScreen(doc = typeof document !== 'undefined' ? document : null) {
  const el = () => doc?.getElementById('boot') || null;
  const sub = () => el()?.querySelector('.boot-sub') || null;
  const paint = () => new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
    // two frames: the first paints the new words, the second starts after it
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  return {
    get shown() { const b = el(); return !!b && !b.hidden; },
    step(text) {
      const s = sub();
      if (s && text) s.textContent = `${text}…`;
      return paint();
    },
    error(kind, detail) {
      const b = el();
      if (!b) return;
      const m = BOOT_ERRORS[kind] ?? BOOT_ERRORS.load;
      b.hidden = false;
      b.classList.add('boot--error');
      const d = kind === 'context-lost' ? detail : detail && detail.message ? detail.message : detail ?? '';
      b.textContent = typeof m === 'function' ? m(d) : m;
    },
    hide() { const b = el(); if (b) b.hidden = true; },
  };
}
