// Step Squad API. One function, routed by the last path segment:
//   GET  /steps/board?code=ABC123          leaderboard data for a group
//   POST /steps/create                     make a group, returns code + admin key
//   POST /steps/join                       join a group, returns your personal token
//   GET  /steps/log?t=TOKEN&steps=8421     log today's steps (iPhone Shortcut / manual)
//   POST /steps/hc?t=TOKEN                 HC Webhook (Android Health Connect) payload
//   POST /steps/me | update_me             read / edit your own profile
//   POST /steps/admin | admin_members | admin_remove   group admin
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
function parseSteps(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  const n = Math.round(parseFloat(cleaned));
  return Number.isFinite(n) && n >= 0 && n <= 200000 ? n : null;
}

function dayIsSane(day: string, tz: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const today = localDate(new Date(), tz);
  const diffDays = (Date.parse(today) - Date.parse(day)) / 86400000;
  return diffDays >= -1 && diffDays <= 60;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const prettyDay = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

async function memberByToken(token: string | null) {
  if (!token) return null;
  const { data } = await db.from("members").select("*").eq("token", token).maybeSingle();
  return data;
}

async function groupByCode(code: string | null) {
  if (!code) return null;
  const { data } = await db.from("groups").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  return data;
}

async function adminGroup(body: Record<string, unknown>) {
  const g = await groupByCode(String(body.code ?? ""));
  return g && g.admin_key === body.admin_key ? g : null;
}

function publicGroup(g: Record<string, unknown>) {
  const { admin_key: _a, id: _i, ...rest } = g;
  return rest;
}

const PUBLIC_MEMBER_COLS = "id,name,emoji,color,team,goal,platform,last_sync_at,last_source,created_at";

async function saveDay(memberId: string, day: string, steps: number, source: string) {
  const { error } = await db.from("daily_steps").upsert(
    { member_id: memberId, day, steps, source, updated_at: new Date().toISOString() },
    { onConflict: "member_id,day" },
  );
  if (error) throw error;
}

async function touchMember(id: string, source: string, extra: Record<string, unknown> = {}) {
  await db.from("members").update({ last_sync_at: new Date().toISOString(), last_source: source, ...extra }).eq("id", id);
}

// Health Connect payloads arrive as either one full-day total per day ("Daily" resolution,
// already de-duplicated across phone + watch) or as smaller chunks we sum ourselves.
async function handleHealthConnect(member: Record<string, any>, body: Record<string, any>) {
  const tz = body.timezone && body.timezone !== "UTC" ? String(body.timezone) : member.tz;
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
      await saveDay(member.id, day, count, "health-connect");
      dailyDays.add(day);
    } else {
      const day = localDate(start, tz);
      if (!dayIsSane(day, tz)) continue;
      await db.from("step_chunks").upsert(
        { member_id: member.id, start_time: start.toISOString(), end_time: end.toISOString(), day, count },
        { onConflict: "member_id,start_time,end_time" },
      );
      chunkDays.add(day);
    }
  }

  for (const day of chunkDays) {
    if (dailyDays.has(day)) continue;
    const { data: existing } = await db.from("daily_steps").select("source").eq("member_id", member.id).eq("day", day).maybeSingle();
    if (existing?.source === "health-connect") continue; // a de-duplicated daily total beats our own sum
    const { data: chunks } = await db.from("step_chunks").select("count").eq("member_id", member.id).eq("day", day);
    const total = Math.min(200000, (chunks ?? []).reduce((s, c) => s + c.count, 0));
    await saveDay(member.id, day, total, "health-connect-raw");
  }

  await touchMember(member.id, "android", tz !== member.tz ? { tz } : {});
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
      try { body = JSON.parse(raw); } catch { return fail("Body must be JSON"); }
    }
  }

  try {
    switch (action) {
      case "board": {
        const g = await groupByCode(q.get("code"));
        if (!g) return fail("No group with that code", 404);
        const { data: members } = await db.from("members").select(PUBLIC_MEMBER_COLS).eq("group_id", g.id).order("created_at");
        const ids = (members ?? []).map((m) => m.id);
        let days: { m: string; d: string; s: number; src: string }[] = [];
        if (ids.length) {
          const { data } = await db.from("daily_steps").select("member_id,day,steps,source").in("member_id", ids)
            .order("day", { ascending: false }).limit(20000);
          days = (data ?? []).map((r) => ({ m: r.member_id, d: r.day, s: r.steps, src: r.source }));
        }
        return json({ ok: true, group: publicGroup(g), members, days });
      }

      case "create": {
        const name = clip(body.name, 40);
        if (!name) return fail("Give the group a name");
        const row = {
          name,
          code: randomString(6, CODE_CHARS),
          admin_key: randomString(10),
          daily_goal: Math.min(50000, Math.max(1000, parseSteps(body.daily_goal) ?? 10000)),
          forfeit: clip(body.forfeit, 120) || "Buys the first round",
        };
        const { data, error } = await db.from("groups").insert(row).select().single();
        if (error) throw error;
        return json({ ok: true, code: data.code, admin_key: data.admin_key });
      }

      case "join": {
        const g = await groupByCode(String(body.code ?? ""));
        if (!g) return fail("No group with that code", 404);
        const name = clip(body.name, 24);
        if (!name) return fail("Pick a name");
        const { count } = await db.from("members").select("id", { count: "exact", head: true }).eq("group_id", g.id);
        if ((count ?? 0) >= 100) return fail("This group is full");
        const row = {
          group_id: g.id,
          name,
          emoji: clip(body.emoji, 8) || "🚶",
          color: /^#[0-9a-f]{6}$/i.test(body.color ?? "") ? body.color : "#6d5efc",
          team: g.teams.includes(body.team) ? body.team : null,
          platform: ["ios", "android", "other"].includes(body.platform) ? body.platform : "other",
          tz: clip(body.tz, 60) || "Europe/London",
          token: randomString(24),
        };
        const { data, error } = await db.from("members").insert(row).select().single();
        if (error) throw error;
        return json({ ok: true, member: data, code: g.code });
      }

      case "log": {
        const member = await memberByToken(q.get("t") ?? body.t ?? body.token);
        if (!member) return fail("Unknown sync link", 401);
        const steps = parseSteps(q.get("steps") ?? body.steps);
        if (steps === null) return fail("steps must be a number between 0 and 200000");
        const requested = clip(q.get("date") ?? body.date, 10);
        const day = requested && dayIsSane(requested, member.tz) ? requested : localDate(new Date(), member.tz);
        const source = clip(q.get("src") ?? body.source, 20) || "shortcut";
        await saveDay(member.id, day, steps, source);
        await touchMember(member.id, source);
        const msg = `✅ ${steps.toLocaleString("en-GB")} steps logged for ${prettyDay(day)}`;
        return req.method === "GET" ? text(msg) : json({ ok: true, day, steps, message: msg });
      }

      case "hc": {
        const member = await memberByToken(q.get("t"));
        if (!member) return fail("Unknown sync link", 401);
        return await handleHealthConnect(member, body);
      }

      case "me": {
        const member = await memberByToken(body.token);
        if (!member) return fail("Unknown token", 401);
        const { data: g } = await db.from("groups").select("code").eq("id", member.group_id).single();
        return json({ ok: true, member, code: g?.code });
      }

      case "update_me": {
        const member = await memberByToken(body.token);
        if (!member) return fail("Unknown token", 401);
        const { data: g } = await db.from("groups").select("teams").eq("id", member.group_id).single();
        const patch: Record<string, unknown> = {};
        if (clip(body.name, 24)) patch.name = clip(body.name, 24);
        if (clip(body.emoji, 8)) patch.emoji = clip(body.emoji, 8);
        if (/^#[0-9a-f]{6}$/i.test(body.color ?? "")) patch.color = body.color;
        if ("team" in body) patch.team = g?.teams.includes(body.team) ? body.team : null;
        if ("goal" in body) patch.goal = body.goal ? Math.min(50000, Math.max(1000, parseSteps(body.goal) ?? 10000)) : null;
        if (["ios", "android", "other"].includes(body.platform)) patch.platform = body.platform;
        const { data, error } = await db.from("members").update(patch).eq("id", member.id).select().single();
        if (error) throw error;
        return json({ ok: true, member: data });
      }

      case "admin": {
        const g = await adminGroup(body);
        if (!g) return fail("Wrong admin key", 403);
        const s = body.settings ?? {};
        const patch: Record<string, unknown> = {};
        if (clip(s.name, 40)) patch.name = clip(s.name, 40);
        if (s.daily_goal) patch.daily_goal = Math.min(50000, Math.max(1000, parseSteps(s.daily_goal) ?? 10000));
        if (typeof s.forfeit === "string") patch.forfeit = clip(s.forfeit, 120);
        if (clip(s.challenge_name, 60)) patch.challenge_name = clip(s.challenge_name, 60);
        if (s.challenge_km) patch.challenge_km = Math.min(100000, Math.max(1, Number(s.challenge_km) || 460));
        if (Array.isArray(s.teams)) patch.teams = s.teams.map((t: unknown) => clip(t, 24)).filter(Boolean).slice(0, 8);
        if (typeof s.shortcut_url === "string") {
          patch.shortcut_url = /^https:\/\/www\.icloud\.com\/shortcuts\//.test(s.shortcut_url) ? s.shortcut_url : null;
        }
        const { data, error } = await db.from("groups").update(patch).eq("id", g.id).select().single();
        if (error) throw error;
        return json({ ok: true, group: publicGroup(data) });
      }

      case "admin_members": {
        const g = await adminGroup(body);
        if (!g) return fail("Wrong admin key", 403);
        const { data } = await db.from("members").select("id,name,emoji,platform,token,last_sync_at").eq("group_id", g.id).order("created_at");
        return json({ ok: true, members: data });
      }

      case "admin_remove": {
        const g = await adminGroup(body);
        if (!g) return fail("Wrong admin key", 403);
        await db.from("members").delete().eq("id", body.member_id).eq("group_id", g.id);
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
