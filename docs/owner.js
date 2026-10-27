// Effort owner page: read and edit any player's profile, steps, scroll minutes and hunts.
// Everything goes through POST /owner with the owner key from app_config.
(() => {
const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const APP_URL = "https://kirish-vijay.github.io/effort/";
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("en-GB");

const store = {
  get(k) { try { return localStorage.getItem("ef_" + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("ef_" + k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem("ef_" + k); } catch { /* ignore */ } },
};

const S = {
  key: store.get("owner_key") || "",
  view: "gate",          // gate | list | player
  list: null,            // {players, groups, memberships}
  q: "", group: "all",
  player: null,          // {player, groups, steps, scroll, hunts}
  days: 35,             // rows shown
  fetchDays: 0,          // how far back to load, when a picked date is older than the rows shown
  extraDays: [],         // dates added by hand that have no data yet
  busy: false,
};

async function owner(op, extra = {}) {
  const res = await fetch(`${API}/owner`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: S.key, op, ...extra }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "Bad response" }));
  if (res.status === 403) { S.key = ""; store.del("owner_key"); S.view = "gate"; render(); }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

function openSheet(html) {
  const sh = $("#sheet");
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

// ---------- dates ----------
function localDate(d, tz) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const prettyDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
function ago(ts) {
  if (!ts) return "never";
  const h = (Date.now() - Date.parse(ts)) / 3600000;
  if (h < 1) return "just now";
  return h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
}

// ---------- views ----------
function render() {
  const app = $("#app");
  if (S.view === "gate") app.innerHTML = viewGate();
  else if (S.view === "list") app.innerHTML = viewList();
  else app.innerHTML = viewPlayer();
}

function viewGate() {
  return `<div class="top"><div><h1>Effort owner</h1><div class="sub">Edit any player's data.</div></div></div>
    <form class="card" data-form="gate">
      <label class="field"><span>Owner key</span><input name="key" type="password" autocomplete="current-password" required minlength="16" placeholder="32 characters"></label>
      <p class="small muted">It's in Supabase → Table Editor → <b>app_config</b> → <b>owner_key</b>. Saved on this device until you sign out.</p>
      <button class="btn block" ${S.busy ? "disabled" : ""}>Open</button>
    </form>`;
}

function groupsOf(pid) {
  const L = S.list;
  return L.memberships.filter((m) => m.player_id === pid).map((m) => L.groups.find((g) => g.id === m.group_id)).filter(Boolean);
}

function viewList() {
  const L = S.list;
  if (!L) return `<div class="empty">Loading…</div>`;
  const q = S.q.trim().toLowerCase();
  const rows = L.players.filter((p) => {
    const gs = groupsOf(p.id);
    if (S.group === "none" && gs.length) return false;
    if (S.group !== "all" && S.group !== "none" && !gs.some((g) => g.id === S.group)) return false;
    return !q || p.name.toLowerCase().includes(q) || gs.some((g) => g.name.toLowerCase().includes(q) || g.code.toLowerCase() === q);
  });
  const chip = (id, label) => `<button data-act="group" data-id="${id}" aria-pressed="${S.group === id}">${esc(label)}</button>`;
  return `<div class="top"><div><h1>Players</h1><div class="sub">${L.players.length} players · ${L.groups.length} groups</div></div>
      <button class="btn sm ghost" data-act="signout">Sign out</button></div>
    <input type="search" data-input="q" value="${esc(S.q)}" placeholder="Search name, group or code" style="margin-bottom:12px" aria-label="Search">
    <div class="chips">${chip("all", "All")}${L.groups.map((g) => chip(g.id, `${g.name} · ${g.code}`)).join("")}${chip("none", "No group")}</div>
    ${squadCard(L.groups.find((g) => g.id === S.group))}
    <div class="card list">${rows.length ? rows.map((p) => {
      const gs = groupsOf(p.id);
      return `<button class="list-row" data-act="open" data-id="${p.id}">
        <span class="e">${esc(p.emoji)}</span>
        <span class="grow"><b>${esc(p.name)}</b><span class="small muted" style="display:block">${gs.length ? gs.map((g) => esc(g.name)).join(", ") : "No group"} · steps ${ago(p.steps_synced_at)} · scroll ${ago(p.scroll_synced_at)}</span></span>
        <span aria-hidden="true">›</span></button>`;
    }).join("") : `<div class="empty"><span class="e">🫥</span>Nobody matches.</div>`}</div>`;
}

// A squad's game state, and a switch that opens the 7pm Taxman and the Sunday raid right now for
// that squad, for testing. It counts for real: it uses up today's Taxman fight for everyone in it.
function squadCard(g) {
  if (!g) return "";
  const open = g.test_until && Date.parse(g.test_until) > Date.now();
  return `<div class="card" style="margin-bottom:12px">
    <div class="row spread"><b>${esc(g.name)} · ${esc(g.code)}</b><span class="small muted">Boss ${g.tier ?? 1}</span></div>
    <p class="small muted" style="margin:6px 0 10px">${open ? `Test window open until ${new Date(g.test_until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` : "Open the Taxman and the raid now, to try them with friends."} It counts for real: it uses up today's Taxman fight for everyone in the squad, and the raid pays out.</p>
    <div class="btn-row"><button class="btn sm" data-act="test-window" data-id="${g.id}" data-min="15">${open ? "Reset to 15 min" : "Open for 15 min"}</button>${open ? `<button class="btn sm ghost" data-act="test-window" data-id="${g.id}" data-min="0">Close it</button>` : ""}</div>
  </div>`;
}

function dayMap() {
  const P = S.player, m = new Map();
  const get = (d) => m.get(d) ?? (m.set(d, { d }), m.get(d));
  P.steps.forEach((r) => (get(r.d).steps = r));
  P.scroll.forEach((r) => (get(r.d).scroll = r));
  P.hunts.forEach((r) => (get(r.d).hunt = r));
  return m;
}

function shownDays() {
  const P = S.player, m = dayMap();
  const today = localDate(new Date(), P.player.tz);
  const set = new Set(S.extraDays);
  for (let i = 0; i < S.days; i++) set.add(addDays(today, -i));
  for (const d of m.keys()) if (d >= addDays(today, -S.days + 1)) set.add(d);
  return [...set].sort().reverse().map((d) => m.get(d) ?? { d });
}

function scrollCell(sc) {
  if (!sc) return `<span class="v none">–</span>`;
  if (sc.m != null) return `<span class="v">${sc.m} min<span class="src">set</span></span>`;
  if (sc.am != null) return `<span class="v">${sc.am} min<span class="src">auto</span></span>`;
  if (sc.o > 0) return `<span class="v">${sc.o} opens<span class="src">auto</span></span>`;
  return `<span class="v none">–</span>`;
}

function viewPlayer() {
  const P = S.player;
  if (!P) return `<div class="empty">Loading…</div>`;
  const p = P.player;
  const link = `${APP_URL}?me=${encodeURIComponent(p.token)}`;
  const tzs = (Intl.supportedValuesOf?.("timeZone") ?? [p.tz]);
  if (!tzs.includes(p.tz)) tzs.unshift(p.tz);
  return `<div class="top"><button class="icon-btn" data-act="back" aria-label="Back">‹</button>
      <div class="grow"><h1>${esc(p.emoji)} ${esc(p.name)}</h1><div class="sub">${P.groups.length ? P.groups.map((g) => `${esc(g.name)} · ${esc(g.code)}`).join(", ") : "No group"} · joined ${prettyDay(p.created_at.slice(0, 10))}</div></div></div>

    <div class="card list">
      <div class="day-row head"><span>Day</span><span>Steps</span><span>Scroll</span><span>Hunt</span></div>
      ${shownDays().map((r) => `<button class="day-row" data-act="day" data-day="${r.d}">
        <span class="d">${prettyDay(r.d)}</span>
        ${r.steps ? `<span class="v">${fmt(r.steps.s)}<span class="src">${esc(r.steps.src)}</span></span>` : `<span class="v none">–</span>`}
        ${scrollCell(r.scroll)}
        ${r.hunt ? `<span class="v">${fmt(r.hunt.score)}<span class="src">wave ${r.hunt.wave}</span></span>` : `<span class="v none">–</span>`}
      </button>`).join("")}
    </div>
    <div class="btn-row" style="margin-bottom:16px">
      <button class="btn sm ghost" data-act="more">Show ${S.days < 120 ? "more days" : "a year"}</button>
      <button class="btn sm ghost" data-act="add-day">Pick a date</button>
    </div>

    <form class="card" data-form="profile">
      <h2>Profile</h2>
      <div class="grid2">
        <label class="field"><span>Name</span><input name="name" maxlength="24" value="${esc(p.name)}" required></label>
        <label class="field"><span>Emoji</span><input name="emoji" maxlength="8" value="${esc(p.emoji)}"></label>
        <label class="field"><span>Daily goal (blank = group's)</span><input name="daily_goal" type="number" min="1000" max="50000" step="500" value="${p.daily_goal ?? ""}"></label>
        <label class="field"><span>Phone</span><select name="platform">${["ios", "android", "other"].map((x) => `<option ${x === p.platform ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span>Time zone</span><select name="tz">${tzs.map((z) => `<option ${z === p.tz ? "selected" : ""}>${esc(z)}</option>`).join("")}</select></label>
      <label class="row spread" style="margin-bottom:14px"><span><b>In the public league</b></span><input class="switch" type="checkbox" name="is_public" ${p.is_public ? "checked" : ""}></label>
      <button class="btn block">Save profile</button>
    </form>

    <div class="card">
      <h2>Their login link</h2>
      <p class="small muted">Opens the app as ${esc(p.name)} on any phone. Anyone with it can play as them, so only send it to them.</p>
      <div class="btn-row"><button class="btn sm ghost" data-act="copy-link" data-link="${esc(link)}">Copy link</button></div>
    </div>

    <div class="card">
      <h2>Delete player</h2>
      <p class="small muted">Removes ${esc(p.name)}, all their steps, scroll and hunts, and takes them out of every group. Can't be undone.</p>
      <button class="btn sm danger" data-act="delete-player">Delete ${esc(p.name)}</button>
    </div>`;
}

function daySheet(day) {
  const r = dayMap().get(day) ?? { d: day };
  const sc = r.scroll, h = r.hunt;
  const autoNote = sc && (sc.am != null || sc.o > 0)
    ? `Automation counted ${sc.am != null ? `${sc.am} min` : `${sc.o} opens`}. Blank = use that.`
    : "Blank = no scroll data (the game assumes 30 min on active days).";
  openSheet(`${sheetHead(prettyDay(day))}
    <form data-form="day" data-day="${day}">
      <label class="field"><span>Steps</span><input name="steps" type="number" min="0" max="200000" inputmode="numeric" value="${r.steps ? r.steps.s : ""}" placeholder="No steps"></label>
      <p class="hint">${r.steps ? `From ${esc(r.steps.src)}. ` : ""}Blank removes the day. Saved edits are marked "admin" and count in full in the league.</p>
      <label class="field"><span>Scroll minutes</span><input name="minutes" type="number" min="0" max="1440" inputmode="numeric" value="${sc?.m ?? ""}" placeholder="Not set"></label>
      <p class="hint">${autoNote}</p>
      <div class="sec-title">Hunt</div>
      <div class="grid2">
        <label class="field"><span>Score</span><input name="score" type="number" min="0" inputmode="numeric" value="${h ? h.score : ""}" placeholder="No hunt"></label>
        <label class="field"><span>Boss damage</span><input name="boss_dmg" type="number" min="0" inputmode="numeric" value="${h ? h.dmg : ""}" placeholder="score ÷ 20"></label>
        <label class="field"><span>Kills</span><input name="kills" type="number" min="0" inputmode="numeric" value="${h ? h.kills : ""}"></label>
        <label class="field"><span>Wave</span><input name="wave" type="number" min="0" inputmode="numeric" value="${h ? h.wave : ""}"></label>
        <label class="field"><span>Seconds played</span><input name="seconds" type="number" min="0" max="3600" inputmode="numeric" value="${h ? h.s : ""}"></label>
        <label class="row" style="margin:24px 0 12px"><input class="switch" type="checkbox" name="survived" ${h?.surv ? "checked" : ""}><span>Survived</span></label>
      </div>
      <p class="hint">Blank score removes the hunt. A hunt with 0 seconds counts as started but not finished, so the player can still finish it today.</p>
      <button class="btn block">Save day</button>
    </form>`);
}

function addDaySheet() {
  const today = localDate(new Date(), S.player.player.tz);
  openSheet(`${sheetHead("Pick a date")}
    <form data-form="add-day">
      <label class="field"><span>Date</span><input name="day" type="date" min="2020-01-01" max="${addDays(today, 1)}" value="${today}" required></label>
      <button class="btn block">Edit this day</button>
    </form>`);
}

// ---------- loading ----------
async function loadList() {
  S.list = (await owner("list"));
  S.view = "list";
  render();
}

async function loadPlayer(id, keepScroll = false) {
  const y = window.scrollY;
  const data = await owner("player", { id, days: Math.max(S.days + 7, S.fetchDays, 120) });
  S.player = data;
  S.view = "player";
  render();
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

// ---------- events ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) { if (e.target.id === "sheet") closeSheet(); return; }
  const act = el.dataset.act;
  try {
    if (act === "close-sheet") closeSheet();
    else if (act === "signout") { store.del("owner_key"); S.key = ""; S.list = null; S.view = "gate"; render(); }
    else if (act === "group") { S.group = el.dataset.id; render(); }
    else if (act === "open") { S.days = 35; S.fetchDays = 0; S.extraDays = []; S.player = null; S.view = "player"; render(); await loadPlayer(el.dataset.id); }
    else if (act === "back") { S.view = "list"; render(); await loadList(); }
    else if (act === "more") { S.days = S.days < 120 ? 120 : 365; await loadPlayer(S.player.player.id, true); }
    else if (act === "add-day") addDaySheet();
    else if (act === "test-window") {
      const min = Number(el.dataset.min);
      if (min && !confirm("Open the Taxman and the raid for this squad now? It uses up today's Taxman fight for everyone in it.")) return;
      await owner("test_window", { id: el.dataset.id, minutes: min });
      toast(min ? "Open for 15 minutes" : "Closed");
      await loadList();
    }
    else if (act === "day") daySheet(el.dataset.day);
    else if (act === "copy-link") {
      try { await navigator.clipboard.writeText(el.dataset.link); toast("Link copied"); }
      catch { prompt("Copy this link", el.dataset.link); }
    } else if (act === "delete-player") {
      const p = S.player.player;
      const typed = prompt(`Type ${p.name} to delete them for good.`);
      if (typed === null) return;
      if (typed.trim() !== p.name) return toast("Name didn't match. Nothing deleted.");
      await owner("delete_player", { id: p.id });
      toast(`${p.name} deleted`);
      S.player = null;
      await loadList();
    }
  } catch (err) { toast(err.message); }
});

document.addEventListener("input", (e) => {
  if (e.target.dataset.input === "q") {
    S.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const box = $('[data-input="q"]');
    box.focus(); box.setSelectionRange(pos, pos);
  }
});

const val = (f, n) => f.elements[n].value.trim();

document.addEventListener("submit", async (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const btn = f.querySelector("button:not([type=button]):last-of-type");
  if (btn) btn.disabled = true;
  try {
    const kind = f.dataset.form;
    if (kind === "gate") {
      S.key = val(f, "key");
      S.busy = true;
      try { await loadList(); store.set("owner_key", S.key); }
      finally { S.busy = false; }
    } else if (kind === "profile") {
      const id = S.player.player.id;
      await owner("save_player", {
        id, name: val(f, "name"), emoji: val(f, "emoji"), daily_goal: val(f, "daily_goal") || null,
        platform: val(f, "platform"), tz: val(f, "tz"), is_public: f.elements.is_public.checked,
      });
      toast("Profile saved");
      await loadPlayer(id, true);
    } else if (kind === "add-day") {
      const day = val(f, "day");
      if (!S.extraDays.includes(day)) S.extraDays.push(day);
      closeSheet();
      if (!dayMap().has(day)) {
        // Older than what's loaded: fetch far enough back to show it.
        const back = Math.ceil((Date.now() - Date.parse(day)) / 86400000) + 2;
        if (back > 120) { S.fetchDays = Math.min(730, back); await loadPlayer(S.player.player.id, true); }
        else render();
      }
      daySheet(day);
      return;
    } else if (kind === "day") {
      const id = S.player.player.id, day = f.dataset.day;
      const r = dayMap().get(day) ?? {};
      const steps = val(f, "steps"), minutes = val(f, "minutes"), score = val(f, "score");
      const jobs = [];
      if (steps !== String(r.steps?.s ?? "")) jobs.push(owner("set_steps", { id, day, steps: steps === "" ? null : steps }));
      if (minutes !== String(r.scroll?.m ?? "")) jobs.push(owner("set_scroll", { id, day, minutes: minutes === "" ? null : minutes }));
      const h = r.hunt;
      const huntNow = { score, kills: val(f, "kills"), wave: val(f, "wave"), seconds: val(f, "seconds"), boss_dmg: val(f, "boss_dmg"), survived: f.elements.survived.checked };
      const huntWas = h ? { score: String(h.score), kills: String(h.kills), wave: String(h.wave), seconds: String(h.s), boss_dmg: String(h.dmg), survived: !!h.surv } : null;
      if (score === "" && h) jobs.push(owner("set_hunt", { id, day, delete: true }));
      else if (score !== "" && JSON.stringify(huntNow) !== JSON.stringify(huntWas)) jobs.push(owner("set_hunt", { id, day, ...huntNow }));
      if (!jobs.length) { closeSheet(); return toast("Nothing changed"); }
      await Promise.all(jobs);
      closeSheet();
      toast(`${prettyDay(day)} saved`);
      await loadPlayer(id, true);
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn && btn.isConnected) btn.disabled = false;
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

// ---------- start ----------
if (S.key) { S.view = "list"; render(); loadList().catch((err) => { toast(err.message); S.view = "gate"; render(); }); }
else render();
})();
