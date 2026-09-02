"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ==========================================================================
   Signing in from a Home Screen icon.
   --------------------------------------------------------------------------
   An installed app is its own browser container, with its own storage. That
   one fact broke the whole flow, and it broke it structurally rather than
   occasionally:

     · asking for a link stores a PKCE verifier inside the installed app
     · the mail app opens the link in Safari, a different container
     · Safari has no verifier, so the exchange fails: "link is invalid"
     · three attempts later the address is rate-limited and you are locked
       out of your own account with nothing on screen explaining why

   No amount of care with the link fixes that; the handoff between containers
   is the problem. A code does not have to be handed anywhere. You read six
   digits out of your mail and type them into the app you are already standing
   in, and the app you sign into is the one you were using.

   The link still works, and still makes sense on a laptop where the mail and
   the browser are the same session. It is simply no longer the only door.
   ========================================================================== */

type Stage = "email" | "sending" | "code" | "verifying";

const ERRORS: Record<string, string> = {
  expired: "That link has expired, or it opened in a different browser than the one you asked from. Send a fresh code and type it in here.",
  missing_code: "That link arrived incomplete. Send a fresh code and type it in here.",
};

/** Long enough that Supabase's own limiter is never the thing you meet. */
const RESEND_SECONDS = 60;

const CODE_LENGTH = 6;

/** Supabase says how long to wait; use its number rather than guessing. */
function waitFrom(message: string): number | null {
  const m = /after (\d+) seconds?/i.exec(message);
  return m ? Number(m[1]) : null;
}

function LoginForm() {
  const params = useSearchParams();
  // Never follow an absolute URL from the query string: that turns sign-in
  // into an open redirect. Same rule the callback route applies.
  const requested = params.get("next") ?? "/today";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/today";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [message, setMessage] = useState(ERRORS[params.get("error") ?? ""] ?? "");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const send = useCallback(
    async (address: string) => {
      setStage("sending");
      setMessage("");

      const supabase = createClient();
      const redirect = new URL("/auth/callback", window.location.origin);
      redirect.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: redirect.toString() },
      });

      if (error) {
        const wait = waitFrom(error.message);
        if (wait !== null || error.status === 429) {
          setCooldown(wait ?? RESEND_SECONDS);
          setMessage(
            `Too many requests for this address. Try again in ${wait ?? RESEND_SECONDS} seconds — the codes already sent still work.`,
          );
        } else {
          setMessage(error.message);
        }
        // Back to the code screen if one was already sent, so an old code can
        // still be used while the limiter cools off.
        setStage(code || cooldown > 0 ? "code" : "email");
        return;
      }

      setCooldown(RESEND_SECONDS);
      setStage("code");
      requestAnimationFrame(() => codeRef.current?.focus());
    },
    [next, code, cooldown],
  );

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length !== CODE_LENGTH) return;

    setStage("verifying");
    setMessage("");

    const supabase = createClient();
    const address = email.trim();

    /* Two types, because Supabase sends two different mails. An address it
       already knows gets a magic-link code, which verifies as "email"; an
       address signing up for the first time gets a confirmation code, which
       verifies as "signup". Nothing on this screen can tell which you are, and
       guessing wrong reads to the person as a code that simply does not work. */
    let { error } = await supabase.auth.verifyOtp({
      email: address,
      token,
      type: "email",
    });
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: address,
        token,
        type: "signup",
      });
      if (!retry.error) error = null;
    }

    if (error) {
      setStage("code");
      setMessage(
        error.status === 403 || /expired|invalid/i.test(error.message)
          ? "That code did not match, or it has expired. Check the newest mail, or send a fresh one."
          : error.message,
      );
      return;
    }

    // A full navigation rather than a client route change: the session lives
    // in cookies, and the proxy has to see them before it decides anything.
    window.location.assign(next);
  }

  const digits = code.replace(/\D/g, "");

  return (
    <AnimatePresence mode="wait">
      {stage === "code" || stage === "verifying" ? (
        <motion.form
          key="code"
          onSubmit={verify}
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
            A six-digit code is on its way to{" "}
            <span className="num text-deep">{email}</span>.
          </p>

          <label
            htmlFor="code"
            className="mt-8 mb-2 block text-micro tracking-[0.18em] text-faint uppercase"
          >
            The code
          </label>
          <input
            id="code"
            ref={codeRef}
            // `one-time-code` is what makes iOS offer the digits above the
            // keyboard the moment the mail arrives — no switching apps at all.
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            enterKeyHint="go"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            aria-label="Six-digit sign-in code"
            className="num w-full rounded-edge bg-sunk px-3.5 py-3.5 text-center text-title tracking-[0.4em] text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/40 focus:shadow-lift focus:ring-accent/40"
          />

          {message && (
            <p className="mt-3 text-fine leading-6 text-over" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={stage === "verifying" || digits.length !== CODE_LENGTH}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-edge bg-accent py-3.5 text-base text-paper transition-shadow hover:shadow-lift disabled:opacity-40 disabled:shadow-none"
          >
            {stage === "verifying" ? "Signing in…" : "Sign in"}
            {stage !== "verifying" && <Icon name="chevron" size={15} />}
          </button>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={() => void send(email.trim())}
              className="num text-fine text-faint underline decoration-rule underline-offset-4 transition-colors hover:text-ink disabled:no-underline disabled:opacity-60"
            >
              {cooldown > 0 ? `Send another in ${cooldown}s` : "Send another"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
                setMessage("");
              }}
              className="text-fine text-faint underline decoration-rule underline-offset-4 transition-colors hover:text-ink"
            >
              Use a different address
            </button>
          </div>

          <p className="mt-7 text-micro leading-5 text-faint">
            The same mail carries a link. Typing the code is the reliable way
            when the app is on your Home Screen — a tapped link opens in Safari,
            which signs in Safari rather than the app you are holding.
          </p>
        </motion.form>
      ) : (
        <motion.form
          key="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) void send(email.trim());
          }}
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
            No password to forget. We mail you a six-digit code, you type it
            here, you&rsquo;re in.
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
            <p className="mt-3 text-fine leading-6 text-over" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={stage === "sending" || !email.trim() || cooldown > 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-edge bg-accent py-3.5 text-base text-paper transition-shadow hover:shadow-lift disabled:opacity-40 disabled:shadow-none"
          >
            {stage === "sending"
              ? "Sending…"
              : cooldown > 0
                ? `Wait ${cooldown}s`
                : "Send the code"}
            {stage !== "sending" && cooldown === 0 && (
              <Icon name="chevron" size={15} />
            )}
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
