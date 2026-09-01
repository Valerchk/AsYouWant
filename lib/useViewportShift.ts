"use client";

import { useEffect } from "react";

/* ==========================================================================
   Where the bottom of the screen actually is, as `--dock`.
   --------------------------------------------------------------------------
   The composer and the tab bar are pinned to the bottom of the window, and
   `bottom` resolves against the *layout* viewport. On a phone that viewport
   and the one you can actually see are two different rectangles, and they
   come apart in both directions:

     · Keyboard up on iOS: the layout viewport is unchanged while the visual
       one shrinks, so a bar at `bottom: 0` sits behind the keyboard.
     · Keyboard down, afterwards: with `interactive-widget=resizes-content`
       the layout viewport was shrunk to make room, and iOS does not always
       give the space back. The bar is then anchored to a bottom edge that is
       fifty or sixty pixels above the real one, and it hangs there over a
       band of dead screen until something forces a relayout.

   One signed number covers both: how far the visual viewport's bottom edge
   sits from the layout viewport's. Negative means something is covering the
   bottom — move up by that much. Positive means the layout viewport is the
   shorter of the two — move down, which is the stranded case.

   The previous version clamped this to zero and threw the positive half away,
   which is precisely why the bars could get stuck: the only correction that
   would have brought them down was the one being discarded.
   ========================================================================== */

/** Below this the two viewports are the same rectangle; moving would jitter. */
export const DEAD_ZONE_PX = 4;

/**
 * Furthest the bars may be pushed down.
 *
 * Recovering a stranded layout viewport is worth a phone's toolbar height and
 * no more. Without a ceiling, one bad reading during an orientation change
 * would fling the whole dock off the bottom of the screen.
 */
export const MAX_DOWN_PX = 240;

/** How long to keep re-reading after focus moves; iOS settles slowly. */
const SETTLE_MS = 900;
const SETTLE_STEP_MS = 60;

/**
 * How far to move the bottom bars, in CSS pixels.
 *
 * Negative moves them up (a keyboard or a browser toolbar is covering the
 * bottom); positive moves them down (the layout viewport is shorter than what
 * is visible); zero is the resting state.
 */
export function viewportShift(
  innerHeight: number,
  viewportHeight: number,
  offsetTop: number,
): number {
  const shift = viewportHeight + offsetTop - innerHeight;
  if (Math.abs(shift) < DEAD_ZONE_PX) return 0;
  return Math.round(Math.min(MAX_DOWN_PX, shift));
}

export function useViewportShift(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    let frame = 0;
    let settling: ReturnType<typeof setTimeout> | undefined;
    let last: number | null = null;

    const measure = () => {
      const px = viewportShift(window.innerHeight, vv.height, vv.offsetTop);
      if (px === last) return;
      last = px;
      root.style.setProperty("--dock", `${px}px`);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    /* One reading taken the moment focus moves is the wrong reading: the
       keyboard is still on screen and the viewports have not finished
       arguing. Keep asking for a beat, and let the signed measurement above
       be right whichever way it lands. */
    const settle = () => {
      clearTimeout(settling);
      const started = Date.now();
      const again = () => {
        measure();
        if (Date.now() - started < SETTLE_MS) {
          settling = setTimeout(again, SETTLE_STEP_MS);
        }
      };
      again();
    };

    measure();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    // Scrolling is when a mobile browser reconciles its two viewports, so it
    // is also the cheapest moment to notice they had drifted apart.
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("focusin", settle);
    window.addEventListener("focusout", settle);
    // Dismissing the keyboard by tapping the page does not always produce a
    // resize on iOS; a finger lifting off it always does.
    window.addEventListener("pointerup", schedule);
    window.addEventListener("orientationchange", settle);
    window.addEventListener("pageshow", settle);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settling);
      root.style.removeProperty("--dock");
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", settle);
      window.removeEventListener("focusout", settle);
      window.removeEventListener("pointerup", schedule);
      window.removeEventListener("orientationchange", settle);
      window.removeEventListener("pageshow", settle);
    };
  }, []);
}
