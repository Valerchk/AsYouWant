import { lookup } from "node:dns/promises";
import { MAX_ICS_BYTES } from "./ics";

/* ==========================================================================
   Fetching a calendar the user named.
   --------------------------------------------------------------------------
   The server goes and downloads a URL a person typed. That is the shape of
   server-side request forgery: without a guard, "https://…" pointed at
   169.254.169.254 turns this route into a reader of cloud instance metadata,
   and pointed at 127.0.0.1 into a reader of anything else listening on the
   box.

   So: https only, the resolved address must be a public one, redirects are
   refused rather than followed (a public host can redirect to a private one),
   the request is capped in both time and size, and only parsed events ever
   leave — never the response body, never the status, never the headers.
   ========================================================================== */

const TIMEOUT_MS = 8000;

export class CalendarError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = p;
  return (
    a === 0 || // this network
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // protocol assignments
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

/** The one guard the whole route rests on, exported so it can be tested. */
export function isPrivateAddress(ip: string, family: number): boolean {
  return family === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

function isPrivateIPv6(ip: string): boolean {
  const at = ip.toLowerCase();
  // ::ffff:10.0.0.1 and friends are IPv4 wearing a hat.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(at);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return (
    at === "::" ||
    at === "::1" ||
    at.startsWith("fc") || // unique local
    at.startsWith("fd") ||
    at.startsWith("fe8") || // link-local
    at.startsWith("fe9") ||
    at.startsWith("fea") ||
    at.startsWith("feb") ||
    at.startsWith("ff") // multicast
  );
}

/** The URL, proven to name a public host, or an error naming the reason. */
export async function assertFetchable(raw: string): Promise<URL> {
  /* Calendar apps hand out webcal:// links, which are https in disguise.
     The swap happens on the string, before parsing: assigning to
     `url.protocol` silently does nothing here, because the URL standard
     refuses to turn a non-special scheme like webcal into a special one. That
     silence rejected every address Apple Calendar gives out. */
  const raw2 = raw.trim().replace(/^webcal:\/\//i, "https://");

  let url: URL;
  try {
    url = new URL(raw2);
  } catch {
    throw new CalendarError("That does not look like a URL.");
  }

  if (url.protocol !== "https:") {
    throw new CalendarError("The calendar address has to start with https.");
  }
  if (url.username || url.password) {
    throw new CalendarError("Credentials in the address are not accepted.");
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new CalendarError("That address does not resolve.");
  }

  // Every address it resolves to must be public, not merely the first one.
  for (const { address, family } of addresses) {
    if (isPrivateAddress(address, family)) {
      throw new CalendarError("That address points inside a private network.");
    }
  }

  return url;
}

/** The calendar's text, or an error. Never more than MAX_ICS_BYTES of it. */
export async function fetchIcs(raw: string): Promise<string> {
  const url = await assertFetchable(raw);

  let response: Response;
  try {
    response = await fetch(url, {
      // A public host may redirect to a private one, and following it would
      // walk straight past the check above.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/calendar, text/plain;q=0.8, */*;q=0.5" },
      // Calendars change slowly and this runs on every day the person opens.
      next: { revalidate: 300 },
    });
  } catch {
    throw new CalendarError("The calendar did not answer.");
  }

  if (response.status >= 300 && response.status < 400) {
    throw new CalendarError("The calendar address redirects; use the final one.");
  }
  if (!response.ok) {
    throw new CalendarError(`The calendar answered ${response.status}.`);
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_ICS_BYTES) {
    throw new CalendarError("That calendar is too large to read.");
  }

  const text = await response.text();
  if (text.length > MAX_ICS_BYTES) {
    throw new CalendarError("That calendar is too large to read.");
  }
  return text;
}
