"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";

/* Light is the default; dark is there for a dark room, not as a statement.
   The three states cycle: follow the system → light → dark → follow again.

   The chosen value is written to localStorage under THEME_KEY and applied by
   the inline script in app/layout.tsx before first paint. Without that script
   a dark-theme user gets a white flash on every load. */

export type ThemeChoice = "auto" | "light" | "dark";

export const THEME_KEY = "ayw.theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  auto: "light",
  light: "dark",
  dark: "auto",
};

const LABEL: Record<ThemeChoice, string> = {
  auto: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

const GLYPH: Record<ThemeChoice, IconName> = {
  auto: "auto",
  light: "sunrise",
  dark: "moon",
};

function readStored(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

const noSubscribe = () => () => {};
const serverChoice = (): ThemeChoice => "auto";

export function ThemeToggle() {
  const stored = useSyncExternalStore(noSubscribe, readStored, serverChoice);
  const [override, setOverride] = useState<ThemeChoice | null>(null);
  const choice = override ?? stored;

  function cycle() {
    const next = NEXT[choice];
    setOverride(next);

    const root = document.documentElement;
    if (next === "auto") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = next;
    }

    try {
      if (next === "auto") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode. The theme still applies for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[choice]}. Tap to change.`}
      title={LABEL[choice]}
      className="flex h-9 w-9 items-center justify-center rounded-edge text-faint transition-colors hover:bg-sunk hover:text-ink"
    >
      <Icon name={GLYPH[choice]} size={17} />
    </button>
  );
}
