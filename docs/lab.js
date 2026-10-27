// Effort Lab: the playtest build of the new game. Everything runs on this device against bots;
// nothing here touches real players, steps or groups.
(() => {
const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const G = Game, I = EffortItems;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("en-GB");
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const today = () => new Date().toISOString().slice(0, 10);
const PER_E = () => G.RULES.effortsPerEndeavour;

// ---------- art helpers ----------
// Icons come from icons.js; if it hasn't loaded, a neutral dot keeps layouts intact.
const ic = (n) => { const s = window.Icons?.ui?.(n); return s ? s.replace("<svg", '<svg class="ic" aria-hidden="true"') : '<span class="ic" aria-hidden="true">•</span>'; };
const coin = (sz = 20) => window.Icons?.coin?.(sz) || `<i class="cdot coin" style="width:${sz}px;height:${sz}px"></i>`;
const gem = (sz = 20) => window.Icons?.gem?.(sz) || `<i class="cdot gem" style="width:${sz}px;height:${sz}px"></i>`;
const itemArt = (item) => window.Icons?.item?.(item, 64) || `<span>${item.e}</span>`;
const STAT_LOOK = { power: ["power", "#ff6a3d"], guard: ["guard", "#3a9cf0"], speed: ["speed", "#4fd67f"], brains: ["brains", "#a86bff"], luck: ["luck", "#ffc83d"] };
const ROW_ICON = { front: "shieldWall", mid: "bigSwing", back: "patchUp" };
// Prices are whole Endeavours; rewards are counted in Efforts.
const gems = (efforts) => Math.floor(efforts / PER_E());
const priceTag = (efforts) => `<span class="price">${gem(18)}${fmt(efforts / PER_E())}</span>`;
const effortTag = (n) => `${coin(18)}${fmt(n)}`;

// ---------- saved lab state ----------
const KEY = "ef_lab";
const fresh = () => ({
  v: 3, answers: Walker.fallbackAnswers("lab-" + Math.floor(Math.random() * 1e9)), name: "You", fromApp: false,
  wallet: 1500, xp: 0, inv: {}, equipped: {}, steps: 9000, scroll: 25, debt: 0,
  bots: 3, botGear: "some", raidMin: 15, pos: null, rules: {}, history: [], shopTab: "class", tier: 1, no3d: false,
});
let L;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  // v2 saves carry over (same shape); anything older starts fresh but keeps tuned numbers.
  L = saved.v === 3 || saved.v === 2 ? { ...fresh(), ...saved, v: 3 } : { ...fresh(), rules: saved.rules || {} };
} catch { L = fresh(); }
// Drop equipped/owned ids that no longer exist in the catalogue.
for (const [slot, id] of Object.entries(L.equipped)) if (!G.itemById(id)) delete L.equipped[slot];
for (const id of Object.keys(L.inv)) if (!G.itemById(id)) delete L.inv[id];
L.bots = Math.min(5, Math.max(1, L.bots | 0)); // raids are a squad fight: at least one teammate
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch { /* private mode: still works this session */ } };
G.setRules(L.rules);

const V = { tab: "daily", view: "main", tax: null, raid: null, result: null };
// lab.html?tab=shop (or raid, tune) opens straight onto that tab.
{ const t = new URLSearchParams(location.search).get("tab"); if (["daily", "raid", "shop", "tune"].includes(t)) V.tab = t; }

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- derived ----------
const myStats = () => G.stats(L.answers);
const myClass = () => G.classOf(myStats());
const effectiveSteps = () => Math.max(0, L.steps - L.debt);
const level = () => G.levelOf(L.xp);
function addHistory(text, delta, kind = "") { L.history.unshift({ text, delta, kind, at: Date.now() }); L.history.length = Math.min(L.history.length, 12); }
// Returns how many levels were gained.
function gainXp(n) { const before = level(); L.xp += Math.max(0, Math.round(n)); return level() - before; }
const taxSetup = () => G.taxmanSetup({ steps: effectiveSteps(), scrollMin: L.scroll, stats: myStats(), equipped: L.equipped, inv: L.inv, level: level() });

const PERKS = {
  critChance: (v) => `+${Math.round(v * 100)}% critical hit chance`,
  critDmg: (v) => `Critical hits deal +${v}× damage`,
  combo: (v) => `Combos build ${Math.round(v * 100)}% faster`,
  taxStart: (v) => `Start every Taxman fight on a ${v}-hit combo`,
  steal: (v) => `Steal up to ${Math.round(v * 100)}% more from the Taxman`,
  shield: (v) => `Shield Wall lasts ${v}s longer`,
  heal: (v) => `Patch Up heals ${Math.round(v * 100)}% more`,
  swing: (v) => `Big Swing lasts ${v} more hits`,
  thorns: (v) => `Hits you take deal ${Math.round(v * 10)}× their damage back to the boss`,
  lifesteal: (v) => `Every hit heals you about ${Math.max(1, Math.round(v * 18))} HP`,
  cdr: (v) => `Abilities recharge ${Math.round(v * 100)}% faster`,
  trivia: (v) => `+${v}s on trivia questions`,
  secondWind: () => "Survive one killing blow each raid",
  feast: (v) => `×${v} damage while the boss is feasting`,
  dodge: (v) => `${Math.round(v * 100)}% chance to dodge a hit`,
  loot: (v) => `+${Math.round(v * 100)}% raid rewards`,
};
const perkText = (p) => (p ? PERKS[p[0]]?.(p[1]) || "" : "");
const statLabel = (k) => G.STATS.find((s) => s.id === k)?.label || k;

// ---------- portraits (rendered from the 3D models) ----------
const portraitImg = (kind, id, { w = 256, h = 256, frame = "full", cls = "" } = {}) =>
  `<img class="pimg ${cls}" data-portrait="${kind}:${id}" data-w="${w}" data-h="${h}" data-frame="${frame}" alt="" width="${w}" height="${h}">`;
function hydratePortraits() {
  if (!window.Arena3D?.portrait || !Arena3D.supported()) return;
  for (const img of document.querySelectorAll("img[data-portrait]:not([data-done])")) {
    img.dataset.done = "1";
    const [kind, id] = img.dataset.portrait.split(":");
    Arena3D.portrait(kind, id, kind === "walker" ? L.answers : null, { w: +img.dataset.w, h: +img.dataset.h, frame: img.dataset.frame })
      .then((url) => { if (url) { img.src = url; img.classList.add("in"); img.closest(".has-fallback")?.classList.add("loaded"); } });
  }
}
window.addEventListener("arena3d-ready", hydratePortraits);
const head2d = (answers) => Walker.svg(answers, { crop: "head", mood: "fresh" });

// ---------- shell ----------
function render() {
  if (V.view === "tax") return renderTax();
  if (V.view === "raid") return renderRaid();
  if (V.view === "result") return renderResult();
  const tabs = { daily: tabDaily, raid: tabRaid, shop: tabShop, tune: tabTune };
  const p = G.levelProgress(L.xp), cls = myClass();
  $("#app").innerHTML = `
    <header class="header">
      <div class="avatar"><div class="face has-fallback"><span class="fb">${head2d(L.answers)}</span>${portraitImg("walker", L.fromApp ? "app" : "lab" + G.hash(JSON.stringify(L.answers)), { w: 112, h: 112, frame: "head" })}</div><span class="lvl" title="Level">${p.lvl}</span></div>
      <div class="who"><b>${esc(L.name)}</b><div class="cls">${esc(cls.name)} · <span class="faint">${fmt(p.into)}/${fmt(p.need)} XP</span></div><div class="xp"><i style="width:${p.pct * 100}%"></i></div></div>
      <div class="wallet"><span class="cur" title="Endeavours"><span class="cico">${gem()}</span>${fmt(gems(L.wallet))}</span><span class="cur" title="Efforts"><span class="cico">${coin()}</span>${L.wallet % PER_E()}</span></div>
      <button class="iconbtn" data-act="mute" aria-label="${FX.muted ? "Turn sound on" : "Turn sound off"}">${ic(FX.muted ? "soundOff" : "soundOn")}</button>
    </header>
    <div class="stack">${tabs[V.tab]()}</div>
    <nav class="dock"><div class="inner">${[["daily", "Daily", "sword"], ["raid", "Raid", "raid"], ["shop", "Shop", "bag"], ["tune", "Tuning", "sliders"]].map(([k, l, i]) =>
      `<button data-tab="${k}" ${V.tab === k ? 'aria-current="page"' : ""}>${ic(i)}${l}</button>`).join("")}</div></nav>`;
  hydratePortraits();
  syncSliders();
}

// ---------- Daily ----------
function dayTiles() {
  const S = taxSetup(), stake = Math.round(S.efforts * S.taxRate);
  return `<div class="tiles">
      <div class="tile gold"><div class="k">${ic("coin")} Earned today</div><div class="v">${effortTag(S.efforts)}</div></div>
      <div class="tile red"><div class="k">${ic("warning")} At stake</div><div class="v">${Math.round(S.taxRate * 100)}%<small>${stake} Efforts</small></div></div>
      <div class="tile"><div class="k">${ic("heart")} Taxman health</div><div class="v num">${fmt(S.hp)}</div></div>
      <div class="tile cyan"><div class="k">${ic("phone")} Scroll budget</div><div class="v">${G.scrollBudget(effectiveSteps())}<small>min</small></div></div>
    </div>
    ${L.debt ? `<div class="chip red" style="margin-top:10px">${ic("bolt")} Paralysed: −${fmt(L.debt)} steps today</div>` : ""}`;
}
function tabDaily() {
  const S = taxSetup();
  return `
    <section class="panel hero">
      <div class="art"><div class="bg" style="background:radial-gradient(90% 120% at 80% 100%, #3f8a5e 0%, #1c4030 45%, #0f2219 100%)"></div>
        <div class="label"><span class="chip gold">${ic("clock")} Tonight · 7pm</span><h3 class="ol">The Taxman</h3><p>Wants ${Math.round(S.taxRate * 100)}% of today's Efforts. Knock him out to keep it all, then rob him.</p></div>
        <div class="portrait">${portraitImg("boss", "taxman", { w: 300, h: 320 })}</div></div>
      <div class="body">
        <div id="day-tiles">${dayTiles()}</div>
        <button class="btn gold xl block" style="margin-top:14px" data-act="tax" data-sec="${G.RULES.dailyWindowMin * 60}">${ic("sword")} Fight</button>
        <div class="btn-row" style="margin-top:10px"><button class="btn sm" data-act="tax" data-sec="60">${ic("timer")} 1-min test</button><button class="btn sm red" data-act="skip-tax">Pay and skip</button></div>
      </div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("steps")}</span><h2 class="ol-sm">Your day</h2><span class="side chip">Playtest</span></div>
      <div class="slider"><div class="row"><label for="steps">${ic("steps")} Steps</label><output id="o-steps">${fmt(L.steps)}</output></div>
        <input id="steps" type="range" min="0" max="30000" step="500" value="${L.steps}" data-input="steps" aria-label="Steps today"></div>
      <div class="slider" style="margin-bottom:0"><div class="row"><label for="scroll">${ic("phone")} Short-video scrolling</label><output id="o-scroll">${L.scroll}<small class="faint" style="font:600 12px var(--ui)"> min</small></output></div>
        <input id="scroll" type="range" min="0" max="180" step="5" value="${L.scroll}" data-input="scroll" aria-label="Minutes of scrolling"></div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("info")}</span><h2 class="ol-sm">How it works</h2></div>
      <div class="how">
        <div class="hrow"><span class="hic">${ic("coin")}</span><div><b>Walk to earn</b><span>Every ${fmt(G.RULES.stepsPerEffort)} steps is 1 Effort. ${PER_E()} Efforts make 1 Endeavour. More steps also make you hit harder tonight.</span></div></div>
        <div class="hrow"><span class="hic">${ic("warning")}</span><div><b>The Taxman calls at 7pm</b><span>He takes ${Math.round(G.RULES.baseTax * 100)}% of the day's Efforts. Scrolling over your budget pushes it towards ${Math.round((G.RULES.baseTax + G.RULES.taxMaxExtra) * 100)}%.</span></div></div>
        <div class="hrow"><span class="hic">${ic("sword")}</span><div><b>Tap to fight back</b><span>${G.RULES.dailyWindowMin} minutes. Every hit cuts the tax; knock him out and you keep everything. Keep tapping to steal up to ${Math.round(S.stealCap * 100)}% extra. Stop and he heals.</span></div></div>
        <div class="hrow"><span class="hic">${ic("target")}</span><div><b>Audits and receipts</b><span>About every ${G.RULES.auditEvery + G.RULES.auditFor}s he Audits you: only the moving target takes damage. Golden receipts knock off 3% of his health, or add 1% to your haul once he's down.</span></div></div>
      </div>
    </section>
    ${L.history.length ? `<section class="panel flat"><div class="ptitle"><h2 class="ol-sm">Recent</h2></div><div class="feedlist">${L.history.map((h) => `<div class="it"><span class="grow">${esc(h.text)}</span><span class="amt ${h.delta >= 0 ? "plus" : "minus"}">${h.delta >= 0 ? "+" : "−"}${coin(16)}${fmt(Math.abs(h.delta))}</span></div>`).join("")}</div></section>` : ""}`;
}
function syncSliders() {
  for (const el of document.querySelectorAll("input[type=range]")) el.style.setProperty("--p", `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
}

// ---------- Raid ----------
function statRows(st) {
  const { g } = G.loadout(st, L.equipped, L.inv);
  const max = Math.max(20, ...Object.values(g));
  return G.STATS.map((s) => {
    const [icon, col] = STAT_LOOK[s.id];
    return `<div class="stat" title="${esc(s.what)}"><span class="sic" style="background:${col}">${ic(icon)}</span><span class="sn">${s.label}</span>
      <div class="bar"><i class="base" style="--sc:${col};width:${(st[s.id] / max) * 100}%"></i><i class="gear" style="width:${((g[s.id] - st[s.id]) / max) * 100}%"></i></div><span class="sv">${+g[s.id].toFixed(1)}</span></div>`;
  }).join("");
}
function botKit(cls, kind) {
  if (kind === "none") return {};
  if (kind === "some") return { weapon: "tin-bag", armour: "bin-lid-buckler" };
  const mine = I.ITEMS.filter((i) => i.cls === cls && i.tier === "legendary");
  return Object.fromEntries(mine.map((i) => [i.slot, i.id]));
}
function botSquad() {
  const names = ["Priya", "Tom", "Jas", "Mo", "Ellie"];
  const st = myStats();
  const bots = names.slice(0, L.bots).map((name, i) => {
    const answers = Walker.fallbackAnswers("bot-" + name);
    const stats = G.stats(answers);
    return { id: "bot" + i, name, answers, stats, equipped: botKit(G.classOf(stats).id, L.botGear), inv: {}, bot: true };
  });
  // Fill the rows the player isn't covering so a test squad always has some shape.
  const mine = L.pos || G.suggestedPosition(st);
  const need = ["front", "back", "mid"].filter((p) => p !== mine);
  bots.forEach((b, i) => (b.pos = need[i] || G.suggestedPosition(b.stats)));
  return [{ id: "me", you: true, name: L.name, answers: L.answers, stats: st, equipped: L.equipped, inv: L.inv, pos: mine }, ...bots];
}
const poolFor = (R) => G.RULES.raidRewardPerMember * R.members.length * R.lvl ** G.RULES.raidRewardCurve * R.boss.reward;
function tabRaid() {
  const st = myStats(), cls = myClass(), sug = G.suggestedPosition(st), pos = L.pos || sug;
  const preview = G.raidCreate(botSquad(), { minutes: L.raidMin, seed: 1, tier: L.tier });
  const boss = preview.boss;
  return `
    <section class="panel hero">
      <div class="art"><div class="bg" style="background:radial-gradient(90% 120% at 80% 100%, #5a4bb0 0%, #24306e 45%, #121a44 100%)"></div>
        <div class="label"><span class="chip red">${ic("raid")} Sunday · Boss ${boss.tier}${boss.lap > 1 ? ` · Lap ${boss.lap}` : ""}</span><h3 class="ol">${esc(boss.name)}</h3><p>${esc(boss.title)}.</p></div>
        <div class="portrait">${portraitImg("boss", boss.id, { w: 300, h: 320 })}</div></div>
      <div class="body">
        <div class="tiles">
          <div class="tile red"><div class="k">${ic("heart")} Health</div><div class="v num">${fmt(boss.max)}</div></div>
          <div class="tile"><div class="k">${ic("upgrade")} Boss level</div><div class="v">${preview.lvl.toFixed(2)}<small>from gear</small></div></div>
          <div class="tile gold"><div class="k">${ic("chest")} Win reward</div><div class="v">${effortTag(poolFor(preview))}<small>squad</small></div></div>
          <div class="tile"><div class="k">${ic("timer")} Length</div><div class="v">${L.raidMin}<small>min</small></div></div>
        </div>
        <button class="btn green xl block" style="margin-top:14px" data-act="raid">${ic("raid")} Start raid</button>
      </div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge red">${ic("ladder")}</span><h2 class="ol-sm">The ladder</h2><span class="side chip">Lap ${boss.lap}</span></div>
      <div class="ladder">${G.BOSSES.map((b, i) => {
        const t = (boss.lap - 1) * G.BOSSES.length + i + 1, state = t < L.tier ? "beaten" : t === L.tier ? "next" : "locked";
        return `<div class="rung ${state}"><span class="n">${state === "beaten" ? ic("check") : i + 1}</span><span class="grow"><b>${esc(b.name)}</b><small>${esc(b.title)}</small></span>${state === "next" ? `<span class="chip gold">Next</span>` : state === "locked" ? `<span class="lockic">${ic("lock")}</span>` : ""}</div>`;
      }).join("")}</div>
      <p class="small muted" style="margin:10px 0 0">Win and next Sunday brings the next boss. After the last one the ladder loops, twice as tough and twice as rich.</p>
      <div class="btn-row" style="margin-top:10px"><button class="btn xs" data-act="tier-down" ${L.tier <= 1 ? "disabled" : ""}>${ic("chevronLeft")} Easier</button><button class="btn xs" data-act="tier-up">Harder ${ic("arrowRight")}</button></div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("squad")}</span><h2 class="ol-sm">Squad</h2><span class="side chip">Playtest</span></div>
      <span class="field-label">Your row</span>
      <div class="seg">${G.POSITIONS.map((p) => `<button data-pos="${p.id}" aria-pressed="${p.id === pos}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div>
      <span class="field-label">Bot teammates</span>
      <div class="seg">${[1, 2, 3, 4, 5].map((k) => `<button data-bots="${k}" aria-pressed="${k === L.bots}">${k}</button>`).join("")}</div>
      <span class="field-label">Bots' gear</span>
      <div class="seg">${[["none", "None"], ["some", "Rare"], ["lots", "Legendary"]].map(([k, l]) => `<button data-botgear="${k}" aria-pressed="${k === L.botGear}">${l}</button>`).join("")}</div>
      <span class="field-label">Raid length</span>
      <div class="seg">${[15, 5, 2].map((k) => `<button data-raidmin="${k}" aria-pressed="${k === L.raidMin}">${k} min</button>`).join("")}</div>
      <p class="tiny faint" style="margin:8px 0 0">Shorter test raids shrink the boss to match.</p>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("crown")}</span><h2 class="ol-sm">${esc(cls.name)}</h2><span class="side chip gold">Best: ${G.posOf(sug).label}</span></div>
      <p class="small muted" style="margin:-4px 0 8px">${esc(cls.blurb)} Your top two stats set your class, and your class sets your gear.</p>
      ${statRows(st)}
      <p class="tiny faint" style="margin:6px 0 10px">Striped = from gear. Stats always total ${G.STAT_TOTAL} before gear.</p>
      <div class="btn-row"><button class="btn xs" data-act="reroll">${ic("refresh")} New walker</button><button class="btn xs blue" data-act="use-mine">Use my walker</button></div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("info")}</span><h2 class="ol-sm">How raids work</h2></div>
      <div class="how">
        <div class="hrow"><span class="hic">${ic("squad")}</span><div><b>Three rows</b><span>${G.POSITIONS.map((p) => `${p.label}: ×${p.mult} damage, takes ${p.aggro}% of single hits, ${p.ability}`).join(". ")}. Moving takes a few seconds.</span></div></div>
        <div class="hrow"><span class="hic">${ic("warning")}</span><div><b>Read the warnings</b><span>Every attack is called a couple of seconds early: single hits, stomps on the front two rows, screams on everyone, and a feast that heals it unless you burst it.</span></div></div>
        <div class="hrow"><span class="hic">${ic("brains")}</span><div><b>When someone falls</b><span>Everyone gets one question: name a thing in ${G.RULES.triviaSeconds}s. If ${Math.round(G.RULES.triviaFailShare * 100)}% of the squad gets theirs wrong, you're all paralysed and start tomorrow ${fmt(G.RULES.paralysedSteps)} steps down. Rare answers hurt the boss.</span></div></div>
        <div class="hrow"><span class="hic">${ic("upgrade")}</span><div><b>Gear raises the stakes</b><span>Better squad gear makes the boss stronger, but the reward grows faster. Gear is how you climb.</span></div></div>
      </div>
    </section>`;
}

// ---------- Shop ----------
function itemCard(item, { deal = false } = {}) {
  const t = G.tierOf(item.tier), own = item.id in L.inv, on = L.equipped[item.slot] === item.id, locked = !own && t.lvl > level();
  const st = G.itemStats(item, L.inv[item.id] || 0), price = G.priceOf(item, deal);
  return `<button class="item ${item.tier} ${locked ? "locked" : ""}" style="--rc:${t.color}" data-item="${item.id}" data-deal="${deal ? 1 : ""}" aria-label="${esc(item.name)}">
    <div class="art-wrap"><span class="rarity">${t.label}</span><div class="art">${itemArt(item)}</div>
      ${own && L.inv[item.id] ? `<span class="upb">+${L.inv[item.id]}</span>` : ""}${on ? `<span class="eq">${ic("check")}</span>` : ""}${deal && !own ? `<span class="deal">−${Math.round((1 - price / G.priceOf(item, false)) * 100)}%</span>` : ""}
      ${locked ? `<span class="lockover">${ic("lock")}</span>` : ""}</div>
    <div class="meta"><h4>${esc(item.name)}</h4>
      <div class="stats">${Object.entries(st).map(([k, v]) => `<span class="st" style="color:${STAT_LOOK[k][1]}">${ic(STAT_LOOK[k][0])}+${v}</span>`).join("")}</div></div>
    ${item.perk ? `<div class="perk">${esc(perkText(item.perk))}</div>` : "<div></div>"}
    <div class="foot">${locked ? `<span class="buy">Level ${t.lvl}</span>` : own ? `<span class="buy owned">${on ? "Equipped" : "Owned"}</span>` : `<span class="buy ${L.wallet < price ? "poor" : ""}">${gem(18)}${fmt(price / PER_E())}</span>`}</div>
  </button>`;
}
function tabShop() {
  const cls = myClass(), lvl = level();
  const tierRank = (i) => I.TIERS.findIndex((t) => t.id === i.tier);
  const sort = (a, b) => tierRank(a) - tierRank(b) || G.SLOTS.indexOf(a.slot) - G.SLOTS.indexOf(b.slot);
  const deals = G.dealsFor(today(), cls.id, lvl);
  const lists = {
    class: I.ITEMS.filter((i) => i.cls === cls.id).sort(sort),
    all: I.ITEMS.filter((i) => !i.cls).sort(sort),
    deals: deals.map(G.itemById).filter(Boolean),
    bag: I.ITEMS.filter((i) => i.id in L.inv).sort(sort),
  };
  const tab = lists[L.shopTab] ? L.shopTab : "class";
  const next = I.TIERS.find((t) => t.lvl > lvl);
  const slotName = { weapon: "Weapon", armour: "Armour", trinket: "Trinket" };
  return `
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("guard")}</span><h2 class="ol-sm">Loadout</h2>${next ? `<span class="side chip">${ic("lock")} ${next.label} at Lv ${next.lvl}</span>` : ""}</div>
      <div class="loadout">${G.SLOTS.map((s) => {
        const it = G.itemById(L.equipped[s]);
        return it ? `<button class="slot full" style="--rc:${G.tierOf(it.tier).color}" data-item="${it.id}" aria-label="${esc(it.name)}"><div class="art">${itemArt(it)}</div><span class="slab">${esc(it.name)}</span></button>`
          : `<div class="slot"><div class="ph">${ic({ weapon: "sword", armour: "guard", trinket: "star" }[s])}<span>${slotName[s]}</span></div></div>`;
      }).join("")}</div>
    </section>
    <div class="tabs-sub">${[["class", cls.name, 0], ["all", "Everyone", 0], ["deals", "Deals", lists.deals.filter((i) => !(i.id in L.inv)).length], ["bag", "Bag", Object.keys(L.inv).length]].map(([k, l, n]) =>
      `<button data-shoptab="${k}" aria-pressed="${tab === k}">${esc(l)}${n ? `<span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>
    ${tab === "deals" ? `<p class="small muted" style="margin:0">Three picks for your class each day, about ${Math.round(G.RULES.dealDiscount * 100)}% off. New ones at midnight.</p>` : ""}
    <div class="items">${lists[tab].length ? lists[tab].map((i) => itemCard(i, { deal: tab === "deals" })).join("") : `<p class="muted small" style="grid-column:1/-1;text-align:center;padding:20px 0">Nothing here yet.</p>`}</div>`;
}
function itemSheet(id, deal) {
  const item = G.itemById(id); if (!item) return;
  const t = G.tierOf(item.tier), up = L.inv[id] || 0, own = id in L.inv, on = L.equipped[item.slot] === id;
  const locked = !own && t.lvl > level(), price = G.priceOf(item, deal), cls = item.cls ? I.CLASSES.find((c) => c.id === item.cls) : null;
  const st = G.itemStats(item, up), next = G.itemStats(item, up + 1), cost = G.upgradeCost(item, up), maxed = up >= G.RULES.upgradeMax;
  const sh = $("#sheet");
  sh.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-label="${esc(item.name)}" style="--rc:${t.color}"><div class="grab"></div>
    <div class="row spread" style="margin-bottom:10px"><span class="chip" style="background:color-mix(in srgb, ${t.color} 30%, transparent);border-color:${t.color};color:#fff">${t.label}${cls ? ` · ${esc(cls.name)}` : " · Any class"} · ${esc(item.slot)}</span><button class="iconbtn" data-act="close-sheet" aria-label="Close">${ic("close")}</button></div>
    <div class="bigart"><div class="art">${itemArt(item)}</div>${up ? `<span class="upb">+${up}</span>` : ""}</div>
    <h2 class="ol-sm">${esc(item.name)}</h2>
    <p class="flavour">${esc(item.text)}</p>
    <div class="tiles">${Object.entries(st).map(([k, v]) => `<div class="tile"><div class="k" style="color:${STAT_LOOK[k][1]}">${ic(STAT_LOOK[k][0])} ${statLabel(k)}</div><div class="v">+${v}${own && !maxed ? `<small>→ +${next[k]}</small>` : ""}</div></div>`).join("")}</div>
    ${item.perk ? `<div class="perkbox">${ic("star")}<span>${esc(perkText(item.perk))}</span></div>` : ""}
    <div class="btn-row" style="margin-top:12px">
      ${locked ? `<button class="btn block" disabled>${ic("lock")} Unlocks at level ${t.lvl}</button>`
        : !own ? `<button class="btn green xl block" data-buy="${id}" data-deal="${deal ? 1 : ""}" ${L.wallet < price ? "disabled" : ""}>Buy ${priceTag(price)}</button>`
        : `${on ? `<button class="btn" data-unequip="${item.slot}">Take off</button>` : `<button class="btn blue" data-equip="${id}">Equip</button>`}
           ${maxed ? `<button class="btn" disabled>Max level</button>` : `<button class="btn gold" data-upgrade="${id}" ${L.wallet < cost ? "disabled" : ""}>${ic("upgrade")} +${up + 1} ${priceTag(cost)}</button>`}`}
    </div>
    ${!own && !locked && L.wallet < price ? `<p class="small muted" style="text-align:center;margin:10px 0 0">You need ${fmt((price - L.wallet) / PER_E())} more Endeavour${price - L.wallet > PER_E() ? "s" : ""}.</p>` : ""}
  </div>`;
  sh.hidden = false;
}

// ---------- Tuning ----------
const KNOBS = [
  ["Taxman", [["baseTax", "Base tax", "0.2 = 20%"], ["taxPerOverMin", "Extra tax per minute over budget"], ["taxMaxExtra", "Most extra tax from scrolling"], ["stealCap", "Most you can steal", "0.3 = 30%"],
    ["dailyWindowMin", "Fight length (min)"], ["taxmanBaseHp", "Base health"], ["taxmanHpPerEffort", "Health per Effort earned"], ["taxmanHpPerOverMin", "Health per minute over budget"],
    ["taxmanRegen", "Health regained per idle second", "share of max"], ["taxmanPerLevel", "Toughness per player level"], ["stealPerLevel", "Extra steal cap per level"],
    ["auditEvery", "Seconds between Audits"], ["auditFor", "Audit length (s)"], ["auditBlock", "Damage through an Audit", "share"], ["stealDmgPerPct", "Damage per 1% stolen", "× his health"], ["comboWindowMs", "Combo window (ms)"]]],
  ["Raid", [["raidHpPerMember", "Boss health per member"], ["raidLvlCurve", "How much gear raises the boss", "1 = fully"], ["raidPerkWeight", "Weight of each gear perk"], ["raidRewardCurve", "Reward growth vs boss level"],
    ["raidAtkEvery", "Seconds between attacks"], ["raidBossDmg", "Single-hit damage"], ["raidRewardPerMember", "Win reward per member per level", "Efforts"]]],
  ["Trivia", [["triviaSeconds", "Seconds per question"], ["triviaFailShare", "Share wrong that paralyses"], ["rarityBossDmg", "Boss damage per rarity point", "share of health"], ["paralysedSteps", "Step penalty when paralysed"], ["paralysedStunSec", "Stun when paralysed (s)"]]],
  ["Economy", [["stepsPerEffort", "Steps per Effort"], ["dailyEffortCap", "Most Efforts a day"], ["xpPerLevel", "XP curve", "level n needs this × (n−1)²"], ["dealDiscount", "Deal discount"]]],
];
function tabTune() {
  const changed = (k) => L.rules[k] !== undefined && L.rules[k] !== G.DEFAULT_RULES[k];
  return `
    <section class="panel">
      <div class="ptitle"><span class="ic-badge green">${ic("gift")}</span><h2 class="ol-sm">Playtest tools</h2></div>
      <label class="row spread" style="margin-bottom:14px"><span><b>3D battles</b><span class="small muted" style="display:block">Switch off to compare with the flat version</span></span><input class="switch" type="checkbox" data-toggle3d ${L.no3d ? "" : "checked"} aria-label="3D battles"></label>
      <div class="grid3"><button class="btn xs gold" data-act="cheat">${gem(16)} +5</button><button class="btn xs blue" data-act="cheat-lvl">+1 level</button><button class="btn xs blue" data-act="cheat-lvl5">+5 levels</button></div>
    </section>
    ${KNOBS.map(([group, rows]) => `<section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("sliders")}</span><h2 class="ol-sm">${group}</h2></div>
      ${rows.map(([k, label, hint]) => `<label class="knob ${changed(k) ? "changed" : ""}"><span><b>${label}</b><small>${hint ? `${hint} · ` : ""}default ${G.DEFAULT_RULES[k]}</small></span><input type="number" step="any" inputmode="decimal" data-knob="${k}" value="${G.RULES[k]}"></label>`).join("")}
    </section>`).join("")}
    <section class="panel">
      <div class="btn-row"><button class="btn sm blue" data-act="copy-knobs">Copy changes</button><button class="btn sm" data-act="reset-knobs">Reset numbers</button></div>
      <div class="divider"></div>
      <div class="row spread"><span class="small muted">Wipes the lab wallet, level, gear and history on this device.</span><button class="btn xs red" data-act="reset-lab">Reset lab</button></div>
    </section>`;
}

// ---------- shared battle bits ----------
function banner(text, small = "") {
  const el = document.createElement("div");
  el.className = "banner"; el.innerHTML = `<span>${esc(text)}</span>${small ? `<small>${esc(small)}</small>` : ""}`;
  $("#arena")?.appendChild(el);
  setTimeout(() => el.remove(), 1250);
}
// The 3D arena, when the device can run it (and it's not switched off in Tuning).
const use3d = () => !L.no3d && !V.no3d && window.Arena3D && Arena3D.supported();
// If the 3D view can't start (old GPU, too many contexts), carry on in 2D for the rest of the session.
function make3d(opts) {
  try { return Arena3D.create($("#stage"), opts); }
  catch (err) { console.warn("3D arena unavailable, using 2D", err); V.no3d = true; return null; }
}
const arena = () => (V.tax && V.tax.A) || (V.raid && V.raid.A) || null;
// Arena3D positions are relative to the stage; the effects canvas covers the whole arena.
function toArena(pt) {
  if (!pt) return [0, 0];
  const st = $("#stage").getBoundingClientRect(), ar = $("#arena").getBoundingClientRect();
  return [pt[0] + st.left - ar.left, pt[1] + st.top - ar.top];
}
function bossXY(frac = 0.55) {
  const A = arena();
  if (A) return toArena(A.screenOf("boss", frac));
  const b = $("#boss"); return b ? FX.centre(b) : [0, 0];
}
function bossHurt(crit = false) {
  const A = arena(); if (A) { A.bossHit(crit); return; }
  const b = $("#boss"); if (!b) return;
  b.classList.add("hurt");
  clearTimeout(bossHurt.t); bossHurt.t = setTimeout(() => b.classList.remove("hurt"), 90);
}
function setBar(bar, frac, text) {
  const w = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  bar.querySelector(".fill").style.width = w;
  const ghost = bar.querySelector(".ghost"); if (ghost) ghost.style.width = w;
  bar.querySelector("span").textContent = text;
}
let comboShown = 0;
function paintCombo(combo, mult) {
  const el = $("#combo"); if (!el) return;
  if (combo < 5) { el.innerHTML = ""; comboShown = 0; return; }
  el.innerHTML = `<span class="ol">×${mult.toFixed(2)}</span><small>${combo} combo</small>`;
  el.classList.toggle("hot", combo >= 25);
  for (const m of [10, 25, 50]) if (comboShown < m && combo >= m) { FX.play("combo"); el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 120); if (m >= 25) banner(m >= 50 ? "Max combo" : "On fire"); }
  comboShown = combo;
}
function stagePoint(e) {
  const st = $("#stage").getBoundingClientRect();
  return { x: (e.clientX - st.left) / st.width, y: (e.clientY - st.top) / st.height };
}
function hint(text) {
  const h = $("#hint"); if (!h) return;
  if (text == null) { h.classList.add("gone"); return; }
  h.classList.remove("gone"); h.innerHTML = text;
}

// ---------- 7pm: the Taxman ----------
function startTax(seconds) {
  FX.unlock();
  const S = taxSetup(), full = G.RULES.dailyWindowMin * 60;
  // Short test fights get a proportionally smaller Taxman so they're still winnable.
  if (seconds < full) S.hp = Math.round(S.hp * (seconds / full));
  S.seconds = seconds;
  V.tax = { B: G.taxmanStart(S), S, left: seconds, last: performance.now(), taps: 0 };
  V.view = "tax";
  render();
  V.tax.timer = setInterval(taxTick, 50);
  FX.play("roar");
  setTimeout(() => banner("Fight!", `${Math.round(S.taxRate * 100)}% of your Efforts on the line`), 150);
}
function renderTax() {
  const S = V.tax.S, three = use3d();
  $("#app").innerHTML = `<div class="arena tax" id="arena"><div class="shake-wrap" id="shake">
    <div class="hud">
      <div class="bossbar"><div class="por">${ic("receipt")}<span class="lv">${Math.round(S.taxRate * 100)}% TAX</span></div>
        <div class="nm"><b class="ol-sm">The Taxman</b><small>Collector of the 7pm levy</small></div>
        <div class="right"><span class="timer">${ic("clock")}<span id="t-clock">${mmss(V.tax.left)}</span></span><button class="hbtn" data-act="tax-stop" aria-label="End fight">${ic("close")}</button></div></div>
      <div class="hp green" id="t-hp"><i class="ghost"></i><i class="fill"></i><div class="ticks"></div><span></span></div>
      <div class="hp gold thin" id="t-steal"><i class="fill" style="width:0"></i><span></span></div>
    </div>
    <div class="arena-stage" id="stage">
      <div class="dome" id="dome" hidden></div>
      ${three ? "" : `<div class="boss2d" id="boss">${Walker.boss(1, false)}</div>`}
      <div class="weak" id="weak" hidden></div>
      <div class="receipt" id="receipt" hidden>${ic("receipt")}</div>
      <div class="combo" id="combo"></div>
      <div class="taphint" id="hint">${ic("target")} Tap to attack</div>
    </div>
    <div class="foot"><div class="log" id="t-feed"></div></div>
  </div></div>`;
  FX.init($("#arena"));
  if (three) { V.tax.A = make3d({ mode: "tax", boss: { id: "taxman" }, team: [{ id: "me", you: true, answers: L.answers, pos: "front" }] }); if (!V.tax.A) return renderTax(); }
  paintTax();
}
function taxTick() {
  const v = V.tax; if (!v) return;
  const now = performance.now(), dt = Math.min(0.25, (now - v.last) / 1000);
  v.last = now; v.left -= dt;
  G.taxmanStep(v.B, dt);
  for (const e of v.B.fx.splice(0)) {
    if (e.type === "audit") { FX.play("audit"); banner("Audit!", "Only the weak spot takes damage"); $("#dome").hidden = false; }
    if (e.type === "auditEnd") $("#dome").hidden = true;
    if (e.type === "receipt") FX.play("receipt");
    if (e.type === "ko") {
      FX.play("ko"); banner("K.O.!", "Now rob him blind");
      if (v.A) v.A.bossKO();
      const [x, y] = bossXY(0.5); FX.coins(x, y, 26); FX.ring(x, y, { r1: 260, color: "rgba(255,210,80,.9)", width: 16 }); FX.shake($("#shake"), 14, 500);
    }
  }
  if (v.left <= 0) return finishTax();
  paintTax();
}
function paintTax() {
  const v = V.tax, B = v.B, S = v.S, r = G.taxmanResult(B);
  const clock = $("#t-clock");
  clock.textContent = mmss(v.left); clock.parentElement.classList.toggle("low", v.left <= 30);
  setBar($("#t-hp"), 1 - B.dmg / S.hp, r.beaten ? "KNOCKED OUT · NO TAX" : `${fmt(Math.max(0, S.hp - B.dmg))} · TAX ${Math.round(S.taxRate * 100 * (1 - r.knocked))}%`);
  setBar($("#t-steal"), r.stealPct / S.stealCap, r.beaten ? `STOLEN ${Math.round(r.stealPct * 100)}% · +${r.stolen} EFFORTS` : "KNOCK HIM OUT TO START STEALING");
  const weak = $("#weak");
  weak.hidden = !B.audit;
  if (B.audit) { weak.style.left = `${B.audit.x * 100}%`; weak.style.top = `${B.audit.y * 100}%`; }
  const rc = $("#receipt");
  rc.hidden = !B.receipt;
  if (B.receipt) { rc.style.left = `${B.receipt.x * 100}%`; rc.style.top = `${B.receipt.y * 100}%`; }
  paintCombo(B.combo, 1 + B.combo / G.RULES.comboMax);
  const feed = $("#t-feed");
  if (!B.ko && B.dmg > 0 && B.t - B.lastTap > 0.8) feed.innerHTML = `<div class="warn">He's recounting his money. Keep tapping.</div>`;
  else if (B.audit) feed.innerHTML = `<div class="warn">Audit: hit the moving target.</div>`;
  else if (B.ko) feed.innerHTML = `<div class="good">Knocked out. Every hit now steals.</div>`;
  else feed.innerHTML = "";
}
function taxTap(e) {
  const v = V.tax; if (!v) return;
  const p = stagePoint(e), hit = G.taxmanTap(v.B, p.x, p.y);
  const [x, y] = FX.local(e.clientX, e.clientY);
  if (++v.taps === 6) hint(null);
  if (hit.kind === "receipt") { FX.play("coin"); FX.coins(x, y, 10); FX.number(x, y - 20, hit.bonus, { size: 26, grad: ["#fff3a0", "#f2b51d"] }); return; }
  FX.tapHit(x, y, { crit: hit.crit, dmg: hit.dmg, kind: hit.kind, color: hit.kind === "weak" ? "#6fd4ff" : hit.kind === "blocked" ? "#9aa8ff" : "#ffd166" });
  FX.play(hit.kind === "blocked" ? "blocked" : hit.kind === "weak" ? "weak" : hit.crit ? "crit" : "hit");
  if (hit.crit || hit.kind === "weak") { FX.shake($("#shake"), 6, 180); FX.buzz(20); } else FX.buzz(6);
  if (v.B.ko && (hit.crit || Math.random() < 0.25)) { FX.coins(x, y, hit.crit ? 6 : 2); FX.play("coin"); }
  v.A?.heroAttack("me", { crit: hit.crit || hit.kind === "weak" });
  if (hit.kind !== "blocked") bossHurt(hit.crit || hit.kind === "weak");
}
function finishTax() {
  const v = V.tax;
  clearInterval(v.timer);
  const r = G.taxmanResult(v.B);
  r.taps = v.B.taps; r.crits = v.B.crits; r.weak = v.B.weak; r.receipts = v.B.receipts;
  v.A?.dispose();
  FX.destroy();
  V.tax = null;
  V.result = { kind: "tax", r, banked: false };
  V.view = "result";
  render();
  FX.play(r.beaten ? "win" : "lose");
}

// ---------- Sunday raid ----------
function startRaid() {
  FX.unlock();
  const squad = botSquad();
  V.raid = { R: G.raidCreate(squad, { minutes: L.raidMin, tier: L.tier }), last: performance.now(), q: null, bossPct: 1, taps: 0 };
  V.view = "raid";
  render();
  V.raid.timer = setInterval(raidTick, 50);
  FX.play("roar");
  setTimeout(() => V.raid && banner(V.raid.R.boss.name, V.raid.R.boss.title), 150);
}
function renderRaid() {
  const R = V.raid.R, three = use3d();
  $("#app").innerHTML = `<div class="arena raid" id="arena"><div class="shake-wrap" id="shake">
    <div class="hud">
      <div class="bossbar"><div class="por">${ic("raid")}<span class="lv">LV ${R.lvl.toFixed(1)}</span></div>
        <div class="nm"><b class="ol-sm">${esc(R.boss.name)}</b><small>Boss ${R.tier} · ${esc(R.boss.title)}</small></div>
        <div class="right"><span class="timer">${ic("clock")}<span id="r-clock"></span></span><button class="hbtn" data-act="raid-quit" aria-label="End raid">${ic("close")}</button></div></div>
      <div class="hp" id="r-hp"><i class="ghost"></i><i class="fill"></i><div class="ticks"></div><span></span></div>
    </div>
    <div class="tele idle" id="tele"><span class="ti">${ic("eye")}</span><span class="tt"></span><i class="cd"></i></div>
    <div class="arena-stage" id="stage">${three ? '<div id="plates"></div>' : `<div class="boss2d" id="boss">${Walker.boss(1, false)}</div>`}<div class="combo" id="combo"></div><div class="taphint" id="hint">${ic("target")} Tap the boss</div></div>
    ${three ? "" : `<div class="party2d">${R.members.map((m) => `<div class="m" id="m-${m.id}"><div class="f">${head2d(m.answers)}</div>${esc(m.you ? "You" : m.name)}</div>`).join("")}</div>`}
    <div class="foot"><div class="log" id="feed"></div>
      <div class="controls"><button class="ability" id="ab" data-act="ability" aria-label="Ability"><span class="cdv"></span><span class="ic-slot"></span><span class="secs"></span><span class="al"></span></button>
        <div class="rows">${G.POSITIONS.map((p) => `<button data-move="${p.id}" aria-label="Move to ${p.label}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div></div>
    </div>
  </div><div id="trivia"></div><div id="veil"></div></div>`;
  FX.init($("#arena"));
  if (three) {
    V.raid.A = make3d({ mode: "raid", boss: { id: R.boss.id }, team: R.members.map((m) => ({ id: m.id, you: !!m.you, answers: m.answers, pos: m.pos })) });
    if (!V.raid.A) return renderRaid();
    $("#plates").innerHTML = R.members.map((m) => `<div class="plate ${m.you ? "me" : ""}" id="np-${m.id}">${esc(m.you ? "You" : m.name)}<span class="st"></span><i><s></s></i></div>`).join("");
  }
  V.raid.abRow = null;
  paintRaid();
}
function raidTick() {
  const v = V.raid; if (!v) return;
  const now = performance.now();
  let dt = (now - v.last) / 1000;
  v.last = now;
  while (dt > 0 && !v.R.over) { G.raidStep(v.R, Math.min(0.25, dt)); dt -= 0.25; }
  for (const e of v.R.fx.splice(0)) raidFx(e);
  if (v.R.over) {
    clearInterval(v.timer);
    // Let the boss fall over before the results.
    if (v.A && v.R.result.how === "won") { v.A.bossKO(); banner("K.O.!", `${v.R.boss.name} is down`); FX.play("ko"); setTimeout(finishRaid, 1800); }
    else finishRaid();
    return;
  }
  paintRaid();
}
const mateEl = (id) => $(`#np-${id}`) || $(`#m-${id}`);
const mateXY = (id) => { const A = arena(); if (A) return toArena(A.screenOf(id, 0.75)); return mateEl(id) ? FX.centre(mateEl(id)) : [0, 0]; };
function raidFx(e) {
  const v = V.raid, R = v.R, boss = $("#boss"), A = v.A;
  const [bx, by] = bossXY();
  switch (e.type) {
    case "tap": A?.heroAttack(e.id, { crit: e.crit, big: e.swing }); break;
    case "move": A?.move(e.id, e.pos); break;
    case "windup": if (A) A.bossWindup(e.attack, e.ids || []); FX.play("warn"); break;
    case "attack": {
      A?.bossAttack(e.attack, e.ids);
      if (e.attack === "swipe") { FX.play("swipe"); for (const id of e.ids) { const [x, y] = mateXY(id); FX.claw(x, y); } FX.shake($("#shake"), 6, 220); }
      if (e.attack === "stomp") { FX.play("stomp"); FX.shake($("#shake"), A ? 8 : 14, 500); }
      if (e.attack === "scream") { FX.play("scream"); if (!A) FX.screamWaves(bx, by); FX.shake($("#shake"), 6, 600); }
      if (e.attack === "feast") { FX.play("feast"); FX.chomp(bx, by + 30); banner(R.boss.attacks?.feast || "Feast", "Burst it down before it heals"); }
      break;
    }
    case "hurt": {
      A?.hurt(e.id);
      const [x, y] = mateXY(e.id); FX.number(x, y - 20, `-${e.amt}`, { size: 22, color: "#ff6b78" });
      if (e.id === "me") { FX.flash($("#arena")); FX.play("hurt"); FX.buzz(40); }
      break;
    }
    case "dodge": { const [x, y] = mateXY(e.id); FX.number(x, y - 20, "Dodge", { size: 20, color: "#9af0ff" }); break; }
    case "shield": FX.play("shield"); A?.shield(e.ids, 8 + (R.members.find((m) => m.id === e.by)?.perks.shield || 0)); break;
    case "swing": { FX.play("swing"); A?.heroAttack(e.by, { big: true }); const [x, y] = mateXY(e.by); FX.number(x, y - 30, "Big swing!", { size: 22, grad: ["#fff3a0", "#ff7a3d"] }); break; }
    case "heal": { FX.play("heal"); A?.heal(e.by, e.id); const [x, y] = mateXY(e.id); if (!A) FX.heal(x, y); FX.number(x, y - 26, `+${e.amt}`, { size: 22, color: "#7ee29d" }); break; }
    case "down": { FX.play("down"); A?.down(e.id); const [x, y] = mateXY(e.id); FX.number(x, y - 20, "Down", { size: 22, color: "#ff6b78" }); FX.sparks(x, y, "#ff6b78", 16, 300); break; }
    case "secondWind": { const [x, y] = mateXY(e.id); FX.number(x, y - 26, "Second wind", { size: 20, grad: ["#ffffff", "#7ee29d"] }); FX.play("revive"); break; }
    case "revive": FX.play("revive"); for (const id of e.ids) { A?.revive(id); const [x, y] = mateXY(id); FX.heal(x, y); } banner("Back up!"); break;
    case "phase": FX.play("phase"); A?.phase(e.phase); $("#arena").classList.toggle("p2", e.phase === 2); $("#arena").classList.toggle("p3", e.phase === 3); banner(e.phase === 2 ? "Phase 2" : "Enraged", e.phase === 2 ? "It hits harder" : "It's fast now"); FX.shake($("#shake"), 12, 600); break;
    case "feastEnd": if (e.healed) { FX.number(bx, by - 40, `+${fmt(e.healed)}`, { size: 30, color: "#7ee29d" }); FX.play("heal"); } else { FX.number(bx, by - 40, "Interrupted", { size: 26, grad: ["#fff3a0", "#ff7a3d"] }); FX.play("combo"); } break;
    case "trivia": FX.play("warn"); break;
    case "answered": if (e.id !== "me") FX.play(e.valid ? "tap" : "blocked"); break;
    case "triviaDone": FX.play(e.failed ? "wrong" : "right"); if (e.dive) { FX.number(bx, by, `-${fmt(e.dive)}`, { size: 38, grad: ["#c8f7ff", "#2bb3ff"] }); FX.sparks(bx, by, "#6fd4ff", 24, 600); bossHurt(true); } break;
    case "paralysed": FX.play("stun"); banner("Paralysed", `${fmt(G.RULES.paralysedSteps)} steps down tomorrow`); break;
  }
}
function paintRaid() {
  const v = V.raid, R = v.R, B = R.boss, me = R.members.find((m) => m.id === "me");
  const clock = $("#r-clock"); clock.textContent = mmss(R.dur - R.t); clock.parentElement.classList.toggle("low", R.dur - R.t <= 30);
  setBar($("#r-hp"), B.hp / B.max, `${fmt(B.hp)} / ${fmt(B.max)}`);
  const pct = Math.ceil((B.hp / B.max) * 10) / 10;
  if (!v.A && pct !== v.bossPct && $("#boss")) { v.bossPct = pct; $("#boss").innerHTML = Walker.boss(B.hp / B.max, false); }
  const tele = $("#tele"), tt = tele.querySelector(".tt"), cdbar = tele.querySelector(".cd");
  if (B.feast) {
    tele.className = "tele feast";
    tt.innerHTML = `${esc(B.attacks.feast)}<small>${fmt(B.feast.dealt)} / ${fmt(B.feast.need)} damage</small>`;
    cdbar.style.width = `${Math.max(0, (B.feast.until - R.t) / 6) * 100}%`;
  } else if (B.next && R.t >= B.next.warnAt) {
    const a = G.ATTACKS[B.next.type], total = B.next.at - B.next.warnAt;
    tele.className = "tele hot";
    tt.innerHTML = `${esc(B.attacks[B.next.type] || a.label)}<small>${esc(a.what)} · ${Math.max(0, B.next.at - R.t).toFixed(1)}s</small>`;
    cdbar.style.width = `${Math.max(0, (B.next.at - R.t) / total) * 100}%`;
  } else {
    tele.className = "tele idle";
    tt.innerHTML = `Phase ${B.phase}<small>watching for its next move</small>`;
    cdbar.style.width = "0";
  }
  for (const m of R.members) {
    const el = mateEl(m.id); if (!el) continue;
    const f = m.hp / m.max;
    el.classList.toggle("dead", !m.alive);
    if (v.A) {
      // Floating nameplates above each walker's head.
      const pt = v.A.screenOf(m.id, 1.05);
      if (pt) el.style.transform = `translate(${pt[0]}px, ${pt[1]}px) translate(-50%, -100%)`;
      const bar = el.querySelector("s");
      bar.style.width = `${f * 100}%`;
      bar.style.background = f > 0.5 ? "var(--green)" : f > 0.25 ? "var(--gold)" : "var(--red)";
      const st = !m.alive ? "skull" : R.t < m.stunUntil ? "bolt" : R.t < m.shieldUntil ? "guard" : m.swing ? "fire" : "";
      const stEl = el.querySelector(".st");
      if (stEl.dataset.s !== st) { stEl.dataset.s = st; stEl.innerHTML = st ? ic(st) : ""; }
    }
  }
  // Ability button: icon and label follow your row; a dark sweep shows the cooldown.
  const ab = $("#ab"), p = G.posOf(me.pos), cd = Math.max(0, me.cdUntil - R.t), total = G.abilityCd(me);
  if (v.abRow !== me.pos) { v.abRow = me.pos; ab.querySelector(".ic-slot").innerHTML = ic(ROW_ICON[me.pos]); ab.querySelector(".al").textContent = p.ability; }
  ab.querySelector(".secs").textContent = cd > 0 ? Math.ceil(cd) : "";
  ab.querySelector(".ic-slot").style.opacity = cd > 0 ? 0.25 : 1;
  ab.style.setProperty("--cd", `${cd > 0 ? (cd / total) * 360 : 0}deg`);
  ab.disabled = cd > 0 || !me.alive;
  ab.classList.toggle("ready", cd <= 0 && me.alive && R.t >= me.stunUntil);
  document.querySelectorAll("[data-move]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.move === me.pos)));
  if (!me.alive) hint(`${ic("skull")} You're down. Answer your question`);
  else if (R.t < me.stunUntil) hint(`${ic("bolt")} Paralysed`);
  else if (R.t < me.moveUntil) hint(`${ic("arrowRight")} Moving rows`);
  else if (me.swing) hint(`${ic("fire")} Big swing: ${me.swing} hits left`);
  else if (v.taps >= 6) hint(null);
  paintCombo(me.combo, 1 + me.combo / (G.RULES.comboMax * 2));
  $("#feed").innerHTML = R.log.slice(0, 2).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join("");
  const veil = $("#veil");
  const want = me.alive && R.t < me.stunUntil ? "stun" : !me.alive ? "down" : "";
  if (veil.dataset.s !== want || want === "stun") {
    veil.dataset.s = want;
    veil.innerHTML = want === "stun" ? `<div class="veil stun"><b class="ol">Paralysed<br>${Math.ceil(me.stunUntil - R.t)}s</b></div>` : want === "down" ? '<div class="veil down"></div>' : "";
  }
  paintTrivia();
}
function paintTrivia() {
  const v = V.raid, R = v.R, T = R.trivia, box = $("#trivia");
  if (!T) { if (box.innerHTML) box.innerHTML = ""; v.q = null; return; }
  const mineP = T.per.me, Q = mineP.q, key = `${R.triviaRuns}`;
  if (v.q !== key) {
    v.q = key; v.ticked = 0;
    box.innerHTML = `<div class="trivia"><div class="tt"><div><div class="caps">Squad question · ${esc(Q.kind === "maths" ? "Maths" : "Science")}</div><div class="tiny" style="color:rgba(255,255,255,.7);margin-top:3px">${Math.round(G.RULES.triviaFailShare * 100)}% of the squad wrong = everyone paralysed</div></div><div class="ring" id="tv-clock"><span></span></div></div>
      <h3 class="ol-sm">${esc(Q.q)}</h3>
      <form data-form="answer"><input id="tv-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Name one…" maxlength="40" aria-label="Your answer"><button class="btn green">Go</button></form>
      <div class="verdict" id="tv-verdict"></div>
      <div class="votes" id="tv-votes"></div></div>`;
    setTimeout(() => $("#tv-in")?.focus(), 50);
  }
  const left = Math.max(0, mineP.until - R.t);
  const clock = $("#tv-clock");
  clock.style.setProperty("--t", left / mineP.secs); clock.classList.toggle("low", left <= 5 && !mineP.ans);
  clock.querySelector("span").innerHTML = mineP.ans ? ic("check") : Math.ceil(left);
  if (!mineP.ans && left <= 5 && Math.ceil(left) !== v.ticked) { v.ticked = Math.ceil(left); FX.play("tick"); }
  const wrong = Object.values(T.per).filter((p) => p.ans && !p.ans.valid).length;
  $("#tv-votes").innerHTML = R.members.map((m) => {
    const a = T.per[m.id].ans;
    return `<span class="vote ${a ? (a.valid ? "ok" : "no") : ""}">${esc(m.you ? "You" : m.name)} ${a ? ic(a.valid ? "check" : "close") : "…"}</span>`;
  }).join("") + `<span class="vote" style="background:none">${wrong} of ${R.members.length} wrong</span>`;
  const mine = mineP.ans;
  if (mine) {
    const form = $("#trivia form"); if (form) form.remove();
    $("#tv-verdict").innerHTML = mine.valid
      ? `<b>${esc(mine.canon)}</b> <span class="rar r${mine.rarity}">${["", "Obvious", "Decent", "Rare"][mine.rarity]}</span> <span class="muted">Waiting for the squad…</span>`
      : `<b>${esc(mine.text || "No answer")}</b> doesn't count. <span class="muted">Deep cuts: ${esc(Q.examples.join(", "))}</span>`;
  }
}
function raidTap(e) {
  const v = V.raid; if (!v) return;
  const hit = G.raidTap(v.R, "me");
  if (!hit) return;
  v.taps++;
  const [x, y] = FX.local(e.clientX, e.clientY);
  FX.tapHit(x, y, { crit: hit.crit, dmg: hit.dmg, color: hit.swing ? "#ff9f43" : "#ffd166" });
  FX.play(hit.crit || hit.swing ? "crit" : "hit");
  if (hit.crit || hit.swing) { FX.shake($("#shake"), hit.swing ? 9 : 5, 180); FX.buzz(18); } else FX.buzz(5);
  v.A?.heroAttack("me", { crit: hit.crit, big: hit.swing });
  bossHurt(hit.crit || hit.swing);
}
function finishRaid() {
  const v = V.raid; if (!v) return;
  clearInterval(v.timer);
  v.A?.dispose();
  FX.destroy();
  V.result = { kind: "raid", R: v.R, banked: false };
  V.raid = null; V.view = "result";
  render();
  FX.play(v.R.result.how === "won" ? "win" : "lose");
}

// ---------- results ----------
function renderResult() {
  const res = V.result;
  let body, won, title, sub, amount;
  if (res.kind === "tax") {
    const r = res.r; won = r.beaten; amount = r.net;
    title = won ? "Victory" : "Taxed";
    sub = `${fmt(r.taps)} taps · ${r.crits} crits · ${r.weak} weak-spot hits · ${r.receipts} receipt${r.receipts === 1 ? "" : "s"}`;
    body = `<section class="panel">
        <div class="rline plus"><span>Earned from steps</span><span class="rv">+${effortTag(r.earned)}</span></div>
        <div class="rline minus"><span>Taxman took · ${Math.round(r.taxRate * (1 - r.knocked) * 100)}%</span><span class="rv">−${effortTag(r.taxed)}</span></div>
        <div class="rline plus"><span>Stolen back · ${Math.round(r.stealPct * 100)}%</span><span class="rv">+${effortTag(r.stolen)}</span></div>
        <div class="rline total"><span class="disp" style="font-size:18px">You keep</span><span class="rv">${coin(26)}<span id="count">0</span></span></div>
      </section>`;
  } else {
    const R = res.R, out = R.result, mine = out.shares.find((s) => s.id === "me"), T = R.lastTrivia;
    won = out.how === "won"; amount = mine.reward;
    title = { won: "Victory", timeout: "Time up", wiped: "Defeat" }[out.how];
    sub = `${esc(R.boss.name)} · ${Math.round(out.frac * 100)}% dealt in ${mmss(R.t)}${R.triviaRuns ? ` · ${R.triviaRuns} trivia round${R.triviaRuns === 1 ? "" : "s"}` : ""}`;
    body = `${out.paralysed ? `<section class="panel" style="border-color:var(--red)"><div class="row">${ic("bolt")}<b class="disp">Paralysed.</b><span class="small muted">Everyone starts tomorrow ${fmt(G.RULES.paralysedSteps)} steps down.</span></div></section>` : ""}
      <section class="panel"><table class="rtable"><tr><th>Squad</th><th>Damage</th><th>Healed</th><th>Taken</th><th>Reward</th></tr>
        ${out.shares.map((s) => `<tr class="${s.id === "me" ? "me" : ""}"><td>${esc(s.id === "me" ? "You" : s.name)}</td><td>${fmt(s.dmg)}</td><td>${fmt(s.healed)}</td><td>${fmt(s.taken)}</td><td>${fmt(s.reward)}</td></tr>`).join("")}</table></section>
      ${T ? `<section class="panel"><div class="ptitle"><h2 class="ol-sm">Last trivia · ${T.n - T.wrong}/${T.n} right</h2>${T.failed ? `<span class="side chip red">Paralysed</span>` : `<span class="side chip green">Passed</span>`}</div>
        ${T.results.map((q) => `<div class="rline"><span class="grow"><b>${esc(q.id === "me" ? "You" : q.name)}</b> · ${esc(q.q)}<br><span class="small muted">“${esc(q.ans.text || "no answer")}” · deep cuts: ${esc(q.examples.join(", "))}</span></span><span class="rv" style="color:${q.ans.valid ? "var(--green)" : "var(--red)"}">${ic(q.ans.valid ? "check" : "close")}</span></div>`).join("")}</section>` : ""}
      <section class="panel"><div class="rline total" style="border-top:0;margin-top:0"><span class="disp" style="font-size:18px">Your share</span><span class="rv">${coin(26)}<span id="count">0</span></span></div>
        ${won ? `<div class="small muted">Next Sunday: ${esc(G.bossFor(R.tier + 1).name)}</div>` : ""}</section>`;
  }
  const p = G.levelProgress(L.xp);
  $("#app").innerHTML = `<div class="results ${won ? "" : "lost"}" id="arena"><div class="inner">
    <div class="ribbon ol">${title}</div>
    <div class="subline">${sub}</div>
    <div class="stack">${body}
      <section class="panel"><div class="row spread"><b class="disp" style="font-size:17px">Level ${p.lvl}</b><span class="small muted">+${fmt(Math.max(0, xpFor(res)))} XP</span></div><div class="xp" style="height:10px"><i style="width:${p.pct * 100}%"></i></div><div id="lvlup"></div></section>
      <button class="btn gold xl block" data-act="collect">${ic("coins")} Collect</button>
    </div></div></div>`;
  countUp($("#count"), amount);
  FX.init($("#arena"));
  if (won) setTimeout(() => FX.confetti(140), 250);
}
// XP: what you bank, plus a little for raid damage.
function xpFor(res) {
  if (res.kind === "tax") return res.r.net;
  const mine = res.R.result.shares.find((s) => s.id === "me");
  return mine.reward + mine.dmg / 1000;
}
function countUp(el, to) {
  const start = performance.now(), dur = 900;
  const step = (now) => { const k = Math.min(1, (now - start) / dur); el.textContent = fmt(to * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); else FX.play("coin"); };
  requestAnimationFrame(step);
}
function collect() {
  const res = V.result;
  if (!res || res.banked) return;
  res.banked = true;
  let amount, text;
  if (res.kind === "tax") {
    const r = res.r; amount = r.net; L.debt = 0;
    text = `Taxman: earned ${r.earned}, taxed ${r.taxed}, stole ${r.stolen}`;
  } else {
    const out = res.R.result, mine = out.shares.find((s) => s.id === "me");
    amount = mine.reward;
    if (out.paralysed) L.debt = G.RULES.paralysedSteps;
    if (out.how === "won") L.tier = res.R.tier + 1;
    text = `${res.R.boss.name}: ${{ won: "won", timeout: "out of time", wiped: "wiped" }[out.how]}${out.paralysed ? ", paralysed" : ""}`;
  }
  L.wallet += amount;
  const ups = gainXp(xpFor(res));
  addHistory(text, amount);
  save();
  const btn = $("[data-act=collect]"), [x, y] = FX.centre(btn);
  FX.coins(x, y, 30, x, -40); FX.play("coin");
  const p = G.levelProgress(L.xp);
  $(".results .xp i").style.width = `${p.pct * 100}%`;
  if (ups) { $("#lvlup").innerHTML = `<div class="lvlup ol">Level ${p.lvl}!</div>`; FX.play("levelup"); FX.confetti(100); }
  btn.innerHTML = `Continue ${ic("arrowRight")}`;
  btn.dataset.act = "back";
}

// ---------- my walker from the app ----------
async function useMyWalker() {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("ef_token")); } catch { /* none */ }
  if (!token) return toast("Open the Effort app on this device first, then come back.");
  try {
    const res = await fetch(`${API}/me`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const d = await res.json();
    if (!d.ok || !d.player?.character) return toast("Your account doesn't have a walker yet.");
    L.answers = d.player.character; L.name = d.player.name; L.fromApp = true; L.pos = null;
    save(); render(); toast(`Playing as ${d.player.name}`);
  } catch { toast("Couldn't reach the server."); }
}

// ---------- events ----------
document.addEventListener("pointerdown", (e) => {
  FX.unlock();
  if (!e.target.closest("#stage")) return;
  e.preventDefault();
  if (V.view === "tax") taxTap(e);
  else if (V.view === "raid") raidTap(e);
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form=answer]");
  if (!f || !V.raid) return;
  e.preventDefault();
  const text = $("#tv-in").value.trim();
  if (!text) return;
  const res = G.raidAnswer(V.raid.R, "me", text);
  if (res) FX.play(res.valid ? (res.rarity === 3 ? "rare" : "right") : "wrong");
  paintTrivia();
});
document.addEventListener("click", (e) => {
  if (e.target.id === "sheet") { $("#sheet").hidden = true; return; }
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { V.tab = d.tab; render(); window.scrollTo(0, 0); FX.play("tap"); return; }
  if (d.pos) { L.pos = d.pos; save(); render(); return; }
  if (d.bots) { L.bots = Number(d.bots); save(); render(); return; }
  if (d.botgear) { L.botGear = d.botgear; save(); render(); return; }
  if (d.raidmin) { L.raidMin = Number(d.raidmin); save(); render(); return; }
  if (d.shoptab) { L.shopTab = d.shoptab; save(); render(); return; }
  if (d.item) { itemSheet(d.item, d.deal === "1"); FX.play("tap"); return; }
  if (d.buy) {
    const item = G.itemById(d.buy), price = G.priceOf(item, d.deal === "1");
    if (L.wallet < price || item.id in L.inv) return;
    L.wallet -= price; L.inv[item.id] = 0; L.equipped[item.slot] = item.id;
    addHistory(`Bought ${item.name}`, -price); save(); FX.play("buy"); render(); itemSheet(item.id, false); toast(`${item.name} equipped`);
    return;
  }
  if (d.upgrade) {
    const item = G.itemById(d.upgrade), cost = G.upgradeCost(item, L.inv[item.id]);
    if (L.wallet < cost || L.inv[item.id] >= G.RULES.upgradeMax) return;
    L.wallet -= cost; L.inv[item.id]++;
    addHistory(`Upgraded ${item.name} to +${L.inv[item.id]}`, -cost); save(); FX.play("levelup"); render(); itemSheet(item.id, false);
    return;
  }
  if (d.equip) { const it = G.itemById(d.equip); L.equipped[it.slot] = it.id; save(); FX.play("buy"); render(); itemSheet(it.id, false); return; }
  if (d.unequip) { delete L.equipped[d.unequip]; save(); render(); $("#sheet").hidden = true; return; }
  if (d.move && V.raid) { G.raidMove(V.raid.R, "me", d.move); FX.play("tap"); return; }
  switch (d.act) {
    case "close-sheet": $("#sheet").hidden = true; break;
    case "mute": FX.setMuted(!FX.muted); render(); break;
    case "tax": startTax(Number(d.sec)); break;
    case "skip-tax": {
      const S = taxSetup();
      const taxed = Math.round(S.efforts * S.taxRate), net = S.efforts - taxed;
      L.wallet += net; L.debt = 0; gainXp(net); addHistory(`Paid the Taxman ${taxed} of ${S.efforts}`, net); save(); render(); toast(`Kept ${net} Efforts`);
      break;
    }
    case "tax-stop": if (V.tax) finishTax(); break;
    case "raid": startRaid(); break;
    case "tier-up": L.tier++; save(); render(); break;
    case "tier-down": L.tier = Math.max(1, L.tier - 1); save(); render(); break;
    case "ability": if (V.raid) G.raidAbility(V.raid.R, "me"); break;
    case "raid-quit": if (V.raid && confirm("End the raid now? It counts as running out of time.")) V.raid.R.dur = V.raid.R.t; break;
    case "collect": collect(); break;
    case "back": FX.destroy(); V.result = null; V.view = "main"; render(); window.scrollTo(0, 0); break;
    case "reroll": L.answers = Walker.fallbackAnswers("lab-" + Math.floor(Math.random() * 1e9)); L.name = "You"; L.fromApp = false; L.pos = null; save(); render(); break;
    case "use-mine": useMyWalker(); break;
    case "cheat": L.wallet += 5 * PER_E(); addHistory("Playtest top-up", 5 * PER_E()); save(); FX.play("coin"); render(); break;
    case "cheat-lvl": case "cheat-lvl5": { const to = level() + (d.act === "cheat-lvl" ? 1 : 5); L.xp = Math.max(L.xp, G.xpFor(to)); save(); FX.play("levelup"); render(); toast(`Level ${level()}`); break; }
    case "reset-knobs": L.rules = {}; G.setRules({}); save(); render(); toast("Numbers back to default"); break;
    case "copy-knobs": {
      const changed = Object.entries(L.rules).filter(([k, v]) => v !== G.DEFAULT_RULES[k]).map(([k, v]) => `${k}: ${v} (default ${G.DEFAULT_RULES[k]})`).join("\n") || "No changes";
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(changed).then(() => toast("Copied"), () => prompt("Copy this", changed));
      else prompt("Copy this", changed);
      break;
    }
    case "reset-lab": if (confirm("Reset the lab? Your wallet, level, gear and history on this device are wiped.")) { const keep = L.rules; L = { ...fresh(), rules: keep }; save(); render(); } break;
  }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.input === "steps" || t.dataset.input === "scroll") {
    L[t.dataset.input] = Number(t.value); save();
    $(`#o-${t.dataset.input}`).firstChild.textContent = t.dataset.input === "steps" ? fmt(L.steps) : L.scroll;
    $("#day-tiles").innerHTML = dayTiles();
    syncSliders();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-toggle3d]")) { L.no3d = !e.target.checked; save(); return; }
  const k = e.target.dataset.knob;
  if (!k) return;
  const n = Number(e.target.value);
  const mustBePositive = ["xpPerLevel", "stepsPerEffort", "effortsPerEndeavour", "dailyWindowMin", "raidAtkEvery", "taxmanBaseHp", "raidHpPerMember", "triviaSeconds", "comboWindowMs"];
  if (!Number.isFinite(n) || n < 0 || (n === 0 && mustBePositive.includes(k))) { e.target.value = G.RULES[k]; return toast(n === 0 ? "That one can't be zero" : "Needs a number of zero or more"); }
  L.rules[k] = n; G.setRules(L.rules); save();
  const y = window.scrollY; render(); window.scrollTo(0, y);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) $("#sheet").hidden = true; });

render();
})();
