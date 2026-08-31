import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  contentSecurityPolicy,
  makeNonce,
  STATIC_SECURITY_HEADERS,
} from "@/lib/security";

/* Next.js 16 renamed Middleware to Proxy. Same mechanism, same position in
   the request lifecycle — the file is `proxy.ts` at the project root and the
   export is `proxy`. A file named middleware.ts is simply ignored.

   Two jobs, in order: mint the nonce this response's scripts will carry, then
   refresh the session and gate the route. The nonce goes onto the *request*
   as well, because that is where Next looks for it when stamping its own
   inline bootstrap script. */

export async function proxy(request: NextRequest) {
  const nonce = makeNonce();
  const csp = contentSecurityPolicy(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = await updateSession(request, headers);

  response.headers.set("content-security-policy", csp);
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: [
    /* Everything except Next internals, static assets and the scheduler.
       /api/tick authenticates with its own shared secret and must not be
       redirected to /login when pg_cron calls it. */
    "/((?!_next/static|_next/image|api/tick|favicon.ico|sw.js|theme.js|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$).*)",
  ],
};
