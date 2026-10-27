// Effort push notifications: a ping 15 minutes before the 7pm Taxman every day, and before the Sunday raid.
//   GET  /key          the public key phones subscribe with (made on first use, kept in app_config)
//   POST /subscribe    {token, sub}       this phone wants notifications
//   POST /unsubscribe  {token, endpoint}  this phone doesn't
//   POST /test         {token}            send yourself one now
//   POST /tick         pg_cron calls this at :45 past every hour; it pings everyone whose local time is 6:45pm
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";
import { rules } from "./rules.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);
const APP = "https://kirish-vijay.github.io/effort/";
const SQUAD_TZ = "Europe/London";
const NO_SCROLL_MIN = 30;
// deno-lint-ignore no-explicit-any
type Any = any;

// The signing keys: made once, on first use, and kept in app_config (only this server can read it).
let vapid: { publicKey: string; privateKey: string } | null = null;
async function keys() {
  if (vapid) return vapid;
  const read = async () => {
    const { data } = await db.from("app_config").select("key,value").in("key", ["vapid_public", "vapid_private"]);
    const get = (k: string) => data?.find((r: Any) => r.key === k)?.value;
    return get("vapid_public") && get("vapid_private") ? { publicKey: get("vapid_public"), privateKey: get("vapid_private") } : null;
  };
  let k = await read();
  if (!k) {
    const fresh = webpush.generateVAPIDKeys();
    await db.from("app_config").upsert([{ key: "vapid_public", value: fresh.publicKey }, { key: "vapid_private", value: fresh.privateKey }], { onConflict: "key", ignoreDuplicates: true });
    k = await read(); // whichever pair landed first
  }
  webpush.setVapidDetails(APP, k!.publicKey, k!.privateKey);
  return (vapid = k!);
}

function local(t: number, tz: string) {
  let p: Record<string, string>;
  try {
    p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  } catch { return local(t, SQUAD_TZ); }
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, sunday: p.weekday === "Sun" };
}
const addDays = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const mondayOf = (day: string) => addDays(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));

async function playerByToken(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const { data } = await db.from("players").select("id,name,tz").eq("token", token).maybeSingle();
  return data;
}

// Send one message to every phone a player has; phones that have gone away (404/410) are forgotten.
async function sendTo(subs: Any[], msg: Any) {
  await keys();
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 15 * 60, urgency: "high", topic: msg.tag });
      sent++;
    } catch (e) {
      const code = (e as Any)?.statusCode;
      if (code === 404 || code === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error("push failed", code, (e as Any)?.body ?? e);
    }
  }));
  return sent;
}

// What the 6:45pm ping says: the Taxman's cut on today's steps so far, and on Sunday the raid too.
async function evening(players: Any[], now: number) {
  const G = await rules();
  const ids = players.map((p) => p.id);
  const { data: mine } = await db.from("memberships").select("player_id, group_id, groups(tier)").in("player_id", ids);
  const groupOf = Object.fromEntries((mine ?? []).map((m: Any) => [m.player_id, m]));
  const groupIds = [...new Set((mine ?? []).map((m: Any) => m.group_id as string))];
  const { data: mates } = groupIds.length ? await db.from("memberships").select("player_id, group_id, joined_at").in("group_id", groupIds) : { data: [] };
  const everyone = [...new Set([...ids, ...(mates ?? []).map((m: Any) => m.player_id)])];
  const today = local(now, SQUAD_TZ).day, monday = mondayOf(today);
  const [{ data: steps }, { data: scroll }] = await Promise.all([
    db.from("daily_steps").select("player_id,day,steps").in("player_id", everyone).gte("day", addDays(monday, -1)).lte("day", addDays(today, 1)).limit(20000),
    db.from("daily_scroll").select("player_id,day,minutes,auto_minutes").in("player_id", ids).gte("day", addDays(today, -1)).lte("day", addDays(today, 1)),
  ]);
  const stepsOn = (id: string, day: string) => steps?.find((r: Any) => r.player_id === id && r.day === day)?.steps ?? 0;
  return players.map((p) => {
    const L = local(now, p.tz || SQUAD_TZ), g = groupOf[p.id];
    const squadIds = g ? (mates ?? []).filter((m: Any) => m.group_id === g.group_id).map((m: Any) => m.player_id) : [p.id];
    const s = stepsOn(p.id, L.day), E = G.effortsFromSteps(s);
    const sc = scroll?.find((r: Any) => r.player_id === p.id && r.day === L.day);
    const avg = squadIds.length > 1 ? squadIds.reduce((a: number, id: string) => a + stepsOn(id, L.day), 0) / squadIds.length : 0;
    const pct = Math.round(G.taxRate(s, sc ? sc.minutes ?? sc.auto_minutes ?? NO_SCROLL_MIN : NO_SCROLL_MIN, avg) * 100);
    const tax = E ? `He wants ${pct}% of today's ${E} Efforts. Five minutes to stop him.` : "You've no steps in yet today. Sync them before 7.";
    if (g && L.sunday) {
      const week = (id: string) => [0, 1, 2, 3, 4, 5, 6].reduce((a, i) => a + stepsOn(id, addDays(mondayOf(L.day), i)), 0);
      const freshAfter = Date.parse(addDays(mondayOf(L.day), 3) + "T00:00:00Z");
      const T = G.weekTable((mates ?? []).filter((m: Any) => m.group_id === g.group_id).map((m: Any) => ({ id: m.player_id, weekSteps: week(m.player_id), fresh: Date.parse(m.joined_at) > freshAfter })));
      const row = T.rows.find((r: Any) => r.id === p.id);
      const boss = G.bossFor(g.groups?.tier ?? 1);
      const note = row?.title === "top" ? " You're top walker this week." : row?.title === "last" ? " You're the lowest walker. It's coming for you." : "";
      return { player: p, msg: { title: `Raid at 7: ${boss.name}`, body: `15 minutes, the whole squad. Your steps give you ×${(row?.stride ?? 1).toFixed(2)} power.${note} The Taxman's open too.`, tag: "raid", url: APP } };
    }
    return { player: p, msg: { title: "The Taxman's coming at 7", body: tax, tag: "taxman", url: APP } };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  let body: Any = {};
  if (req.method === "POST") { try { body = JSON.parse((await req.text()) || "{}"); } catch { /* empty */ } }
  try {
    switch (action) {
      case "key":
        return json({ ok: true, key: (await keys()).publicKey });

      case "subscribe": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        const s = body.sub;
        if (typeof s?.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return fail("Bad subscription");
        const { error } = await db.from("push_subs").upsert({ endpoint: s.endpoint, player_id: p.id, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
        if (error) throw error;
        return json({ ok: true });
      }

      case "unsubscribe": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        await db.from("push_subs").delete().eq("player_id", p.id).eq("endpoint", String(body.endpoint ?? ""));
        return json({ ok: true });
      }

      case "test": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        const minute = new Date().toISOString().slice(0, 16);
        const { error } = await db.from("push_log").insert({ player_id: p.id, kind: "test", day: minute });
        if (error) return fail("One test a minute");
        const { data: subs } = await db.from("push_subs").select("*").eq("player_id", p.id);
        if (!subs?.length) return fail("This phone isn't signed up for notifications");
        const sent = await sendTo(subs, { title: "Notifications are on", body: "You'll get a ping at 6:45pm before the Taxman, and before the raid on Sunday.", tag: "test", url: APP });
        return sent ? json({ ok: true, sent }) : fail("Couldn't reach your phone. Try turning notifications off and on again.");
      }

      case "tick": {
        const { data: cfg } = await db.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
        if (!cfg || req.headers.get("x-cron-key") !== cfg.value) return fail("Not allowed", 403);
        const now = Date.now();
        const { data: subs } = await db.from("push_subs").select("endpoint,p256dh,auth,player_id,players(id,name,tz)");
        const byPlayer = new Map<string, Any>();
        for (const s of (subs ?? []) as Any[]) {
          const L = local(now, s.players?.tz || SQUAD_TZ);
          if (L.hour !== 18 || L.minute < 40 || L.minute >= 55) continue; // 6:45pm, give or take
          if (!byPlayer.has(s.player_id)) byPlayer.set(s.player_id, { player: s.players, day: L.day, subs: [] });
          byPlayer.get(s.player_id).subs.push(s);
        }
        if (!byPlayer.size) return json({ ok: true, due: 0, sent: 0 });
        const messages = await evening([...byPlayer.values()].map((x) => x.player), now);
        let sent = 0;
        for (const { player, msg } of messages) {
          const x = byPlayer.get(player.id);
          // Only once a day, however often the timer fires.
          const { error } = await db.from("push_log").insert({ player_id: player.id, kind: "evening", day: x.day });
          if (error) continue;
          sent += await sendTo(x.subs, msg);
        }
        return json({ ok: true, due: byPlayer.size, sent });
      }

      default:
        return fail("Unknown endpoint", 404);
    }
  } catch (e) {
    console.error(e);
    return fail("Server error: " + (e instanceof Error ? e.message : String(e)), 500);
  }
});
