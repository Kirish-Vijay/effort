// Squad chat. Messages are encrypted before they're stored: AES-256-GCM with a key for each squad, derived
// (HKDF-SHA256) from this function's service key, which lives in the function's environment and never in the
// database. So the table holds only ciphertext; only this function, answering a squad member, can read it.
// deno-lint-ignore no-explicit-any
type Any = any;

const MAX_LEN = 2000;
const PAGE = 50;
const SEARCH_SCAN = 5000;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const keys = new Map<string, CryptoKey>();
async function keyFor(groupId: string) {
  let k = keys.get(groupId);
  if (k) return k;
  const base = await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), "HKDF", false, ["deriveKey"]);
  k = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode("effort-chat-v1"), info: enc.encode(groupId) },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  keys.set(groupId, k);
  return k;
}
async function seal(groupId: string, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(groupId), enc.encode(text)));
  return { iv: b64(iv), body: b64(ct) };
}
async function open(groupId: string, iv: string, body: string) {
  try { return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await keyFor(groupId), unb64(body))); }
  catch { return null; }
}
// A stored row as the app sees it.
async function shape(groupId: string, r: Any) {
  return { id: r.id, by: r.player_id, at: r.created_at, edited: !!r.edited_at, reply: r.reply_to,
    text: r.deleted ? null : await open(groupId, r.iv, r.body), deleted: r.deleted };
}
const COLS = "id,player_id,iv,body,reply_to,created_at,edited_at,deleted";

// Who a message mentions: @everyone is the whole squad, @Name is that squad-mate (the whole name, not the start of a
// longer one). Never the sender.
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function mentioned(text: string, squad: Any, by: string): string[] {
  const all = /@everyone\b/i.test(text);
  return squad.members.filter((m: Any) => m.id !== by && (all || new RegExp(`@${escRe(m.name)}(?![\\p{L}\\p{N}])`, "iu").test(text))).map((m: Any) => m.id);
}
// Phones with browser notifications on get pinged straight away (the effort-push function sends them). The Android
// app has no browser push; it asks for its mentions every 15 minutes instead (chat_pings).
async function notifyMentions(db: Any, squad: Any, from: Any, text: string) {
  const ids = mentioned(text, squad, from.id);
  if (!ids.length) return;
  const { data: cfg } = await db.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
  if (!cfg) return;
  const all = /@everyone\b/i.test(text);
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/effort-push/mention`, {
    method: "POST", headers: { "content-type": "application/json", "x-cron-key": cfg.value },
    body: JSON.stringify({ ids, title: all ? `${from.name} to everyone in ${squad.group.name}` : `${from.name} mentioned you`, body: text.slice(0, 180) }),
  }).catch((e) => console.error("mention push failed", e));
}

export async function chatRoute(action: string, body: Any, ctx: { db: Any; json: Any; fail: Any; player: Any; squad: Any }) {
  const { db, json, fail, player, squad } = ctx;
  if (!squad) return fail("Join a squad to chat");
  const gid = squad.group.id;
  const list = async (rows: Any[]) => Promise.all((rows ?? []).map((r) => shape(gid, r)));
  switch (action) {
    // Newest page, or older than `before`, or newer than `after`.
    case "chat_list": {
      let q = db.from("chat_messages").select(COLS).eq("group_id", gid);
      if (Number(body.after) > 0) {
        const { data } = await q.gt("id", Number(body.after)).order("id", { ascending: true }).limit(PAGE * 2);
        return json({ ok: true, messages: await list(data) });
      }
      if (Number(body.before) > 0) q = q.lt("id", Number(body.before));
      const { data } = await q.order("id", { ascending: false }).limit(Math.min(100, Number(body.limit) || PAGE));
      const msgs = await list(data);
      return json({ ok: true, messages: msgs.reverse(), more: (data ?? []).length >= (Math.min(100, Number(body.limit) || PAGE)) });
    }
    // A window of messages either side of one (for jumping to a search result).
    case "chat_around": {
      const id = Number(body.id);
      const [{ data: older }, { data: newer }] = await Promise.all([
        db.from("chat_messages").select(COLS).eq("group_id", gid).lte("id", id).order("id", { ascending: false }).limit(25),
        db.from("chat_messages").select(COLS).eq("group_id", gid).gt("id", id).order("id", { ascending: true }).limit(25),
      ]);
      return json({ ok: true, messages: [...(await list(older)).reverse(), ...(await list(newer))], more: (older ?? []).length >= 25 });
    }
    case "chat_send": {
      const text = String(body.text ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_LEN);
      if (!text) return fail("Say something first");
      const since = new Date(Date.now() - 60000).toISOString();
      const { count } = await db.from("chat_messages").select("id", { count: "exact", head: true }).eq("player_id", player.id).gte("created_at", since);
      if ((count ?? 0) >= 30) return fail("Slow down a bit");
      const reply = Number(body.reply) > 0 ? Number(body.reply) : null;
      const sealed = await seal(gid, text);
      const { data, error } = await db.from("chat_messages").insert({ group_id: gid, player_id: player.id, ...sealed, reply_to: reply }).select(COLS).single();
      if (error) throw error;
      // Send the mention pings without making the sender wait for them.
      const ping = notifyMentions(db, squad, player, text);
      const rt = (globalThis as Any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(ping); else await ping;
      return json({ ok: true, message: await shape(gid, data) });
    }
    case "chat_edit": {
      const text = String(body.text ?? "").trim().slice(0, MAX_LEN);
      if (!text) return fail("Say something first");
      const sealed = await seal(gid, text);
      const { data } = await db.from("chat_messages").update({ ...sealed, edited_at: new Date().toISOString() })
        .eq("id", Number(body.id)).eq("group_id", gid).eq("player_id", player.id).eq("deleted", false).select(COLS).maybeSingle();
      if (!data) return fail("You can only edit your own messages");
      return json({ ok: true, message: await shape(gid, data) });
    }
    case "chat_delete": {
      // The words are wiped, not just hidden.
      const { data } = await db.from("chat_messages").update({ deleted: true, iv: "", body: "" })
        .eq("id", Number(body.id)).eq("group_id", gid).eq("player_id", player.id).select(COLS).maybeSingle();
      if (!data) return fail("You can only delete your own messages");
      return json({ ok: true, message: await shape(gid, data) });
    }
    // Search has to decrypt to look, so it scans the squad's most recent messages.
    case "chat_search": {
      const q = String(body.q ?? "").trim().toLowerCase();
      if (q.length < 2) return json({ ok: true, results: [] });
      const words = q.split(/\s+/).filter(Boolean);
      const out: Any[] = [];
      let before = Infinity, scanned = 0;
      while (scanned < SEARCH_SCAN && out.length < 50) {
        let qq = db.from("chat_messages").select(COLS).eq("group_id", gid).eq("deleted", false);
        if (before !== Infinity) qq = qq.lt("id", before);
        const { data } = await qq.order("id", { ascending: false }).limit(500);
        if (!data?.length) break;
        for (const m of await list(data)) { const t = (m.text ?? "").toLowerCase(); if (t && words.every((w) => t.includes(w))) out.push(m); }
        scanned += data.length; before = data[data.length - 1].id;
        if (data.length < 500) break;
      }
      return json({ ok: true, results: out.slice(0, 50), scanned });
    }
    // The Effort app (Android) asks every 15 minutes for messages that mention you since it last looked. With no
    // `after` it just learns where the chat is up to, so a first run doesn't dig up old mentions.
    case "chat_pings": {
      const after = Number(body.after) || 0;
      const { data: top } = await db.from("chat_messages").select("id").eq("group_id", gid).order("id", { ascending: false }).limit(1);
      const latest = top?.[0]?.id ?? 0;
      if (after <= 0) return json({ ok: true, latest, pings: [] });
      const { data } = await db.from("chat_messages").select(COLS).eq("group_id", gid).gt("id", after).eq("deleted", false)
        .neq("player_id", player.id).order("id", { ascending: true }).limit(50);
      const pings = (await list(data)).filter((m) => m.text && mentioned(m.text, squad, m.by).includes(player.id)).map((m) => ({
        id: m.id, from: squad.members.find((x: Any) => x.id === m.by)?.name || "Someone", text: m.text.slice(0, 180), all: /@everyone\b/i.test(m.text),
      }));
      return json({ ok: true, latest: Math.max(latest, after), pings, squad: squad.group.name });
    }
    default:
      return null;
  }
}
// The newest message id in a squad (for the unread dot).
export async function chatLatest(db: Any, squad: Any) {
  if (!squad) return 0;
  const { data } = await db.from("chat_messages").select("id").eq("group_id", squad.group.id).order("id", { ascending: false }).limit(1);
  return data?.[0]?.id ?? 0;
}
