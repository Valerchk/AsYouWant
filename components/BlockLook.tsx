"use client";

import { Icon } from "@/components/icons/Icon";
import { GoalIcon, GOAL_ICONS, isGoalIcon } from "@/components/icons/GoalIcon";
import { threadColor, THREAD_COLOR_COUNT } from "@/lib/threads";
import type { Look } from "@/lib/blocks/look";

/* ==========================================================================
   How this block looks — colour and icon, on the block itself.
   --------------------------------------------------------------------------
   The same control in the composer and in the block's sheet, so choosing a
   colour is one gesture whether the block is being written or being edited,
   and it looks identical either way.

   Nothing here asks about goals. That was the whole complaint: a block could
   not be told apart from its neighbour until a goal had been invented for it,
   named, and attached — three deliberate acts to answer "make this one
   green". A goal is now a longer thing you keep, on its own tab; this is a
   mark you put on an afternoon.
   ========================================================================== */

interface Props {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  /** The goal's look, shown as the default when the block sets nothing. */
  inherited?: Look;
}

export function BlockLook({ look, onChange, inherited }: Props) {
  // Read once so the type narrowing below survives the optional prop.
  const fromGoal = inherited?.colorIndex ?? null;
  const iconFromGoal = inherited?.icon ?? null;

  return (
    <>
      <Label>Colour</Label>
      <div className="flex flex-wrap gap-2">
        <Swatch
          active={look.colorIndex === null}
          onClick={() => onChange({ colorIndex: null })}
          label={fromGoal === null ? "No colour" : "Goal's colour"}
          colour={fromGoal === null ? null : threadColor(fromGoal)}
        />
        {Array.from({ length: THREAD_COLOR_COUNT }, (_, i) => (
          <Swatch
            key={i}
            active={look.colorIndex === i}
            onClick={() => onChange({ colorIndex: i })}
            label={`Colour ${i + 1}`}
            colour={threadColor(i)}
          />
        ))}
      </div>

      <Label className="mt-4">Icon</Label>
      <div className="flex flex-wrap gap-1.5">
        <Cell
          active={look.icon === null}
          onClick={() => onChange({ icon: null })}
          label={isGoalIcon(iconFromGoal) ? "Goal's icon" : "No icon"}
        >
          {isGoalIcon(iconFromGoal) ? (
            <GoalIcon name={iconFromGoal} size={17} className="opacity-50" />
          ) : (
            <span className="h-[2px] w-3.5 bg-current" />
          )}
        </Cell>
        {GOAL_ICONS.map((name) => (
          <Cell
            key={name}
            active={look.icon === name}
            onClick={() => onChange({ icon: name })}
            label={name}
          >
            <GoalIcon name={name} size={17} />
          </Cell>
        ))}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-2 text-micro tracking-[0.18em] text-faint uppercase ${className}`}
    >
      {children}
    </div>
  );
}

function Swatch({
  active,
  colour,
  label,
  onClick,
}: {
  active: boolean;
  /** Null draws an empty well rather than a colour. */
  colour: string | null;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-edge transition-transform active:scale-90"
      style={{
        background: colour ?? "var(--color-sunk)",
        // Two rings rather than one: paper first, so the mark reads as a
        // selection sitting above the swatch instead of a border drawn on it.
        boxShadow: active
          ? "0 0 0 2px var(--color-paper), 0 0 0 4px var(--color-deep)"
          : colour
            ? undefined
            : "inset 0 0 0 1px var(--color-rule)",
      }}
    >
      {active &&
        (colour ? (
          <Icon name="check" size={13} className="text-paper" />
        ) : (
          <Icon name="check" size={13} className="text-ink" />
        ))}
      {!active && !colour && (
        <span className="h-[2px] w-3.5 bg-rule" />
      )}
    </button>
  );
}

function Cell({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-edge ring-1 transition-colors ${
        active
          ? "bg-accent-soft text-accent ring-accent/40"
          : "text-ink ring-rule hover:bg-sunk"
      }`}
    >
      {children}
    </button>
  );
}
