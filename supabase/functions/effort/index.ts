// Effort API. One function, routed by the last path segment:
//   GET  /board?code=ABC123 | /board?league=public   scoreboard data (group or public league)
//   POST /signup                       make a player (solo / public play), returns your token
//   POST /create                       make a private group, returns code + admin key
//   POST /join                         join a group (existing player token, or new profile)
//   POST /leave                        leave a group
//   GET  /log?t=TOKEN&steps=8421       log today's steps (iPhone Shortcut / manual)
//   POST /hc?t=TOKEN                   HC Webhook (Android Health Connect) payload
//   GET  /scroll?t=TOKEN&ev=open|close   short-video app opened/closed (Shortcut / MacroDroid automation)
//   GET  /scroll?t=TOKEN&minutes=42      the day's scroll minutes in one go (Tasker)
//   POST /scroll_minutes               self-reported scroll minutes from Screen Time / Digital Wellbeing
//   POST /add_forfeit                  any member adds a forfeit to the group's wheel
//   POST /spin                         spin the forfeit wheel for a finished week (server picks the slice)
//   POST /me | /update_me              read / edit your own profile
//   POST /admin | /admin_members | /admin_remove   group admin
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomString(len: number, chars = CODE_CHARS + "abcdefghijkmnpqrstuvwxyz") {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function localDate(d: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Shortcuts can hand over "8,421", "8421.0" or "8 421" depending on locale.
function parseNum(raw: unknown, max: number): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  const n = Math.round(parseFloat(cleaned));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
const parseSteps = (raw: unknown) => parseNum(raw, 200000);

function dayIsSane(day: string, tz: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const today = localDate(new Date(), tz);
  const diffDays = (Date.parse(today) - Date.parse(day)) / 86400000;
  return diffDays >= -1 && diffDays <= 60;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const prettyDay = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const PLATFORMS = ["ios", "android", "other"];
const goodColor = (c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
const clampGoal = (g: unknown) => Math.min(50000, Math.max(1000, parseSteps(g) ?? 8000));

// Normalise whatever the automation sends ("TikTok", "com.zhiliaoapp.musically", "Instagram") to a short key.
function appKey(raw: unknown) {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("tiktok") || s.includes("musically") || s.includes("ugc.trill")) return "tiktok";
  if (s.includes("insta")) return "instagram";
  if (s.includes("youtube") || s.includes("yt")) return "youtube";
  if (s.includes("snap")) return "snapchat";
  if (s.includes("facebook") || s.includes("katana")) return "facebook";
  if (s.includes("twitter") || s === "x") return "x";
  return s.replace(/[^a-z0-9]/g, "").slice(0, 16) || "other";
}

async function playerByToken(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const { data } = await db.from("players").select("*").eq("token", token).maybeSingle();
  return data;
}

async function groupByCode(code: unknown) {
  if (typeof code !== "string" || !code) return null;
  const { data } = await db.from("groups").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  return data;
}

async function adminGroup(body: Record<string, unknown>) {
  const g = await groupByCode(body.code);
  return g && g.admin_key === body.admin_key ? g : null;
}

function publicGroup(g: Record<string, unknown>) {
  const { admin_key: _a, id: _i, ...rest } = g;
  return rest;
}

const PUBLIC_PLAYER_COLS = "id,name,emoji,color,platform,daily_goal,steps_synced_at,steps_source,scroll_synced_at,scroll_source,created_at";

function newPlayerRow(body: Record<string, any>) {
  const name = clip(body.name, 24);
  if (!name) return null;
  return {
    token: randomString(24),
    name,
    emoji: clip(body.emoji, 8) || "🚶",
    color: goodColor(body.color) ? body.color : "#6d5efc",
    platform: PLATFORMS.includes(body.platform) ? body.platform : "other",
    tz: clip(body.tz, 60) || "Europe/London",
    is_public: body.is_public !== false,
  };
}

async function playerGroups(playerId: string) {
  const { data } = await db.from("memberships").select("team, groups(code,name)").eq("player_id", playerId).order("joined_at");
  return (data ?? []).map((m: any) => ({ code: m.groups.code, name: m.groups.name, team: m.team }));
}

async function dataFor(ids: string[], sinceDays: number) {
  if (!ids.length) return { steps: [], scroll: [] };
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);
  const [st, sc] = await Promise.all([
    db.from("daily_steps").select("player_id,day,steps,source").in("player_id", ids).gte("day", since).limit(50000),
    db.from("daily_scroll").select("player_id,day,opens,minutes,auto_minutes,apps").in("player_id", ids).gte("day", since).limit(50000),
  ]);
  return {
    steps: (st.data ?? []).map((r) => ({ p: r.player_id, d: r.day, s: r.steps, src: r.source })),
    scroll: (sc.data ?? []).map((r) => ({ p: r.player_id, d: r.day, o: r.opens, m: r.minutes, am: r.auto_minutes, a: r.apps })),
  };
}

async function saveDay(playerId: string, day: string, steps: number, source: string) {
  const { error } = await db.from("daily_steps").upsert(
    { player_id: playerId, day, steps, source, updated_at: new Date().toISOString() },
    { onConflict: "player_id,day" },
  );
  if (error) throw error;
}

async function touchSteps(id: string, source: string, extra: Record<string, unknown> = {}) {
  await db.from("players").update({ steps_synced_at: new Date().toISOString(), steps_source: source, ...extra }).eq("id", id);
}

// Health Connect payloads arrive as either one full-day total per day ("Daily" resolution,
// already de-duplicated across phone + watch) or as smaller chunks we sum ourselves.
async function handleHealthConnect(player: Record<string, any>, body: Record<string, any>) {
  const tz = body.timezone && body.timezone !== "UTC" ? String(body.timezone) : player.tz;
  const records: any[] = Array.isArray(body.steps) ? body.steps : [];
  const dailyDays = new Set<string>();
  const chunkDays = new Set<string>();

  for (const r of records) {
    const start = new Date(r.start_time), end = new Date(r.end_time);
    const count = parseSteps(r.count);
    if (isNaN(+start) || isNaN(+end) || count === null) continue;
    if (+end - +start >= 20 * 3600_000) {
      const day = localDate(new Date((+start + +end) / 2), tz);
      if (!dayIsSane(day, tz)) continue;
      await saveDay(player.id, day, count, "health-connect");
      dailyDays.add(day);
    } else {
      const day = localDate(start, tz);
      if (!dayIsSane(day, tz)) continue;
      await db.from("step_chunks").upsert(
        { player_id: player.id, start_time: start.toISOString(), end_time: end.toISOString(), day, count },
        { onConflict: "player_id,start_time,end_time" },
      );
      chunkDays.add(day);
    }
  }

  for (const day of chunkDays) {
    if (dailyDays.has(day)) continue;
    const { data: existing } = await db.from("daily_steps").select("source").eq("player_id", player.id).eq("day", day).maybeSingle();
    if (existing?.source === "health-connect") continue; // a de-duplicated daily total beats our own sum
    const { data: chunks } = await db.from("step_chunks").select("count").eq("player_id", player.id).eq("day", day);
    const total = Math.min(200000, (chunks ?? []).reduce((s, c) => s + c.count, 0));
    await saveDay(player.id, day, total, "health-connect-raw");
  }

  await touchSteps(player.id, "android", tz !== player.tz ? { tz } : {});
  return json({ ok: true, days: [...dailyDays, ...chunkDays].sort() });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();
  const q = url.searchParams;
  let body: Record<string, any> = {};
  if (req.method === "POST") {
    const raw = await req.text();
    if (raw) {
      try { body = JSON.parse(raw); } catch { /* automations sometimes post plain text; fall back to query params */ }
    }
  }

  try {
    switch (action) {
      case "board": {
        if (q.get("league") === "public") {
          // Everyone who opted in and has been active in the last 5 weeks.
          const since = new Date(Date.now() - 35 * 86400000).toISOString();
          const { data: players } = await db.from("players").select(PUBLIC_PLAYER_COLS).eq("is_public", true)
            .or(`steps_synced_at.gte.${since},scroll_synced_at.gte.${since},created_at.gte.${since}`).limit(500);
          const data = await dataFor((players ?? []).map((p) => p.id), 70);
          return json({ ok: true, league: true, players: (players ?? []).map((p) => ({ ...p, joined_at: p.created_at })), ...data });
        }
        const g = await groupByCode(q.get("code"));
        if (!g) return fail("No group with that code", 404);
        const { data: mem } = await db.from("memberships").select(`team, joined_at, players(${PUBLIC_PLAYER_COLS})`).eq("group_id", g.id).order("joined_at");
        const players = (mem ?? []).map((m: any) => ({ ...m.players, team: m.team, joined_at: m.joined_at }));
        const [data, spins] = await Promise.all([
          dataFor(players.map((p) => p.id), 800),
          db.from("forfeit_spins").select("week_start,loser_id,forfeit,slice,slices,spun_at").eq("group_id", g.id).order("week_start", { ascending: false }).limit(12),
        ]);
        return json({ ok: true, group: publicGroup(g), players, ...data, spins: spins.data ?? [] });
      }

      case "signup": {
        const row = newPlayerRow(body);
        if (!row) return fail("Pick a name");
        const { data, error } = await db.from("players").insert(row).select().single();
        if (error) throw error;
        return json({ ok: true, player: data, groups: [] });
      }

      case "create": {
        const name = clip(body.name, 40);
        if (!name) return fail("Give the group a name");
        const row = {
          name,
          code: randomString(6, CODE_CHARS),
          admin_key: randomString(10),
          daily_goal: clampGoal(body.daily_goal),
          forfeit: clip(body.forfeit, 120) ?? "",
        };
        const { data, error } = await db.from("groups").insert(row).select().single();
        if (error) throw error;
        return json({ ok: true, code: data.code, admin_key: data.admin_key });
      }

      case "join": {
        const g = await groupByCode(body.code);
        if (!g) return fail("No group with that code", 404);
        const { count } = await db.from("memberships").select("player_id", { count: "exact", head: true }).eq("group_id", g.id);
        if ((count ?? 0) >= 200) return fail("This group is full");
        let player = await playerByToken(body.token);
        if (!player) {
          const row = newPlayerRow(body);
          if (!row) return fail("Pick a name");
          const { data, error } = await db.from("players").insert(row).select().single();
          if (error) throw error;
          player = data;
        }
        const { error } = await db.from("memberships").upsert(
          { player_id: player.id, group_id: g.id, team: g.teams.includes(body.team) ? body.team : null },
          { onConflict: "player_id,group_id", ignoreDuplicates: true },
        );
        if (error) throw error;
        return json({ ok: true, player, code: g.code, groups: await playerGroups(player.id) });
      }

      case "leave": {
        const player = await playerByToken(body.token);
        const g = await groupByCode(body.code);
        if (!player || !g) return fail("Not found", 404);
        await db.from("memberships").delete().eq("player_id", player.id).eq("group_id", g.id);
        return json({ ok: true, groups: await playerGroups(player.id) });
      }

      case "log": {
        const player = await playerByToken(q.get("t") ?? body.t ?? body.token);
        if (!player) return fail("Unknown sync link", 401);
        const steps = parseSteps(q.get("steps") ?? body.steps);
        if (steps === null) return fail("steps must be a number between 0 and 200000");
        const requested = clip(q.get("date") ?? body.date, 10);
        const day = requested && dayIsSane(requested, player.tz) ? requested : localDate(new Date(), player.tz);
        const source = clip(q.get("src") ?? body.source, 20) || "shortcut";
        await saveDay(player.id, day, steps, source);
        await touchSteps(player.id, source);
        const msg = `✅ ${steps.toLocaleString("en-GB")} steps logged for ${prettyDay(day)}`;
        return req.method === "GET" ? text(msg) : json({ ok: true, day, steps, message: msg });
      }

      case "hc": {
        const player = await playerByToken(q.get("t"));
        if (!player) return fail("Unknown sync link", 401);
        return await handleHealthConnect(player, body);
      }

      case "scroll": {
        const player = await playerByToken(q.get("t") ?? body.t ?? body.token);
        if (!player) return fail("Unknown scroll link", 401);
        const day = localDate(new Date(), player.tz);
        // Tasker (Android) can send the day's real foreground minutes in one go.
        const minutes = parseNum(q.get("minutes") ?? body.minutes, 1440);
        if (minutes !== null) {
          const { error } = await db.from("daily_scroll").upsert(
            { player_id: player.id, day, minutes, updated_at: new Date().toISOString() },
            { onConflict: "player_id,day" },
          );
          if (error) throw error;
          await db.from("players").update({ scroll_synced_at: new Date().toISOString(), scroll_source: "auto" }).eq("id", player.id);
          return req.method === "GET" ? text(`📵 ${minutes} min logged`) : json({ ok: true, day, minutes });
        }
        const ev = (q.get("ev") ?? body.ev) === "close" ? "close" : "open";
        const app = appKey(q.get("app") ?? body.app ?? "shortvideo");
        const { data, error } = await db.rpc("scroll_event", { p_player: player.id, p_day: day, p_app: app, p_ev: ev });
        if (error) throw error;
        await db.from("players").update({ scroll_synced_at: new Date().toISOString(), scroll_source: "auto" }).eq("id", player.id);
        return req.method === "GET" ? text(`📵 ${data.minutes} min today`) : json({ ok: true, day, ...data });
      }

      case "scroll_minutes": {
        const player = await playerByToken(body.token);
        if (!player) return fail("Unknown token", 401);
        const minutes = parseNum(body.minutes, 1440);
        if (minutes === null) return fail("Minutes must be between 0 and 1440");
        const requested = clip(body.date, 10);
        const day = requested && dayIsSane(requested, player.tz) ? requested : localDate(new Date(), player.tz);
        const { error } = await db.from("daily_scroll").upsert(
          { player_id: player.id, day, minutes, updated_at: new Date().toISOString() },
          { onConflict: "player_id,day" },
        );
        if (error) throw error;
        await db.from("players").update({ scroll_synced_at: new Date().toISOString(), scroll_source: player.scroll_source === "auto" ? "auto" : "manual" }).eq("id", player.id);
        return json({ ok: true, day, minutes, message: `📵 ${minutes} min of scrolling saved for ${prettyDay(day)}` });
      }

      case "add_forfeit": {
        const player = await playerByToken(body.token);
        const g = await groupByCode(body.code);
        if (!player || !g) return fail("Not found", 404);
        const { count } = await db.from("memberships").select("player_id", { count: "exact", head: true }).eq("group_id", g.id).eq("player_id", player.id);
        if (!count) return fail("You're not in this group", 403);
        const item = clip(body.text, 60);
        if (!item) return fail("Write a forfeit first");
        if (g.forfeits.length >= 12) return fail("The wheel is full (12 forfeits). Ask the admin to clear some.");
        if (g.forfeits.some((f: string) => f.toLowerCase() === item.toLowerCase())) return fail("That one's already on the wheel");
        const { data, error } = await db.from("groups").update({ forfeits: [...g.forfeits, item] }).eq("id", g.id).select().single();
        if (error) throw error;
        return json({ ok: true, group: publicGroup(data) });
      }

      // Spin the forfeit wheel for a finished week (or the current week from Sunday 18:00 in the spinner's time zone).
      // The server picks the slice so nobody can re-roll; the first spin for a week is final.
      case "spin": {
        const player = await playerByToken(body.token);
        const g = await groupByCode(body.code);
        if (!player || !g) return fail("Not found", 404);
        const { count } = await db.from("memberships").select("player_id", { count: "exact", head: true }).eq("group_id", g.id).eq("player_id", player.id);
        if (!count) return fail("You're not in this group", 403);
        const ws = clip(body.week_start, 10) ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ws) || new Date(ws + "T12:00:00Z").getUTCDay() !== 1) return fail("Bad week");
        const now = new Date();
        const today = localDate(now, player.tz);
        const thisMonday = (() => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
        const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: player.tz, hour: "2-digit", hour12: false }).format(now));
        const sundayEvening = new Date(today + "T12:00:00Z").getUTCDay() === 0 && hour >= 18;
        if (ws > thisMonday || (ws === thisMonday && !sundayEvening)) return fail("The wheel unlocks on Sunday at 6pm");
        const { data: existing } = await db.from("forfeit_spins").select("*").eq("group_id", g.id).eq("week_start", ws).maybeSingle();
        if (existing) return json({ ok: true, spin: existing, already: true });
        const slices = g.forfeits.length ? g.forfeits : [g.forfeit || "Buys the first round"];
        const slice = crypto.getRandomValues(new Uint32Array(1))[0] % slices.length;
        let loserId: string | null = null;
        if (typeof body.loser_id === "string" && /^[0-9a-f-]{36}$/i.test(body.loser_id)) {
          const { count: inGroup } = await db.from("memberships").select("player_id", { count: "exact", head: true }).eq("group_id", g.id).eq("player_id", body.loser_id);
          if (inGroup) loserId = body.loser_id;
        }
        const row = { group_id: g.id, week_start: ws, loser_id: loserId, forfeit: slices[slice], slice, slices, spun_by: player.id };
        const { data, error } = await db.from("forfeit_spins").insert(row).select("week_start,loser_id,forfeit,slice,slices,spun_at").single();
        if (error) {
          // Two people spun at once: return whichever landed first.
          const { data: first } = await db.from("forfeit_spins").select("week_start,loser_id,forfeit,slice,slices,spun_at").eq("group_id", g.id).eq("week_start", ws).maybeSingle();
          if (first) return json({ ok: true, spin: first, already: true });
          throw error;
        }
        return json({ ok: true, spin: data });
      }

      case "me": {
        const player = await playerByToken(body.token);
        if (!player) return fail("Unknown token", 401);
        return json({ ok: true, player, groups: await playerGroups(player.id), ...(await dataFor([player.id], 800)) });
      }

      case "update_me": {
        const player = await playerByToken(body.token);
        if (!player) return fail("Unknown token", 401);
        const patch: Record<string, unknown> = {};
        if (clip(body.name, 24)) patch.name = clip(body.name, 24);
        if (clip(body.emoji, 8)) patch.emoji = clip(body.emoji, 8);
        if (goodColor(body.color)) patch.color = body.color;
        if ("daily_goal" in body) patch.daily_goal = body.daily_goal ? clampGoal(body.daily_goal) : null;
        if (PLATFORMS.includes(body.platform)) patch.platform = body.platform;
        if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
        if (clip(body.tz, 60)) patch.tz = clip(body.tz, 60);
        if (body.code && "team" in body) {
          const g = await groupByCode(body.code);
          if (g) await db.from("memberships").update({ team: g.teams.includes(body.team) ? body.team : null }).eq("player_id", player.id).eq("group_id", g.id);
        }
        const { data, error } = await db.from("players").update(patch).eq("id", player.id).select().single();
        if (error) throw error;
        return json({ ok: true, player: data, groups: await playerGroups(player.id) });
      }

      case "admin": {
        const g = await adminGroup(body);
        if (!g) return fail("Wrong admin key", 403);
        const s = body.settings ?? {};
        const patch: Record<string, unknown> = {};
        if (clip(s.name, 40)) patch.name = clip(s.name, 40);
        if (s.daily_goal) patch.daily_goal = clampGoal(s.daily_goal);
        if (typeof s.forfeit === "string") patch.forfeit = clip(s.forfeit, 120);
        if (clip(s.challenge_name, 60)) patch.challenge_name = clip(s.challenge_name, 60);
        if (s.challenge_km) patch.challenge_km = Math.min(100000, Math.max(1, Number(s.challenge_km) || 460));
        if (Array.isArray(s.teams)) patch.teams = s.teams.map((t: unknown) => clip(t, 24)).filter(Boolean).slice(0, 8);
        if (Array.isArray(s.forfeits)) patch.forfeits = [...new Set(s.forfeits.map((t: unknown) => clip(t, 60)).filter(Boolean))].slice(0, 12);
        for (const k of ["shortcut_url", "scroll_shortcut_url"]) {
          if (typeof s[k] === "string") patch[k] = /^https:\/\/www\.icloud\.com\/shortcuts\//.test(s[k]) ? s[k] : null;
        }
        const { data, error } = await db.from("groups").update(patch).eq("id", g.id).select().single();
        if (error) throw error;
        return json({ ok: true, group: publicGroup(data) });
      }

      case "admin_members": {
        const g = await adminGroup(body);
        if (!g) return fail("Wrong admin key", 403);
        const { data } = await db.from("memberships").select("joined_at, players(id,name,emoji,token,steps_synced_at)").eq("group_id", g.id).order("joined_at");
        return json({ ok: true, members: (data ?? []).map((m: any) => m.players) });
      }

      case "admin_remove": {
        const g = await adminGroup(body);
        if (!g) return fail("Wrong admin key", 403);
        await db.from("memberships").delete().eq("player_id", body.player_id).eq("group_id", g.id);
        return json({ ok: true });
      }

      default:
        return fail("Unknown endpoint", 404);
    }
  } catch (e) {
    console.error(e);
    return fail("Server error: " + (e instanceof Error ? e.message : String(e)), 500);
  }
});
