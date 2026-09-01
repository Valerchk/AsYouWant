"use client";

import { useCallback, useRef, useState } from "react";

/**
 * The live height of an element.
 *
 * The composer is pinned over the day and changes height as it is used: chips
 * appear when there is something to describe, a panel opens, a goal is being
 * named. A page whose bottom padding is a fixed guess is therefore wrong
 * almost always — too small and the last block hides behind the field, too
 * large and the day ends in a slab of nothing. Measuring is the only way to
 * be right at both extremes.
 *
 * The ref is a callback so it works the first time the element mounts as well
 * as every time it resizes; an effect keyed on a ref object would miss the
 * mount and report zero until something else re-rendered.
 */
export function useMeasuredHeight<T extends HTMLElement>(): [
  (node: T | null) => void,
  number,
] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    if (!node) return;

    setHeight(node.getBoundingClientRect().height);

    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(([entry]) => {
      setHeight(entry.target.getBoundingClientRect().height);
    });
    observer.current.observe(node);
  }, []);

  return [ref, height];
}
