/* ==========================================================================
   Reading whatever arrived in the mail.
   --------------------------------------------------------------------------
   An app installed to a Home Screen is its own browser container. Tapping the
   link in the mail opens Safari, which is a different container with none of
   the state the sign-in needs — so the link can sign in Safari and never the
   app you are holding. That is structural; no amount of care with the link
   changes it.

   What can be moved between containers is the token itself. Supabase's email
   link is `/auth/v1/verify?token=<hash>&type=magiclink&redirect_to=…`, and
   that hash can be redeemed directly with `verifyOtp({ token_hash })` — no
   PKCE verifier, no cookie, nothing that has to have been there beforehand.
   So the instruction becomes "copy the link instead of tapping it", and the
   app finishes the job itself.

   Editing the mail to carry six digits instead would be tidier, and this
   accepts those too — but that needs custom SMTP on Supabase, and an app
   should not be unusable until its owner has arranged a mail provider.
   ========================================================================== */

/** The email OTP kinds Supabase can put in a link. */
export type OtpType = "magiclink" | "signup" | "email" | "recovery" | "invite";

export type SignInInput =
  /** Six digits typed by hand, redeemed against the address. */
  | { kind: "code"; token: string }
  /** A token hash lifted out of the emailed link. */
  | { kind: "hash"; tokenHash: string; type: OtpType }
  /** A link that has already been followed once, so its token is spent. */
  | { kind: "spent" }
  | { kind: "unknown" };

const TYPES: OtpType[] = ["magiclink", "signup", "email", "recovery", "invite"];

/** Long enough that no ordinary word is mistaken for one. */
const MIN_HASH = 20;

function asType(raw: string | null): OtpType {
  return TYPES.includes(raw as OtpType) ? (raw as OtpType) : "magiclink";
}

/**
 * Work out what someone pasted.
 *
 * Deliberately forgiving about the wrapping: people paste the whole line out
 * of a mail client, spaces, angle brackets and all.
 */
export function readSignInInput(raw: string): SignInInput {
  const text = raw.trim();
  if (!text) return { kind: "unknown" };

  if (/^\d{6}$/.test(text)) return { kind: "code", token: text };

  // A URL anywhere inside whatever was pasted. Trailing punctuation is the
  // mail client's, not the link's.
  const found = /https?:\/\/[^\s<>"']+/.exec(text);
  if (found) {
    let url: URL;
    try {
      url = new URL(found[0].replace(/[.,)\]]+$/, ""));
    } catch {
      return { kind: "unknown" };
    }

    const hash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
    if (hash) {
      return { kind: "hash", tokenHash: hash, type: asType(url.searchParams.get("type")) };
    }

    // The address we redirect to after Supabase has verified. Seeing this
    // means the link was tapped rather than copied, and its token is gone.
    if (url.searchParams.has("code") || url.hash.includes("access_token")) {
      return { kind: "spent" };
    }
    return { kind: "unknown" };
  }

  // A bare hash, for anyone who copied only the interesting part.
  if (/^[A-Za-z0-9._-]+$/.test(text) && text.length >= MIN_HASH) {
    return { kind: "hash", tokenHash: text, type: "magiclink" };
  }

  return { kind: "unknown" };
}
