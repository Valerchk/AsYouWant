import { describe, expect, it } from "vitest";
import { keyboardInset, KEYBOARD_FLOOR } from "./useKeyboardInset";

/* The number that decides where the composer and the tab bar sit. Every case
   below is one the bars actually met on a phone. */

describe("keyboardInset", () => {
  it("is zero with no keyboard, which is the resting state", () => {
    expect(keyboardInset(844, 844, 0)).toBe(0);
  });

  it("reports the keyboard's height on iOS, where the layout viewport stays", () => {
    // iPhone 14: 844pt tall, keyboard 336pt, layout viewport unchanged.
    expect(keyboardInset(844, 508, 0)).toBe(336);
  });

  it("is zero where the browser shrinks the layout viewport itself", () => {
    // interactive-widget=resizes-content: both fall together, so a bar pinned
    // to the bottom is already above the keyboard and must not be moved twice.
    expect(keyboardInset(508, 508, 0)).toBe(0);
  });

  it("subtracts the offset when the visual viewport has been pushed down", () => {
    expect(keyboardInset(844, 508, 100)).toBe(236);
  });

  it("ignores a collapsing URL bar rather than jolting the footer", () => {
    expect(keyboardInset(844, 844 - KEYBOARD_FLOOR, 0)).toBe(0);
    expect(keyboardInset(844, 844 - (KEYBOARD_FLOOR + 1), 0)).toBe(
      KEYBOARD_FLOOR + 1,
    );
  });

  it("never returns a negative, which overscroll on iOS can produce", () => {
    // A rubber-banded viewport reports a height larger than the window's; an
    // unclamped value here pushes the bars off the bottom of the screen.
    expect(keyboardInset(844, 900, 0)).toBe(0);
  });

  it("rounds, because a fractional pixel makes a fixed bar shimmer", () => {
    expect(keyboardInset(844, 507.6, 0)).toBe(336);
  });
});
