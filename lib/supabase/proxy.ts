import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/* Routes reachable without a session. Everything else requires one.

   `/api` is here not because it is open but because an API must answer like
   an API: these routes check `getUser()` themselves and return a JSON 401.
   Redirecting them to the login page instead sends HTML to a caller that is
   about to run `response.json()` on it. */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/api",
  "/bench",
  "/manifest",
  "/icons",
];

/** The landing page. Public, and where a signed-in person never stays. */
const LANDING = "/";

function isPublic(pathname: string): boolean {
  if (pathname === LANDING) return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the auth session on every request and gates private routes.
 *
 * Two rules from the Supabase SSR docs that are easy to break and painful to
 * debug (they surface as random logouts, not as errors):
 *   1. Nothing may run between createServerClient() and the getUser() call.
 *   2. The response object created here must be the one returned, cookies
 *      intact — building a fresh NextResponse discards the refreshed session.
 */
export async function updateSession(
  request: NextRequest,
  /** Request headers to forward, carrying the nonce Next stamps scripts with. */
  headers: Headers,
) {
  // Before Supabase is configured the app still has to open — the ribbon runs
  // entirely on local storage until the database is wired up.
  //
  // Skipping the session check in production is only ever allowed when it was
  // asked for explicitly: NEXT_PUBLIC_LOCAL_ONLY=1 means "no accounts yet, no
  // private data to protect". Without that flag a missing key in production
  // is a hard failure, because silently waving every request through would
  // leave real users' days readable by anyone.
  if (!hasSupabaseEnv()) {
    const localOnly = process.env.NEXT_PUBLIC_LOCAL_ONLY === "1";
    if (!localOnly && process.env.NODE_ENV === "production") {
      throw new Error(
        "Supabase environment variables are missing in production. " +
          "Set them, or set NEXT_PUBLIC_LOCAL_ONLY=1 to run without accounts.",
      );
    }
    return NextResponse.next({ request: { headers } });
  }

  let response = NextResponse.next({ request: { headers } });

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // The forwarded headers are a snapshot taken before the refresh, so
          // the freshly written cookie has to be copied across or the server
          // components downstream read the session that was just replaced.
          const forwarded = new Headers(headers);
          const cookie = request.headers.get("cookie");
          if (cookie) forwarded.set("cookie", cookie);

          response = NextResponse.next({ request: { headers: forwarded } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    // Siri deep links land on /add?q=…; keep the destination so the block is
    // still created after signing in rather than silently lost.
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Someone already signed in has no use for the login form or the pitch.
  if (user && (pathname === "/login" || pathname === LANDING)) {
    const today = request.nextUrl.clone();
    today.pathname = "/today";
    today.search = "";
    return NextResponse.redirect(today);
  }

  return response;
}
