"use strict";

const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");
const KM_PER_STEP = 0.000762;
const EMOJIS = ["🚶", "🏃", "👟", "🦵", "🐆", "🐢", "🦄", "🐉", "🦊", "🐼", "🐸", "🦁", "🐙", "🚀", "⚡", "🔥", "👑", "🍕"];
const COLORS = ["#6d5efc", "#ff5fa2", "#14a86b", "#f08a24", "#0ea5e9", "#e5484d", "#a855f7", "#eab308"];
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
  draft: { emoji: EMOJIS[0], color: COLORS[0], platform: detectPlatform() },
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
  const E = Effort.build({ players, steps: data.steps, scroll: data.scroll, today: today(), league: key === "public" });
  S.boards[key] = { data, E };
}

async function loadMe() {
  const r = await call("me", { token: S.token });
  S.me = r.player;
  S.groups = r.groups;
  S.mine = Effort.build({ players: [r.player], steps: r.steps, scroll: r.scroll, today: today() });
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
  const views = { loading: viewLoading, welcome: viewWelcome, onboard: viewOnboard, main: viewMain };
  app.innerHTML = (views[S.view] || viewWelcome)();
}

const viewLoading = () => `<div class="empty" style="padding-top:30vh"><span class="e">⚡</span>Loading…</div>`;

function rulesCards() {
  return `<div class="feature-list">
    <div><span class="e">🚶</span><span><b>Walk = points</b><br><span class="muted small">Steps sync from your phone automatically.</span></span></div>
    <div><span class="e">📵</span><span><b>Scrolling costs points</b><br><span class="muted small">Every 1,000 steps earns 5 min of TikTok, Reels or Shorts. Go over and you lose points.</span></span></div>
    <div><span class="e">🎯</span><span><b>Beat your own par</b><br><span class="muted small">Each week is won by whoever beats their own average day by the most, so anyone can win from day one.</span></span></div>
    <div><span class="e">🏆</span><span><b>Levels, streaks and seasons</b><br><span class="muted small">Your level and badges are forever. Every 6 weeks a new season starts.</span></span></div>
  </div>`;
}

function viewWelcome() {
  const inv = S.invite;
  return `<section class="welcome">
    <img class="logo" src="icon.svg" alt="">
    <h1>Effort</h1>
    <p class="lead">Walk more. Scroll less. Beat your friends.</p>
    ${inv ? `<div class="callout" style="text-align:left;margin-bottom:16px">You're invited to <b>${esc(inv.name)}</b> (${inv.members} ${inv.members === 1 ? "player" : "players"}).</div>` : ""}
    ${rulesCards()}
    <button class="btn block" data-act="start">${inv ? `Join ${esc(inv.name)}` : "Get started"}</button>
    ${inv ? "" : `<form data-form="code" class="row" style="margin-top:12px"><input name="code" placeholder="Invite code" autocomplete="off" maxlength="6" class="grow code-input"><button class="btn ghost">Join</button></form>`}
    <p class="small muted" style="margin-top:18px">Had it on another phone? Open your restore link, or ask your group admin for it.</p>
  </section>`;
}

// Onboarding: 0 profile → 1 steps → 2 scrolling → done
function viewOnboard() {
  const dots = `<div class="dots">${[0, 1, 2].map((i) => `<i class="${i <= S.step ? "on" : ""}"></i>`).join("")}</div>`;
  if (S.step === 0) {
    const d = S.draft;
    return `${dots}<h1 class="ob-title">Who are you?</h1>
    <form class="card" data-form="profile-new">
      <div class="row" style="margin-bottom:14px"><div class="avatar lg" style="--c:${d.color}">${d.emoji}</div><label class="field grow" style="margin:0"><span>Your name</span><input name="name" required maxlength="24" placeholder="What your friends call you" value="${esc(d.name || "")}" autocomplete="given-name"></label></div>
      <div class="picker" style="margin-bottom:12px">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" aria-pressed="${e === d.emoji}">${e}</button>`).join("")}</div>
      <div class="swatches" style="margin-bottom:16px">${COLORS.map((c) => `<button type="button" data-color="${c}" style="background:${c}" aria-pressed="${c === d.color}" aria-label="Colour ${c}"></button>`).join("")}</div>
      <label class="field"><span>Your phone</span></label>
      <div class="toggle" style="margin-bottom:16px">${[["ios", "iPhone"], ["android", "Android"], ["other", "Other"]].map(([v, l]) => `<button type="button" data-platform="${v}" aria-pressed="${v === d.platform}">${l}</button>`).join("")}</div>
      <button class="btn block">Next</button>
    </form>`;
  }
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
  const ringPct = Math.min(1, pct / 100);
  const R = 46, C = 2 * Math.PI * R;
  const budgetLeft = r.budget - (r.scrollSrc === "assumed" ? RULES.assumedScrollMin : r.scrollMin);
  const scrollLabel = r.scrollSrc === "assumed" ? `~${RULES.assumedScrollMin} min assumed` : r.scrollSrc === "none" ? "not tracked" : `${fmt(r.scrollMin)} min`;
  return `<section class="hero">
    <div class="ring"><svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="${R}" stroke="rgba(255,255,255,.22)" stroke-width="10" fill="none"/><circle cx="54" cy="54" r="${R}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ringPct)}"/></svg>
      <div class="center"><div><div class="pct num">${pct}%</div><div class="lbl">of par</div></div></div></div>
    <div class="grow">
      <div class="small" style="opacity:.85">Today's effort</div>
      <div class="big num">${signed(r.total)}</div>
      <div class="meta">${par.placement ? "Placement: setting your par" : `Your par is ${fmt(par.value)}`}</div>
    </div>
  </section>
  <section class="card split">
    <div><div class="small muted">🚶 Steps</div><b class="num">${fmt(r.steps)}</b><span class="pts good">${signed(r.stepPts)}</span></div>
    <div><div class="small muted">📵 Scrolling</div><b class="num">${scrollLabel}</b><span class="pts ${r.scrollPts < 0 ? "bad" : "good"}">${r.scrollPts ? signed(r.scrollPts) : "±0"}</span></div>
    <div class="budget"><div class="row spread small"><span>Scroll budget</span><span class="num">${budgetLeft >= 0 ? `${fmt(budgetLeft)} of ${r.budget} min left` : `${fmt(-budgetLeft)} min over`}</span></div>
      <div class="bar"><i style="width:${r.budget ? Math.min(100, (100 * Math.max(0, budgetLeft)) / RULES.budgetCap) : 0}%;--c:var(--good)"></i></div>
      <div class="small muted" style="margin-top:4px">Every 1,000 steps earns 5 min (up to ${RULES.budgetCap}).</div></div>
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
      <span class="avatar" style="--c:${S.me.color}">${esc(S.me.emoji)}</span><b class="num grow">${fmt(mine)}</b>
      <span class="vs">vs</span>
      <b class="num grow" style="text-align:right">${fmt(theirs)}</b><span class="avatar" style="--c:${them.color}">${esc(them.emoji)}</span>
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
    ${show.map((r) => { const p = B.E.byId.get(r.id); const i = rows.indexOf(r); return `<div class="row mini"><span class="rank r${i + 1}">${i + 1}</span><span class="avatar sm" style="--c:${p.color}">${esc(p.emoji)}</span><span class="grow ${r.id === S.me.id ? "b" : ""}">${esc(p.name)}</span><b class="num">${fmt(r.v)}</b></div>`; }).join("")}
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
    return `<li class="${r.id === S.me.id ? "me" : ""}" data-profile="${r.id}" style="--c:${p.color}">
      <span class="rank r${i + 1}">${i < 3 && r.v > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
      <span class="avatar">${esc(p.emoji)}</span>
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
  ${seasonCard(E)}`;
}

function forfeitCard(E, g) {
  const t = today(), ws = weekStart(t);
  // Placement players and anyone who joined mid-week sit the forfeit out.
  const rows = E.ids.filter((id) => E.eligible(id, ws) && E.byId.get(id).joined_at.slice(0, 10) <= ws)
    .map((id) => ({ id, v: E.week(id, ws).form })).sort((a, b) => a.v - b.v);
  if (!g.forfeit && rows.length < 2) return "";
  const daysLeft = 6 - ((parseDay(t).getDay() + 6) % 7);
  const lastWs = addDays(ws, -7);
  const last = E.ids.filter((id) => E.eligible(id, lastWs) && E.byId.get(id).joined_at.slice(0, 10) <= lastWs)
    .map((id) => ({ id, v: E.week(id, lastWs).form })).sort((a, b) => a.v - b.v);
  const bottom = rows[0] && E.byId.get(rows[0].id);
  return `<section class="card forfeit">
    <div class="row spread"><h2 style="margin:0">😬 Forfeit watch</h2><span class="pill">${daysLeft ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left` : "Last day!"}</span></div>
    <p class="muted small" style="margin:6px 0 10px">Lowest score on Sunday night: <b style="color:var(--text)">${esc(g.forfeit || "no forfeit set yet")}</b></p>
    ${rows.length < 2 ? `<p class="small muted" style="margin:0">Kicks in once two people have finished their placement week.</p>`
      : `<div class="row"><span class="avatar" style="--c:${bottom.color}">${esc(bottom.emoji)}</span><div class="grow"><div class="loser">${esc(bottom.name)}</div><div class="small muted num">${fmt(rows[0].v)} pts · ${fmt(rows[1].v - rows[0].v)} behind ${esc(E.byId.get(rows[1].id).name)}</div></div></div>`}
    ${last.length >= 2 ? `<div class="callout" style="margin-bottom:0">Last week: <b>${esc(E.byId.get(last[0].id).name)}</b> owes the forfeit (${fmt(last[0].v)} pts).</div>` : ""}
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
    ${res.length ? res.map((r, i) => { const p = E.byId.get(r.id); return `<div class="row mini"><span>${["🥇", "🥈", "🥉"][i]}</span><span class="avatar sm" style="--c:${p.color}">${esc(p.emoji)}</span><span class="grow">${esc(p.name)}</span><b class="num">${fmt(r.score)}</b></div>`; }).join("") : '<p class="small muted" style="margin:0">No scores yet this season.</p>'}
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
  return `<div class="row" style="margin-bottom:14px"><span class="avatar lg" style="--c:${p.color}">${esc(p.emoji)}</span><div class="grow"><h2 style="margin:0;font-size:22px">${esc(p.name)}</h2><div class="small muted">Level ${x.level} · ${esc(x.title)}${p.team ? " · " + esc(p.team) : ""}</div></div></div>
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
    ${vals.map((v, i) => `<rect x="${4 + i * bw + 2}" y="${Math.min(y(v), y(0))}" width="${bw - 4}" height="${Math.abs(y(0) - y(v))}" rx="4" fill="${v < 0 ? "var(--bad)" : p.color}" opacity="${v >= par ? 1 : 0.45}"><title>${dayLabel(list[i])}: ${signed(v)}</title></rect>`).join("")}
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
  openSheet(`${sheetHead("How scoring works")}
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
  S.edit = { emoji: m.emoji, color: m.color };
  const g = cur()?.data?.group;
  const myTeam = S.groups.find((x) => "g:" + x.code === S.boardKey)?.team;
  openSheet(`${sheetHead("Edit profile")}
  <form class="card" data-form="profile">
    <label class="field"><span>Name</span><input name="name" maxlength="24" value="${esc(m.name)}" required></label>
    <div class="picker" style="margin-bottom:12px">${EMOJIS.map((e) => `<button type="button" data-edit-emoji="${e}" aria-pressed="${e === m.emoji}">${e}</button>`).join("")}</div>
    <div class="swatches" style="margin-bottom:16px">${COLORS.map((c) => `<button type="button" data-edit-color="${c}" style="background:${c}" aria-pressed="${c === m.color}" aria-label="Colour ${c}"></button>`).join("")}</div>
    ${g && g.teams.length ? `<label class="field"><span>Team in ${esc(g.name)}</span><select name="team"><option value="">No team</option>${g.teams.map((t) => `<option ${t === myTeam ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>` : ""}
    <label class="field"><span>Phone</span><select name="platform">${[["ios", "iPhone"], ["android", "Android"], ["other", "Other"]].map(([v, l]) => `<option value="${v}" ${v === m.platform ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <button class="btn block">Save</button>
  </form>`);
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
    <label class="field"><span>Shared iPhone steps Shortcut (optional)</span><input name="shortcut_url" type="url" value="${esc(g.shortcut_url || "")}" placeholder="https://www.icloud.com/shortcuts/…"></label>
    <button class="btn block">Save settings</button>
  </form>
  <section class="card"><h2>Players</h2>
    <p class="small muted">Copy someone's restore link if they lost their phone. Removing someone takes them out of this group only.</p>
    ${members.map((m) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(m.emoji)}</span><div class="grow"><b>${esc(m.name)}</b><div class="small muted">${m.steps_synced_at ? "synced " + ago(m.steps_synced_at) : "never synced"}</div></div>
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

// ---------- flows ----------
async function finishProfile(f) {
  const body = { name: f.name, emoji: S.draft.emoji, color: S.draft.color, platform: S.draft.platform, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const r = S.invite ? await call("join", { ...body, code: S.invite.code }) : await call("signup", body);
  saveToken(r.player);
  S.me = r.player;
  if (S.invite) { S.boardKey = "g:" + S.invite.code; store.set("board", S.boardKey); }
  S.invite = null;
  S.step = 1;
  render();
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
  const t = e.target.closest("button, [data-profile], [data-tab], [data-act], a");
  if (!t) { if (e.target.id === "sheet") { closeSheet(); render(); } return; }
  const d = t.dataset;
  if (d.copy) return copy(d.copy, d.label || "Copied");
  if (d.tab && t.tagName !== "A") { closeSheet(); S.tab = d.tab; store.set("tab", S.tab); render(); scrollTo(0, 0); return; }
  if (d.mode) { S.mode = d.mode; store.set("mode", S.mode); render(); return; }
  if (d.board) {
    S.boardKey = d.board; store.set("board", S.boardKey);
    if (!S.boards[d.board]) { render(); try { await loadBoard(d.board); } catch (err) { toast(err.message); } }
    render(); return;
  }
  if (d.profile) return profileSheet(d.profile);
  if (d.emoji) { S.draft.emoji = d.emoji; S.draft.name = $("[name=name]")?.value; render(); return; }
  if (d.color) { S.draft.color = d.color; S.draft.name = $("[name=name]")?.value; render(); return; }
  if (d.platform) { S.draft.platform = d.platform; S.draft.name = $("[name=name]")?.value; render(); return; }
  if (d.setup) { S.setupPlatform = d.setup; if (S.view === "onboard") render(); else setupSheet(d.kind); return; }
  if (d.editEmoji) { S.edit.emoji = d.editEmoji; t.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === t)); return; }
  if (d.editColor) { S.edit.color = d.editColor; t.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === t)); return; }
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
      S.view = "onboard"; S.step = 0; render(); break;
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
    } else if (kind === "profile-new") {
      await finishProfile(f);
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
      await call("update_me", { token: S.token, name: f.name, platform: f.platform, emoji: S.edit.emoji, color: S.edit.color, ...(f.team !== undefined ? { code: S.boardKey.slice(2), team: f.team } : {}) });
      closeSheet();
      await refresh();
      toast("Saved");
    } else if (kind === "admin") {
      const settings = { ...f, teams: f.teams.split(",").map((s) => s.trim()).filter(Boolean) };
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
