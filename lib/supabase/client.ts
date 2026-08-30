import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/** Supabase client for use in Client Components. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
