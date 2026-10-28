// Effort sign-in: get back into your account on a new phone (or after being signed out).
// You set a password once; then squad code → tap your name → password.
//   GET  /people?code=ABC123            the squad's players (name, look, whether they've set a password)
//   POST /signin {code, id, password}   returns the account's token
//   POST /set_password {token, password}
//   POST /status {token}                whether this account has a password yet
// Only a salted PBKDF2 hash is stored. Five wrong passwords lock sign-in for that account for 15 minutes;
// every further five, for a day.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);
const ITERATIONS = 150000;

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}
async function checkPassword(password: string, stored: string) {
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2") return false;
  const got = await derive(password, unb64(salt), Number(iter)), want = unb64(hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

async function squadByCode(code: unknown) {
  if (typeof code !== "string" || !/^[A-Za-z0-9]{4,12}$/.test(code.trim())) return null;
  const { data } = await db.from("groups").select("id,name,code").eq("code", code.trim().toUpperCase()).maybeSingle();
  return data;
}
async function playerByToken(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const { data } = await db.from("players").select("id,password_hash").eq("token", token).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();
  let body: Record<string, unknown> = {};
  if (req.method === "POST") { try { body = JSON.parse((await req.text()) || "{}"); } catch { /* empty */ } }
  try {
    switch (action) {
      case "people": {
        const g = await squadByCode(url.searchParams.get("code"));
        if (!g) return fail("No squad with that code", 404);
        const { data } = await db.from("memberships").select("players(id,name,character,password_hash)").eq("group_id", g.id).order("joined_at");
        // deno-lint-ignore no-explicit-any
        const people = (data ?? []).map((m: any) => ({ id: m.players.id, name: m.players.name, character: m.players.character, has_password: !!m.players.password_hash }));
        return json({ ok: true, squad: { name: g.name, code: g.code }, people });
      }

      case "signin": {
        const g = await squadByCode(body.code);
        if (!g || typeof body.id !== "string" || typeof body.password !== "string") return fail("Pick your name and type your password");
        const { data: m } = await db.from("memberships").select("player_id").eq("group_id", g.id).eq("player_id", body.id).maybeSingle();
        if (!m) return fail("That person isn't in this squad");
        const { data: p } = await db.from("players").select("id,token,password_hash,signin_fails,signin_locked_until").eq("id", body.id).single();
        if (!p) return fail("That person isn't in this squad");
        if (!p.password_hash) return fail("They haven't set a sign-in password yet");
        if (p.signin_locked_until && Date.parse(p.signin_locked_until) > Date.now()) {
          const mins = Math.ceil((Date.parse(p.signin_locked_until) - Date.now()) / 60000);
          return fail(`Too many wrong tries. Try again in ${mins >= 60 ? `${Math.ceil(mins / 60)} hours` : `${mins} minutes`}`, 429);
        }
        if (!(await checkPassword(body.password, p.password_hash))) {
          const fails = (p.signin_fails ?? 0) + 1;
          const lock = fails % 5 === 0 ? new Date(Date.now() + (fails >= 10 ? 24 * 60 : 15) * 60000).toISOString() : null;
          await db.from("players").update({ signin_fails: fails, ...(lock ? { signin_locked_until: lock } : {}) }).eq("id", p.id);
          const left = 5 - (fails % 5);
          return fail(lock ? "Wrong password. Too many tries, so sign-in is paused for a while" : `Wrong password (${left} more ${left === 1 ? "try" : "tries"} before a pause)`, 401);
        }
        await db.from("players").update({ signin_fails: 0, signin_locked_until: null }).eq("id", p.id);
        return json({ ok: true, token: p.token });
      }

      case "set_password": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        const pw = typeof body.password === "string" ? body.password : "";
        if (pw.length < 4) return fail("Use at least 4 characters");
        if (pw.length > 64) return fail("That's too long");
        await db.from("players").update({ password_hash: await hashPassword(pw), signin_fails: 0, signin_locked_until: null }).eq("id", p.id);
        return json({ ok: true });
      }

      case "status": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        return json({ ok: true, has_password: !!p.password_hash });
      }

      default:
        return fail("Unknown endpoint", 404);
    }
  } catch (e) {
    console.error(e);
    return fail("Server error: " + (e instanceof Error ? e.message : String(e)), 500);
  }
});
