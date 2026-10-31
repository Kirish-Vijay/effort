// The game rules live in docs/game.js and docs/items.js, the same files the app and the lab run.
// The server reads its copy from the app_files table (not the website, so it keeps working whatever happens
// to the site's hosting). After changing either file, upload it to app_files too. Each instance keeps the
// rules for up to 10 minutes.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEEP_MS = 10 * 60000;
// deno-lint-ignore no-explicit-any
let loaded: { at: number; game: any } | null = null;
// deno-lint-ignore no-explicit-any
let pending: Promise<any> | null = null;

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
    if (!root.Game?.raidEnd) throw new Error("The rules are out of date");
    loaded = { at: Date.now(), game: root.Game };
    return root.Game;
  })().finally(() => { pending = null; });
  try { return await pending; }
  catch (e) {
    if (loaded) return loaded.game; // keep going on the last rules we had
    throw e;
  }
}
