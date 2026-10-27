# Effort

Out-walk your mates. A step-counting game for friend squads: steps are money, a Taxman turns up at 7pm every day, and on Sunday the squad raids a boss together. Works on iPhone and Android as an installable web app (no app store).

- **App** (`docs/`): GitHub Pages. `index.html` + `app.js` is the game, `lab.html` + `lab.js` is the playtest build (bots, tuning knobs), `owner.html` is the owner's admin page, `start.html` is the setup guide for friends.
- **Rules** (`docs/game.js`, `docs/items.js`): every number in the game. The app, the lab and the server all run these same files.
- **Server** (`supabase/functions/effort`): one Supabase Edge Function plus Postgres. `index.ts` handles players, squads and step/scroll syncing; `game_api.ts` handles the game; `rules.ts` loads `game.js` and `items.js` from the live site.
- **3D** (`docs/arena3d.js`, `docs/models/`): three.js battles with CC0 models by Quaternius.

## The game

| | What happens |
| --- | --- |
| **Steps** | 100 steps = 1 Effort (up to 300 a day). 100 Efforts = 1 Endeavour, which is what gear costs. |
| **7pm, daily** | The Taxman takes 20% of the day's Efforts, more if you scrolled over budget, 5 points less if you beat the squad's average that day (5 more if you're 10% behind). Five minutes to tap him out: every hit cuts the tax, a knockout keeps it all, and you can steal up to 30% more. Miss it and he takes the full cut. |
| **Paying out** | What you bank in the fight is paid straight away. Steps after 7pm pay out after midnight on the same terms. A day you didn't fight settles after midnight at the full tax. |
| **Sunday 7pm** | A 15-minute squad raid, shared live. Your week's steps ÷ the squad average set your damage (×0.5 to ×1.6). Half the loot is split by steps, half by what you did. Beat the boss and next week brings the next one up the ladder. |
| **The weekly table** | The week's top walker gets +25% raid loot and 10% of the lowest walker's week. The lowest walker gets 25% less and gets hunted by the boss. The payment happens raid or no raid. |
| **Gear and levels** | XP comes from what you earn. Levels unlock rarer gear; gear raises your stats and the boss's level (and its reward). |

## How it fits together

- **The wallet is a ledger.** Every change is a row in `ledger` (a day's steps, a fight, a raid, the weekly payment, a purchase), unique per player and thing, so nothing is paid twice. Balance, XP and owned gear are all sums over it. Purchases go through the `spend` database function, which locks per player.
- **Settling** happens when someone opens the app (`/game`): any finished days and last week's table are paid out then.
- **Live raids**: the first squad member in becomes the host. Their phone runs the fight and streams it to the others over Supabase Realtime about 7 times a second; the others send their taps. If the host's phone goes quiet for 4 seconds, the next one takes over from the last snapshot. The host saves the fight to the server every 15 seconds. At the end the server works out everyone's pay itself from their real gear and steps. If nobody reports the end, the next `/game` call pays out from the last saved snapshot.
- **Testing a fight early**: on `owner.html`, pick a squad and open a 15-minute test window. It opens the Taxman and a raid for that squad straight away, and it counts for real.

## Deploying

- **App and rules**: push to `main`. Open apps notice the new `app.js` and reload when nothing's in progress. The server picks up a changed `game.js`/`items.js` within 10 minutes.
- **Server**: deploy `supabase/functions/effort` (all three `.ts` files) as the `effort` function with JWT verification off (the function does its own auth with player tokens).

## How data gets in

| What | iPhone | Android | Fallback |
| --- | --- | --- | --- |
| Steps | Shortcuts automation → `/log?t=TOKEN&steps=N` | HC Webhook (Health Connect) → `/hc?t=TOKEN` | Me → Steps → Type them in |
| Scrolling | Shortcuts "App is Opened/Closed" automations → `/scroll?t=TOKEN&ev=open\|close` | MacroDroid launch/close macros (same URLs), or Tasker → `/scroll?t=TOKEN&minutes=N` | Me → Scrolling → Type it in |

Each player's own links are in the app under **Me → Steps / Scrolling**.
