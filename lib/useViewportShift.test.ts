import { describe, expect, it } from "vitest";
import { viewportShift, DEAD_ZONE_PX, MAX_DOWN_PX } from "./useViewportShift";

/* The number that decides where the composer and the tab bar sit. Every case
   below is one the bars actually met on a phone. Sizes are an iPhone 14 Pro:
   852 CSS points tall, keyboard about 336. */

describe("viewportShift", () => {
  it("is zero when the two viewports are the same rectangle", () => {
    expect(viewportShift(852, 852, 0)).toBe(0);
  });

  it("moves the bars up by the keyboard's height on iOS", () => {
    expect(viewportShift(852, 516, 0)).toBe(-336);
  });

  it("is zero where the browser shrinks the layout viewport itself", () => {
    // interactive-widget=resizes-content: both fall together, so a bar pinned
    // to the bottom is already above the keyboard and must not move twice.
    expect(viewportShift(516, 516, 0)).toBe(0);
  });

  it("moves the bars back DOWN when the layout viewport is left short", () => {
    // The stranded case: the keyboard has gone and the visible area is full
    // height again, but the layout viewport `bottom` resolves against was
    // never given its last 59 points back, so the dock hangs above the screen.
    // Clamping this to zero is what left it hanging.
    expect(viewportShift(793, 852, 0)).toBe(59);
  });

  it("accounts for a visual viewport pushed down the page", () => {
    expect(viewportShift(852, 516, 100)).toBe(-236);
  });

  it("ignores differences too small to be anything but rounding", () => {
    expect(viewportShift(852, 852 - (DEAD_ZONE_PX - 1), 0)).toBe(0);
    expect(viewportShift(852, 852 + (DEAD_ZONE_PX - 1), 0)).toBe(0);
  });

  it("follows a browser toolbar, which also covers the bottom", () => {
    // Safari's bottom bar is far shorter than a keyboard. Sitting behind it
    // is just as wrong, so there is no floor below which we stop caring.
    expect(viewportShift(852, 801, 0)).toBe(-51);
  });

  it("refuses to push the dock further down than a toolbar's worth", () => {
    // A single bad reading mid-rotation must not fling the bars off-screen.
    expect(viewportShift(400, 900, 0)).toBe(MAX_DOWN_PX);
  });

  it("rounds, because a fractional pixel makes a fixed bar shimmer", () => {
    expect(viewportShift(852, 515.6, 0)).toBe(-336);
  });
});
