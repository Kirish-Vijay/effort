// Effort: the live game. Everything that counts (wallet, fights, raids, gear) goes through the server;
// the rules come from game.js, the same file the server runs, so the numbers on screen match the payout.
// The Sunday raid is shared live: one squad member's phone runs the fight and streams it to the others
// over Supabase Realtime; if that phone drops out, the next one picks it up from the last snapshot.
(() => {
"use strict";
const API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort";
const SB_URL = "https://nfsogyreyownlchwdnff.supabase.co";
const SB_KEY = "sb_publishable_PUypet-MNmKBxmUIBpEbsw_ecCkuGhK";
const PUSH = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort-push";
const AUTH = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort-auth";
// On Android in a browser: the Effort app does steps, scrolling and the 6:45pm ping with a tap each.
function androidApp(t) {
  return `<p class="small" style="margin-top:0">The Effort app does it all: steps and scrolling with one tap each, and the 6:45pm ping.</p>
    <a class="btn gold block" href="${STEPS_APK}">${ic("phone")} 1. Get the Effort app</a>
    <p class="tiny faint" style="margin:6px 2px 12px">Free, under 1 MB. Open the download and tap <b>Install</b>. If Android asks, allow installs from your browser. If Play Protect warns you, tap <b>More details → Install anyway</b>: it's our own app, it just isn't on the Play Store.</p>
    <a class="btn green block" href="${stepsAppLink(t)}">${ic("arrowRight")} 2. Open Effort in the app</a>
    <p class="tiny faint" style="margin:6px 2px 0">Signs you in there. Then use the app instead of Chrome.</p>`;
}

// Effort, the Android app that reads steps from Health Connect (android/ in the repo).
// effort://connect?t=TOKEN opens it signed in; as a Chrome intent link it downloads the app instead
// if it isn't installed yet.
const STEPS_APK = "https://github.com/Kirish-Vijay/effort/releases/latest/download/effort-steps.apk";
const stepsAppLink = (token) => `intent://connect?t=${token}#Intent;scheme=effort;package=io.github.kirishvijay.effort;S.browser_fallback_url=${encodeURIComponent(STEPS_APK)};end`;
// Inside the Android app the game can ask for steps, usage access and reminders itself (android/MainActivity.kt).
const NATIVE = window.EffortAndroid || null;
const nativeStatus = () => { try { return JSON.parse(NATIVE.status()); } catch { return {}; } };
// Calls the Android app only if the installed version has that feature, so an older install never breaks.
const nat = (fn, ...args) => {
  if (typeof NATIVE?.[fn] !== "function") return false;
  try { NATIVE[fn](...args); return true; } catch { return false; }
};
// A newer Android app: each release is titled "Effort for Android 1.<build>", the same as the app's own version.
// Checked at most every 6 hours (GitHub allows 60 lookups an hour per phone).
const appBuild = (v) => Number(String(v || "").match(/\d+\.(\d+)/)?.[1] || 0);
async function checkAppUpdate() {
  const mine = appBuild(S.native?.version);
  if (!NATIVE || !mine) return;
  const cached = store.get("appLatest");
  let latest = cached && Date.now() - cached.at < 6 * 3600000 ? cached.build : null;
  if (latest == null) {
    try {
      const r = await fetch("https://api.github.com/repos/Kirish-Vijay/effort/releases/tags/steps-app");
      if (!r.ok) return;
      latest = appBuild((await r.json()).name);
      store.set("appLatest", { at: Date.now(), build: latest });
    } catch { return; }
  }
  const show = latest > mine && Date.now() - (store.get("appUpdateLater") || 0) > 86400000;
  if (show === !!S.appUpdate) return;
  S.appUpdate = show;
  if (S.view === "main" && $("#sheet").hidden) render();
}
const updateBanner = () => !S.appUpdate ? "" : `<section class="panel update">
    <div class="row"><span class="ic-badge">${ic("upgrade")}</span><div class="grow"><b class="disp">New version of the app</b><span class="small muted" style="display:block">Install it over this one. Your account and progress stay.</span></div></div>
    <div class="btn-row" style="margin-top:12px"><a class="btn gold sm" href="${STEPS_APK}">${ic("upgrade")} Update</a><button class="btn sm" data-act="app-update-later">Later</button></div>
  </section>`;
// An older app without the feature: bring back the Update banner and point at it.
const natOr = (fn, ...args) => {
  if (nat(fn, ...args)) return;
  closeSheet(); store.del("appUpdateLater"); store.del("appLatest");
  checkAppUpdate();
  scrollTo(0, 0);
  toast("This needs the newest Effort app. Tap Update at the top");
};
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");
const G = Game, I = EffortItems;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("en-GB");
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
// "4d 22h", "2h 14m", "3:12"
function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return mmss(s);
}
function ago(ts) {
  if (!ts) return "never";
  const mins = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
const PER_E = () => G.RULES.effortsPerEndeavour;

// ---------- art helpers ----------
const ic = (n) => { const s = window.Icons?.ui?.(n); return s ? s.replace("<svg", '<svg class="ic" aria-hidden="true"') : '<span class="ic" aria-hidden="true">•</span>'; };
const coin = (sz = 20) => window.Icons?.coin?.(sz) || `<i class="cdot coin" style="width:${sz}px;height:${sz}px"></i>`;
const gem = (sz = 20) => window.Icons?.gem?.(sz) || `<i class="cdot gem" style="width:${sz}px;height:${sz}px"></i>`;
const itemArt = (item) => window.Icons?.item?.(item, 64) || `<span>${item.e}</span>`;
const STAT_LOOK = { power: ["power", "#ff6a3d"], guard: ["guard", "#3a9cf0"], speed: ["speed", "#4fd67f"], brains: ["brains", "#a86bff"], luck: ["luck", "#ffc83d"] };
const ROW_ICON = { front: "shieldWall", mid: "bigSwing", back: "patchUp" };
const priceTag = (efforts) => `<span class="price">${gem(18)}${fmt(efforts / PER_E())}</span>`;
const effortTag = (n) => `${coin(18)}${fmt(n)}`;
const signedEfforts = (n) => `${n >= 0 ? "+" : "−"}${coin(16)}${fmt(Math.abs(n))}`;
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

// ---------- storage (private mode must not break the app) ----------
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
async function call(action, body, query = "") {
  const res = await fetch(`${API}/${action}${query}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({ ok: false, error: "Couldn't reach the server" }));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}
async function copy(text, label = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch { prompt("Copy this", text); }
}
async function share(text, url) {
  if (navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copy(url ? `${text}\n${url}` : text, "Copied: paste it in the group chat");
}

// ---------- state ----------
const S = {
  view: "boot", tab: store.get("tab") || "today", token: store.get("token"), D: null, skew: 0,
  answers: store.get("draftAnswers") || {}, qi: 0, platform: detectPlatform(), invite: null, retake: false,
  setupStep: "steps", setupPlatform: null, shopTab: "class", busy: false, push: "unknown",
  native: NATIVE ? nativeStatus() : null, sheetKind: null,
  signin: null, hasPassword: null,
};
// The app reports what's connected (and each sync); redraw whatever's showing, and pull new numbers after a sync.
window.onEffortNative = (st) => {
  const synced = st.syncedAt && st.syncedAt !== S.native?.syncedAt;
  S.native = st;
  if (!$("#sheet").hidden && S.sheetKind) setupSheet(S.sheetKind);
  else if (["main", "setup"].includes(S.view) && $("#sheet").hidden) render();
  if (synced && S.view === "main") refresh(true);
};
// The Android back button: close a sheet, step back through the quiz, or go back to Today; otherwise leave the app.
window.effortBack = () => {
  if (!$("#sheet").hidden) { closeSheet(); return true; }
  if (["tax", "raid"].includes(S.view)) return true;
  const back = $("[data-act=quiz-back]") || $("[data-act=signin-back]") || $("[data-act=back]");
  if (back) { back.click(); return true; }
  if (S.view === "main" && S.tab !== "today") { S.tab = "today"; render(); return true; }
  return false;
};
const V = { tax: null, raid: null, result: null };
// For poking at a live session from the browser console.
window.EffortDebug = { S, V };
const now = () => Date.now() + S.skew;

// ---------- data ----------
async function load() {
  const D = await call("game", { token: S.token });
  S.skew = D.now - Date.now();
  S.D = D;
  ANS[D.me.id] = answersOf(D.me);
  nat("setToken", S.token);
  for (const m of D.squad?.members || []) ANS[m.id] = answersOf(m);
  return D;
}
async function refresh(silent) {
  try { await load(); if (S.view === "main" && $("#sheet").hidden) render(); }
  catch (e) {
    if (/Unknown token/.test(e.message)) return signOut("That account doesn't exist any more");
    if (!silent) toast(e.message);
  }
}
function saveToken(token) {
  S.token = token; store.set("token", token);
  // Keeps the restore link in the address bar, so "Add to Home Screen" opens straight into this account
  // (iPhone home-screen apps don't share storage with Safari).
  history.replaceState(null, "", `${APP_URL}?me=${token}`);
}
function signOut(msg) {
  // This phone stops getting pings for the account it's leaving.
  if (S.token && "serviceWorker" in navigator) {
    const token = S.token;
    currentSub().then((sub) => sub && callPush("unsubscribe", { token, endpoint: sub.endpoint })).catch(() => {});
  }
  store.del("token"); store.del("pushSynced");
  nat("setToken", "");
  Object.assign(S, { token: null, D: null, view: "welcome" });
  history.replaceState(null, "", APP_URL);
  closeSheet(); render();
  if (msg) toast(msg);
}

// ---------- derived ----------
const ANS = {}; // player id -> walker answers (for portraits and the 3D team)
const answersOf = (p) => (p?.character && p.character.time ? p.character : Walker.fallbackAnswers(p?.id || "x"));
const me = () => S.D.me;
const myStats = () => G.stats(me().character || {});
const myClass = () => G.classOf(myStats());
const level = () => G.levelOf(S.D.xp);
const squad = () => S.D.squad;
const squadAvgToday = () => { const m = squad()?.members || []; return m.length > 1 ? m.reduce((s, x) => s + x.todaySteps, 0) / m.length : 0; };
const taxSetup = () => G.taxmanSetup({ steps: S.D.today.steps, scrollMin: S.D.today.scroll ?? S.D.today.noScrollMin, stats: myStats(), equipped: me().gear, inv: S.D.inv, level: level(), squadAvg: squadAvgToday() });
const weekRows = () => G.weekTable((squad()?.members || []).map((m) => ({ id: m.id, name: m.name, you: m.id === me().id, weekSteps: m.weekSteps, fresh: m.fresh })));
const ledgerFor = (kind, ref) => S.D.ledger.find((r) => r.kind === kind && r.ref === ref);
function taxState() {
  const w = S.D.windows.tax, f = S.D.fight, t = now();
  if (f?.finished_at) return "done";
  if (f && t < Date.parse(f.ends_at)) return "live";
  if (f) return "done";
  if (w.open && t < w.closes) return "open";
  if (t < w.opens) return "soon";
  return "missed";
}
function raidState() {
  const w = S.D.windows.raid;
  if (!squad()) return "nosquad";
  if (S.D.raid?.status === "done") return "done";
  if (w.open && now() < w.closes) return "open";
  return "soon";
}

// ---------- portraits ----------
const portraitImg = (kind, id, { w = 256, h = 256, frame = "full", cls = "" } = {}) =>
  `<img class="pimg ${cls}" data-portrait="${kind}:${id}" data-w="${w}" data-h="${h}" data-frame="${frame}" alt="" width="${w}" height="${h}">`;
function hydratePortraits() {
  if (!window.Arena3D?.portrait || !Arena3D.supported()) return;
  for (const img of document.querySelectorAll("img[data-portrait]:not([data-done])")) {
    img.dataset.done = "1";
    const [kind, id] = img.dataset.portrait.split(":");
    Arena3D.portrait(kind, id, kind === "walker" ? ANS[id] || S.answers : null, { w: +img.dataset.w, h: +img.dataset.h, frame: img.dataset.frame })
      .then((url) => { if (url) { img.src = url; img.classList.add("in"); img.closest(".has-fallback")?.classList.add("loaded"); } });
  }
}
window.addEventListener("arena3d-ready", hydratePortraits);
const head2d = (answers) => Walker.svg(answers, { crop: "head", mood: "fresh" });
const face = (id, size = 52) => `<div class="face has-fallback" style="width:${size}px;height:${size}px"><span class="fb">${head2d(ANS[id])}</span>${portraitImg("walker", id, { w: size * 2, h: size * 2, frame: "head" })}</div>`;

// ---------- notifications ----------
// A ping at 6:45pm, 15 minutes before the Taxman (and before the raid on Sunday). The server sends it;
// this phone just has to sign up. iPhones only allow it once Effort is on the Home Screen.
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
async function callPush(action, body) {
  const res = await fetch(`${PUSH}/${action}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({ ok: false, error: "Couldn't reach the server" }));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const swReady = () => navigator.serviceWorker.ready;
const currentSub = () => swReady().then((r) => r.pushManager.getSubscription()).catch(() => null);
// on | off | install (iPhone, not on the Home Screen yet) | denied | unsupported
async function pushState() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return detectPlatform() === "ios" && !isStandalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSub();
  return sub && Notification.permission === "granted" ? "on" : "off";
}
async function refreshPush() {
  const st = await pushState();
  if (st === S.push) return;
  S.push = st;
  if (["main", "setup"].includes(S.view) && $("#sheet").hidden) render();
}
const b64ToBytes = (b64) => { const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function enablePush() {
  const st = await pushState();
  if (st === "install") return toast("Add Effort to your Home Screen first, then open it from there");
  if (st === "unsupported") return toast("This browser can't do notifications. Use the calendar instead");
  if ((await Notification.requestPermission()) !== "granted") { S.push = await pushState(); render(); return toast("Notifications weren't allowed"); }
  try {
    const reg = await swReady();
    const { key } = await callPush("key");
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
    await callPush("subscribe", { token: S.token, sub: sub.toJSON() });
    store.set("pushSynced", S.D?.today.day || "");
    S.push = "on"; render(); FX.play("levelup");
    toast("You'll get a ping at 6:45pm");
  } catch (e) { toast(`Couldn't turn them on: ${e.message}`); }
}
async function disablePush() {
  const sub = await currentSub();
  if (sub) { callPush("unsubscribe", { token: S.token, endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  S.push = "off"; render(); toast("Notifications off");
}
// Once a day, remind the server this phone still wants them (it forgets phones that stop answering).
async function keepPushAlive() {
  if (!S.token || !("serviceWorker" in navigator) || !("PushManager" in window) || store.get("pushSynced") === S.D?.today.day) return;
  const sub = await currentSub();
  if (!sub || Notification.permission !== "granted") return;
  callPush("subscribe", { token: S.token, sub: sub.toJSON() }).then(() => store.set("pushSynced", S.D?.today.day || "")).catch(() => {});
}
function pushBlock() {
  if (NATIVE) return S.native?.reminders
    ? `<div class="row spread" style="flex-wrap:wrap;gap:8px"><span class="chip green">${ic("bell")} Pings on</span><span class="row" style="gap:6px"><button class="btn xs" data-act="native-test">Send a test</button><button class="btn xs" data-act="native-reminders-off">Turn off</button></span></div>`
    : `<button class="btn gold block" data-act="native-reminders-on">${ic("bell")} Ping me at 6:45pm</button>`;
  switch (S.push) {
    case "on": return `<div class="row spread" style="flex-wrap:wrap;gap:8px"><span class="chip green">${ic("bell")} Pings on</span><span class="row" style="gap:6px"><button class="btn xs" data-act="push-test">Send a test</button><button class="btn xs" data-act="push-off">Turn off</button></span></div>`;
    case "install": return `<div class="guide small">On iPhone, notifications only work from the Home Screen app: tap <b>Share</b> → <b>Add to Home Screen</b>, open Effort from there, then turn them on.</div>`;
    case "denied": return `<div class="guide small">Notifications are blocked for Effort. Allow them in your phone's settings (or the browser's site settings), then come back here.</div>`;
    case "unsupported": return `<p class="small muted" style="margin:0">This browser can't do notifications. Use the calendar below.</p>`;
    default: return `<button class="btn gold block" data-act="push-on">${ic("bell")} Ping me at 6:45pm</button>`;
  }
}

// ---------- shell ----------
function render() {
  const views = { boot: viewBoot, welcome: viewWelcome, signin: viewSignin, quiz: viewQuiz, reveal: viewReveal, squad: viewSquad, setup: viewSetup, main: viewMain, tax: renderTax, raid: renderRaid, result: renderResult };
  (views[S.view] || viewBoot)();
  hydratePortraits();
}
const viewBoot = () => { $("#app").innerHTML = `<div class="boot"><div class="logo ol">EFFORT</div><p class="muted">Lacing up…</p></div>`; };

function viewMain() {
  const D = S.D, p = G.levelProgress(D.xp), cls = myClass();
  const tabs = { today: tabToday, raid: tabRaid, shop: tabShop, me: tabMe };
  if (!tabs[S.tab]) S.tab = "today";
  $("#app").innerHTML = `
    <header class="header">
      <button class="avatar" data-tab="me" aria-label="Your profile">${face(me().id)}<span class="lvl" title="Level">${p.lvl}</span></button>
      <div class="who"><b>${esc(me().name)}</b><div class="cls">${esc(cls.name)} · <span class="faint">${fmt(p.into)}/${fmt(p.need)} XP</span></div><div class="xp"><i style="width:${p.pct * 100}%"></i></div></div>
      ${walletHtml()}
    </header>
    <div class="stack">${tabs[S.tab]()}</div>
    <nav class="dock"><div class="inner">${[["today", "Today", "sword"], ["raid", "Raid", "raid"], ["shop", "Shop", "bag"], ["me", "Me", "user"]].map(([k, l, i]) =>
      `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ic(i)}${l}${dockDot(k)}</button>`).join("")}</div></nav>`;
}
function walletHtml() {
  const w = S.D.wallet;
  if (w < 0) return `<div class="wallet"><span class="cur debt" title="You're in debt"><span class="cico">${coin()}</span>−${fmt(-w)}</span></div>`;
  return `<div class="wallet"><span class="cur" title="Endeavours (100 Efforts each)"><span class="cico">${gem()}</span>${fmt(Math.floor(w / PER_E()))}</span><span class="cur" title="Efforts"><span class="cico">${coin()}</span>${w % PER_E()}</span></div>`;
}
// A dot on the dock when something's waiting: the Taxman is open, or the raid is live.
function dockDot(tab) {
  if (tab === "today" && ["open", "live"].includes(taxState())) return '<i class="ping"></i>';
  if (tab === "raid" && raidState() === "open") return '<i class="ping"></i>';
  return "";
}

// ---------- This week: the table everything hangs off ----------
function weekPanel() {
  if (!squad()) return noSquadPanel();
  const T = weekRows(), top = Math.max(1, ...T.rows.map((r) => r.weekSteps));
  const today = (id) => squad().members.find((m) => m.id === id)?.todaySteps ?? 0;
  return `<section class="panel" id="week-panel">
      <div class="ptitle"><span class="ic-badge">${ic("trophy")}</span><h2 class="ol-sm">This week</h2><span class="side chip">Avg ${fmt(T.avg)}</span></div>
      <div class="wtable">${T.rows.map((r, i) => `<div class="wrow ${r.you ? "me" : ""} ${r.title || ""}">
          <span class="wn">${r.title === "top" ? ic("crown") : i + 1}</span>
          <span class="grow"><b>${esc(r.you ? "You" : r.name)}</b>${r.title === "top" ? '<span class="chip gold">Top walker</span>' : r.title === "last" ? '<span class="chip red">Dead weight</span>' : r.fresh ? '<span class="chip">New</span>' : ""}
            <i class="wbar"><s style="width:${(r.weekSteps / top) * 100}%"></s></i>
            <small class="pw ${r.stride > 1 ? "up" : r.stride < 1 ? "down" : ""}">×${r.stride.toFixed(2)} raid power</small></span>
          <span class="ws"><span><b class="num">${fmt(today(r.id))}</b><small>today</small></span><span><b class="num">${fmt(r.weekSteps)}</b><small>week</small></span></span>
        </div>`).join("")}</div>
      <p class="tiny faint" style="margin:10px 0 0">Monday to Sunday. Your raid power is your steps ÷ the squad average (×${G.RULES.strideMin} to ×${G.RULES.strideMax}). On Sunday the top walker gets +${Math.round(G.RULES.topLoot * 100)}% loot and ${Math.round(G.RULES.slackerTax * 100)}% of the bottom walker's week.</p>
    </section>`;
}
function noSquadPanel() {
  return `<section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("squad")}</span><h2 class="ol-sm">No squad yet</h2></div>
      <p class="small muted" style="margin:0 0 12px">The game is about out-walking your mates. Make a squad and send the link to the group chat, or join theirs with a code.</p>
      <div class="btn-row"><button class="btn green" data-act="squad-sheet">${ic("squad")} Make or join</button></div>
    </section>`;
}

// ---------- Today ----------
function syncChip() {
  const m = me(), fresh = m.steps_synced_at && Date.now() - Date.parse(m.steps_synced_at) < 3 * 3600000;
  if (NATIVE && !S.native?.steps) return `<button class="chip red" data-act="setup-steps">${ic("warning")} Steps not connected · connect</button>`;
  if (!m.steps_synced_at) return `<button class="chip red" data-act="setup-steps">${ic("warning")} Steps aren't syncing · set up</button>`;
  if (NATIVE) return `<span class="chip green">${ic("steps")} Synced ${ago(m.steps_synced_at)}</span><button class="chip cyan" data-act="native-sync">${ic("refresh")} Sync now</button>`;
  return `<span class="chip ${fresh ? "green" : "gold"}">${ic("steps")} Synced ${ago(m.steps_synced_at)}</span>${m.platform === "ios" ? `<a class="chip cyan" href="shortcuts://run-shortcut?name=${encodeURIComponent("Effort Steps")}">${ic("refresh")} Sync now</a>` : m.steps_source === "android-app" ? `<a class="chip cyan" href="${stepsAppLink(S.token)}">${ic("refresh")} Sync now</a>` : ""}`;
}
function dayTiles() {
  const T = taxSetup(), stake = Math.round(T.efforts * T.taxRate), sc = S.D.today.scroll;
  return `<div class="tiles">
      <div class="tile gold"><div class="k">${ic("coin")} Earned today</div><div class="v">${effortTag(T.efforts)}<small>${fmt(S.D.today.steps)} steps</small></div></div>
      <div class="tile red"><div class="k">${ic("warning")} At stake</div><div class="v">${Math.round(T.taxRate * 100)}%<small>${stake} Efforts</small></div></div>
      <div class="tile"><div class="k">${ic("heart")} Taxman health</div><div class="v num">${fmt(T.hp)}</div></div>
      <div class="tile cyan"><div class="k">${ic("phone")} Scrolling</div><div class="v">${sc ?? "–"}<small>/ ${G.scrollBudget(S.D.today.steps)} min budget</small></div></div>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">
      ${T.pace > 0 ? `<span class="chip green">${ic("steps")} Ahead of the squad · −${Math.round(G.RULES.paceTax * 100)}% tax</span>` : T.pace < 0 ? `<span class="chip red">${ic("steps")} Behind the squad · +${Math.round(G.RULES.paceTax * 100)}% tax</span>` : squad()?.members.length > 1 ? `<span class="chip">${ic("steps")} Level with the squad</span>` : ""}
      ${S.D.today.debt ? `<span class="chip red">${ic("bolt")} Paralysed: −${fmt(S.D.today.debt)} steps today</span>` : ""}
      ${syncChip()}
    </div>`;
}
function taxHero() {
  const st = taxState(), w = S.D.windows.tax, T = taxSetup(), f = S.D.fight, paid = ledgerFor("tax", S.D.today.day);
  let chip, line, btn;
  if (st === "open" || st === "live") {
    const end = st === "live" ? Date.parse(f.ends_at) : w.closes;
    chip = `<span class="chip green pulse">${ic("sword")} Open now · <span data-count="${end}">${countdown(end - now())}</span></span>`;
    line = `Wants ${Math.round(T.taxRate * 100)}% of today's Efforts. Knock him out to keep it all, then rob him.`;
    btn = `<button class="btn gold xl block" style="margin-top:14px" data-act="tax">${ic("sword")} ${st === "live" ? "Back to the fight" : "Fight"}</button>`;
  } else if (st === "done") {
    const k = Number(f.knocked);
    chip = `<span class="chip">${ic("check")} Done for today</span>`;
    line = k >= 1 ? `Knocked out, and you stole ${Math.round(Number(f.steal_pct) * 100)}% back.` : k >= 0.05 ? `You fought him down to ${Math.round(Number(f.rate) * (1 - k) * 100)}% tax.` : `He took the full ${Math.round(Number(f.rate) * 100)}%.`;
    btn = `<div class="rline total" style="margin-top:12px"><span>Banked tonight</span><span class="rv">${paid ? signedEfforts(paid.amount) : "–"}</span></div>
      <p class="tiny faint" style="margin:6px 0 0">Steps after 7pm still count: they pay out after midnight on the same terms.${w.test ? "" : ` Next fight in <span data-count="${w.next}">${countdown(w.next - now())}</span>.`}</p>`;
  } else if (st === "soon") {
    chip = `<span class="chip gold">${ic("clock")} Tonight · 7pm</span>`;
    line = `Wants ${Math.round(T.taxRate * 100)}% of today's Efforts. Five minutes to knock him out.`;
    btn = `<button class="btn xl block" style="margin-top:14px" disabled>${ic("clock")} Opens in <span data-count="${w.opens}">${countdown(w.opens - now())}</span></button>${NATIVE ? (S.native?.reminders ? "" : `<button class="btn xs block" style="margin-top:10px" data-act="native-reminders-on">${ic("bell")} Ping me at 6:45pm</button>`) : S.push === "off" ? `<button class="btn xs block" style="margin-top:10px" data-act="push-on">${ic("bell")} Ping me at 6:45pm</button>` : ""}`;
  } else {
    chip = `<span class="chip red">${ic("warning")} Missed tonight</span>`;
    line = `No fight, so he takes the full ${Math.round(T.taxRate * 100)}% when today settles after midnight.`;
    btn = `<button class="btn xl block" style="margin-top:14px" disabled>${ic("clock")} Next fight in <span data-count="${w.next}">${countdown(w.next - now())}</span></button>`;
  }
  return `<section class="panel hero">
      <div class="art"><div class="bg" style="background:radial-gradient(90% 120% at 80% 100%, #3f8a5e 0%, #1c4030 45%, #0f2219 100%)"></div>
        <div class="label">${chip}${w.test ? ' <span class="chip cyan">Test</span>' : ""}<h3 class="ol">The Taxman</h3><p>${line}</p></div>
        <div class="portrait">${portraitImg("boss", "taxman", { w: 300, h: 320 })}</div></div>
      <div class="body"><div id="day-tiles">${dayTiles()}</div>${btn}</div>
    </section>`;
}
function ledgerPanel() {
  const rows = S.D.ledger.slice(0, 12);
  if (!rows.length) return "";
  const label = (r) => r.kind === "day" ? `${new Date(r.ref + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${r.note}` : r.note;
  return `<section class="panel flat"><div class="ptitle"><h2 class="ol-sm">Wallet</h2><span class="side small faint">${fmt(S.D.wallet)} Efforts</span></div>
    <div class="feedlist">${rows.map((r) => `<div class="it"><span class="grow">${esc(label(r))}</span><span class="amt ${r.amount >= 0 ? "plus" : "minus"}">${signedEfforts(r.amount)}</span></div>`).join("")}</div></section>`;
}
function tabToday() {
  return `${updateBanner()}${taxHero()}${weekPanel()}${ledgerPanel()}
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("info")}</span><h2 class="ol-sm">How a day works</h2></div>
      <div class="how">
        <div class="hrow"><span class="hic">${ic("coin")}</span><div><b>Walk to earn</b><span>Every ${fmt(G.RULES.stepsPerEffort)} steps is 1 Effort, up to ${G.RULES.dailyEffortCap} a day. ${PER_E()} Efforts make 1 Endeavour, which is what gear costs.</span></div></div>
        <div class="hrow"><span class="hic">${ic("trophy")}</span><div><b>Out-walk your mates</b><span>Beat the squad's average today and the Taxman takes ${Math.round(G.RULES.paceTax * 100)} points less; fall 10% behind and he takes ${Math.round(G.RULES.paceTax * 100)} more.</span></div></div>
        <div class="hrow"><span class="hic">${ic("sword")}</span><div><b>7pm: five minutes to fight</b><span>He takes ${Math.round(G.RULES.baseTax * 100)}% (more if you scrolled over budget). Every hit cuts it; knock him out to keep everything, then keep tapping to steal up to ${Math.round(taxSetup().stealCap * 100)}% extra. Miss it and he takes the lot.</span></div></div>
        <div class="hrow"><span class="hic">${ic("target")}</span><div><b>Audits and receipts</b><span>When he Audits you only the moving target takes damage. Golden receipts knock 3% off his health.</span></div></div>
      </div>
    </section>`;
}

// ---------- Raid ----------
function statRows(st) {
  const { g } = G.loadout(st, me().gear, S.D.inv);
  const max = Math.max(20, ...Object.values(g));
  return G.STATS.map((s) => {
    const [icon, col] = STAT_LOOK[s.id];
    return `<div class="stat" title="${esc(s.what)}"><span class="sic" style="background:${col}">${ic(icon)}</span><span class="sn">${s.label}</span>
      <div class="bar"><i class="base" style="--sc:${col};width:${(st[s.id] / max) * 100}%"></i><i class="gear" style="width:${((g[s.id] - st[s.id]) / max) * 100}%"></i></div><span class="sv">${+g[s.id].toFixed(1)}</span></div>`;
  }).join("");
}
// What Sunday looks like if the whole squad turns up (gear upgrades on teammates aren't counted here).
function raidPreview() {
  const sq = squad(), T = weekRows();
  const members = sq.members.map((m) => {
    const row = T.rows.find((r) => r.id === m.id);
    return { id: m.id, name: m.name, stats: G.stats(m.character || {}), equipped: m.id === me().id ? me().gear : m.gear, inv: m.id === me().id ? S.D.inv : {}, weekSteps: m.weekSteps, stride: row.stride, title: row.title };
  });
  return G.raidCreate(members, { seed: 1, tier: sq.tier });
}
const poolFor = (R) => G.RULES.raidRewardPerMember * R.members.length * R.lvl ** G.RULES.raidRewardCurve * R.boss.reward * R.timeShare;
function raidHero() {
  const st = raidState(), w = S.D.windows.raid;
  const P = raidPreview(), boss = P.boss, mine = P.members.find((m) => m.id === me().id);
  let chip, btn;
  if (st === "open") {
    chip = `<span class="chip green pulse">${ic("raid")} Live now · <span data-count="${w.closes}">${countdown(w.closes - now())}</span></span>`;
    btn = `<button class="btn green xl block" style="margin-top:14px" data-act="raid">${ic("raid")} Join the raid</button>`;
  } else if (st === "done") {
    const r = S.D.raid.result;
    chip = `<span class="chip">${ic("check")} This week's raid is done</span>`;
    btn = `<button class="btn blue block" style="margin-top:14px" data-act="raid-result">${ic("chest")} ${r.how === "won" ? "Won" : r.how === "wiped" ? "Wiped" : "Out of time"} · see results</button>`;
  } else {
    chip = `<span class="chip red">${ic("raid")} Sunday · 7pm</span>`;
    btn = `<button class="btn xl block" style="margin-top:14px" disabled>${ic("clock")} Opens in <span data-count="${w.opens}">${countdown(w.opens - now())}</span></button>`;
  }
  return `<section class="panel hero">
      <div class="art"><div class="bg" style="background:radial-gradient(90% 120% at 80% 100%, #5a4bb0 0%, #24306e 45%, #121a44 100%)"></div>
        <div class="label">${chip}${w.test ? ' <span class="chip cyan">Test</span>' : ""}<h3 class="ol">${esc(boss.name)}</h3><p>Boss ${boss.tier}${boss.lap > 1 ? ` · Lap ${boss.lap}` : ""}. ${esc(boss.title)}.</p></div>
        <div class="portrait">${portraitImg("boss", boss.id, { w: 300, h: 320 })}</div></div>
      <div class="body">
        <div class="tiles">
          <div class="tile red"><div class="k">${ic("heart")} Health</div><div class="v num">${fmt(boss.max)}</div></div>
          <div class="tile"><div class="k">${ic("upgrade")} Boss level</div><div class="v">${P.lvl.toFixed(2)}<small>from gear</small></div></div>
          <div class="tile gold"><div class="k">${ic("chest")} Win reward</div><div class="v">${effortTag(poolFor(P))}<small>squad</small></div></div>
          <div class="tile ${mine.stride > 1 ? "green" : mine.stride < 1 ? "red" : ""}"><div class="k">${ic("steps")} Your power</div><div class="v">×${mine.stride.toFixed(2)}<small>from steps</small></div></div>
        </div>${btn}
        <p class="tiny faint" style="margin:10px 0 0">Everyone fights the same boss at the same time, 15 minutes. If the full squad turns up it has ${fmt(boss.max)} health; it's smaller if fewer come.</p>
      </div>
    </section>`;
}
function tabRaid() {
  if (!squad()) return `${noSquadPanel()}${howRaids()}`;
  const st = myStats(), cls = myClass(), sug = G.suggestedPosition(st), pos = me().pos || sug, tier = squad().tier;
  const lap = Math.floor((tier - 1) / G.BOSSES.length) + 1;
  return `${raidHero()}${weekPanel()}
    <section class="panel">
      <div class="ptitle"><span class="ic-badge red">${ic("ladder")}</span><h2 class="ol-sm">The ladder</h2><span class="side chip">Lap ${lap}</span></div>
      <div class="ladder">${G.BOSSES.map((b, i) => {
        const t = (lap - 1) * G.BOSSES.length + i + 1, state = t < tier ? "beaten" : t === tier ? "next" : "locked";
        return `<div class="rung ${state}"><span class="n">${state === "beaten" ? ic("check") : i + 1}</span><span class="grow"><b>${esc(b.name)}</b><small>${esc(b.title)}</small></span>${state === "next" ? `<span class="chip gold">Next</span>` : state === "locked" ? `<span class="lockic">${ic("lock")}</span>` : ""}</div>`;
      }).join("")}</div>
      <p class="small muted" style="margin:10px 0 0">Beat a boss and next Sunday brings the next one. After the last, the ladder loops, twice as tough and twice as rich.</p>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("crown")}</span><h2 class="ol-sm">${esc(cls.name)}</h2><span class="side chip gold">Best: ${G.posOf(sug).label}</span></div>
      <p class="small muted" style="margin:-4px 0 8px">${esc(cls.blurb)}</p>
      ${statRows(st)}
      <span class="field-label">Where you start on Sunday</span>
      <div class="seg">${G.POSITIONS.map((p) => `<button data-pos="${p.id}" aria-pressed="${p.id === pos}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div>
      <p class="tiny faint" style="margin:8px 0 0">${esc(G.posOf(pos).ability)}: ${esc(G.posOf(pos).abilityWhat)}. You can move rows during the fight.</p>
    </section>
    ${S.D.lastRaid && S.D.raid?.status !== "done" ? lastRaidPanel(S.D.lastRaid) : ""}
    ${howRaids()}`;
}
function lastRaidPanel(L) {
  const r = L.result, mine = r.shares?.find((s) => s.id === me().id);
  return `<section class="panel flat"><div class="ptitle"><h2 class="ol-sm">Last raid: ${esc(r.boss)}</h2><span class="side chip ${r.how === "won" ? "green" : "red"}">${r.how === "won" ? "Won" : r.how === "wiped" ? "Wiped" : "Out of time"}</span></div>
    <p class="small muted" style="margin:0">${Math.round(r.frac * 100)}% dealt${mine ? ` · you took home ${fmt(mine.total)} Efforts` : " · you weren't there"}.</p></section>`;
}
function howRaids() {
  return `<section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("info")}</span><h2 class="ol-sm">How raids work</h2></div>
      <div class="how">
        <div class="hrow"><span class="hic">${ic("steps")}</span><div><b>Steps are power</b><span>Your week's steps against the squad average set how hard you hit. Half the loot is split by steps, half by what you did in the fight. The lowest walker gets hunted by the boss and pays ${Math.round(G.RULES.slackerTax * 100)}% of their week to the top walker, raid or no raid.</span></div></div>
        <div class="hrow"><span class="hic">${ic("squad")}</span><div><b>Three rows</b><span>${G.POSITIONS.map((p) => `${p.label}: ×${p.mult} damage, ${p.ability}`).join(". ")}. Moving takes a few seconds.</span></div></div>
        <div class="hrow"><span class="hic">${ic("warning")}</span><div><b>Read the warnings</b><span>Every attack is called a couple of seconds early: single hits, stomps on the front two rows, screams on everyone, and a feast that heals it unless you burst it.</span></div></div>
        <div class="hrow"><span class="hic">${ic("brains")}</span><div><b>When someone falls</b><span>Everyone gets one question: name a thing in ${G.RULES.triviaSeconds}s. If ${Math.round(G.RULES.triviaFailShare * 100)}% of the squad gets theirs wrong, you're all paralysed and start tomorrow ${fmt(G.RULES.paralysedSteps)} steps down.</span></div></div>
        <div class="hrow"><span class="hic">${ic("upgrade")}</span><div><b>Gear raises the stakes</b><span>Better squad gear makes the boss stronger, but the reward grows faster.</span></div></div>
      </div>
    </section>`;
}

// ---------- Shop ----------
function itemCard(item, { deal = false } = {}) {
  const inv = S.D.inv, t = G.tierOf(item.tier), own = item.id in inv, on = me().gear[item.slot] === item.id, locked = !own && t.lvl > level();
  const st = G.itemStats(item, inv[item.id] || 0), price = G.priceOf(item, deal);
  return `<button class="item ${item.tier} ${locked ? "locked" : ""}" style="--rc:${t.color}" data-item="${item.id}" data-deal="${deal ? 1 : ""}" aria-label="${esc(item.name)}">
    <div class="art-wrap"><span class="rarity">${t.label}</span><div class="art">${itemArt(item)}</div>
      ${own && inv[item.id] ? `<span class="upb">+${inv[item.id]}</span>` : ""}${on ? `<span class="eq">${ic("check")}</span>` : ""}${deal && !own ? `<span class="deal">−${Math.round((1 - price / G.priceOf(item, false)) * 100)}%</span>` : ""}
      ${locked ? `<span class="lockover">${ic("lock")}</span>` : ""}</div>
    <div class="meta"><h4>${esc(item.name)}</h4>
      <div class="stats">${Object.entries(st).map(([k, v]) => `<span class="st" style="color:${STAT_LOOK[k][1]}">${ic(STAT_LOOK[k][0])}+${v}</span>`).join("")}</div></div>
    ${item.perk ? `<div class="perk">${esc(perkText(item.perk))}</div>` : "<div></div>"}
    <div class="foot">${locked ? `<span class="buy">Level ${t.lvl}</span>` : own ? `<span class="buy owned">${on ? "Equipped" : "Owned"}</span>` : `<span class="buy ${S.D.wallet < price ? "poor" : ""}">${gem(18)}${fmt(price / PER_E())}</span>`}</div>
  </button>`;
}
const dealsToday = () => G.dealsFor(S.D.today.day, myClass().id, level());
function tabShop() {
  const cls = myClass(), lvl = level(), inv = S.D.inv;
  const tierRank = (i) => I.TIERS.findIndex((t) => t.id === i.tier);
  const sort = (a, b) => tierRank(a) - tierRank(b) || G.SLOTS.indexOf(a.slot) - G.SLOTS.indexOf(b.slot);
  const lists = {
    class: I.ITEMS.filter((i) => i.cls === cls.id).sort(sort),
    all: I.ITEMS.filter((i) => !i.cls).sort(sort),
    deals: dealsToday().map(G.itemById).filter(Boolean),
    bag: I.ITEMS.filter((i) => i.id in inv).sort(sort),
  };
  const tab = lists[S.shopTab] ? S.shopTab : "class";
  const next = I.TIERS.find((t) => t.lvl > lvl);
  const slotName = { weapon: "Weapon", armour: "Armour", trinket: "Trinket" };
  return `
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("guard")}</span><h2 class="ol-sm">Loadout</h2>${next ? `<span class="side chip">${ic("lock")} ${next.label} at Lv ${next.lvl}</span>` : ""}</div>
      <div class="loadout">${G.SLOTS.map((s) => {
        const it = G.itemById(me().gear[s]);
        return it ? `<button class="slot full" style="--rc:${G.tierOf(it.tier).color}" data-item="${it.id}" aria-label="${esc(it.name)}"><div class="art">${itemArt(it)}</div><span class="slab">${esc(it.name)}</span></button>`
          : `<div class="slot"><div class="ph">${ic({ weapon: "sword", armour: "guard", trinket: "star" }[s])}<span>${slotName[s]}</span></div></div>`;
      }).join("")}</div>
    </section>
    <div class="tabs-sub">${[["class", cls.name, 0], ["all", "Everyone", 0], ["deals", "Deals", lists.deals.filter((i) => !(i.id in inv)).length], ["bag", "Bag", Object.keys(inv).length]].map(([k, l, n]) =>
      `<button data-shoptab="${k}" aria-pressed="${tab === k}">${esc(l)}${n ? `<span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>
    ${tab === "deals" ? `<p class="small muted" style="margin:0">Three picks for your class each day, about ${Math.round(G.RULES.dealDiscount * 100)}% off. New ones at midnight.</p>` : ""}
    <div class="items">${lists[tab].length ? lists[tab].map((i) => itemCard(i, { deal: tab === "deals" })).join("") : `<p class="muted small" style="grid-column:1/-1;text-align:center;padding:20px 0">${tab === "bag" ? "Nothing yet. Gear you buy lives here." : "Nothing here yet."}</p>`}</div>`;
}
function itemSheet(id, deal) {
  const item = G.itemById(id); if (!item) return;
  const inv = S.D.inv, t = G.tierOf(item.tier), up = inv[id] || 0, own = id in inv, on = me().gear[item.slot] === id, wallet = S.D.wallet;
  const locked = !own && t.lvl > level(), price = G.priceOf(item, deal), cls = item.cls ? I.CLASSES.find((c) => c.id === item.cls) : null;
  const st = G.itemStats(item, up), next = G.itemStats(item, up + 1), cost = G.upgradeCost(item, up), maxed = up >= G.RULES.upgradeMax;
  openSheet(`<div class="row spread" style="margin-bottom:10px"><span class="chip" style="background:color-mix(in srgb, ${t.color} 30%, transparent);border-color:${t.color};color:#fff">${t.label}${cls ? ` · ${esc(cls.name)}` : " · Any class"} · ${esc(item.slot)}</span><button class="iconbtn" data-act="close-sheet" aria-label="Close">${ic("close")}</button></div>
    <div class="bigart"><div class="art">${itemArt(item)}</div>${up ? `<span class="upb">+${up}</span>` : ""}</div>
    <h2 class="ol-sm">${esc(item.name)}</h2>
    <p class="flavour">${esc(item.text)}</p>
    <div class="tiles">${Object.entries(st).map(([k, v]) => `<div class="tile"><div class="k" style="color:${STAT_LOOK[k][1]}">${ic(STAT_LOOK[k][0])} ${statLabel(k)}</div><div class="v">+${v}${own && !maxed ? `<small>→ +${next[k]}</small>` : ""}</div></div>`).join("")}</div>
    ${item.perk ? `<div class="perkbox">${ic("star")}<span>${esc(perkText(item.perk))}</span></div>` : ""}
    <div class="btn-row" style="margin-top:12px">
      ${locked ? `<button class="btn block" disabled>${ic("lock")} Unlocks at level ${t.lvl}</button>`
        : !own ? `<button class="btn green xl block" data-buy="${id}" data-deal="${deal ? 1 : ""}" ${wallet < price ? "disabled" : ""}>Buy ${priceTag(price)}</button>`
        : `${on ? `<button class="btn" data-unequip="${item.slot}">Take off</button>` : `<button class="btn blue" data-equip="${id}">Equip</button>`}
           ${maxed ? `<button class="btn" disabled>Max level</button>` : `<button class="btn gold" data-upgrade="${id}" ${wallet < cost ? "disabled" : ""}>${ic("upgrade")} +${up + 1} ${priceTag(cost)}</button>`}`}
    </div>
    ${!own && !locked && wallet < price ? `<p class="small muted" style="text-align:center;margin:10px 0 0">You need ${fmt(Math.ceil((price - wallet) / PER_E()))} more Endeavour${price - wallet > PER_E() ? "s" : ""}. Walk.</p>` : ""}`, { rc: t.color });
}
async function shopAction(action, body, done) {
  if (S.busy) return;
  S.busy = true;
  try { await call(action, { token: S.token, ...body }); await load(); render(); done?.(); }
  catch (e) { toast(e.message); }
  finally { S.busy = false; }
}

// ---------- Me ----------
function tabMe() {
  const m = me(), sq = squad(), cls = myClass();
  return `${updateBanner()}
    <section class="panel">
      <div class="row" style="align-items:flex-start;gap:14px">
        <div class="bigface has-fallback"><span class="fb">${Walker.svg(ANS[m.id], { mood: "fresh" })}</span>${portraitImg("walker", m.id, { w: 220, h: 260 })}</div>
        <div class="grow"><h2 class="ol-sm disp" style="margin:4px 0 2px;font-size:24px">${esc(m.name)}</h2><div class="small muted">${esc(cls.name)} · Level ${level()}</div>
          <p class="tiny faint" style="margin:8px 0 10px">${esc(cls.blurb)}</p>
          <button class="btn xs" data-act="retake">${ic("edit")} Change my look</button></div>
      </div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge green">${ic("steps")}</span><h2 class="ol-sm">Steps</h2><span class="side chip ${m.steps_synced_at ? "green" : "red"}">${m.steps_synced_at ? `Synced ${ago(m.steps_synced_at)}` : "Not syncing"}</span></div>
      <p class="small muted" style="margin:0 0 10px">${m.steps_synced_at ? `From ${esc(m.steps_source === "android-app" ? "the Effort app" : m.steps_source === "android" || /health/.test(m.steps_source || "") ? "HC Webhook" : m.steps_source === "manual" ? "typing them in" : "your iPhone Shortcut")}. Today so far: ${fmt(S.D.today.rawSteps)}.` : "Your steps are the whole game. Set up the sync once and forget about it."}</p>
      <div class="btn-row"><button class="btn sm green" data-act="setup-steps">${ic("refresh")} Set up sync</button><button class="btn sm" data-act="log-steps">${ic("edit")} Type them in</button></div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("phone")}</span><h2 class="ol-sm">Scrolling</h2><span class="side chip">${S.D.today.scroll ?? "–"} min today</span></div>
      <p class="small muted" style="margin:0 0 10px">Short-video scrolling over your budget (${G.RULES.scrollMinPer1kSteps} min per 1,000 steps) adds to the Taxman's cut. No data means we assume ${S.D.today.noScrollMin} min.</p>
      <div class="btn-row"><button class="btn sm blue" data-act="setup-scroll">${ic("refresh")} Track it</button><button class="btn sm" data-act="log-scroll">${ic("edit")} Type it in</button></div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("bell")}</span><h2 class="ol-sm">Reminders</h2></div>
      <p class="small muted" style="margin:0 0 10px">The Taxman is only around 7pm to 7:05pm, and the raid is Sunday 7pm to 7:15pm. Get a ping at 6:45pm so you don't miss them.</p>
      ${pushBlock()}
      <span class="field-label">Or put them in your calendar</span>
      ${reminderButtons()}
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("squad")}</span><h2 class="ol-sm">${sq ? esc(sq.name) : "Squad"}</h2>${sq ? `<span class="side chip">${sq.code}</span>` : ""}</div>
      ${sq ? `<div class="mates">${sq.members.map((x) => `<div class="mate">${face(x.id, 40)}<div class="grow"><b>${esc(x.id === m.id ? "You" : x.name)}</b><small>Lv ${x.level} · ${x.synced ? `synced ${ago(x.synced)}` : "steps not syncing"}</small></div><span class="num small">${fmt(x.todaySteps)}<small class="faint"> today</small></span></div>`).join("")}</div>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm green" data-act="invite">${ic("share")} Invite</button><button class="btn sm" data-act="squad-sheet">Switch</button></div>
        <button class="btn xs red" style="margin-top:10px" data-act="leave">Leave squad</button>`
        : `<p class="small muted" style="margin:0 0 10px">You're not in a squad.</p><button class="btn green block" data-act="squad-sheet">${ic("squad")} Make or join a squad</button>`}
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("link")}</span><h2 class="ol-sm">This phone</h2></div>
      <label class="row spread" style="margin-bottom:12px"><span><b>Sound</b></span><input class="switch" type="checkbox" data-toggle="sound" ${FX.muted ? "" : "checked"} aria-label="Sound"></label>
      <label class="row spread" style="margin-bottom:12px"><span><b>3D battles</b><span class="small muted" style="display:block">Switch off on older phones</span></span><input class="switch" type="checkbox" data-toggle="3d" ${store.get("no3d") ? "" : "checked"} aria-label="3D battles"></label>
      ${passwordRow()}
      <p class="small muted" style="margin:0 0 8px">Your restore link also signs you in on another phone. Keep it private: it's your account.</p>
      <div class="btn-row"><button class="btn sm" data-act="copy-restore">${ic("copy")} Copy restore link</button><a class="btn sm" href="lab.html">${ic("sliders")} The Lab</a></div>
      <button class="btn xs red" style="margin-top:10px" data-act="signout">${ic("door")} Sign out on this phone</button>
    </section>`;
}
// Calendar reminders: an .ics file (iPhone, Outlook, most Android calendars) or Google Calendar links.
function reminderButtons() {
  const w = S.D.windows, gstamp = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(t).replace(/\D/g, "").replace(/^(\d{8})/, "$1T");
  const gcal = (text, start, mins, rule) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${gstamp(start)}/${gstamp(start + mins * 60000)}&ctz=Europe/London&recur=${encodeURIComponent("RRULE:" + rule)}&details=${encodeURIComponent(APP_URL)}`;
  const taxAt = w.tax.test ? w.tax.next : w.tax.opens > now() ? w.tax.opens : w.tax.next;
  return `<a class="btn sm block" href="reminders.ics">${ic("calendar")} Add both to my calendar</a>
    <div class="btn-row" style="margin-top:8px"><a class="btn xs" target="_blank" rel="noopener" href="${gcal("Effort: the Taxman", taxAt, 5, "FREQ=DAILY")}">Google: 7pm daily</a><a class="btn xs" target="_blank" rel="noopener" href="${gcal("Effort: squad raid", w.raid.test ? w.raid.closes : w.raid.opens, 15, "FREQ=WEEKLY;BYDAY=SU")}">Google: Sunday raid</a></div>`;
}

// ---------- sheets ----------
function openSheet(html, { rc } = {}) {
  const sh = $("#sheet");
  sh.innerHTML = `<div class="panel" role="dialog" aria-modal="true" ${rc ? `style="--rc:${rc}"` : ""}><div class="grab"></div>${html}</div>`;
  sh.hidden = false;
  hydratePortraits();
}
function closeSheet() { const sh = $("#sheet"); sh.hidden = true; sh.innerHTML = ""; S.sheetKind = null; }
const sheetHead = (title) => `<div class="row spread" style="margin-bottom:12px"><h2 class="ol-sm disp" style="margin:0;font-size:22px">${title}</h2><button class="iconbtn" data-act="close-sheet" aria-label="Close">${ic("close")}</button></div>`;

// Inside the Android app: one button each, and the phone asks.
function nativeSetup(kind) {
  const st = S.native || {}, done = (text) => `<div class="row spread" style="flex-wrap:wrap;gap:8px"><span class="chip green">${ic("check")} ${text}</span>`;
  if (kind === "steps") {
    if (st.health === "none") return `<div class="guide small">This phone doesn't have Health Connect, which is how Android shares steps. Type your steps in from <b>Me → Steps</b> instead.</div>`;
    if (st.health === "update") return `<p class="small muted" style="margin:0 0 10px">Android shares steps through Google's Health Connect. Get it (free), then come back and allow steps.</p><button class="btn gold block" data-act="native-steps">${ic("steps")} Get Health Connect</button>`;
    if (st.steps) return `${done(st.todaySteps >= 0 ? `Steps on · ${fmt(st.todaySteps)} today` : "Steps on")}<button class="btn xs" data-act="native-sync">${ic("refresh")} Sync now</button></div>
      <p class="tiny faint" style="margin:8px 0 0">${st.syncedAt ? `Synced ${ago(new Date(st.syncedAt).toISOString())}. ` : ""}It syncs every 15 minutes by itself.${st.error ? ` <span style="color:var(--red)">${esc(st.error)}</span>` : ""}</p>`;
    return `<button class="btn gold block" data-act="native-steps">${ic("steps")} Allow steps</button><p class="tiny faint" style="margin:6px 2px 0">Android asks once. Effort only reads your step count. Samsung Health? Also turn on <b>Settings → Health Connect</b> in Samsung Health.</p>`;
  }
  if (st.scroll) return `${done("Scroll tracking on")}</div><p class="tiny faint" style="margin:8px 0 0">Counts minutes in TikTok, Instagram, YouTube, Snapchat and Facebook.</p>`;
  return `<button class="btn blue block" data-act="native-scroll">${ic("phone")} Allow scroll tracking</button><p class="tiny faint" style="margin:6px 2px 0">Android opens <b>Usage access</b>: tap <b>Effort</b>, switch it on, then come back. It only counts minutes in short-video apps.</p>`;
}

function setupBody(kind) {
  if (NATIVE) return nativeSetup(kind);
  const p = S.setupPlatform || me()?.platform || S.platform, t = S.token;
  const toggle = `<div class="seg" style="margin-bottom:12px">${[["ios", "iPhone"], ["android", "Android"], ["other", "Type it in"]].map(([v, l]) => `<button type="button" data-setup="${v}" data-kind="${kind}" aria-pressed="${v === p}">${l}</button>`).join("")}</div>`;
  const box = (url) => `<div class="copybox"><code>${esc(url)}</code><button class="btn xs" data-copy="${esc(url)}">${ic("copy")} Copy</button></div>`;
  let body;
  if (kind === "steps") {
    if (p === "ios") body = `<ol class="steps-list">
        <li>Open <b>Shortcuts</b>, tap <b>+</b>, and name it <b>Effort Steps</b> (exactly that, so the app's Sync button can run it).</li>
        <li>Add <b>Find Health Samples</b>: Type <b>Steps</b>, filter <b>Start Date is today</b>, <b>Group By: Day</b>.</li>
        <li>Add <b>Calculate Statistics</b> → <b>Sum</b>.</li>
        <li>Add <b>Get Contents of URL</b> and paste:${box(`${API}/log?t=${t}&steps=`)}then tap the end of it and insert the <b>Statistics</b> variable.</li>
        <li>Tap ▶︎ to test. You should see "✅ … steps logged".</li>
        <li>In the <b>Automation</b> tab: <b>+</b> → <b>Time of Day</b> → <b>18:50</b>, <b>Daily</b>, <b>Run Immediately</b> → <b>Effort Steps</b>. That's your steps in before the Taxman.</li>
        <li>Make two more for <b>13:00</b> and <b>23:50</b>, so the squad table stays live and the whole day counts.</li>
      </ol>`;
    else if (p === "android") body = androidApp(t);
    else body = `<p class="small">Type your steps in from <b>Me → Steps → Type them in</b> each day, before 7pm and again before bed. You can fix the last week.</p>`;
  } else {
    if (p === "ios") body = `<p class="small">Two automations tell Effort when TikTok, Instagram or YouTube opens and closes, and Effort works out the minutes.</p>
      <ol class="steps-list">
        <li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>App</b>.</li>
        <li>Choose the apps you scroll on. Tick <b>Is Opened</b> only. <b>Run Immediately</b>, <b>Notify When Run</b> off.</li>
        <li><b>New Blank Automation</b> → <b>Get Contents of URL</b>, paste:${box(`${API}/scroll?t=${t}&ev=open`)}</li>
        <li>Make a second one the same way, ticking <b>Is Closed</b> and using:${box(`${API}/scroll?t=${t}&ev=close`)}</li>
      </ol>`;
    else if (p === "android") body = `${androidApp(t)}<div class="divider"></div><p class="small">Or without the app, free with <a href="https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid" target="_blank" rel="noopener"><b>MacroDroid</b></a>:</p>
      <ol class="steps-list">
        <li>New macro → Trigger <b>Applications → Application Launched/Closed</b> → <b>Launched</b> → pick TikTok, Instagram, YouTube.</li>
        <li>Action <b>Web Interactions → HTTP Request</b>, GET:${box(`${API}/scroll?t=${t}&ev=open`)}</li>
        <li>A second macro with <b>Application Closed</b> and:${box(`${API}/scroll?t=${t}&ev=close`)}</li>
        <li>Allow the permissions it asks for and turn off battery optimisation for MacroDroid.</li>
      </ol>`;
    else body = `<p class="small">Each evening, check Screen Time (iPhone) or Digital Wellbeing (Android) and type your short-video minutes into <b>Me → Scrolling → Type it in</b>.</p>`;
  }
  return `${toggle}<div class="guide">${body}</div>`;
}
function setupSheet(kind) {
  S.sheetKind = kind;
  openSheet(`${sheetHead(kind === "steps" ? "Sync your steps" : "Track your scrolling")}${setupBody(kind)}
    ${NATIVE ? "" : `<button class="btn green block" style="margin-top:12px" data-act="check-sync" data-kind="${kind}">${ic("refresh")} Check it worked</button>
    <p id="sync-status" class="small muted" style="text-align:center;margin:10px 0 0"></p>`}`);
}
function logSheet(kind) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => { const d = new Date(Date.parse(S.D.today.day + "T12:00:00Z") - i * 86400000).toISOString().slice(0, 10); return [d, i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long" })]; });
  openSheet(`${sheetHead(kind === "steps" ? "Type in your steps" : "Type in your scrolling")}
    <form data-form="log-${kind}">
      <span class="field-label">Day</span>
      <select name="date" class="select">${days.map(([d, l]) => `<option value="${d}">${l}</option>`).join("")}</select>
      <span class="field-label">${kind === "steps" ? "Steps" : "Minutes of TikTok, Reels and Shorts"}</span>
      <input type="number" name="n" inputmode="numeric" min="0" max="${kind === "steps" ? 200000 : 1440}" required placeholder="${kind === "steps" ? "8421" : "45"}">
      <button class="btn green block" style="margin-top:14px">Save</button>
    </form>
    ${kind === "steps" ? `<p class="tiny faint" style="margin:10px 0 0">The number from your phone's Health or Fit app. A synced total for the same day replaces it.</p>` : ""}`);
}
function squadSheet() {
  const sq = squad();
  openSheet(`${sheetHead(sq ? "Switch squad" : "Your squad")}
    ${sq ? `<p class="small muted" style="margin:-4px 0 12px">You can only be in one squad. Joining or making another leaves ${esc(sq.name)}.</p>` : ""}
    <form data-form="squad-create"><span class="field-label">Make a squad</span><div class="row"><input type="text" name="name" maxlength="40" required placeholder="The Lads, Uni Flat, Office 4…" class="grow"><button class="btn green sm">Make</button></div></form>
    <div class="divider"></div>
    <form data-form="squad-join"><span class="field-label">Join with a code</span><div class="row"><input type="text" name="code" maxlength="6" required placeholder="ABC123" class="grow code" autocomplete="off" autocapitalize="characters"><button class="btn blue sm">Join</button></div></form>`);
}
function inviteSheet() {
  const sq = squad(), link = `${APP_URL}?g=${sq.code}`;
  openSheet(`${sheetHead("Invite your mates")}
    <p class="small muted" style="margin:-4px 0 12px">Send this to the group chat. They make their walker and land straight in ${esc(sq.name)}.</p>
    <div class="codebig ol">${sq.code}</div>
    <div class="copybox"><code>${esc(link)}</code><button class="btn xs" data-copy="${esc(link)}">${ic("copy")} Copy</button></div>
    <button class="btn green block" style="margin-top:12px" data-act="share-invite">${ic("share")} Share the link</button>`);
}

// ---------- signing in on another phone ----------
// Squad code → tap your name → your password (set under Me). Or paste a restore link.
async function callAuth(action, body, query = "") {
  const res = await fetch(`${AUTH}/${action}${query}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({ ok: false, error: "Couldn't reach the server" }));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function signedIn(token) {
  saveToken(token);
  await load();
  S.signin = null; S.view = "main"; S.tab = "today";
  render(); scrollTo(0, 0);
  toast(`Welcome back, ${me().name}`);
  refreshPush(); checkAppUpdate(); checkPassword();
}
function viewSignin() {
  const st = S.signin || (S.signin = { step: "code" });
  const head = `<div class="quiz-top"><button class="iconbtn" data-act="signin-back" aria-label="Back">${ic("chevronLeft")}</button><span class="grow"></span></div>`;
  let body;
  if (st.step === "code") body = `<h1 class="ol disp ob-title">Sign in</h1>
    <p class="muted">Already playing on another phone, or got signed out? Find yourself in your squad.</p>
    <form class="panel" data-form="signin-code"><span class="field-label">Your squad code</span><div class="row"><input type="text" name="code" maxlength="6" required placeholder="ABC123" class="grow code" autocomplete="off" autocapitalize="characters" value="${esc(st.code || "")}"><button class="btn blue sm">Next</button></div>
      <p class="tiny faint" style="margin:8px 0 0">It's on Me → your squad, on any squad-mate's phone.</p></form>
    <form class="panel" data-form="signin-link"><span class="field-label">Or paste your restore link</span><div class="row"><input type="text" name="link" required placeholder="https://…?me=…" class="grow" autocomplete="off"><button class="btn sm">Go</button></div></form>`;
  else if (st.step === "who") body = `<h1 class="ol disp ob-title">Which one's you?</h1><p class="muted">${esc(st.squad.name)}</p>
    <div class="mates">${st.people.map((x) => `<button class="mate pick" data-signin="${x.id}"><div class="face has-fallback" style="width:40px;height:40px"><span class="fb">${head2d(answersOf(x))}</span></div><div class="grow"><b>${esc(x.name)}</b><small>${x.has_password ? "Password set" : "No password yet"}</small></div>${ic("arrowRight")}</button>`).join("")}</div>`;
  else {
    const x = st.people.find((p) => p.id === st.id);
    body = `<div class="walker-big has-fallback" style="height:180px;width:160px"><span class="fb">${Walker.svg(answersOf(x), { mood: "fresh" })}</span></div>
      <h1 class="ol disp ob-title" style="text-align:center">Hi, ${esc(x.name)}</h1>
      ${x.has_password ? `<form class="panel" data-form="signin-password"><span class="field-label">Your password</span><input type="password" name="password" required autocomplete="current-password" placeholder="Password"><button class="btn gold block" style="margin-top:12px">Sign in</button></form>`
        : `<div class="guide small">${esc(x.name)} hasn't set a sign-in password yet. On a phone where you're still signed in, go to <b>Me → Sign-in password</b> and set one, then come back. Lost that phone? Ask Kirish for your restore link.</div>`}`;
  }
  $("#app").innerHTML = `<section class="onboard">${head}${body}</section>`;
}
function passwordSheet() {
  openSheet(`${sheetHead(S.hasPassword ? "Change your password" : "Set a sign-in password")}
    <p class="small muted" style="margin:-4px 0 12px">For signing in on a new phone, or if you ever get signed out: <b>Sign in</b> on the welcome screen → your squad code → tap your name → this password.</p>
    <form data-form="set-password"><input type="password" name="password" required minlength="4" maxlength="64" autocomplete="new-password" placeholder="At least 4 characters">
      <input type="password" name="again" required minlength="4" maxlength="64" autocomplete="new-password" placeholder="Same again" style="margin-top:8px">
      <button class="btn green block" style="margin-top:12px">Save</button></form>`);
  setTimeout(() => $("#sheet input")?.focus(), 50);
}
async function checkPassword() {
  if (!S.token) return;
  try { const r = await callAuth("status", { token: S.token }); if (r.has_password !== S.hasPassword) { S.hasPassword = r.has_password; if (S.view === "main" && S.tab === "me" && $("#sheet").hidden) render(); } } catch { /* try again next time */ }
}
const passwordRow = () => `<div class="row spread" style="margin-bottom:12px"><span><b>Sign-in password</b><span class="small muted" style="display:block">${S.hasPassword ? "Set. Use it to sign in on another phone" : "Not set. Set one so you can't get locked out"}</span></span><button class="btn xs ${S.hasPassword ? "" : "gold"}" data-act="password">${S.hasPassword ? "Change" : "Set"}</button></div>`;

// ---------- onboarding ----------
function viewWelcome() {
  const inv = S.invite;
  $("#app").innerHTML = `<section class="welcome">
    <div class="wl-hero"><div class="wl-bosses">${portraitImg("boss", "taxman", { w: 260, h: 280, cls: "b1" })}${portraitImg("boss", "autoplay", { w: 220, h: 240, cls: "b2" })}</div>
      <div class="logo ol">EFFORT</div><p class="tag">Out-walk your mates. Fight the Taxman at 7. Raid together on Sunday.</p></div>
    ${inv ? `<div class="panel invite"><span class="chip gold">${ic("squad")} You're invited</span><h3 class="ol-sm disp">${esc(inv.name)}</h3><p class="small muted">${inv.members} ${inv.members === 1 ? "player" : "players"} already walking.</p></div>` : ""}
    <section class="panel">
      <div class="how">
        <div class="hrow"><span class="hic">${ic("steps")}</span><div><b>Your steps are money</b><span>Every 100 steps is an Effort. Walk more than the squad and you hit harder, earn more and get taxed less.</span></div></div>
        <div class="hrow"><span class="hic">${ic("sword")}</span><div><b>7pm: the Taxman</b><span>Five minutes, every day. Tap him into the ground or he takes his cut.</span></div></div>
        <div class="hrow"><span class="hic">${ic("raid")}</span><div><b>Sunday: the raid</b><span>Fifteen minutes, the whole squad, one boss. The laziest walker gets hunted, and pays the top walker.</span></div></div>
      </div>
    </section>
    <button class="btn gold xl block" data-act="start">${inv ? `Join ${esc(inv.name)}` : "Make my walker"}</button>
    ${inv ? "" : `<form data-form="code" class="row" style="margin-top:12px"><input type="text" name="code" placeholder="Got a squad code?" autocomplete="off" maxlength="6" class="grow code"><button class="btn blue sm">Join</button></form>`}
    <button class="btn block" style="margin-top:12px" data-act="signin">${ic("user")} I already play: sign in</button>
  </section>`;
}
const QUESTIONS = Walker.QUESTIONS;
function viewQuiz() {
  const i = S.qi, q = QUESTIONS[i], a = S.answers;
  const head = `<div class="quiz-top"><button class="iconbtn" data-act="quiz-back" aria-label="Back">${ic("chevronLeft")}</button><div class="xp grow" style="margin:0;height:10px"><i style="width:${(100 * i) / QUESTIONS.length}%"></i></div><span class="small muted num">${i + 1}/${QUESTIONS.length}</span></div>`;
  let body;
  if (q.type === "intro") {
    $("#app").innerHTML = `<section class="quiz">${head}<h1 class="quiz-q ol">What do people call you?</h1>
      <form class="panel" data-form="quiz-intro">
        <span class="field-label">Your name</span><input type="text" name="name" required maxlength="24" placeholder="What your mates call you" value="${esc(a.name || "")}" autocomplete="given-name">
        <span class="field-label">Your phone</span>
        <div class="seg">${[["ios", "iPhone"], ["android", "Android"], ["other", "Other"]].map(([v, l]) => `<button type="button" data-platform="${v}" aria-pressed="${v === S.platform}">${l}</button>`).join("")}</div>
        <button class="btn gold block" style="margin-top:16px">Build my walker ${ic("arrowRight")}</button>
      </form>
      <p class="small faint" style="text-align:center">12 quick ones. They decide your look, your stats and your class.</p></section>`;
    return;
  }
  // A question can show photos instead of emoji (q.pics: answer -> image), with the photo credits under it.
  if (q.type === "choice") body = `<div class="opts ${q.compact ? "compact" : ""} ${q.pics ? "pics" : ""}">${q.options.map(([v, l, e]) => `<button class="opt" data-answer="${esc(v)}" aria-pressed="${String(a[q.id]) === v}">${q.pics?.[v] ? `<img src="${esc(q.pics[v])}" alt="">` : e ? `<span class="e">${e}</span>` : ""}<span>${esc(l)}</span></button>`).join("")}</div>${q.credit ? `<p class="tiny faint credit">${q.credit}</p>` : ""}`;
  else if (q.type === "hue") body = `<input type="range" class="hue-slider" min="0" max="359" value="${a.hue ?? 30}" data-hue aria-label="Colour"><button class="btn gold block" style="margin-top:14px" data-act="quiz-next">This one</button>`;
  else if (q.type === "number") body = `<form data-form="quiz-value"><input name="v" type="number" inputmode="numeric" min="1" max="99" required class="big-input" value="${esc(a.number ?? "")}" placeholder="7" aria-label="Number"><button class="btn gold block" style="margin-top:12px">Next</button></form>`;
  else body = `<form data-form="quiz-value"><input name="v" type="text" maxlength="30" required class="big-input" value="${esc(a.word ?? "")}" placeholder="${esc(q.placeholder)}" autocomplete="off" aria-label="${esc(q.q)}"><button class="btn gold block" style="margin-top:12px">Make me</button></form>`;
  $("#app").innerHTML = `<section class="quiz">${head}<div class="quiz-preview" id="quiz-preview">${Walker.svg(a, { mood: "ok", label: "Your walker so far" })}</div>
    <h1 class="quiz-q ol">${esc(q.q)}</h1>${body}</section>`;
}
function viewReveal() {
  const a = S.answers, st = G.stats(a), cls = G.classOf(st);
  ANS.draft = a;
  $("#app").innerHTML = `<section class="reveal">
    <div class="caps" style="color:var(--gold)">Your walker</div>
    <div class="walker-big has-fallback"><span class="fb">${Walker.svg(a, { mood: "fresh", label: `${a.name}'s walker` })}</span>${portraitImg("walker", "draft" + G.hash(JSON.stringify(a)), { w: 300, h: 340 })}</div>
    <h1 class="ol disp" style="margin:8px 0 2px;font-size:32px">${esc(a.name || "You")}</h1>
    <div class="chip gold" style="margin:4px auto 10px">${esc(cls.name)}</div>
    <p class="small muted" style="margin:0 0 12px">${esc(cls.blurb)} Your top two stats make your class, and your class decides your gear.</p>
    <section class="panel" style="text-align:left">${G.STATS.map((s) => { const [icon, col] = STAT_LOOK[s.id]; return `<div class="stat"><span class="sic" style="background:${col}">${ic(icon)}</span><span class="sn">${s.label}</span><div class="bar"><i class="base" style="--sc:${col};width:${(st[s.id] / 10) * 100}%"></i></div><span class="sv">${st[s.id]}</span></div>`; }).join("")}
      <p class="tiny faint" style="margin:6px 0 0">Everyone has ${G.STAT_TOTAL} points; your answers decide where they go.</p></section>
    <div class="btn-row" style="margin-top:14px"><button class="btn" data-act="quiz-restart">Change answers</button><button class="btn gold" data-act="quiz-done">${S.retake ? "Save my new look" : "That's me"}</button></div>
  </section>`;
  // The draft portrait needs the draft answers.
  ANS["draft" + G.hash(JSON.stringify(a))] = a;
}
function viewSquad() {
  $("#app").innerHTML = `<section class="onboard">
    <div class="dots"><i class="on"></i><i></i><i></i></div>
    <h1 class="ol disp ob-title">Your squad</h1>
    <p class="muted">The whole game is you lot against each other, and together on Sunday. Make a squad and send the link, or join one.</p>
    <form class="panel" data-form="squad-create"><span class="field-label">Make a squad</span><input type="text" name="name" maxlength="40" required placeholder="The Lads, Uni Flat, Office 4…"><button class="btn green block" style="margin-top:12px">${ic("squad")} Make it</button></form>
    <form class="panel" data-form="squad-join"><span class="field-label">Or join one</span><div class="row"><input type="text" name="code" maxlength="6" required placeholder="ABC123" class="grow code" autocomplete="off" autocapitalize="characters"><button class="btn blue sm">Join</button></div></form>
    <button class="btn block" data-act="skip-squad">Do it later</button>
  </section>`;
}
function viewSetup() {
  const step = S.setupStep;
  $("#app").innerHTML = `<section class="onboard">
    <div class="dots"><i class="on"></i><i class="on"></i><i class="${step === "remind" ? "on" : ""}"></i></div>
    ${step === "steps" && NATIVE ? `<h1 class="ol disp ob-title">Connect your phone</h1>
      <p class="muted">Two taps. Your steps and scrolling count by themselves from then on.</p>
      <section class="panel"><span class="field-label">Steps</span>${nativeSetup("steps")}<span class="field-label">Scrolling (optional)</span>${nativeSetup("scroll")}</section>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="setup-next">Do it later</button><button class="btn gold" data-act="setup-next">Next ${ic("arrowRight")}</button></div>`
    : step === "steps" ? `<h1 class="ol disp ob-title">Sync your steps</h1>
      <p class="muted">Set it up once and your steps flow in on their own. About three minutes.</p>
      ${setupBody("steps")}
      <button class="btn green block" style="margin-top:14px" data-act="check-sync" data-kind="steps">${ic("refresh")} Check it worked</button>
      <p id="sync-status" class="small muted" style="text-align:center;margin:10px 0"></p>
      <div class="btn-row"><button class="btn" data-act="setup-next">Do it later</button><button class="btn gold" data-act="setup-next">Next ${ic("arrowRight")}</button></div>`
    : `<h1 class="ol disp ob-title">Don't miss 7pm</h1>
      <p class="muted">The Taxman is only around for five minutes a day, and the raid for fifteen on Sunday. We'll ping you at 6:45pm.</p>
      ${pushBlock()}
      <span class="field-label">Or put them in your calendar</span>
      ${reminderButtons()}
      <span class="field-label">So you can't get locked out</span>
      ${S.hasPassword ? `<span class="chip green">${ic("check")} Sign-in password set</span>` : `<button class="btn sm block" data-act="password">${ic("lock")} Set a sign-in password</button>`}
      <p class="small faint" style="margin:14px 0">Tip: add Effort to your home screen (Share → Add to Home Screen on iPhone, ⋮ → Add to Home screen on Android) so it opens like an app.</p>
      <button class="btn gold xl block" data-act="setup-done">Let's go ${ic("arrowRight")}</button>`}
  </section>`;
}

// The quiz is done: make the player (joining the invite's squad if there is one), or save a new look.
async function finishQuiz() {
  const { name, ...character } = S.answers;
  if (S.retake) {
    await call("update_me", { token: S.token, character });
    S.retake = false; store.del("draftAnswers");
    await load(); S.view = "main"; S.tab = "me"; render(); toast("New look saved");
    return;
  }
  const body = { name, character, platform: S.platform, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const r = S.invite ? await call("join", { ...body, code: S.invite.code }) : await call("signup", body);
  saveToken(r.player.token);
  store.del("draftAnswers");
  await load();
  S.view = S.invite ? "setup" : "squad"; S.setupStep = "steps"; S.invite = null;
  S.hasPassword = false;
  refreshPush();
  render(); scrollTo(0, 0);
}
function quizAdvance() {
  store.set("draftAnswers", S.answers);
  if (S.qi < QUESTIONS.length - 1) { S.qi++; render(); scrollTo(0, 0); }
  else { S.view = "reveal"; render(); scrollTo(0, 0); }
}
async function lookupInvite(code) {
  const b = await call("board", null, `?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  return { code: b.group.code, name: b.group.name, members: b.players.length };
}

// ---------- shared battle bits ----------
function banner(text, small = "") {
  const el = document.createElement("div");
  el.className = "banner"; el.innerHTML = `<span>${esc(text)}</span>${small ? `<small>${esc(small)}</small>` : ""}`;
  $("#arena")?.appendChild(el);
  setTimeout(() => el.remove(), 1250);
}
const use3d = () => !store.get("no3d") && !V.no3d && window.Arena3D && Arena3D.supported();
function make3d(opts) {
  try { return Arena3D.create($("#stage"), opts); }
  catch (err) { console.warn("3D arena unavailable, using 2D", err); V.no3d = true; return null; }
}
const arena = () => (V.tax && V.tax.A) || (V.raid && V.raid.A) || null;
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
async function startTax() {
  FX.unlock();
  if (S.busy) return;
  S.busy = true;
  let r;
  try { r = await call("tax_start", { token: S.token }); }
  catch (e) { toast(e.message); await refresh(true); return; }
  finally { S.busy = false; }
  S.skew = r.now - Date.now();
  const T = G.taxmanSetup(r.inputs);
  // The server locked in tonight's terms when the fight opened.
  T.taxRate = Number(r.fight.rate); T.stealCap = Number(r.fight.steal_cap);
  const left = (Date.parse(r.fight.ends_at) - now()) / 1000;
  T.seconds = left;
  V.tax = { B: G.taxmanStart(T), S: T, left, last: performance.now(), taps: 0, lvlBefore: level(), checkAt: 10 };
  // Coming back to a fight in progress: carry on from what the server saved.
  if (r.resumed) V.tax.B.dmg = T.hp * Number(r.fight.knocked);
  S.view = "tax";
  render();
  V.tax.timer = setInterval(taxTick, 50);
  FX.play("roar");
  setTimeout(() => banner("Fight!", `${Math.round(T.taxRate * 100)}% of your Efforts on the line`), 150);
}
function renderTax() {
  const T = V.tax.S, three = use3d();
  $("#app").innerHTML = `<div class="arena tax" id="arena"><div class="shake-wrap" id="shake">
    <div class="hud">
      <div class="bossbar"><div class="por">${ic("receipt")}<span class="lv">${Math.round(T.taxRate * 100)}% TAX</span></div>
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
  if (three) { V.tax.A = make3d({ mode: "tax", boss: { id: "taxman" }, team: [{ id: me().id, you: true, answers: ANS[me().id], pos: "front" }] }); if (!V.tax.A) return renderTax(); }
  paintTax();
}
function taxTick() {
  const v = V.tax; if (!v) return;
  const t = performance.now(), dt = Math.min(0.25, (t - v.last) / 1000);
  v.last = t; v.left -= dt;
  G.taxmanStep(v.B, dt);
  for (const e of v.B.fx.splice(0)) {
    if (e.type === "audit") { FX.play("audit"); banner("Audit!", "Only the weak spot takes damage"); $("#dome").hidden = false; }
    if (e.type === "auditEnd") $("#dome").hidden = true;
    if (e.type === "receipt") FX.play("receipt");
    if (e.type === "ko") {
      FX.play("ko"); banner("K.O.!", "Now rob him blind");
      if (v.A) v.A.bossKO();
      const [x, y] = bossXY(0.5); FX.coins(x, y, 26); FX.ring(x, y, { r1: 260, color: "rgba(255,210,80,.9)", width: 16 }); FX.shake($("#shake"), 14, 500);
      saveTax(false).catch(() => {});
    }
  }
  // Save progress every 10 seconds, so a dropped connection or a closed app doesn't lose the fight.
  if (v.B.t >= v.checkAt) { v.checkAt += 10; saveTax(false).catch(() => {}); }
  if (v.left <= 0) return finishTax();
  paintTax();
}
// The final save happens after V.tax is cleared, so it can be handed the fight.
function saveTax(final, v = V.tax) {
  const r = G.taxmanResult(v.B);
  return call("tax_finish", { token: S.token, knocked: r.knocked, steal_pct: r.stealPct, taps: v.B.taps, final });
}
function paintTax() {
  const v = V.tax, B = v.B, T = v.S, r = G.taxmanResult(B);
  const clock = $("#t-clock");
  clock.textContent = mmss(v.left); clock.parentElement.classList.toggle("low", v.left <= 30);
  setBar($("#t-hp"), 1 - B.dmg / T.hp, r.beaten ? "KNOCKED OUT · NO TAX" : `${fmt(Math.max(0, T.hp - B.dmg))} · TAX ${Math.round(T.taxRate * 100 * (1 - r.knocked))}%`);
  setBar($("#t-steal"), r.stealPct / T.stealCap, r.beaten ? `STOLEN ${Math.round(r.stealPct * 100)}% · +${r.stolen} EFFORTS` : "KNOCK HIM OUT TO START STEALING");
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
  v.A?.heroAttack(me().id, { crit: hit.crit || hit.kind === "weak" });
  if (hit.kind !== "blocked") bossHurt(hit.crit || hit.kind === "weak");
}
async function finishTax() {
  const v = V.tax; if (!v || v.ending) return;
  v.ending = true;
  clearInterval(v.timer);
  const r = G.taxmanResult(v.B);
  r.taps = v.B.taps; r.crits = v.B.crits; r.weak = v.B.weak; r.receipts = v.B.receipts;
  v.A?.dispose(); FX.destroy();
  V.tax = null;
  S.view = "result";
  V.result = { kind: "tax", r, net: null, lvlBefore: v.lvlBefore };
  render();
  try { const res = await saveTax(true, v); V.result.net = res.net ?? r.net; } catch (e) { toast(`Couldn't save the fight: ${e.message}`); V.result.net = r.net; }
  FX.play(r.beaten ? "win" : "lose");
  countUp($("#count"), V.result.net);
}

// ---------- Sunday: the live squad raid ----------
let SB = null;
const realtime = () => SB || (SB = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 40 } } }));
async function joinRaid() {
  FX.unlock();
  if (S.busy) return;
  S.busy = true;
  let r;
  try { r = await call("raid_join", { token: S.token }); }
  catch (e) { toast(e.message); await refresh(true); return; }
  finally { S.busy = false; }
  S.skew = r.now - Date.now();
  if (r.raid.status === "done") { showRaidResult(r.raid.result, null); return; }
  if (!window.supabase) { toast("Couldn't load the live connection. Check your signal and try again."); return; }
  for (const m of r.roster) ANS[m.id] = m.answers && m.answers.time ? m.answers : Walker.fallbackAnswers(m.id);
  V.raid = {
    raid: r.raid, roster: Object.fromEntries(r.roster.map((m) => [m.id, m])), my: r.me, R: null, host: false, A: null,
    present: {}, heard: {}, tapBudget: {}, joinedAt: now(), out: { taps: 0, ab: false, move: null, ans: null }, fxOut: [], snapAt: 0,
    lastSent: 0, lastSave: now(), q: null, taps: 0, lvlBefore: level(), rosterKey: "",
  };
  S.view = "raid";
  render();
  connectRaid();
  V.raid.timer = setInterval(raidTick, 50);
}
function connectRaid() {
  const v = V.raid;
  const ch = realtime().channel(`raid-${v.raid.id}`, { config: { broadcast: { self: false }, presence: { key: v.my } } });
  v.ch = ch;
  ch.on("broadcast", { event: "st" }, ({ payload }) => onSnapshot(payload))
    .on("broadcast", { event: "in" }, ({ payload }) => onInput(payload))
    .on("broadcast", { event: "end" }, ({ payload }) => onEnd(payload))
    .on("presence", { event: "sync" }, () => { v.present = Object.fromEntries(Object.entries(ch.presenceState()).map(([k, arr]) => [k, Math.min(...arr.map((x) => x.at || 0))])); elect(); })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") ch.track({ at: v.joinedAt });
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") toast("Live connection dropped. Reconnecting…");
    });
}
// The host is whoever's been here longest and is still sending. Everyone works it out the same way.
// Anyone ahead of you who has gone quiet for 4 seconds (a frozen or locked phone) is skipped.
function elect() {
  const v = V.raid; if (!v || v.ended) return;
  const t = now(), patient = t - v.joinedAt < 4000;
  const ids = Object.keys(v.present).sort((a, b) => v.present[a] - v.present[b] || (a < b ? -1 : 1));
  const host = ids.find((id) => id === v.my || patient || t - (v.heard[id] || 0) < 4000);
  if (host === v.my && !v.host) becomeHost();
  else if (host && host !== v.my && v.host) { v.host = false; }
  if (v.host) syncMembers();
}
function becomeHost() {
  const v = V.raid;
  v.host = true;
  const started = Date.parse(v.raid.started_at), ends = Date.parse(v.raid.ends_at);
  let R = v.R;
  if (!R && v.raid.snapshot) R = G.raidImport(v.raid.snapshot);
  if (!R) {
    const here = Object.keys(v.present).filter((id) => v.roster[id]);
    R = G.raidCreate((here.length ? here : [v.my]).map(fighter), { seed: Number(v.raid.seed), tier: v.raid.tier, minutes: G.RULES.raidMin });
  }
  R.dur = (ends - started) / 1000;
  R.t = Math.max(R.t, (now() - started) / 1000);
  v.R = R; v.hostLast = performance.now();
  syncMembers();
}
// A squad member as a fighter, with the stride and title the server worked out for the whole squad.
function fighter(id) {
  const m = V.raid.roster[id];
  return { id, name: m.name, stats: m.stats, equipped: m.equipped, inv: m.inv, pos: m.pos, weekSteps: m.weekSteps, stride: m.stride, title: m.title };
}
// Host: people who turn up join the fight; people who drop out stop being targets until they're back.
function syncMembers() {
  const v = V.raid, R = v.R; if (!R || R.over) return;
  for (const id of Object.keys(v.present)) if (v.roster[id] && !R.members.some((m) => m.id === id)) G.raidAddMember(R, fighter(id));
  for (const m of R.members) m.away = !(m.id in v.present);
}
// Nobody taps faster than about 15 times a second; anything beyond that from a squad-mate's phone is dropped.
const TAPS_PER_SEC = 15;
function onInput(p) {
  const v = V.raid; if (!v?.host || !v.R || !p || !v.roster[p.id]) return;
  const R = v.R, t = performance.now(), b = (v.tapBudget[p.id] ??= { left: TAPS_PER_SEC, at: t });
  b.left = Math.min(TAPS_PER_SEC, b.left + ((t - b.at) / 1000) * TAPS_PER_SEC); b.at = t;
  const taps = Math.min(Math.floor(b.left), Math.max(0, p.taps | 0));
  b.left -= taps;
  for (let i = 0; i < taps; i++) G.raidTap(R, p.id);
  if (p.ab) G.raidAbility(R, p.id);
  if (p.move) G.raidMove(R, p.id, p.move);
  if (p.ans != null) G.raidAnswer(R, p.id, String(p.ans).slice(0, 40));
}
function onSnapshot(p) {
  const v = V.raid; if (!v || v.ended || !p?.R) return;
  if (v.host && p.host !== v.my) {
    // Two hosts for a moment (we both joined at once): the one who's been here longer keeps it.
    if ((v.present[p.host] ?? Infinity) <= (v.present[v.my] ?? Infinity)) v.host = false;
    else return;
  }
  v.snapAt = now(); v.heard[p.host] = v.snapAt;
  const R = G.raidImport(p.R);
  const grew = !v.R || R.members.length !== v.R.members.length;
  v.R = R;
  for (const e of p.fx || []) { if (e.type === "tap" && e.id === v.my) continue; raidFx(e); }
  if (grew) render(); else paintRaid();
}
function onEnd(p) {
  const v = V.raid; if (!v || v.ended) return;
  if (p?.result) showRaidResult(p.result, v);
}
function raidTick() {
  const v = V.raid; if (!v || v.ended) return;
  const t = now();
  if (v.host && v.R) {
    const R = v.R, pn = performance.now();
    let dt = (pn - v.hostLast) / 1000; v.hostLast = pn;
    while (dt > 0 && !R.over) { G.raidStep(R, Math.min(0.25, dt)); dt -= 0.25; }
    const fx = R.fx.splice(0);
    for (const e of fx) raidFx(e);
    v.fxOut.push(...fx.filter((e) => e.type !== "tap" || e.crit || e.swing || Math.random() < 0.5));
    if (t - v.lastSent >= 150 || R.over) {
      v.lastSent = t;
      v.ch?.send({ type: "broadcast", event: "st", payload: { host: v.my, R: G.raidExport(R), fx: v.fxOut.splice(0, 40) } });
      v.fxOut.length = 0;
    }
    if (t - v.lastSave > 15000) { v.lastSave = t; call("raid_sync", { token: S.token, raid_id: v.raid.id, snapshot: G.raidExport(R) }).then((r) => { if (r.status === "done" && r.result) showRaidResult(r.result, v); }).catch(() => {}); }
    if (R.over) return hostFinish();
    if (rosterKey(R) !== v.rosterKey) return render();
  } else {
    // Not the host: send what you did since the last message.
    const o = v.out;
    if ((o.taps || o.ab || o.move || o.ans != null) && t - v.lastSent >= 120) {
      v.lastSent = t;
      v.ch?.send({ type: "broadcast", event: "in", payload: { id: v.my, ...o } });
      v.out = { taps: 0, ab: false, move: null, ans: null };
    }
    // The host has gone quiet: work out who takes over (maybe us, from the last snapshot).
    if (t - v.snapAt > 4000) elect();
    // The fight's over and the host vanished before paying out: report it ourselves.
    if (v.R && (v.R.over || t > Date.parse(v.raid.ends_at) + 8000) && t - v.snapAt > 5000 && !v.finishing) reportRaid(v.R);
  }
  if (v.R) paintRaid();
}
const rosterKey = (R) => R.members.map((m) => m.id).join(",");
async function hostFinish() {
  const v = V.raid; if (v.finishing) return;
  v.finishing = true;
  clearInterval(v.timer);
  const R = v.R;
  if (v.A && R.result.how === "won") { v.A.bossKO(); banner("K.O.!", `${R.boss.name} is down`); FX.play("ko"); }
  const result = await reportRaid(R);
  if (result) v.ch?.send({ type: "broadcast", event: "end", payload: { result } });
  setTimeout(() => showRaidResult(result, v), R.result?.how === "won" ? 1600 : 200);
}
async function reportRaid(R) {
  const v = V.raid; if (!v) return null;
  v.finishing = true;
  const res = R.result || { how: R.boss.hp <= 0 ? "won" : "timeout" };
  try {
    const r = await call("raid_finish", { token: S.token, raid_id: v.raid.id, how: res.how, frac: 1 - R.boss.hp / R.boss.max, paralysed: !!R.paralysed, deepDive: R.deepDive || 0,
      members: R.members.map((m) => ({ id: m.id, dmg: Math.round(m.dmg), healed: m.healed, taken: m.taken })) });
    if (!v.host) showRaidResult(r.result, v);
    return r.result;
  } catch (e) { toast(e.message); v.finishing = false; return null; }
}
function leaveRaid() {
  const v = V.raid; if (!v) return;
  v.ended = true;
  clearInterval(v.timer);
  try { v.ch?.unsubscribe(); } catch { /* already gone */ }
  v.A?.dispose(); FX.destroy();
  V.raid = null;
}
function showRaidResult(result, v) {
  const R = v?.R || null, lvlBefore = v?.lvlBefore ?? level();
  if (V.raid) leaveRaid();
  if (!result) { S.view = "main"; refresh(true).then(render); return; }
  V.result = { kind: "raid", out: result, R, lvlBefore };
  S.view = "result";
  render();
  FX.play(result.how === "won" ? "win" : "lose");
}
function renderRaid() {
  const v = V.raid, R = v.R, three = use3d();
  if (!R) {
    $("#app").innerHTML = `<div class="arena raid" id="arena"><div class="lobby"><div class="spinner"></div><h2 class="ol disp">Finding your squad…</h2><p class="muted small">The fight starts as soon as you're connected.</p>
      <button class="btn sm" data-act="raid-quit">Leave</button></div></div>`;
    return;
  }
  v.rosterKey = rosterKey(R);
  v.A?.dispose(); v.A = null; FX.destroy();
  $("#app").innerHTML = `<div class="arena raid" id="arena"><div class="shake-wrap" id="shake">
    <div class="hud">
      <div class="bossbar"><div class="por">${ic("raid")}<span class="lv">LV ${R.lvl.toFixed(1)}</span></div>
        <div class="nm"><b class="ol-sm">${esc(R.boss.name)}</b><small>Boss ${R.tier} · ${R.members.filter((m) => !m.away).length} fighting</small></div>
        <div class="right"><span class="timer">${ic("clock")}<span id="r-clock"></span></span><button class="hbtn" data-act="raid-quit" aria-label="Leave the raid">${ic("close")}</button></div></div>
      <div class="hp" id="r-hp"><i class="ghost"></i><i class="fill"></i><div class="ticks"></div><span></span></div>
    </div>
    <div class="tele idle" id="tele"><span class="ti">${ic("eye")}</span><span class="tt"></span><i class="cd"></i></div>
    <div class="arena-stage" id="stage">${three ? '<div id="plates"></div>' : `<div class="boss2d" id="boss">${Walker.boss(1, false)}</div>`}<div class="combo" id="combo"></div><div class="taphint" id="hint">${ic("target")} Tap the boss</div></div>
    ${three ? "" : `<div class="party2d">${R.members.map((m) => `<div class="m" id="m-${m.id}"><div class="f">${head2d(ANS[m.id])}</div>${esc(m.id === v.my ? "You" : m.name)}</div>`).join("")}</div>`}
    <div class="foot"><div class="log" id="feed"></div>
      <div class="controls"><button class="ability" id="ab" data-act="ability" aria-label="Ability"><span class="cdv"></span><span class="ic-slot"></span><span class="secs"></span><span class="al"></span></button>
        <div class="rows">${G.POSITIONS.map((p) => `<button data-move="${p.id}" aria-label="Move to ${p.label}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div></div>
    </div>
  </div><div id="trivia"></div><div id="veil"></div></div>`;
  FX.init($("#arena"));
  if (three) {
    v.A = make3d({ mode: "raid", boss: { id: R.boss.id }, team: R.members.map((m) => ({ id: m.id, you: m.id === v.my, answers: ANS[m.id], pos: m.pos })) });
    if (!v.A) return renderRaid();
    $("#plates").innerHTML = R.members.map((m) => `<div class="plate ${m.id === v.my ? "me" : ""} ${m.title || ""}" id="np-${m.id}">${m.title === "top" ? `<span class="tt">${ic("crown")}</span>` : m.title === "last" ? `<span class="tt">${ic("warning")}</span>` : ""}${esc(m.id === v.my ? "You" : m.name)}<span class="st"></span><i><s></s></i></div>`).join("");
  }
  v.abRow = null; v.q = null;
  if (!v.toasted) {
    v.toasted = true;
    const mine = R.members.find((m) => m.id === v.my) || v.roster[v.my];
    setTimeout(() => toast(mine.title === "top" ? `Top walker this week: you hit ×${mine.stride.toFixed(2)}` : mine.title === "last" ? `Dead weight this week: ×${mine.stride.toFixed(2)} power, and the boss knows it` : `Your steps give you ×${mine.stride.toFixed(2)} power`), 900);
    FX.play("roar"); setTimeout(() => banner(R.boss.name, R.boss.title), 150);
  }
  paintRaid();
}
const mateEl = (id) => $(`#np-${id}`) || $(`#m-${id}`);
const mateXY = (id) => { const A = arena(); if (A) return toArena(A.screenOf(id, 0.75)); return mateEl(id) ? FX.centre(mateEl(id)) : [0, 0]; };
function raidFx(e) {
  const v = V.raid; if (!v || !$("#arena")) return;
  const R = v.R, A = v.A, my = v.my;
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
      if (e.id === my) { FX.flash($("#arena")); FX.play("hurt"); FX.buzz(40); }
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
    case "answered": if (e.id !== my) FX.play(e.valid ? "tap" : "blocked"); break;
    case "triviaDone": FX.play(e.failed ? "wrong" : "right"); if (e.dive) { FX.number(bx, by, `-${fmt(e.dive)}`, { size: 38, grad: ["#c8f7ff", "#2bb3ff"] }); FX.sparks(bx, by, "#6fd4ff", 24, 600); bossHurt(true); } break;
    case "paralysed": FX.play("stun"); banner("Paralysed", `${fmt(G.RULES.paralysedSteps)} steps down tomorrow`); break;
    case "end": break;
  }
}
function paintRaid() {
  const v = V.raid; if (!v?.R || !$("#r-hp")) return;
  const R = v.R, B = R.boss, mine = R.members.find((m) => m.id === v.my);
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
    el.classList.toggle("away", !!m.away);
    if (v.A) {
      const pt = v.A.screenOf(m.id, 1.05);
      if (pt) el.style.transform = `translate(${pt[0]}px, ${pt[1]}px) translate(-50%, -100%)`;
      const bar = el.querySelector("s");
      bar.style.width = `${f * 100}%`;
      bar.style.background = f > 0.5 ? "var(--green)" : f > 0.25 ? "var(--gold)" : "var(--red)";
      const st = m.away ? "eye" : !m.alive ? "skull" : R.t < m.stunUntil ? "bolt" : R.t < m.shieldUntil ? "guard" : m.swing ? "fire" : "";
      const stEl = el.querySelector(".st");
      if (stEl.dataset.s !== st) { stEl.dataset.s = st; stEl.innerHTML = st ? ic(st) : ""; }
    }
  }
  const ab = $("#ab");
  if (!mine) { ab.disabled = true; hint(`${ic("squad")} Joining the fight…`); }
  else {
    const p = G.posOf(mine.pos), cd = Math.max(0, mine.cdUntil - R.t), total = G.abilityCd(mine);
    if (v.abRow !== mine.pos) { v.abRow = mine.pos; ab.querySelector(".ic-slot").innerHTML = ic(ROW_ICON[mine.pos]); ab.querySelector(".al").textContent = p.ability; }
    ab.querySelector(".secs").textContent = cd > 0 ? Math.ceil(cd) : "";
    ab.querySelector(".ic-slot").style.opacity = cd > 0 ? 0.25 : 1;
    ab.style.setProperty("--cd", `${cd > 0 ? (cd / total) * 360 : 0}deg`);
    ab.disabled = cd > 0 || !mine.alive;
    ab.classList.toggle("ready", cd <= 0 && mine.alive && R.t >= mine.stunUntil);
    document.querySelectorAll("[data-move]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.move === mine.pos)));
    if (!mine.alive) hint(`${ic("skull")} You're down. Answer your question`);
    else if (R.t < mine.stunUntil) hint(`${ic("bolt")} Paralysed`);
    else if (R.t < mine.moveUntil) hint(`${ic("arrowRight")} Moving rows`);
    else if (mine.swing) hint(`${ic("fire")} Big swing: ${mine.swing} hits left`);
    else if (v.taps >= 6) hint(null);
    paintCombo(mine.combo, 1 + mine.combo / (G.RULES.comboMax * 2));
  }
  $("#feed").innerHTML = R.log.slice(0, 2).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join("");
  const veil = $("#veil");
  const want = !mine ? "" : mine.alive && R.t < mine.stunUntil ? "stun" : !mine.alive ? "down" : "";
  if (veil.dataset.s !== want || want === "stun") {
    veil.dataset.s = want;
    veil.innerHTML = want === "stun" ? `<div class="veil stun"><b class="ol">Paralysed<br>${Math.ceil(mine.stunUntil - R.t)}s</b></div>` : want === "down" ? '<div class="veil down"></div>' : "";
  }
  paintTrivia();
}
function paintTrivia() {
  const v = V.raid, R = v.R, T = R.trivia, box = $("#trivia");
  const mineP = T?.per[v.my];
  if (!T || !mineP) { if (box.innerHTML) box.innerHTML = ""; v.q = null; return; }
  const Q = mineP.q, key = `${R.triviaRuns}`;
  if (v.q !== key) {
    v.q = key; v.ticked = 0; v.sentAns = false;
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
  clock.querySelector("span").innerHTML = mineP.ans || v.sentAns ? ic("check") : Math.ceil(left);
  if (!mineP.ans && !v.sentAns && left <= 5 && Math.ceil(left) !== v.ticked) { v.ticked = Math.ceil(left); FX.play("tick"); }
  const wrong = Object.values(T.per).filter((p) => p.ans && !p.ans.valid).length;
  $("#tv-votes").innerHTML = R.members.filter((m) => T.per[m.id]).map((m) => {
    const a = T.per[m.id].ans;
    return `<span class="vote ${a ? (a.valid ? "ok" : "no") : ""}">${esc(m.id === v.my ? "You" : m.name)} ${a ? ic(a.valid ? "check" : "close") : "…"}</span>`;
  }).join("") + `<span class="vote" style="background:none">${wrong} of ${Object.keys(T.per).length} wrong</span>`;
  const mine = mineP.ans || v.localAns;
  if (mine) {
    const form = $("#trivia form"); if (form) form.remove();
    $("#tv-verdict").innerHTML = mine.valid
      ? `<b>${esc(mine.canon)}</b> <span class="rar r${mine.rarity}">${["", "Obvious", "Decent", "Rare"][mine.rarity]}</span> <span class="muted">Waiting for the squad…</span>`
      : `<b>${esc(mine.text || "No answer")}</b> doesn't count. <span class="muted">Deep cuts: ${esc(Q.examples.join(", "))}</span>`;
  }
}
function raidTapEvent(e) {
  const v = V.raid; if (!v?.R) return;
  const mine = v.R.members.find((m) => m.id === v.my);
  if (!mine || !mine.alive || v.R.t < mine.stunUntil || v.R.t < mine.moveUntil || v.R.over) return;
  const [x, y] = FX.local(e.clientX, e.clientY);
  v.taps++;
  let hit;
  if (v.host) { hit = G.raidTap(v.R, v.my); if (!hit) return; }
  else {
    // The host decides the real hit; show a fair estimate straight away so tapping feels instant.
    v.out.taps++;
    const swing = mine.swing > 0;
    hit = { dmg: (20 + mine.g.power * 4) * mine.stride * G.posOf(mine.pos).mult * (1 + mine.combo / (G.RULES.comboMax * 2)) * (swing ? 3 : 1), crit: false, swing };
  }
  FX.tapHit(x, y, { crit: hit.crit, dmg: hit.dmg, color: hit.swing ? "#ff9f43" : "#ffd166" });
  FX.play(hit.crit || hit.swing ? "crit" : "hit");
  if (hit.crit || hit.swing) { FX.shake($("#shake"), hit.swing ? 9 : 5, 180); FX.buzz(18); } else FX.buzz(5);
  v.A?.heroAttack(v.my, { crit: hit.crit, big: hit.swing });
  bossHurt(hit.crit || hit.swing);
}
function raidAct(kind, val) {
  const v = V.raid; if (!v?.R) return;
  if (v.host) {
    if (kind === "ab") G.raidAbility(v.R, v.my);
    if (kind === "move") G.raidMove(v.R, v.my, val);
    if (kind === "ans") return G.raidAnswer(v.R, v.my, val);
  } else {
    if (kind === "ab") v.out.ab = true;
    if (kind === "move") v.out.move = val;
    if (kind === "ans") {
      v.out.ans = val; v.sentAns = true;
      // Check it here too, so you see straight away whether it counts.
      const p = v.R.trivia?.per[v.my];
      if (p) { v.localAns = { text: val, ...p.q.check(val) }; return v.localAns; }
    }
  }
  return null;
}

// ---------- results ----------
function renderResult() {
  const res = V.result;
  let body, won, title, sub;
  if (res.kind === "tax") {
    const r = res.r; won = r.beaten;
    title = won ? "Victory" : "Taxed";
    sub = `${fmt(r.taps)} taps · ${r.crits} crits · ${r.weak} weak-spot hits · ${r.receipts} receipt${r.receipts === 1 ? "" : "s"}`;
    body = `<section class="panel">
        <div class="rline plus"><span>Earned from steps so far</span><span class="rv">+${effortTag(r.earned)}</span></div>
        <div class="rline minus"><span>Taxman took · ${Math.round(r.taxRate * (1 - r.knocked) * 100)}%</span><span class="rv">−${effortTag(r.taxed)}</span></div>
        <div class="rline plus"><span>Stolen back · ${Math.round(r.stealPct * 100)}%</span><span class="rv">+${effortTag(r.stolen)}</span></div>
        <div class="rline total"><span class="disp" style="font-size:18px">Banked</span><span class="rv">${coin(26)}<span id="count">${res.net == null ? "…" : "0"}</span></span></div>
        <p class="tiny faint" style="margin:8px 0 0">Keep walking: steps after 7pm pay out after midnight on these terms.</p>
      </section>`;
  } else {
    const out = res.out, my = me().id, mine = out.shares.find((s) => s.id === my), T = res.R?.lastTrivia;
    const nm = (id) => (id === my ? "you" : out.names?.[id] || out.shares.find((x) => x.id === id)?.name || "someone");
    won = out.how === "won";
    title = { won: "Victory", timeout: "Time up", wiped: "Defeat" }[out.how];
    sub = `${esc(out.boss)} · ${Math.round(out.frac * 100)}% dealt`;
    body = `${out.paralysed ? `<section class="panel" style="border-color:var(--red)"><div class="row">${ic("bolt")}<b class="disp">Paralysed.</b><span class="small muted">Everyone who fought starts tomorrow ${fmt(G.RULES.paralysedSteps)} steps down.</span></div></section>` : ""}
      <section class="panel"><table class="rtable"><tr><th>Squad</th><th>Steps</th><th>Damage</th><th>Loot</th><th>Tax</th></tr>
        ${[...out.shares].sort((a, b) => b.weekSteps - a.weekSteps).map((s) => `<tr class="${s.id === my ? "me" : ""}"><td>${s.title === "top" ? ic("crown") + " " : s.title === "last" ? ic("warning") + " " : ""}${esc(s.id === my ? "You" : s.name)}</td><td>${fmt(s.weekSteps / 1000)}k</td><td>${fmt(s.dmg)}</td><td>${fmt(s.reward)}</td><td style="color:${s.tax > 0 ? "var(--green)" : s.tax < 0 ? "var(--red)" : "inherit"}">${s.tax > 0 ? "+" : s.tax < 0 ? "−" : ""}${s.tax ? fmt(Math.abs(s.tax)) : "–"}</td></tr>`).join("")}</table>
        ${out.settle ? `<p class="small muted" style="margin:10px 0 0">${ic("coins")} Weekly settlement: ${esc(nm(out.settle.from))} (lowest walker) paid ${esc(nm(out.settle.to))} ${fmt(out.settle.amount)} Efforts.</p>` : ""}</section>
      ${T ? `<section class="panel"><div class="ptitle"><h2 class="ol-sm">Last trivia · ${T.n - T.wrong}/${T.n} right</h2>${T.failed ? `<span class="side chip red">Paralysed</span>` : `<span class="side chip green">Passed</span>`}</div>
        ${T.results.map((q) => `<div class="rline"><span class="grow"><b>${esc(q.id === my ? "You" : q.name)}</b> · ${esc(q.q)}<br><span class="small muted">“${esc(q.ans.text || "no answer")}” · deep cuts: ${esc(q.examples.join(", "))}</span></span><span class="rv" style="color:${q.ans.valid ? "var(--green)" : "var(--red)"}">${ic(q.ans.valid ? "check" : "close")}</span></div>`).join("")}</section>` : ""}
      <section class="panel"><div class="rline total" style="border-top:0;margin-top:0"><span class="disp" style="font-size:18px">Your share</span><span class="rv">${coin(26)}<span id="count">0</span></span></div>
        ${!mine ? `<div class="small muted">You weren't in this one.</div>` : ""}${won ? `<div class="small muted">Next Sunday: ${esc(G.bossFor(out.tier + 1).name)}</div>` : ""}</section>`;
  }
  $("#app").innerHTML = `<div class="results ${won ? "" : "lost"}" id="arena"><div class="inner">
    <div class="ribbon ol">${title}</div>
    <div class="subline">${sub}</div>
    <div class="stack">${body}
      <section class="panel"><div class="row spread"><b class="disp" style="font-size:17px" id="lvl-now">Level ${res.lvlBefore}</b></div><div class="xp" style="height:10px"><i style="width:0%"></i></div><div id="lvlup"></div></section>
      <button class="btn gold xl block" data-act="collect">${ic("coins")} Collect</button>
    </div></div></div>`;
  if (res.kind === "raid") { const mine = res.out.shares.find((s) => s.id === me().id); countUp($("#count"), mine ? mine.total : 0); }
  FX.init($("#arena"));
  if (won) setTimeout(() => FX.confetti(140), 250);
}
function countUp(el, to) {
  if (!el) return;
  const start = performance.now(), dur = 900;
  const step = (t) => { const k = Math.min(1, (t - start) / dur), v = Math.round(to * (1 - (1 - k) ** 3)); el.textContent = (v < 0 ? "−" : "") + fmt(Math.abs(v)); if (k < 1) requestAnimationFrame(step); else FX.play(to < 0 ? "lose" : "coin"); };
  requestAnimationFrame(step);
}
// The money's already in the wallet (the server paid it); this pulls the new balance and shows any level-up.
async function collect() {
  const res = V.result; if (!res || res.collected) return;
  res.collected = true;
  const btn = $("[data-act=collect]"), [x, y] = FX.centre(btn);
  FX.coins(x, y, 30, x, -40); FX.play("coin");
  btn.disabled = true;
  try { await load(); } catch (e) { toast(e.message); }
  btn.disabled = false;
  const p = G.levelProgress(S.D.xp);
  $(".results .xp i").style.width = `${p.pct * 100}%`;
  $("#lvl-now").textContent = `Level ${p.lvl}`;
  if (p.lvl > res.lvlBefore) { $("#lvlup").innerHTML = `<div class="lvlup ol">Level ${p.lvl}!</div>`; FX.play("levelup"); FX.confetti(100); }
  btn.innerHTML = `Continue ${ic("arrowRight")}`;
  btn.dataset.act = "back";
}

// ---------- clocks ----------
// Countdowns tick every second; crossing 7pm (or the end of a window) reloads so the buttons are right.
setInterval(() => {
  if (S.view !== "main" || !S.D) return;
  for (const el of document.querySelectorAll("[data-count]")) el.textContent = countdown(Number(el.dataset.count) - now());
  const w = S.D.windows, t = now();
  const edges = [w.tax.opens, w.tax.closes, w.raid.opens, w.raid.closes, S.D.fight ? Date.parse(S.D.fight.ends_at) : 0];
  if (edges.some((e) => e && S.lastTick && S.lastTick < e && t >= e)) refresh(true);
  S.lastTick = t;
}, 1000);

// ---------- events ----------
document.addEventListener("pointerdown", (e) => {
  FX.unlock();
  if (!e.target.closest("#stage")) return;
  e.preventDefault();
  if (S.view === "tax") taxTap(e);
  else if (S.view === "raid") raidTapEvent(e);
});
document.addEventListener("submit", async (e) => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form, data = Object.fromEntries(new FormData(f));
  const btn = f.querySelector("button:not([type=button])");
  const busy = async (fn) => { if (btn) btn.disabled = true; try { await fn(); } catch (err) { toast(err.message); } finally { if (btn) btn.disabled = false; } };
  switch (kind) {
    case "answer": {
      const text = $("#tv-in").value.trim(); if (!text) return;
      const res = raidAct("ans", text);
      if (res) FX.play(res.valid ? (res.rarity === 3 ? "rare" : "right") : "wrong");
      paintTrivia();
      break;
    }
    case "quiz-intro": S.answers.name = String(data.name || "").trim(); if (S.answers.name) quizAdvance(); break;
    case "quiz-value": {
      const q = QUESTIONS[S.qi];
      S.answers[q.id] = q.type === "number" ? Math.max(1, Math.min(99, Number(data.v) || 1)) : String(data.v).trim();
      quizAdvance();
      break;
    }
    case "code": await busy(async () => { S.invite = await lookupInvite(String(data.code)); render(); }); break;
    case "squad-create": await busy(async () => {
      const r = await call("squad_create", { token: S.token, name: data.name });
      await load(); closeSheet();
      if (S.view === "squad") { S.view = "setup"; S.setupStep = "steps"; render(); }
      else render();
      inviteSheet();
      toast(`${squad().name} is ready. Code ${r.code}`);
    }); break;
    case "squad-join": await busy(async () => {
      await call("join", { token: S.token, code: String(data.code).trim().toUpperCase() });
      await load(); closeSheet();
      if (S.view === "squad") { S.view = "setup"; S.setupStep = "steps"; }
      render(); toast(`You're in ${squad().name}`);
    }); break;
    case "signin-code": await busy(async () => {
      const code = String(data.code).trim().toUpperCase();
      const r = await callAuth("people", null, `?code=${encodeURIComponent(code)}`);
      if (!r.people.length) throw new Error("Nobody's in that squad");
      S.signin = { step: "who", code, squad: r.squad, people: r.people };
      render();
    }); break;
    case "signin-link": {
      const m = String(data.link).match(/[?&]me=([A-Za-z0-9]{10,64})/) || String(data.link).trim().match(/^([A-Za-z0-9]{10,64})$/);
      if (!m) { toast("That doesn't look like a restore link"); break; }
      await busy(() => signedIn(m[1]));
      break;
    }
    case "signin-password": await busy(async () => {
      const r = await callAuth("signin", { code: S.signin.code, id: S.signin.id, password: data.password });
      await signedIn(r.token);
    }); break;
    case "set-password": await busy(async () => {
      if (data.password !== data.again) throw new Error("Those two don't match");
      await callAuth("set_password", { token: S.token, password: data.password });
      S.hasPassword = true; closeSheet(); render(); toast("Password saved");
    }); break;
    case "log-steps": await busy(async () => {
      const r = await call("log", { token: S.token, steps: data.n, date: data.date, source: "manual" });
      closeSheet(); await load(); render(); toast(r.message.replace(/^✅ /, ""));
    }); break;
    case "log-scroll": await busy(async () => {
      await call("scroll_minutes", { token: S.token, minutes: data.n, date: data.date });
      closeSheet(); await load(); render(); toast("Scrolling saved");
    }); break;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.matches("[data-hue]")) {
    S.answers.hue = Number(e.target.value);
    const pv = $("#quiz-preview"); if (pv) pv.innerHTML = Walker.svg(S.answers, { mood: "ok" });
  }
});
document.addEventListener("change", (e) => {
  const t = e.target.dataset.toggle;
  if (t === "sound") FX.setMuted(!e.target.checked);
  if (t === "3d") store.set("no3d", !e.target.checked);
});
document.addEventListener("click", async (e) => {
  if (e.target.id === "sheet") { closeSheet(); return; }
  const t = e.target.closest("button, a[data-act]");
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { S.tab = d.tab; store.set("tab", d.tab); render(); scrollTo(0, 0); FX.play("tap"); return; }
  if (d.answer !== undefined && S.view === "quiz") {
    const q = QUESTIONS[S.qi];
    S.answers[q.id] = d.answer;
    document.querySelectorAll("[data-answer]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
    const pv = $("#quiz-preview"); if (pv) pv.innerHTML = Walker.svg(S.answers, { mood: "fresh" });
    setTimeout(quizAdvance, 340);
    return;
  }
  if (d.platform) { S.platform = d.platform; S.answers.name = $("[name=name]")?.value ?? S.answers.name; render(); return; }
  if (d.setup) { S.setupPlatform = d.setup; if (S.view === "setup") render(); else setupSheet(d.kind); return; }
  if (d.copy) { copy(d.copy); return; }
  if (d.signin && S.signin) { S.signin.id = d.signin; S.signin.step = "password"; render(); setTimeout(() => $("[name=password]")?.focus(), 50); return; }
  if (d.pos) {
    me().pos = d.pos; render();
    call("equip", { token: S.token, pos: d.pos }).catch((err) => toast(err.message));
    return;
  }
  if (d.shoptab) { S.shopTab = d.shoptab; render(); return; }
  if (d.item) { itemSheet(d.item, d.deal === "1"); FX.play("tap"); return; }
  if (d.buy) { const item = G.itemById(d.buy); return shopAction("buy", { item: d.buy, deal: d.deal === "1" }, () => { FX.play("buy"); itemSheet(item.id, false); toast(`${item.name} equipped`); }); }
  if (d.upgrade) return shopAction("upgrade", { item: d.upgrade }, () => { FX.play("levelup"); itemSheet(d.upgrade, false); });
  if (d.equip) { const it = G.itemById(d.equip); return shopAction("equip", { slot: it.slot, item: it.id }, () => { FX.play("buy"); itemSheet(it.id, false); }); }
  if (d.unequip) return shopAction("equip", { slot: d.unequip, item: null }, closeSheet);
  if (d.move && V.raid) { raidAct("move", d.move); FX.play("tap"); return; }
  switch (d.act) {
    case "close-sheet": closeSheet(); break;
    case "push-on": t.disabled = true; await enablePush(); t.disabled = false; break;
    case "signin": S.view = "signin"; S.signin = { step: "code" }; render(); scrollTo(0, 0); break;
    case "signin-back": {
      const st = S.signin;
      if (!st || st.step === "code") { S.view = "welcome"; S.signin = null; }
      else st.step = st.step === "password" ? "who" : "code";
      render(); break;
    }
    case "password": passwordSheet(); break;
    case "app-update-later": store.set("appUpdateLater", Date.now()); S.appUpdate = false; render(); break;
    case "native-steps": natOr("connectSteps"); break;
    case "native-scroll": natOr("connectScroll"); break;
    case "native-reminders-on": natOr("reminders", true); break;
    case "native-reminders-off": natOr("reminders", false); break;
    case "native-test": if (nat("testReminder")) toast("Sent. Check your notifications"); break;
    case "native-sync": if (nat("syncNow")) toast("Syncing…"); break;
    case "push-off": disablePush(); break;
    case "push-test": try { await callPush("test", { token: S.token }); toast("Sent. It should arrive in a few seconds"); } catch (err) { toast(err.message); } break;
    case "start": S.view = "quiz"; S.qi = 0; S.retake = false; render(); break;
    case "quiz-back": if (S.qi > (S.retake ? 1 : 0)) { S.qi--; render(); } else { S.view = S.retake ? "main" : "welcome"; S.retake = false; render(); } break;
    case "quiz-next": quizAdvance(); break;
    case "quiz-restart": S.view = "quiz"; S.qi = 1; render(); break;
    case "quiz-done": t.disabled = true; try { await finishQuiz(); } catch (err) { toast(err.message); t.disabled = false; } break;
    case "retake": S.retake = true; S.answers = { ...answersOf(me()), name: me().name }; S.qi = 1; S.view = "quiz"; render(); scrollTo(0, 0); toast("Your class can change with your answers"); break;
    case "skip-squad": S.view = "setup"; S.setupStep = "steps"; render(); break;
    case "setup-next": S.setupStep = "remind"; render(); scrollTo(0, 0); break;
    case "setup-done": S.view = "main"; S.tab = "today"; render(); scrollTo(0, 0); break;
    case "setup-steps": setupSheet("steps"); break;
    case "setup-scroll": setupSheet("scroll"); break;
    case "log-steps": logSheet("steps"); break;
    case "log-scroll": logSheet("scroll"); break;
    case "check-sync": {
      const out = $("#sync-status"), kind = d.kind;
      out.textContent = "Checking…";
      try {
        await load();
        const at = kind === "steps" ? me().steps_synced_at : me().scroll_synced_at;
        out.innerHTML = at && Date.now() - Date.parse(at) < 30 * 60000 ? `<b style="color:var(--green)">It works.</b> Last sync ${ago(at)}.` : at ? `Last sync ${ago(at)}. Run it once now to test.` : "Nothing yet. Run it once, then check again.";
      } catch (err) { out.textContent = err.message; }
      break;
    }
    case "squad-sheet": squadSheet(); break;
    case "invite": inviteSheet(); break;
    case "share-invite": { const sq = squad(); share(`Join ${sq.name} on Effort. Out-walk us or pay up.`, `${APP_URL}?g=${sq.code}`); break; }
    case "leave": {
      const sq = squad();
      if (!confirm(`Leave ${sq.name}? You'll miss the raids and the weekly table until you join a squad.`)) return;
      try { await call("leave", { token: S.token, code: sq.code }); await load(); render(); toast(`You left ${sq.name}`); } catch (err) { toast(err.message); }
      break;
    }
    case "copy-restore": copy(`${APP_URL}?me=${S.token}`, "Restore link copied. Keep it private"); break;
    case "signout": if (confirm("Sign out on this phone? You'll need your restore link to get back in.")) signOut(); break;
    case "tax": startTax(); break;
    case "tax-stop": if (V.tax && confirm("End the fight now? You can't fight him again today.")) { V.tax.left = 0; } break;
    case "raid": joinRaid(); break;
    case "raid-result": if (S.D.raid?.result) { V.result = { kind: "raid", out: S.D.raid.result, R: null, lvlBefore: level() }; S.view = "result"; render(); } break;
    case "raid-quit": if (!V.raid?.R || confirm("Leave the raid? Your squad keeps fighting, and you can rejoin while it's on.")) { leaveRaid(); S.view = "main"; await refresh(true); render(); } break;
    case "ability": raidAct("ab"); break;
    case "collect": collect(); break;
    case "back": FX.destroy(); V.result = null; S.view = "main"; render(); scrollTo(0, 0); break;
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
// A phone that's locked or switched away stops running the fight, so it hands over hosting until it's back.
document.addEventListener("visibilitychange", () => {
  const v = V.raid;
  if (v?.ch) {
    if (document.hidden) { v.ch.untrack(); v.host = false; }
    else { v.joinedAt = now(); v.ch.track({ at: v.joinedAt }); }
  }
  if (!document.hidden && S.view === "main") { refresh(true); checkForUpdate(); checkAppUpdate(); }
});

// ---------- updates ----------
// Every deploy changes app.js's ETag. Home-screen apps can sit open for days, so check when the app comes
// back to the front and every few minutes, and reload into the new version when nothing's in progress.
let releaseTag = null;
async function checkForUpdate() {
  if (location.protocol !== "https:") return;
  try {
    const res = await fetch("app.js", { method: "HEAD", cache: "no-store" });
    const tag = res.headers.get("etag") || res.headers.get("last-modified");
    if (!tag) return;
    if (!releaseTag) { releaseTag = tag; return; }
    if (tag !== releaseTag && ["main", "welcome"].includes(S.view) && $("#sheet").hidden) location.reload();
  } catch { /* offline: try again later */ }
}
setInterval(() => { if (!document.hidden) checkForUpdate(); }, 5 * 60000);

// ---------- boot ----------
(async function boot() {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
  checkForUpdate();
  render();
  const params = new URLSearchParams(location.search);
  const restore = params.get("me"), inviteCode = params.get("g");
  if (restore && restore !== S.token) { S.token = restore; store.set("token", restore); }
  if (S.token) {
    try { await load(); }
    catch (e) {
      if (/Unknown token/.test(e.message)) return signOut("That account doesn't exist any more");
      $("#app").innerHTML = `<div class="boot"><div class="logo ol">EFFORT</div><p class="muted">${esc(e.message)}</p><button class="btn gold" onclick="location.reload()">Try again</button></div>`;
      return;
    }
    history.replaceState(null, "", `${APP_URL}?me=${S.token}`);
    S.view = "main"; render();
    refreshPush(); keepPushAlive(); checkAppUpdate(); checkPassword();
    if (inviteCode && squad()?.code !== inviteCode.toUpperCase()) {
      try {
        const inv = await lookupInvite(inviteCode);
        openSheet(`${sheetHead(`Join ${esc(inv.name)}?`)}<p class="small muted">${inv.members} player${inv.members === 1 ? "" : "s"} walking.${squad() ? ` You'll leave ${esc(squad().name)}.` : ""}</p>
          <form data-form="squad-join"><input type="hidden" name="code" value="${esc(inv.code)}"><button class="btn green block">Join ${esc(inv.name)}</button></form>`);
      } catch (err) { toast(err.message); }
    }
    return;
  }
  if (inviteCode) { try { S.invite = await lookupInvite(inviteCode); } catch (err) { toast(err.message); } }
  S.view = "welcome";
  render();
})();
})();
