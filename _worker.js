// =============================================================================
// IIMK Shuttle — Cloudflare Pages _worker.js
//
// Routes:
//   GET /shuttle.ics  →  live "next N buses" iCalendar feed
//   everything else   →  served from static assets (index.html, etc.)
//
// Deploy: push to Cloudflare Pages with no build command, output dir "/".
// The _worker.js filename is reserved by Pages — it is never served as a
// static file and is never visible in the browser.
// =============================================================================

const STUDENT = [
  ["08:55", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["09:05", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["10:25", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["10:35", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["10:37", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["11:00", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["11:45", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["12:05", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["12:07", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["13:35", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["13:38", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["13:45", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["14:05", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["14:15", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["14:17", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["15:00", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["15:30", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["15:50", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["15:52", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["16:15", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["17:00", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["17:20", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["17:22", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["18:00", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["18:20", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["18:50", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["18:52", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["19:00", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["20:00", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["20:10", ["PGP Auditorium", "Phase V Campus", "C&D Housing"]],
  ["20:15", ["C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["20:25", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["21:00", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["21:30", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "PGP Auditorium"], "Returns to PGP"],
  ["21:50", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["22:20", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["22:40", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["23:00", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
  ["23:20", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "PGP Auditorium"], "Returns to PGP"],
  ["23:40", ["PGP Auditorium", "Phase V Campus", "C&D Housing", "Main Gate"]],
  ["00:00", ["Main Gate", "C&D Housing", "Phase V Campus", "PGP Auditorium"]],
];

const STAFF = [
  ["07:45", ["Main Gate", "Main Office"], "Direct"],
  ["08:00", ["Main Office", "Phase V Apt", "Resi Hill", "Main Gate"]],
  ["08:30", ["Main Gate", "Main Office"], "Direct"],
  ["08:42", ["Main Office", "Phase V Apt", "Resi Hill", "Main Office"], "Resi Hill & back"],
  ["10:15", ["Main Office", "Phase V Apt", "Apt-1", "Resi Hill", "Main Office"], "& back"],
  ["10:40", ["Main Office", "Main Gate"]],
  ["11:50", ["Main Gate", "Main Office"]],
  ["13:05", ["Main Office", "Phase V Apt", "Resi Hill", "Main Gate"], "Via Phase-V Apt, R-Hill"],
  ["13:50", ["Main Gate", "Resi Hill", "Phase V Apt", "Main Office"], "Via R-Hill, Phase-V"],
  ["14:30", ["Main Office", "Apt-1", "Resi Hill", "Main Office"], "& back"],
  ["15:30", ["Main Office", "Phase V Apt", "Resi Hill", "Main Gate"], "Via Phase-V Apt, R-Hill"],
  ["16:15", ["Main Gate", "Resi Hill", "Phase V Apt", "Main Office"], "Via R-Hill, Phase-V Apt"],
  ["16:45", ["Main Office", "Main Gate"], "Direct"],
  ["17:15", ["Main Gate", "Main Office"]],
  ["17:40", ["Main Office", "Phase V Apt", "Resi Hill", "Main Gate"], "Via Phase-V Apt, R-Hill"],
  ["18:00", ["Main Gate", "Main Office"]],
  ["18:30", ["Main Office", "Resi Hill", "Phase V Apt", "Main Gate"], "Via R-Hill, Phase-V Apt"],
  ["19:30", ["Main Gate", "Resi Hill", "Phase V Apt", "Main Office"], "Via R-Hill, Phase-V Apt"],
  ["20:30", ["Main Gate", "Phase V Apt", "Resi Hill", "Main Office"], "Via Phase-V, R-Hill"],
  ["21:30", ["Main Office", "Main Gate"]],
  ["21:55", ["Main Office", "Main Gate"]],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const IST_OFFSET_MIN = 330; // Asia/Kolkata = UTC+05:30, no DST ever
const EVENT_MINUTES  = 5;
const DEFAULT_N      = 2;
const MAX_N          = 5;
const LOOKAHEAD_DAYS = 2;   // enough to bridge the overnight gap

const pad = (n) => String(n).padStart(2, "0");

function istParts(d) {
  const x = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    y:  x.getUTCFullYear(),
    mo: x.getUTCMonth(),     // 0-based
    d:  x.getUTCDate(),
    h:  x.getUTCHours(),
    mi: x.getUTCMinutes(),
  };
}
function istToEpoch(y, mo, d, h, mi) {
  return Date.UTC(y, mo, d, h, mi, 0) - IST_OFFSET_MIN * 60_000;
}
function fmtLocal({ y, mo, d, h, mi }) {
  return `${y}${pad(mo + 1)}${pad(d)}T${pad(h)}${pad(mi)}00`;
}
function fmtUtcStamp(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function time12(t) {
  let [h, m] = t.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return `${hh}:${pad(m)} ${ap}`;
}
function esc(s) {
  return String(s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;")
    .replace(/,/g,  "\\," ).replace(/\r?\n/g, "\\n");
}
function fold(line) {
  if (line.length <= 73) return line;
  let out = "", i = 0;
  while (i < line.length) {
    out += (i === 0 ? "" : "\r\n ") + line.slice(i, i + 73);
    i  += 73;
  }
  return out;
}

// Respect travel order; loop trips (same stop appears twice) handled by lastIndexOf.
function matches(trip, svc, from, to) {
  if (svc !== "all" && trip.svc !== svc) return false;
  if (from) {
    const i = trip.stops.indexOf(from);
    if (i < 0) return false;
    if (to) {
      const j = trip.stops.lastIndexOf(to);
      if (j < 0 || j <= i) return false;
    }
  } else if (to) {
    if (trip.stops.indexOf(to) < 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// ICS generator
// ---------------------------------------------------------------------------
function generateICS(request) {
  const url    = new URL(request.url);
  const host   = url.hostname || "iimk-shuttle";
  const svc    = (url.searchParams.get("svc")  || "all").toLowerCase();
  const from   =  url.searchParams.get("from") || "";
  const to     =  url.searchParams.get("to")   || "";
  let   n      =  parseInt(url.searchParams.get("n") || String(DEFAULT_N), 10);
  if (!Number.isFinite(n)) n = DEFAULT_N;
  n = Math.max(1, Math.min(MAX_N, n));

  const trips = [
    ...STUDENT.map(([t, s, note]) => ({ svc: "student", t, stops: s, note: note || "" })),
    ...STAFF  .map(([t, s, note]) => ({ svc: "staff",   t, stops: s, note: note || "" })),
  ].filter((tr) => matches(tr, svc, from, to));

  const now     = new Date();
  const nowMs   = now.getTime();
  const today   = istParts(now);

  // Gather future occurrences over today + LOOKAHEAD_DAYS
  const occ = [];
  for (let off = 0; off <= LOOKAHEAD_DAYS; off++) {
    const base = istParts(new Date(
      istToEpoch(today.y, today.mo, today.d, 0, 0) + off * 86_400_000
    ));
    for (const tr of trips) {
      const [hh, mm] = tr.t.split(":").map(Number);
      const startMs  = istToEpoch(base.y, base.mo, base.d, hh, mm);
      if (startMs >= nowMs) occ.push({ tr, startMs });
    }
  }
  occ.sort((a, b) => a.startMs - b.startMs);
  const chosen = occ.slice(0, n);

  const dtstamp = fmtUtcStamp(now);
  const L = [];

  L.push("BEGIN:VCALENDAR");
  L.push("VERSION:2.0");
  L.push("PRODID:-//IIMK Shuttle//Next Buses//EN");
  L.push("CALSCALE:GREGORIAN");
  L.push("METHOD:PUBLISH");

  let calName = "IIMK Shuttle — next buses";
  const bits = [
    svc  !== "all" ? svc               : null,
    from           ? `from ${from}`    : null,
    to             ? `to ${to}`        : null,
  ].filter(Boolean);
  if (bits.length) calName += ` (${bits.join(" · ")})`;
  L.push(fold("X-WR-CALNAME:" + esc(calName)));
  L.push("X-WR-TIMEZONE:Asia/Kolkata");
  L.push("REFRESH-INTERVAL;VALUE=DURATION:PT15M");
  L.push("X-PUBLISHED-TTL:PT15M");

  // Fixed-offset VTIMEZONE (IST has no DST — ever).
  L.push("BEGIN:VTIMEZONE");
  L.push("TZID:Asia/Kolkata");
  L.push("BEGIN:STANDARD");
  L.push("DTSTART:19700101T000000");
  L.push("TZOFFSETFROM:+0530");
  L.push("TZOFFSETTO:+0530");
  L.push("TZNAME:IST");
  L.push("END:STANDARD");
  L.push("END:VTIMEZONE");

  for (const { tr, startMs } of chosen) {
    const sp  = istParts(new Date(startMs));
    const ep  = istParts(new Date(startMs + EVENT_MINUTES * 60_000));
    const uid = `${sp.y}${pad(sp.mo+1)}${pad(sp.d)}-${tr.t.replace(":","")}-${tr.svc}@${host}`;

    const svcLabel = tr.svc === "student" ? "Student" : "Staff";
    const first    = tr.stops[0];
    const last     = tr.stops[tr.stops.length - 1];
    const summary  = `\u{1F68C} ${time12(tr.t)}  ${first} → ${last}  (${svcLabel})`;
    let   desc     = `${svcLabel} shuttle\nRoute: ${tr.stops.join(" → ")}`;
    if (tr.note) desc += `\n${tr.note}`;
    desc += `\nDeparts ${first} at ${time12(tr.t)}`;

    L.push("BEGIN:VEVENT");
    L.push("UID:"                             + uid);
    L.push("DTSTAMP:"                         + dtstamp);
    L.push(`DTSTART;TZID=Asia/Kolkata:`       + fmtLocal(sp));
    L.push(`DTEND;TZID=Asia/Kolkata:`         + fmtLocal(ep));
    L.push(fold("SUMMARY:"                    + esc(summary)));
    L.push(fold("DESCRIPTION:"               + esc(desc)));
    L.push(fold("LOCATION:"                  + esc(first)));
    L.push("SEQUENCE:0");
    L.push("STATUS:CONFIRMED");
    L.push("TRANSP:TRANSPARENT");
    L.push("END:VEVENT");
  }

  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/shuttle.ics") {
      return new Response(generateICS(request), {
        headers: {
          "Content-Type":        "text/calendar; charset=utf-8",
          "Content-Disposition": 'inline; filename="iimk-shuttle.ics"',
          "Cache-Control":       "public, max-age=60",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Everything else → static assets (index.html, favicon, etc.)
    // env.ASSETS is the Cloudflare Pages static asset binding.
    return env.ASSETS.fetch(request);
  },
};
