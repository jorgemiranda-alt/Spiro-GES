/* ---------- Icons ---------- */
const ICONS = {
  home:'<path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 table:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15"/>',
 grid:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8.5 9.5v10M13.5 9.5v10"/>',
 scan:'<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M7 9v6M10 9v6M13 9v6M16.5 9v6"/>',
 check:'<path d="M4.5 12.5l4.5 4.5 10.5-10.5"/>',
 route:'<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3"/>',
 note:'<path d="M5 5h14v10H10l-5 4z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 left:'<path d="M14.5 6 8.5 12l6 6"/>', right:'<path d="M9.5 6l6 6-6 6"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>', edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>', refresh:'<path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5"/>',
 cal:'<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>', plusc:'<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>', save:'<path d="M5 4.5h11l3 3V19.5H5z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>', eyeoff:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 4l16 16"/>',
 info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>', down:'<path d="M6 9.5l6 6 6-6"/>',
 xfer:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>', archive:'<path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4"/>', ext:'<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>'
};
const icon = (n,s=18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||""}</svg>`;
const uj = ids => ids.split(",").map(i=>`<span class="uj" data-act="uj" data-id="${i.trim()}" title="User journey ${i.trim()}">${i.trim()}</span>`).join("");
