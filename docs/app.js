"use strict";

const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/steps";
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

const $ = (sel, el = document) => el.querySelector(sel);
const app = $("#app");
const fmt = (n) => Math.round(n).toLocaleString("en-GB");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const km = (steps) => (steps * KM_PER_STEP).toFixed(steps * KM_PER_STEP < 100 ? 1 : 0);

// ---------- storage (wrapped: private mode / blocked storage must not break the app) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("ss_" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("ss_" + k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem("ss_" + k); } catch { /* ignore */ } },
};

// ---------- dates (all in the viewer's local time) ----------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const weekStart = (s) => { const d = parseDay(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return iso(d); };
const monthStart = (s) => s.slice(0, 8) + "01";
const dayLabel = (s, opts = { weekday: "short", day: "numeric", month: "short" }) => parseDay(s).toLocaleDateString("en-GB", opts);
function ago(ts) {
  if (!ts) return "never";
  const mins = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// ---------- API ----------
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
  view: "loading",
  tab: store.get("tab") || "board",
  period: store.get("period") || "week",
  code: store.get("code"),
  token: store.get("token"),
  me: store.get("me"),
  adminKeys: store.get("adminKeys") || {},
  joinCode: null,
  setupPlatform: null,
  board: null,
  idx: null,
  draft: { emoji: EMOJIS[0], color: COLORS[0], platform: detectPlatform() },
};
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; if (S.view === "main") render(); });

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

async function copy(text, label = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); toast(label); } catch { toast("Couldn't copy, long-press to select"); }
    ta.remove();
  }
}

async function share(text, url) {
  if (navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  copy(url ? `${text}\n${url}` : text, "Copied, paste it in the group chat");
}

// ---------- derived data ----------
function buildIndex(board) {
  const steps = new Map(); // memberId -> Map(day -> steps)
  for (const r of board.days) {
    if (!steps.has(r.m)) steps.set(r.m, new Map());
    steps.get(r.m).set(r.d, r.s);
  }
  const t = today();
  const members = board.members.map((m) => ({ ...m, goal: m.goal || board.group.daily_goal }));
  const get = (id, d) => steps.get(id)?.get(d) ?? 0;
  const sum = (id, from, to) => {
    let s = 0;
    for (const [d, v] of steps.get(id) ?? []) if (d >= from && d <= to) s += v;
    return s;
  };

  // Winner of each finished day, for the "Daily Champ" badge.
  const dayWins = new Map();
  const allDays = new Set(board.days.map((r) => r.d));
  for (const d of allDays) {
    if (d >= t) continue;
    let best = null;
    for (const m of members) { const v = get(m.id, d); if (v > 0 && (!best || v > best.v)) best = { id: m.id, v }; }
    if (best) dayWins.set(best.id, (dayWins.get(best.id) ?? 0) + 1);
  }

  // Finished weeks: winner and loser of each.
  const weekResults = [];
  const firstDay = [...allDays].sort()[0];
  if (firstDay) {
    for (let ws = weekStart(firstDay); ws < weekStart(t); ws = addDays(ws, 7)) {
      const we = addDays(ws, 6);
      const eligible = members.filter((m) => m.created_at.slice(0, 10) <= we);
      if (eligible.length < 2) continue;
      const ranked = eligible.map((m) => ({ m, v: sum(m.id, ws, we) })).sort((a, b) => b.v - a.v);
      if (ranked[0].v === 0) continue;
      weekResults.push({ ws, we, winner: ranked[0], loser: ranked[ranked.length - 1] });
    }
  }

  const streak = (m) => {
    let d = get(m.id, t) >= m.goal ? t : addDays(t, -1);
    let n = 0;
    while (get(m.id, d) >= m.goal) { n++; d = addDays(d, -1); }
    return n;
  };
  const bestStreak = (m) => {
    const days = [...(steps.get(m.id) ?? [])].filter(([, v]) => v >= m.goal).map(([d]) => d).sort();
    let best = 0, run = 0, prev = null;
    for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
    return best;
  };

  return { t, members, steps, get, sum, dayWins, weekResults, streak, bestStreak };
}

function periodRange(p, t) {
  if (p === "today") return [t, t];
  if (p === "week") return [weekStart(t), t];
  if (p === "month") return [monthStart(t), t];
  return ["0000-00-00", "9999-99-99"];
}

function badgesFor(m, X) {
  const days = [...(X.steps.get(m.id) ?? [])];
  const maxDay = days.reduce((a, [, v]) => Math.max(a, v), 0);
  const total = days.reduce((a, [, v]) => a + v, 0);
  const goalDays = days.filter(([, v]) => v >= m.goal).length;
  const best = X.bestStreak(m);
  let bestWeek = 0;
  for (const [d] of days) { const ws = weekStart(d); bestWeek = Math.max(bestWeek, X.sum(m.id, ws, addDays(ws, 6))); }
  const weekWins = X.weekResults.filter((w) => w.winner.m.id === m.id).length;
  const dayWins = X.dayWins.get(m.id) ?? 0;
  return [
    { e: "👟", n: "First Steps", d: "Log a day", ok: days.length > 0 },
    { e: "🎯", n: "Goal Getter", d: "Hit your goal", ok: goalDays > 0 },
    { e: "🔥", n: "On Fire", d: "3-day streak", ok: best >= 3 },
    { e: "⚡", n: "Week Warrior", d: "7-day streak", ok: best >= 7 },
    { e: "🛡️", n: "Unbreakable", d: "30-day streak", ok: best >= 30 },
    { e: "🚀", n: "20K Club", d: "20,000 in a day", ok: maxDay >= 20000 },
    { e: "🦄", n: "30K Legend", d: "30,000 in a day", ok: maxDay >= 30000 },
    { e: "🏃", n: "Marathoner", d: "42 km in a week", ok: bestWeek >= 55400 },
    { e: "💯", n: "100K Week", d: "100,000 in a week", ok: bestWeek >= 100000 },
    { e: "🌍", n: "Million Club", d: "1M lifetime", ok: total >= 1000000 },
    { e: "👑", n: "Daily Champ", d: dayWins ? `Won ${dayWins} day${dayWins > 1 ? "s" : ""}` : "Top a day", ok: dayWins > 0 },
    { e: "🏆", n: "Weekly Winner", d: weekWins ? `Won ${weekWins} week${weekWins > 1 ? "s" : ""}` : "Win a week", ok: weekWins > 0 },
  ];
}

// ---------- icons ----------
const ICON = {
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21V11M16 21V7M12 21V3M4 21v-6M20 21v-9"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.8 3 2.6 3.5 5.2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
};

// ---------- rendering ----------
function render() {
  const views = { loading: viewLoading, welcome: viewWelcome, create: viewCreate, join: viewJoin, main: viewMain };
  app.innerHTML = (views[S.view] || viewWelcome)();
  if (S.view === "main" && S.tab === "group") drawQR();
}

const viewLoading = () => `<div class="empty" style="padding-top:30vh"><span class="e">👟</span>Loading…</div>`;

function viewWelcome() {
  return `<section class="welcome">
    <img class="logo" src="icon.svg" alt="">
    <h1>Step Squad</h1>
    <p class="lead">Your group's step leaderboard. Works on iPhone and Android.</p>
    <div class="feature-list">
      <div><span class="e">📲</span><span><b>Auto-sync</b><br><span class="muted small">iPhone Shortcut or Android Health Connect. Or just type it in.</span></span></div>
      <div><span class="e">😬</span><span><b>Weekly forfeit</b><br><span class="muted small">Bottom of the week pays up. You pick the forfeit.</span></span></div>
      <div><span class="e">🗺️</span><span><b>Group journey</b><br><span class="muted small">Walk London to Paris together, or around the world.</span></span></div>
      <div><span class="e">🔥</span><span><b>Streaks, badges and teams</b><br><span class="muted small">12 badges to unlock, optional team battles.</span></span></div>
    </div>
    <form class="card" data-form="code" style="text-align:left">
      <h2>Got an invite code?</h2>
      <div class="row"><input name="code" placeholder="CODE" autocapitalize="characters" autocomplete="off" maxlength="6" class="grow" style="text-transform:uppercase;letter-spacing:.15em;font-weight:700"><button class="btn">Join</button></div>
    </form>
    <button class="btn ghost block" data-act="go-create">Start a new group</button>
    <p class="small muted" style="margin-top:18px">Had it on another phone? Ask your group admin for your restore link.</p>
  </section>`;
}

function viewCreate() {
  return `<div class="top"><div><h1>New group</h1><div class="sub">You'll be the admin</div></div><button class="icon-btn" data-act="go-welcome" aria-label="Back">✕</button></div>
  <form class="card" data-form="create">
    <label class="field"><span>Group name</span><input name="name" required maxlength="40" placeholder="The Walking Dead"></label>
    <label class="field"><span>Daily step goal</span><input name="daily_goal" type="number" inputmode="numeric" value="10000" min="1000" max="50000" step="500"></label>
    <label class="field"><span>Weekly forfeit for last place</span><input name="forfeit" maxlength="120" placeholder="Buys the first round"></label>
    <button class="btn block">Create group</button>
  </form>`;
}

function viewJoin() {
  const g = S.joinGroup;
  const d = S.draft;
  return `<div class="top"><div><h1>Join ${esc(g.name)}</h1><div class="sub">${g.members} member${g.members === 1 ? "" : "s"} · goal ${fmt(g.daily_goal)}/day</div></div><button class="icon-btn" data-act="go-welcome" aria-label="Back">✕</button></div>
  <form class="card" data-form="join">
    <div class="row" style="margin-bottom:14px"><div class="avatar lg" style="--c:${d.color}">${d.emoji}</div><label class="field grow" style="margin:0"><span>Your name</span><input name="name" required maxlength="24" placeholder="What the group calls you" value="${esc(d.name || "")}"></label></div>
    <label class="field"><span>Pick an avatar</span></label>
    <div class="picker" style="margin-bottom:12px">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" aria-pressed="${e === d.emoji}">${e}</button>`).join("")}</div>
    <div class="swatches" style="margin-bottom:16px">${COLORS.map((c) => `<button type="button" data-color="${c}" style="background:${c}" aria-pressed="${c === d.color}" aria-label="Colour ${c}"></button>`).join("")}</div>
    ${g.teams.length ? `<label class="field"><span>Team</span><select name="team"><option value="">No team</option>${g.teams.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>` : ""}
    <label class="field"><span>Your phone</span></label>
    <div class="toggle" style="margin-bottom:16px">${[["ios", "iPhone"], ["android", "Android"], ["other", "Other"]].map(([v, l]) => `<button type="button" data-platform="${v}" aria-pressed="${v === d.platform}">${l}</button>`).join("")}</div>
    <button class="btn block">Join the squad</button>
  </form>`;
}

function viewMain() {
  const X = S.idx;
  const g = S.board.group;
  const tabs = { board: tabBoard, log: tabLog, me: tabMe, group: tabGroup };
  return `${(tabs[S.tab] || tabBoard)(X, g)}
  <nav class="nav"><div class="inner">
    ${[["board", "Board"], ["log", "Log"], ["me", "Me"], ["group", "Squad"]].map(([k, l]) =>
      `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ICON[k]}${l}</button>`).join("")}
  </div></nav>`;
}

function meMember() { return S.idx.members.find((m) => m.id === S.me?.id); }

function heroCard(X, m) {
  const v = X.get(m.id, X.t);
  const pct = Math.min(1, v / m.goal);
  const r = 46, c = 2 * Math.PI * r;
  const st = X.streak(m);
  const week = X.sum(m.id, weekStart(X.t), X.t);
  return `<section class="hero">
    <div class="ring"><svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="${r}" stroke="rgba(255,255,255,.22)" stroke-width="10" fill="none"/><circle cx="54" cy="54" r="${r}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>
      <div class="center"><div><div class="pct num">${Math.round(pct * 100)}%</div><div class="lbl">of ${fmt(m.goal)}</div></div></div></div>
    <div class="grow">
      <div class="small" style="opacity:.85">Today</div>
      <div class="big num">${fmt(v)}</div>
      <div class="meta">${km(v)} km · ${fmt(week)} this week</div>
      <div class="chips">${st ? `<span class="chip">🔥 ${st}-day streak</span>` : ""}${v >= m.goal ? '<span class="chip">🎯 Goal hit</span>' : `<span class="chip">${fmt(m.goal - v)} to go</span>`}</div>
    </div>
  </section>`;
}

function syncNotice(m) {
  if (!m) return "";
  const stale = !m.last_sync_at || Date.now() - Date.parse(m.last_sync_at) > 36 * 3600_000;
  if (!stale) return "";
  return `<div class="card row" style="gap:12px"><span style="font-size:26px">📲</span><div class="grow small"><b>${m.last_sync_at ? "Your steps haven't synced for a while" : "Connect your step tracking"}</b><br><span class="muted">Takes 3 minutes, then it's automatic.</span></div><button class="btn sm" data-act="open-setup">Set up</button></div>`;
}

function installNotice() {
  if (isStandalone() || store.get("hideInstall")) return "";
  const p = detectPlatform();
  if (p === "ios") {
    return `<div class="card install-banner"><span class="e">📌</span><div class="grow small"><b>Add to your Home Screen</b><br><span class="muted">In Safari tap <b>Share</b> ⬆️ then <b>Add to Home Screen</b>.</span></div><button class="icon-btn" data-act="hide-install" aria-label="Dismiss">✕</button></div>`;
  }
  if (installPrompt) {
    return `<div class="card install-banner"><span class="e">📌</span><div class="grow small"><b>Install Step Squad</b><br><span class="muted">One tap from your home screen.</span></div><button class="btn sm" data-act="install">Install</button></div>`;
  }
  return "";
}

function tabBoard(X, g) {
  const me = meMember();
  const [from, to] = periodRange(S.period, X.t);
  const rows = X.members.map((m) => ({ m, v: X.sum(m.id, from, to) })).sort((a, b) => b.v - a.v || a.m.name.localeCompare(b.m.name));
  const max = Math.max(1, ...rows.map((r) => r.v));
  const periodLabel = { today: "today", week: "this week", month: "this month", all: "all time" }[S.period];

  const list = rows.length ? `<ol class="lb">${rows.map((r, i) => {
    const st = X.streak(r.m);
    const hit = X.get(r.m.id, X.t) >= r.m.goal;
    return `<li class="${r.m.id === me?.id ? "me" : ""}" data-profile="${r.m.id}" style="--c:${r.m.color}">
      <span class="rank r${i + 1}">${i < 3 && r.v > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
      <span class="avatar">${esc(r.m.emoji)}</span>
      <span class="who"><span class="name">${esc(r.m.name)}</span>
        <span class="tags">${st ? `<span>🔥${st}</span>` : ""}${hit ? "<span>🎯</span>" : ""}${r.m.team ? `<span>${esc(r.m.team)}</span>` : ""}<span>${r.m.last_sync_at ? "synced " + ago(r.m.last_sync_at) : "not synced"}</span></span>
        <span class="bar"><i style="width:${(r.v / max) * 100}%"></i></span></span>
      <span class="score num">${fmt(r.v)}<small>${km(r.v)} km</small></span>
    </li>`;
  }).join("")}</ol>` : `<div class="empty"><span class="e">👋</span>No one here yet. Share the invite from the Squad tab.</div>`;

  return `<div class="top"><div><h1>${esc(g.name)}</h1><div class="sub">${X.members.length} walkers · ${dayLabel(X.t, { weekday: "long", day: "numeric", month: "long" })}</div></div>
    <div class="row"><button class="icon-btn" data-act="share-standings" aria-label="Share standings">${ICON.share}</button><button class="icon-btn" data-act="refresh" aria-label="Refresh">${ICON.refresh}</button></div></div>
  ${me ? heroCard(X, me) : ""}
  ${syncNotice(me)}
  ${installNotice()}
  <section class="card">
    <div class="seg" role="group" aria-label="Period">${[["today", "Today"], ["week", "Week"], ["month", "Month"], ["all", "All"]].map(([k, l]) => `<button data-period="${k}" aria-pressed="${S.period === k}">${l}</button>`).join("")}</div>
    ${list}
    ${rows.length && S.period !== "today" ? `<p class="small muted" style="margin:10px 0 0">Group total ${periodLabel}: <b class="num">${fmt(rows.reduce((a, r) => a + r.v, 0))}</b> steps</p>` : ""}
  </section>
  ${forfeitCard(X, g)}
  ${teamsCard(X, g, from, to, periodLabel)}
  ${journeyCard(X, g)}`;
}

function forfeitCard(X, g) {
  if (X.members.length < 2) return "";
  const ws = weekStart(X.t);
  // Anyone who joined mid-week sits this week out, so a newcomer with a half-empty week isn't stitched up.
  const rows = X.members.filter((m) => m.created_at.slice(0, 10) <= ws)
    .map((m) => ({ m, v: X.sum(m.id, ws, X.t) })).sort((a, b) => a.v - b.v);
  const last = X.weekResults[X.weekResults.length - 1];
  const lastWeekDone = last && last.we === addDays(ws, -1);
  const daysLeft = 7 - ((parseDay(X.t).getDay() + 6) % 7) - 1;
  const bottom = rows[0];
  return `<section class="card forfeit">
    <div class="row spread"><h2 style="margin:0">😬 Forfeit watch</h2><span class="pill">${daysLeft ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left` : "Last day!"}</span></div>
    <p class="muted small" style="margin:6px 0 10px">Bottom of the week on Sunday night: <b style="color:var(--text)">${esc(g.forfeit || "no forfeit set")}</b></p>
    ${rows.length < 2 ? `<p class="small muted" style="margin:0">Starts next Monday. People who join mid-week sit their first week out.</p>` : `<div class="row"><span class="avatar" style="--c:${bottom.m.color}">${esc(bottom.m.emoji)}</span><div class="grow"><div class="loser">${esc(bottom.m.name)}</div><div class="small muted num">${fmt(bottom.v)} this week${rows[1] ? ` · ${fmt(rows[1].v - bottom.v)} behind ${esc(rows[1].m.name)}` : ""}</div></div></div>`}
    ${lastWeekDone ? `<div class="callout" style="margin-bottom:0">Last week: 🏆 <b>${esc(last.winner.m.name)}</b> won with ${fmt(last.winner.v)}. <b>${esc(last.loser.m.name)}</b> owes the forfeit (${fmt(last.loser.v)}).</div>` : ""}
  </section>`;
}

function teamsCard(X, g, from, to, periodLabel) {
  if (!g.teams.length) return "";
  const rows = g.teams.map((t) => {
    const ms = X.members.filter((m) => m.team === t);
    const total = ms.reduce((a, m) => a + X.sum(m.id, from, to), 0);
    return { t, n: ms.length, total, avg: ms.length ? total / ms.length : 0 };
  }).sort((a, b) => b.avg - a.avg);
  return `<section class="card"><h2>⚔️ Team battle <span class="muted small" style="font-weight:500">${periodLabel}</span></h2>
    <table class="teams-table"><thead><tr><th>Team</th><th>Walkers</th><th>Total</th><th>Avg each</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><b>${i === 0 && r.avg > 0 ? "👑 " : ""}${esc(r.t)}</b></td><td>${r.n}</td><td class="num">${fmt(r.total)}</td><td class="num"><b>${fmt(r.avg)}</b></td></tr>`).join("")}
    </tbody></table><p class="small muted" style="margin:8px 0 0">Ranked by average per walker, so team sizes don't matter.</p></section>`;
}

function journeyCard(X, g) {
  const total = X.members.reduce((a, m) => a + X.sum(m.id, "0000-00-00", "9999-99-99"), 0);
  const done = total * KM_PER_STEP;
  const goal = Number(g.challenge_km) || 460;
  const laps = Math.floor(done / goal);
  const pct = ((done % goal) / goal) * 100;
  return `<section class="card journey"><div class="row spread"><h2 style="margin:0">🗺️ ${esc(g.challenge_name)}</h2>${laps ? `<span class="pill ok">✓ ×${laps}</span>` : ""}</div>
    <div class="track"><i style="width:${pct}%"></i><span class="walker" style="left:${Math.max(3, Math.min(97, pct))}%">🚶</span></div>
    <div class="row spread small"><span class="num"><b>${fmt(done % goal)}</b> of ${fmt(goal)} km</span><span class="muted num">${fmt(goal - (done % goal))} km to go</span></div>
    <p class="small muted" style="margin:8px 0 0">Every step anyone takes counts. ${laps ? `You've already done it ${laps === 1 ? "once" : laps + " times"}! Going again.` : ""}</p></section>`;
}

function tabLog(X) {
  const me = meMember();
  const opts = Array.from({ length: 7 }, (_, i) => addDays(X.t, -i));
  const sel = S.logDay || X.t;
  const cur = X.get(me.id, sel);
  return `<div class="top"><div><h1>Log steps</h1><div class="sub">Manual entry replaces that day's total</div></div></div>
  <form class="card" data-form="log">
    <label class="field"><span>Day</span><select name="date" data-act="log-day">${opts.map((d, i) => `<option value="${d}" ${d === sel ? "selected" : ""}>${i === 0 ? "Today" : i === 1 ? "Yesterday" : dayLabel(d)}${X.get(me.id, d) ? ` (${fmt(X.get(me.id, d))})` : ""}</option>`).join("")}</select></label>
    <label class="field"><span>Steps</span><input name="steps" class="big-input num" type="number" inputmode="numeric" min="0" max="200000" placeholder="0" value="${cur || ""}" required></label>
    <button class="btn block">Save</button>
    <p class="small muted" style="margin:10px 0 0">Find your number in the Apple Health, Google Fit or Samsung Health app.</p>
  </form>
  <section class="card"><div class="row"><span style="font-size:28px">⚡</span><div class="grow small"><b>Rather not type it every day?</b><br><span class="muted">Hook up your phone once and it syncs on its own.</span></div><button class="btn sm ghost" data-act="open-setup">Set up</button></div></section>`;
}

function chart(X, m, days = 14) {
  const list = Array.from({ length: days }, (_, i) => addDays(X.t, i - days + 1));
  const vals = list.map((d) => X.get(m.id, d));
  const max = Math.max(m.goal * 1.15, ...vals, 1);
  const W = 320, H = 150, pad = 18, bw = (W - 8) / days;
  const y = (v) => H - pad - (v / max) * (H - pad - 8);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last ${days} days">
    <line class="goal" x1="0" x2="${W}" y1="${y(m.goal)}" y2="${y(m.goal)}"/>
    ${vals.map((v, i) => `<rect x="${4 + i * bw + 2}" y="${y(v)}" width="${bw - 4}" height="${Math.max(0, H - pad - y(v))}" rx="4" fill="${m.color}" opacity="${v >= m.goal ? 1 : 0.45}"><title>${dayLabel(list[i])}: ${fmt(v)}</title></rect>`).join("")}
    ${list.map((d, i) => (i % 2 === (days - 1) % 2 ? `<text x="${4 + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${parseDay(d).toLocaleDateString("en-GB", { weekday: "narrow" })}</text>` : "")).join("")}
  </svg>`;
}

function profileBody(X, m) {
  const days = [...(X.steps.get(m.id) ?? [])];
  const total = days.reduce((a, [, v]) => a + v, 0);
  const best = days.reduce((a, [d, v]) => (v > a.v ? { d, v } : a), { d: null, v: 0 });
  const active = days.filter(([, v]) => v > 0).length;
  const badges = badgesFor(m, X);
  return `<div class="row" style="margin-bottom:14px"><span class="avatar lg" style="--c:${m.color}">${esc(m.emoji)}</span><div class="grow"><h2 style="margin:0;font-size:22px">${esc(m.name)}</h2><div class="small muted">${m.team ? esc(m.team) + " · " : ""}goal ${fmt(m.goal)}/day · ${{ ios: "iPhone", android: "Android" }[m.platform] || "manual"}</div></div></div>
  <section class="card"><h2>Last 14 days</h2>${chart(X, m)}<p class="small muted" style="margin:4px 0 0">Solid bars hit the goal (dashed line).</p></section>
  <section class="card"><div class="stats">
    <div class="stat"><b class="num">${X.streak(m)}</b><span>day streak</span></div>
    <div class="stat"><b class="num">${X.bestStreak(m)}</b><span>best streak</span></div>
    <div class="stat"><b class="num">${fmt(best.v)}</b><span>best day</span></div>
    <div class="stat"><b class="num">${fmt(active ? total / active : 0)}</b><span>daily avg</span></div>
    <div class="stat"><b class="num">${fmt(total)}</b><span>lifetime</span></div>
    <div class="stat"><b class="num">${km(total)}</b><span>km walked</span></div>
  </div></section>
  <section class="card"><h2>Badges <span class="muted small" style="font-weight:500">${badges.filter((b) => b.ok).length}/${badges.length}</span></h2>
    <div class="badges">${badges.map((b) => `<div class="badge ${b.ok ? "" : "locked"}"><span class="e">${b.e}</span>${b.n}<small>${b.d}</small></div>`).join("")}</div></section>`;
}

function tabMe(X) {
  const m = meMember();
  return `<div class="top"><div><h1>You</h1><div class="sub">Stats, streaks and badges</div></div><button class="btn sm ghost" data-act="edit-profile">Edit</button></div>
  ${profileBody(X, m)}`;
}

function tabGroup(X, g) {
  const invite = `${APP_URL}?g=${g.code}`;
  const me = meMember();
  const adminKey = S.adminKeys[g.code];
  return `<div class="top"><div><h1>Squad</h1><div class="sub">Invite, sync and settings</div></div></div>
  <section class="card"><h2>Invite people</h2>
    <p class="small muted">Send this link to the group chat. It works on any phone.</p>
    <div class="copybox"><code>${esc(invite)}</code><button class="btn sm" data-copy="${esc(invite)}">Copy</button></div>
    <div class="btn-row"><button class="btn" data-act="share-invite">${ICON.share} Share invite</button></div>
    <div id="qr" class="qr" aria-label="QR code for invite link"></div>
    <p class="small muted" style="text-align:center;margin:0">Or join code <b style="letter-spacing:.12em">${esc(g.code)}</b></p>
  </section>
  <section class="card"><h2>Your step sync</h2>
    <div class="row spread"><span class="small">${me.last_sync_at ? `Last synced <b>${ago(me.last_sync_at)}</b> via ${esc(me.last_source || "?")}` : "Not connected yet"}</span>${me.last_sync_at && me.last_source !== "manual" ? '<span class="pill ok">Auto-sync on</span>' : me.last_sync_at ? '<span class="pill">Manual</span>' : '<span class="pill warn">Not set up</span>'}</div>
    <button class="btn block ghost" style="margin-top:12px" data-act="open-setup">Setup guide (iPhone & Android)</button>
  </section>
  <section class="card"><h2>Group rules</h2>
    <p class="small"><b>Daily goal:</b> ${fmt(g.daily_goal)} steps<br><b>Weekly forfeit:</b> ${esc(g.forfeit || "none")}<br><b>Journey:</b> ${esc(g.challenge_name)} (${fmt(g.challenge_km)} km)<br><b>Teams:</b> ${g.teams.length ? g.teams.map(esc).join(", ") : "off"}</p>
    ${adminKey ? '<button class="btn block" data-act="open-admin">Admin settings</button>' : '<button class="btn sm ghost" data-act="admin-login">I\'m the admin</button>'}
  </section>
  <section class="card"><h2>This phone</h2>
    <p class="small muted">Keep this private link somewhere safe. It restores your account on a new phone.</p>
    <div class="btn-row"><button class="btn sm ghost" data-copy="${esc(APP_URL + "?me=" + S.token)}" data-label="Restore link copied">Copy restore link</button><button class="btn sm danger" data-act="leave">Sign out</button></div>
  </section>
  <p class="small muted" style="text-align:center">Step Squad · steps are only shared with this group</p>`;
}

function drawQR() {
  const el = $("#qr");
  if (!el || !window.QRCode) { if (el) el.hidden = true; return; }
  el.innerHTML = "";
  new window.QRCode(el, { text: `${APP_URL}?g=${S.board.group.code}`, width: 156, height: 156, correctLevel: window.QRCode.CorrectLevel.M });
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

function setupSheet() {
  const p = S.setupPlatform || S.me?.platform || detectPlatform();
  const g = S.board.group;
  const shortcutUrl = `${API}/log?t=${S.token}&steps=`;
  const hcUrl = `${API}/hc?t=${S.token}`;
  const ios = `
    ${g.shortcut_url ? `<div class="callout"><b>Quick way:</b> your admin made a ready-to-go Shortcut.
      <ol class="steps-list" style="margin-top:10px"><li>Copy your personal link:<div class="copybox"><code>${esc(shortcutUrl)}</code><button class="btn sm" data-copy="${esc(shortcutUrl)}">Copy</button></div></li>
      <li><a class="btn sm" href="${esc(g.shortcut_url)}" target="_blank" rel="noopener">Add the Shortcut</a> and paste the link when it asks.</li>
      <li>Then do steps 6 to 8 below to make it run on its own.</li></ol></div>
      <h3>Or build it yourself</h3>` : ""}
    <ol class="steps-list">
      <li>Open the <b>Shortcuts</b> app, tap <b>+</b>, and name it <b>Log Steps</b>.</li>
      <li>Add the action <b>Find Health Samples</b>. Set <b>Type</b> to <b>Steps</b>, add the filter <b>Start Date · is today</b>, and set <b>Group By</b> to <b>Day</b>. <span class="muted small">(Grouping by day gives the same number as the Health app, with no double-counting from an Apple Watch.)</span></li>
      <li>Add <b>Calculate Statistics</b> and set it to <b>Sum</b> of Health Samples.</li>
      <li>Add <b>Get Contents of URL</b>. Paste this as the URL:
        <div class="copybox"><code>${esc(shortcutUrl)}</code><button class="btn sm" data-copy="${esc(shortcutUrl)}">Copy</button></div>
        Then tap right at the end of it and insert the <b>Statistics</b> variable, so it ends in <code>steps=Statistics</code>.</li>
      <li>Tap ▶︎ to test. Allow Health access when asked. You should see "✅ … steps logged".</li>
      <li>Go to the <b>Automation</b> tab, tap <b>+</b> then <b>Time of Day</b>.</li>
      <li>Pick <b>23:45</b>, <b>Daily</b>, and choose <b>Run Immediately</b> (turn off "Notify When Run" if you like).</li>
      <li>Choose your <b>Log Steps</b> shortcut. Done. Add more times (12:00, 18:00) for a live leaderboard during the day.</li>
    </ol>
    <p class="small muted">The link is personal. Don't share it, it can post steps as you.</p>`;
  const android = `
    <ol class="steps-list">
      <li>Make sure your steps reach <b>Health Connect</b>. Samsung Health, Google Fit and Fitbit all sync to it (Settings → Health Connect on Android 14+, or the Health Connect app).</li>
      <li>Install <a href="https://play.google.com/store/apps/details?id=com.hcwebhook.app" target="_blank" rel="noopener"><b>HC Webhook</b></a> from the Play Store (free, open source).</li>
      <li>Open it, tap <b>Grant permissions</b> and allow <b>Steps</b>. In data types, turn on <b>Steps</b> only and set its resolution to <b>Daily</b>. <span class="muted small">(Daily uses Health Connect's own total, so phone + watch aren't counted twice.)</span></li>
      <li>Under <b>Webhooks</b>, add this URL:
        <div class="copybox"><code>${esc(hcUrl)}</code><button class="btn sm" data-copy="${esc(hcUrl)}">Copy</button></div></li>
      <li>Set sync to <b>Interval</b> (every 60 min), or <b>Scheduled</b> at 12:00, 18:00 and 23:45.</li>
      <li>Tap <b>Sync now</b>, then press <b>Check connection</b> below.</li>
    </ol>
    <p class="small muted">If your phone kills background apps (some Xiaomi, OnePlus, Huawei), set HC Webhook's battery usage to <b>Unrestricted</b>.</p>`;
  const other = `<p>No problem. Use the <b>Log</b> tab to type your steps in. One entry per day, and you can fix the last 7 days.</p>`;
  openSheet(`<div class="row spread" style="margin-bottom:8px"><h2 style="margin:0;font-size:22px">Connect your steps</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    <div class="toggle" style="margin-bottom:14px">${[["ios", "iPhone"], ["android", "Android"], ["other", "Manual"]].map(([v, l]) => `<button data-setup="${v}" aria-pressed="${v === p}">${l}</button>`).join("")}</div>
    <section class="card">${p === "ios" ? ios : p === "android" ? android : other}</section>
    <div class="btn-row"><button class="btn" data-act="check-sync">Check connection</button></div>
    <p id="sync-status" class="small muted" style="text-align:center"></p>`);
}

function profileSheet(id) {
  const m = S.idx.members.find((x) => x.id === id);
  if (!m) return;
  openSheet(`<div class="row spread" style="margin-bottom:4px"><span></span><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>${profileBody(S.idx, m)}`);
}

function editProfileSheet() {
  const m = meMember();
  const g = S.board.group;
  S.edit = { emoji: m.emoji, color: m.color };
  openSheet(`<div class="row spread" style="margin-bottom:8px"><h2 style="margin:0;font-size:22px">Edit profile</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
  <form class="card" data-form="profile">
    <label class="field"><span>Name</span><input name="name" maxlength="24" value="${esc(m.name)}" required></label>
    <label class="field"><span>Avatar</span></label>
    <div class="picker" style="margin-bottom:12px">${EMOJIS.map((e) => `<button type="button" data-edit-emoji="${e}" aria-pressed="${e === m.emoji}">${e}</button>`).join("")}</div>
    <div class="swatches" style="margin-bottom:16px">${COLORS.map((c) => `<button type="button" data-edit-color="${c}" style="background:${c}" aria-pressed="${c === m.color}" aria-label="Colour ${c}"></button>`).join("")}</div>
    ${g.teams.length ? `<label class="field"><span>Team</span><select name="team"><option value="">No team</option>${g.teams.map((t) => `<option ${t === m.team ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>` : ""}
    <label class="field"><span>Personal daily goal (blank = group goal of ${fmt(g.daily_goal)})</span><input name="goal" type="number" inputmode="numeric" min="1000" max="50000" step="500" value="${S.me.goal || ""}"></label>
    <button class="btn block">Save</button>
  </form>`);
}

function adminSheet(members) {
  const g = S.board.group;
  const journeyOpts = JOURNEYS.map(([n, k]) => `<option value="${k}" data-name="${esc(n)}" ${Number(g.challenge_km) === k && g.challenge_name === n ? "selected" : ""}>${esc(n)} (${fmt(k)} km)</option>`).join("");
  openSheet(`<div class="row spread" style="margin-bottom:8px"><h2 style="margin:0;font-size:22px">Admin</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
  <form class="card" data-form="admin">
    <label class="field"><span>Group name</span><input name="name" maxlength="40" value="${esc(g.name)}"></label>
    <label class="field"><span>Daily goal</span><input name="daily_goal" type="number" inputmode="numeric" min="1000" max="50000" step="500" value="${g.daily_goal}"></label>
    <label class="field"><span>Weekly forfeit for last place</span><input name="forfeit" maxlength="120" value="${esc(g.forfeit)}"></label>
    <label class="field"><span>Group journey</span><select name="journey"><option value="">Custom…</option>${journeyOpts}</select></label>
    <div class="row"><label class="field grow"><span>Journey name</span><input name="challenge_name" maxlength="60" value="${esc(g.challenge_name)}"></label><label class="field" style="width:110px"><span>km</span><input name="challenge_km" type="number" inputmode="numeric" min="1" value="${g.challenge_km}"></label></div>
    <label class="field"><span>Teams (comma separated, blank for none)</span><input name="teams" maxlength="200" value="${esc(g.teams.join(", "))}" placeholder="Hares, Tortoises"></label>
    <label class="field"><span>Shared iPhone Shortcut link (optional)</span><input name="shortcut_url" type="url" value="${esc(g.shortcut_url || "")}" placeholder="https://www.icloud.com/shortcuts/…"></label>
    <details class="small muted" style="margin:-4px 0 14px"><summary>How to make a one-tap Shortcut for the group</summary>
      <p style="margin-top:8px">Build the Shortcut from the setup guide on your iPhone, but put your link in a <b>Text</b> action and use that Text as the URL. In the Shortcut's settings (ⓘ) → <b>Set Up</b>, add an <b>Import Question</b> on the Text, "Paste your sync link from Step Squad". Remove your link from the Text, then <b>Share → Copy iCloud Link</b> and paste it here. Everyone else just taps it and pastes their own link.</p></details>
    <button class="btn block">Save settings</button>
  </form>
  <section class="card"><h2>Members</h2>
    <p class="small muted">Copy someone's restore link if they lost their phone. Removing someone deletes their steps.</p>
    ${members.map((m) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(m.emoji)}</span><div class="grow"><b>${esc(m.name)}</b><div class="small muted">${m.last_sync_at ? "synced " + ago(m.last_sync_at) : "never synced"}</div></div>
      <button class="btn sm ghost" data-copy="${esc(APP_URL + "?me=" + m.token)}" data-label="Restore link copied">Link</button>
      <button class="btn sm danger" data-remove="${m.id}" data-name="${esc(m.name)}">✕</button></div>`).join("")}
  </section>
  <p class="small muted" style="text-align:center">Admin key: <b>${esc(S.adminKeys[g.code])}</b> (keep it safe)</p>`);
}

// ---------- data flow ----------
async function loadBoard(silent) {
  try {
    S.board = await call("board", null, `?code=${encodeURIComponent(S.code)}`);
    S.idx = buildIndex(S.board);
    const fresh = S.board.members.find((m) => m.id === S.me?.id);
    if (!fresh) { signOut("You're no longer in this group"); return; }
    S.me = { ...S.me, ...fresh };
    store.set("me", S.me);
    S.view = "main";
    if ($("#sheet").hidden) render();
  } catch (e) {
    if (!silent) { toast(e.message); if (!S.board) { S.view = "welcome"; render(); } }
  }
}

function signOut(msg) {
  ["code", "token", "me"].forEach(store.del);
  S.code = S.token = S.me = S.board = S.idx = null;
  S.view = "welcome";
  history.replaceState(null, "", APP_URL);
  closeSheet();
  render();
  if (msg) toast(msg);
}

function saveSession(member, code) {
  S.token = member.token; S.code = code; S.me = member;
  store.set("token", S.token); store.set("code", code); store.set("me", member);
  // Keep the restore link in the address bar so "Add to Home Screen" opens straight into this account
  // (iOS home-screen apps don't share storage with Safari).
  history.replaceState(null, "", `${APP_URL}?me=${member.token}`);
}

async function startJoin(code) {
  code = code.trim().toUpperCase();
  try {
    const b = await call("board", null, `?code=${encodeURIComponent(code)}`);
    S.joinCode = code;
    S.joinGroup = { ...b.group, members: b.members.length };
    S.view = "join";
    render();
  } catch (e) { toast(e.message); }
}

function standingsText() {
  const X = S.idx, g = S.board.group;
  const [from, to] = periodRange(S.period, X.t);
  const label = { today: "Today", week: "This week", month: "This month", all: "All time" }[S.period];
  const rows = X.members.map((m) => ({ m, v: X.sum(m.id, from, to) })).sort((a, b) => b.v - a.v);
  const medal = ["🥇", "🥈", "🥉"];
  return `👟 ${g.name}: ${label}\n` + rows.map((r, i) => `${medal[i] || `${i + 1}.`} ${r.m.name} ${fmt(r.v)}${X.streak(r.m) >= 3 ? ` 🔥${X.streak(r.m)}` : ""}`).join("\n") +
    (rows.length > 1 ? `\n😬 Forfeit watch: ${rows[rows.length - 1].m.name}` : "");
}

// ---------- events ----------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-profile], a");
  if (!t) {
    if (e.target.id === "sheet") closeSheet();
    return;
  }
  const d = t.dataset;
  if (d.copy) return copy(d.copy, d.label || "Copied");
  if (d.tab) { S.tab = d.tab; store.set("tab", S.tab); render(); scrollTo(0, 0); return; }
  if (d.period) { S.period = d.period; store.set("period", S.period); render(); return; }
  if (d.profile) return profileSheet(d.profile);
  if (d.emoji) { S.draft.emoji = d.emoji; S.draft.name = $("[name=name]")?.value; render(); return; }
  if (d.color) { S.draft.color = d.color; S.draft.name = $("[name=name]")?.value; render(); return; }
  if (d.platform) { S.draft.platform = d.platform; S.draft.name = $("[name=name]")?.value; render(); return; }
  if (d.setup) { S.setupPlatform = d.setup; setupSheet(); return; }
  if (d.editEmoji) { S.edit.emoji = d.editEmoji; t.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === t)); return; }
  if (d.editColor) { S.edit.color = d.editColor; t.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === t)); return; }
  if (d.remove) {
    if (!confirm(`Remove ${d.name} and delete their steps?`)) return;
    try {
      await call("admin_remove", { code: S.code, admin_key: S.adminKeys[S.code], member_id: d.remove });
      toast(`${d.name} removed`);
      const r = await call("admin_members", { code: S.code, admin_key: S.adminKeys[S.code] });
      adminSheet(r.members);
      loadBoard(true);
    } catch (err) { toast(err.message); }
    return;
  }

  switch (d.act) {
    case "go-create": S.view = "create"; render(); break;
    case "go-welcome": S.view = "welcome"; history.replaceState(null, "", APP_URL); render(); break;
    case "refresh": t.disabled = true; await loadBoard(); toast("Updated"); break;
    case "open-setup": S.setupPlatform = null; setupSheet(); break;
    case "close-sheet": closeSheet(); render(); break;
    case "hide-install": store.set("hideInstall", true); render(); break;
    case "install": if (installPrompt) { installPrompt.prompt(); installPrompt = null; render(); } break;
    case "share-invite": share(`Join ${S.board.group.name} on Step Squad 👟 (code ${S.board.group.code})`, `${APP_URL}?g=${S.board.group.code}`); break;
    case "share-standings": share(standingsText()); break;
    case "edit-profile": editProfileSheet(); break;
    case "leave": if (confirm("Sign out on this phone? Copy your restore link first if you want to come back.")) signOut(); break;
    case "check-sync": {
      const out = $("#sync-status");
      out.textContent = "Checking…";
      await loadBoard(true);
      const m = meMember();
      out.innerHTML = m?.last_sync_at
        ? `✅ Last sync <b>${ago(m.last_sync_at)}</b> via ${esc(m.last_source)}. Today: <b>${fmt(S.idx.get(m.id, S.idx.t))}</b> steps.`
        : "Nothing received yet. Run the Shortcut or tap Sync now, then check again.";
      break;
    }
    case "admin-login": {
      const key = prompt("Admin key for this group:");
      if (!key) break;
      try {
        const r = await call("admin_members", { code: S.code, admin_key: key.trim() });
        S.adminKeys[S.code] = key.trim(); store.set("adminKeys", S.adminKeys);
        render(); adminSheet(r.members);
      } catch (err) { toast(err.message); }
      break;
    }
    case "open-admin": {
      try {
        const r = await call("admin_members", { code: S.code, admin_key: S.adminKeys[S.code] });
        adminSheet(r.members);
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
      await startJoin(f.code);
    } else if (kind === "create") {
      const r = await call("create", f);
      S.adminKeys[r.code] = r.admin_key; store.set("adminKeys", S.adminKeys);
      toast("Group created. Now add yourself.");
      await startJoin(r.code);
    } else if (kind === "join") {
      const r = await call("join", {
        code: S.joinCode, name: f.name, team: f.team || null, emoji: S.draft.emoji, color: S.draft.color,
        platform: S.draft.platform, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      saveSession(r.member, r.code);
      S.tab = "board";
      await loadBoard();
      setupSheet();
    } else if (kind === "log") {
      const r = await call("log", { token: S.token, steps: f.steps, date: f.date, source: "manual" });
      toast(r.message);
      S.logDay = null;
      S.tab = "board"; store.set("tab", "board");
      await loadBoard();
    } else if (kind === "profile") {
      const r = await call("update_me", { token: S.token, name: f.name, team: f.team ?? null, goal: f.goal || null, emoji: S.edit.emoji, color: S.edit.color });
      S.me = { ...S.me, ...r.member };
      closeSheet();
      await loadBoard();
      toast("Saved");
    } else if (kind === "admin") {
      const settings = { ...f, teams: f.teams.split(",").map((s) => s.trim()).filter(Boolean) };
      delete settings.journey;
      await call("admin", { code: S.code, admin_key: S.adminKeys[S.code], settings });
      closeSheet();
      await loadBoard();
      toast("Settings saved");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn && document.contains(btn)) btn.disabled = false;
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) { closeSheet(); render(); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.view === "main") loadBoard(true); });
setInterval(() => { if (!document.hidden && S.view === "main" && $("#sheet").hidden) loadBoard(true); }, 60000);

// ---------- boot ----------
(async function boot() {
  const params = new URLSearchParams(location.search);
  const restore = params.get("me");
  const invite = params.get("g");
  if (restore && restore !== S.token) {
    try {
      const r = await call("me", { token: restore });
      saveSession(r.member, r.code);
    } catch { toast("That restore link doesn't work any more"); history.replaceState(null, "", APP_URL); }
  }
  if (invite && (!S.token || invite.toUpperCase() !== S.code)) {
    if (S.token && !confirm("You're already in a group on this phone. Join a different one?")) {
      history.replaceState(null, "", `${APP_URL}?me=${S.token}`);
    } else {
      render();
      return startJoin(invite);
    }
  }
  if (S.token && S.code) {
    if (!params.get("me")) history.replaceState(null, "", `${APP_URL}?me=${S.token}`);
    render();
    await loadBoard();
  } else {
    S.view = "welcome";
    render();
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
