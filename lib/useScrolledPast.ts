"use client";

import { useCallback, useRef, useState } from "react";

/**
 * True once the element it is attached to has scrolled off the top.
 *
 * An IntersectionObserver rather than a scroll listener: a scroll handler on a
 * page that is mostly one long ribbon fires on every frame of every flick, and
 * this needs to know one bit of information twice a day.
 *
 * The ref is a callback so it works the first time the element mounts as well
 * as after any remount; an effect keyed on a ref object would miss the mount
 * and report false until something else re-rendered.
 */
export function useScrolledPast<T extends HTMLElement>(): [
  (node: T | null) => void,
  boolean,
] {
  const [past, setPast] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;

    observer.current = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting),
      // Nothing counts as gone until it is genuinely above the top edge.
      { threshold: 0, rootMargin: "0px 0px 0px 0px" },
    );
    observer.current.observe(node);
  }, []);

  return [ref, past];
}
