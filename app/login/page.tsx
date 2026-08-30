"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";

type Stage = "idle" | "sending" | "sent" | "error";

const ERRORS: Record<string, string> = {
  expired: "That link has expired. Send a fresh one.",
  missing_code: "That link was incomplete. Send a fresh one.",
};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/today";

  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState(
    ERRORS[params.get("error") ?? ""] ?? "",
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStage("sending");
    setMessage("");

    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect.toString() },
    });

    if (error) {
      setStage("error");
      setMessage(error.message);
      return;
    }
    setStage("sent");
  }

  return (
    <AnimatePresence mode="wait">
      {stage === "sent" ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-edge bg-accent-soft text-accent ring-1 ring-accent/30">
            <Icon name="check" size={20} />
          </div>
          <h1 className="display text-title text-deep">Check your mail</h1>
          <p className="mt-3 text-base leading-7 text-ink">
            A sign-in link is on its way to{" "}
            <span className="num text-deep">{email}</span>.
          </p>
          <p className="mt-3 text-fine leading-6 text-faint">
            Open it on the device you plan to use — the link signs in whichever
            browser opens it. On iPhone, that means opening it in Safari.
          </p>
          <button
            type="button"
            onClick={() => setStage("idle")}
            className="mt-7 text-fine text-faint underline decoration-rule underline-offset-4 transition-colors hover:text-ink"
          >
            Use a different address
          </button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={send}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="w-full max-w-sm"
        >
          <h1 className="display text-display leading-[1.05] text-deep">
            Sign in
          </h1>
          <p className="mt-3 text-base leading-7 text-ink">
            No password to forget. We send a link, you tap it, you&rsquo;re in.
          </p>

          <label
            htmlFor="email"
            className="mt-10 mb-2 block text-micro tracking-[0.18em] text-faint uppercase"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="num w-full rounded-edge bg-sunk px-3.5 py-3.5 text-base text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/60 focus:shadow-lift focus:ring-accent/40"
          />

          {message && (
            <p className="mt-3 text-fine text-over" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={stage === "sending" || !email.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-edge bg-accent py-3.5 text-base text-paper transition-shadow hover:shadow-lift disabled:opacity-40 disabled:shadow-none"
          >
            {stage === "sending" ? "Sending…" : "Send the link"}
            {stage !== "sending" && <Icon name="chevron" size={15} />}
          </button>

          <p className="mt-6 text-micro leading-5 text-faint">
            Your day is yours: every row is scoped to your account in the
            database itself, not merely hidden in the interface.
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top mx-auto flex w-full max-w-4xl items-center justify-between px-6 pt-6">
        <Link href="/" className="display text-lede text-deep">
          As You Want
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>

      <footer className="safe-bottom mx-auto w-full max-w-4xl px-6 pb-6">
        <Link
          href="/"
          className="text-micro text-faint transition-colors hover:text-ink"
        >
          ← Back
        </Link>
      </footer>
    </div>
  );
}
