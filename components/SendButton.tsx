"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/icons/Icon";

/* The button that was missing.

   Every field in the app used to commit only on the keyboard's return key,
   which on a phone is an unlabelled tick in the corner — nothing on screen
   said the text would be kept. This sits inside the field, on the side the
   thumb is already on, and dims rather than disappears when there is nothing
   to send, so the field never changes shape as you type. */

export function SendButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="submit"
      disabled={disabled}
      aria-label={label}
      className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-edge transition-colors disabled:cursor-default"
      style={{
        background: disabled ? "transparent" : "var(--color-accent)",
        color: disabled ? "var(--color-faint)" : "var(--color-paper)",
      }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
    >
      <Icon name="arrowUp" size={17} />
    </motion.button>
  );
}
