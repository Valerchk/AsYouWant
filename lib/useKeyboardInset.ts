"use client";

import { useEffect } from "react";

/* ==========================================================================
   How much of the screen the on-screen keyboard is covering, as `--kb`.
   --------------------------------------------------------------------------
   The composer and the tab bar are both pinned to the bottom of the window.
   On a phone that bottom moves, and the platforms disagree about how:

     · Chrome/Android, given `interactive-widget=resizes-content`, shrinks the
       layout viewport. `position: fixed` then lands above the keyboard by
       itself and this hook measures nothing, which is correct.
     · iOS leaves the layout viewport alone and shrinks only the visual one,
       so a fixed footer sits behind the keyboard unless something moves it.

   One number covers both: how far the visual viewport's bottom edge is above
   the layout viewport's. It is zero exactly when there is no keyboard.

   The bug this exists to kill is the closing half. iOS keeps reporting the
   shrunken viewport for a beat after the keyboard begins to retract, so a
   single measurement taken when the field loses focus records a keyboard that
   is already gone — and the bar stays stranded in mid-air with a strip of
   empty screen beneath it until something else forces a re-measure. So a blur
   does not measure once; it holds the inset at zero for as long as nothing is
   focused, and keeps checking while the animation plays out.
   ========================================================================== */

/** Below this, it is the URL bar or an accessory strip, not a keyboard. */
export const KEYBOARD_FLOOR = 80;

/**
 * How far the visual viewport's bottom edge sits above the layout viewport's.
 *
 * Pure, and separated from the hook because this is where the bug lived: a
 * value that goes slightly negative (iOS overscroll), or that reports the
 * eighty pixels of a collapsing URL bar, will move a pinned footer for no
 * reason — and a value that fails to return to zero strands it.
 *
 * Returns 0 whenever there is no keyboard, which is also what it returns on a
 * browser that shrinks the layout viewport itself: there, both heights fall
 * together and nothing needs moving.
 */
export function keyboardInset(
  innerHeight: number,
  viewportHeight: number,
  offsetTop: number,
): number {
  const covered = innerHeight - viewportHeight - offsetTop;
  return covered > KEYBOARD_FLOOR ? Math.round(covered) : 0;
}

/** How long to keep re-reading after focus leaves a field. */
const SETTLE_MS = 700;
const SETTLE_STEP_MS = 60;

function isTyping(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable
  );
}

export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    let frame = 0;
    let settling: ReturnType<typeof setTimeout> | undefined;
    let last = -1;

    const write = (px: number) => {
      if (px === last) return;
      last = px;
      root.style.setProperty("--kb", `${px}px`);
    };

    const measure = () => {
      write(keyboardInset(window.innerHeight, vv.height, vv.offsetTop));
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const settle = () => {
      clearTimeout(settling);
      const started = Date.now();
      const again = () => {
        // Focus may simply be moving to the next field, in which case the
        // keyboard never left and the measurement is the right answer.
        if (isTyping()) measure();
        else write(0);
        if (Date.now() - started < SETTLE_MS) {
          settling = setTimeout(again, SETTLE_STEP_MS);
        }
      };
      again();
    };

    measure();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", settle);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("pageshow", schedule);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settling);
      root.style.removeProperty("--kb");
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", settle);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("pageshow", schedule);
    };
  }, []);
}
