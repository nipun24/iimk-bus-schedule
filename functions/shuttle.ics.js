// ---------------------------------------------------------------------------
// GET /shuttle.ics  —  live "next N buses" calendar feed (default N = 2).
//
// Query params (all optional, mirror the web app's filters):
//   svc  = all | student | staff          (default all)
//   from = <stop name>                     (e.g. "C&D Housing")
//   to   = <stop name>                     (e.g. "PGP Auditorium")
//   n    = 1..5                            (how many upcoming buses, default 2)
//
// Strategy: generated fresh on every request (see README for the rationale),
// with a 60s edge cache to coalesce bursts. Only buses departing at/after
// "now" are emitted, so a bus drops out of the feed the moment it departs —
// and the subscribing calendar removes it on its next sync. Each event is 5
// minutes long.
//
// Timezone: all events are anchored to Asia/Kolkata (IST, fixed +05:30, no DST).
// ---------------------------------------------------------------------------

import { STUDENT, STAFF } from "./_schedule.js";

const TZID = "Asia/Kolkata";
const IST_OFFSET_MIN = 330; // +05:30, never changes (no DST in India)
const EVENT_MINUTES = 5;
const DEFAULT_N = 2;
const MAX_N = 5;
const LOOKAHEAD_DAYS = 2; // enough to always find N across the overnight gap

function buildTrips() {
  const out = [];
  for (const [t, stops, note] of STUDENT) out.push({ svc: "student", t, stops, note: note || "" });
  for (const [t, stops, note] of STAFF) out.push({ svc: "staff", t, stops, note: note || "" });
  return out;
}

// Same route logic as the web app: respects travel order, handles loop trips.
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

const pad = (n) => String(n).padStart(2, "0");

// IST wall-clock components for an absolute instant.
function istParts(d) {
  const x = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return {
    y: x.getUTCFullYear(), mo: x.getUTCMonth(), d: x.getUTCDate(),
    h: x.getUTCHours(), mi: x.getUTCMinutes(),
  };
}

// Absolute epoch ms for a given IST wall-clock date/time.
function istToEpoch(y, mo, d, h, mi) {
  return Date.UTC(y, mo, d, h, mi, 0) - IST_OFFSET_MIN * 60000;
}

function fmtLocal(p) { // YYYYMMDDTHHMMSS (floating, paired with TZID)
  return `${p.y}${pad(p.mo + 1)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}00`;
}
function fmtUtcStamp(d) { // YYYYMMDDTHHMMSSZ for DTSTAMP
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function time12(t) {
  let [h, m] = t.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM"; let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${pad(m)} ${ap}`;
}

function esc(s) {
  return String(s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;")
    .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// RFC5545 line folding (≤75 octets; we fold conservatively by char length).
function fold(line) {
  if (line.length <= 73) return line;
  let out = "", i = 0;
  while (i < line.length) {
    out += (i === 0 ? "" : "\r\n ") + line.slice(i, i + 73);
    i += 73;
  }
  return out;
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const host = url.hostname || "iimk-shuttle";
  const svc = (url.searchParams.get("svc") || "all").toLowerCase();
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  let n = parseInt(url.searchParams.get("n") || String(DEFAULT_N), 10);
  if (!Number.isFinite(n)) n = DEFAULT_N;
  n = Math.max(1, Math.min(MAX_N, n));

  const now = new Date();
  const nowMs = now.getTime();
  const today = istParts(now);

  const trips = buildTrips().filter((t) => matches(t, svc, from, to));

  // Materialise occurrences across today + the next couple of days, keep future ones.
  const occ = [];
  for (let off = 0; off <= LOOKAHEAD_DAYS; off++) {
    const base = istParts(new Date(istToEpoch(today.y, today.mo, today.d, 0, 0) + off * 86400000));
    for (const t of trips) {
      const [hh, mm] = t.t.split(":").map(Number);
      const startMs = istToEpoch(base.y, base.mo, base.d, hh, mm);
      if (startMs >= nowMs) occ.push({ t, startMs });
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
  const fdesc = [svc !== "all" ? svc : null, from ? `from ${from}` : null, to ? `to ${to}` : null]
    .filter(Boolean).join(" · ");
  if (fdesc) calName += ` (${fdesc})`;
  L.push(fold("X-WR-CALNAME:" + esc(calName)));
  L.push("X-WR-TIMEZONE:" + TZID);
  L.push("REFRESH-INTERVAL;VALUE=DURATION:PT15M");
  L.push("X-PUBLISHED-TTL:PT15M");

  // Fixed-offset VTIMEZONE (IST has no DST).
  L.push("BEGIN:VTIMEZONE");
  L.push("TZID:" + TZID);
  L.push("BEGIN:STANDARD");
  L.push("DTSTART:19700101T000000");
  L.push("TZOFFSETFROM:+0530");
  L.push("TZOFFSETTO:+0530");
  L.push("TZNAME:IST");
  L.push("END:STANDARD");
  L.push("END:VTIMEZONE");

  for (const { t, startMs } of chosen) {
    const sp = istParts(new Date(startMs));
    const ep = istParts(new Date(startMs + EVENT_MINUTES * 60000));
    const uid = `${sp.y}${pad(sp.mo + 1)}${pad(sp.d)}-${t.t.replace(":", "")}-${t.svc}@${host}`;
    const svcLabel = t.svc === "student" ? "Student" : "Staff";
    const first = t.stops[0];
    const last = t.stops[t.stops.length - 1];
    const summary = `\u{1F68C} ${time12(t.t)}  ${first} -> ${last}  (${svcLabel})`;
    let desc = `${svcLabel} shuttle\nRoute: ${t.stops.join(" -> ")}`;
    if (t.note) desc += `\n${t.note}`;
    desc += `\nDeparts ${first} at ${time12(t.t)}`;

    L.push("BEGIN:VEVENT");
    L.push("UID:" + uid);
    L.push("DTSTAMP:" + dtstamp);
    L.push(`DTSTART;TZID=${TZID}:` + fmtLocal(sp));
    L.push(`DTEND;TZID=${TZID}:` + fmtLocal(ep));
    L.push(fold("SUMMARY:" + esc(summary)));
    L.push(fold("DESCRIPTION:" + esc(desc)));
    L.push(fold("LOCATION:" + esc(first)));
    L.push("SEQUENCE:0");
    L.push("STATUS:CONFIRMED");
    L.push("TRANSP:TRANSPARENT");
    L.push("END:VEVENT");
  }

  L.push("END:VCALENDAR");
  const body = L.join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="iimk-shuttle.ics"',
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
