import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { eventsOnDay } from "@/lib/calendar/ics";
import { CalendarError, fetchIcs } from "@/lib/calendar/fetchIcs";

/* The day's calendar events, read from the subscription on the profile.
 *
 * Server-side because a browser cannot fetch someone else's calendar host
 * (CORS), and because the URL is checked here — see lib/calendar/fetchIcs.ts
 * for what "checked" means and why it matters.
 *
 * Nothing is stored. The events exist for the length of one response. */

export const runtime = "nodejs";

const Query = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"),
});

export async function GET(request: NextRequest) {
  const parsed = Query.safeParse({
    day: request.nextUrl.searchParams.get("day"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("calendar_url, timezone")
    .eq("id", user.id)
    .single();

  if (!profile?.calendar_url) {
    return NextResponse.json({ events: [] });
  }

  try {
    const ics = await fetchIcs(profile.calendar_url);
    const events = eventsOnDay(
      ics,
      parsed.data.day,
      profile.timezone || "UTC",
    );
    return NextResponse.json({ events });
  } catch (err) {
    // The reason is safe to show only when we wrote it ourselves; anything
    // else could carry details of the network the server sits on.
    const message =
      err instanceof CalendarError ? err.message : "Could not read the calendar.";
    return NextResponse.json({ events: [], error: message }, { status: 200 });
  }
}
