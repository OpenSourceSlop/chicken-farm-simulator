// Small inline SVG icons, drawn for this game (24 x 24, stroke = currentColor). Owner: systems/UI agent.

const wrap = (body, extra = '') =>
  `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;

const rays = (cx, cy, r1, r2, n = 8) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    d += `M${(cx + c * r1).toFixed(2)} ${(cy + s * r1).toFixed(2)}L${(cx + c * r2).toFixed(2)} ${(cy + s * r2).toFixed(2)}`;
  }
  return `<path d="${d}"/>`;
};

const fanBlade = 'M12 10.2C10.6 7 11.6 3.6 14.6 3.6c2.3 0 2.6 3.4-.4 5.6L12 10.2z';

export const ICONS = {
  thermometer: wrap('<path d="M10 13.6V5a2 2 0 0 1 4 0v8.6a4.2 4.2 0 1 1-4 0z"/><path d="M12 8.5v8"/><circle cx="12" cy="17.4" r="1.7" fill="currentColor" stroke="none"/>'),
  outside: wrap('<path d="M3 20h18"/><path d="M5 20v-7l5-4 5 4v7"/><path d="M9 20v-4h2v4"/><circle cx="18.5" cy="6" r="2.2"/>'),
  droplet: wrap('<path d="M12 3.5c2.9 3.9 6 7 6 10.9a6 6 0 0 1-12 0c0-3.9 3.1-7 6-10.9z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.4 2.7"/>'),
  flame: wrap('<path d="M12 3c1.3 3.3 5.7 5.6 5.7 10.7a5.7 5.7 0 0 1-11.4 0c0-2.6 1.4-4.4 2.8-5.5.1 1.8.9 3 2 3.4C10.6 8.6 10.6 5.6 12 3z"/><path d="M12 20.2a2.4 2.4 0 0 1-2.4-2.4c0-1.5 1.2-2.4 2.4-3.6 1.2 1.2 2.4 2.1 2.4 3.6a2.4 2.4 0 0 1-2.4 2.4z"/>'),
  fan: wrap(`<rect x="2.5" y="2.5" width="19" height="19" rx="2.5"/><circle cx="12" cy="12" r="1.7"/><path d="${fanBlade}"/><path d="${fanBlade}" transform="rotate(120 12 12)"/><path d="${fanBlade}" transform="rotate(240 12 12)"/>`),
  sun: wrap(`<circle cx="12" cy="12" r="4"/>${rays(12, 12, 6.6, 9.4)}`),
  moon: wrap('<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/>'),
  hot: wrap(`<circle cx="12" cy="10" r="3.6"/>${rays(12, 10, 5.8, 8, 8)}<path d="M5 20.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0"/>`),
  rain: wrap('<path d="M7 15.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.3A3.4 3.4 0 0 1 17 15.5z"/><path d="M8.5 18.5l-1 2.2M12.5 18.5l-1 2.2M16.5 18.5l-1 2.2"/>'),
  wind: wrap('<path d="M3 8.5h11.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12.5h15.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 16.5h7"/>'),
  pad: wrap('<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M8 3.5v17M12 3.5v17M16 3.5v17"/><path d="M4 8l16 0" stroke-dasharray="1.5 2.5"/>'),
  play: wrap('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  pause: wrap('<rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/>'),
  skip: wrap('<circle cx="11" cy="13" r="7.5"/><path d="M11 9v4l2.6 1.6"/><path d="M17.5 3.5l2.8 2.8-2.8 2.8"/>'),
  sunrise: wrap('<path d="M3 19h18"/><path d="M7.5 19a4.5 4.5 0 0 1 9 0"/><path d="M4.6 15.4l1.6.9M19.4 15.4l-1.6.9M7.8 11.9l1 1.4M16.2 11.9l-1 1.4"/><path d="M12 3.5v6.5M9.6 5.9L12 3.5l2.4 2.4"/>'),
  check: wrap('<path d="M5 12.5l4.3 4.3L19 7"/>', ' stroke-width="2.6"'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>', ' stroke-width="2.2"'),
  pin: wrap('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  sliders: wrap('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  chevron: wrap('<path d="M6 9.5l6 6 6-6"/>'),
  clipboard: wrap('<rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>'),
  minus: wrap('<path d="M6 12h12"/>', ' stroke-width="2.6"'),
  plus: wrap('<path d="M6 12h12M12 6v12"/>', ' stroke-width="2.6"'),
  keyboard: wrap('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M6 12.5h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01M18 12.5h.01M8 15.5h8"/>'),
  monitor: wrap('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>'),
};

export const weatherIcon = (w) => (w === 'rainy' ? ICONS.rain : w === 'hot' ? ICONS.hot : ICONS.sun);
