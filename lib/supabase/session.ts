import { createClient } from "./client";

type Client = ReturnType<typeof createClient>;

/* ==========================================================================
   Who is signed in, right now.
   --------------------------------------------------------------------------
   The store used to read the user's id once, when the day first loaded, and
   keep it in a module variable for the rest of the session. On a web page open
   for five minutes that is fine. On an app installed to a Home Screen it is
   not: iOS freezes the process, sometimes for hours, so the timer that renews
   the access token never fires. Come back the next evening and the id in
   memory is still perfectly valid-looking while the token beside it has
   expired — and Postgres, seeing no authenticated user, refuses the insert:

     new row violates row-level security policy for table "blocks"

   Which is the database working exactly as intended, reported as a fault.

   So the id is resolved per call from the live session, and the token is
   renewed before it lapses rather than after. When there is genuinely no
   session, the failure says so in those words instead of arriving as a
   database error nobody can act on.
   ========================================================================== */

/** Renew this far ahead of expiry, so a slow request cannot cross it. */
const RENEW_BEFORE_MS = 120_000;

export class SessionExpired extends Error {
  constructor() {
    super("Your session has expired. Sign in again to continue.");
    this.name = "SessionExpired";
  }
}

export function isSessionExpired(e: unknown): boolean {
  return e instanceof SessionExpired;
}

/** The signed-in user's id, with a token that will still be valid on arrival. */
export async function requireUserId(supabase: Client): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.user) throw new SessionExpired();

  // `expires_at` is in seconds. Renewing explicitly rather than trusting the
  // background timer, which a frozen process never gets to run.
  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() > RENEW_BEFORE_MS) return session.user.id;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.user) throw new SessionExpired();
  return refreshed.data.session.user.id;
}

/** A client and a live user id. Every call, never cached. */
export async function authed(): Promise<{ supabase: Client; userId: string }> {
  const supabase = createClient();
  return { supabase, userId: await requireUserId(supabase) };
}

/** A client whose token is current, where the id itself is not needed. */
export async function authedClient(): Promise<Client> {
  const supabase = createClient();
  await requireUserId(supabase);
  return supabase;
}
