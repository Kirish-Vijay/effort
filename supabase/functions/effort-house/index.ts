// The House: Stripe tells us a skin was paid for, and this hands it over.
//
// Each skin has a Stripe Payment Link (Game.SKINS[].pay). The app opens it with
// client_reference_id = "<player id>__<skin id>", so when Stripe sends checkout.session.completed here we know who
// bought what. The money goes to whatever bank account the Stripe account pays out to; this only records it and
// grants the skin (a ledger row of kind "skin", amount 0, so it never touches anyone's Endeavours).
//
// Needs one secret: STRIPE_WEBHOOK_SECRET (the "whsec_..." signing secret of the webhook endpoint in Stripe).
// Until it's set every request is refused, so nothing can be faked.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { rules } from "./rules.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TOLERANCE_S = 300;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
// Constant-time compare, so the signature can't be guessed a byte at a time.
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// Stripe-Signature: t=<unix seconds>,v1=<hex hmac-sha256 of "t.body">[,v1=...]
async function verified(raw: string, header: string, secret: string) {
  const parts = header.split(",").map((p) => p.split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return sigs.some((s) => same(s, want));
}

const reply = (status: number, msg: string) => new Response(JSON.stringify({ ok: status < 300, message: msg }), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "POST only");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return reply(503, "The House isn't set up yet");
  const raw = await req.text();
  if (!(await verified(raw, req.headers.get("stripe-signature") || "", secret))) return reply(400, "Bad signature");
  let ev;
  try { ev = JSON.parse(raw); } catch { return reply(400, "Bad body"); }
  if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return reply(200, "Ignored");
  const s = ev.data?.object || {};
  if (s.payment_status !== "paid") return reply(200, "Not paid yet");

  const G = await rules();
  const [playerId, skinId] = String(s.client_reference_id || "").split("__");
  const skin = G.skinById(skinId), tier = skin && G.skinTier(skin);
  const pence = Number(s.amount_total) || 0;
  const { data: player } = playerId ? await db.from("players").select("id,name").eq("id", playerId).maybeSingle() : { data: null };

  // Record every payment, even one we can't match, so the fund's total is always right.
  const { error } = await db.from("house_payments").upsert({
    stripe_session: String(s.id), player_id: player?.id ?? null, skin: skin?.id ?? String(skinId || "unknown"), pence,
    currency: String(s.currency || "gbp"), email: s.customer_details?.email ?? null,
  }, { onConflict: "stripe_session", ignoreDuplicates: true });
  if (error) return reply(500, error.message);
  if (!player || !skin) return reply(200, "Paid, but no player or skin to give it to. Sort it by hand");
  if (pence < tier.pence) return reply(200, "Paid less than the skin costs. Sort it by hand");

  const { error: e2 } = await db.from("ledger").upsert(
    { player_id: player.id, kind: "skin", ref: skin.id, amount: 0, xp: 0, note: `The House: ${skin.name} (${G.pounds(pence)})` },
    { onConflict: "player_id,kind,ref", ignoreDuplicates: true },
  );
  if (e2) return reply(500, e2.message);
  return reply(200, `${skin.name} for ${player.name}`);
});
