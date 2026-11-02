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
// On Android in a browser: the Effort app does steps, scrolling and the evening pings with a tap each.
function androidApp(t) {
  return `<p class="small" style="margin-top:0">The Effort app syncs your steps and scrolling, and pings you when the Taxman's in.</p>
    <a class="btn gold block" href="${STEPS_APK}">${ic("phone")} 1. Get the Effort app</a>
    <p class="tiny faint" style="margin:6px 2px 12px">Free, under 1 MB. Open the download and tap <b>Install</b>. If Android asks, allow installs from your browser. If Play Protect warns you, tap <b>More details → Install anyway</b>: it's our own app, it just isn't on the Play Store.</p>
    <a class="btn green block" href="${stepsAppLink(t)}">${ic("arrowRight")} 2. Open Effort in the app</a>
    <p class="tiny faint" style="margin:6px 2px 0">Signs you in there. Then use the app instead of Chrome.</p>`;
}

// Effort, the Android app that reads steps from Health Connect (android/ in the repo).
// effort://connect?t=TOKEN opens it signed in; as a Chrome intent link it downloads the app instead
// if it isn't installed yet.
// Both live on the site itself: the newest build, and app-version.json saying which build that is.
const SITE = "https://effort-game.vercel.app/";
// Kirish: the only player who sees The Lab.
const OWNER_ID = "ff9cc9b5-b51a-4643-a779-63ed178862f9";
const STEPS_APK = SITE + "effort-steps.apk";
const stepsAppLink = (token) => `intent://connect?t=${token}#Intent;scheme=effort;package=io.github.kirishvijay.effort;S.browser_fallback_url=${encodeURIComponent(STEPS_APK)};end`;
// Inside the Android app the game can ask for steps, usage access and reminders itself (android/MainActivity.kt).
const NATIVE = window.EffortAndroid || null;
const nativeStatus = () => { try { return JSON.parse(NATIVE.status()); } catch { return {}; } };
// Calls the Android app only if the installed version has that feature, so an older install never breaks.
const nat = (fn, ...args) => {
  if (typeof NATIVE?.[fn] !== "function") return false;
  try { NATIVE[fn](...args); return true; } catch { return false; }
};
// A newer Android app: app-version.json names the newest build ("1.<build>", the same as the app's own version).
// Checked at most every 6 hours.
const appBuild = (v) => Number(String(v || "").match(/\d+\.(\d+)/)?.[1] || 0);
async function checkAppUpdate() {
  const mine = appBuild(S.native?.version);
  if (!NATIVE || !mine) return;
  const cached = store.get("appLatest");
  let latest = cached && Date.now() - cached.at < 6 * 3600000 ? cached.build : null;
  if (latest == null) {
    try {
      const r = await fetch(SITE + "app-version.json", { cache: "no-cache" });
      if (!r.ok) return;
      latest = appBuild((await r.json()).version);
      store.set("appLatest", { at: Date.now(), build: latest });
    } catch { return; }
  }
  const show = latest > mine && Date.now() - (store.get("appUpdateLater") || 0) > 86400000;
  if (show === !!S.appUpdate) return;
  S.appUpdate = show;
  softRender();
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
const ROW_ICON = { front: "shieldWall", mid: "bigSwing", back: "target" };
const priceTag = (efforts) => `<span class="price">${coin(18)}${fmt(efforts)}</span>`;
const effortTag = (n) => `${coin(18)}${fmt(n)}`;
const signedEfforts = (n) => `${n >= 0 ? "+" : "−"}${coin(16)}${fmt(Math.abs(n))}`;
const PERKS = {
  critChance: (v) => `+${Math.round(v * 100)}% critical hit chance`,
  critDmg: (v) => `Critical hits deal +${v}× damage`,
  combo: (v) => `Combos build ${Math.round(v * 100)}% faster`,
  taxStart: (v) => `Start every Taxman fight on a ${v}-hit combo`,
  steal: (v) => `Steal up to ${Math.round(v * 1000) / 10}% more from the Taxman`,
  shield: (v) => `Shield Bash guards ${v}s longer`,
  heal: (v) => `Second Wind heals ${Math.round(v * 100)}% more`,
  swing: (v) => `Big Swing lasts ${v} more hits`,
  thorns: (v) => `Hits you take deal ${Math.round(v * 10)}× their damage back to the boss`,
  lifesteal: (v) => `Every hit heals you about ${Math.max(1, Math.round(v * 18))} HP`,
  cdr: (v) => `Abilities recharge ${Math.round(v * 100)}% faster`,
  trivia: (v) => `+${v}s on trivia questions`,
  secondWind: () => "Survive one killing blow each raid",
  feast: (v) => `×${v} damage while the boss is feasting`,
  dodge: (v) => `${Math.round(v * 100)}% chance to dodge a hit`,
  loot: (v) => `+${Math.round(v * 100)}% raid rewards`,
  spCharge: (v) => `Your special charges ${Math.round(v * 100)}% faster`,
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
  answers: store.get("draftAnswers") || {}, qi: 0, platform: detectPlatform(), invite: null,
  setupStep: "steps", setupPlatform: null, shopTab: "class", busy: false, push: "unknown",
  native: NATIVE ? nativeStatus() : null, sheetKind: null,
  signin: null, auth: null,
};
// The app reports what's connected (and each sync); redraw whatever's showing, and pull new numbers after a sync.
window.onEffortNative = (st) => {
  const synced = st.syncedAt && st.syncedAt !== S.native?.syncedAt;
  S.native = st;
  if (!$("#sheet").hidden && S.sheetKind) setupSheet(S.sheetKind);
  else softRender();
  if (synced && S.view === "main") refresh(true);
};
// The Android app reads steps live while it's open and hands each new total straight over, so Today moves as
// you walk. The server gets the same number from the app; a full reload now and then picks up everyone else.
window.onEffortSteps = (n) => {
  const t = S.D?.today; n = Math.round(Number(n));
  if (!t || !Number.isFinite(n) || n < 0 || n === t.rawSteps) return;
  const was = t.steps;
  t.rawSteps = n; t.steps = Math.max(0, n - (t.debt || 0));
  const mine = S.D.squad?.members.find((m) => m.id === S.D.me.id);
  if (mine) { mine.weekSteps = Math.max(0, mine.weekSteps + t.steps - was); mine.todaySteps = t.steps; }
  if (S.view === "main") softRender();
  if (Date.now() - (S.liveRefresh || 0) > 60000) { S.liveRefresh = Date.now(); setTimeout(() => S.view === "main" && refresh(true), 4000); }
};
// The Android back button: close a sheet, step back through the quiz, or go back to Today; otherwise leave the app.
window.effortBack = () => {
  if (window.EffortStory?.isOpen?.()) { EffortStory.close(); return true; }
  if (!$("#sheet").hidden) { closeSheet(); return true; }
  // In chat: close the search, then a reply or edit, then go to Today like the other tabs do.
  if (S.view === "chat") {
    if ($("#csearch") && !$("#csearch").hidden) closeChatSearch();
    else if (CH.mention) mentionShow(null);
    else if (CH.reply || CH.edit) { CH.reply = CH.edit = null; chatComposerState(); }
    else closeChat("today");
    return true;
  }
  if (["tax", "raid"].includes(S.view)) return true;
  const back = $("[data-act=quiz-back]") || $("[data-act=signin-back]") || $("[data-act=lobby-leave]") || $("[data-act=back]");
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
  if (D.fight?.finished_at) nat("taxDone", D.today.day);
  if (D.squad) setTimeout(chatPrefetch, 800);
  for (const m of D.squad?.members || []) ANS[m.id] = answersOf(m);
  return D;
}
async function refresh(silent) {
  try { await load(); softRender(); }
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
  if (S.D?.me) store.set("lastUser", { id: S.D.me.id, name: S.D.me.name, code: S.D.squad?.code || null, character: S.D.me.character || null });
  store.del("token"); store.del("pushSynced");
  nat("setToken", "");
  Object.assign(S, { token: null, D: null, view: "welcome" });
  history.replaceState(null, "", APP_URL);
  closeSheet(); render();
  if (msg) toast(msg);
}

// ---------- derived ----------
const ANS = {}; // player id -> walker answers (for portraits and the 3D team)
// A player's walker answers, plus any wardrobe colours they wear (_suit, _band).
const wearOf = (w) => {
  const s = G.wardrobeById(w?.suit), b = G.wardrobeById(w?.band), k = G.skinById(w?.skin);
  return { ...(s ? { _suit: s.color } : {}), ...(b ? { _band: b.color } : {}), ...(k ? { _skin: { id: k.id, tier: k.tier, look: k.look } } : {}) };
};
const gearLook = (g) => Object.fromEntries(G.SLOTS.filter((s) => g?.[s]).map((s) => [`_${s}`, g[s]]));
const answersOf = (p) => ({ ...(p?.character && p.character.time ? p.character : Walker.fallbackAnswers(p?.id || "x")), ...wearOf(p?.wear), ...gearLook(p?.gear || p?.equipped) });
const me = () => S.D.me;
const myStats = () => G.stats(me().character || {});
const myClass = () => G.classOf(myStats());
const level = () => G.levelOf(S.D.xp);
const squad = () => S.D.squad;
const squadAvgToday = () => { const m = squad()?.members || []; return m.length > 1 ? m.reduce((s, x) => s + x.todaySteps, 0) / m.length : 0; };
const taxSetup = () => G.taxmanSetup({ steps: S.D.today.steps, scrollMin: G.scrollCounted(S.D.today.steps, S.D.today.scroll, S.D.today.scrollLinked), stats: myStats(), equipped: me().gear, inv: S.D.inv, level: level(), squadAvg: squadAvgToday() });
const weekRows = () => G.weekTable((squad()?.members || []).map((m) => ({ id: m.id, name: m.name, you: m.id === me().id, weekSteps: m.weekSteps, fresh: m.fresh, goalDays: m.goalDays })));
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
// nosquad | soon (before Sunday 6pm) | open (the lobby's open) | live (your raid's on) | without (it started without you) | done
function raidState() {
  const w = S.D.windows.raid, r = S.D.raid;
  if (!squad()) return "nosquad";
  if (r?.status === "done") return "done";
  if (r && ["live", "settling"].includes(r.status)) return (r.fighters || []).includes(me().id) ? "live" : "without";
  if (w.open && now() < w.closes) return "open";
  return "soon";
}
// The boss this week: the one picked in the lobby, or the suggested one.
const raidTier = () => S.D.raid?.tier ?? squad()?.bosses?.pick ?? squad()?.tier ?? 1;

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
// A ping at 5pm before the Taxman's in (and the raid lobby on Sunday), and one at 9pm if you missed him. The server sends it;
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
  softRender();
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
    toast("Pings at 5pm, and 9pm if you miss him");
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
    : `<button class="btn gold block" data-act="native-reminders-on">${ic("bell")} Ping me when the Taxman's in</button>`;
  switch (S.push) {
    case "on": return `<div class="row spread" style="flex-wrap:wrap;gap:8px"><span class="chip green">${ic("bell")} Pings on</span><span class="row" style="gap:6px"><button class="btn xs" data-act="push-test">Send a test</button><button class="btn xs" data-act="push-off">Turn off</button></span></div>`;
    case "install": return `<div class="guide small">On iPhone, notifications only work from the Home Screen app: tap <b>Share</b> → <b>Add to Home Screen</b>, open Effort from there, then turn them on.</div>`;
    case "denied": return `<div class="guide small">Notifications are blocked. Allow them in your phone's settings, then come back.</div>`;
    case "unsupported": return `<p class="small muted" style="margin:0">This browser can't do notifications. Use the calendar below.</p>`;
    default: return `<button class="btn gold block" data-act="push-on">${ic("bell")} Ping me when the Taxman's in</button>`;
  }
}

// ---------- shell ----------
// Swap in new markup, keeping every element whose markup hasn't changed (so pictures don't re-render and
// nothing flickers). depth: how many levels down to look for unchanged pieces inside a changed one.
// Remember each element's markup as drawn (before pictures fill in), a few levels down.
function stamp(node, depth) { node._src = node.outerHTML; if (depth > 0) for (const c of node.children) stamp(c, depth - 1); }
// The loose text inside an element (not its child elements'): if that changed, patching the children alone would
// leave the old words on screen, so the element is replaced instead.
const ownText = (e) => [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.data).join(" ");
function morph(el, html, depth) {
  const t = document.createElement("template"); t.innerHTML = html;
  const next = [...t.content.children], prev = [...el.children];
  next.forEach((n, i) => {
    const src = n.outerHTML, old = prev[i];
    if (old && old._src === src) return;
    if (old && depth > 0 && old.tagName === n.tagName && old.className === n.className && old.getAttribute("style") === n.getAttribute("style") && old.children.length && n.children.length && ownText(old) === ownText(n)) {
      for (const a of n.attributes) if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
      for (const a of [...old.attributes]) if (!n.hasAttribute(a.name)) old.removeAttribute(a.name);
      morph(old, n.innerHTML, depth - 1);
      old._src = src;
      return;
    }
    stamp(n, depth);
    if (old) old.replaceWith(n); else el.appendChild(n);
  });
  for (const extra of prev.slice(next.length)) extra.remove();
}
// Things that happen in the background (steps syncing, sign-in checks, notifications, app updates) redraw the
// main screens only, never a fight, and never under an open sheet.
const softRender = () => { if (["main", "setup"].includes(S.view) && $("#sheet").hidden) render(); };
function render() {
  const views = { boot: viewBoot, welcome: viewWelcome, signin: viewSignin, quiz: viewQuiz, reveal: viewReveal, squad: viewSquad, setup: viewSetup, main: viewMain, lobby: viewLobby, tax: renderTax, raid: renderRaid, result: renderResult, chat: viewChat };
  (views[S.view] || viewBoot)();
  hydratePortraits();
}
const viewBoot = () => { $("#app").innerHTML = `<div class="boot"><div class="logo ol">EFFORT</div><p class="muted">Lacing up…</p></div>`; };

// One-off gifts: a "gift" ledger row (added by hand) is shown once as a message, then never again on this phone.
function giftCheck() {
  const g = (S.D.ledger || []).find((r) => r.kind === "gift" && !store.get(`gift:${r.ref}`));
  if (!g || $(".gift-pop") || !$("#sheet").hidden) return;
  const el = document.createElement("div");
  el.className = "gift-pop";
  el.innerHTML = `<div class="gift-card"><p class="gift-text">${esc(g.note)}</p><div class="gr-win">+${fmt(g.amount)} Efforts</div><span class="tiny faint">Tap anywhere</span></div>`;
  document.body.appendChild(el);
  FX.play("combo");
  el.addEventListener("click", () => {
    store.set(`gift:${g.ref}`, 1);
    el.remove(); FX.play("coin");
  });
}
function viewMain() {
  const D = S.D, p = G.levelProgress(D.xp), cls = myClass();
  const tabs = { today: tabToday, raid: tabRaid, journey: tabJourney, shop: tabShop, me: tabMe };
  if (!tabs[S.tab]) S.tab = "today";
  const html = `
    <header class="header">
      <button class="avatar" data-tab="me" aria-label="Your profile and settings">${face(me().id)}${needsAccount() ? '<i class="ping"></i>' : ""}</button>
      <div class="who"><div class="nm"><b>${esc(me().name)}</b><span class="lvl" title="Level">Lv ${p.lvl}</span></div><div class="cls">${esc(cls.name)}</div><div class="xp big" role="progressbar" aria-label="XP to level ${p.lvl + 1}" aria-valuemin="0" aria-valuemax="${p.need}" aria-valuenow="${p.into}"><i style="width:${p.pct * 100}%"></i><span class="xpt">${fmt(p.into)} / ${fmt(p.need)} XP</span></div></div>
      ${walletHtml()}
    </header>
    <div class="stack">${tabs[S.tab]()}</div>
    ${dockHtml(S.tab)}`;
  // Already on the main screens: change only what's different. Coming from anywhere else: draw it fresh.
  const app = $("#app");
  if (app.firstElementChild?.matches("header.header")) morph(app, html, 3);
  else { app.innerHTML = html; for (const c of app.children) stamp(c, 3); }
  if (S.tab === "journey") mountRealm(); else { S.realm?.dispose?.(); S.realm = null; }
  giftCheck();
}
// Today's walking that isn't in the wallet yet. Before the Taxman's settled it's the full amount so far, shown as a
// badge (his cut isn't known). Once he's settled (beaten, fought or missed) his rate covers the whole day, midnight
// to midnight, and the server pays today in as it comes; this is the bit since it last did, so the wallet's numbers
// can move straight away.
function pendingToday() {
  if (!S.D?.today) return { n: 0, taxed: false, rate: 0 };
  const T = taxSetup(), E = T.efforts, f = S.D.fight, st = taxState(), paid = ledgerFor("tax", S.D.today.day)?.amount || 0;
  if (f && st === "done") {
    const k = Number(f.knocked) || 0, net = E - Math.round(E * Number(f.rate) * (1 - k)) + Math.round(E * (Number(f.steal_pct) || 0));
    return { n: net - paid, taxed: true, rate: Number(f.rate) * (1 - k), steal: Number(f.steal_pct) || 0 };
  }
  if (st === "missed") return { n: E - Math.round(E * T.taxRate) - paid, taxed: true, rate: T.taxRate, steal: 0 };
  return { n: E, taxed: false, rate: T.taxRate };
}
function walletHtml() {
  const P = pendingToday(), w = S.D.wallet + (P.taxed ? P.n : 0);
  if (w < 0) return `<button class="wallet" data-act="wallet" aria-label="You owe ${fmt(-w)} Efforts"><span class="cur eff debt"><span class="cico">${coin(24)}</span><span class="cv"><b>−${fmt(-w)}</b><small>Efforts owed</small></span></span></button>`;
  const p = P.taxed ? 0 : P.n;
  return `<button class="wallet" data-act="wallet" aria-label="${fmt(w)} Efforts${p ? `, plus ${p} from today on the way` : ""}">
      <span class="cur eff"><span class="cico">${coin(24)}</span><span class="cv"><b>${fmt(w)}</b><small>Effort${w === 1 ? "" : "s"}</small></span>${p ? `<em class="pend">+${fmt(p)}</em>` : ""}</span>
    </button>`;
}
function dockHtml(on) {
  return `<nav class="dock"><div class="inner">${[["today", "Steps", "steps"], ["raid", "Fight", "sword"], ["journey", "Journey", "flag"], ["chat", "Chat", "chat"], ["shop", "Shop", "bag"]].map(([k, l, i]) =>
      `<button data-tab="${k}" ${on === k ? 'aria-current="page"' : ""}>${ic(i)}${l}${dockDot(k)}</button>`).join("")}</div></nav>`;
}
// A dot on the dock when something's waiting: a fight is open (the Taxman, the Hunt or the raid).
const fightOn = () => ["open", "live"].includes(taxState()) || ["open", "live"].includes(raidState()) || (S.D.hunt?.open && !S.D.hunt.done);
function dockDot(tab) {
  if (tab === "raid" && fightOn()) return '<i class="ping"></i>';
  if (tab === "journey" && toClaim().length) return '<i class="ping"></i>';
  if (tab === "chat" && squad() && chatUnread()) return '<i class="ping"></i>';
  return "";
}

// ---------- squad chat ----------
// Its own full-screen view, built once and then changed in place (so typing and scrolling are never reset).
// Live: a ping on the squad's channel says "there's a new message"; the words themselves only travel through
// the server, which keeps them encrypted at rest.
const CH = { msgs: new Map(), order: [], more: true, loadingOld: false, ch: null, reply: null, edit: null, live: true, poll: 0, searchT: 0 };
const chatRead = () => Number(store.get("chatRead") || 0);
const chatUnread = () => (S.D?.chat?.latest || 0) > chatRead();
const nameOf = (id) => (id === me().id ? "You" : squad()?.members.find((m) => m.id === id)?.name || "Someone");
const dayKey = (ts) => new Date(ts).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const timeOf = (ts) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
// Text to safe HTML: links, @mentions, line breaks.
function richText(t) {
  const names = (squad()?.members || []).map((m) => m.name).sort((a, b) => b.length - a.length);
  let h = esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,!?)])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  for (const n of names) h = h.split(`@${esc(n)}`).join(`<span class="mention ${n === me().name ? "me" : ""}">@${esc(n)}</span>`);
  return h.replace(/\n/g, "<br>");
}
function msgHtml(m, prev) {
  const sameDay = prev && dayKey(prev.at) === dayKey(m.at);
  const grouped = sameDay && prev.by === m.by && Date.parse(m.at) - Date.parse(prev.at) < 7 * 60000 && !m.reply;
  const r = m.reply && CH.msgs.get(m.reply);
  return `${sameDay ? "" : `<div class="cday"><span>${esc(dayKey(m.at))}</span></div>`}
    <div class="cmsg ${grouped ? "grouped" : ""} ${m.by === me().id ? "mine" : ""}" id="cm-${m.id}" data-cm="${m.id}">
      ${grouped ? `<span class="ctime-side">${timeOf(m.at)}</span>` : `<span class="cav">${face(m.by, 38)}</span>`}
      <div class="cbody">
        ${m.reply ? `<button class="creply" data-jump="${m.reply}">${ic("back")} <b>${esc(r ? nameOf(r.by) : "")}</b> ${esc(r?.text ? r.text.slice(0, 80) : r ? "(message deleted)" : "an earlier message")}</button>` : ""}
        ${grouped ? "" : `<div class="chead"><b>${esc(nameOf(m.by))}</b><span>${dayKey(m.at) === dayKey(Date.now()) ? "Today" : ""} ${timeOf(m.at)}</span></div>`}
        <div class="ctext">${m.deleted ? `<i class="faint">Message deleted</i>` : richText(m.text ?? "")}${m.edited && !m.deleted ? `<span class="cedited">(edited)</span>` : ""}</div>
      </div>
      ${m.deleted ? "" : `<div class="cacts"><button data-cact="reply" data-id="${m.id}" aria-label="Reply">${ic("back")}</button>${m.by === me().id ? `<button data-cact="edit" data-id="${m.id}" aria-label="Edit">${ic("edit")}</button><button data-cact="del" data-id="${m.id}" aria-label="Delete">${ic("trash")}</button>` : ""}</div>`}
    </div>`;
}
function chatPaint({ keep = false, toBottom = false } = {}) {
  const list = $("#clist"); if (!list) return;
  const h0 = list.scrollHeight, t0 = list.scrollTop;
  const items = CH.order.map((id) => CH.msgs.get(id));
  if (!CH.loaded) { list.innerHTML = `<div class="cmore">Loading messages…</div>`; return; }
  list.innerHTML = `${CH.more ? `<div class="cmore">${CH.loadingOld ? "Loading…" : "Scroll up for older messages"}</div>` : `<div class="cstart"><b>This is the start of ${esc(squad()?.name || "your squad")}'s chat.</b><span>${ic("lock")} Encrypted. Only your squad can read these.</span></div>`}
    ${items.map((m, i) => msgHtml(m, items[i - 1])).join("")}`;
  for (const img of list.querySelectorAll("img[data-portrait]")) void img;
  hydratePortraits();
  if (toBottom) list.scrollTop = list.scrollHeight;
  else if (keep) list.scrollTop = t0 + (list.scrollHeight - h0);
  $("#cjump").hidden = CH.live && list.scrollHeight - list.scrollTop - list.clientHeight < 200;
}
function chatAdd(msgs, { replace = false, read = true } = {}) {
  if (replace) { CH.msgs.clear(); CH.order = []; }
  for (const m of msgs) { if (!CH.msgs.has(m.id)) CH.order.push(m.id); CH.msgs.set(m.id, m); }
  CH.order.sort((a, b) => a - b);
  if (read) chatMarkRead();
}
function chatMarkRead() {
  const newest = CH.order[CH.order.length - 1];
  if (CH.live && newest && newest > chatRead()) { store.set("chatRead", newest); if (S.D.chat) S.D.chat.latest = Math.max(S.D.chat.latest, newest); }
  if (S.view === "chat" && !chatUnread()) $("#app > .dock [data-tab=chat] .ping")?.remove();
}
// The squad's latest messages are fetched in the background once the game's loaded, and kept between visits,
// so the chat opens straight away and only asks for what's new. They live in memory only, never on the phone.
function chatForSquad() {
  const code = squad()?.code || null;
  if (CH.code !== code) { CH.code = code; CH.msgs.clear(); CH.order = []; CH.loaded = false; CH.more = true; CH.live = true; }
}
async function chatPrefetch() {
  chatForSquad();
  if (!CH.code || CH.loaded || CH.prefetching) return;
  CH.prefetching = true;
  try {
    const r = await call("chat_list", { token: S.token });
    if (!CH.loaded) { CH.more = r.more; CH.live = true; chatAdd(r.messages, { replace: true, read: false }); CH.loaded = true; }
  } catch { /* the chat loads when it's opened instead */ }
  CH.prefetching = false;
}
const nearBottom = () => { const l = $("#clist"); return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 120; };
async function chatNewer() {
  if (!CH.live || !CH.order.length) return chatLoad();
  try {
    const r = await call("chat_list", { token: S.token, after: CH.order[CH.order.length - 1] });
    if (!r.messages.length) return;
    const stick = nearBottom();
    chatAdd(r.messages);
    chatPaint({ keep: !stick, toBottom: stick });
    if (!stick) $("#cjump").hidden = false;
    else if (r.messages.some((m) => m.by !== me().id)) FX.play("tap");
  } catch { /* try again on the next ping */ }
}
async function chatLoad() {
  try {
    const r = await call("chat_list", { token: S.token });
    CH.more = r.more; CH.live = true; CH.loaded = true;
    chatAdd(r.messages, { replace: true });
    chatPaint({ toBottom: true });
  } catch (e) { toast(e.message); }
}
async function chatOlder() {
  if (CH.loadingOld || !CH.more || !CH.order.length) return;
  CH.loadingOld = true;
  try {
    const r = await call("chat_list", { token: S.token, before: CH.order[0] });
    CH.more = r.more;
    chatAdd(r.messages);
  } catch (e) { toast(e.message); }
  CH.loadingOld = false;
  chatPaint({ keep: true });
}
async function chatJump(id) {
  if (!CH.msgs.has(id)) {
    try {
      const r = await call("chat_around", { token: S.token, id });
      CH.live = false; CH.more = r.more;
      chatAdd(r.messages, { replace: true });
      chatPaint();
    } catch (e) { return toast(e.message); }
  }
  closeChatSearch();
  const el = $(`#cm-${id}`); if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600);
  $("#cjump").hidden = CH.live && nearBottom();
}
function chatComposerState() {
  const box = $("#cctx"); if (!box) return;
  const m = CH.reply ? CH.msgs.get(CH.reply) : CH.edit ? CH.msgs.get(CH.edit) : null;
  box.hidden = !m;
  box.innerHTML = m ? `<span>${CH.edit ? "Editing your message" : `Replying to <b>${esc(nameOf(m.by))}</b>`}</span><button data-cact="cancel" aria-label="Cancel">${ic("close")}</button>` : "";
}
async function chatSend() {
  const ta = $("#cinput"), text = ta.value.trim();
  if (!text || CH.sending) return;
  CH.sending = true;
  try {
    if (CH.edit) {
      const r = await call("chat_edit", { token: S.token, id: CH.edit, text });
      CH.msgs.set(r.message.id, r.message); CH.edit = null;
      CH.ch?.send({ type: "broadcast", event: "upd", payload: { id: r.message.id } });
      chatPaint({ keep: true });
    } else {
      const r = await call("chat_send", { token: S.token, text, reply: CH.reply });
      CH.reply = null;
      if (!CH.live) await chatLoad(); else { chatAdd([r.message]); chatPaint({ toBottom: true }); }
      CH.ch?.send({ type: "broadcast", event: "new", payload: { id: r.message.id } });
    }
    ta.value = ""; chatGrow(); mentionShow(null);
    chatComposerState();
  } catch (e) { toast(e.message); }
  CH.sending = false;
  ta.focus();
}
// Typing @ (or @ and the start of a name) lists the squad to pick from.
function mentionCheck() {
  const ta = $("#cinput"); if (!ta) return;
  const before = ta.value.slice(0, ta.selectionStart), m = before.match(/(?:^|\s)@([^\s@]{0,24})$/);
  if (!m || ta.selectionStart !== ta.selectionEnd) return mentionShow(null);
  const q = m[1].toLowerCase(), mates = (squad()?.members || []).filter((x) => x.id !== me().id);
  const list = [...mates.filter((x) => x.name.toLowerCase().startsWith(q)), ...mates.filter((x) => !x.name.toLowerCase().startsWith(q) && x.name.toLowerCase().includes(q))].slice(0, 6).map((x) => x.name);
  mentionShow(list.length ? { at: before.length - m[1].length - 1, list, i: 0 } : null);
}
function mentionShow(M) {
  CH.mention = M;
  const box = $("#cmention"); if (!box) return;
  box.hidden = !M;
  box.innerHTML = M ? M.list.map((n, i) => { const x = squad().members.find((y) => y.name === n);
    return `<button type="button" role="option" aria-selected="${i === M.i}" class="${i === M.i ? "on" : ""}" data-mention="${esc(n)}"><span class="cav">${face(x.id, 26)}</span><b>${esc(n)}</b></button>`; }).join("") : "";
}
function mentionPick(name) {
  const ta = $("#cinput"), M = CH.mention; if (!ta || !M || !name) return;
  const end = ta.selectionStart, ins = `@${name} `;
  ta.value = ta.value.slice(0, M.at) + ins + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = M.at + ins.length;
  mentionShow(null); chatGrow(); ta.focus();
}
function chatGrow() { const ta = $("#cinput"); if (!ta) return; ta.style.height = "auto"; ta.style.height = `${Math.min(140, ta.scrollHeight)}px`; }
function closeChatSearch() { const s = $("#csearch"); if (s) { s.hidden = true; $("#cresults").innerHTML = ""; } }
async function chatSearch(q) {
  const box = $("#cresults"); if (!box) return;
  if (q.trim().length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = `<p class="small muted cpad">Searching…</p>`;
  try {
    const r = await call("chat_search", { token: S.token, q });
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const mark = (t) => { let h = esc(t.length > 160 ? t.slice(0, 160) + "…" : t); for (const w of words) h = h.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (x) => `<mark>${x}</mark>`); return h; };
    box.innerHTML = r.results.length ? r.results.map((m) => `<button class="cres" data-jump="${m.id}"><span class="chead"><b>${esc(nameOf(m.by))}</b><span>${esc(dayKey(m.at))} ${timeOf(m.at)}</span></span><span class="ctext">${mark(m.text)}</span></button>`).join("")
      : `<p class="small muted cpad">Nothing matches “${esc(q)}”.</p>`;
  } catch (e) { box.innerHTML = `<p class="small muted cpad">${esc(e.message)}</p>`; }
}
function viewChat() {
  if ($("#chatview")) return; // already built: it updates itself
  $("#app").innerHTML = `<section class="chatview" id="chatview">
    <header class="chathead">
      <button class="iconbtn" data-act="chat-close" aria-label="Back">${ic("back")}</button>
      <div class="grow"><b>${esc(squad()?.name || "Squad")}</b><small>${ic("lock")} Encrypted · ${squad()?.members.length || 0} members</small></div>
      <button class="iconbtn" data-act="chat-search" aria-label="Search messages">${ic("target")}</button>
    </header>
    <div class="csearch" id="csearch" hidden><input id="cq" type="search" placeholder="Search messages" autocomplete="off" aria-label="Search messages"><div class="cresults" id="cresults"></div></div>
    <div class="clist" id="clist" role="log" aria-live="polite"></div>
    <button class="cjump" id="cjump" data-act="chat-latest" hidden>${ic("arrowRight")} Jump to latest</button>
    <form class="ccomposer" data-form="chat">
      <div class="cctx" id="cctx" hidden></div>
      <div class="cmention" id="cmention" role="listbox" aria-label="Mention someone" hidden></div>
      <div class="crow"><textarea id="cinput" rows="1" maxlength="2000" placeholder="Message ${esc(squad()?.name || "your squad")}" aria-label="Message"></textarea>
        <button class="btn gold csend" aria-label="Send">${ic("arrowRight")}</button></div>
    </form>
  </section>${dockHtml("chat")}`;
  // The chat sits above the dock; while typing the dock steps aside for the keyboard.
  const fit = () => { const cv = $("#chatview"), dock = $("#app > .dock"); if (cv && dock) cv.style.bottom = document.body.classList.contains("typing") ? "0px" : `${dock.offsetHeight}px`; };
  fit(); addEventListener("resize", fit);
  $("#chatview").addEventListener("focusin", (e) => { if (e.target.id === "cinput") { document.body.classList.add("typing"); fit(); } });
  $("#chatview").addEventListener("focusout", (e) => { if (e.target.id === "cinput") setTimeout(() => { if (document.activeElement?.id !== "cinput") { document.body.classList.remove("typing"); fit(); } }, 120); });
  const list = $("#clist");
  list.addEventListener("scroll", () => {
    if (list.scrollTop < 160) chatOlder();
    $("#cjump").hidden = CH.live && nearBottom();
  }, { passive: true });
  const ta = $("#cinput");
  ta.addEventListener("input", chatGrow);
  ta.addEventListener("input", mentionCheck);
  ta.addEventListener("click", mentionCheck);
  ta.addEventListener("blur", () => setTimeout(() => mentionShow(null), 150));
  // The picker gets first go at the keys while it's open.
  ta.addEventListener("keydown", (e) => {
    const M = CH.mention; if (!M) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { M.i = (M.i + (e.key === "ArrowDown" ? 1 : -1) + M.list.length) % M.list.length; mentionShow(M); }
    else if (e.key === "Enter" || e.key === "Tab") mentionPick(M.list[M.i]);
    else if (e.key === "Escape") mentionShow(null);
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  });
  $("#cmention").addEventListener("pointerdown", (e) => { const b = e.target.closest("[data-mention]"); if (!b) return; e.preventDefault(); mentionPick(b.dataset.mention); });
  ta.addEventListener("keydown", (e) => {
    // Enter sends on a keyboard; on phones it's a new line and the button sends.
    if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer: fine)").matches) { e.preventDefault(); chatSend(); }
    if (e.key === "Escape") { CH.reply = CH.edit = null; chatComposerState(); }
  });
  $("#cq").addEventListener("input", (e) => { clearTimeout(CH.searchT); CH.searchT = setTimeout(() => chatSearch(e.target.value), 350); });
  list.addEventListener("click", (e) => {
    const m = e.target.closest(".cmsg");
    for (const x of list.querySelectorAll(".cmsg.sel")) if (x !== m) x.classList.remove("sel");
    if (m && !e.target.closest("button, a")) m.classList.toggle("sel");
  });
  chatForSquad();
  if (CH.loaded && CH.live) { chatPaint({ toBottom: true }); chatMarkRead(); chatNewer(); }
  else { chatPaint(); chatLoad(); }
}
function openChat() {
  if (!squad()) return toast("Join a squad to chat");
  S.view = "chat";
  render();
  if (!CH.ch && window.supabase) {
    CH.ch = realtime().channel(`chat-${squad().code}`, { config: { broadcast: { self: false } } });
    CH.ch.on("broadcast", { event: "new" }, () => chatNewer())
      .on("broadcast", { event: "upd" }, async ({ payload }) => {
        try { const r = await call("chat_around", { token: S.token, id: payload.id }); const m = r.messages.find((x) => x.id === payload.id); if (m && CH.msgs.has(m.id)) { CH.msgs.set(m.id, m); chatPaint({ keep: true }); } } catch { /* ignore */ }
      }).subscribe();
  }
  clearInterval(CH.poll); CH.poll = setInterval(() => { if (S.view === "chat" && !document.hidden) chatNewer(); }, 15000);
}
function closeChat(tab) {
  clearInterval(CH.poll);
  try { CH.ch?.unsubscribe(); } catch { /* gone */ }
  CH.ch = null;
  document.body.classList.remove("typing");
  S.view = "main";
  if (tab) { S.tab = tab; store.set("tab", tab); }
  render(); scrollTo(0, 0);
}
async function chatAction(act, id) {
  const m = CH.msgs.get(id);
  if (act === "reply") { CH.reply = id; CH.edit = null; chatComposerState(); $("#cinput").focus(); }
  if (act === "edit" && m) { CH.edit = id; CH.reply = null; $("#cinput").value = m.text || ""; chatGrow(); chatComposerState(); $("#cinput").focus(); }
  if (act === "cancel") { if (CH.edit) $("#cinput").value = ""; CH.reply = CH.edit = null; chatComposerState(); chatGrow(); }
  if (act === "del" && m) {
    if (!CH.confirmDel || CH.confirmDel !== id) { CH.confirmDel = id; toast("Tap delete again to remove it"); setTimeout(() => { if (CH.confirmDel === id) CH.confirmDel = null; }, 3000); return; }
    CH.confirmDel = null;
    try { const r = await call("chat_delete", { token: S.token, id }); CH.msgs.set(id, r.message); chatPaint({ keep: true }); CH.ch?.send({ type: "broadcast", event: "upd", payload: { id } }); }
    catch (e) { toast(e.message); }
  }
}

// ---------- Journey: the season ----------
const season = () => S.D.season || null;
const seasonContent = () => (season() ? window.EffortSeasons?.[season().id] || generatedSeason(season()) : null);
// Seasons after the written ones: the route comes from world.js, the chapters from its story beats.
function generatedSeason(Z) {
  const W = window.EffortWorld, leg = W?.legs?.[(Z.n - 5) % (W?.legs?.length || 1)];
  if (!leg || !W.beats) return null;
  const r = G.rng(G.hash(Z.id)), from = (k) => W.beats[k][Math.floor(r() * W.beats[k].length)];
  const twist = G.affixInfo(Z.affix)?.name || "the weather", L = leg.landmarks;
  const fill = (t, k) => t.replaceAll("{place}", L[k].name).replaceAll("{next}", L[Math.min(L.length - 1, k + 1)].name).replaceAll("{route}", leg.route)
    .replaceAll("{boss}", G.BOSSES[(Z.n + k) % G.BOSSES.length].name).replaceAll("{twist}", twist).replaceAll("{count}", "the Long Count");
  const chapters = L.map((l, k) => {
    const kinds = k === 0 ? ["opening", "landmark", "squad"] : k === L.length - 1 ? ["landmark", "finale", "squad"] : ["landmark", k % 3 === 0 ? "boss" : k % 4 === 1 ? "taxman" : "squad", "landmark"];
    return { title: l.name, text: kinds.map((kd) => fill(from(kd), k)) };
  });
  return { id: Z.id, blurb: leg.blurb, coast: leg.coast || null, landmarks: L, chapters };
}
const claimedSet = () => new Set(season()?.claimed || []);
// Everything there is to claim right now: open chapters not read, track tiers reached, bounties done.
function toClaim() {
  const Z = season(); if (!Z || Z.upcoming) return [];
  const got = claimedSet(), out = [];
  for (const k of Z.chapters) if (!got.has(`${Z.id}:ch:${k}`)) out.push({ what: "chapter", k });
  for (let k = 1; k <= Z.track; k++) if (!got.has(`${Z.id}:tr:${k}`)) out.push({ what: "track", k });
  for (const b of Z.bounties) if (b.done && !got.has(b.ref)) out.push({ what: "bounty", ref: b.ref });
  return out;
}
const affixLine = (Z) => { const A = G.affixInfo(Z.affix); return A ? `<span class="chip fogchip">${ic("eye")} ${esc(A.name)}: ${esc(A.what)}</span>` : ""; };
const longDate = (day) => new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
// While a yearly event is on: its boss waits in Sunday's lobby.
function eventCard() {
  const day = S.D.gameDay || S.D.today.day, ev = G.eventOn(day); if (!ev || !squad()) return "";
  const B = G.EVENT_BOSSES[ev.id], prize = G.WARDROBE.find((w) => w.event === ev.id), won = prize && (me().owned || []).includes(prize.id);
  const ends = new Date(`${day.slice(0, 4)}-${ev.to}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `<section class="panel eventcard"><div class="caps">Event · until ${ends}</div><h2 class="ol disp">${esc(ev.name)}</h2>
      <p class="small" style="margin:0">${esc(B.blurb)}</p>
      <p class="small muted" style="margin:8px 0 0"><b>${esc(B.name)}</b> is a choice in Sunday's lobby: as tough as your ladder boss, 25% more loot, and the ladder doesn't move.${prize ? ` ${won ? `You've won the ${esc(prize.name)}.` : `Beat it to win the <b>${esc(prize.name)}</b>.`}` : ""}</p></section>`;
}
function journeyTeaser() {
  const Z = season(), C = seasonContent(); if (!Z || !C) return "";
  const n = toClaim().length;
  return `<button class="panel teaser" data-tab="journey">
      <span class="ic-badge gold">${ic("flag")}</span>
      <span class="grow"><small>Season ${Z.n}${Z.upcoming ? ` · starts ${longDate(Z.start)}` : ` · week ${Z.week} of 13`}</small><b>${esc(Z.name)}</b>
        <span class="tiny muted">${Z.upcoming ? esc(Z.route) : `${fmt(Z.miles)} of ${fmt(Z.total)} miles`}${n ? ` · <span class="gold-t">${n} to claim</span>` : ""}</span></span>
      ${ic("arrowRight")}</button>`;
}
// This week's walk: through the boss's realm to its lair, as the squad's steps fill the weekly goal.
const realmWeek = () => { const d = new Date(S.D.today.day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
function realmPanel() {
  if (!window.EffortRealms) return "";
  const tier = raidTier(), boss = G.bossFor(G.baseTier(tier)), g = goalNow(tier), sq = squad();
  const key = `realm:${realmWeek()}:${boss.id}`, prev = Math.min(g.steps, Number(store.get(key)) || 0);
  const trailOf = (m) => { const k = G.skinById(m.wear?.skin); return k?.look.trail || null; };
  const members = (sq ? sq.members : [me()]).map((m) => ({ id: m.id, name: m.name, faceHtml: face(m.id, 28), weekSteps: m.weekSteps ?? 0, todaySteps: m.todaySteps ?? S.D.today.steps, trail: trailOf(m) }));
  return `<section class="panel realm-root" data-realm-key="${key}" data-realm-steps="${g.steps}">${EffortRealms.html({ bossId: boss.id, bossName: boss.name, steps: g.steps, target: g.target, prevSteps: prev, members })}
    ${sq ? "" : `<p class="small muted" style="margin:10px 0 0">Join a squad to walk it together.</p>`}</section>`;
}
// Animate the squad's walk once per visit, then remember how far we've shown them.
function mountRealm() {
  const el = $(".realm-root");
  if (!el || !window.EffortRealms || el.dataset.mounted === el.dataset.realmSteps) return;
  S.realm?.dispose?.();
  S.realm = EffortRealms.mount(el);
  el.dataset.mounted = el.dataset.realmSteps;
  store.set(el.dataset.realmKey, Number(el.dataset.realmSteps));
}
function tabJourney() {
  const Z = season(), C = seasonContent();
  if (!Z || !C) return `${updateBanner()}<section class="panel"><div class="ptitle"><span class="ic-badge gold">${ic("flag")}</span><h2 class="ol-sm">The next season</h2></div><p class="small muted" style="margin:0">It's on its way. Keep walking.</p></section>`;
  const got = claimedSet(), sq = squad();
  const hero = `<section class="panel jhero">
      <div class="caps gold-t">Season ${Z.n} · ${Z.upcoming ? `starts ${longDate(Z.start)}` : `week ${Z.week} of 13 · ends ${longDate(Z.end)}`}</div>
      <h1 class="ol disp">${esc(Z.name)}</h1>
      <p class="small muted" style="margin:0">${esc(C.blurb)}</p>
      ${affixLine(Z) ? `<div class="chips" style="margin-top:8px">${affixLine(Z)}</div>` : ""}
    </section>`;
  if (Z.upcoming) return `${updateBanner()}${hero}${realmPanel()}<section class="panel"><p class="small muted" style="margin:0">The season starts ${longDate(Z.start)}: a story chapter a week and three bounties every Monday.${G.affixInfo(Z.affix) ? ` This season's twist: ${esc(G.affixInfo(Z.affix).name)}.` : ""}</p></section>`;
  const firstLocked = C.chapters.findIndex((_, i) => !Z.chapters.includes(i + 1));
  const hidden = firstLocked < 0 ? 0 : C.chapters.length - firstLocked - 1;
  const chapters = C.chapters.slice(0, firstLocked < 0 ? undefined : firstLocked + 1).map((ch, i) => {
    const k = i + 1, open = Z.chapters.includes(k), read = got.has(`${Z.id}:ch:${k}`), M = G.seasonById(Z.id).miles;
    const why = !open ? (Z.week < k ? `opens in week ${k}` : `${fmt(M[i] - Z.miles)} more miles of walking`) : "";
    return `<button class="chap ${open ? "open" : "locked"} ${read ? "read" : ""}" ${open ? `data-act="chapter" data-k="${k}"` : "disabled"}>
        <span class="n">${read ? ic("check") : k}</span><span class="grow"><b>${open ? esc(ch.title) : "Locked"}</b><small>${why || `Chapter ${k}`}</small></span>
        ${open && !read ? `<span class="chip gold">+${G.RULES.chapterReward}</span>` : open ? "" : ic("lock")}</button>`;
  }).join("");
  const bounty = (b) => {
    const claimed = got.has(b.ref), pct = Math.min(1, b.have / b.need);
    return `<div class="bounty ${b.done ? "done" : ""}"><div class="row spread" style="gap:8px"><b>${esc(b.label)}</b>${b.current ? "" : `<span class="chip">Last week</span>`}</div>
        <div class="bar"><i style="width:${pct * 100}%"></i></div>
        <div class="row spread"><small class="muted">${b.need > 1 ? `${fmt(b.have)} / ${fmt(b.need)}` : b.done ? "Done" : "Not yet"}</small>
          ${claimed ? `<span class="chip green">${ic("check")} Claimed</span>` : b.done ? `<button class="btn xs gold" data-act="claim" data-what="bounty" data-ref="${b.ref}">Claim +${G.RULES.bountyReward}</button>` : `<span class="chip">+${G.RULES.bountyReward} each</span>`}</div></div>`;
  };
  const bounties = Z.bounties.filter((b) => b.current || (b.done && !got.has(b.ref)));
  const nextTier = Math.min(G.RULES.trackTiers, Z.track + 1), into = Z.mySteps - Z.track * G.RULES.trackSteps;
  const unclaimedTiers = Array.from({ length: Z.track }, (_, j) => j + 1).filter((k) => !got.has(`${Z.id}:tr:${k}`));
  const titles = Object.entries(G.TRACK_TITLES).filter(([k]) => got.has(`${Z.id}:tr:${k}`)).map(([, t]) => t);
  const set = I.ITEMS.filter((i) => i.set === Z.set);
  return `${updateBanner()}${hero}
    ${realmPanel()}
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("receipt")}</span><h2 class="ol-sm">The story</h2><span class="side chip">${Z.chapters.length} of 13 open</span></div>
      <p class="small muted" style="margin:-4px 0 10px">One a week, once the squad has walked far enough. ${G.RULES.chapterReward} Efforts each.</p>
      <div class="chaps">${chapters}${hidden ? `<div class="chap locked more"><span class="n">${ic("lock")}</span><span class="grow"><b>${hidden} more to come</b><small>One a week</small></span></div>` : ""}</div>
    </section>
    ${sq ? `<section class="panel">
      <div class="ptitle"><span class="ic-badge red">${ic("target")}</span><h2 class="ol-sm">This week's bounties</h2><span class="side chip">New on Monday</span></div>
      <p class="small muted" style="margin:-4px 0 10px">Squad goals. ${G.RULES.bountyReward} Efforts each when done.</p>
      <div class="bounties">${bounties.map(bounty).join("")}</div>
    </section>` : ""}
    <section class="panel">
      <div class="ptitle"><span class="ic-badge gold">${ic("trophy")}</span><h2 class="ol-sm">Season track</h2><span class="side chip">Tier ${Z.track} of ${G.RULES.trackTiers}</span></div>
      <p class="small muted" style="margin:-4px 0 10px">A tier every ${fmt(G.RULES.trackSteps)} steps. Every fifth pays more and gives a title.</p>
      <div class="track">${Array.from({ length: G.RULES.trackTiers }, (_, j) => { const k = j + 1, r = G.trackReward(k); return `<span class="tt ${k <= Z.track ? (got.has(`${Z.id}:tr:${k}`) ? "got" : "ready") : ""} ${r.title ? "big" : ""}" title="Tier ${k}: ${r.efforts} Efforts${r.title ? `, ${r.title}` : ""}">${r.title ? ic("crown") : k}</span>`; }).join("")}</div>
      ${Z.track < G.RULES.trackTiers ? `<div class="bar" style="margin-top:10px"><i style="width:${(into / G.RULES.trackSteps) * 100}%"></i></div><p class="tiny muted" style="margin:6px 0 0">${fmt(G.RULES.trackSteps - into)} steps to tier ${nextTier}${G.trackReward(nextTier).title ? ` and the title ${G.trackReward(nextTier).title}` : ""}. ${fmt(Z.mySteps)} steps this season.</p>` : `<p class="small" style="margin:8px 0 0">Every tier done. End to Ender.</p>`}
      ${titles.length ? `<div class="chips" style="margin-top:8px">${titles.map((t) => `<span class="chip gold">${ic("crown")} ${esc(t)}</span>`).join("")}</div>` : ""}
      ${unclaimedTiers.length ? `<button class="btn gold block" style="margin-top:12px" data-act="claim-track">Claim ${unclaimedTiers.length} tier${unclaimedTiers.length > 1 ? "s" : ""} · +${fmt(unclaimedTiers.reduce((s, k) => s + G.trackReward(k).efforts, 0))}</button>` : ""}
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("bag")}</span><h2 class="ol-sm">${esc(I.SETS[Z.set]?.name || "Season gear")}</h2><span class="side chip">This season only</span></div>
      ${setNote()}
      <div class="items">${set.map((i) => itemCard(i)).join("")}</div>
    </section>`;
}
function setNote() {
  const Z = season(), set = Z && I.SETS[Z.set];
  return set ? `<p class="small muted" style="margin:0 0 10px">Any class. ${esc(set.what)}. On sale until ${longDate(Z.end)}.</p>` : "";
}
function chapterSheet(k) {
  const Z = season(), C = seasonContent(); if (!Z || !C?.chapters[k - 1]) return;
  const ch = C.chapters[k - 1], read = claimedSet().has(`${Z.id}:ch:${k}`);
  openSheet(`${sheetHead(`Chapter ${k}`)}
    <div class="story"><div class="caps gold-t">${esc(C.landmarks[k - 1].name)}</div><h2 class="ol-sm disp">${esc(ch.title)}</h2>${ch.text.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    ${read ? `<button class="btn block" data-act="close-sheet">Close</button>` : `<button class="btn gold block xl" data-act="claim" data-what="chapter" data-k="${k}">Done reading · +${G.RULES.chapterReward}</button>`}`);
}
// A chapter plays as a click-through scene (story.js + stories.js); finishing it claims the chapter's reward.
// Without the story files (an old cached copy), it falls back to the plain text sheet.
async function playChapter(k) {
  const Z = season(); if (!Z) return;
  const mates = (squad()?.members || []).filter((m) => m.id !== me().id);
  const mate = mates.length ? mates[Math.floor(Math.random() * mates.length)].name : "your mate";
  const ctx = { you: me().name, squad: squad()?.name || "your squad", mate, mates: mates.map((m) => m.name), steps: fmt(S.D.today.steps), season: Z.name, cls: myClass().name };
  const script = window.EffortStories?.chapter?.(Z.id, k, ctx);
  if (!script?.length || !window.EffortStory?.play) return chapterSheet(k);
  const portrait = (who) => {
    if (who === "you") return face(me().id, 96);
    if (who.startsWith("mate:")) { const m = squad()?.members.find((x) => x.name === who.slice(5)); return m ? face(m.id, 96) : ""; }
    if (who.startsWith("boss:")) return `<div class="has-fallback" style="width:120px;height:130px">${portraitImg("boss", who.slice(5), { w: 240, h: 260 })}</div>`;
    return "";
  };
  FX.play("tap");
  const hydrate = setInterval(hydratePortraits, 400);
  try { await EffortStory.play(script, { ctx, portrait, title: window.EffortStories.title?.(Z.id, k) }); }
  finally { clearInterval(hydrate); }
  if (!claimedSet().has(`${Z.id}:ch:${k}`) && Z.chapters.includes(k)) claim("chapter", k);
}
async function claim(what, k, ref) {
  if (S.busy) return;
  S.busy = true;
  try {
    const r = await call("season_claim", { token: S.token, what, k, ref });
    season().claimed.push(r.ref); S.D.wallet = r.wallet;
    FX.play("coin"); toast(`+${fmt(r.amount)} Efforts`);
    if (!$("#sheet").hidden) closeSheet();
    render();
  } catch (e) { toast(e.message); }
  finally { S.busy = false; }
}
async function claimTrack() {
  const Z = season(); if (!Z || S.busy) return;
  S.busy = true;
  let total = 0;
  const btn = $("[data-act=claim-track]"); if (btn) { btn.disabled = true; btn.textContent = "Claiming…"; }
  try {
    for (let k = 1; k <= Z.track; k++) {
      if (claimedSet().has(`${Z.id}:tr:${k}`)) continue;
      const r = await call("season_claim", { token: S.token, what: "track", k });
      Z.claimed.push(r.ref); S.D.wallet = r.wallet; total += r.amount;
    }
  } catch (e) { toast(e.message); }
  finally { S.busy = false; }
  if (total) { FX.play("levelup"); toast(`+${fmt(total)} Efforts`); }
  render();
}

// ---------- the Den ----------
const denFmt = (r, v) => (r.fmt === "s" ? `+${(Math.round(v * 100) / 100).toString()}s` : `${r.mod === "upgrade" ? "−" : "+"}${Math.round(v * 1000) / 10}%`);
function denPanel() {
  if (!squad()) return "";
  const F = S.D.features || {}, D = S.D.squad.den;
  if (!F.den || !D) return `<section class="panel"><div class="ptitle"><span class="ic-badge">${ic("door")}</span><h2 class="ol-sm">The Den</h2><span class="side chip">Opens ${G.FEATURES.den ? new Date(G.FEATURES.den + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "soon"}</span></div>
      <p class="small muted" style="margin:0">Your squad's base: ten rooms, ten levels each. Every level is a small bonus for everyone.</p></section>`;
  const rows = G.DEN_ROOMS.map((r) => {
    const L = D.levels[r.id] || 0, nx = G.denNext(D.totals[r.id] || 0), got = D.totals[r.id] || 0;
    const pct = nx ? Math.max(0, Math.min(1, 1 - nx.need / G.denCost(nx.level))) : 1;
    return `<button class="denroom" data-act="den-room" data-room="${r.id}"><span class="lv">${L}</span><span class="grow"><b>${esc(r.name)}</b><small>${esc(r.what)}${L ? ` ${denFmt(r, L * r.per)}` : ""}${nx ? ` · ${G.money(nx.need)} to level ${nx.level}` : " · maxed"}</small><span class="bar"><i style="width:${pct * 100}%"></i></span></span></button>`;
  }).join("");
  const total = Object.values(D.levels).reduce((s, v) => s + v, 0);
  return `<section class="panel"><div class="ptitle"><span class="ic-badge">${ic("door")}</span><h2 class="ol-sm">The Den</h2><span class="side chip">${total} of ${G.DEN_ROOMS.length * G.DEN_MAX}</span></div>
    <p class="small muted" style="margin:-4px 0 10px">Everyone chips in. Each level helps the whole squad.</p><div class="denrooms">${rows}</div></section>`;
}
function denSheet(id) {
  const r = G.DEN_ROOMS.find((x) => x.id === id), D = S.D.squad?.den; if (!r || !D) return;
  const L = D.levels[id] || 0, nx = G.denNext(D.totals[id] || 0), w = S.D.wallet;
  openSheet(`${sheetHead(esc(r.name))}
    <p class="small muted" style="margin-top:0">${esc(r.what)} for the whole squad: ${denFmt(r, r.per)} a level, up to ${denFmt(r, r.per * G.DEN_MAX)}. Level ${L} now.</p>
    ${nx ? `<p class="small">${G.money(nx.need)} to level ${nx.level}. You have ${G.money(w)}.</p>
      <div class="btn-row">${[100, 500, 2000, nx.need].filter((v, i, arr) => v <= w && arr.indexOf(v) === i).map((v) => `<button class="btn ${v === nx.need ? "gold" : ""}" data-act="den-give" data-room="${id}" data-amount="${v}">${v === nx.need ? "Finish the level " : "+"}${priceTag(v)}</button>`).join("") || `<p class="small muted">Walk a bit more first.</p>`}</div>`
      : `<p class="small">Maxed out. Nice work.</p>`}`);
}
async function denGive(room, amount) {
  if (S.busy) return; S.busy = true;
  try {
    const r = await call("den_give", { token: S.token, room, amount });
    S.D.wallet = r.wallet; S.D.squad.den = r.den; FX.play("buy"); toast(`Put ${G.money(r.gave)} into the ${G.DEN_ROOMS.find((x) => x.id === room).name} · level ${r.level}`);
    closeSheet(); render();
  } catch (e) { toast(e.message); } finally { S.busy = false; }
}

// ---------- the wardrobe (Me tab) ----------
function wardrobePanel() {
  const F = S.D.features || {};
  if (!F.wardrobe) return `<section class="panel"><div class="ptitle"><span class="ic-badge">${ic("star")}</span><h2 class="ol-sm">Wardrobe</h2><span class="side chip">Opens ${new Date(G.FEATURES.wardrobe + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span></div>
      <p class="small muted" style="margin:0">Colours for your ninja, and titles. Some are only won from event bosses.</p></section>`;
  const owned = new Set(me().owned || []), wear = me().wear || {};
  const card = (w) => {
    const on = wear[w.kind] === w.id, have = owned.has(w.id);
    const sw = w.color ? `<span class="sw" style="background:${w.color}"></span>` : `<span class="sw title">${ic("crown")}</span>`;
    const act = on ? `<span class="chip green">Wearing</span>` : have ? `<button class="btn xs blue" data-act="wear" data-kind="${w.kind}" data-id="${w.id}">Wear</button>`
      : w.event ? `<span class="chip">${esc(G.EVENTS.find((e) => e.id === w.event)?.name || "Event")}</span>` : `<button class="btn xs gold" data-act="wear-buy" data-id="${w.id}" ${S.D.wallet < w.price ? "disabled" : ""}>${priceTag(w.price)}</button>`;
    return `<div class="wcard">${sw}<span class="grow"><b>${esc(w.name)}</b></span>${act}</div>`;
  };
  const group = (kind, label) => `<span class="field-label">${label}${wear[kind] ? ` · <button class="linkbtn" data-act="wear" data-kind="${kind}" data-id="">take off</button>` : ""}</span><div class="wgrid">${G.WARDROBE.filter((w) => w.kind === kind).map(card).join("")}</div>`;
  return `<section class="panel"><div class="ptitle"><span class="ic-badge">${ic("star")}</span><h2 class="ol-sm">Wardrobe</h2></div>
    ${group("suit", "Suits")}${group("band", "Headbands")}${group("title", "Titles")}</section>`;
}
async function wardrobe(body, msg) {
  if (S.busy) return; S.busy = true;
  try {
    const r = await call("wardrobe", { token: S.token, ...body });
    if (r.owned) me().owned = r.owned;
    if (r.wear) me().wear = r.wear;
    if (r.wallet != null) S.D.wallet = r.wallet;
    ANS[me().id] = answersOf(me());
    FX.play(body.buy ? "buy" : "tap"); if (msg) toast(msg);
    render();
    return true;
  } catch (e) { toast(e.message); return false; } finally { S.busy = false; }
}
const titleOf = (p) => G.wardrobeById(p?.wear?.title)?.name || null;

// ---------- the Midweek Hunt ----------
function huntCard() {
  const H = S.D.hunt; if (!H) return "";
  if (!H.open) return H.done ? "" : `<section class="panel huntcard dim"><div class="caps">Midweek Hunt</div><p class="small muted" style="margin:4px 0 0">Next one ${new Date(H.next + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, noon to 11pm.</p></section>`;
  if (H.done) return `<section class="panel huntcard dim"><div class="caps">Midweek Hunt</div><p class="small muted" style="margin:4px 0 0">Done for this week. Next Wednesday.</p></section>`;
  return `<section class="panel huntcard"><div class="caps">Midweek Hunt · today until 11pm</div><h2 class="ol disp">${esc(H.boss)}</h2>
    <p class="small" style="margin:0">Five minutes against your squad's boss, with ${H.roster.length - 1} squad-mate${H.roster.length === 2 ? "" : "s"} as bots. You keep your share.</p>
    <button class="btn gold block" style="margin-top:10px" data-act="hunt">${ic("target")} Start the Hunt</button></section>`;
}
function startHunt() {
  const H = S.D.hunt; if (!H?.open || H.done) return;
  FX.unlock();
  for (const m of H.roster) ANS[m.id] = { ...(m.answers && m.answers.time ? m.answers : Walker.fallbackAnswers(m.id)), ...wearOf(m.wear) };
  const R = G.raidCreate(H.roster, { seed: H.seed, tier: H.tier, minutes: H.minutes, affix: H.affix, den: H.den });
  V.raid = {
    hunt: true, raid: { id: "hunt", goal: { affix: H.affix, den: H.den } }, roster: Object.fromEntries(H.roster.map((m) => [m.id, m])), my: me().id, R, host: true, A: null,
    present: Object.fromEntries(H.roster.map((m) => [m.id, 0])), heard: {}, tapBudget: {}, joinedAt: now(), out: { taps: 0, ab: false, sp: false, move: null, ans: null }, fxOut: [], snapAt: 0,
    lastSent: 0, lastSave: Infinity, q: null, taps: 0, lvlBefore: level(), rosterKey: "", hostLast: performance.now(),
  };
  S.view = "raid";
  render();
  V.raid.timer = setInterval(raidTick, 50);
}

// ---------- This week: the table everything hangs off ----------
function weekPanel() {
  if (!squad()) return noSquadPanel();
  const T = weekRows(), by = ["today", "all"].includes(S.lbBy) ? S.lbBy : "week";
  const rows = T.rows.map((r) => ({ ...r, today: todayOf(r.id), all: allOf(r.id).steps, lost: weekDays(r.id).reduce((a, d) => a + d.lost, 0) }));
  const val = (r) => (by === "today" ? r.today : by === "all" ? r.all : r.weekSteps), top = Math.max(1, ...rows.map(val));
  if (by !== "week") rows.sort((a, b) => val(b) - val(a));
  const avg = rows.reduce((a, r) => a + val(r), 0) / Math.max(1, rows.length);
  return `<section class="panel" id="week-panel">
      <div class="ptitle"><span class="ic-badge">${ic("trophy")}</span><h2 class="ol-sm">Leaderboard</h2><span class="side chip">Avg ${fmt(avg)}</span></div>
      <div class="seg" style="margin-bottom:8px">${[["today", "Today"], ["week", "This week"], ["all", "All time"]].map(([k, l]) => `<button data-act="lb-by" data-by="${k}" aria-pressed="${by === k}">${l}</button>`).join("")}</div>
      <div class="wtable">${rows.map((r, i) => { const t = by === "week" ? r.title : null; return `<button class="wrow ${r.you ? "me" : ""} ${t || ""}" data-steps="${r.id}" aria-label="${esc(r.you ? "Your" : `${r.name}'s`)} week">
          <span class="wn">${t === "top" ? ic("crown") : i + 1}</span>
          <span class="wface">${face(r.id, 36)}</span>
          <span class="grow" style="min-width:0"><b>${esc(r.you ? "You" : r.name)}</b>${t === "top" ? '<span class="chip gold">Top walker</span>' : t === "last" ? '<span class="chip red">Dead weight</span>' : by === "week" && r.fresh ? '<span class="chip">New</span>' : ""}
            <i class="wbar"><s style="width:${(val(r) / top) * 100}%"></s></i>
            <small class="pw ${r.stride > 1 ? "up" : r.stride < 1 ? "down" : ""}">×${r.stride.toFixed(2)} raid power</small></span>
          <span class="lbn"><b class="num">${fmt(val(r))}</b><small>${{ today: "today", week: "this week", all: "all time" }[by]}</small>${by === "week" && r.lost ? `<small class="cut-t">${ic("bolt")}−${fmt(r.lost)}</small>` : ""}</span>
        </button>`; }).join("")}</div>
      <button class="invite-row" data-act="invite">${ic("share")}<span class="grow">Invite to ${esc(squad().name)}</span><span class="small muted">Code</span><b class="code-chip">${squad().code}</b></button>
      <p class="tiny faint" style="margin:10px 0 0">Tap anyone for their week. Monday to Sunday. Your raid power is your steps ÷ the squad average (×${G.RULES.strideMin} to ×${G.RULES.strideMax}). On Sunday the top walker gets +${Math.round(G.RULES.topLoot * 100)}% loot and ${Math.round(G.RULES.slackerTax * 100)}% of the bottom walker's week.</p>
    </section>`;
}
function noSquadPanel() {
  return `<section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("squad")}</span><h2 class="ol-sm">No squad yet</h2></div>
      <p class="small muted" style="margin:0 0 12px">Make a squad and share the link, or join one with a code.</p>
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
      <button class="tile gold tilebtn" data-act="steps-week"><div class="k">${ic("coin")} Earned today ${ic("arrowRight")}</div><div class="v">${effortTag(T.efforts)}<small>${S.D.today.debt ? `<s class="was">${fmt(S.D.today.rawSteps)}</s> <span class="cut-t">${fmt(S.D.today.steps)}</span>` : fmt(S.D.today.steps)} steps</small></div></button>
      <div class="tile red"><div class="k">${ic("warning")} At stake</div><div class="v">${Math.round(T.taxRate * 100)}%<small>${stake} Efforts</small></div></div>
      <div class="tile"><div class="k">${ic("heart")} Taxman health</div><div class="v num">${fmt(T.hp)}</div></div>
      <div class="tile cyan"><div class="k">${ic("phone")} App time</div><div class="v">${S.D.today.scrollLinked ? sc ?? 0 : "Not linked"}<small>${S.D.today.scrollLinked ? `/ ${G.scrollBudget(S.D.today.steps)} min allowed` : `counts as ${G.RULES.unlinkedOverMin} min over`}</small></div></div>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">
      ${T.pace > 0 ? `<span class="chip green">${ic("steps")} Ahead of the squad · −${Math.round(G.RULES.paceTax * 100)}% tax</span>` : T.pace < 0 ? `<span class="chip red">${ic("steps")} Behind the squad · +${Math.round(G.RULES.paceTax * 100)}% tax</span>` : squad()?.members.length > 1 ? `<span class="chip">${ic("steps")} Level with the squad</span>` : ""}
      ${S.D.today.debt ? `<button class="chip red" data-act="steps-week">${ic("bolt")} Paralysed: −${fmt(S.D.today.debt)} steps today</button>` : ""}
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
    btn = `<div class="rline total" style="margin-top:12px"><span>Banked today</span><span class="rv">${paid ? signedEfforts(paid.amount + Math.max(0, pendingToday().n)) : "–"}</span></div>
      <p class="tiny faint" style="margin:6px 0 0">This covers all of today's steps, so keep walking.${w.test ? "" : ` Next fight in <span data-count="${w.next}">${countdown(w.next - now())}</span>.`}</p>`;
  } else if (st === "soon") {
    chip = `<span class="chip gold">${ic("clock")} Tonight · 6pm to 9pm</span>`;
    line = `Wants ${Math.round(T.taxRate * 100)}% of today's Efforts. Fight him any time from 6 to 9pm.`;
    btn = `<button class="btn xl block" style="margin-top:14px" disabled>${ic("clock")} Opens in <span data-count="${w.opens}">${countdown(w.opens - now())}</span></button>${NATIVE ? (S.native?.reminders ? "" : `<button class="btn xs block" style="margin-top:10px" data-act="native-reminders-on">${ic("bell")} Ping me when he's in</button>`) : S.push === "off" ? `<button class="btn xs block" style="margin-top:10px" data-act="push-on">${ic("bell")} Ping me when he's in</button>` : ""}`;
  } else {
    chip = `<span class="chip red">${ic("warning")} Missed tonight</span>`;
    line = `No fight, so he takes ${Math.round(T.taxRate * 100)}% of today. The rest goes straight in.`;
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
  return `<section class="panel flat"><div class="ptitle"><h2 class="ol-sm">History</h2></div>
    <div class="feedlist">${rows.map((r) => `<div class="it"><span class="grow">${esc(label(r))}</span><span class="amt ${r.amount >= 0 ? "plus" : "minus"}">${signedEfforts(r.amount)}</span></div>`).join("")}</div></section>`;
}
// The end of the test fortnight: who's leading for Pathfinder, the reset at 11:59pm, and (the day after) who won.
function testEndCard() {
  const E = G.TEST_END, day = S.D.today.day, sq = squad();
  if (!sq || day > G.dayOf(G.dayNo(E.day) + 1)) return "";
  const skin = G.skinById(E.champion), champ = sq.members.find((m) => m.wear?.skin === skin.id);
  const before = day === E.day && new Date().getHours() < 12 && !champ;
  const leader = before ? sq.members.slice().sort((a, b) => b.weekSteps - a.weekSteps)[0] : null;
  const who = (m, line) => `<div class="champ-row">${face(m.id, 40)}<span class="grow"><b>${esc(m.id === me().id ? "You" : m.name)}</b><small>${line}</small></span></div>`;
  const body = day === E.day
    ? `${before && leader ? `<p class="small" style="margin:0 0 8px">Most steps by <b>12pm</b> wins <b>${esc(skin.name)}</b>, a one-off skin.</p>${who(leader, `Leading with ${fmt(leader.weekSteps)}`)}`
        : champ ? who(champ, `Won ${esc(skin.name)}`) : ""}
      <p class="small muted" style="margin:10px 0 0"><b>Everything resets at 11:59pm.</b> Bought skins stay.</p>`
    : `<p class="small" style="margin:0 0 8px">Everyone starts from zero. Good luck.</p>${champ ? who(champ, `Test season champion`) : ""}`;
  return `<section class="panel champ"><div class="ptitle"><span class="ic-badge gold">${ic("trophy")}</span><h2 class="ol-sm">${day === E.day ? "Last day of the test" : "Season 1 starts now"}</h2></div>${body}</section>`;
}
// Home: steps first. Yours today (with this week and all time), one line for whatever's on, then everyone's.
function tabToday() {
  return `${updateBanner()}${stepsHero()}${nowStrip()}${weekPanel()}`;
}
function stepsHero() {
  const t = S.D.today, wk = weekDays(me().id).reduce((a, d) => a + d.counted, 0), all = S.D.allTime?.steps ?? 0;
  return `<section class="panel stepshero">
      <button class="sh-main" data-act="steps-week" aria-label="Your week">
        <span class="caps">${ic("steps")} Today</span>
        <b class="sh-n num">${fmt(t.steps)}</b>
        ${t.debt ? `<span class="small"><s class="was">${fmt(t.rawSteps)}</s> <span class="cut-t">−${fmt(t.debt)} paralysed</span></span>` : `<span class="small muted">${fmt(G.effortsFromSteps(t.steps))} Efforts earned</span>`}
      </button>
      <div class="sh-row"><button data-act="steps-week"><small>This week</small><b class="num">${fmt(wk)}</b></button><button data-act="steps-week"><small>All time</small><b class="num">${fmt(all)}</b></button></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">${syncChip()}</div>
    </section>`;
}
// What's on right now, in one line; the fights themselves are on the Fight tab.
function nowStrip() {
  const tx = taxState(), rs = raidState(), H = S.D.hunt, pct = Math.round(taxSetup().taxRate * 100);
  const [txt, hot] = rs === "live" ? ["The raid's on", 1] : rs === "open" ? ["Raid lobby's open till 9pm", 1]
    : ["open", "live"].includes(tx) ? [`The Taxman's in till 9pm · wants ${pct}%`, 1] : H?.open && !H.done ? ["Midweek Hunt's on till 11pm", 1]
    : tx === "soon" ? [`Taxman at 6pm · wants ${pct}%`, 0] : tx === "done" ? ["Taxman done for today", 0] : ["Taxman's gone for today", 0];
  return `<button class="panel nowstrip ${hot ? "hot" : ""}" data-tab="raid">${ic(hot ? "sword" : "clock")}<span class="grow">${txt}</span>${ic("arrowRight")}</button>`;
}
// How a day works: tucked away on the Fight tab, open it if you want it.
function howDay() {
  return `    <details class="panel howbox"><summary class="ptitle"><span class="ic-badge">${ic("info")}</span><h2 class="ol-sm">How a day works</h2></summary>
      <div class="how">
        <div class="hrow"><span class="hic">${ic("coin")}</span><div><b>Walk to earn</b><span>Every ${fmt(G.RULES.stepsPerEffort)} steps is 1 Effort, up to ${G.RULES.dailyEffortCap} a day. Gear costs Efforts.</span></div></div>
        <div class="hrow"><span class="hic">${ic("trophy")}</span><div><b>Out-walk your mates</b><span>Beat the squad's average today and the Taxman takes ${Math.round(G.RULES.paceTax * 100)} points less; fall 10% behind and he takes ${Math.round(G.RULES.paceTax * 100)} more.</span></div></div>
        <div class="hrow"><span class="hic">${ic("sword")}</span><div><b>6pm to 9pm: five minutes to fight</b><span>He takes ${Math.round(G.RULES.baseTax * 100)}% (more if you scrolled over budget). Every hit cuts it. Knock him out to keep it all, then keep tapping to steal up to ${Math.round(taxSetup().stealCap * 100)}% extra.</span></div></div>
        <div class="hrow"><span class="hic">${ic("target")}</span><div><b>Audits and receipts</b><span>When he Audits you only the moving target takes damage. Golden receipts knock 3% off his health.</span></div></div>
      </div>
    </details>`;
}

// ---------- Raid ----------
// Each stat with what it does for you right now (gear included). Your class's two stats are marked.
function statRows(st, gear = me().gear, inv = S.D.inv) {
  const { g } = G.loadout(st, gear, inv), fx = G.statEffects(g), mine = G.classOf(st).stats;
  const max = Math.max(10, ...Object.values(g));
  return G.STATS.map((s) => {
    const [icon, col] = STAT_LOOK[s.id];
    return `<div class="stat fx${mine.includes(s.id) ? " cl" : ""}" title="${esc(s.what)}"><span class="sic" style="background:${col}">${ic(icon)}</span><span class="sn">${s.label}</span>
      <div class="bar"><i class="base" style="--sc:${col};width:${(st[s.id] / max) * 100}%"></i><i class="gear" style="width:${((g[s.id] - st[s.id]) / max) * 100}%"></i></div><span class="sv">${+g[s.id].toFixed(1)}</span><small class="sfx">${esc(fx[s.id])}</small></div>`;
  }).join("");
}
// What Sunday looks like if the whole squad turns up (gear upgrades on teammates aren't counted here).
function raidPreview() {
  const sq = squad(), T = weekRows();
  const members = sq.members.map((m) => {
    const row = T.rows.find((r) => r.id === m.id);
    return { id: m.id, name: m.name, stats: G.stats(m.character || {}), equipped: m.id === me().id ? me().gear : m.gear, inv: m.id === me().id ? S.D.inv : {}, weekSteps: m.weekSteps, stride: row.stride, title: row.title };
  });
  return G.raidCreate(members, { seed: 1, tier: raidTier(), enraged: !goalNow().met });
}
// This week's squad goal (see Game.squadGoal): once the raid has started, the server's frozen copy.
const goalNow = (tier = raidTier()) => (S.D.raid?.goal && S.D.raid.tier === tier ? S.D.raid.goal : G.squadGoal(tier, weekRows().rows));
function goalPanel() {
  if (!squad()) return "";
  const g = goalNow(), boss = G.bossFor(raidTier()), pct = Math.min(1, g.steps / Math.max(1, g.target));
  const left = Math.max(0, g.target - g.steps), daysLeft = Math.max(1, 6 - ((new Date().getDay() + 6) % 7));
  const frozen = !!S.D.raid?.goal;
  return `<section class="panel goal ${g.met ? "met" : ""}">
      <div class="ptitle"><span class="ic-badge ${g.met ? "green" : "red"}">${ic(g.met ? "check" : "steps")}</span><h2 class="ol-sm">Squad goal</h2><span class="side chip ${g.met ? "green" : "red"}">${g.met ? "Made it" : frozen ? "Missed" : `${fmt(left)} to go`}</span></div>
      <div class="goalbar"><i style="width:${pct * 100}%"></i><span>${fmt(g.steps)} / ${fmt(g.target)} steps</span></div>
      <p class="small muted" style="margin:10px 0 0">${g.met
        ? `${esc(boss.name)} stays normal on Sunday. Every step past this still raises your raid power.`
        : frozen ? `The squad missed the goal, so ${esc(boss.name)} is enraged: ${G.RULES.enragedHp}× health and hits ${G.RULES.enragedDmg}× harder.`
        : `Between you, average ${fmt(g.perDay)} steps a day each, Monday to Saturday (Sunday's count too). Miss it and ${esc(boss.name)} is <b>enraged</b> on Sunday: ${G.RULES.enragedHp}× health and hits ${G.RULES.enragedDmg}× harder. About ${fmt(left / g.players / daysLeft)} a day each from here.`}</p>
      <p class="tiny faint" style="margin:6px 0 0">${fmt(g.perDay)} × ${g.days ?? g.players * 6} player-days, Monday to Saturday. Each boss up the ladder asks 500 more a day.</p>
    </section>`;
}
const poolFor = (R) => G.RULES.raidRewardPerMember * R.members.length * R.lvl ** G.RULES.raidRewardCurve * R.boss.reward * R.timeShare;
function raidHero() {
  const st = raidState(), w = S.D.windows.raid;
  const P = raidPreview(), boss = P.boss, mine = P.members.find((m) => m.id === me().id);
  let chip, btn;
  const inLobby = S.D.raid?.lobby?.length || 0;
  if (st === "open") {
    chip = `<span class="chip green pulse">${ic("raid")} Lobby open · <span data-count="${w.closes}">${countdown(w.closes - now())}</span></span>`;
    btn = `<button class="btn green xl block" style="margin-top:14px" data-act="lobby">${ic("squad")} Join the lobby${inLobby ? ` · ${inLobby} there` : ""}</button>`;
  } else if (st === "live") {
    chip = `<span class="chip green pulse">${ic("raid")} Raid on now</span>`;
    btn = `<button class="btn green xl block" style="margin-top:14px" data-act="raid">${ic("raid")} Back into the fight</button>`;
  } else if (st === "without") {
    chip = `<span class="chip">${ic("raid")} Raid on now</span>`;
    btn = `<button class="btn xl block" style="margin-top:14px" disabled>It started without you</button>`;
  } else if (st === "done") {
    const r = S.D.raid.result;
    chip = `<span class="chip">${ic("check")} This week's raid is done</span>`;
    btn = `<button class="btn blue block" style="margin-top:14px" data-act="raid-result">${ic("chest")} ${r.how === "won" ? "Won" : r.how === "wiped" ? "Wiped" : "Out of time"} · see results</button>`;
  } else {
    chip = `<span class="chip red">${ic("raid")} Sunday · 6–9pm</span>`;
    btn = `<button class="btn xl block" style="margin-top:14px" disabled>${ic("clock")} Opens in <span data-count="${w.opens}">${countdown(w.opens - now())}</span></button>`;
  }
  return `<section class="panel hero">
      <div class="art"><div class="bg" style="background:radial-gradient(90% 120% at 80% 100%, #5a4bb0 0%, #24306e 45%, #121a44 100%)"></div>
        <div class="label">${chip}${w.test ? ' <span class="chip cyan">Test</span>' : ""}${boss.enraged ? ` <span class="chip red">${ic("bolt")} ${S.D.raid?.goal ? "Enraged" : "Rage risk"}</span>` : ""}<h3 class="ol">${esc(boss.name)}</h3><p>Boss ${boss.tier}${boss.lap > 1 ? ` · Lap ${boss.lap}` : ""}. ${esc(boss.title)}${/[.!?]$/.test(boss.title) ? "" : "."}</p><p class="bstyle">${esc(boss.style || "")}</p></div>
        <div class="portrait">${portraitImg("boss", boss.id, { w: 300, h: 320 })}</div></div>
      <div class="body">
        <div class="tiles">
          <div class="tile red"><div class="k">${ic("heart")} Health</div><div class="v num">${fmt(boss.max)}</div></div>
          <div class="tile"><div class="k">${ic("bolt")} Hits</div><div class="v">×${boss.dmg.toFixed(2)}<small>vs Brett</small></div></div>
          <div class="tile gold"><div class="k">${ic("chest")} Win reward</div><div class="v">${effortTag(poolFor(P))}<small>squad</small></div></div>
          <div class="tile ${mine.stride > 1 ? "green" : mine.stride < 1 ? "red" : ""}"><div class="k">${ic("steps")} Your power</div><div class="v">×${mine.stride.toFixed(2)}<small>from steps</small></div></div>
        </div>${btn}
        <p class="tiny faint" style="margin:10px 0 0">Sunday 6–9pm. When ${G.RULES.raidSquadSize} or more of you are in the lobby and ready, the 15-minute fight starts.</p>
      </div>
    </section>`;
}
function tabRaid() {
  const live = ["open", "live"].includes(raidState());
  const daily = `${taxHero()}${huntCard()}${eventCard()}`;
  if (!squad()) return `${daily}${noSquadPanel()}${howDay()}${howRaids()}`;
  const st = myStats(), cls = myClass(), sug = G.suggestedPosition(st), pos = me().pos || sug, tier = squad().tier;
  const lap = Math.floor((tier - 1) / G.BOSSES.length) + 1;
  return `${live ? `${raidHero()}${daily}` : `${daily}${raidHero()}`}${goalPanel()}
    <section class="panel">
      <div class="ptitle"><span class="ic-badge red">${ic("ladder")}</span><h2 class="ol-sm">The ladder</h2><span class="side chip">Lap ${lap}</span></div>
      <div class="ladder">${G.BOSSES.map((b, i) => {
        const t = (lap - 1) * G.BOSSES.length + i + 1, state = t < tier ? "beaten" : t === tier ? "next" : "locked";
        return `<div class="rung ${state}"><span class="n">${state === "beaten" ? ic("check") : i + 1}</span><span class="grow"><b>${esc(b.name)}</b><small>${esc(b.title)}</small><small class="bstyle">${esc(b.style || "")}</small></span>${state === "next" ? `<span class="chip gold">Next</span>` : state === "locked" ? `<span class="lockic">${ic("lock")}</span>` : ""}</div>`;
      }).join("")}</div>
      <p class="small muted" style="margin:10px 0 0">Each Sunday: last week's boss, one up or one down. Climb before your gear's ready and you'll lose. After Vex the bosses come round again, tougher and richer.</p>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("crown")}</span><h2 class="ol-sm">${esc(cls.name)}</h2><span class="side chip gold">Best: ${G.posOf(sug).label}</span></div>
      <p class="small muted" style="margin:-4px 0 8px">${esc(cls.blurb)}</p>
      <div class="special-card" style="--sc:${SPECIAL_COL[cls.id] || "#ffd166"}"><span class="si">${ic(G.specialOf({ cls: cls.id }).icon)}</span><span><small>Class special</small><b>${esc(G.specialOf({ cls: cls.id }).name)}</b><span>${esc(G.specialOf({ cls: cls.id }).what)}</span></span></div>
      ${statRows(st)}
      <span class="field-label">Where you start on Sunday</span>
      <div class="seg">${G.POSITIONS.map((p) => `<button data-pos="${p.id}" aria-pressed="${p.id === pos}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div>
      <p class="tiny faint" style="margin:8px 0 0">${esc(G.posOf(pos).ability)}: ${esc(G.posOf(pos).abilityWhat)}. ${pos === sug ? `The ${G.posOf(sug).label.toLowerCase()} is every ${esc(cls.name)}'s home row.` : `Every ${esc(cls.name)}'s home row is the ${G.posOf(sug).label.toLowerCase()}. Here you hit ${Math.round((1 - G.posFit(G.loadout(st, me().gear, S.D.inv).g, pos, sug) ** 1.5) * 100)}% weaker and take more damage.`} You can move rows during the fight.</p>
    </section>
    ${denPanel()}
    ${S.D.lastRaid && S.D.raid?.status !== "done" ? lastRaidPanel(S.D.lastRaid) : ""}
    ${howDay()}${howRaids()}`;
}
function lastRaidPanel(L) {
  const r = L.result, mine = r.shares?.find((s) => s.id === me().id);
  return `<section class="panel flat"><div class="ptitle"><h2 class="ol-sm">Last raid: ${esc(r.boss)}</h2><span class="side chip ${r.how === "won" ? "green" : "red"}">${r.how === "won" ? "Won" : r.how === "wiped" ? "Wiped" : "Out of time"}</span></div>
    <p class="small muted" style="margin:0">${Math.round(r.frac * 100)}% dealt${mine ? ` · you took home ${fmt(mine.total)} Efforts` : " · you weren't there"}.</p></section>`;
}
function howRaids() {
  return `<details class="panel howbox"><summary class="ptitle"><span class="ic-badge">${ic("info")}</span><h2 class="ol-sm">How raids work</h2></summary>
      <div class="how">
        <div class="hrow"><span class="hic">${ic("steps")}</span><div><b>Steps are power</b><span>Your week's steps against the squad's set how hard you hit and how big you stand. Half the loot goes by steps, half by the fight. The lowest walker gets hunted and pays ${Math.round(G.RULES.slackerTax * 100)}% of their week to the top walker, raid or no raid.</span></div></div>
        <div class="hrow"><span class="hic">${ic("squad")}</span><div><b>Three rows</b><span>${G.POSITIONS.map((p) => `${p.label}: ${p.ability}`).join(". ")}. Every row deals damage: the front hits hardest and hits back, the middle staggers wind-ups, the back crits from safety. Fill all three for +${Math.round(G.RULES.formationBonus * 100)}% (Formation). When the boss winds up on someone else, everyone else gets an opening (+${Math.round(G.RULES.openingBonus * 100)}%); if it's you, move rows to dodge. Every hit heals you a little (Second Wind). Your class's home row (yours is the ${G.posOf(G.suggestedPosition(myStats())).label.toLowerCase()}) gives a small bonus; with nobody at the front, every hit lands ${G.RULES.noFrontDmg}× harder.</span></div></div>
        <div class="hrow"><span class="hic">${ic("guard")}</span><div><b>Each row has a job</b><span>${G.POSITIONS.map((p) => `${p.label}, ${p.passive}: ${p.passiveWhat.charAt(0).toLowerCase() + p.passiveWhat.slice(1)}`).join(". ")}.</span></div></div>
        <div class="hrow"><span class="hic">${ic("star")}</span><div><b>Your class special</b><span>It charges as you tap, use your ability and take hits. Fire it when it glows. ${esc(G.specialOf({ cls: myClass().id }).name)}: ${esc(G.specialOf({ cls: myClass().id }).what)}.</span></div></div>
        <div class="hrow"><span class="hic">${ic("warning")}</span><div><b>Read the warnings</b><span>Every attack is called a couple of seconds early, and each boss has a signature move.</span></div></div>
        <div class="hrow"><span class="hic">${ic("brains")}</span><div><b>When someone falls</b><span>Everyone gets one question: name a thing in ${G.RULES.triviaSeconds}s. If ${Math.round(G.RULES.triviaFailShare * 100)}% of the squad gets theirs wrong, you're all paralysed and start tomorrow ${fmt(G.RULES.paralysedSteps)} steps down.</span></div></div>
        <div class="hrow"><span class="hic">${ic("upgrade")}</span><div><b>Gear wins it</b><span>The boss is the same however many turn up. Tougher bosses need better gear.</span></div></div>
        <div class="hrow"><span class="hic">${ic("squad")}</span><div><b>The lobby</b><span>Sunday 6–9pm. ${G.RULES.raidSquadSize} or more of you, everyone ready. One raid a week.</span></div></div>
      </div>
    </details>`;
}

// ---------- Shop ----------
function itemCard(item, { deal = false } = {}) {
  const inv = S.D.inv, t = G.tierOf(item.tier), own = item.id in inv, on = me().gear[item.slot] === item.id, locked = !own && t.lvl > level();
  const gone = !own && !G.onSale(item, S.D.today.day);
  const st = G.itemStats(item, inv[item.id] || 0, myStats()), price = G.priceOf(item, deal);
  return `<button class="item ${item.tier} ${locked ? "locked" : ""}" style="--rc:${t.color}" data-item="${item.id}" data-deal="${deal ? 1 : ""}" aria-label="${esc(item.name)}">
    <div class="art-wrap"><span class="rarity">${t.label}</span><div class="art">${itemArt(item)}</div>
      ${own && inv[item.id] ? `<span class="upb">+${inv[item.id]}</span>` : ""}${on ? `<span class="eq">${ic("check")}</span>` : ""}${deal && !own ? `<span class="deal">−${Math.round((1 - price / G.priceOf(item, false)) * 100)}%</span>` : ""}
      ${locked ? `<span class="lockover">${ic("lock")}</span>` : ""}</div>
    <div class="meta"><h4>${esc(item.name)}</h4>
      <div class="stats">${Object.entries(st).map(([k, v]) => `<span class="st" style="color:${STAT_LOOK[k][1]}">${ic(STAT_LOOK[k][0])}+${v}</span>`).join("")}</div></div>
    ${item.perk ? `<div class="perk">${esc(perkText(item.perk))}</div>` : item.set ? `<div class="perk">${esc(I.SETS[item.set]?.what || "")}</div>` : "<div></div>"}
    <div class="foot">${gone ? `<span class="buy">${G.seasonById(item.season) && S.D.today.day < G.seasonById(item.season).start ? `From ${new Date(G.seasonById(item.season).start + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Gone"}</span>` : locked ? `<span class="buy">Level ${t.lvl}</span>` : own ? `<span class="buy owned">${on ? "Equipped" : "Owned"}</span>` : `<span class="buy ${S.D.wallet < price ? "poor" : ""}">${coin(18)}${fmt(price)}</span>`}</div>
  </button>`;
}
// What wearing this instead would change: hit strength and health.
function swapLine(item) {
  const gear = me().gear, inv = S.D.inv, st = myStats();
  const now = G.loadout(st, gear, inv).g, then = G.loadout(st, { ...gear, [item.slot]: item.id }, { ...inv, [item.id]: inv[item.id] || 0 }).g;
  const flip = item.flip ? `<span class="tiny faint" style="display:block;margin-top:3px">Follows your best class stat.</span>` : "";
  if (gear[item.slot] === item.id) return flip ? `<div class="swapline">${flip}</div>` : "";
  const dh = Math.round((G.hitIndex(then) / G.hitIndex(now) - 1) * 100), dhp = G.edges(then).hp - G.edges(now).hp;
  const sg = (n, u = "") => `<b class="${n > 0 ? "up" : n < 0 ? "down" : ""}">${n > 0 ? "+" : ""}${n}${u}</b>`;
  return `<div class="swapline">Wearing this${gear[item.slot] ? " instead" : ""}: hits ${sg(dh, "%")} · health ${sg(dhp)}${flip}</div>`;
}
const dealsToday = () => G.dealsFor(S.D.today.day, myClass().id, level());
function tabShop() {
  const cls = myClass(), lvl = level(), inv = S.D.inv;
  const tierRank = (i) => I.TIERS.findIndex((t) => t.id === i.tier);
  const sort = (a, b) => tierRank(a) - tierRank(b) || G.SLOTS.indexOf(a.slot) - G.SLOTS.indexOf(b.slot);
  const lists = {
    class: I.ITEMS.filter((i) => i.cls === cls.id).sort(sort),
    all: I.ITEMS.filter((i) => !i.cls && !i.season && (S.shopSlot === "any" || !S.shopSlot || i.slot === S.shopSlot) && (!S.shopStyle || S.shopStyle === "any" || i.market === S.shopStyle)
      && G.tierOut(G.tierOf(i.tier), S.D.today.day) && (G.tierOf(i.tier).lvl <= lvl || G.tierOf(i.tier) === I.TIERS.find((t) => t.lvl > lvl && !t.season) || i.id in inv)).sort(sort),
    season: I.ITEMS.filter((i) => i.season && (G.onSale(i, S.D.today.day) || i.id in inv)).sort(sort),
    deals: dealsToday().map(G.itemById).filter(Boolean),
    bag: I.ITEMS.filter((i) => i.id in inv).sort(sort),
  };
  const tab = lists[S.shopTab] || S.shopTab === "gamba" || S.shopTab === "house" ? S.shopTab : "class";
  const next = I.TIERS.find((t) => t.lvl > lvl);
  const slotName = { weapon: "Weapon", armour: "Armour", trinket: "Trinket" };
  return `
    <div class="shopfeature">
      <button class="sf gamba" data-shoptab="gamba" aria-pressed="${tab === "gamba"}"><span class="sf-art">${bucketArt("legendary")}</span><span><b>Winny's Gamba Bucket</b><small>${Math.max(0, G.GAMBA.perDay - (S.D.gamba?.today || 0))} left today</small></span></button>
      <button class="sf house" data-shoptab="house" aria-pressed="${tab === "house"}"><span class="sf-art">${ic("crown")}</span><span><b>The House</b><small>Skins from ${G.pounds(G.SKIN_TIERS[0].pence)}</small></span></button>
    </div>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("guard")}</span><h2 class="ol-sm">Loadout</h2>${next ? `<span class="side chip">${ic("lock")} ${next.label} at Lv ${next.lvl}</span>` : ""}</div>
      <div class="loadout">${G.SLOTS.map((s) => {
        const it = G.itemById(me().gear[s]);
        return it ? `<button class="slot full" style="--rc:${G.tierOf(it.tier).color}" data-item="${it.id}" aria-label="${esc(it.name)}"><div class="art">${itemArt(it)}</div><span class="slab">${esc(it.name)}</span></button>`
          : `<div class="slot"><div class="ph">${ic({ weapon: "sword", armour: "guard", trinket: "star" }[s])}<span>${slotName[s]}</span></div></div>`;
      }).join("")}</div>
    </section>
    <div class="tabs-sub">${[["class", cls.name, 0], ["all", "Open market", 0], ...(lists.season.length ? [["season", "Season", 0]] : []), ["deals", "Deals", lists.deals.filter((i) => !(i.id in inv)).length], ["bag", "Bag", Object.keys(inv).length]].map(([k, l, n]) =>
      `<button data-shoptab="${k}" aria-pressed="${tab === k}">${esc(l)}${n ? `<span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>
    ${tab === "season" ? setNote() : ""}
    ${tab === "all" ? `<p class="small muted" style="margin:0">Gear any class can wear. Five styles in every tier, each with its own perk. Your class gear is a slightly better fit for you; these let you build your own way.</p>
      <div class="chips-row">${[["any", "All"], ["weapon", "Weapons"], ["armour", "Armour"], ["trinket", "Trinkets"]].map(([k, l]) => `<button class="fchip" data-shopslot="${k}" aria-pressed="${(S.shopSlot || "any") === k}">${l}</button>`).join("")}</div>
      <div class="chips-row">${[["any", "Any style"], ["power", "Power"], ["guard", "Guard"], ["speed", "Speed"], ["brains", "Brains"], ["luck", "Luck"]].map(([k, l]) => `<button class="fchip" data-shopstyle="${k}" aria-pressed="${(S.shopStyle || "any") === k}">${l}</button>`).join("")}</div>` : ""}
    ${tab === "deals" ? `<p class="small muted" style="margin:0">Three picks for your class each day, about ${Math.round(G.RULES.dealDiscount * 100)}% off. New ones at midnight.</p>` : ""}
    ${tab === "gamba" ? gambaPanel() : tab === "house" ? housePanel() : `<div class="items">${lists[tab].length ? lists[tab].map((i) => itemCard(i, { deal: tab === "deals" })).join("") : `<p class="muted small" style="grid-column:1/-1;text-align:center;padding:20px 0">${tab === "bag" ? "Nothing yet. Gear you buy lives here." : "Nothing here yet."}</p>`}</div>`}`;
}

// ---------- Winny's Gamba Bucket ----------
// Bought with Efforts only (never real money, and nothing in it can be cashed out). The server rolls; the bucket
// then plays that result out over three taps, climbing the rarity ladder no higher than what you actually won.
const GAMBA_RANK = { dud: 0, common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, jackpot: 6 };
const GAMBA_COL = { dud: "#5b6584", common: "#9aa6c4", rare: "#3d9bff", epic: "#a86bff", legendary: "#ffb21e", mythic: "#ff4d6a", jackpot: "#ffc83d" };
const bucketArt = (rar = "dud") => `<svg class="bucket-svg" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M30 34 Q60 4 90 34" fill="none" stroke="#0a0f26" stroke-width="7" stroke-linecap="round"/><path d="M30 34 Q60 4 90 34" fill="none" stroke="#c9cfe6" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M22 40 L98 40 L88 108 Q60 116 32 108 Z" fill="${GAMBA_COL[rar]}" stroke="#0a0f26" stroke-width="5" stroke-linejoin="round"/>
  <path d="M28 50 L92 50" stroke="rgba(255,255,255,.35)" stroke-width="4"/><path d="M33 96 Q60 103 87 96" stroke="rgba(0,0,0,.22)" stroke-width="5" fill="none"/>
  <ellipse cx="60" cy="40" rx="38" ry="7" fill="#1b2350" stroke="#0a0f26" stroke-width="5"/>
  <circle cx="45" cy="37" r="5" fill="#ffc83d" stroke="#0a0f26" stroke-width="2"/><circle cx="62" cy="35" r="5" fill="#ffe58a" stroke="#0a0f26" stroke-width="2"/><circle cx="76" cy="38" r="4.5" fill="#ffc83d" stroke="#0a0f26" stroke-width="2"/>
  <text x="60" y="84" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="30" fill="#fff" stroke="#0a0f26" stroke-width="5" paint-order="stroke">W</text></svg>`;
function gambaPanel() {
  const Gm = G.GAMBA, used = S.D.gamba?.today || 0, left = Math.max(0, Gm.perDay - used), credits = S.D.gamba?.credits || 0, week = S.D.gamba?.weekPence || 0, junk = junkDrawer();
  const pack = (pk) => { const it = G.houseItem(pk.id), over = week + pk.pence > Gm.weeklyPence;
    return `<button class="btn ${it.link && !over ? "green" : ""} block" data-act="house-pay" data-id="${pk.id}" ${it.link && !over ? "" : "disabled"}>${pk.buckets} buckets · ${G.pounds(pk.pence)}</button>`; };
  return `<section class="panel gamba">
      <div class="ptitle"><span class="ic-badge gold">${ic("coin")}</span><h2 class="ol-sm">Winny's Gamba Bucket</h2><button class="side chip" data-act="gamba-odds">${ic("eye")} Odds</button></div>
      <div class="bucket-stage">${bucketArt("legendary")}</div>
      ${left ? `<button class="btn gold xl block" data-act="gamba-buy" ${S.D.wallet >= Gm.price ? "" : "disabled"}>Buy a bucket ${priceTag(Gm.price)}</button>`
        : credits ? `<button class="btn gold xl block" data-act="gamba-buy">Open a bought bucket (${credits} left)</button>` : `<button class="btn xl block" disabled>That's your 5 for today</button>`}
      <p class="tiny faint" style="margin:8px 0 0;text-align:center">${left ? `${left} of ${Gm.perDay} left today` : "Back at midnight"}${credits && left ? ` · ${credits} bought waiting` : ""}${Object.keys(junk).length ? ` · <button class="linkbtn" data-act="junk">Junk drawer (${Object.values(junk).reduce((a, b) => a + b, 0)})</button>` : ""}</p>
      <div class="gamba-more">
        <span class="field-label">More buckets for real money</span>
        <div class="btn-row">${Gm.packs.map(pack).join("")}</div>
        <p class="tiny faint" style="margin:6px 0 0">18+. Up to ${G.pounds(Gm.weeklyPence)} a week.</p>
      </div>
    </section>`;
}
function gambaOdds() {
  const Gm = G.GAMBA, pc = (p) => `${(p * 100).toFixed(1)}%`;
  openSheet(`${sheetHead("The odds")}
    <div class="oddsbar">${Gm.prizes.map(([p, , , r]) => `<i style="flex:${p};background:${GAMBA_COL[r]}"></i>`).join("")}</div>
    <div class="oddsrows">${Gm.prizes.map(([p, v, l, r]) => `<div class="oddsrow"><span class="dot" style="background:${GAMBA_COL[r]}"></span><b class="grow">${esc(l)}</b><span class="muted">${v ? `${fmt(v)} Efforts` : "Something useless"}</span><span class="pc">${pc(p)}</span></div>`).join("")}</div>
    <p class="small muted" style="margin:12px 0 0">${fmt(Gm.price)} Efforts a bucket. Winnings can't be cashed out.</p>`);
}
async function gambaBuy() {
  if (S.busy) return; S.busy = true;
  let r;
  try { r = await call("gamba", { token: S.token }); }
  catch (e) { toast(e.message); return; }
  finally { S.busy = false; }
  S.D.gamba = { ...S.D.gamba, today: G.GAMBA.perDay - r.left, credits: r.credits };
  FX.play("buy");
  gambaReveal(r);
}
// Nothing comes out of a bucket empty-handed: the worst you get is something useless for the junk drawer.
const JUNK = ["A soggy chip", "One left sock", "Winny's IOU (void)", "A receipt for a receipt", "Half a bus ticket", "A rubber duck that doesn't squeak",
  "A pigeon feather", "A bent spoon", "A pebble shaped like Brett", "Tangled headphones", "The lid of a different bucket", "An expired coupon for buckets"];
const pickJunk = () => {
  const j = JUNK[Math.floor(Math.random() * JUNK.length)], drawer = junkDrawer();
  drawer[j] = (drawer[j] || 0) + 1; store.set(`junk:${me().id}`, drawer);
  return j;
};
const junkDrawer = () => store.get(`junk:${me().id}`) || {};
// Anyone's week, Monday to Sunday: what they walked, anything the game took off (and why), and what counted.
// Yours comes in your own time zone and live; squad-mates' come with the squad data.
const CUT_WHY = { paralysed: "Paralysed in the raid" };
function weekDays(id) {
  const you = id === me().id, today = S.D.today.day;
  const src = (you && S.D.stepWeek) || squad()?.members.find((m) => m.id === id)?.days || [];
  return src.map((d) => {
    const raw = you && d.day === today ? S.D.today.rawSteps : d.raw ?? 0, cut = d.cuts.reduce((a, c) => a + c.steps, 0), lost = Math.min(cut, raw);
    return { ...d, raw, cut, lost, counted: raw - lost, future: d.day > today };
  });
}
const todayOf = (id) => (id === me().id ? S.D.today.steps : squad()?.members.find((m) => m.id === id)?.todaySteps ?? 0);
const allOf = (id) => squad()?.members.find((m) => m.id === id)?.all || (id === me().id && S.D.allTime) || { steps: 0, days: 0, best: 0, bestDay: null };
function stepsSheet(id = me().id) {
  const you = id === me().id, x = you ? me() : squad()?.members.find((m) => m.id === id);
  if (!x) return;
  const today = S.D.today.day, days = weekDays(id);
  const sum = (k) => days.reduce((a, d) => a + d[k], 0), top = Math.max(1, ...days.map((d) => d.raw));
  const wd = (day) => new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const walked = sum("raw"), counted = sum("counted"), past = days.filter((d) => !d.future);
  const A = allOf(id);
  const T = squad() ? weekRows() : null, row = T?.rows.find((r) => r.id === id);
  const tiles = [
    row && `<div class="tile gold"><div class="k">${ic("trophy")} Rank</div><div class="v">#${T.rows.indexOf(row) + 1}<small>of ${T.rows.length}</small></div></div>`,
    `<div class="tile"><div class="k">${ic("steps")} Daily average</div><div class="v num">${fmt(counted / Math.max(1, past.length))}</div></div>`,
    A.best ? `<div class="tile green"><div class="k">${ic("star")} Best day ever</div><div class="v num">${fmt(A.best)}<small>${new Date(A.bestDay + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</small></div></div>` : "",
    row && `<div class="tile cyan"><div class="k">${ic("bolt")} Raid power</div><div class="v">×${row.stride.toFixed(2)}</div></div>`,
  ].filter(Boolean).join("");
  const bars = days.map((d) => `<div class="sw-col${d.day === today ? " now" : d.future ? " later" : ""}">
      <div class="sw-bar" style="height:${d.future ? 0 : Math.max(2, (d.raw / top) * 100)}%">${d.lost ? `<i class="sw-lost" style="height:${(d.lost / d.raw) * 100}%"></i>` : ""}</div>
      <span>${wd(d.day)[0]}</span></div>`).join("");
  const rows = days.map((d) => `<div class="sw-row${d.cut ? " cut" : ""}">
      <b class="grow">${wd(d.day)}${d.day === today ? " · today" : ""}</b>
      ${d.future ? `<span class="faint">–</span>` : d.cut ? `<s class="was">${fmt(d.raw)}</s><span class="cut-t num">${fmt(d.counted)}</span>` : `<span class="num">${fmt(d.counted)}</span>`}
      ${d.cuts.map((c) => `<div class="sw-why">${ic("bolt")} ${esc(CUT_WHY[c.why] || "Taken off")} · −${fmt(c.steps)}</div>`).join("")}</div>`).join("");
  openSheet(`${sheetHead(you ? "Your steps" : `${esc(x.name)}'s steps`)}
    <div class="sw-who">${face(id, 48)}<div class="sw-three">
      <div><small>Today</small><b class="num">${fmt(todayOf(id))}</b></div><div class="on"><small>This week</small><b class="num">${fmt(counted)}</b></div><div><small>All time</small><b class="num">${fmt(A.steps)}</b></div></div></div>
    ${walked !== counted ? `<p class="small cut-t" style="margin:-4px 0 10px">Walked ${fmt(walked)} this week · −${fmt(walked - counted)} taken off</p>` : ""}
    <div class="tiles" style="margin-bottom:10px">${tiles}</div>
    <div class="sw-chart">${bars}</div>
    <div class="sw-rows">${rows}</div>
    ${squad() ? `<button class="btn block" style="margin-top:14px" data-profile="${id}">${ic("squad")} Walker and gear</button>` : ""}`);
}
function junkSheet() {
  const d = Object.entries(junkDrawer()).sort((a, b) => b[1] - a[1]);
  openSheet(`${sheetHead("Junk drawer")}<div class="oddsrows">${d.map(([j, n]) => `<div class="oddsrow"><b class="grow">${esc(j)}</b><span class="pc">×${n}</span></div>`).join("")}</div>`);
}
// What happened in the bucket, one line each.
const TALES = {
  dud: ["Winny shakes the bucket. That's all that falls out.", "Nothing in here but this. Winny calls it a collectible.", "Winny swears it was full when he left it."],
  common: ["Half of it was chocolate coins. You keep the real half.", "A pigeon got to it first. It left you half."],
  rare: ["The bucket was a mimic. It snapped, you yanked, and you got away with every Effort you put in.", "It bit. You bit back. You escape with exactly what you paid."],
  epic: ["The bucket had a false bottom. Winny looks the other way while you pocket double.", "A second purse was wedged underneath. Double."],
  legendary: ["Two false bottoms. Winny is furious.", "The Taxman hid his float in this one. Four times what you paid."],
  mythic: ["You tip it out and it keeps coming.", "It's heavier than it looks. Much heavier."],
  jackpot: ["Winny's own savings were in this one. He's not talking to you."],
};
const bucketTale = (rar) => { const t = TALES[rar] || TALES.dud; return t[Math.floor(Math.random() * t.length)]; };
// Three taps, then the flood of colour and the prize. Rarities only ever climb to what was really won.
function gambaReveal(r) {
  const [, win, label, rar] = G.GAMBA.prizes[r.prize], top = GAMBA_RANK[rar], names = Object.keys(GAMBA_RANK);
  const el = document.createElement("div");
  el.className = "gamba-reveal"; el.style.setProperty("--rc", GAMBA_COL.dud);
  el.innerHTML = `<div class="gr-top"><b class="ol-sm">Winny's Gamba Bucket</b><span class="gr-taps">3 taps</span></div>
    <button class="gr-bucket" aria-label="Tap the bucket">${bucketArt("dud")}</button><p class="gr-hint">Tap the bucket</p><div class="gr-prize" hidden></div>`;
  document.body.appendChild(el);
  FX.init(el);
  let taps = 0, done = false;
  const bucket = el.querySelector(".gr-bucket");
  const finish = () => {
    done = true; el.style.setProperty("--rc", GAMBA_COL[rar]); el.classList.add("flood", rar);
    const [x, y] = FX.centre(bucket);
    setTimeout(() => {
      el.querySelector(".gr-hint").hidden = true; bucket.hidden = true;
      const P = el.querySelector(".gr-prize"); P.hidden = false;
      const junk = win ? null : pickJunk(), tale = bucketTale(rar);
      P.innerHTML = `<div class="gr-card"><span class="gr-rar">${esc(rar === "jackpot" ? "Jackpot" : rar === "dud" ? "Junk" : rar)}</span><h2 class="ol disp">${esc(label)}</h2>
        <div class="gr-win">${win ? `+${fmt(win)} Efforts` : esc(junk)}</div><p class="small muted">${esc(tale)}</p>
        <button class="btn gold block" data-act="gamba-close">${win ? "Collect" : "Keep it"}</button></div>`;
      if (win) { FX.coins(x, y, Math.min(60, 6 + top * 9)); FX.play("coin"); }
      if (top >= 5) { FX.confetti(140); FX.buzz([60, 40, 60, 40, 60]); FX.play("ko"); } else if (top >= 3) { FX.shake(el, 10, 400); FX.buzz(40); }
    }, 600);
  };
  bucket.onclick = () => {
    if (done) return;
    taps++;
    const lv = Math.floor((top * taps) / 3), at = names[lv];
    bucket.innerHTML = bucketArt(at); el.style.setProperty("--rc", GAMBA_COL[at]);
    el.querySelector(".gr-taps").textContent = taps < 3 ? `${3 - taps} tap${3 - taps === 1 ? "" : "s"}` : "";
    bucket.classList.remove("bump"); void bucket.offsetWidth; bucket.classList.add("bump");
    const [x, y] = FX.centre(bucket);
    FX.play(lv >= 3 ? "crit" : "hit"); FX.buzz(lv >= 3 ? 25 : 10);
    if (lv >= 1) FX.coins(x, y - 30, 3 + lv * 2);
    if (lv >= 2) FX.shake(el, 4 + lv * 2, 200);
    if (lv >= 4) el.classList.add("rays");
    if (taps >= 3) finish();
  };
  el.addEventListener("click", (e) => {
    if (!e.target.closest("[data-act=gamba-close]")) return;
    FX.destroy(); el.remove(); S.D.wallet = r.wallet; render();
    load().then(render).catch(() => {});
  });
}

// ---------- The House: skins for real money ----------
// Paid through a Stripe Payment Link; the effort-house function grants the skin when Stripe says it's paid.
const TIER_SHAPE = { street: "circle", flash: "square", neon: "shield", mythic: "hex", house: "star" };
const tierBadge = (t) => `<span class="tbadge ${TIER_SHAPE[t.id]}" style="--tc:${t.color}" aria-hidden="true"></span>`;
const skinSwatch = (k) => `<span class="skinsw" style="--b:${k.look.base};--t:${k.look.trim};--g:${k.look.glow || k.look.trim}"><i class="p-${k.look.pattern}"></i></span>`;
function housePanel() {
  const owned = new Set(me().owned || []), wear = me().wear || {}, H = S.D.house || { pence: 0, count: 0 };
  return `<section class="panel house">
      <div class="ptitle"><span class="ic-badge red">${ic("crown")}</span><h2 class="ol-sm">The House</h2><span class="side chip gold">${G.pounds(H.pence)} raised</span></div>
      ${G.SKIN_TIERS.map((t) => `<div class="tierrow">${tierBadge(t)}<span class="grow"><b>${esc(t.label)}</b> <span class="muted small">${G.pounds(t.pence)}</span><small>${esc(t.adds)}</small></span></div>
        <div class="skins">${G.SKINS.filter((k) => k.tier === t.id && !k.award).map((k) => `<button class="skincard" data-skin="${k.id}" style="--tc:${t.color}">${skinSwatch(k)}<b>${esc(k.name)}</b>
          <span class="tiny">${wear.skin === k.id ? "Wearing" : owned.has(k.id) ? "Owned" : G.pounds(t.pence)}</span></button>`).join("")}</div>`).join("")}
    </section>`;
}
function skinSheet(id) {
  const k = G.skinById(id); if (!k) return;
  const t = G.skinTier(k), ti = G.SKIN_TIERS.indexOf(t), owned = (me().owned || []).includes(k.id), on = me().wear?.skin === k.id;
  const look = { ...ANS[me().id], _skin: { id: k.id, tier: k.tier, look: k.look } };
  openSheet(`<div class="row spread" style="margin-bottom:10px"><span class="chip" style="border-color:${t.color}">${tierBadge(t)} ${esc(t.label)} skin</span><button class="iconbtn" data-act="close-sheet" aria-label="Close">${ic("close")}</button></div>
    <div class="skin-preview" id="skin-preview"><div class="has-fallback"><span class="fb">${Walker.svg(look, { mood: "fresh" })}</span></div></div>
    <h2 class="ol-sm">${esc(k.name)}</h2><p class="flavour">${esc(k.text)}</p>
    <ul class="ticks">${G.SKIN_TIERS.slice(0, ti + 1).map((x) => `<li>${ic("check")} ${esc(x.adds)}</li>`).join("")}${G.SKIN_TIERS.slice(ti + 1).map((x) => `<li class="off">${ic("lock")} ${esc(x.adds)} <span class="muted">(${esc(x.label)})</span></li>`).join("")}</ul>
    <div class="btn-row" style="margin-top:12px">${owned ? (on ? `<button class="btn" data-act="wear" data-kind="skin" data-id="">Take off</button>` : `<button class="btn blue block" data-act="wear" data-kind="skin" data-id="${k.id}">Wear it</button>`)
      : G.houseItem(k.id).link ? `<button class="btn green xl block" data-act="house-pay" data-id="${k.id}">Buy for ${G.pounds(t.pence)}</button>` : `<button class="btn block" disabled>Payments open soon</button>`}</div>
    <p class="tiny faint" style="margin:10px 0 0;text-align:center">Looks only. Yours for good.</p>`, { rc: t.color });
  // The live turntable, if this phone does 3D.
  const host = $("#skin-preview");
  S.skinPreview?.dispose?.(); S.skinPreview = null;
  if (host && window.Arena3D?.preview && use3d()) {
    const flat = host.innerHTML;
    try {
      host.innerHTML = ""; S.skinPreview = Arena3D.preview(host, look);
      if (!S.skinPreview?.ok) { S.skinPreview = null; host.innerHTML = flat; } else host.insertAdjacentHTML("beforeend", `<span class="drag-hint">Drag to turn</span>`);
    } catch { host.innerHTML = flat; }
  }
}
// Change my look: your own ninja (from your answers, which stay fixed) or any skin you've bought from The House.
function lookSheet() {
  const owned = (me().owned || []).map(G.skinById).filter(Boolean), on = me().wear?.skin || null;
  const card = (k) => {
    const t = k && G.skinTier(k), wearing = (k?.id || null) === on;
    return `<button class="skincard${wearing ? " on" : ""}" data-act="look-wear" data-id="${k?.id || ""}" style="--tc:${t?.color || "var(--line-2)"}">
      ${k ? skinSwatch(k) : `<span class="skinsw own"><span class="fb">${head2d(answersOf({ ...me(), wear: {} }))}</span></span>`}
      <b>${k ? esc(k.name) : "Your own look"}</b><span class="tiny" data-label="${k ? esc(k.award || `${t.label} skin`) : "From your answers"}">${wearing ? "Wearing" : k ? esc(k.award || `${t.label} skin`) : "From your answers"}</span></button>`;
  };
  S.sheetKind = "look";
  openSheet(`${sheetHead("Change my look")}
    <div class="skin-preview" id="skin-preview"><div class="has-fallback"><span class="fb">${Walker.svg(ANS[me().id], { mood: "fresh" })}</span></div></div>
    <div class="skins">${card(null)}${owned.map(card).join("")}</div>

    <button class="btn block" style="margin-top:12px" data-act="look-house">${ic("crown")} Browse The House</button>
`);
  S.sheetKind = "look";
  const host = $("#skin-preview");
  S.skinPreview?.dispose?.(); S.skinPreview = null;
  if (host && window.Arena3D?.preview && use3d()) {
    const flat = host.innerHTML;
    try { host.innerHTML = ""; S.skinPreview = Arena3D.preview(host, ANS[me().id]); if (!S.skinPreview?.ok) { S.skinPreview = null; host.innerHTML = flat; } else host.insertAdjacentHTML("beforeend", `<span class="drag-hint">Drag to turn</span>`); }
    catch { host.innerHTML = flat; }
  }
}
// Switch skin in place: the preview and the cards change at once, and it saves in the background (put back if
// the save fails).
async function lookWear(id) {
  const was = me().wear?.skin || null;
  if (id === was || S.busy) return;
  const mark = (on) => {
    for (const c of document.querySelectorAll("#sheet .skincard")) {
      const yes = (c.dataset.id || null) === on, lab = c.querySelector("[data-label]");
      c.classList.toggle("on", yes); if (lab) lab.textContent = yes ? "Wearing" : lab.dataset.label;
    }
    const look = answersOf({ ...me(), wear: { ...(me().wear || {}), skin: on } });
    if (S.skinPreview) S.skinPreview.setLook(look);
    else { const fb = $("#skin-preview .fb"); if (fb) fb.innerHTML = Walker.svg(look, { mood: "fresh" }); }
  };
  mark(id); FX.play("tap");
  if (!(await wardrobe({ skin: id }, null))) mark(was);
}
// Off to Stripe, after a clear look at what's being bought. client_reference_id tells the webhook who bought what.
function housePay(id, sure = false) {
  const it = G.houseItem(id); if (!it?.link) return;
  if (!sure) {
    openSheet(`${sheetHead("Real money")}
      <p class="small" style="margin:0 0 12px"><b>${esc(it.name)}</b>, <b>${G.pounds(it.pence)}</b> by card. 18+ or a parent's OK. No refunds.</p>
      <div class="btn-row"><button class="btn" data-act="close-sheet">Cancel</button><button class="btn green" data-act="house-pay-go" data-id="${it.id}">Pay ${G.pounds(it.pence)}</button></div>`);
    return;
  }
  closeSheet();
  const url = `${it.link}${it.link.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(`${me().id}__${it.id}`)}`;
  toast("Opening Stripe. It shows up here once it's paid");
  window.open(url, "_blank", "noopener");
}

function itemSheet(id, deal) {
  const item = G.itemById(id); if (!item) return;
  const inv = S.D.inv, t = G.tierOf(item.tier), up = inv[id] || 0, own = id in inv, on = me().gear[item.slot] === id, wallet = S.D.wallet;
  const locked = !own && t.lvl > level(), price = G.priceOf(item, deal), cls = item.cls ? I.CLASSES.find((c) => c.id === item.cls) : null;
  const st = G.itemStats(item, up, myStats()), next = G.itemStats(item, up + 1, myStats()), cost = G.upgradeCost(item, up, S.D.squad?.den?.levels), maxed = up >= G.RULES.upgradeMax;
  openSheet(`<div class="row spread" style="margin-bottom:10px"><span class="chip" style="background:color-mix(in srgb, ${t.color} 30%, transparent);border-color:${t.color};color:#fff">${t.label}${cls ? ` · ${esc(cls.name)}` : " · Any class"} · ${esc(item.slot)}</span><button class="iconbtn" data-act="close-sheet" aria-label="Close">${ic("close")}</button></div>
    <div class="bigart"><div class="art">${itemArt(item)}</div>${up ? `<span class="upb">+${up}</span>` : ""}</div>
    <h2 class="ol-sm">${esc(item.name)}</h2>
    <p class="flavour">${esc(item.text)}</p>
    <div class="tiles">${Object.entries(st).map(([k, v]) => `<div class="tile"><div class="k" style="color:${STAT_LOOK[k][1]}">${ic(STAT_LOOK[k][0])} ${statLabel(k)}</div><div class="v">+${v}${own && !maxed ? `<small>→ +${next[k]}</small>` : ""}</div></div>`).join("")}</div>
    ${item.perk ? `<div class="perkbox">${ic("star")}<span>${esc(perkText(item.perk))}</span></div>` : ""}
    ${swapLine(item)}
    ${item.set ? `<div class="perkbox">${ic("star")}<span>${esc(I.SETS[item.set]?.name || "")}. ${esc(I.SETS[item.set]?.what || "")}</span></div>` : ""}
    <div class="btn-row" style="margin-top:12px">
      ${!own && !G.onSale(item, S.D.today.day) ? `<button class="btn block" disabled>${G.seasonById(item.season) && S.D.today.day < G.seasonById(item.season).start ? `On sale from ${longDate(G.seasonById(item.season).start)}` : "Only sold during its season"}</button>` : locked ? `<button class="btn block" disabled>${ic("lock")} Unlocks at level ${t.lvl}</button>`
        : !own ? `<button class="btn green xl block" data-buy="${id}" data-deal="${deal ? 1 : ""}" ${wallet < price ? "disabled" : ""}>Buy ${priceTag(price)}</button>`
        : `${on ? `<button class="btn" data-unequip="${item.slot}">Take off</button>` : `<button class="btn blue" data-equip="${id}">Equip</button>`}
           ${maxed ? `<button class="btn" disabled>Max level</button>` : `<button class="btn gold" data-upgrade="${id}" ${wallet < cost ? "disabled" : ""}>${ic("upgrade")} +${up + 1} ${priceTag(cost)}</button>`}`}
    </div>
    ${!own && !locked && wallet < price ? `<p class="small muted" style="text-align:center;margin:10px 0 0">You need ${fmt(price - wallet)} more Efforts. Walk.</p>` : ""}`, { rc: t.color });
}
// Everything you own for one slot, to swap in (the raid lobby and the shop's loadout use it).
function gearPicker(slot) {
  const owned = I.ITEMS.filter((i) => i.slot === slot && i.id in S.D.inv).sort((a, b) => I.TIERS.findIndex((t) => t.id === b.tier) - I.TIERS.findIndex((t) => t.id === a.tier));
  const on = me().gear?.[slot];
  openSheet(`${sheetHead(`Your ${slot}`)}
    ${owned.length ? `<div class="gearpick">${owned.map((it) => {
      const st = G.itemStats(it, S.D.inv[it.id] || 0, myStats()), t = G.tierOf(it.tier);
      return `<button class="gp ${it.id === on ? "on" : ""}" style="--rc:${t.color}" data-act="gear-wear" data-id="${it.id}">
        <span class="art">${itemArt(it)}</span>
        <span class="grow"><b>${esc(it.name)}${S.D.inv[it.id] ? ` +${S.D.inv[it.id]}` : ""}</b><small>${Object.entries(st).map(([k, v]) => `+${v} ${statLabel(k).toLowerCase()}`).join(" · ")}${it.perk ? ` · ${esc(perkText(it.perk))}` : ""}</small></span>
        ${it.id === on ? `<span class="chip green">${ic("check")} On</span>` : ""}</button>`;
    }).join("")}</div>` : `<p class="small muted">You don't own a ${slot} yet. The shop has plenty.</p>`}
    ${on ? `<button class="btn block" style="margin-top:10px" data-act="gear-off" data-slot="${slot}">Take it off</button>` : ""}`);
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
  return `${updateBanner()}${authNudge()}${testEndCard()}
    <section class="panel">
      <div class="row" style="align-items:flex-start;gap:14px">
        <div class="bigface has-fallback"><span class="fb">${Walker.svg(ANS[m.id], { mood: "fresh" })}</span>${portraitImg("walker", m.id, { w: 220, h: 260 })}</div>
        <div class="grow"><h2 class="ol-sm disp" style="margin:4px 0 2px;font-size:24px">${esc(m.name)}</h2><div class="small muted">${esc(cls.name)} · Level ${level()}${titleOf(me()) ? ` · ${esc(titleOf(me()))}` : ""}</div>
          <p class="tiny faint" style="margin:8px 0 10px">${esc(cls.blurb)}</p>
          <button class="btn xs" data-act="look">${ic("star")} Change my look</button></div>
      </div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge green">${ic("steps")}</span><h2 class="ol-sm">Steps</h2><span class="side chip ${m.steps_synced_at ? "green" : "red"}">${m.steps_synced_at ? `Synced ${ago(m.steps_synced_at)}` : "Not syncing"}</span></div>
      <p class="small muted" style="margin:0 0 10px">${m.steps_synced_at ? `From ${esc(m.steps_source === "android-app" ? "the Effort app" : m.steps_source === "android" || /health/.test(m.steps_source || "") ? "HC Webhook" : m.steps_source === "manual" ? "typing them in" : "your iPhone Shortcut")}. Today so far: ${fmt(S.D.today.rawSteps)}.` : "Set it up once and your steps sync by themselves."}</p>
      <div class="btn-row"><button class="btn sm green" data-act="setup-steps">${ic("refresh")} Set up sync</button></div>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("phone")}</span><h2 class="ol-sm">Scrolling</h2><span class="side chip ${S.D.today.scrollLinked ? "green" : "red"}">${S.D.today.scrollLinked ? `${S.D.today.scroll ?? 0} min today` : "Not linked"}</span></div>
      <p class="small muted" style="margin:0 0 10px">${G.scrollBudget(S.D.today.steps)} min free today. Over that, the Taxman takes more.${S.D.today.scrollLinked ? "" : ` <b>Not linked: counts as ${G.RULES.unlinkedOverMin} min over.</b>`}</p>
      <div class="btn-row"><button class="btn sm blue" data-act="setup-scroll">${ic("refresh")} ${S.D.today.scrollLinked ? "Tracking setup" : "Link my apps"}</button></div>
    </section>
    ${wardrobePanel()}
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("bell")}</span><h2 class="ol-sm">Reminders</h2></div>
      <p class="small muted" style="margin:0 0 10px">A ping at 5pm, and at 9pm if you miss the Taxman.</p>
      ${pushBlock()}
      <span class="field-label">Or put them in your calendar</span>
      ${reminderButtons()}
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge blue">${ic("squad")}</span><h2 class="ol-sm">${sq ? esc(sq.name) : "Squad"}</h2>${sq ? `<span class="side chip">${sq.code}</span>` : ""}</div>
      ${sq ? `<div class="mates">${sq.members.map((x) => `<button class="mate pick" data-profile="${x.id}">${face(x.id, 40)}<div class="grow"><b>${esc(x.id === m.id ? "You" : x.name)}</b><small>Lv ${x.level} · ${x.synced ? `synced ${ago(x.synced)}` : "steps not syncing"}</small></div><span class="num small">${fmt(x.todaySteps)}<small class="faint"> today</small></span>${ic("arrowRight")}</button>`).join("")}</div>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm green" data-act="invite">${ic("share")} Invite</button><button class="btn sm" data-act="squad-sheet">Switch</button></div>
        <button class="btn xs red" style="margin-top:10px" data-act="leave">Leave squad</button>`
        : `<p class="small muted" style="margin:0 0 10px">You're not in a squad.</p><button class="btn green block" data-act="squad-sheet">${ic("squad")} Make or join a squad</button>`}
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge green">${ic("lock")}</span><h2 class="ol-sm">Signing in</h2>${needsAccount() ? `<span class="side chip red">Needs ${S.auth.email ? "a password" : S.auth.has_password ? "an email" : "email + password"}</span>` : ""}</div>
      <p class="small muted" style="margin:-4px 0 12px">How you get back in on a new phone. Set up at least one.</p>
      <div class="meths">${signinMethods()}</div>
      <button class="btn sm block" style="margin-top:12px" data-act="signout">${ic("door")} Sign out</button>
    </section>
    <section class="panel">
      <div class="ptitle"><span class="ic-badge">${ic("link")}</span><h2 class="ol-sm">This phone</h2>${NATIVE ? `<span class="side chip">App ${esc(S.native?.version || "?")}</span>` : ""}</div>
      <button class="btn sm block" style="margin-bottom:12px" data-act="check-updates">${ic("refresh")} Check for updates</button>
      <label class="row spread" style="margin-bottom:12px"><span><b>Sound</b></span><input class="switch" type="checkbox" data-toggle="sound" ${FX.muted ? "" : "checked"} aria-label="Sound"></label>
      <label class="row spread" style="margin-bottom:12px"><span><b>3D battles</b><span class="small muted" style="display:block">Switch off on older phones</span></span><input class="switch" type="checkbox" data-toggle="3d" ${store.get("no3d") ? "" : "checked"} aria-label="3D battles"></label>
      <p class="small muted" style="margin:0 0 8px">Your restore link also signs you in on another phone. Keep it private: it's your account.</p>
      <div class="btn-row"><button class="btn sm" data-act="copy-restore">${ic("copy")} Copy restore link</button>${me().id === OWNER_ID ? `<a class="btn sm" href="lab.html">${ic("sliders")} The Lab</a>` : ""}</div>
      <button class="btn xs red" style="margin-top:10px" data-act="signout">${ic("door")} Sign out on this phone</button>
    </section>`;
}
// Calendar reminders: an .ics file (iPhone, Outlook, most Android calendars) or Google Calendar links.
function reminderButtons() {
  const w = S.D.windows, gstamp = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(t).replace(/\D/g, "").replace(/^(\d{8})/, "$1T");
  const gcal = (text, start, mins, rule) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${gstamp(start)}/${gstamp(start + mins * 60000)}&ctz=Europe/London&recur=${encodeURIComponent("RRULE:" + rule)}&details=${encodeURIComponent(APP_URL)}`;
  const taxAt = w.tax.test ? w.tax.next : w.tax.opens > now() ? w.tax.opens : w.tax.next;
  return `<a class="btn sm block" href="reminders.ics">${ic("calendar")} Add both to my calendar</a>
    <div class="btn-row" style="margin-top:8px"><a class="btn xs" target="_blank" rel="noopener" href="${gcal("Effort: the Taxman (6–9pm)", taxAt, 180, "FREQ=DAILY")}">Google: 6pm daily</a><a class="btn xs" target="_blank" rel="noopener" href="${gcal("Effort: squad raid lobby (6–9pm)", w.raid.test ? w.raid.closes : w.raid.opens, 180, "FREQ=WEEKLY;BYDAY=SU")}">Google: Sunday raid</a></div>`;
}

// ---------- sheets ----------
function openSheet(html, { rc } = {}) {
  const sh = $("#sheet");
  sh.innerHTML = `<div class="panel" role="dialog" aria-modal="true" ${rc ? `style="--rc:${rc}"` : ""}><div class="grab"></div>${html}</div>`;
  sh.hidden = false;
  hydratePortraits();
}
function closeSheet() { const sh = $("#sheet"); sh.hidden = true; sh.innerHTML = ""; S.sheetKind = null; S.skinPreview?.dispose?.(); S.skinPreview = null; }
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
  if (st.scroll) return `${done("Scroll tracking on")}</div><p class="tiny faint" style="margin:8px 0 0">Counts minutes in TikTok, Instagram, Snapchat and Facebook. YouTube doesn't count.</p>`;
  return `<button class="btn blue block" data-act="native-scroll">${ic("phone")} Allow scroll tracking</button><p class="tiny faint" style="margin:6px 2px 0">Android opens <b>Usage access</b>: tap <b>Effort</b>, switch it on, then come back. It only counts minutes in short-video apps.</p>`;
}

// Which phone the setup guide is showing.
const setupPlat = () => S.setupPlatform || me()?.platform || S.platform;
// iPhone: no App Store app, so Effort lives on the Home Screen, and a Shortcut sends the steps by itself.
function iphoneHome(kind) {
  const t = S.token, box = (url) => `<div class="copybox"><code>${esc(url)}</code><button class="btn xs" data-copy="${esc(url)}">${ic("copy")} Copy</button></div>`;
  if (kind !== "steps") return `<p class="small" style="margin-top:0">Two automations tell Effort when TikTok or Instagram opens and closes, and Effort works out the minutes.</p>
      <ol class="steps-list">
        <li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>App</b>.</li>
        <li>Choose the apps you scroll on. Tick <b>Is Opened</b> only. <b>Run Immediately</b>, <b>Notify When Run</b> off.</li>
        <li><b>New Blank Automation</b> → <b>Get Contents of URL</b>, paste:${box(`${API}/scroll?t=${t}&ev=open`)}</li>
        <li>Make a second one the same way, ticking <b>Is Closed</b> and using:${box(`${API}/scroll?t=${t}&ev=close`)}</li>
      </ol>`;
  return `<p class="small" style="margin-top:0">On iPhone, Effort runs from your Home Screen like an app, with the evening pings. A Shortcut sends your steps.</p>
    <span class="field-label">1 · Put Effort on your Home Screen</span>
    ${isStandalone() ? `<div class="chip green" style="margin-bottom:6px">${ic("check")} Done: you're in the Home Screen app</div>` : `<ol class="steps-list">
      <li>Open <b>effort-game.vercel.app</b> in <b>Safari</b>. Other browsers can't add it.</li>
      <li>Tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b> → <b>Add</b>.</li>
      <li>Open <b>Effort</b> from your Home Screen from now on. It opens full screen like an app.</li>
    </ol>`}
    <span class="field-label">2 · Turn on the evening pings</span>
    <p class="small" style="margin:0">In the Home Screen app: <b>Me → Reminders → Ping me when the Taxman's in</b>. iPhones only allow notifications from Home Screen apps.</p>
    <span class="field-label">3 · Sync your steps automatically</span>
    <p class="small" style="margin:0 0 8px">A one-time Shortcut. After this it runs on its own.</p>
    <ol class="steps-list">
      <li>Open <b>Shortcuts</b>, tap <b>+</b>, and name it <b>Effort Steps</b> (exactly that, so the app's Sync button can run it).</li>
      <li>Add <b>Find Health Samples</b>: Type <b>Steps</b>, filter <b>Start Date is today</b>, <b>Group By: Day</b>.</li>
      <li>Add <b>Calculate Statistics</b> → <b>Sum</b>.</li>
      <li>Add <b>Get Contents of URL</b> and paste:${box(`${API}/log?t=${t}&steps=`)}then tap the end of it and insert the <b>Statistics</b> variable.</li>
      <li>Tap ▶︎ to test. You should see "✅ … steps logged".</li>
      <li>In the <b>Automation</b> tab: <b>+</b> → <b>Time of Day</b> → <b>17:50</b>, <b>Daily</b>, <b>Run Immediately</b> → <b>Effort Steps</b>. That's your steps in before the Taxman opens.</li>
      <li>Make two more for <b>13:00</b> and <b>23:50</b>, so the squad table stays live and the whole day counts.</li>
    </ol>`;
}
function setupBody(kind) {
  if (NATIVE) return nativeSetup(kind);
  const p = setupPlat(), t = S.token;
  const toggle = `<div class="seg" style="margin-bottom:12px">${[["ios", "iPhone"], ["android", "Android"]].map(([v, l]) => `<button type="button" data-setup="${v}" data-kind="${kind}" aria-pressed="${v === p}">${l}</button>`).join("")}</div>`;
  const box = (url) => `<div class="copybox"><code>${esc(url)}</code><button class="btn xs" data-copy="${esc(url)}">${ic("copy")} Copy</button></div>`;
  let body;
  if (p === "ios") body = iphoneHome(kind);
  else if (p === "android") body = androidApp(t);
  else body = `<p class="small">Effort counts ${kind === "steps" ? "steps" : "app time"} straight from your phone, so it can't be typed in. Pick iPhone or Android above.</p>`;
  return `${toggle}<div class="guide">${body}</div>`;
}
function setupSheet(kind) {
  S.sheetKind = kind;
  const title = setupPlat() === "android" ? "Get the Effort app" : setupPlat() === "ios" ? (kind === "steps" ? "Set up Effort on your iPhone" : "Track your scrolling") : kind === "steps" ? "Your steps" : "Your scrolling";
  openSheet(`${sheetHead(title)}${setupBody(kind)}
    ${NATIVE || setupPlat() === "other" ? "" : `<button class="btn green block" style="margin-top:12px" data-act="check-sync" data-kind="${kind}">${ic("refresh")} Check it worked</button>
    <p id="sync-status" class="small muted" style="text-align:center;margin:10px 0 0"></p>`}`);
}
// Anyone in the squad: their walker, class, raid spot, steps and stats with gear (all from the squad data /game sends).
function profileSheet(id) {
  const x = squad()?.members.find((m) => m.id === id);
  if (!x) return;
  const you = id === me().id, st = G.stats(x.character || {}), cls = G.classOf(st);
  const row = weekRows().rows.find((r) => r.id === id), gear = you ? me().gear : x.gear || {};
  // Best spot from their stats with gear on; if they've picked somewhere else, say so too.
  const best = G.posOf(G.suggestedPosition(st)), picked = (you ? me().pos : x.pos) || null;
  const slotName = { weapon: "Weapon", armour: "Armour", trinket: "Trinket" };
  openSheet(`${sheetHead(esc(you ? "You" : x.name))}
    <div class="profile">
      <div class="walker-big has-fallback"><span class="fb">${Walker.svg(ANS[id], { mood: "fresh", label: `${x.name}'s walker` })}</span>${portraitImg("walker", id, { w: 340, h: 400 })}</div>
      <div class="row" style="justify-content:center;flex-wrap:wrap;gap:6px;margin-top:10px"><span class="chip gold">${esc(cls.name)}</span>${titleOf(you ? me() : x) ? `<span class="chip">${ic("crown")} ${esc(titleOf(you ? me() : x))}</span>` : ""}<span class="chip">Level ${x.level}</span><span class="chip">${best.e} Best at the ${best.label.toLowerCase()}</span>${picked && picked !== best.id ? `<span class="chip">Plays ${G.posOf(picked).label.toLowerCase()}</span>` : ""}</div>
      <p class="tiny faint" style="text-align:center;margin:8px 0 12px">${esc(cls.blurb)}</p>
      <div class="special-card" style="--sc:${SPECIAL_COL[cls.id] || "#ffd166"};margin-bottom:12px"><span class="si">${ic(G.specialOf({ cls: cls.id }).icon)}</span><span><small>Class special</small><b>${esc(G.specialOf({ cls: cls.id }).name)}</b><span>${esc(G.specialOf({ cls: cls.id }).what)}</span></span></div>
    </div>
    <div class="tiles">
      <div class="tile green"><div class="k">${ic("steps")} Today</div><div class="v num">${fmt(x.todaySteps)}<small>steps</small></div></div>
      <div class="tile"><div class="k">${ic("calendar")} This week</div><div class="v num">${fmt(x.weekSteps)}<small>steps</small></div></div>
      <div class="tile gold"><div class="k">${ic("bolt")} Raid power</div><div class="v">×${(row?.stride ?? 1).toFixed(2)}<small>${row?.title === "top" ? "top walker" : row?.title === "last" ? "dead weight" : "this week"}</small></div></div>
      <div class="tile cyan"><div class="k">${ic("refresh")} Steps synced</div><div class="v" style="font-size:16px">${x.synced ? ago(x.synced) : "Never"}</div></div>
    </div>
    <span class="field-label" style="margin-top:14px">Stats</span>
    ${statRows(st, gear, you ? S.D.inv : {})}
    <span class="field-label" style="margin-top:14px">Gear</span>
    <div class="loadout">${G.SLOTS.map((sl) => {
      const it = G.itemById(gear[sl]);
      return it ? `<div class="slot full" style="--rc:${G.tierOf(it.tier).color};cursor:default"><div class="art">${itemArt(it)}</div><span class="slab">${esc(it.name)}</span></div>`
        : `<div class="slot" style="cursor:default"><div class="ph">${ic({ weapon: "sword", armour: "guard", trinket: "star" }[sl])}<span>${slotName[sl]}</span></div></div>`;
    }).join("")}</div>`);
}
// What the two currencies are, from tapping the wallet.
function walletSheet() {
  const P = pendingToday(), w = S.D.wallet + (P.taxed ? P.n : 0), R = G.RULES;
  openSheet(`${sheetHead("Your money")}
    <div class="money">
      <div class="mrow"><span class="mic">${coin(44)}</span><div class="grow"><b>Efforts</b><span>Every ${fmt(R.stepsPerEffort)} steps you walk is 1 Effort, up to ${R.dailyEffortCap} a day. The Taxman takes a cut each day unless you beat him.</span></div><b class="num">${w < 0 ? "−" + fmt(-w) : fmt(w)}</b></div>
    </div>
    ${P.taxed ? `<div class="pendrow">${coin(22)}<span><b>Today's walking goes straight in</b> ${P.steal ? `with the ${Math.round(P.steal * 100)}% you stole on top` : P.rate > 0 ? `after the Taxman's ${Math.round(P.rate * 100)}%` : "with no tax"}. That covers all of today's steps.</span></div>`
      : P.n ? `<div class="pendrow">${coin(22)}<span><b>+${fmt(P.n)} Effort${P.n === 1 ? "" : "s"} from today's walking</b> so far. Once you've faced the Taxman they go straight in, after his cut.</span></div>` : ""}
    ${w < 0 ? `<p class="small" style="color:#ff9aa3;margin:12px 0 0">You're in debt: your next ${fmt(-w)} Efforts pay it off before you keep any.</p>` : ""}
    ${ledgerPanel()}
    <button class="btn gold block" style="margin-top:14px" data-tab="shop">${ic("bag")} Spend them in the shop</button>`);
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
    <p class="small muted" style="margin:-4px 0 12px">Send this to the group chat to bring them into ${esc(sq.name)}.</p>
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
  refreshPush(); checkAppUpdate(); checkAuth();
}
function viewSignin() {
  const st = S.signin || (S.signin = { step: "code" });
  const head = `<div class="quiz-top"><button class="iconbtn" data-act="signin-back" aria-label="Back">${ic("chevronLeft")}</button><span class="grow"></span></div>`;
  let body;
  if (st.step === "code") body = `<h1 class="ol disp ob-title">Sign in</h1>
    <p class="muted">Already playing on another phone, or got signed out?</p>
    ${passkeysReady() ? `<button class="btn gold xl block" data-act="passkey-signin">${ic("fingerprint")} Fingerprint / Face ID</button>` : ""}
    <button class="btn blue block" data-act="signin-email">${ic("mail")} Email me a code</button>
    <form class="panel" data-form="signin-code"><span class="field-label">Or with your password</span><span class="field-label" style="margin-top:4px">Your squad code</span><div class="row"><input type="text" name="code" maxlength="6" required placeholder="ABC123" class="grow code" autocomplete="off" autocapitalize="characters" value="${esc(st.code || "")}"><button class="btn blue sm">Next</button></div>
      <p class="tiny faint" style="margin:8px 0 0">It's on Me → your squad, on any squad-mate's phone.</p></form>
    <form class="panel" data-form="signin-link"><span class="field-label">Or paste your restore link</span><div class="row"><input type="text" name="link" required placeholder="https://…?me=…" class="grow" autocomplete="off"><button class="btn sm">Go</button></div></form>`;
  else if (st.step === "email") body = `<h1 class="ol disp ob-title">Email me a code</h1>
    <p class="muted">Use the email you added under Me. We'll send you a code.</p>
    <form class="panel" data-form="email-send" data-mode="signin"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com" value="${esc(st.email || "")}"><button class="btn gold block" style="margin-top:12px">${ic("mail")} Send code</button></form>`;
  else if (st.step === "emailcode") body = `<h1 class="ol disp ob-title">Check your email</h1>
    <p class="muted">Type the code we sent to <b>${esc(st.email)}</b>. It can take a minute, and might be in spam.</p>
    <form class="panel" data-form="email-verify" data-mode="signin" data-email="${esc(st.email)}"><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required placeholder="12345678" class="code"><button class="btn gold block" style="margin-top:12px">Sign in</button></form>`;
  else if (st.step === "who") body = `<h1 class="ol disp ob-title">Which one's you?</h1><p class="muted">${esc(st.squad.name)}</p>
    <div class="mates">${st.people.map((x) => `<button class="mate pick" data-signin="${x.id}"><div class="face has-fallback" style="width:40px;height:40px"><span class="fb">${head2d(answersOf(x))}</span></div><div class="grow"><b>${esc(x.name)}</b><small>${x.has_password ? "Password set" : "No password yet"}</small></div>${ic("arrowRight")}</button>`).join("")}</div>`;
  else {
    const x = st.people.find((p) => p.id === st.id);
    body = `<div class="walker-big has-fallback" style="height:180px;width:160px"><span class="fb">${Walker.svg(answersOf(x), { mood: "fresh" })}</span></div>
      <h1 class="ol disp ob-title" style="text-align:center">Hi, ${esc(x.name)}</h1>
      ${st.quick && passkeysReady() ? `<button class="btn gold xl block" data-act="passkey-signin">${ic("fingerprint")} Fingerprint / Face ID</button>` : ""}
      ${st.quick && !st.code ? `<div class="guide small">Not in a squad, so no password sign-in here. Use fingerprint, or go back for an email code.</div>` : x.has_password ? `<form class="panel" data-form="signin-password"><span class="field-label">Your password</span><input type="password" name="password" required autocomplete="current-password" placeholder="Password"><button class="btn gold block" style="margin-top:12px">Sign in</button></form>`
        : `<div class="guide small">${esc(x.name)} hasn't set a password. Try <b>Fingerprint / Face ID</b> or <b>Email me a code</b> instead (back one step). If you set up none of them, ask Kirish for your restore link.</div>`}
      ${st.quick ? `<button class="btn block" style="margin-top:12px" data-act="signin">${ic("mail")} Other ways to sign in</button>` : ""}`;
  }
  $("#app").innerHTML = `<section class="onboard">${head}${body}</section>`;
}
function passwordSheet() {
  openSheet(`${sheetHead(S.auth?.has_password ? "Change your password" : "Set a sign-in password")}
    <p class="small muted" style="margin:-4px 0 12px">For signing in on a new phone, or if you ever get signed out: <b>Sign in</b> on the welcome screen → your squad code → tap your name → this password.</p>
    <form data-form="set-password"><input type="password" name="password" required minlength="4" maxlength="64" autocomplete="new-password" placeholder="At least 4 characters">
      <input type="password" name="again" required minlength="4" maxlength="64" autocomplete="new-password" placeholder="Same again" style="margin-top:8px">
      <button class="btn green block" style="margin-top:12px">Save</button></form>`);
  setTimeout(() => $("#sheet input")?.focus(), 50);
}
// Which ways back in this account has: password, email, passkeys (fingerprint / Face ID).
async function checkAuth() {
  if (!S.token) return;
  try {
    const r = await callAuth("status", { token: S.token });
    const was = JSON.stringify(S.auth), gotEmail = r.email && !S.auth?.email;
    S.auth = { has_password: r.has_password, email: r.email, passkeys: r.passkeys };
    // Added by tapping the email's link in another browser: close the "type the code" sheet here.
    if (gotEmail && $("#sheet [data-form^=email]")) { closeSheet(); toast(`Email added: ${r.email}`); }
    if (was !== JSON.stringify(S.auth)) softRender();
    promptAccount();
  } catch { /* try again next time */ }
}

// Passkeys: in the Android app through Android's Credential Manager, elsewhere through the browser (WebAuthn).
const passkeysReady = () => (NATIVE ? typeof NATIVE.passkey === "function" && (typeof NATIVE.passkeysAvailable !== "function" || NATIVE.passkeysAvailable())
  : !!(window.PublicKeyCredential && window.SimpleWebAuthnBrowser));
const passkeyBlocker = () => {
  if (passkeysReady()) return null;
  if (NATIVE && typeof NATIVE.passkey !== "function") return { why: "Needs the newest Effort app", update: true };
  if (NATIVE) return { why: "Needs Android 9 or newer" };
  if (!window.PublicKeyCredential) return { why: "This browser can't. Try Chrome, or Safari on iPhone" };
  return { why: "Couldn't load it. Check your connection and reopen Effort" };
};
const passkeyWaits = {};
window.onEffortPasskey = (id, ok, out) => {
  const w = passkeyWaits[id]; delete passkeyWaits[id];
  if (!w) return;
  if (ok) { try { w.resolve(JSON.parse(out)); } catch { w.reject(new Error("failed")); } } else w.reject(new Error(out));
};
function passkeyCall(kind, options) {
  if (NATIVE) return new Promise((resolve, reject) => { const id = Math.random().toString(36).slice(2); passkeyWaits[id] = { resolve, reject }; NATIVE.passkey(kind, JSON.stringify(options), id); });
  const W = window.SimpleWebAuthnBrowser;
  return kind === "create" ? W.startRegistration({ optionsJSON: options }) : W.startAuthentication({ optionsJSON: options });
}
// Cancelling the phone's prompt isn't an error worth shouting about.
const passkeyFailed = (e) => {
  const m = String(e?.message || e);
  if (/cancel|NotAllowed|abort/i.test(m) || e?.name === "NotAllowedError") return toast("Cancelled");
  if (m === "none") return toast("No fingerprint sign-in saved for Effort on this phone yet");
  toast(m.length < 120 ? m : "That didn't work. Try again");
};
const deviceName = () => (NATIVE ? "Android app" : /iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Computer");
async function addPasskey() {
  try {
    const o = await callAuth("passkey_register_options", { token: S.token });
    const response = await passkeyCall("create", o.options);
    await callAuth("passkey_register", { token: S.token, challenge_id: o.challenge_id, response, device: deviceName() });
    await checkAuth(); render(); FX.play("levelup");
    toast("Fingerprint / Face ID sign-in is on");
  } catch (e) { passkeyFailed(e); }
}
async function passkeySignin() {
  try {
    const o = await callAuth("passkey_login_options", {});
    const response = await passkeyCall("get", o.options);
    const r = await callAuth("passkey_login", { challenge_id: o.challenge_id, response });
    await signedIn(r.token);
  } catch (e) { passkeyFailed(e); }
}

// Email: Supabase Auth sends a code (8 digits); entering it proves the email, and the server takes it from there.
async function sendEmailCode(email, forSignin) {
  // The email should carry a code; if it carries a link instead, the link comes back here (see boot).
  // Adding an email, the link carries a one-use ticket too, because it often opens in Chrome rather than the app.
  const back = forSignin ? APP_URL : `${APP_URL}?eticket=${(await callAuth("email_ticket", { token: S.token, email })).ticket}`;
  const { error } = await realtime().auth.signInWithOtp({ email, options: { shouldCreateUser: !forSignin, emailRedirectTo: back } });
  if (error) throw new Error(/signups not allowed|not found|not allowed for otp/i.test(error.message) ? "No Effort account has that email" : error.message);
}
async function checkEmailCode(email, code) {
  const { data, error } = await realtime().auth.verifyOtp({ email, token: String(code).trim(), type: "email" });
  if (error || !data?.session) throw new Error("That code's wrong or has expired");
  return data.session.access_token;
}
function emailSheet(email) {
  openSheet(`${sheetHead(S.auth?.email ? "Change your email" : "Add your email")}
    ${!email ? `<p class="small muted" style="margin:-4px 0 12px">We'll send a code to check it's yours. It's how you get back in if you lose your phone.</p>
      <form data-form="email-send" data-mode="link"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com"><button class="btn green block" style="margin-top:12px">${ic("mail")} Send code</button></form>`
    : `<p class="small muted" style="margin:-4px 0 12px">Type the code we sent to <b>${esc(email)}</b>, or tap the link in it. It can take a minute, and might be in spam.</p>
      <form data-form="email-verify" data-mode="link" data-email="${esc(email)}"><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required placeholder="12345678" class="code"><button class="btn green block" style="margin-top:12px">Confirm</button></form>
      <button class="btn xs" style="margin-top:10px" data-act="email-again">Use a different email</button>`}`);
  setTimeout(() => $("#sheet input")?.focus(), 50);
}

// The ways back in, with a button each (Me, the sign-up's last step, and the Today nudge).
function signinMethods() {
  const a = S.auth || {};
  const row = (icon, title, sub, act, label, gold) => `<div class="meth"><span class="mic">${ic(icon)}</span><span class="grow"><b>${title}</b><small>${sub}</small></span><button class="btn xs ${gold ? "gold" : ""}" data-act="${act}">${label}</button></div>`;
  const pk = passkeyBlocker();
  const finger = !pk ? row("fingerprint", "Fingerprint / Face ID", a.passkeys ? `On${a.passkeys > 1 ? ` · ${a.passkeys} devices` : ""}. Works on a new phone with the same Google or Apple account` : "Sign in with a touch, even on a new phone", "passkey-add", a.passkeys ? "Add another" : "Add", !a.passkeys)
    : `<div class="meth"><span class="mic">${ic("fingerprint")}</span><span class="grow"><b>Fingerprint / Face ID</b><small>${pk.why}</small></span>${pk.update ? `<a class="btn xs gold" href="${STEPS_APK}">Update</a>` : ""}</div>`;
  return finger
    + row("mail", "Email", a.email ? `${esc(a.email)}. For when you forget everything` : "Get back in with a code if you forget everything", "email-add", a.email ? "Change" : "Add", !a.email)
    + row("lock", "Password", a.has_password ? "Set. Squad code, your name, then this" : "Squad code, your name, then a password", "password", a.has_password ? "Change" : "Set", false);
}
// Every account needs an email and a password. New players add them while signing up; everyone else gets the
// Today banner (no way to hide it) and a pop-up each time they open the game, until both are there.
const needsAccount = () => !!S.auth && !(S.auth.email && S.auth.has_password);
function accountRows() {
  const a = S.auth || {};
  const need = (icon, title, done, doneText, todo, act) => `<div class="meth"><span class="mic">${ic(icon)}</span><span class="grow"><b>${title}</b><small>${done ? doneText : todo}</small></span>${done ? `<span class="chip green">${ic("check")} Done</span>` : `<button class="btn xs gold" data-act="${act}">Add</button>`}</div>`;
  return `<div class="meths">${need("mail", "Email", a.email, esc(a.email || ""), "We'll send a code to check it's yours", "email-add")}
    ${need("lock", "Password", a.has_password, "Set. Squad code, your name, then this", "Signs you in on any phone", "password")}</div>`;
}
const authNudge = () => !needsAccount() ? "" : `<section class="panel update">
    <div class="row"><span class="ic-badge">${ic("lock")}</span><div class="grow"><b class="disp">Make your account permanent</b><span class="small muted" style="display:block">Add an email and password so you can get back in on a new phone.</span></div></div>
    <div style="margin-top:12px">${accountRows()}</div>
  </section>`;
function accountSheet() {
  openSheet(`${sheetHead("Make your account permanent")}
    <p class="small muted" style="margin:-4px 0 12px">Every account needs an email and password, so you can get back in on a new phone.</p>
    ${accountRows()}`);
}
// Pops up when the game opens (and when you come back to it after half an hour), between fights only.
let accountPromptAt = 0;
function promptAccount(force) {
  if (!needsAccount() || S.view !== "main" || !$("#sheet").hidden) return;
  if (!force && Date.now() - accountPromptAt < 30 * 60000) return;
  accountPromptAt = Date.now();
  accountSheet();
}

// ---------- onboarding ----------
function viewWelcome() {
  const inv = S.invite;
  $("#app").innerHTML = `<section class="welcome">
    <div class="wl-hero"><div class="wl-bosses">${portraitImg("boss", "taxman", { w: 260, h: 280, cls: "b1" })}${portraitImg("boss", "autoplay", { w: 220, h: 240, cls: "b2" })}</div>
      <div class="logo ol">EFFORT</div><p class="tag">Out-walk your mates. Fight the Taxman every evening. Raid together on Sunday.</p></div>
    ${inv ? `<div class="panel invite"><span class="chip gold">${ic("squad")} You're invited</span><h3 class="ol-sm disp">${esc(inv.name)}</h3><p class="small muted">${inv.members} ${inv.members === 1 ? "player" : "players"} already walking.</p></div>` : ""}
    <section class="panel">
      <div class="how">
        <div class="hrow"><span class="hic">${ic("steps")}</span><div><b>Your steps are money</b><span>Every 100 steps is an Effort. Walk more than the squad and you hit harder, earn more and get taxed less.</span></div></div>
        <div class="hrow"><span class="hic">${ic("sword")}</span><div><b>6pm to 9pm: the Taxman</b><span>Five minutes, once a day. Beat him or he takes his cut.</span></div></div>
        <div class="hrow"><span class="hic">${ic("raid")}</span><div><b>Sunday: the raid</b><span>Fifteen minutes, the whole squad, one boss. The laziest walker gets hunted, and pays the top walker.</span></div></div>
      </div>
    </section>
    <button class="btn gold xl block" data-act="start">${inv ? `Join ${esc(inv.name)}` : "Make my walker"}</button>
    ${inv ? "" : `<form data-form="code" class="row" style="margin-top:12px"><input type="text" name="code" placeholder="Got a squad code?" autocomplete="off" maxlength="6" class="grow code"><button class="btn blue sm">Join</button></form>`}
    ${store.get("lastUser") ? `<button class="btn green block" style="margin-top:12px" data-act="signin-again">${ic("user")} Sign back in as ${esc(store.get("lastUser").name)}</button>` : ""}
    <button class="btn block" style="margin-top:12px" data-act="signin">${ic("user")} ${store.get("lastUser") ? "Someone else: sign in" : "I already play: sign in"}</button>
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
    <section class="panel" style="text-align:left">${(() => { const fx = G.statEffects(st); return G.STATS.map((s) => { const [icon, col] = STAT_LOOK[s.id]; return `<div class="stat fx${cls.stats.includes(s.id) ? " cl" : ""}"><span class="sic" style="background:${col}">${ic(icon)}</span><span class="sn">${s.label}</span><div class="bar"><i class="base" style="--sc:${col};width:${(st[s.id] / 10) * 100}%"></i></div><span class="sv">${st[s.id]}</span><small class="sfx">${esc(fx[s.id])}</small></div>`; }).join(""); })()}
      <p class="tiny faint" style="margin:6px 0 0">Everyone has ${G.STAT_TOTAL} points; your answers decide where they go. Gold names are your class's stats, and your class gear piles more onto your best one.</p></section>
    <div class="btn-row" style="margin-top:14px"><button class="btn" data-act="quiz-restart">Change answers</button><button class="btn gold" data-act="quiz-done">That's me</button></div>
  </section>`;
  // The draft portrait needs the draft answers.
  ANS["draft" + G.hash(JSON.stringify(a))] = a;
}
function viewSquad() {
  $("#app").innerHTML = `<section class="onboard">
    <div class="dots"><i class="on"></i><i></i><i></i></div>
    <h1 class="ol disp ob-title">Your squad</h1>
    <p class="muted">Make a squad and send the link, or join one.</p>
    <form class="panel" data-form="squad-create"><span class="field-label">Make a squad</span><input type="text" name="name" maxlength="40" required placeholder="The Lads, Uni Flat, Office 4…"><button class="btn green block" style="margin-top:12px">${ic("squad")} Make it</button></form>
    <form class="panel" data-form="squad-join"><span class="field-label">Or join one</span><div class="row"><input type="text" name="code" maxlength="6" required placeholder="ABC123" class="grow code" autocomplete="off" autocapitalize="characters"><button class="btn blue sm">Join</button></div></form>
    <button class="btn block" data-act="skip-squad">Do it later</button>
  </section>`;
}
function viewSetup() {
  const step = S.setupStep;
  $("#app").innerHTML = `<section class="onboard">
    <div class="dots"><i class="on"></i><i class="${step === "account" ? "" : "on"}"></i><i class="${step === "remind" ? "on" : ""}"></i></div>
    ${step === "account" ? `<h1 class="ol disp ob-title">Make it permanent</h1>
      <p class="muted">Add an email and password so you can always get back in.</p>
      <section class="panel">${accountRows()}</section>
      <button class="btn gold xl block" style="margin-top:14px" data-act="account-next" ${needsAccount() ? "disabled" : ""}>Next ${ic("arrowRight")}</button>
      <p class="tiny faint" style="text-align:center;margin:10px 0 0">Both are needed to carry on. The code can take a minute, and might be in spam.</p>`
    : step === "steps" && NATIVE ? `<h1 class="ol disp ob-title">Connect your phone</h1>
      <p class="muted">Two taps. Your steps and scrolling count by themselves from then on.</p>
      <section class="panel"><span class="field-label">Steps</span>${nativeSetup("steps")}<span class="field-label">App time (unlinked counts as over your allowance)</span>${nativeSetup("scroll")}</section>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="setup-next">Do it later</button><button class="btn gold" data-act="setup-next">Next ${ic("arrowRight")}</button></div>`
    : step === "steps" ? `<h1 class="ol disp ob-title">${setupPlat() === "ios" ? "Set up Effort on your iPhone" : setupPlat() === "android" ? "Get the Effort app" : "Your steps"}</h1>
      <p class="muted">${setupPlat() === "ios" ? "About five minutes, once. Then your steps flow in on their own." : setupPlat() === "android" ? "One download. Your steps and scrolling count by themselves from then on." : "Pick your phone below."}</p>
      ${setupBody("steps")}
      ${setupPlat() !== "other" ? `<button class="btn green block" style="margin-top:14px" data-act="check-sync" data-kind="steps">${ic("refresh")} Check it worked</button>
      <p id="sync-status" class="small muted" style="text-align:center;margin:10px 0"></p>` : `<div style="height:14px"></div>`}
      <div class="btn-row"><button class="btn" data-act="setup-next">Do it later</button><button class="btn gold" data-act="setup-next">Next ${ic("arrowRight")}</button></div>`
    : `<h1 class="ol disp ob-title">Don't miss the Taxman</h1>
      <p class="muted">The Taxman's in from 6 to 9pm, and the raid's Sunday 6 to 9pm. We'll ping you at 5, and at 9 if you miss him.</p>
      ${pushBlock()}
      <span class="field-label">Or put them in your calendar</span>
      ${reminderButtons()}
      <span class="field-label">So you can't get locked out</span>
      <div class="meths">${signinMethods()}</div>
      <p class="small faint" style="margin:14px 0">Tip: add Effort to your home screen (Share → Add to Home Screen on iPhone, ⋮ → Add to Home screen on Android) so it opens like an app.</p>
      <button class="btn gold xl block" data-act="setup-done">Let's go ${ic("arrowRight")}</button>`}
  </section>`;
}

// The quiz is done: make the player (joining the invite's squad if there is one).
async function finishQuiz() {
  const { name, ...character } = S.answers;
  const body = { name, character, platform: S.platform, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  let r;
  try { r = S.invite ? await call("join", { ...body, code: S.invite.code }) : await call("signup", body); }
  catch (e) {
    // Someone took the name while they were doing the quiz: back to the name, answers kept.
    if (await nameTaken(name)) { S.view = "quiz"; S.qi = 0; render(); scrollTo(0, 0); throw new Error(`Someone just took the name ${name}. Pick another`); }
    throw e;
  }
  saveToken(r.player.token);
  store.del("draftAnswers");
  await load();
  S.afterAccount = S.invite ? "setup" : "squad"; S.invite = null;
  S.view = "setup"; S.setupStep = "account";
  S.auth = { has_password: false, email: null, passkeys: 0 };
  refreshPush();
  render(); scrollTo(0, 0);
}
function quizAdvance() {
  store.set("draftAnswers", S.answers);
  if (S.qi < QUESTIONS.length - 1) { S.qi++; render(); scrollTo(0, 0); }
  else { S.view = "reveal"; render(); scrollTo(0, 0); }
}
// Names are unique across the whole game, ignoring case, spaces and punctuation (the database enforces it).
async function nameTaken(name) {
  try { const { data } = await realtime().rpc("name_taken", { p_name: name }); return data === true; } catch { return false; }
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

// ---------- 6pm to 9pm: the Taxman ----------
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
        <div class="nm"><b class="ol-sm">The Taxman</b><small>Collector of the evening levy</small></div>
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
      FX.play("ko"); banner("K.O.!", `Now rob him: up to ${Math.round(v.S.stealCap * 100)}% more`);
      if (v.A) v.A.bossKO(); else $("#boss")?.classList.add("ko");
      const [x, y] = bossXY(0.5); FX.coins(x, y, 26); FX.ring(x, y, { r1: 260, color: "rgba(255,210,80,.9)", width: 16 }); FX.shake($("#shake"), 14, 500);
      saveTax(false).catch(() => {});
    }
  }
  // Save progress every 10 seconds, so a dropped connection or a closed app doesn't lose the fight.
  if (v.B.t >= v.checkAt) { v.checkAt += 10; saveTax(false).catch(() => {}); }
  if (v.left <= 0 && !v.looting) return finishTax();
  paintTax();
}
// He's knocked out and you've taken all you can: go through his pockets, then the fight ends by itself.
function lootTax() {
  const v = V.tax; if (!v || v.looting) return;
  v.looting = true;
  const r = G.taxmanResult(v.B);
  saveTax(false).catch(() => {});
  hint(null);
  FX.play("coin"); FX.buzz(40);
  banner("Cleaned out!", `+${fmt(r.stolen)} Efforts stolen. His pockets are empty`);
  const [x, y] = bossXY(0.6);
  if (v.A) v.A.lootFinale(me().id);
  else { const b = $("#boss"); b?.classList.add("looted"); setTimeout(() => b?.classList.add("gone"), 1500); }
  let n = 0; const rain = setInterval(() => { if (!V.tax || ++n > 8) return clearInterval(rain); FX.coins(x, y, 10); FX.play("coin"); }, 180);
  setTimeout(() => { if (V.tax === v) finishTax(); }, 2800);
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
  paintCombo(B.combo, 1 + (B.combo / G.RULES.comboMax) * (T.comboBonus ?? 1));
  const feed = $("#t-feed");
  if (!B.ko && B.dmg > 0 && B.t - B.lastTap > 0.8) feed.innerHTML = `<div class="warn">He's recounting his money. Keep tapping.</div>`;
  else if (B.audit) feed.innerHTML = `<div class="warn">Audit: hit the moving target.</div>`;
  else if (v.looting) feed.innerHTML = `<div class="good">Pockets empty. Counting it up…</div>`;
  else if (B.ko) feed.innerHTML = `<div class="good">He's down. Every hit knocks more coins out of him.</div>`;
  else feed.innerHTML = "";
}
function taxTap(e) {
  const v = V.tax; if (!v || v.looting) return;
  const p = stagePoint(e), hit = G.taxmanTap(v.B, p.x, p.y);
  const [x, y] = FX.local(e.clientX, e.clientY);
  if (++v.taps === 6) hint(null);
  if (hit.kind === "receipt") { FX.play("coin"); FX.coins(x, y, 10); FX.number(x, y - 20, hit.bonus, { size: 26, grad: ["#fff3a0", "#f2b51d"] }); if (G.taxmanDone(v.B)) lootTax(); return; }
  if (hit.kind === "barge") FX.number(x, y - 46, "BARGE!", { size: 24, grad: ["#ffffff", "#9fd0ff"] });
  FX.tapHit(x, y, { crit: hit.crit, dmg: hit.dmg, kind: hit.kind, color: hit.kind === "weak" ? "#6fd4ff" : hit.kind === "blocked" ? "#9aa8ff" : "#ffd166" });
  FX.play(hit.kind === "blocked" ? "blocked" : hit.kind === "weak" ? "weak" : hit.crit ? "crit" : "hit");
  if (hit.crit || hit.kind === "weak") { FX.shake($("#shake"), 6, 180); FX.buzz(20); } else FX.buzz(6);
  if (v.B.ko) {
    // He's down: every tap is a stomp that knocks coins loose.
    const [bx, by] = bossXY(0.75);
    FX.coins(bx, by, hit.crit ? 8 : 3); if (hit.crit || Math.random() < 0.4) FX.play("coin");
    if (v.A) v.A.loot(me().id, { big: hit.crit || hit.kind === "barge" });
    else { const b = $("#boss"); b?.classList.remove("kicked"); void b?.offsetWidth; b?.classList.add("kicked"); }
    if (G.taxmanDone(v.B)) lootTax();
    return;
  }
  v.A?.heroAttack(me().id, { crit: hit.crit || hit.kind === "weak" || hit.kind === "barge" });
  if (hit.kind !== "blocked") bossHurt(hit.crit || hit.kind === "weak" || hit.kind === "barge");
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
// ---------- the raid lobby ----------
// Polls the server every 2s: who's in, who's ready, which boss. When it starts, everyone in it goes straight in.
async function openLobby() {
  FX.unlock();
  S.view = "lobby"; V.lobby = { data: null, busy: false };
  render();
  await lobbyCall("join");
  if (V.lobby) V.lobby.timer = setInterval(() => lobbyCall("poll"), 2000);
}
async function lobbyCall(action, extra = {}) {
  const L = V.lobby; if (!L || (L.busy && action === "poll")) return;
  L.busy = true;
  try {
    const r = await call("raid_lobby", { token: S.token, action, ...extra });
    if (!V.lobby) return;
    L.data = r; S.skew = r.now - Date.now();
    if (r.raid.status === "live" || r.raid.status === "settling") {
      const mine = (r.raid.fighters || []).includes(me().id);
      closeLobby(false);
      if (mine) { FX.play("roar"); return joinRaid(); }
      toast("The raid started without you"); S.view = "main"; S.tab = "raid"; await refresh(true); render(); return;
    }
    if (r.raid.status === "done") { closeLobby(false); S.view = "main"; S.tab = "raid"; await refresh(true); render(); return; }
    if (S.view === "lobby") render();
  } catch (e) {
    toast(e.message);
    if (action === "join") { closeLobby(false); S.view = "main"; S.tab = "raid"; render(); }
  } finally { if (V.lobby) V.lobby.busy = false; }
}
function closeLobby(leave) {
  if (!V.lobby) return;
  clearInterval(V.lobby.timer);
  V.lobby = null;
  if (leave) call("raid_lobby", { token: S.token, action: "leave" }).catch(() => {});
}
function viewLobby() {
  const L = V.lobby, d = L?.data;
  const head = `<div class="quiz-top"><button class="iconbtn" data-act="lobby-leave" aria-label="Leave the lobby">${ic("chevronLeft")}</button><span class="grow"></span><span class="chip">${ic("clock")} Start by 9pm</span></div>`;
  if (!d) { $("#app").innerHTML = `<section class="onboard">${head}<div class="boot" style="min-height:40dvh"><p class="muted">Joining the lobby…</p></div></section>`; return; }
  const members = squad().members, here = d.lobby.filter((x) => x.here), mine = here.find((x) => x.id === me().id);
  const ready = here.filter((x) => x.ready).length, need = Math.max(0, d.min - here.length);
  const last = d.bosses.last;
  const opt = (t) => {
    const b = G.bossFor(t), g = goalNow(t), sel = t === d.raid.tier;
    const tag = G.isEventTier(t) ? `Event · ${b.eventName}` : !last ? "First raid" : t === last ? "Same as last week" : t > last ? "One up" : "One down";
    return `<button class="bossopt ${sel ? "on" : ""}" data-act="lobby-boss" data-tier="${t}" aria-pressed="${sel}">
        <span class="bp has-fallback"><span class="fb">${ic("raid")}</span>${portraitImg("boss", b.id, { w: 120, h: 130 })}</span>
        <span class="grow"><small>${tag}</small><b>${esc(b.name)}</b><span class="tiny" style="display:block">${esc(b.title)}</span><span class="tiny faint" style="display:block;margin-bottom:2px">${esc(b.style || "")}</span><span class="tiny ${g.met ? "" : "red-t"}">${g.met ? "Step goal made" : "Step goal missed: enraged"}</span></span>
      </button>`;
  };
  const st = myStats(), best = G.suggestedPosition(st), pos = me().pos || best;
  const noGear = G.SLOTS.filter((sl) => !me().gear?.[sl]);
  $("#app").innerHTML = `<section class="onboard rlobby">${head}
    <h1 class="ol disp ob-title">Raid lobby</h1>
    <p class="muted">${need ? `Need ${need} more to start (at least ${d.min}).` : ready === here.length ? "Everyone's ready. Starting…" : `${ready} of ${here.length} ready. It starts when everyone is.`}</p>
    <span class="field-label">This week's boss</span>
    <div class="bossopts">${d.bosses.list.map(opt).join("")}</div>
    <p class="tiny faint" style="margin:6px 0 0">Changing the boss means everyone taps Ready again.</p>
    <span class="field-label">Squad</span>
    <div class="mates">${members.map((m) => {
      const x = d.lobby.find((y) => y.id === m.id && y.here);
      return `<div class="mate">${face(m.id, 40)}<div class="grow"><b>${esc(m.id === me().id ? "You" : m.name)}</b><small>${x ? (x.ready ? "Ready" : "In the lobby") : "Not here"}</small></div>${x?.ready ? `<span class="chip green">${ic("check")}</span>` : ""}</div>`;
    }).join("")}</div>
    <span class="field-label">You</span>
    <div class="panel flat" style="margin:0">
      <div class="loadout">${G.SLOTS.map((sl) => {
        const it = G.itemById(me().gear?.[sl]);
        return it ? `<button class="slot full" style="--rc:${G.tierOf(it.tier).color}" data-act="gear-pick" data-slot="${sl}" aria-label="Change your ${sl}: ${esc(it.name)}"><div class="art">${itemArt(it)}</div><span class="slab">${esc(it.name)}</span></button>`
          : `<button class="slot" data-act="gear-pick" data-slot="${sl}" aria-label="Pick a ${sl}"><div class="ph">${ic({ weapon: "sword", armour: "guard", trinket: "star" }[sl])}<span>${sl[0].toUpperCase() + sl.slice(1)}</span></div></button>`;
      }).join("")}</div>
      <p class="tiny faint" style="margin:6px 0 10px">Tap a slot to swap in anything you own.</p>
      <div class="seg">${G.POSITIONS.map((p) => `<button data-pos="${p.id}" aria-pressed="${p.id === pos}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div>
      <p class="tiny ${pos === best ? "faint" : "red-t"}" style="margin:8px 0 0">${pos === best ? `${G.posOf(pos).label} is your home row.` : `Your home row is the ${G.posOf(best).label.toLowerCase()}. Here you hit weaker and take more.`}${noGear.length ? ` <span class="red-t">Nothing in your ${noGear.join(", ")} slot${noGear.length > 1 ? "s" : ""}.</span>` : ""}</p>
    </div>
    <button class="btn ${mine?.ready ? "" : "gold"} xl block" style="margin-top:14px" data-act="lobby-ready">${mine?.ready ? "Not ready" : `${ic("check")} Ready`}</button>
  </section>`;
}

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
  for (const m of r.roster) ANS[m.id] = { ...(m.answers && m.answers.time ? m.answers : Walker.fallbackAnswers(m.id)), ...wearOf(m.wear) };
  V.raid = {
    raid: r.raid, roster: Object.fromEntries(r.roster.map((m) => [m.id, m])), my: r.me, R: null, host: false, A: null,
    present: {}, heard: {}, tapBudget: {}, joinedAt: now(), out: { taps: 0, ab: false, sp: false, move: null, ans: null }, fxOut: [], snapAt: 0,
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
    R = G.raidCreate(Object.keys(v.roster).map(fighter), { seed: Number(v.raid.seed), tier: v.raid.tier, minutes: G.RULES.raidMin, enraged: !!v.raid.goal?.enraged, affix: v.raid.goal?.affix || null, den: v.raid.goal?.den || null });
    for (const m of R.members) m.away = !(m.id in v.present);
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
  if (p.sp) G.raidSpecial(R, p.id);
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
    if (!v.hunt && t - v.lastSave > 15000) { v.lastSave = t; call("raid_sync", { token: S.token, raid_id: v.raid.id, snapshot: G.raidExport(R) }).then((r) => { if (r.status === "done" && r.result) showRaidResult(r.result, v); }).catch(() => {}); }
    if (R.over) return hostFinish();
    if (rosterKey(R) !== v.rosterKey) return render();
  } else {
    // Not the host: send what you did since the last message.
    const o = v.out;
    if ((o.taps || o.ab || o.sp || o.move || o.ans != null) && t - v.lastSent >= 120) {
      v.lastSent = t;
      v.ch?.send({ type: "broadcast", event: "in", payload: { id: v.my, ...o } });
      v.out = { taps: 0, ab: false, sp: false, move: null, ans: null };
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
  if (v.hunt) {
    try {
      const r = await call("hunt_finish", { token: S.token, how: res.how, frac: 1 - R.boss.hp / R.boss.max, members: R.members.map((m) => ({ id: m.id, dmg: Math.round(m.dmg), healed: m.healed, taken: m.taken })) });
      return { ...R.result, hunt: true, shares: R.result.shares.map((x) => ({ ...x, reward: x.id === v.my ? r.amount : 0, tax: 0, total: x.id === v.my ? r.amount : 0 })), settle: null };
    } catch (e) { toast(e.message); return { ...R.result, hunt: true, shares: [], settle: null }; }
  }
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
        <div class="nm"><b class="ol-sm">${esc(R.boss.name)}${R.boss.enraged ? ' <span class="chip red" style="height:18px;font-size:9.5px;padding:0 6px">Enraged</span>' : ""}</b><small>Boss ${R.tier} · ${R.members.filter((m) => !m.away).length} fighting</small></div>
        <div class="right"><span class="timer">${ic("clock")}<span id="r-clock"></span></span><button class="hbtn" data-act="raid-quit" aria-label="Leave the raid">${ic("close")}</button></div></div>
      <div class="hp" id="r-hp"><i class="ghost"></i><i class="fill"></i><div class="ticks"></div><span></span></div>
      <div class="buffs" id="buffs"></div>
    </div>
    <div class="tele idle" id="tele"><span class="ti">${ic("eye")}</span><span class="tt"></span><i class="cd"></i></div>
    <div class="arena-stage" id="stage">${three ? '<div id="plates"></div>' : `<div class="boss2d" id="boss">${Walker.boss(1, false)}</div>`}<div class="combo" id="combo"></div><div class="taphint" id="hint">${ic("target")} Tap the boss</div></div>
    ${three ? "" : `<div class="party2d">${R.members.map((m) => `<div class="m" id="m-${m.id}"><div class="f" style="transform:scale(${G.stepScale(m.stride)})">${head2d(ANS[m.id])}</div>${esc(m.id === v.my ? "You" : m.name)}</div>`).join("")}</div>`}
    <div class="foot"><div class="log" id="feed"></div>
      <div class="controls"><button class="ability" id="ab" data-act="ability" aria-label="Ability"><span class="cdv"></span><span class="ic-slot"></span><span class="secs"></span><span class="al"></span></button>
        <button class="special" id="sp" data-act="special" aria-label="Special"><span class="ring"></span><span class="ic-slot"></span><span class="pct"></span><span class="al"></span></button>
        <div class="rows">${G.POSITIONS.map((p) => `<button data-move="${p.id}" aria-label="Move to ${p.label}">${ic(ROW_ICON[p.id])}${p.label}</button>`).join("")}</div></div>
    </div>
  </div><div id="trivia"></div><div id="veil"></div></div>`;
  FX.init($("#arena"));
  if (!R.over) FX.music(true, R.boss.phase || 1);
  if (three) {
    v.A = make3d({ mode: "raid", boss: { id: R.boss.id }, team: R.members.map((m) => ({ id: m.id, you: m.id === v.my, answers: ANS[m.id], pos: m.pos, scale: G.stepScale(m.stride) })) });
    if (!v.A) return renderRaid();
    $("#plates").innerHTML = R.members.map((m) => `<div class="plate ${m.id === v.my ? "me" : ""} ${m.title || ""}" id="np-${m.id}">${m.title === "top" ? `<span class="tt">${ic("crown")}</span>` : m.title === "last" ? `<span class="tt">${ic("warning")}</span>` : ""}${esc(m.id === v.my ? "You" : m.name)}<span class="pw ${m.stride >= 1.15 ? "hi" : m.stride <= 0.85 ? "lo" : ""}">×${(m.stride || 1).toFixed(2)}</span><span class="st"></span><i><s></s></i></div>`).join("");
  }
  v.abRow = null; v.q = null;
  if (!v.toasted) {
    v.toasted = true;
    const mine = R.members.find((m) => m.id === v.my) || v.roster[v.my];
    setTimeout(() => toast(mine.title === "top" ? `Top walker this week: you hit ×${mine.stride.toFixed(2)}` : mine.title === "last" ? `Dead weight this week: ×${mine.stride.toFixed(2)} power, and the boss knows it` : `Your steps give you ×${mine.stride.toFixed(2)} power`), 900);
    FX.play("roar"); setTimeout(() => banner(R.boss.name, R.boss.title), 150);
    if (G.affixInfo(R.affix)) setTimeout(() => toast(`${G.affixInfo(R.affix).name}: ${G.affixInfo(R.affix).what}`), 3200);
  }
  $("#arena").classList.toggle("fogged", G.affixList(R.affix).includes("fog"));
  $("#arena").classList.toggle("frosted", G.affixList(R.affix).includes("frost"));
  paintRaid();
}
// Sound, shake and (for the person hit) a banner for each boss's signature move.
const SIG_FX = { ooze: ["ooze", 6, "Slimed: half damage till you move or get healed"], spores: ["spores", 4, "Spores: healing clears them"], vanish: ["swipe", 9, ""],
  gust: ["gust", 8, "Blown back: get back to your row"], grab: ["grab", 7, "Grabbed: your squad has to free you"], slam: ["slam", 16, ""], breath: ["breath", 10, "Burning: healing puts it out"] };
const SIG_COL = { ooze: "#7dff6a", spores: "#ffa13d", vanish: "#b9c8ff", gust: "#9ff3ff", grab: "#9b5cff", slam: "#ff7a2f", breath: "#ff7a1a" };
const SPECIAL_COL = { bouncer: "#ffc83d", menace: "#ff4d5e", mad: "#7dff6a", gremlin: "#ff8a2b", lollipop: "#fff04a", librarian: "#9fb4ff", pigeon: "#e8e8f0", courier: "#45d483", pickpocket: "#c77dff", hedge: "#6fd4ff" };
// Squad-wide effects from specials, with time left.
function paintBuffs(R) {
  const el = $("#buffs"); if (!el) return;
  const left = (u) => Math.max(0, Math.ceil(u - R.t));
  const mine = R.members.find((m) => m.id === V.raid?.my);
  const list = [
    R.t < R.vulnUntil && ["fire", `Brew +${Math.round(G.RULES.brewVuln * 100)}%`, left(R.vulnUntil)],
    R.t < R.weakUntil && ["coin", "Wallet lifted", left(R.weakUntil)],
    R.t < R.prophecyUntil && ["eye", "Prophecy", left(R.prophecyUntil)],
    R.t < R.swarmUntil && ["crown", "Pigeons", left(R.swarmUntil)],
    mine && R.t < mine.joyUntil && ["speed", "Joyride", left(mine.joyUntil)],
    R.blockNext && ["flag", "Next attack blocked", ""],
    R.feeble && ["brains", `SHHH ×${R.feeble}`, ""],
  ].filter(Boolean);
  const html = list.map(([i, t, s]) => `<span class="buff">${ic(i)}${esc(t)}${s !== "" ? `<b>${s}</b>` : ""}</span>`).join("");
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
}
const mateEl = (id) => $(`#np-${id}`) || $(`#m-${id}`);
const mateXY = (id) => { const A = arena(); if (A) return toArena(A.screenOf(id, 0.75)); return mateEl(id) ? FX.centre(mateEl(id)) : [0, 0]; };
function raidFx(e) {
  const v = V.raid; if (!v || !$("#arena")) return;
  const R = v.R, A = v.A, my = v.my;
  const [bx, by] = bossXY();
  switch (e.type) {
    case "tap": if (!e.miss) A?.heroAttack(e.id, { crit: e.crit, big: e.swing }); break;
    case "move": A?.move(e.id, e.pos); break;
    case "windup": {
      if (A) A.bossWindup(e.attack, e.ids || []);
      FX.play(e.attack === "vanish" ? "vanish" : "warn");
      const mine = R.members.find((m) => m.id === my);
      if (mine?.pos === "mid" && G.ATTACKS[e.attack]?.cut) hint(`${ic("bigSwing")} ${G.ATTACKS[e.attack].stop ? "Stop it" : "Stagger it"}: hit hard now`);
      break;
    }
    case "attack": {
      A?.bossAttack(e.attack, e.ids);
      if (e.attack === "swipe") { FX.play("swipe"); for (const id of e.ids) { const [x, y] = mateXY(id); FX.claw(x, y); } FX.shake($("#shake"), 6, 220); }
      if (e.attack === "stomp") { FX.play("stomp"); FX.shake($("#shake"), A ? 8 : 14, 500); }
      if (e.attack === "scream") { FX.play("scream"); if (!A) FX.screamWaves(bx, by); FX.shake($("#shake"), 6, 600); }
      if (e.attack === "feast") { FX.play("feast"); FX.chomp(bx, by + 30); banner(R.boss.attacks?.feast || "Feast", "Burst it down before it heals"); }
      if (SIG_FX[e.attack]) {
        const [snd, shake, sub] = SIG_FX[e.attack];
        FX.play(snd); FX.shake($("#shake"), shake, 500);
        if (e.attack === "vanish") FX.play("appear");
        if (!A) for (const id of e.ids || []) { const [x, y] = mateXY(id); FX.sparks(x, y, SIG_COL[e.attack], 14, 400); }
        if (sub && (e.ids || []).includes(my)) banner(R.boss.attacks?.[e.attack] || G.ATTACKS[e.attack].label, sub);
      }
      break;
    }
    case "hurt": {
      A?.hurt(e.id);
      const [x, y] = mateXY(e.id); FX.number(x, y - 20, `-${e.amt}`, { size: 22, color: "#ff6b78" });
      if (e.id === my) { FX.flash($("#arena")); FX.play("hurt"); FX.buzz(40); }
      break;
    }
    case "dodge": { const [x, y] = mateXY(e.id); FX.number(x, y - 20, "Dodge", { size: 20, color: "#9af0ff" }); break; }
    case "shield": FX.play("shield"); A?.shield(e.ids, 6 + (R.members.find((m) => m.id === e.by)?.perks.shield || 0)); break;
    case "swing": { FX.play("swing"); A?.heroAttack(e.by, { big: true }); const [x, y] = mateXY(e.by); FX.number(x, y - 30, "Big swing!", { size: 22, grad: ["#fff3a0", "#ff7a3d"] }); break; }
    case "heal": { FX.play("heal"); A?.heal(e.by, e.id); const [x, y] = mateXY(e.id); if (!A) FX.heal(x, y); FX.number(x, y - 26, `+${e.amt}`, { size: 22, color: "#7ee29d" }); break; }
    case "down": { FX.play("down"); A?.down(e.id); const [x, y] = mateXY(e.id); FX.number(x, y - 20, "Down", { size: 22, color: "#ff6b78" }); FX.sparks(x, y, "#ff6b78", 16, 300); break; }
    case "secondWind": { const [x, y] = mateXY(e.id); FX.number(x, y - 26, "Second wind", { size: 20, grad: ["#ffffff", "#7ee29d"] }); FX.play("revive"); break; }
    case "revive": FX.play("revive"); for (const id of e.ids) { A?.revive(id); const [x, y] = mateXY(id); FX.heal(x, y); } banner("Back up!"); break;
    case "phase": FX.play("phase"); FX.music(true, e.phase); A?.phase(e.phase); $("#arena").classList.toggle("p2", e.phase === 2); $("#arena").classList.toggle("p3", e.phase === 3); banner(e.phase === 2 ? "Phase 2" : "Enraged", e.phase === 2 ? "It hits harder" : "It's fast now"); FX.shake($("#shake"), 12, 600); break;
    case "feastEnd": if (e.healed) { FX.number(bx, by - 40, `+${fmt(e.healed)}`, { size: 30, color: "#7ee29d" }); FX.play("heal"); } else { FX.number(bx, by - 40, "Interrupted", { size: 26, grad: ["#fff3a0", "#ff7a3d"] }); FX.play("combo"); } break;
    case "special": {
      const m = R.members.find((x) => x.id === e.id), S = m && G.specialOf(m);
      FX.play("special"); A?.special(e.id, e.cls, e.roll); FX.shake($("#shake"), 10, 450); FX.buzz(30);
      if (S) {
        const [x, y] = mateXY(e.id);
        FX.number(x, y - 34, S.name, { size: 24, grad: ["#ffffff", SPECIAL_COL[e.cls] || "#ffd166"] });
        if (e.id === my || ["lollipop", "librarian", "hedge", "pigeon"].includes(e.cls)) banner(S.name, e.id === my ? S.what : `${m.name}: ${S.what}`);
        if (["bouncer", "mad", "pickpocket"].includes(e.cls) || e.roll === "crit") setTimeout(() => { FX.sparks(bx, by, SPECIAL_COL[e.cls] || "#ffd166", 30, 700); bossHurt(true); }, 380);
      }
      break;
    }
    case "stagger": {
      A?.stagger(e.stopped); FX.play("stagger"); FX.shake($("#shake"), e.stopped ? 12 : 7, 350);
      FX.number(bx, by - 50, e.stopped ? "Stopped!" : "Staggered", { size: e.stopped ? 34 : 28, grad: ["#ffffff", "#ffd166"] });
      if (e.id === my) FX.buzz(25);
      break;
    }
    case "blocked": A?.blocked(); FX.play("shield"); FX.number(bx, by + 10, e.stopped ? "Never landed" : "Blocked", { size: 26, grad: ["#ffffff", "#8fd8ff"] }); break;
    case "pulse": { A?.pulse(e.by, e.id); if (e.id === my || e.by === my) FX.play("pulse"); const [x, y] = mateXY(e.id); FX.number(x, y - 20, `+${e.amt}`, { size: 16, color: "#7ee29d" }); break; }
    case "release": { A?.release(e.id, e.freed); if (e.freed) { FX.play("release"); const [x, y] = mateXY(e.id); FX.number(x, y - 28, "Free!", { size: 22, grad: ["#ffffff", "#c9a6ff"] }); } break; }
    case "trivia": FX.play("warn"); break;
    case "answered": if (e.id !== my) FX.play(e.valid ? "tap" : "blocked"); break;
    case "triviaDone": FX.play(e.failed ? "wrong" : "right"); if (e.dive) { FX.number(bx, by, `-${fmt(e.dive)}`, { size: 38, grad: ["#c8f7ff", "#2bb3ff"] }); FX.sparks(bx, by, "#6fd4ff", 24, 600); bossHurt(true); } break;
    case "paralysed": FX.play("stun"); banner("Paralysed", `${fmt(G.RULES.paralysedSteps)} steps down tomorrow`); break;
    case "end": FX.music(false); break;
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
  if (R.grab) {
    const who = R.members.find((m) => m.id === R.grab.id);
    tele.className = "tele grab";
    tt.innerHTML = `${esc(B.attacks.grab || "Grab")}: ${esc(who?.id === v.my ? "you" : who?.name || "")}<small>${fmt(R.grab.dealt)} / ${fmt(R.grab.need)} to break free</small>`;
    cdbar.style.width = `${Math.max(0, (R.grab.until - R.t) / 10) * 100}%`;
  } else if (B.feast) {
    tele.className = "tele feast";
    tt.innerHTML = `${esc(B.attacks.feast)}<small>${fmt(B.feast.dealt)} / ${fmt(B.feast.need)} damage</small>`;
    cdbar.style.width = `${Math.max(0, (B.feast.until - R.t) / 6) * 100}%`;
  } else if (B.next && R.t >= B.next.warnAt) {
    const a = G.ATTACKS[B.next.type], total = B.next.at - B.next.warnAt;
    const N = B.next, need = a.cut ? G.interruptNeed(R, N.type) : 0;
    tele.className = `tele hot ${N.staggered ? "staggered" : ""}`;
    const meter = a.cut && !N.staggered && R.members.some((m) => m.alive && m.pos === "mid") ? ` · middle ${Math.min(100, Math.round((N.mid / need) * 100))}% to ${a.stop ? "stop" : "stagger"}` : N.staggered ? (N.cancel ? " · stopped" : " · staggered") : "";
    tt.innerHTML = `${esc(B.attacks[N.type] || a.label)}<small>${esc(a.what)}${meter} · ${Math.max(0, N.at - R.t).toFixed(1)}s</small>`;
    cdbar.style.width = `${Math.max(0, (B.next.at - R.t) / total) * 100}%`;
  } else {
    tele.className = "tele idle";
    tt.innerHTML = `Phase ${B.phase}<small>watching for its next move</small>`;
    cdbar.style.width = "0";
  }
  paintBuffs(R);
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
      const st = m.away ? "eye" : !m.alive ? "skull" : R.grab?.id === m.id ? "lock" : R.t < m.stunUntil ? "bolt" : R.t < m.dotUntil ? "fire" : R.t < m.slimeUntil ? "warning" : R.t < m.shieldUntil ? "guard" : m.swing ? "bigSwing" : (m.sp || 0) >= G.RULES.spMax ? "star" : "";
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
    const sp = $("#sp"), S = G.specialOf(mine), chg = Math.min(1, (mine.sp || 0) / G.RULES.spMax);
    if (v.spCls !== mine.cls) { v.spCls = mine.cls; sp.querySelector(".ic-slot").innerHTML = ic(S.icon); sp.querySelector(".al").textContent = S.short; sp.setAttribute("aria-label", `${S.name}: ${S.what}`); sp.style.setProperty("--sc", SPECIAL_COL[mine.cls] || "#ffd166"); }
    sp.style.setProperty("--sp", `${chg * 360}deg`);
    sp.querySelector(".pct").textContent = chg < 1 ? `${Math.floor(chg * 100)}%` : "";
    const spReady = chg >= 1 && mine.alive && R.t >= mine.stunUntil && R.t >= mine.moveUntil;
    sp.disabled = !spReady; sp.classList.toggle("ready", spReady);
    if (spReady && !v.spToast) { v.spToast = true; FX.play("combo"); toast(`${S.name} is ready: ${S.what}`); }
    if (!spReady) v.spToast = false;
    document.querySelectorAll("[data-move]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.move === mine.pos)));
    if (!mine.alive) hint(`${ic("skull")} You're down. Answer your question`);
    else if (R.t < mine.stunUntil) hint(`${ic("bolt")} Paralysed`);
    else if (R.grab?.id === mine.id) hint(`${ic("lock")} Grabbed! Your squad has to hit it to free you`);
    else if (R.t < mine.moveUntil) hint(`${ic("arrowRight")} Moving rows`);
    else if (B.hidden) hint(`${ic("eye")} It's vanished. It'll go for the weakest`);
    else if (mine.pos !== mine.home && mine.botBackAt && R.t < mine.botBackAt + 6) hint(`${ic("arrowRight")} Blown out of place: tap ${G.posOf(mine.home).label} to get back`);
    else if (R.t < mine.slimeUntil) hint(`${ic("warning")} Slimed: half damage. Move rows or get healed`);
    else if (mine.swing) hint(`${ic("fire")} Big swing: ${mine.swing} hits left`);
    else hint(v.taps >= 6 ? null : `${ic("target")} Tap the boss`);
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
  else if (v.R.boss.hidden) { v.out.taps++; hit = { dmg: 0, miss: true }; }
  else {
    // The host decides the real hit; show a fair estimate straight away so tapping feels instant.
    v.out.taps++;
    const swing = mine.swing > 0;
    hit = { dmg: (20 + mine.g.power * 4) * mine.stride * G.posOf(mine.pos).mult * (1 + mine.combo / (G.RULES.comboMax * 2)) * (swing ? 3 : 1), crit: false, swing };
  }
  if (hit.miss) { FX.number(x, y, "Miss", { size: 18, color: "#b9c8ff" }); FX.play("blocked"); return; }
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
    if (kind === "sp") G.raidSpecial(v.R, v.my);
    if (kind === "move") G.raidMove(v.R, v.my, val);
    if (kind === "ans") return G.raidAnswer(v.R, v.my, val);
  } else {
    if (kind === "ab") v.out.ab = true;
    if (kind === "sp") v.out.sp = true;
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
        <p class="tiny faint" style="margin:8px 0 0">This covers all of today's steps, so keep walking.</p>
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
        ${!mine ? `<div class="small muted">You weren't in this one.</div>` : ""}${won && !out.hunt && !G.isEventTier(out.tier) ? `<div class="small muted">Next Sunday: ${esc(G.bossFor(out.tier + 1).name)}</div>` : ""}${out.prize ? `<div class="small" style="margin-top:6px">${ic("star")} Won the <b>${esc(G.wardrobeById(out.prize)?.name || "")}</b>. Wear it from Me → Wardrobe.</div>` : ""}</section>`;
  }
  $("#app").innerHTML = `<div class="results ${won ? "" : "lost"}" id="arena"><div class="inner">
    <div class="ribbon ol">${title}</div>
    <div class="subline">${sub}</div>
    <div class="stack">${body}
      <section class="panel"><div class="row spread"><b class="disp" style="font-size:17px" id="lvl-now">Level ${res.lvlBefore}</b></div><div class="xp big"><i style="width:0%"></i><span class="xpt"></span></div><div id="lvlup"></div></section>
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
  $(".results .xp .xpt").textContent = `${fmt(p.into)} / ${fmt(p.need)} XP`;
  $("#lvl-now").textContent = `Level ${p.lvl}`;
  if (p.lvl > res.lvlBefore) { $("#lvlup").innerHTML = `<div class="lvlup ol">Level ${p.lvl}!</div>`; FX.play("levelup"); FX.confetti(100); }
  btn.innerHTML = `Continue ${ic("arrowRight")}`;
  btn.dataset.act = "back";
}

// ---------- clocks ----------
// Countdowns tick every second; crossing 6pm (or the end of a window) reloads so the buttons are right.
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
  if (kind === "chat") { chatSend(); return; }
  switch (kind) {
    case "answer": {
      const text = $("#tv-in").value.trim(); if (!text) return;
      const res = raidAct("ans", text);
      if (res) FX.play(res.valid ? (res.rarity === 3 ? "rare" : "right") : "wrong");
      paintTrivia();
      break;
    }
    case "quiz-intro": {
      const name = String(data.name || "").trim();
      if (!name) break;
      S.answers.name = name;
      if (await nameTaken(name)) { toast(`Someone's already called ${name}. Pick something else`); f.querySelector("[name=name]")?.select(); break; }
      quizAdvance(); break;
    }
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
    case "email-send": await busy(async () => {
      const email = String(data.email).trim().toLowerCase(), forSignin = f.dataset.mode === "signin";
      await sendEmailCode(email, forSignin);
      if (forSignin) { S.signin = { step: "emailcode", email }; render(); setTimeout(() => $("[name=code]")?.focus(), 50); }
      else emailSheet(email);
    }); break;
    case "email-verify": await busy(async () => {
      const access = await checkEmailCode(f.dataset.email, data.code);
      if (f.dataset.mode === "signin") { const r = await callAuth("email_signin", { access_token: access }); await signedIn(r.token); return; }
      const r = await callAuth("link_email", { token: S.token, access_token: access });
      S.auth = { ...(S.auth || {}), email: r.email }; closeSheet(); render(); toast("Email added");
      if (needsAccount()) promptAccount(true);
    }); break;
    case "set-password": await busy(async () => {
      if (data.password !== data.again) throw new Error("Those two don't match");
      await callAuth("set_password", { token: S.token, password: data.password });
      S.auth = { ...(S.auth || {}), has_password: true }; closeSheet(); render(); toast("Password saved");
      if (needsAccount()) promptAccount(true);
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
  if (d.tab === "chat") { if (!$("#sheet").hidden) closeSheet(); openChat(); return; }
  if (d.jump) { chatJump(Number(d.jump)); return; }
  if (d.cact) { chatAction(d.cact, Number(d.id)); return; }
  if (d.tab && S.view === "chat") { closeChat(d.tab); FX.play("tap"); return; }
  if (d.tab) { if (!$("#sheet").hidden) closeSheet(); S.tab = d.tab; store.set("tab", d.tab); render(); scrollTo(0, 0); FX.play("tap"); return; }
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
    me().pos = d.pos; render(); // works in the lobby too
    call("equip", { token: S.token, pos: d.pos }).catch((err) => toast(err.message));
    return;
  }
  if (d.shoptab) { S.shopTab = d.shoptab; render(); return; }
  if (d.shopslot) { S.shopSlot = d.shopslot; render(); return; }
  if (d.shopstyle) { S.shopStyle = d.shopstyle; render(); return; }
  if (d.profile) { profileSheet(d.profile); FX.play("tap"); return; }
  if (d.steps) { stepsSheet(d.steps); FX.play("tap"); return; }
  if (d.item) { itemSheet(d.item, d.deal === "1"); FX.play("tap"); return; }
  if (d.skin) { skinSheet(d.skin); FX.play("tap"); return; }
  if (d.buy) { const item = G.itemById(d.buy); return shopAction("buy", { item: d.buy, deal: d.deal === "1" }, () => { FX.play("buy"); itemSheet(item.id, false); toast(`${item.name} equipped`); }); }
  if (d.upgrade) return shopAction("upgrade", { item: d.upgrade }, () => { FX.play("levelup"); itemSheet(d.upgrade, false); });
  if (d.equip) { const it = G.itemById(d.equip); return shopAction("equip", { slot: it.slot, item: it.id }, () => { FX.play("buy"); itemSheet(it.id, false); }); }
  if (d.unequip) return shopAction("equip", { slot: d.unequip, item: null }, closeSheet);
  if (d.move && V.raid) { raidAct("move", d.move); FX.play("tap"); return; }
  switch (d.act) {
    case "close-sheet": closeSheet(); break;
    case "push-on": t.disabled = true; await enablePush(); t.disabled = false; break;
    case "signin": S.view = "signin"; S.signin = { step: "code" }; render(); scrollTo(0, 0); break;
    case "signin-again": {
      const u = store.get("lastUser");
      if (!u) break;
      S.view = "signin"; S.signin = { step: "password", quick: true, code: u.code, id: u.id, people: [{ id: u.id, name: u.name, character: u.character, has_password: true }] };
      render(); scrollTo(0, 0); setTimeout(() => $("[name=password]")?.focus(), 50); break;
    }
    case "signin-back": {
      const st = S.signin;
      if (!st || st.step === "code" || st.quick) { S.view = "welcome"; S.signin = null; }
      else st.step = st.step === "password" ? "who" : st.step === "emailcode" ? "email" : "code";
      render(); break;
    }
    case "password": passwordSheet(); break;
    case "passkey-add": t.disabled = true; await addPasskey(); t.disabled = false; break;
    case "passkey-signin": t.disabled = true; await passkeySignin(); t.disabled = false; break;
    case "email-add": case "email-again": emailSheet(); break;
    case "signin-email": S.signin = { step: "email" }; render(); setTimeout(() => $("[name=email]")?.focus(), 50); break;
    case "app-update-later": store.set("appUpdateLater", Date.now()); S.appUpdate = false; render(); break;
    case "native-steps": natOr("connectSteps"); break;
    case "native-scroll": natOr("connectScroll"); break;
    case "native-reminders-on": natOr("reminders", true); break;
    case "native-reminders-off": natOr("reminders", false); break;
    case "native-test": if (nat("testReminder")) toast("Sent. Check your notifications"); break;
    case "native-sync": if (nat("syncNow")) toast("Syncing…"); break;
    case "push-off": disablePush(); break;
    case "push-test": try { await callPush("test", { token: S.token }); toast("Sent. It should arrive in a few seconds"); } catch (err) { toast(err.message); } break;
    case "start": S.view = "quiz"; S.qi = 0; render(); break;
    case "quiz-back": if (S.qi > 0) { S.qi--; render(); } else { S.view = "welcome"; render(); } break;
    case "quiz-next": quizAdvance(); break;
    case "quiz-restart": S.view = "quiz"; S.qi = 1; render(); break;
    case "quiz-done": t.disabled = true; try { await finishQuiz(); } catch (err) { toast(err.message); t.disabled = false; } break;
    case "look": lookSheet(); break;
    case "look-house": closeSheet(); S.tab = "shop"; S.shopTab = "house"; render(); scrollTo(0, 0); break;
    case "look-wear": lookWear(d.id || null); break;
    case "skip-squad": S.view = "setup"; S.setupStep = "steps"; render(); break;
    case "setup-next": S.setupStep = "remind"; render(); scrollTo(0, 0); break;
    case "account-next":
      if (needsAccount()) break;
      S.view = S.afterAccount === "squad" ? "squad" : "setup"; S.setupStep = "steps"; render(); scrollTo(0, 0); break;
    case "setup-done": S.view = "main"; S.tab = "today"; render(); scrollTo(0, 0); break;
    case "setup-steps": setupSheet("steps"); break;
    case "setup-scroll": setupSheet("scroll"); break;
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
    case "wallet": walletSheet(); break;
    case "copy-restore": copy(`${APP_URL}?me=${S.token}`, "Restore link copied. Keep it private"); break;
    case "signout": {
      const a = S.auth || {}, ways = [a.passkeys && "fingerprint", a.email && "an email code", a.has_password && "your password"].filter(Boolean);
      if (confirm(ways.length ? `Sign out on this phone? You can sign back in with ${ways.join(", ").replace(/, ([^,]*)$/, " or $1")}.` : "Sign out on this phone? You haven't added an email, password or fingerprint, so you'd need your restore link to get back in.")) signOut("Signed out");
      break;
    }
    case "tax": startTax(); break;
    case "tax-stop": if (V.tax && confirm("End the fight now? You can't fight him again today.")) { V.tax.left = 0; } break;
    case "raid": joinRaid(); break;
    case "lobby": openLobby(); break;
    case "lobby-leave": closeLobby(true); S.view = "main"; S.tab = "raid"; render(); break;
    case "lobby-ready": if (V.lobby?.data) { const mine = V.lobby.data.lobby.find((x) => x.id === me().id); lobbyCall(mine?.ready ? "unready" : "ready"); FX.play("tap"); } break;
    case "lobby-boss": if (V.lobby?.data && Number(t.dataset.tier) !== V.lobby.data.raid.tier) lobbyCall("boss", { tier: Number(t.dataset.tier) }); break;
    case "raid-result": if (S.D.raid?.result) { V.result = { kind: "raid", out: S.D.raid.result, R: null, lvlBefore: level() }; S.view = "result"; render(); } break;
    case "raid-quit": if (!V.raid?.R || confirm("Leave the raid? Your squad keeps fighting, and you can rejoin while it's on.")) { leaveRaid(); S.view = "main"; await refresh(true); render(); } break;
    case "ability": raidAct("ab"); break;
    case "hunt": startHunt(); break;
    case "chat-close": closeChat(); break;
    case "check-updates": checkUpdatesNow(t); break;
    case "gear-wear": { const it = G.itemById(d.id); if (it && me().gear?.[it.slot] !== it.id) await shopAction("equip", { slot: it.slot, item: it.id }, () => { closeSheet(); FX.play("buy"); }); else closeSheet(); break; }
    case "gear-off": await shopAction("equip", { slot: d.slot, item: null }, closeSheet); break;
    case "gear-pick": gearPicker(d.slot); break;
    case "chat-search": { const sr = $("#csearch"); sr.hidden = !sr.hidden; if (!sr.hidden) $("#cq").focus(); else closeChatSearch(); break; }
    case "chat-latest": if (!CH.live) chatLoad(); else { const l = $("#clist"); l.scrollTop = l.scrollHeight; $("#cjump").hidden = true; } break;
    case "den-room": denSheet(d.room); break;
    case "den-give": denGive(d.room, Number(d.amount)); break;
    case "wear-buy": { const w = G.wardrobeById(d.id); if (w) wardrobe({ buy: w.id }, `Bought the ${w.name}`); break; }
    case "wear": wardrobe({ [d.kind]: d.id || null }, d.id ? "Looking sharp" : null); if (d.kind === "skin") closeSheet(); break;
    case "gamba-buy": gambaBuy(); break;
    case "gamba-odds": gambaOdds(); break;
    case "junk": junkSheet(); break;
    case "steps-week": stepsSheet(); break;
    case "lb-by": S.lbBy = t.dataset.by; render(); break;
    case "house-pay": housePay(d.id); break;
    case "house-pay-go": housePay(d.id, true); break;
    case "chapter": playChapter(Number(d.k)); break;
    case "claim": claim(d.what, Number(d.k), d.ref); break;
    case "claim-track": claimTrack(); break;
    case "special": raidAct("sp"); break;
    case "collect": collect(); break;
    case "back": FX.destroy(); V.result = null; S.view = "main"; render(); scrollTo(0, 0); break;
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
// A phone that's locked or switched away stops running the fight, so it hands over hosting until it's back.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && updateSafe()) { location.reload(); return; }
  const v = V.raid;
  if (v?.ch) {
    if (document.hidden) { v.ch.untrack(); v.host = false; }
    else { v.joinedAt = now(); v.ch.track({ at: v.joinedAt }); }
  }
  if (!document.hidden && S.view === "main") { if (updateSafe()) { location.reload(); return; } refresh(true); checkForUpdate(true); checkAppUpdate(); if (needsAccount() || !S.auth) checkAuth(); }
});

// ---------- updates ----------
// Every deploy changes app.js's ETag. Home-screen apps can sit open for days, so check when the app comes
// back to the front and every few minutes, and reload into the new version when nothing's in progress.
let releaseTag = null, updateReady = false;
// A new version is on the site: load it the next time the game goes into the background (switching apps,
// locking the phone), or straight away when it's just been reopened. Never during a fight or with a sheet open.
const updateSafe = () => updateReady && ["main", "welcome"].includes(S.view) && !V.tax && !V.raid && $("#sheet").hidden;
async function checkForUpdate(reopened = false) {
  if (location.protocol !== "https:") return;
  try {
    const res = await fetch("app.js", { method: "HEAD", cache: "no-store" });
    const tag = res.headers.get("etag") || res.headers.get("last-modified");
    if (!tag) return;
    if (!releaseTag) { releaseTag = tag; return; }
    if (tag !== releaseTag) updateReady = true;
    if (reopened && updateSafe()) location.reload();
  } catch { /* offline: try again later */ }
}
setInterval(() => { if (!document.hidden) checkForUpdate(); }, 5 * 60000);
// The Check for updates button: a newer version of the game loads straight away; on Android, a newer app is offered too.
async function checkUpdatesNow(btn) {
  if (btn.disabled) return;
  btn.disabled = true; btn.innerHTML = `${ic("refresh")} Checking…`;
  let web = false;
  try {
    const res = await fetch("app.js", { method: "HEAD", cache: "no-store" });
    const tag = res.headers.get("etag") || res.headers.get("last-modified");
    web = updateReady || !!(tag && releaseTag && tag !== releaseTag);
  } catch { /* offline */ }
  if (web) {
    toast("Updating…");
    try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch { /* reload anyway */ }
    location.reload();
    return;
  }
  if (NATIVE) { store.set("appLatest", null); store.set("appUpdateLater", 0); await checkAppUpdate(); }
  btn.disabled = false; btn.innerHTML = `${ic("refresh")} Check for updates`;
  if (S.appUpdate) { S.tab = "today"; render(); scrollTo(0, 0); toast("There's a new version of the app. Tap Update to install it"); }
  else toast(navigator.onLine === false ? "You're offline. Try again with signal" : "You're up to date");
}

// ---------- boot ----------
(async function boot() {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
  checkForUpdate();
  render();
  const params = new URLSearchParams(location.search);
  const restore = params.get("me"), inviteCode = params.get("g");
  // Back from an email link rather than a code: #access_token=… proves the email, same as a code does.
  const hash = new URLSearchParams(location.hash.slice(1)), emailAccess = hash.get("access_token"), ticket = params.get("eticket");
  if (location.hash || ticket) { params.delete("eticket"); history.replaceState(null, "", location.pathname + (String(params) ? `?${params}` : "")); }
  if (hash.get("error_description")) toast(`That email link didn't work (${hash.get("error_description")}). Use the code in the email instead`);
  const emailPage = (title, sub, extra = "") => { $("#app").innerHTML = `<div class="boot"><div class="logo ol">EFFORT</div><h2 class="ol-sm disp" style="margin:0">${title}</h2><p class="muted" style="margin:0;max-width:300px">${sub}</p>${extra}</div>`; };
  if (emailAccess && ticket) {
    // Adding an email: the ticket says whose account, so this works in any browser.
    try {
      const r = await callAuth("link_email", { ticket, access_token: emailAccess });
      if (!S.token) return emailPage("Email added", `${esc(r.email)} is on your account. Go back to Effort; you can close this tab.`);
      toast(`Email added: ${r.email}`);
    } catch (e) { if (!S.token) return emailPage("That link didn't work", esc(e.message)); toast(e.message); }
  } else if (emailAccess && !S.token) {
    // Signing in. On Android in Chrome, hand the account to the Effort app if they have it.
    try {
      const r = await callAuth("email_signin", { access_token: emailAccess });
      if (/Android/i.test(navigator.userAgent) && !NATIVE) return emailPage(`Found you, ${esc(r.name)}`, "Play in the Effort app? Tap below to sign in there.",
        `<a class="btn gold block" href="${stepsAppLink(r.token)}">${ic("arrowRight")} Open the Effort app</a><a class="btn xs" href="${APP_URL}?me=${r.token}">Play here in Chrome instead</a>`);
      return await signedIn(r.token);
    } catch (e) { toast(e.message); }
  }
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
    refreshPush(); keepPushAlive(); checkAppUpdate();
    if (emailAccess && !ticket) {
      try { const r = await callAuth("link_email", { token: S.token, access_token: emailAccess }); toast(`Email added: ${r.email}`); }
      catch (e) { toast(e.message); }
    }
    checkAuth();
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
