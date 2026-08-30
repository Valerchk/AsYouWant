"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

/* Shown when a store cannot answer. The two cases people actually hit are a
   signed-out session and a database that is not reachable, so the message
   names both rather than saying "something went wrong". */

export function LoadFailure({
  what,
  message,
}: {
  what: string;
  message: string;
}) {
  const signedOut = /not signed in|jwt|session/i.test(message);

  return (
    <main className="chrome mx-auto max-w-2xl px-6 pt-16">
      <div className="flex items-center gap-2 text-over">
        <Icon name="overflow" size={16} />
        <h1 className="text-lede text-deep">Could not load {what}</h1>
      </div>

      <p className="mt-3 text-base text-ink">
        {signedOut
          ? "Your session has expired. Signing in again will bring everything back — nothing is lost."
          : "The database did not answer. Your data is safe; this is a connection problem."}
      </p>

      <p className="num mt-4 text-micro text-faint">{message}</p>

      <div className="mt-6 flex gap-3">
        {signedOut && (
          <Link
            href="/login"
            className="rounded-edge bg-accent-soft px-4 py-2.5 text-fine text-accent ring-1 ring-accent/30 transition-shadow hover:shadow-lift"
          >
            Sign in
          </Link>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-edge px-4 py-2.5 text-fine text-ink ring-1 ring-rule transition-colors hover:bg-sunk"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
