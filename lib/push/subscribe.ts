/* Client-side push enrolment. Every step here has an iOS-specific way of
   failing quietly, so each one reports what actually went wrong rather than
   returning a bare boolean. */

export type EnrolResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "needs-install" | "denied" | "failed";
      detail?: string;
    };

/** iOS only exposes push to web apps launched from the Home Screen. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own pre-standard flag, still the reliable one on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac; the touch point count gives it away.
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID keys travel as base64url; PushManager wants raw bytes.
    Backed by an explicit ArrayBuffer because BufferSource does not accept a
    Uint8Array that might sit on a SharedArrayBuffer. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Must be called directly from a user gesture. Safari rejects a permission
 * prompt that did not originate from a tap, and it does so silently.
 */
export async function enrolForPush(): Promise<EnrolResult> {
  if (!pushSupported()) {
    // On iOS the API surface is simply absent until the app is installed, so
    // "unsupported" there almost always means "not on the Home Screen yet".
    return { ok: false, reason: isIOS() ? "needs-install" : "unsupported" };
  }
  if (isIOS() && !isStandalone()) {
    return { ok: false, reason: "needs-install" };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "failed", detail: "missing VAPID key" };

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Required by every browser: no silent-only push subscriptions.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!res.ok) {
      return { ok: false, reason: "failed", detail: `server ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
