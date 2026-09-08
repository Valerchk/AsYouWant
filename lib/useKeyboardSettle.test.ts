import { describe, expect, it } from "vitest";
import { restingScrollTop } from "./useKeyboardSettle";

/* The one piece of arithmetic in the keyboard fix, and the one the whole
   diagnosis rests on: a page parked past the end of its own content is what
   leaves the bottom bars stranded, and visiting another screen only helped
   because a route change resets the scroll.

   Sizes are an iPhone 14 Pro: 852 points of window. */

describe("restingScrollTop", () => {
  it("leaves an ordinary scroll position alone", () => {
    expect(restingScrollTop(400, 2000, 852)).toBe(400);
  });

  it("pulls a page back that is parked past its own end", () => {
    // The composer shrank while the keyboard was up, so the document lost
    // height under a page iOS had already scrolled down. 1400 − 852 = 548.
    expect(restingScrollTop(900, 1400, 852)).toBe(548);
  });

  it("rests at zero when there is nothing to scroll", () => {
    expect(restingScrollTop(0, 800, 852)).toBe(0);
    expect(restingScrollTop(120, 800, 852)).toBe(0);
  });

  it("refuses a negative offset, which iOS overscroll reports", () => {
    expect(restingScrollTop(-40, 2000, 852)).toBe(0);
  });

  it("is a no-op at the exact bottom", () => {
    expect(restingScrollTop(1148, 2000, 852)).toBe(1148);
  });
});
