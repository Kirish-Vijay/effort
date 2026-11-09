// The game rules live in docs/game.js and docs/items.js, the same files the app and the lab run.
// The server reads its copy from the app_files table (not the website, so it keeps working whatever happens
// to the site's hosting). After changing either file, upload it to app_files too. Each instance keeps the
// rules for up to 10 minutes.
// A copy older than this code needs (Game.API below NEED, or missing a function it calls) is never used: it isn't
// kept, the request fails before anything is charged, and the next request loads the table again. Upload the new
// game.js before (or with) deploying a function that needs it.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEEP_MS = 10 * 60000;
const NEED = 2;
const MUST_HAVE = ["raidEnd", "raidHold", "raidCreate", "raidDmgCap", "raidClampReport", "crateOdds", "crateValue", "gambaRoll", "itemById", "priceOf", "sellPrice", "weekTable", "bossFor"];
// deno-lint-ignore no-explicit-any
let loaded: { at: number; game: any } | null = null;
// deno-lint-ignore no-explicit-any
let pending: Promise<any> | null = null;

// deno-lint-ignore no-explicit-any
function stale(G: any) {
  if (!G) return "no Game";
  if (!(Number(G.API) >= NEED)) return `API ${G.API ?? "none"}, need ${NEED}`;
  const gone = MUST_HAVE.filter((k) => typeof G[k] !== "function");
  return gone.length ? `missing ${gone.join(", ")}` : null;
}

export async function rules() {
  if (loaded && Date.now() - loaded.at < KEEP_MS) return loaded.game;
  pending ??= (async () => {
    const { data, error } = await db.from("app_files").select("name,body").in("name", ["items.js", "game.js"]);
    if (error) throw new Error(`Couldn't load the rules (${error.message})`);
    const file = (n: string) => {
      const f = data?.find((x) => x.name === n);
      if (!f) throw new Error(`The rules are missing ${n}`);
      return f.body as string;
    };
    // deno-lint-ignore no-explicit-any
    const root: any = {};
    for (const code of [file("items.js"), file("game.js")]) new Function("window", "globalThis", code)(root, root);
    const why = stale(root.Game);
    if (why) throw Object.assign(new Error(`The rules in app_files are out of date (${why}). Upload the new game.js`), { stale: true });
    loaded = { at: Date.now(), game: root.Game };
    return root.Game;
  })().finally(() => { pending = null; });
  try { return await pending; }
  catch (e) {
    // The database couldn't be read: keep going on the last good rules we had (they passed the check above). A stale
    // upload never replaces them, and is never used.
    if (loaded) return loaded.game;
    throw e;
  }
}
