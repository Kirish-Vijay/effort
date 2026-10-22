# Step Squad

Group step leaderboard that works on iPhone and Android, no app store app needed.

- **App** (`docs/`): installable web app (PWA), hosted on GitHub Pages.
- **API** (`supabase/functions/steps`): Supabase Edge Function. Receives steps from an iPhone Shortcut (`/log`), the HC Webhook Android app (`/hc`), or manual entry, and serves the leaderboard (`/board`).

## How steps get in

| Phone | How |
| --- | --- |
| iPhone | Shortcuts automation each evening: Find Health Samples (Steps, today, group by day) → Sum → Get Contents of URL `…/log?t=TOKEN&steps=` |
| Android | [HC Webhook](https://play.google.com/store/apps/details?id=com.hcwebhook.app) posting Health Connect steps (Daily resolution) to `…/hc?t=TOKEN` |
| Anything | Manual entry in the Log tab |

Each person's sync link is in the app under **Squad → Setup guide**.
