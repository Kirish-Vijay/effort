// Effort Lab: a sandbox for the new game. Everything runs on this device against bots;
// nothing here touches real players, steps or groups.
(() => {
const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const G = Game, I = EffortItems;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("en-GB");
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const today = () => new Date().toISOString().slice(0, 10);

// ---------- saved lab state ----------
const KEY = "ef_lab";
const fresh = () => ({
  v: 2, answers: Walker.fallbackAnswers("lab-" + Math.floor(Math.random() * 1e9)), name: "You", fromApp: false,
  wallet: 1500, xp: 0, inv: {}, equipped: {}, steps: 9000, scroll: 25, debt: 0,
  bots: 3, botGear: "some", raidMin: 15, pos: null, rules: {}, history: [], shopTab: "class",
});
let L;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  L = saved.v === 2 ? { ...fresh(), ...saved } : { ...fresh(), rules: saved.rules || {} };
} catch { L = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch { /* private mode: lab still works this session */ } };
G.setRules(L.rules);

const V = { tab: "today", view: "main", tax: null, raid: null, result: null };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- derived ----------
const myStats = () => G.stats(L.answers);
const myClass = () => G.classOf(myStats());
const effectiveSteps = () => Math.max(0, L.steps - L.debt);
const level = () => G.levelOf(L.xp);
function addHistory(text, delta) { L.history.unshift({ text, delta, at: Date.now() }); L.history.length = Math.min(L.history.length, 12); }
// Returns how many levels were gained.
function gainXp(n) { const before = level(); L.xp += Math.max(0, Math.round(n)); return level() - before; }

const PERKS = {
  critChance: (v) => `+${Math.round(v * 100)}% crit chance`,
  critDmg: (v) => `+${Math.round(v * 100)}% crit damage`,
  combo: (v) => `Combo builds ${Math.round(v * 100)}% faster`,
  taxStart: (v) => `Start the Taxman fight on a ${v}-hit combo`,
  steal: (v) => `Steal up to ${Math.round(v * 100)}% more from the Taxman`,
  shield: (v) => `Shield Wall lasts ${v}s longer`,
  heal: (v) => `Patch Up heals ${Math.round(v * 100)}% more`,
  swing: (v) => `Big Swing gets ${v} extra taps`,
  thorns: (v) => `Reflect ${Math.round(v * 100)}% of damage taken`,
  lifesteal: (v) => `Heal ${Math.round(v * 100)}% of the damage you deal`,
  cdr: (v) => `Abilities recharge ${Math.round(v * 100)}% faster`,
  trivia: (v) => `+${v}s on trivia`,
  secondWind: () => "Survive one killing blow per raid",
  feast: (v) => `×${v} damage while it feasts`,
  dodge: (v) => `${Math.round(v * 100)}% chance to dodge`,
  loot: (v) => `+${Math.round(v * 100)}% raid rewards`,
};
const perkText = (p) => (p ? PERKS[p[0]]?.(p[1]) || "" : "");
const statLabel = (k) => G.STATS.find((s) => s.id === k)?.label || k;

// ---------- art ----------
function taxmanSvg(beaten) {
  const o = 'stroke="#1f2a24" stroke-width="3.4" stroke-linejoin="round"';
  const eye = (x) => beaten
    ? `<path d="M${x - 6},74 l12,12 M${x + 6},74 l-12,12" stroke="#1f2a24" stroke-width="4" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="80" r="9" fill="#fff" ${o}/><circle cx="${x + 2}" cy="82" r="4" fill="#1f2a24"/>`;
  return `<svg viewBox="0 0 200 210" role="img" aria-label="The Taxman" style="filter:url(#rough)">
    <defs><linearGradient id="suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6b3ab"/><stop offset="1" stop-color="#6c7a71"/></linearGradient>
    <radialGradient id="bag" cx=".35" cy=".35"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#e0a81a"/></radialGradient></defs>
    <ellipse cx="100" cy="200" rx="58" ry="7" fill="#000" opacity=".35"/>
    <path d="M52,190 C40,120 52,62 100,58 C148,62 160,120 148,190 Z" fill="url(#suit)" ${o}/>
    <path d="M86,120 L100,150 L114,120" fill="#d9483b" ${o}/>
    <path d="M70,58 L72,18 L128,18 L130,58 Z" fill="#1f2a24" ${o}/><rect x="58" y="52" width="84" height="10" rx="4" fill="#1f2a24"/>
    <rect x="72" y="40" width="56" height="7" fill="#d9483b"/>
    ${eye(84)}${eye(116)}
    <circle cx="116" cy="80" r="13" fill="rgba(200,230,255,.25)" ${o}/><path d="M129,80 L140,96" ${o} fill="none"/>
    <path d="M78,${beaten ? 112 : 104} Q100,${beaten ? 98 : 118} 122,${beaten ? 112 : 104}" fill="none" ${o} stroke-linecap="round"/>
    <g transform="translate(152 128) rotate(${beaten ? 40 : -8})"><path d="M-4,0 C-28,4 -32,48 0,50 C32,48 28,4 4,0 Z" fill="url(#bag)" ${o}/><path d="M-9,-2 L9,-2" ${o}/>
      <text x="0" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="28" fill="#1f2a24">£</text></g>
    <path d="M40,${beaten ? 160 : 128} L56,140" ${o} fill="none" stroke-linecap="round"/>
  </svg>`;
}
const head = (answers) => Walker.svg(answers, { crop: "head", mood: "fresh" });

// ---------- menus ----------
function render() {
  if (V.view === "tax") return renderTax();
  if (V.view === "raid") return renderRaid();
  if (V.view === "result") return renderResult();
  const tabs = { today: tabToday, sunday: tabSunday, shop: tabShop, knobs: tabKnobs };
  const p = G.levelProgress(L.xp), cls = myClass();
  $("#app").innerHTML = `<div class="top"><div><span class="lab-flag">Test mode</span><h1 style="margin-top:6px">Effort Lab</h1></div>
      <button class="icon-toggle" data-act="mute" aria-label="${FX.muted ? "Sound off" : "Sound on"}">${FX.muted ? "🔇" : "🔊"}</button></div>
    <div class="pcard"><div class="av">${head(L.answers)}</div>
      <div><h2>${esc(L.name)}</h2><div class="cls"><span class="lvlb">LV ${p.lvl}</span>${cls.e} ${esc(cls.name)}</div><div class="xpbar"><i style="width:${p.pct * 100}%"></i></div></div>
      <div class="money"><b>${G.money(L.wallet, true)}</b><small>Endeavours</small></div></div>
    ${tabs[V.tab]()}
    <nav class="nav"><div class="inner">${[["today", "7pm", "⚔️"], ["sunday", "Sunday", "🐉"], ["shop", "Shop", "🛒"], ["knobs", "Knobs", "🎛️"]].map(([k, l, e]) =>
      `<button data-tab="${k}" ${V.tab === k ? 'aria-current="page"' : ""}><span style="font-size:22px">${e}</span>${l}</button>`).join("")}</div></nav>`;
}

function dayLive() {
  const steps = effectiveSteps();
  const S = G.taxmanSetup({ steps, scrollMin: L.scroll, stats: myStats(), equipped: L.equipped, inv: L.inv });
  return `${L.debt ? `<div class="callout" style="border-color:var(--bad)"><b>Paralysed:</b> ${fmt(L.debt)} steps knocked off today from Sunday's failed trivia.</div>` : ""}
    <div class="facts">
      <div class="fact good"><b>${S.efforts}</b><span>Efforts earned today</span></div>
      <div class="fact"><b>${G.scrollBudget(steps)} min</b><span>scroll budget</span></div>
      <div class="fact bad"><b>${Math.round(S.taxRate * 100)}%</b><span>tax if you skip (${Math.round(S.efforts * S.taxRate)} Efforts)</span></div>
      <div class="fact"><b>${fmt(S.hp)}</b><span>Taxman health</span></div>
    </div>`;
}
function tabToday() {
  return `<section class="card">
      <h2>Your day</h2>
      <div class="slider-row"><label for="steps">Steps</label><output id="o-steps">${fmt(L.steps)}</output>
        <input id="steps" type="range" min="0" max="30000" step="500" value="${L.steps}" data-input="steps"></div>
      <div class="slider-row"><label for="scroll">Reels / TikTok / Shorts (min)</label><output id="o-scroll">${L.scroll}</output>
        <input id="scroll" type="range" min="0" max="180" step="5" value="${L.scroll}" data-input="scroll"></div>
      <div id="day-live">${dayLive()}</div>
      <button class="btn block big-cta" data-act="tax" data-sec="${G.RULES.dailyWindowMin * 60}">⚔️ Fight the Taxman</button>
      <div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-act="tax" data-sec="60">1 min test</button><button class="btn ghost sm" data-act="skip-tax">Skip, pay the tax</button></div>
    </section>
    <section class="card">
      <h2>How 7pm works</h2>
      <ul class="rules small" style="padding-left:18px;margin:0">
        <li>100 steps = 1 Effort. 100 Efforts = 1 Endeavour.</li>
        <li>The Taxman wants ${Math.round(G.RULES.baseTax * 100)}% of today's Efforts. Scrolling over budget pushes it up to ${Math.round((G.RULES.baseTax + G.RULES.taxMaxExtra) * 100)}%.</li>
        <li>Tap him for ${G.RULES.dailyWindowMin} minutes. Every hit cuts the tax; knock him out and it's 0%. Then keep going to steal up to ${Math.round(G.RULES.stealCap * 100)}% extra.</li>
        <li>Stop tapping and he wins health back. Every ${G.RULES.auditEvery}s he raises an <b>Audit</b> shield: only the moving 🎯 weak spot takes damage. Grab 🧾 golden receipts for bonus loot.</li>
      </ul>
    </section>
    ${L.history.length ? `<section class="card list hist">${L.history.map((h) => `<div class="list-row"><span class="grow">${esc(h.text)}</span><b style="color:${h.delta >= 0 ? "var(--good)" : "var(--bad)"}">${h.delta >= 0 ? "+" : ""}${esc(G.money(h.delta))}</b></div>`).join("")}</section>` : ""}`;
}

function statBars(st) {
  const { g } = G.loadout(st, L.equipped, L.inv);
  const max = Math.max(18, ...Object.values(g));
  return G.STATS.map((s) => `<div class="stat-row"><span>${s.e} ${s.label}</span>
    <div class="stat-bar" title="${esc(s.what)}"><i style="width:${(st[s.id] / max) * 100}%"></i><i class="gear" style="width:${((g[s.id] - st[s.id]) / max) * 100}%"></i></div>
    <span class="v">${g[s.id]}</span></div>`).join("");
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
function tabSunday() {
  const st = myStats(), cls = myClass(), sug = G.suggestedPosition(st), pos = L.pos || sug;
  const preview = G.raidCreate(botSquad(), { minutes: L.raidMin, seed: 1 });
  return `<section class="card">
      <h2>${cls.e} ${esc(cls.name)}</h2>
      <p class="small muted" style="margin-top:-4px">${esc(cls.blurb)} Your class is your top two stats, and it picks which gear you can buy.</p>
      ${statBars(st)}
      <p class="small muted" style="margin:8px 0">Best in the <b>${G.posOf(sug).label.toLowerCase()}</b> row. Yellow is gear. ${L.fromApp ? "Your walker from the app." : "Random test walker."}</p>
      <div class="btn-row"><button class="btn sm ghost" data-act="reroll">New random walker</button><button class="btn sm ghost" data-act="use-mine">Use my walker</button></div>
    </section>
    <section class="card">
      <h2>Squad</h2>
      <label class="field"><span>Your starting row</span></label>
      <div class="seg three">${G.POSITIONS.map((p) => `<button data-pos="${p.id}" aria-pressed="${p.id === pos}">${p.e} ${p.label}</button>`).join("")}</div>
      <label class="field"><span>Bot teammates</span></label>
      <div class="seg" style="grid-template-columns:repeat(6,1fr)">${[0, 1, 2, 3, 4, 5].map((k) => `<button data-bots="${k}" aria-pressed="${k === L.bots}">${k}</button>`).join("")}</div>
      <label class="field"><span>Bots' gear</span></label>
      <div class="seg three">${["none", "some", "lots"].map((k) => `<button data-botgear="${k}" aria-pressed="${k === L.botGear}">${k}</button>`).join("")}</div>
      <label class="field"><span>Raid length (shorter = smaller boss)</span></label>
      <div class="seg three">${[15, 5, 2].map((k) => `<button data-raidmin="${k}" aria-pressed="${k === L.raidMin}">${k} min</button>`).join("")}</div>
      <div class="facts">
        <div class="fact"><b>Lv ${preview.lvl}</b><span>boss level (from squad gear)</span></div>
        <div class="fact"><b>${fmt(preview.boss.max)}</b><span>boss health</span></div>
        <div class="fact good"><b>${esc(G.money(G.RULES.raidRewardPerMember * preview.members.length * preview.lvl))}</b><span>reward pool if you win</span></div>
        <div class="fact"><b>${preview.members.length}</b><span>in the squad</span></div>
      </div>
      <button class="btn block big-cta" data-act="raid">🐉 Start the raid</button>
    </section>
    <section class="card">
      <h2>How Sunday works</h2>
      <ul class="rules small" style="padding-left:18px;margin:0">
        <li>7pm Sunday, ${G.RULES.raidMin} minutes, whole squad vs <b>${G.BOSS.name}</b>. Tap it.</li>
        <li><b>Rows.</b> ${G.POSITIONS.map((p) => `${p.e} ${p.label}: ×${p.mult} damage, ${p.aggro}% of swipes, <i>${p.ability}</i>`).join(". ")}. Moving rows takes a few seconds.</li>
        <li><b>Attacks</b> are warned ahead: ${Object.values(G.ATTACKS).map((a) => `${a.e} ${a.label} (${a.what})`).join(", ")}.</li>
        <li>Better squad gear = tougher boss = bigger rewards.</li>
        <li><b>Someone dies?</b> Krillion-style trivia: name one thing in ${G.RULES.triviaSeconds}s, three times. Majority of the squad needs a valid answer. Rare answers hit the boss. Fail ${G.RULES.triviaFailAt} and everyone is paralysed: stunned and ${fmt(G.RULES.paralysedSteps)} steps down tomorrow.</li>
      </ul>
    </section>`;
}

// ---------- shop ----------
function itemCard(item, { deal = false } = {}) {
  const t = G.tierOf(item.tier), own = item.id in L.inv, on = L.equipped[item.slot] === item.id, locked = !own && t.lvl > level();
  const st = G.itemStats(item, L.inv[item.id] || 0);
  return `<button class="item ${item.tier} ${locked ? "locked" : ""}" style="--rc:${t.color}" data-item="${item.id}" data-deal="${deal ? 1 : ""}">
    <div class="tile">${item.e}<span class="tier">${t.label}</span>${own && L.inv[item.id] ? `<span class="up">+${L.inv[item.id]}</span>` : ""}${on ? '<span class="on">ON</span>' : ""}</div>
    ${deal ? `<span class="deal-badge">−${Math.round(G.RULES.dealDiscount * 100)}%</span>` : ""}
    <h4>${esc(item.name)}</h4>
    <div class="ichips">${Object.entries(st).map(([k, v]) => `<span class="chip">+${v} ${statLabel(k)}</span>`).join("")}</div>
    ${item.perk ? `<div class="perk">✦ ${esc(perkText(item.perk))}</div>` : ""}
    <div class="price">${locked ? `🔒 Level ${t.lvl}` : own ? (on ? "Equipped" : "Owned") : `🪙 ${G.money(G.priceOf(item, deal), true)}`}</div>
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
    deals: deals.map(G.itemById),
    bag: I.ITEMS.filter((i) => i.id in L.inv).sort(sort),
  };
  const tab = L.shopTab;
  const next = I.TIERS.find((t) => t.lvl > lvl);
  return `<section class="card">
      <div class="row spread"><h2 style="margin:0">Loadout</h2><span class="small muted">tap to swap</span></div>
      <div class="loadout" style="margin-top:10px">${G.SLOTS.map((s) => {
        const it = G.itemById(L.equipped[s]);
        return it ? `<button class="slot full" style="--rc:${G.tierOf(it.tier).color}" data-item="${it.id}"><span><span class="e">${it.e}</span>${esc(it.name)}</span></button>`
          : `<div class="slot"><span><span class="e" style="opacity:.3">${{ weapon: "🗡️", armour: "🛡️", trinket: "💍" }[s]}</span>No ${s}</span></div>`;
      }).join("")}</div>
      ${next ? `<p class="small muted" style="margin:0">${next.label} gear unlocks at level ${next.lvl}.</p>` : ""}
    </section>
    <div class="subtabs">${[["class", `${cls.e} ${cls.name}`], ["all", "Everyone"], ["deals", "🔥 Today's deals"], ["bag", `🎒 Bag (${Object.keys(L.inv).length})`]].map(([k, l]) =>
      `<button data-shoptab="${k}" aria-pressed="${tab === k}">${esc(l)}</button>`).join("")}</div>
    ${tab === "deals" ? `<p class="small muted">Three picks a day, ${Math.round(G.RULES.dealDiscount * 100)}% off. New ones tomorrow.</p>` : ""}
    <div class="items">${lists[tab].length ? lists[tab].map((i) => itemCard(i, { deal: tab === "deals" })).join("") : `<p class="muted small">Nothing here yet.</p>`}</div>
    <div style="height:18px"></div>`;
}
function itemSheet(id, deal) {
  const item = G.itemById(id), t = G.tierOf(item.tier), up = L.inv[id] || 0, own = id in L.inv, on = L.equipped[item.slot] === id;
  const locked = !own && t.lvl > level(), price = G.priceOf(item, deal), cls = item.cls ? I.CLASSES.find((c) => c.id === item.cls) : null;
  const st = G.itemStats(item, up), next = G.itemStats(item, up + 1), cost = G.upgradeCost(item, up);
  const sh = $("#sheet");
  sh.innerHTML = `<div class="panel item-sheet" role="dialog" aria-modal="true" style="--rc:${t.color}"><div class="grab"></div>
    <div class="row spread" style="margin-bottom:10px"><span class="rar" style="background:${t.color};color:#fff">${t.label}${cls ? ` · ${esc(cls.name)}` : ""}</span><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    <div class="item ${item.tier}" style="--rc:${t.color};cursor:default"><div class="tile">${item.e}${up ? `<span class="up">+${up}</span>` : ""}</div></div>
    <h2 style="margin:12px 0 4px">${esc(item.name)}</h2>
    <p class="muted" style="margin:0 0 8px"><i>${esc(item.text)}</i></p>
    <div class="facts">${Object.entries(st).map(([k, v]) => `<div class="fact"><b>+${v}</b><span>${statLabel(k)}${own && up < G.RULES.upgradeMax ? ` → +${next[k]} at +${up + 1}` : ""}</span></div>`).join("")}</div>
    ${item.perk ? `<div class="perk-line">✦ ${esc(perkText(item.perk))}</div>` : ""}
    <div class="btn-row" style="margin-top:10px">
      ${locked ? `<button class="btn block" disabled>🔒 Unlocks at level ${t.lvl}</button>`
        : !own ? `<button class="btn block big-cta" data-buy="${id}" data-deal="${deal ? 1 : ""}" ${L.wallet < price ? "disabled" : ""}>Buy · ${esc(G.money(price))}</button>`
        : `${on ? `<button class="btn ghost" data-unequip="${item.slot}">Take off</button>` : `<button class="btn" data-equip="${id}">Equip</button>`}
           ${up < G.RULES.upgradeMax ? `<button class="btn sun" data-upgrade="${id}" ${L.wallet < cost ? "disabled" : ""}>Upgrade +${up + 1} · ${esc(G.money(cost))}</button>` : `<button class="btn ghost" disabled>Maxed</button>`}`}
    </div></div>`;
  sh.hidden = false;
}

const KNOBS = [
  ["baseTax", "Base tax (0.2 = 20%)"], ["taxPerOverMin", "Extra tax per minute over scroll budget"], ["taxMaxExtra", "Most extra tax from scrolling"],
  ["stealCap", "Most you can steal (0.3 = 30%)"], ["dailyWindowMin", "Taxman fight length (min)"],
  ["taxmanBaseHp", "Taxman base health"], ["taxmanHpPerEffort", "Taxman health per Effort earned"], ["taxmanHpPerOverMin", "Taxman health per minute over budget"],
  ["taxmanRegen", "Health he wins back per second idle"], ["auditEvery", "Seconds between Audit shields"], ["auditFor", "Audit shield length (s)"], ["auditBlock", "Damage through the Audit shield"],
  ["stealDmgPerPct", "Damage for each 1% stolen (× his health)"], ["comboWindowMs", "Combo window (ms between taps)"],
  ["raidHpPerMember", "Raid boss health per squad member"], ["raidLvlPerGear", "Boss level per average gear point"],
  ["raidAtkEvery", "Seconds between boss attacks"], ["raidBossDmg", "Boss swipe damage"], ["raidRewardPerMember", "Win reward per member per level (Efforts)"],
  ["triviaSeconds", "Seconds per trivia prompt"], ["triviaFailAt", "Failed prompts that paralyse"], ["rarityBossDmg", "Boss damage per rarity point"],
  ["paralysedSteps", "Step penalty when paralysed"], ["paralysedStunSec", "Stun when paralysed (s)"], ["xpPerLevel", "XP curve (level n needs this × (n−1)²)"],
  ["dealDiscount", "Daily deal discount"], ["stepsPerEffort", "Steps per Effort"], ["dailyEffortCap", "Most Efforts a day"],
];
function tabKnobs() {
  return `<section class="card">
      <h2>Test cheats</h2>
      <div class="btn-row"><button class="btn sm sun" data-act="cheat">+5 Endeavours</button><button class="btn sm sun" data-act="cheat-lvl">+1 level</button><button class="btn sm sun" data-act="cheat-lvl5">+5 levels</button></div>
    </section>
    <section class="card">
      <h2>Knobs</h2>
      <p class="small muted">Change any number and play again. Changed ones go orange.</p>
      ${KNOBS.map(([k, label]) => `<label class="knob ${L.rules[k] !== undefined && L.rules[k] !== G.DEFAULT_RULES[k] ? "changed" : ""}"><span><b>${label}</b><small>default ${G.DEFAULT_RULES[k]}</small></span>
        <input type="number" step="any" data-knob="${k}" value="${G.RULES[k]}"></label>`).join("")}
      <div class="btn-row" style="margin-top:10px"><button class="btn sm ghost" data-act="copy-knobs">Copy my changes</button><button class="btn sm danger" data-act="reset-knobs">Reset all</button></div>
    </section>
    <section class="card"><h2>Start over</h2><p class="small muted">Wipes the lab wallet, level, gear and history on this device.</p><button class="btn sm danger" data-act="reset-lab">Reset the lab</button></section>`;
}

// ---------- shared battle bits ----------
function banner(text, small = "") {
  const el = document.createElement("div");
  el.className = "banner"; el.innerHTML = `${esc(text)}${small ? `<small>${esc(small)}</small>` : ""}`;
  $("#arena")?.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}
function bossHurt() {
  const b = $("#boss"); if (!b) return;
  b.classList.add("hurt", "squash");
  clearTimeout(bossHurt.t); bossHurt.t = setTimeout(() => b.classList.remove("hurt", "squash"), 90);
}
function setBar(bar, frac, text) {
  const fill = bar.querySelector(".fill"), ghost = bar.querySelector(".ghost");
  fill.style.width = `${Math.max(0, frac) * 100}%`;
  if (ghost) ghost.style.width = `${Math.max(0, frac) * 100}%`;
  bar.querySelector("span").textContent = text;
}
let comboShown = 0;
function paintCombo(combo, mult) {
  const el = $("#combo"); if (!el) return;
  if (combo < 5) { el.innerHTML = ""; comboShown = 0; return; }
  el.innerHTML = `×${mult.toFixed(2)}<small>${combo} COMBO</small>`;
  el.classList.toggle("hot", combo >= 25);
  for (const m of [10, 25, 50]) if (comboShown < m && combo >= m) { FX.play("combo"); el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 120); if (m >= 25) banner(m >= 50 ? "MAX COMBO" : "ON FIRE"); }
  comboShown = combo;
}
function stagePoint(e) {
  const st = $("#stage").getBoundingClientRect();
  return { x: (e.clientX - st.left) / st.width, y: (e.clientY - st.top) / st.height };
}

// ---------- 7pm: the Taxman ----------
function startTax(seconds) {
  FX.unlock();
  const S = G.taxmanSetup({ steps: effectiveSteps(), scrollMin: L.scroll, stats: myStats(), equipped: L.equipped, inv: L.inv });
  S.seconds = seconds;
  V.tax = { B: G.taxmanStart(S), S, left: seconds, last: performance.now() };
  V.view = "tax";
  render();
  V.tax.timer = setInterval(taxTick, 50);
  FX.play("roar");
  setTimeout(() => banner("FIGHT!", `Tax ${Math.round(S.taxRate * 100)}% on the line`), 150);
}
function renderTax() {
  const S = V.tax.S;
  $("#app").innerHTML = `<div class="arena tax" id="arena"><div class="shake-wrap" id="shake">
    <div class="hud">
      <div class="hud-row"><div class="nameplate"><span class="lv">${Math.round(S.taxRate * 100)}%</span><div><b>The Taxman</b><small>Collector of the 7pm levy</small></div></div>
        <span style="flex:1"></span><span class="glass pill timer" id="t-clock">${mmss(V.tax.left)}</span><button class="gbtn" data-act="tax-stop">End</button></div>
      <div class="bigbar green" id="t-hp"><i class="ghost"></i><i class="fill"></i><div class="ticks"></div><span></span></div>
      <div class="bigbar gold" id="t-steal"><i class="fill" style="width:0"></i><span></span></div>
    </div>
    <div class="arena-stage" id="stage">
      <div class="audit-dome" id="dome" hidden></div>
      <div class="boss" id="boss"><div class="halo"></div>${taxmanSvg(false)}</div>
      <div class="weak" id="weak" hidden></div>
      <div class="receipt" id="receipt" hidden>🧾</div>
      <div class="combo-meter" id="combo"></div>
      <div class="tap-hint" id="hint">tap him. fast.</div>
    </div>
    <div class="foot"><div class="feed" id="t-feed"></div></div>
  </div></div>`;
  FX.init($("#arena"));
  paintTax();
}
function taxTick() {
  const v = V.tax; if (!v) return;
  const now = performance.now(), dt = Math.min(0.25, (now - v.last) / 1000);
  v.last = now; v.left -= dt;
  G.taxmanStep(v.B, dt);
  for (const e of v.B.fx.splice(0)) {
    if (e.type === "audit") { FX.play("audit"); banner("AUDIT!", "hit the 🎯 weak spot"); $("#dome").hidden = false; }
    if (e.type === "auditEnd") $("#dome").hidden = true;
    if (e.type === "receipt") FX.play("receipt");
    if (e.type === "ko") {
      FX.play("ko"); banner("K.O.!", "now rob him blind");
      const boss = $("#boss"); boss.innerHTML = `<div class="halo"></div>${taxmanSvg(true)}`;
      const [x, y] = FX.centre(boss); FX.coins(x, y, 26); FX.ring(x, y, { r1: 260, color: "rgba(255,210,80,.9)", width: 16 }); FX.shake($("#shake"), 14, 500);
      $("#hint").textContent = "keep tapping to steal";
    }
  }
  if (v.left <= 0) return finishTax();
  paintTax();
}
function paintTax() {
  const v = V.tax, B = v.B, S = v.S, r = G.taxmanResult(B);
  const clock = $("#t-clock");
  clock.textContent = mmss(v.left); clock.classList.toggle("low", v.left <= 30);
  setBar($("#t-hp"), 1 - B.dmg / S.hp, r.beaten ? "KNOCKED OUT · TAX 0%" : `${fmt(Math.max(0, S.hp - B.dmg))} HP · TAX ${Math.round(S.taxRate * 100 * (1 - r.knocked))}%`);
  setBar($("#t-steal"), r.stealPct / S.stealCap, r.beaten ? `STOLEN +${Math.round(r.stealPct * 100)}% · ${r.stolen} EFFORTS` : "KNOCK HIM OUT TO START STEALING");
  const weak = $("#weak");
  weak.hidden = !B.audit;
  if (B.audit) { weak.style.left = `${B.audit.x * 100}%`; weak.style.top = `${B.audit.y * 100}%`; }
  const rc = $("#receipt");
  rc.hidden = !B.receipt;
  if (B.receipt) { rc.style.left = `${B.receipt.x * 100}%`; rc.style.top = `${B.receipt.y * 100}%`; }
  paintCombo(B.combo, 1 + B.combo / G.RULES.comboMax);
  if (!B.ko && B.dmg > 0 && B.t - B.lastTap > 0.8) $("#t-feed").innerHTML = `<div class="warn">He's recounting his money. Keep tapping!</div>`;
  else if (B.audit) $("#t-feed").innerHTML = `<div class="warn">Audit shield up: only the weak spot takes damage.</div>`;
  else $("#t-feed").innerHTML = "";
}
function taxTap(e) {
  const v = V.tax; if (!v) return;
  const p = stagePoint(e), hit = G.taxmanTap(v.B, p.x, p.y);
  const [x, y] = FX.local(e.clientX, e.clientY);
  if (hit.kind === "receipt") { FX.play("coin"); FX.coins(x, y, 10); FX.number(x, y - 20, hit.bonus, { size: 26, grad: ["#fff3a0", "#f2b51d"] }); return; }
  FX.tapHit(x, y, { crit: hit.crit, dmg: hit.dmg, kind: hit.kind, color: hit.kind === "weak" ? "#6fd4ff" : hit.kind === "blocked" ? "#9aa8ff" : "#ffd166" });
  FX.play(hit.kind === "blocked" ? "blocked" : hit.kind === "weak" ? "weak" : hit.crit ? "crit" : "hit");
  if (hit.crit || hit.kind === "weak") { FX.shake($("#shake"), 6, 180); FX.buzz(20); } else FX.buzz(6);
  if (v.B.ko && (hit.crit || Math.random() < 0.25)) { FX.coins(x, y, hit.crit ? 6 : 2); FX.play("coin"); }
  if (hit.kind !== "blocked") bossHurt();
}
function finishTax() {
  const v = V.tax;
  clearInterval(v.timer);
  const r = G.taxmanResult(v.B);
  r.taps = v.B.taps; r.crits = v.B.crits; r.weak = v.B.weak; r.receipts = v.B.receipts;
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
  V.raid = { R: G.raidCreate(squad, { minutes: L.raidMin }), last: performance.now(), q: null, bossPct: 1, myTaps: 0 };
  V.view = "raid";
  render();
  V.raid.timer = setInterval(raidTick, 50);
  FX.play("roar");
  setTimeout(() => banner(G.BOSS.name.toUpperCase(), "squad up"), 150);
}
const mateHtml = (m) => `<div class="mate ${m.you ? "me" : ""}" id="m-${m.id}"><div class="ring"><div class="face">${head(m.answers)}</div></div><div class="nm">${esc(m.you ? "You" : m.name)}</div><span class="st"></span></div>`;
function renderRaid() {
  const R = V.raid.R;
  $("#app").innerHTML = `<div class="arena raid" id="arena"><div class="shake-wrap" id="shake">
    <div class="hud">
      <div class="hud-row"><div class="nameplate"><span class="lv">LV ${R.lvl}</span><div><b>${esc(R.boss.name)}</b><small>${esc(R.boss.title)}</small></div></div>
        <span style="flex:1"></span><span class="glass pill timer" id="r-clock"></span><button class="gbtn" data-act="raid-quit">End</button></div>
      <div class="bigbar" id="r-hp"><i class="ghost"></i><i class="fill"></i><div class="ticks"></div><span></span></div>
    </div>
    <div class="telegraph idle" id="tele"><span class="e">👁️</span><span class="txt">It's watching…</span><i class="cd"></i></div>
    <div class="arena-stage" id="stage"><div class="boss" id="boss"><div class="halo"></div>${Walker.boss(1, false)}</div><div class="combo-meter" id="combo"></div><div class="tap-hint" id="hint">tap the boss</div></div>
    <div class="party">${G.POSITIONS.map((p) => `<div class="prow"><b title="${p.label}">${p.e}</b><div class="who" id="row-${p.id}"></div></div>`).join("")}</div>
    <div class="foot"><div class="feed" id="feed"></div>
      <div class="controls"><button class="ability" id="ab" data-act="ability"><span class="e"></span><span class="lbl"></span></button>
        <div class="moves">${G.POSITIONS.map((p) => `<button data-move="${p.id}">${p.e}<br>${p.label}</button>`).join("")}</div></div>
    </div>
  </div><div id="trivia"></div><div id="veil"></div></div>`;
  for (const m of R.members) $(`#row-${m.pos}`).insertAdjacentHTML("beforeend", mateHtml(m));
  FX.init($("#arena"));
  paintRaid();
}
function raidTick() {
  const v = V.raid; if (!v) return;
  const now = performance.now();
  let dt = (now - v.last) / 1000;
  v.last = now;
  while (dt > 0 && !v.R.over) { G.raidStep(v.R, Math.min(0.25, dt)); dt -= 0.25; }
  for (const e of v.R.fx.splice(0)) raidFx(e);
  if (v.R.over) return finishRaid();
  paintRaid();
}
const mateEl = (id) => $(`#m-${id}`);
const mateXY = (id) => (mateEl(id) ? FX.centre(mateEl(id)) : [0, 0]);
function raidFx(e) {
  const R = V.raid.R, boss = $("#boss");
  const [bx, by] = boss ? FX.centre(boss) : [0, 0];
  switch (e.type) {
    case "windup": boss.classList.add("windup"); FX.play("warn"); break;
    case "attack": {
      boss.classList.remove("windup"); boss.classList.add(`atk-${e.attack}`);
      setTimeout(() => boss.classList.remove(`atk-${e.attack}`), 1200);
      if (e.attack === "swipe") { FX.play("swipe"); for (const id of e.ids) { const [x, y] = mateXY(id); FX.claw(x, y); } FX.shake($("#shake"), 6, 220); }
      if (e.attack === "stomp") { FX.play("stomp"); const r = $(".party").getBoundingClientRect(), h = $("#arena").getBoundingClientRect(); FX.stompWave(r.left + r.width / 2 - h.left, r.top - h.top + 20); FX.shake($("#shake"), 16, 500); }
      if (e.attack === "scream") { FX.play("scream"); FX.screamWaves(bx, by); FX.shake($("#shake"), 10, 600); }
      if (e.attack === "feast") { FX.play("feast"); FX.chomp(bx, by + 30); banner("FEAST!", "burst it down"); }
      break;
    }
    case "hurt": {
      const el = mateEl(e.id); if (!el) break;
      el.classList.remove("hurt"); void el.offsetWidth; el.classList.add("hurt");
      const [x, y] = mateXY(e.id); FX.number(x, y - 20, `-${e.amt}`, { size: 22, color: "#ff6b6b" });
      if (e.id === "me") { FX.flash($("#arena")); FX.play("hurt"); FX.buzz(40); }
      break;
    }
    case "dodge": { const [x, y] = mateXY(e.id); FX.number(x, y - 20, "DODGE", { size: 20, color: "#9af0ff" }); break; }
    case "shield": { FX.play("shield"); const r = $("#row-front").getBoundingClientRect(), h = $("#arena").getBoundingClientRect(); FX.shieldDome(r.left + r.width / 2 - h.left, r.top + r.height / 2 - h.top, r.width); break; }
    case "swing": { FX.play("swing"); const [x, y] = mateXY(e.by); FX.number(x, y - 30, "BIG SWING!", { size: 22, grad: ["#fff3a0", "#ff7a3d"] }); break; }
    case "heal": { FX.play("heal"); const [x, y] = mateXY(e.id); FX.heal(x, y); FX.number(x, y - 26, `+${e.amt}`, { size: 22, color: "#7ee29d" }); const [sx, sy] = mateXY(e.by); FX.beam(sx, sy, x, y, "#7ee29d", 6); break; }
    case "down": { FX.play("down"); const [x, y] = mateXY(e.id); FX.number(x, y - 20, "DOWN", { size: 22, color: "#ff6b6b" }); FX.sparks(x, y, "#ff6b6b", 16, 300); break; }
    case "secondWind": { const [x, y] = mateXY(e.id); FX.number(x, y - 26, "SECOND WIND", { size: 20, grad: ["#ffffff", "#7ee29d"] }); FX.play("revive"); break; }
    case "revive": FX.play("revive"); for (const id of e.ids) { const [x, y] = mateXY(id); FX.heal(x, y); } banner("BACK UP!"); break;
    case "phase": FX.play("phase"); $("#arena").classList.toggle("p2", e.phase === 2); $("#arena").classList.toggle("p3", e.phase === 3); banner(e.phase === 2 ? "PHASE 2" : "ENRAGED", e.phase === 2 ? "it hits harder" : "it's fast now"); FX.shake($("#shake"), 14, 600); break;
    case "feastEnd": if (e.healed) { FX.number(bx, by - 40, `+${fmt(e.healed)}`, { size: 30, color: "#7ee29d" }); FX.play("heal"); } else { FX.number(bx, by - 40, "INTERRUPTED", { size: 26, grad: ["#fff3a0", "#ff7a3d"] }); FX.play("combo"); } break;
    case "trivia": FX.play("warn"); break;
    case "answer": FX.play(e.ok ? (e.rarity >= 5 ? "rare" : "right") : "wrong"); if (e.dive) { FX.number(bx, by, `-${fmt(e.dive)}`, { size: 38, grad: ["#c8f7ff", "#2bb3ff"] }); FX.sparks(bx, by, "#6fd4ff", 24, 600); bossHurt(); } break;
    case "paralysed": FX.play("stun"); banner("PARALYSED", `${fmt(G.RULES.paralysedSteps)} steps down tomorrow`); break;
  }
}
function paintRaid() {
  const v = V.raid, R = v.R, B = R.boss, me = R.members.find((m) => m.id === "me");
  const clock = $("#r-clock"); clock.textContent = mmss(R.dur - R.t); clock.classList.toggle("low", R.dur - R.t <= 30);
  setBar($("#r-hp"), B.hp / B.max, `${fmt(B.hp)} / ${fmt(B.max)}`);
  // Swap boss art as it takes damage (cracks appear).
  const pct = Math.ceil((B.hp / B.max) * 10) / 10;
  if (pct !== v.bossPct) { v.bossPct = pct; const b = $("#boss"); const cls = b.className; b.innerHTML = `<div class="halo"></div>${Walker.boss(B.hp / B.max, false)}`; b.className = cls; }
  const tele = $("#tele");
  if (B.feast) {
    tele.className = "telegraph feast";
    tele.querySelector(".e").textContent = "🍗";
    tele.querySelector(".txt").textContent = `Feasting! ${fmt(B.feast.dealt)} / ${fmt(B.feast.need)} damage`;
    tele.querySelector(".cd").style.width = `${Math.max(0, (B.feast.until - R.t) / 6) * 100}%`;
  } else if (B.next && R.t >= B.next.warnAt) {
    const a = G.ATTACKS[B.next.type], total = B.next.at - B.next.warnAt;
    tele.className = "telegraph hot";
    tele.querySelector(".e").textContent = a.e;
    tele.querySelector(".txt").textContent = `${a.label} in ${Math.max(0, B.next.at - R.t).toFixed(1)}s · ${a.what}`;
    tele.querySelector(".cd").style.width = `${Math.max(0, (B.next.at - R.t) / total) * 100}%`;
  } else {
    tele.className = "telegraph idle";
    tele.querySelector(".e").textContent = "👁️";
    tele.querySelector(".txt").textContent = `Phase ${B.phase} · it's watching…`;
    tele.querySelector(".cd").style.width = "0";
  }
  for (const m of R.members) {
    const el = mateEl(m.id);
    if (el.parentElement.id !== `row-${m.pos}`) $(`#row-${m.pos}`).appendChild(el);
    const f = m.hp / m.max;
    el.style.setProperty("--hp", f);
    el.style.setProperty("--hpc", f > 0.5 ? "#5fe08f" : f > 0.25 ? "#ffd166" : "#ff6b6b");
    el.classList.toggle("dead", !m.alive);
    el.classList.toggle("shielded", R.t < m.shieldUntil);
    el.querySelector(".st").textContent = !m.alive ? "💀" : R.t < m.stunUntil ? "⚡" : R.t < m.moveUntil ? "↔️" : m.swing ? "💥" : "";
  }
  const ab = $("#ab"), p = G.posOf(me.pos), cd = Math.max(0, me.cdUntil - R.t), total = G.abilityCd(me);
  ab.querySelector(".e").textContent = p.e;
  ab.querySelector(".lbl").textContent = cd > 0 ? `${Math.ceil(cd)}s` : p.ability;
  ab.style.setProperty("--cd", `${cd > 0 ? (cd / total) * 360 : 0}deg`);
  ab.disabled = cd > 0 || !me.alive;
  ab.classList.toggle("ready", cd <= 0 && me.alive && R.t >= me.stunUntil);
  document.querySelectorAll("[data-move]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.move === me.pos)));
  $("#hint").textContent = !me.alive ? "you're down. answer below" : R.t < me.stunUntil ? "paralysed…" : R.t < me.moveUntil ? "moving…" : me.swing ? `BIG SWING · ${me.swing} hits left` : "tap the boss";
  paintCombo(me.combo, 1 + me.combo / (G.RULES.comboMax * 2));
  $("#feed").innerHTML = R.log.slice(0, 2).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join("");
  $("#veil").innerHTML = me.alive && R.t < me.stunUntil ? `<div class="stun-veil">⚡ PARALYSED ⚡<br>${Math.ceil(me.stunUntil - R.t)}s</div>` : !me.alive ? '<div class="down-veil"></div>' : "";
  paintTrivia();
}
function paintTrivia() {
  const v = V.raid, R = v.R, T = R.trivia, box = $("#trivia");
  if (!T) { if (box.innerHTML) box.innerHTML = ""; v.q = null; return; }
  const key = `${R.triviaRuns}-${T.i}`, Q = T.qs[T.i];
  const me = R.members.find((m) => m.id === "me");
  if (v.q !== key) {
    v.q = key; v.ticked = 0;
    box.innerHTML = `<div class="trivia"><div class="top"><span>Squad trivia · ${T.i + 1} of ${T.qs.length} · ${T.right} passed, ${T.wrong} failed</span><div class="clock" id="tv-clock"><span></span></div></div>
      <h3>${esc(Q.q)}</h3>
      <form data-form="answer"><input id="tv-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Type one thing…" maxlength="40"><button class="go">Go</button></form>
      <div class="verdict" id="tv-verdict"></div>
      <div class="meta" id="tv-votes"></div></div>`;
    setTimeout(() => $("#tv-in")?.focus(), 50);
  }
  const left = Math.max(0, T.until - R.t);
  const clock = $("#tv-clock");
  clock.style.setProperty("--t", left / T.secs); clock.classList.toggle("low", left <= 5);
  clock.querySelector("span").textContent = Math.ceil(left);
  if (left <= 5 && Math.ceil(left) !== v.ticked) { v.ticked = Math.ceil(left); FX.play("tick"); }
  const answers = T.answers[T.i];
  $("#tv-votes").innerHTML = R.members.map((m) => {
    const a = answers[m.id];
    return `<span class="vote ${a ? (a.valid ? "ok" : "no") : ""}">${esc(m.you ? "You" : m.name)} ${a ? (a.valid ? "✓" : "✗") : "…"}</span>`;
  }).join("");
  const mine = answers.me;
  if (mine) {
    const form = $("#trivia form"); if (form) form.remove();
    $("#tv-verdict").innerHTML = mine.valid
      ? `✓ ${esc(mine.canon)} <span class="rar r${mine.rarity}">${["", "obvious", "decent", "rare!"][mine.rarity]}</span>`
      : `✗ “${esc(mine.text)}” doesn't count. <span style="opacity:.7">Deep cuts: ${esc(Q.examples.join(", "))}</span>`;
  }
  if (!me.alive && !mine) $("#hint").textContent = "you're down. answer below";
}
function raidTap(e) {
  const v = V.raid; if (!v) return;
  const hit = G.raidTap(v.R, "me");
  if (!hit) return;
  const [x, y] = FX.local(e.clientX, e.clientY);
  FX.tapHit(x, y, { crit: hit.crit, dmg: hit.dmg, color: hit.swing ? "#ff9f43" : "#ffd166" });
  FX.play(hit.crit || hit.swing ? "crit" : "hit");
  if (hit.crit || hit.swing) { FX.shake($("#shake"), hit.swing ? 9 : 5, 180); FX.buzz(18); } else FX.buzz(5);
  bossHurt();
}
function finishRaid() {
  const v = V.raid;
  clearInterval(v.timer);
  FX.destroy();
  V.result = { kind: "raid", R: v.R, banked: false };
  V.raid = null; V.view = "result";
  render();
  FX.play(v.R.result.how === "won" ? "win" : "lose");
}

// ---------- results ----------
function renderResult() {
  const res = V.result;
  let html;
  if (res.kind === "tax") {
    const r = res.r;
    html = `<div class="results ${r.beaten ? "" : "lost"}" id="arena"><div class="inner">
      <h1>${r.beaten ? "Taxman down." : "He got some."}</h1>
      <div class="sub">${fmt(r.taps)} taps · ${r.crits} crits · ${r.weak} weak-spot hits · ${r.receipts} receipts · ${Math.round(r.knocked * 100)}% of his health</div>
      <div class="rcard">
        <div class="rline plus"><span>Efforts from steps</span><b>+${r.earned}</b></div>
        <div class="rline minus"><span>Taxman took (${Math.round(r.taxRate * (1 - r.knocked) * 100)}%)</span><b>−${r.taxed}</b></div>
        <div class="rline plus"><span>Stolen back (${Math.round(r.stealPct * 100)}%)</span><b>+${r.stolen}</b></div>
        <div class="rline total"><span>You keep</span><b id="count">0</b></div>
      </div>
      ${resultFooter(r.net)}
    </div></div>`;
    $("#app").innerHTML = html;
    countUp($("#count"), r.net);
  } else {
    const R = res.R, out = R.result, mine = out.shares.find((s) => s.id === "me");
    const title = { won: "The Algorithm is down.", timeout: "Out of time.", wiped: "Squad wiped." }[out.how];
    const T = R.lastTrivia;
    html = `<div class="results ${out.how === "won" ? "" : "lost"}" id="arena"><div class="inner">
      <h1>${title}</h1>
      <div class="sub">${Math.round(out.frac * 100)}% of its health in ${mmss(R.t)} · level ${out.lvl} · ${R.triviaRuns} trivia round${R.triviaRuns === 1 ? "" : "s"}${out.deepDive ? ` · rare answers hit for ${fmt(out.deepDive)}` : ""}</div>
      ${out.paralysed ? `<div class="rcard" style="border-color:#ff8a8a"><b>⚡ Paralysed.</b> Everyone starts tomorrow ${fmt(G.RULES.paralysedSteps)} steps down.</div>` : ""}
      <div class="rcard"><table class="rtable"><tr><th>Who</th><th>Damage</th><th>Healed</th><th>Took</th><th>Reward</th></tr>
        ${out.shares.map((s) => `<tr class="${s.id === "me" ? "me" : ""}"><td>${esc(s.id === "me" ? "You" : s.name)}</td><td>${fmt(s.dmg)}</td><td>${fmt(s.healed)}</td><td>${fmt(s.taken)}</td><td>${s.reward}</td></tr>`).join("")}</table></div>
      ${T ? `<div class="rcard"><b>Last trivia round</b>${T.results.map((q) => `<div class="rline"><span>${esc(q.q)}<br><small style="opacity:.7">${esc(q.answers.me ? `You: ${q.answers.me.text}` : "You didn't answer")} · deep cuts: ${esc(q.examples.join(", "))}</small></span><b>${q.ok ? "✓" : "✗"}</b></div>`).join("")}</div>` : ""}
      <div class="rcard"><div class="rline total"><span>Your share</span><b id="count">0</b></div></div>
      ${resultFooter(mine.reward)}
    </div></div>`;
    $("#app").innerHTML = html;
    countUp($("#count"), mine.reward);
  }
  FX.init($("#arena"));
  if ((res.kind === "tax" && res.r.beaten) || (res.kind === "raid" && res.R.result.how === "won")) setTimeout(() => FX.confetti(140), 250);
}
function resultFooter(amount) {
  const p = G.levelProgress(L.xp);
  return `<div class="rcard"><div class="row spread"><b>Level ${p.lvl}</b><span class="small" style="opacity:.75">+${fmt(Math.max(0, amount))} XP</span></div><div class="xpbar"><i style="width:${p.pct * 100}%"></i></div><div id="lvlup"></div></div>
    <button class="btn block big-cta" data-act="collect">🪙 Collect ${esc(G.money(amount))}</button>`;
}
function countUp(el, to) {
  const start = performance.now(), dur = 900;
  const step = (now) => { const k = Math.min(1, (now - start) / dur); el.textContent = G.money(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); else FX.play("coin"); };
  requestAnimationFrame(step);
}
function collect() {
  const res = V.result;
  if (res.banked) return;
  res.banked = true;
  let amount, text, xp;
  if (res.kind === "tax") {
    const r = res.r; amount = r.net; xp = r.net; L.debt = 0;
    text = `Taxman: earned ${r.earned}, taxed ${r.taxed}, stole ${r.stolen}`;
  } else {
    const out = res.R.result, mine = out.shares.find((s) => s.id === "me");
    amount = mine.reward; xp = mine.reward + mine.dmg / 1000;
    if (out.paralysed) L.debt = G.RULES.paralysedSteps;
    text = `Sunday raid (${out.how}, ${Math.round(out.frac * 100)}%)${out.paralysed ? ", paralysed" : ""}`;
  }
  L.wallet += amount;
  const ups = gainXp(xp);
  addHistory(text, amount);
  save();
  const btn = $("[data-act=collect]"), [x, y] = FX.centre(btn);
  FX.coins(x, y, 30, x, -40); FX.play("coin");
  const p = G.levelProgress(L.xp);
  $(".results .xpbar i").style.width = `${p.pct * 100}%`;
  if (ups) { $("#lvlup").innerHTML = `<div class="lvlup">LEVEL UP! → ${p.lvl}</div>`; FX.play("levelup"); FX.confetti(100); }
  btn.textContent = "Back to the lab";
  btn.dataset.act = "back";
}

// ---------- my walker from the app ----------
async function useMyWalker() {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("ef_token")); } catch { /* none */ }
  if (!token) return toast("Open the Effort app on this device first, then come back");
  try {
    const res = await fetch(`${API}/me`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const d = await res.json();
    if (!d.ok || !d.player?.character) return toast("Your account has no walker yet");
    L.answers = d.player.character; L.name = d.player.name; L.fromApp = true; L.pos = null;
    save(); render(); toast(`Using ${d.player.name}'s walker`);
  } catch { toast("Couldn't reach the server"); }
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
    if (L.wallet < price) return toast("Not enough in the wallet");
    L.wallet -= price; L.inv[item.id] = 0; L.equipped[item.slot] = item.id;
    addHistory(`Bought ${item.name}`, -price); save(); FX.play("buy"); render(); itemSheet(item.id, false); toast(`${item.name} equipped`);
    return;
  }
  if (d.upgrade) {
    const item = G.itemById(d.upgrade), cost = G.upgradeCost(item, L.inv[item.id]);
    if (L.wallet < cost) return toast("Not enough in the wallet");
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
      const S = G.taxmanSetup({ steps: effectiveSteps(), scrollMin: L.scroll });
      const taxed = Math.round(S.efforts * S.taxRate), net = S.efforts - taxed;
      L.wallet += net; L.debt = 0; gainXp(net); addHistory(`Skipped the Taxman: earned ${S.efforts}, taxed ${taxed}`, net); save(); render();
      break;
    }
    case "tax-stop": if (V.tax) finishTax(); break;
    case "raid": startRaid(); break;
    case "ability": if (V.raid) G.raidAbility(V.raid.R, "me"); break;
    case "raid-quit": if (V.raid && confirm("End the raid now? It counts as running out of time.")) V.raid.R.dur = V.raid.R.t; break;
    case "collect": collect(); break;
    case "back": FX.destroy(); V.result = null; V.view = "main"; render(); window.scrollTo(0, 0); break;
    case "reroll": L.answers = Walker.fallbackAnswers("lab-" + Math.floor(Math.random() * 1e9)); L.name = "You"; L.fromApp = false; L.pos = null; save(); render(); break;
    case "use-mine": useMyWalker(); break;
    case "cheat": L.wallet += 500; addHistory("Test top-up", 500); save(); FX.play("coin"); render(); break;
    case "cheat-lvl": case "cheat-lvl5": { const to = level() + (d.act === "cheat-lvl" ? 1 : 5); L.xp = Math.max(L.xp, G.xpFor(to)); save(); FX.play("levelup"); render(); toast(`Level ${level()}`); break; }
    case "reset-knobs": L.rules = {}; G.setRules({}); save(); render(); toast("Back to defaults"); break;
    case "copy-knobs": {
      const changed = Object.entries(L.rules).filter(([k, v]) => v !== G.DEFAULT_RULES[k]).map(([k, v]) => `${k}: ${v} (was ${G.DEFAULT_RULES[k]})`).join("\n") || "No changes";
      navigator.clipboard?.writeText(changed).then(() => toast("Copied"), () => prompt("Copy this", changed));
      break;
    }
    case "reset-lab": if (confirm("Reset the lab?")) { const keep = L.rules; L = { ...fresh(), rules: keep }; save(); render(); } break;
  }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.input === "steps" || t.dataset.input === "scroll") {
    L[t.dataset.input] = Number(t.value); save();
    $(`#o-${t.dataset.input}`).textContent = t.dataset.input === "steps" ? fmt(L.steps) : L.scroll;
    $("#day-live").innerHTML = dayLive();
  }
});
document.addEventListener("change", (e) => {
  const k = e.target.dataset.knob;
  if (!k) return;
  const n = Number(e.target.value);
  if (!Number.isFinite(n)) return toast("Needs a number");
  L.rules[k] = n; G.setRules(L.rules); save();
  const y = window.scrollY; render(); window.scrollTo(0, y);
});

render();
})();
