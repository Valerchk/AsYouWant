import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Note the `await` on cookies(): Next.js 16 removed synchronous access to the
 * request APIs entirely, so this function has to be async and every caller
 * has to await it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. This is the expected path
            // there, and it is safe: proxy.ts refreshes the session on every
            // request, so the write this call would have made is redundant.
          }
        },
      },
    },
  );
}
