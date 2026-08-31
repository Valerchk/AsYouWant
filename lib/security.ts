/* ==========================================================================
   Response security policy.
   --------------------------------------------------------------------------
   One place that decides what the browser is allowed to do with a page from
   this app, so the answer cannot drift between routes.

   The content policy is nonce-based rather than `'unsafe-inline'`. Next emits
   an inline bootstrap script on every page; allowing inline script wholesale
   to accommodate it would also allow any script an attacker managed to get
   into the HTML. Next stamps its own scripts with the nonce it finds on the
   request, so the strict policy costs nothing but this file.

   `'strict-dynamic'` is deliberately absent. It would void the `'self'`
   source, and the theme script in public/theme.js has to load from `'self'`
   before the first paint. The app serves no user-uploaded scripts, so `'self'`
   is a boundary that means something here.
   ========================================================================== */

/** Where the database lives, for connect-src. Never a wildcard on its own. */
function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const { origin, host } = new URL(raw);
    return [origin, `wss://${host}`];
  } catch {
    return [];
  }
}

export function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Dev needs eval for hot reloading. Production never does.
    "script-src": ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-eval'"] : [])],
    // Inline style attributes are everywhere — every animated block sets its
    // own position — and they cannot execute script.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabaseOrigins(), ...(dev ? ["ws:"] : [])],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

  return dev ? policy : `${policy}; upgrade-insecure-requests`;
}

/**
 * Headers that do not depend on the request.
 *
 * Kept here rather than in next.config.ts so the whole policy reads as one
 * decision, and applied from the proxy so a route that skips the config's
 * matcher cannot quietly lose them.
 */
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  // Belt to the CSP's braces, for browsers that predate frame-ancestors.
  "X-Frame-Options": "DENY",
  // No MIME sniffing: an uploaded .txt must never be executed as script.
  "X-Content-Type-Options": "nosniff",
  // Send the origin to other sites, the full path only to ourselves. A path
  // here can name a day, a goal, or a magic-link callback.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // The app asks for notifications and nothing else. Everything else is off,
  // for this page and for anything it embeds.
  "Permissions-Policy":
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), " +
    "encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), " +
    "magnetometer=(), microphone=(), midi=(), payment=(), usb=(), " +
    "screen-wake-lock=(), interest-cohort=()",
  "X-DNS-Prefetch-Control": "off",
  // Two years, subdomains included, and eligible for the preload list.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** A fresh nonce per response. 128 bits, base64, never reused. */
export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
