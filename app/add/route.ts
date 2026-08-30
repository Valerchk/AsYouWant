import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseQuickAdd } from "@/lib/parse/quickAdd";
import { dateInZone } from "@/lib/time";
import { THREAD_COLOR_COUNT } from "@/lib/threads";

/* Adding a block from outside the app.
 *
 *   /add?q=gym%2045m%207pm%20%23health
 *
 * This is the only route iOS offers into a web app: a Shortcut that opens a
 * URL. There is no way for a PWA to register a Siri intent, so the person
 * builds the Shortcut and we make the URL worth opening.
 *
 * Unauthenticated requests are sent to /login by proxy.ts with `next` intact,
 * so the block is still created after signing in rather than being lost.
 */

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();

  if (!q) return NextResponse.redirect(`${origin}/today`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", origin);
    login.searchParams.set("next", `/add?q=${encodeURIComponent(q)}`);
    return NextResponse.redirect(login);
  }

  const { parsed } = parseQuickAdd(q);
  const title = parsed.title || q;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();

  const day = dateInZone(new Date(), profile?.timezone ?? "UTC");

  // A #tag naming a goal that does not exist yet creates it, exactly as the
  // in-app field does — otherwise dictating "#health" would silently drop it.
  let threadId: string | null = null;
  if (parsed.threadName) {
    const needle = parsed.threadName.toLowerCase();
    const { data: threads } = await supabase
      .from("threads")
      .select("id, name, color_index")
      .eq("user_id", user.id)
      .is("archived_at", null);

    const match = (threads ?? []).find(
      (t) => t.name.toLowerCase() === needle,
    );

    if (match) {
      threadId = match.id;
    } else {
      const { data: created } = await supabase
        .from("threads")
        .insert({
          user_id: user.id,
          name: parsed.threadName,
          color_index: (threads?.length ?? 0) % THREAD_COLOR_COUNT,
          sort_order: (threads?.length ?? 0) + 1,
        })
        .select("id")
        .single();
      threadId = created?.id ?? null;
    }
  }

  const { count } = await supabase
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("day", day);

  const { error } = await supabase.from("blocks").insert({
    user_id: user.id,
    day,
    title,
    kind: parsed.kind,
    start_min: parsed.startMin,
    planned_min: parsed.plannedMin,
    status: "planned",
    thread_id: threadId,
    sort_order: (count ?? 0) + 1,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/today?add=failed`);
  }

  return NextResponse.redirect(`${origin}/today?added=1`);
}
