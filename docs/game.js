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
  raidHpPerMember: 220000,   // boss HP per squad member at level 1 (about 12 min for a good squad)
  raidLvlCurve: 0.6,        // boss level = squad strength from gear ^ this. Below 1, gear helps you climb the ladder; 0.85 makes gear barely help
  raidPerkWeight: 0.08,     // how much each gear perk counts towards squad strength
  raidToughWeight: 0.25,    // how much extra health from gear counts towards squad strength
  raidAtkEvery: 6,          // seconds between boss attacks (phase 1)
  raidTelegraph: 2,
  raidBossDmg: 15,          // a swipe at level 1
  raidRewardPerMember: 150, // Efforts per squad member per boss level, on a win
  raidRewardCurve: 1.25,    // rewards grow faster than difficulty: pool × level^1.25
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
  { id: "front", label: "Front", e: "🛡️", ability: "Shield Wall", abilityWhat: "Front row takes 60% less damage for 8s", mult: 1.15, aggro: 70 },
  { id: "mid", label: "Middle", e: "⚔️", ability: "Big Swing", abilityWhat: "Your next 8 taps hit 3× as hard", mult: 1.3, aggro: 25 },
  { id: "back", label: "Back", e: "🩹", ability: "Patch Up", abilityWhat: "Heal the most hurt teammate 35%", mult: 0.85, aggro: 5 },
];
const posOf = (id) => POSITIONS.find((p) => p.id === id) || POSITIONS[1];
function suggestedPosition(st) {
  const score = { front: st.guard * 2 + st.power * 0.5, mid: st.power + st.speed, back: st.brains + st.luck * 0.8 + st.speed * 0.3 };
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
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
  const rows = members.map((m) => ({ id: m.id, name: m.name, you: !!m.you, weekSteps: m.weekSteps || 0,
    stride: avg > 0 ? Math.round(clamp((m.weekSteps || 0) / avg, RULES.strideMin, RULES.strideMax) * 100) / 100 : 1, title: null }));
  rows.sort((a, b) => b.weekSteps - a.weekSteps);
  if (rows.length >= 2 && rows[0].weekSteps > rows[rows.length - 1].weekSteps) { rows[0].title = "top"; rows[rows.length - 1].title = "last"; }
  return { avg, rows };
}

// The ladder: beat a boss and next Sunday you face the next one. After the last, it loops with
// everything twice as tough (and twice as rich) each lap, so it never stops getting harder. hp/dmg/reward are multipliers; speed scales the gap between attacks.
const BOSSES = [
  { id: "notification", name: "Brett", title: "A slime. Doesn't go away", hp: 1, dmg: 1, speed: 1, reward: 1,
    attacks: { swipe: "Slap", stomp: "Belly Flop", scream: "Screech", feast: "Gorge" } },
  { id: "autoplay", name: "Rory", title: "All teeth, no manners", hp: 1.12, dmg: 1.05, speed: 0.97, reward: 1.4,
    attacks: { swipe: "Chomp", stomp: "Stampede", scream: "Spore Cloud", feast: "Gorge" } },
  { id: "leftonread", name: "Wisp", title: "Cold, quiet, always behind you", hp: 1.25, dmg: 1.1, speed: 0.94, reward: 1.9,
    attacks: { swipe: "Chill Touch", stomp: "Phase Slam", scream: "Wail", feast: "Drain" } },
  { id: "scroll", name: "Gale", title: "Never stops spinning", hp: 1.4, dmg: 1.16, speed: 0.91, reward: 2.5,
    attacks: { swipe: "Gust", stomp: "Downdraft", scream: "Howl", feast: "Siphon" } },
  { id: "kraken", name: "The Kraken", title: "Came up from somewhere deep", hp: 1.55, dmg: 1.22, speed: 0.88, reward: 3.2,
    attacks: { swipe: "Tentacle Lash", stomp: "Ink Slam", scream: "Deep Roar", feast: "Devour" } },
  { id: "algorithm", name: "Grimm", title: "Big, blue, and carrying a club", hp: 1.72, dmg: 1.3, speed: 0.85, reward: 4,
    attacks: { swipe: "Club Swing", stomp: "Ground Pound", scream: "War Cry", feast: "Feast" } },
  { id: "dragon", name: "Vex", title: "The last one. A dragon", hp: 1.9, dmg: 1.38, speed: 0.82, reward: 5,
    attacks: { swipe: "Claw", stomp: "Tail Slam", scream: "Fire Roar", feast: "Hoard" } },
];
// tier starts at 1. Tier 8 is Brett again on lap 2, and so on.
function bossFor(tier) {
  const t = Math.max(1, Math.floor(tier || 1)), lap = Math.floor((t - 1) / BOSSES.length), b = BOSSES[(t - 1) % BOSSES.length];
  const k = 2 ** lap, rk = (BOSSES[BOSSES.length - 1].reward * 1.1) ** lap; // lap 2 starts richer than the final boss of lap 1
  return { ...b, tier: t, lap: lap + 1, hp: b.hp * k, dmg: b.dmg * k ** 0.5, reward: b.reward * rk };
}
function raidCreate(members, { seed = Date.now(), minutes = RULES.raidMin, tier = 1 } = {}) {
  const r = rng(seed);
  const n = members.length;
  const table = weekTable(members);
  const ms = members.map((m) => {
    const { g, perks, points } = loadout(m.stats, m.equipped, m.inv);
    const maxHp = Math.round(80 + g.guard * 10);
    const row = table.rows.find((x) => x.id === m.id);
    return { ...m, g, perks, gearPts: points, weekSteps: row.weekSteps, stride: row.stride, title: row.title, pos: m.pos || suggestedPosition(m.stats), hp: maxHp, max: maxHp, alive: true, dmg: 0, healed: 0, taken: 0,
      cdUntil: 0, moveUntil: 0, stunUntil: 0, shieldUntil: 0, swing: 0, combo: 0, lastTap: -9, botNext: 0, secondWind: !!perks.secondWind };
  });
  // Boss level tracks how much stronger gear makes the squad than their bare stats (damage × toughness × perks),
  // so better gear never makes Sunday easier. Rewards grow faster than the level (see raidRewardCurve).
  const strength = ms.reduce((s, m) => {
    const dmg = (20 + m.g.power * 4) / (20 + m.stats.power * 4);
    const tough = (80 + m.g.guard * 10) / (80 + m.stats.guard * 10);
    // Rarer perks are stronger, so they count for more.
    const perkScore = Object.values(m.equipped || {}).reduce((t, id) => { const it = itemById(id); return t + (it && it.perk && !TAX_ONLY.has(it.perk[0]) ? PERK_WEIGHT[it.tier] || 1 : 0); }, 0);
    return s + dmg * tough ** RULES.raidToughWeight * (1 + RULES.raidPerkWeight * perkScore);
  }, 0) / Math.max(1, n);
  const lvl = Math.round(strength ** RULES.raidLvlCurve * 100) / 100;
  const def = bossFor(tier);
  // Shorter test raids get a proportionally smaller boss so the pacing feels the same.
  const max = Math.round(RULES.raidHpPerMember * n * lvl * def.hp * (minutes / 15));
  const R = {
    seed, r, t: 0, dur: minutes * 60, lvl, tier: def.tier, over: false, result: null,
    // Balanced for a squad of four; smaller squads take lighter hits. Short test raids pay proportionally less.
    sizeDmg: Math.min(1, 0.4 + 0.15 * n), timeShare: Math.min(1, minutes / 15),
    boss: { ...def, hp: max, max, phase: 1, next: null, feast: null, warned: false },
    members: ms, table, trivia: null, triviaRuns: 0, paralysed: false, log: [], fx: [], deepDive: 0,
  };
  scheduleAttack(R);
  return R;
}
const ATTACKS = {
  swipe: { label: "Strike", what: "one person, usually the front", e: "🫳" },
  stomp: { label: "Stomp", what: "front and middle rows", e: "🦶" },
  scream: { label: "Scream", what: "everyone", e: "📢" },
  feast: { label: "Feast", what: "hit it hard or it heals", e: "🍗" },
};
function scheduleAttack(R) {
  const B = R.boss;
  const every = RULES.raidAtkEvery * B.speed * (B.phase === 1 ? 1 : B.phase === 2 ? 0.85 : 0.65);
  const pool = B.phase === 1 ? ["swipe", "swipe", "swipe", "stomp", "scream"]
    : B.phase === 2 ? ["swipe", "swipe", "stomp", "stomp", "scream", "feast"]
    : ["swipe", "stomp", "scream", "scream", "feast"];
  const brains = Math.max(0, ...R.members.filter((m) => m.alive).map((m) => m.g.brains));
  B.next = { type: pick(R.r, pool), at: R.t + every, warnAt: R.t + every - RULES.raidTelegraph - brains * 0.05 };
  B.warned = false;
}
function swipeTarget(R) {
  const up = alive(R);
  if (!up.length) return null;
  // The week's lowest walker draws far more of the boss's attention.
  const weights = up.map((m) => posOf(m.pos).aggro * (m.pos === "front" && R.t < m.shieldUntil ? 1.3 : 1) * (m.title === "last" ? RULES.slackerAggro : 1));
  let x = R.r() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < up.length; i++) { x -= weights[i]; if (x <= 0) return up[i]; }
  return up[up.length - 1];
}
// Who an attack will hit, decided at the warning so the ground markers are honest.
function targetsOf(R, type) {
  const up = alive(R);
  if (type === "swipe") { const t = swipeTarget(R); return t ? [t.id] : []; }
  if (type === "stomp") { const rows = up.filter((m) => m.pos !== "back"); return (rows.length ? rows : up).map((m) => m.id); }
  if (type === "scream") return up.map((m) => m.id);
  return [];
}
const PERK_WEIGHT = { rare: 0.6, epic: 1, legendary: 1.6, mythic: 2.4 };
const TAX_ONLY = new Set(["taxStart", "steal"]);
const alive = (R) => R.members.filter((m) => m.alive);
const canAct = (R, m) => m.alive && R.t >= m.moveUntil && R.t >= m.stunUntil && !R.over;
// `you: true` marks the person playing on this screen, so the log reads "You raise" not "You raises".
const nm = (m) => (m.you ? "You" : m.name);
const vb = (m, them, you) => (m.you ? you : them);
const say = (R, text, kind = "") => { R.log.unshift({ t: R.t, text, kind }); R.log.length = Math.min(R.log.length, 30); };
const fx = (R, e) => R.fx.push(e);

function raidTap(R, id) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !canAct(R, m)) return null;
  m.combo = R.t - m.lastTap <= (RULES.comboWindowMs + m.g.speed * 12) / 1000 ? Math.min(RULES.comboMax, m.combo + 1 + (m.perks.combo || 0)) : 0;
  m.lastTap = R.t;
  const crit = R.r() < m.g.luck * 0.02 + (m.perks.critChance || 0);
  // Stride: walk more than the squad this week and every hit lands harder.
  let dmg = (20 + m.g.power * 4) * m.stride * posOf(m.pos).mult * (1 + m.combo / (RULES.comboMax * 2)) * (crit ? 2.5 + (m.perks.critDmg || 0) : 1);
  let swing = false;
  if (m.swing > 0) { dmg *= 3; m.swing--; swing = true; }
  if (R.boss.feast) { dmg *= m.perks.feast || 1; R.boss.feast.dealt += dmg; }
  R.boss.hp = Math.max(0, R.boss.hp - dmg);
  m.dmg += dmg;
  // Teammates' hits are shown too (a sample of them, so the screen isn't a blizzard).
  if (!m.you && (crit || swing || R.r() < 0.3)) fx(R, { type: "tap", id: m.id, crit, swing });
  if (m.perks.lifesteal && m.alive) m.hp = Math.min(m.max, m.hp + dmg * m.perks.lifesteal / 2.5); // damage numbers run ~10× health
  if (R.boss.hp <= 0) endRaid(R, "won");
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
    const hurt = alive(R).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (!hurt) return false;
    const heal = Math.min(hurt.max - hurt.hp, Math.round(hurt.max * (0.35 + (m.perks.heal || 0))));
    hurt.hp += heal; m.healed += heal;
    fx(R, { type: "heal", by: m.id, id: hurt.id, amt: heal });
    say(R, `${nm(m)} ${vb(m, "patches", "patch")} up ${hurt === m ? vb(m, "themself", "yourself") : nm(hurt).replace(/^You$/, "you")} (+${heal})`, "good");
  }
  m.cdUntil = R.t + abilityCd(m);
  return true;
}
function raidMove(R, id, pos) {
  const m = R.members.find((x) => x.id === id);
  if (!m || !m.alive || m.pos === pos || R.over) return false;
  m.pos = pos; m.moveUntil = R.t + Math.max(1.5, 4 - m.g.speed * 0.2); m.swing = 0;
  fx(R, { type: "move", id: m.id, pos });
  say(R, `${nm(m)} ${vb(m, "moves", "move")} to the ${posOf(pos).label.toLowerCase()}`);
  return true;
}

function hit(R, m, base) {
  if (!m.alive) return 0;
  if (m.perks.dodge && R.r() < m.perks.dodge) { fx(R, { type: "dodge", id: m.id }); return 0; }
  let d = base * R.boss.dmg * R.lvl ** 0.9 * R.sizeDmg * (1 - Math.min(0.6, m.g.guard * 0.02));
  if (R.t < m.shieldUntil) d *= 0.4;
  d = Math.round(d);
  m.hp -= d; m.taken += d;
  fx(R, { type: "hurt", id: m.id, amt: d });
  if (m.perks.thorns) { const back = d * m.perks.thorns * 10; R.boss.hp = Math.max(0, R.boss.hp - back); m.dmg += back; if (R.boss.hp <= 0) endRaid(R, "won"); }
  if (m.hp <= 0 && m.secondWind) { m.hp = 1; m.secondWind = false; fx(R, { type: "secondWind", id: m.id }); say(R, `${nm(m)} ${vb(m, "refuses", "refuse")} to die (Second Wind)`, "good"); return d; }
  if (m.hp <= 0) {
    m.hp = 0; m.alive = false; m.swing = 0;
    fx(R, { type: "down", id: m.id });
    say(R, `${nm(m)} ${vb(m, "is", "are")} down`, "bad");
    if (!R.trivia) startTrivia(R);
  }
  return d;
}
function bossAttack(R) {
  const B = R.boss, type = B.next.type, up = alive(R);
  const mult = B.phase === 1 ? 1 : B.phase === 2 ? 1.25 : 1.5;
  if (type === "swipe" && up.length) {
    // The one marked at the warning, unless they've died since.
    let target = up.find((m) => m.id === B.next.ids?.[0]) || swipeTarget(R);
    fx(R, { type: "attack", attack: "swipe", ids: [target.id] });
    const d = hit(R, target, RULES.raidBossDmg * mult);
    say(R, `${B.attacks.swipe} hits ${target.you ? "you" : target.name} for ${d}`, "bad");
  } else if (type === "stomp") {
    let rows = up.filter((m) => m.pos !== "back");
    if (!rows.length) rows = up; // nobody in front: the stomp reaches the back
    fx(R, { type: "attack", attack: "stomp", ids: rows.map((m) => m.id) });
    rows.forEach((m) => hit(R, m, RULES.raidBossDmg * 0.6 * mult));
    say(R, `${B.attacks.stomp} hits ${rows.length} of you`, "bad");
  } else if (type === "scream") {
    fx(R, { type: "attack", attack: "scream", ids: up.map((m) => m.id) });
    up.forEach((m) => hit(R, m, RULES.raidBossDmg * 0.45 * mult));
    say(R, `${B.attacks.scream} hits everyone`, "bad");
  } else if (type === "feast") {
    // The target scales with who's standing, so a small squad isn't punished for being small.
    const need = Math.round(up.length * 1100 * R.lvl * B.dmg);
    B.feast = { until: R.t + 6, need, dealt: 0 };
    fx(R, { type: "attack", attack: "feast", ids: [] });
    say(R, `${B.attacks.feast}. Deal ${need.toLocaleString("en-GB")} damage in 6s or it heals`, "warn");
  }
}

function triviaTime(m) { return RULES.triviaSeconds + Math.max(0, m.g.brains - 5) + (m.perks.trivia || 0); }
// Someone's down: every squad member (the fallen too) gets their own question. If 2/3 of the squad
// get theirs wrong, everyone is paralysed. Rare valid answers knock a slice off the boss either way.
function startTrivia(R) {
  R.triviaRuns++;
  const qs = triviaSet(R.seed + R.triviaRuns * 7919, R.members.length);
  const per = {}, botPlan = {};
  R.members.forEach((m, i) => {
    per[m.id] = { q: qs[i], secs: triviaTime(m), until: R.t + triviaTime(m), ans: null };
    if (m.bot) {
      const knows = R.r() < 0.45 + m.g.brains * 0.045;
      botPlan[m.id] = { at: R.t + 4 + R.r() * 16, text: knows ? qs[i].sample(R.r, R.r() < 0.75) : pick(R.r, ["uhh", "idk", "pass", "42", "the sun?"]) };
    }
  });
  R.trivia = { per, botPlan, started: R.t };
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
  if (phase !== B.phase) { B.phase = phase; fx(R, { type: "phase", phase }); say(R, phase === 2 ? "Phase 2: it hits harder and faster" : "Phase 3: it's enraged", "warn"); }
  if (B.feast && R.t >= B.feast.until) {
    if (B.feast.dealt < B.feast.need) { const heal = Math.round(B.max * 0.03); B.hp = Math.min(B.max, B.hp + heal); fx(R, { type: "feastEnd", healed: heal }); say(R, `It ate well. Healed ${heal.toLocaleString("en-GB")}`, "bad"); }
    else { fx(R, { type: "feastEnd", healed: 0 }); say(R, "Feast interrupted", "good"); }
    B.feast = null;
  }
  if (B.next && !B.warned && R.t >= B.next.warnAt) { B.warned = true; B.next.ids = targetsOf(R, B.next.type); fx(R, { type: "windup", attack: B.next.type, ids: B.next.ids }); }
  if (B.next && R.t >= B.next.at) { bossAttack(R); scheduleAttack(R); }
  if (R.reviveAt && R.t >= R.reviveAt) {
    R.reviveAt = 0;
    const back = R.members.filter((m) => !m.alive);
    back.forEach((m) => { m.alive = true; m.hp = Math.round(m.max * 0.2); });
    if (back.length) { fx(R, { type: "revive", ids: back.map((m) => m.id) }); say(R, "The fallen stagger back up", "good"); }
  }
  for (const m of R.members) if (m.bot) botAct(R, m);
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

root.Game = {
  DEFAULT_RULES, get RULES() { return RULES; }, setRules,
  hash, rng, effortsFromSteps, money, scrollBudget, overBudget, taxRate,
  xpFor, levelOf, levelProgress,
  pace, weekTable,
  STATS, STAT_TOTAL, stats, classOf, POSITIONS, posOf, suggestedPosition,
  SLOTS, itemById, tierOf, itemStats, upgradeCost, loadout, dealsFor, priceOf,
  taxmanSetup, taxmanStart, taxmanStep, taxmanTap, taxmanResult,
  norm, triviaSet, mathPrompt, listPrompt,
  BOSSES, bossFor, ATTACKS, raidCreate, raidTap, raidAbility, raidMove, raidAnswer, raidStep, abilityCd, triviaTime,
};
})(typeof window !== "undefined" ? window : globalThis);
