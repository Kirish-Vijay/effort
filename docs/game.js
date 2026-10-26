// Effort game rules: the step currency, walker stats, gear, the 7pm tax battle and the Sunday raid.
// Pure logic with no DOM, so the test lab, the app and the server can all run the same numbers.
(function (root) {
"use strict";

// Every number worth tuning lives here. The lab's Knobs panel edits a copy of this.
const DEFAULT_RULES = {
  stepsPerEffort: 100,      // 100 steps = 1 Effort
  effortsPerEndeavour: 100, // 100 Efforts = 1 Endeavour
  dailyEffortCap: 300,      // 30k steps a day, max
  scrollMinPer1kSteps: 5,   // scroll budget earned per 1,000 steps
  scrollBudgetMax: 60,
  baseTax: 0.30,            // the Taxman takes 30% of today's Efforts if you don't fight
  taxPerOverMin: 0.005,     // +0.5% tax per minute scrolled over budget
  taxMaxExtra: 0.20,
  stealCap: 0.30,           // beat the Taxman, keep tapping: steal up to +30%
  windowHour: 19,           // battles open at 7pm
  dailyWindowMin: 5,
  raidMin: 15,
  taxmanBaseHp: 450,
  taxmanHpPerEffort: 2.5,
  taxmanHpPerOverMin: 6,
  stealDmgPerPct: 0.12,     // extra damage (as a share of HP) for each 1% stolen
  comboWindowMs: 320,
  comboMax: 50,
  raidHpPerMember: 18000,   // boss HP per squad member at level 1 (about 12 min for a good squad)
  raidLvlPerGear: 0.06,     // each average gear point on the squad adds 6% boss level
  raidAtkEvery: 6,          // seconds between boss attacks (phase 1)
  raidTelegraph: 2,
  raidBossDmg: 15,          // a swipe at level 1
  raidRewardPerMember: 150, // Efforts per squad member per boss level, on a win
  triviaSeconds: 25,
  triviaQuestions: 3,
  triviaFailAt: 2,          // this many wrong = paralysed
  paralysedSteps: 2500,     // step deficit the next day
  paralysedStunSec: 12,
};
let RULES = { ...DEFAULT_RULES };
function setRules(r) { RULES = { ...DEFAULT_RULES, ...(r || {}) }; return RULES; }

// ---------- seeded randomness (same as character.js) ----------
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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---------- currency ----------
const effortsFromSteps = (steps) => clamp(Math.floor((Number(steps) || 0) / RULES.stepsPerEffort), 0, RULES.dailyEffortCap);
function money(efforts) {
  const e = Math.round(efforts), sign = e < 0 ? "−" : "";
  const a = Math.abs(e), en = Math.floor(a / RULES.effortsPerEndeavour), ef = a % RULES.effortsPerEndeavour;
  if (!en) return `${sign}${ef} Effort${ef === 1 ? "" : "s"}`;
  return `${sign}${en} Endeavour${en === 1 ? "" : "s"}${ef ? ` ${ef} Effort${ef === 1 ? "" : "s"}` : ""}`;
}
const scrollBudget = (steps) => Math.min(RULES.scrollBudgetMax, Math.floor((steps || 0) / 1000) * RULES.scrollMinPer1kSteps);
const overBudget = (steps, scrollMin) => Math.max(0, (scrollMin || 0) - scrollBudget(steps));
const taxRate = (steps, scrollMin) => RULES.baseTax + Math.min(RULES.taxMaxExtra, overBudget(steps, scrollMin) * RULES.taxPerOverMin);

// ---------- stats from quiz answers ----------
// Five stats, always 30 points between them (2 to 10 each). Answers lean them one way or another.
const STATS = [
  { id: "power", label: "Power", e: "💪", what: "Damage per tap" },
  { id: "guard", label: "Guard", e: "🛡️", what: "Health and armour" },
  { id: "speed", label: "Speed", e: "🏃", what: "Faster cooldowns and combos" },
  { id: "brains", label: "Brains", e: "🧠", what: "Trivia hints, earlier warnings" },
  { id: "luck", label: "Luck", e: "🍀", what: "Critical hits" },
];
const STAT_TOTAL = 30, STAT_MIN = 2, STAT_MAX = 10;
const LEAN = {
  time: { dawn: "speed guard", noon: "power power", golden: "luck luck", night: "brains brains" },
  pace: { amble: "guard guard luck", stroll: "guard power brains", march: "speed speed power", strut: "luck luck power", wander: "brains luck luck", dash: "speed speed speed" },
  land: { mountains: "guard guard", coast: "brains luck", forest: "guard brains", city: "speed luck", desert: "power speed", tundra: "guard power" },
  carry: { backpack: "guard guard", umbrella: "guard luck", camera: "brains luck", headphones: "speed speed", book: "brains brains", stick: "power power", none: "luck speed" },
  creature: { fox: "luck brains", owl: "brains brains", frog: "guard luck", cat: "speed luck", crow: "brains power", snail: "guard guard", bear: "power power", moth: "luck speed" },
  morning: { coffee: "power speed", out: "speed speed", snooze: "guard luck", music: "power power", stretch: "guard speed", scroll: "luck" },
  laugh: { giggle: "brains luck", snort: "luck luck", cackle: "power brains", silent: "guard guard", boom: "power power", wheeze: "speed guard" },
  hat: { beanie: "guard brains", cap: "speed power", bucket: "luck luck", flowers: "luck guard", wizard: "brains brains", band: "speed speed", none: "power luck" },
};
function stats(answers) {
  const a = answers || {};
  const w = { power: 1, guard: 1, speed: 1, brains: 1, luck: 1 };
  for (const [q, map] of Object.entries(LEAN)) for (const s of (map[a[q]] || "").split(" ").filter(Boolean)) w[s] += 1;
  // The free answers each nudge one stat, so two people with the same picks still differ.
  for (const k of ["hue", "month", "number", "word"]) {
    const v = String(a[k] ?? "").trim().toLowerCase();
    if (v) w[STATS[hash(k + ":" + v) % 5].id] += 1;
  }
  // Hand out the 20 free points one at a time to whichever stat is furthest below its fair share.
  const out = {};
  STATS.forEach(({ id }) => (out[id] = STAT_MIN));
  for (let left = STAT_TOTAL - STAT_MIN * 5; left > 0; left--) {
    let best = null;
    for (const { id } of STATS) if (out[id] < STAT_MAX && (!best || w[id] / (out[id] - 1) > w[best] / (out[best] - 1))) best = id;
    out[best]++;
  }
  return out;
}
const POSITIONS = [
  { id: "front", label: "Front", e: "🛡️", ability: "Shield wall", abilityWhat: "Front row takes 60% less damage for 8s", mult: 1.15, aggro: 70 },
  { id: "mid", label: "Middle", e: "⚔️", ability: "Big swing", abilityWhat: "Your next 8 taps hit 3× as hard", mult: 1.3, aggro: 25 },
  { id: "back", label: "Back", e: "🩹", ability: "Patch up", abilityWhat: "Heal the most hurt teammate 35%", mult: 0.85, aggro: 5 },
];
const posOf = (id) => POSITIONS.find((p) => p.id === id) || POSITIONS[1];
function suggestedPosition(st) {
  const score = { front: st.guard * 2 + st.power * 0.5, mid: st.power + st.speed, back: st.brains + st.luck * 0.8 + st.speed * 0.3 };
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

// ---------- gear ----------
const GEAR = [
  { id: "stick", slot: "weapon", name: "Pointy stick", e: "🪵", stat: "power", plus: 2, price: 100 },
  { id: "umbrella", slot: "weapon", name: "Golf umbrella", e: "☂️", stat: "power", plus: 4, price: 300 },
  { id: "bat", slot: "weapon", name: "Cricket bat", e: "🏏", stat: "power", plus: 6, price: 600 },
  { id: "extinguisher", slot: "weapon", name: "Fire extinguisher", e: "🧯", stat: "power", plus: 8, price: 1000 },
  { id: "hoodie", slot: "armour", name: "Thick hoodie", e: "🧥", stat: "guard", plus: 2, price: 100 },
  { id: "puffer", slot: "armour", name: "Puffer jacket", e: "🦺", stat: "guard", plus: 4, price: 300 },
  { id: "binlid", slot: "armour", name: "Bin lid shield", e: "🛡️", stat: "guard", plus: 6, price: 600 },
  { id: "riot", slot: "armour", name: "Full riot gear", e: "⛑️", stat: "guard", plus: 8, price: 1000 },
  { id: "trainers", slot: "trinket", name: "Fresh trainers", e: "👟", stat: "speed", plus: 3, price: 200 },
  { id: "coin", slot: "trinket", name: "Lucky 2p coin", e: "🪙", stat: "luck", plus: 3, price: 200 },
  { id: "calculator", slot: "trinket", name: "Calculator watch", e: "⌚", stat: "brains", plus: 3, price: 200 },
];
const SLOTS = ["weapon", "armour", "trinket"];
const gearById = (id) => GEAR.find((g) => g.id === id);
function withGear(st, equipped) {
  const out = { ...st };
  for (const id of Object.values(equipped || {})) { const g = gearById(id); if (g) out[g.stat] += g.plus; }
  return out;
}
const gearPoints = (equipped) => Object.values(equipped || {}).reduce((s, id) => s + (gearById(id)?.plus || 0), 0);

// ---------- 7pm: the Taxman ----------
// Can't die. Damage cuts the tax; once he's down, every extra chunk of damage steals 1% back.
function taxmanSetup({ steps = 0, scrollMin = 0, stats: st = {}, equipped = {} }) {
  const efforts = effortsFromSteps(steps), over = overBudget(steps, scrollMin);
  const g = withGear(st, equipped);
  return {
    efforts, over, taxRate: taxRate(steps, scrollMin),
    hp: Math.round(RULES.taxmanBaseHp + efforts * RULES.taxmanHpPerEffort + over * RULES.taxmanHpPerOverMin),
    tapDmg: 1 + (g.power || 0) * 0.08,
    critChance: (g.luck || 0) * 0.02,
    comboWindow: RULES.comboWindowMs + (g.speed || 0) * 12,
    seconds: RULES.dailyWindowMin * 60,
  };
}
function taxmanStart(setup, seed = Date.now()) {
  return { setup, r: rng(seed), dmg: 0, taps: 0, combo: 0, lastTap: -1e9, crits: 0, t: 0, over: false };
}
// One tap at time `ms` (ms since the fight started). Returns the hit for the UI.
function taxmanTap(B, ms) {
  if (B.over) return null;
  const S = B.setup;
  B.combo = ms - B.lastTap <= S.comboWindow ? Math.min(RULES.comboMax, B.combo + 1) : 0;
  B.lastTap = ms;
  const crit = B.r() < S.critChance;
  const dmg = S.tapDmg * (1 + B.combo / RULES.comboMax) * (crit ? 3 : 1);
  B.dmg += dmg; B.taps++; if (crit) B.crits++;
  return { dmg, crit, combo: B.combo };
}
function taxmanResult(B) {
  const S = B.setup;
  const knocked = Math.min(1, B.dmg / S.hp);
  const extra = Math.max(0, B.dmg - S.hp);
  const stealPct = Math.min(RULES.stealCap, Math.floor(extra / (S.hp * RULES.stealDmgPerPct)) / 100);
  const taxed = Math.round(S.efforts * S.taxRate * (1 - knocked));
  const stolen = Math.round(S.efforts * stealPct);
  return { earned: S.efforts, taxRate: S.taxRate, knocked, taxed, stealPct, stolen, net: S.efforts - taxed + stolen, beaten: knocked >= 1 };
}

// ---------- trivia (science and maths) ----------
const FACTS = [
  ["Chemical symbol for gold?", "Au", ["Ag", "Gd", "Go"]],
  ["Which planet has the most known moons?", "Saturn", ["Jupiter", "Uranus", "Neptune"]],
  ["Roughly how fast is light?", "300,000 km/s", ["30,000 km/s", "3,000 km/s", "3 million km/s"]],
  ["Which part of a cell makes most of its ATP?", "Mitochondria", ["Nucleus", "Ribosome", "Golgi body"]],
  ["pH of pure water at 25°C?", "7", ["0", "5", "14"]],
  ["Most common gas in Earth's air?", "Nitrogen", ["Oxygen", "Carbon dioxide", "Argon"]],
  ["Hardest natural mineral?", "Diamond", ["Quartz", "Topaz", "Granite"]],
  ["How many bones in an adult human?", "206", ["186", "226", "312"]],
  ["Absolute zero in °C?", "−273.15", ["−100", "−459.67", "0"]],
  ["Element with atomic number 1?", "Hydrogen", ["Helium", "Oxygen", "Carbon"]],
  ["Unit of electrical resistance?", "Ohm", ["Volt", "Amp", "Watt"]],
  ["Planet closest to the Sun?", "Mercury", ["Venus", "Mars", "Earth"]],
  ["Water boils at sea level at how many °F?", "212", ["100", "180", "232"]],
  ["Shape of a DNA molecule?", "Double helix", ["Single strand", "Triple helix", "Ring"]],
  ["Largest organ of the human body?", "Skin", ["Liver", "Brain", "Lungs"]],
  ["Chemical formula for table salt?", "NaCl", ["KCl", "NaOH", "CaCl₂"]],
  ["Chromosomes in a typical human body cell?", "46", ["23", "44", "48"]],
  ["Gas plants take in for photosynthesis?", "Carbon dioxide", ["Oxygen", "Nitrogen", "Hydrogen"]],
  ["SI unit of force?", "Newton", ["Joule", "Pascal", "Watt"]],
  ["A light-year measures…", "Distance", ["Time", "Brightness", "Speed"]],
  ["Fe is the symbol for…", "Iron", ["Fluorine", "Lead", "Francium"]],
  ["Which blood cells fight infection?", "White blood cells", ["Red blood cells", "Platelets", "Plasma"]],
  ["Fastest land animal?", "Cheetah", ["Pronghorn", "Lion", "Greyhound"]],
  ["Sound travels fastest through…", "Steel", ["Air", "Water", "A vacuum"]],
  ["Main gas in the Sun?", "Hydrogen", ["Helium", "Oxygen", "Carbon"]],
  ["Who came up with general relativity?", "Einstein", ["Newton", "Bohr", "Hawking"]],
  ["Which planet has the Great Red Spot?", "Jupiter", ["Mars", "Saturn", "Neptune"]],
  ["Water freezes at about how many kelvin?", "273", ["0", "100", "373"]],
  ["Which vitamin does skin make in sunlight?", "D", ["A", "C", "K"]],
  ["Which particle has a negative charge?", "Electron", ["Proton", "Neutron", "Photon"]],
  ["Earth's core is mostly…", "Iron", ["Gold", "Silicon", "Lead"]],
  ["Newton's second law: F = ?", "ma", ["mv", "mc²", "m/a"]],
  ["Roughly how long does sunlight take to reach Earth?", "8 minutes", ["8 seconds", "1 hour", "1 day"]],
  ["Which metal is liquid at room temperature?", "Mercury", ["Gallium", "Sodium", "Tin"]],
  ["Interior angles of a triangle add up to…", "180°", ["90°", "270°", "360°"]],
  ["A googol is 10 to the power of…", "100", ["10", "1,000", "a million"]],
  ["What is 0! (zero factorial)?", "1", ["0", "Undefined", "∞"]],
  ["Which of these is NOT prime?", "51", ["41", "43", "47"]],
  ["π to two decimal places?", "3.14", ["3.12", "3.16", "3.41"]],
  ["Next prime after 89?", "97", ["91", "93", "95"]],
  ["How many sides does a hexagon have?", "6", ["5", "7", "8"]],
  ["Which organ pumps blood?", "Heart", ["Lungs", "Kidney", "Liver"]],
  ["What do bees make?", "Honey", ["Wax only", "Nectar", "Pollen"]],
  ["H₂O is…", "Water", ["Hydrogen peroxide", "Salt", "Oxygen"]],
];
function mathQuestion(r) {
  const kind = Math.floor(r() * 6);
  let q, ans;
  if (kind === 0) { const a = 12 + Math.floor(r() * 30), b = 3 + Math.floor(r() * 7); q = `${a} × ${b} = ?`; ans = a * b; }
  else if (kind === 1) { const p = pick(r, [10, 15, 20, 25, 30, 40, 75]), n = (2 + Math.floor(r() * 18)) * 20; q = `${p}% of ${n} = ?`; ans = (p * n) / 100; }
  else if (kind === 2) { const n = 11 + Math.floor(r() * 15); q = `${n}² = ?`; ans = n * n; }
  else if (kind === 3) { const x = 2 + Math.floor(r() * 12), a = 2 + Math.floor(r() * 7), b = 1 + Math.floor(r() * 20); q = `${a}x + ${b} = ${a * x + b}. x = ?`; ans = x; }
  else if (kind === 4) { const n = 5 + Math.floor(r() * 8); q = `2 to the power of ${n} = ?`; ans = 2 ** n; }
  else { const b = 50 + Math.floor(r() * 400), a = b + 20 + Math.floor(r() * 500); q = `${a} − ${b} = ?`; ans = a - b; }
  const wrong = new Set();
  const nudges = [1, 2, 10, -1, -2, -10, 5, -5, ans >= 20 ? Math.round(ans * 0.1) : 3];
  for (let i = 0; wrong.size < 3 && i < 40; i++) { const w = ans + pick(r, nudges) * (r() < 0.5 ? 1 : 2); if (w !== ans && w >= 0) wrong.add(w); }
  for (let k = 1; wrong.size < 3; k++) wrong.add(ans + k); // always four options
  return [q, String(ans), [...wrong].map(String)];
}
// Three questions, roughly half maths. `correct` is the index of the right option.
function triviaSet(seed) {
  const r = rng(seed);
  const used = new Set(), out = [];
  while (out.length < RULES.triviaQuestions) {
    let item;
    if (r() < 0.45) item = mathQuestion(r);
    else { let i; do { i = Math.floor(r() * FACTS.length); } while (used.has(i)); used.add(i); item = FACTS[i]; }
    const opts = [item[1], ...item[2]];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    out.push({ q: item[0], options: opts, correct: opts.indexOf(item[1]) });
  }
  return out;
}

// ---------- Sunday: the squad raid ----------
// members: [{ id, name, stats, equipped, pos, bot }]. Time is in seconds; call raidStep with real elapsed time.
function raidCreate(members, { seed = Date.now(), minutes = RULES.raidMin } = {}) {
  const r = rng(seed);
  const n = members.length;
  const avgGear = members.reduce((s, m) => s + gearPoints(m.equipped), 0) / Math.max(1, n);
  const lvl = Math.round((1 + avgGear * RULES.raidLvlPerGear) * 100) / 100;
  // Shorter test raids get a proportionally smaller boss so the pacing feels the same.
  const max = Math.round(RULES.raidHpPerMember * n * lvl * (minutes / 15));
  const R = {
    seed, r, t: 0, dur: minutes * 60, lvl, over: false, result: null,
    boss: { hp: max, max, phase: 1, next: null, feast: null },
    members: members.map((m) => {
      const g = withGear(m.stats, m.equipped);
      const maxHp = Math.round(80 + g.guard * 10);
      return { ...m, g, pos: m.pos || suggestedPosition(m.stats), hp: maxHp, max: maxHp, alive: true, dmg: 0, healed: 0, taken: 0,
        cdUntil: 0, moveUntil: 0, stunUntil: 0, shieldUntil: 0, swing: 0, combo: 0, lastTap: -9, botNext: 0 };
    }),
    trivia: null, triviaRuns: 0, paralysed: false, log: [], events: [],
  };
  scheduleAttack(R);
  return R;
}
const ATTACKS = {
  swipe: { label: "Swipe", what: "one person, usually the front", e: "🫳" },
  stomp: { label: "Stomp", what: "front and middle", e: "🦶" },
  scream: { label: "Scream", what: "everyone", e: "📢" },
  feast: { label: "Feast", what: "hit it hard or it heals", e: "🍗" },
};
function scheduleAttack(R) {
  const B = R.boss;
  const every = RULES.raidAtkEvery * (B.phase === 1 ? 1 : B.phase === 2 ? 0.85 : 0.65);
  const pool = B.phase === 1 ? ["swipe", "swipe", "swipe", "stomp", "scream"]
    : B.phase === 2 ? ["swipe", "swipe", "stomp", "stomp", "scream", "feast"]
    : ["swipe", "stomp", "scream", "scream", "feast"];
  const brains = Math.max(0, ...R.members.filter((m) => m.alive).map((m) => m.g.brains));
  B.next = { type: pick(R.r, pool), at: R.t + every, warnAt: R.t + every - RULES.raidTelegraph - brains * 0.08 };
}
const alive = (R) => R.members.filter((m) => m.alive);
const canAct = (R, m) => m.alive && R.t >= m.moveUntil && R.t >= m.stunUntil && !R.over;
// `you: true` marks the person playing on this screen, so the log reads "You raise" not "You raises".
const nm = (m) => (m.you ? "You" : m.name);
const vb = (m, them, you) => (m.you ? you : them);
const say = (R, text, kind = "") => { R.log.unshift({ t: R.t, text, kind }); R.log.length = Math.min(R.log.length, 30); R.events.push({ text, kind }); };

function raidTap(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m)) return null;
  m.combo = R.t - m.lastTap <= (RULES.comboWindowMs + m.g.speed * 12) / 1000 ? Math.min(RULES.comboMax, m.combo + 1) : 0;
  m.lastTap = R.t;
  const crit = R.r() < m.g.luck * 0.02;
  let dmg = (2 + m.g.power * 0.4) * posOf(m.pos).mult * (1 + m.combo / (RULES.comboMax * 2)) * (crit ? 2.5 : 1);
  if (m.swing > 0) { dmg *= 3; m.swing--; }
  R.boss.hp = Math.max(0, R.boss.hp - dmg);
  m.dmg += dmg;
  if (R.boss.feast) R.boss.feast.dealt += dmg;
  if (R.boss.hp <= 0) endRaid(R, "won");
  return { dmg, crit };
}
const abilityCd = (m) => ({ front: 25, mid: 20, back: 18 }[m.pos]) * (1 - m.g.speed * 0.03);
function raidAbility(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m) || R.t < m.cdUntil) return false;
  if (m.pos === "front") {
    for (const f of alive(R).filter((x) => x.pos === "front")) f.shieldUntil = R.t + 8;
    say(R, `${nm(m)} ${vb(m, "raises", "raise")} a shield wall`, "good");
  } else if (m.pos === "mid") {
    m.swing = 8;
    say(R, `${nm(m)} ${vb(m, "winds", "wind")} up a big swing`, "good");
  } else {
    const hurt = alive(R).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (!hurt) return false;
    const heal = Math.min(hurt.max - hurt.hp, Math.round(hurt.max * 0.35));
    hurt.hp += heal; m.healed += heal;
    say(R, `${nm(m)} ${vb(m, "patches", "patch")} up ${hurt === m ? vb(m, "themself", "yourself") : nm(hurt).replace(/^You$/, "you")} (+${heal})`, "good");
  }
  m.cdUntil = R.t + abilityCd(m);
  return true;
}
function raidMove(R, id, pos) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !m.alive || m.pos === pos || R.over) return false;
  m.pos = pos; m.moveUntil = R.t + Math.max(1.5, 4 - m.g.speed * 0.2); m.swing = 0;
  say(R, `${nm(m)} ${vb(m, "moves", "move")} to the ${posOf(pos).label.toLowerCase()}`);
  return true;
}

function hit(R, m, base) {
  if (!m.alive) return 0;
  let d = base * R.lvl ** 0.6 * (1 - Math.min(0.6, m.g.guard * 0.025));
  if (R.t < m.shieldUntil) d *= 0.4;
  d = Math.round(d);
  m.hp -= d; m.taken += d;
  if (m.hp <= 0) {
    m.hp = 0; m.alive = false; m.swing = 0;
    say(R, `${nm(m)} ${vb(m, "is", "are")} down`, "bad");
    if (!R.trivia) startTrivia(R);
  }
  return d;
}
function bossAttack(R) {
  const B = R.boss, type = B.next.type, up = alive(R);
  const mult = B.phase === 1 ? 1 : B.phase === 2 ? 1.25 : 1.5;
  if (type === "swipe" && up.length) {
    const weights = up.map((m) => posOf(m.pos).aggro * (m.pos === "front" && R.t < m.shieldUntil ? 1.3 : 1));
    let x = R.r() * weights.reduce((s, w) => s + w, 0), target = up[0];
    for (let i = 0; i < up.length; i++) { x -= weights[i]; if (x <= 0) { target = up[i]; break; } }
    const d = hit(R, target, RULES.raidBossDmg * mult);
    say(R, `Swipe hits ${target.you ? "you" : target.name} for ${d}`, "bad");
  } else if (type === "stomp") {
    let rows = up.filter((m) => m.pos !== "back");
    if (!rows.length) rows = up; // nobody in front: the stomp reaches the back
    rows.forEach((m) => hit(R, m, RULES.raidBossDmg * 0.6 * mult));
    say(R, `Stomp hits ${rows.length} of you`, "bad");
  } else if (type === "scream") {
    up.forEach((m) => hit(R, m, RULES.raidBossDmg * 0.45 * mult));
    say(R, "Scream hits everyone", "bad");
  } else if (type === "feast") {
    // The target scales with who's standing, so a small squad isn't punished for being small.
    const need = Math.round(up.length * 170 * R.lvl);
    B.feast = { until: R.t + 6, need, dealt: 0 };
    say(R, `It's feasting. Deal ${need.toLocaleString("en-GB")} damage in 6s or it heals`, "warn");
  }
}

function startTrivia(R) {
  R.triviaRuns++;
  R.trivia = { qs: triviaSet(R.seed + R.triviaRuns * 7919), i: 0, until: R.t + RULES.triviaSeconds, answers: [{}, {}, {}], right: 0, wrong: 0, botPlan: {} };
  planBotAnswers(R);
  say(R, "Someone's down. Answer 3 questions or the whole squad is paralysed", "warn");
}
function planBotAnswers(R) {
  const T = R.trivia, Q = T.qs[T.i];
  T.botPlan = {};
  for (const m of R.members.filter((x) => x.bot)) {
    const right = R.r() < 0.45 + m.g.brains * 0.04;
    const wrongs = Q.options.map((_, i) => i).filter((i) => i !== Q.correct);
    T.botPlan[m.id] = { at: R.t + 3 + R.r() * 14, choice: right ? Q.correct : pick(R.r, wrongs) };
  }
}
function raidAnswer(R, id, choice) {
  const T = R.trivia;
  if (!T || T.answers[T.i][id] !== undefined) return false;
  T.answers[T.i][id] = choice;
  if (Object.keys(T.answers[T.i]).length >= R.members.length) resolveQuestion(R);
  return true;
}
// Brainy players see some wrong answers crossed out.
const hintsFor = (m) => Math.max(0, Math.min(2, Math.floor((m.g.brains - 4) / 3)));
function resolveQuestion(R) {
  const T = R.trivia, Q = T.qs[T.i], votes = Object.values(T.answers[T.i]);
  const right = votes.filter((v) => v === Q.correct).length;
  const ok = votes.length > 0 && right >= votes.length - right;
  ok ? T.right++ : T.wrong++;
  say(R, `Q${T.i + 1}: ${ok ? "right" : "wrong"} (${right}/${votes.length} picked “${Q.options[Q.correct]}”)`, ok ? "good" : "bad");
  T.i++;
  if (T.wrong >= RULES.triviaFailAt || T.i >= T.qs.length) {
    const failed = T.wrong >= RULES.triviaFailAt;
    if (failed) {
      R.paralysed = true;
      alive(R).forEach((m) => (m.stunUntil = R.t + RULES.paralysedStunSec));
      say(R, `Paralysed. Everyone's stunned ${RULES.paralysedStunSec}s and starts tomorrow ${RULES.paralysedSteps.toLocaleString("en-GB")} steps down`, "bad");
    } else {
      R.members.filter((m) => !m.alive).forEach((m) => { m.alive = true; m.hp = Math.round(m.max * 0.4); });
      say(R, "Trivia passed. The fallen are back up", "good");
    }
    R.trivia = null;
    if (!alive(R).length) endRaid(R, "wiped");
    else if (R.members.some((m) => !m.alive)) startTrivia(R); // someone fell during the questions
  } else {
    T.until = R.t + RULES.triviaSeconds;
    planBotAnswers(R);
  }
}

function botAct(R, m) {
  if (!canAct(R, m)) return;
  if (R.t >= m.botNext) {
    // Bots tap at 3–5 taps a second, about what a person keeps up.
    const rate = 3 + (m.g.speed / 10) * 2 * (0.6 + 0.4 * R.r());
    raidTap(R, m.id);
    m.botNext = R.t + 1 / rate;
  }
  if (R.t >= m.cdUntil && R.r() < 0.02) {
    if (m.pos === "back" ? alive(R).some((x) => x.hp / x.max < 0.6) : m.pos === "front" ? R.boss.next && R.t >= R.boss.next.warnAt : true) raidAbility(R, m.id);
  }
}

function raidStep(R, dt) {
  if (R.over) return;
  dt = Math.min(dt, 0.25);
  R.t += dt;
  const B = R.boss;
  const phase = B.hp / B.max > 0.6 ? 1 : B.hp / B.max > 0.3 ? 2 : 3;
  if (phase !== B.phase) { B.phase = phase; say(R, phase === 2 ? "Phase 2: it hits harder and faster" : "Phase 3: it's enraged", "warn"); }
  if (B.feast && R.t >= B.feast.until) {
    if (B.feast.dealt < B.feast.need) { const heal = Math.round(B.max * 0.03); B.hp = Math.min(B.max, B.hp + heal); say(R, `It ate well. Healed ${heal.toLocaleString("en-GB")}`, "bad"); }
    else say(R, "Feast interrupted", "good");
    B.feast = null;
  }
  if (B.next && R.t >= B.next.at) { bossAttack(R); scheduleAttack(R); }
  for (const m of R.members) if (m.bot) botAct(R, m);
  const T = R.trivia;
  if (T) {
    for (const [id, plan] of Object.entries(T.botPlan)) if (R.t >= plan.at) { raidAnswer(R, id, plan.choice); delete T.botPlan[id]; if (R.trivia !== T) break; }
    if (R.trivia === T && R.t >= T.until) resolveQuestion(R);
  }
  if (!R.over && R.t >= R.dur) endRaid(R, "timeout");
}

function endRaid(R, how) {
  if (R.over) return;
  R.over = true;
  const n = R.members.length;
  const frac = 1 - R.boss.hp / R.boss.max;
  const pool = how === "won" ? RULES.raidRewardPerMember * n * R.lvl
    : how === "timeout" ? RULES.raidRewardPerMember * n * R.lvl * frac * 0.5 : 0;
  // Half shared equally, half by what you did (damage, healing and hits taken for the team).
  const work = (m) => m.dmg + m.healed * 20 + m.taken * 10;
  const totalWork = R.members.reduce((s, m) => s + work(m), 0) || 1;
  R.result = {
    how, frac, pool: Math.round(pool), lvl: R.lvl, paralysed: R.paralysed,
    shares: R.members.map((m) => ({ id: m.id, name: m.name, dmg: Math.round(m.dmg), healed: m.healed, taken: m.taken,
      reward: Math.round(pool * (0.5 / n + 0.5 * work(m) / totalWork)) })),
  };
  say(R, how === "won" ? "Boss down!" : how === "timeout" ? "Time's up" : "Squad wiped", how === "won" ? "good" : "bad");
}

root.Game = {
  DEFAULT_RULES, get RULES() { return RULES; }, setRules,
  hash, rng, effortsFromSteps, money, scrollBudget, overBudget, taxRate,
  STATS, STAT_TOTAL, stats, POSITIONS, posOf, suggestedPosition,
  GEAR, SLOTS, gearById, withGear, gearPoints,
  taxmanSetup, taxmanStart, taxmanTap, taxmanResult,
  triviaSet, FACTS,
  ATTACKS, raidCreate, raidTap, raidAbility, raidMove, raidAnswer, raidStep, abilityCd, hintsFor,
};
})(typeof window !== "undefined" ? window : globalThis);
