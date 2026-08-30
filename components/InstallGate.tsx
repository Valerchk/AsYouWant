"use client";

import { useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  enrolForPush,
  isIOS,
  isStandalone,
  pushSupported,
  type EnrolResult,
} from "@/lib/push/subscribe";
import { Icon } from "@/components/icons/Icon";

/* ==========================================================================
   The one screen without which this product does not exist on an iPhone.
   --------------------------------------------------------------------------
   iOS delivers web push only to apps launched from the Home Screen. A person
   who never taps Share → Add to Home Screen gets a planner that silently
   never reminds them of anything — and blames the app, correctly.

   So the gate is explicit, it names the exact system gesture, and it draws
   the same glyph they are looking for in the Safari toolbar.
   ========================================================================== */

type Stage = "checking" | "install" | "ask" | "denied" | "done" | "unsupported";

/* What the browser itself reports. Read through useSyncExternalStore rather
   than assigned from an effect: this is external state, and setting it in an
   effect costs a second render on every mount for a value that was already
   knowable. The server snapshot keeps hydration from mismatching. */
const noSubscribe = () => () => {};
const serverStage = (): Stage => "checking";

function detectStage(): Stage {
  if (isIOS() && !isStandalone()) return "install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "granted") return "done";
  if (Notification.permission === "denied") return "denied";
  return "ask";
}

export function InstallGate() {
  const detected = useSyncExternalStore(noSubscribe, detectStage, serverStage);
  // Permission changes only in response to our own button, and the store has
  // no event to subscribe to, so the outcome is held here and wins.
  const [override, setOverride] = useState<Stage | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stage = override ?? detected;

  async function enable() {
    setBusy(true);
    const result: EnrolResult = await enrolForPush();
    setBusy(false);

    if (result.ok) return setOverride("done");
    if (result.reason === "needs-install") return setOverride("install");
    if (result.reason === "denied") return setOverride("denied");
    setOverride("unsupported");
    setDetail(result.detail ?? null);
  }

  if (stage === "checking" || stage === "done") return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="rounded-plate bg-sunk/70 p-4 ring-1 ring-accent/40"
      >
        {stage === "install" && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="bell" size={15} className="text-accent" />
              <h2 className="text-fine text-deep">
                Reminders need one more step
              </h2>
            </div>
            <p className="text-fine text-faint">
              iOS only delivers notifications to web apps that live on the Home
              Screen. Without this, the day runs silently.
            </p>
            <ol className="mt-3 space-y-2 text-fine text-ink">
              <li className="flex items-center gap-2">
                <span className="num text-micro text-faint">1</span>
                Tap
                <Icon name="share" size={15} className="text-accent" />
                in the Safari toolbar
              </li>
              <li className="flex items-center gap-2">
                <span className="num text-micro text-faint">2</span>
                Choose <span className="text-deep">Add to Home Screen</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="num text-micro text-faint">3</span>
                Open As You Want from your Home Screen
              </li>
            </ol>
          </>
        )}

        {stage === "ask" && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="bell" size={15} className="text-accent" />
              <h2 className="text-fine text-deep">Turn on the live card</h2>
            </div>
            <p className="text-fine text-faint">
              One notification that stays on your lock screen and quietly
              rewrites itself as the day moves. Not a stream of alerts.
            </p>
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="mt-3 rounded-edge bg-accent-soft px-3 py-2 text-fine text-accent ring-1 ring-accent/40 transition-all hover:bg-accent-soft hover:shadow-lift disabled:opacity-40"
            >
              {busy ? "Enabling…" : "Enable notifications"}
            </button>
          </>
        )}

        {stage === "denied" && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="bell" size={15} className="text-over" />
              <h2 className="text-fine text-deep">Notifications are blocked</h2>
            </div>
            <p className="text-fine text-faint">
              The browser is holding a &ldquo;no&rdquo; from earlier, and only
              you can lift it: iOS Settings → Notifications → As You Want. The
              planner works without it — it just cannot speak.
            </p>
          </>
        )}

        {stage === "unsupported" && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="bell" size={15} className="text-faint" />
              <h2 className="text-fine text-deep">
                This browser cannot receive reminders
              </h2>
            </div>
            <p className="text-fine text-faint">
              The ribbon works fully; only push is missing. On iPhone, use
              Safari and add the app to your Home Screen.
              {detail && (
                <span className="num mt-1 block text-micro opacity-60">
                  {detail}
                </span>
              )}
            </p>
          </>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
