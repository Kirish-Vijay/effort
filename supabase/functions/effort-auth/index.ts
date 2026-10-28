// Effort sign-in: get back into your account on a new phone (or after being signed out). Three ways:
//   password  squad code → tap your name → password (set under Me)
//   email     a 6-digit code from Supabase Auth proves the email; the email must already be on the account
//   passkey   fingerprint / Face ID (WebAuthn), synced to new phones by Google or Apple
// Routes:
//   GET  /people?code=ABC123                       the squad's players (name, look, whether they've set a password)
//   POST /signin {code, id, password}              → token
//   POST /set_password {token, password}
//   POST /status {token}                           which sign-in methods the account has
//   POST /email_ticket {token, email}              → ticket for the email's link, in case it opens in another browser
//   POST /link_email {token | ticket, access_token} save the email a Supabase Auth code (or link) just proved
//   POST /email_signin {access_token}              → token, for whoever's email it is
//   POST /passkey_register_options {token}  /passkey_register {token, challenge_id, response, device}
//   POST /passkey_login_options             /passkey_login {challenge_id, response} → token
// Passwords are kept only as salted PBKDF2 hashes. Five wrong passwords pause sign-in for that account for
// 15 minutes; every further five, for a day.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13.3.3";
import { isoBase64URL, isoUint8Array } from "npm:@simplewebauthn/server@13.3.3/helpers";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);
const ITERATIONS = 150000;
// Passkeys belong to the website's domain. The Android app may use them too: the site vouches for it in
// kirish-vijay.github.io/.well-known/assetlinks.json, and its requests carry the app's signing-key hash as origin.
const RP_ID = "kirish-vijay.github.io";
const ORIGINS = ["https://kirish-vijay.github.io", "android:apk-key-hash:-Pr8gHuq6YCehhDjWgQJ2saFrce0rGbfI5bTZ423LsE"];

// deno-lint-ignore no-explicit-any
type Any = any;
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
// k•••@gmail.com
const maskEmail = (e: string) => e.replace(/^(.)[^@]*(@.*)$/, (_m, a, b) => `${a}•••${b}`);

async function squadByCode(code: unknown) {
  if (typeof code !== "string" || !/^[A-Za-z0-9]{4,12}$/.test(code.trim())) return null;
  const { data } = await db.from("groups").select("id,name,code").eq("code", code.trim().toUpperCase()).maybeSingle();
  return data;
}
async function playerByToken(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const { data } = await db.from("players").select("id,name,token,password_hash,email").eq("token", token).maybeSingle();
  return data;
}
// The email a Supabase Auth session belongs to, if that session's code was really entered.
async function verifiedEmail(accessToken: unknown) {
  if (typeof accessToken !== "string" || !accessToken) return null;
  const { data, error } = await db.auth.getUser(accessToken);
  if (error || !data.user?.email || !data.user.email_confirmed_at) return null;
  return data.user.email.toLowerCase();
}
// Passkey challenges last 5 minutes; an email link's ticket lasts as long as the email's code (an hour).
const lifetime = (kind: string) => (kind === "email" ? 60 : 5) * 60000;
async function newChallenge(kind: string, challenge: string, playerId: string | null) {
  await db.from("auth_challenges").delete().lt("created_at", new Date(Date.now() - lifetime("email")).toISOString());
  const { data, error } = await db.from("auth_challenges").insert({ kind, challenge, player_id: playerId }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
// Each challenge works once.
async function takeChallenge(id: unknown, kind: string) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db.from("auth_challenges").delete().eq("id", id).eq("kind", kind).gt("created_at", new Date(Date.now() - lifetime(kind)).toISOString()).select().maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();
  let body: Record<string, Any> = {};
  if (req.method === "POST") { try { body = JSON.parse((await req.text()) || "{}"); } catch { /* empty */ } }
  try {
    switch (action) {
      case "people": {
        const g = await squadByCode(url.searchParams.get("code"));
        if (!g) return fail("No squad with that code", 404);
        const { data } = await db.from("memberships").select("players(id,name,character,password_hash)").eq("group_id", g.id).order("joined_at");
        const people = (data ?? []).map((m: Any) => ({ id: m.players.id, name: m.players.name, character: m.players.character, has_password: !!m.players.password_hash }));
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
        const { count } = await db.from("passkeys").select("id", { count: "exact", head: true }).eq("player_id", p.id);
        return json({ ok: true, has_password: !!p.password_hash, email: p.email ? maskEmail(p.email) : null, passkeys: count ?? 0 });
      }

      case "email_ticket": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That doesn't look like an email");
        return json({ ok: true, ticket: await newChallenge("email", email, p.id) });
      }

      case "link_email": {
        // From the game (token), or from the email's link opened in some other browser (ticket: whoever asked
        // for the email, and only for that email address).
        const email = await verifiedEmail(body.access_token);
        let p = null;
        if (body.ticket) {
          const t = await takeChallenge(body.ticket, "email");
          if (!t || !email || t.challenge !== email) return fail("That link has expired. Ask for a new code in Effort");
          const { data } = await db.from("players").select("id,name,token,password_hash,email").eq("id", t.player_id).maybeSingle();
          p = data;
        } else p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        if (!email) return fail("That code didn't check out. Ask for a new one");
        const { data: other } = await db.from("players").select("id").ilike("email", email).neq("id", p.id).maybeSingle();
        if (other) return fail("That email is already on another Effort account");
        await db.from("players").update({ email }).eq("id", p.id);
        return json({ ok: true, email: maskEmail(email) });
      }

      case "email_signin": {
        const email = await verifiedEmail(body.access_token);
        if (!email) return fail("That code didn't check out. Ask for a new one");
        const { data: p } = await db.from("players").select("token,name").ilike("email", email).maybeSingle();
        if (!p) return fail("No Effort account has that email. Add it under Me on your old phone, or sign in another way");
        return json({ ok: true, token: p.token, name: p.name });
      }

      case "passkey_register_options": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        const { data: mine } = await db.from("passkeys").select("id,transports").eq("player_id", p.id);
        const options = await generateRegistrationOptions({
          rpName: "Effort", rpID: RP_ID, userName: p.name, userDisplayName: p.name, userID: isoUint8Array.fromUTF8String(p.id),
          attestationType: "none",
          excludeCredentials: (mine ?? []).map((c: Any) => ({ id: c.id, transports: c.transports })),
          authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
        });
        return json({ ok: true, challenge_id: await newChallenge("register", options.challenge, p.id), options });
      }

      case "passkey_register": {
        const p = await playerByToken(body.token);
        if (!p) return fail("Unknown token", 401);
        const ch = await takeChallenge(body.challenge_id, "register");
        if (!ch || ch.player_id !== p.id) return fail("That took too long. Try again");
        const v = await verifyRegistrationResponse({ response: body.response, expectedChallenge: ch.challenge, expectedOrigin: ORIGINS, expectedRPID: RP_ID, requireUserVerification: false })
          .catch((e) => { console.warn("passkey register rejected:", e.message); return null; });
        if (!v?.verified || !v.registrationInfo) return fail("Your phone's answer didn't check out");
        const c = v.registrationInfo.credential;
        const { error } = await db.from("passkeys").insert({
          id: c.id, player_id: p.id, public_key: isoBase64URL.fromBuffer(c.publicKey), counter: c.counter,
          transports: c.transports ?? body.response?.response?.transports ?? [], device: String(body.device ?? "").slice(0, 40),
        });
        if (error) return fail("That fingerprint is already set up");
        return json({ ok: true });
      }

      case "passkey_login_options": {
        const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: "preferred" });
        return json({ ok: true, challenge_id: await newChallenge("login", options.challenge, null), options });
      }

      case "passkey_login": {
        const ch = await takeChallenge(body.challenge_id, "login");
        if (!ch) return fail("That took too long. Try again");
        const id = body.response?.id;
        const { data: pk } = typeof id === "string" ? await db.from("passkeys").select("*").eq("id", id).maybeSingle() : { data: null };
        if (!pk) return fail("This phone's fingerprint sign-in isn't linked to an Effort account any more");
        const v = await verifyAuthenticationResponse({
          response: body.response, expectedChallenge: ch.challenge, expectedOrigin: ORIGINS, expectedRPID: RP_ID, requireUserVerification: false,
          credential: { id: pk.id, publicKey: isoBase64URL.toBuffer(pk.public_key), counter: Number(pk.counter), transports: pk.transports },
        }).catch((e) => { console.warn("passkey sign-in rejected:", e.message); return null; });
        if (!v?.verified) return fail("Your phone's answer didn't check out");
        await db.from("passkeys").update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", pk.id);
        const { data: p } = await db.from("players").select("token,name").eq("id", pk.player_id).single();
        return json({ ok: true, token: p!.token, name: p!.name });
      }

      default:
        return fail("Unknown endpoint", 404);
    }
  } catch (e) {
    console.error(e);
    return fail("Server error: " + (e instanceof Error ? e.message : String(e)), 500);
  }
});
