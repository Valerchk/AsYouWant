import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Service-role client. Bypasses row level security, so it exists for exactly
 * one caller: the scheduler at /api/tick, which has to read every user's day
 * to decide who needs a notification this minute.
 *
 * SUPABASE_SECRET_KEY carries no NEXT_PUBLIC_ prefix, so Next.js never inlines
 * it into a browser bundle — importing this file from a Client Component
 * yields an undefined key rather than a leaked one. The guard below turns that
 * into an obvious error instead of a confusing 401 from Supabase.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() is server-only.");
  }

  return createSupabaseClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
