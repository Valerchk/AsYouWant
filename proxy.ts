import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/* Next.js 16 renamed Middleware to Proxy. Same mechanism, same position in
   the request lifecycle — the file is `proxy.ts` at the project root and the
   export is `proxy`. A file named middleware.ts is simply ignored. */

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /* Everything except Next internals, static assets and the scheduler.
       /api/tick authenticates with its own shared secret and must not be
       redirected to /login when pg_cron calls it. */
    "/((?!_next/static|_next/image|api/tick|favicon.ico|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$).*)",
  ],
};
