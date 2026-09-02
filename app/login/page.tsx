"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { readSignInInput, type OtpType } from "@/lib/auth/signInInput";
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
   is the problem. What can cross is the token inside the link. Supabase's mail
   points at `/auth/v1/verify?token=<hash>`, and that hash redeems directly
   with `verifyOtp({ token_hash })` — no verifier, no cookie, nothing that had
   to be there first. So the link is not tapped, it is copied, and the app
   finishes the sign-in in its own container.

   Six digits would be nicer than copying a link, and this field takes those
   too — but putting them in the mail needs custom SMTP on Supabase, and the
   app must not be unusable until its owner has arranged a mail provider.

   The link still works by tapping on a laptop, where the mail and the browser
   are the same session. It is simply no longer the only door.
   ========================================================================== */

type Stage = "email" | "sending" | "code" | "verifying";

const ERRORS: Record<string, string> = {
  expired:
    "That link opened in a different browser from the one that asked for it — which is what happens when an app lives on the Home Screen. Send a fresh one, then copy the link instead of tapping it.",
  missing_code:
    "That link arrived incomplete. Send a fresh one, then copy the link instead of tapping it.",
};

/** Long enough that Supabase's own limiter is never the thing you meet. */
const RESEND_SECONDS = 60;

/** Supabase says how long to wait; use its number rather than guessing. */
function waitFrom(message: string): number | null {
  const m = /after (\d+) seconds?/i.exec(message);
  return m ? Number(m[1]) : null;
}

/** One numbered line of the two-step instruction. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-plate bg-sunk text-micro text-faint ring-1 ring-rule">
        {n}
      </span>
      <span className="text-fine leading-5 text-ink">{children}</span>
    </li>
  );
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
  /** Whatever came out of the mail: a pasted link, or a typed code. */
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
    const parsed = readSignInInput(code);

    if (parsed.kind === "spent") {
      setMessage(
        "That link has already been opened, so its token is used up. In the mail, hold the link and choose Copy rather than tapping it — then paste it here.",
      );
      return;
    }
    if (parsed.kind === "unknown") {
      setMessage(
        "That is neither a sign-in link nor a six-digit code. Copy the whole link out of the mail and paste it here.",
      );
      return;
    }

    setStage("verifying");
    setMessage("");

    const supabase = createClient();
    const address = email.trim();

    /* A hash carries its own type; a typed code does not, and Supabase sends
       two different mails. An address it already knows gets a magic-link code,
       which verifies as "email"; an address signing up for the first time gets
       a confirmation code, which verifies as "signup". Nothing on this screen
       can tell which you are, and guessing wrong reads to the person as a code
       that simply does not work — so try both. */
    const attempts: OtpType[] =
      parsed.kind === "hash" ? [parsed.type, "signup", "email"] : ["email", "signup"];

    let failure: string | null = null;
    for (const type of attempts) {
      const { error } =
        parsed.kind === "hash"
          ? await supabase.auth.verifyOtp({ token_hash: parsed.tokenHash, type })
          : await supabase.auth.verifyOtp({
              email: address,
              token: parsed.token,
              type: type as "email" | "signup",
            });

      if (!error) {
        // A full navigation rather than a client route change: the session
        // lives in cookies, and the proxy must see them before it decides.
        window.location.assign(next);
        return;
      }
      failure = error.message;
      // A token that is genuinely spent or expired will not become valid under
      // a different name, so stop rather than burning the rate limit.
      if (/expired|already|used/i.test(error.message)) break;
    }

    setStage("code");
    setMessage(
      failure && !/invalid/i.test(failure)
        ? failure
        : "That link or code did not work — they expire quickly and can only be used once. Send a fresh one.",
    );
  }

  /** Reads the clipboard on a tap, which is the gesture iOS requires. */
  async function pasteIn() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setCode(text.trim());
        setMessage("");
        return;
      }
      setMessage("The clipboard is empty. Copy the link from the mail first.");
    } catch {
      setMessage("Could not read the clipboard. Paste into the field instead.");
    }
  }

  const ready = readSignInInput(code).kind !== "unknown";

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
            A sign-in link is on its way to{" "}
            <span className="num text-deep">{email}</span>.
          </p>

          {/* Three lines, because the one instruction that matters is
              counter-intuitive: do not tap the thing that looks tappable.
              Tapping opens Safari, and Safari is not this app. */}
          <ol className="mt-6 space-y-2.5">
            <Step n={1}>
              In the mail, <b className="text-deep">hold</b> the link and choose{" "}
              <b className="text-deep">Copy</b> — do not tap it.
            </Step>
            <Step n={2}>Come back here and paste it below.</Step>
          </ol>

          <label
            htmlFor="code"
            className="mt-7 mb-2 block text-micro tracking-[0.18em] text-faint uppercase"
          >
            The link
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              ref={codeRef}
              // `one-time-code` costs nothing here and lights up the keyboard
              // strip the day the mail carries six digits instead.
              autoComplete="one-time-code"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the link, or a 6-digit code"
              aria-label="The sign-in link from your mail, or a six-digit code"
              className="num min-w-0 flex-1 truncate rounded-edge bg-sunk px-3.5 py-3.5 text-fine text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/50 focus:shadow-lift focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={() => void pasteIn()}
              className="shrink-0 rounded-edge px-3.5 text-fine text-ink ring-1 ring-rule transition-colors hover:bg-sunk"
            >
              Paste
            </button>
          </div>

          {message && (
            <p className="mt-3 text-fine leading-6 text-over" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={stage === "verifying" || !ready}
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
            On a computer you can simply tap the link. On a phone, an app kept
            on the Home Screen is a separate browser from Safari, so a tapped
            link signs in Safari instead of here — pasting it signs in the app
            you are actually holding.
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
            No password to forget. We mail you a sign-in link, you bring it
            back here, you&rsquo;re in.
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
                : "Send the link"}
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
