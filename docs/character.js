(() => {
"use strict";
// Walker generator: quiz answers → a hand-drawn SVG ninja. The answers pick the suit colour, headband and sash,
// skin, eyes, headwear, hood ears, chest badge and what's on their back, and the free-text word seeds the fine
// details (proportions, tilt), so two people only match if they answer identically.

// Quick questions about you. The ids and answer values are what draw your walker, set your stats
// (game.js) and get saved, so they stay fixed; only the wording here is free to change.
const QUESTIONS = [
  { id: "name", type: "intro" },
  { id: "time", q: "Pick a dessert", type: "choice", options: [
    ["dawn", "Fruit salad", "🍓"], ["noon", "Sticky toffee pudding", "🍮"], ["golden", "Doughnuts", "🍩"], ["night", "Tiramisu", "☕"]] },
  { id: "pace", q: "Pick a takeaway", type: "choice", options: [
    ["amble", "Chippy", "🍟"], ["stroll", "Pizza", "🍕"], ["march", "Burger", "🍔"],
    ["strut", "Sushi", "🍣"], ["wander", "Thai", "🍜"], ["dash", "3am kebab", "🌯"]] },
  { id: "land", q: "Dream holiday?", type: "choice", options: [
    ["mountains", "Ski trip", "⛷️"], ["coast", "Beach, do nothing", "🏖️"], ["forest", "Cabin in the woods", "🌲"],
    ["city", "City break", "🏙️"], ["desert", "Somewhere 40°C", "🏜️"], ["tundra", "Northern Lights", "🌌"]] },
  { id: "carry", q: "Never leave the house without…", type: "choice", options: [
    ["backpack", "My bag", "🎒"], ["umbrella", "An umbrella", "☂️"], ["camera", "A camera", "📷"],
    ["headphones", "Headphones", "🎧"], ["book", "A book", "📖"], ["stick", "A walking stick", "🪵"], ["none", "Just my phone", "📱"]] },
  { id: "creature", q: "Pick a pet", type: "choice", options: [
    ["fox", "Fox", "🦊"], ["owl", "Owl", "🦉"], ["frog", "Frog", "🐸"], ["cat", "Cat", "🐈"],
    ["crow", "Crow", "🐦‍⬛"], ["snail", "Snail", "🐌"], ["bear", "Bear", "🐻"], ["moth", "Moth", "🦋"]] },
  { id: "morning", q: "First thing in the morning?", type: "choice", options: [
    ["coffee", "Coffee", "☕"], ["out", "Gym", "🏋️"], ["snooze", "Snooze", "😴"],
    ["music", "Music on", "🔊"], ["stretch", "Stretch", "🧘"], ["scroll", "Phone", "📱"]] },
  { id: "laugh", q: "You have to slime one of the following. Who goes?", type: "choice", options: [
    ["giggle", "The Duolingo owl", "🦉"], ["snort", "Peppa Pig", "🐷"], ["cackle", "Clippy", "📎"],
    ["silent", "Mr Blobby", "🎈"], ["boom", "Barney", "🦖"], ["wheeze", "Crazy Frog", "🐸"]],
    pics: { giggle: "img/slime/duo.jpg", snort: "img/slime/peppa.jpg", cackle: "img/slime/clippy.jpg", silent: "img/slime/blobby.jpg", boom: "img/slime/barney.jpg", wheeze: "img/slime/frog.jpg" },
    credit: 'Photos from Wikimedia Commons, cropped: <a href="https://commons.wikimedia.org/wiki/File:Peppa_Pig_and_George_in_Peppa_Pig_World_at_Paultons_Park.jpg" target="_blank" rel="noopener">Peppa Pig</a> by Paultons Park (CC BY 2.0), <a href="https://commons.wikimedia.org/wiki/File:Mr_Blobby,_Nunton_-_geograph.org.uk_-_2511830.jpg" target="_blank" rel="noopener">Mr Blobby</a> by Maigheach-gheal (CC BY-SA 2.0), <a href="https://commons.wikimedia.org/wiki/File:Barney_show_in_Qatar_(4340543390).jpg" target="_blank" rel="noopener">Barney</a> by D@LY3D (CC BY 2.0), <a href="https://commons.wikimedia.org/wiki/File:Clippy_fanart.png" target="_blank" rel="noopener">Clippy</a> by wunkypunk (CC BY-SA 3.0), <a href="https://commons.wikimedia.org/wiki/File:Person_in_CrazyFrog_costume_(from_cropped_PublicTransport_CrazyFrog).jpg" target="_blank" rel="noopener">Crazy Frog</a> and the <a href="https://commons.wikimedia.org/wiki/File:Duolingo_logo_(2019).svg" target="_blank" rel="noopener">Duolingo logo</a> (public domain).' },
  { id: "hat", q: "Pick a hat", type: "choice", options: [
    ["beanie", "Beanie", "🧶"], ["cap", "Cap", "🧢"], ["bucket", "Bucket hat", "🎣"], ["flowers", "Flower crown", "🌼"],
    ["wizard", "Wizard hat", "🔮"], ["band", "Sweatband", "🎾"], ["none", "No hat", "💇"]] },
  { id: "hue", q: "Favourite colour?", type: "hue" },
  { id: "month", q: "Birthday month?", type: "choice", compact: true, options:
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => [String(i), m, ""]) },
  { id: "number", q: "Favourite number?", type: "number", min: 1, max: 99 },
  { id: "word", q: "You in one word", type: "text", placeholder: "chaotic, hungry, tired…" },
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
    sig, hue, num, time: a.time,
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

// The ninja's colours (the 3D ninja in ninja3d.js uses the same ones): suit from your colour + dessert,
// headband and sash from the accents, skin from your favourite number.
const SKIN = ["#f6d3b5", "#eab68f", "#cf9468", "#a56c47", "#f3c6a0", "#7c4f33"];
const SUIT = { dawn: [40, 44], noon: [48, 33], golden: [44, 35], night: [26, 20] };
function ninjaPalette(t) {
  const [s, l] = SUIT[t.time] || SUIT.noon;
  return { suit: hsl(t.hue, s, l), dark: hsl(t.hue, s, Math.max(10, l - 12)), band: t.pal.accent, sash: t.pal.accent2,
    wrap: "#ece6d6", skin: SKIN[t.num % SKIN.length], metal: "#cfd8e0", straw: "#d9b46a", wood: "#3a2a22" };
}

function ninjaEyes(t, cx, ey, gap, top, mood) {
  const style = mood === "foggy" ? "glazed" : t.eyes;
  const both = (fn) => fn(cx - gap, -1) + fn(cx + gap, 1);
  const brows = !["snooze", "music", "glazed"].includes(style)
    ? both((x, d) => `<path d="M${f(x + d * 9)},${f(top + 2)} L${f(x - d * 4)},${f(top + 6)}" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`) : "";
  let e;
  switch (style) {
    case "snooze": e = both((x) => `<path d="M${f(x - 7)},${f(ey)} H${f(x + 7)}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M${f(x - 6)},${f(ey + 3)} H${f(x + 6)}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`); break;
    case "music": e = both((x) => `<path d="M${f(x - 7)},${f(ey + 3)} Q${f(x)},${f(ey - 6)} ${f(x + 7)},${f(ey + 3)}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`); break;
    case "scroll": e = both((x) => `<path d="M${f(x)},${f(ey)} m-1,0 a1,1 0 1,1 2,0 a2.5,2.5 0 1,1 -5,0 a4,4 0 1,1 8,0 a5.5,5.5 0 1,1 -11,0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`); break;
    case "glazed": e = both((x) => `<circle cx="${f(x)}" cy="${f(ey)}" r="6.5" fill="#e9efe9" stroke="${INK}" stroke-width="2.4"/><path d="M${f(x - 6.5)},${f(ey - 1)} H${f(x + 6.5)}" stroke="${INK}" stroke-width="2.4"/><circle cx="${f(x)}" cy="${f(ey + 2.5)}" r="2" fill="${INK}"/>`); break;
    default: {
      const k = style === "stretch" ? 1.15 : 1;
      e = both((x, d) => `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="${f(7 * k)}" ry="${f(6.4 * k)}" fill="#fff" stroke="${INK}" stroke-width="2.4"/><ellipse cx="${f(x - d * 0.8)}" cy="${f(ey + 0.8)}" rx="${f(3.8 * k)}" ry="${f(4.3 * k)}" fill="${INK}"/><circle cx="${f(x + 1.4)}" cy="${f(ey - 1.6)}" r="1.4" fill="#fff"/>`);
    }
  }
  return e + brows;
}

/**
 * svg(answers | traits, opts): your ninja.
 * opts.mood: "fresh" | "ok" | "foggy";  opts.fog: 0..1 (greys the ninja out);  opts.crop: "full" | "head";
 * opts.standalone: true to embed the hand-drawn filter (for canvas export).
 */
function svg(input, opts = {}) {
  const t = input && input.sig ? input : traits(input || {});
  const C = ninjaPalette(t);
  const cx = 100, R = 44 * (0.96 + (t.scaleY - 0.92) * 0.35), hy = 82;
  const mood = opts.mood || "ok";
  const fog = Math.max(0, Math.min(1, opts.fog || 0));
  const id = "c" + (t.seed % 1e8).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const o = `stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"`;
  const tw = 34 * t.scaleX; // torso half-width

  let out = "";
  out += `<ellipse cx="${cx}" cy="212" rx="${f(tw * 1.35)}" ry="7" fill="${INK}" opacity=".14"/>`;
  // what's on your back (behind everything)
  if (t.carry === "stick") out += `<path d="M${cx + 46},${66} L${cx - 40},${196}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${cx + 46},${66} L${cx - 40},${196}" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/>`;
  else if (t.carry === "book") out += `<g transform="rotate(-14 ${cx} 132)"><rect x="${cx - 54}" y="124" width="108" height="16" rx="8" fill="#efe3c4" ${o}/><rect x="${cx - 60}" y="121" width="9" height="22" rx="3" fill="${C.wood}" ${o}/><rect x="${cx + 51}" y="121" width="9" height="22" rx="3" fill="${C.wood}" ${o}/></g>`;
  else { // a katana: the grip pokes out over the left shoulder
    const ln = (x1, y1, x2, y2, w, col) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${INK}" stroke-width="${w + 5}" stroke-linecap="round"/><path d="M${x1},${y1} L${x2},${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    out += ln(cx + 30, 178, cx - 36, 106, 8, C.wood) + ln(cx - 42, 98, cx - 58, 76, 7, C.band) +
      `<path d="M${cx - 46},${92} l6,5 M${cx - 51},${85} l6,5" stroke="${INK}" stroke-width="1.8"/><ellipse cx="${cx - 38}" cy="103" rx="9" ry="4" transform="rotate(-48 ${cx - 38} 103)" fill="#c9a227" ${o}/>`;
  }
  // legs + split-toe boots
  out += [-1, 1].map((d) => `<rect x="${f(cx + d * 17 - 8)}" y="170" width="16" height="30" rx="7" fill="${C.suit}" ${o}/><rect x="${f(cx + d * 17 - 8.5)}" y="186" width="17" height="6" rx="2" fill="${C.wrap}" stroke="${INK}" stroke-width="2"/><path d="M${f(cx + d * 17 - 11)},208 Q${f(cx + d * 17 - 11)},197 ${f(cx + d * 17)},197 Q${f(cx + d * 17 + 12)},197 ${f(cx + d * 17 + 12)},208Z" fill="${C.dark}" ${o}/><path d="M${f(cx + d * 17 + d * 5)},199 V207" stroke="${INK}" stroke-width="1.8"/>`).join("");
  // torso: gi with a crossed collar, sash, knot and chest badge
  out += `<path d="M${f(cx - tw)},${126} Q${f(cx - tw - 5)},${180} ${f(cx - tw + 8)},${182} H${f(cx + tw - 8)} Q${f(cx + tw + 5)},${180} ${f(cx + tw)},${126} Q${cx},${114} ${f(cx - tw)},${126}Z" fill="${C.suit}" ${o}/>`;
  out += `<path d="M${cx - 18},${124} L${cx + 6},${160} M${cx + 18},${124} L${cx - 2},${152}" stroke="${C.dark}" stroke-width="4" stroke-linecap="round"/>`;
  out += `<rect x="${f(cx - tw - 2)}" y="156" width="${f(2 * tw + 4)}" height="12" rx="5" fill="${C.sash}" ${o}/><circle cx="${cx - 14}" cy="162" r="5.5" fill="${C.sash}" ${o}/><path d="M${cx - 16},166 l-5,15 l6,-1 Z M${cx - 12},166 l3,15 l5,-3 Z" fill="${C.sash}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<circle cx="${cx + 14}" cy="140" r="8.5" fill="${C.wrap}" stroke="${INK}" stroke-width="2"/>${SIGILS[t.month % 12](cx + 14, 140, C.band)}`;
  if (t.carry === "backpack" || t.carry === "camera") out += `<rect x="${f(cx + tw - 14)}" y="162" width="16" height="14" rx="4" fill="${C.dark}" stroke="${INK}" stroke-width="2.4"/>`;
  // arms: up and ready when fresh, hanging when not
  const arm = (d) => {
    const sx = cx + d * (tw - 4), sy = 132, ex = cx + d * (tw + (mood === "fresh" ? 16 : 10)), ey = mood === "fresh" ? 140 : 166;
    return `<path d="M${f(sx)},${sy} Q${f(sx + d * 12)},${f((sy + ey) / 2)} ${f(ex)},${f(ey)}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M${f(sx)},${sy} Q${f(sx + d * 12)},${f((sy + ey) / 2)} ${f(ex)},${f(ey)}" fill="none" stroke="${C.suit}" stroke-width="9" stroke-linecap="round"/>` +
      `<circle cx="${f(ex)}" cy="${f(ey)}" r="7.5" fill="${C.dark}" ${o}/><path d="M${f(ex - 6)},${f(ey - 6)} l${f(d * 3)},-4" stroke="${C.wrap}" stroke-width="4" stroke-linecap="round"/>`;
  };
  out += arm(-1) + arm(1);
  // hood ears from your pet (behind the head)
  if (t.feature === "fox" || t.feature === "cat") out += [-1, 1].map((d) => `<path d="M${f(cx + d * R * 0.35)},${f(hy - R * 0.82)} L${f(cx + d * R * 0.72)},${f(hy - R - 22)} L${f(cx + d * R * 0.92)},${f(hy - R * 0.45)}Z" fill="${C.suit}" ${o}/>`).join("");
  else if (t.feature === "bear") out += [-1, 1].map((d) => `<circle cx="${f(cx + d * R * 0.66)}" cy="${f(hy - R * 0.8)}" r="11" fill="${C.suit}" ${o}/>`).join("");
  // the hood, with the eye slit
  out += `<defs><clipPath id="${id}h"><circle cx="${cx}" cy="${hy}" r="${f(R)}"/></clipPath></defs>`;
  out += `<circle cx="${cx}" cy="${hy}" r="${f(R)}" fill="${C.suit}"/>`;
  const sy0 = hy - 8, sh = 24, ey = hy + 4, gap = 13 + (t.eyeGap - 15) * 0.5;
  out += `<g clip-path="url(#${id}h)"><path d="M${f(cx - R)},${f(hy + R * 0.35)} Q${cx},${f(hy + R * 0.7)} ${f(cx + R)},${f(hy + R * 0.35)} V${f(hy + R)} H${f(cx - R)}Z" fill="${C.dark}" opacity=".35"/>` +
    `<rect x="${f(cx - R * 0.86)}" y="${f(sy0)}" width="${f(R * 1.72)}" height="${sh}" rx="11" fill="${C.skin}" stroke="${INK}" stroke-width="2.6"/></g>`;
  out += ninjaEyes(t, cx, ey, gap, sy0, mood);
  if (t.cheeks && mood !== "foggy") out += [-1, 1].map((d) => `<ellipse cx="${f(cx + d * (gap + 11))}" cy="${f(ey + 6)}" rx="4.5" ry="2.4" fill="#ff8a8a" opacity=".55"/>`).join("");
  out += `<circle cx="${cx}" cy="${hy}" r="${f(R)}" fill="none" ${o}/>`;
  // headwear
  const by = hy - R * 0.5;
  if (t.hat === "wizard" || t.hat === "bucket") {
    const tall = t.hat === "wizard" ? 14 : 0;
    out += `<path d="M${f(cx - R - 24)},${f(hy - R * 0.42)} L${cx},${f(hy - R - 24 - tall)} L${f(cx + R + 24)},${f(hy - R * 0.42)} Q${cx},${f(hy - R * 0.62)} ${f(cx - R - 24)},${f(hy - R * 0.42)}Z" fill="${C.straw}" ${o}/>` +
      [-2, -1, 0, 1, 2].map((k) => `<path d="M${cx},${f(hy - R - 20 - tall)} L${f(cx + k * (R * 0.42))},${f(hy - R * 0.5)}" stroke="#b08a43" stroke-width="1.6"/>`).join("") +
      `<path d="M${f(cx - R * 0.8)},${f(hy - R * 0.5)} Q${cx},${f(hy - R * 0.62)} ${f(cx + R * 0.8)},${f(hy - R * 0.5)}" fill="none" stroke="${C.band}" stroke-width="4"/>`;
  } else {
    const long = t.hat === "band" ? 1.5 : 1;
    // tails first so the knot sits over them
    out += `<path d="M${f(cx + R - 6)},${f(by + 2)} q${f(18 * long)},-6 ${f(30 * long)},${f(8 * long)} l-7,5 q${f(-12 * long)},${f(-9 * long)} ${f(-23 * long)},-6Z" fill="${C.band}" ${o}/>` +
      `<path d="M${f(cx + R - 6)},${f(by + 5)} q${f(14 * long)},${f(4 * long)} ${f(20 * long)},${f(22 * long)} l-7,2 q${f(-6 * long)},${f(-14 * long)} ${f(-16 * long)},${f(-18 * long)}Z" fill="${C.band}" ${o}/>`;
    out += `<g clip-path="url(#${id}h)"><rect x="${f(cx - R)}" y="${f(by - 6)}" width="${f(2 * R)}" height="12" fill="${C.band}" stroke="${INK}" stroke-width="2.6"/></g>`;
    out += `<circle cx="${f(cx + R - 6)}" cy="${f(by + 2)}" r="5.5" fill="${C.band}" ${o}/>`;
    if (t.hat === "cap") out += `<rect x="${cx - 14}" y="${f(by - 8)}" width="28" height="15" rx="3" fill="${C.metal}" ${o}/><path d="M${cx - 5},${f(by)} a5,5 0 1,1 5,4" fill="none" stroke="${INK}" stroke-width="1.8"/>`;
    else if (t.hat === "flowers") out += `<g transform="translate(${f(cx - R * 0.5)},${f(by - 1)})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${f(5 * Math.cos((a * Math.PI) / 180))}" cy="${f(5 * Math.sin((a * Math.PI) / 180))}" r="4.2" fill="#ff9ec7" stroke="${INK}" stroke-width="1.6"/>`).join("")}<circle r="3" fill="#ffd34d" stroke="${INK}" stroke-width="1.6"/></g>`;
    else if (t.hat === "beanie") out += `<circle cx="${cx}" cy="${f(hy - R - 6)}" r="10" fill="${C.dark}" ${o}/><rect x="${cx - 7}" y="${f(hy - R + 1)}" width="14" height="6" rx="2" fill="${C.band}" stroke="${INK}" stroke-width="2"/>`;
  }
  // mood extras
  if (mood === "foggy") out += `<rect x="${cx + tw + 2}" y="148" width="15" height="24" rx="3" fill="${INK}" transform="rotate(-14 ${cx + tw + 9} 160)"/><rect x="${cx + tw + 4}" y="151" width="11" height="17" rx="1.5" fill="#bfe9ff" transform="rotate(-14 ${cx + tw + 9} 160)"/>`;
  if (mood === "fresh") out += [[-1, 0], [1, 1]].map(([d, k]) => `<path d="M${f(cx + d * (R + 30))},${f(hy + 6 + k * 22)} v-10 M${f(cx + d * (R + 25))},${f(hy + 1 + k * 22)} h10" stroke="#f2a01c" stroke-width="3" stroke-linecap="round"/>`).join("");

  const fogFilter = fog > 0.05 ? `<filter id="${id}f"><feColorMatrix type="saturate" values="${f(1 - fog * 0.85)}"/></filter>` : "";
  const fogCloud = fog > 0.25 ? `<g opacity="${f(0.25 + fog * 0.45)}"><ellipse cx="${cx - 30}" cy="${f(hy - R - 6)}" rx="34" ry="14" fill="#c9d1cc"/><ellipse cx="${cx + 18}" cy="${f(hy - R - 14)}" rx="40" ry="16" fill="#d7ddd9"/><ellipse cx="${cx + 52}" cy="${f(hy - R + 4)}" rx="24" ry="11" fill="#c9d1cc"/></g>` : "";
  const rough = opts.standalone ? `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${t.seed % 97}"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>` : "";
  const vb = opts.crop === "head" ? `${f(cx - R - 16)} ${f(hy - R - 20)} ${f(2 * R + 32)} ${f(2 * R + 32)}` : "0 0 200 230";
  const tilt = mood === "foggy" ? t.tilt + 6 : t.tilt * 0.5;
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="walker" role="img" aria-label="${esc(opts.label || "Ninja")}"><defs>${fogFilter}${rough}</defs>` +
    `<g filter="url(#rough)"><g transform="rotate(${f(tilt)} ${cx} 205)"${fogFilter ? ` filter="url(#${id}f)"` : ""}>${out}</g>${fogCloud}</g></svg>`;
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

window.Walker = { QUESTIONS, traits, svg, boss: bossSvg, scene: sceneSvg, signature, fallbackAnswers, hash, rng, COMBOS };
})();
