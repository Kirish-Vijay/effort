// Effort game rules: the step currency, walker stats and classes, gear and perks, player levels,
// the 7pm Taxman, the Sunday raid and its trivia. Pure logic with no DOM, so the lab, the app and
// the server can all run the same numbers. Needs items.js and prompts.js loaded first.
(function (root) {
"use strict";

// Every number worth tuning lives here. The lab's Knobs panel edits a copy of this.
const DEFAULT_RULES = {
  stepsPerEffort: 100,      // 100 steps = 1 Effort
  effortsPerEndeavour: 100, // 100 Efforts = 1 Endeavour
  dailyEffortCap: 300,      // 30k steps a day, max
  scrollMinPer1kSteps: 5,   // scroll budget earned per 1,000 steps
  scrollBudgetMax: 60,
  baseTax: 0.20,            // the Taxman takes 20% of today's Efforts if you don't fight
  taxPerOverMin: 0.005,     // +0.5% tax per minute scrolled over budget
  taxMaxExtra: 0.20,
  stealCap: 0.30,           // beat the Taxman, keep tapping: steal up to +30%
  paceTax: 0.05,            // beat the squad's average steps today: 5 points less tax; fall 10% short: 5 more
  // Walking is the point. In the Sunday raid your steps this week, against the squad's average, decide how hard you hit.
  strideMin: 0.5,           // half the squad average or less: half damage
  strideMax: 1.6,           // the hardest walker hits up to 60% harder
  stepsShare: 0.5,          // half of the raid's reward is split by steps walked, half by what you did in the fight
  topLoot: 0.25,            // the week's top walker gets +25% on their share...
  lastLoot: -0.25,          // ...the week's lowest walker gets 25% less...
  slackerTax: 0.1,          // ...and pays 10% of their week's Efforts to the top walker
  slackerAggro: 2.5,        // the boss goes for the lowest walker this many times as often
  windowHour: 19,           // battles open at 7pm
  dailyWindowMin: 5,
  raidMin: 15,
  taxmanBaseHp: 35000,
  taxmanHpPerEffort: 100,
  taxmanHpPerOverMin: 80,
  taxmanRegen: 0.025,       // share of his health he wins back per second when you stop tapping
  taxmanStepBoost: 300,     // steps power you up: tap damage ×(1 + Efforts today / this)
  taxmanPerLevel: 0.08,     // the Taxman gets 8% tougher for every player level
  stealPerLevel: 0.01,      // ...and you can steal 1% more per level (up to +15%)
  auditEvery: 22,           // seconds between Audit shields
  auditFor: 6,
  auditBlock: 0.15,         // damage that gets through the Audit shield (weak spot hits ×2.5)
  stealDmgPerPct: 0.07,     // extra damage (as a share of his health) for each 1% stolen
  comboWindowMs: 320,
  comboMax: 50,
  raidHpBase: 800000,       // Brett's health; every boss has its own multiple. Fixed: how many turn up doesn't change it (tuned for four)
  raidSquadSize: 4,         // the fewest who can start a raid, and the squad size the boss is tuned for
  noFrontDmg: 1.3,          // with nobody at the front, every hit lands this much harder
  lapHp: 2,                 // after the last boss the ladder loops: each lap has this much more health…
  lapDmg: 1.4142,           // …hits this much harder…
  lapReward: 5.5,           // …and pays this much more
  endless: 0,               // 1: past the last boss, each step up is stepHp/stepDmg/stepReward tougher and richer than the last
  stepHp: 1.08, stepDmg: 1.03, stepReward: 1.04,
  raidAtkEvery: 6,          // seconds between boss attacks (phase 1)
  raidTelegraph: 2,
  raidBossDmg: 15,          // a swipe at level 1
  raidRewardPerMember: 150, // Efforts per squad member per boss level, on a win
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
  guardShare: 0.4,          // Front, Bodyguard: takes this share of every hit aimed at the back row
  interruptShare: 0.002,    // Middle, Interrupt: deal this share of the boss's health during a wind-up to stagger it…
  staggerMult: 0.5,         // …so it lands this hard (a Ground Slam is stopped outright)
  supportEvery: 20,         // Back, Support: every this many taps…
  supportHeal: 0.025,       // …heals the most hurt teammate this share of their health and clears slime, spores and burns
  feebleMult: 0.35,         // SHHH: the next two attacks land this hard
  brewVuln: 0.2,            // Volatile Brew: the boss takes this much more for 10s
  prophecyCrit: 0.25,       // Pound-Shop Prophecy: extra crit chance for the squad
  grabShare: 0.012,         // The Kraken's Grab: damage that frees someone, as a share of its health
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
const scrollBudget = (steps) => Math.min(RULES.scrollBudgetMax, Math.floor((steps || 0) / 1000) * RULES.scrollMinPer1kSteps);
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
  { id: "power", label: "Power", e: "💪", what: "Damage per tap" },
  { id: "guard", label: "Guard", e: "🛡️", what: "Health and armour" },
  { id: "speed", label: "Speed", e: "🏃", what: "Faster cooldowns and combos" },
  { id: "brains", label: "Brains", e: "🧠", what: "More trivia time, earlier warnings" },
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
const POSITIONS = [
  { id: "front", label: "Front", e: "🛡️", ability: "Shield Wall", abilityWhat: "Front row takes 60% less damage for 8s", mult: 1.15, aggro: 70,
    passive: "Bodyguard", passiveWhat: "Takes 40% of every hit aimed at the back row" },
  { id: "mid", label: "Middle", e: "⚔️", ability: "Big Swing", abilityWhat: "Your next 8 taps hit 3× as hard", mult: 1.3, aggro: 25,
    passive: "Interrupt", passiveWhat: "Hit hard during a wind-up to stagger it to half damage (and stop a Ground Slam)" },
  { id: "back", label: "Back", e: "🩹", ability: "Patch Up", abilityWhat: "Heal the most hurt teammate 35%", mult: 0.85, aggro: 5,
    passive: "Support", passiveWhat: "Every 20 taps patches up whoever needs it and clears slime, spores and burns" },
];
const posOf = (id) => POSITIONS.find((p) => p.id === id) || POSITIONS[1];
const posScores = (st) => ({ front: st.guard * 2 + st.power * 0.5, mid: st.power + st.speed, back: st.brains + st.luck * 0.8 + st.speed * 0.3 });
function suggestedPosition(st) {
  return Object.entries(posScores(st)).sort((a, b) => b[1] - a[1])[0][0];
}
// 1 in your best spot, less elsewhere. Out of position you hit weaker, take more and heal less.
function posFit(st, pos) {
  const sc = posScores(st), best = Math.max(...Object.values(sc));
  return best > 0 ? Math.max(0.3, (sc[pos] ?? 0) / best) : 1;
}

// ---------- gear ----------
// inv: { itemId: upgradeLevel }   equipped: { weapon: id, armour: id, trinket: id }
const SLOTS = ["weapon", "armour", "trinket"];
const itemById = (id) => CAT().ITEMS.find((i) => i.id === id);
const tierOf = (id) => CAT().TIERS.find((t) => t.id === id) || CAT().TIERS[0];
// Each upgrade adds 10% of the item's base stats (kept to one decimal, so small items still grow every level).
function itemStats(item, up) {
  const out = {};
  for (const [k, v] of Object.entries(item.stats || {})) out[k] = Math.round(v * (1 + (up || 0) * RULES.upgradeStep) * 10) / 10;
  return out;
}
// Prices are always whole Endeavours (multiples of 100 Efforts) so the shop never shows fractions.
const wholeE = (efforts) => Math.max(RULES.effortsPerEndeavour, Math.round(efforts / RULES.effortsPerEndeavour) * RULES.effortsPerEndeavour);
const upgradeCost = (item, up) => wholeE(tierOf(item.tier).price * RULES.upgradeCostShare * (up + 1));
function loadout(st, equipped, inv) {
  const g = { ...st }, perks = {};
  let points = 0;
  for (const id of Object.values(equipped || {})) {
    const item = itemById(id);
    if (!item) continue;
    const up = (inv && inv[id]) || 0;
    for (const [k, v] of Object.entries(itemStats(item, up))) { g[k] = (g[k] || 0) + v; points += v; }
    if (item.perk) {
      const [type, val] = item.perk;
      perks[type] = type === "secondWind" ? 1 : (perks[type] || 0) + val;
    }
  }
  return { g, perks, points };
}
// Today's three deals: picked by date, leaning towards your class, at a discount.
function dealsFor(day, cls, level) {
  const r = rng(hash("deals:" + day + ":" + cls));
  const pool = CAT().ITEMS.filter((i) => (i.cls === cls || !i.cls) && tierOf(i.tier).lvl <= level);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  return out;
}
const priceOf = (item, deal) => wholeE(tierOf(item.tier).price * (deal ? 1 - RULES.dealDiscount : 1));

// ---------- 7pm: the Taxman ----------
// Can't die. He wins back health whenever you stop tapping, raises an Audit shield every ~22s
// (only the moving weak spot takes proper damage), and golden receipts fly past for bonus loot.
function taxmanSetup({ steps = 0, scrollMin = 0, stats: st = {}, equipped = {}, inv = {}, level = 1, squadAvg = 0 }) {
  const efforts = effortsFromSteps(steps), over = overBudget(steps, scrollMin);
  const { g, perks } = loadout(st, equipped, inv);
  return {
    efforts, over, taxRate: taxRate(steps, scrollMin, squadAvg), pace: pace(steps, squadAvg), squadAvg, perks,
    level,
    // He keeps pace with you: every level you gain, he gets tougher (and you can steal a bit more).
    hp: Math.round((RULES.taxmanBaseHp + efforts * RULES.taxmanHpPerEffort + over * RULES.taxmanHpPerOverMin) * (1 + RULES.taxmanPerLevel * (level - 1))),
    tapDmg: (10 + (g.power || 0) * 0.8) * (1 + efforts / Math.max(1, RULES.taxmanStepBoost)),
    stepBoost: 1 + efforts / Math.max(1, RULES.taxmanStepBoost),
    critChance: (g.luck || 0) * 0.02 + (perks.critChance || 0),
    critMult: 3 + (perks.critDmg || 0),
    comboWindow: RULES.comboWindowMs + (g.speed || 0) * 12,
    comboGain: 1 + (perks.combo || 0),
    stealCap: RULES.stealCap + (perks.steal || 0) + Math.min(0.15, RULES.stealPerLevel * (level - 1)),
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
  if (!B.ko && B.t - B.lastTap > 0.8 && B.dmg > 0) B.dmg = Math.max(0, B.dmg - S.hp * RULES.taxmanRegen * dt);
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
  let dmg = S.tapDmg * (1 + B.combo / RULES.comboMax) * (crit ? S.critMult : 1);
  let kind = crit ? "crit" : "hit";
  if (B.audit) {
    if (Math.hypot(B.audit.x - x, (B.audit.y - y) * 1.4) < 0.1) { dmg *= 2.5; kind = "weak"; B.weak++; }
    else { dmg *= RULES.auditBlock; kind = "blocked"; }
  }
  B.dmg += dmg; B.taps++; if (crit) B.crits++;
  if (!B.ko && B.dmg >= S.hp) { B.ko = true; B.fx.push({ type: "ko" }); }
  return { kind, dmg, crit, combo: B.combo };
}
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
  { id: "autoplay", name: "Rory", title: "Orange creature that emerged from the swamp. Defeat it.", hp: 1.45, dmg: 1.0, speed: 0.97, reward: 1.4,
    sig: "spores", style: "Stampedes and clouds of spores that keep on hurting",
    pattern: [["swipe", "swipe", "stomp", "spores", "scream"], ["swipe", "stomp", "stomp", "spores", "spores", "feast"], ["stomp", "spores", "scream", "scream", "feast"]],
    attacks: { swipe: "Chomp", stomp: "Stampede", scream: "Bellow", feast: "Gorge", spores: "Spore Cloud" } },
  { id: "leftonread", name: "Wisp", title: "Cold, quiet, always behind you", hp: 1.15, dmg: 1.15, speed: 0.94, reward: 1.9,
    sig: "vanish", style: "Fades out where you can't hit it, then picks off the weakest",
    pattern: [["swipe", "swipe", "scream", "vanish"], ["swipe", "scream", "vanish", "vanish", "feast"], ["swipe", "scream", "scream", "vanish", "feast"]],
    attacks: { swipe: "Chill Touch", stomp: "Phase Slam", scream: "Wail", feast: "Drain", vanish: "Vanish" } },
  { id: "scroll", name: "Gale", title: "Never stops spinning", hp: 1.75, dmg: 1.3, speed: 0.91, reward: 2.5,
    sig: "gust", style: "Fast, and blows the front row out of position",
    pattern: [["swipe", "swipe", "gust", "stomp", "scream"], ["swipe", "gust", "stomp", "scream", "feast", "gust"], ["swipe", "gust", "scream", "scream", "feast"]],
    attacks: { swipe: "Slice", stomp: "Downdraft", scream: "Howl", feast: "Siphon", gust: "Gust" } },
  { id: "kraken", name: "The Kraken", title: "Came up from somewhere deep", hp: 2.25, dmg: 1.45, speed: 0.88, reward: 3.2,
    sig: "grab", style: "Two tentacles hit at once, and it grabs people",
    swipeHits: 2, swipeMult: 0.65,
    pattern: [["swipe", "swipe", "grab", "stomp", "scream"], ["swipe", "swipe", "grab", "stomp", "feast"], ["swipe", "grab", "scream", "stomp", "feast", "grab"]],
    attacks: { swipe: "Tentacle Lash", stomp: "Ink Slam", scream: "Deep Roar", feast: "Devour", grab: "Grab" } },
  { id: "algorithm", name: "Grimm", title: "Big, blue, and carrying a club", hp: 3.3, dmg: 1.6, speed: 0.85, reward: 4,
    sig: "slam", style: "Slow, crushing club swings. Stop the Ground Slam or it flattens you",
    swipeMult: 1.3,
    pattern: [["swipe", "swipe", "stomp", "slam"], ["swipe", "stomp", "slam", "scream", "feast"], ["swipe", "slam", "slam", "scream", "feast"]],
    attacks: { swipe: "Club Swing", stomp: "Boot Stomp", scream: "War Cry", feast: "Feast", slam: "Ground Slam" } },
  { id: "dragon", name: "Vex", title: "The last one. A dragon", hp: 4.3, dmg: 1.9, speed: 0.82, reward: 5,
    sig: "breath", style: "Fire that keeps burning. Only a Shield Wall covers the rows behind",
    pattern: [["swipe", "stomp", "scream", "breath"], ["swipe", "stomp", "breath", "scream", "feast"], ["swipe", "breath", "breath", "scream", "feast", "stomp"]],
    attacks: { swipe: "Claw", stomp: "Tail Slam", scream: "Roar", feast: "Hoard", breath: "Fire Breath" } },
];
const DEFAULT_PATTERN = [["swipe", "swipe", "swipe", "stomp", "scream"], ["swipe", "swipe", "stomp", "stomp", "scream", "feast"], ["swipe", "stomp", "scream", "scream", "feast"]];
// tier starts at 1. Tier 8 is Brett again on lap 2, and so on.
function bossFor(tier) {
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
  const i = (Math.max(1, Math.floor(tier || 1)) - 1) % BOSSES.length;
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
  lollipop: { name: "STOP!", short: "STOP!", what: "The squad ignores the boss's next attack completely", icon: "flag" },
  librarian: { name: "SHHH", short: "SHHH", what: "The boss's next 2 attacks barely land, and it can't finish a Feast", icon: "brains" },
  pigeon: { name: "Pigeon Swarm", short: "Swarm", what: "For 10s the pigeons take its Strikes, everything else hits half as hard, and they peck", icon: "crown" },
  courier: { name: "Express Delivery", short: "Delivery", what: "Brings a fallen teammate straight back, or fully heals the most hurt", icon: "heart" },
  pickpocket: { name: "Lift Wallet", short: "Lift", what: "Swipes a chunk of its health, and it hits 25% softer for 15s", icon: "coin" },
  hedge: { name: "Pound-Shop Prophecy", short: "Prophecy", what: "12s: the squad crits far more often and abilities recharge twice as fast", icon: "eye" },
};
const specialOf = (m) => SPECIALS[m.cls] || SPECIALS.bouncer;

// A fighter. The live game passes stride and title from the whole squad's week (so they don't
// depend on who turned up); the lab works them out from whoever is in the raid.
function makeMember(m, row) {
  const { g, perks, points } = loadout(m.stats, m.equipped, m.inv);
  const maxHp = Math.round(80 + g.guard * 10);
  const pos = m.pos || suggestedPosition(g);
  return { ...m, g, perks, gearPts: points, cls: classOf(m.stats || {}).id, weekSteps: m.weekSteps ?? row?.weekSteps ?? 0, stride: m.stride ?? row?.stride ?? 1, title: m.title !== undefined ? m.title : row?.title ?? null,
    pos, home: pos, hp: maxHp, max: maxHp, alive: true, away: false, dmg: 0, healed: 0, taken: 0, sp: 0, specials: 0, supTaps: 0,
    cdUntil: 0, moveUntil: 0, stunUntil: 0, shieldUntil: 0, swing: 0, combo: 0, lastTap: -9, botNext: 0, secondWind: !!perks.secondWind,
    joyUntil: 0, slimeUntil: 0, dotUntil: 0, dotBase: 0, dotAcc: 0, botBackAt: 0 };
}
function raidCreate(members, { seed = Date.now(), minutes = RULES.raidMin, tier = 1, enraged = false } = {}) {
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
    members: ms, table, trivia: null, triviaRuns: 0, paralysed: false, log: [], fx: [], deepDive: 0,
    // Squad-wide effects from specials (each is a time it lasts until, or a count of attacks).
    vulnUntil: 0, weakUntil: 0, prophecyUntil: 0, swarmUntil: 0, swarmBy: null, peckAcc: 0, blockNext: 0, feeble: 0, grab: null,
  };
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
  gust: { label: "Gust", what: "blows a row backwards. A Shield Wall holds", e: "🌪️" },
  grab: { label: "Grab", what: "grabs someone. Hit it hard to free them", e: "🐙" },
  slam: { label: "Ground Slam", what: "front and middle, very hard. Middle row: stop it", e: "💥", tele: 1.5, cut: true, stop: true },
  breath: { label: "Fire Breath", what: "everyone, then burns. A Shield Wall covers the rows behind", e: "🔥" },
};
function scheduleAttack(R) {
  const B = R.boss;
  const every = RULES.raidAtkEvery * B.speed * (B.phase === 1 ? 1 : B.phase === 2 ? 0.85 : 0.65);
  const pool = (B.pattern || DEFAULT_PATTERN)[B.phase - 1];
  let type = pick(R.r, pool);
  // The signature move never comes twice in a row.
  if (type === B.sig && B.last === type) type = pick(R.r, pool.filter((x) => x !== type));
  B.last = type;
  const brains = Math.max(0, ...R.members.filter((m) => m.alive).map((m) => m.g.brains));
  const at = R.t + every;
  B.next = { type, at, warnAt: at - RULES.raidTelegraph - (ATTACKS[type].tele || 0) - brains * 0.05, mid: 0, staggered: false, cancel: false };
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
const tapBase = (m) => (20 + m.g.power * 4) * m.stride * posOf(m.pos).mult * posFit(m.g, m.pos) ** 1.5;
const charge = (m, n) => { m.sp = Math.min(RULES.spMax, (m.sp || 0) + n * (1 + m.g.brains * 0.015)); };
// How much the middle row has to deal during a wind-up to stagger it.
const interruptNeed = (R, type) => Math.round(RULES.interruptShare * R.boss.max * (ATTACKS[type]?.stop ? 2 : 1));
// Every bit of damage to the boss goes through here.
function dmgBoss(R, m, dmg) {
  const B = R.boss;
  if (R.over || B.hidden || dmg <= 0) return 0;
  if (R.t < R.vulnUntil) dmg *= 1 + RULES.brewVuln;
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
  const heal = Math.max(0, Math.min(who.max - who.hp, Math.round(amt)));
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
  m.combo = joy || R.t - m.lastTap <= (RULES.comboWindowMs + m.g.speed * 12) / 1000 ? Math.min(RULES.comboMax, m.combo + 1 + (m.perks.combo || 0)) : 0;
  m.lastTap = R.t;
  charge(m, RULES.spPerTap);
  // Back row, Support: every so many taps patches up whoever needs it most.
  if (m.pos === "back" && ++m.supTaps >= RULES.supportEvery) {
    m.supTaps = 0;
    const who = mostHurt(R);
    if (who && (who.hp < who.max || R.t < who.slimeUntil || R.t < who.dotUntil)) {
      const amt = mend(R, m, who, who.max * RULES.supportHeal * posFit(m.g, m.pos));
      fx(R, { type: "pulse", by: m.id, id: who.id, amt });
    }
  }
  if (B.hidden) { if (!m.you && R.r() < 0.2) fx(R, { type: "tap", id: m.id, miss: true }); return { dmg: 0, crit: false, swing: false, miss: true }; }
  const crit = R.r() < m.g.luck * 0.02 + (m.perks.critChance || 0) + (R.t < R.prophecyUntil ? RULES.prophecyCrit : 0);
  // Stride: walk more than the squad this week and every hit lands harder.
  let dmg = tapBase(m) * (1 + m.combo / (RULES.comboMax * 2)) * (crit ? 2.5 + (m.perks.critDmg || 0) : 1) * (joy ? 2 : 1) * (R.t < m.slimeUntil ? 0.5 : 1);
  let swing = false;
  if (m.swing > 0) { dmg *= 3; m.swing--; swing = true; }
  if (B.feast) dmg *= m.perks.feast || 1;
  dmg = dmgBoss(R, m, dmg);
  // Teammates' hits are shown too (a sample of them, so the screen isn't a blizzard).
  if (!m.you && (crit || swing || R.r() < 0.3)) fx(R, { type: "tap", id: m.id, crit, swing });
  if (m.perks.lifesteal && m.alive) m.hp = Math.min(m.max, m.hp + dmg * m.perks.lifesteal / 2.5); // damage numbers run ~10× health
  return { dmg, crit, swing };
}
const abilityCd = (m) => Math.max(5, ({ front: 25, mid: 20, back: 18 }[m.pos]) * Math.max(0.45, 1 - m.g.speed * 0.03) * (1 - Math.min(0.5, m.perks.cdr || 0)));
function raidAbility(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m) || R.t < m.cdUntil) return false;
  if (m.pos === "front") {
    const row = alive(R).filter((x) => x.pos === "front");
    for (const f of row) f.shieldUntil = R.t + 8 + (m.perks.shield || 0);
    fx(R, { type: "shield", by: m.id, ids: row.map((x) => x.id) });
    say(R, `${nm(m)} ${vb(m, "raises", "raise")} a Shield Wall`, "good");
  } else if (m.pos === "mid") {
    m.swing = 8 + (m.perks.swing || 0);
    fx(R, { type: "swing", by: m.id });
    say(R, `${nm(m)} ${vb(m, "winds", "wind")} up a Big Swing`, "good");
  } else {
    const hurt = mostHurt(R);
    if (!hurt) return false;
    const heal = mend(R, m, hurt, hurt.max * (0.35 + (m.perks.heal || 0)) * posFit(m.g, m.pos));
    fx(R, { type: "heal", by: m.id, id: hurt.id, amt: heal });
    say(R, `${nm(m)} ${vb(m, "patches", "patch")} up ${hurt === m ? vb(m, "themself", "yourself") : nm(hurt).replace(/^You$/, "you")} (+${heal})`, "good");
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
  } else if (m.cls === "lollipop") R.blockNext = 1;
  else if (m.cls === "librarian") { R.feeble = 2; if (B.feast) B.feast.dealt = Math.max(B.feast.dealt, B.feast.need); }
  else if (m.cls === "pigeon") { R.swarmUntil = R.t + 10; R.swarmBy = m.id; R.peckAcc = 0; }
  else if (m.cls === "courier") {
    const down = R.members.find((x) => !x.alive && !x.away);
    if (down) {
      down.alive = true; down.hp = Math.round(down.max * 0.6); down.dotUntil = 0; down.slimeUntil = 0;
      fx(R, { type: "revive", ids: [down.id] }); extra = ` ${nm(down)} ${vb(down, "is", "are")} back`;
    } else { const who = mostHurt(R); if (who) { const amt = mend(R, m, who, who.max); fx(R, { type: "heal", by: m.id, id: who.id, amt }); } }
  } else if (m.cls === "pickpocket") { dmgBoss(R, m, base * 15); R.weakUntil = R.t + 15; }
  else if (m.cls === "hedge") R.prophecyUntil = R.t + 12;
  m.sp = 0; m.specials = (m.specials || 0) + 1;
  fx(R, { type: "special", id: m.id, cls: m.cls, roll });
  say(R, `${nm(m)}: ${S.name}!${extra}`, "good");
  return true;
}
function raidMove(R, id, pos) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !m.alive || m.pos === pos || R.over) return false;
  m.pos = pos; m.moveUntil = R.t + Math.max(1.5, 4 - m.g.speed * 0.2); m.swing = 0; m.slimeUntil = 0;
  fx(R, { type: "move", id: m.id, pos });
  say(R, `${nm(m)} ${vb(m, "moves", "move")} to the ${posOf(pos).label.toLowerCase()}`);
  return true;
}

// What a hit of `base` does to someone, after guard, position, shields and specials.
function dmgTo(R, m, base) {
  let d = base * R.boss.dmg * R.lvl ** 0.9 * R.sizeDmg * (1 - Math.min(0.6, m.g.guard * 0.02)) / posFit(m.g, m.pos);
  if (!alive(R).some((x) => x.pos === "front")) d *= RULES.noFrontDmg;
  if (R.t < m.shieldUntil) d *= 0.4;
  if (R.t < R.weakUntil) d *= 0.75;
  if (R.t < R.swarmUntil) d *= 0.5;
  return d;
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
function hit(R, m, base, guarded) {
  if (!m.alive) return 0;
  if (m.perks.dodge && R.r() < m.perks.dodge) { fx(R, { type: "dodge", id: m.id }); return 0; }
  // Front row, Bodyguard: someone at the front takes part of every hit aimed at the back.
  if (!guarded && m.pos === "back") {
    const g = alive(R).filter((x) => x.pos === "front" && x !== m).sort((a, b) => b.hp / b.max - a.hp / a.max)[0];
    if (g) { hit(R, g, base * RULES.guardShare, true); base *= 1 - RULES.guardShare; }
  }
  const d = Math.round(dmgTo(R, m, base));
  charge(m, RULES.spPerHit * (m.pos === "front" ? 1.5 : 1));
  wound(R, m, d);
  if (m.perks.thorns) dmgBoss(R, m, d * m.perks.thorns * 10);
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
function bossAttack(R) {
  const B = R.boss, N = B.next, type = N.type, up = alive(R), name = attackName(R, type);
  B.hidden = false;
  if (R.blockNext) { R.blockNext = 0; fx(R, { type: "blocked", attack: type }); say(R, `${name} bounces off. Nobody's hurt`, "good"); return; }
  if (N.cancel) { fx(R, { type: "blocked", attack: type, stopped: true }); say(R, `${name} never lands`, "good"); return; }
  let mult = (B.phase === 1 ? 1 : B.phase === 2 ? 1.25 : 1.5) * (N.staggered ? RULES.staggerMult : 1);
  if (R.feeble > 0) { R.feeble--; mult *= RULES.feebleMult; }
  const base = RULES.raidBossDmg * mult;
  const marked = (N.ids || []).map((id) => up.find((m) => m.id === id)).filter(Boolean);
  const who = (ms) => ms.map((m) => (m.you ? "you" : m.name)).join(" and ");
  const burn = (m, perSec, secs) => { if (m.alive) { m.dotBase = Math.max(R.t < m.dotUntil ? m.dotBase : 0, perSec); m.dotUntil = Math.max(m.dotUntil, R.t + secs); } };
  if (type === "swipe") {
    if (R.t < R.swarmUntil) { fx(R, { type: "attack", attack: "swipe", ids: [R.swarmBy] }); say(R, `The pigeons take the ${name}`, "good"); return; }
    const ts = marked.length ? marked : [swipeTarget(R)].filter(Boolean);
    fx(R, { type: "attack", attack: "swipe", ids: ts.map((m) => m.id) });
    const ds = ts.map((m) => hit(R, m, base * (B.swipeMult || 1)));
    if (ts.length) say(R, `${name} hits ${who(ts)} for ${ds.join(" and ")}`, "bad");
  } else if (type === "stomp" || type === "slam") {
    let rows = up.filter((m) => m.pos !== "back");
    if (!rows.length) rows = up; // nobody in front: it reaches the back
    fx(R, { type: "attack", attack: type, ids: rows.map((m) => m.id) });
    rows.forEach((m) => hit(R, m, base * (type === "slam" ? 1.5 : 0.6)));
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
    if (!t) return;
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
    say(R, blown.length ? `${name} blows ${who(blown)} back. Get back in place` : row.length ? `The Shield Wall holds against the ${name}` : `${name} hits nothing`, blown.length ? "bad" : "good");
  } else if (type === "grab") {
    const t = marked[0] || swipeTarget(R);
    if (!t) return;
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
    say(R, wall ? `${name}. The Shield Wall takes the worst of it` : `${name} burns everyone`, "bad");
  }
}

function triviaTime(m) { return RULES.triviaSeconds + Math.max(0, m.g.brains - 5) + (m.perks.trivia || 0); }
// Someone's down: every squad member (the fallen too) gets their own question. If 2/3 of the squad
// get theirs wrong, everyone is paralysed. Rare valid answers knock a slice off the boss either way.
function startTrivia(R) {
  R.triviaRuns++;
  const who = R.members.filter((m) => !m.away);
  const qs = triviaSet(R.seed + R.triviaRuns * 7919, who.length);
  const per = {}, botPlan = {};
  who.forEach((m, i) => {
    per[m.id] = { i, q: qs[i], secs: triviaTime(m), until: R.t + triviaTime(m), ans: null };
    if (m.bot) {
      const knows = R.r() < 0.45 + m.g.brains * 0.045;
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
    // Bots tap at 3–5 taps a second, about what a person keeps up.
    const rate = 3 + (m.g.speed / 10) * 2 * (0.6 + 0.4 * R.r());
    raidTap(R, m.id);
    m.botNext = R.t + 1 / rate;
  }
  if (m.sp >= RULES.spMax && R.r() < 0.05 && botWantsSpecial(R, m)) raidSpecial(R, m.id);
  if (R.t >= m.cdUntil) {
    const B = R.boss, warned = B.next && B.warned;
    // The middle row saves its Big Swing for wind-ups it can stagger.
    const want = m.pos === "back" ? alive(R).some((x) => x.hp / x.max < 0.6 || R.t < x.slimeUntil) && R.r() < 0.02
      : m.pos === "front" ? warned && R.r() < 0.02
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
  if (B.next && R.t >= B.next.at) { bossAttack(R); if (!R.over) scheduleAttack(R); }
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
  const pool = how === "won" ? full : how === "timeout" ? full * frac * 0.35 : 0;
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

root.Game = {
  DEFAULT_RULES, get RULES() { return RULES; }, setRules,
  hash, rng, effortsFromSteps, money, scrollBudget, overBudget, taxRate,
  xpFor, levelOf, levelProgress,
  pace, weekTable,
  STATS, STAT_TOTAL, stats, classOf, POSITIONS, posOf, suggestedPosition, posFit,
  SLOTS, itemById, tierOf, itemStats, upgradeCost, loadout, dealsFor, priceOf,
  taxmanSetup, taxmanStart, taxmanStep, taxmanTap, taxmanResult,
  norm, triviaSet, mathPrompt, listPrompt,
  BOSSES, bossFor, raidGoal, squadGoal, ATTACKS, raidCreate, raidAddMember, raidExport, raidImport, raidEnd: endRaid, raidTap, raidAbility, raidMove, raidAnswer, raidStep, abilityCd, triviaTime,
  SPECIALS, specialOf, raidSpecial, interruptNeed, tapBase,
};
})(typeof window !== "undefined" ? window : globalThis);
