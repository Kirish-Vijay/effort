// Effort API. One function, routed by the last path segment:
//   GET  /board?code=ABC123            a squad's name and players (for invite links)
//   POST /signup                       make a player, returns your token
//   POST /join                         join a squad (existing player token, or a new profile); you're only ever in one
//   POST /squad_create                 make a squad and join it
//   POST /leave                        leave your squad
//   GET  /log?t=TOKEN&steps=8421       log today's steps (iPhone Shortcut / typed in)
//   POST /hc?t=TOKEN                   HC Webhook (Android Health Connect) payload
//   GET  /scroll?t=TOKEN&ev=open|close   short-video app opened/closed (Shortcut / MacroDroid automation)
//   GET  /scroll?t=TOKEN&minutes=42      the day's scroll minutes in one go (Tasker)
//   POST /scroll_minutes               typed-in scroll minutes from Screen Time / Digital Wellbeing
//   POST /me | /update_me              read / edit your own profile
//   POST /owner                        app owner: read and edit any player's data (owner key in app_config)
//   POST /game, /tax_start, /tax_finish, /raid_join, /raid_sync, /raid_finish, /buy, /upgrade, /equip: the game, see game_api.ts
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { gameRoute } from "./game_api.ts";

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

function publicGroup(g: Record<string, unknown>) {
  const { admin_key: _a, id: _i, ...rest } = g;
  return rest;
}

const PUBLIC_PLAYER_COLS = "id,name,emoji,color,platform,daily_goal,steps_synced_at,steps_source,scroll_synced_at,scroll_source,created_at,character,equipped";

// Quiz answers that draw the player's walker. Only known keys, short values.
const CHARACTER_KEYS = ["time", "pace", "land", "carry", "creature", "morning", "laugh", "hat", "hue", "month", "number", "word"];
function cleanCharacter(c: unknown) {
  if (!c || typeof c !== "object") return null;
  const out: Record<string, string | number> = {};
  for (const k of CHARACTER_KEYS) {
    const v = (c as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v);
    else if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 30);
  }
  return Object.keys(out).length ? out : null;
}

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
    character: cleanCharacter(body.character),
  };
}

async function playerGroups(playerId: string) {
  const { data } = await db.from("memberships").select("team, groups(code,name)").eq("player_id", playerId).order("joined_at");
  return (data ?? []).map((m: any) => ({ code: m.groups.code, name: m.groups.name, team: m.team }));
}

async function dataFor(ids: string[], sinceDays: number) {
  if (!ids.length) return { steps: [], scroll: [], hunts: [] };
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);
  const [st, sc, hu] = await Promise.all([
    db.from("daily_steps").select("player_id,day,steps,source").in("player_id", ids).gte("day", since).limit(50000),
    db.from("daily_scroll").select("player_id,day,opens,minutes,auto_minutes,apps").in("player_id", ids).gte("day", since).limit(50000),
    db.from("hunts").select("player_id,day,score,kills,wave,seconds,survived,boss_dmg").in("player_id", ids).gte("day", since).limit(50000),
  ]);
  return {
    steps: (st.data ?? []).map((r) => ({ p: r.player_id, d: r.day, s: r.steps, src: r.source })),
    scroll: (sc.data ?? []).map((r) => ({ p: r.player_id, d: r.day, o: r.opens, m: r.minutes, am: r.auto_minutes, a: r.apps })),
    hunts: (hu.data ?? []).map((r) => ({ p: r.player_id, d: r.day, score: r.score, kills: r.kills, wave: r.wave, s: r.seconds, surv: r.survived, dmg: r.boss_dmg })),
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

// ---------- App owner ----------
// One key for the whole app, kept in app_config (RLS on, no policies, so only this function can read it).
async function isOwner(key: unknown) {
  if (typeof key !== "string" || key.length < 16) return false;
  const { data } = await db.from("app_config").select("value").eq("key", "owner_key").maybeSingle();
  return !!data && data.value === key;
}

const ownerDay = (d: unknown) =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) && d >= "2020-01-01" &&
  Date.parse(d) <= Date.now() + 2 * 86400000 ? d : null;

async function ownerAction(op: string, body: Record<string, any>) {
  switch (op) {
    case "list": {
      const [pl, gr, mem] = await Promise.all([
        db.from("players").select("id,name,emoji,color,platform,tz,is_public,created_at,steps_synced_at,steps_source,scroll_synced_at,scroll_source,character").order("created_at", { ascending: false }).limit(5000),
        db.from("groups").select("id,code,name,created_at,tier,test_until").order("created_at"),
        db.from("memberships").select("player_id,group_id"),
      ]);
      return json({ ok: true, players: pl.data ?? [], groups: gr.data ?? [], memberships: mem.data ?? [] });
    }
    case "player": {
      const { data: player } = await db.from("players").select("*").eq("id", body.id).maybeSingle();
      if (!player) return fail("No such player", 404);
      const days = Math.min(730, Math.max(7, Number(body.days) || 120));
      const [groups, data] = await Promise.all([playerGroups(player.id), dataFor([player.id], days)]);
      return json({ ok: true, player, groups, ...data });
    }
    case "save_player": {
      const patch: Record<string, unknown> = {};
      if (clip(body.name, 24)) patch.name = clip(body.name, 24);
      if (clip(body.emoji, 8)) patch.emoji = clip(body.emoji, 8);
      if ("daily_goal" in body) patch.daily_goal = body.daily_goal ? clampGoal(body.daily_goal) : null;
      if (PLATFORMS.includes(body.platform)) patch.platform = body.platform;
      if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
      if (clip(body.tz, 60)) patch.tz = clip(body.tz, 60);
      const { data, error } = await db.from("players").update(patch).eq("id", body.id).select().single();
      if (error) throw error;
      return json({ ok: true, player: data });
    }
    case "set_steps": {
      const day = ownerDay(body.day);
      if (!day) return fail("Bad date");
      if (body.steps === null || body.steps === "") {
        await db.from("daily_steps").delete().eq("player_id", body.id).eq("day", day);
        return json({ ok: true, day, steps: null });
      }
      const steps = parseSteps(body.steps);
      if (steps === null) return fail("Steps must be between 0 and 200,000");
      await saveDay(body.id, day, steps, "admin");
      return json({ ok: true, day, steps });
    }
    case "set_scroll": {
      const day = ownerDay(body.day);
      if (!day) return fail("Bad date");
      // minutes is the override; null hands the day back to whatever the automation counted.
      let minutes: number | null = null;
      if (body.minutes !== null && body.minutes !== "") {
        minutes = parseNum(body.minutes, 1440);
        if (minutes === null) return fail("Minutes must be between 0 and 1440");
      }
      const { data: row } = await db.from("daily_scroll").select("opens,auto_minutes").eq("player_id", body.id).eq("day", day).maybeSingle();
      if (minutes === null && (!row || (!row.opens && row.auto_minutes == null))) {
        await db.from("daily_scroll").delete().eq("player_id", body.id).eq("day", day);
      } else {
        const { error } = await db.from("daily_scroll").upsert(
          { player_id: body.id, day, minutes, updated_at: new Date().toISOString() },
          { onConflict: "player_id,day" },
        );
        if (error) throw error;
      }
      return json({ ok: true, day, minutes });
    }
    case "set_hunt": {
      const day = ownerDay(body.day);
      if (!day) return fail("Bad date");
      if (body.delete) {
        await db.from("hunts").delete().eq("player_id", body.id).eq("day", day);
        return json({ ok: true, day, hunt: null });
      }
      const n = (v: unknown, max: number) => parseNum(v, max) ?? 0;
      const score = n(body.score, 10_000_000);
      const row = {
        player_id: body.id, day, score,
        kills: n(body.kills, 1_000_000), wave: n(body.wave, 10_000), seconds: n(body.seconds, 3600),
        survived: !!body.survived,
        boss_dmg: body.boss_dmg === undefined || body.boss_dmg === "" ? Math.round(score / 20) : n(body.boss_dmg, 1_000_000),
      };
      const { error } = await db.from("hunts").upsert(row, { onConflict: "player_id,day" });
      if (error) throw error;
      return json({ ok: true, day, hunt: row });
    }
    case "test_window": {
      const minutes = Math.min(60, Math.max(0, Number(body.minutes) || 0));
      const until = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
      const { data, error } = await db.from("groups").update({ test_until: until }).eq("id", body.id).select("id,name,test_until").single();
      if (error) throw error;
      return json({ ok: true, group: data });
    }
    case "delete_player": {
      await db.from("players").delete().eq("id", body.id);
      return json({ ok: true });
    }
    default:
      return fail("Unknown owner action", 404);
  }
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
        const g = await groupByCode(q.get("code"));
        if (!g) return fail("No group with that code", 404);
        const { data: mem } = await db.from("memberships").select(`team, joined_at, players(${PUBLIC_PLAYER_COLS})`).eq("group_id", g.id).order("joined_at");
        const players = (mem ?? []).map((m: any) => ({ ...m.players, team: m.team, joined_at: m.joined_at }));
        return json({ ok: true, group: publicGroup(g), players });
      }

      case "signup": {
        const row = newPlayerRow(body);
        if (!row) return fail("Pick a name");
        const { data, error } = await db.from("players").insert(row).select().single();
        if (error) throw error;
        return json({ ok: true, player: data, groups: [] });
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
        // One squad each: joining a new squad leaves the old one.
        await db.from("memberships").delete().eq("player_id", player.id).neq("group_id", g.id);
        const { error } = await db.from("memberships").upsert(
          { player_id: player.id, group_id: g.id, team: g.teams.includes(body.team) ? body.team : null },
          { onConflict: "player_id,group_id", ignoreDuplicates: true },
        );
        if (error) throw error;
        return json({ ok: true, player, code: g.code, groups: await playerGroups(player.id) });
      }

      case "squad_create": {
        const player = await playerByToken(body.token);
        if (!player) return fail("Unknown token", 401);
        const name = clip(body.name, 40);
        if (!name) return fail("Give your squad a name");
        const { data: g, error } = await db.from("groups").insert({ name, code: randomString(6, CODE_CHARS), admin_key: randomString(10) }).select().single();
        if (error) throw error;
        await db.from("memberships").delete().eq("player_id", player.id);
        const { error: e2 } = await db.from("memberships").insert({ player_id: player.id, group_id: g.id });
        if (e2) throw e2;
        return json({ ok: true, code: g.code, admin_key: g.admin_key, groups: await playerGroups(player.id) });
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
        if ("character" in body) patch.character = cleanCharacter(body.character);
        if ("equipped" in body) patch.equipped = typeof body.equipped === "string" && /^[a-z-]{2,20}$/.test(body.equipped) ? body.equipped : null;
        if (body.code && "team" in body) {
          const g = await groupByCode(body.code);
          if (g) await db.from("memberships").update({ team: g.teams.includes(body.team) ? body.team : null }).eq("player_id", player.id).eq("group_id", g.id);
        }
        const { data, error } = await db.from("players").update(patch).eq("id", player.id).select().single();
        if (error) throw error;
        return json({ ok: true, player: data, groups: await playerGroups(player.id) });
      }

      case "owner": {
        if (!(await isOwner(body.key))) return fail("Wrong owner key", 403);
        if (body.op !== "list" && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id))) return fail("Bad player id");
        return await ownerAction(String(body.op ?? ""), body);
      }

      default: {
        const res = action ? await gameRoute(action, body, { db, json, fail, playerByToken }) : null;
        return res ?? fail("Unknown endpoint", 404);
      }
    }
  } catch (e) {
    console.error(e);
    return fail("Server error: " + (e instanceof Error ? e.message : String(e)), 500);
  }
});
