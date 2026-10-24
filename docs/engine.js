(() => {
"use strict";
// Effort game engine: turns raw daily steps + scroll data into points, par, form, levels, seasons and badges.
// Everything is derived from the data, so the rules can be tuned here without migrating anything.

const RULES = {
  // Raw daily Effort
  stepPtsPer100: 1,          // +1 per 100 steps…
  fullRateUntil: 15000,      // …up to 15k, then half rate…
  stepCap: 30000,            // …until 30k (blunts phone-shakers)
  budgetPer1000: 5,          // every 1,000 steps earns 5 free scroll minutes
  budgetCap: 60,
  overBudgetPerMin: -1,      // each minute past the budget costs 1
  overBudgetCap: -60,
  keptPerMin: 0.5,           // each unused budget minute is worth +0.5 (only when scrolling is tracked)
  keptCap: 30,
  assumedScrollMin: 30,      // days with steps but no scroll data assume 30 min
  autoMinutesPerOpen: 3,     // fallback when we only know app opens

  // Par (personal handicap)
  parWindow: 20, parFloorShare: 0.85, parFloorWeeks: 13,
  parMin: 25, placementPar: 60, placementDays: 3,
  formCap: 200, parDaysForStreakWeek: 4,

  // Progression
  rookieDays: 14, restedGap: 5, restedDays: 3, xpMult: 2,
  seasonWeeks: 6, seasonEpoch: "2026-10-19",
  leagueUp: 750, leagueDown: 450,
  leagueManualShare: 0.5,

  // Trail + boss
  landmarkEvery: 100,        // trail units between landmarks (~a day of decent walking)
  landmarksPerRegion: 10,
  fogFullAt: 300,            // over-budget scroll minutes in 7 days for full fog…
  fogSlow: 0.5,              // …which halves your walker's speed
  bossHpPer: 450,            // weekly boss HP per group member
  bossHealPerMin: 2,         // each over-budget scroll minute heals it by 2
};

const BIOMES = [
  { key: "meadow", land: null, nouns: ["Meadows", "Fields", "Downs"] },
  { key: "forest", land: "forest", nouns: ["Woods", "Thicket", "Grove"] },
  { key: "coast", land: "coast", nouns: ["Shore", "Cove", "Bay"] },
  { key: "mountains", land: "mountains", nouns: ["Peaks", "Ridge", "Pass"] },
  { key: "desert", land: "desert", nouns: ["Dunes", "Flats", "Mesa"] },
  { key: "tundra", land: "tundra", nouns: ["Drifts", "Glacier", "Tundra"] },
  { key: "city", land: "city", nouns: ["Rooftops", "Alleys", "Arcade"] },
  { key: "marsh", land: null, nouns: ["Marsh", "Fen", "Reeds"] },
];
const ADJ = ["Mossy", "Windy", "Golden", "Hidden", "Misty", "Sunny", "Crooked", "Quiet", "Bramble", "Lantern", "Pebble", "Cloudy", "Hollow", "Rusty", "Velvet", "Thistle"];
const SPOTS = ["Old Oak", "Wishing Well", "Rope Bridge", "Lighthouse", "Stone Circle", "Lookout", "Waterfall", "Tea Hut", "Signpost",
  "Abandoned Bus", "Giant Mushroom", "Fox Den", "Windmill", "Hot Spring", "Cave Mouth", "Lantern Post", "Picnic Rock", "Owl Tree"];
const GEAR_BY_RARITY = { 1: ["pine-cap", "party-hat", "scarf", "bandana", "shades", "specs"], 2: ["explorer", "medal", "pet-snail", "pet-bird", "balloon", "flag"], 3: ["crown", "monocle", "pet-shroom"], 4: ["halo"] };
const BOSS_NAMES = ["The Endless Feed", "Doomscroll Hydra", "The Algorithm", "Lord Swipe", "The Reel Beast", "Autoplay Wyrm", "Captain Notification", "The For You Fiend"];

// Landmark i on a player's trail, fixed by their seed so it never changes once reached.
function landmark(seed, i, firstBiome) {
  const regionIdx = Math.floor(i / RULES.landmarksPerRegion);
  const r = window.Walker ? window.Walker.rng(seed + i * 7919) : Math.random;
  const rr = window.Walker ? window.Walker.rng(seed + regionIdx * 104729) : Math.random;
  const biome = BIOMES[(firstBiome + regionIdx) % BIOMES.length];
  const region = `${ADJ[Math.floor(rr() * ADJ.length)]} ${biome.nouns[Math.floor(rr() * biome.nouns.length)]}`;
  let item = null;
  const roll = r();
  if (i > 0 && (i % 3 === 0 || roll < 0.15)) {
    const q = r();
    const rarity = q < 0.03 ? 4 : q < 0.15 ? 3 : q < 0.45 ? 2 : 1;
    const pool = GEAR_BY_RARITY[rarity];
    item = pool[Math.floor(r() * pool.length)];
  }
  return { i, name: SPOTS[Math.floor(r() * SPOTS.length)], region, biome: biome.key, item };
}

const TITLES = [[1, "Couch Potato"], [3, "Stroller"], [5, "Walker"], [8, "Hiker"], [12, "Trekker"], [16, "Ranger"],
  [20, "Explorer"], [25, "Pathfinder"], [30, "Legend"], [40, "Mythic"]];
const TIERS = [["Bronze", "🥉"], ["Silver", "🥈"], ["Gold", "🥇"], ["Platinum", "💠"], ["Diamond", "💎"]];

// ---------- dates ----------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
const weekStart = (s) => { const d = parseDay(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const localDay = (ts) => iso(new Date(ts));

const xpForLevel = (L) => 150 * L * (L - 1) / 2; // XP needed to *reach* level L
function levelInfo(xp) {
  let L = 1;
  while (xp >= xpForLevel(L + 1)) L++;
  const from = xpForLevel(L), to = xpForLevel(L + 1);
  const title = TITLES.filter(([l]) => L >= l).pop()[1];
  const next = TITLES.find(([l]) => l > L);
  return { level: L, title, xp, into: xp - from, need: to - from, nextTitle: next && { level: next[0], title: next[1] } };
}

function seasonOf(day) {
  const w = Math.floor(daysBetween(RULES.seasonEpoch, weekStart(day)) / 7);
  if (w < 0) return { n: 0, start: "0000-01-01", end: addDays(RULES.seasonEpoch, -1), name: "Preseason" };
  const n = Math.floor(w / RULES.seasonWeeks) + 1;
  const start = addDays(RULES.seasonEpoch, (n - 1) * RULES.seasonWeeks * 7);
  return { n, start, end: addDays(start, RULES.seasonWeeks * 7 - 1), name: `Season ${n}` };
}

/**
 * build({ players, steps, scroll, today, league }) → engine
 * players: [{id, created_at, joined_at, daily_goal, scroll_source, ...}]
 * steps:   [{p, d, s, src}]   scroll: [{p, d, o, m, am}]
 */
function build({ players, steps, scroll, today, league = false }) {
  const stepMap = new Map(), scrollMap = new Map(), firstAuto = new Map(), firstScroll = new Map();
  for (const r of steps) {
    if (!stepMap.has(r.p)) stepMap.set(r.p, new Map());
    stepMap.get(r.p).set(r.d, r);
  }
  for (const r of scroll) {
    if (!scrollMap.has(r.p)) scrollMap.set(r.p, new Map());
    scrollMap.get(r.p).set(r.d, r);
    if ((r.o > 0 || r.am != null) && (!firstAuto.has(r.p) || r.d < firstAuto.get(r.p))) firstAuto.set(r.p, r.d);
    if (!firstScroll.has(r.p) || r.d < firstScroll.get(r.p)) firstScroll.set(r.p, r.d);
  }
  const byId = new Map(players.map((p) => [p.id, p]));
  const startDay = (p) => localDay(p.created_at);
  const memo = new Map();
  const cache = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };

  function stepsOn(pid, d) {
    const r = stepMap.get(pid)?.get(d);
    if (!r) return { steps: 0, src: null };
    const share = league && r.src === "manual" ? RULES.leagueManualShare : 1;
    return { steps: Math.round(r.s * share), src: r.src };
  }

  function scrollOn(pid, d, active) {
    const r = scrollMap.get(pid)?.get(d);
    if (r && r.m != null) return { min: r.m, src: "reported", opens: r.o };
    if (r && r.am != null) return { min: r.am, src: "auto", opens: r.o };
    if (r && r.o > 0) return { min: r.o * RULES.autoMinutesPerOpen, src: "auto", opens: r.o };
    if (firstAuto.has(pid) && d >= firstAuto.get(pid)) return { min: 0, src: "auto", opens: 0 };
    if (!active) return { min: 0, src: "none", opens: 0 };
    return { min: RULES.assumedScrollMin, src: "assumed", opens: 0 };
  }

  // Raw daily Effort with its breakdown.
  function day(pid, d) {
    return cache(`d|${pid}|${d}`, () => {
      const { steps: s, src } = stepsOn(pid, d);
      const tracked = scrollMap.get(pid)?.has(d) || (firstAuto.has(pid) && d >= firstAuto.get(pid));
      const active = s > 0 || tracked;
      const capped = Math.min(s, RULES.stepCap);
      const stepPts = Math.min(capped, RULES.fullRateUntil) / 100 * RULES.stepPtsPer100
        + Math.max(0, capped - RULES.fullRateUntil) / 100 * RULES.stepPtsPer100 / 2;
      const sc = scrollOn(pid, d, active);
      const budget = Math.min(RULES.budgetCap, Math.floor(s / 1000) * RULES.budgetPer1000);
      let scrollPts = 0;
      if (sc.src !== "none") {
        if (sc.min > budget) scrollPts = Math.max(RULES.overBudgetCap, (sc.min - budget) * RULES.overBudgetPerMin);
        else if (sc.src !== "assumed") scrollPts = Math.min(RULES.keptCap, (budget - sc.min) * RULES.keptPerMin);
      }
      return {
        d, active, steps: s, stepsSrc: src, stepPts: Math.round(stepPts),
        scrollMin: sc.min, scrollSrc: sc.src, opens: sc.opens, budget, scrollPts: Math.round(scrollPts),
        reels: Math.round(sc.min * 3),
        total: Math.round(stepPts + scrollPts),
      };
    });
  }

  function activeDaysBefore(pid, d, n) {
    const out = [];
    const start = startDay(byId.get(pid));
    for (let x = addDays(d, -1); x >= start && out.length < n; x = addDays(x, -1)) {
      const r = day(pid, x);
      if (r.active) out.push(r.total);
    }
    return out;
  }

  // Par is your average day, frozen for a whole week: the mean of your last 20 active days minus the
  // single best and worst, never dropping below 85% of your highest par in the last quarter (stops sandbagging).
  function par(pid, d) {
    const ws = weekStart(d);
    return cache(`par|${pid}|${ws}`, () => {
      const p = byId.get(pid);
      if (!p || ws < weekStart(startDay(p))) return { value: RULES.placementPar, placement: true };
      const hist = activeDaysBefore(pid, ws, RULES.parWindow);
      if (hist.length < RULES.placementDays) return { value: RULES.placementPar, placement: true };
      const sorted = hist.sort((a, b) => b - a);
      const trimmed = sorted.length > 4 ? sorted.slice(1, -1) : sorted;
      let value = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      let floor = 0;
      for (let k = 1; k <= RULES.parFloorWeeks; k++) {
        const prev = addDays(ws, -7 * k);
        if (prev < weekStart(startDay(p))) break;
        const pp = par(pid, prev);
        if (!pp.placement) floor = Math.max(floor, pp.value * RULES.parFloorShare);
      }
      value = Math.max(RULES.parMin, value, floor);
      return { value: Math.round(value), placement: false };
    });
  }

  const form = (pid, d) => {
    const r = day(pid, d);
    if (!r.active) return 0;
    return Math.max(0, Math.min(RULES.formCap, Math.round((100 * r.total) / par(pid, d).value)));
  };

  function week(pid, ws) {
    return cache(`w|${pid}|${ws}`, () => {
      let formSum = 0, raw = 0, atPar = 0, stepsSum = 0, scrollMin = 0;
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        if (d > today) { days.push(null); continue; }
        const f = form(pid, d), r = day(pid, d);
        formSum += f; raw += r.total; stepsSum += r.steps; scrollMin += r.scrollSrc === "assumed" ? 0 : r.scrollMin;
        if (f >= 100) atPar++;
        days.push({ d, form: f, atPar: f >= 100, active: r.active });
      }
      return { ws, form: formSum, raw, atPar, steps: stepsSum, scrollMin, days, par: par(pid, ws) };
    });
  }

  // Weekly streak: a week counts when you hit par on 4+ days. Every 4 kept weeks earns a freeze (max 2).
  function streak(pid) {
    return cache(`streak|${pid}`, () => {
      const p = byId.get(pid);
      let ws = weekStart(startDay(p)), cur = 0, best = 0, freezes = 0, kept = 0, used = 0;
      const thisWs = weekStart(today);
      for (; ws < thisWs; ws = addDays(ws, 7)) {
        const w = week(pid, ws);
        if (w.atPar >= RULES.parDaysForStreakWeek) {
          cur++; kept++;
          if (kept % 4 === 0) freezes = Math.min(2, freezes + 1);
        } else if (freezes > 0 && cur > 0) { freezes--; used++; }
        else cur = 0;
        best = Math.max(best, cur);
      }
      const now = week(pid, thisWs);
      const thisWeekDone = now.atPar >= RULES.parDaysForStreakWeek;
      return { weeks: cur + (thisWeekDone ? 1 : 0), best: Math.max(best, cur + (thisWeekDone ? 1 : 0)), freezes, used, thisWeek: now.atPar, thisWeekDone };
    });
  }

  // Lifetime XP: positive days only (you never lose levels), 2x during your first 14 days and for
  // 3 active days after a 5+ day break ("rested").
  function xp(pid) {
    return cache(`xp|${pid}`, () => {
      const p = byId.get(pid);
      const start = startDay(p);
      let total = 0, lastActive = null, restedLeft = 0;
      const days = [...(stepMap.get(pid)?.keys() ?? []), ...(scrollMap.get(pid)?.keys() ?? [])];
      const uniq = [...new Set(days)].filter((d) => d >= start && d <= today).sort();
      for (const d of uniq) {
        const r = day(pid, d);
        if (!r.active) continue;
        if (lastActive && daysBetween(lastActive, d) >= RULES.restedGap) restedLeft = RULES.restedDays;
        const rookie = daysBetween(start, d) < RULES.rookieDays;
        const mult = rookie || restedLeft > 0 ? RULES.xpMult : 1;
        if (!rookie && restedLeft > 0) restedLeft--;
        total += Math.max(0, r.total) * mult;
        lastActive = d;
      }
      const rookieLeft = Math.max(0, RULES.rookieDays - daysBetween(start, today));
      const rested = lastActive && daysBetween(lastActive, today) >= RULES.restedGap;
      return { ...levelInfo(Math.round(total)), rookieLeft, rested: rested || restedLeft > 0 };
    });
  }

  const seasonScore = (pid, s) => {
    let sum = 0;
    for (let ws = s.start; ws <= s.end && ws <= today; ws = addDays(ws, 7)) sum += week(pid, ws).form;
    return sum;
  };

  // Group-level helpers --------------------------------------------------------------
  const ids = players.map((p) => p.id);
  const eligible = (pid, ws) => !par(pid, ws).placement;

  function rivals(ws) {
    return cache(`rivals|${ws}`, () => {
      const pool = ids.filter((id) => startDay(byId.get(id)) <= addDays(ws, 6))
        .sort((a, b) => par(a, ws).value - par(b, ws).value || a.localeCompare(b));
      const map = new Map();
      for (let i = 0; i + 1 < pool.length; i += 2) { map.set(pool[i], pool[i + 1]); map.set(pool[i + 1], pool[i]); }
      if (pool.length % 2 === 1 && pool.length >= 3) map.set(pool[pool.length - 1], pool[pool.length - 2]);
      return map;
    });
  }

  function legend() {
    return cache("legend", () => {
      if (ids.length < 2) return null;
      let best = null;
      for (const id of ids) {
        let n = 0, f = 0;
        for (let i = 0; i < 30; i++) { const d = addDays(today, -i); const x = form(id, d); if (x >= 100) n++; f += x; }
        if (n > 0 && (!best || n > best.n || (n === best.n && f > best.f))) best = { id, n, f };
      }
      return best;
    });
  }

  function seasonResults(s) {
    return cache(`season|${s.n}`, () => ids
      .filter((id) => startDay(byId.get(id)) <= s.end)
      .map((id) => ({ id, score: seasonScore(id, s) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score));
  }

  function trophies(pid) {
    const out = [];
    const first = players.reduce((a, p) => (startDay(p) < a ? startDay(p) : a), today);
    for (let s = seasonOf(first); s.end < today; s = seasonOf(addDays(s.end, 1))) {
      if (s.n === 0) continue;
      const res = seasonResults(s);
      const place = res.findIndex((r) => r.id === pid);
      if (res.length >= 2 && place >= 0 && place < 3) out.push({ season: s.n, place: place + 1 });
    }
    return out;
  }

  // Public league tier, recomputed week by week from the data we have: start Bronze, move up after a
  // week of 750+ form (beating your average most days), down after one under 450.
  function tier(pid) {
    return cache(`tier|${pid}`, () => {
      const p = byId.get(pid);
      let t = 0;
      for (let ws = weekStart(startDay(p)); ws < weekStart(today); ws = addDays(ws, 7)) {
        const f = week(pid, ws).form;
        if (f >= RULES.leagueUp) t = Math.min(TIERS.length - 1, t + 1);
        else if (f < RULES.leagueDown) t = Math.max(0, t - 1);
      }
      return { i: t, name: TIERS[t][0], icon: TIERS[t][1] };
    });
  }

  function rivalWins(pid) {
    let wins = 0;
    for (let ws = weekStart(startDay(byId.get(pid))); ws < weekStart(today); ws = addDays(ws, 7)) {
      const r = rivals(ws).get(pid);
      if (r && week(pid, ws).form > week(r, ws).form) wins++;
    }
    return wins;
  }

  function badges(pid) {
    const p = byId.get(pid);
    const start = startDay(p);
    let maxDay = 0, total = 0, perfect = false, cleanDays = 0, cleanRun = 0, bestCleanRun = 0, budgetDays = 0, onPar = false, bestWeekSteps = 0;
    for (let d = start; d <= today; d = addDays(d, 1)) {
      const r = day(pid, d);
      maxDay = Math.max(maxDay, r.steps); total += r.steps;
      const tracked = r.scrollSrc === "auto" || r.scrollSrc === "reported";
      if (tracked && r.scrollMin <= 5) { cleanDays++; cleanRun++; bestCleanRun = Math.max(bestCleanRun, cleanRun); } else cleanRun = 0;
      if (tracked && r.scrollMin <= r.budget && r.active) budgetDays++;
      if (form(pid, d) >= 100 && !par(pid, d).placement) onPar = true;
      if (d === weekStart(d)) {
        const w = week(pid, d);
        if (w.days.every((x) => x && x.atPar)) perfect = true;
        bestWeekSteps = Math.max(bestWeekSteps, w.steps);
      }
    }
    const st = streak(pid), lv = xp(pid), lg = legend();
    const placementDone = !par(pid, today).placement;
    const founder = seasonOf(start).n <= 1;
    const wins = rivalWins(pid);
    return [
      { e: "👟", n: "First Steps", d: "Log your first day", ok: total > 0 },
      { e: "📏", n: "Par Set", d: "Finish placement", ok: placementDone },
      { e: "🎯", n: "On Par", d: "Beat your par", ok: onPar },
      { e: "⭐", n: "Perfect Week", d: "Par all 7 days", ok: perfect },
      { e: "🔥", n: "Habit", d: "4-week streak", ok: st.best >= 4 },
      { e: "☄️", n: "Unstoppable", d: "12-week streak", ok: st.best >= 12 },
      { e: "🚀", n: "20K Day", d: "20,000 in a day", ok: maxDay >= 20000 },
      { e: "🏃", n: "Marathoner", d: "42 km in a week", ok: bestWeekSteps >= 55400 },
      { e: "🌍", n: "Million Club", d: "1M lifetime steps", ok: total >= 1000000 },
      { e: "📵", n: "Scroll Dodger", d: "A day under 5 min", ok: cleanDays > 0 },
      { e: "🧘", n: "Detox Week", d: "7 clean days in a row", ok: bestCleanRun >= 7 },
      { e: "💰", n: "On Budget", d: "14 days in budget", ok: budgetDays >= 14 },
      { e: "⚔️", n: "Rival Slayer", d: wins ? `Won ${wins} rival week${wins > 1 ? "s" : ""}` : "Win 3 rival weeks", ok: wins >= 3 },
      { e: "👑", n: "Local Legend", d: "Hold the crown", ok: lg?.id === pid },
      { e: "🔟", n: "Level 10", d: "Reach level 10", ok: lv.level >= 10 },
      { e: "🌱", n: "Founder", d: "Joined in Season 1", ok: founder },
    ];
  }

  // ---------- The trail (personal game) ----------
  // Each day's positive effort is fuel. Fuel moves your walker along an endless trail, but fog from the last
  // 7 days of over-budget scrolling slows it down (up to half speed). A landmark every 100 trail units, a new
  // region every 10 landmarks, and some landmarks drop gear.
  const overBudget = (r) => (r.scrollSrc === "none" ? 0 : Math.max(0, r.scrollMin - r.budget));
  function fogOn(pid, d) {
    let m = 0;
    for (let i = 0; i < 7; i++) m += overBudget(day(pid, addDays(d, -i)));
    return Math.min(1, m / RULES.fogFullAt);
  }

  function trail(pid) {
    return cache(`trail|${pid}`, () => {
      const p = byId.get(pid);
      const start = startDay(p);
      let dist = 0, todayDist = 0;
      for (let d = start; d <= today; d = addDays(d, 1)) {
        const r = day(pid, d);
        const step = Math.max(0, r.total) * (1 - RULES.fogSlow * fogOn(pid, d));
        dist += step;
        if (d === today) todayDist = step;
      }
      const seed = window.Walker ? window.Walker.hash(String(pid)) : 1;
      const firstBiome = Math.max(0, BIOMES.findIndex((b) => b.land === p.character?.land));
      const count = Math.floor(dist / RULES.landmarkEvery);
      const marks = [];
      for (let i = 0; i < count + 1; i++) marks.push(landmark(seed, i, firstBiome));
      const items = [...new Set(marks.slice(0, count).map((m) => m.item).filter(Boolean))];
      return {
        dist: Math.round(dist), todayDist: Math.round(todayDist), fog: fogOn(pid, today),
        reached: count, into: dist - count * RULES.landmarkEvery, next: marks[count],
        recent: marks.slice(Math.max(0, count - 8), count).reverse(), items,
        region: marks[count].region, biome: marks[count].biome,
      };
    });
  }

  // ---------- The Scroll (weekly group boss) ----------
  // HP scales with the group. Everyone's step points hit it; everyone's over-budget scroll minutes heal it.
  function boss(ws) {
    return cache(`boss|${ws}`, () => {
      const members = ids.filter((id) => startDay(byId.get(id)) <= addDays(ws, 6));
      const hp = RULES.bossHpPer * Math.max(1, members.length);
      let left = hp, defeatedOn = null;
      const hits = new Map(), heals = new Map();
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        if (d > today) break;
        for (const id of members) {
          const r = day(id, d);
          const dmg = r.stepPts, heal = overBudget(r) * RULES.bossHealPerMin;
          hits.set(id, (hits.get(id) || 0) + dmg); heals.set(id, (heals.get(id) || 0) + heal);
          if (!defeatedOn) left = left - dmg + heal;
        }
        if (!defeatedOn && left <= 0) defeatedOn = d;
      }
      left = Math.max(0, Math.min(hp * 1.5, left));
      const top = (m) => [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
      const n = Math.floor(daysBetween(RULES.seasonEpoch, ws) / 7);
      return { ws, hp, left, pct: left / hp, defeatedOn, name: BOSS_NAMES[((n % BOSS_NAMES.length) + BOSS_NAMES.length) % BOSS_NAMES.length], hitter: top(hits), healer: top(heals), members: members.length };
    });
  }

  function bossWins() {
    let wins = 0;
    const first = players.reduce((a, p) => (startDay(p) < a ? startDay(p) : a), today);
    for (let ws = weekStart(first); ws < weekStart(today); ws = addDays(ws, 7)) if (boss(ws).defeatedOn) wins++;
    return wins;
  }

  return { RULES, ids, byId, day, par, form, week, streak, xp, seasonScore, seasonResults, rivals, legend, trophies, tier, badges, eligible, trail, fogOn, boss, bossWins };
}

window.Effort = { build, RULES, TIERS, levelInfo, seasonOf, weekStart, addDays, parseDay, iso, daysBetween };
})();
