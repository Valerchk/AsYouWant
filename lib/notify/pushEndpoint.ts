/* ==========================================================================
   Which push endpoints may be stored.
   --------------------------------------------------------------------------
   The scheduler POSTs to whatever endpoint sits in push_subscriptions, once a
   minute, from the server. An arbitrary URL in that column is therefore a
   request the server will make on a stranger's behalf — server-side request
   forgery, with a signed-in account as the only entry fee.

   So an endpoint has to belong to a browser vendor's push service. The list
   is short because the set of browsers is short; a new one is a deliberate
   line here rather than something that slips in through user input.
   ========================================================================== */

const PUSH_HOSTS = [
  "push.services.mozilla.com", // Firefox
  "notify.windows.com", // Edge
  "fcm.googleapis.com", // Chrome
  "android.googleapis.com", // Chrome, older builds
  "push.apple.com", // Safari, including iOS
];

export function isPushService(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  // Exact host, or a subdomain of one. `endsWith(host)` alone would accept
  // `evilpush.apple.com.attacker.net`, so the dot is load-bearing.
  return PUSH_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}
