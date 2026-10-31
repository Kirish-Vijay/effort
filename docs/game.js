// Effort game rules: the step currency, walker stats and classes, gear and perks, player levels,
// the evening Taxman, the Sunday raid and its trivia. Pure logic with no DOM, so the lab, the app and
// the server can all run the same numbers. Needs items.js and prompts.js loaded first.
(function (root) {
"use strict";

// Every number worth tuning lives here. The lab's Knobs panel edits a copy of this.
const DEFAULT_RULES = {
  stepsPerEffort: 100,      // 100 steps = 1 Effort
  effortsPerEndeavour: 100, // 100 Efforts = 1 Endeavour
  dailyEffortCap: 300,      // 30k steps a day, max
  scrollFreeMin: 30,        // app time everyone gets before it counts (it's time in the apps, not just scrolling)
  scrollMinPer1kSteps: 8,   // plus this much more per 1,000 steps
  scrollBudgetMax: 150,
  unlinkedOverMin: 20,      // apps not linked: counts as this far over your budget, so not tracking never pays
  baseTax: 0.20,            // the Taxman takes 20% of today's Efforts if you don't fight
  taxPerOverMin: 0.005,     // +0.5% tax per minute scrolled over budget
  taxMaxExtra: 0.20,
  stealCap: 0.15,           // beat the Taxman, keep tapping: steal up to +15% (gear, levels and the Vault add a little)
  stealMax: 0.30,           // never more than this, whatever you wear
  paceTax: 0.05,            // beat the squad's average steps today: 5 points less tax; fall 10% short: 5 more
  // Walking is the point. In the Sunday raid your steps this week, against the squad's average, decide how hard you hit.
  strideMin: 0.5,           // half the squad average or less: half damage
  strideMax: 1.6,           // the hardest walker hits up to 60% harder
  stepsShare: 0.5,          // half of the raid's reward is split by steps walked, half by what you did in the fight
  topLoot: 0.25,            // the week's top walker gets +25% on their share...
  lastLoot: -0.25,          // ...the week's lowest walker gets 25% less...
  slackerTax: 0.1,          // ...and pays 10% of their week's Efforts to the top walker
  slackerAggro: 2.5,        // the boss goes for the lowest walker this many times as often
  windowHour: 18,           // the Taxman's in from 6pm...
  windowCloseHour: 21,      // ...till 9pm: start your fight any time in between
  dailyWindowMin: 5,        // a Taxman fight lasts this long
  raidMin: 15,
  taxmanBaseHp: 35000,
  taxmanHpPerEffort: 100,
  taxmanHpPerOverMin: 80,
  taxmanRegen: 0.025,       // share of his health he wins back per second when you stop tapping
  taxmanStepBoost: 300,     // steps power you up: tap damage ×(1 + Efforts today / this)
  taxmanPerLevel: 0.08,     // the Taxman gets 8% tougher for every player level
  stealPerLevel: 0.005,     // ...and you can steal 0.5% more per level (up to +5%)
  auditEvery: 22,           // seconds between Audit shields
  auditFor: 6,
  auditBlock: 0.15,         // damage that gets through the Audit shield (weak spot hits ×2.5)
  stealDmgPerPct: 0.1,      // extra damage (as a share of his health) for each 1% stolen
  comboWindowMs: 400,       // a combo survives a gap this long (plus a little per point of speed), so a steady 3 taps a second holds one
  comboMax: 50,
  // Stat edges: each stat's share of your total stats (a fifth is a fair share) times these (see edges()).
  edgePower: 1.2,           // Power: taps hit harder
  edgeCrit: 0.8,            // Luck: crit chance
  edgeCombo: 1.0,           // Speed: extra damage at a full combo
  edgeCd: 1.0,              // Speed: shorter cooldowns
  edgeCharge: 2.5,          // Brains: special charges faster
  edgeHeal: 1.0,            // Brains: Second Wind heals more
  edgeCounter: 6,           // Guard: Counter hits harder
  edgeAudit: 6,             // Brains: damage through the Taxman's Audit
  edgeBarge: 2.2,           // Guard: the Taxman Barge
  edgeHp: 1.5,              // Guard: health
  edgeArmour: 1.0,          // Guard: damage shrugged off
  raidHpBase: 2560000,       // Brett's health; every boss has its own multiple. Fixed: how many turn up doesn't change it (tuned for four)
  raidSquadSize: 4,         // the fewest who can start a raid, and the squad size the boss is tuned for
  noFrontDmg: 1.3,          // with nobody at the front, every hit lands this much harder
  lapHp: 2,                 // after the last boss the ladder loops: each lap has this much more health…
  lapDmg: 1.4142,           // …hits this much harder…
  lapReward: 5.5,           // …and pays this much more
  endless: 2,               // past the last boss the ladder keeps going; 2: each step adds a fixed share of the last boss
  stepHp: 1.05, stepDmg: 1.02, stepReward: 1.015, // (1: compounds instead; 0: the old ×2 laps)
  raidAtkEvery: 6,          // seconds between boss attacks (phase 1)
  raidTelegraph: 2,
  raidBossDmg: 22,          // a swipe at level 1
  raidRewardPerMember: 70,  // Efforts per squad member for beating Brett (other bosses pay their reward multiple)
  raidRewardCurve: 1.25,    // rewards grow faster than difficulty: pool × level^1.25
  raidGoalPerDay: 5000,     // the squad's weekly goal before Sunday: this many steps a day for each player…
  raidGoalStep: 500,        // …plus this much more for each boss up the ladder (back to the start every lap)
  raidGoalDays: 6,          // Monday to Saturday (Sunday's steps before the raid count too)
  enragedHp: 1.8,           // miss the goal and the boss has this much more health…
  enragedDmg: 1.35,         // …and hits this much harder (beatable only with gear well past what it asks for)
  spMax: 100,               // a class special is ready at this much charge…
  spPerTap: 0.25,           // …which builds a little with every tap…
  spPerAbility: 8,          // …more with every row ability…
  spPerHit: 3,              // …and with every hit taken (half as much again at the front). Brains charges it faster
  openingBonus: 0.4,        // hit harder while the boss winds up on someone else (it's looking the other way)
  formationBonus: 0.1,
  homeBonus: 1.12,          // your class's home row: hit this much harder there, and take this much less      // every row filled: the whole squad hits this much harder
  tapHeal: 0.0012,          // Second Wind: every tap heals you this share of your health (Brains makes it more)
  counterTaps: 1.2,         // Front, Counter: every hit you take, you hit back this many taps' worth (Guard adds more)
  backCrit: 0.12,           // Back, Sharpshooter: extra crit chance
  interruptShare: 0.002,    // Middle, Interrupt: deal this share of the boss's health during a wind-up to stagger it…
  staggerMult: 0.5,         // …so it lands this hard (a Ground Slam is stopped outright)
  feebleMult: 0.35,         // SHHH: the next two attacks land this hard
  brewVuln: 0.2,            // Volatile Brew: the boss takes this much more for 10s
  prophecyCrit: 0.2,        // Pound-Shop Prophecy: extra crit chance for the squad
  grabShare: 0.012,         // The Kraken's Grab: damage that frees someone, as a share of its health
  stepsPerMile: 600,        // the journey map: the squad moves a mile for every 600 steps its average walker takes
  trackSteps: 30000,        // the season track: a tier for every 30,000 of your own steps…
  trackTiers: 20,           // …up to 20
  chapterReward: 30,        // Efforts for reading each story chapter
  bountyReward: 25,         // Efforts each for every weekly squad bounty
  triviaSeconds: 25,
  triviaFailShare: 2 / 3,   // when someone dies everyone gets one question; 2/3 of the squad wrong = paralysed
  rarityBossDmg: 0.001,     // each rarity point in trivia knocks this share off the boss
  paralysedSteps: 2500,     // step deficit the next day
  paralysedStunSec: 12,
  xpPerLevel: 40,           // level n needs xpPerLevel × (n−1)² lifetime XP
  upgradeMax: 10,
  upgradeStep: 0.1,         // each upgrade adds 10% of an item's base stats
  upgradeCostShare: 0.1,    // upgrade n costs this share of the item's price × n
  dealDiscount: 0.3,
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
function money(efforts, short) {
  const e = Math.round(Number(efforts) || 0), sign = e < 0 ? "−" : "";
  const a = Math.abs(e), en = Math.floor(a / RULES.effortsPerEndeavour), ef = a % RULES.effortsPerEndeavour;
  if (short) return `${sign}${en ? `${en}.${String(ef).padStart(2, "0")}` : `0.${String(ef).padStart(2, "0")}`}`;
  if (!en) return `${sign}${ef} Effort${ef === 1 ? "" : "s"}`;
  return `${sign}${en} Endeavour${en === 1 ? "" : "s"}${ef ? ` ${ef} Effort${ef === 1 ? "" : "s"}` : ""}`;
}
const scrollBudget = (steps) => Math.min(RULES.scrollBudgetMax, RULES.scrollFreeMin + Math.floor((steps || 0) / 1000) * RULES.scrollMinPer1kSteps);
// The minutes that count against you. linked: their apps report automatically (the Effort app on Android, the
// open/close automation on iPhone); a linked day with nothing reported is zero. Not linked: always over budget.
const scrollCounted = (steps, minutes, linked) => (linked ? Math.max(0, Number(minutes) || 0) : scrollBudget(steps) + RULES.unlinkedOverMin);
const overBudget = (steps, scrollMin) => Math.max(0, (scrollMin || 0) - scrollBudget(steps));
// Your cut depends on scrolling, and on how you walked against the squad today (if we know their average).
function pace(steps, squadAvg) {
  if (!squadAvg) return 0;
  if (steps >= squadAvg * 1.1) return 1;
  if (steps < squadAvg * 0.9) return -1;
  return 0;
}
const taxRate = (steps, scrollMin, squadAvg) =>
  Math.round(Math.max(0, RULES.baseTax + Math.min(RULES.taxMaxExtra, overBudget(steps, scrollMin) * RULES.taxPerOverMin) - pace(steps, squadAvg) * RULES.paceTax) * 1000) / 1000;

// ---------- levels ----------
const xpFor = (level) => RULES.xpPerLevel * (level - 1) ** 2;
const levelOf = (xp) => Math.max(1, Math.floor(1 + Math.sqrt(Math.max(0, xp) / Math.max(1, RULES.xpPerLevel))));
function levelProgress(xp) {
  const lvl = levelOf(xp), lo = xpFor(lvl), hi = xpFor(lvl + 1);
  return { lvl, into: xp - lo, need: hi - lo, pct: (xp - lo) / (hi - lo) };
}

// ---------- stats and classes from quiz answers ----------
const STATS = [
  { id: "power", label: "Power", e: "💪", what: "Every tap hits harder" },
  { id: "guard", label: "Guard", e: "🛡️", what: "More health, less damage taken, harder Counters at the front" },
  { id: "speed", label: "Speed", e: "🏃", what: "Bigger combos, faster cooldowns" },
  { id: "brains", label: "Brains", e: "🧠", what: "Your special charges faster, Second Wind heals more, more trivia time" },
  { id: "luck", label: "Luck", e: "🍀", what: "More critical hits" },
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
// Five stats, always 30 points between them (2 to 10 each). Answers lean them one way or another.
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
const CAT = () => root.EffortItems || { CLASSES: [], TIERS: [], ITEMS: [] };
// Your class is your top two stats.
function classOf(st) {
  const top = STATS.map((s) => s.id).sort((a, b) => st[b] - st[a] || STATS.findIndex((s) => s.id === a) - STATS.findIndex((s) => s.id === b)).slice(0, 2);
  return CAT().CLASSES.find((c) => c.stats.includes(top[0]) && c.stats.includes(top[1])) || CAT().CLASSES[0];
}
// Every row deals damage, in its own way. Where you stand is the strategy: the front hits hardest and gets hit most
// (and hits back), the middle staggers wind-ups, the back is safe and crits. Fill all three for the Formation bonus.
const POSITIONS = [
  { id: "front", label: "Front", e: "🛡️", ability: "Shield Bash", abilityWhat: "A huge bash (ten taps' worth), and the front row takes half damage for 6s", mult: 1.4, aggro: 70,
    passive: "Counter", passiveWhat: "Every hit you take, you hit straight back. More Guard, bigger Counters" },
  { id: "mid", label: "Middle", e: "⚔️", ability: "Big Swing", abilityWhat: "Your next 8 taps hit 3× as hard", mult: 1.1, aggro: 25,
    passive: "Interrupt", passiveWhat: "Hit hard during a wind-up to stagger it to half damage (and stop a Ground Slam)" },
  { id: "back", label: "Back", e: "🎯", ability: "Volley", abilityWhat: "Five quick shots at double damage", mult: 1.0, aggro: 5,
    passive: "Sharpshooter", passiveWhat: `${Math.round(DEFAULT_RULES.backCrit * 100)}% more crits, and the boss rarely looks your way` },
];
const posOf = (id) => POSITIONS.find((p) => p.id === id) || POSITIONS[1];
const posScores = (st) => ({ front: st.guard * 2 + st.power * 0.5, mid: st.power + st.speed, back: st.brains + st.luck * 0.8 + st.speed * 0.3 });
// Every class has a home row, so everyone in a class gets the same advice. Pass base stats (not ones with
// gear on): gear can shift your top two stats, but it never changes your class.
const HOME_ROW = { bouncer: "front", lollipop: "front", pigeon: "front", menace: "mid", mad: "mid", gremlin: "mid", pickpocket: "mid", librarian: "front", courier: "back", hedge: "back" };
const homeRow = (cls) => HOME_ROW[cls] || "mid";
// What your stats do. Every point counts: your total (30 from the quiz, plus gear) sets how hard you hit and how
// much you can take, so nobody's points are wasted. On top of that, each stat's share of your total is its edge,
// so whatever your answers made you best at stays your strength at any gear level. g: stats with gear on.
const statTotal = (g) => STATS.reduce((s, { id }) => s + (g[id] || 0), 0) || 1;
function edges(g) {
  const T = statTotal(g), s = (k) => (g[k] || 0) / T, E = RULES;
  return {
    total: T,
    attack: T / 3,
    power: 1 + E.edgePower * s("power"),                      // tap damage ×
    crit: Math.min(0.6, E.edgeCrit * s("luck")),               // crit chance
    combo: 0.2 + E.edgeCombo * s("speed"),                     // extra damage at a full combo
    comboMs: RULES.comboWindowMs + 1000 * s("speed"),          // how long a combo survives a gap
    cd: 1 - Math.min(0.5, E.edgeCd * s("speed")),              // ability cooldowns ×
    move: 1 - Math.min(0.6, 1.5 * s("speed")),                 // time to change rows ×
    charge: 1 + E.edgeCharge * s("brains"),                    // special charge ×
    heal: 1 + E.edgeHeal * s("brains"),                        // Second Wind ×
    counter: E.edgeCounter * s("guard"),                       // extra Counter, in taps' worth
    warn: 3 * s("brains"),                                     // seconds of extra warning before attacks
    trivia: Math.round(12 * s("brains")),                      // seconds of extra trivia time
    audit: E.edgeAudit * s("brains"),                          // Taxman: extra damage through an Audit
    barge: E.edgeBarge * s("guard"),                           // Taxman: every 10th tap is a Barge for this much extra ×10
    hp: Math.round((70 + 1.8 * T) * (1 + E.edgeHp * s("guard"))),
    armour: Math.min(0.6, 0.15 + E.edgeArmour * s("guard")),    // share of every hit you shrug off
    shares: Object.fromEntries(STATS.map(({ id }) => [id, s(id)])),
  };
}
// A rough number for how hard someone hits (a full-combo tap, crits averaged in), to compare gear by.
function hitIndex(g) {
  const e = edges(g);
  return (20 + e.attack * 4) * e.power * (1 + e.combo) * (1 + e.crit * 1.5);
}
// The one-line effect of each stat for someone, for the stats panel.
function statEffects(g) {
  const e = edges(g), pct = (x) => Math.round(x * 100);
  return {
    power: `Taps +${pct(e.power - 1)}%`,
    guard: `${e.hp} health, blocks ${pct(e.armour)}%, Counter ×${(RULES.counterTaps + e.counter).toFixed(1)}`,
    speed: `Full combo +${pct(e.combo)}%, cooldowns −${pct(1 - e.cd)}%`,
    brains: `Special ${pct(e.charge - 1)}% faster, Second Wind +${pct(e.heal - 1)}%`,
    luck: `${pct(e.crit)}% crits`,
  };
}
function suggestedPosition(st) {
  return homeRow(classOf(st).id);
}
// Your class's home row suits you: you hit a bit harder and take a bit less there. Anywhere else is fine too.
function posFit(st, pos, home) {
  home = home || suggestedPosition(st);
  return pos === home ? RULES.homeBonus : 1;
}

// ---------- gear ----------
// inv: { itemId: upgradeLevel }   equipped: { weapon: id, armour: id, trinket: id }
const SLOTS = ["weapon", "armour", "trinket"];
const itemById = (id) => CAT().ITEMS.find((i) => i.id === id);
const tierOf = (id) => CAT().TIERS.find((t) => t.id === id) || CAT().TIERS[0];
// Each upgrade adds 10% of the item's base stats (kept to one decimal, so small items still grow every level).
// Class gear follows its wearer: pass their quiz stats (st) and its biggest numbers go into whichever of the
// class's two stats is their best (item.flip names the pair it swaps).
function itemStats(item, up, st) {
  const out = {}, f = item.flip, swap = f && st && (st[f[1]] || 0) > (st[f[0]] || 0);
  for (const [k0, v] of Object.entries(item.stats || {})) {
    const k = swap && k0 === f[0] ? f[1] : swap && k0 === f[1] ? f[0] : k0;
    out[k] = Math.round(v * (1 + (up || 0) * RULES.upgradeStep) * 10) / 10;
  }
  return out;
}
// Prices are always whole Endeavours (multiples of 100 Efforts) so the shop never shows fractions.
const wholeE = (efforts) => Math.max(RULES.effortsPerEndeavour, Math.round(efforts / RULES.effortsPerEndeavour) * RULES.effortsPerEndeavour);
// den: the squad's Den levels (the Workshop makes upgrades cheaper).
const upgradeCost = (item, up, den) => wholeE(tierOf(item.tier).price * RULES.upgradeCostShare * (up + 1) * (1 - Math.min(0.2, denMods(den).upgrade || 0)));
// The sets someone has every piece of on.
function setsWorn(equipped) {
  const ids = Object.values(equipped || {}), sets = CAT().SETS || {};
  return Object.entries(sets).filter(([id]) => CAT().ITEMS.filter((i) => i.set === id).every((i) => ids.includes(i.id))).map(([id, v]) => ({ id, ...v }));
}
function loadout(st, equipped, inv) {
  const g = { ...st }, perks = {};
  let points = 0;
  for (const id of Object.values(equipped || {})) {
    const item = itemById(id);
    if (!item) continue;
    const up = (inv && inv[id]) || 0;
    for (const [k, v] of Object.entries(itemStats(item, up, st))) { g[k] = (g[k] || 0) + v; points += v; }
    if (item.perk) {
      const [type, val] = item.perk;
      perks[type] = type === "secondWind" ? 1 : (perks[type] || 0) + val;
    }
  }
  for (const set of setsWorn(equipped)) { const [type, val] = set.bonus; perks[type] = (perks[type] || 0) + val; }
  return { g, perks, points };
}
// Today's three deals: picked by date, leaning towards your class, at a discount.
function dealsFor(day, cls, level) {
  const r = rng(hash("deals:" + day + ":" + cls));
  const pool = CAT().ITEMS.filter((i) => (i.cls === cls || !i.cls) && !i.season && tierOf(i.tier).lvl <= level);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  return out;
}
const priceOf = (item, deal) => wholeE(tierOf(item.tier).price * (deal ? 1 - RULES.dealDiscount : 1));

// ---------- 6pm to 9pm: the Taxman ----------
// Can't die. He wins back health whenever you stop tapping, raises an Audit shield every ~22s
// (only the moving weak spot takes proper damage), and golden receipts fly past for bonus loot.
function taxmanSetup({ steps = 0, scrollMin = 0, stats: st = {}, equipped = {}, inv = {}, level = 1, squadAvg = 0, den = null }) {
  const efforts = effortsFromSteps(steps), over = overBudget(steps, scrollMin);
  const { g, perks } = loadout(st, equipped, inv), e = edges(g);
  return {
    efforts, over, taxRate: taxRate(steps, scrollMin, squadAvg), pace: pace(steps, squadAvg), squadAvg, perks,
    level,
    // He keeps pace with you: every level you gain, he gets tougher (and you can steal a bit more).
    hp: Math.round((RULES.taxmanBaseHp + efforts * RULES.taxmanHpPerEffort + over * RULES.taxmanHpPerOverMin) * (1 + RULES.taxmanPerLevel * (level - 1))),
    // Every stat helps: Power hits, Luck crits, Speed combos, Brains cracks Audits, Guard Barges.
    tapDmg: (10 + e.attack * 0.8) * e.power * (1 + efforts / Math.max(1, RULES.taxmanStepBoost)),
    stepBoost: 1 + efforts / Math.max(1, RULES.taxmanStepBoost),
    critChance: e.crit + (perks.critChance || 0),
    critMult: 2.5 + (perks.critDmg || 0),
    comboWindow: e.comboMs,
    comboBonus: e.combo * 2,
    comboGain: 1 + (perks.combo || 0),
    audit: e.audit, barge: e.barge, regen: 1 - e.armour / 2,
    stealCap: Math.min(RULES.stealMax, RULES.stealCap + (perks.steal || 0) + Math.min(0.05, RULES.stealPerLevel * (level - 1)) + (denMods(den).steal || 0)),
    seconds: RULES.dailyWindowMin * 60,
  };
}
function taxmanStart(setup, seed = Date.now()) {
  return {
    setup, r: rng(seed), t: 0, dmg: 0, taps: 0, combo: setup.perks.taxStart || 0, lastTap: 0, tapped: false, crits: 0, weak: 0, receipts: 0,
    bonusSteal: 0, audit: null, nextAudit: 15, receipt: null, nextReceipt: 8, ko: false, fx: [],
  };
}
function taxmanStep(B, dt) {
  const S = B.setup;
  B.t += dt;
  // Stop tapping and he starts recounting his money.
  if (!B.ko && B.t - B.lastTap > 0.8 && B.dmg > 0) B.dmg = Math.max(0, B.dmg - S.hp * RULES.taxmanRegen * (S.regen ?? 1) * dt);
  if (B.tapped && B.combo && B.t - B.lastTap > S.comboWindow / 1000 * 2.5) B.combo = 0;
  if (!B.audit && B.t >= B.nextAudit) {
    B.audit = { until: B.t + RULES.auditFor, x: 0.3 + B.r() * 0.4, y: 0.35 + B.r() * 0.3, vx: (B.r() < 0.5 ? -1 : 1) * (0.25 + B.r() * 0.2), vy: (B.r() < 0.5 ? -1 : 1) * (0.2 + B.r() * 0.2) };
    B.fx.push({ type: "audit" });
  }
  if (B.audit) {
    const a = B.audit;
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.x < 0.18 || a.x > 0.82) a.vx *= -1;
    if (a.y < 0.25 || a.y > 0.75) a.vy *= -1;
    if (B.t >= a.until) { B.audit = null; B.nextAudit = B.t + RULES.auditEvery; B.fx.push({ type: "auditEnd" }); }
  }
  if (!B.receipt && B.t >= B.nextReceipt) {
    const fromLeft = B.r() < 0.5;
    B.receipt = { x: fromLeft ? -0.05 : 1.05, y: 0.2 + B.r() * 0.5, vx: (fromLeft ? 1 : -1) * (0.22 + B.r() * 0.1), until: B.t + 5 };
    B.fx.push({ type: "receipt" });
  }
  if (B.receipt) {
    B.receipt.x += B.receipt.vx * dt;
    B.receipt.y += Math.sin(B.t * 4) * 0.002;
    if (B.t >= B.receipt.until) { B.receipt = null; B.nextReceipt = B.t + 15 + B.r() * 12; }
  }
}
// A tap at (x, y), both 0–1 across the arena. Returns what happened for the effects layer.
function taxmanTap(B, x = 0.5, y = 0.5) {
  const S = B.setup;
  if (B.receipt && Math.hypot(B.receipt.x - x, (B.receipt.y - y) * 1.6) < 0.11) {
    B.receipt = null; B.nextReceipt = B.t + 15 + B.r() * 12; B.receipts++; B.lastTap = B.t; B.tapped = true;
    const wasKo = B.ko;
    if (B.ko) B.bonusSteal += 0.01; else B.dmg += S.hp * 0.03;
    if (!B.ko && B.dmg >= S.hp) { B.ko = true; B.fx.push({ type: "ko" }); }
    return { kind: "receipt", dmg: 0, bonus: wasKo ? "+1% stolen" : "−3% health" };
  }
  // A starting combo (from gear) carries into the first tap however long you wait to start.
  const inTime = !B.tapped || B.t - B.lastTap <= S.comboWindow / 1000;
  B.combo = inTime ? Math.min(RULES.comboMax, B.combo + S.comboGain) : Math.max(0, Math.floor(B.combo / 2));
  B.lastTap = B.t; B.tapped = true;
  const crit = B.r() < S.critChance;
  let dmg = S.tapDmg * (1 + (B.combo / RULES.comboMax) * (S.comboBonus ?? 1)) * (crit ? S.critMult : 1);
  let kind = crit ? "crit" : "hit";
  // Guard: every 10th tap is a shoulder Barge.
  if ((B.taps + 1) % 10 === 0 && S.barge) { dmg *= 1 + 10 * S.barge; kind = crit ? "crit" : "barge"; }
  // Brains: you know where the weak spot will be, and more of every hit gets through.
  if (B.audit) {
    if (Math.hypot(B.audit.x - x, (B.audit.y - y) * 1.4) < 0.1 * (1 + (S.audit || 0) / 4)) { dmg *= 2.5 + (S.audit || 0); kind = "weak"; B.weak++; }
    else { dmg *= RULES.auditBlock * (1 + (S.audit || 0)); kind = "blocked"; }
  }
  B.dmg += dmg; B.taps++; if (crit) B.crits++;
  if (!B.ko && B.dmg >= S.hp) { B.ko = true; B.fx.push({ type: "ko" }); }
  return { kind, dmg, crit, combo: B.combo };
}
// The fight's over early once he's knocked out and you've taken all you can.
const taxmanDone = (B) => B.ko && taxmanResult(B).stealPct >= B.setup.stealCap - 1e-9;
function taxmanResult(B) {
  const S = B.setup;
  const knocked = Math.min(1, B.dmg / S.hp);
  const extra = Math.max(0, B.dmg - S.hp);
  const stealPct = Math.min(S.stealCap, Math.floor(extra / (S.hp * RULES.stealDmgPerPct)) / 100 + B.bonusSteal);
  const taxed = Math.round(S.efforts * S.taxRate * (1 - knocked));
  const stolen = Math.round(S.efforts * stealPct);
  return { earned: S.efforts, taxRate: S.taxRate, knocked, taxed, stealPct, stolen, net: S.efforts - taxed + stolen, beaten: knocked >= 1 };
}

// ---------- trivia: name one thing, rarer answers score more ----------
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
// Edit distance counting a swapped pair of letters as one typo ("jurrasic" → "jurassic").
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// Every answer to every prompt: a typo match must not turn a real, different word ("ytterbium") into a right answer.
let KNOWN = null;
const known = () => KNOWN || (KNOWN = new Set((root.EffortPrompts || []).flatMap((p) => p.a.flatMap(([ans, , ...al]) => [ans, ...al].map(norm)))));
function listPrompt(p) {
  const answers = p.a.map(([ans, rarity, ...aliases]) => ({ ans, rarity, keys: [ans, ...aliases].map(norm) }));
  return {
    id: p.id, q: p.q, kind: "science",
    check(text) {
      const t = norm(text);
      if (!t) return { valid: false };
      let hit = answers.find((x) => x.keys.includes(t));
      if (!hit && t.length >= 5 && !known().has(t)) hit = answers.find((x) => x.keys.some((k) => k.length >= 5 && lev(t, k, t.length >= 9 ? 2 : 1) <= (t.length >= 9 ? 2 : 1)));
      return hit ? { valid: true, rarity: hit.rarity, canon: hit.ans } : { valid: false };
    },
    sample(r, good) {
      const pool = answers.filter((x) => (good ? x.rarity <= 2 : x.rarity === 3));
      return pick(r, pool.length ? pool : answers).ans;
    },
    examples: [...answers.filter((x) => x.rarity === 3), ...answers.filter((x) => x.rarity === 2)].slice(0, 3).map((x) => x.ans),
  };
}
const isSquare = (n) => n >= 0 && Number.isSafeInteger(n) && Math.round(Math.sqrt(n)) ** 2 === n;
const isPrime = (n) => { if (n < 2 || n % 1) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
// Numeric prompts are generated, so any correct number counts. Obvious picks (the first ones
// people think of) score 1, the rest 2 or 3.
function mathPrompt(r) {
  const kinds = [
    () => { const lo = 100 + Math.floor(r() * 300), hi = lo + 40 + Math.floor(r() * 30); const ok = (n) => n > lo && n < hi && isPrime(n);
      const list = []; for (let n = lo + 1; n < hi; n++) if (ok(n)) list.push(n);
      return { q: `Name a prime number between ${lo} and ${hi}`, ok, rank: (n) => (n === list[0] || n === list[list.length - 1] ? 1 : list.indexOf(n) % 2 ? 3 : 2), list }; },
    () => { const lo = 200 + Math.floor(r() * 1500), hi = lo + 1200; const ok = (n) => n > lo && n < hi && Number.isInteger(Math.sqrt(n));
      const list = []; for (let k = Math.ceil(Math.sqrt(lo + 1)); k * k < hi; k++) list.push(k * k);
      return { q: `Name a square number between ${lo.toLocaleString("en-GB")} and ${hi.toLocaleString("en-GB")}`, ok, rank: (n) => (Math.sqrt(n) % 10 === 0 || n === list[0] ? 1 : Math.sqrt(n) % 5 === 0 ? 2 : 3), list }; },
    () => { const fib = [144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040];
      const big = []; for (let a = 832040, b = 1346269; b < 1e15; [a, b] = [b, a + b]) big.push(b);
      return { q: "Name a Fibonacci number bigger than 100", ok: (n) => n > 100 && (n < 1e7 ? isSquare(5 * n * n + 4) || isSquare(5 * n * n - 4) : big.includes(n)), rank: (n) => (n === 144 ? 1 : n < 1000 ? 2 : 3), list: fib }; },
    () => { const list = []; for (let p = 10; p <= 40; p++) list.push(2 ** p);
      return { q: "Name a power of 2 bigger than 1,000", ok: (n) => n > 1000 && Number.isSafeInteger(n) && Number.isInteger(Math.log2(n)), rank: (n) => (n === 1024 ? 1 : n <= 8192 ? 2 : 3), list }; },
    () => { const N = pick(r, [360, 720, 840, 1260, 2520]); const ok = (n) => n >= 10 && n <= 100 && N % n === 0;
      const list = []; for (let n = 10; n <= 100; n++) if (ok(n)) list.push(n);
      return { q: `Name a factor of ${N.toLocaleString("en-GB")} between 10 and 100`, ok, rank: (n) => (n % 10 === 0 ? 1 : n % 5 === 0 || n % 12 === 0 ? 2 : 3), list }; },
    () => { const list = []; for (let k = 5; k <= 60; k++) list.push(k ** 3);
      return { q: "Name a cube number bigger than 100", ok: (n) => n > 100 && Number.isSafeInteger(n) && Math.round(Math.cbrt(n)) ** 3 === n, rank: (n) => (n === 125 || n === 1000 ? 1 : n < 1000 ? 2 : 3), list }; },
    () => { const list = []; for (let k = 10; k <= 200; k++) { const t = (k * (k + 1)) / 2; if (t > 50) list.push(t); }
      return { q: "Name a triangular number bigger than 50", ok: (n) => n > 50 && isSquare(8 * n + 1), rank: (n) => (n === 55 ? 1 : n < 150 ? 2 : 3), list }; },
    () => { const s = 20 + Math.floor(r() * 5); const ok = (n) => n >= 100 && n <= 999 && String(n).split("").reduce((a, d) => a + Number(d), 0) === s;
      const list = []; for (let n = 100; n <= 999; n++) if (ok(n)) list.push(n);
      return { q: `Name a three-digit number whose digits add up to ${s}`, ok, rank: (n) => (String(n).includes("9") ? (n % 10 === 9 ? 1 : 2) : 3), list }; },
    () => { const k = pick(r, [13, 17, 19, 23]); const ok = (n) => n >= 100 && n <= 300 && n % k === 0;
      const list = []; for (let n = 100; n <= 300; n++) if (ok(n)) list.push(n);
      return { q: `Name a multiple of ${k} between 100 and 300`, ok, rank: (n) => (n === list[0] || n === k * 10 ? 1 : n === list[1] ? 2 : 3), list }; },
  ];
  const k = kinds[Math.floor(r() * kinds.length)]();
  return {
    id: "math-" + hash(k.q), q: k.q, kind: "maths",
    check(text) {
      const t = String(text ?? "").replace(/[,\s]/g, "");
      if (!/^\d+$/.test(t)) return { valid: false };
      const n = Number(t);
      return k.ok(n) ? { valid: true, rarity: k.rank(n), canon: n.toLocaleString("en-GB") } : { valid: false };
    },
    sample(r2, good) { const pool = k.list.filter((n) => (good ? k.rank(n) <= 2 : k.rank(n) === 3)); return String(pick(r2, pool.length ? pool : k.list)); },
    examples: k.list.filter((n) => k.rank(n) === 3).slice(0, 3).map(String),
  };
}
function triviaSet(seed, count = 3) {
  const r = rng(seed);
  const bank = root.EffortPrompts || [];
  const used = new Set(), out = [];
  const asked = new Set();
  for (let tries = 0; out.length < count && tries < 200; tries++) {
    let q;
    if (!bank.length || r() < 0.4) q = mathPrompt(r);
    else { let i; do { i = Math.floor(r() * bank.length); } while (used.has(i) && used.size < bank.length); used.add(i); q = listPrompt(bank[i]); }
    if (asked.has(q.q)) continue;
    asked.add(q.q); out.push(q);
  }
  return out;
}

// ---------- Sunday: the squad raid ----------
// members: [{ id, name, stats, equipped, inv, pos, bot, you }]. Time is in seconds; call raidStep with real elapsed time.
// Effects the UI should play are pushed to R.fx as { type, ... } and drained by the screen.
// The week's table: everyone ranked by steps, with the stride that sets their raid damage.
// Top and bottom only get titles when there's a real gap between them.
function weekTable(members) {
  const avg = members.reduce((s, m) => s + (m.weekSteps || 0), 0) / Math.max(1, members.length);
  const rows = members.map((m) => ({ id: m.id, name: m.name, you: !!m.you, fresh: !!m.fresh, weekSteps: m.weekSteps || 0,
    stride: avg > 0 ? Math.round(clamp((m.weekSteps || 0) / avg, RULES.strideMin, RULES.strideMax) * 100) / 100 : 1, title: null }));
  rows.sort((a, b) => b.weekSteps - a.weekSteps);
  // Someone who joined late in the week (fresh) can't be crowned or blamed for it.
  const ranked = rows.filter((r) => !r.fresh);
  if (ranked.length >= 2 && ranked[0].weekSteps > ranked[ranked.length - 1].weekSteps) { ranked[0].title = "top"; ranked[ranked.length - 1].title = "last"; }
  return { avg, rows };
}

// The ladder: beat a boss and next Sunday you face the next one. After the last, it loops with
// everything twice as tough (and twice as rich) each lap, so it never stops getting harder. hp/dmg/reward are multipliers; speed scales the gap between attacks.
// Each boss has its own signature move and its own rhythm: `pattern` is the pool it draws from in phases 1, 2 and 3.
const BOSSES = [
  { id: "notification", name: "Brett", title: "A big fat round slime monster. Defeat it.", hp: 1, dmg: 1, speed: 1, reward: 1,
    sig: "ooze", style: "Slow and heavy. Slimes a whole row at a time",
    pattern: [["swipe", "swipe", "stomp", "stomp", "ooze"], ["swipe", "stomp", "stomp", "ooze", "scream", "feast"], ["swipe", "stomp", "ooze", "scream", "feast"]],
    attacks: { swipe: "Slap", stomp: "Belly Flop", scream: "Screech", feast: "Gorge", ooze: "Ooze" } },
  { id: "autoplay", name: "Rory", title: "Orange creature that emerged from the swamp. Defeat it.", hp: 1.07, dmg: 1.0, speed: 0.97, reward: 1.4,
    sig: "spores", style: "Stampedes and clouds of spores that keep on hurting",
    pattern: [["swipe", "swipe", "stomp", "spores", "scream"], ["swipe", "stomp", "stomp", "spores", "spores", "feast"], ["stomp", "spores", "scream", "scream", "feast"]],
    attacks: { swipe: "Chomp", stomp: "Stampede", scream: "Bellow", feast: "Gorge", spores: "Spore Cloud" } },
  { id: "leftonread", name: "Wisp", title: "Cold, quiet, always behind you", hp: 1.01, dmg: 1.15, speed: 0.94, reward: 1.9,
    sig: "vanish", style: "Fades out where you can't hit it, then picks off the weakest",
    pattern: [["swipe", "swipe", "scream", "vanish"], ["swipe", "scream", "vanish", "vanish", "feast"], ["swipe", "scream", "scream", "vanish", "feast"]],
    attacks: { swipe: "Chill Touch", stomp: "Phase Slam", scream: "Wail", feast: "Drain", vanish: "Vanish" } },
  { id: "scroll", name: "Gale", title: "Never stops spinning", hp: 1.16, dmg: 1.3, speed: 0.91, reward: 2.5,
    sig: "gust", style: "Fast, and blows the front row out of position",
    pattern: [["swipe", "swipe", "gust", "stomp", "scream"], ["swipe", "gust", "stomp", "scream", "feast", "gust"], ["swipe", "gust", "scream", "scream", "feast"]],
    attacks: { swipe: "Slice", stomp: "Downdraft", scream: "Howl", feast: "Siphon", gust: "Gust" } },
  { id: "kraken", name: "The Kraken", title: "Came up from somewhere deep", hp: 1.19, dmg: 1.45, speed: 0.88, reward: 3.2,
    sig: "grab", style: "Two tentacles hit at once, and it grabs people",
    swipeHits: 2, swipeMult: 0.65,
    pattern: [["swipe", "swipe", "grab", "stomp", "scream"], ["swipe", "swipe", "grab", "stomp", "feast"], ["swipe", "grab", "scream", "stomp", "feast", "grab"]],
    attacks: { swipe: "Tentacle Lash", stomp: "Ink Slam", scream: "Deep Roar", feast: "Devour", grab: "Grab" } },
  { id: "algorithm", name: "Grimm", title: "Big, blue, and carrying a club", hp: 1.66, dmg: 1.6, speed: 0.85, reward: 4,
    sig: "slam", style: "Slow, crushing club swings. Stop the Ground Slam or it flattens you",
    swipeMult: 1.3,
    pattern: [["swipe", "swipe", "stomp", "slam"], ["swipe", "stomp", "slam", "scream", "feast"], ["swipe", "slam", "slam", "scream", "feast"]],
    attacks: { swipe: "Club Swing", stomp: "Boot Stomp", scream: "War Cry", feast: "Feast", slam: "Ground Slam" } },
  { id: "dragon", name: "Vex", title: "The last one. A dragon", hp: 1.92, dmg: 1.9, speed: 0.82, reward: 5,
    sig: "breath", style: "Fire that keeps burning. Only a front row's raised shields cover the rows behind",
    pattern: [["swipe", "stomp", "scream", "breath"], ["swipe", "stomp", "breath", "scream", "feast"], ["swipe", "breath", "breath", "scream", "feast", "stomp"]],
    attacks: { swipe: "Claw", stomp: "Tail Slam", scream: "Roar", feast: "Hoard", breath: "Fire Breath" } },
];
// Event bosses wear an existing model (recoloured in models.js) and fight with two signature moves.
const EVENT_BOSSES = {
  newyear: { id: "ev-newyear", model: "notification", name: "Rez", title: "A wobbly slime made of every promise you made at midnight", style: "Starts strong, gets wobbly by the second week. Slimes a whole row with guilt", blurb: "Every January a slime crawls out of the leftover trifle, made entirely of resolutions. Walk it down before it quietly gives up on itself.", sig: "ooze",
    pattern: [["swipe", "stomp", "ooze", "vanish"], ["swipe", "ooze", "vanish", "scream", "feast"], ["ooze", "vanish", "scream", "feast", "stomp"]],
    attacks: {"swipe": "Fresh Start Slap", "stomp": "January Belly Flop", "scream": "Motivational Screech", "feast": "Cheat Day", "ooze": "Twelve-Month Gym Contract", "vanish": "Quiet Quitting"} },
  spring: { id: "ev-spring", model: "autoplay", name: "Atchoo", title: "Orange, full of pollen, and up far too early for March", style: "Stampedes about like the clocks just changed, then sneezes clouds that keep on itching", blurb: "The clocks went forward and something orange woke up in the allotment. It sneezes a lot, and it's faster than you in a light jacket.", sig: "spores",
    pattern: [["swipe", "stomp", "spores", "gust"], ["swipe", "spores", "gust", "scream", "feast"], ["spores", "gust", "scream", "feast", "stomp"]],
    attacks: {"swipe": "Spring Clean", "stomp": "Lamb Stampede", "scream": "Almighty Sneeze", "feast": "Easter Binge", "spores": "Pollen Cloud", "gust": "April Shower"} },
  solstice: { id: "ev-solstice", model: "dragon", name: "Solveig", title: "A sun-gold dragon that refuses to set", style: "Burns all day and will not go down. Only raised shields at the front keep the back rows out of the glare", blurb: "On the longest day a dragon sits on the sun and won't let it go down. Out-walk it before the light runs out, at about half ten.", sig: "breath",
    pattern: [["swipe", "stomp", "breath", "slam"], ["swipe", "breath", "slam", "scream", "feast"], ["breath", "slam", "scream", "feast", "stomp"]],
    attacks: {"swipe": "Sunburn Claw", "stomp": "Heatwave Tail", "scream": "It's Still Light Out", "feast": "Barbecue", "breath": "Solar Flare", "slam": "Sunfall"} },
  harvest: { id: "ev-harvest", model: "algorithm", name: "Big Marrow Morris", title: "Brown, enormous, and swinging a prize-winning marrow", style: "Slow, heavy marrow swings. Stop the Harvest Slam or it flattens the whole allotment", blurb: "Every September he wins the village show by sitting on the judges. This year he wants your squad's steps instead.", sig: "slam",
    pattern: [["swipe", "stomp", "slam", "grab"], ["swipe", "slam", "grab", "scream", "feast"], ["slam", "grab", "scream", "feast", "stomp"]],
    attacks: {"swipe": "Marrow Swing", "stomp": "Wellie Stomp", "scream": "Show Results Bellow", "feast": "Harvest Supper", "slam": "Harvest Slam", "grab": "Into the Basket"} },
  haunted: { id: "ev-haunted", model: "leftonread", name: "The Grey Lady", title: "Waits at the bus stop. The 47 stopped running in 1962", style: "Fades out where you can't hit it, then haunts whoever has walked the least", blurb: "For one week in October a pale lady drifts along the routes you walk, still waiting for a bus that isn't coming. Walk past her enough times and she might finally take the hint.", sig: "vanish",
    pattern: [["swipe", "stomp", "vanish", "spores"], ["swipe", "vanish", "spores", "scream", "feast"], ["vanish", "spores", "scream", "feast", "stomp"]],
    attacks: {"swipe": "Cold Hand", "stomp": "Rattling Chains", "scream": "Wail of the Last Bus", "feast": "Soul Snack", "vanish": "Missed the Bus", "spores": "Grave Mist"} },
  krampus: { id: "ev-krampus", model: "algorithm", name: "Krampus", title: "Dark red, horned, and checking the naughty list against your step count", style: "Slow birch-switch swings and a sack for the stragglers. Stop the Naughty List Slam or it flattens you", blurb: "St Nicholas does the presents. His colleague does everyone who sat down all of November.", sig: "slam",
    pattern: [["swipe", "stomp", "slam", "grab"], ["swipe", "slam", "grab", "scream", "feast"], ["slam", "grab", "scream", "feast", "stomp"]],
    attacks: {"swipe": "Birch Switch", "stomp": "Hoof Stomp", "scream": "Bell Clang", "feast": "Stocking Raid", "slam": "Naughty List Slam", "grab": "Into the Sack"} },
};
const DEFAULT_PATTERN = [["swipe", "swipe", "swipe", "stomp", "scream"], ["swipe", "swipe", "stomp", "stomp", "scream", "feast"], ["swipe", "stomp", "scream", "scream", "feast"]];
// tier starts at 1. Tier 8 is Brett again on lap 2, and so on.
function bossFor(tier) {
  if (isEventTier(tier)) {
    const ev = EVENTS[Math.floor((tier - EVENT_TIER) / 1000)], base = bossFor(baseTier(tier)), E = EVENT_BOSSES[ev?.id];
    if (E) return { ...base, ...E, tier: Number(tier), lap: base.lap, hp: base.hp, dmg: base.dmg, reward: base.reward * 1.25, event: ev.id, eventName: ev.name };
  }
  const t = Math.max(1, Math.floor(tier || 1)), lap = Math.floor((t - 1) / BOSSES.length), b = BOSSES[(t - 1) % BOSSES.length];
  const k = RULES.lapHp ** lap, rk = RULES.lapReward ** lap;
  const i = (t - 1) % BOSSES.length;
  // Endless ladder: past the last boss, every step is a little tougher and richer than the one before.
  if (RULES.endless && t > BOSSES.length) {
    const last = BOSSES[BOSSES.length - 1], n = t - BOSSES.length;
    // endless 2: steps add a fixed share of the last boss (gear grows in straight lines, so this keeps pace for years)
    const grow = (k) => (RULES.endless === 2 ? 1 + (k - 1) * n : k ** n);
    return { ...b, tier: t, lap: lap + 1, hp: last.hp * grow(RULES.stepHp), dmg: last.dmg * grow(RULES.stepDmg), reward: last.reward * grow(RULES.stepReward) };
  }
  void i;
  return { ...b, tier: t, lap: lap + 1, hp: b.hp * k, dmg: b.dmg * RULES.lapDmg ** lap, reward: b.reward * rk };
}
// The squad's weekly goal before Sunday: between them, the squad averages perDay steps a day each, Monday to
// Saturday. Brett asks 5,000, Rory 5,500, Wisp 6,000 and so on; each new lap starts again at 5,000. Someone who
// joined mid-week adds only the days since they joined (and only their steps since then count). Miss it and
// Sunday's boss is enraged.
function raidGoal(tier, players) {
  const i = (Math.max(1, Math.floor(baseTier(tier) || 1)) - 1) % BOSSES.length;
  const perDay = RULES.raidGoalPerDay + RULES.raidGoalStep * i;
  const n = Math.max(1, players);
  return { perDay, players: n, target: perDay * RULES.raidGoalDays * n };
}
// The goal for a squad from its week table rows ({ weekSteps, goalDays }).
function squadGoal(tier, rows) {
  const g = raidGoal(tier, rows.length);
  const days = rows.reduce((a, r) => a + (r.goalDays ?? RULES.raidGoalDays), 0);
  const steps = rows.reduce((a, r) => a + (r.weekSteps || 0), 0);
  const target = g.perDay * Math.max(1, days);
  return { ...g, days, target, steps, met: steps >= target };
}

// ---------- class specials ----------
// Every class has one. It charges as you tap, use your row ability and take hits, and fires when full.
const SPECIALS = {
  bouncer: { name: "Kick Out", short: "Kick Out", what: "A huge kick, and the boss's next attack comes 4s late", icon: "door" },
  menace: { name: "Joyride", short: "Joyride", what: "10s of double damage, and your combo can't drop", icon: "speed" },
  mad: { name: "Volatile Brew", short: "Brew", what: "A big blast, then the boss takes 20% more from everyone for 10s", icon: "fire" },
  gremlin: { name: "Chaos Roll", short: "Chaos", what: "Something good happens: a giant crit, a squad heal, or the next attack fizzles", icon: "star" },
  lollipop: { name: "STOP!", short: "STOP!", what: "A sign to the face, and the squad ignores the boss's next attack completely", icon: "flag" },
  librarian: { name: "SHHH", short: "SHHH", what: "A crushing SHHH, then the boss's next 2 attacks barely land and it can't finish a Feast", icon: "brains" },
  pigeon: { name: "Pigeon Swarm", short: "Swarm", what: "For 10s the pigeons take its Strikes, everything else hits half as hard, and they peck", icon: "crown" },
  courier: { name: "Express Delivery", short: "Delivery", what: "A parcel to the face, then brings a fallen teammate straight back (or fully heals the most hurt)", icon: "heart" },
  pickpocket: { name: "Lift Wallet", short: "Lift", what: "Swipes a chunk of its health, and it hits 25% softer for 15s", icon: "coin" },
  hedge: { name: "Pound-Shop Prophecy", short: "Prophecy", what: "A crystal ball to the face, then 12s where the squad crits far more often", icon: "eye" },
};
const specialOf = (m) => SPECIALS[m.cls] || SPECIALS.bouncer;

// A fighter. The live game passes stride and title from the whole squad's week (so they don't
// depend on who turned up); the lab works them out from whoever is in the raid.
function makeMember(m, row) {
  const { g, perks, points } = loadout(m.stats, m.equipped, m.inv);
  const e = edges(g), maxHp = e.hp;
  const cls = classOf(m.stats || {}).id, best = homeRow(cls), pos = m.pos || best;
  return { ...m, g, e, perks, gearPts: points, cls, best, atk: e.attack, weekSteps: m.weekSteps ?? row?.weekSteps ?? 0, stride: m.stride ?? row?.stride ?? 1, title: m.title !== undefined ? m.title : row?.title ?? null,
    pos, home: pos, hp: maxHp, max: maxHp, alive: true, away: false, dmg: 0, healed: 0, taken: 0, sp: 0, specials: 0,
    cdUntil: 0, moveUntil: 0, stunUntil: 0, shieldUntil: 0, swing: 0, combo: 0, lastTap: -9, botNext: 0, secondWind: !!perks.secondWind,
    joyUntil: 0, slimeUntil: 0, dotUntil: 0, dotBase: 0, dotAcc: 0, botBackAt: 0 };
}
function raidCreate(members, { seed = Date.now(), minutes = RULES.raidMin, tier = 1, enraged = false, affix = null, den = null } = {}) {
  const r = rng(seed);
  const table = weekTable(members);
  const ms = members.map((m) => makeMember(m, table.rows.find((x) => x.id === m.id)));
  // The boss is the same however many turn up and whatever they wear: gear, positions and steps decide it.
  const lvl = 1;
  const def = bossFor(tier);
  // Shorter test raids get a proportionally smaller boss so the pacing feels the same.
  const max = Math.round(RULES.raidHpBase * def.hp * (minutes / 15) * (enraged ? RULES.enragedHp : 1));
  const R = {
    seed, r, t: 0, dur: minutes * 60, lvl, tier: def.tier, over: false, result: null,
    // Short test raids pay proportionally less.
    sizeDmg: 1, timeShare: Math.min(1, minutes / 15),
    boss: { ...def, dmg: def.dmg * (enraged ? RULES.enragedDmg : 1), hp: max, max, phase: 1, next: null, feast: null, warned: false, enraged, hidden: false, last: null },
    members: ms, table, trivia: null, triviaRuns: 0, paralysed: false, log: [], fx: [], deepDive: 0, affix: affixList(affix).join("+") || null, mods: modsFor(affix, den), atkCount: 0, echo: null,
    // Squad-wide effects from specials (each is a time it lasts until, or a count of attacks).
    vulnUntil: 0, weakUntil: 0, prophecyUntil: 0, swarmUntil: 0, swarmBy: null, peckAcc: 0, blockNext: 0, feeble: 0, grab: null,
  };
  for (const m of R.members) m.perks.spCharge = (m.perks.spCharge || 0) + (R.mods.spCharge || 0);
  scheduleAttack(R);
  return R;
}
// cut: the middle row can stagger it (half damage). stop: staggering it stops it outright. tele: extra warning time.
const ATTACKS = {
  swipe: { label: "Strike", what: "one person, usually the front", e: "🫳", cut: true },
  stomp: { label: "Stomp", what: "front and middle rows", e: "🦶", cut: true },
  scream: { label: "Scream", what: "everyone", e: "📢" },
  feast: { label: "Feast", what: "hit it hard or it heals", e: "🍗" },
  ooze: { label: "Ooze", what: "slimes a row: half damage till they move or get healed", e: "🟢" },
  spores: { label: "Spore Cloud", what: "everyone, for 8s. Healing clears it", e: "🍄" },
  vanish: { label: "Vanish", what: "can't be hit, then it goes for the weakest", e: "👻", tele: 0.8 },
  gust: { label: "Gust", what: "blows a row backwards. A raised shield holds", e: "🌪️" },
  grab: { label: "Grab", what: "grabs someone. Hit it hard to free them", e: "🐙" },
  slam: { label: "Ground Slam", what: "front and middle, very hard. Middle row: stop it", e: "💥", tele: 1.5, cut: true, stop: true },
  breath: { label: "Fire Breath", what: "everyone, then burns. Raised shields at the front cover the rows behind", e: "🔥" },
};
function scheduleAttack(R) {
  const B = R.boss;
  const M = R.mods || {};
  const every = RULES.raidAtkEvery * B.speed * (B.phase === 1 ? 1 : B.phase === 2 ? 0.85 : 0.65) * (1 - (M.haste || 0));
  const pool = (B.pattern || DEFAULT_PATTERN)[B.phase - 1];
  let type = pick(R.r, pool);
  // Volatile: the signature move comes round far more often.
  if (M.volatile && B.sig && pool.includes(B.sig) && R.r() < M.volatile) type = B.sig;
  // The signature move never comes twice in a row.
  if (type === B.sig && B.last === type) type = pick(R.r, pool.filter((x) => x !== type));
  B.last = type;
  const brains = Math.max(0, ...R.members.filter((m) => m.alive).map((m) => m.e.warn));
  const at = R.t + every;
  // Fog: the warning comes later (never less than a moment before it lands).
  const late = (M.warnLate || 0) - (M.warnEarly || 0), warn = RULES.raidTelegraph + (ATTACKS[type].tele || 0) + brains;
  B.next = { type, at, warnAt: at - Math.max(0.8, warn - late), mid: 0, staggered: false, cancel: false };
  B.warned = false;
}
function swipeTarget(R, skip = []) {
  const up = alive(R).filter((m) => !skip.includes(m.id));
  if (!up.length) return null;
  // The week's lowest walker draws far more of the boss's attention.
  const weights = up.map((m) => posOf(m.pos).aggro * (m.pos === "front" && R.t < m.shieldUntil ? 1.3 : 1) * (m.title === "last" ? RULES.slackerAggro : 1));
  let x = R.r() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < up.length; i++) { x -= weights[i]; if (x <= 0) return up[i]; }
  return up[up.length - 1];
}
// The fullest row, front first on a tie.
function busiestRow(R) {
  const up = alive(R);
  const order = ["front", "mid", "back"].map((p) => [p, up.filter((m) => m.pos === p).length]).sort((a, b) => b[1] - a[1]);
  return up.filter((m) => m.pos === order[0][0]);
}
// Who an attack will hit, decided at the warning so the ground markers are honest.
function targetsOf(R, type) {
  const up = alive(R), B = R.boss;
  if (type === "swipe") { const ids = []; for (let i = 0; i < (B.swipeHits || 1); i++) { const t = swipeTarget(R, ids); if (t) ids.push(t.id); } return ids; }
  if (type === "stomp" || type === "slam") { const rows = up.filter((m) => m.pos !== "back"); return (rows.length ? rows : up).map((m) => m.id); }
  if (type === "ooze") return busiestRow(R).map((m) => m.id);
  if (type === "gust") { const row = ["front", "mid"].map((p) => up.filter((m) => m.pos === p)).find((x) => x.length) || []; return row.map((m) => m.id); }
  if (type === "vanish") { const t = up.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; return t ? [t.id] : []; }
  if (type === "grab") { const t = swipeTarget(R); return t ? [t.id] : []; }
  if (type === "scream" || type === "spores" || type === "breath") return up.map((m) => m.id);
  return [];
}
const alive = (R) => R.members.filter((m) => m.alive && !m.away);
const canAct = (R, m) => m.alive && R.t >= m.moveUntil && R.t >= m.stunUntil && !R.over;
// `you: true` marks the person playing on this screen, so the log reads "You raise" not "You raises".
const nm = (m) => (m.you ? "You" : m.name);
const vb = (m, them, you) => (m.you ? you : them);
const say = (R, text, kind = "") => { R.log.unshift({ t: R.t, text, kind }); R.log.length = Math.min(R.log.length, 30); };
const fx = (R, e) => R.fx.push(e);
const attackName = (R, type) => R.boss.attacks?.[type] || ATTACKS[type]?.label || type;

// One ordinary tap's damage before combo, crits and buffs.
// How big a walker stands in the raid: their week's steps against the squad (stride), 0.78× to 1.4×.
const stepScale = (stride) => Math.max(0.78, Math.min(1.4, 1 + ((Number(stride) || 1) - 1) * 0.6));
const tapBase = (m) => (20 + m.atk * 4) * m.e.power * m.stride * posOf(m.pos).mult * posFit(m.g, m.pos, m.best);
// Every row filled: the squad's Formation bonus.
const formation = (R) => { const up = alive(R); return ["front", "mid", "back"].every((p) => up.some((x) => x.pos === p)) ? 1 + RULES.formationBonus : 1; };
// The boss is winding up on someone else: an opening for you.
const opening = (R, m) => { const N = R.boss.next; return N && R.boss.warned && N.ids && !N.ids.includes(m.id) ? 1 + RULES.openingBonus : 1; };
const charge = (m, n) => { m.sp = Math.min(RULES.spMax, (m.sp || 0) + n * m.e.charge * (1 + (m.perks.spCharge || 0))); };
// How much the middle row has to deal during a wind-up to stagger it.
const interruptNeed = (R, type) => Math.round(RULES.interruptShare * R.boss.max * (ATTACKS[type]?.stop ? 2 : 1) * (1 + (R.mods?.stagger || 0)));
// Every bit of damage to the boss goes through here.
function dmgBoss(R, m, dmg) {
  const B = R.boss;
  if (R.over || B.hidden || dmg <= 0) return 0;
  if (R.t < R.vulnUntil) dmg *= 1 + RULES.brewVuln;
  dmg *= 1 + (R.mods?.dealt || 0);
  if (B.feast) B.feast.dealt += dmg;
  if (R.grab) { R.grab.dealt += dmg; if (R.grab.dealt >= R.grab.need) release(R, true); }
  const N = B.next;
  if (N && B.warned && m.pos === "mid" && ATTACKS[N.type]?.cut && !N.staggered) {
    N.mid += dmg;
    if (N.mid >= interruptNeed(R, N.type)) {
      N.staggered = true; N.cancel = !!ATTACKS[N.type].stop;
      fx(R, { type: "stagger", id: m.id, attack: N.type, stopped: N.cancel });
      say(R, `${nm(m)} ${N.cancel ? vb(m, "stops", "stop") : vb(m, "staggers", "stagger")} the ${attackName(R, N.type)}`, "good");
    }
  }
  B.hp = Math.max(0, B.hp - dmg);
  m.dmg += dmg;
  if (B.hp <= 0) endRaid(R, "won");
  return dmg;
}
// Heal someone and clear slime, spores and burns off them (not a Kraken's grip).
function mend(R, by, who, amt) {
  const heal = Math.max(0, Math.min(who.max - who.hp, Math.round(amt * (1 + (R.mods?.heal || 0)))));
  who.hp += heal; if (by) by.healed += heal;
  who.slimeUntil = 0;
  if (R.grab?.id !== who.id) who.dotUntil = 0;
  return heal;
}
// The most hurt teammate, counting slime and spores as being a bit more hurt.
const mostHurt = (R) => alive(R).sort((a, b) => (a.hp / a.max - (R.t < a.slimeUntil || R.t < a.dotUntil ? 0.15 : 0)) - (b.hp / b.max - (R.t < b.slimeUntil || R.t < b.dotUntil ? 0.15 : 0)))[0];

function raidTap(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m)) return null;
  const B = R.boss, joy = R.t < m.joyUntil;
  m.combo = joy || R.t - m.lastTap <= m.e.comboMs / 1000 ? Math.min(RULES.comboMax, m.combo + 1 + (m.perks.combo || 0)) : 0;
  m.lastTap = R.t;
  charge(m, RULES.spPerTap);
  // Second Wind: hitting keeps you going.
  if (m.hp < m.max) m.hp = Math.min(m.max, m.hp + m.max * RULES.tapHeal * m.e.heal * (1 + (m.perks.heal || 0)));
  if (B.hidden) { if (!m.you && R.r() < 0.2) fx(R, { type: "tap", id: m.id, miss: true }); return { dmg: 0, crit: false, swing: false, miss: true }; }
  const crit = R.r() < m.e.crit + (m.perks.critChance || 0) + (R.t < R.prophecyUntil ? RULES.prophecyCrit : 0) + (m.pos === "back" ? RULES.backCrit : 0);
  // Stride: walk more than the squad this week and every hit lands harder.
  let dmg = tapBase(m) * (1 + (m.combo / RULES.comboMax) * m.e.combo) * (crit ? 2.5 + (m.perks.critDmg || 0) + (R.mods?.crit || 0) : 1) * (joy ? 2 : 1) * (R.t < m.slimeUntil ? 0.5 : 1) * opening(R, m) * formation(R);
  let swing = false;
  if (m.swing > 0) { dmg *= 3; m.swing--; swing = true; }
  if (B.feast) dmg *= m.perks.feast || 1;
  dmg = dmgBoss(R, m, dmg);
  // Teammates' hits are shown too (a sample of them, so the screen isn't a blizzard).
  if (!m.you && (crit || swing || R.r() < 0.3)) fx(R, { type: "tap", id: m.id, crit, swing });
  if (m.perks.lifesteal && m.alive) m.hp = Math.min(m.max, m.hp + dmg * m.perks.lifesteal / 2.5); // damage numbers run ~10× health
  return { dmg, crit, swing };
}
const abilityCd = (m) => Math.max(5, ({ front: 22, mid: 20, back: 20 }[m.pos]) * m.e.cd * (1 - Math.min(0.5, m.perks.cdr || 0)));
function raidAbility(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m) || R.t < m.cdUntil) return false;
  if (m.pos === "front") {
    dmgBoss(R, m, tapBase(m) * 10 * formation(R));
    const row = alive(R).filter((x) => x.pos === "front");
    for (const f of row) f.shieldUntil = R.t + 6 + (m.perks.shield || 0);
    fx(R, { type: "shield", by: m.id, ids: row.map((x) => x.id) });
    say(R, `${nm(m)} ${vb(m, "shield-bashes", "shield-bash")} it`, "good");
  } else if (m.pos === "mid") {
    m.swing = 8 + (m.perks.swing || 0);
    fx(R, { type: "swing", by: m.id });
    say(R, `${nm(m)} ${vb(m, "winds", "wind")} up a Big Swing`, "good");
  } else {
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const crit = R.r() < m.e.crit + (m.perks.critChance || 0) + RULES.backCrit;
      total += dmgBoss(R, m, tapBase(m) * 2 * (crit ? 2.5 + (m.perks.critDmg || 0) : 1) * opening(R, m) * formation(R));
      fx(R, { type: "tap", id: m.id, crit, swing: true });
    }
    say(R, `${nm(m)} ${vb(m, "looses", "loose")} a Volley for ${Math.round(total).toLocaleString("en-GB")}`, "good");
  }
  m.cdUntil = R.t + abilityCd(m);
  charge(m, RULES.spPerAbility);
  return true;
}
function raidSpecial(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m) || (m.sp || 0) < RULES.spMax) return false;
  const B = R.boss, S = specialOf(m), base = tapBase(m);
  let roll = null, extra = "";
  if (m.cls === "bouncer") {
    dmgBoss(R, m, base * 40);
    // The next attack comes later; its warning starts over.
    if (B.next) { B.next.at += 4; B.next.warnAt += 4; B.next.mid = 0; B.warned = false; B.hidden = false; }
  } else if (m.cls === "menace") m.joyUntil = R.t + 10;
  else if (m.cls === "mad") { dmgBoss(R, m, base * 25); R.vulnUntil = R.t + 10; }
  else if (m.cls === "gremlin") {
    const x = R.r();
    roll = x < 1 / 3 ? "crit" : x < 2 / 3 ? "heal" : "fizzle";
    if (roll === "crit") { dmgBoss(R, m, base * 60); extra = " A giant crit"; }
    else if (roll === "heal") { for (const x2 of alive(R)) mend(R, m, x2, x2.max * 0.3); extra = " The squad's healed"; }
    else { R.blockNext = 1; extra = " Its next attack will fizzle"; }
  } else if (m.cls === "lollipop") { dmgBoss(R, m, base * 25); R.blockNext = 1; }
  else if (m.cls === "librarian") { dmgBoss(R, m, base * 40); R.feeble = 2; if (B.feast) B.feast.dealt = Math.max(B.feast.dealt, B.feast.need); }
  else if (m.cls === "pigeon") { R.swarmUntil = R.t + 10; R.swarmBy = m.id; R.peckAcc = 0; }
  else if (m.cls === "courier") {
    dmgBoss(R, m, base * 20);
    const down = R.members.find((x) => !x.alive && !x.away);
    if (down) {
      down.alive = true; down.hp = Math.round(down.max * 0.6); down.dotUntil = 0; down.slimeUntil = 0;
      fx(R, { type: "revive", ids: [down.id] }); extra = ` ${nm(down)} ${vb(down, "is", "are")} back`;
    } else { const who = mostHurt(R); if (who) { const amt = mend(R, m, who, who.max); fx(R, { type: "heal", by: m.id, id: who.id, amt }); } }
  } else if (m.cls === "pickpocket") { dmgBoss(R, m, base * 30); R.weakUntil = R.t + 15; }
  else if (m.cls === "hedge") { dmgBoss(R, m, base * 25); R.prophecyUntil = R.t + 12; }
  m.sp = 0; m.specials = (m.specials || 0) + 1;
  fx(R, { type: "special", id: m.id, cls: m.cls, roll });
  say(R, `${nm(m)}: ${S.name}!${extra}`, "good");
  return true;
}
function raidMove(R, id, pos) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !m.alive || m.pos === pos || R.over) return false;
  m.pos = pos; m.movedAt = R.t; m.moveUntil = R.t + Math.max(1.2, 4 * m.e.move) * (1 + (R.mods?.move || 0)); m.swing = 0; m.slimeUntil = 0;
  fx(R, { type: "move", id: m.id, pos });
  say(R, `${nm(m)} ${vb(m, "moves", "move")} to the ${posOf(pos).label.toLowerCase()}`);
  return true;
}

// What a hit of `base` does to someone, after guard, position, shields and specials.
function dmgTo(R, m, base) {
  let d = base * R.boss.dmg * R.lvl ** 0.9 * R.sizeDmg * (1 - m.e.armour) / posFit(m.g, m.pos, m.best);
  if (!alive(R).some((x) => x.pos === "front")) d *= RULES.noFrontDmg;
  if (R.t < m.shieldUntil) d *= 0.5;
  if (R.t < R.weakUntil) d *= 0.75;
  if (R.t < R.swarmUntil) d *= 0.5;
  return d * (1 + (R.mods?.taken || 0));
}
function wound(R, m, d) {
  if (!m.alive) return;
  m.hp -= d; m.taken += d;
  fx(R, { type: "hurt", id: m.id, amt: d });
  if (m.hp <= 0 && m.secondWind) { m.hp = 1; m.secondWind = false; fx(R, { type: "secondWind", id: m.id }); say(R, `${nm(m)} ${vb(m, "refuses", "refuse")} to die (Second Wind)`, "good"); return; }
  if (m.hp <= 0) {
    m.hp = 0; m.alive = false; m.swing = 0; m.dotUntil = 0; m.slimeUntil = 0;
    if (R.grab?.id === m.id) R.grab = null;
    fx(R, { type: "down", id: m.id });
    say(R, `${nm(m)} ${vb(m, "is", "are")} down`, "bad");
    if (!R.trivia) startTrivia(R);
  }
}
function hit(R, m, base) {
  if (!m.alive) return 0;
  if (m.perks.dodge && R.r() < m.perks.dodge) { fx(R, { type: "dodge", id: m.id }); return 0; }
  const d = Math.round(dmgTo(R, m, base));
  charge(m, RULES.spPerHit * (m.pos === "front" ? 1.5 : 1));
  wound(R, m, d);
  if (m.perks.thorns) dmgBoss(R, m, d * m.perks.thorns * 10);
  // Front row, Counter: take a hit, give one back.
  if (m.pos === "front" && m.alive && d > 0) { dmgBoss(R, m, tapBase(m) * (RULES.counterTaps + m.e.counter) * formation(R)); fx(R, { type: "tap", id: m.id, crit: true }); }
  return d;
}
// Let go of whoever the Kraken is holding.
function release(R, freed) {
  const G = R.grab; if (!G) return;
  const m = R.members.find((x) => x.id === G.id);
  R.grab = null;
  if (m) { if (m.stunUntil === G.until) m.stunUntil = R.t; m.dotUntil = 0; }
  fx(R, { type: "release", id: G.id, freed });
  if (m && freed) say(R, `${nm(m)} ${vb(m, "is", "are")} free`, "good");
}
// Someone the attack was aimed at moved rows after the warning: it misses them.
function dodged(R, m, N) {
  if (!N.warnAt || !(m.movedAt > N.warnAt)) return false;
  fx(R, { type: "dodge", id: m.id }); say(R, `${nm(m)} ${vb(m, "dodges", "dodge")} it`, "good");
  return true;
}
function bossAttack(R, echo = null) {
  const B = R.boss, N = echo || B.next, type = N.type, up = alive(R), name = attackName(R, type);
  B.hidden = false;
  if (R.blockNext) { R.blockNext = 0; fx(R, { type: "blocked", attack: type }); say(R, `${name} bounces off. Nobody's hurt`, "good"); return; }
  if (N.cancel) { fx(R, { type: "blocked", attack: type, stopped: true }); say(R, `${name} never lands`, "good"); return; }
  let mult = (B.phase === 1 ? 1 : B.phase === 2 ? 1.25 : 1.5) * (N.staggered ? RULES.staggerMult : 1) * (echo ? 0.6 : 1);
  if (R.feeble > 0) { R.feeble--; mult *= RULES.feebleMult; }
  const base = RULES.raidBossDmg * mult;
  const marked = (N.ids || []).map((id) => up.find((m) => m.id === id)).filter(Boolean);
  const who = (ms) => ms.map((m) => (m.you ? "you" : m.name)).join(" and ");
  const burn = (m, perSec, secs) => { if (m.alive) { m.dotBase = Math.max(R.t < m.dotUntil ? m.dotBase : 0, perSec); m.dotUntil = Math.max(m.dotUntil, R.t + secs); } };
  if (type === "swipe") {
    if (R.t < R.swarmUntil) { fx(R, { type: "attack", attack: "swipe", ids: [R.swarmBy] }); say(R, `The pigeons take the ${name}`, "good"); return; }
    const ts = (marked.length ? marked : [swipeTarget(R)].filter(Boolean)).filter((m) => !dodged(R, m, N));
    fx(R, { type: "attack", attack: "swipe", ids: ts.map((m) => m.id) });
    const ds = ts.map((m) => hit(R, m, base * (B.swipeMult || 1)));
    if (R.mods?.leech) { const healed = ds.some((d) => d > 0) ? Math.round(B.max * R.mods.leech) : 0; if (healed) { B.hp = Math.min(B.max, B.hp + healed); fx(R, { type: "leech", amt: healed }); } }
    if (ts.length) say(R, `${name} hits ${who(ts)} for ${ds.join(" and ")}`, "bad");
  } else if (type === "stomp" || type === "slam") {
    let rows = up.filter((m) => m.pos !== "back");
    if (!rows.length) rows = up; // nobody in front: it reaches the back
    fx(R, { type: "attack", attack: type, ids: rows.map((m) => m.id) });
    // The front row takes the brunt; the middle catches the edge of it.
    rows.forEach((m) => hit(R, m, base * (type === "slam" ? 1.5 : 0.6) * (m.pos === "mid" && rows.some((x) => x.pos === "front") ? 0.5 : 1)));
    say(R, `${name} hits ${rows.length} of you`, "bad");
  } else if (type === "scream") {
    fx(R, { type: "attack", attack: "scream", ids: up.map((m) => m.id) });
    up.forEach((m) => hit(R, m, base * 0.45));
    say(R, `${name} hits everyone`, "bad");
  } else if (type === "feast") {
    const need = Math.round(RULES.raidSquadSize * 1100 * R.lvl * B.dmg * (mult < 1 ? mult : 1));
    B.feast = { until: R.t + 6, need, dealt: 0 };
    fx(R, { type: "attack", attack: "feast", ids: [] });
    say(R, `${name}. Deal ${need.toLocaleString("en-GB")} damage in 6s or it heals`, "warn");
  } else if (type === "ooze") {
    // Whoever moved out of the marked row got away.
    const row = marked.filter((m) => m.pos === N.row);
    fx(R, { type: "attack", attack: "ooze", ids: row.map((m) => m.id) });
    row.forEach((m) => { hit(R, m, base * 0.35); if (m.alive) m.slimeUntil = R.t + 15; });
    say(R, row.length ? `${name} slimes ${who(row)}. Move or get healed` : `${name} misses`, row.length ? "bad" : "good");
  } else if (type === "spores") {
    fx(R, { type: "attack", attack: "spores", ids: up.map((m) => m.id) });
    up.forEach((m) => { hit(R, m, base * 0.15); burn(m, base * 0.12, 8); });
    say(R, `${name}. Everyone's choking`, "bad");
  } else if (type === "vanish") {
    const t = marked[0] || up.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (!t || dodged(R, t, N)) return;
    fx(R, { type: "attack", attack: "vanish", ids: [t.id] });
    const d = hit(R, t, base * 1.8);
    say(R, `${B.name} reappears behind ${t.you ? "you" : t.name} for ${d}`, "bad");
  } else if (type === "gust") {
    const row = marked.filter((m) => m.pos === N.row);
    fx(R, { type: "attack", attack: "gust", ids: row.map((m) => m.id) });
    const blown = [];
    for (const m of row) {
      hit(R, m, base * 0.4);
      if (!m.alive || R.t < m.shieldUntil || m.pos === "back") continue;
      m.pos = m.pos === "front" ? "mid" : "back"; m.moveUntil = R.t + 1.5; m.swing = 0; m.botBackAt = R.t + 1.5 + R.r() * 2;
      fx(R, { type: "move", id: m.id, pos: m.pos }); blown.push(m);
    }
    say(R, blown.length ? `${name} blows ${who(blown)} back. Get back in place` : row.length ? `The shields hold against the ${name}` : `${name} hits nothing`, blown.length ? "bad" : "good");
  } else if (type === "grab") {
    const t = marked[0] || swipeTarget(R);
    if (!t || dodged(R, t, N)) return;
    fx(R, { type: "attack", attack: "grab", ids: [t.id] });
    hit(R, t, base * 0.3);
    if (t.alive && !R.grab) {
      const until = R.t + 10;
      R.grab = { id: t.id, need: Math.round(RULES.grabShare * B.max), dealt: 0, until };
      t.stunUntil = Math.max(t.stunUntil, until); t.swing = 0;
      burn(t, base * 0.2, 10);
      say(R, `${name}! ${t.you ? "You're" : `${t.name}'s`} caught. Deal ${R.grab.need.toLocaleString("en-GB")} to break free`, "warn");
    }
  } else if (type === "breath") {
    fx(R, { type: "attack", attack: "breath", ids: up.map((m) => m.id) });
    const wall = up.some((m) => m.pos === "front" && R.t < m.shieldUntil);
    up.forEach((m) => { hit(R, m, base * 0.6 * (wall && m.pos !== "front" ? 0.5 : 1)); burn(m, base * 0.08 * (wall && m.pos !== "front" ? 0.5 : 1), 6); });
    say(R, wall ? `${name}. The shields take the worst of it` : `${name} burns everyone`, "bad");
  }
}

function triviaTime(m, R) { return RULES.triviaSeconds + m.e.trivia + (m.perks.trivia || 0) + (R?.mods?.trivia || 0); }
// Someone's down: every squad member (the fallen too) gets their own question. If 2/3 of the squad
// get theirs wrong, everyone is paralysed. Rare valid answers knock a slice off the boss either way.
function startTrivia(R) {
  R.triviaRuns++;
  const who = R.members.filter((m) => !m.away);
  const qs = triviaSet(R.seed + R.triviaRuns * 7919, who.length);
  const per = {}, botPlan = {};
  who.forEach((m, i) => {
    per[m.id] = { i, q: qs[i], secs: triviaTime(m, R), until: R.t + triviaTime(m, R), ans: null };
    if (m.bot) {
      const knows = R.r() < 0.45 + 1.4 * m.e.shares.brains;
      botPlan[m.id] = { at: R.t + 4 + R.r() * 16, text: knows ? qs[i].sample(R.r, R.r() < 0.75) : pick(R.r, ["uhh", "idk", "pass", "42", "the sun?"]) };
    }
  });
  R.trivia = { per, botPlan, started: R.t, n: who.length };
  fx(R, { type: "trivia" });
  say(R, "Someone's down. Everyone gets a question. 2/3 wrong and you're all paralysed", "warn");
}
function raidAnswer(R, id, text) {
  const T = R.trivia, p = T && T.per[id];
  if (!p || p.ans) return null;
  p.ans = { text: String(text).slice(0, 40), ...p.q.check(text) };
  fx(R, { type: "answered", id, valid: p.ans.valid, rarity: p.ans.rarity || 0 });
  if (Object.values(T.per).every((x) => x.ans)) resolveTrivia(R);
  return p.ans;
}
function resolveTrivia(R) {
  const T = R.trivia, all = Object.entries(T.per);
  const wrong = all.filter(([, p]) => !p.ans.valid).length, n = all.length;
  const failed = wrong / n >= RULES.triviaFailShare - 1e-9;
  const rarity = all.reduce((s, [, p]) => s + (p.ans.valid ? p.ans.rarity : 0), 0);
  // Rare answers sink deeper: each rarity point knocks a slice off the boss.
  const dive = Math.round(R.boss.max * RULES.rarityBossDmg * rarity);
  if (dive) { R.boss.hp = Math.max(1, R.boss.hp - dive); R.deepDive += dive; }
  const results = all.map(([id, p]) => ({ id, name: R.members.find((m) => m.id === id).name, q: p.q.q, ans: p.ans, examples: p.q.examples }));
  fx(R, { type: "triviaDone", failed, wrong, n, dive });
  say(R, `Trivia: ${n - wrong}/${n} right${dive ? `, rare answers hit for ${dive.toLocaleString("en-GB")}` : ""}`, failed ? "bad" : "good");
  if (failed) {
    R.paralysed = true;
    alive(R).forEach((m) => (m.stunUntil = R.t + RULES.paralysedStunSec));
    // The fallen stay down until the stun wears off, then limp back in.
    R.reviveAt = R.t + RULES.paralysedStunSec;
    fx(R, { type: "paralysed" });
    say(R, `Paralysed. Everyone's stunned ${RULES.paralysedStunSec}s and starts tomorrow ${RULES.paralysedSteps.toLocaleString("en-GB")} steps down`, "bad");
  } else {
    const back = R.members.filter((m) => !m.alive);
    back.forEach((m) => { m.alive = true; m.hp = Math.round(m.max * 0.4); });
    fx(R, { type: "revive", ids: back.map((m) => m.id) });
    say(R, "Trivia passed. The fallen are back up", "good");
  }
  R.lastTrivia = { wrong, n, failed, dive, results };
  R.trivia = null;
  if (failed) R.fails = (R.fails || 0) + 1;
  // Everyone down: a squad gets one failed round to recover from; the second one ends it.
  if (!alive(R).length && (!failed || R.fails >= 2)) endRaid(R, "wiped");
  // Only someone who fell while the questions were up earns a new round.
  else if (!failed && R.members.some((m) => !m.alive)) startTrivia(R);
}

// When a bot would fire its special: healers wait for someone to need it, blockers wait for an attack.
function botWantsSpecial(R, m) {
  const B = R.boss;
  if (B.hidden) return false;
  if (m.cls === "courier") return R.members.some((x) => !x.alive && !x.away) || alive(R).some((x) => x.hp / x.max < 0.4);
  if (m.cls === "lollipop") return B.warned && B.next?.type !== "feast";
  if (m.cls === "librarian") return !!B.feast || (B.warned && B.next?.type !== "feast");
  if (m.cls === "pigeon") return B.warned;
  return true;
}
function botAct(R, m) {
  if (!canAct(R, m)) return;
  // Knocked out of place: get back after a moment, like a person would.
  if (m.pos !== m.home && m.botBackAt && R.t >= m.botBackAt) { m.botBackAt = 0; raidMove(R, m.id, m.home); return; }
  if (R.t >= m.botNext) {
    // Bots tap at 3–5 taps a second, about what a person keeps up (the same for every class: people don't tap
    // faster because their ninja's quick).
    const rate = 3 + 2 * R.r();
    raidTap(R, m.id);
    m.botNext = R.t + 1 / rate;
  }
  if (m.sp >= RULES.spMax && R.r() < 0.05 && botWantsSpecial(R, m)) raidSpecial(R, m.id);
  const B = R.boss, warned = B.next && B.warned;
  // Marked for a single-target hit: sometimes step out of the way, like a person watching the warnings would.
  if (warned && ["swipe", "vanish", "grab"].includes(B.next.type) && (B.next.ids || []).includes(m.id) && !m.dodgeTry) {
    m.dodgeTry = true;
    if (R.r() < 0.35) { raidMove(R, m.id, m.pos === "back" ? "mid" : "back"); m.botBackAt = R.t + 3 + R.r() * 2; return; }
  }
  if (!warned) m.dodgeTry = false;
  if (R.t >= m.cdUntil) {
    // The front bashes when a hit's coming, the middle saves its Big Swing for wind-ups it can stagger, the back
    // fires its Volley when the boss is busy with someone else.
    const want = m.pos === "back" ? (warned ? R.r() < 0.3 : R.r() < 0.003)
      : m.pos === "front" ? warned && R.r() < 0.05
      : warned && ATTACKS[B.next.type]?.cut ? R.r() < 0.3 : R.r() < 0.004;
    if (want) raidAbility(R, m.id);
  }
}

function raidStep(R, dt) {
  if (R.over) return;
  dt = Math.min(dt, 0.25);
  R.t += dt;
  const B = R.boss;
  const phase = B.hp / B.max > 0.6 ? 1 : B.hp / B.max > 0.3 ? 2 : 3;
  if (phase !== B.phase) { B.phase = phase; fx(R, { type: "phase", phase }); say(R, phase === 2 ? "Phase 2: it hits harder and faster" : "Phase 3: it's enraged", "warn"); }
  if (B.feast && R.t >= B.feast.until) {
    if (B.feast.dealt < B.feast.need) { const heal = Math.round(B.max * 0.03); B.hp = Math.min(B.max, B.hp + heal); fx(R, { type: "feastEnd", healed: heal }); say(R, `It ate well. Healed ${heal.toLocaleString("en-GB")}`, "bad"); }
    else { fx(R, { type: "feastEnd", healed: 0 }); say(R, "Feast interrupted", "good"); }
    B.feast = null;
  }
  if (B.next && !B.warned && R.t >= B.next.warnAt) {
    B.warned = true; B.next.ids = targetsOf(R, B.next.type);
    B.next.row = R.members.find((m) => m.id === B.next.ids[0])?.pos || null;
    if (B.next.type === "vanish") B.hidden = true;
    fx(R, { type: "windup", attack: B.next.type, ids: B.next.ids });
  }
  if (B.next && R.t >= B.next.at) {
    const N = B.next;
    bossAttack(R);
    if (R.mods?.echo && ["swipe", "stomp", "scream", "breath", "spores"].includes(N.type) && ++R.atkCount % 3 === 0) R.echo = { type: N.type, at: R.t + 1, row: N.row };
    if (!R.over) scheduleAttack(R);
  }
  if (R.echo && R.t >= R.echo.at && !R.over) { const E = R.echo; R.echo = null; fx(R, { type: "echo", attack: E.type }); bossAttack(R, { type: E.type, ids: targetsOf(R, E.type), row: E.row, mid: 0 }); }
  if (R.over) return;
  if (R.grab && R.t >= R.grab.until) release(R, false);
  // Spores, burns and the Kraken's squeeze tick once a second.
  for (const m of R.members) {
    if (!m.alive || m.away || R.t >= m.dotUntil) { m.dotAcc = 0; continue; }
    m.dotAcc += dt;
    if (m.dotAcc >= 1) { m.dotAcc -= 1; wound(R, m, Math.max(1, Math.round(dmgTo(R, m, m.dotBase)))); }
  }
  // Pigeons peck twice a second.
  if (R.t < R.swarmUntil) {
    const by = R.members.find((m) => m.id === R.swarmBy);
    R.peckAcc += dt;
    while (by && R.peckAcc >= 0.5 && !R.over) { R.peckAcc -= 0.5; dmgBoss(R, by, tapBase(by)); }
  }
  // The Prophecy: abilities recharge twice as fast.
  if (R.t < R.prophecyUntil) for (const m of alive(R)) m.cdUntil -= dt;
  if (R.reviveAt && R.t >= R.reviveAt) {
    R.reviveAt = 0;
    const back = R.members.filter((m) => !m.alive);
    back.forEach((m) => { m.alive = true; m.hp = Math.round(m.max * 0.2); });
    if (back.length) { fx(R, { type: "revive", ids: back.map((m) => m.id) }); say(R, "The fallen stagger back up", "good"); }
  }
  for (const m of R.members) if (m.bot && !R.over) botAct(R, m);
  const T = R.trivia;
  if (T) {
    for (const [id, plan] of Object.entries(T.botPlan)) if (R.t >= plan.at) { delete T.botPlan[id]; raidAnswer(R, id, plan.text); if (R.trivia !== T) break; }
    // Out of time counts as wrong.
    if (R.trivia === T) for (const [id, p] of Object.entries(T.per)) if (!p.ans && R.t >= p.until) { raidAnswer(R, id, ""); if (R.trivia !== T) break; }
  }
  if (!R.over && R.t >= R.dur) endRaid(R, "timeout");
}

function endRaid(R, how) {
  if (R.over) return;
  R.over = true; R.reviveAt = 0;
  const n = R.members.length;
  const frac = 1 - R.boss.hp / R.boss.max;
  const full = RULES.raidRewardPerMember * n * R.lvl ** RULES.raidRewardCurve * R.boss.reward * R.timeShare;
  const pool = (how === "won" ? full : how === "timeout" ? full * frac * 0.35 : 0) * (1 + (R.mods?.loot || 0));
  // Split: half by steps walked this week, half by what you did in the fight (damage, healing, hits taken).
  const work = (m) => m.dmg + m.healed * 200 + m.taken * 100;
  const totalWork = R.members.reduce((s, m) => s + work(m), 0) || 1;
  const totalSteps = R.members.reduce((s, m) => s + m.weekSteps, 0);
  const stepPart = (m) => (totalSteps > 0 ? m.weekSteps / totalSteps : 1 / n);
  const titleLoot = (m) => (m.title === "top" ? RULES.topLoot : m.title === "last" ? RULES.lastLoot : 0);
  // Weekly settlement, win or lose: the lowest walker pays a cut of their week's Efforts to the top walker.
  const top = R.members.find((m) => m.title === "top"), last = R.members.find((m) => m.title === "last");
  const settle = top && last ? { from: last.id, to: top.id, amount: Math.round(RULES.slackerTax * last.weekSteps / RULES.stepsPerEffort) } : null;
  R.result = {
    how, frac, pool: Math.round(pool), lvl: R.lvl, tier: R.tier, boss: R.boss.name, paralysed: R.paralysed, deepDive: R.deepDive, settle,
    shares: R.members.map((m) => {
      const reward = Math.round(pool * (RULES.stepsShare * stepPart(m) + (1 - RULES.stepsShare) * work(m) / totalWork) * Math.max(0, 1 + (m.perks.loot || 0) + titleLoot(m)));
      const tax = settle ? (m.id === settle.to ? settle.amount : m.id === settle.from ? -settle.amount : 0) : 0;
      return { id: m.id, name: m.name, dmg: Math.round(m.dmg), healed: m.healed, taken: m.taken, weekSteps: m.weekSteps, stride: m.stride, title: m.title, reward, tax, total: reward + tax };
    }),
  };
  fx(R, { type: "end", how });
  say(R, how === "won" ? `${R.boss.name} is down!` : how === "timeout" ? "Time's up" : "Squad wiped", how === "won" ? "good" : "bad");
}

// ---------- the calendar ----------
// Everything new switches itself on by date (UK days), so the game keeps changing without anyone deploying.
const FEATURES = { wardrobe: "2026-11-16", hunt: "2026-11-18", events: "2026-12-01", den: "2027-02-01" };
const featureOn = (f, day) => !!FEATURES[f] && day >= FEATURES[f];

// Season twists. Numbers are mods the fight reads (see modsFor). Later seasons pair two of them.
const AFFIXES = {
  fog: { name: "Fog", what: "Warnings come 0.8s later. Raid rewards +10%", warnLate: 0.8, loot: 0.1 },
  frost: { name: "Frost", what: "Moving rows takes twice as long. Raid rewards +10%", move: 1, loot: 0.1 },
  haste: { name: "Haste", what: "Bosses attack 15% faster. Raid rewards +15%", haste: 0.15, loot: 0.15 },
  thickhide: { name: "Thick Hide", what: "Crits hit ×2 instead of ×2.5. Raid rewards +10%", crit: -0.5, loot: 0.1 },
  volatile: { name: "Volatile", what: "Bosses use their own move far more often. Raid rewards +15%", volatile: 0.2, loot: 0.15 },
  leech: { name: "Leech", what: "Every Strike that lands heals the boss a little. Raid rewards +15%", leech: 0.002, loot: 0.15 },
  bloodmoon: { name: "Blood Moon", what: "Bosses hit 40% harder. Raid rewards +20%", taken: 0.4, loot: 0.2 },
  silence: { name: "Silence", what: "Specials charge 25% slower. Raid rewards +10%", spCharge: -0.25, loot: 0.1 },
  brittle: { name: "Brittle", what: "Staggers need half the damage, but bosses hit 15% harder. Raid rewards +5%", stagger: -0.5, taken: 0.15, loot: 0.05 },
  echo: { name: "Echo", what: "Every third attack repeats a second later, softer. Raid rewards +15%", echo: 1, loot: 0.15 },
};
const affixList = (id) => String(id || "").split("+").filter((x) => AFFIXES[x]);
const affixInfo = (id) => { const L = affixList(id); return L.length ? { name: L.map((x) => AFFIXES[x].name).join(" + "), what: L.map((x) => AFFIXES[x].what).join(" ") } : null; };

// Seasons run back to back, 13 weeks each, from Season 1. 1-4 are written; after that they build themselves
// from the world route (names below; landmarks and story beats in world.js) and a rotation of twists.
const S1_START = "2026-11-02", SEASON_DAYS = 91;
const MILES = [0, 80, 165, 245, 330, 410, 495, 575, 660, 740, 825, 910, 1000];
const WRITTEN = [
  { name: "The Long Count", route: "From the Blotmarsh to the Gilded Void", affix: "fog", miles: [0, 110, 200, 270, 360, 450, 540, 610, 680, 760, 830, 900, 1000] },
  { name: "The Frozen Ledger", route: "Through seven frozen realms, and round again", affix: "frost" },
  { name: "Wait for Me", route: "Seven realms at double speed, to the Render Shore", affix: "haste" },
  { name: "The Error Throne", route: "From Bogbody Crossing to the table by the window", affix: "thickhide" },
];
// Seasons 5 onwards: [name, route], one realm cycle each (kept in step with world.js).
const LEGS = [
  ["The First Rung", "From the Blotmarsh down the first rung"],
  ["Rising Damp", "From a flooded Blotmarsh into every realm below"],
  ["Spore Season", "From Puffcap Hollow's gate to the bottom of the Void"],
  ["The Long Hush", "Through seven realms with the sound turned down"],
  ["Loose Moorings", "From the Blotmarsh to the Void by drifting island"],
  ["Low Water", "Down to where the Lowmost Deep has drained"],
  ["Copy Errors", "Through realms Grimm has started to redraw"],
  ["The Gold Rush", "From the Blotmarsh to a Gilded Void that's spilling"],
  ["Two by Two", "Every realm twice over, with the next one showing through"],
  ["The Undertow", "From the Blotmarsh to the bottom of the Deep, and down"],
  ["Lanterns Out", "Through seven realms with the lamps going dark"],
  ["The Halfway Rung", "Down to the middle of Holloway's ladder"],
  ["The Hundred Lights", "Towards the blue lights at the bottom of everything"],
  ["Head Office", "From the Blotmarsh to the Taxman's employers"],
  ["Old Debts", "Through the realms the 1911 squad walked"],
  ["Krampus Weather", "Across seven realms with a bailiff behind you"],
  ["The Boot Fair", "From the Blotmarsh to the Void, collecting boots"],
  ["The Sleepers", "Through realms full of people who sat down"],
  ["Wrong Way Up", "From the Misrendered Realm's edge back round to it"],
  ["The Chorus", "Through seven realms that have started to sing"],
  ["Weather Swap", "From a frozen Blotmarsh to a melting Void"],
  ["The Missing Hour", "Through realms that have each lost an hour"],
  ["Deep Water", "Down to the Lowmost Deep, and through the floor of it"],
  ["The Second Lamp", "Towards a light that goes round at the bottom"],
  ["Kit's Way", "Down the road Kit walked, rung by rung"],
  ["The Register", "Through realms where every name is written down"],
  ["Nobody Left", "From the Blotmarsh to the Void, counting heads"],
  ["The Long Sofa", "Through realms that want you to sit down"],
  ["Glass Floors", "Over realms with the bottom showing through"],
  ["Every Step a Stitch", "Seven realms, mending as you go"],
  ["Under the Lamp", "To the foot of a lighthouse standing on its head"],
  ["All Hands", "Every realm at once, with everyone who ever walked"],
  ["The Stillness", "Down to the thing that sits at the bottom"],
  ["The Last Rungs", "Down the last of Holloway's ladder"],
  ["The Vote", "Through seven realms to a decision"],
  ["The Last Lamp", "Up through the seam to Morwenna's light"],
];
const SOLO = ["volatile", "leech", "bloodmoon", "silence", "brittle", "echo", "fog", "frost"];
function affixFor(n) {
  if (n <= WRITTEN.length) return WRITTEN[n - 1].affix;
  if (n <= 12) return SOLO[(n - 5) % SOLO.length];
  // From year 4, two at once: every pairing in turn.
  const ids = Object.keys(AFFIXES), pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push(`${ids[i]}+${ids[j]}`);
  return pairs[((n - 13) * 7) % pairs.length];
}
function seasonDef(n) {
  const w = WRITTEN[n - 1], leg = LEGS[(n - WRITTEN.length - 1) % Math.max(1, LEGS.length)];
  return { n, id: `s${n}`, name: w?.name || leg?.[0] || `Season ${n}`, route: w?.route || leg?.[1] || "Onwards", start: dayOf(dayNo(S1_START) + (n - 1) * SEASON_DAYS),
    weeks: 13, affix: affixFor(n), set: `s${n}`, miles: w?.miles || MILES, written: n <= WRITTEN.length };
}
const dayNo = (day) => Math.floor(Date.parse(day + "T12:00:00Z") / 86400000);
const dayOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
// The season on a day: { season, week (1-13), day (0-90), start, end }, or Season 1 coming up (week 0).
function seasonOn(day) {
  const d = dayNo(day), d1 = dayNo(S1_START);
  if (d < d1) { const S = seasonDef(1); return { season: S, week: 0, day: d - d1, start: S.start, end: dayOf(d1 + SEASON_DAYS - 1), upcoming: true }; }
  const n = Math.floor((d - d1) / SEASON_DAYS) + 1, S = seasonDef(n), a = dayNo(S.start);
  return { season: S, week: Math.floor((d - a) / 7) + 1, day: d - a, start: S.start, end: dayOf(a + SEASON_DAYS - 1) };
}
const seasonById = (id) => (/^s\d+$/.test(id || "") ? seasonDef(Number(id.slice(1))) : null);
// Gear tiers arrive on their release day; season gear is only on sale during its season.
const tierOut = (tier, day) => !tier.release || day >= tier.release;
const onSale = (item, day) => tierOut(tierOf(item.tier), day) && (!item.season || (seasonOn(day)?.season.id === item.season && seasonOn(day).week > 0));

// Season sets: three pieces any class can wear, stronger every season. Names for written seasons come from
// items.js (SEASON_SETS); later ones are named after their route.
const SET_SLOTS = { weapon: ["power", "speed", "Walking Pole", "🥢"], armour: ["guard", "luck", "Trail Jacket", "🧥"], trinket: ["brains", null, "Route Map", "🗺️"] };
function seasonTier(n) {
  const k = 1 + 0.12 * (n - 1);
  return { id: `s${n}`, label: `Season ${n}`, color: "#5fd0a8", lvl: Math.min(60, 6 + 4 * (n - 1)), price: Math.round((1800 * k * k) / 100) * 100, season: `s${n}` };
}
function seasonSetItems(n) {
  const k = 1 + 0.12 * (n - 1), names = CAT().SEASON_SETS?.[`s${n}`] || {}, S = seasonDef(n);
  return Object.entries(SET_SLOTS).map(([slot, [a, b, noun, e]]) => {
    const nm = names[slot] || {};
    const stats = slot === "trinket" ? { [a]: Math.round(6 * k) } : { [a]: Math.round(8 * k), [b]: Math.round(3 * k) };
    return { id: `s${n}-${slot}`, slot, tier: `s${n}`, set: `s${n}`, season: `s${n}`, name: nm.name || `${S.name} ${noun}`, e: nm.e || e, stats, perk: null,
      text: nm.text || `Issued to every squad that walked ${S.name}.` };
  });
}
// Adds season tiers, sets and set bonuses (s2 onwards) to the catalogue once it's loaded. Season 1's are in items.js.
function addSeasonGear(upTo = 80) {
  const C = CAT();
  if (!C.ITEMS || C._seasonGear) return;
  C._seasonGear = true;
  C.SETS = C.SETS || {};
  for (let n = 2; n <= upTo; n++) {
    if (!C.TIERS.some((t) => t.id === `s${n}`)) C.TIERS.push(seasonTier(n));
    for (const it of seasonSetItems(n)) if (!C.ITEMS.some((x) => x.id === it.id)) C.ITEMS.push(it);
    C.SETS[`s${n}`] = C.SETS[`s${n}`] || { name: `${seasonDef(n).name} kit`, season: `s${n}`, bonus: ["spCharge", 0.25], what: "Wear all three: your special charges 25% faster" };
  }
}

// ---------- the Den ----------
// The squad's base. Everyone chips in Efforts; each room has 10 levels and gives the whole squad a small bonus.
const DEN_ROOMS = [
  { id: "kitchen", name: "Kitchen", what: "Raid rewards", per: 0.02, mod: "loot", fmt: "pct" },
  { id: "gym", name: "Gym", what: "Damage in raids", per: 0.01, mod: "dealt", fmt: "pct" },
  { id: "infirmary", name: "Infirmary", what: "Healing in raids", per: 0.03, mod: "heal", fmt: "pct" },
  { id: "library", name: "Library", what: "Time on trivia questions", per: 0.5, mod: "trivia", fmt: "s" },
  { id: "lookout", name: "Lookout", what: "Earlier warnings", per: 0.05, mod: "warnEarly", fmt: "s" },
  { id: "shrine", name: "Shrine", what: "Special charge", per: 0.02, mod: "spCharge", fmt: "pct" },
  { id: "maproom", name: "Map Room", what: "Journey miles", per: 0.01, mod: "miles", fmt: "pct" },
  { id: "workshop", name: "Workshop", what: "Cheaper upgrades", per: 0.02, mod: "upgrade", fmt: "pct" },
  { id: "vault", name: "Vault", what: "Most you can steal from the Taxman", per: 0.005, mod: "steal", fmt: "pct" },
  { id: "trophy", name: "Trophy Hall", what: "Season rewards", per: 0.02, mod: "season", fmt: "pct" },
];
const DEN_MAX = 10;
const denCost = (L) => Math.round((1000 * L ** 1.5) / 100) * 100; // the cost of reaching level L from L-1
const denLevel = (total) => { let L = 0, spent = 0; while (L < DEN_MAX && spent + denCost(L + 1) <= total) spent += denCost(++L); return L; };
const denNext = (total) => { const L = denLevel(total); let spent = 0; for (let i = 1; i <= L; i++) spent += denCost(i); return L >= DEN_MAX ? null : { level: L + 1, need: spent + denCost(L + 1) - total }; };
// { room: level } → { mod: value }.
function denMods(levels) {
  const out = {};
  for (const r of DEN_ROOMS) { const L = levels?.[r.id] || 0; if (L) out[r.mod] = (out[r.mod] || 0) + L * r.per; }
  return out;
}
// Every mod a fight reads, from the season's twist and the squad's Den.
function modsFor(affix, den) {
  const m = {};
  for (const id of affixList(affix)) for (const [k, v] of Object.entries(AFFIXES[id])) if (typeof v === "number") m[k] = (m[k] || 0) + v;
  for (const [k, v] of Object.entries(denMods(den))) m[k] = (m[k] || 0) + v;
  return m;
}

// ---------- the wardrobe ----------
// Cosmetics: suit and headband colours and titles. Some only come from events.
const WARDROBE = [
  ...[["midnight", "Midnight", "#1c2340"], ["forest", "Forest", "#2f6b3a"], ["crimson", "Crimson", "#9e2235"], ["ocean", "Ocean", "#1f5f8b"], ["plum", "Plum", "#5e2f73"],
    ["sand", "Sand", "#c8a46a"], ["ash", "Ash", "#6d7381"], ["snow", "Snow", "#e9edf5"]].map(([id, name, c], i) => ({ id: `suit-${id}`, kind: "suit", name: `${name} suit`, color: c, price: 400 + i * 150 })),
  ...[["gold", "Gold", "#ffc83d"], ["lime", "Lime", "#9be15d"], ["hotpink", "Hot pink", "#ff4fa3"], ["cyan", "Cyan", "#3fd8ff"], ["white", "White", "#f6f6f6"], ["black", "Black", "#1a1a1a"]]
    .map(([id, name, c], i) => ({ id: `band-${id}`, kind: "band", name: `${name} headband`, color: c, price: 300 + i * 100 })),
  { id: "suit-gilded", kind: "suit", name: "Gilded suit", color: "#d4a017", price: 12000 },
  { id: "title-pavement", kind: "title", name: "Pavement Pounder", price: 1500 },
  { id: "title-insole", kind: "title", name: "Professional Insole", price: 3000 },
  { id: "title-legend", kind: "title", name: "Local Legend", price: 8000 },
  // Event exclusives: won by beating that event's boss.
  { id: "band-firework", kind: "band", name: "Firework headband", color: "#ff3fd1", event: "newyear" },
  { id: "suit-blossom", kind: "suit", name: "Blossom suit", color: "#f4a6c8", event: "spring" },
  { id: "band-sunrise", kind: "band", name: "Sunrise headband", color: "#ff9d2e", event: "solstice" },
  { id: "suit-harvest", kind: "suit", name: "Harvest suit", color: "#b5651d", event: "harvest" },
  { id: "suit-spectre", kind: "suit", name: "Spectre suit", color: "#c9d6ff", event: "haunted" },
  { id: "band-krampus", kind: "band", name: "Krampus headband", color: "#b3122e", event: "krampus" },
];
const wardrobeById = (id) => WARDROBE.find((w) => w.id === id) || null;

// ---------- The House: skins for real money ----------
// Purely cosmetic: no stats, no advantage. Every penny goes into The House fund. The dearer the tier, the more the
// skin changes your ninja and the more it moves: each tier keeps everything the one below has and adds more.
// look: what ninja3d draws. pay: the Stripe Payment Link for it (empty until it's set up).
const SKIN_TIERS = [
  { id: "street", label: "Street", pence: 99, color: "#9aa6c4", adds: "A whole new outfit and pattern" },
  { id: "flash", label: "Flash", pence: 299, color: "#3d9bff", adds: "Glowing trims that shimmer as you move" },
  { id: "neon", label: "Neon", pence: 499, color: "#a86bff", adds: "A light trail behind every step and swing" },
  { id: "mythic", label: "Mythic", pence: 999, color: "#ffb21e", adds: "An aura that circles you, and hit sparks in your colours" },
  { id: "house", label: "House", pence: 1999, color: "#ff4d6a", adds: "A full transformation, a floating crown and a victory dance" },
];
const SKINS = [
  { id: "skin-tracksuit", tier: "street", name: "Tracksuit Tony", look: { base: "#1f6d3a", trim: "#ffffff", pattern: "stripes" }, text: "Three stripes. Zero cardio. All attitude." },
  { id: "skin-camo", tier: "street", name: "Camo Commuter", look: { base: "#4f5b3a", trim: "#c9b98a", pattern: "camo" }, text: "Blends in at the bus stop. Nowhere else." },
  { id: "skin-hivis", tier: "flash", name: "Hi-Vis Hero", look: { base: "#d7f22b", trim: "#c0c6cf", pattern: "bands", glow: "#f6ff9a" }, text: "Reflective strips that catch every streetlight." },
  { id: "skin-disco", tier: "flash", name: "Disco Shell", look: { base: "#3a1f6e", trim: "#e9e3ff", pattern: "tiles", glow: "#ff8bf0" }, text: "A mirrorball that learned to walk." },
  { id: "skin-nightbus", tier: "neon", name: "Night Bus", look: { base: "#14122b", trim: "#ff3fd1", pattern: "circuits", glow: "#3fe7ff", trail: "#ff3fd1" }, text: "The last N29 home, neon still buzzing." },
  { id: "skin-ember", tier: "neon", name: "Ember Walker", look: { base: "#2a1210", trim: "#ff7a2f", pattern: "cracks", glow: "#ffb13d", trail: "#ff5a1f" }, text: "Leaves scorch marks on every pavement." },
  { id: "skin-frost", tier: "mythic", name: "Frost Monarch", look: { base: "#cfe8ff", trim: "#5fb6ff", pattern: "crystal", glow: "#9fe6ff", trail: "#bff4ff", aura: "snow", spark: "#bff4ff" }, text: "Rules the north. Never feels the cold." },
  { id: "skin-thunder", tier: "mythic", name: "Thunder Courier", look: { base: "#20263f", trim: "#ffe14a", pattern: "bolts", glow: "#fff38a", trail: "#ffe14a", aura: "sparks", spark: "#fff38a" }, text: "Delivers in the storm. Is the storm." },
  { id: "skin-gilded", tier: "house", name: "The Gilded House", look: { base: "#d9a520", trim: "#fff2b0", pattern: "filigree", glow: "#ffe27a", trail: "#ffd23d", aura: "coins", spark: "#ffe27a", body: "gold", crown: "crown", dance: "flex" }, text: "The house always wins. Now it walks too." },
  { id: "skin-void", tier: "house", name: "Void Walker", look: { base: "#0a0620", trim: "#b48cff", pattern: "stars", glow: "#c9a8ff", trail: "#8f6bff", aura: "orbit", spark: "#e6d8ff", body: "galaxy", crown: "halo", dance: "warp" }, text: "Stepped out of the space between screens." },
];
// One Stripe Payment Link per price. The app adds who's buying what (client_reference_id), and the effort-house
// webhook checks the amount paid covers it, so one link serves every item at that price. Empty until set up.
const HOUSE_LINKS = { 99: "", 299: "", 499: "", 999: "", 1999: "" };
const skinById = (id) => SKINS.find((k) => k.id === id) || null;
const skinTier = (k) => SKIN_TIERS.find((t) => t.id === (k?.tier || k)) || null;
const pounds = (p) => `£${(p / 100).toFixed(2)}`;

// ---------- Winny's Gamba Bucket ----------
// A bucket of Efforts for a price. Like a roulette wheel the odds are fixed and public, and on average it pays back
// less than it costs: the House always wins (about 12p in every £1 here). Most buckets lose; a few win big.
const GAMBA = {
  price: 200, perDay: 5,
  // Past the daily 5, buckets for real money (paid buckets don't cost Endeavours). Capped each week.
  packs: [{ id: "gamba-3", buckets: 3, pence: 99 }, { id: "gamba-10", buckets: 10, pence: 299 }],
  weeklyPence: 1000,
  // [chance, payout in Efforts, label, rarity colour the reveal climbs to]
  prizes: [
    [0.50, 0, "Empty bucket", "dud"],
    [0.20, 100, "Half back", "common"],
    [0.15, 200, "Money back", "rare"],
    [0.09, 400, "Double", "epic"],
    [0.045, 800, "Quadruple", "legendary"],
    [0.012, 2500, "Big bucket", "mythic"],
    [0.003, 8000, "Winny's Jackpot", "jackpot"],
  ],
};
// Anything The House sells for money: a skin or a bucket pack. { id, kind, name, pence, link }
function houseItem(id) {
  const k = skinById(id), p = GAMBA.packs.find((x) => x.id === id);
  if (k) { const t = skinTier(k); return { id, kind: "skin", name: k.name, pence: t.pence, link: HOUSE_LINKS[t.pence] || "" }; }
  if (p) return { id, kind: "pack", name: `${p.buckets} Gamba Buckets`, pence: p.pence, buckets: p.buckets, link: HOUSE_LINKS[p.pence] || "" };
  return null;
}
const gambaReturn = () => GAMBA.prizes.reduce((s, [p, v]) => s + p * v, 0) / GAMBA.price;
// u: a uniform 0–1 roll (the server's).
function gambaRoll(u) {
  let x = u;
  for (let i = 0; i < GAMBA.prizes.length; i++) { x -= GAMBA.prizes[i][0]; if (x < 0) return i; }
  return 0;
}

// ---------- events ----------
// Every year, on these dates (inclusive). While one's on, its boss is an extra choice in the Sunday lobby: same
// strength as your ladder boss, 25% more loot, a cosmetic the first time you beat it, and the ladder doesn't move.
const EVENTS = [
  { id: "newyear", name: "New Year Rush", from: "01-01", to: "01-14" },
  { id: "spring", name: "Spring Sprint", from: "03-20", to: "04-02" },
  { id: "solstice", name: "Solstice", from: "06-17", to: "06-27" },
  { id: "harvest", name: "Harvest", from: "09-19", to: "10-02" },
  { id: "haunted", name: "The Haunted Walk", from: "10-24", to: "11-01" },
  { id: "krampus", name: "Krampus Night", from: "12-10", to: "12-31" },
];
const eventOn = (day) => { if (String(day) < FEATURES.events) return null; const md = String(day).slice(5); return EVENTS.find((e) => md >= e.from && md <= e.to) || null; };
const EVENT_TIER = 100000;
const eventTier = (eventId, base) => EVENT_TIER + EVENTS.findIndex((e) => e.id === eventId) * 1000 + Math.max(1, Math.min(999, base || 1));
const isEventTier = (t) => Number(t) >= EVENT_TIER;
const baseTier = (t) => (isEventTier(t) ? Number(t) % 1000 : Number(t));

// ---------- the Midweek Hunt ----------
// Wednesdays, noon to 11pm UK: a five-minute fight against your squad's ladder boss, with your squad-mates' gear
// fighting beside you as bots. Once a week; you keep your own share.
const HUNT = { weekday: 3, from: 12, to: 23, minutes: 5 };

// Miles along the route from the squad's daily average steps (each day only counts people who'd joined by then).
const journeyMiles = (S, dailyAvgs, bonus = 0) => Math.min(S.miles[S.miles.length - 1], (dailyAvgs.reduce((a, x) => a + x, 0) / RULES.stepsPerMile) * (1 + bonus));
// Chapter k (1-based) opens once the squad reaches its landmark and the season has reached week k.
const chapterOpen = (S, k, week, miles) => k >= 1 && k <= S.miles.length && week >= k && miles >= S.miles[k - 1];
// The season track: a tier for every trackSteps of your own steps this season.
const trackTier = (steps) => Math.min(RULES.trackTiers, Math.floor(steps / RULES.trackSteps));
const TRACK_TITLES = { 5: "Rambler", 10: "Trailblazer", 15: "Long Hauler", 20: "End to Ender" };
const trackReward = (k) => (k % 5 === 0 ? { efforts: 100, title: TRACK_TITLES[k] } : { efforts: 30 });

// Weekly squad bounties: three a week, picked from the week and the squad's code.
const BOUNTIES = {
  steps: { label: (n) => `Walk ${(n * 45000).toLocaleString("en-GB")} steps between you this week`, need: (n) => n * 45000, of: (d) => d.ids.reduce((a, id) => a + d.days.reduce((b, day) => b + (d.steps[id]?.[day] || 0), 0), 0) },
  sameDay: { label: () => "Everyone walks 8,000+ on the same day", need: () => 1, of: (d) => d.days.some((day) => d.ids.every((id) => (d.steps[id]?.[day] || 0) >= 8000)) ? 1 : 0 },
  three10k: { label: () => "Three of you walk 10,000+ on the same day", need: () => 1, min: 3, of: (d) => d.days.some((day) => d.ids.filter((id) => (d.steps[id]?.[day] || 0) >= 10000).length >= 3) ? 1 : 0 },
  weekend: { label: (n) => `Walk ${(n * 20000).toLocaleString("en-GB")} steps between you on Saturday and Sunday`, need: (n) => n * 20000, of: (d) => d.ids.reduce((a, id) => a + (d.steps[id]?.[d.days[5]] || 0) + (d.steps[id]?.[d.days[6]] || 0), 0) },
  taxman: { label: (n) => `Fight the Taxman ${n * 4} times between you`, need: (n) => n * 4, of: (d) => d.taxFights || 0 },
  goal: { label: () => "Make the step goal before Sunday's raid", need: () => 1, of: (d) => (d.goalMet ? 1 : 0) },
  raid: { label: () => "Win Sunday's raid", need: () => 1, of: (d) => (d.raidWon ? 1 : 0) },
};
function bountiesFor(code, weekStart, n) {
  const r = rng(hash(`${code}:${weekStart}`)), ids = Object.keys(BOUNTIES).filter((k) => !BOUNTIES[k].min || n >= BOUNTIES[k].min), out = [];
  while (out.length < 3 && ids.length) out.push(ids.splice(Math.floor(r() * ids.length), 1)[0]);
  return out.map((id, i) => ({ id, slot: i + 1, label: BOUNTIES[id].label(n), need: BOUNTIES[id].need(n) }));
}
// Progress on this week's bounties. d: { ids, days (Mon-Sun), steps {id: {day: n}}, taxFights, goalMet, raidWon }.
function bountyProgress(code, weekStart, d) {
  return bountiesFor(code, weekStart, d.ids.length).map((b) => { const have = BOUNTIES[b.id].of(d); return { ...b, have: Math.min(have, b.need), done: have >= b.need }; });
}

// ---------- live raids ----------
// Someone joins after the start: they fight from now on and the boss grows by one member's share.
function raidAddMember(R, m) {
  if (R.members.some((x) => x.id === m.id) || R.over) return null;
  const per = R.boss.max / Math.max(1, R.members.length);
  const x = makeMember(m, null);
  R.members.push(x);
  R.boss.max = Math.round(R.boss.max + per); R.boss.hp = Math.round(R.boss.hp + per);
  R.sizeDmg = Math.min(1, 0.4 + 0.15 * R.members.length);
  say(R, `${x.name} joins the fight`, "good");
  return x;
}
// The whole fight as plain data, so the host's phone can stream it to the squad and anyone can take over.
function raidExport(R) {
  const { r: _r, fx: _fx, trivia, members, log, ...rest } = R;
  return {
    ...rest, log: log.slice(0, 8),
    members: members.map(({ answers: _a, inv: _i, equipped: _e, ...m }) => m),
    trivia: trivia ? { started: trivia.started, n: trivia.n, per: Object.fromEntries(Object.entries(trivia.per).map(([id, p]) => [id, { i: p.i, secs: p.secs, until: p.until, ans: p.ans }])) } : null,
  };
}
function raidImport(d) {
  const R = { ...d, log: d.log || [], fx: [], r: rng((d.seed + Math.floor(d.t * 1000)) >>> 0), members: d.members.map((m) => ({ ...m })) };
  if (d.trivia) {
    const qs = triviaSet(d.seed + d.triviaRuns * 7919, d.trivia.n);
    R.trivia = { ...d.trivia, botPlan: {}, per: Object.fromEntries(Object.entries(d.trivia.per).map(([id, p]) => [id, { ...p, q: qs[p.i] }])) };
  }
  return R;
}

addSeasonGear();
root.Game = {
  DEFAULT_RULES, get RULES() { return RULES; }, setRules,
  hash, rng, effortsFromSteps, money, scrollBudget, scrollCounted, overBudget, taxRate,
  xpFor, levelOf, levelProgress,
  pace, weekTable,
  STATS, STAT_TOTAL, stats, classOf, POSITIONS, posOf, suggestedPosition, posFit, HOME_ROW, homeRow, edges, statEffects, statTotal, hitIndex,
  SLOTS, itemById, tierOf, itemStats, upgradeCost, loadout, dealsFor, priceOf,
  taxmanSetup, taxmanStart, taxmanDone, taxmanStep, taxmanTap, taxmanResult,
  norm, triviaSet, mathPrompt, listPrompt,
  BOSSES, bossFor, raidGoal, squadGoal, ATTACKS, raidCreate, raidAddMember, raidExport, raidImport, raidEnd: endRaid, raidTap, raidAbility, raidMove, raidAnswer, raidStep, abilityCd, triviaTime,
  SPECIALS, specialOf, raidSpecial, interruptNeed, tapBase, setsWorn, stepScale,
  AFFIXES, affixList, affixInfo, seasonOn, seasonById, seasonDef, onSale, tierOut, addSeasonGear, FEATURES, featureOn,
  DEN_ROOMS, DEN_MAX, denCost, denLevel, denNext, denMods, modsFor, WARDROBE, wardrobeById, SKIN_TIERS, SKINS, skinById, skinTier, pounds, GAMBA, gambaReturn, gambaRoll, HOUSE_LINKS, houseItem, EVENTS, eventOn, eventTier, isEventTier, baseTier, EVENT_BOSSES, HUNT, LEGS, journeyMiles, chapterOpen, trackTier, trackReward, TRACK_TITLES, BOUNTIES, bountiesFor, bountyProgress, dayNo, dayOf,
};
})(typeof window !== "undefined" ? window : globalThis);
