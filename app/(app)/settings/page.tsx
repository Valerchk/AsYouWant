"use client";

import { useEffect, useState } from "react";
import { LoadFailure } from "@/components/LoadFailure";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatClock, formatDuration } from "@/lib/time";
import { createClient } from "@/lib/supabase/client";
import { usingDatabase } from "@/lib/data";
import type { Database } from "@/lib/supabase/types";

/* Preferences that used to be constants in the source.

   Everything here changes what the app actually does, including what the
   scheduler sends — a settings screen whose switches only redraw themselves
   is worse than none. */

interface Prefs {
  dayStartMin: number;
  dayEndMin: number;
  eveningReviewMin: number;
  requireConfirm: boolean;
  ribbonDensity: "compact" | "comfortable";
  collapsePast: boolean;
  notifyLive: boolean;
  notifyLeadMin: number;
  quietFromMin: number | null;
  quietToMin: number | null;
}

const LEAD_CHOICES = [0, 5, 10, 15, 30];

export default function Settings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usingDatabase()) {
      // Deferred so the assignment happens in a callback, not in the effect
      // body — the same rule that keeps a render from cascading.
      queueMicrotask(() =>
        setError(
          "Settings are stored with your account. Sign in to change them.",
        ),
      );
      return;
    }
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!user) throw new Error("Not signed in.");
        return supabase.from("profiles").select("*").eq("id", user.id).single();
      })
      .then(({ data, error: e }) => {
        if (e) throw new Error(e.message);
        setPrefs({
          dayStartMin: data.day_start_min,
          dayEndMin: data.day_end_min,
          eveningReviewMin: data.evening_review_min,
          requireConfirm: data.require_confirm,
          ribbonDensity: data.ribbon_density,
          collapsePast: data.collapse_past,
          notifyLive: data.notify_live,
          notifyLeadMin: data.notify_lead_min,
          quietFromMin: data.quiet_from_min,
          quietToMin: data.quiet_to_min,
        });
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  /* Applied on screen first, then written. A settings toggle that waits for a
     round trip feels broken even when it is working. */
  function patch(next: Partial<Prefs>) {
    setPrefs((p) => (p ? { ...p, ...next } : p));

    const row: Partial<Database["public"]["Tables"]["profiles"]["Row"]> = {};
    if (next.dayStartMin !== undefined) row.day_start_min = next.dayStartMin;
    if (next.dayEndMin !== undefined) row.day_end_min = next.dayEndMin;
    if (next.eveningReviewMin !== undefined) {
      row.evening_review_min = next.eveningReviewMin;
    }
    if (next.requireConfirm !== undefined) {
      row.require_confirm = next.requireConfirm;
    }
    if (next.ribbonDensity !== undefined) row.ribbon_density = next.ribbonDensity;
    if (next.collapsePast !== undefined) row.collapse_past = next.collapsePast;
    if (next.notifyLive !== undefined) row.notify_live = next.notifyLive;
    if (next.notifyLeadMin !== undefined) row.notify_lead_min = next.notifyLeadMin;
    if (next.quietFromMin !== undefined) row.quiet_from_min = next.quietFromMin;
    if (next.quietToMin !== undefined) row.quiet_to_min = next.quietToMin;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .update(row)
        .eq("id", user.id)
        .then(({ error: e }) => {
          if (e) setError(e.message);
        });
    });
  }

  if (error) return <LoadFailure what="your settings" message={error} />;

  if (!prefs) {
    return (
      <main className="chrome mx-auto max-w-2xl px-6 pt-7">
        <div className="num text-micro text-faint">LOADING</div>
      </main>
    );
  }

  const quiet = prefs.quietFromMin !== null && prefs.quietToMin !== null;

  return (
    <main className="chrome mx-auto max-w-2xl px-6 pb-32">
      <header className="safe-top flex items-start justify-between pt-7">
        <div>
          <div className="num text-micro tracking-[0.18em] text-faint">
            AS YOU WANT IT
          </div>
          <h1 className="display mt-1.5 text-title text-deep">Settings</h1>
        </div>
        <div className="-mr-2">
          <ThemeToggle />
        </div>
      </header>

      <Group title="Your day">
        <Row label="Starts" hint="Before this, the ribbon stays quiet.">
          <TimeField
            value={prefs.dayStartMin}
            onChange={(v) => patch({ dayStartMin: Math.min(v, prefs.dayEndMin - 60) })}
          />
        </Row>
        <Row label="Ends">
          <TimeField
            value={prefs.dayEndMin}
            onChange={(v) => patch({ dayEndMin: Math.max(v, prefs.dayStartMin + 60) })}
          />
        </Row>
        <Row label="Evening review" hint="When the day's cut arrives.">
          <TimeField
            value={prefs.eveningReviewMin}
            onChange={(v) => patch({ eveningReviewMin: v })}
          />
        </Row>
        <Row
          label="Confirm the day first"
          hint="Reminders stay silent until you agree to the plan."
        >
          <Switch
            on={prefs.requireConfirm}
            onChange={(v) => patch({ requireConfirm: v })}
          />
        </Row>
      </Group>

      <Group title="The ribbon">
        <Row label="Density">
          <Choice
            options={[
              { value: "comfortable", label: "Roomy" },
              { value: "compact", label: "Compact" },
            ]}
            value={prefs.ribbonDensity}
            onChange={(v) =>
              patch({ ribbonDensity: v as "compact" | "comfortable" })
            }
          />
        </Row>
        <Row
          label="Fold away earlier today"
          hint="Opens on now instead of the morning."
        >
          <Switch
            on={prefs.collapsePast}
            onChange={(v) => patch({ collapsePast: v })}
          />
        </Row>
      </Group>

      <Group title="What it says">
        <Row
          label="Live card"
          hint="One notification that rewrites itself as the day moves."
        >
          <Switch
            on={prefs.notifyLive}
            onChange={(v) => patch({ notifyLive: v })}
          />
        </Row>
        <Row label="Warn before a block ends">
          <Choice
            options={LEAD_CHOICES.map((m) => ({
              value: String(m),
              label: m === 0 ? "Never" : formatDuration(m),
            }))}
            value={String(prefs.notifyLeadMin)}
            onChange={(v) => patch({ notifyLeadMin: Number(v) })}
          />
        </Row>
        <Row label="Quiet hours" hint="Nothing is sent between these.">
          <Switch
            on={quiet}
            onChange={(v) =>
              patch(
                v
                  ? { quietFromMin: 22 * 60, quietToMin: 7 * 60 }
                  : { quietFromMin: null, quietToMin: null },
              )
            }
          />
        </Row>
        {quiet && (
          <Row label="From / to">
            <div className="flex items-center gap-2">
              <TimeField
                value={prefs.quietFromMin!}
                onChange={(v) => patch({ quietFromMin: v })}
              />
              <span className="text-micro text-faint">to</span>
              <TimeField
                value={prefs.quietToMin!}
                onChange={(v) => patch({ quietToMin: v })}
              />
            </div>
          </Row>
        )}
      </Group>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="mb-2 border-b border-rule pb-2 text-micro tracking-[0.18em] text-faint uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-grid py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-base text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-micro text-faint">{hint}</div>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function TimeField({
  value,
  onChange,
}: {
  value: number;
  onChange: (min: number) => void;
}) {
  return (
    <input
      type="time"
      value={formatClock(value)}
      onChange={(e) => {
        const [h, m] = e.target.value.split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) onChange(h * 60 + m);
      }}
      className="num rounded-edge bg-sunk px-2.5 py-1.5 text-fine text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
    />
  );
}

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`h-7 w-12 rounded-plate p-0.5 ring-1 transition-colors ${
        on ? "bg-accent ring-accent" : "bg-sunk ring-rule"
      }`}
    >
      <span
        className={`block h-6 w-6 rounded-plate transition-transform ${
          on ? "translate-x-5 bg-paper" : "bg-rule"
        }`}
      />
    </button>
  );
}

function Choice({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-edge px-2.5 py-1.5 text-micro transition-colors ${
            value === o.value
              ? "bg-accent-soft text-accent ring-1 ring-accent/40"
              : "text-ink ring-1 ring-rule hover:bg-sunk"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
