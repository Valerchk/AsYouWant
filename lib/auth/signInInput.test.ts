import { describe, expect, it } from "vitest";
import { readSignInInput } from "./signInInput";

const LINK =
  "https://abc.supabase.co/auth/v1/verify?token=pkce_9f2c1d4b8a7e6f5c0b3a2d1e&type=magiclink&redirect_to=https%3A%2F%2Fasyouwant.app%2Fauth%2Fcallback";

describe("readSignInInput", () => {
  it("reads the token hash out of the emailed link", () => {
    expect(readSignInInput(LINK)).toEqual({
      kind: "hash",
      tokenHash: "pkce_9f2c1d4b8a7e6f5c0b3a2d1e",
      type: "magiclink",
    });
  });

  it("keeps the link's own type, so a new account verifies as a signup", () => {
    const signup = LINK.replace("type=magiclink", "type=signup");
    expect(readSignInInput(signup)).toMatchObject({ type: "signup" });
  });

  it("falls back to magiclink when the link names a type we do not know", () => {
    const odd = LINK.replace("type=magiclink", "type=teleport");
    expect(readSignInInput(odd)).toMatchObject({ type: "magiclink" });
  });

  it("accepts the newer token_hash spelling", () => {
    const url = "https://abc.supabase.co/auth/v1/verify?token_hash=abcdef123456&type=email";
    expect(readSignInInput(url)).toEqual({
      kind: "hash",
      tokenHash: "abcdef123456",
      type: "email",
    });
  });

  it("survives being pasted out of a mail client", () => {
    // Surrounding prose, angle brackets and a full stop are all the mail's.
    const pasted = `  Follow the link below to sign in: <${LINK}>. `;
    expect(readSignInInput(pasted)).toMatchObject({
      tokenHash: "pkce_9f2c1d4b8a7e6f5c0b3a2d1e",
    });
  });

  it("recognises six digits as a code", () => {
    expect(readSignInInput(" 483920 ")).toEqual({ kind: "code", token: "483920" });
  });

  it("does not mistake a five- or seven-digit number for a code", () => {
    expect(readSignInInput("48392").kind).toBe("unknown");
    expect(readSignInInput("4839201").kind).toBe("unknown");
  });

  it("names a link that has already been followed, rather than failing blankly", () => {
    // The token is spent by then, so the person needs different advice: copy
    // the link next time instead of tapping it.
    expect(readSignInInput("https://asyouwant.app/auth/callback?code=abc123&next=/today"))
      .toEqual({ kind: "spent" });
    expect(readSignInInput("https://asyouwant.app/#access_token=ey.J&expires_in=3600"))
      .toEqual({ kind: "spent" });
  });

  it("takes a bare hash for anyone who copied only that", () => {
    expect(readSignInInput("pkce_9f2c1d4b8a7e6f5c0b3a2d1e")).toEqual({
      kind: "hash",
      tokenHash: "pkce_9f2c1d4b8a7e6f5c0b3a2d1e",
      type: "magiclink",
    });
  });

  it("refuses a short word that happens to look like a token", () => {
    expect(readSignInInput("hello").kind).toBe("unknown");
    expect(readSignInInput("").kind).toBe("unknown");
    expect(readSignInInput("   ").kind).toBe("unknown");
  });

  it("refuses a URL with nothing redeemable in it", () => {
    expect(readSignInInput("https://asyouwant.app/today").kind).toBe("unknown");
  });
});
