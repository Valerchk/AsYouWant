"use client";

import { useEffect } from "react";

/* ==========================================================================
   Putting the page down after the keyboard has gone.
   --------------------------------------------------------------------------
   The bottom bars come back to where they belong the moment you visit
   Settings and return. That is the whole diagnosis, and it took two wrong
   answers to hear it: a route change does not touch `position: fixed`, does
   not touch the viewport, and does not touch any variable of ours. What it
   does touch is the scroll offset, which it resets to zero.

   So the displacement is a scroll that was left behind, not a bar that was
   placed wrongly — which is also why both previous attempts made it worse.
   Each of them moved the bars with JavaScript on top of whatever iOS was
   already doing, and two corrections for one displacement put the composer
   off the screen entirely.

   How the page gets stranded: the composer grows and shrinks as you type —
   chips appear, a panel opens — and the page's bottom padding is measured
   from it, so the document genuinely changes height while the keyboard is
   up. iOS has meanwhile scrolled the page to reveal the field. When the
   keyboard retracts, the offset it scrolled to may be past the end of a
   document that is now shorter, and the compositor keeps the fixed layer at
   the old offset until a real scroll reconciles it.

   The fix is therefore a real scroll, and nothing else. No positioning, no
   measured offsets, no CSS variables: this file can only ever ask the browser
   to settle where it already is. If the diagnosis is wrong it does nothing,
   which is the property the previous two attempts lacked.
   ========================================================================== */

/** Under this, the keyboard is gone rather than merely smaller. */
const KEYBOARD_GONE_UNDER_PX = 60;

/** Nudges after the keyboard starts retracting. iOS settles slowly. */
const SETTLE_AT_MS = [60, 250, 600];

/**
 * Where the page should be resting.
 *
 * Clamped, because that is the whole bug: the offset iOS scrolled to in order
 * to show a field can be past the end of a document that has since become
 * shorter, and a page parked beyond its own content is what leaves the fixed
 * bars stranded.
 */
export function restingScrollTop(
  scrollY: number,
  scrollHeight: number,
  innerHeight: number,
): number {
  const furthest = Math.max(0, scrollHeight - innerHeight);
  return Math.min(Math.max(0, scrollY), furthest);
}

function acceptsTyping(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  );
}

function isTyping(): boolean {
  return acceptsTyping(document.activeElement);
}

export function useKeyboardSettle(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const reconcile = () => {
      const target = restingScrollTop(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );

      /* A real movement and back. Scrolling to the offset the page already
         claims to hold is optimised away by every browser, and being asked to
         move is exactly what the stale layer needs. One pixel, in whichever
         direction there is room for. */
      window.scrollTo(0, target === 0 ? 1 : target - 1);
      window.scrollTo(0, target);

      // Reading a layout property forces the synchronous reflow that a page
      // too short to scroll cannot get from the two lines above.
      void document.documentElement.offsetHeight;
    };

    const settle = () => {
      timers.forEach(clearTimeout);
      timers = SETTLE_AT_MS.map((ms) =>
        setTimeout(() => {
          // Focus may simply have moved to the next field, in which case the
          // keyboard never left and there is nothing to put down.
          if (!isTyping()) reconcile();
        }, ms),
      );
    };

    const onViewport = () => {
      if (!vv) return;
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      if (covered > KEYBOARD_GONE_UNDER_PX) return;
      if (isTyping()) return;
      settle();
    };

    /* Only a field losing focus is worth reacting to. Buttons take focus on
       tap in several browsers, and running this on every tap would mean a
       stream of scroll round-trips for a condition that only ever arises
       when a keyboard closes. */
    const onFocusOut = (e: FocusEvent) => {
      if (acceptsTyping(e.target)) settle();
    };

    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("orientationchange", settle);
    vv?.addEventListener("resize", onViewport);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("orientationchange", settle);
      vv?.removeEventListener("resize", onViewport);
    };
  }, []);
}
