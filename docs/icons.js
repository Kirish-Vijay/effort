// Effort icon set: UI glyphs, currency badges and shop item art. Inline SVG strings, no assets.
// Icons.ui(name, {size})  -> 24x24 monochrome glyph (currentColor, second tone at .45 opacity)
// Icons.coin(size), Icons.gem(size) -> full-colour 64x64 currency badges
// Icons.item(itemOrId, size) -> full-colour 64x64 item art, motif chosen from an explicit id table
(function (root) {
"use strict";

const INK = "#0b1024";
const NS = 'xmlns="http://www.w3.org/2000/svg"';
// Defs ids are written as "§n" and given a fresh prefix every time an SVG is handed out, so two copies of
// one cached icon (or a second load of this file) never share an id and never borrow each other's clip paths.
let _n = 0, _inst = (Math.random() * 46656) | 0;
const nid = () => "§" + (++_n).toString(36);
const uniq = (s) => { const p = "e" + (++_inst).toString(36) + "_"; return s.replace(/§/g, p); };
const f = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Path helpers (shared)                                                */
/* ------------------------------------------------------------------ */
const C = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;
const E = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${rx} ${ry} 0 1 0 ${f(2 * rx)} 0a${rx} ${ry} 0 1 0 ${f(-2 * rx)} 0Z`;
const R = (x, y, w, h, r) => {
  r = Math.min(r || 0, w / 2, h / 2);
  if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return `M${f(x + r)} ${y}h${f(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${f(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${f(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
};
const Cap = (x1, y1, x2, y2, r) => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * r, ny = dx / l * r;
  return `M${f(x1 + nx)} ${f(y1 + ny)}A${r} ${r} 0 0 1 ${f(x1 - nx)} ${f(y1 - ny)}L${f(x2 - nx)} ${f(y2 - ny)}A${r} ${r} 0 0 1 ${f(x2 + nx)} ${f(y2 + ny)}Z`;
};
const starPts = (cx, cy, Ro, Ri, n, rot) => {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? Ri : Ro;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
};
const poly = (pts) => "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z";
const star = (cx, cy, Ro, Ri, n, rot) => poly(starPts(cx, cy, Ro, Ri, n || 5, rot == null ? -90 : rot));

/* ------------------------------------------------------------------ */
/* 1) UI glyphs: 24x24, currentColor, .45 second tone                   */
/* ------------------------------------------------------------------ */
const HT = ' opacity=".45"';
// solid path; o = half tone; rd = round the corners with a thin same-colour stroke
const p = (d, o, rd) => {
  const s = `<path d="${d}"${rd ? ` stroke="currentColor" stroke-width="${rd === true ? 1.4 : rd}" stroke-linejoin="round"` : ""}/>`;
  return o ? `<g${HT}>${s}</g>` : s;
};
const eo = (d, o) => `<path fill-rule="evenodd" d="${d}"${o ? HT : ""}/>`;
const sp = (d, w, o) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w || 2.4}" stroke-linecap="round" stroke-linejoin="round"${o ? HT : ""}/>`;
const ci = (cx, cy, r, o) => `<circle cx="${cx}" cy="${cy}" r="${r}"${o ? HT : ""}/>`;
const rr = R;
// footprint (pointing up, ~26 units tall, centred on 0,0), toes included as sub-paths
const FOOT = "M0 -5C4 -5 5.6 -1.6 5.2 2.4C4.8 5.8 3.6 7.6 3.6 10C3.6 12.4 2 13.8 0 13.8C-2.4 13.8 -4 12 -4 9.4C-4 6.4 -5.4 4 -5.6 .6C-5.8 -3 -3.4 -5 0 -5Z" +
  C(-3.6, -8.8, 2.3) + C(-.2, -10.4, 1.9) + C(2.9, -9.7, 1.65) + C(5.3, -7.7, 1.45) + C(6.7, -5, 1.25);
const halfStar = () => {
  const P = starPts(12, 12.8, 9.8, 4.3, 5, -90);
  // P[0]=top ... P[5]=bottom inner. right half = 0..5, left half = 5..9,0
  const right = poly(P.slice(0, 6)), left = poly([P[5], P[6], P[7], P[8], P[9], P[0]]);
  return p(right, 1, 1.6) + p(left, 0, 1.6);
};
const refresh = () => {
  const cx = 12, cy = 12, r = 7.4, a0 = 60, a1 = 325;
  const pt = (a) => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r];
  const s = pt(a0), e = pt(a1 - 8), t = a1 * Math.PI / 180;
  const tip = pt(a1), tx = -Math.sin(t), ty = Math.cos(t), nx = Math.cos(t), ny = Math.sin(t);
  const head = poly([[tip[0] + tx * 2.6, tip[1] + ty * 2.6], [tip[0] + nx * 3.4 - tx * 1.4, tip[1] + ny * 3.4 - ty * 1.4], [tip[0] - nx * 3.4 - tx * 1.4, tip[1] - ny * 3.4 - ty * 1.4]]);
  return sp(`M${f(s[0])} ${f(s[1])}A${r} ${r} 0 1 1 ${f(e[0])} ${f(e[1])}`, 2.6) + p(head, 0, 1.2);
};
const sword24 = "M20.2 3.8L19.2 6.8L9.8 16.2L7.8 14.2L17.2 4.8Z";
const swordParts = () => p(sword24, 0, 1) + sp("M6.2 13.2L10.8 17.8", 2.4) + sp("M8.6 15.4L5.8 18.2", 2.2) + ci(4.8, 19.2, 1.6);
const skull24 = "M12 3C7.7 3 4.5 6.1 4.5 10.3C4.5 12.9 5.8 14.9 7.6 16V18.6C7.6 19.7 8.4 20.6 9.5 20.6H14.5C15.6 20.6 16.4 19.7 16.4 18.6V16C18.2 14.9 19.5 12.9 19.5 10.3C19.5 6.1 16.3 3 12 3Z";
const leaf24 = "M12 10.4C10.2 9.2 8.3 7.5 8.3 5.6C8.3 4.2 9.3 3.2 10.5 3.2C11.2 3.2 11.7 3.5 12 4C12.3 3.5 12.8 3.2 13.5 3.2C14.7 3.2 15.7 4.2 15.7 5.6C15.7 7.5 13.8 9.2 12 10.4Z";
const speaker = "M3.5 9H7L12 4.6V19.4L7 15H3.5C2.9 15 2.5 14.6 2.5 14V10C2.5 9.4 2.9 9 3.5 9Z";
const band = (cy) => `M4 ${cy}A8 2.8 0 0 0 20 ${cy}V${f(cy + 2.4)}A8 2.8 0 0 1 4 ${f(cy + 2.4)}Z`;

const UI = {
  sword: () => p("M21 3L20.3 7.2L10.2 17.3L8.45 15.55Z", 1) + p("M21 3L8.45 15.55L6.7 13.8L16.8 3.7Z") +
    sp("M4.8 12.6L11.4 19.2", 2.8) + sp("M7.4 16.6L4.9 19.1", 2.4) + ci(3.9, 20.1, 1.7),
  raid: () => p("M7 9.6C4.3 9 2.5 6.8 2.6 3.1C3.9 5.2 5.9 6 8.7 7.2Z", 1, 1) + p("M17 9.6C19.7 9 21.5 6.8 21.4 3.1C20.1 5.2 18.1 6 15.3 7.2Z", 1, 1) +
    eo("M12 6.4C8.3 6.4 5.6 9 5.6 12.4C5.6 14.5 6.6 15.9 8 16.7V18.8C8 19.6 8.6 20.3 9.4 20.3H14.6C15.4 20.3 16 19.6 16 18.8V16.7C17.4 15.9 18.4 14.5 18.4 12.4C18.4 9 15.7 6.4 12 6.4Z" +
      "M7.9 11.5L11 12.5L10.5 14.6C8.9 14.9 7.7 13.6 7.9 11.5Z M16.1 11.5L13 12.5L13.5 14.6C15.1 14.9 16.3 13.6 16.1 11.5Z M12 15.3L11 17H13Z M10.6 18.3h.9v2.1h-.9Z M12.5 18.3h.9v2.1h-.9Z"),
  bag: () => sp("M8.8 11V7.6C8.8 5.8 10.2 4.3 12 4.3C13.8 4.3 15.2 5.8 15.2 7.6V11", 2) +
    p("M14.6 9H19L18 20C17.9 20.6 17.4 21 16.8 21H14Z", 1, 1) + p("M5 9H14.6L14 21H7.2C6.6 21 6.1 20.6 6 20Z", 0, 1),
  sliders: () => sp("M3 6H21M3 12H21M3 18H21", 2, 1) + sp("M3 6H15M3 12H8M3 18H13", 2) + ci(15, 6, 2.7) + ci(8, 12, 2.7) + ci(13, 18, 2.7),
  coin: () => eo(C(12, 12, 9.6) + C(12, 12, 7.3)) + ci(12, 12, 7.3, 1) + `<path transform="translate(12 12.9) scale(.38) rotate(10)" d="${FOOT}"/>`,
  gem: () => p("M2.5 9.5L7 4L9.4 9.5Z", 1) + p("M7 4H17L14.6 9.5H9.4Z") + p("M17 4L21.5 9.5H14.6Z", 1) +
    p("M2.5 9.5H9.4L12 21Z") + p("M9.4 9.5H14.6L12 21Z", 1) + p("M14.6 9.5H21.5L12 21Z"),
  star: halfStar,
  xp: () => p(rr(2, 4, 20, 16, 4), 1) + sp("M5.8 8.2L10.2 15.8M10.2 8.2L5.8 15.8", 2.4) +
    sp("M13.6 15.8V8.2H16.6C18.1 8.2 19.1 9.2 19.1 10.6C19.1 12 18.1 13 16.6 13H13.6", 2.4),
  power: () => p("M5.2 10H18.6V15.4C18.6 18.4 16.4 20.6 13.4 20.6H10.4C7.5 20.6 5.2 18.3 5.2 15.4Z", 1) +
    p(rr(5.2, 4.6, 3, 6.8, 1.5)) + p(rr(8.6, 3.6, 3, 7.8, 1.5)) + p(rr(12, 3.6, 3, 7.8, 1.5)) + p(rr(15.4, 4.6, 3, 6.8, 1.5)) +
    p("M5.2 12.6H13.2C14.3 12.6 15.2 13.5 15.2 14.6C15.2 15.7 14.3 16.6 13.2 16.6H5.2Z"),
  guard: () => p("M12 2.5V21.5C7.2 19.8 4 16.3 4 11.5V5.5Z", 0, 1) + p("M12 2.5L20 5.5V11.5C20 16.3 16.8 19.8 12 21.5Z", 1, 1),
  speed: () => p("M9 7.6C6.4 7.2 4 5.8 2.4 3.6C2.3 5.6 3 7.3 4.3 8.5C3.5 8.8 2.7 8.8 2 8.6C2.7 10.4 4.1 11.5 5.8 11.7C5.2 12.1 4.5 12.4 3.7 12.4C4.8 13.9 6.8 14.3 9 13.6Z", 1, 1) +
    p("M10 4H14.4V11.4L18.6 13C20.3 13.7 21.4 15.1 21.4 16.8V17.2H9V5C9 4.4 9.4 4 10 4Z", 0, 1) + p(rr(9, 18, 12.4, 2.6, 1.2)),
  brains: () => p("M12 2.8C8.4 2.8 5.6 5.6 5.6 9.2C5.6 11.5 6.8 13.3 8.4 14.5C8.9 14.9 9.2 15.5 9.2 16.1V16.8H14.8V16.1C14.8 15.5 15.1 14.9 15.6 14.5C17.2 13.3 18.4 11.5 18.4 9.2C18.4 5.6 15.6 2.8 12 2.8Z", 1) +
    p("M12.9 5.2L9.3 10.6H12L11.1 14.6L14.8 9H12.3Z", 0, 1) + p(rr(9.2, 17.5, 5.6, 1.7, .85)) + p("M10.2 19.9H13.8C13.8 20.9 13 21.6 12 21.6C11 21.6 10.2 20.9 10.2 19.9Z") +
    sp("M2.6 4.4L4 5.6M21.4 4.4L20 5.6M2.4 10.2H3.6M20.4 10.2H21.6", 1.6),
  luck: () => sp("M12 12C12.5 15.4 13.8 18.4 16.6 21", 1.9) +
    [0, 90, 180, 270].map((a) => `<path d="${leaf24}" transform="rotate(${a} 12 10.4)"/>`).join("") + ci(12, 10.4, 1.3, 1),
  shieldWall: () => p("M3.5 4C3.5 3.4 3.9 3 4.5 3H9.2V21.2C5.8 20.2 3.5 17.8 3.5 14.6Z", 0, 1) + p("M9.2 3H14C14.6 3 15 3.4 15 4V14.6C15 17.8 12.6 20.2 9.2 21.2Z", 1, 1) +
    p("M19 2Q19.4 4.6 22 5Q19.4 5.4 19 8Q18.6 5.4 16 5Q18.6 4.6 19 2Z", 0, .8) + p("M19.4 9.8Q19.6 11.4 21.2 11.6Q19.6 11.8 19.4 13.4Q19.2 11.8 17.6 11.6Q19.2 11.4 19.4 9.8Z", 1, .6),
  bigSwing: () => p(star(12, 11, 10.6, 6.2, 12, -90), 1, 1) + `<g transform="matrix(-1 0 0 1 24 0)">${swordParts()}</g>` + swordParts(),
  patchUp: () => p("M7.7 6.5H13.3V10.7H17.5V16.3H13.3V20.5H7.7V16.3H3.5V10.7H7.7Z", 0, 1.6) +
    sp("M19 2.4V7.6M16.4 5H21.6", 1.9) + sp("M20.2 10.8V14.2M18.5 12.5H21.9", 1.6, 1),
  clock: () => eo(C(12, 12, 9.6) + C(12, 12, 7.4)) + ci(12, 12, 7.4, 1) + sp("M12 7.4V12L15.2 14", 2.2) + ci(12, 12, 1.4),
  crown: () => p("M3.4 8.6L8 12.4L12 5.6L16 12.4L20.6 8.6L19 17.4H5Z", 0, 1.4) + ci(3.2, 7.6, 1.6) + ci(12, 4.3, 1.7) + ci(20.8, 7.6, 1.6) + p(rr(5, 18.6, 14, 2.6, 1.2), 1),
  lock: () => sp("M8 10.5V8C8 5.8 9.8 4 12 4C14.2 4 16 5.8 16 8V10.5", 2.4, 1) +
    eo(rr(5, 10, 14, 11.5, 2.6) + "M12 13C11.1 13 10.3 13.8 10.3 14.7C10.3 15.3 10.6 15.8 11.1 16.1L10.7 18.4H13.3L12.9 16.1C13.4 15.8 13.7 15.3 13.7 14.7C13.7 13.8 12.9 13 12 13Z"),
  check: () => sp("M4.5 12.8L9.6 17.8L19.6 6.8", 3.2),
  close: () => sp("M6 6L18 18M18 6L6 18", 3.2),
  soundOn: () => p(speaker, 0, 1) + sp("M15.4 9C16.3 9.8 16.8 10.9 16.8 12C16.8 13.1 16.3 14.2 15.4 15", 2.2) +
    sp("M18.2 6.2C19.8 7.7 20.8 9.8 20.8 12C20.8 14.2 19.8 16.3 18.2 17.8", 2.2, 1),
  soundOff: () => p(speaker, 0, 1) + sp("M15.6 9.4L20.8 14.6M20.8 9.4L15.6 14.6", 2.4),
  steps: () => `<path${HT} transform="translate(8.2 15) rotate(-12) scale(-.42 .42)" d="${FOOT}"/><path transform="translate(15.8 9.2) rotate(12) scale(.42)" d="${FOOT}"/>`,
  phone: () => eo(rr(6, 2.5, 12, 19, 2.8) + rr(7.8, 5.4, 8.4, 11.8, 1) + rr(10.5, 3.5, 3, .9, .45) + rr(10.4, 18.8, 3.2, 1.2, .6)) + p(rr(7.8, 5.4, 8.4, 11.8, 1), 1),
  trophy: () => sp("M7 5.6H5.2C4.2 5.6 3.6 6.3 3.6 7.3C3.6 9.2 5 10.7 7.3 11M17 5.6H18.8C19.8 5.6 20.4 6.3 20.4 7.3C20.4 9.2 19 10.7 16.7 11", 1.8) +
    p("M7 3.5H13.4V14.3C9.9 14.1 7 11.9 7 9Z", 0, 1) + p("M13.4 3.5H17V9C17 11.7 15.4 13.8 13.4 14.3Z", 1, 1) +
    p("M10.8 14H13.2L13.6 17.4H10.4Z") + p(rr(7, 17.6, 10, 3.4, 1.2)),
  chest: () => p("M3 10V8.2C3 5.8 5 3.8 7.4 3.8H16.6C19 3.8 21 5.8 21 8.2V10Z", 0, 1) +
    p("M3 11.2H21V19C21 19.8 20.4 20.4 19.6 20.4H4.4C3.6 20.4 3 19.8 3 19Z", 1, 1) +
    p(rr(5.8, 11.2, 2, 9.2, 0)) + p(rr(16.2, 11.2, 2, 9.2, 0)) + eo(rr(9.9, 8.8, 4.2, 6, 1.2) + C(12, 11.6, .95)),
  fire: () => eo("M12 2.4C12.7 5.6 15 7.2 16.6 9.4C17.8 11.1 18.5 12.8 18.5 14.7C18.5 18.4 15.6 21.4 12 21.4C8.4 21.4 5.5 18.4 5.5 14.8C5.5 12.6 6.5 10.6 8.2 9.2C8.2 11 9 12.3 10.2 12.8C9.6 9 10.4 5.4 12 2.4Z" +
    "M12 11.4C13 13 15.1 14.2 15.1 16.6C15.1 18.4 13.7 19.8 12 19.8C10.3 19.8 8.9 18.4 8.9 16.6C8.9 15 9.9 13.9 10.6 12.8C11 13.7 11.4 14 12 14.2C11.8 13.2 11.6 12.3 12 11.4Z") +
    p("M12 11.4C13 13 15.1 14.2 15.1 16.6C15.1 18.4 13.7 19.8 12 19.8C10.3 19.8 8.9 18.4 8.9 16.6C8.9 15 9.9 13.9 10.6 12.8C11 13.7 11.4 14 12 14.2C11.8 13.2 11.6 12.3 12 11.4Z", 1),
  bolt: () => p("M13.6 2.2L5.2 13.6H11.2L10 21.8L18.8 10H12.8Z", 1, 1.4) + p("M13.6 2.2L5.2 13.6H11.2L12.8 10Z", 0, 1.4) + p("M10 21.8L18.8 10H12.8L11.2 13.6Z", 0, 1.4),
  heart: () => eo("M12 20.5C12 20.5 3 15 3 8.6C3 5.8 5.2 3.6 7.9 3.6C9.6 3.6 11.1 4.5 12 5.8C12.9 4.5 14.4 3.6 16.1 3.6C18.8 3.6 21 5.8 21 8.6C21 15 12 20.5 12 20.5Z" + E(7.9, 8.1, 1.5, 1.5)),
  arrowRight: () => sp("M4 12H19M13 6L19 12L13 18", 2.8),
  chevronLeft: () => sp("M15 5L8 12L15 19", 3),
  plus: () => sp("M12 5V19M5 12H19", 3),
  eye: () => p("M1.8 12C4.3 7.3 7.9 5 12 5C16.1 5 19.7 7.3 22.2 12C19.7 16.7 16.1 19 12 19C7.9 19 4.3 16.7 1.8 12Z", 1) + eo(C(12, 12, 4.4) + C(12, 12, 1.7)) + ci(13.6, 10.4, .9),
  warning: () => eo("M10.3 3.9C11.1 2.6 12.9 2.6 13.7 3.9L21.7 17.7C22.5 19 21.5 20.7 20 20.7H4C2.5 20.7 1.5 19 2.3 17.7Z" + "M11 8.6H13L12.7 14.4H11.3Z" + C(12, 17.2, 1.15)),
  receipt: () => eo("M5 2.5H19V21.5L16.7 20L14.3 21.5L12 20L9.7 21.5L7.3 20L5 21.5Z" + rr(8, 6, 8, 1.8, .9) + rr(8, 9.8, 8, 1.8, .9) + rr(8, 13.6, 4.6, 1.8, .9)) + p(rr(13.8, 13.6, 2.4, 1.8, .9), 1),
  target: () => eo(C(12, 12, 9.6) + C(12, 12, 7.4)) + ci(12, 12, 5.6, 1) + ci(12, 12, 2.5),
  refresh,
  squad: () => ci(5.4, 8.8, 2.6, 1) + ci(18.6, 8.8, 2.6, 1) +
    p("M1.4 18.8C1.4 15.3 3.2 13 5.6 13C6.8 13 7.8 13.5 8.6 14.4C7.4 15.6 6.6 17.2 6.4 18.8Z", 1) +
    p("M22.6 18.8C22.6 15.3 20.8 13 18.4 13C17.2 13 16.2 13.5 15.4 14.4C16.6 15.6 17.4 17.2 17.6 18.8Z", 1) +
    ci(12, 7.6, 3.5) + p("M6 20.6C6 16.4 8.7 13.4 12 13.4C15.3 13.4 18 16.4 18 20.6Z", 0, 1),
  flag: () => sp("M5.5 21V3.2", 2.2) + p("M6.6 4C9.4 2.8 11.6 5.2 14.4 4.3C16 3.8 17.6 3.6 19.6 4.2L17.6 8.6L19.6 13C17.6 12.5 16 12.6 14.4 13.1C11.6 14 9.4 11.6 6.6 12.8Z", 0, 1.2) +
    p("M14.4 4.3C16 3.8 17.6 3.6 19.6 4.2L17.6 8.6L19.6 13C17.6 12.5 16 12.6 14.4 13.1Z", 1),
  skull: () => eo(skull24 + C(8.9, 11, 2.2) + C(15.1, 11, 2.2) + "M12 13.8L10.9 16H13.1Z M10.4 18.2H11.3V20.6H10.4Z M12.7 18.2H13.6V20.6H12.7Z"),
  ladder: () => sp("M7 6.4H17M7 10.8H17M7 15.2H17M7 19.6H17", 2.2, 1) + sp("M7 2.6V21.4M17 2.6V21.4", 2.4),
  coins: () => `<path d="${E(12, 6.4, 8, 2.8)}"${HT}/>` + [6.4, 9.6, 12.8, 16].map((y) => `<path d="${band(y)}"/>`).join(""),
  back: () => sp("M19.5 12H5M11 5.5L4.5 12L11 18.5", 2.8),
  upgrade: () => p("M12 3L19 10.4H15.2V14H8.8V10.4H5Z", 0, 1.4) + p(rr(8.8, 15.6, 6.4, 2.2, 1.1), 1) + p(rr(8.8, 19.2, 6.4, 2.2, 1.1), 1),
  info: () => eo(C(12, 12, 9.6) + C(12, 7.4, 1.4) + rr(10.8, 10.2, 2.4, 7.6, 1.2)),
  // App chrome: calendar reminders, copy/share links, profile, edit, sign out.
  fingerprint: () => sp("M5.6 9.4C6.9 6.2 9.2 4.6 12 4.6C16 4.6 18.8 7.6 18.8 11.6", 2) + sp("M8.2 18.6C7.6 17 7.4 15.4 7.4 13.4C7.4 10.6 9.4 8.6 12 8.6C14.6 8.6 16.4 10.6 16.4 13.2C16.4 14.4 16.6 15.6 17 16.6", 2, 1) +
    sp("M12 12.4C12 15.4 12.6 18 13.8 20.2", 2) + sp("M4.6 14.2C4.4 13.4 4.4 12.6 4.6 11.8M19 15.6C18.9 16.6 18.7 17.6 18.4 18.4M10.4 20.6C9.6 18.6 9.4 16.4 9.6 13.8", 2, 1),
  mail: () => p(rr(2.8, 5, 18.4, 14, 2.4), 1) + sp("M4 7L12 13L20 7", 2.4) + eo(rr(2.8, 5, 18.4, 14, 2.4) + rr(4.6, 6.8, 14.8, 10.4, 1)),
  chat: () => p("M4.6 4.2H19.4C20.6 4.2 21.6 5.2 21.6 6.4V15.4C21.6 16.6 20.6 17.6 19.4 17.6H11.2L6.6 21.2V17.6H4.6C3.4 17.6 2.4 16.6 2.4 15.4V6.4C2.4 5.2 3.4 4.2 4.6 4.2Z", 1, true) + sp("M7 9.4H17M7 12.8H13.4", 2.2),
  bell: () => p("M12 2.6C8.4 2.6 6 5.3 6 8.8V12.6L4.2 15.6C3.8 16.3 4.3 17.2 5.1 17.2H18.9C19.7 17.2 20.2 16.3 19.8 15.6L18 12.6V8.8C18 5.3 15.6 2.6 12 2.6Z", 1) +
    p("M9.2 18.6H14.8C14.8 20.2 13.5 21.4 12 21.4C10.5 21.4 9.2 20.2 9.2 18.6Z") + sp("M8.6 8.4C8.8 6.8 10 5.6 11.6 5.4", 1.8),
  calendar: () => p(rr(3.4, 5, 17.2, 15.6, 2.4), 1) + eo(rr(3.4, 5, 17.2, 15.6, 2.4) + rr(5.4, 10, 13.2, 8.6, 1)) +
    p(rr(7, 2.6, 2.4, 5, 1.2)) + p(rr(14.6, 2.6, 2.4, 5, 1.2)) + p(rr(7.4, 12, 3, 2.6, .6)) + p(rr(13.6, 15, 3, 2.6, .6), 1),
  copy: () => p(rr(8.6, 8.6, 12, 12.6, 2.2)) + eo(rr(3.4, 2.8, 12, 12.6, 2.2) + rr(5.4, 4.8, 8, 8.6, 1), 1),
  share: () => ci(17.6, 5.6, 3) + ci(6.4, 12, 3) + ci(17.6, 18.4, 3) + sp("M9 10.5L15 7.1M9 13.5L15 16.9", 2.2, 1),
  link: () => sp("M10.4 13.6A4 4 0 0 0 16.1 13.6L19 10.7A4 4 0 0 0 13.3 5L11.9 6.4", 2.6) + sp("M13.6 10.4A4 4 0 0 0 7.9 10.4L5 13.3A4 4 0 0 0 10.7 19L12.1 17.6", 2.6, 1),
  user: () => ci(12, 8, 4.4) + p("M3.8 20.4C4.6 16 7.9 13.6 12 13.6C16.1 13.6 19.4 16 20.2 20.4C20.3 21 19.9 21.4 19.3 21.4H4.7C4.1 21.4 3.7 21 3.8 20.4Z", 1),
  edit: () => p("M15.6 3.8L20.2 8.4L9.4 19.2L3.6 20.4L4.8 14.6Z", 1) + p("M15.6 3.8L17.4 2C18 1.4 19 1.4 19.6 2L22 4.4C22.6 5 22.6 6 22 6.6L20.2 8.4Z") + sp("M13.4 6L18 10.6", 1.8),
  trash: () => p(rr(3.4, 5, 17.2, 2.8, 1.2)) + p(rr(9.2, 2.4, 5.6, 3.2, 1.2)) +
    p("M5.4 8.8H18.6L17.5 20C17.4 21 16.6 21.6 15.7 21.6H8.3C7.4 21.6 6.6 21 6.5 20Z", 1) + sp("M10 11.8V18.4M14 11.8V18.4", 1.8),
  door: () => p("M4 3.4H13.6V20.6H4Z", 1) + eo("M4 3.4H13.6V20.6H4Z" + C(10.8, 12.2, 1.1)) + sp("M16 12H21.4M18.6 9L21.6 12L18.6 15", 2.4),
  gift: () => p(rr(4.4, 13.2, 15.2, 8.2, 1.2), 1) + p(rr(10.8, 13.2, 2.4, 8.2, 0)) +
    eo(rr(3, 7.6, 18, 4.4, 1.2) + rr(10.8, 7.6, 2.4, 4.4, 0)) +
    p("M12 7.6C10.6 4.2 6.8 3.3 6.6 5.6C6.5 7 8.6 7.6 12 7.6Z", 0, 1) + p("M12 7.6C13.4 4.2 17.2 3.3 17.4 5.6C17.5 7 15.4 7.6 12 7.6Z", 0, 1),
  timer: () => p(rr(5, 2.4, 14, 2.4, 1.2)) + p(rr(5, 19.2, 14, 2.4, 1.2)) +
    p("M7 4.8H17C17 8.6 14.6 10.6 13 12C14.6 13.4 17 15.4 17 19.2H7C7 15.4 9.4 13.4 11 12C9.4 10.6 7 8.6 7 4.8Z", 1) +
    p("M9.2 7.2H14.8C14.4 8.8 13.3 9.8 12 10.6C10.7 9.8 9.6 8.8 9.2 7.2Z") + p("M8.6 18.2C9 16.2 10.6 15 12 14.8C13.4 15 15 16.2 15.4 18.2Z") + sp("M12 10.6V15", 1.1),
};
const uiCache = {};
function ui(name, opts) {
  const fn = UI[name];
  if (!fn) return "";
  const size = (opts && opts.size) || 24;
  const body = uiCache[name] || (uiCache[name] = fn());
  return `<svg ${NS} viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;
}

/* ------------------------------------------------------------------ */
/* 2) Item art kit (64x64): flat base + cel shadow + rim highlight       */
/* ------------------------------------------------------------------ */
const pal = (b, s, h) => ({ b, s, h });
const P = {
  wood: pal("#c98a4b", "#8f5a2c", "#f2c88f"),
  dwood: pal("#7a4f2e", "#52331c", "#a8774c"),
  metal: pal("#c9d3e3", "#8090aa", "#ffffff"),
  dmetal: pal("#6c7792", "#454e69", "#a9b4cc"),
  gold: pal("#ffc83d", "#e08a1e", "#fff3a8"),
  paper: pal("#f6f0e0", "#cdbf9f", "#ffffff"),
  glass: pal("#c4efff", "#7cc6ea", "#ffffff"),
  dark: pal("#363f63", "#222944", "#5f6b98"),
  rubber: pal("#2e3450", "#1b1f33", "#555e85"),
  skin: pal("#ffc79e", "#e0946a", "#ffe6d0"),
  white: pal("#f3f6fd", "#aeb8d0", "#ffffff"),
  grey: pal("#9ba7be", "#66718b", "#d5dcea"),
  greyD: pal("#7c879f", "#56607a", "#b4bdd0"),
  oat: pal("#e0aa5e", "#a8702e", "#f7d79f"),
  meat: pal("#9a5530", "#63311a", "#c98256"),
  pink: pal("#ff9cc0", "#d9668f", "#ffd3e3"),
  lcd: pal("#a6eb8f", "#5fae55", "#e3ffd6"),
};
const T = {
  red: pal("#ff4d5e", "#c42a45", "#ff9ca4"),
  orange: pal("#ff8a2b", "#d2561b", "#ffc27a"),
  yellow: pal("#ffd23d", "#e39b1b", "#fff3a0"),
  mustard: pal("#e0a72e", "#a8701a", "#f7d277"),
  lime: pal("#c6f03a", "#86b51d", "#f0ffa3"),
  green: pal("#45d483", "#22955a", "#a6f5c4"),
  teal: pal("#2fc7b4", "#178a86", "#93f2e3"),
  cyan: pal("#4cc3ff", "#2380d6", "#b8ecff"),
  blue: pal("#4a7dff", "#2b4cc2", "#9fbcff"),
  purple: pal("#9b5de5", "#6538ad", "#cfaaff"),
  pink: pal("#ff6fb0", "#cc3f82", "#ffb8d8"),
  brown: pal("#a86a3c", "#6f4122", "#d9a06c"),
  tan: pal("#d9a35c", "#a26b30", "#f6d49c"),
  steel: pal("#a9b5c9", "#6d7a95", "#e9eef7"),
  stone: pal("#a3a49b", "#6b6c64", "#d6d6cd"),
  black: pal("#4a5479", "#2a3052", "#8c99c8"),
  white: pal("#eef2fb", "#a9b3cb", "#ffffff"),
  cream: pal("#f3e3c3", "#c9ad80", "#fff8e8"),
  gold: pal("#ffc83d", "#e08a1e", "#fff3a8"),
};
const TINT_ORDER = ["red", "orange", "yellow", "lime", "green", "teal", "cyan", "blue", "purple", "pink", "brown", "steel"];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const dk = (q) => pal(q.s, mix(q.s, INK, .35), q.b); // the "side face" palette of a colour
const luma = (h) => { const [r, g, b] = hex(h); return (.2126 * r + .7152 * g + .0722 * b) / 255; };

// Shaded shape: base fill, optional clipped inner detail, cel shadow (bottom-right), rim light (top-left), ink outline.
function S(d, q, o) {
  o = o || {};
  const a = o.a == null ? 4 : o.a, b = o.b == null ? 2.6 : o.b;
  const [ax, ay] = typeof a === "number" ? [a, a] : a, [bx, by] = typeof b === "number" ? [b, b] : b;
  const ev = o.ev ? ' fill-rule="evenodd" clip-rule="evenodd"' : "";
  const k = nid();
  let s = `<clipPath id="${k}"><path d="${d}"${ev}/></clipPath><path d="${d}" fill="${q.b}"${ev}/><g clip-path="url(#${k})">${o.inner || ""}`;
  if (ax || ay) {
    const m = nid();
    s += `<mask id="${m}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="144" height="144"><rect x="-40" y="-40" width="144" height="144" fill="#fff"/><path d="${d}"${ev} fill="#000" transform="translate(${-ax} ${-ay})"/></mask>` +
      `<rect x="-40" y="-40" width="144" height="144" fill="${o.ink ? INK : q.s}"${o.ink ? ' opacity=".24"' : ""} mask="url(#${m})"/>`;
  }
  if (bx || by) s += `<path d="${d}" fill="none" stroke="${q.h}" stroke-width="${o.hw || 2}" stroke-linejoin="round" opacity="${o.ho || .9}" transform="translate(${bx} ${by})"/>`;
  // Dark fills get a 1.5u lighter rim inside the ink line, so a black object never melts into its outline.
  if (!o.norim && luma(q.b) < .3) s += `<path d="${d}" fill="none" stroke="${mix(q.b, "#ffffff", .38)}" stroke-width="3" stroke-linejoin="round" opacity=".8"/>`;
  return s + `</g><path d="${d}" fill="none" stroke="${INK}" stroke-width="${o.sw || 2.5}" stroke-linejoin="round"${ev}/>`;
}
const F = (d, fill, sw, op) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw || 2.5}" stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ""}/>`;
const L = (d, col, w, op, extra) => `<path d="${d}" fill="none" stroke="${col || INK}" stroke-width="${w || 2}"${extra && extra.includes("linecap") ? "" : ' stroke-linecap="round"'} stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ""}${extra || ""}/>`;
const TL = (d, col, w) => L(d, INK, w + 3) + L(d, col, w); // outlined thick line
const Gl = (cx, cy, rx, ry, r, op) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op || .8}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ""}/>`;
const Sp = (cx, cy, r, col) => `<path d="M${cx} ${cy - r}Q${f(cx + r * .18)} ${f(cy - r * .18)} ${cx + r} ${cy}Q${f(cx + r * .18)} ${f(cy + r * .18)} ${cx} ${cy + r}Q${f(cx - r * .18)} ${f(cy + r * .18)} ${cx - r} ${cy}Q${f(cx - r * .18)} ${f(cy - r * .18)} ${cx} ${cy - r}Z" fill="${col || "#fff"}"/>`;
const G = (t, s) => `<g transform="${t}">${s}</g>`;
const rot = (s, a) => G(`rotate(${a} 32 32)`, s);
const fill = (d, col, op) => `<path d="${d}" fill="${col}"${op != null ? ` opacity="${op}"` : ""}/>`;
const glow = (cx, cy, r, col, op) => {
  const g = nid();
  return `<radialGradient id="${g}"><stop offset="0" stop-color="${col}" stop-opacity="${Math.min(1, (op || .3) * 2.4)}"/><stop offset=".55" stop-color="${col}" stop-opacity="${op || .3}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})"/>`;
};
const drop = (cx, cy, s) => `M${cx} ${cy - 4 * s}C${f(cx + 2.6 * s)} ${f(cy - .6 * s)} ${f(cx + 3 * s)} ${f(cy + .8 * s)} ${f(cx + 3 * s)} ${f(cy + 1.6 * s)}C${f(cx + 3 * s)} ${f(cy + 3.3 * s)} ${f(cx + 1.6 * s)} ${f(cy + 4.6 * s)} ${cx} ${f(cy + 4.6 * s)}C${f(cx - 1.6 * s)} ${f(cy + 4.6 * s)} ${f(cx - 3 * s)} ${f(cy + 3.3 * s)} ${f(cx - 3 * s)} ${f(cy + 1.6 * s)}C${f(cx - 3 * s)} ${f(cy + .8 * s)} ${f(cx - 2.6 * s)} ${f(cy - .6 * s)} ${cx} ${cy - 4 * s}Z`;
const leaf64 = "M32 30C27 27 22 22.4 22 17.4C22 13.4 24.8 10.6 28 10.6C29.8 10.6 31.2 11.4 32 12.8C32.8 11.4 34.2 10.6 36 10.6C39.2 10.6 42 13.4 42 17.4C42 22.4 37 27 32 30Z";
// Printed words and numbers on objects (STOP, £1, 77). Heavy system sans, nothing downloaded.
const Tx = (x, y, s, size, col, o) => {
  o = o || {};
  return `<text x="${x}" y="${y}" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${size}" text-anchor="${o.anchor || "middle"}" fill="${col || INK}"` +
    (o.ls ? ` letter-spacing="${o.ls}"` : "") + (o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : "") +
    (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}" paint-order="stroke" stroke-linejoin="round"` : "") + `>${s}</text>`;
};
const op = (s, o) => `<g opacity="${o}">${s}</g>`;
const at = (x, y, s, body) => G(`translate(${x} ${y}) scale(${s})`, body);
const dots = (pts, r, col, sw) => pts.map(([x, y]) => F(C(x, y, r), col, sw || 1.2)).join("");
const ring = (cx, cy, r, col, w, op2) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="${w + 3}"${op2 ? ` opacity="${op2}"` : ""}/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
const crescent = (cx, cy, r) => `M${f(cx + r * .5)} ${f(cy - r * .866)}A${r} ${r} 0 1 0 ${f(cx + r * .5)} ${f(cy + r * .866)}A${f(r * .9)} ${f(r * .9)} 0 0 1 ${f(cx + r * .5)} ${f(cy - r * .866)}Z`;
const cloudD = (x, y, s) => `M${x - 9 * s} ${y + 4 * s}C${x - 13 * s} ${y + 4 * s} ${x - 13 * s} ${y - 3 * s} ${x - 8 * s} ${y - 2.6 * s}C${x - 8 * s} ${y - 8 * s} ${x - 1 * s} ${y - 9 * s} ${x + 1 * s} ${y - 5 * s}C${x + 4 * s} ${y - 8 * s} ${x + 10 * s} ${y - 6 * s} ${x + 9 * s} ${y - 1 * s}C${x + 13 * s} ${y - 1 * s} ${x + 13 * s} ${y + 4 * s} ${x + 9 * s} ${y + 4 * s}Z`;

/* ------------------------------------------------------------------ */
/* Motifs. Each: (m = tint palette, v = variant) -> svg markup (64 grid) */
/* ------------------------------------------------------------------ */
const M = {
  blade: (m) => rot(
    S("M32 4L38.5 12V39H25.5V12Z", P.metal, { a: [3.5, 0], b: [2, 1], inner: L("M32 10V36", P.metal.s, 2, .7) }) +
    S(R(19, 38, 26, 6, 3), P.gold, { a: [0, 2], b: [1.4, 1.4] }) +
    S(R(28.5, 44, 7, 11, 2), m, { a: [2, 0], b: [1.2, 0], inner: L("M28 47.5H36M28 51H36", m.s, 1.6) }) +
    S(C(32, 58, 3.6), P.gold, { a: 1.4, b: 1 }), 45),


  umbrella: (m) => rot(
    S(R(30.4, 28, 3.2, 24, 1.6), P.dmetal, { a: [1, 0], b: 0 }) +
    TL("M32 50V54C32 58.5 36.5 60 39.5 57.6C41 56.4 41 54.4 40 53.2", P.dwood.b, 4) +
    S("M7 30C7 16 18.2 7.5 32 7.5C45.8 7.5 57 16 57 30Q50.75 25 44.5 30Q38.25 25 32 30Q25.75 25 19.5 30Q13.25 25 7 30Z", m, {
      a: [3, 4], b: 2.6,
      inner: fill("M32 7.5C38.5 14 42.5 22 44.5 30Q38.25 25 32 30Z M32 7.5C25.5 14 21.5 22 19.5 30Q13.25 25 7 30C7 18 18 8 32 7.5Z", m.s, .35) +
        L("M32 7.5C26 14 21.5 22 19.5 30M32 7.5V30M32 7.5C38 14 42.5 22 44.5 30", INK, 1.8, .55),
    }) + S(C(32, 6.5, 2.4), P.dmetal, { a: 1, b: 0 }) +
    S(drop(13, 41, 1.05), T.cyan, { a: 1.2, b: .8, hw: 1.2, sw: 2 }) + S(drop(51, 44, .85), T.cyan, { a: 1, b: .7, hw: 1, sw: 2 }), -15),


  plank: (m, v) => lay(
    S("M23 3L32 -6L41 3V60Q41 64 37 64H27Q23 64 23 60Z", m, { a: [4.4, 1.5], b: [2, 0], inner: L("M28 8C29.6 22 27 34 29 48M36 12C35 26 37 40 35.4 58", m.s, 1.8, .8) + F(E(31.4, 34, 2.2, 3.6), m.s, 1.6) + L("M23 30H41", m.s, 1.2, .4) }) +
    F(C(27.6, 54, 1.9), P.metal.b, 1.6) + F(C(36.4, 54, 1.9), P.metal.b, 1.6) + F(C(27.6, 12, 1.9), P.metal.b, 1.6) + TL("M40.5 24H47.5L50.5 19", P.metal.b, 2.4)),

  clipboard: (m, v) => rot(
    S(R(12, 9, 40, 50, 5), m, { a: 3.5 }) +
    S(R(17, 16, 30, 38, 2), P.paper, { a: 2.5, b: 1.6 }) +
    (v === "eye" ? at(32, 30, 1.6, EMB.eye()) + [44, 50].map((y) => L(`M21 ${y}H43`, INK, 2, .25) + L(`M20 ${y}H44`, "#ff4d5e", 1.6)).join("")
      : [24, 32, 40, 48].map((y) => F(R(21, y - 3, 5, 5, 1), "#fff", 1.6) + L(`M30 ${y - .5}H43`, INK, 2.2, .25) + L(`M21.9 ${y - 2.1}L25.1 ${y + 1.1}M25.1 ${y - 2.1}L21.9 ${y + 1.1}`, "#ff4d5e", 1.9)).join("")) +
    F(C(32, 5.6, 3.6), P.metal.b, 2) + `<circle cx="32" cy="5.6" r="1.4" fill="${INK}"/>` +
    S("M23 6.5H41V13Q41 16 38 16H26Q23 16 23 13Z", P.metal, { a: 2, b: 1.4 }), -6),

  rope: (m) => {
    const d = "M14 52C3 41 15 27 30 33C45 39 57 29 48 16";
    return L(d, INK, 13) + L(d, m.s, 8) + L(d, m.b, 5.4, null, ' transform="translate(-.8 -.8)"') + L(d, m.h, 1.6, .7, ' transform="translate(-2 -2)"') +
      L(d, INK, 8, .28, ' stroke-dasharray="1.6 4.4" stroke-linecap="butt"') +
      TL("M48 13C47 7 53 4 56.5 8C59 11 56.5 15 53.5 13.5", P.gold.b, 2.6) +
      S(C(48, 17, 5.2), P.gold, { a: 1.6, b: 1.2 }) + S(C(14, 52, 5.2), P.gold, { a: 1.6, b: 1.2 }) +
      TL("M14 57V61M11 56.5L9.5 60.5M17 56.5L18.5 60.5", m.b, 1.6);
  },

  bell: (m, v) =>
    (v === "bracket" ? S(R(2, 0, 7, 20, 2), P.dwood, { a: [1.4, 0], b: 0 }) + TL("M8 6H32V11", P.dmetal.b, 2.4) + TL("M38 52C44 56 42 62 48 62", "#e8dcae", 1.8) : S(R(27, 2.5, 10, 9, 3), P.dwood, { a: 1.5, b: 1 })) +
    S(C(32, 57, 4.5), P.dmetal, { a: 1.5, b: 1 }) +
    S("M32 9C22.5 9 18.5 17 18.5 28C18.5 38 15 44 10.5 48H53.5C49 44 45.5 38 45.5 28C45.5 17 41.5 9 32 9Z", m, { a: [5, 2], b: 3, inner: L("M18 37H46", m.s, 2.2, .6) + (v === "drowned" ? F(C(24, 30, 1.6), "#d7d3c0", 1) + F(C(40, 22, 1.2), "#d7d3c0", 1) + F(C(37, 40, 1.4), "#d7d3c0", 1) + fill("M0 40H64V64H0Z", "#2fc7b4", .25) : "") }) +
    S(R(8, 46, 48, 8, 4), dk(m), { a: [0, 2], b: [0, 1.5] }) + Gl(25.5, 22, 2.4, 7, 15, .75) +
    (v === "drowned" ? TL("M20 46C18 38 22 34 19 26", T.green.b, 2) + TL("M44 46C47 40 43 36 46 30", T.green.b, 2) + OV.waves() :
      L("M10 22C7 26 7 32 9 36M54 22C57 26 57 32 55 36", INK, 2.6) + L("M5 18C1.5 24 1.5 34 4 40M59 18C62.5 24 62.5 34 60 40", INK, 2.2, .5)),

  scooter: (m, v) => {
    let out = "";
    if (v === "comet") out += fill("M10 42C2 34 0 24 2 16C8 26 16 30 26 34Z", "#9fe7ff", .75) + fill("M12 44C6 40 3 32 4 26C10 34 18 36 26 38Z", "#fff", .7);
    else if (v === "bang") out += S(star(14, 30, 15, 8, 9, -90), T.orange, { a: 0, b: 0, sw: 2, inner: fill(star(14, 30, 9, 5, 9, -70), T.yellow.b) });
    else if (v === "ghost") out += L("M2 24H14M5 32H17M1 40H11", "#bff3ff", 2.6, .9);
    else out += L("M3 22H17M7 29H21M2 36H13", "#fff", 2.6, .85);
    let body = S(Cap(50, 49, 43, 12, 3), P.dmetal, { a: [1.5, 0], b: [1, 0], hw: 1.2 }) +
      S(Cap(33, 10.5, 52, 10.5, 2.4), P.dmetal, { a: [0, 1], b: 0 }) +
      S(Cap(31, 10.5, 37, 10.5, 3.2), m, { a: [0, 1.2], b: 0 }) + S(Cap(49, 10.5, 55, 10.5, 3.2), m, { a: [0, 1.2], b: 0 }) +
      S(R(10, 41, 42, 6.5, 3.2), m, { a: [0, 2.2], b: [0, 1.4], inner: L("M14 44H44", "#fff", 1.6, .4) }) +
      (v === "e" ? S(R(43.5, 18, 5, 12, 2), P.dark, { a: [1, 0], b: 0, sw: 1.8, inner: fill(R(44.5, 20, 3, 3, .5), P.lcd.b) }) + S(R(16, 42, 16, 4, 1.5), P.dark, { a: 0, b: 0, sw: 1.4 }) : "") +
      S(C(15, 51, 7), P.rubber, { a: 2, b: 1.5 }) + F(C(15, 51, 2.8), P.metal.b, 1.8) +
      S(C(50, 51, 7), P.rubber, { a: 2, b: 1.5 }) + F(C(50, 51, 2.8), P.metal.b, 1.8);
    if (v === "lance") body = S("M30 30L63 12L62 17L31 34Z", T.red, { a: [0, 1.4], b: 0, sw: 2, inner: fill("M38 26L42 24V31L38 33Z M48 21L52 19V26L48 28Z", "#fff") }) + S(E(31, 32, 3, 6), P.metal, { a: 0, b: 0, sw: 2 }) + body;
    if (v === "ghost") body = `<g opacity=".72">${body}</g>`;
    return out + body + (v === "comet" ? Sp(6, 8, 3) + Sp(24, 6, 2.4) : "");
  },

  bin: (m) =>
    S(R(16, 6, 30, 5, 2.5), P.dark, { a: [0, 1.5], b: 0 }) +
    S("M14 21H45L42 57H17Z", m, { a: [4, 1], inner: L("M22 25L23 53M29.5 25V53M37 25L36 53", m.s, 2.2, .7) + fill(R(26, 30, 8, 8, 4), "#fff", .85) }) +
    S("M45 21L52 24L49.5 53L42 57Z", dk(m), { a: 1.5, b: 1 }) +
    F("M11 17L17 10H53L48 17Z", m.h) + S(R(10, 16.5, 38, 6, 2), m, { a: [0, 2], b: [0, 1.2] }) + F("M48 16.5L53 10V15.5L48 22.5Z", m.s) +
    S(C(46, 56, 5.2), P.rubber, { a: 1.5, b: 1 }) + F(C(46, 56, 1.8), P.metal.b, 1.4),

  cone: (m) =>
    S("M6 51L14 46H50L58 51L50 57H14Z", dk(m), { a: [0, 2], b: [0, 1.2] }) +
    S("M28 5H36L46 50H18Z", m, {
      a: [5, 1], b: 2.4, ink: 1,
      inner: fill("M24.4 22H39.6L41.4 30H22.6Z M21 37H43L44.4 43H19.6Z", "#f4f7ff"),
    }) + Gl(27, 14, 1.4, 5, 12, .7),

  beaker: (m) =>
    S("M25 5H39V10H37V24L50.5 49.5C52.5 54 50 58.5 45.5 58.5H18.5C14 58.5 11.5 54 13.5 49.5L27 24V10H25Z", P.glass, {
      a: [3, 0], b: [2, 0],
      inner: fill("M0 38H64V64H0Z", m.b) + fill("M0 38H64V40.5H0Z", m.h) + fill("M40 38H64V64H44Z", m.s, .6) +
        `<circle cx="24" cy="48" r="2.2" fill="${m.h}"/><circle cx="33" cy="52" r="1.6" fill="${m.h}"/><circle cx="40" cy="46" r="1.3" fill="${m.h}"/>`,
    }) + Gl(23.5, 40, 1.4, 6, 28, .75) + Gl(29.6, 16, 1, 4, 0, .7) +
    S(C(30, 30, 2.6), m, { a: .8, b: 0, sw: 1.8 }) + S(C(35, 21, 2), m, { a: .8, b: 0, sw: 1.8 }) + S(C(31, 6, 3), m, { a: .8, b: .6, sw: 1.8 }) + S(C(38, 2.8, 1.8), m, { a: .5, b: 0, sw: 1.6 }),

  battery: (m) => {
    const clamp = (x, y, a, q) => G(`translate(${x} ${y}) rotate(${a})`,
      S("M-5.5 -1L-6.5 -12L-3 -9.5L-1.5 -13L0 -9.5L1.5 -13L3 -9.5L6.5 -12L5.5 -1Z", P.metal, { a: 1.5, b: 1 }) +
      S("M-5.5 -2H5.5L4.2 17Q4 19.5 1.5 19.5H-1.5Q-4 19.5 -4.2 17Z", q, { a: [2, 1], b: 1.2, inner: L("M-5 4H5M-5 8H5", q.s, 1.5, .8) }));
    return TL("M24 42C23 61 41 61 40 42", P.dark.b, 3.2) +
      S("M32 1L28 9H32L30 16L37 6H33L35 1Z", P.gold, { a: 1, b: 0, sw: 2 }) +
      clamp(18, 25, -22, m) + clamp(46, 25, 22, P.dark);
  },

  skewer: (m) => rot(
    S("M30.6 2L32 -6L33.4 2V60H30.6Z", P.metal, { a: [1.2, 0], b: 0, sw: 2.2 }) +
    L(C(32, 64, 4.6), INK, 5.4) + L(C(32, 64, 4.6), P.metal.b, 2.6) +
    S(R(20, 2, 24, 12, 4.6), P.meat, { a: [3.4, 1.6], b: [1.4, 1], inner: L("M24 6L28 8.4M34 5L38 7.4M28 11L32 12.4", P.meat.s, 1.8) }) +
    S(R(21.4, 15, 21.2, 9.4, 3.4), m, { a: [3.4, 1.2], b: 1.8 }) +
    S(R(20.4, 25.4, 23.2, 9.6, 4.2), P.paper, { a: [3.4, 1.2], b: 1.8, inner: L("M24 29.4Q32 26.6 40 29.4", P.paper.s, 1.6) }) +
    S(R(20, 36, 24, 12, 4.6), P.meat, { a: [3.4, 1.6], b: [1.4, 1], inner: L("M24 40L28 42.4M34 39L38 41.4M28 45L32 46.4", P.meat.s, 1.8) }) +
    S(R(23, 49, 18, 7, 3.4), T.green, { a: [2.4, 1.2], b: 1.2 }), 45),

  hammer: (m, v) => {
    const handle = S(R(29, 22, 6, 40, 3), P.wood, { a: [2, 0], b: [1.4, 0] }) + S(R(28.4, 46, 7.2, 14, 2.5), m, { a: [2, 0], b: [1.2, 0], inner: L("M27 50H37M27 54H37", m.s, 1.6) });
    let head;
    if (v === "mallet") head = S(R(11, 6, 42, 18, 7), P.wood, { a: [0, 4], b: 2.4, inner: L("M18 6V24M46 6V24", P.wood.s, 1.6, .6) + fill(R(28, 6, 8, 18, 0), m.b) + L("M14 12C20 11 26 13 30 12", P.wood.h, 1.4, .7) }) + F(E(11.5, 15, 3, 8.6), P.wood.s, 2.2) + F(E(52.5, 15, 3, 8.6), P.oat.h, 2.2) + L("M52.5 10a3 5 0 0 1 0 10", P.wood.s, 1, .7);
    else if (v === "smith") head = S("M10 7H38L55 12.5V17.5L38 23H10Z", P.dmetal, { a: [0, 3.5], b: 2.2, inner: fill(R(28, 6, 8, 18, 0), dk(P.dmetal).b) }) + S(R(6, 5.5, 6, 19, 2), P.metal, { a: [1.4, 2], b: 1 });
    else if (v === "maul") head = S("M14 9C17 4 26 3 32 5C38 3 47 4 50 9C54 14 53 21 49 24C44 28 36 27 32 25C26 28 18 27 14 23C10 19 10 13 14 9Z", T.coal, { a: [2, 3.5], b: 2, inner: F(C(22, 12, 2.6), T.coal.s, 1.2) + F(C(42, 18, 3), T.coal.s, 1.2) + F(C(34, 10, 1.6), T.coal.s, 1) + L("M16 20C20 18 24 21 28 19", "#ff8a2b", 1.8, .9) + L("M38 8C41 10 44 9 46 11", "#ff8a2b", 1.6, .9) });
    else if (v === "bark") head = S(R(11, 6, 42, 18, 6), T.brown, { a: [0, 4], b: 2.2, inner: L("M15 9C18 12 16 18 19 22M24 7C26 12 24 17 27 23M38 7C40 12 37 17 40 23M47 8C49 12 47 17 50 21", T.brown.s, 1.6, .8) }) + [[14, 7, -30], [50, 7, 30], [32, 4, 0]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 0C-4 -2 -5 -6 -3 -8C0 -7 1 -4 0 0Z" fill="${T.green.b}" stroke="${INK}" stroke-width="1.6"/>`).join("");
    else head = S(R(13, 7, 38, 18, 3), m === T.gold ? P.gold : P.dmetal, { a: [0, 4], b: 2.4, inner: L("M19 7V25M45 7V25", INK, 2, .35) + fill(R(28, 7, 8, 18, 0), m === T.gold ? P.gold.s : m.b) }) +
      S(R(8.5, 9, 6, 14, 2), m === T.gold ? P.gold : P.metal, { a: [1.6, 2], b: 1 }) + S(R(49.5, 9, 6, 14, 2), m === T.gold ? P.gold : P.metal, { a: [1.6, 2], b: 1 });
    let extra = "";
    if (v === "clock") extra = S(C(32, 16, 6.4), P.white, { a: 1, b: 0, sw: 2 }) + L("M32 11.6V16L34 12.2", INK, 1.6) + Tx(32, 21.4, "XII", 3, INK);
    if (v === "smith") extra = glow(16, 15, 12, "#ff8a2b", .55) + Sp(4, 4, 3.4, "#ffd23d") + Sp(10, 30, 2.4, "#ffd23d");
    return diag(handle + head + extra, 35);
  },

  sign: (m, v) => v === "swirl"
    ? S(R(29, 34, 6, 28, 3), P.white, { a: [2, 0], b: 0, inner: fill("M29 41L35 37V42L29 46Z M29 51L35 47V52L29 56Z", m.b, .85) }) +
      S(C(32, 22, 18.5), P.white, { a: 3, b: 2.2, inner: L("M32 22a2 2 0 0 1 4 0a4 4 0 0 1 -8 0a6 6 0 0 1 12 0a8 8 0 0 1 -16 0a10 10 0 0 1 20 0a12 12 0 0 1 -24 0a14 14 0 0 1 28 0a16 16 0 0 1 -32 0", m.b, 2.4) }) + Gl(22, 12, 4, 1.8, -35, .8)
    : v === "tank"
      ? _sign(m, "") + [16, 22, 28, 34, 40, 46].map((x, i) => fill(R(x - 2, 33 - i * 3.6, 4, 6, .8), INK, .7)).join("") + L("M8 46L18 38M46 6L56 0", INK, 2, .5)
      : _sign(m, v),

  staff: (m, v) => {
    if (v === "zebra") {
      const beacon = (y) => glow(32, y, 11, "#ffb347", .45) + S(C(32, y, 7.6), T.orange, { a: 1.8, b: 1.4 }) + Gl(29.4, y - 2.6, 2, 1.2, -35, .85);
      return lay(S(R(26.6, 4, 10.8, 58, 3), P.white, { a: [2.8, 0], b: [1.6, 0], ink: 1, inner: [10, 20, 30, 40, 50].map((y) => fill(R(25, y, 14, 5, 0), INK)).join("") }) +
        bands([4, 57], 10.8, 5, P.gold) + beacon(-1) + beacon(66));
    }
    if (v === "star") return lay(
      shaft(24, 70, 9.4, P.dwood) + bands([30], 9.4, 3.4, P.gold) + glow(32, 13, 19, "#fff3a0", .5) + S(star(32, 13, 17.4, 7.6, 5, -90), P.gold, { a: 2.6, b: 2 }) + Gl(27.6, 10, 2, 3, 30, .85) +
      L("M37 30L42 34", INK, 1.4) + G("rotate(-90 46 40)", S(R(39, 34, 15, 11, 1.4), pal("#ff8a2b", "#d2561b", "#ffc27a"), { a: [0, 1.4], b: 0, sw: 2 }) + F(C(41.6, 39.5, 1.2), "#fff", 1) + Tx(47.6, 42.4, "£1", 7.4, "#fff")));
    return lay(
      shaft(24, 70, 9.4, P.dwood) + bands([42], 9.4, 7, m) + L("M26.6 45.5H37.4", m.s, 1.4) +
      glow(32, 12, 15, m.h, .5) + TL("M27 25C22 18 23 7 29 3M37 25C42 18 41 7 35 3", P.gold.b, 3) +
      S(C(32, 12, 10), m, { a: 2.6, b: 2 }) + Gl(28.4, 8.6, 2.4, 1.4, -30, .9) + fill(C(35.5, 15, 1.3), m.h, .9) +
      (v === "shop" ? L("M37 47L42 51", INK, 1.4) + G("rotate(-90 47 56)", S(R(38, 50, 18, 10, 1.4), P.white, { a: [0, 1.4], b: 0, sw: 2 }) + Tx(47, 57.2, "OPEN", 5.6, T.red.s)) : ""));
  },

  book: (m, v, o) => v === "steps"
    ? rot(
      S(R(16, 10, 34, 46, 2), P.paper, { a: [0, 1.5], b: 0 }) + F("M37 55V62L39.5 59.5L42 62V55Z", T.red.b, 1.8) +
      S(R(12, 7, 34, 47, 3), m, { a: [3.5, 3], inner: fill(R(12, 7, 6, 47, 0), m.s) + L("M18 7V54", INK, 1.6, .35) }) +
      `<path transform="translate(27 38) rotate(-14) scale(.5)" d="${FOOT}" fill="${P.gold.b}"/><path transform="translate(36 22) rotate(10) scale(.5)" d="${FOOT}" fill="${P.gold.b}"/>` + L("M22 48H42", T.red.b, 2), -8)
    : _book(m, v, o),

  chips: (m, v) =>
    (v === "sun" ? glow(32, 20, 26, "#ffb347", .5) + S(star(32, 16, 22, 15, 14, -90), T.orange, { a: 0, b: 0, sw: 2 }) : "") +
    [[18, 12, -12], [24, 7, -5], [30, 10, 2], [36, 6, 8], [43, 12, 15]].map(([x, y, a]) =>
      G(`rotate(${a} ${x + 3} 34)`, S(R(x, y, 6, 26, 1.6), P.gold, { a: [1.8, 0], b: [1, 0], hw: 1.2, inner: fill(R(x, y, 6, 3, 0), P.gold.s, .6) }))).join("") +
    (v === "sun" ? "" : S("M37 12C42 6 50 6 53 12C55 16 53 21 51 22L48.5 20C50 18 50 15 48.5 13C46.5 10.4 42 11 40 14Z", P.gold, { a: 1.2, b: .8, sw: 2.2 })) +
    S("M13 28H51L46 58H18Z", m, { a: [4, 2], ink: 1, inner: fill("M0 36H64V41H0Z", "#fff", .95) }) +
    S(star(32, 49, 5, 2.2, 5, -90), P.gold, { a: .8, b: 0, sw: 1.8 }),


  pigeon: (m, v) => {
    const bird = (eye) =>
      L("M28 51V58M34 51V58M25 58H31M31 58H37", "#ff8a6b", 2.6) +
      S("M18 43L4 53L7 44L3 37Z", P.greyD, { a: 1.5, b: 1 }) +
      S("M11 42C11 32 19 26 29 26C31 22 33.5 16.5 37.5 12.5C41.5 8.5 48 8.5 51 12C53 14.6 53.6 17 53 19.6C51.6 25.5 50 30 50 36C50 46 43 52 32 52C21 52 11 50 11 42Z", P.grey, {
        a: [4, 3], inner: fill("M33 22C37.5 26.5 45 28.5 52 22.5V30C46 34 38 33 31 28Z", m.b, .9) + fill("M33 22C37.5 26.5 45 28.5 52 22.5V24.5C45 30 37 28.5 32 24Z", m.h, .7),
      }) +
      S("M19 34C27 30 39 32 46 40C42 46.5 32 48.5 24 46.5C19.5 43.5 17.5 38 19 34Z", P.greyD, { a: 2, b: 1.5, inner: L("M25 38C31 37 37 39 41 42M23 42C29 42 34 43 38 45", INK, 1.8, .45) }) +
      F("M52.6 18L59.5 20.8L52.4 23Z", P.dark.b, 2) + F(E(52, 17.4, 1.7, 1.2), "#e9edf5", 1.2) + eye;
    const eye = v === "patch"
      ? TL("M36 9L55 22", "#e0b07a", 2.2) + S(E(46, 15.6, 6.6, 5.6), P.dark, { a: 0, b: [1.2, 1.2], sw: 2.4 }) + Gl(43.6, 13.6, 1.8, 1, -20, .6)
      : F(C(46, 15, 3), "#ff9a2b", 1.6) + `<circle cx="46.3" cy="15" r="1.3" fill="${INK}"/>` + Gl(45.2, 14, .7, .7, 0, .95) +
        (v === "angry" ? L("M41.5 10.5L50.5 13.5", INK, 2.6) : "");
    if (v === "angry") return G("translate(-6 -3) scale(.55)", `<g opacity=".7">${bird(F(C(46, 15, 3), "#ff4d5e", 1.6))}</g>`) + G("translate(6 6) scale(.9)", bird(eye));
    return bird(eye);
  },

  chain: (m, v) => {
    const pts = [[10, 55], [17, 48], [24, 41], [31, 34], [38, 27]];
    const c = m === T.gold ? P.gold : P.metal;
    const links = pts.map(([x, y], i) => i % 2 === 0
      ? `<ellipse cx="${x}" cy="${y}" rx="7.6" ry="4.6" transform="rotate(-45 ${x} ${y})" fill="none" stroke="${INK}" stroke-width="7"/><ellipse cx="${x}" cy="${y}" rx="7.6" ry="4.6" transform="rotate(-45 ${x} ${y})" fill="none" stroke="${c.b}" stroke-width="3.4"/><ellipse cx="${x - .7}" cy="${y - .7}" rx="7.6" ry="4.6" transform="rotate(-45 ${x} ${y})" fill="none" stroke="${c.h}" stroke-width="1" stroke-dasharray="6 30" opacity=".9"/>`
      : G(`rotate(-45 ${x} ${y})`, S(R(x - 8, y - 2.2, 16, 4.4, 2.2), c, { a: [0, 1.4], b: 0, sw: 2.2 })));
    const end = v === "noentry"
      ? S(C(46, 18, 13), T.red, { a: 3, b: 2.2, inner: "" }) + S(R(37, 15, 18, 6, 2), P.white, { a: [0, 1.2], b: 0, sw: 2 })
      : TL("M41 22V16C41 9.5 51 9.5 51 16V22", c.b, 3) + S(R(36.5, 21, 19, 17, 3.5), m, { a: 3, b: 2, inner: "" }) + F("M46 26.5C44.8 26.5 44 27.4 44 28.5C44 29.2 44.4 29.8 45 30.1L44.4 33.5H47.6L47 30.1C47.6 29.8 48 29.2 48 28.5C48 27.4 47.2 26.5 46 26.5Z", INK, 1);
    return links.join("") + end;
  },

  receipt: (m, v) => {
    const long = v === "long";
    let r = rot(
      S(long ? "M16 1H48V58L44 62L40 58L36 62L32 58L28 62L24 58L20 62L16 58Z" : "M16 7H48V55L44 59L40 55L36 59L32 55L28 59L24 55L20 59L16 55Z", P.paper, {
        a: [3, 0], b: [2, 0],
        inner: fill(long ? "M0 1H64V8H0Z" : "M0 7H64V14H0Z", m.b) + L(long ? "M21 13H43M21 18H38M21 23H43M21 28H35M21 33H43M21 38H39M21 43H43" : "M21 21H43M21 27H38M21 33H43M21 39H35", INK, 2.2, .28) +
          (v === "surge" ? F("M24 47L32 39L40 47H35.5V52H28.5V47Z", T.red.b, 1.6) : long ? fill(R(21, 48, 22, 7, 1.5), m.b) + Tx(32, 54, "∞", 8, "#fff") : fill(R(21, 44, 22, 6, 1.5), m.b)),
      }) + (long ? "" : S(R(13, 3, 38, 7, 3.5), P.paper, { a: [0, 2], b: 0 })), long ? 4 : 8);
    if (v === "ghost") r = `<g opacity=".7">${r}</g>`;
    if (v === "surge") r += S(crescent(52, 10, 6.5), T.yellow, { a: 1, b: .8, sw: 2 });
    if (v === "planet") r += at(52, 50, 1.3, EMB.saturn());
    return r;
  },

  scissors: (m) => rot(
    S("M31 35L44.5 6Q45.2 3.6 43 4.2L26.5 31Z", P.metal, { a: [2, 0], b: 1.4 }) +
    S(Cap(32, 33, 43.5, 46, 3), m, { a: 1.2, b: 0 }) + S(C(44, 50, 9) + C(44, 50, 4.8), m, { ev: 1, a: 2, b: 1.6 }) +
    S("M33 35L19.5 6Q18.8 3.6 21 4.2L37.5 31Z", P.metal, { a: [2, 0], b: 1.4 }) +
    S(Cap(32, 33, 20.5, 46, 3), m, { a: 1.2, b: 0 }) + S(C(20, 50, 9) + C(20, 50, 4.8), m, { ev: 1, a: 2, b: 1.6 }) +
    S(C(32, 33, 2.8), P.gold, { a: .8, b: 0, sw: 2 }), -15),


  glove: (m, v) =>
    S(Cap(23, 30, 19.5, 11, 4), m, { a: 2, b: 1.4 }) + S(Cap(30.5, 28, 30.5, 7.5, 4.1), m, { a: 2, b: 1.4 }) +
    S(Cap(38, 29, 40.5, 10.5, 4), m, { a: 2, b: 1.4 }) + S(Cap(44, 34, 49, 19, 3.6), m, { a: 2, b: 1.4 }) +
    S(Cap(19, 43, 9.5, 30, 4.2), m, { a: 2, b: 1.4 }) +
    S("M17 34C17 28.5 20 26 24 26H40C44 26 46.5 29 46.5 34V44C46.5 51 41.5 54 34.5 54H28C21 54 17 50 17 44Z", m, { a: [4, 3], inner: L("M25 31V43M31.5 30V43M38 31V43", m.h, 1.4, .45) + (v === "velvet" ? L("M20 36C26 32 34 34 44 30", "#fff", 2.4, .3) : "") }) +
    (v === "gauntlet" ? S("M18 50L10 62H54L46 50Z", dk(m), { a: [0, 2], b: [0, 1.2], inner: L("M12 58H52", m.h, 1.4, .5) }) + F(R(28, 53, 8, 5, 1), P.gold.b, 1.4)
      : S(R(18, 51, 28, 10, 3), dk(m), { a: [0, 2], b: [0, 1.2] })) + Gl(23, 17, 1, 3, -10, .6),

  wand: (m, v) => {
    let shaft0, top;
    if (v === "twig") {
      shaft0 = rod("M31 70C30 61 34 53 33 45C32 38 34 31 32 24", P.dwood, 8.6) + F(E(32.6, 52, 1.6, 2.6), P.dwood.s, 1.2) + F(E(33.2, 37, 1.4, 2.2), P.dwood.s, 1.2) +
        L("M33 47C38 45 41 42 42 37", INK, 5.4) + L("M33 47C38 45 41 42 42 37", P.dwood.b, 2.8);
      top = glow(32, 14, 16, m.h, .6) + TL("M27.5 25C23 19 24 10 28.6 5.6M36.5 25C41 19 40 10 35.4 5.6", P.dwood.b, 3.4) +
        S(C(32, 14, 9.4), m, { a: 2.4, b: 1.8 }) + Sp(32, 14.4, 5) + Gl(28.4, 10.6, 2.2, 1.3, -35, .9) +
        L("M42 37V42", INK, 1.6) + S(C(42, 44, 2.6) + C(42, 44, 1.1), P.metal, { ev: 1, a: .6, b: 0, sw: 1.6 }) +
        G("rotate(-45 42 47)", S("M40.6 46H43.4V56H40.6Z", P.gold, { a: [.8, 0], b: 0, sw: 1.6 }) + fill("M43 50h2.2v1.6h-2.2Z M43 53.4h1.6v1.4h-1.6Z", P.gold.b) + L("M40.6 50h2.6M40.6 53.4h2.6", INK, 1));
    } else if (v === "galaxy") {
      shaft0 = shaft(26, 70, 8.4, P.gold) + bands([52, 58, 64], 8.4, 3.2, P.dark);
      top = glow(32, 15, 19, "#a98bff", .6) + TL("M24 27C22 20 23 12 26 8M40 27C42 20 41 12 38 8", P.gold.b, 3) +
        S(C(32, 15, 12.6), pal("#3b2a7a", "#22184f", "#8f78ff"), { a: 2.6, b: 1.8, norim: 1, inner:
          L("M32 15C36 11 41 15 38 20C34 25 24 22 25 14C26 7 36 4 41 9", "#cfaaff", 2.4, .9) + L("M32 15C29 18 24 14 27 10", "#ff9cc0", 1.8, .9) +
          fill(C(32, 15, 2.6), "#fff8c8") + fill(C(25, 21, 1) + C(39, 9, 1.1) + C(40, 19, .8) + C(23, 11, .7), "#fff") }) +
        Gl(27, 9.4, 2.6, 1.4, -35, .8) + S(star(43, 5, 4.6, 2, 4, -90), P.gold, { a: .6, b: 0, sw: 1.6 });
    } else {
      shaft0 = shaft(26, 70, 8.4, P.dark, { hw: 1.4 }) + S(R(27.8, 26, 8.4, 8, 2.6), P.white, { a: [2, 0], b: 0, sw: 2.2 }) + S(R(27.8, 62, 8.4, 8, 2.6), P.white, { a: [2, 0], b: 0, sw: 2.2 }) + bands([34], 8.4, 2.6, P.gold);
      top = glow(32, 14, 18, m.h, .55) + S(star(32, 14, 17, 7.4, 5, -90), m, { a: 2.6, b: 2 }) + Gl(27.6, 11, 2, 3, 30, .85) + fill(C(36.5, 16, 1.2), m.h, .9);
      if (v === "trail") top = fill("M32 14L-4 22L-2 34Z", "#fff3a0", .35) + fill("M32 14L2 25L3 31Z", "#ffe25a", .7) + L("M31 14L6 27", "#fff", 2.2, .9) + top;
    }
    return lay(shaft0 + top) + Sp(12, 15, 3.8) + Sp(52, 48, 3.2);
  },

  shuriken: (m) => {
    const P4 = starPts(32, 32, 30.5, 12, 4, -75), tris = [];
    for (let i = 0; i < 8; i += 2) {
      const tip = P4[i], prev = P4[(i + 7) % 8], next = P4[i + 1];
      tris.push(fill(poly([[32, 32], prev, tip]), m.h) + fill(poly([[32, 32], tip, next]), i < 4 ? m.b : m.s));
    }
    const d = poly(P4);
    const panels = P4.filter((_, i) => i % 2 === 0).map((t) => { const x = 32 + (t[0] - 32) * .55, y = 32 + (t[1] - 32) * .55; return `<circle cx="${f(x)}" cy="${f(y)}" r="4.4" fill="${P.metal.b}" stroke="${INK}" stroke-width="1.4"/><path d="M${f(x - 2.6)} ${f(y)}l1.7 -1.5l1.6 1.5l1.7 -1.5" fill="none" stroke="#fff" stroke-width="1.1"/>`; }).join("");
    return `<g>${tris.join("")}</g>` + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>` + panels +
      S(C(32, 32, 9) + C(32, 32, 3.2), P.gold, { ev: 1, a: 1.8, b: 1.4 });
  },

  puffer: (m, v, o) => {
    o = o || {};
    return S("M20 9Q32 16 44 9L54 14Q60 26 58 42H50V54Q50 58 46 58H18Q14 58 14 54V42H6Q4 26 10 14Z", m, {
      a: [4, 2], ink: o.ink,
      inner: (v === "duvet"
        ? L("M0 24H64M0 34H64M0 44H64M0 54H64M22 0V64M42 0V64", m.s, 2.2, .8) + [[16, 29], [32, 29], [48, 29], [16, 39], [32, 39], [48, 39], [24, 49], [40, 49]].map(([x, y]) => `<path d="${star(x, y, 2.6, 1, 6, 0)}" fill="${(tone(o.pc) || T.sky).b}"/>`).join("")
        : L("M5 24Q32 29 59 24M4.5 33Q32 38 59.5 33M14 45Q32 49 50 45M14 52Q32 55 50 52", m.s, 2.4) + L("M14 42V22M50 42V22", m.s, 2) + L("M9 20Q32 24.5 55 20M8 29Q32 33.5 56 29", m.h, 1.6, .6)) +
        L("M32 17V58", INK, 2, .5) + (o.pat ? PAT[o.pat](m, o) : ""),
    }) + (v === "duvet"
      ? S("M17 4Q32 1 47 4Q50 10 46 14Q32 18 18 14Q14 10 17 4Z", P.white, { a: [0, 2], b: [0, 1.4], inner: L("M20 8Q32 6 44 8", P.white.s, 1.4) })
      : S("M18.5 5.5Q32 14 45.5 5.5Q48 11.5 44.5 14Q32 20.5 19.5 14Q16 11.5 18.5 5.5Z", m, { a: [0, 2], b: [0, 1.4] })) +
      (o.emb ? emb(o.emb, +o.ex || 40, +o.ey || 26, +o.es || 1) : "");
  },

  scarf: (m) => {
    const st = fill("M0 34H64V38.5H0Z M0 44H64V48.5H0Z", "#fff", .92);
    return S("M13 20C13 10 51 10 51 20C51 24.5 47 27 42 28C40 22.5 24 22.5 22 28C17 27 13 24.5 13 20Z", dk(m), { a: [0, 2], b: [0, 1.2] }) +
      S("M36 26L42.5 57H52.5L45 24Z", m, { a: [3, 1], b: 1.6, ink: 1, inner: st }) +
      S("M26 25L14.5 54H25L33 28Z", m, { a: [3, 1], b: 1.6, ink: 1, inner: st }) +
      L("M16.5 54.5V59.5M20 54.5V59.5M23.5 54.5V59.5", m.s, 2.2) + L("M44.5 57.5V62M48 57.5V62M51.5 57.5V62", m.s, 2.2) +
      S("M13 19C14 27 22 31 32 31C42 31 50 27 51 19C49 24 41 25.5 32 25.5C23 25.5 15 24 13 19Z", m, { a: [0, 2], b: 0 }) +
      S(E(32, 28.5, 7, 5.5), m, { a: 1.6, b: 1.2, inner: L("M28 25.5Q32 28.5 36 25.5", m.s, 1.4) });
  },

  plate: (m, v, o) => {
    o = o || {};
    let inner = L("M32 18V56", m.h, 2.2, .7) + L("M18 42C26 46 38 46 46 42M18 50C26 53.5 38 53.5 46 50", INK, 1.8, .35);
    if (v === "grid") inner += L("M22 18V58M42 18V58M14 30H50M14 38H50", INK, 1.6, .35);
    if (v === "bubbles") inner += PAT.bubbles(m);
    if (v === "scuff") inner += L("M20 24L28 30M38 40L46 36M22 48L27 46", "#fff", 1.6, .55);
    if (v === "door") inner += fill("M22 18H42V58H22Z", m.s, .25) + L("M20 18V58M44 18V58", INK, 1.4, .3);
    if (v === "planks") inner += L("M22 10V60M32 10V60M42 10V60", m.s, 2, .8) + fill(R(0, 24, 64, 4, 0), P.dmetal.b) + fill(R(0, 44, 64, 4, 0), P.dmetal.b);
    if (o.pat) inner += PAT[o.pat](m, o);
    const hem = { hex: "V44L46 48V54L40 58H24L18 54V48L14 44", scale: "V44Q47 50 43 47Q41 54 36.4 52Q32 60 27.6 52Q23 54 21 47Q17 50 14 44", jag: "V42L46 47L42 44L38 52L34 47L30 56L27 48L22 50L18 45L14 46" }[o.cut] || "V43C50 52 42 58 32 58C22 58 14 52 14 43";
    let out = S(`M13 11L24 8C26 13 29 16 32 16C35 16 38 13 40 8L51 11L55 21L50 26${hem}V26L9 21Z`, m, { a: [4, 2], inner, ink: o.ink }) +
      L("M24 8.5C26 14 29 17 32 17C35 17 38 14 40 8.5", (tone(o.trim) || P.gold).b, 2.2) + F(C(18, 29, 1.6), (tone(o.trim) || P.gold).b, 1.4) + F(C(46, 29, 1.6), (tone(o.trim) || P.gold).b, 1.4);
    if (v === "vac") out += TL("M50 30C60 32 60 50 50 54C44 56 40 52 42 48", P.dark.b, 3.4) + S(R(38, 45, 7, 5, 2), P.dark, { a: 0, b: 0, sw: 2 }) + S(R(22, 26, 20, 14, 7), T.red, { a: [2, 2], b: 1.4, inner: fill(R(22, 31, 20, 4, 0), P.dark.b) }) + F(C(32, 22, 2.6), P.dark.b, 1.6);
    if (v === "door") out += S(R(26, 26, 12, 16, 1.5), P.gold, { a: 1.2, b: .8, sw: 2 }) + Tx(32, 36.4, "PUSH", 4.4, P.gold.s) + S(C(32, 49, 4.4), P.glass, { a: 1, b: 0, sw: 2 });
    if (v === "hole") out += glow(32, 36, 14, "#9b5de5", .5) + F(C(32, 36, 8), "#05040f", 2) + L("M32 36a2 2 0 0 1 4 0a4 4 0 0 1 -8 0a6 6 0 0 1 12 0", "#c9a8ff", 1.6, .9);
    if (o.emb) out += emb(o.emb, +o.ex || 32, +o.ey || 34, +o.es || 1.3);
    return out;
  },


  hoodie: (m, v, o) => {
    o = o || {};
    let inner = o.pat ? PAT[o.pat](m, o) : "";
    if (v === "dino") inner += PAT.stains();
    if (v === "foil") inner += PAT.crinkle();
    if (v === "half") inner += fill("M32 0H64V64H32Z", INK, .35);
    return S("M18 22C18 10 24 4 32 4C40 4 46 10 46 22Z", dk(m), { a: 1.6, b: 1.4 }) +
      S("M18 18L8 26L5 50L13 52L16 38V58H48V38L51 52L59 50L56 26L46 18C42 24 38 26 32 26C26 26 22 24 18 18Z", m, { a: [4, 2], inner: inner + L("M16 38L17 30M48 38L47 30", INK, 1.6, .35) }) +
      F("M23 20C23 12.5 27 8.5 32 8.5C37 8.5 41 12.5 41 20C38 24 26 24 23 20Z", P.dark.s) +
      (v === "nowhere" ? F(C(28.5, 16, 1.2), "#fff", .6, .9) + F(C(35.5, 16, 1.2), "#fff", .6, .9) : "") +
      L("M28.5 25V36M35.5 25V36", (tone(o.cord) || P.white).b, 2) + F(R(27.3, 35, 2.4, 3.6, 1), P.metal.b, 1.2) + F(R(34.3, 35, 2.4, 3.6, 1), P.metal.b, 1.2) +
      F("M22 44H42L45 54H19Z", m.s, 2) + (o.emb ? emb(o.emb, +o.ex || 32, +o.ey || 40, +o.es || 1) : "");
  },



  crown: (m, v) =>
    S("M12 42L7 16L21 28L32 9L43 28L57 16L52 42Z", m, { a: [4, 3], inner: L("M21 28L23 42M43 28L41 42", m.s, 1.8, .5) }) +
    S(C(7, 15, 3.4), m, { a: 1, b: .8, sw: 2 }) + S(C(32, 8, 3.8), m, { a: 1, b: .8, sw: 2 }) + S(C(57, 15, 3.4), m, { a: 1, b: .8, sw: 2 }) +
    S(R(10, 40, 44, 13, 3), dk(m), { a: [0, 3], b: [0, 1.6] }) +
    (v === "stone"
      ? L("M18 44L22 48M40 43L43 47", INK, 1.6, .35) + F("M25 26C25 22 29 20 32 21C35 20 37.5 22.5 37 26C38 29 35.5 30 35.5 33C35.5 35.5 33 35.5 33 33V30.5C31 31.5 29 29.5 30 28C27 29 25 28 25 26Z", "#f4f6fb", 1.8)
      : S(E(32, 46.5, 4.6, 3.8), T.red, { a: 1.2, b: .9, sw: 2 }) + S(C(20, 46.5, 2.6), T.cyan, { a: .8, b: 0, sw: 1.8 }) + S(C(44, 46.5, 2.6), T.cyan, { a: .8, b: 0, sw: 1.8 }) + Gl(16, 30, 1.2, 4, 15, .7)),

  star: (m) => {
    const P5 = starPts(32, 34, 27, 12, 5, -90);
    let facets = "";
    for (let i = 0; i < 10; i += 2) {
      facets += fill(poly([[32, 34], P5[(i + 9) % 10], P5[i]]), i === 0 || i === 8 ? m.h : m.b) + fill(poly([[32, 34], P5[i], P5[i + 1]]), i === 2 || i === 4 ? m.s : m.b);
    }
    return Sp(9, 9, 4.5) + Sp(56, 12, 3.4) + Sp(54, 56, 3) + facets + L(P5.filter((_, i) => i % 2 === 0).map((t) => `M32 34L${f(t[0])} ${f(t[1])}`).join(""), INK, 1.3, .3) +
      `<path d="${poly(P5)}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` + Gl(25, 24, 1.4, 3.5, 30, .9);
  },

  shorts: (m) =>
    S("M13 14H51L55 50C50 52 44 52 37 50L32 28L27 50C20 52 14 52 9 50Z", m, { a: [4, 2], ink: 1, inner: fill("M47 14H51L55 50H51Z M13 14H17L13 50H9Z", (T.yellow).b) + L("M32 15V28", INK, 1.6, .4) + fill("M27 22C29 26 35 26 37 22V30H27Z", P.dark.b, .55) + L("M18 30C20 36 22 40 24 44M46 30C44 36 42 40 40 44", "#fff", 1.6, .35) }) +
    S(R(9, 47, 19, 5, 2), P.dark, { a: 0, b: 0, sw: 2 }) + S(R(36, 47, 19, 5, 2), P.dark, { a: 0, b: 0, sw: 2 }) +
    S(R(13, 9, 38, 7, 2.5), P.dark, { a: [0, 2], b: [0, 1.2] }) + Gl(21, 26, 1.3, 7, 10, .7) + Gl(44, 26, 1.3, 7, -10, .5) + L("M58 18L62 16M58 26H63M58 34L62 36", INK, 2, .55),

  moustache: (m) =>
    `<circle cx="20" cy="25" r="10" fill="${P.glass.b}" opacity=".85"/><circle cx="44" cy="25" r="10" fill="${P.glass.b}" opacity=".85"/>` +
    `<circle cx="20" cy="25" r="10" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="44" cy="25" r="10" fill="none" stroke="${INK}" stroke-width="5"/>` +
    Gl(16, 21, 1.6, 3, 40, .9) + Gl(40, 21, 1.6, 3, 40, .9) + L("M30 24Q32 21 34 24", INK, 3.4) +
    S("M8 12Q19 4 29 11L28 15Q19 9.5 10 15Z", P.dark, { a: [0, 1.2], b: 0, sw: 2 }) + S("M56 12Q45 4 35 11L36 15Q45 9.5 54 15Z", P.dark, { a: [0, 1.2], b: 0, sw: 2 }) +
    S("M32 19C27.5 19 26.5 29 25.5 35C25 40.5 28 43 32 43C36 43 39 40.5 38.5 35C37.5 29 36.5 19 32 19Z", P.skin, { a: [3, 2], b: 1.8 }) +
    S("M32 41.5C28 37.5 21 37.5 16.5 41.5C12.5 45 8.5 44 6.5 40C5.5 48 12 54 20 52.5C25 51.5 29 48.5 32 46.5C35 48.5 39 51.5 44 52.5C52 54 58.5 48 57.5 40C55.5 44 51.5 45 47.5 41.5C43 37.5 36 37.5 32 41.5Z", m, { a: [0, 3], b: [0, 1.8], inner: L("M14 44Q20 42 24 44M50 44Q44 42 40 44", m.s, 1.4, .8) }),

  wizhat: (m) =>
    S(E(32, 50, 27.5, 8.5), dk(m), { a: [0, 2], b: [0, 1.4] }) +
    S("M13 50C20 42 24 26 30 16C34 9 41 6 48 3.5C43.5 10 42 16 42 24C42 34 45.5 44 51 50C40 54 25 54 13 50Z", m, {
      a: [4, 2], inner: fill("M0 41H64V48H0Z", P.gold.b) + fill("M0 41H64V42.5H0Z", P.gold.h),
    }) + S(star(29, 31, 4.6, 2, 5, -90), P.gold, { a: .8, b: 0, sw: 1.8 }) + S("M37 18C34 18 32 21 33 24C34 27 37 27.5 39 26.5C36.5 26 35 24 35.5 21.5C35.8 20 36.5 18.8 37 18Z", P.gold, { a: 0, b: 0, sw: 1.6 }) +
    S(R(28, 40, 8, 9, 1.5), P.gold, { a: .8, b: 0, sw: 1.8 }),

  ticket: (m, v) => v === "bus"
    ? rot(S("M8 18H56V28C53 28 51 30 51 32C51 34 53 36 56 36V46H8V36C11 36 13 34 13 32C13 30 11 28 8 28Z", m, { a: [0, 3], b: [0, 2], inner: `<path d="M44 18V46" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3" opacity=".45"/>` + fill(R(28, 24, 12, 3, 1.5), INK, .3) + fill(R(28, 30, 9, 3, 1.5), INK, .3) + Tx(34, 41.6, "2019", 5, T.red.s) }) + emb("bus", 20, 30, .9) + emb("clover", 50, 32, .5), -10)
    : _ticket(m, v),

  can: (m) =>
    S("M17 13V53C17 57 24 59.5 32 59.5C40 59.5 47 57 47 53V13Z", m, {
      a: [5, 0], b: [3, 0],
      inner: fill("M0 22H64V24H0Z", m.h, .7) + `<path d="M35 25L25 40H32L29 52L40 34H33Z" fill="${P.gold.b}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` + fill("M17 51H47V60H17Z", P.metal.b),
    }) +
    S(E(32, 13, 15, 5), P.metal, { a: [0, 1.4], b: 0 }) + F(E(32, 13, 10.5, 3.2), P.metal.s, 1.6) + F(R(28.5, 10, 7, 3.4, 1.7), P.metal.h, 1.4) + Gl(22, 34, 1.4, 9, 0, .55),

  puzzle: (m) =>
    S("M8 9H42L37 17L44 24L37 31L44 39L38 46L42 55H8Z", P.paper, {
      a: [3, 3],
      inner: [[8, 9], [22.7, 9], [8, 23.7], [22.7, 38.3], [37.3, 23.7]].map(([x, y]) => fill(R(x + 1, y + 1, 12.7, 12.7, 0), m.h, .7)).join("") +
        L("M15.3 9V55M30 9V55M8 16.3H50M8 31H50M8 45.7H50", INK, 1, .35) + L("M22.7 9V55M37.3 9V55M8 23.7H50M8 38.3H50", INK, 2, .55) +
        L("M13 12.5L16 12.5M27 27L33 27M12 42H17", m.s, 2.4, .9),
    }) +
    G("translate(48 34) rotate(28)", S(R(-4, -22, 8, 34, 1.5), T.yellow, { a: [2, 0], b: [1.2, 0] }) + S(R(-4, -26, 8, 5, 2), T.pink, { a: [1.4, 0], b: 0, sw: 2 }) + S("M-4 12L0 21L4 12Z", P.wood, { a: 1, b: 0, sw: 2 }) + fill("M-1.4 18L0 21L1.4 18Z", INK)),


  clover: (m, v) => v === "tag"
    ? rot(S(R(14, 12, 36, 46, 9), pal("#eafff3", "#b5dcc8", "#ffffff"), { a: 2.5, b: 2, inner: fill("M14 36L39 12H47L14 46Z", "#fff", .7) }) + F(C(32, 19, 2.6), "#fff", 1.6) +
      ring(32, 8, 6.5, P.metal.b, 2.2) + TL("M32 38C33 45 35 49 39 53", m.s, 2.4) + at(32, 37, 1.45, EMB.clover()), 10)
    : _clover(m, v),

  torch: (m) => rot(
    glow(32, 9, 13, "#fff3a0", .6) + L("M21 3L17 -1M32 1V-3.6M43 3L47 -1M15 8L11 7M49 8L53 7", INK, 4.4, .5) + L("M21 3L17 -1M32 1V-3.6M43 3L47 -1M15 8L11 7M49 8L53 7", "#ffe25a", 2.4) +
    S(R(24, 26, 16, 38, 5), m, { a: [4, 0], b: [2.4, 0], inner: L("M24 46H40M24 50.5H40M24 55H40M24 59.5H40", INK, 1.8, .35) }) +
    S("M17 8H47L41 28H23Z", m, { a: [4, 1.4], b: 2.4 }) + S(R(15.6, 5.4, 32.8, 5.6, 2.4), P.metal, { a: [0, 1.4], b: 0, sw: 2.2 }) +
    S(E(32, 7.4, 13.4, 3.2), pal("#fff6b0", "#f2c94c", "#ffffff"), { a: 0, b: 0, sw: 2 }) +
    S(R(28.6, 31, 6.8, 10, 2.6), T.red, { a: [1.4, 0], b: 0, sw: 2.2 }) + Gl(27.4, 16, 1.4, 5, -10, .7), 40) + Sp(56, 22, 3.4),

  radio: (m) =>
    S(R(19, 3, 5, 18, 2.5), P.dark, { a: [1.5, 0], b: [1, 0] }) + S(R(35, 11, 6, 8, 2), P.dark, { a: 1, b: 0 }) +
    S("M44 21L50 24V56L44 60Z", dk(m), { a: 1.2, b: 0 }) +
    S(R(15, 18, 30, 42, 5), m, { a: [4, 3], inner: L("M21 41H39M21 45H39M21 49H39M21 53H39", INK, 2, .55) + fill(R(15, 18, 4, 42, 0), P.dark.b) + fill(R(41, 18, 4, 42, 0), P.dark.b) }) +
    S(R(21, 24, 18, 10, 2), P.lcd, { a: 1.2, b: 0, sw: 2 }) + L("M24 29H30", P.lcd.s, 2) + F(R(11.5, 28, 4, 10, 1.5), P.dark.b, 2),

  megaphone: (m) => rot(
    S("M21 37L18 51H25L27 37Z", P.dark, { a: 1.4, b: 0 }) + S(R(6, 26, 10, 12, 2.5), P.dark, { a: [0, 2], b: 0 }) +
    S("M14 25L41 12C45.5 10 49.5 18 49.5 32C49.5 46 45.5 54 41 52L14 39Z", m, { a: [0, 4], b: [0, 2], ink: 1, inner: fill("M25 19.5L31 16.5V47.5L25 44.5Z", "#fff") }) +
    S(E(45.5, 32, 6, 21), dk(m), { a: [2, 0], b: 0 }) + F(E(46.5, 32, 3.6, 16), P.dark.s, 1.5) +
    L("M55 23Q59 32 55 41", INK, 2.6) + L("M59.5 17Q65 32 59.5 47", INK, 2.2, .55), -12),

  bottle: (m) =>
    S(R(25, 3, 14, 8, 2.5), T.red, { a: [2, 1.5], b: 1 }) +
    S("M27 11H37V15C37 18 42 19 42 24V54Q42 59 37 59H27Q22 59 22 54V24C22 19 27 18 27 15Z", m, {
      a: [4, 0], b: [2.4, 0], ink: 1,
      inner: fill(R(18, 32, 28, 15, 0), "#fff") + `<path d="M32 34C34 37 37 38.5 37 41.5C37 43.5 35 45 32 45C29 45 27 43.5 27 41.5C27 39.5 28.5 38.5 29.5 36.5C30 38 30.6 38.6 31.4 38.8C31 37.3 31.2 35.6 32 34Z" fill="${m.b}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
    }) + Gl(26, 24, 1.3, 4.5, 0, .75) + Gl(26, 52, 1.2, 3, 0, .6),

  flame: (m) =>
    glow(32, 18, 16, m.h, .35) +
    S("M14 59L18 51H46L50 59Z", P.dmetal, { a: [0, 2], b: [0, 1.2] }) +
    TL("M37 49H47", P.dmetal.b, 2.2) +
    S(R(27, 28, 10, 24, 2), P.metal, { a: [2.5, 0], b: [1.6, 0] }) + S(R(25, 40, 14, 5, 2), P.gold, { a: [1.6, 1], b: 0, sw: 2 }) +
    S("M32 3C36 11 42 15.5 42 21.5C42 26.5 37.5 30 32 30C26.5 30 22 26.5 22 21.5C22 16.5 26 14.5 27 9.5C29 12.5 30 13.5 31 13.5C30 10.5 30 6.5 32 3Z", m, { a: 2.6, b: 1.8 }) +
    S("M32 14C34 18 37 19.5 37 23C37 26 34.8 28 32 28C29.2 28 27 26 27 23C27 20 30 18 32 14Z", T.cyan, { a: 1.4, b: 0, sw: 2 }),

  gem: (m) => {
    const cr = (x, base, top, w, a, k) => G(`rotate(${a} ${x} ${base})`,
      fill(poly([[x - w, base], [x - w, top + w * .8], [x, top], [x, base]]), k ? m.h : m.b) +
      fill(poly([[x, top], [x + w, top + w * .8], [x + w, base], [x, base]]), k ? m.b : m.s) + L(`M${x} ${top}V${base}`, INK, 1.2, .3) +
      `<path d="${poly([[x - w, base], [x - w, top + w * .8], [x, top], [x + w, top + w * .8], [x + w, base]])}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
      Gl(x - w * .5, top + w * 1.6, w * .18, w * .9, 0, .85));
    return glow(32, 30, 25, m.h, .3) +
      cr(20, 48, 24, 6.5, -25, 0) + cr(45, 48, 26, 6, 24, 0) + cr(32, 47, 6, 8.5, 0, 1) +
      S("M8 52C8 46 14 42 20 42H44C50 42 56 46 56 52V54Q56 58 52 58H12Q8 58 8 54Z", T.stone, { a: [3, 3] }) + Sp(52, 10, 3.6) + Sp(11, 22, 2.8);
  },

  jar: (m, v) => {
    const lid = v === "jam"
      ? S(R(13, 6, 38, 10, 3), P.white, { a: [2, 2], b: 1.2, inner: fill("M13 6h6v5h-6Z M25 6h6v5h-6Z M37 6h6v5h-6Z M19 11h6v5h-6Z M31 11h6v5h-6Z M43 11h6v5h-6Z", T.red.b) }) + L("M14 15C20 18 44 18 50 15", T.red.b, 1.4)
      : S(R(14.5, 6.5, 35, 10, 3), v === "wisp" ? P.dmetal : P.gold, { a: [3, 2], b: 1.6, inner: L("M20 6V17M26 6V17M32 6V17M38 6V17M44 6V17", P.gold.s, 1.4, .6) });
    let fillc = m.b, inside = "";
    if (v === "jam") { fillc = "#05040f"; inside = fill(R(18, 30, 28, 14, 1), P.paper.b) + Tx(32, 36, "DO NOT", 5, T.red.b) + Tx(32, 42, "OPEN", 5, T.red.b); }
    let content;
    if (v === "thing") content = S("M20 52C16 44 18 32 26 28C30 22 38 22 42 28C48 32 50 42 46 52Z", T.lime, { a: 2.4, b: 1.6, inner: L("M24 40C28 44 36 44 40 40", T.lime.s, 1.4) }) + F(C(28, 34, 3), "#fff", 1.4) + F(C(37, 33, 3.6), "#fff", 1.4) + `<circle cx="28.6" cy="34.6" r="1.4" fill="${INK}"/><circle cx="37.6" cy="33.6" r="1.6" fill="${INK}"/>` + F("M28 42Q32 46 36 42Z", "#5a1a2a", 1.2) + TL("M26 28C24 22 28 20 26 16", T.green.b, 1.6);
    else if (v === "wisp") content = glow(32, 40, 16, "#7fe0ff", .7) + S("M32 24C35 30 40 33 40 40C40 45 36 49 32 49C28 49 24 45 24 40C24 35 28 34 29 29C30 32 31 32 32 32C31 29 31 27 32 24Z", T.cyan, { a: 1, b: 0, sw: 1.8, inner: fill(drop(32, 42, .9), "#fff") });
    else if (v === "jam") content = glow(32, 46, 10, "#9b5de5", .6) + L("M32 46a1.5 1.5 0 0 1 3 0a3 3 0 0 1 -6 0a4.5 4.5 0 0 1 9 0a6 6 0 0 1 -12 0", "#c9a8ff", 1.6) + `<circle cx="32" cy="46" r="2.4" fill="#000"/>`;
    else if (v === "soup") content = "";
    else content = S("M20 40C17 40 16 34 19 31C18 26 23 23 27 25C29 21 35 21 37 25C41 23 46 26 45 31C48 34 47 40 44 40C43 45 38 46 35 44C33 46 29 46 28 44C24 46 20 45 20 40Z", P.pink, { a: 2.4, b: 1.6, inner: L("M24 30C26 32 24 35 27 37M32 26.5C30 30 34 32 32 36M39 30C37 33 41 35 39 38M26 41C28 40 30 41 31 43", P.pink.s, 1.8) });
    return lid + S(R(12, 15, 40, 45, 9), P.glass, { a: 3, b: 2.4, inner: fill("M0 24H64V64H0Z", fillc, v === "jam" ? .95 : .75) + fill("M0 24H64V26H0Z", v === "jam" ? "#2a1f55" : m.h, .9) + (v === "wisp" ? fill("M0 0H64V64H0Z", "#0b1a3a", .5) : "") + inside + content }) +
      Gl(18, 36, 1.6, 9, 0, .75) + (v === "jam" || v === "wisp" ? "" : F(C(40, 51, 1.8), "#fff", 1.2, .8) + F(C(24, 52, 1.3), "#fff", 1.2, .8));
  },

  orb: (m, v) => {
    if (v === "crystal") return glow(32, 28, 28, m.h, .45) + S("M18 56H46L42 46H22Z", P.gold, { a: [0, 2], b: [1, 1] }) + S(R(14, 55, 36, 6, 2), P.dwood, { a: [0, 1.6], b: 0 }) +
      S(C(32, 28, 21), P.glass, { a: 4, b: 2.6, inner: fill(C(32, 28, 21), "#2a1f55", .55) + L("M32 28a2 2 0 0 1 4 0a4 4 0 0 1 -8 0a6 6 0 0 1 12 0a8 8 0 0 1 -16 0a10 10 0 0 1 20 0", "#e6d4ff", 2, .9) + `<circle cx="32" cy="28" r="2.2" fill="#fff"/>` + dots([[20, 22], [44, 34], [40, 16], [24, 38]], .9, "#fff", 0) }) + Gl(22, 18, 3, 6, 40, .8);
    return S(E(32, 58, 13, 3.4), P.dark, { a: 0, b: 0, sw: 2 }) +
      S(C(32, 31, 24), m, {
        a: 5, b: 3.4, hw: 2.4, ink: v === "gob",
        inner: v === "eight"
          ? `<circle cx="27" cy="26" r="10" fill="#fff" stroke="${INK}" stroke-width="2"/>` + Tx(27, 31, "8", 13, INK)
          : fill("M6 21Q32 31 58 21V29Q32 39 6 29Z", T.yellow.b) + fill("M6 37Q32 47 58 37V43Q32 53 6 43Z", T.cyan.b) + fill("M6 13Q32 21 58 13V16Q32 24 6 16Z", T.green.b),
      }) + Gl(19, 17, 3.5, 6, 45, .85) + Gl(25, 12, 1.3, 1.3, 0, .9);
  },

  duck: (m, v) =>
    (v === "cursed" ? glow(36, 24, 18, T.purple.b, .4) + L("M16 20C12 15 19 12 15 7M24 12C21 8 26 6 24 2", T.purple.h, 2.4, .9) : "") +
    S("M8 30C12 36 18 36 22 35C24 33 26 33 28 34C36 33 44 34 50 38C56 42 56 52 48 55C38 59 20 59 13 53C8 49 6 40 8 30Z", m, { a: [4, 3] }) +
    S("M26 42C32 38 42 40 44 46C40 50 32 50 27 48C25 46 25 44 26 42Z", dk(m), { a: 1.4, b: 1.2 }) +
    S(C(36, 22, 12), m, { a: 3, b: 2.2 }) +
    S("M46 22C50 20 56 21 58.5 24C56 27 50 29 46 27Z", T.orange, { a: 1.4, b: 1 }) +
    (v === "cursed"
      ? glow(39.5, 18, 5, "#ff4d5e", .5) + F(C(39.5, 18, 3.2), "#ff4d5e", 1.8) + `<circle cx="40" cy="18" r="1.3" fill="#fff"/>` + L("M35 12L43 14", INK, 2.2)
      : F(C(39.5, 18, 3.2), "#fff", 1.8) + `<circle cx="40.4" cy="18" r="1.6" fill="${INK}"/>`) + Gl(29, 15, 1.6, 3, 30, .8),

  badge: (m) =>
    S("M20 46L15 62L21 59L25.5 63L29 49Z", m, { a: 1.2, b: 1 }) + S("M44 46L49 62L43 59L38.5 63L35 49Z", m, { a: 1.2, b: 1 }) +
    S(C(32, 29, 24), P.metal, { a: 3.4, b: 2.4 }) + S(C(32, 29, 18), P.dark, { a: [-2.4, -2.4], b: 0, sw: 2 }) +
    TL("M33 23.5L31 33.5L35.5 40.5L36.5 46M31 33.5L26.5 40L23.5 45M32.6 25.5L27.5 30.5M32.6 25.5L38.5 29.5", "#45d483", 3.4) +
    S(C(33.4, 18, 3.4), pal("#45d483", "#22955a", "#a6f5c4"), { a: .8, b: 0, sw: 2 }) + Gl(18, 18, 1.6, 4, 40, .7),

  candy: (m, v) => {
    if (v === "stars") return L("M44 18L24 38M20 28L6 42", "#fff3a0", 7, .5) +
      [[44, 17, 1.3, T.yellow], [19, 27, 1.1, T.pink], [36, 45, 1.35, T.cyan]].map(([x, y, s, q]) => G(`translate(${x} ${y}) scale(${s})`, S("M-8 0L-15 -6L-14 0L-15 6Z", dk(q), { a: .6, b: 0, sw: 1.8 }) + S("M8 0L15 -6L14 0L15 6Z", dk(q), { a: .6, b: 0, sw: 1.8 }) + S(star(0, 0, 9, 4.4, 5, -90), q, { a: 1.4, b: 1 }))).join("") + Sp(57, 56, 3.2) + Sp(8, 52, 2.6);
    const cd = (x, y, s, a, q) => G(`translate(${x} ${y}) rotate(${a}) scale(${s})`,
      S("M-10 0L-20 -9L-18 0L-20 9Z", dk(q), { a: 1, b: 0 }) + S("M10 0L20 -9L18 0L20 9Z", dk(q), { a: 1, b: 0 }) +
      S(E(0, 0, 11.5, 9.5), q, { a: 2.4, b: 1.8, inner: fill("M-7 -10L-2.6 -10L3.4 10L-1 10Z M2.6 -10L7 -10L13 10L8.6 10Z", "#fff", .6) }));
    return cd(21, 47, .8, -20, T.yellow) + cd(44, 49, .75, 18, T.cyan) + cd(28, 30, .8, 12, T.green) + cd(38, 20, .95, -6, m) + Sp(54, 10, 3.4);
  },

  glasses: (m, v) =>
    `<path d="M9 30C10 50 24 60 32 60C40 60 54 50 55 30" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray=".1 4.6" stroke-linecap="round"/><path d="M9 30C10 50 24 60 32 60C40 60 54 50 55 30" fill="none" stroke="${P.gold.b}" stroke-width="2.6" stroke-dasharray=".1 4.6" stroke-linecap="round"/>` +
    TL("M5 26L9.5 24M59 26L54.5 24", m.b, 2.2) +
    [20, 44].map((x) => (v === "half"
      ? `<path d="M${x - 11} 25H${x + 11}A11 9 0 0 1 ${x - 11} 25Z" fill="${P.glass.b}" opacity=".9"/><path d="M${x - 11} 25H${x + 11}A11 9 0 0 1 ${x - 11} 25Z" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linejoin="round"/><path d="M${x - 11} 25H${x + 11}A11 9 0 0 1 ${x - 11} 25Z" fill="none" stroke="${m.b}" stroke-width="3" stroke-linejoin="round"/>`
      : `<circle cx="${x}" cy="26" r="10.5" fill="${P.glass.b}" opacity=".9"/><path d="M${x - 8} ${30}L${x + 4} ${16}L${x + 8} ${19}L${x - 4} ${33}Z" fill="#fff" opacity=".55"/>` +
        `<circle cx="${x}" cy="26" r="11" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="${x}" cy="26" r="11" fill="none" stroke="${m.b}" stroke-width="3.4"/><path d="M${x - 9.5} 21A11 11 0 0 1 ${x - 3} 15.4" fill="none" stroke="${m.h}" stroke-width="1.4" stroke-linecap="round"/>`)).join("") +
    TL(v === "half" ? "M31 25Q32 23 33 25" : "M30 24Q32 20 34 24", m.b, 3) + (v === "half" ? Sp(20, 12, 3.4) + Sp(46, 10, 2.6) + S(star(52, 44, 4, 1.7, 5, -90), P.gold, { a: 0, b: 0, sw: 1.4 }) : ""),

  card: (m, v) => {
    if (v === "licence") return rot(S(R(5, 14, 54, 36, 4), T.pink, { a: [3, 3], inner: fill(R(5, 14, 54, 8, 0), T.pink.s) + L("M28 30H52M28 35H46", INK, 1.6, .35) }) + Tx(30, 20.6, "DRIVING LICENCE", 4.4, "#fff") +
      S(R(10, 25, 14, 19, 2), P.paper, { a: 1.2, b: 0, sw: 1.8, inner: `<circle cx="17" cy="31" r="3.4" fill="${T.pink.s}"/><path d="M11.5 43C11.5 38 14 36 17 36C20 36 22.5 38 22.5 43Z" fill="${T.pink.s}"/>` }) +
      S(C(45, 41, 8), T.red, { a: 1.2, b: .8, sw: 2 }) + Tx(45, 44.6, "14", 9, "#fff"), -8);
    if (v === "scratch") return rot(S(R(8, 10, 48, 44, 3), m, { a: [3, 3], inner: fill(R(8, 10, 48, 9, 0), dk(m).b) + `<path d="${star(14, 14.5, 3, 1.3, 5, -90)}" fill="#fff"/>` }) + Tx(34, 17.6, "WIN!", 6.4, "#fff") +
      [[13, 23], [27, 23], [41, 23], [13, 38], [27, 38]].map(([x, y]) => S(R(x, y, 11, 12, 1.5), P.metal, { a: 0, b: 0, sw: 1.6, inner: L(`M${x + 2} ${y + 3}l3 2l2 -2l2 2`, "#fff", 1, .7) })).join("") +
      S(R(41, 38, 11, 12, 1.5), P.paper, { a: 0, b: 0, sw: 1.6 }) + Tx(46.5, 46.6, "£1", 6.4, T.green.s) + fill("M41 38h4l-2 3l3 1l-3 2h-2Z", P.metal.b), -8) +
      S(C(54, 54, 6), P.gold, { a: 1.2, b: .8, sw: 2, inner: L("M51 54h6", P.gold.s, 1.2) });
    return S("M27 0H37L35.5 13H28.5Z", dk(m), { a: [1.2, 0], b: 0, sw: 2 }) + S(R(27.5, 10, 9, 8, 2), P.metal, { a: 1, b: 0, sw: 2 }) +
      S(R(6, 16, 52, 37, 5), m, { a: [3, 3], inner: v === "galaxy" ? fill(R(6, 16, 52, 37, 0), "#20184a") + PAT.starfield() : fill("M6 16H58V23H6Z", "#fff", .25) }) +
      S(R(11, 26, 15, 19, 2), P.paper, { a: 1.5, b: 0, sw: 2 }) +
      (v === "pigeon"
        ? F("M13.5 42C13.5 37 16.5 34 20 34C20.5 31.5 22 29.5 24 30C25.5 30.4 25.5 32 24.6 33C24.2 37 23 42 19 42Z", P.grey.s, 1.4)
        : `<circle cx="18.5" cy="32" r="3.6" fill="${m.s}"/><path d="M12.5 44C12.5 39 15 37 18.5 37C22 37 24.5 39 24.5 44Z" fill="${m.s}"/>`) +
      L("M31 30H52M31 36H46", "#fff", 2.6, .9) +
      (v === "infinity" || v === "galaxy"
        ? TL("M36 44C38 40 42 40 44 44C46 48 50 48 52 44C50 40 46 40 44 44C42 48 38 48 36 44Z", P.gold.b, 2.2)
        : v === "pigeon" ? Tx(44, 48, "UNION", 5.4, "#fff") : S(R(31, 41, 10, 7.5, 1.5), P.gold, { a: 1, b: 0, sw: 1.8, inner: L("M31 44.7H41M36 41V48.5", P.gold.s, 1) }));
  },

  map: (m, v) => {
    const night = v === "stars", q = night ? T.navy : m;
    return S("M7 14L23 9V51L7 56Z", q, { a: [0, 2], b: [1.6, 1.6] }) + S("M23 9L41 14V56L23 51Z", dk(q), { a: [0, 2], b: 0 }) + S("M41 14L57 9V51L41 56Z", q, { a: [0, 2], b: [1.6, 1.6] }) +
      (night ? dots([[14, 22], [20, 30], [30, 26], [36, 36], [48, 20], [52, 34], [46, 44], [16, 44]], 1.4, "#fff", .8) + L("M14 22L20 30L30 26L36 36L46 44M48 20L52 34L46 44", "#cfe0ff", 1.2, .8)
        : v === "cemetery" ? [[14, 30], [32, 38], [49, 26], [22, 46]].map(([x, y]) => F(`M${x - 3} ${y + 4}V${y - 1}A3 3 0 0 1 ${x + 3} ${y - 1}V${y + 4}Z`, "#cfd4dc", 1.4) + L(`M${x} ${y - 2}V${y + 2}M${x - 1.4} ${y - .6}H${x + 1.4}`, INK, .9)).join("") + `<path d="M10 52C18 46 24 50 30 42C36 34 44 34 52 20" fill="none" stroke="#ff4d5e" stroke-width="2.4" stroke-dasharray="3 3" stroke-linecap="round"/>`
          : v === "contour" ? L(E(18, 26, 8, 5) + E(18, 26, 4, 2.4) + E(44, 40, 9, 6) + E(44, 40, 5, 3), T.brown.b, 1.4, .9) + L("M7 44C14 40 20 46 26 42C32 38 36 44 41 40", T.cyan.b, 2.4, .9) + `<path d="M10 52C20 48 26 54 34 30C38 20 48 22 52 14" fill="none" stroke="#ff4d5e" stroke-width="2" stroke-dasharray="2.4 2.6"/>`
            : F(E(15, 22, 4.5, 3.2), T.green.b, 1.6, .9) + F(E(33, 44, 4, 3), T.green.b, 1.6, .9) + L("M7 36C12 32 18 38 23 34C28 30 34 34 41 30C46 27 52 30 57 27", T.cyan.b, 3, .9) +
              `<path d="M11 50C17 42 25 46 29 36C33 27 43 24 49 18" fill="none" stroke="#ff4d5e" stroke-width="2.6" stroke-dasharray="3 3.4" stroke-linecap="round"/>` + TL("M46 14L52 20M52 14L46 20", "#ff4d5e", 2.6)) +
      (v === "wrong" ? S("M41 14L57 9L61 19L45 25Z", dk(m), { a: 0, b: 0, sw: 2 }) + G("rotate(30 50 44)", S(R(48, 30, 3, 22, 1), T.yellow, { a: 0, b: 0, sw: 1.6 }) + F("M48 52L49.5 56L51 52Z", P.wood.b, 1.2)) + `<rect x="26" y="18" width="8" height="11" rx="1" fill="none" stroke="#5a5b55" stroke-width="1.4" stroke-dasharray="1.6 1.4"/>` : "");
  },

  phone: (m, v) => rot(
    (v === "notify" || v === "galaxy" || v === "hourglass" ? L("M8 14L13 17M6 30H12M8 46L13 43M56 14L51 17M58 30H52M56 46L51 43", P.gold.b, 2.6) : "") +
    S(R(16, 5, 32, 54, 7), m, { a: 3, b: 2 }) +
    S(R(19.5, 11, 25, 40, 3), pal("#22325f", "#17223f", "#3a5390"), { a: 0, b: 0, sw: 1.8, inner: v === "galaxy" ? fill(R(19.5, 11, 25, 40, 0), "#140f33") + PAT.starfield() : "" }) + `<circle cx="32" cy="8" r="1.3" fill="${INK}"/>` +
    (v === "cracked"
      ? F(R(25, 26, 13, 7, 1.5), "none", 2).replace(`stroke="${INK}"`, 'stroke="#fff"') + fill(R(38.5, 28, 1.8, 3, .6), "#fff") + fill(R(26.6, 27.6, 2.4, 3.8, .5), "#ff4d5e") + Tx(32, 40, "2%", 6, "#ff4d5e") +
        L("M40 11.5L34.5 20L38.5 23.5L31 33L35.5 39L29 50.5M34.5 20L28 16M31 33L23 36", "#e3ebff", 1.4, .9)
      : v === "galaxy" ? F(C(32, 26, 4.6), T.orange.b, 1.4) + `<ellipse cx="32" cy="26" rx="8" ry="2.4" transform="rotate(-18 32 26)" fill="none" stroke="#ffd23d" stroke-width="1.4"/>` + F("M32 33C29 37 29 40 32 44C35 40 35 37 32 33Z", T.red.b, 1.4) + L("M24 47H40", "#fff", 1.6, .6)
        : v === "hourglass" ? S(R(21.5, 18, 21, 12, 3), P.white, { a: [0, 1.2], b: 0, sw: 1.8 }) + at(27, 24, .55, EMB.hourglass()) + L("M31 22H40M31 26H37", INK, 1.2, .45) + at(32, 41, 1, EMB.hourglass())
          : S(R(21.5, 18, 21, 12, 3), P.white, { a: [0, 1.2], b: 0, sw: 1.8 }) + S("M28 27C28 22 30 20.5 32 20.5C34 20.5 36 22 36 27L37 28H27Z", P.gold, { a: .6, b: 0, sw: 1.4 }) + F(C(41, 18.5, 3), "#ff4d5e", 1.6) +
            L("M24 36H40M24 41H36", "#fff", 2, .5)) +
    Gl(21.5, 15, 1, 4, 0, .6), -10),

  wallet: (m) =>
    S(C(24, 21, 6), P.gold, { a: 1.6, b: 1 }) + S(C(38, 19, 6), P.gold, { a: 1.6, b: 1 }) +
    S("M10 28C10 24 13 22 17 22H47C51 22 54 24 54 28L52 50Q51 56 45 56H19Q13 56 12 50Z", m, { a: [4, 3], inner: L("M13.5 30H50.5M14.5 50H49.5", "#fff", 1.5, .55, ' stroke-dasharray="2.5 2.5"') }) +
    S(R(13, 19.5, 38, 5.5, 2.75), P.gold, { a: [0, 1.6], b: [0, 1] }) +
    TL("M18 20C18 13 26 10.5 30 10.5M46 20C46 13 38 10.5 34 10.5", P.gold.b, 2.4) + S(C(29.5, 10.5, 3.2), P.gold, { a: .8, b: 0, sw: 2 }) + S(C(34.5, 10.5, 3.2), P.gold, { a: .8, b: 0, sw: 2 }),

  dice: (m, v) => {
    const die = (x, y, s, q, pip, faces) => {
      const k = .87 * s, top = poly([[x, y - s], [x + k, y - s / 2], [x, y], [x - k, y - s / 2]]),
        lf = poly([[x - k, y - s / 2], [x, y], [x, y + s], [x - k, y + s / 2]]), rt = poly([[x, y], [x + k, y - s / 2], [x + k, y + s / 2], [x, y + s]]);
      const mt = (o, u, w) => `matrix(${f(u[0])} ${f(u[1])} ${f(w[0])} ${f(w[1])} ${f(o[0])} ${f(o[1])})`;
      const pips = (arr) => arr.map(([u, w]) => `<circle cx="${u}" cy="${w}" r=".11" fill="${pip}"/>`).join("");
      return fill(top, q.h) + fill(lf, q.b) + fill(rt, q.s) +
        G(mt([x - k, y - s / 2], [k, -s / 2], [k, s / 2]), pips(faces[0])) +
        G(mt([x - k, y - s / 2], [k, s / 2], [0, s]), pips(faces[1])) +
        G(mt([x, y], [k, -s / 2], [0, s]), pips(faces[2])) +
        L(`M${f(x - k)} ${f(y - s / 2)}L${x} ${y}L${f(x + k)} ${f(y - s / 2)}M${x} ${y}V${y + s}`, INK, 1.6, .5) +
        `<path d="${poly([[x, y - s], [x + k, y - s / 2], [x + k, y + s / 2], [x, y + s], [x - k, y + s / 2], [x - k, y - s / 2]])}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
        L(`M${f(x - k + 2)} ${f(y - s / 2 + .2)}L${f(x - 1)} ${f(y - s + 1.6)}`, "#fff", 1.4, .8);
    };
    const one = [[.5, .5]], two = [[.27, .27], [.73, .73]], three = [[.25, .25], [.5, .5], [.75, .75]], five = [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], six = [[.25, .22], [.25, .5], [.25, .78], [.75, .22], [.75, .5], [.75, .78]];
    if (v === "void") return glow(32, 34, 30, "#8a6bff", .45) + die(45, 21, 12, T.void, "#fff", [six, one, six]) + die(27, 35, 17, T.void, "#fff3a0", [six, six, six]) + Sp(10, 10, 3) + Sp(56, 50, 2.6);
    return die(45, 21, 12, T.white, INK, [six, three, two]) + die(27, 35, 17, m, "#fff", [six, six, six]);
  },

  calculator: (m, v) => {
    if (v === "adding") {
      let keys = "";
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) keys += F(R(15 + c * 7.4, 40 + r * 6, 6, 4.6, 1.2), c === 3 ? (r === 0 ? "#ff4d5e" : "#ff8a2b") : "#dfe5f2", 1.3);
      return S("M22 4H42V26H22Z", P.paper, { a: [2, 0], b: 0, sw: 2, inner: L("M25 8H39M25 12H36M25 16H39M25 20H33", INK, 1.6, .4) + fill(R(30, 22, 9, 2.4, 0), T.red.b) }) +
        S("M8 30L14 24H50L56 30Z", dk(m), { a: 0, b: 0, sw: 2.2 }) + S(R(19, 20, 26, 6, 3), P.dmetal, { a: [0, 1.4], b: 0, sw: 2 }) +
        S(R(8, 30, 48, 30, 3), m, { a: [3, 3], b: 1.6 }) + S(R(12, 33, 40, 5, 1), P.lcd, { a: 0, b: 0, sw: 1.6 }) + Tx(50, 37.4, "£0.00", 4.4, INK, { anchor: "end" }) + keys +
        S(R(46, 40, 6, 17, 1.4), P.white, { a: 0, b: 0, sw: 1.4 }) + Tx(49, 51, "+", 6, INK) + TL("M58 36C62 36 62 44 58 44", P.dmetal.b, 2) + S(C(58, 46, 2.4), T.red, { a: 0, b: 0, sw: 1.6 });
    }
    let btn = "";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const op = c === 3, x = 17.5 + c * 7.2, y = 26 + r * 7.4;
      if (op && r === 3) continue;
      btn += F(R(x, y, 5.6, op && r === 2 ? 12.8 : 5.4, 1.4), op ? (r === 0 ? "#ff4d5e" : "#ff8a2b") : "#dfe5f2", 1.4);
    }
    return F(R(16.5, 8.5, 36, 52, 5), dk(m).s) + S(R(13, 5, 36, 52, 5), m, { a: 2, b: 2 }) +
      S(R(17.5, 10, 27, 11, 2), P.lcd, { a: 0, b: 0, sw: 2 }) + Tx(31, 18, "5318008", 5, INK) + btn;
  },

  cards: (m, v) => {
    const card = (a, q, sym) => G(`rotate(${a} 32 58)`, S(R(20, 12, 24, 38, 3.5), q, { a: [2.4, 2], b: 1.6 }) +
      `<rect x="23.5" y="15.5" width="17" height="31" rx="2" fill="none" stroke="${P.gold.b}" stroke-width="1.6"/>` + sym);
    const moon = S("M34 25C30 25 28 28.5 29 32C30 35.5 34 36.5 36.5 35C33 34.5 31.5 32 32 29C32.4 27 33.2 25.8 34 25Z", P.gold, { a: 0, b: 0, sw: 1.6 });
    const sun = S(star(32, 31, 7.5, 4.4, 10, -90), P.gold, { a: 1, b: 0, sw: 1.6 }) + F(C(32, 31, 3.4), T.orange.b, 1.4);
    const starC = glow(32, 31, 9, "#fff3a0", .6) + S(star(32, 31, 8, 3.4, 8, -90), P.gold, { a: 1, b: 0, sw: 1.6 });
    const tower = F("M28 42V26L30 23H34L36 26V42Z", T.stone.b, 1.4) + F("M27 26H37", "none", 1.4) + L("M38 22L34 28L37 29L33 34", T.yellow.b, 1.6);
    if (v === "gap") return card(-26, m, moon) + G("rotate(0 32 58)", `<rect x="20" y="12" width="24" height="38" rx="3.5" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3" opacity=".6"/>`) + card(26, T.cream, tower);
    if (v === "star") return card(-24, m, starC) + card(24, m, starC) + card(0, T.cream, starC);
    return card(-24, m, moon) + card(24, m, moon) + card(0, T.cream, sun);
  },

  jacket: (m, v, o) => garment(m, v || "coat", o),

  suit: (m, v, o) => v === "dino"
    ? [[21, 9], [26, 4.6], [32, 3], [38, 4.6], [43, 9]].map(([x, y]) => S(`M${x - 3.4} ${y + 6}L${x} ${y - 4}L${x + 3.4} ${y + 6}Z`, tone((o || {}).spike) || T.lime, { a: .8, b: 0, sw: 2 })).join("") + G("translate(2.4 4.6) scale(.925)", _suit(m, "dino", Object.assign({}, o, { hood: 1 })))
    : _suit(m, v, o),

  robe: (m, v, o) => {
    o = o || {};
    const tr = tone(o.trim) || P.gold;
    const body = "M24 6L32 12L40 6L50 9L61 37L51 41L47 31L50 61H14L17 31L13 41L3 37L14 9Z";
    let inner = (o.pat ? PAT[o.pat](m, o) : "") + L("M17 31L19 18M47 31L45 18", INK, 1.6, .35) + L("M24 30L22 60M40 30L42 60", m.s, 1.8, .55);
    let out = "";
    if (v === "gown") inner += fill("M27 12H37L35 61H29Z", "#f3f6fd") + L("M32 12V61", INK, 1, .3);
    out += S(body, m, { a: [4, 2], ink: o.ink, inner });
    if (v === "gown") out += F("M29.5 12L32 22L34.5 12Z", "#fff", 1.4) + fill(R(30.6, 13, 2.8, 7, .6), "#fff") + L("M27 12L29 61M37 12L35 61", INK, 1.8, .6) +
      F("M3 37L13 41L14 52L5 47Z", m.s, 2) + F("M61 37L51 41L50 52L59 47Z", m.s, 2) +
      G("translate(48 9) rotate(12)", S("M-11 -1L0 -6L11 -1L0 4Z", P.dark, { a: [0, 1.2], b: 0, sw: 2 }) + F(R(-5, 0, 10, 5, 1), P.dark.b, 1.8) + L("M0 -1L8 4V9", P.gold.b, 1.4) + F(C(8, 10, 1.4), P.gold.b, 1));
    else {
      out += S("M24 6L32 12L40 6L42.5 8L34 15L35 61H29L30 15L21.5 8Z", tr, { a: [0, 1], b: 0, sw: 2, inner: o.stole ? PAT[o.stole](tr, o) : "" });
      out += S("M3 37L13 41L13.6 38L4.4 34Z", tr, { a: 0, b: 0, sw: 1.8 }) + S("M61 37L51 41L50.4 38L59.6 34Z", tr, { a: 0, b: 0, sw: 1.8 });
      if (!o.nobelt) out += TL("M17 33Q32 37 47 33", tone(o.belt) || P.gold.b ? (tone(o.belt) || P.gold).b : P.gold.b, 2.4) + TL("M30 35L28 45M33 35L35 44", (tone(o.belt) || P.gold).b, 1.8);
    }
    if (o.emb) out += emb(o.emb, +o.ex || 40, +o.ey || 24, +o.es || 1);
    if (o.emb2) out += emb(o.emb2, +o.ex2 || 24, +o.ey2 || 46, +o.es2 || 1);
    if (o.papers) out += [[18, 44, -14], [41, 46, 12]].map(([x, y, a]) => G(`rotate(${a} ${x} ${y})`, F(R(x - 3.5, y - 6, 7, 9, .8), P.paper.b, 1.4) + L(`M${x - 2} ${y - 3.4}H${x + 2}M${x - 2} ${y - 1.4}H${x + 2}M${x - 2} ${y + .6}H${x + 1}`, INK, .8, .5))).join("") + F(R(16, 50, 10, 8, 1), m.s, 1.6) + F(R(38, 50, 10, 8, 1), m.s, 1.6);
    return out;
  },

  poncho: (m, v, o) =>
    [[6, 14], [56, 10], [10, 58], [58, 56]].map(([x, y]) => F(drop(x, y, .7), T.cyan.h, 1.4)).join("") +
    S("M20 18C17.5 8 23 3 32 3C41 3 46.5 8 44 18Z", dk(m), { a: [2, 1.5], b: 1.4 }) +
    S("M21 14H43L62 44L50 49L45 46L42 58H22L19 46L14 49L2 44Z", m, { a: [4, 3], b: 2.4, inner: L("M21 14L10 42M43 14L54 42", m.h, 1.6, .6) + fill(R(24, 34, 16, 10, 2), m.s) + L("M24 34H40", INK, 1.6, .5) + L("M14 40L22 24M48 26L52 36", "#fff", 2, .45) }) +
    F("M25 15C25 9.5 28 6.5 32 6.5C36 6.5 39 9.5 39 15C36 17.4 28 17.4 25 15Z", P.dark.s) +
    L("M28 16C27 20 27 24 28 27M36 16C37 20 37 24 36 27", "#fff", 1.6) + F(C(28, 28, 1.3), P.metal.b, 1) + F(C(36, 28, 1.3), P.metal.b, 1),

  motley: (m, v, o) => {
    o = o || {};
    const a = tone(o.pc) || T.yellow;
    const hem = "L48 46L44 54L39 47L35.5 56L32 48L28.5 56L25 47L20 54L16 46";
    return S(`M24 6L32 12L40 6L51 9L59 24L51 29L48 25V46${hem}V25L13 29L5 24L13 9Z`, m, { a: [4, 2], inner: PAT.diamonds(m, { pc: o.pc }) + L("M16 25L17 18M48 25L47 18", INK, 1.6, .35) }) +
      S("M19 6Q32 22 45 6L48 11L42 16L38 12L35 18L32 13L29 18L26 12L22 16L16 11Z", a, { a: [0, 1.4], b: 0, sw: 2 }) +
      dots([[16, 46], [20, 54], [25, 47], [28.5, 56], [32, 48], [35.5, 56], [39, 47], [44, 54], [48, 46], [22, 16.5], [42, 16.5]], 2.2, P.gold.b, 1.4) +
      dots([[5, 24], [59, 24]], 2.4, P.gold.b, 1.4);
  },

  apron: (m, v, o) =>
    L("M23 10C23 1 41 1 41 10", INK, 4.4) + L("M23 10C23 1 41 1 41 10", m.s, 2) +
    S("M22 8H42V20C42 22.5 50 24 50 28V58Q50 61 47 61H17Q14 61 14 58V28C14 24 22 22.5 22 20Z", m, { a: [4, 2], inner: L("M14 28H50", m.s, 1.6, .6) + L("M20 32L19 58M44 32L45 58", m.s, 1.4, .5) + fill("M30 40C33 37 38 39 37 43C35 46 31 45 30 40Z M22 50C24 48 27 49 26.5 52C24.5 54 22 53 22 50Z", "#3b2a1e", .55) }) +
    L("M14 30C9 31 7 36 9 40M50 30C55 31 57 36 55 40", INK, 3.6) + L("M14 30C9 31 7 36 9 40M50 30C55 31 57 36 55 40", m.s, 1.6) +
    F(R(26, 12, 12, 8, 1.4), m.s, 1.8) + dots([[24, 9], [40, 9]], 1.4, P.metal.b, 1.2) +
    [[52, 14, 4], [57, 22, 3], [8, 18, 3.4]].map(([x, y, r]) => Sp(x, y, r, "#ffd23d")).join("") + L("M48 18L54 12M50 22L58 20M14 20L8 14", "#ff8a2b", 1.8, .9),

  cricketbat: (m) => diag(G("translate(32 32) scale(1.18) translate(-32 -32)",
    S("M28.4 44H35.6V58Q35.6 62 32 62Q28.4 62 28.4 58Z", m, { a: [2, 0], b: [1.2, 0], hw: 1.2, inner: L("M27 47H37M27 50H37M27 53H37M27 56H37", m.s, 1.6) }) +
    S("M23.5 7Q23.5 3 27.5 3H36.5Q40.5 3 40.5 7V38Q40.5 43 36 45.5H28Q23.5 43 23.5 38Z", T.willow, { a: [4, 1], inner: L("M32 6V42", T.willow.h, 2.4, .7) + L("M26 8V38", T.willow.s, 1, .5) }) +
    L("M28.5 45.5L32 37.5L35.5 45.5", INK, 1.6, .6) + F(R(25.6, 29, 12.8, 7, 1), T.red.b, 1.4) + Tx(32, 34.2, "SORRY", 4, "#fff")), 42),

  hockeystick: (m) => lay(
    rod("M38 -3V46C38 60 30 67 19 61", P.wood, 10.6) +
    L("M38 10V34", "#f3f6fd", 10.8) + L("M33 13.5L43 9.5M33 18L43 14M33 22.5L43 18.5M33 27L43 23M33 31.5L43 27.5M33 36L43 32", "#aeb8d0", 1.4) +
    L("M32.6 10V34M43.4 10V34", INK, 1.8) + L("M35.4 11V33", "#fff", 1.6, .9) +
    L("M38 -2.5V8", m.b, 10.8) + L("M38 -2V8", m.h, 2, .7, ' transform="translate(-2.6 0)"') + L("M32.6 -2.5V8M43.4 -2.5V8", INK, 1.8) + L("M32.6 -3H43.4", INK, 2.4) +
    L("M33 2.5H43", m.s, 1.4) +
    L("M33.8 51C33 55 31 58 28 60", "#f3f6fd", 7.4) + L("M30.6 53L36 56M28.6 56L33 60", "#aeb8d0", 1.2), 38),

  rolledmenu: (m) => rot(G("translate(32 31.5) scale(1.24) translate(-32 -31.5)",
    S(R(12, 22, 40, 19, 3), P.paper, { a: [0, 3.5], b: [0, 2], inner: fill(R(12, 22, 40, 6, 0), m.b) + L("M17 32H27M17 36H25M33 32H47M33 36H44", INK, 1.8, .35) + F(R(36, 23.5, 3, 3.4, .5), "#fff", .8) + F(R(41, 23.5, 3, 3.4, .5), "#fff", .8) }) +
    F(E(52, 31.5, 3.6, 9.5), P.paper.s, 2.2) + L("M52 31.5a1.2 2.4 0 1 0 0.1 0M52 27a2.6 4.6 0 1 1 -0.2 0", INK, 1.2, .6) +
    S(R(26, 20.5, 4.5, 22, 1.5), T.tan, { a: [1, 0], b: 0, sw: 2 }) + F(E(12, 31.5, 3.6, 9.5), P.paper.h, 2.2) + L("M12 31.5a1.4 3 0 1 1 0.1 0M12 26a2.8 5 0 1 0 -0.2 0", INK, 1.2, .5)), -32),

  selfie: (m) => lay(
    L("M28 70C18 76 15 62 27 62", INK, 4.4) + L("M28 70C18 76 15 62 27 62", m.b, 2.6) +
    S(R(26.6, 51, 10.8, 20, 4), P.rubber, { a: [2.6, 0], b: [1.4, 0], hw: 1.4, inner: L("M26 56H38M26 59.6H38M26 63.2H38M26 66.8H38", P.rubber.h, 1.2, .6) }) + S(C(32, 54.6, 2.4), m, { a: .6, b: 0, sw: 1.6 }) +
    shaft(40, 52, 7.6, P.metal, { sw: 2.2 }) + S(R(27.4, 48.6, 9.2, 3.4, 1.2), P.dmetal, { a: 0, b: 0, sw: 1.8 }) +
    shaft(28, 41, 6.4, P.metal, { sw: 2.2 }) + S(R(28, 38.4, 8, 3, 1.2), P.dmetal, { a: 0, b: 0, sw: 1.8 }) +
    shaft(17, 29, 5.2, P.metal, { sw: 2 }) +
    S(R(26.6, 14, 10.8, 5.4, 1.6), P.dark, { a: [0, 1.2], b: 0, sw: 2 }) +
    S(R(19, 0, 26, 15.6, 2.8), P.dark, { a: [0, 1.6], b: 0, sw: 2.4 }) + fill(R(21.4, 2.4, 21.2, 10.8, 1.2), "#4a7dff") + fill("M21.4 2.4H33L24 13.2H21.4Z", "#9fbcff", .7) +
    F(C(32, 8.6, 3), "#ffd23d", 1.2) + `<circle cx="30.9" cy="8" r=".8" fill="${INK}"/><circle cx="33.1" cy="8" r=".8" fill="${INK}"/>` + L("M30.6 9.8Q32 11 33.4 9.8", INK, .8)),

  fishslice: (m) => lay(
    S("M20 2H44L41.6 26Q32 30 22.4 26Z", P.metal, { a: [3.4, 2], b: 2, inner: [24.6, 28.8, 33, 37.2].map((x) => fill(R(x, 6.4, 2.4, 15.6, 1.2), INK, .8)).join("") }) +
    shaft(27, 40, 4.4, P.metal, { sw: 2.2 }) +
    S(R(26.4, 38, 11.2, 31, 4.6), m, { a: [3, 0], b: [1.6, 0], inner: F(C(32, 63, 2.2), INK, 0) + L("M26 43H38", INK, 1.6, .4) }) + S(R(27.6, 36.4, 8.8, 4, 1.4), P.metal, { a: [1.2, 0], b: 0, sw: 2 }) +
    F(C(29.8, 48.6, 2.4) + C(34.2, 48.6, 2.4) + C(29.8, 53, 2.4) + C(34.2, 53, 2.4), T.green.b, 1.2) + L("M32 52L33.6 57", INK, 1.2)) + Sp(12, 14, 3.6),

  gardenfork: (m) => lay(
    shaft(26, 56, 8.6, P.wood) +
    [21.6, 28.8, 36].map((x) => S(`M${x - 2.6} 22V8Q${x - 2.6} 3 ${x} 2Q${x + 2.6} 3 ${x + 2.6} 8V22Z`, P.dmetal, { a: [1.4, 0], b: [.8, 0], sw: 2.2 })).join("") +
    S("M40.6 22V12Q41 6 45.4 3Q48 2.4 48.2 5Q45.4 8.6 45.4 13V22Z", P.dmetal, { a: [1.4, 0], b: 0, sw: 2.2 }) +
    S("M17 18H47V24Q47 30 32 30Q17 30 17 24Z", P.dmetal, { a: [0, 2.4], b: 1.2 }) + S(R(28.6, 28, 6.8, 5, 1.4), P.dmetal, { a: [1, 0], b: 0, sw: 2 }) +
    L("M17.6 21H46", P.dmetal.h, 1.2, .8) +
    L("M27 56L25 65H39L37 56", INK, 6) + L("M27 56L25 65H39L37 56", m.b, 3.4) + S(R(22.6, 62.6, 18.8, 5, 2.2), P.wood, { a: [0, 1.4], b: 0, sw: 2.2 })),

  rollingpin: (m) => rot(
    S(R(3, 27, 12, 8, 4), P.dwood, { a: [0, 2], b: [0, 1] }) + S(R(49, 27, 12, 8, 4), P.dwood, { a: [0, 2], b: [0, 1] }) +
    S(R(14, 22, 36, 18, 3), P.oat, { a: [0, 4], b: [0, 2], inner: L("M14 27H50", P.oat.h, 1.6, .7) + L("M20 34C26 33 32 35 38 34", P.oat.s, 1.2, .6) }) +
    F(E(14, 31, 2.4, 9), P.oat.s, 2) + F(E(50, 31, 2.4, 9), P.oat.s, 2) +
    L("M36 22C38 30 40 40 42 46", T.red.b, 1.4) + G("rotate(28 44 50)", S(R(36, 45, 16, 10, 1.5), P.paper, { a: 1, b: 0, sw: 1.8 }) + fill(R(36, 45, 3.5, 10, 0), m.b) + Tx(45.5, 53, "77", 7.4, T.red.s)), -30),

  doorstop: (m) =>
    S(R(30, 2, 30, 36, 1), P.white, { a: [0, 2], b: 0, inner: fill(R(30, 2, 30, 36, 0), "#e7eaf1") + L("M36 8H54V30H36Z", P.white.s, 1.4, .8) }) + L("M30 38H62", INK, 2.4) +
    S("M4 50H50V30Z", m, { a: [0, 2], b: [0, 1.4] }) +
    S("M4 50L50 30L58 24L12 44Z", pal(m.h, m.b, "#fff"), { a: 0, b: 0, inner: L("M17 42.4L53 23.6M22 43.6L57 25M12 41L49 22", m.s, 1.6, .8) }) +
    S("M50 30V50L58 44V24Z", dk(m), { a: 1, b: 0 }) +
    L("M4 58H60", INK, 2, .25) + L("M10 34L16 30M8 28L12 25", INK, 2.2, .5),

  timetable: (m) => rot(
    S(R(11, 7, 42, 50, 2), P.white, { a: [2.5, 2.5], b: 1.6, inner: fill(R(11, 7, 42, 11, 0), m.b) + L("M16 24H48M16 30H48M16 36H48M16 42H48M16 48H48", INK, 1.2, .3) + L("M26 21V52M37 21V52", INK, 1.2, .3) +
      fill("M17 26h5v1.6h-5Z M28 26h6v1.6h-6Z M39 26h6v1.6h-6Z M17 32h5v1.6h-5Z M28 32h6v1.6h-6Z M39 38h6v1.6h-6Z M17 44h5v1.6h-5Z M28 44h6v1.6h-6Z M28 50h6v1.6h-6Z", INK, .55) }) +
    emb("bus", 20, 12.4, .55) + L("M27 10.5H47M27 14.5H40", "#fff", 2, .9) +
    fill("M14 54L50 10L53 13L19 57Z", "#fff", .28) + F(C(48, 51, 1.8), "none", 1.4), -8),

  binlid: (m, v) =>
    S(E(32, 39, 27, 15), P.dmetal, { a: 0, b: 0 }) +
    S(E(32, 35, 27, 15), m, { a: [0, 3], b: [1.6, 1.6], inner: L(E(32, 35, 20, 11), m.s, 1.6, .7) + L(E(32, 35, 13, 7), m.s, 1.6, .7) + L(E(32, 34.4, 26, 14), m.h, 1.2, .6) }) +
    L("M24 33C24 22 40 22 40 33", INK, 6) + L("M24 33C24 22 40 22 40 33", P.metal.b, 3) + L("M25.4 30C26 25 30 24 33 24", "#fff", 1, .8) +
    F(E(24, 33.4, 2.8, 1.6), P.dmetal.b, 1.4) + F(E(40, 33.4, 2.8, 1.6), P.dmetal.b, 1.4) + Gl(14, 30, 1.4, 4, 60, .6) +
    (v === "dent" ? L("M44 41C46 40 48 42 50 41", INK, 1.6, .5) + fill(E(46, 41, 4, 2), INK, .15) : ""),

  halberd: (m) => lay(
    shaft(22, 68, 8.4, P.wood) + S(R(26.8, 62, 10.4, 7, 2), P.dmetal, { a: [1.6, 0], b: 0, sw: 2.2 }) +
    S("M32 -8L36.4 12H27.6Z", P.metal, { a: [2, 0], b: [1, 0], sw: 2.4 }) +
    S("M35 9C46 3 58 12 60 31C52 26 43 27 35 32Z", P.metal, { a: [2.4, 2], b: 1.4, inner: L("M38 13C45 11 52 16 55 23", "#fff", 1.6, .7) + L("M58 26C53 24 46 25 38 29", P.metal.s, 1.4, .6) }) +
    S("M29 12L16 6L19 15L29 21Z", P.metal, { a: 1.4, b: 0, sw: 2.2 }) +
    S(R(27.6, 9, 8.8, 19, 2), P.dmetal, { a: [1.6, 0], b: [.8, 0], sw: 2.2 }) + dots([[32, 13], [32, 23]], 1.2, P.metal.h, .9) +
    L("M29 30C24 35 26 40 23 44M32 30C30 36 32 40 30 46M35 30C34 36 37 39 36 44", INK, 5) + L("M29 30C24 35 26 40 23 44M32 30C30 36 32 40 30 46M35 30C34 36 37 39 36 44", m.b, 2.8) +
    S(R(27.4, 27.4, 9.2, 4.4, 1.6), P.gold, { a: [1.6, 0], b: 0, sw: 2 })),

  pike: (m, v) => lay(
    (v === "rainbow"
      ? L("M32 25V70", INK, 13.6) + ["#ff4d5e", "#ff8a2b", "#ffd23d", "#45d483", "#4a7dff", "#9b5de5"].map((c, i) => L(`M32 ${f(25 + i * 7.5)}V${f(32.5 + i * 7.5)}`, c, 10.2, null, ' stroke-linecap="butt"')).join("") +
        L("M35.4 26V69", INK, 2.6, .22) + L("M28.8 26V69", "#fff", 1.8, .6)
      : shaft(25, 70, 8.8, P.wood) + bands([60], 8.8, 6, P.dwood)) +
    S("M32 -5C43 6 44 16 32 28C20 16 21 6 32 -5Z", P.metal, { a: [3, 0], b: [1.6, 0], inner: L("M32 0V24", P.metal.s, 2, .75) + fill("M32 -2C38 6 38 14 32 22Z", "#fff", .25) }) +
    S(R(26.5, 24, 11, 7.6, 2), m === T.gold ? P.gold : P.dmetal, { a: [2, 0], b: 0, sw: 2.2 }) + dots([[29.4, 27.8], [34.6, 27.8]], 1, P.metal.h, .9) +
    (v === "cloud" ? S(cloudD(32, 30, 1.25), P.white, { a: [0, 2], b: 0, sw: 2.2 }) + TL("M20 2L24.6 7L22 8L26 13", "#ffd23d", 2.2) + TL("M45 2L40.6 7L43 8L39 13", "#ffd23d", 2.2) : "") +
    (v === "star" ? glow(32, 8, 13, "#fff3a0", .5) + S(star(32, 8, 9.5, 4, 5, -90), P.gold, { a: 1.4, b: 1, sw: 2 }) : "")),

  oar: (m) => diag(
    S(R(28.4, -2, 7.2, 48, 2.6), P.wood, { a: [2, 0], b: [1.2, 0] }) + S(R(27.6, -2, 8.8, 9, 2.8), P.dwood, { a: [1, 0], b: 0, sw: 2 }) +
    S("M23 42H41L42.6 61Q32 67 21.4 61Z", P.wood, { a: [2, 1], b: 1, inner: L("M32 44V60", P.wood.s, 1.4, .6) }) +
    S(C(32, 22, 12), P.wood, { a: 2.4, b: 1.6, inner: L("M24 12V32M28.6 10.4V33.6M35.4 10.4V33.6M40 12V32", P.wood.s, 1.2, .7) + fill("M32 22L32 10A12 12 0 0 1 44 22Z M32 22L32 34A12 12 0 0 1 20 22Z", m.b) }) +
    `<circle cx="32" cy="22" r="11.6" fill="none" stroke="${P.dmetal.b}" stroke-width="2"/>` + dots([[32, 10.6], [43.4, 22], [32, 33.4], [20.6, 22]], .9, P.metal.h, .8) + S(C(32, 22, 3.6), P.metal, { a: 1, b: .8, sw: 2 }), 45),

  cane: (m) => {
    const q = tone("black") === m ? pal("#3d4466", "#262b45", "#8c99c8") : P.dwood;
    return lay(
      rod("M37 54V20C37 4 17 3 17 17", q, 9.6) + S(C(17, 18, 4.6), P.metal, { a: 1, b: .8, sw: 2.2 }) +
      S(R(31.4, 27, 11.2, 5.6, 1.6), P.gold, { a: [2, 0], b: 0, sw: 2.2, inner: L("M31 29.8H43", P.gold.s, 1, .7) }) +
      L("M37 53L30 55.4L44 58.6L30 61.8L44 65L30 68.2L37 70", INK, 6) + L("M37 53L30 55.4L44 58.6L30 61.8L44 65L30 68.2L37 70", P.metal.b, 3.2) + L("M37 53L30 55.4L44 58.6L30 61.8L44 65L30 68.2", "#fff", 1, .8) +
      S(R(31.4, 50, 11.2, 5, 1.6), P.gold, { a: [2, 0], b: 0, sw: 2.2 }) + S(R(31, 69, 12, 4.4, 2), P.dark, { a: [0, 1.2], b: 0, sw: 2.2 }), 40);
  },

  pole: (m, v) => {
    if (v === "bent") return lay(
      rod("M31 70C30 60 35 50 33 38C31 28 34 20 32 8", P.dwood, 12) + F(E(32.4, 30, 2, 3), P.dwood.s, 1.3) + F(E(33.8, 50, 2, 3), P.dwood.s, 1.3) + L("M29 40C27 37 27 34 28 32", P.dwood.h, 1.4, .8) +
      L("M29 18C21 20 21 30 30 28", INK, 4.4) + L("M29 18C21 20 21 30 30 28", T.green.b, 2.4) +
      S(R(25.4, 6, 13, 15, 3), T.brown, { a: [2.4, 0], b: [1.2, 0], sw: 2.4, inner: L("M25 9.5L39 7.5M25 13.5L39 11.5M25 17.5L39 15.5", T.brown.s, 1.4) }) +
      S(E(32, 4.6, 5.2, 3), P.dwood, { a: [1, 0], b: 0, sw: 2.2 }) +
      S("M27 66L31 75L35 66Z", P.metal, { a: [1.2, 0], b: 0, sw: 2 }) + S(R(26.6, 62, 9, 5, 1.4), P.metal, { a: [1.6, 0], b: 0, sw: 2 }));
    const carbon = v === "carbon", gq = carbon ? P.rubber : T.tan;
    return lay(
      L("M27 6C17 9 18 22 27 20", INK, 4.4) + L("M27 6C17 9 18 22 27 20", m.b, 2.6) +
      S("M24.2 4Q24.2 -3 32 -3Q39.8 -3 39.8 4V22H24.2Z", gq, { a: [3, 0], b: [1.4, 0], inner: L("M24 4H40M24 8.5H40M24 13H40M24 17.5H40", INK, 1.4, .3) }) +
      shaft(21, 44, 10.4, carbon ? P.rubber : m, { inner: carbon ? L("M27 24L37 30M27 31L37 37M27 38L37 44", "#8c99c8", 1.4, .7) : "" }) +
      S(R(25, 40, 14, 5.6, 1.6), m, { a: [2, 0], b: 0, sw: 2.2 }) +
      shaft(44, 64, 8, carbon ? P.rubber : P.metal, { sw: 2.2 }) + S(R(25.6, 30, 12.8, 4.6, 1.4), m, { a: [1.6, 0], b: 0, sw: 2 }) +
      S(E(32, 61, 11, 3.6), P.dark, { a: [0, 1], b: 0, sw: 2.2 }) + S("M29.4 63L32 72L34.6 63Z", P.metal, { a: [1, 0], b: 0, sw: 1.8 }));
  },

  caber: () => diag(
    S("M23 9Q23 3 32 3Q41 3 41 9V57Q41 62 32 62Q23 62 23 57Z", T.brown, { a: [4, 0], b: [2.4, 0], inner: L("M27 10C28 20 26 28 28 40C29 48 27 54 28 60M35 8C34 18 37 26 35 36C33 46 36 52 34 60M38.5 14V22M25 30V38", T.brown.s, 1.6, .8) + F(E(30, 34, 1.6, 2.6), T.brown.s, 1.2) }) +
    S(E(32, 7, 9, 3.6), T.tan, { a: 0, b: 0, sw: 2.2, inner: L(E(32, 7, 5.6, 2.2), T.tan.s, 1, .8) + L(E(32, 7, 2.4, 1), T.tan.s, 1, .8) }), 32),

  gatepost: (m) =>
    S(R(19, 13, 26, 48, 1.5), T.stone, { a: [4, 0], b: [2, 1], inner: L("M19 23H45M19 33H45M19 43H45M19 53H45M30 13V23M37 23V33M27 33V43M36 43V53M29 53V61", T.stone.s, 1.6, .8) }) +
    S(R(15.5, 7, 33, 7, 1.5), T.stone, { a: [0, 2], b: [0, 1.2] }) + S("M21 7L32 1L43 7Z", T.stone, { a: [0, 1.2], b: 0, sw: 2.2 }) +
    S(R(44, 20, 9, 3, 1.2), P.dmetal, { a: 0, b: 0, sw: 1.8 }) + S(R(44, 46, 9, 3, 1.2), P.dmetal, { a: 0, b: 0, sw: 1.8 }) + F(R(50, 17, 3, 9, 1.2), P.dmetal.b, 1.6) + F(R(50, 43, 3, 9, 1.2), P.dmetal.b, 1.6) +
    F("M21 58C23 54 27 55 28 58Z", T.green.b, 1.4) + F("M38 58C40 55 43 55 44 58Z", T.green.b, 1.4),

  fivebar: (m) =>
    glow(32, 44, 26, "#ffd25a", .45) +
    S("M32 44A16 16 0 0 1 48 44Z", T.yellow, { a: 0, b: 0, sw: 2 }) + L("M32 24V20M44 30L47 27M20 30L17 27M50 40H54M14 40H10", T.orange.b, 2.2) +
    S(R(5, 14, 6, 44, 1.5), P.wood, { a: [1.6, 0], b: 0 }) + S(R(53, 14, 6, 44, 1.5), P.wood, { a: [1.6, 0], b: 0 }) +
    [17, 25, 33, 41, 49].map((y) => S(R(9, y, 46, 4.4, 1), P.wood, { a: [0, 1.4], b: [0, .8], sw: 2.2 })).join("") +
    TL("M11 51L53 19", P.wood.b, 3.4) + S(R(3, 56, 10, 4, 1.4), P.dwood, { a: 0, b: 0, sw: 1.8 }) + S(R(51, 56, 10, 4, 1.4), P.dwood, { a: 0, b: 0, sw: 1.8 }),

  clockhand: (m) => lay(
    glow(32, 14, 18, "#fff3a0", .4) +
    S("M32 -2L45.4 16.6L36.6 14.6V19H27.4V14.6L18.6 16.6Z", m, { a: [2.6, 1.2], b: 1.4, inner: L("M32 1.6V15", m.h, 1.6, .8) }) +
    S(C(32, 27, 10) + C(32, 27, 4.4), m, { ev: 1, a: 2, b: 1.4 }) + L("M24.6 20L20 15.4M39.4 20L44 15.4M24.6 34L20 38.6M39.4 34L44 38.6", INK, 4.6) + L("M24.6 20L20 15.4M39.4 20L44 15.4M24.6 34L20 38.6M39.4 34L44 38.6", m.b, 2.4) +
    fill(C(20, 15.4, 2.2) + C(44, 15.4, 2.2) + C(20, 38.6, 2.2) + C(44, 38.6, 2.2), m.b) +
    shaft(36, 58, 7.6, m, { sw: 2.4 }) + S(C(32, 62.5, 7.4) + C(32, 62.5, 2.6), m, { ev: 1, a: 1.8, b: 1.2, sw: 2.4 }) + Gl(28.6, 22.6, 2, 1.2, -35, .9)),

  whip: (m, v) => {
    const th = "M17 46C22 30 45 38 52 24C58 11 43 2 31 9C22 15 28 31 44 31";
    let thong;
    if (v === "rainbow") thong = L(th, INK, 8.6) + ["#ff4d5e", "#ff8a2b", "#ffd23d", "#45d483", "#4a7dff", "#9b5de5"].map((c, i) => `<path d="${th}" pathLength="60" fill="none" stroke="${c}" stroke-width="5.4" stroke-dasharray="10 50" stroke-dashoffset="${-i * 10}"/>`).join("") + L(th, "#fff", 1.2, .5, ' transform="translate(-1 -1)"');
    else if (v === "comet") thong = glow(44, 31, 15, "#b8ecff", .65) + L(th, "#b8ecff", 14, .3) + L(th, INK, 9) + L(th, "#7fe0ff", 6) + L(th, "#fff", 2, .85) + S(C(44, 31, 6.4), T.cyan, { a: 1.6, b: 1.2 }) + Sp(44, 31, 3.4) + Sp(56, 46, 3.8) + Sp(8, 12, 3);
    else thong = L(th, INK, 8.6) + L(th, m.s, 5.6) + L(th, m.b, 3, null, ' transform="translate(-.7 -.7)"') + L(th, INK, 5.6, .25, ' stroke-dasharray="1.4 3" stroke-linecap="butt"');
    let out = thong + L("M44 31L50 30", INK, 4.6) + L("M44 31L50 30", "#f3e3c3", 2.4) +
      G("rotate(32 13 52)", S(R(7, 41, 12, 23, 4.4), P.dmetal === m ? P.dark : P.dwood, { a: [3, 0], b: [1.6, 0], inner: L("M6 46L20 48.6M6 51L20 53.6M6 56L20 58.6", P.dwood.s, 1.6) }) + S(R(5.8, 38.6, 14.4, 5, 2), P.gold, { a: [0, 1.4], b: 0, sw: 2 }));
    if (v === "post") out += G("rotate(-12 48 50)", S(R(37, 42, 23, 16, 1.4), P.paper, { a: [0, 1.6], b: 0, sw: 2.2 }) + L("M37 42L48.5 51L60 42", INK, 1.8, .7) + F(R(54, 44, 4.4, 5, .6), T.red.b, 1.2)) + L("M45 37L47 42", INK, 1.6);
    if (v === "rainbow") out += S("M42 49H60L57.6 62H44.4Z", P.dark, { a: [1.8, 1.2], b: 0, sw: 2.2 }) + dots([[46, 48], [51, 47], [56, 48], [48.6, 44.6], [53.6, 44.6]], 2.8, P.gold.b, 1.3);
    return out;
  },

  crop: (m) => lay(
    shaft(6, 50, 5.6, P.dark, { sw: 2.2 }) + S("M25 -5H39L37 8H27Z", T.brown, { a: [2, 0], b: [1, 0], sw: 2.2, inner: L("M28 -1H36", T.brown.s, 1.2) }) +
    S(R(26.6, 46, 10.8, 22, 3.6), T.brown, { a: [2.6, 0], b: [1.4, 0], inner: L("M25 50L39 53M25 55L39 58M25 60L39 63M25 65L39 68", T.brown.s, 1.6) }) +
    L("M27 70C18 75 16 62 27 63", INK, 4.4) + L("M27 70C18 75 16 62 27 63", T.brown.b, 2.6) + bands([44], 10.8, 4, P.gold), 40) +
    G("rotate(-10 47 49)", S(R(33, 40, 28, 17, 1.6), P.paper, { a: [0, 1.6], b: 0, sw: 2.2 }) + L("M36 44H52", INK, 1, .3) + Tx(47, 53.4, "100/1", 8.6, T.red.s)),

  chessclock: (m) =>
    L("M14 52L19 47M21 45L25 41M27 39L30 36", INK, 5) + [[16.5, 49.5], [23, 43], [28.5, 37.5]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2" transform="rotate(-45 ${x} ${y})" fill="none" stroke="${INK}" stroke-width="4"/><ellipse cx="${x}" cy="${y}" rx="3.4" ry="2" transform="rotate(-45 ${x} ${y})" fill="none" stroke="${P.metal.b}" stroke-width="1.8"/>`).join("") +
    G("rotate(-45 10 56)", S(R(6, 50, 8, 14, 3), P.dwood, { a: [1.6, 0], b: [1, 0] })) +
    S(R(37, 11, 6, 5, 1.5), T.red, { a: 0, b: 0, sw: 1.8 }) + S(R(51, 13, 6, 5, 1.5), P.dark, { a: 0, b: 0, sw: 1.8 }) +
    S("M28 18H60L57 42H31Z", P.dwood, { a: [2, 2], b: 1.4 }) +
    S(C(38, 29, 6.5), P.white, { a: 1, b: 0, sw: 2 }) + S(C(51, 29, 6.5), P.white, { a: 1, b: 0, sw: 2 }) +
    L("M38 25V29L41 31M51 25V29L48 27", INK, 1.6) + F("M38.2 22.4L39.6 20.6L40.4 22.8Z", T.red.b, .8),

  trophy: (m) =>
    L("M18 13C9 13 9 27 20 27M46 13C55 13 55 27 44 27", INK, 6) + L("M18 13C9 13 9 27 20 27M46 13C55 13 55 27 44 27", P.gold.s, 3) +
    S("M17 8H47V20C47 31 40 37 32 37C24 37 17 31 17 20Z", P.gold, { a: [4, 2], b: 2.4, inner: L("M17 12H47", P.gold.h, 1.6, .7) }) + F(E(32, 8, 15, 3), P.gold.s, 2.2) +
    S("M29 36H35L36 45H28Z", P.gold, { a: [1.4, 0], b: 0, sw: 2 }) + S(R(21, 44, 22, 5, 1.5), P.gold, { a: [0, 1.4], b: 0, sw: 2 }) +
    S(R(18, 49, 28, 11, 1.5), P.dwood, { a: [0, 2.4], b: [0, 1.2] }) + S(R(24, 51.5, 16, 6, 1), P.metal, { a: 0, b: 0, sw: 1.6 }) + Tx(32, 56.6, "QUIZ", 4.6, INK) +
    S(star(32, 21, 6, 2.6, 5, -90), P.white, { a: 0, b: 0, sw: 1.6 }) + Gl(22, 18, 1.4, 5, 0, .8),

  binbag: (m) =>
    S("M16 26C10 34 8 46 12 54C16 60 48 60 52 54C56 46 54 34 48 26C44 22 40 21 36 20H28C24 21 20 22 16 26Z", m, { a: [4, 3], b: 2.4, inner: L("M20 30C22 40 20 48 24 56M44 28C41 38 45 48 41 56M30 24C32 34 30 46 33 58", m.h, 1.6, .5) + PAT.gems() }) +
    S("M26 21L23 10L29 14L32 6L35 14L41 10L38 21Z", m, { a: [1.4, 0], b: 1, sw: 2.2 }) + S(R(26.5, 18.5, 11, 4, 2), dk(m), { a: 0, b: 0, sw: 2 }),

  microwave: (m, v) =>
    (v === "universe" ? glow(28, 34, 26, "#8a6bff", .35) : "") +
    TL("M44 10L48 4", P.dmetal.b, 1.6) + S("M40 9C42 1 54 1 56 9Z", P.metal, { a: [0, 1.2], b: 0, sw: 2 }) + F(C(48, 4.4, 1.4), T.red.b, 1) +
    S("M6 20L14 12H58L50 20Z", m, { a: 0, b: 0, sw: 2.2, inner: fill("M6 20L14 12H58L50 20Z", "#fff", .25) }) +
    S("M50 20L58 12V44L50 52Z", dk(m), { a: [1, 0], b: 0 }) +
    S(R(6, 20, 44, 32, 2.5), m, { a: [0, 2.6], b: [1.4, 1.4] }) +
    S(R(10, 24, 27, 24, 2), pal("#2a3358", "#1a2040", "#4a578a"), { a: 0, b: 0, sw: 2,
      inner: v === "universe" ? fill(R(10, 24, 27, 24, 0), "#120c2e") + PAT.starfield() + L("M23 36a2 2 0 0 1 4 0a4 4 0 0 1 -8 0a6 6 0 0 1 12 0", "#d6c2ff", 1.6) + `<circle cx="23" cy="36" r="1.8" fill="#fff"/>`
        : fill(E(23.5, 44, 10, 2.4), "#3a4677") + G("rotate(-30 23 36)", L("M23.5 34V46", INK, 4) + L("M23.5 34V46", P.metal.b, 2) + L("M20 25V31Q20 34 23.5 34Q27 34 27 31V25M23.5 25V31", INK, 3) + L("M20 25V31Q20 34 23.5 34Q27 34 27 31V25M23.5 25V31", P.metal.b, 1.2)) +
          L("M14 28L17 31L15 33L19 36M33 28L30 32L33 34", "#ffe95c", 1.6) }) + Gl(14, 27, 1, 3, 30, .5) +
    F(R(40, 25, 7, 4, 1), P.lcd.b, 1.4) + dots([[41.5, 33], [45.5, 33], [41.5, 37], [45.5, 37], [41.5, 41], [45.5, 41]], 1.2, "#e7ecf6", 1) + S(R(39.5, 44, 8, 4, 1.5), P.dark, { a: 0, b: 0, sw: 1.6 }) +
    F(R(10, 52, 6, 3, 1), P.dark.b, 1.6) + F(R(40, 52, 6, 3, 1), P.dark.b, 1.6),

  whisk: (m, v) => lay(
    (v === "particle" ? glow(32, 16, 18, "#7fe0ff", .5) + `<ellipse cx="32" cy="17" rx="26" ry="8" transform="rotate(-30 32 17)" fill="none" stroke="${INK}" stroke-width="4" opacity=".5"/><ellipse cx="32" cy="17" rx="26" ry="8" transform="rotate(-30 32 17)" fill="none" stroke="#7fe0ff" stroke-width="2.2"/>` : "") +
    ["M28.4 40C17 28 17 6 32 -4C47 6 47 28 35.6 40", "M29.6 40C23 28 23 7 32 -2C41 7 41 28 34.4 40", "M30.8 40C28.6 28 28.6 8 32 0C35.4 8 35.4 28 33.2 40"].map((d) => L(d, INK, 4.6) + L(d, P.metal.b, 2.4) + L(d, "#fff", .9, .75, ' transform="translate(-.5 -.5)"')).join("") +
    shaft(38, 68, 10, m, { inner: F(C(32, 63, 2), INK, 0) }) + S(R(26.4, 37, 11.2, 5.4, 1.8), P.metal, { a: [1.4, 0], b: 0, sw: 2 }) +
    (v === "particle" ? dots([[8, 24], [56, 8], [52, 28]], 2.6, "#b8ecff", 1.3) : "")),

  blender: (m) =>
    glow(32, 30, 24, "#a8f0ff", .25) +
    S("M20 15H44L41 46H23Z", P.glass, { a: [3, 0], b: [2, 0], inner: fill("M0 26H64V64H0Z", "#9ef0b8") + fill("M0 26H64V28H0Z", "#d8ffe4") + F(C(28, 34, 2.4), "#fff", 1.4) + F(C(36, 34, 2.4), "#fff", 1.4) + `<circle cx="28.4" cy="34.4" r="1.1" fill="${INK}"/><circle cx="36.4" cy="34.4" r="1.1" fill="${INK}"/>` + F(E(32, 40, 2.4, 2), INK, 0) + L("M22 22V42", "#fff", 1.4, .6) }) +
    L("M43 20C51 20 51 34 42 34", INK, 5.4) + L("M43 20C51 20 51 34 42 34", P.glass.s, 2.4) +
    S(R(18.5, 10, 27, 6, 2), P.dark, { a: [0, 1.6], b: 0 }) + S(R(28, 6, 8, 5, 1.5), P.dark, { a: 0, b: 0, sw: 2 }) +
    S("M19 46H45L48 60H16Z", m, { a: [0, 3], b: [1.2, 1.2] }) + F(C(32, 53, 3.2), P.metal.b, 1.6) + L("M32 53L33.6 51", INK, 1.2) + dots([[23, 53], [41, 53]], 1.4, T.red.b, 1) +
    G("rotate(10 52 46)", S(C(52, 42, 5.5), T.blue, { a: 1, b: .6, sw: 2 }) + F("M49 46L47 55L50 53.5L52 56L53 47Z", T.blue.b, 1.6) + Tx(52, 44.4, "1", 6, "#fff")),

  testtube: (m) => lay(
    glow(32, 38, 22, m.h, .5) +
    S("M22.6 8H41.4V52A9.4 9.4 0 0 1 22.6 52Z", P.glass, { a: [3.4, 0], b: [2, 0], inner: fill("M0 20H64V70H0Z", "#1d1440") + fill(E(29, 30, 11, 7), m.b, .8) + fill(E(36, 42, 9, 6), "#ff6fb0", .65) + fill(E(29, 52, 8, 5), "#4cc3ff", .6) +
      [[28, 26], [36, 33], [29, 42], [35, 52], [26, 37], [33, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#fff"/>`).join("") + Sp(33, 25, 3.2) + Sp(29, 47, 2.2) + fill("M22 20H42", "#fff") + L("M22 20H42", "#cfaaff", 1.2, .8) }) +
    S(R(20.4, 4.6, 23.2, 5, 2), P.glass, { a: [0, 1.2], b: 0, sw: 2.2 }) + S(R(24.4, -3, 15.2, 9, 2.4), T.tan, { a: [2, 0], b: [1, 0], sw: 2.2, inner: L("M24 0H40", T.tan.s, 1.2, .7) }) + Gl(27, 16, 1.4, 6, 0, .8)),

  fireworkbag: (m) =>
    [[22, 26, -14, T.red], [32, 22, 0, T.blue], [42, 26, 14, T.green]].map(([x, y, a, q]) => G(`rotate(${a} ${x} 40)`, S(R(x - 4, y - 14, 8, 18, 1.5), q, { a: [2, 0], b: [1.2, 0], inner: fill(R(x - 4, y - 8, 8, 3, 0), "#fff", .9) }) + S(`M${x - 4.5} ${y - 13.5}L${x} ${y - 21}L${x + 4.5} ${y - 13.5}Z`, P.gold, { a: [1, 0], b: 0, sw: 2 }))).join("") +
    TL("M47 18C50 12 54 12 56 8", "#8a93ad", 1.4) + Sp(57, 7, 3.6, "#ffd23d") + Sp(8, 14, 2.8, "#ffd23d") +
    S("M13 28H51L48 61H16Z", T.tan, { a: [4, 2], b: 2, inner: L("M13 33H51", T.tan.s, 1.6, .6) + L("M20 34L21 58M43 34L42 58", T.tan.s, 1.2, .5) }) +
    F("M13 28L16 32H48L51 28Z", T.tan.h, 2) + Tx(32, 54, "?", 20, m.b, { stroke: INK, sw: 2.4 }),

  dowsing: (m, v) => v === "l"
    ? glow(32, 52, 22, m.h, .45) + L("M0 58C14 48 24 58 34 48C42 41 52 46 64 38", INK, 7, .5) + L("M0 58C14 48 24 58 34 48C42 41 52 46 64 38", m.b, 4) + L("M0 58C14 48 24 58 34 48C42 41 52 46 64 38", m.h, 1.4, .9, ' stroke-dasharray="3 3"') +
      [[16, 1], [48, -1]].map(([x, s]) => L(`M${x} 44V34L${x + s * 38} 8`, INK, 6.4) + L(`M${x} 44V34L${x + s * 38} 8`, P.gold.b, 3.6) + L(`M${x - 1} 43V34.6L${x - 1 + s * 37} 9`, "#fff3a8", 1.1, .9) +
        S(R(x - 5, 40, 10, 22, 3.6), P.dwood, { a: [2.4, 0], b: [1.2, 0], inner: L(`M${x - 6} 46H${x + 6}M${x - 6} 50H${x + 6}M${x - 6} 54H${x + 6}`, P.dwood.s, 1.2) })).join("") +
      glow(32, 23, 9, "#fff3a0", .7) + Sp(32, 23, 5)
    : glow(32, 52, 16, m.h, .55) +
      rod("M8 4C15 13 25 26 31 40", P.wood, 8) + rod("M56 4C49 13 39 26 33 40", P.wood, 8) + rod("M32 38V61", P.wood, 9) +
      F(E(18, 16, 1.8, 2.6), P.wood.s, 1.2) + F(E(46, 18, 1.8, 2.6), P.wood.s, 1.2) + S(R(26.6, 40, 10.8, 6, 2), m, { a: [2, 0], b: 0, sw: 2.2 }) +
      L("M2 60C12 54 20 60 28 56M36 56C44 60 52 54 62 60", m.b, 2.8, .9, ' stroke-dasharray="3 3"') + Sp(52, 46, 3.4),

  banknote: () =>
    S("M18 26C10 18 4 18 2 22C6 22 8 26 6 30C10 28 14 30 18 34Z", P.white, { a: 0, b: 0, sw: 2, inner: L("M6 24C10 24 13 27 15 30", P.white.s, 1.2) }) +
    S("M46 26C54 18 60 18 62 22C58 22 56 26 58 30C54 28 50 30 46 34Z", P.white, { a: 0, b: 0, sw: 2, inner: L("M58 24C54 24 51 27 49 30", P.white.s, 1.2) }) +
    rot(S(R(14, 22, 36, 20, 2.5), T.green, { a: [0, 2.4], b: [1.4, 1.4], inner: `<circle cx="32" cy="32" r="6" fill="none" stroke="${T.green.s}" stroke-width="1.6"/>` + fill(R(14, 22, 36, 3, 0), T.green.h, .6) + Tx(32, 35.4, "£", 9, T.green.s) + Tx(19.5, 29, "50", 4.4, T.green.s) }), -8) +
    S(crescent(52, 9, 6), T.yellow, { a: 1, b: .8, sw: 2 }) + L("M20 50L18 56M32 50V58M44 50L46 56", "#9aa6c4", 1.8, .7),

  flock: (m, v) => {
    const bird = (x, y, s, flip, q) => G(`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`,
      S("M-8 2C-8 -4 -3 -7 2 -7C3 -9 5 -12 8 -12C11 -12 12.4 -10 12 -8C11.4 -5 11 -2 10 1C8 6 4 8 -1 8C-6 8 -8 6 -8 2Z", q || P.grey, { a: 1.6, b: 1, sw: 2 }) +
      F("M-8 1L-14 5L-13 0L-15 -3Z", P.greyD.b, 1.6) + F("M11.6 -10L15 -8.6L11.4 -7.6Z", P.dark.b, 1.2) + F(C(8.6, -9, 1.4), m === T.red ? "#ff4d5e" : "#ff9a2b", .9) +
      fill("M3 -6C5 -4 8 -3.6 11 -5.6V-3.6C8 -1.6 4 -2 2 -4Z", m.b, .9) + L("M-4 0C0 -1 4 0 6 2", INK, 1.2, .45));
    let back = "";
    if (v === "column") back = S(R(44, 8, 9, 54, 1), T.stone, { a: [2, 0], b: [1, 0], inner: L("M46.5 8V62M50.5 8V62", T.stone.s, 1.2, .6) }) + S(R(41, 5, 15, 4, 1), T.stone, { a: 0, b: 0, sw: 2 }) + S(R(46, 0, 5, 6, 1.5), T.stone, { a: 0, b: 0, sw: 2 });
    if (v === "moon") back = S(C(40, 22, 18), T.cream, { a: 3, b: 0, inner: F(C(34, 16, 3), T.cream.s, 1.2) + F(C(46, 28, 4), T.cream.s, 1.2) + F(C(44, 12, 2), T.cream.s, 1) }) + Sp(8, 8, 3) + Sp(58, 52, 2.6);
    if (v === "flag") back = L("M46 62V6", INK, 4.4) + L("M46 62V6", P.dwood.b, 2.2) + S("M47 7C52 4 56 10 61 7V21C56 24 52 18 47 21Z", T.red, { a: [0, 1.4], b: 0, sw: 2 }) + S(R(30, 52, 32, 4, 1), P.wood, { a: 0, b: 0, sw: 2 }) + F(R(33, 56, 3, 6, .5), P.dark.b, 1.4) + F(R(56, 56, 3, 6, .5), P.dark.b, 1.4);
    if (v === "halo") return glow(30, 30, 28, "#ffe680", .45) + `<ellipse cx="44" cy="8" rx="9" ry="2.6" fill="none" stroke="${INK}" stroke-width="4"/><ellipse cx="44" cy="8" rx="9" ry="2.6" fill="none" stroke="#ffd23d" stroke-width="2"/>` + bird(28, 38, 2, 0, m === T.gold ? pal("#ffd76a", "#d8962a", "#fff3b0") : P.grey);
    return back + bird(14, 18, .95, 0) + bird(48, 42, .95, 1) + bird(25, 44, 1.25, 0);
  },

  pinch: (m, v) =>
    (v === "light" ? glow(45, 23, 18, "#ffd84a", .7) + L("M45 9V3M57 13L61 9M59 25H64M33 13L29 9", "#ffb020", 2.4) : "") +
    S("M6 62L5 46C5 39 10 35 17 35H28C33 35 36 38 35 42L33 50C31.6 56 27 59 21 61Z", P.skin, { a: [3, 2], b: 1.6, inner: L("M12 44C15 42 19 42 22 44M13 50C16 48 20 48 23 50", P.skin.s, 1.4, .8) }) +
    S(Cap(24, 39, 41, 17, 4.2), P.skin, { a: [2, 1.4], b: 1.2 }) +
    S(Cap(31, 48, 48, 30, 4.4), P.skin, { a: [2, 1.4], b: 1.2 }) + L("M38.5 21.5L41 23M45 32.5L46.8 30", P.skin.s, 1.2) +
    (v === "light" ? S(C(45, 23, 5), pal("#fff36a", "#ffb020", "#ffffff"), { a: 1.2, b: .8, sw: 2 }) + Sp(45, 23, 3) + Sp(57, 42, 2.6)
      : S(C(45.4, 23.4, 4.8), P.gold, { a: 1.2, b: .8, sw: 2 }) + L("M43.6 21.6L47 25", P.gold.s, 1.2) + L("M54 8L50 12M58 18L53 19", INK, 1.8, .5)),

  guestlist: (m, v) => rot(
    S("M14 12H50V48C50 54 46 58 40 58C46 58 46 62 40 62H18Q14 62 14 58Z", P.paper, { a: [3, 0], b: [2, 0], inner: [18, 23, 28, 33, 38, 43, 48, 53].map((y, i) => L(`M19 ${y}H${i % 3 ? 42 : 38}`, INK, 2, .3) + L(`M18 ${y}H${i % 3 ? 43 : 39}`, m.b, 1.6)).join("") }) +
    S(R(10, 5, 44, 9, 4.5), dk(P.paper), { a: [0, 2.4], b: [0, 1.4] }) + F(E(10.5, 9.5, 2, 4.4), P.paper.s, 1.8) + F(E(53.5, 9.5, 2, 4.4), P.paper.s, 1.8) +
    (v === "damned" ? [[20, 62], [30, 63], [44, 60]].map(([x, y]) => S(`M${x} ${y - 9}C${x + 2} ${y - 5} ${x + 5} ${y - 3} ${x + 4} ${y}H${x - 4}C${x - 5} ${y - 3} ${x - 2} ${y - 5} ${x} ${y - 9}Z`, T.orange, { a: .8, b: 0, sw: 1.8 })).join("") : "") +
    (v === "time" ? at(48, 50, 1.3, EMB.hourglass()) : ""), -8),

  catalogue: () =>
    [[44, 12, 20], [52, 22, 35], [40, 4, 5], [56, 8, 50]].map(([x, y, a]) => G(`rotate(${a} ${x} ${y})`, S(R(x - 5, y - 3.4, 10, 6.8, .8), P.paper, { a: 0, b: 0, sw: 1.6 }) + L(`M${x - 3.4} ${y - 1}H${x + 3.4}M${x - 3.4} ${y + 1.2}H${x + 1}`, T.red.b, 1, .8))).join("") +
    L("M36 22L42 16M38 28L46 26", INK, 2, .4) +
    S("M8 24L18 16H38L28 24Z", P.wood, { a: 0, b: 0, sw: 2.2, inner: fill("M8 24L18 16H38L28 24Z", "#fff", .2) }) +
    S("M28 24L38 16V36L28 44Z", P.dwood, { a: 0, b: 0, sw: 2.2 }) +
    S("M8 24H28V44H8Z", P.wood, { a: [0, 2.4], b: [1.2, 1.2] }) + S(R(12, 28, 12, 6, 1), P.gold, { a: 0, b: 0, sw: 1.6, inner: fill(R(14, 29.6, 8, 2.8, .4), "#fff") }) + L("M15 38A3 3 0 0 0 21 38", INK, 3.6) + L("M15 38A3 3 0 0 0 21 38", P.gold.b, 1.6) +
    S("M6 44H42L38 50H10Z", P.dmetal, { a: 0, b: 0, sw: 2 }) + S(C(14, 52, 7), P.dwood, { a: 1.6, b: 1, inner: L("M14 45V59M7 52H21M9 47L19 57M19 47L9 57", P.dwood.s, 1.2) }) + S(C(36, 52, 7), P.dwood, { a: 1.6, b: 1, inner: L("M36 45V59M29 52H43M31 47L41 57M41 47L31 57", P.dwood.s, 1.2) }) + F(C(14, 52, 2), P.metal.b, 1.2) + F(C(36, 52, 2), P.metal.b, 1.2),

  starrope: (m) =>
    glow(12, 14, 14, "#fff3a0", .5) + glow(52, 14, 14, "#fff3a0", .5) +
    L("M13 20C17 56 47 56 51 20", INK, 12) + L("M13 20C17 56 47 56 51 20", m.s, 8.4) + L("M13 20C17 56 47 56 51 20", m.b, 4.6, null, ' transform="translate(-.8 -1)"') + L("M13 20C17 56 47 56 51 20", INK, 8.4, .2, ' stroke-dasharray="1.6 3.4"') +
    S(R(9, 18, 8, 7, 2), P.gold, { a: [1.4, 0], b: 0, sw: 2 }) + S(R(47, 18, 8, 7, 2), P.gold, { a: [1.4, 0], b: 0, sw: 2 }) +
    S(star(12, 13.4, 11.6, 5, 5, -90), P.gold, { a: 2, b: 1.4 }) + S(star(52, 13.4, 11.6, 5, 5, -90), P.gold, { a: 2, b: 1.4 }) + Sp(32, 60, 3.6) + Sp(28, 8, 2.6) + Sp(38, 14, 2),

  bookrow: (m, v) => {
    const cols = [m, T.red, T.blue, T.green, T.mustard];
    return [6, 15, 24, 33, 42].map((x, i) => S(R(x, 12 + (i % 2) * 3, 9, 44 - (i % 2) * 3, 1.5), cols[i], { a: [2, 0], b: [1, 0], inner: fill(R(x, 18, 9, 3, 0), P.gold.b) + fill(R(x, 46, 9, 3, 0), P.gold.b) }) +
      Tx(x + 4.5, v === "stars" ? 34 : 37, v === "stars" ? "52" + i : "ABCDE"[i], v === "stars" ? 4.4 : 8, "#fff", { stroke: INK, sw: 1.4, rot: v === "stars" ? -90 : 0 })).join("") +
      G("rotate(18 56 34)", S(R(51, 14, 9, 42, 1.5), T.teal, { a: [2, 0], b: [1, 0], inner: fill(R(51, 20, 9, 3, 0), P.gold.b) }) + Tx(55.5, 39, v === "stars" ? "" : "Z", 8, "#fff", { stroke: INK, sw: 1.4 })) +
      (v === "stars" ? Sp(10, 6, 3.4) + Sp(40, 5, 2.6) + Sp(58, 60, 3) + S(star(30, 6, 4, 1.7, 5, -90), P.gold, { a: 0, b: 0, sw: 1.4 }) : "") + S(R(2, 56, 56, 4, 1.5), P.dwood, { a: 0, b: 0, sw: 2 });
  },

  newspaper: (m) => rot(
    S(R(8, 10, 46, 44, 1.5), P.paper, { a: [3, 3], b: 1.6, inner: fill(R(8, 10, 46, 9, 0), INK) + L("M13 24H30M13 28H30M13 32H28M13 36H30M13 40H26M13 44H30M13 48H28", INK, 1.6, .3) + L("M31 22V52", INK, 1.2, .2) }) +
    Tx(31, 17.4, "FREE", 7, "#fff") + S(R(34, 23, 17, 27, 1.5), P.white, { a: 0, b: 0, sw: 1.6 }) +
    [[38, 30], [47, 30], [38, 39], [47, 39]].map(([x, y], i) => F(C(x, y - 2, 3.4), m.b, 1.2) + at(x, y - 2, .4, i % 2 ? EMB.moon() : EMB.star(P.white))).join("") + L("M36 45H49M36 48H46", INK, 1.2, .4), -8),

  keyring: (m) => {
    const key = (a, q, len) => G(`rotate(${a} 30 22)`,
      S(R(28, 30, 4.4, len, 1.4), q, { a: [1, 0], b: 0, sw: 2 }) + S(`M32 ${26 + len}h3.6v2.6h-3.6Z M32 ${21 + len}h2.8v2.6h-2.8Z`, q, { a: 0, b: 0, sw: 1.6 }) +
      S(C(30.2, 30, 4.6) + C(30.2, 30, 1.8), q, { ev: 1, a: 1.2, b: .8, sw: 2 }));
    return [[-62, P.gold, 18], [-40, P.metal, 22], [-18, T.steel, 20], [2, P.gold, 24], [22, P.metal, 19], [44, T.copper, 22], [64, P.metal, 17]].map(([a, q, l]) => key(a, q, l)).join("") +
      ring(30, 22, 10, P.metal.b, 2.8) + L("M22 16A10 10 0 0 1 32 12", "#fff", 1.2, .9) +
      G("rotate(-12 52 52)", S(R(46, 44, 12, 16, 4), m, { a: 1.6, b: 1.2, inner: fill(R(46, 49, 12, 3, 0), "#fff", .6) }) + L("M52 44V38", INK, 1.6)) + L("M38 28L52 40", INK, 1.6, .7);
  },

  handstamp: (m, v) => {
    const sk = P.skin;
    return S(Cap(24, 30, 22, 9, 3.7), sk, { a: 1.4, b: 1 }) + S(Cap(31, 29, 31, 5.5, 3.9), sk, { a: 1.4, b: 1 }) + S(Cap(38, 30, 39.5, 8, 3.7), sk, { a: 1.4, b: 1 }) + S(Cap(44, 33, 47.5, 15, 3.2), sk, { a: 1.4, b: 1 }) +
      S(Cap(20, 44, 9, 31, 4), sk, { a: 1.6, b: 1.2 }) +
      S("M18 32C18 27 21 25 25 25H42C46 25 48 28 48 33V46C48 52 44 55 38 55H28C22 55 18 51 18 45Z", sk, { a: [3, 2.4], b: 1.6, inner: L("M23.5 26.5V30M31 25.5V29M38.5 26.5V30M44.5 28.5V31.5", sk.s, 1.2, .6) }) +
      S(R(24, 53, 20, 10, 2), sk, { a: [2, 0], b: [1, 0] }) +
      (v === "star" ? glow(33, 40, 12, "#ffe680", .6) + `<path d="${star(33, 40, 8, 3.4, 5, -90)}" fill="none" stroke="${m.b}" stroke-width="2"/>` + Sp(33, 40, 2.6)
        : G("rotate(-12 33 40)", `<rect x="22" y="34" width="22" height="12" rx="2" fill="none" stroke="${m.b}" stroke-width="1.6" opacity=".9"/>` + Tx(33, 39.6, "ADMIT", 4.6, m.b) + Tx(33, 44.4, "ONE", 4.2, m.b))) +
      (v === "foam" ? L("M50 46C53 44 56 46 58 44M50 52C52 50 55 52 57 50", "#bfeaff", 2, .9) : "");
  },

  earpiece: (m, v) =>
    (v === "bang" ? S(star(47, 16, 15, 7.6, 10, -90), T.orange, { a: 0, b: 0, sw: 2.2, inner: fill(star(47, 16, 9, 4.8, 10, -70), T.yellow.b) }) : "") +
    S("M4 17C4 7 12 2 20 4C28 6 30 16 25 22L19 28C15 31 4 27 4 17Z", P.dark, { a: 2.2, b: 1.6 }) + F(C(13, 13.6, 3.6), P.rubber.s, 1.6) + Gl(9, 9, 2, 1.2, -40, .6) +
    L("M19 28C21 30 23 31 24 34", INK, 5.4) + L("M19 28C21 30 23 31 24 34", "#cfe9f5", 2.8) +
    [0, 1, 2, 3, 4, 5].map((i) => { const x = f(26 + i * 3), y = f(36 + i * 4); return `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.4" transform="rotate(-20 ${x} ${y})" fill="none" stroke="${INK}" stroke-width="5" opacity=".95"/><ellipse cx="${x}" cy="${y}" rx="7" ry="3.4" transform="rotate(-20 ${x} ${y})" fill="none" stroke="#d9f1fb" stroke-width="2.4"/>`; }).join("") +
    L("M40 58C43 60 46 60 48 58", INK, 4.6) + L("M40 58C43 60 46 60 48 58", "#cfe9f5", 2.4) + S(R(46, 50, 11, 11, 2.4), P.dark, { a: 1.4, b: 0, sw: 2.2 }) + S(R(56, 53, 6.4, 4.6, 1.2), P.metal, { a: 0, b: 0, sw: 1.8 }) +
    (v === "bang" ? "" : L("M32 9C35 7 38 8 40 6M34 15C37 14 40 15 42 13", INK, 2.2, .45)),

  horn: (m) =>
    L("M56 14L62 8M57 34H64M56 54L62 60", INK, 3) +
    S("M26 37C35 37 42 28 47 14C52 16 57 25 57 34C57 43 52 52 47 54C42 41 35 31 26 31Z", P.gold, { a: [2.6, 2.6], b: 1.8, inner: L("M30 33C38 32 43 25 47 18", P.gold.h, 1.8, .8) }) + F(E(53, 34, 4.4, 18), P.gold.s, 2.4) + F(E(53.8, 34, 2.4, 12), "#5a3a12", 1.8) +
    S(R(21, 29, 9, 10, 2), P.gold, { a: [0, 1.8], b: 0, sw: 2.2 }) +
    S(C(13, 34, 11), m, { a: 3, b: 2.2 }) + Gl(9, 29, 2, 3.6, 40, .8) + L("M16 25C19 27 21 30 21 34", m.s, 1.6, .7),

  glowrock: (m) =>
    glow(32, 36, 30, m.h, .5) +
    S("M10 42C8 34 14 26 22 24C26 16 38 14 44 20C52 20 58 28 56 38C56 48 46 54 36 54H20C14 54 10 48 10 42Z", T.stone, { a: 3.4, b: 2.2, inner: L("M18 34L26 38L24 46M34 22L36 32L44 36L50 32M36 32L32 44", m.b, 2.4) + L("M18 34L26 38L24 46M34 22L36 32L44 36L50 32M36 32L32 44", m.h, 1) }) +
    Sp(54, 10, 3.6) + Sp(10, 16, 2.6) + Sp(30, 6, 2),

  fob: (m) =>
    L("M20 50C10 58 4 50 10 44C14 40 20 42 22 46", INK, 4) + L("M20 50C10 58 4 50 10 44C14 40 20 42 22 46", P.metal.b, 2) +
    G("rotate(-30 32 34)", S(R(20, 14, 24, 38, 11), P.dark, { a: 2.6, b: 1.8 }) + S(R(28.5, 47, 7, 7, 2.5), P.metal, { a: 0, b: 0, sw: 1.8 }) +
      S(C(32, 23, 4.2), P.dmetal, { a: 1, b: .6, sw: 1.8 }) + S(C(32, 33, 4.2), P.dmetal, { a: 1, b: .6, sw: 1.8 }) + S(C(32, 43, 3.8), T.red, { a: 1, b: .6, sw: 1.8 }) +
      L("M30.6 22.6V21.4A1.4 1.4 0 0 1 33.4 21.4V22.6M30 22.6H34V25H30Z", "#fff", 1) + L("M30.6 32.6V31.4A1.4 1.4 0 0 1 33.4 30.8M30 32.6H34V35H30Z", "#fff", 1) + Tx(32, 45, "!", 5, "#fff")) +
    L("M46 10C50 8 54 10 56 14M48 4C54 2 60 6 62 12", INK, 2.4) + L("M44 16C46 15 48 16 49 18", INK, 2.4),

  crossing: (m) =>
    glow(32, 42, 20, "#5dff9a", .6) + S(R(29, 54, 6, 10, 1), P.dmetal, { a: [1.4, 0], b: 0 }) +
    S(R(16, 3, 32, 53, 5), P.dark, { a: 3, b: 2 }) +
    F(R(20, 7, 24, 21, 3), "#3a1d24", 2) + F("M32 10.5A2.4 2.4 0 1 1 32 15.3A2.4 2.4 0 1 1 32 10.5Z M29 16.5H35V23H34V27H30V23H29Z", "#6a2a34", 0) +
    F(R(20, 31, 24, 21, 3), "#0f3a22", 2) + fill(R(22, 33, 20, 17, 2), "#1c6b3c") +
    F(C(33.4, 35.6, 2.6), "#b8ffd0", 1) + F("M32.4 39L28.6 45L30.6 46L32.8 42.4L33.6 46L30.8 50.8L33 51.6L36 46.4L36.4 42.4L38.8 45L40.4 43.6L36.4 39Z", "#b8ffd0", 1) + Gl(23, 9, 1, 3, 0, .5),


  slice: (m, v) => rot(
    S("M12 22C8 10 22 4 32 6C42 4 56 10 52 22C50 26 48 28 48 32V54Q48 58 44 58H20Q16 58 16 54V32C16 28 14 26 12 22Z", T.brown, { a: [3, 3], b: 0 }) +
    S("M17 23C14 14 24 10 32 12C40 10 50 14 47 23C45 27 43 29 43 33V52H21V33C21 29 19 27 17 23Z", T.cream, { a: [2, 2], b: 1.4, inner: dots([[26, 22], [36, 26], [30, 36], [38, 44], [26, 46], [34, 18]], .7, T.cream.s, 0) }) +
    (v === "gravel" ? [[24, 30, 2], [38, 34, 1.6], [30, 46, 2.2], [40, 48, 1.4], [26, 40, 1.4], [36, 20, 1.6]].map(([x, y, r]) => F(C(x, y, r), "#8b8d85", 1.2)).join("") : "") +
    F("M30 6C32 3 36 3 36 6", "none", 1.6), -10),

  petri: (m) =>
    S(E(32, 40, 26, 14), P.glass, { a: [0, 3], b: 0 }) + S(E(32, 36, 26, 14), P.glass, { a: 0, b: [0, 1.6], inner: fill(E(32, 37, 23, 11.5), "#f2e7a8") + fill(E(22, 36, 5, 3), m.b, .85) + fill(E(42, 40, 4, 2.6), m.b, .85) + fill(E(34, 31, 3, 2), T.pink.b, .8) + fill(E(26, 42, 2.4, 1.6), T.pink.b, .8) }) +
    F(E(32, 37, 7, 4.4), "#fff", 1.6) + F(C(32, 37, 3), m.s, 1.2) + `<circle cx="32.6" cy="36.4" r="1.3" fill="${INK}"/>` + Gl(16, 30, 2, 4, 60, .7) +
    L("M44 18L48 12M50 22L56 18", INK, 1.8, .5) + Tx(52, 12, "?", 9, m.b, { stroke: INK, sw: 1.6 }),

  gnome: (m) =>
    L("M44 8L52 4M46 14L56 13M44 20L52 22", INK, 2.2, .6) +
    S("M32 2L46 24H18Z", T.red, { a: [3, 1.6], b: 1.6 }) +
    S("M18 26C18 20 24 18 32 18C40 18 46 20 46 26V30H18Z", P.skin, { a: 1.4, b: 1 }) +
    S("M14 30C14 26 18 24 22 26C26 22 38 22 42 26C46 24 50 26 50 30C52 38 46 46 32 50C18 46 12 38 14 30Z", P.white, { a: [2.4, 2], b: 1.6, inner: L("M22 34C24 40 28 44 32 46M42 34C40 40 36 44 32 46", P.white.s, 1.2) }) +
    S(E(32, 36, 5, 6), pal("#5a1a2a", "#3a0f1a", "#8a2a3a"), { a: 0, b: 0, sw: 2, inner: fill(E(32, 40, 3, 2), T.red.h) }) +
    F(C(26, 27.5, 2.2), "#fff", 1.4) + F(C(38, 27.5, 2.2), "#fff", 1.4) + `<circle cx="26" cy="27.5" r=".9" fill="${INK}"/><circle cx="38" cy="27.5" r=".9" fill="${INK}"/>` + F(E(32, 30, 3, 2.4), P.skin.s, 1.4) +
    L("M22 23L29 25M42 23L35 25", INK, 2) +
    S("M18 46H46L48 58H16Z", T.blue, { a: [2, 2], b: 1 }) + S(R(17, 50, 30, 4, 1), P.dark, { a: 0, b: 0, sw: 1.8 }) + F(R(29.5, 49.5, 5, 5, 1), P.gold.b, 1.4) +
    S(R(14, 57, 16, 5, 2.5), T.brown, { a: 0, b: 0, sw: 2 }) + S(R(34, 57, 16, 5, 2.5), T.brown, { a: 0, b: 0, sw: 2 }),

  whistle: (m, v) =>
    (v === "lanyard" ? L("M15 26C6 14 14 2 32 2C48 2 58 10 54 22", INK, 6) + L("M15 26C6 14 14 2 32 2C48 2 58 10 54 22", m.b, 3.6) + L("M15 26C6 14 14 2 32 2C48 2 58 10 54 22", "#fff", 1.2, .8, ' stroke-dasharray="2 3"') : "") +
    (v === "ages" ? glow(32, 40, 30, "#ffd25a", .45) : "") +
    S(C(13, 27, 5) + C(13, 27, 2.4), P.metal, { ev: 1, a: .8, b: 0, sw: 2 }) +
    S("M6 40C6 29 15 23 26 23H57C59.2 23 61 24.8 61 27V33C61 35.2 59.2 37 57 37H45C45 49 37 57 26 57C15 57 6 50 6 40Z", v === "ages" ? P.gold : P.metal, { a: [4, 3], b: 2, hw: 2.4, inner: L("M45 23V37", INK, 1.6, .35) + F(R(34, 25.6, 8, 4.6, .8), INK, 0) }) +
    Gl(14, 36, 2.2, 5, 40, .8) + L("M56 15L61 10M58 19H64", INK, 2.4, .6) +
    (v === "ages" ? L("M20 43C23 47 29 47 32 43M26 32V38M23 35H29", P.gold.s, 1.8) + Sp(50, 50, 3.4) : ""),

  parcel: (m) =>
    L("M6 14C8 12 10 14 12 12M52 8C54 6 56 8 58 6M4 30C6 28 8 30 10 28", INK, 1.8, .5) +
    S("M10 24L32 14L56 22L34 32Z", pal("#e2b47a", "#b07f45", "#f6d6a8"), { a: 0, b: 0, sw: 2.2 }) +
    S("M10 24L34 32V58L10 48Z", T.tan, { a: [0, 2], b: [1.2, 1.2] }) + S("M34 32L56 22V48L34 58Z", dk(T.tan), { a: [1.4, 0], b: 0 }) +
    fill("M20 19.6L44 28L46 27L22 18.6Z", "#c8a26c") + L("M21 19L44 28V54", "#d8be8c", 4) + L("M21 19L44 28V54", INK, 1, .25) +
    G("matrix(1 .33 0 1 0 0)", S(R(13, 25, 15, 10, 1), P.white, { a: 0, b: 0, sw: 1.6 }) + Tx(20.5, 31, "LOST", 4.6, T.red.b)) +
    L("M14 46L28 52M14 42L22 45", INK, 1, .3),

  bigkey: (m, v) => lay(
    (v === "cosmic" ? glow(32, 12, 20, "#a98bff", .55) : glow(32, 12, 16, m.h, .35)) +
    shaft(22, 66, 8.6, m) +
    S("M36 46H50V52H44V56H50V64H36Z", m, { a: [2, 1.4], b: 0, sw: 2.4 }) +
    bands([22], 12, 4.6, m) +
    S(C(32, 10, 13.6) + C(22.4, 10, 3) + C(41.6, 10, 3) + C(32, .6, 3) + C(32, 19.4, 3), m, { ev: 1, a: 2.4, b: 1.6 }) +
    (v === "cosmic" ? fill(C(32, 10, 5), "#20184a") + Sp(32, 10, 3.6) : F(C(32, 10, 4.4), T.red.b, 1.8)) + Gl(25, 5, 1.6, 3.4, 40, .8), 40),

  teacup: (m) =>
    S(E(32, 52, 26, 8), P.white, { a: [0, 2], b: 0, inner: L(E(32, 51, 18, 5), P.white.s, 1.2, .8) }) +
    L("M50 30C60 30 60 44 48 44", INK, 6.4) + L("M50 30C60 30 60 44 48 44", P.white.b, 3) +
    S("M12 26H52C52 40 44 52 32 52C20 52 12 40 12 26Z", P.white, { a: [3, 2], b: 1.6, inner: fill("M12 36H52V40H12Z", m.b) + dots([[20, 44], [44, 44]], 1.4, m.b, 0) }) +
    S(E(32, 26, 20, 6), pal("#b0703a", "#7a4520", "#d8a06a"), { a: 0, b: 0, sw: 2.2, inner: fill(E(32, 27, 18, 4.6), "#c98a4b") + F("M26 25L28 22H36L38 25L35 27V29H29V27Z", "#4a2a12", 0) + dots([[20, 27], [44, 26], [24, 29], [41, 29]], .9, "#4a2a12", 0) }) +
    L("M26 16C24 12 28 10 26 6M36 16C34 12 38 10 36 6", INK, 1.6, .3),

  hubcap: (m) =>
    S(C(32, 32, 27), P.metal, { a: 3.6, b: 2.4, inner: `<circle cx="32" cy="32" r="21" fill="none" stroke="${P.metal.s}" stroke-width="1.6"/>` }) +
    [0, 60, 120, 180, 240, 300].map((a) => `<path transform="rotate(${a} 32 32)" d="M29 14H35L34 24H30Z" fill="${P.dmetal.b}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`).join("") +
    S(C(32, 32, 8), P.metal, { a: 1.4, b: 1, sw: 2 }) + S(star(32, 32, 5, 2.2, 5, -90), m, { a: 0, b: 0, sw: 1.4 }) +
    dots([[32, 9], [52, 21], [52, 43], [32, 55], [12, 43], [12, 21]], 1.2, P.metal.h, 1) + Gl(17, 17, 2.4, 6, 45, .7) + L("M46 50C48 48 50 47 52 48", INK, 1.6, .4),

  fridge: (m) =>
    S(R(8, 2, 48, 60, 4), P.white, { a: [3, 0], b: [1.6, 0], inner: L("M8 22H56", P.white.s, 2) + fill(R(8, 2, 48, 60, 0), "#dfe6f2", .3) }) + S(R(48, 26, 4, 18, 2), P.metal, { a: [1, 0], b: 0, sw: 1.8 }) +
    G("rotate(-6 28 40)", S(R(16, 28, 24, 26, 1), P.paper, { a: [1.2, 1.2], b: 0, sw: 1.8, inner: L("M19 40H37M19 44H34M19 48H36", INK, 1.2, .4) }) + Tx(28, 37, "3AM", 7, T.red.b)) +
    S("M22 22L34 22L28 34Z", T.yellow, { a: 1, b: 0, sw: 2, inner: dots([[26, 25], [30, 25.6], [28, 29]], 1.2, T.red.b, 0) }) + F("M21.4 21H34.6L34 24H22Z", T.tan.b, 1.6) +
    S(C(48, 10, 4), T.purple, { a: .8, b: 0, sw: 1.8 }) + Tx(16, 15, "3:00", 6, "#7fe0ff", { anchor: "start" }),

  medal: (m, v) =>
    S("M18 2H30L36 30H24Z", m, { a: [1.4, 0], b: 0, sw: 2.2, inner: fill("M22 2H26L32 30H28Z", "#fff", .85) }) + S("M46 2H34L28 30H40Z", dk(m), { a: [1.4, 0], b: 0, sw: 2.2, inner: fill("M42 2H38L32 30H36Z", "#fff", .7) }) +
    S(R(23, 27, 18, 6, 2), v === "gold" ? P.gold : P.metal, { a: 0, b: 0, sw: 2 }) +
    S(C(32, 44, 16), v === "gold" ? P.gold : P.metal, { a: 3, b: 2.2, inner: `<circle cx="32" cy="44" r="11.5" fill="none" stroke="${(v === "gold" ? P.gold : P.metal).s}" stroke-width="1.6"/>` }) +
    (v === "forty" ? Tx(32, 48.6, "40", 12, P.gold.s) : v === "lolly" ? emb("star", 32, 44, 1) : Tx(32, 49, "2", 14, P.metal.s)) + Gl(23, 37, 1.6, 4, 40, .8),

  stopwatch: (m) =>
    S(R(28, 3, 8, 6, 1.5), P.metal, { a: 0, b: 0, sw: 2 }) + S(R(30, 8, 4, 5, 1), P.dmetal, { a: 0, b: 0, sw: 1.8 }) + G("rotate(40 46 16)", S(R(43, 12, 6, 5, 1.4), P.metal, { a: 0, b: 0, sw: 1.8 })) +
    S(C(32, 37, 23), m, { a: 3, b: 2.2 }) + S(C(32, 37, 17.5), P.white, { a: [-2, -2], b: 0, sw: 2,
      inner: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<path transform="rotate(${a} 32 37)" d="M32 21.5V${a % 90 ? 23.5 : 25}" stroke="${INK}" stroke-width="1.6"/>`).join("") + L("M40 22L33 34L36 37L28 46L31 49L26 56M33 34L44 38", "#8090aa", 1.3, .95) }) +
    L("M32 37L41 27", T.red.b, 2.2) + L("M32 37V31", INK, 2) + F(C(32, 37, 2), INK, 0),

  dabber: (m) =>
    G("rotate(-8 22 40)", S(R(10, 28, 30, 30, 2), P.white, { a: [2, 2], b: 0, inner: L("M10 34H40M16 28V58M22 28V58M28 28V58M34 28V58M10 40H40M10 46H40M10 52H40", INK, 1, .3) }) +
      [[13, 31], [25, 37], [31, 43], [19, 49], [13, 55], [31, 55], [37, 37]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${m.b}" opacity=".85"/>`).join("") + Tx(19, 44.6, "88", 4.2, INK)) +
    G("rotate(22 46 30)", S("M40 22C40 18 42 16 46 16C50 16 52 18 52 22V52Q52 56 48 56H44Q40 56 40 52Z", m, { a: [2.4, 0], b: [1.4, 0], ink: 1, inner: fill(R(40, 30, 12, 10, 0), "#fff", .9) + Tx(46, 37.4, "★", 6, m.b) }) +
      S(R(41.4, 4, 9.2, 13, 3), m, { a: [1.6, 0], b: 0, sw: 2 }) + S(R(42.5, 12, 7, 5, 1), dk(m), { a: 0, b: 0, sw: 1.6 })),

  knuckles: (m) =>
    L("M48 20C56 18 60 26 56 30C52 34 46 30 48 24", INK, 4.4) + L("M48 20C56 18 60 26 56 30C52 34 46 30 48 24", P.metal.b, 2) +
    G("rotate(-25 56 44)", S(R(53, 30, 5, 22, 1.4), P.gold, { a: [1, 0], b: 0, sw: 2 }) + S("M58 44h3v2.6h-3Z M58 48h3.6v2.6h-3.6Z", P.gold, { a: 0, b: 0, sw: 1.4 }) + S(C(55.5, 30, 4.4) + C(55.5, 30, 1.8), P.gold, { ev: 1, a: 1, b: .6, sw: 2 })) +
    S("M6 22C6 16 10 12 16 12H40C45 12 48 16 47 22L45 30C44 38 38 44 28 46C18 48 8 44 6 36Z" + C(14, 22, 4.4) + C(24, 22, 4.4) + C(34, 22, 4.4) + C(42, 24, 3.6), P.metal, { ev: 1, a: 2.6, b: 1.8, inner: L("M12 36C18 40 32 40 40 34", P.metal.s, 1.4, .7) }) + Gl(10, 16, 1.2, 3, 40, .8),

  pendant: (m, v) =>
    L("M12 2C12 18 20 24 28 24M52 2C52 18 44 24 36 24", INK, 4.6, .95) + L("M12 2C12 18 20 24 28 24M52 2C52 18 44 24 36 24", P.gold.b, 2.4) + L("M12 2C12 18 20 24 28 24M52 2C52 18 44 24 36 24", P.gold.s, 1.2, .9, ' stroke-dasharray="1.6 1.4"') +
    S(R(28, 20, 8, 7, 2.4), P.gold, { a: [1.2, 0], b: 0, sw: 2 }) +
    (v === "heart" ? glow(32, 44, 22, "#bfe8ff", .7) + G("translate(32 45) scale(1.28) translate(-32 -45)", S("M32 60C18 52 14 44 16 38C18 32 26 30 32 36C38 30 46 32 48 38C50 44 46 52 32 60Z", P.gold, { a: 2.4, b: 1.6 }) + F("M32 54C24 49 21 44 22 40C23 37 28 36 32 40C36 36 41 37 42 40C43 44 40 49 32 54Z", "#0d1a3a", 1.6) + Sp(32, 45, 4.4) + Sp(26, 42, 1.6))
      : S(E(32, 44, 17, 19.4), P.gold, { a: 3, b: 2, inner: `<ellipse cx="32" cy="44" rx="12.6" ry="15" fill="none" stroke="${P.gold.s}" stroke-width="1.8"/>` }) +
        G("translate(32 44)", F(C(-1, -9.6, 2.8) + C(3.6, -14.4, 2.1), P.gold.s, 0) + F("M-4.6 -5.6H2.6L4 4L7 13H3L.4 6L-2 13H-6L-3.6 4Z M1.6 -6L5 -11.6L6.6 -10.4L3.6 -4.6Z", P.gold.s, 0) + L("M-8 -13V13", P.gold.s, 1.8) + L("M-11 8Q-6 6 0 8T11 8", "#2fc7b4", 2)) +
        Gl(22.6, 35, 2.2, 4, 30, .7)),

  gel: (m) => rot(
    S("M18 10H46V48C46 52 42 54 38 56L34 62H30L26 56C22 54 18 52 18 48Z", P.metal, { a: [3, 1.6], b: 2, inner: fill(R(18, 22, 28, 22, 0), m.b) + fill(R(18, 22, 28, 3, 0), m.h) + L("M18 14H46", P.metal.s, 1.4) }) +
    F("M18 10H46V15H18Z", P.metal.h, 2) + F("M41 10V13L44 15", "none", 1.6) + L("M38 10L40 13", INK, 1.6) +
    F("M34 26L26 35H31L29 42L37 33H32Z", P.gold.b, 1.6) + Tx(32, 52, "GEL", 5.6, INK), 12),

  pen: (m) =>
    S(R(8, 14, 40, 40, 1.5), P.white, { a: [2, 2], b: 0, inner: L("M16 14V54M24 14V54M32 14V54M40 14V54M8 22H48M8 30H48M8 38H48M8 46H48", INK, 1.2, .45) + fill("M16 22h8v8h-8Z M32 30h8v8h-8Z M8 46h8v8h-8Z M40 14h8v8h-8Z", INK, .85) }) +
    Tx(12, 37, "S", 6, T.blue.b) + Tx(28, 37, "T", 6, T.blue.b) + Tx(20, 37, "R", 6, T.blue.b) + Tx(36, 21, "I", 6, T.blue.b) +
    G("rotate(40 44 32)", S(R(41, 2, 7, 40, 3), m, { a: [2, 0], b: [1.2, 0] }) + S(R(41, 2, 7, 10, 3), P.metal, { a: [1.4, 0], b: 0, sw: 2 }) + S(R(47.5, 4, 2, 13, 1), P.metal, { a: 0, b: 0, sw: 1.4 }) + S("M41.6 42H47.4L44.5 50Z", P.metal, { a: 0, b: 0, sw: 1.8 }) + F("M43.6 47H45.4L44.5 50Z", INK, 0)),

  horseshoe: (m, v) =>
    S("M12 8H24V32C24 38 27 42 32 42C37 42 40 38 40 32V8H52V32C52 46 44 56 32 56C20 56 12 46 12 32Z", v === "gold" ? P.gold : P.dmetal, { a: [3, 3], b: 2, inner: L("M18 10V32C18 42 24 50 32 50C40 50 46 42 46 32V10", INK, 1.2, .3) }) +
    dots([[18, 16], [18, 26], [19, 36], [46, 16], [46, 26], [45, 36], [25, 46], [39, 46]], 1.3, INK, 0) +
    S(R(10, 5, 16, 5, 1.5), v === "gold" ? P.gold : P.dmetal, { a: 0, b: 0, sw: 2 }) + S(R(38, 5, 16, 5, 1.5), v === "gold" ? P.gold : P.dmetal, { a: 0, b: 0, sw: 2 }) +
    Sp(32, 22, 4) + Sp(8, 50, 2.6) + Sp(56, 50, 2.6),

  rosette: (m, v) =>
    S("M24 38L14 62L22 58L26 63L32 42Z", m, { a: 1, b: 0, sw: 2 }) + S("M40 38L50 62L42 58L38 63L32 42Z", m, { a: 1, b: 0, sw: 2 }) +
    S(star(32, 28, 25, 20, 18, -90), m, { a: 2.6, b: 1.8, inner: [0, 20, 40, 60, 80, 100, 120, 140, 160].map((a) => `<path transform="rotate(${a} 32 28)" d="M32 4V52" stroke="${m.s}" stroke-width="1.2" opacity=".6"/>`).join("") }) +
    S(C(32, 28, 13), P.white, { a: 1.4, b: 0, sw: 2.2 }) + `<circle cx="32" cy="28" r="10.6" fill="none" stroke="${P.gold.b}" stroke-width="1.4"/>` + Tx(32, 27, v === "first" ? "1st" : "BEST", v === "first" ? 7 : 5.4, m.s) + Tx(32, 33.4, v === "first" ? "" : "IN SHOW", 3.6, INK),



  penny: (m, v) =>
    (v === "ferry" ? "" : `<ellipse cx="32" cy="54" rx="26" ry="6" fill="none" stroke="${T.cyan.b}" stroke-width="2" opacity=".7"/><ellipse cx="32" cy="54" rx="16" ry="3.6" fill="none" stroke="${T.cyan.b}" stroke-width="2" opacity=".8"/>`) +
    S(v === "ferry" ? "M32 5C44 4 56 14 57 28C58 42 48 55 33 56C18 57 7 46 7 31C7 17 18 6 32 5Z" : C(32, 30, 23), v === "ferry" ? T.bronze : T.copper, { a: 3.2, b: 2.2, inner: `<circle cx="32" cy="30" r="18.5" fill="none" stroke="${(v === "ferry" ? T.bronze : T.copper).s}" stroke-width="1.4"/>` }) +
    (v === "ferry"
      ? F("M18 34H46L42 40H22Z", T.bronze.s, 1.4) + L("M32 34V18L42 30H32", T.bronze.s, 1.8) + L("M20 26L30 36", T.bronze.h, 1.6) + dots([[16, 18], [48, 20]], 1, T.bronze.s, 0)
      : Tx(32, 28, "ONE", 6.4, T.copper.s) + Tx(32, 36, "PENNY", 5, T.copper.s) + Tx(32, 45, "1953", 5, T.copper.s)) + Gl(19, 19, 2, 5, 45, .7),


  witchbottle: (m) =>
    S("M26 4H38V10H26Z", T.tan, { a: [1, 0], b: 0, sw: 2 }) +
    S("M27 10H37V15C37 17 48 20 50 30C52 42 48 54 40 58H24C16 54 12 42 14 30C16 20 27 17 27 15Z", T.brown, { a: [4, 3], b: 2, inner: L("M14 34C24 38 40 38 50 34", T.brown.h, 1.4, .5) }) +
    L("M44 22C48 20 50 24 48 26", INK, 3.4) + L("M44 22C48 20 50 24 48 26", T.brown.s, 1.6) +
    S("M24 22C24 18 28 17 32 17C36 17 40 18 40 22C40 28 36 34 32 34C28 34 24 28 24 22Z", T.tan, { a: 1.2, b: 0, sw: 1.8, inner: L("M27 28C29 30 35 30 37 28M26 32L28 34M38 32L36 34M30 33V36M34 33V36", T.brown.s, 1.2) }) +
    dots([[28.6, 22.4], [35.4, 22.4]], 1.2, INK, 0) +
    [[20, 46, -20], [30, 48, 10], [42, 44, 25]].map(([x, y, a]) => G(`rotate(${a} ${x} ${y})`, L(`M${x} ${y - 8}V${y + 4}`, INK, 2.4) + L(`M${x} ${y - 8}V${y + 4}`, P.metal.b, 1) + F(C(x, y - 8, 1.6), P.metal.b, 1))).join("") +
    TL("M40 6C44 2 50 4 52 8M46 4L48 8M50 6L54 6", T.green.b, 1.6),


  tooth: (m) =>
    L("M4 6C12 14 16 12 18 9M60 6C52 14 48 12 46 9", INK, 4.6) + L("M4 6C12 14 16 12 18 9M60 6C52 14 48 12 46 9", T.brown.b, 2.6) +
    S("M18 9C24 6 40 6 46 9C51 12 51 20 48 27C45 41 38 52 21 63C28 49 26 39 21 29C17 22 15 14 18 9Z", P.bone || T.bone, { a: [4, 2.4], b: 2.2, inner: L("M27 15C30 28 30 42 25 56", (P.bone || T.bone).s, 1.6, .7) + L("M34 14C38 24 38 34 35 42", (P.bone || T.bone).s, 1.4, .5) + L("M22 16C24 26 24 34 22 40", "#fff", 1.6, .6) }) +
    S(R(16, 5, 32, 8, 2.6), P.gold, { a: [0, 1.6], b: 0, sw: 2.2, inner: dots([[22, 9], [32, 9], [42, 9]], 1.2, P.gold.h, .9) }),

  trilithon: (m) =>
    S("M2 56C12 50 52 50 62 56V62H2Z", T.grass, { a: 0, b: [0, 1.4] }) +
    S("M12 22L22 21L23 56H11Z", T.stone, { a: [3, 0], b: [1.6, 0], inner: L("M15 28L16 40M19 34V48", T.stone.s, 1.4, .7) }) +
    S("M42 21L52 22L53 56H41Z", T.stone, { a: [3, 0], b: [1.6, 0], inner: L("M45 30L46 44M49 26V36", T.stone.s, 1.4, .7) }) +
    S("M8 13L56 12L57 22L7 23Z", T.stone, { a: [0, 3], b: [1.4, 1.4], inner: L("M14 16H24M36 17H48", T.stone.s, 1.4, .7) }) + Sp(56, 4, 3) + F("M26 56C27 52 30 52 31 56Z", T.green.b, 1.2),


  lightbottle: (m) =>
    glow(32, 38, 26, "#fff3a0", .5) +
    S("M27 3H37V10H27Z", T.tan, { a: [1, 0], b: 0, sw: 2 }) +
    S("M27 10H37V16C37 18 46 21 46 30V54Q46 60 40 60H24Q18 60 18 54V30C18 21 27 18 27 16Z", P.glass, { a: [3, 0], b: [2, 0], inner: fill("M0 0H64V64H0Z", "#1d2a55", .55) + S("M35 20L24 38H31L27 54L42 32H34L38 20Z", T.yellow, { a: 0, b: 0, sw: 1.6 }) + L("M20 30L24 32M44 40L40 42", "#fff3a0", 1.4) }) + Gl(22, 30, 1.4, 6, 0, .7) + Sp(54, 10, 3) + Sp(10, 16, 2.4),

  kite: (m) =>
    L("M32 48C29 54 37 58 32 64", INK, 2.6, .85) + L("M18 32C10 42 6 52 2 62", INK, 2.2, .7) +
    [[31, 53, 20], [34.6, 59, -20]].map(([x, y, a]) => G(`rotate(${a} ${x} ${y})`, F(`M${x - 5.6} ${y - 3}L${x} ${y}L${x - 5.6} ${y + 3}Z M${x + 5.6} ${y - 3}L${x} ${y}L${x + 5.6} ${y + 3}Z`, T.red.b, 1.4))).join("") +
    S("M32 1L55 24L32 50L9 24Z", m, { a: [3.4, 3.4], b: 2.2, inner: fill("M32 1L55 24H32Z", "#fff", .45) + fill("M9 24H32V50Z", m.s, .6) + L("M32 1V50M9 24H55", INK, 1.8, .5) }) + Sp(57, 6, 3.4) + Sp(7, 8, 2.6),

  feather: (m) => {
    const q = luma(m.b) < .45 ? pal(mix(m.b, "#ffffff", .25), m.s, mix(m.h, "#ffffff", .3)) : m;
    return lay(
      S("M34 -6C44 6 46 22 43 36C41 46 36 54 32 60C28 54 22 46 21 36C19 22 24 6 34 -6Z", q, { a: [4, 1], b: 2, inner:
        L("M33 -2C33 20 33 40 32 58", q.h, 2) + L("M33 10L41 4M33 20L43 14M33 30L43.6 24M32.8 40L42 35M32.5 48L39 45M33 10L26 5M33 20L23.6 15M33 30L22 25M32.8 40L22.6 36M32.5 48L25 45", q.s, 1.4, .85) +
        fill("M44 26L36 30L44 29Z M21 31L28 33L21 34Z", INK, .5) }) +
      L("M32 58V71", INK, 4.6) + L("M32 58V71", q.h, 2.2), 45) + L("M4 50L12 42M8 58L17 49M16 61L21 56", "#fff", 2.2, .6);
  },

  barometer: (m) =>
    S(C(32, 32, 26), P.gold, { a: 3, b: 2.2 }) + dots([[32, 6], [58, 32], [32, 58], [6, 32], [50, 14], [14, 14], [50, 50], [14, 50]], 1.6, P.gold.h, 1.2) +
    S(C(32, 32, 20), P.white, { a: [-2, -2], b: 0, sw: 2, inner: [...Array(13)].map((_, i) => `<path transform="rotate(${-120 + i * 20} 32 32)" d="M32 14V17.4" stroke="${INK}" stroke-width="1.2"/>`).join("") + Tx(21, 40, "RAIN", 3.6, T.blue.b) + Tx(43, 40, "FAIR", 3.6, T.orange.b) + Tx(32, 23, "CHANGE", 3.2, INK) }) +
    L("M32 32L42 22", INK, 2) + L("M32 32L26 38", T.red.b, 1.6) + F(C(32, 32, 2.2), P.gold.b, 1.2) + Gl(22, 18, 1.4, 4, 40, .7),

  sunbeam: (m) =>
    fill("M18 34L6 64H22Z M30 36L28 64H40Z M42 34L50 64H62Z", "#fff3a0", .6) + L("M18 36L10 58M30 38L29 60M42 36L49 58", "#ffd23d", 2.2, .9) +
    S(C(42, 18, 11), T.yellow, { a: 2, b: 1.4 }) + L("M42 2V5M54 6L52 8M58 18H55M30 6L32 8", T.orange.b, 2.4) +
    S(cloudD(28, 26, 1.7), P.white, { a: [0, 2.4], b: [1, 1] }) + Sp(16, 52, 3) + Sp(52, 48, 2.6),

  pocketwatch: (m) =>
    L("M20 6C8 8 4 20 10 28C14 34 20 30 18 26", INK, 3.4, .9) + L("M20 6C8 8 4 20 10 28C14 34 20 30 18 26", P.gold.b, 1.4, null, ' stroke-dasharray="1.4 1"') +
    S(C(36, 8, 4) + C(36, 8, 1.8), P.gold, { ev: 1, a: 0, b: 0, sw: 1.8 }) + S(R(33, 10, 6, 6, 1.5), P.gold, { a: 0, b: 0, sw: 1.8 }) +
    S(C(36, 38, 22), P.gold, { a: 3, b: 2.2 }) + S(C(36, 38, 17), P.white, { a: [-2, -2], b: 0, sw: 2, inner: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<path transform="rotate(${a} 36 38)" d="M36 23V${a % 90 ? 25 : 26.6}" stroke="${INK}" stroke-width="1.4"/>`).join("") }) +
    L("M36 38V28M36 38L43 41", INK, 2) + F(C(36, 38, 1.8), INK, 0) + `<circle cx="36" cy="38" r="20" fill="none" stroke="${m.h}" stroke-width="1.6" opacity=".8" stroke-dasharray="2 4"/>` + L("M2 44H8M4 52H10", m.b, 2, .9),


  heart: (m) =>
    glow(32, 36, 26, "#ff8a2b", .4) +
    S("M32 58C14 46 6 36 8 24C10 14 22 10 32 20C42 10 54 14 56 24C58 36 50 46 32 58Z", T.red, { a: [3, 3], b: 2, inner: L("M20 22C18 26 18 32 22 36", T.red.h, 2, .7) }) +
    S(star(38, 36, 9, 6.6, 10, -90) + C(38, 36, 3), P.gold, { ev: 1, a: 1, b: .6, sw: 1.8 }) + S(star(24, 40, 6, 4.4, 8, -90) + C(24, 40, 2), P.gold, { ev: 1, a: .8, b: 0, sw: 1.6 }) +
    S("M32 6C34 10 38 12 38 16C38 19 35 21 32 21C29 21 26 19 26 16C26 13 29 12 30 9C31 11 31 11 32 12C31 10 31 8 32 6Z", T.orange, { a: .8, b: 0, sw: 1.8 }),


  hourglass: (m) =>
    S(R(14, 4, 36, 6, 2), P.dwood, { a: [0, 1.6], b: 0 }) + S(R(14, 54, 36, 6, 2), P.dwood, { a: [0, 1.6], b: 0 }) +
    S(R(16, 9, 4, 46, 1), P.dwood, { a: 0, b: 0, sw: 1.8 }) + S(R(44, 9, 4, 46, 1), P.dwood, { a: 0, b: 0, sw: 1.8 }) +
    S("M22 10H42C42 22 36 26 33.5 32C36 38 42 42 42 54H22C22 42 28 38 30.5 32C28 26 22 22 22 10Z", P.glass, { a: 0, b: 0, sw: 2, inner: fill("M24 12H40C39 18 36 21 32 23C28 21 25 18 24 12Z", T.tan.b) + fill("M28 52H36C36 48 34 47 32 46C30 47 28 48 28 52Z", T.tan.b) + L("M32 45V24", T.tan.b, 1.4) + F("M30 25L32 21L34 25Z", T.tan.b, 0) }) +
    Gl(25, 16, .9, 3, 20, .8) + L("M54 40V24M51 27L54 24L57 27", m.b, 2.2),

  quill: (m) =>
    S(R(6, 30, 40, 30, 1.5), P.paper, { a: [2, 2], b: 0, inner: L("M11 38H38M11 43H34M11 48H40", INK, 1.6, .3) + L("M11 54H26", INK, 1, .45) }) +
    Tx(32, 57, "*", 10, T.red.b) +
    G("rotate(35 40 26)", S("M40 2C48 8 50 20 44 34L40 46L36 34C30 20 32 8 40 2Z", P.white, { a: [2, 1], b: 1.2, inner: L("M40 6V44M40 12L45 10M40 18L46 16M40 24L45 22M40 12L35 10M40 18L34 16", P.white.s, 1, .8) }) + F("M38.4 44L40 52L41.6 44Z", INK, 1.2)) +
    Sp(56, 50, 3),


  soup: (m) =>
    S(E(32, 34, 27, 10), pal("#c9a46a", "#8a6a3a", "#ead0a0"), { a: 0, b: 0 }) +
    S("M5 34C5 50 18 58 32 58C46 58 59 50 59 34Z", T.stone, { a: [3, 3], b: 1.6, inner: L("M10 44C20 48 44 48 54 44", T.stone.h, 1.4, .5) }) +
    S(E(32, 34, 23, 7.6), T.lime, { a: 0, b: 0, sw: 2, inner: dots([[18, 34], [40, 32], [30, 37], [46, 36]], 1.6, T.lime.h, .8) + F("M22 32C24 30 28 30 28 33C26 36 22 35 22 32Z", T.green.s, 1) + `<circle cx="26.4" cy="32" r=".7" fill="${INK}"/>` + L("M28 33C30 35 31 32 33 34", T.green.s, 1.2) }) +
    G("rotate(30 46 26)", S(R(44, 4, 5, 26, 2.5), P.metal, { a: [1.4, 0], b: 0, sw: 2 })) +
    L("M20 22C18 18 22 16 20 12M32 22C30 18 34 16 32 12", "#fff", 2, .85),

  crisps: (m) =>
    S("M14 10L50 8L52 14L50 54L54 60L14 58L12 52L16 14Z", m, { a: [3, 2], b: 2, ink: 1, inner: fill(R(10, 24, 46, 18, 0), "#fff", .9) + Tx(33, 37, "CRISP", 7.4, m.s) + L("M14 14L50 12M14 54L50 54", INK, 1.2, .3) + fill(C(50, 30, 9), "#120c2e") }) +
    Sp(54, 26, 2) + dots([[48, 34], [53, 33]], .7, "#fff", 0),

  crumb: (m) =>
    glow(32, 33, 30, "#ffe36a", .55) + G("translate(32 33) scale(1.45) translate(-32 -33)",
    S("M20 30C18 22 26 16 32 18C38 14 46 20 46 28C50 32 48 42 42 44C38 50 28 50 24 44C18 42 16 34 20 30Z", T.tan, { a: [2.4, 2.4], b: 1.4, sw: 2, inner: dots([[28, 26], [36, 30], [30, 38], [40, 38]], 1.2, T.tan.s, 0) + L("M24 26C27 22 32 21 35 22", T.tan.h, 1.4, .8) })) +
    Sp(8, 10, 4.4) + Sp(57, 12, 3.4) + Sp(56, 56, 3.6) + Sp(8, 54, 2.6),

  overdue: (m) => rot(
    S("M14 6H44L52 14V58H14Z", P.paper, { a: [3, 3], b: 1.6, inner: L("M20 16H38M20 22H44M20 28H40M20 34H46", INK, 1.6, .3) + L("M20 48H34", INK, 1.6, .3) }) + F("M44 6V14H52Z", P.paper.s, 2) +
    G("rotate(-16 33 42)", `<rect x="16" y="35" width="34" height="13" rx="2" fill="none" stroke="${T.red.b}" stroke-width="2.2"/>` + Tx(33, 45, "OVERDUE", 7, T.red.b)) +
    Tx(46, 56, "£∞", 6.4, INK, { anchor: "end" }), -6),

  generator: (m) =>
    `<path d="M10 40A22 22 0 0 1 54 40" fill="${T.cyan.h}" opacity=".25"/><path d="M10 40A22 22 0 0 1 54 40" fill="none" stroke="${T.cyan.b}" stroke-width="2" stroke-dasharray="3 3"/>` +
    S(R(16, 36, 32, 22, 3), m, { a: [3, 3], b: 1.6, inner: fill(R(16, 36, 32, 4, 0), m.h, .6) }) +
    S(C(26, 47, 5), P.white, { a: 0, b: 0, sw: 1.8 }) + L("M26 47L29 44", INK, 1.6) + S(R(34, 43, 10, 8, 1.5), P.dark, { a: 0, b: 0, sw: 1.6, inner: L("M36 47h1.6M38.6 47h1.6M41.2 47h1.6", P.lcd.b, 1.2) }) +
    L("M32 36V20", INK, 3.4) + L("M32 36V20", P.metal.b, 1.6) + S(C(32, 18, 3), T.red, { a: 0, b: 0, sw: 1.6 }) +
    at(32, 10, 1.2, EMB.shh()) + F(R(18, 57, 6, 4, 1), P.dark.b, 1.6) + F(R(40, 57, 6, 4, 1), P.dark.b, 1.6),

  trolley: (m) =>
    S(C(16, 56, 4.6), P.rubber, { a: 1, b: .6, sw: 2 }) + S(C(44, 56, 4.6), P.rubber, { a: 1, b: .6, sw: 2 }) + S(C(52, 50, 3.6), P.rubber, { a: 1, b: 0, sw: 2 }) +
    L("M10 46H50L54 50M14 46L16 52M44 46L44 52", INK, 4.4) + L("M10 46H50L54 50M14 46L16 52M44 46L44 52", P.metal.b, 2) +
    L("M2 8H8L14 40", INK, 4.4) + L("M2 8H8L14 40", P.metal.b, 2) + S(R(0, 5, 6, 6, 2), m, { a: 0, b: 0, sw: 1.8 }) +
    `<path d="M10 14H58L52 40H14Z" fill="${P.metal.b}" opacity=".18"/>` +
    L("M10 14H58L52 40H14ZM20 14L21 40M30 14V40M40 14L39 40M50 14L47 40M11 22H56M12 31H54", INK, 3.2) + L("M10 14H58L52 40H14ZM20 14L21 40M30 14V40M40 14L39 40M50 14L47 40M11 22H56M12 31H54", P.metal.b, 1.4) +
    S("M10 14H58L59 18H10Z", m, { a: 0, b: 0, sw: 2 }) +
    S(R(34, 24, 18, 18, 4), P.dmetal, { a: 2, b: 1.2, inner: L("M34 30H52M34 36H52", P.dmetal.s, 1.4) + F(C(43, 33, 2.4), P.metal.b, 1) }),

  lanyard: (m) => {
    const pts = [[16, 4], [14, 10], [13, 16], [13, 22], [14, 28], [18, 33], [46, 33], [50, 28], [51, 22], [51, 16], [50, 10], [48, 4]];
    return pts.map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${i % 2 ? 2 : 3.2}" ry="${i % 2 ? 3.2 : 2}" fill="none" stroke="${INK}" stroke-width="3.6"/><ellipse cx="${x}" cy="${y}" rx="${i % 2 ? 2 : 3.2}" ry="${i % 2 ? 3.2 : 2}" fill="none" stroke="${P.metal.b}" stroke-width="1.6"/>`).join("") +
      L("M20 35L28 40M44 35L36 40", INK, 3.4) + L("M20 35L28 40M44 35L36 40", P.metal.b, 1.4) +
      S(R(27, 38, 10, 6, 2), P.metal, { a: 0, b: 0, sw: 1.8 }) +
      S(R(16, 42, 32, 20, 2.5), P.white, { a: [2, 2], b: 1, inner: fill(R(16, 42, 32, 8, 0), m.b) }) + Tx(32, 48.6, "STAFF", 6, "#fff") +
      S(R(19, 51, 8, 9, 1), m === T.gold ? P.paper : P.paper, { a: 0, b: 0, sw: 1.4, inner: `<circle cx="23" cy="54.4" r="1.8" fill="${m.s}"/><path d="M20 60C20 57.4 21.4 56.6 23 56.6C24.6 56.6 26 57.4 26 60Z" fill="${m.s}"/>` }) +
      S(C(39, 56, 4.4), T.red, { a: 0, b: 0, sw: 1.6 }) + S(R(36, 55, 6, 2, .4), P.white, { a: 0, b: 0, sw: .8 });
  },

  bikehelmet: (m) =>
    S("M10 40C8 24 20 12 36 12C50 12 58 22 56 36C56 40 54 42 50 42H14C12 42 10 42 10 40Z", m, { a: [4, 3], inner: fill("M20 18C24 15 30 14 34 14L32 24H20Z M38 14C44 14 50 18 52 24H38Z M18 28H30L28 36H16Z M36 28H52L50 36H36Z", P.dark.b) + L("M10 32C24 30 40 30 56 32", m.h, 1.4, .5) }) +
    S("M12 38C6 38 2 34 2 30C6 32 10 32 14 32Z", P.dark, { a: [0, 1.4], b: 0, sw: 2.2 }) +
    L("M20 42C20 52 26 58 32 58M44 42C44 52 38 58 32 58", INK, 3.6) + L("M20 42C20 52 26 58 32 58M44 42C44 52 38 58 32 58", T.yellow.b, 1.6) + S(R(29, 55, 6, 5, 1.5), P.dark, { a: 0, b: 0, sw: 1.8 }) +
    Tx(46, 9, "↺", 9, T.red.b, { stroke: INK, sw: 1 }),


  peakcap: (m) =>
    S("M8 30C8 20 18 14 32 14C46 14 56 20 56 30Z", P.white, { a: [4, 2], b: 2 }) +
    S("M8 30C4 30 4 22 12 20L52 20C60 22 60 30 56 30Z", P.white, { a: 0, b: 0, sw: 2.2 }) +
    S(R(11, 29, 42, 9, 2), m, { a: [0, 2], b: [0, 1.2], inner: [14, 22, 30, 38, 46].map((x) => fill(R(x, 29, 4, 9, 0), "#fff", .9)).join("") }) +
    S("M11 37H53C53 44 44 49 32 49C20 49 11 44 11 37Z", P.dark, { a: [0, 2.6], b: [0, 1.4] }) +
    S("M32 16L38 20L36 27H28L26 20Z", P.gold, { a: 1, b: .6, sw: 2 }) + emb("star", 32, 21.6, .45),

  datestamp: (m, v) =>
    S(E(32, 56, 24, 6), P.dark, { a: 0, b: 0, sw: 2 }) + S(E(32, 54, 22, 5), m, { a: 0, b: 0, sw: 2 }) +
    G("rotate(-6 32 56)", Tx(46, 60, v === "county" ? "1 JAN 1900" : "OVERDUE", 4, m.s, { anchor: "middle" })) +
    S(C(32, 8, 7), P.dwood, { a: 2, b: 1.4 }) + S(R(29, 13, 6, 10, 1.5), P.dwood, { a: [1.4, 0], b: 0 }) +
    S("M14 22H50L48 30H16Z", P.metal, { a: [0, 1.4], b: 0, sw: 2.2 }) +
    S(R(14, 28, 4, 20, 1), P.metal, { a: [1, 0], b: 0, sw: 2 }) + S(R(46, 28, 4, 20, 1), P.metal, { a: [1, 0], b: 0, sw: 2 }) +
    [20, 27, 34, 41].map((x, i) => S(R(x - 1, 31, 7, 13, 1.5), P.rubber, { a: 0, b: 0, sw: 1.6 }) + Tx(x + 2.5, 40, ["1", "9", "7", "4"][i], 6, "#fff")).join("") +
    S(R(18, 46, 28, 4, 1), P.rubber, { a: 0, b: 0, sw: 1.8 }),


  curtainrobe: (m, v, o) =>
    M.robe(m, "", Object.assign({ pat: "drops", nobelt: 1, trim: "white" }, o || {})) +
    [16, 22, 28, 36, 42, 48].map((x, i) => `<circle cx="${x}" cy="${i < 3 ? 7 + (2 - i) * .8 : 7 + (i - 3) * .8}" r="2.8" fill="none" stroke="${INK}" stroke-width="3.2"/><circle cx="${x}" cy="${i < 3 ? 7 + (2 - i) * .8 : 7 + (i - 3) * .8}" r="2.8" fill="none" stroke="${P.metal.b}" stroke-width="1.4"/>`).join(""),

  hood: (m) =>
    S("M32 3C20 3 12 14 11 28C10 40 8 50 4 58C14 62 50 62 60 58C56 50 54 40 53 28C52 14 44 3 32 3Z", m, { a: [4, 3], b: 2.4, inner: L("M20 20C18 32 16 46 14 58M44 20C46 32 48 46 50 58", m.s, 1.6, .7) }) +
    F("M32 12C24 12 19 20 19 30C19 40 24 46 32 46C40 46 45 40 45 30C45 20 40 12 32 12Z", "#141833", 2) +
    glow(26, 30, 5, m.h, .9) + glow(38, 30, 5, m.h, .9) + F(E(26, 30, 2.4, 1.4), m.h, 0) + F(E(38, 30, 2.4, 1.4), m.h, 0) +
    L("M48 8C52 6 54 10 58 8M50 14C54 12 56 16 60 14", m.h, 1.8, .9) + Tx(32, 42, "~", 8, m.h),


  wristband: (m) =>
    `<ellipse cx="30" cy="36" rx="22" ry="12" fill="none" stroke="${INK}" stroke-width="12"/>` +
    `<path d="M8 36A22 12 0 0 0 52 36" fill="none" stroke="${m.s}" stroke-width="8.4"/><path d="M8 36A22 12 0 0 1 52 36" fill="none" stroke="${m.b}" stroke-width="8.4"/>` +
    `<path d="M8 36A22 12 0 0 1 52 36" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity=".7"/>` +
    `<path d="M10 32A22 12 0 0 1 50 32" fill="none" stroke="${m.h}" stroke-width="1.4" opacity=".8"/>` +
    S(R(44, 38, 10, 14, 3), P.white, { a: 1, b: .6, sw: 2 }) + L("M50 52L56 60M47 52L50 61", INK, 3.4) + L("M50 52L56 60M47 52L50 61", m.b, 1.6) +
    Tx(30, 27.6, "VIP", 5.6, "#fff", { stroke: INK, sw: 1.4 }),

  plaster: (m) => rot(
    S(R(4, 22, 56, 20, 10), T.tan, { a: [0, 2.4], b: [1.4, 1.4], inner: dots([[10, 28], [14, 32], [10, 36], [50, 28], [54, 32], [50, 36]], .6, T.tan.s, 0) }) +
    S(R(22, 24, 20, 16, 2), pal("#f3e6d2", "#c9b496", "#ffffff"), { a: 0, b: 0, sw: 1.6, inner: dots([[26, 28], [30, 28], [34, 28], [38, 28], [26, 32], [30, 32], [34, 32], [38, 32], [26, 36], [30, 36], [34, 36], [38, 36]], .5, "#c9b496", 0) }) +
    L("M8 26C12 24 16 24 20 24", "#fff", 1.4, .6), -25) + F("M48 8L52 4M54 14L60 12", "none", 0),

  spinner: (m) =>
    L("M10 18A26 26 0 0 1 22 8M54 46A26 26 0 0 1 42 56", INK, 2.2, .5) +
    S(C(32, 32, 6) + C(32, 13, 9) + C(48.5, 41.5, 9) + C(15.5, 41.5, 9) + "M26 20L38 20L44 34L38 44H26L20 34Z", m, { a: 2.6, b: 1.8 }) +
    [[32, 13], [48.5, 41.5], [15.5, 41.5]].map(([x, y]) => S(C(x, y, 5.4), P.metal, { a: 1, b: .6, sw: 2 }) + F(C(x, y, 2.4), P.dmetal.b, 1.2)).join("") +
    S(C(32, 32, 6), P.metal, { a: 1, b: .8, sw: 2 }) + F(C(32, 32, 2.6), m.s, 1.4),

  sticker: (m) =>
    S(R(8, 10, 48, 46, 3), P.white, { a: [2, 2], b: 0, inner: [[18, 20], [46, 46]].map(([x, y]) => `<path d="${star(x, y, 8, 3.6, 5, -90)}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="1.6 1.6" opacity=".4"/>`).join("") + [[46, 20]].map(([x, y]) => `<path d="${star(x, y, 8, 3.6, 5, -90)}" fill="${P.gold.b}" opacity=".85"/>`).join("") }) +
    S(star(28, 38, 17, 7.6, 5, -90), P.gold, { a: 2, b: 1.6 }) + F("M37 46L44 50L39 42Z", P.gold.s, 1.6) +
    dots([[24, 35], [32, 35]], 1.4, INK, 0) + L("M24 41Q28 44 32 41", INK, 1.6) + Tx(32, 54, "WELL DONE", 4.6, T.red.b),

  harness: (m) =>
    L("M22 6C20 16 18 26 20 36M42 6C44 16 46 26 44 36M20 36H44M20 36C16 44 16 52 20 58M44 36C48 44 48 52 44 58M20 58C26 54 30 50 32 44C34 50 38 54 44 58", INK, 7) +
    L("M22 6C20 16 18 26 20 36M42 6C44 16 46 26 44 36M20 36H44M20 36C16 44 16 52 20 58M44 36C48 44 48 52 44 58M20 58C26 54 30 50 32 44C34 50 38 54 44 58", m.b, 4) +
    L("M22 6C20 16 18 26 20 36M42 6C44 16 46 26 44 36", "#fff", 1, .5, ' stroke-dasharray="2 2"') +
    S(R(18, 20, 28, 5, 1.5), m, { a: 0, b: 0, sw: 2 }) + dots([[20, 36], [44, 36]], 2.6, P.metal.b, 1.4) +
    S(R(27, 33, 10, 7, 2), P.metal, { a: 0, b: 0, sw: 2 }) +
    L("M32 40V46", INK, 3) + S("M28 46C28 42 36 42 36 46V56C36 60 28 60 28 56Z", P.metal, { a: 1, b: .6, sw: 2.2 }) + F("M30 48V55", "none", 0) + L("M30 47V56", P.metal.s, 1.4) + L("M36 50H33", INK, 1.6),

  tub: (m) =>
    S(E(34, 50, 20, 7), T.steel, { a: 0, b: 0 }) +
    S("M14 30V50C14 54 23 57 34 57C45 57 54 54 54 50V30Z", P.white, { a: [4, 0], b: [2, 0], inner: fill(R(14, 36, 40, 12, 0), m.b) + Tx(34, 45, "GOOSE FAT", 5, "#fff") }) +
    S(E(34, 30, 20, 7), P.metal, { a: 0, b: 0, sw: 2.2, inner: fill(E(34, 31, 17, 5), "#f3ead0") + L("M24 31C28 28 34 33 40 29", "#d8cba0", 1.6) }) +
    `<ellipse cx="14" cy="16" rx="7" ry="5" fill="${P.glass.b}" stroke="${INK}" stroke-width="3"/><ellipse cx="30" cy="16" rx="7" ry="5" fill="${P.glass.b}" stroke="${INK}" stroke-width="3"/>` +
    L("M21 16H23M7 16C2 18 2 24 8 26M37 16C42 18 44 22 40 26", INK, 3.6) + L("M21 16H23M7 16C2 18 2 24 8 26M37 16C42 18 44 22 40 26", m.b, 1.6) + Gl(12, 14, 1.4, 1, 0, .9) + Gl(28, 14, 1.4, 1, 0, .9),

  lead: (m) =>
    L("M44 48C30 52 22 44 26 34C30 24 42 22 46 12", INK, 8.4) + L("M44 48C30 52 22 44 26 34C30 24 42 22 46 12", m.b, 5.2) + L("M44 48C30 52 22 44 26 34C30 24 42 22 46 12", m.h, 1.6, .7, ' transform="translate(-.8 -.8)"') +
    L("M46 12C48 2 61 2 61 12C61 20 51 22 46 14", INK, 8.4) + L("M46 12C48 2 61 2 61 12C61 20 51 22 46 14", T.brown.b, 5.2) + L("M47 9C50 4 58 5 59 10", T.brown.h, 1.4, .8) +
    S(E(44, 50, 5, 3.6), P.metal, { a: 0, b: 0, sw: 2.2 }) +
    `<ellipse cx="22" cy="51" rx="18" ry="8.6" fill="none" stroke="${INK}" stroke-width="9.4"/><ellipse cx="22" cy="51" rx="18" ry="8.6" fill="none" stroke="${T.red.b}" stroke-width="6"/>` + `<ellipse cx="22" cy="49.6" rx="18" ry="8.6" fill="none" stroke="${T.red.h}" stroke-width="1.4" opacity=".7" stroke-dasharray="10 40"/>` +
    dots([[12, 57.4], [22, 59.6], [32, 57.4]], 1.5, P.metal.h, 1.1) + S(C(39, 50, 3.6), P.gold, { a: 0, b: 0, sw: 1.8 }) +
    G("translate(39 57)", S(C(0, 2, 5), P.gold, { a: 1, b: 0, sw: 2 }) + at(0, 2, .56, EMB.paw())),

  shipwheel: (m) =>
    [...Array(8)].map((_, i) => { const a = i * 45 * Math.PI / 180, x1 = 32 + Math.cos(a) * 6, y1 = 32 + Math.sin(a) * 6, x2 = 32 + Math.cos(a) * 29, y2 = 32 + Math.sin(a) * 29; return S(Cap(f(x1), f(y1), f(x2), f(y2), 2.6), P.wood, { a: 1, b: 0, sw: 2 }); }).join("") +
    `<circle cx="32" cy="32" r="19" fill="none" stroke="${INK}" stroke-width="8.4"/><circle cx="32" cy="32" r="19" fill="none" stroke="${P.wood.s}" stroke-width="5"/><circle cx="31.4" cy="31.4" r="19" fill="none" stroke="${P.wood.b}" stroke-width="3"/>` +
    S(C(32, 32, 7), P.dwood, { a: 1.4, b: 1 }) + S(C(32, 32, 3), P.gold, { a: 0, b: 0, sw: 1.6 }) +
    [...Array(8)].map((_, i) => { const a = i * 45 * Math.PI / 180; return F(C(f(32 + Math.cos(a) * 19), f(32 + Math.sin(a) * 19), 1.4), P.gold.b, 1); }).join("") +
    L("M2 58Q8 54 14 58T26 58", T.cyan.b, 2, .8),

  suttonhoo: (m) =>
    S("M8 30C8 14 18 4 32 4C46 4 56 14 56 30V40L50 42V54L40 58H24L14 54V42L8 40Z", T.bronze, { a: [4, 3], b: 2.4, inner: L("M32 4V24", P.gold.b, 3) + L("M14 18H50M12 26H52", T.bronze.s, 1.4, .7) + fill("M14 10h4v6h-4Z M46 10h4v6h-4Z M22 6h4v5h-4Z M38 6h4v5h-4Z", T.bronze.s, .6) }) +
    S("M17 28H30L32 36L34 28H47V38H17Z", T.bronze, { a: 0, b: 0, sw: 2.2 }) +
    F(E(24, 33, 4, 2.6), "#141833", 1.8) + F(E(40, 33, 4, 2.6), "#141833", 1.8) +
    S("M14 27C18 24 24 24 30 27M50 27C46 24 40 24 34 27", P.gold, { a: 0, b: 0, sw: 2 }) + L("M14 27C18 24 24 24 30 27M50 27C46 24 40 24 34 27", P.gold.b, 2.4) +
    S("M29 36L32 46L35 36Z", T.bronze, { a: 0, b: 0, sw: 1.8 }) + S("M22 46C26 44 30 46 32 48C34 46 38 44 42 46C40 50 36 50 32 50C28 50 24 50 22 46Z", P.gold, { a: 0, b: 0, sw: 1.8 }) +
    S("M14 44L8 56L14 60L20 52Z", T.bronze, { a: 1, b: 0, sw: 2 }) + S("M50 44L56 56L50 60L44 52Z", T.bronze, { a: 1, b: 0, sw: 2 }) +
    `<path d="M20 58H44V62H20Z" fill="${P.metal.b}" stroke="${INK}" stroke-width="1.8"/>` + L("M22 60H42", INK, 1, .5, ' stroke-dasharray="1.2 1"'),

  handfan: (m) =>
    L("M2 20H12M0 30H8M2 40H10", "#fff", 2.4, .9) +
    S("M32 56L6 20C14 10 24 6 32 6C40 6 50 10 58 20Z", m, { a: [0, 3], b: 1.6, inner: [...Array(9)].map((_, i) => { const a = (-54 + i * 13.5) * Math.PI / 180; return `<path d="M32 56L${f(32 + Math.sin(a) * 52)} ${f(56 - Math.cos(a) * 52)}" stroke="${m.s}" stroke-width="1.4" opacity=".8"/>`; }).join("") + fill("M0 6H64V14H0Z", "#fff", .35) + L("M14 20C20 16 26 18 30 14M34 22C40 18 46 20 50 16", "#fff", 1.6, .6) }) +
    L("M32 56L12 26M32 56L52 26", P.dwood.b, 1.6, .7) + S(C(32, 55, 3.4), P.gold, { a: 0, b: 0, sw: 1.8 }) + L("M32 58C30 62 34 63 32 64", m.b, 1.6),

  moonrock: (m) =>
    L("M22 4C22 14 28 16 32 16M42 4C42 14 36 16 32 16", INK, 3.2) + L("M22 4C22 14 28 16 32 16M42 4C42 14 36 16 32 16", P.gold.b, 1.4) +
    S(R(28, 14, 8, 6, 2), P.gold, { a: 0, b: 0, sw: 1.8 }) +
    S("M16 34C14 26 22 18 32 19C42 18 50 26 48 36C50 46 42 56 32 55C20 56 12 46 16 34Z", T.stone, { a: [3, 3], b: 2, inner: F(C(26, 30, 4), T.stone.s, 1.4) + F(C(38, 42, 5), T.stone.s, 1.4) + F(C(40, 28, 2.4), T.stone.s, 1.2) + F(C(26, 46, 2), T.stone.s, 1.2) }) +
    Sp(52, 50, 3) + Sp(12, 54, 2.4),

  spool: (m) =>
    S(E(26, 50, 16, 5), P.wood, { a: 0, b: 0 }) + S(R(14, 18, 24, 32, 2), m, { a: [3, 0], b: [1.6, 0], inner: L("M14 22H38M14 26H38M14 30H38M14 34H38M14 38H38M14 42H38M14 46H38", m.s, 1.2, .8) }) +
    S(E(26, 16, 16, 5), P.wood, { a: 0, b: 0, sw: 2.2, inner: fill(E(26, 16, 4, 1.4), P.dwood.b) }) +
    L("M38 30C46 28 48 36 52 40C54 42 56 42 56 46", INK, 3.4) + L("M38 30C46 28 48 36 52 40C54 42 56 42 56 46", m.b, 1.6) +
    F(C(56, 47, 2.4), m.b, 1.4) + L("M56 49C55 54 58 56 56 60M56 49C58 53 61 54 62 58M56 49C54 54 52 54 50 57", m.b, 1.2) + Sp(48, 12, 3) + Sp(8, 36, 2.4),

  turtleshell: (m) =>
    S("M6 40C6 22 18 10 32 10C46 10 58 22 58 40Z", m, { a: [4, 2], b: 2.4, inner: L("M22 14L26 26H38L42 14M26 26L18 40M38 26L46 40M26 26L32 40L38 26M12 30L18 40M52 30L46 40", INK, 1.8, .55) + fill("M26 26H38L32 40Z", m.h, .5) + dots([[32, 20], [20, 32], [44, 32]], .9, m.h, 0) }) +
    S(R(2, 38, 60, 8, 4), T.tan, { a: [0, 2], b: [0, 1.2], inner: L("M10 38V46M18 38V46M26 38V46M34 38V46M42 38V46M50 38V46", T.tan.s, 1.2) }) +
    S("M14 46C14 52 12 56 8 58H20C20 54 20 50 22 46Z", T.green, { a: 1, b: 0, sw: 2 }) + S("M50 46C50 52 52 56 56 58H44C44 54 44 50 42 46Z", T.green, { a: 1, b: 0, sw: 2 }) +
    Sp(32, 4, 3) + Sp(6, 16, 2.4),
};

/* ------------------------------------------------------------------ */
/* Extra tints, overlays, emblems and fabric patterns                    */
/* ------------------------------------------------------------------ */
Object.assign(T, {
  olive: pal("#8f9a4a", "#5f6a2c", "#c4cd84"), navy: pal("#3a55a0", "#22346a", "#7d98e0"),
  maroon: pal("#b03a55", "#741f35", "#e8809a"), khaki: pal("#c9b47a", "#917c45", "#ece0b2"),
  void: pal("#2e2758", "#191336", "#6457b0"), ice: pal("#c4ecff", "#7fb8dd", "#ffffff"),
  hivis: pal("#dcff3a", "#9fc214", "#f6ffb8"), tweed: pal("#9a8660", "#66563a", "#c9b68c"),
  leather: pal("#454b66", "#272b40", "#7a81a3"), copper: pal("#dc8a50", "#9c5428", "#f8bf90"),
  bronze: pal("#c99a48", "#8a6324", "#ecc887"), willow: pal("#eed39c", "#c29a5c", "#fff1cf"),
  sky: pal("#8fd3ff", "#4a9ee0", "#dcf3ff"), grass: pal("#6cc04a", "#3f8a2a", "#b4ec98"),
  coal: pal("#3d4258", "#24283a", "#6d7390"), camel: pal("#c99a5e", "#93683a", "#ecc996"),
  rust: pal("#c0562e", "#83351a", "#ec9670"), plum: pal("#7a3e8f", "#4e2160", "#b47fca"),
  rose: pal("#ff8fb0", "#d65a82", "#ffd0de"), slate: pal("#6f7f9a", "#4a5870", "#a9b8d0"),
  bone: pal("#f2ead6", "#c7b994", "#ffffff"), wood: P.wood, dwood: P.dwood,
});
const tone = (k) => k ? (T[k] || P[k] || null) : null;

// Overlays: "+name" or "+name@corner" in the table. Corners: tl tr bl br (default per overlay).
const CORNER = { tl: [10, 10], tr: [54, 10], bl: [10, 54], br: [54, 54], c: [32, 32] };
const OV = {
  stars: () => Sp(8, 9, 4) + Sp(56, 9, 3) + Sp(55, 56, 3.6) + Sp(9, 55, 2.6) + `<circle cx="20" cy="5" r="1.1" fill="#fff"/><circle cx="60" cy="30" r="1" fill="#fff"/><circle cx="4" cy="34" r="1" fill="#fff"/>`,
  cosmic: { under: () => glow(32, 32, 31, "#8a6bff", .28) },
  glow: { under: (m) => glow(32, 32, 30, m.h, .32) },
  gold: { under: () => glow(32, 32, 30, "#ffd25a", .34) },
  ghost: { wrap: (s) => `<g opacity=".7">${s}</g>`, under: () => glow(32, 34, 30, "#a8f0ff", .3), top: () => L("M10 58C14 54 18 60 22 56M40 60C44 56 48 61 53 57", "#bff3ff", 2.4, .9) },
  sparkle: () => Sp(9, 10, 4.2) + Sp(55, 54, 3.4),
  moon: (x, y) => S(crescent(x, y, 6.5), T.yellow, { a: 1, b: .8, sw: 2 }),
  sun: (x, y) => S(star(x, y, 8, 5.4, 12, -90), T.orange, { a: 1, b: 0, sw: 1.8 }) + S(C(x, y, 4.6), T.yellow, { a: 1, b: .8, sw: 1.8 }),
  bolt: (x, y) => S(`M${x + 2} ${y - 8}L${x - 5} ${y + 1}H${x}L${x - 2} ${y + 8}L${x + 5} ${y - 1}H${x}Z`, T.yellow, { a: 1, b: 0, sw: 2 }),
  fire: (x, y) => S(`M${x} ${y - 9}C${x + 3} ${y - 4} ${x + 7} ${y - 2} ${x + 7} ${y + 3}C${x + 7} ${y + 7} ${x + 4} ${y + 9} ${x} ${y + 9}C${x - 4} ${y + 9} ${x - 7} ${y + 7} ${x - 7} ${y + 3}C${x - 7} ${y - 1} ${x - 4} ${y - 2} ${x - 3} ${y - 6}C${x - 2} ${y - 3} ${x - 1} ${y - 3} ${x} ${y - 9}Z`, T.orange, { a: 1.2, b: 0, sw: 2, inner: fill(drop(x, y + 4, .9), T.yellow.b) }),
  price: (x, y) => S(C(x, y, 7.5), T.yellow, { a: 1.2, b: .8, sw: 2 }) + Tx(x, y + 3, "£1", 7.5, T.red.s),
  clock: (x, y) => S(C(x, y, 7.5), P.white, { a: 1.2, b: 0, sw: 2 }) + L(`M${x} ${y - 4.5}V${y}L${x + 3.4} ${y + 2}`, INK, 1.8),
  zzz: () => [[44, 3, 7], [54, 12, 5]].map(([x, y, s]) => TL(`M${x} ${y}H${x + s}L${x} ${y + s}H${x + s}`, "#fff", 2)).join(""),
  hearts: (x, y) => S(`M${x} ${y + 5}C${x - 8} ${y - 1} ${x - 6} ${y - 7} ${x} ${y - 3}C${x + 6} ${y - 7} ${x + 8} ${y - 1} ${x} ${y + 5}Z`, T.red, { a: 1, b: .8, sw: 2 }),
  steam: () => L("M24 10C21 6 26 4 23 0M32 10C29 6 34 4 31 0M40 10C37 6 42 4 39 0", "#fff", 2.4, .85),
  swirl: (x, y) => L(`M${x} ${y}a2 2 0 0 1 4 0a4 4 0 0 1 -8 0a6 6 0 0 1 12 0a8 8 0 0 1 -16 0`, T.purple.h, 2.2, .95),
  waves: () => L("M2 60Q8 56 14 60T26 60T38 60T50 60T62 60", T.cyan.b, 2.6, .9),
  ticket77: (x, y) => G(`rotate(-14 ${x} ${y})`, S(R(x - 8, y - 5, 16, 10, 1.5), P.paper, { a: 1, b: 0, sw: 1.8 }) + Tx(x, y + 3, "77", 7, T.red.s)),
  blast: () => L("M4 20H12M2 30H10M4 40H12", INK, 2.4, .5),
};
function overlay(svg, list, m) {
  let under = "", top = "";
  for (const tok of list) {
    const [name, cn] = tok.split("@"), o = OV[name];
    if (!o) continue;
    if (typeof o === "function") { const c = CORNER[cn || "tr"]; top += o(c[0], c[1], m); continue; }
    if (o.under) under += o.under(m);
    if (o.wrap) svg = o.wrap(svg);
    if (o.top) top += o.top(m);
  }
  return under + svg + top;
}

// Emblems: small pictures printed or pinned on things, drawn in a ~14u box centred on 0,0.
const EMB = {
  star: (q) => S(star(0, 0, 6.5, 2.8, 5, -90), q || P.gold, { a: .8, b: 0, sw: 1.6 }),
  stars: () => S(star(-3, -2, 4, 1.7, 5, -90), P.gold, { a: 0, b: 0, sw: 1.4 }) + S(star(4, 4, 3, 1.3, 5, -90), P.gold, { a: 0, b: 0, sw: 1.4 }),
  moon: () => S(crescent(0, 0, 6), T.yellow, { a: .8, b: 0, sw: 1.6 }),
  saturn: () => F(C(0, 0, 4.6), T.orange.b, 1.6) + `<ellipse cx="0" cy="0" rx="8.5" ry="2.6" transform="rotate(-18)" fill="none" stroke="${INK}" stroke-width="3.4"/><ellipse cx="0" cy="0" rx="8.5" ry="2.6" transform="rotate(-18)" fill="none" stroke="${T.yellow.b}" stroke-width="1.4"/>` + `<path d="M-4.4 -1.4A4.6 4.6 0 0 1 4.4 -1.4" transform="rotate(-18)" fill="${T.orange.b}" stroke="${INK}" stroke-width="1.6"/>`,
  clock: () => F(C(0, 0, 6.5), "#fff", 1.8) + L("M0 -4V0L3 1.6", INK, 1.6) + `<circle r="1" fill="${INK}"/>`,
  bolt: () => F("M2 -7L-4.5 1H0L-2 7L4.5 -1H0Z", T.yellow.b, 1.6),
  eye: () => F("M-7 0C-4 -4.5 4 -4.5 7 0C4 4.5 -4 4.5 -7 0Z", "#fff", 1.6) + F(C(0, 0, 2.6), T.red.b, 1.2) + `<circle r="1.1" fill="${INK}"/>`,
  kebab: () => L("M0 -8V8", INK, 1.8) + F(R(-4, -6, 8, 4, 1.5), P.meat.b, 1.4) + F(R(-3.5, -1.6, 7, 3, 1.2), T.green.b, 1.2) + F(R(-4, 1.8, 8, 4, 1.5), P.meat.b, 1.4),
  sun: () => S(star(0, 0, 7, 4.6, 12, -90), T.orange, { a: 0, b: 0, sw: 1.4 }) + F(C(0, 0, 3.6), T.yellow.b, 1.4),
  cloud: () => F(cloudD(0, 1, .62), "#fff", 1.6),
  storm: () => F(cloudD(0, -1, .6), "#c9d3e3", 1.6) + F("M1 2L-3 7H0L-1.5 11L3 5H0Z", T.yellow.b, 1.2),
  leaf: () => F("M-6 5C-6 -3 0 -7 6 -6C6 1 1 6 -6 5Z", T.green.b, 1.6) + L("M-6 5L3 -3", T.green.s, 1.2),
  mistletoe: () => F("M0 0C-5 -2 -8 -6 -7 -8C-4 -8 -1 -5 0 0Z M0 0C5 -2 8 -6 7 -8C4 -8 1 -5 0 0Z", T.green.b, 1.4) + dots([[-1.6, 2.4], [1.6, 2.4], [0, 4.6]], 1.5, "#fff", 1),
  clover: () => [0, 90, 180, 270].map((a) => `<g transform="rotate(${a})"><path d="M0 0C-2 -1.4 -4 -3.4 -4 -5.2C-4 -6.6 -3 -7.4 -2 -7.4C-1.2 -7.4 -.4 -7 0 -6.2C.4 -7 1.2 -7.4 2 -7.4C3 -7.4 4 -6.6 4 -5.2C4 -3.4 2 -1.4 0 0Z" fill="${T.green.b}" stroke="${INK}" stroke-width="1.3"/></g>`).join(""),
  atom: () => [0, 60, 120].map((a) => `<ellipse rx="7.5" ry="2.6" transform="rotate(${a})" fill="none" stroke="${INK}" stroke-width="1.6"/>`).join("") + `<circle r="1.8" fill="${T.cyan.b}" stroke="${INK}" stroke-width="1"/>`,
  rad: () => F(C(0, 0, 7.2), T.yellow.b, 1.6) + [0, 120, 240].map((a) => `<path transform="rotate(${a})" d="M-2.3 -1.4L-4.4 -5.6A6 6 0 0 1 4.4 -5.6L2.3 -1.4A2.6 2.6 0 0 0 -2.3 -1.4Z" fill="${INK}"/>`).join("") + `<circle r="1.3" fill="${INK}"/>`,
  hourglass: () => F("M-4.5 -7H4.5V-5.5L.8 0L4.5 5.5V7H-4.5V5.5L-.8 0L-4.5 -5.5Z", T.cream.b, 1.5) + fill("M-2.6 4.6H2.6L0 1.2Z M-2.4 -5H2.4L0 -2Z", T.tan.b),
  road: () => F("M-4 -8H4L7 8H-7Z", "#5a6178", 1.4) + L("M0 -6V-3M0 0V3M0 5.5V7.5", "#fff", 1.4),
  foot: () => `<path transform="scale(.5)" d="${FOOT}" fill="${INK}" opacity=".8"/>`,
  book: () => F("M-7 -4L0 -2L7 -4V5L0 7L-7 5Z", "#fff", 1.4) + L("M0 -2V7", INK, 1.2),
  planet: () => F(C(0, 0, 5), T.cyan.b, 1.6) + L("M-4 -2C-1 -1 1 1 4 1", "#fff", 1.2, .8),
  galaxy: () => L("M0 0a1.5 1.5 0 0 1 3 0a3 3 0 0 1 -6 0a4.5 4.5 0 0 1 9 0a6 6 0 0 1 -12 0", "#e6d4ff", 1.8) + `<circle r="1.4" fill="#fff"/>`,
  shush: () => F(C(0, 0, 7), P.skin.b, 1.6) + F("M-3.6 2.4Q0 4.2 3.6 2.4Q0 5.6 -3.6 2.4Z", T.red.b, 1) + F(R(-1.2, -2, 2.4, 9, 1.2), P.skin.h, 1.2),
  antler: () => L("M-2 6C-2 0 -5 -3 -7 -7M-4 -1L-7 -2M2 6C2 0 5 -3 7 -7M4 -1L7 -2", INK, 3.4) + L("M-2 6C-2 0 -5 -3 -7 -7M-4 -1L-7 -2M2 6C2 0 5 -3 7 -7M4 -1L7 -2", "#e9d7b0", 1.6),
  crown: () => F("M-7 4L-8 -5L-3.5 -1L0 -7L3.5 -1L8 -5L7 4Z", P.gold.b, 1.5),
  bus: () => F(R(-7, -5, 14, 10, 2.2), T.red.b, 1.4) + fill(R(-5.4, -3.4, 10.8, 3.6, .6), "#cfeeff") + F(C(-4, 5, 1.6), INK, 0) + F(C(4, 5, 1.6), INK, 0),
  zodiac: () => F(C(0, 0, 7.5), "#fff", 1.6) + `<circle r="4.4" fill="none" stroke="${INK}" stroke-width="1" opacity=".6"/>` + [0, 30, 60, 90, 120, 150].map((a) => `<path transform="rotate(${a})" d="M0 -7.5V-4.4M0 4.4V7.5" stroke="${INK}" stroke-width="1"/>`).join("") + L("M-1.6 -1C-1.6 -3 1.6 -3 1.6 -1M0 -1V2", INK, 1.2),
  cross: () => F("M-1.6 -7H1.6V-2.6H5.6V.6H1.6V7H-1.6V.6H-5.6V-2.6H-1.6Z", T.red.b, 1.3),
  paw: () => F(E(0, 2, 3.6, 3), INK, 0) + dots([[-4, -2], [-1.4, -4.6], [1.4, -4.6], [4, -2]], 1.4, INK, 0),
  heart: () => F("M0 5.5C-7 1 -6.5 -5.5 -3 -5.5C-1.4 -5.5 -.4 -4.4 0 -3.4C.4 -4.4 1.4 -5.5 3 -5.5C6.5 -5.5 7 1 0 5.5Z", T.red.b, 1.5),
  trefoil: () => EMB.rad(),
  horseshoe: () => TL("M-5 6V-1A5 5 0 0 1 5 -1V6", P.gold.b, 3.2) + fill(C(-5, 1, .7) + C(5, 1, .7) + C(-3.6, -4.2, .7) + C(3.6, -4.2, .7), INK),
  wave: () => L("M-7 0Q-3.5 -4 0 0T7 0M-7 4Q-3.5 0 0 4T7 4", T.cyan.b, 1.8),
  plough: () => dots([[-7, -1], [-4, -3], [-1, -2], [2, 0], [3, 4], [7, 4], [7, -0.6]], 1.4, P.gold.h, 1) + L("M-7 -1L-4 -3L-1 -2L2 0L3 4L7 4L7 -.6L2 0", P.gold.b, .8, .7),
};
const emb = (name, x, y, s) => EMB[name] ? at(x, y, s || 1, EMB[name]()) : "";

// Fabric patterns, drawn inside a garment's clip. g = the garment's options (g.pc = pattern colour).
const PAT = {
  hoops: (m, g) => [17, 31, 45].map((y) => fill(R(0, y, 64, 7, 0), (tone(g.pc) || P.white).b)).join(""),
  hivis: () => fill("M0 33H64V38H0Z M0 44H64V49H0Z", "#dfe5f0") + fill("M0 35H64V36H0Z M0 46H64V47H0Z", "#ffffff"),
  hivisV: () => fill("M0 36H64V41H0Z M0 47H64V52H0Z M16 0H21V36H16Z M43 0H48V36H43Z", "#dfe5f0"),
  quilt: (m) => L("M0 22H64M0 32H64M0 42H64M0 52H64M23 0V64M41 0V64", m.s, 1.8, .75) + L("M0 18H64M0 28H64M0 38H64M0 48H64", m.h, 1.4, .5),
  tweed: (m) => { let s = ""; for (let y = 10; y < 62; y += 5) for (let x = 6; x < 62; x += 6) s += `M${x} ${y}l2 2l2 -2`; return L(s, m.s, 1.2, .65); },
  stars: (m, g) => [[20, 22], [40, 30], [26, 42], [44, 48], [18, 52], [34, 18], [10, 34], [54, 38]].map(([x, y], i) => `<path d="${star(x, y, i % 3 ? 2.6 : 3.4, 1.1, 5, -90)}" fill="${(tone(g.pc) || P.gold).b}"/>`).join(""),
  starfield: () => [[20, 22], [40, 30], [26, 42], [44, 48], [18, 52], [34, 18], [10, 34], [54, 38], [30, 56], [48, 20]].map(([x, y], i) => i % 2 ? `<circle cx="${x}" cy="${y}" r="1.1" fill="#fff"/>` : Sp(x, y, 2.4)).join("") + L("M12 46C20 40 30 44 38 36C44 30 50 32 56 26", "#b9a6ff", 3, .35),
  moons: (m, g) => [[21, 24], [41, 32], [27, 44], [43, 50], [36, 18]].map(([x, y]) => fill(crescent(x, y, 3.2), (tone(g.pc) || T.yellow).b)).join("") + [[30, 30], [20, 36], [48, 40], [34, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff"/>`).join(""),
  spots: (m) => [[22, 24], [40, 30], [26, 40], [44, 46], [20, 52], [36, 20], [10, 30], [54, 36], [32, 50]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${2 + i % 2}" ry="1.6" fill="${m.s}" opacity=".8"/>`).join(""),
  coins: () => [[22, 26], [40, 32], [26, 44], [42, 50], [36, 20], [18, 36]].map(([x, y]) => F(C(x, y, 2.6), P.gold.b, 1.2)).join(""),
  clouds: () => [[22, 26], [42, 36], [26, 48]].map(([x, y]) => fill(cloudD(x, y, .5), "#fff", .9)).join(""),
  aurora: () => L("M0 24C12 18 20 30 32 24S52 18 64 24", "#5dffb0", 4, .55) + L("M0 34C12 28 20 40 32 34S52 28 64 34", "#c08bff", 4, .5) + L("M0 44C12 38 20 50 32 44S52 38 64 44", "#5de8ff", 4, .45),
  check: () => { let s = ""; for (let x = 0; x < 64; x += 6) s += `M${x} ${(x / 6) % 2 ? 36 : 42}h6v6h-6Z`; return fill(s, "#ffd23d") + fill("M0 36H64V48H0Z", "none"); },
  battenburg: () => { let s = ""; for (let x = 0; x < 64; x += 7) s += `M${x} ${(x / 7) % 2 ? 30 : 37}h7v7h-7Z`; return fill(s, T.yellow.b); },
  hex: (m) => { let s = ""; for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) { const x = c * 11 + (r % 2) * 5.5, y = 8 + r * 9.5; s += poly([0, 60, 120, 180, 240, 300].map((a) => [x + Math.cos(a * Math.PI / 180) * 5.6, y + Math.sin(a * Math.PI / 180) * 5.6])); } return L(s, INK, 1.4, .45) + fill(s, m.h, .12); },
  scales: (m) => { let s = ""; for (let r = 0; r < 9; r++) for (let c = -1; c < 9; c++) { const x = c * 8 + (r % 2) * 4, y = 12 + r * 6; s += `M${x} ${y}a4 4 0 0 0 8 0`; } return L(s, m.s, 1.4, .8); },
  crinkle: (m) => L("M14 18L20 24L16 30L22 36M40 16L36 24L42 30L38 38M18 44L26 48L22 54M42 44L48 50L44 56M28 28L34 32", "#fff", 1.6, .8) + L("M16 22L22 28M38 20L44 26M24 50L30 46M30 36L36 40", INK, 1.2, .3),
  knit: (m) => { let s = ""; for (let x = 8; x < 60; x += 5) s += `M${x} 8v52`; return L(s, m.s, 1, .45); },
  stripes: (m, g) => { let s = ""; for (let x = 4; x < 64; x += 7) s += `M${x} 0h2.6v64h-2.6Z`; return fill(s, (tone(g.pc) || P.white).b, .9); },
  shell: (m, g) => fill("M0 28L64 12V22L0 38Z", (tone(g.pc) || T.cyan).b) + fill("M0 38L64 22V25L0 41Z", "#fff") + fill("M4 38L16 35L13 46L2 44Z M60 38L48 35L51 46L62 44Z", (tone(g.pc) || T.cyan).b),
  xmas: () => F("M32 22L40 36H36L42 46H22L28 36H24Z", T.green.b, 1.6) + F(R(30, 46, 4, 4, 0), T.brown.b, 1.2) + S(star(32, 21, 3.6, 1.6, 5, -90), P.gold, { a: 0, b: 0, sw: 1.2 }) +
    dots([[29, 34], [35, 40], [27, 43]], 1.2, T.red.b, .8) + [[18, 26], [47, 28], [20, 50], [45, 52]].map(([x, y]) => L(`M${x - 3} ${y}H${x + 3}M${x} ${y - 3}V${y + 3}M${x - 2} ${y - 2}L${x + 2} ${y + 2}M${x + 2} ${y - 2}L${x - 2} ${y + 2}`, "#fff", 1.2)).join("") +
    fill("M0 54H64V57H0Z", "#fff", .85) + L("M0 55.5L4 53.5L8 55.5L12 53.5L16 55.5L20 53.5L24 55.5L28 53.5L32 55.5L36 53.5L40 55.5L44 53.5L48 55.5L52 53.5L56 55.5L60 53.5L64 55.5", T.red.b, 1.2),
  leaves: () => [[20, 22, 20], [40, 28, -30], [26, 40, 60], [44, 46, 10], [18, 52, -40], [34, 54, 80], [36, 16, 140], [12, 34, 100], [52, 38, 30]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M-4 2C-4 -2 0 -4 4 -3C4 1 1 3 -4 2Z" fill="${T.green.b}" stroke="${INK}" stroke-width="1" opacity=".95"/>`).join(""),
  stones: () => [[16, 54], [26, 52], [38, 52], [48, 54]].map(([x, y]) => F(R(x - 3, y - 7, 6, 11, 1.4), T.stone.b, 1.2)).join("") + F(R(23, 43, 18, 3.6, 1), T.stone.b, 1.2),
  feathers: (m) => [[22, 26, 20], [40, 34, -20], [26, 46, 30], [44, 50, -10], [34, 18, 0]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 -5C3 -3 3 3 0 5C-3 3 -3 -3 0 -5Z" fill="${m.h}" opacity=".75"/>`).join(""),
  crumbs: () => [[22, 40], [36, 46], [44, 36], [28, 52], [18, 50], [40, 54], [30, 30]].map(([x, y]) => F(C(x, y, 1.6), "#e0aa5e", 1.1)).join(""),
  gems: () => [[22, 40, T.cyan.b], [36, 46, T.purple.h], [44, 36, T.cyan.b], [28, 52, T.pink.b], [18, 50, T.cyan.h], [41, 54, T.purple.h], [30, 30, T.cyan.h]].map(([x, y, c]) => F(`M${x} ${y - 3}L${x + 2.6} ${y}L${x} ${y + 3}L${x - 2.6} ${y}Z`, c, 1.2)).join(""),
  drops: () => [[22, 38], [36, 44], [44, 34], [28, 52], [18, 49], [41, 54], [30, 26]].map(([x, y]) => F(drop(x, y, .6), "#e8f8ff", 1.1, .95)).join(""),
  soot: () => fill("M38 44C42 40 48 42 49 48C46 52 40 52 37 49Z M17 22C20 19 25 21 24 26C21 28 17 27 17 22Z M22 50C24 48 27 49 27 52C25 54 22 53 22 50Z", "#4a3a2c", .75),
  stains: () => fill("M40 40C43 37 48 38 48 42C46 45 42 45 40 40Z M20 48C22 46 26 47 25 50C23 52 20 51 20 48Z M30 30C31 28 34 29 33.5 31Z M44 24C46 23 48 25 46.5 27Z", "#7a5a2e", .7),
  zap: () => L("M14 22L20 27L16 31L22 36M44 22L40 28L46 31L42 38", "#fff", 2, .85),
  bubbles: (m) => [[20, 26], [27, 33], [36, 26], [44, 33], [22, 40], [31, 47], [41, 41], [26, 54], [38, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#fff" opacity=".55" stroke="${m.s}" stroke-width="1"/>`).join(""),
  grid: () => L("M22 0V64M42 0V64M0 30H64M0 40H64", INK, 1.6, .35),
  diamonds: (m, g) => { let s = ""; for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) if ((r + c) % 2) s += `M${c * 8} ${r * 9 + 4}l4 -4.5l4 4.5l-4 4.5Z`; return fill(s, (tone(g.pc) || T.yellow).b); },
  plaid: (m) => fill("M0 20H64V24H0Z M0 40H64V44H0Z M18 0H22V64H18Z M42 0H46V64H42Z", m.s, .55) + L("M0 31H64M31 0V64", "#fff", 1, .45),
  lightning: () => L("M12 20L22 30L16 34L28 46M52 18L44 28L50 32L40 44", T.yellow.b, 2.4, .95),
  rainbow: () => ["#ff4d5e", "#ff8a2b", "#ffd23d", "#45d483", "#4a7dff", "#9b5de5"].map((c, i) => fill(R(0, 14 + i * 7, 64, 7, 0), c)).join(""),
  void: () => PAT.starfield(),
  road: () => fill("M27 0H37V64H27Z", "#5a6178") + L("M32 4V10M32 16V22M32 28V34M32 40V46M32 52V58", "#fff", 1.6),
  clocks: () => [[22, 30], [42, 42]].map(([x, y]) => F(C(x, y, 4.2), "#fff", 1.2) + L(`M${x} ${y - 2.6}V${y}L${x + 2} ${y + 1}`, INK, 1)).join(""),
  sweat: () => "",
};

/* ------------------------------------------------------------------ */
/* Garments: one cut, built from real construction details               */
/* ------------------------------------------------------------------ */
// Presets: len = hem y, sl = sleeves (long/short/none), collar, close, pk = pockets, rib = ribbed hem+cuffs.
const GARB = {
  coat: { len: 58, collar: "lapel", close: "buttons", pk: "flap" },
  bomber: { len: 47, collar: "rib", close: "zip", pk: "slant", rib: 1, puff: 1 },
  anorak: { len: 56, collar: "hood", close: "zip", pk: "flap", cord: 1 },
  parka: { len: 60, collar: "fur", close: "zip", pk: "flap" },
  labcoat: { len: 61, collar: "lapel", close: "buttons", pk: "patch", pens: 1, ink: 1 },
  track: { len: 50, collar: "funnel", close: "zip", rib: 1, pat: "shell" },
  leathers: { len: 49, collar: "biker", close: "asym", pk: "zipk", belt: 1 },
  waxed: { len: 56, collar: "cord", close: "studs", pk: "bellows", wax: 1 },
  duffel: { len: 57, collar: "hood", close: "toggles", pk: "patch" },
  cardigan: { len: 53, collar: "vneck", close: "buttons", pk: "patch", rib: 1, pat: "knit" },
  blazer: { len: 55, collar: "lapel", close: "buttons2", pk: "flap", hanky: 1 },
  smoking: { len: 55, collar: "shawl", close: "belt", pk: "patch" },
  gown: { len: 61, collar: "shawl", close: "belt", pk: "patch", flare: 1 },
  pyjamas: { len: 51, collar: "shirt", close: "buttons", pk: "chest", piping: 1 },
  rugby: { len: 51, collar: "shirt", close: "placket", pat: "hoops" },
  jumper: { len: 51, collar: "crew", rib: 1 },
  shell: { len: 54, collar: "hood", close: "zip", pk: "chestzip", slim: 1 },
  donkey: { len: 55, collar: "lapel", close: "buttons", pk: "flap", yoke: 1 },
  trench: { len: 59, collar: "lapel", close: "open", belt: 1, flare: 1 },
  mail: { len: 60, collar: "hood", coif: 1, pat: "rings" },
  hivis: { len: 56, sl: "none", collar: "vee", close: "zip", pat: "hivis" },
  singlet: { len: 54, sl: "none", collar: "scoop", bib: 1 },
  waistcoat: { len: 52, sl: "none", collar: "vee", close: "buttons", pk: "welt", points: 1, v: 30 },
};
const COLLAR = {
  rib: (m, tr) => S("M21.5 5Q32 15 42.5 5L45 8.6Q32 20 19 8.6Z", tr, { a: [0, 1.4], b: 0, sw: 2.2, inner: L("M24 9.5L23 12M28 12L27.6 14.6M32 13V15.8M36 12L36.4 14.6M40 9.5L41 12", tr.s, 1.2) }),
  lapel: (m, tr) => fill("M26 6L32 13L38 6Z", "#f3f6fd") + S("M24 6L32 13L29.5 28L19.5 9Z", dk(m), { a: [1, 1], b: 1 }) + S("M40 6L32 13L34.5 28L44.5 9Z", dk(m), { a: [1, 1], b: 0 }),
  biker: (m) => S("M23 6L33 14L27 30L15 13L19 7Z", dk(m), { a: [1, 1], b: 1 }) + S("M41 6L33 14L35 22L47 13L45 7Z", dk(m), { a: [1, 1], b: 0 }) + dots([[18, 12], [44, 12]], 1.2, P.metal.b, 1),
  shawl: (m, tr) => S("M24 6C21 17 25 28 32 37L28.5 38C20 30 17 18 19.5 9Z", tr, { a: [1, 1], b: 1 }) + S("M40 6C43 17 39 28 32 37L35.5 38C44 30 47 18 44.5 9Z", tr, { a: [1, 1], b: 0 }),
  shirt: (m, tr) => S("M24 5L32 12L26 17L20.5 8Z", tr, { a: [0, 1], b: 0, sw: 2 }) + S("M40 5L32 12L38 17L43.5 8Z", tr, { a: [0, 1], b: 0, sw: 2 }),
  crew: (m, tr) => S("M23 5Q32 14 41 5L43 8Q32 18 21 8Z", tr, { a: [0, 1.2], b: 0, sw: 2 }),
  vneck: (m, tr) => S("M23 5L32 21L41 5L43.5 7.4L32 26L20.5 7.4Z", tr, { a: [0, 1.2], b: 0, sw: 2 }),
  vee: () => "",
  scoop: (m, tr) => L("M24 6Q32 18 40 6", tr.s, 2.4),
  funnel: (m, tr) => S(R(24, 1, 16, 9, 3), tr, { a: [0, 1.6], b: 0, sw: 2.2 }) + L("M32 1V10", INK, 1.6, .6),
  cord: (m) => S("M21 5L32 12L43 5L46 9.5L36 15H28L18 9.5Z", T.brown, { a: [0, 1.4], b: 0, sw: 2.2, inner: L("M22 7L20 10M25 9L23 12M28 11L27 14M36 11L37 14M39 9L41 12M42 7L44 10", T.brown.s, 1.2) }),
  hood: () => F("M24 14C24 8.5 27 5.5 32 5.5C37 5.5 40 8.5 40 14C37 16.5 27 16.5 24 14Z", P.dark.s),
  fur: () => F("M24 14C24 8.5 27 5.5 32 5.5C37 5.5 40 8.5 40 14C37 16.5 27 16.5 24 14Z", P.dark.s) +
    [[22, 15], [21.5, 10.5], [23.5, 6], [27.5, 3], [32, 2], [36.5, 3], [40.5, 6], [42.5, 10.5], [42, 15], [37, 17.5], [32, 18.2], [27, 17.5]].map(([x, y]) => F(C(x, y, 2.9), "#efe4cf", 1.4)).join("") +
    fill("M24 14C24 8.5 27 5.5 32 5.5C37 5.5 40 8.5 40 14C37 16.5 27 16.5 24 14Z", P.dark.s),
};
function garment(m, v, o) {
  const g = Object.assign({}, GARB[v] || GARB.coat, o || {});
  const len = +g.len, sl = g.sl || "long", tr = tone(g.trim) || dk(m);
  let body;
  if (sl === "none") body = g.points ? `M24 6L32 ${+g.v || 14}L40 6L46 6C46 14 49 19 52 22V${len - 6}L35 ${len}L32 ${len - 4}L29 ${len}L12 ${len - 6}V22C15 19 18 14 18 6Z` : `M24 6L32 ${+g.v || 14}L40 6L46 6C46 14 49 19 52 22V${len - 2}Q52 ${len} 50 ${len}H14Q12 ${len} 12 ${len - 2}V22C15 19 18 14 18 6Z`;
  else if (sl === "short") body = `M24 6L32 12L40 6L51 9L59 24L51 29L48 25V${len - 2}Q48 ${len} 46 ${len}H18Q16 ${len} 16 ${len - 2}V25L13 29L5 24L13 9Z`;
  else if (g.slim) body = `M24 6L32 12L40 6L50 9C54 14 56 27 57 42L50 43.5L48 31V${len - 2}Q48 ${len} 46 ${len}H18Q16 ${len} 16 ${len - 2}V31L14 43.5L7 42C8 27 10 14 14 9Z`;
  else body = `M24 6L32 12L40 6L51 9C55 14 57 27 59 42L51 44L49 31${g.flare ? `L53 ${len - 2}Q53 ${len} 51 ${len}H13Q11 ${len} 11 ${len - 2}L15 31` : `V${len - 2}Q49 ${len} 47 ${len}H17Q15 ${len} 15 ${len - 2}V31`}L13 44L5 42C7 27 9 14 13 9Z`;
  let inner = (g.pat ? PAT[g.pat](m, g) : "") + (g.pat2 ? PAT[g.pat2](m, g) : "") + (sl === "long" ? L("M15 31L16.5 19M49 31L47.5 19", INK, 1.6, .35) : "");
  if (g.puff) inner += L("M9 22Q12 23 14 22M55 22Q52 23 50 22", m.h, 1.6, .6);
  if (g.wax) inner += L("M20 20Q24 30 21 44M42 18Q45 30 41 46M28 36Q32 40 36 36", "#fff", 1.6, .35);
  if (g.yoke) inner += fill("M13 9L24 6L32 12L40 6L51 9L52 16H12Z", "#2b2f45");
  if (g.piping) inner += L(`M32 12V${len}`, tr.h, 3, .6);
  if (g.bib) inner += fill(R(21, 26, 22, 15, 1.5), "#fff") + `<text x="32" y="37.6" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="9" text-anchor="middle" fill="${INK}">${g.num || 27}</text>` + dots([[23, 28], [41, 28], [23, 39], [41, 39]], .7, "#bbb", .6);
  if (g.ins) inner += g.ins;
  let out = "";
  if (g.collar === "hood" || g.collar === "fur") out += S("M18 17C15.5 7 22 1 32 1C42 1 48.5 7 46 17C42 13 22 13 18 17Z", tr, { a: [2, 1.5], b: 1.4, inner: g.coif ? PAT.rings(tr) : "" });
  out += S(body, m, { a: [4, 2], ink: g.ink, inner });
  if (g.rib && sl === "long") out += S(R(15, len - 5, 34, 5, 1.5), tr, { a: [0, 1.4], b: 0, sw: 2.2, inner: L(`M19 ${len - 5}v5M23 ${len - 5}v5M27 ${len - 5}v5M31 ${len - 5}v5M35 ${len - 5}v5M39 ${len - 5}v5M43 ${len - 5}v5`, tr.s, 1) }) +
    S("M5 42L13 44L13.9 39.6L5.7 37.6Z", tr, { a: 0, b: 0, sw: 2 }) + S("M59 42L51 44L50.1 39.6L58.3 37.6Z", tr, { a: 0, b: 0, sw: 2 });
  if (g.cuffs && sl === "long") out += S("M5 42L13 44L13.9 39.6L5.7 37.6Z", tone(g.cuffs), { a: 0, b: 0, sw: 2 }) + S("M59 42L51 44L50.1 39.6L58.3 37.6Z", tone(g.cuffs), { a: 0, b: 0, sw: 2 });
  if (g.close === "open") {
    const lin = tone(g.lining) || T.maroon;
    out += S(`M27 12L37 12L41 ${len}H23Z`, lin, { a: [2, 0], b: 0, sw: 2.2, inner: L(`M32 12V${len}`, INK, 1.2, .3) });
    const pk = g.many ? [[25, 18], [33.5, 18], [25, 26], [33.5, 26], [24.5, 34], [34, 34], [24, 42], [34.5, 42], [23.6, 50], [35, 50]] : [[25, 30], [34, 30]];
    out += pk.map(([x, y]) => F(R(x, y, 6, 5.5, 1), lin.s, 1.4) + L(`M${x + .8} ${y + 1.6}H${x + 5.2}`, lin.h, 1, .7)).join("");
    out += L(`M23 ${len}L27 12M41 ${len}L37 12`, m.h, 1.6, .8);
  }
  if (COLLAR[g.collar]) out += COLLAR[g.collar](m, tr, g);
  // closures
  const top = g.collar === "hood" || g.collar === "fur" ? 16 : g.collar === "funnel" ? 10 : 12;
  if (g.close === "zip") out += L(`M32 ${top}V${len}`, INK, 2.2, .55) + L(`M32 ${top + 1}V${len - 1}`, P.metal.b, 1, .9, ' stroke-dasharray="1 1.4"') + F(R(30.6, top + 2, 2.8, 5, 1), P.metal.b, 1.4);
  if (g.close === "asym") out += L(`M38 13L31 ${len}`, INK, 2.2, .6) + F(R(35.6, 16, 2.8, 5, 1), P.metal.b, 1.4);
  if (g.close === "buttons" || g.close === "studs" || g.close === "placket") {
    const ys = g.close === "placket" ? [15, 21] : [18, 27, 36, 45, 54].filter((y) => y < len - 3);
    out += (g.close === "placket" ? F(R(29.5, 11, 5, 14, 1), "#fff", 1.6) : L(`M32 ${top + 2}V${len}`, INK, 1.4, .4)) +
      ys.map((y) => F(C(32, y, g.close === "studs" ? 1.3 : 1.6), g.close === "studs" ? P.metal.b : (tone(g.btn) || tr).h, 1.2)).join("");
  }
  if (g.close === "buttons2") out += L(`M32 28V${len}`, INK, 1.4, .4) + F(C(32, 33, 1.7), "#3a2a1c", 1.2) + F(C(32, 41, 1.7), "#3a2a1c", 1.2);
  if (g.close === "toggles") out += [20, 30, 40].map((y) => L(`M26 ${y}H38`, "#d8c8a0", 1.4) + F(R(28, y - 1.6, 8, 3.2, 1.6), P.wood.b, 1.4)).join("") + L(`M32 16V${len}`, INK, 1.2, .3);
  if (g.close === "belt") out += S(R(15, 35, 34, 4.4, 1), tr, { a: [0, 1.2], b: 0, sw: 2 }) + F("M32 37L26 46L29 47L32 39L35 47L38 46Z", tr.b, 1.8) + F(C(32, 37, 2.4), tr.b, 1.6);
  if (g.belt) out += S(R(15, len - 8, 34, 4, 1), P.dark, { a: [0, 1], b: 0, sw: 2 }) + F(R(29, len - 9, 6, 6, 1), "none", 1.6).replace(`stroke="${INK}"`, `stroke="${P.metal.b}"`);
  // pockets
  const pkY = len - 15;
  if (g.pk === "patch") out += F(R(18.5, pkY, 9, 8, 1.4), m.s, 1.8) + F(R(36.5, pkY, 9, 8, 1.4), m.s, 1.8);
  if (g.pk === "many") out += [[17.5, 30], [37.5, 30], [17.5, 38], [37.5, 38], [17.5, 46], [37.5, 46]].map(([x, y]) => F(R(x, y, 9, 6, 1.2), m.s, 1.6) + L(`M${x + 1} ${y + 2}H${x + 8}`, m.h, 1, .6)).join("");
  if (g.pk === "flap") out += [18.5, 36.5].map((x) => F(R(x, pkY, 9, 8, 1.2), m.s, 1.8) + F(R(x - .5, pkY - 1.5, 10, 3.6, 1), dk(m).b, 1.6)).join("");
  if (g.pk === "bellows") out += [17.5, 36].map((x) => F(R(x, pkY - 2, 10.5, 10, 1.4), m.s, 1.8) + F(R(x - .5, pkY - 4, 11.5, 4.4, 1.4), dk(m).b, 1.6) + F(C(x + 5.25, pkY - 2, .9), P.metal.b, .8)).join("") + F(R(20, 18, 7, 7, 1), m.s, 1.6) + F(R(19.5, 16.5, 8, 3, 1), dk(m).b, 1.4);
  if (g.pk === "slant") out += L(`M20 ${len - 15}L23 ${len - 8}M44 ${len - 15}L41 ${len - 8}`, INK, 2, .6);
  if (g.pk === "zipk") out += L(`M18 ${len - 18}L24 ${len - 11}M45 20L41 25`, P.metal.b, 1.8) + L(`M18 ${len - 18}L24 ${len - 11}M45 20L41 25`, INK, .8, .6);
  if (g.pk === "chest") out += F(R(36, 18, 8, 7, 1.2), m.s, 1.6);
  if (g.pk === "chestzip") out += L("M37 18L45 20", INK, 1.8, .6) + F(R(44, 18.4, 2, 3.4, .6), P.metal.b, 1);
  if (g.pk === "welt") out += L("M17 40H25M39 40H47M38 22H45", INK, 2, .55);
  if (g.pens) out += F(R(37, 17, 8, 8, 1.2), "#e9eef7", 1.6) + F(R(38.5, 13, 2, 6, 1), T.blue.b, 1.2) + F(R(41.5, 14, 2, 5, 1), T.red.b, 1.2);
  if (g.hanky) out += F("M38 18L40 15L42 17L44 15L45 18Z", "#fff", 1.4) + L("M37 19H46", INK, 1.6, .55);
  if (g.cord) out += L(`M28 16V22M36 16V22`, "#fff", 1.6) + F(C(28, 23, 1.3), P.metal.b, 1) + F(C(36, 23, 1.3), P.metal.b, 1);
  if (g.studs2) out += dots([[16, 12], [48, 12], [17, 16], [47, 16]], 1, P.metal.h, 1);
  if (g.emb) out += emb(g.emb, +g.ex || 39, +g.ey || 22, +g.es || 1);
  if (g.emb2) out += emb(g.emb2, +g.ex2 || 24, +g.ey2 || 40, +g.es2 || 1);
  if (g.elbow && sl === "long") out += F(E(9.6, 33, 2.6, 4.4), T.brown.b, 1.6, .95) + F(E(54.4, 33, 2.6, 4.4), T.brown.b, 1.6, .95);
  if (g.tag) out += L("M53 40L55 45", INK, 1.2) + G("rotate(16 56 50)", S("M50 46L52.6 43.4H62V54H50Z", P.paper, { a: 1, b: 0, sw: 1.8 }) + Tx(56.4, 51.6, g.tag, 5, T.red.s));
  if (g.add) out += g.add;
  return out;
}

// A shaded round rod along any path (handles, shafts, cords): outline, shade, body, glint.
const rod = (d, q, w, x) => L(d, INK, w + 3, null, x) + L(d, q.s, w, null, x) + L(d, q.b, w * .55, null, ` transform="translate(${-w * .14} ${-w * .14})"` + (x || "")) + L(d, q.h, Math.max(.8, w * .16), .85, ` transform="translate(${-w * .3} ${-w * .3})"` + (x || ""));
const diag = (s, a) => rot(s, a == null ? 45 : a);

Object.assign(PAT, {
  scuffs: () => L("M18 22L26 28M20 26L27 31M38 40L46 36M40 44L47 40M22 48L28 46", "#c9cfe0", 1.4, .8),
  racing: () => fill("M24 0H28V64H24Z", "#fff") + fill("M28 0H31V64H28Z", T.red.b),
});
Object.assign(EMB, {
  table: () => F(C(0, 0, 6.5), P.wood.b, 1.6) + dots([[0, -8.6], [7.4, -4.3], [7.4, 4.3], [0, 8.6], [-7.4, 4.3], [-7.4, -4.3]], 1.4, P.gold.b, 1) + `<circle r="2" fill="${T.red.b}"/>`,
  eclipse: () => S(star(0, 0, 9, 6.4, 14, -90), T.yellow, { a: 0, b: 0, sw: 1.4 }) + F(C(0, 0, 5.6), "#0b0a18", 1.6),
  lamp: () => F(R(-4, -3, 8, 6, 1.5), P.dmetal.b, 1.4) + F(C(0, 0, 2.2), "#fff3a0", 1),
});
Object.assign(OV, {
  beam: () => fill("M30 2L2 -6V14Z M34 2L62 -6V14Z", "#fff3a0", .55) + S(R(28, 0, 8, 6, 1.5), T.yellow, { a: 0, b: 0, sw: 1.6 }),
  confetti: () => [[8, 8, T.pink.b, 20], [56, 6, T.yellow.b, -30], [58, 52, T.cyan.b, 40], [6, 50, T.green.b, -10], [20, 4, T.blue.b, 60]].map(([x, y, c, a]) => `<rect x="${x - 2}" y="${y - 1}" width="4" height="2.4" rx=".6" transform="rotate(${a} ${x} ${y})" fill="${c}" stroke="${INK}" stroke-width="1"/>`).join("") + L("M48 18C52 14 50 10 54 8M10 30C14 28 12 24 16 22", T.pink.b, 1.8),
  p50: (x, y) => S(C(x, y, 7.5), T.orange, { a: 1.2, b: .8, sw: 2 }) + Tx(x, y + 2.6, "50p", 6.4, "#fff"),
  retro: (x, y) => S(C(x, y, 5), T.steel, { a: 1, b: .6, sw: 1.8 }) + L(`M${x + 9} ${y + 3}C${x + 8} ${y + 9} ${x - 6} ${y + 10} ${x - 9} ${y + 4}`, INK, 3.4) + L(`M${x + 9} ${y + 3}C${x + 8} ${y + 9} ${x - 6} ${y + 10} ${x - 9} ${y + 4}`, T.orange.b, 1.6) + F(`M${x - 11} ${y + 1}L${x - 9} ${y + 7}L${x - 5} ${y + 3}Z`, T.orange.b, 1.2),
  cracks: () => L("M2 30L12 28L16 34L24 32M62 20L52 24L50 30L42 30M40 62L38 52L44 48", "#fff", 2, .9) + L("M2 30L12 28L16 34L24 32M62 20L52 24L50 30L42 30M40 62L38 52L44 48", INK, .8, .6),
  web: (x, y) => L(`M${x - 10} ${y - 10}L${x + 6} ${y + 6}M${x - 10} ${y + 2}L${x + 6} ${y - 4}M${x - 3} ${y - 10}V${y + 8}M${x - 8} ${y - 4}Q${x - 3} ${y - 2} ${x + 2} ${y - 6}M${x - 7} ${y + 2}Q${x - 2} ${y} ${x + 4} ${y + 2}`, "#fff", 1.2, .9),
  nail: (x, y) => G(`rotate(25 ${x} ${y})`, S(R(x - 1.2, y - 8, 2.4, 14, .6), P.metal, { a: 0, b: 0, sw: 1.6 }) + S(R(x - 3.6, y - 9, 7.2, 2.4, 1), P.metal, { a: 0, b: 0, sw: 1.6 }) + L(`M${x} ${y + 2}L${x + 4} ${y + 6}`, INK, 0)),
});

const _book = (m, v) => {
    const thick = v === "dict" || v === "volk" ? 7 : 4;
    const [X, Y, W, H] = v === "atlas" ? [7, 13, 46, 37] : v === "ledger" ? [14, 3, 31, 56] : [12, 7, 34, 47];
    const one = (q, deco, r) => rot(
      S(R(X + thick, Y + 3, W, H - 1, 2), P.paper, { a: [0, 1.5], b: 0, inner: L(`M${X + W + thick - 2} ${Y + 6}V${Y + H - 1}M${X + W + thick - 5} ${Y + 6}V${Y + H - 1}`, INK, 1.2, .3) }) +
      (v === "first" ? S(R(40, 38, 8, 22, 1), P.paper, { a: 0, b: 0, sw: 1.8, inner: L("M42 46H46M42 49H46M42 52H45", T.red.b, 1, .9) }) : F(`M${X + 25} ${Y + H - 1}V${Y + H + 6}L${X + 27.5} ${Y + H + 3.5}L${X + 30} ${Y + H + 6}V${Y + H - 1}Z`, T.red.b, 1.8)) +
      S(R(X, Y, W, H, 3), q, { a: [3.5, 3], inner: fill(R(X, Y, 6, H, 0), q.s) + L(`M${X + 6} ${Y}V${Y + H}`, INK, 1.6, .35) }) + deco, r == null ? -8 : r);
    const corners = F(`M${X + W - 8} ${Y}H${X + W - 3}Q${X + W} ${Y} ${X + W} ${Y + 3}V${Y + 8}Z`, P.gold.b, 2) + F(`M${X + W} ${Y + H - 8}V${Y + H - 3}Q${X + W} ${Y + H} ${X + W - 3} ${Y + H}H${X + W - 8}Z`, P.gold.b, 2);
    if (v === "ledger") return one(m, corners + F(R(23, 10, 17, 10, 1.5), P.paper.b, 2) + L("M26 14H37M26 17H33", INK, 1.6, .4) + Tx(31.5, 34, "£", 12, P.gold.b, { stroke: INK, sw: 2 }) +
      S(R(36, 36, 16, 8, 1.6), T.brown, { a: [0, 1.4], b: 0, sw: 2 }) + S(R(42, 34.4, 8, 11, 2), P.gold, { a: 1.2, b: .8, sw: 2 }) + F(C(46, 39.6, 1.4), INK, 1) + L("M17 52H41", P.gold.b, 1.4, .8));
    if (v === "dict") return one(m, corners + Tx(32, 28, "A–Z", 9, P.gold.b, { stroke: INK, sw: 2 }) + L("M22 34H42M22 38H38", P.gold.b, 1.6, .8)) + rot([14, 22, 30, 38].map((y) => F(R(51, y, 4, 5, 1.5), "#fff", 1.2)).join(""), -8);
    if (v === "volk") return one(m, corners + Tx(32, 40, "K", 22, P.gold.b, { stroke: INK, sw: 2.4 }) + L("M22 15H42", P.gold.b, 1.6));
    if (v === "cipher") return one(m, F(R(21, 14, 22, 22, 1.5), P.paper.b, 1.8) + L("M28.3 14V36M35.6 14V36M21 21.3H43M21 28.6H43", INK, 1, .4) + fill("M23 16h3v3h-3Z M37 23h3v3h-3Z M30 30h3v3h-3Z", INK, .75) + Tx(32, 46, "SECRET", 5, T.red.b));
    if (v === "almanac") return one(m, at(27, 25, 1, EMB.sun()) + at(36, 30, 1.1, EMB.cloud()) + L("M22 42H42M22 46H36", P.gold.b, 1.6));
    if (v === "tally") return one(m, L("M22 18V30M25 18V30M28 18V30M31 18V30M20 27L33 20M36 18V30M39 18V30M42 18V30M22 36V48M25 36V48M28 36V48", P.gold.b, 1.8));
    if (v === "atlas") return one(m, corners + S(C(31, 30, 9), T.cyan, { a: 1.4, b: 1, sw: 2, inner: fill("M25 24C28 22 31 25 30 28C28 31 25 30 25 27Z M33 32C36 30 39 33 37 36C35 38 32 36 33 32Z", T.green.b) + L("M22 30H40M31 21C27 26 27 34 31 39M31 21C35 26 35 34 31 39", INK, .9, .4) }));
    if (v === "first") return one(m, F(R(21, 14, 22, 28, 1), "none", 1.6).replace(`stroke="${INK}"`, `stroke="${P.gold.b}"`) + Tx(32, 32, "1st", 9.5, P.gold.b));
    if (v === "runes") return glow(30, 30, 26, m.h, .45) + one(m, L("M24 16L28 24L24 32M32 14V30M30 18L34 22M38 16L42 22L38 28M24 38H30L27 46M36 38L40 46M40 38L36 46", m.h, 2));
    if (v === "notes") return one(m, dots([[13, 12], [13, 18], [13, 24], [13, 30], [13, 36], [13, 42], [13, 48]], 1.6, P.metal.b, 1.2) + L("M22 16C26 13 28 19 32 15C36 12 38 18 42 15M22 22C25 20 30 24 34 21", INK, 1.2, .6) + at(32, 34, 1.2, EMB.stars()) +
      G("rotate(10 46 18)", S(R(41, 13, 10, 9, .5), T.yellow, { a: 0, b: 0, sw: 1.6 })) + G("rotate(-8 47 40)", S(R(42, 36, 10, 9, .5), T.pink, { a: 0, b: 0, sw: 1.6 })) + L("M23 44L27 48M27 44L23 48", T.red.b, 1.8));
    if (v === "jacket") return one(m, corners + S("M32 20L39 30L32 40L25 30Z", P.gold, { a: 2, b: 1.4 }) + fill("M12 54L46 7L46 15L18 54Z", "#fff", .3) + L("M14 52L44 10", "#fff", 1.4, .7));
    if (v === "mace") {
      const spike = (x, y, a) => G(`rotate(${a} ${x} ${y})`, S(`M${x - 3} ${y + 1}L${x} ${y - 7}L${x + 3} ${y + 1}Z`, P.metal, { a: 0, b: [.8, 0], sw: 1.8 }));
      return rod("M7 62L22 47", P.dwood, 6.4) + S(R(17, 47, 10, 6, 2), P.gold, { a: 0, b: 0, sw: 2 }) +
        one(m, corners + Tx(31, 31, "A–Z", 9, P.gold.b, { stroke: INK, sw: 2 }) + L("M22 37H40", P.gold.b, 1.6) + [[19, 7, 0], [29, 7, 0], [39, 7, 0], [12, 16, -90], [12, 28, -90], [50, 19, 90], [50, 31, 90], [50, 43, 90]].map(([x, y, a]) => spike(x, y, a)).join(""));
    }
    const main = one(m, corners + S("M32 20L39 30L32 40L25 30Z", P.gold, { a: 2, b: 1.4 }) + F(C(32, 30, 2.6), T.red.b, 1.6));
    if (v === "stack") return G("translate(5 -3) rotate(10 32 32)", one(T.mustard, corners, 0)) + main;
    return main;
  },
  _clover = (m) =>
    S(R(10, 8, 44, 50, 8), pal("#eafff3", "#b5dcc8", "#ffffff"), { a: 2.5, b: 2, inner: fill("M10 33L37 8H47L10 43Z", "#fff", .7) }) +
    TL("M32 32C33 41 36 47 42 53", m.s, 3) +
    [0, 90, 180, 270].map((a, i) => G(`rotate(${a} 32 30)`, S(leaf64, i % 2 ? dk(m) : m, { a: [1.6, 1.6], b: 1.4, sw: 2.2 }) + L("M32 28V16", i % 2 ? m.b : m.s, 1.6, .7))).join("") +
    Gl(20, 15, 1.4, 5, 45, .8),
  _ticket = (m, v) => {
    const t = "M8 18H56V28C53 28 51 30 51 32C51 34 53 36 56 36V46H8V36C11 36 13 34 13 32C13 30 11 28 8 28Z";
    const one = (q) => S(t, q, {
      a: [0, 3], b: [0, 2],
      inner: `<path d="M44 18V46" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3" opacity=".45"/>` + fill(R(17, 24, 20, 4, 2), INK, .25) + fill(R(17, 31, 14, 4, 2), INK, .25) + fill(R(17, 38, 20, 3, 1.5), "#fff", .7),
    });
    return (v === "stack" ? rot(one(dk(m)), 10) + rot(one(P.paper), -2) : "") + rot(one(m) + S(star(49.5, 32, 5, 2.2, 5, -90), P.white, { a: .8, b: 0, sw: 1.8 }), v === "stack" ? -14 : -10);
  };

const _suit = (m, v, o) => {
    o = o || {};
    const body = v === "skin"
      ? "M25 6L32 9L39 6L48 9C52 14 54 24 55 34L49 35.5L47 28V42L48 61H36L32 46L28 61H16L17 42V28L15 35.5L9 34C10 24 12 14 16 9Z"
      : "M24 6L32 10L40 6L50 9C54 14 56 25 57 35L50 37L48 28V41L50 60H36.5L32 45L27.5 60H14L16 41V28L14 37L7 35C8 25 10 14 14 9Z";
    let inner = (o.pat ? PAT[o.pat](m, o) : "") + L("M16 28L17 19M48 28L47 19", INK, 1.4, .35);
    if (v === "skin") inner += fill("M17 30L47 22V27L17 35Z", (tone(o.pc) || P.white).b);
    if (v === "dry") inner += fill("M0 50H64V54H0Z M5 33L12 35L12.6 32L5.6 30Z M59 33L52 35L51.4 32L58.4 30Z", "#e6ecf5");
    if (v === "foil") inner += PAT.crinkle(m);
    let out = "";
    if (v === "dino" && !o.hood) out += [[23, 6], [28, 2], [34, 1.5], [40, 4.5]].map(([x, y]) => S(`M${x - 3} ${y + 5}L${x} ${y - 2}L${x + 3.4} ${y + 5}Z`, tone(o.spike) || T.lime, { a: .8, b: 0, sw: 2 })).join("");
    if (v === "dino" || v === "hazmat" || v === "foil") out += S("M19 17C16.5 7 22.5 2 32 2C41.5 2 47.5 7 45 17C41 13 23 13 19 17Z", v === "dino" ? m : dk(m), { a: [2, 1.5], b: 1.4, inner: v === "foil" ? PAT.crinkle(m) : "" });
    out += S(body, m, { a: [4, 2], ink: o.ink, inner });
    if (v === "dino") out += F("M24 15C24 9.5 27 6.5 32 6.5C37 6.5 40 9.5 40 15C37 17.4 27 17.4 24 15Z", P.dark.s) + F("M24.6 13.6L26 16L27.4 14L28.8 16.4L30.2 14.4L31.6 16.6L33 14.4L34.4 16.4L35.8 14L37.2 16L38.6 13.6", "#fff", 1.2) + F(C(26, 6.6, 1.8), "#fff", 1.2) + F(C(38, 6.6, 1.8), "#fff", 1.2) + `<circle cx="26.4" cy="6.6" r=".9" fill="${INK}"/><circle cx="38.4" cy="6.6" r=".9" fill="${INK}"/>`;
    if (v === "hazmat" || v === "foil") out += S(R(24.5, 6, 15, 9.5, 3.5), P.glass, { a: [0, 1.2], b: 0, sw: 2.2 }) + Gl(27.5, 8.5, 1.2, 2.4, 30, .9);
    if (v === "space") out += S(C(32, 9, 8.5), P.glass, { a: 2, b: 1.4, sw: 2.4 }) + Gl(28.5, 6, 1.6, 3, 35, .9) + S(R(23, 14, 18, 4, 2), P.metal, { a: [0, 1.2], b: 0, sw: 2 }) + S(R(26, 22, 12, 9, 2), P.metal, { a: 1, b: .6, sw: 2, inner: dots([[29, 25], [32, 25], [35, 25]], .9, T.red.b, .6) + fill(R(28, 27, 8, 2, 1), T.cyan.b) });
    if (v === "dry") out += S("M22 6C22 18 26 24 32 24C38 24 42 18 42 6L46 8C47 22 41 30 32 30C23 30 17 22 18 8Z", T.yellow, { a: [0, 1.6], b: 0, sw: 2.2 }) + F(R(30, 30, 4, 10, 1.5), T.yellow.s, 1.6);
    if (v !== "space" && v !== "dry") out += L("M32 12V40", INK, 1.8, .5) + F(R(30.6, 14, 2.8, 4.4, 1), P.metal.b, 1.2);
    if (o.gloves) out += F("M7 35L14 37L13 41L6.4 39Z", tone(o.gloves).b, 1.6) + F("M57 35L50 37L51 41L57.6 39Z", tone(o.gloves).b, 1.6) + F(R(14, 56, 14, 5, 1.5), tone(o.gloves).b, 1.6) + F(R(36, 56, 14, 5, 1.5), tone(o.gloves).b, 1.6);
    if (o.emb) out += emb(o.emb, +o.ex || 40, +o.ey || 22, +o.es || 1);
    if (v === "skin") out += L("M2 24H9M1 30H7M3 36H8", "#fff", 2.2, .85);
    return out;
  };

OV.web = (x, y) => L(`M${x - 10} ${y - 10}L${x + 6} ${y + 6}M${x - 10} ${y + 2}L${x + 6} ${y - 4}M${x - 3} ${y - 10}V${y + 8}M${x - 8} ${y - 4}Q${x - 3} ${y - 2} ${x + 2} ${y - 6}M${x - 7} ${y + 2}Q${x - 2} ${y} ${x + 4} ${y + 2}`, "#6d7a95", 1.2, .9);

const _sign = (m, v) => {
    const post = S(R(29, 34, 6, 28, 3), P.white, { a: [2, 0], b: 0, inner: fill("M29 41L35 37V42L29 46Z M29 51L35 47V52L29 56Z", INK, .85) });
    let face;
    if (v === "swirl") face = L("M32 22a2 2 0 0 1 4 0a4 4 0 0 1 -8 0a6 6 0 0 1 12 0a8 8 0 0 1 -16 0a10 10 0 0 1 20 0a12 12 0 0 1 -24 0a14 14 0 0 1 28 0", m.b, 4.2);
    else if (v === "clock") face = `<circle cx="32" cy="22" r="15.5" fill="none" stroke="${m.b}" stroke-width="5"/>` + [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<path transform="rotate(${a} 32 22)" d="M32 10V12.6" stroke="${INK}" stroke-width="1.6"/>`).join("") + L("M32 22V13.6M32 22L38 25", INK, 2.4) + `<circle cx="32" cy="22" r="1.6" fill="${INK}"/>`;
    else face = `<circle cx="32" cy="22" r="15.5" fill="none" stroke="${m.b}" stroke-width="5.5"/>` + Tx(32, 25.6, "STOP", 9.6, INK) + Tx(32, 31, "CHILDREN", 3.6, INK);
    let out = (v === "moon" ? S("M0 54C10 48 24 50 32 52C42 54 54 48 64 52V64H0Z", T.stone, { a: 0, b: [0, 1.4], inner: F(E(14, 58, 4, 1.6), T.stone.s, 1.2) + F(E(48, 59, 5, 1.8), T.stone.s, 1.2) }) : "") +
      post + S(C(32, 22, 18.5), P.white, { a: 3, b: 2.2, inner: face + (v === "tank" ? [14, 20, 26, 32, 38, 44, 50].map((x, i) => fill(R(x - 1.6, 34 - i * 3.4, 3.2, 5.4, .6), INK, .5)).join("") : "") }) + Gl(22, 12, 4, 1.8, -35, .8);
    if (v === "rivets") out += [0, 45, 90, 135, 180, 225, 270, 315].map((a) => F(C(32 + Math.cos(a * Math.PI / 180) * 17, 22 + Math.sin(a * Math.PI / 180) * 17, 1.3), P.metal.b, 1.1)).join("") + S(R(27.5, 38, 9, 12, 1.5), P.metal, { a: [1, 0], b: 0, sw: 2 }) + dots([[30, 40.5], [34, 40.5], [30, 47.5], [34, 47.5]], .9, P.metal.h, .8);
    if (v === "tank") out += L("M48 8C50 10 51 12 50 15", INK, 2, .5) + L("M12 36L16 40", INK, 2, .5);
    if (v === "moon") out += Sp(8, 8, 3.4) + Sp(56, 40, 2.6) + S(C(54, 9, 5), T.cyan, { a: 1, b: .6, sw: 2, inner: fill("M50 7C52 6 54 8 53 10Z", T.green.b) });
    return out;
  };
EMB.shh = () => F("M-9 -6H9V4H2L-2 8V4H-9Z", "#fff", 1.6) + Tx(0, 2.2, "SHH", 6, INK);

// A furry outline: an ellipse whose edge is broken into soft tufts.
const fuzz = (cx, cy, rx, ry, n, d) => {
  let s = "";
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (!i) { s = `M${f(x)} ${f(y)}`; continue; }
    const m = (i - .5) / n * Math.PI * 2, qx = cx + Math.cos(m) * (rx + d), qy = cy + Math.sin(m) * (ry + d);
    s += `Q${f(qx)} ${f(qy)} ${f(x)} ${f(y)}`;
  }
  return s + "Z";
};

/* ------------------------------------------------------------------ */
/* Season gear (s2 onwards, added at runtime by game.js)                 */
/* Every season issues a Walking Pole, a Trail Jacket and a Route Map;   */
/* the season's name picks an emblem (tag, patch, map pin) and a colour. */
/* ------------------------------------------------------------------ */
const ring2 = (cx, cy, r, col, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="${w + 2.4}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
const street = (extra) => L("M0 7.5V-2", INK, 3.6) + L("M0 7.5V-2", P.dmetal.b, 1.6) + F("M-4.2 -2H4.2L2.6 -7H-2.6Z", "#fff3a0", 1.3) + F(R(-5, -3, 10, 1.8, .8), P.dmetal.b, 1.1) + (extra || "");
Object.assign(EMB, {
  rung: () => TL("M-4 -3.5H4M-4 .5H4M-4 4.5H4", P.wood.h, 1.6) + TL("M-4 -7.5V7.5M4 -7.5V7.5", P.wood.b, 2),
  drop: () => F(drop(0, -1.2, 1.55), T.cyan.b, 1.5) + Gl(-1.8, 1.4, .9, 1.8, 20, .9),
  mushroom: () => F("M-2.6 0H2.6L3 6.5Q0 7.8 -3 6.5Z", "#f3e3c3", 1.4) + F("M-7.5 .5C-7.5 -5 -3.6 -7.5 0 -7.5C3.6 -7.5 7.5 -5 7.5 .5Z", T.red.b, 1.5) + fill(C(-3.6, -2.6, 1.2) + C(1, -5, 1.1) + C(3.9, -1.6, 1), "#fff"),
  anchor: () => ring2(0, -5.6, 1.9, P.dmetal.b, 1.4) + TL("M0 -3.6V6.5M-6 2.5C-5 7.2 5 7.2 6 2.5M-3.4 -1.4H3.4", P.dmetal.b, 1.7),
  tide: () => F("M-7.5 4.2Q-5 2.7 -2.5 4.2T2.5 4.2T7.5 4.2V7.5H-7.5Z", T.cyan.b, 1.3) + F(R(-2, -7.5, 4, 13, .8), "#fff", 1.3) + L("M-2 -4.5H.6M-2 -1.5H.6M-2 1.5H.6", T.red.b, 1.1),
  copy: () => F(R(-6.5, -7, 9, 11.5, 1), "#fff", 1.4) + F(R(-2.5, -4.5, 9, 11.5, 1), "#fff", 1.4) + L("M-.5 -1.5H4.5M-.5 1H3", INK, 1, .5) + L("M0 3.6L4.4 7M4.4 3.6L0 7", T.red.b, 1.6),
  nugget: () => F("M-6 2C-7 -2 -4 -6 0 -6C4 -6 7 -3 6.5 1C6 5 2 6.5 -1 6C-4 5.5 -5.5 4.5 -6 2Z", P.gold.b, 1.5) + L("M-4 -1C-3 -3.6 -1 -4.4 1 -4.2", P.gold.h, 1.4) + fill(C(2.4, 2, 1) + C(-2, 3, .8), P.gold.s) + Sp(5, -6, 2.6),
  ark: () => F("M-4.4 1V-3L0 -6.4L4.4 -3V1Z", T.tan.b, 1.3) + F("M-7.5 1H7.5L5 6.5H-5Z", P.wood.b, 1.4) + fill(C(-1.8, -2, .9) + C(1.8, -2, .9), INK),
  whirl: () => L("M0 0a1.4 1.4 0 0 1 2.8 0a2.8 2.8 0 0 1 -5.6 0a4.2 4.2 0 0 1 8.4 0a5.6 5.6 0 0 1 -11.2 0", INK, 3.6) + L("M0 0a1.4 1.4 0 0 1 2.8 0a2.8 2.8 0 0 1 -5.6 0a4.2 4.2 0 0 1 8.4 0a5.6 5.6 0 0 1 -11.2 0", T.blue.b, 1.6),
  lanternout: () => L("M0 -4.4C-2 -6 2 -7 0 -8.6", "#9aa3b8", 1.4) + F(R(-4, -2, 8, 8, 1.2), "#3a4160", 1.3) + F(R(-5, -3.6, 10, 2.2, 1), P.dmetal.b, 1.1) + F(R(-5, 5.4, 10, 2.2, 1), P.dmetal.b, 1.1) + L("M-1.6 -.4V4", "#5f6b98", 1),
  lights: () => L("M-8 -5Q0 1 8 -5", INK, 1.2) + [[-5.5, -2.6, T.red.b], [-1.8, -1.2, T.yellow.b], [1.8, -1.2, T.green.b], [5.5, -2.6, T.cyan.b]].map(([x, y, c]) => F(E(x, y + 3, 1.7, 2.4), c, 1.1)).join(""),
  office: () => L("M-2.5 -3V-5.6H2.5V-3", INK, 1.6) + F(R(-7.5, -3, 15, 10, 1.8), T.brown.b, 1.4) + L("M-7.5 1H7.5", INK, 1, .5) + F(R(-1.3, -.2, 2.6, 2.4, .4), P.gold.b, 1),
  iou: () => F(R(-7.5, -4.5, 15, 9, 1), "#fff", 1.4) + Tx(0, 2.1, "IOU", 5.4, T.red.s),
  horns: () => TL("M-2 5C-5.4 3 -7.4 -2 -5.4 -7.5M2 5C5.4 3 7.4 -2 5.4 -7.5", "#eadcb8", 2.4) + L("M-6.6 -1.6L-4.6 -2.4M-6.8 1.4L-4.4 .4M6.6 -1.6L4.6 -2.4M6.8 1.4L4.4 .4", "#a8906a", .9),
  boot: () => F("M-4 -7.5H3V2C3 3 4 3.5 6 4C7.6 4.6 7.6 7.5 6 7.5H-4Z", T.green.b, 1.5) + L("M-4 -4.5H3", INK, 1, .5) + fill(R(-4, 6, 11.4, 1.5, 0), INK, .55),
  sleep: () => F(crescent(-1.4, 1, 6.2), T.yellow.b, 1.4) + Tx(5, -2.4, "z", 6.4, "#4a5479"),
  updown: () => F("M-3 -7.5H3V0H6.5L0 7.5L-6.5 0H-3Z", T.red.b, 1.4) + Tx(0, -1.8, "UP", 4.2, "#fff"),
  notes: () => fill(E(-4.6, 4.6, 2.6, 1.9) + E(3.6, 3.1, 2.6, 1.9), INK) + L("M-2.2 4.2V-5.4M6 2.8V-6.8", INK, 1.5) + L("M-2.2 -5.4L6 -6.8", INK, 2.6),
  swap: () => L("M-2 -8.4V-7M-8.4 -1.5H-7M-6.6 -6.1L-5.6 -5.1M2.6 -6.1L1.6 -5.1", T.orange.b, 1.4) + F(C(-2, -1.5, 4.4), T.yellow.b, 1.4) + F(cloudD(2.4, 2.6, .44), "#fff", 1.3),
  hourgone: () => F(C(0, 0, 7), "#fff", 1.5) + fill("M0 0L0 -5.6A5.6 5.6 0 0 1 4.85 -2.8Z", "#22346a") + L("M0 0L-3.4 1.8M0 0L-1.6 -4", INK, 1.4),
  fish: () => F("M4.5 0L8 -4.2V4.2Z", T.blue.b, 1.4) + F("M-7.5 0C-4.5 -5 3 -5 5.2 0C3 5 -4.5 5 -7.5 0Z", T.blue.b, 1.4) + fill(C(-3.8, -1, 1), INK) + L("M-1 -3C0 -1 0 1 -1 3", T.blue.h, 1),
  lamp2: () => street(Tx(5, 7, "2", 6.4, T.red.s)),
  lampLast: () => L("M-7 -6.4L-5 -5.4M7 -6.4L5 -5.4M0 -9.6V-8.4", T.orange.b, 1.4) + street(),
  underlamp: () => fill("M-2.6 -2H2.6L7.5 7.5H-7.5Z", "#fff3a0", .7) + street(),
  sign: () => L("M-1 7.5V-6.5", INK, 3.6) + L("M-1 7.5V-6.5", P.wood.b, 1.6) + F("M-6.5 -6.6H4L7.5 -4.4L4 -2.2H-6.5Z", P.wood.h, 1.3) + F("M-6.5 -.6H3.5V3.8H-6.5L-8 1.6Z", P.wood.h, 1.3),
  ticks: () => F(R(-6, -7.5, 12, 15, 1.2), "#fff", 1.4) + L("M-3.6 -3.6L-2.4 -2.4L-.4 -4.9M-3.6 .9L-2.4 2.1L-.4 -.4M-3.6 5.3L-2.4 6.5L-.4 4", T.green.s, 1.3) + L("M1.6 -3.6H4M1.6 .9H4M1.6 5.3H4", INK, 1.1, .5),
  nobody: () => `<g fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="1.6 1.3"><circle cx="0" cy="-4.2" r="2.8"/><path d="M-6 7.5C-6 1.5 -3 -.4 0 -.4C3 -.4 6 1.5 6 7.5"/></g>`,
  sofa: () => F("M-6.5 -1.6C-6.5 -6.4 6.5 -6.4 6.5 -1.6V2H-6.5Z", T.rose.b, 1.4) + F(R(-6, .2, 12, 4, 1), T.rose.h, 1.3) + F(R(-8.4, -1.4, 3, 6.6, 1.2), T.rose.s, 1.2) + F(R(5.4, -1.4, 3, 6.6, 1.2), T.rose.s, 1.2) + L("M-6 5.4V7.4M6 5.4V7.4", INK, 1.4),
  glass: () => F(R(-6.5, -7.5, 13, 15, 1), P.glass.b, 1.4) + L("M-1 -7.5L.5 -2L-3 1L-1 7.5M.5 -2L6.5 -.6M-3 1L-6.5 2.4", INK, 1, .7) + L("M-4.4 -5L-2.4 -6", "#fff", 1.2),
  stitch: () => L("M-7.5 6.5H7.5", INK, 1.3, .8, ' stroke-dasharray="2.2 1.4"') + L("M-5 4C-2 -1 1 3 4.5 -3.5", T.red.b, 1.5) + G("rotate(40)", F(R(-1, -8, 2, 13, 1), P.metal.b, 1.1) + fill(E(0, -5.6, .45, 1.2), INK)),
  hand: () => F("M-4.6 7.5V1L-6.6 -2.6C-7.2 -3.8 -5.8 -4.8 -4.9 -3.8L-3.6 -2.3V-6.4C-3.6 -7.7 -1.8 -7.7 -1.8 -6.4V-7.5C-1.8 -8.8 0 -8.8 0 -7.5V-7C0 -8.3 1.8 -8.3 1.8 -7V-5.8C1.8 -7 3.6 -7 3.6 -5.8V2.4C3.6 5 2.4 7.5 0 7.5Z", P.skin.b, 1.3) + L("M-1.8 -6.4V-1.6M0 -7.2V-1.6M1.8 -6.4V-1.6", P.skin.s, .9),
  ballot: () => G("rotate(-10)", F(R(-3.6, -8.6, 7, 8.4, .6), "#fff", 1.2) + L("M-1.6 -6.4L1.6 -3.2M1.6 -6.4L-1.6 -3.2", T.red.b, 1.3)) + F(R(-7, -1, 14, 8.6, 1.2), T.navy.b, 1.4) + L("M-4 1.4H4", INK, 1.6) + fill(R(-3, 3.6, 6, 2, .5), "#fff", .8),
  flake: () => TL("M0 -7V7M-6 -3.5L6 3.5M-6 3.5L6 -3.5", "#dff4ff", 1.4) + L("M-1.6 -5.4L0 -4L1.6 -5.4M-1.6 5.4L0 4L1.6 5.4", "#dff4ff", 1.1),
});
const SEASON_THEMES = [
  ["first rung", "rung", "tan"], ["rising damp", "drop", "teal"], ["spore", "mushroom", "red"], ["long hush", "shush", "purple"],
  ["moorings", "anchor", "navy"], ["low water", "tide", "sky"], ["copy err", "copy", "slate"], ["gold rush", "nugget", "gold"],
  ["two by two", "ark", "brown"], ["undertow", "whirl", "blue"], ["lanterns out", "lanternout", "coal"], ["halfway rung", "rung", "orange"],
  ["hundred lights", "lights", "yellow"], ["head office", "office", "steel"], ["old debts", "iou", "olive"], ["krampus", "horns", "maroon"],
  ["boot fair", "boot", "green"], ["sleepers", "sleep", "void"], ["wrong way", "updown", "pink"], ["chorus", "notes", "plum"],
  ["weather swap", "swap", "lime"], ["missing hour", "hourgone", "mustard"], ["deep water", "fish", "cyan"], ["second lamp", "lamp2", "copper"],
  ["kit's way", "sign", "khaki"], ["register", "ticks", "rose"], ["nobody left", "nobody", "stone"], ["long sofa", "sofa", "camel"],
  ["glass floor", "glass", "ice"], ["stitch", "stitch", "tweed"], ["under the lamp", "underlamp", "bronze"], ["all hands", "hand", "grass"],
  ["stillness", "flake", "white"], ["last rungs", "rung", "rust"], ["the vote", "ballot", "black"], ["last lamp", "lampLast", "gold"],
  ["frozen|frost|ice|snow", "flake", "ice"], ["lamp|lantern|light", "underlamp", "yellow"], ["water|sea|tide|shore", "fish", "teal"], ["ladder", "rung", "tan"],
];
// A luggage tag, map pin or chest patch carrying a season emblem.
const tag = (x, y, e) => G(`rotate(-14 ${x} ${y})`, S(`M${x - 9} ${y - 5}L${x - 5} ${y - 9}H${x + 9}V${y + 9}H${x - 9}Z`, P.paper, { a: 1.6, b: 0, sw: 2 }) + F(C(x - 5.4, y - 5.4, 1.4), P.metal.b, 1.1)) + emb(e, x + 1.2, y + 1.2, .78);
const pin = (x, y, e) => S(`M${x} ${y + 15}C${x - 3} ${y + 10} ${x - 10} ${y + 6} ${x - 10} ${y}A10 10 0 1 1 ${x + 10} ${y}C${x + 10} ${y + 6} ${x + 3} ${y + 10} ${x} ${y + 15}Z`, T.red, { a: 2, b: 1.4 }) + F(C(x, y, 7.4), "#fff", 1.8) + emb(e, x, y, .82);
const patch = (x, y, e, q) => S(C(x, y, 7.2), q || P.white, { a: 1, b: 0, sw: 1.8 }) + `<circle cx="${x}" cy="${y}" r="5.6" fill="none" stroke="${INK}" stroke-width=".9" stroke-dasharray="1.2 1.2" opacity=".5"/>` + emb(e, x, y, .66);

Object.assign(M, {
  // Trekking pole: wrist strap, grip, coloured upper section, flick-lock, alloy lower section, basket, carbide tip. v = 0 cork, 1 foam + snow basket, 2 derby handle.
  tpole: (m, v, o) => {
    v = +v || 0;
    const grip = v === 1 ? P.rubber : pal("#c9945a", "#956232", "#ecc08a");
    const top = v === 2
      ? TL("M27 9C20 9 19 21 28 19", m.b, 3) + S("M18 6C18 2 22 1 32 2C42 1 46 3 46 7C46 10 42 10 38 10V22H26V10C21 10 18 9 18 6Z", P.dwood, { a: [2, 2], b: 1.4, inner: L("M22 5H42", P.dwood.h, 1.4, .6) })
      : TL("M27 6C18 7 17 21 27.5 18", m.b, 3) + S(R(25.5, 2, 13, 20, 5), grip, { a: [2, 0], b: [1.4, 0], inner: L("M24 8H40M24 11.5H40M24 15H40", grip.s, 1.4, .8) + (v === 1 ? fill(R(24, 0, 16, 5, 0), m.b) : "") });
    const basket = v === 1
      ? S(E(32, 52, 10.5, 3.4), P.rubber, { a: [0, 1.2], b: 0, inner: L("M23 52H41", "#8c99c8", 1, .6) }) + F(E(32, 51.4, 3, 1), "#55607f", 1.2)
      : S(E(32, 52, 7, 2.4), P.dark, { a: 0, b: 0, sw: 2 });
    return diag(
      S(R(29.2, 38, 5.6, 16, 1.6), P.metal, { a: [1.6, 0], b: [1, 0], hw: 1.2 }) +
      S(R(28.4, 21, 7.2, 18, 2), m, { a: [2, 0], b: [1.2, 0], inner: fill(R(28, 30, 8, 2.4, 0), "#fff", .85) }) +
      S(R(27.2, 20, 9.6, 3.4, 1.2), P.dark, { a: 0, b: 0, sw: 2 }) +
      S(R(27, 36, 10, 4.6, 1.5), P.dark, { a: 0, b: 0, sw: 2 }) + S("M37 35.4L42 37.6V39.4L37 40.4Z", m, { a: 0, b: 0, sw: 1.8 }) +
      top + basket + S("M30 54H34L33.2 59.5L32 63L30.8 59.5Z", P.dmetal, { a: 0, b: 0, sw: 1.8 }), 40) +
    L("M30 37C36 40 40 42 44 44", INK, 1.6) + tag(49, 48, o.emb || "rung");
  },

  // Trail jacket: hooded shell with a colour block (v: 0 yoke, 1 chest band, 2 two-tone hem) and the season patch on the chest.
  trailjacket: (m, v, o) => {
    v = +v || 0;
    const b = tone(o.block) || dk(m);
    const blk = v === 1 ? "M0 28L64 20V27L0 35Z" : v === 2 ? "M0 41H64V64H0Z" : "M0 0H64V20C50 23 14 23 0 20Z";
    return garment(m, "shell", { pk: "slant", ins: fill(blk, b.b) + fill(v === 1 ? "M0 35L64 27V28.4L0 36.4Z" : "M0 0H0Z", "#fff", .8), add: patch(41, 27, o.emb || "rung") });
  },

  // Route map: three folded panels, contours, a dashed route and a big pin carrying the season emblem.
  routemap: (m, v, o) => {
    v = +v || 0;
    const st = [[11, 50], [12, 46], [10, 42]][v % 3], route = `M${st[0]} ${st[1]}` + ["C17 44 24 47 28 38C32 30 38 30 42 26", "C20 50 24 40 30 42C36 44 38 32 42 28", "C16 38 20 46 27 44C34 42 33 30 42 27"][v % 3];
    return S("M5 16L22 11V53L5 58Z", P.paper, { a: [0, 2], b: [1.4, 1.4], inner: fill("M0 0H64V22L5 22Z", m.b) + fill("M5 21.5L22 16.5V18L5 23Z", "#fff", .9) }) +
      S("M22 11L41 16V58L22 53Z", dk(P.paper), { a: [0, 2], b: 0, inner: L(E(31, 40, 6, 4) + E(31, 40, 2.8, 1.8), T.brown.b, 1.2, .7) }) +
      S("M41 16L59 11V53L41 58Z", P.paper, { a: [0, 2], b: [1.4, 1.4], inner: L(E(51, 42, 6, 4.4) + E(51, 42, 3, 2), T.brown.b, 1.2, .7) + fill(E(50, 26, 5, 3), T.cyan.b, .8) }) +
      L("M5 36C10 33 15 38 22 34C28 31 34 35 41 33C47 31 53 34 59 31", T.cyan.b, 2.2, .85) +
      F(E(13, 30, 3.4, 2.4), T.green.b, 1.4, .95) +
      `<path d="${route}" fill="none" stroke="#ff4d5e" stroke-width="2.4" stroke-dasharray="3 3" stroke-linecap="round"/>` +
      F(C(st[0], st[1], 2.2), "#fff", 1.6) + pin(46, 14, o.emb || "rung");
  },

  // --- named season pieces ---
  icicle: (m) => lay(
    S("M32 -6C36 8 41 26 43 40C43.6 45 41 47.6 37 47.6L35 52L32.6 48L30.2 52L28 47.6C23 47.6 20.4 45 21 40C23 26 28 8 32 -6Z", T.ice, { a: [3.6, 0], b: [2, 0], inner: L("M29.6 6C28 20 26.6 32 26.4 42", "#fff", 2.2, .9) + L("M35.4 14C37 24 38.4 34 38.6 42", T.ice.s, 1.6, .7) }) +
    S(R(26, 48, 12, 19, 3.6), T.brown, { a: [2.6, 0], b: [1.4, 0], inner: L("M25 52L39 55M25 56.6L39 59.6M25 61.2L39 64.2", T.brown.s, 1.8) }) + bands([47], 12, 3.6, P.metal) +
    G("rotate(-80 44 26)", S(R(34, 18, 20, 15, 1.4), P.paper, { a: [0, 1.6], b: 0, sw: 2, inner: Tx(40.4, 29, "£", 10, T.red.s) + L("M46 23H51M46 27H51", INK, 1.2, .5) }) + F(C(37, 21.4, 1.4), P.metal.b, 1.1))) + Sp(54, 50, 3.4) + Sp(10, 12, 2.6),

  snowcoat: (m) => garment(m, "parka", { pat: "quilt", pk: "flap", add:
    F("M6 16C9 9 16 9 23 6.5L24 10C19 13 13 14 9 19Z", "#fff", 2) + F("M58 16C55 9 48 9 41 6.5L40 10C45 13 51 14 55 19Z", "#fff", 2) +
    F("M17 58L19 62L21 58Z M30 60L32 63.6L34 60Z M43 58L45 62L47 58Z", "#e8f8ff", 1.4) + at(52, 50, .8, EMB.flake()) }),

  thermos: (m) =>
    OV.steam() + TL("M45 26C53 26 53 44 45 44", P.dark.b, 3) +
    S(R(19, 22, 26, 38, 5), m, { a: [4, 1.4], b: [1.6, 1.2], inner: L("M22 28C21.4 38 21.4 48 22 56", m.h, 2, .7) + fill(R(19, 34, 26, 14, 0), P.white.b) + fill(R(19, 34, 26, 2, 0), m.s, .6) }) +
    emb("flake", 32, 41, .85) +
    S(R(18, 18, 28, 6, 2), P.dark, { a: [0, 1.4], b: 0, sw: 2.2 }) +
    S("M19 9H45L44 19H20Z", P.metal, { a: [3, 0], b: [1.4, 0], inner: L("M19 12H45", P.metal.s, 1.2, .7) }) + S(E(32, 9, 13, 3), P.metal, { a: 0, b: 0, sw: 2.2, inner: fill(E(32, 9.6, 10.4, 2), "#9fd9c8") }),

  lanternpole: (m) =>
    rod("M10 62L44 9C46 6 51 6 52 10C53 13 51 16 48 16", P.dwood, 5.2) +
    L("M48 16V22", INK, 1.8) + glow(45, 36, 17, "#7fffe0", .55) +
    S(R(40, 22, 10, 3.2, 1.4), P.dmetal, { a: 0, b: 0, sw: 1.8 }) +
    S("M38 25H52L50 45H40Z", pal("#2a3a55", "#1a2438", "#4a6080"), { a: 0, b: 0, sw: 2.4, inner: fill("M40.4 27H49.6L48.4 43H41.6Z", "#c9fff2") + S(drop(45, 37, 1.25), pal("#5fffd2", "#20c9a8", "#ffffff"), { a: .8, b: 0, sw: 1.4, inner: F(E(43.6, 38, .7, 1), INK, .1) + F(E(46.4, 38, .7, 1), INK, .1) }) + L("M45 27V43", INK, 1.2, .5) }) +
    S(R(37, 44, 16, 4, 1.6), P.dmetal, { a: 0, b: 0, sw: 1.8 }) + Sp(56, 30, 3) + Sp(30, 30, 2.2),

  oilskin: (m) => garment(m, "coat", { close: "studs", collar: "cord", pk: "flap", pat2: "drops", add:
    G("rotate(-8 25 44)", F(R(18, 37, 13, 13, 0), "#ff2bd6", 2) + fill("M18 37h3.25v3.25h-3.25Z M24.5 37h3.25v3.25h-3.25Z M21.25 40.25h3.25v3.25h-3.25Z M27.75 40.25h3.25v3.25h-3.25Z M18 43.5h3.25v3.25h-3.25Z M24.5 43.5h3.25v3.25h-3.25Z M21.25 46.75h3.25v3.25h-3.25Z M27.75 46.75h3.25v3.25h-3.25Z", "#120a20")) }),

  handbell: (m) => rot(
    S(R(28.5, 2, 7, 18, 3.4), P.dwood, { a: [2, 0], b: [1.2, 0] }) + S(R(26, 18, 12, 4, 1.6), P.gold, { a: 0, b: 0, sw: 2 }) +
    S(C(32, 57, 4), P.dmetal, { a: 1, b: 0, sw: 2 }) +
    S("M32 21C24 21 21 28 21 36C21 44 17 48 12 51H52C47 48 43 44 43 36C43 28 40 21 32 21Z", P.gold, { a: [4, 2], b: 2.4, inner: L("M18 44H46", P.gold.s, 2, .6) }) +
    S(R(10, 49.5, 44, 6, 3), dk(P.gold), { a: [0, 1.6], b: 0 }) + Gl(26, 31, 2, 5, 14, .8), -18) +
    L("M51 18C55 22 55 30 52 34M56 13C61 20 61 32 57 38", INK, 2.4) + L("M8 30C5 34 5 40 8 44", INK, 2.2, .6),

  rung: (m) => diag(
    S("M14 4H50L48 8L51 11L47 13H17L13 11L16 8Z", P.wood, { a: [0, 2.4], b: [0, 1.4], inner: L("M18 7H44M20 10H40", P.wood.s, 1.2, .6) }) +
    S("M14 52H50L47 55L51 57L48 61H16L13 58L17 55Z", P.wood, { a: [0, 2.4], b: [0, 1.4], inner: L("M18 56H44", P.wood.s, 1.2, .6) }) +
    S(R(26.5, 12, 11, 41, 5), P.wood, { a: [3, 0], b: [1.6, 0], inner: L("M30 16C29.4 26 30.6 36 30 50M35 20V30", P.wood.s, 1.3, .7) + fill(R(26, 26, 12, 13, 0), "#fff", .9) + Tx(32, 36.4, "40", 8, T.red.s) }), 45),

  upholstery: (m) => {
    const d = "M7 9H57V44L52 47L55 51L49 53L50 58L43 56L40 60L35 56L30 59L27 55H7Z";
    let tufts = "", btn = "";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const x = 13 + c * 12.6 + (r % 2) * 6.3, y = 16 + r * 11; if (x < 56) btn += `<circle cx="${f(x)}" cy="${y}" r="2" fill="${m.s}" stroke="${INK}" stroke-width="1.2"/>`; }
    for (let k = -4; k < 8; k++) tufts += `M${k * 12.6} 5L${k * 12.6 + 56} 61M${k * 12.6 + 56} 5L${k * 12.6} 61`;
    return S(d, m, { a: [3, 3], b: 2, inner: L(tufts, m.s, 1.4, .75) + L(tufts, m.h, .8, .4, ' transform="translate(-1 -1)"') + btn +
      fill("M40 22H57V27H44Z M46 33H57V36H48Z", "#3cf2ff", .85) + fill("M38 27H57V30H41Z", "#ff3cc8", .85) + fill(R(48, 40, 4, 4, 0), "#3cf2ff") + fill(R(52, 14, 3, 3, 0), "#ff3cc8") }) +
      [12, 20, 28, 36, 44, 52].map((x) => F(C(x, 9, 1.8), P.gold.b, 1.2)).join("") + F(R(58, 30, 4, 4, 0), "#3cf2ff", 1.2) + F(R(59, 20, 3, 3, 0), "#ff3cc8", 1);
  },

  slotcoin: (m) =>
    S(R(5, 38, 54, 22, 4), P.dmetal, { a: [0, 2.4], b: [0, 1.4], inner: dots([[10, 54], [54, 54]], 1.4, P.metal.b, 1) }) +
    S(R(12, 40, 40, 6, 3), pal("#151a2e", "#0b1024", "#2a3150"), { a: 0, b: 0, sw: 2 }) + glow(32, 42, 12, "#ffd25a", .5) +
    S(C(32, 24, 19), P.gold, { a: 3, b: 2.2, inner: `<circle cx="32" cy="24" r="14.6" fill="none" stroke="${P.gold.s}" stroke-width="1.6"/>` + fill(R(29.8, 13.6, 4.4, 7.4, .8) + R(21.4, 26, 7.4, 4.4, .8) + R(35.2, 26, 7.4, 4.4, .8), INK) }) +
    S("M5 43H59V56Q59 60 55 60H9Q5 60 5 56Z", P.dmetal, { a: [0, 2], b: [0, 1.2], inner: fill(R(5, 43, 54, 2.4, 0), "#0b1024", .8) + dots([[10, 53], [54, 53]], 1.4, P.metal.b, 1) }) +
    Gl(22, 15, 2, 5, 40, .8) + Sp(56, 10, 3.4) + Sp(9, 20, 2.4),
});

// Season items have no row in ITEM_ART: the name picks the object, the season's name picks emblem and colour.
// Any future season piece falls through the same keyword table, so it is never drawn as a generic blade or gem.
const SEASON_OBJECTS = [
  ["thermos|flask|\\btea\\b|cocoa", "thermos", "teal"], ["lantern", "lanternpole", ""], ["bell", "handbell", ""], ["rung|ladder", "rung", ""],
  ["coin|token|penny|socket", "slotcoin", ""], ["icicle|spike|shard", "icicle", ""], ["upholster|cushion|throne|chair", "upholstery", "maroon"],
  ["oilskin|sou.?wester|waterproof", "oilskin", "yellow"], ["snow|shelter|parka|duvet", "snowcoat", "navy"],
  ["map|chart|atlas|guide", "routemap", ""], ["pole|staff|stick|cane|crook|spear|lance", "tpole", ""],
  ["coat|jacket|cloak|mantle|vest|anorak|armour|kit\\b", "trailjacket", ""],
];
const SLOT_SEASON = { weapon: "tpole", armour: "trailjacket", trinket: "routemap" };
function seasonResolve(item) {
  const id = typeof item === "string" ? item : item.id, n = +id.slice(1).split("-")[0] || 0;
  const name = (typeof item === "object" && item.name) || "", slot = (typeof item === "object" && item.slot) || id.split("-")[1];
  const th = SEASON_THEMES.find(([k]) => new RegExp(k, "i").test(name)) || SEASON_THEMES[(n * 7) % 36];
  const ob = /(walking pole|trail jacket|route map)$/i.test(name) ? null : SEASON_OBJECTS.find(([k]) => new RegExp(k, "i").test(name));
  const motif = ob ? ob[1] : SLOT_SEASON[slot] || "routemap";
  return { motif, tint: (ob && ob[2]) || th[2], variant: String(n % 3), o: { emb: th[1], block: n % 2 ? "white" : "" }, ov: [] };
}

/* ------------------------------------------------------------------ */
/* Redraws after the art review: each one keeps the named detail big    */
/* ------------------------------------------------------------------ */
// A gear-toothed ellipse (enigma rotor thumbwheel).
const gearE = (cx, cy, rx, ry, n, d) => {
  const pts = [];
  for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * Math.PI * 2, k = i % 4 < 2 ? 1 : 1 - d; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return poly(pts);
};
// Annular sector, for arch stones and rings. Angles in degrees, 0 = east, clockwise (SVG y-down).
const sector = (cx, cy, r0, r1, a0, a1) => {
  const p = (r, a) => `${f(cx + Math.cos(a * Math.PI / 180) * r)} ${f(cy + Math.sin(a * Math.PI / 180) * r)}`;
  return `M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
};
// Shaded hose: ink, body, ribs, glint.
const hose = (d, q, w) => L(d, INK, w + 3) + L(d, q.b, w) + L(d, q.s, w, .9, ` stroke-dasharray="1.2 2.2" stroke-linecap="butt"`) + L(d, q.h, 1.1, .7, ` transform="translate(-1 -1)"`);
// A chunky outlined chain from (x0,y0) to (x1,y1).
const chainLinks = (x0, y0, x1, y1, n, q) => {
  let s = ""; const dx = (x1 - x0) / n, dy = (y1 - y0) / n, a = Math.atan2(dy, dx) * 180 / Math.PI;
  for (let i = 0; i < n; i++) {
    const x = f(x0 + dx * (i + .5)), y = f(y0 + dy * (i + .5)), rx = f(Math.hypot(dx, dy) * .62);
    s += i % 2 ? G(`rotate(${f(a)} ${x} ${y})`, S(R(x - rx, y - 1.8, rx * 2, 3.6, 1.8), q, { a: 0, b: 0, sw: 2 }))
      : `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="3.6" transform="rotate(${f(a)} ${x} ${y})" fill="none" stroke="${INK}" stroke-width="5.4"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="3.6" transform="rotate(${f(a)} ${x} ${y})" fill="none" stroke="${q.b}" stroke-width="2.4"/>`;
  }
  return s;
};
// Bust for the auras: shoulders, neck, head and hair. h = hair colour.
const bust = (m, h) =>
  S("M9 64C9 52 18 46 32 46C46 46 55 52 55 64Z", m, { a: [3, 2], b: 1.6 }) + S(R(27.5, 38, 9, 10, 3), P.skin, { a: [1.6, 0], b: 0, sw: 2 }) +
  S(C(32, 29, 13.5), P.skin, { a: 2.4, b: 1.6 }) +
  S("M18.6 30C17 18 23 14.6 32 14.6C41 14.6 47 18 45.4 30C44 24 40 21 34 21.6C30 22 26 21 23 19.6C21 22 19.6 25 18.6 30Z", h, { a: [1.6, 1.6], b: 1.2, sw: 2.2 });
const haloRing = (m) => glow(32, 30, 32, m.h, .5) + `<circle cx="32" cy="29" r="22" fill="none" stroke="${m.h}" stroke-width="6" opacity=".35"/><circle cx="32" cy="29" r="22" fill="none" stroke="#fff" stroke-width="1.8" opacity=".9"/>` +
  L([0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return `M${f(32 + c * 25)} ${f(29 + s * 25)}L${f(32 + c * 29)} ${f(29 + s * 29)}`; }).join(""), m.h, 2, .9);

Object.assign(M, {
  // Bag for Life with the tins standing proud of the top.
  sack: (m) => {
    const tin = (x, y, a, q) => G(`rotate(${a} ${x + 7} ${y + 12})`, S(R(x, y + 2, 14, 24, 2), P.metal, { a: [2.6, 0], b: [1.4, 0], inner: fill(R(x, y + 8, 14, 11, 0), q.b) + fill(R(x, y + 8, 14, 2, 0), q.h, .8) + L(`M${x} ${y + 5}H${x + 14}M${x} ${y + 22}H${x + 14}`, P.metal.s, 1.2) }) +
      S(E(x + 7, y + 2.4, 7, 2.4), P.metal, { a: 0, b: 0, sw: 2, inner: fill(E(x + 7, y + 2.6, 5, 1.5), P.metal.s, .6) }) + F(E(x + 9.6, y + 2.2, 2, 1), P.metal.h, 1.1));
    return TL("M17 30C17 13 46 13 46 30", dk(m).b, 3.4) +
      tin(31, 3, 12, T.red) + tin(13, 6, -14, T.yellow) + tin(22, 1, -2, T.blue) +
      S("M48 28L55 31L52 58L46 60Z", dk(m), { a: 1.6, b: 1 }) +
      S("M9 27H49L46 60H12Z", m, { a: [4, 3], inner: L("M9 32H49", m.s, 2, .5) }) +
      S(C(28.5, 45, 7.5), P.white, { a: 1.6, b: 1.2, sw: 2 }) + F("M28.5 49C25 46 24 43.6 25.4 42C26.6 40.8 28 41.4 28.5 42.6C29 41.4 30.4 40.8 31.6 42C33 43.6 32 46 28.5 49Z", m.b, 1.6) +
      TL("M13 29C13 10 41 10 41 29", m.s, 3.4);
  },

  // Spork: a real spoon bowl with three short tines cut into its tip.
  spork: (m) => rot(G("translate(32 32) scale(1.24) translate(-32 -32)",
    S("M28 28H36L36.6 57Q36.6 61.6 32 61.6Q27.4 61.6 27.4 57Z", m, { a: [2.4, 0], b: [1.4, 0], hw: 1.4 }) + `<circle cx="32" cy="56" r="1.8" fill="${INK}"/>` +
    S("M32 33C24 33 20 26 20 18C20 12 21.6 7.4 23.6 4.6H26.4L27.4 9.8H29.8L30.4 3.8H33.6L34.2 9.8H36.6L37.6 4.6H40.4C42.4 7.4 44 12 44 18C44 26 40 33 32 33Z", m, {
      a: 3, b: 2,
      inner: S("M32 30C26.6 30 24 25 24 19C24 15.4 25 12.6 26.4 11H37.6C39 12.6 40 15.4 40 19C40 25 37.4 30 32 30Z", dk(m), { a: [-2.4, -2.4], b: 0, sw: 1.4, norim: 1 }) }) +
    Gl(28, 20, 1.6, 4.4, 0, .85)), 45),

  // Protein flapjack: a lumpy oat slab with a bite out of it, half out of its wrapper.
  bar: (m) => {
    const top = "M8 27C9 24 12 22 14 21.6C16 19 19 20 20 18C22 15.6 26 17 27 15.6L54 15C56 16 57 18 56 20L44 27C40 28.4 34 26.6 30 28C24 29.4 18 27 14 28.6C12 29.4 9 29 8 27Z";
    return S("M44 27L56 20V40L45 50Z", dk(P.oat), { a: 1.4, b: 1, inner: [[50, 30], [48, 40], [52, 36]].map(([x, y]) => F(E(x, y, 1.6, 1), P.oat.b, 1, .8)).join("") }) +
      S("M8 27C12 29.4 18 27 22 28.6C26 30 30 27.6 36 28.4C40 29 42 27.6 44 27L45 50C40 51 36 49.4 30 50.4C24 51.4 18 49.4 12 50.6C10 51 8.4 50 8.4 48Z", P.oat, { a: [0, 3], b: [0, 1.6],
        inner: [[14, 34], [22, 39], [31, 33], [38, 42], [18, 45], [28, 45], [36, 36], [12, 40]].map(([x, y]) => F(E(x, y, 2.1, 1.3), P.oat.s, 1, .75)).join("") + fill("M8 33Q26 36 45 33V36Q26 39 8 36Z", "#c47a1c", .25) }) +
      S(top, P.oat, { a: [0, 1.4], b: 0, sw: 2.2, inner: [[16, 23], [24, 21], [33, 20], [41, 19], [48, 18], [29, 24], [37, 24]].map(([x, y]) => F(E(x, y, 2.2, 1.1), P.oat.h, 1, .9)).join("") }) +
      S("M38 14.8L57 14C59 14 60 16 59 18L57 41L46 51L44 27Z", m, { a: [2, 1], b: 1, inner: fill("M36 22L64 12V18L36 28Z", "#fff", .92) + Tx(52, 22, "PROTEIN", 3.6, m.s, { rot: -22 }) }) +
      F("M57 14L62 9L64 12L60 17Z", m.h, 1.6) + dots([[10, 56], [17, 58], [25, 56]], 1.3, P.oat.b, 1);
  },

  // Cloak laid flat, seen from above: hood, collar, clasp at the neck, folds fanning to the hem.
  cloak: (m, v, o) => {
    o = o || {};
    const edge = o.edge === "tatter" ? "M60 52L56 55L54 51L50 56L47 52L43 57L40 53L36 58L32 54L28 58L24 53L21 57L17 52L14 56L10 51L8 55L4 52"
      : o.edge === "leaf" ? "M60 52Q58 58 53 56Q51 61 46 58Q43 63 38 59Q35 63 32 59Q29 63 26 59Q21 63 18 58Q13 61 11 56Q6 58 4 52"
        : "M60 52Q32 63 4 52";
    const d = "M21 9Q32 15 43 9L47 12C52 24 57 38 60 52" + edge.slice(6) + "C7 38 12 24 17 12Z";
    let inner = L("M26 16L15 54M30 17L26 58M34 17L38 58M38 16L49 54", m.s, 2, .75) + L("M27.5 16L18 52M35.5 16L44 55", m.h, 1.2, .45) + (o.pat ? PAT[o.pat](m, o) : "") + (o.pat2 ? PAT[o.pat2](m, o) : "");
    if (o.hem) inner += L(edge, tone(o.hem).b, 4.4, null, ' transform="translate(0 -2.2)"');
    let out = S("M20.5 11C19 5 25 1.5 32 1.5C39 1.5 45 5 43.5 11Q32 17 20.5 11Z", dk(m), { a: [1.6, 1.6], b: 1.2, inner: fill("M25 10C25 6 28 4 32 4C36 4 39 6 39 10Q32 13.4 25 10Z", INK, .35) });
    out += S(d, m, { a: [4, 2], inner, ink: o.ink });
    if (o.fur) out += [[19, 12], [22.5, 14.6], [26.5, 16], [30.5, 16.6], [34.5, 16.4], [38.5, 15.4], [42.4, 13.6], [45, 11]].map(([x, y]) => F(C(x, y, 3), "#e9dcc4", 1.4)).join("");
    else out += S("M21 9Q32 15 43 9L44.6 12Q32 19 19.4 12Z", dk(m), { a: [0, 1.2], b: 0, sw: 2 });
    out += o.clasp ? F(C(26, 14, 2.4), P.gold.b, 1.4) + F(C(38, 14, 2.4), P.gold.b, 1.4) + L("M26 14Q32 18 38 14", P.gold.b, 1.2) + emb(o.clasp, 32, 17, .82)
      : L("M26 14Q32 18 38 14", INK, 3) + L("M26 14Q32 18 38 14", P.gold.h, 1.2) + S(C(26, 14, 3.2), P.gold, { a: .8, b: .6, sw: 1.8 }) + S(C(38, 14, 3.2), P.gold, { a: .8, b: .6, sw: 1.8 });
    if (o.emb) out += emb(o.emb, +o.ex || 40, +o.ey || 44, +o.es || 1);
    if (o.ghost) out += op(F("M44 62C44 54 47 49 51 49C55 49 58 54 58 62L55.5 60L53 62L50.5 60L48 62L46 60Z", "#e8fbff", 1.8) + fill(C(49.4, 54.6, 1) + C(53.4, 54.6, 1), INK), .85);
    if (o.tag) out += L("M38 16L47 24", INK, 1.2) + G("rotate(16 50 28)", S("M44 24L47 21H56V33H44Z", P.paper, { a: 1, b: 0, sw: 1.8 }) + Tx(50.6, 30.2, o.tag, 5.2, T.red.s));
    return out;
  },

  // Auras: a glowing halo round a head, with the named cue on the face.
  aura: (m, v) => {
    let face = "";
    if (v === "eyes" || v === "void") {
      const deep = v === "void";
      face = [26.4, 37.6].map((x) => fill(`M${x - 4.6} 32.2Q${x} ${deep ? 39.6 : 37.6} ${x + 4.6} 32.2Q${x} 35 ${x - 4.6} 32.2Z`, deep ? "#4b2a7a" : "#8a5bb8", .85) +
        L(`M${x - 4.2} 33.6Q${x} ${deep ? 37.8 : 36.4} ${x + 4.2} 33.6`, "#4b2a7a", 1.2, .9) +
        F(`M${x - 4} 29.6C${x - 2} 26.4 ${x + 2} 26.4 ${x + 4} 29.6C${x + 2} 32.4 ${x - 2} 32.4 ${x - 4} 29.6Z`, "#fff", 1.4) +
        (deep ? L(`M${x} 29.6m-1.6 0a1.6 1.6 0 1 0 3.2 0a.9 .9 0 1 0 -1.8 0`, INK, .9) : fill(C(x + (x < 32 ? .8 : -.8), 29.8, 1.2), INK)) +
        L(`M${x - 3.4} 28.6L${x - 1.6} 29.4M${x + 3.4} 30.6L${x + 1.8} 30`, T.red.b, .8) +
        fill(`M${x - 4.4} 29.4C${x - 2} 26 ${x + 2} 26 ${x + 4.4} 29.4C${x + 2} 28.2 ${x - 2} 28.2 ${x - 4.4} 29.4Z`, P.skin.s)).join("") +
        L("M27.6 39.4Q29.8 38.4 32 39.4T36.4 39.4", "#8f4a3a", 1.6);
    } else if (v === "stars5") {
      face = L("M23.4 30Q26.4 26.6 29.4 30M34.6 30Q37.6 26.6 40.6 30", INK, 1.8) + F("M26.4 36H37.6Q36.6 41.6 32 41.6Q27.4 41.6 26.4 36Z", "#fff", 1.4) + fill(E(23, 34, 2, 1.2) + E(41, 34, 2, 1.2), "#ff8fa8", .7);
    } else if (v === "shush") {
      face = L("M23 27.4L29 26.6M35 26.6L41 25.2", INK, 1.8) + fill(C(27.4, 30.6, 1.3) + C(37.6, 30.6, 1.3), INK) + F(E(32, 37.6, 2.4, 1.6), "#c95a5a", 1.2) +
        S("M24 48C24 43 27 41 31 41H34C37 41 39 43 39 46C39 50 36 52 32 52C28 52 24 51 24 48Z", P.skin, { a: [1.6, 1.6], b: 1, sw: 2, inner: L("M27 45H36M27 48H35", P.skin.s, 1, .8) }) +
        S("M30.4 43V33.4C30.4 32.2 31.2 31.6 32 31.6C32.8 31.6 33.6 32.2 33.6 33.4V43Z", P.skin, { a: [1, 0], b: [.8, 0], sw: 2 }) + F(R(30.9, 32.2, 2.2, 2, .9), P.skin.h, .8);
    }
    const top = v === "stars5" ? [-2, -1, 0, 1, 2].map((i) => { const a = (-90 + i * 30) * Math.PI / 180; return S(star(32 + Math.cos(a) * 22, 29 + Math.sin(a) * 22, 5.6, 2.4, 5, -90), P.gold, { a: .8, b: .5, sw: 1.8 }); }).join("") : "";
    return haloRing(m) + bust(m, v === "shush" ? T.brown : v === "stars5" ? T.tan : T.black) + face + top +
      (v === "eyes" || v === "void" ? L("M47 49C45 46 49 45 47 42M51 49C49 46 53 45 51 42", "#fff", 1.6, .85) + TL("M54 52C59 52 59 58 54 58", P.white.b, 1.8) + S("M43 50H55V58Q55 62 51 62H47Q43 62 43 58Z", P.white, { a: [1.4, 0], b: 0, sw: 2, inner: fill(E(49, 50.6, 6, 1.4), T.brown.s) }) : "") +
      (v === "shush" ? at(51, 10, 1.05, EMB.shh()) : "") + Sp(9, 11, 3.6) + Sp(56, 52, 3);
  },

  // Magnet taped to the end of a long stick.
  magnet: (m, v) => {
    const moon = v === "moon";
    return (moon ? S(C(54, 9, 7.5), T.cream, { a: 1.6, b: 0, inner: F(C(51.5, 7.5, 1.6), T.cream.s, 1) + F(C(56, 11.5, 2), T.cream.s, 1) }) + L("M46 16L42 20M50 20L48 24M42 12L38 14", "#b8ecff", 2, .9)
      : S(C(55, 9, 5.2), P.gold, { a: 1.2, b: .8, sw: 2, inner: L("M53 7.4H57", P.gold.s, 1) }) + L("M47 14L45 16M50 17L49 19.6M45 10.6L42.6 11.4", T.cyan.b, 2.2, .9)) +
      rot(rod("M32 63V34", P.wood, 6.4) + S(R(28, 33, 8, 9, 2), P.white, { a: [1.4, 0], b: 0, sw: 2, inner: L("M27 36L37 38M27 39.4L37 41.4", P.white.s, 1) }) +
        S("M18 10V20C18 29 24 34 32 34C40 34 46 29 46 20V10H37V20C37 23 35 25 32 25C29 25 27 23 27 20V10Z", m, { a: [3, 3], b: 2.2 }) +
        S(R(17, 3, 11, 8, 2), P.metal, { a: [2, 1.4], b: 1.2 }) + S(R(36, 3, 11, 8, 2), P.metal, { a: [2, 1.4], b: 1.2 }), 32);
  },

  // Helmet with a Belisha beacon on top: hard-hat shell, peak, chin strap, striped post and an amber globe.
  helmet: (m, v) => {
    const shell = m === T.gold ? P.gold : P.white;
    return glow(32, 9, 15, "#ffb34d", .6) + L("M20 4L16 1M44 4L48 1M14 12H10M50 12H54", "#ffb34d", 2.2) +
      S(R(28.6, 14, 6.8, 10, 1), P.white, { a: [1, 0], b: 0, sw: 2, inner: fill("M28 16H36V18.6H28Z M28 21H36V23.6H28Z", INK) }) +
      S(C(32, 9.6, 7.4), T.orange, { a: 2, b: 1.6 }) + Gl(29.4, 7, 2, 1.4, -30, .9) +
      L("M15 44C15 52 22 57 31 57", INK, 4.2) + L("M15 44C15 52 22 57 31 57", P.dark.b, 2) +
      S("M11 44C11 30 20 22 32 22C44 22 53 30 53 42V45H11Z", shell, { a: [4, 3], b: 2.4, inner: fill("M29 22H35V45H29Z", shell.s, .45) + fill("M0 36H64V39.6H0Z", INK, .85) }) +
      S("M4 44Q32 40 58 44L60 48Q32 52 6 50Z", dk(shell), { a: [0, 1.6], b: [0, 1] }) + S(R(28, 54, 7, 5, 1.6), P.dark, { a: 0, b: 0, sw: 1.8 });
  },

  lance: (m, v) => lay(
    S("M32 -4L40 44H24Z", m, { a: [3.4, 0], b: [1.8, 0], inner: fill("M20 8L44 1V5.4L20 12.4Z M20 20L44 13V17.4L20 24.4Z M20 32L44 25V29.4L20 36.4Z", "#fff", .9) }) +
    S("M12 49Q32 28 52 49Q32 57 12 49Z", P.metal, { a: [0, 2.4], b: [1.6, 1.2], inner: L("M20 46Q32 37 44 46", P.metal.s, 1.4, .7) }) +
    S(R(27.4, 50, 9.2, 13, 2.4), P.dwood, { a: [2, 0], b: 0, sw: 2.2, inner: L("M26 54H38M26 58H38", P.dwood.s, 1.4) }) + S(R(26, 62, 12, 7, 3), m, { a: [2, 0], b: 0, sw: 2.2 }) +
    (v === "star" ? glow(32, 4, 12, "#fff3a0", .6) + S(star(32, 4.6, 8.4, 3.6, 5, -90), P.gold, { a: 1.2, b: 1, sw: 2.2 }) : "")),

  // Cafeteria tray turned riot shield: tall, thick, curved, with the lunch still in it.
  tray: (m) => rot(
    S("M47 7L53 9V57L47 60Z", dk(m), { a: 0, b: 0, sw: 2.2 }) +
    S(R(11, 6, 37, 54, 5), m, { a: [3, 3], b: 2,
      inner: S(R(15, 10, 29, 20, 3), dk(m), { a: [-1.6, -1.6], b: 0, sw: 1.4, norim: 1 }) + S(R(15, 33, 13, 23, 3), dk(m), { a: [-1.6, -1.6], b: 0, sw: 1.4, norim: 1 }) + S(R(31, 33, 13, 23, 3), dk(m), { a: [-1.6, -1.6], b: 0, sw: 1.4, norim: 1 }) +
        dots([[19, 40], [22, 43], [19, 46], [23, 49], [20, 52]], 1.8, T.green.b, 1.1) + F("M20 15C24 13 30 16 31 20C32 24 26 26 22 24C18 22 17 17 20 15Z", T.red.b, 1.4) +
        G("rotate(-20 38 44)", F(R(34, 36, 4, 15, 1), P.gold.b, 1.2) + F(R(39, 37, 4, 13, 1), P.gold.b, 1.2)) + L("M14 9L20 9", "#fff", 1.6, .6) }) +
    S(R(7, 26, 5, 14, 2), P.dark, { a: 0, b: 0, sw: 2 }), -10),

  // A fat golden chip on a wooden chip fork, crowned.
  chip: (m) =>
    glow(32, 34, 30, "#ffe36a", .55) +
    rot(S("M24 13C24 8.6 26.6 7 30 7.4L36 8C39 8.4 40.6 10.6 40.4 14L39.6 50C39.4 54.6 36.6 57 33 56.6L27.6 56C24.6 55.6 23.2 53.4 23.4 50Z", P.gold, { a: [4, 2], b: [2.2, 1.4],
      inner: fill("M20 6H44V13H20Z", "#d9821c", .85) + fill("M20 52H44V60H20Z", "#d9821c", .8) + L("M29 16C28.4 28 29.6 38 28.8 48", P.gold.h, 2.4, .8) + dots([[35, 22], [32, 33], [36, 41], [30, 46], [34, 15]], .8, "#fff", .4) + L("M36.4 18V28M33 36V44", P.gold.s, 1.4, .55) }), 30) +
    G("rotate(-25 46 18)", S(R(43.6, 4, 4.8, 22, 1.4), P.wood, { a: [1.4, 0], b: 0, sw: 2, inner: L("M44 8H48", P.wood.s, 1) }) + F("M44.4 26V30M46 26V31M47.6 26V30", "none", 1.8)) +
    S("M14 12L15 6L18.6 9.6L21 4.4L23.4 9.6L27 6L28 12Z", P.gold, { a: 0, b: 0, sw: 1.8 }) + Sp(54, 50, 3.4) + Sp(10, 50, 2.6),

  bread: (m, v) => lay(
    S("M26 16C25.4 26 26.4 36 25.6 46C25 54 26 61 26.4 66Q32 71 37.6 66C38 60 38.8 52 38.4 44C38 34 38.8 24 38.4 16Z", T.tan, { a: [3.4, 0], b: [2, 0], inner: dots([[29.4, 24], [34.4, 30], [29.6, 36], [34.8, 41], [29.4, 52], [34, 58], [30.4, 62]], 1, "#fff8e8", .4) + L("M28.6 20C28.2 32 28.8 44 28.4 58", T.tan.h, 1.8, .7) }) +
    bands([24, 46], 13.4, 5.4, P.gold) + F(C(28.6, 48.7, 1.4), T.red.b, .9) + F(C(35.4, 48.7, 1.4), T.cyan.b, .9) +
    glow(32, 9, 16, "#fff3a0", .55) +
    S("M21 17L19.4 3.6L26.2 9.6L32 0L37.8 9.6L44.6 3.6L43 17Z", P.gold, { a: [0, 2.2], b: 1.4, inner: L("M20 13.6H44", P.gold.s, 1.6) }) +
    S(C(19.4, 3.6, 2.4) + C(32, 0, 2.6) + C(44.6, 3.6, 2.4), P.gold, { a: .6, b: 0, sw: 1.8 }) + F(C(32, 11.4, 2.4), T.red.b, 1.2) + F(C(25, 12.4, 1.6), T.cyan.b, 1) + F(C(39, 12.4, 1.6), T.cyan.b, 1) +
    S(C(32, 69, 3.6), P.gold, { a: .8, b: 0, sw: 1.8 })) + Sp(10, 14, 3.4) + Sp(54, 50, 3),

  // Sausage roll: flaky layered pastry, a big cut end of meat, flakes everywhere.
  sausageroll: (m) => rot(
    S("M18 22H50C56 22 59 28 59 35C59 42 56 48 50 48H18Z", P.oat, { a: [0, 3], b: [1.4, 1.4],
      inner: L("M26 23C24 30 24 40 26 47M34 23C32 30 32 40 34 47M42 23C40 30 40 40 42 47M50 23C48 30 48 40 50 47", P.oat.s, 2, .8) + L("M18 27C30 25 44 25 56 27M18 43C30 45 44 45 56 43", "#fff", 1.4, .55) + dots([[30, 30], [46, 32], [38, 40]], .7, "#fff", .4) }) +
    S(E(18, 35, 9, 13), P.oat, { a: 0, b: 0, sw: 2.2, inner: `<ellipse cx="18" cy="35" rx="7" ry="10.6" fill="none" stroke="${P.oat.s}" stroke-width="1.4"/><ellipse cx="18" cy="35" rx="5.6" ry="8.6" fill="none" stroke="${P.oat.h}" stroke-width="1.2"/>` }) +
    S(E(18, 35, 4.6, 7), pal("#d27a60", "#9c4a34", "#f2a88c"), { a: 1, b: .8, sw: 1.8, inner: dots([[17, 32], [19.6, 36], [16.6, 39]], .6, "#f6c2a8", .3) }) +
    F("M50 12L54 10L55 13L51 15Z", P.oat.h, 1.4) + F("M8 55L12 53L13 57L9 58Z", P.oat.h, 1.4) + F("M40 56L43 54L44 57Z", P.oat.h, 1.2) + F("M58 54L61 53L61 56Z", P.oat.h, 1.2) +
    dots([[24, 58], [30, 59], [46, 59]], 1, "#8b8d85", 1) + L("M4 60C14 62 50 62 62 60", INK, 1.6, .25), -14) + Sp(54, 18, 3) + Sp(10, 16, 2.4),

  // Knee pad with proper straps: two webbing bands, a buckle and a velcro tab.
  kneepad: (m) =>
    S("M2 14H62V24H2Z", P.dark, { a: [0, 2], b: 0, inner: L("M2 16.4H62M2 21.6H62", "#8c99c8", .9, .6, ' stroke-dasharray="1.6 1.4"') }) +
    S("M2 40H62V50H2Z", P.dark, { a: [0, 2], b: 0, inner: L("M2 42.4H62M2 47.6H62", "#8c99c8", .9, .6, ' stroke-dasharray="1.6 1.4"') }) +
    S(R(51, 11, 9, 16, 2), P.metal, { a: 1, b: .6, sw: 2, inner: fill(R(53.4, 14, 4, 10, 1), INK) }) + S(R(1, 38, 12, 14, 2), m, { a: 0, b: 0, sw: 2, inner: L("M3 41V49M6 41V49M9 41V49", m.s, 1, .7) }) +
    S("M32 3C46 3 53 15 53 30C53 46 45 61 32 61C19 61 11 46 11 30C11 15 18 3 32 3Z", P.dark, { a: [3, 2], b: 1 }) +
    S("M32 8C42 8 47.6 18 47.6 30C47.6 43 41.6 55 32 55C22.4 55 16.4 43 16.4 30C16.4 18 22 8 32 8Z", m, { a: [3, 3], b: 2.2, inner: L("M17 23C25 20 39 20 47 23M17 37C25 34 39 34 47 37", m.s, 2, .8) + L("M24 46L30 41M36 15L42 19", "#fff", 1.6, .7) }) +
    Gl(24, 16, 2, 5, 30, .8),

  // Racing ring: the pigeon itself, wearing an oversized numbered band on its leg.
  legring: (m) => G("translate(0 -5)", M.pigeon(T.teal, "")) +
    S(E(28.2, 54.4, 7.4, 2.8), dk(m), { a: 0, b: 0, sw: 2 }) +
    S("M20.8 46V54.4A7.4 2.8 0 0 0 35.6 54.4V46Z", m, { a: [1.6, 0], b: [1, 0], inner: Tx(28.2, 53.2, "26", 6, "#fff") }) +
    S(E(28.2, 46, 7.4, 2.8), m, { a: 0, b: 0, sw: 2, inner: fill(E(28.2, 46.4, 5.4, 1.7), dk(m).s) }) + F("M26.9 46.6V44.6H29.5V46.6Z", "#ff8a6b", 1.2) +
    S(R(4, 3, 15, 9, 1.5), P.gold, { a: 0, b: 0, sw: 1.6 }) + Tx(11.5, 9.6, "1st", 6, INK),

  // Lighthouse lens shard: a broken wedge of glass with bold concentric Fresnel ridges.
  lens: (m) =>
    glow(30, 34, 26, "#fff3a0", .6) + fill("M34 30L64 10V34Z", "#fff3a0", .55) +
    S("M6 50L20 6L50 22L40 58Z", P.glass, { a: [3, 3], b: 2,
      inner: [8, 14, 20, 26, 32, 38].map((r) => `<circle cx="46" cy="44" r="${r}" fill="none" stroke="#5fb4dc" stroke-width="3.4"/><circle cx="46" cy="44" r="${r - 1.6}" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="46" cy="44" r="${r + 1.8}" fill="none" stroke="${INK}" stroke-width="1" opacity=".45"/>`).join("") }) +
    Sp(48, 12, 4) + Sp(8, 18, 2.6),

  // Enigma rotor: alphabet ring, contact pins and a deeply toothed thumbwheel.
  rotor: (m) =>
    S(E(32, 40, 26, 12), P.dmetal, { a: 0, b: 0 }) +
    S(gearE(32, 34, 28, 13.4, 22, .14), m, { a: [0, 2.4], b: [0, 1.2] }) +
    S(E(32, 32, 21, 9.6), T.cream, { a: [0, 1.6], b: 0, sw: 2, inner: Tx(32, 27.4, "A B C D", 4.4, INK) + Tx(32, 40.6, "Q R S", 4.4, INK) + Tx(15, 33.6, "Z", 4.4, INK) + Tx(49, 33.6, "H", 4.4, INK) }) +
    S(E(32, 32, 11, 5), P.metal, { a: [0, 1.2], b: 0, sw: 2 }) + F(E(32, 32, 3.4, 1.6), INK, 1) +
    dots([[23.6, 32], [40.4, 32], [32, 28], [32, 36], [26, 29.2], [38, 29.2], [26, 34.8], [38, 34.8]], 1.1, P.gold.b, .8) + L("M60 30L63 26M60 36H64", INK, 1.6, .5),

  // Kelpie's bridle, worn by the water horse itself: a knight-piece head, mane of waves, leather straps and a bit ring.
  bridle: (m) => {
    const water = pal("#6fd8cc", "#2f9a9a", "#c8fff6");
    const head = "M38 3L44 12C52 16 57 26 57 38C57 48 55 56 54 62H30C30 54 32 48 34 43C30 46 24 47 20 46C16 46 13 47 11 46C7 45 5 42 6 38C7 34 10 31 14 28C20 22 26 15 31 10L34 9Z";
    return S(head, water, { a: [3, 2], b: 2, inner: fill("M44 12C52 16 57 26 57 38C57 48 55 56 54 62H64V0H40Z", dk(water).b) + L("M47 16C51 22 53 28 53 34M50 32C53 38 54 44 54 50", water.h, 1.6, .9) +
        `<circle cx="29" cy="35" r="7.6" fill="none" stroke="${water.s}" stroke-width="1.6"/>` + L("M8 42.6C10 43.6 12.6 43.8 15 43.4", water.s, 1.4) }) +
      S("M31.6 11L33.6 3.4L37.8 10.4Z", water, { a: 0, b: 0, sw: 2 }) + S("M31 13C27.6 10 28.6 6.4 32 6.6C32.6 9.4 32.4 11.4 31 13Z", dk(water), { a: 0, b: 0, sw: 1.6 }) +
      F(C(29, 20, 2.2), INK, 1) + fill(C(28.2, 19.2, .8), "#fff") + F(E(9.4, 36.6, 1.5, 1.1), INK, .1) +
      L("M40 13L14 43M40 13L30 13.6M40 13L37 37M9.6 31L22 40.6", INK, 5.4) + L("M40 13L14 43M40 13L30 13.6M40 13L37 37M9.6 31L22 40.6", T.brown.b, 2.8) +
      dots([[40, 13], [30, 13.6], [18.4, 37.8]], 1.6, P.metal.b, 1.2) +
      S(C(14, 44, 3.8) + C(14, 44, 1.8), P.metal, { ev: 1, a: .6, b: 0, sw: 2 }) +
      L("M14.6 47.6C16 54 20 58 26 62", INK, 4.6) + L("M14.6 47.6C16 54 20 58 26 62", T.brown.b, 2.2) +
      S(drop(6, 52, .85), T.cyan, { a: .6, b: 0, sw: 1.6 }) + OV.waves();
  },

  // Hare's foot keyring: a furry hind foot, broad at the toes, with claws, a metal cap at the heel and a ring.
  harefoot: () => G("rotate(-30 32 34)",
    S("M27.6 14C26.6 22 23.4 32 23.2 41C23 45 22 49 23 52.6Q24.4 58 27.2 56.2Q28.6 60.2 31.2 57.6Q33.2 60.8 35.6 57.6Q38.2 60.2 39.8 56.2Q42.2 57.6 41.8 52.4C42.2 48 41.2 44 41 40C40.6 32 37.6 22 36.6 14Z", pal("#c9ad88", "#957552", "#efdcc0"), { a: [3, 2], b: 1.8,
      inner: fill("M22 44C25 47 29 48 32 48C35 48 39 47 42 44V64H22Z", "#efe2cc") + L("M27.6 49V56M31.4 49.6V57.6M35.6 49.6V57.6M39.4 49V56", "#957552", 1.3, .85) + L("M30 18C29.4 26 28.6 34 28.4 42M34.6 20C35 28 35.4 34 35.6 40", "#957552", 1.1, .55) }) +
    L("M24.4 30L22.2 29M23.6 38L21 37.6M40 31L42.2 30M40.4 39L43 38.6M26 22L24 20.6M38 22L40 20.6", "#957552", 1.6) +
    F("M25.4 56L23.4 60L27.4 57.6Z M30.4 58.6L30 62.6L32.4 59Z M35 58.6L36 62.6L37.2 58.4Z M39.8 56.4L42 60.2L41.8 55.4Z", "#3a3040", 1.1) +
    S(R(26, 8, 12, 8, 2.2), P.gold, { a: [1.4, 1], b: 0, sw: 2, inner: L("M25 11.6H39", P.gold.s, 1) })) +
    L("M27.6 7L25.8 3.4", INK, 3.4) + L("M27.6 7L25.8 3.4", P.metal.b, 1.4) + ring2(19, 6, 4.6, P.gold.b, 1.6),

  // Astrolabe: throne and shackle, the mater's degree ring, the lacy rete and a slim rule.
  astrolabe: (m) =>
    ring2(32, 6, 3.6, P.gold.b, 1.6) + S("M26 10H38L36 16H28Z", P.gold, { a: [0, 1], b: 0, sw: 1.8 }) +
    S(C(32, 37, 24), P.gold, { a: 3, b: 2.2, inner: `<circle cx="32" cy="37" r="19.6" fill="${P.gold.s}"/>` + [...Array(36)].map((_, i) => `<path transform="rotate(${i * 10} 32 37)" d="M32 13V${i % 3 ? 15.4 : 17.4}" stroke="${INK}" stroke-width="1" opacity=".7"/>`).join("") }) +
    `<circle cx="32" cy="37" r="9" fill="none" stroke="${INK}" stroke-width="3.6"/><circle cx="32" cy="37" r="9" fill="none" stroke="${P.gold.h}" stroke-width="1.6"/>` +
    `<circle cx="32" cy="33" r="13" fill="none" stroke="${INK}" stroke-width="3.6"/><circle cx="32" cy="33" r="13" fill="none" stroke="${P.gold.h}" stroke-width="1.6"/>` +
    [[20, 26, 30], [44, 27, -30], [22, 46, 120], [43, 45, -120]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 -5C2 -2 2 2 0 4C-2 2 -2 -2 0 -5Z" fill="${P.gold.h}" stroke="${INK}" stroke-width="1.3"/>`).join("") +
    G("rotate(-14 32 37)", S("M11 35.4H53V38.6H11Z", P.dmetal, { a: 0, b: 0, sw: 1.8 }) + S(R(14, 32, 3, 10, .6), P.dmetal, { a: 0, b: 0, sw: 1.4 }) + S(R(47, 32, 3, 10, .6), P.dmetal, { a: 0, b: 0, sw: 1.4 })) +
    S(C(32, 37, 2.8), P.dmetal, { a: 0, b: 0, sw: 1.6 }) + F(star(32, 22.6, 2.4, 1, 4, 0), "#fff", .1),

  // Planisphere: the square card cover with its oval window, the starry dial turning underneath, a brooch bar on top.
  planisphere: (m) =>
    S(C(32, 34, 26), T.navy, { a: 2, b: 1.4, inner: [...Array(24)].map((_, i) => `<path transform="rotate(${i * 15} 32 34)" d="M32 8.6V12" stroke="#fff" stroke-width="1.2" opacity=".8"/>`).join("") }) +
    S(R(13, 15, 38, 38, 4) + E(32, 31, 13, 10), T.cream, { ev: 1, a: [2, 2], b: 1.4, inner: L("M18 46H46", INK, 1.2, .35) + Tx(32, 49.6, "TONIGHT", 3.8, INK) }) +
    fill(E(32, 31, 13, 10), "#1d2a5c") + dots([[24, 28], [30, 25], [37, 27], [40, 33], [28, 35], [34, 36]], .9, "#fff", .1) + L("M24 28L30 25L37 27L40 33M28 35L34 36", "#cfe0ff", 1, .7) +
    F(E(32, 31, 13, 10), "none", 2) + S(C(32, 31, 2), P.gold, { a: 0, b: 0, sw: 1.4 }) +
    S(R(18, 4, 28, 5, 2.5), P.gold, { a: [0, 1.4], b: 0, sw: 2 }) + S(C(46, 6.5, 2.6), P.gold, { a: 0, b: 0, sw: 1.6 }),

  // Keystone at the crown of a stone arch, holding it all up above the clouds.
  keystone: (m) => {
    let arch = "";
    for (let i = 0; i < 7; i++) {
      if (i === 3) continue;
      const a0 = 180 + i * (180 / 7), a1 = a0 + 180 / 7 - 1.4;
      arch += S(sector(32, 50, 17, 29, a0, a1), pal("#8e9088", "#64665f", "#bcbdb4"), { a: 1.4, b: 1, sw: 2 });
    }
    return glow(32, 20, 16, "#fff3a0", .45) + arch +
      S("M28.2 33.4H35.8L39.4 15H24.6Z", T.stone, { a: [2.4, 2], b: 1.6, inner: fill("M0 15H64V18H0Z", T.stone.h, .7) }) +
      S(star(32, 23, 4.6, 2, 5, -90), P.gold, { a: .8, b: 0, sw: 1.6 }) +
      S(cloudD(13, 54, .95), P.white, { a: 0, b: [0, 1], sw: 2 }) + S(cloudD(51, 55, .9), P.white, { a: 0, b: [0, 1], sw: 2 }) + Sp(56, 10, 3) + Sp(8, 24, 2.4);
  },

  // Wind chime with its wish slip: glass bell, clapper, a paper tag with a star and a tick.
  chime: (m) =>
    L("M32 1V8", INK, 2.2) + S(C(32, 3, 2), P.gold, { a: 0, b: 0, sw: 1.4 }) +
    S("M12 30C12 15 20 7 32 7C44 7 52 15 52 30C52 33 12 33 12 30Z", P.glass, { a: [3, 2], b: 2, inner: L("M16 22C21 17 26 18 30 21C34 24 40 22 48 17", m.b, 2.6) + fill(C(22, 26, 2) + C(32, 25.4, 2) + C(42, 26, 2), T.red.b) + L("M18 16C20 12.6 24 10.4 28 10", "#fff", 2.2, .9) }) +
    L("M32 31V37", INK, 1.6) + S(C(32, 36.4, 2.6), P.gold, { a: 0, b: 0, sw: 1.4 }) +
    G("rotate(-8 32 50)", S(R(23, 38, 18, 24, 1.2), m, { a: [1.6, 1], b: 0, sw: 2, inner: fill(R(23, 38, 18, 4, 0), dk(m).b) }) + S(star(32, 47, 5.4, 2.4, 5, -90), P.gold, { a: .6, b: 0, sw: 1.6 }) + L("M27.6 56.4L30.4 59L36.4 53", "#fff", 2.6) + L("M27.6 56.4L30.4 59L36.4 53", T.green.s, 1.4)) +
    L("M7 24C3 28 3 36 7 40M57 24C61 28 61 36 57 40", INK, 2, .55) + Sp(9, 8, 2.8) + Sp(55, 52, 2.4),

  // Wrecking ball hung from a shoelace: steel ball, shackle plate with two eyelets, laced and tied in a bow.
  wreckingball: () =>
    TL("M33 20C35 13 42 12 46 9C50 6 53 4 57 3", "#f3f6fd", 2.6) + S(R(55, 1, 7, 4, 1.4), P.dmetal, { a: 0, b: 0, sw: 1.6, norim: 1 }) +
    S(C(30, 43, 18.5), P.dmetal, { a: 4, b: 2.6, hw: 2.4, inner: fill("M0 41H64V45H0Z", P.dmetal.s, .8) + dots([[16, 43], [23, 43], [30, 43], [37, 43], [44, 43]], 1.1, P.metal.b, .8) }) +
    S("M21 22H39Q41 22 41 24V29Q41 31 39 31H21Q19 31 19 29V24Q19 22 21 22Z", P.metal, { a: [0, 1.6], b: 0, sw: 2.2 }) +
    ring2(25, 26.5, 2, P.gold.b, 1.4) + ring2(35, 26.5, 2, P.gold.b, 1.4) +
    TL("M25 26.5L33 20M35 26.5L28 19.4", "#f3f6fd", 2) +
    TL("M30.6 19.8C27 15 23 17 25.6 20.4C27 22 29.6 21 30.6 19.8C34 15.4 38.6 17 36 20.6C34.6 22.2 32 21 30.6 19.8", "#f3f6fd", 1.8) + TL("M28 21L25 27M33 21L36 26", "#f3f6fd", 1.8) +
    Gl(22, 36, 3, 5, 40, .5) + L("M8 30C5 36 5 46 8 52M4 34C2 40 2 46 4 50", INK, 2, .4),

  // Meteor on a bungee: hook, a striped elastic cord stretched taut and wavy, the rock straining with its trail.
  bungee: (m) => {
    const cord = "M50 14C46 17 47 20 43 22C39 24 40 27 36 29C33 30.6 33 32 30 33";
    return S("M8 46C4 50 2 56 4 62C10 58 14 56 20 54Z M14 52C10 56 10 60 12 64C16 60 20 58 24 56Z", T.orange, { a: 0, b: 0, sw: 2, inner: fill("M8 50C6 54 6 58 6 60C10 57 14 55 18 54Z", T.yellow.b) }) +
      S(fuzz(23, 44, 13, 12, 9, 1.6), T.coal, { a: 2.6, b: 1.8, inner: F(C(19, 40, 3), T.coal.s, 1.2) + F(C(28, 48, 2.4), T.coal.s, 1.2) + F(C(27, 38, 1.6), T.coal.s, 1) + L("M14 48L19 46L22 50M30 41L33 44", "#ff8a2b", 1.6, .95) }) +
      ring2(31, 33, 2.6, P.metal.b, 1.4) +
      L(cord, INK, 7.6) + L(cord, m.b, 4.6) + L(cord, T.red.b, 4.6, null, ' stroke-dasharray="2.2 2.4" stroke-linecap="butt"') + L(cord, "#fff", 1, .5, ' transform="translate(-.8 -.8)"') +
      L("M38 18L41 15M45 26L48 23M34 24L36 21.6", INK, 1.6, .5) +
      TL("M50 14C50 8 58 6 58 11C58 14 55 15 54 13", P.metal.b, 2) + TL("M31 33C29 31 30 29 32 29", P.metal.b, 1.6) + Sp(56, 40, 3) + Sp(44, 54, 2.4);
  },

  // Thermal delivery backpack: cube with zip lid, carry handle, reflective band and shoulder straps.
  deliverybag: (m, v) => {
    const bag = (q) =>
      S("M46 22L58 14V48L46 58Z", dk(q), { a: [1, 0], b: 0, inner: L("M50 18C54 28 54 42 50 52M55 16C58 28 58 40 55 50", INK, 3.4, .55) + L("M50 18C54 28 54 42 50 52", P.dark.b, 2) }) +
      S("M10 22L22 14H58L46 22Z", q, { a: 0, b: 0, sw: 2.2, inner: fill("M10 22L22 14H58L46 22Z", "#fff", .25) + L("M14 21.4L24 15M47 21.4L57 15", INK, 1, .4) }) +
      TL("M27 18.6C28 14 36 14 37 18.6", P.dark.b, 2.4) +
      S(R(10, 22, 36, 36, 3), q, { a: [0, 3], b: [1.4, 1.4], inner: L("M10 26.6H46", INK, 1.6, .45) + L("M11 26.6H45", P.metal.b, .9, .9, ' stroke-dasharray="1 1.2"') + fill("M10 44H46V49H10Z", "#e6ecf5") + fill("M10 45.4H46V46.4H10Z", "#fff") }) +
      S(R(39, 25, 3, 5, 1), P.metal, { a: 0, b: 0, sw: 1.2 });
    let out = "";
    if (v === "sun") out += glow(32, 34, 30, "#ffb347", .45);
    if (v === "flames") out += [[16, 12], [30, 8], [44, 11], [54, 8]].map(([x, y]) => S(`M${x} ${y - 8}C${x + 3} ${y - 3} ${x + 7} ${y} ${x + 6} ${y + 6}H${x - 6}C${x - 7} ${y} ${x - 3} ${y - 3} ${x} ${y - 8}Z`, T.orange, { a: 0, b: 0, sw: 2, inner: fill(drop(x, y + 3, .7), T.yellow.b) })).join("");
    if (v === "flail") return rod("M6 62L18 50", P.dwood, 6) + S(R(13.4, 46, 8, 6, 1.6), P.metal, { a: 0, b: 0, sw: 1.8 }) + chainLinks(19, 47, 34, 32, 4, P.metal) +
      G("translate(23 -2) scale(.66)", bag(m) + S(R(19, 34, 18, 7, 2), P.white, { a: 0, b: 0, sw: 2 })) + L("M4 40L10 38M2 48H8", INK, 2, .4);
    out += bag(m);
    if (v === "armour") out += TL("M18 22V58M38 22V58", P.dark.b, 3.4) + TL("M14 36H44", P.dark.b, 3) + S(R(25, 32, 8, 8, 1.6), P.metal, { a: 0, b: 0, sw: 1.8, inner: fill(R(27.4, 34.4, 3.2, 3.2, .4), INK) }) + TL("M18 22C18 10 38 10 38 22", P.dark.b, 3.4);
    else out += v === "sun" ? emb("sun", 28, 36, 1.2) : v === "flames" ? F("M22 32H34L29 36H34L24 42L27 37H22Z", T.yellow.b, 1.6) : S(R(19, 30, 18, 11, 2), P.white, { a: 0, b: 0, sw: 1.8, inner: L("M22 35.4H34M22 38H30", INK, 1.2, .45) });
    return out;
  },

  // Exoskeleton made of vacuums: canister chest, ribbed hoses over the shoulders, nozzles for hands.
  vacexo: (m) =>
    hose("M22 22C14 18 8 24 8 34C8 42 8 48 10 52", P.dark, 5) + hose("M42 22C50 18 56 24 56 34C56 42 56 48 54 52", P.dark, 5) +
    S("M2 52H17L15 59H4Z", T.red, { a: [0, 1.6], b: 0, sw: 2, inner: L("M4 57H15", INK, 1.6, .6) }) + S("M51 50H57L58 62H52Z", T.red, { a: [1, 0], b: 0, sw: 2 }) +
    S(R(18, 14, 28, 44, 8), T.red, { a: [3.6, 2], b: 2.2, inner: fill(R(18, 26, 28, 8, 0), P.dark.b) + fill(R(18, 44, 28, 3, 0), "#fff", .5) }) +
    S(E(32, 14.6, 13, 4), P.dark, { a: 0, b: 0, sw: 2.2, inner: fill(E(32, 14, 9, 2.4), "#55607f") }) +
    S(R(26, 6, 12, 7, 3), P.dark, { a: 0, b: 0, sw: 2 }) + S(C(32, 30, 3.2), P.metal, { a: .8, b: 0, sw: 1.6 }) +
    S(R(15, 20, 8, 6, 2), P.metal, { a: 0, b: 0, sw: 1.8 }) + S(R(41, 20, 8, 6, 2), P.metal, { a: 0, b: 0, sw: 1.8 }) + L("M20 56V62M44 56V62", INK, 3) + dots([[22, 62], [42, 62]], 1.8, P.dark.b, 1.4),

  // The first ever door, cut down into a breastplate: arched top, arm holes, planks, strap hinges, ring handle.
  doorplate: (m) => {
    const d = "M14 60V31C18 29 19 23 18 17C20 9 26 4 32 4C38 4 44 9 46 17C45 23 46 29 50 31V60Z";
    return TL("M21 9C19 2 15 1 12 4M43 9C45 2 49 1 52 4", P.dark.b, 3) +
      S(d, T.brown, { a: [4, 2], b: 2, inner: L("M23 0V64M32 0V64M41 0V64", T.brown.s, 2, .9) + L("M19 30C20 38 19 46 20 54M36 20C37 30 36 40 37 50", T.brown.h, 1.2, .5) + F(E(27, 44, 1.4, 2.4), T.brown.s, 1) }) +
      [22, 48].map((y) => S(`M14 ${y - 2.4}H34L37 ${y}L34 ${y + 2.4}H14Z`, P.dark, { a: 0, b: 0, sw: 1.8, inner: dots([[18, y], [24, y], [30, y]], .9, P.metal.b, .6) })).join("") +
      ring2(43, 37, 3.4, P.gold.b, 1.6) + S(C(43, 33, 1.8), P.gold, { a: 0, b: 0, sw: 1.4 }) + F("M42.2 42H43.8L44.4 46H41.6Z", INK, .1);
  },
});

// Mail rings big enough to read at 64px, and a coif hood for hauberks.
PAT.rings = (m) => { let s = ""; for (let r = 0; r < 12; r++) for (let c = 0; c < 15; c++) s += C(c * 4.6 + (r % 2) * 2.3, 5 + r * 4.6, 2); return `<path d="${s}" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".55"/><path d="${s}" fill="none" stroke="${m.h}" stroke-width=".8" transform="translate(-.5 -.5)"/>`; };
PAT.hail = () => [[20, 22], [42, 30], [26, 44], [44, 50], [36, 18]].map(([x, y]) => F(C(x, y, 2.4), "#f4fbff", 1.2) + fill(C(x - .7, y - .7, .7), "#fff")).join("");
PAT.columns = (m) => [[18, 28], [40, 34], [28, 46], [46, 50], [16, 50]].map(([x, y]) => fill(`M${x - 1.6} ${y + 5}V${y - 3}H${x + 1.6}V${y + 5}Z M${x - 3} ${y + 5}H${x + 3}V${y + 7}H${x - 3}Z M${x - 2.4} ${y - 3}H${x + 2.4}V${y - 4.4}H${x - 2.4}Z M${x} ${y - 4.4}V${y - 7}`, m.s, .9) + `<circle cx="${x}" cy="${y - 7.6}" r="1.4" fill="${m.s}"/>`).join("");
PAT.stonering = () => `<ellipse cx="32" cy="42" rx="15" ry="8" fill="#2f7a4a" opacity=".45"/>` + [...Array(9)].map((_, i) => { const a = (i / 9 + .03) * Math.PI * 2, x = 32 + Math.cos(a) * 15, y = 41 + Math.sin(a) * 8; return F(R(f(x - 2.2), f(y - 7), 4.4, 9, 1.4), T.stone.b, 1.3); }).join("") + F(R(28.4, 33, 7.2, 3, 1), T.stone.h, 1.2) + F(R(28.6, 35.6, 2.4, 6, .6), T.stone.b, 1.2) + F(R(33, 35.6, 2.4, 6, .6), T.stone.b, 1.2);
PAT.slats = (m) => L("M0 26H64M0 34H64M0 42H64M0 50H64", m.s, 2.6, .9) + L("M0 24.6H64M0 32.6H64M0 40.6H64M0 48.6H64", m.h, 1, .5);
PAT.footsteps = () => [[30, 54, -10], [36, 47, 10], [29, 40, -10], [35, 33, 10], [28.6, 26, -10]].map(([x, y, a], i) => `<path transform="translate(${x} ${y}) rotate(${a}) scale(.32${i % 2 ? "" : " .32"})" d="${FOOT}" fill="#fff" opacity=".8"/>`).join("");
PAT.galaxycrumbs = () => L("M32 40a2 2 0 0 1 4 0a5 5 0 0 1 -10 0a8 8 0 0 1 16 0a11 11 0 0 1 -22 0", "#d9c6ff", 1.8, .55) + PAT.crumbs();

/* ------------------------------------------------------------------ */
/* Thin-object pass: long things lie corner to corner with bold shafts  */
/* and a big readable head, small things fill the frame                 */
/* ------------------------------------------------------------------ */
// Vertical shaft centred on x=32 from y0 to y1, two-tone with a glint. Draw long (about -4..70) and lay on the diagonal.
const shaft = (y0, y1, w, q, o) => S(R(f(32 - w / 2), y0, w, f(y1 - y0), f(Math.min(w / 2, 3.2))), q, Object.assign({ a: [f(w * .28), 0], b: [f(w * .16), 0], hw: f(Math.max(1.2, w * .18)) }, o || {}));
// Bands wrapped round a vertical shaft of width w.
const bands = (ys, w, h, q) => ys.map((y) => S(R(f(32 - w / 2 - .9), y, f(w + 1.8), h, 1.2), q, { a: [f(w * .22), 0], b: 0, sw: 2 })).join("");
// Lay a vertical drawing on the diagonal, head to the top right.
const lay = (s, a) => rot(s, a == null ? 45 : a);

/* ------------------------------------------------------------------ */
/* Item -> art table. "motif tint [variant] [key:value ...] [+overlay[@corner] ...]"
   motif = drawing (M), tint = colour (T), variant picks the motif's version,
   key:value tunes it (garments: pat, emb, pk, collar...), +overlay adds stars, glow, ghost etc. */
/* ------------------------------------------------------------------ */
const ITEM_ART = {
  // generic weapons, armour, trinkets
  "plastic-spork": "spork white", "takeaway-menu": "rolledmenu red", "damp-umbrella": "umbrella blue",
  "tin-bag": "sack green", "polite-cricket-bat": "cricketbat blue", "long-fence-post": "plank tan",
  "used-hi-vis": "jacket hivis hivis pat2:stains", "damp-anorak": "jacket teal anorak pat:drops", "nans-scarf": "scarf red",
  "bin-lid-buckler": "binlid steel dent", "duvet-coat": "puffer white duvet", "trolley-exo": "trolley red",
  "lucky-bus-ticket": "ticket yellow bus", "lukewarm-energy": "can lime +steam", "half-sudoku": "puzzle blue",
  "flapjack-brick": "bar red", "forty-keys": "keyring red", "laminated-clover": "clover green",
  // bouncer
  "eternal-clipboard": "clipboard brown", "velvet-rope-whip": "rope red", "last-orders-bell": "bell gold bracket",
  "judgement-bomber": "jacket black bomber emb:eye ex:40 ey:23 es:.75", "door-puffer": "puffer black", "no-entry-lanyard": "lanyard red",
  "permanent-stamp": "handstamp purple", "eyes-torch": "torch black", "unbreakable-radio": "radio yellow",
  // menace
  "brakeless-scooter": "scooter red e", "wheelie-bin-ram": "bin green", "cone-lance": "cone orange",
  "static-shell-suit": "jacket purple track pc:teal pat2:zap +bolt@tl", "backwards-helmet": "bikehelmet blue", "zero-brake-pads": "kneepad orange",
  "stuck-horn": "horn red", "nitro-squash": "bottle orange", "speeding-tickets": "ticket red stack",
  // mad scientist
  "probably-fine-beaker": "beaker green", "jump-lead-nunchucks": "battery red", "microwave-ray-gun": "microwave white",
  "scorched-lab-coat": "jacket white labcoat pat:soot +fire@tr +steam", "tinfoil-onesie": "suit steel foil", "vacuum-exo": "vacexo red",
  "pocket-bunsen": "flame orange", "shed-rock": "glowrock green", "pickled-brain": "jar green",
  // chaos gremlin
  "mystery-fireworks": "fireworkbag purple", "3am-kebab-skewer": "skewer red", "bad-decision-hammer": "hammer red +nail@br",
  "stained-onesie": "suit green dino pat:stains", "bubble-wrap-plate": "plate cyan bubbles", "sleepless-aura": "aura purple eyes",
  "car-alarm-remote": "fob red", "destiny-gobstopper": "orb pink gob", "cursed-duck": "duck yellow cursed",
  // lollipop warden
  "lollipop-stop-sign": "sign red", "zebra-bo-staff": "staff white zebra", "kerb-justice-stick": "sign pink swirl",
  "visibility-coat": "jacket orange coat pat:hivis close:zip", "crossing-cap": "peakcap black", "belisha-helmet": "helmet orange beacon",
  "kerbside-megaphone": "megaphone red", "green-man-badge": "badge green", "confiscated-sweets": "candy pink",
  // battle librarian
  "dictionary-mace": "book red mace", "overdue-stamp": "datestamp red", "thrown-encyclopaedia": "bookrow blue",
  "pocket-cardigan": "jacket mustard cardigan pk:many", "silence-field": "generator teal", "dust-jacket-armour": "book teal jacket",
  "chain-glasses": "glasses brown", "infinite-library-card": "card blue infinity", "late-returns-ledger": "book black ledger",
  // pigeon king
  "chip-of-command": "chips red", "breadstick-sceptre": "bread tan crown", "angry-pigeons": "pigeon purple angry",
  "feathered-duffel": "jacket camel duffel pat:feathers", "statue-crown": "crown stone stone", "crumb-cloak": "cloak purple pat:crumbs hem:tan",
  "pigeon-union-card": "card orange pigeon", "gravel-crust": "slice tan gravel", "one-eyed-advisor": "pigeon teal patch",
  // rogue courier
  "delivery-bag-flail": "deliverybag teal flail", "haste-lock-chain": "chain orange", "order-ticket-doom": "receipt red",
  "shortcut-poncho": "poncho yellow pat:drops", "smug-cycling-shorts": "shorts blue", "five-star-aura": "aura cyan stars5",
  "secret-shortcut-map": "map tan", "two-percent-phone": "phone black cracked", "golden-notification": "phone gold notify",
  // pickpocket
  "purse-string-scissors": "scissors red", "magnet-on-stick": "magnet red", "deniable-fingers": "pinch red",
  "seventeen-pocket-coat": "jacket brown trench many:1", "nowhere-hoodie": "hoodie black nowhere", "anonymous-moustache": "moustache brown",
  "someone-elses-wallet": "wallet pink", "loaded-dice": "dice red", "taxman-calculator": "calculator black adding",
  // hedge wizard
  "pound-shop-wand": "wand pink +price@br", "scratchcard-shuriken": "shuriken purple", "corner-shop-staff": "staff green shop",
  "shower-curtain-robe": "curtainrobe cyan", "muttering-hood": "hood purple", "crystal-bin-bag": "binbag black",
  "incomplete-tarot": "cards purple gap", "free-paper-horoscope": "newspaper purple", "all-knowing-8-ball": "orb black eight",

  // relic
  "guest-list-damned": "guestlist red damned", "nightclub-door-plate": "plate black door", "ancient-earpiece": "earpiece black",
  "bypass-jousting-scooter": "scooter purple lance", "thousand-skid-leathers": "jacket leather leathers pat:scuffs", "fourteen-point-licence": "card pink licence",
  "particle-whisk": "whisk purple particle", "hazmat-dressing-gown": "jacket lime gown emb:rad ex:24 ey:46 es:1.3", "sentient-petri-dish": "petri purple",
  "shoelace-wrecking-ball": "wreckingball black", "fever-dream-pyjamas": "jacket pink pyjamas pat:moons", "screaming-gnome": "gnome red",
  "rainbow-crossing-pike": "pike purple rainbow", "lighthouse-hivis": "jacket hivis hivis +beam", "whistle-of-ages": "whistle gold ages",
  "card-catalogue-cannon": "catalogue brown", "silent-reading-robes": "robe blue emb:book", "never-returned-first-edition": "book brown first",
  "trafalgar-flock": "flock black column", "monument-mantle": "cloak stone pat:columns clasp:crown", "the-golden-chip": "chip gold",
  "midnight-surge-pricing": "banknote green", "thermal-cube-armour": "deliverybag teal armour", "lost-in-transit": "parcel tan",
  "hundred-heist-glove": "glove purple velvet", "invisible-raincoat": "jacket ice anorak +ghost", "bank-of-england-key": "bigkey gold",
  "ley-line-rod": "dowsing green", "stone-circle-cloak": "cloak green pat:stonering clasp:mistletoe", "certain-tea-leaves": "teacup green",
  // season 1 set
  "s1-trekking-pole": "pole brown bent", "s1-waxed-jacket": "jacket olive waxed pat2:drops", "s1-os-map": "map green wrong",

  // ascendant
  "never-blinked-clipboard": "clipboard gold eye", "kebab-siege-bomber": "jacket maroon bomber emb:kebab ex:40 ey:25", "unwashable-hand-stamp": "handstamp blue foam",
  "phantom-a-road-scooter": "scooter teal ghost", "retail-park-tracksuit": "jacket navy track pc:white", "joyrider-hubcap": "hubcap red",
  "village-fete-blender": "blender red", "shed-professor-coat": "jacket cream labcoat pat:stains emb:clock ex:24 ey:24 +bolt@tr", "allotment-thing-jar": "jar lime thing",
  "house-party-mallet": "hammer purple mallet +confetti", "never-went-to-bed-onesie": "suit blue dino spike:yellow emb:moon ex:40 ey:26", "3am-fridge-magnet": "fridge white",
  "stopped-a-tank-lollipop": "sign red tank", "school-run-hivis": "jacket hivis hivis emb:star ex:40 ey:25", "long-service-badge": "medal red forty",
  "reading-room-atlas": "book green atlas +ghost", "shushed-storm-cardigan": "jacket purple cardigan emb:storm ex:24 ey:28 es:1.2", "county-date-stamp": "datestamp green county",
  "market-square-uprising": "flock red flag", "clock-tower-bench-cloak": "cloak brown pat:slats pat2:feathers clasp:clock", "legendary-dropped-roll": "sausageroll tan",
  "phantom-delivery-receipt": "receipt teal ghost", "ring-road-ghost-rider-bag": "deliverybag black flames", "cemetery-shortcut": "map stone cemetery",
  "high-street-highwayman-glove": "glove black gauntlet", "town-clock-thief-coat": "jacket navy coat emb:clock ex:41 ey:42 es:.9", "market-day-wallet": "wallet purple",
  "retail-park-wise-woman-wand": "wand purple twig", "midnight-car-boot-cloak": "cloak plum pat:moons tag:50p ghost:1", "always-a-pound-scratchcard": "card gold scratch",
  // celestial
  "two-star-velvet-rope": "starrope red", "event-horizon-door": "plate black hole", "big-bang-earpiece": "earpiece black bang",
  "comet-tail-scooter": "scooter cyan comet", "saturn-skid-leathers": "jacket orange leathers emb:saturn ex:24 ey:40 es:1.2", "moon-speeding-ticket": "ticket cyan stack +moon@tr",
  "nebula-test-tube": "testtube purple", "dark-matter-dressing-gown": "jacket void gown pat:starfield trim:purple", "jam-jar-black-hole": "jar black jam",
  "bungee-meteor": "bungee yellow", "cosmic-bad-idea-pyjamas": "jacket navy pyjamas pat:stars", "wormhole-rubber-duck": "duck yellow +cosmic +swirl@tl",
  "moon-stop-sign": "sign red moon", "alpha-centauri-hivis": "jacket hivis hivis +cosmic +stars", "shooting-star-sweets": "candy yellow stars",
  "dewey-decimal-stars": "bookrow navy stars", "silent-void-robes": "robe void pat:starfield trim:purple belt:purple", "milky-way-library-card": "card purple galaxy",
  "lunar-flock": "flock white moon", "milky-way-crumb-mantle": "cloak void pat:starfield pat2:galaxycrumbs", "suns-own-chip": "chips red sun",
  "interstellar-surcharge": "receipt cyan planet", "small-sun-thermal-bag": "deliverybag orange sun", "galactic-rider-app": "phone black galaxy",
  "moon-pull-magnet": "magnet cyan moon", "dark-side-hoodie": "hoodie slate half emb:moon", "black-hole-dice": "dice purple void",
  "pound-shop-star-staff": "staff gold star", "mercury-retrograde-hat": "wizhat navy +retro@tr", "galaxy-shuffled-tarot": "cards cyan star",
  // eternal
  "end-of-time-guest-list": "guestlist gold time", "first-door-armour": "doorplate brown", "stamp-of-creation": "handstamp gold star +stars",
  "big-bang-scooter": "scooter red bang", "infinite-static-shell-suit": "jacket gold track pc:purple pat2:lightning +stars", "last-traffic-cone": "cone orange +gold +sparkle",
  "universe-microwave": "microwave black universe", "original-experiment-coat": "jacket white labcoat emb:atom ex:24 ey:24 es:1.4 +gold +sparkle", "primordial-soup": "soup green",
  "reality-hammer": "hammer gold +cracks", "never-slept-ever-aura": "aura void void +cosmic +stars", "snack-before-time": "crisps purple +stars",
  "time-stopping-lollipop": "sign gold clock", "first-beacon-helmet": "helmet gold beacon +gold", "green-man-of-creation": "crossing green +stars",
  "book-before-words": "book gold runes", "aura-of-the-first-shush": "aura gold shush", "universe-overdue-notice": "overdue red +stars",
  "the-first-pigeon": "flock gold halo", "every-statue-crown": "crown gold stone", "crumb-of-all-bread": "crumb tan",
  "bill-for-everything": "receipt black long", "first-order-bag": "deliverybag gold +gold", "end-of-time-notification": "phone purple hourglass",
  "first-light-fingers": "pinch gold light", "universe-disguise-moustache": "moustache black +cosmic +stars", "spare-key-to-existence": "bigkey steel cosmic",
  "wished-universe-wand": "wand gold galaxy", "first-hedge-cloak": "cloak green pat:leaves clasp:leaf edge:leaf", "shows-everything-ball": "orb purple crystal +stars",

  // open market
  "m-bin-lid-of-reckoning": "binlid red", "m-doorstop-with-intent": "doorstop steel", "m-selfie-stick-extended": "selfie green",
  "m-laminated-bus-timetable": "timetable red", "m-lucky-fish-slice": "fishslice yellow", "m-builders-tabard": "jacket orange hivis pk:chest",
  "m-double-lined-parka": "jacket olive parka", "m-shell-suit-swishy": "jacket teal track pc:pink", "m-charity-shop-tweed": "jacket tweed blazer pat:tweed tag:£3",
  "m-novelty-christmas-jumper": "jacket red jumper pat:xmas", "m-wristband-from-a-gig": "wristband red", "m-plaster-on-the-knee": "plaster tan",
  "m-fidget-spinner": "spinner green", "m-gold-star-sticker": "sticker gold", "m-four-leaf-clover-laminated": "clover green tag",
  "m-garden-fork-bent": "gardenfork red", "m-riot-shield-tray": "tray steel", "m-hockey-stick-taped": "hockeystick green",
  "m-encyclopaedia-volume-k": "book purple volk", "m-raffle-prize-rolling-pin": "rollingpin yellow", "m-welders-apron": "apron brown",
  "m-motorbike-leathers": "jacket black leathers pat:racing", "m-running-club-vest": "jacket green singlet", "m-professors-cardigan": "jacket brown cardigan pens:1 elbow:1",
  "m-lucky-rugby-shirt": "jacket green rugby pc:yellow", "m-medal-from-sports-day": "medal blue", "m-whistle-on-a-lanyard": "whistle red lanyard",
  "m-stopwatch-cracked": "stopwatch green", "m-pocket-calculator": "calculator purple", "m-bingo-dabber": "dabber pink",
  "m-sledgehammer-from-the-shed": "hammer rust +web@br", "m-lollipop-sign-reinforced": "sign red rivets", "m-carbon-walking-pole": "pole blue carbon",
  "m-chess-clock-flail": "chessclock purple", "m-pub-quiz-trophy": "trophy gold", "m-scaffolders-harness": "harness orange",
  "m-riot-van-padding": "jacket navy hivis pat:battenburg collar:crew", "m-fell-runners-shell": "jacket orange shell", "m-archivists-gown": "robe brown papers:1 nobelt:1",
  "m-casino-waistcoat": "jacket red waistcoat btn:gold pat:diamonds pc:maroon", "m-knuckleduster-keyring": "knuckles red", "m-st-christopher-pendant": "pendant gold",
  "m-energy-gel-unopened": "gel green", "m-crossword-pen": "pen blue", "m-horseshoe-upside-up": "horseshoe steel",
  "m-caber-from-the-highland-games": "caber brown", "m-beefeaters-halberd": "halberd red", "m-royal-mail-sorting-whip": "whip red post",
  "m-bletchley-codebook": "book navy cipher", "m-grand-national-riding-crop": "crop brown", "m-coal-miners-jacket": "jacket coal donkey pat:soot",
  "m-lifeboat-crew-drysuit": "suit orange dry", "m-channel-swimmers-grease": "tub blue", "m-dons-gown-from-oxford": "robe black gown",
  "m-lottery-winners-dressing-gown": "jacket purple gown pat:coins trim:gold", "m-prize-bulls-rosette": "rosette red", "m-lighthouse-lens-shard": "lens cyan",
  "m-pigeon-racing-ring": "legring red", "m-enigma-rotor": "rotor steel", "m-wishing-well-penny": "penny brown",
  "m-hammer-of-the-green-man": "hammer green bark", "m-shield-oar-of-the-last-viking": "oar red", "m-spring-heeled-jacks-cane": "cane black",
  "m-merlins-lecture-notes": "book blue notes", "m-black-dogs-lead": "lead black", "m-giants-causeway-plate": "plate stone pat:hex cut:hex",
  "m-armour-of-the-lambton-worm": "plate green pat:scales cut:scale", "m-wild-hunt-riding-cloak": "cloak maroon clasp:antler fur:1 edge:tatter", "m-druids-mistletoe-robe": "robe white emb:mistletoe trim:green belt:green ink:1",
  "m-selkies-sealskin-coat": "jacket slate coat pat:spots", "m-kelpies-bridle": "bridle teal", "m-witch-bottle-from-a-chimney": "witchbottle brown",
  "m-will-o-the-wisp-in-a-jar": "jar cyan wisp", "m-merlins-spectacles": "glasses gold +glow +stars", "m-hares-foot-of-the-moor": "harefoot tan",
  "m-hammer-from-the-first-forge": "hammer orange smith", "m-hadrians-gatepost": "gatepost stone", "m-ley-line-divining-rod": "dowsing teal l",
  "m-book-of-the-long-count": "book brown tally", "m-wheel-of-the-last-ferryman": "shipwheel brown", "m-sutton-hoo-helm-and-mail": "suttonhoo bronze",
  "m-mail-of-the-round-table": "jacket steel mail emb:table ex:32 ey:30 es:1.3", "m-cloak-of-the-long-walkers": "cloak green pat:road pat2:footsteps edge:tatter hem:khaki", "m-robe-of-the-standing-stones": "robe stone pat:stones trim:green",
  "m-fools-motley-of-fortune": "motley red pc:yellow", "m-tooth-of-the-lambton-worm": "tooth bone", "m-stone-from-stonehenge-small": "trilithon stone",
  "m-bell-from-a-drowned-church": "bell bronze drowned", "m-astrolabe-of-the-long-count": "astrolabe gold", "m-coin-from-the-ferryman": "penny bronze ferry",
  "m-thunderclap-mallet": "hammer blue mallet +bolt@br", "m-cloudbreaker-pike": "pike sky cloud", "m-jet-stream-fan": "handfan cyan",
  "m-weather-station-almanac": "book orange almanac", "m-rainbows-end-whip": "whip gold rainbow", "m-stormfront-plate": "plate slate emb:storm cut:jag",
  "m-hailstone-hauberk": "jacket ice mail pat2:hail", "m-slipstream-suit": "suit cyan skin pc:white", "m-aurora-scholars-robe": "robe navy pat:aurora",
  "m-cloud-nine-smoking-jacket": "jacket sky smoking pat:clouds trim:navy", "m-lightning-in-a-bottle": "lightbottle yellow", "m-kite-line-to-heaven": "kite red",
  "m-swifts-feather": "feather slate", "m-barometer-brooch": "barometer gold", "m-sunbeam-through-cloud": "sunbeam yellow",
  "m-meteorite-maul": "hammer orange maul", "m-polestar-lance": "lance navy star", "m-comet-tail-whip": "whip cyan comet",
  "m-star-chart-of-the-walkers": "map navy stars", "m-shooting-star-wand": "wand yellow trail", "m-eclipse-plate": "plate black emb:eclipse es:1.6",
  "m-armour-of-the-plough": "plate navy emb:plough es:2", "m-orbit-cut-suit": "suit white space gloves:steel", "m-astronomers-robe": "robe navy pat:stars emb:moon",
  "m-zodiac-coat": "jacket purple coat emb:zodiac ex:24 ey:26 es:1.1", "m-neutron-star-locket": "pendant gold heart", "m-moon-rock-charm": "moonrock stone",
  "m-pulsar-pocket-watch": "pocketwatch cyan", "m-planisphere-pin": "planisphere navy", "m-lucky-star-actual": "star gold",
  "m-hammer-that-struck-midnight": "hammer black clock", "m-gate-of-the-last-morning": "fivebar wood", "m-hand-of-the-first-clock": "clockhand gold",
  "m-ledger-of-every-step": "book maroon steps", "m-thread-of-fate-frayed": "spool red", "m-armour-of-the-unmoving-hour": "plate gold emb:hourglass es:1.6",
  "m-shell-of-the-world-turtle": "turtleshell green", "m-coat-of-the-endless-road": "jacket brown coat pat:road close:none", "m-robe-woven-from-tomorrow": "robe purple pat:clocks emb:sun",
  "m-mantle-of-the-last-lucky-break": "cloak grass clasp:clover hem:gold emb:horseshoe ex:32 ey:42 es:1.3", "m-heart-of-the-long-count": "heart red", "m-keystone-of-the-sky": "keystone stone",
  "m-hourglass-of-spare-seconds": "hourglass cyan", "m-the-final-footnote": "quill red", "m-wish-that-came-true": "chime pink",
};
const SLOT_MOTIF = { weapon: "blade", armour: "plate", trinket: "gem" };
const LOOK_MOTIF = { sword: "blade", club: "bat", staff: "staff", wand: "wand", umbrella: "umbrella", bat: "cricketbat", book: "book", spoon: "spork", bag: "sack", hammer: "hammer", fan: "handfan", whip: "whip",
  vest: "jacket", plate: "plate", robe: "robe", hoodie: "hoodie", coat: "jacket", amulet: "pendant", badge: "badge", orb: "orb", bell: "bell", feather: "feather", charm: "clover" };
const STYLE_TINT = { power: "red", guard: "steel", speed: "green", brains: "purple", luck: "yellow" };
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

function parseRow(row) {
  const t = row.split(" "), r = { motif: t[0], tint: t[1], variant: "", o: {}, ov: [] };
  for (const k of t.slice(2)) {
    if (k[0] === "+") r.ov.push(k.slice(1));
    else if (k.includes(":")) { const i = k.indexOf(":"); r.o[k.slice(0, i)] = k.slice(i + 1); }
    else if (!r.variant) r.variant = k;
  }
  return r;
}
function resolve(item) {
  const id = typeof item === "string" ? item : (item && item.id) || "";
  if (ITEM_ART[id]) return parseRow(ITEM_ART[id]);
  if (/^s\d+-/.test(id) && !/^s1-/.test(id)) return seasonResolve(item);
  // Gear added later without a row: drawn from what it looks like, coloured by its style.
  if (item && item.look && LOOK_MOTIF[item.look]) return { motif: LOOK_MOTIF[item.look], tint: STYLE_TINT[item.market] || "gold", variant: item.look === "vest" ? "hivis" : "", o: {}, ov: [] };
  const slot = (item && item.slot) || "trinket";
  return { motif: SLOT_MOTIF[slot] || "gem", tint: TINT_ORDER[hash(id) % TINT_ORDER.length], variant: "", o: {}, ov: [] };
}
// Dark gear gets a cool rim outside its ink line so it never melts into a dark card.
const DARK_MOTIF = { earpiece: 1 };
const halo = (body) => {
  const k = nid();
  return `<filter id="${k}" x="-8%" y="-8%" width="116%" height="116%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#a9b8f0" flood-opacity=".8"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><g filter="url(#${k})">${body}</g>`;
};
function artRaw(motif, tint, size, variant, o, ov) {
  const fn = M[motif] || M.gem, q = T[tint] || P[tint] || T.gold;
  let body = fn(q, variant || "", o || {});
  if (ov && ov.length) body = overlay(body, ov, q);
  if (luma(q.b) < .36 || DARK_MOTIF[motif]) body = halo(body);
  size = size || 64;
  return `<svg ${NS} viewBox="0 0 64 64" width="${size}" height="${size}" focusable="false" aria-hidden="true">${body}</svg>`;
}
const art = (...a) => uniq(artRaw(...a));
const artCache = {};
function item(it, size) {
  const r = resolve(it), key = (typeof it === "string" ? it : (it && it.id) || "") + "|" + (size || 64);
  return uniq(artCache[key] || (artCache[key] = artRaw(r.motif, r.tint, size, r.variant, r.o, r.ov)));
}

/* ------------------------------------------------------------------ */
/* 3) Currency badges                                                    */
/* ------------------------------------------------------------------ */
function coin(size) {
  size = size || 20;
  const face = pal("#ffc83d", "#e8961f", "#fff3a8");
  const body = `<circle cx="32" cy="35.5" r="26.5" fill="#b8620e" stroke="${INK}" stroke-width="3.2"/>` +
    S(C(32, 31, 26.5), face, { a: 3.6, b: 2.6, hw: 2.4, sw: 3.2 }) +
    `<circle cx="32" cy="31" r="19" fill="#f7b52c" stroke="#c9770f" stroke-width="2.4"/>` +
    `<path d="M15.6 22A19 19 0 0 1 44 15.6" fill="none" stroke="#d98a1c" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M48.4 40A19 19 0 0 1 20 46.4" fill="none" stroke="#fff3a8" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
    `<path transform="translate(33.4 32.6) rotate(12) scale(.92)" d="${FOOT}" fill="#c9770f"/>` +
    `<path transform="translate(32 31) rotate(12) scale(.92)" d="${FOOT}" fill="#fff0b0"/>` +
    `<path transform="translate(32.5 31.6) rotate(12) scale(.92)" d="${FOOT}" fill="#ffd45a"/>` +
    Gl(18.5, 17.5, 6, 2.6, -42, .9) + Sp(50, 11, 5);
  return uniq(`<svg ${NS} viewBox="0 0 64 64" width="${size}" height="${size}" focusable="false" aria-hidden="true">${body}</svg>`);
}
function gem(size) {
  size = size || 20;
  // An Endeavour: a crystal shuriken. Four blades, each split into a lit and a shaded facet, round a hole.
  const tips = [[32, 3], [61, 32], [32, 61], [3, 32]], inner = [[40.5, 23.5], [40.5, 40.5], [23.5, 40.5], [23.5, 23.5]];
  const lit = ["#c8f6ff", "#7fe0ff", "#45b9f5", "#9becff"], dark = ["#2f9be8", "#1f86dc", "#1559b8", "#2a8fe0"];
  const star = tips.map((t, k) => `L${t[0]} ${t[1]}L${inner[k][0]} ${inner[k][1]}`).join("").replace(/^L/, "M") + "Z";
  let facets = "";
  tips.forEach((t, k) => {
    const a = inner[(k + 3) % 4], b = inner[k];
    facets += `<path d="M32 32L${a[0]} ${a[1]}L${t[0]} ${t[1]}Z" fill="${lit[k]}"/><path d="M32 32L${t[0]} ${t[1]}L${b[0]} ${b[1]}Z" fill="${dark[k]}"/>`;
  });
  const body =
    `<path d="${star}" fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` + facets +
    `<path d="M32 32L32 3M32 32L61 32M32 32L32 61M32 32L3 32" stroke="${INK}" stroke-width="1.2" opacity=".3"/>` +
    `<path d="${star}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="32" cy="32" r="7.5" fill="#0d1a3a" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="32" r="7.5" fill="none" stroke="#c8f6ff" stroke-width="1.6" opacity=".7"/>` +
    `<path d="M29 9L31 22" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
    Sp(50, 12, 4.5) + Sp(13, 50, 3);
  return uniq(`<svg ${NS} viewBox="0 0 64 64" width="${size}" height="${size}" focusable="false" aria-hidden="true">${body}</svg>`);
}

root.Icons = {
  ui, coin, gem, item,
  art,                                   // art(motif, tint, size, variant) for previews
  names: Object.keys(UI),
  motifs: Object.keys(M),
  tints: Object.keys(T),
  ITEM_ART,
  resolve,
};
})(typeof window !== "undefined" ? window : globalThis);
