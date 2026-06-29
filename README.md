# IIMK Shuttle

A static schedule board for the IIM Kozhikode campus shuttles (student + staff),
plus a live "next 2 buses" calendar feed.

## Files

```
public/
  index.html    ← the web app (the ONLY thing served as a static asset)
worker.js       ← Cloudflare Worker — handles /shuttle.ics, passes
                  everything else to static assets via env.ASSETS
wrangler.toml   ← worker + assets config (name MUST match your Worker)
README.md
```

Keeping the app in `public/` (instead of the repo root) means wrangler only
uploads `index.html` as an asset — not `worker.js`, `node_modules`, or `.git`.

## Deploy (Cloudflare Workers)

```bash
npx wrangler deploy
```

`wrangler.toml` must sit in the repo root and its `name` must match the Worker
that owns your domain (here, `iimk-bus-schedule`). If the name differs, wrangler
deploys to a *different* Worker and your domain keeps returning 404.

A correct deploy log will show the Worker script uploading **and** a line like
`Your Worker has access to the following bindings: ASSETS`. If you only see
"Read N files from the assets directory" with no Worker/bindings line, the
Worker script isn't deploying — check that `main = "worker.js"` is present.

After deploy, test the route directly on the workers.dev URL first:
`https://iimk-bus-schedule.<your-subdomain>.workers.dev/shuttle.ics`
then on the custom domain: `https://iimkbus.nipunh.com/shuttle.ics`

## The calendar feed

`GET /shuttle.ics` returns only the **next 2 upcoming buses**, each as a 5-minute
event, anchored to Asia/Kolkata (IST). A bus drops out of the feed the moment it
departs, so the subscribing calendar removes it on its next sync — the calendar
never accumulates stale events.

Optional query params (mirror the app's filters):

| param  | values                         | default |
|--------|--------------------------------|---------|
| `svc`  | `all` \| `student` \| `staff`  | `all`   |
| `from` | a stop name, e.g. `C&D Housing`| —       |
| `to`   | a stop name, e.g. `PGP Auditorium` | —   |
| `n`    | `1`–`5` (how many buses)        | `2`     |

Example: `webcal://your-domain/shuttle.ics?svc=student&from=C%26D%20Housing&to=PGP%20Auditorium`

### Why generated on every request (not cached every 30 min)

The student buses run as little as 2 minutes apart, so a feed regenerated only
every 30 minutes would serve a "next 2" that has often already departed. On-demand
generation is always correct to the second, has no cron/KV moving parts, and the
compute is trivial. A 60-second edge cache (`Cache-Control: max-age=60`) coalesces
bursts of polls without introducing meaningful staleness.

### Calendar app behaviour (important)

The **calendar app** controls how often it re-fetches a subscription — your server
can't force it:

- **Apple Calendar** — refreshes ~hourly (tunable). Works well.
- **Outlook** — ~hourly. Works.
- **Google Calendar** — only every **12–24h**. The "next 2 / auto-delete" behaviour
  will lag badly here. Not recommended as the primary client.

So this feature is best pitched as an **Apple Calendar / iPhone** add-on.

## Keeping data in sync

The schedule lives only in `_worker.js` (used by the calendar API) and inline
in `index.html` (used by the static page so it works with zero network calls).
Both use the identical `["HH:MM", [stops...], "note"]` format — edit both if
timings change.

## Assumptions / caveats

- The schedule is assumed to run **every day** (the source notices don't specify
  weekend/holiday variations). Adjust if that's wrong.
- Student board is w.e.f. 09 Jun 2026; staff shuttle w.e.f. May 2025.
- The lower rows of the student source image were distorted; double-check the
  late-night trips (≈ 9:30 PM onward) against the original.
- `Maingate` (student) and `Main Gate` (staff) are treated as the same stop.
