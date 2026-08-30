import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Where the magic link lands. @supabase/ssr uses the PKCE flow, so the link
   arrives with a `code` to trade for a session. */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Only ever redirect to a path on this origin — an attacker-supplied
  // absolute URL here would turn sign-in into an open redirect.
  const requested = searchParams.get("next") ?? "/today";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
