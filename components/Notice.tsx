"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/icons/Icon";

/* ==========================================================================
   Something did not save.
   --------------------------------------------------------------------------
   A write failing is not the same event as a screen failing to load, and it
   must not be reported the same way. It used to be: one rejected insert and
   the whole day was replaced by a full-page error, which reads as the app
   crashing and the account being thrown out — while in fact the day was
   intact and a single block had not reached the database.

   So this sits above the composer, says what happened, and leaves everything
   else alone. When the cause is an expired session it offers the one action
   that fixes it, because "sign in again" is not something to make a person
   deduce from a Postgres message.
   ========================================================================== */

/** Postgres refuses a write with no authenticated user by naming the policy. */
const SIGNED_OUT =
  /session has expired|not signed in|jwt|row-level security|row level security/i;

export function Notice({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  const signedOut = message !== null && SIGNED_OUT.test(message);

  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className="overflow-hidden"
          role="alert"
        >
          <div className="mb-2.5 flex items-start gap-2.5 rounded-edge bg-sunk px-3 py-2.5 ring-1 ring-over/40">
            <Icon
              name="overflow"
              size={15}
              className="mt-0.5 shrink-0 text-over"
            />
            <div className="min-w-0 flex-1">
              <p className="text-fine leading-5 text-ink">
                {signedOut
                  ? "That did not save — your session has expired. Signing in again brings everything back; nothing on screen is lost."
                  : "That did not save. The day on screen is unchanged; try again in a moment."}
              </p>
              {!signedOut && (
                <p className="num mt-1 text-micro break-words text-faint">
                  {message}
                </p>
              )}
              {signedOut && (
                <Link
                  href="/login"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-edge bg-accent-soft px-2.5 py-1.5 text-micro text-accent ring-1 ring-accent/30"
                >
                  Sign in
                  <Icon name="chevron" size={11} />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-m-1 shrink-0 p-1 text-faint transition-colors hover:text-ink"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
