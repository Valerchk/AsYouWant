import type { Transition } from "motion/react";

/* One spring for the entire ribbon. Using a single set of constants is what
   makes the day read as one physical object instead of a pile of independently
   animated cards. */
export const RIBBON_SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 34,
  mass: 0.9,
};

/* Slightly softer, for things that appear and disappear rather than travel. */
export const FADE_SPRING: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

/* Column widths shared by the rail, the clock gutter and the now-line so they
   stay locked together. */
export const CLOCK_W = 52;
export const RAIL_W = 26;
