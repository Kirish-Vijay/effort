// The game rules live in docs/game.js and docs/items.js, the same files the app and the lab run.
// The server loads them from the live site, so a rules change ships to everyone (and the server) with
// one push. Each instance keeps them for up to 10 minutes.
const SITE = "https://kirish-vijay.github.io/effort/";
const KEEP_MS = 10 * 60000;
// deno-lint-ignore no-explicit-any
let loaded: { at: number; game: any } | null = null;
// deno-lint-ignore no-explicit-any
let pending: Promise<any> | null = null;

export async function rules() {
  if (loaded && Date.now() - loaded.at < KEEP_MS) return loaded.game;
  pending ??= (async () => {
    const v = Math.floor(Date.now() / KEEP_MS); // past the CDN cache when the window rolls over
    const [items, game] = await Promise.all(["items.js", "game.js"].map(async (f) => {
      const res = await fetch(`${SITE}${f}?v=${v}`);
      if (!res.ok) throw new Error(`Couldn't load ${f} (${res.status})`);
      return res.text();
    }));
    // deno-lint-ignore no-explicit-any
    const root: any = {};
    for (const code of [items, game]) new Function("window", "globalThis", code)(root, root);
    if (!root.Game?.raidEnd) throw new Error("The rules on the site are out of date");
    loaded = { at: Date.now(), game: root.Game };
    return root.Game;
  })().finally(() => { pending = null; });
  try { return await pending; }
  catch (e) {
    if (loaded) return loaded.game; // the site's down: keep going on the last rules we had
    throw e;
  }
}
