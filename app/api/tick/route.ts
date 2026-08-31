import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toBlock, toThread } from "@/lib/blocks/mapper";
import { layout } from "@/lib/timeline/engine";
import { decideNotifications } from "@/lib/notify/decide";
import { contentHash, sendPush } from "@/lib/notify/send";
import { LIVE_TAG } from "@/lib/notify/compose";
import { applyThrottle } from "@/lib/notify/throttle";
import { dateInZone, minutesInZone } from "@/lib/time";

/* ==========================================================================
   The scheduler.
   --------------------------------------------------------------------------
   Called once a minute by pg_cron (see supabase/migrations/0002_scheduler.sql)
   rather than by Vercel Cron, which on the Hobby plan fires only once a day —
   useless for reminders that need to land on the minute.

   For each person it rebuilds today's ribbon, asks what should be on the lock
   screen right now, and transmits only what differs from the last thing sent
   under that tag. Without that comparison the live card alone would be pushed
   sixty times an hour.

   Scaling note: this walks users one at a time. Fine for a small number;
   past that, batch the per-user queries and fan out the sends.
   ========================================================================== */

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Constant-time comparison of the shared secret.
 *
 * `!==` returns as soon as two bytes differ, and the time it took says how
 * many characters were right. Hashing first makes both inputs the same
 * length, which timingSafeEqual requires and which also stops the length of
 * the guess from leaking.
 */
function secretMatches(presented: string | null, expected: string): boolean {
  if (!presented) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

interface TickReport {
  scanned: number;
  sent: number;
  skipped: number;
  /** Worth saying, but not worth interrupting for yet. Offered again next tick. */
  held: number;
  pruned: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (!secretMatches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const origin = request.nextUrl.origin;

  const report: TickReport = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    held: 0,
    pruned: 0,
    errors: [],
  };

  // Only people who can actually receive anything.
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, fail_count");

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  for (const [userId, userSubs] of byUser) {
    report.scanned += 1;
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!profile) continue;

      const nowMin = minutesInZone(now, profile.timezone);
      const today = dateInZone(now, profile.timezone);

      // Nothing is ever said before the person's day begins.
      if (nowMin < profile.day_start_min) continue;

      const [{ data: blockRows }, { data: threadRows }] = await Promise.all([
        admin.from("blocks").select("*").eq("user_id", userId).eq("day", today),
        admin.from("threads").select("*").eq("user_id", userId),
      ]);

      const result = layout((blockRows ?? []).map(toBlock), {
        nowMin,
        dayStartMin: profile.day_start_min,
        dayEndMin: profile.day_end_min,
      });

      const threadNames = new Map(
        (threadRows ?? []).map((r) => {
          const t = toThread(r);
          return [t.id, t.name] as const;
        }),
      );

      const payloads = decideNotifications(
        result,
        {
          nowMin,
          dayStartMin: profile.day_start_min,
          dayEndMin: profile.day_end_min,
          eveningReviewMin: profile.evening_review_min,
          dayConfirmed: profile.day_confirmed_on === today,
          notifyLive: profile.notify_live,
          notifyLeadMin: profile.notify_lead_min,
          quietFromMin: profile.quiet_from_min,
          quietToMin: profile.quiet_to_min,
          requireConfirm: profile.require_confirm,
        },
        threadNames,
      );

      const { data: states } = await admin
        .from("notification_state")
        .select("tag, content_hash, sent_at")
        .eq("user_id", userId);
      const seen = new Map(
        (states ?? []).map((s) => [s.tag, s.content_hash] as const),
      );

      /* Anything whose text is unchanged is not news. Filtering it out before
         the throttle matters: an unchanged payload is not an interruption and
         must not spend the budget that a genuinely new one needs. */
      const fresh = payloads.filter(
        (p) => seen.get(p.tag) !== contentHash(p),
      );

      /* Everything except the live card arrives with a sound, so everything
         except the live card is rationed. */
      const audible = (states ?? [])
        .filter((s) => s.tag !== LIVE_TAG)
        .map((s) => ({ tag: s.tag, sentAt: new Date(s.sent_at).getTime() }));

      const { send, held } = applyThrottle(fresh, audible, now.getTime());
      report.skipped += payloads.length - fresh.length;
      report.held += held.length;

      for (const payload of send) {
        const hash = contentHash(payload);

        let delivered = false;
        for (const sub of userSubs) {
          const outcome = await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            origin,
          );

          if (outcome === "ok") {
            delivered = true;
            await admin
              .from("push_subscriptions")
              .update({ last_ok_at: now.toISOString(), fail_count: 0 })
              .eq("id", sub.id);
          } else if (outcome === "gone") {
            // The app was uninstalled or the browser dropped the endpoint.
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
            report.pruned += 1;
          } else {
            await admin
              .from("push_subscriptions")
              .update({ fail_count: sub.fail_count + 1 })
              .eq("id", sub.id);
          }
        }

        // Only remember what actually landed, so a transient failure retries
        // on the next tick instead of being silently swallowed.
        if (delivered) {
          report.sent += 1;
          await admin.from("notification_state").upsert(
            {
              user_id: userId,
              tag: payload.tag,
              content_hash: hash,
              sent_at: now.toISOString(),
            },
            { onConflict: "user_id,tag" },
          );
        }
      }
    } catch (err) {
      // One person's bad data must never stop everyone else's reminders.
      report.errors.push(
        `${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return NextResponse.json(report);
}
