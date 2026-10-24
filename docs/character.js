(() => {
"use strict";
// Walker generator: quiz answers → a hand-drawn SVG character. Every answer drives a different part of the
// drawing (palette, body, pattern, ears, eyes, mouth, hat, gear, chest badge) and the free-text word seeds the
// fine details (proportions, tilt, spot placement, wobble), so two people only match if they answer identically.

const QUESTIONS = [
  { id: "name", type: "intro" },
  { id: "time", q: "When are you least insufferable?", type: "choice", options: [
    ["dawn", "Before anyone else is up", "🌅"], ["noon", "After I've eaten", "🍽️"], ["golden", "Golden hour, for the photos", "🌇"], ["night", "3am, achieving nothing", "🌙"]] },
  { id: "pace", q: "Walking pace. Be honest.", type: "choice", options: [
    ["amble", "Nowhere to be, ever", "🐌"], ["stroll", "Aggressively average", "🚶"], ["march", "Late for court", "⏱️"],
    ["strut", "Like there's a camera on me", "🕶️"], ["wander", "No idea where I'm going", "🧭"], ["dash", "Away from my problems", "💨"]] },
  { id: "land", q: "Where do you go to disappear?", type: "choice", options: [
    ["mountains", "Up a mountain, no signal", "⛰️"], ["coast", "The sea, to stare at it", "🌊"], ["forest", "The woods. Don't follow me", "🌲"],
    ["city", "A city at 2am", "🏙️"], ["desert", "Somewhere hot and empty", "🏜️"], ["tundra", "Somewhere cold enough to feel something", "🧊"]] },
  { id: "carry", q: "What's on you at all times?", type: "choice", options: [
    ["backpack", "A bag of stuff I never use", "🎒"], ["umbrella", "An umbrella. Trust issues", "☂️"], ["camera", "A camera, for the content", "📷"],
    ["headphones", "Headphones, so nobody talks to me", "🎧"], ["book", "A book I'm not reading", "📖"], ["stick", "A stick. Found it, kept it", "🪵"], ["none", "Just my phone, sadly", "📱"]] },
  { id: "creature", q: "Pick your familiar", type: "choice", options: [
    ["fox", "Fox. Shady", "🦊"], ["owl", "Owl. Up too late", "🦉"], ["frog", "Frog. Unbothered", "🐸"], ["cat", "Cat. Doesn't care", "🐈"],
    ["crow", "Crow. Holds grudges", "🐦‍⬛"], ["snail", "Snail. Gets there eventually", "🐌"], ["bear", "Bear. Hibernates", "🐻"], ["moth", "Moth. Drawn to screens", "🦋"]] },
  { id: "morning", q: "First thing you do when you wake up?", type: "choice", options: [
    ["coffee", "Caffeine, then personality", "☕"], ["out", "Out the door, no thoughts", "🚪"], ["snooze", "Snooze until it's a problem", "😴"],
    ["music", "Music, too loud", "🔊"], ["stretch", "Stretch like a cat", "🧘"], ["scroll", "Check my phone. Obviously", "📱"]] },
  { id: "laugh", q: "Your laugh, described by your friends", type: "choice", options: [
    ["giggle", "Polite. Suspicious", "🤭"], ["snort", "A snort, then shame", "🐷"], ["cackle", "Villain origin story", "🦹"],
    ["silent", "Silent, shaking, crying", "🫨"], ["boom", "The whole room hears it", "📣"], ["wheeze", "Wheezing, needs help", "😮‍💨"]] },
  { id: "hat", q: "Pick a hat. It says a lot.", type: "choice", options: [
    ["beanie", "Beanie, indoors", "🧶"], ["cap", "Cap, backwards", "🧢"], ["bucket", "Bucket hat, festival scars", "🎣"], ["flowers", "Flower crown, unironically", "🌼"],
    ["wizard", "Wizard hat. Don't ask", "🔮"], ["band", "Sweatband, never sweats", "🎾"], ["none", "No hat. The hair is the personality", "💇"]] },
  { id: "hue", q: "The colour you own way too much of", type: "hue" },
  { id: "month", q: "Birth month. For the astrology people.", type: "choice", compact: true, options:
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => [String(i), m, ""]) },
  { id: "number", q: "Number between 1 and 99. Don't overthink it.", type: "number", min: 1, max: 99 },
  { id: "word", q: "One word for your gravestone", type: "text", placeholder: "unbothered, snacks, why…" },
];

// ---------- seeded randomness ----------
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
}
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const INK = "#1f2a24";
const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
const PALETTES = {
  dawn: (h) => ({ body: hsl(h, 62, 80), shade: hsl(h, 50, 68), belly: hsl(h + 10, 70, 90), pattern: hsl(h - 12, 55, 66) }),
  noon: (h) => ({ body: hsl(h, 78, 62), shade: hsl(h, 70, 50), belly: hsl(h + 8, 85, 82), pattern: hsl(h - 10, 70, 48) }),
  golden: (h) => ({ body: hsl(h + 14, 62, 60), shade: hsl(h + 8, 55, 47), belly: hsl(h + 30, 75, 80), pattern: hsl(h - 4, 58, 45) }),
  night: (h) => ({ body: hsl(h, 40, 42), shade: hsl(h, 38, 32), belly: hsl(h, 38, 60), pattern: hsl(h + 18, 45, 30) }),
};
const SHAPES = {
  amble: { n: 2.2, sx: 1.08, sy: 0.9, wf: () => 1 },
  stroll: { n: 2.3, sx: 1, sy: 1, wf: (t) => 1 - 0.07 * Math.sin(Math.PI * t) },
  march: { n: 3.6, sx: 0.95, sy: 1.02, wf: () => 1 },
  strut: { n: 2.5, sx: 0.8, sy: 1.14, wf: () => 1 },
  wander: { n: 2.2, sx: 1.02, sy: 1, wf: (t) => 0.78 + 0.32 * t },
  dash: { n: 2.4, sx: 1, sy: 1.02, wf: (t) => 0.62 + 0.48 * t },
};

const signature = (a) => QUESTIONS.filter((q) => q.id !== "name").map((q) => String(a[q.id] ?? "").trim().toLowerCase()).join("|");

function traits(a) {
  const sig = signature(a);
  const r = rng(hash(sig));
  const word = rng(hash("w:" + String(a.word || "").trim().toLowerCase()));
  const num = Math.max(1, Math.min(99, Number(a.number) || 7));
  const hue = Number.isFinite(Number(a.hue)) ? Number(a.hue) : Math.floor(r() * 360);
  const pal = (PALETTES[a.time] || PALETTES.noon)(hue);
  return {
    sig, hue, num,
    pal: { ...pal, accent: hsl(hue + 150 + num * 3, 72, 54), accent2: hsl(hue + 200 + num * 5, 68, 62), cheek: "#ff8a8a" },
    shape: SHAPES[a.pace] ? a.pace : "stroll",
    pattern: a.land || "forest", carry: a.carry || "none", feature: a.creature || "bear",
    eyes: a.morning || "coffee", mouth: a.laugh || "giggle", hat: a.hat || "none", month: Number(a.month) || 0,
    scaleX: 0.92 + word() * 0.18, scaleY: 0.92 + word() * 0.16, tilt: (word() - 0.5) * 8,
    eyeGap: 15 + word() * 9, eyeY: 0.36 + word() * 0.1, cheeks: word() > 0.35, freckles: num % 6,
    seed: hash(sig + "#detail"),
  };
}

// ---------- drawing helpers ----------
const f = (n) => Math.round(n * 10) / 10;
function bodyPath(t, cx, cy, bw, bh, jitter) {
  const s = SHAPES[t.shape];
  const r = rng(t.seed);
  const pts = [];
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos(a), sn = Math.sin(a);
    const yy = Math.sign(sn) * Math.abs(sn) ** (2 / s.n);
    const xx = Math.sign(c) * Math.abs(c) ** (2 / s.n);
    const tt = (yy + 1) / 2;
    const j = jitter ? (r() - 0.5) * 1.4 : 0;
    pts.push([cx + (bw * xx * s.wf(tt)) + j, cy + bh * yy + j]);
  }
  return "M" + pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L") + "Z";
}

function eyes(t, cx, ey, gap, mood) {
  const L = cx - gap, R = cx + gap;
  const style = mood === "foggy" ? "glazed" : t.eyes;
  const both = (fn) => fn(L, -1) + fn(R, 1);
  switch (style) {
    case "coffee": return both((x) => `<circle cx="${f(x)}" cy="${f(ey)}" r="7.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="${f(x + 1)}" cy="${f(ey + 1)}" r="4" fill="${INK}"/><circle cx="${f(x + 2.4)}" cy="${f(ey - 1)}" r="1.4" fill="#fff"/>`);
    case "out": return both((x, d) => `<circle cx="${f(x)}" cy="${f(ey + 1)}" r="4.2" fill="${INK}"/><path d="M${f(x - 7 * d)},${f(ey - 9)} L${f(x + 6 * d)},${f(ey - 5)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);
    case "snooze": return both((x) => `<path d="M${f(x - 7)},${f(ey)} Q${f(x)},${f(ey + 7)} ${f(x + 7)},${f(ey)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);
    case "music": return both((x) => `<path d="M${f(x - 7)},${f(ey + 3)} Q${f(x)},${f(ey - 6)} ${f(x + 7)},${f(ey + 3)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);
    case "stretch": return both((x, d) => `<circle cx="${f(x)}" cy="${f(ey)}" r="5" fill="${INK}"/><path d="M${f(x + 3 * d)},${f(ey - 4)} l${f(4 * d)},-4 M${f(x + 5 * d)},${f(ey - 1)} l${f(5 * d)},-2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`);
    case "scroll": return both((x) => `<path d="M${f(x)},${f(ey)} m-1,0 a1,1 0 1,1 2,0 a2.5,2.5 0 1,1 -5,0 a4,4 0 1,1 8,0 a5.5,5.5 0 1,1 -11,0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`);
    case "glazed": return both((x) => `<circle cx="${f(x)}" cy="${f(ey)}" r="7" fill="#e9efe9" stroke="${INK}" stroke-width="2.5"/><path d="M${f(x - 7)},${f(ey - 1)} H${f(x + 7)}" stroke="${INK}" stroke-width="2.5"/><circle cx="${f(x)}" cy="${f(ey + 3)}" r="2.2" fill="${INK}"/>`);
    default: return "";
  }
}

function mouth(t, cx, my, mood) {
  const style = mood === "foggy" ? "flat" : t.mouth;
  switch (style) {
    case "giggle": return `<path d="M${cx - 7},${my} Q${cx},${my + 7} ${cx + 7},${my}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case "snort": return `<path d="M${cx - 8},${my - 1} H${cx + 8} Q${cx + 8},${my + 11} ${cx},${my + 11} Q${cx - 8},${my + 11} ${cx - 8},${my - 1}Z" fill="${INK}"/><ellipse cx="${cx}" cy="${my + 8}" rx="4" ry="2.4" fill="#ff8f9a"/>`;
    case "cackle": return `<path d="M${cx - 12},${my - 2} Q${cx},${my + 13} ${cx + 12},${my - 2}Z" fill="${INK}"/><rect x="${cx - 6}" y="${my - 2}" width="5" height="4" fill="#fff"/>`;
    case "silent": return `<path d="M${cx - 6},${my + 2} q3,-2 6,0 t6,0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case "boom": return `<ellipse cx="${cx}" cy="${my + 5}" rx="8" ry="9" fill="${INK}"/><ellipse cx="${cx}" cy="${my + 10}" rx="5" ry="3" fill="#ff8f9a"/>`;
    case "wheeze": return `<path d="M${cx - 9},${my + 2} l4.5,-4 l4.5,4 l4.5,-4 l4.5,4" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "flat": return `<path d="M${cx - 6},${my + 3} H${cx + 6}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: return "";
  }
}

function feature(t, cx, top, bw, pal) {
  const o = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const L = cx - bw * 0.55, R = cx + bw * 0.55;
  switch (t.feature) {
    case "fox": return [L, R].map((x, i) => { const d = i ? 1 : -1; return `<path d="M${f(x - 13 * d)},${f(top + 16)} L${f(x + 4 * d)},${f(top - 22)} L${f(x + 15 * d)},${f(top + 12)}Z" fill="${pal.body}" ${o}/><path d="M${f(x - 4 * d)},${f(top + 10)} L${f(x + 3 * d)},${f(top - 10)} L${f(x + 8 * d)},${f(top + 8)}Z" fill="${pal.belly}"/>`; }).join("");
    case "owl": return [L, R].map((x, i) => { const d = i ? 1 : -1; return `<path d="M${f(x - 10 * d)},${f(top + 12)} Q${f(x + 2 * d)},${f(top - 8)} ${f(x + 18 * d)},${f(top - 16)} Q${f(x + 12 * d)},${f(top + 2)} ${f(x + 10 * d)},${f(top + 14)}Z" fill="${pal.shade}" ${o}/>`; }).join("");
    case "frog": return [L + 6, R - 6].map((x) => `<circle cx="${f(x)}" cy="${f(top + 6)}" r="15" fill="${pal.body}" ${o}/>`).join("");
    case "cat": return [L + 4, R - 4].map((x, i) => { const d = i ? 1 : -1; return `<path d="M${f(x - 11 * d)},${f(top + 14)} L${f(x + 3 * d)},${f(top - 12)} L${f(x + 12 * d)},${f(top + 12)}Z" fill="${pal.body}" ${o}/>`; }).join("");
    case "bear": return [L + 2, R - 2].map((x) => `<circle cx="${f(x)}" cy="${f(top + 6)}" r="13" fill="${pal.body}" ${o}/><circle cx="${f(x)}" cy="${f(top + 7)}" r="6" fill="${pal.belly}"/>`).join("");
    case "snail": return [cx - 14, cx + 14].map((x, i) => { const d = i ? 1 : -1; return `<path d="M${f(x)},${f(top + 8)} Q${f(x + 4 * d)},${f(top - 16)} ${f(x + 10 * d)},${f(top - 26)}" fill="none" ${o} stroke-linecap="round"/><circle cx="${f(x + 10 * d)}" cy="${f(top - 28)}" r="5" fill="${pal.accent}" ${o}/>`; }).join("");
    case "moth": return [cx - 12, cx + 12].map((x, i) => { const d = i ? 1 : -1; let s = `<path d="M${f(x)},${f(top + 6)} Q${f(x + 8 * d)},${f(top - 18)} ${f(x + 24 * d)},${f(top - 22)}" fill="none" ${o} stroke-linecap="round"/>`; for (let k = 0; k < 4; k++) { const px = x + (6 + k * 5) * d, py = top - 6 - k * 4.5; s += `<path d="M${f(px)},${f(py)} l${f(3 * d)},${-5}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`; } return s; }).join("");
    default: return "";
  }
}

function patternLayer(t, cx, cy, bw, bh, pal) {
  const r = rng(t.seed + 7);
  const p = pal.pattern;
  switch (t.pattern) {
    case "mountains": { let d = `M${cx - bw - 5},${cy + bh * 0.25}`; for (let i = 0; i <= 8; i++) d += ` L${f(cx - bw + (i * 2 * bw) / 8)},${f(cy + bh * (i % 2 ? 0.05 : 0.3))}`; d += ` L${cx + bw + 5},${cy + bh + 5} L${cx - bw - 5},${cy + bh + 5}Z`; return `<path d="${d}" fill="${p}"/>`; }
    case "coast": return [0.1, 0.35, 0.6].map((k) => `<path d="M${cx - bw - 5},${f(cy + bh * k)} q${f(bw / 4)},-8 ${f(bw / 2)},0 t${f(bw / 2)},0 t${f(bw / 2)},0 t${f(bw / 2)},0 t${f(bw / 2)},0" fill="none" stroke="${p}" stroke-width="6" stroke-linecap="round"/>`).join("");
    case "forest": return Array.from({ length: 7 }, () => `<ellipse cx="${f(cx + (r() - 0.5) * bw * 1.8)}" cy="${f(cy + (r() - 0.2) * bh * 1.1)}" rx="7" ry="3.6" transform="rotate(${f(r() * 180)} ${f(cx)} ${f(cy)})" fill="${p}"/>`).join("");
    case "city": { let s = ""; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) if (r() > 0.25) s += `<rect x="${f(cx - 26 + j * 14)}" y="${f(cy + bh * 0.22 + i * 13)}" width="9" height="8" rx="1.5" fill="${p}"/>`; return s; }
    case "desert": return Array.from({ length: 16 }, () => `<circle cx="${f(cx + (r() - 0.5) * bw * 2)}" cy="${f(cy + (r() - 0.3) * bh * 1.6)}" r="${f(1.6 + r() * 2.4)}" fill="${p}"/>`).join("");
    case "tundra": return Array.from({ length: 7 }, () => { const x = cx + (r() - 0.5) * bw * 1.7, y = cy + (r() - 0.3) * bh * 1.4; return `<path d="M${f(x - 4)},${f(y)} h8 M${f(x)},${f(y - 4)} v8 M${f(x - 3)},${f(y - 3)} l6,6 M${f(x + 3)},${f(y - 3)} l-6,6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>`; }).join("");
    default: return "";
  }
}

const SIGILS = [
  (x, y, c) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x},${y - 6} L${x + 1.8},${y - 1.8} L${x + 6},${y - 1.6} L${x + 2.6},${y + 1.4} L${x + 3.8},${y + 6} L${x},${y + 3.3} L${x - 3.8},${y + 6} L${x - 2.6},${y + 1.4} L${x - 6},${y - 1.6} L${x - 1.8},${y - 1.8}Z" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x},${y + 5} C${x - 8},${y - 1} ${x - 4},${y - 7} ${x},${y - 2.5} C${x + 4},${y - 7} ${x + 8},${y - 1} ${x},${y + 5}Z" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x},${y - 5.5} L${x + 5.5},${y + 4.5} L${x - 5.5},${y + 4.5}Z" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x},${y - 6} L${x + 5},${y} L${x},${y + 6} L${x - 5},${y}Z" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x + 2},${y - 6} A6,6 0 1,0 ${x + 2},${y + 6} A4.5,4.5 0 1,1 ${x + 2},${y - 6}Z" fill="${c}"/>`,
  (x, y, c) => `<circle cx="${x}" cy="${y}" r="3" fill="${c}"/><path d="M${x},${y - 7} v2.5 M${x},${y + 4.5} v2.5 M${x - 7},${y} h2.5 M${x + 4.5},${y} h2.5" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`,
  (x, y, c) => `<path d="M${x - 5},${y + 5} Q${x - 5},${y - 5} ${x + 5},${y - 5} Q${x + 5},${y + 5} ${x - 5},${y + 5}Z" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x},${y - 6} Q${x + 5},${y + 1} ${x},${y + 5} Q${x - 5},${y + 1} ${x},${y - 6}Z" fill="${c}"/>`,
  (x, y, c) => `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.5" fill="${c}"/>`,
  (x, y, c) => `<path d="M${x + 1},${y - 6} L${x - 3.5},${y + 1} H${x} L${x - 1},${y + 6} L${x + 3.5},${y - 1} H${x}Z" fill="${c}"/>`,
  (x, y, c) => [0, 72, 144, 216, 288].map((a) => `<circle cx="${f(x + 3.4 * Math.cos((a * Math.PI) / 180))}" cy="${f(y + 3.4 * Math.sin((a * Math.PI) / 180))}" r="2.6" fill="${c}"/>`).join("") + `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`,
];

function hat(t, cx, top, bw, pal) {
  const o = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const c = pal.accent, c2 = pal.accent2;
  const w = Math.min(bw * 0.95, 48);
  switch (t.hat) {
    case "beanie": return `<path d="M${f(cx - w)},${f(top + 14)} Q${f(cx - w)},${f(top - 30)} ${cx},${f(top - 30)} Q${f(cx + w)},${f(top - 30)} ${f(cx + w)},${f(top + 14)}Z" fill="${c}" ${o}/><rect x="${f(cx - w - 3)}" y="${f(top + 4)}" width="${f(2 * w + 6)}" height="13" rx="6" fill="${c2}" ${o}/><circle cx="${cx}" cy="${f(top - 33)}" r="8" fill="${c2}" ${o}/>`;
    case "cap": return `<path d="M${f(cx - w)},${f(top + 10)} Q${f(cx - w)},${f(top - 24)} ${cx},${f(top - 24)} Q${f(cx + w)},${f(top - 24)} ${f(cx + w)},${f(top + 10)}Z" fill="${c}" ${o}/><path d="M${f(cx + w - 8)},${f(top + 8)} Q${f(cx + w + 30)},${f(top + 4)} ${f(cx + w + 30)},${f(top + 13)} Q${f(cx + w + 6)},${f(top + 16)} ${f(cx + w - 8)},${f(top + 14)}Z" fill="${c2}" ${o}/><circle cx="${cx}" cy="${f(top - 24)}" r="3" fill="${c2}"/>`;
    case "bucket": return `<path d="M${f(cx - w + 6)},${f(top + 6)} L${f(cx - w + 14)},${f(top - 22)} H${f(cx + w - 14)} L${f(cx + w - 6)},${f(top + 6)}Z" fill="${c}" ${o}/><ellipse cx="${cx}" cy="${f(top + 8)}" rx="${f(w + 16)}" ry="8" fill="${c}" ${o}/><path d="M${f(cx - w + 10)},${f(top - 6)} H${f(cx + w - 10)}" stroke="${c2}" stroke-width="5"/>`;
    case "flowers": return [-2, -1, 0, 1, 2].map((k) => { const x = cx + k * (w / 2.4), y = top + 4 + Math.abs(k) * 4; const fc = k % 2 ? c2 : c; return [0, 72, 144, 216, 288].map((a) => `<circle cx="${f(x + 5 * Math.cos((a * Math.PI) / 180))}" cy="${f(y + 5 * Math.sin((a * Math.PI) / 180))}" r="4.2" fill="${fc}" stroke="${INK}" stroke-width="1.6"/>`).join("") + `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#ffd34d" stroke="${INK}" stroke-width="1.6"/>`; }).join("");
    case "wizard": return `<path d="M${f(cx - w + 4)},${f(top + 10)} Q${f(cx - 6)},${f(top - 30)} ${f(cx + 10)},${f(top - 58)} Q${f(cx + 10)},${f(top - 20)} ${f(cx + w - 4)},${f(top + 10)}Z" fill="${c}" ${o}/><ellipse cx="${cx}" cy="${f(top + 10)}" rx="${f(w + 8)}" ry="7" fill="${c}" ${o}/>${SIGILS[1](cx + 2, f(top - 14), "#ffd34d")}`;
    case "band": return `<rect x="${f(cx - w - 2)}" y="${f(top + 10)}" width="${f(2 * w + 4)}" height="11" rx="5" fill="${c}" ${o}/><path d="M${f(cx + w - 2)},${f(top + 15)} l14,-8 M${f(cx + w - 2)},${f(top + 15)} l14,6" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
    default: return "";
  }
}

// Gear found on the trail. Each slot draws over the base walker.
const GEAR = {
  "pine-cap": { name: "Pine cone cap", slot: "hat", rarity: 1 },
  "party-hat": { name: "Party hat", slot: "hat", rarity: 1 },
  "crown": { name: "Tiny crown", slot: "hat", rarity: 3 },
  "explorer": { name: "Explorer's helmet", slot: "hat", rarity: 2 },
  "scarf": { name: "Woolly scarf", slot: "neck", rarity: 1 },
  "bandana": { name: "Trail bandana", slot: "neck", rarity: 1 },
  "medal": { name: "Summit medal", slot: "neck", rarity: 2 },
  "shades": { name: "Sunglasses", slot: "face", rarity: 1 },
  "specs": { name: "Round specs", slot: "face", rarity: 1 },
  "monocle": { name: "Monocle", slot: "face", rarity: 3 },
  "pet-snail": { name: "Pet snail", slot: "pet", rarity: 2 },
  "pet-bird": { name: "Little bird", slot: "pet", rarity: 2 },
  "pet-shroom": { name: "Walking mushroom", slot: "pet", rarity: 3 },
  "balloon": { name: "Red balloon", slot: "pet", rarity: 2 },
  "flag": { name: "Summit flag", slot: "pet", rarity: 2 },
  "halo": { name: "Golden halo", slot: "hat", rarity: 4 },
};

function gearSvg(id, cx, top, ey, gap, bw, bodyBottom) {
  const o = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;
  switch (id) {
    case "pine-cap": return `<path d="M${cx - 30},${top + 12} Q${cx},${top - 40} ${cx + 30},${top + 12}Z" fill="#9a6a3a" ${o}/>` + [0, 1, 2].map((k) => `<path d="M${cx - 22 + k * 4},${top + 2 - k * 12} Q${cx},${top + 8 - k * 12} ${cx + 22 - k * 4},${top + 2 - k * 12}" fill="none" stroke="${INK}" stroke-width="2"/>`).join("");
    case "party-hat": return `<path d="M${cx - 20},${top + 12} L${cx},${top - 40} L${cx + 20},${top + 12}Z" fill="#ff6fa8" ${o}/><path d="M${cx - 12},${top - 8} L${cx + 12},${top - 2} M${cx - 6},${top - 24} L${cx + 7},${top - 20}" stroke="#ffd34d" stroke-width="4"/><circle cx="${cx}" cy="${top - 42}" r="6" fill="#ffd34d" ${o}/>`;
    case "crown": return `<path d="M${cx - 24},${top + 10} L${cx - 26},${top - 18} L${cx - 12},${top - 4} L${cx},${top - 24} L${cx + 12},${top - 4} L${cx + 26},${top - 18} L${cx + 24},${top + 10}Z" fill="#ffcf3a" ${o}/><circle cx="${cx}" cy="${top - 2}" r="4" fill="#ff5a4a"/>`;
    case "explorer": return `<path d="M${cx - 34},${top + 12} Q${cx - 30},${top - 30} ${cx},${top - 30} Q${cx + 30},${top - 30} ${cx + 34},${top + 12}Z" fill="#e9dcb4" ${o}/><ellipse cx="${cx}" cy="${top + 12}" rx="44" ry="8" fill="#e9dcb4" ${o}/><path d="M${cx - 30},${top + 2} H${cx + 30}" stroke="#7a5a2a" stroke-width="5"/>`;
    case "halo": return `<ellipse cx="${cx}" cy="${top - 18}" rx="26" ry="7" fill="none" stroke="#ffcf3a" stroke-width="6"/>`;
    case "scarf": return `<path d="M${cx - bw * 0.8},${ey + 30} Q${cx},${ey + 44} ${cx + bw * 0.8},${ey + 30} L${cx + bw * 0.8},${ey + 42} Q${cx},${ey + 56} ${cx - bw * 0.8},${ey + 42}Z" fill="#e8483f" ${o}/><path d="M${cx + 18},${ey + 46} l6,30 l12,-4 l-6,-28Z" fill="#e8483f" ${o}/>`;
    case "bandana": return `<path d="M${cx - bw * 0.7},${ey + 32} Q${cx},${ey + 40} ${cx + bw * 0.7},${ey + 32} L${cx},${ey + 62}Z" fill="#2f7fd8" ${o}/><circle cx="${cx - 8}" cy="${ey + 42}" r="2" fill="#fff"/><circle cx="${cx + 6}" cy="${ey + 46}" r="2" fill="#fff"/>`;
    case "medal": return `<path d="M${cx - 14},${ey + 28} L${cx},${ey + 50} L${cx + 14},${ey + 28}" fill="none" stroke="#2f7fd8" stroke-width="5"/><circle cx="${cx}" cy="${ey + 56}" r="9" fill="#ffcf3a" ${o}/>`;
    case "shades": return `<rect x="${cx - gap - 11}" y="${ey - 8}" width="22" height="15" rx="6" fill="${INK}"/><rect x="${cx + gap - 11}" y="${ey - 8}" width="22" height="15" rx="6" fill="${INK}"/><path d="M${cx - gap + 11},${ey - 3} H${cx + gap - 11}" stroke="${INK}" stroke-width="3"/><path d="M${cx - gap - 6},${ey - 4} l5,0" stroke="#fff" stroke-width="2" opacity=".6"/>`;
    case "specs": return `<circle cx="${cx - gap}" cy="${ey}" r="11" fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="2.6"/><circle cx="${cx + gap}" cy="${ey}" r="11" fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="2.6"/><path d="M${cx - gap + 11},${ey} H${cx + gap - 11}" stroke="${INK}" stroke-width="2.6"/>`;
    case "monocle": return `<circle cx="${cx + gap}" cy="${ey}" r="11" fill="rgba(255,255,255,.2)" stroke="#c99a1e" stroke-width="3"/><path d="M${cx + gap + 8},${ey + 8} q4,20 -6,34" fill="none" stroke="#c99a1e" stroke-width="1.6"/>`;
    case "pet-snail": return `<g transform="translate(${cx + bw + 6},${bodyBottom + 6})"><path d="M-14,8 H14 Q18,8 18,4" fill="none" stroke="${INK}" stroke-width="2.4"/><ellipse cx="0" cy="6" rx="15" ry="4" fill="#e9c27a" ${o}/><circle cx="0" cy="-3" r="9" fill="#c77d3a" ${o}/><path d="M0,-3 m-1,0 a1,1 0 1,1 2,0 a3,3 0 1,1 -6,0" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M13,4 l4,-10 M16,5 l6,-8" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>`;
    case "pet-bird": return `<g transform="translate(${cx - bw - 4},${top + 30})"><ellipse cx="0" cy="0" rx="11" ry="9" fill="#ffcf3a" ${o}/><circle cx="4" cy="-3" r="1.8" fill="${INK}"/><path d="M10,-1 l6,2 l-6,2Z" fill="#f2711c" ${o}/><path d="M-6,0 q4,-8 8,0" fill="none" stroke="${INK}" stroke-width="2"/></g>`;
    case "pet-shroom": return `<g transform="translate(${cx + bw + 8},${bodyBottom - 8})"><path d="M-14,0 Q-14,-18 0,-18 Q14,-18 14,0Z" fill="#e8483f" ${o}/><circle cx="-5" cy="-9" r="2.5" fill="#fff"/><circle cx="6" cy="-6" r="2" fill="#fff"/><rect x="-6" y="0" width="12" height="14" rx="4" fill="#f4ecd8" ${o}/><circle cx="-2" cy="6" r="1.3" fill="${INK}"/><circle cx="3" cy="6" r="1.3" fill="${INK}"/></g>`;
    case "balloon": return `<path d="M${cx + bw + 2},${ey + 40} q10,-30 6,-70" fill="none" stroke="${INK}" stroke-width="1.6"/><ellipse cx="${cx + bw + 8}" cy="${ey - 44}" rx="16" ry="19" fill="#e8483f" ${o}/><path d="M${cx + bw + 2},${ey - 52} q3,-5 8,-6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`;
    case "flag": return `<path d="M${cx - bw - 10},${bodyBottom + 14} V${top - 20}" stroke="#7a5a2a" stroke-width="4" stroke-linecap="round"/><path d="M${cx - bw - 10},${top - 20} l30,8 l-30,9Z" fill="#f2711c" ${o}/>`;
    default: return "";
  }
}

function carrySvg(t, cx, cy, bw, bh, pal, front) {
  const o = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const rx = cx + bw * 0.98, ry = cy + bh * 0.12;
  if (!front) {
    if (t.carry === "backpack") return `<rect x="${f(cx - bw - 16)}" y="${f(cy - bh * 0.35)}" width="34" height="${f(bh * 0.95)}" rx="10" fill="${pal.accent}" ${o}/><rect x="${f(cx - bw - 20)}" y="${f(cy + bh * 0.05)}" width="18" height="20" rx="5" fill="${pal.accent2}" ${o}/>`;
    if (t.carry === "stick") return `<path d="M${f(rx + 8)},${f(cy - bh * 0.6)} L${f(rx + 14)},${f(cy + bh + 22)}" stroke="#8a5a2b" stroke-width="6" stroke-linecap="round"/><path d="M${f(rx + 9)},${f(cy - bh * 0.4)} l8,-6" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>`;
    return "";
  }
  switch (t.carry) {
    case "backpack": return `<path d="M${f(cx - bw * 0.55)},${f(cy - bh * 0.62)} Q${f(cx - bw * 0.45)},${f(cy)} ${f(cx - bw * 0.62)},${f(cy + bh * 0.3)} M${f(cx + bw * 0.55)},${f(cy - bh * 0.62)} Q${f(cx + bw * 0.45)},${f(cy)} ${f(cx + bw * 0.62)},${f(cy + bh * 0.3)}" fill="none" stroke="${pal.accent}" stroke-width="6" stroke-linecap="round"/>`;
    case "umbrella": return `<path d="M${f(rx + 6)},${f(ry)} V${f(cy - bh - 26)}" stroke="${INK}" stroke-width="3"/><path d="M${f(rx + 6)},${f(ry)} q0,8 -7,6" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M${f(rx - 32)},${f(cy - bh - 22)} Q${f(rx + 6)},${f(cy - bh - 62)} ${f(rx + 44)},${f(cy - bh - 22)} q-9.5,-6 -19,0 q-9.5,-6 -19,0 q-9.5,-6 -19,0 q-9.5,-6 -19,0Z" fill="${pal.accent}" ${o}/>`;
    case "camera": return `<path d="M${f(cx - bw * 0.5)},${f(cy - bh * 0.6)} L${f(cx)},${f(cy + 4)} L${f(cx + bw * 0.5)},${f(cy - bh * 0.6)}" fill="none" stroke="${INK}" stroke-width="2.4"/><rect x="${f(cx - 15)}" y="${f(cy - 2)}" width="30" height="21" rx="4" fill="#3a3f45" ${o}/><circle cx="${cx}" cy="${f(cy + 9)}" r="6.5" fill="#9ad1ff" stroke="${INK}" stroke-width="2.4"/>`;
    case "headphones": return "";
    case "book": return `<path d="M${f(rx - 6)},${f(ry - 4)} l18,-6 l4,22 l-18,6Z" fill="${pal.accent}" ${o}/><path d="M${f(rx - 2)},${f(ry)} l10,-3" stroke="#fff" stroke-width="2"/>`;
    default: return "";
  }
}

/**
 * svg(answers | traits, opts)
 * opts.mood: "fresh" | "ok" | "foggy";  opts.fog: 0..1 (greys the walker out);  opts.gear: gear id;
 * opts.crop: "full" | "head";  opts.standalone: true to embed the hand-drawn filter (for canvas export).
 */
function svg(input, opts = {}) {
  const t = input && input.sig ? input : traits(input || {});
  const pal = t.pal;
  const cx = 100, cy = 128;
  const bw = 50 * t.scaleX, bh = 54 * t.scaleY;
  const top = cy - bh, bottom = cy + bh;
  const ey = top + bh * 2 * t.eyeY, gap = t.eyeGap;
  const mood = opts.mood || "ok";
  const fog = Math.max(0, Math.min(1, opts.fog || 0));
  const gear = GEAR[opts.gear] ? opts.gear : null;
  const id = "c" + (t.seed % 1e8).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const o = `stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"`;
  const body = bodyPath(t, cx, cy, bw, bh, true);
  const legX = bw * 0.42;
  const stride = mood === "fresh" ? 5 : 0;

  let out = "";
  out += `<ellipse cx="${cx}" cy="${f(bottom + 20)}" rx="${f(bw * 0.95)}" ry="7" fill="${INK}" opacity=".14"/>`;
  out += carrySvg(t, cx, cy, bw, bh, pal, false);
  // legs + shoes
  out += [[-1, -stride], [1, stride]].map(([d, s]) => `<path d="M${f(cx + d * legX)},${f(bottom - 10)} L${f(cx + d * legX + s)},${f(bottom + 15)}" stroke="${pal.shade}" stroke-width="11" stroke-linecap="round"/><ellipse cx="${f(cx + d * legX + s + d * 3)}" cy="${f(bottom + 17)}" rx="10" ry="6" fill="${pal.accent2}" ${o}/>`).join("");
  out += feature(t, cx, top, bw, pal);
  // body, belly, pattern
  out += `<defs><clipPath id="${id}b"><path d="${body}"/></clipPath></defs>`;
  out += `<path d="${body}" fill="${pal.body}"/>`;
  out += `<g clip-path="url(#${id}b)"><ellipse cx="${cx}" cy="${f(cy + bh * 0.55)}" rx="${f(bw * 0.72)}" ry="${f(bh * 0.6)}" fill="${pal.belly}"/>${patternLayer(t, cx, cy, bw, bh, pal)}</g>`;
  out += `<path d="${body}" fill="none" ${o}/>`;
  // arms
  const armY = cy + bh * 0.05;
  out += `<path d="M${f(cx - bw * 0.92)},${f(armY - 6)} q-12,10 -8,24" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M${f(cx - bw * 0.92)},${f(armY - 6)} q-12,10 -8,24" fill="none" stroke="${pal.body}" stroke-width="5" stroke-linecap="round"/>`;
  out += `<path d="M${f(cx + bw * 0.92)},${f(armY - 6)} q12,8 10,22" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M${f(cx + bw * 0.92)},${f(armY - 6)} q12,8 10,22" fill="none" stroke="${pal.body}" stroke-width="5" stroke-linecap="round"/>`;
  out += carrySvg(t, cx, cy, bw, bh, pal, true);
  // chest badge (birth month)
  out += `<circle cx="${f(cx - bw * 0.42)}" cy="${f(cy + bh * 0.3)}" r="9" fill="#fffdf6" stroke="${INK}" stroke-width="2"/>${SIGILS[t.month % 12](f(cx - bw * 0.42), f(cy + bh * 0.3), pal.accent)}`;
  // face
  if (t.feature === "crow") out += `<path d="M${cx - 7},${f(ey + 9)} L${cx + 7},${f(ey + 9)} L${cx},${f(ey + 20)}Z" fill="#f2a01c" ${o}/>`;
  out += eyes(t, cx, ey, gap, mood);
  if (t.cheeks && mood !== "foggy") out += `<ellipse cx="${f(cx - gap - 8)}" cy="${f(ey + 12)}" rx="6" ry="3.5" fill="${pal.cheek}" opacity=".55"/><ellipse cx="${f(cx + gap + 8)}" cy="${f(ey + 12)}" rx="6" ry="3.5" fill="${pal.cheek}" opacity=".55"/>`;
  const fr = rng(t.seed + 3);
  for (let i = 0; i < t.freckles; i++) out += `<circle cx="${f(cx + (i % 2 ? 1 : -1) * (gap + 4 + fr() * 8))}" cy="${f(ey + 7 + fr() * 6)}" r="1.3" fill="${INK}" opacity=".55"/>`;
  out += mouth(t, cx, f(ey + (t.feature === "crow" ? 26 : 17)), mood);
  if (t.carry === "headphones") out += `<path d="M${f(cx - bw * 0.85)},${f(ey)} Q${cx},${f(top - 36)} ${f(cx + bw * 0.85)},${f(ey)}" fill="none" stroke="${INK}" stroke-width="5"/>` + [-1, 1].map((d) => `<rect x="${f(cx + d * bw * 0.85 - 8)}" y="${f(ey - 10)}" width="16" height="22" rx="7" fill="${pal.accent}" ${o}/>`).join("");
  // hat (gear hats replace it)
  const g = gear && GEAR[gear];
  out += g && g.slot === "hat" ? gearSvg(gear, cx, top, ey, gap, bw, bottom) : hat(t, cx, top, bw, pal);
  if (g && g.slot !== "hat") out += gearSvg(gear, cx, top, ey, gap, bw, bottom);
  // mood extras
  if (mood === "foggy") out += `<rect x="${cx + bw * 0.62}" y="${f(armY + 6)}" width="15" height="24" rx="3" fill="${INK}" transform="rotate(-14 ${cx + bw * 0.7} ${armY + 18})"/><rect x="${cx + bw * 0.62 + 2}" y="${f(armY + 9)}" width="11" height="17" rx="1.5" fill="#bfe9ff" transform="rotate(-14 ${cx + bw * 0.7} ${armY + 18})"/>`;
  if (mood === "fresh") out += [[-1, 0], [1, 1]].map(([d, k]) => `<path d="M${f(cx + d * (bw + 18))},${f(top + 10 + k * 18)} v-10 M${f(cx + d * (bw + 13))},${f(top + 5 + k * 18)} h10" stroke="#f2a01c" stroke-width="3" stroke-linecap="round"/>`).join("");

  const fogFilter = fog > 0.05 ? `<filter id="${id}f"><feColorMatrix type="saturate" values="${f(1 - fog * 0.85)}"/></filter>` : "";
  const fogCloud = fog > 0.25 ? `<g opacity="${f(0.25 + fog * 0.45)}"><ellipse cx="${cx - 30}" cy="${f(top - 6)}" rx="34" ry="14" fill="#c9d1cc"/><ellipse cx="${cx + 18}" cy="${f(top - 14)}" rx="40" ry="16" fill="#d7ddd9"/><ellipse cx="${cx + 52}" cy="${f(top + 4)}" rx="24" ry="11" fill="#c9d1cc"/></g>` : "";
  const rough = opts.standalone ? `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${t.seed % 97}"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>` : "";
  const vb = opts.crop === "head" ? `${f(cx - 62)} ${f(top - 40)} 124 124` : "0 0 200 230";
  const tilt = mood === "foggy" ? t.tilt + 6 : t.tilt;
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="walker" role="img" aria-label="${esc(opts.label || "Walker")}"><defs>${fogFilter}${rough}</defs>` +
    `<g filter="url(#rough)"><g transform="rotate(${f(tilt)} ${cx} ${f(bottom)})"${fogFilter ? ` filter="url(#${id}f)"` : ""}>${out}</g>${fogCloud}</g></svg>`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Defaults for players who joined before the quiz existed: derive answers from their id so they still look unique.
function fallbackAnswers(id) {
  const r = rng(hash(String(id)));
  const pick = (q) => q.options[Math.floor(r() * q.options.length)][0];
  const a = {};
  for (const q of QUESTIONS) {
    if (q.type === "choice") a[q.id] = pick(q);
    else if (q.type === "hue") a[q.id] = Math.floor(r() * 360);
    else if (q.type === "number") a[q.id] = 1 + Math.floor(r() * 99);
    else if (q.type === "text") a[q.id] = String(id).slice(0, 8);
  }
  return a;
}

// The weekly boss: a phone that grew teeth. Cracks appear as it loses HP; X eyes when beaten.
function bossSvg(pct, defeated) {
  const o = `stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"`;
  const hurt = 1 - Math.max(0, Math.min(1, pct));
  const eye = (x) => defeated
    ? `<path d="M${x - 7},${62} l14,14 M${x + 7},${62} l-14,14" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="69" r="10" fill="#fff" ${o}/><circle cx="${x + (hurt > 0.5 ? -2 : 2)}" cy="71" r="4.5" fill="${INK}"/>`;
  const cracks = hurt > 0.25 ? `<path d="M118,40 l-10,16 l8,6 l-12,18" fill="none" stroke="${INK}" stroke-width="2.2"/>` : "";
  const cracks2 = hurt > 0.6 ? `<path d="M62,120 l14,-6 l4,10 l14,-4" fill="none" stroke="${INK}" stroke-width="2.2"/>` : "";
  const feed = [0, 1, 2].map((k) => `<rect x="62" y="${94 + k * 16}" width="${54 - k * 10}" height="9" rx="4" fill="#ff8fb1" opacity="${defeated ? 0.3 : 0.9}"/>`).join("");
  return `<svg viewBox="0 0 180 190" xmlns="http://www.w3.org/2000/svg" class="boss-svg" role="img" aria-label="The Scroll boss"><g filter="url(#rough)"${defeated ? ' opacity=".55"' : ""}>
    <ellipse cx="90" cy="178" rx="56" ry="7" fill="${INK}" opacity=".15"/>
    <path d="M40,96 q-26,-6 -30,-30 M140,96 q26,-6 30,-30" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M40,96 q-26,-6 -30,-30 M140,96 q26,-6 30,-30" fill="none" stroke="#3b3550" stroke-width="4" stroke-linecap="round"/>
    <rect x="42" y="18" width="96" height="150" rx="18" fill="#2b2d36" ${o}/>
    <rect x="52" y="34" width="76" height="118" rx="8" fill="#bfe9ff" ${o}/>
    ${feed}${eye(72)}${eye(108)}
    <path d="M66,${defeated ? 88 : 84} q24,${defeated ? -6 : 14} 48,0" fill="${defeated ? "none" : INK}" stroke="${INK}" stroke-width="3"/>
    ${defeated ? "" : `<path d="M72,84 l4,7 l4,-6 l4,7 l4,-7 l4,7 l4,-6 l4,7 l4,-7" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`}
    <rect x="78" y="24" width="24" height="5" rx="2.5" fill="${INK}"/>${cracks}${cracks2}
    <path d="M60,168 v14 M120,168 v14" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
  </g></svg>`;
}

// Scenery behind the walker on the home screen, one per biome.
const SCENES = {
  meadow: { sky: "#cfe8f3", far: "#b9d68f", near: "#8fbf5a", deco: (r) => Array.from({ length: 6 }, () => `<circle cx="${f(r() * 360)}" cy="${f(150 + r() * 30)}" r="3" fill="#fff6b0"/>`).join("") },
  forest: { sky: "#d6ecdf", far: "#7fae7a", near: "#4f8a4c", deco: (r) => Array.from({ length: 5 }, (_, i) => { const x = 20 + i * 80 + r() * 20; return `<path d="M${f(x)},120 l-18,40 h36z M${f(x)},100 l-14,32 h28z" fill="#2f6a3a" stroke="${INK}" stroke-width="2"/>`; }).join("") },
  coast: { sky: "#cbe6f5", far: "#8cc7e6", near: "#f0d79a", deco: () => `<path d="M0,128 q20,-8 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" fill="none" stroke="#fff" stroke-width="3"/>` },
  mountains: { sky: "#d9e6f2", far: "#9aaabb", near: "#8fae7c", deco: () => `<path d="M10,130 L80,50 L150,130 Z M170,130 L250,40 L330,130Z" fill="#7d8ea0" stroke="${INK}" stroke-width="2"/><path d="M80,50 l-16,18 h32z M250,40 l-18,20 h36z" fill="#fff"/>` },
  desert: { sky: "#fbe3c0", far: "#f0c27e", near: "#e8b065", deco: () => `<path d="M60,150 v-34 m0,12 h-10 v-10 m10,4 h10 v-12" fill="none" stroke="#3f8a4f" stroke-width="7" stroke-linecap="round"/><circle cx="300" cy="40" r="20" fill="#ffd34d"/>` },
  tundra: { sky: "#e3eef6", far: "#c7d8e6", near: "#f4f8fb", deco: (r) => Array.from({ length: 14 }, () => `<circle cx="${f(r() * 360)}" cy="${f(r() * 120)}" r="2" fill="#fff"/>`).join("") },
  city: { sky: "#d9d6ea", far: "#9a95b6", near: "#b9b6a8", deco: (r) => Array.from({ length: 7 }, (_, i) => { const h = 40 + r() * 50; return `<rect x="${i * 52 + 4}" y="${f(135 - h)}" width="40" height="${f(h)}" fill="#6f6a8c" stroke="${INK}" stroke-width="2"/>`; }).join("") },
  marsh: { sky: "#dbe8de", far: "#a7bf98", near: "#7fa088", deco: () => `<path d="M40,150 v-30 M48,150 v-22 M300,152 v-28 M308,152 v-36" stroke="#5a6b3a" stroke-width="3"/><ellipse cx="44" cy="118" rx="3" ry="8" fill="#7a4a2a"/><ellipse cx="308" cy="114" rx="3" ry="8" fill="#7a4a2a"/>` },
};
function sceneSvg(biome, seed = 1) {
  const s = SCENES[biome] || SCENES.meadow;
  const r = rng(seed);
  return `<svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" class="scene-svg" aria-hidden="true">
    <rect width="360" height="200" fill="${s.sky}"/>
    <path d="M0,130 Q60,96 120,118 T240,110 T360,120 V200 H0Z" fill="${s.far}"/>
    ${s.deco(r)}
    <path d="M0,150 Q90,136 180,148 T360,146 V200 H0Z" fill="${s.near}"/>
    <path d="M-10,190 Q120,150 200,168 T380,160" fill="none" stroke="#f4ead2" stroke-width="16" stroke-linecap="round" stroke-dasharray="2 18" opacity=".9"/>
  </svg>`;
}

// Rough count of distinct walkers the quiz can produce (shown on the reveal screen).
const COMBOS = QUESTIONS.reduce((n, q) => n * (q.type === "choice" ? q.options.length : q.type === "hue" ? 360 : q.type === "number" ? 99 : 1), 1);

window.Walker = { QUESTIONS, GEAR, traits, svg, boss: bossSvg, scene: sceneSvg, signature, fallbackAnswers, hash, rng, COMBOS };
})();
