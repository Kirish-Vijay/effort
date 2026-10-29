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

// ---------- gear you can see: weapon, armour, trinket ----------
// The app merges equipped item ids into the answers as _weapon, _armour, _trinket. Each becomes a "look" the 2D and
// 3D ninjas know how to draw, plus the tier's colour and a rank (0 = common ... 8 = eternal) for how fancy it gets.
// An item's own `look` (and `color`) win; otherwise keywords in its id and name, then its emoji, pick the look.
const GEAR_LOOKS = {
  weapon: ["sword", "club", "staff", "wand", "umbrella", "bat", "book", "spoon", "bag", "hammer", "fan", "whip"],
  armour: ["vest", "plate", "robe", "hoodie", "coat"],
  trinket: ["amulet", "badge", "orb", "bell", "feather", "charm"],
};
const GEAR_DEFAULT = { weapon: "club", armour: "vest", trinket: "charm" };
// [look, words in id + name, emoji]: rules are tried in order (all words first, then all emoji); the first match wins.
const GEAR_WORDS = {
  weapon: [
    ["club", /rolled.up|truncheon|cudgel|\bclub\b/, null],
    ["umbrella", /umbrella|brolly|parasol/, /☂|☔|🌂/u],
    ["bat", /\bbat\b|cricket|baseball|paddle|racket/, /🏏|🏓/u],
    ["spoon", /spork|spoon|ladle|whisk/, /🍴|🥄/u],
    ["sword", /sword|blade|knife|katana|sabre|saber|dagger|scissors|skewer|slicer|cutlass|machete/, /🗡|⚔|✂|🔪|🍢|🧀/u],
    ["bag", /\bbag\b|sack|purse|handbag|tote|satchel|backpack/, /🛍|🎒|👜|💰/u],
    ["fan", /\bfan\b|shuriken|scratchcard|tarot|playing card|pigeon|flock|feather/, /🪭|🃏|🎴|🕊/u],
    ["whip", /whip|rope|chain|nunchuck|nunchuk|jump lead|lash|shoelace|bungee|lasso|flail/, /🪢|🔗|⛓/u],
    ["book", /book|dictionary|encyclop|atlas|tome|ledger|clipboard|guest list|receipt|ticket|notice|\bbill\b|catalogue|dewey|pricing|surcharge|scroll|\bmenu\b/, /📕|📗|📘|📙|📚|📖|📒|📓|📔|📋|🧾|🗃|📜/u],
    ["wand", /wand|divining|\brod\b|sceptre|scepter|baton|ray gun|blaster|beaker|test tube|blender|microwave/, /🪄|✨|🧪/u],
    ["staff", /staff|\bpole\b|pike|lance|spear|fence post|\bpost\b|stave|\bcane\b|lollipop|stop sign|\bsign\b|\bbo\b|maypole/, /🦯|🥢|🍭|🛑/u],
    ["hammer", /hammer|mallet|\bmace\b|gavel|\bram\b|wrecking|stamp|meteor|scooter|magnet/, /🔨|⚒|🪓|☄|🛴|🧲/u],
  ],
  armour: [
    ["hoodie", /hood|onesie|jumper|sweater|sweatshirt|tracksuit|shell suit|pyjama|knit|scarf/, /🥷|🦖|🧶|🧣/u],
    ["robe", /robe|gown|cloak|mantle|poncho|cape|towel|aura|field|wizard|\bhat\b|druid/, /🧙|🌀|🤫|🚿|🧖/u],
    ["coat", /coat|jacket|anorak|puffer|bomber|parka|blazer|duffel|leathers|cardigan|\bcap\b/, /🧥|🥼/u],
    ["plate", /plate|armou?r|exo|helmet|buckler|shield|mail|cube|pads|crown|beacon|bubble/, /🛡|🤖|⛑|🧱|🚪|👑|🗿|🟠|🧊/u],
    ["vest", /vest|tabard|\bhi-?vis\b|waistcoat|gilet|shorts|\bbag\b/, /🦺/u],
  ],
  trinket: [
    ["charm", /dice|rubber duck|gnome/, null],
    ["orb", /\borb\b|\bball\b|sphere|crystal|gobstopper|globe|marble|\brock\b|\bgem\b|pearl|black hole|brain|\bjar\b|petri|soup|amber|8-ball/, /🔮|🎱|🌑|💎|🫧|🧠|🫙|🧫|🍲|🟠/u],
    ["bell", /bell|whistle|horn|megaphone|radio|alarm|earpiece|phone|calculator|torch|remote|notification|bottle|drink|squash|thermos|coffee|bunsen|burner/, /🔔|📯|📣|📻|📱|📲|🔦|🚨|🧃|🥤|☕|🔥|🎧|📡/u],
    ["badge", /badge|\bpin\b|\bcard\b|licence|license|ticket|stamp|\bpass\b|medal|tarot|scratchcard|sudoku|horoscope|newspaper|\bmap\b|shortcut|ledger|edition|notice|hubcap|green man/, /🏅|🎖|🪪|💳|🎫|🎟|🚦|⭐|🌟|🎴|🃏|🧩|📰|🗺|📒|📜|📕|📅|🛞|🖐/u],
    ["feather", /feather|quill|plume|\bleaf\b|leaves|clover|flower|crown|\bchip\b|pigeon|advisor/, /🪶|🍀|🌸|🌼|🍃|🐦|🍵|🍟/u],
    ["amulet", /amulet|necklace|pendant|locket|glasses|chain|medallion|talisman|lanyard/, /📿|👓/u],
    ["charm", /charm|horseshoe|\bkeys?\b|keyring|wallet|purse|sweet|candy|crust|bread|\broll\b|flapjack|snack/, /🎲|🦆|🗝|👛|🍬|🍡|🍞|🥖|🍫|🧌/u],
  ],
};
// Each look's own colour, and which looks take a colour from the item's words (hi-vis, black, gold...).
const GEAR_BASE = {
  sword: "#dfe7ee", club: "#a0703f", staff: "#8a5a2b", wand: "#4a3426", umbrella: "#2f3b52", bat: "#e2c88f", book: "#b8423a",
  spoon: "#eef1f4", bag: "#4f9a6a", hammer: "#8b96a1", fan: "#f3e9d2", whip: "#7a3b2e",
  vest: "#7a5a3a", plate: "#c4ced8", robe: "#5b4b8a", hoodie: "#6d7685", coat: "#9a7444",
  amulet: "#e8b43a", badge: "#eef1f4", orb: "#bfe3ff", bell: "#d9a92c", feather: "#f4f1e8", charm: "#e8b43a",
};
const GEAR_HUED = new Set(["club", "umbrella", "book", "bag", "fan", "whip", "vest", "robe", "hoodie", "coat"]);
const GEAR_HUES = [
  [/\bhi[- ]?vis\b|visibility|fluorescent|belisha|beacon/, "#d4f23c"],
  [/gold|golden|\bsun\b/, "#e8b43a"],
  [/black|dark|night|void|shadow|midnight|bomber|nowhere|invisible|bin bag|moustache/, "#3b3f4c"],
  [/white|lab coat|ghost|towel|hazmat|shower/, "#e6eaee"],
  [/tinfoil|foil|chain|steel|metal|\btin\b|exo|vacuum|trolley|buckler|bin lid/, "#c4ced8"],
  [/velvet|candy|sweet|pink/, "#d9609a"],
  [/purple|cosmic|nebula|galaxy|crystal|wizard|muttering/, "#6a4fb0"],
  [/\bred\b|fire|bunsen|kebab|dictionary/, "#c8463b"],
  [/hedge|clover|green|zebra|crumb/, "#4f8f5a"],
  [/waxed|leather|loden|duffel|tweed|cardigan|fence|cricket|feather/, "#8b6a44"],
  [/rain|anorak|denim|blue|shell suit|tracksuit/, "#3f78c8"],
];
const RANK_LVL = [1, 3, 6, 11, 18, 25, 35, 48, 62]; // tier lvl → rank: common, rare, epic, legendary, mythic, relic, ascendant, celestial, eternal
function gearLook(slot, item) {
  const L = GEAR_LOOKS[slot];
  if (!L) return null;
  if (item && L.includes(item.look)) return item.look;
  const text = `${item?.id || ""} ${item?.name || ""}`.toLowerCase().replace(/[-_]/g, " ").replace(/hi vis/g, "hi-vis");
  for (const [look, re] of GEAR_WORDS[slot]) if (re && re.test(text)) return look;
  const e = String(item?.e || "");
  for (const [look, , re] of GEAR_WORDS[slot]) if (re && re.test(e)) return look;
  return GEAR_DEFAULT[slot];
}
const gearCache = new Map();
function gearPiece(slot, id) {
  if (!id) return null;
  id = String(id);
  const ck = slot + ":" + id;
  if (gearCache.has(ck)) return gearCache.get(ck);
  const G = typeof window !== "undefined" ? window.Game : null, CAT = typeof window !== "undefined" ? window.EffortItems : null;
  let item = null;
  try { item = G?.itemById?.(id) || CAT?.ITEMS?.find((i) => i.id === id) || null; } catch { item = null; }
  const tierId = item?.tier || (/^s\d+-/.test(id) ? id.split("-")[0] : "common");
  let tier = null;
  try { tier = (G?.tierOf && item ? G.tierOf(tierId) : null) || CAT?.TIERS?.find((x) => x.id === tierId) || null; } catch { tier = null; }
  if (!tier && /^s\d+$/.test(tierId)) tier = { id: tierId, color: "#5fd0a8", lvl: Math.min(60, 6 + 4 * (Number(tierId.slice(1)) - 1)) };
  tier = tier || { id: "common", color: "#9aa6c4", lvl: 1 };
  const look = gearLook(slot, item || { id });
  const text = `${id} ${item?.name || ""}`.toLowerCase().replace(/[-_]/g, " ");
  const hue = GEAR_HUED.has(look) ? GEAR_HUES.find(([re]) => re.test(text))?.[1] : null;
  const lvl = Number(tier.lvl) || 1;
  let rank = 0;
  for (let i = 0; i < RANK_LVL.length; i++) if (lvl >= RANK_LVL[i]) rank = i;
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? String(c).toLowerCase() : null);
  const piece = { id, slot, look, tier: tier.id, color: hex(tier.color) || "#9aa6c4", rank, base: hex(item?.color) || hue || GEAR_BASE[look], name: item?.name || id, e: item?.e || "" };
  if (item) gearCache.set(ck, piece); // unknown ids aren't cached: the catalogue may still be loading
  return piece;
}
/** gear(answers) → { weapon, armour, trinket, key }: each null or { id, slot, look, tier, color, rank, base, name, e }. */
function gear(a) {
  a = a || {};
  const weapon = gearPiece("weapon", a._weapon), armour = gearPiece("armour", a._armour), trinket = gearPiece("trinket", a._trinket);
  return { weapon, armour, trinket, key: [a._weapon || "", a._armour || "", a._trinket || ""].join(",") };
}

function traits(a) {
  const sig = signature(a);
  const r = rng(hash(sig));
  const word = rng(hash("w:" + String(a.word || "").trim().toLowerCase()));
  const num = Math.max(1, Math.min(99, Number(a.number) || 7));
  const hue = Number.isFinite(Number(a.hue)) ? Number(a.hue) : Math.floor(r() * 360);
  const pal = (PALETTES[a.time] || PALETTES.noon)(hue);
  return {
    sig, hue, num, time: a.time, wear: { suit: a._suit || null, band: a._band || null }, gear: gear(a),
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
// A hex colour a bit darker (for the shaded side of a wardrobe suit).
const darker = (hex, k = 0.72) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
function ninjaPalette(t) {
  const [s, l] = SUIT[t.time] || SUIT.noon, W = t.wear || {};
  return { suit: W.suit || hsl(t.hue, s, l), dark: W.suit ? darker(W.suit) : hsl(t.hue, s, Math.max(10, l - 12)), band: W.band || t.pal.accent, sash: t.pal.accent2,
    wrap: "#ece6d6", skin: SKIN[t.num % SKIN.length], metal: "#cfd8e0", straw: "#d9b46a", wood: "#3a2a22" };
}

// ---------- 2D gear ----------
// A held weapon, drawn with its grip at 0,0 and its business end pointing up (-y). Rare+ gets tier-colour trims,
// legendary+ a soft halo in the tier colour.
const star5 = (x, y, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R; return `${i ? "L" : "M"}${f(x + Math.cos(a) * k)},${f(y + Math.sin(a) * k)}`; }).join("") + "Z";
function weapon2d(g) {
  const b = g.base, tc = g.color, r = g.rank, trim = r >= 1 ? tc : darker(b, 0.7), s = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
  const grip = (y0, h, col = "#3a2a22") => `<rect x="-3" y="${y0}" width="6" height="${h}" rx="2.5" fill="${col}" ${s}/>`;
  const halo = (y, rr = 15) => (r >= 3 ? `<circle cx="0" cy="${y}" r="${rr}" fill="${tc}" opacity="${r >= 5 ? 0.34 : 0.24}"/>` : "");
  switch (g.look) {
    case "sword": return halo(-32) + grip(-4, 14) + `<path d="M-4.5,-7 V-40 L0,-50 L4.5,-40 V-7Z" fill="${b}" ${s}/>` + (r >= 1 ? `<path d="M0,-11 V-40" stroke="${tc}" stroke-width="2.2"/>` : "") + `<rect x="-10" y="-10" width="20" height="5" rx="2.5" fill="${trim}" ${s}/><circle cy="12" r="3.5" fill="${trim}" ${s}/>`;
    case "staff": return halo(-52, 12) + `<rect x="-3" y="-50" width="6" height="74" rx="3" fill="${b}" ${s}/><rect x="-4" y="-7" width="8" height="12" rx="2" fill="${trim}" ${s}/>` +
      (r >= 2 ? `<path d="M0,-62 L6,-53 L0,-44 L-6,-53Z" fill="${tc}" ${s}/>` : `<rect x="-4" y="-53" width="8" height="6" rx="2" fill="${trim}" ${s}/>`);
    case "wand": return halo(-38, 11) + `<path d="M-2.6,6 L-1.8,-33 H1.8 L2.6,6Z" fill="${b}" ${s}/><path d="${star5(0, -38, 8, 3.4)}" fill="${r >= 1 ? tc : "#fff3b0"}" ${s}/>`;
    case "umbrella": return halo(-30) + `<path d="M0,2 v7 q0,6 -6,6 q-5,0 -5,-5" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M0,2 v7 q0,6 -6,6 q-5,0 -5,-5" fill="none" stroke="#3a2a22" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="-1.6" y="-54" width="3.2" height="58" fill="#c9cfd6" ${s}/><path d="M0,-52 L8.5,-14 Q0,-9 -8.5,-14Z" fill="${b}" ${s}/><path d="M-6.5,-27 H6.5" stroke="${trim}" stroke-width="3"/>`;
    case "bat": return halo(-32) + grip(-12, 20) + (r >= 1 ? `<rect x="-3.5" y="-2" width="7" height="6" fill="${tc}" ${s}/>` : "") + `<rect x="-7" y="-50" width="14" height="40" rx="5" fill="${b}" ${s}/>` + (r >= 1 ? `<path d="M-5,-40 H5 M-5,-35 H5" stroke="${tc}" stroke-width="2.4"/>` : "");
    case "book": return halo(-16, 18) + `<rect x="-12" y="-32" width="24" height="32" rx="3" fill="${b}" ${s}/><path d="M-7,-4 H9 V-28" stroke="#f4ecd8" stroke-width="3" fill="none"/><rect x="-12" y="-32" width="5" height="32" rx="2" fill="${trim}" ${s}/>` +
      (r >= 2 ? `<circle cx="2" cy="-17" r="4" fill="${tc}" ${s}/>` : "");
    case "spoon": return halo(-38, 12) + `<rect x="-2.3" y="-31" width="4.6" height="36" rx="2" fill="${r >= 1 ? tc : b}" ${s}/><ellipse cx="0" cy="-38" rx="7" ry="9.5" fill="${b}" ${s}/><path d="M-3,-46 V-41 M0,-47.5 V-42 M3,-46 V-41" stroke="${INK}" stroke-width="1.4"/>`;
    case "bag": return halo(20, 18) + `<path d="M-7,10 Q-7,-5 0,-5 Q7,-5 7,10" fill="none" stroke="${INK}" stroke-width="5.6"/><path d="M-7,10 Q-7,-5 0,-5 Q7,-5 7,10" fill="none" stroke="${trim}" stroke-width="2.6"/>` +
      `<path d="M-12,8 H12 L14,34 Q0,38 -14,34Z" fill="${b}" ${s}/>` + (r >= 1 ? `<rect x="-6" y="16" width="12" height="9" rx="2" fill="${tc}" ${s}/>` : "");
    case "hammer": return halo(-41) + grip(-36, 44, "#8a5a2b") + `<rect x="-13" y="-48" width="26" height="15" rx="3" fill="${b}" ${s}/>` +
      (r >= 1 ? `<rect x="-14.5" y="-49.5" width="5.5" height="18" rx="2" fill="${tc}" ${s}/><rect x="9" y="-49.5" width="5.5" height="18" rx="2" fill="${tc}" ${s}/>` : "");
    case "fan": return halo(-20, 20) + `<path d="M0,2 L-29.4,-17 A34,34 0 0,1 29.4,-17 Z" fill="${b}" ${s}/>` +
      [-50, -25, 0, 25, 50].map((a) => `<path d="M0,0 L${f(31 * Math.sin((a * Math.PI) / 180))},${f(-31 * Math.cos((a * Math.PI) / 180))}" stroke="${INK}" stroke-width="1.2" opacity=".55"/>`).join("") +
      (r >= 1 ? `<path d="M-25.5,-14.7 A29.5,29.5 0 0,1 25.5,-14.7" fill="none" stroke="${tc}" stroke-width="4"/>` : "") + `<circle r="3.5" fill="${trim}" ${s}/>`;
    case "whip": return halo(-20, 16) + grip(-13, 20) + `<path d="M0,-12 C8,-46 32,-42 28,-14 S16,18 30,26" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M0,-12 C8,-46 32,-42 28,-14 S16,18 30,26" fill="none" stroke="${b}" stroke-width="3.2" stroke-linecap="round"/>` +
      (r >= 1 ? `<circle cx="30" cy="26" r="3.6" fill="${tc}" ${s}/>` : "");
    default: return halo(-30) + grip(-6, 16) + `<path d="M-3.5,-6 L-8.5,-40 Q0,-51 8.5,-40 L3.5,-6Z" fill="${b}" ${s}/>` + (r >= 1 ? `<path d="M-7,-30 H7" stroke="${tc}" stroke-width="4"/>` : ""); // club
  }
}
// A trinket at x,y (its own anchor: chest, belt, head or by the shoulder).
function trinket2d(g, x, y) {
  const tc = g.color, b = g.base, r = g.rank, s = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  const halo = (hx, hy, rr) => (r >= 3 ? `<circle cx="${f(hx)}" cy="${f(hy)}" r="${rr}" fill="${tc}" opacity="${r >= 5 ? 0.38 : 0.26}"/>` : "");
  switch (g.look) {
    case "amulet": return `<path d="M${f(x - 13)},${f(y - 18)} L${f(x)},${f(y - 3)} L${f(x + 13)},${f(y - 18)}" fill="none" stroke="${b}" stroke-width="1.8"/>` + halo(x, y + 1, 9) + `<circle cx="${f(x)}" cy="${f(y + 1)}" r="5" fill="${tc}" ${s}/><circle cx="${f(x - 1.4)}" cy="${f(y - 0.5)}" r="1.4" fill="#fff" opacity=".8"/>`;
    case "badge": return halo(x, y, 12) + `<circle cx="${f(x)}" cy="${f(y)}" r="8.6" fill="${tc}" ${s}/><circle cx="${f(x)}" cy="${f(y)}" r="6.2" fill="${b}"/>` +
      (g.e ? `<text x="${f(x)}" y="${f(y + 0.5)}" font-size="8" text-anchor="middle" dominant-baseline="central">${esc(g.e)}</text>` : "");
    case "orb": return halo(x, y, 13) + (r >= 2 ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="13" ry="4" fill="none" stroke="${INK}" stroke-width="3.6"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="13" ry="4" fill="none" stroke="${b}" stroke-width="1.6"/>` : "") +
      `<circle cx="${f(x)}" cy="${f(y)}" r="8" fill="${tc}" ${s}/><circle cx="${f(x - 2.6)}" cy="${f(y - 2.6)}" r="2.4" fill="#fff" opacity=".85"/>`;
    case "bell": { const c = r >= 1 ? tc : b; return halo(x, y + 6, 10) + `<path d="M${f(x)},${f(y - 3)} V${f(y)}" stroke="${INK}" stroke-width="2"/><path d="M${f(x - 6)},${f(y + 9)} Q${f(x - 6)},${f(y)} ${f(x)},${f(y)} Q${f(x + 6)},${f(y)} ${f(x + 6)},${f(y + 9)} L${f(x + 8)},${f(y + 12)} H${f(x - 8)}Z" fill="${c}" ${s}/><circle cx="${f(x)}" cy="${f(y + 13.5)}" r="2.2" fill="${INK}"/>`; }
    case "feather": return halo(x - 6, y - 16, 10) + `<g transform="translate(${f(x)},${f(y)}) rotate(-28)"><path d="M0,2 C-6,-10 -3,-26 4,-32 C9,-20 7,-8 0,2Z" fill="${b}" ${s}/><path d="M4,-32 C7,-27 7.5,-22 6.5,-18 L1.5,-22 C2,-26 2.6,-29 4,-32Z" fill="${tc}"/><path d="M0,2 L3.5,-28" stroke="${INK}" stroke-width="1.2"/></g>`;
    default: return `<path d="M${f(x)},${f(y - 6)} V${f(y)}" stroke="${INK}" stroke-width="2"/>` + halo(x, y + 6, 10) + `<path d="M${f(x)},${f(y)} L${f(x + 6)},${f(y + 6)} L${f(x)},${f(y + 12)} L${f(x - 6)},${f(y + 6)}Z" fill="${tc}" ${s}/><circle cx="${f(x)}" cy="${f(y - 6)}" r="2" fill="${b}" stroke="${INK}" stroke-width="1.2"/>`; // charm
  }
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
  // gear (weapon in your right hand = viewer's left, armour over the gi, a trinket)
  const GR = t.gear || {}, A = GR.armour, WP = GR.weapon, TR = GR.trinket;
  const look = A ? A.look : null, ac = A ? A.base : null, at = A ? (A.rank >= 1 ? A.color : darker(A.base, 0.72)) : null;
  // robes and coats hang below the gi
  if (look === "robe") out += `<path d="M${f(cx - tw + 2)},148 L${f(cx - tw - 12)},195 Q${cx},201 ${f(cx + tw + 12)},195 L${f(cx + tw - 2)},148Z" fill="${ac}" ${o}/>` +
    `<path d="M${f(cx - tw - 10)},191 Q${cx},197 ${f(cx + tw + 10)},191" fill="none" stroke="${at}" stroke-width="4"/><path d="M${cx},150 V197" stroke="${at}" stroke-width="3.4"/>`;
  else if (look === "coat") out += [-1, 1].map((d) => `<path d="M${f(cx + d * (tw - 2))},148 L${f(cx + d * (tw + 8))},190 Q${f(cx + d * 14)},193 ${f(cx + d * 4)},190 L${f(cx + d * 4)},148Z" fill="${ac}" ${o}/>`).join("") +
    (A.rank >= 1 ? [-1, 1].map((d) => `<path d="M${f(cx + d * 5)},176 V188" stroke="${at}" stroke-width="3"/>`).join("") : "");
  // torso: gi with a crossed collar, sash, knot and chest badge (a vest, coat, robe or hoodie recolours it)
  const torsoFill = A && look !== "plate" ? ac : C.suit;
  out += `<path d="M${f(cx - tw)},${126} Q${f(cx - tw - 5)},${180} ${f(cx - tw + 8)},${182} H${f(cx + tw - 8)} Q${f(cx + tw + 5)},${180} ${f(cx + tw)},${126} Q${cx},${114} ${f(cx - tw)},${126}Z" fill="${torsoFill}" ${o}/>`;
  if (look === "vest" || look === "coat") { // open down the front, the gi showing through
    out += `<path d="M${cx - 9},119 L${cx - 7},181 H${cx + 7} L${cx + 9},119Z" fill="${C.suit}"/>`;
    if (look === "vest" && ac === "#d4f23c") out += `<path d="M${f(cx - tw + 1)},146 H${cx - 9} M${cx + 9},146 H${f(cx + tw - 1)}" stroke="#eef2f4" stroke-width="4"/>`;
    if (A.rank >= 1) out += `<path d="M${cx - 9},120 L${cx - 7},180 M${cx + 9},120 L${cx + 7},180" stroke="${at}" stroke-width="3"/>`;
    if (look === "coat") out += [-1, 1].map((d) => `<path d="M${cx + d * 9},119 L${f(cx + d * 21)},121 L${cx + d * 10},140Z" fill="${darker(ac, 0.8)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`).join("");
  }
  if (!A || look === "vest" || look === "coat") out += `<path d="M${cx - 18},${124} L${cx + 6},${160} M${cx + 18},${124} L${cx - 2},${152}" stroke="${C.dark}" stroke-width="4" stroke-linecap="round"/>`;
  if (look === "hoodie") out += `<path d="M${cx - 15},146 H${cx + 15} L${cx + 19},158 H${cx - 19}Z" fill="${darker(ac, 0.82)}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${cx - 6},123 V138 M${cx + 6},123 V136" stroke="${at}" stroke-width="2.6" stroke-linecap="round"/>`;
  if (look === "robe") out += `<path d="M${cx - 15},121 L${cx},140 L${cx + 15},121" fill="none" stroke="${at}" stroke-width="4" stroke-linejoin="round"/>`;
  if (look === "plate") out += `<path d="M${f(cx - tw + 4)},128 Q${cx},116 ${f(cx + tw - 4)},128 L${f(cx + tw - 7)},154 Q${cx},162 ${f(cx - tw + 7)},154Z" fill="${ac}" ${o}/><path d="M${cx},121 V157" stroke="${darker(ac, 0.7)}" stroke-width="2.4"/>` +
    (A.rank >= 1 ? `<path d="M${f(cx - tw + 8)},151 Q${cx},158 ${f(cx + tw - 8)},151" fill="none" stroke="${at}" stroke-width="3.4"/>` : "");
  out += `<rect x="${f(cx - tw - 2)}" y="156" width="${f(2 * tw + 4)}" height="12" rx="5" fill="${C.sash}" ${o}/><circle cx="${cx - 14}" cy="162" r="5.5" fill="${C.sash}" ${o}/><path d="M${cx - 16},166 l-5,15 l6,-1 Z M${cx - 12},166 l3,15 l5,-3 Z" fill="${C.sash}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<circle cx="${cx + 14}" cy="140" r="8.5" fill="${C.wrap}" stroke="${INK}" stroke-width="2"/>${SIGILS[t.month % 12](cx + 14, 140, C.band)}`;
  if (t.carry === "backpack" || t.carry === "camera") out += `<rect x="${f(cx + tw - 14)}" y="162" width="16" height="14" rx="4" fill="${C.dark}" stroke="${INK}" stroke-width="2.4"/>`;
  if (TR && TR.look === "amulet") out += trinket2d(TR, cx - 2, 138);
  else if (TR && TR.look === "badge") out += trinket2d(TR, cx - 13, 141);
  else if (TR && TR.look === "bell") out += trinket2d(TR, cx + tw - 7, 169);
  else if (TR && TR.look === "charm") out += trinket2d(TR, f(cx - tw + 5), 172);
  // arms: up and ready when fresh, hanging when not (in sleeves under a coat, robe or hoodie)
  const sleeve = look === "coat" || look === "robe" || look === "hoodie" ? ac : C.suit;
  const fist = {};
  const arm = (d) => {
    const sx = cx + d * (tw - 4), sy = 132, ex = cx + d * (tw + (mood === "fresh" ? 16 : 10)), ey = mood === "fresh" ? 140 : 166;
    fist[d] = [ex, ey];
    return `<path d="M${f(sx)},${sy} Q${f(sx + d * 12)},${f((sy + ey) / 2)} ${f(ex)},${f(ey)}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M${f(sx)},${sy} Q${f(sx + d * 12)},${f((sy + ey) / 2)} ${f(ex)},${f(ey)}" fill="none" stroke="${sleeve}" stroke-width="9" stroke-linecap="round"/>` +
      `<circle cx="${f(ex)}" cy="${f(ey)}" r="7.5" fill="${C.dark}" ${o}/><path d="M${f(ex - 6)},${f(ey - 6)} l${f(d * 3)},-4" stroke="${C.wrap}" stroke-width="4" stroke-linecap="round"/>`;
  };
  out += arm(-1) + arm(1);
  // shoulder trims: plate pauldrons, or tier-coloured epaulettes on rare+ armour
  if (look === "plate") out += [-1, 1].map((d) => `<circle cx="${f(cx + d * (tw - 3))}" cy="129" r="10.5" fill="${ac}" ${o}/>` + (A.rank >= 1 ? `<circle cx="${f(cx + d * (tw - 3))}" cy="129" r="6.5" fill="none" stroke="${at}" stroke-width="2.6"/>` : "")).join("");
  else if (A && A.rank >= 1) out += [-1, 1].map((d) => `<rect x="${f(cx + d * (tw - 5) - 8)}" y="121" width="16" height="7" rx="3.5" fill="${at}" stroke="${INK}" stroke-width="2.2"/>`).join("");
  // the weapon, gripped in the right fist (bags hang, everything else leans out)
  if (WP) { const [wx, wy] = fist[-1]; out += `<g transform="translate(${f(wx)},${f(wy)}) rotate(${WP.look === "bag" ? 0 : -18})">${weapon2d(WP)}</g><circle cx="${f(wx)}" cy="${f(wy)}" r="7.5" fill="${C.dark}" ${o}/>`; }
  // a hoodie's hood bunches up behind the head
  if (look === "hoodie") out += `<ellipse cx="${cx}" cy="${f(hy + R * 0.78)}" rx="${f(R * 0.98)}" ry="16" fill="${ac}" ${o}/>`;
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
  // head and shoulder trinkets
  if (TR && TR.look === "feather") out += t.hat === "wizard" || t.hat === "bucket" ? trinket2d(TR, f(cx - R * 0.78), f(hy - R * 0.52)) : trinket2d(TR, f(cx - R + 8), f(by - 3));
  else if (TR && TR.look === "orb") out += trinket2d(TR, f(cx + tw + 20), 106);
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

window.Walker = { QUESTIONS, traits, svg, boss: bossSvg, scene: sceneSvg, signature, fallbackAnswers, hash, rng, COMBOS, gear, gearLook, GEAR_LOOKS };
})();
