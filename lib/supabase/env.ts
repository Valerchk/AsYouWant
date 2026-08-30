/* Fail loudly at the first use rather than letting `undefined` reach Supabase
   and come back as an opaque 401 twenty minutes later. */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function supabaseSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

/** Soft check, for code that has to decide rather than throw. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
