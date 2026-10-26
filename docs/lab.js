// Effort Lab: a sandbox for the new game. Everything runs on this device against bots;
// nothing here touches real players, steps or groups.
(() => {
const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const G = Game;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("en-GB");
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// ---------- saved lab state ----------
const KEY = "ef_lab";
const fresh = () => ({
  answers: Walker.fallbackAnswers("lab-" + Math.floor(Math.random() * 1e9)), name: "You", fromApp: false,
  wallet: 500, owned: [], equipped: {}, steps: 9000, scroll: 25, debt: 0,
  bots: 3, botGear: "some", raidMin: 15, pos: null, rules: {}, history: [],
});
let L;
try { L = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { L = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch { /* private mode: lab still works this session */ } };
G.setRules(L.rules);

const V = { tab: "today", view: "main", battle: null, raid: null, taxEnd: null };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- derived numbers ----------
const myStats = () => G.stats(L.answers);
const effectiveSteps = () => Math.max(0, L.steps - L.debt);
function addHistory(text, delta) { L.history.unshift({ text, delta, at: Date.now() }); L.history.length = Math.min(L.history.length, 12); }

// ---------- art ----------
function taxmanSvg(pct, beaten) {
  const o = 'stroke="#1f2a24" stroke-width="3.4" stroke-linejoin="round"';
  const eye = (x) => beaten
    ? `<path d="M${x - 6},74 l12,12 M${x + 6},74 l-12,12" stroke="#1f2a24" stroke-width="4" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="80" r="9" fill="#fff" ${o}/><circle cx="${x + (pct < 0.5 ? -2 : 2)}" cy="82" r="4" fill="#1f2a24"/>`;
  return `<svg viewBox="0 0 200 210" role="img" aria-label="The Taxman" style="filter:url(#rough)">
    <ellipse cx="100" cy="200" rx="58" ry="7" fill="#1f2a24" opacity=".15"/>
    <path d="M52,190 C40,120 52,62 100,58 C148,62 160,120 148,190 Z" fill="#8d9a92" ${o}/>
    <path d="M70,58 L72,18 L128,18 L130,58 Z" fill="#1f2a24" ${o}/><rect x="58" y="52" width="84" height="10" rx="4" fill="#1f2a24"/>
    <rect x="72" y="40" width="56" height="7" fill="#d9483b"/>
    ${eye(84)}${eye(116)}
    <circle cx="116" cy="80" r="13" fill="none" ${o}/><path d="M129,80 L140,96" ${o} fill="none"/>
    <path d="M82,${beaten ? 112 : 106} Q100,${beaten ? 100 : 118} 118,${beaten ? 112 : 106}" fill="none" ${o} stroke-linecap="round"/>
    <path d="M100,124 L100,176" stroke="#1f2a24" stroke-width="2" stroke-dasharray="4 6"/>
    <g transform="translate(150 132) rotate(${beaten ? 30 : -8})"><path d="M-4,0 C-26,4 -30,44 0,46 C30,44 26,4 4,0 Z" fill="#f5c542" ${o}/><path d="M-8,-2 L8,-2" ${o}/><text x="0" y="36" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="28" fill="#1f2a24">£</text></g>
    <path d="M40,${beaten ? 160 : 130} L56,140" ${o} fill="none" stroke-linecap="round"/>
  </svg>`;
}
const head = (answers) => Walker.svg(answers, { crop: "head", mood: "fresh" });

// ---------- views ----------
function render() {
  const app = $("#app");
  if (V.view === "taxman") return renderTaxman();
  if (V.view === "raid") return renderRaid();
  if (V.view === "taxEnd") { app.innerHTML = viewTaxEnd(); return; }
  if (V.view === "raidEnd") { app.innerHTML = viewRaidEnd(); return; }
  const tabs = { today: tabToday, sunday: tabSunday, gear: tabGear, knobs: tabKnobs };
  app.innerHTML = `<div class="top"><div><span class="lab-flag">Test mode</span><h1 style="margin-top:6px">Effort Lab</h1></div>
      <div class="wallet">${esc(G.money(L.wallet))}<small>in your wallet</small></div></div>
    ${tabs[V.tab]()}
    <nav class="nav"><div class="inner">${[["today", "7pm", "⚔️"], ["sunday", "Sunday", "🐉"], ["gear", "Gear", "🎒"], ["knobs", "Knobs", "🎛️"]].map(([k, l, e]) =>
      `<button data-tab="${k}" ${V.tab === k ? 'aria-current="page"' : ""}><span style="font-size:22px">${e}</span>${l}</button>`).join("")}</div></nav>`;
}

function dayLive() {
  const steps = effectiveSteps();
  const S = G.taxmanSetup({ steps, scrollMin: L.scroll, stats: myStats(), equipped: L.equipped });
  const budget = G.scrollBudget(steps);
  return `${L.debt ? `<div class="callout" style="border-color:var(--bad)"><b>Paralysed:</b> ${fmt(L.debt)} steps knocked off today from Sunday's failed trivia.</div>` : ""}
      <div class="facts">
        <div class="fact good"><b>${S.efforts}</b><span>Efforts earned today</span></div>
        <div class="fact"><b>${budget} min</b><span>scroll budget</span></div>
        <div class="fact bad"><b>${Math.round(S.taxRate * 100)}%</b><span>tax if you skip (${Math.round(S.efforts * S.taxRate)} Efforts)</span></div>
        <div class="fact"><b>${fmt(S.hp)}</b><span>Taxman health${S.over ? ` (+${S.over * G.RULES.taxmanHpPerOverMin} for scrolling)` : ""}</span></div>
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
      <div class="btn-row"><button class="btn block" data-act="taxman" data-sec="${G.RULES.dailyWindowMin * 60}">Fight the Taxman (${G.RULES.dailyWindowMin} min)</button></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn ghost sm" data-act="taxman" data-sec="60">1 min test</button><button class="btn ghost sm" data-act="skip-tax">Skip, pay the tax</button></div>
    </section>
    <section class="card">
      <h2>How 7pm works</h2>
      <ul class="rules small" style="padding-left:18px;margin:0">
        <li>100 steps = 1 Effort. 100 Efforts = 1 Endeavour.</li>
        <li>At 7pm the Taxman turns up for ${G.RULES.dailyWindowMin} minutes and wants ${Math.round(G.RULES.baseTax * 100)}% of today's Efforts. Scrolling over budget raises it, up to ${Math.round((G.RULES.baseTax + G.RULES.taxMaxExtra) * 100)}%.</li>
        <li>Tap to hit him. Every hit cuts the tax. Knock him out and it's 0%.</li>
        <li>Keep tapping after that and you steal up to ${Math.round(G.RULES.stealCap * 100)}% extra. Fast taps build a combo (up to 2× damage). You can't die.</li>
      </ul>
    </section>
    ${L.history.length ? `<section class="card list hist">${L.history.map((h) => `<div class="list-row"><span class="grow">${esc(h.text)}</span><b style="color:${h.delta >= 0 ? "var(--good)" : "var(--bad)"}">${h.delta >= 0 ? "+" : ""}${esc(G.money(h.delta))}</b></div>`).join("")}</section>` : ""}`;
}

function statBars(st, eq) {
  const g = G.withGear(st, eq);
  return G.STATS.map((s) => `<div class="stat-row"><span>${s.e} ${s.label}</span>
    <div class="stat-bar" title="${esc(s.what)}"><i style="width:${(st[s.id] / 18) * 100}%"></i><i class="gear" style="width:${((g[s.id] - st[s.id]) / 18) * 100}%"></i></div>
    <span class="v">${g[s.id]}</span></div>`).join("");
}

function botSquad() {
  const names = ["Priya", "Tom", "Jas", "Mo", "Ellie"];
  const kit = { none: {}, some: { weapon: "umbrella", armour: "hoodie" }, lots: { weapon: "bat", armour: "binlid", trinket: "trainers" } }[L.botGear];
  const st = myStats();
  const bots = names.slice(0, L.bots).map((name, i) => {
    const answers = Walker.fallbackAnswers("bot-" + name);
    return { id: "bot" + i, name, answers, stats: G.stats(answers), equipped: kit, bot: true };
  });
  // Fill the rows the player isn't covering so a test squad always has some shape.
  const mine = L.pos || G.suggestedPosition(st);
  const need = ["front", "back", "mid"].filter((p) => p !== mine);
  bots.forEach((b, i) => (b.pos = need[i] || G.suggestedPosition(b.stats)));
  return [{ id: "me", you: true, name: L.name, answers: L.answers, stats: st, equipped: L.equipped, pos: mine }, ...bots];
}

function tabSunday() {
  const st = myStats(), sug = G.suggestedPosition(st), pos = L.pos || sug;
  const squad = botSquad();
  const n = squad.length;
  const avg = squad.reduce((s, m) => s + G.gearPoints(m.equipped), 0) / n;
  const lvl = Math.round((1 + avg * G.RULES.raidLvlPerGear) * 100) / 100;
  const hp = Math.round(G.RULES.raidHpPerMember * n * lvl * (L.raidMin / 15));
  const pool = Math.round(G.RULES.raidRewardPerMember * n * lvl);
  return `<section class="card">
      <div class="me-head"><div class="av">${head(L.answers)}</div>
        <div class="grow"><h2 style="margin:0">${esc(L.name)}</h2><div class="small muted">${L.fromApp ? "Your walker from the app" : "Random test walker"} · stats total ${G.STAT_TOTAL}</div></div></div>
      ${statBars(st, L.equipped)}
      <p class="small muted" style="margin:8px 0">Best suited to the <b>${G.posOf(sug).label.toLowerCase()}</b>. Yellow is gear.</p>
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
        <div class="fact"><b>Lv ${lvl}</b><span>boss level (from squad gear)</span></div>
        <div class="fact"><b>${fmt(hp)}</b><span>boss health</span></div>
        <div class="fact good"><b>${esc(G.money(pool))}</b><span>reward pool if you win</span></div>
        <div class="fact"><b>${n}</b><span>in the squad</span></div>
      </div>
      <button class="btn block" data-act="raid">Start the raid</button>
    </section>
    <section class="card">
      <h2>How Sunday works</h2>
      <ul class="rules small" style="padding-left:18px;margin:0">
        <li>7pm Sunday, ${G.RULES.raidMin} minutes, whole squad vs one boss. Tap to hit it.</li>
        <li><b>Rows.</b> ${G.POSITIONS.map((p) => `${p.e} ${p.label}: ×${p.mult} damage, ${p.aggro}% of swipes, <i>${p.ability}</i> (${p.abilityWhat.toLowerCase()})`).join(". ")}. Moving rows takes a few seconds.</li>
        <li><b>Attacks</b> are warned 2s ahead (more with Brains). Swipe hits one person, stomp hits front and middle, scream hits everyone, feast heals it unless you burst it.</li>
        <li>Better gear makes the boss tougher, and the reward bigger.</li>
        <li><b>Someone dies?</b> The squad gets ${G.RULES.triviaQuestions} science/maths questions, ${G.RULES.triviaSeconds}s each, majority vote. Get ${G.RULES.triviaFailAt} wrong and everyone is paralysed: stunned ${G.RULES.paralysedStunSec}s and ${fmt(G.RULES.paralysedSteps)} steps down tomorrow. Pass and the fallen get back up.</li>
      </ul>
    </section>`;
}

function tabGear() {
  return `<section class="card">
      <div class="row spread"><h2 style="margin:0">Shop</h2><button class="btn sm ghost" data-act="cheat">+5 Endeavours (test)</button></div>
      <p class="small muted">Gear is yours for good. One per slot. Prices in Efforts (100 = 1 Endeavour).</p>
      ${G.SLOTS.map((slot) => `<h3 style="text-transform:capitalize">${slot}</h3>${G.GEAR.filter((g) => g.slot === slot).map((g) => {
        const own = L.owned.includes(g.id), on = L.equipped[slot] === g.id;
        const st = G.STATS.find((s) => s.id === g.stat);
        return `<div class="shop-row"><span class="e">${g.e}</span>
          <span><b>${esc(g.name)}</b><span class="small muted" style="display:block">+${g.plus} ${st.label} · ${esc(G.money(g.price))}</span></span>
          ${on ? `<button class="btn sm ghost" data-unequip="${slot}">Equipped ✓</button>`
            : own ? `<button class="btn sm" data-equip="${g.id}">Equip</button>`
            : `<button class="btn sm sun" data-buy="${g.id}" ${L.wallet < g.price ? "disabled" : ""}>Buy</button>`}
        </div>`;
      }).join("")}`).join("")}
    </section>`;
}

const KNOBS = [
  ["baseTax", "Base tax (0.3 = 30%)"], ["taxPerOverMin", "Extra tax per minute over scroll budget"], ["taxMaxExtra", "Most extra tax from scrolling"],
  ["stealCap", "Most you can steal (0.3 = 30%)"], ["dailyWindowMin", "Taxman fight length (min)"],
  ["taxmanBaseHp", "Taxman base health"], ["taxmanHpPerEffort", "Taxman health per Effort earned"], ["taxmanHpPerOverMin", "Taxman health per minute over budget"],
  ["stealDmgPerPct", "Damage for each 1% stolen (× his health)"], ["comboWindowMs", "Combo window (ms between taps)"],
  ["raidHpPerMember", "Raid boss health per squad member"], ["raidLvlPerGear", "Boss level per average gear point"],
  ["raidAtkEvery", "Seconds between boss attacks"], ["raidBossDmg", "Boss swipe damage"], ["raidRewardPerMember", "Win reward per member per level (Efforts)"],
  ["triviaSeconds", "Seconds per trivia question"], ["triviaFailAt", "Wrong answers that paralyse"], ["paralysedSteps", "Step penalty when paralysed"],
  ["paralysedStunSec", "Stun when paralysed (s)"], ["stepsPerEffort", "Steps per Effort"], ["dailyEffortCap", "Most Efforts a day"],
];
function tabKnobs() {
  return `<section class="card">
      <h2>Knobs</h2>
      <p class="small muted">Change any number and play again. Changed ones go orange. Tell me which values felt right.</p>
      ${KNOBS.map(([k, label]) => `<label class="knob ${L.rules[k] !== undefined && L.rules[k] !== G.DEFAULT_RULES[k] ? "changed" : ""}"><span><b>${label}</b><small>default ${G.DEFAULT_RULES[k]}</small></span>
        <input type="number" step="any" data-knob="${k}" value="${G.RULES[k]}"></label>`).join("")}
      <div class="btn-row" style="margin-top:10px"><button class="btn sm ghost" data-act="copy-knobs">Copy my changes</button><button class="btn sm danger" data-act="reset-knobs">Reset all</button></div>
    </section>
    <section class="card"><h2>Start over</h2><p class="small muted">Wipes the lab wallet, gear and history on this device.</p><button class="btn sm danger" data-act="reset-lab">Reset the lab</button></section>`;
}

// ---------- 7pm: the Taxman ----------
function startTaxman(seconds) {
  const S = G.taxmanSetup({ steps: effectiveSteps(), scrollMin: L.scroll, stats: myStats(), equipped: L.equipped });
  S.seconds = seconds;
  V.battle = { B: G.taxmanStart(S), S, t0: performance.now(), left: seconds, last: performance.now(), built: false };
  V.view = "taxman";
  render();
  V.battle.timer = setInterval(taxTick, 100);
}
function taxTick() {
  const b = V.battle;
  if (!b) return;
  const now = performance.now();
  b.left -= Math.min(1, (now - b.last) / 1000);
  b.last = now;
  if (b.left <= 0) return finishTaxman();
  paintTaxman();
}
function renderTaxman() {
  const b = V.battle;
  $("#app").innerHTML = `<div class="arena">
    <div class="arena-top">
      <div class="row spread"><b>The Taxman</b><span class="clock" id="tx-clock">${mmss(b.left)}</span><button class="btn sm ghost" data-act="tax-stop">Stop</button></div>
      <div class="hpbar tax"><i id="tx-hp" style="width:100%"></i><span id="tx-hp-t"></span></div>
      <div class="hpbar steal"><i id="tx-steal" style="width:0%"></i><span id="tx-steal-t"></span></div>
    </div>
    <div class="tapzone" id="tapzone"><div class="monster" id="monster">${taxmanSvg(1, false)}</div><div class="combo" id="combo"></div><div class="tap-hint">tap anywhere, fast</div></div>
  </div>`;
  paintTaxman();
}
function paintTaxman() {
  const b = V.battle, r = G.taxmanResult(b.B);
  const left = Math.max(0, 1 - b.B.dmg / b.S.hp);
  $("#tx-clock").textContent = mmss(b.left);
  $("#tx-hp").style.width = `${left * 100}%`;
  $("#tx-hp-t").textContent = r.beaten ? "Knocked out. Tax 0%" : `Tax ${Math.round(b.S.taxRate * 100 * left)}% · ${fmt(b.S.hp - b.B.dmg)} hp`;
  $("#tx-steal").style.width = `${(r.stealPct / G.RULES.stealCap) * 100}%`;
  $("#tx-steal-t").textContent = r.beaten ? `Stolen +${Math.round(r.stealPct * 100)}% (${r.stolen} Efforts)` : "Knock him out to start stealing";
  $("#combo").textContent = b.B.combo > 4 ? `×${(1 + b.B.combo / G.RULES.comboMax).toFixed(1)} combo` : "";
  if (r.beaten && !b.beatenShown) { b.beatenShown = true; $("#monster").innerHTML = taxmanSvg(0, true); toast("Knocked out. Keep tapping to steal"); }
}
function taxTap(e) {
  const b = V.battle;
  if (!b) return;
  const hit = G.taxmanTap(b.B, performance.now() - b.t0);
  if (!hit) return;
  pop(e, hit.dmg, hit.crit);
  const m = $("#monster"); m.classList.add("hit"); setTimeout(() => m.classList.remove("hit"), 60);
}
function finishTaxman() {
  const b = V.battle;
  clearInterval(b.timer);
  V.taxEnd = G.taxmanResult(b.B);
  V.taxEnd.taps = b.B.taps; V.taxEnd.crits = b.B.crits;
  V.battle = null; V.view = "taxEnd";
  render();
}
function viewTaxEnd() {
  const r = V.taxEnd;
  return `<div class="top"><div><span class="lab-flag">Test mode</span><h1 style="margin-top:6px">${r.beaten ? "Taxman down." : "He got some."}</h1></div></div>
    <section class="card">
      <div class="facts">
        <div class="fact good"><b>+${r.earned}</b><span>Efforts from steps</span></div>
        <div class="fact bad"><b>−${r.taxed}</b><span>taxed (${Math.round(r.taxRate * (1 - r.knocked) * 100)}%)</span></div>
        <div class="fact good"><b>+${r.stolen}</b><span>stolen back (${Math.round(r.stealPct * 100)}%)</span></div>
        <div class="fact"><b>${esc(G.money(r.net))}</b><span>you keep</span></div>
      </div>
      <p class="small muted">${fmt(r.taps)} taps · ${r.crits} crits · ${Math.round(r.knocked * 100)}% of his health</p>
      <button class="btn block" data-act="bank-tax">Bank it</button>
    </section>`;
}

// ---------- Sunday raid ----------
function startRaid() {
  const squad = botSquad();
  V.raid = { R: G.raidCreate(squad, { minutes: L.raidMin }), squad, last: performance.now(), q: -1, myHp: null };
  V.view = "raid";
  render();
  V.raid.timer = setInterval(raidTick, 100);
}
function raidTick() {
  const v = V.raid;
  if (!v) return;
  const now = performance.now();
  let dt = (now - v.last) / 1000;
  v.last = now;
  while (dt > 0 && !v.R.over) { G.raidStep(v.R, Math.min(0.25, dt)); dt -= 0.25; }
  if (v.R.over) return finishRaid();
  paintRaid();
}
const memberChip = (m) => `<div class="m ${m.id === "me" ? "me" : ""}" id="m-${m.id}"><span class="av">${head(m.answers)}</span>
  <span><span class="nm">${esc(m.name)}</span><div class="hp"><i></i></div></span><span class="st"></span></div>`;
function renderRaid() {
  const R = V.raid.R;
  $("#app").innerHTML = `<div class="arena">
    <div class="arena-top">
      <div class="row spread"><b id="rd-phase">Phase 1 · Lv ${R.lvl}</b><span class="clock" id="rd-clock"></span><button class="btn sm ghost" data-act="raid-quit">Give up</button></div>
      <div class="raid-boss"><div class="monster" id="monster">${Walker.boss(1, false)}</div>
        <div class="grow" style="display:grid;gap:6px"><div class="hpbar"><i id="rd-hp"></i><span id="rd-hp-t"></span></div><div class="warnbar" id="rd-warn"></div></div></div>
    </div>
    <div class="lanes">${G.POSITIONS.map((p) => `<div class="lane"><b>${p.e}<br>${p.label}</b><div class="ppl" id="lane-${p.id}"></div></div>`).join("")}</div>
    <div class="arena-bottom grow-tap">
      <div class="log" id="rd-log"></div>
      <div class="tapzone raid-tap" id="tapzone"><div class="combo" id="combo"></div><div class="tap-hint" id="tap-hint">tap here to hit</div></div>
      <div class="ctrl"><button class="btn ability" data-act="ability" id="rd-ab"><i></i><span></span></button>
        ${G.POSITIONS.map((p) => `<button class="btn ghost" data-move="${p.id}">${p.e}</button>`).join("")}</div>
    </div>
  </div><div id="trivia"></div><div id="stun"></div>`;
  for (const m of R.members) $(`#lane-${m.pos}`).insertAdjacentHTML("beforeend", memberChip(m));
  paintRaid();
}
function paintRaid() {
  const v = V.raid, R = v.R, B = R.boss, me = R.members.find((m) => m.id === "me");
  $("#rd-clock").textContent = mmss(R.dur - R.t);
  $("#rd-phase").textContent = `Phase ${B.phase} · Lv ${R.lvl}`;
  $("#rd-hp").style.width = `${(B.hp / B.max) * 100}%`;
  $("#rd-hp-t").textContent = `${fmt(B.hp)} / ${fmt(B.max)}`;
  const w = $("#rd-warn");
  if (B.feast) {
    w.className = "warnbar feast";
    w.textContent = `🍗 Feasting! ${fmt(B.feast.dealt)} / ${fmt(B.feast.need)} damage in ${Math.ceil(B.feast.until - R.t)}s`;
  } else if (B.next && R.t >= B.next.warnAt) {
    const a = G.ATTACKS[B.next.type];
    w.className = "warnbar hot";
    w.textContent = `${a.e} ${a.label} in ${Math.max(0, B.next.at - R.t).toFixed(1)}s: ${a.what}`;
  } else { w.className = "warnbar"; w.textContent = "Watching…"; }
  for (const m of R.members) {
    const el = $(`#m-${m.id}`);
    if (el.parentElement.id !== `lane-${m.pos}`) $(`#lane-${m.pos}`).appendChild(el);
    el.classList.toggle("dead", !m.alive);
    el.querySelector(".hp i").style.width = `${(m.hp / m.max) * 100}%`;
    el.querySelector(".st").textContent = !m.alive ? "💀" : R.t < m.stunUntil ? "⚡" : R.t < m.moveUntil ? "↔️" : R.t < m.shieldUntil ? "🛡️" : m.swing ? "💥" : "";
    if (m.prevHp !== undefined && m.hp < m.prevHp) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
    m.prevHp = m.hp;
  }
  // Ability button with its cooldown.
  const ab = $("#rd-ab"), p = G.posOf(me.pos), cd = Math.max(0, me.cdUntil - R.t);
  ab.querySelector("span").textContent = cd > 0 ? `${p.ability} ${Math.ceil(cd)}s` : p.ability;
  ab.querySelector("i").style.width = `${cd > 0 ? (cd / G.abilityCd(me)) * 100 : 0}%`;
  ab.disabled = cd > 0 || !me.alive;
  document.querySelectorAll("[data-move]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.move === me.pos)));
  const locked = !me.alive || R.t < me.moveUntil || R.t < me.stunUntil;
  $("#tapzone").classList.toggle("locked", locked);
  $("#tap-hint").textContent = !me.alive ? "you're down. answer the questions" : R.t < me.stunUntil ? "paralysed…" : R.t < me.moveUntil ? "moving…" : me.swing ? `big swing: ${me.swing} taps left` : "tap here to hit";
  $("#combo").textContent = me.combo > 4 ? `×${(1 + me.combo / (G.RULES.comboMax * 2)).toFixed(2)}` : "";
  $("#rd-log").innerHTML = R.log.slice(0, 2).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join("");
  $("#stun").innerHTML = me.alive && R.t < me.stunUntil ? `<div class="stunned">Paralysed<br>${Math.ceil(me.stunUntil - R.t)}s</div>` : "";
  paintTrivia();
}
function paintTrivia() {
  const v = V.raid, R = v.R, T = R.trivia, box = $("#trivia");
  if (!T) { if (box.innerHTML) box.innerHTML = ""; v.q = -1; return; }
  const key = `${R.triviaRuns}-${T.i}`;
  const Q = T.qs[T.i], mine = T.answers[T.i].me;
  if (v.q !== key) {
    v.q = key;
    // Brains crosses out some wrong answers for you.
    const me = R.members.find((m) => m.id === "me");
    const wrong = Q.options.map((_, i) => i).filter((i) => i !== Q.correct);
    v.struck = new Set(wrong.slice(0, G.hintsFor(me)));
    box.innerHTML = `<div class="trivia"><div class="meta"><span>Q${T.i + 1} of ${T.qs.length} · ${T.right} right, ${T.wrong} wrong</span><span id="tv-clock"></span></div>
      <h3>${esc(Q.q)}</h3>
      <div class="opts">${Q.options.map((o, i) => `<button data-answer="${i}" class="${v.struck.has(i) ? "struck" : ""}">${esc(o)}</button>`).join("")}</div>
      <div class="meta" style="margin:6px 0 0"><span id="tv-votes"></span><span>${v.struck.size ? `🧠 Brains crossed out ${v.struck.size}` : ""}</span></div></div>`;
  }
  $("#tv-clock").textContent = `${Math.ceil(T.until - R.t)}s`;
  $("#tv-votes").textContent = `${Object.keys(T.answers[T.i]).length}/${R.members.length} answered`;
  box.querySelectorAll("[data-answer]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.answer) === mine)));
}
function raidTap(e) {
  const v = V.raid;
  if (!v) return;
  const hit = G.raidTap(v.R, "me");
  if (hit) pop(e, hit.dmg, hit.crit);
}
function finishRaid() {
  clearInterval(V.raid.timer);
  V.view = "raidEnd";
  render();
}
function viewRaidEnd() {
  const R = V.raid.R, res = R.result, mine = res.shares.find((s) => s.id === "me");
  const title = { won: "Boss down.", timeout: "Out of time.", wiped: "Squad wiped." }[res.how];
  return `<div class="top"><div><span class="lab-flag">Test mode</span><h1 style="margin-top:6px">${title}</h1>
      <div class="sub">${Math.round(res.frac * 100)}% of its health in ${mmss(R.t)} · level ${res.lvl} · ${R.triviaRuns} trivia round${R.triviaRuns === 1 ? "" : "s"}</div></div></div>
    ${res.paralysed ? `<div class="card" style="border-color:var(--bad)"><b>Paralysed.</b> Everyone starts tomorrow ${fmt(G.RULES.paralysedSteps)} steps down.</div>` : ""}
    <section class="card">
      <div class="facts"><div class="fact good"><b>${esc(G.money(mine.reward))}</b><span>your share</span></div><div class="fact"><b>${esc(G.money(res.pool))}</b><span>squad pool</span></div></div>
      <table class="end-table"><tr><th>Who</th><th>Damage</th><th>Healed</th><th>Took</th><th>Reward</th></tr>
        ${res.shares.map((s) => `<tr class="${s.id === "me" ? "me" : ""}"><td>${esc(s.name)}</td><td>${fmt(s.dmg)}</td><td>${fmt(s.healed)}</td><td>${fmt(s.taken)}</td><td>${s.reward}</td></tr>`).join("")}</table>
      <button class="btn block" style="margin-top:12px" data-act="bank-raid">Bank it</button>
    </section>`;
}

// ---------- shared ----------
function pop(e, dmg, crit) {
  const zone = $("#tapzone");
  if (!zone) return;
  const r = zone.getBoundingClientRect();
  const el = document.createElement("span");
  el.className = "pop" + (crit ? " crit" : "");
  el.textContent = crit ? `${Math.round(dmg)}!` : Math.round(dmg);
  el.style.left = `${(e.clientX ?? r.left + r.width / 2) - r.left - 10 + (Math.random() * 20 - 10)}px`;
  el.style.top = `${(e.clientY ?? r.top + r.height / 2) - r.top - 20}px`;
  zone.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

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
  if (!e.target.closest("#tapzone")) return;
  e.preventDefault();
  if (V.view === "taxman") taxTap(e);
  else if (V.view === "raid") raidTap(e);
});

document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { V.tab = d.tab; render(); window.scrollTo(0, 0); return; }
  if (d.pos) { L.pos = d.pos; save(); render(); return; }
  if (d.bots) { L.bots = Number(d.bots); save(); render(); return; }
  if (d.botgear) { L.botGear = d.botgear; save(); render(); return; }
  if (d.raidmin) { L.raidMin = Number(d.raidmin); save(); render(); return; }
  if (d.buy) {
    const g = G.gearById(d.buy);
    if (L.wallet < g.price) return toast("Not enough in the wallet");
    L.wallet -= g.price; L.owned.push(g.id); L.equipped[g.slot] = g.id;
    addHistory(`Bought ${g.name}`, -g.price); save(); render(); toast(`${g.name} equipped`);
    return;
  }
  if (d.equip) { const g = G.gearById(d.equip); L.equipped[g.slot] = g.id; save(); render(); return; }
  if (d.unequip) { delete L.equipped[d.unequip]; save(); render(); return; }
  if (d.move && V.raid) { G.raidMove(V.raid.R, "me", d.move); return; }
  if (d.answer !== undefined && V.raid) { G.raidAnswer(V.raid.R, "me", Number(d.answer)); paintTrivia(); return; }
  switch (d.act) {
    case "taxman": startTaxman(Number(d.sec)); break;
    case "skip-tax": {
      const S = G.taxmanSetup({ steps: effectiveSteps(), scrollMin: L.scroll });
      const taxed = Math.round(S.efforts * S.taxRate), net = S.efforts - taxed;
      L.wallet += net; L.debt = 0; addHistory(`Skipped the Taxman: earned ${S.efforts}, taxed ${taxed}`, net); save(); render();
      break;
    }
    case "tax-stop": finishTaxman(); break;
    case "bank-tax": {
      const r = V.taxEnd;
      L.wallet += r.net; L.debt = 0;
      addHistory(`Taxman: earned ${r.earned}, taxed ${r.taxed}, stole ${r.stolen}`, r.net);
      save(); V.view = "main"; render(); window.scrollTo(0, 0);
      break;
    }
    case "raid": startRaid(); break;
    case "ability": if (V.raid) G.raidAbility(V.raid.R, "me"); break;
    case "raid-quit": if (V.raid && confirm("End the raid now? It counts as running out of time.")) V.raid.R.dur = V.raid.R.t; break;
    case "bank-raid": {
      const res = V.raid.R.result, mine = res.shares.find((s) => s.id === "me");
      L.wallet += mine.reward;
      if (res.paralysed) L.debt = G.RULES.paralysedSteps;
      addHistory(`Sunday raid (${res.how}, ${Math.round(res.frac * 100)}%)${res.paralysed ? ", paralysed" : ""}`, mine.reward);
      save(); V.raid = null; V.view = "main"; V.tab = "today"; render(); window.scrollTo(0, 0);
      break;
    }
    case "reroll": L.answers = Walker.fallbackAnswers("lab-" + Math.floor(Math.random() * 1e9)); L.name = "You"; L.fromApp = false; L.pos = null; save(); render(); break;
    case "use-mine": useMyWalker(); break;
    case "cheat": L.wallet += 500; addHistory("Test top-up", 500); save(); render(); break;
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
