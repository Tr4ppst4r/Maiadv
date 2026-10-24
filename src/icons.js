const paths = {
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  book: '<path d="M12 6C9 3 5 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-2-9 1v14"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  flower:
    '<path d="M12 9c-6-10-13 1-5 3-9 5 2 13 5 4 4 9 14 0 5-4 9-3 0-13-5-3Z"/><circle cx="12" cy="12" r="2"/>',
  leaf: '<path d="M20 3C5 2 1 12 7 18S23 16 20 3ZM5 21 16 9"/>',
  water:
    '<path d="M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12ZM8 15c0 2 1 3 3 3"/>',
  home: '<path d="m2 11 10-8 10 8M5 9v12h14V9m-10 12v-8h6v8"/>',
  castle:
    '<path d="M3 21V6h3V3h3v6h6V3h3v3h3v15ZM9 21v-7a3 3 0 0 1 6 0v7M6 12h1m10 0h1"/>',
  sound: '<path d="M10 5 5 9H2v6h3l5 4ZM14 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="M10 5 5 9H2v6h3l5 4Zm5 4 6 6m0-6-6 6"/>',
  settings:
    '<path d="m10 3-1 3-3 1-3 1 1 4-1 4 3 1 3 1 1 3h4l1-3 3-1 3-1-1-4 1-4-3-1-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  heart: '<path d="M12 21 3 12C-3 5 7-2 12 6c5-8 15-1 9 6Z"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  users:
    '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-18a4 4 0 0 1 0 8m3 3a7 7 0 0 1 3 7"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  flag: '<path d="M5 22V3c5-5 9 5 15 0v10c-6 5-10-5-15 0"/>',
  undo: '<path d="M4 4v6h6m-6 0a8 8 0 1 1 0 8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3m0 3h.01"/>',
  gem: '<path d="m3 9 4-6h10l4 6-9 12Zm0 0h18M7 3l5 18 5-18"/>',
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
}

export function portrait(who = "maisie") {
  const cat = who === "lily" || who === "clover";
  const face =
    who === "clover"
      ? "#8b8484"
      : who === "lily" || who === "luna"
        ? "#fffaf1"
        : who === "kit"
          ? "#73b4df"
          : who === "axel"
            ? "#f5b6c9"
            : "#f6c39c";
  let extra = "";
  if (who === "maisie")
    extra =
      '<path d="M18 48C2 16 24 0 40 8 64-1 75 26 64 51L53 61H24Z" fill="#713d23"/><circle cx="21" cy="24" r="10" fill="#864a29"/><circle cx="56" cy="21" r="12" fill="#864a29"/>';
  if (cat)
    extra = `<path d="m16 34-2-24 22 18M45 26 63 8l-1 28" fill="${face}" stroke="#796d68" stroke-width="2"/><path d="m20 26-1-10 11 11m22-2 8-9-1 13" fill="#eaa9a9"/>`;
  if (who === "kit")
    extra =
      '<ellipse cx="25" cy="17" rx="8" ry="19" fill="#73b4df"/><ellipse cx="49" cy="17" rx="8" ry="19" fill="#73b4df"/><ellipse cx="25" cy="17" rx="4" ry="13" fill="#eeacb0"/><ellipse cx="49" cy="17" rx="4" ry="13" fill="#eeacb0"/>';
  if (who === "luna")
    extra =
      '<path d="M15 52C0 12 39 0 61 16L69 53 53 63Z" fill="#d6a1d1"/><path d="M20 44C8 11 39 5 58 20" fill="none" stroke="#f6d68b" stroke-width="7"/><path d="m33 22 5-22 7 23" fill="#e9b950"/>';
  if (who === "axel")
    extra =
      '<path d="m21 34-15-15m13 24L2 36m17 16L4 55m49-21 15-15M55 43l17-7M55 52l15 3" stroke="#e77da1" stroke-width="7" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 76 76" class="portrait" aria-hidden="true">${extra}<ellipse cx="38" cy="43" rx="24" ry="25" fill="${face}"/>${who === "maisie" ? '<path d="M14 37c1-34 43-31 48-3-9-1-15-12-18-14-2 12-17 14-30 17" fill="#794223"/><path d="m55 17 11-7v18l-11-6-7 6V11Z" fill="#b779b7"/>' : ""}<ellipse cx="29" cy="42" rx="4.5" ry="6" fill="${cat || who === "maisie" ? "#487349" : "#41638a"}"/><ellipse cx="47" cy="42" rx="4.5" ry="6" fill="${cat || who === "maisie" ? "#487349" : "#41638a"}"/><circle cx="30" cy="40" r="1.5" fill="white"/><circle cx="48" cy="40" r="1.5" fill="white"/><ellipse cx="23" cy="51" rx="4" ry="2" fill="#e6a1a0" opacity=".7"/><ellipse cx="53" cy="51" rx="4" ry="2" fill="#e6a1a0" opacity=".7"/><path d="M33 55q5 5 10 0" fill="none" stroke="#80524a" stroke-width="2" stroke-linecap="round"/>${cat ? '<path d="m35 49 3 3 3-3Z" fill="#c78491"/>' : ""}${who === "axel" ? '<path d="m31 67-8-6v13l15-6 15 6V61l-8 6Z" fill="#76aacb"/>' : ""}</svg>`;
}
