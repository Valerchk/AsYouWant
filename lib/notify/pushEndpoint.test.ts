import { describe, it, expect } from "vitest";
import { isPushService } from "./pushEndpoint";

describe("endpoints the scheduler is allowed to call", () => {
  it("accepts the real push services", () => {
    for (const url of [
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://web.push.apple.com/QLMd9",
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://android.googleapis.com/gcm/send/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ]) {
      expect(isPushService(url), url).toBe(true);
    }
  });

  it("refuses anything that is not one", () => {
    for (const url of [
      "https://example.com/collect",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/internal",
      "http://fcm.googleapis.com/fcm/send/abc", // not https
      "file:///etc/passwd",
      "not a url at all",
      "",
    ]) {
      expect(isPushService(url), url).toBe(false);
    }
  });

  it("is not fooled by a lookalike suffix", () => {
    // The bug a bare endsWith() check would have: the dot is what makes it a
    // subdomain rather than a string that merely ends the same way.
    expect(isPushService("https://push.apple.com.attacker.net/x")).toBe(false);
    expect(isPushService("https://notfcm.googleapis.com/x")).toBe(false);
    expect(isPushService("https://a.b.push.apple.com/x")).toBe(true);
  });
});
