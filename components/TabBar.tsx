"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { useNotes } from "@/lib/data/useNotes";

/* Bottom tabs, in thumb reach.

   Three, and the third is Goals again — but the reason it was wrong the first
   time is gone. Goals used to be a prerequisite: a block could not be told
   apart from its neighbour, or filed anywhere, until you had been here and
   invented one. Now a block carries its own colour and its own icon, and this
   tab holds only the long view — what a week or a month was actually for. It
   is somewhere you go on Sunday, not somewhere you have to go before Tuesday.

   Fixed rather than sticky, and offset by the same --kb the composer uses, so
   the two bars are one object as far as the keyboard is concerned. As a
   sticky element over a fixed footer they could and did come apart. */

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/today", label: "Today", icon: "flow" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/goals", label: "Goals", icon: "thread" },
];

export function TabBar() {
  const pathname = usePathname();
  // Reads from the same store as the inbox screen, so the badge is right
  // whichever tab you are on.
  const { notes } = useNotes();
  // Only what is still open: a badge that counts finished thoughts never
  // reaches zero, and a badge that never reaches zero stops being read.
  const inboxCount = notes.filter((n) => n.doneAt === null).length;

  return (
    <nav className="tabbar safe-bottom border-t border-rule bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              {/* The indicator slides between tabs rather than blinking out
                  and in — one object moving, which is what makes navigation
                  feel like a place rather than a redraw. */}
              {active && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute inset-x-3 top-0 h-[2px] bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">
                <Icon
                  name={tab.icon}
                  size={19}
                  className={active ? "text-accent" : "text-faint"}
                />
                {tab.href === "/inbox" && inboxCount > 0 && (
                  <span className="num absolute -top-1 -right-2 min-w-[15px] rounded-plate bg-accent px-1 text-center text-[10px] leading-[15px] text-paper">
                    {inboxCount}
                  </span>
                )}
              </span>
              <span
                className={`text-micro leading-none ${
                  active ? "text-accent" : "text-faint"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
