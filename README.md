# Effort

Walk more, scroll less. A step + screen-time game for friend groups and a public league. Works on iPhone and Android as an installable web app (no app store).

- **App** (`docs/`): PWA hosted on GitHub Pages. `engine.js` holds every game rule (`RULES` at the top), `app.js` is the UI.
- **API** (`supabase/functions/effort`): Supabase Edge Function + Postgres.

## The game

| Layer | What it is | Resets? |
| --- | --- | --- |
| **Effort** (daily) | +1 per 100 steps (half rate past 15k, cap 30k). Every 1,000 steps earns 5 min of scroll budget; minutes over budget cost 1 each (max −60), unused minutes are worth +0.5 (max +30). No scroll data = 30 min assumed. | Daily |
| **Par + Score** (weekly) | Par = your average day (trimmed mean of last 20 active days, can't drop >15% below its 13-week high). Daily score = effort as % of par (max 200). Weekly forfeit, rivals, teams and leagues use this, so newcomers can win week one. | Weekly |
| **Streaks** | Beat par on 4 of 7 days = streak week. Every 4 streak weeks earns a freeze. | — |
| **Seasons** | 6 weeks. Top 3 get a permanent trophy. Group journey resets. | Every 6 weeks |
| **Levels, badges, trophies** | Lifetime XP from positive effort; 2× for first 14 days and after a 5+ day break. Never lost. | Never |
| **Public league** | Bronze → Diamond. 750+ weekly score moves you up, under 450 down. Typed-in steps count half. | Weekly |

## How data gets in

| What | iPhone | Android | Fallback |
| --- | --- | --- | --- |
| Steps | Shortcuts automation → `/log?t=TOKEN&steps=N` | HC Webhook (Health Connect) → `/hc?t=TOKEN` | Log tab |
| Scrolling | Shortcuts "App is Opened/Closed" automations → `/scroll?t=TOKEN&ev=open\|close` (server pairs into minutes) | MacroDroid launch/close macros (same URLs), or Tasker → `/scroll?t=TOKEN&minutes=N` | Log tab (Screen Time / Digital Wellbeing minutes) |

Each player's personal links are in the app under **Me → Step syncing / Scroll tracking**.
