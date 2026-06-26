# IIMK Shuttle

A static schedule board for the IIM Kozhikode campus shuttles (student + staff),
plus a live "next 2 buses" calendar feed.

## Files

```
index.html              ← the web app (self-contained, no build step)
functions/
  _schedule.js          ← canonical schedule data (used by the API)
  shuttle.ics.js        ← Cloudflare Pages Function → serves /shuttle.ics
README.md
```

## Deploy (Cloudflare Pages)

1. Push this folder to a Git repo (or drag-and-drop in the Pages dashboard).
2. Create a Pages project pointing at it.
   - Build command: **none**
   - Build output directory: **/** (the repo root)
3. Cloudflare auto-detects the `functions/` folder and deploys the Function.

After deploy:
- App: `https://your-domain/`
- Calendar feed: `https://your-domain/shuttle.ics`
- Subscribe link: `webcal://your-domain/shuttle.ics`

> The in-app **Add to calendar** button builds this link automatically from
> whatever filters are active.

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

The schedule lives in **two** places by design:
- `functions/_schedule.js` — used by the calendar API.
- the `STUDENT` / `STAFF` arrays inside `index.html` — used by the static page
  (kept inline so the page works with zero network calls).

If timings change, edit **both**. They use the identical
`["HH:MM", [stops...], "note"]` format.

## Assumptions / caveats

- The schedule is assumed to run **every day** (the source notices don't specify
  weekend/holiday variations). Adjust if that's wrong.
- Student board is w.e.f. 09 Jun 2026; staff shuttle w.e.f. May 2025.
- The lower rows of the student source image were distorted; double-check the
  late-night trips (≈ 9:30 PM onward) against the original.
- `Maingate` (student) and `Main Gate` (staff) are treated as the same stop.
