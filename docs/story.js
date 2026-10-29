// Effort story player: a click-through, Pokémon / visual-novel style scene player for the season chapters.
// Self-contained: draws its own backgrounds and story-character portraits (SVG/CSS), injects its own CSS,
// needs no images and no network. Content lives in stories.js; this file only plays it.
//
// API (window.EffortStory)
//   EffortStory.play(script, opts) -> Promise resolving to
//       { done: true, flags }     the script ran to the end
//       { skipped: true, flags }  the player tapped Skip
//       { closed: true, flags }   EffortStory.close() was called (e.g. the app's back gesture)
//   EffortStory.close()           close the overlay now (resolves the open promise with { closed: true })
//   EffortStory.isOpen()          true while the overlay is up
//   EffortStory.validate(script)  -> array of error strings (empty when the script is fine)
//   EffortStory.fill(text, ctx)   fill the {you}/{squad}/{mate}/{mate2}/{steps} placeholders
//   EffortStory.BACKGROUNDS       names of the built-in backgrounds
//   EffortStory.NPCS              keys of the built-in story characters (portraits drawn here)
//
//   opts = {
//     ctx: { you: "Sam", squad: "The Fell Runners", mates: ["Alex", "Jo"], steps: 12345 },
//     portrait(who) -> HTML string | Element | null   who is "you", "mate:<name>" or "boss:<id>" (incl. "boss:taxman");
//                                                     return null to use the built-in drawing
//     flagKey: "effort.story.flags",   localStorage key for choice flags (one JSON object)
//     title: "Chapter 3 · The Tor",    small label top left
//     speed: 55,                       typewriter characters per second
//   }
//
// Script format: an array of steps. Each step is one tap unless it says otherwise.
//   { bg: "lighthouse-night" }                       change the scene (no tap). May be combined with a line.
//   { who: "Morwenna", text: "…" }                   a story character speaks (see NPCS; unknown names get a drawn stranger)
//   { who: "Guide", name: "Museum guide", text }     `name` overrides the name tag; a name of "???" shows a silhouette
//   { who: "you", text: "…" }                        the player
//   { who: "mate", text: "…" }                       a random squad-mate (the same one as {mate}); "mate2" is another one
//   { who: "mate:Alex", text: "…" }                  a named squad-mate
//   { who: "boss:notification", text: "…" }          a boss: notification, autoplay, leftonread, scroll, kraken,
//                                                    algorithm, dragon, taxman, and the event bosses newyear, spring,
//                                                    solstice, harvest, haunted, krampus. Aliases: "Brett", "Grimm"…
//   { narrate: "…" }                                 narration, no speaker
//   { fx: "shake" | "flash" | "dark" | "light" | "glitch" | "fade" }   no tap. "dark" dims the scene until "light"
//                                                    or the next bg; "fade" dips to black (put the next bg after it)
//   { card: "Chapter 1", sub: "The Long Count" }     a full-screen title card (one tap)
//   { choice: [{ label, then: [steps], flag }], who?, text? }   2–3 buttons; the optional who/text is the question.
//                                                    Picking one plays its `then`, and sets `flag` if given
//   { if: "flag", then: [steps], else: [steps] }     branch on a stored flag. "!flag" negates; "a|b" any; "a&b" all
//   { set: "flag" } / { unset: "flag" }              set or clear a flag without a choice (no tap)
// Text may use *emphasis* and the placeholders {you}, {squad}, {mate}, {mate2}, {steps}, filled from opts.ctx.
(function (root) {
"use strict";
const HAS_DOM = typeof window !== "undefined" && typeof document !== "undefined" && !!document.createElement;

// ---------- small utils ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let uid = 0;
const f1 = (n) => Math.round(n * 10) / 10;

// ---------- backgrounds ----------
// Each scene: sky (CSS background), svg (drawn in a 400×700 box, anchored to the bottom so phones see the ground),
// layers (animated CSS overlays: fog, snow, rain, aurora, wind, rays, motes).
const VB = (inner) => `<svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;
function starsSVG(n, seed, maxY = 380) {
  const r = rng(seed); let s = "";
  for (let i = 0; i < n; i++) {
    const tw = r() < 0.3;
    s += `<circle cx="${f1(r() * 400)}" cy="${f1(r() * maxY)}" r="${f1(r() * 1.1 + 0.35)}" fill="#fff" opacity="${f1(0.35 + r() * 0.6)}"${tw ? ` class="es-tw" style="animation-delay:${f1(r() * 3)}s"` : ""}/>`;
  }
  return s;
}
// A row of houses with lit windows. blue = share of windows glowing phone-blue (the rest warm or dark).
function housesSVG(seed, { base = 470, blue = 0.7, fill = "#0a0f24", minH = 90, maxH = 170, x0 = -12, w = 52, count = 9, roofs = true } = {}) {
  const r = rng(seed); let s = "";
  for (let i = 0; i < count; i++) {
    const x = x0 + i * w, h = minH + r() * (maxH - minH), top = base - h, ww = w - 2;
    s += `<rect x="${f1(x)}" y="${f1(top)}" width="${ww}" height="${f1(h)}" fill="${fill}"/>`;
    if (roofs && r() < 0.7) s += `<path d="M${f1(x - 2)} ${f1(top)} L${f1(x + ww / 2)} ${f1(top - 16 - r() * 10)} L${f1(x + ww + 2)} ${f1(top)} Z" fill="${fill}"/>`;
    if (r() < 0.35) s += `<rect x="${f1(x + ww * 0.7)}" y="${f1(top - 22)}" width="6" height="16" fill="${fill}"/>`;
    for (let wy = top + 12; wy < base - 18; wy += 24) for (let wx = x + 8; wx < x + ww - 10; wx += 16) {
      const k = r();
      if (k < 0.18) continue;
      const col = k < 0.18 + blue * 0.82 ? "#5fb8ff" : "#ffbe5c";
      s += `<rect x="${f1(wx)}" y="${f1(wy)}" width="8" height="11" rx="1" fill="${col}" class="es-win" style="animation-delay:${f1(r() * 5)}s"/>`;
    }
  }
  return s;
}
function pinesSVG(seed, { n = 14, base = 470, fill = "#0a1a16", minH = 60, maxH = 150, y0 = 0 } = {}) {
  const r = rng(seed); let s = "";
  for (let i = 0; i < n; i++) {
    const x = r() * 420 - 10, h = minH + r() * (maxH - minH), b = base + y0 + r() * 20, w = h * 0.32;
    s += `<path d="M${f1(x)} ${f1(b - h)} L${f1(x + w)} ${f1(b)} L${f1(x - w)} ${f1(b)} Z" fill="${fill}"/>`;
  }
  return s;
}
const SEA = (y, c1, c2) => `<defs><linearGradient id="es-sea${y}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="0" y="${y}" width="400" height="${700 - y}" fill="url(#es-sea${y})"/>`;
const WAVES = (y, col, seed) => { const r = rng(seed); let s = ""; for (let i = 0; i < 14; i++) { const x = r() * 400, yy = y + 8 + r() * 120, w = 14 + r() * 30; s += `<path d="M${f1(x)} ${f1(yy)} q${f1(w / 2)} -4 ${f1(w)} 0" stroke="${col}" stroke-width="1.6" fill="none" opacity="${f1(0.3 + r() * 0.5)}" class="es-bob" style="animation-delay:${f1(r() * 4)}s"/>`; } return s; };
const MOON = (x, y, r = 20, c = "#eef1ff") => `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${c}" opacity=".07"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".92"/>`;

const BG = {
  "lighthouse-night": { sky: "linear-gradient(180deg,#040716 0%,#0d1736 55%,#1b2b5a 100%)", layers: ["fog-light"], svg: () => VB(
    starsSVG(70, 11) + MOON(318, 108, 18) + SEA(445, "#0c1636", "#050a1c") + WAVES(445, "#2a4590", 3) +
    `<path d="M240 452 Q290 430 336 436 Q376 430 400 440 L400 454 L240 454 Z" fill="#0a1128"/>` +
    [262, 276, 296, 318, 352].map((x, i) => `<rect x="${x}" y="${436 + (i % 2) * 4}" width="5" height="5" fill="#5fb8ff" class="es-win" style="animation-delay:${i * 0.7}s"/>`).join("") +
    `<path d="M0 700 L0 398 Q44 382 92 390 Q140 384 176 398 Q204 418 214 452 L232 700 Z" fill="#060a1b"/>` +
    `<rect x="150" y="372" width="34" height="22" fill="#0b1126"/><path d="M146 372 L167 358 L188 372 Z" fill="#0b1126"/><rect x="156" y="378" width="7" height="8" fill="#ffbe5c"/>` +
    `<defs><linearGradient id="es-bm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d4ecff" stop-opacity=".7"/><stop offset="1" stop-color="#d4ecff" stop-opacity="0"/></linearGradient></defs>` +
    `<g class="es-beam" style="transform-origin:122px 276px"><path d="M122 276 L440 226 L440 326 Z" fill="url(#es-bm)"/></g>` +
    `<path d="M107 392 L112 290 L132 290 L137 392 Z" fill="#e9e4d6"/><path d="M110 330 L134 330 L135 346 L109 346 Z" fill="#b23a3a"/><path d="M108 362 L136 362 L136.6 376 L107.4 376 Z" fill="#b23a3a"/>` +
    `<rect x="105" y="284" width="34" height="6" fill="#262b40"/><rect x="112" y="266" width="20" height="18" fill="#d4ecff" class="es-lamp"/><path d="M108 266 L122 252 L136 266 Z" fill="#262b40"/>`) },
  "town-glow": { sky: "linear-gradient(180deg,#05060f 0%,#10132e 60%,#1b1e44 100%)", layers: [], svg: () => VB(
    starsSVG(40, 21, 260) + MOON(70, 90, 14, "#dfe4ff") + housesSVG(5, { base: 480, blue: 0.85, fill: "#090c1e", minH: 140, maxH: 230 }) +
    `<rect x="0" y="480" width="400" height="220" fill="#06081a"/><rect x="0" y="482" width="400" height="3" fill="#1a2350"/>` +
    `<rect x="318" y="392" width="4" height="90" fill="#151a33"/><circle cx="320" cy="390" r="7" fill="#ffcf7a" opacity=".9"/><circle cx="320" cy="390" r="26" fill="#ffcf7a" opacity=".08"/>`) },
  "moor-fog": { sky: "linear-gradient(180deg,#5d6878 0%,#3d4858 55%,#2c3542 100%)", layers: ["fog", "fog2"], svg: () => VB(
    `<path d="M0 470 Q80 430 160 446 Q250 420 330 440 Q370 432 400 438 L400 700 L0 700 Z" fill="#2d382d"/>` +
    `<path d="M70 438 L80 404 L92 410 L98 392 L112 400 L118 436 Z" fill="#1f2622"/><path d="M262 432 L270 408 L286 398 L296 412 L306 404 L314 430 Z" fill="#1f2622"/>` +
    `<path d="M0 520 Q120 490 220 506 Q320 486 400 500 L400 700 L0 700 Z" fill="#253025"/>` +
    `<g fill="#151a16"><ellipse cx="190" cy="500" rx="10" ry="6"/><rect x="183" y="500" width="2" height="10"/><rect x="195" y="500" width="2" height="10"/><circle cx="202" cy="494" r="4"/></g>`) },
  "tor-sunset": { sky: "linear-gradient(180deg,#2a1a4a 0%,#7c3456 35%,#d0603e 62%,#f6a84b 100%)", layers: ["motes"], svg: () => VB(
    `<circle cx="300" cy="400" r="36" fill="#ffd27a" opacity=".85"/>` +
    `<path d="M0 470 Q120 452 170 410 Q200 366 230 366 Q262 370 290 420 Q330 462 400 470 L400 700 L0 700 Z" fill="#2a1630"/>` +
    `<rect x="220" y="320" width="16" height="48" fill="#1c0f22"/><path d="M218 320 L228 304 L238 320 Z" fill="#1c0f22"/>` +
    `<path d="M0 520 L400 520 L400 700 L0 700 Z" fill="#1c0f22"/>` +
    [40, 70, 92, 330, 356].map((x) => `<path d="M${x} 482 L${x + 12} 466 L${x + 24} 482 Z" fill="#3a2040"/>`).join("")) },
  "bridge-night": { sky: "linear-gradient(180deg,#060818 0%,#141a3c 60%,#232a58 100%)", layers: ["fog-light"], svg: () => VB(
    starsSVG(45, 31, 300) + MOON(330, 90, 13) +
    `<path d="M60 400 Q200 420 340 400 L340 700 L60 700 Z" fill="#0d1330"/><path d="M90 470 Q200 480 300 470" stroke="#1c2650" stroke-width="2" fill="none"/>` +
    `<path d="M0 700 L0 360 Q30 350 60 362 L96 380 L120 700 Z" fill="#0b0f22"/><path d="M400 700 L400 350 Q360 346 330 362 L292 380 L270 700 Z" fill="#0b0f22"/>` +
    `<rect x="82" y="300" width="14" height="90" fill="#151b38"/><rect x="300" y="300" width="14" height="90" fill="#151b38"/>` +
    `<path d="M89 304 Q197 420 307 304" stroke="#c9d3ff" stroke-width="2" fill="none" opacity=".75"/><rect x="60" y="388" width="280" height="6" fill="#151b38"/>` +
    Array.from({ length: 13 }, (_, i) => { const x = 104 + i * 15, y = 304 + 116 * (1 - Math.pow((x - 198) / 109, 2)) * 0.98; return `<line x1="${x}" y1="${f1(Math.min(y, 388))}" x2="${x}" y2="388" stroke="#c9d3ff" stroke-width=".8" opacity=".5"/>`; }).join("") +
    Array.from({ length: 12 }, (_, i) => `<circle cx="${70 + i * 24}" cy="386" r="1.8" fill="#ffd27a"/>`).join("") +
    `<rect x="56" y="370" width="22" height="18" fill="#1a2040"/><rect x="60" y="374" width="14" height="8" fill="#6cc0ff" class="es-lamp"/>` +
    `<path d="M120 620 Q200 600 270 620 L270 700 L120 700 Z" fill="#0c1430"/>`) },
  "gorge-night": { sky: "linear-gradient(180deg,#070a1a 0%,#152040 60%,#20305a 100%)", layers: ["fog-light"], svg: () => VB(
    starsSVG(35, 41, 260) +
    `<path d="M0 470 L0 300 Q60 320 110 380 L150 470 Z" fill="#0b1426"/><path d="M400 470 L400 290 Q330 320 290 380 L250 470 Z" fill="#0b1426"/>` +
    pinesSVG(7, { n: 9, base: 380, fill: "#08101e", minH: 30, maxH: 60 }) +
    `<path d="M120 452 A80 64 0 0 1 280 452" stroke="#7a2e1e" stroke-width="7" fill="none"/><path d="M128 452 A72 56 0 0 1 272 452" stroke="#a04428" stroke-width="2" fill="none"/>` +
    `<rect x="110" y="386" width="180" height="6" fill="#5a2418"/>` + Array.from({ length: 9 }, (_, i) => `<line x1="${130 + i * 18}" y1="392" x2="${130 + i * 18}" y2="${452 - Math.round(56 * Math.sin(Math.acos(((130 + i * 18) - 200) / 80)))}" stroke="#7a2e1e" stroke-width="1.5"/>`).join("") +
    SEA(452, "#13244a", "#070d20") + WAVES(452, "#3a5aa0", 4) +
    housesSVG(9, { base: 300, blue: 0.6, fill: "#0b1426", minH: 20, maxH: 40, x0: 300, w: 26, count: 4, roofs: true })) },
  "peak-cloud": { sky: "linear-gradient(180deg,#8fa3c4 0%,#b9c6dc 50%,#dfe5ef 100%)", layers: ["fog"], svg: () => VB(
    `<path d="M40 470 L170 250 L196 270 L214 236 L360 470 Z" fill="#4c5566"/><path d="M170 250 L196 270 L214 236 L236 280 L206 300 L188 284 L160 300 Z" fill="#eef2f8"/>` +
    `<path d="M206 236 l8 -16 l8 16 Z" fill="#3a4250"/><rect x="200" y="226" width="22" height="10" fill="#3a4250"/>` +
    `<g fill="#f4f6fb" opacity=".95"><ellipse cx="60" cy="470" rx="110" ry="28"/><ellipse cx="220" cy="488" rx="150" ry="32"/><ellipse cx="370" cy="470" rx="100" ry="26"/><rect x="0" y="486" width="400" height="214"/></g>`) },
  "viaduct-night": { sky: "linear-gradient(180deg,#05071a 0%,#121a3e 60%,#26305e 100%)", layers: ["fog-light"], svg: () => VB(
    starsSVG(55, 51, 300) + MOON(80, 110, 20) +
    `<path d="M0 470 Q100 400 200 430 Q300 395 400 440 L400 700 L0 700 Z" fill="#0d1428"/>` +
    `<rect x="0" y="330" width="400" height="18" fill="#141b36"/>` +
    Array.from({ length: 9 }, (_, i) => { const x = i * 48 - 8; return `<path d="M${x} 348 L${x + 48} 348 L${x + 48} 470 L${x + 40} 470 L${x + 40} 400 A16 22 0 0 0 ${x + 8} 400 L${x + 8} 470 L${x} 470 Z" fill="#141b36"/>`; }).join("") +
    `<rect x="230" y="310" width="70" height="20" rx="3" fill="#1d2448"/><rect x="236" y="314" width="10" height="7" fill="#ffbe5c"/><rect x="252" y="314" width="10" height="7" fill="#ffbe5c"/><rect x="268" y="314" width="10" height="7" fill="#ffbe5c"/>` +
    `<rect x="300" y="306" width="40" height="24" rx="3" fill="#10142a"/><rect x="330" y="290" width="7" height="16" fill="#10142a"/><circle cx="342" cy="318" r="5" fill="#ff8a3a" opacity=".9"/>` +
    `<g fill="#cfd6ef" opacity=".35"><circle cx="334" cy="278" r="9"/><circle cx="324" cy="262" r="12"/><circle cx="306" cy="246" r="15"/></g>`) },
  "wall-dusk": { sky: "linear-gradient(180deg,#2b2350 0%,#6a4a78 40%,#d0806a 75%,#f2b27a 100%)", layers: ["wind"], svg: () => VB(
    `<path d="M0 450 Q90 400 170 430 Q260 390 330 420 Q370 410 400 418 L400 700 L0 700 Z" fill="#3a3550"/>` +
    `<path d="M0 448 Q90 398 170 428 Q260 388 330 418 Q370 408 400 416" stroke="#9aa0b4" stroke-width="7" fill="none"/><path d="M0 446 Q90 396 170 426 Q260 386 330 416 Q370 406 400 414" stroke="#c3c7d4" stroke-width="2" fill="none" stroke-dasharray="6 5"/>` +
    `<path d="M0 520 Q140 480 260 500 Q340 486 400 494 L400 700 L0 700 Z" fill="#2a2640"/>` +
    `<rect x="250" y="384" width="26" height="22" fill="#2a2640"/><rect x="256" y="388" width="5" height="7" fill="#ffbe5c"/>`) },
  "city-night": { sky: "linear-gradient(180deg,#05061a 0%,#141844 55%,#2a2a5a 100%)", layers: ["fog-light"], svg: () => VB(
    starsSVG(30, 61, 220) + MOON(330, 80, 12) +
    `<path d="M0 470 L0 330 Q40 300 70 320 L96 300 L110 330 L130 470 Z" fill="#0a0c22"/><rect x="40" y="290" width="40" height="40" fill="#0a0c22"/><rect x="46" y="276" width="8" height="16" fill="#0a0c22"/><rect x="66" y="276" width="8" height="16" fill="#0a0c22"/>` +
    housesSVG(15, { base: 470, blue: 0.75, fill: "#0c0f28", minH: 70, maxH: 170, x0: 120, w: 34, count: 9 }) +
    `<path d="M210 300 L216 230 L222 300 Z" fill="#0c0f28"/><path d="M300 290 L306 214 L312 290 Z" fill="#0c0f28"/>` +
    `<rect x="0" y="470" width="400" height="230" fill="#070820"/>`) },
  "glen-snow": { sky: "linear-gradient(180deg,#3a4466 0%,#6a7894 55%,#a9b6c9 100%)", layers: ["snow", "snow2"], svg: () => VB(
    `<path d="M-20 470 L60 330 L120 470 Z" fill="#3c4660"/><path d="M110 470 L220 230 L330 470 Z" fill="#46506c"/><path d="M220 230 L250 300 L232 296 L214 320 L196 290 Z" fill="#eef2f8"/><path d="M290 470 L370 320 L440 470 Z" fill="#3c4660"/>` +
    `<path d="M60 330 L76 360 L62 356 L48 368 Z" fill="#e6ecf4"/><path d="M370 320 L386 352 L370 348 L356 362 Z" fill="#e6ecf4"/>` +
    `<path d="M0 470 Q200 450 400 470 L400 700 L0 700 Z" fill="#dfe6f0"/>` +
    `<rect x="160" y="444" width="40" height="24" fill="#3a3a44"/><path d="M156 444 L180 428 L204 444 Z" fill="#2a2a34"/><rect x="168" y="452" width="8" height="8" fill="#ffaa44" class="es-lamp"/><rect x="190" y="432" width="5" height="12" fill="#2a2a34"/>`) },
  "loch-dark": { sky: "linear-gradient(180deg,#05070f 0%,#0f1426 60%,#1b2236 100%)", layers: ["fog-light"], svg: () => VB(
    starsSVG(30, 71, 240) +
    `<path d="M0 440 Q100 380 200 410 Q300 370 400 420 L400 450 L0 450 Z" fill="#0b1018"/>` + SEA(448, "#0a0f1c", "#020408") +
    `<path d="M40 452 L40 410 L50 410 L50 400 L60 400 L60 412 L76 412 L76 396 L86 396 L86 452 Z" fill="#05070c"/><rect x="62" y="420" width="4" height="8" fill="#1c2840"/>` +
    `<g class="es-bob"><ellipse cx="230" cy="520" rx="44" ry="6" fill="none" stroke="#3a5aa0" stroke-width="1.2" opacity=".5"/><ellipse cx="230" cy="520" rx="22" ry="3" fill="none" stroke="#6fa0ff" stroke-width="1" opacity=".5"/></g>` +
    WAVES(450, "#1c2c50", 7)) },
  "signpost-dawn": { sky: "linear-gradient(180deg,#3a3f78 0%,#c36f8a 40%,#f5a86a 70%,#ffe0a0 100%)", layers: ["wind"], svg: () => VB(
    `<circle cx="300" cy="440" r="40" fill="#fff1c4" opacity=".9"/>` + SEA(440, "#e7a07a", "#4a3a66") + WAVES(440, "#fff1c4", 9) +
    `<path d="M0 480 Q120 456 230 470 Q320 480 400 470 L400 700 L0 700 Z" fill="#2c2a40"/>` +
    `<rect x="148" y="300" width="7" height="175" fill="#e8e8ee"/><circle cx="151.5" cy="296" r="6" fill="#e8e8ee"/>` +
    `<path d="M155 320 L250 314 L262 324 L250 334 L155 336 Z" fill="#f0f0f4"/><path d="M148 350 L60 344 L48 354 L60 364 L148 366 Z" fill="#f0f0f4"/><path d="M155 380 L236 384 L246 394 L236 404 L155 400 Z" fill="#f0f0f4"/>` +
    `<path d="M170 328 h60 M76 356 h52 M172 394 h50" stroke="#3a3a55" stroke-width="2.5"/>`) },
  "sea-storm": { sky: "linear-gradient(180deg,#0c0f18 0%,#1e2534 55%,#2e3646 100%)", layers: ["rain"], svg: () => VB(
    `<path d="M150 80 L136 150 L156 150 L138 230" stroke="#e8f0ff" stroke-width="3" fill="none" class="es-bolt"/>` +
    SEA(410, "#1c2638", "#06090f") +
    `<path d="M0 430 Q40 400 80 430 T160 430 T240 430 T320 430 T400 430 L400 700 L0 700 Z" fill="#141c2c" class="es-bob"/>` +
    `<g class="es-rock"><path d="M150 452 L250 452 L238 474 L162 474 Z" fill="#3a2a22"/><rect x="196" y="404" width="4" height="50" fill="#2a1e18"/><rect x="176" y="436" width="30" height="16" fill="#e8e0d0"/><circle cx="214" cy="440" r="4" fill="#ffcf6a" class="es-lamp"/></g>` +
    `<path d="M0 500 Q50 470 100 500 T200 500 T300 500 T400 500 L400 700 L0 700 Z" fill="#0c121e" class="es-bob" style="animation-delay:1s"/>`) },
  "fjord-ice": { sky: "linear-gradient(180deg,#7a8fb4 0%,#aebcd6 55%,#d6deec 100%)", layers: ["snow2"], svg: () => VB(
    `<path d="M0 470 L0 120 Q40 140 70 200 L110 300 L150 470 Z" fill="#2e3648"/><path d="M400 470 L400 100 Q350 130 320 210 L270 320 L240 470 Z" fill="#2a3244"/>` +
    [40, 60, 92].map((x, i) => `<path d="M${x} ${180 + i * 30} L${x + 3} 470" stroke="#eef4ff" stroke-width="${4 - i}" opacity=".9"/>`).join("") +
    [330, 352, 372, 300].map((x, i) => `<path d="M${x} ${160 + i * 26} L${x - 2} 470" stroke="#eef4ff" stroke-width="3" opacity=".85"/>`).join("") +
    SEA(466, "#2a3a56", "#101828") + `<path d="M0 466 L400 466 L400 480 L0 480 Z" fill="#dfe8f4" opacity=".7"/>` +
    `<path d="M150 470 L250 470 L240 500 L160 500 Z" fill="#e8eef8" opacity=".5"/>`) },
  "aurora": { sky: "linear-gradient(180deg,#020614 0%,#08142e 55%,#0e2240 100%)", layers: ["aurora"], svg: () => VB(
    starsSVG(80, 81, 360) +
    `<path d="M0 470 Q100 452 200 462 Q300 448 400 460 L400 700 L0 700 Z" fill="#cfe0ea"/><path d="M0 470 Q100 452 200 462 Q300 448 400 460" stroke="#7affc0" stroke-width="1" fill="none" opacity=".4"/>` +
    [[80, 470], [130, 478], [300, 466], [340, 474], [210, 484]].map(([x, y]) => `<path d="M${x - 9} ${y} L${x - 5} ${y - 10} L${x - 7} ${y - 12} L${x} ${y - 22} L${x + 7} ${y - 12} L${x + 5} ${y - 10} L${x + 9} ${y} Z" fill="#3a4a5a"/>`).join("")) },
  "midnight-sun": { sky: "linear-gradient(180deg,#9cbfe0 0%,#e8d6a6 60%,#f7c87a 100%)", layers: ["motes"], svg: () => VB(
    `<circle cx="120" cy="440" r="26" fill="#fff4cf"/><circle cx="120" cy="440" r="60" fill="#fff4cf" opacity=".25"/>` +
    `<path d="M0 450 Q100 432 200 444 Q300 430 400 446 L400 456 L0 456 Z" fill="#4a5a52"/>` + SEA(452, "#d7c08a", "#6c7a8a") +
    `<path d="M100 456 L140 456 L136 600 L104 600 Z" fill="#fff4cf" opacity=".25"/>` +
    [[300, 300], [330, 330], [360, 290], [272, 340]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="${470 - y}" fill="#f2f0ea"/><path d="M${x + 2} ${y} q-24 10 -20 40 q22 8 46 -6 q2 -28 -26 -34 Z" fill="#6c8a4a" opacity=".85"/>`).join("") +
    `<path d="M240 470 Q320 460 400 466 L400 700 L240 700 Z" fill="#3a4a3a"/>`) },
  "road-night": { sky: "linear-gradient(180deg,#03040c 0%,#0b1028 60%,#141a3a 100%)", layers: [], svg: () => VB(
    starsSVG(60, 91, 330) +
    `<path d="M0 470 L400 470 L400 700 L0 700 Z" fill="#070a18"/><ellipse cx="200" cy="462" rx="70" ry="10" fill="#5fb8ff" opacity=".25" class="es-lamp"/>` +
    `<path d="M196 470 L204 470 L330 700 L70 700 Z" fill="#11152a"/>` +
    Array.from({ length: 7 }, (_, i) => { const t = i / 7, y = 476 + t * t * 230, w = 1 + t * 5; return `<rect x="${f1(200 - w / 2)}" y="${f1(y)}" width="${f1(w)}" height="${f1(4 + t * 18)}" fill="#e8d27a" opacity=".85"/>`; }).join("") +
    Array.from({ length: 5 }, (_, i) => { const t = (i + 1) / 6, x = 200 + 30 + t * 180, h = 14 + t * 120; return `<rect x="${f1(x)}" y="${f1(470 - h + t * 80)}" width="${f1(1 + t * 3)}" height="${f1(h)}" fill="#1a1f3a"/>`; }).join("") +
    `<path d="M228 412 Q300 400 400 380" stroke="#1a1f3a" stroke-width="1" fill="none"/>`) },
  "forest-mist": { sky: "linear-gradient(180deg,#26303a 0%,#44525a 55%,#6a7a78 100%)", layers: ["fog", "fog2"], svg: () => VB(
    pinesSVG(17, { n: 16, base: 430, fill: "#2c3a38", minH: 90, maxH: 190 }) + pinesSVG(27, { n: 14, base: 470, fill: "#1a2624", minH: 110, maxH: 230 }) +
    `<path d="M0 470 L400 470 L400 700 L0 700 Z" fill="#141e1c"/>` + pinesSVG(37, { n: 6, base: 560, fill: "#0b1210", minH: 220, maxH: 320 })) },
  "harbour": { sky: "linear-gradient(180deg,#151a3a 0%,#3a3a66 50%,#7a6a88 100%)", layers: ["rain-light"], svg: () => VB(
    (() => { const cols = ["#9a3a2a", "#c4902a", "#a84a2a", "#d6b04a", "#7a2a22", "#b8642a", "#c47a2a"]; let s = ""; for (let i = 0; i < 7; i++) { const x = 10 + i * 46; s += `<path d="M${x} 450 L${x} 360 L${x + 21} 330 L${x + 42} 360 L${x + 42} 450 Z" fill="${cols[i]}"/><rect x="${x + 16}" y="${396}" width="10" height="14" fill="${i % 3 ? "#ffcf7a" : "#5fb8ff"}" class="es-win" style="animation-delay:${i}s"/><rect x="${x + 6}" y="370" width="7" height="9" fill="#2a1a14"/><rect x="${x + 29}" y="370" width="7" height="9" fill="#2a1a14"/>`; } return s; })() +
    SEA(452, "#2a2a4a", "#0a0c1c") + WAVES(452, "#ffcf7a", 13) +
    `<rect x="60" y="440" width="4" height="70" fill="#1a1a2a"/><path d="M40 500 L120 500 L110 516 L48 516 Z" fill="#1a1a2a"/><rect x="250" y="420" width="3" height="90" fill="#1a1a2a"/><path d="M230 500 L300 500 L292 514 L238 514 Z" fill="#1a1a2a"/>`) },
  "bothy": { sky: "linear-gradient(180deg,#2a1c14 0%,#3e2a1e 60%,#1e140e 100%)", layers: [], svg: () => VB(
    (() => { const r = rng(101); let s = ""; for (let y = 120; y < 470; y += 26) for (let x = (y / 26) % 2 ? -20 : 0; x < 400; x += 52) s += `<rect x="${x + 2}" y="${y + 2}" width="48" height="22" rx="4" fill="#4a3628" opacity="${f1(0.5 + r() * 0.5)}"/>`; return s; })() +
    `<rect x="250" y="200" width="90" height="110" fill="#0e1a36"/><rect x="250" y="200" width="90" height="110" fill="none" stroke="#2a1a10" stroke-width="8"/><path d="M295 200 V310 M250 255 H340" stroke="#2a1a10" stroke-width="5"/>` +
    `<g fill="#fff" opacity=".7">${Array.from({ length: 12 }, (_, i) => `<circle cx="${258 + (i * 37) % 80}" cy="${210 + (i * 23) % 92}" r="1.4"/>`).join("")}</g>` +
    `<rect x="70" y="330" width="80" height="120" rx="6" fill="#1a1a1e"/><rect x="100" y="150" width="20" height="180" fill="#1a1a1e"/><rect x="84" y="380" width="52" height="40" rx="4" fill="#ff8a2a" class="es-lamp"/><circle cx="110" cy="400" r="80" fill="#ff8a2a" opacity=".12"/>` +
    `<rect x="0" y="470" width="400" height="230" fill="#24180f"/><rect x="200" y="420" width="140" height="10" fill="#5a3a22"/><rect x="210" y="430" width="8" height="40" fill="#5a3a22"/><rect x="322" y="430" width="8" height="40" fill="#5a3a22"/><rect x="236" y="408" width="44" height="12" fill="#c9b48a"/>`) },
  "office": { sky: "linear-gradient(180deg,#14261e 0%,#1e3428 60%,#101a14 100%)", layers: [], svg: () => VB(
    Array.from({ length: 4 }, (_, i) => `<rect x="${12 + i * 42}" y="250" width="38" height="220" fill="#3a4038"/>${[0, 1, 2, 3].map((j) => `<rect x="${17 + i * 42}" y="${258 + j * 52}" width="28" height="44" fill="#4a5048"/><rect x="${27 + i * 42}" y="${276 + j * 52}" width="8" height="3" fill="#c9b48a"/>`).join("")}`).join("") +
    `<circle cx="320" cy="170" r="26" fill="#e8e2c8"/><circle cx="320" cy="170" r="26" fill="none" stroke="#3a3020" stroke-width="4"/><path d="M320 170 V154 M320 170 L332 176" stroke="#2a2a2a" stroke-width="2.5"/>` +
    `<rect x="200" y="400" width="200" height="14" fill="#4a2e1a"/><rect x="210" y="414" width="12" height="60" fill="#3a2414"/><rect x="380" y="414" width="12" height="60" fill="#3a2414"/>` +
    `<path d="M300 300 L286 330 L326 330 Z" fill="#2a7a4a"/><rect x="304" y="330" width="4" height="70" fill="#2a2a2a"/><path d="M286 330 L240 400 L376 400 L326 330 Z" fill="#fff6c0" opacity=".15"/>` +
    `<g fill="#e8e2d0">${Array.from({ length: 6 }, (_, i) => `<rect x="${226 + (i % 2) * 6}" y="${388 - i * 5}" width="44" height="5" stroke="#b8b0a0" stroke-width=".5"/>`).join("")}</g>` +
    `<rect x="0" y="474" width="400" height="226" fill="#0e1410"/>`) },
  "cafe": { sky: "linear-gradient(180deg,#3a2414 0%,#6a4426 55%,#2a180c 100%)", layers: ["motes"], svg: () => VB(
    `<rect x="40" y="150" width="140" height="230" rx="70" fill="#101a3a"/><rect x="40" y="150" width="140" height="230" rx="70" fill="none" stroke="#c9a060" stroke-width="6"/><path d="M110 150 V380 M40 270 H180" stroke="#c9a060" stroke-width="3"/>` +
    `<g fill="#5fb8ff" opacity=".6">${[60, 80, 100, 130, 150].map((x, i) => `<rect x="${x}" y="${300 + (i % 2) * 14}" width="6" height="6" class="es-win" style="animation-delay:${i}s"/>`).join("")}</g>` +
    [140, 290].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="80" stroke="#c9a060" stroke-width="2"/><circle cx="${x}" cy="96" r="22" fill="#ffd27a" opacity=".3"/><circle cx="${x}" cy="96" r="10" fill="#ffe7a8"/>`).join("") +
    `<rect x="0" y="420" width="400" height="280" fill="#2a180c"/>` +
    [[70, 430], [250, 420]].map(([x, y]) => `<ellipse cx="${x + 40}" cy="${y}" rx="52" ry="9" fill="#e8dcc8"/><rect x="${x + 37}" y="${y}" width="6" height="56" fill="#1a0e06"/><rect x="${x + 30}" y="${y - 12}" width="12" height="10" rx="2" fill="#fff"/>`).join("") +
    `<path d="M300 300 Q312 270 340 280 Q360 230 384 300 L384 418 L300 418 Z" fill="#14100c"/><circle cx="330" cy="294" r="3" fill="#ffd23d" class="es-lamp"/><circle cx="346" cy="292" r="3" fill="#ffd23d" class="es-lamp"/>`) },
  "desert-night": { sky: "linear-gradient(180deg,#040414 0%,#14143a 60%,#3a2a4a 100%)", layers: [], svg: () => VB(
    starsSVG(130, 111, 420) +
    `<path d="M0 470 Q80 430 170 456 Q260 420 400 462 L400 700 L0 700 Z" fill="#3a2a30"/><path d="M0 520 Q140 470 260 506 Q330 488 400 500 L400 700 L0 700 Z" fill="#2a1c22"/>`) },
  "domes-dusk": { sky: "linear-gradient(180deg,#1c2a4a 0%,#3a6a7a 40%,#e0905a 75%,#f8c27a 100%)", layers: ["motes"], svg: () => VB(
    `<g fill="#1a1a2e"><path d="M60 470 L60 380 Q110 300 160 380 L160 470 Z"/><rect x="40" y="300" width="8" height="170"/><path d="M38 300 L44 270 L50 300 Z"/><rect x="172" y="290" width="8" height="180"/><path d="M170 290 L176 258 L182 290 Z"/>` +
    `<path d="M220 470 L220 400 Q260 340 300 400 L300 470 Z"/><path d="M300 470 L300 410 Q340 360 380 410 L380 470 Z"/><rect x="0" y="440" width="400" height="30"/></g>` +
    `<circle cx="110" cy="330" r="4" fill="#ffd27a"/><circle cx="260" cy="368" r="3" fill="#ffd27a"/>` +
    `<rect x="0" y="470" width="400" height="230" fill="#141424"/>`) },
  "temples-dusk": { sky: "linear-gradient(180deg,#2a1a3a 0%,#8a3a4a 45%,#e8905a 75%,#f8c87a 100%)", layers: ["motes"], svg: () => VB(
    `<circle cx="290" cy="380" r="34" fill="#ffd9a0" opacity=".85"/>` +
    `<g fill="#20142a">${[[80, 1], [200, 1.3], [320, 0.9]].map(([x, k]) => { let s = ""; for (let j = 0; j < 5; j++) { const w = (60 - j * 10) * k, y = 470 - j * 34 * k; s += `<path d="M${x - w} ${y} L${x + w} ${y} L${x + w * 0.7} ${y - 16 * k} L${x - w * 0.7} ${y - 16 * k} Z"/><rect x="${x - w * 0.5}" y="${y - 34 * k}" width="${w}" height="${18 * k}"/>`; } return s + `<rect x="${x - 2}" y="${470 - 200 * k}" width="4" height="${30 * k}"/>`; }).join("")}</g>` +
    `<rect x="0" y="470" width="400" height="230" fill="#160e1e"/>`) },
  "river-dusk": { sky: "linear-gradient(180deg,#1a2248 0%,#5a4a7a 45%,#d88a6a 80%,#f2b07a 100%)", layers: [], svg: () => VB(
    housesSVG(121, { base: 440, blue: 0.4, fill: "#1a1630", minH: 40, maxH: 110, x0: -10, w: 30, count: 14 }) +
    `<path d="M120 440 L126 360 L132 440 Z" fill="#1a1630"/><path d="M290 440 L296 340 L302 440 Z" fill="#1a1630"/>` +
    SEA(440, "#c27a6a", "#2a2448") + WAVES(440, "#ffd2a0", 17) +
    `<path d="M0 470 L400 470 L400 478 L0 478 Z" fill="#141028"/>` + Array.from({ length: 5 }, (_, i) => `<path d="M${i * 90 - 10} 478 A40 30 0 0 1 ${i * 90 + 70} 478" fill="none" stroke="#141028" stroke-width="10"/>`).join("") +
    `<rect x="0" y="560" width="400" height="140" fill="#0e0c20"/>`) },
  "jungle": { sky: "linear-gradient(180deg,#071a14 0%,#123a2a 55%,#1e4a34 100%)", layers: ["motes-green", "fog-light"], svg: () => VB(
    `<g fill="#2a3a30">${Array.from({ length: 6 }, (_, j) => `<rect x="${120 + j * 14}" y="${470 - (j + 1) * 30}" width="${160 - j * 28}" height="30"/>`).join("")}<rect x="184" y="270" width="32" height="24"/></g>` +
    `<rect x="194" y="440" width="12" height="30" fill="#0a140e"/>` +
    `<g fill="#0a1a10">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 50 - 10} 470 Q${i * 50 + 10} ${300 + (i % 3) * 40} ${i * 50 + 40} 470 Z"/>`).join("")}</g>` +
    `<path d="M0 0 Q40 120 20 260" stroke="#0a1a10" stroke-width="5" fill="none"/><path d="M380 0 Q350 140 372 300" stroke="#0a1a10" stroke-width="6" fill="none"/>` +
    `<rect x="0" y="470" width="400" height="230" fill="#06120a"/>`) },
  "red-desert": { sky: "linear-gradient(180deg,#2a3a7a 0%,#c06a4a 55%,#f2a05a 100%)", layers: ["motes"], svg: () => VB(
    starsSVG(20, 131, 160) +
    `<path d="M70 450 Q80 380 140 376 L280 380 Q330 384 338 450 Z" fill="#a8401e"/><path d="M90 420 Q160 400 240 410 M110 400 Q170 390 230 396" stroke="#7a2a12" stroke-width="2" fill="none"/>` +
    `<path d="M0 452 L400 452 L400 700 L0 700 Z" fill="#b24a22"/><path d="M0 500 Q200 480 400 500 L400 700 L0 700 Z" fill="#8a3418"/>` +
    [40, 360, 300].map((x, i) => `<circle cx="${x}" cy="${470 + i * 12}" r="${10 + i * 2}" fill="#6a7a3a"/>`).join("")) },
  "islands": { sky: "linear-gradient(180deg,#040a20 0%,#0c2048 55%,#1a3a6a 100%)", layers: [], svg: () => VB(
    starsSVG(90, 141, 380) + MOON(300, 120, 16) +
    SEA(450, "#0e2a50", "#020a18") + WAVES(450, "#6fa0ff", 19) +
    `<path d="M40 452 Q90 410 150 452 Z" fill="#05101e"/><path d="M250 452 Q300 400 380 452 Z" fill="#05101e"/>` +
    [[100, 430], [320, 418]].map(([x, y]) => `<path d="M${x} 452 Q${x + 4} ${y} ${x + 10} ${y - 20}" stroke="#05101e" stroke-width="4" fill="none"/><path d="M${x + 10} ${y - 20} q-20 2 -26 14 M${x + 10} ${y - 20} q18 -2 26 12 M${x + 10} ${y - 20} q-6 -14 -18 -16 M${x + 10} ${y - 20} q10 -12 22 -10" stroke="#05101e" stroke-width="4" fill="none"/>`).join("") +
    `<path d="M300 480 L360 480 L356 488 L304 488 Z" fill="#05101e"/><circle cx="330" cy="476" r="2" fill="#ffcf6a"/>`) },
  "the-glow": { sky: "radial-gradient(ellipse at 50% 42%,#0e2a5a 0%,#061230 40%,#020512 100%)", layers: [], svg: () => VB(
    Array.from({ length: 7 }, (_, i) => `<circle cx="200" cy="300" r="${24 + i * 26}" fill="none" stroke="#7fc8ff" stroke-width="1" opacity="${f1(0.22 - i * 0.025)}"/>`).join("") +
    (() => { const r = rng(151); let s = ""; for (let i = 0; i < 100; i++) { const a = r() * Math.PI * 2, d = 30 + Math.sqrt(r()) * 230, x = 200 + Math.cos(a) * d, y = 300 + Math.sin(a) * d * 0.9, k = 0.6 + r() * 1.2; s += `<g class="es-eye" style="animation-delay:${f1(r() * 5)}s"><ellipse cx="${f1(x - 3 * k)}" cy="${f1(y)}" rx="${f1(1.6 * k)}" ry="${f1(1 * k)}" fill="#8fd3ff"/><ellipse cx="${f1(x + 3 * k)}" cy="${f1(y)}" rx="${f1(1.6 * k)}" ry="${f1(1 * k)}" fill="#8fd3ff"/></g>`; } return s; })() +
    `<circle cx="200" cy="300" r="10" fill="#cfeaff" opacity=".8" class="es-lamp"/>`) },
  "deep": { sky: "linear-gradient(180deg,#0e3a5a 0%,#06203a 35%,#020812 100%)", layers: ["rays"], svg: () => VB(
    (() => { const r = rng(161); let s = ""; for (let i = 0; i < 26; i++) { const x = r() * 380 + 10, y = 120 + r() * 420; s += `<g class="es-bob" style="animation-delay:${f1(r() * 4)}s"><rect x="${f1(x)}" y="${f1(y)}" width="10" height="16" rx="2" fill="#5fb8ff" opacity=".85"/><ellipse cx="${f1(x + 5)}" cy="${f1(y - 7)}" rx="6" ry="7" fill="#9fc4e0" opacity=".25"/></g>`; } return s; })() +
    `<path d="M-20 700 Q40 560 10 480 Q-10 420 40 400" stroke="#14081e" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M420 700 Q360 580 390 500 Q410 440 360 410" stroke="#14081e" stroke-width="26" fill="none" stroke-linecap="round"/><path d="M200 720 Q230 600 180 540" stroke="#14081e" stroke-width="18" fill="none" stroke-linecap="round"/>`) },
  "snowfield": { sky: "linear-gradient(180deg,#8a96aa 0%,#c4ccd8 55%,#e8ecf2 100%)", layers: ["snow", "snow2", "wind"], svg: () => VB(
    `<path d="M0 440 Q100 420 200 430 Q300 416 400 432 L400 700 L0 700 Z" fill="#eef2f6"/><path d="M0 440 Q100 420 200 430 Q300 416 400 432" stroke="#b8c2d0" stroke-width="2" fill="none"/>` +
    `<path d="M20 440 L70 380 L120 432 Z" fill="#9aa6b8"/><path d="M280 432 L340 370 L400 436 Z" fill="#9aa6b8"/>` +
    `<path d="M0 520 Q200 500 400 520" stroke="#d4dbe6" stroke-width="2" fill="none"/>` +
    [[150, 470], [240, 486]].map(([x, y]) => `<rect x="${x}" y="${y}" width="3" height="20" fill="#7a5a3a"/><rect x="${x - 6}" y="${y + 2}" width="15" height="3" fill="#7a5a3a"/>`).join("")) },
  "beach": { sky: "linear-gradient(180deg,#6fa8dc 0%,#a8cce6 55%,#f2e4c4 100%)", layers: ["wind"], svg: () => VB(
    `<circle cx="320" cy="150" r="22" fill="#fff8d8" opacity=".9"/>` + SEA(430, "#6aa6c8", "#a8d0d8") + WAVES(430, "#fff", 23) +
    `<path d="M0 470 Q100 452 200 466 Q300 456 400 470 L400 700 L0 700 Z" fill="#e8d4a4"/><path d="M0 470 Q100 452 200 466 Q300 456 400 470" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>` +
    `<path d="M260 470 Q320 380 400 400 L400 470 Z" fill="#d8c08a"/><path d="M300 410 l4 -16 M320 400 l-2 -18 M344 398 l3 -14" stroke="#7a8a4a" stroke-width="2"/>` +
    `<path d="M0 560 Q200 540 400 560 L400 700 L0 700 Z" fill="#d8c290"/>`) },
  "plateau-wind": { sky: "linear-gradient(180deg,#4a5464 0%,#6a7484 55%,#8a9298 100%)", layers: ["wind", "fog-light"], svg: () => VB(
    `<path d="M0 460 L400 450 L400 700 L0 700 Z" fill="#3a3a2e"/>` +
    [[60, 452], [200, 446], [320, 448]].map(([x, y]) => `<path d="M${x - 30} ${y + 6} Q${x - 26} ${y - 22} ${x} ${y - 26} Q${x + 30} ${y - 22} ${x + 34} ${y + 6} Z" fill="#2a2a24"/>`).join("") +
    `<path d="M0 520 Q100 500 200 514 Q300 496 400 510 L400 700 L0 700 Z" fill="#4a4436"/><path d="M40 560 q40 -10 80 0 M220 580 q60 -12 120 0" stroke="#6a6248" stroke-width="3" fill="none"/>`) },
  "rock-arch": { sky: "linear-gradient(180deg,#0c0c14 0%,#1a1a24 100%)", layers: ["wind"], svg: () => VB(
    `<defs><linearGradient id="es-arch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c27a"/><stop offset=".6" stop-color="#f08a5a"/><stop offset="1" stop-color="#3a6a9a"/></linearGradient></defs>` +
    `<path d="M0 0 H400 V700 H0 Z M120 470 Q110 300 200 260 Q290 300 280 470 Z" fill="#1a1612" fill-rule="evenodd"/>` +
    `<path d="M120 470 Q110 300 200 260 Q290 300 280 470 Z" fill="url(#es-arch)"/><circle cx="200" cy="420" r="18" fill="#fff0c4"/>` +
    `<path d="M120 440 L280 440 L280 470 L120 470 Z" fill="#3a6a9a"/><path d="M150 452 h20 M210 446 h30 M250 458 h14" stroke="#fff0c4" stroke-width="2"/>` +
    `<path d="M0 470 L400 470 L400 700 L0 700 Z" fill="#14100c"/>`) },
  "town-day": { sky: "linear-gradient(180deg,#8fbbe8 0%,#c8ddf0 60%,#eef2f6 100%)", layers: ["motes"], svg: () => VB(
    (() => { const cols = ["#c0392b", "#e2b13c", "#3d7ab0", "#d97a3c", "#6aa06a", "#c0392b", "#e8d7a0", "#9a4a6a"], r = rng(171); let s = ""; for (let i = 0; i < 8; i++) { const x = i * 52 - 8, h = 70 + r() * 50, top = 470 - h; s += `<rect x="${x}" y="${f1(top)}" width="50" height="${f1(h)}" fill="${cols[i]}"/><path d="M${x - 3} ${f1(top)} L${x + 25} ${f1(top - 24)} L${x + 53} ${f1(top)} Z" fill="#3a2a2a"/><rect x="${x + 10}" y="${f1(top + 16)}" width="10" height="13" fill="#fff" opacity=".85"/><rect x="${x + 30}" y="${f1(top + 16)}" width="10" height="13" fill="#fff" opacity=".85"/><rect x="${x + 19}" y="${f1(470 - 28)}" width="12" height="28" fill="#3a2a2a"/>`; } return s; })() +
    `<path d="M0 470 L400 470 L400 700 L0 700 Z" fill="#8a9a8a"/><path d="M0 476 L400 476" stroke="#c8d0c8" stroke-width="3"/>`) },
  "amber-shop": { sky: "linear-gradient(180deg,#2a1608 0%,#4a2a10 60%,#1e1006 100%)", layers: ["motes"], svg: () => VB(
    Array.from({ length: 4 }, (_, j) => `<rect x="20" y="${170 + j * 70}" width="360" height="8" fill="#6a3e1a"/>` + Array.from({ length: 9 }, (_, i) => `<ellipse cx="${44 + i * 38}" cy="${158 + j * 70}" rx="${8 + ((i + j) % 3) * 3}" ry="${7 + ((i * j) % 3) * 2}" fill="${["#f2a01a", "#e07a10", "#ffc84a", "#c85a08"][(i + j) % 4]}" opacity=".9"/>`).join("")).join("") +
    `<circle cx="200" cy="80" r="70" fill="#ffc84a" opacity=".12"/><path d="M180 0 V50 L160 74 H240 L220 50 V0" fill="#3a2410"/><circle cx="200" cy="80" r="8" fill="#ffe7a8"/>` +
    `<rect x="0" y="460" width="400" height="240" fill="#2a1608"/><rect x="40" y="440" width="320" height="20" fill="#5a3416"/>`) },
  "hill-crosses": { sky: "linear-gradient(180deg,#3a4a6a 0%,#8a8aa0 55%,#d8c8b0 100%)", layers: ["wind"], svg: () => VB(
    `<path d="M0 480 Q200 330 400 480 L400 700 L0 700 Z" fill="#3a3a32"/>` +
    (() => { const r = rng(181); let s = ""; for (let i = 0; i < 140; i++) { const x = 30 + r() * 340, top = 480 - 150 * (1 - Math.pow((x - 200) / 200, 2)), y = top + r() * (480 - top) * 0.9, h = 6 + r() * 18; s += `<path d="M${f1(x)} ${f1(y)} v${f1(-h)} M${f1(x - h * 0.3)} ${f1(y - h * 0.7)} h${f1(h * 0.6)}" stroke="#1e1e1a" stroke-width="${f1(0.8 + r() * 1.2)}"/>`; } return s; })() +
    `<path d="M0 520 L400 520 L400 700 L0 700 Z" fill="#2a2a24"/>`) },
  "lake-mist": { sky: "linear-gradient(180deg,#8a9aa8 0%,#b8c4cc 55%,#d8dee2 100%)", layers: ["fog", "fog2"], svg: () => VB(
    pinesSVG(191, { n: 22, base: 440, fill: "#4a5a5a", minH: 30, maxH: 70 }) +
    SEA(440, "#9aaab4", "#5a6a74") + `<path d="M0 470 Q60 462 120 470 L120 700 L0 700 Z" fill="#2a3a30"/>` +
    [[60, 520], [86, 540], [110, 506]].map(([x, y]) => `<path d="M${x} ${y} l2 -40 M${x - 2} ${y - 34} l-6 -10" stroke="#3a4a30" stroke-width="2" fill="none"/>`).join("") +
    `<g fill="#f4f4f4"><ellipse cx="260" cy="500" rx="12" ry="5"/><path d="M268 498 q4 -16 -2 -18 q-4 -2 -4 4" stroke="#f4f4f4" stroke-width="3" fill="none"/></g>`) },
  "fields-dusk": { sky: "linear-gradient(180deg,#2a2450 0%,#8a4a6a 40%,#e89060 72%,#f8c070 100%)", layers: ["motes"], svg: () => VB(
    `<circle cx="100" cy="420" r="30" fill="#ffe0a0" opacity=".85"/>` +
    `<path d="M0 450 Q200 430 400 450 L400 700 L0 700 Z" fill="#b8843a"/>` + Array.from({ length: 12 }, (_, i) => `<path d="M${i * 36} 700 L200 450" stroke="#8a5a22" stroke-width="1.2" opacity=".6"/>`).join("") +
    [[260, 452], [300, 458], [340, 450]].map(([x, y]) => `<path d="M${x - 10} ${y} Q${x} ${y - 26} ${x + 10} ${y} Z" fill="#6a4418"/>`).join("") +
    `<path d="M30 452 L30 410 L70 410 L70 452 Z M26 410 L50 390 L74 410 Z" fill="#2a1a20"/><rect x="44" y="418" width="8" height="8" fill="#ffcf7a"/>`) },
};
const BG_NAMES = Object.keys(BG);

// ---------- portraits ----------
const SKINS = ["#f3d5c0", "#e8c09e", "#d4a17a", "#b57d55", "#8d5a3b", "#6b4329", "#f0c8a8", "#c99673"];
const HAIRS = ["#2a1a10", "#4a3426", "#7a5a3a", "#a0522d", "#c9a060", "#d9d9d9", "#1a1a1a", "#8a6a4a"];
const COATS = ["#3b4a7a", "#5a3a2a", "#2a5a4a", "#6a2a3a", "#4a4a5a", "#7a5a2a", "#2a4a6a", "#5a2a5a"];
const shade = (hex, k = 0.82) => { const n = parseInt(hex.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join(""); };

function personSVG(c) {
  const u = "p" + (uid++), skin = c.skin, hair = c.hair, coat = c.coat;
  let s = `<defs><radialGradient id="${u}g" cx="50%" cy="34%" r="78%"><stop offset="0" stop-color="${c.bg || "#34468c"}"/><stop offset="1" stop-color="#0b1027"/></radialGradient>` +
    `<filter id="${u}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>` +
    `<rect x="0" y="0" width="120" height="140" fill="url(#${u}g)"/>`;
  if (c.hat === "shawl" || c.hat === "druid") s += `<path d="M28 74 Q26 22 60 20 Q94 22 92 74 L100 140 L20 140 Z" fill="${c.hatC}"/>`;
  if (c.hairStyle === "long") s += `<path d="M36 60 Q34 30 60 30 Q86 30 84 60 L88 106 Q60 114 32 106 Z" fill="${hair}"/>`;
  s += `<path d="M14 140 C16 112 34 100 60 100 C86 100 104 112 106 140 Z" fill="${coat}"/>`;
  if (c.shirt) s += `<path d="M49 100 L60 118 L71 100 Z" fill="${c.shirt}"/>`;
  if (c.tie) s += `<path d="M58 104 L62 104 L64 124 L60 128 L56 124 Z" fill="${c.tie}"/>`;
  if (c.armour) s += `<path d="M30 116 Q60 106 90 116 L94 140 L26 140 Z" fill="#b8b8c4"/><path d="M34 124 H86 M32 132 H88" stroke="#7a7a88" stroke-width="2"/>`;
  s += `<rect x="53" y="80" width="14" height="22" rx="5" fill="${shade(skin)}"/>`;
  s += `<ellipse cx="60" cy="62" rx="21" ry="25" fill="${skin}"/>`;
  if (c.freckles) s += `<g fill="${shade(skin, 0.7)}"><circle cx="49" cy="70" r="1"/><circle cx="53" cy="72" r="1"/><circle cx="67" cy="72" r="1"/><circle cx="71" cy="70" r="1"/></g>`;
  // hair on top
  const hs = c.hairStyle;
  if (hs === "short" || hs === "long" || hs === "bun") s += `<path d="M39 60 Q37 34 60 33 Q83 34 81 60 Q78 46 66 44 Q52 48 39 60 Z" fill="${hair}"/>`;
  if (hs === "bun") s += `<circle cx="60" cy="33" r="9" fill="${hair}"/>`;
  if (hs === "wild") s += `<path d="M38 58 L36 40 L44 44 L46 30 L54 38 L60 26 L66 38 L74 30 L76 44 L84 40 L82 58 Q72 44 60 44 Q48 44 38 58 Z" fill="${hair}"/>`;
  if (hs === "crop") s += `<path d="M40 52 Q40 36 60 36 Q80 36 80 52 Q70 44 60 44 Q50 44 40 52 Z" fill="${hair}"/>`;
  // eyes
  const e = c.eyes || "normal";
  if (e === "glow") s += `<g filter="url(#${u}b)"><ellipse cx="52" cy="62" rx="4" ry="3" fill="${c.eyeC}"/><ellipse cx="68" cy="62" rx="4" ry="3" fill="${c.eyeC}"/></g><ellipse cx="52" cy="62" rx="2.4" ry="2" fill="${c.eyeC}"/><ellipse cx="68" cy="62" rx="2.4" ry="2" fill="${c.eyeC}"/>`;
  else if (e === "hollow") s += `<ellipse cx="52" cy="62" rx="4" ry="5" fill="#141a30"/><ellipse cx="68" cy="62" rx="4" ry="5" fill="#141a30"/>`;
  else if (e === "kind") s += `<path d="M48 63 Q52 59 56 63 M64 63 Q68 59 72 63" stroke="#2a2030" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else s += `<ellipse cx="52" cy="62" rx="2.4" ry="3" fill="#1d1a26"/><ellipse cx="68" cy="62" rx="2.4" ry="3" fill="#1d1a26"/><circle cx="52.8" cy="61" r=".8" fill="#fff"/><circle cx="68.8" cy="61" r=".8" fill="#fff"/>`;
  if (c.glasses) s += `<g fill="none" stroke="#1d1a26" stroke-width="1.6"><circle cx="52" cy="62" r="6"/><circle cx="68" cy="62" r="6"/><path d="M58 62 H62"/></g>`;
  s += `<path d="M47 54 Q52 51 56 54 M64 54 Q68 51 73 54" stroke="${shade(hair, 0.8)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // mouth
  const m = c.mouth || "flat";
  if (m === "smile") s += `<path d="M53 76 Q60 81 67 76" stroke="#5a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else if (m === "frown") s += `<path d="M54 79 Q60 75 66 79" stroke="#5a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else if (m === "o") s += `<ellipse cx="60" cy="78" rx="2.6" ry="3.2" fill="#3a1a1a"/>`;
  else if (m === "smirk") s += `<path d="M54 77 Q62 79 67 74" stroke="#5a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else s += `<path d="M54 77 H66" stroke="#5a2a2a" stroke-width="2" stroke-linecap="round"/>`;
  if (c.beard) s += `<path d="M40 64 Q41 94 60 96 Q79 94 80 64 Q74 84 60 84 Q46 84 40 64 Z" fill="${hair}"/>`;
  if (c.tache) s += `<path d="M50 73 Q55 69 60 72 Q65 69 70 73 Q65 75 60 74 Q55 75 50 73 Z" fill="${c.tacheC || hair}"/>`;
  // hats
  const h = c.hat, hc = c.hatC || "#2a2a34";
  if (h === "shawl") s += `<path d="M34 62 Q34 30 60 28 Q86 30 86 62 Q80 40 60 38 Q40 40 34 62 Z" fill="${hc}"/><path d="M34 62 Q36 84 44 100" stroke="${shade(hc, 0.7)}" stroke-width="2" fill="none"/>`;
  if (h === "druid") s += `<path d="M34 62 Q34 30 60 12 Q86 30 86 62 Q80 40 60 38 Q40 40 34 62 Z" fill="${hc}"/>`;
  if (h === "tricorn") s += `<path d="M26 46 Q60 14 94 46 Q60 38 26 46 Z" fill="${hc}"/><path d="M32 44 Q60 24 88 44 L84 48 Q60 40 36 48 Z" fill="${shade(hc, 0.75)}"/><path d="M28 46 Q60 36 92 46" stroke="#c9a060" stroke-width="1.5" fill="none"/>`;
  if (h === "bowler") s += `<ellipse cx="60" cy="42" rx="30" ry="5" fill="${hc}"/><path d="M42 42 Q42 16 60 16 Q78 16 78 42 Z" fill="${hc}"/><rect x="42" y="36" width="36" height="4" fill="${shade(hc, 1.6)}" opacity=".5"/>`;
  if (h === "flatcap") s += `<path d="M36 48 Q36 30 60 30 Q84 30 86 44 L94 50 Q70 44 36 52 Z" fill="${hc}"/>`;
  if (h === "helmet") s += `<path d="M38 52 Q38 26 60 26 Q82 26 82 52 L80 58 L40 58 Z" fill="#c4c4cc"/><path d="M46 28 Q60 2 74 28 Q60 20 46 28 Z" fill="#b02a2a"/><rect x="36" y="56" width="8" height="22" rx="3" fill="#b4b4bc"/><rect x="76" y="56" width="8" height="22" rx="3" fill="#b4b4bc"/>`;
  if (h === "beanie") s += `<path d="M38 52 Q38 26 60 26 Q82 26 82 52 Z" fill="${hc}"/><rect x="37" y="46" width="46" height="8" rx="3" fill="${shade(hc, 0.75)}"/><circle cx="60" cy="24" r="6" fill="${shade(hc, 1.25)}"/>`;
  if (h === "hood") s += `<path d="M28 80 Q26 24 60 22 Q94 24 92 80 Q88 44 60 42 Q32 44 28 80 Z" fill="${hc}"/><path d="M30 78 Q30 46 60 44 Q90 46 90 78" stroke="#f0ece4" stroke-width="5" fill="none" stroke-dasharray="3 2"/>`;
  if (h === "cap") s += `<path d="M40 46 Q40 30 60 30 Q80 30 80 46 Z" fill="${hc}"/><path d="M38 46 L84 46 L94 51 L40 51 Z" fill="${shade(hc, 0.7)}"/><circle cx="60" cy="38" r="3" fill="#c9a060"/>`;
  if (h === "scarfhead") s += `<path d="M36 58 Q36 28 60 28 Q84 28 84 58 Q78 40 60 40 Q42 40 36 58 Z" fill="${hc}"/>`;
  // accessories
  const a = c.acc;
  if (a === "lantern") s += `<g><rect x="12" y="102" width="20" height="26" rx="3" fill="#2a2a34"/><rect x="15" y="106" width="14" height="18" fill="${c.lampC || "#ffd27a"}"/><circle cx="22" cy="115" r="16" fill="${c.lampC || "#ffd27a"}" opacity=".25" filter="url(#${u}b)"/><path d="M15 102 Q22 92 29 102" stroke="#2a2a34" stroke-width="2" fill="none"/></g>`;
  if (a === "clipboard") s += `<g transform="rotate(-8 92 118)"><rect x="80" y="100" width="26" height="34" rx="2" fill="#b98a4e"/><rect x="83" y="106" width="20" height="25" fill="#f4f0e4"/><rect x="88" y="97" width="10" height="6" rx="1" fill="#8a8a96"/><path d="M86 112 h14 M86 117 h12 M86 122 h14" stroke="#8a8a96" stroke-width="1"/></g>`;
  if (a === "ledger") s += `<rect x="78" y="108" width="28" height="24" rx="2" fill="#5a2a1a"/><rect x="80" y="110" width="24" height="20" fill="none" stroke="#c9a060" stroke-width="1"/>`;
  if (a === "flask") s += `<g transform="rotate(12 96 118)"><rect x="88" y="100" width="14" height="32" rx="4" fill="#3a6a4a"/><rect x="88" y="98" width="14" height="5" rx="2" fill="#2a2a2a"/></g>`;
  if (a === "bowtie") s += `<path d="M52 98 L60 102 L52 106 Z M68 98 L60 102 L68 106 Z" fill="#141414"/>`;
  if (a === "scarf") s += `<path d="M42 96 Q60 106 78 96 L80 104 Q60 114 40 104 Z" fill="${c.scarfC || "#b33a3a"}"/><path d="M68 104 L74 128 L66 128 L62 106 Z" fill="${c.scarfC || "#b33a3a"}"/><path d="M46 100 h28" stroke="#fff" stroke-width="1" opacity=".4" stroke-dasharray="3 3"/>`;
  if (a === "pipe") s += `<path d="M64 78 L76 82 L78 76 L84 76 L82 86 L74 86" stroke="#3a2214" stroke-width="3" fill="#3a2214"/>`;
  if (a === "bag") s += `<path d="M30 102 L84 132" stroke="#5a3a1e" stroke-width="4"/><rect x="74" y="122" width="22" height="16" rx="3" fill="#6a4a2a"/>`;
  if (a === "whistle") s += `<path d="M52 100 Q60 116 68 100" stroke="#e8e8e8" stroke-width="1.5" fill="none"/><rect x="57" y="114" width="8" height="5" rx="2" fill="#c0c0c8"/>`;
  if (a === "pencil") s += `<path d="M84 114 L104 100" stroke="#e8b830" stroke-width="4" stroke-linecap="round"/><path d="M104 100 L108 97" stroke="#3a3a3a" stroke-width="3"/>`;
  if (a === "staff") s += `<rect x="96" y="40" width="5" height="100" rx="2" fill="#6a4a2a"/>`;
  if (a === "amber") s += `<circle cx="60" cy="112" r="5" fill="#f2a01a"/><path d="M50 100 Q60 108 70 100" stroke="#c9a060" stroke-width="1" fill="none"/>`;
  if (a === "badge") s += `<rect x="72" y="110" width="16" height="10" rx="2" fill="#f0f0f0"/><rect x="74" y="113" width="12" height="2" fill="#3a5aa0"/>`;
  if (a === "wristband") s += `<rect x="20" y="124" width="14" height="6" rx="2" fill="#e83a8a"/>`;
  return s;
}
function wrapSVG(inner, cls = "") { return `<svg viewBox="0 0 120 140" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" class="${cls}" aria-hidden="true" focusable="false">${inner}</svg>`; }

// Built-in story characters. Keys are matched case-insensitively against `who`.
// vary: the face is seeded from the name tag, so "Local (Railway man)" and "Local (Fisherman)" look different.
const NPC = {
  morwenna: { name: "Morwenna", skin: "#ead2bd", hair: "#cfd4de", hairStyle: "long", hat: "shawl", hatC: "#2e3d6e", coat: "#26315c", eyes: "glow", eyeC: "#9fdcff", mouth: "flat", acc: "lantern", lampC: "#cfeaff", bg: "#24407a" },
  ishbel: { name: "Ishbel", skin: "#ecd3bf", hair: "#c9ced8", hairStyle: "bun", coat: "#4a5a3a", acc: "scarf", scarfC: "#a83232", mouth: "smirk", bg: "#3a5a4a" },
  solveig: { name: "Solveig", skin: "#f0d8c4", hair: "#e8d9a8", hairStyle: "long", hat: "hood", hatC: "#7a5a3a", coat: "#5a2e2e", acc: "lantern", mouth: "smirk", bg: "#4a3a6a" },
  taxman: { name: "The Taxman", skin: "#e6cdb5", hair: "#3a3a40", hairStyle: "short", hat: "bowler", hatC: "#1c1c24", coat: "#3e4350", shirt: "#f0eee6", tie: "#7a1f2b", acc: "clipboard", glasses: true, tache: true, mouth: "smirk", bg: "#3b3f56", boss: "taxman" },
  holloway: { name: "Abiah Holloway", skin: "#e2cbb4", hair: "#d9d9d9", hairStyle: "short", hat: "tricorn", hatC: "#22201e", coat: "#3a2a1e", shirt: "#e8e0d0", acc: "lantern", mouth: "frown", ghost: true, bg: "#2a3a5a" },
  kit: { name: "Kit", skin: "#f0d6c0", hair: "#a0522d", hairStyle: "wild", coat: "#6b4a2b", shirt: "#e8e0d0", freckles: true, mouth: "o", acc: "bag", ghost: true, bg: "#2a4a6a" },
  donnie: { name: "Donnie", skin: "#e2b89a", hair: "#7a6a5a", hairStyle: "crop", hat: "beanie", hatC: "#2b4a8a", coat: "#e0b020", beard: true, mouth: "smile", bg: "#2a3a4a" },
  druid: { name: "The Druid", skin: "#e8c4a4", hair: "#8a7a6a", hat: "druid", hatC: "#3f6e3a", coat: "#3f6e3a", beard: true, eyes: "kind", mouth: "smile", acc: "wristband", bg: "#3a5a2a" },
  guide: { name: "Guide", vary: true, hairStyle: "bun", glasses: true, mouth: "smile", acc: "badge" },
  navvy: { name: "The Navvy", skin: "#d8b896", hair: "#3a2a1a", hairStyle: "crop", hat: "flatcap", hatC: "#4a4038", coat: "#4a3a2a", tache: true, acc: "pipe", ghost: true, mouth: "smile", bg: "#2a3048" },
  margaret: { name: "Margaret", skin: "#ecd0bc", hair: "#e0e0e0", hairStyle: "short", hat: "beanie", hatC: "#c04a6a", coat: "#3a6a9a", glasses: true, acc: "flask", mouth: "smile", bg: "#5a6a8a" },
  centurion: { name: "The Centurion", skin: "#e0b898", hair: "#3a2a1a", hairStyle: "crop", hat: "helmet", coat: "#9a2a2a", armour: true, mouth: "frown", bg: "#5a3a4a" },
  ingrid: { name: "Ingrid", skin: "#f2dccc", hair: "#e0d0b0", hairStyle: "long", hat: "beanie", hatC: "#e0a030", coat: "#c04030", glasses: true, acc: "pencil", bg: "#4a6a8a" },
  trond: { name: "Trond", skin: "#ecd0bc", hair: "#c8c8c8", hairStyle: "crop", coat: "#2a5a9a", acc: "whistle", mouth: "smile", bg: "#3a4a7a" },
  maret: { name: "Máret", skin: "#e4c4a8", hair: "#2a1a10", hairStyle: "long", hat: "hood", hatC: "#2a4ab0", coat: "#2a4ab0", acc: "scarf", scarfC: "#d23a2a", mouth: "smile", bg: "#3a4a8a" },
  kadri: { name: "Kadri", skin: "#f0d4bc", hair: "#c08040", hairStyle: "long", coat: "#8a5a2a", acc: "amber", mouth: "smirk", bg: "#6a4a2a" },
  pawel: { name: "Paweł", skin: "#ecd0bc", hair: "#3a2a1a", hairStyle: "short", coat: "#2a2a4a", glasses: true, mouth: "smile", bg: "#1a2a5a" },
  waiter: { name: "Head waiter", skin: "#e8ccb4", hair: "#2a2a2a", hairStyle: "short", coat: "#141418", shirt: "#ffffff", tache: true, acc: "bowtie", mouth: "flat", bg: "#4a3020" },
  farmer: { name: "Farmer", vary: true, hat: "flatcap", hatC: "#5a5a3a", beard: true, mouth: "smile" },
  ranger: { name: "Ranger", vary: true, hat: "cap", hatC: "#3a5a3a", mouth: "smile" },
  clerk: { name: "Clerk", vary: true, glasses: true, hairStyle: "bun", mouth: "flat" },
  curator: { name: "Curator", vary: true, glasses: true, hairStyle: "short", mouth: "flat", acc: "badge" },
  lacemaker: { name: "Lacemaker", vary: true, hairStyle: "bun", hat: "scarfhead", hatC: "#e8e0d0", eyes: "kind", mouth: "smile" },
  monk: { name: "Monk", vary: true, hairStyle: "none", eyes: "kind", mouth: "smile", coat: "#c8701a" },
  keeper: { name: "Keeper", vary: true, acc: "lantern", mouth: "smile" },
  local: { name: "Local", vary: true, mouth: "smile" },
  child: { name: "Child", vary: true, hairStyle: "wild", mouth: "o", freckles: true },
  skipper: { name: "Skipper", vary: true, hat: "beanie", hatC: "#1a3a6a", beard: true, mouth: "smirk" },
};
const NPC_KEYS = Object.keys(NPC);
function npcConfig(key, displayName) {
  const base = NPC[key] || { vary: true };
  if (!base.vary) return base;
  const r = rng(hash((displayName || key) + ":" + key));
  const pick = (L) => L[Math.floor(r() * L.length)];
  const styles = ["short", "long", "bun", "crop", "wild", "short"];
  return { skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(styles), coat: pick(COATS), bg: pick(["#34468c", "#3a5a6a", "#5a3a6a", "#3a5a3a", "#6a4a3a"]), mouth: pick(["smile", "flat", "smirk"]), ...base, ...(base.hairStyle === "none" ? { hairStyle: "" } : {}), vary: false };
}

// Fallback boss drawings, used when opts.portrait() has none.
const BOSS_ART = {
  notification: () => `<defs><radialGradient id="bn" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#a6f0b8"/><stop offset="1" stop-color="#3fa45e"/></radialGradient></defs><rect width="120" height="140" fill="#1b2a3e"/><ellipse cx="60" cy="134" rx="48" ry="6" fill="#000" opacity=".35"/><path d="M12 134 Q6 70 60 54 Q114 70 108 134 Z" fill="url(#bn)"/><ellipse cx="40" cy="76" rx="10" ry="6" fill="#fff" opacity=".4"/><circle cx="46" cy="96" r="8" fill="#fff"/><circle cx="74" cy="96" r="8" fill="#fff"/><circle cx="48" cy="98" r="4" fill="#142a1c"/><circle cx="72" cy="98" r="4" fill="#142a1c"/><path d="M46 114 Q60 124 74 114" fill="#1e4a2c"/><ellipse cx="22" cy="134" rx="5" ry="3" fill="#3fa45e"/><circle cx="94" cy="58" r="14" fill="#ff3b4f"/><text x="94" y="64" font-family="Rubik,Arial" font-weight="800" font-size="17" fill="#fff" text-anchor="middle">1</text>`,
  autoplay: () => `<rect width="120" height="140" fill="#2a1a2e"/><g fill="#ffe08a" opacity=".55"><circle cx="16" cy="40" r="3"/><circle cx="102" cy="30" r="4"/><circle cx="96" cy="70" r="2.5"/><circle cx="22" cy="80" r="2"/></g><path d="M18 140 Q14 72 60 60 Q106 72 102 140 Z" fill="#f08a24"/><path d="M36 72 L26 40 L48 64 Z M84 72 L94 40 L72 64 Z" fill="#ffd9a0"/><ellipse cx="46" cy="88" rx="9" ry="7" fill="#fff36a"/><ellipse cx="74" cy="88" rx="9" ry="7" fill="#fff36a"/><rect x="45" y="82" width="2.5" height="12" fill="#2a1a0a"/><rect x="73" y="82" width="2.5" height="12" fill="#2a1a0a"/><path d="M38 104 Q60 120 82 104 Q60 112 38 104 Z" fill="#5a1a0a"/><path d="M46 106 l3 6 l3 -5 M64 107 l3 5 l3 -6" fill="#fff"/><path d="M52 120 L52 134 L66 127 Z" fill="#fff" opacity=".85"/>`,
  leftonread: () => `<defs><filter id="bw"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="120" height="140" fill="#101a34"/><path d="M26 134 L26 70 Q26 30 60 30 Q94 30 94 70 L94 134 L86 126 L78 134 L70 126 L62 134 L54 126 L46 134 L38 126 Z" fill="#cfe2ff" opacity=".35" filter="url(#bw)"/><path d="M28 134 L28 70 Q28 34 60 34 Q92 34 92 70 L92 134 L84 126 L76 134 L68 126 L60 134 L52 126 L44 134 L36 126 Z" fill="#e2ecff" opacity=".88"/><ellipse cx="48" cy="72" rx="7" ry="10" fill="#18223f"/><ellipse cx="72" cy="72" rx="7" ry="10" fill="#18223f"/><ellipse cx="60" cy="96" rx="4" ry="6" fill="#18223f"/><text x="96" y="132" font-family="Rubik,Arial" font-weight="700" font-size="13" fill="#5aa0ff" text-anchor="end">✓✓</text>`,
  scroll: () => `<rect width="120" height="140" fill="#14263a"/><g fill="none" stroke="#9fe3ef" stroke-linecap="round">${[[60, 30, 44, 6], [62, 50, 36, 5], [58, 70, 28, 5], [60, 88, 20, 4], [62, 104, 13, 4], [60, 118, 7, 3]].map(([x, y, rx, w]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx / 4 + 2}" stroke-width="${w}" opacity=".85"/>`).join("")}</g><path d="M50 46 l8 3 M70 46 l-8 3" stroke="#fff" stroke-width="3" stroke-linecap="round"/><g fill="#cfe9ef"><rect x="14" y="40" width="6" height="9" rx="1"/><rect x="98" y="64" width="6" height="9" rx="1" transform="rotate(20 101 68)"/><circle cx="20" cy="96" r="2"/></g>`,
  kraken: () => `<rect width="120" height="140" fill="#0a1a30"/><g fill="#7a3a9a">${[20, 40, 60, 80, 100].map((x, i) => `<path d="M${x - 6} 140 Q${x - 10} ${110 - (i % 2) * 8} ${x + (i % 2 ? 8 : -8)} 96 L${x + 6} 100 Q${x} 116 ${x + 6} 140 Z"/>`).join("")}</g><path d="M24 100 Q20 30 60 26 Q100 30 96 100 Q60 112 24 100 Z" fill="#9a4ab8"/><ellipse cx="44" cy="72" rx="9" ry="11" fill="#5fb8ff"/><ellipse cx="76" cy="72" rx="9" ry="11" fill="#5fb8ff"/><ellipse cx="44" cy="74" rx="3" ry="6" fill="#06101e"/><ellipse cx="76" cy="74" rx="3" ry="6" fill="#06101e"/><g fill="#c47ae0"><circle cx="34" cy="46" r="3"/><circle cx="84" cy="44" r="4"/><circle cx="62" cy="38" r="2.5"/></g>`,
  algorithm: () => `<rect width="120" height="140" fill="#14183a"/><path d="M8 140 C10 110 30 100 60 100 C90 100 110 110 112 140 Z" fill="#2f4fa8"/><path d="M28 98 Q22 38 60 32 Q98 38 92 98 Q60 112 28 98 Z" fill="#4f7be0"/><path d="M34 62 L86 62 L82 72 L38 72 Z" fill="#2f4fa8"/><circle cx="48" cy="76" r="4" fill="#ffd23d"/><circle cx="72" cy="76" r="4" fill="#ffd23d"/><path d="M46 94 H74" stroke="#1a2a5a" stroke-width="3"/><path d="M48 94 l2 -6 l2 6 M68 94 l2 -6 l2 6" fill="#f0f0f0"/><g transform="rotate(28 100 70)"><rect x="92" y="20" width="16" height="70" rx="8" fill="#7a4a24"/><circle cx="96" cy="32" r="2.5" fill="#c0c0c8"/><circle cx="104" cy="44" r="2.5" fill="#c0c0c8"/><circle cx="96" cy="56" r="2.5" fill="#c0c0c8"/></g>`,
  dragon: () => `<rect width="120" height="140" fill="#2a0e14"/><path d="M80 96 Q100 104 118 96 Q104 112 118 124 Q98 118 84 110 Z" fill="#ff9a2a" opacity=".9"/><path d="M84 102 Q98 106 110 102 Q100 110 108 116 Q96 112 86 108 Z" fill="#ffe07a"/><path d="M18 140 Q14 80 40 64 Q60 52 80 70 L96 92 Q90 104 76 104 Q66 120 70 140 Z" fill="#c42a2a"/><path d="M36 66 L22 30 L46 58 Z M54 58 L52 22 L64 56 Z" fill="#3a1a1a"/><ellipse cx="62" cy="76" rx="6" ry="4" fill="#ffd23d"/><rect x="61" y="72" width="2" height="8" fill="#2a0a0a"/><path d="M24 96 L40 92 M22 108 L38 106 M26 120 L42 120" stroke="#8a1a1a" stroke-width="3"/><path d="M74 96 l4 6 l3 -6" fill="#fff"/>`,
};
const BOSS_NAMES = { notification: "Brett", autoplay: "Rory", leftonread: "Wisp", scroll: "Gale", kraken: "The Kraken", algorithm: "Grimm", dragon: "Vex", taxman: "The Taxman",
  newyear: "Rez", spring: "Atchoo", solstice: "Solveig", harvest: "Big Marrow Morris", haunted: "The Grey Lady", krampus: "Krampus" };
const EVENT_MODEL = { newyear: ["notification", 160], spring: ["autoplay", 60], solstice: ["dragon", 40], harvest: ["algorithm", 170], haunted: ["leftonread", 200], krampus: ["algorithm", 140] };
const ALIASES = { brett: "boss:notification", rory: "boss:autoplay", wisp: "boss:leftonread", gale: "boss:scroll", kraken: "boss:kraken", grimm: "boss:algorithm", vex: "boss:dragon", krampus: "boss:krampus" };
function bossArt(id) {
  if (BOSS_ART[id]) return wrapSVG(BOSS_ART[id]());
  if (id === "taxman") return wrapSVG(personSVG(NPC.taxman));
  const ev = EVENT_MODEL[id.replace(/^ev-/, "")];
  if (ev) return wrapSVG(`<g style="filter:hue-rotate(${ev[1]}deg)">${BOSS_ART[ev[0]]()}</g>`);
  return wrapSVG(BOSS_ART.algorithm());
}
function walkerSVG(name, me) {
  const hue = me ? 42 : hash(name) % 360, c1 = `hsl(${hue} 72% 56%)`, c2 = `hsl(${hue} 55% 28%)`, c3 = `hsl(${hue} 45% 82%)`, u = "w" + (uid++);
  const ini = esc((String(name || "?").trim()[0] || "?").toUpperCase());
  return wrapSVG(`<defs><radialGradient id="${u}" cx="50%" cy="34%" r="78%"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="#0b1027"/></radialGradient></defs><rect width="120" height="140" fill="url(#${u})"/>` +
    `<path d="M18 140 C20 110 38 98 60 98 C82 98 100 110 102 140 Z" fill="${c1}"/><path d="M40 104 L44 140 M80 104 L76 140" stroke="${c2}" stroke-width="5"/>` +
    `<circle cx="60" cy="64" r="22" fill="${c3}"/><path d="M38 60 Q38 36 60 36 Q82 36 82 60 Z" fill="${c1}"/><rect x="37" y="54" width="46" height="8" rx="3" fill="${c2}"/><circle cx="60" cy="34" r="6" fill="${c3}"/>` +
    `<circle cx="52" cy="68" r="2.6" fill="#1d1a26"/><circle cx="68" cy="68" r="2.6" fill="#1d1a26"/><path d="M53 78 Q60 83 67 78" stroke="#1d1a26" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<text x="60" y="132" font-family="Lilita One,Rubik,Arial" font-size="20" fill="#fff" text-anchor="middle">${ini}</text>`);
}

// ---------- text ----------
const CAP_AT = /(^|[.!?…]["”’)]?\s+|^["“‘(]|\n)$/;
function fill(text, ctx = {}, pick = {}) {
  const mates = (ctx.mates || []).filter(Boolean);
  const vals = {
    you: ctx.you || "you",
    squad: ctx.squad || "the squad",
    mate: pick.mate || mates[0] || "your mate",
    mate2: pick.mate2 || mates[1] || (mates[0] && mates[0] !== (pick.mate || mates[0]) ? mates[0] : "") || "someone else",
    steps: typeof ctx.steps === "number" && isFinite(ctx.steps) ? Math.round(ctx.steps).toLocaleString("en-GB") : (ctx.steps ? String(ctx.steps) : "thousands of"),
  };
  return String(text ?? "").replace(/\{(you|squad|mate2?|steps)\}/g, (m, k, off, s) => {
    let v = vals[k];
    if (CAP_AT.test(s.slice(0, off)) && v) v = v[0].toUpperCase() + v.slice(1);
    return v;
  });
}
// "*word*" -> emphasis. Returns [{t, em}]
function segs(text) {
  const out = []; const re = /\*([^*]+)\*/g; let last = 0, m;
  while ((m = re.exec(text))) { if (m.index > last) out.push({ t: text.slice(last, m.index) }); out.push({ t: m[1], em: true }); last = re.lastIndex; }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
function segHTML(S, n = Infinity) {
  let h = "", left = n;
  for (const s of S) { if (left <= 0) break; const t = [...s.t].slice(0, left).join(""); left -= [...s.t].length; h += s.em ? `<em>${esc(t)}</em>` : esc(t); }
  return h;
}

// ---------- validation ----------
const FX = ["shake", "flash", "dark", "light", "glitch", "fade"];
function validate(script, path = "script") {
  const errs = [];
  if (!Array.isArray(script)) return [`${path}: not an array`];
  script.forEach((st, i) => {
    const p = `${path}[${i}]`;
    if (!st || typeof st !== "object") { errs.push(`${p}: not an object`); return; }
    const keys = Object.keys(st);
    const known = ["bg", "who", "name", "text", "narrate", "fx", "card", "sub", "choice", "if", "then", "else", "set", "unset"];
    for (const k of keys) if (!known.includes(k)) errs.push(`${p}: unknown key "${k}"`);
    if ("bg" in st && !BG[st.bg]) errs.push(`${p}: unknown bg "${st.bg}"`);
    if ("fx" in st && !FX.includes(st.fx)) errs.push(`${p}: unknown fx "${st.fx}"`);
    if ("text" in st && (typeof st.text !== "string" || !st.text.trim())) errs.push(`${p}: empty text`);
    if ("narrate" in st && (typeof st.narrate !== "string" || !st.narrate.trim())) errs.push(`${p}: empty narrate`);
    if ("text" in st && !st.who) errs.push(`${p}: text without who`);
    if (st.who && !("text" in st) && !("choice" in st)) errs.push(`${p}: who without text`);
    if ("choice" in st) {
      if (!Array.isArray(st.choice) || st.choice.length < 1 || st.choice.length > 3) errs.push(`${p}: choice needs 1-3 options`);
      else st.choice.forEach((o, j) => {
        if (!o || typeof o.label !== "string" || !o.label.trim()) errs.push(`${p}.choice[${j}]: no label`);
        if (o && o.then !== undefined) errs.push(...validate(o.then, `${p}.choice[${j}].then`));
      });
    }
    if ("if" in st) {
      if (typeof st.if !== "string" || !st.if) errs.push(`${p}: bad if`);
      if (st.then !== undefined) errs.push(...validate(st.then, `${p}.then`));
      if (st.else !== undefined) errs.push(...validate(st.else, `${p}.else`));
    }
    const kinds = ["bg", "text", "narrate", "fx", "card", "choice", "if", "set", "unset"].filter((k) => k in st);
    if (!kinds.length) errs.push(`${p}: does nothing`);
  });
  return errs;
}

// ---------- flags ----------
const MEM = {};
function loadFlags(key) {
  try { if (typeof localStorage !== "undefined") { const v = JSON.parse(localStorage.getItem(key) || "{}"); if (v && typeof v === "object") return v; } } catch { /* blocked storage */ }
  return { ...(MEM[key] || {}) };
}
function saveFlags(key, flags) {
  MEM[key] = { ...flags };
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(flags)); } catch { /* blocked storage */ }
}
function testFlag(expr, flags) {
  const one = (t) => { t = t.trim(); return t[0] === "!" ? !flags[t.slice(1).trim()] : !!flags[t]; };
  return String(expr).split("|").some((any) => any.split("&").every(one));
}

// ---------- CSS ----------
const CSS = `
.es-root{position:fixed;inset:0;z-index:10000;background:#0b1027;color:#f4f6ff;font-family:Rubik,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;opacity:0;transition:opacity .3s ease;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;touch-action:manipulation;cursor:pointer;outline:none;overscroll-behavior:contain}
.es-root.es-on{opacity:1}
.es-root *{box-sizing:border-box}
.es-frame{position:absolute;inset:0;margin:0 auto;max-width:560px;overflow:hidden;background:#0b1027;box-shadow:0 0 90px rgba(0,0,0,.7)}
.es-scene{position:absolute;inset:0}
.es-bg{position:absolute;inset:0;opacity:0;transition:opacity .7s ease}
.es-bg.es-show{opacity:1}
.es-bg>svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.es-ly{position:absolute;inset:0;pointer-events:none}
.es-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 38%,transparent 45%,rgba(4,6,18,.6) 100%)}
.es-dim{position:absolute;inset:0;pointer-events:none;background:rgba(2,4,14,.62);opacity:0;transition:opacity .6s}
.es-root.es-isdark .es-dim{opacity:1}
.es-black{position:absolute;inset:0;z-index:8;pointer-events:none;background:#000;opacity:0;transition:opacity .4s}
.es-black.es-show{opacity:1}
.es-flashl{position:absolute;inset:0;z-index:8;pointer-events:none;background:#fff;opacity:0}
.es-flashl.es-go{animation:es-flash .7s ease-out}
.es-frame.es-shake{animation:es-shake .5s}
.es-frame.es-glitch .es-scene{animation:es-glitch .8s steps(2) 1}
.es-frame.es-glitch .es-box{animation:es-glitchb .8s steps(2) 1}
.es-top{position:absolute;z-index:9;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:8px;padding:max(12px,calc(env(safe-area-inset-top) + 8px)) max(12px,env(safe-area-inset-right)) 0 max(12px,env(safe-area-inset-left))}
.es-chip{flex:1 1 auto;min-width:0;font:600 13px/1.3 Rubik,system-ui,sans-serif;letter-spacing:.02em;color:#ffe7a3;background:rgba(11,16,39,.74);border:1px solid rgba(255,200,61,.35);border-radius:14px;padding:7px 12px;overflow-wrap:anywhere}
.es-chip:empty{visibility:hidden}
.es-skip{flex:none;font:700 14px/1 Rubik,system-ui,sans-serif;color:#0b1027;background:#ffc83d;border:0;border-radius:999px;padding:10px 16px;min-height:38px;cursor:pointer;box-shadow:0 2px 0 #b8881a}
.es-skip:active{transform:translateY(1px);box-shadow:none}
.es-prog{position:absolute;z-index:6;left:0;right:0;top:0;height:3px;background:rgba(255,255,255,.08)}
.es-prog i{display:block;height:100%;width:0;background:#ffc83d;transition:width .35s}
.es-bot{position:absolute;z-index:5;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:10px;padding:0 max(12px,env(safe-area-inset-right)) max(14px,calc(env(safe-area-inset-bottom) + 10px)) max(12px,env(safe-area-inset-left))}
.es-pors{position:relative;height:clamp(98px,21vh,172px);pointer-events:none;flex:none}
.es-por{position:absolute;bottom:-16px;width:clamp(92px,32vw,150px);aspect-ratio:6/7;opacity:0;transform:translateY(14px);transition:opacity .3s,transform .3s,filter .3s}
.es-por.es-l{left:4px}.es-por.es-r{right:4px}
.es-por.es-show{opacity:1;transform:none}
.es-por.es-show.es-dimp{filter:brightness(.45) saturate(.6);transform:scale(.9) translateY(8px)}
.es-por>div{width:100%;height:100%;border-radius:18px;overflow:hidden;background:#1d2a5e;box-shadow:0 6px 18px rgba(0,0,0,.55),0 0 0 3px rgba(255,200,61,.9)}
.es-por.es-boss>div{box-shadow:0 6px 18px rgba(0,0,0,.55),0 0 0 3px #ff6b6b,0 0 26px rgba(255,80,80,.45)}
.es-por.es-ghost>div{box-shadow:0 6px 18px rgba(0,0,0,.55),0 0 0 3px #9fd0ff,0 0 26px rgba(150,200,255,.5)}
.es-por.es-ghost>div>svg{opacity:.82;filter:saturate(.55)}
.es-por.es-sil>div svg>*{filter:brightness(0)}
.es-por.es-sil>div svg>rect:first-of-type{filter:brightness(.55) saturate(.6)}
.es-por.es-sil>div>img,.es-por.es-sil>div>canvas{filter:brightness(0) drop-shadow(0 0 6px #6a7aa8)}
.es-por.es-sil>div{box-shadow:0 6px 18px rgba(0,0,0,.55),0 0 0 3px #6a7aa8,0 0 22px rgba(120,160,255,.35)}
.es-por svg,.es-por img,.es-por canvas{width:100%;height:100%;display:block;object-fit:cover}
.es-choices{display:flex;flex-direction:column;gap:8px}
.es-choice{display:block;width:100%;text-align:left;font:600 16px/1.35 Rubik,system-ui,sans-serif;color:#fff;background:rgba(11,16,39,.92);border:2px solid #ffc83d;border-radius:14px;padding:12px 14px 12px 40px;cursor:pointer;position:relative;white-space:normal;overflow-wrap:anywhere;box-shadow:0 4px 14px rgba(0,0,0,.45);opacity:0;transform:translateY(8px);animation:es-in .28s ease forwards}
.es-choice::before{content:"▸";position:absolute;left:15px;top:11px;color:#ffc83d}
.es-choice:hover,.es-choice:focus-visible{background:#1d2a5e;outline:none}
.es-choice:active{transform:translateY(1px)}
.es-boxw{position:relative;margin-top:16px;flex:none}
.es-name{position:absolute;z-index:2;top:-16px;left:14px;max-width:calc(100% - 28px);font:400 17px/1.2 "Lilita One",Rubik,sans-serif;letter-spacing:.02em;color:#0b1027;background:#ffc83d;border-radius:10px;padding:5px 12px 4px;box-shadow:0 2px 0 #b8881a;overflow-wrap:anywhere}
.es-name.es-r{left:auto;right:14px}
.es-name.es-boss{background:#ff6b6b;box-shadow:0 2px 0 #a33}
.es-name.es-ghostn{background:#bfe0ff;box-shadow:0 2px 0 #5a7ab0}
.es-name[hidden]{display:none}
.es-box{position:relative;background:linear-gradient(180deg,rgba(36,50,110,.97),rgba(29,42,94,.97));border:3px solid #ffc83d;border-radius:16px;padding:22px 18px 20px;min-height:96px;max-height:min(46vh,360px);overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,.55),inset 0 0 0 2px rgba(11,16,39,.55);-webkit-overflow-scrolling:touch}
.es-box.es-narr{background:linear-gradient(180deg,rgba(11,16,39,.95),rgba(18,25,58,.95));border-color:rgba(255,200,61,.5)}
.es-txt{position:relative;font-size:17px;line-height:1.5;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal}
.es-narr .es-txt{font-style:italic;color:#e2e8ff}
.es-txt em{color:#ffe08a;font-style:italic}
.es-sizer{visibility:hidden}
.es-typed{position:absolute;left:0;top:0;right:0}
.es-next{position:absolute;right:12px;bottom:6px;color:#ffc83d;font-size:13px;opacity:0;pointer-events:none}
.es-next.es-show{opacity:1;animation:es-bob 0.9s ease-in-out infinite}
.es-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.es-card{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px max(24px,env(safe-area-inset-right)) 24px max(24px,env(safe-area-inset-left));background:radial-gradient(ellipse at center,rgba(11,16,39,.84),rgba(4,6,18,.97));opacity:0;pointer-events:none;transition:opacity .45s}
.es-card.es-show{opacity:1;pointer-events:auto}
.es-card b{font:600 clamp(13px,3.8vw,16px)/1.3 Rubik,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#9fb0e6}
.es-card h2{font:400 clamp(30px,9vw,46px)/1.12 "Lilita One",Rubik,sans-serif;color:#ffc83d;margin:12px 0 0;text-shadow:0 3px 0 #7a5a10,0 0 30px rgba(255,200,61,.35);overflow-wrap:anywhere;max-width:100%}
.es-card small{margin-top:30px;font-size:13px;color:#8d9bd0;animation:es-pulse 1.6s ease-in-out infinite}
.es-root.es-carding .es-bot{opacity:0;pointer-events:none}
.es-bot{transition:opacity .3s}
/* animated layers */
.es-fog,.es-fog2,.es-fog-light{inset:-12% -25%}
.es-fog{background:radial-gradient(55% 22% at 22% 64%,rgba(210,218,236,.42),transparent 70%),radial-gradient(50% 20% at 78% 72%,rgba(210,218,236,.36),transparent 70%),radial-gradient(70% 18% at 50% 54%,rgba(210,218,236,.26),transparent 70%);animation:es-drift 17s ease-in-out infinite alternate}
.es-fog2{background:radial-gradient(45% 16% at 35% 78%,rgba(220,226,240,.34),transparent 70%),radial-gradient(40% 14% at 70% 46%,rgba(220,226,240,.22),transparent 70%);animation:es-drift 23s ease-in-out -6s infinite alternate-reverse}
.es-fog-light{background:radial-gradient(60% 16% at 30% 66%,rgba(170,190,230,.16),transparent 70%),radial-gradient(55% 14% at 76% 72%,rgba(170,190,230,.13),transparent 70%);animation:es-drift 21s ease-in-out infinite alternate}
.es-snow,.es-snow2{background-image:radial-gradient(2.2px 2.2px at 12% 18%,#fff 50%,transparent 52%),radial-gradient(1.6px 1.6px at 38% 62%,#fff 50%,transparent 52%),radial-gradient(2px 2px at 66% 34%,#fff 50%,transparent 52%),radial-gradient(1.4px 1.4px at 84% 80%,#fff 50%,transparent 52%),radial-gradient(1.8px 1.8px at 52% 92%,#fff 50%,transparent 52%);background-size:180px 180px;animation:es-fall 8s linear infinite;opacity:.85}
.es-snow2{background-size:110px 110px;animation-duration:5.5s;opacity:.55}
.es-rain,.es-rain-light{background-image:linear-gradient(105deg,transparent 46%,rgba(190,210,255,.35) 49%,transparent 52%);background-size:26px 64px;animation:es-rain .45s linear infinite}
.es-rain-light{opacity:.4;animation-duration:.7s}
.es-aurora{inset:-8% -30% 45% -30%;background:linear-gradient(100deg,transparent 8%,rgba(80,255,170,.38) 26%,transparent 40%,rgba(60,220,210,.32) 56%,transparent 70%,rgba(150,255,160,.28) 86%,transparent);filter:blur(14px);animation:es-aur 11s ease-in-out infinite alternate;transform-origin:50% 0}
.es-wind{background-image:radial-gradient(60px 1.2px at 20% 30%,rgba(255,255,255,.55),transparent),radial-gradient(90px 1px at 70% 60%,rgba(255,255,255,.45),transparent),radial-gradient(50px 1px at 40% 85%,rgba(255,255,255,.4),transparent);background-size:320px 220px;animation:es-wind 2.2s linear infinite}
.es-rays{inset:-10% -20%;background:repeating-linear-gradient(100deg,rgba(150,210,255,0) 0 38px,rgba(150,210,255,.09) 38px 70px);-webkit-mask-image:linear-gradient(180deg,#000,transparent 70%);mask-image:linear-gradient(180deg,#000,transparent 70%);animation:es-sway 9s ease-in-out infinite alternate}
.es-motes,.es-motes-green{background-image:radial-gradient(2px 2px at 20% 30%,rgba(255,220,150,.8),transparent),radial-gradient(1.6px 1.6px at 70% 60%,rgba(255,220,150,.7),transparent),radial-gradient(1.4px 1.4px at 45% 85%,rgba(255,220,150,.6),transparent);background-size:200px 200px;animation:es-rise 14s linear infinite}
.es-motes-green{background-image:radial-gradient(2.4px 2.4px at 20% 30%,rgba(190,255,120,.9),transparent),radial-gradient(2px 2px at 70% 60%,rgba(190,255,120,.75),transparent);animation-duration:9s}
.es-tw{animation:es-tw 3.2s ease-in-out infinite}
.es-win{animation:es-win 5s ease-in-out infinite}
.es-eye{animation:es-eye 5s ease-in-out infinite}
.es-lamp{animation:es-lampk 3s ease-in-out infinite}
.es-beam{animation:es-beam 9s ease-in-out infinite}
.es-bob{animation:es-bob2 4s ease-in-out infinite}
.es-rock{animation:es-rock 3.4s ease-in-out infinite;transform-origin:200px 470px}
.es-bolt{opacity:0;animation:es-bolt 6s linear infinite}
@keyframes es-in{to{opacity:1;transform:none}}
@keyframes es-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes es-shake{0%,100%{transform:none}15%{transform:translate(-7px,2px)}30%{transform:translate(6px,-3px)}45%{transform:translate(-5px,3px)}60%{transform:translate(4px,-2px)}80%{transform:translate(-2px,1px)}}
@keyframes es-glitch{0%{filter:none;transform:none}20%{filter:hue-rotate(140deg) contrast(1.6);transform:translate(4px,0) skewX(4deg)}40%{filter:invert(.15) hue-rotate(-90deg);transform:translate(-6px,2px)}60%{filter:saturate(3);transform:translate(3px,-2px) skewX(-6deg)}80%{filter:hue-rotate(60deg);transform:translate(-2px,0)}100%{filter:none;transform:none}}
@keyframes es-glitchb{0%,100%{transform:none}30%{transform:translate(3px,0)}60%{transform:translate(-4px,0)}}
@keyframes es-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@keyframes es-bob2{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@keyframes es-pulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes es-drift{from{transform:translateX(-7%)}to{transform:translateX(7%)}}
@keyframes es-fall{from{background-position:0 0}to{background-position:36px 180px}}
@keyframes es-rain{from{background-position:0 0}to{background-position:-14px 64px}}
@keyframes es-aur{from{transform:skewX(-14deg) translateX(-6%)}to{transform:skewX(10deg) translateX(6%)}}
@keyframes es-wind{from{background-position:0 0}to{background-position:-320px 0}}
@keyframes es-sway{from{transform:translateX(-4%)}to{transform:translateX(4%)}}
@keyframes es-rise{from{background-position:0 0}to{background-position:20px -200px}}
@keyframes es-tw{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes es-win{0%,100%{opacity:1}45%{opacity:.75}50%{opacity:.35}55%{opacity:.9}}
@keyframes es-eye{0%,82%,100%{opacity:.95}86%,90%{opacity:0}}
@keyframes es-lampk{0%,100%{opacity:1}50%{opacity:.7}}
@keyframes es-beam{0%{transform:scaleX(1)}50%{transform:scaleX(-1)}100%{transform:scaleX(1)}}
@keyframes es-rock{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes es-bolt{0%,92%,96%,100%{opacity:0}93%,95%{opacity:1}}
@media (prefers-reduced-motion: reduce){.es-root,.es-root *,.es-root *::before{animation:none!important;transition:none!important}.es-choice{opacity:1;transform:none}.es-bolt{opacity:0}}
@media (max-height:600px){.es-pors{height:clamp(72px,17vh,120px)}.es-por{width:clamp(70px,22vw,110px)}.es-txt{font-size:16px}}
`;
function injectCSS() {
  if (!HAS_DOM || document.getElementById("es-style")) return;
  const s = document.createElement("style"); s.id = "es-style"; s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

// ---------- player ----------
let P = null; // the running player
const reduced = () => { try { return !!(HAS_DOM && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { return false; } };
const now = () => (HAS_DOM && window.performance ? performance.now() : Date.now());

function bgHTML(name) {
  const d = BG[name] || BG["road-night"];
  return `<div class="es-bg" data-bg="${esc(name)}" style="background:${d.sky}">${d.svg()}${(d.layers || []).map((l) => `<div class="es-ly es-${l}"></div>`).join("")}</div>`;
}

function play(script, opts = {}) {
  if (!HAS_DOM) return Promise.resolve({ done: true, headless: true, flags: {} });
  if (P) finish({ closed: true });
  injectCSS();
  const ctx = opts.ctx || {};
  const mates = (ctx.mates || []).filter(Boolean);
  const r = Math.random;
  const mate = mates.length ? mates[Math.floor(r() * mates.length)] : "";
  const others = mates.filter((m) => m !== mate);
  const mate2 = others.length ? others[Math.floor(r() * others.length)] : "";
  const flagKey = opts.flagKey || "effort.story.flags";

  const el = document.createElement("div");
  el.className = "es-root"; el.tabIndex = -1;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", opts.title || "Story");
  el.innerHTML = `<div class="es-frame"><div class="es-scene"></div><div class="es-vig"></div><div class="es-dim"></div>
    <div class="es-prog"><i></i></div>
    <div class="es-top"><div class="es-chip">${esc(opts.title || "")}</div><button type="button" class="es-skip" aria-label="Skip story">Skip ⏭</button></div>
    <div class="es-bot"><div class="es-pors"><div class="es-por es-l"><div></div></div><div class="es-por es-r"><div></div></div></div>
      <div class="es-choices"></div>
      <div class="es-boxw"><div class="es-name" hidden></div><div class="es-box"><div class="es-txt"><div class="es-sizer"></div><div class="es-typed"></div></div><div class="es-next">▼</div></div></div>
      <div class="es-sr" aria-live="polite"></div></div>
    <div class="es-card"><b></b><h2></h2><small>Tap to continue</small></div>
    <div class="es-black"></div><div class="es-flashl"></div></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  return new Promise((resolve) => {
    P = {
      el, $, opts, ctx, pick: { mate, mate2 }, resolve, flagKey, flags: loadFlags(flagKey), prevOverflow,
      stack: [{ steps: Array.isArray(script) ? script : [], i: 0, top: true }],
      total: Array.isArray(script) ? script.length : 0,
      mode: "idle", typing: null, segs: null, shown: 0, len: 0, lock: false, readyAt: now() + 280, bg: null, sides: { l: null, r: null },
      speed: Math.max(10, opts.speed || 55), reduced: reduced(), timers: new Set(),
    };
    el.addEventListener("click", onTap);
    $(".es-skip").addEventListener("click", (e) => { e.stopPropagation(); finish({ skipped: true }); });
    window.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => { el.classList.add("es-on"); try { el.focus({ preventScroll: true }); } catch { /* old browsers */ } });
    advance();
  });
}
function later(fn, ms) { const S = P; if (!S) return; const t = setTimeout(() => { S.timers.delete(t); if (P === S) fn(); }, ms); S.timers.add(t); }

function onKey(e) {
  if (!P) return;
  if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
    if (e.target && e.target.classList && (e.target.classList.contains("es-choice") || e.target.classList.contains("es-skip"))) return; // let buttons click
    e.preventDefault(); e.stopPropagation(); tap();
  } else if (P.mode === "choice" && /^[1-3]$/.test(e.key)) {
    const b = P.$(".es-choices").children[Number(e.key) - 1]; if (b) { e.preventDefault(); e.stopPropagation(); b.click(); }
  }
}
function onTap(e) {
  if (!P) return;
  if (e.target.closest && (e.target.closest(".es-choice") || e.target.closest(".es-skip"))) return;
  tap();
}
function tap() {
  const S = P; if (!S || S.lock || now() < S.readyAt) return;
  if (S.mode === "typing") { finishTyping(); return; }
  if (S.mode === "line") { advance(); return; }
  if (S.mode === "card") { S.$(".es-card").classList.remove("es-show"); S.el.classList.remove("es-carding"); advance(); return; }
  // choice: tapping elsewhere does nothing
}

function nextStep() {
  const S = P;
  while (S.stack.length) {
    const f = S.stack[S.stack.length - 1];
    if (f.i >= f.steps.length) { S.stack.pop(); continue; }
    if (f.top) S.$(".es-prog i").style.width = `${Math.round((f.i / Math.max(1, S.total)) * 100)}%`;
    return f.steps[f.i++];
  }
  return null;
}
function push(steps) { if (Array.isArray(steps) && steps.length) P.stack.push({ steps, i: 0 }); }

function advance() {
  const S = P; if (!S) return;
  S.$(".es-next").classList.remove("es-show");
  for (let guard = 0; guard < 400; guard++) {
    const st = nextStep();
    if (!st) { S.$(".es-prog i").style.width = "100%"; finish({ done: true }); return; }
    if (typeof st !== "object") continue;
    if (st.set) { S.flags[st.set] = true; saveFlags(S.flagKey, S.flags); }
    if (st.unset) { delete S.flags[st.unset]; saveFlags(S.flagKey, S.flags); }
    if ("if" in st) { push(testFlag(st.if, S.flags) ? st.then : st.else); continue; }
    if (st.fx === "fade") {
      // dip to black, apply what follows (usually a bg) in the dark, then fade back
      S.lock = true; S.$(".es-black").classList.add("es-show");
      later(() => { S.lock = false; if (st.bg) setBg(st.bg); advance(); later(() => S.$(".es-black").classList.remove("es-show"), 60); }, S.reduced ? 0 : 420);
      return;
    }
    if (st.bg) setBg(st.bg);
    if (st.fx) doFx(st.fx);
    if (st.card != null) { showCard(st); return; }
    if (st.choice) { showChoice(st); return; }
    if (st.text != null || st.narrate != null) { showLine(st); return; }
  }
  finish({ done: true });
}

function setBg(name) {
  const S = P; if (!BG[name] || S.bg === name) return;
  S.bg = name; S.el.classList.remove("es-isdark");
  const scene = S.$(".es-scene");
  scene.insertAdjacentHTML("beforeend", bgHTML(name));
  const fresh = scene.lastElementChild;
  requestAnimationFrame(() => requestAnimationFrame(() => fresh.classList.add("es-show")));
  const old = [...scene.children].filter((c) => c !== fresh);
  later(() => old.forEach((o) => o.remove()), 900);
}
function doFx(fx) {
  const S = P, fr = S.$(".es-frame");
  if (fx === "dark") S.el.classList.add("es-isdark");
  else if (fx === "light") S.el.classList.remove("es-isdark");
  else if (S.reduced) { if (fx === "flash") { const f = S.$(".es-flashl"); f.style.opacity = ".6"; later(() => { f.style.opacity = ""; }, 120); } return; }
  else if (fx === "shake" || fx === "glitch") { const c = "es-" + fx; fr.classList.remove(c); void fr.offsetWidth; fr.classList.add(c); later(() => fr.classList.remove(c), 850); }
  else if (fx === "flash") { const f = S.$(".es-flashl"); f.classList.remove("es-go"); void f.offsetWidth; f.classList.add("es-go"); }
  if (fx === "shake" && navigator.vibrate) { try { navigator.vibrate(40); } catch { /* not allowed */ } }
}

// who -> { key, name, side, boss, ghost, html }
function resolveWho(who, nameOverride) {
  const S = P, o = S.opts, ctx = S.ctx;
  let w = String(who || "").trim();
  if (ALIASES[w.toLowerCase()]) w = ALIASES[w.toLowerCase()];
  const ask = (k) => { try { const h = o.portrait ? o.portrait(k) : null; return h || null; } catch { return null; } };
  if (w === "you") return { key: "you", name: nameOverride || ctx.you || "You", side: "r", html: ask("you") || walkerSVG(ctx.you || "You", true) };
  if (w === "mate" || w === "mate2" || w.startsWith("mate:")) {
    const nm = w.startsWith("mate:") ? w.slice(5) : (w === "mate" ? S.pick.mate : S.pick.mate2);
    const shown = nm || (w === "mate2" ? "Someone in the squad" : "Your mate");
    return { key: "mate:" + shown, name: nameOverride || shown, side: "r", html: (nm && ask("mate:" + nm)) || walkerSVG(shown, false) };
  }
  if (w.startsWith("boss:")) {
    const id = w.slice(5);
    return { key: w, name: nameOverride || BOSS_NAMES[id.replace(/^ev-/, "")] || id, side: "l", boss: true, ghost: id === "leftonread", html: ask(w) || bossArt(id) };
  }
  const k = w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const conf = npcConfig(NPC[k] ? k : "local:" + k, nameOverride || w);
  if (conf.boss) return { key: "boss:" + conf.boss, name: nameOverride || conf.name, side: "l", html: ask("boss:" + conf.boss) || wrapSVG(personSVG(conf)) };
  return { key: "npc:" + k + ":" + (conf === NPC[k] ? "" : nameOverride || w), name: nameOverride || (NPC[k] && NPC[k].name) || w, side: "l", ghost: !!conf.ghost, html: wrapSVG(personSVG(conf)) };
}
function setPortrait(info, sil) {
  const S = P, sides = ["l", "r"];
  for (const sd of sides) {
    const elp = S.$(".es-por.es-" + sd);
    if (info && info.side === sd) {
      const key = info.key + (sil ? "#sil" : "");
      if (S.sides[sd] !== key) {
        S.sides[sd] = key;
        const inner = elp.firstElementChild;
        if (typeof info.html === "string") inner.innerHTML = info.html; else { inner.innerHTML = ""; try { inner.appendChild(info.html.cloneNode ? info.html.cloneNode(true) : info.html); } catch { inner.innerHTML = ""; } }
        elp.classList.toggle("es-boss", !!info.boss && !info.ghost);
        elp.classList.toggle("es-ghost", !!info.ghost);
        elp.classList.toggle("es-sil", !!sil);
        elp.classList.remove("es-show"); void elp.offsetWidth;
      }
      elp.classList.add("es-show"); elp.classList.remove("es-dimp");
    } else if (S.sides[sd]) elp.classList.add("es-dimp");
  }
}
function showLine(st) {
  const S = P, narr = st.narrate != null, nameEl = S.$(".es-name"), box = S.$(".es-box");
  S.$(".es-choices").innerHTML = "";
  if (narr) { setPortrait(null); nameEl.hidden = true; box.classList.add("es-narr"); }
  else {
    const sil = st.name === "???";
    const info = resolveWho(st.who, st.name);
    setPortrait(info, sil);
    nameEl.hidden = false; nameEl.textContent = info.name;
    nameEl.classList.toggle("es-r", info.side === "r");
    nameEl.classList.toggle("es-boss", !!info.boss && !info.ghost);
    nameEl.classList.toggle("es-ghostn", !!info.ghost);
    box.classList.remove("es-narr");
  }
  type(fill(narr ? st.narrate : st.text, S.ctx, S.pick), "line");
}
function type(text, after) {
  const S = P, sizer = S.$(".es-sizer"), typed = S.$(".es-typed"), box = S.$(".es-box");
  S.segs = segs(text); S.len = [...text.replace(/\*([^*]+)\*/g, "$1")].length; S.shown = 0; S.after = after;
  sizer.innerHTML = segHTML(S.segs); typed.innerHTML = ""; box.scrollTop = 0;
  S.$(".es-sr").textContent = text.replace(/\*/g, "");
  if (S.reduced || !S.len) { finishTyping(); return; }
  S.mode = "typing";
  const step = Math.max(1, Math.round(S.speed / 30)), ms = Math.round((1000 / S.speed) * step);
  clearInterval(S.typing);
  S.typing = setInterval(() => {
    if (P !== S) { clearInterval(S.typing); return; }
    S.shown = Math.min(S.len, S.shown + step);
    typed.innerHTML = segHTML(S.segs, S.shown);
    if (S.shown >= S.len) finishTyping();
  }, ms);
}
function finishTyping() {
  const S = P; clearInterval(S.typing); S.typing = null;
  S.$(".es-typed").innerHTML = segHTML(S.segs || []); S.shown = S.len;
  if (S.after === "choice") { S.mode = "choice"; renderChoices(); }
  else { S.mode = "line"; S.$(".es-next").classList.add("es-show"); }
}
function showChoice(st) {
  const S = P;
  S.choiceStep = st;
  if (st.text || st.narrate) {
    const narr = !st.who || st.narrate != null;
    if (narr) { setPortrait(null); S.$(".es-name").hidden = true; S.$(".es-box").classList.add("es-narr"); }
    else {
      const info = resolveWho(st.who, st.name); setPortrait(info, st.name === "???");
      const n = S.$(".es-name"); n.hidden = false; n.textContent = info.name; n.classList.toggle("es-r", info.side === "r"); n.classList.toggle("es-boss", !!info.boss && !info.ghost); n.classList.toggle("es-ghostn", !!info.ghost);
      S.$(".es-box").classList.remove("es-narr");
    }
    type(fill(st.text || st.narrate, S.ctx, S.pick), "choice");
  } else {
    // keep the last line in the box, show the buttons straight away
    S.mode = "choice"; renderChoices();
  }
}
function renderChoices() {
  const S = P, st = S.choiceStep, wrap = S.$(".es-choices");
  S.$(".es-next").classList.remove("es-show");
  wrap.innerHTML = "";
  (st.choice || []).forEach((o, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "es-choice"; b.style.animationDelay = `${i * 70}ms`;
    b.textContent = fill(o.label, S.ctx, S.pick);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (P !== S || S.mode !== "choice") return;
      wrap.innerHTML = "";
      if (o.flag) { S.flags[o.flag] = true; saveFlags(S.flagKey, S.flags); }
      S.mode = "idle"; push(o.then); advance();
    });
    wrap.appendChild(b);
  });
  const first = wrap.firstElementChild; if (first) try { first.focus({ preventScroll: true }); } catch { /* ignore */ }
}
function showCard(st) {
  const S = P, c = S.$(".es-card");
  c.querySelector("b").textContent = fill(st.card, S.ctx, S.pick);
  c.querySelector("h2").textContent = fill(st.sub || "", S.ctx, S.pick);
  c.querySelector("h2").hidden = !st.sub;
  S.$(".es-choices").innerHTML = "";
  S.el.classList.add("es-carding"); c.classList.add("es-show");
  S.mode = "card"; S.readyAt = Math.max(S.readyAt, now() + 350);
}
function finish(result) {
  const S = P; if (!S) return;
  P = null;
  clearInterval(S.typing); S.timers.forEach(clearTimeout);
  window.removeEventListener("keydown", onKey, true);
  document.documentElement.style.overflow = S.prevOverflow;
  S.el.classList.remove("es-on");
  setTimeout(() => S.el.remove(), S.reduced ? 0 : 320);
  S.resolve({ ...result, flags: { ...S.flags } });
}

root.EffortStory = {
  play,
  close: () => { if (P) finish({ closed: true }); },
  isOpen: () => !!P,
  validate,
  fill: (text, ctx) => fill(text, ctx || {}, {}),
  BACKGROUNDS: BG_NAMES,
  NPCS: NPC_KEYS,
  BOSS_NAMES,
  // for previews / tests: the drawn art as SVG strings
  _art: { bg: (n) => (BG[n] ? bgHTML(n) : ""), npc: (k, name) => wrapSVG(personSVG(npcConfig(k, name))), boss: (id) => bossArt(id), walker: (n, me) => walkerSVG(n, me) },
};
})(typeof window !== "undefined" ? window : globalThis);
