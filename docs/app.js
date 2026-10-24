"use strict";

const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");
const KM_PER_STEP = 0.000762;
// Everyone is drawn as their walker. Players without quiz answers get a stable look derived from their id.
const charOf = (p) => (p && p.character && p.character.time ? p.character : Walker.fallbackAnswers(p?.id || "x"));
const headCache = new Map();
function avatar(p, cls = "") {
  const key = `${p.id}|${p.equipped || ""}|${JSON.stringify(p.character || {})}`;
  if (!headCache.has(key)) headCache.set(key, Walker.svg(charOf(p), { crop: "head", gear: p.equipped, label: p.name }));
  return `<span class="avatar ${cls}">${headCache.get(key)}</span>`;
}
const colorOf = (p) => Walker.traits(charOf(p)).pal.body;
const JOURNEYS = [
  ["London to Paris", 460],
  ["Land's End to John o' Groats", 1407],
  ["London to Rome", 1870],
  ["Coast to coast USA", 4500],
  ["Around the world", 40075],
];
const { iso, addDays, parseDay, weekStart, daysBetween, seasonOf, RULES } = Effort;

const $ = (sel, el = document) => el.querySelector(sel);
const app = $("#app");
const fmt = (n) => Math.round(n).toLocaleString("en-GB");
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const km = (steps) => (steps * KM_PER_STEP).toFixed(steps * KM_PER_STEP < 100 ? 1 : 0);
const today = () => iso(new Date());
const dayLabel = (s, opts = { weekday: "short", day: "numeric", month: "short" }) => parseDay(s).toLocaleDateString("en-GB", opts);
function ago(ts) {
  if (!ts) return "never";
  const mins = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

// ---------- storage (wrapped: private mode / blocked storage must not break the app) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("ef_" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("ef_" + k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem("ef_" + k); } catch { /* ignore */ } },
};

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

async function call(action, body, query = "") {
  const res = await fetch(`${API}/${action}${query}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {});
  const data = await res.json().catch(() => ({ ok: false, error: "Bad response" }));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- state ----------
const S = {
  view: "loading",            // loading | welcome | onboard | main
  step: 0,                    // onboarding step
  tab: store.get("tab") || "home",
  token: store.get("token"),
  me: null,
  groups: [],
  mine: null,                 // engine over just my own data
  boardKey: store.get("board") || null, // "g:CODE" or "public"
  boards: {},                 // key -> { data, E }
  mode: store.get("mode") || "week",
  adminKeys: store.get("adminKeys") || {},
  invite: null,               // { code, name, members } when arriving via ?g=
  draft: { platform: detectPlatform() },
  answers: store.get("draftAnswers") || {}, // quiz answers in progress
  qi: 0,
  retake: false,
  logDay: null,
};
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; if (S.view === "main") render(); });

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

async function copy(textToCopy, label = "Copied") {
  try { await navigator.clipboard.writeText(textToCopy); toast(label); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = textToCopy; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); toast(label); } catch { toast("Couldn't copy, long-press to select"); }
    ta.remove();
  }
}

async function share(textToShare, url) {
  if (navigator.share) {
    try { await navigator.share({ text: textToShare, url }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  copy(url ? `${textToShare}\n${url}` : textToShare, "Copied, paste it in the group chat");
}

// ---------- data ----------
function buildBoard(key, data) {
  const players = data.players.map((p) => ({ ...p }));
  const E = Effort.build({ players, steps: data.steps, scroll: data.scroll, hunts: data.hunts || [], today: today(), league: key === "public" });
  S.boards[key] = { data, E };
}

async function loadMe() {
  const r = await call("me", { token: S.token });
  S.me = r.player;
  S.groups = r.groups;
  S.mine = Effort.build({ players: [r.player], steps: r.steps, scroll: r.scroll, hunts: r.hunts || [], today: today() });
  const keys = [...S.groups.map((g) => "g:" + g.code), ...(S.me.is_public ? ["public"] : [])];
  if (!keys.includes(S.boardKey)) S.boardKey = keys[0] || null;
  store.set("board", S.boardKey);
}

async function loadBoard(key) {
  if (!key) return;
  const data = key === "public" ? await call("board", null, "?league=public") : await call("board", null, `?code=${encodeURIComponent(key.slice(2))}`);
  buildBoard(key, data);
}

async function refresh(silent) {
  try {
    await loadMe();
    await loadBoard(S.boardKey);
    // Background refreshes must never pull someone out of the hunt, its results or the quiz.
    if (["hunt", "huntEnd", "quiz", "reveal", "onboard"].includes(S.view)) return;
    S.view = "main";
    if ($("#sheet").hidden) render();
  } catch (e) {
    if (/Unknown token/.test(e.message)) return signOut("That account no longer exists on this phone");
    if (!silent) toast(e.message);
  }
}

function saveToken(player) {
  S.token = player.token;
  store.set("token", S.token);
  // Keep the restore link in the address bar so "Add to Home Screen" opens straight into this account
  // (iOS home-screen apps don't share storage with Safari).
  history.replaceState(null, "", `${APP_URL}?me=${player.token}`);
}

function signOut(msg) {
  ["token", "board"].forEach(store.del);
  Object.assign(S, { token: null, me: null, groups: [], mine: null, boards: {}, boardKey: null, view: "welcome", step: 0 });
  history.replaceState(null, "", APP_URL);
  closeSheet();
  render();
  if (msg) toast(msg);
}

const cur = () => S.boards[S.boardKey];
const boardName = (key) => (key === "public" ? "Everyone" : S.groups.find((g) => "g:" + g.code === key)?.name || "Group");

// ---------- icons ----------
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21V11M16 21V7M12 21V3M4 21v-6M20 21v-9"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
};

// ---------- rendering ----------
function render() {
  const views = { loading: viewLoading, welcome: viewWelcome, quiz: viewQuiz, reveal: viewReveal, onboard: viewOnboard, main: viewMain, hunt: viewHunt, huntEnd: viewHuntEnd };
  app.innerHTML = (views[S.view] || viewWelcome)();
}

const viewLoading = () => `<div class="empty" style="padding-top:30vh"><span class="e">🥾</span>Lacing up…</div>`;

function rulesCards() {
  return `<div class="feature-list">
    <div><span class="e">🧪</span><span><b>Answer 12 questions, get your walker</b><br><span class="muted small">Your answers build a character nobody else has.</span></span></div>
    <div><span class="e">🥾</span><span><b>Steps are fuel</b><br><span class="muted small">Every step moves your walker along an endless trail, past landmarks with gear to find.</span></span></div>
    <div><span class="e">🌫️</span><span><b>Scrolling brings the fog</b><br><span class="muted small">Go over your scroll budget and your walker slows down and goes grey.</span></span></div>
    <div><span class="e">📱</span><span><b>Beat The Scroll together</b><br><span class="muted small">A weekly boss your group fights with steps. Doomscrolling heals it.</span></span></div>
  </div>`;
}

// ----- Character quiz -----
const QUESTIONS = Walker.QUESTIONS;
function quizPreview(mood = "ok") {
  return Walker.svg(S.answers, { mood, label: "Your walker so far" });
}

function viewQuiz() {
  const i = S.qi, q = QUESTIONS[i], a = S.answers;
  const back = `<button class="icon-btn" data-act="quiz-back" aria-label="Back">‹</button>`;
  const head = `<div class="quiz-top">${back}<div class="bar"><i style="width:${(100 * i) / QUESTIONS.length}%"></i></div><span class="small muted num">${i + 1}/${QUESTIONS.length}</span></div>`;
  if (q.type === "intro") {
    return `${head}<h1 class="quiz-q">What do people call you?</h1>
      <form class="card" data-form="quiz-intro">
        <label class="field"><span>Your name</span><input name="name" required maxlength="24" placeholder="What your friends call you" value="${esc(a.name || "")}" autocomplete="given-name"></label>
        <label class="field"><span>Your phone</span></label>
        <div class="toggle" style="margin-bottom:16px">${[["ios", "iPhone"], ["android", "Android"], ["other", "Other"]].map(([v, l]) => `<button type="button" data-platform="${v}" aria-pressed="${v === S.draft.platform}">${l}</button>`).join("")}</div>
        <button class="btn block">Build my walker</button>
      </form>
      <p class="note" style="display:block;text-align:center">12 questions. Lie and your walker will know.</p>`;
  }
  let body;
  if (q.type === "choice") body = `<div class="opts ${q.compact ? "compact" : ""}">${q.options.map(([v, l, e]) => `<button class="opt" data-answer="${esc(v)}" aria-pressed="${String(a[q.id]) === v}">${e ? `<span class="e">${e}</span>` : ""}<span>${esc(l)}</span></button>`).join("")}</div>`;
  else if (q.type === "hue") body = `<input type="range" class="hue-slider" min="0" max="359" value="${a.hue ?? 30}" data-hue aria-label="Colour"><button class="btn block" data-act="quiz-next">This one</button>`;
  else if (q.type === "number") body = `<form data-form="quiz-value"><input name="v" type="number" inputmode="numeric" min="1" max="99" required class="big-input" value="${esc(a.number ?? "")}" placeholder="7" aria-label="Lucky number"><button class="btn block" style="margin-top:12px">Next</button></form>`;
  else body = `<form data-form="quiz-value"><input name="v" maxlength="30" required class="big-input" style="font-size:26px!important" value="${esc(a.word ?? "")}" placeholder="${esc(q.placeholder)}" autocomplete="off" aria-label="${esc(q.q)}"><button class="btn block" style="margin-top:12px">Make me</button></form>`;
  return `${head}<div class="quiz-preview" id="quiz-preview">${quizPreview()}</div>
    <h1 class="quiz-q">${esc(q.q)}</h1>${body}`;
}

function viewReveal() {
  const a = S.answers;
  const odds = Walker.COMBOS;
  return `<section class="reveal">
    <p class="note" style="font-size:26px">ta-da!</p>
    <div class="walker-big">${Walker.svg(a, { mood: "fresh", label: `${a.name}'s walker` })}</div>
    <h1 class="ob-title" style="margin-top:18px">This is you, ${esc(a.name || "walker")}.</h1>
    <p class="muted">Built from your answers. Change one and you look different.</p>
    <p class="odds">1 of ${odds.toLocaleString("en-GB")} possible walkers, before your word even counts</p>
    <div class="btn-row"><button class="btn ghost" data-act="quiz-restart">Change answers</button><button class="btn" data-act="quiz-done">${S.retake ? "Save my new look" : "That's me, let's walk"}</button></div>
  </section>`;
}

function viewWelcome() {
  const inv = S.invite;
  return `<section class="welcome">
    <div class="logo">${Walker.svg(Walker.fallbackAnswers("welcome-" + new Date().getDate()), { mood: "fresh", label: "A walker" })}</div>
    <h1>Effort</h1>
    <p class="lead">Walk more. Scroll less. Grow a little walker with your friends.</p>
    ${inv ? `<div class="callout" style="text-align:left;margin-bottom:16px">You're invited to <b>${esc(inv.name)}</b> (${inv.members} ${inv.members === 1 ? "player" : "players"}).</div>` : ""}
    ${rulesCards()}
    <button class="btn block" data-act="start">${inv ? `Join ${esc(inv.name)}` : "Get started"}</button>
    ${inv ? "" : `<form data-form="code" class="row" style="margin-top:12px"><input name="code" placeholder="Invite code" autocomplete="off" maxlength="6" class="grow code-input"><button class="btn ghost">Join</button></form>`}
    <p class="small muted" style="margin-top:18px">Had it on another phone? Open your restore link, or ask your group admin for it.</p>
  </section>`;
}

// Onboarding after the quiz: 1 steps → 2 scrolling → done
function viewOnboard() {
  const dots = `<div class="dots">${[0, 1, 2].map((i) => `<i class="${i <= S.step ? "on" : ""}"></i>`).join("")}</div>`;
  const which = S.step === 1 ? "steps" : "scroll";
  return `${dots}<h1 class="ob-title">${which === "steps" ? "Connect your steps" : "Track your scrolling"}</h1>
    <p class="muted" style="margin-top:-4px">${which === "steps" ? "Set it up once and your steps sync on their own. About 3 minutes." : "Optional, but it's how you earn bonus points for staying under your scroll budget. Without it we assume 30 min a day."}</p>
    ${setupBody(which, S.me.platform)}
    <div class="btn-row" style="margin-top:8px"><button class="btn ghost" data-act="ob-next">${S.step === 2 ? "Skip" : "Do it later"}</button><button class="btn" data-act="ob-next">${S.step === 2 ? "Finish" : "Done, next"}</button></div>`;
}

function viewMain() {
  const tabs = { home: tabHome, board: tabBoard, log: tabLog, me: tabMe };
  return `${(tabs[S.tab] || tabHome)()}
  <nav class="nav"><div class="inner">
    ${[["home", "Home"], ["board", "Board"], ["log", "Log"], ["me", "Me"]].map(([k, l]) =>
      `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ICON[k]}${l}</button>`).join("")}
  </div></nav>`;
}

// ----- Home -----
function todayCard(E, id) {
  const t = today();
  const r = E.day(id, t);
  const par = E.par(id, t);
  const pct = r.active ? Math.max(0, Math.round((100 * r.total) / par.value)) : 0;
  const budgetLeft = r.budget - (r.scrollSrc === "assumed" ? RULES.assumedScrollMin : r.scrollMin);
  const scrollLabel = r.scrollSrc === "assumed" ? `~${RULES.assumedScrollMin} min assumed` : r.scrollSrc === "none" ? "not tracked" : `${fmt(r.scrollMin)} min`;
  const tr = E.trail(id);
  const mood = tr.fog > 0.45 ? "foggy" : pct >= 100 ? "fresh" : "ok";
  const say = mood === "foggy" ? pick(["my brain is soup", "can't see the path…", "one more video… no!"])
    : mood === "fresh" ? pick(["let's gooo", "legs feel great", "onwards!"])
    : r.steps < 2000 ? pick(["walk me?", "is it walk o'clock?", "boots are on…"]) : pick(["nice pace", "keep going", "smell that air"]);
  return `<section class="card stage">
    ${Walker.scene(tr.biome, Walker.hash(id))}
    <div class="tag-today"><span>Today</span><b class="num">${signed(r.total)}</b><span>${par.placement ? "setting your par" : `${pct}% of par`}</span></div>
    <div class="tag-region">📍 ${esc(tr.region)}</div>
    <div class="bubble">${esc(say)}</div>
    <div class="walker-wrap">${Walker.svg(charOf(S.me), { mood, fog: tr.fog, gear: S.me.equipped, label: `${S.me.name}'s walker` })}</div>
    <button class="trail-bar" data-act="open-trail" style="display:block;width:calc(100% - 24px);text-align:left;cursor:pointer;color:var(--ink)">
      <div class="row spread small"><b>Next: ${esc(tr.next.name)}</b><span class="num muted">${fmt(RULES.landmarkEvery - tr.into)} fuel to go ${ICON.chev}</span></div>
      <div class="bar" style="margin-top:6px"><i style="width:${(100 * tr.into) / RULES.landmarkEvery}%"></i></div>
    </button>
  </section>
  <section class="card split">
    <div><div class="small muted">🚶 Steps</div><b class="num">${fmt(r.steps)}</b><span class="pts good">${signed(r.stepPts)}</span></div>
    <div><div class="small muted">📵 Scrolling</div><b class="num">${scrollLabel}</b><span class="pts ${r.scrollPts < 0 ? "bad" : "good"}">${r.scrollPts ? signed(r.scrollPts) : "±0"}</span></div>
    <div class="budget"><div class="row spread small"><span>Scroll budget</span><span class="num">${budgetLeft >= 0 ? `${fmt(budgetLeft)} of ${r.budget} min left` : `${fmt(-budgetLeft)} min over`}</span></div>
      <div class="bar"><i style="width:${r.budget ? Math.min(100, (100 * Math.max(0, budgetLeft)) / RULES.budgetCap) : 0}%;--c:var(--good)"></i></div>
      <div class="small muted" style="margin-top:4px">Every 1,000 steps earns 5 min (up to ${RULES.budgetCap}).</div></div>
    <div class="fog-meter"><div class="row spread small"><span>🌫️ Fog</span><span>${tr.fog < 0.05 ? "Clear skies" : tr.fog < 0.45 ? "A bit hazy" : "Thick fog"}${tr.fog >= 0.05 ? ` · walker ${Math.round(RULES.fogSlow * tr.fog * 100)}% slower` : ""}</span></div>
      <div class="bar"><i style="width:${Math.round(tr.fog * 100)}%"></i></div>
      <div class="small muted" style="margin-top:4px">Builds up from the last 7 days of scrolling over budget. Clears as you stay under it.</div></div>
  </section>`;
}

const pick = (arr) => arr[Math.floor(Date.now() / 36e5) % arr.length]; // changes hourly, stable between renders

// ----- The Hunt (nightly tap game) -----
function myLoadout() {
  const t = today();
  return Hunt.loadout(S.mine.day(S.me.id, t), S.mine.fogOn(S.me.id, t));
}
const huntOpen = () => new Date().getHours() >= Hunt.OPEN_HOUR;

function loadoutRows(L) {
  return `<div class="loadout">
    <div><b class="num">${L.power}</b><span>tap power</span></div>
    <div><b class="num">${L.hp}</b><span>health</span></div>
    <div><b class="num">${L.minutes}m</b><span>max time</span></div>
    <div><b class="num">${L.stomps}</b><span>stomps</span></div>
  </div>
  ${L.debuff >= 0.05 ? `<p class="small bad" style="margin:8px 0 0"><b>Scroll debuff ${Math.round(L.debuff * 100)}%:</b> ${Math.round((L.spawn - 1) * 100)}% more enemies, ${Math.round((L.tough - 1) * 100)}% tougher, fog on screen.</p>`
    : `<p class="small good" style="margin:8px 0 0"><b>No debuff.</b> Clean screen, and 🌿 heals spawn.</p>`}`;
}

function huntCard() {
  const L = myLoadout();
  const done = S.mine.huntOn(S.me.id, today());
  if (done) {
    return `<section class="card hunt-card">
      <div class="row spread"><h2 style="margin:0">Tonight's hunt</h2><span class="pill ${done.s ? "ok" : ""}">${done.s ? "Done" : "Abandoned"}</span></div>
      <p style="margin:8px 0 0">${done.s ? `<b class="num">${fmt(done.score)}</b> pts · ${done.kills} kills · wave ${done.wave} · ${done.surv ? "survived" : "died"}. Dealt <b>${done.dmg}</b> to the boss.` : "You left mid-run. It counts as zero."} Next hunt tomorrow at ${Hunt.OPEN_HOUR}:00.</p>
    </section>`;
  }
  const open = huntOpen();
  return `<section class="card hunt-card ${open ? "live" : ""}">
    <div class="row spread"><h2 style="margin:0">Tonight's hunt</h2><span class="pill ${open ? "warn" : ""}">${open ? "Open now" : `Opens ${Hunt.OPEN_HOUR}:00`}</span></div>
    <p class="small muted" style="margin:6px 0 10px">${open ? "One run. Tap to kill. Your stats come from today." : "Walk more before then. Every step makes tonight easier."}</p>
    ${loadoutRows(L)}
    ${open ? `<button class="btn block" style="margin-top:12px" data-act="hunt-start">Start the hunt</button>` : ""}
  </section>`;
}

function viewHunt() {
  return `<div id="hunt-root" class="hunt-root"></div>`;
}

function viewHuntEnd() {
  const r = S.huntResult;
  const head = r.survived ? "You lasted the night." : r.quit ? `Gave up on wave ${r.wave}. Bold.` : `Doomscrolled to death on wave ${r.wave}.`;
  return `<section class="reveal" style="padding-top:4vh">
    <div class="walker-big">${Walker.svg(charOf(S.me), { mood: r.survived ? "fresh" : "foggy", fog: r.survived ? 0 : 0.6, gear: S.me.equipped })}</div>
    <h1 class="ob-title" style="margin-top:16px">${head}</h1>
    <section class="card" style="text-align:left"><div class="stats">
      <div class="stat"><b class="num">${fmt(r.score)}</b><span>points</span></div>
      <div class="stat"><b class="num">${r.kills}</b><span>kills</span></div>
      <div class="stat"><b class="num">${r.dmg ?? Math.floor(r.score / 20)}</b><span>boss damage</span></div>
    </div>${r.error ? `<p class="small bad" style="margin:10px 0 0">Not saved: ${esc(r.error)}</p>` : ""}</section>
    <div class="btn-row"><button class="btn ghost" data-act="hunt-share">Share</button><button class="btn" data-act="hunt-done">Done</button></div>
  </section>`;
}

async function startHunt() {
  const L = myLoadout();
  // Register the run first, so quitting or reloading mid-hunt can't buy a retry.
  try { await call("hunt", { token: S.token, start: true }); }
  catch (err) { toast(err.message); return; }
  S.view = "hunt"; render(); scrollTo(0, 0);
  Hunt.start($("#hunt-root"), {
    loadout: L,
    walkerSvg: Walker.svg(charOf(S.me), { mood: L.debuff > 0.45 ? "foggy" : "fresh", fog: L.debuff * 0.6, gear: S.me.equipped }),
    onEnd: async (res) => {
      S.huntResult = { ...res };
      try {
        const r = await call("hunt", { token: S.token, ...res });
        S.huntResult.dmg = r.hunt.boss_dmg;
        S.huntResult.score = r.hunt.score;
      } catch (err) { S.huntResult.error = err.message; }
      S.view = "huntEnd"; render(); scrollTo(0, 0);
      refresh(true);
    },
  });
}

function huntBoardCard(E) {
  const t = today();
  let d = t;
  let rows = E.ids.map((id) => ({ id, h: E.huntOn(id, d) })).filter((r) => r.h);
  if (!rows.length) { d = addDays(t, -1); rows = E.ids.map((id) => ({ id, h: E.huntOn(id, d) })).filter((r) => r.h); }
  if (!rows.length) return "";
  rows.sort((a, b) => b.h.score - a.h.score);
  return `<section class="card"><h2>${d === t ? "Tonight's" : "Last night's"} hunt</h2>
    ${rows.slice(0, 5).map((r, i) => { const p = E.byId.get(r.id); return `<div class="row mini"><span class="rank r${i + 1}">${i + 1}</span>${avatar(p, "sm")}<span class="grow">${esc(p.name)} <span class="small muted">wave ${r.h.wave}${r.h.surv ? "" : " 💀"}</span></span><b class="num">${fmt(r.h.score)}</b></div>`; }).join("")}
  </section>`;
}

function bossCard(B) {
  if (!B || S.boardKey === "public" || B.E.ids.length < 2) return "";
  const b = B.E.boss(weekStart(today()));
  const won = !!b.defeatedOn;
  const hitter = b.hitter && B.E.byId.get(b.hitter[0]);
  const healer = b.healer && B.E.byId.get(b.healer[0]);
  return `<section class="card boss-card ${won ? "won" : ""}">
    <div class="boss-row">
      <div>${Walker.boss(b.pct, won)}</div>
      <div>
        <div class="small muted">This week's boss</div>
        <h2 style="margin:2px 0 8px">${esc(b.name)}</h2>
        ${won ? `<p class="small" style="margin:0"><b>Beaten on ${dayLabel(b.defeatedOn, { weekday: "long" })}!</b> Your group has slain ${B.E.bossWins() + 1} so far.</p>`
          : `<div class="hp"><div class="bar"><i style="width:${Math.round(b.pct * 100)}%"></i></div><div class="row spread small" style="margin-top:4px"><span class="num"><b>${fmt(b.left)}</b> / ${fmt(b.hp)} HP</span><span class="muted">ends Sunday</span></div></div>`}
      </div>
    </div>
    <p class="small muted" style="margin:10px 0 0">Everyone's steps hit it. Scrolling over budget heals it 2 HP a minute.${hitter ? ` Top hitter: <b>${esc(hitter.name)}</b>.` : ""}${healer ? ` Healing it most: <b>${esc(healer.name)}</b> 👀` : ""}</p>
  </section>`;
}

function weekCard(E, id) {
  const w = E.week(id, weekStart(today()));
  const st = E.streak(id);
  const need = RULES.parDaysForStreakWeek;
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return `<section class="card">
    <div class="row spread"><h2 style="margin:0">This week</h2><span class="pill ${st.weeks ? "ok" : ""}">${st.weeks ? `🔥 ${st.weeks}-week streak` : "No streak yet"}${st.freezes ? ` · ❄️${st.freezes}` : ""}</span></div>
    <div class="weekdots">${w.days.map((d, i) => `<div class="${d ? (d.atPar ? "wd-hit" : d.active ? "wd-miss" : "wd-off") : "wd-future"}"><i>${d?.atPar ? "✓" : ""}</i><span>${labels[i]}</span></div>`).join("")}</div>
    <p class="small muted" style="margin:0">${st.thisWeekDone ? "✅ Streak week locked in. Keep going for a bigger score." : `Beat your par on <b>${need - w.atPar} more day${need - w.atPar === 1 ? "" : "s"}</b> this week to keep your streak.`} Score so far: <b class="num">${fmt(w.form)}</b>.</p>
  </section>`;
}

function levelCard(E, id) {
  const x = E.xp(id);
  return `<section class="card" data-tab="me" style="cursor:pointer">
    <div class="row spread"><div><div class="small muted">Level ${x.level}</div><b style="font-size:18px">${esc(x.title)}</b></div><span class="lvl">${x.level}</span></div>
    <div class="bar" style="height:10px;margin-top:10px"><i style="width:${(100 * x.into) / x.need}%"></i></div>
    <div class="row spread small muted" style="margin-top:4px"><span class="num">${fmt(x.into)} / ${fmt(x.need)} XP</span><span>${x.nextTitle ? `${esc(x.nextTitle.title)} at Lv ${x.nextTitle.level}` : "Max title"}</span></div>
    ${x.rookieLeft ? `<div class="callout" style="margin-bottom:0">🌱 <b>Rookie boost:</b> 2× XP for ${x.rookieLeft} more day${x.rookieLeft === 1 ? "" : "s"}.</div>` : x.rested ? `<div class="callout" style="margin-bottom:0">😴 <b>Well rested:</b> your next 3 active days earn 2× XP.</div>` : ""}
  </section>`;
}

function rivalCard(B) {
  if (!B || !S.me) return "";
  const ws = weekStart(today());
  const rid = B.E.rivals(ws).get(S.me.id);
  if (!rid) return "";
  const them = B.E.byId.get(rid);
  const mine = B.E.week(S.me.id, ws).form, theirs = B.E.week(rid, ws).form;
  const lead = mine - theirs;
  return `<section class="card rival" data-profile="${rid}">
    <div class="small muted">⚔️ Your rival this week</div>
    <div class="row" style="margin-top:8px">
      ${avatar(S.me)}<b class="num grow">${fmt(mine)}</b>
      <span class="vs">vs</span>
      <b class="num grow" style="text-align:right">${fmt(theirs)}</b>${avatar(them)}
    </div>
    <p class="small" style="margin:8px 0 0">${lead > 0 ? `You're <b>${fmt(lead)}</b> ahead of ${esc(them.name)}.` : lead < 0 ? `${esc(them.name)} is <b>${fmt(-lead)}</b> ahead. Go for a walk.` : `Dead level with ${esc(them.name)}.`}</p>
  </section>`;
}

function miniBoard(B) {
  if (!B) return `<section class="card"><h2>Play with friends</h2><p class="small muted">Create a group or join one with an invite code.</p><div class="btn-row"><button class="btn" data-act="create-group">Create a group</button><button class="btn ghost" data-act="join-code">Join with code</button></div></section>`;
  const ws = weekStart(today());
  const rows = B.E.ids.map((id) => ({ id, v: B.E.week(id, ws).form })).sort((a, b) => b.v - a.v);
  const myRank = rows.findIndex((r) => r.id === S.me.id);
  const show = rows.slice(0, 3);
  if (myRank > 2) show.push(rows[myRank]);
  return `<section class="card" data-tab="board" style="cursor:pointer">
    <div class="row spread"><h2 style="margin:0">${esc(boardName(S.boardKey))}</h2><span class="small muted">${myRank >= 0 ? `You're #${myRank + 1} of ${rows.length}` : ""} ${ICON.chev}</span></div>
    ${show.map((r) => { const p = B.E.byId.get(r.id); const i = rows.indexOf(r); return `<div class="row mini"><span class="rank r${i + 1}">${i + 1}</span>${avatar(p, "sm")}<span class="grow ${r.id === S.me.id ? "b" : ""}">${esc(p.name)}</span><b class="num">${fmt(r.v)}</b></div>`; }).join("")}
  </section>`;
}

function nags() {
  const me = S.me;
  const out = [];
  const stale = (ts) => !ts || Date.now() - Date.parse(ts) > 36 * 3600_000;
  if (stale(me.steps_synced_at) || me.steps_source === "manual") out.push(["🚶", me.steps_synced_at ? "Steps haven't synced lately" : "Connect your steps", "Set it up once, then it's automatic.", "setup-steps"]);
  if (!me.scroll_synced_at) out.push(["📵", "Track your scrolling", "Earn bonus points for staying under budget.", "setup-scroll"]);
  let html = out.map(([e, t, s, act]) => `<div class="card row" style="gap:12px"><span style="font-size:26px">${e}</span><div class="grow small"><b>${t}</b><br><span class="muted">${s}</span></div><button class="btn sm" data-act="${act}">Set up</button></div>`).join("");
  if (!isStandalone() && !store.get("hideInstall")) {
    if (detectPlatform() === "ios") html += `<div class="card install-banner"><span class="e">📌</span><div class="grow small"><b>Add Effort to your Home Screen</b><br><span class="muted">In Safari tap <b>Share</b> then <b>Add to Home Screen</b>.</span></div><button class="icon-btn" data-act="hide-install" aria-label="Dismiss">✕</button></div>`;
    else if (installPrompt) html += `<div class="card install-banner"><span class="e">📌</span><div class="grow small"><b>Install Effort</b><br><span class="muted">One tap from your home screen.</span></div><button class="btn sm" data-act="install">Install</button></div>`;
  }
  return html;
}

function tabHome() {
  const E = S.mine, id = S.me.id;
  const B = cur();
  const greet = new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening";
  return `<div class="top"><div><h1>${greet}, ${esc(S.me.name)}</h1><div class="sub">${dayLabel(today(), { weekday: "long", day: "numeric", month: "long" })} · ${seasonOf(today()).name}</div></div>
    <button class="icon-btn" data-act="refresh" aria-label="Refresh">${ICON.refresh}</button></div>
  ${todayCard(E, id)}
  ${nags()}
  ${recapCard()}
  ${huntCard()}
  ${bossCard(B)}
  ${weekCard(E, id)}
  ${rivalCard(B)}
  ${miniBoard(B)}
  ${levelCard(E, id)}
  <button class="btn ghost block" data-act="how">How scoring works</button>`;
}

// ----- Board -----
function tabBoard() {
  const keys = [...S.groups.map((g) => "g:" + g.code), ...(S.me.is_public ? ["public"] : [])];
  const chips = `<div class="chips">${keys.map((k) => `<button data-board="${k}" aria-pressed="${k === S.boardKey}">${k === "public" ? "🌍 Everyone" : esc(boardName(k))}</button>`).join("")}<button data-act="group-menu" aria-label="Add or join a group">＋</button></div>`;
  const B = cur();
  if (!B) {
    return `<div class="top"><div><h1>Board</h1></div></div>${chips}
      <div class="empty"><span class="e">👥</span>You're not on a board yet.<br><br><div class="btn-row"><button class="btn" data-act="create-group">Create a group</button><button class="btn ghost" data-act="join-code">Join with code</button></div>
      ${S.me.is_public ? "" : '<p class="small">Or switch on the public league in Me → Settings.</p>'}</div>`;
  }
  const E = B.E, g = B.data.group;
  const t = today(), ws = weekStart(t), season = seasonOf(t);
  const isPublic = S.boardKey === "public";
  let ids = E.ids;
  let tierNote = "";
  if (isPublic) {
    const myTier = E.tier(S.me.id);
    ids = ids.filter((id) => E.tier(id).i === myTier.i);
    tierNote = `<div class="callout">${myTier.icon} <b>${myTier.name} league</b> · ${ids.length} player${ids.length === 1 ? "" : "s"}. Score ${RULES.leagueUp}+ this week to move up, under ${RULES.leagueDown} drops you down. Typed-in steps count half here.</div>`;
  }
  const legend = E.legend();
  const score = (id) => (S.mode === "week" ? E.week(id, ws).form : S.mode === "season" ? E.seasonScore(id, season) : E.xp(id).xp);
  const rows = ids.map((id) => ({ id, v: score(id) })).sort((a, b) => b.v - a.v || E.byId.get(a.id).name.localeCompare(E.byId.get(b.id).name));
  const max = Math.max(1, ...rows.map((r) => r.v));
  const sub = { week: "Score = each day's % of your own par, added up", season: `${season.name} · ends ${dayLabel(season.end, { day: "numeric", month: "short" })}`, all: "Lifetime XP. Never resets." }[S.mode];
  const list = rows.length ? `<ol class="lb">${rows.slice(0, 100).map((r, i) => {
    const p = E.byId.get(r.id);
    const st = E.streak(r.id), lv = E.xp(r.id), par = E.par(r.id, t);
    const w = E.week(r.id, ws);
    return `<li class="${r.id === S.me.id ? "me" : ""}" data-profile="${r.id}" style="--c:${colorOf(p)}">
      <span class="rank r${i + 1}">${i < 3 && r.v > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
      ${avatar(p)}
      <span class="who"><span class="name">${esc(p.name)} ${legend?.id === r.id ? "👑" : ""}</span>
        <span class="tags"><span class="lvl-chip">Lv ${lv.level}</span>${st.weeks ? `<span>🔥${st.weeks}w</span>` : ""}${par.placement ? "<span>📏 placing</span>" : ""}${S.mode === "week" ? `<span>${w.atPar}/7 at par</span>` : ""}${p.team ? `<span>${esc(p.team)}</span>` : ""}</span>
        <span class="bar"><i style="width:${(Math.max(0, r.v) / max) * 100}%"></i></span></span>
      <span class="score num">${fmt(r.v)}<small>${S.mode === "all" ? "XP" : "pts"}</small></span>
    </li>`;
  }).join("")}</ol>` : `<div class="empty"><span class="e">👋</span>No one here yet.</div>`;

  return `<div class="top"><div><h1>${isPublic ? "Everyone" : esc(g.name)}</h1><div class="sub">${E.ids.length} player${E.ids.length === 1 ? "" : "s"}${legend ? ` · 👑 ${esc(E.byId.get(legend.id).name)} is Local Legend` : ""}</div></div>
    <div class="row"><button class="icon-btn" data-act="share-standings" aria-label="Share standings">${ICON.share}</button>${isPublic ? "" : `<button class="icon-btn" data-act="group-settings" aria-label="Group settings">⚙️</button>`}</div></div>
  ${chips}
  ${tierNote}
  <section class="card">
    <div class="seg three" role="group" aria-label="Period">${[["week", "Week"], ["season", "Season"], ["all", "All-time"]].map(([k, l]) => `<button data-mode="${k}" aria-pressed="${S.mode === k}">${l}</button>`).join("")}</div>
    <p class="small muted" style="margin:-4px 0 6px">${sub}</p>
    ${list}
  </section>
  ${isPublic ? "" : forfeitCard(E, g) + teamsCard(E, g, ws) + journeyCard(E, g)}
  ${isPublic ? "" : huntBoardCard(E)}
  ${seasonCard(E)}`;
}

// Lowest weekly score first. Placement players and anyone who joined mid-week sit the forfeit out.
function forfeitStandings(E, ws) {
  return E.ids.filter((id) => E.eligible(id, ws) && E.byId.get(id).joined_at.slice(0, 10) <= ws)
    .map((id) => ({ id, v: E.week(id, ws).form })).sort((a, b) => a.v - b.v);
}

const WHEEL_SUGGESTIONS = ["Buys the first round", "Delete TikTok for 48 hours", "Cold shower tomorrow", "50 burpees on video",
  "Cooks dinner for the winner", "Wears something ridiculous for a day", "Plans the next group walk", "Posts an old embarrassing photo"];

// The wheel opens for last week any time, and for this week from Sunday 6pm.
function wheelOpen(ws) {
  const thisWs = weekStart(today());
  if (ws < thisWs) return true;
  const now = new Date();
  return ws === thisWs && now.getDay() === 0 && now.getHours() >= 18;
}

const spinFor = (B, ws) => (B.data.spins || []).find((s) => s.week_start === ws);

function forfeitCard(E, g) {
  const B = cur();
  const t = today(), ws = weekStart(t);
  const rows = forfeitStandings(E, ws);
  const slices = g.forfeits.length ? g.forfeits : [];
  const daysLeft = 6 - ((parseDay(t).getDay() + 6) % 7);
  const lastWs = addDays(ws, -7);
  const last = forfeitStandings(E, lastWs);
  const bottom = rows[0] && E.byId.get(rows[0].id);
  const lastSpin = spinFor(B, lastWs), nowSpin = spinFor(B, ws);
  const spinLine = (spin, label) => {
    const who = spin.loser_id && E.byId.get(spin.loser_id);
    return `<div class="callout result" data-wheel="${spin.week_start}" style="cursor:pointer">🎡 ${label}: <b>${esc(who?.name || "Last place")}</b>'s forfeit is <b>${esc(spin.forfeit)}</b>. <span class="small muted">Tap to replay</span></div>`;
  };
  let wheelArea = "";
  if (nowSpin) wheelArea = spinLine(nowSpin, "This week");
  else if (rows.length >= 2 && wheelOpen(ws)) wheelArea = `<button class="btn block" data-wheel="${ws}">🎡 Spin the wheel for ${esc(bottom.name)}</button>`;
  if (lastSpin) wheelArea += spinLine(lastSpin, "Last week");
  else if (last.length >= 2) wheelArea += `<button class="btn block ${nowSpin || wheelOpen(ws) ? "ghost" : ""}" data-wheel="${lastWs}" style="margin-top:8px">🎡 Spin last week's wheel for ${esc(E.byId.get(last[0].id).name)}</button>`;
  return `<section class="card forfeit">
    <div class="row spread"><h2 style="margin:0">😬 Forfeit watch</h2><span class="pill">${daysLeft ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left` : "Wheel at 6pm"}</span></div>
    <p class="muted small" style="margin:6px 0 10px">Lowest score on Sunday night spins the wheel. ${slices.length ? `${slices.length} forfeit${slices.length === 1 ? "" : "s"} on it.` : `Right now it can only land on: <b style="color:var(--text)">${esc(g.forfeit || "Buys the first round")}</b>.`}</p>
    ${rows.length < 2 ? `<p class="small muted">Kicks in once two people have finished their placement week.</p>`
      : `<div class="row" style="margin-bottom:12px">${avatar(bottom)}<div class="grow"><div class="loser">${esc(bottom.name)}</div><div class="small muted num">${fmt(rows[0].v)} pts · ${fmt(rows[1].v - rows[0].v)} behind ${esc(E.byId.get(rows[1].id).name)}</div></div></div>`}
    ${wheelArea}
    <button class="btn sm ghost" data-act="edit-wheel" style="margin-top:10px">${slices.length < 2 ? "Add forfeits to the wheel" : "See or add forfeits"}</button>
  </section>`;
}

function teamsCard(E, g, ws) {
  if (!g.teams.length) return "";
  const rows = g.teams.map((t) => {
    const ms = E.ids.filter((id) => E.byId.get(id).team === t);
    const total = ms.reduce((a, id) => a + E.week(id, ws).form, 0);
    return { t, n: ms.length, avg: ms.length ? total / ms.length : 0 };
  }).sort((a, b) => b.avg - a.avg);
  return `<section class="card"><h2>⚔️ Team battle</h2>
    <table class="teams-table"><thead><tr><th>Team</th><th>Players</th><th>Avg score</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><b>${i === 0 && r.avg > 0 ? "👑 " : ""}${esc(r.t)}</b></td><td>${r.n}</td><td class="num"><b>${fmt(r.avg)}</b></td></tr>`).join("")}
    </tbody></table><p class="small muted" style="margin:8px 0 0">This week's average per player, so team sizes don't matter.</p></section>`;
}

function journeyCard(E, g) {
  const season = seasonOf(today());
  let steps = 0;
  for (const id of E.ids) for (let d = season.start; d <= today(); d = addDays(d, 1)) steps += E.day(id, d).steps;
  const done = steps * KM_PER_STEP;
  const goal = Number(g.challenge_km) || 460;
  const laps = Math.floor(done / goal);
  const pct = ((done % goal) / goal) * 100;
  return `<section class="card journey"><div class="row spread"><h2 style="margin:0">🗺️ ${esc(g.challenge_name)}</h2>${laps ? `<span class="pill ok">✓ ×${laps}</span>` : ""}</div>
    <div class="track"><i style="width:${pct}%"></i><span class="walker" style="left:${Math.max(3, Math.min(97, pct))}%">🚶</span></div>
    <div class="row spread small"><span class="num"><b>${fmt(done % goal)}</b> of ${fmt(goal)} km</span><span class="muted num">${fmt(goal - (done % goal))} km to go</span></div>
    <p class="small muted" style="margin:8px 0 0">Team effort: everyone's steps this season count. New route each season.</p></section>`;
}

function seasonCard(E) {
  const s = seasonOf(today());
  const left = daysBetween(today(), s.end);
  const res = E.seasonResults(s).slice(0, 3);
  return `<section class="card"><div class="row spread"><h2 style="margin:0">🏆 ${s.name}</h2><span class="pill">${left} day${left === 1 ? "" : "s"} left</span></div>
    <p class="small muted" style="margin:6px 0 8px">Top 3 when the season ends win a trophy that stays on their profile forever.</p>
    ${res.length ? res.map((r, i) => { const p = E.byId.get(r.id); return `<div class="row mini"><span>${["🥇", "🥈", "🥉"][i]}</span>${avatar(p, "sm")}<span class="grow">${esc(p.name)}</span><b class="num">${fmt(r.score)}</b></div>`; }).join("") : '<p class="small muted" style="margin:0">No scores yet this season.</p>'}
  </section>`;
}

// ----- Log -----
function tabLog() {
  const t = today();
  const opts = Array.from({ length: 7 }, (_, i) => addDays(t, -i));
  const sel = S.logDay || t;
  const r = S.mine.day(S.me.id, sel);
  const optHtml = opts.map((d, i) => `<option value="${d}" ${d === sel ? "selected" : ""}>${i === 0 ? "Today" : i === 1 ? "Yesterday" : dayLabel(d)}</option>`).join("");
  const autoScroll = S.me.scroll_source === "auto";
  return `<div class="top"><div><h1>Log</h1><div class="sub">Fix or fill in a day</div></div></div>
  <section class="card"><label class="field" style="margin:0"><span>Day</span><select data-act="log-day">${optHtml}</select></label></section>
  <form class="card" data-form="log-steps">
    <h2>🚶 Steps</h2>
    <input name="steps" class="big-input num" type="number" inputmode="numeric" min="0" max="200000" placeholder="0" value="${r.steps || ""}" required aria-label="Steps">
    <button class="btn block" style="margin-top:10px">Save steps</button>
    <p class="small muted" style="margin:8px 0 0">Find it in Apple Health, Google Fit or Samsung Health. ${S.me.is_public ? "Typed-in steps count half in the public league." : ""}</p>
  </form>
  <form class="card" data-form="log-scroll">
    <h2>📵 Scrolling</h2>
    <input name="minutes" class="big-input num" type="number" inputmode="numeric" min="0" max="1440" placeholder="0" value="${r.scrollSrc === "reported" ? r.scrollMin : ""}" required aria-label="Minutes of short-video scrolling">
    <p class="small muted" style="margin:8px 0 0">Minutes on TikTok, Reels and Shorts. On iPhone: Settings → Screen Time → See All App & Website Activity. On Android: Settings → Digital Wellbeing.${autoScroll ? ` Auto-tracking says <b>${fmt(r.scrollMin)} min</b>; anything you type here replaces it.` : ""}</p>
    <button class="btn block" style="margin-top:10px">Save minutes</button>
  </form>`;
}

// ----- Me -----
function profileBody(E, id) {
  const p = E.byId.get(id);
  const x = E.xp(id), st = E.streak(id), par = E.par(id, today());
  const trophies = E.trophies(id);
  const badges = E.badges(id);
  let total = 0, best = 0, active = 0;
  for (let d = Effort.iso(new Date(p.created_at)); d <= today(); d = addDays(d, 1)) {
    const r = E.day(id, d);
    total += r.steps; best = Math.max(best, r.steps); if (r.active) active++;
  }
  const tr = E.trail(id);
  return `<div class="profile-hero"><div class="walker-box">${Walker.svg(charOf(p), { gear: p.equipped, fog: tr.fog, mood: tr.fog > 0.45 ? "foggy" : "ok", label: `${p.name}'s walker` })}</div><div><h2>${esc(p.name)}</h2><div class="small muted">Level ${x.level} · ${esc(x.title)}${p.team ? " · " + esc(p.team) : ""}</div><div class="small" style="margin-top:6px">📍 ${esc(tr.region)} · <b class="num">${fmt(tr.reached)}</b> landmarks</div></div></div>
  <section class="card"><h2>Last 14 days</h2>${chart(E, id)}<p class="small muted" style="margin:4px 0 0">Daily effort. Dashed line is par; solid bars beat it.</p></section>
  <section class="card"><div class="stats">
    <div class="stat"><b class="num">${par.placement ? "—" : fmt(par.value)}</b><span>par</span></div>
    <div class="stat"><b class="num">${st.weeks}</b><span>week streak</span></div>
    <div class="stat"><b class="num">${st.best}</b><span>best streak</span></div>
    <div class="stat"><b class="num">${fmt(best)}</b><span>best day</span></div>
    <div class="stat"><b class="num">${fmt(total)}</b><span>steps</span></div>
    <div class="stat"><b class="num">${km(total)}</b><span>km</span></div>
  </div></section>
  ${trophies.length ? `<section class="card"><h2>Trophies</h2><div class="badges">${trophies.map((t) => `<div class="badge"><span class="e">${["🥇", "🥈", "🥉"][t.place - 1]}</span>Season ${t.season}<small>${["Champion", "2nd place", "3rd place"][t.place - 1]}</small></div>`).join("")}</div></section>` : ""}
  <section class="card"><h2>Badges <span class="muted small" style="font-weight:500">${badges.filter((b) => b.ok).length}/${badges.length}</span></h2>
    <div class="badges">${badges.map((b) => `<div class="badge ${b.ok ? "" : "locked"}"><span class="e">${b.e}</span>${b.n}<small>${b.d}</small></div>`).join("")}</div></section>`;
}

function chart(E, id, days = 14) {
  const list = Array.from({ length: days }, (_, i) => addDays(today(), i - days + 1));
  const vals = list.map((d) => E.day(id, d).total);
  const par = E.par(id, today()).value;
  const p = E.byId.get(id);
  const max = Math.max(par * 1.3, ...vals, 1), min = Math.min(0, ...vals);
  const W = 320, H = 150, pad = 18, bw = (W - 8) / days;
  const y = (v) => 8 + (max - v) / (max - min) * (H - pad - 8);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last ${days} days">
    <line class="goal" x1="0" x2="${W}" y1="${y(par)}" y2="${y(par)}"/>
    <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>
    ${vals.map((v, i) => `<rect x="${4 + i * bw + 2}" y="${Math.min(y(v), y(0))}" width="${bw - 4}" height="${Math.abs(y(0) - y(v))}" rx="4" fill="${v < 0 ? "var(--bad)" : colorOf(p)}" opacity="${v >= par ? 1 : 0.45}"><title>${dayLabel(list[i])}: ${signed(v)}</title></rect>`).join("")}
    ${list.map((d, i) => (i % 2 === (days - 1) % 2 ? `<text x="${4 + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${parseDay(d).toLocaleDateString("en-GB", { weekday: "narrow" })}</text>` : "")).join("")}
  </svg>`;
}

function tabMe() {
  const B = cur();
  const E = B && B.E.byId.has(S.me.id) ? B.E : S.mine;
  const row = (act, e, label, sub) => `<button class="list-row" data-act="${act}"><span class="e">${e}</span><span class="grow"><b>${label}</b>${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span>${ICON.chev}</button>`;
  return `<div class="top"><div><h1>You</h1></div><button class="btn sm ghost" data-act="edit-profile">Edit</button></div>
  ${profileBody(E, S.me.id)}
  <section class="card list">
    ${row("setup-steps", "🚶", "Step syncing", S.me.steps_synced_at ? `Last ${ago(S.me.steps_synced_at)} via ${esc(S.me.steps_source)}` : "Not connected")}
    ${row("setup-scroll", "📵", "Scroll tracking", S.me.scroll_synced_at ? `Last ${ago(S.me.scroll_synced_at)} (${S.me.scroll_source === "auto" ? "automatic" : "typed in"})` : "Not set up, 30 min/day assumed")}
    ${row("group-menu", "👥", "Groups", S.groups.length ? S.groups.map((g) => esc(g.name)).join(", ") : "Create or join one")}
    <label class="list-row"><span class="e">🌍</span><span class="grow"><b>Public league</b><br><span class="small muted">Compete with everyone on Effort, in leagues matched to your level</span></span><input type="checkbox" class="switch" data-act="toggle-public" ${S.me.is_public ? "checked" : ""}></label>
    ${row("open-trail", "🥾", "Your trail", "Landmarks, regions and fuel")}
    ${row("open-gear", "🎒", "Gear", S.me.equipped ? `Wearing: ${esc(Walker.GEAR[S.me.equipped]?.name || "")}` : "Found on the trail")}
    ${row("retake", "🧪", "Retake the quiz", "Get a new look")}
    ${row("open-recap", "📊", "Weekly recap", "A shareable card of your week")}
    ${row("how", "❓", "How scoring works")}
    ${row("restore", "🔑", "Copy restore link", "Keep it safe: it logs you in on a new phone")}
    ${row("sign-out", "🚪", "Sign out on this phone")}
  </section>
  <p class="small muted" style="text-align:center">Effort · your data is only shared with your groups${S.me.is_public ? " and the public league" : ""}</p>`;
}

// ---------- setup guides ----------
function setupBody(kind, platform) {
  const p = S.setupPlatform || platform || detectPlatform();
  const t = S.token;
  const toggle = `<div class="toggle" style="margin-bottom:12px">${[["ios", "iPhone"], ["android", "Android"], ["other", "Type it in"]].map(([v, l]) => `<button type="button" data-setup="${v}" data-kind="${kind}" aria-pressed="${v === p}">${l}</button>`).join("")}</div>`;
  const box = (url) => `<div class="copybox"><code>${esc(url)}</code><button class="btn sm" data-copy="${esc(url)}">Copy</button></div>`;
  const g = cur()?.data?.group;
  let body;
  if (kind === "steps") {
    if (p === "ios") body = `
      ${g?.shortcut_url ? `<div class="callout"><b>Quick way:</b> copy your link, then <a href="${esc(g.shortcut_url)}" target="_blank" rel="noopener">add the group's Shortcut</a> and paste it when asked. Then do steps 6–8.</div>` : ""}
      <ol class="steps-list">
        <li>Open <b>Shortcuts</b>, tap <b>+</b>, name it <b>Effort Steps</b>.</li>
        <li>Add <b>Find Health Samples</b>: Type <b>Steps</b>, filter <b>Start Date is today</b>, <b>Group By: Day</b>.</li>
        <li>Add <b>Calculate Statistics</b> → <b>Sum</b>.</li>
        <li>Add <b>Get Contents of URL</b> and paste:${box(`${API}/log?t=${t}&steps=`)}then tap the end and insert the <b>Statistics</b> variable.</li>
        <li>Tap ▶︎ to test. You should see "✅ … steps logged".</li>
        <li><b>Automation</b> tab → <b>+</b> → <b>Time of Day</b>.</li>
        <li>Pick <b>23:45</b>, <b>Daily</b>, <b>Run Immediately</b>.</li>
        <li>Choose <b>Effort Steps</b>. Add 13:00 and 18:00 too for a live board.</li>
      </ol>`;
    else if (p === "android") body = `
      <ol class="steps-list">
        <li>Make sure Samsung Health, Google Fit or Fitbit syncs to <b>Health Connect</b>.</li>
        <li>Install <a href="https://play.google.com/store/apps/details?id=com.hcwebhook.app" target="_blank" rel="noopener"><b>HC Webhook</b></a> (free).</li>
        <li>Grant <b>Steps</b>, turn on Steps only, set resolution to <b>Daily</b>.</li>
        <li>Under <b>Webhooks</b>, add:${box(`${API}/hc?t=${t}`)}</li>
        <li>Sync every <b>60 min</b>, then tap <b>Sync now</b>.</li>
      </ol>
      <p class="small muted">If your phone kills background apps, set HC Webhook's battery to <b>Unrestricted</b>.</p>`;
    else body = `<p>Use the <b>Log</b> tab to type your steps in each day. You can fix the last 7 days.</p>`;
  } else {
    if (p === "ios") body = `
      <p class="small">Two automations tell Effort when TikTok, Instagram or YouTube opens and closes, and Effort works out the minutes.</p>
      <ol class="steps-list">
        <li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>App</b>.</li>
        <li><b>Choose</b> TikTok, Instagram and YouTube (whichever you scroll on). Tick <b>Is Opened</b> only.</li>
        <li>Pick <b>Run Immediately</b> and turn <b>Notify When Run</b> off → <b>Next</b>.</li>
        <li><b>New Blank Automation</b> → <b>Get Contents of URL</b>, paste:${box(`${API}/scroll?t=${t}&ev=open`)}</li>
        <li>Make a second one the same way, but tick <b>Is Closed</b> and use:${box(`${API}/scroll?t=${t}&ev=close`)}</li>
      </ol>
      <p class="small muted">iPhones can't tell Reels from the rest of Instagram, so only add apps you mostly use for short videos.</p>`;
    else if (p === "android") body = `
      <p class="small">Free with <a href="https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid" target="_blank" rel="noopener"><b>MacroDroid</b></a> (uses 2 of its 5 free macros).</p>
      <ol class="steps-list">
        <li>New macro → Trigger <b>Applications → Application Launched/Closed</b> → <b>Launched</b> → pick TikTok, Instagram, YouTube.</li>
        <li>Action <b>Web Interactions → HTTP Request</b>, GET:${box(`${API}/scroll?t=${t}&ev=open`)}</li>
        <li>Make a second macro with <b>Application Closed</b> and:${box(`${API}/scroll?t=${t}&ev=close`)}</li>
        <li>Allow the permissions it asks for and turn off battery optimisation for MacroDroid.</li>
      </ol>
      <p class="small muted"><b>Tasker users:</b> send the day's exact minutes to ${esc(`${API}/scroll?t=${t}&minutes=`)}&lt;minutes&gt; once a night instead.</p>`;
    else body = `<p>Each evening, check Screen Time (iPhone) or Digital Wellbeing (Android) and type your TikTok/Reels/Shorts minutes into the <b>Log</b> tab.</p>`;
  }
  return `${toggle}<section class="card">${body}</section>`;
}

// ---------- sheets ----------
function openSheet(html) {
  const sh = $("#sheet");
  sh.classList.toggle("still", !sh.hidden); // swapping content in an open sheet shouldn't replay the slide-in
  sh.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  sh.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeSheet() {
  const sh = $("#sheet");
  sh.hidden = true; sh.innerHTML = "";
  document.body.style.overflow = "";
}
const sheetHead = (title) => `<div class="row spread" style="margin-bottom:10px"><h2 style="margin:0;font-size:22px">${title}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>`;

function setupSheet(kind) {
  openSheet(`${sheetHead(kind === "steps" ? "Connect your steps" : "Track your scrolling")}${setupBody(kind, S.me.platform)}
    <div class="btn-row"><button class="btn" data-act="check-sync" data-kind="${kind}">Check connection</button></div>
    <p id="sync-status" class="small muted" style="text-align:center"></p>`);
}

function howSheet() {
  const R = RULES;
  openSheet(`${sheetHead("How it works")}
  <section class="card"><h2>🥾 Your walker and the trail</h2>
    <p class="small">Every point of effort is <b>fuel</b>. Fuel walks your walker along an endless trail: a landmark every ${R.landmarkEvery} fuel (roughly 10,000 steps), a new region every ${R.landmarksPerRegion} landmarks, and gear to find and wear along the way.</p>
    <p class="small" style="margin:0"><b>Fog:</b> scrolling over your budget in the last 7 days builds fog. Your walker goes grey and slows down, up to ${Math.round(R.fogSlow * 100)}% slower. Stay under budget and it clears.</p></section>
  <section class="card"><h2>🌙 The Hunt</h2><p class="small" style="margin:0">One run a night from ${Hunt.OPEN_HOUR}:00. Tap to kill. Steps set your tap power, health, time (1 min per 1,000 steps, max 15) and stomps. Scrolling over budget means more enemies, tougher enemies, weaker taps and fog. Kills damage the group boss, double on Sundays. Quit or close the app mid-run and it counts as zero.</p></section>
  <section class="card"><h2>📱 The Scroll (group boss)</h2><p class="small" style="margin:0">A new boss every Monday with ${R.bossHpPer} HP per player. Everyone's step points hit it; every minute anyone scrolls over budget heals it by ${R.bossHealPerMin}. Beat it by Sunday night.</p></section>
  <section class="card"><h2>🚶 Effort (every day)</h2>
    <p class="small"><b>+1 point per 100 steps</b> (half rate after ${fmt(R.fullRateUntil)}, max ${fmt(R.stepCap)} steps).</p>
    <p class="small"><b>Scroll budget:</b> every 1,000 steps earns ${R.budgetPer1000} free minutes of TikTok/Reels/Shorts (up to ${R.budgetCap}). Each minute <b>over</b> budget costs 1 point. Each minute you <b>don't</b> use is worth +0.5 (if you track scrolling).</p>
    <p class="small muted" style="margin:0">No scroll tracking? We assume ${R.assumedScrollMin} min a day.</p></section>
  <section class="card"><h2>🎯 Par and score (every week)</h2>
    <p class="small">Your <b>par</b> is your average day (your last ${R.parWindow} active days, ignoring your best and worst). Each day you score <b>your effort as a % of par</b> (max ${R.formCap}). Add up the week = your <b>score</b>.</p>
    <p class="small">That's why a beginner can beat a marathoner: you're racing your own normal. Your first few days set your par (placement), and you can't get the forfeit while placing.</p>
    <p class="small muted" style="margin:0">Par can't drop more than 15% below its recent high, so tanking a week doesn't help.</p></section>
  <section class="card"><h2>🔥 Streaks</h2><p class="small" style="margin:0">Beat your par on <b>${R.parDaysForStreakWeek} of 7 days</b> to keep your weekly streak. Every 4 streak weeks earns a ❄️ freeze that saves one missed week.</p></section>
  <section class="card"><h2>⭐ Levels (forever)</h2><p class="small" style="margin:0">Positive effort becomes XP. You never lose XP. New players get <b>2× XP for 14 days</b>, and anyone coming back after 5+ days off gets 2× for 3 days.</p></section>
  <section class="card"><h2>🏆 Seasons</h2><p class="small" style="margin:0">Every ${R.seasonWeeks} weeks. Top 3 win a permanent trophy, then everyone starts the next season level. Plus: 👑 <b>Local Legend</b> goes to whoever beat par on the most days in the last 30.</p></section>
  <section class="card"><h2>🌍 Public league</h2><p class="small" style="margin:0">Bronze → Silver → Gold → Platinum → Diamond. Score ${R.leagueUp}+ in a week to go up, under ${R.leagueDown} to drop. You only see players in your league.</p></section>`);
}

function profileSheet(id) {
  const B = cur();
  if (!B) return;
  openSheet(`<div class="row spread" style="margin-bottom:4px"><span></span><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>${profileBody(B.E, id)}`);
}

function editProfileSheet() {
  const m = S.me;
  const g = cur()?.data?.group;
  const myTeam = S.groups.find((x) => "g:" + x.code === S.boardKey)?.team;
  openSheet(`${sheetHead("Edit profile")}
  <form class="card" data-form="profile">
    <label class="field"><span>Name</span><input name="name" maxlength="24" value="${esc(m.name)}" required></label>
    ${g && g.teams.length ? `<label class="field"><span>Team in ${esc(g.name)}</span><select name="team"><option value="">No team</option>${g.teams.map((t) => `<option ${t === myTeam ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>` : ""}
    <label class="field"><span>Phone</span><select name="platform">${[["ios", "iPhone"], ["android", "Android"], ["other", "Other"]].map(([v, l]) => `<option value="${v}" ${v === m.platform ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <button class="btn block">Save</button>
  </form>
  <button class="btn ghost block" data-act="retake">Retake the quiz (new look)</button>`);
}

// ----- Trail & gear -----
function trailSheet() {
  const tr = S.mine.trail(S.me.id);
  const G = Walker.GEAR;
  openSheet(`${sheetHead("Your trail")}
    <section class="card stage" style="min-height:150px">${Walker.scene(tr.biome, Walker.hash(S.me.id))}
      <div class="tag-region" style="left:12px;right:auto;max-width:70%">📍 ${esc(tr.region)}</div>
      <div class="trail-bar" style="position:absolute;left:0;right:0;bottom:0;margin:12px">
        <div class="row spread small"><b>Next: ${esc(tr.next.name)}</b><span class="num muted">${fmt(RULES.landmarkEvery - tr.into)} fuel</span></div>
        <div class="bar" style="margin-top:6px"><i style="width:${(100 * tr.into) / RULES.landmarkEvery}%"></i></div>
        ${tr.next.item ? `<div class="small" style="margin-top:6px">🎁 Something's waiting there…</div>` : ""}
      </div></section>
    <section class="card"><div class="stats">
      <div class="stat"><b class="num">${fmt(tr.dist)}</b><span>fuel burned</span></div>
      <div class="stat"><b class="num">${fmt(tr.reached)}</b><span>landmarks</span></div>
      <div class="stat"><b class="num">${tr.items.length}/${Object.keys(G).length}</b><span>gear found</span></div>
    </div></section>
    <section class="card"><h2>Recent landmarks</h2>
      ${tr.recent.length ? `<ul class="landmarks">${tr.recent.map((m) => `<li><span class="pin">${m.i}</span><span class="grow"><b>${esc(m.name)}</b><br><span class="small muted">${esc(m.region)}</span></span>${m.item ? `<span class="pill warn">🎁 ${esc(G[m.item].name)}</span>` : ""}</li>`).join("")}</ul>`
        : `<p class="small muted" style="margin:0">Nothing yet. Every ${RULES.landmarkEvery} fuel (about 10,000 steps) gets you to the next landmark.</p>`}
    </section>
    <button class="btn block" data-act="open-gear">Wear your gear</button>
    <p class="small muted" style="text-align:center">Every 1 point of effort is 1 fuel. Fog from scrolling slows you down by up to ${Math.round(RULES.fogSlow * 100)}%.</p>`);
}

function gearSheet() {
  const tr = S.mine.trail(S.me.id);
  const owned = new Set(tr.items);
  const G = Walker.GEAR;
  const ch = charOf(S.me);
  const rare = ["", "Common", "Uncommon", "Rare", "Legendary"];
  const tiles = Object.entries(G).sort((a, b) => a[1].rarity - b[1].rarity).map(([id, g]) => owned.has(id)
    ? `<button data-equip="${id}" aria-pressed="${S.me.equipped === id}">${Walker.svg(ch, { gear: id, crop: g.slot === "pet" ? "full" : "head", label: g.name })}${esc(g.name)}<br><span class="muted" style="font-weight:600">${rare[g.rarity]}</span></button>`
    : `<div class="locked" title="Not found yet">?</div>`).join("");
  openSheet(`${sheetHead("Gear")}
    <p class="muted" style="margin-top:-4px">Found on your trail. Tap to wear one${S.me.equipped ? ", tap again to take it off" : ""}.</p>
    <div class="gear-grid">${tiles}</div>
    <p class="small muted" style="text-align:center;margin-top:14px">${owned.size} of ${Object.keys(G).length} found. Rarer gear turns up further along the trail.</p>`);
}

function groupMenuSheet() {
  openSheet(`${sheetHead("Groups")}
  ${S.groups.length ? `<section class="card list">${S.groups.map((g) => `<div class="list-row"><span class="e">👥</span><span class="grow"><b>${esc(g.name)}</b><br><span class="small muted">Code ${esc(g.code)}</span></span><button class="btn sm ghost" data-invite="${esc(g.code)}" data-name="${esc(g.name)}">Invite</button></div>`).join("")}</section>` : ""}
  <form class="card" data-form="join-code"><h2>Join with a code</h2><div class="row"><input name="code" placeholder="Invite code" autocomplete="off" maxlength="6" class="grow code-input"><button class="btn">Join</button></div></form>
  <form class="card" data-form="create"><h2>Create a group</h2>
    <label class="field"><span>Group name</span><input name="name" required maxlength="40" placeholder="The Walking Dead"></label>
    <label class="field"><span>Forfeit for the week's lowest score (optional)</span><input name="forfeit" maxlength="120" placeholder="Buys the first round"></label>
    <button class="btn block">Create and invite</button></form>`);
}

function inviteSheet(code, name) {
  const link = `${APP_URL}?g=${code}`;
  openSheet(`${sheetHead(`Invite to ${esc(name)}`)}
    <section class="card" style="text-align:center">
      <p class="small muted">Send the link, or let them scan this.</p>
      <div id="qr" class="qr"></div>
      <div class="copybox"><code>${esc(link)}</code><button class="btn sm" data-copy="${esc(link)}">Copy</button></div>
      <button class="btn block" data-share-invite="${esc(code)}" data-name="${esc(name)}">${ICON.share} Share invite</button>
      <p class="small muted" style="margin:10px 0 0">Code <b style="letter-spacing:.12em">${esc(code)}</b></p>
    </section>`);
  const el = $("#qr");
  if (el && window.QRCode) new window.QRCode(el, { text: link, width: 168, height: 168, correctLevel: window.QRCode.CorrectLevel.M });
  else if (el) el.hidden = true;
}

function groupSettingsSheet(members) {
  const g = cur().data.group;
  const code = S.boardKey.slice(2);
  const key = S.adminKeys[code];
  const leave = `<button class="btn danger block" data-act="leave-group">Leave ${esc(g.name)}</button>`;
  const invite = `<button class="btn block" data-invite="${esc(code)}" data-name="${esc(g.name)}" style="margin-bottom:12px">${ICON.share} Invite people</button>`;
  if (!key) {
    openSheet(`${sheetHead(esc(g.name))}${invite}
      <section class="card"><p class="small"><b>Forfeit:</b> ${esc(g.forfeit || "none")}<br><b>Journey:</b> ${esc(g.challenge_name)} (${fmt(g.challenge_km)} km)<br><b>Teams:</b> ${g.teams.length ? g.teams.map(esc).join(", ") : "off"}</p>
      <button class="btn sm ghost" data-act="admin-login">I'm the admin</button></section>${leave}`);
    return;
  }
  const journeyOpts = JOURNEYS.map(([n, k]) => `<option value="${k}" data-name="${esc(n)}" ${Number(g.challenge_km) === k && g.challenge_name === n ? "selected" : ""}>${esc(n)} (${fmt(k)} km)</option>`).join("");
  openSheet(`${sheetHead(esc(g.name))}${invite}
  <form class="card" data-form="admin">
    <h2>Admin settings</h2>
    <label class="field"><span>Group name</span><input name="name" maxlength="40" value="${esc(g.name)}"></label>
    <label class="field"><span>Weekly forfeit for the lowest score</span><input name="forfeit" maxlength="120" value="${esc(g.forfeit)}"></label>
    <label class="field"><span>Group journey (resets each season)</span><select name="journey"><option value="">Custom…</option>${journeyOpts}</select></label>
    <div class="row"><label class="field grow"><span>Journey name</span><input name="challenge_name" maxlength="60" value="${esc(g.challenge_name)}"></label><label class="field" style="width:110px"><span>km</span><input name="challenge_km" type="number" inputmode="numeric" min="1" value="${g.challenge_km}"></label></div>
    <label class="field"><span>Teams (comma separated, blank for none)</span><input name="teams" maxlength="200" value="${esc(g.teams.join(", "))}" placeholder="Hares, Tortoises"></label>
    <label class="field"><span>Forfeit wheel (one per line, up to 12)</span><textarea name="forfeits" rows="5" maxlength="800" placeholder="Buys the first round">${esc(g.forfeits.join("\n"))}</textarea></label>
    <label class="field"><span>Shared iPhone steps Shortcut (optional)</span><input name="shortcut_url" type="url" value="${esc(g.shortcut_url || "")}" placeholder="https://www.icloud.com/shortcuts/…"></label>
    <button class="btn block">Save settings</button>
  </form>
  <section class="card"><h2>Players</h2>
    <p class="small muted">Copy someone's restore link if they lost their phone. Removing someone takes them out of this group only.</p>
    ${members.map((m) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">${avatar(m, "sm")}<div class="grow"><b>${esc(m.name)}</b><div class="small muted">${m.steps_synced_at ? "synced " + ago(m.steps_synced_at) : "never synced"}</div></div>
      <button class="btn sm ghost" data-copy="${esc(APP_URL + "?me=" + m.token)}" data-label="Restore link copied">Link</button>
      <button class="btn sm danger" data-remove="${m.id}" data-name="${esc(m.name)}">✕</button></div>`).join("")}
  </section>
  <p class="small muted" style="text-align:center">Admin key: <b>${esc(key)}</b> (keep it safe)</p>${leave}`);
}

function standingsText() {
  const B = cur();
  const E = B.E, ws = weekStart(today());
  const rows = E.ids.map((id) => ({ id, v: E.week(id, ws).form })).sort((a, b) => b.v - a.v).slice(0, 10);
  const medal = ["🥇", "🥈", "🥉"];
  const me = E.week(S.me.id, ws);
  return `⚡ Effort · ${boardName(S.boardKey)} · this week\n` +
    rows.map((r, i) => { const p = E.byId.get(r.id); return `${medal[i] || `${i + 1}.`} ${p.name} ${fmt(r.v)}${E.streak(r.id).weeks >= 2 ? ` 🔥${E.streak(r.id).weeks}` : ""}`; }).join("\n") +
    `\n\nMe: ${km(me.steps)} km walked${me.scrollMin ? `, ${fmt(me.scrollMin)} min scrolled` : ""}.`;
}

// ---------- forfeit wheel ----------
const WHEEL_COLORS = ["#f2611d", "#2f7d4f", "#f5c542", "#74b6e0", "#d9483b", "#8c6bb1", "#e98fb0", "#5a8a3a"];

function wheelSvg(slices) {
  const n = slices.length, R = 150, C = 160;
  const pt = (a) => [C + R * Math.sin(a), C - R * Math.cos(a)];
  const segs = slices.map((s, i) => {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, mid = (a0 + a1) / 2;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    const path = n === 1 ? `<circle cx="${C}" cy="${C}" r="${R}" fill="${WHEEL_COLORS[0]}"/>`
      : `<path d="M${C},${C} L${x0},${y0} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z" fill="${WHEEL_COLORS[i % WHEEL_COLORS.length]}"/>`;
    const label = s.length > 22 ? s.slice(0, 21) + "…" : s;
    const deg = (mid * 180) / Math.PI - 90;
    return `${path}<text transform="rotate(${deg} ${C} ${C})" x="${C + R - 12}" y="${C}" text-anchor="end" dominant-baseline="middle" font-size="${n > 8 ? 10 : 11.5}" font-weight="700" fill="#fff">${esc(label)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 320 320" class="wheel-svg" role="img" aria-label="Forfeit wheel with ${n} forfeits">${segs}<circle cx="${C}" cy="${C}" r="22" fill="var(--card)" stroke="var(--line)" stroke-width="3"/></svg>`;
}

function wheelSheet(ws) {
  const B = cur();
  const E = B.E, g = B.data.group;
  const spin = spinFor(B, ws);
  const loser = spin?.loser_id ? E.byId.get(spin.loser_id) : E.byId.get(forfeitStandings(E, ws)[0]?.id);
  const slices = spin ? spin.slices : g.forfeits.length ? g.forfeits : [g.forfeit || "Buys the first round"];
  const weekLabel = ws === weekStart(today()) ? "this week" : `week of ${dayLabel(ws, { day: "numeric", month: "short" })}`;
  openSheet(`${sheetHead("Forfeit wheel")}
    <p class="muted" style="margin-top:-4px">${loser ? `<b style="color:var(--ink)">${esc(loser.name)}</b> came last ${weekLabel}.` : ""} One spin per week, and it's final.</p>
    <div class="wheel-wrap"><div class="wheel-pointer" aria-hidden="true"></div><div class="wheel" id="wheel">${wheelSvg(slices)}</div></div>
    <p id="wheel-result" class="wheel-result" aria-live="polite"></p>
    <div class="btn-row">${spin ? `<button class="btn" data-act="replay-spin" data-ws="${ws}">Replay the spin</button>` : `<button class="btn" data-act="spin" data-ws="${ws}" data-loser="${loser?.id || ""}">Spin it</button>`}</div>`);
  if (spin) showWheelResult(spin, loser, true);
}

function animateWheel(slice, n, instant) {
  const el = $("#wheel");
  if (!el) return Promise.resolve();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = 360 * (instant || reduce ? 0 : 6) + (360 - ((slice + 0.5) / n) * 360) + (Math.random() - 0.5) * (300 / n) / 2;
  el.style.transition = "none";
  el.style.transform = "rotate(0deg)";
  void el.offsetWidth;
  el.style.transition = instant ? "none" : `transform ${reduce ? 0.6 : 5}s cubic-bezier(.12,.72,.08,1)`;
  el.style.transform = `rotate(${target}deg)`;
  return new Promise((r) => setTimeout(r, instant ? 0 : reduce ? 650 : 5100));
}

function showWheelResult(spin, loser, quiet) {
  const out = $("#wheel-result");
  if (!out) return;
  animateWheel(spin.slice, spin.slices.length, quiet).then(() => {
    out.innerHTML = `<span class="big-emoji">😬</span><b>${esc(loser?.name || "Last place")}</b>'s forfeit:<br><span class="forfeit-text">${esc(spin.forfeit)}</span>`;
    out.classList.add("show");
    if (!quiet) {
      const share = document.createElement("button");
      share.className = "btn ghost block";
      share.style.marginTop = "10px";
      share.textContent = "Share the result";
      share.onclick = () => share(`🎡 Effort forfeit wheel: ${loser?.name || "Last place"}'s forfeit is "${spin.forfeit}". Better luck next week 😬`);
      out.after(share);
    }
  });
}

function editWheelSheet() {
  const B = cur();
  const g = B.data.group;
  const code = S.boardKey.slice(2);
  const isAdmin = !!S.adminKeys[code];
  const unused = WHEEL_SUGGESTIONS.filter((s) => !g.forfeits.some((f) => f.toLowerCase() === s.toLowerCase()));
  openSheet(`${sheetHead("Forfeits on the wheel")}
    <section class="card">
      ${g.forfeits.length ? `<div class="wheel-list">${g.forfeits.map((f, i) => `<span class="wheel-chip" style="--c:${WHEEL_COLORS[i % WHEEL_COLORS.length]}">${esc(f)}</span>`).join("")}</div>` : `<p class="small muted">Nothing on the wheel yet. Add at least two so there's something to spin for.</p>`}
      <form data-form="add-forfeit" class="row" style="margin-top:12px"><input name="text" maxlength="60" placeholder="Add a forfeit" class="grow" aria-label="New forfeit"><button class="btn">Add</button></form>
      ${unused.length ? `<p class="small muted" style="margin:12px 0 6px">Ideas (tap to add):</p><div class="wheel-list">${unused.map((s) => `<button class="wheel-chip idea" data-suggest="${esc(s)}">＋ ${esc(s)}</button>`).join("")}</div>` : ""}
    </section>
    <p class="small muted">Anyone in the group can add forfeits, up to 12. ${isAdmin ? "You can remove them in group settings (⚙️)." : "The admin can remove them."}</p>`);
}

async function addForfeit(item) {
  if (!item || !item.trim()) { toast("Write a forfeit first"); return; }
  try {
    const r = await call("add_forfeit", { token: S.token, code: S.boardKey.slice(2), text: item.trim() });
    cur().data.group = { ...cur().data.group, ...r.group };
    editWheelSheet();
    toast("Added to the wheel");
  } catch (err) { toast(err.message); }
}

// ---------- weekly recap ----------
function recapData(E, id, ws) {
  const t = today();
  const p = E.byId.get(id);
  let steps = 0, best = { steps: 0, d: null }, tracked = 0, scrollMin = 0, kept = 0, over = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    if (d > t) break;
    const r = E.day(id, d);
    steps += r.steps;
    if (r.steps > best.steps) best = { steps: r.steps, d };
    if (r.scrollSrc === "auto" || r.scrollSrc === "reported") {
      tracked++; scrollMin += r.scrollMin;
      kept += Math.max(0, r.budget - r.scrollMin); over += Math.max(0, r.scrollMin - r.budget);
    }
  }
  const w = E.week(id, ws);
  const ranked = E.ids.map((x) => ({ id: x, v: E.week(x, ws).form })).sort((a, b) => b.v - a.v);
  const rivalId = E.rivals(ws).get(id);
  return {
    p, ws, steps, km: steps * KM_PER_STEP, best, tracked, scrollMin, kept, over,
    form: w.form, atPar: w.atPar, rank: ranked.findIndex((r) => r.id === id) + 1, of: ranked.length,
    winner: ranked[0] && ranked[0].v > 0 ? E.byId.get(ranked[0].id) : null,
    rival: rivalId ? { p: E.byId.get(rivalId), mine: w.form, theirs: E.week(rivalId, ws).form } : null,
    streak: E.streak(id).weeks, level: E.xp(id),
  };
}

const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m` : `${Math.round(m)}m`);

function recapHeadline(r) {
  const walked = `Walked ${r.km.toFixed(r.km < 10 ? 1 : 0)} km`;
  if (!r.tracked) return `${walked} this week.`;
  if (r.kept >= r.over) return `${walked} and left ${hm(r.kept - r.over)} of scroll budget unused.`;
  return `${walked} but scrolled ${hm(r.over - r.kept)} over budget.`;
}

async function drawRecap(r, groupName, spin) {
  try { await Promise.all([document.fonts.load("800 120px 'Bricolage Grotesque'"), document.fonts.load("700 40px Figtree"), document.fonts.load("700 48px Caveat")]); } catch { /* fall back to system font */ }
  const W = 1080, H = 1350;
  const PAPER = "#eceee4", CARD = "#fbfbf6", INK = "#1f2a24", ORANGE = "#f2611d", SUN = "#f5c542", SKY = "#cfe6f2", MUTED = "#5b6a5f";
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const font = (w, s, fam = "'Bricolage Grotesque'") => `${w} ${s}px ${fam}, "Segoe UI", system-ui, sans-serif`;
  const rr = (X, Y, w, h, rad) => { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, w, h, rad); else x.rect(X, Y, w, h); };
  const sticker = (X, Y, w, h, rad, fill) => { x.fillStyle = INK; rr(X + 8, Y + 10, w, h, rad); x.fill(); x.fillStyle = fill; rr(X, Y, w, h, rad); x.fill(); x.lineWidth = 5; x.strokeStyle = INK; x.stroke(); };
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  // topo lines, like the app background
  x.strokeStyle = "rgba(31,42,36,.07)"; x.lineWidth = 3;
  for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(-40, 140 + i * 150); x.bezierCurveTo(260, 60 + i * 150, 620, 230 + i * 150, 1120, 120 + i * 150); x.stroke(); }

  x.textBaseline = "alphabetic";
  x.fillStyle = ORANGE; x.font = font(800, 46); x.fillText("effort", 80, 112);
  x.fillStyle = MUTED; x.textAlign = "right"; x.font = font(700, 32, "Figtree");
  x.fillText(`${dayLabel(r.ws, { day: "numeric", month: "short" })} – ${dayLabel(addDays(r.ws, 6), { day: "numeric", month: "short" })}`, W - 80, 110);
  x.textAlign = "left";

  // the walker, in its own sticker
  sticker(640, 150, 360, 410, 40, SKY);
  try {
    const svgStr = Walker.svg(charOf(r.p), { mood: "fresh", gear: r.p.equipped, standalone: true }).replace("<svg ", '<svg width="360" height="414" ');
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" })); });
    x.drawImage(img, 652, 156, 336, 386);
  } catch { /* card still works without the drawing */ }

  x.fillStyle = INK; x.font = font(800, 72); x.fillText(r.p.name, 80, 240);
  x.fillStyle = MUTED; x.font = font(700, 32, "Figtree"); x.fillText(`Level ${r.level.level} · ${r.level.title}`, 82, 290);
  x.fillStyle = INK; x.font = font(800, 210); x.fillText(fmt(r.form), 68, 490);
  x.fillStyle = ORANGE; x.font = font(700, 54, "Caveat"); x.save(); x.translate(84, 548); x.rotate(-0.035); x.fillText("points this week!", 0, 0); x.restore();
  if (r.of > 1) {
    const pill = `#${r.rank} of ${r.of} in ${groupName}`;
    x.font = font(700, 32, "Figtree");
    const pw = Math.min(520, x.measureText(pill).width + 44);
    sticker(80, 584, pw, 60, 30, SUN);
    x.fillStyle = INK; x.fillText(pill, 102, 625, pw - 44);
  }

  const tiles = [
    [`${r.km.toFixed(r.km < 10 ? 1 : 0)} km`, `${fmt(r.steps)} steps`],
    [`${r.atPar}/7`, "days beating par"],
    [r.tracked ? hm(r.scrollMin) : "—", r.tracked ? (r.kept >= r.over ? `${hm(r.kept - r.over)} under budget` : `${hm(r.over - r.kept)} over budget`) : "scrolling not tracked"],
    [r.best.d ? fmt(r.best.steps) : "—", r.best.d ? `best day (${dayLabel(r.best.d, { weekday: "short" })})` : "best day"],
  ];
  tiles.forEach(([big, small], i) => {
    const X = 80 + (i % 2) * 470, Y = 690 + Math.floor(i / 2) * 186;
    sticker(X, Y, 440, 158, 30, CARD);
    x.fillStyle = INK; x.font = font(800, 58); x.fillText(big, X + 30, Y + 80);
    x.fillStyle = MUTED; x.font = font(700, 28, "Figtree"); x.fillText(small, X + 30, Y + 126);
  });

  x.fillStyle = INK; x.font = font(800, 38);
  const y = wrapText(x, recapHeadline(r), 80, 1112, W - 160, 48);
  const extras = [];
  if (r.streak) extras.push(`🔥 ${r.streak}-week streak`);
  if (r.rival) extras.push(`⚔️ ${r.rival.mine > r.rival.theirs ? "beat" : r.rival.mine < r.rival.theirs ? "lost to" : "tied"} ${r.rival.p.name} ${fmt(r.rival.mine)}–${fmt(r.rival.theirs)}`);
  if (spin) extras.push(`🎡 ${spin.loser}'s forfeit: ${spin.forfeit}`);
  else if (r.winner && r.of > 1) extras.push(`🏆 ${r.winner.name} won the week`);
  x.fillStyle = MUTED; x.font = font(700, 30, "Figtree");
  wrapText(x, extras.join("   ·   "), 80, y + 56, W - 160, 42);
  x.fillStyle = MUTED; x.font = font(700, 26, "Figtree"); x.fillText(APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, ""), 80, H - 40);
  x.globalAlpha = 1;
  return c;
}

function wrapText(x, str, X, Y, maxW, lh) {
  const words = str.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (x.measureText(test).width > maxW && line) { x.fillText(line, X, Y); Y += lh; line = w; } else line = test;
  }
  if (line) x.fillText(line, X, Y);
  return Y; // baseline of the last line drawn
}

async function recapSheet(which = "auto") {
  const t = today(), thisWs = weekStart(t);
  const dow = parseDay(t).getDay();
  const ws = which === "last" || (which === "auto" && (dow === 1 || dow === 2)) ? addDays(thisWs, -7) : thisWs;
  const B = cur();
  const E = B && B.E.byId.has(S.me.id) ? B.E : S.mine;
  const r = recapData(E, S.me.id, ws);
  const spinRow = B?.data?.spins && spinFor(B, ws);
  const spin = spinRow && { loser: E.byId.get(spinRow.loser_id)?.name || "Last place", forfeit: spinRow.forfeit };
  const groupName = boardName(S.boardKey);
  openSheet(`${sheetHead("Your week")}
    <div class="seg two" role="group" aria-label="Week"><button data-recap="this" aria-pressed="${ws === thisWs}">This week</button><button data-recap="last" aria-pressed="${ws !== thisWs}">Last week</button></div>
    <div class="recap-frame"><div class="empty"><span class="e">🖼️</span>Drawing your card…</div></div>
    <p class="small muted" style="text-align:center">${esc(recapHeadline(r))}</p>
    <div class="btn-row"><button class="btn" data-act="share-recap">${ICON.share} Share image</button><button class="btn ghost" data-act="share-recap-text">Share as text</button></div>`);
  const canvas = await drawRecap(r, groupName, spin);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  S.recap = { blob, text: `⚡ My Effort week: ${fmt(r.form)} pts${r.of > 1 ? `, #${r.rank} of ${r.of} in ${groupName}` : ""}. ${recapHeadline(r)}${r.streak ? ` 🔥 ${r.streak}-week streak.` : ""}` };
  const frame = $(".recap-frame");
  if (frame) {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    img.alt = `Recap card: ${S.recap.text}`;
    frame.innerHTML = "";
    frame.append(img);
  }
}

async function shareRecapImage() {
  if (!S.recap?.blob) return;
  const file = new File([S.recap.blob], "effort-week.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: S.recap.text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(S.recap.blob);
  a.download = "effort-week.png";
  document.body.append(a); a.click(); a.remove();
  toast("Image saved. Share it from your photos or downloads.");
}

function recapCard() {
  const dow = new Date().getDay();
  if (![0, 1, 2].includes(dow)) return "";
  return `<section class="card recap-teaser row" data-act="open-recap" style="cursor:pointer;gap:12px"><span style="font-size:30px">📊</span><div class="grow"><b>${dow === 0 ? "Your week so far" : "Last week in review"}</b><br><span class="small muted">A shareable card for the group chat</span></div>${ICON.chev}</section>`;
}

// ---------- flows ----------
// The quiz is done: create the player (or save a retaken look) with their answers.
async function finishQuiz() {
  const { name, ...character } = S.answers;
  if (S.retake) {
    await call("update_me", { token: S.token, character });
    S.retake = false;
    store.del("draftAnswers");
    S.view = "main"; S.tab = "me";
    await refresh();
    toast("New look saved");
    return;
  }
  const body = { name, character, platform: S.draft.platform, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const r = S.invite ? await call("join", { ...body, code: S.invite.code }) : await call("signup", body);
  saveToken(r.player);
  S.me = r.player;
  store.del("draftAnswers");
  if (S.invite) { S.boardKey = "g:" + S.invite.code; store.set("board", S.boardKey); }
  S.invite = null;
  S.view = "onboard"; S.step = 1;
  render(); scrollTo(0, 0);
}

function quizAdvance() {
  store.set("draftAnswers", S.answers);
  if (S.qi < QUESTIONS.length - 1) { S.qi++; render(); scrollTo(0, 0); }
  else { S.view = "reveal"; render(); scrollTo(0, 0); }
}

async function joinGroup(code) {
  const r = await call("join", { token: S.token, code });
  S.boardKey = "g:" + r.code; store.set("board", S.boardKey);
  await refresh(true);
  closeSheet();
  S.tab = "board"; store.set("tab", "board");
  render();
  toast(`You're in ${boardName(S.boardKey)}`);
}

async function lookupInvite(code) {
  const b = await call("board", null, `?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  return { code: b.group.code, name: b.group.name, members: b.players.length };
}

// ---------- events ----------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-profile], [data-tab], [data-act], [data-wheel], a");
  if (!t) { if (e.target.id === "sheet") { closeSheet(); render(); } return; }
  const d = t.dataset;
  if (d.copy) return copy(d.copy, d.label || "Copied");
  if (d.tab && t.tagName !== "A") { closeSheet(); S.tab = d.tab; store.set("tab", S.tab); render(); scrollTo(0, 0); return; }
  if (d.mode) { S.mode = d.mode; store.set("mode", S.mode); render(); return; }
  if (d.wheel) return wheelSheet(d.wheel);
  if (d.recap) return recapSheet(d.recap);
  if (d.suggest) return addForfeit(d.suggest);
  if (d.board) {
    S.boardKey = d.board; store.set("board", S.boardKey);
    if (!S.boards[d.board]) { render(); try { await loadBoard(d.board); } catch (err) { toast(err.message); } }
    render(); return;
  }
  if (d.profile) return profileSheet(d.profile);
  if (d.answer !== undefined && S.view === "quiz") {
    S.answers[QUESTIONS[S.qi].id] = d.answer;
    t.parentElement.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", b === t));
    const pv = $("#quiz-preview"); if (pv) pv.innerHTML = quizPreview("fresh");
    setTimeout(quizAdvance, 380);
    return;
  }
  if (d.platform) { S.draft.platform = d.platform; S.answers.name = $("[name=name]")?.value ?? S.answers.name; render(); return; }
  if (d.setup) { S.setupPlatform = d.setup; if (S.view === "onboard") render(); else setupSheet(d.kind); return; }
  if (d.equip) {
    const next = S.me.equipped === d.equip ? null : d.equip;
    try { await call("update_me", { token: S.token, equipped: next }); S.me.equipped = next; headCache.clear(); await refresh(true); gearSheet(); toast(next ? `Wearing: ${Walker.GEAR[next].name}` : "Gear off"); }
    catch (err) { toast(err.message); }
    return;
  }
  if (d.invite) return inviteSheet(d.invite, d.name);
  if (d.shareInvite) return share(`Join ${d.name} on Effort ⚡ Walk more, scroll less. Code ${d.shareInvite}`, `${APP_URL}?g=${d.shareInvite}`);
  if (d.remove) {
    if (!confirm(`Remove ${d.name} from this group?`)) return;
    const code = S.boardKey.slice(2);
    try {
      await call("admin_remove", { code, admin_key: S.adminKeys[code], player_id: d.remove });
      toast(`${d.name} removed`);
      await loadBoard(S.boardKey);
      const r = await call("admin_members", { code, admin_key: S.adminKeys[code] });
      groupSettingsSheet(r.members);
    } catch (err) { toast(err.message); }
    return;
  }

  switch (d.act) {
    case "start":
      S.view = "quiz"; S.qi = 0; render(); break;
    case "quiz-back":
      if (S.qi > 0) { S.qi--; render(); } else if (S.retake) { S.retake = false; S.view = "main"; render(); } else { S.view = "welcome"; render(); }
      break;
    case "quiz-next": quizAdvance(); break;
    case "quiz-restart": S.view = "quiz"; S.qi = 1; render(); break;
    case "quiz-done": t.disabled = true; try { await finishQuiz(); } catch (err) { toast(err.message); t.disabled = false; } break;
    case "retake":
      closeSheet();
      S.retake = true; S.answers = { ...charOf(S.me), name: S.me.name }; S.qi = 1; S.view = "quiz"; render(); scrollTo(0, 0);
      break;
    case "open-trail": trailSheet(); break;
    case "hunt-start": startHunt(); break;
    case "hunt-done": S.view = "main"; S.tab = "home"; render(); scrollTo(0, 0); break;
    case "hunt-share": { const r = S.huntResult; share(`🌙 Effort hunt: ${fmt(r.score)} pts, ${r.kills} kills, wave ${r.wave}. ${r.survived ? "Survived the night." : "Doomscrolled to death."}`); break; }
    case "open-gear": gearSheet(); break;
    case "ob-next":
      if (S.step < 2) { S.step++; S.setupPlatform = null; render(); scrollTo(0, 0); }
      else { S.view = "loading"; render(); await refresh(); }
      break;
    case "refresh": t.disabled = true; await refresh(); toast("Updated"); break;
    case "setup-steps": S.setupPlatform = null; setupSheet("steps"); break;
    case "setup-scroll": S.setupPlatform = null; setupSheet("scroll"); break;
    case "close-sheet": closeSheet(); render(); break;
    case "how": howSheet(); break;
    case "hide-install": store.set("hideInstall", true); render(); break;
    case "install": if (installPrompt) { installPrompt.prompt(); installPrompt = null; render(); } break;
    case "share-standings": share(standingsText()); break;
    case "edit-profile": editProfileSheet(); break;
    case "group-menu": case "create-group": case "join-code": groupMenuSheet(); break;
    case "edit-wheel": editWheelSheet(); break;
    case "open-recap": recapSheet(); break;
    case "share-recap": shareRecapImage(); break;
    case "share-recap-text": if (S.recap) share(S.recap.text, APP_URL); break;
    case "replay-spin": {
      const B = cur(), spin = spinFor(B, d.ws);
      if (spin) { $("#wheel-result").classList.remove("show"); $("#wheel-result").innerHTML = ""; showWheelResult(spin, B.E.byId.get(spin.loser_id), false); }
      break;
    }
    case "spin": {
      t.disabled = true;
      const code = S.boardKey.slice(2);
      try {
        const r = await call("spin", { token: S.token, code, week_start: d.ws, loser_id: d.loser || null });
        const B = cur();
        B.data.spins = [r.spin, ...(B.data.spins || []).filter((x) => x.week_start !== r.spin.week_start)];
        if (r.already) toast("Someone already spun this week. Here's how it landed.");
        // Redraw with the slices the server actually used, then animate to the result.
        const wheel = $("#wheel");
        if (wheel) wheel.innerHTML = wheelSvg(r.spin.slices);
        t.remove();
        showWheelResult(r.spin, B.E.byId.get(r.spin.loser_id), false);
      } catch (err) { toast(err.message); t.disabled = false; }
      break;
    }
    case "restore": copy(`${APP_URL}?me=${S.token}`, "Restore link copied. Keep it private."); break;
    case "sign-out": if (confirm("Sign out on this phone? Copy your restore link first if you want to come back.")) signOut(); break;
    case "toggle-public": {
      e.preventDefault();
      const on = !S.me.is_public;
      try { await call("update_me", { token: S.token, is_public: on }); await refresh(true); toast(on ? "You're in the public league" : "Public league off"); }
      catch (err) { toast(err.message); }
      break;
    }
    case "check-sync": {
      const out = $("#sync-status");
      out.textContent = "Checking…";
      await refresh(true);
      const r = S.mine.day(S.me.id, today());
      const ts = d.kind === "steps" ? S.me.steps_synced_at : S.me.scroll_synced_at;
      out.innerHTML = ts
        ? `✅ Last ${d.kind === "steps" ? "sync" : "ping"} <b>${ago(ts)}</b>. Today: <b>${d.kind === "steps" ? fmt(r.steps) + " steps" : fmt(r.scrollMin) + " min"}</b>.`
        : d.kind === "steps" ? "Nothing yet. Run the Shortcut or tap Sync now, then check again." : "Nothing yet. Open and close TikTok once, then check again.";
      break;
    }
    case "group-settings": {
      const code = S.boardKey.slice(2);
      if (S.adminKeys[code]) {
        try { const r = await call("admin_members", { code, admin_key: S.adminKeys[code] }); groupSettingsSheet(r.members); }
        catch (err) { toast(err.message); }
      } else groupSettingsSheet([]);
      break;
    }
    case "admin-login": {
      const code = S.boardKey.slice(2);
      const key = prompt("Admin key for this group:");
      if (!key) break;
      try {
        const r = await call("admin_members", { code, admin_key: key.trim() });
        S.adminKeys[code] = key.trim(); store.set("adminKeys", S.adminKeys);
        groupSettingsSheet(r.members);
      } catch (err) { toast(err.message); }
      break;
    }
    case "leave-group": {
      const code = S.boardKey.slice(2);
      if (!confirm(`Leave ${boardName(S.boardKey)}? Your points stay on your profile.`)) break;
      try {
        await call("leave", { token: S.token, code });
        delete S.boards[S.boardKey]; S.boardKey = null;
        closeSheet(); await refresh(); toast("Left the group");
      } catch (err) { toast(err.message); }
      break;
    }
  }
});

// Colour question: repaint the walker live as the slider moves.
document.addEventListener("input", (e) => {
  if (e.target.matches("[data-hue]")) {
    S.answers.hue = Number(e.target.value);
    const pv = $("#quiz-preview");
    if (pv) pv.innerHTML = quizPreview();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.act === "log-day") { S.logDay = e.target.value; render(); }
  if (e.target.name === "journey" && e.target.value) {
    const f = e.target.form;
    f.challenge_km.value = e.target.value;
    f.challenge_name.value = e.target.selectedOptions[0].dataset.name;
  }
});

document.addEventListener("submit", async (e) => {
  const form = e.target;
  const kind = form.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const btn = form.querySelector("button:not([type=button])");
  const f = Object.fromEntries(new FormData(form));
  if (btn) btn.disabled = true;
  try {
    if (kind === "code") {
      if (f.code.trim().length < 4) { toast("Enter the 6-character code"); return; }
      S.invite = await lookupInvite(f.code);
      render();
    } else if (kind === "quiz-intro") {
      S.answers.name = f.name.trim();
      quizAdvance();
    } else if (kind === "quiz-value") {
      const q = QUESTIONS[S.qi];
      S.answers[q.id] = q.type === "number" ? Math.max(1, Math.min(99, Number(f.v) || 7)) : f.v.trim().slice(0, 30);
      quizAdvance();
    } else if (kind === "join-code") {
      if (f.code.trim().length < 4) { toast("Enter the 6-character code"); return; }
      await joinGroup(f.code.trim().toUpperCase());
    } else if (kind === "create") {
      const r = await call("create", f);
      S.adminKeys[r.code] = r.admin_key; store.set("adminKeys", S.adminKeys);
      await joinGroup(r.code);
      inviteSheet(r.code, f.name);
    } else if (kind === "log-steps") {
      const r = await call("log", { token: S.token, steps: f.steps, date: S.logDay || today(), source: "manual" });
      toast(r.message);
      await refresh(true);
    } else if (kind === "log-scroll") {
      const r = await call("scroll_minutes", { token: S.token, minutes: f.minutes, date: S.logDay || today() });
      toast(r.message);
      await refresh(true);
    } else if (kind === "profile") {
      await call("update_me", { token: S.token, name: f.name, platform: f.platform, ...(f.team !== undefined ? { code: S.boardKey.slice(2), team: f.team } : {}) });
      closeSheet();
      await refresh();
      toast("Saved");
    } else if (kind === "add-forfeit") {
      await addForfeit(f.text);
    } else if (kind === "admin") {
      const settings = { ...f, teams: f.teams.split(",").map((s) => s.trim()).filter(Boolean), forfeits: f.forfeits.split("\n").map((s) => s.trim()).filter(Boolean) };
      delete settings.journey;
      const code = S.boardKey.slice(2);
      await call("admin", { code, admin_key: S.adminKeys[code], settings });
      closeSheet();
      await refresh();
      toast("Settings saved");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn && document.contains(btn)) btn.disabled = false;
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) { closeSheet(); render(); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.view === "main") refresh(true); });
setInterval(() => { if (!document.hidden && S.view === "main" && $("#sheet").hidden) refresh(true); }, 90000);

// ---------- boot ----------
(async function boot() {
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  render();
  const params = new URLSearchParams(location.search);
  const restore = params.get("me");
  const inviteCode = params.get("g");
  if (restore && restore !== S.token) { S.token = restore; store.set("token", restore); }
  if (S.token) {
    history.replaceState(null, "", `${APP_URL}?me=${S.token}`);
    await refresh();
    if (!S.me) return;
    if (inviteCode && !S.groups.some((g) => g.code === inviteCode.toUpperCase())) {
      try {
        const inv = await lookupInvite(inviteCode);
        openSheet(`${sheetHead(`Join ${esc(inv.name)}?`)}<p>${inv.members} player${inv.members === 1 ? "" : "s"} are competing. You'll keep your level, par and badges.</p><div class="btn-row"><button class="btn" data-act="accept-invite">Join</button></div>`);
        $("[data-act=accept-invite]").addEventListener("click", () => joinGroup(inv.code).catch((err) => toast(err.message)));
      } catch (err) { toast(err.message); }
    }
    return;
  }
  if (inviteCode) {
    try { S.invite = await lookupInvite(inviteCode); } catch (err) { toast(err.message); }
  }
  S.view = "welcome";
  render();
})();
