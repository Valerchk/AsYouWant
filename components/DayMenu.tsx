"use client";

import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { Sheet } from "@/components/Sheet";
import { Icon, type IconName } from "@/components/icons/Icon";

/* ==========================================================================
   Everything that is not the day, named in words.
   --------------------------------------------------------------------------
   The header used to carry four unlabelled glyphs in a row: a cut cable, a
   grid, a pair of end marks, and a moon. Three of them were guesses even for
   somebody who had used the app for a week, and the third was worse than a
   guess — settings wore the icon that means "how long a block is", because
   the set had no gear in it.

   An icon earns its silence when it appears in exactly one place and does one
   thing forever: the tab bar, the send button, the marker on a block. A row
   of destinations is not that. So the destinations get a sentence each, and
   the header keeps the two controls that are genuinely used every day.
   ========================================================================== */

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenTemplates: () => void;
}

export function DayMenu({ open, onClose, onOpenTemplates }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <Sheet label="More" onClose={onClose}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="display text-lede text-deep">More</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-faint transition-colors hover:text-ink"
            >
              <Icon name="close" size={17} />
            </button>
          </div>

          <div className="mt-4">
            <Row
              href="/review"
              icon="crossSection"
              title="Evening review"
              says="Where the day actually went"
              onNavigate={onClose}
            />
            <Row
              icon="template"
              title="Day templates"
              says="Lay out a usual day in one tap"
              onClick={() => {
                onClose();
                onOpenTemplates();
              }}
            />
            <Row
              href="/settings"
              icon="gear"
              title="Settings"
              says="Your hours, reminders, calendar, export"
              onNavigate={onClose}
            />
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */

function Row({
  href,
  icon,
  title,
  says,
  onClick,
  onNavigate,
}: {
  href?: string;
  icon: IconName;
  title: string;
  says: string;
  onClick?: () => void;
  onNavigate?: () => void;
}) {
  const body = (
    <>
      <Icon name={icon} size={19} className="mt-0.5 shrink-0 text-faint" />
      <span className="min-w-0 flex-1">
        <span className="block text-base text-ink">{title}</span>
        <span className="block text-micro text-faint">{says}</span>
      </span>
      <Icon name="chevron" size={14} className="mt-1 shrink-0 text-faint" />
    </>
  );

  const shell =
    "flex w-full items-start gap-3.5 border-b border-grid py-4 text-left transition-colors hover:bg-sunk";

  return href ? (
    <Link href={href} onClick={onNavigate} className={shell}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={shell}>
      {body}
    </button>
  );
}
